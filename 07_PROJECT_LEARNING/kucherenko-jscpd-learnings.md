> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kucherenko-jscpd-learnings.md`  
> **Source**: github ([https://github.com/kucherenko/jscpd](https://github.com/kucherenko/jscpd))  
> **Source Version**: `2177d563`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T02:27:41.911Z  
> **Learning ID**: `learn-github-kucherenko-jscpd`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kucherenko/jscpd

> **Canonical Artifact**: `07_PROJECT_LEARNING/kucherenko-jscpd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kucherenko/jscpd](https://github.com/kucherenko/jscpd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-21T02:27:41.904Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kucherenko/jscpd`
- **Description**: Copy/paste detector for source code. 220+ languages, Rust engine, SARIF/HTML/badge reporters, GitHub Action, MCP server for AI agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6429 stars

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

### Core Architecture Module: `rust/crates/cpd-core/src/boundaries.rs`
```
//! What the boundary rules of a config file found (`boundaries`): copies of
//! protected code, a module, a folder, a file or a method, in places a rule
//! keeps it out of, such as money calculated in a frontend when only the
//! backend may calculate it.

use crate::models::{CloneKind, Fragment, SimilarityMethod};
use serde::{Deserialize, Serialize};

/// The violations of every rule, in the order the config file lists the
/// rules.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct BoundaryReport {
    pub rules: Vec<RuleReport>,
}

impl BoundaryReport {
    /// How many copies the rules found, all rules together.
    pub fn violations(&self) -> usize {
        self.rules.iter().map(|rule| rule.violations.len()).sum()
    }

    /// Every fragment of every violation, for the path rewrites a report
    /// needs: scan-root-relative display, or absolute paths.
    pub fn fragments_mut(&mut self) -> impl Iterator<Item = &mut Fragment> {
        self.rules
            .iter_mut()
            .flat_map(|rule| rule.violations.iter_mut())
            .flat_map(|v| [&mut v.copy.fragment, &mut v.protected.fragment])
    }
}

/// One rule and the copies of its code found outside its boundary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuleReport {
    pub name: String,
    pub violations: Vec<Violation>,
}

/// A copy of protected code in a place its rule keeps the code out of.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Violation {
    /// How the copy matches the protected code: `exact` or `renamed` for a
    /// token clone, `similar` for a merged clone or a pair of functions of
    /// the same structure, `semantic` for a function that does the same
    /// thing written another way, often in another language.
    pub kind: CloneKind,
    /// For a `similar` copy, the mechanism that found it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub method: Option<SimilarityMethod>,
    /// For `similar` and `semantic` copies, the score of the match: matched
    /// tokens over the span (`gap`), the structural overlap of two functions
    /// (`ast`), or the cosine similarity of their embeddings (`semantic`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub similarity: Option<f32>,
    /// Detection tokens the copy holds: the matched tokens of a token clone,
    /// the tokens of the smaller function of a function pair.
    pub tokens: u32,
    /// The copy, in a place the rule keeps the code out of.
    pub copy: Place,
    /// The protected code it copies.
    pub protected: Place,
}

impl Violation {
    /// `similarity` rounded to three decimals, the form reports print.
    pub fn similarity_rounded(&self) -> Option<f64> {
        self.similarity
            .map(|s| (f64::from(s) * 1000.0).round() / 1000.0)
    }

    /// The lines of the copy, the first and the last included.
    pub fn copy_lines(&self) -> u32 {
        let fragment = &self.copy.fragment;
        fragment.end.line.saturating_sub(fragment.start.line) + 1
    }
}

/// One side of a violation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Place {
    pub fragment: Fragment,
    /// The function the fragment lies in, when jscpd finds functions in its
    /// language and the function has a name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub function: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Location;

    fn place(file: &str, from: u32, to: u32) -> Place {
        Place {
            fragment: Fragment::new(
                file,
                Location::new(from, 0, 0),
                Location::new(to, 0, 0),
                [0, 0],
            ),
            function: None,
        }
    }

    fn violation() -> Violation {
        Violation {
            kind: CloneKind::Semantic,
            method: None,
            similarity: Some(0.712_345),
            tokens: 40,
            copy: place("web/total.ts", 12, 40),
            protected: place("backend/Fees.kt", 20, 51),
        }
    }

    #[test]
    fn a_report_counts_the_violations_of_every_rule() {
        let report = BoundaryReport {
            rules: vec![
                RuleReport {
                    name: "money".into(),
                    violations: vec![violation(), violation()],
                },
                RuleReport {
                    name: "auth".into(),
                    violations: vec![],
                },
            ],
        };
        assert_eq!(report.violations(), 2);
    }

    #[test]
    fn the_copy_counts_its_first_and_last_line() {
        assert_eq!(violation().copy_lines(), 29);
        assert_eq!(violation().similarity_rounded(), Some(0.712));
    }

    #[test]
    fn every_fragment_can_be_rewritten() {
        let mut report = BoundaryReport {
            rules: vec![RuleReport {
                name: "money".into(),
                violations: vec![violation()],
            }],
        };
        for fragment in report.fragments_mut() {
            fragment.source_id = format!("/root/{}", fragment.source_id);
        }
        let v = &report.rules[0].violations[0];
        assert_eq!(v.copy.fragment.source_id, "/root/web/total.ts");
        assert_eq!(v.protected.fragment.source_id, "/root/backend/Fees.kt");
    }
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
    hash::{HASH_BASE, base_pow, roll, token_hash},
    models::{
        CloneKind, CpdClone, DetectionToken, Fragment, Location, MEMBER_NAME, SimilarityMethod,
        SourceFile, TokenKind, covered_lines,
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
                        renames: Renames::default(),
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
    /// Where the renamed identifiers repeat, for
    /// `--ignore-identifiers=consistent` (see [`Self::track_renames`]).
    /// Empty otherwise.
    pub renames: Renames,
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
        // applied; the default path allocates nothing extra. The tokens
        // before it hash as they are.
        let mut raw_hashes: Vec<u64> = Vec::new();
        let mut normalized = false;
        for (i, t) in tokens.iter().enumerate() {
            hashes.push(t.hash);
            spans.push((t.start.clone(), t.end.clone()));
            if !normalized && t.raw_hash != t.hash {
                normalized = true;
                raw_hashes.reserve(tokens.len());
                raw_hashes.extend(hashes[..i].iter().copied());
            }
            if normalized {
                raw_hashes.push(t.raw_hash);
            }
        }
        Self {
            id,
            format,
            hashes,
            spans,
            raw_hashes,
            renames: Renames::default(),
            real_path: String::new(),
            embedded: false,
        }
    }

    /// Records where each renamed identifier occurs again, so that detection
    /// matches names consistently (`--ignore-identifiers`, issue #1217): two
    /// fragments match only when every name stands for one name on the other
    /// side and no two names for the same one, so `d = a + b` matches
    /// `s = p + q` but not `x = x + x`. `tokens` are the tokens this source
    /// was made from; their `name` tells the renamed identifiers. Leaves a
    /// source without renamed identifiers as it is: its windows hash the
    /// same either way.
    ///
    /// A member's name ([`MEMBER_NAME`]) is another name than a local's of
    /// the same text, except as the first token of a window or part: the dot
    /// before it lies outside, so there it counts as a local (see
    /// [`Renames::back`]).
    pub fn track_renames(&mut self, tokens: &[DetectionToken]) {
        debug_assert_eq!(tokens.len(), self.hashes.len());
        if tokens.iter().all(|t| t.name == 0) {
            return;
        }
        let mut pre
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
        "markdown"
            | "asciidoc"
            | "rest"
            | "textile"
            | "wiki"
            | "txt"
            | "log"
            | "diff"
            | "gettext"
            | "shell-session"
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
            | "go-module"
            | "dns-zone-file"
            | "http"
            | "abnf"
            | "bnf"
            | "ebnf"
            | "regex"
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
            return Err(form
```

### Core Architecture Module: `rust/crates/cpd-core/src/history.rs`
```
//! Duplication and health trend over git history (`--history`, issue #1002).
//!
//! One [`HistoryPoint`] per scanned commit, oldest first, plus a final point
//! for the working tree. The CLI collects the points by scanning each commit
//! in a temporary worktree with the run's own configuration; this module only
//! holds the data model and the pure helpers reporters need (sparkline,
//! per-point change, health trend, threshold hint). Nothing here touches
//! git.

use crate::health::Health;
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
    /// The health score of the tree at this point; `None` when it was not
    /// scored.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub health: Option<PointHealth>,
}

impl HistoryPoint {
    pub fn is_working_tree(&self) -> bool {
        self.commit == WORKING_TREE
    }

    /// The health score, when the point has one.
    pub fn health_score(&self) -> Option<f64> {
        self.health.as_ref().and_then(|health| health.score)
    }
}

/// The health score of one point, the one `--health` gives the same tree,
/// from the dimensions jscpd measures itself: duplication, dead code and
/// complexity. The metrics of other tools (`--health-input`) describe the
/// working tree alone, so no point of a series is scored with them, the
/// working tree's included: a series is comparable only when every point is
/// built from the same kind of evidence.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointHealth {
    /// 0-100; `None` when the tree had no code to score.
    pub score: Option<f64>,
    /// `A` to `E`, as `--health` grades the score.
    pub grade: Option<char>,
    /// Lines of code files, the base of every share.
    pub code_lines: u64,
    /// The scored dimensions, in the order `--health` lists them. One that
    /// could not be measured at this point, such as dead code in a tree
    /// with no JavaScript, TypeScript or Python, is absent.
    pub dimensions: Vec<PointDimension>,
}

/// One scored dimension of a [`PointHealth`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointDimension {
    /// `duplication`, `dead-code` or `complexity`.
    pub id: String,
    /// The share of the code lines it found, in percent.
    pub value: Option<f64>,
    /// Its 0-100 sub-score.
    pub score: f64,
}

impl From<&Health> for PointHealth {
    /// The score, grade, size and dimensions of `health`, which the caller
    /// computed without external metrics.
    fn from(health: &Health) -> Self {
        Self {
            score: health.score,
            grade: health.grade,
            code_lines: health.size.lines,
            dimensions: health
                .dimensions
                .iter()
                .map(|d| PointDimension {
                    id: d.id.clone(),
                    value: d.value,
                    score: d.score,
                })
                .collect(),
        }
    }
}

impl PointHealth {
    /// The sub-score of dimension `id`, when it was scored.
    pub fn dimension(&self, id: &str) -> Option<&PointDimension> {
        self.dimensions.iter().find(|d| d.id == id)
    }
}

/// The series a `--history` run produces.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct History {
    /// What was walked, for display: `v5.0.0..HEAD`, `since 2026-01-01`.
    pub range: String,
    /// How many commits the range has, when the series samples fewer of
    /// them (`--history-limit`, `--history-every`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sampled_from: Option<usize>,
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

/// The dimensions one point was scored from and the latest point was not,
/// and the other way round. A score built from other dimensions than the
/// latest one is not directly comparable with it.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct DimensionGap {
    /// Scored at the latest point, not at this one.
    pub missing: Vec<String>,
    /// Scored at this point, not at the latest one.
    pub extra: Vec<String>,
}

impl DimensionGap {
    pub fn is_empty(&self) -> bool {
        self.missing.is_empty() && self.extra.is_empty()
    }
}

impl History {
    /// Percentages in series order.
    pub fn percentages(&self) -> Vec<f64> {
        self.points.iter().map(|p| p.percentage).collect()
    }

    pub fn sparkline(&self) -> String {
        sparkline(&self.percentages())
    }

    /// Health scores in series order; `None` where a point has none.
    pub fn health_scores(&self) -> Vec<Option<f64>> {
        self.points.iter().map(HistoryPoint::health_score).collect()
    }

    /// Whether any point has a health score.
    pub fn has_health(&self) -> bool {
        self.points.iter().any(|p| p.health_score().is_some())
    }

    /// The first point with a health score and the latest point, which must
    /// have one too: the span the health trend covers. `None` when they are
    /// the same point.
    pub fn health_trend(&self) -> Option<(&HistoryPoint, &HistoryPoint)> {
        let last = self.points.len().checked_sub(1)?;
        self.points[last].health_score()?;
        let first = self
            .points
            .iter()
            .position(|p| p.health_score().is_some())?;
        (first < last).then(|| (&self.points[first], &self.points[last]))
    }

    /// How the dimensions point `index` was scored from differ from the
    /// latest point's. Empty unless both have a score.
    pub fn dimension_gap(&self, index: usize) -> DimensionGap {
        fn scored(p: &HistoryPoint) -> Option<&PointHealth> {
            p.health.as_ref().filter(|h| h.score.is_some())
        }
        let (Some(point), Some(last)) = (
            self.points.get(index).and_then(scored),
            self.points.last().and_then(scored),
        ) else {
            return DimensionGap::default();
        };
        let not_in = |of: &PointHealth, other: &PointHealth| -> Vec<String> {
            of.dimensions
                .iter()
                .filter(|d| other.dimension(&d.id).is_none())
                .map(|d| d.id.clone())
                .collect()
        };
        DimensionGap {
            missing: not_in(last, point),
            extra: not_in(point, last),
        }
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
           
```

### Core Architecture Module: `rust/crates/cpd-core/src/lib.rs`
```
pub mod boundaries;
pub mod deadcode;
pub mod detect;
pub mod hash;
pub mod health;
pub mod history;
pub mod models;
pub mod paths;
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

/// The normalized syntax trees behind the score of a `--similarity` clone.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StructuralMatch {
    /// The language the two units are compared in: `python`, `typescript`
    /// (also for a pair with JavaScript), `javascript`, `java`, `go`,
    /// `rust` or `clojure`.
    pub language: String,
    /// The lists and atoms in the normalized tree of each fragment, in the
    /// order of the fragments.
    pub nodes: [u32; 2],
    /// The fingerprints the two trees share, and the ones either has.
    pub shared: u32,
    pub total: u32,
}

impl StructuralMatch {
    /// The Jaccard index of the two fingerprint sets.
    pub fn score(&self) -> f64 {
        match self.total {
            0 => 0.0,
            total => self.shared as f64 / total as f64,
        }
    }
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
    /// For `--similarity` clones: the normalized trees the score compares.
    /// `None` for every other clone.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub structure: Option<StructuralMatch>,
    /// Lines inside each fragment's span that are not duplicated code, for
    /// `fragment_a` and `fragment_b` in that order. Two things land here: the
    /// lines a `--max-gap-lines` merge left unmatched between its halves, and,
    /// for an embedded block, the host language's lines lying between two
    /// blocks of the same fragment (issue #1090). Statistics subtract them
    /// from the fragment's span.
    #[serde(skip)]
    pub unmatched_lines: [u32; 2],
    /// True for a part of a clone that consistent name matching
    /// (`--ignore-identifiers`) cut where a name stood for two, other than
    /// the first part: a gap merge must not join it to the part before it.
    #[serde(skip)]
    pub after_cut: bool,
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
    /// of its
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1224** (2026-10-19): **MCP check_duplication: a Vue, Svelte or Astro snippet never matches, by tokens or by meaning**
  *Symptoms*: ### Engine, version, install method, OS  v5 (Rust engine): `jscpd --mcp` of the released 5.4.1 and of master at 0d8d35b6. Linux x86_64.  ### Command and configuration  ```shell jscpd --mcp src ```  No `.jscpd.json`. The semantic part needs the model on the machine (`jscpd --semantic-download`).  ### What happens  `src/total.ts` holds a function, and `src/cart.vue` holds the same function in its `<script setup lang="ts">`. `check_duplication` with `kinds: ["exact"]`:  | `code` | `format` | `count` | |---|---|---| | `cart.vue` | `vue` | 0 | | `total.ts` | `typescript` | 2: `cart.vue` and `total.ts` |  By meaning it is the same. A project with `cartTotal` in `total.ts`, and snippets with `basketTotal`, written with `filter` and `reduce`, `kinds: ["semantic"]`:  | `code` | `format` | `count` | |---|---|---| | `basket.ts` | `typescript` | 1: `cartTotal`, 0.665 | | `basket.vue`, the same function in its script | `vue` | 0 | | `basket.svelte`, the same | `svelte` | 0 |  There is no `note` and nothing under `unavailable`, so an assistant takes the empty answer for "nothing like this exists yet" and writes the code again.  Two causes:  - tokens: `Project::check` (`crates/cpd/src/mcp/project.rs:708`) tokenizes the snippet as one stream of its format and matches it with the pool of that format (`:742`). A scan never makes a source of format `vue`: `FilePreparer::prepare` (`crates/cpd-finder/src/orchestrate.rs:564`) gives a component one source per block language, `html`, `typescript`, `

- **Issue #1223** (2026-10-19): **Markdown: front matter that runs into a code fence aborts jscpd, its MCP server and its language server**
  *Symptoms*: ### Engine, version, install method, OS  v5 (Rust engine): the released 5.4.1 and master at 0d8d35b6. Linux x86_64.  ### Command and configuration  ```shell jscpd docs ```  No `.jscpd.json`, no flags.  ### What happens  ``` thread '<unnamed>' panicked at crates/cpd-tokenizer/src/embedded.rs:50:13: overlapping ranges detected: [0, 122) overlaps [39, 126) Aborted (core dumped) ```  The exit code is 134: the release profile has `panic = "abort"`. `jscpd --mcp docs` answers `initialize` and then aborts in the same place during its startup scan, and `jscpd --lsp` aborts once its workspace holds such a file, so the assistant or the editor loses the server.  `docs/store.md` is an ordinary page: a horizontal rule on its first line, and a Python stub whose body is `...`:  ~~~markdown ---  The protocol a store implements.  ```python class Store(Protocol):     def get(self, key: str) -> bytes:         ... ``` ~~~  `extract_front_matter` (`crates/cpd-tokenizer/src/markdown.rs:163`) takes a file that starts with `---` for front matter, and `front_matter_closer` (`:190`) closes it at the first later line that is `---` or `...` once trimmed: here the `...` inside the fence. So the front matter runs over bytes 0 to 122, across the fence at 39 to 126. `tokenize_markdown_maps` (`:278`) and `tokenize_markdown` (`:347`) blank both with `blank_ranges_preserve_newlines` (`crates/cpd-tokenizer/src/embedded.rs:44`), which panics on ranges that overlap.  A fence that opens inside real front matter fa

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

### Incident Patch 1: `2177d563` (2026-10-20)
**Commit Message**: Merge pull request #1230 from kucherenko/fix/basic-toml-advisory

fix(deps): build askama without its config feature, basic-toml is unmaintained

**File**: `rust/Cargo.lock` (modified, +0/-21)
```diff
@@ -148,14 +148,10 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "071ee5ebf2138e3ad180e0aacf6940c2cab5e6d8333741d9925c7bee2b153f39"
 dependencies = [
  "askama_parser",
- "basic-toml",
- "glob",
  "memchr",
  "proc-macro2",
  "quote",
  "rustc-hash",
- "serde",
- "serde_derive",
  "syn 3.0.6",
 ]
 
@@ -175,8 +171,6 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "2c5ae75772275d268b03ab8bdccdd12117b6169ee23256942b34e46c9f476583"
 dependencies = [
  "rustc-hash",
- "serde",
- "serde_derive",
  "unicode-ident",
  "winnow",
 ]
@@ -235,15 +229,6 @@ version = "1.8.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "2af50177e190e07a26ab74f8b1efbfe2ef87da2116221318cb1c2e82baf7de06"
 
-[[package]]
-name = "basic-toml"
-version = "0.1.10"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ba62675e8242a4c4e806d12f11d136e626e6c8361d6b829310732241652a178a"
-dependencies = [
- "serde",
-]
-
 [[package]]
 name = "basta"
 version = "0.3.2"
@@ -1374,12 +1359,6 @@ dependencies = [
  "r-efi 6.0.0",
 ]
 
-[[package]]
-name = "glob"
-version = "0.3.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e4eba85ea1d0a966a983acd07deee566e67395d2d96b6fb39e62b5a833f1eb0b"
-
 [[package]]
 name = "globset"
 version = "0.4.20"
```

**File**: `rust/crates/cpd-reporter/Cargo.toml` (modified, +3/-1)
```diff
@@ -19,5 +19,7 @@ serde = { version = "1", features = ["derive"] }
 serde_json = "1"
 quick-xml = { version = "0.42", features = ["serialize"] }
 csv = "1"
-askama = "0.16"
+# Without the default `config` feature: jscpd has no askama.toml, and the
+# feature pulls in basic-toml, which is unmaintained (RUSTSEC-2026-0374).
+askama = { version = "0.16", default-features = false, features = ["derive", "std"] }
 xxhash-rust = { version = "0.8", features = ["xxh3"] }
```

---

### Incident Patch 2: `60b7b192` (2026-10-20)
**Commit Message**: Merge pull request #1232 from kucherenko/fix/npm-processing-wait

ci(release): wait up to 30 minutes for npm to serve a new version

**File**: `.github/workflows/npm-rust-publish.yml` (modified, +16/-14)
```diff
@@ -309,7 +309,7 @@ jobs:
       - build
     if: ${{ always() && needs.build.result == 'success' }}
     runs-on: ubuntu-latest
-    timeout-minutes: 30
+    timeout-minutes: 45
     permissions:
       contents: read
       id-token: write # npm publish --provenance
@@ -335,14 +335,17 @@ jobs:
           # npm reads are eventually consistent: a platform package published
           # seconds earlier by the matrix job can still be invisible here
           # (5.1.2 and 5.2.0 both failed this gate on jscpd-windows-x64-msvc,
-          # which appeared ~3 min after its publish succeeded). Re-check only
-          # the packages still missing, against one shared deadline, the same
-          # way the release-notes step in release.yml does.
+          # which appeared ~3 min after its publish succeeded). npm now also
+          # answers "Your package is being processed" and serves the version
+          # later: on 5.4.2 that took 1 to 20 minutes per package, and this
+          # gate failed after 5. Re-check only the packages still missing,
+          # against one shared deadline, the same way the release-notes step in
+          # release.yml does.
           missing=()
           for pkg in $targets; do
             missing+=("${pkg}")
           done
-          deadline=$(( $(date +%s) + 300 ))
+          deadline=$(( $(date +%s) + 1800 ))
           while true; do
             still_missing=()
             for pkg in "${missing[@]}"; do
@@ -363,7 +366,7 @@ jobs:
             for pkg in "${missing[@]}"; do
               echo "::error title=Missing platform package::${pkg}@${version} is not published"
             done
-            echo "Missing ${#missing[@]} platform packages after 5 min; cannot publish main package"
+            echo "Missing ${#missing[@]} platform packages after 30 min; cannot publish main package"
             exit 1
           fi
 
@@ -385,7 +388,7 @@ jobs:
       - version
       - publish-main
     runs-on: ubuntu-latest
-    timeout-minutes: 15
+    timeout-minutes: 45
     permissions:
       contents: read
       id-token: write # npm publish --provenance
@@ -397,19 +400,18 @@ jobs:
         working-directory: rust
         run: |
           version="${{ needs.version.outputs.version }}"
-          # ponytail: npm registry CDN propagates with eventual consistency;
-          # a freshly published cpd@${version} may 404 for seconds-to-minutes.
-          # Poll npm view before installing. Switch to a registry webhook if
-          # propagation latency ever exceeds ~5 minutes regularly.
-          for i in $(seq 1 30); do
+          # npm serves a freshly published cpd@${version} after a delay: the
+          # registry processes a new version first, which took up to 20
+          # minutes per package on 5.4.2. Poll npm view before installing.
+          for i in $(seq 1 180); do
             if npm view "cpd@${version}" version >/dev/null 2>&1; then
               npm install -g "cpd@${version}"
               exit 0
             fi
-            echo "Attempt $i/30: waiting for cpd@${version} to propagate on npm..."
+            echo "Attempt $i/180: waiting for cpd@${version} to propagate on npm..."
             sleep 10
           done
-          echo "::error::cpd@${version} never became installable on npm after ~5 minutes"
+          echo "::error::cpd@${version} never became installable on npm after ~30 minutes"
           exit 1
 
       - name: Fixture check
```

**File**: `.github/workflows/release.yml` (modified, +6/-4)
```diff
@@ -375,13 +375,15 @@ jobs:
           # npm reads are eventually consistent: a package published seconds
           # earlier can still be invisible here, which listed it under "Not Yet
           # Published" in the release notes even though the publish succeeded
-          # (v5.1.0 hit this with the jscpd wrapper). Re-check only the packages
-          # still missing, against one shared deadline so a genuinely
-          # unpublished package can't stretch the wait.
+          # (v5.1.0 hit this with the jscpd wrapper). npm also processes a new
+          # version before it serves it, which took up to 20 minutes per
+          # package on 5.4.2. Re-check only the packages still missing, against
+          # one shared deadline so a genuinely unpublished package can't
+          # stretch the wait.
           npm_pkgs=(cpd jscpd jscpd-darwin-arm64 jscpd-darwin-x64 jscpd-linux-x64-gnu jscpd-linux-arm64-gnu jscpd-linux-x64-musl jscpd-linux-arm64-musl jscpd-windows-x64-msvc jscpd-windows-arm64-msvc)
           missing=("${npm_pkgs[@]}")
           resolved=""
-          deadline=$(( $(date +%s) + 300 ))
+          deadline=$(( $(date +%s) + 1800 ))
           while true; do
             still_missing=()
             for pkg in "${missing[@]}"; do
```

---

### Incident Patch 3: `91dce233` (2026-10-20)
**Commit Message**: fix(deps): build askama without its config feature, basic-toml is unmaintained

**File**: `rust/Cargo.lock` (modified, +0/-21)
```diff
@@ -148,14 +148,10 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "071ee5ebf2138e3ad180e0aacf6940c2cab5e6d8333741d9925c7bee2b153f39"
 dependencies = [
  "askama_parser",
- "basic-toml",
- "glob",
  "memchr",
  "proc-macro2",
  "quote",
  "rustc-hash",
- "serde",
- "serde_derive",
  "syn 3.0.6",
 ]
 
@@ -175,8 +171,6 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "2c5ae75772275d268b03ab8bdccdd12117b6169ee23256942b34e46c9f476583"
 dependencies = [
  "rustc-hash",
- "serde",
- "serde_derive",
  "unicode-ident",
  "winnow",
 ]
@@ -235,15 +229,6 @@ version = "1.8.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "2af50177e190e07a26ab74f8b1efbfe2ef87da2116221318cb1c2e82baf7de06"
 
-[[package]]
-name = "basic-toml"
-version = "0.1.10"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ba62675e8242a4c4e806d12f11d136e626e6c8361d6b829310732241652a178a"
-dependencies = [
- "serde",
-]
-
 [[package]]
 name = "basta"
 version = "0.3.2"
@@ -1374,12 +1359,6 @@ dependencies = [
  "r-efi 6.0.0",
 ]
 
-[[package]]
-name = "glob"
-version = "0.3.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e4eba85ea1d0a966a983acd07deee566e67395d2d96b6fb39e62b5a833f1eb0b"
-
 [[package]]
 name = "globset"
 version = "0.4.20"
```

**File**: `rust/crates/cpd-reporter/Cargo.toml` (modified, +3/-1)
```diff
@@ -19,5 +19,7 @@ serde = { version = "1", features = ["derive"] }
 serde_json = "1"
 quick-xml = { version = "0.42", features = ["serialize"] }
 csv = "1"
-askama = "0.16"
+# Without the default `config` feature: jscpd has no askama.toml, and the
+# feature pulls in basic-toml, which is unmaintained (RUSTSEC-2026-0374).
+askama = { version = "0.16", default-features = false, features = ["derive", "std"] }
 xxhash-rust = { version = "0.8", features = ["xxh3"] }
```

#### Recent Merged Pull Requests:
- **PR #1232** (2026-10-20): ci(release): wait up to 30 minutes for npm to serve a new version (@kucherenko)
- **PR #1231** (2026-10-20): docs(changelog): link the 5.4.2 release post (@kucherenko)
- **PR #1230** (2026-10-20): fix(deps): build askama without its config feature, basic-toml is unmaintained (@kucherenko)
- **PR #1229** (2026-10-19): fix(mcp): follow-ups to checking a snippet block by block (@kucherenko)
- **PR #1228** (2026-10-19): fix(mcp): a component or Markdown snippet is checked block by block (@kucherenko)
- **PR #1227** (2026-10-19): feat(boundaries): rules that keep the code of a module in its boundary (@kucherenko)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
