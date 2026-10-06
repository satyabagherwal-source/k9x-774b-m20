# Forensic Learning Record (Deep Inspection): kucherenko/jscpd

> **Canonical Artifact**: `07_PROJECT_LEARNING/kucherenko-jscpd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kucherenko/jscpd](https://github.com/kucherenko/jscpd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:10:47.939Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kucherenko/jscpd`
- **Description**: Copy/paste detector for source code. 220+ languages, Rust engine, SARIF/HTML/badge reporters, GitHub Action, MCP server for AI agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6335 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `fixtures/dead-code-demo/components/src/queue.ts`
```
export function describeQueue(): string[] {
  return ['inbound', 'outbound'];
}

export function clampLevel(level: number): number {
  return Math.min(Math.max(level, 0), 10);
}

```

### Core Architecture Module: `fixtures/dead-code-demo/config/src/print-queue.js`
```
const pending = [];

export function enqueue(sku, copies) {
  pending.push({ sku, copies, queuedAt: Date.now() });
  return pending.length;
}

// Written for a "flush on shutdown" hook that never shipped.
export function drainQueue() {
  const drained = pending.splice(0, pending.length);
  return drained.reduce((total, label) => total + label.copies, 0);
}

```

### Core Architecture Module: `rust/crates/cpd-core/src/deadcode.rs`
```
//! What a dead-code run reports.
//!
//! These types live beside the clone models rather than in the analyzer that
//! produces them, so the reporters can render a dead-code run without
//! depending on the engine that performed it — the same split the clone side
//! already has between `models` and `cpd-reporter`.

use crate::models::Location;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

/// A class of finding. Every category can be switched off independently
/// because they carry very different false-positive rates: unused imports are
/// nearly always safe to act on, unused class members in a dynamic codebase
/// are not.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Category {
    /// A file no entry point reaches through the import graph.
    UnusedFile,
    /// An exported name that no reachable module imports.
    UnusedExport,
    /// A module-private declaration with no references in its own module.
    UnusedSymbol,
    /// An import binding with no references.
    UnusedImport,
    /// A class member or enum member nothing appears to access.
    UnusedMember,
}

impl Category {
    pub const ALL: &'static [Category] = &[
        Category::UnusedFile,
        Category::UnusedExport,
        Category::UnusedSymbol,
        Category::UnusedImport,
        Category::UnusedMember,
    ];

    /// The default set: every category except members, whose accuracy depends
    /// most on type information basta does not have.
    pub const DEFAULT: &'static [Category] = &[
        Category::UnusedFile,
        Category::UnusedExport,
        Category::UnusedSymbol,
        Category::UnusedImport,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::UnusedFile => "unused-file",
            Self::UnusedExport => "unused-export",
            Self::UnusedSymbol => "unused-symbol",
            Self::UnusedImport => "unused-import",
            Self::UnusedMember => "unused-member",
        }
    }

    /// Heading used when grouping findings for a human reader.
    pub fn title(self) -> &'static str {
        match self {
            Self::UnusedFile => "Unused files",
            Self::UnusedExport => "Unused exports",
            Self::UnusedSymbol => "Unused symbols",
            Self::UnusedImport => "Unused imports",
            Self::UnusedMember => "Unused members",
        }
    }
}

impl FromStr for Category {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // Both spellings are accepted so `--categories unusedExports` from a
        // JSON config and `--categories unused-export` from a shell agree.
        match normalize(s).as_str() {
            "unused-file" | "unused-files" | "files" | "file" => Ok(Self::UnusedFile),
            "unused-export" | "unused-exports" | "exports" | "export" => Ok(Self::UnusedExport),
            "unused-symbol" | "unused-symbols" | "symbols" | "symbol" => Ok(Self::UnusedSymbol),
            "unused-import" | "unused-imports" | "imports" | "import" => Ok(Self::UnusedImport),
            "unused-member" | "unused-members" | "members" | "member" => Ok(Self::UnusedMember),
            other => Err(format!(
                "unknown category '{other}': expected one of unused-file, unused-export, \
                 unused-symbol, unused-import, unused-member"
            )),
        }
    }
}

/// Fold `unusedExports`, `unused_exports`, `UNUSED EXPORTS` and
/// `unused-exports` onto one spelling so config files and shells agree.
fn normalize(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    let mut prev_lower = false;
    for ch in s.trim().chars() {
        match ch {
            '_' | ' ' | '-' => {
                if !out.ends_with('-') && !out.is_empty() {
                    out.push('-');
                }
                prev_lower = false;
            }
            c if c.is_ascii_uppercase() => {
                if prev_lower {
                    out.push('-');
                }
                out.push(c.to_ascii_lowercase());
                prev_lower = false;
            }
            c => {
                out.push(c);
                prev_lower = c.is_ascii_lowercase() || c.is_ascii_digit();
            }
        }
    }
    out
}

/// What a declaration is. The kind drives both the report wording and the
/// confidence penalties: an exported type alias that nothing imports is a
/// safer deletion than a class method that nothing appears to call.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SymbolKind {
    Function,
    Class,
    Method,
    /// A field or property on a class.
    Property,
    Interface,
    TypeAlias,
    Enum,
    EnumMember,
    Variable,
    /// A name bound by an `import` / `from x import y` statement.
    Import,
    /// A `export * from` / `export { x } from` binding that re-exports
    /// another module's symbol without declaring anything.
    ReExport,
}

impl SymbolKind {
    /// Lower-case word used in report messages.
    pub fn noun(self) -> &'static str {
        match self {
            Self::Function => "function",
            Self::Class => "class",
            Self::Method => "method",
            Self::Property => "property",
            Self::Interface => "interface",
            Self::TypeAlias => "type",
            Self::Enum => "enum",
            Self::EnumMember => "enum member",
            Self::Variable => "variable",
            Self::Import => "import",
            Self::ReExport => "re-export",
        }
    }

    /// True for declarations that live inside a class body. Members are only
    /// ever reported when [`Category::UnusedMember`] is on,
    /// and they resolve against property accesses rather than bindings.
    pub fn is_member(self) -> bool {
        matches!(self, Self::Method | Self::Property | Self::EnumMember)
    }

    /// True for declarations that exist only in the type system. A type that
    /// is never imported is dead weight, but deleting one can never change
    /// runtime behavior, which the confidence model rewards.
    pub fn is_type_only(self) -> bool {
        matches!(self, Self::Interface | Self::TypeAlias)
    }
}

/// A single piece of dead code.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    /// Which rule produced this.
    #[serde(with = "category_serde")]
    pub category: Category,
    /// Scan-root-relative path of the file the finding is in.
    pub path: String,
    /// Declared name. Empty for [`Category::UnusedFile`].
    pub name: String,
    /// The name other modules would import it by, when it differs from `name`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exported_as: Option<String>,
    /// What kind of declaration this is. `None` for a whole-file finding.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol_kind: Option<SymbolKind>,
    /// Enclosing class or enum name, for members.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    /// The analyzer's language id (`js`, `python`, ...). A string rather than
    /// an enum so that a new language is a new analyzer, not a new variant in
    /// this crate.
    pub language: String,
    pub start: Location,
    pub end: Location,
    /// Lines the declaration spans — the size of the deletion.
    pub lines: u32,
    /// 0-100. See [`basta::confidence`](https://docs.rs/basta) for how it is derived.
    pub confidence: u8,
    /// Why the confidence is not 100, most significant first.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reasons: Vec<Reason>,
    /// One-line human-readable statement of the finding.
    pub message: String,
}

impl Finding {
    /// Confidence as a coarse bucket, for reporters that cannot show a number.
    pub fn level(&self) -> ConfidenceLevel {
        ConfidenceLevel::of(self.confidence)
    }

    /// Stable identity of a finding across runs: the same declaration in the
    /// same file keeps its fingerprint when unrelated lines move, because the
    /// line number is deliberately not part of it.
    pub fn fingerprint(&self) -> String {
        let parent = self.parent.as_deref().unwrap_or("");
        format!(
            "{}:{}:{}:{}",
            self.category.as_str(),
            self.path,
            parent,
            if self.name.is_empty() {
                "-"
            } else {
                &self.name
            }
        )
    }
}

/// Coarse confidence bucket.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConfidenceLevel {
    Low,
    Medium,
    High,
    Certain,
}

impl ConfidenceLevel {
    pub fn of(score: u8) -> Self {
        match score {
            90..=u8::MAX => Self::Certain,
            75..=89 => Self::High,
            50..=74 => Self::Medium,
            _ => Self::Low,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::Certain => "certain",
        }
    }
}

/// Something about the code that makes a finding less certain. Each reason
/// subtracts a fixed number of points; the reasons travel with the finding so
/// a reader can judge the score rather than trust it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Reason {
    /// The module calls `eval`, `getattr`, `globals()`, `require(expr)` or
    /// accesses properties by computed key.
    DynamicAccess,
    /// The name appears inside a string literal somewhere in the scan, so it
    /// may be looked up by name at runtime.
    NameAppearsInString,
    /// The d
```

### Core Architecture Module: `rust/crates/cpd-core/src/detect.rs`
```
// detect.rs

use rayon::prelude::*;
use rustc_hash::{FxHashMap, FxHashSet};
use std::path::{Path, PathBuf};

use crate::{
    hash::{base_pow, hash_window, roll, token_hash},
    models::{
        CloneKind, CpdClone, DetectionToken, Fragment, Location, SimilarityMethod, SourceFile,
        TokenKind, covered_lines,
    },
};

// ---------------------------------------------------------------------------
// Internal store type — replaces the Store trait + MemoryStore
// ---------------------------------------------------------------------------

/// Window store: maps a window hash to the last seen occurrence.
/// Type alias — no trait indirection, no vtable, no dyn dispatch.
type WindowStore = FxHashMap<u64, Occurrence>;

/// Lightweight reference to a window position within a format-group detection call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Occurrence {
    /// Index into the `prepared` array for this `detect_in_group` call.
    source_id: usize,
    token_start: usize,
}

// ---------------------------------------------------------------------------
// Deduplication key
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct CloneDedupKey {
    a_id: String,
    a_start_line: u32,
    b_id: String,
    b_start_line: u32,
}

impl CloneDedupKey {
    fn from_clone(c: &CpdClone) -> Self {
        // Normalize: smaller (id, line) first so (A,B) and (B,A) map to the same key.
        let a_key = (&c.fragment_a.source_id, c.fragment_a.start.line);
        let b_key = (&c.fragment_b.source_id, c.fragment_b.start.line);
        if a_key <= b_key {
            Self {
                a_id: c.fragment_a.source_id.clone(),
                a_start_line: c.fragment_a.start.line,
                b_id: c.fragment_b.source_id.clone(),
                b_start_line: c.fragment_b.start.line,
            }
        } else {
            Self {
                a_id: c.fragment_b.source_id.clone(),
                a_start_line: c.fragment_b.start.line,
                b_id: c.fragment_a.source_id.clone(),
                b_start_line: c.fragment_a.start.line,
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Public API — SourceFile path (for backward compat with tests)
// ---------------------------------------------------------------------------

/// Detect duplicate code clones across `files` using a rolling-hash sliding window.
///
/// Files are grouped by format; each format group is processed independently.
/// Rayon is used for outer parallelism (one task per format group).
pub fn detect(files: &[SourceFile], min_tokens: usize) -> Vec<CpdClone> {
    detect_with_options(files, min_tokens, 0, &PathFilters::default())
}

/// Detect clones with extended options.
///
/// - `min_lines`: reject clones whose fragment line span is shorter than this.
///   The line span is `end.line - start.line`; a clone is kept only if this value
///   is >= `min_lines`. This mirrors jscpd's `LinesLengthCloneValidator`.
/// - `filters`: path-based clone pair filters ([`PathFilters`]).
pub fn detect_with_options(
    files: &[SourceFile],
    min_tokens: usize,
    min_lines: usize,
    filters: &PathFilters,
) -> Vec<CpdClone> {
    if files.is_empty() || min_tokens == 0 {
        return vec![];
    }

    // Group files by format. Sort for deterministic order.
    let mut by_format: FxHashMap<&str, Vec<&SourceFile>> = FxHashMap::default();
    for file in files {
        by_format
            .entry(file.format.as_str())
            .or_default()
            .push(file);
    }
    let mut format_groups: Vec<(&str, Vec<&SourceFile>)> = by_format.into_iter().collect();
    format_groups.sort_unstable_by_key(|(fmt, _)| *fmt);
    for (_, group) in &mut format_groups {
        group.sort_unstable_by_key(|&file| file.id.as_str());
    }

    let mut clones: Vec<CpdClone> = format_groups
        .into_par_iter()
        .flat_map(|(_format, files)| {
            // Build per-group prepared data from SourceFile.tokens.
            // This is the backward-compat path; orchestrate.rs uses
            // detect_prepared() directly to avoid re-hashing.
            let prepared: Vec<PreparedSource> = files
                .into_iter()
                .map(|file| {
                    let mut hashes = Vec::with_capacity(file.tokens.len());
                    let mut spans: Vec<(Location, Location)> =
                        Vec::with_capacity(file.tokens.len());
                    for t in &file.tokens {
                        if t.kind == TokenKind::Ignore {
                            continue;
                        }
                        hashes.push(token_hash(t.kind.discriminant(), &t.value));
                        spans.push((t.start.clone(), t.end.clone()));
                    }
                    PreparedSource {
                        id: file.id.clone(),
                        format: file.format.clone(),
                        hashes,
                        spans,
                        raw_hashes: Vec::new(),
                        functions: Vec::new(),
                        real_path: String::new(),
                        embedded: false,
                    }
                })
                .collect();
            detect_in_group(&prepared, min_tokens, min_lines, filters)
        })
        .collect();

    finalize_clones(&mut clones);
    clones
}

fn finalize_clones(clones: &mut Vec<CpdClone>) {
    dedup_exact_clones(clones);
    clones.sort_by(|a, b| a.position_key().cmp(&b.position_key()));
}

// ---------------------------------------------------------------------------
// Direct DetectionToken path (called by orchestrate.rs)
// ---------------------------------------------------------------------------

/// A file ready for detection: pre-hashed, pre-filtered.
///
/// Produced either from `SourceFile.tokens` (backward compat) or directly from
/// `tokenize_to_detection` output (fast path used by orchestrate.rs).
#[derive(Debug, Clone)]
pub struct PreparedSource {
    pub id: String,
    pub format: String,
    pub hashes: Vec<u64>,
    pub spans: Vec<(Location, Location)>,
    /// Un-normalized token hashes, parallel to `hashes`. Empty unless a
    /// normalization option rewrote at least one token of this source; then
    /// it is used to classify clones as exact or renamed (issue #998).
    pub raw_hashes: Vec<u64>,
    /// Function signatures for similarity scoring (issue #999). Empty unless
    /// `--similarity` is set and the source's language has an extractor
    /// (JavaScript, TypeScript, Python), as a file of its own or as code
    /// embedded in Markdown or a component.
    pub functions: Vec<crate::similarity::FunctionSig>,
    /// Canonical on-disk path of the file; empty when it equals `id`. The two
    /// differ behind a symlink: `id` keeps the path the walker found the file
    /// at, which is what reports, `--ignore` and the path filters use (issue
    /// #1059). `--skip-isolated` falls back to this path so a group folder
    /// that is itself a symlink still matches the files found through it.
    pub real_path: String,
    /// True when this source is one language embedded in another — a fenced
    /// block in markdown, a `<script>` in a single-file component. Its tokens
    /// keep the host file's line numbers, so a clone's line span may run
    /// across host text that belongs to no block (issue #1090); statistics
    /// discount those lines.
    pub embedded: bool,
}

impl PreparedSource {
    /// The canonical path when it differs from `id`, otherwise `id` itself.
    pub fn filter_path(&self) -> &str {
        if self.real_path.is_empty() {
            &self.id
        } else {
            &self.real_path
        }
    }

    /// Build from a `DetectionToken` slice — the fast path.
    pub fn from_detection_tokens(id: String, format: String, tokens: &[DetectionToken]) -> Self {
        let mut hashes = Vec::with_capacity(tokens.len());
        let mut spans = Vec::with_capacity(tokens.len());
        // Only materialize raw hashes once a token proves normalization was
        // applied; the default path allocates nothing extra.
        let mut raw_hashes: Vec<u64> = Vec::new();
        for (i, t) in tokens.iter().enumerate() {
            hashes.push(t.hash);
            spans.push((t.start.clone(), t.end.clone()));
            if raw_hashes.is_empty() && t.raw_hash != t.hash {
                raw_hashes.reserve(tokens.len());
                raw_hashes.extend(hashes[..i].iter().copied());
            }
            if !raw_hashes.is_empty() {
                raw_hashes.push(t.raw_hash);
            }
        }
        Self {
            id,
            format,
            hashes,
            spans,
            raw_hashes,
            functions: Vec::new(),
            real_path: String::new(),
            embedded: false,
        }
    }
}

/// Detect clones from pre-prepared sources grouped by format.
///
/// Called by orchestrate.rs after `tokenize_to_detection` — skips re-hashing.
/// - `filters`: path-based clone pair filters ([`PathFilters`]).
pub fn detect_prepared(
    format_groups: Vec<Vec<PreparedSource>>,
    min_tokens: usize,
    min_lines: usize,
    filters: &PathFilters,
) -> Vec<CpdClone> {
    if format_groups.is_empty() || min_tokens == 0 {
        return vec![];
    }

    let mut clones: Vec<CpdClone> = format_groups
        .into_par_iter()
        .flat_map(|group| detect_in_group(&group, min_tokens, min_lines, filters))
        .collect();

    finalize_clones(&mut clones);
    clones
}

// ---------------------------------------------------------------------------
// Core detection — per format group
// ---------------------------------------------------------------------------

fn detect_in_group(
    prepared: &[PreparedSource],
    min_tokens: usize,
    min_lines: usize,
    filters: &PathFilters
```

### Core Architecture Module: `rust/crates/cpd-core/src/hash.rs`
```
// hash.rs

use xxhash_rust::xxh3::xxh3_64;

/// Fibonacci hashing constant for good bit distribution.
pub const HASH_BASE: u64 = 0x9e3779b97f4a7c15;

/// Compute a deterministic hash for a single token given its kind byte and value string.
/// Uses xxh3_64 XORed with kind cast to u64.
pub fn token_hash(kind: u8, value: &str) -> u64 {
    xxh3_64(value.as_bytes()) ^ (kind as u64)
}

/// Hash a token with optional case folding.
///
/// `ignore_case = false` is equivalent to `token_hash(kind.discriminant(), value)`.
#[inline]
pub fn hash_token(kind_discriminant: u8, value: &str, ignore_case: bool) -> u64 {
    if ignore_case {
        xxh3_64(value.to_lowercase().as_bytes()) ^ (kind_discriminant as u64)
    } else {
        xxh3_64(value.as_bytes()) ^ (kind_discriminant as u64)
    }
}

/// Hash a pair of duplicated snippets independent of fragment order, so the
/// same clone pair yields the same hash regardless of which copy the detector
/// labels as fragment A (file discovery order varies between runs).
///
/// Line endings are normalized (CR stripped) before hashing: fingerprints must
/// be identical for CRLF and LF checkouts of the same content, or committed
/// baselines break across platforms and --baseline-from-ref reports every
/// clone as new on Windows, where git's autocrlf gives the temporary base-ref
/// worktree CRLF content while the scanned tree has LF (or vice versa).
pub fn snippet_pair_hash(a: &str, b: &str) -> u64 {
    let a = strip_cr(a);
    let b = strip_cr(b);
    let (first, second) = if a <= b { (&a, &b) } else { (&b, &a) };
    let mut buf = Vec::with_capacity(first.len() + second.len() + 1);
    buf.extend_from_slice(first.as_bytes());
    buf.push(0); // separator: keeps ("ab","c") distinct from ("a","bc")
    buf.extend_from_slice(second.as_bytes());
    xxh3_64(&buf)
}

fn strip_cr(s: &str) -> std::borrow::Cow<'_, str> {
    if s.contains('\r') {
        std::borrow::Cow::Owned(s.replace('\r', ""))
    } else {
        std::borrow::Cow::Borrowed(s)
    }
}

/// Compute the initial polynomial hash of a window of token hashes.
/// hash = h[0]*BASE^(n-1) + h[1]*BASE^(n-2) + ... + h[n-1]*BASE^0
/// Uses wrapping arithmetic throughout.
pub fn hash_window(hashes: &[u64]) -> u64 {
    hashes
        .iter()
        .fold(0u64, |acc, &h| acc.wrapping_mul(HASH_BASE).wrapping_add(h))
}

/// Roll the hash one position: remove `outgoing` (the token leaving the window),
/// add `incoming` (the token entering the window).
///
/// `window_power` must be precomputed by the caller as `base_pow(window_size - 1)`
/// **once per format group** before the sliding-window loop — not on every call.
/// This eliminates an O(window_size) loop from the hot path.
///
/// If per-language min_tokens is introduced in future, recompute `window_power`
/// per `detect_in_group` invocation using that group's min_tokens value.
///
/// new_hash = (current - outgoing * window_power) * BASE + incoming
/// All arithmetic is wrapping.
pub fn roll(current: u64, outgoing: u64, incoming: u64, window_power: u64) -> u64 {
    current
        .wrapping_sub(outgoing.wrapping_mul(window_power))
        .wrapping_mul(HASH_BASE)
        .wrapping_add(incoming)
}

/// Compute HASH_BASE^n using wrapping multiplication.
/// Call once per format group to obtain the `window_power` argument for `roll()`.
pub fn base_pow(n: usize) -> u64 {
    let mut result = 1u64;
    for _ in 0..n {
        result = result.wrapping_mul(HASH_BASE);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_hash_is_deterministic() {
        let h1 = token_hash(1, "function");
        let h2 = token_hash(1, "function");
        assert_eq!(h1, h2);
    }

    #[test]
    fn token_hash_differs_by_kind() {
        let h1 = token_hash(1, "x");
        let h2 = token_hash(2, "x");
        assert_ne!(h1, h2);
    }

    #[test]
    fn snippet_pair_hash_is_order_insensitive() {
        let h1 = snippet_pair_hash("fn a() {}", "fn b() {}");
        let h2 = snippet_pair_hash("fn b() {}", "fn a() {}");
        assert_eq!(h1, h2, "swapping fragments must not change the hash");
    }

    #[test]
    fn snippet_pair_hash_is_line_ending_agnostic() {
        let lf = snippet_pair_hash("fn a() {\n}\n", "fn b() {\n}\n");
        let crlf = snippet_pair_hash("fn a() {\r\n}\r\n", "fn b() {\r\n}\r\n");
        let mixed = snippet_pair_hash("fn a() {\r\n}\r\n", "fn b() {\n}\n");
        assert_eq!(lf, crlf, "CRLF and LF content must fingerprint identically");
        assert_eq!(lf, mixed, "mixed line endings must fingerprint identically");
    }

    #[test]
    fn snippet_pair_hash_separator_prevents_boundary_collisions() {
        let h1 = snippet_pair_hash("ab", "c");
        let h2 = snippet_pair_hash("a", "bc");
        assert_ne!(h1, h2, "concatenation boundary must be unambiguous");
    }

    #[test]
    fn hash_window_single_element() {
        let h = token_hash(0, "a");
        // Window of 1: fold with initial 0 → 0 * BASE + h = h
        assert_eq!(hash_window(&[h]), h);
    }

    #[test]
    fn roll_matches_naive_recompute() {
        let a = token_hash(0, "a");
        let b = token_hash(0, "b");
        let c = token_hash(0, "c");
        let d = token_hash(0, "d");

        let initial = hash_window(&[a, b, c]);
        let wp = base_pow(3 - 1);
        let rolled = roll(initial, a, d, wp);
        let naive = hash_window(&[b, c, d]);
        assert_eq!(rolled, naive, "rolled hash must match naive recomputation");
    }

    #[test]
    fn roll_window_of_one() {
        let a = token_hash(0, "hello");
        let b = token_hash(0, "world");
        let initial = hash_window(&[a]);
        let wp = base_pow(1 - 1); // BASE^0 = 1
        let rolled = roll(initial, a, b, wp);
        let naive = hash_window(&[b]);
        assert_eq!(rolled, naive);
    }

    #[test]
    fn hash_window_empty_is_zero() {
        assert_eq!(hash_window(&[]), 0u64);
    }

    #[test]
    fn hash_token_case_insensitive_matches_different_case() {
        let h1 = hash_token(1, "Function", true);
        let h2 = hash_token(1, "function", true);
        assert_eq!(h1, h2, "ignore_case=true must fold case before hashing");
    }

    #[test]
    fn hash_token_case_sensitive_differs() {
        let h1 = hash_token(1, "Function", false);
        let h2 = hash_token(1, "function", false);
        assert_ne!(h1, h2, "ignore_case=false must not fold case");
    }

    #[test]
    fn hash_token_no_ignore_case_matches_token_hash() {
        let h1 = hash_token(2, "hello", false);
        let h2 = token_hash(2, "hello");
        assert_eq!(
            h1, h2,
            "hash_token(ignore_case=false) must match token_hash"
        );
    }
}

```

### Core Architecture Module: `rust/crates/cpd-core/src/health.rs`
```
// health.rs — one 0–100 score for a project, from how much of its code is
// duplicated, dead, or concentrated in complex files, plus whatever other
// tools (coverage, tests, security) are fed in.
//
// Every dimension is a share of code lines, so project size cancels out; size
// comes back in only to keep a small project from swinging on one finding.
// Each share becomes a 0–100 sub-score on a half-life curve, and the
// sub-scores are combined with a weighted geometric mean, which one bad
// dimension cannot hide behind the good ones.

use crate::deadcode::Stats as DeadCodeStats;
use crate::models::CpdClone;
use crate::summary::Summary;
/// Re-exported from [`crate::summary`], where the predicate moved to sit next
/// to `has_control_flow`; the old `health::is_markup` path keeps compiling.
pub use crate::summary::is_markup;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// A file is "complex" from this complexity up: about the top tenth of the
/// code files in the calibration corpus.
pub const COMPLEX_FILE: u64 = 50;

/// Lines of prior evidence mixed into each built-in dimension. One clone in a
/// 300-line project is 5%; at 2000 lines of prior it moves the share by a
/// fraction of that, and at 50K lines the prior no longer matters.
const PRIOR_LINES: f64 = 2000.0;

/// A dimension that reads less than this share of the code is left out.
const MIN_COVERAGE: f64 = 0.05;

/// What a built-in dimension looks like in a typical project — the median of
/// the calibration corpus — and the share at which its sub-score halves,
/// chosen so that the median project scores 75.
struct Calibration {
    median: f64,
    half_life: f64,
}

// Calibrated on 42 open-source projects (GitHub trending, 1.3K to 878K lines
// of code; 35 of them with JavaScript, TypeScript or Python for dead code).
const DUPLICATION: Calibration = Calibration {
    median: 3.5,
    half_life: 8.5,
};

/// Prose: half of [`crate::summary::has_control_flow`]'s denylist, split
/// out so the duplication line can name which category of "not code" a
/// project actually has, instead of a fixed disclaimer.
fn is_text(format: &str) -> bool {
    matches!(
        format,
        "markdown" | "asciidoc" | "rest" | "textile" | "wiki" | "txt" | "log" | "diff" | "gettext"
    )
}

/// Data: the other half of the same denylist.
fn is_data(format: &str) -> bool {
    matches!(
        format,
        "csv"
            | "json"
            | "json5"
            | "yaml"
            | "toml"
            | "ini"
            | "properties"
            | "editorconfig"
            | "ignore"
    )
}
const DEAD_CODE: Calibration = Calibration {
    median: 3.1,
    half_life: 7.5,
};
const COMPLEXITY: Calibration = Calibration {
    median: 20.9,
    half_life: 50.0,
};

/// Overrides for one built-in dimension (config key `health.<dimension>`).
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Tuning {
    /// The share, in percent, at which the sub-score is 50.
    pub half_life: Option<f64>,
    /// Weight in the mean; `0` leaves the dimension out.
    pub weight: Option<f64>,
}

/// Which way an external metric improves.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    /// Less is healthier: failing tests, vulnerabilities per KLOC.
    #[default]
    Lower,
    /// More is healthier: test coverage. Scored on the distance to `max`.
    Higher,
}

/// A measurement from another tool. Either a ready `score` (0–100), or a
/// `value` with the `halfLife` that turns it into one.
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExternalMetric {
    pub id: String,
    pub score: Option<f64>,
    pub value: Option<f64>,
    #[serde(default)]
    pub direction: Direction,
    /// The best possible `value` of a `higher` metric (default 100).
    pub max: Option<f64>,
    pub half_life: Option<f64>,
    pub weight: Option<f64>,
}

/// The `health` config object, also the shape of a `--health-input` file
/// (which normally carries only `metrics`).
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HealthConfig {
    #[serde(default)]
    pub duplication: Tuning,
    #[serde(default)]
    pub dead_code: Tuning,
    #[serde(default)]
    pub complexity: Tuning,
    /// Complexity from which a file counts as complex (default 50).
    pub complex_file: Option<u64>,
    #[serde(default)]
    pub metrics: Vec<ExternalMetric>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Size {
    /// Lines of code files; prose and data are not counted.
    pub lines: u64,
    pub files: u64,
    /// XS under 1K lines, S under 10K, M under 100K, L under 1M, then XL.
    pub class: &'static str,
}

/// One scored dimension.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dimension {
    pub id: String,
    /// `jscpd` for the built-in dimensions, `external` for the rest.
    pub source: &'static str,
    /// What was measured: a share of lines in percent for the built-in
    /// dimensions, the tool's own value for an external one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    /// `value` after the small-project prior was mixed in.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adjusted: Option<f64>,
    /// The lines behind `value`: duplicated, dead, or in complex files.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lines: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub half_life: Option<f64>,
    /// Percent of the code lines the dimension could analyze, when that is
    /// not all of them: dead code reads JavaScript, TypeScript, Python and
    /// compiler-checked Rust
    /// only. `weight` is already scaled by it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coverage: Option<f64>,
    /// The code formats `value` was measured over, most-lines first; only
    /// set for `duplication`, where markup and prose/data formats are left
    /// out and a reader may want to know what is left.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub formats: Vec<String>,
    /// Which category labels apply to what was left out of `value`, of
    /// `markup`, `text` and `data`; only the categories this project
    /// actually has files in are listed. Only set for `duplication`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub excluded: Vec<&'static str>,
    pub weight: f64,
    pub score: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Skipped {
    pub id: &'static str,
    pub reason: &'static str,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    /// `None` when nothing could be scored (no code and no external metric).
    pub score: Option<f64>,
    /// `A` from 85, `B` from 70, `C` from 55, `D` from 40, else `E`.
    pub grade: Option<char>,
    pub size: Size,
    pub dimensions: Vec<Dimension>,
    /// Built-in dimensions that could not be measured, and why. The score is
    /// the mean of the rest, so two scores are comparable only when they are
    /// built from the same dimensions.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub skipped: Vec<Skipped>,
}

impl HealthConfig {
    /// Lay `other` (a `--health-input` file) over `self` (the config file):
    /// its metrics are added, and any tuning it sets wins.
    pub fn merge(mut self, other: HealthConfig) -> Self {
        for (mine, theirs) in [
            (&mut self.duplication, other.duplication),
            (&mut self.dead_code, other.dead_code),
            (&mut self.complexity, other.complexity),
        ] {
            mine.half_life = theirs.half_life.or(mine.half_life);
            mine.weight = theirs.weight.or(mine.weight);
        }
        self.complex_file = other.complex_file.or(self.complex_file);
        self.metrics.extend(other.metrics);
        self
    }
}

pub fn grade(score: f64) -> char {
    match score {
        s if s >= 85.0 => 'A',
        s if s >= 70.0 => 'B',
        s if s >= 55.0 => 'C',
        s if s >= 40.0 => 'D',
        _ => 'E',
    }
}

fn size_class(lines: u64) -> &'static str {
    match lines {
        0..1_000 => "XS",
        1_000..10_000 => "S",
        10_000..100_000 => "M",
        100_000..1_000_000 => "L",
        _ => "XL",
    }
}

/// 100 at zero, 50 at one half-life, 25 at two: no cliff and no dead zone.
fn half_life_score(value: f64, half_life: f64) -> f64 {
    100.0 * 2f64.powf(-value.max(0.0) / half_life)
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

/// A generous ceiling on any one weight: comfortably above any reasonable
/// weighting scheme (typical weights are 0.1-10), and small enough that
/// summing a handful of them — as the geometric mean does — cannot overflow
/// to `f64::INFINITY` and turn the score into `inf / inf = NaN`.
const MAX_WEIGHT: f64 = 1e6;

/// Check what serde cannot: a metric must be scorable and every number sane.
pub fn validate(config: &HealthConfig) -> Result<(), String> {
    for (name, tuning) in [
        ("duplication", &config.duplication),
        ("deadCode", &config.dead_code),
        ("complexity", &config.complexity),
    ] {
        if tuning.half_life.is_some_and(|h| h.is_nan() || h <= 0.0) {
            return Err(format!("{name}.halfLife must be greater than 0"));
        }
        if tuning
            .weight
            .is_some_and(|w| !w.is_finite() || !(0.0..=MAX_WEIGHT).contains(&w))
        {
            return Err(format!("{name}.weight must be between 0 and {MAX_WEIGHT}"));
        }
    }
```

