# Forensic Learning Record (Deep Inspection): vercel-labs/opensrc

> **Canonical Artifact**: `07_PROJECT_LEARNING/vercel-labs-opensrc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vercel-labs/opensrc](https://github.com/vercel-labs/opensrc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:42:29.453Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vercel-labs/opensrc`
- **Description**: Fetch source code for npm packages to give AI coding agents deeper context
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3005 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `packages/opensrc/cli/src/commands/clean.rs`
```
use std::fs;

use crate::core::cache::{
    cleanup_empty_dirs, extract_repo_base_path, get_opensrc_dir, get_repos_dir, list_sources,
    write_sources, PackageEntry, RepoEntry,
};
use crate::core::error::{Error, Result};
use crate::core::registries::Registry;

pub fn run(
    clean_packages_flag: bool,
    clean_repos_flag: bool,
    registry: Option<Registry>,
) -> Result<()> {
    let clean_packages = clean_packages_flag || !clean_repos_flag;
    let clean_repos = clean_repos_flag || (!clean_packages_flag && registry.is_none());

    let (packages, repos) = list_sources()?;

    let mut remaining_packages: Vec<PackageEntry> = packages.clone();
    let mut remaining_repos: Vec<RepoEntry> = repos.clone();

    let mut packages_to_remove: Vec<PackageEntry> = Vec::new();
    let mut packages_removed = 0usize;

    if clean_packages {
        if let Some(reg) = registry {
            packages_to_remove = packages
                .iter()
                .filter(|p| p.registry == reg)
                .cloned()
                .collect();
            remaining_packages = packages
                .iter()
                .filter(|p| p.registry != reg)
                .cloned()
                .collect();
        } else {
            packages_to_remove = packages.clone();
            remaining_packages = Vec::new();
        }
        packages_removed = packages_to_remove.len();
    }

    let mut repos_to_remove: Vec<RepoEntry> = Vec::new();
    let mut repos_removed = 0usize;

    if clean_repos {
        repos_to_remove = repos.clone();
        remaining_repos = Vec::new();
        repos_removed = repos_to_remove.len();
    }

    // Determine which on-disk paths to remove
    let pkg_paths: std::collections::HashSet<String> = packages_to_remove
        .iter()
        .map(|p| extract_repo_base_path(&p.path))
        .collect();
    let repo_paths: std::collections::HashSet<String> =
        repos_to_remove.iter().map(|r| r.path.clone()).collect();
    let needed_paths: std::collections::HashSet<String> = remaining_packages
        .iter()
        .map(|p| extract_repo_base_path(&p.path))
        .collect();

    let all_paths: std::collections::HashSet<String> =
        pkg_paths.union(&repo_paths).cloned().collect();
    let opensrc_dir = get_opensrc_dir()?;

    let mut delete_errors = 0usize;
    for repo_path in &all_paths {
        if !needed_paths.contains(repo_path) {
            let full = opensrc_dir.join(repo_path);
            if full.exists() {
                if let Err(e) = fs::remove_dir_all(&full) {
                    eprintln!("Warning: failed to remove {}: {e}", full.display());
                    delete_errors += 1;
                }
            }
        }
    }

    let repos_dir = get_repos_dir()?;
    if repos_dir.exists() {
        cleanup_empty_dirs(&repos_dir);
    }

    if clean_packages {
        if let Some(reg) = registry {
            println!("✓ Removed {packages_removed} {} package(s)", reg.label());
        } else if packages_removed > 0 {
            println!("✓ Removed {packages_removed} package(s)");
        } else {
            println!("No packages to remove");
        }
    }

    if clean_repos {
        if repos_removed > 0 {
            println!("✓ Removed {repos_removed} repo(s)");
        } else {
            println!("No repos to remove");
        }
    }

    let total = packages_removed + repos_removed;

    if total > 0 {
        write_sources(remaining_packages, remaining_repos)?;
    }

    println!("\nCleaned {total} source(s)");

    if delete_errors > 0 {
        return Err(Error::Other(format!(
            "Failed to remove {delete_errors} path(s) from disk"
        )));
    }

    Ok(())
}

```

