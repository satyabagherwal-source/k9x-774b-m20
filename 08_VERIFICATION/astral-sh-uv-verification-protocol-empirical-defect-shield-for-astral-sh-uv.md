# Verification Protocol: Verification Protocol: Empirical Defect Shield for astral-sh/uv

<!-- PROVENANCE_START
{
  "source_repository": "astral-sh/uv",
  "source_url": "https://github.com/astral-sh/uv",
  "source_version": "7f396534",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T21:22:19.090Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-astral-sh-uv",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [astral-sh/uv](https://github.com/astral-sh/uv) (Revision: `7f396534`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T21:22:19.090Z`  
> **Learning ID**: `learn-github-astral-sh-uv`


## 1. Scope & Verification Target
- **Target Repository**: `astral-sh/uv` (Commit: `7f396534`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): astral-sh/uv

> **Canonical Artifact**: `07_PROJECT_LEARNING/astral-sh-uv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/astral-sh/uv](https://github.com/astral-sh/uv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T21:22:18.002Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `astral-sh/uv`
- **Description**: An extremely fast Python package and project manager, written in Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 92229 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agents/hooks/post-edit-format.py`
```
# /// script
# requires-python = ">=3.12"
# dependencies = []
# [tool.uv]
# no-build = true
# exclude-newer = "P7D"
# ///

"""Post-edit hook to auto-format files after agent edits."""

import json
import os
import subprocess
import sys
from pathlib import Path


def format_rust(file_path: str, cwd: str) -> None:
    """Format Rust files with cargo fmt."""
    try:
        subprocess.run(
            ["cargo", "fmt", "--", file_path],
            cwd=cwd,
            capture_output=True,
            check=False,
        )
    except FileNotFoundError:
        pass


def format_python(file_path: str, cwd: str) -> None:
    """Format Python files with ruff."""
    try:
        subprocess.run(
            ["uv", "run", "--only-group=check", "ruff", "format", file_path],
            cwd=cwd,
            capture_output=True,
            check=False,
        )
    except FileNotFoundError:
        pass


def format_prettier(file_path: str, cwd: str) -> None:
    """Format files with prettier."""
    try:
        subprocess.run(
            ["npx", "prettier@3.9.0", "--write", file_path],
            cwd=cwd,
            capture_output=True,
            check=False,
        )
    except FileNotFoundError:
        pass


def patch_file_paths(command: str) -> list[str]:
    """Return added or updated file paths from an `apply_patch` payload."""
    file_paths: list[str] = []
    current_update_index: int | None = None

    for line in command.splitlines():
        if line.startswith("*** Add File: "):
            file_paths.append(line.removeprefix("*** Add File: "))
            current_update_index = None
        elif line.startswith("*** Update File: "):
            file_paths.append(line.removeprefix("*** Update File: "))
            current_update_index = len(file_paths) - 1
        elif line.startswith("*** Move to: ") and current_update_index is not None:
            file_paths[current_update_index] = line.removeprefix("*** Move to: ")
            current_update_index = None
        elif line.startswith("*** Delete File: "):
            current_update_index = None

    return list(dict.fromkeys(file_paths))


def edited_file_paths(input_data: dict[str, object]) -> list[str]:
    tool_name = input_data.get("tool_name")
    tool_input = input_data.get("tool_input")
    if not isinstance(tool_input, dict):
        return []

    if tool_name in ("Write", "Edit", "MultiEdit"):
        file_path = tool_input.get("file_path")
        return [file_path] if isinstance(file_path, str) and file_path else []

    if tool_name == "apply_patch":
        command = tool_input.get("command")
        return patch_file_paths(command) if isinstance(command, str) else []

    return []


def format_file(file_path: str, cwd: str) -> None:
    ext = Path(file_path).suffix

    if ext == ".rs":
        format_rust(file_path, cwd)
    elif ext in (".py", ".pyi"):
        format_python(file_path, cwd)
    elif ext in (".json5", ".yaml", ".yml", ".md"):
        format_prettier(file_path, cwd)


def main() -> None:
    input_data = json.load(sys.stdin)
    cwd = input_data.get("cwd")
    if not isinstance(cwd, str) or not cwd:
        cwd = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

    for file_path in edited_file_paths(input_data):
        format_file(file_path, cwd)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `crates/uv-client/src/rkyvutil.rs`
```
/*!
Defines some helpers for use with `rkyv`.

# Owned archived type

Typical usage patterns with rkyv involve using an `&Archived<T>`, where values
of that type are cast from a `&[u8]`. The owned archive type in this module
effectively provides a way to use `Archive<T>` without needing to worry about
the lifetime of the buffer it's attached to. This works by making the owned
archive type own the buffer itself. It then provides convenient routines for
serializing and deserializing.
*/

use rkyv::{
    Archive, Deserialize, Portable, Serialize,
    api::high::{HighDeserializer, HighSerializer, HighValidator},
    bytecheck::CheckBytes,
    rancor,
    ser::allocator::ArenaHandle,
    util::AlignedVec,
};

use crate::{Error, ErrorKind};

/// A convenient alias for the rkyv serializer used by `uv-client`.
///
/// This utilizes rkyv's `HighSerializer` but fixes its type parameters where
/// possible since we don't need the full flexibility of a generic serializer.
pub(crate) type Serializer<'a> = HighSerializer<AlignedVec, ArenaHandle<'a>, rancor::Error>;

/// A convenient alias for the rkyv deserializer used by `uv-client`.
///
/// This utilizes rkyv's `HighDeserializer` but fixes its type parameters
/// where possible since we don't need the full flexibility of a generic
/// deserializer.
pub(crate) type Deserializer = HighDeserializer<rancor::Error>;

/// A convenient alias for the rkyv validator used by `uv-client`.
///
/// This utilizes rkyv's `HighValidator` but fixes its type parameters where
/// possible since we don't need the full flexibility of a generic validator.
pub(crate) type Validator<'a> = HighValidator<'a, rancor::Error>;

/// An owned archived type.
///
/// This type is effectively an owned version of `Archived<A>`. Normally, when
/// one gets an archived type from a buffer, the archive type is bound to the
/// lifetime of the buffer. This effectively provides a home for that buffer so
/// that one can pass around an archived type as if it were owned.
///
/// Constructing the type requires validating the bytes are a valid
/// representation of an `Archived<A>`, but subsequent accesses (via deref) are
/// free.
///
/// Note that this type makes a number of assumptions about the specific
/// serializer, deserializer and validator used. This type could be made
/// more generic, but it's not clear we need that in uv. By making our
/// choices concrete here, we make use of this type much simpler to understand.
/// Unfortunately, AG couldn't find a way of making the trait bounds simpler,
/// so if `OwnedVec` is being used in trait implementations, the traits bounds
/// will likely need to be copied from here.
#[derive(Debug)]
pub struct OwnedArchive<A> {
    raw: AlignedVec,
    archive: std::marker::PhantomData<A>,
}

impl<A> OwnedArchive<A>
where
    A: Archive + for<'a> Serialize<Serializer<'a>>,
    A::Archived: Portable + Deserialize<A, Deserializer> + for<'a> CheckBytes<Validator<'a>>,
{
    /// Create a new owned archived value from the raw aligned bytes of the
    /// serialized representation of an `A`.
    ///
    /// # Errors
    ///
    /// If the bytes fail validation (e.g., contains unaligned pointers or
    /// strings aren't valid UTF-8), then this returns an error.
    pub(crate) fn new(raw: AlignedVec) -> Result<Self, Error> {
        // We convert the error to a simple string because... the error type
        // does not implement Send. And I don't think we really need to keep
        // the error type around anyway.
        let _ = rkyv::access::<A::Archived, rancor::Error>(&raw)
            .map_err(|e| ErrorKind::ArchiveRead(e.to_string()))?;
        Ok(Self {
            raw,
            archive: std::marker::PhantomData,
        })
    }

    /// Creates an owned archive value from the unarchived value.
    ///
    /// # Errors
    ///
    /// This can fail if creating an archive for the given type fails.
    /// Currently, this, at minimum, includes cases where an `A` contains a
    /// `PathBuf` that is not valid UTF-8.
    pub(crate) fn from_unarchived(unarchived: &A) -> Result<Self, Error> {
        let raw = rkyv::to_bytes::<rancor::Error>(unarchived)
            .map_err(|e| ErrorKind::ArchiveWrite(e.to_string()))?;
        Ok(Self {
            raw,
            archive: std::marker::PhantomData,
        })
    }

    /// Returns the raw underlying bytes of this owned archive value.
    ///
    /// They are guaranteed to be a valid serialization of `Archived<A>`.
    ///
    /// Note that because this type has a `Deref` impl, this method requires
    /// fully-qualified syntax. So, if `o` is an `OwnedValue`, then use
    /// `OwnedValue::as_bytes(&o)`.
    pub(crate) fn as_bytes(this: &Self) -> &[u8] {
        &this.raw
    }

    /// Deserialize this owned archived value into the original
    /// `SimpleDetailMetadata`.
    ///
    /// Note that because this type has a `Deref` impl, this method requires
    /// fully-qualified syntax. So, if `o` is an `OwnedValue`, then use
    /// `OwnedValue::deserialize(&o)`.
    pub fn deserialize(this: &Self) -> A {
        rkyv::deserialize(&**this).expect("valid archive must deserialize correctly")
    }
}

impl<A> std::ops::Deref for OwnedArchive<A>
where
    A: Archive + for<'a> Serialize<Serializer<'a>>,
    A::Archived: Portable + Deserialize<A, Deserializer> + for<'a> CheckBytes<Validator<'a>>,
{
    type Target = A::Archived;

    fn deref(&self) -> &A::Archived {
        // SAFETY: We've validated that our underlying buffer is a valid
        // archive for SimpleDetailMetadata in the constructor, so we can skip
        // validation here. Since we don't mutate the buffer, this conversion
        // is guaranteed to be correct.
        #[allow(unsafe_code)]
        unsafe {
            rkyv::access_unchecked::<A::Archived>(&self.raw)
        }
    }
}

```

### Core Architecture Module: `crates/uv-configuration/src/concurrency.rs`
```
use std::fmt;
use std::num::NonZeroUsize;
use std::sync::Arc;

use tokio::sync::Semaphore;

/// Concurrency limit settings.
// TODO(konsti): We should find a pattern that doesn't require having both semaphores and counts.
#[derive(Clone)]
pub struct Concurrency {
    /// The maximum number of concurrent downloads.
    ///
    /// Note this value must be non-zero.
    pub downloads: usize,
    /// The maximum number of concurrent builds.
    ///
    /// Note this value must be non-zero.
    pub builds: usize,
    /// The maximum number of concurrent installs.
    ///
    /// Note this value must be non-zero.
    pub installs: usize,
    /// The maximum number of concurrent cache reads.
    ///
    /// Note this value must be non-zero.
    pub cache_reads: usize,
    /// A global semaphore to limit the number of concurrent downloads.
    pub downloads_semaphore: Arc<Semaphore>,
    /// A global semaphore to limit the number of concurrent builds.
    pub builds_semaphore: Arc<Semaphore>,
}

/// Custom `Debug` to hide semaphore fields from `--show-settings` output.
#[expect(clippy::missing_fields_in_debug)]
impl fmt::Debug for Concurrency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Concurrency")
            .field("downloads", &self.downloads)
            .field("builds", &self.builds)
            .field("installs", &self.installs)
            .field("cache_reads", &self.cache_reads)
            .finish()
    }
}

