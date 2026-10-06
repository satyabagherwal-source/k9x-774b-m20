# Forensic Learning Record (Deep Inspection): sentrux/sentrux

> **Canonical Artifact**: `07_PROJECT_LEARNING/sentrux-sentrux-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sentrux/sentrux](https://github.com/sentrux/sentrux))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:18:19.593Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sentrux/sentrux`
- **Description**: Real-time architectural sensor that helps AI agents close the feedback loop, enabling recursive self-improvement of code quality. Pure Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3313 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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

/// Compute call edges between files connected by import edges.
/// Only emits edges where the caller imports the callee (proof of intent).
fn compute_call_edges<'a>(
    files: &[&'a FileNode],
    lang_map: &HashMap<&'a str, &'a str>,
    func_map: &HashMap<&'a str, Vec<&'a str>>,
    class_map: &HashMap<&'a str, Vec<&'a str>>,
    import_targets: &HashMap<&'a str, HashSet<&'a str>>,
    max_call_targets: usize,
) -> Vec<CallEdge> {
    let mut all_edges: Vec<CallEdge> = files
        .par_iter()
        .filter(|file| !file.is_dir)
        .flat_map(|file| {
            let mut edges = Vec::new();
            let src_lang = lang_map.get(file.path.as_str()).copied().unwrap_or("");
            if src_lang.is_empty() {
                return edges;
            }
            let imported_files = import_targets.get(file.path.as_str());
            // Check if this language has implicit module visibility (e.g., Swift)
            let profile = crate::analysis::lang_registry::profile(src_lang);
            let implicit = profile.semantics.project.implicit_module;
            let sa = match &file.sa {
                Some(sa) => sa,
                None => return edges,
            };

            let mut emit_call = |from_func: &str, call_name: &str| {
                // Match against function names
                let mut targets = resolve_call_targets(
                    call_name, &file.path, src_lang, func_map, lang_map, imported_files, max_call_targets, implicit,
                );
                // Also match against class/type names — type references are dependencies too
                if targets.is_empty() {
                    targets = resolve_call_targets(
                        call_name, &file.path, src_lang, class_map, lang_map, imported_files, max_call_targets, implicit,
                    );
                }
                for target_file in targets {
                    edges.push(CallEdge {
                        from_file: file.path.clone(),
                        from_func: from_func.to_string(),
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
            .collect()
    }

    /// All source dirs across all loaded plugins (merged set for module boundary detection).
    pub fn all_source_dirs(&self) -> std::collections::HashSet<&str> {
        self.configs.iter()
            .flat_map(|c| c.profile.semantics.project.source_dirs.iter().map(|s| s.as_str()))
            .collect()
    }

    /// All mod_declaration_files across all loaded plugins (merged set).
    pub fn all_mod_declaration_files(&self) -> std::collections::HashSet<&str> {
        self.configs.iter()
            .flat_map(|c| c.profile.semantics.project.mod_declaration_files.iter().map(|s| s.as_str()))
            .collect()
    }

    /// All package_index_files across all loaded plugins (merged set).
    pub fn all_package_index_files(&self) -> std::collections::HashSet<&str> {
        self.configs.iter()
            .flat_map(|c| c.profile.semantics.package_index_files.iter().map(|s| s.as_str()))
            .collect()
    }

    /// Iterate over all loaded profiles.
    pub fn all_profiles(&self) -> impl Iterator<Item = &LanguageProfile> {
        self.configs.iter().map(|c| &c.profile)
    }

    /// Failed plugin descriptions (for UI display).
    pub fn failed(&self) -> &[String] {
        &self.failed
    }
}

// ── Public free functions delegating to global singleton ──

/// Get language config by name.
pub fn get(name: &str) -> Option<&'static PluginLangConfig> {
    REGISTRY.get(name)
}

/// Get language profile by name. Returns default profile if no plugin loaded.
pub fn profile(name: &str) -> &'static LanguageProfile {
    REGISTRY.profile(name)
}

/// Get grammar + query for a language name.
pub fn get_grammar_and_query(name: &str) -> Option<(&'static Language, &'static Query)> {
    REGISTRY.get(name).map(|c| (&c.grammar, &c.query))
}

/// All registered extensions.
pub fn all_extensions() -> Vec<&'static str> {
    REGISTRY.all_extensions()
}

/// Number of loaded language plugins.
pub fn plugin_count() -> usize {
    REGISTRY.count()
}

///
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

### Core Architecture Module: `sentrux-core/src/analysis/parser/ast_import_walker.rs`
```
//! Generic AST-based import path extraction.
//!
//! Replaces 13 compiled language-specific text extractors with one generic
//! tree-sitter AST walker. Reads module paths directly from AST node fields
//! and children — no text re-parsing needed.
//!
//! Configuration comes from plugin.toml `[semantics.import_ast]`.
//! Two strategies:
//!   - `field_read`: read a named field/child (Python, Go, JS, C, Ruby)
//!   - `scoped_path`: concatenate scoped identifier chains (Rust, Java)

use crate::analysis::plugin::profile::ImportAstConfig;

/// Maximum recursion depth for AST walking (prevents stack overflow on malformed ASTs).
const MAX_DEPTH: usize = 64;

/// Extract import module paths from a tree-sitter import node using AST structure.
///
/// Returns raw module path strings (not yet normalized with dot→slash conversion).
/// The caller handles normalization via `normalize_module_path()`.
pub(super) fn extract_imports_from_ast(
    import_node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
) -> Vec<String> {
    match config.strategy.as_str() {
        "field_read" => extract_field_read(import_node, content, config),
        "scoped_path" => extract_scoped_path(import_node, content, config),
        _ => vec![], // Unknown strategy — caller falls back to legacy
    }
}

// ── Strategy: field_read ──────────────────────────────────────────────

/// Read module paths from a named field or child nodes of the import AST node.
/// Handles: Python (module_name), Go (path), JS (source), C (path), Ruby (arguments).
/// Try extracting a module path from the named field of an import node.
fn try_named_field(
    import_node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
) -> Option<Vec<String>> {
    if config.module_path_field.is_empty() {
        return None;
    }
    let field_node = import_node.child_by_field_name(&config.module_path_field)?;
    if config.filter_system_includes && field_node.kind() == config.system_include_kind {
        return Some(vec![]);
    }
    read_path_from_node(field_node, content, config)
        .map(|path| vec![apply_transform(&path, config)])
}

/// Collect paths from direct named children matching module_path_node_kinds.
fn collect_from_direct_children(
    import_node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
) -> Vec<String> {
    let mut results = Vec::new();
    for i in 0..import_node.named_child_count() {
        if let Some(child) = import_node.named_child(i) {
            if config.module_path_node_kinds.iter().any(|k| k == child.kind()) {
                if config.filter_system_includes && child.kind() == config.system_include_kind {
                    continue;
                }
                if let Some(path) = read_path_from_node(child, content, config) {
                    results.push(apply_transform(&path, config));
                }
            }
        }
    }
    results
}

fn extract_field_read(
    import_node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
) -> Vec<String> {
    if !config.child_import_kind.is_empty() {
        return extract_from_container(import_node, content, config);
    }
    if let Some(result) = try_named_field(import_node, content, config) {
        return result;
    }
    let mut results = Vec::new();
    if config.recursive_search {
        collect_matching_descendants(import_node, content, config, &mut results);
    } else {
        results = collect_from_direct_children(import_node, content, config);
    }
    results
}

/// Recursively collect all descendant nodes matching module_path_node_kinds.
/// Used when import paths are deeply nested in the AST.
/// Multi-alias expansion (e.g., Elixir `Prefix.{A, B}`) is handled by
/// generic brace expansion in imports.rs — no AST knowledge needed here.
fn collect_matching_descendants(
    node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
    results: &mut Vec<String>,
) {
    for i in 0..node.named_child_count() {
        if let Some(child) = node.named_child(i) {
            if config.module_path_node_kinds.iter().any(|k| k == child.kind()) {
                if let Some(path) = read_path_from_node(child, content, config) {
                    results.push(apply_transform(&path, config));
                }
            }
            // Recurse into children regardless — multi-alias may nest several levels deep
            collect_matching_descendants(child, content, config, results);
        }
    }
}

/// Handle container import nodes (Go import_declaration with multiple import_spec children).
fn extract_from_container(
    container_node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
) -> Vec<String> {
    let mut results = Vec::new();

    // Look for container list node (Go: import_spec_list)
    for i in 0..container_node.named_child_count() {
        if let Some(child) = container_node.named_child(i) {
            // Check if this child is the list or the spec itself
            if child.kind() == config.child_import_kind.as_str() {
                // Direct child matches spec kind
                results.extend(extract_field_read_single(child, content, config));
            } else {
                // Check grandchildren (the list contains the specs)
                for j in 0..child.named_child_count() {
                    if let Some(gc) = child.named_child(j) {
                        if gc.kind() == config.child_import_kind.as_str() {
                            results.extend(extract_field_read_single(gc, content, config));
                        }
                    }
                }
            }
        }
    }
    results
}

/// Extract a single path from an import spec node.
fn extract_field_read_single(
    node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
) -> Vec<String> {
    if !config.module_path_field.is_empty() {
        if let Some(field_node) = node.child_by_field_name(&config.module_path_field) {
            if config.filter_system_includes && field_node.kind() == config.system_include_kind {
                return vec![];
            }
            if let Some(path) = read_path_from_node(field_node, content, config) {
                return vec![apply_transform(&path, config)];
            }
        }
    }
    vec![]
}

/// Read the module path text from a node, optionally unwrapping string literals.
fn read_path_from_node(
    node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
) -> Option<String> {
    // Handle Python relative imports
    if !config.relative_import_kind.is_empty() && node.kind() == config.relative_import_kind {
        return read_relative_import(node, content, config);
    }

    // If string_content_kind is set, unwrap the string literal
    if !config.string_content_kind.is_empty() {
        return find_string_content(node, content, &config.string_content_kind);
    }

    // Read node text directly
    node.utf8_text(content).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

/// Read module path from a Python relative import node.
/// Counts dots from import_prefix and appends the module path.
fn read_relative_import(
    node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
) -> Option<String> {
    let mut dots = String::new();
    let mut module_path = String::new();

    for i in 0..node.named_child_count() {
        if let Some(child) = node.named_child(i) {
            if !config.import_prefix_kind.is_empty() && child.kind() == config.import_prefix_kind {
                // Count dots in the prefix
                if let Ok(text) = child.utf8_text(content) {
                    dots = text.to_string();
                }
            } else {
                // The module path after the dots
                if let Ok(text) = child.utf8_text(content) {
                    module_path = text.trim().to_string();
                }
            }
        }
    }

    if dots.is_empty() && module_path.is_empty() {
        // Fallback: read whole node text
        return node.utf8_text(content).ok().map(|s| s.trim().to_string());
    }

    let combined = format!("{}{}", dots, module_path);
    if combined.is_empty() { None } else { Some(combined) }
}

/// Find a child node of the given kind and read its text (unwrap string literals).
fn find_string_content(
    node: tree_sitter::Node,
    content: &[u8],
    kind: &str,
) -> Option<String> {
    // Direct child
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            if child.kind() == kind {
                return child.utf8_text(content).ok().map(|s| s.to_string());
            }
            // One level deeper (string → string_fragment)
            for j in 0..child.child_count() {
                if let Some(gc) = child.child(j) {
                    if gc.kind() == kind {
                        return gc.utf8_text(content).ok().map(|s| s.to_string());
                    }
                }
            }
        }
    }
    None
}

// ── Strategy: scoped_path ─────────────────────────────────────────────

/// Extract module paths from scoped identifier chains (Rust, Java).
/// Handles use_list branching (Rust `use a::{b, c}`).
fn extract_scoped_path(
    import_node: tree_sitter::Node,
    content: &[u8],
    config: &ImportAstConfig,
) -> Vec<String> {
    // Module declaration (e.g., Rust `mod foo;`) — just read the name field.
    // Configured via mod_declaration_kind in plugin TOML.
    if !config.mod_declaration_kind.is_empty() && import_node.kind() == config.mod_declaration_kind {
        if let Some(name) = import_node.child_by_field_name("name") {
            if let Ok(text) = name.utf8_text(content) {
                let t = text.trim().to_string();
                if !t.is_empty() {
                    return vec![t];
                }
            }
        }
        return vec![];
    }

    // Find the
```

### Core Architecture Module: `sentrux-core/src/analysis/parser/captures.rs`
```
//! Tree-sitter capture classification and processing helpers.
//!
//! Extracted from parser.rs to keep that module under 500 lines.
//! Contains the two-pass capture classification logic, entry-tag detection,
//! and per-match-kind processing (func def, class def, import, call).

use super::imports::{
    count_complexity_ast, count_cognitive_complexity_ast,
    count_parameters, hash_body,
    extract_base_classes,
    lang_uses_dot_separator, normalize_module_path,
};
use crate::core::types::{ClassInfo, FuncInfo};
use std::collections::HashSet;

/// Match classification for two-pass capture processing.
#[derive(Clone, Copy, PartialEq)]
pub(super) enum MatchKind {
    FuncDef,
    ClassDef,
    Import,
    Call,
}

pub(super) struct CaptureResult<'a> {
    pub(super) match_type: Option<MatchKind>,
    pub(super) match_node: Option<tree_sitter::Node<'a>>,
    pub(super) name_text: Option<String>,
    pub(super) class_kind: Option<&'a str>,
    pub(super) import_module_text: Option<String>,
    pub(super) import_node: Option<tree_sitter::Node<'a>>,
    pub(super) call_line: u32,
}

/// Set the result to a class definition with the given kind.
fn set_class_def<'a>(r: &mut CaptureResult<'a>, node: tree_sitter::Node<'a>, kind: &'static str) {
    r.match_type = Some(MatchKind::ClassDef);
    r.match_node = Some(node);
    r.class_kind = Some(kind);
}

/// Process a scoped call path, extracting the module portion as an import.
fn process_scoped_path(
    node: tree_sitter::Node,
    content: &[u8],
    imports: &mut Vec<String>,
    import_set: &mut HashSet<String>,
) {
    if let Ok(path_text) = node.utf8_text(content) {
        if let Some(last_sep) = path_text.rfind("::") {
            let module_part = &path_text[..last_sep];
            // Scoped paths (Rust ::) always use false for dots, empty namespace_sep
            let normalized = normalize_module_path(module_part, false, "");
            if !normalized.is_empty() && import_set.insert(normalized.clone()) {
                imports.push(normalized);
            }
        }
    }
}

/// Handle definition and reference captures (func/class/call/name).
fn handle_definition_capture<'a>(
    cname: &str,
    cap: &tree_sitter::QueryCapture<'a>,
    content: &[u8],
    r: &mut CaptureResult<'a>,
) -> bool {
    match cname {
        "definition.function" | "definition.method" | "func.def" => {
            r.match_type = Some(MatchKind::FuncDef);
            r.match_node = Some(cap.node);
            true
        }
        "definition.class" => { set_class_def(r, cap.node, "class"); true }
        "definition.interface" => { set_class_def(r, cap.node, "interface"); true }
        "definition.adt" => { set_class_def(r, cap.node, "adt"); true }
        "definition.type" => { set_class_def(r, cap.node, "type"); true }
        "class.def" => {
            r.match_type = Some(MatchKind::ClassDef);
            r.match_node = Some(cap.node);
            if r.class_kind.is_none() { r.class_kind = Some("class"); }
            true
        }
        "reference.call" | "reference.class" | "reference.send" | "reference.type" | "call" => {
            if r.match_type.is_none() {
                r.match_type = Some(MatchKind::Call);
                r.call_line = cap.node.start_position().row as u32 + 1;
            }
            // For reference.type, the captured node IS the name (e.g., "FEMScaffold")
            if cname == "reference.type" {
                r.name_text = cap.node.utf8_text(content).ok().map(|s| s.to_string());
            }
            true
        }
        "name" | "func.name" | "class.name" | "call.name" | "mod.name" => {
            r.name_text = cap.node.utf8_text(content).ok().map(|s| s.to_string());
            true
        }
        _ => false,
    }
}

/// Handle import, scoped path, and entry-point captures.
fn handle_import_capture<'a>(
    cname: &str,
    cap: &tree_sitter::QueryCapture<'a>,
    content: &[u8],
    lang: &str,
    r: &mut CaptureResult<'a>,
    imports: &mut Vec<String>,
    import_set: &mut HashSet<String>,
    tags: &mut Vec<String>,
    tag_set: &mut HashSet<String>,
) {
    match cname {
        "import" => {
            if !is_test_mod(cap.node, content, lang) {
                r.match_type = Some(MatchKind::Import);
                r.import_node = Some(cap.node);
            }
        }
        "import.module" => {
            r.import_module_text = cap.node.utf8_text(content).ok().map(|s| {
                s.trim_matches(|c: char| c == '"' || c == '\'').to_string()
            });
        }
        "call.scoped_path" => {
            process_scoped_path(cap.node, content, imports, import_set);
        }
        "entry" | "entry.point" => {
            classify_entry_tag(cap.node, content, lang, tags, tag_set);
        }
        _ => {}
    }
}

/// Process a single capture, updating the result accordingly.
fn process_single_capture<'a>(
    cname: &str,
    cap: &tree_sitter::QueryCapture<'a>,
    content: &[u8],
    lang: &str,
    r: &mut CaptureResult<'a>,
    imports: &mut Vec<String>,
    import_set: &mut HashSet<String>,
    tags: &mut Vec<String>,
    tag_set: &mut HashSet<String>,
) {
    if handle_definition_capture(cname, cap, content, r) {
        return;
    }
    handle_import_capture(cname, cap, content, lang, r, imports, import_set, tags, tag_set);
}

pub(super) fn classify_captures<'a>(
    captures: &'a [tree_sitter::QueryCapture<'a>],
    capture_names: &[&str],
    content: &[u8],
    lang: &str,
    imports: &mut Vec<String>,
    import_set: &mut HashSet<String>,
    tags: &mut Vec<String>,
    tag_set: &mut HashSet<String>,
) -> CaptureResult<'a> {
    let mut r = CaptureResult {
        match_type: None,
        match_node: None,
        name_text: None,
        class_kind: None,
        import_module_text: None,
        import_node: None,
        call_line: 0,
    };

    for cap in captures {
        let cname = capture_names[cap.index as usize];
        process_single_capture(cname, cap, content, lang, &mut r, imports, import_set, tags, tag_set);
    }
    r
}

/// Check if an attribute node matches all test attribute patterns.
/// Generic: patterns come from plugin TOML `test_attribute_patterns`.
fn is_test_attribute(sib: tree_sitter::Node, content: &[u8], patterns: &[String]) -> bool {
    if patterns.is_empty() { return false; }
    if let Ok(text) = sib.utf8_text(content) {
        patterns.iter().all(|p| text.contains(p.as_str()))
    } else {
        false
    }
}

/// Check if a tree-sitter node is a test module declaration preceded by a test attribute.
/// Configured via test_module_kind and test_attribute_kind in plugin TOML.
/// Test modules are not production dependencies -- including them creates
/// false mutual edges that inflate upward violations.
fn is_test_mod(node: tree_sitter::Node, content: &[u8], lang: &str) -> bool {
    let profile = crate::analysis::lang_registry::profile(lang);
    let sem = &profile.semantics;
    if sem.test_module_kind.is_empty() || sem.test_attribute_kind.is_empty() {
        return false;
    }
    if node.kind() != sem.test_module_kind {
        return false;
    }
    let mut sibling = node.prev_sibling();
    while let Some(sib) = sibling {
        if sib.kind() != sem.test_attribute_kind {
            break;
        }
        if is_test_attribute(sib, content, &sem.test_attribute_patterns) {
            return true;
        }
        sibling = sib.prev_sibling();
    }
    false
}

/// Map an entry-point tag line to its canonical label.
/// Checks against entry_point_patterns from the language's plugin TOML.
/// Falls back to a universal "@main" label if any configured pattern matches.
fn entry_tag_label(tag: &str, lang: &str) -> Option<String> {
    let profile = crate::analysis::lang_registry::profile(lang);
    let patterns = &profile.semantics.entry_point_patterns;
    if patterns.is_empty() {
        return None;
    }
    for pattern in patterns {
        if tag.contains(pattern.as_str()) {
            // Use pattern as label, or "@main" for common patterns
            if pattern.contains("main") {
                return Some("@main".to_string());
            }
            return Some(pattern.clone());
        }
    }
    None
}

fn classify_entry_tag(
    node: tree_sitter::Node,
    content: &[u8],
    lang: &str,
    tags: &mut Vec<String>,
    tag_set: &mut HashSet<String>,
) {
    let text = match node.utf8_text(content) {
        Ok(t) => t,
        Err(_) => return,
    };
    let tag = text.lines().next().unwrap_or(text).trim();
    if let Some(label) = entry_tag_label(tag, lang) {
        if tag_set.insert(label.clone()) {
            tags.push(label);
        }
    }
}

/// Shared context for parsing a single file — bundles the file content and
/// language that every process_func_def / process_class_def call needs.
pub(super) struct ParseContext<'a> {
    pub content: &'a [u8],
    pub lang: &'a str,
}

/// Compute cyclomatic + cognitive complexity for a function node.
fn compute_complexity(
    node: tree_sitter::Node,
    content: &[u8],
    profile: &crate::analysis::plugin::profile::LanguageProfile,
) -> (u32, u32) {
    if profile.semantics.complexity.is_configured() {
        let cc = count_complexity_ast(node, content, profile);
        let cog = count_cognitive_complexity_ast(node, content, profile);
        (cc, cog)
    } else {
        (1u32, 0u32)
    }
}

/// Detect whether a function is public via keyword prefix or method-parent-kind ancestry.
fn detect_visibility(
    node: tree_sitter::Node,
    body: &str,
    profile: &crate::analysis::plugin::profile::LanguageProfile,
) -> bool {
    let keywords = &profile.semantics.public_keywords;
    let mut is_public = if keywords.is_empty() {
        false
    } else {
        let text = body.trim_start();
        keywords.iter().any(|kw: &String| text.starts_with(kw.as_str()))
    };
    if !is_public && !profile.semantics.method_parent_kinds.is_empty() {
        let m
```

### Core Architecture Module: `sentrux-core/src/analysis/parser/imports.rs`
```
//! Import normalization, per-language extraction, base-class extraction,
//! complexity counting, and string/comment stripping utilities.
//!
//! Extracted from parser.rs to keep the main parser module focused on
//! tree-sitter integration and caching.
//!
//! Per-language extractors live in lang_extractors.rs.

use std::collections::HashSet;
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;

use super::lang_extractors;
pub(crate) use super::strings::strip_strings_and_comments;

// ── Import extraction & normalization ───────────────────────────────────

/// Extract and **normalize** import module paths from raw source text.
///
/// # Universal contract
/// The output is a Vec of **normalized module paths**: slash-separated segments,
/// no language syntax (no braces, no quotes, no keywords, no semicolons).
/// The resolver is completely language-agnostic — all language knowledge lives here.
///

/// Whether '.' is a module separator (not a file extension) for this language.
/// Reads from the language profile (Layer 2). Falls back to false for unknown languages.
pub(crate) fn lang_uses_dot_separator(lang: &str) -> bool {
    crate::analysis::lang_registry::profile(lang).semantics.dot_is_module_separator
}

/// Normalize a module path to slash-separated form.
/// `dots_are_separators`: true for languages where '.' means module separator
/// (Python, Java, C#, Scala, Kotlin, Ruby). False for file-path languages
/// (C/C++, Go, HTML, CSS) and Rust (uses :: which is always converted).
/// `namespace_sep`: configurable namespace separator from plugin.toml (e.g., "\\" for PHP).
///   Converted to `/` after the built-in `::` and `.` conversions, so it won't
///   conflict with those. Empty string means no extra conversion.
pub(crate) fn normalize_module_path(raw: &str, dots_are_separators: bool, namespace_sep: &str) -> String {
    let s = raw.trim();
    if s.is_empty() {
        return String::new();
    }

    // Preserve leading dots (relative imports) but normalize the rest
    let (prefix, rest) = if s.starts_with('.') {
        let dot_count = s.bytes().take_while(|&b| b == b'.').count();
        (&s[..dot_count], &s[dot_count..])
    } else {
        ("", s)
    };

    // Always convert '::' → '/' (Rust paths).
    // Convert '.' → '/' only when the language uses dots as module separators.
    // File-path languages (C, HTML, CSS) keep dots as-is (they're file extensions).
    let mut normalized = rest.replace("::", "/");
    if dots_are_separators && !normalized.contains('/') && rest.contains('.') {
        // Only convert dots when no slashes present (avoids mangling file paths
        // that were already slash-separated by the :: conversion).
        normalized = normalized.replace('.', "/");
    }

    // Convert configurable namespace separator (e.g., "\\" for PHP).
    // Only applied if it's not already handled by the built-in conversions above.
    if !namespace_sep.is_empty() && namespace_sep != "::" && namespace_sep != "." {
        normalized = normalized.replace(namespace_sep, "/");
    }

    format!("{}{}", prefix, normalized)
}

// ── Brace expansion ─────────────────────────────────────────────────────

/// Generic brace expansion for import paths.
/// `Prefix.{A, B, C}` → `["Prefix.A", "Prefix.B", "Prefix.C"]`
/// `Prefix::{A, B}` → `["Prefix::A", "Prefix::B"]`
///
/// Works on raw text — no AST knowledge needed. Handles any separator
/// (`.`, `::`, `/`) that appears before the `{`. Language-agnostic.
///
/// If the text contains no `{...}`, returns an empty vec (caller uses other methods).
pub(crate) fn expand_braces(text: &str) -> Vec<String> {
    let brace_start = match text.find('{') {
        Some(i) => i,
        None => return vec![],
    };
    let brace_end = match text[brace_start..].find('}') {
        Some(i) => brace_start + i,
        None => return vec![], // Malformed — no closing brace
    };

    // Find the start of the token containing `{` (go back to last whitespace)
    let word_start = text[..brace_start]
        .rfind(|c: char| c.is_whitespace())
        .map(|i| i + 1)
        .unwrap_or(0);

    // Prefix: everything from word start to `{`
    let prefix = &text[word_start..brace_start];

    // Items: comma-separated inside `{}`
    let items_str = &text[brace_start + 1..brace_end];
    let items: Vec<&str> = items_str
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if items.is_empty() {
        return vec![];
    }

    items.iter().map(|item| format!("{}{}", prefix, item)).collect()
}

// ── Base class extraction ───────────────────────────────────────────────

/// Extract base/parent class names from a class definition AST node.
///
/// Uses three strategies in order:
/// 1. Profile `base_class_node_kinds` (data-driven, covers most languages)
/// 2. Compiled `base_class_extractor` (for Python which needs special handling)
/// 3. Generic fallback (pattern-match on node kind names)
pub(crate) fn extract_base_classes(node: tree_sitter::Node, content: &[u8], lang: &str) -> Option<Vec<String>> {
    let profile = crate::analysis::lang_registry::profile(lang);
    let mut bases = Vec::new();

    if !profile.semantics.base_class_node_kinds.is_empty() {
        // Data-driven: use node kinds from plugin.toml
        let kinds: Vec<&str> = profile.semantics.base_class_node_kinds.iter().map(|s| s.as_str()).collect();
        lang_extractors::extract_bases_by_kinds(node, content, &kinds, &mut bases, &profile.semantics);
    } else {
        // Generic fallback: pattern-match on node kind substrings
        lang_extractors::extract_bases_generic(node, content, &mut bases, &profile.semantics);
    }

    if bases.is_empty() { None } else { Some(bases) }
}

// Legacy text-based complexity counting has been removed.
// All complexity analysis is now AST-based via count_complexity_ast()
// and count_cognitive_complexity_ast() using branch_nodes/logic_nodes
// from plugin.toml [semantics.complexity].

// ── AST-based complexity counting ─────────────────────────────────────
// These functions walk the tree-sitter AST directly instead of scanning text.
// They use node kinds from the language profile (plugin.toml [semantics.complexity]).

use std::collections::HashSet as CxHashSet;

/// Check if a node's operator text matches one of the logic operators.
fn is_logic_operator(node: tree_sitter::Node, content: &[u8], operators: &[String]) -> bool {
    if operators.is_empty() {
        return true; // No filter = count all logic_nodes
    }
    // Check the "operator" field first (many grammars have it)
    if let Some(op_node) = node.child_by_field_name("operator") {
        if let Ok(op_text) = op_node.utf8_text(content) {
            return operators.iter().any(|op| op == op_text.trim());
        }
    }
    // Fallback: check if any child is one of the operators
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            if !child.is_named() {
                if let Ok(text) = child.utf8_text(content) {
                    if operators.iter().any(|op| op == text.trim()) {
                        return true;
                    }
                }
            }
        }
    }
    false
}

/// Count nesting depth of a node by walking up to the function root.
/// Only counts ancestors whose kind is in `nesting_set`.
fn nesting_depth(
    node: tree_sitter::Node,
    func_node: tree_sitter::Node,
    nesting_set: &CxHashSet<&str>,
) -> u32 {
    let mut depth = 0u32;
    let mut current = node.parent();
    let func_id = func_node.id();
    while let Some(p) = current {
        if p.id() == func_id {
            break; // Don't count beyond the function boundary
        }
        if nesting_set.contains(p.kind()) {
            depth += 1;
        }
        current = p.parent();
    }
    depth
}

/// Walk every node in the subtree rooted at `func_node`, calling `visitor` on each.
fn walk_subtree(
    func_node: tree_sitter::Node,
    mut visitor: impl FnMut(tree_sitter::Node),
) {
    let mut cursor = func_node.walk();
    let mut visited_root = false;
    loop {
        if !visited_root { visited_root = true; }
        visitor(cursor.node());
        if cursor.goto_first_child() { continue; }
        if cursor.goto_next_sibling() { continue; }
        loop {
            if !cursor.goto_parent() { return; }
            if cursor.node().id() == func_node.id() { return; }
            if cursor.goto_next_sibling() { break; }
        }
    }
}

/// Walk the AST subtree of a function node and compute cyclomatic complexity.
/// CC = 1 + (number of branch_nodes) + (number of logic_nodes with matching operator).
pub(crate) fn count_complexity_ast(
    func_node: tree_sitter::Node,
    content: &[u8],
    profile: &crate::analysis::plugin::profile::LanguageProfile,
) -> u32 {
    let cx = &profile.semantics.complexity;
    let branch_set: CxHashSet<&str> = cx.branch_nodes.iter().map(|s| s.as_str()).collect();
    let logic_set: CxHashSet<&str> = cx.logic_nodes.iter().map(|s| s.as_str()).collect();
    let mut cc = 1u32;
    walk_subtree(func_node, |node| {
        if branch_set.contains(node.kind()) {
            cc += 1;
        } else if logic_set.contains(node.kind()) && is_logic_operator(node, content, &cx.logic_operators) {
            cc += 1;
        }
    });
    cc
}

/// Walk the AST subtree of a function node and compute cognitive complexity.
/// COG = sum of (1 + nesting_depth) for each branch node + 1 for each logic operator.
pub(crate) fn count_cognitive_complexity_ast(
    func_node: tree_sitter::Node,
    content: &[u8],
    profile: &crate::analysis::plugin::profile::LanguageProfile,
) -> u32 {
    let cx = &profile.semantics.complexity;
    let branch_set: CxHashSet<&str> = cx.branch_nodes.iter().map(|s| s.as_str()).collect();
    let logic_set: CxHashSet<&str> = cx.logic_nodes.iter().map(|s| s.as_str()).collect();
    let nesting_set: CxHashSe
```

### Core Architecture Module: `sentrux-core/src/analysis/parser/lang_extractors.rs`
```
//! Base-class extraction helpers and module name transforms.
//!
//! Import extraction is now fully AST-based (ast_import_walker.rs) or
//! handled by @import.module query captures. No text-based import
//! extractors remain.
//!
//! Base class extraction: data-driven via base_class_node_kinds in plugin.toml.

// ── Module name transforms ──────────────────────────────────────────

/// Convert a dot-separated PascalCase module path to snake_case file path.
/// "Collect.Listing" → "collect/listing", "GenServer" → "gen_server"
/// Used by Elixir via `module_name_transform = "pascal_to_snake"` in plugin.toml.
pub(super) fn pascal_to_snake_path(module: &str) -> String {
    module.split('.').map(pascal_to_snake).collect::<Vec<_>>().join("/")
}

fn pascal_to_snake(s: &str) -> String {
    let mut result = String::with_capacity(s.len() + 4);
    let chars: Vec<char> = s.chars().collect();
    for (i, &c) in chars.iter().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                let prev = chars[i - 1];
                if prev.is_lowercase() || prev.is_ascii_digit()
                    || (prev.is_uppercase()
                        && chars.get(i + 1).is_some_and(|ch| ch.is_lowercase()))
                {
                    result.push('_');
                }
            }
            result.push(c.to_lowercase().next().unwrap());
        } else {
            result.push(c);
        }
    }
    result
}

// ── Base-class extraction helpers ────────────────────────────────────

/// Collect base classes by matching child node kinds against a set of patterns.
/// Used by the data-driven `base_class_node_kinds` profile field.
pub(super) fn extract_bases_by_kinds(node: tree_sitter::Node, content: &[u8], kinds: &[&str], bases: &mut Vec<String>, sem: &crate::analysis::plugin::profile::LanguageSemantics) {
    for i in 0..node.child_count() {
        let child = node.child(i).unwrap();
        if kinds.contains(&child.kind()) {
            collect_type_identifiers(child, content, bases, sem);
        }
    }
}

/// Generic fallback: collect base classes from children whose kind contains inheritance keywords.
pub(super) fn extract_bases_generic(node: tree_sitter::Node, content: &[u8], bases: &mut Vec<String>, sem: &crate::analysis::plugin::profile::LanguageSemantics) {
    for i in 0..node.child_count() {
        let child = node.child(i).unwrap();
        let k = child.kind();
        if k.contains("superclass") || k.contains("extends")
            || k.contains("base_class") || k.contains("heritage")
        {
            collect_type_identifiers(child, content, bases, sem);
        }
    }
}

/// Default type identifier node kinds (tree-sitter conventions, cross-language).
const DEFAULT_TYPE_ID_KINDS: &[&str] = &["type_identifier", "identifier", "constant", "scope_resolution"];

/// Default visibility keywords to filter out.
const DEFAULT_VISIBILITY_KEYWORDS: &[&str] = &["public", "private", "protected"];

fn is_type_identifier_kind(kind: &str, sem: &crate::analysis::plugin::profile::LanguageSemantics) -> bool {
    if !sem.type_identifier_kinds.is_empty() {
        sem.type_identifier_kinds.iter().any(|k| k == kind)
    } else {
        DEFAULT_TYPE_ID_KINDS.contains(&kind)
    }
}

fn is_leaf_type_node(node: tree_sitter::Node, sem: &crate::analysis::plugin::profile::LanguageSemantics) -> bool {
    is_type_identifier_kind(node.kind(), sem)
        && (node.child_count() == 0 || node.kind() == "scope_resolution")
}

fn is_visibility_keyword(name: &str, sem: &crate::analysis::plugin::profile::LanguageSemantics) -> bool {
    if !sem.visibility_keywords.is_empty() {
        sem.visibility_keywords.iter().any(|k| k == name)
    } else {
        DEFAULT_VISIBILITY_KEYWORDS.contains(&name)
    }
}

const MAX_TYPE_COLLECT_DEPTH: usize = 64;

fn collect_type_identifiers(node: tree_sitter::Node, content: &[u8], out: &mut Vec<String>, sem: &crate::analysis::plugin::profile::LanguageSemantics) {
    collect_type_identifiers_inner(node, content, out, sem, 0);
}

fn collect_type_identifiers_inner(node: tree_sitter::Node, content: &[u8], out: &mut Vec<String>, sem: &crate::analysis::plugin::profile::LanguageSemantics, depth: usize) {
    if depth >= MAX_TYPE_COLLECT_DEPTH { return; }
    if is_leaf_type_node(node, sem) {
        if let Ok(text) = node.utf8_text(content) {
            let name = text.trim().to_string();
            if !name.is_empty() && !is_visibility_keyword(&name, sem) {
                out.push(name);
                return;
            }
        }
    }
    for i in 0..node.child_count() {
        collect_type_identifiers_inner(node.child(i).unwrap(), content, out, sem, depth + 1);
    }
}

```

### Core Architecture Module: `sentrux-core/src/analysis/parser/mod.rs`
```
//! Tree-sitter structural parser — extracts functions, classes, imports, and calls.
//!
//! Parses source files using language-specific tree-sitter grammars and queries.
//! Results are cached (LRU, 2000 entries) by content hash to skip reparsing
//! unchanged files during incremental rescan. Thread-safe via Mutex + thread-local parsers.

mod ast_import_walker;
mod captures;
pub mod imports;
mod lang_extractors;
mod strings;

#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests2;
#[cfg(test)]
mod ast_import_test;


use super::lang_registry;
use self::captures::{
    classify_captures, process_func_def, process_class_def, process_import,
    ImportContext, MatchKind, ParseContext,
};
use crate::core::types::{FuncInfo, StructuralAnalysis};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Mutex;
use streaming_iterator::StreamingIterator;
use tree_sitter::{Parser, Query, QueryCursor, Tree};

const CACHE_CAP: usize = 2000;

/// Unified parse cache: HashMap + insertion-order VecDeque under a single Mutex.
/// Previous design used DashMap + separate Mutex<VecDeque> which raced:
/// two threads could insert the same hash, creating duplicate CACHE_ORDER
/// entries while CACHE had only one. Eviction then removed ghost keys,
/// causing the cache to fill faster than intended. [ref:93cf32d4]
struct ParseCache {
    map: HashMap<String, StructuralAnalysis>,
    order: VecDeque<String>,
}

impl ParseCache {
    fn new() -> Self {
        Self {
            map: HashMap::with_capacity(CACHE_CAP),
            order: VecDeque::with_capacity(CACHE_CAP),
        }
    }

    fn get(&self, key: &str) -> Option<&StructuralAnalysis> {
        self.map.get(key)
    }

    fn insert(&mut self, key: String, value: StructuralAnalysis) {
        // Only insert if not already present (dedup)
        if self.map.contains_key(&key) {
            return;
        }
        // Evict oldest 10% when full
        if self.map.len() >= CACHE_CAP {
            let evict_count = CACHE_CAP / 10;
            for _ in 0..evict_count {
                if let Some(k) = self.order.pop_front() {
                    self.map.remove(&k);
                } else {
                    break;
                }
            }
        }
        self.map.insert(key.clone(), value);
        self.order.push_back(key);
    }

    fn clear(&mut self) {
        self.map.clear();
        self.order.clear();
    }
}

static CACHE: std::sync::LazyLock<Mutex<ParseCache>> =
    std::sync::LazyLock::new(|| Mutex::new(ParseCache::new()));

// Thread-local parser to avoid re-creating Parser on every call
thread_local! {
    static TL_PARSER: RefCell<Parser> = RefCell::new(Parser::new());
}

/// Clear the parser cache — called on directory switch to prevent monotonic
/// growth across scan sessions. [ref:93cf32d4]
pub fn clear_cache() {
    match CACHE.lock() {
        Ok(mut cache) => cache.clear(),
        Err(poisoned) => poisoned.into_inner().clear(),
    }
}

/// Count lines covered by comment nodes in the tree-sitter AST.
/// Uses a bool-per-line array to handle overlapping/multi-line comments.
/// Recognizes "comment", "line_comment", "block_comment" node kinds
/// (covers all tree-sitter grammars).
pub(crate) fn count_comment_lines(tree: &tree_sitter::Tree) -> u32 {
    let root = tree.root_node();
    let total_lines = root.end_position().row + 1;
    if total_lines == 0 {
        return 0;
    }
    let mut is_comment = vec![false; total_lines];

    fn walk(node: tree_sitter::Node, is_comment: &mut [bool]) {
        let kind = node.kind();
        if kind == "comment" || kind == "line_comment" || kind == "block_comment" {
            let start = node.start_position().row;
            let end = node.end_position().row;
            for line in start..=end.min(is_comment.len() - 1) {
                is_comment[line] = true;
            }
            return;
        }
        for i in 0..node.child_count() {
            if let Some(child) = node.child(i) {
                walk(child, is_comment);
            }
        }
    }

    walk(root, &mut is_comment);
    is_comment.iter().filter(|&&b| b).count() as u32
}

/// Parse pre-read content and return StructuralAnalysis with comment_lines populated.
/// Used by the scanner to avoid double-reading files (read once, parse + count lines).
pub(crate) fn parse_file_from_content(content: &[u8], lang: &str) -> Option<StructuralAnalysis> {
    let hash = content_hash_str(content, lang);

    // Check cache
    {
        let cache = match CACHE.lock() {
            Ok(c) => c,
            Err(p) => p.into_inner(),
        };
        if let Some(cached) = cache.get(&hash) {
            return Some(cached.clone());
        }
    }

    let (grammar, query) = super::lang_registry::get_grammar_and_query(lang)?;

    let tree = TL_PARSER.with(|parser_cell| {
        let mut parser = parser_cell.borrow_mut();
        parser.set_language(grammar).ok()?;
        parser.parse(content, None)
    })?;

    let mut sa = extract_with_queries(&tree, content, query, lang);
    sa.comment_lines = Some(count_comment_lines(&tree));

    // Cache
    {
        let mut cache = match CACHE.lock() {
            Ok(c) => c,
            Err(p) => p.into_inner(),
        };
        cache.insert(hash, sa.clone());
    }

    Some(sa)
}

fn content_hash(content: &[u8], lang: &str) -> u64 {
    // Use fast non-cryptographic hash (SipHash via std's DefaultHasher).
    // We only need dedup within a session, not collision resistance.
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    content.hash(&mut h);
    // Mix in length to reduce collisions for short content
    content.len().hash(&mut h);
    // Mix in language so identical content parsed with different grammars
    // (e.g., main.js vs main.ts) produces distinct cache keys. [C1 fix]
    lang.hash(&mut h);
    h.finish()
}

fn content_hash_str(content: &[u8], lang: &str) -> String {
    format!("{:016x}", content_hash(content, lang))
}

/// Accumulated state during query extraction.
struct ExtractionState {
    functions: Vec<FuncInfo>,
    func_set: HashSet<(String, u32)>,
    classes: Vec<crate::core::types::ClassInfo>,
    imports: Vec<String>,
    import_set: HashSet<String>,
    calls_raw: Vec<(String, u32)>,
    tags: Vec<String>,
    tag_set: HashSet<String>,
}

impl ExtractionState {
    fn new() -> Self {
        Self {
            functions: Vec::new(),
            func_set: HashSet::new(),
            classes: Vec::new(),
            imports: Vec::new(),
            import_set: HashSet::new(),
            calls_raw: Vec::new(),
            tags: Vec::new(),
            tag_set: HashSet::new(),
        }
    }

    /// Dispatch a classified capture result to the appropriate handler.
    fn dispatch_match(
        &mut self,
        r: captures::CaptureResult<'_>,
        fallback_node: tree_sitter::Node<'_>,
        pctx: &ParseContext<'_>,
    ) {
        match r.match_type {
            Some(MatchKind::FuncDef) => {
                if let Some(name) = r.name_text {
                    process_func_def(
                        name, r.match_node, fallback_node,
                        pctx, &mut self.functions, &mut self.func_set,
                    );
                }
            }
            Some(MatchKind::ClassDef) => {
                process_class_def(
                    r.name_text, r.match_node, r.class_kind,
                    pctx, &mut self.classes,
                );
            }
            Some(MatchKind::Import) => {
                let ictx = ImportContext {
                    import_module_text: r.import_module_text,
                    name_text: r.name_text,
                    import_node: r.import_node,
                    match_node: r.match_node,
                };
                process_import(
                    &ictx, pctx.lang, pctx.content, &mut self.imports, &mut self.import_set,
                );
            }
            Some(MatchKind::Call) => {
                if let Some(name) = r.name_text {
                    self.calls_raw.push((name, r.call_line));
                }
            }
            None => {}
        }
    }

    /// Post-processing for imports. No longer needed — all languages use
    /// @import/@import.module query captures or AST walker.
    fn post_process_imports(&mut self, _content: &[u8], _lang: &str) {
    }

    /// Convert into a StructuralAnalysis, distributing calls to functions.
    fn into_structural_analysis(mut self) -> StructuralAnalysis {
        let module_calls = distribute_calls_to_functions(&self.calls_raw, &mut self.functions);
        StructuralAnalysis {
            functions: if self.functions.is_empty() { None } else { Some(self.functions) },
            cls: if self.classes.is_empty() { None } else { Some(self.classes) },
            imp: if self.imports.is_empty() { None } else { Some(self.imports) },
            co: if module_calls.is_empty() { None } else { Some(module_calls) },
            tags: if self.tags.is_empty() { None } else { Some(self.tags) },
            comment_lines: None, // Filled later by parse_file_from_content
        }
    }
}

/// Extract structural analysis from a parsed syntax tree using language-specific queries.
pub(crate) fn extract_with_queries(
    tree: &Tree,
    content: &[u8],
    query: &Query,
    lang: &str,
) -> StructuralAnalysis {
    let mut cursor = QueryCursor::new();
    let mut matches = cursor.matches(query, tree.root_node(), content);
    let capture_names = query.capture_names();
    let mut state = ExtractionState::new();
    let pctx = ParseContext { content, lang };

    while let Some(m) = matches.next() {
        if m.captures.is_empty() {
            continue;
        }
        let r = classify_captures(
            m.captures, capture_names, content, lang,
            &mut state.imports, &mut state.import_set, &mut state.tags, &mut state.tag_set,
        );
 
```

### Core Architecture Module: `sentrux-core/src/analysis/parser/strings.rs`
```
//! String/comment stripping utilities for complexity counting.
//!
//! Extracted from parser_imports.rs to keep that module under 500 lines.
//! These functions remove string literals, block comments, and triple-quoted
//! strings from source code so that keywords inside them don't inflate
//! complexity counts.

// ── String/comment stripping ────────────────────────────────────────────

/// Handle a line while inside a multi-line triple-quoted string.
/// Returns (output_line, still_in_triple_quote).
fn handle_triple_quote_line(trimmed: &str, tq_char: char) -> (Option<String>, bool) {
    let tq_pattern: String = std::iter::repeat_n(tq_char, 3).collect();
    if let Some(close_pos) = trimmed.find(&tq_pattern) {
        let after = &trimmed[close_pos + 3..];
        let after_trimmed = after.trim_start();
        if after_trimmed.is_empty() {
            (None, false)
        } else {
            (Some(strip_string_literals(after)), false)
        }
    } else {
        (None, true) // still inside triple-quoted string
    }
}

/// Handle a line while inside a block comment (with nesting support).
/// Returns (output_line, new_depth).
fn handle_block_comment_line(trimmed: &str, mut depth: u32) -> (Option<String>, u32) {
    let mut pos = 0;
    let bytes = trimmed.as_bytes();
    while pos + 1 < bytes.len() {
        if bytes[pos] == b'/' && bytes[pos + 1] == b'*' {
            depth += 1;
            pos += 2;
        } else if bytes[pos] == b'*' && bytes[pos + 1] == b'/' {
            depth = depth.saturating_sub(1);
            pos += 2;
            if depth == 0 {
                let after = trimmed[pos..].trim_start();
                if after.is_empty() {
                    return (None, 0);
                }
                return (Some(strip_string_literals(after)), 0);
            }
        } else {
            pos += 1;
        }
    }
    (None, depth)
}

/// Strip inline block comments (/* ... */) from a line, handling unclosed blocks.
/// Returns (output_line, new_block_depth).
fn strip_inline_block_comments(trimmed: &str) -> (Option<String>, u32) {
    let mut work = trimmed.to_string();
    let mut had_comment = false;
    loop {
        if let Some(start_pos) = work.find("/*") {
            had_comment = true;
            if let Some(end_pos) = work[start_pos + 2..].find("*/") {
                let before = &work[..start_pos];
                let after = &work[start_pos + 2 + end_pos + 2..];
                work = format!("{} {}", before, after);
                continue;
            } else {
                let before = work[..start_pos].trim();
                if before.is_empty() {
                    return (None, 1);
                }
                return (Some(strip_string_literals(before)), 1);
            }
        }
        break;
    }
    if had_comment {
        let work_trimmed = work.trim();
        if work_trimmed.is_empty() {
            return (None, 0);
        }
        return (Some(strip_string_literals(work_trimmed)), 0);
    }
    (None, 0) // no block comment found — caller should handle
}

/// Detect unclosed triple-quote on a line (Python only). [ref:6c60c4ee]
/// Returns Some(tq_char) if we entered a triple-quote, with optional output line.
fn detect_python_triple_quote(trimmed: &str) -> Option<(char, Option<String>)> {
    let stripped_singles = strip_string_literals(trimmed);
    for tq_char in ['"', '\''] {
        let tq: String = std::iter::repeat_n(tq_char, 3).collect();
        let count = stripped_singles.matches(&tq).count();
        if count % 2 == 1 {
            if let Some(pos) = trimmed.find(&tq) {
                let before = &trimmed[..pos];
                if !before.trim().is_empty() {
                    return Some((tq_char, Some(strip_string_literals(before))));
                }
            }
            return Some((tq_char, None));
        }
    }
    None
}

/// Check if a trimmed line is a single-line comment.
/// For `*` patterns (block-comment continuation), we require the `*` to not be
/// followed by an identifier character (to avoid matching pointer dereferences
/// like `*ptr` or expressions like `* count`). A bare `*` or `* ` followed by
/// non-alphanumeric/underscore text is treated as a block comment continuation.
fn is_single_line_comment(trimmed: &str, hash_is_comment: bool) -> bool {
    if trimmed.starts_with("//") {
        return true;
    }
    if trimmed.starts_with("*/") || trimmed == "*" {
        return true;
    }
    // Block-comment continuation: `* text` but NOT `* expr = ...` (pointer deref).
    // Heuristic: a comment continuation line starting with `* ` should not contain
    // assignment operators or semicolons, which indicate code.
    if trimmed.starts_with("* ") {
        let rest = &trimmed[2..];
        // If the rest contains code indicators, it's likely pointer arithmetic, not a comment.
        if !rest.contains('=') && !rest.contains(';') && !rest.contains('(') {
            return true;
        }
    }
    if hash_is_comment && trimmed.starts_with('#') {
        return true;
    }
    false
}

/// Mutable state for the strip_strings_and_comments line processor.
struct StripState {
    block_comment_depth: u32,
    in_triple_quote: Option<char>,
}

impl StripState {
    fn new() -> Self {
        Self { block_comment_depth: 0, in_triple_quote: None }
    }

    /// Process one line, returning the stripped output (or None to skip the line).
    fn process_line(&mut self, line: &str, hash_is_comment: bool, has_triple_quote_strings: bool) -> Option<String> {
        let trimmed = line.trim_start();

        if let Some(tq_char) = self.in_triple_quote {
            let (out, still_in) = handle_triple_quote_line(trimmed, tq_char);
            self.in_triple_quote = if still_in { Some(tq_char) } else { None };
            return out;
        }

        if self.block_comment_depth > 0 {
            let (out, new_depth) = handle_block_comment_line(trimmed, self.block_comment_depth);
            self.block_comment_depth = new_depth;
            return out;
        }

        if is_single_line_comment(trimmed, hash_is_comment) {
            return None;
        }

        if trimmed.contains("/*") {
            let (out, depth) = strip_inline_block_comments(trimmed);
            self.block_comment_depth = depth;
            if out.is_some() || depth > 0 {
                return out;
            }
        }

        if has_triple_quote_strings {
            if let Some((tq_char, out)) = detect_python_triple_quote(trimmed) {
                self.in_triple_quote = Some(tq_char);
                return out;
            }
        }
        Some(strip_string_literals(line))
    }
}

/// Strip strings and comments from source code, returning only code lines.
/// Handles block comments (with nesting for Rust), single-line comments,
/// triple-quoted strings (Python), and string literals.
///
/// Language-specific behavior is driven by the language profile (Layer 2):
/// - `hash_is_comment`: from `profile.semantics.hash_is_comment`
/// - `has_triple_quote_strings`: from `profile.semantics.has_triple_quote_strings`
pub(crate) fn strip_strings_and_comments(body: &str, lang: &str) -> String {
    let profile = crate::analysis::lang_registry::profile(lang);
    let hash_is_comment = profile.semantics.hash_is_comment;
    let has_triple_quote_strings = profile.semantics.has_triple_quote_strings;
    let mut state = StripState::new();

    body.lines()
        .filter_map(|line| state.process_line(line, hash_is_comment, has_triple_quote_strings))
        .collect::<Vec<_>>()
        .join("\n")
}

// ── Helpers for strip_string_literals ────────────────────────────────

/// Try to parse a Python-style string prefix (r, b, f, rb, br, fr, rf) at position `i`.
/// Returns `Some((prefix_len, is_raw, quote_char))` if a prefixed string starts here.
fn try_prefixed_string(chars: &[char], i: usize) -> Option<(usize, bool, char)> {
    let len = chars.len();
    let c = chars[i];
    if !(c == 'r' || c == 'b' || c == 'f') || i + 1 >= len {
        return None;
    }
    // Two-char prefix (rb, br, fr, rf) followed by quote
    if i + 2 < len
        && matches!((c, chars[i + 1]), ('r', 'b') | ('b', 'r') | ('r', 'f') | ('f', 'r'))
        && (chars[i + 2] == '"' || chars[i + 2] == '\'')
    {
        let is_raw = c == 'r' || chars[i + 1] == 'r';
        return Some((2, is_raw, chars[i + 2]));
    }
    // Single-char prefix followed by quote
    if chars[i + 1] == '"' || chars[i + 1] == '\'' {
        return Some((1, c == 'r', chars[i + 1]));
    }
    None
}

/// Consume a prefixed string literal content, stripping it.
/// Returns the new position after the closing quote.
fn consume_prefixed_string(chars: &[char], mut i: usize, is_raw: bool, quote: char, result: &mut String) -> usize {
    let len = chars.len();
    while i < len {
        if !is_raw && chars[i] == '\\' && i + 1 < len {
            i += 2;
            continue;
        }
        if chars[i] == quote {
            result.push(quote);
            return i + 1;
        }
        i += 1;
    }
    i
}

/// Count consecutive '#' characters starting at position `j`.
/// Returns (hash_count, position_after_hashes).
fn count_hashes(chars: &[char], j: usize) -> (usize, usize) {
    let mut hashes = 0;
    let mut pos = j;
    while pos < chars.len() && chars[pos] == '#' {
        hashes += 1;
        pos += 1;
    }
    (hashes, pos)
}

/// Check if position `pos` is the closing `"###` of a Rust raw string.
/// Returns true if exactly `hashes` '#' chars follow the '"' at `pos`.
fn is_raw_string_close(chars: &[char], pos: usize, hashes: usize) -> bool {
    let mut k = 0;
    while k < hashes && pos + 1 + k < chars.len() && chars[pos + 1 + k] == '#' {
        k += 1;
    }
    k == hashes
}

/// Emit the raw string delimiter (r###"...or..."###) into result.
fn emit_raw_delim(result: &mut String, quote: char, hashes: usize) {
    if quote == 'r' { result.push('r'); }
    for 
```

### Core Architecture Module: `sentrux-core/src/analysis/plugin/loader.rs`
```
//! Runtime plugin loader — discovers and loads language plugins from ~/.sentrux/plugins/.
//!
//! Each plugin directory contains:
//! - plugin.toml (manifest)
//! - grammars/<platform>.so|.dylib (compiled tree-sitter grammar)
//! - queries/tags.scm (tree-sitter queries)
//!
//! Loaded grammars are registered into the global LangRegistry alongside built-in languages.
//! Plugin languages take priority over built-in (allows user overrides).

use super::manifest::PluginManifest;
use super::profile::LanguageProfile;
use std::path::{Path, PathBuf};
use tree_sitter::Language;

/// Result of loading a single plugin.
#[derive(Debug)]
pub struct LoadedPlugin {
    /// Plugin name from manifest
    pub name: String,
    /// Display name
    pub display_name: String,
    /// Version
    pub version: String,
    /// File extensions
    pub extensions: Vec<String>,
    /// Loaded tree-sitter grammar
    pub grammar: Language,
    /// Compiled tree-sitter query source
    pub query_src: String,
    /// Layer 2: language profile (semantics + thresholds)
    pub profile: LanguageProfile,
}

/// Error loading a plugin (non-fatal — logged and skipped).
#[derive(Debug)]
pub struct PluginLoadError {
    pub plugin_dir: PathBuf,
    pub error: String,
}

/// Get the user's plugins directory path (~/.sentrux/plugins/).
pub fn plugins_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".sentrux").join("plugins"))
}

/// Get the bundled plugins directory (next to the executable).
/// Used for distribution archives where grammars ship alongside the binary.
pub fn bundled_plugins_dir() -> Option<PathBuf> {
    std::env::current_exe().ok()
        .and_then(|p| p.parent().map(|d| d.join("plugins")))
        .filter(|d| d.is_dir())
}

/// Discover and load all plugins from BOTH directories:
///   1. Bundled: <exe_dir>/plugins/ (grammars shipped with distribution)
///   2. User:   ~/.sentrux/plugins/ (configs from embedded sync + user plugins)
///
/// For each language, the grammar .dylib is searched in both locations.
/// The user dir's plugin.toml/tags.scm takes priority (embedded sync keeps them current).
pub fn load_all_plugins() -> (Vec<LoadedPlugin>, Vec<PluginLoadError>) {
    let mut loaded = Vec::new();
    let mut errors = Vec::new();

    let dir = match plugins_dir() {
        Some(d) if d.is_dir() => d,
        _ => return (loaded, errors),
    };

    // If bundled plugins exist, copy any missing grammars to user dir
    // This handles: fresh install from distribution archive
    if let Some(bundled) = bundled_plugins_dir() {
        copy_bundled_grammars(&bundled, &dir);
    }

    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(e) => {
            crate::debug_log!("[plugin] Failed to read plugins dir: {}", e);
            return (loaded, errors);
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        match load_single_plugin(&path) {
            Ok(plugin) => {
                // Verbose per-plugin logging removed — registry logs the total count
                loaded.push(plugin);
            }
            Err(e) => {
                crate::debug_log!("[plugin] Failed to load {}: {}", path.display(), e);
                errors.push(PluginLoadError {
                    plugin_dir: path,
                    error: e,
                });
            }
        }
    }

    (loaded, errors)
}

/// Load a single plugin from a directory.
fn load_single_plugin(plugin_dir: &Path) -> Result<LoadedPlugin, String> {
    // 1. Parse manifest
    let manifest = PluginManifest::load(plugin_dir)?;

    // 2. Load query source
    let query_path = plugin_dir.join("queries").join("tags.scm");
    let query_src = std::fs::read_to_string(&query_path)
        .map_err(|e| format!("Failed to read {}: {}", query_path.display(), e))?;

    // 3. Validate query captures match declared capabilities
    manifest.validate_query_captures(&query_src)?;

    // 4. Load grammar binary
    let grammar_file = PluginManifest::grammar_filename();
    if grammar_file == "unsupported" {
        return Err("Unsupported platform for runtime grammar loading".into());
    }
    let grammar_path = plugin_dir.join("grammars").join(grammar_file);
    if !grammar_path.exists() {
        return Err(format!(
            "Grammar binary not found: {}. Build it for this platform.",
            grammar_path.display()
        ));
    }

    // 5. Verify checksum if provided
    verify_checksum(&manifest, &grammar_path, grammar_file)?;

    // 6. Load the grammar via dynamic library
    let symbol_name = manifest.grammar.symbol_name.as_deref()
        .unwrap_or(&manifest.plugin.name);
    let grammar = load_grammar_dynamic(&grammar_path, symbol_name)?;

    // 7. Verify ABI version
    #[allow(deprecated)]
    let abi = grammar.version();
    if abi < manifest.grammar.abi_version as usize {
        return Err(format!(
            "Grammar ABI version {} < required {}",
            abi, manifest.grammar.abi_version
        ));
    }

    // 8. Test-compile the query to catch errors early
    tree_sitter::Query::new(&grammar, &query_src)
        .map_err(|e| format!("Query compilation failed: {:?}", e))?;

    let profile = LanguageProfile {
        name: manifest.plugin.name.clone(),
        semantics: manifest.semantics,
        thresholds: manifest.thresholds,
        color_rgb: manifest.plugin.color_rgb.unwrap_or([80, 85, 90]),
    };

    Ok(LoadedPlugin {
        name: manifest.plugin.name,
        display_name: manifest.plugin.display_name,
        version: manifest.plugin.version,
        extensions: manifest.plugin.extensions,
        grammar,
        query_src,
        profile,
    })
}

/// Verify SHA256 checksum of grammar binary against manifest.
fn verify_checksum(manifest: &PluginManifest, grammar_path: &Path, platform_key: &str) -> Result<(), String> {
    // Strip extension to get platform key (e.g., "darwin-arm64.dylib" → "darwin-arm64")
    let key = platform_key.rsplit_once('.').map_or(platform_key, |(k, _)| k);
    let expected = match manifest.checksums.get(key) {
        Some(hash) => hash,
        None => return Ok(()), // No checksum in manifest = skip verification
    };

    let bytes = std::fs::read(grammar_path)
        .map_err(|e| format!("Failed to read grammar for checksum: {}", e))?;

    // Simple SHA256 via manual computation is heavy — for now, skip if no sha2 crate.
    // TODO: Add sha2 dependency and verify properly.
    let _ = (expected, bytes);
    Ok(())
}

/// Load a tree-sitter Language from a dynamic library (.so/.dylib).
///
/// The library must export a function named `tree_sitter_<name>` that returns
/// a `*const TSLanguage` pointer. This is the standard tree-sitter convention.
fn load_grammar_dynamic(path: &Path, lang_name: &str) -> Result<Language, String> {
    // Safety: we're loading a tree-sitter grammar .so/.dylib which exports
    // a single `tree_sitter_<name>()` function returning *const TSLanguage.
    // This is the same mechanism nvim-treesitter, helix, and zed use.
    unsafe {
        let lib = libloading::Library::new(path)
            .map_err(|e| format!("Failed to load {}: {}", path.display(), e))?;

        // tree-sitter convention: exported function is `tree_sitter_<name>`
        let func_name = format!("tree_sitter_{}", lang_name);
        let func: libloading::Symbol<unsafe extern "C" fn() -> Language> = lib
            .get(func_name.as_bytes())
            .map_err(|e| format!(
                "Symbol '{}' not found in {}: {}. The grammar must export tree_sitter_{}().",
                func_name, path.display(), e, lang_name
            ))?;

        let language = func();

        // Leak the library to keep it alive for the lifetime of the process.
        // tree-sitter Language holds pointers into the library's memory.
        std::mem::forget(lib);

        Ok(language)
    }
}

/// Copy grammar .dylib files from bundled distribution to user plugins dir.
/// Only copies if the user dir doesn't already have the grammar.
/// This handles: user extracts distribution → first launch → grammars copied.
fn copy_bundled_grammars(bundled_dir: &Path, user_dir: &Path) {
    let grammar_file = PluginManifest::grammar_filename();
    let entries = match std::fs::read_dir(bundled_dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() { continue; }
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let bundled_grammar = path.join("grammars").join(grammar_file);
        let user_grammar = user_dir.join(&name).join("grammars").join(grammar_file);
        if bundled_grammar.exists() && !user_grammar.exists() {
            let _ = std::fs::create_dir_all(user_dir.join(&name).join("grammars"));
            if std::fs::copy(&bundled_grammar, &user_grammar).is_ok() {
                crate::debug_log!("[plugin] Copied bundled grammar: {}", name);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugins_dir() {
        let dir = plugins_dir();
        assert!(dir.is_some());
        assert!(dir.unwrap().ends_with(".sentrux/plugins"));
    }

    #[test]
    fn test_load_nonexistent_dir() {
        let (loaded, errors) = load_all_plugins();
        // Should not crash even if dir doesn't exist
        let _ = (loaded, errors);
    }

    /// Diagnostic: dump all node types for grammars that fail to load.
    /// Run: cargo test dump_failing_grammar_nodes -- --ignored --nocapture
    #[test]
    #[ignore]
    fn dump_failing_grammar_nodes() {
        let dir = plugins_dir().unwrap();
        // Only dump languages that are NOT currently loaded (to avoid test pollution)
        let failing: [&str; 0] = [];
        for name in &failing {
            let plugin_dir = dir.join(name);
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
-                  && !p.semantics.resolver.module_prefix_directive.is_empty())
-        .map(|p| (
-            p.semantics.resolver.module_prefix_file.as_str(),
-            p.semantics.resolver.module_prefix_directive.as_str(),
-        ))
+    // Collect all plugin configs that have a module_prefix_file
+    let prefix_configs: Vec<PrefixPluginConfig<'_>> = crate::analysis::lang_registry::all_profiles()
+        .filter(|p| !p.semantics.resolver.module_prefix_file.is_empty())
+        .filter(|p| {
+            // Must have either a directive (line format) or json_paths (json_map format)
+            !p.semantics.resolver.module_prefix_directive.is_empty()
+                || (p.semantics.resolver.module_prefix_format == "json_map"
+                    && !p.semantics.resolver.module_prefix_json_paths.is_empty())
+        })
+        .map(|p| PrefixPluginConfig {
+            prefix_file: p.semantics.resolver.module_prefix_file.as_str(),
+            directive: p.semantics.resolver
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

### Incident Patch 3: `22616710` (2026-03-18)
**Commit Message**: WCAG AA semantic color system — zero hardcoded colors in UI

- Add 18 semantic color fields to ThemeConfig (status_success,
  status_error, status_warning, accent_info, diff_added, etc.)
- All 5 themes populated with WCAG AA compliant values (≥4.5:1)
- Light theme: dark colors on bright bg (was failing at 1.4:1)
- Solarized theme: tuned to official palette + WCAG compliance
- Replace ALL 59 hardcoded Color32::from_rgb() in panel/toolbar code
- Zero Color32::from_rgb remains in panel, toolbar, status_bar,
  breadcrumb code — only in ThemeConfig constructors
- Add automated WCAG test: checks 19 text colors × 5 themes = 95
  contrast ratio assertions (all must be ≥4.5:1)
- New color_utils.rs: extracted score_color + lang_profile_color
- 296 tests pass (was 295, +1 WCAG test)

**File**: `sentrux-core/src/app/breadcrumb.rs` (modified, +2/-1)
```diff
@@ -42,8 +42,9 @@ pub fn draw_breadcrumb(ui: &mut egui::Ui, state: &mut AppState) -> bool {
             let name = root.rsplit('/').next().unwrap_or(root);
             ui.horizontal(|ui| {
                 ui.label(egui::RichText::new(name).monospace().size(10.0).weak());
+                let tc = crate::core::settings::ThemeConfig::from_theme(state.theme);
                 ui.label(egui::RichText::new("(double-click a directory to drill in)").monospace().size(8.0).color(
-                    egui::Color32::from_rgb(100, 100, 110)
+                    tc.text_muted
                 ));
             });
         }
```

**File**: `sentrux-core/src/app/color_utils.rs` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+//! Color computation utilities — dynamic gradient and language profile colors.
+//!
+//! These functions compute colors from runtime data (scores, language profiles)
+//! using `Color32::from_rgb` with computed values. Kept separate from panel
+//! code so panels reference only semantic ThemeConfig colors.
+
+/// Convert a language profile's color_rgb to an egui Color32.
+pub(crate) fn lang_profile_color(profile: &crate::analysis::plugin::profile::LanguageProfile) -> egui::Color32 {
+    egui::Color32::from_rgb(profile.color_rgb[0], profile.color_rgb[1], profile.color_rgb[2])
+}
+
+/// Continuous color from score in [0, 1]. No grade boundaries.
+/// 0.0 = red, 0.5 = yellow, 1.0 = green. Smooth gradient.
+/// WCAG-aware: produces darker colors when `dark_bg` is false (light theme)
+/// to maintain >=4.5:1 contrast ratio against the background.
+/// Default score color -- assumes dark background (most themes).
+/// For light themes, use `score_color_for_theme(score, tc)`.
+pub(crate) fn score_color(score: f64) -> egui::Color32 {
+    score_color_themed(score, true)
+}
+
+/// Theme-aware score color -- picks dark or light palette based on theme.
+pub(crate) fn score_color_for_theme(score: f64, tc: &crate::core::settings::ThemeConfig) -> egui::Color32 {
+    score_color_themed(score, tc.section_is_dark)
+}
+
+/// Theme-aware score color. `dark_bg = true` for dark themes, `false` for light.
+pub(crate) fn score_color_themed(score: f64, dark_bg: bool) -> egui::Color32 {
+    let s = score.clamp(0.0, 1.0) as f32;
+    if dark_bg {
+        // Bright colors on dark background (high contrast)
+        if s < 0.5 {
+            let t = s * 2.0;
+            egui::Color32::from_rgb(
+                200,
+                (80.0 + t * 120.0) as u8,
+                (80.0 - t * 20.0) as u8,
+            )
+        } else {
+            let t = (s - 0.5) * 2.0;
+            egui::Color32::from_rgb(
+                (200.0 - t * 100.0) as u8,
+                200,
+                (60.0 + t * 40.0) as u8,
+            )
+        }
+    } else {
+        // Dark colors on light background (WCAG >=4.5:1)
+        if s < 0.5 {
+            let t = s * 2.0;
+            egui::Color32::from_rgb(
+                180,
+                (30.0 + t * 80.0) as u8,  // 30 -> 110
+                (30.0 - t * 10.0) as u8,  // 30 -> 20
+            )
+        } else {
+            let t = (s - 0.5) * 2.0;
+            egui::Color32::from_rgb(
+                (140.0 - t * 80.0) as u8,  // 140 -> 60
+                (110.0 + t * 20.0) as u8,  // 110 -> 130
+                (20.0 + t * 20.0) as u8,   // 20 -> 40
+            )
+        }
+    }
+}
```

**File**: `sentrux-core/src/app/mod.rs` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
 pub mod breadcrumb;
 pub mod canvas;
 pub mod channels;
+pub mod color_utils;
 pub mod draw_panels;
 pub mod mcp_server;
 pub mod panels;
```

**File**: `sentrux-core/src/app/panels/activity_panel.rs` (modified, +12/-15)
```diff
@@ -148,30 +148,27 @@ fn format_age(age_secs: u64) -> String {
 }
 
 /// Map activity kind string to its display character and color.
-fn kind_indicator(kind: &str, fallback: egui::Color32) -> (&'static str, egui::Color32) {
+fn kind_indicator(kind: &str, tc: &ThemeConfig, fallback: egui::Color32) -> (&'static str, egui::Color32) {
     match kind {
-        "create" => ("+", egui::Color32::from_rgb(115, 201, 145)),
-        "remove" => ("-", egui::Color32::from_rgb(224, 108, 117)),
-        "modify" => ("~", egui::Color32::from_rgb(103, 150, 230)),
+        "create" => ("+", tc.diff_added),
+        "remove" => ("-", tc.diff_removed),
+        "modify" => ("~", tc.diff_modified),
         _ => ("?", fallback),
     }
 }
 
-const DELTA_GREEN: egui::Color32 = egui::Color32::from_rgb(115, 201, 145);
-const DELTA_RED: egui::Color32 = egui::Color32::from_rgb(224, 108, 117);
-
 /// Build delta display parts (lines changed, functions changed).
-fn build_delta_parts(lines_delta: i32, funcs_delta: i32) -> Vec<(String, egui::Color32)> {
+fn build_delta_parts(lines_delta: i32, funcs_delta: i32, tc: &ThemeConfig) -> Vec<(String, egui::Color32)> {
     let mut parts = Vec::new();
     if lines_delta > 0 {
-        parts.push((format!("+{}", lines_delta), DELTA_GREEN));
+        parts.push((format!("+{}", lines_delta), tc.diff_added));
     } else if lines_delta < 0 {
-        parts.push((format!("{}", lines_delta), DELTA_RED));
+        parts.push((format!("{}", lines_delta), tc.diff_removed));
     }
     if funcs_delta > 0 {
-        parts.push((format!("+{} functions", funcs_delta), DELTA_GREEN));
+        parts.push((format!("+{} functions", funcs_delta), tc.diff_added));
     } else if funcs_delta < 0 {
-        parts.push((format!("{}  functions", funcs_delta), DELTA_RED));
+        parts.push((format!("{}  functions", funcs_delta), tc.diff_removed));
     }
     parts
 }
@@ -204,7 +201,7 @@ fn draw_activity_row(
 ) -> Option<String> {
     let entry = &state.recent_activity[idx];
     let age_str = format_age(adctx.now.duration_since(entry.time).as_secs());
-    let (kind_char, kind_color) = kind_indicator(&entry.kind, tc.text_secondary);
+    let (kind_char, kind_color) = kind_indicator(&entry.kind, tc, tc.text_secondary);
     let filename = entry.path.rsplit('/').next().unwrap_or(&entry.path);
     let is_selected = state.selected_path.as_deref() == Some(&entry.path);
     let rh = 16.0;
@@ -226,7 +223,7 @@ fn draw_activity_row(
     let nc = if is_selected { tc.selected_stroke } else { tc.file_label };
     ui.painter().text(egui::pos2(left + 14.0, cy), egui::Align2::LEFT_CENTER, filename, adctx.font10.clone(), nc);
 
-    let delta_parts = build_delta_parts(entry.lines_delta, entry.funcs_delta);
+    let delta_parts = build_delta_parts(entry.lines_delta, entry.funcs_delta, tc);
     draw_delta_labels(ui, &delta_parts, rr.right(), cy, 24.0, &adctx.font9);
 
     ui.painter().text(egui::pos2(rr.right() - 4.0, cy), egui::Align2::RIGHT_CENTER, &age_str, adctx.font9.clone(), tc.text_secondary);
@@ -257,7 +254,7 @@ fn draw_update_indicator(ui: &mut egui::Ui, tc: &ThemeConfig) {
             ui.label(
                 egui::RichText::new(format!("  v{} available", latest))
                     .monospace().size(9.0)
-                    .color(egui::Color32::from_rgb(115, 201, 145)),
+                    .color(tc.diff_added),
             ).on_hover_text("brew upgrade sentrux");
         });
         draw_sep(ui, tc, 2.0);
```

**File**: `sentrux-core/src/app/panels/dsm_panel.rs` (modified, +18/-17)
```diff
@@ -135,7 +135,7 @@ fn draw_stats(
 ) {
     let mono = |s: &str| egui::RichText::new(s).monospace().size(9.0);
     draw_stats_file_counts(ui, stats, tc, total_files, dropped_level_range, &mono);
-    draw_stats_direction_row(ui, stats, &mono);
+    draw_stats_direction_row(ui, stats, tc, &mono);
     ui.label(mono(&format!("Propagation: {}", (stats.propagation_cost * 10000.0).round() as u32)).color(tc.text_secondary));
     draw_stats_clusters(ui, stats, tc, &mono);
 }
@@ -152,13 +152,13 @@ fn draw_stats_file_counts(
     if total_files > stats.size {
         ui.label(mono(&format!("Files: {} of {}  Edges: {}", stats.size, total_files, stats.edge_count)).color(tc.text_primary));
         ui.label(mono(&format!("(sampled {} of {} — metrics approximate)", stats.size, total_files))
-            .color(egui::Color32::from_rgb(220, 170, 80)));
+            .color(tc.status_warning));
         if let Some((lo, hi)) = dropped_level_range {
             ui.label(mono(&format!("(levels L{}–L{} omitted)", lo, hi))
-                .color(egui::Color32::from_rgb(180, 150, 80)));
+                .color(tc.status_warning));
         } else {
             ui.label(mono("(middle-level files omitted)")
-                .color(egui::Color32::from_rgb(180, 150, 80)));
+                .color(tc.status_warning));
         }
     } else {
         ui.label(mono(&format!("Files: {}  Edges: {}", stats.size, stats.edge_count)).color(tc.text_primary));
@@ -170,29 +170,30 @@ fn draw_stats_file_counts(
 fn draw_stats_direction_row(
     ui: &mut egui::Ui,
     stats: &DsmStats,
+    tc: &crate::core::settings::ThemeConfig,
     mono: &dyn Fn(&str) -> egui::RichText,
 ) {
     ui.horizontal(|ui| {
         ui.spacing_mut().item_spacing.x = 8.0;
         ui.label(
             mono(&format!("▼ {}", stats.below_diagonal))
-                .color(egui::Color32::from_rgb(100, 200, 100)),
+                .color(tc.status_success),
         );
         if stats.above_diagonal > 0 {
             ui.label(
                 mono(&format!("▲ {}", stats.above_diagonal))
-                    .color(egui::Color32::from_rgb(220, 100, 100)),
+                    .color(tc.status_error),
             );
         } else {
             ui.label(
                 mono("▲ 0")
-                    .color(egui::Color32::from_rgb(100, 200, 100)),
+                    .color(tc.status_success),
             );
         }
         if stats.same_level > 0 {
             ui.label(
                 mono(&format!("↔ {}", stats.same_level))
-                    .color(egui::Color32::from_rgb(100, 160, 160)),
+                    .color(tc.accent_coupling),
             );
         }
     });
@@ -242,14 +243,14 @@ struct DsmColors {
 }
 
 impl DsmColors {
-    fn new() -> Self {
+    fn from_theme(tc: &crate::core::settings::ThemeConfig) -> Self {
         Self {
-            diag: egui::Color32::from_rgb(80, 80, 100),
-            below: egui::Color32::from_rgb(50, 140, 80),
-            above: egui::Color32::from_rgb(180, 60, 60),
-            same_level: egui::Color32::from_rgb(80, 120, 120),
-            hover: egui::Color32::from_rgb(100, 100, 140),
-            level_break: egui::Color32::from_rgb(60, 60, 80),
+            diag: tc.section_border,
+            below: tc.status_success,
+            above: tc.status_error,
+            same_level: tc.accent_coupling,
+            hover: tc.section_border,
+            level_break: tc.section_border,
         }
     }
 }
@@ -302,7 +303,7 @@ fn cell_color(
     } else if is_hovered {
         Some(dctx.colors.hover.linear_multiply(0.3))
     } else if dctx.selected_row.is_some_and(|sr| row == sr || col == sr) {
-        Some(egui::Color32::from_rgba_unmultiplied(100, 100, 180, 25))
+        Some(dctx.tc.selected_stroke.linear_multiply(0.1))
     } else {
         None
     }
@@ -439,7 +440,7 @@ fn draw_matrix(
         label_width,
         cell_size,
         display_size,
-        colors: DsmColors::new(),
+        colors: DsmColors::from_theme(tc),
         hover_row,
         hover_col,
         selected_row,
```

**File**: `sentrux-core/src/app/panels/evolution_display.rs` (modified, +10/-10)
```diff
@@ -5,7 +5,7 @@
 
 use crate::metrics::evo::EvolutionReport;
 use super::ThemeConfig;
-use super::ui_helpers::score_color;
+use super::ui_helpers::score_color_for_theme;
 
 /// Draw the evolution section in the metrics panel.
 pub(crate) fn draw_evolution_section(ui: &mut egui::Ui, report: &EvolutionReport, tc: &ThemeConfig) {
@@ -43,7 +43,7 @@ pub(crate) fn draw_evolution_section(ui: &mut egui::Ui, report: &EvolutionReport
             tc.text_secondary,
         );
         if *score >= 0.0 {
-            let c = score_color(*score);
+            let c = score_color_for_theme(*score, tc);
             ui.painter().text(
                 egui::pos2(rect.right() - 4.0, cy),
                 egui::Align2::RIGHT_CENTER,
@@ -82,9 +82,9 @@ pub(crate) fn draw_evolution_section(ui: &mut egui::Ui, report: &EvolutionReport
     draw_bus_factor(ui, report, tc, row_h);
 }
 
-fn draw_hotspots(ui: &mut egui::Ui, report: &EvolutionReport, _tc: &ThemeConfig, row_h: f32) {
+fn draw_hotspots(ui: &mut egui::Ui, report: &EvolutionReport, tc: &ThemeConfig, row_h: f32) {
     if report.hotspots.is_empty() { return; }
-    let color = egui::Color32::from_rgb(200, 140, 80);
+    let color = tc.accent_hotspot;
     ui.add_space(3.0);
     ui.label(egui::RichText::new("HOTSPOTS (churn x complexity)").monospace().size(8.0).color(color));
     for hs in report.hotspots.iter().take(5) {
@@ -105,13 +105,13 @@ fn draw_hotspots(ui: &mut egui::Ui, report: &EvolutionReport, _tc: &ThemeConfig,
             egui::pos2(rect.left() + 4.0, rect.center().y),
             egui::Align2::LEFT_CENTER,
             format!("  +{} more", report.hotspots.len() - 5),
-            egui::FontId::monospace(8.0), egui::Color32::from_rgb(140, 140, 140));
+            egui::FontId::monospace(8.0), tc.text_muted);
     }
 }
 
-fn draw_coupling(ui: &mut egui::Ui, report: &EvolutionReport, _tc: &ThemeConfig, row_h: f32) {
+fn draw_coupling(ui: &mut egui::Ui, report: &EvolutionReport, tc: &ThemeConfig, row_h: f32) {
     if report.coupling_pairs.is_empty() { return; }
-    let color = egui::Color32::from_rgb(140, 180, 200);
+    let color = tc.accent_coupling;
     ui.add_space(3.0);
     ui.label(egui::RichText::new("CHANGE COUPLING (co-change)").monospace().size(8.0).color(color));
     for pair in report.coupling_pairs.iter().take(5) {
@@ -135,11 +135,11 @@ fn draw_coupling(ui: &mut egui::Ui, report: &EvolutionReport, _tc: &ThemeConfig,
             egui::pos2(rect.left() + 4.0, rect.center().y),
             egui::Align2::LEFT_CENTER,
             format!("  +{} more pairs", report.coupling_pairs.len() - 5),
-            egui::FontId::monospace(8.0), egui::Color32::from_rgb(140, 140, 140));
+            egui::FontId::monospace(8.0), tc.text_muted);
     }
 }
 
-fn draw_bus_factor(ui: &mut egui::Ui, report: &EvolutionReport, _tc: &ThemeConfig, row_h: f32) {
+fn draw_bus_factor(ui: &mut egui::Ui, report: &EvolutionReport, tc: &ThemeConfig, row_h: f32) {
     let mut single_author_files: Vec<(&str, &str)> = report.authors.iter()
         .filter(|(_, info)| info.author_count == 1)
         .map(|(path, info)| (path.as_str(), info.primary_author.as_str()))
@@ -149,7 +149,7 @@ fn draw_bus_factor(ui: &mut egui::Ui, report: &EvolutionReport, _tc: &ThemeConfi
 
     if single_author_files.is_empty() { return; }
 
-    let color = egui::Color32::from_rgb(200, 160, 200);
+    let color = tc.accent_bus_factor;
     ui.add_space(3.0);
     ui.label(egui::RichText::new("BUS FACTOR RISK (single author)").monospace().size(8.0).color(color));
     for (path, author) in single_author_files.iter().take(5) {
```

**File**: `sentrux-core/src/app/panels/file_detail.rs` (modified, +2/-4)
```diff
@@ -44,9 +44,7 @@ pub(crate) fn draw_file_detail(
         let lang_text = format!("{} \u{00b7} {} lines \u{00b7} {} functions",
             entry.lang, entry.lines, entry.funcs);
         let profile = crate::analysis::lang_registry::profile(&entry.lang);
-        let color = egui::Color32::from_rgb(
-            profile.color_rgb[0], profile.color_rgb[1], profile.color_rgb[2],
-        );
+        let color = super::ui_helpers::lang_profile_color(&profile);
         ui.horizontal(|ui| {
             let (dot_rect, _) = ui.allocate_exact_size(egui::vec2(8.0, 10.0), egui::Sense::hover());
             ui.painter().circle_filled(dot_rect.center(), 3.0, color);
@@ -177,7 +175,7 @@ fn draw_functions_section(
     for f in sorted_funcs.iter().take(15) {
         let cc = f.cc.unwrap_or(0);
         let cc_color = if cc > 15 {
-            egui::Color32::from_rgb(203, 75, 22)
+            tc.accent_high_complexity
         } else {
             tc.text_secondary
         };
```

**File**: `sentrux-core/src/app/panels/health_display.rs` (modified, +10/-10)
```diff
@@ -6,7 +6,7 @@
 
 use crate::metrics::HealthReport;
 use super::ThemeConfig;
-use super::ui_helpers::score_color;
+use super::ui_helpers::score_color_for_theme;
 
 pub(crate) fn draw_health_section(ui: &mut egui::Ui, report: &HealthReport, tc: &ThemeConfig) {
     let row_h = 13.0;
@@ -38,8 +38,8 @@ pub(crate) fn draw_health_section(ui: &mut egui::Ui, report: &HealthReport, tc:
 
     // ── Flagged items ──
     draw_cycles(ui, report, tc, row_h);
-    draw_flagged_files(ui, report, row_h);
-    draw_unstable(ui, report, row_h);
+    draw_flagged_files(ui, report, tc, row_h);
+    draw_unstable(ui, report, tc, row_h);
 }
 
 /// Draw the quality signal bar at the top.
@@ -51,7 +51,7 @@ fn draw_quality_signal(ui: &mut egui::Ui, report: &HealthReport, tc: &ThemeConfi
     ui.add_space(2.0);
 
     let signal = report.quality_signal;
-    let color = score_color(signal);
+    let color = score_color_for_theme(signal, tc);
 
     let (grade_rect, _) = ui.allocate_exact_size(egui::vec2(ui.available_width(), 18.0), egui::Sense::hover());
     ui.painter().text(
@@ -94,7 +94,7 @@ fn draw_root_cause_row(
     );
 
     // Score as integer 0-10000 — every point is one point
-    let color = score_color(score);
+    let color = score_color_for_theme(score, tc);
     ui.painter().text(
         egui::pos2(rect.right() - 4.0, cy), egui::Align2::RIGHT_CENTER,
         format!("{}", (score * 10000.0).round() as u32), font.clone(), color,
@@ -112,7 +112,7 @@ fn draw_root_cause_row(
 fn draw_cycles(ui: &mut egui::Ui, report: &HealthReport, tc: &ThemeConfig, row_h: f32) {
     if report.circular_dep_files.is_empty() { return; }
     ui.add_space(3.0);
-    let warn_color = egui::Color32::from_rgb(200, 80, 80);
+    let warn_color = tc.status_error;
     ui.label(egui::RichText::new("CYCLES").monospace().size(8.0).color(warn_color));
     for (i, cycle) in report.circular_dep_files.iter().take(2).enumerate() {
         let files_str: Vec<&str> = cycle.iter().take(3).map(|s| {
@@ -136,8 +136,8 @@ fn draw_cycles(ui: &mut egui::Ui, report: &HealthReport, tc: &ThemeConfig, row_h
     }
 }
 
-fn draw_flagged_files(ui: &mut egui::Ui, report: &HealthReport, row_h: f32) {
-    let warn_color = egui::Color32::from_rgb(200, 170, 80);
+fn draw_flagged_files(ui: &mut egui::Ui, report: &HealthReport, tc: &ThemeConfig, row_h: f32) {
+    let warn_color = tc.status_warning;
     draw_flagged_list(ui, "GOD FILES (fan-out)", &report.god_files, warn_color, row_h);
     draw_flagged_list(ui, "HOTSPOTS (fan-in)", &report.hotspot_files, warn_color, row_h);
 }
@@ -161,11 +161,11 @@ fn draw_flagged_list(ui: &mut egui::Ui, title: &str, items: &[crate::metrics::Fi
     }
 }
 
-fn draw_unstable(ui: &mut egui::Ui, report: &HealthReport, row_h: f32) {
+fn draw_unstable(ui: &mut egui::Ui, report: &HealthReport, tc: &ThemeConfig, row_h: f32) {
     let unstable: Vec<_> = report.most_unstable.iter()
         .filter(|m| m.instability > 0.8).take(2).collect();
     if unstable.is_empty() { return; }
-    let color = egui::Color32::from_rgb(180, 140, 200);
+    let color = tc.accent_unstable;
     ui.add_space(3.0);
     ui.label(egui::RichText::new("UNSTABLE (I>0.8)").monospace().size(8.0).color(color));
     for m in &unstable {
```

---

### Incident Patch 4: `74f2213e` (2026-03-18)
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

### Incident Patch 5: `230bc9df` (2026-03-18)
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

### Incident Patch 6: `5270dc9d` (2026-03-18)
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

### Incident Patch 7: `9cc9d52f` (2026-03-18)
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

**File**: `sentrux-core/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "sentrux-core"
-version = "0.5.5"
+version = "0.5.6"
 edition = "2021"
 description = "Core library for sentrux — structural quality analysis engine"
 license = "MIT"
```

---

### Incident Patch 8: `175ee587` (2026-03-18)
**Commit Message**: Add UI scale setting + TerminessNerdFontMono font (#23)

- Replace Terminus with TerminessNerdFontMono (Nerd Font icons)
- Add ui_scale setting (0.5-3.0, default 1.0) via pixels_per_point
- Bump base text sizes: Body 13px, Button 12px, Small 11px, Heading 15px
- Clamp treemap text to 8-22 screen pixels (was 4-40)
- UI Scale slider in Settings → Font

Fixes #23

**File**: `sentrux-core/src/app/settings_panel.rs` (modified, +1/-0)
```diff
@@ -109,6 +109,7 @@ fn draw_viewport_sections(ui: &mut egui::Ui, settings: &mut Settings) -> (bool,
     let mut vc = false;
     ui.collapsing("Font", |ui| {
         vc |= slider_f32(ui, "Font Scale", &mut settings.font_scale, 0.05..=0.40);
+        vc |= slider_f32(ui, "UI Scale", &mut settings.ui_scale, 0.5..=3.0);
     });
     ui.collapsing("Viewport", |ui| {
         vc |= slider_f64(ui, "Zoom Min", &mut settings.zoom_min, 0.01..=1.0);
```

**File**: `sentrux-core/src/app/update_loop.rs` (modified, +11/-6)
```diff
@@ -33,7 +33,7 @@ impl SentruxApp {
         let load_cjk = state.settings.load_cjk_fonts
             && std::env::var("SENTRUX_NO_CJK").is_err();
         setup_fonts(ctx, load_cjk);
-        setup_style(ctx);
+        setup_style(ctx, state.settings.ui_scale);
 
         let (scan_cmd_tx, scan_cmd_rx) = bounded::<ScanCommand>(1);
         let (scan_msg_tx, scan_msg_rx) = bounded::<ScanMsg>(64);
@@ -366,12 +366,17 @@ fn setup_fonts(ctx: &egui::Context, load_cjk: bool) {
     ctx.set_fonts(fonts);
 }
 
-fn setup_style(ctx: &egui::Context) {
+fn setup_style(ctx: &egui::Context, ui_scale: f32) {
+    // Scale ALL UI (text + widgets) uniformly via pixels_per_point.
+    // This affects both text styles AND hardcoded FontId sizes in panels.
+    let base_ppp = ctx.pixels_per_point();
+    ctx.set_pixels_per_point(base_ppp * ui_scale);
+
     let mut style = (*ctx.style()).clone();
-    style.text_styles.insert(egui::TextStyle::Body, egui::FontId::new(12.0, egui::FontFamily::Monospace));
-    style.text_styles.insert(egui::TextStyle::Button, egui::FontId::new(11.0, egui::FontFamily::Monospace));
-    style.text_styles.insert(egui::TextStyle::Small, egui::FontId::new(10.0, egui::FontFamily::Monospace));
-    style.text_styles.insert(egui::TextStyle::Heading, egui::FontId::new(14.0, egui::FontFamily::Monospace));
+    style.text_styles.insert(egui::TextStyle::Body, egui::FontId::new(13.0, egui::FontFamily::Monospace));
+    style.text_styles.insert(egui::TextStyle::Button, egui::FontId::new(12.0, egui::FontFamily::Monospace));
+    style.text_styles.insert(egui::TextStyle::Small, egui::FontId::new(11.0, egui::FontFamily::Monospace));
+    style.text_styles.insert(egui::TextStyle::Heading, egui::FontId::new(15.0, egui::FontFamily::Monospace));
     style.visuals.window_corner_radius = egui::CornerRadius::ZERO;
     style.visuals.menu_corner_radius = egui::CornerRadius::ZERO;
     style.visuals.widgets.noninteractive.corner_radius = egui::CornerRadius::ZERO;
```

**File**: `sentrux-core/src/core/settings.rs` (modified, +4/-0)
```diff
@@ -75,6 +75,8 @@ pub struct Settings {
     // ── Font sizes ──
     /// Scale factor for zoom-proportional text (0.05 = tiny, 0.35 = large)
     pub font_scale: f32,
+    /// UI scale factor for panel/toolbar text (1.0 = default 13px body, 1.5 = large)
+    pub ui_scale: f32,
 
     // ── Viewport ──
     /// Minimum zoom level (prevents zooming out too far)
@@ -180,6 +182,7 @@ impl Default for Settings {
             blueprint_route_margin: 40.0,
 
             font_scale: 0.10,
+            ui_scale: 1.0,
 
             zoom_min: 0.05,
             zoom_max: 50.0,
@@ -232,6 +235,7 @@ impl Settings {
         self.zoom_max = self.zoom_max.max(self.zoom_min + 0.01);
         self.edge_alpha_base = self.edge_alpha_base.clamp(0.0, 1.0);
         self.edge_alpha_max = self.edge_alpha_max.clamp(self.edge_alpha_base, 1.0);
+        self.ui_scale = self.ui_scale.clamp(0.5, 3.0);
     }
 
     /// Create a HeatConfig from current settings
```

**File**: `sentrux-core/src/renderer/rects.rs` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ pub fn draw_rects(
     let connected_files: Option<HashSet<&str>> = build_connected_set(rd, ctx, kind, lod_full);
 
     // ONE global font size for ALL text. Scales with zoom.
-    let fs = (ctx.settings.font_scale * 72.0 * vp.scale as f32).clamp(4.0, 40.0);
+    let fs = (ctx.settings.font_scale * 72.0 * vp.scale as f32).clamp(8.0, 22.0);
     let cw = fs * 0.62; // monospace char width
     let px = fs * 0.25;
     let py = fs * 0.15;
```

---

### Incident Patch 9: `d0465ea2` (2026-03-17)
**Commit Message**: Replace ASCII diagram with SVG feedback loop diagram

**File**: `README.md` (modified, +3/-13)
```diff
@@ -42,19 +42,9 @@
 
 ## How it works
 
-```
-┌───────────────────────────────────────────────────────┐
-│                                                       │
-│   sentrux scans code ──→ quality score: 6772          │
-│          ↑                       ↓                    │
-│          │              "modularity is lowest"         │
-│          │                       ↓                    │
-│          │              agent improves code            │
-│          │                       ↓                    │
-│          └──── rescan ← quality score: 7891 (better)  │
-│                                                       │
-└───────────────────────────────────────────────────────┘
-```
+<div align="center">
+<img src="assets/how-it-works.svg" width="600" alt="How sentrux works: scan → score → agent improves → rescan → better score → repeat">
+</div>
 
 
 ## Quick Start
```

**File**: `assets/how-it-works.svg` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" width="600" height="420">
+  <defs>
+    <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
+      <path d="M0,0 L8,3 L0,6" fill="#00d4aa"/>
+    </marker>
+    <marker id="arrow-dim" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
+      <path d="M0,0 L8,3 L0,6" fill="#00d4aa" opacity="0.5"/>
+    </marker>
+  </defs>
+
+  <!-- Background -->
+  <rect width="600" height="420" fill="#0d1117"/>
+
+  <!-- Step 1: sentrux scans code -->
+  <rect x="160" y="20" width="280" height="40" fill="none" stroke="#00d4aa" stroke-width="1.5"/>
+  <text x="300" y="45" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="14" font-weight="700" fill="#c9d1d9">sentrux scans code</text>
+
+  <!-- Arrow 1→2 -->
+  <line x1="300" y1="60" x2="300" y2="85" stroke="#00d4aa" stroke-width="1.5" marker-end="url(#arrow)"/>
+
+  <!-- Step 2: quality score -->
+  <rect x="160" y="90" width="280" height="40" fill="none" stroke="#30363d" stroke-width="1"/>
+  <text x="220" y="115" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="13" fill="#8b949e">quality score:</text>
+  <text x="370" y="115" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="16" font-weight="700" fill="#00d4aa">6772</text>
+
+  <!-- Arrow 2→3 -->
+  <line x1="300" y1="130" x2="300" y2="155" stroke="#00d4aa" stroke-width="1.5" marker-end="url(#arrow)"/>
+
+  <!-- Step 3: bottleneck -->
+  <rect x="160" y="160" width="280" height="40" fill="none" stroke="#30363d" stroke-width="1"/>
+  <text x="230" y="185" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="13" fill="#8b949e">bottleneck:</text>
+  <text x="380" y="185" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="13" font-weight="700" fill="#f0c040">modularity</text>
+
+  <!-- Arrow 3→4 -->
+  <line x1="300" y1="200" x2="300" y2="225" stroke="#00d4aa" stroke-width="1.5" marker-end="url(#arrow)"/>
+
+  <!-- Step 4: agent improves -->
+  <rect x="160" y="230" width="280" height="40" fill="none" stroke="#30363d" stroke-width="1"/>
+  <text x="300" y="255" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="14" fill="#c9d1d9">AI agent improves the code</text>
+
+  <!-- Arrow 4→5 -->
+  <line x1="300" y1="270" x2="300" y2="295" stroke="#00d4aa" stroke-width="1.5" marker-end="url(#arrow)"/>
+
+  <!-- Step 5: improved score -->
+  <rect x="160" y="300" width="280" height="40" fill="none" stroke="#00d4aa" stroke-width="1.5" opacity="0.6"/>
+  <text x="220" y="325" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="13" fill="#8b949e">quality score:</text>
+  <text x="350" y="325" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="16" font-weight="700" fill="#00d4aa">7891</text>
+  <text x="415" y="325" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="11" fill="#3fb950">▲ better</text>
+
+  <!-- Loop arrow: from bottom, right side, back up to top -->
+  <!-- Down from step 5 -->
+  <line x1="300" y1="340" x2="300" y2="370" stroke="#00d4aa" stroke-width="1.5" opacity="0.5"/>
+  <!-- Right along bottom -->
+  <line x1="300" y1="370" x2="500" y2="370" stroke="#00d4aa" stroke-width="1.5" opacity="0.5"/>
+  <!-- Up on right side -->
+  <line x1="500" y1="370" x2="500" y2="40" stroke="#00d4aa" stroke-width="1.5" opacity="0.5"/>
+  <!-- Left back to top, with arrow -->
+  <line x1="500" y1="40" x2="445" y2="40" stroke="#00d4aa" stroke-width="1.5" opacity="0.5" marker-end="url(#arrow-dim)"/>
+
+  <!-- "rescan" label on the loop -->
+  <text x="510" y="210" text-anchor="start" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="11" fill="#00d4aa" opacity="0.6" transform="rotate(90, 510, 210)">rescan</text>
+
+  <!-- Iteration label -->
+  <text x="300" y="405" text-anchor="middle" font-family="'SF Mono','Cascadia Code','JetBrains Mono',ui-monospace,monospace" font-size="11" fill="#484f58">each iteration → recursive self-improvement</text>
+</svg>
```

---

### Incident Patch 10: `b587ab6a` (2026-03-17)
**Commit Message**: How it Works: clean box diagram with feedback loop

**File**: `README.md` (modified, +11/-13)
```diff
@@ -43,19 +43,17 @@
 ## How it works
 
 ```
-        sentrux scans code
-               ↓
-        quality score: 6772
-               ↓
-     AI agent reads the score
-               ↓
-      "modularity is lowest"
-               ↓
-    agent refactors the code
-               ↓
-        quality score: 7891  ← better
-               ↓
-           repeat ──→ each iteration improves
+┌───────────────────────────────────────────────────────┐
+│                                                       │
+│   sentrux scans code ──→ quality score: 6772          │
+│          ↑                       ↓                    │
+│          │              "modularity is lowest"         │
+│          │                       ↓                    │
+│          │              agent improves code            │
+│          │                       ↓                    │
+│          └──── rescan ← quality score: 7891 (better)  │
+│                                                       │
+└───────────────────────────────────────────────────────┘
 ```
 
 
```

---

### Incident Patch 11: `f8a82f60` (2026-03-17)
**Commit Message**: Redesign How it Works: step-by-step feedback loop with concrete scores

**File**: `README.md` (modified, +13/-3)
```diff
@@ -43,9 +43,19 @@
 ## How it works
 
 ```
-sentrux scans code → scores quality
-  → agent sees the score and improves the code
-    → score increases → repeat
+        sentrux scans code
+               ↓
+        quality score: 6772
+               ↓
+     AI agent reads the score
+               ↓
+      "modularity is lowest"
+               ↓
+    agent refactors the code
+               ↓
+        quality score: 7891  ← better
+               ↓
+           repeat ──→ each iteration improves
 ```
 
 
```

---

### Incident Patch 12: `276280dd` (2026-03-17)
**Commit Message**: Wrap feedback loop diagram to multiple lines for readability

**File**: `README.md` (modified, +3/-1)
```diff
@@ -43,7 +43,9 @@
 ## How it works
 
 ```
-sentrux scans code → scores quality → agent sees the score and improves the code → score increases → repeat
+sentrux scans code → scores quality
+  → agent sees the score and improves the code
+    → score increases → repeat
 ```
 
 
```

---

### Incident Patch 13: `59d0a204` (2026-03-17)
**Commit Message**: Simplify How it Works to one-line feedback loop

**File**: `README.md` (modified, +1/-7)
```diff
@@ -45,13 +45,7 @@
 ## How it works
 
 ```
-You code with AI  →  sentrux watches the structure  →  scores quality in real-time
-                                    ↓
-              Agent sees the score + bottleneck  →  fixes the weakest root cause
-                                    ↓
-                        Rescan  →  score improves  →  repeat
-                                    ↓
-                    Each iteration better than the last = recursive self-improvement
+sentrux scans code → scores quality → agent sees the score and improves the code → score increases → repeat
 ```
 
 
```

---

### Incident Patch 14: `83c0e6f6` (2026-03-17)
**Commit Message**: Restructure README: How it Works + Quick Start before problem statement

- Add "How it works" section with feedback loop diagram + 5 metrics table
- Move Install up, rename to Quick Start
- Fix stale MCP section (old A-F grades → quality_signal, 15 tools → 9)
- Fix rules engine output

**File**: `README.md` (modified, +90/-64)
```diff
@@ -18,7 +18,7 @@
 
 **English** | [中文](README.zh-CN.md) | [Deutsch](README.de.md) | [日本語](README.ja.md)
 
-[Install](#install) · [Quick Start](#quick-start) · [MCP Integration](#mcp-server) · [Rules Engine](#rules-engine) · [Releases](https://github.com/sentrux/sentrux/releases)
+[How it Works](#how-it-works) · [Quick Start](#quick-start) · [MCP Integration](#mcp-server) · [Rules Engine](#rules-engine) · [Releases](https://github.com/sentrux/sentrux/releases)
 
 </div>
 
@@ -42,69 +42,35 @@
 <sub><b>Quality: 6772</b> — 5 root causes: modularity 3711, acyclicity 10000, depth 6154, equality 7172, redundancy 8696</sub>
 </div>
 
-<br>
-
-## The problem nobody talks about
-
-You start a project with Claude Code or Cursor. Day one is magic. The agent writes clean code, understands your intent, ships features fast.
-
-Then something shifts.
-
-The agent starts hallucinating functions that don't exist. It puts new code in the wrong place. It introduces bugs in files it touched yesterday. You ask for a simple feature and it breaks three other things. You're spending more time fixing the agent's output than writing it yourself.
-
-Everyone assumes the AI got worse. **It didn't.** Your codebase did.
-
-Here's what actually happened: when you used an IDE, you saw the file tree. You opened files. You built a mental model of the architecture — which module does what, how they connect, where things belong. You were the governor. Every edit passed through your understanding of the whole.
-
-Then AI agents moved us to the terminal. The agent modifies dozens of files per session. You see a stream of `Modified src/foo.rs` — but you've lost the spatial awareness. You don't see where that file sits in the dependency graph. You don't see that it just created a cycle. You don't see that three modules now depend on a file that was supposed to be internal. Many developers let AI agents build entire applications without ever opening the file browser.
-
-**You've lost control. And you don't even know it yet.**
-
-Every AI session silently degrades your architecture. Same function names, different purposes, scattered across files. Unrelated code dumped in the same folder. Dependencies tangling into spaghetti. When the agent searches your project, it finds twenty conflicting matches — and picks the wrong one. Every session makes the mess worse. Every mess makes the next session harder.
-
-This is the dirty secret of AI-assisted development: **the better the AI generates code, the faster your codebase becomes ungovernable.**
-
-The traditional answer — *"plan your architecture first, then let AI implement"* — sounds right but misses the point. Tools like GitHub's [Spec Kit](https://github.com/github/spec-kit) try this approach: generate detailed specs and plans before writing code. But in practice, it [reinvents waterfall](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html) — producing seas of markdown documents while having zero visibility into the code that actually gets produced. No feedback loop. No way to detect when the implementation drifts from the spec. No structural analysis of any kind. The spec goes in, the agent writes code, and nobody checks what came out.
-
-That's not how anyone actually works with AI agents anyway. You prototype fast. You iterate through conversation. You follow inspiration. You let the creative flow drive the code. That creative flow is exactly what makes AI agents powerful. And it's exactly what destroys codebases.
-
-**You don't need a better plan. You need a better sensor.**
-
-## The solution
+## How it works
 
-**sentrux is the missing feedback loop.**
-
-Every system that works at scale has one: a sensor that observes reality, a spec that defines "good," and an actuator that corrects drift. Compilers close a feedback loop on syntax. Test suites close a loop on behavior. Linters close a loop on style.
-
-But architecture — does this change fit the system? will this abstraction cause problems as the codebase grows? — had no sensor and no actuator. Only humans could judge that. And humans can't keep up with machine-speed code generation.
-
-**sentrux closes the loop at the architecture level.**
-
-It watches your codebase in real-time — not the diffs, not the terminal output — the *actual structure*. Every file. Every dependency. Every architectural relationship. Visualized as a live interactive treemap that updates as the agent writes code.
+```
+You code with AI  →  sentrux watches the structure  →  scores quality in real-time
+                                    ↓
+              Agent sees the score + bottleneck  →  fixes the weakest root cause
+                                    ↓
+                        Rescan  →  score improves  →  repeat
+                                    ↓
+                    Each iteration better than the last = recursive self-improvement
+```
 
-5 root cause metrics. One continuous score. Computed in m
```

---

### Incident Patch 15: `064a981e` (2026-03-17)
**Commit Message**: Update tagline: sensor + feedback loop + recursive self-improvement

**File**: `README.de.md` (modified, +3/-3)
```diff
@@ -6,11 +6,11 @@
   <img alt="sentrux" src="assets/logo-dark.svg?v=2" width="220">
 </picture>
 
-<br><br>
+<br>
+
+**Der Sensor, der AI-Agents hilft, den Feedback-Loop zu schließen.<br>Rekursive Selbstverbesserung der Codequalität.**
 
-**Dein AI-Agent schreibt den Code.<br>sentrux zeigt dir die Architektur und bewertet die Qualität — live.**
 
-<br>
 
 [![CI](https://github.com/sentrux/sentrux/actions/workflows/ci.yml/badge.svg)](https://github.com/sentrux/sentrux/actions/workflows/ci.yml)
 [![Release](https://img.shields.io/github/v/release/sentrux/sentrux)](https://github.com/sentrux/sentrux/releases)
```

**File**: `README.ja.md` (modified, +3/-3)
```diff
@@ -6,11 +6,11 @@
   <img alt="sentrux" src="assets/logo-dark.svg?v=2" width="220">
 </picture>
 
-<br><br>
+<br>
+
+**AIエージェントのフィードバックループを閉じるセンサー。<br>コード品質の再帰的自己改善を実現。**
 
-**AIエージェントがコードを書く。<br>sentrux がアーキテクチャを可視化し、品質をスコアリングする — リアルタイムで。**
 
-<br>
 
 [![CI](https://github.com/sentrux/sentrux/actions/workflows/ci.yml/badge.svg)](https://github.com/sentrux/sentrux/actions/workflows/ci.yml)
 [![Release](https://img.shields.io/github/v/release/sentrux/sentrux)](https://github.com/sentrux/sentrux/releases)
```

**File**: `README.md` (modified, +2/-3)
```diff
@@ -6,11 +6,10 @@
   <img alt="sentrux" src="assets/logo-dark.svg?v=2" width="220">
 </picture>
 
-<br><br>
+<br>
 
-**Sentrux is a sensor that helps AI agents close the feedback loop, enabling recursive self-improvement of code quality.**
+**The sensor that helps AI agents close the feedback loop.<br>Recursive self-improvement of code quality.**
 
-<br>
 
 [![CI](https://github.com/sentrux/sentrux/actions/workflows/ci.yml/badge.svg)](https://github.com/sentrux/sentrux/actions/workflows/ci.yml)
 [![Release](https://img.shields.io/github/v/release/sentrux/sentrux)](https://github.com/sentrux/sentrux/releases)
```

**File**: `README.zh-CN.md` (modified, +3/-3)
```diff
@@ -6,11 +6,11 @@
   <img alt="sentrux" src="assets/logo-dark.svg?v=2" width="220">
 </picture>
 
-<br><br>
+<br>
+
+**帮助 AI Agent 闭合反馈回路的传感器。<br>实现代码质量的递归式自我改进。**
 
-**AI Agent 负责写代码。<br>sentrux 实时展示架构，评估代码质量。**
 
-<br>
 
 [![CI](https://github.com/sentrux/sentrux/actions/workflows/ci.yml/badge.svg)](https://github.com/sentrux/sentrux/actions/workflows/ci.yml)
 [![Release](https://img.shields.io/github/v/release/sentrux/sentrux)](https://github.com/sentrux/sentrux/releases)
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