### Core Architecture Module: `rust/crates/cpd-core/src/history.rs`
```
//! Duplication trend over git history (`--history`, issue #1002).
//!
//! One [`HistoryPoint`] per scanned commit, oldest first, plus a final point
//! for the working tree. The CLI collects the points by scanning each commit
//! in a temporary worktree with the run's own configuration; this module only
//! holds the data model and the pure helpers reporters need (sparkline,
//! per-point change, threshold hint). Nothing here touches git.

use serde::{Deserialize, Serialize};

/// Identifier used for the working-tree point instead of a commit hash.
pub const WORKING_TREE: &str = "working tree";

/// Detection totals for one commit (or the working tree).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPoint {
    /// Full commit hash, or [`WORKING_TREE`] for the uncommitted state.
    pub commit: String,
    /// Abbreviated hash for display (7 characters), or `working`.
    pub short: String,
    /// Committer date as `YYYY-MM-DD`; the detection date for the working tree.
    pub date: String,
    /// First line of the commit message; empty for the working tree.
    pub subject: String,
    pub sources: u64,
    pub lines: u64,
    pub tokens: u64,
    pub clones: u64,
    pub duplicated_lines: u64,
    /// Duplicated lines as a percentage of all lines.
    pub percentage: f64,
}

impl HistoryPoint {
    pub fn is_working_tree(&self) -> bool {
        self.commit == WORKING_TREE
    }
}

/// The series a `--history` run produces.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct History {
    /// What was walked, for display: `v5.0.0..HEAD`, `since 2026-01-01`.
    pub range: String,
    /// `--threshold` in effect, if any; drives the tightening hint.
    pub threshold: Option<f64>,
    /// Oldest first; the last point is the working tree.
    pub points: Vec<HistoryPoint>,
}

/// Levels used by [`sparkline`], lowest to highest.
const BARS: [char; 8] = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/// One character per value, scaled between the series' min and max. A flat
/// series renders at mid height so it still reads as "present, unchanged".
pub fn sparkline(values: &[f64]) -> String {
    let (min, max) = values
        .iter()
        .fold((f64::INFINITY, f64::NEG_INFINITY), |(lo, hi), v| {
            (lo.min(*v), hi.max(*v))
        });
    values
        .iter()
        .map(|v| {
            if max <= min {
                BARS[3]
            } else {
                let level = ((v - min) / (max - min) * (BARS.len() - 1) as f64).round() as usize;
                BARS[level.min(BARS.len() - 1)]
            }
        })
        .collect()
}

impl History {
    /// Percentages in series order.
    pub fn percentages(&self) -> Vec<f64> {
        self.points.iter().map(|p| p.percentage).collect()
    }

    pub fn sparkline(&self) -> String {
        sparkline(&self.percentages())
    }

    /// Change in percentage points from the previous point; `None` for the
    /// first one.
    pub fn change_at(&self, index: usize) -> Option<f64> {
        if index == 0 || index >= self.points.len() {
            return None;
        }
        Some(self.points[index].percentage - self.points[index - 1].percentage)
    }

    /// Change in percentage points from the first to the last point.
    pub fn overall_change(&self) -> Option<f64> {
        match (self.points.first(), self.points.last()) {
            (Some(first), Some(last)) if self.points.len() > 1 => {
                Some(last.percentage - first.percentage)
            }
            _ => None,
        }
    }

    /// Room between the threshold and the latest value, in percentage points,
    /// when the latest value is below the threshold. This is what `--ratchet`
    /// would apply automatically; jscpd only reports it.
    pub fn threshold_headroom(&self) -> Option<f64> {
        let threshold = self.threshold?;
        let last = self.points.last()?;
        let headroom = threshold - last.percentage;
        (headroom > 0.05).then_some(headroom)
    }

    pub fn commit_count(&self) -> usize {
        self.points.iter().filter(|p| !p.is_working_tree()).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn point(short: &str, percentage: f64) -> HistoryPoint {
        HistoryPoint {
            commit: if short == "working" {
                WORKING_TREE.to_string()
            } else {
                format!("{short}0000000000000000000000000000000000")
            },
            short: short.to_string(),
            date: "2026-09-12".to_string(),
            subject: String::new(),
            sources: 10,
            lines: 1000,
            tokens: 5000,
            clones: 2,
            duplicated_lines: (percentage * 10.0) as u64,
            percentage,
        }
    }

    fn history(values: &[f64], threshold: Option<f64>) -> History {
        History {
            range: "a..b".to_string(),
            threshold,
            points: values
                .iter()
                .enumerate()
                .map(|(i, v)| point(&format!("c{i}"), *v))
                .collect(),
        }
    }

    #[test]
    fn sparkline_scales_between_min_and_max() {
        assert_eq!(sparkline(&[0.0, 50.0, 100.0]), "▁▅█");
        assert_eq!(sparkline(&[1.0, 1.0, 1.0]), "▄▄▄");
        assert_eq!(sparkline(&[]), "");
    }

    #[test]
    fn change_at_is_difference_to_previous_point() {
        let h = history(&[2.0, 3.5, 3.0], None);
        assert_eq!(h.change_at(0), None);
        assert!((h.change_at(1).unwrap() - 1.5).abs() < 1e-9);
        assert!((h.change_at(2).unwrap() + 0.5).abs() < 1e-9);
        assert_eq!(h.change_at(3), None);
    }

    #[test]
    fn overall_change_spans_first_to_last() {
        assert!((history(&[4.0, 1.0, 2.5], None).overall_change().unwrap() + 1.5).abs() < 1e-9);
        assert_eq!(history(&[4.0], None).overall_change(), None);
    }

    #[test]
    fn threshold_headroom_only_when_below_threshold() {
        assert!(
            (history(&[3.0, 2.1], Some(5.0))
                .threshold_headroom()
                .unwrap()
                - 2.9)
                .abs()
                < 1e-9
        );
        assert_eq!(history(&[3.0, 6.0], Some(5.0)).threshold_headroom(), None);
        assert_eq!(history(&[3.0, 5.0], Some(5.0)).threshold_headroom(), None);
        assert_eq!(history(&[3.0, 2.0], None).threshold_headroom(), None);
    }

    #[test]
    fn commit_count_excludes_working_tree() {
        let mut h = history(&[1.0, 2.0], None);
        h.points.push(point("working", 2.0));
        assert_eq!(h.commit_count(), 2);
        assert!(h.points[2].is_working_tree());
    }

    #[test]
    fn json_uses_camel_case() {
        let json = serde_json::to_string(&history(&[1.5], Some(3.0))).unwrap();
        assert!(json.contains("\"duplicatedLines\""));
        assert!(json.contains("\"threshold\":3.0"));
    }
}

```

### Core Architecture Module: `rust/crates/cpd-core/src/lib.rs`
```
pub mod deadcode;
pub mod detect;
pub mod hash;
pub mod health;
pub mod history;
pub mod models;
pub mod paths;
pub mod similarity;
pub mod summary;

```

### Core Architecture Module: `rust/crates/cpd-core/src/models.rs`
```
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenKind {
    Keyword,
    Identifier,
    Literal,
    Operator,
    Punctuation,
    Comment,
    BlockComment,
    Whitespace,
    Ignore,
    Other,
}

impl TokenKind {
    /// Return a stable byte discriminant for use in token hashing.
    pub fn discriminant(&self) -> u8 {
        match self {
            Self::Keyword => 1,
            Self::Identifier => 2,
            Self::Literal => 3,
            Self::Operator => 4,
            Self::Punctuation => 5,
            Self::Comment => 6,
            Self::BlockComment => 7,
            Self::Whitespace => 8,
            Self::Ignore => 9,
            Self::Other => 10,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Location {
    pub line: u32,
    pub column: u32,
    pub offset: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Token {
    pub kind: TokenKind,
    pub value: String,
    pub start: Location,
    pub end: Location,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlameEntry {
    pub commit_sha: String,
    pub author: String,
    pub timestamp: i64,
}

/// How the two fragments of a clone relate at the token level (issue #998).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloneKind {
    /// The fragments are token-for-token identical.
    #[default]
    Exact,
    /// The fragments match only after identifier, literal or annotation
    /// normalization (`--ignore-identifiers`, `--ignore-literals`,
    /// `--ignore-annotations`): a Type-2 clone.
    Renamed,
    /// A Type-3 near-miss clone: two or more matches of the same file pair
    /// merged across a gap of unmatched lines (`--max-gap-lines`), or a pair
    /// of structurally similar functions (`--similarity`). `similar` takes
    /// precedence over `renamed`: a merge of renamed halves is `similar`.
    Similar,
    /// A Type-4 clone (`--semantic`, experimental): two functions that do the
    /// same thing written differently, possibly in different languages, found
    /// by comparing embeddings of their code. `similarity` is the cosine
    /// similarity of the two embeddings.
    Semantic,
}

impl CloneKind {
    pub fn is_renamed(self) -> bool {
        matches!(self, CloneKind::Renamed)
    }

    pub fn is_similar(self) -> bool {
        matches!(self, CloneKind::Similar)
    }

    pub fn is_semantic(self) -> bool {
        matches!(self, CloneKind::Semantic)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            CloneKind::Exact => "exact",
            CloneKind::Renamed => "renamed",
            CloneKind::Similar => "similar",
            CloneKind::Semantic => "semantic",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fragment {
    pub source_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_root: Option<String>,
    pub start: Location,
    pub end: Location,
    pub range: [u32; 2],
    pub blame: Option<BlameEntry>,
}

/// How a `similar` clone was produced (issue #999).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SimilarityMethod {
    /// Exact matches merged across a gap of unmatched lines
    /// (`--max-gap-lines`); `similarity` is matched tokens over the span.
    Gap,
    /// Whole functions compared by syntax-tree structure (`--similarity`);
    /// `similarity` is the weighted Jaccard index of node-type shingles.
    Ast,
}

impl SimilarityMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            SimilarityMethod::Gap => "gap",
            SimilarityMethod::Ast => "ast",
        }
    }
}

/// One `--kind` value: a clone kind, or one of the two mechanisms that find
/// `similar` clones.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KindFilter {
    Exact,
    Renamed,
    /// Every `similar` clone, whichever mechanism found it.
    Similar,
    /// `similar` clones merged across a gap (`--max-gap-lines`).
    Gap,
    /// `similar` function pairs compared by syntax tree (`--similarity`).
    Ast,
    /// Type-4 function pairs found by comparing embeddings (`--semantic`).
    Semantic,
}

impl KindFilter {
    pub const NAMES: &'static str = "exact, renamed, similar, gap, ast, semantic";

    pub fn as_str(self) -> &'static str {
        match self {
            KindFilter::Exact => "exact",
            KindFilter::Renamed => "renamed",
            KindFilter::Similar => "similar",
            KindFilter::Gap => "gap",
            KindFilter::Ast => "ast",
            KindFilter::Semantic => "semantic",
        }
    }

    pub fn matches(self, clone: &CpdClone) -> bool {
        match self {
            KindFilter::Exact => clone.kind == CloneKind::Exact,
            KindFilter::Renamed => clone.kind == CloneKind::Renamed,
            KindFilter::Similar => clone.kind == CloneKind::Similar,
            KindFilter::Gap => clone.similarity_method == Some(SimilarityMethod::Gap),
            KindFilter::Ast => clone.similarity_method == Some(SimilarityMethod::Ast),
            KindFilter::Semantic => clone.kind == CloneKind::Semantic,
        }
    }
}

impl std::str::FromStr for KindFilter {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_ascii_lowercase().as_str() {
            "exact" => Ok(KindFilter::Exact),
            "renamed" => Ok(KindFilter::Renamed),
            "similar" => Ok(KindFilter::Similar),
            "gap" => Ok(KindFilter::Gap),
            "ast" => Ok(KindFilter::Ast),
            "semantic" => Ok(KindFilter::Semantic),
            other => Err(format!(
                "unknown clone kind '{other}': must be one of: {}",
                KindFilter::NAMES
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CpdClone {
    pub format: String,
    pub fragment_a: Fragment,
    pub fragment_b: Fragment,
    pub token_count: u32,
    /// True when the clone is absent from the configured baseline (issue #944).
    /// Always false when no baseline is in use.
    #[serde(default)]
    pub is_new: bool,
    /// `exact` when the raw tokens of both fragments are identical, `renamed`
    /// when they match only after normalization (issue #998). Always `exact`
    /// when no normalization option is on.
    #[serde(default)]
    pub kind: CloneKind,
    /// For `similar` clones: matched tokens divided by the tokens of the
    /// longer merged span, in `(0, 1)`; for `semantic` clones: the cosine
    /// similarity of the two functions' embeddings. `None` for exact and
    /// renamed clones.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub similarity: Option<f32>,
    /// Which mechanism produced a `similar` clone; the two scores are not
    /// on the same scale, so reporters show it next to the value.
    #[serde(default, rename = "method", skip_serializing_if = "Option::is_none")]
    pub similarity_method: Option<SimilarityMethod>,
    /// Lines inside each fragment's span that are not duplicated code, for
    /// `fragment_a` and `fragment_b` in that order. Two things land here: the
    /// lines a `--max-gap-lines` merge left unmatched between its halves, and,
    /// for an embedded block, the host language's lines lying between two
    /// blocks of the same fragment (issue #1090). Statistics subtract them
    /// from the fragment's span.
    #[serde(skip)]
    pub unmatched_lines: [u32; 2],
}

impl Location {
    pub fn new(line: u32, column: u32, offset: u32) -> Self {
        Self {
            line,
            column,
            offset,
        }
    }
}

impl Fragment {
    /// A fragment with no scan root and no blame data, the shape detection
    /// produces before enrichment.
    pub fn new(
        source_id: impl Into<String>,
        start: Location,
        end: Location,
        range: [u32; 2],
    ) -> Self {
        Self {
            source_id: source_id.into(),
            source_root: None,
            start,
            end,
            range,
            blame: None,
        }
    }

    pub fn with_blame(mut self, blame: BlameEntry) -> Self {
        self.blame = Some(blame);
        self
    }
}

impl CpdClone {
    /// Duplicated lines this clone adds to the statistics: the matched lines
    /// of its primary fragment.
    pub fn matched_lines(&self) -> u64 {
        self.fragment_lines(0)
    }

    /// Matched lines of one fragment — 0 is A, 1 is B. Per-file summaries need
    /// both, and they must not drift apart.
    ///
    /// The span is inclusive, so a clone of lines 10 through 19 is ten lines,
    /// the same count the reporters print next to it. Whatever the span covers
    /// but does not duplicate — gap-merge lines, host-language lines between
    /// two embedded blocks — is already in `unmatched_lines`.
    pub fn fragment_lines(&self, index: usize) -> u64 {
        let fragment = if index == 0 {
            &self.fragment_a
        } else {
            &self.fragment_b
        };
        let span = fragment.end.line.saturating_sub(fragment.start.line) + 1;
        span.saturating_sub(self.unmatched_lines[index]) as u64
    }

    /// An exact clone with no baseline, similarity or gap metadata.
    pub fn exact(
        format: impl Into<String>,
        fragment_a: Fragment,
        fragment_b: Fragment,
        token_count: u32,
    ) -> Self {
        Self {
            format: format.into(),
            fragment_a,
            fragment_b,
            token_count,
            is_new: false,
            kind: CloneKind::default(),
            similarity: None,
            similarity_method
```

### Core Architecture Module: `rust/crates/cpd-core/src/paths.rs`
```
// paths.rs — shared source-id path helpers.
//
// Source ids may carry a `:format` suffix (multi-format files, e.g.
// `README.md:javascript`) and, since scan-root relativization, fragments may
// store their scan root separately in `Fragment.source_root`. These helpers
// are the single source of truth for turning a fragment back into a real
// filesystem path; cpd-finder (blame) and cpd-reporter both rely on them.

use crate::models::Fragment;

/// Strip a `:format` suffix from a source id so it can be used as a real path.
///
/// Format-qualified IDs look like `README.md:javascript`. A bare colon inside
/// a Windows drive letter (`C:\…`) or after a path separator is NOT a format
/// suffix — only a colon preceded by a non-separator, non-colon char with a
/// valid format name after it qualifies.
pub fn clean_source_id(source_id: &str) -> &str {
    match source_id.rfind(':') {
        Some(pos) if pos > 0 => {
            let bytes = source_id.as_bytes();
            let before = bytes[pos - 1];
            // A colon right after a single drive letter (e.g. `C:`) or after
            // a path separator (`/`, `\`) is structural, not a format suffix.
            if pos == 1 && before.is_ascii_alphabetic() {
                return source_id;
            }
            if before == b'/' || before == b'\\' {
                return source_id;
            }
            // A colon followed by a path separator is a drive-letter colon in
            // a non-prefix position — Windows verbatim paths (`\\?\C:\...`)
            // put it at position 5. Format suffixes are names like
            // `:javascript`, never followed by a separator.
            if matches!(bytes.get(pos + 1), Some(b'/') | Some(b'\\')) {
                return source_id;
            }
            &source_id[..pos]
        }
        _ => source_id,
    }
}

/// Resolve a fragment's filesystem path by joining `source_root` (if set) with
/// the cleaned `source_id`. Falls back to the bare `source_id` when no root is
/// stored (absolute paths, `--absolute` mode, or legacy data).
pub fn resolve_fragment_path(fragment: &Fragment) -> String {
    let clean = clean_source_id(&fragment.source_id);
    match &fragment.source_root {
        Some(root) => {
            let joined = std::path::Path::new(root).join(clean);
            joined.to_string_lossy().into_owned()
        }
        None => clean.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Location;

    fn frag(source_id: &str, source_root: Option<&str>) -> Fragment {
        let loc = Location {
            line: 1,
            column: 0,
            offset: 0,
        };
        Fragment {
            source_id: source_id.to_string(),
            source_root: source_root.map(str::to_string),
            start: loc.clone(),
            end: loc,
            range: [0, 0],
            blame: None,
        }
    }

    #[test]
    fn clean_source_id_strips_format_suffix() {
        assert_eq!(clean_source_id("README.md:javascript"), "README.md");
    }

    #[test]
    fn clean_source_id_preserves_bare_path() {
        assert_eq!(clean_source_id("src/a.js"), "src/a.js");
    }

    #[test]
    fn clean_source_id_preserves_windows_drive() {
        assert_eq!(clean_source_id(r"C:\scan\a.rs"), r"C:\scan\a.rs");
    }

    #[test]
    fn clean_source_id_strips_format_from_windows_path() {
        assert_eq!(clean_source_id(r"C:\scan\a.md:javascript"), r"C:\scan\a.md");
    }

    #[test]
    fn clean_source_id_preserves_windows_verbatim_path() {
        // std::fs::canonicalize on Windows returns verbatim paths whose drive
        // colon sits at position 5; it must not be mistaken for a format
        // suffix (which truncated the id to `\\?\C` and broke every snippet
        // read behind --baseline-from-ref).
        assert_eq!(clean_source_id(r"\\?\C:\scan\a.rs"), r"\\?\C:\scan\a.rs");
    }

    #[test]
    fn clean_source_id_strips_format_from_windows_verbatim_path() {
        assert_eq!(
            clean_source_id(r"\\?\C:\scan\a.md:javascript"),
            r"\\?\C:\scan\a.md"
        );
    }

    #[test]
    fn resolve_fragment_path_joins_root() {
        // Build the expectation via Path::join too: on Windows the joined
        // separator is a backslash, so a hardcoded "/project/src/a.js" fails.
        let expected = std::path::Path::new("/project")
            .join("src/a.js")
            .to_string_lossy()
            .into_owned();
        assert_eq!(
            resolve_fragment_path(&frag("src/a.js", Some("/project"))),
            expected
        );
    }

    #[test]
    fn resolve_fragment_path_falls_back_to_source_id() {
        assert_eq!(
            resolve_fragment_path(&frag("/absolute/path/a.js", None)),
            "/absolute/path/a.js"
        );
    }

    #[test]
    fn resolve_fragment_path_cleans_format_suffix() {
        let expected = std::path::Path::new("/repo")
            .join("doc.md")
            .to_string_lossy()
            .into_owned();
        assert_eq!(
            resolve_fragment_path(&frag("doc.md:javascript", Some("/repo"))),
            expected
        );
    }
}

```

### Core Architecture Module: `rust/crates/cpd-core/src/similarity.rs`
```
//! Function-level similarity (issue #999, stage 2).
//!
//! Each function is summarized by the bag of `k`-grams over the pre-order
//! sequence of its AST node types ("shingles"). Two functions are similar
//! when the weighted Jaccard index of their shingle bags reaches the
//! configured threshold. Candidate pairs come from MinHash + LSH banding so
//! the search stays close to linear in the number of functions; the exact
//! bag Jaccard is only computed for candidates.
//!
//! Node *types* only by default: identifier names and literal values do not
//! take part, so a renamed copy scores 1.0 and an edited copy scores by how
//! much of its structure survived. Positions always reference the original
//! source.
//!
//! The role-aware mode ([`SimilarityIdentifiers::RoleAware`], issue #1136)
//! adds the names whose role changes what the code does: each method a call
//! invokes joins the sequence right after the call's node, so `store.load(x)`
//! and `store.save(x)` no longer look the same, while variables, parameters
//! and receivers stay anonymous. Extractors record those names as
//! [`RoleName`]s whatever the mode; the mode decides whether a signature
//! uses them.
//!
//! The scoring is grammar-agnostic: node-type ids are opaque `u16`s from
//! whichever extractor produced them (`cpd_tokenizer::functions`), and a
//! signature records its `grammar` so functions are only compared within
//! one grammar. Adding a language means adding an extractor, not touching
//! this module.

use crate::detect::{PathFilters, PreparedSource};
use crate::models::{CloneKind, CpdClone, Fragment, Location, SimilarityMethod};
use rustc_hash::{FxHashMap, FxHashSet};

/// Which identifier names take part in a function's structural summary
/// (`--similarity-identifiers`).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum SimilarityIdentifiers {
    /// No names: the summary holds node types only, so a renamed copy
    /// scores like the original.
    #[default]
    Ignore,
    /// Names by their role in the code: the method a call invokes counts;
    /// variables, parameters, receivers and every other name do not.
    RoleAware,
}

impl SimilarityIdentifiers {
    /// The names of a function this mode keeps out of the ones its
    /// extractor recorded: all of them in role-aware mode, none otherwise.
    pub fn names(self, names: &[RoleName]) -> &[RoleName] {
        match self {
            Self::Ignore => &[],
            Self::RoleAware => names,
        }
    }

    /// The value as `--similarity-identifiers` takes it.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ignore => "ignore",
            Self::RoleAware => "role-aware",
        }
    }
}

impl std::str::FromStr for SimilarityIdentifiers {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "ignore" => Ok(Self::Ignore),
            "role-aware" => Ok(Self::RoleAware),
            other => Err(format!(
                "unknown value '{other}', expected ignore or role-aware"
            )),
        }
    }
}

/// A name role-aware similarity keeps: the method a call invokes, placed
/// in the function's node-type sequence right after the node at index
/// `after`, the call itself.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RoleName {
    pub after: u32,
    /// [`name_hash`] of the name.
    pub hash: u64,
}

impl RoleName {
    pub fn new(after: usize, name: &str) -> Self {
        Self {
            after: after as u32,
            hash: name_hash(name),
        }
    }
}

/// The sequence symbol of a kept name: FNV-1a over its bytes with the top
/// bit set, so that no name can equal a node type id, which fits in 16 bits.
pub fn name_hash(name: &str) -> u64 {
    let hash = name.bytes().fold(FNV_OFFSET, |acc, byte| {
        (acc ^ u64::from(byte)).wrapping_mul(FNV_PRIME)
    });
    hash | (1 << 63)
}

const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

/// The size of a function's code when its span also holds text that is not
/// code, as a Python docstring and comments do: the tokens and the line span
/// that `--min-tokens` and `--min-lines` read. JavaScript has no such text
/// to leave out: its comments yield no tokens, and a JSDoc block sits before
/// the function.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CodeSize {
    pub tokens: u32,
    pub lines: u32,
}

/// Shingle length over the node-type sequence.
pub const SHINGLE_K: usize = 4;
/// MinHash signature size; `BANDS * ROWS` must equal it.
pub const MINHASH_SIZE: usize = 64;
const BANDS: usize = 16;
const ROWS: usize = 4;
const _: () = assert!(BANDS * ROWS == MINHASH_SIZE);
/// Buckets larger than this are truncated before pairing: a bucket that
/// size means hundreds of structurally identical functions, and the first
/// members already carry the signal.
const MAX_BUCKET: usize = 256;

/// Structural summary of one function, method or arrow function.
#[derive(Debug, Clone, PartialEq)]
pub struct FunctionSig {
    /// Grammar that produced the node-type sequence; pairs are only formed
    /// within one grammar.
    pub grammar: &'static str,
    /// Declared or inferred name (`<arrow>` / `<anonymous>` when none).
    pub name: String,
    pub start: Location,
    pub end: Location,
    /// Inclusive detection-token index range inside the owning source.
    pub range: [u32; 2],
    /// Detection tokens covered by the function, or its code tokens when
    /// [`Self::with_code_size`] gave them.
    pub token_count: u32,
    /// The line span `--min-lines` reads: [`Self::line_span`], less the
    /// lines that hold no code when [`Self::with_code_size`] said which.
    pub code_lines: u32,
    /// Sorted bag of shingle hashes.
    pub shingles: Vec<u64>,
    pub minhash: [u64; MINHASH_SIZE],
}

impl FunctionSig {
    /// Build a signature from a node-type sequence and the owning source's
    /// token spans. Returns `None` when no detection token lies inside the
    /// function's byte range (comment-only or type-only bodies).
    pub fn build(
        grammar: &'static str,
        name: String,
        start: Location,
        end: Location,
        kinds: &[u16],
        spans: &[(Location, Location)],
    ) -> Option<Self> {
        Self::build_with_names(grammar, name, start, end, kinds, &[], spans)
    }

    /// [`Self::build`] with the names role-aware similarity keeps: each one
    /// joins the node-type sequence after its node, so the shingles around a
    /// call see which method it invokes. Without names the signature is the
    /// one [`Self::build`] makes.
    pub fn build_with_names(
        grammar: &'static str,
        name: String,
        start: Location,
        end: Location,
        kinds: &[u16],
        names: &[RoleName],
        spans: &[(Location, Location)],
    ) -> Option<Self> {
        let (first, last) = token_range(spans, &start, &end)?;
        let shingles = match names.is_empty() {
            true => shingles_from_kinds(kinds, SHINGLE_K),
            false => shingles_from_symbols(&with_names(kinds, names), SHINGLE_K),
        };
        if shingles.is_empty() {
            return None;
        }
        let minhash = minhash(&shingles);
        let code_lines = end.line.saturating_sub(start.line);
        Some(Self {
            grammar,
            name,
            start,
            end,
            range: [first as u32, (last - 1) as u32],
            token_count: (last - first) as u32,
            code_lines,
            shingles,
            minhash,
        })
    }

    /// Read the size limits on the function's code alone when its span also
    /// holds text that is not code: a Python docstring would otherwise carry
    /// a one-line getter past `--min-tokens` and `--min-lines`.
    pub fn with_code_size(mut self, size: Option<CodeSize>) -> Self {
        if let Some(size) = size {
            self.token_count = self.token_count.min(size.tokens);
            self.code_lines = self.code_lines.min(size.lines);
        }
        self
    }

    /// Lines spanned, in jscpd's `end - start` convention.
    pub fn line_span(&self) -> u32 {
        self.end.line.saturating_sub(self.start.line)
    }
}

/// The detection tokens lying inside the byte range `start..end` of a
/// source, as a half-open index range into its `spans`; `None` when there
/// are none (a body of comments or type declarations only).
pub fn token_range(
    spans: &[(Location, Location)],
    start: &Location,
    end: &Location,
) -> Option<(usize, usize)> {
    let first = spans.partition_point(|(s, _)| s.offset < start.offset);
    let last = spans.partition_point(|(_, e)| e.offset <= end.offset);
    (first < last).then_some((first, last))
}

/// Hash every `k`-gram of `kinds`; the result is sorted so it can be used as
/// a multiset by [`bag_jaccard`].
pub fn shingles_from_kinds(kinds: &[u16], k: usize) -> Vec<u64> {
    shingles(kinds, k)
}

/// [`shingles_from_kinds`] over a sequence of node types and name symbols
/// ([`name_hash`]). A sequence of node types alone hashes to the same
/// shingles either way.
pub fn shingles_from_symbols(symbols: &[u64], k: usize) -> Vec<u64> {
    shingles(symbols, k)
}

fn shingles<T: Copy + Into<u64>>(sequence: &[T], k: usize) -> Vec<u64> {
    if sequence.len() < k {
        return Vec::new();
    }
    let mut out: Vec<u64> = sequence
        .windows(k)
        .map(|w| {
            w.iter().fold(FNV_OFFSET, |acc, &t| {
                (acc ^ t.into()).wrapping_mul(FNV_PRIME)
            })
        })
        .collect();
    out.sort_unstable();
    out
}

/// The node types of a function with its kept names in place: each name
/// right after the node at its `after` index.
fn with_names(kinds: &[u16], names: &[RoleName]) -> Vec<u64> {
    // Extractors record names in the order they walk, which is sorted.
    let sorted;
    let names = match names.wind
```

