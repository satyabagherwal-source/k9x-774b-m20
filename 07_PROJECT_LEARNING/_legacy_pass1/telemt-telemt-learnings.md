# Forensic Learning Record (Deep Inspection): telemt/telemt

> **Canonical Artifact**: `07_PROJECT_LEARNING/telemt-telemt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/telemt/telemt](https://github.com/telemt/telemt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:10.360Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `telemt/telemt`
- **Description**: MTProxy for Telegram on Rust + Tokio
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5706 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/crypto_bench.rs`
```
use criterion::{Criterion, criterion_group, criterion_main};
use std::hint::black_box;

#[allow(unused_imports)]
#[path = "../src/crypto/aes.rs"]
mod aes_impl;
#[allow(unused_imports)]
#[path = "../src/error.rs"]
mod error;

use aes_impl::AesCtr;

fn bench_aes_ctr(c: &mut Criterion) {
    c.bench_function("aes_ctr_encrypt_64kb", |b| {
        let data = vec![0u8; 65536];
        b.iter(|| {
            let mut enc = AesCtr::new(&[0u8; 32], 0);
            black_box(enc.encrypt(black_box(data.as_slice())))
        })
    });
}

criterion_group!(benches, bench_aes_ctr);
criterion_main!(benches);

```

### Core Architecture Module: `benches/web_decoy_fasttrack.rs`
```
use std::hint::black_box;
use std::sync::atomic::{AtomicU64, Ordering};

use base64::Engine as _;
use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};

#[allow(dead_code)]
#[path = "../src/web/http/capability.rs"]
mod capability;

fn capability_at(index: usize) -> [u8; 32] {
    let mut capability = [0xa5u8; 32];
    capability[..8].copy_from_slice(&(index as u64).to_le_bytes());
    capability
}

fn consume_scan(scan: capability::CapabilityScan) {
    black_box(scan.matched.unwrap_u8());
    black_box(scan.matched_index);
}

fn bench_decoy_fasttrack(c: &mut Criterion) {
    for profile_count in [1usize, 32, 256, 1024] {
        let capabilities = (0..profile_count).map(capability_at).collect::<Vec<_>>();
        let miss = [0x5au8; 32];
        let first = capabilities[0];
        let middle = capabilities[profile_count / 2];
        let last = capabilities[profile_count - 1];
        let telemetry = AtomicU64::new(0);
        let mut group = c.benchmark_group(format!("web_decoy_fasttrack/{profile_count}"));

        group.bench_function(BenchmarkId::new("ordinary_enforce", profile_count), |b| {
            b.iter(|| {
                let candidate = capability::bridge_candidate(black_box(None));
                telemetry.fetch_add(1, Ordering::Relaxed);
                black_box(candidate.is_canonical());
            });
        });
        group.bench_function(BenchmarkId::new("ordinary_shadow", profile_count), |b| {
            b.iter(|| {
                let candidate = capability::bridge_candidate(black_box(None));
                telemetry.fetch_add(1, Ordering::Relaxed);
                consume_scan(capability::scan_capabilities(
                    black_box(&capabilities),
                    candidate.scan_bytes(),
                ));
            });
        });
        for (name, candidate) in [
            ("canonical_miss", miss),
            ("canonical_hit_first", first),
            ("canonical_hit_middle", middle),
            ("canonical_hit_last", last),
        ] {
            let token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(candidate);
            let query = format!("bridge={token}");
            group.bench_function(BenchmarkId::new(name, profile_count), |b| {
                b.iter(|| {
                    let candidate = capability::bridge_candidate(black_box(Some(&query)));
                    telemetry.fetch_add(1, Ordering::Relaxed);
                    consume_scan(capability::scan_capabilities(
                        black_box(&capabilities),
                        candidate.scan_bytes(),
                    ));
                });
            });
        }
        group.finish();
    }
}

criterion_group!(benches, bench_decoy_fasttrack);
criterion_main!(benches);

```

### Core Architecture Module: `src/api/config_edit.rs`
```
//! Config-editing API: read managed sections and apply sparse field patches.
//! `access.*` is intentionally not editable here (owned by the users API).
//! `[server]` is only partially editable — see [`EDITABLE_SERVER_FIELDS`].

use serde_json::Value as Json;
use toml::Value as Toml;

use super::ApiShared;
#[cfg(test)]
use super::config_store::write_atomic;
use super::config_store::{
    EDITABLE_SECTIONS, EDITABLE_SERVER_FIELDS, compute_snapshot_revision, is_editable_section,
    load_candidate_snapshot, load_config_snapshot, render_server_listeners,
    render_top_level_section, resolve_single_source_owner, upsert_toml_table,
    write_atomic_if_unchanged,
};
use super::model::ApiFailure;
use crate::config::ProxyConfig;
use crate::config::hot_reload::classify_config_changes;
use crate::maestro::reload::{ReloadAccepted, ReloadRequest, ReloadSubmitError};
use crate::maestro::runtime_build::{
    ResolvedReloadConfig, deferred_process_fields, resolve_reload_config,
};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// Result of one validated managed-config mutation.
#[derive(Debug, Serialize)]
pub(super) struct PatchConfigResponse {
    /// Revision of the persisted desired configuration.
    pub revision: String,
    /// Whether any changed field is not hot-reloadable.
    pub restart_required: bool,
    /// Whether the effective runtime snapshot must be reloaded.
    pub runtime_reload_required: bool,
    /// Whether any desired field remains deferred until process restart.
    pub process_restart_required: bool,
    /// Stable paths of desired fields retained from the active process.
    pub deferred_process_fields: Vec<String>,
    /// Top-level managed sections changed by the mutation.
    pub changed: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    /// Accepted runtime reload when one was requested and required.
    pub reload: Option<ReloadAccepted>,
}

struct PreparedConfigPatch {
    config_path: PathBuf,
    expected_revision: String,
    owner_path: PathBuf,
    expected_owner_contents: String,
    owner_contents: String,
    desired_config: Arc<ProxyConfig>,
    response: PatchConfigResponse,
}

/// Serializes config mutations behind `mutation_lock`, commits them, and records
/// a runtime event. The route handler calls this shared-state wrapper.
pub(super) async fn patch_config(
    patch_json: Json,
    expected_revision: Option<String>,
    reload_request: Option<ReloadRequest>,
    shared: &ApiShared,
) -> Result<PatchConfigResponse, ApiFailure> {
    let shared = shared.clone();
    shared
        .clone()
        .run_mutation_completion(async move {
            patch_config_to_completion(patch_json, expected_revision, reload_request, &shared).await
        })
        .await
}

async fn patch_config_to_completion(
    patch_json: Json,
    expected_revision: Option<String>,
    reload_request: Option<ReloadRequest>,
    shared: &ApiShared,
) -> Result<PatchConfigResponse, ApiFailure> {
    let _guard = shared.mutation_lock.lock().await;
    let active_config = shared.active_runtime.load_full().config();
    let mut prepared =
        prepare_patch_to_path(&shared.config_path, &patch_json, expected_revision).await?;
    let resolved = reconcile_runtime_effect(
        &mut prepared.response,
        &active_config,
        &prepared.desired_config,
    )?;
    let reservation = if let Some(request) = reload_request.filter(|_| resolved.runtime_changed) {
        Some(
            shared
                .reload_control
                .reserve(prepared.response.revision.clone(), request)
                .await
                .map_err(reload_submit_failure)?,
        )
    } else {
        None
    };
    prepared.response.revision = write_atomic_if_unchanged(
        prepared.config_path,
        prepared.expected_revision,
        prepared.owner_path,
        prepared.expected_owner_contents,
        prepared.owner_contents,
    )
    .await?;
    if let Some(reservation) = reservation {
        prepared.response.reload = Some(reservation.enqueue(prepared.desired_config));
    }
    let resp = prepared.response;
    drop(_guard);
    shared
        .runtime_events
        .record("api.config.patch.ok", format!("changed={:?}", resp.changed));
    Ok(resp)
}

fn reconcile_runtime_effect(
    response: &mut PatchConfigResponse,
    active_config: &ProxyConfig,
    desired_config: &ProxyConfig,
) -> Result<ResolvedReloadConfig, ApiFailure> {
    let resolved =
        resolve_reload_config(active_config, desired_config).map_err(ApiFailure::bad_request)?;
    response.runtime_reload_required = resolved.runtime_changed;
    response.process_restart_required = !resolved.deferred_process_fields.is_empty();
    response.deferred_process_fields = resolved.deferred_process_fields.clone();
    Ok(resolved)
}

/// Core patch logic, decoupled from hyper/shared-state so it is unit-testable
/// against a temp file. The route handler holds `mutation_lock` while calling this.
#[cfg(test)]
pub(super) async fn apply_patch_to_path(
    config_path: &Path,
    patch_json: &Json,
    expected_revision: Option<String>,
) -> Result<PatchConfigResponse, ApiFailure> {
    let mut prepared = prepare_patch_to_path(config_path, patch_json, expected_revision).await?;
    let revision = write_atomic_if_unchanged(
        prepared.config_path,
        prepared.expected_revision,
        prepared.owner_path,
        prepared.expected_owner_contents,
        prepared.owner_contents,
    )
    .await?;
    prepared.response.revision = revision;
    Ok(prepared.response)
}

async fn prepare_patch_to_path(
    config_path: &Path,
    patch_json: &Json,
    expected_revision: Option<String>,
) -> Result<PreparedConfigPatch, ApiFailure> {
    // 1. optimistic concurrency
    let loaded = load_config_snapshot(config_path, false).await?;
    let current = compute_snapshot_revision(&loaded);
    if expected_revision.is_some_and(|expected| expected != current) {
        return Err(ApiFailure::new(
            hyper::StatusCode::CONFLICT,
            "revision_conflict",
            "Config revision mismatch",
        ));
    }

    // 2. convert + reject access / unknown sections / forbidden server fields
    let patch_toml = json_to_toml(patch_json)
        .map_err(|e| ApiFailure::bad_request(format!("invalid patch: {}", e)))?;
    let patch_table = patch_toml
        .as_table()
        .ok_or_else(|| ApiFailure::bad_request("patch must be a JSON object"))?;
    if patch_table.contains_key("access") {
        return Err(ApiFailure::new(
            hyper::StatusCode::BAD_REQUEST,
            "access_not_editable",
            "access.* is managed via the users API, not editable here",
        ));
    }
    for (key, value) in patch_table {
        if !is_editable_section(key.as_str()) {
            return Err(ApiFailure::new(
                hyper::StatusCode::BAD_REQUEST,
                "section_not_editable",
                format!("section not editable: {}", key),
            ));
        }
        if key == "server" {
            validate_server_patch(value)?;
        }
    }
    let touched: Vec<&str> = patch_table
        .keys()
        .map(|k| k.as_str())
        .filter(|k| is_editable_section(k))
        .collect();
    if touched.is_empty() {
        return Err(ApiFailure::bad_request("empty patch: no editable sections"));
    }

    // 3. Merge against the fully expanded and normalized desired config. The
    // source owner is resolved separately so included sections stay in their
    // original file and unrelated source files remain byte-identical.
    let old_cfg = loaded.config.clone();
    let mut merged = Toml::try_from(&old_cfg)
        .map_err(|e| ApiFailure::internal(format!("failed to serialize config: {}", e)))?;
    deep_merge(&mut merged, &patch_toml);

    let requested_cfg: ProxyConfig = merged
        .clone()
        .try_into()
        .map_err(|e| ApiFailure::bad_request(format!("config
```

### Core Architecture Module: `src/api/config_store.rs`
```
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use hyper::header::IF_MATCH;
use sha2::{Digest, Sha256};

use crate::config::{ConfigSourceGraph, LoadedConfig, ProxyConfig};

use super::model::ApiFailure;

// Source-preserving TOML rendering and atomic persistence helpers.
mod persistence;
// Compare-and-replace file persistence and metadata preservation.
mod atomic;

pub(in crate::api) use atomic::{write_atomic, write_atomic_if_unchanged};
#[cfg(test)]
use persistence::{find_toml_table_bounds, render_access_section, save_sections_to_disk};
pub(in crate::api) use persistence::{
    render_server_listeners, render_top_level_section, save_access_sections_to_disk,
    save_access_sections_to_disk_if_revision, upsert_toml_table,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum AccessSection {
    Users,
    UserEnabled,
    UserAdTags,
    UserMaxTcpConns,
    UserExpirations,
    UserDataQuota,
    UserRateLimits,
    UserMaxUniqueIps,
}

impl AccessSection {
    fn table_name(self) -> &'static str {
        match self {
            Self::Users => "access.users",
            Self::UserEnabled => "access.user_enabled",
            Self::UserAdTags => "access.user_ad_tags",
            Self::UserMaxTcpConns => "access.user_max_tcp_conns",
            Self::UserExpirations => "access.user_expirations",
            Self::UserDataQuota => "access.user_data_quota",
            Self::UserRateLimits => "access.user_rate_limits",
            Self::UserMaxUniqueIps => "access.user_max_unique_ips",
        }
    }
}

pub(super) fn parse_if_match(headers: &hyper::HeaderMap) -> Option<String> {
    headers
        .get(IF_MATCH)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.trim_matches('"').to_string())
}

/// Loads one mutation base and validates its revision from the same source snapshot.
pub(super) async fn load_config_for_mutation(
    config_path: &Path,
    expected_revision: Option<&str>,
) -> Result<(ProxyConfig, String), ApiFailure> {
    let loaded = load_config_snapshot(config_path, false).await?;
    let revision = compute_snapshot_revision(&loaded);
    if expected_revision.is_some_and(|expected| expected != revision) {
        return Err(ApiFailure::new(
            hyper::StatusCode::CONFLICT,
            "revision_conflict",
            "Config revision mismatch",
        ));
    }
    Ok((loaded.config, revision))
}

pub(super) async fn current_revision(config_path: &Path) -> Result<String, ApiFailure> {
    let config_path = config_path.to_path_buf();
    let graph = tokio::task::spawn_blocking(move || ProxyConfig::read_source_graph(config_path))
        .await
        .map_err(|error| ApiFailure::internal(format!("failed to join config reader: {error}")))?
        .map_err(|error| ApiFailure::internal(format!("failed to read config graph: {error}")))?;
    Ok(compute_source_revision(&graph))
}

pub(crate) async fn current_revision_for_maestro(config_path: &Path) -> Result<String, String> {
    let config_path = config_path.to_path_buf();
    tokio::task::spawn_blocking(move || ProxyConfig::read_source_graph(config_path))
        .await
        .map_err(|error| format!("failed to join config reader: {error}"))?
        .map(|graph| compute_source_revision(&graph))
        .map_err(|error| error.to_string())
}

pub(super) fn compute_revision(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

pub(super) fn compute_snapshot_revision(loaded: &LoadedConfig) -> String {
    compute_source_revision(&ConfigSourceGraph {
        source_contents: loaded.source_contents.clone(),
        rendered: String::new(),
    })
}

pub(super) fn compute_source_revision(graph: &ConfigSourceGraph) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"telemt-config-manifest-v1\0");
    for (path, content) in &graph.source_contents {
        let path = path.as_os_str().as_encoded_bytes();
        hasher.update((path.len() as u64).to_le_bytes());
        hasher.update(path);
        hasher.update((content.len() as u64).to_le_bytes());
        hasher.update(content.as_bytes());
    }
    hex::encode(hasher.finalize())
}

pub(super) async fn load_config_snapshot(
    config_path: &Path,
    invalid_is_bad_request: bool,
) -> Result<LoadedConfig, ApiFailure> {
    let config_path = config_path.to_path_buf();
    tokio::task::spawn_blocking(move || ProxyConfig::load_with_metadata(config_path))
        .await
        .map_err(|error| ApiFailure::internal(format!("failed to join config loader: {error}")))?
        .map_err(|error| {
            if invalid_is_bad_request {
                ApiFailure::bad_request(format!("invalid runtime config: {error}"))
            } else {
                ApiFailure::internal(format!("failed to load config: {error}"))
            }
        })
}

pub(super) fn resolve_single_source_owner(
    loaded: &LoadedConfig,
    config_path: &Path,
    targets: &[&str],
) -> Result<PathBuf, ApiFailure> {
    let root = normalize_source_path(config_path);
    let mut mutation_owners = BTreeSet::new();

    if loaded
        .source_contents
        .values()
        .any(|content| has_include_inside_table(content))
    {
        return Err(ApiFailure::new(
            hyper::StatusCode::CONFLICT,
            "config_patch_not_atomic",
            "config includes nested inside a TOML table cannot be mutated atomically",
        ));
    }

    for target in targets {
        let mut owners = BTreeSet::new();
        for (path, content) in &loaded.source_contents {
            let parsed: toml::Value = toml::from_str(content).map_err(|error| {
                ApiFailure::new(
                    hyper::StatusCode::CONFLICT,
                    "config_patch_not_atomic",
                    format!(
                        "config source {} is not independently writable: {error}",
                        path.display()
                    ),
                )
            })?;
            if toml_path_exists(&parsed, target) {
                owners.insert(path.clone());
            }
        }
        match owners.len() {
            0 => {
                mutation_owners.insert(root.clone());
            }
            1 => {
                mutation_owners.extend(owners);
            }
            _ => {
                return Err(ApiFailure::new(
                    hyper::StatusCode::CONFLICT,
                    "config_patch_not_atomic",
                    format!("config section {target} is owned by multiple source files"),
                ));
            }
        }
    }

    if mutation_owners.len() != 1 {
        return Err(ApiFailure::new(
            hyper::StatusCode::CONFLICT,
            "config_patch_not_atomic",
            "one mutation may update only one config source file",
        ));
    }
    mutation_owners
        .into_iter()
        .next()
        .ok_or_else(|| ApiFailure::bad_request("empty mutation: no owned config sections"))
}

fn toml_path_exists(value: &toml::Value, target: &str) -> bool {
    target
        .split('.')
        .try_fold(value, |current, part| current.get(part))
        .is_some()
}

fn has_include_inside_table(content: &str) -> bool {
    let mut inside_table = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            inside_table = true;
        }
        if inside_table
            && trimmed
                .strip_prefix("include")
                .is_some_and(|rest| rest.trim_start().starts_with('='))
        {
            return true;
        }
    }
    false
}

pub(super) async fn load_candidate_snapshot(
    config_path: &Path,
    base_sources: &BTreeMap<PathBuf, String>,
    owner_path: PathBuf,
    owner_contents: String,
) -> Result<LoadedConfig, ApiFailure> {
    let config_path = confi
```

