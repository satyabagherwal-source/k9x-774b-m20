# Forensic Learning Record (Deep Inspection): Nasiko-Labs/nasiko

> **Canonical Artifact**: `07_PROJECT_LEARNING/nasiko-labs-nasiko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Nasiko-Labs/nasiko](https://github.com/Nasiko-Labs/nasiko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:48:46.290Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Nasiko-Labs/nasiko`
- **Description**: The Open Runtime for AI Agents
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9401 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/src/commands/integration/queue.rs`
```
//! Durable, destination-bound queue for coding-agent events.

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use nasiko_types::CodingAgentEventV1;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use uuid::Uuid;

const MAX_SCAN_RECORDS: usize = 1_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueueDestination {
    pub cluster_name: String,
    pub cluster_url: String,
    pub principal_id: Uuid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryState {
    Pending,
    Deferred,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueRecord {
    pub destination: QueueDestination,
    pub delivery_state: DeliveryState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub attempts: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_attempt_at: Option<DateTime<Utc>>,
    pub event: CodingAgentEventV1,
}

impl QueueRecord {
    pub fn new(destination: QueueDestination, event: CodingAgentEventV1) -> Self {
        let now = Utc::now();
        Self {
            destination,
            delivery_state: DeliveryState::Pending,
            last_error: None,
            created_at: now,
            updated_at: now,
            attempts: 0,
            next_attempt_at: None,
            event,
        }
    }
}

pub struct SyncLock {
    _file: File,
}

pub fn enqueue(record: &QueueRecord) -> Result<PathBuf> {
    enqueue_at(&super::state::integrations_dir(), record)
}

pub fn load(path: &Path) -> Result<QueueRecord> {
    let bytes =
        std::fs::read(path).with_context(|| format!("failed to read {}", path.display()))?;
    let record: QueueRecord = serde_json::from_slice(&bytes)
        .with_context(|| format!("failed to parse {}", path.display()))?;
    validate_record(&record)?;
    Ok(record)
}

pub fn update(path: &Path, record: &QueueRecord) -> Result<()> {
    validate_record(record)?;
    atomic_owner_write(path, &serde_json::to_vec(record)?)
}

pub fn remove(path: &Path) -> Result<()> {
    std::fs::remove_file(path).with_context(|| format!("failed to remove {}", path.display()))
}

pub fn quarantine(path: &Path, record: &QueueRecord) -> Result<PathBuf> {
    let root = path
        .ancestors()
        .find(|ancestor| ancestor.file_name().is_some_and(|name| name == "queue"))
        .and_then(Path::parent)
        .unwrap_or_else(|| path.parent().unwrap_or_else(|| Path::new(".")));
    quarantine_at(root, path, record)
}

pub fn reject_invalid(record: &QueueRecord, error: &str) -> Result<PathBuf> {
    reject_invalid_at(&super::state::integrations_dir(), record, error)
}

pub fn records() -> Result<Vec<(PathBuf, QueueRecord)>> {
    records_at(&super::state::integrations_dir())
}

pub fn has_pending_records() -> Result<bool> {
    has_pending_records_at(&super::state::integrations_dir())
}

pub fn acquire_sync_lock(timeout: Duration) -> Result<SyncLock> {
    acquire_sync_lock_at(&super::state::integrations_dir(), timeout)
}

fn enqueue_at(root: &Path, record: &QueueRecord) -> Result<PathBuf> {
    validate_record(record)?;
    let path = record_path(root, &record.destination, &record.event.event_id);
    create_owner_dirs(&root.join("queue"))?;
    atomic_owner_write(&path, &serde_json::to_vec(record)?)?;
    Ok(path)
}

fn validate_record(record: &QueueRecord) -> Result<()> {
    if record.destination.cluster_name.trim().is_empty()
        || record.destination.cluster_url.trim().is_empty()
    {
        bail!("queue destination cluster name and URL must not be empty");
    }
    record.event.validate().map_err(anyhow::Error::msg)
}

fn cluster_hash(destination: &QueueDestination) -> String {
    let identity = format!(
        "{}\0{}\0{}",
        destination.cluster_name,
        destination.cluster_url.trim_end_matches('/'),
        destination.principal_id,
    );
    hex::encode(Sha256::digest(identity.as_bytes()))[..24].to_string()
}

fn record_path(root: &Path, destination: &QueueDestination, event_id: &str) -> PathBuf {
    root.join("queue")
        .join(cluster_hash(destination))
        .join(format!("{event_id}.json"))
}

fn records_at(root: &Path) -> Result<Vec<(PathBuf, QueueRecord)>> {
    let queue = root.join("queue");
    if !queue.exists() {
        return Ok(Vec::new());
    }
    let mut records = Vec::new();
    let now = Utc::now();
    for cluster in std::fs::read_dir(&queue)? {
        let cluster = cluster?;
        if !cluster.file_type()?.is_dir() {
            continue;
        }
        for entry in std::fs::read_dir(cluster.path())? {
            let entry = entry?;
            let path = entry.path();
            if path
                .extension()
                .is_some_and(|extension| extension == "json")
            {
                match load(&path) {
                    Ok(record)
                        if record
                            .next_attempt_at
                            .is_none_or(|next_attempt| next_attempt <= now) =>
                    {
                        records.push((path, record));
                        if records.len() >= MAX_SCAN_RECORDS {
                            records.sort_by(|left, right| left.0.cmp(&right.0));
                            return Ok(records);
                        }
                    }
                    Ok(_) => {}
                    Err(_) => quarantine_invalid_at(root, &path)?,
                }
            }
        }
    }
    records.sort_by(|left, right| left.0.cmp(&right.0));
    Ok(records)
}

fn has_pending_records_at(root: &Path) -> Result<bool> {
    let queue = root.join("queue");
    if !queue.exists() {
        return Ok(false);
    }
    for cluster in std::fs::read_dir(queue)? {
        let cluster = cluster?;
        if !cluster.file_type()?.is_dir() {
            continue;
        }
        if std::fs::read_dir(cluster.path())?.any(|entry| {
            entry.ok().is_some_and(|entry| {
                entry
                    .path()
                    .extension()
                    .is_some_and(|extension| extension == "json")
            })
        }) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn quarantine_at(root: &Path, path: &Path, record: &QueueRecord) -> Result<PathBuf> {
    let destination = root
        .join("rejected")
        .join(cluster_hash(&record.destination))
        .join(path.file_name().context("queue record has no filename")?);
    create_owner_dirs(destination.parent().expect("quarantine has parent"))?;
    std::fs::rename(path, &destination)
        .with_context(|| format!("failed to quarantine {}", path.display()))?;
    Ok(destination)
}

fn reject_invalid_at(root: &Path, record: &QueueRecord, error: &str) -> Result<PathBuf> {
    let mut rejected = record.clone();
    rejected.delivery_state = DeliveryState::Rejected;
    rejected.last_error = Some(format!("invalid event: {error}"));
    rejected.updated_at = Utc::now();
    let destination = root
        .join("rejected")
        .join(cluster_hash(&record.destination))
        .join(format!("{}.json", record.event.event_id));
    create_owner_dirs(destination.parent().expect("rejected event has parent"))?;
    atomic_owner_write(&destination, &serde_json::to_vec(&rejected)?)?;
    Ok(destination)
}

fn quarantine_invalid_at(root: &Path, path: &Path) -> Result<()> {
    let cluster = path
        .parent()
        .and_then(Path::file_name)
        .context("invalid queue record has no cluster directory")?;
    let destination = root.join("rejected").join("malformed").join(cluster).join(
        path.file_name()
            .context("invalid queue record has no filename")?,
    );
    create_owner_dirs(destination.parent().expect("invalid quarantine has parent"))?;
    std::fs::rename(path, &destination)
        .with_context(|| format!("failed to quarantine malformed record {}", path.display()))?;
    Ok(())
}

fn acquire_sync_lock_at(root: &Path, timeout: Duration) -> Result<SyncLock> {
    let path = root.join("queue").join(".sync.lock");
    create_owner_dirs(path.parent().expect("lock has parent"))?;
    let file = owner_open(&path, false)?;
    let deadline = Instant::now() + timeout;
    while file.try_lock().is_err() {
        if Instant::now() >= deadline {
            bail!("timed out locking {}", path.display());
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    Ok(SyncLock { _file: file })
}

fn create_owner_dirs(path: &Path) -> Result<()> {
    std::fs::create_dir_all(path)
        .with_context(|| format!("failed to create {}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

fn owner_open(path: &Path, truncate: bool) -> Result<File> {
    let mut options = OpenOptions::new();
    options
        .create(true)
        .write(true)
        .read(true)
        .truncate(truncate);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let file = options
        .open(path)
        .with_context(|| format!("failed to open {}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
    }
    Ok(file)
}

fn atomic_owner_write(path: &Path, bytes: &[u8]) -> Result<()> {
    static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);
    let parent = path.parent().context("queue record has no parent")?;
    create_owner_dirs(parent)?;
    let name = path
        .file_name()

```

### Core Architecture Module: `cli/src/commands/integration/state.rs`
```
//! On-disk state for installed integrations, under `~/.nasiko/integrations/`.
//!
//! Two kinds of state live here:
//!
//! - `config.json` — one entry per installed agent: where to send spans and
//!   whether prompt text may be captured. Written by `install`, read by the
//!   hook on every report.
//! - `watermarks/<agent>/<session>.json` — stable turn ids already exported and
//!   persisted, so hooks remain idempotent across transcript reordering.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InstallationBinding {
    pub cluster_name: String,
    pub cluster_url: String,
    pub principal_id: Uuid,
}

/// Per-agent settings recorded at install time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentState {
    /// Name this agent is registered under in the control plane.
    pub agent_name: String,
    /// Whether prompt text may be attached to spans.
    pub capture_content: bool,
    /// Version of the installed hook script.
    pub hook_version: u32,
    /// Immutable delivery destination selected by the explicit installation.
    /// Legacy state without this field fails closed and must be reinstalled.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binding: Option<InstallationBinding>,
}

/// Every installed integration, keyed by catalog id.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IntegrationState {
    #[serde(default)]
    pub agents: HashMap<String, AgentState>,
}

impl IntegrationState {
    pub fn load() -> Result<Self> {
        let path = config_path();
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&path)
            .with_context(|| format!("failed to read {}", path.display()))?;
        serde_json::from_str(&content)
            .with_context(|| format!("failed to parse {}", path.display()))
    }

    pub fn save(&self) -> Result<()> {
        let path = config_path();
        create_parent_dir(&path)?;
        let content = serde_json::to_string_pretty(self)?;
        atomic_write(&path, content.as_bytes())
    }

    pub fn get(&self, agent_id: &str) -> Option<&AgentState> {
        self.agents.get(agent_id)
    }
}

// ─── Watermarks ──────────────────────────────────────────────────────────────

/// A process-wide exclusive lock for one session's reporting state.
///
/// Keep this guard alive across reading watermarks, exporting/uploading, and
/// advancing them so overlapping hook processes cannot perform the same work.
pub struct SessionLock {
    _file: File,
    watermark_path: PathBuf,
}

/// Independent stable-id progress for span export and message persistence.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionProgress {
    pub exported_turn_ids: HashSet<String>,
    pub uploaded_turn_ids: HashSet<String>,
    pub captured_turn_ids: HashSet<String>,
    /// A count-only file cannot be mapped safely after transcript edits. Its
    /// first ID-aware run deliberately replays complete turns once.
    pub migrated_legacy_counts: bool,
}

impl SessionLock {
    #[cfg(test)]
    fn acquire(lock_path: &Path, watermark_path: PathBuf) -> Result<Self> {
        create_parent_dir(lock_path)?;
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(lock_path)
            .with_context(|| format!("failed to open {}", lock_path.display()))?;
        file.lock()
            .with_context(|| format!("failed to lock {}", lock_path.display()))?;
        Ok(Self {
            _file: file,
            watermark_path,
        })
    }

    fn acquire_with_timeout(
        lock_path: &Path,
        watermark_path: PathBuf,
        legacy_watermark_path: Option<&Path>,
        timeout: Duration,
    ) -> Result<Self> {
        create_parent_dir(lock_path)?;
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(lock_path)
            .with_context(|| format!("failed to open {}", lock_path.display()))?;
        let deadline = Instant::now() + timeout;
        while file.try_lock().is_err() {
            if Instant::now() >= deadline {
                anyhow::bail!("timed out locking {}", lock_path.display());
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        if !watermark_path.exists()
            && let Some(legacy_path) = legacy_watermark_path.filter(|path| path.exists())
        {
            let legacy = read_watermark_path(legacy_path);
            // Session-only IDs may belong to another adapter. Replay instead
            // of suppressing turns; Tempo and the server deduplicate retries.
            let conservative = Watermark {
                exported_turns: legacy
                    .exported_turn_ids
                    .as_ref()
                    .map_or(legacy.exported_turns, Vec::len),
                uploaded_messages: legacy
                    .uploaded_turn_ids
                    .as_ref()
                    .map_or(legacy.uploaded_messages, Vec::len),
                exported_turn_ids: None,
                uploaded_turn_ids: None,
                captured_turn_ids: None,
            };
            write_watermark_path(&watermark_path, &conservative)?;
        }
        Ok(Self {
            _file: file,
            watermark_path,
        })
    }

    /// Read progress. Legacy counts are intentionally not assigned to current
    /// IDs: truncation or reordering makes that mapping unknowable. Existing
    /// complete turns replay once, after which stable IDs govern all progress.
    pub fn progress(&self) -> Result<SessionProgress> {
        let mut current = read_watermark_path(&self.watermark_path);
        let mut migrated = false;
        let mut migrated_legacy_counts = false;
        if current.exported_turn_ids.is_none() {
            migrated_legacy_counts |= current.exported_turns > 0;
            current.exported_turn_ids = Some(Vec::new());
            migrated = true;
        }
        if current.uploaded_turn_ids.is_none() {
            migrated_legacy_counts |= current.uploaded_messages > 0;
            current.uploaded_turn_ids = Some(Vec::new());
            migrated = true;
        }
        if current.captured_turn_ids.is_none() {
            // Only turns completed by both old delivery paths can safely be
            // treated as captured by the replacement pipeline.
            let exported: HashSet<_> = current
                .exported_turn_ids
                .as_deref()
                .unwrap_or_default()
                .iter()
                .cloned()
                .collect();
            let captured = current
                .uploaded_turn_ids
                .as_deref()
                .unwrap_or_default()
                .iter()
                .filter(|id| exported.contains(*id))
                .cloned()
                .collect();
            current.captured_turn_ids = Some(captured);
            migrated = true;
        }
        if migrated {
            write_watermark_path(&self.watermark_path, &current)?;
        }
        Ok(SessionProgress {
            exported_turn_ids: current
                .exported_turn_ids
                .unwrap_or_default()
                .into_iter()
                .collect(),
            uploaded_turn_ids: current
                .uploaded_turn_ids
                .unwrap_or_default()
                .into_iter()
                .collect(),
            captured_turn_ids: current
                .captured_turn_ids
                .unwrap_or_default()
                .into_iter()
                .collect(),
            migrated_legacy_counts,
        })
    }

    pub fn mark_captured(&self, turn_ids: &[String]) -> Result<()> {
        self.mark(turn_ids, |watermark| &mut watermark.captured_turn_ids)
    }

    fn mark(
        &self,
        turn_ids: &[String],
        field: impl FnOnce(&mut Watermark) -> &mut Option<Vec<String>>,
    ) -> Result<()> {
        let mut watermark = read_watermark_path(&self.watermark_path);
        let ids = field(&mut watermark).get_or_insert_with(Vec::new);
        let mut known: HashSet<String> = ids.iter().cloned().collect();
        for turn_id in turn_ids {
            if known.insert(turn_id.clone()) {
                ids.push(turn_id.clone());
            }
        }
        watermark.exported_turns = watermark
            .exported_turn_ids
            .as_ref()
            .map_or(watermark.exported_turns, Vec::len);
        watermark.uploaded_messages = watermark
            .uploaded_turn_ids
            .as_ref()
            .map_or(watermark.uploaded_messages, Vec::len);
        write_watermark_path(&self.watermark_path, &watermark)
    }
}

/// Acquire the per-session report lock. `report.rs` should hold this guard for
/// its complete read/export/upload/watermark transaction.
pub fn lock_session(agent_id: &str, session_id: &str, timeout: Duration) -> Result<SessionLock> {
    let watermark = watermark_path(agent_id, session_id);
    SessionLock::acquire_with_timeout(
        &watermark.with_extension("lock"),
        watermark,
        Some(&legacy_watermark_path(session_id)),
        timeout,
    )
}

fn read_watermark_path(path: &Path) -> Watermark {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn write_watermark_path(path: &Path, watermark: &Watermark) -> Result<()> {
    atomic_write(path, serde_json::to_string(watermar
```

### Core Architecture Module: `cli/src/util.rs`
```
use std::fs;
use std::io::Cursor;
use std::path::Path;

use anyhow::Result;
use include_dir::Dir;
use serde_json;

/// Best-effort scan of an agent's source directory for a reference to the MCP gateway env vars
/// (`MCP_GATEWAY_URL`/`MCP_GATEWAY_TOKEN`) — the signal that this agent's own code is coded to
/// call `/api/mcp`, as opposed to an agent that never touches it (every agent gets the credential
/// injected regardless, per `oss/server/src/mcp/wiring.rs`, so its presence alone proves
/// nothing). Shared by `deploy.rs`'s directory-deploy path (which builds straight from a
/// directory) and `upload.rs`'s directory-source path (checked before it zips, rather than
/// re-scanning the freshly built archive) — `upload.rs`'s zip-file-source path still needs its
/// own zip-entry scan instead, since there's no directory to walk there. Skips common non-source
/// directories and any file over 1MB; any read/walk failure is treated as "no reference found" —
/// this is a hint, not a correctness check, so it must never fail the deploy/upload itself.
pub fn dir_references_mcp_gateway(dir: &Path) -> bool {
    const SKIP_DIRS: &[&str] = &[
        ".git",
        ".nasiko",
        "node_modules",
        "__pycache__",
        "target",
        ".venv",
        "venv",
        "dist",
        "build",
    ];
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let skip = path
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| SKIP_DIRS.contains(&n));
            if !skip && dir_references_mcp_gateway(&path) {
                return true;
            }
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.len() > 1_000_000 {
            continue;
        }
        let Ok(contents) = fs::read_to_string(&path) else {
            continue;
        };
        if contents.contains("MCP_GATEWAY_URL") || contents.contains("MCP_GATEWAY_TOKEN") {
            return true;
        }
    }
    false
}

/// Resolves the container CLI binary to shell out to. Honors `NASIKO_CONTAINER_CLI`
/// if set, otherwise prefers `docker` and falls back to `podman` when `docker` isn't
/// on PATH (e.g. podman-only dev setups without the podman-docker compat shim).
pub fn container_bin() -> String {
    if let Ok(bin) = std::env::var("NASIKO_CONTAINER_CLI") {
        return bin;
    }
    if on_path("docker") {
        "docker".to_string()
    } else {
        "podman".to_string()
    }
}

fn on_path(bin: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).any(|dir| dir.join(bin).is_file()))
        .unwrap_or(false)
}

/// Split a Docker image reference into `(name, tag)`, stripping any registry
/// host/path prefix first so a `host:port/...` ref doesn't get its port
/// mistaken for part of the name or tag (e.g. `localhost:5000/my-agent:v2` ->
/// `("my-agent", "v2")`, not `("localhost", "5000/my-agent")`).
pub fn parse_image_name_and_tag(image: &str) -> (String, String) {
    let last_segment = image.rsplit('/').next().unwrap_or(image);
    match last_segment.rsplit_once(':') {
        Some((name, tag)) => (name.to_string(), tag.to_string()),
        None => (last_segment.to_string(), "latest".to_string()),
    }
}

/// True if `image` has a `:tag` written explicitly, as opposed to
/// [`parse_image_name_and_tag`]'s implicit `"latest"` fallback. Used so an
/// untagged image isn't mistaken for a deliberately chosen version.
pub fn image_has_explicit_tag(image: &str) -> bool {
    image.rsplit('/').next().unwrap_or(image).contains(':')
}

pub fn extract_tar_gz(data: &[u8], dest: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;
    let cursor = Cursor::new(data);
    let gz = flate2::read::GzDecoder::new(cursor);
    let mut archive = tar::Archive::new(gz);
    archive.unpack(dest)?;
    Ok(())
}

pub fn extract_embedded_dir(dir: &Dir, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;
    for file in dir.files() {
        let file_name = file.path().file_name().unwrap_or_default();
        fs::write(dest.join(file_name), file.contents())?;
    }
    for sub in dir.dirs() {
        let sub_name = sub.path().file_name().unwrap_or_default();
        extract_embedded_dir(sub, &dest.join(sub_name))?;
    }
    Ok(())
}

/// Try to read a version string from common project files.
///
/// Works for both a source directory and a `.zip` file. Resolution order:
///   1. AgentCard.json → `version`
///   2. pyproject.toml → `[project] version` or `[tool.poetry] version`
///   3. Cargo.toml     → `[package] version`
///
/// Returns `None` if no version is found; callers should fall back to `"0.1.0"` on
/// first upload or send `"auto"` on reupload (server auto-bumps the patch digit).
pub fn detect_version_from_source(source: &Path) -> Option<String> {
    if source.is_dir() {
        detect_version_from_dir(source)
    } else if source.extension().and_then(|e| e.to_str()) == Some("zip") {
        detect_version_from_zip(source)
    } else {
        None
    }
}

fn detect_version_from_dir(source: &Path) -> Option<String> {
    // 1. AgentCard.json
    let card_path = source.join("AgentCard.json");
    if card_path.exists()
        && let Ok(s) = fs::read_to_string(&card_path)
        && let Ok(v) = serde_json::from_str::<serde_json::Value>(&s)
        && let Some(ver) = v.get("version").and_then(|v| v.as_str())
    {
        return Some(ver.to_string());
    }

    // 2. pyproject.toml — [project] version or [tool.poetry] version
    let pyproject_path = source.join("pyproject.toml");
    if pyproject_path.exists()
        && let Ok(s) = fs::read_to_string(&pyproject_path)
        && let Some(ver) = parse_toml_version(&s, &["project", "tool.poetry"])
    {
        return Some(ver);
    }

    // 3. Cargo.toml — [package] version
    let cargo_path = source.join("Cargo.toml");
    if cargo_path.exists()
        && let Ok(s) = fs::read_to_string(&cargo_path)
        && let Some(ver) = parse_toml_version(&s, &["package"])
    {
        return Some(ver);
    }

    None
}

/// Read version from a zip file by extracting specific candidate files using
/// `unzip -p` (prints file contents to stdout without extracting to disk).
fn detect_version_from_zip(zip_path: &Path) -> Option<String> {
    use std::process::Command;

    let zip = zip_path.to_string_lossy();

    // Helper: run `unzip -p <zip> <file>` and return stdout on success.
    let read_from_zip = |file: &str| -> Option<String> {
        let out = Command::new("unzip")
            .args(["-p", &zip, file])
            .output()
            .ok()?;
        if out.status.success() && !out.stdout.is_empty() {
            String::from_utf8(out.stdout).ok()
        } else {
            None
        }
    };

    // 1. AgentCard.json
    if let Some(s) = read_from_zip("AgentCard.json")
        && let Ok(v) = serde_json::from_str::<serde_json::Value>(&s)
        && let Some(ver) = v.get("version").and_then(|v| v.as_str())
    {
        return Some(ver.to_string());
    }

    // 2. pyproject.toml
    if let Some(s) = read_from_zip("pyproject.toml")
        && let Some(ver) = parse_toml_version(&s, &["project", "tool.poetry"])
    {
        return Some(ver);
    }

    // 3. Cargo.toml
    if let Some(s) = read_from_zip("Cargo.toml")
        && let Some(ver) = parse_toml_version(&s, &["package"])
    {
        return Some(ver);
    }

    None
}

/// Minimal TOML version extractor: scans for `version = "..."` under any of the
/// given section headers. Does not depend on a TOML parser crate.
pub fn parse_toml_version(content: &str, sections: &[&str]) -> Option<String> {
    let mut in_section = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            let header = trimmed.trim_start_matches('[').trim_end_matches(']').trim();
            in_section = sections.contains(&header);
            continue;
        }
        if in_section && let Some(rest) = trimmed.strip_prefix("version") {
            let rest = rest.trim();
            if let Some(rest) = rest.strip_prefix('=') {
                let ver = rest.trim().trim_matches('"').trim_matches('\'');
                if !ver.is_empty() {
                    return Some(ver.to_string());
                }
            }
        }
    }
    None
}

/// Writes the resolved deploy/push version back into `AgentCard.json` so the
/// file reflects what's actually running instead of going stale the moment a
/// prompt or `--version` picks something different from what's on disk. A
/// no-op if the file already has this version — avoids reformatting the file
/// (and thus a spurious diff) on every deploy/push that didn't change it.
pub fn sync_card_version(card_path: &Path, card: &serde_json::Value, version: &str) -> Result<()> {
    if card.get("version").and_then(|v| v.as_str()) == Some(version) {
        return Ok(());
    }
    let mut updated = card.clone();
    updated["version"] = serde_json::Value::String(version.to_string());
    fs::write(card_path, serde_json::to_string_pretty(&updated)?)?;
    Ok(())
}

pub fn title_case(s: &str) -> String {
    s.split_whitespace()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                Some(first) => first.to_uppercase().to_string() + c.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn image_has_explicit_tag_true_for_a_real_tag() {
        assert!(image_has_explicit_tag("legal-agent:1.0.1"));
        assert!(image_has_explicit_tag("nasiko/legal-agent:1.0.1"));
    }

    #[test]
    fn image_has_explicit_tag_false_for_a_bare_name() {
        assert!(!image_ha
```

### Core Architecture Module: `mcp-gateway/src/state.rs`
```
//! Shared state for the MCP gateway.
//!
//! Constructed once from the server's `AppState` primitives (see
//! `oss/server/src/mcp/`) and threaded through the pure gateway logic. It holds
//! only cheaply-cloneable handles — the same `PgPool`, `redis::Client`, and
//! pooled `reqwest::Client` the rest of the server already shares — so there is
//! no duplicated infrastructure.

use std::sync::Arc;

use nasiko_config::Config;
use sqlx::PgPool;

use crate::authorizer::{ConnectorAuthorizer, OssConnectorAuthorizer};
use crate::config::{McpConfig, ToolSearchMode};
use crate::endpoint_refresh::{EndpointRefresher, NoopEndpointRefresher};
use crate::provider::Providers;
use crate::search::ToolSearchIndex;

#[derive(Clone)]
pub struct McpState {
    pub db: PgPool,
    pub redis: redis::Client,
    pub http_client: reqwest::Client,
    /// SSRF/DNS-rebinding-guarded client for outbound calls to user-controlled
    /// URLs (OAuth discovery/exchange/refresh against dynamically-discovered
    /// endpoints). Distinct from `http_client`, which may reach internal hosts.
    pub guarded_http_client: reqwest::Client,
    pub config: McpConfig,
    /// Tool backends: the Composio Tool Router client (when configured) + the
    /// shared generic MCP transport.
    pub providers: Providers,
    /// Layer-1 connector reachability. Default = owner ∪ user/public grant; an
    /// edition can swap a richer impl at startup.
    pub authorizer: Arc<dyn ConnectorAuthorizer>,
    /// Self-heal for `uploaded_build` connectors whose live container address
    /// drifted (restart/redeploy/reboot) — see `endpoint_refresh`'s module
    /// doc. Default is a no-op; `oss/server` swaps in a real,
    /// `ContainerRuntime`-backed impl at `AppState` construction, same swap
    /// pattern as `authorizer` above.
    pub endpoint_refresher: Arc<dyn EndpointRefresher>,
    /// Best-effort LLM fallback for connector/tool descriptions the native
    /// source didn't provide — see `description_backfill`. Never used when a
    /// native description is already present.
    pub llm: nasiko_orchestrator::providers::LLMProvider,
    /// Flat tool search index — semantic (default) or BM25 (fallback).
    pub search_index: Arc<dyn ToolSearchIndex>,
}

impl McpState {
    /// Build gateway state from the server's shared handles and platform config.
    pub fn new(
        db: PgPool,
        redis: redis::Client,
        http_client: reqwest::Client,
        config: &Config,
    ) -> Self {
        let mcp_config = McpConfig::from_config(config);
        let providers = Providers::new(http_client.clone(), &mcp_config);
        let llm = nasiko_orchestrator::providers::LLMProvider::from_env(http_client.clone());
        let search_index: Arc<dyn ToolSearchIndex> = match mcp_config.tool_search_mode {
            ToolSearchMode::Semantic => {
                if let Some(ref api_key) = mcp_config.openai_api_key {
                    Arc::new(crate::search::SemanticSearchIndex::new(
                        http_client.clone(),
                        redis.clone(),
                        api_key.clone(),
                        mcp_config.embedding_model.clone(),
                    ))
                } else {
                    tracing::warn!(
                        "MCP_TOOL_SEARCH_MODE=semantic but OPENAI_API_KEY not set, \
                         falling back to keyword"
                    );
                    Arc::new(crate::search::Bm25SearchIndex::new())
                }
            }
            ToolSearchMode::Keyword => Arc::new(crate::search::Bm25SearchIndex::new()),
            ToolSearchMode::None => Arc::new(crate::search::NoopSearchIndex),
        };
        Self {
            db,
            redis,
            http_client,
            guarded_http_client: crate::net::guarded_http_client(),
            config: mcp_config,
            providers,
            authorizer: Arc::new(OssConnectorAuthorizer),
            endpoint_refresher: Arc::new(NoopEndpointRefresher),
            llm,
            search_index,
        }
    }
}

```

### Core Architecture Module: `mcp-gateway/src/webhooks.rs`
```
//! Composio webhook handling.
//!
//! Verifies the inbound HMAC signature and processes
//! `composio.connected_account.expired` events: mark the matching connection
//! `EXPIRED` and invalidate the user's cached session so the next resolve
//! re-syncs (dropping the dead toolkit). Simpler than the PoC's per-session
//! patch loop because our sessions are per-user and resolved on demand.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::Sha256;

use crate::error::Result;
use crate::repo;
use crate::session;
use crate::state::McpState;

type HmacSha256 = Hmac<Sha256>;

/// The event type we act on.
const EXPIRED_EVENT: &str = "composio.connected_account.expired";

/// Verify a Composio webhook signature (HMAC-SHA256, base64).
///
/// `signing_string = "{webhook_id}.{webhook_timestamp}.{raw_body}"`. The
/// signature header may carry a `v1,` scheme prefix, which is stripped before
/// comparison. Comparison is constant-time.
pub fn verify_signature(
    webhook_id: &str,
    webhook_timestamp: &str,
    body: &str,
    signature: &str,
    secret: &str,
) -> bool {
    let signing_string = format!("{webhook_id}.{webhook_timestamp}.{body}");
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(signing_string.as_bytes());

    // Header may be "v1,<sig>" — take the part after the last comma.
    let received = signature.rsplit(',').next().unwrap_or(signature);
    let Ok(received_bytes) = B64.decode(received) else {
        return false;
    };
    mac.verify_slice(&received_bytes).is_ok()
}

/// Outcome of processing a webhook payload (for the route to log / respond).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WebhookOutcome {
    /// An event type we don't handle — acknowledged, no action.
    Ignored,
    /// Expiry event for an account we don't have (already deleted/unknown).
    UnknownAccount,
    /// Connection was already EXPIRED — no-op.
    AlreadyExpired,
    /// Connection marked EXPIRED and the user's session cache invalidated.
    Expired,
}

/// Process a parsed webhook payload. Signature verification is the route's
/// responsibility (it has the raw body + headers); this handles the effect.
pub async fn process_event(state: &McpState, payload: &Value) -> Result<WebhookOutcome> {
    let event_type = payload.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if event_type != EXPIRED_EVENT {
        tracing::debug!(event_type, "ignoring composio webhook event");
        return Ok(WebhookOutcome::Ignored);
    }

    let data = payload.get("data");
    let Some(account_id) = data.and_then(|d| d.get("id")).and_then(|v| v.as_str()) else {
        tracing::warn!("composio expiry webhook missing data.id — ignoring");
        return Ok(WebhookOutcome::UnknownAccount);
    };

    let Some(connection) = repo::get_connection_by_account_id(&state.db, account_id).await? else {
        tracing::warn!(
            account_id,
            "expiry webhook for unknown connection — already deleted or unknown"
        );
        return Ok(WebhookOutcome::UnknownAccount);
    };

    if connection.status == "EXPIRED" {
        return Ok(WebhookOutcome::AlreadyExpired);
    }

    repo::update_connection_status(&state.db, connection.id, "EXPIRED").await?;
    session::invalidate_session_cache(state, connection.user_id).await;

    tracing::warn!(
        account_id,
        user_id = %connection.user_id,
        connector_id = %connection.connector_id,
        "composio connection expired — marked EXPIRED and invalidated session cache",
    );
    Ok(WebhookOutcome::Expired)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signature_verifies_and_rejects() {
        let secret = "whsec_test";
        let (id, ts, body) = ("wh_1", "1700000000", r#"{"type":"x"}"#);
        let signing = format!("{id}.{ts}.{body}");
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signing.as_bytes());
        let sig = B64.encode(mac.finalize().into_bytes());

        assert!(verify_signature(id, ts, body, &sig, secret));
        assert!(verify_signature(id, ts, body, &format!("v1,{sig}"), secret));
        assert!(!verify_signature(id, ts, body, &sig, "wrong-secret"));
        assert!(!verify_signature(id, ts, "tampered", &sig, secret));
    }

    fn sign(id: &str, ts: &str, body: &str, secret: &str) -> String {
        let signing = format!("{id}.{ts}.{body}");
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signing.as_bytes());
        B64.encode(mac.finalize().into_bytes())
    }

    #[test]
    fn semantically_equivalent_but_differently_serialized_body_fails() {
        // Proves this verifies the RAW body bytes, not a re-parsed/normalized
        // JSON value — two JSON documents that are semantically identical but
        // differ in key order/whitespace must NOT be interchangeable.
        let secret = "whsec_test";
        let (id, ts) = ("wh_1", "1700000000");
        let body_a = r#"{"type":"x","data":{"id":"1"}}"#;
        let body_b = r#"{"data": {"id": "1"}, "type": "x"}"#; // same meaning, different bytes
        let sig_over_a = sign(id, ts, body_a, secret);

        assert!(verify_signature(id, ts, body_a, &sig_over_a, secret));
        assert!(!verify_signature(id, ts, body_b, &sig_over_a, secret));
    }

    #[test]
    fn truncated_and_extended_signature_are_rejected() {
        let secret = "whsec_test";
        let (id, ts, body) = ("wh_1", "1700000000", r#"{"type":"x"}"#);
        let sig = sign(id, ts, body, secret);

        let truncated = &sig[..sig.len() - 4];
        assert!(!verify_signature(id, ts, body, truncated, secret));

        let extended = format!("{sig}AAAA");
        assert!(!verify_signature(id, ts, body, &extended, secret));
    }

    #[test]
    fn empty_body_with_correct_signature_passes_wrong_signature_fails() {
        let secret = "whsec_test";
        let (id, ts, body) = ("wh_1", "1700000000", "");
        let sig_over_empty = sign(id, ts, body, secret);
        assert!(verify_signature(id, ts, body, &sig_over_empty, secret));

        // A signature computed over a non-empty body must not validate an
        // empty body.
        let sig_over_nonempty = sign(id, ts, "not empty", secret);
        assert!(!verify_signature(id, ts, body, &sig_over_nonempty, secret));
    }

    #[test]
    fn empty_signature_string_is_rejected_without_panicking() {
        let secret = "whsec_test";
        assert!(!verify_signature("wh_1", "1700000000", "{}", "", secret));
        // Malformed non-base64 signature must also fail cleanly, not panic.
        assert!(!verify_signature(
            "wh_1",
            "1700000000",
            "{}",
            "not-base64!!",
            secret
        ));
    }
}

```

### Core Architecture Module: `orchestrator/src/engine.rs`
```
use async_trait::async_trait;
use dashmap::DashMap;
use reqwest::Client;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

use crate::agent_registry;
use crate::context_selection::{self, ContextTiers};
use crate::error::RouterError;
use crate::models::AgentCardSummary;
use crate::policy::RoutingPolicy;
use crate::providers::LLMProvider;
use crate::reranker::Reranker;
use crate::selector::AgentSelector;
use crate::selector::ConversationMessage;
use crate::types::{AgentCard, RouteRequest, RouteResult, RouterLogEntry};
use crate::vector_store::{TextEmbeddingCache, VectorStore};

// ── Trait ─────────────────────────────────────────────────────────────────────

#[async_trait]
pub trait RoutingEngine: Send + Sync {
    /// `policy` is resolved by the caller rather than by `route()` itself, so a
    /// caller making several `route()` calls for one request (one per MAF
    /// workflow step, for example) can resolve it once and share it, instead of
    /// every call paying for its own lookup. A caller with no policy to apply
    /// passes `None`, and routing is unconstrained.
    async fn route(
        &self,
        req: RouteRequest,
        pool: &PgPool,
        policy: Option<&dyn RoutingPolicy>,
    ) -> Result<RouteResult, RouterError>;
}

// ── Config ────────────────────────────────────────────────────────────────────

pub struct RouterConfig {
    /// Skip Stage 1 embedding shortlist when catalogue is smaller than this.
    pub shortlist_threshold: usize,
    /// Max candidates passed into Stage 3 (LLM selector).
    pub shortlist_size: usize,
    /// What each stored `PacmsBudgetLevel` tier means in this deployment —
    /// the token/item counts the user's chosen tier resolves against.
    pub context_tiers: ContextTiers,
}

impl Default for RouterConfig {
    fn default() -> Self {
        Self {
            shortlist_threshold: 15,
            shortlist_size: 10,
            context_tiers: ContextTiers::default(),
        }
    }
}

// ── OSS Engine ────────────────────────────────────────────────────────────────

pub struct OssRoutingEngine {
    config: RouterConfig,
    selector: AgentSelector,
    api_key: String,
    base_url: String,
    embedding_model: String,
    /// Cache of PACMS candidate/query embeddings shared across `route()` calls.
    /// PACMS's history pool overlaps heavily turn-to-turn within a session, so
    /// without this `SessionHistory::fetch_pacms` would re-embed the same
    /// messages on every call. See `TextEmbeddingCache` docs.
    history_embedding_cache: TextEmbeddingCache,
}

impl OssRoutingEngine {
    pub fn new(
        config: RouterConfig,
        http_client: Client,
        api_key: String,
        base_url: String,
        router_model: String,
        embedding_model: String,
    ) -> Self {
        let provider = LLMProvider::new(http_client, api_key.clone(), base_url.clone());
        let selector = AgentSelector::new(provider, router_model);
        Self {
            config,
            selector,
            api_key,
            base_url,
            embedding_model,
            history_embedding_cache: Arc::new(DashMap::new()),
        }
    }

    pub fn from_config(config: &nasiko_config::Config, http_client: Client) -> Self {
        let router_config = RouterConfig {
            shortlist_threshold: config.router_shortlist_threshold,
            shortlist_size: config.router_shortlist_size,
            context_tiers: ContextTiers::from_config(config),
        };
        Self::new(
            router_config,
            http_client,
            config.openai_api_key.clone().unwrap_or_default(),
            config
                .openai_base_url
                .clone()
                .unwrap_or_else(|| "https://api.openai.com".into()),
            config.router_model.clone(),
            config.embedding_model.clone(),
        )
    }
}

#[async_trait]
impl RoutingEngine for OssRoutingEngine {
    async fn route(
        &self,
        req: RouteRequest,
        pool: &PgPool,
        policy: Option<&dyn RoutingPolicy>,
    ) -> Result<RouteResult, RouterError> {
        tracing::info!(query = %req.query, "routing_engine: route() start");
        let t0 = Instant::now();

        // Fetch available agents + conversation history in parallel. History
        // is selected per the caller's own stored strategy and budget tier —
        // see `context_selection::fetch_for_user`.
        let history_store = VectorStore::for_embedding(
            self.api_key.clone(),
            self.base_url.clone(),
            self.embedding_model.clone(),
            Arc::clone(&self.history_embedding_cache),
        );
        let (agents, history) = tokio::join!(
            agent_registry::get_agents_for_user(req.user_id, pool),
            context_selection::fetch_for_user(
                pool,
                req.user_id,
                &req.session_id,
                &history_store,
                &req.query,
                &self.config.context_tiers,
            ),
        );
        let agents = agents?;

        if agents.is_empty() {
            return Err(RouterError::NoAgentsAvailable);
        }

        let registry_ms = t0.elapsed().as_millis() as i32;
        tracing::info!(
            agent_count = agents.len(),
            elapsed_ms = registry_ms,
            "routing_engine: registry+history fetched"
        );

        // Stage 1 — vector store semantic shortlist (OpenAI embeddings, skipped if no key)
        let t1 = Instant::now();
        let store = Arc::new(if agents.len() < self.config.shortlist_threshold {
            tracing::info!("routing_engine: stage 1 (shortlist) skipped — fleet below threshold");
            // Catalog too small for semantic shortlisting to matter — skip
            // embedding entirely rather than paying for embeddings API calls
            // we're going to throw away (shortlist() would return `all` anyway).
            VectorStore::disabled_from(agents.clone())
        } else {
            tracing::info!("routing_engine: stage 1 (shortlist) — building vector store");
            VectorStore::build(
                agents.clone(),
                self.api_key.clone(),
                self.base_url.clone(),
                self.embedding_model.clone(),
                pool,
            )
            .await
        });
        let shortlist = store
            .shortlist(
                &req.query,
                self.config.shortlist_size,
                self.config.shortlist_threshold,
            )
            .await;
        let stage1_count = shortlist.len();
        let stage1_ms = t1.elapsed().as_millis() as i32;
        tracing::info!(
            candidates = stage1_count,
            elapsed_ms = stage1_ms,
            "routing_engine: stage 1 (shortlist) done"
        );

        // Stage 2 — conversation-aware reranking
        let t2 = Instant::now();
        let reranker = Reranker::new(Arc::clone(&store));
        let candidates = reranker
            .rerank(shortlist, &history, &req.query, self.config.shortlist_size)
            .await;
        let stage2_count = candidates.len();
        tracing::info!(
            candidates = stage2_count,
            elapsed_ms = t2.elapsed().as_millis() as i32,
            "routing_engine: stage 2 (rerank) done"
        );

        if candidates.is_empty() {
            return Err(RouterError::NoAgentsAvailable);
        }

        // Stage 3 — LLM final selection
        tracing::info!("routing_engine: stage 3 (select) — calling LLM");
        let t3 = Instant::now();
        let summaries: Vec<AgentCardSummary> = candidates.iter().map(card_to_summary).collect();
        let history_msgs: Vec<ConversationMessage> = history
            .to_llm_messages()
            .into_iter()
            .map(|m| ConversationMessage {
                role: m.role,
                content: m.content,
            })
            .collect();

        let (selected_agent, fallback_used, reasoning, selector_usage) = match self
            .selector
            .select_agent(&req.query, &history_msgs, &summaries, policy)
            .await
        {
            Ok((sel, completion_result, hallucinated_fallback)) => {
                let agent = candidates
                    .iter()
                    .find(|a| a.id == sel.agent_id)
                    .cloned()
                    .unwrap_or_else(|| candidates[0].clone());
                let reasoning = sel.reasoning.clone();
                let usage = Some(completion_result);
                (agent, hallucinated_fallback, reasoning, usage)
            }
            // A refusal is a decision, not a failure: propagate it. The
            // first-candidate fallback below exists for infrastructure faults
            // (provider down, unparseable response) where delegating to *some*
            // agent still beats erroring — but applying it here would hand the
            // request to an agent the model just said cannot do the job, which
            // is precisely what a policy is for.
            Err(crate::selector::SelectorError::PolicyRefused { reason, usage }) => {
                tracing::info!(
                    %reason,
                    agents_considered = candidates.len(),
                    "routing refused by the operator's policy"
                );
                // The refused selection cost exactly what an accepted one
                // costs — the provider call already happened — so its tokens
                // are recorded on the same path and by the same helper. Written
                // before the log row rather than after, because the row points
                // at it; skipping this is what made a tuning session's rejected
                // calls free in FinOps.
                let selection_token_usage_id =
                    write_selector_token_usage(pool, req.user_id, &req.session_id, &usage).await;
                // A refusal is still a rou
```

### Core Architecture Module: `orchestrator/src/maf/worker.rs`
```
use std::sync::Arc;

use futures::FutureExt;
use nasiko_flow::FlowGuard;
use nasiko_hitl::{HitlStore, NewHitlRequest};
use sqlx::PgPool;
use tracing::{error, info, warn};
use uuid::Uuid;

use super::{
    executor,
    llm::LlmClient,
    types::{MafDefinition, PausedStep, StepOutcome, StepResult},
};

/// Redis stream this worker consumes from. `pub` (not just crate-visible) so every producer —
/// `oss/server/src/maf.rs` (the initial run) and `oss/server/src/hitl/mod.rs` (a resume re-enqueue)
/// — binds to this same constant rather than hardcoding the literal a second and third time; a
/// drift between the two used to mean silently orphaned jobs, no compile error and no runtime
/// error (found in review).
pub const STREAM_KEY: &str = "nasiko:maf:execute";
const GROUP_NAME: &str = "maf-workers";
// Messages idle for longer than this are reclaimed on restart (10 minutes in ms)
const RECLAIM_IDLE_MS: u64 = 600_000;

/// Unique per process: pod name (HOSTNAME in k8s/docker) + OS PID.
/// Two pods or two local processes will never share the same name, so Redis
/// can track their pending-entry lists independently.
fn consumer_name() -> String {
    let hostname = std::env::var("HOSTNAME").unwrap_or_else(|_| "worker".into());
    format!("maf-worker-{hostname}-{}", std::process::id())
}

pub async fn run(
    db: PgPool,
    redis: redis::Client,
    http_client: reqwest::Client,
    flow_guard: Arc<FlowGuard>,
    llm: LlmClient,
    hitl_store: Arc<dyn HitlStore>,
) {
    let consumer = consumer_name();

    let mut conn = match redis.get_multiplexed_async_connection().await {
        Ok(c) => c,
        Err(e) => {
            error!("MAF worker: failed to connect to Redis: {e}");
            return;
        }
    };

    // Create consumer group if it doesn't exist ('$' = only new messages; MKSTREAM creates stream)
    let _: redis::RedisResult<()> = redis::cmd("XGROUP")
        .arg("CREATE")
        .arg(STREAM_KEY)
        .arg(GROUP_NAME)
        .arg("$")
        .arg("MKSTREAM")
        .query_async(&mut conn)
        .await;

    // Reclaim messages that were in-flight when the server last crashed
    reclaim_pending(
        &mut conn,
        &db,
        &http_client,
        &flow_guard,
        &llm,
        &hitl_store,
        &consumer,
    )
    .await;

    info!("MAF worker started, consumer={consumer}, stream={STREAM_KEY}");

    loop {
        let result: redis::RedisResult<redis::Value> = redis::cmd("XREADGROUP")
            .arg("GROUP")
            .arg(GROUP_NAME)
            .arg(&consumer)
            .arg("BLOCK")
            .arg(2000u64)
            .arg("COUNT")
            .arg(1u64)
            .arg("STREAMS")
            .arg(STREAM_KEY)
            .arg(">")
            .query_async(&mut conn)
            .await;

        match result {
            Ok(redis::Value::Nil) => {
                // Block timeout — no messages, loop back
            }
            Ok(val) => {
                for (msg_id, fields) in extract_messages(val) {
                    if let Some(job) = parse_job(&fields) {
                        process_job(
                            job,
                            &msg_id,
                            &mut conn,
                            &db,
                            &http_client,
                            &flow_guard,
                            &llm,
                            &hitl_store,
                        )
                        .await;
                    } else {
                        // Malformed message — ACK to remove from PEL so it doesn't retry forever
                        warn!("MAF worker: could not parse job from message {msg_id}, discarding");
                        ack(&mut conn, &msg_id).await;
                    }
                }
            }
            Err(e) => {
                error!("MAF worker XREADGROUP error: {e}");
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        }
    }
}

struct Job {
    execution_id: Uuid,
    maf_json: String,
    user_id: Uuid,
    /// Run-time data for this execution only, spliced into step 0 by
    /// `executor::run_maf` — see `oss/server/src/maf.rs::RunWorkflowRequest`.
    content: Option<String>,
    /// Present only on a continuation job, `oss/server/src/hitl/mod.rs::deliver_maf`'s `XADD` —
    /// a fresh run always omits these three.
    resume: Option<ResumeFields>,
}

struct ResumeFields {
    step_index: i32,
    task_id: String,
    answer: String,
}

fn parse_job(fields: &[redis::Value]) -> Option<Job> {
    let mut execution_id = None;
    let mut maf_json = None;
    let mut user_id = None;
    let mut content = None;
    let mut resume_step_index = None;
    let mut resume_task_id = None;
    let mut resume_answer = None;

    let mut i = 0;
    while i + 1 < fields.len() {
        // Use continue instead of ? so one malformed field doesn't drop the whole job
        let key = match bulk_str(&fields[i]) {
            Some(k) => k,
            None => {
                i += 2;
                continue;
            }
        };
        let val = match bulk_str(&fields[i + 1]) {
            Some(v) => v,
            None => {
                i += 2;
                continue;
            }
        };
        match key.as_str() {
            "execution_id" => execution_id = val.parse().ok(),
            "maf_json" => maf_json = Some(val),
            "user_id" => user_id = val.parse().ok(),
            "content" => content = Some(val),
            "resume_step_index" => resume_step_index = val.parse().ok(),
            "resume_task_id" => resume_task_id = Some(val),
            "resume_answer" => resume_answer = Some(val),
            _ => {}
        }
        i += 2;
    }

    // A fresh run's message never carries any of these three fields — `None` is the normal case.
    // But `deliver_maf`'s XADD always sends all three together for a continuation, so seeing *some*
    // of them present with even one failing to parse means this message was meant to be a resume,
    // not a fresh run. Falling through to `None` here previously downgraded it into a fresh run
    // from step 0 instead — silently discarding the human's answer and re-invoking every
    // already-succeeded step. Reject the whole job instead, matching the caller's existing
    // malformed-message handling (ACK + discard) rather than mis-executing it.
    let any_resume_field_present =
        resume_step_index.is_some() || resume_task_id.is_some() || resume_answer.is_some();
    let resume = match (resume_step_index, resume_task_id, resume_answer) {
        (Some(step_index), Some(task_id), Some(answer)) => Some(ResumeFields {
            step_index,
            task_id,
            answer,
        }),
        _ if any_resume_field_present => return None,
        _ => None,
    };

    Some(Job {
        execution_id: execution_id?,
        maf_json: maf_json?,
        user_id: user_id?,
        content,
        resume,
    })
}

fn bulk_str(val: &redis::Value) -> Option<String> {
    match val {
        redis::Value::BulkString(b) => String::from_utf8(b.clone()).ok(),
        redis::Value::SimpleString(s) => Some(s.clone()),
        _ => None,
    }
}

// XREADGROUP returns: Array([Array([stream_key, Array([Array([msg_id, Array([k,v,...])])])])])
fn extract_messages(val: redis::Value) -> Vec<(String, Vec<redis::Value>)> {
    let outer = match val {
        redis::Value::Array(v) => v,
        _ => return vec![],
    };
    let stream_entry = match outer.into_iter().next() {
        Some(redis::Value::Array(v)) => v,
        _ => return vec![],
    };
    let messages = match stream_entry.into_iter().nth(1) {
        Some(redis::Value::Array(v)) => v,
        _ => return vec![],
    };

    let mut result = vec![];
    for msg in messages {
        let mut parts = match msg {
            redis::Value::Array(p) if p.len() == 2 => p.into_iter(),
            _ => continue,
        };
        let msg_id = match parts.next().and_then(|v| bulk_str(&v)) {
            Some(id) => id,
            None => continue,
        };
        let fields = match parts.next() {
            Some(redis::Value::Array(f)) => f,
            _ => continue,
        };
        result.push((msg_id, fields));
    }
    result
}

#[allow(clippy::too_many_arguments)]
async fn process_job(
    job: Job,
    msg_id: &str,
    conn: &mut redis::aio::MultiplexedConnection,
    db: &PgPool,
    http_client: &reqwest::Client,
    flow_guard: &Arc<FlowGuard>,
    llm: &LlmClient,
    hitl_store: &Arc<dyn HitlStore>,
) {
    let execution_id = job.execution_id;
    let user_id = job.user_id;
    let content = job.content.clone();
    let maf_json_str = job.maf_json;
    let is_resume = job.resume.is_some();

    // Fetch current attempt counters
    #[derive(sqlx::FromRow)]
    struct AttemptRow {
        attempt_count: i32,
        max_attempts: i32,
    }

    let row = sqlx::query_as::<_, AttemptRow>(
        "SELECT attempt_count, max_attempts FROM maf_executions WHERE id = $1",
    )
    .bind(execution_id)
    .fetch_optional(db)
    .await;

    let (attempt_count, max_attempts) = match row {
        Ok(Some(r)) => (r.attempt_count, r.max_attempts),
        Ok(None) => {
            warn!("MAF execution {execution_id} not found, discarding");
            ack(conn, msg_id).await;
            return;
        }
        Err(e) => {
            error!("MAF worker: DB error for execution {execution_id}: {e}");
            return;
        }
    };

    let new_attempt = attempt_count + 1;

    // Mark as running and increment attempt counter before work begins
    if let Err(e) = sqlx::query(
        "UPDATE maf_executions SET attempt_count = $1, status = 'running', started_at = now(), error = NULL WHERE id = $2",
    )
    .bind(new_attempt)
    .bind(execution_id)
    .execute(db)
    .await
    {
        error!("MAF worker: failed to mark execution {execution_id} running: {e}");

```

### Core Architecture Module: `pricing/src/engine.rs`
```
//! The wired-up resolver: books, ratios and the four steps behind one call.
//!
//! Callers hold one of these and ask it to price a call. Constructing it is the
//! composition root's job; handlers receive it.

use std::sync::Arc;
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use tokio::sync::RwLock;

use crate::book::{PriceBook, StaticPriceBook};
use crate::cost::CostBreakdown;
use crate::db::{DbPriceBook, load_cache_ratios};
use crate::model::resolve_model;
use crate::quote::{PriceQuote, quote};
use crate::ratio::CacheRatios;
use crate::usage::{NormalizedUsage, PromptConvention, RawUsage, normalize_usage};

/// How long derived cache ratios are reused. They move only when the pricing
/// sync widens its coverage, which it does daily at most.
const RATIO_TTL: Duration = Duration::from_secs(3_600);

/// Everything a caller needs to persist about one priced call.
#[derive(Debug, Clone, PartialEq)]
pub struct PricedCall {
    /// The four token classes, with `input` guaranteed cache-exclusive.
    pub usage: NormalizedUsage,
    /// The rates used, and where each came from.
    pub quote: PriceQuote,
    /// Spend, split by token class.
    pub cost: CostBreakdown,
}

impl PricedCall {
    /// Why this call cost what it did, for storing alongside the figure.
    ///
    /// Defined here rather than at each call site so all usage writers record
    /// provenance in the same shape.
    pub fn provenance(&self) -> serde_json::Value {
        serde_json::json!({
            "source": format!("{:?}", self.quote.source),
            "cache_source": format!("{:?}", self.quote.cache_source),
            "estimated": self.cost.estimated,
            "resolved_as": self.quote.resolved_as,
            "rates_per_1m": {
                "input": self.quote.input_per_1m,
                "output": self.quote.output_per_1m,
                "cache_read": self.quote.cache_read_per_1m,
                "cache_creation": self.quote.cache_creation_per_1m,
                "cache_creation_1h": self.quote.cache_creation_1h_per_1m,
            },
            "input_usd": self.cost.input_usd,
            "output_usd": self.cost.output_usd,
            "cache_read_usd": self.cost.cache_read_usd,
            "cache_creation_usd": self.cost.cache_creation_usd,
        })
    }
}

/// Prices a call against the synced price book, falling back to list prices and
/// then to vendor cache conventions.
pub struct PricingEngine {
    books: Vec<Box<dyn PriceBook>>,
    ratios: RwLock<Option<(Arc<CacheRatios>, Instant)>>,
    /// `None` for an offline engine — see [`PricingEngine::offline`].
    db: Option<PgPool>,
}

impl PricingEngine {
    /// The production engine: the synced price book first, list prices behind it.
    pub fn new(db: PgPool) -> Self {
        Self {
            books: vec![
                Box::new(DbPriceBook::new(db.clone())),
                Box::new(StaticPriceBook),
            ],
            ratios: RwLock::new(None),
            db: Some(db),
        }
    }

    /// List prices only, with no database behind it.
    ///
    /// For unit tests, which the repo requires to be hermetic, and for any
    /// caller that has no pool. Handing `new` an unreachable pool instead makes
    /// every lookup wait out a connect timeout — a suite that used one took two
    /// minutes and then failed.
    pub fn offline() -> Self {
        Self {
            books: vec![Box::new(StaticPriceBook)],
            ratios: RwLock::new(None),
            db: None,
        }
    }

    /// Normalize, resolve rates, and cost one call.
    ///
    /// `at` is when the call happened, not now — `model_pricing` carries price
    /// history, and re-pricing an old call at today's rates rewrites it.
    pub async fn price(
        &self,
        provider: Option<&str>,
        model: &str,
        raw: RawUsage,
        convention: PromptConvention,
        at: DateTime<Utc>,
    ) -> PricedCall {
        self.price_with_context(
            provider,
            model,
            raw,
            convention,
            at,
            crate::PricingContext::default(),
        )
        .await
    }

    /// Price reported cache durations and serving context through the same engine.
    pub async fn price_with_context(
        &self,
        provider: Option<&str>,
        model: &str,
        raw: RawUsage,
        convention: PromptConvention,
        at: DateTime<Utc>,
        context: crate::PricingContext<'_>,
    ) -> PricedCall {
        let usage = normalize_usage(raw, convention);
        let key = resolve_model(provider.filter(|p| *p != "unknown"), model);
        let ratios = self.ratios().await;
        let books: Vec<&dyn PriceBook> = self.books.iter().map(Box::as_ref).collect();
        let quote = quote(&books, &key, at, &ratios).await;
        let cost = crate::context::context_cost(&usage, &quote, &key, context);
        PricedCall { usage, quote, cost }
    }

    /// Cache ratios, refreshed from the price book on a TTL so the inference
    /// used for cache-less models sharpens as the sync widens its coverage.
    async fn ratios(&self) -> Arc<CacheRatios> {
        if let Some((ratios, loaded_at)) = self.ratios.read().await.as_ref()
            && loaded_at.elapsed() < RATIO_TTL
        {
            return ratios.clone();
        }
        let fresh = Arc::new(match &self.db {
            Some(db) => load_cache_ratios(db).await,
            None => CacheRatios::measured(),
        });
        *self.ratios.write().await = Some((fresh.clone(), Instant::now()));
        fresh
    }
}

```

### Core Architecture Module: `react-agent/src/react_loop.rs`
```
use std::sync::Arc;

use crate::completion::{CompletionEvent, UsageModel};
use futures::StreamExt;
use rig::completion::message::ToolCall;
use rig::completion::{AssistantContent, CompletionModel as _, Message, ToolDefinition};
use rig::tool::{ToolDyn, ToolError, ToolSet, ToolSetError};
use tokio::sync::mpsc;

use crate::a2a::{A2aClient, PauseInfo};
use crate::context::{ContextConfig, ContextManager};
use crate::error::OrchestratorError;
use crate::events::{OrchestratorEvent, PolicyRejectionKind};
use crate::guard::CallGuard;
use crate::policy::DelegationPolicy;
use crate::registry::{AgentInfo, AgentRegistry, RegistrySource};
use crate::tool::{A2aTool, A2aToolError};

/// The outcome of one `toolset.call()`, with a real pause recovered from `rig`'s type-erased
/// `Result<String, ToolSetError>` instead of being indistinguishable from an ordinary failure.
/// Pure — no side effects, no channel sends — so every `toolset.call()` site (`Orchestrator::run()`
/// and both of `run_stream_inner()`'s) can classify identically by calling the same function,
/// rather than each independently deciding what counts as a pause.
///
/// Deliberately not `Success(String)`/`Failure(String)` variants carrying the `Ok`/`Err` payload:
/// every call site already has its own existing, unchanged handling for the non-pause case
/// (`match result { Ok(..) => .., Err(..) => .. }`, untouched by this classification) — a
/// `NotAwaitingHuman` outcome that duplicated that payload would just be dead weight nothing
/// reads, which is exactly what the compiler's `dead_code` lint caught on the first version of
/// this enum.
enum ToolOutcome {
    AwaitingHuman {
        agent: String,
        agent_id: String,
        pause: PauseInfo,
    },
    NotAwaitingHuman,
}

/// Recovers `A2aToolError::AwaitingHuman` through `rig-core`'s type erasure: `ToolSetError`
/// wraps `ToolError::ToolCallError(Box<dyn std::error::Error + Send + Sync>)`, built by `rig`'s
/// own blanket `ToolDyn` impl from the tool's real `A2aToolError`. `downcast_ref` recovers the
/// concrete type from that box — proven against the actual pinned `rig-core` dependency in
/// `tool.rs`'s `awaiting_human_survives_rig_toolset_erasure` test, not assumed here.
fn classify_tool_result(result: &Result<String, ToolSetError>) -> ToolOutcome {
    if let Err(ToolSetError::ToolCallError(ToolError::ToolCallError(boxed))) = result
        && let Some(A2aToolError::AwaitingHuman {
            agent,
            agent_id,
            pause,
        }) = boxed.downcast_ref::<A2aToolError>()
    {
        return ToolOutcome::AwaitingHuman {
            agent: agent.clone(),
            agent_id: agent_id.clone(),
            pause: pause.clone(),
        };
    }
    ToolOutcome::NotAwaitingHuman
}

/// Attribute one completion's total token cost evenly across the tool calls
/// it produced — the API gives one usage figure per completion, not per tool
/// call, so this is the best available granularity for `CallGuard::after_call`.
/// `None` (no usage reported) or zero tool calls both yield 0.
fn tokens_per_tool_call(completion_tokens: Option<u64>, num_tool_calls: usize) -> u64 {
    completion_tokens
        .map(|t| t / num_tool_calls.max(1) as u64)
        .unwrap_or(0)
}

/// Does the operator's policy refuse this call? `Some(reason)` if so.
///
/// The decision only — no reporting — because the two loops report it in
/// different shapes (`run_stream_inner` sends an event, `run` records a trace)
/// and only the *decision* has to stay identical between them.
fn policy_refusal(config: &OrchestratorConfig, tc: &ToolCall) -> Option<String> {
    config
        .policy
        .as_ref()
        .and_then(|p| p.check_tool_call(&tc.function.arguments).err())
}

/// What the model is told when a call is blocked, in the tool-result context.
///
/// One wording for both loops. They had drifted — one said `Blocked:` and the
/// other `BLOCKED: … Do NOT retry`, so the same policy taught the model two
/// different lessons depending on which entry point ran it.
fn blocked_note(tool_name: &str, reason: &str) -> String {
    format!(
        "[{tool_name}] BLOCKED: {reason}. Do NOT retry this agent with different \
         arguments unless you have a concrete reason to."
    )
}

/// The policy + call-guard gate for one tool call, in `run_stream_inner`'s
/// event-channel reporting style (`OrchestratorEvent::PolicyRejected` plus a
/// message telling the model not to retry). Both of its branches call this —
/// they differ in how a turn gets here, not in what a rejection looks like once
/// it has, and this used to be a byte-for-byte copy in each, with no structural
/// signal that a change to one needed the other.
///
/// `true` means the call was blocked — already reported on `tx` and already
/// pushed onto `results_for_context` — so the caller should `continue` its loop
/// rather than call the tool.
async fn call_is_blocked(
    tc: &ToolCall,
    agent_display: &str,
    config: &OrchestratorConfig,
    guard: Option<&dyn CallGuard>,
    tx: &mpsc::Sender<OrchestratorEvent>,
    turn_idx: usize,
    results_for_context: &mut Vec<String>,
) -> bool {
    let name = &tc.function.name;

    // Operator policy first, before the flow guard: a call the policy rejects
    // should never consume fan-out or depth budget, and `before_call`
    // increments both.
    if let Some(reason) = policy_refusal(config, tc) {
        let _ = tx
            .send(OrchestratorEvent::PolicyRejected {
                agent: agent_display.to_string(),
                reason: reason.clone(),
                turn: turn_idx + 1,
                kind: PolicyRejectionKind::Delegation,
            })
            .await;
        results_for_context.push(blocked_note(name, &reason));
        return true;
    }

    if let Some(g) = guard
        && let Err(reason) = g.before_call(agent_display).await
    {
        let _ = tx
            .send(OrchestratorEvent::PolicyRejected {
                agent: agent_display.to_string(),
                reason: reason.clone(),
                turn: turn_idx + 1,
                kind: PolicyRejectionKind::FlowGuard,
            })
            .await;
        results_for_context.push(blocked_note(name, &reason));
        return true;
    }

    false
}

/// The orchestrator's system prompt. One builder for both loops — `run()` and
/// `run_stream_inner()` previously carried byte-identical copies of this text,
/// so a change to the policy had to be made twice to take effect.
///
/// The roster/protocol/rules block is the stable prefix and the two
/// caller-supplied sections come last, so OpenAI's prefix-based prompt caching
/// hits across turns even when those sections change. `{custom}` (e.g. the L1A
/// supplemental context built in `oss/server/src/router/a2a_dispatch.rs`) is a
/// query-ranked top-k slice, so it varies turn to turn; it used to sit at the
/// very top, where any variation invalidated the whole cached prompt.
///
/// `{policy_footer}` is placed after `{custom}` even though it is the more
/// stable of the two, because it is the one section whose purpose depends on
/// being read last: a rule about HOW to answer was reliably ignored when it sat
/// earlier (see `DelegationPolicy::preamble_footer`). The cost is that the
/// org-rules block — at most fifty short lines — falls outside the cached
/// prefix, while the far larger stable block ahead of it still caches. Ordering
/// them the other way would re-bury the rules behind a `{custom}` that grows
/// with the size of the fleet.
fn build_preamble(config: &OrchestratorConfig, agents: &[AgentInfo]) -> String {
    let agent_list: String = agents
        .iter()
        .map(|a| {
            let skills = a
                .skills
                .iter()
                .map(|s| {
                    // The skill's own documented inputs. Without them the model invents wording
                    // for a skill that may only answer to an exact phrase — and the agent then
                    // answers a question the user never asked.
                    let examples = if s.examples.is_empty() {
                        String::new()
                    } else {
                        format!(
                            "\n      send exactly: {}",
                            s.examples
                                .iter()
                                .map(|e| format!("\"{e}\""))
                                .collect::<Vec<_>>()
                                .join(" | ")
                        )
                    };
                    format!("    - {}: {}{}", s.name, s.description, examples)
                })
                .collect::<Vec<_>>()
                .join("\n");
            format!(
                "  • {} (tool: `{}`)\n    {}\n{}",
                a.name,
                A2aTool::tool_name(&a.name),
                a.description,
                skills
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    // Each section carries its OWN separator rather than taking one from the
    // template, so an absent section leaves nothing behind — not even the blank
    // line a `{placeholder}` wrapped in newlines would. With no policy and no
    // caller preamble the prompt below carries no trace that either seam exists,
    // which `no_policy_leaves_the_preamble_untouched` pins against the exact
    // joins rather than against trimmed text. (It no longer matches the prompt
    // from before the seam byte for byte — `{custom}` has since moved from the
    // top to the tail for prompt-cache stability, see this function's docs.)
    // `custom` carries its own separator for the same reason the policy sections
    // below do: an absent section must leave nothing behind, not even the blank
    // line a `{placeholder}` wrapped in newlines would.
    let custom = match config.preamble.as_deref() {
        Some(text) if !text.trim().is_empty() => format!("\n\n{text}"),

```

### Core Architecture Module: `server/src/agent_lifecycle.rs`
```
//! Generic hook fired when an agent is deleted, for enterprise-only cleanup of agent-keyed state
//! that OSS has no knowledge of. Deliberately generic-named — no enterprise-specific naming —
//! same pattern as `prompt_context`: OSS defines the shape and ships a no-op default, EE
//! composition roots override it.

use std::sync::{Arc, RwLock};

use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
pub trait AgentDeletionHook: Send + Sync {
    /// Called once, best-effort, right after `agents.deleted_at` has been set for `agent_id` —
    /// a chance for enterprise-only, agent-keyed state that OSS's schema has no FK for (so a soft
    /// delete can't cascade to it) to clean itself up. Must never fail or block the delete
    /// request: implementations should log and swallow their own errors, the same way the MCP
    /// gateway token revoke right above this call site does.
    async fn on_agent_deleted(&self, agent_id: Uuid);
}

/// OSS default — nothing enterprise-only is wired up, so there is nothing to clean up.
pub struct NoopAgentDeletionHook;

#[async_trait]
impl AgentDeletionHook for NoopAgentDeletionHook {
    async fn on_agent_deleted(&self, _agent_id: Uuid) {}
}

/// Holds an `AgentDeletionHook` behind a lock so the implementation can be swapped after
/// `AppState` has already been cloned — needed for exactly the reason
/// `prompt_context::SwappablePromptContext` exists (see its doc comment): the EE composition
/// root's real implementation is installed by `build_ee_app`, but the build worker is spawned
/// with an `AppState` clone taken earlier, inside `AppState::from_config_with_db`, strictly
/// before `build_ee_app` ever runs. Reassigning a plain `Arc<dyn AgentDeletionHook>` field only
/// rebinds *that* later clone's own pointer — the worker's earlier clone would keep calling the
/// OSS no-op for its entire lifetime, silently defeating every hard-delete cleanup path that
/// runs inside it (`oss/server/src/agents/{build_worker,upload,utils}.rs`). Installing *through*
/// this shared cell instead makes the swap visible to every existing and future clone.
pub struct SwappableAgentDeletionHook(RwLock<Arc<dyn AgentDeletionHook>>);

impl SwappableAgentDeletionHook {
    pub fn new(initial: Arc<dyn AgentDeletionHook>) -> Self {
        Self(RwLock::new(initial))
    }

    /// Replaces the underlying implementation for every clone, past and future, of the
    /// `AppState` this cell lives in.
    pub fn install(&self, new: Arc<dyn AgentDeletionHook>) {
        *self.0.write().expect("agent deletion hook lock poisoned") = new;
    }

    pub async fn on_agent_deleted(&self, agent_id: Uuid) {
        let current = self
            .0
            .read()
            .expect("agent deletion hook lock poisoned")
            .clone();
        current.on_agent_deleted(agent_id).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct RecordingHook(std::sync::Mutex<Vec<Uuid>>);

    #[async_trait]
    impl AgentDeletionHook for RecordingHook {
        async fn on_agent_deleted(&self, agent_id: Uuid) {
            self.0
                .lock()
                .expect("recording hook lock poisoned")
                .push(agent_id);
        }
    }

    /// Reproduces the exact bug this cell exists to prevent: a background task clones `AppState`
    /// (here, just the `Arc<SwappableAgentDeletionHook>` field) BEFORE the EE composition root
    /// installs the real implementation. The clone must still see the swap, because
    /// `AppState::clone()` only clones the `Arc` pointer to this one shared cell.
    #[tokio::test]
    async fn install_is_visible_to_a_clone_taken_before_the_install_call() {
        let cell = Arc::new(SwappableAgentDeletionHook::new(Arc::new(
            NoopAgentDeletionHook,
        )));

        // Simulates `worker_state = state.clone()`, captured before `build_ee_app` runs.
        let pre_install_clone = cell.clone();

        let recorder = Arc::new(RecordingHook(std::sync::Mutex::new(Vec::new())));
        // Simulates `build_ee_app`'s `state.agent_deletion_hook.install(...)`.
        cell.install(recorder.clone());

        let agent_id = Uuid::new_v4();
        // The EARLIER clone — not `cell` itself — must now see the installed implementation.
        pre_install_clone.on_agent_deleted(agent_id).await;

        assert_eq!(
            recorder
                .0
                .lock()
                .expect("recording hook lock poisoned")
                .as_slice(),
            &[agent_id],
            "a clone taken before install() must still observe the swap"
        );
    }
}

```

### Core Architecture Module: `server/src/agents/utils.rs`
```
use std::sync::Arc;

use uuid::Uuid;

use crate::agent_lifecycle::SwappableAgentDeletionHook;
use crate::build::BuildStatus;

/// Fetch the agent's card from its runtime endpoint and persist the fields
/// clients depend on: display_name, description, skills, tags, capabilities,
/// and `transport_path` (see [`nasiko_types::a2a::extract_transport_path`]).
///
/// Returns true if a card was fetched and applied. Every deploy path
/// (seed / upload / update / rollback) must go through this so `nasiko ps`
/// and the UI can surface a chat URL that actually works.
pub(crate) async fn fetch_and_apply_agent_card(
    db: &sqlx::PgPool,
    http: &reqwest::Client,
    agent_id: Uuid,
    agent_url: &str,
) -> bool {
    if agent_url.is_empty() {
        return false;
    }

    let base = agent_url.trim_end_matches('/');

    let urls = [
        format!("{base}/.well-known/agent-card.json"),
        format!("{base}/.well-known/agent.json"),
    ];

    let mut card: Option<serde_json::Value> = None;
    for url in &urls {
        if let Ok(resp) = http.get(url).send().await
            && resp.status().is_success()
            && let Ok(v) = resp.json::<serde_json::Value>().await
        {
            card = Some(v);
            break;
        }
    }

    let card = match card {
        Some(c) => c,
        None => return false,
    };

    if let Err(e) = sqlx::query(
        r#"UPDATE agents SET
             display_name = COALESCE($2, display_name),
             description = COALESCE($3, description),
             skills = COALESCE($4, skills),
             tags = COALESCE($5, tags),
             capabilities = COALESCE($6, capabilities),
             transport_path = COALESCE($7, transport_path),
             updated_at = now()
           WHERE id = $1"#,
    )
    .bind(agent_id)
    .bind(card.get("name").and_then(|v| v.as_str()))
    .bind(card.get("description").and_then(|v| v.as_str()))
    .bind(card.get("skills"))
    .bind({
        let mut tags: Vec<String> = card
            .get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();
        if let Some(skills) = card.get("skills").and_then(|v| v.as_array()) {
            for skill in skills {
                if let Some(skill_tags) = skill.get("tags").and_then(|v| v.as_array()) {
                    for t in skill_tags.iter().filter_map(|v| v.as_str()) {
                        if !tags.contains(&t.to_string()) {
                            tags.push(t.to_string());
                        }
                    }
                }
            }
        }
        if tags.is_empty() { None } else { Some(tags) }
    })
    .bind(card.get("capabilities"))
    .bind(nasiko_types::a2a::extract_transport_path(&card))
    .execute(db)
    .await
    {
        tracing::error!(%agent_id, %e, "failed to apply agent card fields to DB");
        return false;
    }

    if let Some(skills_json) = card.get("skills") {
        crate::catalog::skills::sync_agent_skills_json(db, agent_id, skills_json).await;
    }

    embed_updated_agent(db, agent_id).await;

    true
}

/// Re-reads the agent's current name/description/tags and embeds+persists
/// them via `nasiko_orchestrator::embed_and_store_agent`, so routing's Stage 1
/// doesn't have to do it lazily on the next `route()` call. Best-effort —
/// failures are logged and never block the deploy/update flow.
///
/// Reads `OPENAI_API_KEY`/`OPENAI_BASE_URL`/`EMBEDDING_MODEL` straight from
/// the environment rather than threading `Config` through every deploy path
/// (seed / upload / update / rollback) that reaches this function — same
/// env-driven approach `nasiko_config::Config` itself uses for these fields.
async fn embed_updated_agent(db: &sqlx::PgPool, agent_id: Uuid) {
    let Ok(api_key) = std::env::var("OPENAI_API_KEY") else {
        return;
    };
    let base_url =
        std::env::var("OPENAI_BASE_URL").unwrap_or_else(|_| "https://api.openai.com".into());
    let model =
        std::env::var("EMBEDDING_MODEL").unwrap_or_else(|_| "text-embedding-3-small".into());

    let row: Option<(String, Option<String>, Vec<String>)> =
        sqlx::query_as("SELECT name, description, tags FROM agents WHERE id = $1")
            .bind(agent_id)
            .fetch_optional(db)
            .await
            .unwrap_or(None);

    let Some((name, description, tags)) = row else {
        return;
    };

    let agent = nasiko_orchestrator::AgentCard {
        id: agent_id,
        name,
        description: description.unwrap_or_default(),
        skills: vec![],
        tags,
        url: None,
        embedding: None,
        embedding_content_hash: None,
    };

    if let Err(e) =
        nasiko_orchestrator::embed_and_store_agent(db, &agent, &api_key, &base_url, &model).await
    {
        tracing::warn!(%agent_id, error = %e, "proactive agent embedding failed (non-fatal, will be computed lazily on next route())");
    }
}

/// Ensure a successful `runtime.deploy()` is visible to the crash-loop
/// guardian (EE) by guaranteeing an `agent_deployments` row exists for this
/// agent. `agent_deployments.build_id` is a NOT NULL FK to `agent_builds`, so
/// a deploy path with no real build job (`seed.rs`, or a first-time
/// deploy-by-image with no prior `agent_builds` row) has nothing to
/// reference — this synthesizes a minimal `agent_builds` row (status
/// 'success', no real build artifact) rather than skipping the insert, which
/// previously left those agents with zero crash-loop protection and no
/// indication anywhere that this was the case (see
/// docs/CRASH_GUARDIAN_REPORT.md §5.1/§5.3).
pub(crate) async fn ensure_deployment_tracked(
    db: &sqlx::PgPool,
    agent_id: Uuid,
    owner_id: Option<Uuid>,
    image: &str,
) {
    let existing_build_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM agent_builds WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(agent_id)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();

    let build_id = match existing_build_id {
        Some(id) => id,
        None => {
            let version_tag = image
                .rsplit('/')
                .next()
                .unwrap_or(image)
                .rsplit_once(':')
                .map(|(_, tag)| tag.to_string())
                .unwrap_or_else(|| "latest".to_string());

            let synthesized: Result<Uuid, sqlx::Error> = sqlx::query_scalar(
                "INSERT INTO agent_builds (agent_id, version_tag, image_reference, status)
                 VALUES ($1, $2, $3, 'success')
                 RETURNING id",
            )
            .bind(agent_id)
            .bind(version_tag)
            .bind(image)
            .fetch_one(db)
            .await;

            match synthesized {
                Ok(id) => id,
                Err(e) => {
                    tracing::error!(%e, %agent_id, "failed to synthesize agent_builds row for deployment tracking");
                    return;
                }
            }
        }
    };

    let _ = sqlx::query(
        "INSERT INTO agent_deployments (agent_id, build_id, owner_id, status, k8s_deployment_name)
         VALUES ($1, $2, $3, 'running', $4)",
    )
    .bind(agent_id)
    .bind(build_id)
    .bind(owner_id)
    .bind(agent_id.to_string())
    .execute(db)
    .await;
}

/// Retry wrapper around [`fetch_and_apply_agent_card`] for freshly deployed
/// containers that need a few seconds to become healthy.
pub(crate) async fn fetch_agent_card_with_retry(
    db: sqlx::PgPool,
    http: reqwest::Client,
    agent_id: Uuid,
    agent_url: String,
) {
    for attempt in 1..=30u32 {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        if fetch_and_apply_agent_card(&db, &http, agent_id, &agent_url).await {
            return;
        }
        tracing::debug!(%agent_id, attempt, "agent card fetch attempt failed");
    }
    tracing::warn!(%agent_id, url = %agent_url, "agent card fetch: giving up after retries");
}

/// On failure of a first-time deploy (no prior successful `agent_builds`), delete
/// the agents row so no orphaned `status='failed'` record is left in the catalog.
///
/// For re-uploads of an existing, previously-working agent, the row is kept and
/// set to `status='failed'` so the agent's history and grants are preserved.
///
/// Cascade effects of the DELETE path (all intentional):
/// - `agent_builds`      ON DELETE CASCADE  → failed build records removed
/// - `build_jobs`        ON DELETE CASCADE  → orphaned job rows removed
/// - `agent_deployments` ON DELETE CASCADE  → deployment rows removed
/// - `agent_versions`    ON DELETE CASCADE  → version history removed
/// - `upload_status`     ON DELETE SET NULL → row survives; agent_id becomes NULL
///
/// This is a real `DELETE`, not the soft-delete `oss/server/src/catalog/routes.rs::delete()`
/// uses — so it never goes through that handler's own `agent_deletion_hook` call. It must fire
/// the hook itself here, or enterprise-only, agent-keyed state with no FK to `agents` (e.g. an
/// L1A domain set on this brand-new agent before its first build ever finished) would be left
/// permanently orphaned with nothing left to clean it up.
pub(crate) async fn delete_agent_or_mark_failed(
    db: &sqlx::PgPool,
    agent_id: Uuid,
    deletion_hook: &Arc<SwappableAgentDeletionHook>,
) {
    let has_prior_success: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM agent_builds WHERE agent_id = $1 AND status = 'success')",
    )
    .bind(agent_id)
    .fetch_one(db)
    .await
    .unwrap_or(false);

    if has_prior_success {
        let _ =
            sqlx::query("UPDATE agents SET status = 'failed', updated_at = now() WHERE id = $1")
                .bind(agent_id)
                .execute(db)
                .await;
    } els
```

### Core Architecture Module: `server/src/mcp/handlers/webhooks.rs`
```
//! Composio webhook route (`POST /api/mcp/webhooks/composio`, public).
//!
//! Verifies the HMAC signature (fail-closed when no secret) against the raw body,
//! then delegates the effect to the service layer.

use axum::{
    Json,
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};

use super::super::service;
use crate::state::AppState;

pub async fn composio(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    let raw = String::from_utf8_lossy(&body).to_string();

    // Fail CLOSED: without a secret we can't distinguish Composio from anyone.
    let Some(secret) = &state.mcp.config.composio_webhook_secret else {
        tracing::error!(
            "COMPOSIO_WEBHOOK_SECRET not set — refusing to process unauthenticated webhook"
        );
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "webhook processing disabled",
        )
            .into_response();
    };

    let get = |name: &str| {
        headers
            .get(name)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
    };
    let (id, ts, sig) = (
        get("webhook-id"),
        get("webhook-timestamp"),
        get("webhook-signature"),
    );
    if id.is_empty() || ts.is_empty() || sig.is_empty() {
        return (
            StatusCode::UNAUTHORIZED,
            "missing webhook signature headers",
        )
            .into_response();
    }
    if !service::webhooks::verify_signature(id, ts, &raw, sig, secret) {
        return (StatusCode::UNAUTHORIZED, "invalid webhook signature").into_response();
    }

    let payload: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, "invalid JSON payload").into_response(),
    };

    match service::webhooks::process(&state, &payload).await {
        Ok(outcome) => {
            tracing::debug!(?outcome, "processed composio webhook");
            (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "composio webhook processing failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "status": "error" })),
            )
                .into_response()
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #336** (2026-10-03): **feat(router): implement P2 request classifier, L2 cache bypass, evalu…**
  *Symptoms*: …ation harness, and Aetheris Cortex studio

- **Issue #316** (2026-10-03): **[compact-tools] Implement Track P1 schema compaction, fail-closed val…**
  *Symptoms*: ## Track **P1 — Compact Tool Schemas Without Breaking Tool Calls**  ---  ## 1. Executive Summary & Core Idea  ### The Problem Agentic systems pass verbose JSON Schema definitions with every turn. When multiple tools are provided, repeated schema boilerplate (`"type": "object"`, `"properties"`, nested braces) drains token budgets and inflates latency.  ### The Core Idea: *"Compress representation, never semantics."* We built `nasiko-tool-compact` in Rust. It compiles supported JSON Schema definitions into a deterministic, single-line DSL while strictly preserving all type and validation rules:  $$\text{JSON Schema} \longrightarrow \text{Compact Representation} \longrightarrow \text{LLM Call} \longrightarrow \text{Streaming Decoder} \longrightarrow \text{Strict Validation}$$  If a schema uses unsupported features (`$ref`, `anyOf`, `allOf`, custom ranges), the system **fails closed**: compaction is bypassed and native tools are passed through untouched (0% savings, 100% semantic fidelity).  ---  ## 2. How It Works  1. **Schema Compaction (`ToolSchema`)**: Converts schemas into canonical single-line signatures:    ```text    create_calendar_event(title: str, start: str(format=date-time), attendees?: [str], reminder_minutes?: int) "Create event"    ```    Preserves primitives (`str`, `int`, `num`, `bool`), arrays (`[T]`), optionality (`?`), enums (`["a"|"b"]`), nested objects, formats, and descriptions.  2. **Compact Call Grammar**: The model invokes too

- **Issue #312** (2026-10-03): **Classifier hackathon**
  *Symptoms*: 

- **Issue #303** (2026-10-03): **[compact-tools] Initial scaffolding for compact tool schema encoding/…**
  *Symptoms*: …decoding  - Add new crate tool-compact/ for standalone tool schema compression - Add compact_tools_eval.rs example for P1 track evaluation - Add classifier_eval.rs baseline for P2 track evaluation - Update root Cargo.toml to include tool-compact in workspace - Library API: encode_tools(), decode_calls(), StreamDecoder for incremental parsing - Fail-closed validation: unknown tools, missing required fields, invalid enums return errors - Tests and documentation for streaming edge cases (markers split across chunks)
  **Post-Mortem & Fix Analysis**:
  > 1 has a issue from private side so therefore 1 is failed
  > Here is a complete GitHub PR summary you can paste into the PR description or use as the updated body for this PR.  PR title: [compact-tools] Initial scaffolding for compact tool schema encoding  PR summary:  ## Summary  This PR introduces the initial scaffolding for a compact tool schema encoding layer for Nasiko’s agent/tool ecosystem.  The goal is to reduce the overhead of tool metadata while preserving compatibility with existing agent tool contracts, runtime execution, and future provider integrations. This sets up the groundwork for a more efficient representation of tool definitions without forcing a breaking change to the broader system.  ## Problem  As the agent runtime grows, tool schemas become increasingly large and repetitive. Tool definitions are often passed through multiple layers of the system, including: - agent metadata - runtime routing - MCP/tool discovery - provider-facing execution - UI or debugging surfaces  This creates friction in terms o

- **Issue #274** (2026-10-03): **Classifier hackathon**
  *Symptoms*: 

- **Issue #219** (2026-10-03): **[compact-tools] Compact tool schemas: signature-line encoding + fail-closed call decoder**
  *Symptoms*: # [compact-tools] Compact tool schemas: signature-line encoding + fail-closed call decoder  ## What this does  Replaces verbose JSON Schema tool definitions with one **signature line per tool**, and replaces the provider-native `tool_calls` channel with an inline `<<call …>>` marker the model emits in its text. Prompt tokens for tool definitions drop 36.1% on the public sample (measured with `o200k_base`, see below) with zero change to what the model can express.  **Example.** This definition (~120 tokens as JSON Schema):  ```json {"name": "create_calendar_event", "description": "Create an event in the user's calendar.",  "parameters": {"type": "object", "properties": {    "title": {"type": "string"}, "start": {"type": "string", "format": "date-time"},    "attendees": {"type": "array", "items": {"type": "string"}}},   "required": ["title", "start"]}} ```  becomes one line:  ```text create_calendar_event(title:str, start:datetime, attendees?:[str]) - Create an event in the user's calendar. ```  and the model calls it with:  ```text <<call create_calendar_event {"title":"Design review","start":"2026-10-05T15:00:00+05:30"}>> ```  ## Grammar  ```text signature := name "(" params ")" (" - " description)? params    := param (", " param)* param     := name "?"? ":" type        # trailing "?" = optional type      := "str" | "int" | "num" | "bool" | "datetime" | "date"            | "[" type "]"              # array            | "{" params "}"            # inline object, nesting allowe
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #217 — same implementation, same diff. Closing this one to keep a single submission.

- **Issue #210** (2026-10-03): **[classifier] Add import for Duration in classifier.rs**
  *Symptoms*: 

- **Issue #207** (2026-10-03): **[compact-tools] Compact tool schemas with fail-closed decode**
  *Symptoms*: ## Track P1 — Compact tool schemas (`[compact-tools]`)  ## Summary - New pure crate `tool-compact/` (`nasiko-tool-compact`): `encode_tools`, `decode_calls`, `StreamDecoder`, optional `decode_tools` / `render_calls` - Grammar: `name(fields) - desc` + `<<call name {json}>>` (same markers as the public sample; decoder cases fed as-is) - Fail-closed validation (unknown tool / missing required / bad enum → error, never a guessed call) - Streaming decoder handles split markers and `>>` inside JSON strings - Eval example `llm-router/examples/compact_tools_eval.rs` (offline default; live when `PROVIDER_BASE_URL` + `MODEL` set) - Bonus opt-in router seam: `TOKEN_TOOL_COMPACT` (default **off**); disabled path proven byte-identical  ## How to run ```sh curl -fsSL https://registry.nasiko.dev/r/nasiko/compact-tools-eval -o /tmp/compact-tools-eval.json EVAL_SET=/tmp/compact-tools-eval.json OUT=/tmp/out.jsonl \   cargo run --release -p nasiko-llm-router --example compact_tools_eval ```  Optional env vars: - `PROVIDER_BASE_URL` + `MODEL` — live OpenAI-compatible chat at temperature 0 - `PROVIDER_API_KEY` — Bearer token for live mode (never committed) - Router opt-in: `TOKEN_TOOL_COMPACT=true`  ## Model IDs used None for the reported offline run (deterministic, no network).  ## Measured results (claims only; harness scores) Public sample, offline, `o200k_base` local estimate on full `compact_request` bodies: - Token reduction ≈ **40.1%** (baseline 764 → compact 458) - Round-trip: all `ct-*` c
  **Post-Mortem & Fix Analysis**:
  > Closing — request to revert / unpublish this submission.

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

### Incident Patch 1: `2d392244` (2026-10-02)
**Commit Message**: Merge pull request #539 from Nasiko-Labs/feat/react-ui-replacement

Token-optimisation savings ledger, API and dashboard
[synced-from-private]



---

### Incident Patch 2: `2a779f3d` (2026-10-02)
**Commit Message**: Merge remote-tracking branch 'origin/development' into feat/react-ui-replacement
[synced-from-private]

**File**: `ui/common/src/features/settings/SettingsLayout.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
  * rail does: the same nav in a full-height column beside the rail from 1024 px, a sheet opened from above the page
  * below that. The page scrolls in its own column (the shell fills the viewport on /settings, as on /chat). The rows
  * are nasiko-cloud-rs (`origin/development` a4853db4) `ui/oss/navigation.js` `MODULE_NAVS.settings` plus
- * `ui/ee/web/nav-ext-ee.js`:
+ * whatever an edition layer appends:
  * - Workspace: General, (EE: Orchestrator), Flow limits, Registry. `/settings?section=`.
  * - Security: (EE: Single sign-on), Secrets (`/settings/secrets`), Chat context (`/settings/chat-context`; nasiko-cloud-rs
  *   `35c749af`, every user's own).
```

**File**: `ui/common/src/index.css` (modified, +5/-2)
```diff
@@ -302,8 +302,11 @@
   --border: oklch(0.922 0 0);
   --input: oklch(0.922 0 0);
   --foreground: oklch(0.145 0 0);
-  /* Lab: 0.556 was 4.3:1 on --muted, the hover fill of rows with a secondary line (chat rail); 0.54 is 4.6:1. */
-  --muted-foreground: oklch(0.54 0 0);
+  /* Lab: 0.556 was 4.3:1 on --muted, the hover fill of rows with a secondary line (chat rail); 0.54 is 4.6:1.
+     0.54 then failed on --accent, which is a step deeper than --muted (0.94 vs 0.97): 4.2:1, caught by axe on the
+     trace waterfall's duration label. Tuned against --accent instead, the darkest fill muted text sits on, so every
+     muted-on-hover case clears AA rather than the next one being found the same way. 0.52 is 4.7:1 there. */
+  --muted-foreground: oklch(0.52 0 0);
   --primary: oklch(0.205 0 0);
   --primary-hover: oklch(0.3 0 0);
   --primary-foreground: oklch(0.985 0 0);
```

---

### Incident Patch 3: `e1e944cb` (2026-10-02)
**Commit Message**: feat(ui): sync the React tree with nasiko-ui-lab main (43865af)

Brings ui/ from lab 1ed2914 up to lab main 43865af (the lab diff, applied
under ui/, so this branch's own edits stay):

- Shell: a waitlist call to action in the OSS app only (sidebar card, rail
  row, login line; VITE_NASIKO_WAITLIST_URL), none in EE.
- Settings: Chat context page.
- Agents: agent flags; Sessions rows follow the list's width.
- TokenOps: token optimisation preview section.
- Budgets: an edition may raise its own limits in <app>/budgets.json; EE's
  shell JS is at 205 KB gzip (it reached 200.0 KB) until it is trimmed.

Kept from this branch: the public-safe edition wording in DESIGN.md,
index.css and mocks/handlers.ts. Lab-only files (CLAUDE.md, TODOS) stay out.

check-secret-patterns.sh and test-sync-offline.sh pass; ui npm test,
build and budgets pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
[synced-from-private]

**File**: `ui/.env.example` (modified, +5/-0)
```diff
@@ -31,6 +31,11 @@ NASIKO_API_URL=http://localhost:8080
 # Default: http://localhost:8080 in dev, the page's own origin in production builds.
 VITE_NASIKO_LEGACY_UI_URL=
 
+# The Nasiko waitlist page the OSS app links to (the sidebar's Early access card and the
+# login page's "Join the waitlist"); ?ref=oss-app is added. Must be an absolute http(s) URL;
+# anything else hides the links. Default: https://nasiko-waitlist.vercel.app (dev servers and builds).
+VITE_NASIKO_WAITLIST_URL=
+
 # `npm run seed:live` finds the infra docker-compose file at ../nasiko-cloud-rs (read only;
 # the repo is never modified). npm scripts don't read this file: to use another checkout,
 # export NASIKO_CLOUD_RS=/path/to/nasiko-cloud-rs in your shell first.
```

**File**: `ui/DESIGN.md` (modified, +2/-0)
```diff
@@ -117,6 +117,7 @@ Presets in `common/src/lib/motion.ts`; new motion uses the names, never raw numb
 | `--animate-beam` / `--animate-stage` | 4 s linear loop | the onboarding Welcome step's flow and the router's "How routing works": a beam crosses the stages and each icon lights as it passes (CSS); still under reduced motion, the first stage lit |
 | `--animate-mark-draw` | 1.6 s ease-in-out, alternating | the page loader (`PageLoader`, our take on Aceternity's LoaderThree): each bar of the Nasiko mark draws its outline, then fills, 40 ms apart (CSS); reduced motion shows the filled mark, still |
 | `--animate-float` | 7 s ease-in-out loop | the login showcase's layer stack bobs 8 px (CSS); still under reduced motion |
+| `--animate-orbit` / `--animate-flag-wave` | 3 s linear / 1.4 s ease-in-out loops | the sidebar's waitlist badge (`WaitlistCta`, our take on Aceternity's Moving Border): a glint circles the pill's edge and the flag's cloth waves (CSS); under reduced motion the glint is hidden and the flag still |
 
 `tw-animate-css` provides the `animate-in` / `slide-in-*` / `fade-*` utilities; a build test checks they are emitted.
 
@@ -131,6 +132,7 @@ Presets in `common/src/lib/motion.ts`; new motion uses the names, never raw numb
 | Active item | `--accent` tint fill, `--accent-foreground` label, medium weight, 6 px radius, `aria-current="page"`; hover on other rows is `--muted`, never the tint |
 | Drill-in panel | a page with its own nav (Chat's history, Settings' sections) renders `SidebarPanel`: in the expanded sidebar and the phone sheet it replaces the nav groups under a row reading "Back" (its name and tooltip say where: "Back to TokenOps"): it returns to the last page visited outside the module (with its search; moves inside Chat or Settings don't count; repeated Backs keep going back, like history), or, when the page was opened directly ("Back to main menu"), shows the app nav until the next navigation; the collapsed rail keeps the nav icons and the page shows its own fallback beside it (Chat's rail column or sheet, Settings' section column). Never two sidebars side by side at full width |
 | Footer | status (health + MOCK DATA / LIVE, links to Status at `/status`; dev servers and mock builds only), account (Theme submenu: Mode and Theme radios; Settings; Sign out) |
+| Waitlist (OSS only) | above the footer, linking to the waitlist page (`env.waitlistUrl`): a `--card` card (8 px radius, hairline) with an "Early access" pill on its top edge (`--primary` fill, mono 10 px caps, a waving flag, a glint circling its edge: `--animate-orbit` / `--animate-flag-wave`), a title, one muted line and a full-width outline "Join the waitlist" that opens a new tab; in the rail one ticket-icon row with a tooltip. Not shown while a page's panel holds the sidebar (Chat, Settings), so Chat's dot background stays its one effect; no dismiss. The login page has the plain line "New to Nasiko? Join the waitlist" under Sign in |
 | State | shadcn's `sidebar_state` cookie; first visit opens at ≥ 1280 px, on every page |
 
 Add a nav item in `common/src/app/shell/nav.ts` (label, icon, route, group, `shared`, `also`) once its page exists.
```

**File**: `ui/common/src/app/shell/AppSidebar.tsx` (modified, +4/-0)
```diff
@@ -75,6 +75,7 @@ import {
   type Theme,
 } from './theme'
 import { SidebarPanelContext } from './panelSlot'
+import { WaitlistCard } from './WaitlistCta'
 
 /** How long a pending health check stays quiet before "Checking…" shows (design review 2A). */
 const CHECKING_DELAY_MS = 1_000
@@ -196,6 +197,9 @@ export function AppSidebar({
           className="flex min-h-0 flex-1 flex-col"
         />
       ) : null}
+      {/* Not while a page's panel holds the sidebar: Chat's history and Settings' sections keep the room, and Chat's dot
+          background stays its page's one effect (CLAUDE.md, Aceternity effects). */}
+      {holds ? null : <WaitlistCard />}
       <SidebarFooter className={cn(GROUP, 'gap-0 border-t border-sidebar-border py-2')}>
         <SidebarMenu>
           {SHOW_STATUS ? <StatusRow /> : null}
```

**File**: `ui/common/src/app/shell/WaitlistCta.test.tsx` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+/** The OSS waitlist links (WaitlistCta.tsx): the sidebar card, its rail row and the login line. */
+import { screen, within } from '@testing-library/react'
+import { afterEach, beforeEach, describe, expect, it } from 'vitest'
+import { env } from '@/lib/env'
+import { setupPinnedSeed } from '@/test/pinnedSeed'
+import { renderApp } from '@/test/renderApp'
+import { copy } from './copy'
+
+setupPinnedSeed()
+
+const sidebar = () => document.querySelector<HTMLElement>('[data-slot="sidebar"]')!
+const cardLink = { name: `${copy.waitlist.cta} ${copy.waitlist.newTab}` }
+const railLink = { name: `${copy.waitlist.title} ${copy.waitlist.newTab}` }
+const wide = () => Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
+const clearCookie = () => {
+  document.cookie = 'sidebar_state=; path=/; max-age=0'
+}
+
+const originalWidth = window.innerWidth
+beforeEach(() => clearCookie())
+afterEach(() => {
+  clearCookie()
+  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
+})
+
+describe('waitlist', () => {
+  it('links to the Nasiko waitlist page, tagged ref=oss-app', () => {
+    expect(env.waitlistUrl).toBe('https://nasiko-waitlist.vercel.app/?ref=oss-app')
+  })
+
+  it('shows the Early access card in the expanded sidebar, opening the waitlist in a new tab', async () => {
+    wide()
+    renderApp('/')
+    await screen.findByRole('navigation', { name: 'Main' })
+    const link = within(sidebar()).getByRole('link', cardLink)
+    expect(link).toHaveAttribute('href', env.waitlistUrl)
+    expect(link).toHaveAttribute('target', '_blank')
+    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
+    expect(within(sidebar()).getByText(copy.waitlist.badge)).toBeInTheDocument()
+    expect(within(sidebar()).getByText(copy.waitlist.title)).toBeInTheDocument()
+    // Outside the nav landmark: it isn't a page of the app.
+    expect(
+      within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', cardLink),
+    ).toBeNull()
+  })
+
+  it('keeps a ticket row for the collapsed rail, named for screen readers', async () => {
+    renderApp('/agents')
+    await screen.findByRole('navigation', { name: 'Main' })
+    expect(sidebar()).toHaveAttribute('data-state', 'collapsed')
+    expect(within(sidebar()).getByRole('link', railLink)).toHaveAttribute('href', env.waitlistUrl)
+  })
+
+  it('gives way to a page panel in the sidebar (Settings sections)', async () => {
+    wide()
+    renderApp('/settings')
+    await screen.findByRole('navigation', { name: 'Settings sections' })
+    expect(within(sidebar()).queryByRole('link', cardLink)).toBeNull()
+    expect(within(sidebar()).queryByRole('link', railLink)).toBeNull()
+  })
+
+  it('adds one quiet line under Sign in', async () => {
+    renderApp('/login')
+    await screen.findByRole('heading', { name: 'Sign in to Nasiko' })
+    const link = screen.getByRole('link', cardLink)
+    expect(link).toHaveAttribute('href', env.waitlistUrl)
+    expect(link).toHaveAttribute('target', '_blank')
+    expect(link.closest('p')).toHaveTextContent(`${copy.waitlist.loginLead} ${copy.waitlist.cta}`)
+  })
+})
```

**File**: `ui/common/src/app/shell/WaitlistCta.tsx` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+/**
+ * The OSS app's ways onto the Nasiko waitlist: the early-access card at the foot of the sidebar (a ticket-icon row in
+ * the rail) and the login page's line under Sign in. Shown only in the OSS edition and only when
+ * the waitlist URL is valid (`env.waitlistUrl`, tagged `ref=oss-app`); every link opens a new tab and
+ * carries nothing about the user.
+ */
+import { ExternalLink, Ticket } from 'lucide-react'
+import { useEdition } from '@/app/edition-context'
+import { Button } from '@/components/ui/button'
+import {
+  SidebarGroup,
+  SidebarMenu,
+  SidebarMenuButton,
+  SidebarMenuItem,
+} from '@/components/ui/sidebar'
+import { env } from '@/lib/env'
+import { cn } from '@/lib/utils'
+import { copy } from './copy'
+import { GROUP, ROW } from './rowStyles'
+
+/** The waitlist page, or null where the edition or the build shows none. */
+function useWaitlistUrl(): string | null {
+  return useEdition() === 'oss' ? env.waitlistUrl : null
+}
+
+/** The sidebar's card (expanded sidebar and phone sheet) and its rail row (collapsed). */
+export function WaitlistCard() {
+  const url = useWaitlistUrl()
+  if (!url) return null
+  return (
+    <SidebarGroup className={cn(GROUP, 'py-2')}>
+      {/* Hidden, not unmounted, in the rail, so a collapse never restarts the badge's loop. */}
+      <div className="relative mt-2.5 flex flex-col gap-1.5 rounded-lg border bg-card p-3 pt-4.5 group-data-[collapsible=icon]:hidden">
+        <EarlyAccessBadge />
+        <p className="text-sm leading-snug font-semibold">{copy.waitlist.title}</p>
+        <p className="text-xs leading-normal text-muted-foreground">{copy.waitlist.line}</p>
+        <Button asChild variant="outline" size="sm" className="mt-1.5 w-full">
+          <a href={url} target="_blank" rel="noopener noreferrer">
+            {copy.waitlist.cta}
+            <ExternalLink aria-hidden className="size-3.5" />
+            {/* The space outside the span: an accessible name joins inline children without one. */}{' '}
+            <span className="sr-only">{copy.waitlist.newTab}</span>
+          </a>
+        </Button>
+      </div>
+      <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
+        <SidebarMenuItem>
+          <SidebarMenuButton
+            asChild
+            tooltip={copy.waitlist.title}
+            className={cn(ROW, 'border-sidebar-border bg-card')}
+          >
+            <a
+              href={url}
+              target="_blank"
+              rel="noopener noreferrer"
+              aria-label={`${copy.waitlist.title} ${copy.waitlist.newTab}`}
+            >
+              <Ticket aria-hidden />
+            </a>
+          </SidebarMenuButton>
+        </SidebarMenuItem>
+      </SidebarMenu>
+    </SidebarGroup>
+  )
+}
+
+/**
+ * "Early access" on the card's top edge: our take on Aceternity's Moving Border (CSS, `--animate-orbit`), a glint
+ * circling the pill's 1 px edge, with the flag's cloth waving (`--animate-flag-wave`). The motion is decorative
+ * (aria-hidden, no pointer events); under reduced motion the glint is hidden and the flag still.
+ */
+function EarlyAccessBadge() {
+  return (
+    <span className="absolute -top-2.75 left-2.5 flex h-5.5 overflow-hidden rounded-full bg-muted-foreground/50 p-px ring-3 ring-sidebar">
+      <span
+        aria-hidden
+        className="pointer-events-none absolute top-1/2 left-1/2 size-45 -translate-1/2 animate-orbit bg-[conic-gradient(from_0deg,transparent_0deg_260deg,var(--muted-foreground)_310deg,var(--primary-foreground)_340deg,transparent_360deg)] motion-reduce:hidden"
+      />
+      <span className="relative flex items-center gap-1.25 rounded-full bg-primary pr-2 pl-1.5 font-mono text-3xs font-medium tracking-[0.06em] text-primary-foreground uppercase">
+        <svg
+          viewBox="0 0 24 24"
+          fill="none"
+          stroke="currentColor"
+          strokeWidth={2}
+          strokeLinecap="round"
+          strokeLinejoin="round"
+          aria-hidden
+          className="size-3"
+        >
+          <path d="M4 22V3" />
+          <path
+            d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
+            className="origin-left animate-flag-wave [transform-box:fill-box] motion-reduce:animate-none"
+          />
+        </svg>
+        {copy.waitlist.badge}
+      </span>
+    </span>
+  )
+}
+
+/** The login page's quiet line under Sign in. */
+export function WaitlistLoginLink() {
+  const url = useWaitlistUrl()
+  if (!url) return null
+  return (
+    <p className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
+      {copy.waitlist.loginLead}{' '}
+      <a
+        href={url}
+        target="_blank"
+        rel="noopener noreferrer"
+        className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
+      >
+        {copy.waitlist.cta} <span className="sr-only">{copy.waitlist.newTab}</span>
+      </a>
+    </p>
+  )
+}
```

**File**: `ui/common/src/app/shell/context.test.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ describe('URL contract', () => {
     expect(traceSearchSchema.parse({ span: 'ABCdef0123' }).span).toBe('ABCdef0123')
 
     expect(tokenopsSearchSchema.parse({ open: 'all' }).open).toBe(
-      'spend,drivers,perf,month,metrics',
+      'spend,optimise,drivers,perf,month,metrics',
     )
     expect(tokenopsSearchSchema.parse({ open: 'metrics, junk,spend' }).open).toBe('spend,metrics')
     expect(tokenopsSearchSchema.parse({ open: 'junk' }).open).toBeUndefined()
```

**File**: `ui/common/src/app/shell/copy.ts` (modified, +9/-0)
```diff
@@ -71,6 +71,15 @@ export const copy = {
     plum: 'Plum',
     carbon: 'Carbon',
   },
+  // The early-access card at the foot of the sidebar, its rail button and the login line (OSS only; WaitlistCta.tsx).
+  waitlist: {
+    badge: 'Early access',
+    title: 'Join the Nasiko waitlist',
+    line: 'Get managed OpenRuntime early, with help from the team.',
+    cta: 'Join the waitlist',
+    newTab: '(opens in a new tab)',
+    loginLead: 'New to Nasiko?',
+  },
   account: {
     menu: (name: string) => `Account: ${name}`,
     unavailable: 'Account unavailable',
```

**File**: `ui/common/src/features/agents/AgentDetailPage.test.tsx` (modified, +42/-1)
```diff
@@ -15,7 +15,7 @@ import { configureMocks } from '@/mocks/handlers'
 import { ADMIN_ID } from '@/mocks/seed-harness'
 import { now, seed, setupPinnedSeed } from '@/test/pinnedSeed'
 import { renderApp } from '@/test/renderApp'
-import { recordRequests, server } from '@/test/setup'
+import { recordRequestBodies, recordRequests, server } from '@/test/setup'
 import { copy } from './copy'
 
 setupPinnedSeed()
@@ -293,6 +293,47 @@ describe('settings', () => {
     expect(within(section).queryByText(/next time the agent is deployed/)).toBeNull()
   })
 
+  it('feature switches save at once; coding behaviour shows only for a code-work card', async () => {
+    const rec = recordRequestBodies()
+    renderApp(url(1, 'settings'))
+    const features = await screen.findByRole('region', { name: 'Features' })
+    expect(screen.getByRole('region', { name: 'Token optimization' })).toBeInTheDocument()
+    expect(screen.queryByRole('region', { name: 'Coding agent behavior' })).toBeNull()
+    const prompt = within(features).getByRole('switch', { name: 'Prompt comments' })
+    expect(prompt).not.toBeChecked()
+    await userEvent.click(prompt)
+    await waitFor(() => expect(prompt).toBeChecked())
+    await rec.flush()
+    rec.stop()
+    // The PUT replaces the metadata column, so it carries the whole bag, not just the flag.
+    const put = rec.requests.find((r) => r.method === 'PUT')
+    expect(put?.body).toEqual({ metadata: { features: { prompt_comments: 'enabled' } } })
+  })
+
+  it('self-review is a child of minimal-code mode: off and locked until its parent is on', async () => {
+    renderApp(url(2, 'settings'))
+    const section = await screen.findByRole('region', { name: 'Coding agent behavior' })
+    const minimal = within(section).getByRole('switch', { name: 'Minimal-code mode' })
+    const review = within(section).getByRole('switch', { name: 'Self-review' })
+    expect(minimal).not.toBeChecked()
+    expect(review).not.toBeChecked()
+    expect(review).toBeDisabled()
+    await userEvent.click(minimal)
+    // Unset means on (nasiko-coding-policy `self_review_enabled`), so it reads on once the parent is.
+    await waitFor(() => expect(review).toBeEnabled())
+    expect(review).toBeChecked()
+    await userEvent.click(review)
+    await waitFor(() => expect(review).not.toBeChecked())
+    expect(await screen.findByText('CODING_AGENT_SELF_REVIEW')).toBeInTheDocument()
+    await waitFor(() => expect(review).toBeEnabled())
+    await userEvent.click(review)
+    await waitFor(() => expect(screen.queryByText('CODING_AGENT_SELF_REVIEW')).toBeNull())
+    expect(review).toBeChecked()
+    await userEvent.click(minimal)
+    await waitFor(() => expect(review).toBeDisabled())
+    expect(review).not.toBeChecked()
+  })
+
   it('a secret value is cleared on submit and only the name is listed', async () => {
     renderApp(url(1, 'settings'))
     const name = await screen.findByRole('textbox', { name: 'Name' })
```

---

### Incident Patch 4: `8f26a3bc` (2026-10-02)
**Commit Message**: Merge pull request #536 from Nasiko-Labs/feat/react-ui-replacement

feat(ui): sync the React tree with nasiko-ui-lab main (1ed2914)
[synced-from-private]



---

### Incident Patch 5: `c68b1e24` (2026-10-02)
**Commit Message**: feat(ui): sync the React tree with nasiko-ui-lab main (1ed2914)

Brings ui/ from lab 0fc9095 up to lab main 1ed2914 (the lab diff, applied
under ui/, so this branch's own edits stay):

- LLM router: custom providers get the Endpoint type again (OpenAI-compatible,
  Azure OpenAI with its api-version, AWS Bedrock), sent as `kind` /
  `api_version` on create and test and locked on edit, as
  oss/server/src/llm_router/custom_providers.rs expects. Create drops
  `default_model`, so a PATCH sets it after the create.
- Overview: first-run layout with one next action and a preview.
- TokenOps: setup steps inside the empty-state card.

Kept from this branch: the public-safe edition wording in mocks/handlers.ts.
Lab-only files (CLAUDE.md, .impeccable) stay out.

check-secret-patterns.sh and test-sync-offline.sh pass; ui npm test,
build and budgets pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
[synced-from-private]

**File**: `ui/common/src/features/onboarding/GuideCard.tsx` (modified, +29/-15)
```diff
@@ -40,36 +40,50 @@ const ROWS = [
 
 export function GuideSteps({ buttonClassName }: { buttonClassName?: string }) {
   const t = useTicks()
+  // "Resume" only once a step is done: before that there is nothing to resume.
+  const started = t.role || t.model || t.agent
   return (
     <div className="flex flex-col gap-3">
       <p className="text-sm text-muted-foreground">{copy.card.intro}</p>
-      <ul className="flex flex-col gap-2">
+      {/* Each row opens the guide at its own step; the button below opens it at the first one not done. */}
+      <ul className="-mx-2 flex max-w-xl flex-col">
         {ROWS.map(([id, s]) => (
-          <li key={id} className="flex items-center gap-3 text-sm">
-            <span
+          <li key={id}>
+            <Button
+              variant="ghost"
               className={cn(
-                'flex size-5 shrink-0 items-center justify-center rounded-full',
-                t[id] ? 'bg-primary text-primary-foreground' : 'border',
+                'h-auto w-full justify-start gap-3 px-2 py-1 text-left font-normal whitespace-normal',
+                buttonClassName,
               )}
+              onClick={() => openGuide(id)}
             >
-              {t[id] ? <Check aria-hidden className="size-3" /> : null}
-            </span>
-            <span className="flex-1">
-              <span className="font-medium">{s.title}</span>{' '}
-              <span className="text-muted-foreground">· {s.sub}</span>
-            </span>
-            <span className="text-xs text-muted-foreground">
-              {t[id] ? copy.card.done : copy.card.todo}
-            </span>
+              <span
+                aria-hidden
+                className={cn(
+                  'flex size-5 shrink-0 items-center justify-center rounded-full',
+                  t[id] ? 'bg-primary text-primary-foreground' : 'border',
+                )}
+              >
+                {t[id] ? <Check className="size-3" /> : null}
+              </span>
+              <span className="flex-1">
+                <span className="font-medium">{s.title}</span>{' '}
+                <span className="text-muted-foreground">· {s.sub}</span>
+              </span>
+              <span className="text-xs text-muted-foreground">
+                {t[id] ? copy.card.done : copy.card.todo}
+              </span>
+            </Button>
           </li>
         ))}
       </ul>
       <Button
+        variant="outline"
         size="sm"
         className={cn('self-start', buttonClassName)}
         onClick={() => openGuide(firstOpenStep(t))}
       >
-        {copy.card.resume}
+        {started ? copy.card.resume : copy.card.start}
       </Button>
     </div>
   )
```

**File**: `ui/common/src/features/onboarding/OnboardingDialog.test.tsx` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ describe('first-run guide', () => {
     await user.click(screen.getByRole('radio', { name: /developer/i }))
     await user.click(screen.getByRole('button', { name: /continue/i }))
     await user.click(await screen.findByRole('button', { name: 'Skip this step' }))
-    await screen.findByRole('heading', { name: 'Bring your first agent' })
+    await screen.findByRole('heading', { name: 'Deploy your first agent' })
     await user.click(screen.getByRole('tab', { name: 'Registry' }))
     await user.type(
       await screen.findByRole('textbox', { name: deployCopy.registry.reference }),
```

**File**: `ui/common/src/features/onboarding/copy.ts` (modified, +3/-2)
```diff
@@ -27,7 +27,7 @@ export const copy = {
     welcome: { title: 'Welcome', sub: 'How OpenRuntime works' },
     role: { title: 'Your role', sub: 'Tailor the guide' },
     model: { title: 'Connect a model', sub: 'Provider and keys' },
-    agent: { title: 'Bring an agent', sub: 'Zip, GitHub or registry' },
+    agent: { title: 'Deploy an agent', sub: 'Zip, GitHub or registry' },
     ready: { title: 'Ready', sub: 'Start exploring' },
   } satisfies Record<StepId, { title: string; sub: string }>,
   welcome: {
@@ -102,7 +102,7 @@ export const copy = {
     saveFailed: (reason: string) => `Couldn't connect: ${reason}`,
   },
   agent: {
-    title: 'Bring your first agent',
+    title: 'Deploy your first agent',
     intro: 'Every agent goes through the same lifecycle, whichever way it arrives.',
     upload: 'Upload a zip',
     github: 'GitHub',
@@ -131,6 +131,7 @@ export const copy = {
   card: {
     title: 'Setup guide',
     intro: 'Finish setting up your workspace. Every step is optional.',
+    start: 'Start guide',
     resume: 'Resume guide',
     done: 'Done',
     todo: 'Not yet',
```

**File**: `ui/common/src/features/overview/OverviewPage.test.tsx` (modified, +50/-2)
```diff
@@ -12,6 +12,7 @@ import { configureChatMock } from '@/mocks/chatStore'
 import { now, seed, setupPinnedSeed } from '@/test/pinnedSeed'
 import { renderApp } from '@/test/renderApp'
 import { recordRequests, server } from '@/test/setup'
+import { copy as deployCopy } from '@/features/deploy/copy'
 import { copy } from './copy'
 
 setupPinnedSeed()
@@ -193,13 +194,60 @@ describe('first run (design 7A)', () => {
     renderApp('/')
     const guideCard = await screen.findByTestId('overview-setup-guide')
     expect(document.querySelector('[data-testid="overview-first-run"]')).toBeNull()
-    // The seed user picked a role and has router configs, but no agents yet: the guide resumes at Bring an agent.
+    // One next action: Deploy beside the headline; the header's Setup guide and Quick actions' Deploy step aside.
+    expect(screen.getAllByRole('link', { name: deployCopy.entry.label })).toHaveLength(1)
+    expect(screen.queryByRole('button', { name: copy.setup.button })).toBeNull()
+    expect(within(card('overview-actions')).queryByRole('button', { name: /Copy/ })).toBeNull()
+    // The seed user picked a role and has router configs, but no agents yet: the guide resumes at Deploy an agent.
     await user.click(within(guideCard).getByRole('button', { name: 'Resume guide' }))
     expect(
-      await screen.findByRole('heading', { name: 'Bring your first agent' }),
+      await screen.findByRole('heading', { name: 'Deploy your first agent' }),
     ).toBeInTheDocument()
   })
 
+  it('opens the CLI path with every command, and each guide row at its own step', async () => {
+    server.use(http.get('*/api/agents', () => HttpResponse.json([])))
+    const user = userEvent.setup()
+    renderApp('/')
+    const guideCard = await screen.findByTestId('overview-setup-guide')
+    // The deploy command alone fails before `nasiko connect` and `nasiko new`, so the CLI shows all three.
+    await user.click(screen.getByRole('button', { name: copy.firstRun.cli(3) }))
+    expect(await screen.findByText(/^nasiko connect /)).toBeInTheDocument()
+    expect(screen.getByText('nasiko deploy ./my-agent')).toBeInTheDocument()
+    await user.click(within(guideCard).getByRole('button', { name: /^Connect a model/ }))
+    expect(
+      await screen.findByRole('heading', { name: 'Connect a model provider' }),
+    ).toBeInTheDocument()
+  })
+
+  it('says Start guide until a step is done', async () => {
+    server.use(http.get('*/api/agents', () => HttpResponse.json([])))
+    configureMocks({ onboarding: { persona: null, completed: true } })
+    server.use(http.get('*/api/llm-configs', () => HttpResponse.json({ data: [] })))
+    renderApp('/')
+    const guideCard = await screen.findByTestId('overview-setup-guide')
+    expect(
+      await within(guideCard).findByRole('button', { name: 'Start guide' }),
+    ).toBeInTheDocument()
+  })
+
+  it('previews the lead cards without numbers and keeps Harnesses to one line', async () => {
+    server.use(http.get('*/api/agents', () => HttpResponse.json([])))
+    renderApp('/')
+    const preview = await screen.findByTestId('overview-preview')
+    expect(
+      within(preview)
+        .getAllByRole('heading', { level: 3 })
+        .map((h) => h.textContent),
+    ).toEqual([copy.needs.title, copy.spend.title, copy.health.title])
+    // Honest numbers: nothing has run, so the preview states none.
+    expect(preview.textContent).not.toMatch(/\d/)
+    const line = card('overview-harnesses')
+    await within(line).findByText(/coding harness/)
+    expect(within(line).getByRole('link')).toHaveAttribute('href', '/harnesses')
+    expect(within(line).queryByText(copy.kpi.connected)).toBeNull()
+  })
+
   it('opens the guide from the header Setup guide', async () => {
     const user = userEvent.setup()
     renderApp('/')
```

**File**: `ui/common/src/features/overview/OverviewPage.tsx` (modified, +25/-10)
```diff
@@ -33,9 +33,9 @@ import { useReturnTick } from '@/lib/useReturnTick'
 import { useFleetHealth, useHarnessSummary, useNeedsYou, useSpend } from './api'
 // Budgets hidden: no server support for /api/budgets yet (R-L10). Restore when it lands.
 // import { Budget } from './components/Budget'
-import { FirstRun } from './components/FirstRun'
+import { FirstRun, FirstRunLead, FirstRunPreview } from './components/FirstRun'
 import { FleetHealth } from './components/FleetHealth'
-import { Harnesses } from './components/Harnesses'
+import { Harnesses, HarnessesLine } from './components/Harnesses'
 import { Headline } from './components/Headline'
 import { AgentsTile, RunsTile, SpendTile } from './components/Kpis'
 import { MonthBar } from './components/MonthBar'
@@ -68,7 +68,16 @@ function Frame({
   )
 }
 
-function HeaderActions({ search, setSearch }: { search: OverviewSearch; setSearch: SetSearch }) {
+function HeaderActions({
+  search,
+  setSearch,
+  setup,
+}: {
+  search: OverviewSearch
+  setSearch: SetSearch
+  /** False on first run: the Setup guide (or deploy) card is on the page already. */
+  setup: boolean
+}) {
   return (
     <>
       <ToggleGroup
@@ -93,11 +102,14 @@ function HeaderActions({ search, setSearch }: { search: OverviewSearch; setSearc
           </ToggleGroupItem>
         ))}
       </ToggleGroup>
-      <SetupGuide />
+      {setup ? <SetupGuide /> : null}
     </>
   )
 }
 
+/** A first-run row that spans the grid at every width. */
+const FULL_ROW = '@[700px]/overview:col-span-2 @[1100px]/overview:col-span-3'
+
 /**
  * Where each card sits from 1100 px (4 columns) and from 700 px (2), with and without budgets. Literal class names, so
  * Tailwind sees them.
@@ -233,7 +245,7 @@ function Overview({
   const grid =
     'grid grid-cols-1 items-stretch gap-3 @[700px]/overview:grid-cols-2 @[1100px]/overview:grid-cols-3'
   const description = copy.greeting(now.getHours(), me.username, days)
-  const actions = <HeaderActions search={search} setSearch={setSearch} />
+  const actions = <HeaderActions search={search} setSearch={setSearch} setup={!firstRun} />
   // One page loader until the first paint's reads settle (data or error: a failed read renders its card's error), in
   // place of every card's skeleton. Latched: a later range change or return tick keeps the cards' own loading states.
   // Needs you's rating and session checks aren't waited for: its card shows them loading (a fan-out can be slow).
@@ -257,13 +269,16 @@ function Overview({
   if (firstRun) {
     return (
       <Frame description={description} actions={actions}>
-        <p className="max-w-3xl text-lg text-pretty" data-testid="overview-headline">
-          {copy.firstRun.headline}
-        </p>
+        <FirstRunLead />
         <div className={grid}>
+          {/* From 1100 px Quick actions and Harnesses' one line stack beside the first-run card, so neither stretches
+              to its height; below that each spans the grid. The preview of later cards sits apart, after a wider gap. */}
           <FirstRun />
-          <QuickActions />
-          <Harnesses data={harnesses} days={days} />
+          <div className="contents @[1100px]/overview:flex @[1100px]/overview:flex-col @[1100px]/overview:gap-3">
+            <QuickActions firstRun className={`${FULL_ROW} @[1100px]/overview:flex-1`} />
+            <HarnessesLine data={harnesses} days={days} className={FULL_ROW} />
+          </div>
+          <FirstRunPreview className={`${FULL_ROW} mt-3`} />
         </div>
       </Frame>
     )
```

**File**: `ui/common/src/features/overview/components.coverage.test.tsx` (modified, +28/-1)
```diff
@@ -20,7 +20,7 @@ import type {
   Spend as SpendData,
 } from './api'
 import { Budget } from './components/Budget'
-import { Harnesses } from './components/Harnesses'
+import { Harnesses, HarnessesLine } from './components/Harnesses'
 import { Headline } from './components/Headline'
 import { NeedsYou } from './components/NeedsYou'
 import { MonthBar } from './components/MonthBar'
@@ -455,4 +455,31 @@ describe('Harnesses', () => {
     const rows = screen.getAllByRole('listitem')
     expect(rows[1]).toHaveTextContent(`mystery${copy.harnesses.unpriced}`)
   })
+  it('keeps the first run line to one sentence per state, with only priced cost', async () => {
+    const { unmount } = renderInRouter(<HarnessesLine data={data({})} days={30} />)
+    const line = await screen.findByTestId('overview-harnesses')
+    expect(line).toHaveTextContent(`${copy.harnesses.noneYet}·${copy.harnesses.connect}.`)
+    unmount()
+    const second = renderInRouter(
+      <HarnessesLine
+        data={data({
+          connected: 2,
+          ownOnly: true,
+          harnesses: [
+            { id: 'claude-code', cost: 12, unpriced: false },
+            { id: 'mystery', cost: 3, unpriced: true },
+          ],
+        })}
+        days={30}
+      />,
+    )
+    expect(await screen.findByTestId('overview-harnesses')).toHaveTextContent(
+      `${copy.harnesses.connected(2)}(${copy.kpi.yourUsage})·${copy.harnesses.lineCost('$12.00', 30)}·${copy.harnesses.open}`,
+    )
+    second.unmount()
+    const retry = vi.fn()
+    renderInRouter(<HarnessesLine data={data({ error: new Error('x'), retry })} days={30} />)
+    await userEvent.click(await screen.findByRole('button', { name: copy.retry }))
+    expect(retry).toHaveBeenCalled()
+  })
 })
```

**File**: `ui/common/src/features/overview/components/FirstRun.tsx` (modified, +83/-3)
```diff
@@ -1,18 +1,66 @@
 /**
  * First run (design review 7A): no agents yet, so one full-width card with the Agents first-run commands (checked
  * against recorded CLI help) replaces the data cards, whose queries don't run. Deploy an agent comes first, the CLI steps
- * are the alternative (plans/feat-deploy.md §7).
+ * are the alternative (plans/feat-deploy.md §7). It spans two columns, so Quick actions sits beside it in the 3-column grid.
  */
 import { Link } from '@tanstack/react-router'
+import { ChevronRight } from 'lucide-react'
+import { useState } from 'react'
 import { Button } from '@/components/ui/button'
+import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
 import { FirstRunSteps } from '@/features/agents/components/bits'
+import { firstRunCommands } from '@/features/agents/format'
 import { DeployAgentButton } from '@/features/deploy/components/DeployAgentButton'
 import { copy as deployCopy } from '@/features/deploy/copy'
 import { useGuide } from '@/features/onboarding/api'
+import { cn } from '@/lib/utils'
 import { GuideSteps } from '@/features/onboarding/GuideCard'
 import { copy } from '../copy'
 import { Card, TOUCH } from './Card'
 
+/** How many commands the CLI path takes (connect, new, deploy). */
+const CLI_STEPS = firstRunCommands('').length
+
+/**
+ * The first-run headline and, with the guide's card below, the page's one primary action beside it: Deploy an agent,
+ * with the CLI as the alternative. The CLI opens to all its steps (connect, new, deploy): the deploy command alone
+ * fails on a machine that hasn't run the first two. On an older server the deploy card is that action, so the lead is
+ * text.
+ */
+export function FirstRunLead() {
+  const { absent } = useGuide()
+  const [cli, setCli] = useState(false)
+  return (
+    <div className="flex flex-col items-start gap-3">
+      <p className="max-w-3xl text-lg text-pretty" data-testid="overview-headline">
+        {copy.firstRun.headline}
+      </p>
+      {absent ? null : (
+        <Collapsible open={cli} onOpenChange={setCli} className="flex flex-col items-start gap-3">
+          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
+            <DeployAgentButton className={TOUCH} />
+            <CollapsibleTrigger asChild>
+              <Button variant="ghost" size="sm" className={`text-muted-foreground ${TOUCH}`}>
+                <ChevronRight
+                  aria-hidden
+                  className={cn(
+                    'transition-transform motion-reduce:transition-none',
+                    cli && 'rotate-90',
+                  )}
+                />
+                {copy.firstRun.cli(CLI_STEPS)}
+              </Button>
+            </CollapsibleTrigger>
+          </div>
+          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
+            <FirstRunSteps />
+          </CollapsibleContent>
+        </Collapsible>
+      )}
+    </div>
+  )
+}
+
 export function FirstRun() {
   // The onboarding guide covers deploying (its Bring an agent step), so the Setup guide card leads instead (spec §4);
   // servers without the endpoint keep the deploy card.
@@ -22,7 +70,7 @@ export function FirstRun() {
       <Card
         id="overview-setup-guide"
         title={copy.setup.button}
-        className="@[700px]:col-span-2 @[1100px]:col-span-3"
+        className="@[700px]/overview:col-span-2"
       >
         <GuideSteps buttonClassName={TOUCH} />
       </Card>
@@ -33,7 +81,7 @@ export function FirstRun() {
       title={copy.firstRun.title}
       to="/agents"
       linkLabel={copy.firstRun.link}
-      className="@[700px]:col-span-2 @[1100px]:col-span-3"
+      className="@[700px]/overview:col-span-2"
     >
       <DeployAgentButton size="default" className={TOUCH} />
       <p className="mt-4 mb-2 text-xs text-muted-foreground">{deployCopy.entry.orCli}</p>
@@ -47,3 +95,35 @@ export function FirstRun() {
     </Card>
   )
 }
+
+const PREVIEW = [
+  ['needs', copy.needs.title, copy.preview.needs],
+  ['spend', copy.spend.title, copy.preview.spend],
+  ['health', copy.health.title, copy.preview.health],
+] as const
+
+/**
+ * What the Overview's lead cards show once an agent runs, in their page order: a dashed frame (a place, not a card)
+ * with each card's name and one sentence. No numbers: the server has none yet (Honest numbers).
+ */
+export function FirstRunPreview({ className }: { className?: string }) {
+  return (
+    <section
+      aria-labelledby="overview-preview"
+      data-testid="overview-preview"
+      className={cn('rounded-lg border border-dashed p-4', className)}
+    >
+      <h2 id="overview-preview" className="text-sm font-semibold">
+        {copy.preview.title}
+      </h2>
+      <ul className="mt-3 grid gap-4 @[700px]/overview:grid-cols-3 @[700px]/overview:gap-6">
+        {PREVIEW.map(([id, title, text])
```

**File**: `ui/common/src/features/overview/components/Harnesses.tsx` (modified, +90/-2)
```diff
@@ -9,9 +9,11 @@ import { SquareTerminal } from 'lucide-react'
 import type { CSSProperties } from 'react'
 import { KpiTile } from '@/components/shared/kpi-tile'
 import { Button } from '@/components/ui/button'
+import { Card } from '@/components/ui/card'
 import { Skeleton } from '@/components/ui/skeleton'
 import { HARNESSES } from '@/features/harnesses/constants'
 import { fmtMoney, fmtPct } from '@/lib/format'
+import { cn } from '@/lib/utils'
 import type { HarnessSummary } from '../api'
 import { copy } from '../copy'
 import { SourceFailed, TOUCH } from './Card'
@@ -20,9 +22,95 @@ import { TILE, TileLabel } from './Kpis'
 const known = new Map<string, { name: string; color: string }>(HARNESSES.map((h) => [h.id, h]))
 const colorOf = (id: string) => known.get(id)?.color ?? 'var(--chart-other)'
 
-export function Harnesses({ data, days }: { data: HarnessSummary; days: number }) {
+function pricedOf(data: HarnessSummary) {
   const priced = data.harnesses.filter((h) => !h.unpriced && (h.cost ?? 0) > 0)
-  const total = priced.reduce((n, h) => n + (h.cost ?? 0), 0)
+  return { priced, total: priced.reduce((n, h) => n + (h.cost ?? 0), 0) }
+}
+
+const Dot = () => (
+  <span aria-hidden className="text-muted-foreground">
+    ·
+  </span>
+)
+
+/**
+ * The first run's Harnesses: one line instead of the KPI tile, so an empty fleet has no loud zero over empty space. The
+ * same summary and states as the tile; with harnesses connected (agents aren't needed for them) it keeps the count and
+ * the est. cost.
+ */
+export function HarnessesLine({
+  data,
+  days,
+  className,
+}: {
+  data: HarnessSummary
+  days: number
+  className?: string
+}) {
+  const { total } = pricedOf(data)
+  const link = (label: string) => (
+    // Underlined: inside a sentence a link can't be told from the text by colour (WCAG 1.4.1).
+    <Button
+      asChild
+      variant="link"
+      size="sm"
+      className={`h-6 px-0 text-sm underline underline-offset-4 ${TOUCH}`}
+    >
+      <Link to="/harnesses" search={{} as never}>
+        {label}
+      </Link>
+    </Button>
+  )
+  return (
+    <Card
+      asChild
+      className={cn(
+        'flex-row flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-sm',
+        className,
+      )}
+    >
+      <section aria-label={copy.harnesses.title} data-testid="overview-harnesses">
+        {/* A failed read brings its own warning icon. */}
+        {data.error ? null : (
+          <SquareTerminal aria-hidden className="size-4 shrink-0 text-muted-foreground" />
+        )}
+        {data.isPending ? (
+          <Skeleton className="h-4 w-56 motion-reduce:animate-none" />
+        ) : data.error ? (
+          <SourceFailed what={copy.harnesses.what} onRetry={data.retry} />
+        ) : data.notVisible ? (
+          <span className="text-muted-foreground">{copy.harnesses.notVisible}</span>
+        ) : !data.connected ? (
+          <>
+            <span>{copy.harnesses.noneYet}</span>
+            <Dot />
+            <span>{link(copy.harnesses.connect)}.</span>
+          </>
+        ) : (
+          <>
+            <span className="tabular-nums">{copy.harnesses.connected(data.connected)}</span>
+            {data.ownOnly ? (
+              <span className="text-muted-foreground">({copy.kpi.yourUsage})</span>
+            ) : null}
+            {total > 0 ? (
+              <>
+                <Dot />
+                <span className="text-muted-foreground tabular-nums">
+                  {copy.harnesses.lineCost(fmtMoney(total), days)}
+                </span>
+              </>
+            ) : null}
+            <Dot />
+            {link(copy.harnesses.open)}
+          </>
+        )}
+      </section>
+    </Card>
+  )
+}
+
+export function Harnesses({ data, days }: { data: HarnessSummary; days: number }) {
+  const { priced, total } = pricedOf(data)
   const share = (h: HarnessSummary['harnesses'][number]) =>
     total > 0 && !h.unpriced ? ((h.cost ?? 0) / total) * 100 : null
   return (
```

---

### Incident Patch 6: `25d2e2e1` (2026-10-02)
**Commit Message**: fix(oss/server): agent upload and rate limits for finops
[synced-from-private]

**File**: `server/src/agents/mod.rs` (modified, +79/-0)
```diff
@@ -61,14 +61,47 @@ pub(crate) const DEFAULT_AGENT_PORT: u16 = 8000;
 /// after the host and 404s at the Axum router level before any auth/handler
 /// logic runs (found live: BuildKit push to `.../v2/translator/blobs/uploads/`
 /// failed with a plain 404, not a 401/403).
+///
+/// The name segment goes through [`image_name_slug`]: an agent name is a
+/// display string that may legally carry uppercase or spaces, neither of which
+/// an OCI repository name admits.
 pub(crate) fn build_image_tag(registry: &str, name: &str, tag: &str) -> String {
+    let name = image_name_slug(name);
     if registry.is_empty() {
         format!("nasiko/{name}:{tag}")
     } else {
         format!("{registry}/nasiko/{name}:{tag}")
     }
 }
 
+/// Lowercase a display name into an OCI-safe repository component.
+///
+/// An OCI repository name is `[a-z0-9]+([._-][a-z0-9]+)*` — no uppercase, no
+/// spaces — but an agent name is validated against the *tag* charset
+/// (`build::routes::validate_version_tag`), which permits both. An agent named
+/// "General-Assistant" therefore reached the builder as
+/// `nasiko/General-Assistant:1.0.0`, and docker rejected it ("repository name
+/// must be lowercase") *after* the agent/build/job rows had already committed —
+/// leaving the agent behind with nothing but a failed build.
+///
+/// Idempotent, and registry publishers apply the same rule before pushing, so a
+/// name survives publish → import unchanged and a re-import updates the existing
+/// agent instead of registering a second one under a differently-cased name.
+pub(crate) fn image_name_slug(name: &str) -> String {
+    let slug: String = name
+        .to_lowercase()
+        .replace(' ', "-")
+        .chars()
+        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
+        .collect();
+    let slug = slug.trim_matches('-');
+    if slug.is_empty() {
+        "agent".to_string()
+    } else {
+        slug.to_string()
+    }
+}
+
 /// Mints (or reuses) a per-agent OCI pull credential and attaches it to
 /// `spec` — deterministic secret name always set so the Kubernetes runtime can
 /// wire `imagePullSecrets` on every deploy, with the one-time plaintext seed
@@ -456,4 +489,50 @@ mod spec_tests {
             "nasiko/my-agent:1.0.0"
         );
     }
+
+    #[test]
+    fn build_image_tag_slugifies_the_name_segment() {
+        // Found live on POST /api/agents/upload: an agent named
+        // "General-Assistant" produced `nasiko/General-Assistant:<ver>`, and the
+        // docker build failed with "repository name must be lowercase" only
+        // after the agent/build/job rows had committed.
+        assert_eq!(
+            build_image_tag("", "General-Assistant", "1.0.0"),
+            "nasiko/general-assistant:1.0.0"
+        );
+        assert_eq!(
+            build_image_tag("registry.example.com", "Infrastructure Manager", "1.0.0"),
+            "registry.example.com/nasiko/infrastructure-manager:1.0.0"
+        );
+    }
+
+    #[test]
+    fn image_name_slug_yields_oci_safe_repository_components() {
+        assert_eq!(
+            image_name_slug("Infrastructure Manager"),
+            "infrastructure-manager"
+        );
+        assert_eq!(
+            image_name_slug("infrastructure_manager"),
+            "infrastructure_manager"
+        );
+        assert_eq!(image_name_slug("Code Reviewer 2.0"), "code-reviewer-20");
+    }
+
+    #[test]
+    fn image_name_slug_never_yields_an_empty_name() {
+        // An empty repo component is as invalid a reference as a spaced one.
+        assert_eq!(image_name_slug("---"), "agent");
+        assert_eq!(image_name_slug(""), "agent");
+    }
+
+    #[test]
+    fn image_name_slug_is_idempotent() {
+        // Publish slugifies before pushing, and update/rollback re-derive the
+        // tag from the stored name — every re-application must land on the same
+        // repository, or a second build pushes a second image.
+        let published = "infrastructure-manager";
+        assert_eq!(image_name_slug("Infrastructure Manager"), published);
+        assert_eq!(image_name_slug(published), published);
+    }
 }
```

**File**: `server/src/catalog/import.rs` (modified, +17/-41)
```diff
@@ -76,7 +76,12 @@ pub(crate) fn agent_metadata_from_card(card: &serde_json::Value) -> AgentMetadat
         // import 500'd after the agent row had already committed. Matches the
         // slug rule registry publishers apply, so a round-trip through the
         // registry keeps one stable name.
-        name: slugify(card.get("name").and_then(|v| v.as_str()).unwrap_or("agent")),
+        name: crate::agents::image_name_slug(
+            card.get("name").and_then(|v| v.as_str()).unwrap_or("agent"),
+        ),
+        // (`build_image_tag` slugifies the image reference's own name segment
+        // too; the catalog row is slugified here so the stored name and the
+        // image it resolves to never drift apart.)
         // The human-readable original is preserved here for the UI.
         display_name: card.get("name").and_then(|v| v.as_str()).map(String::from),
         description: card
@@ -742,22 +747,6 @@ async fn effective_allowed_hosts(state: &AppState) -> Vec<String> {
     allowed
 }
 
-/// Lowercase a display name into an OCI-safe repository component.
-///
-/// Registry publishers apply the same rule before pushing, so a name survives
-/// publish → import unchanged and a re-import updates the existing agent
-/// instead of registering a second one under a differently-cased name.
-fn slugify(name: &str) -> String {
-    let s: String = name
-        .to_lowercase()
-        .replace(' ', "-")
-        .chars()
-        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
-        .collect();
-    let s = s.trim_matches('-').to_string();
-    if s.is_empty() { "agent".to_string() } else { s }
-}
-
 /// Split an OCI reference into `(repo_with_host, tag)`, defaulting the tag to
 /// `latest`.
 ///
@@ -1203,7 +1192,7 @@ pub(crate) async fn import_registry(
 mod tests {
     use super::{
         BUILTIN_ALLOWED_REGISTRY_HOSTS, agent_card_from_manifest, agent_metadata_from_card,
-        find_owned_agent, read_agent_card, registry_url_host, slugify, split_reference_tag,
+        find_owned_agent, read_agent_card, registry_url_host, split_reference_tag,
         validate_registry_host,
     };
 
@@ -1452,30 +1441,17 @@ mod tests {
     }
 
     // ─── Card name slugification ────────────────────────────────────────────
+    // The rule itself is `agents::image_name_slug` and is tested there; this
+    // covers only that the card's name reaches the catalog row through it.
 
     #[test]
-    fn display_names_become_oci_safe_repository_components() {
-        // "Infrastructure Manager" previously reached build_image_tag verbatim,
-        // producing `nasiko/Infrastructure Manager:1.0.0` — an invalid reference
-        // that made docker fail *after* the agent row had committed.
-        assert_eq!(slugify("Infrastructure Manager"), "infrastructure-manager");
-        assert_eq!(slugify("infrastructure_manager"), "infrastructure_manager");
-        assert_eq!(slugify("Code Reviewer 2.0"), "code-reviewer-20");
-    }
-
-    #[test]
-    fn slugify_never_yields_an_empty_name() {
-        // An empty repo component is as invalid as a spaced one.
-        assert_eq!(slugify("---"), "agent");
-        assert_eq!(slugify(""), "agent");
-    }
-
-    #[test]
-    fn slugified_names_are_stable_across_a_publish_import_round_trip() {
-        // Publish slugifies before pushing; import must land on the same name,
-        // otherwise a re-import creates a second agent instead of updating one.
-        let published = "infrastructure-manager";
-        assert_eq!(slugify("Infrastructure Manager"), published);
-        assert_eq!(slugify(published), published);
+    fn card_display_name_lands_in_the_catalog_slugified() {
+        let meta = agent_metadata_from_card(&serde_json::json!({
+            "name": "Infrastructure Manager",
+            "version": "1.0.0",
+        }));
+        assert_eq!(meta.name, "infrastructure-manager");
+        // The human-readable original survives for the UI.
+        assert_eq!(meta.display_name.as_deref(), Some("Infrastructure Manager"));
     }
 }
```

**File**: `server/src/lib.rs` (modified, +1/-7)
```diff
@@ -265,12 +265,6 @@ where
     // costs two bcrypt cost-12 hashes. 10/min is generous for a human changing
     // their own password and still bounds the CPU burn from a scripted loop.
     let change_password_limiter = RateLimiter::new(10, Duration::from_secs(60));
-    // The FinOps dashboard/timeseries/calendar/attributions endpoints fan out
-    // several concurrent Tempo searches per request (bounded concurrency, but
-    // real load nonetheless) — a tighter, dedicated budget than the rest of
-    // the observability router (session/trace/span reads are cheap single
-    // lookups and shouldn't share it).
-    let finops_limiter = RateLimiter::new(20, Duration::from_secs(60));
     // Starting a MAF run is the single most expensive authenticated action in
     // the product: the executor makes 4 LLM calls minimum (plan, per-step
     // placeholder fill, per-step extraction, final synthesis) plus one agent
@@ -323,7 +317,7 @@ where
         .merge(router::hitl::router())
         .nest(
             "/observability",
-            observability::protected_router(state.clone(), finops_limiter),
+            observability::protected_router(state.clone()),
         )
         .merge(agents::upload::status_router())
         .merge(github::router())
```

**File**: `server/src/observability/routes.rs` (modified, +11/-12)
```diff
@@ -120,13 +120,16 @@ pub fn router() -> Router<AppState> {
 /// Protected observability router — mounted under /api/observability (auth required).
 ///
 /// Path params with `{agent_ref}` accept either a UUID or agent name.
-pub fn protected_router(
-    state: AppState,
-    finops_limiter: crate::rate_limit::RateLimiter,
-) -> Router<AppState> {
-    // `/finops/*` gets its own tighter per-user rate limit — see the comment
-    // at the `finops_limiter` definition in lib.rs — separate from the rest
-    // of this router's cheap single-lookup endpoints.
+///
+/// Deliberately unthrottled, like the rest of this router. `/finops/*` carried
+/// a 20/min per-user window for a while because each request fans out several
+/// Tempo searches, but the TokenOps dashboard spends those on a single page
+/// load (dashboard for the current *and* previous window, timeseries, calendar,
+/// attributions) and again on every view toggle and calendar-day click, so
+/// normal use hit `429` within a minute. These are authenticated read-only
+/// reporting endpoints; the cost belongs in Tempo query bounds, not in a
+/// request counter that breaks the UI long before it protects anything.
+pub fn protected_router(state: AppState) -> Router<AppState> {
     let finops_routes = Router::new()
         .route("/finops/dashboard", get(handler::get_finops_dashboard))
         .route("/finops/insights", post(handler::get_finops_insights))
@@ -146,11 +149,7 @@ pub fn protected_router(
         .route(
             "/finops/attributions",
             get(handler::get_finops_attributions),
-        )
-        .layer(axum::middleware::from_fn_with_state(
-            finops_limiter,
-            crate::rate_limit::limit_by_user,
-        ));
+        );
 
     Router::new()
         .route("/session/list", get(handler::get_all_sessions))
```

---

### Incident Patch 7: `9bbc8971` (2026-10-02)
**Commit Message**: fix: ui ci failures
[synced-from-private]

**File**: `ui/common/src/features/settings/SettingsLayout.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
  * rail does: the same nav in a full-height column beside the rail from 1024 px, a sheet opened from above the page
  * below that. The page scrolls in its own column (the shell fills the viewport on /settings, as on /chat). The rows
  * are nasiko-cloud-rs (`origin/development` a4853db4) `ui/oss/navigation.js` `MODULE_NAVS.settings` plus
- * `ui/ee/web/nav-ext-ee.js`:
+ * whatever an edition layer appends:
  * - Workspace: General, (EE: Orchestrator), Flow limits, Registry. `/settings?section=`.
  * - Security: (EE: Single sign-on), Secrets (`/settings/secrets`).
  * - Account: Appearance (`/settings/appearance`; the lab's, this browser's mode and theme), Password
```

**File**: `ui/common/src/index.css` (modified, +5/-2)
```diff
@@ -302,8 +302,11 @@
   --border: oklch(0.922 0 0);
   --input: oklch(0.922 0 0);
   --foreground: oklch(0.145 0 0);
-  /* Lab: 0.556 was 4.3:1 on --muted, the hover fill of rows with a secondary line (chat rail); 0.54 is 4.6:1. */
-  --muted-foreground: oklch(0.54 0 0);
+  /* Lab: 0.556 was 4.3:1 on --muted, the hover fill of rows with a secondary line (chat rail); 0.54 is 4.6:1.
+     0.54 then failed on --accent, which is a step deeper than --muted (0.94 vs 0.97): 4.2:1, caught by axe on the
+     trace waterfall's duration label. Tuned against --accent instead, the darkest fill muted text sits on, so every
+     muted-on-hover case clears AA rather than the next one being found the same way. 0.52 is 4.7:1 there. */
+  --muted-foreground: oklch(0.52 0 0);
   --primary: oklch(0.205 0 0);
   --primary-hover: oklch(0.3 0 0);
   --primary-foreground: oklch(0.985 0 0);
```

---

### Incident Patch 8: `c61bff83` (2026-10-02)
**Commit Message**: fix: build fail in public repo
[synced-from-private]

**File**: `.dockerignore` (modified, +14/-34)
```diff
@@ -1,40 +1,20 @@
-# `**/target/`, not `target/`: Docker anchors a leading-path pattern to the
-# context root, so plain `target/` misses every nested one. The pre-commit hook
-# runs `cd oss && cargo build --workspace` to regenerate the public lockfile,
-# which leaves an oss/target/ that reached ~95 GB on one machine — and Docker
-# was shipping all of it into the build context on every image build.
+# Build context for the public repo's images (server/Dockerfile and friends).
 #
-# The negations below stay anchored to the root target/ on purpose: that is
-# where `just release*` stages the binaries the enterprise Dockerfiles copy.
-**/target/
-!target/x86_64-unknown-linux-musl/release/nasiko-cp
-!target/x86_64-unknown-linux-musl/release/nasiko-cp-cloud
-!target/x86_64-unknown-linux-musl/release/nasiko-registry
-!target/x86_64-unknown-linux-musl/release/nasiko-server-ee
-!target/x86_64-unknown-linux-musl/release/nasiko-tenant-server
-!target/x86_64-unknown-linux-musl/release/nasiko-ee
-!target/x86_64-unknown-linux-musl/release/nasiko-gateway-ee
-!target/x86_64-unknown-linux-musl/release/nasiko-server
-!target/x86_64-unknown-linux-musl/release/nasiko-gateway
-!target/x86_64-unknown-linux-musl/release/nasiko-docs-agent
-!target/x86_64-unknown-linux-musl/release/nasiko-nutrition-agent
-!target/x86_64-unknown-linux-musl/release/nasiko-paper-agent
+# `target/` is anchored to the context root, which is right here: the public
+# repo has no nested oss/ for it to miss. The private repo's root
+# .dockerignore needs `**/target/` instead, for exactly that reason.
+target/
 .git/
+.env
 
-# Installed packages, never read by a Rust build. server/Dockerfile's node
-# stage runs its own `npm ci` from the lockfile rather than taking these.
+# Installed packages. server/Dockerfile's node stage runs its own `npm ci`
+# from the lockfile rather than taking whatever a developer has on disk, and
+# ui/node_modules is ~430 MB of context otherwise.
 **/node_modules/
 
-# Agent scratch space and git worktrees.
-.claude/
+# Build output. The UI bundle is produced inside the image, never copied in.
+**/dist/
+coverage/
 
-agents/
-registry/
-docs/
-*.zip
-
-# oss/server/Dockerfile compiles in-image (COPY . . + cargo build), so the UI
-# tree is part of the context. ui/oss/dist must stay — rust-embed bakes it in,
-# and excluding it would silently ship build.rs's "UI not built" placeholder.
-# node_modules must not: ~800 packages the Rust build never reads.
-ui/node_modules/
+*.md
+!README.md
```

**File**: `.github/workflows/star-chart.yml` (removed, +0/-25)
```diff
@@ -1,25 +0,0 @@
-name: Star chart
-
-# Generates a real star-history chart as a committed SVG (shieldcn action).
-# Runs daily + on-demand; writes .github/shieldcn/star-chart-{light,dark}.svg.
-#
-# NOTE: GitHub restricted the public stargazers API (June 2026), so hosted star
-# charts are gone. This action renders the chart inside the repo using the
-# workflow's own token, where that access still exists.
-
-on:
-  schedule:
-    - cron: "0 6 * * *"   # every day at 06:00 UTC
-  workflow_dispatch:
-
-permissions:
-  contents: write
-
-jobs:
-  stars:
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4
-      - uses: jal-co/shieldcn@v1
-        with:
-          theme: blue
\ No newline at end of file
```

**File**: `README.md` (modified, +1/-3)
```diff
@@ -749,9 +749,7 @@ docs/           Design docs (architecture, protocol, conventions)
 ## Project Activity
 
 
-|                                                        |                                                                                                                                  |
-| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
-| ![Star history](.github/shieldcn/star-chart-light.svg) | ![Issues over time](https://shieldcn.dev/chart/github/issues/Nasiko-Labs/nasiko.svg?theme=blue&width=520&height=220&border=true) |
+![Issues over time](https://shieldcn.dev/chart/github/issues/Nasiko-Labs/nasiko.svg?theme=blue&width=520&height=220&border=true)
 
 
 [![GitHub stars](https://shieldcn.dev/github/stars/Nasiko-Labs/nasiko.svg?variant=secondary&mode=light&theme=red&font=geist-mono)](https://github.com/Nasiko-Labs/nasiko/stargazers)
```

---

### Incident Patch 9: `0c9d9d65` (2026-10-02)
**Commit Message**: Merge pull request #531 from Nasiko-Labs/feat/react-ui-replacement

Feat/react UI replacement
[synced-from-private]

**File**: `ui/.env.example` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ VITE_NASIKO_ALLOW_MOCK_BUILD=
 # In live mode, endpoints MSW should still mock (comma list). Useful for the proposed
 # /finops/top-traces endpoint, which the server doesn't have yet:
 #   VITE_NASIKO_MOCK=top-traces
-# Keys: agents, dashboard, spend-timeseries, spend-calendar, providers, top-traces, observability, harnesses, chat, router, deploy, settings, mcp, workflows (auth is never mocked in live mode;
+# Keys: agents, dashboard, spend-timeseries, spend-calendar, providers, top-traces, observability, harnesses, chat, router, deploy, settings, mcp, workflows, onboarding (auth is never mocked in live mode;
 #   harnesses previews the Harnesses page against a live server, as the seed admin (an edition's own harness
 #   identity routes come with it);
 #   chat needs agents and observability too; router needs agents and providers; deploy, mcp and workflows need agents)
```

**File**: `ui/DESIGN.md` (modified, +27/-19)
```diff
@@ -32,17 +32,21 @@ Every colour is a CSS variable in `common/src/index.css`, exposed to Tailwind th
 ## Themes and mode
 
 - **Mode:** System (default), Light, Dark. `.dark` on `<html>`. Stored as `openruntime.theme`.
-- **Theme:** Teal (default), Indigo, Plum, and Carbon. `data-theme` on `<html>`, stored as
-  `openruntime.accent` (the retired accent presets read as Teal; `indigo` keeps its name).
+- **Theme:** Carbon (default), Teal, Indigo, and Plum. `data-theme` on `<html>`, stored as
+  `openruntime.accent` (the retired accent presets read as Carbon; `indigo` keeps its name).
 - **Carbon** (`data-theme="carbon"`) is shadcn's default new-york neutral palette: Mist in light mode, Carbon in
   dark. It keeps the defaults except where this app's rules need more: a solid focus ring needs 3:1, so light mode's
-  ring is the default's 0.556 grey rather than 0.708; `--primary-hover` is added; status colours stay per mode; charts
+  ring is the default's 0.556 grey rather than 0.708; light mode's `--muted-foreground` is 0.54 rather than 0.556 (4.5:1 on the `--muted` hover fill) and its `--accent` is 0.94 rather than 0.97 (0.97 is `--muted`, the
+  sidebar's hover, so the current nav item read as a hover); `--primary-hover` is added; status colours stay per mode; charts
   use Two-tone in Teal's order (the default chart set has a yellow series). Each theme is a whole token set: neutrals tinted toward the
   primary, the primary, its pale tint, the ring and the chart order. Dark surfaces are composed, not inverted:
   page < sidebar < card.
 - Both are applied before first paint by the inline script in `index.html` (same keys as `theme.ts`, checked by a test).
-- The Theme menu has a Mode group and a Theme group; each theme shows its name beside a swatch of its light
-  `--primary` and the radio indicator, so the choice never relies on colour alone.
+- Settings → Appearance (`/settings/appearance`, also the account menu's Theme submenu) has a Mode radio group and a
+  Theme radio group drawn as picture tiles: each mode is a small drawing of the app in that mode (System split on a
+  diagonal; fixed `--preview-light-*` / `--preview-dark-*` tokens, the same in every theme and mode), each theme a nav
+  tint and button in its light `--primary`. The radio stays in the tile, visually hidden; the chosen tile has a
+  `--primary` ring, a check mark and its name in medium weight, so the choice never relies on colour alone.
 - **Contrast (WCAG AA), every theme × mode, checked by `common/src/app/shell/contrast.test.ts`:** text ≥ 7:1 and secondary
   text ≥ 4.5:1 on cards; text on the primary and on its hover shade ≥ 4.5:1; accent text on page and cards ≥ 4.5:1;
   the active nav text on its tint ≥ 4.5:1; the ring ≥ 3:1; status colours ≥ 4.5:1; the dark logo ≥ 7:1.
@@ -91,8 +95,8 @@ Every colour is a CSS variable in `common/src/index.css`, exposed to Tailwind th
 e
 
 - Tailwind's 4 px scale (Tailwind 4 takes any step, e.g. `h-55` = 220 px, so fixed heights need no `[px]`). Page
-  area: `px-4 py-4`, `max-w-page` 1400 px (Chat fills the viewport instead). Sheets: `max-w-sheet` 560 px and
-  `max-w-sheet-sm` 480 px.
+  area: `px-4 py-4`, `max-w-page` 1400 px (Chat and Settings fill the viewport instead; Settings centres a `max-w-3xl` column). Sheets: `max-w-sheet-lg` 720 px, `max-w-sheet` 560 px and
+  `max-w-sheet-sm` 480 px (`cn()` knows these names, so they beat the primitive's `sm:max-w-sm`).
 - Radius: `--radius` 0.5 rem (`rounded-lg`); `rounded-md` (6 px) for rows and controls.
 - Touch targets: 32 px rows, 44 px on coarse pointers (`pointer-coarse:`).
 
@@ -108,9 +112,11 @@ Presets in `common/src/lib/motion.ts`; new motion uses the names, never raw numb
 | `standard` / `disclosure` | 200 ms ease-out | disclosures (the shared `Disclosure` uses tw-animate-css's matching `collapsible-down/up`), row entrances, fades |
 | `panelIn` / `panelOut` | 220 / 160 ms | sheets and side panels (`sheet.tsx`); reduced motion keeps the fade, drops the slide |
 | `morph` | Motion's default | shared-layout `layoutId` morphs |
-| `typeChar` / `eraseChar` / `typeHold` | 60 / 30 / 1500 ms | the login showcase's typewriter (Motion `animate`); under reduced motion the first word shows at rest |
-| `--animate-caret` | 1 s, stepped | its caret blink (CSS); hidden under reduced motion |
+| `wordHold` | 2800 ms | the login showcase's headline word (the prototype's swap), each arriving on `--animate-word-in` (0.7 s blur-in); under reduced motion the first word stays |
 | `--animate-glow` | 10 s loop (blobs at 10 / 11 / 12 / 14 s, out of phase) | the login showcase's glow: moves and cycles the four `--showcase-glow-*` hues over `--showcase-glow-base` (CSS); every user sets `motion-reduce:animate-none` |
+| `--animate-beam` / `--animate-stage` | 4 s linear loop | the onboarding Welcome step's flow and the router's "How routing works": a beam crosses the stages and each icon lights as it passes (CSS); still under reduced motion, the first stage lit 
```

**File**: `ui/common/src/app/shell/AppShell.test.tsx` (modified, +199/-40)
```diff
@@ -17,21 +17,21 @@ import { setupPinnedSeed } from '@/test/pinnedSeed'
 import { renderApp } from '@/test/renderApp'
 import { recordRequests, server } from '@/test/setup'
 import { SIGNED_OUT_KEY } from '@/lib/session'
+import { copy } from './copy'
 import { NAV_ITEMS } from './nav'
 import { LOGOUT_TIMEOUT_MS, signOut } from './signOut'
-import { readPrefs, resetThemeState, setAccent } from './theme'
+import { readPrefs, resetThemeState, setAccent, setTheme } from './theme'
 
 setupPinnedSeed()
 
 const nav = () => screen.getByRole('navigation', { name: 'Main' })
 const navLink = (name: string) => within(nav()).getByRole('link', { name })
 const sidebarState = () =>
   document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state')
-/** The header's Nasiko link (the phone top bar has one too). */
-const sidebarBrand = () =>
-  within(document.querySelector<HTMLElement>('[data-slot="sidebar"]')!).getByRole('link', {
-    name: 'Nasiko',
-  })
+const sidebar = () => document.querySelector<HTMLElement>('[data-slot="sidebar"]')!
+/** The open sidebar's brand link (the phone top bar has one too; the rail's mark is the Expand button). */
+const sidebarBrand = () => within(sidebar()).getByRole('link', { name: copy.brand })
+const wide = () => Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
 const clearCookie = () => {
   document.cookie = 'sidebar_state=; path=/; max-age=0'
 }
@@ -67,6 +67,8 @@ describe('sidebar items', () => {
     ['/harnesses', 'Harnesses'],
     ['/agents', 'Agents'],
     ['/agents/mine', 'Agents'],
+    ['/deploy', 'Agents'],
+    ['/builds', 'Agents'],
     ['/chat', 'Chat'],
     ['/', 'Overview'],
   ])('marks %s as %s with aria-current', async (url, label) => {
@@ -82,13 +84,16 @@ describe('sidebar items', () => {
     expect(navLink(label).closest('[data-active]')).toHaveAttribute('data-active', 'true')
   })
 
-  it('carries the shared window between Sessions, TokenOps and Harnesses only', async () => {
-    renderApp('/tokenops?preset=7d')
+  it('carries the shared window to Harnesses only; Sessions and TokenOps start on their own', async () => {
+    renderApp('/tokenops?preset=24h&compare=0')
     await screen.findByRole('navigation', { name: 'Main' })
     await waitFor(() =>
-      expect(navLink('Sessions')).toHaveAttribute('href', expect.stringContaining('preset=7d')),
+      expect(navLink('Harnesses')).toHaveAttribute('href', expect.stringContaining('preset=24h')),
     )
-    expect(navLink('Harnesses').getAttribute('href')).toContain('preset=7d')
+    // The other shared keys still cross into Sessions and TokenOps; the window doesn't.
+    expect(navLink('Sessions').getAttribute('href')).toContain('compare=false')
+    expect(navLink('Sessions').getAttribute('href')).not.toContain('preset')
+    expect(navLink('TokenOps').getAttribute('href')).not.toContain('preset')
     expect(navLink('Chat').getAttribute('href')).toBe('/chat')
     expect(navLink('Agents').getAttribute('href')).toBe('/agents')
   })
@@ -98,21 +103,19 @@ describe('sidebar items', () => {
     await screen.findByRole('navigation', { name: 'Main' })
     await userEvent.click(navLink('TokenOps'))
     await waitFor(() => expect(router.state.location.pathname).toBe('/tokenops'))
-    expect(router.state.location.search).toMatchObject({ preset: '7d' })
+    // TokenOps opens on its own 30 days, not Sessions' window.
+    expect(router.state.location.search).toMatchObject({ preset: '30d' })
     expect(router.state.location.search).not.toHaveProperty('day')
     await userEvent.click(navLink('Harnesses'))
     await waitFor(() => expect(router.state.location.pathname).toBe('/harnesses'))
-    expect(router.state.location.search).toMatchObject({ preset: '7d' })
+    expect(router.state.location.search).toMatchObject({ preset: '30d' })
   })
 
   it('shows a way back into the app on an unknown URL', async () => {
     renderApp('/no-such-page')
     await screen.findByRole('heading', { name: 'Page not found' })
+    expect(screen.getByRole('link', { name: 'Back to Overview' })).toHaveAttribute('href', '/')
     expect(screen.getByRole('link', { name: 'Go to Chat' })).toHaveAttribute('href', '/chat')
-    expect(screen.getByRole('link', { name: 'Go to TokenOps' })).toHaveAttribute(
-      'href',
-      expect.stringContaining('/tokenops'),
-    )
   })
 
   it('has no Weave fixture gallery: Weave is EE only', async () => {
@@ -154,18 +157,21 @@ describe('sidebar items', () => {
   })
 })
 
-describe('Nasiko header link', () => {
-  it('goes to Chat through the router without marking itself current', async () => {
+describe('header brand link', () => {
+  it('goes to the Overview through the router without marking itself current', async () => {
+    wide()
     const { router } = renderApp('/agents')
     await screen.findByRole('navigation', { name: 'Main' })
     const brand = sidebarBrand()
-    expect(brand).toHaveAttribute('href', '/chat')
+    expect(brand).to
```

**File**: `ui/common/src/app/shell/AppShell.tsx` (modified, +65/-49)
```diff
@@ -9,67 +9,83 @@ import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/s
 import { cn } from '@/lib/utils'
 import { AppSidebar, type NavBadges } from './AppSidebar'
 import { copy } from './copy'
+import { SidebarPanelContext } from './panelSlot'
 import { widthDefaultOpen, readSidebarCookie } from './sidebarState'
 
-/** Chat owns its own scrolling: the page fills the viewport (plan §7.1, EN20). */
-const FULL_HEIGHT = /^\/chat(\/|$)/
+/** Chat and Settings own their scrolling (their section column stays put): the page fills the viewport (plan §7.1, EN20). */
+const FULL_HEIGHT = /^\/(chat|settings)(\/|$)/
 
 /**
  * `end` and `badges` come from the `_app` route, which may import features (the shell never does): Deploy's build
  * toasts and the Builds item's in-progress count.
  */
-export function AppShell({ end, badges }: { end?: ReactNode; badges?: NavBadges } = {}) {
+export function AppShell({
+  end,
+  badges,
+  hidden,
+}: {
+  end?: ReactNode
+  badges?: NavBadges
+  /** Nav paths to leave out (onboarding hides Overview while its guide stands in for it). */
+  hidden?: readonly string[]
+} = {}) {
   const fullHeight = useRouterState({ select: (s) => FULL_HEIGHT.test(s.location.pathname) })
-  // Controlled (v1c E1): the cookie wins; with none, Chat opens the sidebar as its icon rail so the
-  // conversation gets the width (D3), and other pages use the width default. Only a user toggle sets
-  // `choice`, and the sidebar writes the cookie then, so these defaults are never stored.
+  // Controlled (v1c E1): the cookie wins; with none, the width default. Chat used to start as the icon rail so its
+  // history column fit beside the nav; its history is the sidebar's drill-in panel now, so it needs the open sidebar.
+  // Only a user toggle sets `choice`, and the sidebar writes the cookie then, so the default is never stored.
   const [choice, setChoice] = useState(readSidebarCookie)
   const [widthDefault] = useState(widthDefaultOpen)
-  const open = choice ?? (fullHeight ? false : widthDefault)
+  const open = choice ?? widthDefault
+  // The drill-in slot (sidebarPanel.ts): the sidebar hands out `target`, a page's SidebarPanel portals into it.
+  const [target, setTarget] = useState<HTMLElement | null>(null)
+  const [panels, setPanels] = useState(0)
   return (
-    <SidebarProvider
-      open={open}
-      onOpenChange={setChoice}
-      className={fullHeight ? 'h-dvh' : 'min-h-screen'}
-    >
-      {/* A button, not an `#main` link: a fragment navigation would add a history entry and make
-          the router reload the route (review: red team). */}
-      <Button
-        variant="outline"
-        size="sm"
-        onClick={() => document.getElementById('main')?.focus()}
-        className="sr-only z-50 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
-      >
-        {copy.skipToContent}
-      </Button>
-      <AppSidebar badges={badges} />
-      <SidebarInset
-        id="main"
-        tabIndex={-1}
-        className={cn('outline-none', fullHeight ? 'min-h-0' : 'mx-auto max-w-page')}
+    <SidebarPanelContext value={{ target, setTarget, panels, setPanels }}>
+      <SidebarProvider
+        open={open}
+        onOpenChange={setChoice}
+        className={fullHeight ? 'h-dvh' : 'min-h-screen'}
       >
-        {/* Phones: a slim top bar with the menu button opens the nav sheet (§4.2). */}
-        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 md:hidden">
-          <SidebarTrigger aria-label={copy.openMenu} className="size-11" />
-          <Link
-            to="/chat"
-            className="flex h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
-          >
-            <img src="/mark-nasiko.svg" alt="" aria-hidden className="size-4" />
-            {copy.brand}
-          </Link>
-        </div>
-        {fullHeight ? (
-          <div className="min-h-0 flex-1">
-            <Outlet />
-          </div>
-        ) : (
-          <div className="w-full px-4 py-4">
-            <Outlet />
+        {/* A button, not an `#main` link: a fragment navigation would add a history entry and make
+          the router reload the route (review: red team). */}
+        <Button
+          variant="outline"
+          size="sm"
+          onClick={() => document.getElementById('main')?.focus()}
+          className="sr-only z-50 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
+        >
+          {copy.skipToContent}
+        </Button>
+        <AppSidebar badges={badges} hidden={hidden} />
+        <SidebarInset
+          id="main"
+          tabIndex={-1}
+          className={cn('outline-none', fullHeight ? 'min-h-0' : 'mx-auto max-w-page')}
+        >
+          {/* Phones: a slim top bar with the menu button opens the nav sheet (§4.2). */}
+          <div 
```

**File**: `ui/common/src/app/shell/AppSidebar.tsx` (modified, +344/-77)
```diff
@@ -1,24 +1,42 @@
 /**
- * The app's left sidebar (plans/feat-app-shell.md §3–§4): the Nasiko header, the nav groups from
- * `nav.ts`, and the footer (status, theme, account, collapse). Built on shadcn's sidebar primitive.
+ * The app's left sidebar (plans/feat-app-shell.md §3–§4): the header (OpenRuntime home link, collapse), the nav groups
+ * from `nav.ts` or a page's drill-in panel (`SidebarPanel`: Chat's history, Settings' sections), and the footer
+ * (status in local builds, account; Settings opens from the account menu). Built on shadcn's sidebar primitive.
  */
 import { useQuery, useQueryClient } from '@tanstack/react-query'
 import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
 import {
-  ChevronsLeft,
-  ChevronsRight,
+  ArrowLeft,
   CircleAlert,
   CircleUser,
   LogOut,
-  KeyRound,
+  Palette,
+  PanelLeftClose,
+  PanelLeftOpen,
   RotateCw,
+  Settings,
 } from 'lucide-react'
-import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
+import {
+  use,
+  useCallback,
+  useId,
+  useEffect,
+  useLayoutEffect,
+  useRef,
+  useState,
+  type RefObject,
+} from 'react'
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
+  DropdownMenuRadioGroup,
+  DropdownMenuRadioItem,
+  DropdownMenuSeparator,
+  DropdownMenuSub,
+  DropdownMenuSubContent,
+  DropdownMenuSubTrigger,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu'
 import {
@@ -34,87 +52,237 @@ import {
   SidebarMenuItem,
   useSidebar,
 } from '@/components/ui/sidebar'
-import { deferred } from '@/app/deferred'
-import { applyNav } from '@/app/edition'
+import { applyNav, type AnyNavItem } from '@/app/edition'
 import { EditionContext } from '@/app/edition-context'
 import { meQuery } from '@/lib/api/auth'
 import { ApiError } from '@/lib/api/client'
 import { SIDEBAR_HEALTH_INTERVAL_MS, useHealth } from '@/lib/api/health'
 import { env } from '@/lib/env'
 import { cn } from '@/lib/utils'
-import { pickShared } from './context'
+import { pickShared, withoutWindow } from './context'
 import { copy } from './copy'
 import { NasikoMark } from './NasikoMark'
-import { activeItem, NAV_GROUPS, NAV_ITEMS } from './nav'
+import { activeItem, backIndex, moduleOf, NAV_GROUPS, NAV_ITEMS, pathOf } from './nav'
 import { ACTIVE_ROW, GROUP, LABEL, ROW } from './rowStyles'
 import { signOut } from './signOut'
-import { ThemeMenu } from './ThemeMenu'
-
-// Loads on first open: the shell budget has no room for the dialog and its form.
-const ChangePasswordDialog = deferred(() =>
-  import('./ChangePasswordDialog').then((m) => m.ChangePasswordDialog),
-)
+import {
+  ACCENTS,
+  setAccent,
+  setTheme,
+  THEMES,
+  useThemePrefs,
+  type Accent,
+  type Theme,
+} from './theme'
+import { SidebarPanelContext } from './panelSlot'
 
 /** How long a pending health check stays quiet before "Checking…" shows (design review 2A). */
 const CHECKING_DELAY_MS = 1_000
 
+/**
+ * The status row is for whoever runs the lab: local dev servers, and any build that serves mock data (so a demo
+ * build still says MOCK DATA). A production build against a real server leaves it out, and polls no /health.
+ */
+const SHOW_STATUS = import.meta.env.DEV || env.mode === 'mock'
+
+/** Which view takes focus after a swap between the app nav and a drill-in panel (the clicked row unmounts). */
+type FocusNext = RefObject<'menu' | 'panel' | null>
+
 /** A count on a nav item, with the words a screen reader hears after its label (the Builds item: builds in progress). */
 export type NavBadges = Partial<Record<string, { count: number; label: string }>>
 
-export function AppSidebar({ badges }: { badges?: NavBadges } = {}) {
+export function AppSidebar({
+  badges,
+  hidden,
+}: { badges?: NavBadges; hidden?: readonly string[] } = {}) {
   const pathname = useRouterState({ select: (s) => s.location.pathname })
+  const href = useRouterState({ select: (s) => s.location.href })
   const navigate = useNavigate()
-  const { setOpenMobile } = useSidebar()
+  const layers = use(EditionContext).edition.layers
+  const { setOpenMobile, isMobile, state } = useSidebar()
+  const { panels, setTarget } = use(SidebarPanelContext)
   // The phone sheet closes on navigation (§4.2).
   useEffect(() => setOpenMobile(false), [pathname, setOpenMobile])
+  // "Main menu" shows the app nav over a page's panel until the next navigation (or a click on the current item).
+  const [menu, setMenu] = useState(false)
+  const [menuPath, setMenuPath] = useState(pathname)
+  if (menuPath !== pathname) {
+    setMenuPath(pathname)
+    setMenu(false)
+  }
+  const focusNextRef = useRef<'menu' | 'panel' | null>(null)
+  // A click on the current page's item (nav or footer) brings its panel back: the path doesn't change.
+  const pick = () => {
+    if (panels > 0) focusNextRef.current = 'panel'
+    setMenu(false)
+  }
+  // The collapsed rail keeps the app nav's icons; the page then shows its 
```

**File**: `ui/common/src/app/shell/ChangePasswordDialog.test.tsx` (removed, +0/-94)
```diff
@@ -1,94 +0,0 @@
-import { screen, waitFor, within } from '@testing-library/react'
-import userEvent from '@testing-library/user-event'
-import { http, HttpResponse } from 'msw'
-import { afterEach, describe, expect, it } from 'vitest'
-import { configureMocks } from '@/mocks/handlers'
-import { now, seed, setupPinnedSeed } from '@/test/pinnedSeed'
-import { recordRequests, server } from '@/test/setup'
-import { renderApp } from '@/test/renderApp'
-import { copy as shell } from './copy'
-import { passwordCopy as copy } from './passwordCopy'
-
-setupPinnedSeed()
-afterEach(() => configureMocks({ seed, now, loggedIn: true, variant: null, superuser: null }))
-
-const T = { timeout: 5000 }
-const STRONG = 'A-brand-new-password9'
-
-async function open() {
-  await userEvent.click(await screen.findByRole('button', { name: /^Account: / }, T))
-  await userEvent.click(await screen.findByRole('menuitem', { name: shell.account.changePassword }))
-  return screen.findByRole('dialog', { name: copy.title }, T)
-}
-async function fill(d: HTMLElement, current: string, next: string, confirm = next) {
-  const set = async (label: string, v: string) => {
-    const el = within(d).getByLabelText(label)
-    await userEvent.clear(el)
-    if (v) await userEvent.type(el, v)
-  }
-  await set(copy.current, current)
-  await set(copy.next, next)
-  await set(copy.confirm, confirm)
-  await userEvent.click(within(d).getByRole('button', { name: copy.submit }))
-}
-
-describe('Change password (account menu)', () => {
-  it("reports the policy's first broken rule on its field before sending", async () => {
-    const rec = recordRequests()
-    renderApp('/')
-    const d = await open()
-    expect(within(d).getByText(copy.policy(12, 64))).toBeInTheDocument()
-    await fill(d, 'whatever', 'short')
-    expect(await within(d).findByText(copy.problem.short(12))).toBeInTheDocument()
-    await fill(d, 'whatever', STRONG, 'different')
-    expect(await within(d).findByText(copy.mismatch)).toBeInTheDocument()
-    rec.stop()
-    expect(rec.urls.some((u) => u.pathname === '/api/auth/change-password')).toBe(false)
-  })
-
-  it('changes it, then a wrong current password lands on its field (403, never a sign-out)', async () => {
-    const { router } = renderApp('/')
-    await fill(await open(), 'whatever', STRONG)
-    expect(await screen.findByText(copy.changed, {}, T)).toBeInTheDocument()
-    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
-    const d = await open()
-    // A fresh dialog each time: nothing typed before survives.
-    expect(within(d).getByLabelText(copy.current)).toHaveValue('')
-    await fill(d, 'not-it', 'Another-password9')
-    expect(await within(d).findByText('Current password is incorrect')).toBeInTheDocument()
-    expect(router.state.location.pathname).toBe('/')
-  })
-
-  it('an SSO account gets the server reason as a toast (409 no_local_password)', async () => {
-    server.use(
-      http.post('/api/auth/change-password', () =>
-        HttpResponse.json(
-          {
-            error: 'this account signs in through your identity provider',
-            code: 'no_local_password',
-          },
-          { status: 409 },
-        ),
-      ),
-    )
-    renderApp('/')
-    await fill(await open(), 'whatever', STRONG)
-    expect(
-      await screen.findByText('This account signs in through your identity provider', {}, T),
-    ).toBeInTheDocument()
-  })
-
-  it('a 204 (changed, no new session) signs out and says why on /login', async () => {
-    server.use(
-      http.post('/api/auth/change-password', () => {
-        configureMocks({ loggedIn: false })
-        return new HttpResponse(null, { status: 204 })
-      }),
-    )
-    const { router } = renderApp('/')
-    await fill(await open(), 'whatever', STRONG)
-    await waitFor(() => expect(router.state.location.pathname).toBe('/login'), T)
-    expect(router.state.location.search).toMatchObject({ password: 'changed' })
-    expect(await screen.findByText(shell.login.passwordChanged)).toBeInTheDocument()
-  })
-})
```

**File**: `ui/common/src/app/shell/ChangePasswordDialog.tsx` (removed, +0/-170)
```diff
@@ -1,170 +0,0 @@
-/**
- * Self-service password change, opened from the account menu (nasiko-cloud-rs `43833316`,
- * ui/common/features/change-password-modal.js). `POST /api/auth/change-password` confirms with the current password:
- * - 200: this browser gets a fresh cookie; every other session is revoked.
- * - 204: the password changed, but no new session came back and the cookie was cleared, so sign out and say why.
- * - `{error, code}` errors land on the field the code names (`current_password_incorrect` is a 403, never session
- *   loss); anything else is a toast.
- * Mounted only while open (deferred from AppSidebar), so each open starts with empty fields.
- */
-import { useQueryClient } from '@tanstack/react-query'
-import { useNavigate } from '@tanstack/react-router'
-import { useId, useState } from 'react'
-import { useForm } from 'react-hook-form'
-import { toast } from 'sonner'
-import { Button } from '@/components/ui/button'
-import {
-  Dialog,
-  DialogContent,
-  DialogDescription,
-  DialogFooter,
-  DialogHeader,
-  DialogTitle,
-} from '@/components/ui/dialog'
-import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
-import { Input } from '@/components/ui/input'
-import { apiFetch, ApiError } from '@/lib/api/client'
-import type { Me } from '@/lib/api/auth'
-import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem, type PasswordProblem } from '@/lib/password'
-import { passwordCopy as copy } from './passwordCopy'
-import { signOut } from './signOut'
-
-type Values = { current: string; next: string; confirm: string }
-
-const problemText = (p: PasswordProblem) =>
-  p === 'short'
-    ? copy.problem.short(PASSWORD_MIN)
-    : p === 'long'
-      ? copy.problem.long(PASSWORD_MAX)
-      : copy.problem[p]
-
-/** The legacy dialog's order: the first failing check is the one reported. */
-function firstProblem(v: Values): [keyof Values, string] | null {
-  if (!v.current) return ['current', copy.currentRequired]
-  if (!v.next) return ['next', copy.nextRequired]
-  const p = passwordProblem(v.next)
-  if (p) return ['next', problemText(p)]
-  if (v.next === v.current) return ['next', copy.same]
-  if (v.next !== v.confirm) return ['confirm', copy.mismatch]
-  return null
-}
-
-/** The server's messages are lowercase fragments; the field reads them as sentences. */
-const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
-
-export function ChangePasswordDialog({ me, onClose }: { me: Me; onClose: () => void }) {
-  const id = useId()
-  const queryClient = useQueryClient()
-  const navigate = useNavigate()
-  const [busy, setBusy] = useState(false)
-  const form = useForm<Values>({ defaultValues: { current: '', next: '', confirm: '' } })
-  const { errors } = form.formState
-
-  const submit = form.handleSubmit(async (v) => {
-    const problem = firstProblem(v)
-    if (problem) {
-      form.setError(problem[0], { message: problem[1] }, { shouldFocus: true })
-      return
-    }
-    // One request at a time: a second one would send a current password the first already replaced.
-    if (busy) return
-    setBusy(true)
-    try {
-      const body = await apiFetch<unknown>('/api/auth/change-password', {
-        method: 'POST',
-        headers: { 'Content-Type': 'application/json' },
-        body: JSON.stringify({ current_password: v.current, new_password: v.next }),
-      })
-      onClose()
-      if (body !== null) {
-        toast.success(copy.changed)
-        return
-      }
-      await signOut({
-        queryClient,
-        userId: me.sub,
-        navigate: (to) =>
-          navigate({
-            to: '/login',
-            search: to.search.signout ? to.search : { password: 'changed' },
-          }),
-      })
-    } catch (err) {
-      const b = err instanceof ApiError ? (err.body as { code?: unknown } | null) : null
-      const code = typeof b?.code === 'string' ? b.code : ''
-      const message = sentence((err instanceof ApiError && err.serverMessage) || copy.failed)
-      if (code === 'current_password_incorrect')
-        form.setError('current', { message }, { shouldFocus: true })
-      else if (code.startsWith('password_'))
-        form.setError('next', { message }, { shouldFocus: true })
-      else
-        toast.error(
-          err instanceof ApiError && !err.isServerUnreachable ? message : copy.unreachable,
-        )
-    } finally {
-      setBusy(false)
-    }
-  })
-
-  const field = (
-    name: keyof Values,
-    label: string,
-    placeholder: string,
-    autoComplete: string,
-    hint?: string,
-  ) => (
-    <Field data-invalid={!!errors[name]} className="gap-1.5">
-      <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
-      <Input
-        id={`${id}-${name}`}
-        type="password"
-        autoComplete={autoComplete}
-        placeholder={placeholder}
-        aria-invalid={!!errors[name]}
-        {...form.register(name, {
-          // The message always describes the
```

**File**: `ui/common/src/app/shell/LoginShowcase.tsx` (modified, +160/-123)
```diff
@@ -1,158 +1,195 @@
-import { animate, type AnimationPlaybackControls, useReducedMotion } from 'motion/react'
-import { useEffect, useState } from 'react'
-import { Badge } from '@/components/ui/badge'
+import { useReducedMotion } from 'motion/react'
+import { useEffect, useRef, useState } from 'react'
 import { durations } from '@/lib/motion'
 import { cn } from '@/lib/utils'
 import { copy } from './copy'
 import { NasikoMark } from './NasikoMark'
 
 /**
- * The login page's showcase: our own take on Aceternity's "Login Form With Gradient" block (a Pro block, so no
- * source copied; docs/superpowers/specs/2026-09-30-aceternity-login-design.md). Decorative only: aria-hidden, CSS
- * only, still under reduced motion. Its palette is the block's (black, dark tiles, a warm glow): the `--showcase-*`
- * tokens, the same in every theme and mode. Hidden below `md`. The headline
- * is our take on Aceternity's "Text Animation Typewriter Effect" (also Pro).
+ * The login page's showcase: the user's "Nasiko Console" prototype, screen "01 Sign in" (docs/superpowers/specs/
+ * 2026-10-01-login-onboarding-design.md §1), mirrored to the left half. Aceternity's "Login Form With Gradient"
+ * colour field (our own take: blurred blobs cycling its four hues) rising from under a stack of
+ * translucent glass plates (the Nasiko mark on the top one), a floor shadow and a masked dot grid, then tab chips and a glass headline card (light glass in light mode, dark glass in dark mode)
+ * (half-black glass, the word in the brand's gold) whose word changes every 2.8 s; the lit chip and plate follow
+ * it, ringed in the theme's primary. Decorative only: aria-hidden, inert, CSS motion, still under reduced motion; the
+ * stack tilts a little with the pointer, as in the prototype. Colours are the per-mode `--showcase-*` tokens (index.css). Hidden below `md`.
  */
-const AREAS = [
-  copy.nav.chat,
-  copy.nav.agents,
-  copy.nav.router,
-  copy.nav.sessions,
-  copy.nav.tokenops,
+const WORDS = copy.login.showcaseWords
+/** Bottom plate first, as the prototype stacks them: Frameworks, Tools, Coding Harnesses, Agents on top. */
+const PLATES = [...WORDS].reverse()
+const EDGES = [
+  'var(--showcase-layer-1-edge)',
+  'var(--showcase-layer-2-edge)',
+  'var(--showcase-layer-3-edge)',
+  'var(--showcase-layer-4-edge)',
+]
+const FILLS = [
+  'var(--showcase-layer-1)',
+  'var(--showcase-layer-2)',
+  'var(--showcase-layer-3)',
+  'var(--showcase-layer-4)',
 ]
 
+/** The stack at rest, and how far the pointer tilts it (the prototype's ±8° / ±11° at the panel's edges). */
+const TILT = { x: 56, z: -38, xRange: 16, zRange: 22 }
+const tiltOf = (tx: number, ty: number) =>
+  `rotateX(${TILT.x - ty * TILT.xRange}deg) rotateZ(${TILT.z + tx * TILT.zRange}deg)`
+
 export function LoginShowcase() {
+  const reduce = useReducedMotion()
+  const panel = useRef<HTMLDivElement>(null)
+  const stack = useRef<HTMLDivElement>(null)
+  // The prototype's mouse tilt (user request 2026-10-01). The panel stays inert (pointer-events-none, aria-hidden): the
+  // page's pointer position is read from window and written straight to the stack, one frame at a time, so nothing
+  // re-renders. Outside the panel the stack eases back to rest; under reduced motion it never moves.
+  useEffect(() => {
+    if (reduce) return
+    let frame = 0
+    const onMove = (e: PointerEvent) => {
+      cancelAnimationFrame(frame)
+      frame = requestAnimationFrame(() => {
+        const box = panel.current?.getBoundingClientRect()
+        const el = stack.current
+        if (!box || !el || !box.width) return
+        const tx = (e.clientX - box.left) / box.width - 0.5
+        const ty = (e.clientY - box.top) / box.height - 0.5
+        const inside = Math.abs(tx) <= 0.5 && Math.abs(ty) <= 0.5
+        el.style.transform = inside ? tiltOf(tx, ty) : tiltOf(0, 0)
+      })
+    }
+    const onLeave = () => {
+      if (stack.current) stack.current.style.transform = tiltOf(0, 0)
+    }
+    window.addEventListener('pointermove', onMove)
+    document.documentElement.addEventListener('pointerleave', onLeave)
+    return () => {
+      cancelAnimationFrame(frame)
+      window.removeEventListener('pointermove', onMove)
+      document.documentElement.removeEventListener('pointerleave', onLeave)
+    }
+  }, [reduce])
+  const [index, setIndex] = useState(0)
+  useEffect(() => {
+    if (reduce) return
+    const t = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), durations.wordHold)
+    return () => clearInterval(t)
+  }, [reduce])
+  const active = WORDS[index] ?? WORDS[0]
   return (
     <div
       aria-hidden
+      ref={panel}
       data-testid="login-showcase"
-      className="relative hidden aspect-7/8 flex-col items-start justify-end overflow-hidden rounded-2xl bg-showcase p-8 text-showcase-foreground md:flex"
+      className="pointer-events-none relative hidden min-h-[max(680px,calc(100svh-2rem))] flex-col p-10 md:flex"
     >
-      <Tiles className
```

---

### Incident Patch 10: `90ce3b21` (2026-10-02)
**Commit Message**: feat(ui): sync the React tree with nasiko-ui-lab main (0fc9095)

Brings ui/ from lab e838deb up to lab main 0fc9095: onboarding guide,
one sidebar with drill-in panels (Settings > Appearance / Password pages
replace the password dialog and theme menu), Overview KPIs and month bar,
Carbon as the default theme, page loader, consistent empty states, glitch
404, sticky Deploy tabs, and the Workflows / Sessions / MCP refinements.

Kept from this branch: ui/ARCHITECTURE.md, ui/.gitignore, the split
sk- fixture in common/src/test/live/lib.test.ts, and the public-safe
"development builds only" wording in DESIGN.md. Lab-only files (CLAUDE.md,
AGENTS.md, CHANGELOG, TODOS, VERSION, PRODUCT.md, .github, .impeccable,
oss/.gitignore) stay out. Removes the agents/AgentLink.tsx churn probe.

check-secret-patterns.sh and test-sync-offline.sh pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
[synced-from-private]

**File**: `ui/.env.example` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ VITE_NASIKO_ALLOW_MOCK_BUILD=
 # In live mode, endpoints MSW should still mock (comma list). Useful for the proposed
 # /finops/top-traces endpoint, which the server doesn't have yet:
 #   VITE_NASIKO_MOCK=top-traces
-# Keys: agents, dashboard, spend-timeseries, spend-calendar, providers, top-traces, observability, harnesses, chat, router, deploy, settings, mcp, workflows (auth is never mocked in live mode;
+# Keys: agents, dashboard, spend-timeseries, spend-calendar, providers, top-traces, observability, harnesses, chat, router, deploy, settings, mcp, workflows, onboarding (auth is never mocked in live mode;
 #   harnesses previews the Harnesses page against a live server, as the seed admin (an edition's own harness
 #   identity routes come with it);
 #   chat needs agents and observability too; router needs agents and providers; deploy, mcp and workflows need agents)
```

**File**: `ui/DESIGN.md` (modified, +27/-19)
```diff
@@ -32,17 +32,21 @@ Every colour is a CSS variable in `common/src/index.css`, exposed to Tailwind th
 ## Themes and mode
 
 - **Mode:** System (default), Light, Dark. `.dark` on `<html>`. Stored as `openruntime.theme`.
-- **Theme:** Teal (default), Indigo, Plum, and Carbon. `data-theme` on `<html>`, stored as
-  `openruntime.accent` (the retired accent presets read as Teal; `indigo` keeps its name).
+- **Theme:** Carbon (default), Teal, Indigo, and Plum. `data-theme` on `<html>`, stored as
+  `openruntime.accent` (the retired accent presets read as Carbon; `indigo` keeps its name).
 - **Carbon** (`data-theme="carbon"`) is shadcn's default new-york neutral palette: Mist in light mode, Carbon in
   dark. It keeps the defaults except where this app's rules need more: a solid focus ring needs 3:1, so light mode's
-  ring is the default's 0.556 grey rather than 0.708; `--primary-hover` is added; status colours stay per mode; charts
+  ring is the default's 0.556 grey rather than 0.708; light mode's `--muted-foreground` is 0.54 rather than 0.556 (4.5:1 on the `--muted` hover fill) and its `--accent` is 0.94 rather than 0.97 (0.97 is `--muted`, the
+  sidebar's hover, so the current nav item read as a hover); `--primary-hover` is added; status colours stay per mode; charts
   use Two-tone in Teal's order (the default chart set has a yellow series). Each theme is a whole token set: neutrals tinted toward the
   primary, the primary, its pale tint, the ring and the chart order. Dark surfaces are composed, not inverted:
   page < sidebar < card.
 - Both are applied before first paint by the inline script in `index.html` (same keys as `theme.ts`, checked by a test).
-- The Theme menu has a Mode group and a Theme group; each theme shows its name beside a swatch of its light
-  `--primary` and the radio indicator, so the choice never relies on colour alone.
+- Settings → Appearance (`/settings/appearance`, also the account menu's Theme submenu) has a Mode radio group and a
+  Theme radio group drawn as picture tiles: each mode is a small drawing of the app in that mode (System split on a
+  diagonal; fixed `--preview-light-*` / `--preview-dark-*` tokens, the same in every theme and mode), each theme a nav
+  tint and button in its light `--primary`. The radio stays in the tile, visually hidden; the chosen tile has a
+  `--primary` ring, a check mark and its name in medium weight, so the choice never relies on colour alone.
 - **Contrast (WCAG AA), every theme × mode, checked by `common/src/app/shell/contrast.test.ts`:** text ≥ 7:1 and secondary
   text ≥ 4.5:1 on cards; text on the primary and on its hover shade ≥ 4.5:1; accent text on page and cards ≥ 4.5:1;
   the active nav text on its tint ≥ 4.5:1; the ring ≥ 3:1; status colours ≥ 4.5:1; the dark logo ≥ 7:1.
@@ -91,8 +95,8 @@ Every colour is a CSS variable in `common/src/index.css`, exposed to Tailwind th
 e
 
 - Tailwind's 4 px scale (Tailwind 4 takes any step, e.g. `h-55` = 220 px, so fixed heights need no `[px]`). Page
-  area: `px-4 py-4`, `max-w-page` 1400 px (Chat fills the viewport instead). Sheets: `max-w-sheet` 560 px and
-  `max-w-sheet-sm` 480 px.
+  area: `px-4 py-4`, `max-w-page` 1400 px (Chat and Settings fill the viewport instead; Settings centres a `max-w-3xl` column). Sheets: `max-w-sheet-lg` 720 px, `max-w-sheet` 560 px and
+  `max-w-sheet-sm` 480 px (`cn()` knows these names, so they beat the primitive's `sm:max-w-sm`).
 - Radius: `--radius` 0.5 rem (`rounded-lg`); `rounded-md` (6 px) for rows and controls.
 - Touch targets: 32 px rows, 44 px on coarse pointers (`pointer-coarse:`).
 
@@ -108,9 +112,11 @@ Presets in `common/src/lib/motion.ts`; new motion uses the names, never raw numb
 | `standard` / `disclosure` | 200 ms ease-out | disclosures (the shared `Disclosure` uses tw-animate-css's matching `collapsible-down/up`), row entrances, fades |
 | `panelIn` / `panelOut` | 220 / 160 ms | sheets and side panels (`sheet.tsx`); reduced motion keeps the fade, drops the slide |
 | `morph` | Motion's default | shared-layout `layoutId` morphs |
-| `typeChar` / `eraseChar` / `typeHold` | 60 / 30 / 1500 ms | the login showcase's typewriter (Motion `animate`); under reduced motion the first word shows at rest |
-| `--animate-caret` | 1 s, stepped | its caret blink (CSS); hidden under reduced motion |
+| `wordHold` | 2800 ms | the login showcase's headline word (the prototype's swap), each arriving on `--animate-word-in` (0.7 s blur-in); under reduced motion the first word stays |
 | `--animate-glow` | 10 s loop (blobs at 10 / 11 / 12 / 14 s, out of phase) | the login showcase's glow: moves and cycles the four `--showcase-glow-*` hues over `--showcase-glow-base` (CSS); every user sets `motion-reduce:animate-none` |
+| `--animate-beam` / `--animate-stage` | 4 s linear loop | the onboarding Welcome step's flow and the router's "How routing works": a beam crosses the stages and each icon lights as it passes (CSS); still under reduced motion, the first stage lit 
```

**File**: `ui/common/src/app/shell/AppShell.test.tsx` (modified, +199/-40)
```diff
@@ -17,21 +17,21 @@ import { setupPinnedSeed } from '@/test/pinnedSeed'
 import { renderApp } from '@/test/renderApp'
 import { recordRequests, server } from '@/test/setup'
 import { SIGNED_OUT_KEY } from '@/lib/session'
+import { copy } from './copy'
 import { NAV_ITEMS } from './nav'
 import { LOGOUT_TIMEOUT_MS, signOut } from './signOut'
-import { readPrefs, resetThemeState, setAccent } from './theme'
+import { readPrefs, resetThemeState, setAccent, setTheme } from './theme'
 
 setupPinnedSeed()
 
 const nav = () => screen.getByRole('navigation', { name: 'Main' })
 const navLink = (name: string) => within(nav()).getByRole('link', { name })
 const sidebarState = () =>
   document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state')
-/** The header's Nasiko link (the phone top bar has one too). */
-const sidebarBrand = () =>
-  within(document.querySelector<HTMLElement>('[data-slot="sidebar"]')!).getByRole('link', {
-    name: 'Nasiko',
-  })
+const sidebar = () => document.querySelector<HTMLElement>('[data-slot="sidebar"]')!
+/** The open sidebar's brand link (the phone top bar has one too; the rail's mark is the Expand button). */
+const sidebarBrand = () => within(sidebar()).getByRole('link', { name: copy.brand })
+const wide = () => Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
 const clearCookie = () => {
   document.cookie = 'sidebar_state=; path=/; max-age=0'
 }
@@ -67,6 +67,8 @@ describe('sidebar items', () => {
     ['/harnesses', 'Harnesses'],
     ['/agents', 'Agents'],
     ['/agents/mine', 'Agents'],
+    ['/deploy', 'Agents'],
+    ['/builds', 'Agents'],
     ['/chat', 'Chat'],
     ['/', 'Overview'],
   ])('marks %s as %s with aria-current', async (url, label) => {
@@ -82,13 +84,16 @@ describe('sidebar items', () => {
     expect(navLink(label).closest('[data-active]')).toHaveAttribute('data-active', 'true')
   })
 
-  it('carries the shared window between Sessions, TokenOps and Harnesses only', async () => {
-    renderApp('/tokenops?preset=7d')
+  it('carries the shared window to Harnesses only; Sessions and TokenOps start on their own', async () => {
+    renderApp('/tokenops?preset=24h&compare=0')
     await screen.findByRole('navigation', { name: 'Main' })
     await waitFor(() =>
-      expect(navLink('Sessions')).toHaveAttribute('href', expect.stringContaining('preset=7d')),
+      expect(navLink('Harnesses')).toHaveAttribute('href', expect.stringContaining('preset=24h')),
     )
-    expect(navLink('Harnesses').getAttribute('href')).toContain('preset=7d')
+    // The other shared keys still cross into Sessions and TokenOps; the window doesn't.
+    expect(navLink('Sessions').getAttribute('href')).toContain('compare=false')
+    expect(navLink('Sessions').getAttribute('href')).not.toContain('preset')
+    expect(navLink('TokenOps').getAttribute('href')).not.toContain('preset')
     expect(navLink('Chat').getAttribute('href')).toBe('/chat')
     expect(navLink('Agents').getAttribute('href')).toBe('/agents')
   })
@@ -98,21 +103,19 @@ describe('sidebar items', () => {
     await screen.findByRole('navigation', { name: 'Main' })
     await userEvent.click(navLink('TokenOps'))
     await waitFor(() => expect(router.state.location.pathname).toBe('/tokenops'))
-    expect(router.state.location.search).toMatchObject({ preset: '7d' })
+    // TokenOps opens on its own 30 days, not Sessions' window.
+    expect(router.state.location.search).toMatchObject({ preset: '30d' })
     expect(router.state.location.search).not.toHaveProperty('day')
     await userEvent.click(navLink('Harnesses'))
     await waitFor(() => expect(router.state.location.pathname).toBe('/harnesses'))
-    expect(router.state.location.search).toMatchObject({ preset: '7d' })
+    expect(router.state.location.search).toMatchObject({ preset: '30d' })
   })
 
   it('shows a way back into the app on an unknown URL', async () => {
     renderApp('/no-such-page')
     await screen.findByRole('heading', { name: 'Page not found' })
+    expect(screen.getByRole('link', { name: 'Back to Overview' })).toHaveAttribute('href', '/')
     expect(screen.getByRole('link', { name: 'Go to Chat' })).toHaveAttribute('href', '/chat')
-    expect(screen.getByRole('link', { name: 'Go to TokenOps' })).toHaveAttribute(
-      'href',
-      expect.stringContaining('/tokenops'),
-    )
   })
 
   it('has no Weave fixture gallery: Weave is EE only', async () => {
@@ -154,18 +157,21 @@ describe('sidebar items', () => {
   })
 })
 
-describe('Nasiko header link', () => {
-  it('goes to Chat through the router without marking itself current', async () => {
+describe('header brand link', () => {
+  it('goes to the Overview through the router without marking itself current', async () => {
+    wide()
     const { router } = renderApp('/agents')
     await screen.findByRole('navigation', { name: 'Main' })
     const brand = sidebarBrand()
-    expect(brand).toHaveAttribute('href', '/chat')
+    expect(brand).to
```

**File**: `ui/common/src/app/shell/AppShell.tsx` (modified, +65/-49)
```diff
@@ -9,67 +9,83 @@ import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/s
 import { cn } from '@/lib/utils'
 import { AppSidebar, type NavBadges } from './AppSidebar'
 import { copy } from './copy'
+import { SidebarPanelContext } from './panelSlot'
 import { widthDefaultOpen, readSidebarCookie } from './sidebarState'
 
-/** Chat owns its own scrolling: the page fills the viewport (plan §7.1, EN20). */
-const FULL_HEIGHT = /^\/chat(\/|$)/
+/** Chat and Settings own their scrolling (their section column stays put): the page fills the viewport (plan §7.1, EN20). */
+const FULL_HEIGHT = /^\/(chat|settings)(\/|$)/
 
 /**
  * `end` and `badges` come from the `_app` route, which may import features (the shell never does): Deploy's build
  * toasts and the Builds item's in-progress count.
  */
-export function AppShell({ end, badges }: { end?: ReactNode; badges?: NavBadges } = {}) {
+export function AppShell({
+  end,
+  badges,
+  hidden,
+}: {
+  end?: ReactNode
+  badges?: NavBadges
+  /** Nav paths to leave out (onboarding hides Overview while its guide stands in for it). */
+  hidden?: readonly string[]
+} = {}) {
   const fullHeight = useRouterState({ select: (s) => FULL_HEIGHT.test(s.location.pathname) })
-  // Controlled (v1c E1): the cookie wins; with none, Chat opens the sidebar as its icon rail so the
-  // conversation gets the width (D3), and other pages use the width default. Only a user toggle sets
-  // `choice`, and the sidebar writes the cookie then, so these defaults are never stored.
+  // Controlled (v1c E1): the cookie wins; with none, the width default. Chat used to start as the icon rail so its
+  // history column fit beside the nav; its history is the sidebar's drill-in panel now, so it needs the open sidebar.
+  // Only a user toggle sets `choice`, and the sidebar writes the cookie then, so the default is never stored.
   const [choice, setChoice] = useState(readSidebarCookie)
   const [widthDefault] = useState(widthDefaultOpen)
-  const open = choice ?? (fullHeight ? false : widthDefault)
+  const open = choice ?? widthDefault
+  // The drill-in slot (sidebarPanel.ts): the sidebar hands out `target`, a page's SidebarPanel portals into it.
+  const [target, setTarget] = useState<HTMLElement | null>(null)
+  const [panels, setPanels] = useState(0)
   return (
-    <SidebarProvider
-      open={open}
-      onOpenChange={setChoice}
-      className={fullHeight ? 'h-dvh' : 'min-h-screen'}
-    >
-      {/* A button, not an `#main` link: a fragment navigation would add a history entry and make
-          the router reload the route (review: red team). */}
-      <Button
-        variant="outline"
-        size="sm"
-        onClick={() => document.getElementById('main')?.focus()}
-        className="sr-only z-50 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
-      >
-        {copy.skipToContent}
-      </Button>
-      <AppSidebar badges={badges} />
-      <SidebarInset
-        id="main"
-        tabIndex={-1}
-        className={cn('outline-none', fullHeight ? 'min-h-0' : 'mx-auto max-w-page')}
+    <SidebarPanelContext value={{ target, setTarget, panels, setPanels }}>
+      <SidebarProvider
+        open={open}
+        onOpenChange={setChoice}
+        className={fullHeight ? 'h-dvh' : 'min-h-screen'}
       >
-        {/* Phones: a slim top bar with the menu button opens the nav sheet (§4.2). */}
-        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 md:hidden">
-          <SidebarTrigger aria-label={copy.openMenu} className="size-11" />
-          <Link
-            to="/chat"
-            className="flex h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
-          >
-            <img src="/mark-nasiko.svg" alt="" aria-hidden className="size-4" />
-            {copy.brand}
-          </Link>
-        </div>
-        {fullHeight ? (
-          <div className="min-h-0 flex-1">
-            <Outlet />
-          </div>
-        ) : (
-          <div className="w-full px-4 py-4">
-            <Outlet />
+        {/* A button, not an `#main` link: a fragment navigation would add a history entry and make
+          the router reload the route (review: red team). */}
+        <Button
+          variant="outline"
+          size="sm"
+          onClick={() => document.getElementById('main')?.focus()}
+          className="sr-only z-50 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
+        >
+          {copy.skipToContent}
+        </Button>
+        <AppSidebar badges={badges} hidden={hidden} />
+        <SidebarInset
+          id="main"
+          tabIndex={-1}
+          className={cn('outline-none', fullHeight ? 'min-h-0' : 'mx-auto max-w-page')}
+        >
+          {/* Phones: a slim top bar with the menu button opens the nav sheet (§4.2). */}
+          <div 
```

**File**: `ui/common/src/app/shell/AppSidebar.tsx` (modified, +344/-77)
```diff
@@ -1,24 +1,42 @@
 /**
- * The app's left sidebar (plans/feat-app-shell.md §3–§4): the Nasiko header, the nav groups from
- * `nav.ts`, and the footer (status, theme, account, collapse). Built on shadcn's sidebar primitive.
+ * The app's left sidebar (plans/feat-app-shell.md §3–§4): the header (OpenRuntime home link, collapse), the nav groups
+ * from `nav.ts` or a page's drill-in panel (`SidebarPanel`: Chat's history, Settings' sections), and the footer
+ * (status in local builds, account; Settings opens from the account menu). Built on shadcn's sidebar primitive.
  */
 import { useQuery, useQueryClient } from '@tanstack/react-query'
 import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
 import {
-  ChevronsLeft,
-  ChevronsRight,
+  ArrowLeft,
   CircleAlert,
   CircleUser,
   LogOut,
-  KeyRound,
+  Palette,
+  PanelLeftClose,
+  PanelLeftOpen,
   RotateCw,
+  Settings,
 } from 'lucide-react'
-import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
+import {
+  use,
+  useCallback,
+  useId,
+  useEffect,
+  useLayoutEffect,
+  useRef,
+  useState,
+  type RefObject,
+} from 'react'
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
+  DropdownMenuRadioGroup,
+  DropdownMenuRadioItem,
+  DropdownMenuSeparator,
+  DropdownMenuSub,
+  DropdownMenuSubContent,
+  DropdownMenuSubTrigger,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu'
 import {
@@ -34,87 +52,237 @@ import {
   SidebarMenuItem,
   useSidebar,
 } from '@/components/ui/sidebar'
-import { deferred } from '@/app/deferred'
-import { applyNav } from '@/app/edition'
+import { applyNav, type AnyNavItem } from '@/app/edition'
 import { EditionContext } from '@/app/edition-context'
 import { meQuery } from '@/lib/api/auth'
 import { ApiError } from '@/lib/api/client'
 import { SIDEBAR_HEALTH_INTERVAL_MS, useHealth } from '@/lib/api/health'
 import { env } from '@/lib/env'
 import { cn } from '@/lib/utils'
-import { pickShared } from './context'
+import { pickShared, withoutWindow } from './context'
 import { copy } from './copy'
 import { NasikoMark } from './NasikoMark'
-import { activeItem, NAV_GROUPS, NAV_ITEMS } from './nav'
+import { activeItem, backIndex, moduleOf, NAV_GROUPS, NAV_ITEMS, pathOf } from './nav'
 import { ACTIVE_ROW, GROUP, LABEL, ROW } from './rowStyles'
 import { signOut } from './signOut'
-import { ThemeMenu } from './ThemeMenu'
-
-// Loads on first open: the shell budget has no room for the dialog and its form.
-const ChangePasswordDialog = deferred(() =>
-  import('./ChangePasswordDialog').then((m) => m.ChangePasswordDialog),
-)
+import {
+  ACCENTS,
+  setAccent,
+  setTheme,
+  THEMES,
+  useThemePrefs,
+  type Accent,
+  type Theme,
+} from './theme'
+import { SidebarPanelContext } from './panelSlot'
 
 /** How long a pending health check stays quiet before "Checking…" shows (design review 2A). */
 const CHECKING_DELAY_MS = 1_000
 
+/**
+ * The status row is for whoever runs the lab: local dev servers, and any build that serves mock data (so a demo
+ * build still says MOCK DATA). A production build against a real server leaves it out, and polls no /health.
+ */
+const SHOW_STATUS = import.meta.env.DEV || env.mode === 'mock'
+
+/** Which view takes focus after a swap between the app nav and a drill-in panel (the clicked row unmounts). */
+type FocusNext = RefObject<'menu' | 'panel' | null>
+
 /** A count on a nav item, with the words a screen reader hears after its label (the Builds item: builds in progress). */
 export type NavBadges = Partial<Record<string, { count: number; label: string }>>
 
-export function AppSidebar({ badges }: { badges?: NavBadges } = {}) {
+export function AppSidebar({
+  badges,
+  hidden,
+}: { badges?: NavBadges; hidden?: readonly string[] } = {}) {
   const pathname = useRouterState({ select: (s) => s.location.pathname })
+  const href = useRouterState({ select: (s) => s.location.href })
   const navigate = useNavigate()
-  const { setOpenMobile } = useSidebar()
+  const layers = use(EditionContext).edition.layers
+  const { setOpenMobile, isMobile, state } = useSidebar()
+  const { panels, setTarget } = use(SidebarPanelContext)
   // The phone sheet closes on navigation (§4.2).
   useEffect(() => setOpenMobile(false), [pathname, setOpenMobile])
+  // "Main menu" shows the app nav over a page's panel until the next navigation (or a click on the current item).
+  const [menu, setMenu] = useState(false)
+  const [menuPath, setMenuPath] = useState(pathname)
+  if (menuPath !== pathname) {
+    setMenuPath(pathname)
+    setMenu(false)
+  }
+  const focusNextRef = useRef<'menu' | 'panel' | null>(null)
+  // A click on the current page's item (nav or footer) brings its panel back: the path doesn't change.
+  const pick = () => {
+    if (panels > 0) focusNextRef.current = 'panel'
+    setMenu(false)
+  }
+  // The collapsed rail keeps the app nav's icons; the page then shows its 
```

**File**: `ui/common/src/app/shell/LoginShowcase.tsx` (modified, +160/-123)
```diff
@@ -1,158 +1,195 @@
-import { animate, type AnimationPlaybackControls, useReducedMotion } from 'motion/react'
-import { useEffect, useState } from 'react'
-import { Badge } from '@/components/ui/badge'
+import { useReducedMotion } from 'motion/react'
+import { useEffect, useRef, useState } from 'react'
 import { durations } from '@/lib/motion'
 import { cn } from '@/lib/utils'
 import { copy } from './copy'
 import { NasikoMark } from './NasikoMark'
 
 /**
- * The login page's showcase: our own take on Aceternity's "Login Form With Gradient" block (a Pro block, so no
- * source copied; docs/superpowers/specs/2026-09-30-aceternity-login-design.md). Decorative only: aria-hidden, CSS
- * only, still under reduced motion. Its palette is the block's (black, dark tiles, a warm glow): the `--showcase-*`
- * tokens, the same in every theme and mode. Hidden below `md`. The headline
- * is our take on Aceternity's "Text Animation Typewriter Effect" (also Pro).
+ * The login page's showcase: the user's "Nasiko Console" prototype, screen "01 Sign in" (docs/superpowers/specs/
+ * 2026-10-01-login-onboarding-design.md §1), mirrored to the left half. Aceternity's "Login Form With Gradient"
+ * colour field (our own take: blurred blobs cycling its four hues) rising from under a stack of
+ * translucent glass plates (the Nasiko mark on the top one), a floor shadow and a masked dot grid, then tab chips and a glass headline card (light glass in light mode, dark glass in dark mode)
+ * (half-black glass, the word in the brand's gold) whose word changes every 2.8 s; the lit chip and plate follow
+ * it, ringed in the theme's primary. Decorative only: aria-hidden, inert, CSS motion, still under reduced motion; the
+ * stack tilts a little with the pointer, as in the prototype. Colours are the per-mode `--showcase-*` tokens (index.css). Hidden below `md`.
  */
-const AREAS = [
-  copy.nav.chat,
-  copy.nav.agents,
-  copy.nav.router,
-  copy.nav.sessions,
-  copy.nav.tokenops,
+const WORDS = copy.login.showcaseWords
+/** Bottom plate first, as the prototype stacks them: Frameworks, Tools, Coding Harnesses, Agents on top. */
+const PLATES = [...WORDS].reverse()
+const EDGES = [
+  'var(--showcase-layer-1-edge)',
+  'var(--showcase-layer-2-edge)',
+  'var(--showcase-layer-3-edge)',
+  'var(--showcase-layer-4-edge)',
+]
+const FILLS = [
+  'var(--showcase-layer-1)',
+  'var(--showcase-layer-2)',
+  'var(--showcase-layer-3)',
+  'var(--showcase-layer-4)',
 ]
 
+/** The stack at rest, and how far the pointer tilts it (the prototype's ±8° / ±11° at the panel's edges). */
+const TILT = { x: 56, z: -38, xRange: 16, zRange: 22 }
+const tiltOf = (tx: number, ty: number) =>
+  `rotateX(${TILT.x - ty * TILT.xRange}deg) rotateZ(${TILT.z + tx * TILT.zRange}deg)`
+
 export function LoginShowcase() {
+  const reduce = useReducedMotion()
+  const panel = useRef<HTMLDivElement>(null)
+  const stack = useRef<HTMLDivElement>(null)
+  // The prototype's mouse tilt (user request 2026-10-01). The panel stays inert (pointer-events-none, aria-hidden): the
+  // page's pointer position is read from window and written straight to the stack, one frame at a time, so nothing
+  // re-renders. Outside the panel the stack eases back to rest; under reduced motion it never moves.
+  useEffect(() => {
+    if (reduce) return
+    let frame = 0
+    const onMove = (e: PointerEvent) => {
+      cancelAnimationFrame(frame)
+      frame = requestAnimationFrame(() => {
+        const box = panel.current?.getBoundingClientRect()
+        const el = stack.current
+        if (!box || !el || !box.width) return
+        const tx = (e.clientX - box.left) / box.width - 0.5
+        const ty = (e.clientY - box.top) / box.height - 0.5
+        const inside = Math.abs(tx) <= 0.5 && Math.abs(ty) <= 0.5
+        el.style.transform = inside ? tiltOf(tx, ty) : tiltOf(0, 0)
+      })
+    }
+    const onLeave = () => {
+      if (stack.current) stack.current.style.transform = tiltOf(0, 0)
+    }
+    window.addEventListener('pointermove', onMove)
+    document.documentElement.addEventListener('pointerleave', onLeave)
+    return () => {
+      cancelAnimationFrame(frame)
+      window.removeEventListener('pointermove', onMove)
+      document.documentElement.removeEventListener('pointerleave', onLeave)
+    }
+  }, [reduce])
+  const [index, setIndex] = useState(0)
+  useEffect(() => {
+    if (reduce) return
+    const t = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), durations.wordHold)
+    return () => clearInterval(t)
+  }, [reduce])
+  const active = WORDS[index] ?? WORDS[0]
   return (
     <div
       aria-hidden
+      ref={panel}
       data-testid="login-showcase"
-      className="relative hidden aspect-7/8 flex-col items-start justify-end overflow-hidden rounded-2xl bg-showcase p-8 text-showcase-foreground md:flex"
+      className="pointer-events-none relative hidden min-h-[max(680px,calc(100svh-2rem))] flex-col p-10 md:flex"
     >
-      <Tiles className
```

**File**: `ui/common/src/app/shell/NasikoMark.tsx` (modified, +65/-18)
```diff
@@ -1,3 +1,5 @@
+import { MARK_BARS } from './markBars'
+
 /**
  * The Nasiko "N" barcode mark, inline so it takes `currentColor` (public/mark-nasiko.svg, the favicon,
  * keeps the fixed yellow-600). Yellow is the logo only (§6.4): colour it with `text-logo`, which is
@@ -6,24 +8,69 @@
 export function NasikoMark({ className }: { className?: string }) {
   return (
     <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden className={className}>
-      <rect width="3.28807" height="53.743" rx="1.64403" />
-      <rect x="5.51914" width="3.28807" height="58.4455" rx="1.64403" />
-      <rect x="11.0384" width="3.28807" height="63.8199" rx="1.64403" />
-      <rect x="16.5577" width="3.28807" height="63.8199" rx="1.64403" />
-      <rect x="22.0771" width="3.28807" height="22.8408" rx="1.64403" />
-      <rect x="27.5963" width="3.28807" height="22.8408" rx="1.64403" />
-      <rect x="33.1154" width="3.28807" height="27.5433" rx="1.64403" />
-      <rect x="38.6348" width="3.28807" height="32.2458" rx="1.64403" />
-      <rect x="44.154" width="3.28807" height="22.8408" rx="1.64403" />
-      <rect x="49.5559" y="6.02707" width="3.34837" height="16.7418" rx="1.67418" />
-      <rect x="55.1927" y="10.2568" width="3.28807" height="53.743" rx="1.64403" />
-      <rect x="60.7119" y="14.8154" width="3.28807" height="49.0405" rx="1.64403" />
-      <rect x="22.3119" y="53.5633" width="3.34679" height="10.2568" rx="1.67339" />
-      <rect x="27.8901" y="53.5633" width="3.28807" height="10.0768" rx="1.64403" />
-      <rect x="33.4677" y="43.3064" width="3.34679" height="20.5136" rx="1.67339" />
-      <rect x="39.0458" y="47.865" width="3.34679" height="15.955" rx="1.67339" />
-      <rect x="44.3891" y="53.5633" width="3.34679" height="10.2568" rx="1.67339" />
-      <rect x="49.9669" y="53.5633" width="3.34679" height="10.2568" rx="1.67339" />
+      {MARK_BARS.map((b) => (
+        <rect key={`${b.x},${b.y}`} {...b} />
+      ))}
+    </svg>
+  )
+}
+
+/**
+ * The full Nasiko lockup (mark + "nasiko" wordmark), vectors from nasiko-website `Logo.jsx` (Figma node 1184:120573,
+ * 112 × 23.1994). The bars take `fill-logo`, the wordmark `currentColor`, so both follow the mode. Size it by height
+ * (`h-6 w-auto`): the width/height attributes give the aspect ratio.
+ */
+export function NasikoLockup({ className }: { className?: string }) {
+  return (
+    <svg
+      role="img"
+      aria-label="Nasiko"
+      width="112"
+      height="23.1994"
+      viewBox="0 0 112 23.1994"
+      fill="none"
+      className={className}
+    >
+      <g className="fill-logo">
+        <rect y="2.67029e-05" width="1.19109" height="19.4683" rx="0.595545" />
+        <rect x="1.99951" y="2.67029e-05" width="1.19109" height="21.1717" rx="0.595545" />
+        <rect x="3.99854" y="2.67029e-05" width="1.19109" height="23.1185" rx="0.595545" />
+        <rect x="5.99805" y="2.67029e-05" width="1.19109" height="23.1185" rx="0.595545" />
+        <rect x="7.99756" y="2.67029e-05" width="1.19109" height="8.27401" rx="0.595545" />
+        <rect x="9.99658" y="2.67029e-05" width="1.19109" height="8.27401" rx="0.595545" />
+        <rect x="11.9961" y="2.67029e-05" width="1.19109" height="9.97748" rx="0.595545" />
+        <rect x="13.9951" y="2.67029e-05" width="1.19109" height="11.681" rx="0.595545" />
+        <rect x="15.9946" y="2.67029e-05" width="1.19109" height="8.27401" rx="0.595545" />
+        <rect x="17.9512" y="2.18331" width="1.21293" height="6.06468" rx="0.606467" />
+        <rect x="19.9932" y="3.71552" width="1.19109" height="19.4683" rx="0.595545" />
+        <rect x="21.9927" y="5.36685" width="1.19109" height="17.7648" rx="0.595545" />
+        <rect x="8.08252" y="19.4032" width="1.21236" height="3.71549" rx="0.60618" />
+        <rect x="10.103" y="19.4032" width="1.19109" height="3.6503" rx="0.595545" />
+        <rect x="12.1235" y="15.6876" width="1.21236" height="7.43097" rx="0.60618" />
+        <rect x="14.144" y="17.339" width="1.21236" height="5.77965" rx="0.60618" />
+        <rect x="16.0796" y="19.4032" width="1.21236" height="3.71549" rx="0.60618" />
+        <rect x="18.1001" y="19.4032" width="1.21236" height="3.71549" rx="0.60618" />
+        <rect
+          x="29.625"
+          y="3.72285"
+          width="2.89566"
+          height="50.1217"
+          rx="1.44783"
+          transform="rotate(-90 29.625 3.72285)"
+        />
+        <rect
+          x="89.0244"
+          y="3.63166"
+          width="3.02646"
+          height="22.4262"
+          rx="1.51323"
+          transform="rotate(-90 89.0244 3.63166)"
+        />
+      </g>
+      <path
+        fill="currentColor"
+        d="M32.864 12.9254V20.9218C32.864 21.7899 32.1602 22.4937 31.2921 22.4937C30.424 22.4937 29.7202 21.7899 29.7202 20.9218V7.88747C29.7202 7.05419 30.3957 6.37868 31.229 6.37868H31.4264C32.1506 6.37868 32.7378 6.96583 32.7378 7.69012V8.88088C32.7378 8.94753 32.7918 9.00157 32.8585 9.00157C32.9065 9.00157 32.9
```

**File**: `ui/common/src/app/shell/NotFound.tsx` (modified, +72/-32)
```diff
@@ -1,45 +1,85 @@
 /**
  * The page for an unknown URL (rendered outside the shell, so it gives a way back in). Its own module, loaded on
  * demand from `__root.tsx`: the root route isn't code-split, and every page would load it otherwise.
+ *
+ * Our take on BeUI's "404 / Not Found Glitch" block (beui.dev/components/blocks/not-found, MIT): the code scrambles
+ * through glyphs on mount and settles left to right; hovering splits it into two tinted ghosts. Lab edits: theme
+ * tokens for the ghosts (multiply in light mode, screen in dark), the code is decorative and the title is the h1,
+ * and links back into the app instead of "Browse components".
  */
 import { Link } from '@tanstack/react-router'
+import { useReducedMotion } from 'motion/react'
+import { useEffect, useState } from 'react'
 import { Button } from '@/components/ui/button'
-import {
-  Empty,
-  EmptyContent,
-  EmptyDescription,
-  EmptyHeader,
-  EmptyMedia,
-  EmptyTitle,
-} from '@/components/ui/empty'
 import { copy } from './copy'
+import { NasikoMark } from './NasikoMark'
+
+const CODE = '404'
+const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$?/\\'
+const SCRAMBLE_MS = 700
+const TICK_MS = 45
+
+/** The first paint shows the real code, so the scramble is an enhancement; reduced motion never scrambles. */
+function Scramble({ text }: { text: string }) {
+  const reduce = useReducedMotion()
+  const [display, setDisplay] = useState(text)
+  useEffect(() => {
+    if (reduce) return
+    const start = performance.now()
+    let raf = 0
+    let last = 0
+    const loop = (now: number) => {
+      if (now - last >= TICK_MS) {
+        last = now
+        const settled = Math.floor(Math.min((now - start) / SCRAMBLE_MS, 1) * text.length)
+        setDisplay(
+          [...text]
+            .map((ch, i) => (i < settled ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
+            .join(''),
+        )
+      }
+      if (now - start < SCRAMBLE_MS) raf = requestAnimationFrame(loop)
+      else setDisplay(text)
+    }
+    raf = requestAnimationFrame(loop)
+    return () => cancelAnimationFrame(raf)
+  }, [text, reduce])
+  return <span className="tabular-nums">{display}</span>
+}
+
+const GHOST =
+  'pointer-events-none absolute inset-0 opacity-0 mix-blend-multiply transition-[translate,opacity] duration-150 ease-out group-hover:opacity-70 motion-reduce:hidden dark:mix-blend-screen'
 
 export function NotFound() {
   return (
-    <main className="mx-auto mt-16 max-w-sm px-4">
-      {/* The Empty parts, not EmptyState: this page's title is its h1. */}
-      <Empty className="gap-4 p-0 md:p-0">
-        <EmptyHeader className="gap-1">
-          <EmptyMedia className="mb-3">
-            <img src="/mark-nasiko.svg" alt="" aria-hidden className="size-8" />
-          </EmptyMedia>
-          <EmptyTitle>
-            <h1 className="font-semibold">{copy.notFound.title}</h1>
-          </EmptyTitle>
-          <EmptyDescription>{copy.notFound.body}</EmptyDescription>
-        </EmptyHeader>
-        <EmptyContent className="flex-row justify-center gap-2">
-          <Button asChild>
-            <Link to="/chat">{copy.notFound.toChat}</Link>
-          </Button>
-          <Button asChild variant="outline">
-            {/* TokenOps fills its own search defaults (zod .catch), as SessionTracePage links do. */}
-            <Link to="/tokenops" search={{}}>
-              {copy.notFound.toTokenops}
-            </Link>
-          </Button>
-        </EmptyContent>
-      </Empty>
+    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-16 text-center">
+      <NasikoMark className="size-7 text-logo" />
+      <div
+        aria-hidden
+        className="group relative font-mono [font-size:clamp(5rem,18vw,11rem)] leading-none font-bold tracking-tighter text-foreground select-none"
+      >
+        <span className={`${GHOST} text-destructive group-hover:translate-x-[3px]`}>
+          <Scramble text={CODE} />
+        </span>
+        <span className={`${GHOST} text-info group-hover:-translate-x-[3px]`}>
+          <Scramble text={CODE} />
+        </span>
+        <span className="relative">
+          <Scramble text={CODE} />
+        </span>
+      </div>
+      <div className="flex flex-col items-center gap-2">
+        <h1 className="text-lg font-semibold">{copy.notFound.title}</h1>
+        <p className="max-w-sm text-sm text-muted-foreground">{copy.notFound.body}</p>
+      </div>
+      <div className="flex flex-wrap justify-center gap-2">
+        <Button asChild>
+          <Link to="/">{copy.notFound.home}</Link>
+        </Button>
+        <Button asChild variant="outline">
+          <Link to="/chat">{copy.notFound.toChat}</Link>
+        </Button>
+      </div>
     </main>
   )
 }
```

---

### Incident Patch 11: `71ed9ecc` (2026-09-24)
**Commit Message**: adds: session type + maf ui improvements
[synced-from-private]

**File**: `migrations/0034_session_type.sql` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+-- =============================================================================
+-- Session type
+--
+-- `chat_sessions` holds three kinds of session that were only ever told apart
+-- by guesswork on other columns: an orchestrator-routed chat (agent_id NULL),
+-- a direct agent chat (agent_id set), and a MAF execution (also agent_id NULL,
+-- so indistinguishable from the orchestrator one — which is why MAF runs leak
+-- into the Orchestrator session list). `session_type` records it explicitly.
+--
+-- Default 'direct_chat': every writer that binds a concrete agent_id
+-- (agent_proxy, coding-agent telemetry, HITL) is a direct chat, so only the
+-- two other writers have to say anything.
+-- =============================================================================
+
+ALTER TABLE chat_sessions
+    ADD COLUMN session_type TEXT NOT NULL DEFAULT 'direct_chat'
+        CHECK (session_type IN ('orchestrator', 'direct_chat', 'maf_execution'));
+
+-- Backfill. Orchestrator sessions are the ones dispatch/HITL stamped with the
+-- orchestrator proxy path, plus older rows that bound no agent at all.
+UPDATE chat_sessions
+   SET session_type = 'orchestrator'
+ WHERE agent_url = '/api/orchestrator/a2a'
+    OR (agent_id IS NULL AND agent_url IS NULL);
+
+-- MAF runs use the execution UUID as the session id, so they are recoverable
+-- exactly; run last so it wins over the orchestrator pass above.
+UPDATE chat_sessions cs
+   SET session_type = 'maf_execution'
+  FROM maf_executions e
+ WHERE cs.session_id = e.id::text;
```

**File**: `orchestrator/src/maf/executor.rs` (modified, +2/-2)
```diff
@@ -322,8 +322,8 @@ async fn run_maf_inner(
         .filter(|d| !d.trim().is_empty())
         .unwrap_or_else(|| format!("MAF execution {execution_id}"));
     if let Err(e) = sqlx::query(
-        "INSERT INTO chat_sessions (session_id, user_id, title)
-         VALUES ($1, $2, $3)
+        "INSERT INTO chat_sessions (session_id, user_id, title, session_type)
+         VALUES ($1, $2, $3, 'maf_execution')
          ON CONFLICT (session_id) DO NOTHING",
     )
     .bind(execution_id.to_string())
```

**File**: `server/src/chat/models.rs` (modified, +4/-9)
```diff
@@ -18,6 +18,8 @@ pub struct ChatSession {
     pub agent_id: Option<Uuid>,
     pub agent_url: Option<String>,
     pub title: String,
+    /// `orchestrator` | `direct_chat` | `maf_execution` — see migration 0034.
+    pub session_type: String,
     pub created_at: DateTime<Utc>,
     pub updated_at: DateTime<Utc>,
 }
@@ -29,6 +31,8 @@ pub struct ChatSessionView {
     pub agent_id: Option<Uuid>,
     pub agent_url: Option<String>,
     pub title: String,
+    /// `orchestrator` | `direct_chat` | `maf_execution` — see migration 0034.
+    pub session_type: String,
     pub created_at: DateTime<Utc>,
     pub updated_at: DateTime<Utc>,
     pub agent_name: Option<String>,
@@ -60,11 +64,6 @@ pub struct ChatMessage {
     // carry at most duration/trace.
     pub input_tokens: Option<i32>,
     pub output_tokens: Option<i32>,
-    /// Prompt tokens served from the provider cache. Separate from `input_tokens`, which
-    /// carries only the fresh portion — a chip that sums input+output alone under-reports
-    /// the prompt by whatever the cache served (migration 041).
-    pub cache_read_tokens: Option<i32>,
-    pub cache_creation_tokens: Option<i32>,
     pub model: Option<String>,
     pub duration_ms: Option<i32>,
     pub cost_usd: Option<rust_decimal::Decimal>,
@@ -135,10 +134,6 @@ pub struct SendMessage {
 pub struct MessageUsage {
     pub input_tokens: Option<i32>,
     pub output_tokens: Option<i32>,
-    #[serde(default)]
-    pub cache_read_tokens: Option<i32>,
-    #[serde(default)]
-    pub cache_creation_tokens: Option<i32>,
     pub model: Option<String>,
     pub duration_ms: Option<i32>,
     pub cost_usd: Option<rust_decimal::Decimal>,
```

**File**: `server/src/chat/routes.rs` (modified, +61/-124)
```diff
@@ -81,61 +81,24 @@ struct ListSessionsParams {
     limit: i64,
     cursor: Option<String>,
     agent_id: Option<Uuid>,
-    /// An embedded surface — a feature with its own chat history menu — keeps
-    /// its sessions in this same table, namespaced as `<surface>_<contextId>`.
-    /// Those chats belong to that surface's menu, not the Sessions list, the
-    /// Orchestrator nav tree or `nasiko sessions`, so the general list leaves
-    /// them out and a surface asks for its own by name (`?surface=<name>`).
-    ///
-    /// Which surfaces exist is the edition's business, not this module's, so
-    /// "namespaced" has to be decidable here without knowing any surface's
-    /// name. An underscore alone does not decide it: a session the platform
-    /// mints carries the reserved [`PLATFORM_SESSION_PREFIX`], which is
-    /// therefore excluded from the namespace test rather than read as a
-    /// surface called "ses".
-    surface: Option<String>,
-}
-
-/// Prefix on every session id the platform mints itself — here in
-/// `create_session` and in `agent_proxy` for a message that arrives with no
-/// contextId. It is not a surface: these are the ordinary sessions the general
-/// list exists to show.
-const PLATFORM_SESSION_PREFIX: &str = "ses";
-
-/// A surface name is a path-safe slug and nothing else. Validating rather
-/// than escaping keeps the `LIKE` pattern below free of anything a caller
-/// could turn into a wildcard, and the name is bound as a parameter besides.
-/// The platform's own prefix is refused so no surface can claim it.
-fn valid_surface(name: &str) -> bool {
-    !name.is_empty()
-        && name.len() <= 32
-        && name != PLATFORM_SESSION_PREFIX
-        && name
-            .chars()
-            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
+    /// Weave dock chats live in this same table under a `weave_`-prefixed
+    /// session id, but they belong to the dock's own history menu — not the
+    /// Sessions list, the Orchestrator nav tree or `nasiko sessions`. They are
+    /// excluded unless asked for by name.
+    #[serde(default)]
+    weave: bool,
 }
 fn default_session_limit() -> i64 {
     50
 }
 
 /// Fixed predicate appended to each keyset variant's `WHERE`. `\_` escapes the
-/// `_` so `LIKE` matches the namespace separator literally rather than any
-/// single character.
-///
-/// Asking for a surface matches its prefix, which arrives as `$1`; asking for
-/// nothing returns the general list, which is every session no surface has
-/// claimed — including the platform's own `ses_*` ids, which are not a
-/// namespace. No caller input is interpolated either way; the only value in
-/// the text is this module's own constant.
-fn surface_predicate(surface: Option<&str>, bind: usize) -> String {
-    match surface {
-        // Appended after each variant's own binds, so the four keyset
-        // numberings below are untouched. Placeholder order in the text does
-        // not have to match their order in the statement.
-        Some(_) => format!(r"AND cs.session_id LIKE ${bind} || '\_%'"),
-        None => format!(
-            r"AND (cs.session_id NOT LIKE '%\_%' OR cs.session_id LIKE '{PLATFORM_SESSION_PREFIX}\_%')"
-        ),
+/// `_` so `LIKE` matches the literal prefix, not any single character.
+fn weave_predicate(weave: bool) -> &'static str {
+    if weave {
+        r"AND cs.session_id LIKE 'weave\_%'"
+    } else {
+        r"AND cs.session_id NOT LIKE 'weave\_%'"
     }
 }
 
@@ -178,9 +141,7 @@ const SESSION_LIST_SELECT: &str = r#"
                -- migration 041) and a genuine 0 stays 0. `NULLIF(SUM(...), 0)`
                -- would conflate those two, since SUM over all-NULL columns
                -- coalesces to 0.
-               SUM(COALESCE(m.input_tokens, 0) + COALESCE(m.output_tokens, 0)
-                   + COALESCE(m.cache_read_tokens, 0)
-                   + COALESCE(m.cache_creation_tokens, 0))
+               SUM(COALESCE(m.input_tokens, 0) + COALESCE(m.output_tokens, 0))
                    FILTER (
                        WHERE m.input_tokens IS NOT NULL OR m.output_tokens IS NOT NULL
                    ) AS total_tokens,
@@ -208,97 +169,67 @@ async fn list_sessions(
 
     // Decode cursor into (timestamp, session_id) keyset anchor.
     let cursor_anchor = params.cursor.as_deref().and_then(decode_cursor);
-
-    let surface = match params.surface.as_deref().map(str::trim) {
-        // `Some("")`, not a guard: clippy::redundant_guards, and the literal
-        // says the same thing in fewer moving parts. `str::trim` above means an
-        // all-whitespace value arrives here as the empty string too.
-        Some("") => None,
-        Some(name) if !valid_surface(name) => {
-            return (
-                StatusCode::BAD_REQUEST,
-                "surface must be a lowercase slug (a-z, 0-9, -)",
-            )
-                .into_response();
-        }
-        other => other,
-    };
+
```

**File**: `server/src/hitl/mod.rs` (modified, +45/-138)
```diff
@@ -33,21 +33,12 @@ const MAX_RESUME_ATTEMPTS: i32 = 5;
 const RETRYABLE: FailureKind = FailureKind::Retryable {
     max_attempts: MAX_RESUME_ATTEMPTS,
 };
-/// `deliver()`'s own agent request timeout — see `build_req`'s doc comment below. The claim
-/// lease (`lease_secs`) must always exceed this by a safety margin, or a slow-but-healthy agent
-/// turn lets a second replica steal the lease mid-delivery and re-send the human's answer a
-/// second time, double-executing whatever the agent does with it.
-const AGENT_RESUME_REQUEST_TIMEOUT_SECS: i64 = 300;
 /// How long a claim is honored before another dispatcher process may steal it (§3.2's exact
-/// claim query, implemented in `HitlStore::claim_for_resume`). Sourced from the same
-/// `HITL_RESUME_LEASE_MINUTES` knob the sibling `mcp_tool` dispatcher uses
-/// (`nasiko_hitl::dispatcher::DispatcherConfig::effective_lease_minutes`) — this dispatcher
-/// claims exactly once per delivery attempt (unlike that one, which holds a single claim across
-/// its own in-process retry loop), so the floor here only needs to clear one request's timeout
-/// plus margin, not the sum of every retry.
-fn lease_secs(config: &nasiko_config::Config) -> i64 {
-    (config.hitl_resume_lease_minutes * 60).max(AGENT_RESUME_REQUEST_TIMEOUT_SECS + 60)
-}
+/// claim query, implemented in `HitlStore::claim_for_resume`). Must exceed the longest delivery
+/// can legitimately take — `deliver()`'s own agent request timeout is 300s — or a slow-but-healthy
+/// agent turn lets a second replica steal the lease mid-delivery and re-send the human's answer
+/// a second time, double-executing whatever the agent does with it.
+const LEASE_SECS: i64 = 360;
 /// Concurrent in-flight deliveries, mirroring `build_worker::run`'s own `tasks` cap on the same
 /// claim/spawn shape. `deliver()` can drive an entire ReAct turn for an `orchestrator`-origin row
 /// (tens of seconds), so awaiting each claimed row before claiming the next — as the drain loop
@@ -94,7 +85,6 @@ pub async fn run(state: AppState, mut notify: mpsc::Receiver<()>) {
     // Tracks in-flight `deliver()` calls across poll cycles so a slow delivery never blocks
     // claiming (or delivering) everything else — see `MAX_CONCURRENT_DELIVERIES`'s doc comment.
     let mut deliveries: tokio::task::JoinSet<()> = tokio::task::JoinSet::new();
-    let lease_secs = lease_secs(&state.config);
     loop {
         tokio::select! {
             msg = notify.recv() => {
@@ -119,7 +109,7 @@ pub async fn run(state: AppState, mut notify: mpsc::Receiver<()>) {
         // every other in-flight one, so a panicking or merely slow delivery can't take the
         // dispatcher down or stall the rest of the queue.
         while deliveries.len() < MAX_CONCURRENT_DELIVERIES {
-            let claimed = match state.hitl_store.claim_for_resume(lease_secs).await {
+            let claimed = match state.hitl_store.claim_for_resume(LEASE_SECS).await {
                 Ok(Some(row)) => row,
                 Ok(None) => break,
                 Err(e) => {
@@ -156,39 +146,6 @@ async fn deliver(state: AppState, row: HitlRequest) {
     // calling `watch()`, so that ambiguity never actually reaches a client.
     let continuation = ContinuationGuard::new(state.continuation_events.clone(), row.id);
 
-    // If this row mirrors a real `mcp_tool` pause (`question.metadata.hitl_request_id` — set
-    // when an agent maps an MCP-gateway-detected auth_required/tool_approval onto its own A2A
-    // pause, e.g. a `create_issue_via_connector`-style escalation), alias that id onto this
-    // row's own buffer too. A reconnecting client uses whichever id `resolve_display_row`
-    // showed it — the *real* mcp_tool row's id — but `deliver()` only ever runs on *this* row;
-    // without this, that reconnect finds no buffer at all. Doing it here, unconditionally,
-    // covers both ways the mcp_tool row can get resolved: the manual `/resolve` endpoint
-    // (`router/hitl.rs::auto_resolve_linked_direct_chat_row` already aliases there too — a
-    // harmless redundant alias in that case, just earlier) and Nasiko's own OAuth-callback
-    // auto-resolve (`oss/hitl/src/repo.rs::resolve_linked_direct_chat_mirror`), which runs
-    // inside `nasiko-mcp-gateway` with no access to `continuation_events` at all and could
-    // never alias anything itself — that path previously left this row correctly resolved
-    // (the agent really does resume) but permanently unreconnectable.
-    if let Some(mcp_row_id) = row
-        .question
-        .pointer("/metadata/hitl_request_id")
-        .and_then(|v| v.as_str())
-        .and_then(|s| Uuid::parse_str(s).ok())
-    {
-        // Same guard `resolve_display_row` (`oss/hitl/src/store.rs`) applies before trusting this
-        // same agent-controlled pointer — `row.question` is an untrusted A2A response echoed
-        // straight from the agent, so without this an agent can stamp any UUID here and alias
-        // ano
```

**File**: `server/src/router/a2a_dispatch.rs` (modified, +102/-243)
```diff
@@ -21,14 +21,14 @@ use nasiko_react_agent::{
 };
 use nasiko_types::a2a::{self as a2a, JsonRpcRequest, PartContent, StreamResponse};
 
-use nasiko_orchestrator::{AgentSelector, ContextTiers, context_selection};
+use nasiko_orchestrator::{AgentSelector, SessionHistory};
 
 use nasiko_flow::FlowContext;
 
 use crate::acl::CpCallGuard;
 use crate::auth::Claims;
-use crate::orchestrator_policy::TurnKind;
 use crate::state::AppState;
+use crate::usage::TokenUsageBuilder;
 
 /// Doc-only stand-in for the real request type (`nasiko_types::a2a::JsonRpcRequest`,
 /// re-exported from the external `a2a-lf` crate, which has no `ToSchema` impl and
@@ -208,16 +208,7 @@ pub async fn a2a_dispatch_handler(
     // multi-turn chats keep their history either way. An unknown id simply
     // fetches zero rows.
     let history_sid = session_id.as_deref().unwrap_or(&context_id);
-    let history_store = state.history_vector_store();
-    let history = context_selection::fetch_for_user(
-        &state.db,
-        user_id,
-        history_sid,
-        &history_store,
-        &text,
-        &ContextTiers::from_config(&state.config),
-    )
-    .await;
+    let history = SessionHistory::fetch(history_sid, &state.db, 20).await;
 
     let query = history.with_current_query(&text);
 
@@ -234,7 +225,6 @@ pub async fn a2a_dispatch_handler(
                 client_owns_transcript: session_id.is_some(),
                 transcript_role: "user",
                 file_parts: vec![],
-                kind: TurnKind::User,
             },
         )
         .await
@@ -254,33 +244,15 @@ pub async fn a2a_dispatch_handler(
         if !crate::acl::can_access_agent(&state, &claims, agent.id).await {
             return Err(A2aDispatchError::AgentNotFound(target.to_string()));
         }
-        // Supplemental context for this one, already-chosen agent, ranked against the real
-        // query text (in addition to any pinned content) — a no-op on OSS. Kept in a separate
-        // `outbound_query` local, distinct from `query`: `agent_stream` persists/traces `query`
-        // verbatim (`flows.title`, `gen_ai.input.messages`) and must never record injected
-        // context as if the user had typed it — see `crate::prompt_context` module docs.
-        // Same "## Known facts" framing the routed path uses (below) so the agent can tell
-        // injected admin knowledge apart from the user's own message by structure, not just by
-        // reading closely — consistent provenance cues on both injection paths.
-        let outbound_query = match state
-            .prompt_context
-            .context_for_agent(agent.id, &query)
-            .await
-        {
-            Some(context) => format!("## Known facts about this agent\n{context}\n\n{query}"),
-            None => query.clone(),
-        };
         agent_stream(
             &state,
             agent,
             &query,
-            &outbound_query,
             &task_id,
             &context_id,
             user_id,
             &[],
             session_id,
-            history.user_turn_count(),
         )
         .await
     }
@@ -405,10 +377,6 @@ pub(crate) struct OrchestratorTurn<'a> {
     pub(crate) transcript_role: &'a str,
     /// File parts uploaded with the request (multipart upload path).
     pub(crate) file_parts: Vec<nasiko_types::a2a::Part>,
-    /// Whether this turn was started by the user or reports on work an earlier
-    /// turn already did. The operator's policy may treat the two differently —
-    /// see [`TurnKind`].
-    pub(crate) kind: TurnKind,
 }
 
 pub(crate) async fn orchestrator_stream(
@@ -425,7 +393,6 @@ pub(crate) async fn orchestrator_stream(
         client_owns_transcript,
         transcript_role,
         file_parts,
-        kind,
     } = turn;
     // Orchestrator-routed chats never had a `chat_sessions` row, unlike
     // `agent_proxy.rs`'s `ensure_chat_session` for direct agent chat — so
@@ -509,55 +476,6 @@ pub(crate) async fn orchestrator_stream(
         return Err(A2aDispatchError::NoAgents);
     }
 
-    // The operator's policy, resolved fresh per turn so a settings change takes
-    // effect without a restart. `None` on a deployment with no policy to apply,
-    // which is what the open-source source always returns.
-    let policy = state.orchestrator_policy.chat_policy(&state.db, kind).await;
-    // Supplemental per-agent context (e.g. admin-authored knowledge), gathered before the LLM
-    // has chosen anything — ranked against `query` (the same text about to reach the LLM) in
-    // addition to any pinned content, folded into the preamble next to each candidate's own
-    // listing so the planner can answer a zero-leg question ("how many leave days do I get")
-    // directly, or route with that context already in hand. A no-op on OSS
-    // (`NoopPromptContextProvider`); see `crate::prompt_context`.
-    //
-    // Known scope limit (v1, deliberate): this only reaches the *planner's own* preamb
```

**File**: `ui/common/design-system/app-card/app-card.js` (added, +338/-0)
```diff
@@ -0,0 +1,338 @@
+/**
+ * `<app-card>` — THE card component. There is deliberately only one.
+ *
+ * Its design and implementation come from the card agents-page used to build
+ * inline in `#agents-grid` — that is the card the design system standardises on.
+ * An earlier, separate card component (a `NasikoCard` port with a left accent bar
+ * and its own error/setting-up variants) was replaced by this one, and its single
+ * consumer, your-agents-page, moved over: that accent bar became this card's
+ * status dot. Two card components meant two designs drifting apart; there is now
+ * one, and every card in the application should use it.
+ *
+ * The host element IS the card: its surface (border, radius, brand wash,
+ * shadow, hover lift) comes from the shared `.card` rules in
+ * `common/styles/surface.css`, which lists `app-card` by name — the same
+ * way every other card in the product draws its surface. Only this card's
+ * layout lives in the sibling sheet. Tag chips are `<app-tag size="sm">`
+ * instances; the card's own fill for them is set once as `--tag-bg` on
+ * `.card-tags` in the sibling sheet.
+ *
+ * Presentational only: it takes attributes and emits navigation. It fetches
+ * nothing and knows no services, so it stays inside the design-system layer.
+ *
+ * @element app-card
+ * @attr {string} agent-id - Agent UUID. Drives the default hrefs and is echoed on the host.
+ * @attr {string} name - Display name (required). `card-title` is accepted as an
+ *   alias, because `title` is a reserved global attribute and the replaced
+ *   card used that spelling — kept so call sites did not all have to change.
+ * @attr {string} card-title - Alias for `name`, kept for the replaced card's call sites.
+ * @attr {string} version - Rendered after the name; a leading "v" is added if absent
+ * @attr {string} status - `running` | `error`/`failed` | `deploying`/`starting` | anything else → stopped
+ * @attr {string} description - Body copy, clamped to exactly two lines
+ * @attr {string} tags - JSON array, either of strings (`["a","b"]`) or of
+ *   `{ label }` objects, which is the form the replaced card took.
+ * @attr {string} href - Where the whole card navigates. Defaults to the details href.
+ * @attr {string} error-title - Shown in place of the description when status is error/failed
+ * @attr {string} error-body - Supporting line for the error state
+ * @attr {string} deploy-label - Overrides the deploying headline (default "Agent is being deployed...")
+ * @attr {string} deploy-hint - Overrides the deploying hint line
+ * @attr {number} max-visible-tags - Chips shown before the "+N" overflow chip (default 2)
+ * @attr {string} details-href - Overrides the default `/agent-card?id=…`
+ * @attr {string} chat-href - Overrides the default `/chat?agent_id=…&agent_name=…`
+ * @attr {boolean} loading - Renders the shimmer placeholder instead of content. The
+ *   skeleton lives here, not in the consuming page, so the card's geometry has exactly
+ *   one definition and the loading and loaded states cannot drift apart.
+ * (The attribute below was added after the catalog first shipped and sits last
+ *  on purpose: the DSL passes attributes positionally in @attr order, so a new
+ *  one must append — see catalog-compat.mjs.)
+ * @attr {string} error - *We* could not load this card's data — distinct from
+ *   `status="error"`, which means the agent itself is unhealthy and the card
+ *   loaded fine. Two different facts that happened to want a similar look, and
+ *   only the second was expressible. Present (bare, or with a message
+ *   overriding the default copy) replaces the whole card body with the shared
+ *   failure block — icon, one line, Retry. `loading` wins over it.
+ * @slot [data-slot="leading"] - A media box (an avatar, a provider glyph) at the leading edge
+ *   of the title row, before the status dot.
+ * @slot [data-slot="actions"] - Header controls (an action menu, an icon button) pinned to the
+ *   trailing edge of the title row.
+ * @slot [data-slot="meta"] - Replaces the `tags` chip row with the consumer's own meta
+ *   elements (e.g. colored `<app-badge>`s), in the same position
+ * @slot [data-slot="body"] - Replaces the description/error/deploying body with the consumer's
+ *   own content, for cards whose middle is not a paragraph (the LLM-router
+ *   config card's tier rows, say).
+ * @slot [data-slot="footer"] - Replaces the default Details/Chat pair (two `<app-button>`s) with the consumer's own
+ *   actions (lifecycle buttons, a logs link). Captured once and cached: render()
+ *   relocates these nodes and then rewrites innerHTML, so re-querying for them
+ *   on a later render would find nothing and silently destroy them.
+ *   Slotted nodes are captured once and cached: render() relocates them and then
+ *   rewrites innerHTML, so re-querying on a later render would find nothing.
+ * @fires card-retry - Retry pressed on the `error` state — bubbles. The card is
+ *        
```

**File**: `ui/common/design-system/catalog.json` (modified, +4/-0)
```diff
@@ -509,6 +509,10 @@
           "name": "actions",
           "attribute": "data-slot"
         },
+        {
+          "name": "meta",
+          "attribute": "data-slot"
+        },
         {
           "name": "body",
           "attribute": "data-slot"
```

---

### Incident Patch 12: `19051c8e` (2026-09-23)
**Commit Message**: fix(maf): show what the human answered once the run has moved on

A finished run showed the workflow acting on an answer nobody could see.
The answer is persisted in exactly one place, `hitl_requests.human_response`,
and three filters threw it away before it could reach the screen: the
executions page fetched HITL rows only for runs at `awaiting_human`, that
fetch kept only `status === 'pending'` and evicted its cache the moment a run
stopped waiting, and the timeline filtered to pending a second time. A fourth
made the rest moot — the well a card mounts into was rendered only for
`awaiting_human`/`stopped` steps, so a completed run had nowhere to put an
answer even if one had survived.

The rows now ride on the execution list itself. `HitlStore` gains
`list_for_maf_executions`, one `= ANY($1)` query for a whole page, and both
list endpoints carry `hitl` per run through a now-generic
`ExecWithHitlResponse<T>`. Both are capped at 50 rows, so this is one extra
query per request rather than one per row, and the flatten keeps every
existing field byte-identical. The design note that argued against this
assumed a per-row query; a batched one costs the same whatever the page size,
and a 

**File**: `hitl/src/store.rs` (modified, +61/-103)
```diff
@@ -1,3 +1,5 @@
+use std::collections::HashMap;
+
 use async_trait::async_trait;
 use chrono::{DateTime, Utc};
 use serde_json::Value;
@@ -92,6 +94,28 @@ pub trait HitlStore: Send + Sync {
         maf_execution_id: Uuid,
         owner_user_id: Uuid,
     ) -> Result<Vec<HitlRequest>, HitlError>;
+    /// The same rows as [`HitlStore::list_for_maf_execution`], for a whole page of executions at
+    /// once, keyed by `maf_execution_id` — the discovery path for the two execution *list*
+    /// endpoints, which would otherwise issue one query per row. `owner_user_id` carries the same
+    /// requirement as the single-execution method: it must be the value the caller already
+    /// validated against `maf_executions.user_id`.
+    ///
+    /// The default implementation loops, which is correct but issues one query per id; a real
+    /// store overrides it with a single batched query.
+    async fn list_for_maf_executions(
+        &self,
+        maf_execution_ids: &[Uuid],
+        owner_user_id: Uuid,
+    ) -> Result<HashMap<Uuid, Vec<HitlRequest>>, HitlError> {
+        let mut out: HashMap<Uuid, Vec<HitlRequest>> = HashMap::new();
+        for id in maf_execution_ids {
+            let rows = self.list_for_maf_execution(*id, owner_user_id).await?;
+            if !rows.is_empty() {
+                out.insert(*id, rows);
+            }
+        }
+        Ok(out)
+    }
     /// The exact `UPDATE ... WHERE status = 'pending' RETURNING *` from §5. `status` is the
     /// human's decision (`Resolved` or, for future `tool_approval` rejects, `Rejected`).
     async fn resolve(
@@ -216,7 +240,12 @@ pub async fn resolve_display_row(
         return row.clone();
     };
     match store.get(linked_id).await {
-        Ok(Some(linked)) if is_valid_mcp_mirror_link(&linked, caller_owner_id, row.agent_id) => {
+        Ok(Some(linked))
+            if linked.owner_user_id == caller_owner_id
+                && linked.origin == HitlOrigin::McpTool
+                && linked.status == HitlStatus::Pending
+                && linked.agent_id == row.agent_id =>
+        {
             HitlRequest {
                 id: linked.id,
                 kind: linked.kind,
@@ -228,24 +257,6 @@ pub async fn resolve_display_row(
     }
 }
 
-/// Whether `linked` — a row fetched by an agent-controlled `hitl_request_id` pointer embedded in
-/// someone else's `question` — is safe to treat as the real `mcp_tool` pause that pointer claims
-/// to identify. `question`/its `metadata` is an untrusted A2A response echoed straight from the
-/// agent, so an agent can stamp *any* UUID there; without this check, that UUID would resolve
-/// straight to another user's row (the #383 mirror-hijack family). All four conditions are
-/// load-bearing: owner scopes it to the same human, `origin == McpTool` and `status == Pending`
-/// confirm it's genuinely the live MCP-gateway pause (not some other, already-settled, or
-/// wrong-kind row that merely shares an id), and `agent_id` ties it to the same deployment that
-/// raised `row`. Shared by every site that dereferences this pointer — currently
-/// [`resolve_display_row`] (UI display) and `oss/server/src/hitl/mod.rs::deliver`'s continuation-
-/// buffer aliasing — so there is exactly one place this predicate can drift from correct.
-pub fn is_valid_mcp_mirror_link(linked: &HitlRequest, owner_user_id: Uuid, agent_id: Uuid) -> bool {
-    linked.owner_user_id == owner_user_id
-        && linked.origin == HitlOrigin::McpTool
-        && linked.status == HitlStatus::Pending
-        && linked.agent_id == agent_id
-}
-
 /// Mirrors the `hitl_requests` table with plain column types (`String` for the four CHECK-backed
 /// enum columns) rather than deriving `sqlx::FromRow` directly on [`HitlRequest`] — this crate has
 /// no custom `sqlx::Type`/`Decode` impls for its enums (the wire/DB format is `TEXT`, not a native
@@ -536,29 +547,9 @@ impl HitlStore for PgHitlStore {
         // generous cap for what is, per row, one human decision in one conversation — the inner
         // query takes the most recent 200 by `created_at`, then the outer re-sorts them oldest
         // first to preserve this method's documented ordering.
-        //
-        // `chat_session_id` (the column) is only ever populated for an `Orchestrator`-origin row
-        // — the stable top-level session a sub-agent dispatch was mirrored under; its `context_id`
-        // is that sub-agent's own unstable per-dispatch context, never a real session, and must
-        // never be treated as one. `AgentProxy`/`DirectChat`-origin rows never set
-        // `chat_session_id` at all; for those, `context_id` already IS the stable, caller-facing
-        // session id (no separate orchestrator-level session to distinguish it from — same
-        // reasoning as `oss/server/src/hitl/mod.rs::stable_session_id`). Matching only the
-        // `chat_session_id` column here meant this query returned empty for *every* direct-chat
-       
```

**File**: `server/src/maf.rs` (modified, +159/-34)
```diff
@@ -229,17 +229,22 @@ struct ExecResponse {
     created_at: DateTime<Utc>,
 }
 
-/// `GET /maf/workflow/result/{exec_id}` and `GET /maf/execution/{id}` only — additive on top of
-/// `ExecResponse` (`#[serde(flatten)]` keeps every existing field byte-identical). `hitl` is how
-/// the frontend recovers a paused step's `hitl_requests.id` directly from the execution it's
-/// already polling — see `hitl_rows_for_execution` — so it never has to call
-/// `GET /api/hitl/pending` to correlate a MAF pause. Not added to `ExecResponse` itself: doing so
-/// would also touch `list_executions`/`list_all_executions`, which return many rows at once and
-/// have no comparable "resume this one" use case to justify an extra query per row.
+/// Additive on top of whichever execution shape the endpoint already returned —
+/// `#[serde(flatten)]` keeps every existing field byte-identical. `hitl` is how the frontend
+/// recovers a paused step's `hitl_requests.id` directly from the execution it's already polling,
+/// so it never has to call `GET /api/hitl/pending` to correlate a MAF pause — and, once the run
+/// has moved on, how it shows what the human actually answered.
+///
+/// Generic over the inner exec because all four execution endpoints carry it: the two
+/// single-execution ones over `ExecResponse`, and the two list ones over `ExecResponse` /
+/// `ExecWithWorkflowResponse`. The lists earn it despite returning many rows at once: a decided
+/// row is the only record of a human's answer, and without it a finished run showed the workflow
+/// acting on an answer nobody could see. They pay one batched query for the whole page
+/// (`HitlStore::list_for_maf_executions`), not one per row.
 #[derive(Serialize)]
-struct ExecWithHitlResponse {
+struct ExecWithHitlResponse<T> {
     #[serde(flatten)]
-    exec: ExecResponse,
+    exec: T,
     /// Every HITL tied to this execution, pending or already resolved — oldest first, same shape
     /// `GET /api/hitl/{id}` returns. At most one entry is ever `status: "pending"` at a time
     /// (MAF steps run strictly sequentially); the rest are historical audit records.
@@ -277,6 +282,39 @@ async fn hitl_rows_for_execution(
     Ok(hitl)
 }
 
+/// The same rows as `hitl_rows_for_execution`, for a whole page of executions — one batched query
+/// instead of one per row, so the two list endpoints can carry a run's HITL history without their
+/// cost growing with the page size.
+///
+/// Returns a map keyed by execution id; an execution that never paused is simply absent, and the
+/// caller renders it as the empty list it already was. Like the single-execution helper, a lookup
+/// failure is a real 500 rather than a silent empty map — a list that quietly forgets every
+/// human answer is worse than one that says it could not be read.
+async fn hitl_rows_for_executions(
+    hitl_store: &std::sync::Arc<dyn nasiko_hitl::HitlStore>,
+    execution_ids: &[Uuid],
+    owner_user_id: Uuid,
+) -> Result<std::collections::HashMap<Uuid, Vec<serde_json::Value>>, nasiko_hitl::HitlError> {
+    let by_exec = hitl_store
+        .list_for_maf_executions(execution_ids, owner_user_id)
+        .await?;
+
+    let mut out = std::collections::HashMap::with_capacity(by_exec.len());
+    for (exec_id, rows) in by_exec {
+        // Same `resolve_display_row` pass the single-execution helper documents — a `maf`-origin
+        // mirror of a real `mcp_tool` block must show the real row's question, not its own
+        // placeholder.
+        let mut hitl = Vec::with_capacity(rows.len());
+        for row in &rows {
+            let display =
+                nasiko_hitl::resolve_display_row(hitl_store.as_ref(), row, owner_user_id).await;
+            hitl.push(crate::router::hitl::to_response(&display));
+        }
+        out.insert(exec_id, hitl);
+    }
+    Ok(out)
+}
+
 fn maf_row_to_response(row: MafRow) -> MafResponse {
     let maf_json = serde_json::from_str(&row.maf_json).unwrap_or(serde_json::Value::Null);
     MafResponse {
@@ -1835,17 +1873,32 @@ async fn list_executions(
     .fetch_all(&state.db)
     .await;
 
-    match rows {
-        Ok(data) => {
-            let items: Vec<ExecResponse> = data.into_iter().map(exec_row_to_response).collect();
-            ok_json(
-                StatusCode::OK,
-                crate::Paginated::new(items),
-                "Executions retrieved successfully",
-            )
-        }
-        Err(e) => internal_err(e),
-    }
+    let data = match rows {
+        Ok(data) => data,
+        Err(e) => return internal_err(e),
+    };
+
+    let exec_ids: Vec<Uuid> = data.iter().map(|r| r.id).collect();
+    let mut by_exec = match hitl_rows_for_executions(&state.hitl_store, &exec_ids, user_id).await {
+        Ok(map) => map,
+        Err(e) => return internal_err(e),
+    };
+
+    let items: Vec<ExecWithHitlResponse<ExecResponse>> = data
+        .into_iter()
+        .map(|row| {
+            let hitl = by_exec.remove(&row.id).unwrap_o
```

**File**: `ui/common/features/wf-run-steps.js` (modified, +125/-36)
```diff
@@ -12,11 +12,15 @@
  * @prop {number} totalTokens - The execution's `tokens_used`. Optional; when
  *       given, a trailing row accounts for the difference between it and the
  *       steps, so the column adds up (see `#runLevelRow`).
- * @prop {Array} hitl - Pending `hitl_requests` rows for this execution, as
- *       `GET /api/maf/execution/{id}` returns them alongside the exec. Each is
- *       mounted as an `<hitl-card>` in the step it paused — the timeline is the
- *       only thing that knows which step that is, so the correlation lives here
- *       rather than in each page that shows a run.
+ * @prop {Array} hitl - The `hitl_requests` rows for this execution, pending and
+ *       already decided, as the execution endpoints return them alongside the
+ *       exec. Each is mounted as an `<hitl-card>` in the step it paused — the
+ *       timeline is the only thing that knows which step that is, so the
+ *       correlation lives here rather than in each page that shows a run.
+ *       Decided rows render as the card's receipt: what was asked, and what the
+ *       human answered. They are kept because the answer is the only record of
+ *       a human's part in the run — dropping them left a finished run showing
+ *       the workflow acting on an answer nobody could see.
  */
 import { icons } from '/common/utils/icons.js';
 import '/common/features/hitl-card.js';
@@ -62,6 +66,7 @@ class WfRunSteps extends HTMLElement {
   #labels = {};
   #totalTokens = 0;
   #hitl = [];
+  #hitlKey = '';
   /** hitl row id → the card on screen for it, so a mount pass that finds one
    *  already in place leaves it alone. */
   #cards = new Map();
@@ -100,52 +105,122 @@ class WfRunSteps extends HTMLElement {
     this.#render();
   }
 
+  /**
+   * Every row, pending and decided — a decided one is history the run needs to
+   * keep showing. A step gains or loses its well as rows arrive for it, so this
+   * re-renders when the set of steps carrying rows changes; otherwise it only
+   * mounts, because a re-render under a card being answered kills it (see
+   * `steps`).
+   */
   set hitl(value) {
-    this.#hitl = Array.isArray(value) ? value.filter((r) => r.status === 'pending') : [];
+    const next = Array.isArray(value) ? value.filter(Boolean) : [];
+    const key = next.map((r) => `${r.id}:${r.status}`).join(',');
+    if (key === this.#hitlKey) return;
+    const hadWells = this.#stepsWithHitl();
+    this.#hitlKey = key;
+    this.#hitl = next;
+    // A row for a step that has no well yet (every decided row on a finished
+    // run) needs the timeline rebuilt before it has anywhere to go.
+    const needsWells = this.#stepsWithHitl();
+    if (needsWells.size !== hadWells.size || [...needsWells].some((at) => !hadWells.has(at))) {
+      this.#render();
+      return;
+    }
     this.#mountHitl();
   }
 
+  /** The step indices that currently carry at least one HITL row. */
+  #stepsWithHitl() {
+    const out = new Set();
+    for (const [at] of this.#groupHitl()) out.add(at);
+    return out;
+  }
+
+  /**
+   * Rows grouped by the step they belong to, in the order the server sent them
+   * (oldest first) — the well then reads as history with the live prompt, if
+   * there still is one, at the bottom.
+   */
+  #groupHitl() {
+    const byStep = new Map();
+    for (const row of this.#hitl) {
+      // A row with no step index belongs to whichever step is paused — there is
+      // only ever one, and stranding the card is worse than inferring it.
+      const at = row.execution?.maf_step_index
+        ?? this.#steps.find((st) => st.status === 'awaiting_human')?.step_index;
+      if (at == null) continue;
+      byStep.set(at, [...(byStep.get(at) || []), row]);
+    }
+    return byStep;
+  }
+
   connectedCallback() {
     this.addEventListener('click', this.#onClick);
     this.#render();
   }
 
   /**
-   * Put each waiting card in the step that is waiting.
+   * Put each card in the step it belongs to — the one still waiting, and the
+   * ones already answered.
    *
    * `<hitl-card>` is the same component the orchestrator and agent chat mount,
    * unchanged: a paused MAF step, a gated MCP tool call and an agent asking a
    * question are one API family, so they are one card. Rows are grouped by
    * `execution.maf_step_index` — a step can pause on more than one thing at
    * once, and the card pages through them itself.
    *
-   * A card is mounted once and then left alone: it owns typed text, ticked
-   * boxes and an AbortSignal that `NasikoElement` kills for good on disconnect,
-   * so it must never be moved or rebuilt while it is still being answered.
-   * That is also why every setter above re-renders only on a real change.
+   * A waiting card is mounted once and then left alone: it owns typed text,
+   * ticked boxes and an AbortSignal that `NasikoElement` kills for good on
+   * disconnect, so it must never be moved or rebuilt while it is still being
+   * answer
```

**File**: `ui/common/pages/executions-page.js` (modified, +13/-33)
```diff
@@ -11,9 +11,14 @@
  * and is answered by the same `<hitl-card>` the orchestrator and agent chat
  * mount — one component for every kind of pause, because
  * `POST /api/hitl/{id}/resolve` depends only on `kind`. Only the plumbing
- * differs: there is no stream to reconnect to, so the pending rows come from
- * `GET /api/maf/execution/{id}` (which carries `hitl` alongside the exec) and
- * resolving just re-polls — the MAF worker resumes the run server-side.
+ * differs: there is no stream to reconnect to, so the rows ride on the list
+ * itself (`GET /api/maf/executions` carries `hitl` per run) and resolving just
+ * re-polls — the MAF worker resumes the run server-side.
+ *
+ * The rows are handed on whatever their status, so a run that has moved on
+ * still shows what the human answered: the answer lives only on the HITL row,
+ * and a finished run that hid it read as the workflow acting on an answer
+ * nobody could see.
  *
  * @element executions-page
  */
@@ -82,9 +87,6 @@ class ExecutionsPage extends HTMLElement {
   #workflow = 'all';
   #time = 'any';
   #expanded = new Set();
-  /** exec id → the `hitl` rows GET /api/maf/execution/{id} last returned.
-   *  Only paused runs are ever fetched, so this stays empty in the normal case. */
-  #hitl = new Map();
   #pollTimer = null;
   #loaded = false;
 
@@ -161,7 +163,6 @@ class ExecutionsPage extends HTMLElement {
   async #load() {
     try {
       this.#executions = await call('fetchAllExecutions');
-      await this.#loadHitl();
       this.#loaded = true;
       this.#renderList();
       this.#pollIfActive();
@@ -187,39 +188,16 @@ class ExecutionsPage extends HTMLElement {
     this.#pollTimer = setTimeout(() => this.#refresh(), POLL_MS);
   }
 
-  /** One poll pass: re-read the list, re-read the paused runs' HITL rows, patch
-   *  what is on screen, and schedule the next one. */
+  /** One poll pass: re-read the list (HITL rows and all), patch what is on
+   *  screen, and schedule the next one. */
   async #refresh() {
     try {
       this.#executions = await call('fetchAllExecutions');
-      await this.#loadHitl();
       this.#refreshActive();
     } catch { /* transient poll failure — keep trying */ }
     this.#pollIfActive();
   }
 
-  /**
-   * Pending HITL rows for the paused runs.
-   *
-   * The list endpoint carries no `hitl`; the per-execution one does, and only a
-   * run at `awaiting_human` can have any — so this is at most one request per
-   * paused run and none at all in the ordinary case. A failure is left as "no
-   * rows yet": the next poll asks again, and a run that cannot show its card is
-   * better than a list that stops updating.
-   */
-  async #loadHitl() {
-    const paused = this.#executions.filter((e) => e.status === 'awaiting_human');
-    for (const id of [...this.#hitl.keys()]) {
-      if (!paused.some((e) => e.id === id)) this.#hitl.delete(id);
-    }
-    await Promise.all(paused.map(async (exec) => {
-      try {
-        const full = await call('fetchExecution', exec.id);
-        this.#hitl.set(exec.id, (full?.hitl || []).filter((r) => r.status === 'pending'));
-      } catch { /* leave whatever the last pass found */ }
-    }));
-  }
-
   /** In-place update of open active cards; full re-render only when the
    *  active set changes (keeps per-step tab state stable while polling). */
   #refreshActive() {
@@ -330,7 +308,9 @@ class ExecutionsPage extends HTMLElement {
       // Lets the timeline account for planning/synthesis, which belong to
       // the run and appear in no step row.
       el.totalTokens = exec.tokens_used || 0;
-      el.hitl = this.#hitl.get(exec.id) || [];
+      // Pending and decided alike: a decided row is how a finished run shows
+      // what the human answered, which is the only record of their part in it.
+      el.hitl = exec.hitl || [];
     }
   }
 
```

**File**: `ui/common/pages/workflow-detail-page.js` (modified, +3/-3)
```diff
@@ -495,9 +495,9 @@ class WorkflowDetailPage extends HTMLElement {
     // Lets the timeline account for planning/synthesis, which belong to the
     // run and appear in no step row.
     stepsEl.totalTokens = exec.tokens_used || 0;
-    // A paused run is answered here, in the step that paused — `fetchExecution`
-    // returns the pending rows alongside the exec, so this page already had
-    // them and was simply dropping them on the floor.
+    // A paused run is answered here, in the step that paused, and a run that has
+    // moved on still shows what was answered — the exec carries every row,
+    // decided ones included, and the timeline renders those as receipts.
     stepsEl.hitl = exec.hitl || [];
 
     const outputSec = this.querySelector('#run-output');
```

**File**: `ui/oss/executions.preview.js` (modified, +11/-12)
```diff
@@ -20,8 +20,9 @@ const pipelineSteps = (states) => [
   ["Publishing Agent", "Queue approved posts"],
 ].map(([agent, task], i) => stepResult(i, agent, task, states[i] || {}));
 
-// GET /api/maf/execution/{id} answers with the exec plus its `hitl` rows —
-// that is the only place a paused run's pending requests come from.
+// Every execution endpoint answers with the exec plus its `hitl` rows — the
+// list included, so a run shows both what it is waiting on and, once it has
+// moved on, what the human answered.
 const hitlRow = (id, kind, question, stepIndex) => ({
   id, kind, status: "pending", resume_status: "not_resumed", question,
   human_response: null,
@@ -32,8 +33,14 @@ const hitlRow = (id, kind, question, stepIndex) => ({
   allowed_actions: [], expires_at: null, created_at: ago(1), resolved_at: null,
 });
 
+const pausedHitl = [hitlRow("h-1", "tool_approval", {
+  message: "Research Agent needs to read a Linear project before it can continue.",
+  tool_name: "get_project", connector_id: "c-linear", connector_name: "Linear",
+}, 1)];
+
 const pausedExecution = {
   id: "ex-165", execution_number: 165, maf_id: "wf-001", status: "awaiting_human",
+  hitl: pausedHitl,
   attempt_count: 1, max_attempts: 3, tokens_used: 365,
   started_at: ago(2), completed_at: null, duration_ms: null, output: null, error: null,
   created_at: ago(2), workflow_name: "Social media content pipeline", workflow_status: "active",
@@ -90,16 +97,8 @@ const executions = [
 export default {
   fetch: [
     [{ method: "GET", path: /^\/api\/maf\/executions/ }, paged(executions)],
-    [{ method: "GET", path: /^\/api\/maf\/execution\/ex-165/ }, {
-      data: {
-        ...pausedExecution,
-        hitl: [hitlRow("h-1", "tool_approval", {
-          message: "Research Agent needs to read a Linear project before it can continue.",
-          tool_name: "get_project", connector_id: "c-linear", connector_name: "Linear",
-        }, 1)],
-      },
-      status_code: 200, message: "ok",
-    }],
+    [{ method: "GET", path: /^\/api\/maf\/execution\/ex-165/ },
+      { data: pausedExecution, status_code: 200, message: "ok" }],
   ],
   scenarios: {
     history: async (page) => {
```

---

### Incident Patch 13: `7a3d56bf` (2026-09-16)
**Commit Message**: feat(cli): add `maf trace` for one-command end-to-end runs

No single subcommand answered "is MAF working end to end". `workflow
create --instruction`, `workflow run --wait` and `execution get` each
show one stage, so a failure in the seam between them stays invisible
until all three are run by hand and compared.

`nasiko maf trace "<instruction>"` runs the whole pipeline and reports
each stage as it happens: how the decomposer split the sentence, which
agent the routing engine gave each step, each step's outcome the moment
it lands rather than all at the end, and the closing token breakdown.
Steps are reported as they finish because a MAF run is a sequence of
agent calls that can each take tens of seconds, and a silent wait gives
no way to tell a slow step from a wedged one.

Agent-side token figures show `-`, not `0`, when a step's agent emits no
instrumented spans: that is unknown rather than zero, and printing zero
would read as a fact.

The workflow is kept by default so it can be re-run or inspected;
`--cleanup` deletes it once the run finishes. Exits non-zero on a failed
run, after printing the details, so it works in a script.

Co-Authored-By: Claude Opus 5 (1M context) <[R

**File**: `cli/src/commands/maf.rs` (modified, +313/-0)
```diff
@@ -11,6 +11,319 @@ use serde_json::{Value, json};
 use crate::api::{Client, unwrap_data};
 use crate::commands::agents::resolve_agent_id;
 
+// ─── End-to-end trace ───────────────────────────────────────────────────────
+
+/// `nasiko maf trace "<instruction>"` — the whole MAF pipeline in one command.
+///
+/// Creates a workflow from one compound instruction, runs it, and reports every
+/// stage as it happens: how the decomposer split the sentence, which agent the
+/// routing engine gave each step, each step's outcome as it lands, and the
+/// closing token/cost breakdown.
+///
+/// This exists because no single existing subcommand answers "is MAF working
+/// end to end" — `workflow create`, `workflow run --wait` and `execution get`
+/// each show one stage, and a failure in the seam between them is invisible
+/// until you run all three by hand and compare.
+pub fn trace(
+    instruction: &str,
+    content: Option<&str>,
+    cleanup: bool,
+    json_out: bool,
+) -> Result<()> {
+    let client = Client::from_active_cluster()?;
+
+    let (workflow, decompose_secs) = create_from_instruction(&client, instruction)?;
+    let workflow_id = workflow
+        .get("id")
+        .and_then(Value::as_str)
+        .unwrap_or_default()
+        .to_string();
+    let steps = planned_steps(&workflow);
+
+    if !json_out {
+        print_plan(&workflow, &steps, decompose_secs);
+    }
+
+    let exec_id = queue_run(&client, &workflow_id, content)?;
+    let execution = poll_with_step_progress(&client, &exec_id, &steps, json_out)?;
+
+    if json_out {
+        let combined = json!({ "workflow": workflow, "execution": execution });
+        println!("{}", serde_json::to_string_pretty(&combined)?);
+    } else {
+        print_trace_summary(&client, &execution, &exec_id);
+        print_followups(&client, &workflow_id, cleanup)?;
+    }
+
+    // A failed run is reported in full above and *then* fails the command, so
+    // the details stay on screen and the exit code still tells a script the
+    // truth.
+    if execution.get("status").and_then(Value::as_str) == Some("failed") {
+        anyhow::bail!("execution failed");
+    }
+    Ok(())
+}
+
+/// Creates the workflow, returning it with how long the call took.
+///
+/// The elapsed time is worth surfacing on its own: this is the one stage that
+/// depends on an external service (the decomposer at `MODEL_API_URL`), so when
+/// a trace feels slow this number says whether that is where the time went.
+fn create_from_instruction(client: &Client, instruction: &str) -> Result<(Value, f64)> {
+    let spin = nasiko_utils::term::start_status("decomposing instruction");
+    let start = std::time::Instant::now();
+    let resp = client.post_json(
+        "/maf/workflow/from-instruction",
+        &json!({ "instruction": instruction }),
+    );
+    drop(spin);
+    let workflow: Value = unwrap_data(resp?)?;
+    Ok((workflow, start.elapsed().as_secs_f64()))
+}
+
+/// One step of the plan, as stored in the workflow definition.
+struct PlannedStep {
+    index: i64,
+    agent: String,
+    task: String,
+}
+
+fn planned_steps(workflow: &Value) -> Vec<PlannedStep> {
+    let empty = Vec::new();
+    workflow
+        .get("maf_json")
+        .and_then(|m| m.get("steps"))
+        .and_then(Value::as_array)
+        .unwrap_or(&empty)
+        .iter()
+        .map(|s| PlannedStep {
+            index: s.get("step_index").and_then(Value::as_i64).unwrap_or(0),
+            agent: s
+                .get("agent_name")
+                .and_then(Value::as_str)
+                .unwrap_or("?")
+                .to_string(),
+            task: s
+                .get("task_description")
+                .and_then(Value::as_str)
+                .unwrap_or("?")
+                .to_string(),
+        })
+        .collect()
+}
+
+fn print_plan(workflow: &Value, steps: &[PlannedStep], decompose_secs: f64) {
+    let name = workflow.get("name").and_then(Value::as_str).unwrap_or("?");
+    let id = workflow.get("id").and_then(Value::as_str).unwrap_or("?");
+    println!(
+        "\n1. Decomposed into {} step(s) in {decompose_secs:.1}s",
+        steps.len()
+    );
+    println!("\n2. Workflow '{name}' ({id})");
+    for step in steps {
+        println!("     {}. [{}] {}", step.index, step.agent, step.task);
+    }
+}
+
+fn queue_run(client: &Client, workflow_id: &str, content: Option<&str>) -> Result<String> {
+    let resp: Value = unwrap_data(client.post_json(
+        &format!("/maf/workflow/{workflow_id}/run"),
+        &json!({ "content": content }),
+    )?)?;
+    let exec_id = resp
+        .get("execution_id")
+        .and_then(Value::as_str)
+        .unwrap_or("?")
+        .to_string();
+    let number = resp
+        .get("execution_number")
+        .and_then(Value::as_i64)
+        .unwrap_or(0);
+    println!("\n3. Running execution #{number} ({exec_id})");
+    Ok(exec_id)
+}
+
+/// Polls the execution, printing each step the moment it reaches a te
```

**File**: `cli/src/lib.rs` (modified, +27/-0)
```diff
@@ -499,6 +499,27 @@ pub enum MafCommands {
         #[command(subcommand)]
         command: MafExecutionCommands,
     },
+    /// Run one instruction end to end and report every stage
+    #[command(
+        after_help = "Does in one command what `workflow create --instruction`, \
+`workflow run --wait` and `execution get` do in three: sends the sentence to the decomposer, \
+shows how it was split and which agent each step was routed to, runs it while reporting each \
+step as it finishes, then prints the result with its token breakdown.\n\n\
+The workflow is kept by default so it can be re-run or inspected; pass --cleanup to delete it \
+once the run finishes."
+    )]
+    Trace {
+        /// The compound instruction to decompose into a workflow and run
+        instruction: String,
+        /// Run-time data folded into step 0's task before planning
+        #[arg(long)]
+        content: Option<String>,
+        /// Delete the workflow once the run finishes
+        #[arg(long)]
+        cleanup: bool,
+        #[arg(long)]
+        json: bool,
+    },
 }
 
 #[derive(Subcommand)]
@@ -1352,6 +1373,12 @@ pub fn dispatch_agent_ops(cmd: AgentOpsCommands) -> Result<()> {
                     commands::maf::execution_result(&execution_id, json)
                 }
             },
+            MafCommands::Trace {
+                instruction,
+                content,
+                cleanup,
+                json,
+            } => commands::maf::trace(&instruction, content.as_deref(), cleanup, json),
         },
     }
 }
```

---

### Incident Patch 14: `6e0fd64a` (2026-09-11)
**Commit Message**: fix(maf): keep user content out of info logs; document decomposer config

Four sites logged user-authored content at `info!`, which ships to Loki
where anyone with dashboard access can read it: the raw instruction, each
decomposed sub-query, every step's task description, and the decomposer
client's query. Each now logs a length or a count at `info!` and the text
at `debug!`.

The decomposer-failure log moves from `info!` to `warn!`. Its error string
embeds the service's response body, which can echo the submitted query
back, so it should fire when something is wrong rather than on every
request.

Also documents MODEL_API_URL/MODEL_APIKEY in .env.example — MODEL_API_URL
is the full endpoint including its path, which is easy to get wrong given
it sits beside OPENAI_BASE_URL, a base.
[synced-from-private]

**File**: `orchestrator/src/maf/decomposer.rs` (modified, +7/-1)
```diff
@@ -30,7 +30,13 @@ impl DecomposerClient {
     /// instruction unchanged as a single-element vec if the service reports
     /// nothing to split (empty `sub_queries`).
     pub async fn decompose(&self, query: &str) -> Result<Vec<String>, String> {
-        tracing::info!(query, "decomposer_client: decompose() start");
+        // `query` is raw user input — logged at `debug`, not `info`, so it
+        // isn't shipped to Loki on every workflow creation.
+        tracing::info!(
+            query_len = query.len(),
+            "decomposer_client: decompose() start"
+        );
+        tracing::debug!(query, "decomposer_client: query text");
         let start = std::time::Instant::now();
         let mut req = self.http.post(&self.url);
         if let Some(key) = &self.api_key {
```

**File**: `orchestrator/tests/reranker.rs` (modified, +1/-2)
```diff
@@ -172,8 +172,7 @@ async fn with_history_and_live_store_returns_scored_results() {
 
     let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL required");
     let pool = sqlx::PgPool::connect(&db_url).await.unwrap();
-    let store =
-        Arc::new(VectorStore::build(agents.clone(), api_key, base_url, model, &pool).await);
+    let store = Arc::new(VectorStore::build(agents.clone(), api_key, base_url, model, &pool).await);
     let reranker = Reranker::new(store);
     let history = SessionHistory {
         messages: vec![ChatMessage {
```

---

### Incident Patch 15: `2cece438` (2026-09-11)
**Commit Message**: feat(ui): account for run-level tokens in the execution timeline

The header showed the execution total while the step chips only ever
covered per-step work, so the column invited a subtraction that never
worked out and had nothing to explain the gap.

A trailing "Planning & final synthesis" row now carries the remainder —
planning and the final synthesis are run-level phases belonging to no
step. Rendered only on a positive remainder, so a run whose total is
still being written doesn't show a negative.
[synced-from-private]

**File**: `ui/common/features/wf-run-steps.css` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+@scope (wf-run-steps) {
+  :scope {
+    display: block;
+  }
+
+  .step {
+    display: flex;
+    gap: var(--s-12);
+  }
+
+  /* Status icon column + connector line (mockup: 20px col, 1px sand line) */
+  .rail-col {
+    display: flex;
+    flex-direction: column;
+    align-items: center;
+    width: 20px;
+    flex-shrink: 0;
+    color: var(--color-text-muted);
+  }
+  .rail-col.is-success { color: var(--color-success); }
+  .rail-col.is-failed { color: var(--color-error); }
+  .rail-col.is-running { color: var(--fg-brand); }
+  .rail-line {
+    flex: 1;
+    width: 1px;
+    min-height: 20px;
+    margin-top: var(--s-4);
+    background: var(--bg-disabled);
+  }
+
+  .spin {
+    display: inline-flex;
+    animation: wf-spin 1.1s linear infinite;
+  }
+  @media (prefers-reduced-motion: reduce) {
+    .spin { animation: none; }
+  }
+
+  .step-body {
+    display: flex;
+    flex-direction: column;
+    gap: var(--s-8);
+    flex: 1;
+    min-width: 0;
+    padding-bottom: var(--s-20);
+  }
+  .step:last-child .step-body { padding-bottom: 0; }
+
+  /* Run-level tail: the planning + synthesis tokens that belong to the run
+     rather than to any step. Deliberately quieter than a real step — it is
+     an accounting line that makes the column add up, not a stage the
+     workflow went through. */
+  .step--run-level .rail-col { color: var(--color-text-muted); }
+  .step--run-level .step-title { color: var(--color-text-muted); font-weight: 400; }
+
+  .step-head {
+    display: flex;
+    align-items: center;
+    gap: var(--s-12);
+    flex-wrap: wrap;
+    min-height: 20px;
+  }
+  .step-detail {
+    display: flex;
+    flex-direction: column;
+    justify-content: flex-start;
+    align-items: start;
+    gap: var(--s-12);
+    flex-wrap: wrap;
+    min-height: 20px;
+  }
+  .step-title {
+    font-size: 13px;
+    font-weight: 500;
+    line-height: 18px;
+    color: var(--color-text-main);
+  }
+  .meta {
+    font-size: var(--font-size-xs);
+    line-height: 16px;
+    color: var(--color-text-muted);
+  }
+  .status.is-success { color: var(--color-success); }
+  .status.is-failed { color: var(--color-error); }
+  .status.is-running { color: var(--fg-brand); }
+
+  /* Output / Prompt pill tabs (mockup: 24px pills, active = white fill) */
+  .pane-tabs {
+    display: flex;
+    gap: var(--s-8);
+  }
+  .pane-tab {
+    display: inline-flex;
+    align-items: center;
+    height: 24px;
+    padding: 0 10px;
+    border: none;
+    border-radius: var(--r-40);
+    background: transparent;
+    font-family: inherit;
+    font-size: var(--font-size-xs);
+    line-height: 16px;
+    color: var(--color-text-muted);
+    cursor: pointer;
+  }
+  .pane-tab.is-active {
+    background: var(--color-bg-base);
+    color: var(--color-text-main);
+  }
+  /* On a sand card (surface="sand") the wells flip to white for contrast */
+  :scope[surface='sand'] .pane-tab.is-active {
+    background: var(--color-bg-surface);
+  }
+
+  .pane {
+    max-height: 128px;
+    padding: var(--s-12);
+    border-radius: var(--r-8);
+    background: var(--color-bg-base);
+    overflow-y: auto;
+    font-size: var(--font-size-xs);
+    line-height: 18px;
+    color: var(--color-text-main);
+    scrollbar-width: thin;
+    overflow-wrap: anywhere;
+  }
+  :scope[surface='sand'] .pane {
+    background: var(--color-bg-surface);
+  }
+  .pane.md-body { font-size: var(--font-size-xs); }
+  .pane--mono {
+    font-family: var(--font-display);
+    white-space: pre-wrap;
+  }
+  .pane--error {
+    font-family: var(--font-display);
+    white-space: pre-wrap;
+    color: var(--color-error);
+  }
+}
+
+@keyframes wf-spin {
+  to { transform: rotate(360deg); }
+}
```

**File**: `ui/common/features/wf-run-steps.js` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+/**
+ * Vertical per-step timeline for one workflow execution (MAF step_results).
+ *
+ * The server snapshots `step_results` on every transition, so re-assigning
+ * `steps` while polling GET /api/maf/execution/{id} yields a live timeline.
+ *
+ * @element wf-run-steps
+ * @prop {Array} steps - Raw `step_results` rows ({step_index, agent_name,
+ *       status, error, prompt, extracted_info, tokens_used, latency_ms}).
+ * @prop {Object} labels - Optional map step_id → task_description, used as
+ *       the step title when the caller has the workflow's maf_json handy.
+ * @prop {number} totalTokens - The execution's `tokens_used`. Optional; when
+ *       given, a trailing row accounts for the difference between it and the
+ *       steps, so the column adds up (see `#runLevelRow`).
+ */
+import { icons } from '/common/utils/icons.js';
+import { renderMarkdown } from '/common/utils/markdown.js';
+import { fmtDuration, fmtTokens } from '/common/utils/units.js';
+
+import { loadCss } from '/common/utils/css.js';
+const styles = await loadCss(new URL('./wf-run-steps.css', import.meta.url));
+import { escHtml } from '/common/utils/escape.js';
+document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
+
+const STATUS_META = {
+  success: { label: 'Complete', cls: 'is-success' },
+  failed:  { label: 'Failed',   cls: 'is-failed' },
+  running: { label: 'Running',  cls: 'is-running' },
+  pending: { label: 'Pending',  cls: 'is-pending' },
+};
+
+class WfRunSteps extends HTMLElement {
+  #steps = [];
+  #labels = {};
+  #totalTokens = 0;
+  #openTab = {}; // step index → 'output' | 'prompt'
+
+  set steps(value) {
+    this.#steps = Array.isArray(value) ? value : [];
+    this.#render();
+  }
+
+  set labels(value) {
+    this.#labels = value || {};
+    this.#render();
+  }
+
+  set totalTokens(value) {
+    this.#totalTokens = Number(value) || 0;
+    this.#render();
+  }
+
+  connectedCallback() {
+    this.addEventListener('click', this.#onClick);
+    this.#render();
+  }
+
+  disconnectedCallback() {
+    this.removeEventListener('click', this.#onClick);
+  }
+
+  #onClick = (e) => {
+    const pill = e.target.closest('[data-tab]');
+    if (!pill) return;
+    this.#openTab[pill.dataset.step] = pill.dataset.tab;
+    this.#render();
+  };
+
+  #statusIcon(status) {
+    if (status === 'success') return icons.checkCircle('', 16);
+    if (status === 'failed') return icons.xCircle('', 16);
+    if (status === 'running') return `<span class="spin">${icons.loader('', 16)}</span>`;
+    return icons.circle('', 16);
+  }
+
+  #detailHtml(step, i) {
+    // Pending/running steps stay compact rows — prompts only matter post-hoc.
+    if (step.status !== 'success' && step.status !== 'failed') return '';
+    const output = step.extracted_info || '';
+    const prompt = step.prompt || '';
+    const error = step.error || '';
+    if (!output && !prompt && !error) return '';
+
+    const tab = this.#openTab[i] || (output ? 'output' : 'prompt');
+    const pills = [];
+    if (output) pills.push(['output', 'Output']);
+    if (prompt) pills.push(['prompt', 'Prompt']);
+    const pillRow = pills.length > 1
+      ? `<div class="pane-tabs">${pills.map(([key, label]) =>
+          `<button type="button" class="pane-tab${tab === key ? ' is-active' : ''}"
+            data-step="${i}" data-tab="${key}">${label}</button>`).join('')}</div>`
+      : '';
+
+    let pane = '';
+    if (error) {
+      pane = `<div class="pane pane--error">${escHtml(error)}</div>`;
+    } else if (tab === 'prompt' && prompt) {
+      pane = `<div class="pane pane--mono">${escHtml(prompt)}</div>`;
+    } else if (output) {
+      pane = `<div class="pane md-body">${renderMarkdown(output)}</div>`;
+    }
+    return `<div class="step-detail">${pillRow}${pane}</div>`;
+  }
+
+  /**
+   * Trailing row for the tokens that belong to the run rather than to any
+   * step — runtime planning and the final synthesis.
+   *
+   * Without it the timeline invites a subtraction that never works out: the
+   * header shows the execution total while the step chips only ever cover
+   * per-step work, so the two visibly disagree with nothing to explain the
+   * gap. Rendered only when there is a positive remainder, so a run whose
+   * total is still being written doesn't show a nonsense negative.
+   */
+  #runLevelRow() {
+    const stepTokens = this.#steps.reduce((sum, s) => sum + (s.tokens_used || 0), 0);
+    const remainder = this.#totalTokens - stepTokens;
+    if (remainder <= 0) return '';
+    return `
+      <div class="step step--run-level">
+        <div class="rail-col">${icons.sparkles('', 16)}</div>
+        <div class="step-body">
+          <div class="step-head">
+            <span class="step-title">Planning &amp; final synthesis</span>
+            <span class="meta">${fmtTokens(remainder)}</span>
+          </div>
+        </div>
+      </div>`;
+  }
+
+  #render() {
+    if (!this.#steps.length) {
+      t
```

**File**: `ui/common/features/wf-step-editor.css` (added, +213/-0)
```diff
@@ -0,0 +1,213 @@
+@scope (wf-step-editor) {
+  :scope {
+    display: flex;
+    flex-direction: column;
+  }
+
+  .step-block {
+    display: flex;
+    flex-direction: column;
+  }
+
+  /* Step card — sand well with a soft edge so the card reads as one object.
+     Two content rows only (instruction, agent) plus a left ordinal rail and a
+     right control rail; the ordinal chip replaces a redundant header caption. */
+  .step-card {
+    display: grid;
+    grid-template-columns: 20px minmax(0, 1fr) auto;
+    align-items: start;
+    column-gap: var(--s-12);
+    row-gap: var(--s-12);
+    padding: var(--s-16) var(--s-20);
+    border: 1px solid var(--border-subtle);
+    border-radius: var(--r-8);
+    background: var(--color-bg-base);
+  }
+  .step-card:focus-within {
+    border-color: var(--border-primary);
+  }
+
+  /* Gold ordinal chip — the step's only identity marker, and the anchor the
+     connector spine below the card lines up with (mockup: yellow-200 fill). */
+  .step-num {
+    grid-column: 1;
+    grid-row: 1;
+    display: inline-flex;
+    align-items: center;
+    justify-content: center;
+    width: 20px;
+    height: 20px;
+    /* Centres on the instruction field's first text line (10px pad + 9px). */
+    margin-top: 9px;
+    border-radius: var(--r-40);
+    background: var(--bg-secondary-brand-hover);
+    font-size: var(--font-size-xs);
+    font-weight: 500;
+    line-height: 1;
+    color: var(--color-text-main);
+    flex-shrink: 0;
+  }
+
+  /* Control rail — reorder pair grouped tight, destructive delete split off
+     behind a hairline so it can't be hit by reflex. The reorder pair is
+     <app-button variant="ghost" size="sm" icon-only> and the delete is
+     `ghost-danger` — red ink, no fill, so it reads destructive without becoming
+     the loudest box in the rail (and stays surfaceless when disabled on a
+     single-step workflow). The hairline is <app-divider vertical>, which
+     stretches to its flex row by default — pinned to the 14px tick this rail
+     wants. */
+  .step-tools {
+    grid-column: 3;
+    grid-row: 1;
+    display: flex;
+    align-items: center;
+    gap: var(--s-2);
+    margin-top: 7px;
+  }
+  .step-tools app-divider {
+    align-self: center;
+    height: 14px;
+    margin-inline: var(--s-4);
+  }
+  .step-tools app-button[data-act="remove"] { margin-left: var(--s-2); }
+
+  /* Instruction well — raised surface inside the sand card */
+  textarea {
+    grid-column: 2;
+    grid-row: 1;
+    width: 100%;
+    min-height: 56px;
+    padding: 10px var(--s-12);
+    border: 1px solid transparent;
+    border-radius: var(--r-6);
+    background: var(--color-bg-surface);
+    resize: vertical;
+    font-family: inherit;
+    font-size: 13px;
+    line-height: 18px;
+    color: var(--color-text-main);
+  }
+  textarea:focus {
+    outline: none;
+    border-color: var(--color-primary);
+  }
+  textarea::placeholder { color: var(--color-text-muted); }
+
+  /* Agent row — sits in the instruction column so both fields share an edge.
+     The picker is <app-select> (box, chevron, focus ring and the 32px control
+     height all live there) and "Suggested" is <app-badge variant="warning">;
+     what is left here is how they share the row. */
+  .agent-row {
+    grid-column: 2;
+    grid-row: 2;
+    display: flex;
+    align-items: center;
+    gap: var(--s-8);
+  }
+  .agent-label {
+    flex-shrink: 0;
+    font-size: var(--font-size-xs);
+    line-height: 16px;
+    color: var(--color-text-muted);
+  }
+  app-select {
+    flex: 1;
+    min-width: 0;
+  }
+  .agent-row app-badge { flex-shrink: 0; }
+
+  /* Narrow screens: there's no room for a control rail, so the controls take
+     the top-right of the card and the chip anchors that row instead. */
+  @media (max-width: 640px) {
+    .step-card {
+      grid-template-columns: 20px minmax(0, 1fr);
+      column-gap: var(--s-8);
+      row-gap: var(--s-8);
+      padding: var(--s-12) var(--s-16);
+    }
+    .step-num { margin-top: 2px; }
+    .step-tools {
+      grid-column: 2;
+      grid-row: 1;
+      justify-content: flex-end;
+      margin-top: 0;
+    }
+    textarea { grid-row: 2; }
+    .agent-row {
+      grid-row: 3;
+      flex-wrap: wrap;
+    }
+    /* Label and marker share a line above a full-width picker. */
+    .agent-label { flex: 1; }
+    .agent-row app-badge { order: 1; }
+    app-select {
+      order: 2;
+      flex-basis: 100%;
+    }
+    /* Card padding drops to 16, so the spine moves with the chip. */
+    .connector { margin-left: 16px; }
+  }
+
+  /* Connector spine — lines up with the ordinal chip's centre (1px card border
+     + 20px padding + 10px half-chip) and carries enough weight to be read as a
+     link between cards rather than a hairline artefact. Also the "insert step
+     here" hit target: the plus icon stays faintly visible at rest (not opacity
+     0 — a fully-hidden affordance is too easy to never find by accident) and
+     gets full 
```

**File**: `ui/common/features/wf-step-editor.js` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
+/**
+ * Editable workflow step list — instruction textarea + agent picker per step,
+ * with add / remove / reorder. Used by the create page and the detail page.
+ *
+ * @element wf-step-editor
+ * @prop {Array} steps - [{taskDescription, agentId, agentName, suggested}];
+ *       `agentId` empty string means "Auto-select at run time" (the routing
+ *       engine assigns the agent when the workflow is saved/run).
+ * @prop {Array} agents - [{id, name}] options for the per-step picker.
+ * @fires wf-steps-change - Any edit (text, agent, add, remove, reorder, insert).
+ */
+import { icons } from '/common/utils/icons.js';
+import '/common/design-system/app-badge/app-badge.js';
+import '/common/design-system/app-button/app-button.js';
+import '/common/design-system/app-divider/app-divider.js';
+import '/common/design-system/app-empty-state/app-empty-state.js';
+import '/common/design-system/app-select/app-select.js';
+
+import { loadCss } from '/common/utils/css.js';
+const styles = await loadCss(new URL('./wf-step-editor.css', import.meta.url));
+import { escHtml } from '/common/utils/escape.js';
+document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
+
+class WfStepEditor extends HTMLElement {
+  #steps = [];
+  #agents = [];
+  #pendingFocusIndex = null;
+
+  set steps(value) {
+    this.#steps = (value || []).map((s) => ({
+      taskDescription: s.taskDescription || '',
+      agentId: s.agentId || '',
+      agentName: s.agentName || '',
+      suggested: !!s.suggested,
+    }));
+    this.#render();
+  }
+
+  get steps() {
+    return this.#steps.map((s) => ({ ...s }));
+  }
+
+  set agents(value) {
+    this.#agents = value || [];
+    this.#render();
+  }
+
+  connectedCallback() {
+    this.addEventListener('click', this.#onClick);
+    this.addEventListener('input', this.#onInput);
+    this.addEventListener('change', this.#onChange);
+    this.#render();
+  }
+
+  disconnectedCallback() {
+    this.removeEventListener('click', this.#onClick);
+    this.removeEventListener('input', this.#onInput);
+    this.removeEventListener('change', this.#onChange);
+  }
+
+  #emit() {
+    this.dispatchEvent(new CustomEvent('wf-steps-change', { bubbles: true }));
+  }
+
+  #onClick = (e) => {
+    const btn = e.target.closest('[data-act]');
+    if (!btn) return;
+    const i = Number(btn.dataset.index ?? -1);
+    const act = btn.dataset.act;
+    if (act === 'add') this.#steps.push({ taskDescription: '', agentId: '', agentName: '', suggested: false });
+    else if (act === 'remove') this.#steps.splice(i, 1);
+    else if (act === 'up' && i > 0) [this.#steps[i - 1], this.#steps[i]] = [this.#steps[i], this.#steps[i - 1]];
+    else if (act === 'down' && i < this.#steps.length - 1) [this.#steps[i + 1], this.#steps[i]] = [this.#steps[i], this.#steps[i + 1]];
+    // data-index is the step this insert point sits after; -1 for the point
+    // above the first card, so the new step lands at index 0.
+    else if (act === 'insert') this.#insertAt(i + 1);
+    else return;
+    this.#render();
+    this.#emit();
+  };
+
+  /** Splices a blank step in at `index` and moves focus into its textarea. */
+  #insertAt(index) {
+    this.#steps.splice(index, 0, { taskDescription: '', agentId: '', agentName: '', suggested: false });
+    this.#pendingFocusIndex = index;
+  }
+
+  #onInput = (e) => {
+    const area = e.target.closest('textarea[data-index]');
+    if (!area) return;
+    this.#steps[Number(area.dataset.index)].taskDescription = area.value;
+    this.#emit();
+  };
+
+  // The picker is <app-select>, so `data-index` lives on the host — the inner
+  // <select> the event comes from does not carry it.
+  #onChange = (e) => {
+    const picker = e.target.closest('app-select[data-index]');
+    if (!picker) return;
+    const step = this.#steps[Number(picker.dataset.index)];
+    step.agentId = picker.value;
+    step.agentName = picker.select?.selectedOptions[0]?.dataset.name || '';
+    step.suggested = false;
+    this.#render();
+    this.#emit();
+  };
+
+  #agentOptions(step) {
+    const options = [`<option value="">Auto-select at run time</option>`];
+    let seen = false;
+    for (const a of this.#agents) {
+      const selected = a.id === step.agentId;
+      seen = seen || selected;
+      options.push(`<option value="${escHtml(a.id)}" data-name="${escHtml(a.name)}"
+        ${selected ? 'selected' : ''}>${escHtml(a.name)}</option>`);
+    }
+    // Keep a previously-assigned agent visible even if it's no longer listed.
+    if (step.agentId && !seen) {
+      options.push(`<option value="${escHtml(step.agentId)}" data-name="${escHtml(step.agentName)}" selected>
+        ${escHtml(step.agentName || step.agentId)}</option>`);
+    }
+    return options.join('');
+  }
+
+  /**
+   * One step. The ordinal lives in the gold chip alone — the old "Step N"
+   * caption next to it said the same thing twice — and the chip doubles as the
+   * anchor the connector spine runs 
```

**File**: `ui/common/pages/executions-page.js` (added, +263/-0)
```diff
@@ -0,0 +1,263 @@
+/**
+ * All executions — workflow runs across every workflow (GET /api/maf/executions).
+ *
+ * Active tab shows in-flight runs with a live step timeline (the list rows
+ * carry snapshotted step_results; the page re-polls the list every 1.5s
+ * while anything is pending/running — there is no run SSE). History tab
+ * lists finished runs, collapsed, with a status filter.
+ *
+ * @element executions-page
+ */
+import { icons } from '/common/utils/icons.js';
+import { timeAgo, formatDisplay } from '/common/utils/date-utils.js';
+import { fmtDuration, fmtTokens } from '/common/utils/units.js';
+import '/common/design-system/app-badge/app-badge.js';
+import '/common/design-system/app-button/app-button.js';
+import '/common/design-system/app-empty-state/app-empty-state.js';
+import '/common/design-system/app-skeleton/app-skeleton.js';
+import '/common/design-system/app-tabs/app-tabs.js';
+import '/common/features/wf-run-steps.js';
+
+import { loadCss } from '/common/utils/css.js';
+const styles = await loadCss(new URL('./executions-page.css', import.meta.url));
+import { escAttr, escHtml } from '/common/utils/escape.js';
+import { call } from '../core/data-sources.js';
+import { attachSlidingIndicator } from '/common/utils/tab-indicator.js';
+// The page mounts an <app-module-nav>, and page-layout.css reserves the desktop
+// gutter it pins into. Nothing imported it, so under the client router the
+// gutter was reserved and the nav never upgraded.
+import '/common/features/app-module-nav.js';
+
+document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
+
+const POLL_MS = 1500;
+const ACTIVE = new Set(['pending', 'running']);
+/** Run status → <app-badge> variant. */
+const STATUS_VARIANTS = { success: 'success', failed: 'error', running: 'warning', pending: 'neutral' };
+
+class ExecutionsPage extends HTMLElement {
+  #initialized = false;
+  #executions = [];
+  #tab = 'active';
+  #statusFilter = 'all';
+  #expanded = new Set();
+  #pollTimer = null;
+  #loaded = false;
+
+  connectedCallback() {
+    if (this.#initialized) return;
+    this.#initialized = true;
+
+    this.innerHTML = `
+      <app-module-nav module="orchestrator"></app-module-nav>
+      <h1 class="title-page page-title">All executions</h1>
+      <app-tabs strip class="tabs">
+        <button type="button" class="tab" role="tab" data-key="active" aria-selected="true">Active</button>
+        <button type="button" class="tab" role="tab" data-key="history" aria-selected="false">History</button>
+      </app-tabs>
+      <div class="list-area" id="list-area">${this.#skeleton()}</div>
+    `;
+
+    // <app-tabs strip> flips aria-selected and slides the indicator; the page
+    // keeps owning the single list area both tabs render into.
+    this.querySelector('.tabs').addEventListener('tab-change', (e) => {
+      this.#tab = e.detail.key;
+      this.#renderList();
+    });
+
+    const area = this.querySelector('#list-area');
+    area.addEventListener('click', (e) => {
+      const filterBtn = e.target.closest('[data-filter]');
+      if (filterBtn) {
+        this.#statusFilter = filterBtn.dataset.filter;
+        this.#renderHistoryRuns(); // seg-ctrl stays mounted so its indicator slides
+        return;
+      }
+      const toggle = e.target.closest('[data-toggle]');
+      if (toggle) {
+        const id = toggle.dataset.toggle;
+        this.#expanded.has(id) ? this.#expanded.delete(id) : this.#expanded.add(id);
+        this.#tab === 'history' ? this.#renderHistoryRuns() : this.#renderList();
+      }
+    });
+
+    this.#load();
+  }
+
+  disconnectedCallback() {
+    clearTimeout(this.#pollTimer);
+    this.#pollTimer = null;
+  }
+
+  async #load() {
+    try {
+      this.#executions = await call('fetchAllExecutions');
+      this.#loaded = true;
+      this.#renderList();
+      this.#pollIfActive();
+    } catch (err) {
+      this.querySelector('#list-area').innerHTML =
+        `<p class="load-error">Failed to load executions: ${escHtml(err.message)}</p>`;
+    }
+  }
+
+  #pollIfActive() {
+    if (!this.#executions.some((e) => ACTIVE.has(e.status))) return;
+    this.#pollTimer = setTimeout(async () => {
+      try {
+        this.#executions = await call('fetchAllExecutions');
+        if (this.#tab === 'active') this.#refreshActive();
+      } catch { /* transient poll failure — keep trying */ }
+      this.#pollIfActive();
+    }, POLL_MS);
+  }
+
+  /** In-place update of open active cards; full re-render only when the
+   *  active set changes (keeps per-step tab state stable while polling). */
+  #refreshActive() {
+    const active = this.#executions.filter((e) => ACTIVE.has(e.status));
+    const rendered = [...this.querySelectorAll('.run-card[data-card]')].map((c) => c.dataset.card);
+    const sameSet = active.length === rendered.length && active.every((e) => rendered.includes(e.id));
+    if (!sameSet) {
+      this.#renderList();
+      return;
+    }
+    for (const exec of 
```

**File**: `ui/common/pages/workflow-detail-page.js` (added, +398/-0)
```diff
@@ -0,0 +1,398 @@
+/**
+ * Workflow detail — review/edit one MAF workflow, run it, and watch runs.
+ *
+ * Views (single 720px column, mirroring the mockup's review screen):
+ * - review: editable name/description/steps (PUT /api/maf/workflow/{id}),
+ *   output_generation display, run button, execution history.
+ * - run: live per-step timeline for one execution — polls
+ *   GET /api/maf/execution/{id} every 1.5s while pending/running (no SSE).
+ *
+ * Deep link: /workflow?id=<workflow>&exec=<execution>.
+ *
+ * @element workflow-detail-page
+ */
+import { apiFetch } from '/common/services/api.js';
+import { icons } from '/common/utils/icons.js';
+import { showToast } from '/common/utils/toast.js';
+import { timeAgo } from '/common/utils/date-utils.js';
+import { fmtDuration, fmtTokens } from '/common/utils/units.js';
+import { renderMarkdown } from '/common/utils/markdown.js';
+import '/common/design-system/app-badge/app-badge.js';
+import '/common/design-system/app-button/app-button.js';
+import '/common/utils/back-link.js';
+import '/common/design-system/app-empty-state/app-empty-state.js';
+import '/common/features/wf-step-editor.js';
+import '/common/features/wf-run-steps.js';
+
+import { loadCss } from '/common/utils/css.js';
+const styles = await loadCss(new URL('./workflow-detail-page.css', import.meta.url));
+import { escHtml } from '/common/utils/escape.js';
+import { call } from '../core/data-sources.js';
+
+document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
+
+const POLL_MS = 1500;
+/** Execution status → <app-badge> variant. */
+const EXEC_VARIANTS = { success: 'success', failed: 'error', running: 'warning', pending: 'neutral' };
+
+class WorkflowDetailPage extends HTMLElement {
+  #initialized = false;
+  #workflowId = null;
+  #workflow = null;
+  #executions = [];
+  #execution = null;
+  // Whether the run view on screen was pushed onto history by this page. If it
+  // was, leaving it is a step back — pushing a review entry there instead made
+  // Back bounce into the run view forever (executions → run → review → Back →
+  // run → review → Back → run …).
+  #runPushed = false;
+  #pollTimer = null;
+  #dirty = false;
+
+  connectedCallback() {
+    if (this.#initialized) return;
+    this.#initialized = true;
+    const params = new URLSearchParams(location.search);
+    this.#workflowId = params.get('id');
+    window.addEventListener('popstate', this.#onPopState);
+
+    if (!this.#workflowId) {
+      this.innerHTML = `
+        <div class="col">
+          <app-empty-state
+            title="No workflow selected"
+            description="Open one from the workflows library to review its steps and runs."
+            icon='${icons.workflow('', 40)}'>
+            <app-button variant="tertiary" href="/workflows">Browse workflows</app-button>
+          </app-empty-state>
+        </div>`;
+      return;
+    }
+    // Set by the create screen's "Save & run" when the save succeeded but the
+    // run request didn't — otherwise the workflow just silently sits unrun.
+    const runError = params.get('run_error');
+    if (runError) showToast(`Saved, but the run didn't start: ${runError}`);
+
+    this.#load(params.get('exec'));
+  }
+
+  disconnectedCallback() {
+    this.#stopPolling();
+    window.removeEventListener('popstate', this.#onPopState);
+  }
+
+  #onPopState = () => {
+    const exec = new URLSearchParams(location.search).get('exec');
+    if (exec) this.#openRun(exec, { push: false });
+    else this.#showReview();
+  };
+
+  async #load(execId) {
+    try {
+      const [workflow, executions] = await Promise.all([
+        call('fetchWorkflow', this.#workflowId),
+        call('fetchWorkflowExecutions', this.#workflowId).catch(() => []),
+      ]);
+      this.#workflow = workflow;
+      this.#executions = executions;
+      document.title = `Nasiko — ${workflow.name}`;
+    } catch {
+      this.innerHTML = `
+        <div class="col">
+          <app-empty-state
+            title="Workflow not found"
+            description="It may have been deleted."
+            icon='${icons.faceFrown('', 40)}'>
+            <app-button variant="tertiary" size="sm" href="/workflows">Back to workflows</app-button>
+          </app-empty-state>
+        </div>`;
+      return;
+    }
+    if (execId) this.#openRun(execId, { push: false });
+    else this.#showReview();
+  }
+
+  // ── Review view ───────────────────────────────────────────────────────────
+
+  #stepLabels() {
+    const labels = {};
+    for (const s of this.#workflow.maf_json?.steps || []) labels[s.step_id] = s.task_description;
+    return labels;
+  }
+
+  #showReview() {
+    this.#stopPolling();
+    this.#execution = null;
+    this.#dirty = false;
+    const wf = this.#workflow;
+    const steps = wf.maf_json?.steps || [];
+    const runs = wf.execution_count === 1 ? '1 run' : `${wf.execution_count} runs`;
+
+    this.innerHTML = `
+      <div class="col">
+        <header class="page-
```

#### Recent Merged Pull Requests:
- **PR #336** (closed): feat(router): implement P2 request classifier, L2 cache bypass, evalu… (@Varshini2701)
- **PR #316** (closed): [compact-tools] Implement Track P1 schema compaction, fail-closed val… (@Kanneboinashivakumar)
- **PR #312** (closed): Classifier hackathon (@KandalaHarini)
- **PR #303** (closed): [compact-tools] Initial scaffolding for compact tool schema encoding/… (@petkarrushikesh)
- **PR #274** (closed): Classifier hackathon (@KandalaHarini)
- **PR #219** (closed): [compact-tools] Compact tool schemas: signature-line encoding + fail-closed call decoder (@ozrehan)
- **PR #210** (closed): [classifier] Add import for Duration in classifier.rs (@KandalaHarini)
- **PR #207** (closed): [compact-tools] Compact tool schemas with fail-closed decode (@Praneeth9640)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