### Core Architecture Module: `packages/opensrc/cli/src/commands/fetch.rs`
```
use crate::core::error::{Error, Result};
use crate::core::fetcher::ensure_cached;

pub fn run(specs: &[String], cwd: Option<&str>, quiet: bool) -> Result<()> {
    let cwd = cwd.unwrap_or(".");

    let mut fetched = 0u32;
    let mut cached = 0u32;
    let mut had_errors = false;

    for spec in specs {
        match ensure_cached(spec, cwd, !quiet) {
            Ok(outcome) => {
                if outcome.from_cache {
                    cached += 1;
                    if !quiet {
                        println!(
                            "  ✓ {}@{} already cached ({})",
                            outcome.name,
                            outcome.version,
                            outcome.path.display()
                        );
                    }
                } else {
                    fetched += 1;
                    if !quiet {
                        if let Some(warn) = &outcome.warning {
                            println!("  ⚠ {warn}");
                        }
                        println!(
                            "  ✓ Fetched {}@{} from {} ({})",
                            outcome.name,
                            outcome.version,
                            outcome.source_label,
                            outcome.path.display()
                        );
                    }
                }
            }
            Err(e) => {
                had_errors = true;
                eprintln!("  ✗ {spec}: {e}");
            }
        }
    }

    if !quiet {
        let mut parts = Vec::new();
        if fetched > 0 {
            parts.push(format!("{fetched} fetched"));
        }
        if cached > 0 {
            parts.push(format!("{cached} already cached"));
        }
        if !parts.is_empty() {
            println!("\n{}", parts.join(", "));
        }
    }

    if had_errors {
        return Err(Error::Other(
            "Some sources could not be fetched".to_string(),
        ));
    }

    Ok(())
}

```

### Core Architecture Module: `packages/opensrc/cli/src/commands/list.rs`
```
use crate::core::cache::{get_absolute_path, list_sources};
use crate::core::error::Result;
use crate::core::registries::Registry;

pub fn run(json: bool) -> Result<()> {
    let (packages, repos) = list_sources()?;
    let total = packages.len() + repos.len();

    if total == 0 {
        println!("No sources cached yet.");
        println!("\nUse `opensrc fetch <package>` to cache source code for a package.");
        println!("Use `opensrc fetch <owner>/<repo>` to cache a GitHub repository.");
        println!("\nSupported registries:");
        println!("  • npm:      opensrc fetch zod, opensrc fetch npm:react");
        println!("  • PyPI:     opensrc fetch pypi:requests");
        println!("  • crates:   opensrc fetch crates:serde");
        return Ok(());
    }

    if json {
        let index = crate::core::cache::read_sources()?;
        println!("{}", serde_json::to_string_pretty(&index)?);
        return Ok(());
    }

    let registries = [Registry::Npm, Registry::PyPI, Registry::Crates];
    let mut displayed_packages = false;

    for registry in &registries {
        let pkgs: Vec<_> = packages
            .iter()
            .filter(|p| p.registry == *registry)
            .collect();
        if pkgs.is_empty() {
            continue;
        }

        if displayed_packages {
            println!();
        }

        println!("{} Packages:\n", registry.label());
        displayed_packages = true;

        for pkg in &pkgs {
            let date = format_date(&pkg.fetched_at);
            println!("  {}@{}", pkg.name, pkg.version);
            println!("    Path: {}", get_absolute_path(&pkg.path)?.display());
            println!("    Fetched: {date}");
            println!();
        }
    }

    if !repos.is_empty() {
        if displayed_packages {
            println!();
        }
        println!("Repositories:\n");

        for repo in &repos {
            let date = format_date(&repo.fetched_at);
            println!("  {}@{}", repo.name, repo.version);
            println!("    Path: {}", get_absolute_path(&repo.path)?.display());
            println!("    Fetched: {date}");
            println!();
        }
    }

    // Summary
    let mut parts = Vec::new();
    let mut registry_parts = Vec::new();
    for registry in &registries {
        let count = packages.iter().filter(|p| p.registry == *registry).count();
        if count > 0 {
            registry_parts.push(format!("{count} {}", registry.label()));
        }
    }

    if !packages.is_empty() {
        if registry_parts.is_empty() {
            parts.push(format!("{} package(s)", packages.len()));
        } else {
            parts.push(format!(
                "{} package(s) ({})",
                packages.len(),
                registry_parts.join(", ")
            ));
        }
    }

    if !repos.is_empty() {
        parts.push(format!("{} repo(s)", repos.len()));
    }

    println!("Total: {}", parts.join(", "));

    Ok(())
}

fn format_date(iso: &str) -> String {
    chrono::DateTime::parse_from_rfc3339(iso)
        .map(|dt| dt.format("%b %d, %Y").to_string())
        .unwrap_or_else(|_| iso.to_string())
}

```