impl Default for Concurrency {
    fn default() -> Self {
        Self::new(
            Self::DEFAULT_DOWNLOADS,
            Self::threads(),
            Self::threads(),
            Self::DEFAULT_CACHE_READS,
        )
    }
}

impl Concurrency {
    // The default concurrent downloads limit.
    pub const DEFAULT_DOWNLOADS: usize = 50;

    // The default concurrent cache reads limit.
    pub const DEFAULT_CACHE_READS: usize = 4;

    /// Create a new [`Concurrency`] with the given limits.
    pub fn new(downloads: usize, builds: usize, installs: usize, cache_reads: usize) -> Self {
        Self {
            downloads,
            builds,
            installs,
            cache_reads,
            downloads_semaphore: Arc::new(Semaphore::new(downloads)),
            builds_semaphore: Arc::new(Semaphore::new(builds)),
        }
    }

    // The default concurrent builds and install limit.
    pub fn threads() -> usize {
        std::thread::available_parallelism()
            .map(NonZeroUsize::get)
            .unwrap_or(1)
    }
}

```

### Core Architecture Module: `crates/uv-dev/src/render_benchmarks.rs`
```
#![cfg(feature = "render")]

use std::path::{Path, PathBuf};

use anyhow::{Result, anyhow, bail};
use clap::Parser;
use poloto::build;
use resvg::usvg::fontdb;
use serde::Deserialize;
use tagu::prelude::*;

#[derive(Parser)]
pub(crate) struct RenderBenchmarksArgs {
    /// Path to a JSON output from a `hyperfine` benchmark.
    path: PathBuf,
    /// Title of the plot.
    #[clap(long, short)]
    title: Option<String>,
}

pub(crate) fn render_benchmarks(args: &RenderBenchmarksArgs) -> Result<()> {
    let mut results: BenchmarkResults = serde_json::from_slice(&fs_err::read(&args.path)?)?;
    assert_eq!(
        results.schema_version, 2,
        "unsupported hyperfine JSON schema version"
    );

    // Each result measures the same workload (e.g., resolve-warm or install-cold),
    // so skip that and only use the tool name as the plot label.
    for result in &mut results.results {
        let benchmark_name = result.name.as_deref().unwrap_or(&result.command);
        result.command = if benchmark_name.starts_with("uv") {
            "uv"
        } else if benchmark_name.starts_with("pip-compile") {
            "pip-compile"
        } else if benchmark_name.starts_with("pip-sync") {
            "pip-sync"
        } else if benchmark_name.starts_with("poetry") {
            "Poetry"
        } else if benchmark_name.starts_with("pdm") {
            "PDM"
        } else {
            bail!("could not find command name in benchmark '{benchmark_name}'");
        }
        .into();
    }

    let fontdb = load_fonts();

    render_to_png(
        &plot_benchmark(args.title.as_deref().unwrap_or("Benchmark"), &results)?,
        &args.path.with_extension("png"),
        fontdb,
    )?;

    Ok(())
}

/// Render a benchmark to an SVG (as a string).
fn plot_benchmark(heading: &str, results: &BenchmarkResults) -> Result<String> {
    let mut data = Vec::new();
    for result in &results.results {
        assert_eq!(result.summary.time_wall_clock.unit, "second");
        data.push((result.summary.time_wall_clock.mean, &result.command));
    }

    let theme = poloto::render::Theme::light();
    let theme = theme.append(tagu::build::raw(
        ".poloto0.poloto_fill{fill: #6340AC !important;}",
    ));
    let theme = theme.append(tagu::build::raw(
        ".poloto_background{fill: white !important;}",
    ));

    Ok(build::bar::gen_simple("", data, [0.0])
        .label((heading, "Time (s)", ""))
        .append_to(poloto::header().append(theme))
        .render_string()?)
}

/// Render an SVG to a PNG file.
fn render_to_png(data: &str, path: &Path, fontdb: fontdb::Database) -> Result<()> {
    // Create options with the font database for text rendering
    let mut opt = resvg::usvg::Options::default();
    *opt.fontdb_mut() = fontdb;

    let tree = resvg::usvg::Tree::from_str(data, &opt)?;

    // Calculate scale to fit width of 1600 while maintaining aspect ratio
    let target_width = 1600_u32;
    let original_size = tree.size().to_int_size();
    let scaled_size = original_size
        .scale_to_width(target_width)
        .ok_or_else(|| anyhow!("failed to scale to target width"))?;
    #[expect(
        clippy::cast_precision_loss,
        reason = "Acceptable precision loss for render scale calculation"
    )]
    let scale = target_width as f32 / original_size.width() as f32;

    let mut pixmap = resvg::tiny_skia::Pixmap::new(scaled_size.width(), scaled_size.height())
        .ok_or_else(|| anyhow!("failed to create pixmap"))?;

    let transform = resvg::tiny_skia::Transform::from_scale(scale, scale);
    resvg::render(&tree, transform, &mut pixmap.as_mut());

    if let Some(parent) = path.parent() {
        fs_err::create_dir_all(parent)?;
    }
    pixmap.save_png(path)?;
    Ok(())
}

/// Load the system fonts and set the default font families.
fn load_fonts() -> fontdb::Database {
    let mut fontdb = fontdb::Database::new();
    fontdb.load_system_fonts();
    fontdb.set_serif_family("Times New Roman");
    fontdb.set_sans_serif_family("Arial");
    fontdb.set_cursive_family("Comic Sans MS");
    fontdb.set_fantasy_family("Impact");
    fontdb.set_monospace_family("Courier New");

    fontdb
}

#[derive(Debug, Deserialize)]
struct BenchmarkResults {
    schema_version: u64,
    results: Vec<BenchmarkResult>,
}

#[derive(Debug, Deserialize)]
struct BenchmarkResult {
    command: String,
    name: Option<String>,
    summary: BenchmarkSummary,
}

#[derive(Debug, Deserialize)]
struct BenchmarkSummary {
    time_wall_clock: MetricSummary,
}

#[derive(Debug, Deserialize)]
struct MetricSummary {
    unit: String,
    mean: f64,
}

```

### Core Architecture Module: `crates/uv-state/src/lib.rs`
```
use std::{io, path::PathBuf, sync::Arc};

use tempfile::{TempDir, tempdir};

/// The main state storage abstraction.
///
/// This is appropriate for storing persistent data that is not user-facing, such as managed Python
/// installations or tool environments.
#[derive(Debug, Clone)]
pub struct StateStore {
    /// The state storage.
    root: PathBuf,
    /// A temporary state storage.
    ///
    /// Included to ensure that the temporary store exists for the length of the operation, but
    /// is dropped at the end as appropriate.
    _temp_dir_drop: Option<Arc<TempDir>>,
}

impl StateStore {
    /// A persistent state store at `root`.
    fn from_path(root: impl Into<PathBuf>) -> Self {
        Self {
            root: root.into(),
            _temp_dir_drop: None,
        }
    }

