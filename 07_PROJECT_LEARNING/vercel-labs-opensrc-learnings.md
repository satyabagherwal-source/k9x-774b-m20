# Forensic Learning Record (Deep Inspection): vercel-labs/opensrc

> **Canonical Artifact**: `07_PROJECT_LEARNING/vercel-labs-opensrc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vercel-labs/opensrc](https://github.com/vercel-labs/opensrc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:24:53.099Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vercel-labs/opensrc`
- **Description**: Fetch source code for npm packages to give AI coding agents deeper context
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3008 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/opensrc/cli/src/core/cache.rs`
```
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use serde::{Deserialize, Serialize};

use super::error::{Error, Result};
use super::registries::Registry;

static RE_HTTPS_REPO: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"https?://([^/]+)/([^/]+)/([^/]+)").unwrap());
static RE_SSH_REPO: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"git@([^:]+):([^/]+)/(.+)").unwrap());

const OPENSRC_DIR: &str = ".opensrc";
const REPOS_DIR: &str = "repos";
const SOURCES_FILE: &str = "sources.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageEntry {
    pub name: String,
    pub version: String,
    pub registry: Registry,
    pub path: String,
    #[serde(rename = "fetchedAt")]
    pub fetched_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoEntry {
    pub name: String,
    pub version: String,
    pub path: String,
    #[serde(rename = "fetchedAt")]
    pub fetched_at: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct SourcesIndex {
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub packages: Option<Vec<PackageEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repos: Option<Vec<RepoEntry>>,
}

pub fn get_opensrc_dir() -> Result<PathBuf> {
    if let Ok(home) = std::env::var("OPENSRC_HOME") {
        return Ok(PathBuf::from(home));
    }
    dirs::home_dir()
        .map(|h| h.join(OPENSRC_DIR))
        .ok_or(Error::HomeDirNotFound)
}

pub fn get_repos_dir() -> Result<PathBuf> {
    Ok(get_opensrc_dir()?.join(REPOS_DIR))
}

/// Extract host/owner/repo from a git URL.
pub fn parse_repo_url(url: &str) -> Option<(String, String, String)> {
    if let Some(caps) = RE_HTTPS_REPO.captures(url) {
        let repo = caps[3].trim_end_matches(".git").to_string();
        return Some((caps[1].to_string(), caps[2].to_string(), repo));
    }

    if let Some(caps) = RE_SSH_REPO.captures(url) {
        let repo = caps[3].trim_end_matches(".git").to_string();
        return Some((caps[1].to_string(), caps[2].to_string(), repo));
    }

    None
}

pub fn get_repo_display_name(repo_url: &str) -> Option<String> {
    parse_repo_url(repo_url).map(|(host, owner, repo)| format!("{host}/{owner}/{repo}"))
}

pub fn get_repo_path(display_name: &str, version: &str) -> Result<PathBuf> {
    Ok(get_repos_dir()?.join(display_name).join(version))
}

pub fn get_repo_relative_path(display_name: &str, version: &str) -> String {
    format!("{REPOS_DIR}/{display_name}/{version}")
}

pub fn get_absolute_path(relative_path: &str) -> Result<PathBuf> {
    Ok(get_opensrc_dir()?.join(relative_path))
}

pub fn read_sources() -> Result<SourcesIndex> {
    let path = get_opensrc_dir()?.join(SOURCES_FILE);
    if !path.exists() {
        return Ok(SourcesIndex::default());
    }
    match fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str(&content) {
            Ok(index) => Ok(index),
            Err(e) => {
                let bak = path.with_extension("json.bak");
                eprintln!(
                    "Warning: {} is corrupt ({}), backing up to {}",
                    path.display(),
                    e,
                    bak.display()
                );
                let _ = fs::copy(&path, &bak);
                Ok(SourcesIndex::default())
            }
        },
        Err(_) => Ok(SourcesIndex::default()),
    }
}

pub fn list_sources() -> Result<(Vec<PackageEntry>, Vec<RepoEntry>)> {
    let index = read_sources()?;
    Ok((
        index.packages.unwrap_or_default(),
        index.repos.unwrap_or_default(),
    ))
}

/// Atomic write: serializes to a temp file then renames, so concurrent
/// readers never see a partially-written sources.json.
pub fn write_sources(packages: Vec<PackageEntry>, repos: Vec<RepoEntry>) -> Result<()> {
    let dir = get_opensrc_dir()?;
    let path = dir.join(SOURCES_FILE);

    if packages.is_empty() && repos.is_empty() {
        if path.exists() {
            fs::remove_file(&path)?;
        }
        return Ok(());
    }

    fs::create_dir_all(&dir)?;

    let index = SourcesIndex {
        updated_at: Some(chrono::Utc::now().to_rfc3339()),
        packages: if packages.is_empty() {
            None
        } else {
            Some(packages)
        },
        repos: if repos.is_empty() { None } else { Some(repos) },
    };

    let json = serde_json::to_string_pretty(&index)?;
    let tmp = dir.join(".sources.json.tmp");
    fs::write(&tmp, json)?;
    fs::rename(&tmp, &path)?;
    Ok(())
}

pub fn get_package_info(name: &str, registry: Registry) -> Result<Option<PackageEntry>> {
    let (packages, _) = list_sources()?;
    Ok(packages
        .into_iter()
        .find(|p| p.name == name && p.registry == registry))
}

pub fn get_repo_info(display_name: &str) -> Result<Option<RepoEntry>> {
    let (_, repos) = list_sources()?;
    Ok(repos.into_iter().find(|r| r.name == display_name))
}

pub fn extract_repo_base_path(full_path: &str) -> String {
    let parts: Vec<&str> = full_path.split('/').collect();
    if parts.len() >= 4 && parts[0] == "repos" {
        parts[..4].join("/")
    } else {
        full_path.to_string()
    }
}

pub fn remove_package_source(name: &str, registry: Registry) -> Result<(bool, bool)> {
    let (packages, _) = list_sources()?;
    let pkg = match packages
        .iter()
        .find(|p| p.name == name && p.registry == registry)
    {
        Some(p) => p.clone(),
        None => return Ok((false, false)),
    };

    let pkg_repo_base = extract_repo_base_path(&pkg.path);

    let others_use_same = packages.iter().any(|p| {
        extract_repo_base_path(&p.path) == *pkg_repo_base
            && !(p.name == name && p.registry == registry)
    });

    let mut repo_removed = false;

    if !others_use_same {
        let parts: Vec<&str> = pkg.path.split('/').collect();
        if parts.len() >= 5 && parts[0] == "repos" {
            let versioned = parts[..5].join("/");
            let versioned_path = get_opensrc_dir()?.join(&versioned);
            if versioned_path.exists() {
                fs::remove_dir_all(&versioned_path)?;
                repo_removed = true;
                cleanup_empty_parent_dirs(&versioned)?;
            }
        }
    }

    Ok((true, repo_removed))
}

pub fn remove_repo_source(display_name: &str, version: Option<&str>) -> Result<bool> {
    if let Some(ver) = version {
        let path = get_repo_path(display_name, ver)?;
        if !path.exists() {
            return Ok(false);
        }
        fs::remove_dir_all(&path)?;
        cleanup_empty_parent_dirs(&get_repo_relative_path(display_name, ver))?;
        Ok(true)
    } else {
        let repo_dir = get_repos_dir()?.join(display_name);
        if !repo_dir.exists() {
            return Ok(false);
        }
        fs::remove_dir_all(&repo_dir)?;
        cleanup_empty_parent_dirs(&format!("{REPOS_DIR}/{display_name}"))?;
        Ok(true)
    }
}

fn cleanup_empty_parent_dirs(relative_path: &str) -> Result<()> {
    let parts: Vec<&str> = relative_path.split('/').collect();
    if parts.len() < 2 {
        return Ok(());
    }

    let base = get_opensrc_dir()?;
    for i in (1..parts.len()).rev() {
        let dir = base.join(parts[..i].join("/"));
        if dir.exists() {
            if let Ok(entries) = fs::read_dir(&dir) {
                if entries.count() == 0 {
                    let _ = fs::remove_dir(&dir);
                } else {
                    break;
                }
            }
        }
    }
    Ok(())
}

pub fn cleanup_empty_dirs(dir: &Path) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                cleanup_empty_dirs(&entry.path());
            }
        }
    }
    if let Ok(entries) = fs::read_dir(dir) {
        if entries.count() == 0 {
            let _ = fs::remove_dir(dir);
        }
    }
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn test_parse_repo_url_https() {
        let result = parse_repo_url("https://github.com/colinhacks/zod").unwrap();
        assert_eq!(
            result,
            ("github.com".into(), "colinhacks".into(), "zod".into())
        );
    }

    #[test]
    fn test_parse_repo_url_ssh() {
        let result = parse_repo_url("git@github.com:colinhacks/zod.git").unwrap();
        assert_eq!(
            result,
            ("github.com".into(), "colinhacks".into(), "zod".into())
        );
    }

    #[test]
    fn test_get_repo_display_name() {
        assert_eq!(
            get_repo_display_name("https://github.com/colinhacks/zod"),
            Some("github.com/colinhacks/zod".into())
        );
    }

    #[test]
    fn test_extract_repo_base_path() {
        assert_eq!(
            extract_repo_base_path("repos/github.com/owner/repo/1.0.0/packages/sub"),
            "repos/github.com/owner/repo".to_string()
        );
        assert_eq!(extract_repo_base_path("other"), "other".to_string());
    }

    #[test]
    fn test_read_sources_corrupt_json_creates_backup() {
        let _env_guard = ENV_LOCK.lock().unwrap();
        let tmp = std::env::temp_dir().join("opensrc_test_corrupt");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let sources_path = tmp.join(SOURCES_FILE);
        let backup_path = tmp.join("sources.json.bak");
        fs::write(&sources_path, "NOT VALID JSON {{{").unwrap();

        std::env::set_var("OPENSRC_HOME", tmp.to_str().unwrap());
        let index = read_sources().unwrap();
        std::env::remove_var("OPENSRC_HOME");

        assert!(index.packages.is_none());
        asser
```

### Core Architecture Module: `packages/opensrc/cli/src/core/error.rs`
```
pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Package \"{name}\" not found on {registry}")]
    PackageNotFound { name: String, registry: String },

    #[error("{0}")]
    VersionNotFound(String),

    #[error("{0}")]
    NoRepoUrl(String),

    #[error("{0}")]
    RepoNotFound(String),

    #[error("{0}")]
    AccessDenied(String),

    #[error("GitHub API rate limit exceeded. Try again later or set GITHUB_TOKEN.")]
    RateLimitExceeded,

    #[error("Invalid repository format: {0}")]
    InvalidRepoSpec(String),

    #[error("{0}")]
    CloneFailed(String),

    #[error("Could not determine home directory. Set the OPENSRC_HOME environment variable.")]
    HomeDirNotFound,

    #[error("Failed to fetch {context}: {status}")]
    HttpStatus { context: String, status: String },

    #[error("{0}")]
    Other(String),

    #[error(transparent)]
    Http(#[from] reqwest::Error),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

```

### Core Architecture Module: `packages/opensrc/cli/src/core/fetcher.rs`
```
use std::path::PathBuf;

use crate::core::cache::{
    get_absolute_path, get_package_info, get_repo_info, list_sources, now_iso, write_sources,
    PackageEntry, RepoEntry,
};
use crate::core::error::{Error, Result};
use crate::core::git::{fetch_repo_source, fetch_source};
use crate::core::registries::repo::{parse_repo_spec, resolve_repo};
use crate::core::registries::{
    detect_input_type, parse_package_spec, resolve_package, PackageSpec, Registry,
};
use crate::core::version::detect_installed_version;

/// The outcome of ensuring a package or repo is cached locally.
pub struct FetchOutcome {
    pub path: PathBuf,
    pub name: String,
    pub version: String,
    pub source_label: String,
    pub from_cache: bool,
    pub warning: Option<String>,
}

fn log(verbose: bool, msg: &str) {
    if verbose {
        eprintln!("{msg}");
    }
}

fn ensure_package_cached(spec: &str, cwd: &str, verbose: bool) -> Result<FetchOutcome> {
    let parsed = parse_package_spec(spec);
    let registry = parsed.registry;
    let name = parsed.name.clone();
    let mut version = parsed.version.clone();

    if let Some(ref v) = version {
        if let Some(existing) = get_package_info(&name, registry)? {
            if existing.version == *v {
                return Ok(FetchOutcome {
                    path: get_absolute_path(&existing.path)?,
                    name: existing.name,
                    version: existing.version,
                    source_label: registry.label().to_string(),
                    from_cache: true,
                    warning: None,
                });
            }
        }
    }

    if version.is_none() && registry == Registry::Npm {
        let detected = detect_installed_version(&name, &PathBuf::from(cwd));
        if let Some(v) = detected {
            version = Some(v.clone());
            if let Some(existing) = get_package_info(&name, registry)? {
                if existing.version == v {
                    return Ok(FetchOutcome {
                        path: get_absolute_path(&existing.path)?,
                        name: existing.name,
                        version: existing.version,
                        source_label: registry.label().to_string(),
                        from_cache: true,
                        warning: None,
                    });
                }
            }
        }
    }

    log(
        verbose,
        &format!("Fetching {name} from {}...", registry.label()),
    );

    let pkg_spec = PackageSpec {
        registry,
        name: name.clone(),
        version,
    };
    let resolved = resolve_package(&pkg_spec)?;
    log(verbose, &format!("  → Cloning at {}...", resolved.git_tag));

    let result = fetch_source(&resolved)?;

    if !result.success {
        return Err(Error::CloneFailed(format!(
            "Failed: {}",
            result.error.as_deref().unwrap_or("unknown")
        )));
    }

    if let Some(ref warn) = result.error {
        log(verbose, &format!("  ⚠ {warn}"));
    }

    let (mut packages, repos) = list_sources()?;
    let entry = PackageEntry {
        name: result.package.clone(),
        version: result.version.clone(),
        registry: result.registry.unwrap_or(Registry::Npm),
        path: result.path.clone(),
        fetched_at: now_iso(),
    };
    if let Some(idx) = packages
        .iter()
        .position(|p| p.name == entry.name && p.registry == entry.registry)
    {
        packages[idx] = entry.clone();
    } else {
        packages.push(entry.clone());
    }
    write_sources(packages, repos)?;

    Ok(FetchOutcome {
        path: get_absolute_path(&result.path)?,
        name: result.package,
        version: result.version,
        source_label: registry.label().to_string(),
        from_cache: false,
        warning: result.error,
    })
}

fn ensure_repo_cached(spec: &str, verbose: bool) -> Result<FetchOutcome> {
    let repo_spec =
        parse_repo_spec(spec).ok_or_else(|| Error::InvalidRepoSpec(spec.to_string()))?;

    let display = format!("{}/{}/{}", repo_spec.host, repo_spec.owner, repo_spec.repo);

    if let Some(ref r) = repo_spec.git_ref {
        if let Some(existing) = get_repo_info(&display)? {
            if existing.version == *r {
                return Ok(FetchOutcome {
                    path: get_absolute_path(&existing.path)?,
                    name: existing.name,
                    version: existing.version,
                    source_label: repo_spec.host.clone(),
                    from_cache: true,
                    warning: None,
                });
            }
        }
    }

    log(
        verbose,
        &format!("Fetching {}/{}...", repo_spec.owner, repo_spec.repo),
    );
    let resolved = resolve_repo(&repo_spec)?;
    log(verbose, &format!("  → Cloning at {}...", resolved.git_ref));

    let result = fetch_repo_source(&resolved)?;

    if !result.success {
        return Err(Error::CloneFailed(format!(
            "Failed: {}",
            result.error.as_deref().unwrap_or("unknown")
        )));
    }

    if let Some(ref warn) = result.error {
        log(verbose, &format!("  ⚠ {warn}"));
    }

    let (packages, mut repos) = list_sources()?;
    let entry = RepoEntry {
        name: result.package.clone(),
        version: result.version.clone(),
        path: result.path.clone(),
        fetched_at: now_iso(),
    };
    if let Some(idx) = repos.iter().position(|r| r.name == entry.name) {
        repos[idx] = entry.clone();
    } else {
        repos.push(entry.clone());
    }
    write_sources(packages, repos)?;

    Ok(FetchOutcome {
        path: get_absolute_path(&result.path)?,
        name: result.package,
        version: result.version,
        source_label: repo_spec.host,
        from_cache: false,
        warning: result.error,
    })
}

/// Ensure the given spec (package or repo) is cached locally, fetching it if
/// necessary. Returns information about where it ended up on disk.
pub fn ensure_cached(spec: &str, cwd: &str, verbose: bool) -> Result<FetchOutcome> {
    if detect_input_type(spec) == "repo" {
        ensure_repo_cached(spec, verbose)
    } else {
        ensure_package_cached(spec, cwd, verbose)
    }
}

```

### Core Architecture Module: `packages/opensrc/cli/src/core/git.rs`
```
use std::fs;
use std::path::Path;
use std::process::Command;

use super::cache::{get_repo_display_name, get_repo_path, get_repo_relative_path};
use super::error::{Error, Result};
use super::registries::repo::ResolvedRepo;
use super::registries::{authenticated_clone_url, Registry, ResolvedPackage};

#[derive(Debug)]
pub struct FetchResult {
    pub package: String,
    pub version: String,
    pub path: String,
    pub success: bool,
    pub error: Option<String>,
    pub registry: Option<Registry>,
}

struct CloneResult {
    success: bool,
    error: Option<String>,
}

fn git_clone_output(args: &[&str]) -> std::io::Result<std::process::Output> {
    Command::new("git")
        .args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .output()
}

fn stderr_string(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stderr).trim().to_string()
}