### Core Architecture Module: `packages/opensrc/cli/src/commands/mod.rs`
```
pub mod clean;
pub mod fetch;
pub mod list;
pub mod path;
pub mod remove;

```

### Core Architecture Module: `packages/opensrc/cli/src/commands/path.rs`
```
use crate::core::error::Result;
use crate::core::fetcher::ensure_cached;

pub fn run(specs: &[String], cwd: Option<&str>, verbose: bool) -> Result<()> {
    let cwd = cwd.unwrap_or(".");
    for spec in specs {
        let outcome = ensure_cached(spec, cwd, verbose)?;
        println!("{}", outcome.path.display());
    }
    Ok(())
}

```

### Core Architecture Module: `packages/opensrc/cli/src/commands/remove.rs`
```
use crate::core::cache::{
    get_package_info, list_sources, remove_package_source, remove_repo_source, write_sources,
};
use crate::core::error::{Error, Result};
use crate::core::registries::repo::{is_repo_spec, parse_repo_spec};
use crate::core::registries::{detect_registry, Registry};

pub fn run(items: &[String]) -> Result<()> {
    let mut removed = 0u32;
    let mut not_found = 0u32;
    let mut had_errors = false;

    let mut removed_packages: Vec<(String, Registry)> = Vec::new();
    let mut removed_repos: Vec<String> = Vec::new();

    for item in items {
        let is_repo = is_repo_spec(item) || (item.contains('/') && !item.contains(':'));

        if is_repo {
            let display_name = match parse_repo_spec(item) {
                Some(spec) => format!("{}/{}/{}", spec.host, spec.owner, spec.repo),
                None => {
                    println!("  ✗ Could not parse repo spec: {item}");
                    had_errors = true;
                    continue;
                }
            };

            match remove_repo_source(&display_name, None) {
                Ok(true) => {
                    println!("  ✓ Removed {display_name}");
                    removed += 1;
                    removed_repos.push(display_name);
                }
                Ok(false) => {
                    println!("  ⚠ {item} not found");
                    not_found += 1;
                }
                Err(e) => {
                    println!("  ✗ Error removing {item}: {e}");
                    had_errors = true;
                }
            }
        } else {
            let detected = detect_registry(item);
            let clean = &detected.clean_spec;
            let mut registry = detected.registry;

            let mut pkg_info = get_package_info(clean, registry)?;

            if pkg_info.is_none() {
                let registries = [Registry::Npm, Registry::PyPI, Registry::Crates];
                for reg in &registries {
                    if *reg != registry {
                        if let Some(info) = get_package_info(clean, *reg)? {
                            pkg_info = Some(info);
                            registry = *reg;
                            break;
                        }
                    }
                }
            }

            if pkg_info.is_none() {
                println!("  ⚠ {clean} not found");
                not_found += 1;
                continue;
            }

            match remove_package_source(clean, registry) {
                Ok((true, repo_removed)) => {
                    println!("  ✓ Removed {clean} ({registry})");
                    if repo_removed {
                        println!("    → Also removed repo (no other packages use it)");
                    }
                    removed += 1;
                    removed_packages.push((clean.clone(), registry));
                }
                Ok((false, _)) => {
                    println!("  ✗ Failed to remove {clean}");
                    had_errors = true;
                }
                Err(e) => {
                    println!("  ✗ Error removing {clean}: {e}");
                    had_errors = true;
                }
            }
        }
    }

    let nf_msg = if not_found > 0 {
        format!(", {not_found} not found")
    } else {
        String::new()
    };
    println!("\nRemoved {removed} source(s){nf_msg}");

    if removed > 0 {
        let (packages, repos) = list_sources()?;

        let remaining_packages: Vec<_> = packages
            .into_iter()
            .filter(|p| {
                !removed_packages
                    .iter()
                    .any(|(name, reg)| p.name == *name && p.registry == *reg)
            })
            .collect();

        let remaining_repos: Vec<_> = repos
            .into_iter()
            .filter(|r| !removed_repos.contains(&r.name))
            .collect();

        write_sources(remaining_packages, remaining_repos)?;
    }

    if had_errors {
        return Err(Error::Other("Some items could not be removed".to_string()));
    }

    Ok(())
}

```

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
    if let Ok(entries
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
+    .description("Remove fetched source code for packages or re
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
