# Forensic Learning Record (Deep Inspection): bahdotsh/wrkflw

> **Canonical Artifact**: `07_PROJECT_LEARNING/bahdotsh-wrkflw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bahdotsh/wrkflw](https://github.com/bahdotsh/wrkflw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:27:32.153Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bahdotsh/wrkflw`
- **Description**: Validate and Run GitHub Actions locally.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3322 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/evaluator/src/lib.rs`
```
use colored::*;
use serde_yaml::{self, Value};
use std::fs;
use std::path::{Path, PathBuf};

use wrkflw_models::ValidationResult;
use wrkflw_validators::{validate_env, validate_jobs, validate_triggers};

pub fn evaluate_workflow_file(path: &Path, verbose: bool) -> Result<ValidationResult, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Parse YAML content
    let workflow: Value =
        serde_yaml::from_str(&content).map_err(|e| format!("Invalid YAML: {}", e))?;

    let mut result = ValidationResult::new();
    let repo_root = find_repo_root(path);

    // Check for required structure
    if !workflow.is_mapping() {
        result.add_issue("Workflow file is not a valid YAML mapping".to_string());
        return Ok(result);
    }

    // Note: The 'name' field is optional per GitHub Actions specification.
    // When omitted, GitHub displays the workflow file path relative to the repository root.
    // We do not validate name presence as it's not required by the schema.

    // Check if jobs section exists
    match workflow.get("jobs") {
        Some(jobs) if jobs.is_mapping() => {
            validate_jobs(jobs, repo_root.as_deref(), &mut result);
        }
        Some(_) => {
            result.add_issue("'jobs' section is not a mapping".to_string());
        }
        None => {
            result.add_issue("Workflow is missing 'jobs' section".to_string());
        }
    }

    // Validate top-level env is a mapping
    if let Some(env) = workflow.get("env") {
        validate_env(env, "Top-level", &mut result);
    }

    // Check for valid triggers
    match workflow.get("on") {
        Some(on) => {
            validate_triggers(on, &mut result);
        }
        None => {
            result.add_issue("Workflow is missing 'on' section (triggers)".to_string());
        }
    }

    if verbose && result.is_valid {
        println!(
            "{} Validated structure of workflow: {}",
            "✓".green(),
            path.display()
        );
    }

    Ok(result)
}

/// Walk up from the workflow file's directory to find the repository root (.git directory).
/// Returns `None` if no `.git` directory is found.
fn find_repo_root(workflow_path: &Path) -> Option<PathBuf> {
    let canonical = fs::canonicalize(workflow_path).ok()?;
    let mut dir = canonical.parent();
    while let Some(d) = dir {
        if d.join(".git").exists() {
            return Some(d.to_path_buf());
        }
        dir = d.parent();
    }
    None
}

```

### Core Architecture Module: `crates/executor/src/action_resolver.rs`
```
use once_cell::sync::Lazy;
use std::collections::{HashMap, VecDeque};
use tokio::sync::RwLock;

/// Maximum number of entries in the action resolution cache.
const MAX_CACHE_ENTRIES: usize = 256;

/// Represents the type of a GitHub Action as declared in its action.yml `runs.using` field.
#[derive(Debug, Clone)]
pub enum ActionType {
    Node {
        version: u32,
    },
    /// A Docker action that references a registry image (e.g., `rust:latest`).
    Docker {
        image: String,
    },
    /// A Docker action that bundles its own Dockerfile and needs to be built.
    DockerBuild,
    Composite,
}

/// Result of resolving a remote action's action.yml.
#[derive(Debug, Clone)]
pub struct ResolvedAction {
    pub action_type: ActionType,
    /// The raw parsed action.yml, available for composite action execution.
    pub definition: Option<serde_yaml::Value>,
}

/// Bounded FIFO cache for successfully resolved actions keyed by "owner/repo@version".
/// Only successful resolutions are cached — transient failures are not persisted
/// so that retries can succeed if network conditions improve.
/// Eviction is insertion-order (FIFO), not access-order, which is sufficient here
/// because actions are typically resolved once per workflow run.
struct BoundedCache {
    map: HashMap<String, ResolvedAction>,
    /// Insertion order for FIFO eviction (oldest at front).
    order: VecDeque<String>,
}

impl BoundedCache {
    fn new() -> Self {
        Self {
            map: HashMap::new(),
            order: VecDeque::new(),
        }
    }

    fn get(&self, key: &str) -> Option<&ResolvedAction> {
        self.map.get(key)
    }

    #[allow(clippy::map_entry)]
    fn insert(&mut self, key: String, value: ResolvedAction) {
        if self.map.contains_key(&key) {
            // Already cached — update value, don't change insertion order
            self.map.insert(key, value);
            return;
        }
        // Evict oldest entries if at capacity
        while self.map.len() >= MAX_CACHE_ENTRIES {
            if let Some(oldest) = self.order.pop_front() {
                self.map.remove(&oldest);
            }
        }
        self.order.push_back(key.clone());
        self.map.insert(key, value);
    }
}

static ACTION_CACHE: Lazy<RwLock<BoundedCache>> = Lazy::new(|| RwLock::new(BoundedCache::new()));

/// Shared HTTP client to avoid repeated TLS initialization.
/// Timeout is kept low (5s) since resolution is best-effort with a fallback.
static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("wrkflw")
        .build()
        .expect("Failed to create HTTP client")
});

/// Shared no-redirect HTTP client for authenticated requests.
/// Prevents leaking the GITHUB_TOKEN to redirect targets (e.g., CDN hosts).
/// Reused across requests to avoid per-request TLS initialization.
static NO_REDIRECT_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("wrkflw")
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("Failed to create no-redirect HTTP client")
});

const GITHUB_RAW_BASE_URL: &str = "https://raw.githubusercontent.com";

/// Fetch and parse `action.yml` (or `action.yaml`) from a remote GitHub repository.
///
/// `sub_path` is the optional path within the repo (e.g., for `owner/repo/path@ref`,
/// `sub_path` is `Some("path")`). When present, the action metadata is fetched from
/// `{repo}/{version}/{sub_path}/action.yml` instead of `{repo}/{version}/action.yml`.
///
/// Returns `Ok(ResolvedAction)` on success, or `Err` if the action metadata cannot be
/// fetched or parsed. Callers should fall back to hardcoded image mappings on error.
pub async fn resolve_remote_action(
    repo: &str,
    version: &str,
    sub_path: Option<&str>,
) -> Result<ResolvedAction, String> {
    let cache_key = match sub_path {
        Some(p) => format!("{}/{}@{}", repo, p, version),
        None => format!("{}@{}", repo, version),
    };

    // Check cache first (read lock — allows concurrent reads)
    {
        let cache = ACTION_CACHE.read().await;
        if let Some(cached) = cache.get(&cache_key) {
            return Ok(cached.clone());
        }
    }

    let token = std::env::var("GITHUB_TOKEN").ok();

    // Try action.yml first, then action.yaml
    let result = match fetch_and_parse(
        GITHUB_RAW_BASE_URL,
        repo,
        version,
        sub_path,
        "action.yml",
        token.as_deref(),
    )
    .await
    {
        Ok(resolved) => Ok(resolved),
        Err(yml_err) => fetch_and_parse(
            GITHUB_RAW_BASE_URL,
            repo,
            version,
            sub_path,
            "action.yaml",
            token.as_deref(),
        )
        .await
        .map_err(|yaml_err| {
            format!(
                "Neither action.yml ({}) nor action.yaml ({}) could be resolved",
                yml_err, yaml_err
            )
        }),
    };

    // Only cache successful resolutions — transient failures should be retryable
    if let Ok(ref resolved) = result {
        let mut cache = ACTION_CACHE.write().await;
        cache.insert(cache_key, resolved.clone());
    }

    result
}

async fn fetch_and_parse(
    base_url: &str,
    repo: &str,
    version: &str,
    sub_path: Option<&str>,
    filename: &str,
    token: Option<&str>,
) -> Result<ResolvedAction, String> {
    let url = match sub_path {
        Some(p) => format!("{}/{}/{}/{}/{}", base_url, repo, version, p, filename),
        None => format!("{}/{}/{}/{}", base_url, repo, version, filename),
    };

    // Try unauthenticated first; only send GITHUB_TOKEN on 404 (private repos).
    let response = HTTP_CLIENT
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch {}: {}", url, e))?;

    let response =
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            // Retry with auth if token is available — the repo may be private.
            // NO_REDIRECT_CLIENT prevents leaking the token to a non-GitHub host.
            if let Some(token) = token {
                let auth_response = NO_REDIRECT_CLIENT
                    .get(&url)
                    .header("Authorization", format!("token {}", token))
                    .send()
                    .await
                    .map_err(|e| format!("Failed to fetch {}: {}", url, e))?;

                // The no-redirect policy prevents token leakage, but the server may
                // legitimately redirect (CDN routing). If we get a 3xx, follow it
                // without the auth header to avoid leaking the token.
                if auth_response.status().is_redirection() {
                    if let Some(location) = auth_response.headers().get(reqwest::header::LOCATION) {
                        let redirect_url = location
                            .to_str()
                            .map_err(|_| "Invalid redirect URL encoding".to_string())?;
                        HTTP_CLIENT.get(redirect_url).send().await.map_err(|e| {
                            format!("Failed to follow redirect {}: {}", redirect_url, e)
                        })?
                    } else {
                        return Err(format!(
                            "HTTP {} (redirect with no Location header) fetching {}",
                            auth_response.status(),
                            url
                        ));
                    }
                } else {
                    auth_response
                }
            } else {
                response
            }
        } else {
            response
        };

    if !response.status().is_success() {
        return Err(format!("HTTP {} fetching {}", response.status(), url));
    }

    let body = response
        .text()
        .await
        .map_e
```

### Core Architecture Module: `crates/executor/src/artifacts.rs`
```
//! Local artifact storage for GitHub Actions `actions/upload-artifact` and
//! `actions/download-artifact` emulation.
//!
//! Artifacts are stored as plain files under a per-workflow-run temporary
//! directory, preserving directory structure relative to the workspace.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Sanitize an artifact name to prevent path traversal.
///
/// Rejects names containing path separators or `..` components and strips
/// null bytes. Returns an error if the name is invalid.
fn sanitize_artifact_name(name: &str) -> Result<String, String> {
    if name.is_empty() {
        return Err("Artifact name cannot be empty".to_string());
    }
    // Reject names containing null bytes outright rather than silently stripping
    // (stripping could create collisions, e.g. "foo\0bar" → "foobar").
    if name.contains('\0') {
        return Err(format!(
            "Invalid artifact name '{}': contains null bytes",
            name
        ));
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") || name.starts_with('.') {
        return Err(format!(
            "Invalid artifact name '{}': must not contain path separators, '..', or start with '.'",
            name
        ));
    }
    Ok(name.to_string())
}

/// Recursively collect all regular files under `dir`, skipping symlinks.
fn walk_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory '{}': {}", dir.display(), e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        // Skip symlinks to prevent following links outside the artifact tree
        if path.is_symlink() {
            continue;
        }
        if path.is_dir() {
            files.extend(walk_files(&path)?);
        } else {
            files.push(path);
        }
    }
    Ok(files)
}

struct ArtifactMetadata {
    /// Path to the artifact directory on disk.
    path: PathBuf,
}

/// Manages artifact storage for a single workflow run.
#[derive(Clone)]
pub struct ArtifactStore {
    root: PathBuf,
    index: Arc<RwLock<HashMap<String, ArtifactMetadata>>>,
}