### Core Architecture Module: `rust/crates/cpd-core/src/summary.rs`
```
// summary.rs — opt-in codebase summary: per-file metrics, folder rollup, top-N lists.
//
// Everything in this module runs only when `--summary` is enabled, after
// detection has finished, over data already held in memory (SourceFile tokens
// and detected clones). Nothing in the detection hot path calls into it.

use crate::models::{CpdClone, SourceFile, Token, TokenKind};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Metric used to rank files and folders in the summary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SummaryMetric {
    #[default]
    Tokens,
    Lines,
    Size,
    Complexity,
}

impl std::str::FromStr for SummaryMetric {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "tokens" => Ok(Self::Tokens),
            "lines" => Ok(Self::Lines),
            "size" => Ok(Self::Size),
            "complexity" => Ok(Self::Complexity),
            other => Err(format!(
                "invalid summary metric '{other}': must be one of: tokens, lines, size, complexity"
            )),
        }
    }
}

impl std::fmt::Display for SummaryMetric {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::Tokens => "tokens",
            Self::Lines => "lines",
            Self::Size => "size",
            Self::Complexity => "complexity",
        };
        f.write_str(s)
    }
}

/// Per-file summary row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSummary {
    pub path: String,
    pub format: String,
    pub lines: u64,
    pub tokens: u64,
    pub bytes: u64,
    pub duplicated_lines: u64,
    pub duplicated_tokens: u64,
    /// Cyclomatic-complexity estimate: 1 + count of decision-point tokens
    /// (`if`, `for`, `while`, `case`, `catch`, `&&`, `||`, `?`, …).
    pub complexity: u64,
}

/// Per-folder rollup. Files are counted in their direct parent directory only
/// (no cumulative ancestor totals), so every file contributes to exactly one
/// folder row and rows are directly comparable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSummary {
    pub path: String,
    pub files: u64,
    pub lines: u64,
    pub tokens: u64,
    pub bytes: u64,
    pub duplicated_lines: u64,
    /// Sum of per-file complexity estimates (divide by `files` for the mean).
    pub complexity: u64,
}

/// Codebase summary: top files and folder rollup.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    /// Primary sort metric.
    pub by: SummaryMetric,
    /// Top-N files by `by`, descending. Every row carries all metrics
    /// (tokens, lines, bytes, complexity, duplication) so one list serves
    /// every lens; re-run with a different `--summary-by` to re-rank.
    pub files: Vec<FileSummary>,
    /// Top-N folders by `by`, direct-parent aggregation.
    pub folders: Vec<FolderSummary>,
    /// Total number of files analyzed (before top-N truncation).
    pub total_files: u64,
    /// Total number of folders (before top-N truncation).
    pub total_folders: u64,
}

/// Decision-point tokens counted by the complexity estimate. Conservative,
/// language-agnostic list: branch/loop keywords and short-circuit operators
/// that appear as standalone tokens across supported languages.
///
/// Matching is ASCII-case-insensitive so case-insensitive and
/// uppercase-keyword languages (SQL, PL/SQL, Fortran, COBOL, BASIC, Pascal)
/// count too. The occasional identifier spelled like a keyword slightly
/// inflates an estimate that is only used for ranking.
///
/// Operators reach this function already joined — see [`joined_token`]. Only
/// the JavaScript tokenizer emits `&&` as one token; the generic one splits
/// every punctuation run into single characters, so without that joining the
/// short-circuit arms here would be unreachable for every other format.
fn is_decision_token(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.is_empty() || bytes.len() > 7 {
        return false;
    }
    let mut lower = [0u8; 7];
    for (dst, b) in lower.iter_mut().zip(bytes) {
        *dst = b.to_ascii_lowercase();
    }
    matches!(
        &lower[..bytes.len()],
        b"if"
            | b"elif"
            | b"elsif"
            | b"elseif"
            | b"unless"
            | b"for"
            | b"foreach"
            | b"while"
            | b"until"
            | b"case"
            | b"cond"
            | b"when"
            | b"catch"
            | b"rescue"
            | b"except"
            | b"andalso"
            | b"orelse"
            | b"&&"
            | b"||"
            | b"and"
            | b"or"
            | b"?"
            | b"??"
    )
}

/// What a bare `?` means in a language.
#[derive(Clone, Copy, PartialEq, Eq)]
enum QuestionMark {
    /// It only ever opens a ternary: C, Java, PHP, Go templates, and most else.
    Ternary,
    /// It also marks an optional, so `String?` and `x?.y` are types and
    /// accesses rather than branches. Neither TypeScript nor Swift has an
    /// Elvis operator, so `?:` there is an optional property, not a branch.
    Optional,
    /// As above, but `?:` *is* the Elvis operator and does branch: Kotlin,
    /// Groovy.
    OptionalWithElvis,
}

/// How one language spells its branches, beyond the shared keyword set.
///
/// The shared set is right for most of the formats jscpd knows. An entry here
/// exists only where a language branches on something the set has no word for
/// (`match` arms in Rust, `guard` in Swift, `select` in Go) or spells
/// something in the set so differently that counting it is simply wrong.
#[derive(Clone, Copy)]
struct DecisionRules {
    /// Branch tokens beyond the shared set, matched after joining.
    extra: &'static [&'static str],
    question: QuestionMark,
    /// Tokens that open a function body. Cyclomatic complexity is one path per
    /// function; where a language has no single reliable marker this stays
    /// empty and the estimate keeps its per-file baseline of one.
    declarations: &'static [&'static str],
    /// The C family declares a function as `head(args) {` with no keyword at
    /// all, so its functions are counted from that shape instead.
    braced_declarations: bool,
    /// Whether `"""` and `'''` delimit a string that can span lines; see
    /// [`has_triple_quoted_strings`].
    triple_quoted_strings: bool,
    /// Tokens that open a group of arms counted one by one through `extra`.
    /// Each cancels one arm, because N arms are N paths and so N - 1 branches,
    /// the same way a `switch` counts its `case` labels but not its `default`.
    arm_groups: &'static [&'static str],
}

impl Default for DecisionRules {
    fn default() -> Self {
        Self {
            extra: &[],
            question: QuestionMark::Ternary,
            declarations: &[],
            braced_declarations: false,
            triple_quoted_strings: false,
            arm_groups: &[],
        }
    }
}

/// Formats whose strings can span lines between `"""` or `'''` delimiters.
///
/// Where a doubled quote is how a quote is escaped — C# verbatim strings,
/// VB.NET, SQL, Pascal — three quotes in a row are ordinary string content: the
/// regex `@"""((?:\\.|[^""\\])*)"""` is one line of C#. Reading such a run as
/// a delimiter opens a string that never closes and swallows the rest of the
/// file, which is why this is a list rather than a default.
fn has_triple_quoted_strings(format: &str) -> bool {
    matches!(
        format,
        "python" | "kotlin" | "scala" | "groovy" | "swift" | "java" | "julia" | "elixir" | "dart"
    )
}

/// False for prose and data formats, whose "if" and `||` are words and
/// version ranges rather than branches. One half of [`is_code`]: a format
/// that can never have a branch can never have complexity above zero.
pub fn has_control_flow(format: &str) -> bool {
    !matches!(
        format,
        "markdown"
            | "asciidoc"
            | "rest"
            | "textile"
            | "wiki"
            | "txt"
            | "log"
            | "csv"
            | "json"
            | "json5"
            | "yaml"
            | "toml"
            | "ini"
            | "properties"
            | "editorconfig"
            | "ignore"
            | "diff"
            | "gettext"
    )
}

/// Markup, stylesheets, declarative schemas and the templating languages
/// built on top of markup: a duplicated template or style rule repeating is
/// not the maintenance problem duplicated programming logic is, so it does
/// not count toward the health score's duplication share at all — the same
/// treatment prose and data files get, just decided per clone rather than
/// per file, since a `.svelte` or `.vue` file's markup and style blocks are
/// tokenized separately from its script block. The other half of
/// [`is_code`]: whole files in these formats have no complexity either — the
/// "if" in an HTML attribute and the "and" in a media query are words, not
/// branches.
///
/// These are the tokenizer's own format *names*
/// (`cpd-tokenizer/src/formats.rs`), not file extensions: html/htm/xml/svg
/// all tokenize as `markup` (`html` is the name a component file's markup
/// block and a Markdown html snippet carry), `.puml`/`.plantuml` as
/// `plant-uml`, `.tpl` as `smarty`, `.jade` as `pug`, and `.vtl` as
/// `velocity` — matching on the extension instead of the name a clone's
/// `format` field actually carries would silently never exclude anything.
pub fn is_markup(format: &str) -> bool {
    matches!(
        format,
        "markup"
            | "html"
            | "css"
            | "scss"
            | "sass"
            | "less"
            | "
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1090** (2026-09-23): **Prose between embedded code blocks is counted as duplicated lines**
  *Symptoms*: ### Engine, version, install method, OS  v5 (Rust engine), built from master at 416b9702 (`rust/target/release/cpd`). macOS arm64 (Darwin 25.6). Also visible in 5.3.1 from npm.  ### Command and configuration  ```shell cpd . ```  No `.jscpd.json`, no flags.  ### What happens  Markdown, Vue, Svelte and Astro files are scanned as multi-format: every embedded code block becomes a synthetic source carrying the sub-language's format. That part works. What goes wrong is that the synthetic source keeps the parent file's line numbers, and two pieces of the statistics read those numbers as if the token stream were contiguous. It is not — there is prose between the blocks, and that prose ends up counted as duplicated code.  Take two markdown files, each with five identical 12-line `ts` blocks with 200 lines of text between them. That is 60 lines of TypeScript per file, 120 altogether:  ``` Clone found (typescript)  - one.md:typescript [202:1 - 1069:40] (868 lines, 720 tokens)    two.md:typescript [202:1 - 1069:40]  │ Format     │ Files analyzed │ Total lines │ Total tokens │ Clones found │ Duplicated lines │ │ typescript │ 2              │ 2138        │ 1440         │ 2            │ 1520 (71.09%)    │ ```  868 lines holding 720 tokens. Roughly 60 of those lines are code and the other 800 are the text between the blocks. The token counts, by contrast, are right: 1440 tokens is what 120 lines of that code really is. Only the line columns are wrong.  Two separate places produce this:  1. `

- **Issue #1082** (2026-09-19): **dead-code: WXT extensions read as ~28% dead — entrypoints/ not recognized as entry points**
  *Symptoms*: ## Problem  basta's entry-point detection doesn't know the [WXT](https://wxt.dev) browser-extension framework, so on a WXT project the entry files themselves (`entrypoints/background.ts`, `entrypoints/content.ts`, `entrypoints/popup/…`) are reported as unused files — and since dead code cascades through the reachability walk, everything only they import goes down with them.  Real-world case: [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) at `fa953dc`, as shown on [jscpd.dev/trending/Tencent/BrowserSkill](https://jscpd.dev/trending/Tencent/BrowserSkill):  - `jscpd --dead-code` reports **27.91% unused, 318 findings, 115 unused files** - 312 of the 318 findings (~27.8k of ~29.7k dead lines) sit under `apps/extension/src` — a WXT extension (`wxt.config.ts`, `"build": "wxt build"`, `srcDir: "src"`) - `background.ts` imports the whole `tools/`, `lib/`, `browser-driver/`, `content/` tree via `@/` aliases; none of it is dead - Cross-check: fallow (which resolves WXT) reports **11** unused files instead of 115, none of them in the extension; knip without WXT handling flags the entrypoints too but doesn't cascade  So roughly 98% of the reported dead code on such a project is one missing framework convention.  ## Expected  Treat WXT entrypoints as entry points, the way basta already reads Nuxt/Nitro directory conventions and SvelteKit's `$lib`:  - Detect WXT via `wxt.config.{ts,js,mjs}` (or the `wxt` dependency/scripts in `package.json`) - Read `srcDir` (default: projec

- **Issue #1059** (2026-09-15): **--follow-symlinks: symlinked files are reported by their real path and counted twice**
  *Symptoms*: ### Engine, version, install method, OS  v5 (Rust engine). `jscpd --version` prints `jscpd 5.2.0`. Reproduced with the npm launcher (`npx -p jscpd@5.2.0 jscpd`) on macOS arm64 (Darwin 25.6) and with the `jscpd-linux-arm64-gnu` binary from the 5.2.0 tarball on Debian 13 arm64. Not tried on Windows.  ### Command and configuration  ```shell jscpd --silent --reporters json --output .r --min-tokens 20 --follow-symlinks . ```  No `.jscpd.json`, no `jscpd` key in package.json.  ### What happens  When the walk reaches a file through a symlink, the report names that file by its resolved real path, not by the path it was found at.  Layout (script at the bottom): `root/candidate/app.js`, a directory symlink `root/corpus -> ../outside` where `outside/S1/app.js` is a copy of the same file, and a file symlink `root/linked.js -> candidate/app.js`. Scanning `.` from `root` with `--follow-symlinks` prints:  ``` Clone found (javascript)  - /lab/outside/S1/app.js [1:1 - 8:24] (8 lines, 56 tokens)    candidate/app.js [1:1 - 8:24] ```  Three things are off here:  1. One fragment is an absolute path outside the scan root, the other one is relative. The name the walker actually used, `corpus/S1/app.js`, appears nowhere in the report. `--absolute` was not passed. 2. `--ignore` and the report disagree about what the path of this file is. `--ignore 'corpus/**'` does exclude it, because the glob is matched against the walked path. `--ignore '**/outside/**'` does nothing, although `outside` is the only 
  **Post-Mortem & Fix Analysis**:
  > Released in [v5.2.1](https://github.com/kucherenko/jscpd/releases/tag/v5.2.1).  A file reached through a symlink keeps the path it was found at, `--ignore` matches that same path, and a file reachable through several paths is scanned once. The v5 default (links skipped unless `--follow-symlinks`, where v4 followed them unless `--noSymlinks`) is now in the README and the migration table. Demo under `fixtures/follow-symlinks-demo/`.  One deliberate detail: `--skip-local folder1 folder2` treats a file found through a link inside `folder1` as part of `folder1`, matching v4, so only cross-folder clones survive.

- **Issue #1047** (2026-09-11): **Exit code is 0 for unknown --format, nonexistent paths and failed reporters**
  *Symptoms*: ## Summary  jscpd 5.2.0 exits with code 0 in three situations where the scan did not actually happen or the report was not written. A CI job that only checks the exit code sees a green run and an empty (or missing) report.  Reported by the [GitTested review](https://gittested.com/reviews/jscpd/) (tested on `56b65069`, v5.0.16 line); reproduced on 5.2.0.  ## Reproduction  ```bash # 1. Unknown format: empty report, exit 0 jscpd --format nosuchlang --reporters json --output out1 . echo $?   # 0, out1/jscpd-report.json exists with 0 sources  # 2. Nonexistent scan path: empty report, exit 0 jscpd /definitely/not/here --reporters json --output out2 echo $?   # 0, out2/jscpd-report.json exists with 0 sources  # 3. Unwritable output directory: error printed, exit 0 jscpd --reporters json --output /nonexistent-root/out . # Reporter 'json' error: I/O error in reporter: Read-only file system (os error 30) echo $?   # 0 ```  ## Expected  - `--format` with a name that is not in `jscpd --list` (and not added via `--formats-exts` / `--formats-names`) is a usage error: exit non-zero with a message naming the unknown format. - A scan path that does not exist is an error: exit non-zero. Same when none of the given paths exist. - A reporter that fails to write its output makes the run exit non-zero. The other reporters may still run, but the final code must reflect the failure.  Open question: should "no files matched" (paths exist, but nothing to analyze after `--ignore` / `--pattern` / `--for

- **Issue #1033** (2026-09-08): **Detector: an open clone is extended by any matching stored window, not by its own anchor, so pairs are silently lost on N-way copies**
  *Symptoms*: ## Summary  In `detect_in_group` (`rust/crates/cpd-core/src/detect.rs`) an open clone is enlarged whenever the next window matches *any* occurrence in the window store, without checking that the clone's own anchor (`stored_occurrence`) continues. When the match is picked up by a window stored from a different file, the anchored fragment is stretched past what the anchor file actually contains. If the anchor file ends there, `make_fragment` returns `None` and the whole clone is dropped silently. If the anchor file has more tokens, the reported pair can be longer than the real common region.  ## Repro (5.2.0)  Three JavaScript files, default thresholds:  - `f1.js`: a 10-line function `normalizeAddress` (152 tokens) - `f5.js`: the same function twice, under the names `normalizeA` and `normalizeB` - `f6.js`: `normalizeAddress` followed by a second, unrelated function  | Scanned set | f1 ↔ f6 pair | |---|---| | `f1 f6` | `f1.js:2-11 <-> f6.js:2-11 (152 tokens)` | | `f1 f5 f6` | **missing**; only `f5.js:8-13 <-> f6.js:8-12 (51 tokens)` from the secondary pass | | `f1 f5 f6`, with a trailing function appended to `f1` | `f1.js:2-13 <-> f6.js:2-12 (154 tokens)`: back, two tokens longer |  What happens in `f1 f5 f6`: while scanning `f5`, the windows around `} export function normalizeB` do not match `f1` and are inserted into the store. While scanning `f6`, the clone anchored on `f1` extends through the body; at the body's end the window `… } export function` matches the occurrence `f5

- **Issue #1023** (2026-09-07): **Detector drops all a↔b clones when b contains a second copy of the first half of a duplicated block**
  *Symptoms*: Found while reviewing #1020; reproduces on `master` with default options (no `--max-gap-lines`, so the merge pass is not involved).  **Setup.** `a.js` holds a block `P + Q` (two halves, each above `--min-tokens`). `b.js` holds `P + <inserted line> + Q` **and a second copy of `P`** further down.  **Expected.** At least the exact clones a.P↔b.P (twice) and a.Q↔b.Q.  **Actual.** Every a↔b clone disappears, including the unrelated 100-token a.Q↔b.Q match; only b's self-clone (P↔P inside b.js) is reported.  The primary pass keeps the first stored occurrence per window, and the secondary pass's coverage filter then appears to suppress the a↔b pairs. Worth a focused test in `rust/crates/cpd-core/src/detect.rs` around `add_secondary_clones` / `LineCoverage`.   <!-- brian settings start --><!--{}--><!-- brian settings end -->
  **Post-Mortem & Fix Analysis**:
  > Root cause is in the tokenizer, not the detector: any oxc parse diagnostic (here the redeclaration of `saveUser`) sent the file to the word-split fallback tokenizer, so its tokens could not match an oxc-tokenized file. Fix in #1024: only a parser that gives up (`panicked`) or yields no tokens falls back; recoverable diagnostics keep the lexer's token stream. Demo in `fixtures/parse-errors-demo`.

- **Issue #623** (2026-09-01): **PHP Multiline strings causing line number to be reported incorrectly**
  *Symptoms*: **Describe the bug** When scanning two PHP files that contain a duplicate block, but where one file also has a multi-line string before the block, the line number for the reported error will be off by the number of newlines within the PHP string (like the string is always assumed to be one line in the code that calculates this).  **To Reproduce** Steps to reproduce the behavior: Create one file with contexnts: ``` <?php  final class FirstClass {     /** @inheritDoc * */     public function someFunction(): void     {         $sql = "SELECT                      LINE1,                     LINE2,                     LINE3                 FROM mysql.table";     }      public function imageUri(mixed $result, string $subdomain): string     {         $portPart = '';         if ($this->environment->isDeveloperEnv()) {             $port = (int) $this->environment->getHttpPort();             if (!in_array($port, [80, 443])) {                 $portPart = ":$port";             }         }          return "ABC123";     } } ```  Create a second file with: ``` <?php  final class SecondClass {     public function getImageUriBasePath(): string     {         $portPart = '';         if ($this->environment->isDeveloperEnv()) {             $port = (int) $this->environment->getHttpPort();             if (!in_array($port, [80, 443])) {                 $portPart = ":$port";             }         }          $subdomain = $this->environment->getSubDoma
  **Post-Mortem & Fix Analysis**:
  > Oh darn, I just encountered this too. I'll see if I can dig in the code to help.
  > Alright, I looked into it and the package reprism is definitely to blame since it probably forked a now very old version of PrismJS.  I rolled back Prism versions until I encountered the bug to guess around what version multiline strings weren't working and it was around 1.8.0 which fits the range of time around when reprism forked. Reprism was created with the intend of being an esm compatible port, but wasn't really updated whereas Prism is still updated and they're currently working on v2 which will be the modernized esm version. I'll look into another approach to solve my problem and report my findings.
  > Found it. Not sure it's related to the version of Prism that much anymore, granted the new syntax definition is more accurate at times because of new PHP language features, but nonetheless, here's the guilty part[: there's a place where the alias gets passed as the lang argument]. (https://github.com/kucherenko/jscpd/blob/c1f369912bb77b67f029bf396fb36c94f5f772d0/packages/tokenizer/src/tokenize.ts#L119).  ```javascript         (t: IToken) => (res = res.concat(createTokens(t, token.alias ? sanitizeLangName(token.alias as string) : lang))), ```  Not sure why, this piece of code is there, but that why some of the tokens don't go through when they're a few levels deep (string -> heredoc / string -> double-quoted-string + interpolations, etc.).  A simple fix for PHP right is to simply replace that line with :  ```javascript (t: IToken) => (res = res.concat(createTokens(t, lang))), ```  But that breaks the tests with some other languages so I'd need to investigate further.

- **Issue #612** (2026-09-01): **consoleFull/html reporter shows wrong code block than line number gives**
  *Symptoms*: **Describe the bug** consoleFull/html reporter shows wrong code block than line number gives  **To Reproduce** `jscpd  -r consoleFull --skipLocal --mode strict b/utsname.c  a/utsname.c`  **Screenshots** error code block as following: ```bash $ jscpd  -r consoleFull --skipLocal --mode strict b/utsname.c  a/utsname.c Clone found (c):  - b/utsname.c [6:27 - 16:1] (10 lines, 68 tokens)    a/utsname.c [31:1 - 41:1]  Clone found (c):  - b/utsname.c [6:27 - 16:1] (10 lines, 68 tokens)    a/utsname.c [31:1 - 41:1]   6  │ 31 │ ude <linux/uts.h>  7  │ 32 │ #include <linux/utsname.h>  8  │ 33 │ #include <linux/err.h>  9  │ 34 │  10 │ 35 │ // only in testing hahahha  11 │ 36 │ static struct uts_namespace *create_uts_ns(void)  12 │ 37 │ {  13 │ 38 │      struct uts_namespace *uts_ns;  14 │ 39 │  15 │ 40 │      uts_ns = kmalloc(sizeof(  Found 1 clones. Detection time:: 46.558ms  ```  **Expected behavior** output shows correct, full matched code.   **Desktop (please complete the following information):**  - OS: Ubuntu  - OS Version 18.04  - NodeJS Version v16.20.2  - jscpd version 3.5.10   **Additional context** b/utsname.c ```c #include <linux/export.h> #include <linux/uts.h> #include <linux/utsname.h> #include <linux/err.h>  // only in testing hahahha static struct uts_namespace *create_uts_ns(void) // line 6 here. {         struct uts_namespace *uts_ns;          uts_ns = kmalloc(sizeof(struct uts_namespace), GFP_KERNEL);         i
  **Post-Mortem & Fix Analysis**:
  > will check, thank you
  > Not reproducible on v5.1.1.  Verified with `-r console-full --mode strict` on two C files holding the same block at different offsets: the printed code matches the reported range line-for-line in both fragments.  Closing; please reopen with a sample if you still see the block and the line numbers disagree on v5. 

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

### Incident Patch 1: `af15b553` (2026-10-05)
**Commit Message**: fix(similarity): review findings for Python, code blocks and role-aware names

- A Python def whose body is only `...` or a docstring declares and is not
  compared: @overload signatures, .pyi stubs, Protocol members.
- The size limits read a Python function's code without its docstring and
  comments, so a documented one-line getter stays under them.
- The Python walk stops 1000 levels deep, and a deeper tree drops on a stack
  of its own, so generated code cannot overflow the stack. A function nested
  past 16 open ones gets no sequence of its own, in Python and in JS/TS.
- role-aware names the method behind parentheses, `!`, `as`, `satisfies`,
  `<T>` and template keys.
- --skip-local and --skip-isolated drop function pairs as they drop token
  clones, in the CLI, the language server and the MCP server.
- Copies paired with a shared first copy are not reported again as similar.
- A pair takes the format of its first fragment, and --summary and --health
  fold every fragment into its own file.
- An Astro page with code only in its frontmatter is scanned.
- An unknown similarityIdentifiers value is a config diagnostic, the project
  config wins over the language server's flag, and

**File**: `README.md` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ jscpd v5 is a Rust engine that ships as a self-contained binary — no runtime r
 - **Language-aware tokenization** — per-format comment and string syntax for all 224 formats, the oxc parser for JavaScript/TypeScript/JSX/TSX, embedded-language extraction for Vue, Svelte, Astro, Markdown and Razor, and keyword/identifier/literal classification, so a clone is a repeated sequence of *language tokens*, never a repeated run of text (see [How detection works](docs/rust.md#how-detection-works))
 - **224 language formats**, with cross-format detection (Vue SFC, Svelte, Astro, Markdown) and `--cross-formats` groups to match clones across JavaScript and TypeScript
 - **Type-2 clones** — `--ignore-identifiers`, `--ignore-literals` and `--ignore-annotations` find blocks that differ only in names, literal values or annotations, reported as `renamed` (see [docs](docs/rust.md#type-2-clones-renamed-identifiers-literals-and-annotations))
-- **Type-3 near-miss clones** — `--max-gap-lines N` merges a copy with a few inserted or changed lines into one `similar` clone with a similarity score; `--similarity 0.85` compares whole JavaScript, TypeScript and Python functions by syntax-tree structure, in code blocks of Markdown and components too, catching renames and scattered edits; `--similarity-identifiers role-aware` also tells apart functions that call different methods (see [docs](docs/rust.md#type-3-clones-near-miss-merging-with---max-gap-lines))
+- **Type-3 near-miss clones** — `--max-gap-lines N` merges a copy with a few inserted or changed lines into one `similar` clone with a similarity score; `--similarity 0.85` compares whole JavaScript, TypeScript and Python functions by syntax-tree structure, in code blocks of Markdown and components too, catching renames and scattered edits; `--similarity-identifiers role-aware` lowers the score of functions that call different methods (see [docs](docs/rust.md#type-3-clones-near-miss-merging-with---max-gap-lines))
 - **Type-4 semantic clones (experimental)** — `--semantic` embeds the functions of JavaScript, TypeScript, Vue, Svelte, Astro, Python, Rust, Go, Java, Kotlin, C#, C, C++, PHP, Ruby, Scala and Swift files with a code embedding model, either one jscpd runs itself (after `jscpd --semantic-download` once) or any OpenAI-compatible API, and reports functions that do the same thing written differently: the same feature implemented twice in one language, or a rule your Rust backend enforces and your Svelte frontend repeats (see [Semantic clones](#semantic-clones-experimental) below)
 - **Port progress and parity (experimental)**: `jscpd --compare python/ typescript/` pairs the functions of two folders with the same model and lists which functions of each have a counterpart in the other: what is left to port to another language or platform, or what the Android version of an app has that the iOS one lacks (see [Comparing two codebases](#comparing-two-codebases-experimental) below)
 - **Clone kinds everywhere** — `exact`, `renamed` or `similar` in the console, JSON (`kind`, `similarity`, `method`), XML, HTML, Xcode, SARIF (`jscpd/duplicate-code`, `jscpd/renamed-code`, `jscpd/similar-code`, `jscpd/similar-function`, `jscpd/semantic-code`) and Code Climate output; default runs still report only `exact` clones
```

**File**: `docs/ai-ready.md` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@ The tools find the four types of clone:
 |------|------|------------|-------------------------|
 | `exact` | Type-1 | The same tokens; layout and comments may differ | The token passes of the scan |
 | `renamed` | Type-2 | The same code with identifiers or literals changed | The normalization the options configure (`--ignore-identifiers`, `--ignore-literals`, `--ignore-annotations`); with none configured, a second scan that normalizes identifiers and literals |
-| `similar` | Type-3 | A copy with lines added, removed or changed | `gap`: clones of one file pair merged across up to `--max-gap-lines` unmatched lines (2 when the option is not set). `ast`: JavaScript, TypeScript and Python functions with the same syntax-tree shape, at `--similarity` (0.85 when not set). With `--similarity-identifiers role-aware` on the server, functions that call different methods do not match |
+| `similar` | Type-3 | A copy with lines added, removed or changed | `gap`: clones of one file pair merged across up to `--max-gap-lines` unmatched lines (2 when the option is not set). `ast`: JavaScript, TypeScript and Python functions with the same syntax-tree shape, at `--similarity` (0.85 when not set). With `--similarity-identifiers role-aware` on the server, the methods that calls invoke count too, so functions that call different methods score lower |
 | `semantic` | Type-4 | Functions that do the same job, written differently or in another language | The `--semantic` embedding model |
 
 See [`fixtures/mcp-demo`](../fixtures/mcp-demo/README.md) for a runnable example of each kind and of `compare_folders`.
```

**File**: `docs/api.md` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ The `jscpd` crate's own library target is **not a public API** — it exists to
 | Crate | Description |
 |-------|-------------|
 | [`cpd-core`](https://crates.io/crates/cpd-core) | Core data models and hashing (Rabin-Karp rolling hash) |
-| [`cpd-tokenizer`](https://crates.io/crates/cpd-tokenizer) | Source code tokenization (224 formats, uses `oxc_parser` for JavaScript/TypeScript) — pure, no I/O |
+| [`cpd-tokenizer`](https://crates.io/crates/cpd-tokenizer) | Source code tokenization (224 formats, uses `oxc_parser` for JavaScript/TypeScript and the ruff parser for Python functions) — pure, no I/O |
 | [`cpd-finder`](https://crates.io/crates/cpd-finder) | File walking, orchestration, git blame (`rayon` + `ignore` + `globset`) |
 | [`cpd-reporter`](https://crates.io/crates/cpd-reporter) | Output format rendering (15 reporters) |
 | [`cpd-semantic`](https://crates.io/crates/cpd-semantic) | Semantic clones (`--semantic`, experimental), as a clone pass for `cpd-finder` |
```

**File**: `docs/packages.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ Core data models and the Rabin-Karp rolling hash implementation.
 **crates.io:** [`cpd-tokenizer`](https://crates.io/crates/cpd-tokenizer)
 **Version:** 0.1.19
 
-Source code tokenizer (224 formats, listed in [FORMATS.md](../FORMATS.md)). Uses `oxc_parser` for JavaScript/TypeScript/JSX and per-block tokenization for Vue SFC, Svelte, Astro, and Markdown. Pure — no filesystem or network access (enforced in CI).
+Source code tokenizer (224 formats, listed in [FORMATS.md](../FORMATS.md)). Uses `oxc_parser` for JavaScript/TypeScript/JSX, the ruff parser for the Python functions of `--similarity`, and per-block tokenization for Vue SFC, Svelte, Astro, and Markdown. Pure — no filesystem or network access (enforced in CI).
 
 ### cpd-finder
 
```

**File**: `docs/rust.md` (modified, +5/-3)
```diff
@@ -507,9 +507,11 @@ jscpd --similarity 0.85 src/        # near-identical structure: renames, literal
 jscpd --similarity 0.7 src/         # looser: a couple of added or removed statements
 ```
 
-Functions must clear `--min-tokens` and `--min-lines` on their own, nested functions are never paired with their parent, and a pair that an exact, renamed or merged clone already covers is not reported again. Reporting is the same as for merged clones except for the method and the rule: the console prints `Clone found (javascript, similar (ast) ~0.75)`, the `ai` reporter `[~0.75 ast]`, JSON carries `"method": "ast"`, and SARIF and Code Climate file these pairs under a rule of their own, `jscpd/similar-function`, with `similarity_method` in SARIF too. The two mechanisms find different things, so code scanning keeps them apart. Releases up to 5.3.3 filed these pairs under `jscpd/similar-code`, so the first upload after the upgrade closes those alerts and opens them again under the new rule; `tokens` is the smaller function's token count and the fragments span the whole functions. Values outside `(0, 1]` print a warning and fall back to `1`.
+Functions must clear `--min-tokens` and `--min-lines` on their own, nested functions are never paired with their parent, and a pair that an exact, renamed or merged clone already covers is not reported again. That includes the copies of one fragment: detection pairs every copy with the first one, and the pairs among the other copies are implied, so they are not reported as `similar` either. `--skip-local` and `--skip-isolated` drop function pairs as they drop token clones. Reporting is the same as for merged clones except for the method and the rule: the console prints `Clone found (javascript, similar (ast) ~0.75)`, the `ai` reporter `[~0.75 ast]`, JSON carries `"method": "ast"`, and SARIF and Code Climate file these pairs under a rule of their own, `jscpd/similar-function`, with `similarity_method` in SARIF too. The two mechanisms find different things, so code scanning keeps them apart. Releases up to 5.3.3 filed these pairs under `jscpd/similar-code`, so the first upload after the upgrade closes those alerts and opens them again under the new rule; `tokens` is the smaller function's token count and the fragments span the whole functions. Values outside `(0, 1]` print a warning and fall back to `1`.
 
-Functions in code blocks count too: the fences of a Markdown file and the scripts of Vue, Svelte and Astro components, each parsed as its own language. A pair found there is reported at the host file's own lines, as in `guide.md:python [12:1 - 19:16]`. A Python function starts at `def`, so its decorators stay out of it, while its type annotations, type parameters and docstring are part of its structure.
+Functions in code blocks count too: the fences of a Markdown file, the scripts of Vue, Svelte and Astro components and Astro's frontmatter, each parsed as its own language. A pair found there is reported at the host file's own lines, as in `guide.md:python [12:1 - 19:16]`. A Python function starts at `def`, so its decorators stay out of it, while its type annotations, type parameters and docstring are part of its structure. The size limits read its code alone, so a docstring and comments do not carry a one-line getter past `--min-tokens` and `--min-lines`. A function whose body is only `...` or a docstring, such as an `@overload` signature, a `.pyi` stub or a `Protocol` member, declares and is not compared, as with TypeScript functions without a body.
+
+Releases up to 5.4.0 compared only JavaScript and TypeScript files. A run with `--similarity` can report more pairs after the upgrade, from Python files and from code blocks, so refresh a baseline or a `--threshold` that was set on the old results.
 
 #### Role-aware names: `--similarity-identifiers`
 
@@ -519,7 +521,7 @@ By default no name takes part in the summary, so two functions with the same str
 jscpd --similarity 0.85 --similarity-identifiers role-aware src/
 ```
 
-Only a call on a member keeps a name: `load` in `store.load(x)`, `self.repo.load(x)`, `store?.load(x)` or `this.#load()`. A plain call such as `load_user(x)` keeps none, because copies often call a renamed helper. Reading an attribute without calling it, as in `user.name`, keeps no name either. A pair that calls different methods scores lower: in [`fixtures/similarity-python-demo`](../fixtures/similarity-python-demo/README.md), two functions that differ only in two of the methods they call drop from `1.00` to `0.80`, under the usual `0.85`. The default `ignore` gives the results of earlier releases. The MCP server takes the mode from its own `--similarity-identifiers`, and the language server from the config key. jscpd prints a warning when `role-aware` is set without `--similarity`, since no pass runs then.
+Only a call on a member keeps a name: `load` in `store.load(x)`, `self.repo.load(x)`, `store?.load(x)` or `this.#load()`. A plain call such as `load_us
```

**File**: `fixtures/similarity-python-demo/README.md` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ jscpd fixtures/similarity-python-demo/python
 # Found 0 clones.
 jscpd fixtures/similarity-python-demo/python --similarity 0.85
 # Clone found (python, similar (ast) ~1.00)
-#  - inventory.py [1:1 - 9:16] (9 lines, 73 tokens)
+#  - inventory.py [1:1 - 9:16] (9 lines, 72 tokens)
 #    library.py [1:1 - 9:16]
 # Found 1 clones.
 jscpd fixtures/similarity-python-demo/python --similarity 0.85 --similarity-identifiers role-aware
@@ -48,7 +48,7 @@ jscpd fixtures/similarity-python-demo/methods --similarity 0.5 --similarity-iden
 ```bash
 jscpd fixtures/similarity-python-demo/markdown --similarity 0.85
 # Clone found (python, similar (ast) ~1.00)
-#  - guide.md:python [6:1 - 14:16] (9 lines, 67 tokens)
+#  - guide.md:python [6:1 - 14:16] (9 lines, 62 tokens)
 #    guide.md:python [20:1 - 28:16]
 # Found 1 clones.
 ```
```

**File**: `fixtures/type3-demo/README.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ Commands run from the repository root at default thresholds; the lines after
 | `renamed-halves/` | 1 line, names differ | 0 clones | see below | see below |
 
 `similar-functions/` demonstrates the second mechanism, `--similarity RATIO`,
-which compares whole JavaScript/TypeScript functions by syntax-tree structure
+which compares whole JavaScript, TypeScript and Python functions by syntax-tree structure
 instead of joining token runs (see below).
 
 ## `inserted-line/` — one inserted guard
```

**File**: `rust/Cargo.lock` (modified, +1/-0)
```diff
@@ -664,6 +664,7 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_parser",
  "ruff_text_size",
+ "stacker",
 ]
 
 [[package]]
```

---

### Incident Patch 2: `178251b9` (2026-10-04)
**Commit Message**: Merge pull request #1133 from mlavrinenko/fix/nix-eval-deprecation-warnings

fix(nix): use stdenv.hostPlatform.isDarwin

**File**: `flake.nix` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@
           pname = "jscpd";
           version = (craneLib.crateNameFromCargoToml { cargoToml = ./rust/crates/cpd/Cargo.toml; }).version;
           nativeBuildInputs = [ pkgs.pkg-config ];
-          buildInputs = pkgs.lib.optionals pkgs.stdenv.isDarwin [
+          buildInputs = pkgs.lib.optionals pkgs.stdenv.hostPlatform.isDarwin [
             pkgs.libiconv
             pkgs.apple-sdk
           ];
```

---

### Incident Patch 3: `61fd4c22` (2026-10-03)
**Commit Message**: fix(nix): use stdenv.hostPlatform.isDarwin

**File**: `flake.nix` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@
           pname = "jscpd";
           version = (craneLib.crateNameFromCargoToml { cargoToml = ./rust/crates/cpd/Cargo.toml; }).version;
           nativeBuildInputs = [ pkgs.pkg-config ];
-          buildInputs = pkgs.lib.optionals pkgs.stdenv.isDarwin [
+          buildInputs = pkgs.lib.optionals pkgs.stdenv.hostPlatform.isDarwin [
             pkgs.libiconv
             pkgs.apple-sdk
           ];
```

---

### Incident Patch 4: `8abb0471` (2026-10-03)
**Commit Message**: Merge pull request #1130 from kucherenko/fix/compare-report-quirks

fix(compare): one share in both reports, no empty Tests block, no bodiless functions

**File**: `docs/rust.md` (modified, +3/-3)
```diff
@@ -512,7 +512,7 @@ Scoring needs a syntax tree, and today only JavaScript/TypeScript have one (oxc)
 
 ### Semantic clones with `--semantic` (experimental)
 
-Some functions do the same thing but are written differently: renamed, restructured, or in another language, like a validation rule a Rust backend enforces and a Svelte frontend repeats, or two helpers two people wrote for the same job. They share no token run and no syntax tree for the passes above to match (Type-4 clones). `--semantic` (config key `semantic`) looks for them with a code embedding model. It embeds every function of a JavaScript, TypeScript, JSX, TSX, Vue, Svelte, Astro, Python, Rust, Go, Java, Kotlin, C#, C, C++, PHP, Ruby, Scala or Swift file that clears `--min-tokens` and `--min-lines`, as the function's code without comments, starting at the name the function is declared under (a method's key, the variable an arrow function is assigned to, or the test-case call a callback is passed to, as in `it('rounds cents', () => …)`). Two functions are reported as one `semantic` clone when
+Some functions do the same thing but are written differently: renamed, restructured, or in another language, like a validation rule a Rust backend enforces and a Svelte frontend repeats, or two helpers two people wrote for the same job. They share no token run and no syntax tree for the passes above to match (Type-4 clones). `--semantic` (config key `semantic`) looks for them with a code embedding model. It embeds every function of a JavaScript, TypeScript, JSX, TSX, Vue, Svelte, Astro, Python, Rust, Go, Java, Kotlin, C#, C, C++, PHP, Ruby, Scala or Swift file that clears `--min-tokens` and `--min-lines`, as the function's code without comments, starting at the name the function is declared under (a method's key, the variable an arrow function is assigned to, or the test-case call a callback is passed to, as in `it('rounds cents', () => …)`). jscpd skips declarations without a body, which have no code to compare: TypeScript overload signatures and `declare function`, the functions of a `.d.ts` file, interface and abstract methods, a Swift protocol's `init`, a Go function written in assembly and a C++ `= default`. Two functions are reported as one `semantic` clone when
 
 - they are in different files, neither calls the other by name, the clones the token passes found do not already cover both (90% of each function's lines), and `--skip-local` / `--skip-isolated` allow the pair. A function and the helper it calls are related, not duplicated, and a copy that is already reported does not take the place of a function's real match. A call counts only between languages that can call each other (one language, C with C++, Java with Kotlin and Scala), so `JSON.parse(` in TypeScript does not rule out a Python `parse`;
 - each is the other's closest match among the functions of its language (the Rust functions, the Python ones, or the JavaScript-family ones), or close to it: within 0.05 with jina-embeddings-v2-base-code, and within as much more as the model's scores are spread wider (0.075 with CodeRankEmbed). A feature written three times makes three pairs, while a function that resembles many others (a request handler, a getter) pairs once per language at most;
@@ -663,7 +663,7 @@ A file is a test file when its name or a folder on its path says so. The names a
 
 Inside a code file, jscpd counts a Rust function as a test when it sits in a `#[cfg(test)]` module or in a file that starts with `#![cfg(test)]`, or when it has a test attribute such as `#[test]`, `#[tokio::test]` or `#[rstest]`. A `#[cfg(not(test))]` module stays code. A JavaScript or TypeScript test case such as `it('rounds cents', () => …)` is a test wherever it lives. Playwright's `test.describe` and `test.step` are not test cases, and neither is a method that happens to be named `test`.
 
-When neither side has tests, the report has no headings and reads as the code alone.
+When neither side has a test that counts, the report has no headings and reads as the code alone. A test counts the way a function does, by `--min-tokens` and `--min-lines` (see below), so the template test of a new Android module adds no block of zeros. When only the tests count, the report is the tests block alone.
 
 "Paired under other names" lists the pairs whose names differ even once case and underscores are ignored: renamed ports, constructors (`QrCode` and `__init__`), and platform names (`startWatch` and `watchPosition`). These are the pairs nobody finds by searching for a name, so the default console report shows them, and `console-full` lists every pair.
 
@@ -684,7 +684,7 @@ jscpd pairs the functions of the two paths with the model of `--semantic`, so `-
 - the rule of `--semantic` between the two sides: each function is the other's closest match (or close to it, above the group floor), the similarity reaches the threshold, and it stands out from the function's background, which is the other side. Functions under `--mi
```

**File**: `fixtures/compare-demo/README.md` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ jscpd tells a test by the conventions of its language, so it reads `test_billing
 
 The file tables give each file's paired functions, the mean similarity of their pairs, and the file on the other side that holds most of the counterparts. "Paired under other names" lists the pairs whose names differ even once case, underscores, spaces and punctuation are ignored, the ones nobody would find by searching for a name: here `tax_for_region`, ported as `salesTax`. Each pair has its cosine similarity and a level, `high`, `medium` or `low`, on the scale of the model. `high` is almost always the same function. For `low`, read both, since related code pairs there too. A file with low pairs shows how many, as in `0.62, 1 low`. The "Only in" lists group the functions by file. In a terminal the report is in colour, and `--no-colors` prints it as shown here.
 
-The code block of `typescript` has 4 functions and not 5 because `formatInvoiceNumber` is shorter than the counting bar (`--min-tokens`, 30 with `--compare`, and `--min-lines`, 5). It is still found as the partner of `format_invoice_number`.
+`billing.ts` holds five functions, but the report counts four of them, so its row says `3 / 4`. The fifth, `formatInvoiceNumber`, is shorter than the counting bar (`--min-tokens`, 30 with `--compare`, and `--min-lines`, 5). jscpd still finds it as the partner of `format_invoice_number`.
 
 ## Every pair
 
```

**File**: `rust/crates/cpd-semantic/src/extract/grammars.rs` (modified, +90/-1)
```diff
@@ -18,6 +18,23 @@ pub struct TreeSitterExtractor {
     language: LanguageFn,
     /// Node kinds that are functions; nested ones are found too.
     functions: &'static [&'static str],
+    /// How a function node shows that it has code.
+    body: Body,
+}
+
+/// How a function node shows that it has a body. A node of a function kind
+/// without one declares a function whose code is elsewhere or nowhere, such
+/// as an interface or abstract method, a Go function written in assembly or
+/// a C++ `= default`, so it takes no part.
+#[derive(Clone, Copy)]
+enum Body {
+    /// The node's `body` field.
+    Field,
+    /// A child of this kind: Kotlin's `function_body` is not a field.
+    Child(&'static str),
+    /// Every node has one. An empty Ruby method has no `body` field, but it
+    /// is a method all the same, as an empty JavaScript function is.
+    Always,
 }
 
 /// Subtrees at the start of a function node that are not its own code:
@@ -70,6 +87,7 @@ pub static C: TreeSitterExtractor = TreeSitterExtractor {
     formats: &["c"],
     language: tree_sitter_c::LANGUAGE,
     functions: &["function_definition"],
+    body: Body::Field,
 };
 
 pub static CPP: TreeSitterExtractor = TreeSitterExtractor {
@@ -79,6 +97,7 @@ pub static CPP: TreeSitterExtractor = TreeSitterExtractor {
     formats: &["cpp", "cpp-header", "c-header"],
     language: tree_sitter_cpp::LANGUAGE,
     functions: &["function_definition", "lambda_expression"],
+    body: Body::Field,
 };
 
 pub static CSHARP: TreeSitterExtractor = TreeSitterExtractor {
@@ -91,13 +110,15 @@ pub static CSHARP: TreeSitterExtractor = TreeSitterExtractor {
         "local_function_statement",
         "operator_declaration",
     ],
+    body: Body::Field,
 };
 
 pub static GO: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "go",
     formats: &["go"],
     language: tree_sitter_go::LANGUAGE,
     functions: &["function_declaration", "method_declaration", "func_literal"],
+    body: Body::Field,
 };
 
 pub static JAVA: TreeSitterExtractor = TreeSitterExtractor {
@@ -109,13 +130,15 @@ pub static JAVA: TreeSitterExtractor = TreeSitterExtractor {
         "constructor_declaration",
         "compact_constructor_declaration",
     ],
+    body: Body::Field,
 };
 
 pub static KOTLIN: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "kotlin",
     formats: &["kotlin"],
     language: tree_sitter_kotlin_ng::LANGUAGE,
     functions: &["function_declaration", "anonymous_function"],
+    body: Body::Child("function_body"),
 };
 
 pub static PHP: TreeSitterExtractor = TreeSitterExtractor {
@@ -127,27 +150,31 @@ pub static PHP: TreeSitterExtractor = TreeSitterExtractor {
         "method_declaration",
         "anonymous_function",
     ],
+    body: Body::Field,
 };
 
 pub static RUBY: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "ruby",
     formats: &["ruby"],
     language: tree_sitter_ruby::LANGUAGE,
     functions: &["method", "singleton_method"],
+    body: Body::Always,
 };
 
 pub static SCALA: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "scala",
     formats: &["scala"],
     language: tree_sitter_scala::LANGUAGE,
     functions: &["function_definition"],
+    body: Body::Field,
 };
 
 pub static SWIFT: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "swift",
     formats: &["swift"],
     language: tree_sitter_swift::LANGUAGE,
     functions: &["function_declaration", "init_declaration"],
+    body: Body::Field,
 };
 
 impl FunctionExtractor for TreeSitterExtractor {
@@ -174,7 +201,7 @@ impl FunctionExtractor for TreeSitterExtractor {
         let mut cursor = tree.walk();
         'walk: loop {
             let node = cursor.node();
-            if node.is_named() && self.functions.contains(&node.kind()) {
+            if node.is_named() && self.functions.contains(&node.kind()) && self.has_body(node) {
                 let start = line_index.location(code_start(node));
                 out.push(RawFunction {
                     grammar: self.grammar,
@@ -198,6 +225,19 @@ impl FunctionExtractor for TreeSitterExtractor {
     }
 }
 
+impl TreeSitterExtractor {
+    fn has_body(&self, function: Node) -> bool {
+        match self.body {
+            Body::Field => function.child_by_field_name("body").is_some(),
+            Body::Child(kind) => {
+                let mut cursor = function.walk();
+                function.children(&mut cursor).any(|c| c.kind() == kind)
+            }
+            Body::Always => true,
+        }
+    }
+}
+
 /// The byte where a function's own code starts: its first token outside
 /// the annotations, attributes and comments it opens with.
 fn code_start(function: Node) -> usize {
@@ -432,6 +472,55 @@ mod tests {
         );
     }
 
+    #[test]
+    fn declarations_without_a_body_take_no_part() {
+        let cases: &[(&str, &str, &[&str])] = &[
+            (
+                "java",
+                "interface Shape {\n    double area();\n    default String
```

**File**: `rust/crates/cpd-tokenizer/src/functions.rs` (modified, +22/-4)
```diff
@@ -253,6 +253,10 @@ impl<'a> Visit<'a> for Extractor<'_> {
                     self.pending_call = Some((call.span.start, call.span.end));
                 }
             }
+            // A function without a body has no code to compare: an
+            // overload signature, `declare function`, an abstract method,
+            // every function of a `.d.ts` file.
+            AstKind::Function(f) if f.body.is_none() => {}
             AstKind::Function(f) => {
                 let own = f.id.as_ref().map(|id| id.name.to_string());
                 let name = match own {
@@ -281,6 +285,7 @@ impl<'a> Visit<'a> for Extractor<'_> {
 
     fn leave_node(&mut self, kind: AstKind<'a>) {
         match kind {
+            AstKind::Function(f) if f.body.is_none() => {}
             AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) => self.close(),
             AstKind::CallExpression(call)
                 if self.pending_call == Some((call.span.start, call.span.end)) =>
@@ -376,13 +381,17 @@ fn test_case(call: &oxc_ast::ast::CallExpression<'_>) -> Option<(String, u32)> {
 mod tests {
     use super::*;
 
+    /// The names of `fns`, in the order the extractor emits them.
+    fn names(fns: &[RawFunction]) -> Vec<&str> {
+        fns.iter().map(|f| f.name.as_str()).collect()
+    }
+
     const SRC: &str = "export function total(items) {\n  let sum = 0;\n  for (const it of items) { sum += it.price; }\n  return sum;\n}\nconst double = (x) => x * 2;\nclass Cart {\n  add(item) { this.items.push(item); }\n}\nconst obj = { run() { return 1; }, cb: function () { return 2; } };\n";
 
     #[test]
     fn extracts_declarations_arrows_methods_and_properties_with_names() {
         let fns = extract_functions(SRC, "javascript");
-        let names: Vec<&str> = fns.iter().map(|f| f.name.as_str()).collect();
-        assert_eq!(names, vec!["total", "double", "add", "run", "cb"]);
+        assert_eq!(names(&fns), vec!["total", "double", "add", "run", "cb"]);
         let total = &fns[0];
         assert_eq!((total.start.line, total.end.line), (1, 5));
         assert!(total.kinds.len() > 20, "{}", total.kinds.len());
@@ -403,9 +412,8 @@ mod tests {
     fn test_case_callbacks_go_by_their_titles() {
         let src = "describe('money', () => {\n  beforeEach(() => reset());\n  it('rounds  cents', () => {\n    expect(round(149)).toBe(100);\n  });\n  test.each([[1, 2]])('adds %i', (a, b) => {\n    expect(a + b).toBe(3);\n  });\n  it.only(`keeps ${'x'} dynamic`, () => {});\n  it('has no callback');\n  const later = () => 1;\n  test(\"async one\", async function () { await later(); });\n  it('named', function named() { [1].map((x) => x * 2); });\n  test.each([[() => 1]])('table', (f) => f());\n  test.describe('suite', () => {});\n  test.step('step', async () => {});\n});\n";
         let fns = extract_functions(src, "typescript");
-        let names: Vec<&str> = fns.iter().map(|f| f.name.as_str()).collect();
         assert_eq!(
-            names,
+            names(&fns),
             vec![
                 "<arrow>",
                 "rounds cents",
@@ -461,6 +469,16 @@ mod tests {
         assert_eq!(fns[0].kinds, fns[1].kinds);
     }
 
+    #[test]
+    fn declarations_without_a_body_are_not_functions() {
+        let src = "export function copy(src: string): void;\nexport function copy(src: string, dest: string): void;\nexport function copy(src: string, dest?: string): void {\n  write(src, dest);\n}\ndeclare function native(a: number): number;\nabstract class Base {\n  abstract run(): void;\n  go(a: string): void;\n  go(a: unknown) {\n    const twice = () => a;\n    return twice();\n  }\n}\n";
+        let fns = extract_functions(src, "typescript");
+        assert_eq!(names(&fns), vec!["copy", "twice", "go"]);
+        assert_eq!((fns[0].start.line, fns[0].end.line), (3, 5));
+        let declarations = "export declare function copy(\n  src: string,\n  dest: string,\n  options?: object,\n): Promise<void>;\nexport class Fs {\n  read(path: string): string;\n}\n";
+        assert!(extract_functions(declarations, "typescript").is_empty());
+    }
+
     #[test]
     fn renamed_copies_share_the_same_kind_sequence() {
         let a = extract_functions("function a(x) { return x + 1; }", "javascript");
```

**File**: `rust/crates/cpd/src/compare/html.rs` (modified, +8/-0)
```diff
@@ -177,6 +177,14 @@ mod tests {
         assert_eq!(data["functions"][1][4], 5, "counted and ready");
     }
 
+    #[test]
+    fn the_page_rounds_shares_like_the_console() {
+        // `share_percent` in compare/mod.rs computes the same expression,
+        // so the map's header and the console print the same share: 60 of
+        // 147 is 41% in both.
+        assert!(TEMPLATE.contains("Math.round((part * 100) / whole)"));
+    }
+
     #[test]
     fn the_template_is_one_self_contained_page() {
         assert!(TEMPLATE.starts_with("<!doctype html>"));
```

**File**: `rust/crates/cpd/src/compare/mod.rs` (modified, +195/-74)
```diff
@@ -325,37 +325,51 @@ impl Report {
         }
     }
 
+    /// Which sections the console and Markdown reports show: the tests when
+    /// a side has a test that counts, and the code unless only the tests
+    /// have something to report. Tests too small to count, such as the
+    /// template test of a new Android module, leave no section of zeros.
+    fn shown(&self) -> (bool, bool) {
+        let tests = self.tests.counts();
+        (self.code.counts() || !tests, tests)
+    }
+
     /// The console report: the code, then the tests, each under a heading
-    /// when both are there. Without tests on either side it is the code
-    /// section alone, as it reads without the headings.
+    /// when both are shown. Without tests it is the code section alone, as
+    /// it reads without the headings.
     fn console(&self, style: &Style, full: bool) -> String {
-        let has = |section: &Section| section.sides.iter().any(|side| !side.empty);
-        match (has(&self.code), has(&self.tests)) {
-            (_, false) => self.code.console(style, full),
-            (false, true) => format!(
-                "{}\n{}",
-                style.bold("Tests"),
-                self.tests.console(style, full)
-            ),
-            (true, true) => format!(
-                "{}\n{}\n{}\n{}",
+        let (code, tests) = self.shown();
+        if !tests {
+            return self.code.console(style, full);
+        }
+        let tests = format!(
+            "{}\n{}",
+            style.bold("Tests"),
+            self.tests.console(style, full)
+        );
+        match code {
+            true => format!(
+                "{}\n{}\n{tests}",
                 style.bold("Code"),
-                self.code.console(style, full),
-                style.bold("Tests"),
-                self.tests.console(style, full)
+                self.code.console(style, full)
             ),
+            false => tests,
         }
     }
 
     fn markdown(&self) -> String {
+        let (show_code, show_tests) = self.shown();
         let [left, right] = &self.code.sides;
         let mut out = format!(
-            "# {} compared with {}\n\n## Code\n\n",
+            "# {} compared with {}\n",
             code(&left.path),
             code(&right.path)
         );
-        out.push_str(&self.code.markdown());
-        if self.tests.sides.iter().any(|side| !side.empty) {
+        if show_code {
+            out.push_str("\n## Code\n\n");
+            out.push_str(&self.code.markdown());
+        }
+        if show_tests {
             out.push_str("\n## Tests\n\n");
             out.push_str(&self.tests.markdown());
         }
@@ -509,17 +523,27 @@ impl Section {
         }
     }
 
+    /// Whether either side has a function that counts. A pair needs one,
+    /// so a section without any has no pairs either.
+    fn counts(&self) -> bool {
+        self.sides.iter().any(|side| side.functions > 0)
+    }
+
     /// The console report; `full` adds every pair. A side with no
     /// functions, such as the target of a port not started yet, leaves
     /// nothing to list: the report is the other side's total and a note.
     fn console(&self, style: &Style, full: bool) -> String {
         let mut out = String::new();
         let [left, right] = &self.sides;
+        if !self.counts() {
+            let why = match left.empty && right.empty {
+                true => "yet",
+                false => "long enough to count",
+            };
+            let note = format!("No {} in {} or {} {why}", self.noun, left.path, right.path);
+            return format!("{}\n", style.paint(&note, YELLOW));
+        }
         match (left.empty, right.empty) {
-            (true, true) => {
-                let note = format!("No {} in {} or {} yet", self.noun, left.path, right.path);
-                return format!("{}\n", style.paint(&note, YELLOW));
-            }
             (false, true) | (true, false) => {
                 let (side, empty) = match left.empty {
                     true => (right, left),
@@ -536,10 +560,12 @@ impl Section {
                     style.paint(&note, YELLOW),
                 );
             }
-            (false, false) => {}
+            // Both sides have functions; one with none that count is a
+            // section [`Self::counts`] already turned away.
+            _ => {}
         }
         for (side, other) in [(left, right), (right, left)] {
-            let share = format!("{:>3}%", side.percentage.round());
+            let share = format!("{:>3}%", share_percent(side.matched, side.functions));
             out.push_str(&format!(
                 "{} {} of {} {} in {} have a counterpart in {}\n",
                 style.bold(&style.paint(&share, share_color(side.matched, side.functions))),
@@ -811,6 +837,17 @@ fn percentage(part: usize, whole: usize) -> f64 {
     }
 }
 
+/// A share as a whole percent for the console, rounded from the counts the
+/// way the HTML report round
```

**File**: `rust/crates/cpd/src/compare/page.html` (modified, +3/-1)
```diff
@@ -518,7 +518,9 @@ <h2>Progress by folder</h2>
   const partner = (f, p) => fns[p.a === f.i ? p.b : p.a];
   const place = (f) => files[f.file].path + ":" + f.start;
   const fmt = (n) => n.toLocaleString("en-US");
-  const pct = (part, whole) => (whole === 0 ? 0 : Math.floor((part / whole) * 100));
+  // Rounded from the counts like the console report (share_percent in
+  // compare/mod.rs), so both print the same share.
+  const pct = (part, whole) => (whole === 0 ? 0 : Math.round((part * 100) / whole));
 
   const hasTests = fns.some((f) => f.test && f.counted);
   const sideIsFile = DATA.sideIsFile || [false, false];
```

**File**: `skills/compare-codebases/SKILL.md` (modified, +2/-2)
```diff
@@ -31,9 +31,9 @@ jscpd measures tests and code apart, in two blocks of the report, and pairs a te
 - a Rust function in a `#[cfg(test)]` module or under `#[test]`;
 - a JavaScript or TypeScript test case such as `it('rounds cents', () => …)`.
 
-When neither side has tests, the report has one block and no headings.
+When neither side has a test that counts (see below), the report has one block and no headings.
 
-Totals count the functions of at least `--min-tokens` tokens and `--min-lines` lines; smaller ones appear only as partners. Anonymous functions (callbacks, closures) take no part, except JavaScript and TypeScript test cases. A test case such as `it('rounds cents', () => …)` goes by its title, and so do those written with `test`, `specify`, `fit`, `xit`, `xtest` or `bench`, with `.only`, `.skip` or `.each(table)` after them. Suites and hooks stay anonymous. jscpd does not compare types, constants, SQL or UI markup.
+Totals count the functions of at least `--min-tokens` tokens and `--min-lines` lines; smaller ones appear only as partners. Declarations without a body (TypeScript overloads, the functions of a `.d.ts` file, interface and abstract methods) take no part. Anonymous functions (callbacks, closures) take no part either, except JavaScript and TypeScript test cases. A test case such as `it('rounds cents', () => …)` goes by its title, and so do those written with `test`, `specify`, `fit`, `xit`, `xtest` or `bench`, with `.only`, `.skip` or `.each(table)` after them. Suites and hooks stay anonymous. jscpd does not compare types, constants, SQL or UI markup.
 
 ## A way to compare two folders
 
```

---

### Incident Patch 5: `67bc428c` (2026-10-03)
**Commit Message**: fix(compare): one share in both reports, no empty Tests block, no bodiless functions

The console rounded a side's share and the HTML map floored it, so 60
of 147 functions read 41% in the terminal and 40% on the map. Both now
round from the counts with the same expression: Math.round(part * 100 /
whole) in the page and share_percent in Rust. The console also stops
rounding the two-decimal percentage a second time.

A side whose tests were all too small to count, such as the template
test of a new Android module, still switched the Tests block on, and
the console printed "0% 0 of 0 tests" for both sides. The console and
the Markdown report now show a section only when a side has a function
in it that counts, and JSON keeps both sections. When nothing counts at
all, the console says so instead of printing two lines of zeros.

Declarations without a body counted as functions. Through the oxc
extractor these were TypeScript overload signatures, declare function
and every function of a .d.ts file. Through the tree-sitter grammars
they were interface, abstract, native and extern methods, Go functions
written in assembly, C++ = default and = delete, and Swift protocol
initializers. They 

**File**: `docs/rust.md` (modified, +3/-3)
```diff
@@ -512,7 +512,7 @@ Scoring needs a syntax tree, and today only JavaScript/TypeScript have one (oxc)
 
 ### Semantic clones with `--semantic` (experimental)
 
-Some functions do the same thing but are written differently: renamed, restructured, or in another language, like a validation rule a Rust backend enforces and a Svelte frontend repeats, or two helpers two people wrote for the same job. They share no token run and no syntax tree for the passes above to match (Type-4 clones). `--semantic` (config key `semantic`) looks for them with a code embedding model. It embeds every function of a JavaScript, TypeScript, JSX, TSX, Vue, Svelte, Astro, Python, Rust, Go, Java, Kotlin, C#, C, C++, PHP, Ruby, Scala or Swift file that clears `--min-tokens` and `--min-lines`, as the function's code without comments, starting at the name the function is declared under (a method's key, the variable an arrow function is assigned to, or the test-case call a callback is passed to, as in `it('rounds cents', () => …)`). Two functions are reported as one `semantic` clone when
+Some functions do the same thing but are written differently: renamed, restructured, or in another language, like a validation rule a Rust backend enforces and a Svelte frontend repeats, or two helpers two people wrote for the same job. They share no token run and no syntax tree for the passes above to match (Type-4 clones). `--semantic` (config key `semantic`) looks for them with a code embedding model. It embeds every function of a JavaScript, TypeScript, JSX, TSX, Vue, Svelte, Astro, Python, Rust, Go, Java, Kotlin, C#, C, C++, PHP, Ruby, Scala or Swift file that clears `--min-tokens` and `--min-lines`, as the function's code without comments, starting at the name the function is declared under (a method's key, the variable an arrow function is assigned to, or the test-case call a callback is passed to, as in `it('rounds cents', () => …)`). Declarations without a body take no part, since they have no code to compare: TypeScript overload signatures and `declare function`, the functions of a `.d.ts` file, interface and abstract methods, a Swift protocol's `init`, a Go function written in assembly and a C++ `= default`. Two functions are reported as one `semantic` clone when
 
 - they are in different files, neither calls the other by name, the clones the token passes found do not already cover both (90% of each function's lines), and `--skip-local` / `--skip-isolated` allow the pair. A function and the helper it calls are related, not duplicated, and a copy that is already reported does not take the place of a function's real match. A call counts only between languages that can call each other (one language, C with C++, Java with Kotlin and Scala), so `JSON.parse(` in TypeScript does not rule out a Python `parse`;
 - each is the other's closest match among the functions of its language (the Rust functions, the Python ones, or the JavaScript-family ones), or close to it: within 0.05 with jina-embeddings-v2-base-code, and within as much more as the model's scores are spread wider (0.075 with CodeRankEmbed). A feature written three times makes three pairs, while a function that resembles many others (a request handler, a getter) pairs once per language at most;
@@ -663,7 +663,7 @@ A file is a test file when its name or a folder on its path says so. The names a
 
 Inside a code file, jscpd counts a Rust function as a test when it sits in a `#[cfg(test)]` module or in a file that starts with `#![cfg(test)]`, or when it has a test attribute such as `#[test]`, `#[tokio::test]` or `#[rstest]`. A `#[cfg(not(test))]` module stays code. A JavaScript or TypeScript test case such as `it('rounds cents', () => …)` is a test wherever it lives. Playwright's `test.describe` and `test.step` are not test cases, and neither is a method that happens to be named `test`.
 
-When neither side has tests, the report has no headings and reads as the code alone.
+When neither side has a test that counts, the report has no headings and reads as the code alone. A test counts as a function does, by `--min-tokens` and `--min-lines` (see below), so the template test of a new Android module leaves no block of zeros. When only the tests count, the report is the tests block alone.
 
 "Paired under other names" lists the pairs whose names differ even once case and underscores are ignored: renamed ports, constructors (`QrCode` and `__init__`), and platform names (`startWatch` and `watchPosition`). These are the pairs nobody finds by searching for a name, so the default console report shows them, and `console-full` lists every pair.
 
@@ -684,7 +684,7 @@ jscpd pairs the functions of the two paths with the model of `--semantic`, so `-
 - the rule of `--semantic` between the two sides: each function is the other's closest match (or close to it, above the group floor), the similarity reaches the threshold, and it stands out from the function's background, which is the other side. Functions under `-
```

**File**: `fixtures/compare-demo/README.md` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ jscpd tells a test by the conventions of its language, so it reads `test_billing
 
 The file tables give each file's paired functions, the mean similarity of their pairs, and the file on the other side that holds most of the counterparts. "Paired under other names" lists the pairs whose names differ even once case, underscores, spaces and punctuation are ignored, the ones nobody would find by searching for a name: here `tax_for_region`, ported as `salesTax`. Each pair has its cosine similarity and a level, `high`, `medium` or `low`, on the scale of the model. `high` is almost always the same function. For `low`, read both, since related code pairs there too. A file with low pairs shows how many, as in `0.62, 1 low`. The "Only in" lists group the functions by file. In a terminal the report is in colour, and `--no-colors` prints it as shown here.
 
-The code block of `typescript` has 4 functions and not 5 because `formatInvoiceNumber` is shorter than the counting bar (`--min-tokens`, 30 with `--compare`, and `--min-lines`, 5). It is still found as the partner of `format_invoice_number`.
+`billing.ts` holds five functions, but the report counts four of them, so its row says `3 / 4`. The fifth, `formatInvoiceNumber`, is shorter than the counting bar (`--min-tokens`, 30 with `--compare`, and `--min-lines`, 5). It is still found as the partner of `format_invoice_number`.
 
 ## Every pair
 
```

**File**: `rust/crates/cpd-semantic/src/extract/grammars.rs` (modified, +90/-1)
```diff
@@ -18,6 +18,23 @@ pub struct TreeSitterExtractor {
     language: LanguageFn,
     /// Node kinds that are functions; nested ones are found too.
     functions: &'static [&'static str],
+    /// How a function node shows that it has code.
+    body: Body,
+}
+
+/// How a function node shows that it has a body. A node of a function kind
+/// without one declares a function whose code is elsewhere or nowhere, such
+/// as an interface or abstract method, a Go function written in assembly or
+/// a C++ `= default`, so it takes no part.
+#[derive(Clone, Copy)]
+enum Body {
+    /// The node's `body` field.
+    Field,
+    /// A child of this kind: Kotlin's `function_body` is not a field.
+    Child(&'static str),
+    /// Every node has one. An empty Ruby method has no `body` field, but it
+    /// is a method all the same, as an empty JavaScript function is.
+    Always,
 }
 
 /// Subtrees at the start of a function node that are not its own code:
@@ -70,6 +87,7 @@ pub static C: TreeSitterExtractor = TreeSitterExtractor {
     formats: &["c"],
     language: tree_sitter_c::LANGUAGE,
     functions: &["function_definition"],
+    body: Body::Field,
 };
 
 pub static CPP: TreeSitterExtractor = TreeSitterExtractor {
@@ -79,6 +97,7 @@ pub static CPP: TreeSitterExtractor = TreeSitterExtractor {
     formats: &["cpp", "cpp-header", "c-header"],
     language: tree_sitter_cpp::LANGUAGE,
     functions: &["function_definition", "lambda_expression"],
+    body: Body::Field,
 };
 
 pub static CSHARP: TreeSitterExtractor = TreeSitterExtractor {
@@ -91,13 +110,15 @@ pub static CSHARP: TreeSitterExtractor = TreeSitterExtractor {
         "local_function_statement",
         "operator_declaration",
     ],
+    body: Body::Field,
 };
 
 pub static GO: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "go",
     formats: &["go"],
     language: tree_sitter_go::LANGUAGE,
     functions: &["function_declaration", "method_declaration", "func_literal"],
+    body: Body::Field,
 };
 
 pub static JAVA: TreeSitterExtractor = TreeSitterExtractor {
@@ -109,13 +130,15 @@ pub static JAVA: TreeSitterExtractor = TreeSitterExtractor {
         "constructor_declaration",
         "compact_constructor_declaration",
     ],
+    body: Body::Field,
 };
 
 pub static KOTLIN: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "kotlin",
     formats: &["kotlin"],
     language: tree_sitter_kotlin_ng::LANGUAGE,
     functions: &["function_declaration", "anonymous_function"],
+    body: Body::Child("function_body"),
 };
 
 pub static PHP: TreeSitterExtractor = TreeSitterExtractor {
@@ -127,27 +150,31 @@ pub static PHP: TreeSitterExtractor = TreeSitterExtractor {
         "method_declaration",
         "anonymous_function",
     ],
+    body: Body::Field,
 };
 
 pub static RUBY: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "ruby",
     formats: &["ruby"],
     language: tree_sitter_ruby::LANGUAGE,
     functions: &["method", "singleton_method"],
+    body: Body::Always,
 };
 
 pub static SCALA: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "scala",
     formats: &["scala"],
     language: tree_sitter_scala::LANGUAGE,
     functions: &["function_definition"],
+    body: Body::Field,
 };
 
 pub static SWIFT: TreeSitterExtractor = TreeSitterExtractor {
     grammar: "swift",
     formats: &["swift"],
     language: tree_sitter_swift::LANGUAGE,
     functions: &["function_declaration", "init_declaration"],
+    body: Body::Field,
 };
 
 impl FunctionExtractor for TreeSitterExtractor {
@@ -174,7 +201,7 @@ impl FunctionExtractor for TreeSitterExtractor {
         let mut cursor = tree.walk();
         'walk: loop {
             let node = cursor.node();
-            if node.is_named() && self.functions.contains(&node.kind()) {
+            if node.is_named() && self.functions.contains(&node.kind()) && self.has_body(node) {
                 let start = line_index.location(code_start(node));
                 out.push(RawFunction {
                     grammar: self.grammar,
@@ -198,6 +225,19 @@ impl FunctionExtractor for TreeSitterExtractor {
     }
 }
 
+impl TreeSitterExtractor {
+    fn has_body(&self, function: Node) -> bool {
+        match self.body {
+            Body::Field => function.child_by_field_name("body").is_some(),
+            Body::Child(kind) => {
+                let mut cursor = function.walk();
+                function.children(&mut cursor).any(|c| c.kind() == kind)
+            }
+            Body::Always => true,
+        }
+    }
+}
+
 /// The byte where a function's own code starts: its first token outside
 /// the annotations, attributes and comments it opens with.
 fn code_start(function: Node) -> usize {
@@ -432,6 +472,55 @@ mod tests {
         );
     }
 
+    #[test]
+    fn declarations_without_a_body_take_no_part() {
+        let cases: &[(&str, &str, &[&str])] = &[
+            (
+                "java",
+                "interface Shape {\n    double area();\n    default String
```

**File**: `rust/crates/cpd-tokenizer/src/functions.rs` (modified, +22/-4)
```diff
@@ -253,6 +253,10 @@ impl<'a> Visit<'a> for Extractor<'_> {
                     self.pending_call = Some((call.span.start, call.span.end));
                 }
             }
+            // A function without a body has no code to compare: an
+            // overload signature, `declare function`, an abstract method,
+            // every function of a `.d.ts` file.
+            AstKind::Function(f) if f.body.is_none() => {}
             AstKind::Function(f) => {
                 let own = f.id.as_ref().map(|id| id.name.to_string());
                 let name = match own {
@@ -281,6 +285,7 @@ impl<'a> Visit<'a> for Extractor<'_> {
 
     fn leave_node(&mut self, kind: AstKind<'a>) {
         match kind {
+            AstKind::Function(f) if f.body.is_none() => {}
             AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) => self.close(),
             AstKind::CallExpression(call)
                 if self.pending_call == Some((call.span.start, call.span.end)) =>
@@ -376,13 +381,17 @@ fn test_case(call: &oxc_ast::ast::CallExpression<'_>) -> Option<(String, u32)> {
 mod tests {
     use super::*;
 
+    /// The names of `fns`, in the order the extractor emits them.
+    fn names(fns: &[RawFunction]) -> Vec<&str> {
+        fns.iter().map(|f| f.name.as_str()).collect()
+    }
+
     const SRC: &str = "export function total(items) {\n  let sum = 0;\n  for (const it of items) { sum += it.price; }\n  return sum;\n}\nconst double = (x) => x * 2;\nclass Cart {\n  add(item) { this.items.push(item); }\n}\nconst obj = { run() { return 1; }, cb: function () { return 2; } };\n";
 
     #[test]
     fn extracts_declarations_arrows_methods_and_properties_with_names() {
         let fns = extract_functions(SRC, "javascript");
-        let names: Vec<&str> = fns.iter().map(|f| f.name.as_str()).collect();
-        assert_eq!(names, vec!["total", "double", "add", "run", "cb"]);
+        assert_eq!(names(&fns), vec!["total", "double", "add", "run", "cb"]);
         let total = &fns[0];
         assert_eq!((total.start.line, total.end.line), (1, 5));
         assert!(total.kinds.len() > 20, "{}", total.kinds.len());
@@ -403,9 +412,8 @@ mod tests {
     fn test_case_callbacks_go_by_their_titles() {
         let src = "describe('money', () => {\n  beforeEach(() => reset());\n  it('rounds  cents', () => {\n    expect(round(149)).toBe(100);\n  });\n  test.each([[1, 2]])('adds %i', (a, b) => {\n    expect(a + b).toBe(3);\n  });\n  it.only(`keeps ${'x'} dynamic`, () => {});\n  it('has no callback');\n  const later = () => 1;\n  test(\"async one\", async function () { await later(); });\n  it('named', function named() { [1].map((x) => x * 2); });\n  test.each([[() => 1]])('table', (f) => f());\n  test.describe('suite', () => {});\n  test.step('step', async () => {});\n});\n";
         let fns = extract_functions(src, "typescript");
-        let names: Vec<&str> = fns.iter().map(|f| f.name.as_str()).collect();
         assert_eq!(
-            names,
+            names(&fns),
             vec![
                 "<arrow>",
                 "rounds cents",
@@ -461,6 +469,16 @@ mod tests {
         assert_eq!(fns[0].kinds, fns[1].kinds);
     }
 
+    #[test]
+    fn declarations_without_a_body_are_not_functions() {
+        let src = "export function copy(src: string): void;\nexport function copy(src: string, dest: string): void;\nexport function copy(src: string, dest?: string): void {\n  write(src, dest);\n}\ndeclare function native(a: number): number;\nabstract class Base {\n  abstract run(): void;\n  go(a: string): void;\n  go(a: unknown) {\n    const twice = () => a;\n    return twice();\n  }\n}\n";
+        let fns = extract_functions(src, "typescript");
+        assert_eq!(names(&fns), vec!["copy", "twice", "go"]);
+        assert_eq!((fns[0].start.line, fns[0].end.line), (3, 5));
+        let declarations = "export declare function copy(\n  src: string,\n  dest: string,\n  options?: object,\n): Promise<void>;\nexport class Fs {\n  read(path: string): string;\n}\n";
+        assert!(extract_functions(declarations, "typescript").is_empty());
+    }
+
     #[test]
     fn renamed_copies_share_the_same_kind_sequence() {
         let a = extract_functions("function a(x) { return x + 1; }", "javascript");
```

**File**: `rust/crates/cpd/src/compare/html.rs` (modified, +8/-0)
```diff
@@ -177,6 +177,14 @@ mod tests {
         assert_eq!(data["functions"][1][4], 5, "counted and ready");
     }
 
+    #[test]
+    fn the_page_rounds_shares_like_the_console() {
+        // `share_percent` in compare/mod.rs computes the same expression,
+        // so the map's header and the console print the same share: 60 of
+        // 147 is 41% in both.
+        assert!(TEMPLATE.contains("Math.round((part * 100) / whole)"));
+    }
+
     #[test]
     fn the_template_is_one_self_contained_page() {
         assert!(TEMPLATE.starts_with("<!doctype html>"));
```

**File**: `rust/crates/cpd/src/compare/mod.rs` (modified, +195/-74)
```diff
@@ -325,37 +325,51 @@ impl Report {
         }
     }
 
+    /// Which sections the console and Markdown reports show: the tests when
+    /// a side has a test that counts, and the code unless only the tests
+    /// have something to report. Tests too small to count, such as the
+    /// template test of a new Android module, leave no section of zeros.
+    fn shown(&self) -> (bool, bool) {
+        let tests = self.tests.counts();
+        (self.code.counts() || !tests, tests)
+    }
+
     /// The console report: the code, then the tests, each under a heading
-    /// when both are there. Without tests on either side it is the code
-    /// section alone, as it reads without the headings.
+    /// when both are shown. Without tests it is the code section alone, as
+    /// it reads without the headings.
     fn console(&self, style: &Style, full: bool) -> String {
-        let has = |section: &Section| section.sides.iter().any(|side| !side.empty);
-        match (has(&self.code), has(&self.tests)) {
-            (_, false) => self.code.console(style, full),
-            (false, true) => format!(
-                "{}\n{}",
-                style.bold("Tests"),
-                self.tests.console(style, full)
-            ),
-            (true, true) => format!(
-                "{}\n{}\n{}\n{}",
+        let (code, tests) = self.shown();
+        if !tests {
+            return self.code.console(style, full);
+        }
+        let tests = format!(
+            "{}\n{}",
+            style.bold("Tests"),
+            self.tests.console(style, full)
+        );
+        match code {
+            true => format!(
+                "{}\n{}\n{tests}",
                 style.bold("Code"),
-                self.code.console(style, full),
-                style.bold("Tests"),
-                self.tests.console(style, full)
+                self.code.console(style, full)
             ),
+            false => tests,
         }
     }
 
     fn markdown(&self) -> String {
+        let (show_code, show_tests) = self.shown();
         let [left, right] = &self.code.sides;
         let mut out = format!(
-            "# {} compared with {}\n\n## Code\n\n",
+            "# {} compared with {}\n",
             code(&left.path),
             code(&right.path)
         );
-        out.push_str(&self.code.markdown());
-        if self.tests.sides.iter().any(|side| !side.empty) {
+        if show_code {
+            out.push_str("\n## Code\n\n");
+            out.push_str(&self.code.markdown());
+        }
+        if show_tests {
             out.push_str("\n## Tests\n\n");
             out.push_str(&self.tests.markdown());
         }
@@ -509,17 +523,27 @@ impl Section {
         }
     }
 
+    /// Whether either side has a function that counts. A pair needs one,
+    /// so a section without any has no pairs either.
+    fn counts(&self) -> bool {
+        self.sides.iter().any(|side| side.functions > 0)
+    }
+
     /// The console report; `full` adds every pair. A side with no
     /// functions, such as the target of a port not started yet, leaves
     /// nothing to list: the report is the other side's total and a note.
     fn console(&self, style: &Style, full: bool) -> String {
         let mut out = String::new();
         let [left, right] = &self.sides;
+        if !self.counts() {
+            let why = match left.empty && right.empty {
+                true => "yet",
+                false => "long enough to count",
+            };
+            let note = format!("No {} in {} or {} {why}", self.noun, left.path, right.path);
+            return format!("{}\n", style.paint(&note, YELLOW));
+        }
         match (left.empty, right.empty) {
-            (true, true) => {
-                let note = format!("No {} in {} or {} yet", self.noun, left.path, right.path);
-                return format!("{}\n", style.paint(&note, YELLOW));
-            }
             (false, true) | (true, false) => {
                 let (side, empty) = match left.empty {
                     true => (right, left),
@@ -536,10 +560,12 @@ impl Section {
                     style.paint(&note, YELLOW),
                 );
             }
-            (false, false) => {}
+            // Both sides have functions; one with none that count is a
+            // section [`Self::counts`] already turned away.
+            _ => {}
         }
         for (side, other) in [(left, right), (right, left)] {
-            let share = format!("{:>3}%", side.percentage.round());
+            let share = format!("{:>3}%", share_percent(side.matched, side.functions));
             out.push_str(&format!(
                 "{} {} of {} {} in {} have a counterpart in {}\n",
                 style.bold(&style.paint(&share, share_color(side.matched, side.functions))),
@@ -811,6 +837,17 @@ fn percentage(part: usize, whole: usize) -> f64 {
     }
 }
 
+/// A share as a whole percent for the console, rounded from the counts the
+/// way the HTML report round
```

**File**: `rust/crates/cpd/src/compare/page.html` (modified, +3/-1)
```diff
@@ -518,7 +518,9 @@ <h2>Progress by folder</h2>
   const partner = (f, p) => fns[p.a === f.i ? p.b : p.a];
   const place = (f) => files[f.file].path + ":" + f.start;
   const fmt = (n) => n.toLocaleString("en-US");
-  const pct = (part, whole) => (whole === 0 ? 0 : Math.floor((part / whole) * 100));
+  // Rounded from the counts like the console report (share_percent in
+  // compare/mod.rs), so both print the same share.
+  const pct = (part, whole) => (whole === 0 ? 0 : Math.round((part * 100) / whole));
 
   const hasTests = fns.some((f) => f.test && f.counted);
   const sideIsFile = DATA.sideIsFile || [false, false];
```

**File**: `skills/compare-codebases/SKILL.md` (modified, +2/-2)
```diff
@@ -31,9 +31,9 @@ jscpd measures tests and code apart, in two blocks of the report, and pairs a te
 - a Rust function in a `#[cfg(test)]` module or under `#[test]`;
 - a JavaScript or TypeScript test case such as `it('rounds cents', () => …)`.
 
-When neither side has tests, the report has one block and no headings.
+When neither side has a test that counts (see below), the report has one block and no headings.
 
-Totals count the functions of at least `--min-tokens` tokens and `--min-lines` lines; smaller ones appear only as partners. Anonymous functions (callbacks, closures) take no part, except JavaScript and TypeScript test cases. A test case such as `it('rounds cents', () => …)` goes by its title, and so do those written with `test`, `specify`, `fit`, `xit`, `xtest` or `bench`, with `.only`, `.skip` or `.each(table)` after them. Suites and hooks stay anonymous. jscpd does not compare types, constants, SQL or UI markup.
+Totals count the functions of at least `--min-tokens` tokens and `--min-lines` lines; smaller ones appear only as partners. Declarations without a body (TypeScript overloads, the functions of a `.d.ts` file, interface and abstract methods) take no part. Anonymous functions (callbacks, closures) take no part either, except JavaScript and TypeScript test cases. A test case such as `it('rounds cents', () => …)` goes by its title, and so do those written with `test`, `specify`, `fit`, `xit`, `xtest` or `bench`, with `.only`, `.skip` or `.each(table)` after them. Suites and hooks stay anonymous. jscpd does not compare types, constants, SQL or UI markup.
 
 ## A way to compare two folders
 
```

---

### Incident Patch 6: `c836c2b4` (2026-10-01)
**Commit Message**: docs(skills): keep vendored and build folders out of --compare

--compare embeds every function in both paths. In a JavaScript to Rust
port, `cargo vendor` put about 2,000 Rust files from the dependencies
into the target, and the first run took tens of minutes instead of
seconds. The percentages also counted the dependencies as part of the
port.

The code-migration skill now tells the agent to check both paths for
vendored dependencies, installed packages and build output, and to
suggest a .gitignore to the user. jscpd reads .gitignore only inside a
git repository, so the skill also says to pass the same folders with
--ignore until the .gitignore takes effect. compare-codebases claimed
that jscpd always skips what .gitignore excludes; it now says this holds
only inside a repository.

**File**: `skills/code-migration/SKILL.md` (modified, +28/-1)
```diff
@@ -32,6 +32,32 @@ Pick the two paths and keep them fixed for the whole port: the source first, the
 
 One run measures both phases: the report has a `Code` block and a `Tests` block (a `code` and a `tests` section in JSON), and a test pairs only with a test. jscpd tells a test by the conventions of its language: test files such as `*_test.go`, `test_*.py`, `*.test.ts` or `*Test.java`, folders such as `tests/`, `__tests__/` or `src/test/`, Rust tests in `#[cfg(test)]` modules, and JavaScript test cases such as `it('rounds cents', () => …)`. Phase 1 reads the `Tests` block, phase 2 the `Code` block.
 
+### Keep vendored and generated code out
+
+`--compare` counts and embeds every function in both paths. Vendored dependencies (`vendor/` from `cargo vendor` or `go mod vendor`, `third_party/`), installed packages (`node_modules/`, `.venv/`), build output (`target/`, `build/`, `dist/`) and generated code are not part of the port, yet a vendored crate tree alone holds thousands of functions. With them in a path, the first run embeds all of them and takes tens of minutes instead of seconds, and the percentages describe the dependencies instead of the port.
+
+jscpd skips what `.gitignore` excludes, but only inside a git repository. Before the first run:
+
+1. Check both paths for such folders. A target you create for the port gets them as soon as you build it or vendor its dependencies, so check again after the first build.
+2. Suggest a `.gitignore` to the user that lists the folders the target's language and tools produce, plus the report folder. For a Rust addon built with napi-rs:
+
+   ```gitignore
+   /target/
+   /vendor/
+   node_modules/
+   *.node
+   .jscpd-compare/
+   ```
+
+   If the target is not in a git repository, tell the user that jscpd reads the `.gitignore` only after `git init`.
+3. Until the `.gitignore` works, pass the same folders with `--ignore`, and keep the globs the same for every run:
+
+   ```bash
+   npx jscpd --compare node-lib/ rust-lib/ --ignore "**/vendor/**,**/target/**,**/node_modules/**"
+   ```
+
+The totals line shows when something slipped through. Suspect vendored or generated code in a path when the target has far more functions than the source, or when a run embeds hundreds of functions after a small change.
+
 ## Measure
 
 Run the console report for yourself and for the user. Here a Python billing library is being ported to TypeScript:
@@ -159,14 +185,15 @@ A function listed only in the target that you know is a port of a source functio
 ## Options
 
 - `--min-tokens` (30 with `--compare`) and `--min-lines` (5) decide which functions count toward the totals. Smaller functions still pair as partners. Raise them to focus on substantial functions, and keep them fixed across runs so percentages compare.
-- `--ignore` leaves files out, such as generated code or fixtures; `--pattern` narrows the comparison to some files, such as the tests of one module. Keep the globs fixed across runs.
+- `--ignore` leaves files out, such as vendored dependencies, build output, generated code or fixtures (see [Keep vendored and generated code out](#keep-vendored-and-generated-code-out)); `--pattern` narrows the comparison to some files, such as the tests of one module. Keep the globs fixed across runs.
 - `--format` narrows the walk to some languages, for example when the source mixes the code being ported with build scripts.
 - `--semantic-model` and `--semantic-url` pick another embedding model or an OpenAI-compatible API (`npx jscpd --semantic-models` lists the models with calibrated thresholds). Keep the model fixed across runs, because each model scores on its own scale.
 - The exit code is 0 whatever the progress, so the command does not fail a build on its own.
 
 ## Rules
 
 - Keep the two paths, their order, the options and the model the same from run to run, or the numbers stop being comparable.
+- Keep vendored dependencies, installed packages and build output out of both paths: through a `.gitignore` in a git repository, which you suggest to the user, or with `--ignore`.
 - Port the tests before the code, and a function only together with the tests the coverage map binds to it.
 - Treat the report as a map of what to read and what is left. It does not prove the port is correct; tests do.
 - Never game the percentage: no stubs, no renames made only for jscpd, no deleting source functions to shrink the denominator without the user's decision.
```

**File**: `skills/compare-codebases/SKILL.md` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ Totals count the functions of at least `--min-tokens` tokens and `--min-lines` l
 
 ### 1. Pick the folders
 
-- Point at the code, not the repositories: `app/src/main/java` and `ios/Sources`, not the two repository roots. Build output, vendored code and generated files dilute the result; jscpd already skips what `.gitignore` excludes, and `--ignore` takes more globs.
+- Point at the code, not the repositories: `app/src/main/java` and `ios/Sources`, not the two repository roots. Build output, vendored code, installed packages and generated files dilute the result, and a vendored dependency tree can turn a run of seconds into one of tens of minutes, since every function in it is embedded. Inside a git repository jscpd skips what `.gitignore` excludes; outside one, or for folders the `.gitignore` misses, pass them with `--ignore` (`--ignore "**/vendor/**,**/target/**,**/node_modules/**"`). When a side has no `.gitignore` entries for such folders, suggest them to the user.
 - Two folders are required, and they must not overlap: `app/` and `app/android/` is refused.
 - Keep parallel structures when you can (`ios/<module>` and `android/<module>`). Modules steer the name step, so matching folder names help.
 - For a port, put the source first and the target second, so the first line of the report is the port's progress. For two implementations that both live on, the order does not matter.
```

---

### Incident Patch 7: `35f7b386` (2026-09-30)
**Commit Message**: Merge pull request #1123 from kucherenko/fix/crates-publish-index-lag

fix(ci): retry cargo publish while crates.io's index catches up

**File**: `.github/workflows/crates-publish.yml` (modified, +19/-1)
```diff
@@ -191,7 +191,25 @@ jobs:
               continue
             fi
 
-            if ! cargo publish --locked -p "${crate}" --allow-dirty; then
+            # crates.io serves its index through a CDN that can lag behind the
+            # API: a crate published a minute ago may not resolve yet as a
+            # dependency of the next one, even after the wait below (5.4.0
+            # stopped on cpd-semantic that way). Only that error is retried.
+            published=false
+            for attempt in $(seq 1 10); do
+              if cargo publish --locked -p "${crate}" --allow-dirty 2>&1 | tee "$RUNNER_TEMP/publish.log"; then
+                published=true
+                break
+              fi
+              if grep -q "failed to select a version" "$RUNNER_TEMP/publish.log"; then
+                echo "A dependency of ${crate} is not in the crates.io index yet; retrying in 30 s (attempt ${attempt}/10)"
+                sleep 30
+                continue
+              fi
+              break
+            done
+
+            if [ "$published" != true ]; then
               # Another run may have published it in the meantime; anything
               # else is a real failure. Continuing would only make every
               # crate that depends on this one fail too, and the job would
```

---

### Incident Patch 8: `e4d26b29` (2026-09-30)
**Commit Message**: fix(ci): retry cargo publish while crates.io's index catches up

The 5.4.0 release stopped on cpd-semantic: cpd-finder 0.1.20 had been
published and the API reported it, but the index cargo reads through a
CDN did not have it yet, so cargo could not resolve the dependency.
cargo publish now tries again every 30 seconds, up to 10 times, when it
fails that way; any other failure still fails the job at once.

**File**: `.github/workflows/crates-publish.yml` (modified, +19/-1)
```diff
@@ -191,7 +191,25 @@ jobs:
               continue
             fi
 
-            if ! cargo publish --locked -p "${crate}" --allow-dirty; then
+            # crates.io serves its index through a CDN that can lag behind the
+            # API: a crate published a minute ago may not resolve yet as a
+            # dependency of the next one, even after the wait below (5.4.0
+            # stopped on cpd-semantic that way). Only that error is retried.
+            published=false
+            for attempt in $(seq 1 10); do
+              if cargo publish --locked -p "${crate}" --allow-dirty 2>&1 | tee "$RUNNER_TEMP/publish.log"; then
+                published=true
+                break
+              fi
+              if grep -q "failed to select a version" "$RUNNER_TEMP/publish.log"; then
+                echo "A dependency of ${crate} is not in the crates.io index yet; retrying in 30 s (attempt ${attempt}/10)"
+                sleep 30
+                continue
+              fi
+              break
+            done
+
+            if [ "$published" != true ]; then
               # Another run may have published it in the meantime; anything
               # else is a real failure. Continuing would only make every
               # crate that depends on this one fail too, and the job would
```

---

### Incident Patch 9: `7f565c8b` (2026-09-30)
**Commit Message**: fix(lsp): a file written during a background run waits for the next one

A snapshot taken after a run could describe a newer text than the one
the run read, when the file was saved again meanwhile, and the findings
then showed at stale offsets until the next run. A file modified after
the run started now gets no snapshot, so its findings stay hidden until
the run that read its new text.

**File**: `rust/crates/cpd/src/lsp/dead_code.rs` (modified, +2/-1)
```diff
@@ -39,6 +39,7 @@ pub struct Run {
 
 /// Run basta and resolve each finding to its file.
 pub fn run(config: &basta::config::BastaConfig) -> Run {
+    let started = std::time::SystemTime::now();
     let result = basta::analyze::run(config);
     let graph = &result.graph;
     // A report names a file relative to its root, and two roots can each
@@ -77,7 +78,7 @@ pub fn run(config: &basta::config::BastaConfig) -> Run {
         .map(|(path, _)| path)
         .collect::<HashSet<_>>()
         .into_iter()
-        .filter_map(|path| Some((path.clone(), Snapshot::of_disk(path)?)))
+        .filter_map(|path| Some((path.clone(), Snapshot::of_disk(path, started)?)))
         .collect();
     Run {
         findings,
```

**File**: `rust/crates/cpd/src/lsp/findings.rs` (modified, +10/-2)
```diff
@@ -116,8 +116,16 @@ pub struct Snapshot {
 }
 
 impl Snapshot {
-    /// The file at `path` as it is on disk now.
-    pub fn of_disk(path: &Path) -> Option<Self> {
+    /// The file at `path` as a run that started at `started` read it: the
+    /// file as it is on disk now, when nothing wrote it since the start.
+    /// A file written during the run may have been read before or after
+    /// the write, so it has no snapshot, and its findings wait for the next
+    /// run.
+    pub fn of_disk(path: &Path, started: std::time::SystemTime) -> Option<Self> {
+        let modified = std::fs::metadata(path).ok()?.modified().ok()?;
+        if modified > started {
+            return None;
+        }
         let text = Text::from_disk(std::fs::read_to_string(path).ok()?);
         Some(Self {
             hash: text.hash(),
```

**File**: `rust/crates/cpd/src/lsp/server.rs` (modified, +2/-1)
```diff
@@ -1614,6 +1614,7 @@ fn semantic_clones(
     excluded: &[PathBuf],
     options: &cpd_semantic::SemanticOptions,
 ) -> Result<SemanticRun, String> {
+    let started = std::time::SystemTime::now();
     let embedder = cpd_semantic::embedder(options, &run.paths, true)?;
     let mut config = run.clone();
     // The index finds the other kinds; this run is for the pairs alone.
@@ -1636,7 +1637,7 @@ fn semantic_clones(
         .map(|id| PathBuf::from(host_file(id)))
         .collect::<BTreeSet<_>>()
         .into_iter()
-        .filter_map(|path| Some((path.clone(), Snapshot::of_disk(&path)?)))
+        .filter_map(|path| Some((path.clone(), Snapshot::of_disk(&path, started)?)))
         .collect();
     Ok(SemanticRun { clones, snapshots })
 }
```

---

### Incident Patch 10: `249e78a8` (2026-09-30)
**Commit Message**: docs(lsp): the editors page follows the review fixes

Ignored files and folders, findings hidden after an unsaved edit, the
refused --config and paths, settings mistakes shown to the user, the
safer placement of the ignore markers, the Sublime LSP key
initialization_options, and two limits: a search per edit over a very
large pool, and followSymlinks.

**File**: `docs/editors.md` (modified, +14/-10)
```diff
@@ -1,6 +1,6 @@
 # Editors
 
-`jscpd --lsp` runs jscpd as a language server on stdin and stdout. An editor starts it for a workspace, and the server reports what jscpd finds as diagnostics in the files you edit. The diagnostics follow the text in the editor, saved or not: after you stop typing for 300 ms, the server tokenizes the file again from the buffer and searches its pool again. Files that change outside the editor, such as in a `git checkout`, reach the server when the editor watches files for it; the server reads them again and searches each pool they touch once.
+`jscpd --lsp` runs jscpd as a language server on stdin and stdout. An editor starts it for a workspace, and the server reports what jscpd finds as diagnostics in the files you edit. The diagnostics follow the text in the editor, saved or not: after you stop typing for 300 ms, the server tokenizes the file again from the buffer and searches its pool again. Files that change outside the editor, such as in a `git checkout`, reach the server when the editor watches files for it; the server reads them again and searches each pool they touch once. A folder deleted or moved in one piece counts for the files under it, and files the scan skips (ignored by `.gitignore` or `.ignore`, or over `maxSize`) stay out, whether they appear on disk or open in the editor.
 
 The server runs five analyses. Only clones are on unless you turn the others on:
 
@@ -81,7 +81,7 @@ With the [LSP](https://packagecontrol.io/packages/LSP) package, in Preferences >
 }
 ```
 
-The editor's settings go in `initializationOptions`.
+The editor's settings go in `initialization_options`.
 
 ### Emacs
 
@@ -115,7 +115,7 @@ The `.jscpd.json` files split the workspace into projects, and the server looks
 - Each `.jscpd.json` makes its folder a project with that config. A config in a subfolder of another project splits that subfolder out, so a file belongs to the project of the nearest config above it.
 - The files under no config form one more project, with the defaults.
 
-When it starts, the server looks for `.jscpd.json` files, skipping `.git`, `node_modules` and what git ignores, and it scans the workspace again when the editor reports that a config appeared, changed or went away. Only `.jscpd.json` makes a project: the server does not read `.config/jscpd.json` or the `jscpd` key of `package.json`, which the CLI also reads.
+When it starts, the server looks for `.jscpd.json` files, skipping `.git`, `node_modules` and what git ignores. It scans the workspace again when a config is saved in the editor, and when the editor reports that a config, a `.gitignore` or an `.ignore` file appeared, changed or went away. Only `.jscpd.json` makes a project: the server does not read `.config/jscpd.json` or the `jscpd` key of `package.json`, which the CLI also reads.
 
 A `.jscpd.json` that is not valid JSON leaves its project on the defaults, and the editor shows the parse error. A key in the `semantic` section that looks like a secret, such as `apiKey`, stops the project: the editor shows why, and the project gets no diagnostics until the key is gone. Other warnings about a config, such as an unknown key, go to the editor's log.
 
@@ -127,7 +127,9 @@ Options come from three places, and each wins over the one before it:
 2. The project's `.jscpd.json`.
 3. The editor's settings, which the editor sends when it starts the server (`initializationOptions`) and when they change (`workspace/didChangeConfiguration`). They take the keys of `.jscpd.json`, at the top level or under a `jscpd` key, and apply to every project on top of its config.
 
-A change to a config file or to the editor's settings applies at once, without a restart. jscpd refuses `--semantic`, `--dead-code` and `--complexity` together with `--lsp`; turn those analyses on with `--lsp-analyses` or in the `lsp` section instead.
+A change to a config file or to the editor's settings applies at once, without a restart. jscpd refuses `--semantic`, `--dead-code` and `--complexity` together with `--lsp`; turn those analyses on with `--lsp-analyses` or in the `lsp` section instead. It refuses `--config` and paths too: each project reads its own `.jscpd.json`, and the folders come from the editor.
+
+A mistake in the `lsp` settings of the editor, such as an unknown key, is shown to the user, and those settings are left out while the `lsp` section of each config still applies.
 
 ### The `lsp` section
 
@@ -160,14 +162,14 @@ The other options of each analysis stay where the CLI reads them: detection opti
 
 ### Clones
 
-Each fragment of a clone in an open file gets a warning over its range, as in SARIF, and a clone within one file gets one on each of its ranges. The message names the other copy, such as `Duplicated in src/holds.js:4-13 (80 tokens)`, or all of them when a block has several: `Duplicated in 3 places: ...`. Editors that support `relatedInformation` also list each copy as a link.
+Each fragment of a clone in an open file gets a 
```

---

### Incident Patch 11: `d4c6a7fa` (2026-09-30)
**Commit Message**: fix(lsp): what a review of the server found

Four reviews of #1121 (the server, the index and projects, positions and
findings, the public API) turned up these, each reproduced first.

Public API
- RunConfig and WalkConfig keep the fields they were released with: a new
  field broke struct literals in jscpd 5.3.3 and basta 0.3.0 against a
  patch release of cpd-finder. The folders of nested projects now go to
  walk_excluding, prepare_files_in and run_excluding as an argument.

Index and projects
- A file that .gitignore, .ignore or maxSize leaves out of the walk no
  longer joins the index when it appears on disk or opens in the editor;
  after an npm install the index had grown from 11 files to 1,823.
- A folder deleted or moved in one event counts for the files under it.
- A file that changes on disk is updated in every project whose scan
  reaches it, not only the project of the nearest config.
- Open files, pending edits and watched changes are updated in one batch,
  one search per pool: a rescan with four open files took 41 s, now 11 s.
- An opened file whose tokens match the index skips the search.
- Relative skipIsolated folders are the config folder's, not the
  server's 

**File**: `rust/crates/basta/src/analyze.rs` (modified, +0/-1)
```diff
@@ -239,7 +239,6 @@ fn discover(config: &BastaConfig) -> Vec<cpd_finder::walker::DiscoveredFile> {
         formats_exts: config.formats_exts.clone(),
         formats_names: Default::default(),
         pattern: None,
-        exclude_dirs: Vec::new(),
     };
     walk(&walk_config)
 }
```

**File**: `rust/crates/cpd-finder/src/orchestrate.rs` (modified, +26/-13)
```diff
@@ -2,7 +2,7 @@
 
 use crate::pass::{ClonePass, PassContext, PassSource};
 use crate::statistics;
-use crate::walker::{WalkConfig, walk};
+use crate::walker::{WalkConfig, walk_excluding};
 use cpd_core::detect::{
     PathFilters, PathLabel, PreparedSource, detect_prepared, merge_gapped_clones,
 };
@@ -61,8 +61,6 @@ pub struct RunConfig {
     /// [`crate::pass`]); `--semantic` adds one. Empty: none runs, and no
     /// file is read for them.
     pub passes: Vec<Arc<dyn ClonePass>>,
-    /// Folders the walk leaves out (see [`WalkConfig::exclude_dirs`]).
-    pub exclude_dirs: Vec<PathBuf>,
 }
 
 impl Default for RunConfig {
@@ -95,7 +93,6 @@ impl Default for RunConfig {
             cross_formats: vec![],
             kinds: vec![],
             passes: vec![],
-            exclude_dirs: vec![],
         }
     }
 }
@@ -171,13 +168,25 @@ pub fn build_thread_pool(workers: Option<usize>) -> rayon::ThreadPool {
 /// Fails only when a clone pass of `config.passes` fails; without one,
 /// `run(&config).unwrap()` never panics.
 pub fn run(config: &RunConfig) -> Result<RunResult, RunError> {
+    run_excluding(config, &[])
+}
+
+/// [`run`], leaving out the folders `exclude_dirs` (see
+/// [`crate::walker::walk_excluding`]).
+pub fn run_excluding(config: &RunConfig, exclude_dirs: &[PathBuf]) -> Result<RunResult, RunError> {
     let pool = build_thread_pool(config.workers);
 
     // 1-2. Walk + tokenize.
-    let PreparedScan {
-        sources: source_files,
-        prepared: prepared_sources,
-    } = prepare_scan_in(&pool, config);
+    let (source_files, prepared_sources) = prepare_files_in(&pool, config, exclude_dirs)
+        .into_iter()
+        .fold(
+            (Vec::new(), Vec::new()),
+            |(mut ss, mut ps): (Vec<SourceFile>, Vec<PreparedSource>), file| {
+                ss.extend(file.sources);
+                ps.extend(file.prepared);
+                (ss, ps)
+            },
+        );
 
     // Function signatures must be taken before the pools consume the
     // prepared sources; empty unless --similarity is set.
@@ -285,7 +294,7 @@ pub fn canonicalize_all(paths: &[std::path::PathBuf]) -> Vec<std::path::PathBuf>
 /// [`run`]; callers that need to keep prepared sources around (e.g. the MCP
 /// server's snippet checks) use it directly and run detection themselves.
 pub fn prepare_scan_in(pool: &rayon::ThreadPool, config: &RunConfig) -> PreparedScan {
-    let (sources, prepared) = prepare_files_in(pool, config).into_iter().fold(
+    let (sources, prepared) = prepare_files_in(pool, config, &[]).into_iter().fold(
         (Vec::new(), Vec::new()),
         |(mut ss, mut ps): (Vec<SourceFile>, Vec<PreparedSource>), file| {
             ss.extend(file.sources);
@@ -322,14 +331,18 @@ pub fn walk_config(config: &RunConfig) -> WalkConfig {
         formats_exts: config.formats_exts.clone(),
         formats_names: config.formats_names.clone(),
         pattern: config.pattern.clone(),
-        exclude_dirs: config.exclude_dirs.clone(),
     }
 }
 
-/// [`prepare_scan_in`], file by file.
-pub fn prepare_files_in(pool: &rayon::ThreadPool, config: &RunConfig) -> Vec<PreparedFile> {
+/// [`prepare_scan_in`], file by file, leaving out the folders `exclude_dirs`
+/// (see [`crate::walker::walk_excluding`]).
+pub fn prepare_files_in(
+    pool: &rayon::ThreadPool,
+    config: &RunConfig,
+    exclude_dirs: &[PathBuf],
+) -> Vec<PreparedFile> {
     // 1. Walk files
-    let discovered = walk(&walk_config(config));
+    let discovered = walk_excluding(&walk_config(config), exclude_dirs);
 
     // 2. Read + tokenize files in parallel.
     use rayon::prelude::*;
```

**File**: `rust/crates/cpd-finder/src/walker.rs` (modified, +126/-12)
```diff
@@ -23,10 +23,6 @@ pub struct WalkConfig {
     pub formats_exts: HashMap<String, Vec<String>>,
     pub formats_names: HashMap<String, Vec<String>>,
     pub pattern: Option<String>,
-    /// Folders the walk leaves out, whole: `--lsp` gives each nested project
-    /// its own scan. Absolute paths, compared with the walked paths of an
-    /// absolute root.
-    pub exclude_dirs: Vec<PathBuf>,
 }
 
 #[derive(Debug)]
@@ -105,9 +101,16 @@ fn build_ignore_glob_set(patterns: &[String]) -> GlobSet {
 }
 
 pub fn walk(config: &WalkConfig) -> Vec<DiscoveredFile> {
+    walk_excluding(config, &[])
+}
+
+/// [`walk`], leaving out the folders `exclude_dirs` whole: `--lsp` gives each
+/// nested project a scan of its own. The folders are absolute paths,
+/// compared with the walked paths of an absolute root.
+pub fn walk_excluding(config: &WalkConfig, exclude_dirs: &[PathBuf]) -> Vec<DiscoveredFile> {
     let mut results = Vec::new();
     for root in &config.paths {
-        walk_one(root, config, &mut results);
+        walk_one(root, config, exclude_dirs, &mut results);
     }
     if config.follow_symlinks || config.paths.len() > 1 {
         dedup_by_real_path(&mut results);
@@ -142,13 +145,18 @@ fn anchor_at_root(path: &Path, root: &Path, root_canon: &Path) -> PathBuf {
     }
 }
 
-fn walk_one(root: &Path, config: &WalkConfig, results: &mut Vec<DiscoveredFile>) {
+fn walk_one(
+    root: &Path,
+    config: &WalkConfig,
+    exclude_dirs: &[PathBuf],
+    results: &mut Vec<DiscoveredFile>,
+) {
     let mut builder = WalkBuilder::new(root);
     builder.follow_links(config.follow_symlinks);
     builder.git_ignore(!config.no_gitignore);
     builder.hidden(false);
-    if !config.exclude_dirs.is_empty() {
-        let excluded = config.exclude_dirs.clone();
+    if !exclude_dirs.is_empty() {
+        let excluded = exclude_dirs.to_vec();
         builder.filter_entry(move |entry| !excluded.iter().any(|dir| entry.path() == dir));
     }
 
@@ -266,10 +274,11 @@ fn walk_one(root: &Path, config: &WalkConfig, results: &mut Vec<DiscoveredFile>)
 }
 
 /// Whether a walk with `config` would take the file at `path`, under the scan
-/// root `root`, and in which format. The format filters, `--pattern` and
-/// `--ignore` apply; `.gitignore`, the size limit and symlinks do not: a
-/// language server asks this about a file an editor has open, which may not
-/// even be on disk yet.
+/// root `root`, and in which format: the format filters, `--pattern`,
+/// `--ignore`, the ignore files (see [`ignored_by_files`]) and, for a file on
+/// disk, the size limit. A language server asks this about a file an editor
+/// has open, which may not be on disk yet, and about files that appear
+/// while it runs.
 pub fn accepts(path: &Path, root: &Path, config: &WalkConfig) -> Option<String> {
     if let Some(pattern) = config.pattern.as_deref() {
         let set = build_positive_glob_set(pattern);
@@ -288,9 +297,88 @@ pub fn accepts(path: &Path, root: &Path, config: &WalkConfig) -> Option<String>
     if !ignore.is_empty() && ignore.is_match(path) {
         return None;
     }
+    if let Some(max) = config.max_size
+        && std::fs::metadata(path).is_ok_and(|meta| meta.len() > max)
+    {
+        return None;
+    }
+    if ignored_by_files(path, root, false, config.no_gitignore) {
+        return None;
+    }
     Some(format)
 }
 
+/// Whether the ignore files leave `path` out of a walk from `root`, as they
+/// do in the walk itself: `.ignore` files, and inside a git repository its
+/// `.gitignore` files and `.git/info/exclude` (unless `no_gitignore`). A
+/// walk checks every entry below its root and skips an ignored folder whole,
+/// so the folders between `root` and `path` count as well as `path`; `root`
+/// itself and the folders above it do not. The nearest ignore file decides,
+/// and `.ignore` beats `.gitignore` in one folder.
+pub fn ignored_by_files(path: &Path, root: &Path, is_dir: bool, no_gitignore: bool) -> bool {
+    use ignore::gitignore::{Gitignore, GitignoreBuilder};
+    let Ok(below) = path.strip_prefix(root) else {
+        return false;
+    };
+    let repo = root
+        .ancestors()
+        .find(|dir| dir.join(".git").exists())
+        .filter(|_| !no_gitignore);
+    let mut loaded: HashMap<PathBuf, Option<Gitignore>> = HashMap::new();
+    let mut load = |file: PathBuf, dir: &Path| -> Option<Gitignore> {
+        loaded
+            .entry(file.clone())
+            .or_insert_with(|| {
+                if !file.is_file() {
+                    return None;
+                }
+                let mut builder = GitignoreBuilder::new(dir);
+                builder.add(&file);
+                builder.build().ok().filter(|gi| !gi.is_empty())
+            })
+            .clone()
+    };
+    let mut entry = root.to_path_buf();
+    let names: Vec<_> = below.components().collect();
+    for (i, name) in names.iter().enumerate() {
+        entry.push(name);
+        let entry_is_dir = is_d
```

**File**: `rust/crates/cpd/src/cli.rs` (modified, +1/-1)
```diff
@@ -476,7 +476,7 @@ pub struct Cli {
     /// edits, updated as the text changes. Clones by default; --lsp-analyses
     /// picks the analyses. Each .jscpd.json in the workspace is a project of
     /// its own
-    #[arg(long, conflicts_with_all = ["mcp", "compare", "dashboard", "health", "history", "history_since"])]
+    #[arg(long, conflicts_with_all = ["mcp", "compare", "dashboard", "health", "history", "history_since", "config", "paths"])]
     pub lsp: bool,
 
     /// The analyses --lsp runs, comma-separated: clones, ast (similar
```

**File**: `rust/crates/cpd/src/dead_code.rs` (modified, +42/-17)
```diff
@@ -77,6 +77,27 @@ pub fn config(
     paths: &[PathBuf],
     strict: bool,
 ) -> Result<Option<BastaConfig>, i32> {
+    let mut notes = Vec::new();
+    let config = config_noting(cli, opts, paths, strict, true, &mut notes);
+    for note in notes {
+        eprintln!("{note}");
+    }
+    config.map_err(|()| 1)
+}
+
+/// [`config`], with its errors and warnings (`Error: …`, `Warning: …`) in
+/// `notes` rather than on stderr, for `--lsp`, whose output is the
+/// protocol's. Without `rust`, Rust diagnostics are left out: the language
+/// server leaves Rust to rust-analyzer, and a `-` for them would read the
+/// protocol's stdin.
+pub(crate) fn config_noting(
+    cli: &Cli,
+    opts: &Options,
+    paths: &[PathBuf],
+    strict: bool,
+    rust: bool,
+    notes: &mut Vec<String>,
+) -> Result<Option<BastaConfig>, ()> {
     // A bad --dead-code-categories or --min-confidence is a refusal (or, for
     // confidence, a clamp-with-warning) whether or not a dead-code section
     // ends up running at all: they are the same option misused, not a
@@ -92,8 +113,8 @@ pub fn config(
         match raw.parse::<Category>() {
             Ok(category) => categories.push(category),
             Err(message) => {
-                eprintln!("Error: --dead-code-categories: {message}");
-                return Err(1);
+                notes.push(format!("Error: --dead-code-categories: {message}"));
+                return Err(());
             }
         }
     }
@@ -107,9 +128,9 @@ pub fn config(
     // so the same clamp belongs here too.
     let min_confidence = match cli.min_confidence.or(opts.min_confidence) {
         Some(value) if value > 100 => {
-            eprintln!(
+            notes.push(format!(
                 "Warning: --min-confidence: {value} is above 100, which would hide every finding; using 100"
-            );
+            ));
             100
         }
         Some(value) => value,
@@ -126,21 +147,21 @@ pub fn config(
         .cloned()
         .partition(|f| supported.contains(&f.as_str()));
     if strict && !skipped.is_empty() {
-        eprintln!(
+        notes.push(format!(
             "Warning: --dead-code does not analyze {}; it supports {}",
             skipped.join(", "),
             supported.join(", ")
-        );
+        ));
     }
     if !opts.formats.is_empty() && formats.is_empty() {
         if !strict {
             return Ok(None);
         }
-        eprintln!(
+        notes.push(format!(
             "Error: --format selected no format --dead-code can analyze (supported: {})",
             supported.join(", ")
-        );
-        return Err(1);
+        ));
+        return Err(());
     }
 
     // jscpd has no flags of its own for frameworks; the config file's
@@ -156,9 +177,9 @@ pub fn config(
     });
     if !problems.is_empty() {
         for problem in problems {
-            eprintln!("Error: dead-code frameworks: {problem}");
+            notes.push(format!("Error: dead-code frameworks: {problem}"));
         }
-        return Err(1);
+        return Err(());
     }
 
     Ok(Some(BastaConfig {
@@ -189,7 +210,10 @@ pub fn config(
         formats,
         formats_exts: opts.formats_exts.clone(),
         // A file only: jscpd's stdin is not basta's to read.
-        rust_diagnostics: rust_diagnostics(cli, opts)?,
+        rust_diagnostics: match rust {
+            true => rust_diagnostics(cli, opts, notes)?,
+            false => None,
+        },
     }))
 }
 
@@ -199,7 +223,8 @@ pub fn config(
 fn rust_diagnostics(
     cli: &Cli,
     opts: &Options,
-) -> Result<Option<basta::config::RustDiagnostics>, i32> {
+    notes: &mut Vec<String>,
+) -> Result<Option<basta::config::RustDiagnostics>, ()> {
     let (path, what) = match (
         &cli.rust_diagnostics,
         &opts.dead_code_section.rust_diagnostics,
@@ -213,8 +238,8 @@ fn rust_diagnostics(
         return match std::io::Read::read_to_string(&mut std::io::stdin(), &mut text) {
             Ok(_) => Ok(Some(basta::config::RustDiagnostics { text, base: None })),
             Err(error) => {
-                eprintln!("Error: {what}: could not read stdin: {error}");
-                Err(1)
+                notes.push(format!("Error: {what}: could not read stdin: {error}"));
+                Err(())
             }
         };
     }
@@ -228,8 +253,8 @@ fn rust_diagnostics(
             ),
         })),
         Err(error) => {
-            eprintln!("Error: {what}: {}: {error}", path.display());
-            Err(1)
+            notes.push(format!("Error: {what}: {}: {error}", path.display()));
+            Err(())
         }
     }
 }
```

**File**: `rust/crates/cpd/src/lsp/complexity.rs` (modified, +45/-1)
```diff
@@ -46,7 +46,21 @@ pub fn complexity_findings(
     if cpd_semantic::units::supports_units(format) {
         for map in cpd_semantic::units::extract_units(&text.text, format) {
             for unit in map.units {
-                let cx = span_complexity(&tokens, &map.format, unit.start.offset, unit.end.offset);
+                let (start, end) = (unit.start.offset, unit.end.offset);
+                let cx = match map.format == format {
+                    true => span_complexity(&tokens, &map.format, start, end),
+                    // A block of a component (the script of a Vue file, the
+                    // frontmatter of an Astro one): the tokens of the whole
+                    // file count their offsets from the start of each block,
+                    // so the function is tokenized on its own.
+                    false => {
+                        let Some(body) = text.text.get(start as usize..end as usize) else {
+                            continue;
+                        };
+                        let tokens = tokenize(&map.format, body, mode);
+                        span_complexity(&tokens, &map.format, 0, end - start)
+                    }
+                };
                 if cx <= u64::from(limits.function) {
                     continue;
                 }
@@ -131,4 +145,34 @@ mod tests {
         assert_eq!(findings[0].rule, COMPLEX_FILE);
         assert_eq!(findings[0].range.start.line, 0);
     }
+
+    #[test]
+    fn a_function_in_a_component_counts_its_own_branches() {
+        let body = "function busy(a, b, c) {\n  if (a && b) { return 1; }\n  if (b || c) { return 2; }\n  for (const x of a) { if (x) { return 3; } }\n  return c ?? 4;\n}\n";
+        let limits = Limits {
+            function: 0,
+            file: 1000,
+        };
+        let plain = complexity_findings(
+            &Text::new(body.to_string()),
+            "javascript",
+            Mode::Mild,
+            &limits,
+            Encoding::Utf16,
+        );
+        let component = format!(
+            "<template>\n  <div>{{{{ a }}}}</div>\n</template>\n\n<script>\n{body}</script>\n"
+        );
+        let vue = complexity_findings(
+            &Text::new(component),
+            "vue",
+            Mode::Mild,
+            &limits,
+            Encoding::Utf16,
+        );
+        assert_eq!(plain.len(), 1);
+        assert_eq!(vue.len(), 1, "{vue:?}");
+        assert_eq!(vue[0].message, plain[0].message);
+        assert_eq!(vue[0].range.start.line, 5);
+    }
 }
```

**File**: `rust/crates/cpd/src/lsp/dead_code.rs` (modified, +81/-29)
```diff
@@ -3,73 +3,125 @@
 //! can change what is unused anywhere; the analysis runs in the background
 //! after the save, and its findings replace the project's last ones.
 
-use super::findings::{Finding, Text};
+use super::findings::{Finding, Snapshot, Text};
 use super::position::Encoding;
 use super::project::Project;
 use super::settings::Analysis;
 use cpd_core::deadcode::{Category, Finding as DeadFinding};
 use lsp_types::DiagnosticSeverity;
+use std::collections::{HashMap, HashSet};
 use std::path::{Path, PathBuf};
 
 /// basta's configuration for `project`, or `None` when the project has no
-/// file basta reads (JavaScript, TypeScript, Python and their components).
-pub fn config_of(project: &Project) -> Option<basta::config::BastaConfig> {
-    crate::dead_code::config(
+/// file basta reads (JavaScript, TypeScript, Python and their components)
+/// or its dead-code options are wrong; the errors and warnings of the
+/// options come along, for the editor to show. Rust is left to
+/// rust-analyzer.
+pub fn config_of(project: &Project) -> (Option<basta::config::BastaConfig>, Vec<String>) {
+    let mut notes = Vec::new();
+    let config = crate::dead_code::config_noting(
         &project.cli,
         &project.options,
         &project.options.paths,
         false,
-    )
-    .ok()
-    .flatten()
+        false,
+        &mut notes,
+    );
+    (config.ok().flatten(), notes)
+}
+
+/// What a run found: the findings by file, and the files as the run read
+/// them.
+pub struct Run {
+    pub findings: Vec<(PathBuf, DeadFinding)>,
+    pub snapshots: HashMap<PathBuf, Snapshot>,
 }
 
-/// Run basta and resolve each finding to its file. Findings in the folders
-/// of other projects are left to those projects.
-pub fn run(config: &basta::config::BastaConfig) -> Vec<(PathBuf, DeadFinding)> {
+/// Run basta and resolve each finding to its file.
+pub fn run(config: &basta::config::BastaConfig) -> Run {
     let result = basta::analyze::run(config);
-    result
+    let graph = &result.graph;
+    // A report names a file relative to its root, and two roots can each
+    // have a `src/util.js`; the graph knows each module's real path.
+    let mut modules: HashMap<&str, Vec<&basta::model::Module>> = HashMap::new();
+    for module in &graph.modules {
+        modules
+            .entry(module.path.as_str())
+            .or_default()
+            .push(module);
+    }
+    let mut files_taken: HashSet<basta::model::ModuleId> = HashSet::new();
+    let findings: Vec<(PathBuf, DeadFinding)> = result
         .report
         .findings
         .into_iter()
         .filter_map(|finding| {
-            // Paths are relative to the scan root they were found under.
-            let path = config
-                .paths
-                .iter()
-                .map(|root| root.join(&finding.path))
-                .find(|path| path.exists())?;
-            let path = std::fs::canonicalize(&path).unwrap_or(path);
+            let candidates = modules.get(finding.path.as_str())?;
+            let module = match candidates.as_slice() {
+                [only] => *only,
+                many => *many.iter().find(|module| match finding.category {
+                    // One unused-file finding per module, in order.
+                    Category::UnusedFile => files_taken.insert(module.id),
+                    _ => graph.symbols_of(module.id).iter().any(|symbol| {
+                        symbol.name == finding.name && symbol.start.offset == finding.start.offset
+                    }),
+                })?,
+            };
+            let path = std::fs::canonicalize(&module.real_path)
+                .unwrap_or_else(|_| module.real_path.clone());
             Some((path, finding))
         })
-        .collect()
+        .collect();
+    let snapshots = findings
+        .iter()
+        .map(|(path, _)| path)
+        .collect::<HashSet<_>>()
+        .into_iter()
+        .filter_map(|path| Some((path.clone(), Snapshot::of_disk(path)?)))
+        .collect();
+    Run {
+        findings,
+        snapshots,
+    }
 }
 
-/// The findings of the file at `path`, with `text`.
+/// The findings of the file at `path`, with `text`: none while the text
+/// differs from what the last run read, since their offsets would land on
+/// other code.
 pub fn dead_code_findings(
     path: &Path,
     text: &Text,
     project: &Project,
     encoding: Encoding,
 ) -> Vec<Finding> {
+    let Some(snapshot) = project
+        .dead_code_snapshots
+        .get(path)
+        .filter(|snapshot| snapshot.fits(text))
+    else {
+        return Vec::new();
+    };
     project
         .dead_code
         .iter()
         .filter(|(file, _)| file == path)
         .map(|(_, finding)| {
-            let (start, end) = match finding.category {
+            let range = match finding.category {
                 // The file as a whole: its first line.
-                Category::UnusedFile => (
-                    0,
-           
```

**File**: `rust/crates/cpd/src/lsp/findings.rs` (modified, +149/-19)
```diff
@@ -10,11 +10,13 @@ use lsp_types::{
     Diagnostic, DiagnosticRelatedInformation, DiagnosticSeverity, Location, NumberOrString, Range,
     Uri,
 };
+use std::collections::HashMap;
+use std::hash::{Hash, Hasher};
 use std::path::{Path, PathBuf};
 
 /// One finding in a file: a place, what is wrong with it, and where the
 /// other copies are.
-#[derive(Debug, Clone)]
+#[derive(Debug, Clone, PartialEq)]
 pub struct Finding {
     pub analysis: Analysis,
     pub rule: &'static str,
@@ -35,7 +37,7 @@ pub struct Finding {
 }
 
 /// Another copy of a finding.
-#[derive(Debug, Clone)]
+#[derive(Debug, Clone, PartialEq)]
 pub struct Target {
     pub uri: Uri,
     pub path: PathBuf,
@@ -48,12 +50,84 @@ pub struct Target {
 pub struct Text {
     pub text: String,
     pub index: LineIndex,
+    /// The length of the byte-order mark the file on disk starts with and
+    /// this text leaves out, as editors do: offsets from a scan of the disk
+    /// count it.
+    pub bom: usize,
+    hash: std::cell::OnceCell<u64>,
 }
 
 impl Text {
+    /// The text of an editor's buffer.
     pub fn new(text: String) -> Self {
         let index = LineIndex::new(&text);
-        Self { text, index }
+        Self {
+            text,
+            index,
+            bom: 0,
+            hash: std::cell::OnceCell::new(),
+        }
+    }
+
+    /// The text of a file as read from the disk.
+    pub fn from_disk(mut text: String) -> Self {
+        let bom = match text.starts_with('\u{feff}') {
+            true => '\u{feff}'.len_utf8(),
+            false => 0,
+        };
+        text.drain(..bom);
+        Self {
+            bom,
+            ..Self::new(text)
+        }
+    }
+
+    /// A hash of the text, to tell whether a finding computed from the
+    /// disk still fits it.
+    pub fn hash(&self) -> u64 {
+        *self.hash.get_or_init(|| text_hash(&self.text))
+    }
+
+    /// The range between two byte offsets of a scan whose copy of the file
+    /// started with `bom` bytes of a byte-order mark.
+    pub fn scan_range(&self, start: usize, end: usize, bom: usize, encoding: Encoding) -> Range {
+        self.index.range(
+            &self.text,
+            start.saturating_sub(bom),
+            end.saturating_sub(bom),
+            encoding,
+        )
+    }
+}
+
+fn text_hash(text: &str) -> u64 {
+    let mut hasher = std::collections::hash_map::DefaultHasher::new();
+    text.hash(&mut hasher);
+    hasher.finish()
+}
+
+/// What a background analysis read of one file: a hash of its text, without
+/// a byte-order mark, and the length of that mark. Its findings fit the file
+/// only while the text in the editor, or on disk, has the same hash.
+#[derive(Debug, Clone, Copy, PartialEq)]
+pub struct Snapshot {
+    pub hash: u64,
+    pub bom: usize,
+}
+
+impl Snapshot {
+    /// The file at `path` as it is on disk now.
+    pub fn of_disk(path: &Path) -> Option<Self> {
+        let text = Text::from_disk(std::fs::read_to_string(path).ok()?);
+        Some(Self {
+            hash: text.hash(),
+            bom: text.bom,
+        })
+    }
+
+    /// Whether a finding computed from this snapshot fits `text`.
+    pub fn fits(&self, text: &Text) -> bool {
+        self.hash == text.hash()
     }
 }
 
@@ -68,15 +142,33 @@ pub struct Scope<'a> {
 
 /// The findings of the clone analyses in the file `path`, whose text is
 /// `text`, among `clones`. `other_text` gives the text of another file, for
-/// the ranges of the other copies.
+/// the ranges of the other copies. Clones of the index count their offsets
+/// in the texts the server holds; clones a background run found on disk
+/// come with the `snapshots` of the files it read, and one whose file no
+/// longer fits its snapshot is left out until the next run.
 pub fn clone_findings<'c>(
     path: &Path,
     text: &Text,
     clones: impl Iterator<Item = &'c CpdClone>,
     scope: &Scope,
     other_text: &mut dyn FnMut(&Path) -> Option<std::rc::Rc<Text>>,
+    snapshots: Option<&HashMap<PathBuf, Snapshot>>,
 ) -> Vec<Finding> {
     let id = path.to_string_lossy();
+    // The byte-order mark to take off the offsets of a file, or `None` when
+    // the clone no longer fits it.
+    let shift = |file: &Path, text: &Text| -> Option<usize> {
+        match snapshots {
+            None => Some(text.bom),
+            Some(snapshots) => snapshots
+                .get(file)
+                .filter(|snapshot| snapshot.fits(text))
+                .map(|snapshot| snapshot.bom),
+        }
+    };
+    let Some(here_bom) = shift(path, text) else {
+        return Vec::new();
+    };
     let mut findings: Vec<Finding> = Vec::new();
     for clone in clones {
         let rule = rule_id(clone);
@@ -100,29 +192,35 @@ pub fn clone_findings<'c>(
             }
             let there_path = PathBuf::from(there_id);
             let target = match there_id == id {
-                true => target(&there_path, text, there, scope),
-                false => other
```

---

### Incident Patch 12: `f941b05e` (2026-09-30)
**Commit Message**: fix(lsp): allFiles covers dead code, broken configs show, two action details

- allFiles publishes the files with dead code or semantic pairs too, not
  only the files with clones.
- A .jscpd.json that is not valid JSON still leaves its project on the
  defaults, but the editor now shows the parse error.
- A semantic pair offers "Go to the similar function", like an ast pair.
- "Ignore this clone" at the end of a file counts the last column in
  UTF-8 when the client asked for it.

**File**: `rust/crates/cpd/src/lsp/project.rs` (modified, +45/-5)
```diff
@@ -133,18 +133,33 @@ impl Project {
             .or_else(|| plan.roots.first().cloned())
             .unwrap_or_default();
         let config_path = base.join(CONFIG_NAME);
+        // A file that does not parse, often one the user is typing into,
+        // leaves the project on the defaults and says why.
+        let mut unparsed = None;
         let mut value = match &plan.config_dir {
-            Some(dir) => std::fs::read_to_string(dir.join(CONFIG_NAME))
-                .ok()
-                .and_then(|text| serde_json::from_str(&text).ok())
-                .unwrap_or_else(|| serde_json::json!({})),
+            Some(_) => match std::fs::read_to_string(&config_path)
+                .map_err(|e| (None, e.to_string()))
+                .and_then(|text| {
+                    serde_json::from_str(&text).map_err(|e| (Some(e.line()), e.to_string()))
+                }) {
+                Ok(value) => value,
+                Err((line, error)) => {
+                    unparsed = Some(ConfigDiagnostic::ParseError {
+                        source: config_path.clone(),
+                        line,
+                        error,
+                    });
+                    serde_json::json!({})
+                }
+            },
             None => serde_json::json!({}),
         };
         if !value.is_object() {
             value = serde_json::json!({});
         }
         merge_json(&mut value, settings);
-        let result = config_from_json(value, &config_path, &base);
+        let mut result = config_from_json(value, &config_path, &base);
+        result.diagnostics.extend(unparsed);
         let refused = result
             .diagnostics
             .iter()
@@ -336,4 +351,29 @@ mod tests {
             serde_json::json!({"minTokens": 30, "lsp": {"clones": {"enabled": true}, "complexity": {"enabled": true}}})
         );
     }
+
+    #[test]
+    fn a_config_that_does_not_parse_leaves_the_defaults_and_says_why() {
+        use clap::Parser;
+        let dir = std::env::temp_dir().join(format!("jscpd-lsp-unparsed-{}", std::process::id()));
+        std::fs::create_dir_all(&dir).unwrap();
+        std::fs::write(dir.join(CONFIG_NAME), "{\n  \"minTokens\": 20,\n}\n").unwrap();
+        let cli = Cli::parse_from(["jscpd", "--lsp"]);
+        let plan = Plan {
+            config_dir: Some(dir.clone()),
+            roots: vec![dir.clone()],
+            excluded: Vec::new(),
+        };
+        let project = Project::new(plan, &cli, &[Analysis::Clones], &serde_json::json!({}));
+        assert_eq!(project.options.min_tokens, 50, "the defaults");
+        assert!(
+            matches!(
+                project.diagnostics.as_slice(),
+                [ConfigDiagnostic::ParseError { line: Some(3), .. }]
+            ),
+            "{:?}",
+            project.diagnostics
+        );
+        let _ = std::fs::remove_dir_all(dir);
+    }
 }
```

**File**: `rust/crates/cpd/src/lsp/server.rs` (modified, +32/-20)
```diff
@@ -12,7 +12,7 @@ use super::index::ScanIndex;
 use super::position::{Encoding, path_to_uri, uri_to_path};
 use super::project::{CONFIG_NAME, Project, find_config_dirs, plan};
 use super::settings::Analysis;
-use crate::cli::Cli;
+use crate::cli::{Cli, ConfigDiagnostic};
 use crossbeam_channel::{Receiver, Sender};
 use lsp_server::{Connection, ErrorCode, Message, Notification, Request, RequestId, Response};
 use lsp_types::notification::Notification as _;
@@ -305,14 +305,23 @@ impl Server {
             .collect();
         for project in &mut self.projects {
             for diagnostic in &project.diagnostics {
-                let _ = self
-                    .sender
-                    .send(notify::<lsp_types::notification::LogMessage>(
-                        lsp_types::LogMessageParams {
+                // A config that does not parse is left out as a whole, which
+                // the user has to see; the rest goes to the log.
+                let message = match diagnostic {
+                    ConfigDiagnostic::ParseError { .. } => {
+                        notify::<lsp_types::notification::ShowMessage>(ShowMessageParams {
+                            typ: MessageType::WARNING,
+                            message: format!("jscpd: {diagnostic}; using the defaults"),
+                        })
+                    }
+                    _ => {
+                        notify::<lsp_types::notification::LogMessage>(lsp_types::LogMessageParams {
                             typ: MessageType::WARNING,
                             message: diagnostic.to_string(),
-                        },
-                    ));
+                        })
+                    }
+                };
+                let _ = self.sender.send(message);
             }
             if let Some(reason) = &project.refused {
                 let _ = self
@@ -635,13 +644,13 @@ impl Server {
             if !project.analyses.all_files {
                 continue;
             }
-            if let Some(index) = &project.index {
-                for clone in index.clones() {
-                    for fragment in [&clone.fragment_a, &clone.fragment_b] {
-                        files.insert(PathBuf::from(super::index::host_file(&fragment.source_id)));
-                    }
+            let clones = project.index.iter().flat_map(|index| index.clones());
+            for clone in clones.chain(project.semantic.iter()) {
+                for fragment in [&clone.fragment_a, &clone.fragment_b] {
+                    files.insert(PathBuf::from(super::index::host_file(&fragment.source_id)));
                 }
             }
+            files.extend(project.dead_code.iter().map(|(path, _)| path.clone()));
         }
         let stale: Vec<PathBuf> = self
             .published
@@ -943,7 +952,9 @@ impl Server {
         for finding in self.findings_at(uri, params.range) {
             for target in &finding.targets {
                 let title = match finding.analysis {
-                    Analysis::Ast => format!("Go to the similar function in {}", target.label),
+                    Analysis::Ast | Analysis::Semantic => {
+                        format!("Go to the similar function in {}", target.label)
+                    }
                     _ => format!("Go to the other copy in {}", target.label),
                 };
                 actions.push(CodeActionOrCommand::CodeAction(CodeAction {
@@ -981,13 +992,14 @@ impl Server {
         let after = finding.last_line + 1;
         let end = match (after as usize) < text.index.line_count() {
             true => Position::new(after, 0),
-            false => Position::new(
-                finding.last_line,
-                text.index
-                    .line(&text.text, finding.last_line as usize)
-                    .encode_utf16()
-                    .count() as u32,
-            ),
+            false => {
+                let last = text.index.line(&text.text, finding.last_line as usize);
+                let column = match self.encoding {
+                    Encoding::Utf8 => last.len(),
+                    Encoding::Utf16 => last.encode_utf16().count(),
+                };
+                Position::new(finding.last_line, column as u32)
+            }
         };
         let trailing = match (after as usize) < text.index.line_count() {
             true => "\n",
```

---

### Incident Patch 13: `68a0ec7e` (2026-09-29)
**Commit Message**: fix(compare): review fixes for the html page

The map:
- the wheel scrolls the page past a tall map again; Ctrl or Cmd with
  the wheel (a trackpad pinch too) zooms it, and so do new - and +
  buttons beside "Fit the map". On a phone a vertical swipe scrolls
  the page and a pinch zooms it.
- past 1,500 marks it asks for bigger marks or the table instead of
  laying them out: the layout compares every two marks of a side, so
  4,000 functions a side froze the tab for 20 s. It no longer measures
  the toolbar on every filter change, a forced reflow after drawing
  thousands of elements, and a resize that keeps the width keeps the
  map and its zoom.
- typing a search clears the selected mark, so the hits light up.
- a click on a function ready to port shows the whole map and jumps to
  the mark itself, not to the middle of a tall map.

The table: the code and the tests of one file sort code first, so the
rows of each form one group, and no two marks tie. A sort keeps the
focus on its header, "Show all" hands it to the first new row, and the
rows of "Ready to port" open with Enter or Space.

Elsewhere: the detail names a side given as one file once (the data
says which sides are file

**File**: `docs/rust.md` (modified, +1/-1)
```diff
@@ -688,7 +688,7 @@ Reporters: `console` (the default), `console-full` (adds the list of every pair,
 
 A function is ready to port when it has no counterpart yet and everything it calls has one, so porting it waits for nothing. The JSON report lists these per side as `readyToPort`, each with the number of functions that call it, most called first. jscpd finds calls by name, the way `--semantic` does: a name followed by `(` in a function's code calls the functions of the same side with that name, in a language that can call it. A function in the caller's own file wins, and a name that more than three functions carry is too common to follow. Two unported functions that call each other wait for each other, so neither is ready.
 
-`-r html` writes `jscpd-compare.html`, a page that works offline, with its styles, script and data in the one file. Two tabs at the top show the comparison as a map or as a table, and the filters under them apply to both: code, tests, or both; one mark per folder, file or function; and a search. The address keeps the tab, so a link that ends in `#table` opens the table. The map draws the two sides as dependency graphs facing each other across a channel, the source in orange on the left and the target in green on the right, with a dotted bridge for every pair. A mark is a folder, a file or a function; the page picks the level by size, and a control switches it. Code is a circle and tests are a square. With both shown, thin lines tie each test to the code it calls; the page opens with both when there are tests. A mark fills from the bottom as its functions find counterparts: it is empty when none has one and full when all have. Its place says the same: a ported mark lines the channel, facing its counterpart, and one with nothing ported keeps to the far edge. Thin gray lines are calls within a side. The color of a bridge is the mean similarity of its pairs, light blue at 0.40 and dark blue at 1.00, and a bridge is thicker for more pairs. The dark theme turns the blue scale around, so the closest pairs stay the easiest to see. A dark ring marks the source functions ready to port. Hovering a mark lights up what it calls and what it pairs with, and clicking it lists its functions with their counterparts, calls and callers. The table lists the same bridges as rows: the source mark on the left, the similarity of the bridge in the middle, the target mark on the right, and a status (ported, partly ported, ready to port, not ported, or only in the target). A mark with no bridge gets a row of its own. In the order of one side, the rows of a mark form a group, so its name shows once. A click on a column header sorts the table by it, and a click on a row opens the pairs behind it with what its source mark still lacks, or, for a function, its pairs, calls and callers. Below both views, the page lists the functions ready to port, charts the similarity of the pairs by level, and shows the progress of every folder on both sides, all for what the filters select.
+`-r html` writes `jscpd-compare.html`, a page that works offline, with its styles, script and data in the one file. Two tabs at the top show the comparison as a map or as a table, and the filters under them apply to both: code, tests, or both; one mark per folder, file or function; and a search. The address keeps the tab, so a link that ends in `#table` opens the table. The map draws the two sides as dependency graphs facing each other across a channel, the source in orange on the left and the target in green on the right, with a dotted bridge for every pair. A mark is a folder, a file or a function; the page picks the level by size, and a control switches it. Past 1,500 marks the map asks for bigger marks or the table rather than drawing them. Code is a circle and tests are a square. With both shown, thin lines tie each test to the code it calls; the page opens with both when there are tests. A mark fills from the bottom as its functions find counterparts: it is empty when none has one and full when all have. Its place says the same: a ported mark lines the channel, facing its counterpart, and one with nothing ported keeps to the far edge. Thin gray lines are calls within a side. The color of a bridge is the mean similarity of its pairs, light blue at 0.40 and dark blue at 1.00, and a bridge is thicker for more pairs. The dark theme turns the blue scale around, so the closest pairs stay the easiest to see. A dark ring marks the source functions ready to port. Hovering a mark lights up what it calls and what it pairs with, and clicking it lists its functions with their counterparts, calls and callers. The table lists the same bridges as rows: the source mark on the left, the similarity of the bridge in the middle, the target mark on the right, and a status (ported, partly ported, ready to port, not ported, or only in the target). A mark with no bridge gets a row of its own. In the order of one side, the rows of a mark form a group, so its name
```

**File**: `rust/crates/cpd/src/compare/html.rs` (modified, +6/-0)
```diff
@@ -34,6 +34,10 @@ struct Page<'a> {
     model: &'a str,
     /// The two paths as given on the command line.
     sides: [&'a str; 2],
+    /// Whether each side is a single file rather than a folder: its files
+    /// are then named by their file name alone.
+    #[serde(rename = "sideIsFile")]
+    side_is_file: [bool; 2],
     /// `(side, path relative to the side's folder)`.
     files: Vec<(usize, String)>,
     /// `(file, name, first line, last line, flags)`; flags add up
@@ -104,6 +108,7 @@ pub(super) fn page(
         version: env!("CARGO_PKG_VERSION"),
         model,
         sides: paths,
+        side_is_file: root_is_file,
         files,
         functions,
         pairs,
@@ -131,6 +136,7 @@ mod tests {
             version: "0.0.0",
             model: "stand-in",
             sides: ["java/", "python/"],
+            side_is_file: [false, false],
             files: vec![(0, "QrCode.java".into()), (1, "qrcodegen.py".into())],
             functions: vec![
                 (0, "drawVersion", 10, 20, COUNTED),
```

**File**: `rust/crates/cpd/src/compare/page.html` (modified, +160/-30)
```diff
@@ -10,7 +10,7 @@
    and target), and how alike a pair is (one blue ramp, light for 0.40 and
    dark for 1.00 in the light theme; the map reads it continuously and the
    histogram in three levels). */
-.viz-root {
+:root {
   color-scheme: light;
   --page: #f9f9f7;
   --surface: #fcfcfb;
@@ -28,7 +28,7 @@
   --dep: #898781;
 }
 @media (prefers-color-scheme: dark) {
-  :root:where(:not([data-theme="light"])) .viz-root {
+  :root:where(:not([data-theme="light"])) {
     color-scheme: dark;
     --page: #0d0d0d;
     --surface: #1a1a19;
@@ -46,7 +46,7 @@
     --dep: #898781;
   }
 }
-:root[data-theme="dark"] .viz-root {
+:root[data-theme="dark"] {
   color-scheme: dark;
   --page: #0d0d0d;
   --surface: #1a1a19;
@@ -184,7 +184,11 @@
   border-radius: 12px;
   overflow: hidden;
 }
-#map { display: block; width: 100%; cursor: grab; touch-action: none; }
+/* A vertical swipe scrolls the page and a pinch zooms it; a sideways drag
+   moves the map. */
+#map { display: block; width: 100%; cursor: grab; touch-action: pan-y pinch-zoom; }
+.zoom { display: inline-flex; gap: 6px; }
+.zoom .plain-button { min-width: 34px; }
 #map.panning { cursor: grabbing; }
 .channel { fill: var(--page); }
 .dep { stroke: var(--dep); stroke-width: 1; opacity: 0.35; fill: none; }
@@ -415,7 +419,11 @@ <h1 class="shore-name" id="target-name"></h1>
       </div>
     </div>
     <input class="search" id="search" type="search" placeholder="Find a file or function" aria-label="Find a file or function">
-    <button type="button" class="plain-button" id="fit">Fit the map</button>
+    <div class="zoom" id="zoom-control" role="group" aria-label="Zoom the map">
+      <button type="button" class="plain-button" id="zoom-out" aria-label="Zoom out" title="Zoom out">&minus;</button>
+      <button type="button" class="plain-button" id="fit">Fit the map</button>
+      <button type="button" class="plain-button" id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button>
+    </div>
   </nav>
   </div>
 
@@ -513,6 +521,7 @@ <h2>Progress by folder</h2>
   const pct = (part, whole) => (whole === 0 ? 0 : Math.floor((part / whole) * 100));
 
   const hasTests = fns.some((f) => f.test && f.counted);
+  const sideIsFile = DATA.sideIsFile || [false, false];
 
   function kindStats(test) {
     const out = [{ n: 0, paired: 0, ready: 0 }, { n: 0, paired: 0, ready: 0 }];
@@ -775,6 +784,10 @@ <h2>Progress by folder</h2>
   let zoom = { k: 1, x: 0, y: 0 };
   const layouts = new Map();
   let drawn = false;
+  // Past this many marks the layout takes seconds and draws a blur, so the
+  // map asks for bigger marks or the table instead; `view` is null then.
+  const MAX_MARKS = 1500;
+  let declined = 0;
 
   function el(name, attrs, parent) {
     const node = document.createElementNS(SVG, name);
@@ -840,6 +853,14 @@ <h2>Progress by folder</h2>
     const key = state.kind + "/" + state.lod;
     const width = Math.max(640, svg.parentElement.clientWidth);
     const v = getView(state.kind, state.lod);
+    zoom = { k: 1, x: 0, y: 0 };
+    if (v.nodes.length > MAX_MARKS) {
+      view = null;
+      declined = v.nodes.length;
+      geometry = { W: width, H: 360 };
+      drawMap();
+      return;
+    }
     let entry = layouts.get(key);
     if (!entry || entry.W !== width) {
       // The circles that line the channel stand one above another, so
@@ -867,7 +888,6 @@ <h2>Progress by folder</h2>
     }
     view = v;
     geometry = { W: entry.W, H: entry.H };
-    zoom = { k: 1, x: 0, y: 0 };
     drawMap();
   }
 
@@ -878,6 +898,17 @@ <h2>Progress by folder</h2>
     svg.setAttribute("aria-label", "Dependency map: " + DATA.sides[0] + " on the left, " + DATA.sides[1] +
       " on the right, code as circles and tests as squares, with a dotted bridge for every pair. The Table tab lists the same data.");
     const vp = el("g", { id: "viewport" }, svg);
+    if (!view) {
+      const one = { functions: "function", files: "file", folders: "folder" }[state.lod];
+      const next = { functions: "Show one mark per file or folder, or open the Table tab.",
+        files: "Show one mark per folder, or open the Table tab.", folders: "Open the Table tab." }[state.lod];
+      const text = fmt(declined) + " marks are too many to draw one per " + one + ".";
+      svg.setAttribute("aria-label", text + " " + next);
+      el("text", { class: "lane-title", x: W / 2, y: H / 2 - 10, "text-anchor": "middle" }, vp).textContent = text;
+      el("text", { class: "lane-title", x: W / 2, y: H / 2 + 12, "text-anchor": "middle" }, vp).textContent = next;
+      renderKey($("map-key"), true);
+      return;
+    }
     el("rect", { class: "channel", x: W * 0.43, y: 0, width: W * 0.14, height: H }, vp);
     el("text", { class: "lane-title", x: W * 0.42, y: 22, "text-anchor": "end" }, vp).textContent = "ported";
     el("text", { class: "lane-title", x: W * 0.06, y: 22 }, vp).textContent = "not ported";
@@ -993,6 +1024,7 @@ <h2>Progress by folder</h2>
     focusSet(neighbours(n)
```

---

### Incident Patch 14: `f7537dd4` (2026-09-29)
**Commit Message**: fix(compare): a port not started yet gets its calls, so only leaves are ready

compare() returned before it built the call graph when one side had no
functions, so Comparison::ready saw no calls and marked every counted
function of the other side ready to port. The first run of a port, with
an empty target, is where that list helps most. The call graph needs no
model, so it is now built before that return: on QR-Code-generator's
Java against an empty folder, 11 of 41 functions are ready (the ones
that call no other function of the side), not all 41.

The html page also names the sides as the other reports do, so a path
that is not UTF-8 no longer shows as an empty name, and html.rs tells a
pair found by name by its MatchedBy variant rather than its string.

**File**: `rust/crates/cpd-semantic/src/compare.rs` (modified, +22/-3)
```diff
@@ -255,22 +255,24 @@ pub fn compare(
             });
         }
     }
+    let unit = |item: &Item| -> &SemanticUnit { &flat[item.source].2.units[item.unit] };
+    // The calls need no model, so a port not started yet has them too: with
+    // nothing paired, they alone say which functions to port first.
+    let calls = call_graph(&items, unit, |i| functions[i].side);
     let both_sides = [0, 1].map(|side| functions.iter().any(|f| f.side == side));
     if both_sides.contains(&false) {
         return Ok(Comparison {
             functions,
             pairs: Vec::new(),
-            calls: Vec::new(),
+            calls,
         });
     }
 
-    let unit = |item: &Item| -> &SemanticUnit { &flat[item.source].2.units[item.unit] };
     let texts: Vec<&str> = items.iter().map(|item| unit(item).text.as_str()).collect();
     let vectors = embedder.embed(&texts)?;
     let space = VectorSpace::new(&vectors, texts.len())?;
     let grammars = grammar_ids(&items, |item| unit(item).grammar);
     let related = call_pairs(&items, unit);
-    let calls = call_graph(&items, unit, |i| functions[i].side);
 
     // Step 1: the rule of --semantic, across the sides, between functions
     // that count.
@@ -1157,6 +1159,23 @@ mod tests {
         );
     }
 
+    #[test]
+    fn a_port_not_started_yet_is_ready_from_its_leaves() {
+        // The target is empty, so nothing pairs; the function that calls
+        // nothing is ready and its caller waits for it.
+        let java = vec![source(
+            "java/A.java",
+            "java",
+            vec![
+                with_text(unit("java", "run", 1, 9, 60), "void run() { helper(); }"),
+                with_text(unit("java", "helper", 20, 9, 60), "void helper() {}"),
+            ],
+        )];
+        let result = compare([&java, &[]], &table(&[]), &PARAMS).unwrap();
+        assert_eq!(result.calls, vec![(0, 1)]);
+        assert_eq!(result.ready(), vec![false, true]);
+    }
+
     #[test]
     fn a_function_is_ready_when_all_it_calls_is_ported() {
         let f = |side, counted| FunctionRef {
```

**File**: `rust/crates/cpd/src/compare/html.rs` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@
 //! both) from it.
 
 use super::describe;
-use cpd_semantic::compare::{Comparison, Level};
+use cpd_semantic::compare::{Comparison, Level, MatchedBy};
 use cpd_semantic::search::UnitSource;
 use serde::Serialize;
 use std::collections::HashMap;
@@ -96,7 +96,7 @@ pub(super) fn page(
                 Level::High => 2,
             };
             let similarity = (f64::from(pair.similarity) * 1000.0).round() / 1000.0;
-            let by_name = u8::from(pair.matched_by.as_str() == "name");
+            let by_name = u8::from(matches!(pair.matched_by, MatchedBy::Name));
             (pair.a, pair.b, similarity, level, by_name)
         })
         .collect();
```

**File**: `rust/crates/cpd/src/compare/mod.rs` (modified, +3/-7)
```diff
@@ -105,15 +105,11 @@ pub fn run(opts: &Options, paths: &[PathBuf], run_config: &RunConfig) -> Result<
     let comparison = pool
         .install(|| compare([&sides[0], &sides[1]], embedder.as_ref(), &params))
         .map_err(|e| fatal(format!("--compare: {e}")))?;
-    let report = Report::new(
-        [left, right].map(|p| p.display().to_string()),
-        &roots,
-        &sides,
-        &comparison,
-    );
+    let names = [left, right].map(|p| p.display().to_string());
+    let report = Report::new(names.clone(), &roots, &sides, &comparison);
     let page = || {
         html::page(
-            [left, right].map(|p| p.to_str().unwrap_or_default()),
+            [names[0].as_str(), names[1].as_str()],
             &roots,
             &sides,
             &comparison,
```

---

### Incident Patch 15: `c3f689c5` (2026-09-29)
**Commit Message**: fix(compare): review fixes for test detection and test-case names

From a review of the PR:

- #[cfg(not(test))] and #[cfg(feature = "test-util")] modules are code:
  a cfg condition is a test only when it names `test` as a predicate,
  outside not(…) and outside a string. A file that starts with
  #![cfg(test)] is tests, and so is #[test] fn on one line.
- A test case needs a string title after the call, so a method named
  test (`test(input) { … }`) stays code, and Playwright's test.describe
  and test.step are not test cases.
- A test title goes to the callback alone: a named function-expression
  callback no longer leaves it for the next arrow, and an arrow in
  test.each(table) no longer takes it or the callback's head.
- The `test` marker is stripped from test names only, and only as
  test_, testX or TestX, so testConnection keeps its name and the title
  "tests the rounding" its words.
- In --semantic a test's title is no callable name: a test titled after
  the function it calls still counts as its caller, and callers of that
  function are not related to the test.
- Module links for the name step are counted for tests and code apart.
  On fs-extra this pairs four more cod

**File**: `docs/rust.md` (modified, +1/-1)
```diff
@@ -655,7 +655,7 @@ Only in python (1):
 
 The report has a block for the code and one for the tests, and each shows both directions. A port reads the first line of a block as its progress and "Only in python", the source, as the work left. A parity check reads both lines and both "Only in" lists. Each file gets the number of its functions that have a counterpart, the mean similarity of their pairs, and the file on the other side that holds most of them.
 
-Tests and code are measured apart, and a test pairs only with a test, so a port's tests and its code each get a percentage of their own. jscpd tells a test by the conventions of its language. A file is a test file when its name or a folder on its path says so: `*_test.go`, `test_*.py`, `*_test.py`, `*.test.ts`, `*.spec.js`, `*Test.java`, `*Tests.kt`, `*Tests.swift`, `*Tests.cs`, `*Spec.scala`, `*_spec.rb`, a Rust `tests.rs`, or a folder such as `tests/`, `__tests__/`, `spec/`, `src/test/`, `androidTest/`, `MyAppTests/` or `MyApp.Tests/`. The folder given on the command line counts, so `jscpd --compare node/test rust/tests` compares tests. Inside a code file, a Rust function in a `#[cfg(test)]` module or under a test attribute (`#[test]`, `#[tokio::test]`, `#[rstest]`) is a test, and so is a JavaScript or TypeScript test case such as `it('rounds cents', () => …)`. Without tests on either side, the report has no headings and reads as the code alone.
+Tests and code are measured apart, and a test pairs only with a test, so a port's tests and its code each get a percentage of their own. jscpd tells a test by the conventions of its language. A file is a test file when its name or a folder on its path says so: `*_test.go`, `test_*.py`, `*_test.py`, `*.test.ts`, `*.spec.js`, `*Tests.swift`, `*Tests.cs`, `*_spec.rb`, a Rust `tests.rs`, or a folder such as `tests/`, `__tests__/`, `spec/`, `src/test/`, `androidTest/`, `MyAppTests/` or `MyApp.Tests/`. Java, Kotlin and Scala tests are found by their folder (`src/test/`): a singular `Test` or `Spec` at the end of a file name is left alone, since `ABTest.java` and `OpenApiSpec.ts` are usually code. The folder given on the command line counts, so `jscpd --compare node/test rust/tests` compares tests. Inside a code file, a Rust function in a `#[cfg(test)]` module (not `#[cfg(not(test))]`), in a file that starts with `#![cfg(test)]`, or under a test attribute (`#[test]`, `#[tokio::test]`, `#[rstest]`) is a test, and so is a JavaScript or TypeScript test case such as `it('rounds cents', () => …)`. Playwright's `test.describe` and `test.step`, and a method that happens to be named `test`, are not. Without tests on either side, the report has no headings and reads as the code alone.
 
 "Paired under other names" lists the pairs whose names differ even once case and underscores are ignored: renamed ports, constructors (`QrCode` and `__init__`), and platform names (`startWatch` and `watchPosition`). These are the pairs nobody finds by searching for a name, so the default console report shows them, and `console-full` lists every pair.
 
```

**File**: `rust/crates/cpd-semantic/src/compare.rs` (modified, +55/-28)
```diff
@@ -285,32 +285,36 @@ pub fn compare(
     // Step 2: namesakes among the functions left unpaired.
     let mut paired = vec![false; functions.len()];
     let mut linked_files: FxHashSet<(u32, u32)> = FxHashSet::default();
-    // Code pairs per module and module of the other side.
-    let mut links: FxHashMap<u32, FxHashMap<u32, usize>> = FxHashMap::default();
+    // Step-1 pairs per module and module of the other side, for tests and
+    // for code apart: tests often sit in folders of their own (`tests/`),
+    // and their pairs must not decide which code modules match.
+    let mut links: FxHashMap<(bool, u32), FxHashMap<u32, usize>> = FxHashMap::default();
     for pair in &pairs {
         paired[pair.a] = true;
         paired[pair.b] = true;
+        let kind = functions[pair.a].test;
         let (ma, mb) = (module_of[pair.a], module_of[pair.b]);
-        *links.entry(ma).or_default().entry(mb).or_default() += 1;
-        *links.entry(mb).or_default().entry(ma).or_default() += 1;
+        *links.entry((kind, ma)).or_default().entry(mb).or_default() += 1;
+        *links.entry((kind, mb)).or_default().entry(ma).or_default() += 1;
         linked_files.insert((items[pair.a].file, items[pair.b].file));
     }
-    // Whether `other` holds the most code pairs of `module` (ties count).
-    let main_link = |module: u32, other: u32| {
-        links.get(&module).is_some_and(|counts| {
+    // Whether `other` holds the most pairs of `module` (ties count).
+    let main_link = |kind: bool, module: u32, other: u32| {
+        links.get(&(kind, module)).is_some_and(|counts| {
             let most = counts.values().copied().max().unwrap_or(0);
             counts.get(&other) == Some(&most)
         })
     };
     let may_pair = |a: usize, b: usize| {
+        let kind = functions[a].test;
         let (ma, mb) = (module_of[a], module_of[b]);
-        main_link(ma, mb)
-            || main_link(mb, ma)
-            || !(links.contains_key(&ma) || links.contains_key(&mb))
+        main_link(kind, ma, mb)
+            || main_link(kind, mb, ma)
+            || !(links.contains_key(&(kind, ma)) || links.contains_key(&(kind, mb)))
     };
     let mut by_name: FxHashMap<String, [Vec<usize>; 2]> = FxHashMap::default();
     for (i, item) in items.iter().enumerate() {
-        let key = name_key(&unit(item).name);
+        let key = name_key(&unit(item).name, functions[i].test);
         if !paired[i] && !key.is_empty() {
             by_name.entry(key).or_default()[side_of(i)].push(i);
         }
@@ -423,19 +427,35 @@ fn modules(files: &[&str]) -> Vec<String> {
 /// A function name with case, underscores, spaces and punctuation ignored,
 /// so the names one function gets in different languages meet:
 /// `encodeBinary`, `encode_binary`, `_encode_binary` and `EncodeBinary` are
-/// all `encodebinary`. A leading `test` goes too, the mark of a test in
-/// pytest, Go, XCTest and JUnit 3 that a JavaScript test title does not
-/// carry: `test_rounds_cents`, `TestRoundsCents` and the test titled
-/// `rounds cents` are all `roundscents`.
-pub fn name_key(name: &str) -> String {
-    let key: String = name
-        .chars()
+/// all `encodebinary`. For a `test`, a leading `test` marker goes too, the
+/// mark of a test in pytest, Go, XCTest and JUnit 3 that a JavaScript test
+/// title does not carry: `test_rounds_cents`, `TestRoundsCents` and the
+/// test titled `rounds cents` are all `roundscents`. The marker is `test`
+/// followed by `_` or a capital, so the title `tests the rounding` keeps
+/// its words, and a code function such as `testConnection` keeps its name.
+pub fn name_key(name: &str, test: bool) -> String {
+    let name = match test {
+        true => strip_test_marker(name),
+        false => name,
+    };
+    name.chars()
         .filter(|c| c.is_alphanumeric())
         .flat_map(char::to_lowercase)
-        .collect();
-    match key.strip_prefix("test") {
-        Some(rest) if !rest.is_empty() => rest.to_string(),
-        _ => key,
+        .collect()
+}
+
+/// `name` without a leading `test_`, `test` before a capital, or `Test`.
+fn strip_test_marker(name: &str) -> &str {
+    let Some(rest) = name
+        .strip_prefix("test")
+        .or_else(|| name.strip_prefix("Test"))
+    else {
+        return name;
+    };
+    match rest.chars().next() {
+        Some('_') if rest.len() > 1 => &rest[1..],
+        Some(c) if c.is_uppercase() => rest,
+        _ => name,
     }
 }
 
@@ -1009,15 +1029,22 @@ mod tests {
             "_encode_binary",
             "EncodeBinary",
         ] {
-            assert_eq!(name_key(name), "encodebinary");
+            assert_eq!(name_key(name, false), "encodebinary");
         }
-        assert_eq!(name_key("__init__"), "init");
+        assert_eq!(name_key("__init__", false), "init");
         // Test titles, as the JavaScript extractor names test callbacks.
-        assert_eq!(name_key("rounds cents"), name_key("rounds_cents"));
+        assert_eq!(
+
```

**File**: `rust/crates/cpd-semantic/src/search.rs` (modified, +39/-2)
```diff
@@ -451,7 +451,8 @@ pub(crate) fn call_pairs<'u>(
     let mut by_name: FxHashMap<&str, Vec<usize>> = FxHashMap::default();
     for (i, item) in items.iter().enumerate() {
         let name = unit(item).name.as_str();
-        if name.chars().count() >= MIN_CALLEE_NAME && !name.starts_with('<') {
+        // A test's name is a title (`it('add', …)`), never called.
+        if name.chars().count() >= MIN_CALLEE_NAME && !name.starts_with('<') && !unit(item).test {
             by_name.entry(name).or_default().push(i);
         }
     }
@@ -463,7 +464,9 @@ pub(crate) fn call_pairs<'u>(
         let own = unit(item);
         let mut seen: rustc_hash::FxHashSet<&str> = rustc_hash::FxHashSet::default();
         for callee in called_names(&own.text) {
-            if callee == own.name || !seen.insert(callee) {
+            // A function's own name in its header or a recursive call is
+            // not a call; a test titled after the function it calls is.
+            if (callee == own.name && !own.test) || !seen.insert(callee) {
                 continue;
             }
             for &j in by_name.get(callee).map(Vec::as_slice).unwrap_or_default() {
@@ -1321,6 +1324,40 @@ mod tests {
         );
     }
 
+    #[test]
+    fn a_test_titled_after_its_subject_still_calls_it() {
+        // `it('compute', () => { compute(1) })`: the title is no function
+        // name, so the call to `compute(` relates the test to `compute`,
+        // and the title is nothing another function can call.
+        let items: Vec<Item> = (0..3)
+            .map(|k| Item {
+                source: 0,
+                unit: k,
+                file: k as u32,
+            })
+            .collect();
+        let units = [
+            unit("oxc", "compute", 1, "function compute(x) { return x * 2 }"),
+            SemanticUnit {
+                test: true,
+                ..unit("oxc", "compute", 1, "it('compute', () => { compute (1) })")
+            },
+            unit(
+                "oxc",
+                "caller",
+                1,
+                "function caller() { return compute(2) }",
+            ),
+        ];
+        let related = call_pairs(&items, |item| &units[item.unit]);
+        assert_eq!(related[1], vec![0], "the test calls compute");
+        assert_eq!(
+            related[2],
+            vec![0],
+            "a caller of compute is not related to the test"
+        );
+    }
+
     #[test]
     fn namesakes_are_not_mistaken_for_caller_and_callee() {
         let related = call_pairs(
```

**File**: `rust/crates/cpd-semantic/src/test_code.rs` (modified, +164/-47)
```diff
@@ -10,19 +10,11 @@
 //! `it('title', () => …)`, which Vitest runs from source files too.
 
 use cpd_core::models::Token;
-use cpd_tokenizer::functions::TEST_CASE_CALLS;
+use cpd_tokenizer::functions::{NOT_TEST_CASES, TEST_CASE_CALLS};
 use std::path::{Component, Path};
 
 /// Folders that hold tests, compared without case.
-const TEST_DIRS: &[&str] = &[
-    "test",
-    "tests",
-    "__tests__",
-    "spec",
-    "specs",
-    "androidtest",
-    "uitests",
-];
+const TEST_DIRS: &[&str] = &["test", "tests", "__tests__", "spec", "specs"];
 
 /// Whether `path` names a test file by the conventions of the languages
 /// jscpd compares. `path` starts at the compared folder itself
@@ -42,12 +34,12 @@ pub fn is_test_path(path: &Path) -> bool {
     dirs.iter().any(|dir| is_test_dir(dir)) || is_test_file(file)
 }
 
-/// `tests`, `__tests__`, `src/test`, and the test targets of Xcode and
-/// .NET: `MyAppTests`, `MyApp.Tests`, `MyApp.UITests`.
+/// `tests`, `__tests__`, `src/test`, Android's `androidTest`, and the test
+/// targets of Xcode and .NET: `MyAppTests`, `MyApp.UITests`, `MyApp.Tests`.
 fn is_test_dir(dir: &str) -> bool {
     let lower = dir.to_ascii_lowercase();
     TEST_DIRS.contains(&lower.as_str())
-        || ["Tests", ".Tests", "Test", ".Test"]
+        || ["Tests", "Test"]
             .iter()
             .any(|suffix| dir.len() > suffix.len() && dir.ends_with(suffix))
 }
@@ -65,11 +57,11 @@ fn is_test_file(file: &str) -> bool {
         || lower_stem.ends_with("_tests")
         || lower_stem.ends_with("_spec")
         || lower_stem == "tests"
-        // CartTest.java, CartTests.swift, CartSpec.scala: a capitalized
-        // suffix after another word, so `Contest` and `Request` stay code.
-        || ["Test", "Tests", "Spec"]
-            .iter()
-            .any(|suffix| stem.len() > suffix.len() && stem.ends_with(suffix))
+        // CartTests.swift, CartTests.cs: a capitalized plural after another
+        // word. The singular `CartTest.java` and `CartSpec.scala` are left
+        // to their folders (`src/test/`): as a name alone they would take
+        // `ABTest.java` and `OpenApiSpec.ts` for tests.
+        || (stem.len() > 5 && stem.ends_with("Tests"))
 }
 
 /// Whether the function of `grammar` found at `head..` in `code` is a test
@@ -91,43 +83,132 @@ pub(crate) fn inline_test(
                 .any(|&(from, to)| from <= start && start < to)
                 || has_test_attribute(code, start)
         }
-        "oxc" => {
-            let rest = code.get(head..).unwrap_or_default();
-            let callee: &str = rest
-                .split(|c: char| !(c.is_alphanumeric() || c == '_' || c == '$'))
-                .next()
-                .unwrap_or_default();
-            let after = rest[callee.len()..].trim_start();
-            TEST_CASE_CALLS.contains(&callee) && (after.starts_with('(') || after.starts_with('.'))
-        }
+        "oxc" => code.get(head..).is_some_and(starts_test_case),
         _ => false,
     }
 }
 
-/// Whether the attributes above the Rust item at `start` include a test
+/// Whether `code` starts with a test-case call: a name from
+/// `TEST_CASE_CALLS`, members and calls after it (`.only`, `.each(table)`),
+/// then `(` and a string title, as in `it('rounds cents', …)`. A method
+/// named `test` (`test(input) { … }`) has no title and is code, and
+/// Playwright's `test.describe(…)` and `test.step(…)` are not test cases.
+fn starts_test_case(code: &str) -> bool {
+    let ident = |text: &str| -> usize {
+        text.find(|c: char| !(c.is_alphanumeric() || c == '_' || c == '$'))
+            .unwrap_or(text.len())
+    };
+    let callee_len = ident(code);
+    if !TEST_CASE_CALLS.contains(&&code[..callee_len]) {
+        return false;
+    }
+    let mut rest = &code[callee_len..];
+    loop {
+        rest = rest.trim_start();
+        if let Some(member) = rest.strip_prefix('.') {
+            let member = member.trim_start();
+            let len = ident(member);
+            if len == 0 || NOT_TEST_CASES.contains(&&member[..len]) {
+                return false;
+            }
+            rest = &member[len..];
+        } else if let Some(args) = rest.strip_prefix('(') {
+            if args.trim_start().starts_with(['\'', '"', '`']) {
+                return true;
+            }
+            // A call inside the chain, such as `.each(table)`: skip it.
+            let Some(end) = closing_paren(rest) else {
+                return false;
+            };
+            rest = &rest[end..];
+        } else {
+            return false;
+        }
+    }
+}
+
+/// The offset just after the `)` that closes the `(` `text` starts with.
+fn closing_paren(text: &str) -> Option<usize> {
+    let mut depth = 0usize;
+    for (at, c) in text.char_indices() {
+        match c {
+            '(' => depth += 1,
+            ')' => {
+                depth = depth.checked_sub(1)?;
+                if depth == 0 {
+                    return Some(at + 1)
```

**File**: `rust/crates/cpd-tokenizer/src/functions.rs` (modified, +59/-17)
```diff
@@ -168,11 +168,15 @@ struct Extractor<'i> {
 
 impl Extractor<'_> {
     fn open(&mut self, name: String, start: u32, end: u32) {
-        let head = self
-            .pending_head
-            .take()
-            .filter(|&(_, value)| value == start)
-            .map_or(start, |(head, _)| head);
+        // Only the function the naming code is about takes its head; one
+        // that opens before it (an arrow in `test.each(table)`) leaves it.
+        let head = match self.pending_head {
+            Some((head, value)) if value == start => {
+                self.pending_head = None;
+                head
+            }
+            _ => start,
+        };
         self.frames.push(Frame {
             name,
             head,
@@ -199,6 +203,19 @@ impl Extractor<'_> {
         });
     }
 
+    /// The pending name, for the function that starts at `start`. A test
+    /// title belongs to its callback alone: a function in `.each(table)`
+    /// before it, or one nested in a named callback, does not take it.
+    fn take_name(&mut self, start: u32) -> Option<String> {
+        if self.pending_call.is_some() {
+            if self.pending_head.map(|(_, callback)| callback) != Some(start) {
+                return None;
+            }
+            self.pending_call = None;
+        }
+        self.pending_name.take()
+    }
+
     /// Remember where the code naming the next function starts, for the
     /// function that is the named value itself (`value` starts there), not
     /// one nested in it.
@@ -237,20 +254,19 @@ impl<'a> Visit<'a> for Extractor<'_> {
                 }
             }
             AstKind::Function(f) => {
-                self.pending_call = None;
-                let name =
-                    f.id.as_ref()
-                        .map(|id| id.name.to_string())
-                        .or_else(|| self.pending_name.take())
-                        .unwrap_or_else(|| "<anonymous>".to_string());
+                let own = f.id.as_ref().map(|id| id.name.to_string());
+                let name = match own {
+                    Some(name) => name,
+                    None => self
+                        .take_name(f.span.start)
+                        .unwrap_or_else(|| "<anonymous>".to_string()),
+                };
                 let span = f.span;
                 self.open(name, span.start, span.end);
             }
             AstKind::ArrowFunctionExpression(a) => {
-                self.pending_call = None;
                 let name = self
-                    .pending_name
-                    .take()
+                    .take_name(a.span.start)
                     .unwrap_or_else(|| "<arrow>".to_string());
                 let span = a.span;
                 self.open(name, span.start, span.end);
@@ -293,6 +309,20 @@ impl<'a> Visit<'a> for Extractor<'_> {
 /// tests, while a test case is what a port carries over one by one.
 pub const TEST_CASE_CALLS: &[&str] = &["it", "test", "specify", "fit", "xit", "xtest", "bench"];
 
+/// Members of a test function that declare something other than a test
+/// case: a suite, a step inside a test, a hook, or configuration
+/// (`test.describe`, `test.step`, `test.beforeEach`, `test.use`).
+pub const NOT_TEST_CASES: &[&str] = &[
+    "describe",
+    "step",
+    "beforeEach",
+    "afterEach",
+    "beforeAll",
+    "afterAll",
+    "use",
+    "extend",
+];
+
 /// The title of the test case `call` declares and where its callback
 /// starts, when `call` is `it('rounds cents', () => …)` or one of its
 /// variants and the title is a plain string. The callback then goes by the
@@ -301,12 +331,18 @@ pub const TEST_CASE_CALLS: &[&str] = &["it", "test", "specify", "fit", "xit", "x
 /// title is part of what a model sees.
 fn test_case(call: &oxc_ast::ast::CallExpression<'_>) -> Option<(String, u32)> {
     use oxc_ast::ast::Expression;
-    // `it`, `it.only`, `test.each(table)`, `it.concurrent.each(table)`.
+    // `it`, `it.only`, `test.each(table)`, `it.concurrent.each(table)`,
+    // but not Playwright's `test.describe(…)` or `test.step(…)`.
     let mut callee = &call.callee;
     let root = loop {
         match callee {
             Expression::Identifier(id) => break id.name.as_str(),
-            Expression::StaticMemberExpression(member) => callee = &member.object,
+            Expression::StaticMemberExpression(member) => {
+                if NOT_TEST_CASES.contains(&member.property.name.as_str()) {
+                    return None;
+                }
+                callee = &member.object;
+            }
             Expression::CallExpression(inner) => callee = &inner.callee,
             _ => return None,
         }
@@ -365,7 +401,7 @@ mod tests {
 
     #[test]
     fn test_case_callbacks_go_by_their_titles() {
-        let src = "describe('money', () => {\n  beforeEach(() => reset());\n  it('rounds  cents', () => {\n    expect(round(149)).toBe(100);\n  });\n  test.each([[1, 2]])('adds %i', (a, b) => {\n   
```

**File**: `rust/crates/cpd/src/compare.rs` (modified, +12/-16)
```diff
@@ -79,25 +79,21 @@ pub fn run(opts: &Options, paths: &[PathBuf], run_config: &RunConfig) -> Result<
     let pool = build_thread_pool(opts.workers);
     prepare_scan_in(&pool, &config);
     let mut sides: [Vec<UnitSource>; 2] = [Vec::new(), Vec::new()];
-    for source in reader.take_sources() {
+    for mut source in reader.take_sources() {
         let file = Path::new(cpd_core::paths::clean_source_id(&source.id));
-        if let Some(side) = roots.iter().position(|root| file.starts_with(root)) {
-            sides[side].push(source);
-        }
-    }
-    // A test file by its path, from the compared folder's own name down, so
-    // comparing two `tests/` folders measures tests.
-    for (side, sources) in sides.iter_mut().enumerate() {
+        let Some(side) = roots.iter().position(|root| file.starts_with(root)) else {
+            continue;
+        };
+        // A test file by its path, from the compared folder's own name
+        // down, so comparing two `tests/` folders measures tests.
         let base = roots[side].parent().unwrap_or(&roots[side]);
-        for source in sources {
-            let file = Path::new(cpd_core::paths::clean_source_id(&source.id));
-            let relative = file.strip_prefix(base).unwrap_or(file);
-            if cpd_semantic::test_code::is_test_path(relative) {
-                for unit in &mut source.units {
-                    unit.test = true;
-                }
+        let relative = file.strip_prefix(base).unwrap_or(file);
+        if cpd_semantic::test_code::is_test_path(relative) {
+            for unit in &mut source.units {
+                unit.test = true;
             }
         }
+        sides[side].push(source);
     }
     let params = CompareParams {
         thresholds: semantic.thresholds(),
@@ -369,7 +365,7 @@ impl Section {
             .map(|pair| {
                 let (a, b) = (function(pair.a), function(pair.b));
                 PairEntry {
-                    renamed: name_key(&a.name) != name_key(&b.name),
+                    renamed: name_key(&a.name, tests) != name_key(&b.name, tests),
                     a,
                     b,
                     similarity: round(f64::from(pair.similarity), 1000.0),
```

**File**: `skills/compare-codebases/SKILL.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Each pair gets a level on the scale of the model, because a cosine that is high
 | `medium` | 0.5625 to 0.7125 | usually the same function, restructured |
 | `low` | 0.4125 to 0.5625 | read both: related code pairs here too |
 
-Tests and code are measured apart, in two blocks of the report, and a test pairs only with a test. A test is told by the conventions of its language: a file such as `*_test.go`, `test_*.py`, `*.test.ts`, `*.spec.js`, `*Test.java`, `*Tests.swift` or `*_spec.rb`, a folder such as `tests/`, `__tests__/`, `spec/`, `src/test/` or `MyAppTests/` (the compared folder's own name counts), a Rust function in a `#[cfg(test)]` module or under `#[test]`, or a JavaScript test case. Without tests on either side the report has one block and no headings.
+Tests and code are measured apart, in two blocks of the report, and a test pairs only with a test. A test is told by the conventions of its language: a file such as `*_test.go`, `test_*.py`, `*.test.ts`, `*.spec.js`, `*Tests.swift` or `*_spec.rb`, a folder such as `tests/`, `__tests__/`, `spec/`, `src/test/` (where Java, Kotlin and Scala keep theirs) or `MyAppTests/` (the compared folder's own name counts), a Rust function in a `#[cfg(test)]` module or under `#[test]`, or a JavaScript test case. Without tests on either side the report has one block and no headings.
 
 Totals count the functions of at least `--min-tokens` tokens and `--min-lines` lines; smaller ones appear only as partners. Anonymous functions (callbacks, closures) take no part, except JavaScript and TypeScript test cases: `it('rounds cents', () => …)` (and `test`, `specify`, `fit`, `xit`, `xtest`, `bench`, with `.only`, `.skip` or `.each(table)`) goes by its title, so tests pair like any other function. Suites and hooks stay anonymous. Types, constants, SQL and UI markup are not compared.
 
```

#### Recent Merged Pull Requests:
- **PR #1140** (2026-10-05): chore(deps): bump xxhash-rust from 0.8.15 to 0.8.16 in /rust/fuzz (@dependabot[bot])
- **PR #1138** (2026-10-05): feat(similarity): Python, code blocks in Markdown and components, role-aware names (@kucherenko)
- **PR #1137** (2026-10-05): docs(mcp): how compare_folders differs from --compare (@kucherenko)
- **PR #1135** (2026-10-04): feat(mcp): all four clone types, compare_folders and MCP 2026-07-28 (@kucherenko)
- **PR #1133** (2026-10-04): fix(nix): use stdenv.hostPlatform.isDarwin (@mlavrinenko)
- **PR #1130** (2026-10-03): fix(compare): one share in both reports, no empty Tests block, no bodiless functions (@kucherenko)
- **PR #1127** (2026-10-02): chore(deps): bump taiki-e/install-action from 2.87.18 to 2.87.22 (@dependabot[bot])
- **PR #1126** (2026-10-02): chore(deps): bump xxhash-rust from 0.8.18 to 0.8.19 in /rust (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