### Core Architecture Module: `src/api/config_store/atomic.rs`
```
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::{MetadataExt, PermissionsExt};

#[cfg(unix)]
use nix::fcntl::{Flock, FlockArg, OFlag, openat, renameat};
#[cfg(unix)]
use nix::sys::stat::Mode;
#[cfg(unix)]
use nix::unistd::{UnlinkatFlags, fsync, unlinkat};
#[cfg(unix)]
use tracing::warn;

use super::compute_source_revision;
use crate::api::model::ApiFailure;
use crate::config::ProxyConfig;
#[cfg(unix)]
use crate::util::secure_fs::AnchoredPath;

const MAX_CONFIG_SOURCE_BYTES: u64 = 8 * 1024 * 1024;

enum AtomicWriteError {
    Conflict,
    ReadGraph(String),
    Io(std::io::Error),
}

struct ExistingTarget {
    contents: String,
    metadata: std::fs::Metadata,
}

struct GraphFence<'a> {
    config_path: &'a Path,
    expected_revision: &'a str,
}

struct ConfigWriteLock {
    #[cfg(unix)]
    _file: Flock<File>,
}

impl ConfigWriteLock {
    fn acquire(path: &Path) -> std::io::Result<Self> {
        let path = normalize_path(path);
        #[cfg(unix)]
        {
            let lock_path = sibling_lock_path(&path);
            let anchored = AnchoredPath::open_creating_parents(&lock_path, 0o750)?;
            let descriptor = openat(
                anchored.parent(),
                anchored.name(),
                OFlag::O_RDWR | OFlag::O_CREAT | OFlag::O_NOFOLLOW | OFlag::O_CLOEXEC,
                Mode::from_bits_truncate(0o600),
            )
            .map_err(errno_to_io)?;
            let file = File::from(descriptor);
            let metadata = file.metadata()?;
            if !metadata.is_file() || metadata.nlink() != 1 {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "config lock must be a regular file with one directory entry",
                ));
            }
            let file = Flock::lock(file, FlockArg::LockExclusive)
                .map_err(|(_, error)| errno_to_io(error))?;
            Ok(Self { _file: file })
        }
        #[cfg(not(unix))]
        {
            let _ = path;
            Ok(Self {})
        }
    }
}

/// Replaces one config source through a same-directory rename after syncing file data.
pub(in crate::api) async fn write_atomic(
    path: PathBuf,
    contents: String,
) -> Result<(), ApiFailure> {
    tokio::task::spawn_blocking(move || {
        let _lock = ConfigWriteLock::acquire(&path)?;
        write_atomic_sync(&path, None, &contents, None).map(|_| ())
    })
    .await
    .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
    .map_err(|error| ApiFailure::internal(format!("failed to write config: {error}")))
}

/// Replaces one source only if both its graph revision and owner contents are unchanged.
pub(in crate::api) async fn write_atomic_if_unchanged(
    config_path: PathBuf,
    expected_revision: String,
    path: PathBuf,
    expected_contents: String,
    contents: String,
) -> Result<String, ApiFailure> {
    tokio::task::spawn_blocking(move || {
        let config_path = normalize_path(&config_path);
        let path = normalize_path(&path);
        // Every API mutation locks the root source so writes to different includes serialize.
        let _lock = ConfigWriteLock::acquire(&config_path).map_err(AtomicWriteError::Io)?;
        let graph = ProxyConfig::read_source_graph(&config_path)
            .map_err(|error| AtomicWriteError::ReadGraph(error.to_string()))?;
        if compute_source_revision(&graph) != expected_revision {
            return Err(AtomicWriteError::Conflict);
        }
        write_atomic_sync(
            &path,
            Some(&expected_contents),
            &contents,
            Some(GraphFence {
                config_path: &config_path,
                expected_revision: &expected_revision,
            }),
        )
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                AtomicWriteError::Conflict
            } else {
                AtomicWriteError::Io(error)
            }
        })?
        .ok_or_else(|| {
            AtomicWriteError::Io(std::io::Error::other(
                "config graph fence did not produce a committed revision",
            ))
        })
    })
    .await
    .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
    .map_err(|error| match error {
        AtomicWriteError::Conflict => revision_conflict(),
        AtomicWriteError::ReadGraph(error) => {
            ApiFailure::internal(format!("failed to verify config graph: {error}"))
        }
        AtomicWriteError::Io(error) => {
            ApiFailure::internal(format!("failed to write config: {error}"))
        }
    })
}

fn revision_conflict() -> ApiFailure {
    ApiFailure::new(
        hyper::StatusCode::CONFLICT,
        "revision_conflict",
        "Config revision changed before persistence",
    )
}

fn sibling_lock_path(path: &Path) -> PathBuf {
    let mut name = path
        .file_name()
        .unwrap_or_else(|| std::ffi::OsStr::new("config.toml"))
        .to_os_string();
    name.push(".lock");
    path.parent().unwrap_or_else(|| Path::new(".")).join(name)
}

fn normalize_path(path: &Path) -> PathBuf {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map(|current| current.join(path))
            .unwrap_or_else(|_| path.to_path_buf())
    };
    let mut normalized = PathBuf::new();
    for component in absolute.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            component => normalized.push(component.as_os_str()),
        }
    }
    normalized
}

fn fenced_post_commit_revision(
    fence: GraphFence<'_>,
    path: &Path,
    contents: &str,
) -> std::io::Result<String> {
    let mut graph = ProxyConfig::read_source_graph(fence.config_path)
        .map_err(|error| std::io::Error::other(error.to_string()))?;
    if compute_source_revision(&graph) != fence.expected_revision {
        return Err(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            "config graph changed during persistence",
        ));
    }
    let path = normalize_path(path);
    let Some(owner) = graph.source_contents.get_mut(&path) else {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "config source owner left the source graph during persistence",
        ));
    };
    *owner = contents.to_string();
    Ok(compute_source_revision(&graph))
}

#[cfg(unix)]
fn open_existing_target(anchored: &AnchoredPath) -> std::io::Result<Option<ExistingTarget>> {
    let descriptor = match openat(
        anchored.parent(),
        anchored.name(),
        OFlag::O_RDONLY | OFlag::O_NONBLOCK | OFlag::O_NOFOLLOW | OFlag::O_CLOEXEC,
        Mode::empty(),
    ) {
        Ok(descriptor) => descriptor,
        Err(nix::errno::Errno::ENOENT) => return Ok(None),
        Err(error) => return Err(errno_to_io(error)),
    };
    let mut file = File::from(descriptor);
    let metadata = file.metadata()?;
    if !metadata.is_file() || metadata.nlink() != 1 || metadata.len() > MAX_CONFIG_SOURCE_BYTES {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "config target must be a bounded regular file with one directory entry",
        ));
    }
    let mut contents = String::with_capacity(metadata.len() as usize);
    Read::take(&mut file, MAX_CONFIG_SOURCE_BYTES + 1).read_to_string(&mut contents)?;
    if contents.len() as u64 > MAX_CONFIG_SOURCE_BYTES {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "config target exceeds the source size limit",
        ));
    }
    let completed = file.metadata()?;
    if !same_target(&metadata, &completed) || metadata.len() != completed
```

### Core Architecture Module: `src/api/config_store/persistence.rs`
```
use std::collections::BTreeMap;
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::config::{ProxyConfig, RateLimitBps};

#[cfg(test)]
use super::atomic::write_atomic;
use super::atomic::write_atomic_if_unchanged;
#[cfg(test)]
use super::compute_revision;
use super::{
    AccessSection, compute_snapshot_revision, load_candidate_snapshot, load_config_snapshot,
    resolve_single_source_owner, toml_path_exists,
};
use crate::api::model::ApiFailure;

/// Re-render the given top-level tables from `cfg` and upsert each into the
/// on-disk file, preserving every untouched section (and its comments).
#[cfg(test)]
pub(super) async fn save_sections_to_disk(
    config_path: &Path,
    cfg: &ProxyConfig,
    sections: &[&str],
) -> Result<String, ApiFailure> {
    let mut content = tokio::fs::read_to_string(config_path)
        .await
        .map_err(|e| ApiFailure::internal(format!("failed to read config: {}", e)))?;

    for section in sections {
        let rendered = render_top_level_section(cfg, section)?;
        content = upsert_toml_table(&content, section, &rendered);
    }

    write_atomic(config_path.to_path_buf(), content.clone()).await?;
    Ok(compute_revision(&content))
}

/// Render one top-level table as `[section]\n...\n` (or `[[upstreams]]` array
/// of tables) from the typed `cfg`. Serializes via the `toml` crate so the
/// output matches the canonical format Telemt parses.
pub(in crate::api) fn render_top_level_section(
    cfg: &ProxyConfig,
    section: &str,
) -> Result<String, ApiFailure> {
    let value = toml::Value::try_from(cfg)
        .map_err(|e| ApiFailure::internal(format!("failed to serialize config: {}", e)))?;
    let table = value
        .get(section)
        .ok_or_else(|| ApiFailure::internal(format!("unknown section: {}", section)))?;

    // upstreams is an array-of-tables -> render as [[upstreams]] blocks.
    if let toml::Value::Array(items) = table {
        let mut out = String::new();
        for item in items {
            out.push_str(&format!("[[{}]]\n", section));
            out.push_str(&toml::to_string(item).map_err(|e| {
                ApiFailure::internal(format!("failed to serialize {}: {}", section, e))
            })?);
            if !out.ends_with('\n') {
                out.push('\n');
            }
        }
        return Ok(out);
    }

    // Serialize the table *inside a wrapper keyed by `section`* so the `toml`
    // crate emits correctly dotted headers for nested sub-tables, e.g.
    // `[general]` + `[general.modes]` + `[general.links]`. Serializing the
    // inner table alone would render bare `[modes]`/`[links]` headers, which
    // would leak as duplicate top-level tables and break config load.
    let mut wrapper = toml::value::Table::new();
    wrapper.insert(section.to_string(), table.clone());
    let mut out = toml::to_string(&toml::Value::Table(wrapper))
        .map_err(|e| ApiFailure::internal(format!("failed to serialize {}: {}", section, e)))?;
    if !out.ends_with('\n') {
        out.push('\n');
    }
    Ok(out)
}

/// Renders normalized listener entries as nested array-of-table blocks.
pub(in crate::api) fn render_server_listeners(cfg: &ProxyConfig) -> Result<String, ApiFailure> {
    let mut out = String::new();
    for listener in &cfg.server.listeners {
        out.push_str("[[server.listeners]]\n");
        out.push_str(&toml::to_string(listener).map_err(|error| {
            ApiFailure::internal(format!("failed to serialize server.listeners: {error}"))
        })?);
        if !out.ends_with('\n') {
            out.push('\n');
        }
    }
    Ok(out)
}

/// Validates and atomically writes access tables to their single source owner.
pub(in crate::api) async fn save_access_sections_to_disk(
    config_path: &Path,
    cfg: &ProxyConfig,
    sections: &[AccessSection],
) -> Result<String, ApiFailure> {
    save_access_sections_to_disk_if_revision(config_path, cfg, sections, None).await
}

/// Persists access tables only while the complete source graph remains unchanged.
pub(in crate::api) async fn save_access_sections_to_disk_if_revision(
    config_path: &Path,
    cfg: &ProxyConfig,
    sections: &[AccessSection],
    expected_revision: Option<&str>,
) -> Result<String, ApiFailure> {
    let loaded = load_config_snapshot(config_path, false).await?;
    let loaded_revision = compute_snapshot_revision(&loaded);
    if expected_revision.is_some_and(|expected| expected != loaded_revision) {
        return Err(revision_conflict());
    }
    let mut applied = Vec::new();
    for section in sections {
        if applied.contains(section) {
            continue;
        }
        applied.push(*section);
    }
    applied.retain(|section| {
        !access_section_is_empty(cfg, *section)
            || loaded.source_contents.values().any(|contents| {
                toml::from_str::<toml::Value>(contents)
                    .ok()
                    .is_some_and(|value| toml_path_exists(&value, section.table_name()))
            })
    });
    if applied.is_empty() {
        return Ok(loaded_revision);
    }

    let targets = applied
        .iter()
        .map(|section| section.table_name())
        .collect::<Vec<_>>();
    let owner_path = resolve_single_source_owner(&loaded, config_path, &targets)?;
    let mut owner_contents = loaded
        .source_contents
        .get(&owner_path)
        .cloned()
        .ok_or_else(|| ApiFailure::internal("config source owner is missing from snapshot"))?;
    let expected_owner_contents = owner_contents.clone();
    for section in applied {
        let rendered = render_access_section(cfg, section)?;
        owner_contents = upsert_toml_table(&owner_contents, section.table_name(), &rendered);
    }

    let candidate = load_candidate_snapshot(
        config_path,
        &loaded.source_contents,
        owner_path.clone(),
        owner_contents.clone(),
    )
    .await?;
    let _candidate_revision = compute_snapshot_revision(&candidate);
    let revision = write_atomic_if_unchanged(
        config_path.to_path_buf(),
        loaded_revision,
        owner_path,
        expected_owner_contents,
        owner_contents,
    )
    .await?;
    Ok(revision)
}

/// Renders one access-control table for persistence tests and user mutations.
pub(super) fn render_access_section(
    cfg: &ProxyConfig,
    section: AccessSection,
) -> Result<String, ApiFailure> {
    let body = match section {
        AccessSection::Users => {
            let rows: BTreeMap<String, String> = cfg
                .access
                .users
                .iter()
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect();
            serialize_table_body(&rows)?
        }
        AccessSection::UserEnabled => {
            let rows: BTreeMap<String, bool> = cfg
                .access
                .user_enabled
                .iter()
                .map(|(key, value)| (key.clone(), *value))
                .collect();
            serialize_table_body(&rows)?
        }
        AccessSection::UserAdTags => {
            let rows: BTreeMap<String, String> = cfg
                .access
                .user_ad_tags
                .iter()
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect();
            serialize_table_body(&rows)?
        }
        AccessSection::UserMaxTcpConns => {
            let rows: BTreeMap<String, usize> = cfg
                .access
                .user_max_tcp_conns
                .iter()
                .map(|(key, value)| (key.clone(), *value))
                .collect();
            serialize_table_body(&rows)?
        }
        AccessSection::UserExpirations => {
            let rows: BTreeMap<String, DateTime<Utc>> = cfg
                .access
                .user_expirations
                .iter()
                .map(|(key, value)| (key.clone(), *value))
                .collect();
            
```

