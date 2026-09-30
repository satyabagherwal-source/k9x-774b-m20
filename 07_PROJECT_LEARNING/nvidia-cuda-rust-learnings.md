# Forensic Learning Record (Deep Inspection): NVIDIA/cuda-rust

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:21:20.666Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/cuda-rust`
- **Description**: cuda-oxide is a Rust-to-CUDA compiler that lets you write (SIMT) GPU kernels in safe(ish), idiomatic Rust. It compiles standard Rust code directly to PTX — no DSLs, no foreign language bindings, just Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3633 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/cargo-oxide/src/artifact_identity.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

use std::collections::BTreeMap;
use std::ffi::OsString;
use std::io;
use std::path::{Component, Path, PathBuf};

use sha2::{Digest, Sha256};

const FORMAT_VERSION: &str = "cuda-oxide-artifact-identity-v1";

pub(crate) fn write(
    artifact_path: &Path,
    depfile_path: &Path,
    manifest_path: &Path,
    base_dir: &Path,
    cargo_target_dir: &Path,
    target: &str,
    device_features: Option<&str>,
) -> io::Result<PathBuf> {
    let base_dir = base_dir.canonicalize()?;
    // Build outputs (OUT_DIR-generated sources) are excluded by the actual
    // cargo target directory, so a source tree that happens to contain a
    // directory named `target` (e.g. `src/target/mod.rs`) is still digested.
    let cargo_target_dir = cargo_target_dir
        .canonicalize()
        .unwrap_or_else(|_| cargo_target_dir.to_path_buf());
    let dependency_base = manifest_path.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "device manifest has no parent directory",
        )
    })?;
    let mut sources = parse_depfile(&std::fs::read_to_string(depfile_path)?)?;
    sources.push(manifest_path.to_path_buf());
    if let Some(device_dir) = manifest_path.parent() {
        let lockfile = device_dir.join("Cargo.lock");
        if lockfile.is_file() {
            sources.push(lockfile);
        }
    }

    let mut source_hashes = BTreeMap::new();
    for source in sources {
        let source = if source.is_absolute() {
            source
        } else {
            dependency_base.join(source)
        };
        let source = source.canonicalize()?;
        if !is_identity_source(&source, &cargo_target_dir) {
            continue;
        }
        let relative = relative_path(&base_dir, &source);
        if relative.is_absolute() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "artifact identity source cannot be represented relative to the artifact directory",
            ));
        }
        let relative = path_text(&relative)?;
        if relative.contains(['\n', '\r', '\t']) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "artifact identity source path contains a control separator",
            ));
        }
        source_hashes.insert(relative, sha256(&std::fs::read(source)?));
    }
    if source_hashes.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "artifact dependency file contained no Rust sources",
        ));
    }

    let mut source_identity = Sha256::new();
    for (path, digest) in &source_hashes {
        source_identity.update(path.as_bytes());
        source_identity.update([0]);
        source_identity.update(digest.as_bytes());
        source_identity.update([0]);
    }

    let artifact_hash = sha256(&std::fs::read(artifact_path)?);
    let source_identity = hex(source_identity.finalize().as_slice());
    let device_features = normalize_features(device_features)?;
    let device_features = if device_features.is_empty() {
        "<none>".to_owned()
    } else {
        device_features.join(",")
    };
    let mut document = String::new();
    document.push_str(FORMAT_VERSION);
    document.push('\n');
    document.push_str("target\t");
    document.push_str(target);
    document.push('\n');
    document.push_str("device_features\t");
    document.push_str(&device_features);
    document.push('\n');
    document.push_str("artifact_sha256\t");
    document.push_str(&artifact_hash);
    document.push('\n');
    document.push_str("sources_sha256\t");
    document.push_str(&source_identity);
    document.push('\n');
    for (path, digest) in source_hashes {
        document.push_str("source\t");
        document.push_str(&path);
        document.push('\t');
        document.push_str(&digest);
        document.push('\n');
    }

    let identity_path = appended_path(artifact_path, ".identity");
    let temporary_path = appended_path(&identity_path, ".tmp");
    std::fs::write(&temporary_path, document)?;
    std::fs::rename(&temporary_path, &identity_path)?;
    Ok(identity_path)
}

fn normalize_features(features: Option<&str>) -> io::Result<Vec<&str>> {
    let Some(features) = features else {
        return Ok(Vec::new());
    };
    let mut normalized = features.split(',').map(str::trim).collect::<Vec<_>>();
    if normalized.iter().any(|feature| feature.is_empty()) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "device feature list contains an empty feature",
        ));
    }
    normalized.sort_unstable();
    normalized.dedup();
    Ok(normalized)
}

fn parse_depfile(contents: &str) -> io::Result<Vec<PathBuf>> {
    let Some((_, dependencies)) = contents.split_once(':') else {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "artifact dependency file has no target separator",
        ));
    };
    let dependencies = dependencies.replace("\\\n", "");
    let mut paths = Vec::new();
    let mut current = String::new();
    let mut escaped = false;
    for character in dependencies.chars() {
        if escaped {
            current.push(character);
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character.is_whitespace() {
            if !current.is_empty() {
                paths.push(PathBuf::from(std::mem::take(&mut current)));
            }
        } else {
            current.push(character);
        }
    }
    if escaped {
        current.push('\\');
    }
    if !current.is_empty() {
        paths.push(PathBuf::from(current));
    }
    Ok(paths)
}

fn is_identity_source(path: &Path, cargo_target_dir: &Path) -> bool {
    // Exclude build outputs by the real cargo target directory, not by any
    // path component named "target": a crate may legitimately keep sources
    // under e.g. `src/target/mod.rs`, and dropping those silently
    // under-reported identity completeness.
    if path.starts_with(cargo_target_dir) {
        return false;
    }
    if path.components().any(|component| {
        matches!(
            component,
            Component::Normal(name)
                if name == ".pixi" || name == ".git"
        )
    }) {
        return false;
    }
    path.extension().is_some_and(|extension| extension == "rs")
        || path
            .file_name()
            .is_some_and(|name| name == "Cargo.toml" || name == "Cargo.lock")
}

fn relative_path(base: &Path, target: &Path) -> PathBuf {
    let base = base.components().collect::<Vec<_>>();
    let target = target.components().collect::<Vec<_>>();
    let common = base
        .iter()
        .zip(&target)
        .take_while(|(left, right)| left == right)
        .count();
    if common == 0 {
        return target.iter().collect();
    }
    let mut relative = PathBuf::new();
    for _ in common..base.len() {
        relative.push("..");
    }
    for component in &target[common..] {
        relative.push(component.as_os_str());
    }
    relative
}

fn path_text(path: &Path) -> io::Result<String> {
    path.to_str().map(str::to_owned).ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "artifact identity source path is not valid UTF-8",
        )
    })
}

fn sha256(bytes: &[u8]) -> String {
    hex(Sha256::digest(bytes).as_slice())
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for &byte in bytes {
        output.push(char::from(DIGITS[usize::from(byte >> 4)]));
        output.push(char::from(DIGITS[usize::from(byte & 0x0f)]));
    }
    output
}

fn appended_path(path: &Path, suffix: &str) -> PathBuf {
    let mut value = OsSt
```

### Core Architecture Module: `crates/cargo-oxide/src/backend.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Backend discovery and building.
//!
//! Finds or builds `librustc_codegen_cuda.so` using this priority:
//!
//! 1. `CUDA_OXIDE_BACKEND` env var (explicit override)
//! 2. Project config (`.cargo/cuda-oxide.toml`)
//! 3. Local repo (detected by presence of `crates/rustc-codegen-cuda`)
//! 4. Cached `.so` at `~/.cargo/cuda-oxide/librustc_codegen_cuda.so`, but
//!    only when it was built from the commit the project's cuda-oxide
//!    dependency resolves to (see "The backend follows the dependency" below)
//!    and none of the staleness checks fire
//! 5. Build from the dependency's checkout and cache the result. A project
//!    with no cuda-oxide dependency falls back to cloning `main` (one-time,
//!    or after a stale-cache miss)
//!
//! ## Cache staleness (issue #49)
//!
//! `cargo install` always rewrites `~/.cargo/bin/cargo-oxide` on every
//! upgrade, bumping its mtime. The cached `.so` is only ever written by
//! step 5 below, so a binary newer than the cache is the canonical signal
//! that the user has just upgraded `cargo-oxide` and the cached backend
//! no longer matches the binary loading it. When step 4 detects that, we
//! drop both the cached `.so` *and* the cached source tree so that step 5
//! re-clones fresh and rebuilds, rather than rebuilding from a clone that
//! was taken whenever the user first installed.
//!
//! ## Cache staleness vs. source (backend source advances)
//!
//! The binary-mtime check above does not fire when the developer updates
//! the backend SOURCE (the `rustc-codegen-cuda` crate) but leaves the
//! `cargo-oxide` binary unchanged. In that case the cached `.so` is older
//! than the source it was built from, yet the binary check sees no upgrade
//! and the stale backend is silently reused. To catch this we also compare
//! the cached `.so` against the newest mtime of the backend source inputs
//! (the crate's `src/**` and `Cargo.toml`) found in the cached source tree.
//! When the source tree cannot be located we degrade gracefully to the
//! binary-only check rather than erroring.
//!
//! The two stale signals call for different recovery. A binary upgrade means
//! the cached source may no longer match the new binary, so we drop the
//! source tree and re-clone fresh (above). A source advance means the cached
//! source IS the newer truth, so we rebuild the `.so` from that existing
//! source in place; re-cloning would throw away the very source that
//! triggered the rebuild. Binary staleness takes precedence when both fire.
//!
//! ## Cache staleness vs. toolchain (the active rustc changes)
//!
//! The mtime checks above miss a toolchain swap: the cached `.so` is
//! dynamically linked against one specific `librustc_driver-<hash>.so`, but a
//! repo `rust-toolchain.toml` or a changed default nightly leaves the
//! `cargo-oxide` binary and the cached source untouched. The stale `.so` then
//! loads against the wrong driver and fails with a cryptic
//! `librustc_driver-<hash>.so: cannot open shared object file`. To catch this
//! we record the fingerprint (`rustc -vV`) of the toolchain that built the
//! `.so` (resolved from the backend source directory, exactly like the build
//! command itself) next to the cached `.so`, and compare it on every lookup
//! against the toolchain active in the user's cwd; a recorded fingerprint
//! that differs from the active toolchain forces a fresh re-clone and rebuild.
//! This check has the highest precedence, since a toolchain mismatch makes the
//! cached `.so` unloadable regardless of mtimes. A cache predating the
//! fingerprint file defers to the mtime checks (a `cargo-oxide` reinstall or
//! `rm -rf ~/.cargo/cuda-oxide` heals those).
//!
//! Re-cloning can only heal a mismatch when upstream's pin agrees with the
//! user's (e.g. upstream main moved to the nightly the user just pinned).
//! When the user's project and the backend source genuinely pin DIFFERENT
//! nightlies, every rebuild re-records the same mismatching fingerprint and a
//! naive retry loops on a multi-minute cold rebuild per invocation. To stop
//! that, each heal attempt first records the (active, recorded) fingerprint
//! pair in a marker file next to the cached `.so`; if the very same pair
//! mismatches again after a rebuild, the lookup reports both toolchain
//! identities with guidance and exits instead of rebuilding. Any lookup that
//! passes the fingerprint check deletes the marker, so a genuinely healed
//! cache clears the memory.
//!
//! ## The backend follows the dependency
//!
//! Outside the repository, the backend source is the checkout Cargo made for
//! the project's `cuda-device` / `cuda-host` dependency (see
//! [`crate::backend_source`]), so the crates a kernel compiles against and
//! the backend that lowers it always come from one commit. That commit is
//! recorded next to the cached `.so` (`source-rev.txt`) and compared on every
//! lookup; a project resolving a different commit rebuilds the cache from its
//! own checkout. A path dependency is a local checkout and builds in place,
//! the same way step 3 does. Dependency checkouts build into
//! `~/.cargo/cuda-oxide/target`, one tree cargo-oxide owns (delete it to
//! reclaim the space) that consecutive commits share their dependency builds
//! in, rather than into Cargo's checkout.
//!
//! Under `cargo oxide` the rustup proxy exports `RUSTUP_TOOLCHAIN` for the
//! project's toolchain, and every child `cargo`/`rustc`, the backend build
//! included, uses it; a checkout's own `rust-toolchain.toml` gets no say.
//! That file still states the nightly the commit was written for, and
//! rustc_private APIs change between nightlies, so before any build the
//! project's active toolchain is compared with that channel and a mismatch is
//! reported up front, naming the channel to set, instead of spending minutes
//! on a backend that fails to compile or to load. The toolchain heal marker
//! above guards only the `main` clone path: a rebuild from a pinned
//! dependency's checkout converges by construction.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

use crate::backend_source::{self, CODEGEN_CRATE_SUBDIR, DependencySource};

/// Finds the workspace root by walking up from CWD looking for Cargo.toml
/// with a `crates/rustc-codegen-cuda` directory.
pub fn find_workspace_root() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    loop {
        if dir.join("crates/rustc-codegen-cuda").is_dir() && dir.join("Cargo.toml").is_file() {
            return Some(dir);
        }
        if !dir.pop() {
            return None;
        }
    }
}

/// Returns the path to the codegen backend `.so`, building it if necessary.
///
/// Discovery order:
/// 1. `CUDA_OXIDE_BACKEND` env var
/// 2. Project config (`.cargo/cuda-oxide.toml`)
/// 3. Local repo build (crates/rustc-codegen-cuda)
/// 4. Cached build at ~/.cargo/cuda-oxide/, when built from the commit the
///    project's cuda-oxide dependency resolves to
/// 5. Build from the dependency's checkout (or, without one, from a `main`
///    clone) and cache the result
pub fn find_or_build_backend(workspace_root: &Path, configured_backend: Option<&Path>) -> PathBuf {
    // 1. Explicit override
    if let Ok(path) = std::env::var("CUDA_OXIDE_BACKEND") {
        let p = PathBuf::from(&path);
        if p.exists() {
            return p;
        }
        eprintln!(
            "Warning: CUDA_OXIDE_BACKEND={} does not exist, falling back to auto-detection",
            path
        );
    }

    // 2. Project config
    if let Some(path) = configured_backend {
        if path.exists() {
            return path.to_path_buf();
        }
        eprintln!(
            "Error: configured cuda-oxide backend does not exist: {}",
            path.display()
        );
        eprintln!("Buil
```

### Core Architecture Module: `crates/cargo-oxide/src/backend_source.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Where a project outside the repository gets its backend source.
//!
//! Kernels compile against the `cuda-device` / `cuda-host` crates at the commit
//! Cargo resolved for them. The backend that lowers those kernels,
//! `librustc_codegen_cuda`, lives in the same repository and has to come from
//! the same commit: `cuda-device` only declares stubs (every method body is
//! `unreachable!()`), and the backend recognises each stub by its path and
//! supplies the whole lowering. A backend from another commit compiles the
//! kernels differently, or not at all, with no error pointing at the cause.
//!
//! So the backend is built from the checkout Cargo already made for the
//! dependency instead of from a separately cloned `main`:
//!
//! ```text
//! Cargo.lock   cuda-device = git+https://github.com/NVlabs/cuda-oxide.git#<sha>
//!                  │  cargo metadata: package.manifest_path
//!                  ▼
//! ~/.cargo/git/checkouts/cuda-oxide-<hash>/<sha>/crates/cuda-device/Cargo.toml
//!                  │  walk up to the repository root
//!                  ▼
//! ~/.cargo/git/checkouts/cuda-oxide-<hash>/<sha>/crates/rustc-codegen-cuda   built
//! ~/.cargo/git/checkouts/cuda-oxide-<hash>/<sha>/rust-toolchain.toml         nightly it needs
//! ```
//!
//! The checkout's `rust-toolchain.toml` matters as much as the code: the
//! backend is a rustc plugin and only loads into the toolchain that built it,
//! so that file names the nightly the project itself has to use.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// The cuda-oxide crates a project depends on directly. Any one of them
/// identifies the checkout: they ship in a single repository.
const CUDA_OXIDE_CRATES: &[&str] = &["cuda-device", "cuda-host", "cuda-macros"];

/// The backend crate, relative to a cuda-oxide checkout root.
pub const CODEGEN_CRATE_SUBDIR: &str = "crates/rustc-codegen-cuda";

/// The cuda-oxide checkout a project's dependency resolves to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DependencySource {
    /// A git dependency: Cargo's checkout of the repository at `rev`.
    Git {
        /// Repository root of the checkout.
        checkout: PathBuf,
        /// Full commit hash Cargo resolved (the `#<sha>` of the package source).
        rev: String,
    },
    /// A path dependency: a local checkout of the repository.
    Path {
        /// Repository root of the checkout.
        checkout: PathBuf,
    },
}

impl DependencySource {
    /// Repository root of the checkout.
    pub fn checkout(&self) -> &Path {
        match self {
            Self::Git { checkout, .. } | Self::Path { checkout } => checkout,
        }
    }

    /// The backend crate inside the checkout.
    pub fn codegen_crate(&self) -> PathBuf {
        self.checkout().join(CODEGEN_CRATE_SUBDIR)
    }

    /// The commit the checkout is at, for git dependencies.
    pub fn rev(&self) -> Option<&str> {
        match self {
            Self::Git { rev, .. } => Some(rev),
            Self::Path { .. } => None,
        }
    }

    /// One-line identity for messages.
    pub fn describe(&self) -> String {
        match self {
            Self::Git { rev, .. } => format!("cuda-oxide {} (git dependency)", short_rev(rev)),
            Self::Path { checkout } => format!(
                "cuda-oxide checkout {} (path dependency)",
                checkout.display()
            ),
        }
    }
}

/// Abbreviated commit hash for messages.
pub fn short_rev(rev: &str) -> &str {
    rev.get(..10).unwrap_or(rev)
}

/// The nightly a checkout pins in its `rust-toolchain.toml`, when readable.
pub fn pinned_channel(checkout: &Path) -> Option<String> {
    let contents = std::fs::read_to_string(checkout.join("rust-toolchain.toml")).ok()?;
    crate::commands::parse_rust_toolchain_toml(&contents)
        .ok()
        .map(|pin| pin.channel)
}

/// Resolves the cuda-oxide checkout the project in `project_dir` depends on.
///
/// Returns `Ok(None)` when no cuda-oxide crate is in the dependency graph.
/// With `read_only`, Cargo may neither fetch nor write `Cargo.lock`
/// (`--offline --locked`); passive commands such as `doctor` use this so a
/// diagnostic never touches the network or the project.
pub fn resolve_dependency_source(
    project_dir: &Path,
    read_only: bool,
) -> Result<Option<DependencySource>, String> {
    let metadata = cargo_metadata(project_dir, read_only)?;
    dependency_source_from_metadata(&metadata)
}

/// Reads the dependency checkout out of `cargo metadata` output.
///
/// Every cuda-oxide crate in the graph must resolve to one checkout; two
/// checkouts would mean two commits and no single backend to build for them.
pub fn dependency_source_from_metadata(
    metadata: &serde_json::Value,
) -> Result<Option<DependencySource>, String> {
    let packages = metadata
        .get("packages")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "`cargo metadata` output has no packages".to_string())?;

    let mut sources: Vec<DependencySource> = Vec::new();
    for package in packages {
        let Some(name) = package.get("name").and_then(serde_json::Value::as_str) else {
            continue;
        };
        if !CUDA_OXIDE_CRATES.contains(&name) {
            continue;
        }
        let manifest = package
            .get("manifest_path")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("`cargo metadata` lists `{name}` without a manifest_path"))?;
        let rev = match package.get("source").and_then(serde_json::Value::as_str) {
            None => None,
            Some(source) => Some(
                git_source_rev(source)
                    .ok_or_else(|| {
                        format!(
                            "`{name}` comes from `{source}`; only git and path dependencies \
                             carry the cuda-oxide checkout the backend is built from"
                        )
                    })?
                    .to_string(),
            ),
        };
        let checkout = checkout_root(Path::new(manifest)).ok_or_else(|| {
            format!(
                "`{name}` at {manifest} is not inside a cuda-oxide checkout (no \
                 `{CODEGEN_CRATE_SUBDIR}` above it), so there is no backend to build"
            )
        })?;
        let source = match rev {
            Some(rev) => DependencySource::Git { checkout, rev },
            None => DependencySource::Path { checkout },
        };
        if !sources.contains(&source) {
            sources.push(source);
        }
    }

    match sources.as_slice() {
        [] => Ok(None),
        [source] => Ok(Some(source.clone())),
        several => Err(format!(
            "cuda-oxide crates resolve from more than one checkout, so there is no single \
             backend to build:\n{}",
            several
                .iter()
                .map(|source| format!("  {}", source.describe()))
                .collect::<Vec<_>>()
                .join("\n")
        )),
    }
}