fn clone_at_tag(repo_url: &str, target: &Path, version: &str) -> CloneResult {
    let tags = [format!("v{version}"), version.to_string()];
    let target_str = target.to_string_lossy();

    for tag in &tags {
        let output = git_clone_output(&[
            "clone",
            "--depth",
            "1",
            "--branch",
            tag,
            "--single-branch",
            repo_url,
            &target_str,
        ]);

        match output {
            Ok(o) if o.status.success() => {
                return CloneResult {
                    success: true,
                    error: None,
                }
            }
            _ => {
                let _ = fs::remove_dir_all(target);
                continue;
            }
        }
    }

    let output = git_clone_output(&["clone", "--depth", "1", repo_url, &target_str]);

    match output {
        Ok(o) if o.status.success() => CloneResult {
            success: true,
            error: Some(format!(
                "Could not find tag for version {version}, cloned default branch instead"
            )),
        },
        Ok(o) => {
            let stderr = stderr_string(&o);
            let msg = if stderr.is_empty() {
                "Failed to clone repository".to_string()
            } else {
                format!("Failed to clone repository: {stderr}")
            };
            CloneResult {
                success: false,
                error: Some(msg),
            }
        }
        Err(e) => CloneResult {
            success: false,
            error: Some(format!("Failed to run git: {e}")),
        },
    }
}

fn clone_at_ref(repo_url: &str, target: &Path, git_ref: &str) -> CloneResult {
    let target_str = target.to_string_lossy();

    let output = git_clone_output(&[
        "clone",
        "--depth",
        "1",
        "--branch",
        git_ref,
        "--single-branch",
        repo_url,
        &target_str,
    ]);

    if let Ok(o) = output {
        if o.status.success() {
            return CloneResult {
                success: true,
                error: None,
            };
        }
    }

    let _ = fs::remove_dir_all(target);

    let output = git_clone_output(&["clone", "--depth", "1", repo_url, &target_str]);

    match output {
        Ok(o) if o.status.success() => CloneResult {
            success: true,
            error: Some(format!(
                "Could not find ref \"{git_ref}\", cloned default branch instead"
            )),
        },
        Ok(o) => {
            let stderr = stderr_string(&o);
            let msg = if stderr.is_empty() {
                "Failed to clone repository".to_string()
            } else {
                format!("Failed to clone repository: {stderr}")
            };
            CloneResult {
                success: false,
                error: Some(msg),
            }
        }
        Err(e) => CloneResult {
            success: false,
            error: Some(format!("Failed to run git: {e}")),
        },
    }
}

fn remove_git_dir(repo_path: &Path) {
    let git_dir = repo_path.join(".git");
    if git_dir.exists() {
        let _ = fs::remove_dir_all(&git_dir);
    }
}

pub fn fetch_source(resolved: &ResolvedPackage) -> Result<FetchResult> {
    let display_name = get_repo_display_name(&resolved.repo_url).ok_or_else(|| {
        Error::Other(format!(
            "Could not parse repository URL: {}",
            resolved.repo_url
        ))
    })?;

    let repo_path = get_repo_path(&display_name, &resolved.version)?;

    if repo_path.exists() {
        let mut rel = get_repo_relative_path(&display_name, &resolved.version);
        if let Some(ref dir) = resolved.repo_directory {
            rel = format!("{rel}/{dir}");
        }
        return Ok(FetchResult {
            package: resolved.name.clone(),
            version: resolved.version.clone(),
            path: rel,
            success: true,
            error: None,
            registry: Some(resolved.registry),
        });
    }

    if let Some(parent) = repo_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let clone_url = authenticated_clone_url(&resolved.repo_url);
    let clone = clone_at_tag(&clone_url, &repo_path, &resolved.version);

    if !clone.success {
        return Ok(FetchResult {
            package: resolved.name.clone(),
            version: resolved.version.clone(),
            path: get_repo_relative_path(&display_name, &resolved.version),
            success: false,
            error: clone.error,
            registry: Some(resolved.registry),
        });
    }

    remove_git_dir(&repo_path);

    let mut rel = get_repo_relative_path(&display_name, &resolved.version);
    if let Some(ref dir) = resolved.repo_directory {
        rel = format!("{rel}/{dir}");
    }

    Ok(FetchResult {
        package: resolved.name.clone(),
        version: resolved.version.clone(),
        path: rel,
        success: true,
        error: clone.error,
        registry: Some(resolved.registry),
    })
}

pub fn fetch_repo_source(resolved: &ResolvedRepo) -> Result<FetchResult> {
    let repo_path = get_repo_path(&resolved.display_name, &resolved.git_ref)?;

    if repo_path.exists() {
        return Ok(FetchResult {
            package: resolved.display_name.clone(),
            version: resolved.git_ref.clone(),
            path: get_repo_relative_path(&resolved.display_name, &resolved.git_ref),
            success: true,
            error: None,
            registry: None,
        });
    }

    if let Some(parent) = repo_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let clone_url = authenticated_clone_url(&resolved.repo_url);
    let clone = clone_at_ref(&clone_url, &repo_path, &resolved.git_ref);

    if !clone.success {
        return Ok(FetchResult {
            package: resolved.display_name.clone(),
            version: resolved.git_ref.clone(),
            path: get_repo_relative_path(&resolved.display_name, &resolved.git_ref),
            success: false,
            error: clone.error,
            registry: None,
        });
    }

    remove_git_dir(&repo_path);

    Ok(FetchResult {
        package: resolved.display_name.clone(),
        version: resolved.git_ref.clone(),
        path: get_repo_relative_path(&resolved.display_name, &resolved.git_ref),
        success: true,
        error: clone.error,
        registry: None,
    })
}

```

### Core Architecture Module: `packages/opensrc/cli/src/core/mod.rs`
```
pub mod cache;
pub mod error;
pub mod fetcher;
pub mod git;
pub mod registries;
pub mod version;

```

### Core Architecture Module: `packages/opensrc/cli/src/core/registries/crates.rs`
```
use serde::Deserialize;

use crate::core::error::{Error, Result};

use super::{Registry, ResolvedPackage};

const CRATES_API: &str = "https://crates.io/api/v1";

#[derive(Deserialize)]
struct CrateInfo {
    max_version: String,
    repository: Option<String>,
    homepage: Option<String>,
}

#[derive(Deserialize)]
struct CrateResponse {
    #[serde(rename = "crate")]
    krate: CrateInfo,
}

// Only used to validate the version exists
#[derive(Deserialize)]
#[allow(dead_code)]
struct CrateVersionResponse {
    version: serde_json::Value,
}

pub fn parse_crates_spec(spec: &str) -> (String, Option<String>) {
    if let Some(at_idx) = spec.rfind('@') {
        if at_idx > 0 {
            return (
                spec[..at_idx].trim().to_string(),
                Some(spec[at_idx + 1..].trim().to_string()),
            );
        }
    }
    (spec.trim().to_string(), None)
}

fn fetch_crate_info(name: &str) -> Result<CrateResponse> {
    let url = format!("{CRATES_API}/crates/{name}");

    let client = super::http_client();
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(Error::PackageNotFound {
            name: name.to_string(),
            registry: "crates.io".to_string(),
        });
    }
    if !resp.status().is_success() {
        return Err(Error::HttpStatus {
            context: "crate info".to_string(),
            status: resp.status().to_string(),
        });
    }

    Ok(resp.json()?)
}

fn verify_crate_version(name: &str, version: &str) -> Result<()> {
    let url = format!("{CRATES_API}/crates/{name}/{version}");

    let client = super::http_client();
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(Error::VersionNotFound(format!(
            "Version \"{version}\" not found for crate \"{name}\""
        )));
    }
    if !resp.status().is_success() {
        return Err(Error::HttpStatus {
            context: "crate version info".to_string(),
            status: resp.status().to_string(),
        });
    }

    let _: CrateVersionResponse = resp.json()?;
    Ok(())
}

use super::{is_git_repo_url, normalize_repo_url};

fn extract_repo_url(krate: &CrateInfo) -> Option<String> {
    if let Some(ref repo) = krate.repository {
        if is_git_repo_url(repo) {
            return Some(normalize_repo_url(repo));
        }
    }
    if let Some(ref hp) = krate.homepage {
        if is_git_repo_url(hp) {
            return Some(normalize_repo_url(hp));
        }
    }
    None
}

pub fn resolve_crate(name: &str, version: Option<&str>) -> Result<ResolvedPackage> {
    let info = fetch_crate_info(name)?;

    let resolved_version = match version {
        Some(v) => {
            verify_crate_version(name, v)?;
            v.to_string()
        }
        None => info.krate.max_version.clone(),
    };

    let repo_url = extract_repo_url(&info.krate).ok_or_else(|| {
        Error::NoRepoUrl(format!(
            "No repository URL found for \"{name}@{resolved_version}\". \
             This crate may not have its source published."
        ))
    })?;

    let git_tag = format!("v{resolved_version}");

    Ok(ResolvedPackage {
        registry: Registry::Crates,
        name: name.to_string(),
        version: resolved_version,
        repo_url,
        repo_directory: None,
        git_tag,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_crates_spec_simple() {
        let (name, version) = parse_crates_spec("serde");
        assert_eq!(name, "serde");
        assert_eq!(version, None);
    }

    #[test]
    fn test_parse_crates_spec_with_version() {
        let (name, version) = parse_crates_spec("serde@1.0.200");
        assert_eq!(name, "serde");
        assert_eq!(version, Some("1.0.200".into()));
    }
}

```

### Core Architecture Module: `packages/opensrc/cli/src/core/registries/mod.rs`
```
pub mod crates;
pub mod npm;
pub mod pypi;
pub mod repo;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Registry {
    Npm,
    #[serde(rename = "pypi")]
    PyPI,
    Crates,
}

impl std::fmt::Display for Registry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Registry::Npm => write!(f, "npm"),
            Registry::PyPI => write!(f, "pypi"),
            Registry::Crates => write!(f, "crates"),
        }
    }
}

impl Registry {
    pub fn label(&self) -> &'static str {
        match self {
            Registry::Npm => "npm",
            Registry::PyPI => "PyPI",
            Registry::Crates => "crates.io",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResolvedPackage {
    pub registry: Registry,
    pub name: String,
    pub version: String,
    pub repo_url: String,
    pub repo_directory: Option<String>,
    pub git_tag: String,
}

#[derive(Debug, Clone)]
pub struct PackageSpec {
    pub registry: Registry,
    pub name: String,
    pub version: Option<String>,
}

pub struct DetectedRegistry {
    pub registry: Registry,
    pub clean_spec: String,
}

const REGISTRY_PREFIXES: &[(&str, Registry)] = &[
    ("npm:", Registry::Npm),
    ("pypi:", Registry::PyPI),
    ("pip:", Registry::PyPI),
    ("python:", Registry::PyPI),
    ("crates:", Registry::Crates),
    ("cargo:", Registry::Crates),
    ("rust:", Registry::Crates),
];

pub fn detect_registry(spec: &str) -> DetectedRegistry {
    let trimmed = spec.trim();
    let lower = trimmed.to_lowercase();

    for &(prefix, registry) in REGISTRY_PREFIXES {
        if lower.starts_with(prefix) {
            return DetectedRegistry {
                registry,
                clean_spec: trimmed[prefix.len()..].to_string(),
            };
        }
    }

    DetectedRegistry {
        registry: Registry::Npm,
        clean_spec: trimmed.to_string(),
    }
}

pub fn parse_package_spec(spec: &str) -> PackageSpec {
    let detected = detect_registry(spec);

    let (name, version) = match detected.registry {
        Registry::Npm => npm::parse_npm_spec(&detected.clean_spec),
        Registry::PyPI => pypi::parse_pypi_spec(&detected.clean_spec),
        Registry::Crates => crates::parse_crates_spec(&detected.clean_spec),
    };

    PackageSpec {
        registry: detected.registry,
        name,
        version,
    }
}

pub fn resolve_package(spec: &PackageSpec) -> super::error::Result<ResolvedPackage> {
    match spec.registry {
        Registry::Npm => npm::resolve_npm_package(&spec.name, spec.version.as_deref()),
        Registry::PyPI => pypi::resolve_pypi_package(&spec.name, spec.version.as_deref()),
        Registry::Crates => crates::resolve_crate(&spec.name, spec.version.as_deref()),
    }
}

const GITHUB_HOST: &str = "github.com";
const GITLAB_HOST: &str = "gitlab.com";
const BITBUCKET_HOST: &str = "bitbucket.org";

pub(crate) fn is_git_repo_url(url: &str) -> bool {
    [GITHUB_HOST, GITLAB_HOST, BITBUCKET_HOST]
        .iter()
        .any(|supported| repo_host_matches(url, supported))
}

fn repo_host_matches(url: &str, expected_host: &str) -> bool {
    if let Ok(parsed) = url::Url::parse(url) {
        return parsed
            .host_str()
            .is_some_and(|host| host.eq_ignore_ascii_case(expected_host));
    }

    let Some(rest) = url.strip_prefix("git@") else {
        return false;
    };
    let Some((host, _)) = rest.split_once(':') else {
        return false;
    };

    host.eq_ignore_ascii_case(expected_host)
}

pub(crate) fn normalize_repo_url(url: &str) -> String {
    url.trim_end_matches('/')
        .trim_end_matches(".git")
        .split("/tree/")
        .next()
        .unwrap_or(url)
        .split("/blob/")
        .next()
        .unwrap_or(url)
        .to_string()
}

pub(crate) fn http_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(10))
        .user_agent("opensrc-cli (https://github.com/vercel-labs/opensrc)")
        .build()
        .expect("failed to build HTTP client")
}