### Core Architecture Module: `src/api/events.rs`
```
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Clone, Serialize)]
pub(super) struct ApiEventRecord {
    pub(super) seq: u64,
    pub(super) ts_epoch_secs: u64,
    pub(super) event_type: String,
    pub(super) context: String,
}

#[derive(Clone, Serialize)]
pub(super) struct ApiEventSnapshot {
    pub(super) capacity: usize,
    pub(super) dropped_total: u64,
    pub(super) events: Vec<ApiEventRecord>,
}

struct ApiEventsInner {
    capacity: usize,
    dropped_total: u64,
    next_seq: u64,
    events: VecDeque<ApiEventRecord>,
}

/// Bounded ring-buffer for control-plane API/runtime events.
pub(crate) struct ApiEventStore {
    inner: Mutex<ApiEventsInner>,
}

impl ApiEventStore {
    pub(super) fn new(capacity: usize) -> Self {
        let bounded = capacity.max(16);
        Self {
            inner: Mutex::new(ApiEventsInner {
                capacity: bounded,
                dropped_total: 0,
                next_seq: 1,
                events: VecDeque::with_capacity(bounded),
            }),
        }
    }

    pub(super) fn record(&self, event_type: &str, context: impl Into<String>) {
        let now_epoch_secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let mut context = context.into();
        if context.len() > 256 {
            context.truncate(256);
        }

        let mut guard = self.inner.lock().expect("api event store mutex poisoned");
        if guard.events.len() == guard.capacity {
            guard.events.pop_front();
            guard.dropped_total = guard.dropped_total.saturating_add(1);
        }
        let seq = guard.next_seq;
        guard.next_seq = guard.next_seq.saturating_add(1);
        guard.events.push_back(ApiEventRecord {
            seq,
            ts_epoch_secs: now_epoch_secs,
            event_type: event_type.to_string(),
            context,
        });
    }

    pub(super) fn snapshot(&self, limit: usize) -> ApiEventSnapshot {
        let guard = self.inner.lock().expect("api event store mutex poisoned");
        let bounded_limit = limit.clamp(1, guard.capacity.max(1));
        let mut items: Vec<ApiEventRecord> = guard
            .events
            .iter()
            .rev()
            .take(bounded_limit)
            .cloned()
            .collect();
        items.reverse();

        ApiEventSnapshot {
            capacity: guard.capacity,
            dropped_total: guard.dropped_total,
            events: items,
        }
    }
}

```

### Core Architecture Module: `src/api/handler.rs`
```
use super::*;

// Read-only fixed API endpoints.
mod read_routes;
// Fixed configuration and lifecycle mutations.
mod fixed_routes;
// Dynamic reload and user-resource routes.
mod user_routes;

pub(super) async fn handle(
    req: Request<Incoming>,
    peer: SocketAddr,
    shared: Arc<ApiShared>,
) -> Result<Response<Full<Bytes>>, IoError> {
    let runtime = shared.active_runtime.load_full();
    let previous_cache_generation = shared.cache_generation.swap(runtime.id, Ordering::AcqRel);
    if previous_cache_generation != runtime.id {
        *shared.minimal_cache.lock().await = None;
        *shared.runtime_edge_connections_cache.lock().await = None;
    }
    let shared = Arc::new(shared.for_runtime(runtime.as_ref()));
    let config_rx = runtime.config_rx.clone();
    shared
        .runtime_state
        .admission_open
        .store(*runtime.admission_rx.borrow(), Ordering::Relaxed);
    let request_id = shared.next_request_id();
    let cfg = config_rx.borrow().clone();
    let api_cfg = &cfg.server.api;

    if !api_cfg.enabled {
        return Ok(error_response(
            request_id,
            ApiFailure::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "api_disabled",
                "API is disabled",
            ),
        ));
    }

    if !api_cfg.whitelist.is_empty() && !api_cfg.whitelist.iter().any(|net| net.contains(peer.ip()))
    {
        return match api_cfg.gray_action {
            ApiGrayAction::Api => Ok(error_response(
                request_id,
                ApiFailure::new(
                    StatusCode::FORBIDDEN,
                    "forbidden",
                    "Source IP is not allowed",
                ),
            )),
            ApiGrayAction::Ok200 => Ok(Response::builder()
                .status(StatusCode::OK)
                .header("content-type", "text/html; charset=utf-8")
                .body(Full::new(Bytes::new()))
                .unwrap()),
            ApiGrayAction::Drop => Err(IoError::new(
                ErrorKind::ConnectionAborted,
                "api request dropped by gray_action=drop",
            )),
        };
    }

    if !api_cfg.auth_header.is_empty() {
        let auth_ok = req
            .headers()
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .map(|v| auth_header_matches(v, &api_cfg.auth_header))
            .unwrap_or(false);
        if !auth_ok {
            return Ok(error_response(
                request_id,
                ApiFailure::new(
                    StatusCode::UNAUTHORIZED,
                    "unauthorized",
                    "Missing or invalid Authorization header",
                ),
            ));
        }
    }

    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let normalized_path = if path.len() > 1 {
        path.trim_end_matches('/')
    } else {
        path.as_str()
    };
    let query = req.uri().query().map(str::to_string);
    let body_limit = api_cfg.request_body_limit_bytes;

    let result = dispatch(
        req,
        method,
        &path,
        normalized_path,
        query.as_deref(),
        body_limit,
        &shared,
        cfg.as_ref(),
        &config_rx,
        request_id,
    )
    .await;
    match result {
        Ok(resp) => Ok(resp),
        Err(error) => Ok(error_response(request_id, error)),
    }
}

async fn dispatch(
    req: Request<Incoming>,
    method: Method,
    path: &str,
    normalized_path: &str,
    query: Option<&str>,
    body_limit: usize,
    shared: &Arc<ApiShared>,
    cfg: &ProxyConfig,
    config_rx: &watch::Receiver<Arc<ProxyConfig>>,
    request_id: u64,
) -> Result<Response<Full<Bytes>>, ApiFailure> {
    if web_runtime::is_route(normalized_path) {
        let web_mutation = method == Method::POST;
        let result = web_runtime::handle(
            method,
            normalized_path,
            query,
            req,
            shared.as_ref(),
            cfg,
            request_id,
            body_limit,
        )
        .await;
        if web_mutation && let Err(error) = &result {
            shared.runtime_events.record(
                "api.web.control.failed",
                format!("path={} code={}", normalized_path, error.code),
            );
        }
        return result;
    }

    if let Some(response) = read_routes::handle(
        &method,
        normalized_path,
        query,
        shared.as_ref(),
        cfg,
        config_rx,
    )
    .await?
    {
        return Ok(response);
    }

    match (method.as_str(), normalized_path) {
        ("POST", "/v1/users") => {
            fixed_routes::create_user_route(req, shared, cfg, config_rx, request_id, body_limit)
                .await
        }
        ("GET", "/v1/config") => fixed_routes::get_config_route(shared).await,
        ("POST", "/v1/system/reload") => {
            fixed_routes::reload_route(req, shared, cfg, request_id, body_limit).await
        }
        ("PATCH", "/v1/config") => {
            fixed_routes::patch_config_route(req, shared, cfg, query, request_id, body_limit).await
        }
        _ => {
            user_routes::handle(
                req,
                &method,
                path,
                normalized_path,
                shared,
                cfg,
                config_rx,
                request_id,
                body_limit,
            )
            .await
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #573** (2026-04-15): **API - seems something wrong in Route and method matching /v1/xx/xx**
  *Symptoms*: According to [wiki](https://github.com/telemt/telemt/blob/main/docs/API.md#request-processing-order) i shouldn't get this via API req, but it seems something wrong in Route and method matching _[so i even cant reach the system version info to enrich this issue with it]_  See 2 calls via curl to api endpoint  **Health = Ok** root@telemt-webui:/# curl -H "Authorization: XX" -vv http://172.17.0.2:9091/v1/health ``` *  *   Trying 172.17.0.2:9091... * Connected to 172.17.0.2 (172.17.0.2) port 9091 (#0) > GET /v1/health HTTP/1.1 > Host: 172.17.0.2:9091 > User-Agent: curl/7.88.1 > Accept: */* > Authorization: XX >  < HTTP/1.1 200 OK < content-type: application/json; charset=utf-8 < content-length: 130 < date: Tue, 24 Mar 2026 07:35:02 GMT <  * Connection #0 to host 172.17.0.2 left intact {"ok":true,"data":{"status":"ok","read_only":false},"revision":"XX"} ```  **systemInfo = Fail** root@telemt-webui:/# curl -H "Authorization: XX" -vv http://172.17.0.2:9091/v1/system/info ``` *   Trying 172.17.0.2:9091... * Connected to 172.17.0.2 (172.17.0.2) port 9091 (#0) > GET /v1/system/info HTTP/1.1 > Host: 172.17.0.2:9091 > User-Agent: curl/7.88.1 > Accept: */* > Authorization: XX >  < HTTP/1.1 404 Not Found < content-type: application/json; charset=utf-8 < content-length: 86 < date: Tue, 24 Mar 2026 07:41:51 GMT <  * Connection #0 to host 172.17.0.2 left intact {"ok":false,"error":{"code":"not_found","message":"Route not found"},"request_id":738} ```  **It seems something wrong with telemt it
  **Post-Mortem & Fix Analysis**:
  > seems interesting, will be investigate...
  > fixed in [3.4.0](https://github.com/telemt/telemt/releases/tag/3.4.0)

- **Issue #94** (2026-02-25): **[FEATURE] Limit architecture / DPI Detection avoidance / SOCKS Integration**
  *Symptoms*: Это идеологическое продолжение #22, там видимо не поняли про что я писал, тут опишу максимально подробно, с решением, которое вижу на своем опыте. В заголовке "каша", потому что это все взаимосвязано. _Итак, погнали, "Ты снова выходишь на связь..."_  ### Проблема: Как я и писал в #22 ограничения, которые сервер создает клиенту, уже после handshake, "провоцируют" **клиент** на постоянный реконнект, заставляя думать, что соединение просто потеряно, создавая мини-ddos атаку на порт MTProxy. **Это весьма сильно нарушает маскировку под TLS, создавая нетипичную модель поведения трафика,** соответственно подсвечивает сервис для провайдера (а фиг бы с ним) и РКН (если вспомнить, что VLESS ~~блокировали~~ _пытались_ по количеству коннектов, то инструменты для этого у них есть), как только последним кинут кость "банить", этот фактор станет первым демаскирующим, уже не говоря о том, что еще раньше может прийти хостер у которого закончились порты, именно поэтому они не любят торренты. _Кстати, вероятно этот баг является причиной #56, где в качестве решения просто "отсыпали" лимитов побольше._  #### Демо: В качестве примера прикрепляю домашнее видео, где клиент упирается в лимит, и просто сидит ждет, пока "видосик загрузится". На 12 секунде у пользователя закончился трафик, дальше 50 секунд мы можем наблюдать пенетрацию порта (слева количество открытых/закрывающихся соединений) с 89 до 3254, и это только один клиент...  https://github.com/user-attachments/assets/07a497c3-0cde-4e07-8b9f-bc
  **Post-Mortem & Fix Analysis**:
  > перед тем как начать: спасибо, что делитесь и учавствуете, это реально очень важно, чтоб держать в голове мысль, что всё это время, силы, бессонные ночи - не зря; мы открыты к идеям, мыслям, наблюдениям, а тем более pr)  > 1. Возможность возможность не рвать соединение, а сделать его лимитированным(шейпинг) уже средствами прокси  upstream manager - отдельно, шейпинг и полисинг - отдельно, давайте не будем путать; проблема шейпинга и полисинга в том, что когда протокол их не реализует, то получается либо lossy, либо laggy - а это долгая отправка сообщений, долгое получение медиа, сбои... -> как определить, кого и в какой момент может полисить/шейпить безопасно - большая загадка...  > 2\. **маппинга имени пользователя из telemt в socks**, например флаг `map_username=true`  это не проблема сделать, но, есть нюансы: - пользователи первичнее апстримов, - можно сделать привязку пользователей к апстримам - своеобразный ACL  > 2\. возможность не рвать соединение  пока, судя по драфтам, при бол
  > фитнес мощно влепил xd 
  > а с оригинальным mtProxy клиенты так же себя ведут? чет сомневаюсь

- **Issue #20** (2026-02-25): **[PROBLEM] No working w/ VLESS-proxy**
  *Symptoms*: I use VLESS as VPN protocol. When Im connected to VPN then proxy can't establish connection. Through openvpn all is good
  **Post-Mortem & Fix Analysis**:
  > Just checked, and it works like a charm with my VLESS + xtls profiles. Kinda a weird thing to do though, tbh — you're better off just adding the telemt server IP to your exceptions.
  > I have used tcpdump to check the incoming packets on 443 port of the proxy server. When I enable proxy in telegram on my laptop through the VPN there is no activity in tcpdump log. When I use telnet to connect to 443 I can see activity. Maybe the problem is with the host masking?
  > I think your VLESS client sees the SNI (tls_domain) in Telegram's Fake TLS handshake and routes it to the real domain instead of your proxy. That's why tcpdump shows nothing - packets never reach your server. OpenVPN doesn't care about SNI, it just tunnels raw packets - that's why it works fine.  Not a telemt bug it's VLESS being too smart for its own good  Just add the telemt server IP to your exceptions

- **Issue #19** (2026-02-19): **[PROBLEM] DC=203 Endpoint**
  *Symptoms*: Hello! Images and video from dc4 is ok, from dc2 not loading. tried in direct mode and with socks5 upstream to vps in another country. Is it any way to debug it? Tested with curl and ping - both ip are ok from two vps. Logs are the same for dc2 and dc4.
  **Post-Mortem & Fix Analysis**:
  > Hello! Add `--log-level debug` to the end of exec command for debug: `telemt` will run 2-50 times slower depending on the scenario, but it will make it clear where the errors occur...
  > I have a same problem. Here's my log:   telemt  | 2026-02-11T12:10:07.685848Z  INFO telemt::config: mask_host not set, using tls_domain (tori.fi) for masking telemt  | 2026-02-11T12:10:07.685978Z  INFO telemt: === Configuration Loaded === telemt  | 2026-02-11T12:10:07.685983Z  INFO telemt: TLS Domain: tori.fi telemt  | 2026-02-11T12:10:07.685985Z  INFO telemt: Mask enabled: true telemt  | 2026-02-11T12:10:07.685991Z  INFO telemt: Mask host: tori.fi telemt  | 2026-02-11T12:10:07.685992Z  INFO telemt: Mask port: 8080 telemt  | 2026-02-11T12:10:07.685994Z  INFO telemt: Modes: classic=false, secure=false, tls=true telemt  | 2026-02-11T12:10:07.685996Z  INFO telemt: ============================ telemt  | 2026-02-11T12:10:07.734870Z  INFO telemt: Listening on 0.0.0.0:8080 telemt  | 2026-02-11T12:10:07.735065Z  INFO telemt: --- Proxy Links for xx.xxx.xxx.xxx --- telemt  | 2026-02-11T12:10:07.735079Z  INFO telemt: User: docker telemt  | 2026-02-11T12:10:07.735134Z  INFO telemt:   EE-TLS:  tg:/
  > does the problem persist if you run telemt outside of docker?

- **Issue #18** (2026-02-15): **[PROBLEM] Colored log output w/ syslog**
  *Symptoms*: non-readable log in syslog, when run in docker and logging.driver: syslog  Something like:  > 2026-02-11T08:55:08.037941+00:00 vm 2660c012d466[784]: #033[2m2026-02-11T08:55:08.037771Z#033[0m #033[32m INFO#033[0m #033[2mtelemt::proxy::handshake#033[0m#033[2m:#033[0m MTProto handshake successful #033[3mpeer#033[0m#033[2m=#033[0m91.191.254.158:43294 #033[3muser#033[0m#033[2m=#033[0mdocker #033[3mdc#033[0m#033[2m=#033[0m-2 #033[3mproto#033[0m#033[2m=#033[0mSecure #033[3mtls#033[0m#033[2m=#033[0mtrue  
  **Post-Mortem & Fix Analysis**:
  > Hello! Unfortunately, the official release of telemt-docker is still WIP... but, we consider the readability of logs to be really important, so we will add this in version 1.2.0.0
  > > Hello! Unfortunately, the official release of telemt-docker is still WIP... but, we consider the readability of logs to be really important, so we will add this in version 1.2.0.0  This issue is reproduced in non‑containerized version 2.0.0.1 Fernsprach. 
  > Fixed by @artemws in #78  Fixed version available in Release and in tree

- **Issue #11** (2026-02-15): **[PROBLEM] Ad-tag not working**
  *Symptoms*: Hello, I've set up the proxy using your script, and it works great. However, I'm having a problem: the AD_TAG isn't showing up on the proxy. The AD_TAG and channel key are correct; it's just that the proxy built with your script isn't displaying the AD_TAG. What could be the problem?
  **Post-Mortem & Fix Analysis**:
  > Hello, thanks for informing, in few hours, we will reproduce and investigate why this is happening...
  > Step 1: System Preparation apt update && apt upgrade -y apt install -y curl wget nano  Step 2: Install Rust curl --proto '=https' --tlsv1.2 -sSf  https://sh.rustup.rs  | sh #Install by default according to 1 source $HOME/.cargo/env  Step 3: Clone and compile telemt cd /opt git clone  https://github.com/telemt/telemt.git cd telemt cargo build --release cp target/release/telemt /opt/telemt/telemt mkdir -p /opt/telemt && mv /opt/telemt/telemt /opt/telemt/ 2>/dev/null || true cd /opt/telemt  Step 4: Create a configuration file cat > config.toml << 'EOF' [general] ad_tag = "b2023fd75dd03299856015dc469139ae"  [general.modes] tls = true  [server] port = 443  [[server.listeners]] ip = "0.0.0.0" announce_ip = "118.11.11.11"  [censorship] tls_domain = "aure.microsoft.com"  [access.users] tg = "a1b2c3d4e5f67890abcdecf4b2d7e8f9" EOF  Step 5: Test Run ./telemt config.toml Success symbol: [INFO] Listening on 0.0.0.0:8443 Press Ctrl+C to stop  Step 6: Firewall ufw allow 8443/tcp ufw reload  Step 7: R
  > Issue confirmed Added to Task-plan for version 1.2.0.0 Release - until February 9

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

### Incident Patch 1: `38eabc50` (2026-09-26)
**Commit Message**: WEB: Base Path: security + reload coverage fixes&tests

**File**: `src/api/config_edit.rs` (modified, +3/-0)
```diff
@@ -447,6 +447,9 @@ fn deep_merge(base: &mut Toml, patch: &Toml) {
     }
 }
 
+#[cfg(test)]
+#[path = "config_edit/base_path_tests.rs"]
+mod base_path_tests;
 #[cfg(test)]
 #[path = "config_edit/tests.rs"]
 mod tests;
```

**File**: `src/api/config_edit/base_path_tests.rs` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+use super::*;
+
+fn web_config() -> &'static str {
+    r#"
+[access.users]
+alice = "000102030405060708090a0b0c0d0e0f"
+
+[[server.listeners]]
+ip = "127.0.0.1"
+port = 18080
+transport = "web"
+proxy_protocol = false
+web_client_ip_source = "x_forwarded_for"
+web_trusted_proxy_cidrs = ["127.0.0.1/32"]
+
+[web]
+enabled = true
+
+[[web.vhosts]]
+host = "proxy.example.com"
+public_addr = "203.0.113.10:443"
+
+[web.vhosts.decoy]
+mode = "http_upstream"
+upstream = "http://127.0.0.1:18081"
+
+[[web.vhosts.profiles]]
+user = "alice"
+secret_mode = "plain"
+"#
+}
+
+fn vhosts_patch(base_path: &str) -> Json {
+    serde_json::json!({
+        "web": {
+            "vhosts": [{
+                "host": "proxy.example.com",
+                "base_path": base_path,
+                "public_addr": "203.0.113.10:443",
+                "decoy": {
+                    "mode": "http_upstream",
+                    "upstream": "http://127.0.0.1:18081"
+                },
+                "profiles": [{
+                    "user": "alice",
+                    "secret_mode": "plain"
+                }]
+            }]
+        }
+    })
+}
+
+#[tokio::test]
+async fn config_api_applies_valid_base_path_and_preserves_source_on_invalid_patch() {
+    let directory = tempfile::tempdir().unwrap();
+    let path = directory.path().join("config.toml");
+    std::fs::write(&path, web_config()).unwrap();
+    let active = ProxyConfig::load(&path).unwrap();
+
+    let mut response = apply_patch_to_path(&path, &vhosts_patch("MixedCase/path"), None)
+        .await
+        .unwrap();
+    let desired = ProxyConfig::load(&path).unwrap();
+    let resolved = reconcile_runtime_effect(&mut response, &active, &desired).unwrap();
+    assert!(!response.restart_required);
+    assert!(response.runtime_reload_required);
+    assert!(!response.process_restart_required);
+    assert!(response.deferred_process_fields.is_empty());
+    assert!(resolved.runtime_changed);
+    assert_eq!(desired.web.vhosts[0].base_path, "MixedCase/path");
+    assert_eq!(
+        resolved.effective.web.runtime.as_ref().unwrap().vhosts["proxy.example.com"].base,
+        "/MixedCase/path/"
+    );
+
+    let (managed, _revision) = read_managed_config(&path).await.unwrap();
+    let vhosts = managed["web"]["vhosts"].as_array().unwrap();
+    assert_eq!(vhosts[0]["base_path"].as_str(), Some("MixedCase/path"));
+    assert!(managed["web"].get("runtime").is_none());
+    assert!(!managed.as_table().unwrap().contains_key("access"));
+
+    let before_invalid = std::fs::read(&path).unwrap();
+    let error = apply_patch_to_path(&path, &vhosts_patch("/invalid"), None)
+        .await
+        .unwrap_err();
+    assert_eq!(error.status, hyper::StatusCode::BAD_REQUEST);
+    assert_eq!(std::fs::read(&path).unwrap(), before_invalid);
+}
```

**File**: `src/config/hot_reload.rs` (modified, +3/-0)
```diff
@@ -62,5 +62,8 @@ use reporting::log_changes;
 #[cfg(test)]
 use watcher::{ReloadState, reload_config};
 