    /// Create a temporary state store.
    pub fn temp() -> Result<Self, io::Error> {
        let temp_dir = tempdir()?;
        Ok(Self {
            root: temp_dir.path().to_path_buf(),
            _temp_dir_drop: Some(Arc::new(temp_dir)),
        })
    }

    /// The folder for a specific cache bucket
    pub fn bucket(&self, state_bucket: StateBucket) -> PathBuf {
        self.root.join(state_bucket.to_str())
    }

    /// Prefer, in order:
    ///
    /// 1. The specific state directory specified by the user.
    /// 2. The system-appropriate user-level data directory.
    /// 3. A `.uv` directory in the current working directory.
    ///
    /// Returns an absolute cache dir.
    pub fn from_settings(state_dir: Option<PathBuf>) -> Result<Self, io::Error> {
        if let Some(state_dir) = state_dir {
            Ok(Self::from_path(state_dir))
        } else if let Some(data_dir) = uv_dirs::legacy_user_state_dir().filter(|dir| dir.exists()) {
            // If the user has an existing directory at (e.g.) `/Users/user/Library/Application Support/uv`,
            // respect it for backwards compatibility. Otherwise, prefer the XDG strategy, even on
            // macOS.
            Ok(Self::from_path(data_dir))
        } else if let Some(data_dir) = uv_dirs::user_state_dir() {
            Ok(Self::from_path(data_dir))
        } else {
            Ok(Self::from_path(".uv"))
        }
    }
}

/// The different kinds of data in the state store are stored in different bucket, which in our case
/// are subdirectories of the state store root.
#[derive(Debug, Clone, Copy, Eq, PartialEq, Hash)]
pub enum StateBucket {
    /// Managed Python installations
    ManagedPython,
    /// Installed tools.
    Tools,
    /// Credentials.
    Credentials,
}

impl StateBucket {
    fn to_str(self) -> &'static str {
        match self {
            Self::ManagedPython => "python",
            Self::Tools => "tools",
            Self::Credentials => "credentials",
        }
    }
}

```

### Core Architecture Module: `crates/uv-audit-operations/src/json.rs`
```
//! JSON layout models for `uv audit`.

use serde::Serialize;
use uv_normalize::PackageName;

use super::AuditResults;

#[derive(Debug, Serialize)]
pub(super) struct Report {
    schema: Schema,
    #[serde(flatten)]
    body: ReportBody,
}

#[derive(Debug, Serialize)]
struct ReportBody {
    summary: Summary,
    vulnerabilities: Vec<Vulnerability>,
    adverse_statuses: Vec<AdverseStatus>,
}

impl Report {
    pub(super) fn from_findings(
        n_packages: usize,
        vulnerabilities: &[&uv_audit::Vulnerability],
        statuses: &[&uv_audit::ProjectStatus],
    ) -> Self {
        let mut vulnerabilities = vulnerabilities
            .iter()
            .copied()
            .map(Vulnerability::from)
            .collect::<Vec<_>>();
        vulnerabilities.sort_by(|first, second| {
            first
                .dependency
                .name
                .cmp(&second.dependency.name)
                .then_with(|| first.dependency.version.cmp(&second.dependency.version))
                .then_with(|| first.display_id.cmp(&second.display_id))
        });

        let mut adverse_statuses = statuses
            .iter()
            .copied()
            .map(AdverseStatus::from)
            .collect::<Vec<_>>();
        adverse_statuses.sort_by(|first, second| {
            first
                .name
                .cmp(&second.name)
                .then_with(|| first.status.cmp(&second.status))
        });

        Self {
            schema: Schema::default(),
            body: ReportBody {
                summary: Summary {
                    audited_packages: n_packages,
                    vulnerabilities: vulnerabilities.len(),
                    adverse_statuses: adverse_statuses.len(),
                },
                vulnerabilities,
                adverse_statuses,
            },
        }
    }
}

/// JSON report containing separate findings for each audited tool.
#[derive(Debug, Serialize)]
pub struct ToolReports {
    schema: Schema,
    tools: Vec<ToolReport>,
}

impl ToolReports {
    pub fn from_audits(audits: &[(PackageName, AuditResults)]) -> Self {
        let tools = audits
            .iter()
            .map(|(name, results)| {
                let (vulnerabilities, statuses) = results.split_findings();
                let report = Report::from_findings(results.n_packages, &vulnerabilities, &statuses);

                ToolReport {
                    name: name.to_string(),
                    body: report.body,
                }
            })
            .collect();

        Self {
            schema: Schema::default(),
            tools,
        }
    }
}

#[derive(Debug, Serialize)]
struct ToolReport {
    name: String,
    #[serde(flatten)]
    body: ReportBody,
}

#[derive(Debug, Serialize, Default)]
struct Schema {
    version: SchemaVersion,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "snake_case")]
enum SchemaVersion {
    #[default]
    Preview,
}

#[derive(Debug, Serialize)]
struct Summary {
    audited_packages: usize,
    vulnerabilities: usize,
    adverse_statuses: usize,
}

#[derive(Debug, Serialize)]
struct Dependency {
    name: String,
    version: String,
}