pub(crate) fn github_token() -> Option<String> {
    std::env::var("GITHUB_TOKEN").ok().filter(|t| !t.is_empty())
}

pub(crate) fn gitlab_token() -> Option<String> {
    std::env::var("GITLAB_TOKEN").ok().filter(|t| !t.is_empty())
}

pub(crate) fn bitbucket_token() -> Option<String> {
    std::env::var("BITBUCKET_TOKEN")
        .ok()
        .filter(|t| !t.is_empty())
}

/// Rewrites an HTTPS clone URL to embed auth credentials when a token is available.
pub fn authenticated_clone_url(url: &str) -> String {
    let github = github_token();
    let gitlab = gitlab_token();
    let bitbucket = bitbucket_token();

    authenticated_clone_url_with_tokens(
        url,
        github.as_deref(),
        gitlab.as_deref(),
        bitbucket.as_deref(),
    )
}

fn authenticated_clone_url_with_tokens(
    url: &str,
    github: Option<&str>,
    gitlab: Option<&str>,
    bitbucket: Option<&str>,
) -> String {
    if let Some(token) = github {
        if let Some(authenticated) =
            authenticated_url_for_host(url, GITHUB_HOST, "x-access-token", token)
        {
            return authenticated;
        }
    }
    if let Some(token) = gitlab {
        if let Some(authenticated) = authenticated_url_for_host(url, GITLAB_HOST, "oauth2", token) {
            return authenticated;
        }
    }
    if let Some(token) = bitbucket {
        if let Some(authenticated) =
            authenticated_url_for_host(url, BITBUCKET_HOST, "x-token-auth", token)
        {
            return authenticated;
        }
    }
    url.to_string()
}

fn authenticated_url_for_host(
    url: &str,
    expected_host: &str,
    username: &str,
    token: &str,
) -> Option<String> {
    let mut parsed = url::Url::parse(url).ok()?;
    if parsed.scheme() != "https" {
        return None;
    }
    let host = parsed.host_str()?;
    if !host.eq_ignore_ascii_case(expected_host) {
        return None;
    }

    parsed.set_username(username).ok()?;
    parsed.set_password(Some(token)).ok()?;
    Some(parsed.to_string())
}

pub fn detect_input_type(spec: &str) -> &'static str {
    let trimmed = spec.trim();
    let lower = trimmed.to_lowercase();

    for &(prefix, _) in REGISTRY_PREFIXES {
        if lower.starts_with(prefix) {
            return "package";
        }
    }

    if repo::is_repo_spec(trimmed) {
        return "repo";
    }

    "package"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_git_repo_url_github() {
        assert!(is_git_repo_url("https://github.com/owner/repo"));
    }

    #[test]
    fn test_is_git_repo_url_gitlab() {
        assert!(is_git_repo_url("https://gitlab.com/owner/repo"));
    }

    #[test]
    fn test_is_git_repo_url_bitbucket() {
        assert!(is_git_repo_url("https://bitbucket.org/owner/repo"));
    }

    #[test]
    fn test_is_git_repo_url_ssh() {
        assert!(is_git_repo_url("git@github.com:owner/repo.git"));
    }

    #[test]
    fn test_is_git_repo_url_other() {
        assert!(!is_git_repo_url("https://example.com/owner/repo"));
    }

    #[test]
    fn test_is_git_repo_url_rejects_host_prefix_confusion() {
        assert!(!is_git_repo_url(
            "https://github.com.attacker.example/owner/repo"
        ));
        assert!(!is_git_repo_url(
            "https://gitlab.com.attacker.example/owner/repo"
        ));
        assert!(!is_git_repo_url(
            "https://bitbucket.org.attacker.example/owner/repo"
        ));
        assert!(!is_git_repo_url(
            "git@github.com.attacker.example:owner/repo.git"
        ));
    }

    #[test]
    fn test_is_git_repo_url_rejects_host_in_path() {
        assert!(!is_git_repo_url(
            "https://example.com/github.com/owner/repo"
        ));
    }

    #[test]
    fn test_authenticated_clone_url_github_exact_host() {
        assert_eq!(
            authenticated_clone_url_with_tokens(
                "https://github.com/owner/repo",
                Some("TOKEN"),
                None,
                None
            ),
            "https://x-access-token:TOKEN@github.com/owner/repo"
        );
    }

    #[test]
    fn test_authenticated_clone_url_gitlab_exact_host() {
        assert_eq!(
            authenticated_clone_url_with_tokens(
                "https://gitlab.com/owner/repo",
                None,
                Some("TOKEN"),
                None
            ),
            "https://oauth2:TOKEN@gitlab.com/owner/repo"
        );
    }

    #[test]
    fn test_authenticated_clone_url_bitbucket_exact_host() {
        assert_eq!(
            authenticated_clone_url_with_tokens(
                "https://bitbucket.org/owner/repo",
                None,
                None,
                Some("TOKEN")
            ),
            "https://x-token-auth:TOKEN@bitbucket.org/owner/repo"
        );
    }

    #[test]
    fn test_authenticated_clone_url_rejects_host_prefix_confusion() {
        assert_eq!(
            authenticated_clone_url_with_tokens(
                "https://github.com.attacker.example/owner/repo",
                Some("TOKEN"),
                None,
                None
            ),
            "https://github.com.attacker.example/owner/repo"
        );
        assert_eq!(
            authenticated_clone_url_with_tokens(
                "https://gitlab.com.attacker.example/owner/repo",
                None,
                Some("TOKEN"),
                None
            ),
            "https://gitlab.com.attacker.example/owner/repo"
        );
        assert_eq!(
            authenticated_clone_url_with_tokens(
                "https://bitbucket.org.attacker.example/owner/repo",
                None,
                None,
                Some("TOKEN")
            ),
            "https://bitbucket.org.a
```

### Core Architecture Module: `packages/opensrc/cli/src/core/registries/npm.rs`
```
use std::collections::HashMap;
use std::sync::LazyLock;

use serde::Deserialize;

use crate::core::error::{Error, Result};

use super::{Registry, ResolvedPackage};

static RE_SCOPED_PKG: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"^(@[^/]+/[^@]+)(?:@(.+))?$").unwrap());

const NPM_REGISTRY: &str = "https://registry.npmjs.org";

#[derive(Deserialize)]
struct NpmRepository {
    url: Option<String>,
    directory: Option<String>,
}

#[derive(Deserialize)]
struct NpmVersionInfo {
    repository: Option<NpmRepository>,
}

#[derive(Deserialize)]
struct NpmResponse {
    #[serde(rename = "dist-tags")]
    dist_tags: HashMap<String, String>,
    versions: HashMap<String, NpmVersionInfo>,
    repository: Option<NpmRepository>,
}

pub fn parse_npm_spec(spec: &str) -> (String, Option<String>) {
    if spec.starts_with('@') {
        if let Some(caps) = RE_SCOPED_PKG.captures(spec) {
            let name = caps[1].to_string();
            let version = caps.get(2).map(|m| m.as_str().to_string());
            return (name, version);
        }
    }

    // Regular packages: zod@3.22.0
    if let Some(at_idx) = spec.rfind('@') {
        if at_idx > 0 {
            return (
                spec[..at_idx].to_string(),
                Some(spec[at_idx + 1..].to_string()),
            );
        }
    }

    (spec.to_string(), None)
}

fn npm_registry_url(name: &str) -> String {
    let encoded = urlencoding::encode(name);
    format!("{NPM_REGISTRY}/{encoded}")
}

fn fetch_npm_info(name: &str) -> Result<NpmResponse> {
    let url = npm_registry_url(name);

    let client = super::http_client();
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(Error::PackageNotFound {
            name: name.to_string(),
            registry: "npm".to_string(),
        });
    }
    if !resp.status().is_success() {
        return Err(Error::HttpStatus {
            context: "package info".to_string(),
            status: resp.status().to_string(),
        });
    }

    Ok(resp.json()?)
}

fn extract_repo_url(
    top_repo: Option<&NpmRepository>,
    version_repo: Option<&NpmRepository>,
) -> Option<(String, Option<String>)> {
    let repo = version_repo.or(top_repo)?;
    let raw = repo.url.as_deref()?;

    let url = raw
        .trim_start_matches("git+")
        .replace("git://", "https://")
        .replace("git+ssh://git@", "https://")
        .replace("ssh://git@", "https://")
        .trim_end_matches(".git")
        .to_string();

    let url = if let Some(suffix) = url.strip_prefix("github:") {
        format!("https://github.com/{suffix}")
    } else {
        url
    };

    Some((url, repo.directory.clone()))
}

pub fn resolve_npm_package(name: &str, version: Option<&str>) -> Result<ResolvedPackage> {
    let info = fetch_npm_info(name)?;

    let resolved_version = match version {
        Some(v) => v.to_string(),
        None => info
            .dist_tags
            .get("latest")
            .ok_or_else(|| {
                Error::VersionNotFound(format!("No latest version found for \"{name}\""))
            })?
            .clone(),
    };

    if !info.versions.contains_key(&resolved_version) {
        let mut sorted_versions: Vec<&String> = info.versions.keys().collect();
        sorted_versions.sort();
        let tail: Vec<&str> = sorted_versions
            .iter()
            .rev()
            .take(5)
            .map(|v| v.as_str())
            .collect();
        let versions_str = tail.into_iter().rev().collect::<Vec<_>>().join(", ");
        return Err(Error::VersionNotFound(format!(
            "Version \"{resolved_version}\" not found for \"{name}\". Recent versions: {versions_str}"
        )));
    }

    let version_info = info.versions.get(&resolved_version);
    let (repo_url, repo_directory) = extract_repo_url(
        info.repository.as_ref(),
        version_info.and_then(|v| v.repository.as_ref()),
    )
    .ok_or_else(|| {
        Error::NoRepoUrl(format!(
            "No repository URL found for \"{name}@{resolved_version}\". \
             This package may not have its source published."
        ))
    })?;

    let git_tag = format!("v{resolved_version}");

    Ok(ResolvedPackage {
        registry: Registry::Npm,
        name: name.to_string(),
        version: resolved_version,
        repo_url,
        repo_directory,
        git_tag,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_npm_spec_simple() {
        let (name, version) = parse_npm_spec("zod");
        assert_eq!(name, "zod");
        assert_eq!(version, None);
    }

    #[test]
    fn test_parse_npm_spec_with_version() {
        let (name, version) = parse_npm_spec("zod@3.22.0");
        assert_eq!(name, "zod");
        assert_eq!(version, Some("3.22.0".into()));
    }

    #[test]
    fn test_parse_npm_spec_scoped() {
        let (name, version) = parse_npm_spec("@babel/core@7.0.0");
        assert_eq!(name, "@babel/core");
        assert_eq!(version, Some("7.0.0".into()));
    }

    #[test]
    fn test_parse_npm_spec_scoped_no_version() {
        let (name, version) = parse_npm_spec("@babel/core");
        assert_eq!(name, "@babel/core");
        assert_eq!(version, None);
    }

    #[test]
    fn test_npm_registry_url_unscoped() {
        let url = npm_registry_url("zod");
        assert_eq!(url, "https://registry.npmjs.org/zod");
    }

    #[test]
    fn test_npm_registry_url_scoped() {
        let url = npm_registry_url("@babel/core");
        assert_eq!(url, "https://registry.npmjs.org/%40babel%2Fcore");
    }
}

```

### Core Architecture Module: `packages/opensrc/cli/src/core/registries/pypi.rs`
```
use std::collections::HashMap;
use std::sync::LazyLock;

use serde::Deserialize;

use crate::core::error::{Error, Result};

use super::{Registry, ResolvedPackage};

static RE_PYPI_VERSION: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"^([^=<>!~]+)==(.+)$").unwrap());

const PYPI_API: &str = "https://pypi.org/pypi";

#[derive(Deserialize)]
struct PyPIInfo {
    version: String,
    home_page: Option<String>,
    project_urls: Option<HashMap<String, String>>,
}

#[derive(Deserialize)]
struct PyPIResponse {
    info: PyPIInfo,
}

pub fn parse_pypi_spec(spec: &str) -> (String, Option<String>) {
    if let Some(caps) = RE_PYPI_VERSION.captures(spec) {
        return (caps[1].trim().to_string(), Some(caps[2].trim().to_string()));
    }

    // requests@2.31.0
    if let Some(at_idx) = spec.rfind('@') {
        if at_idx > 0 {
            return (
                spec[..at_idx].trim().to_string(),
                Some(spec[at_idx + 1..].trim().to_string()),
            );
        }
    }

    (spec.trim().to_string(), None)
}

fn fetch_pypi_info(name: &str, version: Option<&str>) -> Result<PyPIResponse> {
    let url = match version {
        Some(v) => format!("{PYPI_API}/{name}/{v}/json"),
        None => format!("{PYPI_API}/{name}/json"),
    };

    let client = super::http_client();
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(Error::PackageNotFound {
            name: name.to_string(),
            registry: "PyPI".to_string(),
        });
    }
    if !resp.status().is_success() {
        return Err(Error::HttpStatus {
            context: "package info".to_string(),
            status: resp.status().to_string(),
        });
    }

    Ok(resp.json()?)
}

use super::{is_git_repo_url, normalize_repo_url};

fn extract_repo_url(info: &PyPIInfo) -> Option<String> {
    let repo_keys = [
        "Source",
        "Source Code",
        "Repository",
        "GitHub",
        "Code",
        "Homepage",
    ];

    if let Some(urls) = &info.project_urls {
        for key in &repo_keys {
            if let Some(url) = urls.get(*key) {
                if is_git_repo_url(url) {
                    return Some(normalize_repo_url(url));
                }
            }
        }

        if let Some(hp) = &info.home_page {
            if is_git_repo_url(hp) {
                return Some(normalize_repo_url(hp));
            }
        }

        for url in urls.values() {
            if is_git_repo_url(url) {
                return Some(normalize_repo_url(url));
            }
        }
    }

    if let Some(hp) = &info.home_page {
        if is_git_repo_url(hp) {
            return Some(normalize_repo_url(hp));
        }
    }

    None
}

pub fn resolve_pypi_package(name: &str, version: Option<&str>) -> Result<ResolvedPackage> {
    let info = fetch_pypi_info(name, version)?;
    let resolved_version = info.info.version.clone();

    let repo_url = extract_repo_url(&info.info).ok_or_else(|| {
        Error::NoRepoUrl(format!(
            "No repository URL found for \"{name}@{resolved_version}\". \
             This package may not have its source published."
        ))
    })?;

    let git_tag = format!("v{resolved_version}");

    Ok(ResolvedPackage {
        registry: Registry::PyPI,
        name: name.to_string(),
        version: resolved_version,
        repo_url,
        repo_directory: None,
        git_tag,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_pypi_spec_simple() {
        let (name, version) = parse_pypi_spec("requests");
        assert_eq!(name, "requests");
        assert_eq!(version, None);
    }

    #[test]
    fn test_parse_pypi_spec_double_eq() {
        let (name, version) = parse_pypi_spec("requests==2.31.0");
        assert_eq!(name, "requests");
        assert_eq!(version, Some("2.31.0".into()));
    }

    #[test]
    fn test_parse_pypi_spec_at() {
        let (name, version) = parse_pypi_spec("requests@2.31.0");
        assert_eq!(name, "requests");
        assert_eq!(version, Some("2.31.0".into()));
    }
}

```

### Core Architecture Module: `packages/opensrc/cli/src/core/registries/repo.rs`
```
use std::sync::LazyLock;

use serde::Deserialize;

use crate::core::error::{Error, Result};

static RE_URL: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"^https?://(github\.com|gitlab\.com|bitbucket\.org)/").unwrap()
});
static RE_OWNER: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"^[a-zA-Z0-9][a-zA-Z0-9-]*$").unwrap());
static RE_REPO: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"^[a-zA-Z0-9._-]+$").unwrap());