/// The resolved commit of a git package source.
///
/// Cargo writes git sources as `git+<url>?<rev|branch|tag>=<spec>#<sha>`; the
/// fragment is always the full commit hash, whatever the spec was.
fn git_source_rev(source: &str) -> Option<&str> {
    let rest = source.strip_prefix("git+")?;
    let (_, rev) = rest.rsplit_once('#')?;
    (!rev.is_empty()).then_some(rev)
}

/// Walks up from a crate manifest to the repository root, recognised by the
/// backend crate living under it.
///
/// The walk never leaves the repository the manifest belongs to: it stops at
/// the first directory that is itself a repository root (`.git`, or the
/// `.cargo-ok` marker Cargo writes into every git checkout). Without that
/// boundary a trimmed checkout would keep climbing and could latch onto an
/// un
```

### Core Architecture Module: `crates/cargo-oxide/src/commands/artifacts.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

use std::path::{Path, PathBuf};

use super::*;

/// Touch main.rs to force recompilation (faster than cargo clean).
pub(super) fn touch_main_rs(example_dir: &Path) {
    // Force a rebuild so the codegen backend re-runs and emits a fresh
    // .ptx alongside the example. Touch every source file that might
    // host `#[kernel]` items so multi-bin layouts (kernels in `lib.rs`,
    // tests in `main.rs`, perf bench in `bin/<name>.rs`, etc.) all
    // re-codegen on every `cargo oxide run/build` invocation.
    for rel in ["src/main.rs", "src/lib.rs"] {
        touch_source_file(&example_dir.join(rel));
    }
}

pub(super) fn touch_source_file(path: &Path) {
    if path.exists()
        && let Ok(content) = std::fs::read(path)
    {
        let _ = std::fs::write(path, content);
    }
}

/// Artifacts are named after the crate, and cargo normalizes hyphens in
/// package names to underscores (`rustlantis-smoke` emits
/// `rustlantis_smoke.ptx`). Always go through this when deriving an
/// artifact filename from an example name, or hyphenated examples keep
/// stale artifacts forever.
pub(super) fn artifact_stem(example: &str) -> String {
    example.replace('-', "_")
}

/// Return the PTX artifacts generated for a regular or metadata-interop project.
pub(super) fn ptx_artifact_paths(example_dir: &Path, example: &str) -> Vec<PathBuf> {
    if let Some(interop) =
        load_interop_config(example_dir).filter(|config| !config.device_crates.is_empty())
    {
        return interop
            .device_crates
            .iter()
            .filter(|device_crate| device_crate.artifact_kind == InteropArtifactKind::Ptx)
            .map(|device_crate| {
                let manifest_path = example_dir.join(&device_crate.manifest_path);
                let artifact_name = interop_device_artifact_name(&manifest_path, device_crate);

                interop_device_artifact_path(example_dir, device_crate, &artifact_name)
            })
            .collect();
    }

    let stem = artifact_stem(example);
    vec![example_dir.join(format!("{stem}.ptx"))]
}

pub(super) fn read_ptx_artifact(path: &Path) -> Result<String, String> {
    std::fs::read_to_string(path)
        .map_err(|error| format!("could not read generated PTX {}: {error}", path.display()))
}

/// Print one generated PTX artifact.
pub(super) fn print_ptx_artifact(path: &Path) -> Result<(), String> {
    let content = read_ptx_artifact(path)?;

    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string());

    println!();
    println!("=========================================");
    println!("PTX ({name})");
    println!("=========================================");
    print!("{content}");

    if !content.ends_with('\n') {
        println!();
    }

    Ok(())
}

/// Path to the NVVM IR (`.ll`) the backend emits for `example`. Named after the
/// Cargo-normalized crate stem, so a hyphenated example resolves to the
/// underscore-spelled file the build actually wrote. Route `emit-ltoir` reads
/// through here rather than deriving the name from the raw example.
pub(super) fn emitted_ll_path(example_dir: &Path, example: &str) -> PathBuf {
    example_dir.join(format!("{}.ll", artifact_stem(example)))
}

/// Default LTOIR output path for `example` when no explicit `--output` is given.
/// Uses the same Cargo-normalized crate stem as [`emitted_ll_path`] so reads and
/// writes agree on hyphenated examples.
pub(super) fn default_ltoir_path(example_dir: &Path, example: &str) -> PathBuf {
    example_dir.join(format!("{}.ltoir", artifact_stem(example)))
}

pub(super) const GENERATED_ARTIFACT_SUFFIXES: &[&str] = &[
    "ptx",
    "ll",
    "opt.ll",
    "ltoir",
    "cubin",
    "cubin.tmp",
    "cubin.identity",
    "ptx.identity",
    "target",
    "options",
    "cubin.target",
];

pub(super) fn generated_artifact_paths(project_dir: &Path, package_name: &str) -> Vec<PathBuf> {
    let stem = artifact_stem(package_name);

    GENERATED_ARTIFACT_SUFFIXES
        .iter()
        .map(|suffix| project_dir.join(format!("{stem}.{suffix}")))
        .collect()
}

/// Remove stale generated artifacts (`.ptx`, `.ll`, `.ltoir`, `.cubin`) from a
/// previous run so we can verify the build produces fresh output.
pub(super) fn clean_generated_files(example_dir: &Path, example: &str) {
    for file in generated_artifact_paths(example_dir, example) {
        if file.exists() {
            let _ = std::fs::remove_file(file);
        }
    }
}

/// Human-readable label for the selected output format.
pub(super) fn format_label(emit_nvvm_ir: bool) -> &'static str {
    if emit_nvvm_ir { "NVVM IR" } else { "PTX" }
}

/// Print generated artifacts (LLVM IR or PTX) to stdout after a pipeline build.
pub(super) fn show_generated_artifacts(example_dir: &Path, example: &str) {
    let stem = artifact_stem(example);
    let ll_file = example_dir.join(format!("{}.ll", stem));
    let ptx_file = example_dir.join(format!("{}.ptx", stem));

    if ll_file.exists() {
        println!();
        println!("=========================================");
        println!("LLVM IR ({}.ll)", stem);
        println!("=========================================");
        if let Ok(content) = std::fs::read_to_string(&ll_file) {
            println!("{}", content);
        }
    }

    if ptx_file.exists() {
        println!();
        println!("=========================================");
        println!("PTX ({}.ptx)", stem);
        println!("=========================================");
        if let Ok(content) = std::fs::read_to_string(&ptx_file) {
            println!("{}", content);
        }
    }
}

```

### Core Architecture Module: `crates/cargo-oxide/src/commands/clean.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

use std::path::Path;

use super::*;

// =============================================================================
// Clean command
// =============================================================================

pub fn clean(ctx: &Context) {
    match clean_context(ctx) {
        Ok(summary) if summary.removed_directories == 0 && summary.removed_files == 0 => {
            println!("Nothing to clean.");
        }
        Ok(summary) => {
            println!(
                "Removed {} directories and {} generated artifacts.",
                summary.removed_directories, summary.removed_files
            );
        }
        Err(error) => {
            eprintln!("Error: {error}");
            std::process::exit(1);
        }
    }
}

#[derive(Debug, Default, Eq, PartialEq)]
pub(super) struct CleanSummary {
    pub(super) removed_directories: usize,
    pub(super) removed_files: usize,
}

pub(super) fn clean_context(ctx: &Context) -> Result<CleanSummary, String> {
    let mut summary = CleanSummary::default();

    if ctx.is_workspace {
        clean_workspace(ctx, &mut summary)?;
    } else {
        clean_standalone_project(&ctx.workspace_root, &mut summary)?;
    }

    Ok(summary)
}

fn clean_standalone_project(project_dir: &Path, summary: &mut CleanSummary) -> Result<(), String> {
    let manifest_path = project_dir.join("Cargo.toml");
    let package_name = package_name_for_clean(&manifest_path)?;

    if remove_local_target(project_dir)? {
        summary.removed_directories += 1;
    }

    summary.removed_files += remove_generated_artifacts(project_dir, &package_name)?;

    Ok(())
}

fn clean_workspace(ctx: &Context, summary: &mut CleanSummary) -> Result<(), String> {
    if remove_local_target(&ctx.workspace_root)? {
        summary.removed_directories += 1;
    }

    if remove_local_target(&ctx.codegen_crate)? {
        summary.removed_directories += 1;
    }

    let entries = std::fs::read_dir(&ctx.examples_dir).map_err(|error| {
        format!(
            "could not read examples directory {}: {error}",
            ctx.examples_dir.display()
        )
    })?;

    let mut example_dirs = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "could not read an entry in {}: {error}",
                ctx.examples_dir.display()
            )
        })?;

        let file_type = entry.file_type().map_err(|error| {
            format!(
                "could not inspect example entry {}: {error}",
                entry.path().display()
            )
        })?;

        if !file_type.is_dir() {
            continue;
        }

        let example_dir = entry.path();
        if example_dir.join("Cargo.toml").is_file() {
            example_dirs.push(example_dir);
        }
    }

    example_dirs.sort();

    for example_dir in example_dirs {
        clean_example(&example_dir, summary)?;
    }

    Ok(())
}

fn clean_example(example_dir: &Path, summary: &mut CleanSummary) -> Result<(), String> {
    let manifest_path = example_dir.join("Cargo.toml");
    let package_name = package_name_for_clean(&manifest_path)?;

    if remove_local_target(example_dir)? {
        summary.removed_directories += 1;
    }

    summary.removed_files += remove_generated_artifacts(example_dir, &package_name)?;

    Ok(())
}

fn package_name_for_clean(manifest_path: &Path) -> Result<String, String> {
    let source = std::fs::read_to_string(manifest_path).map_err(|error| {
        format!(
            "could not read manifest {}: {error}",
            manifest_path.display()
        )
    })?;

    let document: toml::Value = toml::from_str(&source).map_err(|error| {
        format!(
            "could not parse manifest {}: {error}",
            manifest_path.display()
        )
    })?;

    document
        .get("package")
        .and_then(|value| value.get("name"))
        .and_then(|value| value.as_str())
        .map(str::to_owned)
        .ok_or_else(|| {
            format!(
                "manifest {} is missing package.name",
                manifest_path.display()
            )
        })
}

fn remove_local_target(project_dir: &Path) -> Result<bool, String> {
    let target_dir = project_dir.join("target");

    let metadata = match std::fs::symlink_metadata(&target_dir) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(false);
        }
        Err(error) => {
            return Err(format!(
                "could not inspect {}: {error}",
                target_dir.display()
            ));
        }
    };

    if metadata.file_type().is_symlink() {
        return Err(format!(
            "refusing to remove symlinked target directory {}",
            target_dir.display()
        ));
    }

    if !metadata.is_dir() {
        return Err(format!(
            "expected {} to be a directory",
            target_dir.display()
        ));
    }

    std::fs::remove_dir_all(&target_dir).map_err(|error| {
        format!(
            "could not remove target directory {}: {error}",
            target_dir.display()
        )
    })?;

    println!("Removed {}", target_dir.display());

    Ok(true)
}

fn remove_generated_artifacts(project_dir: &Path, package_name: &str) -> Result<usize, String> {
    let mut removed = 0;

    for path in generated_artifact_paths(project_dir, package_name) {
        let metadata = match std::fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                continue;
            }
            Err(error) => {
                return Err(format!("could not inspect {}: {error}", path.display()));
            }
        };

        if metadata.file_type().is_symlink() {
            return Err(format!(
                "refusing to remove symlinked generated artifact {}",
                path.display()
            ));
        }

        if !metadata.is_file() {
            return Err(format!(
                "expected generated artifact {} to be a file",
                path.display()
            ));
        }

        std::fs::remove_file(&path)
            .map_err(|error| format!("could not remove {}: {error}", path.display()))?;

        println!("Removed {}", path.display());
        removed += 1;
    }

    Ok(removed)
}

```

### Core Architecture Module: `crates/cargo-oxide/src/commands/codegen_env.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

use crate::backend;
use std::path::Path;
use std::process::Command;

use super::*;

pub(super) const ENCODED_RUSTFLAGS_SEPARATOR: char = '\u{1f}';

/// Internal cfg used only by full-debug builds to outline
/// `DisjointSlice::get_mut`.
///
/// This fixes false CUDA-GDB helper frames without disabling MIR inlining
/// globally. User-provided copies are stripped so other modes keep their usual
/// code shape.
pub(super) const FULL_DEBUG_GET_MUT_OUTLINE_CFG: &str =
    "cuda_oxide_internal_outline_disjoint_get_mut_v1";

/// Profile-related rustc flags owned by cuda-oxide.
///
/// Backend selection and MIR/symbol invariants are always applied separately.
/// `CargoSelected` deliberately adds no optimization, assertion, or debug-info
/// flags so Cargo's chosen profile remains authoritative.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum CodegenProfilePolicy {
    CargoSelected,
    ReleaseLike,
    ReleaseLikeWithDebugAssertions,
    ReleaseLikeWithDebugInfo,
}

impl CodegenProfilePolicy {
    pub(super) fn release_like(debug_assertions: bool) -> Self {
        if debug_assertions {
            Self::ReleaseLikeWithDebugAssertions
        } else {
            Self::ReleaseLike
        }
    }
}

/// Construct boundary-preserving rustc flags for Cargo.
///
/// `RUSTFLAGS` is whitespace-split by Cargo, which corrupts a single flag
/// containing spaces. `CARGO_ENCODED_RUSTFLAGS` uses unit separators and keeps
/// every configured array element and `--device-cfg` value intact.
fn build_encoded_rustflags(
    ctx: &Context,
    profile: CodegenProfilePolicy,
    device_cfgs: &[String],
) -> String {
    let existing_encoded = std::env::var("CARGO_ENCODED_RUSTFLAGS").ok();
    let existing = std::env::var("RUSTFLAGS").ok();
    let mut explicit_rustflags = Vec::new();
    for cfg in device_cfgs {
        explicit_rustflags.push("--cfg".to_string());
        explicit_rustflags.push(cfg.clone());
    }
    build_encoded_rustflags_with_existing(
        &ctx.backend_so,
        profile,
        &ctx.config.extra_rustflags,
        &explicit_rustflags,
        existing_encoded.as_deref(),
        existing.as_deref(),
    )
}

pub(super) fn build_encoded_rustflags_with_existing(
    backend_so: &Path,
    profile: CodegenProfilePolicy,
    configured_rustflags: &[String],
    explicit_rustflags: &[String],
    existing_encoded_rustflags: Option<&str>,
    existing_rustflags: Option<&str>,
) -> String {
    // Project flags are defaults, inherited flags are user overrides, and
    // explicit wrapper flags are stronger. cuda-oxide's compiler invariants
    // come last because rustc resolves repeated -C/-Z options last-one-wins.
    let mut flags = configured_rustflags.to_vec();

    if let Some(existing) = existing_encoded_rustflags {
        flags.extend(
            existing
                .split(ENCODED_RUSTFLAGS_SEPARATOR)
                .filter(|flag| !flag.is_empty())
                .map(str::to_string),
        );
    } else if let Some(existing) = existing_rustflags {
        // Match Cargo's legacy RUSTFLAGS behavior when converting it to the
        // encoded representation.
        flags.extend(existing.split_whitespace().map(str::to_string));
    }
    flags.extend(explicit_rustflags.iter().cloned());
    strip_wrapper_owned_codegen_cfgs(&mut flags);
    flags.push(format!("-Zcodegen-backend={}", backend_so.display()));
    if matches!(
        profile,
        CodegenProfilePolicy::ReleaseLike
            | CodegenProfilePolicy::ReleaseLikeWithDebugAssertions
            | CodegenProfilePolicy::ReleaseLikeWithDebugInfo
    ) {
        flags.push("-Copt-level=3".to_string());
        if profile == CodegenProfilePolicy::ReleaseLikeWithDebugAssertions {
            // rustc normally enables overflow checks together with debug
            // assertions. Keep them independent: overflow-check MIR changes
            // code shape enough to break pattern-sensitive device lowerings.
            flags.extend([
                "-Cdebug-assertions=on".to_string(),
                "-Coverflow-checks=off".to_string(),
            ]);
        } else {
            flags.push("-Cdebug-assertions=off".to_string());
        }
    }
    flags.extend([
        "-Zmir-enable-passes=-JumpThreading".to_string(),
        // Device codegen is whole-program: `collector` walks the call graph from
        // each `#[kernel]` and must emit every reachable dependency function into
        // one module. rustc encodes cross-crate MIR only for `#[inline]`/generic
        // items, so a non-`#[inline]`, non-generic dependency function that cannot
        // be inlined away (canonically: a recursive one) would be *called* but
        // never *defined* -> LLVM verification fails with "Symbol <crate>__<fn>
        // not found". Encode all MIR so any reachable dependency function is
        // device-compilable. This applies build-wide (like the other required
        // flags), so it also encodes MIR for host-only deps — an intentional,
        // interim trade (rmeta size) until a surgical device-dep-scoped or
        // per-crate device-link path lands. It matches the established approach
        // for whole-program-MIR tools (e.g. Miri).
        "-Zalways-encode-mir".to_string(),
        "-Csymbol-mangling-version=v0".to_string(),
    ]);
    if profile == CodegenProfilePolicy::ReleaseLikeWithDebugInfo {
        flags.push("-Cdebuginfo=2".to_string());
    }
    flags.join(&ENCODED_RUSTFLAGS_SEPARATOR.to_string())
}