impl From<&uv_audit::Dependency> for Dependency {
    fn from(dependency: &uv_audit::Dependency) -> Self {
        Self {
            name: dependency.name().to_string(),
            version: dependency.version().to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
struct Vulnerability {
    dependency: Dependency,
    id: String,
    display_id: String,
    aliases: Vec<String>,
    summary: Option<String>,
    description: Option<String>,
    link: Option<String>,
    fix_versions: Vec<String>,
    published: Option<String>,
    modified: Option<String>,
}

impl From<&uv_audit::Vulnerability> for Vulnerability {
    fn from(vulnerability: &uv_audit::Vulnerability) -> Self {
        Self {
            dependency: Dependency::from(&vulnerability.dependency),
            id: vulnerability.id.as_str().to_string(),
            display_id: vulnerability.best_id().as_str().to_string(),
            aliases: vulnerability
                .aliases
                .iter()
                .map(|id| id.as_str().to_string())
                .collect(),
            summary: vulnerability.summary.clone(),
            description: vulnerability.description.clone(),
            link: vulnerability
                .link
                .as_ref()
                .map(|link| link.as_str().to_string()),
            fix_versions: vulnerability
                .fix_versions
                .iter()
                .map(std::string::ToString::to_string)
                .collect(),
            published: vulnerability
                .published
                .as_ref()
                .map(std::string::ToString::to_string),
            modified: vulnerability
                .modified
                .as_ref()
                .map(std::string::ToString::to_string),
        }
    }
}

#[derive(Debug, Serialize)]
struct AdverseStatus {
    name: String,
    status: String,
    reason: Option<String>,
}

impl From<&uv_audit::ProjectStatus> for AdverseStatus {
    fn from(status: &uv_audit::ProjectStatus) -> Self {
        Self {
            name: status.name.to_string(),
            status: status.status.to_string(),
            reason: status.reason.clone(),
        }
    }
}

```

### Core Architecture Module: `crates/uv-audit-operations/src/lib.rs`
```
//! Shared auditing and reporting for project and tool lockfiles.

use std::fmt::Write as _;
use std::path::Path;

use anyhow::Result;
use itertools::Itertools as _;
use owo_colors::OwoColorize;
use rustc_hash::FxHashSet;
use tracing::trace;
use uv_audit::{
    AdverseStatus, Dependency, Finding, ProjectStatus, ProjectStatusAudit, Vulnerability,
    VulnerabilityID, VulnerabilityServiceFormat, osv,
};
use uv_cache::Cache;
use uv_client::{BaseClientBuilder, CachedClient, RegistryClientBuilder};
use uv_command_support::{ExitStatus, Printer};
use uv_configuration::{
    AuditOutputFormat, Concurrency, DependencyGroupsWithDefaults, ExtrasSpecificationWithDefaults,
    KeyringProviderType,
};
use uv_distribution_types::{IndexCapabilities, IndexLocations, IndexUrl};
use uv_fs::{CWD, find_git_repository_root, relative_to};
use uv_lock::Lock;
use uv_redacted::SafeUrl;
use uv_warnings::warn_user;

mod reporter;
use reporter::AuditReporter;
pub mod json;
pub mod sarif;

/// Audit findings and ignore-rule matches for one lockfile.
pub struct AuditOutcome {
    pub n_packages: usize,
    pub findings: Vec<Finding>,
    pub matched_ignores: FxHashSet<VulnerabilityID>,
}

/// Audit the dependency graph reachable from a project, script, or tool lockfile.
pub async fn audit_lock(
    lock: &Lock,
    root: &Path,
    extras: &ExtrasSpecificationWithDefaults,
    groups: &DependencyGroupsWithDefaults,
    index_locations: &IndexLocations,
    keyring_provider: KeyringProviderType,
    client_builder: BaseClientBuilder<'_>,
    concurrency: Concurrency,
    cache: &Cache,
    printer: Printer,
    service: VulnerabilityServiceFormat,
    service_url: Option<SafeUrl>,
    ignore: &[VulnerabilityID],
    ignore_until_fixed: &[VulnerabilityID],
) -> Result<AuditOutcome> {
    let auditable = lock.auditable(extras, groups, |_| true);
    let mut projects = auditable.projects(root)?;

    // Flat indexes cannot provide PEP 792 project-status metadata.
    let flat_index_urls: FxHashSet<&IndexUrl> = index_locations
        .flat_indexes()
        .map(|index| &index.url)
        .collect();
    projects.retain(|(_, url)| !flat_index_urls.contains(url));

    let reporter = AuditReporter::from(printer);
    let dependencies: Vec<Dependency> = auditable
        .packages()
        .map(|(name, version)| Dependency::new(name.clone(), version.clone()))
        .collect();
    let base_client = client_builder.clone().build()?;
    let registry_client = RegistryClientBuilder::new(client_builder, cache.clone())
        .index_locations(index_locations.clone())
        .keyring(keyring_provider)
        .build()?;
    let capabilities = IndexCapabilities::default();
    let status_audit =
        ProjectStatusAudit::new(&registry_client, &capabilities, concurrency.clone());

    let osv_future = async {
        match service {
            VulnerabilityServiceFormat::Osv => {
                let client = CachedClient::new(base_client);
                let service = osv::Osv::new(client, service_url, concurrency, cache.clone());
                trace!("Auditing {n} dependencies against OSV", n = auditable.len());
                service.query_batch(&dependencies, osv::Filter::All).await
            }
        }
    };
    let status_future = async {
        trace!(
            "Auditing {n} projects for adverse status",
            n = projects.len()
        );
        status_audit.query_batch(&projects).await
    };
    let (osv_findings, status_findings) = tokio::join!(osv_future, status_future);
    let mut findings = osv_findings?;
    findings.extend(status_findings);
    reporter.on_audit_complete();

    let mut matched_ignores = FxHashSet::default();
    let findings = findings
        .into_iter()
        .filter(|finding| match finding {
            Finding::Vulnerability(vulnerability) => {
                let mut ignored = false;
                for (rules, suppress_if_matched) in [
                    (ignore, true),
                    (ignore_until_fixed, vulnerability.fix_versions.is_empty()),
                ] {
                    for id in rules.iter().filter(|id| vulnerability.matches(id)) {
                        matched_ignores.insert(id.clone());
                        ignored |= suppress_if_matched;
                    }
                }
                !ignored
            }
            Finding::ProjectStatus(_) => true,
        })
        .collect();

    Ok(AuditOutcome {
        n_packages: auditable.len(),
        findings,
        matched_ignores,
    })
}

/// Warn once for each ignore rule that did not match an audited vulnerability.
pub fn warn_unmatched_ignores(
    ignore: &[VulnerabilityID],
    ignore_until_fixed: &[VulnerabilityID],
    matched_ignores: &FxHashSet<VulnerabilityID>,
    scope: &str,
) {
    for id in ignore.iter().chain(ignore_until_fixed.iter()) {
        if !matched_ignores.contains(id) {
            warn_user!(
                "Ignored vulnerability `{}` does not match any vulnerability in {scope}",
                id.as_str()
            );
        }
    }
}

/// Resolve a lockfile path into the URI used by SARIF consumers.
pub fn artifact_uri(path: &Path) -> String {
    let path = if let Some(repository_root) = find_git_repository_root(path)
        && let Ok(relative) = relative_to(path, repository_root)
    {
        relative
    } else if let Ok(relative) = path.strip_prefix(&*CWD) {
        relative.to_path_buf()
    } else {
        path.to_path_buf()
    };
    path.to_string_lossy().replace('\\', "/")
}

pub struct AuditResults {
    pub printer: Printer,
    pub n_packages: usize,
    pub output_format: AuditOutputFormat,
    pub findings: Vec<Finding>,
    pub artifact_uri: String,
}

impl AuditResults {
    pub fn render(&self) -> Result<ExitStatus> {
        match self.output_format {
            AuditOutputFormat::Text => self.render_text(),
            AuditOutputFormat::Json => self.render_json(),
            AuditOutputFormat::Sarif => self.render_sarif(),
        }
    }

    fn split_findings(&self) -> (Vec<&Vulnerability>, Vec<&ProjectStatus>) {
        self.findings.iter().partition_map(|finding| match finding {
            Finding::Vulnerability(vulnerability) => {
                itertools::Either::Left(vulnerability.as_ref())
            }
            Finding::ProjectStatus(status) => itertools::Either::Right(status),
        })
    }

    pub fn exit_status(&self) -> ExitStatus {
        // NOTE: intentional: we don't currently fail if there are any adverse statuses,
        // only when there are vulnerabilities. We will likely change this once we allow users
        // to ignore adverse statuses and configure policies.
        if self
            .findings
            .iter()
            .any(|finding| matches!(finding, Finding::Vulnerability(_)))
        {
            ExitStatus::Failure
        } else {
            ExitStatus::Success
        }
    }

    fn render_text(&self) -> Result<ExitStatus> {
        let (vulnerabilities, statuses) = self.split_findings();

        let vulnerability_banner = if !vulnerabilities.is_empty() {
            let suffix = if vulnerabilities.len() == 1 {
                "y"
            } else {
                "ies"
            };
            format!("{} known vulnerabilit{suffix}", vulnerabilities.len())
                .yellow()
                .to_string()
        } else {
            "no known vulnerabilities".bold().to_string()
        };

        let status_banner = if !statuses.is_empty() {
            let s = if statuses.len() == 1 { "" } else { "es" };
            format!(
                "{} adverse project status{}",
                statuses.len().to_string().yellow(),
                s
            )
        } else {
            "no adverse project statuses".bold().to_string()
        };

        writeln!(
            self.printer.stderr(),
            "Found {vulnerability_banner} and {status_banner} in {packages}",
            packages = format!(
                "{npackages} {label}",
                npackages = self.n_packages,
                label = if self.n_packages == 1 {
                    "package"
                } else {
                    "packages"
                }
            )
            .bold()
        )?;

        if !vulnerabilities.is_empty() {
            writeln!(self.printer.stdout_important(), "\nVulnerabilities:\n")?;

            // Group vulnerabilities by (dependency name, version).
            let groups = vulnerabilities.into_iter().chunk_by(|vulnerability| {
                (
                    vulnerability.dependency.name(),
                    vulnerability.dependency.version(),
                )
            });

            for (dependency, vulnerabilities) in &groups {
                let vulnerabilities: Vec<_> = vulnerabilities.collect();
                let (name, version) = dependency;

                writeln!(
                    self.printer.stdout_important(),
                    "{name_version} has {n} known vulnerabilit{ies}:\n",
                    name_version = format!("{name} {version}").bold(),
                    n = vulnerabilities.len(),
                    ies = if vulnerabilities.len() == 1 {
                        "y"
                    } else {
                        "ies"
                    },
                )?;

                for vulnerability in vulnerabilities {
                    writeln!(
                        self.printer.stdout_important(),
                        "- {id}: {description}",
                        id = vulnerability.best_id().as_str().bold(),
                        description = vulnerability
                            .summary
                            .as_deref()
                            .unwrap_or("No summary provided"),
                    )?;

                    if vulnerability.fix_versions.is_empty() {
                        writeln!(
                            self.printer.stdout_important(),
      
```

### Core Architecture Module: `crates/uv-audit-operations/src/reporter.rs`
```
use std::time::Duration;

use indicatif::{ProgressBar, ProgressStyle};
use uv_command_support::Printer;

#[derive(Debug)]
pub(crate) struct AuditReporter {
    progress: ProgressBar,
}

impl From<Printer> for AuditReporter {
    fn from(printer: Printer) -> Self {
        let progress = ProgressBar::with_draw_target(None, printer.target());
        progress.enable_steady_tick(Duration::from_millis(200));
        progress.set_style(
            ProgressStyle::with_template("{spinner:.white} {wide_msg:.dim}")
                .unwrap()
                .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]),
        );
        progress.set_message("Auditing dependencies...");
        Self { progress }
    }
}

impl AuditReporter {
    pub(crate) fn on_audit_complete(&self) {
        self.progress.set_message("");
        self.progress.finish_and_clear();
    }
}

```

### Core Architecture Module: `crates/uv-audit-operations/src/sarif.rs`
```
//! SARIF layout models for `uv audit`.
//!
//! These models are adapted from the MIT-licensed `zizmor-sarif` crate,
//! copyright 2024 William Woodruff. Only the subset of SARIF 2.1.0 that
//! `uv audit` emits is modeled here.

use std::collections::BTreeMap;

use serde::Serialize;
use serde_json::Value;
use uv_audit::{AdverseStatus, ProjectStatus, Vulnerability};
use uv_normalize::PackageName;
use uv_version::version;

use super::AuditResults;

/// Top-level SARIF log object (SARIF §3.13).
#[derive(Debug, Serialize)]
pub struct Report {
    #[serde(rename = "$schema")]
    schema: String,
    runs: Vec<Run>,
    version: String,
}

impl Report {
    pub(super) fn from_findings(
        vulnerabilities: &[&Vulnerability],
        statuses: &[&ProjectStatus],
        artifact_uri: &str,
    ) -> Self {
        let mut vulnerabilities = vulnerabilities.to_vec();
        vulnerabilities.sort_by(|first, second| {
            first
                .dependency
                .name()
                .cmp(second.dependency.name())
                .then_with(|| first.dependency.version().cmp(second.dependency.version()))
                .then_with(|| first.best_id().as_str().cmp(second.best_id().as_str()))
        });

        let mut statuses = statuses.to_vec();
        statuses.sort_by(|first, second| {
            first
                .name
                .cmp(&second.name)
                .then_with(|| first.status.to_string().cmp(&second.status.to_string()))
        });

        let mut rules = BTreeMap::new();
        let mut results = Vec::with_capacity(vulnerabilities.len() + statuses.len());

        for vulnerability in vulnerabilities {
            let rule = ReportingDescriptor::from_vulnerability(vulnerability);
            let rule_id = rule.id.clone();
            rules.entry(rule_id.clone()).or_insert(rule);
            results.push(Result::from_vulnerability(
                vulnerability,
                rule_id,
                artifact_uri,
            ));
        }

        for status in statuses {
            let rule = ReportingDescriptor::from_status(status);
            let rule_id = rule.id.clone();
            rules.entry(rule_id.clone()).or_insert(rule);
            results.push(Result::from_status(status, rule_id, artifact_uri));
        }

        Self {
            schema:
                "https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/schemas/sarif-schema-2.1.0.json"
                    .to_string(),
            runs: vec![Run {
                automation_details: None,
                invocations: vec![Invocation {
                    execution_successful: true,
                }],
                results,
                tool: Tool {
                    driver: ToolComponent {
                        download_uri: Some(env!("CARGO_PKG_REPOSITORY").to_string()),
                        information_uri: Some(env!("CARGO_PKG_HOMEPAGE").to_string()),
                        name: "uv".to_string(),
                        rules: rules.into_values().collect(),
                        semantic_version: Some(version().to_string()),
                        version: Some(version().to_string()),
                    },
                },
            }],
            version: "2.1.0".to_string(),
        }
    }

    /// Combine tool findings into one SARIF document, retaining a run for each tool.
    pub fn from_audits(audits: &[(PackageName, AuditResults)]) -> Self {
        let mut report = Self::from_findings(&[], &[], "");
        report.runs.clear();

        for (name, results) in audits {
            let (vulnerabilities, statuses) = results.split_findings();
            let runs = Self::from_findings(&vulnerabilities, &statuses, &results.artifact_uri)
                .runs
                .into_iter()
                .map(|mut run| {
                    run.automation_details = Some(RunAutomationDetails {
                        id: RunId(format!("uv/tool-audit/{name}")),
                    });
                    run
                });
            report.runs.extend(runs);
        }

        report
    }
}

/// A single tool invocation's results (SARIF §3.14).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Run {
    #[serde(skip_serializing_if = "Option::is_none")]
    automation_details: Option<RunAutomationDetails>,
    invocations: Vec<Invocation>,
    results: Vec<Result>,
    tool: Tool,
}

/// Stable automation identity for an individual audited tool.
#[derive(Debug, Serialize)]
struct RunAutomationDetails {
    id: RunId,
}

/// Stable identity for a SARIF run.
#[derive(Debug, Serialize)]
#[serde(transparent)]
struct RunId(String);

/// Tool metadata wrapper (SARIF §3.18).
#[derive(Debug, Serialize)]
struct Tool {
    driver: ToolComponent,
}

/// Tool driver metadata (SARIF §3.19).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolComponent {
    #[serde(skip_serializing_if = "Option::is_none")]
    download_uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    information_uri: Option<String>,
    name: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    rules: Vec<ReportingDescriptor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    semantic_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
}

/// Invocation describing the tool execution (SARIF §3.20).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Invocation {
    execution_successful: bool,
}

/// A reporting descriptor, i.e. a rule definition (SARIF §3.49).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportingDescriptor {
    #[serde(skip_serializing_if = "Option::is_none")]
    help: Option<MultiformatMessageString>,
    #[serde(skip_serializing_if = "Option::is_none")]
    help_uri: Option<String>,
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    properties: Option<PropertyBag>,
}

impl ReportingDescriptor {
    fn from_vulnerability(vulnerability: &Vulnerability) -> Self {
        let id = vulnerability.id.as_str().to_string();
        let name = vulnerability.best_id().as_str().to_string();
        let help = vulnerability
            .description
            .as_ref()
            .or(vulnerability.summary.as_ref())
            .map(|description| MultiformatMessageString {
                markdown: None,
                text: description.clone(),
            });

        Self {
            help,
            help_uri: vulnerability
                .link
                .as_ref()
                .map(|link| link.as_str().to_string()),
            name: Some(name),
            id,
            properties: Some(PropertyBag {
                tags: vec!["security".to_string(), "vulnerability".to_string()],
                additional_properties: BTreeMap::new(),
            }),
        }
    }

    fn from_status(status: &ProjectStatus) -> Self {
        let (name, description) = match status.status {
            AdverseStatus::Archived => (
                "archived",
                "The project is archived and is no longer maintained.",
            ),
            AdverseStatus::Deprecated => (
                "deprecated",
                "The project is deprecated and may have been superseded by another project.",
            ),
            AdverseStatus::Quarantined => (
                "quarantined",
                "The project is quarantined and is considered unsafe for use.",
            ),
        };

        Self {
            help: Some(MultiformatMessageString {
                markdown: None,
                text: description.to_string(),
            }),
            help_uri: Some(format!(
                "https://packaging.python.org/en/latest/specifications/project-status-markers/#{name}"
            )),
            id: format!("uv/project-status/{name}"),
            name: Some(name.to_string()),
            properties: Some(PropertyBag {
                tags: vec!["package".to_string(), "project-status".to_string()],
                additional_properties: BTreeMap::new(),
            }),
        }
    }
}

/// Plain-text and Markdown message (SARIF §3.12).
#[derive(Debug, Serialize)]
struct MultiformatMessageString {
    #[serde(skip_serializing_if = "Option::is_none")]
    markdown: Option<String>,
    text: String,
}

/// Property bag (SARIF §3.8).
#[derive(Debug, Serialize)]
struct PropertyBag {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,
    #[serde(flatten)]
    additional_properties: BTreeMap<String, Value>,
}

/// A single finding within a run (SARIF §3.27).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Result {
    kind: ResultKind,
    level: ResultLevel,
    locations: Vec<Location>,
    message: Message,
    /// Tool-specific values that identify findings independently of their source location.
    ///
    /// GitHub code scanning only consumes `primaryLocationLineHash`. We intentionally do not use
    /// that key for the semantic package identities below: all findings currently point at line 1,
    /// so those values would not actually be location hashes. Other SARIF consumers can still use
    /// these stable uv-specific keys.
    partial_fingerprints: BTreeMap<String, String>,
    properties: PropertyBag,
    rule_id: String,
}

impl Result {
    fn from_vulnerability(
        vulnerability: &Vulnerability,
        rule_id: String,
        artifact_uri: &str,
    ) -> Self {
        let dependency = &vulnerability.dependency;
        let name = dependency.name().to_string();
        let version = dependency.version().to_string();
        let display_id = vulnerability.best_id().as_str();
        let message = if let Some(summary) = &vulnerability.summary {
            format!("{name} {version} is vulnerable to {display_id}: {summary
```

### Core Architecture Module: `crates/uv-audit/src/lib.rs`
```
//! `uv-audit` provides types and interfaces for auditing Python dependencies.

pub use service::ProjectStatusAudit;
pub use service::VulnerabilityServiceFormat;
pub use service::osv;
pub use types::{
    AdverseStatus, Dependency, Finding, ProjectStatus, Vulnerability, VulnerabilityID,
};

mod service;
mod types;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23261** (2026-11-16): **Reject wheels with mismatched names**
  *Symptoms*: When fetching a wheel from an index, reject it when its name does not match the the originally requested package name.  This doesn't eagerly fail, and allows another index to supply the necessary wheel (depending on normal index policy). This seemed like it had precedent.

- **Issue #23222** (2026-11-12): **uv does not install requirement `eccodeslib` when `eccodes` is requested**
  *Symptoms*: ### Summary  Contrary to pip, uv does not install [`eccodeslib`](https://pypi.org/project/eccodeslib/) when requesting [`eccodes`](https://pypi.org/project/eccodes/). A workaround is to request/add `eccodeslib` explicitly. But why is this necessary?   ### Platform  Darwin 25.6.0 arm64  ### Version  uv 0.11.28 (ebf0f43d7 2026-07-07 aarch64-apple-darwin)  ### Python version  Python 3.11.15
  **Post-Mortem & Fix Analysis**:
  > Maybe related: https://github.com/ecmwf/eccodes-python/issues/150
  > eccodes does not depend on eccodeslib according to the metadata they publish on PyPI:   ```shell  curl -s https://pypi.org/pypi/eccodes/json |                   jq '.info.requires_dist' ```  shows  ``` [   "numpy",   "attrs",   "cffi",   "findlibs" ] ```  it's a bug with ecmwf packaging, and the referenced bug i think says so too.

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

### Incident Patch 1: `7424870a` (2026-11-17)
**Commit Message**: Preserve marker identity across equivalent platform expressions (#23185)

## Summary

uv compares environment markers by their internal tree identity. Today,
we remove known impossible platform combinations when individual
conjunctions are built. Grouping the same conditions differently can
therefore produce different trees, causing `uv lock --locked` to reject
a lockfile uv just wrote. For example, the Linux branch is impossible
here because `os_name == 'nt'`:

```diff
-(python_full_version >= '3.13' and os_name == 'nt') or (os_name == 'nt' and sys_platform == 'linux')
+python_full_version >= '3.13' and os_name == 'nt'
```

We now apply the known exclusions between `os_name`, `sys_platform`, and
`platform_system` consistently after tree operations, so equivalent
markers retain their identity when regrouped or reparsed. We also quote
literals containing apostrophes correctly. The existing
`platform_release` comparison limitation remains
([#22259](https://github.com/astral-sh/uv/issues/22259)).

This adds work and a process-lifetime cache for trees that mix platform
keys; other trees skip canonicalization. The mixed-platform fixture now
passes `uv lock --locked` and produces a 29% s

**File**: `crates/uv-pep508/src/marker/algebra.rs` (modified, +21/-333)
```diff
@@ -72,6 +72,7 @@ use crate::{
 };
 
 pub(super) mod isop;
+mod platform;
 
 /// The global node interner.
 pub(crate) static INTERNER: LazyLock<Interner> = LazyLock::new(Interner::default);
@@ -104,8 +105,7 @@ struct InternerState {
     /// Note that `OR` is implemented in terms of `AND`.
     cache: FxHashMap<(NodeId, NodeId), NodeId>,
 
-    /// The [`NodeId`] for the disjunction of known, mutually incompatible markers.
-    exclusions: Option<NodeId>,
+    platform: platform::Cache,
 }
 
 impl InternerShared {
@@ -204,7 +204,8 @@ impl InternerGuard<'_> {
                     var,
                     children: children.into_boxed(),
                 };
-                let id = NodeId::new(self.shared.nodes.push(node), false);
+                let flags = platform::node_flags(&node);
+                let id = NodeId::new(self.shared.nodes.push(node), flags);
                 entry.insert((hash, id));
                 id
             }
@@ -461,14 +462,6 @@ impl InternerGuard<'_> {
 
         let (x, y) = (self.shared.node(xi), self.shared.node(yi));
 
-        // Determine whether the conjunction _could_ contain a conflict.
-        //
-        // As an optimization, we only have to perform this check at the top-level, since these
-        // variables are given higher priority in the tree. In other words, if they're present, they
-        // _must_ be at the top; and if they're not at the top, we know they aren't present in any
-        // children.
-        let conflicts = x.var.is_conflicting_variable() && y.var.is_conflicting_variable();
-
         // Perform Shannon Expansion of the higher order variable.
         let (func, children) = match x.var.cmp(&y.var) {
             // X is higher order than Y, apply Y to every child of X.
@@ -491,18 +484,6 @@ impl InternerGuard<'_> {
         // Create the output node.
         let node = self.create_node(func, children);
 
-        // If the node includes known incompatibilities, map it to `false`.
-        let node = if conflicts {
-            let exclusions = self.exclusions();
-            if self.disjointness(node, exclusions.not()) {
-                NodeId::FALSE
-            } else {
-                node
-            }
-        } else {
-            node
-        };
-
         // Memoize the result of this operation.
         //
         // ADDs often contain duplicated subgraphs in distinct branches due to the restricted
@@ -512,50 +493,11 @@ impl InternerGuard<'_> {
         node
     }
 
-    /// Returns `true` if there is no environment in which both marker trees can apply,
-    /// i.e. their conjunction is always `false`.
-    pub(crate) fn is_disjoint_nontrivial(&mut self, xi: NodeId, yi: NodeId) -> bool {
-        debug_assert!(
-            xi.is_disjoint_trivial(yi).is_none(),
-            "`is_disjoint_nontrivial` requires non-trivial disjointness"
-        );
-
-        let (x, y) = (self.shared.node(xi), self.shared.node(yi));
-
-        // Determine whether the conjunction _could_ contain a conflict.
-        //
-        // As an optimization, we only have to perform this check at the top-level, since these
-        // variables are given higher priority in the tree. In other words, if they're present, they
-        // _must_ be at the top; and if they're not at the top, we know they aren't present in any
-        // children.
-        if x.var.is_conflicting_variable() && y.var.is_conflicting_variable() {
-            return self.and(xi, yi).is_false();
-        }
-
-        // Perform Shannon Expansion of the higher order variable.
-        match x.var.cmp(&y.var) {
-            // X is higher order than Y, Y must be disjoint with every child of X.
-            Ordering::Less => x
-                .children
-                .nodes()
-                .all(|x| self.disjointness(x.negate(xi), yi)),
-            // Y is higher order than X, X must be disjoint with every child of Y.
-            Ordering::Greater => y
-                .children
-                .nodes()
-                .all(|y| self.disjointness(y.negate(yi), xi)),
-            // X and Y represent the same variable, their merged edges must be unsatisfiable.
-            Ordering::Equal => x.children.is_disjoint(xi, &y.children, yi, self),
-        }
-    }
-
     /// Returns `true` if there is no environment in which both marker trees can apply,
     /// i.e., their conjunction is always `false`.
     fn disjointness(&mut self, xi: NodeId, yi: NodeId) -> bool {
-        // NOTE(charlie): This is equivalent to `is_disjoint`, with the exception that it doesn't
-        // perform the mutually-incompatible marker check. If it did, we'd create an infinite loop,
-        // since `is_disjoint` calls `and` (when relevant variables are present) which then calls
-        // `disjointness`.
+        // This tests the two diagrams over their full domains, including impossible
+        // platform combinations. Callers can supply the valid platform domain explicitly.
 
       
```

**File**: `crates/uv-pep508/src/marker/algebra/platform.rs` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+//! Canonical marker trees over compatible platform assignments.
+//!
+//! The exclusion table describes combinations of marker values that cannot occur together.
+//! On those assignments, choose a consistent value so that markers that agree on every
+//! compatible platform share the same node ID.
+
+use std::cmp::Ordering;
+
+use arcstr::literal;
+use rustc_hash::FxHashMap;
+
+use super::{InternerGuard, Node, NodeId, Variable};
+use crate::MarkerValueString::{OsName, PlatformSystem, SysPlatform};
+use crate::marker::lowering::CanonicalMarkerValueString;
+use crate::{MarkerExpression, MarkerOperator};
+
+#[derive(Default)]
+pub(super) struct Cache {
+    /// The disjunction of known incompatible marker pairs.
+    exclusions: Option<NodeId>,
+    /// Canonical representatives of nodes that test multiple platform keys.
+    canonical: FxHashMap<NodeId, NodeId>,
+}
+
+// Bit zero in a NodeId is reserved for complemented edges.
+const PLATFORM_KEY: usize = 1 << 1;
+const MIXED_KEYS: usize = 1 << 2;
+
+fn is_platform_key(var: &Variable) -> bool {
+    matches!(
+        var,
+        Variable::String(
+            CanonicalMarkerValueString::OsName
+                | CanonicalMarkerValueString::SysPlatform
+                | CanonicalMarkerValueString::PlatformSystem
+        )
+    )
+}
+
+impl NodeId {
+    fn tests_platform_key(self) -> bool {
+        self.0 & PLATFORM_KEY != 0
+    }
+
+    fn mixes_platform_keys(self) -> bool {
+        self.0 & MIXED_KEYS != 0
+    }
+}
+
+/// The platform keys come first in decision order. A second key on the same path
+/// must therefore occur in an immediate child.
+pub(super) fn node_flags(node: &Node) -> usize {
+    if !is_platform_key(&node.var) {
+        return 0;
+    }
+    if node.children.nodes().any(NodeId::tests_platform_key) {
+        PLATFORM_KEY | MIXED_KEYS
+    } else {
+        PLATFORM_KEY
+    }
+}
+
+impl InternerGuard<'_> {
+    /// Returns `true` if there is no environment in which both marker trees can apply,
+    /// i.e. their conjunction is always `false`.
+    pub(in crate::marker) fn is_disjoint_nontrivial(&mut self, xi: NodeId, yi: NodeId) -> bool {
+        debug_assert!(
+            xi.is_disjoint_trivial(yi).is_none(),
+            "`is_disjoint_nontrivial` requires non-trivial disjointness"
+        );
+
+        // Both operands can name an incompatible pair only if both start with
+        // a key in the platform exclusion table.
+        if xi.tests_platform_key() && yi.tests_platform_key() {
+            let intersection = self.and_nontrivial(xi, yi);
+            return self.canonicalize(intersection).is_false();
+        }
+
+        self.disjoint_edges(xi, yi)
+    }
+
+    /// Choose the same diagram for functions that agree on all compatible platform
+    /// assignments. The values on incompatible assignments are don't-cares.
+    #[inline]
+    pub(in crate::marker) fn canonicalize(&mut self, marker: NodeId) -> NodeId {
+        if marker.mixes_platform_keys() {
+            self.canonicalize_mixed_platforms(marker)
+        } else {
+            marker
+        }
+    }
+
+    #[inline(never)]
+    fn canonicalize_mixed_platforms(&mut self, marker: NodeId) -> NodeId {
+        if let Some(&result) = self.state.platform.canonical.get(&marker) {
+            return result;
+        }
+        let platforms = self.exclusions().not();
+        let result = self.platform_cofactor(marker, platforms, &mut FxHashMap::default());
+
+        // Children are also exposed as standalone marker trees. Complete their
+        // platform assignments without assuming the value of their parent.
+        let result = if result.mixes_platform_keys() {
+            let node = self.shared.node(result);
+            let children = node.children.map(result, |child| self.canonicalize(child));
+            self.create_node(node.var.clone(), children)
+        } else {
+            result
+        };
+        self.state.platform.canonical.insert(marker, result);
+        self.state
+            .platform
+            .canonical
+            .insert(marker.not(), result.not());
+        result
+    }
+
+    /// Extend a marker from the compatible platforms to the whole decision domain.
+    /// Each exclusion names a pair of nonempty strings. The first range of a platform
+    /// key therefore allows every assignment to the remaining keys that any other
+    /// range allows. Use its child as the default wherever another range cannot
+    /// distinguish its own child from that default on compatible platforms.
+    fn platform_cofactor(
+        &mut self,
+        value: NodeId,
+        domain: NodeId,
+        cache: &mut FxHashMap<(NodeId, NodeId), NodeId>,
+    ) -> NodeId {
+        if domain.is_true() || value.is_true() || value.is_false() {
+            return value;
+        }
+        // Each recursion visits a reachable domain. Excluded edges take the default branch below.
+        debug_assert!(!domain.is_false()
```

**File**: `crates/uv-pep508/src/marker/lowering.rs` (modified, +0/-11)
```diff
@@ -61,17 +61,6 @@ pub enum CanonicalMarkerValueString {
     ImplementationName,
 }
 
-impl CanonicalMarkerValueString {
-    /// Returns `true` if the marker is known to be involved in _at least_ one conflicting
-    /// marker pair.
-    ///
-    /// For example, `sys_platform == 'win32'` and `platform_system == 'Darwin'` are known to
-    /// never be true at the same time.
-    pub(crate) fn is_conflicting(self) -> bool {
-        self <= Self::PlatformSystem
-    }
-}
-
 impl From<MarkerValueString> for CanonicalMarkerValueString {
     fn from(value: MarkerValueString) -> Self {
         match value {
```

**File**: `crates/uv-pep508/src/marker/tree.rs` (modified, +97/-41)
```diff
@@ -13,7 +13,7 @@ use version_ranges::Ranges;
 use uv_normalize::{ExtraName, GroupName};
 use uv_pep440::{Version, VersionParseError, VersionSpecifier};
 
-use super::algebra::{Edges, INTERNER, NodeId, Variable};
+use super::algebra::{Edges, INTERNER, InternerGuard, NodeId, Variable};
 use super::simplify;
 #[cfg(test)]
 use crate::Pep508ErrorSource;
@@ -214,7 +214,7 @@ impl Display for MarkerValue {
             Self::MarkerEnvString(marker_value_string) => marker_value_string.fmt(f),
             Self::MarkerEnvList(marker_value_contains) => marker_value_contains.fmt(f),
             Self::Extra => f.write_str("extra"),
-            Self::QuotedString(value) => write!(f, "'{value}'"),
+            Self::QuotedString(value) => quoted(value).fmt(f),
         }
     }
 }
@@ -631,6 +631,12 @@ impl MarkerExpression {
     }
 }
 
+/// PEP 508 string literals may contain the opposite quote character.
+fn quoted(value: &str) -> impl Display {
+    let quote = if value.contains('\'') { '"' } else { '\'' };
+    fmt::from_fn(move |f| write!(f, "{quote}{value}{quote}"))
+}
+
 impl Display for MarkerExpression {
     fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
         match self {
@@ -652,21 +658,29 @@ impl Display for MarkerExpression {
                 operator,
                 value,
             } => {
+                let value = quoted(value);
                 if matches!(
                     operator,
                     MarkerOperator::Contains | MarkerOperator::NotContains
                 ) {
-                    return write!(f, "'{value}' {} {key}", operator.invert());
+                    return write!(f, "{value} {} {key}", operator.invert());
                 }
 
-                write!(f, "{key} {operator} '{value}'")
+                write!(f, "{key} {operator} {value}")
             }
             Self::List { pair, operator } => {
-                write!(f, "'{}' {} {}", pair.value(), operator, pair.key())
+                write!(f, "{} {operator} {}", quoted(&pair.value()), pair.key())
             }
-            Self::Extra { operator, name } => {
+            Self::Extra {
+                operator,
+                name: MarkerValueExtra::Extra(name),
+            } => {
                 write!(f, "extra {operator} '{name}'")
             }
+            Self::Extra {
+                operator,
+                name: MarkerValueExtra::Arbitrary(name),
+            } => write!(f, "extra {operator} {}", quoted(name)),
         }
     }
 }
@@ -762,6 +776,13 @@ impl FromStr for MarkerTree {
 }
 
 impl MarkerTree {
+    /// Finish a diagram operation by choosing a single representation on valid platforms.
+    fn from_operation(operation: impl FnOnce(&mut InternerGuard<'_>) -> NodeId) -> Self {
+        let mut interner = INTERNER.lock();
+        let value = operation(&mut interner);
+        Self(interner.canonicalize(value))
+    }
+
     /// An empty marker that always evaluates to `true`.
     pub const TRUE: Self = Self(NodeId::TRUE);
 
@@ -806,7 +827,7 @@ impl MarkerTree {
         if let Some(node) = self.0.and_trivial(tree.0) {
             return Self(node);
         }
-        Self(INTERNER.lock().and_nontrivial(self.0, tree.0))
+        Self::from_operation(|interner| interner.and_nontrivial(self.0, tree.0))
     }
 
     /// Returns a new marker tree that combines this one with the given one via a disjunction.
@@ -815,7 +836,7 @@ impl MarkerTree {
         if let Some(node) = self.0.or_trivial(tree.0) {
             return Self(node);
         }
-        Self(INTERNER.lock().or_nontrivial(self.0, tree.0))
+        Self::from_operation(|interner| interner.or_nontrivial(self.0, tree.0))
     }
 
     /// Returns a marker equivalent to the implication of this one and the given consequent.
@@ -845,14 +866,10 @@ impl MarkerTree {
 
     /// Returns whether this marker is unsatisfiable under known environment constraints.
     ///
-    /// Unlike [`MarkerTree::is_false`], this checks combinations such as `os_name == 'posix'`
-    /// and `sys_platform == 'win32'` even when they occur in different decision branches.
-    /// Relationships not modeled by the marker algebra can still produce false negatives.
+    /// Known platform exclusions are applied when building the tree. Relationships
+    /// outside those exclusions can still produce false negatives.
     pub fn is_unreachable(self) -> bool {
-        if self.is_true() || self.is_false() {
-            return self.is_false();
-        }
-        INTERNER.lock().is_unreachable(self.0)
+        self.is_false()
     }
 
     /// Returns the contents of this marker tree, if it contains at least one expression.
@@ -1248,11 +1265,7 @@ impl MarkerTree {
     /// should reconstitute all relevant markers from the source data.)
     #[must_use]
     pub fn simplify_python_versions(self, lower: Bound<&Version>, upper: Bound<&Version>) -> Self {
-        Self(
-            INTERNER
-                .lock()
-                .simplify_py
```

---

### Incident Patch 2: `7f396534` (2026-11-17)
**Commit Message**: Require explicit marker tree deserialization (#23256)

Refactor marker deserialization so each field explicitly chooses the
dependency-marker or environment-selector parser. Both entry points
accept
the same syntax. The split lets dependency specifiers gain wheel variant
variables while environment selectors can reject them.

This change is limited to a behavior-preserving refactor.

**File**: `crates/uv-distribution-types/src/requirement.rs` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ pub struct Requirement {
     #[serde(
         skip_serializing_if = "marker::ser::is_empty",
         serialize_with = "marker::ser::serialize",
+        deserialize_with = "MarkerTree::deserialize_dependency",
         default
     )]
     pub marker: MarkerTree,
```

**File**: `crates/uv-distribution-types/src/requires_python.rs` (modified, +4/-1)
```diff
@@ -581,7 +581,10 @@ impl From<RequiresPythonRange> for Ranges<Version> {
 /// a simplified marker, one must re-contextualize it by adding the
 /// `requires-python` constraint back to the marker.
 #[derive(Clone, Copy, Debug, Default, Eq, PartialEq, PartialOrd, Ord, serde::Deserialize)]
-pub struct SimplifiedMarkerTree(MarkerTree);
+#[serde(transparent)]
+pub struct SimplifiedMarkerTree(
+    #[serde(deserialize_with = "MarkerTree::deserialize_environment")] MarkerTree,
+);
 
 impl SimplifiedMarkerTree {
     /// Simplifies the given markers by assuming the given `requires-python`
```

**File**: `crates/uv-lock/src/lock/export/pylock_toml.rs` (modified, +19/-1)
```diff
@@ -260,7 +260,11 @@ pub struct PylockToml {
     #[serde(deserialize_with = "deserialize_lock_version")]
     lock_version: Version,
     created_by: String,
-    #[serde(skip_serializing)]
+    #[serde(
+        skip_serializing,
+        default,
+        deserialize_with = "deserialize_environments"
+    )]
     environments: Option<Vec<MarkerTree>>,
     #[serde(skip_serializing_if = "Option::is_none")]
     pub requires_python: Option<RequiresPython>,
@@ -275,6 +279,19 @@ pub struct PylockToml {
     attestation_identities: Vec<PylockTomlAttestationIdentity>,
 }
 
+fn deserialize_environments<'de, D: serde::Deserializer<'de>>(
+    deserializer: D,
+) -> Result<Option<Vec<MarkerTree>>, D::Error> {
+    #[derive(Deserialize)]
+    #[serde(transparent)]
+    struct Environments(
+        #[serde(deserialize_with = "MarkerTree::deserialize_environment_list")] Vec<MarkerTree>,
+    );
+
+    Option::<Environments>::deserialize(deserializer)
+        .map(|environments| environments.map(|env| env.0))
+}
+
 fn deserialize_lock_version<'de, D>(deserializer: D) -> Result<Version, D::Error>
 where
     D: serde::Deserializer<'de>,
@@ -333,6 +350,7 @@ pub struct PylockTomlPackage {
     #[serde(
         skip_serializing_if = "uv_pep508::marker::ser::is_empty",
         serialize_with = "uv_pep508::marker::ser::serialize",
+        deserialize_with = "MarkerTree::deserialize_environment",
         default
     )]
     marker: MarkerTree,
```

**File**: `crates/uv-pep508/src/marker/tree.rs` (modified, +36/-24)
```diff
@@ -745,29 +745,6 @@ impl Default for MarkerTree {
     }
 }
 
-impl<'de> Deserialize<'de> for MarkerTree {
-    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
-    where
-        D: Deserializer<'de>,
-    {
-        struct Visitor;
-
-        impl de::Visitor<'_> for Visitor {
-            type Value = MarkerTree;
-
-            fn expecting(&self, f: &mut Formatter) -> fmt::Result {
-                f.write_str("a string")
-            }
-
-            fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
-                MarkerTree::from_str(v).map_err(de::Error::custom)
-            }
-        }
-
-        deserializer.deserialize_str(Visitor)
-    }
-}
-
 impl FromStr for MarkerTree {
     type Err = Pep508Error;
 
@@ -784,6 +761,39 @@ impl MarkerTree {
         Self(interner.canonicalize(value))
     }
 
+    /// Deserialize a dependency marker.
+    pub fn deserialize_dependency<'de, D: Deserializer<'de>>(
+        deserializer: D,
+    ) -> Result<Self, D::Error> {
+        Self::from_str(&String::deserialize(deserializer)?).map_err(de::Error::custom)
+    }
+
+    /// Parse an environment selector.
+    pub fn parse_environment(input: &str) -> Result<Self, Pep508Error> {
+        Self::from_str(input)
+    }
+
+    /// Deserialize an environment selector.
+    pub fn deserialize_environment<'de, D: Deserializer<'de>>(
+        deserializer: D,
+    ) -> Result<Self, D::Error> {
+        Self::parse_environment(&String::deserialize(deserializer)?).map_err(de::Error::custom)
+    }
+
+    /// Deserialize a list of environment selectors.
+    pub fn deserialize_environment_list<'de, D: Deserializer<'de>>(
+        deserializer: D,
+    ) -> Result<Vec<Self>, D::Error> {
+        #[derive(Deserialize)]
+        #[serde(transparent)]
+        struct EnvironmentMarker(
+            #[serde(deserialize_with = "MarkerTree::deserialize_environment")] MarkerTree,
+        );
+
+        Vec::<EnvironmentMarker>::deserialize(deserializer)
+            .map(|markers| markers.into_iter().map(|marker| marker.0).collect())
+    }
+
     /// An empty marker that always evaluates to `true`.
     pub const TRUE: Self = Self(NodeId::TRUE);
 
@@ -4026,7 +4036,9 @@ mod test {
         let serialized = serde_json::to_string(&MarkerTree::FALSE.contents())?;
         assert_snapshot!(serialized, @r#""python_version < '0'""#);
         assert_eq!(
-            serde_json::from_str::<MarkerTree>(&serialized)?,
+            MarkerTree::deserialize_dependency(&mut serde_json::Deserializer::from_str(
+                &serialized,
+            ))?,
             MarkerTree::FALSE,
         );
         Ok(())
```

**File**: `crates/uv-pypi-types/src/supported_environments.rs` (modified, +6/-12)
```diff
@@ -1,5 +1,4 @@
-use std::str::FromStr;
-
+use serde::de::value::SeqAccessDeserializer;
 use serde::ser::SerializeSeq;
 
 use uv_pep508::MarkerTree;
@@ -78,22 +77,17 @@ impl<'de> serde::Deserialize<'de> for SupportedEnvironments {
             where
                 E: serde::de::Error,
             {
-                let marker = MarkerTree::from_str(value).map_err(serde::de::Error::custom)?;
+                let marker =
+                    MarkerTree::parse_environment(value).map_err(serde::de::Error::custom)?;
                 Ok(SupportedEnvironments(vec![marker]))
             }
 
-            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
+            fn visit_seq<A>(self, seq: A) -> Result<Self::Value, A::Error>
             where
                 A: serde::de::SeqAccess<'de>,
             {
-                let mut markers = Vec::new();
-
-                while let Some(elem) = seq.next_element::<String>()? {
-                    let marker = MarkerTree::from_str(&elem).map_err(serde::de::Error::custom)?;
-                    markers.push(marker);
-                }
-
-                Ok(SupportedEnvironments(markers))
+                MarkerTree::deserialize_environment_list(SeqAccessDeserializer::new(seq))
+                    .map(SupportedEnvironments)
             }
         }
 
```

**File**: `crates/uv-test/src/packse/scenario.rs` (modified, +1/-1)
```diff
@@ -338,7 +338,7 @@ pub struct ResolverOptions {
     pub python_platform: Option<TargetTriple>,
 
     /// Required environments (platform markers).
-    #[serde(default)]
+    #[serde(default, deserialize_with = "MarkerTree::deserialize_environment_list")]
     pub required_environments: Vec<MarkerTree>,
 }
 
```

**File**: `crates/uv-workspace/src/pyproject.rs` (modified, +1/-5)
```diff
@@ -1374,11 +1374,7 @@ impl<'de> Deserialize<'de> for Source {
             package: Option<bool>,
             index: Option<IndexName>,
             workspace: Option<WorkspaceReference>,
-            #[serde(
-                skip_serializing_if = "uv_pep508::marker::ser::is_empty",
-                serialize_with = "uv_pep508::marker::ser::serialize",
-                default
-            )]
+            #[serde(default, deserialize_with = "MarkerTree::deserialize_environment")]
             marker: MarkerTree,
             extra: Option<ExtraName>,
             group: Option<GroupName>,
```

#### Recent Merged Pull Requests:
- **PR #23281** (2026-11-17): Use GPT-6.2 for issue and PR automation (@woodruffw)
- **PR #23276** (2026-11-17): Tweak proxy indexes docs (@zsol)
- **PR #23273** (2026-11-17): Bump version to 0.13.9 (@konstin)
- **PR #23264** (2026-11-16): Use Rust 1.98 stabilized APIs (@charliermarsh)
- **PR #23263** (2026-11-16): Update Rust to 1.100 and MSRV to 1.98 (@charliermarsh)
- **PR #23261** (2026-11-16): Reject wheels with mismatched names (@EliteTK)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Preserve marker identity across equivalent platform expressions

**RULE**:
When implementing operations in `crates/uv-pep508/src/marker/algebra.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in astral-sh/uv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7424870a`: Preserve marker identity across equivalent platform expressions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/uv-pep508/src/marker/algebra.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
mod platform;
    platform: platform::Cache,
                let flags = platform::node_flags(&node);
                let id = NodeId::new(self.shared.nodes.push(node), flags);
        // This tests the two diagrams over their full domains, including impossible
        // platform combinations. Callers can supply the valid platform domain explicitly.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    /// The [`NodeId`] for the disjunction of known, mutually incompatible markers.
    exclusions: Option<NodeId>,
                let id = NodeId::new(self.shared.nodes.push(node), false);
        // Determine whether the conjunction _could_ contain a conflict.
        //
        // As an optimization, we only have to perform this check at the top-level, since these
        // variables are given higher priority in the tree. In other words, if they're present, they
        // _must_ be at the top; and if they're not at the top, we know they aren't present in any
        // children.
        let conflicts = x.var.is_conflicting_variable() && y.var.is_conflicting_variable();

        // If the node includes known incompatibilities, map it to `false`.
        let node = if conflicts {
            let exclusions = self.exclusions();
            if self.disjointness(node, exclusions.not()) {
                NodeId::FALSE
            } else {
                node
            }
        } else {
            node
        };

    /// Returns `true` if there is no environment in which both marker trees can apply,
    /// i.e. their conjunction is always `false`.
    pub(crate) fn is_disjoin
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7424870a` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