const SUPPORTED_HOSTS: &[&str] = &["github.com", "gitlab.com", "bitbucket.org"];
const DEFAULT_HOST: &str = "github.com";

#[derive(Debug, Clone)]
pub struct RepoSpec {
    pub host: String,
    pub owner: String,
    pub repo: String,
    pub git_ref: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ResolvedRepo {
    pub git_ref: String,
    pub repo_url: String,
    pub display_name: String,
}

pub fn parse_repo_spec(spec: &str) -> Option<RepoSpec> {
    let input = spec.trim();
    let mut remaining = input.to_string();
    let mut git_ref: Option<String> = None;
    let mut host = DEFAULT_HOST.to_string();

    // Handle shorthand prefixes
    if remaining.starts_with("github:") {
        host = "github.com".to_string();
        remaining = remaining[7..].to_string();
    } else if remaining.starts_with("gitlab:") {
        host = "gitlab.com".to_string();
        remaining = remaining[7..].to_string();
    } else if remaining.starts_with("bitbucket:") {
        host = "bitbucket.org".to_string();
        remaining = remaining[10..].to_string();
    } else if remaining.starts_with("http://") || remaining.starts_with("https://") {
        // Full URL
        let url = match url::Url::parse(&remaining) {
            Ok(u) => u,
            Err(_) => return None,
        };
        host = url.host_str()?.to_string();
        let path_parts: Vec<&str> = url
            .path()
            .trim_start_matches('/')
            .split('/')
            .filter(|s| !s.is_empty())
            .collect();

        if path_parts.len() < 2 {
            return None;
        }

        let owner = path_parts[0].to_string();
        let mut repo = path_parts[1].to_string();
        if repo.ends_with(".git") {
            repo = repo[..repo.len() - 4].to_string();
        }

        if path_parts.len() >= 4 && (path_parts[2] == "tree" || path_parts[2] == "blob") {
            git_ref = Some(path_parts[3].to_string());
        }

        return Some(RepoSpec {
            host,
            owner,
            repo,
            git_ref,
        });
    } else if SUPPORTED_HOSTS
        .iter()
        .any(|h| remaining.starts_with(&format!("{h}/")))
    {
        if let Some(idx) = remaining.find('/') {
            host = remaining[..idx].to_string();
            remaining = remaining[idx + 1..].to_string();
        }
    } else if remaining.starts_with('@') || remaining.split('/').count() != 2 {
        return None;
    }

    // Extract ref from @ or #
    if let Some(at_idx) = remaining.find('@') {
        if at_idx > 0 {
            git_ref = Some(remaining[at_idx + 1..].to_string());
            remaining = remaining[..at_idx].to_string();
        }
    } else if let Some(hash_idx) = remaining.find('#') {
        if hash_idx > 0 {
            git_ref = Some(remaining[hash_idx + 1..].to_string());
            remaining = remaining[..hash_idx].to_string();
        }
    }

    let parts: Vec<&str> = remaining.split('/').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return None;
    }

    Some(RepoSpec {
        host,
        owner: parts[0].to_string(),
        repo: parts[1].to_string(),
        git_ref,
    })
}

pub fn is_repo_spec(spec: &str) -> bool {
    let trimmed = spec.trim();

    if trimmed.starts_with("github:")
        || trimmed.starts_with("gitlab:")
        || trimmed.starts_with("bitbucket:")
    {
        return true;
    }

    if RE_URL.is_match(trimmed) {
        return true;
    }

    if SUPPORTED_HOSTS
        .iter()
        .any(|h| trimmed.starts_with(&format!("{h}/")))
    {
        return true;
    }

    if trimmed.starts_with('@') {
        return false;
    }

    let parts: Vec<&str> = trimmed.split('/').collect();
    if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() {
        let repo_part = parts[1]
            .split('@')
            .next()
            .unwrap_or("")
            .split('#')
            .next()
            .unwrap_or("");
        return RE_OWNER.is_match(parts[0]) && RE_REPO.is_match(repo_part);
    }

    false
}

#[derive(Deserialize)]
struct GitHubApiResponse {
    default_branch: String,
}

#[derive(Deserialize)]
struct GitLabApiResponse {
    default_branch: Option<String>,
}

#[derive(Deserialize)]
struct BitbucketMainBranch {
    name: Option<String>,
}

#[derive(Deserialize)]
struct BitbucketApiResponse {
    mainbranch: Option<BitbucketMainBranch>,
}

pub fn resolve_repo(spec: &RepoSpec) -> Result<ResolvedRepo> {
    match spec.host.as_str() {
        "github.com" => resolve_github(spec),
        "gitlab.com" => resolve_gitlab(spec),
        "bitbucket.org" => resolve_bitbucket(spec),
        _ => Ok(ResolvedRepo {
            git_ref: spec.git_ref.clone().unwrap_or_else(|| "main".to_string()),
            repo_url: format!("https://{}/{}/{}", spec.host, spec.owner, spec.repo),
            display_name: format!("{}/{}/{}", spec.host, spec.owner, spec.repo),
        }),
    }
}

fn resolve_github(spec: &RepoSpec) -> Result<ResolvedRepo> {
    let url = format!("https://api.github.com/repos/{}/{}", spec.owner, spec.repo);

    let client = super::http_client();
    let mut req = client
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json");

    if let Some(token) = super::github_token() {
        req = req.header("Authorization", format!("Bearer {token}"));
    }

    let resp = req.send()?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        let hint = if super::github_token().is_none() {
            " If this is a private repo, set GITHUB_TOKEN."
        } else {
            " Your token may lack access to this repository."
        };
        return Err(Error::RepoNotFound(format!(
            "Repository \"{}/{}\" not found on GitHub.{hint}",
            spec.owner, spec.repo
        )));
    }
    if resp.status() == reqwest::StatusCode::FORBIDDEN {
        return Err(Error::RateLimitExceeded);
    }
    if !resp.status().is_success() {
        return Err(Error::HttpStatus {
            context: "repository info".to_string(),
            status: resp.status().to_string(),
        });
    }

    let data: GitHubApiResponse = resp.json()?;
    let resolved_ref = spec.git_ref.clone().unwrap_or(data.default_branch);

    Ok(ResolvedRepo {
        git_ref: resolved_ref,
        repo_url: format!("https://github.com/{}/{}", spec.owner, spec.repo),
        display_name: format!("{}/{}/{}", spec.host, spec.owner, spec.repo),
    })
}

fn resolve_gitlab(spec: &RepoSpec) -> Result<ResolvedRepo> {
    let project_path = format!("{}/{}", spec.owner, spec.repo);
    let encoded = urlencoding::encode(&project_path);
    let url = format!("https://gitlab.com/api/v4/projects/{encoded}");

    let client = super::http_client();
    let mut req = client.get(&url);

    if let Some(token) = super::gitlab_token() {
        req = req.header("PRIVATE-TOKEN", &token);
    }

    let resp = req.send()?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        let hint = if super::gitlab_token().is_none() {
            " If this is a private repo, set GITLAB_TOKEN."
        } else {
            " Your token may lack access to this repository."
        };
        return Err(Error::RepoNotFound(format!(
            "Repository \"{}/{}\" not found on GitLab.{hint}",
            spec.owner, spec.repo
        )));
    }
    if !resp.status().is_success() {
        return Err(Error::HttpStatus {
            context: "repository info".to_string(),
            status: resp.status().to_string(),
        });
    }

    let data: GitLabApiResponse = resp.json()?;
    let resolved_ref = spec
        .git_ref
        .clone()
        .unwrap_or_else(|| data.default_branch.unwrap_or_else(|| "main".to_string()));

    Ok(ResolvedRepo {
        git_ref: resolved_ref,
        repo_url: format!("https://gitlab.com/{}/{}", spec.owner, spec.repo),
        display_name: format!("{}/{}/{}", spec.host, spec.owner, spec.repo),
    })
}