impl ArtifactStore {
    /// Create a new artifact store under `run_dir/artifacts/`.
    pub fn new(run_dir: &Path) -> std::io::Result<Self> {
        let root = run_dir.join("artifacts");
        std::fs::create_dir_all(&root)?;
        Ok(Self {
            root,
            index: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Upload files matching a glob pattern into a named artifact.
    ///
    /// Files are copied from `workspace` preserving their relative paths.
    /// Returns the number of files uploaded.
    pub async fn upload(
        &self,
        name: &str,
        path_pattern: &str,
        workspace: &Path,
    ) -> Result<usize, String> {
        let safe_name = sanitize_artifact_name(name)?;
        let artifact_dir = self.root.join(&safe_name);
        let workspace = workspace.to_path_buf();
        let pattern = path_pattern.to_string();

        let ad = artifact_dir.clone();
        let ws = workspace.clone();
        let count = tokio::task::spawn_blocking(move || -> Result<usize, String> {
            std::fs::create_dir_all(&ad)
                .map_err(|e| format!("Failed to create artifact directory: {}", e))?;

            let canonical_workspace = ws
                .canonicalize()
                .map_err(|e| format!("Failed to canonicalize workspace: {}", e))?;
            let full_pattern = ws.join(&pattern).to_string_lossy().to_string();
            // Collect (original, canonical) pairs in one pass to avoid
            // double-canonicalize per file.
            let entries: Vec<(PathBuf, PathBuf)> = glob::glob(&full_pattern)
                .map_err(|e| format!("Invalid glob pattern '{}': {}", pattern, e))?
                .filter_map(|e| e.ok())
                .filter(|p| p.is_file() && !p.is_symlink())
                .filter_map(|p| {
                    p.canonicalize()
                        .ok()
                        .filter(|c| c.starts_with(&canonical_workspace))
                        .map(|c| (p, c))
                })
                .collect();

            if entries.is_empty() {
                return Err(format!(
                    "No files found matching pattern '{}' in {}",
                    pattern,
                    ws.display()
                ));
            }

            let mut count = 0;
            for (entry, canonical_entry) in &entries {
                let rel = canonical_entry
                    .strip_prefix(&canonical_workspace)
                    .map_err(|_| {
                        format!(
                            "File '{}' is not within workspace '{}'",
                            entry.display(),
                            ws.display()
                        )
                    })?;
                let dest = ad.join(rel);
                if let Some(parent) = dest.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create directory: {}", e))?;
                }
                std::fs::copy(entry, &dest)
                    .map_err(|e| format!("Failed to copy '{}': {}", entry.display(), e))?;
                count += 1;
            }
            Ok(count)
        })
        .await
        .map_err(|e| format!("Upload task panicked: {}", e))??;

        let mut idx = self.index.write().await;
        idx.insert(
            safe_name.to_string(),
            ArtifactMetadata { path: artifact_dir },
        );

        Ok(count)
    }

    /// Download a named artifact into `target_dir`.
    ///
    /// Returns the number of files downloaded.
    pub async fn download(&self, name: &str, target_dir: &Path) -> Result<usize, String> {
        let safe_name = sanitize_artifact_name(name)?;
        let idx = self.index.read().await;
        let meta = idx
            .get(&safe_name)
            .ok_or_else(|| format!("Artifact '{}' not found", name))?;

        let artifact_dir = meta.path.clone();
        let target = target_dir.to_path_buf();
        drop(idx);

        tokio::task::spawn_blocking(move || -> Result<usize, String> {
            let mut count = 0;
            for file_path in walk_files(&artifact_dir)? {
                let rel = file_path.strip_prefix(&artifact_dir).map_err(|_| {
                    format!(
                        "Artifact file '{}' is outside artifact directory '{}'",
                        file_path.display(),
                        artifact_dir.display()
                    )
                })?;
                let dest = target.join(rel);
                if let Some(parent) = dest.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create directory: {}", e))?;
                }
                std::fs::copy(&file_path, &dest)
                    .map_err(|e| format!("Failed to copy '{}': {}", file_path.display(), e))?;
                count += 1;
            }
            Ok(count)
        })
        .await
        .map_err(|e| format!("Download task panicked: {}", e))?
    }

    /// List all available artifact names.
    pub async fn list(&self) -> Vec<String> {
        let idx = self.index.read().await;
        idx.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn upload_and_download() {
        let run_dir = tempdir().unwrap();
        let workspace = tempdir().unwrap();

        // Create test files
        std::fs::write(workspace.path().join("file1.txt"), "hello").unwrap();
        std::fs::create_dir_all(workspace.path().join("sub")).unwrap();
        std::fs::write(workspace.path().join("sub/file2.txt"), "world").unwrap();

        let s
```

### Core Architecture Module: `crates/executor/src/cache.rs`
```
//! Local cache storage for GitHub Actions `actions/cache` emulation.
//!
//! Caches are stored under `~/.wrkflw/cache/` (persistent across runs)
//! and keyed by a SHA-256 hash of the cache key string.

use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

/// Default maximum cache size: 1 GiB. When the cache exceeds this limit,
/// the oldest entries (by last modification time) are evicted until the
/// total size is back under the limit.
const DEFAULT_MAX_CACHE_SIZE_BYTES: u64 = 1024 * 1024 * 1024;

/// Internal metadata file name used by `CacheStore` to store the cache key.
///
/// Used in `save_inner` (to write) and `find_by_prefix` / `copy_dir_contents`
/// (to read / skip). Keep all references consistent via this constant.
const CACHE_KEY_METADATA_FILE: &str = ".cache_key";

/// Manages a persistent local cache for workflow runs.
///
/// All public I/O methods (`restore`, `save`) run filesystem work on a
/// blocking thread via `tokio::task::spawn_blocking` to avoid stalling the
/// async executor — matching the pattern used by `ArtifactStore`.
#[derive(Clone)]
pub struct CacheStore {
    root: PathBuf,
    max_size: u64,
}

impl CacheStore {
    /// Create a new cache store. Uses `~/.wrkflw/cache/` by default.
    pub fn new() -> Result<Self, String> {
        let home = dirs::home_dir()
            .or_else(|| std::env::var("HOME").ok().map(std::path::PathBuf::from))
            .ok_or_else(|| "Could not determine home directory (HOME is not set).".to_string())?;
        let root = home.join(".wrkflw").join("cache");
        std::fs::create_dir_all(&root).map_err(|e| {
            format!(
                "Failed to create cache directory '{}': {}",
                root.display(),
                e
            )
        })?;
        Ok(Self {
            root,
            max_size: DEFAULT_MAX_CACHE_SIZE_BYTES,
        })
    }

    /// Create a cache store at a custom root (useful for testing or custom locations).
    #[allow(dead_code)]
    pub fn with_root(root: PathBuf) -> std::io::Result<Self> {
        std::fs::create_dir_all(&root)?;
        Ok(Self {
            root,
            max_size: DEFAULT_MAX_CACHE_SIZE_BYTES,
        })
    }

    /// Set the maximum cache size in bytes. When exceeded, the oldest entries
    /// are evicted after each `save`.
    #[allow(dead_code)]
    pub fn set_max_size(&mut self, max_size: u64) {
        self.max_size = max_size;
    }

    /// Attempt to restore a cache. Tries `key` first, then each of `restore_keys`
    /// as a prefix match.
    ///
    /// `path` is the directory to restore into (relative to `workspace`).
    /// Returns the matched key on hit, or `None` on miss.
    ///
    /// Filesystem I/O is offloaded to a blocking thread.
    pub async fn restore(
        &self,
        key: &str,
        restore_keys: &[String],
        path: &str,
        workspace: &Path,
    ) -> Option<String> {
        let this = self.clone();
        let key = key.to_string();
        let restore_keys = restore_keys.to_vec();
        let path = path.to_string();
        let workspace = workspace.to_path_buf();

        match tokio::task::spawn_blocking(move || {
            this.restore_inner(&key, &restore_keys, &path, &workspace)
        })
        .await
        {
            Ok(result) => result,
            Err(e) => {
                wrkflw_logging::warning(&format!("Cache restore task panicked: {}", e));
                None
            }
        }
    }

    /// Save the contents of `path` (relative to `workspace`) under `key`.
    ///
    /// Filesystem I/O is offloaded to a blocking thread.
    pub async fn save(&self, key: &str, path: &str, workspace: &Path) -> Result<(), String> {
        let this = self.clone();
        let key = key.to_string();
        let path = path.to_string();
        let workspace = workspace.to_path_buf();

        tokio::task::spawn_blocking(move || this.save_inner(&key, &path, &workspace))
            .await
            .map_err(|e| format!("Cache task panicked: {}", e))?
    }

    fn restore_inner(
        &self,
        key: &str,
        restore_keys: &[String],
        path: &str,
        workspace: &Path,
    ) -> Option<String> {
        // Validate that the resolved target stays within the workspace
        if !validate_cache_path(path, workspace) {
            return None;
        }

        // Try exact match first (composite key+path hash, then legacy key-only hash)
        for cache_dir in [self.cache_path_for(key, path), self.cache_path(key)] {
            if cache_dir.exists() {
                let target = workspace.join(path);
                if copy_dir_contents(&cache_dir, &target).is_ok() {
                    return Some(key.to_string());
                }
            }
        }

        // Try restore-keys as prefix matches
        for prefix in restore_keys {
            if let Some(matched) = self.find_by_prefix(prefix, path) {
                let cache_dir = self.cache_path_for(&matched, path);
                let target = workspace.join(path);
                if copy_dir_contents(&cache_dir, &target).is_ok() {
                    return Some(matched);
                }
                // Also try the legacy key-only hash for backwards compat
                let legacy_dir = self.cache_path(&matched);
                if legacy_dir.exists() {
                    let target = workspace.join(path);
                    if copy_dir_contents(&legacy_dir, &target).is_ok() {
                        return Some(matched);
                    }
                }
            }
        }

        None
    }

    fn save_inner(&self, key: &str, path: &str, workspace: &Path) -> Result<(), String> {
        // Validate that the resolved source stays within the workspace
        if !validate_cache_path(path, workspace) {
            return Err(format!("Cache path '{}' escapes workspace directory", path));
        }

        let source = workspace.join(path);
        if !source.exists() {
            return Err(format!("Cache path '{}' does not exist", source.display()));
        }

        let cache_dir = self.cache_path_for(key, path);
        // Write to a temporary directory first, then atomically rename over the
        // old entry. This prevents data loss if the process is killed mid-copy.
        let tmp_dir = cache_dir.with_extension(".tmp");
        if tmp_dir.exists() {
            std::fs::remove_dir_all(&tmp_dir)
                .map_err(|e| format!("Failed to clean tmp cache dir: {}", e))?;
        }

        if source.is_dir() {
            copy_dir_contents(&source, &tmp_dir)?;
        } else {
            let file_name = source
                .file_name()
                .ok_or_else(|| format!("Cache path '{}' has no file name component", path))?;
            std::fs::create_dir_all(&tmp_dir)
                .map_err(|e| format!("Failed to create cache dir: {}", e))?;
            let dest = tmp_dir.join(file_name);
            std::fs::copy(&source, &dest).map_err(|e| format!("Failed to copy file: {}", e))?;
        }

        // Write key metadata for prefix matching
        let meta_path = tmp_dir.join(CACHE_KEY_METADATA_FILE);
        std::fs::write(&meta_path, key)
            .map_err(|e| format!("Failed to write cache metadata: {}", e))?;

        // Replace old entry: rename old to `.old`, rename `.tmp` into place,
        // then remove `.old`. This is not fully atomic (no single-syscall
        // directory swap on POSIX), but minimises the window where the entry
        // is missing if the process is killed mid-operation.
        let old_dir = cache_dir.with_extension(".old");
        if old_dir.exists() {
            let _ = std::fs::remove_dir_all(&old_dir);
        }
        if cache_dir.exists() {
            std::fs::rename(&cache_dir, &old_dir)
                .map_err(|e| format!("Failed to move old cache aside: {}", e))?;
        }
        std::fs::rename(&tmp_dir, &cache_dir)
            .map_err(|e| format!("F
```

### Core Architecture Module: `crates/executor/src/dependency.rs`
```
use std::collections::{HashMap, HashSet, VecDeque};
use wrkflw_parser::workflow::{Job, WorkflowDefinition};

pub fn resolve_dependencies(workflow: &WorkflowDefinition) -> Result<Vec<Vec<String>>, String> {
    let jobs = &workflow.jobs;

    // Build adjacency list with String keys
    let mut dependencies: HashMap<String, HashSet<String>> = HashMap::new();
    let mut dependents: HashMap<String, HashSet<String>> = HashMap::new();

    // Initialize with empty dependencies
    for job_name in jobs.keys() {
        dependencies.insert(job_name.clone(), HashSet::new());
        dependents.insert(job_name.clone(), HashSet::new());
    }

    // Populate dependencies
    for (job_name, job) in jobs {
        if let Some(needs) = &job.needs {
            for needed_job in needs {
                if !jobs.contains_key(needed_job) {
                    return Err(format!(
                        "Job '{}' depends on non-existent job '{}'",
                        job_name, needed_job
                    ));
                }
                // Get mutable reference to the dependency set for this job, with error handling
                if let Some(deps) = dependencies.get_mut(job_name) {
                    deps.insert(needed_job.clone());
                } else {
                    return Err(format!(
                        "Internal error: Failed to update dependencies for job '{}'",
                        job_name
                    ));
                }

                // Get mutable reference to the dependents set for the needed job, with error handling
                if let Some(deps) = dependents.get_mut(needed_job) {
                    deps.insert(job_name.clone());
                } else {
                    return Err(format!(
                        "Internal error: Failed to update dependents for job '{}'",
                        needed_job
                    ));
                }
            }
        }
    }

    // Implement topological sort for execution ordering
    let mut result = Vec::new();
    let mut no_dependencies: HashSet<String> = dependencies
        .iter()
        .filter(|(_, deps)| deps.is_empty())
        .map(|(job, _)| job.clone())
        .collect();

    // Process levels of the dependency graph
    while !no_dependencies.is_empty() {
        // Current level becomes a batch of jobs that can run in parallel
        let current_level: Vec<String> = no_dependencies.iter().cloned().collect();
        result.push(current_level);

        // For the next level
        let mut next_no_dependencies = HashSet::new();

        for job in &no_dependencies {
            // For each dependent job of the current job
            // Get the set of dependents with error handling
            let dependent_jobs = match dependents.get(job) {
                Some(deps) => deps.clone(),
                None => {
                    return Err(format!(
                        "Internal error: Failed to find dependents for job '{}'",
                        job
                    ));
                }
            };

            for dependent in dependent_jobs {
                // Remove the current job from its dependencies
                if let Some(deps) = dependencies.get_mut(&dependent) {
                    deps.remove(job);

                    // Check if it's empty now to determine if it should be in the next level
                    if deps.is_empty() {
                        next_no_dependencies.insert(dependent);
                    }
                } else {
                    return Err(format!(
                        "Internal error: Failed to find dependencies for job '{}'",
                        dependent
                    ));
                }
            }
        }

        no_dependencies = next_no_dependencies;
    }

    // Check for circular dependencies
    let processed_jobs: HashSet<String> = result
        .iter()
        .flat_map(|level| level.iter().cloned())
        .collect();

    if processed_jobs.len() < jobs.len() {
        let unprocessed: Vec<&String> = jobs
            .keys()
            .filter(|j| !processed_jobs.contains(*j))
            .collect();
        return Err(format!(
            "Circular dependency detected in workflow jobs: {}",
            unprocessed
                .iter()
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }

    Ok(result)
}

/// Collect a job and all its transitive dependencies via `needs` edges.
pub fn collect_transitive_deps(target_job: &str, jobs: &HashMap<String, Job>) -> HashSet<String> {
    let mut deps = HashSet::new();
    let mut queue = VecDeque::new();

    deps.insert(target_job.to_string());
    queue.push_back(target_job.to_string());

    while let Some(job_name) = queue.pop_front() {
        if let Some(job) = jobs.get(&job_name) {
            if let Some(needs) = &job.needs {
                for needed in needs {
                    if deps.insert(needed.clone()) {
                        queue.push_back(needed.clone());
                    }
                }
            }
        }
    }

    deps
}

/// Filter an execution plan to only include a target job and its transitive
/// dependencies. Returns an error if the target job doesn't exist.
pub fn filter_plan_to_job(
    plan: Vec<Vec<String>>,
    target_job: &str,
    jobs: &HashMap<String, Job>,
    kind: &str,
) -> Result<Vec<Vec<String>>, String> {
    if !jobs.contains_key(target_job) {
        return Err(job_not_found_error(target_job, jobs, kind));
    }

    let needed = collect_transitive_deps(target_job, jobs);

    Ok(plan
        .into_iter()
        .map(|batch| {
            batch
                .into_iter()
                .filter(|j| needed.contains(j))
                .collect::<Vec<_>>()
        })
        .filter(|batch| !batch.is_empty())
        .collect())
}

/// Filter a stage-ordered execution plan to only include the target job and all
/// jobs in preceding stages (implicit dependencies). This is appropriate for
/// GitLab CI/CD where stage ordering defines implicit dependencies — all jobs in
/// earlier stages must complete before later stages run.
///
/// In the target job's own stage batch, only the target job is kept; all earlier
/// stage batches are preserved in full.
pub fn filter_plan_to_job_by_stage(
    plan: Vec<Vec<String>>,
    target_job: &str,
    jobs: &HashMap<String, Job>,
    kind: &str,
) -> Result<Vec<Vec<String>>, String> {
    if !jobs.contains_key(target_job) {
        return Err(job_not_found_error(target_job, jobs, kind));
    }

    let mut result = Vec::new();
    for batch in plan {
        if batch.contains(&target_job.to_string()) {
            // Target's stage: only keep the target job itself
            result.push(vec![target_job.to_string()]);
            break;
        }
        // Earlier stage: keep all jobs (implicit dependencies)
        result.push(batch);
    }

    Ok(result)
}

fn job_not_found_error(target_job: &str, jobs: &HashMap<String, Job>, kind: &str) -> String {
    let mut available: Vec<&String> = jobs.keys().collect();
    available.sort();
    format!(
        "Job '{}' not found in {}. Available jobs: {}",
        target_job,
        kind,
        available
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn job_with_needs(needs: Option<Vec<&str>>) -> Job {
        Job {
            runs_on: None,
            needs: needs.map(|v| v.into_iter().map(String::from).collect()),
            container: None,
            steps: vec![],
            env: HashMap::new(),
            strategy: None,
            services: HashMap::new(),
            if_condition: None,
            outputs: None,
            permissions: None,
            uses: None,
            with: None,
            secrets: None,
            timeout_mi
```

### Core Architecture Module: `crates/executor/src/docker.rs`
```
use async_trait::async_trait;
use bollard::{
    container::{Config, CreateContainerOptions},
    models::HostConfig,
    network::CreateNetworkOptions,
    Docker,
};
use futures_util::StreamExt;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use wrkflw_logging;
use wrkflw_runtime::container::{
    ContainerError, ContainerOutput, ContainerRuntime, COMBINED_IMAGE_PREFIX, LOCAL_IMAGE_PREFIX,
};
use wrkflw_utils;
use wrkflw_utils::fd;

static RUNNING_CONTAINERS: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));
static CREATED_NETWORKS: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));
// Map to track customized images for a job
#[allow(dead_code)]
static CUSTOMIZED_IMAGES: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub struct DockerRuntime {
    docker: Docker,
    preserve_containers_on_failure: bool,
}

impl DockerRuntime {
    pub fn new() -> Result<Self, ContainerError> {
        Self::new_with_config(false)
    }

    pub fn new_with_config(preserve_containers_on_failure: bool) -> Result<Self, ContainerError> {
        let docker = Docker::connect_with_local_defaults().map_err(|e| {
            ContainerError::ContainerStart(format!("Failed to connect to Docker: {}", e))
        })?;

        Ok(DockerRuntime {
            docker,
            preserve_containers_on_failure,
        })
    }

    // Add a method to store and retrieve customized images (e.g., with Python installed)
    #[allow(dead_code)]
    pub fn get_customized_image(base_image: &str, customization: &str) -> Option<String> {
        let key = format!("{}:{}", base_image, customization);
        match CUSTOMIZED_IMAGES.lock() {
            Ok(images) => images.get(&key).cloned(),
            Err(e) => {
                wrkflw_logging::error(&format!("Failed to acquire lock: {}", e));
                None
            }
        }
    }

    #[allow(dead_code)]
    pub fn set_customized_image(base_image: &str, customization: &str, new_image: &str) {
        let key = format!("{}:{}", base_image, customization);
        if let Err(e) = CUSTOMIZED_IMAGES.lock().map(|mut images| {
            images.insert(key, new_image.to_string());
        }) {
            wrkflw_logging::error(&format!("Failed to acquire lock: {}", e));
        }
    }

    /// Find a customized image key by prefix
    #[allow(dead_code)]
    pub fn find_customized_image_key(image: &str, prefix: &str) -> Option<String> {
        let image_keys = match CUSTOMIZED_IMAGES.lock() {
            Ok(keys) => keys,
            Err(e) => {
                wrkflw_logging::error(&format!("Failed to acquire lock: {}", e));
                return None;
            }
        };

        // Look for any key that starts with the prefix
        for key in image_keys.keys() {
            if key.starts_with(prefix) {
                return Some(key.clone());
            }
        }

        None
    }

    /// Get a customized image with language-specific dependencies
    pub fn get_language_specific_image(
        base_image: &str,
        language: &str,
        version: Option<&str>,
    ) -> Option<String> {
        let key = match (language, version) {
            ("python", Some(ver)) => format!("python:{}", ver),
            ("node", Some(ver)) => format!("node:{}", ver),
            ("java", Some(ver)) => format!("eclipse-temurin:{}", ver),
            ("go", Some(ver)) => format!("golang:{}", ver),
            ("dotnet", Some(ver)) => format!("mcr.microsoft.com/dotnet/sdk:{}", ver),
            ("rust", Some(ver)) => format!("rust:{}", ver),
            (lang, Some(ver)) => format!("{}:{}", lang, ver),
            (lang, None) => lang.to_string(),
        };

        match CUSTOMIZED_IMAGES.lock() {
            Ok(images) => images.get(&key).cloned(),
            Err(e) => {
                wrkflw_logging::error(&format!("Failed to acquire lock: {}", e));
                None
            }
        }
    }

    /// Set a customized image with language-specific dependencies
    pub fn set_language_specific_image(
        base_image: &str,
        language: &str,
        version: Option<&str>,
        new_image: &str,
    ) {
        let key = match (language, version) {
            ("python", Some(ver)) => format!("python:{}", ver),
            ("node", Some(ver)) => format!("node:{}", ver),
            ("java", Some(ver)) => format!("eclipse-temurin:{}", ver),
            ("go", Some(ver)) => format!("golang:{}", ver),
            ("dotnet", Some(ver)) => format!("mcr.microsoft.com/dotnet/sdk:{}", ver),
            ("rust", Some(ver)) => format!("rust:{}", ver),
            (lang, Some(ver)) => format!("{}:{}", lang, ver),
            (lang, None) => lang.to_string(),
        };

        if let Err(e) = CUSTOMIZED_IMAGES.lock().map(|mut images| {
            images.insert(key, new_image.to_string());
        }) {
            wrkflw_logging::error(&format!("Failed to acquire lock: {}", e));
        }
    }

    /// Prepare a language-specific environment
    #[allow(dead_code)]
    pub async fn prepare_language_environment(
        &self,
        language: &str,
        version: Option<&str>,
        additional_packages: Option<Vec<String>>,
    ) -> Result<String, ContainerError> {
        // Check if we already have a customized image for this language and version
        let key = format!("{}-{}", language, version.unwrap_or("latest"));
        if let Some(customized_image) = Self::get_language_specific_image("", language, version) {
            return Ok(customized_image);
        }

        // Create a temporary Dockerfile for customization
        let temp_dir = tempfile::tempdir().map_err(|e| {
            ContainerError::ContainerStart(format!("Failed to create temp directory: {}", e))
        })?;

        let dockerfile_path = temp_dir.path().join("Dockerfile");
        let mut dockerfile_content = String::new();

        // Add language-specific setup based on the language
        match language {
            "python" => {
                let base_image =
                    version.map_or("python:3.11-slim".to_string(), |v| format!("python:{}", v));
                dockerfile_content.push_str(&format!("FROM {}\n\n", base_image));
                dockerfile_content.push_str(
                    "RUN apt-get update && apt-get install -y --no-install-recommends \\\n",
                );
                dockerfile_content.push_str("    build-essential \\\n");
                dockerfile_content.push_str("    && rm -rf /var/lib/apt/lists/*\n");

                if let Some(packages) = additional_packages {
                    for package in packages {
                        dockerfile_content.push_str(&format!("RUN pip install {}\n", package));
                    }
                }
            }
            "node" => {
                let base_image =
                    version.map_or("node:20-slim".to_string(), |v| format!("node:{}", v));
                dockerfile_content.push_str(&format!("FROM {}\n\n", base_image));
                dockerfile_content.push_str(
                    "RUN apt-get update && apt-get install -y --no-install-recommends \\\n",
                );
                dockerfile_content.push_str("    build-essential \\\n");
                dockerfile_content.push_str("    && rm -rf /var/lib/apt/lists/*\n");

                if let Some(packages) = additional_packages {
                    for package in packages {
                        dockerfile_content.push_str(&format!("RUN npm install -g {}\n", package));
                    }
                }
            }
            "java" => {
                let base_image = version.map_or("eclipse-temurin:17-jdk".to_string(), |v| {
                    format!("eclipse-temurin:{}", v)
                });
                dockerfile_content.push_str(&format!("FROM {}\n\n", base_image));
                dockerfile_content.push
```

### Core Architecture Module: `crates/executor/src/engine.rs`
```
#[allow(unused_imports)]
use bollard::Docker;
use futures::future;
use once_cell::sync::Lazy;
use serde_yaml::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
// std::process::Command replaced by tokio::process::Command for async safety
use thiserror::Error;

use ignore::{gitignore::GitignoreBuilder, Match};

use crate::action_resolver;
use crate::dependency;
use crate::docker;
use crate::environment;
use crate::podman;
use wrkflw_logging;
use wrkflw_matrix::MatrixCombination;
use wrkflw_models::gitlab::Pipeline;
use wrkflw_parser::gitlab::{self, parse_pipeline};
use wrkflw_parser::workflow::{
    self, parse_workflow, ActionInfo, Job, JobContainer, Step, WorkflowDefinition,
};
use wrkflw_runtime::container::{ContainerRuntime, COMBINED_IMAGE_PREFIX};
use wrkflw_runtime::emulation;
use wrkflw_secrets::{SecretConfig, SecretManager, SecretMasker, SecretSubstitution};

#[allow(unused_variables, unused_assignments)]
/// Execute a GitHub Actions workflow file locally
pub async fn execute_workflow(
    workflow_path: &Path,
    config: ExecutionConfig,
) -> Result<ExecutionResult, ExecutionError> {
    wrkflw_logging::info(&format!("Executing workflow: {}", workflow_path.display()));
    wrkflw_logging::info(&format!("Runtime: {:?}", config.runtime_type));

    // Determine if this is a GitLab CI/CD pipeline or GitHub Actions workflow
    let is_gitlab = is_gitlab_pipeline(workflow_path);

    if is_gitlab {
        execute_gitlab_pipeline(workflow_path, config.clone()).await
    } else {
        execute_github_workflow(workflow_path, config.clone()).await
    }
}

/// Determine if a file is a GitLab CI/CD pipeline
fn is_gitlab_pipeline(path: &Path) -> bool {
    // Check the file name
    if let Some(file_name) = path.file_name() {
        if let Some(file_name_str) = file_name.to_str() {
            return file_name_str == ".gitlab-ci.yml" || file_name_str.ends_with("gitlab-ci.yml");
        }
    }

    // If file name check fails, try to read and determine by content
    if let Ok(content) = fs::read_to_string(path) {
        // GitLab CI/CD pipelines typically have stages, before_script, after_script at the top level
        if content.contains("stages:")
            || content.contains("before_script:")
            || content.contains("after_script:")
        {
            // Check for GitHub Actions specific keys that would indicate it's not GitLab
            if !content.contains("on:")
                && !content.contains("runs-on:")
                && !content.contains("uses:")
            {
                return true;
            }
        }
    }

    false
}

/// Execute a GitHub Actions workflow file locally
async fn execute_github_workflow(
    workflow_path: &Path,
    mut config: ExecutionConfig,
) -> Result<ExecutionResult, ExecutionError> {
    config.runtime_type = detect_runtime(config.runtime_type);
    // 1. Parse workflow file
    let workflow = parse_workflow(workflow_path)?;

    // 2. Resolve job dependencies and create execution plan
    let execution_plan = dependency::resolve_dependencies(&workflow)?;

    // Filter to target job and its transitive dependencies if specified
    let execution_plan = if let Some(ref target_job) = config.target_job {
        dependency::filter_plan_to_job(execution_plan, target_job, &workflow.jobs, "workflow")
            .map_err(ExecutionError::Execution)?
    } else {
        execution_plan
    };

    // 3. Initialize appropriate runtime
    let runtime = initialize_runtime(
        config.runtime_type.clone(),
        config.preserve_containers_on_failure,
    )?;

    // Create a temporary workspace directory
    let workspace_dir = tempfile::tempdir()
        .map_err(|e| ExecutionError::Execution(format!("Failed to create workspace: {}", e)))?;

    // 4. Set up GitHub-like environment
    let mut env_context = environment::create_github_context(&workflow, workspace_dir.path());
    // Track the user-declared slice of env separately so `toJSON(env)` only
    // dumps what the user actually wrote in YAML (and later, what steps write
    // to `$GITHUB_ENV`). Starts empty — `create_github_context` only seeds
    // runner-internal vars.
    let mut user_env: HashMap<String, String> = HashMap::new();

    // Add workflow-level environment variables (lowest precedence — does not override
    // built-in GITHUB_*/RUNNER_* vars; job and step env override these later).
    // Resolve ${{ }} expressions (e.g. ${{ github.repository }}) in values.
    {
        // At this point workflow.env hasn't been merged yet — user_env is empty.
        let wf_expr_ctx = crate::expression::ExpressionContext {
            env_context: &env_context,
            step_outputs: &HashMap::new(),
            matrix_combination: &None,
            step_statuses: &HashMap::new(),
            job_status: "success",
            secrets_context: &HashMap::new(),
            needs_context: &HashMap::new(),
            needs_results: &HashMap::new(),
            user_env: &user_env,
        };
        let cwd = std::env::current_dir().map_err(|e| {
            ExecutionError::Execution(format!("Failed to get current directory: {}", e))
        })?;
        let resolved_env: Vec<(String, String)> = workflow
            .env
            .iter()
            .map(|(key, value)| {
                let resolved =
                    crate::substitution::preprocess_expressions(value, &cwd, &wf_expr_ctx)
                        .unwrap_or_else(|_| value.clone());
                (key.clone(), resolved)
            })
            .collect();
        for (key, value) in resolved_env {
            // `or_insert` semantics: workflow.env does not override runner-seeded
            // vars. user_env mirrors the same precedence — a workflow.env key that
            // collides with a runner var is dropped from env_context AND not added
            // to user_env (real GHA doesn't let workflow.env shadow runner vars).
            env_context.entry(key.clone()).or_insert_with(|| {
                user_env.insert(key, value.clone());
                value
            });
        }
    }

    // Add runtime mode to environment
    env_context.insert(
        "WRKFLW_RUNTIME_MODE".to_string(),
        match config.runtime_type {
            RuntimeType::Auto => "auto".to_string(),
            RuntimeType::Emulation => "emulation".to_string(),
            RuntimeType::SecureEmulation => "secure_emulation".to_string(),
            RuntimeType::Docker => "docker".to_string(),
            RuntimeType::Podman => "podman".to_string(),
        },
    );

    // show=true means hide=false (inverted for the env var)
    env_context.insert(
        "WRKFLW_HIDE_ACTION_MESSAGES".to_string(),
        if config.show_action_messages {
            "false"
        } else {
            "true"
        }
        .to_string(),
    );

    // Setup GitHub environment files
    environment::setup_github_environment_files(workspace_dir.path()).map_err(|e| {
        ExecutionError::Execution(format!("Failed to setup GitHub env files: {}", e))
    })?;

    // 5. Initialize secrets management
    let secret_manager = if let Some(secrets_config) = &config.secrets_config {
        Some(
            SecretManager::new(secrets_config.clone())
                .await
                .map_err(|e| {
                    ExecutionError::Execution(format!("Failed to initialize secret manager: {}", e))
                })?,
        )
    } else {
        Some(SecretManager::default().await.map_err(|e| {
            ExecutionError::Execution(format!(
                "Failed to initialize default secret manager: {}",
                e
            ))
        })?)
    };

    let secret_masker = SecretMasker::new();

    // Create artifact store for this workflow run
    let artifact_store =
        crate::artifacts::ArtifactStore::new(workspace_dir.path()).map_err(|e| {
            ExecutionError::Execution(format!("Fail
```

### Core Architecture Module: `crates/executor/src/environment.rs`
```
use chrono::Utc;
use serde_json;
use serde_yaml::Value;
use std::{collections::HashMap, fs, io, path::Path};
use wrkflw_matrix::MatrixCombination;
use wrkflw_parser::workflow::WorkflowDefinition;

pub fn setup_github_environment_files(workspace_dir: &Path) -> io::Result<()> {
    // Create necessary directories
    let github_dir = workspace_dir.join("github");
    fs::create_dir_all(&github_dir)?;

    // Create common GitHub environment files
    let github_output = github_dir.join("output");
    let github_env = github_dir.join("env");
    let github_path = github_dir.join("path");
    let github_step_summary = github_dir.join("step_summary");

    // Initialize files with empty content
    fs::write(&github_output, "")?;
    fs::write(&github_env, "")?;
    fs::write(&github_path, "")?;
    fs::write(&github_step_summary, "")?;

    Ok(())
}

pub fn create_github_context(
    workflow: &WorkflowDefinition,
    workspace_dir: &Path,
) -> HashMap<String, String> {
    let mut env = HashMap::new();

    // Basic GitHub environment variables
    env.insert("GITHUB_WORKFLOW".to_string(), workflow.name.clone());
    env.insert("GITHUB_ACTION".to_string(), "run".to_string());
    env.insert("GITHUB_REPOSITORY".to_string(), get_repo_name());
    env.insert("GITHUB_EVENT_NAME".to_string(), get_event_name(workflow));
    env.insert("GITHUB_WORKSPACE".to_string(), get_workspace_path());
    env.insert("GITHUB_SHA".to_string(), get_current_sha());
    env.insert("GITHUB_REF".to_string(), get_current_ref());

    // File paths for GitHub Actions
    env.insert(
        "GITHUB_OUTPUT".to_string(),
        workspace_dir
            .join("github")
            .join("output")
            .to_string_lossy()
            .to_string(),
    );
    env.insert(
        "GITHUB_ENV".to_string(),
        workspace_dir
            .join("github")
            .join("env")
            .to_string_lossy()
            .to_string(),
    );
    env.insert(
        "GITHUB_PATH".to_string(),
        workspace_dir
            .join("github")
            .join("path")
            .to_string_lossy()
            .to_string(),
    );
    env.insert(
        "GITHUB_STEP_SUMMARY".to_string(),
        workspace_dir
            .join("github")
            .join("step_summary")
            .to_string_lossy()
            .to_string(),
    );

    // Time-related variables
    let now = Utc::now();
    env.insert("GITHUB_RUN_ID".to_string(), format!("{}", now.timestamp()));
    env.insert("GITHUB_RUN_NUMBER".to_string(), "1".to_string());
    env.insert("GITHUB_RUN_ATTEMPT".to_string(), "1".to_string());

    // CI detection variables
    env.insert("GITHUB_ACTIONS".to_string(), "true".to_string());
    env.insert("CI".to_string(), "true".to_string());

    // GitHub URLs
    env.insert(
        "GITHUB_SERVER_URL".to_string(),
        "https://github.com".to_string(),
    );
    env.insert(
        "GITHUB_API_URL".to_string(),
        "https://api.github.com".to_string(),
    );
    env.insert(
        "GITHUB_GRAPHQL_URL".to_string(),
        "https://api.github.com/graphql".to_string(),
    );

    // Ref-derived variables
    let full_ref = env.get("GITHUB_REF").cloned().unwrap_or_default();
    env.insert("GITHUB_REF_NAME".to_string(), get_ref_name(&full_ref));
    env.insert("GITHUB_REF_TYPE".to_string(), get_ref_type(&full_ref));

    // PR-related variables (empty for local runs)
    env.insert("GITHUB_HEAD_REF".to_string(), String::new());
    env.insert("GITHUB_BASE_REF".to_string(), String::new());

    // Actor-related variables
    let actor = get_actor();
    env.insert("GITHUB_ACTOR".to_string(), actor.clone());
    env.insert("GITHUB_TRIGGERING_ACTOR".to_string(), actor);

    // Repository owner
    let repo = env.get("GITHUB_REPOSITORY").cloned().unwrap_or_default();
    env.insert(
        "GITHUB_REPOSITORY_OWNER".to_string(),
        get_repository_owner(&repo),
    );

    // Miscellaneous
    env.insert("GITHUB_RETENTION_DAYS".to_string(), "90".to_string());

    // Runner variables
    env.insert("RUNNER_OS".to_string(), get_runner_os());
    env.insert("RUNNER_ARCH".to_string(), get_runner_arch());
    env.insert("RUNNER_NAME".to_string(), "wrkflw-local".to_string());
    env.insert("RUNNER_ENVIRONMENT".to_string(), "local".to_string());
    env.insert("RUNNER_TEMP".to_string(), get_temp_dir());
    env.insert("RUNNER_TOOL_CACHE".to_string(), get_tool_cache_dir());

    env
}

/// Add job-specific context variables to the environment
pub fn add_job_context(env: &mut HashMap<String, String>, job_name: &str) {
    env.insert("GITHUB_JOB".to_string(), job_name.to_string());
}

/// Add matrix context variables to the environment
pub fn add_matrix_context(
    env: &mut HashMap<String, String>,
    matrix_combination: &MatrixCombination,
) {
    // Add each matrix parameter as an environment variable
    for (key, value) in &matrix_combination.values {
        let env_key = format!("MATRIX_{}", key.to_uppercase());
        let env_value = value_to_string(value);
        env.insert(env_key, env_value);
    }

    // Also serialize the whole matrix as JSON for potential use
    if let Ok(json_value) = serde_json::to_string(&matrix_combination.values) {
        env.insert("MATRIX_CONTEXT".to_string(), json_value);
    }
}

/// Convert a serde_yaml::Value to a string for environment variables
fn value_to_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Sequence(seq) => {
            let items = seq
                .iter()
                .map(value_to_string)
                .collect::<Vec<_>>()
                .join(",");
            items
        }
        Value::Mapping(map) => {
            let items = map
                .iter()
                .map(|(k, v)| format!("{}={}", value_to_string(k), value_to_string(v)))
                .collect::<Vec<_>>()
                .join(",");
            items
        }
        Value::Null => "".to_string(),
        _ => "".to_string(),
    }
}

fn get_repo_name() -> String {
    // Try to detect from git if available
    if let Ok(output) = std::process::Command::new("git")
        .args(["remote", "get-url", "origin"])
        .output()
    {
        if output.status.success() {
            let url = String::from_utf8_lossy(&output.stdout);
            if let Some(repo) = extract_repo_from_url(&url) {
                return repo;
            }
        }
    }

    // Fallback to directory name
    let current_dir = std::env::current_dir().unwrap_or_default();
    format!(
        "wrkflw/{}",
        current_dir
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
    )
}

fn extract_repo_from_url(url: &str) -> Option<String> {
    // Extract owner/repo from common git URLs
    let url = url.trim();

    // Handle SSH URLs: git@github.com:owner/repo.git
    if url.starts_with("git@") {
        let parts: Vec<&str> = url.split(':').collect();
        if parts.len() == 2 {
            let repo_part = parts[1].trim_end_matches(".git");
            return Some(repo_part.to_string());
        }
    }

    // Handle HTTPS URLs: https://github.com/owner/repo.git
    if url.starts_with("http") {
        let without_protocol = url.split("://").nth(1)?;
        let parts: Vec<&str> = without_protocol.split('/').collect();
        if parts.len() >= 3 {
            let owner = parts[1];
            let repo = parts[2].trim_end_matches(".git");
            return Some(format!("{}/{}", owner, repo));
        }
    }

    None
}

fn get_event_name(workflow: &WorkflowDefinition) -> String {
    // Try to extract from the workflow trigger
    if let Some(first_trigger) = workflow.on.first() {
        return first_trigger.clone();
    }
    "workflow_dispatch".to_string()
}

fn get_workspace_path() -> String {
    std::env::current_dir()
        .unwrap_or_default()
     
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #129** (2026-09-08): **refactor(ui): drop the write-only WorkflowExecution.logs field**
  *Symptoms*: TODO item 4 (`P3`, refactor) from the follow-up list off the PR #116 review. Fourth and last item in that series, after #119, #127 and #128.  ## What the item asked for, and why this PR does something else  The item was written against a pre-#119 tree. It asked to delete the ad-hoc `trim_logs_to_cap()` calls in `check_diff_filter_results`, rewrite the stale comment block above them, and route ~7 hand-rolled `Local::now().format("%H:%M:%S")` sites through `add_timestamped_log`.  Auditing that against current `main`:  - **The trim calls and the stale comment are already gone.** #119 removed all six ad-hoc calls and the "Ad-hoc `self.logs.push(...)`" comment. The single surviving call lives in `mark_logs_for_update`, which is the choke point every log mutation routes through — it belongs there. - **Only three of the ~7 timestamp sites survived.** One is `add_timestamped_log` itself. The other two are in `process_execution_result`, and they write to `WorkflowExecution.logs` — not to the app log buffer.  `WorkflowExecution.logs` has five writers and zero readers. Every view that touches `execution_details` renders `.jobs`, `.start_time` or `.progress`; none of them read `.logs`.  Doing what the item literally said would have been a regression. Both arms of `process_execution_result` already report their outcome through `wrkflw_logging`, and `get_combined_logs` merges that store into the app buffer without deduplicating. Routing those two pushes through `add_timestamped_log` would 

- **Issue #128** (2026-09-08): **fix(ui): stop logging the same TUI message to both log sinks**
  *Symptoms*: TODO item 3, follow-up from the review of PR #116.  ## The problem  The TUI keeps two log buffers: the app-local `logs` vec and the global `wrkflw_logging` store. `get_combined_logs` concatenates them with no deduplication, so any code path reporting an event to both sinks rendered it twice in the Logs and Execution tabs.  The ticket named one such message, "Executing workflow". Auditing the crate turned up **24 dual-logged sites**, not one:  | File | Sites | |---|---| | `crates/ui/src/app/state.rs` | 12 | | `crates/ui/src/app/mod.rs` | 6 | | `crates/ui/src/handlers/workflow.rs` | 6 |  Every workflow execution, trigger, and reset was being double-reported.  ## The fix  At each site the app-side push is deleted and the `wrkflw_logging` call kept. This is the same resolution PR #116 applied to the Docker and Podman warnings, and it is not an arbitrary choice: the global store stamps its own `[HH:MM:SS]` prefix and a level glyph, so the surviving copy is the one that renders with a real timestamp and the correct badge.  `add_timestamped_log` now documents the one-message-one-sink rule so this does not creep back in.  ## Badges improve as a side effect  `LogBadge::classify` checks the level glyph in the same tier as the level keyword, so five lines stop misreporting their severity:  - `Workflow 'x' failed: ...` was INFO, now ERROR - the "no workflow selected" lines were INFO, now WARN - `Cannot trigger workflow in Success state` was misbadged SUCCESS on the strength of the word i

- **Issue #127** (2026-09-08): **fix(ui): show real timestamps on diff-filter log lines**
  *Symptoms*: ## Summary  Follow-up to #116 and #119. Three log lines on the diff-filter path still rendered `??:??:??` in the Execution/Logs tabs:  - the two per-warning / per-parse-error sub-items in `check_diff_filter_results` - the "Diff filter: evaluating triggers" line in `spawn_evaluation`  ## Why they were left behind  `process_log_entry` extracts the timestamp from the `[HH:MM:SS]` prefix and then **trims** the content that follows. The sub-items encoded their nesting as two leading spaces, so timestamping them would have flattened them against the summary line they hang under. #116 kept the indentation and dropped the timestamp.  That's a false choice. A printable glyph survives the trim where whitespace cannot, so the nesting and the timestamp can coexist — the same trick the `curl:` recipe lines already use.  ## Changes  **The timestamp fix**  - New `NESTED` symbol (`↳`, U+21B3) in `crates/logging/src/symbols.rs`, alongside the other TUI-only glyphs. - The two sub-item sites now call `add_timestamped_log` and mark nesting with the glyph instead of two spaces. - The "evaluating triggers" line now calls `add_timestamped_log`. It had no indentation problem, it was simply missed.  **Closing the door behind it**  `add_log` is now private. It was `pub` with exactly one caller — `add_timestamped_log` itself — and all three rounds of this bug (#116, #119, and this PR) came from a site that reached past the timestamped helper to get to it. Private makes the next attempt a compile error 

- **Issue #119** (2026-07-03): **fix(ui): show real timestamps for remaining bare TUI log pushes**
  *Symptoms*: ## Summary  Follow-up to #116, which routed most app-generated TUI log messages through `add_timestamped_log` but missed four bare `self.logs.push(...)` sites. Those lines lack the `[HH:MM:SS]` prefix the log renderer parses, so they still displayed `??:??:??` in the Execution/Logs tabs.  ## Changes  - Convert the four remaining sites in `crates/ui/src/app/state.rs` to `add_timestamped_log`:   - `cycle_diff_filter_event` — "Diff filter event: {} -> {}"   - `trigger_tab_copy_curl` — "curl: ..." recipe lines   - `trigger_dispatch` — "Dispatching {} to {:?} (branch: {})"   - `drain_trigger_outcomes` — "Dispatched ..." / "Dispatch ... failed: ..." - Remove the three `trim_logs_to_cap()` calls (and the `drained` counter gating one of them) that only existed because the bare pushes bypassed `add_log`'s built-in trim. - Widen `LogProcessor::process_log_entry` to `pub(crate)` so state tests can assert end-to-end behavior.  ## Testing  Three new tests call the real methods and run the actual appended log lines through the real parser, asserting the extracted timestamp is not `??:??:??`. The `trigger_dispatch` site is not exercised end-to-end (it `tokio::spawn`s a real dispatch) and is covered by pattern parity with the tested sites.  `cargo test -p wrkflw-ui`: 57 passed. `cargo clippy -p wrkflw-ui --all-targets`: clean.

- **Issue #118** (2026-06-10): **fix(executor): deduplicate concurrent runtime image builds**
  *Symptoms*: ## Summary  Parallel jobs in the same batch all called `build_combined_runtime_image` concurrently. The `image_exists` check raced — all callers saw `false` before any build completed, causing redundant builds and multiple "Building combined runtime image with: rust" log lines.  Fix uses a per-tag `tokio::sync::Mutex` (stored in a process-level lazy map) to serialize concurrent builds for the same image tag. The first caller builds; subsequent callers wait, then hit a re-check and reuse the already-built image. A unit test asserts `build_image` is called exactly once across five concurrent calls.  ## Changes  - `crates/executor/src/engine.rs`: added `IMAGE_BUILD_LOCKS` static and double-checked locking in `build_combined_runtime_image`; derived `Clone` on `SetupRuntime`; added `build_combined_runtime_image_deduplicates_concurrent_builds` test  ## Test plan  - [x] `cargo test -p wrkflw-executor build_combined_runtime_image_deduplicates` passes - [x] `wrkflw run --runtime podman --verbose` on a workflow with multiple parallel jobs sharing a runtime only logs "Building combined runtime image" once  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Thanks for the PR!  LGTM!

- **Issue #116** (2026-06-11): **fix: show correct timestamp in execution tab for all TUI log messages**
  *Symptoms*: ## Summary  The Execution tab (and Logs tab) was rendering \`??:??:??\` as the timestamp for several categories of TUI-generated log messages. The root cause was that \`process_log_entry\` in \`log_processor.rs\` extracts timestamps from the \`[HH:MM:SS]\` prefix produced by \`wrkflw_logging\`; messages pushed directly via \`self.logs.push(...)\` bypassed that formatting entirely.  Changes in \`crates/ui/src/app/state.rs\`:  - **Removed redundant \`initial_logs.push(...)\` calls** for Docker/Podman unavailability warnings. The \`wrkflw_logging::warning(...)\` call immediately following each already writes an identically-formatted line to the global log store, which \`LogProcessor::get_combined_logs()\` merges into the rendered list. Keeping both caused the warning to appear twice (with potentially different timestamps if the two \`Local::now()\` calls straddled a second boundary). The fix deletes the pushes rather than reformatting them.  - **Replaced all remaining bare \`self.logs.push(...)\` calls with \`self.add_timestamped_log(...)\`** (or \`self.add_log(...)\` for indented sub-items), covering:   - \`toggle_emulation_mode\` — "Switched to X mode"   - \`check_diff_filter_results\` — "Diff filter ON/OFF", evaluation failed, warnings, parse errors   - \`get_next_workflow_to_execute\` — "Executing workflow: ..."    Using \`add_timestamped_log\` also ensures the \`LOG_BUFFER_CAP\` trim and \`mark_logs_for_update\` are invoked on every push, which the raw push calls were bypas
  **Post-Mortem & Fix Analysis**:
  > Hey @ammachado , there doesn't seem to be any changes pushed yet.

- **Issue #115** (2026-06-11): **fix: resolve matrix expressions in step `with` values before execution**
  *Symptoms*: ## Summary  - `${{ matrix.X }}` references in step `with` maps were never substituted before use, causing `detect_setup_runtimes` to reject them as invalid versions (the visible symptom: `Ignoring java with invalid version: "${{ matrix.java }}"`) - The same unresolved strings were silently passed as `INPUT_*` env vars into Docker, container, and composite action steps - Fix adds `apply_matrix_to_steps` in `substitution.rs`, which clones steps and runs `preprocess_command` on all `with` values; `execute_matrix_job` materialises steps once before `resolve_runner_image` and the step iteration loop, so every downstream consumer sees concrete values - `resolve_runner_image` now accepts an explicit `steps: &[Step]` parameter instead of reading from `job.steps` directly - Other expression types (`${{ secrets.X }}`, `${{ steps.foo.outputs.bar }}`) are intentionally left intact for existing per-step resolution, since step outputs and secrets context don't exist at materialisation time  ## Relation to #112  This PR partially addresses #112. The workflow in that issue uses `${{ matrix.node }}` in a step `with` value (`node-version: ${{ matrix.node }}`), which is now correctly resolved before execution.  The remaining open part of #112 is the `include: ${{ fromJSON(...) }}` expression at the matrix level. That value is a GH Actions expression resolved at runtime by GitHub, but `wrkflw` currently fails validation with "include must be an array of objects" because it expects a static YAML 
  **Post-Mortem & Fix Analysis**:
  > LGTM!

- **Issue #114** (2026-06-11): **feat(runtime): add Auto runtime that detects Docker then Podman**
  *Symptoms*: ## Summary  - Adds `RuntimeType::Auto` (and `--runtime auto` CLI flag) that probes Docker first, then Podman, then falls back to emulation - Makes `auto` the default runtime for all subcommands (`run`, `watch`, `tui`) instead of hardcoded `docker` - Fixes the no-args TUI launch which previously hardcoded `RuntimeType::Docker`, causing Podman-only users to always see a \"Docker is not available\" warning and fall back to emulation  ## Test plan  - [x] Run `wrkflw run <workflow>` on a Podman-only machine and confirm it detects Podman automatically (no Docker warning) - [ ] Run `wrkflw run <workflow>` on a Docker machine and confirm Docker is still selected - [ ] Run `wrkflw run <workflow>` with no container runtime available and confirm emulation fallback message is shown - [x] Run `wrkflw` (TUI, no args) on a Podman-only machine and confirm the runtime badge shows Podman - [x] Confirm `--runtime docker`, `--runtime podman`, `--runtime emulation` still work explicitly - [x] Run `cargo test -p wrkflw-executor` and `cargo test -p wrkflw` to verify new unit tests pass  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Resolve the conflicts please @ammachado 

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

### Incident Patch 1: `d0614154` (2026-09-08)
**Commit Message**: fix(ui): stop logging the same TUI message to both log sinks (#128)

* fix(ui): stop logging the same TUI message to both log sinks

The TUI keeps two log buffers: the app-local `logs` vec and the
global `wrkflw_logging` store. `get_combined_logs` concatenates
them and deduplicates exactly nothing, so any code path that
reports an event to both gets to see it twice in the Logs and
Execution tabs.

PR #116 fixed this for the Docker and Podman warnings and left
the rest alone. It turns out there were 24 more, spread across
the app state, the event loop and the workflow handler,
double-reporting every workflow execution, trigger and reset.

Delete the app-side push at every one and keep the
`wrkflw_logging` call. Not an arbitrary coin flip: the global
store stamps its own [HH:MM:SS] prefix and a level glyph, so the
surviving copy is the one that renders with a real timestamp and
the right badge. The glyph is classified in the same tier as the
level keyword, which means several lines stop lying about
themselves — a failed workflow is ERROR now, and "Cannot trigger
workflow in Success state" no longer badges itself *SUCCESS* on
the strength of a word sitting in the state name.

While at

**File**: `crates/ui/src/app/mod.rs` (modified, +8/-18)
```diff
@@ -56,7 +56,6 @@ pub async fn run_wrkflw_tui(
     );
 
     if app.validation_mode {
-        app.add_timestamped_log("Starting in validation mode");
         wrkflw_logging::info("Starting in validation mode");
     }
 
@@ -561,7 +560,6 @@ fn run_tui_event_loop(
                                             "Workflow '{}' is already running",
                                             workflow.name
                                         );
-                                        app.add_timestamped_log(&msg);
                                         wrkflw_logging::warning(&msg);
                                     } else {
                                         // First, get all the data we need from the workflow
@@ -584,40 +582,32 @@ fn run_tui_event_loop(
                                             status_text
                                         ));
 
-                                        // Add log entries
-                                        app.add_timestamped_log(&format!(
+                                        // Both lines go to the global store: it
+                                        // is the only sink `get_combined_logs`
+                                        // renders once, and the hint has to stay
+                                        // adjacent to the warning it explains.
+                                        // The warning carries the workflow name
+                                        // that the app-side copy used to add.
+                                        wrkflw_logging::warning(&format!(
                                             "Cannot trigger workflow '{}' in {} state",
                                             workflow_name, status_text
                                         ));
 
-                                        // Add hint about using reset
                                         if needs_reset_hint {
-                                            app.add_timestamped_log(
+                                            wrkflw_logging::info(
                                                 "Hint: Press 'Shift+R' to reset the workflow status and allow triggering",
                                             );
                                         }
-
-                                        wrkflw_logging::warning(&format!(
-                                            "Cannot trigger workflow in {} state",
-                                            status_text
-                                        ));
                                     }
                                 }
                             } else {
-                                app.add_timestamped_log("No workflow selected to trigger");
                                 wrkflw_logging::warning("No workflow selected to trigger");
                             }
                         } else if app.running {
-                            app.add_timestamped_log(
-                                "Cannot trigger workflow while another operation is in progress",
-                            );
                             wrkflw_logging::warning(
                                 "Cannot trigger workflow while another operation is in progress",
                             );
                         } else if app.selected_tab != TAB_WORKFLOWS {
-                            app.add_timestamped_log(
-                                "Switch to Workflows tab to trigger a workflow",
-                            );
                             wrkflw_logging::warning(
                                 "Switch to Workflows tab to trigger a workflow",
                             );
```

**File**: `crates/ui/src/app/state.rs` (modified, +105/-20)
```diff
@@ -941,9 +941,7 @@ impl App {
         } else {
             "normal"
         };
-        let msg = format!("Switched to {} mode", mode);
-        self.add_timestamped_log(&msg);
-        wrkflw_logging::info(&msg);
+        wrkflw_logging::info(&format!("Switched to {} mode", mode));
     }
 
     pub fn runtime_type_name(&self) -> &str {
@@ -1157,7 +1155,6 @@ impl App {
 
             // Log only once at the beginning - don't initialize execution details here
             // since that will happen in start_next_workflow_execution
-            self.add_timestamped_log("Starting workflow execution...");
             wrkflw_logging::info("Starting workflow execution...");
         }
     }
@@ -1169,7 +1166,6 @@ impl App {
         result: Result<(Vec<wrkflw_executor::JobResult>, ()), String>,
     ) {
         if workflow_idx >= self.workflows.len() {
-            self.add_timestamped_log("Error: Invalid workflow index received");
             wrkflw_logging::error("Invalid workflow index received in process_execution_result");
             return;
         }
@@ -1251,16 +1247,16 @@ impl App {
         match result {
             Ok(_) => {
                 workflow.status = WorkflowStatus::Success;
-                // `wrkflw_logging` stamps its own [HH:MM:SS] prefix,
-                // so it gets the bare message.
+                // Single sink: `wrkflw_logging` stamps its own [HH:MM:SS]
+                // prefix and level glyph, and `get_combined_logs` folds the
+                // store into the log panes. A second app-side push would
+                // render the same line twice.
                 let msg = format!("Workflow '{}' completed successfully!", workflow.name);
-                self.add_timestamped_log(&msg);
                 wrkflw_logging::info(&msg);
             }
             Err(e) => {
                 workflow.status = WorkflowStatus::Failed;
                 let msg = format!("Workflow '{}' failed: {}", workflow.name, e);
-                self.add_timestamped_log(&msg);
                 wrkflw_logging::error(&msg);
             }
         }
@@ -1284,10 +1280,6 @@ impl App {
         let target_job = entry.target_job;
         self.workflows[next].status = WorkflowStatus::Running;
         self.current_execution = Some(next);
-        self.add_timestamped_log(&format!(
-            "Executing workflow: {}",
-            self.workflows[next].name
-        ));
         wrkflw_logging::info(&format!(
             "Executing workflow: {}",
             self.workflows[next].name
@@ -1651,7 +1643,6 @@ impl App {
                 let workflow = &self.workflows[selected_idx];
 
                 if workflow.name.is_empty() {
-                    self.add_timestamped_log("Error: Invalid workflow selection");
                     wrkflw_logging::error(
                         "Invalid workflow selection in trigger_selected_workflow",
                     );
@@ -1662,7 +1653,6 @@ impl App {
                 let workflow_name = workflow.name.clone();
 
                 // Set up background task to execute the workflow via GitHub Actions REST API
-                self.add_timestamped_log(&format!("Triggering workflow: {}", workflow_name));
                 wrkflw_logging::info(&format!("Triggering workflow: {}", workflow_name));
                 let tx_clone = self.tx.clone();
 
@@ -1697,11 +1687,9 @@ impl App {
                     }
                 });
             } else {
-                self.add_timestamped_log("No workflow selected to trigger");
                 wrkflw_logging::warning("No workflow selected to trigger");
             }
         } else {
-            self.add_timestamped_log("No workflow selected to trigger");
             wrkflw_logging::warning("No workflow selected to trigger");
         }
     }
@@ -1710,7 +1698,6 @@ impl App {
     pub fn reset_workflow_status(&mut self) {
         // Log whether a selection exists
         if self.workflow_list_state.selected().is_none() {
-         
```

**File**: `crates/ui/src/handlers/workflow.rs` (modified, +0/-14)
```diff
@@ -469,12 +469,8 @@ pub fn start_next_workflow_execution(
 
         // Log whether verbose mode is enabled
         if verbose {
-            app.add_timestamped_log("Verbose mode: Step outputs will be displayed in full");
             wrkflw_logging::info("Verbose mode: Step outputs will be displayed in full");
         } else {
-            app.add_timestamped_log(
-                "Standard mode: Only step status will be shown (use --verbose for full output)",
-            );
             wrkflw_logging::info(
                 "Standard mode: Only step status will be shown (use --verbose for full output)",
             );
@@ -498,9 +494,6 @@ pub fn start_next_workflow_execution(
                         wrkflw_logging::info("Auto-detected Podman runtime");
                         RuntimeType::Podman
                     } else {
-                        app.add_timestamped_log(
-                            "No container runtime found (tried Docker and Podman). Using emulation mode instead.",
-                        );
                         wrkflw_logging::warning(
                             "No container runtime found (tried Docker and Podman). Using emulation mode instead.",
                         );
@@ -523,9 +516,6 @@ pub fn start_next_workflow_execution(
                 };
 
                 if !is_docker_available {
-                    app.add_timestamped_log(
-                        "Docker is not available. Using emulation mode instead.",
-                    );
                     wrkflw_logging::warning(
                         "Docker is not available. Using emulation mode instead.",
                     );
@@ -549,9 +539,6 @@ pub fn start_next_workflow_execution(
                 };
 
                 if !is_podman_available {
-                    app.add_timestamped_log(
-                        "Podman is not available. Using emulation mode instead.",
-                    );
                     wrkflw_logging::warning(
                         "Podman is not available. Using emulation mode instead.",
                     );
@@ -675,7 +662,6 @@ pub fn start_next_workflow_execution(
         });
     } else {
         app.running = false;
-        app.add_timestamped_log("All workflows completed execution");
         wrkflw_logging::info("All workflows completed execution");
     }
 }
```

**File**: `crates/ui/src/models/mod.rs` (modified, +15/-0)
```diff
@@ -230,6 +230,21 @@ mod tests {
             "[12:00:00] Triggering workflow: ci.yml",
             "[12:00:00] Workflow completed successfully",
             "[12:00:00] Diff filter OFF",
+            // Lines arriving from the `wrkflw_logging` store, which
+            // stamps a level glyph after the timestamp. Execution events
+            // are logged there and nowhere else, so these shapes are what
+            // the panes actually draw for them. The glyph is load-bearing:
+            // it is checked in the same tier as the level keyword, so it
+            // badges lines whose wording alone would badge them wrong.
+            // "failed" is not a keyword, and this line would be INFO
+            // without the failure glyph:
+            "[12:00:00] \u{2716} Workflow 'ci' failed: exit status 1",
+            // The Warn tier is tested before the Success tier, so the
+            // glyph wins over the "Success" in the state name:
+            "[12:00:00] \u{26A0} Cannot trigger workflow 'ci' in Success state",
+            "[12:00:00] \u{26A0} No workflow selected to trigger",
+            "[12:00:00] \u{25CF} Executing workflow: ci",
+            "[12:00:00] \u{25CF} Workflow 'ci' completed successfully!",
         ];
 
         let levels = [
```

---

### Incident Patch 2: `af759137` (2026-09-08)
**Commit Message**: fix(ui): show real timestamps on diff-filter log lines (#127)

* fix(ui): show real timestamps on diff-filter log lines

Toggling the diff filter logs a burst of lines into the Execution
and Logs tabs, and three of them have been rendering `??:??:??`
where the timestamp belongs: the per-warning and per-parse-error
sub-items, and the "evaluating triggers" line that kicks the whole
thing off.

The reason is more interesting than a plain oversight. The renderer
pulls the timestamp off a `[HH:MM:SS]` prefix and then *trims*
whatever follows. The sub-items encoded their nesting as two
leading spaces, so timestamping them would have flattened them
against the summary line they hang under. Faced with that, the
previous pass kept the indentation and dropped the timestamp.

That's a false choice. Carry the nesting in a glyph instead — a ↳
survives the trim, where whitespace never could — and the timestamp
comes back for free. It's the same trick the curl recipe lines
already use: put something printable in front, and the trim stops
being your problem.

The "evaluating triggers" line had no such excuse. It just got
missed.

That's the last of the bare log pushes on the app side, which
closes

**File**: `crates/executor/src/docker.rs` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ impl DockerRuntime {
         };
 
         // Look for any key that starts with the prefix
-        for (key, _) in image_keys.iter() {
+        for key in image_keys.keys() {
             if key.starts_with(prefix) {
                 return Some(key.clone());
             }
```

**File**: `crates/executor/src/podman.rs` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ impl PodmanRuntime {
         };
 
         // Look for any key that starts with the prefix
-        for (key, _) in image_keys.iter() {
+        for key in image_keys.keys() {
             if key.starts_with(prefix) {
                 return Some(key.clone());
             }
```

**File**: `crates/executor/src/workflow_commands.rs` (modified, +2/-3)
```diff
@@ -130,10 +130,9 @@ fn parse_command_line(line: &str) -> Option<WorkflowCommand> {
     let rest = line.strip_prefix("::").unwrap_or(line);
 
     // Find the second "::" that separates command+params from the message
-    let (cmd_part, raw_message) = if let Some(idx) = rest.find("::") {
+    let (cmd_part, raw_message) = {
+        let idx = rest.find("::")?;
         (&rest[..idx], rest[idx + 2..].to_string())
-    } else {
-        return None;
     };
 
     // Decode percent-encoded values in the message
```

**File**: `crates/logging/src/symbols.rs` (modified, +5/-0)
```diff
@@ -30,6 +30,11 @@ pub const CHECKBOX_ON: &str = "[\u{2714}]"; // [✔]
 pub const CHECKBOX_OFF: &str = "[ ]";
 pub const TAB_DIVIDER: &str = " \u{2502} "; // │
 
+// Marks a log line as a sub-item of the line above it. A glyph rather than
+// leading whitespace because the log renderer trims the content after the
+// `[HH:MM:SS]` prefix, which erases indentation.
+pub const NESTED: &str = "\u{21B3}"; // ↳
+
 // Braille spinner frames for running animation
 pub const SPINNER: &[&str] = &[
     "\u{280B}", "\u{2819}", "\u{2839}", "\u{2838}", "\u{283C}", "\u{2834}", "\u{2826}", "\u{2827}",
```

**File**: `crates/runtime/src/emulation.rs` (modified, +2/-2)
```diff
@@ -110,7 +110,7 @@ impl EmulationRuntime {
                             if let Err(e) = fs::copy(&source, &dest) {
                                 eprintln!(
                                     "Warning: Failed to copy file from {:?} to {:?}: {}",
-                                    &source, &dest, e
+                                    source, dest, e
                                 );
                             }
                         } else {
@@ -135,7 +135,7 @@ impl EmulationRuntime {
                 if let Err(e) = fs::copy(host_path, &dest) {
                     eprintln!(
                         "Warning: Failed to copy file from {:?} to {:?}: {}",
-                        host_path, &dest, e
+                        host_path, dest, e
                     );
                 }
             }
```

---

### Incident Patch 3: `499a4e53` (2026-07-03)
**Commit Message**: fix(ui): show real timestamps for remaining bare TUI log pushes (#119)

* fix(ui): timestamp the log pushes that #116 missed

PR #116 claimed to fix the ??:??:?? timestamps for "all TUI log
messages". It turns out "all" meant "most": four bare
self.logs.push() sites survived — the diff-filter event rotation,
the copy-curl recipe lines, the "Dispatching ..." line, and the
dispatch outcome lines. All of them still rendered ??:??:?? in
the Execution and Logs tabs.

The renderer derives the timestamp column *only* from a
[HH:MM:SS] prefix on the line itself, so any push that skips
add_timestamped_log() is silently unparseable. Route the four
stragglers through add_timestamped_log(). Since that helper
already trims the buffer, the hand-rolled trim_logs_to_cap()
calls next to each push (and the `drained` counter that existed
only to gate one of them) are now dead weight. Gone.

The new tests don't re-feed literal strings to the parser —
that proves nothing about the call sites. They call the actual
methods and run the actual appended lines through the actual
parser, which needed nothing more than a pub(crate) on
process_log_entry. The "Dispatching ..." site is the one
exception: it tokio

**File**: `crates/ui/src/app/mod.rs` (modified, +15/-21)
```diff
@@ -8,7 +8,6 @@ use crate::views::{
     render_ui, TAB_COUNT, TAB_DAG, TAB_EXECUTION, TAB_HELP, TAB_LOGS, TAB_SECRETS, TAB_TRIGGER,
     TAB_WORKFLOWS,
 };
-use chrono::Local;
 use crossterm::{
     event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
     execute,
@@ -57,7 +56,7 @@ pub async fn run_wrkflw_tui(
     );
 
     if app.validation_mode {
-        app.logs.push("Starting in validation mode".to_string());
+        app.add_timestamped_log("Starting in validation mode");
         wrkflw_logging::info("Starting in validation mode");
     }
 
@@ -558,14 +557,12 @@ fn run_tui_event_loop(
                                     if workflow.status == WorkflowStatus::NotStarted {
                                         app.trigger_selected_workflow();
                                     } else if workflow.status == WorkflowStatus::Running {
-                                        app.logs.push(format!(
+                                        let msg = format!(
                                             "Workflow '{}' is already running",
                                             workflow.name
-                                        ));
-                                        wrkflw_logging::warning(&format!(
-                                            "Workflow '{}' is already running",
-                                            workflow.name
-                                        ));
+                                        );
+                                        app.add_timestamped_log(&msg);
+                                        wrkflw_logging::warning(&msg);
                                     } else {
                                         // First, get all the data we need from the workflow
                                         let workflow_name = workflow.name.clone();
@@ -588,19 +585,16 @@ fn run_tui_event_loop(
                                         ));
 
                                         // Add log entries
-                                        app.logs.push(format!(
+                                        app.add_timestamped_log(&format!(
                                             "Cannot trigger workflow '{}' in {} state",
                                             workflow_name, status_text
                                         ));
 
                                         // Add hint about using reset
                                         if needs_reset_hint {
-                                            let timestamp =
-                                                Local::now().format("%H:%M:%S").to_string();
-                                            app.logs.push(format!(
-                                                "[{}] Hint: Press 'Shift+R' to reset the workflow status and allow triggering",
-                                                timestamp
-                                            ));
+                                            app.add_timestamped_log(
+                                                "Hint: Press 'Shift+R' to reset the workflow status and allow triggering",
+                                            );
                                         }
 
                                         wrkflw_logging::warning(&format!(
@@ -610,20 +604,20 @@ fn run_tui_event_loop(
                                     }
                                 }
                             } else {
-                                app.logs.push("No workflow selected to trigger".to_string());
+                                app.add_timestamped_log("No workflow selected to trigger");
                                 wrkflw_logging::warning("No workflow selected to trigger");
                             }
                         } else if app.running {
-                            app.logs.push(
-                                "Cannot trigger workflow while another operation is in progress"
-              
```

**File**: `crates/ui/src/app/state.rs` (modified, +183/-127)
```diff
@@ -29,19 +29,19 @@ pub struct App {
     pub show_action_messages: bool,
     pub execution_queue: Vec<QueuedExecution>, // Workflows queued for execution
     pub current_execution: Option<usize>,
-    pub logs: Vec<String>,                       // Overall execution logs
-    pub log_scroll: usize,                       // Scrolling position for logs
-    pub job_list_state: ListState,               // For viewing job details
-    pub detailed_view: bool,                     // Whether we're in detailed view mode
-    pub step_list_state: ListState,              // For selecting steps in detailed view
-    pub step_table_state: TableState,            // For the steps table in detailed view
-    pub last_tick: Instant,                      // For UI animations and updates
-    pub tick_rate: Duration,                     // How often to update the UI
-    pub spinner_frame: usize,                    // Current spinner animation frame
-    pub tx: mpsc::Sender<ExecutionResultMsg>,    // Channel for async communication
-    pub status_message: Option<String>,          // Temporary status message to display
+    logs: Vec<String>, // Overall execution logs — private so every mutation routes through `add_log`
+    pub log_scroll: usize, // Scrolling position for logs
+    pub job_list_state: ListState, // For viewing job details
+    pub detailed_view: bool, // Whether we're in detailed view mode
+    pub step_list_state: ListState, // For selecting steps in detailed view
+    pub step_table_state: TableState, // For the steps table in detailed view
+    pub last_tick: Instant, // For UI animations and updates
+    pub tick_rate: Duration, // How often to update the UI
+    pub spinner_frame: usize, // Current spinner animation frame
+    pub tx: mpsc::Sender<ExecutionResultMsg>, // Channel for async communication
+    pub status_message: Option<String>, // Temporary status message to display
     pub status_message_severity: StatusSeverity, // Severity of the current status message
-    pub status_message_time: Option<Instant>,    // When the message was set
+    pub status_message_time: Option<Instant>, // When the message was set
 
     // Search and filter functionality
     pub log_search_query: String, // Current search query for logs
@@ -58,6 +58,7 @@ pub struct App {
     pub processed_logs: Vec<ProcessedLogEntry>,
     pub logs_need_update: bool,        // Flag to trigger log processing
     pub last_system_logs_count: usize, // Track system log changes
+    logs_revision: u64, // Bumped on every log/search/filter change; `logs.len()` goes stale at the cap
 
     // Job selection mode
     pub job_selection_mode: bool, // Are we viewing jobs of a workflow?
@@ -329,7 +330,6 @@ impl App {
         step_table_state.select(Some(0));
 
         // Check container runtime availability if container runtime is selected
-        let mut initial_logs = Vec::new();
         let runtime_type = match runtime_type {
             RuntimeType::Auto => {
                 let detected = match std::panic::catch_unwind(|| {
@@ -361,10 +361,11 @@ impl App {
                     RuntimeType::Docker => wrkflw_logging::info("Auto-detected Docker runtime"),
                     RuntimeType::Podman => wrkflw_logging::info("Auto-detected Podman runtime"),
                     _ => {
-                        initial_logs.push(
-                            "No container runtime found (tried Docker and Podman). Using emulation mode instead."
-                                .to_string(),
-                        );
+                        // System-logged only, matching the Docker/Podman arms
+                        // below. `get_combined_logs` folds the wrkflw_logging
+                        // store into the Logs tab with a real timestamp, so a
+                        // second app-side push would just render an
+                        // untimestamped duplicate.
                         wrkflw_logging::warning(
                             
```

**File**: `crates/ui/src/handlers/workflow.rs` (modified, +12/-15)
```diff
@@ -469,13 +469,11 @@ pub fn start_next_workflow_execution(
 
         // Log whether verbose mode is enabled
         if verbose {
-            app.logs
-                .push("Verbose mode: Step outputs will be displayed in full".to_string());
+            app.add_timestamped_log("Verbose mode: Step outputs will be displayed in full");
             wrkflw_logging::info("Verbose mode: Step outputs will be displayed in full");
         } else {
-            app.logs.push(
-                "Standard mode: Only step status will be shown (use --verbose for full output)"
-                    .to_string(),
+            app.add_timestamped_log(
+                "Standard mode: Only step status will be shown (use --verbose for full output)",
             );
             wrkflw_logging::info(
                 "Standard mode: Only step status will be shown (use --verbose for full output)",
@@ -500,9 +498,8 @@ pub fn start_next_workflow_execution(
                         wrkflw_logging::info("Auto-detected Podman runtime");
                         RuntimeType::Podman
                     } else {
-                        app.logs.push(
-                            "No container runtime found (tried Docker and Podman). Using emulation mode instead."
-                                .to_string(),
+                        app.add_timestamped_log(
+                            "No container runtime found (tried Docker and Podman). Using emulation mode instead.",
                         );
                         wrkflw_logging::warning(
                             "No container runtime found (tried Docker and Podman). Using emulation mode instead.",
@@ -526,8 +523,9 @@ pub fn start_next_workflow_execution(
                 };
 
                 if !is_docker_available {
-                    app.logs
-                        .push("Docker is not available. Using emulation mode instead.".to_string());
+                    app.add_timestamped_log(
+                        "Docker is not available. Using emulation mode instead.",
+                    );
                     wrkflw_logging::warning(
                         "Docker is not available. Using emulation mode instead.",
                     );
@@ -551,8 +549,9 @@ pub fn start_next_workflow_execution(
                 };
 
                 if !is_podman_available {
-                    app.logs
-                        .push("Podman is not available. Using emulation mode instead.".to_string());
+                    app.add_timestamped_log(
+                        "Podman is not available. Using emulation mode instead.",
+                    );
                     wrkflw_logging::warning(
                         "Podman is not available. Using emulation mode instead.",
                     );
@@ -676,9 +675,7 @@ pub fn start_next_workflow_execution(
         });
     } else {
         app.running = false;
-        let timestamp = Local::now().format("%H:%M:%S").to_string();
-        app.logs
-            .push(format!("[{}] All workflows completed execution", timestamp));
+        app.add_timestamped_log("All workflows completed execution");
         wrkflw_logging::info("All workflows completed execution");
     }
 }
```

**File**: `crates/ui/src/log_processor.rs` (modified, +14/-8)
```diff
@@ -35,9 +35,13 @@ impl ProcessedLogEntry {
 pub struct LogProcessingRequest {
     pub search_query: String,
     pub filter_level: Option<LogFilterLevel>,
-    pub app_logs: Vec<String>,    // Complete app logs
-    pub app_logs_count: usize,    // To detect changes in app logs
-    pub system_logs_count: usize, // To detect changes in system logs
+    pub app_logs: Vec<String>, // Complete app logs
+    // Change signal for app logs AND search/filter edits. A revision
+    // counter rather than `app_logs.len()`: once the app's buffer
+    // hits its cap, pushes stop changing the length (one old entry is
+    // dropped per new one), so a count would freeze the display.
+    pub app_logs_revision: u64,
+    pub system_logs_count: usize, // To detect changes in system logs (unbounded, so len works)
 }
 
 /// Response with processed logs
@@ -94,7 +98,9 @@ impl LogProcessor {
         let mut last_request: Option<LogProcessingRequest> = None;
         let mut last_processed_time = Instant::now();
         let mut cached_logs: Vec<String> = Vec::new();
-        let mut cached_app_logs_count = 0;
+        // u64::MAX so the first request always mismatches — the app's
+        // revision starts at 0.
+        let mut cached_app_logs_revision = u64::MAX;
         let mut cached_system_logs_count = 0;
 
         loop {
@@ -110,17 +116,17 @@ impl LogProcessor {
 
             if let Some(ref req) = last_request {
                 let should_process = last_processed_time.elapsed() > Duration::from_millis(50)
-                    && (cached_app_logs_count != req.app_logs_count
+                    && (cached_app_logs_revision != req.app_logs_revision
                         || cached_system_logs_count != req.system_logs_count
                         || cached_logs.is_empty());
 
                 if should_process {
-                    if cached_app_logs_count != req.app_logs_count
+                    if cached_app_logs_revision != req.app_logs_revision
                         || cached_system_logs_count != req.system_logs_count
                         || cached_logs.is_empty()
                     {
                         cached_logs = Self::get_combined_logs(&req.app_logs);
-                        cached_app_logs_count = req.app_logs_count;
+                        cached_app_logs_revision = req.app_logs_revision;
                         cached_system_logs_count = req.system_logs_count;
                     }
 
@@ -191,7 +197,7 @@ impl LogProcessor {
     }
 
     /// Process a single log entry into display format
-    fn process_log_entry(log_line: &str, search_query: &str) -> ProcessedLogEntry {
+    pub(crate) fn process_log_entry(log_line: &str, search_query: &str) -> ProcessedLogEntry {
         // Extract timestamp from log format [HH:MM:SS]
         let timestamp = if log_line.starts_with('[') && log_line.contains(']') {
             let end = log_line.find(']').unwrap_or(0);
```

---

### Incident Patch 4: `c85adc0f` (2026-06-11)
**Commit Message**: fix: show correct timestamp in execution tab for all TUI log messages (#116)

* fix: show correct timestamp in execution tab for initial log messages

Docker/Podman unavailability messages were pushed to initial_logs as
plain strings, causing the log processor to display ??:??:?? instead
of the actual time.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

* fix: use add_timestamped_log for all app-generated log messages

Replace direct pushes to self.logs with self.add_timestamped_log so
every app-generated message (runtime switch, diff filter events,
workflow execution start) carries a consistent timestamp in the
execution tab. Also removes duplicate inline timestamp formatting
that was added to initial_logs before the helper existed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---------

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `crates/ui/src/app/state.rs` (modified, +17/-24)
```diff
@@ -329,7 +329,7 @@ impl App {
         step_table_state.select(Some(0));
 
         // Check container runtime availability if container runtime is selected
-        let mut initial_logs = Vec::new();
+        let initial_logs = Vec::new();
         let runtime_type = match runtime_type {
             RuntimeType::Docker => {
                 // Use a timeout for the Docker availability check to prevent hanging
@@ -370,10 +370,6 @@ impl App {
                 };
 
                 if !is_docker_available {
-                    initial_logs.push(
-                        "Docker is not available or unresponsive. Using emulation mode instead."
-                            .to_string(),
-                    );
                     wrkflw_logging::warning(
                         "Docker is not available or unresponsive. Using emulation mode instead.",
                     );
@@ -422,10 +418,6 @@ impl App {
                 };
 
                 if !is_podman_available {
-                    initial_logs.push(
-                        "Podman is not available or unresponsive. Using emulation mode instead."
-                            .to_string(),
-                    );
                     wrkflw_logging::warning(
                         "Podman is not available or unresponsive. Using emulation mode instead.",
                     );
@@ -546,8 +538,7 @@ impl App {
             _ => false,
         };
         self.last_availability_check = Instant::now();
-        self.logs
-            .push(format!("Switched to {} mode", self.runtime_type_name()));
+        self.add_timestamped_log(&format!("Switched to {} mode", self.runtime_type_name()));
     }
 
     /// Cycle through the event names the diff filter simulates.
@@ -760,7 +751,7 @@ impl App {
             for workflow in &mut self.workflows {
                 workflow.trigger_match = None;
             }
-            self.logs.push("Diff filter OFF".to_string());
+            self.add_timestamped_log("Diff filter OFF");
         }
     }
 
@@ -798,7 +789,7 @@ impl App {
                     if self.diff_filter_aborted {
                         self.diff_filter_aborted = false;
                     } else {
-                        self.logs.push("Diff filter: evaluation failed".to_string());
+                        self.add_timestamped_log("Diff filter: evaluation failed");
                     }
                     return;
                 }
@@ -830,7 +821,7 @@ impl App {
                     .iter()
                     .filter(|w| matches!(&w.trigger_match, Some(TriggerMatchStatus::Matched(_))))
                     .count();
-                self.logs.push(format!(
+                self.add_timestamped_log(&format!(
                     "Diff filter ON: {}/{} workflows would trigger",
                     matched,
                     self.workflows.len()
@@ -851,10 +842,12 @@ impl App {
                 // load-bearing to avoid the silent-skip mode this PR
                 // is built to plug.
                 if !warnings.is_empty() {
-                    self.logs
-                        .push(format!("Diff filter: {} warning(s)", warnings.len()));
+                    self.add_timestamped_log(&format!(
+                        "Diff filter: {} warning(s)",
+                        warnings.len()
+                    ));
                     for w in &warnings {
-                        self.logs.push(format!("  warning: {}", w));
+                        self.add_log(format!("  warning: {}", w));
                     }
                 }
 
@@ -864,13 +857,12 @@ impl App {
                 // Surface each failure individually so the YAML/glob
                 // typo is the first thing they see in the log pane.
                 if !parse_failures.is_empty() {
-                    self.logs.push(format!(
+                    self.add_timestamped_log(&format!(
                         "Diff filter: {} workflow file(s) failed to parse and were skipped",
         
```

---

### Incident Patch 5: `53e83b3d` (2026-06-11)
**Commit Message**: fix: resolve matrix expressions in step `with` values before execution (#115)

* fix: resolve matrix expressions in step `with` values before execution

${{ matrix.X }} references in step `with` maps were never substituted,
causing detect_setup_runtimes to reject them as invalid versions (the
visible symptom), and silently passing literal expression strings into
INPUT_* env vars for Docker, container, and composite action steps.

Fix: add apply_matrix_to_steps (substitution.rs) which clones steps and
runs preprocess_command on all `with` values before execution begins.
execute_matrix_job now materialises steps once at the top and uses them
for both resolve_runner_image and the step iteration loop. Other
expression types (${{ secrets.X }}, ${{ steps.foo.outputs.bar }}) are
left intact for existing per-step resolution.

Note: INPUT_* env vars that contain non-matrix expressions (${{ env.X }},
${{ secrets.X }}) are still passed unresolved at the raw-with-access
sites; that is a separate gap not addressed here.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Signed-off-by: Adriano Machado <60320+ammachado@users.noreply.github.com>

* fix: preserve original expression in with

**File**: `crates/executor/src/engine.rs` (modified, +56/-5)
```diff
@@ -1720,6 +1720,7 @@ async fn build_combined_runtime_image(
 /// includes git and other tools needed by actions like `actions/checkout`).
 async fn resolve_runner_image(
     job: &Job,
+    steps: &[Step],
     runtime: &dyn ContainerRuntime,
 ) -> Result<String, ExecutionError> {
     let base_image = get_effective_runner_image(job);
@@ -1728,7 +1729,7 @@ async fn resolve_runner_image(
         return Ok(base_image);
     }
 
-    let setup_runtimes = detect_setup_runtimes(&job.steps);
+    let setup_runtimes = detect_setup_runtimes(steps);
     if setup_runtimes.is_empty() {
         Ok(base_image)
     } else {
@@ -1991,7 +1992,7 @@ async fn execute_job(ctx: JobExecutionContext<'_>) -> Result<JobResult, Executio
 
     // Execute job steps
     // Determine runner image: prefer job container, then detect setup actions, fall back to runs-on
-    let runner_image_value = resolve_runner_image(job, ctx.runtime).await?;
+    let runner_image_value = resolve_runner_image(job, &job.steps, ctx.runtime).await?;
 
     // GHA default job timeout is 360 minutes; sanitize to avoid panic on negative/NaN
     let timeout_mins = sanitize_timeout_minutes(job.timeout_minutes, 360.0);
@@ -2267,22 +2268,30 @@ async fn execute_matrix_job(
         ExecutionError::Execution(format!("Failed to get current directory: {}", e))
     })?;
 
+    // Pre-resolve ${{ matrix.X }} in all step `with` values so that every downstream
+    // consumer (detect_setup_runtimes, INPUT_* env vars, composite action inputs, etc.)
+    // sees the concrete value rather than the literal expression string. Other expression
+    // types (${{ env.X }}, ${{ steps.foo.outputs.bar }}) are left for per-step resolution.
+    let materialized_steps =
+        crate::substitution::apply_matrix_to_steps(&job_template.steps, &combination.values);
+
     let mut loop_state = StepLoopState::new();
     let pending_cache_saves = std::sync::Mutex::new(Vec::<PendingCacheSave>::new());
-    let job_success = if job_template.steps.is_empty() {
+    let job_success = if materialized_steps.is_empty() {
         wrkflw_logging::warning(&format!("Job '{}' has no steps", matrix_job_name));
         true
     } else {
         // Execute each step
         // Determine runner image: prefer job container, then detect setup actions, fall back to runs-on
-        let runner_image_value = resolve_runner_image(job_template, runtime).await?;
+        let runner_image_value =
+            resolve_runner_image(job_template, &materialized_steps, runtime).await?;
 
         let mut all_steps_ok = true;
         let timeout_mins = sanitize_timeout_minutes(job_template.timeout_minutes, 360.0);
         let job_timeout = std::time::Duration::from_secs_f64(timeout_mins * 60.0);
         let job_deadline = tokio::time::Instant::now() + job_timeout;
 
-        for (idx, step) in job_template.steps.iter().enumerate() {
+        for (idx, step) in materialized_steps.iter().enumerate() {
             let remaining = job_deadline.saturating_duration_since(tokio::time::Instant::now());
 
             let outcome = match tokio::time::timeout(
@@ -6964,6 +6973,48 @@ runs:
         assert!(runtimes.is_empty());
     }
 
+    #[test]
+    fn detect_setup_runtimes_matrix_expr_skipped_without_substitution() {
+        // Raw ${{ matrix.java }} is not a valid version — without substitution the
+        // step is silently ignored.  This documents the pre-fix behavior and ensures
+        // the guard still works when a caller forgets to materialise steps.
+        let with = HashMap::from([("java-version".to_string(), "${{ matrix.java }}".to_string())]);
+        let steps = vec![make_step_uses("actions/setup-java@v4", Some(with))];
+        let runtimes = detect_setup_runtimes(&steps);
+        assert!(runtimes.is_empty());
+    }
+
+    #[test]
+    fn detect_setup_runtimes_after_matrix_substitution_resolves_java_version() {
+        // After apply_matrix_to_steps the expression is resolved; detection must
+      
```

**File**: `crates/executor/src/substitution.rs` (modified, +143/-0)
```diff
@@ -4,6 +4,7 @@ use serde_yaml::Value;
 use sha2::{Digest, Sha256};
 use std::collections::HashMap;
 use std::path::Path;
+use wrkflw_parser::workflow::Step;
 
 lazy_static! {
     static ref MATRIX_PATTERN: Regex =
@@ -56,6 +57,38 @@ pub fn process_step_run(run: &str, matrix_combination: &Option<HashMap<String, V
     }
 }
 
+/// Clone `steps`, substituting `${{ matrix.X }}` expressions in each step's `with` values.
+///
+/// Only matrix references are resolved here. Other expressions (`${{ env.X }}`,
+/// `${{ steps.foo.outputs.bar }}`, etc.) are left intact for later per-step resolution,
+/// because step outputs and other dynamic context don't exist yet at this point.
+pub fn apply_matrix_to_steps(steps: &[Step], matrix_values: &HashMap<String, Value>) -> Vec<Step> {
+    steps
+        .iter()
+        .map(|step| {
+            let mut s = step.clone();
+            if let Some(with) = s.with.as_mut() {
+                for value in with.values_mut() {
+                    *value = MATRIX_PATTERN
+                        .replace_all(value, |caps: &regex::Captures| {
+                            let var_name = &caps[1];
+                            match matrix_values.get(var_name) {
+                                Some(Value::String(s)) => s.clone(),
+                                Some(Value::Number(n)) => n.to_string(),
+                                Some(Value::Bool(b)) => b.to_string(),
+                                // Preserve the original expression; with values are not shell
+                                // text so the shell-escape from preprocess_command is wrong here.
+                                _ => caps[0].to_string(),
+                            }
+                        })
+                        .into_owned();
+                }
+            }
+            s
+        })
+        .collect()
+}
+
 /// Replace `${{ hashFiles(...) }}` expressions with the SHA-256 hash of matched files.
 ///
 /// Accepts one or more comma-separated, quoted glob patterns. Files are matched
@@ -683,4 +716,114 @@ mod tests {
         let result = preprocess_expressions(text, dir.path(), &ctx).unwrap();
         assert_eq!(result, "if [[ Linux == macOS ]]; then echo mac; fi");
     }
+
+    // --- apply_matrix_to_steps tests ---
+
+    fn make_uses_step(uses: &str, with: HashMap<String, String>) -> Step {
+        Step {
+            name: None,
+            uses: Some(uses.to_string()),
+            run: None,
+            with: Some(with),
+            env: HashMap::new(),
+            continue_on_error: None,
+            if_condition: None,
+            id: None,
+            working_directory: None,
+            shell: None,
+            timeout_minutes: None,
+        }
+    }
+
+    #[test]
+    fn apply_matrix_to_steps_resolves_string_value() {
+        let combination = HashMap::from([("java".to_string(), Value::String("17".to_string()))]);
+        let steps = vec![make_uses_step(
+            "actions/setup-java@v4",
+            HashMap::from([("java-version".to_string(), "${{ matrix.java }}".to_string())]),
+        )];
+        let result = apply_matrix_to_steps(&steps, &combination);
+        assert_eq!(
+            result[0]
+                .with
+                .as_ref()
+                .unwrap()
+                .get("java-version")
+                .unwrap(),
+            "17"
+        );
+    }
+
+    #[test]
+    fn apply_matrix_to_steps_resolves_numeric_value() {
+        let combination = HashMap::from([("node".to_string(), Value::Number(20.into()))]);
+        let steps = vec![make_uses_step(
+            "actions/setup-node@v4",
+            HashMap::from([("node-version".to_string(), "${{ matrix.node }}".to_string())]),
+        )];
+        let result = apply_matrix_to_steps(&steps, &combination);
+        assert_eq!(
+            result[0]
+                .with
+                .as_ref()
+                .unwrap()
+                .get("node-version")
+                .unwrap(),
+ 
```

**File**: `crates/parser/src/workflow.rs` (modified, +1/-1)
```diff
@@ -232,7 +232,7 @@ pub struct Service {
     pub options: Option<String>,
 }
 
-#[derive(Debug, Deserialize, Serialize)]
+#[derive(Debug, Deserialize, Serialize, Clone)]
 pub struct Step {
     #[serde(default)]
     pub name: Option<String>,
```

---

### Incident Patch 6: `8bb1653e` (2026-06-10)
**Commit Message**: fix(executor): deduplicate concurrent runtime image builds (#118)

Parallel jobs in the same batch all called build_combined_runtime_image
simultaneously. The image_exists check raced — all callers saw false
before any build completed, causing redundant builds and multiple
"Building combined runtime image" log lines.

Fix uses a per-tag tokio::sync::Mutex (stored in a process-level map)
to serialize concurrent builds for the same image tag. The first caller
builds; subsequent callers wait, then hit the re-check and reuse the
already-built image. Adds a unit test that asserts build_image is called
exactly once across five concurrent calls.

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `crates/executor/src/engine.rs` (modified, +115/-2)
```diff
@@ -1,10 +1,12 @@
 #[allow(unused_imports)]
 use bollard::Docker;
 use futures::future;
+use once_cell::sync::Lazy;
 use serde_yaml::Value;
 use std::collections::HashMap;
 use std::fs;
 use std::path::{Path, PathBuf};
+use std::sync::{Arc, Mutex};
 // std::process::Command replaced by tokio::process::Command for async safety
 use thiserror::Error;
 
@@ -1339,6 +1341,7 @@ fn determine_action_image(repository: &str) -> String {
 }
 
 /// A runtime detected from a setup action step (e.g., `actions/setup-node@v3`).
+#[derive(Clone)]
 struct SetupRuntime {
     /// Language identifier (e.g., "node", "php", "python")
     language: String,
@@ -1636,9 +1639,15 @@ fn combined_image_tag(runtimes: &[SetupRuntime], dockerfile: &str) -> String {
 }
 
 /// Build a Docker image that combines multiple language runtimes on an Ubuntu base.
+// Per-tag mutex map so parallel jobs building the same runtime image serialize
+// rather than all racing to build it simultaneously.
+static IMAGE_BUILD_LOCKS: Lazy<Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>> =
+    Lazy::new(|| Mutex::new(HashMap::new()));
+
 ///
 /// Skips the build when an image with the same tag already exists locally,
-/// avoiding redundant work on repeated runs.
+/// avoiding redundant work on repeated runs. When multiple parallel jobs need
+/// the same image, only the first build runs; the others wait and then reuse it.
 async fn build_combined_runtime_image(
     runtimes: &[SetupRuntime],
     base_image: &str,
@@ -1647,7 +1656,27 @@ async fn build_combined_runtime_image(
     let dockerfile = generate_combined_dockerfile(runtimes, base_image);
     let tag = combined_image_tag(runtimes, &dockerfile);
 
-    // Skip the build if the image already exists locally.
+    // Fast path: image already exists, no locking needed.
+    let exists = runtime.image_exists(&tag).await.map_err(|e| {
+        ExecutionError::Runtime(format!("Failed to check for existing image: {}", e))
+    })?;
+    if exists {
+        wrkflw_logging::info(&format!("Reusing existing combined runtime image: {}", tag));
+        return Ok(tag);
+    }
+
+    // Acquire the per-tag build lock so concurrent jobs building the same image
+    // serialize here. The std::Mutex is held only long enough to clone the Arc.
+    let tag_lock = {
+        let mut locks = IMAGE_BUILD_LOCKS.lock().unwrap();
+        locks
+            .entry(tag.clone())
+            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
+            .clone()
+    };
+    let _build_guard = tag_lock.lock().await;
+
+    // Re-check after acquiring the lock: a concurrent job may have built it.
     let exists = runtime.image_exists(&tag).await.map_err(|e| {
         ExecutionError::Runtime(format!("Failed to check for existing image: {}", e))
     })?;
@@ -9229,4 +9258,88 @@ runs:
         let delim = generate_heredoc_delimiter("ghadelimiter\nghadelimiter_1\nother");
         assert_eq!(delim, "ghadelimiter_2");
     }
+
+    // --- build_combined_runtime_image deduplication ---
+
+    #[tokio::test]
+    async fn build_combined_runtime_image_deduplicates_concurrent_builds() {
+        use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
+
+        #[derive(Clone)]
+        struct CountingRuntime {
+            build_count: Arc<AtomicUsize>,
+            built: Arc<AtomicBool>,
+        }
+
+        #[async_trait::async_trait]
+        impl ContainerRuntime for CountingRuntime {
+            async fn run_container(
+                &self,
+                _image: &str,
+                _cmd: &[&str],
+                _env_vars: &[(&str, &str)],
+                _working_dir: &Path,
+                _volumes: &[(&Path, &Path)],
+                _entrypoint: Option<&str>,
+            ) -> Result<wrkflw_runtime::container::ContainerOutput, ContainerError> {
+                unimplemented!()
+            }
+
+            async fn pull_image(&self, _image: &str) -> Result<(), ContainerError> {
+                Ok(())
+      
```

---

### Incident Patch 7: `100ff531` (2026-04-14)
**Commit Message**: fix(evaluator): make toJSON(env) return env object instead of null (#96)

* fix(evaluator): make toJSON(env) return env object instead of null

It turns out that `toJSON(env)` has been returning the string "null"
this whole time. The reason is straightforward: `ExprValue` had no
concept of an object — only strings, numbers, booleans, and null.
When the evaluator saw bare `env` (no dot, no property), it fell
through every match arm and landed on the catch-all `Null`. Then
toJSON happily serialized that to "null".

Add an `Object(HashMap<String, ExprValue>)` variant to `ExprValue`.
When `resolve()` encounters bare `env`, it now builds an Object from
env_context, filtering out system-injected keys (GITHUB_*, RUNNER_*,
INPUT_*, WRKFLW_*, CI). The toJSON function serializes Object values
as sorted, pretty-printed JSON to match real GitHub Actions behavior.

* fix(evaluator): clean up toJSON(env) Object variant plumbing

The previous commit added ExprValue::Object and wired it into
resolve() for bare `env` context. It worked, but it had a few
things that were *not great*.

The inline env-var filter (six separate prefix/name checks) was
duplicated knowledge about which vars the executor i

**File**: `crates/executor/src/environment.rs` (modified, +27/-0)
```diff
@@ -429,4 +429,31 @@ mod tests {
     fn extract_repo_from_invalid_url() {
         assert_eq!(extract_repo_from_url("not-a-url"), None);
     }
+
+    #[test]
+    fn is_user_env_var_filters_all_github_context_keys() {
+        use crate::expression::is_user_env_var;
+
+        let workflow_yaml = r#"
+name: test
+on: push
+jobs:
+  test:
+    runs-on: ubuntu-latest
+    steps:
+      - run: echo hi
+"#;
+        let workflow: wrkflw_parser::workflow::WorkflowDefinition =
+            serde_yaml::from_str(workflow_yaml).expect("valid workflow yaml");
+        let tmp = std::env::temp_dir().join("wrkflw_env_test");
+        let _ = std::fs::create_dir_all(&tmp);
+        let ctx = create_github_context(&workflow, &tmp);
+        for key in ctx.keys() {
+            assert!(
+                !is_user_env_var(key),
+                "internal key '{}' should be filtered by is_user_env_var but was not",
+                key
+            );
+        }
+    }
 }
```

**File**: `crates/executor/src/expression.rs` (modified, +249/-0)
```diff
@@ -24,6 +24,8 @@ pub enum ExprValue {
     Number(f64),
     Bool(bool),
     Null,
+    /// A key-value map, used for context objects like `env`, `github`, etc.
+    Object(HashMap<String, ExprValue>),
 }
 
 impl ExprValue {
@@ -34,6 +36,7 @@ impl ExprValue {
             ExprValue::Number(n) => *n != 0.0 && !n.is_nan(),
             ExprValue::String(s) => !s.is_empty(),
             ExprValue::Null => false,
+            ExprValue::Object(_) => true,
         }
     }
 
@@ -50,6 +53,12 @@ impl ExprValue {
             }
             ExprValue::Bool(b) => if *b { "true" } else { "false" }.to_string(),
             ExprValue::Null => String::new(),
+            ExprValue::Object(map) => {
+                // GHA coerces objects to their JSON representation in string contexts.
+                let sorted: std::collections::BTreeMap<&String, serde_json::Value> =
+                    map.iter().map(|(k, v)| (k, expr_to_json(v))).collect();
+                serde_json::to_string_pretty(&sorted).unwrap_or_else(|_| "{}".to_string())
+            }
         }
     }
 }
@@ -269,6 +278,27 @@ impl<'a> Tokenizer<'a> {
     }
 }
 
+/// Returns `true` if this env-var key belongs to the user-defined `env:` context
+/// rather than an internal variable injected by the executor/runner.
+///
+/// KNOWN LIMITATION: Because `env_context` is a single flat HashMap that mixes
+/// user-declared env vars with runner-injected ones, we use a heuristic prefix
+/// filter. This means a user-defined var like `env: { GITHUB_CUSTOM: "val" }`
+/// or the commonly used `env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }`
+/// will be incorrectly excluded from `toJSON(env)` output. The proper fix is to
+/// separate user env from runner env upstream in ExpressionContext, but that is
+/// a larger refactor tracked separately.
+///
+/// Update this function when new internal prefixes are introduced.
+pub(crate) fn is_user_env_var(key: &str) -> bool {
+    !key.starts_with("GITHUB_")
+        && !key.starts_with("RUNNER_")
+        && !key.starts_with("INPUT_")
+        && !key.starts_with("WRKFLW_")
+        && key != "CI"
+        && key != "MATRIX_CONTEXT" // inserted by add_matrix_context() in environment.rs
+}
+
 // ---------------------------------------------------------------------------
 // Expression context
 // ---------------------------------------------------------------------------
@@ -391,6 +421,18 @@ impl<'a> ExpressionContext<'a> {
                 .get(&parts[1])
                 .map(|(_, conclusion)| ExprValue::String(conclusion.clone()))
                 .unwrap_or(ExprValue::Null),
+            // Bare context names — return the whole context as an Object so that
+            // `toJSON(env)` (and similar) can serialise it.
+            // TODO: support other bare contexts: github, secrets, matrix, steps, needs
+            "env" if parts.len() == 1 => {
+                let map = self
+                    .env_context
+                    .iter()
+                    .filter(|(k, _)| is_user_env_var(k))
+                    .map(|(k, v)| (k.clone(), ExprValue::String(v.clone())))
+                    .collect();
+                ExprValue::Object(map)
+            }
             _ => ExprValue::Null,
         }
     }
@@ -637,6 +679,8 @@ fn expr_eq(a: &ExprValue, b: &ExprValue) -> bool {
             let sv = s.eq_ignore_ascii_case("true");
             *b == sv
         }
+        // Objects are not comparable via ==
+        (ExprValue::Object(_), _) | (_, ExprValue::Object(_)) => false,
     }
 }
 
@@ -646,6 +690,9 @@ fn expr_cmp(a: &ExprValue, b: &ExprValue) -> Option<std::cmp::Ordering> {
         (ExprValue::String(a), ExprValue::String(b)) => {
             Some(a.to_lowercase().cmp(&b.to_lowercase()))
         }
+        // Objects are not orderable — comparisons like `env < env` yield None
+        // (meaning the comparison expression will evaluate to false).
+        (ExprValue::Object(_), _) | (_, ExprValue::Object(_)) => No
```

---

### Incident Patch 8: `530a7096` (2026-04-14)
**Commit Message**: fix(executor): populate workflow-level env in expression context (#95)

* fix(executor): populate workflow-level env in expression context

It turns out that `WorkflowDefinition` simply *didn't have* an `env`
field. Serde was silently discarding the workflow-level `env:` block
during YAML deserialization, so `${{ env.GLOBAL_VAR }}` evaluated to
empty string while `$GLOBAL_VAR` in shell commands worked fine —
because the OS environment got the vars, but the expression evaluator
never did.

Job-level and step-level env worked correctly because the `Job` and
`Step` structs both had their `env: HashMap<String, String>` fields.
The workflow-level struct just... didn't. For absolutely no reason.

Add the missing `env` field to `WorkflowDefinition` and merge it into
`env_context` right after `create_github_context()`, before job-level
env is applied. This gives correct precedence: step > job > workflow,
matching GitHub Actions behavior.

* fix(executor): harden workflow-level env precedence and add expression resolution

The previous commit added workflow-level env to the expression
context, but it used insert() which means a workflow that defines
env: { CI: "false" } would *override* the

**File**: `crates/executor/src/engine.rs` (modified, +123/-0)
```diff
@@ -106,6 +106,38 @@ async fn execute_github_workflow(
     // 4. Set up GitHub-like environment
     let mut env_context = environment::create_github_context(&workflow, workspace_dir.path());
 
+    // Add workflow-level environment variables (lowest precedence — does not override
+    // built-in GITHUB_*/RUNNER_* vars; job and step env override these later).
+    // Resolve ${{ }} expressions (e.g. ${{ github.repository }}) in values.
+    {
+        let wf_expr_ctx = crate::expression::ExpressionContext {
+            env_context: &env_context,
+            step_outputs: &HashMap::new(),
+            matrix_combination: &None,
+            step_statuses: &HashMap::new(),
+            job_status: "success",
+            secrets_context: &HashMap::new(),
+            needs_context: &HashMap::new(),
+            needs_results: &HashMap::new(),
+        };
+        let cwd = std::env::current_dir().map_err(|e| {
+            ExecutionError::Execution(format!("Failed to get current directory: {}", e))
+        })?;
+        let resolved_env: Vec<(String, String)> = workflow
+            .env
+            .iter()
+            .map(|(key, value)| {
+                let resolved =
+                    crate::substitution::preprocess_expressions(value, &cwd, &wf_expr_ctx)
+                        .unwrap_or_else(|_| value.clone());
+                (key.clone(), resolved)
+            })
+            .collect();
+        for (key, value) in resolved_env {
+            env_context.entry(key).or_insert(value);
+        }
+    }
+
     // Add runtime mode to environment
     env_context.insert(
         "WRKFLW_RUNTIME_MODE".to_string(),
@@ -4585,6 +4617,7 @@ async fn execute_composite_action(
                         on_raw: serde_yaml::Value::Null,
                         jobs: HashMap::new(),
                         defaults: None,
+                        env: HashMap::new(),
                     },
                     runner_image,
                     verbose,
@@ -5492,6 +5525,94 @@ mod tests {
         assert_eq!(job_env.get("JOB_ONLY").unwrap(), "job-value");
     }
 
+    // --- workflow-level env tests ---
+
+    #[test]
+    fn workflow_env_does_not_override_builtin_github_vars() {
+        // Workflow-level env uses entry().or_insert(), so it must NOT override
+        // built-in GITHUB_* variables set by create_github_context().
+        let mut env_context: HashMap<String, String> = HashMap::from([
+            ("GITHUB_SHA".into(), "abc123".into()),
+            ("CI".into(), "true".into()),
+        ]);
+
+        // Simulate workflow env with keys that collide with builtins
+        let workflow_env: HashMap<String, String> = HashMap::from([
+            ("GITHUB_SHA".into(), "should-not-win".into()),
+            ("CI".into(), "false".into()),
+            ("MY_CUSTOM_VAR".into(), "custom-value".into()),
+        ]);
+        for (key, value) in &workflow_env {
+            env_context
+                .entry(key.clone())
+                .or_insert_with(|| value.clone());
+        }
+
+        // Built-in values must be preserved
+        assert_eq!(env_context.get("GITHUB_SHA").unwrap(), "abc123");
+        assert_eq!(env_context.get("CI").unwrap(), "true");
+        // Custom workflow env is added
+        assert_eq!(env_context.get("MY_CUSTOM_VAR").unwrap(), "custom-value");
+    }
+
+    #[test]
+    fn workflow_env_overridden_by_job_env() {
+        // Precedence: workflow env (lowest) < job env < step env (highest)
+        let mut env_context: HashMap<String, String> = HashMap::new();
+
+        // Step 1: workflow env (lowest precedence)
+        let workflow_env: HashMap<String, String> = HashMap::from([
+            ("SHARED".into(), "from-workflow".into()),
+            ("WF_ONLY".into(), "workflow-value".into()),
+        ]);
+        for (key, value) in &workflow_env {
+            env_context
+                .entry(key.clone())
+                .or_insert_with(|| value.clone());
+        }
+
+    
```

**File**: `crates/parser/src/gitlab.rs` (modified, +1/-0)
```diff
@@ -120,6 +120,7 @@ pub fn convert_to_workflow_format(pipeline: &Pipeline) -> workflow::WorkflowDefi
         on_raw: serde_yaml::Value::String("push".to_string()),
         jobs: HashMap::new(),
         defaults: None,
+        env: HashMap::new(),
     };
 
     // Convert each GitLab job to a GitHub Actions job
```

**File**: `crates/parser/src/workflow.rs` (modified, +10/-0)
```diff
@@ -146,6 +146,8 @@ pub struct WorkflowDefinition {
     pub jobs: HashMap<String, Job>,
     #[serde(default)]
     pub defaults: Option<Defaults>,
+    #[serde(default)]
+    pub env: HashMap<String, String>,
 }
 
 #[derive(Debug, Deserialize, Serialize, Default)]
@@ -412,6 +414,7 @@ mod tests {
             on_raw: serde_yaml::Value::Null,
             jobs: Default::default(),
             defaults: None,
+            env: HashMap::new(),
         };
         let info = wd.resolve_action("actions/checkout@v4");
         assert_eq!(info.repository, "actions/checkout");
@@ -429,6 +432,7 @@ mod tests {
             on_raw: serde_yaml::Value::Null,
             jobs: Default::default(),
             defaults: None,
+            env: HashMap::new(),
         };
         let info = wd.resolve_action("owner/repo");
         assert_eq!(info.repository, "owner/repo");
@@ -444,6 +448,7 @@ mod tests {
             on_raw: serde_yaml::Value::Null,
             jobs: Default::default(),
             defaults: None,
+            env: HashMap::new(),
         };
         let info = wd.resolve_action("docker://alpine:3.18");
         assert_eq!(info.repository, "docker://alpine:3.18");
@@ -460,6 +465,7 @@ mod tests {
             on_raw: serde_yaml::Value::Null,
             jobs: Default::default(),
             defaults: None,
+            env: HashMap::new(),
         };
         let info = wd.resolve_action("./my-action");
         assert_eq!(info.repository, "./my-action");
@@ -476,6 +482,7 @@ mod tests {
             on_raw: serde_yaml::Value::Null,
             jobs: Default::default(),
             defaults: None,
+            env: HashMap::new(),
         };
         // Docker image references can use @sha256:digest — the full string is the image ref
         let info = wd.resolve_action("docker://alpine@sha256:abcdef1234567890");
@@ -493,6 +500,7 @@ mod tests {
             on_raw: serde_yaml::Value::Null,
             jobs: Default::default(),
             defaults: None,
+            env: HashMap::new(),
         };
         let info = wd.resolve_action("actions/checkout@a81bbbf8298c0fa03ea29cdc473d45769f953675");
         assert_eq!(info.repository, "actions/checkout");
@@ -508,6 +516,7 @@ mod tests {
             on_raw: serde_yaml::Value::Null,
             jobs: Default::default(),
             defaults: None,
+            env: HashMap::new(),
         };
         let info = wd.resolve_action("owner/repo/path/to/action@v2");
         assert_eq!(info.repository, "owner/repo");
@@ -525,6 +534,7 @@ mod tests {
             on_raw: serde_yaml::Value::Null,
             jobs: Default::default(),
             defaults: None,
+            env: HashMap::new(),
         };
         let info = wd.resolve_action("github/codeql-action/init@v3");
         assert_eq!(info.repository, "github/codeql-action");
```

**File**: `crates/trigger-filter/src/parser.rs` (modified, +1/-0)
```diff
@@ -900,6 +900,7 @@ pul_request:
             on_raw: make_on_raw("pul_request"),
             jobs: std::collections::HashMap::new(),
             defaults: None,
+            env: std::collections::HashMap::new(),
         };
         let mut cfg = parse_trigger_config(&wf, PathBuf::from("test.yml")).unwrap();
         // Drain explicitly so the MustDrainWarnings Drop check stays
```

---

### Incident Patch 9: `b711e871` (2026-04-13)
**Commit Message**: fix(executor): propagate composite action outputs back to caller (#94)

* fix(executor): propagate composite action outputs back to caller

It turns out that execute_composite_action() was happily running all
the internal steps of a composite action, correctly tracking their
outputs in composite_step_outputs, and then... just throwing all of
that away. The action.yml `outputs:` section — the whole reason
composite actions *have* a return path — was never read or evaluated.

So ${{ steps.my-composite.outputs.whatever }} always resolved to
empty string. Inputs worked fine. The internal steps ran fine. The
output values were right there in memory. Nobody bothered to connect
the last wire.

Add propagate_composite_outputs() which reads the action's outputs
section after the step loop, evaluates each value expression against
the composite's internal step context, and writes the results to the
caller's GITHUB_OUTPUT file. The existing apply_step_environment_updates
pipeline then picks them up naturally — no changes to StepResult or
process_outcome needed.

Also wire this into the early-return failure path so partial outputs
are still available when a composite step fails.

* fix(executor

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
 /target
 .indxr-cache/
+.claude/todos/
```

**File**: `crates/executor/src/engine.rs` (modified, +475/-0)
```diff
@@ -4638,6 +4638,15 @@ async fn execute_composite_action(
 
                 // Short-circuit on failure if needed
                 if step_result.status == StepStatus::Failure {
+                    // Still propagate whatever outputs were collected before the failure
+                    propagate_composite_outputs(
+                        &action_def,
+                        &composite_step_outputs,
+                        &action_env,
+                        job_env,
+                        working_dir,
+                        &composite_job_status,
+                    );
                     return Ok(StepResult::new(
                         step.name
                             .clone()
@@ -4648,6 +4657,16 @@ async fn execute_composite_action(
                 }
             }
 
+            // Propagate composite action outputs to the caller's GITHUB_OUTPUT
+            propagate_composite_outputs(
+                &action_def,
+                &composite_step_outputs,
+                &action_env,
+                job_env,
+                working_dir,
+                &composite_job_status,
+            );
+
             // All steps completed successfully
             let output = if verbose {
                 let mut detailed_output = format!(
@@ -4700,6 +4719,123 @@ async fn execute_composite_action(
     }
 }
 
+/// Evaluate a composite action's `outputs:` section and write the resolved values
+/// to the caller's GITHUB_OUTPUT file so `${{ steps.<id>.outputs.<key> }}` works.
+fn propagate_composite_outputs(
+    action_def: &serde_yaml::Value,
+    composite_step_outputs: &HashMap<String, HashMap<String, String>>,
+    action_env: &HashMap<String, String>,
+    caller_job_env: &HashMap<String, String>,
+    working_dir: &Path,
+    job_status: &str,
+) {
+    let outputs = match action_def.get("outputs").and_then(|v| v.as_mapping()) {
+        Some(m) => m,
+        None => return, // No outputs declared
+    };
+
+    // Build an expression context scoped to the composite's internal steps
+    let empty_matrix = None;
+    let empty_statuses = HashMap::new();
+    let empty_secrets = HashMap::new();
+    let empty_needs = HashMap::new();
+    let empty_results = HashMap::new();
+    let expr_ctx = crate::expression::ExpressionContext {
+        env_context: action_env,
+        step_outputs: composite_step_outputs,
+        matrix_combination: &empty_matrix,
+        step_statuses: &empty_statuses,
+        job_status,
+        secrets_context: &empty_secrets,
+        needs_context: &empty_needs,
+        needs_results: &empty_results,
+    };
+
+    // Collect evaluated outputs
+    let mut resolved: Vec<(String, String)> = Vec::new();
+    for (key, def) in outputs {
+        let key_str = match key.as_str() {
+            Some(k) => k,
+            None => continue,
+        };
+        let value_expr = match def.get("value").and_then(|v| v.as_str()) {
+            Some(v) => v,
+            None => continue,
+        };
+        match crate::substitution::preprocess_expressions(value_expr, working_dir, &expr_ctx) {
+            Ok(val) => resolved.push((key_str.to_string(), val)),
+            Err(e) => {
+                wrkflw_logging::debug(&format!(
+                    "Failed to evaluate composite output '{}': {}",
+                    key_str, e
+                ));
+            }
+        }
+    }
+
+    if resolved.is_empty() {
+        return;
+    }
+
+    // Append to the caller's GITHUB_OUTPUT file
+    if let Some(output_path) = caller_job_env.get("GITHUB_OUTPUT") {
+        use std::io::Write;
+        match std::fs::OpenOptions::new()
+            .create(true)
+            .append(true)
+            .open(output_path)
+        {
+            Ok(mut f) => {
+                for (key, value) in &resolved {
+                    let res = if value.contains('\n') {
+                        // Use a unique delimiter to avoid collisions with value content
+                        let deli
```

---

### Incident Patch 10: `a668d815` (2026-04-13)
**Commit Message**: fix: artifact actions under --runtime emulation  (#93)

* test(executor): cover run-step → upload/download-artifact handoff under emulation

Drive a real EmulationRuntime through execute_step for three steps (run,
upload-artifact, download-artifact) and assert the payload round-trips
byte-for-byte. Reproduces #88: today the run step writes via the
GITHUB_WORKSPACE reroute while upload reads ctx.working_dir, so the two
workspaces diverge and the upload fails with "No files found matching
pattern".

Test is intentionally failing at this commit; the fix follows.

* runtime(container): add resolve_host_working_dir helper

Introduces a pure function that rebases a container-visible working
directory onto its host-side volume source by finding the longest
component-boundary prefix in the volumes list and grafting the suffix.

This is the building block for making non-container runtimes
(emulation, secure_emulation) honor the same mount semantics as docker,
so a run: step and an artifact handler observe the same host workspace
(fix for #88). The helper itself is pure and pub(crate); wiring follows
in the next commit.

Component-boundary matching (via Path::strip_prefix) ensures
/github/wo

**File**: `crates/executor/src/engine.rs` (modified, +183/-0)
```diff
@@ -7618,6 +7618,189 @@ runs:
         assert!(dl_result.output.contains("Downloaded artifact 'my-build'"));
     }
 
+    /// Regression test for #88.
+    ///
+    /// A `run:` step that writes a file must land in the same workspace that
+    /// `actions/upload-artifact` subsequently reads from. Under the buggy
+    /// emulation runtime, run steps were rerouted to `GITHUB_WORKSPACE` (i.e.
+    /// the real project directory) while artifact handlers kept using the
+    /// per-job tempdir — so uploads could never find files the run step had
+    /// just written.
+    ///
+    /// This test drives a real `EmulationRuntime` end-to-end through
+    /// run → upload-artifact → download-artifact and asserts the payload
+    /// round-trips byte-for-byte.
+    #[cfg(not(target_os = "windows"))]
+    #[tokio::test]
+    async fn run_step_upload_download_artifact_roundtrip_emulation() {
+        let runtime = emulation::EmulationRuntime::new();
+        let workflow = minimal_workflow();
+        let working_dir = tempfile::tempdir().unwrap();
+
+        // Point GITHUB_WORKSPACE at an isolated tempdir. On buggy main this is
+        // where the rerouted run step writes, so upload (which reads
+        // `ctx.working_dir`) finds nothing and the test fails. After the fix,
+        // emulation honors the volume mount and the run step writes directly
+        // into `ctx.working_dir`, so this path is irrelevant — but we still
+        // isolate it to keep the test from touching the real project tree.
+        let fake_github_ws = tempfile::tempdir().unwrap();
+
+        let artifact_dir = tempfile::tempdir().unwrap();
+        let artifact_store = crate::artifacts::ArtifactStore::new(artifact_dir.path()).unwrap();
+        let cache_dir = tempfile::tempdir().unwrap();
+        let cache_store =
+            crate::cache::CacheStore::with_root(cache_dir.path().to_path_buf()).unwrap();
+        let pending = std::sync::Mutex::new(Vec::<PendingCacheSave>::new());
+
+        let mut job_env = HashMap::new();
+        job_env.insert(
+            "GITHUB_WORKSPACE".to_string(),
+            fake_github_ws.path().to_string_lossy().to_string(),
+        );
+
+        // --- Step 1: run step that writes a file into the workspace ---
+        let run_step = make_step_run("mkdir artifact-dir && echo hello > artifact-dir/payload.txt");
+        let run_ctx = StepExecutionContext {
+            step: &run_step,
+            step_idx: 0,
+            job_env: &job_env,
+            working_dir: working_dir.path(),
+            runtime: &runtime,
+            workflow: &workflow,
+            runner_image: "ubuntu:latest",
+            verbose: false,
+            matrix_combination: &None,
+            container_config: None,
+            workflow_defaults: None,
+            job_defaults: None,
+            step_outputs: &HashMap::new(),
+            step_statuses: &HashMap::new(),
+            job_status: "success",
+            services: JobServices {
+                secret_manager: None,
+                secret_masker: None,
+                secrets_context: &HashMap::new(),
+                needs_context: &HashMap::new(),
+                needs_results: &HashMap::new(),
+                artifact_store: &artifact_store,
+                cache_store: &cache_store,
+            },
+            pending_cache_saves: &pending,
+        };
+        let run_result = execute_step(run_ctx).await.unwrap();
+        assert_eq!(
+            run_result.status,
+            StepStatus::Success,
+            "run step failed: {}",
+            run_result.output
+        );
+
+        // --- Step 2: upload-artifact reads the file the run step just wrote ---
+        let mut up_with = HashMap::new();
+        up_with.insert("name".to_string(), "payload".to_string());
+        up_with.insert("path".to_string(), "artifact-dir/payload.txt".to_string());
+        let up_step = make_step(
+            "upload",
+            "actions/upload-artifact@v4",
+  
```

**File**: `crates/runtime/src/container.rs` (modified, +238/-1)
```diff
@@ -1,5 +1,7 @@
 use async_trait::async_trait;
-use std::path::Path;
+use std::fs;
+use std::path::{Path, PathBuf};
+use wrkflw_logging;
 
 /// Prefix for all locally-built images. Used to skip registry pulls.
 pub const LOCAL_IMAGE_PREFIX: &str = "wrkflw-";
@@ -67,6 +69,102 @@ pub enum ContainerError {
     NetworkOperation(String),
 }
 
+/// Rebase a container-visible working directory onto its host-side volume
+/// source.
+///
+/// Given a `container_dir` like `/github/workspace/sub` and a `volumes` list
+/// that maps `(host, container)` pairs (e.g. `(/tmp/job-xxxx, /github/workspace)`),
+/// return the corresponding host path (`/tmp/job-xxxx/sub`) by locating the
+/// longest `container` path that is a component-boundary prefix of
+/// `container_dir` and grafting the remainder onto its `host` counterpart.
+///
+/// Returns `None` if no volume covers `container_dir`.
+///
+/// This is the mount-semantics bridge used by non-container runtimes
+/// (emulation, secure_emulation) so that a `run:` step and an
+/// artifact/cache handler observe the same host workspace. It is the fix
+/// for #88.
+pub(crate) fn resolve_host_working_dir(
+    container_dir: &Path,
+    volumes: &[(&Path, &Path)],
+) -> Option<PathBuf> {
+    let mut best: Option<(usize, PathBuf)> = None;
+    for (host, container) in volumes {
+        if let Ok(suffix) = container_dir.strip_prefix(container) {
+            // `Path::strip_prefix` respects component boundaries, so
+            // `/github/workspace-foo` is NOT matched by `/github/workspace`.
+            let depth = container.components().count();
+            let candidate = host.join(suffix);
+            match &best {
+                // Equal-depth ties can only occur when two volume entries
+                // share the same `container` prefix (two distinct container
+                // paths that are both strict component-boundary prefixes of
+                // the same `container_dir` must have different component
+                // counts, because one has to contain the other). In that
+                // duplicate-entry case, first-seen wins — the `>=` is the
+                // intentional conflict resolution, not a typo for `>`.
+                Some((best_depth, _)) if *best_depth >= depth => {}
+                _ => best = Some((depth, candidate)),
+            }
+        }
+    }
+    best.map(|(_, path)| path)
+}
+
+/// Resolve the host working directory for a non-container runtime call, or
+/// return a `ContainerError` describing why it couldn't.
+///
+/// This is the shared wiring used by `EmulationRuntime::run_container` and
+/// `SecureEmulationRuntime::run_container`. It enforces one invariant: when
+/// `volumes` covers `working_dir`, the volume mapping **always wins** over
+/// any accidentally-existing host path — so a dev-environment quirk like
+/// `/github/workspace` happening to exist on the host cannot silently skip
+/// the rebase and reintroduce #88.
+///
+/// - If a volume covers `working_dir`, rebase it, `create_dir_all` the host
+///   side if it doesn't exist yet (matching docker's bind-mount behavior of
+///   creating the mount target on first access), and return the host path.
+/// - If no volume covers `working_dir` but `working_dir` itself exists on
+///   the host, accept it as a caller-provided host path.
+/// - Otherwise, return a loud, descriptive error. No silent fallback.
+///
+/// `runtime_label` is used as a prefix in log and error messages so the
+/// reader can tell which runtime produced a given line.
+pub(crate) fn rebase_working_dir_or_error(
+    working_dir: &Path,
+    volumes: &[(&Path, &Path)],
+    runtime_label: &str,
+) -> Result<PathBuf, ContainerError> {
+    match resolve_host_working_dir(working_dir, volumes) {
+        Some(host) => {
+            if !host.exists() {
+                fs::create_dir_all(&host).map_err(|e| {
+                    ContainerError::ContainerExecution(format!(
+                        "{}: failed to 
```

**File**: `crates/runtime/src/emulation.rs` (modified, +45/-43)
```diff
@@ -1,4 +1,6 @@
-use crate::container::{ContainerError, ContainerOutput, ContainerRuntime};
+use crate::container::{
+    rebase_working_dir_or_error, ContainerError, ContainerOutput, ContainerRuntime,
+};
 use async_trait::async_trait;
 use once_cell::sync::Lazy;
 use std::collections::HashMap;
@@ -152,7 +154,7 @@ impl ContainerRuntime for EmulationRuntime {
         command: &[&str],
         env_vars: &[(&str, &str)],
         working_dir: &Path,
-        _volumes: &[(&Path, &Path)],
+        volumes: &[(&Path, &Path)],
         _entrypoint: Option<&str>,
     ) -> Result<ContainerOutput, ContainerError> {
         // Build command string
@@ -197,47 +199,13 @@ impl ContainerRuntime for EmulationRuntime {
             wrkflw_logging::info(&format!("  {}={}", key, value));
         }
 
-        // Find actual working directory - determine if we should use the current directory instead
-        let actual_working_dir: PathBuf = if !working_dir.exists() {
-            // Look for GITHUB_WORKSPACE or CI_PROJECT_DIR in env_vars
-            let mut workspace_path = None;
-            for (key, value) in env_vars {
-                if *key == "GITHUB_WORKSPACE" || *key == "CI_PROJECT_DIR" {
-                    workspace_path = Some(PathBuf::from(value));
-                    break;
-                }
-            }
-
-            // If found, use that as the working directory
-            if let Some(path) = workspace_path {
-                if path.exists() {
-                    wrkflw_logging::info(&format!(
-                        "Using environment-defined workspace: {}",
-                        path.display()
-                    ));
-                    path
-                } else {
-                    // Fallback to current directory
-                    let current_dir =
-                        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
-                    wrkflw_logging::info(&format!(
-                        "Using current directory: {}",
-                        current_dir.display()
-                    ));
-                    current_dir
-                }
-            } else {
-                // Fallback to current directory
-                let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
-                wrkflw_logging::info(&format!(
-                    "Using current directory: {}",
-                    current_dir.display()
-                ));
-                current_dir
-            }
-        } else {
-            working_dir.to_path_buf()
-        };
+        // Resolve the host working directory via the shared mount-semantics
+        // helper. When `volumes` covers `working_dir` (the normal case for
+        // container-visible paths like `/github/workspace`), the rebase
+        // always wins over an accidentally-existing host path — so a dev
+        // environment with a real `/github/workspace` directory cannot
+        // silently reintroduce #88.
+        let actual_working_dir = rebase_working_dir_or_error(working_dir, volumes, "emulation")?;
 
         wrkflw_logging::info(&format!(
             "Using actual working directory: {}",
@@ -823,4 +791,38 @@ mod tests {
         );
         assert!(output.stdout.is_empty(), "stdout should be empty");
     }
+
+    /// Regression for #88: if the caller passes a container-visible working
+    /// directory that no volume covers, emulation must hard-error instead of
+    /// silently rerouting to `GITHUB_WORKSPACE`. Symmetry test with the
+    /// matching `secure_emulation_errors_when_volumes_dont_cover_working_dir`.
+    #[tokio::test]
+    async fn emulation_errors_when_volumes_dont_cover_working_dir() {
+        let runtime = EmulationRuntime::new();
+
+        // /github/workspace doesn't exist on host and no volume covers it.
+        let result = runtime
+            .run_container(
+                "alpine:latest",
+                &["echo", "nope"],
+                &[],
+      
```

**File**: `crates/runtime/src/sandbox.rs` (modified, +25/-175)
```diff
@@ -1,13 +1,18 @@
 use regex::Regex;
 use std::collections::HashSet;
-use std::fs;
-use std::path::{Path, PathBuf};
+use std::path::Path;
 use std::process::{Command, Stdio};
 use std::time::Duration;
-use tempfile::TempDir;
 use wrkflw_logging;
 
-/// Configuration for sandbox execution
+/// Configuration for sandbox execution.
+///
+/// Note: this sandbox provides **command-level** validation (whitelist,
+/// blocklist, dangerous-pattern regexes) and **environment-variable**
+/// filtering. It does NOT provide filesystem isolation — the command runs
+/// in the caller's working directory as a plain subprocess, so absolute
+/// paths and `..` sequences can reach anything the host user can reach.
+/// If filesystem isolation is needed, use the Docker or Podman runtime.
 #[derive(Debug, Clone)]
 pub struct SandboxConfig {
     /// Maximum execution time for commands
@@ -20,10 +25,6 @@ pub struct SandboxConfig {
     pub allowed_commands: HashSet<String>,
     /// Blocked commands (blacklist)
     pub blocked_commands: HashSet<String>,
-    /// Allowed file system paths (read-only)
-    pub allowed_read_paths: HashSet<PathBuf>,
-    /// Allowed file system paths (read-write)
-    pub allowed_write_paths: HashSet<PathBuf>,
     /// Whether to enable network access
     pub allow_network: bool,
     /// Maximum number of processes
@@ -143,8 +144,6 @@ impl Default for SandboxConfig {
             max_cpu_percent: 80,
             allowed_commands,
             blocked_commands,
-            allowed_read_paths: HashSet::new(),
-            allowed_write_paths: HashSet::new(),
             allow_network: false,
             max_processes: 10,
             strict_mode: true,
@@ -180,32 +179,35 @@ pub enum SandboxError {
 /// Secure sandbox for executing commands in emulation mode
 pub struct Sandbox {
     config: SandboxConfig,
-    workspace: TempDir,
     dangerous_patterns: Vec<Regex>,
 }
 
 impl Sandbox {
     /// Create a new sandbox with the given configuration
     pub fn new(config: SandboxConfig) -> Result<Self, SandboxError> {
-        let workspace = tempfile::tempdir().map_err(|e| SandboxError::SandboxSetupError {
-            reason: format!("Failed to create sandbox workspace: {}", e),
-        })?;
-
         let dangerous_patterns = Self::compile_dangerous_patterns();
 
-        wrkflw_logging::info(&format!(
-            "Created new sandbox with workspace: {}",
-            workspace.path().display()
-        ));
+        wrkflw_logging::info("Created new sandbox");
 
         Ok(Self {
             config,
-            workspace,
             dangerous_patterns,
         })
     }
 
-    /// Execute a command in the sandbox
+    /// Execute a command in the sandbox.
+    ///
+    /// The command runs **in-place** in `working_dir` (no file copying). The
+    /// caller is responsible for ensuring `working_dir` is the correct host
+    /// workspace — `SecureEmulationRuntime::run_container` rebases container
+    /// paths via the volume mount before calling in, matching the mount
+    /// semantics of docker/podman (#88).
+    ///
+    /// Security is enforced by `validate_command` (command whitelist / blocked
+    /// commands / dangerous patterns), `is_env_var_safe` (env var filtering),
+    /// and `execute_with_limits` (timeout). The previous copy-files-to-a-
+    /// private-workspace layer was not actually providing isolation — it was
+    /// breaking the run-step / artifact-handler workspace invariant.
     pub async fn execute_command(
         &self,
         command: &[&str],
@@ -223,11 +225,8 @@ impl Sandbox {
         // Step 1: Validate command
         self.validate_command(&command_str)?;
 
-        // Step 2: Setup sandbox environment
-        let sandbox_dir = self.setup_sandbox_environment(working_dir)?;
-
-        // Step 3: Execute with limits
-        self.execute_with_limits(command, env_vars, &sandbox_dir)
+        // Step 2: Execute in-place with limits
+        self.execute_with_limits(comm
```

**File**: `crates/runtime/src/secure_emulation.rs` (modified, +70/-3)
```diff
@@ -1,4 +1,6 @@
-use crate::container::{ContainerError, ContainerOutput, ContainerRuntime};
+use crate::container::{
+    rebase_working_dir_or_error, ContainerError, ContainerOutput, ContainerRuntime,
+};
 use crate::sandbox::{create_workflow_sandbox_config, Sandbox, SandboxConfig, SandboxError};
 use async_trait::async_trait;
 use std::path::Path;
@@ -52,7 +54,7 @@ impl ContainerRuntime for SecureEmulationRuntime {
         command: &[&str],
         env_vars: &[(&str, &str)],
         working_dir: &Path,
-        _volumes: &[(&Path, &Path)],
+        volumes: &[(&Path, &Path)],
         entrypoint: Option<&str>,
     ) -> Result<ContainerOutput, ContainerError> {
         if let Some(ep) = entrypoint {
@@ -70,10 +72,17 @@ impl ContainerRuntime for SecureEmulationRuntime {
             image
         ));
 
+        // Rebase the container-visible working_dir onto its host-side volume
+        // source, matching EmulationRuntime and docker/podman (#88). Without
+        // this, `run:` steps and artifact/cache handlers observe different
+        // host directories.
+        let host_working_dir =
+            rebase_working_dir_or_error(working_dir, volumes, "secure_emulation")?;
+
         // Use sandbox to execute the command safely
         let result = self
             .sandbox
-            .execute_command(command, env_vars, working_dir)
+            .execute_command(command, env_vars, &host_working_dir)
             .await;
 
         match result {
@@ -403,4 +412,62 @@ mod tests {
         assert!(output.stdout.contains("hello world"));
         assert_eq!(output.exit_code, 0);
     }
+
+    /// Regression for #88: a container-visible working dir must be rebased
+    /// through the `volumes` mapping onto its host counterpart, so commands
+    /// run in the caller's workspace rather than a hidden sandbox copy.
+    #[cfg(not(target_os = "windows"))]
+    #[tokio::test]
+    async fn secure_emulation_rebases_container_working_dir_via_volumes() {
+        let runtime = SecureEmulationRuntime::new();
+        let host_tempdir = tempfile::tempdir().unwrap();
+
+        let host = host_tempdir.path();
+        let container = Path::new("/github/workspace");
+
+        // Run `pwd` in the container workspace; with the rebase it should
+        // print the host tempdir.
+        let result = runtime
+            .run_container(
+                "alpine:latest",
+                &["pwd"],
+                &[],
+                container,
+                &[(host, container)],
+                None,
+            )
+            .await
+            .expect("secure_emulation run failed");
+        assert_eq!(result.exit_code, 0, "stderr: {}", result.stderr);
+        // `pwd` may canonicalize /var → /private/var on macOS, so compare
+        // canonical forms.
+        let canon_host = host.canonicalize().unwrap();
+        let canon_pwd = PathBuf::from(result.stdout.trim()).canonicalize().unwrap();
+        assert_eq!(canon_pwd, canon_host);
+    }
+
+    #[tokio::test]
+    async fn secure_emulation_errors_when_volumes_dont_cover_working_dir() {
+        let runtime = SecureEmulationRuntime::new();
+
+        // /github/workspace doesn't exist on host and no volume covers it.
+        let result = runtime
+            .run_container(
+                "alpine:latest",
+                &["echo", "nope"],
+                &[],
+                Path::new("/github/workspace"),
+                &[],
+                None,
+            )
+            .await;
+
+        let err = result.expect_err("should error when no volume covers working_dir");
+        let msg = err.to_string();
+        assert!(
+            msg.contains("not covered by any volume mount"),
+            "unexpected error: {}",
+            msg
+        );
+    }
 }
```

#### Recent Merged Pull Requests:
- **PR #129** (2026-09-08): refactor(ui): drop the write-only WorkflowExecution.logs field (@bahdotsh)
- **PR #128** (2026-09-08): fix(ui): stop logging the same TUI message to both log sinks (@bahdotsh)
- **PR #127** (2026-09-08): fix(ui): show real timestamps on diff-filter log lines (@bahdotsh)
- **PR #119** (2026-07-03): fix(ui): show real timestamps for remaining bare TUI log pushes (@bahdotsh)
- **PR #118** (2026-06-10): fix(executor): deduplicate concurrent runtime image builds (@ammachado)
- **PR #116** (2026-06-11): fix: show correct timestamp in execution tab for all TUI log messages (@ammachado)
- **PR #115** (2026-06-11): fix: resolve matrix expressions in step `with` values before execution (@ammachado)
- **PR #114** (2026-06-11): feat(runtime): add Auto runtime that detects Docker then Podman (@ammachado)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