+#[cfg(test)]
+#[path = "hot_reload/base_path_tests.rs"]
+mod base_path_tests;
 #[cfg(test)]
 mod tests;
```

**File**: `src/config/hot_reload/base_path_tests.rs` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+use base64::Engine as _;
+
+use super::*;
+
+fn write_base_path_config(path: &Path, base_path: &str) {
+    let base_path = if base_path.is_empty() {
+        String::new()
+    } else {
+        format!("base_path = \"{base_path}\"\n")
+    };
+    let config = format!(
+        r#"
+[access.users]
+alice = "000102030405060708090a0b0c0d0e0f"
+
+[[server.listeners]]
+ip = "127.0.0.1"
+port = 18080
+transport = "web"
+proxy_protocol = false
+web_client_ip_source = "x_forwarded_for"
+web_trusted_proxy_cidrs = ["127.0.0.1/32"]
+
+[web]
+enabled = true
+
+[[web.vhosts]]
+host = "proxy.example.com"
+{base_path}public_addr = "203.0.113.10:443"
+
+[web.vhosts.decoy]
+mode = "http_upstream"
+upstream = "http://127.0.0.1:18081"
+
+[[web.vhosts.profiles]]
+user = "alice"
+secret_mode = "plain"
+"#,
+    );
+    std::fs::write(path, config).unwrap();
+}
+
+#[test]
+fn reload_rejects_invalid_base_then_publishes_route_identity_together() {
+    let directory = tempfile::tempdir().unwrap();
+    let path = directory.path().join("config.toml");
+    write_base_path_config(&path, "");
+    let initial = Arc::new(ProxyConfig::load(&path).unwrap());
+    let initial_hash = ProxyConfig::load_with_metadata(&path)
+        .unwrap()
+        .rendered_hash;
+    let initial_capability = initial.web.runtime.as_ref().unwrap().capabilities[0];
+    let (config_tx, _config_rx) = watch::channel(Arc::clone(&initial));
+    let (log_tx, _log_rx) = watch::channel(initial.general.log_level.clone());
+    let mut reload_state = ReloadState::new(Some(initial_hash));
+
+    write_base_path_config(&path, "/invalid");
+    reload_config(&path, &config_tx, &log_tx, None, None, &mut reload_state);
+    let unchanged = config_tx.borrow().clone();
+    assert!(Arc::ptr_eq(&unchanged, &initial));
+    assert_eq!(unchanged.web.vhosts[0].base_path, "");
+    assert_eq!(
+        unchanged.web.runtime.as_ref().unwrap().capabilities[0],
+        initial_capability
+    );
+
+    write_base_path_config(&path, "dobry-cola-super-app");
+    reload_config(&path, &config_tx, &log_tx, None, None, &mut reload_state);
+    let applied = config_tx.borrow().clone();
+    let runtime = applied.web.runtime.as_ref().unwrap();
+    let vhost = &runtime.vhosts["proxy.example.com"];
+    assert_eq!(applied.web.vhosts[0].base_path, "dobry-cola-super-app");
+    assert_eq!(vhost.base, "/dobry-cola-super-app/");
+    assert_eq!(vhost.capabilities[0], vhost.profiles[0].capability);
+    assert_eq!(runtime.capabilities.as_ref(), vhost.capabilities.as_ref());
+    assert!(!runtime.capabilities.contains(&initial_capability));
+    assert_eq!(
+        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(vhost.capabilities[0]),
+        "hHz99Xs93EN1j91G9gpNepXwGNNt5YdAFkEVk_LlqdQ"
+    );
+}
```

**File**: `src/config/load/runtime_web/tests.rs` (modified, +17/-0)
```diff
@@ -38,6 +38,23 @@ fn capability_matches_reference_vectors() {
     }
 }
 
+#[test]
+fn capability_binds_the_exact_host_and_base_path_identity() {
+    let secret = hex::decode("000102030405060708090a0b0c0d0e0f").unwrap();
+    let root = derive_web_capability(&secret, b"proxy.example.com", b"").unwrap();
+    let mixed = derive_web_capability(&secret, b"proxy.example.com", b"MixedCase/path").unwrap();
+    let lower = derive_web_capability(&secret, b"proxy.example.com", b"mixedcase/path").unwrap();
+    let other_path =
+        derive_web_capability(&secret, b"proxy.example.com", b"MixedCase/other").unwrap();
+    let other_host =
+        derive_web_capability(&secret, b"other.example.com", b"MixedCase/path").unwrap();
+
+    let identities = [root, mixed, lower, other_path, other_host]
+        .into_iter()
+        .collect::<std::collections::HashSet<_>>();
+    assert_eq!(identities.len(), 5);
+}
+
 #[cfg(unix)]
 #[test]
 fn static_snapshot_remains_anchored_after_root_path_replacement() {
```

---

### Incident Patch 2: `f1107c21` (2026-09-23)
**Commit Message**: Process-wide concurrency + Cancellation ownership fixes

**File**: `src/api/runtime_edge.rs` (modified, +3/-3)
```diff
@@ -314,9 +314,9 @@ async fn recompute_connections_payload(
     let mut active_users = 0usize;
     for entry in shared.stats.iter_user_stats() {
         let user_stats = entry.value();
-        let current_connections = user_stats
-            .curr_connects
-            .load(std::sync::atomic::Ordering::Relaxed);
+        let current_connections = shared
+            .stats
+            .get_process_user_curr_connects(entry.key());
         let total_octets = user_stats
             .octets_from_client
             .load(std::sync::atomic::Ordering::Relaxed)
```