fn resolve_bitbucket(spec: &RepoSpec) -> Result<ResolvedRepo> {
    let url = format!(
        "https://api.bitbucket.org/2.0/repositories/{}/{}",
        spec.owner, spec.repo
    );

    let client = super::http_client();
    let mut req = client.get(&url);

    if let Some(token) = super::bitbucket_token() {
        req = req.header("Authorization", format!("Bearer {token}"));
    }

    let resp = req.send()?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        let hint = if super::bitbucket_token().is_none() {
            " If this is a private repo, set BITBUCKET_TOKEN."
        } else {
            " Your token may lack access to this repository."
        };
        return Err(Error::RepoNotFound(format!(
            "Repository \"{}/{}\" not found on Bitbucket.{hint}",
            spec.owner, spec.repo
        )));
    }
    if resp.status() == reqwest::StatusCode::UNAUTHORIZED
        || resp.status() == reqwest::StatusCode::FORBIDDEN
    {
        let hint = if super::bitbucket_token().is_none() {
            " If this is a private repo, set BITBUCKET_TOKEN."
        } else {
            " Your token may lack access to this repository."
        };
        return Err(Error::AccessDenied(format!(
            "Access denied to Bitbucket repository \"{}/{}\".{hint}",
            spec.owner, spec.repo
        )));
    }
    if !resp.status().is_success() {
        return Err(Error::HttpStatus {
            context: "repository info".to_string(),
            status: 
```

### Core Architecture Module: `packages/opensrc/cli/src/core/version.rs`
```
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::path::Path;

fn strip_version_prefix(version: &str) -> String {
    version
        .trim_start_matches(|c: char| "^~>=<".contains(c))
        .to_string()
}

fn version_from_node_modules(package_name: &str, cwd: &Path) -> Option<String> {
    let path = cwd
        .join("node_modules")
        .join(package_name)
        .join("package.json");
    let content = fs::read_to_string(path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&content).ok()?;
    parsed.get("version")?.as_str().map(|s| s.to_string())
}

fn version_from_package_lock(package_name: &str, cwd: &Path) -> Option<String> {
    let path = cwd.join("package-lock.json");
    let content = fs::read_to_string(path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&content).ok()?;

    // npm v7+ format
    if let Some(packages) = parsed.get("packages") {
        let key = format!("node_modules/{package_name}");
        if let Some(pkg) = packages.get(&key) {
            if let Some(v) = pkg.get("version").and_then(|v| v.as_str()) {
                return Some(v.to_string());
            }
        }
    }

    // npm v6 format
    if let Some(deps) = parsed.get("dependencies") {
        if let Some(dep) = deps.get(package_name) {
            if let Some(v) = dep.get("version").and_then(|v| v.as_str()) {
                return Some(v.to_string());
            }
        }
    }

    None
}

fn version_from_pnpm_lock(package_name: &str, cwd: &Path) -> Option<String> {
    let path = cwd.join("pnpm-lock.yaml");
    let content = fs::read_to_string(path).ok()?;
    parse_pnpm_lock(&content, package_name)
}

fn version_from_yarn_lock(package_name: &str, cwd: &Path) -> Option<String> {
    let path = cwd.join("yarn.lock");
    let content = fs::read_to_string(path).ok()?;
    parse_yarn_lock(&content, package_name)
}

/// Best-guess fallback: strips range prefixes (^, ~, >=) from package.json
/// dependency specs. The result may not match an actual published version
/// (e.g. ^1.0.0 → 1.0.0 when 1.5.3 is installed), but higher-priority
/// sources (node_modules, lockfiles) are checked first.
fn version_from_package_json(package_name: &str, cwd: &Path) -> Option<String> {
    let path = cwd.join("package.json");
    let content = fs::read_to_string(path).ok()?;
    parse_package_json_version(&content, package_name)
}

/// Extract `package_name`'s version from a parsed package.json.
///
/// Skips entries that aren't real registry versions (e.g. `workspace:*`,
/// `link:../pkg`, `file:./tarball.tgz`, `git+https://...`) so the caller
/// isn't handed a string that can't be resolved against npm.
fn parse_package_json_version(content: &str, package_name: &str) -> Option<String> {
    let parsed: serde_json::Value = serde_json::from_str(content).ok()?;

    for field in &["dependencies", "devDependencies", "peerDependencies"] {
        if let Some(deps) = parsed.get(field) {
            if let Some(v) = deps.get(package_name).and_then(|v| v.as_str()) {
                let stripped = strip_version_prefix(v);
                if is_registry_version(&stripped) {
                    return Some(stripped);
                }
            }
        }
    }

    None
}

/// Detect the installed version of an npm package from lockfiles and node_modules.
/// Priority: node_modules > package-lock.json > pnpm-lock.yaml > yarn.lock > package.json
pub fn detect_installed_version(package_name: &str, cwd: &Path) -> Option<String> {
    version_from_node_modules(package_name, cwd)
        .or_else(|| version_from_package_lock(package_name, cwd))
        .or_else(|| version_from_pnpm_lock(package_name, cwd))
        .or_else(|| version_from_yarn_lock(package_name, cwd))
        .or_else(|| version_from_package_json(package_name, cwd))
}

// ---------------------------------------------------------------------------
// Shared lockfile helpers
// ---------------------------------------------------------------------------

/// Strip a pnpm peer-dependency suffix like `(react@18.0.0)` from a version
/// string, so `18.2.0(react@17.0.0)` becomes `18.2.0`. Cuts at the first `(`
/// so nested peer suffixes like `18.2.0(a@1)(b@2(c@3))` also collapse
/// cleanly.
fn strip_peer_suffix(v: &str) -> &str {
    match v.find('(') {
        Some(i) => v[..i].trim_end(),
        None => v.trim_end(),
    }
}

/// Strip a YAML-style inline comment. Only strips when `#` is preceded by
/// whitespace, so URL fragments like `github:foo/bar#branch` pass through
/// intact.
fn strip_inline_comment(s: &str) -> &str {
    match s.find(" #") {
        Some(i) => s[..i].trim_end(),
        None => s,
    }
}

/// Strip any mix of surrounding single/double quotes from a trimmed string.
fn trim_quotes(s: &str) -> &str {
    s.trim_matches(|c: char| c == '"' || c == '\'')
}

/// Normalise a raw YAML value: trim whitespace, strip an inline comment, and
/// strip surrounding quotes. Does NOT strip peer-dep suffixes — callers do
/// that when appropriate.
fn clean_value(s: &str) -> &str {
    let s = s.trim();
    let s = strip_inline_comment(s);
    trim_quotes(s)
}

/// Split a `<pkg>@<rest>` spec into `(name, rest)`, treating scoped names
/// (`@scope/pkg`) correctly. Returns `None` if there's no `@` separator.
fn split_pkg_spec(spec: &str) -> Option<(&str, &str)> {
    let at_pos = if let Some(rest) = spec.strip_prefix('@') {
        rest.find('@').map(|i| i + 1)?
    } else {
        spec.find('@')?
    };
    Some((&spec[..at_pos], &spec[at_pos + 1..]))
}

/// Return `true` if `v` looks like a version we can resolve against a public
/// registry. Lockfiles (and package.json) can legitimately contain
/// workspace/link/file/git/URL protocol strings — for example a pnpm importer
/// may pin a sibling workspace package with `version: link:../pkg`, and a
/// yarn Berry workspace root has `version: 0.0.0-use.local`. Returning any
/// of those from `detect_installed_version` would make the caller try to
/// fetch `<pkg>@link:../pkg` from npm, which fails with a confusing error.
///
/// Real npm versions never contain `:`, so treating a colon as disqualifying
/// catches every known protocol prefix (`link:`, `file:`, `workspace:`,
/// `portal:`, `git:`, `git+ssh://`, `github:`, `http:`, `https:`, `npm:`,
/// etc.) without having to enumerate them.
fn is_registry_version(v: &str) -> bool {
    !v.is_empty() && v != "0.0.0-use.local" && !v.contains(':')
}

// ---------------------------------------------------------------------------
// pnpm
// ---------------------------------------------------------------------------

/// Dependency-graph node built up during pnpm parsing. Keys in the containing
/// map are the full snapshot id (`<name>@<version>[<peer-suffix>]`).
#[derive(Debug)]
struct PnpmNode {
    name: String,
    /// Version with peer suffix stripped — what we'd return to the caller.
    version: String,
    /// Snapshot ids of this node's direct dependencies.
    deps: Vec<String>,
}

#[derive(Debug, Default)]
struct PnpmGraph {
    nodes: HashMap<String, PnpmNode>,
    /// Snapshot ids that are direct deps of any importer (or top-level
    /// `dependencies:` in v5/v6 non-workspace lockfiles).
    roots: Vec<String>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Origin {
    /// Top-level `dependencies:` / `devDependencies:` etc. (v5/v6).
    Root,
    /// Inside an `importers.<name>.<group>:` block.
    Importer,
}

/// A frame on the indent-aware parse stack. The `usize` is the indent of the
/// line that opened the frame; children must be at indent strictly greater
/// than that value. `Frame::Root` has no header line and is never popped.
#[derive(Clone, Debug)]
enum Frame {
    Root,
    Importers(usize),
    Importer(usize),
    DepGroup(usize, Origin),
    /// Block-form dep entry awaiting a nested `version:` line.
    DepBlock {
        base: usize,
        origin: Origin,
        pkg_name: String,
    },
    Packages(usize),
    Snapshots(usize),
    /// Inside a `packages:` or `snapshots:` entry, collecting its subkeys.
    PkgEntry {
        base: usize,
        key: String,
    },
    /// Inside a pkg entry's `dependencies:` / `optionalDependencies:` block,
    /// collecting dep edges for `owner`.
    PkgDeps {
        base: usize,
        owner: String,
    },
}

impl Frame {
    fn base(&self) -> Option<usize> {
        match self {
            Frame::Root => None,
            Frame::Importers(b) | Frame::Importer(b) | Frame::Packages(b) | Frame::Snapshots(b) => {
                Some(*b)
            }
            Frame::DepGroup(b, _) => Some(*b),
            Frame::DepBlock { base, .. }
            | Frame::PkgEntry { base, .. }
            | Frame::PkgDeps { base, .. } => Some(*base),
        }
    }
}

/// Parse a `pnpm-lock.yaml` text and return the installed version of
/// `package_name`, if found.
///
/// Search priority:
/// 1. Direct match in `importers.<any>.{dependencies,devDependencies,optionalDependencies}`
/// 2. Direct match in top-level `{dependencies,devDependencies,optionalDependencies}` (v5/v6)
/// 3. Transitive resolution via BFS from root-importer deps through the
///    `snapshots:` (v9) or `packages:` (v6–v8) dep graph
/// 4. Fallback: first matching `packages:` or `snapshots:` key
fn parse_pnpm_lock(text: &str, pkg: &str) -> Option<String> {
    let mut stack: Vec<Frame> = vec![Frame::Root];
    let mut graph = PnpmGraph::default();

    let mut importer_match: Option<String> = None;
    let mut top_match: Option<String> = None;
    let mut packages_fallback: Option<String> = None;

    for raw in text.lines() {
        let line = raw.trim_end_matches('\r');
        if line.trim().is_empty() {
            continue;
        }
        if line.trim_start().starts_with('#') {
            continue;
        }
        let indent = line.len() - line.trim_start().len();
        let content = &line[indent..];

        // Pop frames whose scope has ended. Root (base =
```

### Core Architecture Module: `packages/opensrc/bin/opensrc.js`
```
#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { existsSync, accessSync, chmodSync, constants } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { platform, arch } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

function isMusl() {
  if (platform() !== 'linux') return false;
  try {
    const result = execSync('ldd --version 2>&1 || true', { encoding: 'utf8' });
    return result.toLowerCase().includes('musl');
  } catch {
    return existsSync('/lib/ld-musl-x86_64.so.1') || existsSync('/lib/ld-musl-aarch64.so.1');
  }
}

function getBinaryName() {
  const os = platform();
  const cpuArch = arch();

  let osKey;
  switch (os) {
    case 'darwin': osKey = 'darwin'; break;
    case 'linux': osKey = isMusl() ? 'linux-musl' : 'linux'; break;
    case 'win32': osKey = 'win32'; break;
    default: return null;
  }

  let archKey;
  switch (cpuArch) {
    case 'x64':
    case 'x86_64': archKey = 'x64'; break;
    case 'arm64':
    case 'aarch64': archKey = 'arm64'; break;
    default: return null;
  }

  const ext = os === 'win32' ? '.exe' : '';
  return `opensrc-${osKey}-${archKey}${ext}`;
}

function main() {
  const binaryName = getBinaryName();

  if (!binaryName) {
    console.error(`Error: Unsupported platform: ${platform()}-${arch()}`);
    process.exit(1);
  }

  const binaryPath = join(__dirname, binaryName);

  if (!existsSync(binaryPath)) {
    console.error(`Error: No binary found for ${platform()}-${arch()}`);
    console.error(`Expected: ${binaryPath}`);
    console.error('');
    console.error('Run "npm run build:native" to build for your platform,');
    console.error('or reinstall the package to trigger the postinstall download.');
    process.exit(1);
  }

  if (platform() !== 'win32') {
    try {
      accessSync(binaryPath, constants.X_OK);
    } catch {
      try {
        chmodSync(binaryPath, 0o755);
      } catch (chmodErr) {
        console.error(`Error: Cannot make binary executable: ${chmodErr.message}`);
        console.error('Try running: chmod +x ' + binaryPath);
        process.exit(1);
      }
    }
  }

  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
    windowsHide: false,
  });

  child.on('error', (err) => {
    console.error(`Error executing binary: ${err.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
}

main();

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #70** (2026-09-16): **Add Labs status badges to README**
  *Symptoms*: ## Summary  - Add **LABS EXPERIMENT** using Shields for-the-badge styling and fixed black labels. - Keep the badges inline in a single HTML paragraph: category, version/release, license, then monthly npm downloads where verified. Small screens wrap naturally; no forced line breaks. - Preserve the existing README content and useful badges. No code, package, release, or repository-archive changes.  ## Preview  <p>   <a href="https://vercel.com/labs#active-experiments"><img alt="Vercel Labs Experiment" src="https://img.shields.io/badge/LABS-EXPERIMENT-0a0a0a.svg?style=for-the-badge&amp;logo=Vercel&amp;labelColor=000000" height="28"></a>   <a href="https://www.npmjs.com/package/opensrc"><img alt="npm version: opensrc" src="https://img.shields.io/npm/v/opensrc.svg?style=for-the-badge&amp;labelColor=000000" height="28"></a>   <a href="https://github.com/vercel-labs/opensrc/blob/main/LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/github/license/vercel-labs/opensrc.svg?style=for-the-badge&amp;labelColor=000000" height="28"></a>   <a href="https://www.npmjs.com/package/opensrc"><img alt="npm downloads per month: opensrc" src="https://img.shields.io/npm/dm/opensrc.svg?style=for-the-badge&amp;labelColor=000000&amp;label=npm%20downloads" height="28"></a> </p>  ## Verification  - `git diff --check`: passed. - README-only diff and preservation of all other content: passed. - GitHub Markdown API: rendered without forced `<br>` breaks. - Browser layout: badges share one 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #08j/4GyrCaQDqZtbg1P4ggiJyXsG+nziRuOx8B0iGjY=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3JjIiwicHJvamVjdElkIjoicHJqX2ZUNFJXZWMxck43WXpqY0MxM01PWUFPZVp5VGciLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWxhYnMvb3BlbnNyYy9EMUVuemF2dUZ5Q0hqNUhNaXM5eU45ak4zTndwIiwicHJldmlld1VybCI6Im9wZW5zcmMtZ2l0LXJhaWxseS1sYWJzLXJlYWRtZS1iYWRnZXMtMjAyNi0wOS0xNi5sYWJzLnZlcmNlbC5kZXYiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoib3BlbnNyYy1naXQtcmFpbGx5LWxhYnMtcmVhZG1lLWJhZGdlcy0yMDI2LTA5LTE2LmxhYnMudmVyY2VsLmRldiJ9LCJyb290RGlyZWN0b3J5IjoiYXBwcy9kb2NzIn1dfQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/vercel-labs/opensrc"><sup><img src="https://vercel.com/api/www/avatar?projectId=prj_fT4RWec1rN7

- **Issue #69** (2026-08-31): **feat(cli): support project-local source cache**
  *Symptoms*: ## Summary  Closes #45.  `opensrc fetch` and `opensrc path` now accept `--local` to store the source cache in `<cwd>/.opensrc` instead of the global cache. When `--cwd` is provided, that directory is used as the project root; otherwise the current directory is used. The default global-cache behavior remains unchanged.  ## Compatibility  This is opt-in and does not change existing commands or the `OPENSRC_HOME` override. The temporary cache selection is restored when the command completes.  ## Tests  - `cargo fmt --manifest-path packages/opensrc/cli/Cargo.toml` - `cargo test --manifest-path packages/opensrc/cli/Cargo.toml` (114 passed) - `cargo clippy --manifest-path packages/opensrc/cli/Cargo.toml -- -D warnings` - `cargo build --manifest-path packages/opensrc/cli/Cargo.toml` - `cargo run --quiet --manifest-path packages/opensrc/cli/Cargo.toml -- fetch --help`  No checks were skipped. The full workspace JavaScript checks were not run because this change is isolated to the Rust CLI and its existing Rust test suite.
  **Post-Mortem & Fix Analysis**:
  > @mikemikimike is attempting to deploy a commit to the **Vercel Labs** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Vercel%20Labs&slug=vercel-labs&teamId=team_nO2mCG4W8IxPIeKoSsqwAxxB&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22cef94513b8220923d8f9673fa3b11774509767c3%22%7D%2C%22id%22%3A%22QmRZB4HHGwFCg7aFu4AVmoEv1QtF49hoARgaazkV917M3k%22%2C%22org%22%3A%22vercel-labs%22%2C%22prId%22%3A69%2C%22repo%22%3A%22opensrc%22%7D).  
  > Addressed the bot suggestion in commit `109c295`: replaced eager `unwrap_or` evaluation with a `match`, so `current_dir()` is only called when `--cwd` is not provided. Verified with `cargo test` (114 passed), `cargo clippy --manifest-path packages/opensrc/cli/Cargo.toml -- -D warnings`, and `git diff --check`.
  > ## Follow-up considerations  The current PR intentionally keeps the change limited to the requested project-local cache option. During review, I identified a few follow-up areas that are not included here:  - Add `--local`/project-root selection to `list`, `remove`, and `clean`, so local caches can be managed through the CLI. - Add an end-to-end test that performs a real fetch/path operation and verifies the source is written under `<cwd>/.opensrc`. - Avoid process-global `OPENSRC_HOME` state if the cache core is later used concurrently or as a library. - Add coordination for multiple processes targeting the same local cache, including clone/index update races. - Consider crash consistency between a successful clone and the subsequent `sources.json` update. - Decide separately whether project-local caching should eventually become the default rather than an opt-in flag.  These are intentionally left out to keep this PR focused on Issue #45's CLI option and avoid expanding the cache-man

- **Issue #68** (2026-06-23): **Configure trusted npm publishing**
  *Symptoms*: - Switch release workflow to trusted npm publishing with provenance. - Require Node 24+ and pnpm 11 across local and CI workflows. - Add pnpm release-age policy and deny dependency build scripts.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #FZCeVf/EXdwgyGdDafF6lXZWNV/DqV3Hf6ef+1ZNqAc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3JjIiwicHJvamVjdElkIjoicHJqX2ZUNFJXZWMxck43WXpqY0MxM01PWUFPZVp5VGciLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWxhYnMvb3BlbnNyYy9IVmlKUnNpaXlCczF5a0Y0NEdSZEdNTDRmeEZYIiwicHJldmlld1VybCI6Im9wZW5zcmMtZ2l0LWN0YXRlLXRydXN0ZWQtcHVibGlzaGVyLmxhYnMudmVyY2VsLmRldiIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJvcGVuc3JjLWdpdC1jdGF0ZS10cnVzdGVkLXB1Ymxpc2hlci5sYWJzLnZlcmNlbC5kZXYifSwicm9vdERpcmVjdG9yeSI6ImFwcHMvZG9jcyJ9XX0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated (UTC) | | :--- | :----- | :------ | :------ | | [opensrc](https://vercel.com/vercel-labs/opensrc) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/vercel-labs/opensrc/H

- **Issue #67** (2026-06-23): **Prepare v0.7.3 release**
  *Symptoms*: - Bump opensrc package and Rust crate versions to 0.7.3 - Add v0.7.3 changelog notes and move release markers
  **Post-Mortem & Fix Analysis**:
  > [vc]: #y/gdJzpCPOwndPXPr9zwh9aTlo78FxGgzKIu67Z/Hlw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3JjIiwicHJvamVjdElkIjoicHJqX2ZUNFJXZWMxck43WXpqY0MxM01PWUFPZVp5VGciLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWxhYnMvb3BlbnNyYy8zTVE0eTVNeW5UUjJxSzJaRkFGZEduZ2JhTHF3IiwicHJldmlld1VybCI6Im9wZW5zcmMtZ2l0LWN0YXRlLXYwNzMubGFicy52ZXJjZWwuZGV2IiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6Im9wZW5zcmMtZ2l0LWN0YXRlLXYwNzMubGFicy52ZXJjZWwuZGV2In0sInJvb3REaXJlY3RvcnkiOiJhcHBzL2RvY3MifV19 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated (UTC) | | :--- | :----- | :------ | :------ | | [opensrc](https://vercel.com/vercel-labs/opensrc) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/vercel-labs/opensrc/3MQ4y5MynTR2qK2ZFAFdGngbaLqw) | [Prev

- **Issue #66** (2026-06-23): **Fix authenticated clone host validation**
  *Symptoms*: - Parse clone URLs and require exact supported hosts before adding tokens - Reject host-prefix confusion for GitHub, GitLab, and Bitbucket metadata - Add regressions and stabilize OPENSRC_HOME cache tests
  **Post-Mortem & Fix Analysis**:
  > [vc]: #/fjdfmz9zlxx70PFFvmJTBB1Z/TUtacoT+4u8Xx3Kos=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3JjIiwicHJvamVjdElkIjoicHJqX2ZUNFJXZWMxck43WXpqY0MxM01PWUFPZVp5VGciLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWxhYnMvb3BlbnNyYy9ERThjODFTTHBCanpzY0Y2aFk0amVVUmJoUXBkIiwicHJldmlld1VybCI6Im9wZW5zcmMtZ2l0LWN0YXRlLWZpeC1ob3N0LXN1YnN0ci5sYWJzLnZlcmNlbC5kZXYiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoib3BlbnNyYy1naXQtY3RhdGUtZml4LWhvc3Qtc3Vic3RyLmxhYnMudmVyY2VsLmRldiJ9LCJyb290RGlyZWN0b3J5IjoiYXBwcy9kb2NzIn1dfQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated (UTC) | | :--- | :----- | :------ | :------ | | [opensrc](https://vercel.com/vercel-labs/opensrc) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/vercel-labs/opensrc/DE8c8

- **Issue #58** (2026-07-18): **feat(cli): add local cache option**
  *Symptoms*: ## Summary  Adds a global `--local` option that makes `opensrc` use a project-local `.opensrc` directory instead of the default global cache.  This addresses the workflow in #45 where agents should read sources scoped to the current working tree rather than searching under the user's home directory.  ## Behavior  - `opensrc --local fetch ...` caches under `./.opensrc` - `opensrc --local path --cwd ./apps/web ...` caches under `./apps/web/.opensrc` - `opensrc --local list/remove/clean` operate on `./.opensrc` - Existing default behavior and `OPENSRC_HOME` remain unchanged unless `--local` is explicitly passed  ## Validation  - `cargo fmt --manifest-path packages/opensrc/cli/Cargo.toml` - `cargo test --manifest-path packages/opensrc/cli/Cargo.toml` - `cargo clippy --manifest-path packages/opensrc/cli/Cargo.toml -- -D warnings` - `cargo run --manifest-path packages/opensrc/cli/Cargo.toml -- --help`  Closes #45. 
  **Post-Mortem & Fix Analysis**:
  > @EfeDurmaz16 is attempting to deploy a commit to the **Vercel Labs** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Vercel%20Labs&slug=vercel-labs&teamId=team_nO2mCG4W8IxPIeKoSsqwAxxB&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22b35435298cb8b711104579e57f16d42da7554a72%22%7D%2C%22id%22%3A%22QmYRrvjDehBNfhY6zV1pfG1m6kV4XYxHhJ9z8YMoi6BXju%22%2C%22org%22%3A%22vercel-labs%22%2C%22prId%22%3A58%2C%22repo%22%3A%22opensrc%22%7D).  

- **Issue #56** (2026-04-30): **Document fetch command, fix search index, add type-check CI, structured error handling**
  *Symptoms*: ## Summary  - **Document `opensrc fetch`** — added to CLI README and docs site commands page (shipped in 0.7.2 but was missing from both) - **Fix search index** — added `/auth` to `allDocsPages` so the Authentication page is discoverable via site search - **Add docs type-check to CI** — `pnpm type-check` now runs in the docs CI job - **Structured error handling** — replaced `Box<dyn std::error::Error>` with a `thiserror`-based `Error` enum across the entire CLI, eliminating the `process::exit(1)` in `get_opensrc_dir()` and giving every error site a typed variant
  **Post-Mortem & Fix Analysis**:
  > [vc]: #FScCphxTdHAltqmRP7QgQ+IvWIWHWGSt7kljJY40Wm4=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3JjIiwicHJvamVjdElkIjoicHJqX2ZUNFJXZWMxck43WXpqY0MxM01PWUFPZVp5VGciLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoib3BlbnNyYy1naXQtY3RhdGUtZml4LWdhcHMubGFicy52ZXJjZWwuZGV2In0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtbGFicy9vcGVuc3JjL0VzaDF3MW1ndTliNXRmVE0xR2ExTWZWVlBrdUoiLCJwcmV2aWV3VXJsIjoib3BlbnNyYy1naXQtY3RhdGUtZml4LWdhcHMubGFicy52ZXJjZWwuZGV2IiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dfQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated (UTC) | | :--- | :----- | :------ | :------ | | [opensrc](https://vercel.com/vercel-labs/opensrc) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/vercel-labs/opensrc/Esh1w1mgu9b5tfTM1Ga1MfVVPkuJ) | [Preview](https://opensrc-git

- **Issue #55** (2026-04-30): **Document fetch command, fix search index, add type-check CI, structured error handling**
  *Symptoms*: ## Summary  - **Document `opensrc fetch`** — added to CLI README and docs site commands page (shipped in 0.7.2 but was missing from both) - **Fix search index** — added `/auth` to `allDocsPages` so the Authentication page is discoverable via site search - **Add docs type-check to CI** — `pnpm type-check` now runs in the docs CI job - **Structured error handling** — replaced `Box<dyn std::error::Error>` with a `thiserror`-based `Error` enum across the entire CLI, eliminating the `process::exit(1)` in `get_opensrc_dir()` and giving every error site a typed variant
  **Post-Mortem & Fix Analysis**:
  > [vc]: #ITu64uRDwDCc/agxsd+8F/vSvdGXfShHsaX+wquYqTA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3JjIiwicHJvamVjdElkIjoicHJqX2ZUNFJXZWMxck43WXpqY0MxM01PWUFPZVp5VGciLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWxhYnMvb3BlbnNyYy9DeVBwSHp2RHJNY0xBdXZKNjFpRnc5anFDV2JmIiwicHJldmlld1VybCI6Im9wZW5zcmMtZ2l0LXRpZXItMS1xdWljay13aW5zLmxhYnMudmVyY2VsLmRldiIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJvcGVuc3JjLWdpdC10aWVyLTEtcXVpY2std2lucy5sYWJzLnZlcmNlbC5kZXYifSwicm9vdERpcmVjdG9yeSI6ImFwcHMvZG9jcyJ9XX0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated (UTC) | | :--- | :----- | :------ | :------ | | [opensrc](https://vercel.com/vercel-labs/opensrc) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/vercel-labs/opensrc/CyPpHzvDrMcLAuvJ6

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

### Incident Patch 1: `9d90efd5` (2026-06-23)
**Commit Message**: Fix authenticated clone host validation (#66)

- Parse clone URLs and require exact supported hosts before adding tokens
- Reject host-prefix confusion for GitHub, GitLab, and Bitbucket metadata
- Add regressions and stabilize OPENSRC_HOME cache tests

**File**: `packages/opensrc/cli/src/core/cache.rs` (modified, +5/-0)
```diff
@@ -273,6 +273,9 @@ pub fn now_iso() -> String {
 #[cfg(test)]
 mod tests {
     use super::*;
+    use std::sync::Mutex;
+
+    static ENV_LOCK: Mutex<()> = Mutex::new(());
 
     #[test]
     fn test_parse_repo_url_https() {
@@ -311,6 +314,7 @@ mod tests {
 
     #[test]
     fn test_read_sources_corrupt_json_creates_backup() {
+        let _env_guard = ENV_LOCK.lock().unwrap();
         let tmp = std::env::temp_dir().join("opensrc_test_corrupt");
         let _ = fs::remove_dir_all(&tmp);
         fs::create_dir_all(&tmp).unwrap();
@@ -334,6 +338,7 @@ mod tests {
 
     #[test]
     fn test_read_sources_valid_json() {
+        let _env_guard = ENV_LOCK.lock().unwrap();
         let tmp = std::env::temp_dir().join("opensrc_test_valid");
         let _ = fs::remove_dir_all(&tmp);
         fs::create_dir_all(&tmp).unwrap();
```

**File**: `packages/opensrc/cli/src/core/registries/mod.rs` (modified, +199/-22)
```diff
@@ -109,8 +109,31 @@ pub fn resolve_package(spec: &PackageSpec) -> super::error::Result<ResolvedPacka
     }
 }
 
+const GITHUB_HOST: &str = "github.com";
+const GITLAB_HOST: &str = "gitlab.com";
+const BITBUCKET_HOST: &str = "bitbucket.org";
+
 pub(crate) fn is_git_repo_url(url: &str) -> bool {
-    url.contains("github.com") || url.contains("gitlab.com") || url.contains("bitbucket.org")
+    [GITHUB_HOST, GITLAB_HOST, BITBUCKET_HOST]
+        .iter()
+        .any(|supported| repo_host_matches(url, supported))
+}
+
+fn repo_host_matches(url: &str, expected_host: &str) -> bool {
+    if let Ok(parsed) = url::Url::parse(url) {
+        return parsed
+            .host_str()
+            .is_some_and(|host| host.eq_ignore_ascii_case(expected_host));
+    }
+
+    let Some(rest) = url.strip_prefix("git@") else {
+        return false;
+    };
+    let Some((host, _)) = rest.split_once(':') else {
+        return false;
+    };
+
+    host.eq_ignore_ascii_case(expected_host)
 }
 
 pub(crate) fn normalize_repo_url(url: &str) -> String {
@@ -150,36 +173,66 @@ pub(crate) fn bitbucket_token() -> Option<String> {
 
 /// Rewrites an HTTPS clone URL to embed auth credentials when a token is available.
 pub fn authenticated_clone_url(url: &str) -> String {
-    if let Some(token) = github_token() {
-        if url.contains("github.com") {
-            return url.replacen(
-                "https://github.com",
-                &format!("https://x-access-token:{token}@github.com"),
-                1,
-            );
+    let github = github_token();
+    let gitlab = gitlab_token();
+    let bitbucket = bitbucket_token();
+
+    authenticated_clone_url_with_tokens(
+        url,
+        github.as_deref(),
+        gitlab.as_deref(),
+        bitbucket.as_deref(),
+    )
+}
+
+fn authenticated_clone_url_with_tokens(
+    url: &str,
+    github: Option<&str>,
+    gitlab: Option<&str>,
+    bitbucket: Option<&str>,
+) -> String {
+    if let Some(token) = github {
+        if let Some(authenticated) =
+            authenticated_url_for_host(url, GITHUB_HOST, "x-access-token", token)
+        {
+            return authenticated;
         }
     }
-    if let Some(token) = gitlab_token() {
-        if url.contains("gitlab.com") {
-            return url.replacen(
-                "https://gitlab.com",
-                &format!("https://oauth2:{token}@gitlab.com"),
-                1,
-            );
+    if let Some(token) = gitlab {
+        if let Some(authenticated) = authenticated_url_for_host(url, GITLAB_HOST, "oauth2", token) {
+            return authenticated;
         }
     }
-    if let Some(token) = bitbucket_token() {
-        if url.contains("bitbucket.org") {
-            return url.replacen(
-                "https://bitbucket.org",
-                &format!("https://x-token-auth:{token}@bitbucket.org"),
-                1,
-            );
+    if let Some(token) = bitbucket {
+        if let Some(authenticated) =
+            authenticated_url_for_host(url, BITBUCKET_HOST, "x-token-auth", token)
+        {
+            return authenticated;
         }
     }
     url.to_string()
 }
 
+fn authenticated_url_for_host(
+    url: &str,
+    expected_host: &str,
+    username: &str,
+    token: &str,
+) -> Option<String> {
+    let mut parsed = url::Url::parse(url).ok()?;
+    if parsed.scheme() != "https" {
+        return None;
+    }
+    let host = parsed.host_str()?;
+    if !host.eq_ignore_ascii_case(expected_host) {
+        return None;
+    }
+
+    parsed.set_username(username).ok()?;
+    parsed.set_password(Some(token)).ok()?;
+    Some(parsed.to_string())
+}
+
 pub fn detect_input_type(spec: &str) -> &'static str {
     let trimmed = spec.trim();
     let lower = trimmed.to_lowercase();
@@ -216,11 +269,135 @@ mod tests {
         assert!(is_git_repo_url("https://bitbucket.org/owner/repo"));
     }
 
+    #[test]
+    fn test_is_git_repo_url_ssh() {
+        assert!(is_git_repo_url("git@github.com:owner/repo.git"));
+    }
+
     #[test]
     fn test_is_git_repo_url_other() {
         assert!(!is_git_repo_url("https://example.com/owner/repo"));
     }
 
+    #[test]
+    fn test_is_git_repo_url_rejects_host_prefix_confusion() {
+        assert!(!is_git_repo_url(
+            "https://github.com.attacker.example/owner/repo"
+        ));
+        assert!(!is_git_repo_url(
+            "https://gitlab.com.attacker.example/owner/repo"
+        ));
+        assert!(!is_git_repo_url(
+            "https://bitbucket.org.attacker.example/owner/repo"
+        ));
+        assert!(!is_git_repo_url(
+            "git@github.com.attacker.example:owner/repo.git"
+        ));
+    }
+
+    #[test]
+    fn test_is_git_repo_url_rejects_host_in_path() {
+        assert!(!is_git_repo_url(
+            "https://example.com/github.com/owner/repo"
+        ));
+    }
+
+    #[test]
+    fn test_authenticated_clone_url_github_exact_host() {
+        assert_eq!(
+            authenticated_clone_url_with_tokens(
+        
```

---

### Incident Patch 2: `2efd74e8` (2026-04-30)
**Commit Message**: Document fetch command, fix search index, add type-check CI, structured error handling (#56)

- Document `opensrc fetch` in CLI README and docs site commands page
- Add /auth to allDocsPages so Authentication is searchable
- Add `pnpm type-check` step to docs CI job
- Replace Box<dyn Error> with thiserror enum across the CLI
- Fix get_opensrc_dir() to return Result instead of calling process::exit(1)

**File**: `.github/workflows/ci.yml` (modified, +4/-0)
```diff
@@ -71,3 +71,7 @@ jobs:
       - name: Build docs
         run: pnpm build
         working-directory: apps/docs
+
+      - name: Type check docs
+        run: pnpm type-check
+        working-directory: apps/docs
```

**File**: `apps/docs/src/app/commands/page.mdx` (modified, +16/-0)
```diff
@@ -1,5 +1,21 @@
 # Commands
 
+## fetch
+
+Fetch source code for one or more packages or repos into the cache. Unlike `path`, this command does not print paths — it's designed for pre-populating the cache:
+
+```bash
+opensrc fetch zod
+opensrc fetch pypi:requests crates:serde vercel/next.js
+```
+
+### Options
+
+| Flag | Description |
+|------|-------------|
+| `--cwd <path>` | Working directory for lockfile version resolution |
+| `--quiet` / `-q` | Suppress progress output |
+
 ## path
 
 Print the absolute path to a package's source code, fetching automatically on cache miss. This is the primary command for using opensrc — compose it with any shell tool:
```

**File**: `apps/docs/src/lib/docs-navigation.ts` (modified, +1/-0)
```diff
@@ -8,4 +8,5 @@ export const allDocsPages: NavItem[] = [
   { name: "Registries", href: "/registries" },
   { name: "Commands", href: "/commands" },
   { name: "How It Works", href: "/how-it-works" },
+  { name: "Authentication", href: "/auth" },
 ];
```

**File**: `packages/opensrc/README.md` (modified, +13/-0)
```diff
@@ -39,6 +39,19 @@ Options:
 - `--cwd <path>` — working directory for lockfile version resolution
 - `--verbose` — show progress during fetch
 
+### Fetch source code
+
+Pre-fetch one or more packages or repos into the cache without printing paths:
+
+```bash
+opensrc fetch zod
+opensrc fetch pypi:requests crates:serde vercel/next.js
+```
+
+Options:
+- `--cwd <path>` — working directory for lockfile version resolution
+- `--quiet` / `-q` — suppress progress output
+
 ### List cached sources
 
 ```bash
```

**File**: `packages/opensrc/cli/Cargo.lock` (modified, +1/-0)
```diff
@@ -671,6 +671,7 @@ dependencies = [
  "reqwest",
  "serde",
  "serde_json",
+ "thiserror 2.0.18",
  "url",
  "urlencoding",
 ]
```

**File**: `packages/opensrc/cli/Cargo.toml` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ dirs = "5.0"
 chrono = { version = "0.4", features = ["serde"] }
 regex = "1"
 url = "2"
+thiserror = "2"
 urlencoding = "2"
 
 [profile.release]
```

**File**: `packages/opensrc/cli/src/commands/clean.rs` (modified, +8/-5)
```diff
@@ -4,17 +4,18 @@ use crate::core::cache::{
     cleanup_empty_dirs, extract_repo_base_path, get_opensrc_dir, get_repos_dir, list_sources,
     write_sources, PackageEntry, RepoEntry,
 };
+use crate::core::error::{Error, Result};
 use crate::core::registries::Registry;
 
 pub fn run(
     clean_packages_flag: bool,
     clean_repos_flag: bool,
     registry: Option<Registry>,
-) -> Result<(), Box<dyn std::error::Error>> {
+) -> Result<()> {
     let clean_packages = clean_packages_flag || !clean_repos_flag;
     let clean_repos = clean_repos_flag || (!clean_packages_flag && registry.is_none());
 
-    let (packages, repos) = list_sources();
+    let (packages, repos) = list_sources()?;
 
     let mut remaining_packages: Vec<PackageEntry> = packages.clone();
     let mut remaining_repos: Vec<RepoEntry> = repos.clone();
@@ -64,7 +65,7 @@ pub fn run(
 
     let all_paths: std::collections::HashSet<String> =
         pkg_paths.union(&repo_paths).cloned().collect();
-    let opensrc_dir = get_opensrc_dir();
+    let opensrc_dir = get_opensrc_dir()?;
 
     let mut delete_errors = 0usize;
     for repo_path in &all_paths {
@@ -79,7 +80,7 @@ pub fn run(
         }
     }
 
-    let repos_dir = get_repos_dir();
+    let repos_dir = get_repos_dir()?;
     if repos_dir.exists() {
         cleanup_empty_dirs(&repos_dir);
     }
@@ -111,7 +112,9 @@ pub fn run(
     println!("\nCleaned {total} source(s)");
 
     if delete_errors > 0 {
-        return Err(format!("Failed to remove {delete_errors} path(s) from disk").into());
+        return Err(Error::Other(format!(
+            "Failed to remove {delete_errors} path(s) from disk"
+        )));
     }
 
     Ok(())
```

**File**: `packages/opensrc/cli/src/commands/fetch.rs` (modified, +5/-6)
```diff
@@ -1,10 +1,7 @@
+use crate::core::error::{Error, Result};
 use crate::core::fetcher::ensure_cached;
 
-pub fn run(
-    specs: &[String],
-    cwd: Option<&str>,
-    quiet: bool,
-) -> Result<(), Box<dyn std::error::Error>> {
+pub fn run(specs: &[String], cwd: Option<&str>, quiet: bool) -> Result<()> {
     let cwd = cwd.unwrap_or(".");
 
     let mut fetched = 0u32;
@@ -61,7 +58,9 @@ pub fn run(
     }
 
     if had_errors {
-        return Err("Some sources could not be fetched".into());
+        return Err(Error::Other(
+            "Some sources could not be fetched".to_string(),
+        ));
     }
 
     Ok(())
```

---

### Incident Patch 3: `869314f4` (2026-04-09)
**Commit Message**: Fix remove to accept the same repo formats as fetch (#39)

Use parse_repo_spec() instead of manual heuristic to normalize repo
inputs, so formats like github:owner/repo and full URLs work correctly.

Fixes #22, fixes #21

**File**: `packages/opensrc/cli/src/commands/remove.rs` (modified, +9/-6)
```diff
@@ -1,7 +1,7 @@
 use crate::core::cache::{
     get_package_info, list_sources, remove_package_source, remove_repo_source, write_sources,
 };
-use crate::core::registries::repo::is_repo_spec;
+use crate::core::registries::repo::{is_repo_spec, parse_repo_spec};
 use crate::core::registries::{detect_registry, Registry};
 
 pub fn run(items: &[String]) -> Result<(), Box<dyn std::error::Error>> {
@@ -16,11 +16,14 @@ pub fn run(items: &[String]) -> Result<(), Box<dyn std::error::Error>> {
         let is_repo = is_repo_spec(item) || (item.contains('/') && !item.contains(':'));
 
         if is_repo {
-            let mut display_name = item.clone();
-            let slash_count = item.chars().filter(|c| *c == '/').count();
-            if slash_count == 1 && !item.starts_with("http") {
-                display_name = format!("github.com/{item}");
-            }
+            let display_name = match parse_repo_spec(item) {
+                Some(spec) => format!("{}/{}/{}", spec.host, spec.owner, spec.repo),
+                None => {
+                    println!("  ✗ Could not parse repo spec: {item}");
+                    had_errors = true;
+                    continue;
+                }
+            };
 
             match remove_repo_source(&display_name, None) {
                 Ok(true) => {
```

---

### Incident Patch 4: `3851b599` (2026-04-09)
**Commit Message**: Fix bugs found during PR #35 review (#36)

- Fix npm.rs: sort version keys so "recent versions" error lists actual
  recent versions instead of random HashMap iteration order
- Fix list.rs: help text referenced `opensrc <package>` but the CLI
  requires `opensrc path <package>`
- Fix postinstall.js: checksum verification used substring match which
  could match wrong filename; use exact endsWith match
- Fix CHANGELOG.md: move version heading inside release markers so
  GitHub release body includes it
- Fix docs-chat route: add 50-message cap to prevent abuse via
  unbounded payloads
- Fix search.tsx: clear stale results on fetch error instead of leaving
  previous results visible

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -1,8 +1,8 @@
 # opensrc
 
+<!-- release:start -->
 ## 0.6.0
 
-<!-- release:start -->
 ### New Features
 
 - **Global cache** — Switch from per-project `opensrc/` folder to a global `~/.opensrc/` cache, shared across all projects
```

**File**: `apps/docs/src/app/api/docs-chat/route.ts` (modified, +10/-0)
```diff
@@ -138,6 +138,16 @@ export async function POST(req: Request) {
     );
   }
 
+  if (messages.length > 50) {
+    return new Response(
+      JSON.stringify({
+        error: "Bad request",
+        message: "Too many messages. Please start a new conversation.",
+      }),
+      { status: 400, headers: { "Content-Type": "application/json" } },
+    );
+  }
+
   const docsFiles = await loadDocsFiles();
   const {
     tools: { bash, readFile: readFileTool },
```

**File**: `apps/docs/src/components/search.tsx` (modified, +5/-1)
```diff
@@ -73,9 +73,13 @@ export function Search() {
         if (res.ok) {
           const data = await res.json();
           setResults(data.results);
+        } else {
+          setResults([]);
         }
       } catch {
-        // aborted or network error
+        if (!controller.signal.aborted) {
+          setResults([]);
+        }
       } finally {
         if (!controller.signal.aborted) {
           setLoading(false);
```

**File**: `packages/opensrc/cli/src/commands/list.rs` (modified, +5/-5)
```diff
@@ -7,12 +7,12 @@ pub fn run(json: bool) -> Result<(), Box<dyn std::error::Error>> {
 
     if total == 0 {
         println!("No sources cached yet.");
-        println!("\nUse `opensrc <package>` to fetch source code for a package.");
-        println!("Use `opensrc <owner>/<repo>` to fetch a GitHub repository.");
+        println!("\nUse `opensrc path <package>` to fetch source code for a package.");
+        println!("Use `opensrc path <owner>/<repo>` to fetch a GitHub repository.");
         println!("\nSupported registries:");
-        println!("  • npm:      opensrc zod, opensrc npm:react");
-        println!("  • PyPI:     opensrc pypi:requests");
-        println!("  • crates:   opensrc crates:serde");
+        println!("  • npm:      opensrc path zod, opensrc path npm:react");
+        println!("  • PyPI:     opensrc path pypi:requests");
+        println!("  • crates:   opensrc path crates:serde");
         return Ok(());
     }
 
```

**File**: `packages/opensrc/cli/src/core/registries/npm.rs` (modified, +7/-5)
```diff
@@ -115,13 +115,15 @@ pub fn resolve_npm_package(
     };
 
     if !info.versions.contains_key(&resolved_version) {
-        let recent: Vec<&String> = info.versions.keys().collect::<Vec<_>>();
-        let tail: Vec<&&String> = recent.iter().rev().take(5).collect();
-        let versions_str = tail
+        let mut sorted_versions: Vec<&String> = info.versions.keys().collect();
+        sorted_versions.sort();
+        let tail: Vec<&str> = sorted_versions
             .iter()
+            .rev()
+            .take(5)
             .map(|v| v.as_str())
-            .collect::<Vec<_>>()
-            .join(", ");
+            .collect();
+        let versions_str = tail.into_iter().rev().collect::<Vec<_>>().join(", ");
         return Err(format!(
             "Version \"{resolved_version}\" not found for \"{name}\". Recent versions: {versions_str}"
         )
```

**File**: `packages/opensrc/scripts/postinstall.js` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ async function downloadText(url) {
 async function verifyChecksum(filePath, fileName) {
   try {
     const checksums = await downloadText(CHECKSUMS_URL);
-    const line = checksums.split('\n').find((l) => l.includes(fileName));
+    const line = checksums.split('\n').find((l) => l.trim().endsWith(fileName));
     if (!line) {
       console.log('⚠ No checksum entry found for this binary, skipping verification');
       return true;
```

---

### Incident Patch 5: `1fe9dbca` (2026-02-24)
**Commit Message**: Merge pull request #19 from vercel-labs/ctate/fix-7

fix: output local paths after fetch (#7)

**File**: `src/commands/fetch.ts` (modified, +11/-4)
```diff
@@ -359,13 +359,20 @@ export async function fetchCommand(
   }
 
   // Summary
-  const successful = results.filter((r) => r.success).length;
-  const failed = results.filter((r) => !r.success).length;
+  const successful = results.filter((r) => r.success);
+  const failed = results.filter((r) => !r.success);
 
-  console.log(`\nDone: ${successful} succeeded, ${failed} failed`);
+  console.log(`\nDone: ${successful.length} succeeded, ${failed.length} failed`);
+
+  if (successful.length > 0) {
+    console.log("\nSource code available at:");
+    for (const result of successful) {
+      console.log(`  ${result.package} → opensrc/${result.path}`);
+    }
+  }
 
   // Update sources.json with all fetched sources
-  if (successful > 0) {
+  if (successful.length > 0) {
     const existingSources = await listSources(cwd);
     const mergedSources = mergeResults(existingSources, results);
 
```

---

### Incident Patch 6: `4a5f5f7b` (2026-02-24)
**Commit Message**: fix: output local paths after fetch (#7)

**File**: `src/commands/fetch.ts` (modified, +11/-4)
```diff
@@ -359,13 +359,20 @@ export async function fetchCommand(
   }
 
   // Summary
-  const successful = results.filter((r) => r.success).length;
-  const failed = results.filter((r) => !r.success).length;
+  const successful = results.filter((r) => r.success);
+  const failed = results.filter((r) => !r.success);
 
-  console.log(`\nDone: ${successful} succeeded, ${failed} failed`);
+  console.log(`\nDone: ${successful.length} succeeded, ${failed.length} failed`);
+
+  if (successful.length > 0) {
+    console.log("\nSource code available at:");
+    for (const result of successful) {
+      console.log(`  ${result.package} → opensrc/${result.path}`);
+    }
+  }
 
   // Update sources.json with all fetched sources
-  if (successful > 0) {
+  if (successful.length > 0) {
     const existingSources = await listSources(cwd);
     const mergedSources = mergeResults(existingSources, results);
 
```

---

### Incident Patch 7: `159b5304` (2026-02-24)
**Commit Message**: Merge pull request #18 from vercel-labs/ctate/fix-13

Fix --cwd on subcommands, AGENTS.md cleanup, and stale CLI version

**File**: `src/index.test.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import { describe, it, expect, vi, beforeEach } from "vitest";
+
+vi.mock("./commands/fetch.js", () => ({ fetchCommand: vi.fn() }));
+vi.mock("./commands/list.js", () => ({ listCommand: vi.fn() }));
+vi.mock("./commands/remove.js", () => ({ removeCommand: vi.fn() }));
+vi.mock("./commands/clean.js", () => ({ cleanCommand: vi.fn() }));
+
+import { createProgram } from "./index.js";
+import { listCommand } from "./commands/list.js";
+import { removeCommand } from "./commands/remove.js";
+import { cleanCommand } from "./commands/clean.js";
+
+beforeEach(() => {
+  vi.clearAllMocks();
+});
+
+describe("CLI --cwd routing", () => {
+  it("passes --cwd to list subcommand", async () => {
+    const program = createProgram();
+    await program.parseAsync(["node", "opensrc", "list", "--cwd", "/tmp/foo"]);
+
+    expect(listCommand).toHaveBeenCalledWith(
+      expect.objectContaining({ cwd: "/tmp/foo" }),
+    );
+  });
+
+  it("passes --cwd to remove subcommand", async () => {
+    const program = createProgram();
+    await program.parseAsync([
+      "node",
+      "opensrc",
+      "remove",
+      "zod",
+      "--cwd",
+      "/tmp/bar",
+    ]);
+
+    expect(removeCommand).toHaveBeenCalledWith(
+      ["zod"],
+      expect.objectContaining({ cwd: "/tmp/bar" }),
+    );
+  });
+
+  it("passes --cwd to clean subcommand", async () => {
+    const program = createProgram();
+    await program.parseAsync([
+      "node",
+      "opensrc",
+      "clean",
+      "--cwd",
+      "/tmp/baz",
+    ]);
+
+    expect(cleanCommand).toHaveBeenCalledWith(
+      expect.objectContaining({ cwd: "/tmp/baz" }),
+    );
+  });
+});
```

**File**: `src/index.ts` (modified, +102/-88)
```diff
@@ -1,108 +1,122 @@
 #!/usr/bin/env node
 
+import { createRequire } from "node:module";
+import { fileURLToPath } from "node:url";
 import { Command } from "commander";
 import { fetchCommand } from "./commands/fetch.js";
 import { listCommand } from "./commands/list.js";
 import { removeCommand } from "./commands/remove.js";
 import { cleanCommand } from "./commands/clean.js";
 import type { Registry } from "./types.js";
 
-const program = new Command();
+const require = createRequire(import.meta.url);
+const pkg = require("../package.json") as { version: string };
 
-program
-  .name("opensrc")
-  .description(
-    "Fetch source code for packages to give coding agents deeper context",
-  )
-  .version("0.1.0");
+export function createProgram(): Command {
+  const program = new Command();
 
-// Default command: fetch packages
-program
-  .argument(
-    "[packages...]",
-    "packages or repos to fetch (e.g., zod, pypi:requests, crates:serde, owner/repo)",
-  )
-  .option("--cwd <path>", "working directory (default: current directory)")
-  .option(
-    "--modify [value]",
-    "allow/deny modifying .gitignore, tsconfig.json, AGENTS.md",
-    (val) => {
-      if (val === undefined || val === "" || val === "true") return true;
-      if (val === "false") return false;
-      return true;
-    },
-  )
-  .action(
-    async (packages: string[], options: { cwd?: string; modify?: boolean }) => {
-      if (packages.length === 0) {
-        program.help();
-        return;
-      }
+  program
+    .name("opensrc")
+    .description(
+      "Fetch source code for packages to give coding agents deeper context",
+    )
+    .version(pkg.version)
+    .enablePositionalOptions();
 
-      await fetchCommand(packages, {
+  // Default command: fetch packages
+  program
+    .argument(
+      "[packages...]",
+      "packages or repos to fetch (e.g., zod, pypi:requests, crates:serde, owner/repo)",
+    )
+    .option("--cwd <path>", "working directory (default: current directory)")
+    .option(
+      "--modify [value]",
+      "allow/deny modifying .gitignore, tsconfig.json, AGENTS.md",
+      (val) => {
+        if (val === undefined || val === "" || val === "true") return true;
+        if (val === "false") return false;
+        return true;
+      },
+    )
+    .action(
+      async (
+        packages: string[],
+        options: { cwd?: string; modify?: boolean },
+      ) => {
+        if (packages.length === 0) {
+          program.help();
+          return;
+        }
+
+        await fetchCommand(packages, {
+          cwd: options.cwd,
+          allowModifications: options.modify,
+        });
+      },
+    );
+
+  // List command
+  program
+    .command("list")
+    .description("List all fetched package sources")
+    .option("--json", "output as JSON")
+    .option("--cwd <path>", "working directory (default: current directory)")
+    .action(async (options: { json?: boolean; cwd?: string }) => {
+      await listCommand({
+        json: options.json,
         cwd: options.cwd,
-        allowModifications: options.modify,
       });
-    },
-  );
-
-// List command
-program
-  .command("list")
-  .description("List all fetched package sources")
-  .option("--json", "output as JSON")
-  .option("--cwd <path>", "working directory (default: current directory)")
-  .action(async (options: { json?: boolean; cwd?: string }) => {
-    await listCommand({
-      json: options.json,
-      cwd: options.cwd,
     });
-  });
 
-// Remove command
-program
-  .command("remove <packages...>")
-  .alias("rm")
-  .description("Remove fetched source code for packages or repos")
-  .option("--cwd <path>", "working directory (default: current directory)")
-  .action(async (packages: string[], options: { cwd?: string }) => {
-    await removeCommand(packages, {
-      cwd: options.cwd,
+  // Remove command
+  program
+    .command("remove <packages...>")
+    .alias("rm")
+    .description("Remove fetched source code for packages or repos")
+    .option("--cwd <path>", "working directory (default: current directory)")
+    .action(async (packages: string[], options: { cwd?: string }) => {
+      await removeCommand(packages, {
+        cwd: options.cwd,
+      });
     });
-  });
 
-// Clean command
-program
-  .command("clean")
-  .description("Remove all fetched packages and/or repos")
-  .option("--packages", "only remove packages (all registries)")
-  .option("--repos", "only remove repos")
-  .option("--npm", "only remove npm packages")
-  .option("--pypi", "only remove PyPI packages")
-  .option("--crates", "only remove crates.io packages")
-  .option("--cwd <path>", "working directory (default: current directory)")
-  .action(
-    async (options: {
-      packages?: boolean;
-      repos?: boolean;
-      npm?: boolean;
-      pypi?: boolean;
-      crates?: boolean;
-      cwd?: string;
-    }) => {
-      // Determine registry from flags
-      let registry: Registry | undefined;
-      if (options.npm) re
```

**File**: `src/lib/agents.test.ts` (modified, +25/-0)
```diff
@@ -263,6 +263,31 @@ describe("updateAgentsMd", () => {
 
     expect(existsSync(AGENTS_FILE)).toBe(false);
   });
+
+  it("removes opensrc section from AGENTS.md when sources become empty", async () => {
+    const pkg = {
+      name: "zod",
+      version: "3.22.0",
+      registry: "npm" as const,
+      path: "repos/github.com/colinhacks/zod",
+      fetchedAt: "2024-01-01T00:00:00.000Z",
+    };
+
+    await updateAgentsMd({ packages: [pkg], repos: [] }, TEST_DIR);
+    expect(existsSync(AGENTS_FILE)).toBe(true);
+    const contentBefore = await readFile(AGENTS_FILE, "utf-8");
+    expect(contentBefore).toContain(SECTION_MARKER);
+
+    const result = await updateAgentsMd(
+      { packages: [], repos: [] },
+      TEST_DIR,
+    );
+    expect(result).toBe(true);
+
+    const contentAfter = await readFile(AGENTS_FILE, "utf-8");
+    expect(contentAfter).not.toContain(SECTION_MARKER);
+    expect(contentAfter).not.toContain(SECTION_END_MARKER);
+  });
 });
 
 describe("removeOpensrcSection", () => {
```

**File**: `src/lib/agents.ts` (modified, +1/-2)
```diff
@@ -208,12 +208,11 @@ export async function updateAgentsMd(
   // Always update the index file
   await updatePackageIndex(sources, cwd);
 
-  // Add or update section in AGENTS.md if there are sources
   if (sources.packages.length > 0 || sources.repos.length > 0) {
     return ensureAgentsMd(cwd);
   }
 
-  return false;
+  return removeOpensrcSection(cwd);
 }
 
 /**
```

---

### Incident Patch 8: `68ecf1fb` (2026-02-24)
**Commit Message**: Fix --cwd on subcommands, AGENTS.md cleanup, and stale CLI version

**File**: `src/index.ts` (modified, +6/-1)
```diff
@@ -1,20 +1,25 @@
 #!/usr/bin/env node
 
+import { createRequire } from "node:module";
 import { Command } from "commander";
 import { fetchCommand } from "./commands/fetch.js";
 import { listCommand } from "./commands/list.js";
 import { removeCommand } from "./commands/remove.js";
 import { cleanCommand } from "./commands/clean.js";
 import type { Registry } from "./types.js";
 
+const require = createRequire(import.meta.url);
+const pkg = require("../package.json") as { version: string };
+
 const program = new Command();
 
 program
   .name("opensrc")
   .description(
     "Fetch source code for packages to give coding agents deeper context",
   )
-  .version("0.1.0");
+  .version(pkg.version)
+  .enablePositionalOptions();
 
 // Default command: fetch packages
 program
```

**File**: `src/lib/agents.test.ts` (modified, +25/-0)
```diff
@@ -263,6 +263,31 @@ describe("updateAgentsMd", () => {
 
     expect(existsSync(AGENTS_FILE)).toBe(false);
   });
+
+  it("removes opensrc section from AGENTS.md when sources become empty", async () => {
+    const pkg = {
+      name: "zod",
+      version: "3.22.0",
+      registry: "npm" as const,
+      path: "repos/github.com/colinhacks/zod",
+      fetchedAt: "2024-01-01T00:00:00.000Z",
+    };
+
+    await updateAgentsMd({ packages: [pkg], repos: [] }, TEST_DIR);
+    expect(existsSync(AGENTS_FILE)).toBe(true);
+    const contentBefore = await readFile(AGENTS_FILE, "utf-8");
+    expect(contentBefore).toContain(SECTION_MARKER);
+
+    const result = await updateAgentsMd(
+      { packages: [], repos: [] },
+      TEST_DIR,
+    );
+    expect(result).toBe(true);
+
+    const contentAfter = await readFile(AGENTS_FILE, "utf-8");
+    expect(contentAfter).not.toContain(SECTION_MARKER);
+    expect(contentAfter).not.toContain(SECTION_END_MARKER);
+  });
 });
 
 describe("removeOpensrcSection", () => {
```

**File**: `src/lib/agents.ts` (modified, +1/-2)
```diff
@@ -208,12 +208,11 @@ export async function updateAgentsMd(
   // Always update the index file
   await updatePackageIndex(sources, cwd);
 
-  // Add or update section in AGENTS.md if there are sources
   if (sources.packages.length > 0 || sources.repos.length > 0) {
     return ensureAgentsMd(cwd);
   }
 
-  return false;
+  return removeOpensrcSection(cwd);
 }
 
 /**
```

---

### Incident Patch 9: `95fa8c75` (2026-01-26)
**Commit Message**: Merge pull request #8 from vercel-labs/fix/issue-6-1769438383340

fix: respect allowFileModifications setting in remove command

**File**: `src/commands/remove.ts` (modified, +22/-10)
```diff
@@ -7,10 +7,12 @@ import {
 } from "../lib/git.js";
 import {
   updateAgentsMd,
+  updatePackageIndex,
   type PackageEntry,
   type RepoEntry,
 } from "../lib/agents.js";
 import { isRepoSpec } from "../lib/repo.js";
+import { getFileModificationPermission } from "../lib/settings.js";
 import { detectRegistry } from "../lib/registries/index.js";
 import type { Registry } from "../types.js";
 
@@ -130,17 +132,27 @@ export async function removeCommand(
       (r) => !removedRepos.includes(r.name),
     );
 
-    const agentsUpdated = await updateAgentsMd(
-      { packages: remainingPackages, repos: remainingRepos },
-      cwd,
-    );
-    if (agentsUpdated) {
-      const totalRemaining = remainingPackages.length + remainingRepos.length;
-      if (totalRemaining === 0) {
-        console.log("✓ Removed opensrc section from AGENTS.md");
-      } else {
-        console.log("✓ Updated AGENTS.md");
+    // Check if file modifications are allowed
+    const canModifyFiles = await getFileModificationPermission(cwd);
+
+    if (canModifyFiles) {
+      const agentsUpdated = await updateAgentsMd(
+        { packages: remainingPackages, repos: remainingRepos },
+        cwd,
+      );
+      if (agentsUpdated) {
+        const totalRemaining = remainingPackages.length + remainingRepos.length;
+        if (totalRemaining === 0) {
+          console.log("✓ Removed opensrc section from AGENTS.md");
+        } else {
+          console.log("✓ Updated AGENTS.md");
+        }
       }
+    } else {
+      await updatePackageIndex(
+        { packages: remainingPackages, repos: remainingRepos },
+        cwd,
+      );
     }
   }
 }
```

---

### Incident Patch 10: `14658bf9` (2026-01-26)
**Commit Message**: fix: respect allowFileModifications setting in remove command

## Summary

The remove command was not respecting the `allowFileModifications` setting in `opensrc/package.json`, causing it to always update AGENTS.md even when file modifications were disabled. This fix aligns the remove command's behavior with the fetch command.

## Changes

- Added import for `getFileModificationPermission` from settings module
- Added import for `updatePackageIndex` from agents module
- Added permission check before updating AGENTS.md
- When file modifications are disabled, only update the package index instead of AGENTS.md
- Preserved existing console output behavior when file modifications are allowed

Fixes #6

**File**: `src/commands/remove.ts` (modified, +22/-10)
```diff
@@ -7,10 +7,12 @@ import {
 } from "../lib/git.js";
 import {
   updateAgentsMd,
+  updatePackageIndex,
   type PackageEntry,
   type RepoEntry,
 } from "../lib/agents.js";
 import { isRepoSpec } from "../lib/repo.js";
+import { getFileModificationPermission } from "../lib/settings.js";
 import { detectRegistry } from "../lib/registries/index.js";
 import type { Registry } from "../types.js";
 
@@ -130,17 +132,27 @@ export async function removeCommand(
       (r) => !removedRepos.includes(r.name),
     );
 
-    const agentsUpdated = await updateAgentsMd(
-      { packages: remainingPackages, repos: remainingRepos },
-      cwd,
-    );
-    if (agentsUpdated) {
-      const totalRemaining = remainingPackages.length + remainingRepos.length;
-      if (totalRemaining === 0) {
-        console.log("✓ Removed opensrc section from AGENTS.md");
-      } else {
-        console.log("✓ Updated AGENTS.md");
+    // Check if file modifications are allowed
+    const canModifyFiles = await getFileModificationPermission(cwd);
+
+    if (canModifyFiles) {
+      const agentsUpdated = await updateAgentsMd(
+        { packages: remainingPackages, repos: remainingRepos },
+        cwd,
+      );
+      if (agentsUpdated) {
+        const totalRemaining = remainingPackages.length + remainingRepos.length;
+        if (totalRemaining === 0) {
+          console.log("✓ Removed opensrc section from AGENTS.md");
+        } else {
+          console.log("✓ Updated AGENTS.md");
+        }
       }
+    } else {
+      await updatePackageIndex(
+        { packages: remainingPackages, repos: remainingRepos },
+        cwd,
+      );
     }
   }
 }
```

---

### Incident Patch 11: `5b3d22a9` (2026-01-07)
**Commit Message**: fix repo

**File**: `package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   ],
   "repository": {
     "type": "git",
-    "url": "https://github.com/ctate/opensrc"
+    "url": "https://github.com/vercel-labs/opensrc"
   },
   "scripts": {
     "build": "tsc",
```

**File**: `src/lib/registries/crates.ts` (modified, +2/-2)
```diff
@@ -55,7 +55,7 @@ async function fetchCrateInfo(crateName: string): Promise<CrateResponse> {
   const response = await fetch(url, {
     headers: {
       Accept: "application/json",
-      "User-Agent": "opensrc-cli (https://github.com/opensrc-labs/opensrc)",
+      "User-Agent": "opensrc-cli (https://github.com/vercel-labs/opensrc)",
     },
   });
 
@@ -83,7 +83,7 @@ async function fetchCrateVersionInfo(
   const response = await fetch(url, {
     headers: {
       Accept: "application/json",
-      "User-Agent": "opensrc-cli (https://github.com/opensrc-labs/opensrc)",
+      "User-Agent": "opensrc-cli (https://github.com/vercel-labs/opensrc)",
     },
   });
 
```

---

### Incident Patch 12: `781db016` (2026-01-06)
**Commit Message**: fix bugs

**File**: `src/lib/version.ts` (modified, +3/-2)
```diff
@@ -97,9 +97,10 @@ async function getVersionFromPnpmLock(
     const content = await readFile(lockPath, 'utf-8');
     
     // Look for the package in the lockfile
-    // Format varies but typically: '/packageName@version:' or 'packageName@version:'
+    // pnpm format: 'packageName@version(peer-deps):' or 'packageName@version:'
+    // We need to stop at '(' (peer deps), ':' (end of key), or quotes
     const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
-    const regex = new RegExp(`['"]?${escapedName}@([^:'"\n]+)`, 'g');
+    const regex = new RegExp(`['"]?${escapedName}@([^(':"\\s]+)`, 'g');
     const matches = [...content.matchAll(regex)];
     
     if (matches.length > 0) {
```

---

### Incident Patch 13: `c55582ae` (2026-01-06)
**Commit Message**: fix marker

**File**: `AGENTS.md` (modified, +2/-2)
```diff
@@ -2,10 +2,10 @@
 
 Instructions for AI coding agents working with this codebase.
 
-## Source Code Reference
-
 <!-- opensrc:start -->
 
+## Source Code Reference
+
 Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.
 
 See `opensrc/sources.json` for the list of available packages and their versions.
```

**File**: `src/lib/agents.ts` (modified, +3/-3)
```diff
@@ -13,10 +13,10 @@ const SECTION_END_MARKER = '<!-- opensrc:end -->';
  * The static AGENTS.md section that points to the index file
  */
 const STATIC_SECTION = `
-${SECTION_START}
-
 ${SECTION_MARKER}
 
+${SECTION_START}
+
 Source code for dependencies is available in \`opensrc/\` for deeper understanding of implementation details.
 
 See \`opensrc/sources.json\` for the list of available packages and their versions.
@@ -156,7 +156,7 @@ export async function removeOpensrcSection(cwd: string = process.cwd()): Promise
       return false;
     }
 
-    const startIdx = content.indexOf(SECTION_START);
+    const startIdx = content.indexOf(SECTION_MARKER);
     const endIdx = content.indexOf(SECTION_END_MARKER);
 
     if (startIdx === -1 || endIdx === -1) {
```

#### Recent Merged Pull Requests:
- **PR #70** (2026-09-16): Add Labs status badges to README (@Railly)
- **PR #69** (closed): feat(cli): support project-local source cache (@mikemikimike)
- **PR #68** (2026-06-23): Configure trusted npm publishing (@ctate)
- **PR #67** (2026-06-23): Prepare v0.7.3 release (@ctate)
- **PR #66** (2026-06-23): Fix authenticated clone host validation (@ctate)
- **PR #58** (closed): feat(cli): add local cache option (@EfeDurmaz16)
- **PR #56** (2026-04-30): Document fetch command, fix search index, add type-check CI, structured error handling (@ctate)
- **PR #55** (closed): Document fetch command, fix search index, add type-check CI, structured error handling (@ctate)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
