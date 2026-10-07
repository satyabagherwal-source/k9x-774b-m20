# Forensic Learning Record (Deep Inspection): astral-sh/uv

> **Canonical Artifact**: `07_PROJECT_LEARNING/astral-sh-uv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/astral-sh/uv](https://github.com/astral-sh/uv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:19:54.269Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `astral-sh/uv`
- **Description**: An extremely fast Python package and project manager, written in Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 90479 stars

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

use anyhow::{Result, anyhow};
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

    // Replace the command with a shorter name. (The command typically includes the benchmark name,
    // but we assume we're running over a single benchmark here.)
    for result in &mut results.results {
        if result.command.starts_with("uv") {
            result.command = "uv".into();
        } else if result.command.starts_with("pip-compile") {
            result.command = "pip-compile".into();
        } else if result.command.starts_with("pip-sync") {
            result.command = "pip-sync".into();
        } else if result.command.starts_with("poetry") {
            result.command = "Poetry".into();
        } else if result.command.starts_with("pdm") {
            result.command = "PDM".into();
        } else {
            return Err(anyhow!("unknown command: {}", result.command));
        }
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
        data.push((result.mean, &result.command));
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
    results: Vec<BenchmarkResult>,
}

#[derive(Debug, Deserialize)]
struct BenchmarkResult {
    command: String,
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
use uv_redacted::DisplaySafeUrl;
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
    service_url: Option<DisplaySafeUrl>,
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
                if let Some(id) = ignore.iter().find(|id| vulnerability.matches(id)) {
                    matched_ignores.insert(id.clone());
                    return false;
                }
                if let Some(id) = ignore_until_fixed
                    .iter()
                    .find(|id| vulnerability.matches(id))
                {
                    matched_ignores.insert(id.clone());
                    if vulnerability.fix_versions.is_empty() {
                        return false;
                    }
                }
                true
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

### Core Architecture Module: `crates/uv-audit/src/service/mod.rs`
```
//! Vulnerability services.

pub use project_status::ProjectStatusAudit;

pub mod osv;
mod project_status;

/// The shape of the vulnerability service.
#[derive(Copy, Clone, Debug)]
#[cfg_attr(feature = "clap", derive(clap::ValueEnum))]
pub enum VulnerabilityServiceFormat {
    Osv,
}

```

### Core Architecture Module: `crates/uv-audit/src/service/osv.rs`
```
//! Types and interfaces for interacting with [OSV] as a vulnerability service.
//!
//! We use OSV's `/v1/querybatch` endpoint to collect vulnerability IDs for all
//! dependencies in batches of up to 1,000 (handling pagination as needed), then
//! fetch full vulnerability records from `/v1/vulns/{id}` concurrently.
//!
//! [OSV]: https://osv.dev/

use std::str::FromStr as _;
use std::sync::LazyLock;

use indexmap::IndexMap;
use rustc_hash::{FxHashMap, FxHashSet};
use tracing::trace;

use crate::types::{self, VulnerabilityID};
use futures::{StreamExt as _, TryStreamExt as _};
use jiff::Timestamp;
use serde::{Deserialize, Serialize};
use uv_cache::{Cache, CacheBucket, CacheEntry};
use uv_client::{CacheControl, CachedClient, CachedClientError};
use uv_configuration::Concurrency;
use uv_normalize::PackageName;
use uv_pep440::Version;
use uv_redacted::{DisplaySafeUrl, DisplaySafeUrlError};

pub static API_BASE: LazyLock<DisplaySafeUrl> = LazyLock::new(|| {
    DisplaySafeUrl::parse("https://api.osv.dev/").expect("embedded OSV URL is a valid URL")
});

/// Errors during OSV service interactions.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// An error from the cached HTTP client.
    #[error(transparent)]
    Client(#[from] uv_client::Error),
    /// An error during an HTTP request, including middleware errors.
    #[error(transparent)]
    ReqwestMiddleware(#[from] reqwest_middleware::Error),
    /// An error when constructing the URL for an API request.
    #[error("Invalid API URL: {0}")]
    Url(DisplaySafeUrl, #[source] DisplaySafeUrlError),
    /// An error when OSV returns an invalid vulnerability record.
    #[error("OSV returned a malformed vulnerability record for `{id}`")]
    MalformedRecord {
        id: String,
        #[source]
        err: reqwest_middleware::Error,
    },
}

/// Package specification for OSV queries.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Package {
    /// The package's name.
    name: String,
    /// The package's ecosystem.
    /// For our purposes, this will always be "PyPI".
    ecosystem: String,
}

/// Query request for a single package.
#[derive(Debug, Clone, Serialize)]
struct QueryRequest {
    package: Package,
    version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_token: Option<String>,
}

/// Event in a vulnerability range.
/// Per the OSV schema, each event object contains exactly one of these event types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Event {
    /// A version that introduces the vulnerability.
    Introduced(#[allow(dead_code)] String),
    /// A version that fixes the vulnerability.
    Fixed(String),
    /// The last known affected version.
    LastAffected(#[allow(dead_code)] String),
    /// An upper limit on the range.
    Limit(#[allow(dead_code)] String),
}

/// The type of a version range in an OSV vulnerability record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
enum RangeType {
    /// The versions in events are SemVer 2.0 versions.
    Semver,
    /// The versions in events are ecosystem-specific.
    /// In our context, this means they're PEP 440 versions.
    Ecosystem,
    /// The versions in events are full-length Git SHAs.
    Git,
    /// Some other range type. We don't expect these in OSV v1 records,
    /// but we include it for forward compatibility.
    /// NOTE: In principle we could use `untagged` here and capture the unknown
    /// type, but there's no value at the moment to doing this (since our processing
    /// of OSV records is limited to just ECOSYSTEM ranges).
    #[serde(other)]
    Other,
}

/// Version range for affected packages.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Range {
    #[serde(rename = "type")]
    range_type: RangeType,
    events: Vec<Event>,
}

/// Package affected by a vulnerability.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Affected {
    package: Option<Package>,
    ranges: Option<Vec<Range>>,
    // TODO: Enable these fields if/when they contain information that's
    // useful to us, e.g. metadata that constrains a vulnerability to specific
    // Python runtime versions, specific distributions of a version, etc.
    // ecosystem_specific: Option<serde_json::Value>,
    // database_specific: Option<serde_json::Value>,
}

/// The type of a reference in an OSV vulnerability record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
enum ReferenceType {
    Advisory,
    Article,
    Detection,
    Discussion,
    Report,
    Fix,
    Introduced,
    Package,
    Evidence,
    Web,
    /// Some other reference type. We don't expect these in OSV v1 records,
    /// but we include it for forward compatibility.
    #[serde(other)]
    Other,
}

/// A reference for more information about a vulnerability.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Reference {
    #[serde(rename = "type")]
    reference_type: ReferenceType,
    url: DisplaySafeUrl,
}

/// A full vulnerability record from OSV.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Vulnerability {
    id: String,
    modified: Timestamp,
    // Note: While the OSV spec says schema_version is required for versions >= 1.0.0,
    // some older records in the database don't have it, so we make it optional.
    // TODO: We could validate that this is 1.x, but the value of doing
    // so is probably limited given that we're strictly checking the shape
    // of the response anyways.
    #[allow(dead_code)]
    schema_version: Option<String>,
    summary: Option<String>,
    details: Option<String>,
    published: Option<Timestamp>,
    affected: Option<Vec<Affected>>,
    aliases: Option<Vec<String>>,
    references: Option<Vec<Reference>>,
}

/// Request body for the batch query API.
#[derive(Debug, Clone, Serialize)]
struct QueryBatchRequest {
    queries: Vec<QueryRequest>,
}

/// A summary of a vulnerability returned by the batch query API.
/// Note: the batch query API only returns IDs and modification timestamps, not full records.
#[derive(Debug, Clone, Deserialize)]
struct VulnSummary {
    id: String,
}

/// One result entry in a batch query response, corresponding to one input query.
#[derive(Debug, Clone, Deserialize)]
struct QueryBatchResult {
    #[serde(default)]
    vulns: Vec<VulnSummary>,
    next_page_token: Option<String>,
}

/// Response from a batch query.
#[derive(Debug, Clone, Deserialize)]
struct QueryBatchResponse {
    results: Vec<QueryBatchResult>,
}

/// Filter for OSV queries.
#[derive(Debug, Copy, Clone)]
pub enum Filter {
    /// Return all vulnerabilities.
    All,
    /// Return only vulnerabilities matching the `MAL-` prefix.
    Malware,
}

impl Filter {
    /// Returns `true` if the given vulnerability ID matches this filter.
    fn matches(self, id: &str) -> bool {
        match self {
            Self::All => true,
            Self::Malware => id.starts_with("MAL-"),
        }
    }
}

/// Synthetic `Cache-Control` header for vulnerability record caching (10 minutes).
///
/// This is injected into responses from OSV (which sends no cache headers)
/// so that the [`CachedClient`] middleware handles caching transparently.
///
/// We use a TTL of 10 minutes for alignment with PyPI.
static VULN_CACHE_CONTROL: LazyLock<http::HeaderValue> =
    LazyLock::new(|| "max-age=600".parse().expect("valid header value"));

const OSV_QUERY_BATCH_SIZE: usize = 1_000;

/// Represents [OSV](https://osv.dev/), an open-source vulnerability database.
pub struct Osv {
    base_url: DisplaySafeUrl,
    client: CachedClient,
    concurrency: Concurrency,
    cache: Cache,
}

impl Osv {
    /// Create a new OSV client with the given cached HTTP client and optional base URL.
    ///
    /// If no base URL is provided, the client will default to the official OSV API endpoint.
    /// Positive batch query results are cached to disk. Individual vulnerability records
    /// are cached transparently by the [`CachedClient`].
    pub fn new(
        client: CachedClient,
        base_url: Option<DisplaySafeUrl>,
        concurrency: Concurrency,
        cache: Cache,
    ) -> Self {
        Self {
            base_url: base_url.unwrap_or_else(|| API_BASE.clone()),
            client,
            concurrency,
            cache,
        }
    }

    /// Return a [`CacheEntry`] for a full vulnerability record.
    fn vuln_cache_entry(&self, id: &str) -> CacheEntry {
        let bucket = self.cache.bucket(CacheBucket::Osv);
        CacheEntry::new(bucket.join("vulnerability"), format!("{id}.msgpack"))
    }