**File**: `src/api/users/view.rs` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ pub(in crate::api) async fn users_from_config(
                 .filter(|limit| *limit > 0)
                 .or((cfg.access.user_max_unique_ips_global_each > 0)
                     .then_some(cfg.access.user_max_unique_ips_global_each)),
-            current_connections: stats.get_user_curr_connects(&username),
+            current_connections: stats.get_process_user_curr_connects(&username),
             active_unique_ips: active_ip_list.len(),
             active_unique_ips_list: active_ip_list,
             recent_unique_ips: recent_ip_list.len(),
```

**File**: `src/conntrack_control/firewall.rs` (modified, +18/-11)
```diff
@@ -1,5 +1,6 @@
 use std::collections::BTreeSet;
 use std::net::IpAddr;
+use std::time::Duration;
 
 use tokio::io::AsyncWriteExt;
 use tokio::process::Command;
@@ -363,6 +364,7 @@ pub(super) async fn delete_conntrack_entry(event: ConntrackCloseEvent) -> Delete
 }
 
 async fn run_command(binary: &str, args: &[&str], stdin: Option<String>) -> Result<(), String> {
+    const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
     #[cfg(unix)]
     let Some(command_path) = resolve_trusted_helper(binary) else {
         return Err(format!("{binary} is not available"));
@@ -377,21 +379,26 @@ async fn run_command(binary: &str, args: &[&str], stdin: Option<String>) -> Resu
     }
     command.stdout(std::process::Stdio::null());
     command.stderr(std::process::Stdio::piped());
+    command.kill_on_drop(true);
     let mut child = command
         .spawn()
         .map_err(|error| format!("spawn {binary} failed: {error}"))?;
-    if let Some(blob) = stdin
-        && let Some(mut writer) = child.stdin.take()
-    {
-        writer
-            .write_all(blob.as_bytes())
+    let output = tokio::time::timeout(COMMAND_TIMEOUT, async move {
+        if let Some(blob) = stdin
+            && let Some(mut writer) = child.stdin.take()
+        {
+            writer
+                .write_all(blob.as_bytes())
+                .await
+                .map_err(|error| format!("stdin write {binary} failed: {error}"))?;
+        }
+        child
+            .wait_with_output()
             .await
-            .map_err(|error| format!("stdin write {binary} failed: {error}"))?;
-    }
-    let output = child
-        .wait_with_output()
-        .await
-        .map_err(|error| format!("wait {binary} failed: {error}"))?;
+            .map_err(|error| format!("wait {binary} failed: {error}"))
+    })
+    .await
+        .map_err(|_| format!("{binary} timed out after {}s", COMMAND_TIMEOUT.as_secs()))??;
     if output.status.success() {
         return Ok(());
     }
```

**File**: `src/ip_tracker.rs` (modified, +35/-12)
```diff
@@ -38,11 +38,16 @@ struct UserIpShard {
 
 #[derive(Debug, Default)]
 struct CleanupShard {
-    queue: Mutex<HashMap<(String, UserIncarnation), HashMap<IpAddr, usize>>>,
+    queue: Mutex<CleanupQueue>,
 }
 
+type CleanupQueue =
+    HashMap<String, HashMap<UserIncarnation, HashMap<IpAddr, usize>>>;
+type CleanupBatch = HashMap<(String, UserIncarnation, IpAddr), usize>;
+
 #[derive(Debug, Clone)]
 struct UserIpLimitPolicy {
+    source_generation: u64,
     max_ips: Arc<HashMap<String, usize>>,
     default_max_ips: usize,
     mode: UserMaxUniqueIpsMode,
@@ -52,6 +57,7 @@ struct UserIpLimitPolicy {
 impl Default for UserIpLimitPolicy {
     fn default() -> Self {
         Self {
+            source_generation: 0,
             max_ips: Arc::new(HashMap::new()),
             default_max_ips: 0,
             mode: UserMaxUniqueIpsMode::ActiveWindow,
@@ -70,6 +76,7 @@ pub struct UserIpTracker {
     recent_cap_rejects: Arc<AtomicU64>,
     cleanup_deferred_releases: Arc<AtomicU64>,
     limit_policy: Arc<ArcSwap<UserIpLimitPolicy>>,
+    policy_update: Arc<Mutex<()>>,
     last_compact_epoch_secs: Arc<AtomicU64>,
     cleanup_queue_len: Arc<AtomicU64>,
     cleanup_shards: Arc<Box<[CleanupShard]>>,
@@ -121,6 +128,7 @@ impl UserIpTracker {
             recent_cap_rejects: Arc::new(AtomicU64::new(0)),
             cleanup_deferred_releases: Arc::new(AtomicU64::new(0)),
             limit_policy: Arc::new(ArcSwap::from_pointee(UserIpLimitPolicy::default())),
+            policy_update: Arc::new(Mutex::new(())),
             last_compact_epoch_secs: Arc::new(AtomicU64::new(0)),
             cleanup_queue_len: Arc::new(AtomicU64::new(0)),
             cleanup_shards: Arc::new(cleanup_shards),
@@ -196,19 +204,21 @@ impl UserIpTracker {
     }
 
     pub(super) fn pop_one_cleanup(
-        queue: &mut HashMap<(String, UserIncarnation), HashMap<IpAddr, usize>>,
+        queue: &mut CleanupQueue,
     ) -> Option<(String, UserIncarnation, IpAddr, usize)> {
-        let owner = queue.keys().next().cloned()?;
-        let ip = queue.get(&owner)?.keys().next().copied()?;
-        let count = queue.get_mut(&owner)?.remove(&ip)?;
-        let remove_user = queue
-            .get(&owner)
-            .map(|user_queue| user_queue.is_empty())
-            .unwrap_or(false);
-        if remove_user {
-            queue.remove(&owner);
+        let user = queue.keys().next().cloned()?;
+        let incarnation = queue.get(&user)?.keys().next().copied()?;
+        let ip = queue.get(&user)?.get(&incarnation)?.keys().next().copied()?;
+        let incarnations = queue.get_mut(&user)?;
+        let ips = incarnations.get_mut(&incarnation)?;
+        let count = ips.remove(&ip)?;
+        if ips.is_empty() {
+            incarnations.remove(&incarnation);
         }
-        Some((owner.0, owner.1, ip, count))
+        if incarnations.is_empty() {
+            queue.remove(&user);
+        }
+        Some((user, incarnation, ip, count))
     }
 
     #[cfg(test)]
@@ -224,6 +234,19 @@ impl UserIpTracker {
     #[cfg(not(test))]
     pub(super) fn observe_cleanup_poison_for_tests(&self) {}
 
+    #[cfg(test)]
+    pub(crate) async fn hold_user_shard_for_tests(
+        &self,
+        user: &str,
+        entered: tokio::sync::oneshot::Sender<()>,
+        release: tokio::sync::oneshot::Receiver<()>,
+    ) {
+        let shard_idx = Self::shard_idx(user);
+        let _guard = self.shards[shard_idx].write().await;
+        let _ = entered.send(());
+        let _ = release.await;
+    }
+
     pub(super) fn now_epoch_secs() -> u64 {
         std::time::SystemTime::now()
             .duration_since(std::time::UNIX_EPOCH)
```

**File**: `src/ip_tracker/admission.rs` (modified, +65/-30)
```diff
@@ -2,47 +2,84 @@ use super::*;
 
 impl UserIpTracker {
     pub async fn set_limit_policy(&self, mode: UserMaxUniqueIpsMode, window_secs: u64) {
-        self.limit_policy.rcu(|current| {
-            Arc::new(UserIpLimitPolicy {
-                mode,
-                window_secs: window_secs.max(1),
-                ..(**current).clone()
-            })
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
         });
+        let current = self.limit_policy.load_full();
+        self.limit_policy.store(Arc::new(UserIpLimitPolicy {
+            mode,
+            window_secs: window_secs.max(1),
+            ..(*current).clone()
+        }));
     }
 
     pub async fn set_user_limit(&self, username: &str, max_ips: usize) {
-        let username = username.to_string();
-        self.limit_policy.rcu(|current| {
-            let mut limits = current.max_ips.as_ref().clone();
-            limits.insert(username.clone(), max_ips);
-            Arc::new(UserIpLimitPolicy {
-                max_ips: Arc::new(limits),
-                ..(**current).clone()
-            })
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
         });
+        let current = self.limit_policy.load_full();
+        let mut limits = current.max_ips.as_ref().clone();
+        limits.insert(username.to_string(), max_ips);
+        self.limit_policy.store(Arc::new(UserIpLimitPolicy {
+            max_ips: Arc::new(limits),
+            ..(*current).clone()
+        }));
     }
 
     pub async fn remove_user_limit(&self, username: &str) {
-        self.limit_policy.rcu(|current| {
-            let mut limits = current.max_ips.as_ref().clone();
-            limits.remove(username);
-            Arc::new(UserIpLimitPolicy {
-                max_ips: Arc::new(limits),
-                ..(**current).clone()
-            })
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
         });
+        let current = self.limit_policy.load_full();
+        let mut limits = current.max_ips.as_ref().clone();
+        limits.remove(username);
+        self.limit_policy.store(Arc::new(UserIpLimitPolicy {
+            max_ips: Arc::new(limits),
+            ..(*current).clone()
+        }));
     }
 
     pub async fn load_limits(&self, default_limit: usize, limits: &HashMap<String, usize>) {
-        let limits = Arc::new(limits.clone());
-        self.limit_policy.rcu(|current| {
-            Arc::new(UserIpLimitPolicy {
-                max_ips: Arc::clone(&limits),
-                default_max_ips: default_limit,
-                ..(**current).clone()
-            })
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
         });
+        let current = self.limit_policy.load_full();
+        self.limit_policy.store(Arc::new(UserIpLimitPolicy {
+            max_ips: Arc::new(limits.clone()),
+            default_max_ips: default_limit,
+            ..(*current).clone()
+        }));
+    }
+
+    /// Atomically publishes one coherent policy from the active runtime generation.
+    pub(crate) async fn apply_policy_from_source(
+        &self,
+        source_generation: u64,
+        default_limit: usize,
+        limits: &HashMap<String, usize>,
+        mode: UserMaxUniqueIpsMode,
+        window_secs: u64,
+    ) -> bool {
+        let _policy_update = self.policy_update.lock().unwrap_or_else(|poisoned| {
+            self.policy_update.clear_poison();
+            poisoned.into_inner()
+        });
+        let current = self.limit_policy.load_full();
+        if source_generation < current.source_generation {

```

---

### Incident Patch 3: `baa9bfbb` (2026-09-22)
**Commit Message**: ME Authority + Quota Resets + WEB Replacement Rollback fixes

**File**: `src/quota_state.rs` (modified, +2/-3)
```diff
@@ -104,14 +104,13 @@ impl QuotaStateOwner {
             used_bytes: 0,
             last_reset_epoch_secs,
         };
+        let reset_target = self.store.current_or_legacy_handle(user);
         let state = self.state_for_users(configured_users, Some((user, prospective.clone())));
         let path = self.path.clone();
-        let store = Arc::clone(&self.store);
-        let user = user.to_string();
         let task = tokio::task::spawn_blocking(move || {
             let _guard = guard;
             write_state_file_blocking(&path, &state)?;
-            Ok(store.reset(&user, last_reset_epoch_secs))
+            Ok(reset_target.reset(last_reset_epoch_secs))
         });
         wait_for_blocking_io(task).await
     }
```

**File**: `src/stats/quota_store.rs` (modified, +26/-6)
```diff
@@ -213,12 +213,7 @@ impl QuotaStore {
     }
 
     pub(crate) fn reset(&self, user: &str, now_epoch_secs: u64) -> UserQuotaSnapshot {
-        let state = self.current_or_legacy_handle(user);
-        state.counters.replace(0, now_epoch_secs);
-        UserQuotaSnapshot {
-            used_bytes: 0,
-            last_reset_epoch_secs: now_epoch_secs,
-        }
+        self.current_or_legacy_handle(user).reset(now_epoch_secs)
     }
 
     pub(crate) fn remove(&self, user: &str) {
@@ -359,6 +354,15 @@ impl UserQuotaHandle {
     ) -> Result<QuotaReservation, QuotaReserveError> {
         self.counters.try_reserve(bytes, limit)
     }
+
+    /// Resets only the quota incarnation captured by this handle.
+    pub(crate) fn reset(&self, now_epoch_secs: u64) -> UserQuotaSnapshot {
+        self.counters.replace(0, now_epoch_secs);
+        UserQuotaSnapshot {
+            used_bytes: 0,
+            last_reset_epoch_secs: now_epoch_secs,
+        }
+    }
 }
 
 impl QuotaReservation {
@@ -497,6 +501,22 @@ mod tests {
         assert_eq!(current.used(), 40);
     }
 
+    #[test]
+    fn captured_reset_handle_cannot_reset_a_new_incarnation() {
+        let store = QuotaStore::default();
+        store.activate_fresh("alice", 1);
+        let reset_target = store.handle_exact("alice", 1).unwrap();
+        reset_target.charge(40);
+        store.advance_preserving_usage("alice", 2);
+        let current = store.handle_exact("alice", 2).unwrap();
+        current.charge(20);
+
+        reset_target.reset(7);
+
+        assert_eq!(reset_target.used(), 0);
+        assert_eq!(current.used(), 60);
+    }
+
     #[test]
     fn stale_retirement_cannot_remove_newer_quota_owner() {
         let store = QuotaStore::default();
```

**File**: `src/transport/middle_proxy/health/family.rs` (modified, +2/-0)
```diff
@@ -26,6 +26,7 @@ pub(super) async fn check_family(
 
     let mut dc_endpoints = HashMap::<i32, Vec<SocketAddr>>::new();
     let endpoint_snapshot = pool.endpoint_snapshot.load();
+    let endpoint_revision = endpoint_snapshot.revision;
     let map_guard = match family {
         IpFamily::V4 => &endpoint_snapshot.map_v4,
         IpFamily::V6 => &endpoint_snapshot.map_v6,
@@ -253,6 +254,7 @@ pub(super) async fn check_family(
                 dc,
                 family,
                 generation: pool.current_generation(),
+                endpoint_revision,
                 contour: WriterContour::Active,
             })
             .await
```

**File**: `src/transport/middle_proxy/pool.rs` (modified, +3/-0)
```diff
@@ -37,6 +37,8 @@ pub(super) struct RefillTargetKey {
     pub family: IpFamily,
     /// Generation that retains publication authority.
     pub generation: u64,
+    /// Endpoint snapshot revision targeted by this refill producer.
+    pub endpoint_revision: u64,
     /// Lifecycle contour that the replacement must preserve.
     pub contour: WriterContour,
 }
@@ -310,6 +312,7 @@ pub(super) struct ReinitStatusSnapshot {
     pub(super) pending_hardswap_generation: u64,
     pub(super) pending_hardswap_started_at_epoch_secs: u64,
     pub(super) pending_hardswap_map_hash: u64,
+    pub(super) pending_hardswap_endpoint_revision: u64,
     pub(super) inflight: usize,
 }
 
```

**File**: `src/transport/middle_proxy/pool/construction.rs` (modified, +1/-0)
```diff
@@ -143,6 +143,7 @@ impl MePool {
             pending_hardswap_generation: 0,
             pending_hardswap_started_at_epoch_secs: 0,
             pending_hardswap_map_hash: 0,
+            pending_hardswap_endpoint_revision: 0,
             inflight: 0,
         };
         stats.set_me_writer_byte_budget_limit_bytes(me_writer_byte_budget_bytes);
```

---

### Incident Patch 4: `d706b3f3` (2026-09-19)
**Commit Message**: Hardswap Invariants in tests + Quota fixes

**File**: `src/api/config_edit.rs` (modified, +19/-3)
```diff
@@ -62,6 +62,21 @@ pub(super) async fn patch_config(
     expected_revision: Option<String>,
     reload_request: Option<ReloadRequest>,
     shared: &ApiShared,
+) -> Result<PatchConfigResponse, ApiFailure> {
+    let shared = shared.clone();
+    shared
+        .clone()
+        .run_mutation_completion(async move {
+            patch_config_to_completion(patch_json, expected_revision, reload_request, &shared).await
+        })
+        .await
+}
+
+async fn patch_config_to_completion(
+    patch_json: Json,
+    expected_revision: Option<String>,
+    reload_request: Option<ReloadRequest>,
+    shared: &ApiShared,
 ) -> Result<PatchConfigResponse, ApiFailure> {
     let _guard = shared.mutation_lock.lock().await;
     let active_config = shared.active_runtime.load_full().config();
@@ -83,7 +98,7 @@ pub(super) async fn patch_config(
     } else {
         None
     };
-    write_atomic_if_unchanged(
+    prepared.response.revision = write_atomic_if_unchanged(
         prepared.config_path,
         prepared.expected_revision,
         prepared.owner_path,
@@ -123,15 +138,16 @@ pub(super) async fn apply_patch_to_path(
     patch_json: &Json,
     expected_revision: Option<String>,
 ) -> Result<PatchConfigResponse, ApiFailure> {
-    let prepared = prepare_patch_to_path(config_path, patch_json, expected_revision).await?;
-    write_atomic_if_unchanged(
+    let mut prepared = prepare_patch_to_path(config_path, patch_json, expected_revision).await?;
+    let revision = write_atomic_if_unchanged(
         prepared.config_path,
         prepared.expected_revision,
         prepared.owner_path,
         prepared.expected_owner_contents,
         prepared.owner_contents,
     )
     .await?;
+    prepared.response.revision = revision;
     Ok(prepared.response)
 }
 
```

**File**: `src/api/config_store/atomic.rs` (modified, +90/-9)
```diff
@@ -31,16 +31,22 @@ struct ExistingTarget {
     metadata: std::fs::Metadata,
 }
 
+struct GraphFence<'a> {
+    config_path: &'a Path,
+    expected_revision: &'a str,
+}
+
 struct ConfigWriteLock {
     #[cfg(unix)]
     _file: Flock<File>,
 }
 
 impl ConfigWriteLock {
     fn acquire(path: &Path) -> std::io::Result<Self> {
+        let path = normalize_path(path);
         #[cfg(unix)]
         {
-            let lock_path = sibling_lock_path(path);
+            let lock_path = sibling_lock_path(&path);
             let anchored = AnchoredPath::open_creating_parents(&lock_path, 0o750)?;
             let descriptor = openat(
                 anchored.parent(),
@@ -76,7 +82,7 @@ pub(in crate::api) async fn write_atomic(
 ) -> Result<(), ApiFailure> {
     tokio::task::spawn_blocking(move || {
         let _lock = ConfigWriteLock::acquire(&path)?;
-        write_atomic_sync(&path, None, &contents)
+        write_atomic_sync(&path, None, &contents, None).map(|_| ())
     })
         .await
         .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
@@ -90,21 +96,37 @@ pub(in crate::api) async fn write_atomic_if_unchanged(
     path: PathBuf,
     expected_contents: String,
     contents: String,
-) -> Result<(), ApiFailure> {
+) -> Result<String, ApiFailure> {
     tokio::task::spawn_blocking(move || {
+        let config_path = normalize_path(&config_path);
+        let path = normalize_path(&path);
         // Every API mutation locks the root source so writes to different includes serialize.
         let _lock = ConfigWriteLock::acquire(&config_path).map_err(AtomicWriteError::Io)?;
         let graph = ProxyConfig::read_source_graph(&config_path)
             .map_err(|error| AtomicWriteError::ReadGraph(error.to_string()))?;
         if compute_source_revision(&graph) != expected_revision {
             return Err(AtomicWriteError::Conflict);
         }
-        write_atomic_sync(&path, Some(&expected_contents), &contents).map_err(|error| {
+        write_atomic_sync(
+            &path,
+            Some(&expected_contents),
+            &contents,
+            Some(GraphFence {
+                config_path: &config_path,
+                expected_revision: &expected_revision,
+            }),
+        )
+        .map_err(|error| {
             if error.kind() == std::io::ErrorKind::AlreadyExists {
                 AtomicWriteError::Conflict
             } else {
                 AtomicWriteError::Io(error)
             }
+        })?
+        .ok_or_else(|| {
+            AtomicWriteError::Io(std::io::Error::other(
+                "config graph fence did not produce a committed revision",
+            ))
         })
     })
     .await
@@ -137,6 +159,51 @@ fn sibling_lock_path(path: &Path) -> PathBuf {
     path.parent().unwrap_or_else(|| Path::new(".")).join(name)
 }
 
+fn normalize_path(path: &Path) -> PathBuf {
+    let absolute = if path.is_absolute() {
+        path.to_path_buf()
+    } else {
+        std::env::current_dir()
+            .map(|current| current.join(path))
+            .unwrap_or_else(|_| path.to_path_buf())
+    };
+    let mut normalized = PathBuf::new();
+    for component in absolute.components() {
+        match component {
+            std::path::Component::CurDir => {}
+            std::path::Component::ParentDir => {
+                normalized.pop();
+            }
+            component => normalized.push(component.as_os_str()),
+        }
+    }
+    normalized
+}
+
+fn fenced_post_commit_revision(
+    fence: GraphFence<'_>,
+    path: &Path,
+    contents: &str,
+) -> std::io::Result<String> {
+    let mut graph = ProxyConfig::read_source_graph(fence.config_path)
+        .map_err(|error| std::io::Error::other(error.to_string()))?;
+    if compute_source_revision(&graph) != fence.expected_revision {
+        return Err(std::io::Error::new(
+            std::io::ErrorKind::AlreadyExists,
+            "config graph changed during persistence",
+        ));
+
```

**File**: `src/api/config_store/persistence.rs` (modified, +2/-2)
```diff
@@ -159,8 +159,8 @@ pub(in crate::api) async fn save_access_sections_to_disk_if_revision(
         owner_contents.clone(),
     )
     .await?;
-    let revision = compute_snapshot_revision(&candidate);
-    write_atomic_if_unchanged(
+    let _candidate_revision = compute_snapshot_revision(&candidate);
+    let revision = write_atomic_if_unchanged(
         config_path.to_path_buf(),
         loaded_revision,
         owner_path,
```

**File**: `src/api/handler/user_routes.rs` (modified, +46/-29)
```diff
@@ -133,38 +133,55 @@ pub(super) async fn handle(
             ));
         }
         let expected_revision = parse_if_match(req.headers());
-        let _mutation_guard = shared.mutation_lock.lock().await;
-        let (disk_cfg, _) =
-            load_config_for_mutation(&shared.config_path, expected_revision.as_deref()).await?;
-        if !disk_cfg.access.users.contains_key(user) {
-            return Ok(error_response(
-                request_id,
-                ApiFailure::new(StatusCode::NOT_FOUND, "not_found", "User not found"),
-            ));
-        }
-        let configured_users = disk_cfg
-            .access
-            .users
-            .keys()
-            .cloned()
-            .collect::<BTreeSet<_>>();
-        let snapshot = match shared.quota_state.reset_user(&configured_users, user).await {
-            Ok(snapshot) => snapshot,
-            Err(error) => {
-                shared.runtime_events.record(
-                    "api.user.reset_quota.failed",
-                    format!("username={} error={}", user, error),
+        let completion_shared = shared.as_ref().clone();
+        let user_owned = user.to_string();
+        let completion = shared
+            .run_mutation_completion(async move {
+                let _mutation_guard = completion_shared.mutation_lock.lock().await;
+                let (disk_cfg, _) = load_config_for_mutation(
+                    &completion_shared.config_path,
+                    expected_revision.as_deref(),
+                )
+                .await?;
+                if !disk_cfg.access.users.contains_key(&user_owned) {
+                    return Err(ApiFailure::new(
+                        StatusCode::NOT_FOUND,
+                        "not_found",
+                        "User not found",
+                    ));
+                }
+                let configured_users = disk_cfg
+                    .access
+                    .users
+                    .keys()
+                    .cloned()
+                    .collect::<BTreeSet<_>>();
+                let snapshot = completion_shared
+                    .quota_state
+                    .reset_user(&configured_users, &user_owned)
+                    .await
+                    .map_err(|error| {
+                        completion_shared.runtime_events.record(
+                            "api.user.reset_quota.failed",
+                            format!("username={} error={}", user_owned, error),
+                        );
+                        ApiFailure::internal(format!("Failed to reset user quota: {}", error))
+                    })?;
+                completion_shared.runtime_events.record(
+                    "api.user.reset_quota.ok",
+                    format!("username={}", user_owned),
                 );
-                return Err(ApiFailure::internal(format!(
-                    "Failed to reset user quota: {}",
-                    error
-                )));
+                let revision = current_revision(&completion_shared.config_path).await?;
+                Ok((snapshot, revision))
+            })
+            .await;
+        let (snapshot, revision) = match completion {
+            Ok(result) => result,
+            Err(error) if error.code == "not_found" => {
+                return Ok(error_response(request_id, error));
             }
+            Err(error) => return Err(error),
         };
-        shared
-            .runtime_events
-            .record("api.user.reset_quota.ok", format!("username={}", user));
-        let revision = current_revision(&shared.config_path).await?;
         return Ok(success_response(
             StatusCode::OK,
             ResetUserQuotaResponse {
```

**File**: `src/api/mod.rs` (modified, +27/-1)
```diff
@@ -17,7 +17,7 @@ use hyper::service::service_fn;
 use hyper::{Method, Request, Response, StatusCode};
 use subtle::ConstantTimeEq;
 use tokio::net::TcpListener;
-use tokio::sync::{Mutex, RwLock, Semaphore, watch};
+use tokio::sync::{Mutex, RwLock, Semaphore, oneshot, watch};
 use tokio::time::timeout;
 use tracing::{debug, info, warn};
 
@@ -134,6 +134,7 @@ pub(super) struct ApiShared {
     pub(super) active_runtime: Arc<ArcSwap<RuntimeGeneration>>,
     pub(super) web_trace: Arc<WebTraceStore>,
     pub(super) web_runtime_rx: watch::Receiver<WebRuntimePublication>,
+    pub(super) control_plane: ProcessControlPlane,
 }
 
 impl ApiShared {
@@ -169,8 +170,32 @@ impl ApiShared {
             active_runtime: self.active_runtime.clone(),
             web_trace: self.web_trace.clone(),
             web_runtime_rx: self.web_runtime_rx.clone(),
+            control_plane: self.control_plane.clone(),
         }
     }
+
+    /// Keeps an accepted mutation alive until persistence and mandatory publication finish.
+    async fn run_mutation_completion<T, F>(&self, future: F) -> Result<T, ApiFailure>
+    where
+        T: Send + 'static,
+        F: std::future::Future<Output = Result<T, ApiFailure>> + Send + 'static,
+    {
+        let (result_tx, result_rx) = oneshot::channel();
+        self.control_plane
+            .spawn_completion(async move {
+                let _ = result_tx.send(future.await);
+            })
+            .map_err(|_| {
+                ApiFailure::new(
+                    StatusCode::SERVICE_UNAVAILABLE,
+                    "control_plane_shutting_down",
+                    "Control plane is shutting down",
+                )
+            })?;
+        result_rx.await.map_err(|_| {
+            ApiFailure::internal("accepted config mutation did not report completion")
+        })?
+    }
 }
 
 fn auth_header_matches(actual: &str, expected: &str) -> bool {
@@ -364,6 +389,7 @@ pub(crate) async fn serve(
         active_runtime,
         web_trace,
         web_runtime_rx,
+        control_plane: control_plane.clone(),
     });
 
     spawn_runtime_watchers(
```

---

### Incident Patch 5: `89dacbd1` (2026-09-19)
**Commit Message**: TOCTOU and lifecycle races across runtime boundaries fixes

**File**: `src/cli/init.rs` (modified, +14/-5)
```diff
@@ -3,6 +3,8 @@ use std::process::Command;
 
 use rand::RngExt;
 
+use crate::util::trusted_command::resolve_trusted_helper;
+
 /// Options for the fire-and-forget init command.
 #[derive(Debug, Clone)]
 pub struct InitOptions {
@@ -165,11 +167,14 @@ pub fn run_init(opts: InitOptions) -> Result<(), Box<dyn std::error::Error>> {
                 eprintln!("[+] Service started");
 
                 std::thread::sleep(std::time::Duration::from_secs(1));
-                let status = Command::new("systemctl")
-                    .args(["is-active", "telemt.service"])
-                    .output();
+                let status = resolve_trusted_helper("systemctl").and_then(|command_path| {
+                    Command::new(command_path)
+                        .args(["is-active", "telemt.service"])
+                        .output()
+                        .ok()
+                });
                 match status {
-                    Ok(out) if out.status.success() => {
+                    Some(out) if out.status.success() => {
                         eprintln!("[+] Service is running");
                     }
                     _ => {
@@ -329,7 +334,11 @@ weight = 10
 }
 
 fn run_cmd(cmd: &str, args: &[&str]) {
-    match Command::new(cmd).args(args).output() {
+    let Some(command_path) = resolve_trusted_helper(cmd) else {
+        eprintln!("[!] Refusing unavailable or untrusted command: {}", cmd);
+        return;
+    };
+    match Command::new(command_path).args(args).output() {
         Ok(output) => {
             if !output.status.success() {
                 let stderr = String::from_utf8_lossy(&output.stderr);
```

**File**: `src/config/load/runtime_auth.rs` (modified, +2/-0)
```diff
@@ -117,12 +117,14 @@ impl UserAuthSnapshot {
         self.entries.get(idx)
     }
 
+    /// Returns the stable credential identity for an exact configured username.
     pub(crate) fn credential_id_by_name(&self, user: &str) -> Option<[u8; 16]> {
         self.user_id_by_name(user)
             .and_then(|user_id| self.entry_by_id(user_id))
             .map(|entry| entry.credential_id)
     }
 
+    /// Returns every bounded authentication candidate sharing a stable hint key.
     pub(crate) fn candidate_ids_by_hint_key(&self, hint_key: u64) -> Option<&[u32]> {
         self.by_hint_key.get(&hint_key).map(Vec::as_slice)
     }
```

**File**: `src/config/load/runtime_web/static_site_fallback.rs` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ use std::path::Path;
 
 use super::*;
 
+/// Builds a bounded static-site snapshot on platforms without directory descriptors.
 pub(super) fn load_static_site_by_path(
     root: &Path,
     limits: &WebLimitsConfig,
```

**File**: `src/conntrack_control/firewall.rs` (modified, +8/-0)
```diff
@@ -13,6 +13,7 @@ use crate::util::trusted_command::resolve_trusted_helper;
 
 use super::{ConntrackRuntimeSupport, NetfilterBackend};
 
+/// Reconciles kernel NOTRACK rules with the active listener policy.
 pub(super) async fn reconcile_rules(
     cfg: &ProxyConfig,
     runtime_support: ConntrackRuntimeSupport,
@@ -45,6 +46,7 @@ pub(super) async fn reconcile_rules(
     }
 }
 
+/// Probes the effective firewall backend and conntrack deletion capability.
 pub(super) fn probe_runtime_support(
     configured_backend: ConntrackBackend,
 ) -> ConntrackRuntimeSupport {
@@ -55,6 +57,7 @@ pub(super) fn probe_runtime_support(
     }
 }
 
+/// Resolves whether conntrack close publication is usable for this runtime.
 pub(super) fn effective_conntrack_enabled(
     cfg: &ProxyConfig,
     runtime_support: ConntrackRuntimeSupport,
@@ -317,12 +320,17 @@ async fn clear_notrack_rules_all_backends() {
     let _ = run_command("ip6tables", &["-t", "raw", "-X", "TELEMT_NOTRACK"], None).await;
 }
 
+/// Result of one best-effort kernel conntrack deletion.
 pub(super) enum DeleteOutcome {
+    /// The kernel reported successful deletion.
     Deleted,
+    /// No matching conntrack entry existed.
     NotFound,
+    /// The helper was unavailable or returned an unexpected failure.
     Error,
 }
 
+/// Deletes the exact TCP tuple represented by one close event.
 pub(super) async fn delete_conntrack_entry(event: ConntrackCloseEvent) -> DeleteOutcome {
     if !command_exists("conntrack") {
         return DeleteOutcome::Error;
```

**File**: `src/daemon/pid_file.rs` (modified, +37/-10)
```diff
@@ -1,7 +1,7 @@
 use std::ffi::OsStr;
 use std::fs::{self, File};
 use std::io::{self, ErrorKind, Read, Write};
-use std::os::unix::fs::MetadataExt;
+use std::os::unix::fs::{MetadataExt, PermissionsExt};
 #[cfg(target_os = "linux")]
 use std::os::fd::{FromRawFd, OwnedFd};
 use std::path::{Path, PathBuf};
@@ -42,7 +42,7 @@ impl FileIdentity {
 impl PidFile {
     /// Creates a new PID file manager for the given path.
     pub fn new<P: AsRef<Path>>(path: P) -> Self {
-        let path = path.as_ref().to_path_buf();
+        let path = normalize_pid_path(path.as_ref());
         let lock_path = sibling_lock_path(&path);
         Self {
             path,
@@ -209,6 +209,33 @@ fn sibling_lock_path(path: &Path) -> PathBuf {
     lock_path.into()
 }
 
+fn normalize_pid_path(path: &Path) -> PathBuf {
+    let legacy_run = Path::new("/var/run");
+    let Ok(remainder) = path.strip_prefix(legacy_run) else {
+        return path.to_path_buf();
+    };
+    let Ok(var_metadata) = fs::metadata("/var") else {
+        return path.to_path_buf();
+    };
+    let Ok(link_metadata) = fs::symlink_metadata(legacy_run) else {
+        return path.to_path_buf();
+    };
+    let Ok(target) = fs::read_link(legacy_run) else {
+        return path.to_path_buf();
+    };
+    let trusted_var = var_metadata.is_dir()
+        && var_metadata.uid() == 0
+        && var_metadata.permissions().mode() & 0o022 == 0;
+    let trusted_alias = link_metadata.file_type().is_symlink()
+        && link_metadata.uid() == 0
+        && (target == Path::new("/run") || target == Path::new("../run"));
+    if trusted_var && trusted_alias {
+        Path::new("/run").join(remainder)
+    } else {
+        path.to_path_buf()
+    }
+}
+
 fn open_file_at(
     anchor: &AnchoredPath,
     name: &OsStr,
@@ -343,8 +370,8 @@ fn validate_regular_single_link(
 /// Reads a PID from a PID file.
 #[allow(dead_code)]
 pub fn read_pid_file<P: AsRef<Path>>(path: P) -> Result<i32, DaemonError> {
-    let path = path.as_ref();
-    read_pid_file_if_exists(path)?.ok_or_else(|| {
+    let path = normalize_pid_path(path.as_ref());
+    read_pid_file_if_exists(&path)?.ok_or_else(|| {
         DaemonError::PidFile(format!(
             "cannot read {}: file does not exist",
             path.display()
@@ -358,11 +385,11 @@ pub fn signal_pid_file<P: AsRef<Path>>(
     path: P,
     signal: nix::sys::signal::Signal,
 ) -> Result<(), DaemonError> {
-    let path = path.as_ref();
-    let pid = read_pid_file(path)?;
+    let path = normalize_pid_path(path.as_ref());
+    let pid = read_pid_file(&path)?;
     #[cfg(target_os = "linux")]
     let pidfd = open_pidfd(pid)?;
-    if !daemon_lock_is_held(path)? {
+    if !daemon_lock_is_held(&path)? {
         return Err(DaemonError::PidFile(format!(
             "refusing to signal unlocked or stale PID file {}",
             path.display()
@@ -390,10 +417,10 @@ pub enum DaemonStatus {
 /// Checks daemon status without modifying the PID or lock file.
 #[allow(dead_code)]
 pub fn check_status<P: AsRef<Path>>(path: P) -> DaemonStatus {
-    let path = path.as_ref();
-    match read_pid_file_if_exists(path) {
+    let path = normalize_pid_path(path.as_ref());
+    match read_pid_file_if_exists(&path) {
         Ok(Some(pid))
-            if daemon_lock_is_held(path).unwrap_or(false) && is_process_running(pid) =>
+            if daemon_lock_is_held(&path).unwrap_or(false) && is_process_running(pid) =>
         {
             DaemonStatus::Running(pid)
         }
```

---

### Incident Patch 6: `9a683d8b` (2026-09-16)
**Commit Message**: Slot Budget + Config Store Atomic Writer fixes + Trusted Command

**File**: `src/api/config_edit.rs` (modified, +27/-3)
```diff
@@ -9,8 +9,11 @@ use super::ApiShared;
 use super::config_store::{
     EDITABLE_SECTIONS, EDITABLE_SERVER_FIELDS, compute_snapshot_revision, is_editable_section,
     load_candidate_snapshot, load_config_snapshot, render_server_listeners,
-    render_top_level_section, resolve_single_source_owner, upsert_toml_table, write_atomic,
+    render_top_level_section, resolve_single_source_owner, upsert_toml_table,
+    write_atomic_if_unchanged,
 };
+#[cfg(test)]
+use super::config_store::write_atomic;
 use super::model::ApiFailure;
 use crate::config::ProxyConfig;
 use crate::config::hot_reload::classify_config_changes;
@@ -43,7 +46,10 @@ pub(super) struct PatchConfigResponse {
 }
 
 struct PreparedConfigPatch {
+    config_path: PathBuf,
+    expected_revision: String,
     owner_path: PathBuf,
+    expected_owner_contents: String,
     owner_contents: String,
     desired_config: Arc<ProxyConfig>,
     response: PatchConfigResponse,
@@ -77,7 +83,14 @@ pub(super) async fn patch_config(
     } else {
         None
     };
-    write_atomic(prepared.owner_path, prepared.owner_contents).await?;
+    write_atomic_if_unchanged(
+        prepared.config_path,
+        prepared.expected_revision,
+        prepared.owner_path,
+        prepared.expected_owner_contents,
+        prepared.owner_contents,
+    )
+    .await?;
     if let Some(reservation) = reservation {
         prepared.response.reload = Some(reservation.enqueue(prepared.desired_config));
     }
@@ -111,7 +124,14 @@ pub(super) async fn apply_patch_to_path(
     expected_revision: Option<String>,
 ) -> Result<PatchConfigResponse, ApiFailure> {
     let prepared = prepare_patch_to_path(config_path, patch_json, expected_revision).await?;
-    write_atomic(prepared.owner_path, prepared.owner_contents).await?;
+    write_atomic_if_unchanged(
+        prepared.config_path,
+        prepared.expected_revision,
+        prepared.owner_path,
+        prepared.expected_owner_contents,
+        prepared.owner_contents,
+    )
+    .await?;
     Ok(prepared.response)
 }
 
@@ -197,6 +217,7 @@ async fn prepare_patch_to_path(
         .get(&owner_path)
         .cloned()
         .ok_or_else(|| ApiFailure::internal("config source owner is missing from snapshot"))?;
+    let expected_owner_contents = owner_contents.clone();
     for section in &touched {
         if *section == "server" {
             let rendered = render_server_listeners(&requested_cfg)?;
@@ -233,7 +254,10 @@ async fn prepare_patch_to_path(
         deferred_process_fields(&old_cfg, &new_cfg).map_err(ApiFailure::bad_request)?;
 
     Ok(PreparedConfigPatch {
+        config_path: config_path.to_path_buf(),
+        expected_revision: current,
         owner_path,
+        expected_owner_contents,
         owner_contents,
         desired_config: Arc::new(new_cfg),
         response: PatchConfigResponse {
```

**File**: `src/api/config_edit/tests.rs` (modified, +24/-0)
```diff
@@ -323,6 +323,30 @@ async fn patch_writes_the_included_section_owner_only() {
     );
 }
 
+#[tokio::test]
+async fn prepared_patch_rejects_external_edit_before_commit() {
+    let (path, _directory) = temp_config("[censorship]\ntls_domain = \"old.example\"\n");
+    let patch: Json = serde_json::json!({
+        "censorship": {"tls_domain": "api.example"}
+    });
+    let prepared = prepare_patch_to_path(&path, &patch, None).await.unwrap();
+    let external = "[censorship]\ntls_domain = \"external.example\"\n";
+    tokio::fs::write(&path, external).await.unwrap();
+
+    let error = write_atomic_if_unchanged(
+        prepared.config_path,
+        prepared.expected_revision,
+        prepared.owner_path,
+        prepared.expected_owner_contents,
+        prepared.owner_contents,
+    )
+    .await
+    .unwrap_err();
+
+    assert_eq!(error.code, "revision_conflict");
+    assert_eq!(tokio::fs::read_to_string(&path).await.unwrap(), external);
+}
+
 #[tokio::test]
 async fn patch_rejects_multiple_source_owners_without_writing() {
     let dir = tempfile::tempdir().unwrap();
```

**File**: `src/api/config_store.rs` (modified, +11/-9)
```diff
@@ -10,13 +10,16 @@ use super::model::ApiFailure;
 
 // Source-preserving TOML rendering and atomic persistence helpers.
 mod persistence;
+// Compare-and-replace file persistence and metadata preservation.
+mod atomic;
 
 #[cfg(test)]
 use persistence::{find_toml_table_bounds, render_access_section, save_sections_to_disk};
 pub(in crate::api) use persistence::{
     render_server_listeners, render_top_level_section, save_access_sections_to_disk,
-    upsert_toml_table, write_atomic,
+    save_access_sections_to_disk_if_revision, upsert_toml_table,
 };
+pub(in crate::api) use atomic::{write_atomic, write_atomic_if_unchanged};
 
 #[derive(Clone, Copy, Debug, PartialEq, Eq)]
 pub(super) enum AccessSection {
@@ -54,22 +57,21 @@ pub(super) fn parse_if_match(headers: &hyper::HeaderMap) -> Option<String> {
         .map(|value| value.trim_matches('"').to_string())
 }
 
-pub(super) async fn ensure_expected_revision(
+/// Loads one mutation base and validates its revision from the same source snapshot.
+pub(super) async fn load_config_for_mutation(
     config_path: &Path,
     expected_revision: Option<&str>,
-) -> Result<(), ApiFailure> {
-    let Some(expected) = expected_revision else {
-        return Ok(());
-    };
-    let current = current_revision(config_path).await?;
-    if current != expected {
+) -> Result<(ProxyConfig, String), ApiFailure> {
+    let loaded = load_config_snapshot(config_path, false).await?;
+    let revision = compute_snapshot_revision(&loaded);
+    if expected_revision.is_some_and(|expected| expected != revision) {
         return Err(ApiFailure::new(
             hyper::StatusCode::CONFLICT,
             "revision_conflict",
             "Config revision mismatch",
         ));
     }
-    Ok(())
+    Ok((loaded.config, revision))
 }
 
 pub(super) async fn current_revision(config_path: &Path) -> Result<String, ApiFailure> {
```

**File**: `src/api/config_store/atomic.rs` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+use std::io::{Read, Write};
+use std::path::{Path, PathBuf};
+
+#[cfg(unix)]
+use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
+
+use super::compute_source_revision;
+use crate::api::model::ApiFailure;
+use crate::config::ProxyConfig;
+
+enum AtomicWriteError {
+    Conflict,
+    ReadGraph(String),
+    Io(std::io::Error),
+}
+
+struct ExistingTarget {
+    contents: String,
+    metadata: std::fs::Metadata,
+}
+
+/// Replaces one config source through a durable same-directory rename.
+pub(in crate::api) async fn write_atomic(
+    path: PathBuf,
+    contents: String,
+) -> Result<(), ApiFailure> {
+    tokio::task::spawn_blocking(move || write_atomic_sync(&path, None, &contents))
+        .await
+        .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
+        .map_err(|error| ApiFailure::internal(format!("failed to write config: {error}")))
+}
+
+/// Replaces one source only if both its graph revision and owner contents are unchanged.
+pub(in crate::api) async fn write_atomic_if_unchanged(
+    config_path: PathBuf,
+    expected_revision: String,
+    path: PathBuf,
+    expected_contents: String,
+    contents: String,
+) -> Result<(), ApiFailure> {
+    tokio::task::spawn_blocking(move || {
+        let graph = ProxyConfig::read_source_graph(&config_path)
+            .map_err(|error| AtomicWriteError::ReadGraph(error.to_string()))?;
+        if compute_source_revision(&graph) != expected_revision {
+            return Err(AtomicWriteError::Conflict);
+        }
+        write_atomic_sync(&path, Some(&expected_contents), &contents).map_err(|error| {
+            if error.kind() == std::io::ErrorKind::AlreadyExists {
+                AtomicWriteError::Conflict
+            } else {
+                AtomicWriteError::Io(error)
+            }
+        })
+    })
+    .await
+    .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
+    .map_err(|error| match error {
+        AtomicWriteError::Conflict => revision_conflict(),
+        AtomicWriteError::ReadGraph(error) => {
+            ApiFailure::internal(format!("failed to verify config graph: {error}"))
+        }
+        AtomicWriteError::Io(error) => {
+            ApiFailure::internal(format!("failed to write config: {error}"))
+        }
+    })
+}
+
+fn revision_conflict() -> ApiFailure {
+    ApiFailure::new(
+        hyper::StatusCode::CONFLICT,
+        "revision_conflict",
+        "Config revision changed before persistence",
+    )
+}
+
+fn open_existing_target(path: &Path) -> std::io::Result<Option<ExistingTarget>> {
+    let mut options = std::fs::OpenOptions::new();
+    options.read(true);
+    #[cfg(unix)]
+    options.custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW);
+    let mut file = match options.open(path) {
+        Ok(file) => file,
+        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
+        Err(error) => return Err(error),
+    };
+    let metadata = file.metadata()?;
+    if !metadata.is_file() {
+        return Err(std::io::Error::new(
+            std::io::ErrorKind::InvalidInput,
+            "config target must be a regular file",
+        ));
+    }
+    let mut contents = String::new();
+    file.read_to_string(&mut contents)?;
+    Ok(Some(ExistingTarget { contents, metadata }))
+}
+
+fn same_target(left: &std::fs::Metadata, right: &std::fs::Metadata) -> bool {
+    #[cfg(unix)]
+    {
+        left.dev() == right.dev() && left.ino() == right.ino()
+    }
+    #[cfg(not(unix))]
+    {
+        left.len() == right.len() && left.modified().ok() == right.modified().ok()
+    }
+}
+
+fn write_atomic_sync(
+    path: &Path,
+    expected_contents: Option<&str>,
+    contents: &str,
+) -> std::io::Result<()> {
+    let parent = path.parent().unwrap_or_else(|| Path::new("."));
+    std::fs::create_dir_all(parent)?;
+    let existing = open_existing_target(path)?;
+    if expected_contents.is_some_and(|ex
```

**File**: `src/api/config_store/persistence.rs` (modified, +6/-171)
```diff
@@ -1,9 +1,5 @@
 use std::collections::BTreeMap;
-use std::io::{Read, Write};
-use std::path::{Path, PathBuf};
-
-#[cfg(unix)]
-use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
+use std::path::Path;
 
 use chrono::{DateTime, Utc};
 use serde::Serialize;
@@ -13,9 +9,12 @@ use crate::config::{ProxyConfig, RateLimitBps};
 #[cfg(test)]
 use super::compute_revision;
 use super::{
-    AccessSection, compute_snapshot_revision, compute_source_revision, load_candidate_snapshot,
-    load_config_snapshot, resolve_single_source_owner, toml_path_exists,
+    AccessSection, compute_snapshot_revision, load_candidate_snapshot, load_config_snapshot,
+    resolve_single_source_owner, toml_path_exists,
 };
+use super::atomic::write_atomic_if_unchanged;
+#[cfg(test)]
+use super::atomic::write_atomic;
 use crate::api::model::ApiFailure;
 
 /// Re-render the given top-level tables from `cfg` and upsert each into the
@@ -398,174 +397,10 @@ fn find_all_table_blocks(source: &str, table_name: &str) -> Vec<(usize, usize)>
     blocks
 }
 
-/// Replaces one config source through a durable same-directory rename.
-pub(in crate::api) async fn write_atomic(
-    path: PathBuf,
-    contents: String,
-) -> Result<(), ApiFailure> {
-    tokio::task::spawn_blocking(move || write_atomic_sync(&path, None, &contents))
-        .await
-        .map_err(|e| ApiFailure::internal(format!("failed to join writer: {}", e)))?
-        .map_err(|e| ApiFailure::internal(format!("failed to write config: {}", e)))
-}
-
-/// Replaces one source only if both its graph revision and owner contents are unchanged.
-pub(in crate::api) async fn write_atomic_if_unchanged(
-    config_path: PathBuf,
-    expected_revision: String,
-    path: PathBuf,
-    expected_contents: String,
-    contents: String,
-) -> Result<(), ApiFailure> {
-    tokio::task::spawn_blocking(move || {
-        let graph = ProxyConfig::read_source_graph(&config_path)
-            .map_err(|error| AtomicWriteError::ReadGraph(error.to_string()))?;
-        if compute_source_revision(&graph) != expected_revision {
-            return Err(AtomicWriteError::Conflict);
-        }
-        write_atomic_sync(&path, Some(&expected_contents), &contents)
-            .map_err(AtomicWriteError::Io)
-    })
-    .await
-    .map_err(|error| ApiFailure::internal(format!("failed to join writer: {error}")))?
-    .map_err(|error| match error {
-        AtomicWriteError::Conflict => revision_conflict(),
-        AtomicWriteError::ReadGraph(error) => {
-            ApiFailure::internal(format!("failed to verify config graph: {error}"))
-        }
-        AtomicWriteError::Io(error) => {
-            ApiFailure::internal(format!("failed to write config: {error}"))
-        }
-    })
-}
-
-enum AtomicWriteError {
-    Conflict,
-    ReadGraph(String),
-    Io(std::io::Error),
-}
-
-struct ExistingTarget {
-    contents: String,
-    metadata: std::fs::Metadata,
-}
-
 fn revision_conflict() -> ApiFailure {
     ApiFailure::new(
         hyper::StatusCode::CONFLICT,
         "revision_conflict",
         "Config revision changed before persistence",
     )
 }
-
-fn open_existing_target(path: &Path) -> std::io::Result<Option<ExistingTarget>> {
-    let mut options = std::fs::OpenOptions::new();
-    options.read(true);
-    #[cfg(unix)]
-    options.custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW);
-    let mut file = match options.open(path) {
-        Ok(file) => file,
-        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
-        Err(error) => return Err(error),
-    };
-    let metadata = file.metadata()?;
-    if !metadata.is_file() {
-        return Err(std::io::Error::new(
-            std::io::ErrorKind::InvalidInput,
-            "config target must be a regular file",
-        ));
-    }
-    let mut contents = String::new();
-    file.read_to_string(&mut contents)?;
-    Ok(Some(ExistingTarget { contents, metadata }))
-}
-
-fn same_target(left: &std::fs::Metadata, r
```

---

### Incident Patch 7: `844e41ea` (2026-09-09)
**Commit Message**: Races in admission + accounting + publication,+ PID fixed

**File**: `src/api/handler/fixed_routes.rs` (modified, +1/-4)
```diff
@@ -35,13 +35,10 @@ pub(super) async fn create_user_route(
     let runtime_cfg = config_rx.borrow().clone();
     data.user.in_runtime = runtime_cfg.access.users.contains_key(&data.user.username);
     if let Some(enabled) = requested_enabled {
-        shared
+        let (_, cancelled) = shared
             .proxy_shared
             .set_user_enabled(&data.user.username, enabled);
         if !enabled {
-            let cancelled = shared
-                .proxy_shared
-                .cancel_user_sessions(&data.user.username);
             if cancelled > 0 {
                 shared.runtime_events.record(
                     "api.user.disable.runtime",
```

**File**: `src/api/handler/user_routes.rs` (modified, +2/-4)
```diff
@@ -104,8 +104,7 @@ pub(super) async fn handle(
         };
         let runtime_cfg = config_rx.borrow().clone();
         data.in_runtime = runtime_cfg.access.users.contains_key(&data.username);
-        let newly_disabled = shared.proxy_shared.set_user_enabled(base_user, false);
-        let cancelled = shared.proxy_shared.cancel_user_sessions(base_user);
+        let (newly_disabled, cancelled) = shared.proxy_shared.set_user_enabled(base_user, false);
         shared.runtime_events.record(
             "api.user.disable.ok",
             format!(
@@ -290,11 +289,10 @@ pub(super) async fn handle(
             let runtime_cfg = config_rx.borrow().clone();
             data.in_runtime = runtime_cfg.access.users.contains_key(&data.username);
             if let Some(enabled) = enabled_update {
-                shared
+                let (_, cancelled) = shared
                     .proxy_shared
                     .set_user_enabled(&data.username, enabled);
                 if !enabled {
-                    let cancelled = shared.proxy_shared.cancel_user_sessions(&data.username);
                     shared.runtime_events.record(
                         "api.user.disable.runtime",
                         format!(
```

**File**: `src/cli.rs` (modified, +23/-496)
```diff
@@ -8,15 +8,22 @@
 //! - `run [OPTIONS] [config.toml]` - Run in foreground (default behavior)
 //! - `healthcheck [OPTIONS] [config.toml]` - Run control-plane health probe
 
-use rand::RngExt;
-use std::fs;
-use std::path::{Path, PathBuf};
-use std::process::Command;
+use std::path::PathBuf;
 
 use crate::healthcheck::{self, HealthcheckMode};
 
 #[cfg(unix)]
-use crate::daemon::{self, DEFAULT_PID_FILE, DaemonOptions};
+use crate::daemon::{DEFAULT_PID_FILE, DaemonOptions};
+
+// Unix daemon control and argument parsing.
+#[cfg(unix)]
+mod daemon_commands;
+// Fire-and-forget installation workflow.
+mod init;
+
+#[cfg(unix)]
+pub use daemon_commands::parse_daemon_args;
+pub use init::{InitOptions, parse_init_args, run_init};
 
 /// CLI subcommand to execute.
 #[derive(Debug, Clone, PartialEq, Eq)]
@@ -40,13 +47,20 @@ pub enum Subcommand {
 /// Parsed subcommand with its options.
 #[derive(Debug)]
 pub struct ParsedCommand {
+    /// Selected command mode.
     pub subcommand: Subcommand,
+    /// PID file used by daemon-control commands.
     pub pid_file: PathBuf,
+    /// Configuration file passed to runtime or healthcheck.
     pub config_path: String,
+    /// Requested healthcheck mode.
     pub healthcheck_mode: HealthcheckMode,
+    /// Invalid healthcheck mode retained for command diagnostics.
     pub healthcheck_mode_invalid: Option<String>,
     #[cfg(unix)]
+    /// Unix daemon lifecycle options.
     pub daemon_opts: DaemonOptions,
+    /// Fire-and-forget initialization options.
     pub init_opts: Option<InitOptions>,
 }
 
@@ -79,7 +93,6 @@ pub fn parse_command(args: &[String]) -> ParsedCommand {
         return cmd;
     }
 
-    // Check for subcommand as first argument
     if let Some(first) = args.first() {
         match first.as_str() {
             "start" => {
@@ -120,11 +133,9 @@ pub fn parse_command(args: &[String]) -> ParsedCommand {
         }
     }
 
-    // Parse remaining options
     let mut i = 0;
     while i < args.len() {
         match args[i].as_str() {
-            // Skip subcommand names
             "start" | "stop" | "reload" | "status" | "run" | "healthcheck" => {}
             "--mode" => {
                 i += 1;
@@ -154,7 +165,6 @@ pub fn parse_command(args: &[String]) -> ParsedCommand {
                     }
                 }
             }
-            // PID file option (for stop/reload/status)
             "--pid-file" => {
                 i += 1;
                 if i < args.len() {
@@ -189,9 +199,9 @@ pub fn parse_command(args: &[String]) -> ParsedCommand {
 #[cfg(unix)]
 pub fn execute_subcommand(cmd: &ParsedCommand) -> Option<i32> {
     match cmd.subcommand {
-        Subcommand::Stop => Some(cmd_stop(&cmd.pid_file)),
-        Subcommand::Reload => Some(cmd_reload(&cmd.pid_file)),
-        Subcommand::Status => Some(cmd_status(&cmd.pid_file)),
+        Subcommand::Stop => Some(daemon_commands::stop(&cmd.pid_file)),
+        Subcommand::Reload => Some(daemon_commands::reload(&cmd.pid_file)),
+        Subcommand::Status => Some(daemon_commands::status(&cmd.pid_file)),
         Subcommand::Healthcheck => {
             if let Some(invalid_mode) = cmd.healthcheck_mode_invalid.as_ref() {
                 if invalid_mode.is_empty() {
@@ -224,6 +234,7 @@ pub fn execute_subcommand(cmd: &ParsedCommand) -> Option<i32> {
     }
 }
 
+/// Executes a non-server subcommand on platforms without daemon support.
 #[cfg(not(unix))]
 pub fn execute_subcommand(cmd: &ParsedCommand) -> Option<i32> {
     match cmd.subcommand {
@@ -261,487 +272,3 @@ pub fn execute_subcommand(cmd: &ParsedCommand) -> Option<i32> {
         Subcommand::Run | Subcommand::Start => None,
     }
 }
-
-/// Stop command: send SIGTERM to the running daemon.
-#[cfg(unix)]
-fn cmd_stop(pid_file: &Path) -> i32 {
-    use nix::sys::signal::Signal;
-
-    println!("Stopping telemt daemon...");
-
-    match daemon::signal_pid_file(pid_file, Signal::SIGTERM) {
-        Ok(()) => {
-            println!("Stop signal sent succ
```

**File**: `src/cli/daemon_commands.rs` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+use std::path::{Path, PathBuf};
+
+use crate::daemon::{self, DaemonOptions};
+
+/// Parses daemon-related options from CLI arguments.
+pub fn parse_daemon_args(args: &[String]) -> DaemonOptions {
+    let mut opts = DaemonOptions::default();
+    let mut i = 0;
+
+    while i < args.len() {
+        match args[i].as_str() {
+            "--daemon" | "-d" => {
+                opts.daemonize = true;
+            }
+            "--foreground" | "-f" => {
+                opts.foreground = true;
+            }
+            "--pid-file" => {
+                i += 1;
+                if i < args.len() {
+                    opts.pid_file = Some(PathBuf::from(&args[i]));
+                }
+            }
+            s if s.starts_with("--pid-file=") => {
+                opts.pid_file = Some(PathBuf::from(s.trim_start_matches("--pid-file=")));
+            }
+            "--run-as-user" => {
+                i += 1;
+                if i < args.len() {
+                    opts.user = Some(args[i].clone());
+                }
+            }
+            s if s.starts_with("--run-as-user=") => {
+                opts.user = Some(s.trim_start_matches("--run-as-user=").to_string());
+            }
+            "--run-as-group" => {
+                i += 1;
+                if i < args.len() {
+                    opts.group = Some(args[i].clone());
+                }
+            }
+            s if s.starts_with("--run-as-group=") => {
+                opts.group = Some(s.trim_start_matches("--run-as-group=").to_string());
+            }
+            "--working-dir" => {
+                i += 1;
+                if i < args.len() {
+                    opts.working_dir = Some(PathBuf::from(&args[i]));
+                }
+            }
+            s if s.starts_with("--working-dir=") => {
+                opts.working_dir = Some(PathBuf::from(s.trim_start_matches("--working-dir=")));
+            }
+            _ => {}
+        }
+        i += 1;
+    }
+
+    opts
+}
+
+/// Sends SIGTERM and waits briefly for graceful PID-file cleanup.
+pub(super) fn stop(pid_file: &Path) -> i32 {
+    use nix::sys::signal::Signal;
+
+    println!("Stopping telemt daemon...");
+
+    match daemon::signal_pid_file(pid_file, Signal::SIGTERM) {
+        Ok(()) => {
+            println!("Stop signal sent successfully");
+
+            // Wait for process to exit for up to ten seconds.
+            for _ in 0..20 {
+                std::thread::sleep(std::time::Duration::from_millis(500));
+                if let daemon::DaemonStatus::NotRunning = daemon::check_status(pid_file) {
+                    println!("Daemon stopped");
+                    return 0;
+                }
+            }
+            println!("Daemon may still be shutting down");
+            0
+        }
+        Err(e) => {
+            eprintln!("Failed to stop daemon: {}", e);
+            1
+        }
+    }
+}
+
+/// Sends SIGHUP to trigger configuration reload.
+pub(super) fn reload(pid_file: &Path) -> i32 {
+    use nix::sys::signal::Signal;
+
+    println!("Reloading telemt configuration...");
+
+    match daemon::signal_pid_file(pid_file, Signal::SIGHUP) {
+        Ok(()) => {
+            println!("Reload signal sent successfully");
+            0
+        }
+        Err(e) => {
+            eprintln!("Failed to reload daemon: {}", e);
+            1
+        }
+    }
+}
+
+/// Reports daemon status without mutating PID lifecycle state.
+pub(super) fn status(pid_file: &Path) -> i32 {
+    match daemon::check_status(pid_file) {
+        daemon::DaemonStatus::Running(pid) => {
+            println!("telemt is running (pid {})", pid);
+            0
+        }
+        daemon::DaemonStatus::Stale(pid) => {
+            println!("telemt is not running (stale pid file, was pid {})", pid);
+            1
+        }
+        daemon::DaemonStatus::NotRunning => {
+            println!("telemt is not running");
+            1
+        }
+    }
+}
+
+#[cfg(test)]
```

**File**: `src/cli/init.rs` (added, +353/-0)
```diff
@@ -0,0 +1,353 @@
+use std::fs;
+use std::path::{Path, PathBuf};
+use std::process::Command;
+
+use rand::RngExt;
+
+/// Options for the fire-and-forget init command.
+#[derive(Debug, Clone)]
+pub struct InitOptions {
+    /// Public listener port.
+    pub port: u16,
+    /// TLS camouflage domain.
+    pub domain: String,
+    /// Optional pre-generated proxy secret.
+    pub secret: Option<String>,
+    /// Initial access username.
+    pub username: String,
+    /// Destination directory for generated configuration.
+    pub config_dir: PathBuf,
+    /// Generate service files without starting the service.
+    pub no_start: bool,
+}
+
+impl Default for InitOptions {
+    fn default() -> Self {
+        Self {
+            port: 443,
+            domain: "www.google.com".to_string(),
+            secret: None,
+            username: "user".to_string(),
+            config_dir: PathBuf::from("/etc/telemt"),
+            no_start: false,
+        }
+    }
+}
+
+/// Parse --init subcommand options from CLI args.
+///
+/// Returns `Some(InitOptions)` if `--init` was found, `None` otherwise.
+pub fn parse_init_args(args: &[String]) -> Option<InitOptions> {
+    if !args.iter().any(|a| a == "--init") {
+        return None;
+    }
+
+    let mut opts = InitOptions::default();
+    let mut i = 0;
+
+    while i < args.len() {
+        match args[i].as_str() {
+            "--port" => {
+                i += 1;
+                if i < args.len() {
+                    opts.port = args[i].parse().unwrap_or(443);
+                }
+            }
+            "--domain" => {
+                i += 1;
+                if i < args.len() {
+                    opts.domain = args[i].clone();
+                }
+            }
+            "--secret" => {
+                i += 1;
+                if i < args.len() {
+                    opts.secret = Some(args[i].clone());
+                }
+            }
+            "--user" => {
+                i += 1;
+                if i < args.len() {
+                    opts.username = args[i].clone();
+                }
+            }
+            "--config-dir" => {
+                i += 1;
+                if i < args.len() {
+                    opts.config_dir = PathBuf::from(&args[i]);
+                }
+            }
+            "--no-start" => {
+                opts.no_start = true;
+            }
+            _ => {}
+        }
+        i += 1;
+    }
+
+    Some(opts)
+}
+
+/// Run the fire-and-forget setup.
+pub fn run_init(opts: InitOptions) -> Result<(), Box<dyn std::error::Error>> {
+    use crate::service::{self, InitSystem, ServiceOptions};
+
+    eprintln!("[telemt] Fire-and-forget setup");
+    eprintln!();
+
+    let init_system = service::detect_init_system();
+    eprintln!("[+] Detected init system: {}", init_system);
+
+    let secret = match opts.secret {
+        Some(s) => {
+            if s.len() != 32 || !s.chars().all(|c| c.is_ascii_hexdigit()) {
+                eprintln!("[error] Secret must be exactly 32 hex characters");
+                std::process::exit(1);
+            }
+            s
+        }
+        None => generate_secret(),
+    };
+
+    eprintln!("[+] Secret: {}", secret);
+    eprintln!("[+] User:   {}", opts.username);
+    eprintln!("[+] Port:   {}", opts.port);
+    eprintln!("[+] Domain: {}", opts.domain);
+
+    fs::create_dir_all(&opts.config_dir)?;
+    let config_path = opts.config_dir.join("config.toml");
+    let config_content = generate_config(&opts.username, &secret, opts.port, &opts.domain);
+    fs::write(&config_path, &config_content)?;
+    eprintln!("[+] Config written to {}", config_path.display());
+
+    let exe_path =
+        std::env::current_exe().unwrap_or_else(|_| PathBuf::from("/usr/local/bin/telemt"));
+    let service_opts = ServiceOptions {
+        exe_path: &exe_path,
+        config_path: &config_path,
+        // Let the selected init system manage process identity.
+        user: None,
+        group: None,
+
```

---

### Incident Patch 8: `4e3d560a` (2026-09-06)
**Commit Message**: Merge pull request #919 from nikoano/fix/install-port-check-tcp-only

fix(install): probe only TCP when validating the target port

**File**: `install.sh` (modified, +2/-2)
```diff
@@ -447,9 +447,9 @@ check_port_availability() {
     port_info=""
 
     if command -v ss >/dev/null 2>&1; then
-        port_info=$($SUDO ss -tulnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
+        port_info=$($SUDO ss -tlnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
     elif command -v netstat >/dev/null 2>&1; then
-        port_info=$($SUDO netstat -tulnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
+        port_info=$($SUDO netstat -tlnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
     elif command -v lsof >/dev/null 2>&1; then
         port_info=$($SUDO lsof -i :${SERVER_PORT} 2>/dev/null | grep LISTEN || true)
     else
```

---

### Incident Patch 9: `9908e04e` (2026-09-05)
**Commit Message**: fix(install): probe only TCP when validating the target port

**File**: `install.sh` (modified, +2/-2)
```diff
@@ -447,9 +447,9 @@ check_port_availability() {
     port_info=""
 
     if command -v ss >/dev/null 2>&1; then
-        port_info=$($SUDO ss -tulnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
+        port_info=$($SUDO ss -tlnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
     elif command -v netstat >/dev/null 2>&1; then
-        port_info=$($SUDO netstat -tulnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
+        port_info=$($SUDO netstat -tlnp 2>/dev/null | grep -E ":${SERVER_PORT}([[:space:]]|$)" || true)
     elif command -v lsof >/dev/null 2>&1; then
         port_info=$($SUDO lsof -i :${SERVER_PORT} 2>/dev/null | grep LISTEN || true)
     else
```

---

### Incident Patch 10: `0d044c73` (2026-09-03)
**Commit Message**: WEB WS Downlink correctness + peer-lease fixed

Co-Authored-By: brekotis <93345790+brekotis@users.noreply.github.com>

**File**: `src/web/http/websocket/driver.rs` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ async fn run_multiplex(
     let maximum_message = session.limits().carrier_batch_bytes;
     let mut active = false;
     loop {
-        let down = session.poll_down(cursor);
+        let down = session.poll_down_websocket(cursor);
         tokio::pin!(down);
         let event = tokio::select! {
             _ = cancellation.cancelled() => return Err(()),
```

**File**: `src/web/session/downlink.rs` (modified, +30/-10)
```diff
@@ -15,6 +15,14 @@ use crate::web::telemetry::WebSessionLifecycleObservation;
 impl WebSession {
     /// Polls pending downlink frames with cursor replay and newest-poll-wins semantics.
     pub(crate) async fn poll_down(&self, cursor: u64) -> Result<PollResult, ManagerError> {
+        self.poll_down_inner(cursor, true).await
+    }
+
+    async fn poll_down_inner(
+        &self,
+        cursor: u64,
+        peer_activity: bool,
+    ) -> Result<PollResult, ManagerError> {
         if !self.carrier().is_multiplexed() {
             return Err(ManagerError::Protocol);
         }
@@ -30,11 +38,13 @@ impl WebSession {
                         next_cursor: unacked.next_cursor,
                         lane_closed: false,
                     };
-                    self.touch_peer_locked(
-                        &mut state,
-                        Instant::now(),
-                        WebSessionLifecycleObservation::HttpActivityAfterGap,
-                    );
+                    if peer_activity {
+                        self.touch_peer_locked(
+                            &mut state,
+                            Instant::now(),
+                            WebSessionLifecycleObservation::HttpActivityAfterGap,
+                        );
+                    }
                     return Ok(result);
                 }
                 if cursor != unacked.next_cursor {
@@ -59,11 +69,13 @@ impl WebSession {
                 return Err(ManagerError::Protocol);
             };
             state.down_epoch = epoch;
-            self.touch_peer_locked(
-                &mut state,
-                Instant::now(),
-                WebSessionLifecycleObservation::HttpActivityAfterGap,
-            );
+            if peer_activity {
+                self.touch_peer_locked(
+                    &mut state,
+                    Instant::now(),
+                    WebSessionLifecycleObservation::HttpActivityAfterGap,
+                );
+            }
             let healthy = self.carrier_health_ready_locked(&mut state, Instant::now());
             (state.down_epoch, healthy)
         };
@@ -133,6 +145,14 @@ impl WebSession {
         }
     }
 
+    /// Polls multiplexed WebSocket downlink without renewing the peer lease.
+    pub(crate) async fn poll_down_websocket(
+        &self,
+        cursor: u64,
+    ) -> Result<PollResult, ManagerError> {
+        self.poll_down_inner(cursor, false).await
+    }
+
     /// Reserves session and process queue capacity while the session lock is held.
     pub(super) fn reserve_locked(
         &self,
```

**File**: `src/web/session/downlink_tests.rs` (modified, +16/-0)
```diff
@@ -142,3 +142,19 @@ async fn newer_poll_supersedes_older_poll_without_closing_session() {
     session.close(super::SessionCloseReason::ApiClose);
     manager.shutdown().await;
 }
+
+#[tokio::test]
+async fn websocket_downlink_poll_does_not_extend_the_peer_lease() {
+    let (session, manager) = session();
+    session
+        .state
+        .lock()
+        .activity
+        .touch_peer(Instant::now() - Duration::from_secs(121));
+    queue_close(&session);
+
+    session.poll_down_websocket(0).await.unwrap();
+
+    assert!(session.close_if_due(Instant::now()));
+    manager.shutdown().await;
+}
```

#### Recent Merged Pull Requests:
- **PR #933** (2026-09-28): Trusted Helper Argv0 for Multi-call Firewall Binaries (@axkurcom)
- **PR #931** (2026-09-27): Docs 3.5.8 Pull-Up (@axkurcom)
- **PR #930** (2026-09-27): WEB Bridge Sideband + Atomic Lifecycle for Writer Refresh + ME Authority (@axkurcom)
- **PR #923** (2026-09-08): Stale Websocket-lanes recovers after restart + Native macOS status-schema preserved (@axkurcom)
- **PR #921** (2026-09-06): WEB Lifecycle + Bounded Bridge Recovery + Decoy Fasttrack + Carrier Status (@axkurcom)
- **PR #919** (2026-09-06): fix(install): probe only TCP when validating the target port (@nikoano)
- **PR #910** (2026-08-27): Flow/3.5.5 (@axkurcom)
- **PR #909** (2026-08-27): WEB: Lifecycle + Lane ownership + Diag fixes + Carrier negotiation + WS Lifecycle + WEB Knobs in API (@axkurcom)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