fn strip_wrapper_owned_codegen_cfgs(flags: &mut Vec<String>) {
    fn is_wrapper_owned_cfg(value: &str) -> bool {
        [
            LEGACY_CODEGEN_FINGERPRINT_CFG,
            LEGACY_MATERIALIZER_PROVENANCE_CFG,
            FULL_DEBUG_GET_MUT_OUTLINE_CFG,
        ]
        .iter()
        .any(|name| {
            value
                .strip_prefix(name)
                .is_some_and(|suffix| suffix.is_empty() || suffix.starts_with('='))
        })
    }

    let mut retained = Vec::with_capacity(flags.len());
    let mut index = 0;
    while index < flags.len() {
        let flag = &flags[index];
        if flag == "--cfg"
            && flags
                .get(index + 1)
                .is_some_and(|value| is_wrapper_owned_cfg(value))
        {
            index += 2;
            continue;
        }
        if flag
            .strip_prefix("--cfg=")
            .is_some_and(is_wrapper_owned_cfg)
        {
            index += 1;
            continue;
        }
        retained.push(flag.clone());
        index += 1;
    }
    *flags = retained;
}

/// Report the debug policy `CUDA_OXIDE_DEBUG` selects in this environment,
/// as one lowercase token on stdout.
///
/// Tooling that has to know whether a build will be a full-debug build --
/// `scripts/smoketest.sh` decides that way whether its optimized code-shape
/// gates apply at all -- would otherwise restate `parse_env_override`'s
/// alias, case and whitespace rules in another language. A second
/// implementation of a policy is a second answer waiting to disagree with the
/// first, and this one is easy to get wrong: `2` is full debug, so is `FULL`,
/// and so is a value padded with a non-breaking space.
pub fn print_debug_policy() {
    println!(
        "{}",
        debug_policy_token(std::env::var("CUDA_OXIDE_DEBUG").ok().as_deref())
    );
}