    /// Query OSV for vulnerabilities affecting the given dependencies, returning only vulnerability IDs.
    ///
    /// Returns a mapping from each input dependency to the set of vulnerability IDs affecting it.
    pub async fn query_identifiers<'a>(
        &self,
        dependencies: &'a [types::Dependency],
        filter: Filter,
    ) -> Result<IndexMap<&'a types::Dependency, FxHashSet<VulnerabilityID>>, Error> {
        if dependencies.is_empty() {
            return Ok(IndexMap::default());
        }

        let mut result_map: IndexMap<&types::Dependency, FxHashSet<VulnerabilityID>> =
            IndexMap::default();

        // Pending queries: (dependency, page_token). Initially one per dependency with no token.
        let mut pending: Vec<(&types::Dependency, Option<String>)> =
            dependencies.iter().map(|dep| (dep, None)).collect();

        let url = self
            .base_url
            .join("v1/querybatch")
            .map_err(|err| Error::Url(self.base_url.clone(), err))?;

        loop {
            let mut next_pending = Vec::new();
            for pending_batch in pending.chunks(OSV_QUERY_BATCH_SIZE) {
                let request = QueryBatchRequest {
                    queries: pending_batch
                        .iter()
                        .map(|(dep, page_token)| QueryRequest {
        
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #22324** (2026-10-07): **Honor explicit false for UV_NO_CACHE**
  *Symptoms*: `UV_NO_CACHE=false` did not override `no-cache = true` in configuration because the resolved command-line boolean was combined with the configured value using a logical OR. Resolve the environment value separately so an explicit `UV_NO_CACHE` value takes precedence over configuration, while an explicit `--no-cache` remains authoritative. 

- **Issue #22322** (2026-10-07): **Fix Pyodide Python request satisfaction**
  *Symptoms*: Pyodide reports `cpython` as its implementation name, so an existing interpreter fails `pyodide` requests even though discovery accepts it. Use discovery's Emscripten-aware matcher when checking whether an interpreter satisfies an implementation request. 

- **Issue #22306** (2026-10-07): **Allow auth login over IPv6 loopback**
  *Symptoms*: Auth login accepts `localhost` and `127.0.0.1` over HTTP but rejects the equivalent IPv6 loopback `http://[::1]:...`. Recognize `::1` as local without relaxing the localhost-only security policy introduced in [uv#15755](https://github.com/astral-sh/uv/pull/15755); this shares the native-auth surface being rewritten in [uv#18907](https://github.com/astral-sh/uv/pull/18907).

- **Issue #22302** (2026-10-07): **Restrict Windows script-copy fallback to `CrossesDevices`**
  *Symptoms*: The Windows wheel-script installer tries a copy after every final rename error, which can hide unrelated rename failures. Preserve the original `io::ErrorKind` through `with_retry_sync` and invoke the copy fallback only for `CrossesDevices`. Permission-denied retries and the Unix installation path are unchanged. Follows astral-sh/uv#11167.
  **Post-Mortem & Fix Analysis**:
  >  <!-- generated-comment uv test-inventory -->  ## uv test inventory changes  This PR changes the tests when compared with the `main` base revision.  - Added tests: **2** - Removed tests: **0** - Changed suites: **1**  <details> <summary><code>uv-fs</code>: +2 / -0</summary>  <br>  **Added:** - `uv-fs::tests::with_retry_sync_preserves_cross_device_error` - `uv-fs::tests::with_retry_sync_preserves_not_found`  **Removed:** none  </details> 

- **Issue #22292** (2026-10-07): **Honor advisory ID preference in `uv audit`**
  *Symptoms*: `Vulnerability::best_id` currently returns the first ID with any recognized prefix, so a primary `GHSA-` or `CVE-` ID can hide a preferred alias. Search each prefix in the `PYSEC-`, `GHSA-`, then `CVE-` order established in astral-sh/uv#18193, while preserving the existing order within each source and falling back to the original ID. This only changes the display ID used by audit reports; canonical IDs and ignore matching are unchanged.

- **Issue #22291** (2026-10-07): **Allow `UV_SYSTEM_CERTS=false` to override configuration**
  *Symptoms*: System-certificate resolution honors environment values only when true, so `UV_SYSTEM_CERTS=0` and the deprecated alias cannot disable configured `system-certs = true`. Preserve explicit false during settings resolution.

- **Issue #22290** (2026-10-07): **Fix quoted requirement-file paths**
  *Symptoms*:  Quoted constraint, override, and exclude paths are split on spaces and fail on the path prefix. Keep explicit CLI paths intact and only split environment-provided lists. This fixes [uv#12639](https://github.com/astral-sh/uv/issues/12639) and removes the undocumented behavior of supplying several CLI paths in one space-delimited value ([uv#3162](https://github.com/astral-sh/uv/pull/3162), [uv#4124](https://github.com/astral-sh/uv/issues/4124)).

- **Issue #22284** (2026-10-07): **Preserve trailing whitespace in subprocess-keyring passwords**
  *Symptoms*: Passwords ending in spaces or tabs fail authentication through the subprocess keyring because `trim_end()` removes those characters along with the newline printed by `keyring get`. Strip only one LF or CRLF terminator so trailing password whitespace reaches the server. 
  **Post-Mortem & Fix Analysis**:
  >  <!-- generated-comment uv test-inventory -->  ## uv test inventory changes  This PR changes the tests when compared with the `main` base revision.  - Added tests: **1** - Removed tests: **0** - Changed suites: **1**  <details> <summary><code>uv::pip_install</code>: +1 / -0</summary>  <br>  **Added:** - `uv::pip_install::pip_install::install_requirements_basic_auth_from_keyring_trailing_whitespace`  **Removed:** none  </details> 

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

### Incident Patch 1: `2e3cfecd` (2026-10-07)
**Commit Message**: Keep direct build backend errors typed (#22330)

Direct builds erase `uv_build_backend::Error` into `anyhow` inside the
blocking task. Return the backend error directly and carry it in a
dedicated `BuildDispatchError` variant, retaining the current
diagnostics and failure classification.

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>

**File**: `crates/uv-dispatch/src/lib.rs` (modified, +10/-5)
```diff
@@ -13,7 +13,7 @@ use rustc_hash::FxHashMap;
 use thiserror::Error;
 use tracing::{debug, instrument, trace};
 
-use uv_build_backend::check_direct_build;
+use uv_build_backend::{Error as BuildBackendError, check_direct_build};
 use uv_build_frontend::{SourceBuild, SourceBuildContext};
 use uv_cache::Cache;
 use uv_client::RegistryClient;
@@ -49,6 +49,9 @@ pub enum BuildDispatchError {
     #[error(transparent)]
     BuildFrontend(#[from] AnyErrorBuild),
 
+    #[error(transparent)]
+    BuildBackend(#[from] BuildBackendError),
+
     #[error(transparent)]
     Tags(#[from] uv_platform_tags::TagsError),
 
@@ -83,7 +86,8 @@ impl uv_errors::Hinted for BuildDispatchError {
         match self {
             Self::BuildFrontend(err) => err.hints(),
             Self::Resolve(err) | Self::ResolveRequirements { source: err, .. } => err.hints(),
-            Self::Tags(_)
+            Self::BuildBackend(_)
+            | Self::Tags(_)
             | Self::Join(_)
             | Self::Anyhow(_)
             | Self::Prepare(_)
@@ -101,13 +105,14 @@ impl IsBuildBackendError for BuildDispatchError {
             }
             Self::Prepare(error) => error.is_user_failure(),
             Self::Lookahead(error) => error.is_user_failure(),
-            Self::Tags(_) | Self::Join(_) | Self::Anyhow(_) => false,
+            Self::BuildBackend(_) | Self::Tags(_) | Self::Join(_) | Self::Anyhow(_) => false,
         }
     }
 
     fn is_build_backend_error(&self) -> bool {
         match self {
-            Self::Tags(_)
+            Self::BuildBackend(_)
+            | Self::Tags(_)
             | Self::Resolve(_)
             | Self::ResolveRequirements { .. }
             | Self::Join(_)
@@ -626,7 +631,7 @@ impl BuildContext for BuildDispatch<'_> {
         debug!("Performing direct build for {identifier}");
 
         let output_dir = output_dir.to_path_buf();
-        let filename = tokio::task::spawn_blocking(move || -> Result<_> {
+        let filename = tokio::task::spawn_blocking(move || -> Result<_, BuildBackendError> {
             let filename = match build_kind {
                 BuildKind::Wheel => {
                     let wheel = uv_build_backend::build_wheel(
```

---

### Incident Patch 2: `13acf4d7` (2026-10-07)
**Commit Message**: Keep build resolution context in a typed error (#22332)

`BuildDispatch` erases resolution failures into `anyhow` to add context,
then downcasts them to recover hints and failure classification. Store
the requirements context alongside `ResolveError` in a dedicated variant
so both can be handled directly.

---------

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>

**File**: `crates/uv-dispatch/src/lib.rs` (modified, +26/-29)
```diff
@@ -55,6 +55,16 @@ pub enum BuildDispatchError {
     #[error(transparent)]
     Resolve(#[from] uv_resolver::ResolveError),
 
+    #[error(
+        "No solution found when resolving: {}",
+        requirements.iter().format_with(", ", |requirement, f| f(&format_args!("`{requirement}`")))
+    )]
+    ResolveRequirements {
+        requirements: Vec<Requirement>,
+        #[source]
+        source: uv_resolver::ResolveError,
+    },
+
     #[error(transparent)]
     Join(#[from] tokio::task::JoinError),
 
@@ -72,21 +82,12 @@ impl uv_errors::Hinted for BuildDispatchError {
     fn hints(&self) -> uv_errors::Hints<'_> {
         match self {
             Self::BuildFrontend(err) => err.hints(),
-            Self::Resolve(err) => err.hints(),
-            Self::Anyhow(err) => {
-                // Walk the anyhow error chain to find hint-bearing errors
-                // (e.g., ResolveError wrapped via `with_context`).
-                for cause in err.chain() {
-                    if let Some(resolve_err) = cause.downcast_ref::<uv_resolver::ResolveError>() {
-                        let hints = resolve_err.hints();
-                        if !hints.is_empty() {
-                            return hints;
-                        }
-                    }
-                }
-                uv_errors::Hints::none()
-            }
-            _ => uv_errors::Hints::none(),
+            Self::Resolve(err) | Self::ResolveRequirements { source: err, .. } => err.hints(),
+            Self::Tags(_)
+            | Self::Join(_)
+            | Self::Anyhow(_)
+            | Self::Prepare(_)
+            | Self::Lookahead(_) => uv_errors::Hints::none(),
         }
     }
 }
@@ -95,21 +96,20 @@ impl IsBuildBackendError for BuildDispatchError {
     fn is_user_failure(&self) -> bool {
         match self {
             Self::BuildFrontend(error) => error.is_user_failure(),
-            Self::Resolve(error) => error.is_user_failure(),
+            Self::Resolve(error) | Self::ResolveRequirements { source: error, .. } => {
+                error.is_user_failure()
+            }
             Self::Prepare(error) => error.is_user_failure(),
             Self::Lookahead(error) => error.is_user_failure(),
-            Self::Anyhow(error) => error
-                .chain()
-                .find_map(|cause| cause.downcast_ref::<uv_resolver::ResolveError>())
-                .is_some_and(uv_resolver::ResolveError::is_user_failure),
-            Self::Tags(_) | Self::Join(_) => false,
+            Self::Tags(_) | Self::Join(_) | Self::Anyhow(_) => false,
         }
     }
 
     fn is_build_backend_error(&self) -> bool {
         match self {
             Self::Tags(_)
             | Self::Resolve(_)
+            | Self::ResolveRequirements { .. }
             | Self::Join(_)
             | Self::Anyhow(_)
             | Self::Prepare(_)
@@ -375,14 +375,11 @@ impl BuildContext for BuildDispatch<'_> {
             )
             .with_build_stack(build_stack),
         )?;
-        let resolution = Resolution::from(resolver.resolve().await.with_context(|| {
-            format!(
-                "No solution found when resolving: {}",
-                requirements
-                    .iter()
-                    .map(|requirement| format!("`{requirement}`"))
-                    .join(", ")
-            )
+        let resolution = Resolution::from(resolver.resolve().await.map_err(|source| {
+            BuildDispatchError::ResolveRequirements {
+                requirements: requirements.to_vec(),
+                source,
+            }
         })?);
         Ok(ResolvedRequirements::new(resolution, hasher))
     }
```

**File**: `crates/uv-errors/src/lib.rs` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ impl<'a> Hints<'a> {
     }
 
     /// Whether the collection is empty.
-    pub fn is_empty(&self) -> bool {
+    fn is_empty(&self) -> bool {
         self.0.is_empty()
     }
 
```

---

### Incident Patch 3: `e936829b` (2026-10-07)
**Commit Message**: Represent invalid build plans with typed errors (#22326)

`BuildPlan::determine` has two fixed failure cases but returns them
through `anyhow` and `Error::BuildPlan`. Represent unsupported
source-distribution build requests directly in the build-command error
enum, retaining their messages and exit status.

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>

**File**: `crates/uv-build-commands/src/lib.rs` (modified, +8/-10)
```diff
@@ -68,8 +68,10 @@ pub enum Error {
     FlatIndex(#[from] uv_client::FlatIndexError),
     #[error(transparent)]
     ClientBuild(#[from] uv_client::ClientBuildError),
-    #[error(transparent)]
-    BuildPlan(anyhow::Error),
+    #[error("Pass `--wheel` explicitly to build a wheel from a source distribution")]
+    WheelFromSdistRequiresFlag,
+    #[error("Building an `--sdist` from a source distribution is not supported")]
+    SdistFromSdist,
     #[error(transparent)]
     Extract(#[from] uv_extract::Error),
     #[error(transparent)]
@@ -673,7 +675,7 @@ async fn build_package(
     prepare_output_directory(&output_dir, gitignore).await?;
 
     // Determine the build plan.
-    let plan = BuildPlan::determine(&source, sdist, wheel).map_err(Error::BuildPlan)?;
+    let plan = BuildPlan::determine(&source, sdist, wheel)?;
 
     // Check if the build backend is matching uv version that allows calling in the uv build backend
     // directly.
@@ -1491,21 +1493,17 @@ enum BuildPlan {
 }
 
 impl BuildPlan {
-    fn determine(source: &AnnotatedSource, sdist: bool, wheel: bool) -> Result<Self> {
+    fn determine(source: &AnnotatedSource, sdist: bool, wheel: bool) -> Result<Self, Error> {
         Ok(match &source.source {
             Source::File(_) => {
                 // We're building from a file, which must be a source distribution.
                 match (sdist, wheel) {
                     (false, true) => Self::WheelFromSdist,
                     (false, false) => {
-                        return Err(anyhow::anyhow!(
-                            "Pass `--wheel` explicitly to build a wheel from a source distribution"
-                        ));
+                        return Err(Error::WheelFromSdistRequiresFlag);
                     }
                     (true, _) => {
-                        return Err(anyhow::anyhow!(
-                            "Building an `--sdist` from a source distribution is not supported"
-                        ));
+                        return Err(Error::SdistFromSdist);
                     }
                 }
             }
```

---

### Incident Patch 4: `d73d5977` (2026-10-07)
**Commit Message**: Fix Pyodide Python request satisfaction (#22322)

Pyodide reports `cpython` as its implementation name, so an existing
interpreter fails `pyodide` requests even though discovery accepts it.
Use discovery's Emscripten-aware matcher when checking whether an
interpreter satisfies an implementation request.

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>

**File**: `crates/uv-python/src/discovery.rs` (modified, +2/-6)
```diff
@@ -2283,14 +2283,10 @@ impl PythonRequest {
                 }
                 false
             }
-            Self::Implementation(implementation) => interpreter
-                .implementation_name()
-                .eq_ignore_ascii_case(implementation.long_name()),
+            Self::Implementation(implementation) => implementation.matches_interpreter(interpreter),
             Self::ImplementationVersion(implementation, version) => {
                 version.matches_interpreter(interpreter)
-                    && interpreter
-                        .implementation_name()
-                        .eq_ignore_ascii_case(implementation.long_name())
+                    && implementation.matches_interpreter(interpreter)
             }
             Self::Key(request) => request.satisfied_by_interpreter(interpreter),
         }
```

**File**: `crates/uv-python/src/lib.rs` (modified, +11/-0)
```diff
@@ -3519,6 +3519,13 @@ mod tests {
             python.interpreter().python_full_version().to_string(),
             "3.13.2"
         );
+        assert!(PythonRequest::parse("pyodide").satisfied(python.interpreter(), &context.cache));
+        assert!(
+            PythonRequest::parse("pyodide@3.13").satisfied(python.interpreter(), &context.cache)
+        );
+        assert!(
+            !PythonRequest::parse("pyodide@3.12").satisfied(python.interpreter(), &context.cache)
+        );
 
         // We should prefer the native Python to the Pyodide Python
         context.add_python_versions(&["3.15.7"])?;
@@ -3536,6 +3543,10 @@ mod tests {
             python.interpreter().python_full_version().to_string(),
             "3.15.7"
         );
+        assert!(!PythonRequest::parse("pyodide").satisfied(python.interpreter(), &context.cache));
+        assert!(
+            !PythonRequest::parse("pyodide@3.15").satisfied(python.interpreter(), &context.cache)
+        );
 
         Ok(())
     }
```

---

### Incident Patch 5: `d3a1c704` (2026-10-07)
**Commit Message**: Fix stale references in crate documentation (#22311)

Several crate docs reference removed or renamed APIs, and some
descriptions still refer to removed variants and methods. Update the
references and descriptions in `uv-cli`, `uv-configuration`,
`uv-distribution-types`, `uv-dispatch`, and `uv-types`, and render the
version-format placeholders as code so rustdoc does not treat them as
HTML.

---------

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>

**File**: `crates/uv-cli/src/lib.rs` (modified, +3/-4)
```diff
@@ -175,7 +175,7 @@ pub struct GlobalArgs {
     #[arg(global = true, long, help_heading = "Python options")]
     pub no_python_downloads: bool,
 
-    /// Deprecated version of [`Self::python_downloads`].
+    /// Deprecated option for configuring automatic Python downloads.
     #[arg(global = true, long, hide = true)]
     pub python_fetch: Option<PythonDownloads>,
 
@@ -1053,8 +1053,7 @@ pub enum ProjectCommand {
     Audit(AuditArgs),
 }
 
-/// A re-implementation of `Option`, used to avoid Clap's automatic `Option` flattening in
-/// [`parse_index_url`].
+/// A re-implementation of [`Option`], used to avoid `clap`'s automatic `Option` flattening.
 #[derive(Debug, Clone)]
 pub enum Maybe<T> {
     Some(T),
@@ -1276,7 +1275,7 @@ fn parse_default_index(input: &str) -> Result<Maybe<IndexArg>, String> {
     }
 }
 
-/// Parse a string into an [`Url`], mapping the empty string to `None`.
+/// Parse a string into a [`TrustedHost`], mapping the empty string to `None`.
 fn parse_insecure_host(input: &str) -> Result<Maybe<TrustedHost>, String> {
     if input.is_empty() {
         Ok(Maybe::None)
```

**File**: `crates/uv-cli/src/version.rs` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ impl SelfVersionInfo {
 }
 
 impl fmt::Display for SelfVersionInfo {
-    /// Formatted version information: "<version>[+<commits>] ([<commit> <date> ]<target>)"
+    /// Formatted version information: `<version>[+<commits>] ([<commit> <date> ]<target>)`.
     ///
     /// This is intended for consumption by `clap` to provide `uv --version`,
     /// and intentionally omits the name of the package.
```

**File**: `crates/uv-configuration/src/dependency_groups.rs` (modified, +1/-3)
```diff
@@ -229,9 +229,7 @@ impl DependencyGroupsHistory {
     /// If a flag was provided multiple times (e.g. `--group A --group B`) this will
     /// elide the arguments and just show the flag once (e.g. just yield "--group").
     ///
-    /// Conceptually this being an empty list should be equivalent to
-    /// [`DependencyGroups::is_empty`][] when there aren't any defaults set.
-    /// When there are defaults the two will disagree, and rightfully so!
+    /// Default groups are omitted because they do not come from CLI flags.
     pub fn as_flags_pretty(&self) -> Vec<Cow<'_, str>> {
         let Self {
             dev_mode,
```

**File**: `crates/uv-configuration/src/extras.rs` (modified, +2/-4)
```diff
@@ -8,7 +8,7 @@ use uv_normalize::{DefaultExtras, ExtraName};
 #[derive(Debug, Default, Clone)]
 pub struct ExtrasSpecification(Arc<ExtrasSpecificationInner>);
 
-/// Manager of all dependency-group decisions and settings history.
+/// Extra decisions and settings history shared by an [`ExtrasSpecification`].
 #[derive(Debug, Default, Clone)]
 pub struct ExtrasSpecificationInner {
     /// Extras to include.
@@ -203,9 +203,7 @@ impl ExtrasSpecificationHistory {
     /// If a flag was provided multiple times (e.g. `--extra A --extra B`) this will
     /// elide the arguments and just show the flag once (e.g. just yield "--extra").
     ///
-    /// Conceptually this being an empty list should be equivalent to
-    /// [`ExtrasSpecification::is_empty`][] when there aren't any defaults set.
-    /// When there are defaults the two will disagree, and rightfully so!
+    /// Default extras are omitted because they do not come from CLI flags.
     pub fn as_flags_pretty(&self) -> Vec<Cow<'_, str>> {
         let Self {
             extra,
```

**File**: `crates/uv-configuration/src/overrides.rs` (modified, +1/-1)
```diff
@@ -283,7 +283,7 @@ impl Overrides {
 
     /// Apply overrides with optional package-version context.
     ///
-    /// NB: Change this method together with [`Constraints::apply`].
+    /// NB: Change this method together with [`Constraints::apply`](crate::Constraints::apply).
     pub(crate) fn apply_for_package<'a, I>(
         &'a self,
         package: Option<(&PackageName, &Version)>,
```

**File**: `crates/uv-configuration/src/package_options.rs` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ impl Reinstall {
         }
     }
 
-    /// Add a [`Package`] to the [`Reinstall`] policy.
+    /// Add a [`PackageName`] to the [`Reinstall`] policy.
     #[must_use]
     pub fn with_package(self, package_name: PackageName) -> Self {
         match self {
```

**File**: `crates/uv-configuration/src/proxy_url.rs` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ use uv_redacted::DisplaySafeUrl;
 #[derive(Debug, Clone, PartialEq, Eq, Hash)]
 pub struct ProxyUrl(DisplaySafeUrl);
 
-/// Mapping to [`reqwest::proxy::Intercept`] kinds which are not public API.
+/// The destination scheme to which a [`ProxyUrl`] applies.
 #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
 pub enum ProxyUrlKind {
     Http,
```

**File**: `crates/uv-dispatch/src/lib.rs` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 //! Avoid cyclic crate dependencies between [resolver][`uv_resolver`],
-//! [installer][`uv_installer`] and [build][`uv_build`] through [`BuildDispatch`]
+//! [installer][`uv_installer`] and [build frontend][`uv_build_frontend`] through [`BuildDispatch`]
 //! implementing [`BuildContext`].
 
 use std::ffi::{OsStr, OsString};
```

---

### Incident Patch 6: `2b62538d` (2026-10-07)
**Commit Message**: Separate code quality review configuration from security review (#22318)

The code quality workflow derives its output schema from the security
review at runtime, coupling the two review contracts. Give it a complete
schema under `agents/schemas` and save it alongside its own prompt
before checking out the pull request.

Use the shared finding formatter and publisher for both reviews while
keeping their setup and review-specific requirements separate. Update
the security workflow's token-service identity to match the shared
revision.

Depends on astral-sh/github-actions#13.

**File**: `.github/secure-token-service.json` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@
       "environment": "automations",
       "caller_ref": "refs/pull/*/merge",
       "caller_workflow": "ci.yml",
-      "reusable_workflow": "astral-sh/github-actions/.github/workflows/pull-request-security-review.yml@45c506043c254690f2612686e5d5a72c81c251a4",
+      "reusable_workflow": "astral-sh/github-actions/.github/workflows/pull-request-security-review.yml@3c57a5dba8ad854a97e8b9fbf454286a7574e677",
       "on": ["pull_request"],
       "permissions": { "pull_requests": "write" },
       "target": "uv"
```

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
   review:
     needs: plan
     if: ${{ github.event_name == 'pull_request' && github.repository == 'astral-sh/uv' && github.event.pull_request.head.repo.full_name == github.repository && needs.plan.outputs.review-security == 'true' }}
-    uses: astral-sh/github-actions/.github/workflows/pull-request-security-review.yml@45c506043c254690f2612686e5d5a72c81c251a4
+    uses: astral-sh/github-actions/.github/workflows/pull-request-security-review.yml@3c57a5dba8ad854a97e8b9fbf454286a7574e677
     with:
       runner: depot-ubuntu-24.04-16
       helper-runner: github-ubuntu-24.04-x86_64-4
```

**File**: `.github/workflows/pull-request-code-quality-review.yml` (modified, +17/-42)
```diff
@@ -20,22 +20,6 @@ jobs:
     outputs:
       result: ${{ steps.review.outputs.final-message }}
     steps:
-      - name: "Checkout review helpers"
-        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
-        with:
-          repository: astral-sh/github-actions
-          ref: 45c506043c254690f2612686e5d5a72c81c251a4
-          sparse-checkout: security-pr-review
-          persist-credentials: false
-
-      - name: "Save review schema"
-        run: |
-          review_config="$RUNNER_TEMP/pull-request-code-quality-review"
-          mkdir -p "$review_config/codex" "$RUNNER_TEMP/codex-code-quality-review"
-          jq 'del(.properties.reviewed_paths) | .required -= ["reviewed_paths"]' \
-            security-pr-review/schema.json > "$review_config/schema.json"
-          printf 'REVIEW_CONFIG=%s\n' "$review_config" >> "$GITHUB_ENV"
-
       - name: "Checkout caller repository"
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
@@ -52,8 +36,12 @@ jobs:
         env:
           HEAD_SHA: ${{ github.event.pull_request.head.sha }}
         run: |
+          export REVIEW_CONFIG="$RUNNER_TEMP/pull-request-code-quality-review"
+          mkdir -p "$REVIEW_CONFIG/codex" "$RUNNER_TEMP/codex-code-quality-review"
+          printf 'REVIEW_CONFIG=%s\n' "$REVIEW_CONFIG" >> "$GITHUB_ENV"
           cp agents/codex/config.toml "$REVIEW_CONFIG/codex/"
           cp agents/prompts/pull-request-code-quality-review.md "$REVIEW_CONFIG/prompt.md"
+          cp agents/schemas/pull-request-code-quality-review.json "$REVIEW_CONFIG/schema.json"
           cp agents/scripts/collect-pull-request-review-context.sh "$REVIEW_CONFIG/"
           cp AGENTS.md CONTRIBUTING.md STYLE.md "$REVIEW_CONFIG/"
           git rev-parse HEAD > "$REVIEW_CONFIG/configuration-revision.txt"
@@ -136,8 +124,8 @@ jobs:
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           repository: astral-sh/github-actions
-          ref: 45c506043c254690f2612686e5d5a72c81c251a4
-          sparse-checkout: security-pr-review
+          ref: 3c57a5dba8ad854a97e8b9fbf454286a7574e677
+          sparse-checkout: pull-request-review
           persist-credentials: false
 
       - uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
@@ -148,7 +136,7 @@ jobs:
 
       - name: "Prepare review findings"
         id: comments
-        run: bash security-pr-review/scripts/prepare.sh
+        run: bash pull-request-review/scripts/prepare.sh
         env:
           HEAD_SHA: ${{ github.event.pull_request.head.sha }}
           REVIEW_RESULT: ${{ needs.review.outputs.result }}
@@ -160,8 +148,17 @@ jobs:
     environment: automations
     timeout-minutes: 5
     permissions:
+      contents: read
       id-token: write # for the credential broker
     steps:
+      - name: "Checkout review helpers"
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          repository: astral-sh/github-actions
+          ref: 3c57a5dba8ad854a97e8b9fbf454286a7574e677
+          sparse-checkout: pull-request-review
+          persist-credentials: false
+
       - name: "Get repository token"
         id: token
         uses: open-security-tools/ost-simple-sts@9e012247e07c39080fb6a832dbfbcfeacebc19c4
@@ -173,29 +170,7 @@ jobs:
             pull_requests: write
 
       - name: "Publish review findings"
-        run: |
-          set -euo pipefail
-          printf '%s\n' "$REVIEW_RESULT" > "$RUNNER_TEMP/review.json"
-          current_head_sha="$(
-            gh pr view "$PULL_REQUEST_NUMBER" \
-              --repo "$GITHUB_REPOSITORY" \
-              --json headRefOid \
-              --jq '.headRefOid'
-          )"
-          if [ "$current_head_sha" != "$HEAD_SHA" ]; then
-            echo "The pull request head changed; skipping stale review findings."
-            exit 0
-          fi
-
-          jq --compact-output '.comments[]' "$RUNNER_TEMP/review.json" |
-          while IFS= read -r comment; do
-            printf '%s\n' "$comment" |
-              gh api \
-                --method POST \
-                "repos/$GITHUB_REPOSITORY/pulls/$PULL_REQUEST_NUMBER/comments" \
-                --input - \
-                --silent
-          done
+        run: bash pull-request-review/scripts/publish.sh
         env:
           GH_TOKEN: ${{ steps.token.outputs.token }}
           HEAD_SHA: ${{ github.event.pull_request.head.sha }}
```

**File**: `agents/schemas/pull-request-code-quality-review.json` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+{
+  "type": "object",
+  "additionalProperties": false,
+  "properties": {
+    "findings": {
+      "type": "array",
+      "items": {
+        "type": "object",
+        "additionalProperties": false,
+        "properties": {
+          "title": { "type": "string" },
+          "body": { "type": "string" },
+          "priority": {
+            "type": "integer",
+            "minimum": 0,
+            "maximum": 3
+          },
+          "code_location": {
+            "type": "object",
+            "additionalProperties": false,
+            "properties": {
+              "relative_file_path": { "type": "string" },
+              "side": {
+                "type": "string",
+                "enum": ["LEFT", "RIGHT"]
+              },
+              "line_range": {
+                "type": "object",
+                "additionalProperties": false,
+                "properties": {
+                  "start": {
+                    "type": "integer",
+                    "minimum": 1
+                  },
+                  "end": {
+                    "type": "integer",
+                    "minimum": 1
+                  }
+                },
+                "required": ["start", "end"]
+              }
+            },
+            "required": ["relative_file_path", "side", "line_range"]
+          }
+        },
+        "required": ["title", "body", "priority", "code_location"]
+      }
+    }
+  },
+  "required": ["findings"]
+}
```

---

### Incident Patch 7: `0e09a471` (2026-10-07)
**Commit Message**: Stop asserting requirements error types (#22312)

The resolution-context assertions require `uv_requirements::Error` in
the source chain even though the command interface depends on the
diagnostic and failure classification. Drop the concrete-type assertions
so internal error wrapping can change independently.

**File**: `crates/uv/src/commands/mod.rs` (modified, +0/-10)
```diff
@@ -107,11 +107,6 @@ mod error_tests {
             bail!("expected a user error");
         };
         assert_snapshot!(format!("{error:#}"), @"Failed to resolve tool requirement: requirements failure");
-        assert!(
-            error
-                .chain()
-                .any(<dyn std::error::Error>::is::<uv_requirements::Error>)
-        );
 
         Ok(())
     }
@@ -132,11 +127,6 @@ mod error_tests {
             bail!("expected an unexpected error");
         };
         assert_snapshot!(format!("{error:#}"), @"Failed to resolve tool requirement: requirements failure");
-        assert!(
-            error
-                .chain()
-                .any(<dyn std::error::Error>::is::<uv_requirements::Error>)
-        );
 
         Ok(())
     }
```

---

### Incident Patch 8: `1f24ecdb` (2026-10-07)
**Commit Message**: Fix `uv-fs` warnings without Tokio (#22307)

`uv-fs` emits unused-import and dead-code warnings with its default
features because the locking implementation is only used with Tokio.
Gate private locking helpers and their imports on the `tokio` feature;
public error and mode types remain available without it.

---------

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>
Co-authored-by: zaniebot <[REDACTED_EMAIL]>

**File**: `crates/uv-fs/src/lib.rs` (modified, +1/-0)
```diff
@@ -896,6 +896,7 @@ pub fn is_virtualenv_base(path: impl AsRef<Path>) -> bool {
 }
 
 /// Whether the error is due to a lock being held.
+#[cfg(feature = "tokio")]
 fn is_known_already_locked_error(err: &std::fs::TryLockError) -> bool {
     match err {
         std::fs::TryLockError::WouldBlock => true,
```

**File**: `crates/uv-fs/src/locked_file.rs` (modified, +11/-6)
```diff
@@ -1,20 +1,24 @@
-use std::convert::Into;
 use std::fmt::Display;
-use std::path::{Path, PathBuf};
-use std::sync::LazyLock;
+use std::io;
+use std::path::PathBuf;
 use std::time::Duration;
-use std::{env, io};
+#[cfg(feature = "tokio")]
+use std::{convert::Into, env, path::Path, sync::LazyLock};
 
 use thiserror::Error;
+#[cfg(feature = "tokio")]
 use tracing::{debug, error, info, trace, warn};
 
 use uv_static::EnvVars;
-#[cfg(windows)]
+#[cfg(all(windows, feature = "tokio"))]
 use windows::Win32::Foundation::ERROR_LOCK_VIOLATION;
 
-use crate::{Simplified, is_known_already_locked_error};
+use crate::Simplified;
+#[cfg(feature = "tokio")]
+use crate::is_known_already_locked_error;
 
 /// Parsed value of `UV_LOCK_TIMEOUT`, with a default of 5 min.
+#[cfg(feature = "tokio")]
 static LOCK_TIMEOUT: LazyLock<Duration> = LazyLock::new(|| {
     let default_timeout = Duration::from_mins(5);
     let Some(lock_timeout) = env::var_os(EnvVars::UV_LOCK_TIMEOUT) else {
@@ -97,6 +101,7 @@ pub enum LockedFileMode {
     Exclusive,
 }
 
+#[cfg(feature = "tokio")]
 impl LockedFileMode {
     /// Try to lock the file and return an error if the lock is already acquired by another process
     /// and cannot be acquired immediately.
```

---

### Incident Patch 9: `606e127c` (2026-10-07)
**Commit Message**: Fix documentation links in extracted crates (#22305)

The extracted crates expose stale type references and a malformed
`zipapp` link in their public documentation. Update the type references
to `Pep723ItemRef` and `RequirementsSpecification`, and link directly to
Python's `zipapp` documentation.

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>

**File**: `crates/uv-environment-operations/src/lib.rs` (modified, +2/-2)
```diff
@@ -1721,7 +1721,7 @@ pub async fn sync_environment(
     Ok(venv)
 }
 
-/// The result of updating a [`PythonEnvironment`] to satisfy a set of [`RequirementsSource`]s.
+/// The result of updating a [`PythonEnvironment`] to satisfy a [`RequirementsSpecification`].
 #[derive(Debug)]
 pub struct EnvironmentUpdate {
     /// The updated [`PythonEnvironment`].
@@ -1730,7 +1730,7 @@ pub struct EnvironmentUpdate {
     pub changelog: Changelog,
 }
 
-/// Update a [`PythonEnvironment`] to satisfy a set of [`RequirementsSource`]s.
+/// Update a [`PythonEnvironment`] to satisfy a [`RequirementsSpecification`].
 pub async fn update_environment(
     venv: PythonEnvironment,
     spec: RequirementsSpecification,
```

**File**: `crates/uv-project-commands/src/run.rs` (modified, +1/-2)
```diff
@@ -1410,8 +1410,7 @@ pub enum RunCommand {
     /// Execute a Python package containing a `__main__.py` file.
     /// If an entrypoint with the target name is installed in the environment, it is preferred.
     PythonPackage(OsString, PathBuf, Vec<OsString>),
-    /// Execute a Python [zipapp].
-    /// [zipapp]: <https://docs.python.org/3/library/zipapp.html>
+    /// Execute a Python [zipapp](https://docs.python.org/3/library/zipapp.html).
     PythonZipapp(PathBuf, Vec<OsString>),
     /// Execute a `python` script provided via `stdin`.
     PythonStdin(Vec<u8>, Vec<OsString>),
```

**File**: `crates/uv-python-context/src/script.rs` (modified, +4/-4)
```diff
@@ -119,7 +119,7 @@ pub enum ScriptInterpreter {
 }
 
 impl ScriptInterpreter {
-    /// Return the expected virtual environment path for the [`Pep723Script`].
+    /// Return the expected virtual environment path for the [`Pep723ItemRef`].
     ///
     /// If `--active` is set, the active virtual environment will be preferred.
     ///
@@ -221,7 +221,7 @@ impl ScriptInterpreter {
         }
     }
 
-    /// Discover the interpreter to use for the current [`Pep723Item`].
+    /// Discover the interpreter to use for the current [`Pep723ItemRef`].
     pub async fn discover(
         script: Pep723ItemRef<'_>,
         python_request: Option<PythonRequest>,
@@ -397,7 +397,7 @@ pub fn check_environment_compatibility(
     Ok(())
 }
 
-/// The resolved Python request and requirement for a [`Pep723Script`]
+/// The resolved Python request and requirement for a [`Pep723ItemRef`].
 #[derive(Debug, Clone)]
 struct ScriptPython {
     /// The source of the Python request.
@@ -411,7 +411,7 @@ struct ScriptPython {
 }
 
 impl ScriptPython {
-    /// Determine the [`ScriptPython`] for the current [`Pep723Script`].
+    /// Determine the [`ScriptPython`] for the current [`Pep723ItemRef`].
     async fn from_request(
         python_request: Option<PythonRequest>,
         script: Pep723ItemRef<'_>,
```

---

### Incident Patch 10: `4f568572` (2026-10-07)
**Commit Message**: Allow auth login over IPv6 loopback (#22306)

Auth login accepts `localhost` and `127.0.0.1` over HTTP but rejects the
equivalent IPv6 loopback `http://[::1]:...`. Recognize `::1` as local
without relaxing the localhost-only security policy introduced in
[uv#15755](https://github.com/astral-sh/uv/pull/15755); this shares the
native-auth surface being rewritten in
[uv#18907](https://github.com/astral-sh/uv/pull/18907).

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>

**File**: `crates/uv-auth/src/service.rs` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ impl Service {
     fn check_scheme(url: &Url) -> Result<(), ServiceParseError> {
         match url.scheme() {
             "https" => Ok(()),
-            "http" if matches!(url.host_str(), Some("localhost" | "127.0.0.1")) => Ok(()),
+            "http" if matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")) => Ok(()),
             "http" => Err(ServiceParseError::HttpsRequired),
             value => Err(ServiceParseError::UnsupportedScheme(value.to_string())),
         }
```

**File**: `crates/uv/tests/it/auth.rs` (modified, +12/-0)
```diff
@@ -1046,6 +1046,18 @@ async fn login_text_store() {
     ----- stderr -----
     Stored credentials for testuser@http://localhost/
     ");
+
+    // HTTP should be allowed on IPv6 loopback
+    uv_snapshot!(context.filters(), context.auth_login()
+        .arg("http://[::1]:1324/simple")
+        .arg("--username")
+        .arg("testuser")
+        .arg("--password")
+        .arg("testpass"), @"
+    exit_code: 0 (success)
+    ----- stderr -----
+    Stored credentials for testuser@http://[::1]:1324/
+    ");
 }
 
 #[test]
```

---

### Incident Patch 11: `17cdcc31` (2026-10-07)
**Commit Message**: Stop requiring a concrete resolution error wrapper (#22293)

A resolution-context assertion requires an internal `ResolveError`
wrapper for I/O failures, although its concrete type is not part of the
command interface. Drop that requirement while retaining the error
classification and diagnostic assertions.

**File**: `crates/uv/src/commands/mod.rs` (modified, +0/-1)
```diff
@@ -155,7 +155,6 @@ mod error_tests {
             bail!("expected an unexpected error");
         };
         assert_snapshot!(format!("{error:#}"), @"cache write failed");
-        assert!(error.downcast_ref::<ResolveError>().is_some());
 
         Ok(())
     }
```

---

### Incident Patch 12: `dbd293a3` (2026-10-07)
**Commit Message**: Extract build commands into uv-build-commands (#22260)

## Summary

We move `uv build` into `uv-build-commands`, giving build orchestration
its own compilation boundary alongside the other command families. The
existing `uv-build-frontend` remains the shared interface to build
backends.

The `uv` crate supplies the diagnostic renderer used when reporting
failed builds, so error hints still use the central routing. The new
crate has no dependency on sibling command crates.

We fold the implementation into the command entrypoint and return
`ExitStatus` directly. This removes a forwarding call and the private
`BuildResult` enum used only to translate the result into an exit
status.

The instrumented x86_64 Linux release build exceeds 16 GB of memory with
the split crates, so we give its PGO job a 64 GB runner.

## Crate structure

Selected dependencies after the complete split:

```text
uv (process initialization, dispatch, remaining commands)
|
+-- uv-cli (argument parsing and settings resolution)
+-- uv-python-commands -------> uv-python-context
+-- uv-pip-commands ----------> uv-{resolve,install}-operations
+-- uv-project-commands ------> uv-{lock,environment,audit}-operations
|   

**File**: `.github/workflows/build-release-binaries.yml` (modified, +2/-1)
```diff
@@ -466,7 +466,8 @@ jobs:
 
   linux:
     name: ${{ matrix.target }}
-    runs-on: depot-ubuntu-latest-4
+    # The instrumented x86_64 PGO build exceeds 16 GB of RAM.
+    runs-on: ${{ matrix.target == 'x86_64-unknown-linux-gnu' && 'depot-ubuntu-24.04-16' || 'depot-ubuntu-latest-4' }}
     strategy:
       matrix:
         include:
```

**File**: `Cargo.lock` (modified, +46/-0)
```diff
@@ -5836,6 +5836,7 @@ dependencies = [
  "uv-auth",
  "uv-bin-install",
  "uv-build-backend",
+ "uv-build-commands",
  "uv-build-frontend",
  "uv-cache",
  "uv-cache-info",
@@ -6130,6 +6131,51 @@ dependencies = [
  "walkdir",
 ]
 
+[[package]]
+name = "uv-build-commands"
+version = "0.0.90"
+dependencies = [
+ "anyhow",
+ "fs-err",
+ "futures",
+ "owo-colors",
+ "tar-codec",
+ "tempfile",
+ "thiserror",
+ "tokio",
+ "tracing",
+ "uv-auth",
+ "uv-build-backend",
+ "uv-build-frontend",
+ "uv-cache",
+ "uv-client",
+ "uv-command-support",
+ "uv-configuration",
+ "uv-dispatch",
+ "uv-distribution",
+ "uv-distribution-filename",
+ "uv-distribution-types",
+ "uv-errors",
+ "uv-extract",
+ "uv-flags",
+ "uv-fs",
+ "uv-install-wheel",
+ "uv-installer",
+ "uv-normalize",
+ "uv-pep440",
+ "uv-preview",
+ "uv-python",
+ "uv-python-context",
+ "uv-requirements",
+ "uv-resolve-operations",
+ "uv-resolver",
+ "uv-settings",
+ "uv-types",
+ "uv-version",
+ "uv-warnings",
+ "uv-workspace",
+]
+
 [[package]]
 name = "uv-build-frontend"
 version = "0.0.90"
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ uv-audit-operations = { version = "0.0.90", path = "crates/uv-audit-operations"
 uv-auth = { version = "0.0.90", path = "crates/uv-auth" }
 uv-bin-install = { version = "0.0.90", path = "crates/uv-bin-install" }
 uv-build-backend = { version = "0.0.90", path = "crates/uv-build-backend" }
+uv-build-commands = { version = "0.0.90", path = "crates/uv-build-commands" }
 uv-build-frontend = { version = "0.0.90", path = "crates/uv-build-frontend" }
 uv-cache = { version = "0.0.90", path = "crates/uv-cache" }
 uv-cache-info = { version = "0.0.90", path = "crates/uv-cache-info" }
```

**File**: `crates/uv-build-commands/Cargo.toml` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+[package]
+name = "uv-build-commands"
+version = "0.0.90"
+description = "This is an internal component crate of uv"
+edition = { workspace = true }
+rust-version = { workspace = true }
+homepage = { workspace = true }
+repository = { workspace = true }
+authors = { workspace = true }
+license = { workspace = true }
+
+[lib]
+doctest = false
+
+[lints]
+workspace = true
+
+[dependencies]
+uv-auth = { workspace = true }
+uv-build-backend = { workspace = true }
+uv-build-frontend = { workspace = true }
+uv-cache = { workspace = true }
+uv-client = { workspace = true }
+uv-command-support = { workspace = true }
+uv-configuration = { workspace = true }
+uv-dispatch = { workspace = true }
+uv-distribution = { workspace = true }
+uv-distribution-filename = { workspace = true }
+uv-distribution-types = { workspace = true }
+uv-errors = { workspace = true }
+uv-extract = { workspace = true }
+uv-flags = { workspace = true }
+uv-fs = { workspace = true }
+uv-install-wheel = { workspace = true }
+uv-installer = { workspace = true }
+uv-normalize = { workspace = true }
+uv-pep440 = { workspace = true }
+uv-preview = { workspace = true }
+uv-python = { workspace = true }
+uv-python-context = { workspace = true }
+uv-requirements = { workspace = true }
+uv-resolve-operations = { workspace = true }
+uv-resolver = { workspace = true }
+uv-settings = { workspace = true }
+uv-types = { workspace = true }
+uv-version = { workspace = true }
+uv-warnings = { workspace = true }
+uv-workspace = { workspace = true }
+
+anyhow = { workspace = true }
+fs-err = { workspace = true }
+futures = { workspace = true }
+owo-colors = { workspace = true }
+tar-codec = { workspace = true }
+tempfile = { workspace = true }
+thiserror = { workspace = true }
+tokio = { workspace = true }
+tracing = { workspace = true }
```

**File**: `crates/uv-build-commands/src/lib.rs` (renamed, +17/-99)
```diff
@@ -1,3 +1,5 @@
+//! Commands for building Python distributions.
+
 use std::borrow::Cow;
 use std::fmt::Write as _;
 use std::io::Write as _;
@@ -30,7 +32,7 @@ use uv_distribution_types::{
     ConfigSettings, DependencyMetadata, ExtraBuildVariables, IndexLocations,
     NameRequirementSpecification, PackageConfigSettings, Requirement, SourceDist,
 };
-use uv_errors::{ErrorOptions, Hinted, Hints, write_error_chain_with_options};
+use uv_errors::{Hinted, Hints};
 use uv_fs::{Simplified, normalize_path, relative_to};
 use uv_install_wheel::LinkMode;
 use uv_installer::{InstallationStrategy, SatisfiesResult, SitePackages};
@@ -55,7 +57,7 @@ use uv_python_context::{PythonContextError, PythonDownloadReporter, find_require
 use uv_settings::ResolverSettings;
 
 #[derive(Debug, Error)]
-pub(crate) enum Error {
+pub enum Error {
     #[error(transparent)]
     Io(#[from] io::Error),
     #[error(transparent)]
@@ -194,8 +196,10 @@ impl Hinted for Error {
 }
 
 /// Build source distributions and wheels.
+// https://github.com/rust-lang/rust/issues/147648
+#[allow(unused_assignments)]
 #[expect(clippy::fn_params_excessive_bools)]
-pub(crate) async fn build_frontend(
+pub async fn build_frontend(
     project_dir: &Path,
     skip_dependency_check: bool,
     src: Option<PathBuf>,
@@ -225,89 +229,8 @@ pub(crate) async fn build_frontend(
     workspace_cache: &WorkspaceCache,
     printer: Printer,
     preview: Preview,
+    render_error: fn(&anyhow::Error, Printer) -> std::fmt::Result,
 ) -> Result<ExitStatus> {
-    let build_result = build_impl(
-        project_dir,
-        skip_dependency_check,
-        src.as_deref(),
-        package.as_ref(),
-        all_packages,
-        output_dir.as_deref(),
-        sdist,
-        wheel,
-        list,
-        build_logs,
-        gitignore,
-        force_pep517,
-        clear,
-        &build_constraints,
-        &build_constraints_from_workspace,
-        hash_checking,
-        python.as_deref(),
-        install_mirrors,
-        settings,
-        client_builder,
-        config_discovery,
-        python_preference,
-        python_arch,
-        python_downloads,
-        &concurrency,
-        cache,
-        workspace_cache,
-        printer,
-        preview,
-    )
-    .await?;
-
-    match build_result {
-        BuildResult::Failure => Ok(ExitStatus::Error),
-        BuildResult::Success => Ok(ExitStatus::Success),
-    }
-}
-
-/// Represents the overall result of a build process.
-#[derive(Debug, Clone, Copy, PartialEq, Eq)]
-enum BuildResult {
-    /// Indicates that at least one of the builds failed.
-    Failure,
-    /// Indicates that all builds succeeded.
-    Success,
-}
-
-// https://github.com/rust-lang/rust/issues/147648
-#[allow(unused_assignments)]
-#[expect(clippy::fn_params_excessive_bools)]
-async fn build_impl(
-    project_dir: &Path,
-    skip_dependency_check: bool,
-    src: Option<&Path>,
-    package: Option<&PackageName>,
-    all_packages: bool,
-    output_dir: Option<&Path>,
-    sdist: bool,
-    wheel: bool,
-    list: bool,
-    build_logs: bool,
-    gitignore: bool,
-    force_pep517: bool,
-    clear: bool,
-    build_constraints: &[RequirementsSource],
-    build_constraints_from_workspace: &[NameRequirementSpecification],
-    hash_checking: Option<HashCheckingMode>,
-    python_request: Option<&str>,
-    install_mirrors: PythonInstallMirrors,
-    settings: &ResolverSettings,
-    client_builder: &BaseClientBuilder<'_>,
-    config_discovery: ConfigDiscovery,
-    python_preference: PythonPreference,
-    python_arch: Option<PythonArchitecture>,
-    python_downloads: PythonDownloads,
-    concurrency: &Concurrency,
-    cache: &Cache,
-    workspace_cache: &WorkspaceCache,
-    printer: Printer,
-    preview: Preview,
-) -> Result<BuildResult> {
     // Extract the resolver settings.
     let ResolverSettings {
         index_locations,
@@ -378,7 +301,7 @@ async fn build_impl(
     );
 
     // If a `--package` or `--all-packages` was provided, adjust the source directory.
-    let packages = if let Some(package) = package {
+    let packages = if let Some(package) = package.as_ref() {
         if matches!(src, Source::File(_)) {
             return Err(anyhow::anyhow!(
                 "Cannot specify `--package` when building from a file"
@@ -478,8 +401,8 @@ async fn build_impl(
         let future = build_package(
             source.clone(),
             skip_dependency_check,
-            output_dir,
-            python_request,
+            output_dir.as_deref(),
+            python.as_deref(),
             install_mirrors.clone(),
             config_discovery,
             workspace.as_deref(),
@@ -496,16 +419,16 @@ async fn build_impl(
             gitignore,
             force_pep517,
             clear,
-            build_constraints,
-            build_constraints_from_workspace,
+            &build_constraints,
+            &build_constraints_from_workspace,
             build_isolation,
            
```

**File**: `crates/uv/Cargo.toml` (modified, +3/-2)
```diff
@@ -18,6 +18,7 @@ workspace = true
 uv-auth = { workspace = true }
 uv-bin-install = { workspace = true }
 uv-build-backend = { workspace = true }
+uv-build-commands = { workspace = true }
 uv-build-frontend = { workspace = true }
 uv-cache = { workspace = true }
 uv-cache-info = { workspace = true }
@@ -32,7 +33,6 @@ uv-distribution-filename = { workspace = true }
 uv-distribution-types = { workspace = true }
 uv-environment-operations = { workspace = true }
 uv-errors = { workspace = true }
-uv-extract = { workspace = true }
 uv-flags = { workspace = true }
 uv-fs = { workspace = true }
 uv-install-operations = { workspace = true }
@@ -90,7 +90,6 @@ itertools = { workspace = true }
 owo-colors = { workspace = true }
 serde = { workspace = true }
 serde_json = { workspace = true }
-tar-codec = { workspace = true }
 tempfile = { workspace = true }
 textwrap = { workspace = true }
 thiserror = { workspace = true }
@@ -115,6 +114,7 @@ embed-manifest = { workspace = true }
 
 [dev-dependencies]
 uv-cache-key = { workspace = true }
+uv-extract = { workspace = true }
 uv-platform = { workspace = true }
 uv-publish = { workspace = true, features = ["test"] }
 uv-test = { workspace = true }
@@ -139,6 +139,7 @@ predicates = { workspace = true }
 regex = { workspace = true }
 reqwest = { workspace = true, default-features = false }
 sha2 = { workspace = true }
+tar-codec = { workspace = true }
 tempfile = { workspace = true }
 tokio-stream = { workspace = true }
 tokio-util = { workspace = true }
```

**File**: `crates/uv/src/commands/diagnostics.rs` (modified, +2/-1)
```diff
@@ -7,6 +7,7 @@ use crate::commands::project::version::MissingProjectVersionError;
 use crate::commands::python::install::InvalidUpgradeRequestError;
 use crate::commands::tool::NoExecutablesError;
 use crate::commands::tool::run::{ToolRunScriptError, ToolRunUsageError};
+use uv_build_commands::Error as BuildError;
 use uv_command_support::Printer;
 use uv_resolve_operations::ExtrasWithoutSourceError;
 
@@ -48,7 +49,7 @@ pub(crate) fn hints_for_error(err: &anyhow::Error) -> Hints<'static> {
         collect_hint::<ExternallyManagedError>(cause, &mut hints);
         collect_hint::<MissingProjectVersionError>(cause, &mut hints);
         collect_hint::<InvalidUpgradeRequestError>(cause, &mut hints);
-        collect_hint::<crate::commands::build_frontend::Error>(cause, &mut hints);
+        collect_hint::<BuildError>(cause, &mut hints);
         collect_hint::<uv_build_backend::Error>(cause, &mut hints);
         collect_hint::<uv_build_frontend::Error>(cause, &mut hints);
         collect_hint::<uv_python::Error>(cause, &mut hints);
```

**File**: `crates/uv/src/commands/mod.rs` (modified, +1/-2)
```diff
@@ -3,7 +3,6 @@ pub(crate) use auth::helper::helper as auth_helper;
 pub(crate) use auth::login::login as auth_login;
 pub(crate) use auth::logout::logout as auth_logout;
 pub(crate) use auth::token::token as auth_token;
-pub(crate) use build_frontend::build_frontend;
 pub(crate) use cache_clean::cache_clean;
 pub(crate) use cache_dir::cache_dir;
 pub(crate) use cache_prune::cache_prune;
@@ -50,6 +49,7 @@ pub(crate) use tool::run::run as tool_run;
 pub(crate) use tool::uninstall::uninstall as tool_uninstall;
 pub(crate) use tool::update_shell::update_shell as tool_update_shell;
 pub(crate) use tool::upgrade::upgrade as tool_upgrade;
+pub(crate) use uv_build_commands::build_frontend;
 pub use uv_command_support::ExitStatus;
 pub(crate) use uv_console::human_readable_bytes;
 pub(crate) use venv::venv;
@@ -60,7 +60,6 @@ pub(crate) use workspace::metadata::metadata;
 
 mod auth;
 pub(crate) mod build_backend;
-mod build_frontend;
 mod cache_clean;
 mod cache_dir;
 mod cache_prune;
```

---

### Incident Patch 13: `7eb6c223` (2026-10-07)
**Commit Message**: Separate frozen-lockfile requirements from Python discovery (#22250)

## Summary

We move frozen-lockfile Python requirement calculation onto
`InstallTarget`, which already determines the selected packages and
groups. Environment selection and `uv tree` pass the computed
requirement directly to `ProjectPythonRequest::from_requirements`.

Python discovery receives the requirement and its diagnostic sources
without depending on an installation target.

**File**: `crates/uv/src/commands/project/install_target.rs` (modified, +64/-3)
```diff
@@ -6,12 +6,11 @@ use std::str::FromStr;
 use itertools::Either;
 use rustc_hash::FxHashSet;
 
-use crate::commands::project::EnvironmentError;
 use uv_configuration::{
     BuildOptions, Constraints, DependencyGroupsWithDefaults, ExtrasSpecification,
     ExtrasSpecificationWithDefaults, InstallOptions, InstallTarget as InstallOptionTarget,
 };
-use uv_distribution_types::{Index, Resolution};
+use uv_distribution_types::{Index, RequiresPython, Resolution};
 use uv_lock::{Installable, InstallableRootKind, Lock, LockError, Package};
 use uv_normalize::{DEV_DEPENDENCIES, ExtraName, GroupName, PackageName};
 use uv_platform_tags::Tags;
@@ -21,7 +20,10 @@ use uv_pypi_types::{
 };
 use uv_scripts::Pep723Script;
 use uv_workspace::pyproject::{Source, Sources, ToolUvSources};
-use uv_workspace::{VirtualProject, Workspace};
+use uv_workspace::{RequiresPythonDeclaration, RequiresPythonSources, VirtualProject, Workspace};
+
+use crate::commands::project::EnvironmentError;
+use crate::commands::project::python::{ProjectPythonRequirement, PythonRequirementSource};
 
 /// A target that can be installed from a lockfile.
 #[derive(Debug, Copy, Clone)]
@@ -283,6 +285,65 @@ impl<'lock> Installable<'lock> for InstallTarget<'lock> {
 }
 
 impl<'lock> InstallTarget<'lock> {
+    /// Intersect the lockfile's Python requirement with the selected groups' requirements.
+    pub(super) fn python_requirement(
+        &self,
+        groups: &DependencyGroupsWithDefaults,
+    ) -> Result<ProjectPythonRequirement, EnvironmentError> {
+        let lock = self.lock();
+        let mut group_requirements = RequiresPythonSources::new();
+
+        if let Some(members) = lock.member_group_metadata() {
+            let group_root = self.group_root(groups);
+
+            for (member, member_groups) in members {
+                // The group root can contribute groups without being an install root.
+                let is_install_root = self.roots().any(|root| root == member);
+                if !is_install_root && group_root != Some(member) {
+                    continue;
+                }
+
+                for (group, metadata) in member_groups {
+                    if self.includes_group(Some(member), group, groups)
+                        && let Some(requires_python) = &metadata.requires_python
+                    {
+                        group_requirements.insert(
+                            RequiresPythonDeclaration::Member(member.clone(), Some(group.clone())),
+                            requires_python.clone(),
+                        );
+                    }
+                }
+            }
+        }
+
+        for (group, metadata) in lock.workspace_group_metadata() {
+            if self.includes_group(None, group, groups)
+                && let Some(requires_python) = &metadata.requires_python
+            {
+                group_requirements.insert(
+                    RequiresPythonDeclaration::Workspace(group.clone()),
+                    requires_python.clone(),
+                );
+            }
+        }
+
+        let Some(requires_python) = RequiresPython::intersection(
+            std::iter::once(lock.requires_python().specifiers()).chain(group_requirements.values()),
+        ) else {
+            return Err(EnvironmentError::DisjointLockedRequiresPython {
+                locked: lock.requires_python().clone(),
+                groups: group_requirements,
+            });
+        };
+        Ok(ProjectPythonRequirement {
+            requires_python,
+            source: PythonRequirementSource::Lockfile {
+                locked: lock.requires_python().clone(),
+                groups: group_requirements,
+            },
+        })
+    }
+
     /// Select installation roots from a project and its workspace.
     pub(crate) fn from_project(
         project: &'lock VirtualProject,
```

**File**: `crates/uv/src/commands/project/mod.rs` (modified, +3/-3)
```diff
@@ -1376,10 +1376,10 @@ impl ProjectEnvironment {
             }),
         });
         let project_python = if let Some(frozen_target) = frozen_target {
-            ProjectPythonRequest::from_lockfile(
+            ProjectPythonRequest::from_requirements(
                 python,
-                frozen_target,
-                groups,
+                Some(frozen_target.install_path()),
+                Some(frozen_target.python_requirement(groups)?),
                 target.install_path(),
                 config_discovery,
             )
```

**File**: `crates/uv/src/commands/project/python.rs` (modified, +5/-84)
```diff
@@ -9,7 +9,6 @@ use uv_client::BaseClientBuilder;
 use uv_configuration::DependencyGroupsWithDefaults;
 use uv_distribution_types::RequiresPython;
 use uv_fs::Simplified;
-use uv_lock::Installable;
 use uv_pep440::TildeVersionSpecifier;
 use uv_python::{
     ConfigDiscovery, EnvironmentPreference, Interpreter, PythonArchitecture, PythonDownloads,
@@ -20,8 +19,7 @@ use uv_settings::PythonInstallMirrors;
 use uv_warnings::warn_user_once;
 use uv_workspace::{RequiresPythonDeclaration, RequiresPythonSources, Workspace};
 
-use crate::commands::project::install_target::InstallTarget;
-use crate::commands::project::{EnvironmentError, PythonContextError};
+use crate::commands::project::PythonContextError;
 use crate::commands::reporters::PythonDownloadReporter;
 
 /// An interpreter that satisfies the Python requirement used to select it.
@@ -63,9 +61,9 @@ impl std::fmt::Display for PythonRequestSource {
 
 /// A Python requirement and the source used to derive it.
 #[derive(Debug, Clone)]
-struct ProjectPythonRequirement {
-    requires_python: RequiresPython,
-    source: PythonRequirementSource,
+pub(super) struct ProjectPythonRequirement {
+    pub(super) requires_python: RequiresPython,
+    pub(super) source: PythonRequirementSource,
 }
 
 /// The resolved Python request and requirement for a workspace or frozen lockfile.
@@ -82,24 +80,6 @@ pub(crate) struct ProjectPythonRequest {
 }
 
 impl ProjectPythonRequest {
-    /// Determine the Python request and requirement from a frozen lockfile.
-    pub(super) async fn from_lockfile(
-        python_request: Option<PythonRequest>,
-        target: InstallTarget<'_>,
-        groups: &DependencyGroupsWithDefaults,
-        project_dir: &Path,
-        config_discovery: ConfigDiscovery,
-    ) -> Result<Self, EnvironmentError> {
-        Ok(Self::from_requirements(
-            python_request,
-            Some(target.install_path()),
-            Some(find_lockfile_requires_python(target, groups)?),
-            project_dir,
-            config_discovery,
-        )
-        .await?)
-    }
-
     /// Determine the [`ProjectPythonRequest`] for the current [`Workspace`].
     pub(crate) async fn from_request(
         python_request: Option<PythonRequest>,
@@ -124,7 +104,7 @@ impl ProjectPythonRequest {
     }
 
     /// Select a Python request using a project's root and Python requirement.
-    async fn from_requirements(
+    pub(super) async fn from_requirements(
         python_request: Option<PythonRequest>,
         workspace_root: Option<&Path>,
         requirement: Option<ProjectPythonRequirement>,
@@ -303,65 +283,6 @@ fn find_workspace_python_requirement(
     }
 }
 
-/// Intersect the lockfile's Python requirement with the selected groups' requirements.
-fn find_lockfile_requires_python(
-    target: InstallTarget<'_>,
-    groups: &DependencyGroupsWithDefaults,
-) -> Result<ProjectPythonRequirement, EnvironmentError> {
-    let lock = target.lock();
-    let mut group_requirements = RequiresPythonSources::new();
-
-    if let Some(members) = lock.member_group_metadata() {
-        let group_root = target.group_root(groups);
-
-        for (member, member_groups) in members {
-            // The group root can contribute groups without being an install root.
-            let is_install_root = target.roots().any(|root| root == member);
-            if !is_install_root && group_root != Some(member) {
-                continue;
-            }
-
-            for (group, metadata) in member_groups {
-                if target.includes_group(Some(member), group, groups)
-                    && let Some(requires_python) = &metadata.requires_python
-                {
-                    group_requirements.insert(
-                        RequiresPythonDeclaration::Member(member.clone(), Some(group.clone())),
-                        requires_python.clone(),
-                    );
-                }
-            }
-        }
-    }
-
-    for (group, metadata) in lock.workspace_group_metadata() {
-        if target.includes_group(None, group, groups)
-            && let Some(requires_python) = &metadata.requires_python
-        {
-            group_requirements.insert(
-                RequiresPythonDeclaration::Workspace(group.clone()),
-                requires_python.clone(),
-            );
-        }
-    }
-
-    let Some(requires_python) = RequiresPython::intersection(
-        std::iter::once(lock.requires_python().specifiers()).chain(group_requirements.values()),
-    ) else {
-        return Err(EnvironmentError::DisjointLockedRequiresPython {
-            locked: lock.requires_python().clone(),
-            groups: group_requirements,
-        });
-    };
-    Ok(ProjectPythonRequirement {
-        requires_python,
-        source: PythonRequirementSource::Lockfile {
-            locked: lock.requires_python().clone(),
-            groups: group_requirements,
-        },
-    })
-}
-
 /// The requirements that exclude a Python version, and where th
```

**File**: `crates/uv/src/commands/project/tree.rs` (modified, +15/-11)
```diff
@@ -34,8 +34,8 @@ use crate::commands::project::lock::{LockMode, LockOperation};
 use crate::commands::project::lock_target::LockTarget;
 use crate::commands::project::lockfile::FrozenWorkspace;
 use crate::commands::project::{
-    ProjectEnvironmentPolicy, ProjectEnvironmentTarget, ProjectInterpreter, ProjectPythonRequest,
-    ScriptInterpreter,
+    EnvironmentError, ProjectEnvironmentPolicy, ProjectEnvironmentTarget, ProjectInterpreter,
+    ProjectPythonRequest, ScriptInterpreter,
 };
 use crate::commands::{ExitStatus, UvError};
 use crate::printer::Printer;
@@ -184,19 +184,23 @@ pub(crate) async fn tree(
                 } else {
                     root
                 };
-                let project_python = ProjectPythonRequest::from_lockfile(
+
+                let target = InstallTarget::Lockfile {
+                    root,
+                    project_name: lock.root().map(uv_lock::Package::name),
+                    selection: PackageSelection::Workspace,
+                    lock,
+                };
+
+                let project_python = ProjectPythonRequest::from_requirements(
                     python.as_deref().map(PythonRequest::parse),
-                    InstallTarget::Lockfile {
-                        root,
-                        project_name: lock.root().map(uv_lock::Package::name),
-                        selection: PackageSelection::Workspace,
-                        lock,
-                    },
-                    &groups,
+                    Some(root),
+                    Some(target.python_requirement(&groups)?),
                     discovery_dir,
                     config_discovery,
                 )
-                .await?;
+                .await
+                .map_err(EnvironmentError::from)?;
                 ProjectInterpreter::discover(
                     ProjectEnvironmentTarget::Lockfile { root, lock },
                     project_python,
```

---

### Incident Patch 14: `b710f1fc` (2026-10-07)
**Commit Message**: Fix trusted-publishing CLI precedence (#22279)

`uv publish --trusted-publishing never` can lose to `trusted-publishing
= "always"` in configuration because the publish settings combine order
is reversed. Give the explicit CLI policy precedence.

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>

**File**: `crates/uv/src/settings.rs` (modified, +3/-2)
```diff
@@ -5327,8 +5327,9 @@ impl PublishSettings {
                 .publish_url
                 .combine(publish_url)
                 .unwrap_or_else(|| DisplaySafeUrl::parse(PYPI_PUBLISH_URL).unwrap()),
-            trusted_publishing: trusted_publishing
-                .combine(args.trusted_publishing)
+            trusted_publishing: args
+                .trusted_publishing
+                .combine(trusted_publishing)
                 .unwrap_or_default(),
             keyring_provider: args
                 .keyring_provider
```

**File**: `crates/uv/tests/sync/show_settings.rs` (modified, +18/-1)
```diff
@@ -381,7 +381,7 @@ fn publish_resolved_settings() -> anyhow::Result<()> {
         url = "https://index-user:index-secret@test.pypi.org/simple/"
     "#})?;
 
-    uv_snapshot!(context.filters(), add_shared_args(context.publish())
+    let configured = capture_uv_snapshot!(context.filters(), add_shared_args(context.publish())
         .arg("--show-settings")
         .env(EnvVars::UV_PUBLISH_TOKEN, "publish-secret-token"), @r#"
     exit_code: 0 (success)
@@ -539,6 +539,23 @@ fn publish_resolved_settings() -> anyhow::Result<()> {
     }
     "#);
 
+    diff_uv_snapshot!(context.filters(), &configured, add_shared_args(context.publish())
+        .arg("--show-settings")
+        .arg("--trusted-publishing")
+        .arg("always")
+        .env(EnvVars::UV_PUBLISH_TOKEN, "publish-secret-token"), @"
+    ...
+             query: None,
+             fragment: None,
+         },
+    -    trusted_publishing: Never,
+    +    trusted_publishing: Always,
+         keyring_provider: Subprocess,
+         check_url: Some(
+             Url(
+    ...
+    ");
+
     Ok(())
 }
 
```

---

### Incident Patch 15: `edcf6526` (2026-10-07)
**Commit Message**: Preserve JSON version output in quiet mode (#22280)

`uv version --output-format json` and `uv self version --output-format
json` write through the ordinary stdout stream, so a single `--quiet`
suppresses their machine-readable result. Send these JSON responses
through the important stdout stream while leaving text output and the
fully silent `-qq` mode unchanged.

Related to astral-sh/uv#16980.

Co-authored-by: Zanie Blue <[REDACTED_EMAIL]>

**File**: `crates/uv/src/commands/project/version.rs` (modified, +1/-1)
```diff
@@ -747,7 +747,7 @@ fn print_version(
         VersionFormat::Json => {
             let final_version = new_version.unwrap_or(old_version);
             let string = serde_json::to_string_pretty(&final_version)?;
-            writeln!(printer.stdout(), "{string}")?;
+            writeln!(printer.stdout_important(), "{string}")?;
         }
     }
     Ok(())
```

**File**: `crates/uv/src/commands/version.rs` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ pub(crate) fn self_version(
         }
         VersionFormat::Json => {
             let string = serde_json::to_string_pretty(&version_info)?;
-            writeln!(printer.stdout(), "{string}")?;
+            writeln!(printer.stdout_important(), "{string}")?;
         }
     }
 
```

**File**: `crates/uv/tests/it/version.rs` (modified, +31/-5)
```diff
@@ -63,7 +63,7 @@ fn version_get_json() -> Result<()> {
         "#,
     )?;
 
-    uv_snapshot!(context.filters(), context.version()
+    let output = uv_snapshot!(context.filters(), context.version()
         .arg("--output-format").arg("json"), @r#"
     exit_code: 0 (success)
     ----- stdout -----
@@ -74,6 +74,19 @@ fn version_get_json() -> Result<()> {
     }
     "#);
 
+    context
+        .version()
+        .args(["--output-format", "json", "--quiet"])
+        .assert()
+        .success()
+        .stdout(String::from_utf8(output.stdout)?);
+    context
+        .version()
+        .args(["--output-format", "json", "-qq"])
+        .assert()
+        .success()
+        .stdout("");
+
     let pyproject = fs_err::read_to_string(&pyproject_toml)?;
     assert_snapshot!(
         pyproject,
@@ -2351,7 +2364,7 @@ fn self_version_json() -> Result<()> {
         "#,
     )?;
 
-    if git_version_info_expected() {
+    let output = if git_version_info_expected() {
         uv_snapshot!(context.filters(), context.self_version()
           .arg("--output-format").arg("json"), @r#"
         exit_code: 0 (success)
@@ -2368,7 +2381,7 @@ fn self_version_json() -> Result<()> {
           },
           "target_triple": "[TARGET]"
         }
-        "#);
+        "#)
     } else {
         uv_snapshot!(context.filters(), context.self_version()
           .arg("--output-format").arg("json"), @r#"
@@ -2380,8 +2393,21 @@ fn self_version_json() -> Result<()> {
         "commit_info": null,
         "target_triple": "[TARGET]"
       }
-      "#);
-    }
+      "#)
+    };
+
+    context
+        .self_version()
+        .args(["--output-format", "json", "--quiet"])
+        .assert()
+        .success()
+        .stdout(String::from_utf8(output.stdout)?);
+    context
+        .self_version()
+        .args(["--output-format", "json", "-qq"])
+        .assert()
+        .success()
+        .stdout("");
 
     let pyproject = fs_err::read_to_string(&pyproject_toml)?;
     assert_snapshot!(
```

#### Recent Merged Pull Requests:
- **PR #22334** (2026-10-07): Review premature formatting of domain values (@zaniebot)
- **PR #22332** (2026-10-07): Keep build resolution context in a typed error (@astral-automations-bot[bot])
- **PR #22331** (2026-10-07): Honor ARMv7 APT mirror fallback settings (@astral-automations-bot[bot])
- **PR #22330** (2026-10-07): Keep direct build backend errors typed (@astral-automations-bot[bot])
- **PR #22329** (2026-10-07): Represent resolution input failures with typed errors (@astral-automations-bot[bot])
- **PR #22328** (2026-10-07): Represent scoped override failures as resolution errors (@astral-automations-bot[bot])
- **PR #22327** (2026-10-07): Use environment errors when storing target credentials (@astral-automations-bot[bot])
- **PR #22326** (2026-10-07): Represent invalid build plans with typed errors (@astral-automations-bot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