/// `None` means the variable is unset, which is not the same as a value the
/// parser does not recognize: the first leaves the caller's own default in
/// place, the second is a value someone wrote expecting it to mean something.
pub(super) fn debug_policy_token(value: Option<&str>) -> &'static str {
    let Some(value) = value else {
        return "unset";
    };
    match cuda_artifact_finalizer::DebugPolicy::parse_env_override(value) {
        Some(cuda_artifact_finalizer::DebugPolicy::No
```

### Core Architecture Module: `crates/cargo-oxide/src/commands/context.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

use crate::backend;
use std::path::{Path, PathBuf};

use super::*;

/// Project-local cuda-oxide defaults loaded from `.cargo/cuda-oxide.toml`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OxideConfig {
    /// Explicit backend shared object path.
    pub backend: Option<PathBuf>,
    /// Default CUDA architecture for codegen commands.
    pub default_arch: Option<String>,
    /// Additional rustflags appended after cuda-oxide's required flags.
    pub extra_rustflags: Vec<String>,
    /// Environment variables applied to child Cargo invocations.
    pub env: Vec<(String, String)>,
}

/// Pre-resolved context shared across all commands.
///
/// Built once at startup by [`resolve_context`] and passed by reference to
/// every command handler. Avoids repeated filesystem walks and backend builds.
pub struct Context {
    /// Absolute path to the workspace root (contains top-level `Cargo.toml`).
    pub workspace_root: PathBuf,
    /// Path to `crates/rustc-codegen-cuda` (backend source tree).
    pub codegen_crate: PathBuf,
    /// Path to `crates/rustc-codegen-cuda/examples/`.
    pub examples_dir: PathBuf,
    /// Path to the built `librustc_codegen_cuda.so` shared object.
    pub backend_so: PathBuf,
    /// True when running from inside the cuda-oxide workspace; false for
    /// standalone projects scaffolded by `cargo oxide new`.
    pub is_workspace: bool,
    /// Project-local cuda-oxide defaults.
    pub config: OxideConfig,
}

/// Resolve the workspace root and backend, or exit with a helpful error.
///
/// Supports two modes:
/// - **Workspace mode**: CWD is inside the cuda-oxide repo (detected by
///   `crates/rustc-codegen-cuda` directory). Examples are resolved from the
///   workspace examples directory.
/// - **Standalone mode**: CWD has a `Cargo.toml` but is not inside the
///   workspace. The backend is built from the commit the project's cuda-oxide
///   dependency resolves to, or taken from the shared cache when that already
///   holds it (see `backend::standalone_backend`). Commands like `run`
///   operate on the current directory directly.
pub fn resolve_context() -> Context {
    if let Some(workspace_root) = backend::find_workspace_root() {
        let codegen_crate = workspace_root.join("crates/rustc-codegen-cuda");
        let examples_dir = codegen_crate.join("examples");
        let config = load_oxide_config(&workspace_root);
        let backend_so = backend::find_or_build_backend(&workspace_root, config.backend.as_deref());
        return Context {
            workspace_root,
            codegen_crate,
            examples_dir,
            backend_so,
            is_workspace: true,
            config,
        };
    }

    let cwd = std::env::current_dir().unwrap_or_else(|e| {
        eprintln!("Error: cannot determine current directory: {}", e);
        std::process::exit(1);
    });

    if cwd.join("Cargo.toml").is_file() {
        let config = load_oxide_config(&cwd);
        let backend_so = backend::find_or_build_backend(&cwd, config.backend.as_deref());
        return Context {
            workspace_root: cwd.clone(),
            codegen_crate: cwd.clone(),
            examples_dir: cwd.clone(),
            backend_so,
            is_workspace: false,
            config,
        };
    }

    eprintln!("Error: Could not find cuda-oxide workspace or a standalone Cargo.toml.");
    eprintln!();
    eprintln!("Run from inside the cuda-oxide repository, or from a project created");
    eprintln!("with `cargo oxide new <name>`.");
    std::process::exit(1);
}

/// Resolve a context for commands that must not build or fetch the backend.
///
/// Identical discovery to [`resolve_context`], except the backend `.so` is
/// only located via [`backend::backend_so_candidate`], never built and never
/// cloned, and an invalid `.cargo/cuda-oxide.toml` degrades to defaults with
/// a warning instead of exiting (so `doctor` can report it as a failed
/// check). Passive commands such as `doctor`, `clean`, `list` and `fmt` must
/// remain usable without triggering backend setup or network access.
/// `run`/`build`/`pipeline`/`setup` still build the backend on demand.
pub fn resolve_passive_context() -> Context {
    if let Some(workspace_root) = backend::find_workspace_root() {
        let codegen_crate = workspace_root.join("crates/rustc-codegen-cuda");
        let examples_dir = codegen_crate.join("examples");
        let config = load_oxide_config_lenient(&workspace_root);
        let backend_so = backend::backend_so_candidate(&workspace_root, config.backend.as_deref());
        return Context {
            workspace_root,
            codegen_crate,
            examples_dir,
            backend_so,
            is_workspace: true,
            config,
        };
    }

    let cwd = std::env::current_dir().unwrap_or_else(|e| {
        eprintln!("Error: cannot determine current directory: {}", e);
        std::process::exit(1);
    });

    if cwd.join("Cargo.toml").is_file() {
        let config = load_oxide_config_lenient(&cwd);
        let backend_so = backend::backend_so_candidate(&cwd, config.backend.as_deref());
        return Context {
            workspace_root: cwd.clone(),
            codegen_crate: cwd.clone(),
            examples_dir: cwd.clone(),
            backend_so,
            is_workspace: false,
            config,
        };
    }

    eprintln!("Error: Could not find cuda-oxide workspace or a standalone Cargo.toml.");
    eprintln!();
    eprintln!("Run from inside the cuda-oxide repository, or from a project created");
    eprintln!("with `cargo oxide new <name>`.");
    std::process::exit(1);
}

// =============================================================================
// Helpers
// =============================================================================

/// Load `.cargo/cuda-oxide.toml`, exiting on an invalid config.
///
/// Build commands ([`resolve_context`]) stay strict: they must not run with
/// a config the user wrote but cargo-oxide cannot honor.
pub(super) fn load_oxide_config(workspace_root: &Path) -> OxideConfig {
    match inspect_oxide_config(workspace_root) {
        OxideConfigInspection::Missing => OxideConfig::default(),
        OxideConfigInspection::Valid { config, warnings } => {
            for warning in warnings {
                eprintln!("Warning: {warning}");
            }
            config
        }
        OxideConfigInspection::Invalid { errors, warnings } => {
            for warning in warnings {
                eprintln!("Warning: {warning}");
            }
            for error in errors {
                eprintln!("Error: {error}");
            }
            std::process::exit(1);
        }
    }
}

/// Load `.cargo/cuda-oxide.toml`, falling back to defaults on an invalid
/// config instead of exiting.
///
/// Passive commands ([`resolve_passive_context`]: `doctor`, `clean`, ...)
/// must stay usable with a broken config. `doctor` in particular re-inspects
/// the file and reports the failure as a regular failed check, which it can
/// only do if context resolution survives long enough for the scan to start.
pub(super) fn load_oxide_config_lenient(workspace_root: &Path) -> OxideConfig {
    match inspect_oxide_config(workspace_root) {
        OxideConfigInspection::Missing => OxideConfig::default(),
        OxideConfigInspection::Valid { config, warnings } => {
            for warning in warnings {
                eprintln!("Warning: {warning}");
            }
            config
        }
        OxideConfigInspection::Invalid { errors, warnings } => {
            for warning in warnings {
                eprintln!("Warning: {warning}");
            }
            for error in errors {
                eprintln!("Warning: {error}");
            }
            eprintln!("Warning: ignoring invalid cuda-oxid
```

### Core Architecture Module: `crates/cargo-oxide/src/commands/doctor.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

use crate::backend;
use crate::backend_source::{self, DependencySource, short_rev};
use std::path::{Path, PathBuf};
use std::process::Command;

use super::*;

// =============================================================================
// Doctor command
// =============================================================================

/// Find the first compiler that can report a non-empty resource directory.
/// Probe the required operation directly: `--version` alone does not establish
/// that a wrapper or incomplete installation can answer this query.
pub(super) fn clang_resource_dir<'a>(candidates: &[&'a str]) -> Option<(&'a str, String)> {
    candidates.iter().find_map(|&name| {
        let output = Command::new(name)
            .arg("-print-resource-dir")
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let dir = String::from_utf8_lossy(&output.stdout).trim().to_string();
        (!dir.is_empty()).then_some((name, dir))
    })
}

/// Parsed contents of a `rust-toolchain.toml` pin.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RustToolchainPin {
    pub(crate) channel: String,
    pub(crate) components: Vec<String>,
}

/// Components that doctor treats as hard requirements for the cuda-oxide
/// pipeline even if `rust-toolchain.toml` stops listing them: `rust-src`
/// (device-side core sources), `rustc-dev` (rustc_private, required to build
/// the codegen backend), and `llvm-tools`.
const DOCTOR_REQUIRED_COMPONENTS: &[&str] = &["rust-src", "rustc-dev", "llvm-tools"];

/// The components doctor verifies for a pin: everything the pin itself lists,
/// plus the [`DOCTOR_REQUIRED_COMPONENTS`] floor.
///
/// rustup auto-installs every component named in `rust-toolchain.toml` when it
/// installs the pinned toolchain, so a pinned component that is absent from
/// `rustup component list --installed` means a broken or manually trimmed
/// install and is worth failing doctor over. The floor guards against a future
/// edit of the pin file dropping a component the pipeline genuinely needs.
pub(super) fn doctor_verified_components(pin: &RustToolchainPin) -> Vec<String> {
    let mut required: Vec<String> = pin.components.clone();
    for component in DOCTOR_REQUIRED_COMPONENTS {
        if !required.iter().any(|existing| existing == component) {
            required.push((*component).to_string());
        }
    }
    required
}

/// Parse a `rust-toolchain.toml` document for channel and components.
pub(crate) fn parse_rust_toolchain_toml(contents: &str) -> Result<RustToolchainPin, String> {
    let value: toml::Value =
        toml::from_str(contents).map_err(|error| format!("invalid TOML: {error}"))?;
    let toolchain = value
        .get("toolchain")
        .ok_or_else(|| "missing [toolchain] table".to_string())?;
    let channel = toolchain
        .get("channel")
        .and_then(toml::Value::as_str)
        .map(str::trim)
        .filter(|channel| !channel.is_empty())
        .ok_or_else(|| "missing toolchain.channel".to_string())?
        .to_string();
    let components = match toolchain.get("components") {
        None => Vec::new(),
        Some(toml::Value::Array(items)) => items
            .iter()
            .map(|item| {
                item.as_str()
                    .map(|name| name.trim().to_string())
                    .filter(|name| !name.is_empty())
                    .ok_or_else(|| {
                        "toolchain.components entries must be non-empty strings".to_string()
                    })
            })
            .collect::<Result<Vec<_>, _>>()?,
        Some(_) => {
            return Err("toolchain.components must be an array of strings".to_string());
        }
    };
    Ok(RustToolchainPin {
        channel,
        components,
    })
}

/// True when `rustup show active-toolchain` output matches the pinned channel.
///
/// The toolchain name is the first whitespace-delimited token of the first
/// line in every rustup output format seen so far:
///
/// - pre-1.28 and 1.29+: `nightly-2026-08-28-<triple> (default)` or
///   `nightly-2026-08-28-<triple> (overridden by '<path>')` on one line
///   (verified against rustup 1.29.0);
/// - 1.28.x: the bare name on the first line with the reason on a second
///   `active because: ...` line.
pub(crate) fn active_toolchain_matches_channel(active_toolchain: &str, channel: &str) -> bool {
    let active = active_toolchain
        .lines()
        .next()
        .unwrap_or("")
        .split_whitespace()
        .next()
        .unwrap_or("");
    if active.is_empty() || channel.is_empty() {
        return false;
    }
    active == channel || active.starts_with(&format!("{channel}-"))
}

/// Return required components that are absent from `rustup component list --installed`.
pub(super) fn missing_rustup_components<S: AsRef<str>>(
    installed_list: &str,
    required: &[S],
) -> Vec<String> {
    required
        .iter()
        .map(AsRef::as_ref)
        .filter(|component| !rustup_component_installed(installed_list, component))
        .map(str::to_string)
        .collect()
}

fn rustup_component_installed(installed_list: &str, component: &str) -> bool {
    installed_list.lines().any(|line| {
        let name = line.split_whitespace().next().unwrap_or("");
        name == component || name.starts_with(&format!("{component}-"))
    })
}

fn doctor_report_toolchain_pin(ctx: &Context, ok: &mut bool) {
    let toolchain_file = ctx.workspace_root.join("rust-toolchain.toml");
    print!("rust-toolchain.toml... ");
    if !toolchain_file.exists() {
        println!("✗ not found at {}", toolchain_file.display());
        *ok = false;
        return;
    }

    let contents = match std::fs::read_to_string(&toolchain_file) {
        Ok(contents) => contents,
        Err(error) => {
            println!("✗ present but unreadable ({error})");
            *ok = false;
            return;
        }
    };

    let pin = match parse_rust_toolchain_toml(&contents) {
        Ok(pin) => pin,
        Err(error) => {
            println!("✗ present but invalid ({error})");
            *ok = false;
            return;
        }
    };
    println!("✓ channel {}", pin.channel);

    print!("Pinned toolchain active... ");
    match Command::new("rustup")
        .args(["show", "active-toolchain"])
        .output()
    {
        Ok(output) if output.status.success() => {
            let active = String::from_utf8_lossy(&output.stdout);
            let active = active.trim();
            if active_toolchain_matches_channel(active, &pin.channel) {
                println!("✓ {active}");
            } else {
                println!(
                    "✗ active `{active}`, expected `{pin_channel}`",
                    pin_channel = pin.channel
                );
                eprintln!(
                    "  Install/select the pin with `rustup toolchain install {}` and reopen the shell",
                    pin.channel
                );
                eprintln!("  in this workspace so rust-toolchain.toml can select it.");
                *ok = false;
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            println!("✗ rustup show active-toolchain failed");
            if !stderr.trim().is_empty() {
                eprintln!("  {}", stderr.trim());
            }
            *ok = false;
        }
        Err(_) => {
            println!("✗ rustup not found");
            eprintln!("  Install rustup from https://rustup.rs/ so doctor can verify the pin.");
            *ok = false;
        }
    }

    let required = doctor_verified_components(&pin);

    print!("Required rustup components... ");
    match Command::new("rustup")
        .args([
            "component",
            "li
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1327** (2026-09-24): **fix(mir-lower): support packed AS3 carrier local projections**
  *Symptoms*: ## What this adds  Packed structs with one direct shared-memory pointer can now use compiler-owned local storage and one direct field projection.  ```text MIR value:     <{ u8, p3 }> local storage: <{ u8, p0 }> store: p3 -> p0    load: p0 -> p3 ```  The complete address-use graph must validate before lowering attaches its private type facts. Whole-value loads/stores, direct field projections and debug uses are supported. Escaping addresses, nested projections and unknown uses fail before conversion. This avoids the operation-history inference used by #1092.  ## Coverage  The GPU example writes through the projected shared pointer and observes the result independently through the original pointer. Maintainer regressions check whole-value conversion directions, preexisting private facts, address escape and nested projections.  Verified at `e92236ef`:  - 450 mir-lower unit/lowering tests, strict Clippy and formatting passed. - B200: `packed_aggregate_abi` passed LLVM NVPTX/SM100a execution, memcheck and synccheck. - A separate narrow mutable-local probe passed LLVM NVPTX and modern libNVVM with full device debug, retaining the local slot. Both passed memcheck; LLVM also passed synccheck. - The narrow probe also passed normal modern libNVVM/SM100a and legacy libNVVM/SM90 builds under memcheck. All sanitizer runs reported 0 errors.  At `e92236ef`, hosted tests, lint/format checks, guards, docs/book and example compilation passed. CodeQL was still running at the final review check.

- **Issue #1326** (2026-09-24): **fix(cuda-host): handle Btrfs mapped file identities**
  *Symptoms*: ## What this fixes  CUDA module loading can reject a valid loaded image on Btrfs because `stat` and procfs report different device identities. Compare both the loaded image and opened file through procfs before reading artifact bytes.  ## Details  - Preserve device and inode checks using a temporary, non-readable mapping of the opened file. - Compare native `map_files` paths to distinguish equal inode numbers in different subvolumes. - Keep artifact reads on the verified file descriptor and reject replaced or deleted images.  ## Verification  All seven hosted validation workflows passed at `c08a986f`, including example compilation and CodeQL.  - 110 cuda-host tests/doctests passed, including renamed/replaced libraries and simulated inode collisions. - Strict Clippy and formatting passed. - Local validation used ext4; direct Btrfs validation remains untested here.  Fixes #1325. 

- **Issue #1322** (2026-09-24): **fix(cuda-host): renumber debug file indices when merging PTX bundles**
  *Symptoms*: ## What this fixes  Merging debug or lineinfo PTX bundles repeats module-local `.file` indices and causes ptxas to reject the output. Each appended bundle now continues after the highest index already used.  ```text before: .file 1 + .file 1 -> duplicate index  after: .file 1 + .file 2 -> distinct indices ```  ## Details  - Shift `.file`, `.loc` and `inlined_at` indices together while removing repeated module headers. - Preserve the first bundle's indices and leave bundles without debug information unchanged. - Parse complete tokens so comments, paths and labels remain intact; reject malformed indices and arithmetic overflow.  ## Verification  At `a50ccff5`, hosted tests, lint/format checks, guards, docs/book and example compilation passed. CodeQL was still running at the final review check.  - 112 cuda-host tests/doctests passed, including three-bundle, comment, malformed-index and overflow regressions. - Strict Clippy and formatting passed. - CUDA 13.4 ptxas assembled debug bundles merged through the public API in both orders for sm_100.  Fixes #1292. 

- **Issue #1314** (2026-09-23): **fix(dialect-mir): fold shifts whose amount has a different width**
  *Symptoms*: ## What this fixes  Constant folding now accepts shifts whose count has a different integer width from the shifted value. This fixes a compiler crash in ordinary Rust code such as `u32 << usize` after loop unrolling.  ```rust let mut bits = 0u32; let mut i = 0usize; #[unroll] while i < 4 {     bits |= 1u32 << (2 * i);     i += 1; } ```  ```text before: compiler panic — APInt::shl bitwidth mismatch (32 vs 64) after:  compilation succeeds; bits == 85 ```  The folder checks the complete count before converting it to the value's width. Large counts therefore cannot lose their high bits and accidentally become valid shifts. Right-shift signedness and result types still come from the shifted value.  ## What we added  - Kept @midagedev's implementation and original regression cases. - Added exact result-type checks, correctly typed test operands, and coverage for 128-bit values, negative counts and counts with bits above 64. - Added a regression to `unroll_smoke` covering wider and narrower counts, left shifts, and arithmetic/logical right shifts. - Rebased onto current main and signed both commits, preserving contributor authorship and DCO credit.  ## Verification  Checked at `b024b5fd`:  - `just check`: 5,426 tests/doctests pass, along with formatting, strict Clippy, guards, generated-intrinsic checks and warning-denied docs. Strict Clippy also passes for the changed example. - Independent review: 378,720 value/type checks, 40,590 invalid-count checks and 900 nonconstant controls 

- **Issue #1313** (2026-09-23): **fix(cuda-device): normalize cooperative group match masks**
  *Symptoms*: ## What this fixes  Typed cooperative-group match operations now return bits in group-rank order, matching typed ballot masks.  ```text second WarpTile<16>, four equal values: 0x000f0000 -> 0x0000000f sparse lanes {0,3,7,20,31}, all equal:   0x80100089 -> 0x0000001f ```  ## What we fixed  - Shift contiguous tile masks by the tile base; preserve the full-warp fast path. - Reuse the existing sparse-lane packing helper for coalesced groups. - Apply the correction to both 32-bit and 64-bit match-any/match-all operations. - Strengthen 64-bit regressions with differences only above bit 32, so accidentally comparing only the low word fails.  ## Migration  Interpret typed masks using `thread_rank()`. Call raw `warp::match_*_sync` when physical lane bits are needed. The repository's existing hash-map consumer uses `WarpTile<32>` and remains unchanged.  ## Verification  Checked at `5cef57a7` against main `66ff93c1`:  - Device tests/doctests, strict device Clippy, formatting, and warnings-denied device rustdoc pass. - Full-warp, both half-warp tiles, even sparse groups, and irregular sparse groups pass on RTX 5090, including positive/negative match-all and high-word-only 64-bit inputs. - The same tests fail with the original implementation. Synccheck reports zero errors. - Independent review found no remaining mask-contract counterexample. All seven hosted workflows pass on this exact head.  Closes #1312. Sub-warp and sparse typed match masks change their documented meaning; raw warp op

- **Issue #1312** (2026-09-23): **cooperative_groups: typed match masks use absolute warp-lane positions**
  *Symptoms*: **Description**   `WarpCollective::match_any` / `match_all` return masks in absolute physical warp-lane positions for sub-warp `WarpTile<N>` groups instead of the group-relative rank space used by the rest of the typed cooperative-groups API. For example, the second `WarpTile<16>` in a warp returns bits 16..31 even though its ranks are 0..15. The same issue also affects sparse `CoalescedThreads` groups, where raw physical lane masks are returned instead of packed group-relative masks.  **Minimal reproducer**   Paste the smallest kernel + host code that triggers the issue.  ```rust use cuda_core::simt::LaunchConfig; use cuda_core::{CudaContext, DeviceBuffer}; use cuda_device::cooperative_groups::{     ThreadGroup, WarpCollective, this_thread_block, }; use cuda_device::{DisjointSlice, kernel, warp}; use cuda_host::cuda_module;  #[cuda_module] mod kernels {     use super::*;      #[kernel]     pub fn match_mask_repro(mut out: DisjointSlice<u32>) {         let lane = warp::lane_id();          let block = this_thread_block();         let tile = block.tiled_partition::<16>();         let rank = tile.thread_rank();          let any = tile.match_any(rank / 4);         let all = tile.match_all(42);          if lane == 0 || lane == 16 {             let base = if lane == 0 { 0 } else { 2 };              unsafe {                 *out.get_unchecked_mut(base) = any;                 *out.get_unchecked_mut(base + 1) = all;             }         }     } }  fn main() {     let ctx = CudaContex

- **Issue #1311** (2026-09-23): **fix(cuda-device): handle partial warps in block collectives**
  *Symptoms*: ## What this fixes  Block reductions and scans now handle a partial final warp without reading nonexistent lanes or unused scratch slots.  ```text 48-thread block: full warp + 16 live lanes -> block sum 48 scratch capacity 32, live warp count 2     -> only two totals are read ```  ## What we fixed  - Kept the full-warp shuffle path and used a live contiguous-prefix mask for the tail. Single-warp blocks avoid a second full-warp collective. - Checked `ceil(block_threads / 32) <= NUM_WARPS` before scratch access. Extra capacity is allowed. - Changed the scratch accesses to raw element reads/writes, avoiding an overlapping mutable borrow of the complete allocation in every thread. - Made `block_reduce` and `block_scan` unsafe and updated all repository callers. An arbitrary raw pointer cannot prove that shared scratch is valid or exclusively assigned to the collective. - Added 77 launch shapes, including every size 1..65, full-warp controls, 1024 threads, multidimensional blocks, two CTAs, and scratch reuse.  ## Call contract  Every thread in the block must call with the same live shared allocation and reach every collective/barrier. Other operations must not access that scratch while the collective runs. Place a block barrier before reusing it.  ## Verification  Checked at `cba13824` against main `66ff93c1`:  - Device tests/doctests, strict device/example Clippy, formatting, and warnings-denied device rustdoc pass. - The 77-shape regression and all existing cooperative-groups ch

- **Issue #1310** (2026-09-23): **cooperative_groups: block_reduce/block_scan mishandle partial final warps**
  *Symptoms*: ## Summary  `block_reduce` and `block_scan` in `cuda_device::cooperative_groups` do not correctly handle thread blocks whose size is not a multiple of the physical warp size.  For example, a 48-thread block contains one full 32-lane warp and one 16-lane final warp. The current implementation partitions the block into `WarpTile<32>` groups and uses the regular full-warp reduction/scan path for every warp. As a result, the final partial warp can execute shuffle collectives with a full `0xffffffff` member mask even though only the low 16 lanes participate.  This violates the shuffle participation contract and can produce incorrect results depending on the GPU / generated code.  There is also a related shared-memory sizing issue: the runtime number of warps is `ceil(block_threads / 32)`, so scratch storage must have capacity for that many warp totals before any `SharedArray` indexing occurs.  ## Reproduction  A minimal reduction kernel is:  ```rust #[kernel] pub fn repro(mut out: DisjointSlice<u32>) {     static mut SMEM: SharedArray<u32, 2> = SharedArray::UNINIT;      let gid = thread::index_1d();     let block = this_thread_block();      let total = block_reduce::<u32, Sum, 2>(&block, 1u32, &raw mut SMEM);      if gid.in_bounds(out.len()) {         unsafe {             *out.get_unchecked_mut(gid.get()) = total;         }     } } ```  Launch it with:  ```text block_dim = (48, 1, 1) grid_dim  = (1, 1, 1) ```  Every thread should receive `48`.  On an RTX 3050 Ti (`sm_86`), I obser

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

### Incident Patch 1: `ec4aa479` (2026-09-24)
**Commit Message**: Merge pull request #1327 from uurl/fix/packed-as3-local-storage-contract

fix(mir-lower): support packed AS3 carrier local projections

**File**: `crates/mir-lower/src/convert/ops/aggregate/carrier_field_addr.rs` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+/*
+ * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+//! Direct field-address lowering for verified packed-AS3 carrier locals.
+
+use super::addressing;
+use super::common::anyhow_to_pliron;
+use crate::convert::types::{StructLayoutInfo, build_struct_slot_map};
+use crate::packed_shared_local_storage::carrier_gep_source_type;
+use dialect_mir::ops::MirFieldAddrOp;
+use dialect_mir::types::MirStructType;
+use llvm_export::ops as llvm;
+use llvm_export::types::{StructLayout, StructType};
+use pliron::builtin::types::{IntegerType, Signedness};
+use pliron::context::{Context, Ptr};
+use pliron::irbuild::dialect_conversion::{DialectConversionRewriter, OperandsInfo};
+use pliron::irbuild::inserter::Inserter;
+use pliron::irbuild::rewriter::Rewriter;
+use pliron::op::Op;
+use pliron::operation::Operation;
+use pliron::result::Result;
+use pliron::r#type::{TypeHandle, Typed};
+
+/// Lower a field address, using the physical carrier struct only when the
+/// pre-lowering carrier proof stamped this exact projection.
+///
+/// Ordinary field projections stay on the established #859 path. Carrier
+/// projections never reconstruct provenance from operand history: the physical
+/// GEP source type is an LLVM `TypeAttr` placed directly on this MIR operation
+/// by the closed-world preparation pass.
+pub(crate) fn convert_field_addr(
+    ctx: &mut Context,
+    rewriter: &mut DialectConversionRewriter,
+    op: Ptr<Operation>,
+    operands_info: &OperandsInfo,
+) -> Result<()> {
+    let Some(carrier_source_ty) = carrier_gep_source_type(ctx, op) else {
+        return addressing::convert_field_addr(ctx, rewriter, op, operands_info);
+    };
+
+    let field_addr = MirFieldAddrOp::new(op);
+    let field_index = field_addr
+        .get_attr_field_index(ctx)
+        .ok_or_else(|| pliron::input_error_noloc!("MirFieldAddrOp missing field_index attribute"))?
+        .0 as usize;
+    let semantic_aggregate = field_addr
+        .get_attr_aggregate_ty(ctx)
+        .ok_or_else(|| {
+            pliron::input_error_noloc!("MirFieldAddrOp missing verified aggregate_ty attribute")
+        })?
+        .get_type(ctx);
+
+    let (layout, aggregate_abi_align) = {
+        let aggregate_ref = semantic_aggregate.deref(ctx);
+        let Some(struct_ty) = aggregate_ref.downcast_ref::<MirStructType>() else {
+            return pliron::input_err_noloc!(
+                "packed-AS3 carrier field projection requires a struct root"
+            );
+        };
+        (StructLayoutInfo::of_struct(struct_ty), struct_ty.abi_align)
+    };
+    let map = build_struct_slot_map(ctx, &layout).map_err(anyhow_to_pliron)?;
+
+    let carrier_is_packed = {
+        let carrier_ref = carrier_source_ty.deref(ctx);
+        carrier_ref
+            .downcast_ref::<StructType>()
+            .is_some_and(|ty| ty.layout() == StructLayout::Packed)
+    };
+    if !carrier_is_packed {
+        return pliron::input_err_noloc!(
+            "packed-AS3 carrier field projection was stamped with a non-packed physical source type"
+        );
+    }
+
+    let slot = match map.decl_to_llvm.get(field_index) {
+        Some(Some(slot)) => *slot,
+        Some(None) => {
+            // Match the ordinary field-address contract for stripped ZSTs: a
+            // distinct zero-offset byte GEP keeps value identity unambiguous.
+            use llvm_export::ops::GepIndex;
+            let ptr = op.deref(ctx).get_operand(0);
+            let i8_ty: TypeHandle = IntegerType::get(ctx, 8, Signedness::Signless).into();
+            let gep = llvm::GetElementPtrOp::new(ctx, ptr, vec![GepIndex::Constant(0)], i8_ty);
+            rewriter.insert_operation(ctx, gep.get_operation());
+            rewriter.replace_operation(ctx, op, gep.get_operation());
+            return Ok(());
+        }
+        None => {
+            return pliron::input_err_noloc!(
+             
```

**File**: `crates/mir-lower/src/convert/ops/aggregate/mod.rs` (modified, +3/-1)
```diff
@@ -38,6 +38,7 @@
 
 mod addressing;
 mod array_extract;
+mod carrier_field_addr;
 mod common;
 mod construct;
 mod enum_layout;
@@ -46,8 +47,9 @@ mod fields;
 #[cfg(test)]
 mod test_support;
 
-pub(crate) use addressing::{convert_array_element_addr, convert_field_addr};
+pub(crate) use addressing::convert_array_element_addr;
 pub(crate) use array_extract::convert_extract_array_element;
+pub(crate) use carrier_field_addr::convert_field_addr;
 pub(crate) use construct::{
     convert_construct_array, convert_construct_disjoint_slice, convert_construct_slice,
     convert_construct_struct, convert_construct_tuple,
```

**File**: `crates/mir-lower/src/convert/ops/memory/access.rs` (modified, +55/-18)
```diff
@@ -10,7 +10,9 @@ use super::common::{
     pointer_proved_alignment, value_abi_align, value_mir_type,
 };
 use super::debug::copy_debug_local_variable;
+use crate::convert::target_stable_storage::coerce_target_stable_value;
 use crate::convert::types::{convert_type, mir_type_abi_align};
+use crate::packed_shared_local_storage::carrier_storage_type;
 use dialect_mir::types::MirPtrType;
 use llvm_export::attributes::GepNoWrapFlags;
 use llvm_export::op_interfaces::VolatilityOpInterface;
@@ -45,16 +47,31 @@ pub(crate) fn convert_store(
         }
     };
 
-    // Packed whole-value stores are byte-faithful now that divergent rustc
-    // layouts lower to LLVM packed structs. Keep the target-dependent AS3 case
-    // fail-closed because its physical pointer width is selected only later.
-    fail_on_target_dependent_packed_aggregate(
-        ctx,
-        value_mir_type(ctx, operands_info, val),
-        "storing",
-    )?;
+    let stored_val = if let Some(storage_ty) = carrier_storage_type(ctx, op) {
+        // Carrier identity was proven on MIR before conversion. Convert exactly
+        // at the memory boundary; never rediscover storage provenance from the
+        // converted pointer or its defining operation.
+        coerce_target_stable_value(
+            ctx,
+            rewriter,
+            val,
+            storage_ty,
+            "packed shared carrier-local store",
+        )?
+    } else {
+        // Packed whole-value stores are byte-faithful now that divergent rustc
+        // layouts lower to LLVM packed structs. Keep the target-dependent AS3
+        // case fail-closed for arbitrary memory; only pre-proven carrier-local
+        // accesses are exempt.
+        fail_on_target_dependent_packed_aggregate(
+            ctx,
+            value_mir_type(ctx, operands_info, val),
+            "storing",
+        )?;
+        val
+    };
 
-    let llvm_store = llvm::StoreOp::new(ctx, val, ptr);
+    let llvm_store = llvm::StoreOp::new(ctx, stored_val, ptr);
     if dialect_mir::ops::MirStoreOp::new(op).is_volatile(ctx) {
         llvm_store.set_volatile(ctx, true);
     }
@@ -94,15 +111,19 @@ pub(crate) fn convert_load(
 ) -> Result<()> {
     let ptr = op.deref(ctx).get_operand(0);
     let result_ty = op.deref(ctx).get_result(0).get_type(ctx);
+    let semantic_llvm_ty = convert_type(ctx, result_ty).map_err(anyhow_to_pliron)?;
 
-    // Packed whole-value loads are byte-faithful now that divergent rustc
-    // layouts lower to LLVM packed structs. Keep only the target-dependent AS3
-    // physical-image case fail-closed.
-    fail_on_target_dependent_packed_aggregate(ctx, result_ty, "loading")?;
-
-    let llvm_ty = convert_type(ctx, result_ty).map_err(anyhow_to_pliron)?;
+    let storage_ty = if let Some(storage_ty) = carrier_storage_type(ctx, op) {
+        storage_ty
+    } else {
+        // Packed whole-value loads are byte-faithful now that divergent rustc
+        // layouts lower to LLVM packed structs. Keep only the target-dependent
+        // AS3 physical-image case fail-closed for arbitrary memory.
+        fail_on_target_dependent_packed_aggregate(ctx, result_ty, "loading")?;
+        semantic_llvm_ty
+    };
 
-    let llvm_load = llvm::LoadOp::new(ctx, ptr, llvm_ty);
+    let llvm_load = llvm::LoadOp::new(ctx, ptr, storage_ty);
     if dialect_mir::ops::MirLoadOp::new(op).is_volatile(ctx) {
         llvm_load.set_volatile(ctx, true);
     }
@@ -125,7 +146,20 @@ pub(crate) fn convert_load(
         llvm_export::ops::set_op_alignment(ctx, llvm_load.get_operation(), align as u32);
     }
     rewriter.insert_operation(ctx, llvm_load.get_operation());
-    rewriter.replace_operation(ctx, op, llvm_load.get_operation());
+
+    if storage_ty == semantic_llvm_ty {
+        rewriter.replace_operation(ctx, op, llvm_load.get_operation());
+    } else {
+        let physical_value = llvm_load.get_operation().deref(ctx).get_result(0);
+        let semantic_value = coerce_target_stable_value(
+   
```

**File**: `crates/mir-lower/src/lib.rs` (modified, +6/-0)
```diff
@@ -128,6 +128,7 @@ pub mod conversion_interface;
 pub mod convert;
 pub mod helpers;
 pub mod lowering;
+mod packed_shared_local_storage;
 pub mod scalarize_block_args;
 pub mod type_conversion_interface;
 mod wgmma_deferred_accumulator;
@@ -409,6 +410,11 @@ pub fn lower_mir_to_llvm_with_options(
     // every kernel-to-helper requirement while the complete MIR call graph is
     // still available; function conversion removes that graph incrementally.
     lowering::propagate_kernel_dynamic_shared_alignments(ctx, module_op);
+    // Prove the complete address-use path for every narrow packed-AS3 carrier
+    // local immediately before conversion. The resulting per-op TypeAttrs are
+    // lowering capabilities, not inferred provenance: calls, block arguments,
+    // casts, nested projections, returns, and unknown uses fail closed here.
+    packed_shared_local_storage::prepare_packed_shared_local_storage(ctx, module_op)?;
     let mut conversion = MirToLlvmConversionDriver {
         shared_globals: FxHashMap::default(),
         device_globals: FxHashMap::default(),
```

**File**: `crates/mir-lower/src/packed_shared_local_storage.rs` (added, +829/-0)
```diff
@@ -0,0 +1,829 @@
+/*
+ * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+//! Verified lowering facts for the narrow packed-AS3 local-storage lane.
+//!
+//! The physical carrier representation is a storage property, not Rust pointer
+//! provenance. This module therefore does not extend `MirPointerKind`. Instead,
+//! immediately before dialect conversion it performs a closed-world walk over
+//! MIR, proves every use of an eligible compiler-owned local address, and only
+//! after the complete proof succeeds stamps the exact physical LLVM type on the
+//! MIR operations that consume the address.
+//!
+//! No lowering converter reconstructs carrier identity from `OperandsInfo` or
+//! from an LLVM defining-op chain. If a carrier address crosses a call, cast,
+//! block-argument edge, return, pointer offset, nested projection, or any other
+//! unmodelled operation, preparation fails before any MIR operation is lowered.
+
+use crate::convert::target_stable_storage::{StorageRewriteOptions, target_stable_storage_type};
+use crate::convert::types::{
+    PackedSharedInternalAbiInfo, StructLayoutInfo, build_struct_slot_map, convert_type,
+    is_zero_sized_type, packed_shared_internal_abi_info,
+};
+use dialect_mir::ops::{
+    MirAllocaOp, MirArrayElementAddrOp, MirAssertOp, MirCallOp, MirCastOp, MirCondBranchOp,
+    MirDbgValueListOp, MirDbgValueOp, MirFieldAddrOp, MirGotoOp, MirLoadOp, MirPtrOffsetOp,
+    MirReturnOp, MirStoreOp,
+};
+use dialect_mir::types::{MirPtrType, MirStructType};
+use llvm_export::types as llvm_types;
+use pliron::builtin::attributes::TypeAttr;
+use pliron::builtin::types::{FP32Type, FP64Type, IntegerType};
+use pliron::context::{Context, Ptr};
+use pliron::identifier::Identifier;
+use pliron::linked_list::ContainsLinkedList;
+use pliron::operation::Operation;
+use pliron::result::Result;
+use pliron::r#type::{TypeHandle, Typed};
+use pliron::value::Value;
+use rustc_hash::FxHashMap;
+
+const CARRIER_STORAGE_TYPE_KEY: &str = "cuda_oxide_packed_shared_carrier_storage_type";
+const CARRIER_GEP_SOURCE_TYPE_KEY: &str = "cuda_oxide_packed_shared_carrier_gep_source_type";
+
+#[derive(Clone, Copy, Debug)]
+struct CarrierAddress {
+    physical_pointee: TypeHandle,
+    projection_depth: u8,
+}
+
+#[derive(Default)]
+struct CarrierFactPlan {
+    storage_types: Vec<(Ptr<Operation>, TypeHandle)>,
+    gep_source_types: Vec<(Ptr<Operation>, TypeHandle)>,
+}
+
+impl CarrierFactPlan {
+    fn plan_storage_type(&mut self, operation: Ptr<Operation>, ty: TypeHandle) {
+        self.storage_types.push((operation, ty));
+    }
+
+    fn plan_gep_source_type(&mut self, operation: Ptr<Operation>, ty: TypeHandle) {
+        self.gep_source_types.push((operation, ty));
+    }
+
+    fn apply(self, ctx: &mut Context) {
+        for (operation, ty) in self.storage_types {
+            set_type_attr(ctx, operation, CARRIER_STORAGE_TYPE_KEY, ty);
+        }
+        for (operation, ty) in self.gep_source_types {
+            set_type_attr(ctx, operation, CARRIER_GEP_SOURCE_TYPE_KEY, ty);
+        }
+    }
+}
+
+fn attr_key(name: &str) -> Identifier {
+    Identifier::try_new(name.to_string()).expect("static carrier attribute key must be valid")
+}
+
+fn get_type_attr(ctx: &Context, op: Ptr<Operation>, name: &str) -> Option<TypeHandle> {
+    op.deref(ctx)
+        .attributes
+        .get::<TypeAttr>(&attr_key(name))
+        .map(|attr| attr.get_type(ctx))
+}
+
+fn set_type_attr(ctx: &mut Context, op: Ptr<Operation>, name: &str, ty: TypeHandle) {
+    op.deref_mut(ctx)
+        .attributes
+        .set(attr_key(name), TypeAttr::new(ty));
+}
+
+/// Physical storage type proven for `mir.alloca`, `mir.load`, or `mir.store`.
+///
+/// The attribute is created only by [`prepare_packed_shared_local_storage`]
+/// after the complete whole-tree carrier plan validates, then is consumed
+/// mechanically during lowering.
+pub(crate) fn ca
```

---

### Incident Patch 2: `dbaec217` (2026-09-24)
**Commit Message**: Merge pull request #1326 from 0xOsiris/fix/procfs-image-identity

fix(cuda-host): handle Btrfs mapped file identities

**File**: `crates/cuda-host/src/embedded/mapped_image.rs` (modified, +84/-9)
```diff
@@ -7,9 +7,10 @@
 //! through an unbounded raw pointer. Procfs supplies the mapped file's identity;
 //! metadata validation and artifact reads use the same open file description.
 
-use std::fs::{self, OpenOptions};
+use std::fs::{self, File, OpenOptions};
 use std::io::{self, Read};
-use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
+use std::os::fd::AsRawFd;
+use std::os::unix::fs::OpenOptionsExt;
 use std::path::Path;
 
 #[derive(Debug)]
@@ -81,19 +82,46 @@ fn mapping_at<'a>(maps: &'a [u8], address: usize) -> io::Result<Mapping<'a>> {
     ))
 }
 
+fn mapped_identity_matches(file: &File, mapping: &Mapping<'_>) -> io::Result<bool> {
+    // SAFETY: the descriptor stays open and no references to the mapping are created.
+    let address = unsafe {
+        libc::mmap(
+            std::ptr::null_mut(),
+            1,
+            libc::PROT_NONE,
+            libc::MAP_PRIVATE,
+            file.as_raw_fd(),
+            0,
+        )
+    };
+    if address == libc::MAP_FAILED {
+        return Err(io::Error::last_os_error());
+    }
+    let result = fs::read("/proc/self/maps").and_then(|maps| {
+        let probe = mapping_at(&maps, address.addr())?;
+        if (probe.major, probe.minor, probe.inode) != (mapping.major, mapping.minor, mapping.inode)
+        {
+            return Ok(false);
+        }
+        // Btrfs subvolumes can share procfs device and inode numbers.
+        let map_files = Path::new("/proc/self/map_files");
+        Ok(fs::read_link(map_files.join(probe.range))?
+            == fs::read_link(map_files.join(mapping.range))?)
+    });
+    // SAFETY: this releases only the successful mapping above, including on read errors.
+    unsafe { libc::munmap(address, 1) };
+    result
+}
+
 fn read_verified(path: &Path, mapping: &Mapping<'_>) -> io::Result<Vec<u8>> {
     // A pathname can change after map_files was read. Avoid blocking on a
     // replaced FIFO before its type and identity can be checked below.
     let mut file = OpenOptions::new()
         .read(true)
         .custom_flags(libc::O_NONBLOCK | libc::O_NOFOLLOW)
         .open(path)?;
-    let metadata = file.metadata()?;
-    if !metadata.is_file()
-        || metadata.ino() != mapping.inode
-        || u64::from(libc::major(metadata.dev())) != mapping.major
-        || u64::from(libc::minor(metadata.dev())) != mapping.minor
-    {
+    // Compare both file identities through procfs; stat can report different IDs.
+    if !file.metadata()?.is_file() || !mapped_identity_matches(&file, mapping)? {
         return Err(invalid(
             "artifact image no longer identifies the mapped file",
         ));
@@ -120,6 +148,7 @@ mod tests {
     use oxide_artifacts::{ArtifactBundleSpec, ArtifactPayloadKind, ArtifactPayloadSpec};
     use std::ffi::OsStr;
     use std::os::unix::ffi::OsStrExt;
+    use std::os::unix::fs::MetadataExt;
     use std::process::Command;
     use std::time::{SystemTime, UNIX_EPOCH};
 
@@ -159,6 +188,28 @@ mod tests {
         );
     }
 
+    #[test]
+    fn opened_file_mapping_preserves_device_and_inode_checks() {
+        static ANCHOR: u8 = 0;
+        let maps = fs::read("/proc/self/maps").unwrap();
+        let mut mapping = mapping_at(&maps, std::ptr::from_ref(&ANCHOR).addr()).unwrap();
+        let path = std::env::current_exe().unwrap();
+        let file = File::open(&path).unwrap();
+        assert!(mapped_identity_matches(&file, &mapping).unwrap());
+        mapping.major ^= 1;
+        assert!(!mapped_identity_matches(&file, &mapping).unwrap());
+        assert_eq!(
+            read_verified(&path, &mapping).unwrap_err().kind(),
+            io::ErrorKind::InvalidData
+        );
+        mapping.major ^= 1;
+        mapping.minor ^= 1;
+        assert!(!mapped_identity_matches(&file, &mapping).unwrap());
+        mapping.minor ^= 1;
+        mapping.inode ^= 1;
+        assert!(!mapped_identity_matches(&file, &mapping).unwrap());
+    }
+
     #[test]
     fn shared_library_discovery() {
         co
```

---

### Incident Patch 3: `8206f6e9` (2026-09-24)
**Commit Message**: Merge pull request #1321 from midagedev/fix/unroll-offset-guard

feat(unroll): recognize an exit test that adds a constant to the counter

**File**: `crates/mir-lower/src/wgmma_deferred_accumulator.rs` (modified, +6/-2)
```diff
@@ -539,7 +539,9 @@ fn match_pipelined_counted_loop(
     let Some(trip_count) = recurrences.trip_count else {
         return Ok(None);
     };
-    if trip_count == 0 || primary_iv >= header_args.len() {
+    // An exit test `counter + const <op> bound` is not proven free of
+    // wraparound here, so its trip count is not trusted.
+    if trip_count == 0 || primary_iv >= header_args.len() || recurrences.iv_offset != 0 {
         return Ok(None);
     }
 
@@ -803,7 +805,9 @@ fn match_counted_loop(
     let Some(trip_count) = recurrences.trip_count else {
         return Ok(None);
     };
-    if trip_count == 0 || primary_iv >= header_args.len() {
+    // An exit test `counter + const <op> bound` is not proven free of
+    // wraparound here, so its trip count is not trusted.
+    if trip_count == 0 || primary_iv >= header_args.len() || recurrences.iv_offset != 0 {
         return Ok(None);
     }
 
```

**File**: `crates/mir-transforms/src/analyses/induction.rs` (modified, +97/-47)
```diff
@@ -42,7 +42,9 @@
 //! The **trip count** is how many times the loop body runs. We read it off the
 //! header's exit test `IV <pred> bound` (e.g. `i < 16`) when `init`, `step`, and
 //! a constant `bound` are all known. For `i = 0; i < 16; i += 4` the trip count
-//! is 4.
+//! is 4. The test may also add a constant to the counter first, as in
+//! `i + 2 <= 16` ("a whole tile of two still fits"); that is the same as
+//! `i <= 14` when the addition does not wrap.
 //!
 //! This is a small, reusable stand-in for full scalar evolution that the
 //! unroller (and later loop passes) build on. It is deliberately cautious:
@@ -123,18 +125,26 @@ pub struct LoopRecurrences {
     /// Which header argument is the counter the loop tests against to decide
     /// whether to keep going (its index in `args`), if we found one.
     pub primary_iv: Option<usize>,
-    /// The loop's limit as a plain number, from a test `IV <pred> bound`, when
-    /// `bound` is a compile-time constant.
+    /// The loop's limit as a plain number, when it is a compile-time constant.
+    /// It is normalized so the body runs while `IV <continue_pred> bound`: for
+    /// a test written `IV + iv_offset <pred> n` it is `n - iv_offset`.
     pub bound: Option<i128>,
-    /// The same limit as an IR value rather than a number. The limit can be a
-    /// value only known at runtime (e.g. an array length), which is fine for
-    /// partial unrolling, so we keep the value here even when `bound` is `None`.
+    /// The value the exit test actually compares against, as written (`n`, not
+    /// `n - iv_offset`). It can be a value only known at runtime (e.g. an array
+    /// length), which is fine for partial unrolling, so we keep it here even
+    /// when `bound` is `None`.
     pub bound_value: Option<Value>,
+    /// The constant the exit test adds to the counter before comparing: the
+    /// body runs while `IV + iv_offset <continue_pred> bound_value`. It is 0 for
+    /// `i < n`, 2 for `i + 2 <= n`, and -1 for `i - 1 < n`.
+    pub iv_offset: i128,
     /// The test that keeps the loop going: the body runs while
     /// `IV <continue_pred> bound` holds (e.g. `<` for `while i < n`).
     pub continue_pred: Option<CmpPred>,
     /// How many times the body runs, when `init`, `step`, `bound`, and the
-    /// predicate are all known constants; `None` otherwise.
+    /// predicate are all known constants; `None` otherwise. This is the count
+    /// over mathematical integers: consumers must prove that the counter and
+    /// its exit-test offset do not wrap in the actual integer type.
     pub trip_count: Option<u64>,
 }
 
@@ -253,8 +263,12 @@ pub fn analyze(
 
     // Read the header's exit test to find the counter it checks, the limit, and
     // the keep-going predicate.
-    let (primary_iv, bound, bound_value, continue_pred) =
-        analyze_guard(ctx, info, id, &header_args, &args);
+    let guard = analyze_guard(ctx, info, id, &header_args, &args);
+    let primary_iv = guard.as_ref().map(|g| g.iv);
+    let bound = guard.as_ref().and_then(|g| g.bound);
+    let bound_value = guard.as_ref().map(|g| g.bound_value);
+    let iv_offset = guard.as_ref().map_or(0, |g| g.offset);
+    let continue_pred = guard.as_ref().map(|g| g.pred);
 
     let trip_count = match (primary_iv, bound, continue_pred) {
         (Some(iv), Some(b), Some(p)) => match &args[iv] {
@@ -269,6 +283,7 @@ pub fn analyze(
         primary_iv,
         bound,
         bound_value,
+        iv_offset,
         continue_pred,
         trip_count,
     }
@@ -390,7 +405,7 @@ fn classify_arg(
 
     // Every back-edge must carry `arg + c`, `c + arg`, or `arg - c`, and every
     // path must agree on c. Choosing one arbitrary latch is unsound.
-    let mut steps = values.iter().map(|&value| step_of(ctx, value, arg));
+    let mut steps = values.iter().map(|&value| constant_offset(ctx, value, arg));
     let first_step = steps.next().flatten();
     if let Some(step) = first_step
    
```

**File**: `crates/mir-transforms/src/unroll.rs` (modified, +76/-9)
```diff
@@ -18,8 +18,9 @@
 //! small remainder loop for leftover iterations. The frontend records the
 //! request as a `mir.unroll_hint` operation inside that loop.
 //!
-//! The current analysis recognizes explicit counted `while` loops. Range-based
-//! `for` loops are not yet recognized.
+//! The current analysis recognizes explicit counted `while` loops, including an
+//! exit test that adds a constant to the counter (`while i + 2 <= n`).
+//! Range-based `for` loops are not yet recognized.
 //!
 //! Several `continue` paths are supported: the pass joins their back-edges
 //! before unrolling. Full `#[unroll]` also preserves early `break` paths and
@@ -538,9 +539,17 @@ fn analyze_shape(
     let header = l.header;
     let latch = l.latches[0];
 
-    let iv_idx = rec
-        .primary_iv
-        .ok_or("no recognized induction variable (loop counter)")?;
+    let iv_idx = match rec.primary_iv {
+        Some(iv_idx) => iv_idx,
+        None if rec
+            .args
+            .iter()
+            .any(|arg| matches!(arg, ArgKind::BasicIv { .. })) =>
+        {
+            return Err("the loop has a counter, but its exit test is not of the form `counter <op> bound` (or `counter + const <op> bound`)".into());
+        }
+        None => return Err("no recognized induction variable (loop counter)".into()),
+    };
     let (iv_init, iv_step) = match &rec.args[iv_idx] {
         ArgKind::BasicIv { init, step } => (*init, *step),
         _ => return Err("the loop counter is not a simple induction variable".into()),
@@ -869,6 +878,35 @@ fn full_iv_stays_in_range(ctx: &Context, shape: &LoopShape, trip: i128) -> bool
     (min..=max).contains(&shape.iv_init) && (min..=max).contains(&final_iv)
 }
 
+/// With an exit test `IV + offset <pred> bound`, the header computes
+/// `init + k*step + offset` for every `k` from 0 to the trip count. That sum
+/// changes monotonically in `k`, so it stays in the IV type's range exactly when
+/// its first and last values do; otherwise the fixed-width test can wrap and
+/// disagree with the trip count.
+fn full_exit_test_stays_in_range(
+    ctx: &Context,
+    shape: &LoopShape,
+    trip: i128,
+    offset: i128,
+) -> bool {
+    if offset == 0 {
+        return true;
+    }
+    let Some((min, max)) = integer_value_bounds(ctx, shape.iv_type) else {
+        return false;
+    };
+    let Some(final_iv) = trip
+        .checked_mul(shape.iv_step)
+        .and_then(|delta| shape.iv_init.checked_add(delta))
+    else {
+        return false;
+    };
+    [shape.iv_init, final_iv].iter().all(|&iv| {
+        iv.checked_add(offset)
+            .is_some_and(|tested| (min..=max).contains(&tested))
+    })
+}
+
 /// A grouped positive-IV span must be small enough to cross the type boundary
 /// at most once. The runtime guard can then detect that crossing reliably.
 fn partial_span_is_representable(ctx: &Context, ty: TypeHandle, span: i128) -> bool {
@@ -931,6 +969,11 @@ fn full_unroll(
                 .into(),
         ));
     }
+    if !full_exit_test_stays_in_range(ctx, &s, trip, rec.iv_offset) {
+        return Ok(UnrollOutcome::Skipped(
+            "the exit test's `counter + const` may wrap in the counter's type, so the computed trip count may be wrong".into(),
+        ));
+    }
 
     // Precompute every literal before changing the CFG. Besides keeping all
     // arithmetic checked, this guarantees that an unsupported recurrence cannot
@@ -1061,8 +1104,8 @@ fn make_const(ctx: &mut Context, ty: TypeHandle, value: i128, before: Ptr<Operat
 /// ```text
 ///   preheader -> main_h(init...)
 ///   main_h(acc, i):                       (i = counter, acc = carried values)
-///       if (i + (factor-1)*step) <pred> bound  -> copy0   (a full group fits)
-///       else                                   -> header  (run the remainder)
+///       if (i + (factor-1)*step) + off <pred> bound  -> copy0   (a full group fits)
+///       else                                         -> header  (run the r
```

**File**: `crates/mir-transforms/tests/common/mod.rs` (modified, +209/-1)
```diff
@@ -16,8 +16,10 @@
 use core::num::NonZero;
 
 use dialect_mir::ops::{
-    MirAddOp, MirCondBranchOp, MirConstantOp, MirFuncOp, MirGotoOp, MirLtOp, MirNotOp, MirReturnOp,
+    MirAddOp, MirCondBranchOp, MirConstantOp, MirFuncOp, MirGeOp, MirGotoOp, MirGtOp, MirLeOp,
+    MirLtOp, MirNotOp, MirReturnOp, MirSubOp,
 };
+use mir_transforms::analyses::induction::CmpPred;
 use pliron::basic_block::BasicBlock;
 use pliron::builtin::attributes::{IntegerAttr, TypeAttr};
 use pliron::builtin::op_interfaces::{
@@ -51,6 +53,16 @@ pub fn u32t(ctx: &mut Context) -> TypedHandle<IntegerType> {
     IntegerType::get(ctx, 32, Signedness::Unsigned)
 }
 
+/// A signed 32-bit type.
+pub fn i32t(ctx: &mut Context) -> TypedHandle<IntegerType> {
+    IntegerType::get(ctx, 32, Signedness::Signed)
+}
+
+/// A signed 128-bit type, for constants at the edge of the analysis range.
+pub fn i128t(ctx: &mut Context) -> TypedHandle<IntegerType> {
+    IntegerType::get(ctx, 128, Signedness::Signed)
+}
+
 /// Create `fn foo(inputs...) -> outputs...` inside a module and return
 /// `(module_op, region)`. Blocks are appended to `region` by the caller; the
 /// first block is the entry and must have the same argument types as `inputs`.
@@ -110,6 +122,28 @@ pub fn iconst(
     op.deref(ctx).get_result(0)
 }
 
+/// Append an integer constant given as an `i128`, for types wider than 64 bits.
+pub fn iconst_i128(
+    ctx: &mut Context,
+    b: Ptr<BasicBlock>,
+    ty: TypedHandle<IntegerType>,
+    val: i128,
+) -> Value {
+    let width = ty.deref(ctx).width() as usize;
+    let apint = APInt::from_i128(val, NonZero::new(width).unwrap());
+    let op = Operation::new(
+        ctx,
+        MirConstantOp::get_concrete_op_info(),
+        vec![ty.into()],
+        vec![],
+        vec![],
+        0,
+    );
+    MirConstantOp::new(op).set_attr_value(ctx, IntegerAttr::new(ty, apint));
+    op.insert_at_back(b, ctx);
+    op.deref(ctx).get_result(0)
+}
+
 /// Append an unconditional `goto target(operands)` to `b`.
 pub fn goto(ctx: &mut Context, b: Ptr<BasicBlock>, target: Ptr<BasicBlock>, operands: Vec<Value>) {
     let op = Operation::new(
@@ -297,6 +331,180 @@ pub fn counted_loop_from_step(ctx: &mut Context, start: i64, n: i64, step: i64)
     }
 }
 
+/// Where an offset loop's limit `n` comes from.
+#[derive(Debug, Clone, Copy)]
+pub enum OffsetBound {
+    /// A compile-time constant.
+    Const(i128),
+    /// The function's only argument, so the limit is known only at runtime.
+    Param,
+    /// The carried accumulator plus this constant, so both sides of the exit
+    /// test are computed from header arguments.
+    AccPlus(i128),
+}
+
+/// Build `while i + off <pred> n { acc += i; i += step }` in the shape mem2reg
+/// leaves it. A negative `off` is written `i - |off|`:
+///
+/// ```text
+///   preheader(n?):    acc0=0; i0=start;          goto header(acc0, i0)
+///   header(acc, i):   v = i + off; t = not(v <pred> n); cond_br t [exit(acc), latch]
+///   latch:            acc1=acc+i; i1=i+step;     goto header(acc1, i1)
+///   exit(result):     return result
+/// ```
+///
+/// All values have type `ty`. With [`OffsetBound::Param`] the function takes
+/// `n` as its only argument.
+pub fn offset_counted_loop(
+    ctx: &mut Context,
+    ty: TypedHandle<IntegerType>,
+    start: i128,
+    step: i128,
+    off: i128,
+    pred: CmpPred,
+    bound: OffsetBound,
+) -> CountedLoop {
+    offset_loop(ctx, ty, start, step, off, pred, bound, false)
+}
+
+/// The same loop with the counter expression on the right of the exit test:
+/// `while n <pred> i + off`. `pred` is the operator as written, so
+/// `n >= i + off` passes [`CmpPred::Ge`].
+pub fn offset_counted_loop_iv_on_right(
+    ctx: &mut Context,
+    ty: TypedHandle<IntegerType>,
+    start: i128,
+    step: i128,
+    off: i128,
+    pred: CmpPred,
+    bound: OffsetBound,
+) -> CountedLoop {
+    offset_loop(ctx, ty, start, step, off, pred, bound, true)
+}
+
+#[allow(clippy::too_many_arguments)]
+fn
```

**File**: `crates/mir-transforms/tests/induction.rs` (modified, +147/-1)
```diff
@@ -9,7 +9,10 @@
 
 mod common;
 
-use common::{counted_loop, counted_loop_from, mir_ctx, multi_latch_counted_loop};
+use common::{
+    CountedLoop, OffsetBound, counted_loop, counted_loop_from, i32t, i128t, mir_ctx,
+    multi_latch_counted_loop, offset_counted_loop, offset_counted_loop_iv_on_right, u32t,
+};
 use mir_transforms::analyses::induction::{ArgKind, CmpPred, analyze};
 use mir_transforms::analyses::loop_info::LoopInfo;
 use pliron::graph::dominance::DomInfo;
@@ -29,6 +32,21 @@ fn recurrences_for(n: i64) -> mir_transforms::analyses::induction::LoopRecurrenc
     analyze(&ctx, &info, id, ph)
 }
 
+/// Run the analysis on an already built loop.
+fn recurrences_of(
+    ctx: &pliron::context::Context,
+    lp: &CountedLoop,
+) -> mir_transforms::analyses::induction::LoopRecurrences {
+    let mut dom = DomInfo::default();
+    let info = {
+        let dt = dom.get_dom_tree(ctx, lp.region);
+        LoopInfo::compute(ctx, lp.region, dt)
+    };
+    let id = info.innermost_loop(lp.header).unwrap();
+    let ph = info.preheader(ctx, lp.region, id).unwrap();
+    analyze(ctx, &info, id, ph)
+}
+
 #[test]
 fn analyzes_counted_loop_recurrence() {
     // while i < 8 { acc += i; i += 1 }  =>  header args are (acc, i).
@@ -151,3 +169,131 @@ fn rejects_inconsistent_iv_steps_across_latches() {
     );
     assert_eq!(rec.trip_count, None);
 }
+
+/// `while i + 1 <= 4` tests the counter plus one. The analysis records the
+/// offset and normalizes the limit to `i <= 3`, so the loop runs four times.
+#[test]
+fn counter_plus_constant_exit_test_is_recognized() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let lp = offset_counted_loop(&mut ctx, u32, 0, 1, 1, CmpPred::Le, OffsetBound::Const(4));
+    let rec = recurrences_of(&ctx, &lp);
+
+    assert_eq!(rec.primary_iv, Some(1));
+    assert_eq!(rec.iv_offset, 1);
+    assert_eq!(rec.continue_pred, Some(CmpPred::Le));
+    assert_eq!(rec.bound, Some(3));
+    assert_eq!(rec.trip_count, Some(4));
+}
+
+/// `while i + 2 < 8` with `i += 2` runs for `i = 0, 2, 4`: three trips.
+#[test]
+fn counter_offset_and_step_combine_in_the_trip_count() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let lp = offset_counted_loop(&mut ctx, u32, 0, 2, 2, CmpPred::Lt, OffsetBound::Const(8));
+    let rec = recurrences_of(&ctx, &lp);
+
+    assert_eq!(rec.primary_iv, Some(1));
+    assert_eq!(rec.iv_offset, 2);
+    assert_eq!(rec.continue_pred, Some(CmpPred::Lt));
+    assert_eq!(rec.bound, Some(6));
+    assert_eq!(rec.trip_count, Some(3));
+}
+
+/// `while 8 >= i + 2` is the same test as `while i + 2 <= 8`: the predicate is
+/// swapped and the counter found on the right.
+#[test]
+fn counter_offset_on_the_right_side_is_swapped() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let lp =
+        offset_counted_loop_iv_on_right(&mut ctx, u32, 0, 1, 2, CmpPred::Ge, OffsetBound::Const(8));
+    let rec = recurrences_of(&ctx, &lp);
+
+    assert_eq!(rec.primary_iv, Some(1));
+    assert_eq!(rec.iv_offset, 2);
+    assert_eq!(rec.continue_pred, Some(CmpPred::Le));
+    assert_eq!(rec.bound, Some(6));
+    assert_eq!(rec.trip_count, Some(7));
+}
+
+/// `while i - 1 < 4` has offset -1, so the normalized limit is `i < 5` and a
+/// signed counter from 0 runs five times.
+#[test]
+fn counter_minus_constant_exit_test_raises_the_limit() {
+    let mut ctx = mir_ctx();
+    let i32 = i32t(&mut ctx);
+    let lp = offset_counted_loop(&mut ctx, i32, 0, 1, -1, CmpPred::Lt, OffsetBound::Const(4));
+    let rec = recurrences_of(&ctx, &lp);
+
+    assert_eq!(rec.primary_iv, Some(1));
+    assert_eq!(rec.iv_offset, -1);
+    assert_eq!(rec.continue_pred, Some(CmpPred::Lt));
+    assert_eq!(rec.bound, Some(5));
+    assert_eq!(rec.trip_count, Some(5));
+}
+
+/// `while i - 1 <= i128::MAX` would need the limit `i128::MAX + 1`, which the
+/// analysis cannot represent. It reports no exit test rather than a wrong one.
+#[test]
+fn counter_offset_whose_limit_ove
```

---

### Incident Patch 4: `c363b927` (2026-09-24)
**Commit Message**: Merge pull request #1307 from letv1nnn/fix/doctor-clang-versioned-name

fix(cargo-oxide): probe versioned clang binaries in doctor

**File**: `crates/cargo-oxide/src/commands/doctor.rs` (modified, +30/-15)
```diff
@@ -14,6 +14,23 @@ use super::*;
 // Doctor command
 // =============================================================================
 
+/// Find the first compiler that can report a non-empty resource directory.
+/// Probe the required operation directly: `--version` alone does not establish
+/// that a wrapper or incomplete installation can answer this query.
+pub(super) fn clang_resource_dir<'a>(candidates: &[&'a str]) -> Option<(&'a str, String)> {
+    candidates.iter().find_map(|&name| {
+        let output = Command::new(name)
+            .arg("-print-resource-dir")
+            .output()
+            .ok()?;
+        if !output.status.success() {
+            return None;
+        }
+        let dir = String::from_utf8_lossy(&output.stdout).trim().to_string();
+        (!dir.is_empty()).then_some((name, dir))
+    })
+}
+
 /// Parsed contents of a `rust-toolchain.toml` pin.
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub(crate) struct RustToolchainPin {
@@ -678,28 +695,26 @@ pub fn doctor(ctx: &Context) {
     // leave `/usr/lib/clang/*/include` empty and bindgen explodes with a
     // mysterious "'stddef.h' file not found". Catch that up front.
     print!("clang / libclang resource dir... ");
-    let clang_resource_dir = Command::new("clang")
-        .arg("-print-resource-dir")
-        .output()
-        .ok()
-        .filter(|o| o.status.success())
-        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
-    match clang_resource_dir {
-        Some(ref dir) if std::path::Path::new(&format!("{}/include/stddef.h", dir)).exists() => {
-            println!("✓ {}", dir);
+    let clangs = [
+        "clang", "clang-22", "clang-21", "clang-20", "clang-19", "clang-18", "clang-17",
+        "clang-16", "clang-15",
+    ];
+
+    match clang_resource_dir(&clangs) {
+        Some((name, ref dir))
+            if std::path::Path::new(&format!("{}/include/stddef.h", dir)).exists() =>
+        {
+            println!("✓ {dir} (via {name})");
         }
-        Some(ref dir) => {
-            println!(
-                "✗ resource dir present but `include/stddef.h` missing: {}",
-                dir
-            );
+        Some((name, ref dir)) => {
+            println!("✗ resource dir present but `include/stddef.h` missing: {dir} (via {name})");
             eprintln!("  Host `cuda-bindings` uses bindgen, which needs clang's own stddef.h.");
             eprintln!("  Install the matching dev headers: sudo apt install clang-21");
             eprintln!("  (or libclang-common-21-dev)");
             ok = false;
         }
         None => {
-            println!("✗ clang not found");
+            println!("✗ no clang could report its resource directory");
             eprintln!(
                 "  Host `cuda-bindings` uses bindgen, which needs clang + its resource headers."
             );
```

**File**: `crates/cargo-oxide/src/commands/tests.rs` (modified, +52/-0)
```diff
@@ -144,6 +144,58 @@ fn unique_temp_dir(prefix: &str) -> PathBuf {
     std::env::temp_dir().join(format!("{}_{}_{}", prefix, std::process::id(), unique))
 }
 
+#[cfg(unix)]
+fn doctor_clang_fixture(root: &Path, name: &str, resource_response: &str) -> String {
+    use std::os::unix::fs::PermissionsExt;
+
+    let path = root.join(name);
+    fs::write(
+        &path,
+        format!(
+            "#!/bin/sh\ncase \"$1\" in\n--version) echo clang; exit 0;;\n-print-resource-dir) {resource_response};;\nesac\nexit 1\n"
+        ),
+    )
+    .unwrap();
+    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
+    path.to_string_lossy().into_owned()
+}
+
+#[cfg(unix)]
+#[test]
+fn doctor_clang_resource_falls_back_after_absent_failed_and_empty_probes() {
+    let root = unique_temp_dir("cargo_oxide_doctor_clang_fallback");
+    fs::create_dir_all(&root).unwrap();
+    let absent = root.join("clang").to_string_lossy().into_owned();
+    let failed = doctor_clang_fixture(&root, "clang-22", "exit 1");
+    let empty = doctor_clang_fixture(&root, "clang-21", "printf '   \n'; exit 0");
+    let working = doctor_clang_fixture(
+        &root,
+        "clang-20",
+        "printf ' /clang/resource dir \n'; exit 0",
+    );
+    assert_eq!(
+        clang_resource_dir(&[&absent, &failed, &empty, &working]),
+        Some((working.as_str(), "/clang/resource dir".to_string()))
+    );
+    assert_eq!(clang_resource_dir(&[&absent, &failed, &empty]), None);
+    fs::remove_dir_all(root).unwrap();
+}
+
+#[cfg(unix)]
+#[test]
+fn doctor_clang_resource_prefers_the_first_successful_candidate() {
+    let root = unique_temp_dir("cargo_oxide_doctor_clang_precedence");
+    fs::create_dir_all(&root).unwrap();
+    let bare = doctor_clang_fixture(&root, "clang", "printf '/bare/resource\n'; exit 0");
+    let versioned =
+        doctor_clang_fixture(&root, "clang-22", "printf '/versioned/resource\n'; exit 0");
+    assert_eq!(
+        clang_resource_dir(&[&bare, &versioned]),
+        Some((bare.as_str(), "/bare/resource".to_string()))
+    );
+    fs::remove_dir_all(root).unwrap();
+}
+
 /// The examples walk backing `cargo oxide fmt` must reach nested manifests
 /// and skip build directories.
 ///
```

---

### Incident Patch 5: `0b462e34` (2026-09-24)
**Commit Message**: Fix sparse FP8 test integration and strengthen GPU oracle

Signed-off-by: nihalpasham <nihalp@nvidia.com>

**File**: `crates/mir-lower/tests/lowering_test/mma.rs` (modified, +2/-2)
```diff
@@ -1866,15 +1866,15 @@ fn test_generated_plain_sparse_fp8_m16n8k64_lowers_to_exact_convergent_inline_pt
                 "mma.sp.sync.aligned.m16n8k64.row.col.f32.{a_name}.{b_name}.f32 {{$0, $1, $2, $3}}, {{$8, $9, $10, $11}}, {{$12, $13, $14, $15}}, {{$4, $5, $6, $7}}, $16, $17;"
             );
             assert_eq!(
-                asm.get_attr_inline_asm_template(&ctx)
+                asm.get_attr_llvm_inline_asm_template(&ctx)
                     .as_deref()
                     .map(|value| String::from(value.clone())),
                 Some(expected_template)
             );
             // Four f32 outputs, the f32 C fragment, the packed A/B registers,
             // the metadata register and the compile-time selector immediate.
             assert_eq!(
-                asm.get_attr_inline_asm_constraints(&ctx)
+                asm.get_attr_llvm_inline_asm_constraints(&ctx)
                     .as_deref()
                     .map(|value| String::from(value.clone())),
                 Some("=f,=f,=f,=f,f,f,f,f,r,r,r,r,r,r,r,r,r,n".to_string())
```

**File**: `crates/rustc-codegen-cuda/examples/sparse_mma_fp8/Cargo.lock` (modified, +3/-1)
```diff
@@ -179,6 +179,8 @@ dependencies = [
  "cuda-core",
  "cuda-macros",
  "half",
+ "libc",
+ "oxide-artifacts",
  "ptx-parse",
  "sha2",
  "thiserror",
@@ -544,7 +546,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0fda2ff0d084019ba4d7c6f371c95d8fd75ce3524c3cb8fb653a3023f6323e64"
 
 [[package]]
-name = "sparse_mma_ordered_float"
+name = "sparse_mma_fp8"
 version = "0.1.0"
 dependencies = [
  "cuda-core",
```

**File**: `crates/rustc-codegen-cuda/examples/sparse_mma_fp8/src/main.rs` (modified, +100/-100)
```diff
@@ -1,70 +1,12 @@
 /* SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
  * SPDX-License-Identifier: Apache-2.0 */
 
-//! GPU oracle for the four plain (standard-metadata) SM89 sparse FP8 MMA forms:
+//! Checks all four plain SM89 sparse FP8 MMA forms against an exact host GEMM.
 //!
-//! ```text
-//! mma.sp.sync.aligned.m16n8k64.row.col.f32.e4m3.e4m3.f32
-//! mma.sp.sync.aligned.m16n8k64.row.col.f32.e4m3.e5m2.f32
-//! mma.sp.sync.aligned.m16n8k64.row.col.f32.e5m2.e4m3.f32
-//! mma.sp.sync.aligned.m16n8k64.row.col.f32.e5m2.e5m2.f32
-//! ```
-//!
-//! # The fragment contract
-//!
-//! A is 2:4 sparse along K, so it is held **compressed** as 16x32 in four `.b32`
-//! registers; B is the full 64x8 in four `.b32` registers. For lane `l`, with
-//! `g = l/4`, `t = l%4`, register `n` and byte position `i` (byte 0 is the
-//! lowest byte of the register):
-//!
-//! ```text
-//! A: row = g + 8*(n%2)                     compressed col = 4*t + 16*(n/2) + i
-//! B: k   = 16*n + 4*t + i                  col            = g
-//! D: regs {0,1} -> row g,   cols 2*t, 2*t+1
-//!    regs {2,3} -> row g+8, cols 2*t, 2*t+1
-//! metadata: nibble = i0 | i1<<2, the same code in all eight 4-bit groups;
-//!           compressed column 2*q takes dense K 4*q + i0,
-//!           compressed column 2*q+1 takes dense K 4*q + i1
-//! selector = 0
-//! ```
-//!
-//! So the four FP8 values in a register are little-endian: byte `i` is the
-//! lowest-addressed element of the four it covers.
-//!
-//! # How that was determined
-//!
-//! Neither the byte order nor the nibble-to-K-group mapping is documented
-//! anywhere this checkout can reach, so the hardware is the oracle. `--probe`
-//! runs the e4m3/e4m3 form once per candidate wiring -- 13,824 candidates over
-//! six independent axes: which A registers hold row `g+8`, which compressed
-//! columns an A register holds, the A byte order, which K rows a B register
-//! holds, the B byte order, and which of a nibble's two 2-bit fields names the
-//! even compressed column. Every candidate is filled into the registers and
-//! executed; the host compares against an exact integer GEMM that does not
-//! depend on the candidate at all, so a wrong axis changes the sum.
-//!
-//! 32 candidates reproduce the reference bit-for-bit, and they are exactly two
-//! families:
-//!
-//! * `A row = n%2, A band = 16*(n/2), A byte order = i, B band = 16*n,
-//!    B byte order = i` for all twelve legal nibble codes -- 24 entries once
-//!    the field-swap duplicate is removed;
-//! * the same with **both** byte orders reversed and the nibble's fields
-//!    swapped, for two codes only (`0x3`/`0xc` and `0x6`/`0x9`).
-//!
-//! The first family is the wiring: it is the only one that reproduces the
-//! reference for the other ten nibble codes, and the byte-order axis is varied
-//! on its own (reversing A alone or B alone matches nothing). The second
-//! family is a self-compensating alias that exists only for the two nibbles
-//! whose code has the larger index in the low field; the oracle therefore
-//! exercises `0x4`, `0x8` and `0xe` as well, which no byte-order reversal can
-//! reproduce.
-//!
-//! Re-run the sweep with:
-//!
-//! ```text
-//! cargo run -p cargo-oxide -- run sparse_mma_fp8 -- --probe
-//! ```
+//! Each form covers all twelve standard-metadata codes and zero/nonzero C.
+//! Values vary across K bands so swapped fragment registers change the result.
+//! See the PTX ISA's "Matrix Fragments for sparse mma.m16n8k64" for the layout.
+//! `--probe` additionally compares candidate layouts on the current GPU.
 
 use cuda_core::simt::LaunchConfig;
 use cuda_core::{CudaContext, DeviceBuffer};
@@ -73,17 +15,17 @@ use cuda_device::{DisjointSlice, cuda_module, kernel, thread, wmma};
 const M: usize = 16;
 const N: usize = 8;
 const K: usize = 64;
+const METADATA_CODES: usize = 12;
+const VARIANTS: usize = 2 * 4 * METADATA_CODES;
 /// Compressed K: two kept elements per
```

---

### Incident Patch 6: `a50ccff5` (2026-09-24)
**Commit Message**: fix(cuda-host): parse PTX debug indices as complete tokens

Signed-off-by: nihalpasham <nihalp@nvidia.com>

**File**: `crates/cuda-host/src/embedded.rs` (modified, +71/-58)
```diff
@@ -162,10 +162,7 @@ pub fn merge_ptx_bundles<'a>(
     let mut merged = String::new();
     let mut found_any = false;
 
-    // Debug `.file` indices are per-module sequence numbers starting at 1,
-    // so concatenated lineinfo/debug bundles redeclare each other's indices
-    // and ptxas rejects the module ("Duplicate file index"). Each appended
-    // bundle's indices are shifted past the running maximum (#1292).
+    // Keep each bundle's debug file indices distinct in the merged module.
     let mut file_index_offset = 0;
 
     for bundle in bundles {
@@ -199,14 +196,8 @@ pub fn merge_ptx_bundles<'a>(
     Ok(merged)
 }
 
-/// Rewrite one bundle's PTX for concatenation: strip the per-file header
-/// directives (`.version`/`.target`/`.address_size`) unless this is the first
-/// bundle, and shift every debug file index (`.file` declarations, `.loc`
-/// references, and `.loc ... inlined_at` references) by `file_index_offset`.
-///
-/// Returns the rewritten text and the highest file index it declares or
-/// references after shifting, so the caller can offset the next bundle past
-/// it. Bundles without debug info report `0` and are unaffected.
+/// Strip repeated headers and shift debug indices past the previous bundles.
+/// Returns the rewritten text and its highest debug file index.
 fn prepare_bundle_body(
     ptx: &str,
     strip_headers: bool,
@@ -223,30 +214,34 @@ fn prepare_bundle_body(
                     .delete(directive.line_span())
                     .map_err(|error| error.to_string())?;
             }
-            // `.file <index> "path"[, timestamp, size]`
-            ".file" => {
+            ".file" | ".loc" => {
+                let span = directive.arguments_span();
+                let tokens = document.tokens();
+                let first = tokens.partition_point(|token| token.span().end <= span.start);
+                let arguments: Vec<_> = tokens[first..]
+                    .iter()
+                    .take_while(|token| token.span().start < span.end)
+                    .filter(|token| !token.kind().is_trivia())
+                    .collect();
                 let index = shift_file_index(
                     &mut edits,
-                    directive.arguments(),
-                    directive.arguments_span().start,
-                    0,
+                    ptx,
+                    arguments.first().copied(),
                     file_index_offset,
                 )?;
                 max_file_index = max_file_index.max(index);
-            }
-            // `.loc <index> <line> <column>[, function_name f, inlined_at
-            // <index> <line> <column>]` — both indices reference the file
-            // table and both must move with it.
-            ".loc" => {
-                let arguments = directive.arguments();
-                let base = directive.arguments_span().start;
-                let index = shift_file_index(&mut edits, arguments, base, 0, file_index_offset)?;
-                max_file_index = max_file_index.max(index);
-                if let Some(position) = arguments.find("inlined_at") {
-                    let after = position + "inlined_at".len();
-                    let index =
-                        shift_file_index(&mut edits, arguments, base, after, file_index_offset)?;
-                    max_file_index = max_file_index.max(index);
+                if directive.name() == ".loc" {
+                    for (position, attribute) in arguments.windows(2).enumerate() {
+                        if attribute[0].text(ptx) == "," && attribute[1].text(ptx) == "inlined_at" {
+                            let index = shift_file_index(
+                                &mut edits,
+                                ptx,
+                                arguments.get(position + 2).copied(),
+                                file_index_offset,
+                            )?;
+                            max_file_index = max_file_index.max(index);
+        
```

---

### Incident Patch 7: `bbdcbe81` (2026-09-24)
**Commit Message**: fix(doctor): keep probing after unusable clang resource queries

Signed-off-by: nihalpasham <nihalp@nvidia.com>

**File**: `crates/cargo-oxide/src/commands/doctor.rs` (modified, +21/-21)
```diff
@@ -14,6 +14,23 @@ use super::*;
 // Doctor command
 // =============================================================================
 
+/// Find the first compiler that can report a non-empty resource directory.
+/// Probe the required operation directly: `--version` alone does not establish
+/// that a wrapper or incomplete installation can answer this query.
+pub(super) fn clang_resource_dir<'a>(candidates: &[&'a str]) -> Option<(&'a str, String)> {
+    candidates.iter().find_map(|&name| {
+        let output = Command::new(name)
+            .arg("-print-resource-dir")
+            .output()
+            .ok()?;
+        if !output.status.success() {
+            return None;
+        }
+        let dir = String::from_utf8_lossy(&output.stdout).trim().to_string();
+        (!dir.is_empty()).then_some((name, dir))
+    })
+}
+
 /// Parsed contents of a `rust-toolchain.toml` pin.
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub(crate) struct RustToolchainPin {
@@ -643,28 +660,11 @@ pub fn doctor(ctx: &Context) {
     // mysterious "'stddef.h' file not found". Catch that up front.
     print!("clang / libclang resource dir... ");
     let clangs = [
-        "clang", "clang-21", "clang-20", "clang-19", "clang-18", "clang-17", "clang-16", "clang-15",
+        "clang", "clang-22", "clang-21", "clang-20", "clang-19", "clang-18", "clang-17",
+        "clang-16", "clang-15",
     ];
 
-    let found = clangs.into_iter().find_map(|c| {
-        Command::new(c)
-            .arg("--version")
-            .output()
-            .ok()
-            .filter(|o| o.status.success())
-            .map(|_| c)
-    });
-
-    let clang_resource_dir = found.and_then(|name| {
-        Command::new(name)
-            .arg("-print-resource-dir")
-            .output()
-            .ok()
-            .filter(|o| o.status.success())
-            .map(|o| (name, String::from_utf8_lossy(&o.stdout).trim().to_string()))
-    });
-
-    match clang_resource_dir {
+    match clang_resource_dir(&clangs) {
         Some((name, ref dir))
             if std::path::Path::new(&format!("{}/include/stddef.h", dir)).exists() =>
         {
@@ -678,7 +678,7 @@ pub fn doctor(ctx: &Context) {
             ok = false;
         }
         None => {
-            println!("✗ clang not found");
+            println!("✗ no clang could report its resource directory");
             eprintln!(
                 "  Host `cuda-bindings` uses bindgen, which needs clang + its resource headers."
             );
```

**File**: `crates/cargo-oxide/src/commands/tests.rs` (modified, +52/-0)
```diff
@@ -144,6 +144,58 @@ fn unique_temp_dir(prefix: &str) -> PathBuf {
     std::env::temp_dir().join(format!("{}_{}_{}", prefix, std::process::id(), unique))
 }
 
+#[cfg(unix)]
+fn doctor_clang_fixture(root: &Path, name: &str, resource_response: &str) -> String {
+    use std::os::unix::fs::PermissionsExt;
+
+    let path = root.join(name);
+    fs::write(
+        &path,
+        format!(
+            "#!/bin/sh\ncase \"$1\" in\n--version) echo clang; exit 0;;\n-print-resource-dir) {resource_response};;\nesac\nexit 1\n"
+        ),
+    )
+    .unwrap();
+    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
+    path.to_string_lossy().into_owned()
+}
+
+#[cfg(unix)]
+#[test]
+fn doctor_clang_resource_falls_back_after_absent_failed_and_empty_probes() {
+    let root = unique_temp_dir("cargo_oxide_doctor_clang_fallback");
+    fs::create_dir_all(&root).unwrap();
+    let absent = root.join("clang").to_string_lossy().into_owned();
+    let failed = doctor_clang_fixture(&root, "clang-22", "exit 1");
+    let empty = doctor_clang_fixture(&root, "clang-21", "printf '   \n'; exit 0");
+    let working = doctor_clang_fixture(
+        &root,
+        "clang-20",
+        "printf ' /clang/resource dir \n'; exit 0",
+    );
+    assert_eq!(
+        clang_resource_dir(&[&absent, &failed, &empty, &working]),
+        Some((working.as_str(), "/clang/resource dir".to_string()))
+    );
+    assert_eq!(clang_resource_dir(&[&absent, &failed, &empty]), None);
+    fs::remove_dir_all(root).unwrap();
+}
+
+#[cfg(unix)]
+#[test]
+fn doctor_clang_resource_prefers_the_first_successful_candidate() {
+    let root = unique_temp_dir("cargo_oxide_doctor_clang_precedence");
+    fs::create_dir_all(&root).unwrap();
+    let bare = doctor_clang_fixture(&root, "clang", "printf '/bare/resource\n'; exit 0");
+    let versioned =
+        doctor_clang_fixture(&root, "clang-22", "printf '/versioned/resource\n'; exit 0");
+    assert_eq!(
+        clang_resource_dir(&[&bare, &versioned]),
+        Some((bare.as_str(), "/bare/resource".to_string()))
+    );
+    fs::remove_dir_all(root).unwrap();
+}
+
 /// The examples walk backing `cargo oxide fmt` must reach nested manifests
 /// and skip build directories.
 ///
```

---

### Incident Patch 8: `d4674502` (2026-09-04)
**Commit Message**: fix(mir-lower): support packed AS3 carrier local projections

Signed-off-by: Raul Estrada <raulestradaa@gmail.com>

**File**: `crates/mir-lower/src/convert/ops/aggregate/carrier_field_addr.rs` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+/*
+ * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+//! Direct field-address lowering for verified packed-AS3 carrier locals.
+
+use super::addressing;
+use super::common::anyhow_to_pliron;
+use crate::convert::types::{StructLayoutInfo, build_struct_slot_map};
+use crate::packed_shared_local_storage::carrier_gep_source_type;
+use dialect_mir::ops::MirFieldAddrOp;
+use dialect_mir::types::MirStructType;
+use llvm_export::ops as llvm;
+use llvm_export::types::{StructLayout, StructType};
+use pliron::builtin::types::{IntegerType, Signedness};
+use pliron::context::{Context, Ptr};
+use pliron::irbuild::dialect_conversion::{DialectConversionRewriter, OperandsInfo};
+use pliron::irbuild::inserter::Inserter;
+use pliron::irbuild::rewriter::Rewriter;
+use pliron::op::Op;
+use pliron::operation::Operation;
+use pliron::result::Result;
+use pliron::r#type::{TypeHandle, Typed};
+
+/// Lower a field address, using the physical carrier struct only when the
+/// pre-lowering carrier proof stamped this exact projection.
+///
+/// Ordinary field projections stay on the established #859 path. Carrier
+/// projections never reconstruct provenance from operand history: the physical
+/// GEP source type is an LLVM `TypeAttr` placed directly on this MIR operation
+/// by the closed-world preparation pass.
+pub(crate) fn convert_field_addr(
+    ctx: &mut Context,
+    rewriter: &mut DialectConversionRewriter,
+    op: Ptr<Operation>,
+    operands_info: &OperandsInfo,
+) -> Result<()> {
+    let Some(carrier_source_ty) = carrier_gep_source_type(ctx, op) else {
+        return addressing::convert_field_addr(ctx, rewriter, op, operands_info);
+    };
+
+    let field_addr = MirFieldAddrOp::new(op);
+    let field_index = field_addr
+        .get_attr_field_index(ctx)
+        .ok_or_else(|| pliron::input_error_noloc!("MirFieldAddrOp missing field_index attribute"))?
+        .0 as usize;
+    let semantic_aggregate = field_addr
+        .get_attr_aggregate_ty(ctx)
+        .ok_or_else(|| {
+            pliron::input_error_noloc!("MirFieldAddrOp missing verified aggregate_ty attribute")
+        })?
+        .get_type(ctx);
+
+    let (layout, aggregate_abi_align) = {
+        let aggregate_ref = semantic_aggregate.deref(ctx);
+        let Some(struct_ty) = aggregate_ref.downcast_ref::<MirStructType>() else {
+            return pliron::input_err_noloc!(
+                "packed-AS3 carrier field projection requires a struct root"
+            );
+        };
+        (StructLayoutInfo::of_struct(struct_ty), struct_ty.abi_align)
+    };
+    let map = build_struct_slot_map(ctx, &layout).map_err(anyhow_to_pliron)?;
+
+    let carrier_is_packed = {
+        let carrier_ref = carrier_source_ty.deref(ctx);
+        carrier_ref
+            .downcast_ref::<StructType>()
+            .is_some_and(|ty| ty.layout() == StructLayout::Packed)
+    };
+    if !carrier_is_packed {
+        return pliron::input_err_noloc!(
+            "packed-AS3 carrier field projection was stamped with a non-packed physical source type"
+        );
+    }
+
+    let slot = match map.decl_to_llvm.get(field_index) {
+        Some(Some(slot)) => *slot,
+        Some(None) => {
+            // Match the ordinary field-address contract for stripped ZSTs: a
+            // distinct zero-offset byte GEP keeps value identity unambiguous.
+            use llvm_export::ops::GepIndex;
+            let ptr = op.deref(ctx).get_operand(0);
+            let i8_ty: TypeHandle = IntegerType::get(ctx, 8, Signedness::Signless).into();
+            let gep = llvm::GetElementPtrOp::new(ctx, ptr, vec![GepIndex::Constant(0)], i8_ty);
+            rewriter.insert_operation(ctx, gep.get_operation());
+            rewriter.replace_operation(ctx, op, gep.get_operation());
+            return Ok(());
+        }
+        None => {
+            return pliron::input_err_noloc!(
+             
```

**File**: `crates/mir-lower/src/convert/ops/aggregate/mod.rs` (modified, +3/-1)
```diff
@@ -38,6 +38,7 @@
 
 mod addressing;
 mod array_extract;
+mod carrier_field_addr;
 mod common;
 mod construct;
 mod enum_layout;
@@ -46,8 +47,9 @@ mod fields;
 #[cfg(test)]
 mod test_support;
 
-pub(crate) use addressing::{convert_array_element_addr, convert_field_addr};
+pub(crate) use addressing::convert_array_element_addr;
 pub(crate) use array_extract::convert_extract_array_element;
+pub(crate) use carrier_field_addr::convert_field_addr;
 pub(crate) use construct::{
     convert_construct_array, convert_construct_disjoint_slice, convert_construct_slice,
     convert_construct_struct, convert_construct_tuple,
```

**File**: `crates/mir-lower/src/convert/ops/memory/access.rs` (modified, +55/-18)
```diff
@@ -10,7 +10,9 @@ use super::common::{
     pointer_proved_alignment, value_abi_align, value_mir_type,
 };
 use super::debug::copy_debug_local_variable;
+use crate::convert::target_stable_storage::coerce_target_stable_value;
 use crate::convert::types::{convert_type, mir_type_abi_align};
+use crate::packed_shared_local_storage::carrier_storage_type;
 use dialect_mir::types::MirPtrType;
 use llvm_export::attributes::GepNoWrapFlags;
 use llvm_export::op_interfaces::VolatilityOpInterface;
@@ -45,16 +47,31 @@ pub(crate) fn convert_store(
         }
     };
 
-    // Packed whole-value stores are byte-faithful now that divergent rustc
-    // layouts lower to LLVM packed structs. Keep the target-dependent AS3 case
-    // fail-closed because its physical pointer width is selected only later.
-    fail_on_target_dependent_packed_aggregate(
-        ctx,
-        value_mir_type(ctx, operands_info, val),
-        "storing",
-    )?;
+    let stored_val = if let Some(storage_ty) = carrier_storage_type(ctx, op) {
+        // Carrier identity was proven on MIR before conversion. Convert exactly
+        // at the memory boundary; never rediscover storage provenance from the
+        // converted pointer or its defining operation.
+        coerce_target_stable_value(
+            ctx,
+            rewriter,
+            val,
+            storage_ty,
+            "packed shared carrier-local store",
+        )?
+    } else {
+        // Packed whole-value stores are byte-faithful now that divergent rustc
+        // layouts lower to LLVM packed structs. Keep the target-dependent AS3
+        // case fail-closed for arbitrary memory; only pre-proven carrier-local
+        // accesses are exempt.
+        fail_on_target_dependent_packed_aggregate(
+            ctx,
+            value_mir_type(ctx, operands_info, val),
+            "storing",
+        )?;
+        val
+    };
 
-    let llvm_store = llvm::StoreOp::new(ctx, val, ptr);
+    let llvm_store = llvm::StoreOp::new(ctx, stored_val, ptr);
     if dialect_mir::ops::MirStoreOp::new(op).is_volatile(ctx) {
         llvm_store.set_volatile(ctx, true);
     }
@@ -94,15 +111,19 @@ pub(crate) fn convert_load(
 ) -> Result<()> {
     let ptr = op.deref(ctx).get_operand(0);
     let result_ty = op.deref(ctx).get_result(0).get_type(ctx);
+    let semantic_llvm_ty = convert_type(ctx, result_ty).map_err(anyhow_to_pliron)?;
 
-    // Packed whole-value loads are byte-faithful now that divergent rustc
-    // layouts lower to LLVM packed structs. Keep only the target-dependent AS3
-    // physical-image case fail-closed.
-    fail_on_target_dependent_packed_aggregate(ctx, result_ty, "loading")?;
-
-    let llvm_ty = convert_type(ctx, result_ty).map_err(anyhow_to_pliron)?;
+    let storage_ty = if let Some(storage_ty) = carrier_storage_type(ctx, op) {
+        storage_ty
+    } else {
+        // Packed whole-value loads are byte-faithful now that divergent rustc
+        // layouts lower to LLVM packed structs. Keep only the target-dependent
+        // AS3 physical-image case fail-closed for arbitrary memory.
+        fail_on_target_dependent_packed_aggregate(ctx, result_ty, "loading")?;
+        semantic_llvm_ty
+    };
 
-    let llvm_load = llvm::LoadOp::new(ctx, ptr, llvm_ty);
+    let llvm_load = llvm::LoadOp::new(ctx, ptr, storage_ty);
     if dialect_mir::ops::MirLoadOp::new(op).is_volatile(ctx) {
         llvm_load.set_volatile(ctx, true);
     }
@@ -125,7 +146,20 @@ pub(crate) fn convert_load(
         llvm_export::ops::set_op_alignment(ctx, llvm_load.get_operation(), align as u32);
     }
     rewriter.insert_operation(ctx, llvm_load.get_operation());
-    rewriter.replace_operation(ctx, op, llvm_load.get_operation());
+
+    if storage_ty == semantic_llvm_ty {
+        rewriter.replace_operation(ctx, op, llvm_load.get_operation());
+    } else {
+        let physical_value = llvm_load.get_operation().deref(ctx).get_result(0);
+        let semantic_value = coerce_target_stable_value(
+   
```

**File**: `crates/mir-lower/src/lib.rs` (modified, +6/-0)
```diff
@@ -128,6 +128,7 @@ pub mod conversion_interface;
 pub mod convert;
 pub mod helpers;
 pub mod lowering;
+mod packed_shared_local_storage;
 pub mod scalarize_block_args;
 pub mod type_conversion_interface;
 mod wgmma_deferred_accumulator;
@@ -409,6 +410,11 @@ pub fn lower_mir_to_llvm_with_options(
     // every kernel-to-helper requirement while the complete MIR call graph is
     // still available; function conversion removes that graph incrementally.
     lowering::propagate_kernel_dynamic_shared_alignments(ctx, module_op);
+    // Prove the complete address-use path for every narrow packed-AS3 carrier
+    // local immediately before conversion. The resulting per-op TypeAttrs are
+    // lowering capabilities, not inferred provenance: calls, block arguments,
+    // casts, nested projections, returns, and unknown uses fail closed here.
+    packed_shared_local_storage::prepare_packed_shared_local_storage(ctx, module_op)?;
     let mut conversion = MirToLlvmConversionDriver {
         shared_globals: FxHashMap::default(),
         device_globals: FxHashMap::default(),
```

**File**: `crates/mir-lower/src/packed_shared_local_storage.rs` (added, +623/-0)
```diff
@@ -0,0 +1,623 @@
+/*
+ * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+//! Verified lowering facts for the narrow packed-AS3 local-storage lane.
+//!
+//! The physical carrier representation is a storage property, not Rust pointer
+//! provenance. This module therefore does not extend `MirPointerKind`. Instead,
+//! immediately before dialect conversion it performs a closed-world walk over
+//! MIR, proves every use of an eligible compiler-owned local address, and only
+//! after the complete proof succeeds stamps the exact physical LLVM type on the
+//! MIR operations that consume the address.
+//!
+//! No lowering converter reconstructs carrier identity from `OperandsInfo` or
+//! from an LLVM defining-op chain. If a carrier address crosses a call, cast,
+//! block-argument edge, return, pointer offset, nested projection, or any other
+//! unmodelled operation, preparation fails before any MIR operation is lowered.
+
+use crate::convert::target_stable_storage::{StorageRewriteOptions, target_stable_storage_type};
+use crate::convert::types::{
+    PackedSharedInternalAbiInfo, StructLayoutInfo, build_struct_slot_map, convert_type,
+    is_zero_sized_type, packed_shared_internal_abi_info,
+};
+use dialect_mir::ops::{
+    MirAllocaOp, MirArrayElementAddrOp, MirAssertOp, MirCallOp, MirCastOp, MirCondBranchOp,
+    MirDbgValueListOp, MirDbgValueOp, MirFieldAddrOp, MirGotoOp, MirLoadOp, MirPtrOffsetOp,
+    MirReturnOp, MirStoreOp,
+};
+use dialect_mir::types::{MirPtrType, MirStructType};
+use llvm_export::types as llvm_types;
+use pliron::builtin::attributes::TypeAttr;
+use pliron::builtin::types::{FP32Type, FP64Type, IntegerType};
+use pliron::context::{Context, Ptr};
+use pliron::identifier::Identifier;
+use pliron::linked_list::ContainsLinkedList;
+use pliron::operation::Operation;
+use pliron::result::Result;
+use pliron::r#type::{TypeHandle, Typed};
+use pliron::value::Value;
+use rustc_hash::FxHashMap;
+
+const CARRIER_STORAGE_TYPE_KEY: &str = "cuda_oxide_packed_shared_carrier_storage_type";
+const CARRIER_GEP_SOURCE_TYPE_KEY: &str = "cuda_oxide_packed_shared_carrier_gep_source_type";
+
+#[derive(Clone, Copy, Debug)]
+struct CarrierAddress {
+    physical_pointee: TypeHandle,
+    projection_depth: u8,
+}
+
+#[derive(Default)]
+struct CarrierFactPlan {
+    storage_types: Vec<(Ptr<Operation>, TypeHandle)>,
+    gep_source_types: Vec<(Ptr<Operation>, TypeHandle)>,
+}
+
+impl CarrierFactPlan {
+    fn plan_storage_type(&mut self, operation: Ptr<Operation>, ty: TypeHandle) {
+        self.storage_types.push((operation, ty));
+    }
+
+    fn plan_gep_source_type(&mut self, operation: Ptr<Operation>, ty: TypeHandle) {
+        self.gep_source_types.push((operation, ty));
+    }
+
+    fn apply(self, ctx: &mut Context) {
+        for (operation, ty) in self.storage_types {
+            set_type_attr(ctx, operation, CARRIER_STORAGE_TYPE_KEY, ty);
+        }
+        for (operation, ty) in self.gep_source_types {
+            set_type_attr(ctx, operation, CARRIER_GEP_SOURCE_TYPE_KEY, ty);
+        }
+    }
+}
+
+fn attr_key(name: &str) -> Identifier {
+    Identifier::try_new(name.to_string()).expect("static carrier attribute key must be valid")
+}
+
+fn get_type_attr(ctx: &Context, op: Ptr<Operation>, name: &str) -> Option<TypeHandle> {
+    op.deref(ctx)
+        .attributes
+        .get::<TypeAttr>(&attr_key(name))
+        .map(|attr| attr.get_type(ctx))
+}
+
+fn set_type_attr(ctx: &mut Context, op: Ptr<Operation>, name: &str, ty: TypeHandle) {
+    op.deref_mut(ctx)
+        .attributes
+        .set(attr_key(name), TypeAttr::new(ty));
+}
+
+/// Physical storage type proven for `mir.alloca`, `mir.load`, or `mir.store`.
+///
+/// The attribute is created only by [`prepare_packed_shared_local_storage`]
+/// after the complete whole-tree carrier plan validates, then is consumed
+/// mechanically during lowering.
+pub(crate) fn ca
```

---

### Incident Patch 9: `c08a986f` (2026-09-24)
**Commit Message**: fix: verify mapped images through procfs

Signed-off-by: 0xOsiris <djosiris@proton.me>

**File**: `crates/cuda-host/src/embedded/mapped_image.rs` (modified, +84/-9)
```diff
@@ -7,9 +7,10 @@
 //! through an unbounded raw pointer. Procfs supplies the mapped file's identity;
 //! metadata validation and artifact reads use the same open file description.
 
-use std::fs::{self, OpenOptions};
+use std::fs::{self, File, OpenOptions};
 use std::io::{self, Read};
-use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
+use std::os::fd::AsRawFd;
+use std::os::unix::fs::OpenOptionsExt;
 use std::path::Path;
 
 #[derive(Debug)]
@@ -81,19 +82,46 @@ fn mapping_at<'a>(maps: &'a [u8], address: usize) -> io::Result<Mapping<'a>> {
     ))
 }
 
+fn mapped_identity_matches(file: &File, mapping: &Mapping<'_>) -> io::Result<bool> {
+    // SAFETY: the descriptor stays open and no references to the mapping are created.
+    let address = unsafe {
+        libc::mmap(
+            std::ptr::null_mut(),
+            1,
+            libc::PROT_NONE,
+            libc::MAP_PRIVATE,
+            file.as_raw_fd(),
+            0,
+        )
+    };
+    if address == libc::MAP_FAILED {
+        return Err(io::Error::last_os_error());
+    }
+    let result = fs::read("/proc/self/maps").and_then(|maps| {
+        let probe = mapping_at(&maps, address.addr())?;
+        if (probe.major, probe.minor, probe.inode) != (mapping.major, mapping.minor, mapping.inode)
+        {
+            return Ok(false);
+        }
+        // Btrfs subvolumes can share procfs device and inode numbers.
+        let map_files = Path::new("/proc/self/map_files");
+        Ok(fs::read_link(map_files.join(probe.range))?
+            == fs::read_link(map_files.join(mapping.range))?)
+    });
+    // SAFETY: this releases only the successful mapping above, including on read errors.
+    unsafe { libc::munmap(address, 1) };
+    result
+}
+
 fn read_verified(path: &Path, mapping: &Mapping<'_>) -> io::Result<Vec<u8>> {
     // A pathname can change after map_files was read. Avoid blocking on a
     // replaced FIFO before its type and identity can be checked below.
     let mut file = OpenOptions::new()
         .read(true)
         .custom_flags(libc::O_NONBLOCK | libc::O_NOFOLLOW)
         .open(path)?;
-    let metadata = file.metadata()?;
-    if !metadata.is_file()
-        || metadata.ino() != mapping.inode
-        || u64::from(libc::major(metadata.dev())) != mapping.major
-        || u64::from(libc::minor(metadata.dev())) != mapping.minor
-    {
+    // Compare both file identities through procfs; stat can report different IDs.
+    if !file.metadata()?.is_file() || !mapped_identity_matches(&file, mapping)? {
         return Err(invalid(
             "artifact image no longer identifies the mapped file",
         ));
@@ -120,6 +148,7 @@ mod tests {
     use oxide_artifacts::{ArtifactBundleSpec, ArtifactPayloadKind, ArtifactPayloadSpec};
     use std::ffi::OsStr;
     use std::os::unix::ffi::OsStrExt;
+    use std::os::unix::fs::MetadataExt;
     use std::process::Command;
     use std::time::{SystemTime, UNIX_EPOCH};
 
@@ -159,6 +188,28 @@ mod tests {
         );
     }
 
+    #[test]
+    fn opened_file_mapping_preserves_device_and_inode_checks() {
+        static ANCHOR: u8 = 0;
+        let maps = fs::read("/proc/self/maps").unwrap();
+        let mut mapping = mapping_at(&maps, std::ptr::from_ref(&ANCHOR).addr()).unwrap();
+        let path = std::env::current_exe().unwrap();
+        let file = File::open(&path).unwrap();
+        assert!(mapped_identity_matches(&file, &mapping).unwrap());
+        mapping.major ^= 1;
+        assert!(!mapped_identity_matches(&file, &mapping).unwrap());
+        assert_eq!(
+            read_verified(&path, &mapping).unwrap_err().kind(),
+            io::ErrorKind::InvalidData
+        );
+        mapping.major ^= 1;
+        mapping.minor ^= 1;
+        assert!(!mapped_identity_matches(&file, &mapping).unwrap());
+        mapping.minor ^= 1;
+        mapping.inode ^= 1;
+        assert!(!mapped_identity_matches(&file, &mapping).unwrap());
+    }
+
     #[test]
     fn shared_library_discovery() {
         co
```

---

### Incident Patch 10: `a11b6089` (2026-09-19)
**Commit Message**: fix(cuda-host): renumber debug file indices when merging PTX bundles

Debug .file indices are per-module sequence numbers starting at 1, so
two lineinfo/debug bundles both declare .file 1 and the concatenated
module is rejected: ptxas fatal, "Duplicate file index". Every
merged lineinfo or debug build fails to load.

Shift each appended bundle's .file declarations and .loc references
(including inlined_at) past the running maximum index, in the same
ptx_parse pass that strips the bundle's header directives. The first
bundle keeps its indices; bundles without debug info are unaffected.

Fixes #1292.

Signed-off-by: Navneet Kumar <4686373+navneet83@users.noreply.github.com>

**File**: `crates/cuda-host/src/embedded.rs` (modified, +174/-25)
```diff
@@ -162,6 +162,12 @@ pub fn merge_ptx_bundles<'a>(
     let mut merged = String::new();
     let mut found_any = false;
 
+    // Debug `.file` indices are per-module sequence numbers starting at 1,
+    // so concatenated lineinfo/debug bundles redeclare each other's indices
+    // and ptxas rejects the module ("Duplicate file index"). Each appended
+    // bundle's indices are shifted past the running maximum (#1292).
+    let mut file_index_offset = 0;
+
     for bundle in bundles {
         if let Some(ptx_bytes) = bundle.payload(ArtifactPayloadKind::Ptx) {
             let ptx_str = std::str::from_utf8(ptx_bytes)
@@ -170,24 +176,20 @@ pub fn merge_ptx_bundles<'a>(
                 })?
                 .trim_end_matches('\0');
 
-            if !found_any {
-                merged.push_str(ptx_str);
-                merged.push('\n');
-                found_any = true;
-            } else {
-                // Strip per-file header directives; only one set is valid in a
-                // concatenated PTX module.
-                let body = strip_ptx_module_headers(ptx_str).map_err(|reason| {
-                    EmbeddedModuleError::InvalidPtx {
+            let strip_headers = found_any;
+            let (body, max_file_index) =
+                prepare_bundle_body(ptx_str, strip_headers, file_index_offset).map_err(
+                    |reason| EmbeddedModuleError::InvalidPtx {
                         name: bundle.name.clone(),
                         reason,
-                    }
-                })?;
-                merged.push_str(&body);
-                if !body.ends_with('\n') {
-                    merged.push('\n');
-                }
+                    },
+                )?;
+            file_index_offset = file_index_offset.max(max_file_index);
+            merged.push_str(&body);
+            if !body.ends_with('\n') {
+                merged.push('\n');
             }
+            found_any = true;
         }
     }
 
@@ -197,19 +199,98 @@ pub fn merge_ptx_bundles<'a>(
     Ok(merged)
 }
 
-fn strip_ptx_module_headers(ptx: &str) -> Result<String, String> {
+/// Rewrite one bundle's PTX for concatenation: strip the per-file header
+/// directives (`.version`/`.target`/`.address_size`) unless this is the first
+/// bundle, and shift every debug file index (`.file` declarations, `.loc`
+/// references, and `.loc ... inlined_at` references) by `file_index_offset`.
+///
+/// Returns the rewritten text and the highest file index it declares or
+/// references after shifting, so the caller can offset the next bundle past
+/// it. Bundles without debug info report `0` and are unaffected.
+fn prepare_bundle_body(
+    ptx: &str,
+    strip_headers: bool,
+    file_index_offset: u64,
+) -> Result<(String, u64), String> {
     let document = ptx_parse::Document::parse(ptx).map_err(|error| error.to_string())?;
     let mut edits = ptx_parse::EditScript::new();
-    for directive in document
-        .directives()
-        .iter()
-        .filter(|directive| matches!(directive.name(), ".version" | ".target" | ".address_size"))
-    {
+    let mut max_file_index = 0u64;
+
+    for directive in document.directives() {
+        match directive.name() {
+            ".version" | ".target" | ".address_size" if strip_headers => {
+                edits
+                    .delete(directive.line_span())
+                    .map_err(|error| error.to_string())?;
+            }
+            // `.file <index> "path"[, timestamp, size]`
+            ".file" => {
+                let index = shift_file_index(
+                    &mut edits,
+                    directive.arguments(),
+                    directive.arguments_span().start,
+                    0,
+                    file_index_offset,
+                )?;
+                max_file_index = max_file_index.max(index);
+            }
+            // `.loc <index> <line> <column>[, function_name f, inlined_at
+            // <index> <line> <column>]` — both in
```

#### Recent Merged Pull Requests:
- **PR #1362** (2026-09-29): ci: increase CodeQL analysis timeout (@roivanov)
- **PR #1347** (closed): mir-lower: avoid emitting same-width llvm.trunc in shift lowering (@amansahani)
- **PR #1339** (closed): bench(cuda-device): add paired warp reduction measurements (@0z5a)
- **PR #1327** (2026-09-24): fix(mir-lower): support packed AS3 carrier local projections (@uurl)
- **PR #1326** (2026-09-24): fix(cuda-host): handle Btrfs mapped file identities (@0xOsiris)
- **PR #1324** (2026-09-24): refactor(llvm): use upstream function and call attributes (@uurl)
- **PR #1322** (2026-09-24): fix(cuda-host): renumber debug file indices when merging PTX bundles (@navneet83)
- **PR #1321** (2026-09-24): feat(unroll): recognize an exit test that adds a constant to the counter (@midagedev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
