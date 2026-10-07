# Forensic Learning Record (Deep Inspection): tauri-apps/tauri

> **Canonical Artifact**: `07_PROJECT_LEARNING/tauri-apps-tauri-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tauri-apps/tauri](https://github.com/tauri-apps/tauri))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:19:45.704Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tauri-apps/tauri`
- **Description**: Build smaller, faster, and more secure desktop and mobile applications with a web frontend.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 111647 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/src/utils.rs`
```
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Utility functions for benchmarking tasks in the Tauri project.
//!
//! This module provides helpers for:
//! - Paths to project directories and targets
//! - Running and collecting process outputs
//! - Parsing memory profiler (`mprof`) and syscall profiler (`strace`) outputs
//! - JSON read/write utilities
//! - File download utilities (via `curl` or file copy)

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
  collections::HashMap,
  fs,
  io::{BufRead, BufReader},
  path::{Path, PathBuf},
  process::{Command, Output, Stdio},
};

/// Holds the results of a benchmark run.
#[derive(Default, Clone, Serialize, Deserialize, Debug)]
pub struct BenchResult {
  pub created_at: String,
  pub sha1: String,
  pub exec_time: HashMap<String, HashMap<String, f64>>,
  pub binary_size: HashMap<String, u64>,
  pub max_memory: HashMap<String, u64>,
  pub thread_count: HashMap<String, u64>,
  pub syscall_count: HashMap<String, u64>,
  pub cargo_deps: HashMap<String, usize>,
}

/// Represents a single line of parsed `strace` output.
#[derive(Debug, Clone, Serialize)]
pub struct StraceOutput {
  pub percent_time: f64,
  pub seconds: f64,
  pub usecs_per_call: Option<u64>,
  pub calls: u64,
  pub errors: u64,
}

/// Get the compilation target triple for the current platform.
pub fn get_target() -> &'static str {
  #[cfg(target_os = "macos")]
  return if cfg!(target_arch = "aarch64") {
    "aarch64-apple-darwin"
  } else {
    "x86_64-apple-darwin"
  };

  #[cfg(target_os = "ios")]
  return if cfg!(target_arch = "aarch64") {
    "aarch64-apple-ios"
  } else {
    "x86_64-apple-ios"
  };

  #[cfg(target_os = "linux")]
  return "x86_64-unknown-linux-gnu";

  #[cfg(target_os = "windows")]
  return "x86_64-pc-windows-msvc";
}

/// Get the `target/release` directory path for benchmarks.
pub fn target_dir() -> PathBuf {
  bench_root_path()
    .join("..")
    .join("target")
    .join(get_target())
    .join("release")
}

/// Get the root path of the current benchmark crate.
pub fn bench_root_path() -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// Get the home directory of the current user.
pub fn home_path() -> PathBuf {
  #[cfg(any(target_os = "macos", target_os = "ios", target_os = "linux"))]
  {
    PathBuf::from(std::env::var("HOME").unwrap_or_default())
  }

  #[cfg(target_os = "windows")]
  {
    PathBuf::from(std::env::var("USERPROFILE").unwrap_or_default())
  }
}

/// Get the root path of the Tauri repository.
pub fn tauri_root_path() -> PathBuf {
  bench_root_path().parent().map(|p| p.to_path_buf()).unwrap()
}

/// Run a command and collect its stdout and stderr as strings.
/// Returns an error if the command fails or exits with a non-zero status.
pub fn run_collect(cmd: &[&str]) -> Result<(String, String)> {
  let output: Output = Command::new(cmd[0])
    .args(&cmd[1..])
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .output()
    .with_context(|| format!("failed to execute command: {cmd:?}"))?;

  if !output.status.success() {
    bail!(
      "Command {:?} exited with {:?}\nstdout:\n{}\nstderr:\n{}",
      cmd,
      output.status.code(),
      String::from_utf8_lossy(&output.stdout),
      String::from_utf8_lossy(&output.stderr)
    );
  }

  Ok((
    String::from_utf8_lossy(&output.stdout).to_string(),
    String::from_utf8_lossy(&output.stderr).to_string(),
  ))
}

/// Parse a memory profiler (`mprof`) output file and return the maximum
/// memory usage in bytes. Returns `None` if no values are found.
pub fn parse_max_mem(file_path: &str) -> Result<Option<u64>> {
  let file = fs::File::open(file_path)
    .with_context(|| format!("failed to open mprof output file {file_path}"))?;
  let output = BufReader::new(file);

  let mut highest: u64 = 0;

  for line in output.lines().map_while(Result::ok) {
    let split: Vec<&str> = line.split(' ').collect();
    if split.len() == 3 {
      if let Ok(mb) = split[1].parse::<f64>() {
        let current_bytes = (mb * 1024.0 * 1024.0) as u64;
        highest = highest.max(current_bytes);
      }
    }
  }

  // Best-effort cleanup
  let _ = fs::remove_file(file_path);

  Ok(if highest > 0 { Some(highest) } else { None })
}

/// Parse the output of `strace -c` and return a summary of syscalls.
pub fn parse_strace_output(output: &str) -> HashMap<String, StraceOutput> {
  let mut summary = HashMap::new();

  let mut lines = output
    .lines()
    .filter(|line| !line.is_empty() && !line.contains("detached ..."));

  let count = lines.clone().count();
  if count < 4 {
    return summary;
  }

  let total_line = lines.next_back().unwrap();
  lines.next_back(); // Drop separator
  let data_lines = lines.skip(2);

  for line in data_lines {
    let syscall_fields: Vec<&str> = line.split_whitespace().collect();
    let len = syscall_fields.len();

    if let Some(&syscall_name) = syscall_fields.last() {
      if (5..=6).contains(&len) {
        let output = StraceOutput {
          percent_time: syscall_fields[0].parse().unwrap_or(0.0),
          seconds: syscall_fields[1].parse().unwrap_or(0.0),
          usecs_per_call: syscall_fields[2].parse().ok(),
          calls: syscall_fields[3].parse().unwrap_or(0),
          errors: if len < 6 {
            0
          } else {
            syscall_fields[4].parse().unwrap_or(0)
          },
        };
        summary.insert(syscall_name.to_string(), output);
      }
    }
  }

  let total_fields: Vec<&str> = total_line.split_whitespace().collect();
  let total = match total_fields.len() {
    5 => StraceOutput {
      percent_time: total_fields[0].parse().unwrap_or(0.0),
      seconds: total_fields[1].parse().unwrap_or(0.0),
      usecs_per_call: None,
      calls: total_fields[2].parse().unwrap_or(0),
      errors: total_fields[3].parse().unwrap_or(0),
    },
    6 => StraceOutput {
      percent_time: total_fields[0].parse().unwrap_or(0.0),
      seconds: total_fields[1].parse().unwrap_or(0.0),
      usecs_per_call: total_fields[2].parse().ok(),
      calls: total_fields[3].parse().unwrap_or(0),
      errors: total_fields[4].parse().unwrap_or(0),
    },
    _ => {
      panic!("Unexpected total field count: {}", total_fields.len());
    }
  };

  summary.insert("total".to_string(), total);
  summary
}

/// Run a command and wait for completion.
/// Returns an error if the command fails.
pub fn run(cmd: &[&str]) -> Result<()> {
  let status = Command::new(cmd[0])
    .args(&cmd[1..])
    .stdin(Stdio::piped())
    .status()
    .with_context(|| format!("failed to execute command: {cmd:?}"))?;

  if !status.success() {
    bail!("Command {:?} exited with {:?}", cmd, status.code());
  }
  Ok(())
}

/// Read a JSON file into a [`serde_json::Value`].
pub fn read_json(filename: &str) -> Result<Value> {
  let f =
    fs::File::open(filename).with_context(|| format!("failed to open JSON file {filename}"))?;
  Ok(serde_json::from_reader(f)?)
}

/// Write a [`serde_json::Value`] into a JSON file.
pub fn write_json(filename: &Path, value: &Value) -> Result<()> {
  let f = fs::File::create(filename)
    .with_context(|| format!("failed to create JSON file {}", filename.display()))?;
  serde_json::to_writer(f, value)?;
  Ok(())
}

/// Download a file from either a local path or an HTTP/HTTPS URL.
/// Falls back to copying the file if the URL does not start with http/https.
pub fn download_file(url: &str, filename: PathBuf) -> Result<()> {
  if !url.starts_with("http:") && !url.starts_with("https:") {
    fs::copy(url, &filename).with_context(|| format!("failed to copy from {url}"))?;
    return Ok(());
  }

  println!("Downloading {url}");
  let status = Command::new("curl")
    .arg("-L")
    .arg("-s")
    .arg("-o")
    .arg(&filename)
    .arg(url)
    .status()
    .with_context(|| format!("failed to execute curl for {url}"))?;

  if !status.success() {
    bail!("curl failed with exit code {:?}", status.code());
  }
  if !filename.exists() {
    bail!("expected file {:?} to exist after download", filename);
  }

  Ok(())
}

```

### Core Architecture Module: `crates/tauri-bundler/src/bundle/windows/util.rs`
```
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

#[cfg(windows)]
use std::io::Write;
#[cfg(windows)]
use std::process::Command;
use std::{
  fs,
  path::{Path, PathBuf},
};
use ureq::ResponseExt;

use crate::bundle::settings::Arch;
use crate::utils::http_utils::{base_ureq_agent, download};

pub const WEBVIEW2_BOOTSTRAPPER_URL: &str = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
pub const WEBVIEW2_OFFLINE_INSTALLER_X86_URL: &str =
  "https://go.microsoft.com/fwlink/?linkid=2099617";
pub const WEBVIEW2_OFFLINE_INSTALLER_X64_URL: &str =
  "https://go.microsoft.com/fwlink/?linkid=2124701";
pub const WEBVIEW2_URL_PREFIX: &str =
  "https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/";
pub const NSIS_OUTPUT_FOLDER_NAME: &str = "nsis";
pub const NSIS_UPDATER_OUTPUT_FOLDER_NAME: &str = "nsis-updater";
pub const WIX_OUTPUT_FOLDER_NAME: &str = "msi";
pub const WIX_UPDATER_OUTPUT_FOLDER_NAME: &str = "msi-updater";

#[cfg(windows)]
const VSWHERE: &[u8] = include_bytes!("vswhere.exe");
const VCTOOLS_REDIST_DIR_ENV_VAR: &str = "VCTOOLS_REDIST_DIR";
#[cfg(windows)]
const VC_REDIST_COMPONENT: &str = "Microsoft.VisualStudio.Component.VC.Redist.14.Latest";

pub fn webview2_guid_path(url: &str) -> crate::Result<(String, String)> {
  let agent = base_ureq_agent();
  let response = agent.head(url).call().map_err(Box::new)?;
  let final_url = response.get_uri().to_string();
  let remaining_url = final_url.strip_prefix(WEBVIEW2_URL_PREFIX).ok_or_else(|| {
    crate::Error::GenericError(format!(
      "WebView2 URL prefix mismatch. Expected `{WEBVIEW2_URL_PREFIX}`, found `{final_url}`."
    ))
  })?;
  let (guid, filename) = remaining_url.split_once('/').ok_or_else(|| {
    crate::Error::GenericError(format!(
      "WebView2 URL format mismatch. Expected `<GUID>/<FILENAME>`, found `{remaining_url}`."
    ))
  })?;
  Ok((guid.into(), filename.into()))
}

pub fn download_webview2_bootstrapper(base_path: &Path) -> crate::Result<PathBuf> {
  let file_path = base_path.join("MicrosoftEdgeWebview2Setup.exe");
  if !file_path.exists() {
    std::fs::write(&file_path, download(WEBVIEW2_BOOTSTRAPPER_URL)?)?;
  }
  Ok(file_path)
}

pub fn download_webview2_offline_installer(base_path: &Path, arch: &str) -> crate::Result<PathBuf> {
  let url = if arch == "x64" {
    WEBVIEW2_OFFLINE_INSTALLER_X64_URL
  } else {
    WEBVIEW2_OFFLINE_INSTALLER_X86_URL
  };
  let (guid, filename) = webview2_guid_path(url)?;
  let dir_path = base_path.join(guid);
  let file_path = dir_path.join(filename);
  if !file_path.exists() {
    fs::create_dir_all(dir_path)?;
    std::fs::write(&file_path, download(url)?)?;
  }
  Ok(file_path)
}

/// Finds the Visual C++ runtime DLLs for the given architecture.
pub fn vc_runtime_dlls(arch: Arch) -> crate::Result<Vec<PathBuf>> {
  let arch = vc_runtime_arch(arch)?;
  let redist_dir = vc_redist_dir()?;
  let runtime_dir = vc_runtime_dir(&redist_dir, arch)?;

  let dlls = glob::glob(&glob_path(&runtime_dir, "*.dll"))?.collect::<Result<Vec<_>, _>>()?;
  if dlls.is_empty() {
    return Err(crate::Error::GenericError(format!(
      "no Visual C++ runtime DLLs found in `{}`",
      runtime_dir.display()
    )));
  }

  Ok(dlls)
}

#[inline(always)]
fn vc_runtime_arch(arch: Arch) -> crate::Result<&'static str> {
  match arch {
    Arch::X86_64 => Ok("x64"),
    Arch::X86 => Ok("x86"),
    Arch::AArch64 => Ok("arm64"),
    _ => Err(crate::Error::GenericError(
      "bundling the Visual C++ runtime is only supported for Windows x86, x64 and arm64 targets"
        .into(),
    )),
  }
}

#[cfg(windows)]
fn visual_studio_dir() -> crate::Result<PathBuf> {
  let vswhere = vswhere_path()?;

  let output = Command::new(&*vswhere)
    .args([
      "-latest",
      "-prerelease",
      "-products",
      "*",
      "-requires",
      VC_REDIST_COMPONENT,
      "-property",
      "installationPath",
      "-format",
      "value",
      "-utf8",
    ])
    .output()?;

  if !output.status.success() {
    return Err(crate::Error::GenericError(format!(
      "failed to locate Visual Studio with the {VC_REDIST_COMPONENT} component"
    )));
  }

  let stdout = String::from_utf8_lossy(&output.stdout);
  let Some(vs_dir) = stdout.lines().map(str::trim).find(|line| !line.is_empty()) else {
    return Err(crate::Error::GenericError(format!(
      "failed to locate Visual Studio with the {VC_REDIST_COMPONENT} component"
    )));
  };

  Ok(PathBuf::from(vs_dir))
}

fn vc_redist_dir() -> crate::Result<PathBuf> {
  if let Ok(redist_dir) = std::env::var(VCTOOLS_REDIST_DIR_ENV_VAR) {
    return Ok(PathBuf::from(redist_dir));
  }

  #[cfg(windows)]
  {
    let vs_dir = visual_studio_dir()?;
    Ok(vs_dir.join("VC/Redist/MSVC"))
  }

  #[cfg(not(windows))]
  {
    Err(crate::Error::GenericError(format!(
      "failed to find Visual C++ runtime redist directory; set {VCTOOLS_REDIST_DIR_ENV_VAR} when bundling the Visual C++ runtime from non-Windows hosts"
    )))
  }
}

fn vc_runtime_dir(redist_dir: &Path, arch: &str) -> crate::Result<PathBuf> {
  let Some(latest_version_dir) = latest_vc_redist_version_dir(redist_dir)? else {
    return Err(crate::Error::GenericError(format!(
      "failed to find Visual C++ runtime versions in `{}`",
      redist_dir.display()
    )));
  };

  let arch_dir = latest_version_dir.join(arch);
  let Some(runtime_dir) = glob::glob(&glob_path(&arch_dir, "Microsoft.VC*.CRT"))?
    .filter_map(Result::ok)
    .find(|path| path.is_dir())
  else {
    return Err(crate::Error::GenericError(format!(
      "failed to find Visual C++ runtime directory for `{arch}` in `{}`",
      arch_dir.display()
    )));
  };

  Ok(runtime_dir)
}

fn latest_vc_redist_version_dir(redist_dir: &Path) -> crate::Result<Option<PathBuf>> {
  let dir = fs::read_dir(redist_dir)?
    .flatten()
    .map(|entry| entry.path())
    .filter(|path| path.is_dir())
    .filter_map(|path| {
      let version = path
        .file_name()?
        .to_str()?
        .parse::<semver::Version>()
        .ok()?;
      Some((version, path))
    })
    .max_by(|(a, _), (b, _)| a.cmp(b))
    .map(|(_, path)| path);
  Ok(dir)
}

/// Builds a glob pattern from a literal base path and an unescaped glob suffix.
///
/// The base path is escaped so Visual Studio paths containing glob metacharacters are treated as
/// literal directories, while `pattern` remains active glob syntax.
fn glob_path(path: &Path, pattern: &str) -> String {
  PathBuf::from(glob::Pattern::escape(&path.to_string_lossy()))
    .join(pattern)
    .to_string_lossy()
    .into_owned()
}

/// Writes the bundled `vswhere.exe` to a new temporary file and returns its path.
///
/// Each call creates a uniquely named file, so a pre-existing or half-written `vswhere.exe` in the
/// temp directory is never executed. The file is deleted when the returned path is dropped.
#[cfg(windows)]
pub fn vswhere_path() -> crate::Result<tempfile::TempPath> {
  let mut file = tempfile::Builder::new()
    .prefix("vswhere-")
    .suffix(".exe")
    .tempfile()?;
  file.write_all(VSWHERE)?;
  file.as_file().sync_all()?;
  // close the handle so the executable can be launched
  Ok(file.into_temp_path())
}

#[cfg(target_os = "windows")]
pub fn processor_architecture<'a>() -> Option<&'a str> {
  use windows_sys::Win32::System::SystemInformation::{
    GetNativeSystemInfo, PROCESSOR_ARCHITECTURE_AMD64, PROCESSOR_ARCHITECTURE_ARM,
    PROCESSOR_ARCHITECTURE_ARM64, PROCESSOR_ARCHITECTURE_INTEL, SYSTEM_INFO,
  };

  let mut system_info: SYSTEM_INFO = unsafe { std::mem::zeroed() };
  unsafe { GetNativeSystemInfo(&mut system_info) };
  match unsafe { system_info.Anonymous.Anonymous.wProcessorArchitecture } {
    PROCESSOR_ARCHITECTURE_INTEL => Some("x86"),
    PROCESSOR_ARCHITECTURE_AMD64 => Some("x64"),
    PROCESSOR_ARCHITECTURE_ARM => Some("arm"),
    PROCESSOR_ARCHITECTURE_ARM64 => Some("arm64"),
    _ => None,
  }
}

```

### Core Architecture Module: `crates/tauri-bundler/src/utils/fs_utils.rs`
```
// Copyright 2016-2019 Cargo-Bundle developers <https://github.com/burtonageo/cargo-bundle>
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::{
  fs::{self, File},
  io::{self, BufWriter},
  path::Path,
};

/// Creates a new file at the given path, creating any parent directories as
/// needed.
pub fn create_file(path: &Path) -> crate::Result<BufWriter<File>> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }
  let file = File::create(path)?;
  Ok(BufWriter::new(file))
}

/// Creates the given directory path,
/// erasing it first if specified.
#[allow(dead_code)]
pub fn create_dir(path: &Path, erase: bool) -> crate::Result<()> {
  if erase && path.exists() {
    remove_dir_all(path)?;
  }
  Ok(fs::create_dir(path)?)
}

/// Creates all of the directories of the specified path,
/// erasing it first if specified.
#[allow(dead_code)]
pub fn create_dir_all(path: &Path, erase: bool) -> crate::Result<()> {
  if erase && path.exists() {
    remove_dir_all(path)?;
  }
  Ok(fs::create_dir_all(path)?)
}

/// Removes the directory and its contents if it exists.
#[allow(dead_code)]
pub fn remove_dir_all(path: &Path) -> crate::Result<()> {
  if path.exists() {
    Ok(fs::remove_dir_all(path)?)
  } else {
    Ok(())
  }
}

/// Makes a symbolic link to a directory.
#[cfg(unix)]
#[allow(dead_code)]
fn symlink_dir(src: &Path, dst: &Path) -> io::Result<()> {
  std::os::unix::fs::symlink(src, dst)
}

/// Makes a symbolic link to a directory.
#[cfg(windows)]
fn symlink_dir(src: &Path, dst: &Path) -> io::Result<()> {
  std::os::windows::fs::symlink_dir(src, dst)
}

/// Makes a symbolic link to a file.
#[cfg(unix)]
#[allow(dead_code)]
fn symlink_file(src: &Path, dst: &Path) -> io::Result<()> {
  std::os::unix::fs::symlink(src, dst)
}

/// Makes a symbolic link to a file.
#[cfg(windows)]
fn symlink_file(src: &Path, dst: &Path) -> io::Result<()> {
  std::os::windows::fs::symlink_file(src, dst)
}

/// Copies a regular file from one path to another, creating any parent
/// directories of the destination path as necessary. Fails if the source path
/// is a directory or doesn't exist.
pub fn copy_file(from: &Path, to: &Path) -> crate::Result<()> {
  if !from.exists() {
    return Err(crate::Error::GenericError(format!(
      "{from:?} does not exist"
    )));
  }
  if !from.is_file() {
    return Err(crate::Error::GenericError(format!(
      "{from:?} is not a file"
    )));
  }
  let dest_dir = to.parent().expect("No data in parent");
  fs::create_dir_all(dest_dir)?;
  fs::copy(from, to)?;
  Ok(())
}

/// Recursively copies a directory file from one path to another, creating any
/// parent directories of the destination path as necessary.  Fails if the
/// source path is not a directory or doesn't exist, or if the destination path
/// already exists.
#[allow(dead_code)]
pub fn copy_dir(from: &Path, to: &Path) -> crate::Result<()> {
  if !from.exists() {
    return Err(crate::Error::GenericError(format!(
      "{from:?} does not exist"
    )));
  }
  if !from.is_dir() {
    return Err(crate::Error::GenericError(format!(
      "{from:?} is not a Directory"
    )));
  }
  let parent = to.parent().expect("No data in parent");
  fs::create_dir_all(parent)?;
  for entry in walkdir::WalkDir::new(from) {
    let entry = entry?;
    debug_assert!(entry.path().starts_with(from));
    let rel_path = entry.path().strip_prefix(from)?;
    let dest_path = to.join(rel_path);
    if entry.file_type().is_symlink() {
      let target = fs::read_link(entry.path())?;
      if entry.path().is_dir() {
        symlink_dir(&target, &dest_path)?;
      } else {
        symlink_file(&target, &dest_path)?;
      }
    } else if entry.file_type().is_dir() {
      fs::create_dir_all(dest_path)?;
    } else {
      fs::copy(entry.path(), dest_path)?;
    }
  }
  Ok(())
}

/// Copies user-defined files specified in the configuration file to the package.
///
/// The configuration object maps the path in the package to the path of the file on the filesystem,
/// relative to the tauri.conf.json file.
///
/// Expects a HashMap of PathBuf entries, representing destination and source paths,
/// and also a path of a directory. The files will be stored with respect to this directory.
#[cfg(any(
  target_os = "linux",
  target_os = "dragonfly",
  target_os = "freebsd",
  target_os = "netbsd",
  target_os = "openbsd"
))]
pub fn copy_custom_files(
  files_map: &std::collections::HashMap<std::path::PathBuf, std::path::PathBuf>,
  data_dir: &Path,
) -> crate::Result<()> {
  for (pkg_path, path) in files_map.iter() {
    let pkg_path = if pkg_path.is_absolute() {
      pkg_path.strip_prefix("/").unwrap()
    } else {
      pkg_path
    };
    if path.is_file() {
      copy_file(path, &data_dir.join(pkg_path))?;
    } else {
      copy_dir(path, &data_dir.join(pkg_path))?;
    }
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::create_file;
  use std::io::Write;

  #[test]
  fn create_file_with_parent_dirs() {
    let tmp = tempfile::tempdir().expect("Unable to create temp dir");
    assert!(!tmp.path().join("parent").exists());
    {
      let mut file =
        create_file(&tmp.path().join("parent/file.txt")).expect("Failed to create file");
      writeln!(file, "Hello, world!").expect("unable to write file");
    }
    assert!(tmp.path().join("parent").is_dir());
    assert!(tmp.path().join("parent/file.txt").is_file());
  }

  #[cfg(not(windows))]
  #[test]
  fn copy_dir_with_symlinks() {
    use std::path::PathBuf;

    // Create a directory structure that looks like this:
    //   ${TMP}/orig/
    //       sub/
    //           file.txt
    //       link -> sub/file.txt
    let tmp = tempfile::tempdir().expect("unable to create tempdir");
    {
      let mut file =
        create_file(&tmp.path().join("orig/sub/file.txt")).expect("Unable to create file");
      writeln!(file, "Hello, world!").expect("Unable to write to file");
    }
    super::symlink_file(
      &PathBuf::from("sub/file.txt"),
      &tmp.path().join("orig/link"),
    )
    .expect("Failed to create symlink");
    assert_eq!(
      std::fs::read(tmp.path().join("orig/link"))
        .expect("Failed to read file")
        .as_slice(),
      b"Hello, world!\n"
    );
    // Copy ${TMP}/orig to ${TMP}/parent/copy, and make sure that the
    // directory structure, file, and symlink got copied correctly.
    super::copy_dir(&tmp.path().join("orig"), &tmp.path().join("parent/copy"))
      .expect("Failed to copy dir");
    assert!(tmp.path().join("parent/copy").is_dir());
    assert!(tmp.path().join("parent/copy/sub").is_dir());
    assert!(tmp.path().join("parent/copy/sub/file.txt").is_file());
    assert_eq!(
      std::fs::read(tmp.path().join("parent/copy/sub/file.txt"))
        .expect("Failed to read file")
        .as_slice(),
      b"Hello, world!\n"
    );
    assert!(tmp.path().join("parent/copy/link").exists());
    assert_eq!(
      std::fs::read_link(tmp.path().join("parent/copy/link")).expect("Failed to read from symlink"),
      PathBuf::from("sub/file.txt")
    );
    assert_eq!(
      std::fs::read(tmp.path().join("parent/copy/link"))
        .expect("Failed to read from file")
        .as_slice(),
      b"Hello, world!\n"
    );
  }
}

```

### Core Architecture Module: `crates/tauri-bundler/src/utils/http_utils.rs`
```
// Copyright 2016-2019 Cargo-Bundle developers <https://github.com/burtonageo/cargo-bundle>
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::{
  fs::{File, create_dir_all},
  io::{Cursor, Read, Write},
  path::Path,
};

use regex::Regex;
use sha2::Digest;
use url::Url;
use zip::ZipArchive;

const BUNDLER_USER_AGENT: &str = concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION"),);

fn generate_github_mirror_url_from_template(github_url: &str) -> Option<String> {
  std::env::var("TAURI_BUNDLER_TOOLS_GITHUB_MIRROR_TEMPLATE")
    .ok()
    .and_then(|template| {
      let re =
        Regex::new(r"https://github.com/([^/]+)/([^/]+)/releases/download/([^/]+)/(.*)").unwrap();
      re.captures(github_url).map(|caps| {
        template
          .replace("<owner>", &caps[1])
          .replace("<repo>", &caps[2])
          .replace("<version>", &caps[3])
          .replace("<asset>", &caps[4])
      })
    })
}

fn generate_github_mirror_url_from_base(github_url: &str) -> Option<String> {
  std::env::var("TAURI_BUNDLER_TOOLS_GITHUB_MIRROR")
    .ok()
    .and_then(|cdn| Url::parse(&cdn).ok())
    .map(|mut cdn| {
      cdn.set_path(github_url);
      cdn.to_string()
    })
}

fn generate_github_alternative_url(url: &str) -> Option<(ureq::Agent, String)> {
  if !url.starts_with("https://github.com/") {
    return None;
  }

  generate_github_mirror_url_from_template(url)
    .or_else(|| generate_github_mirror_url_from_base(url))
    .map(|alt_url| {
      (
        ureq::Agent::config_builder()
          .user_agent(BUNDLER_USER_AGENT)
          .build()
          .into(),
        alt_url,
      )
    })
}

fn create_agent_and_url(url: &str) -> (ureq::Agent, String) {
  generate_github_alternative_url(url).unwrap_or_else(|| (base_ureq_agent(), url.to_owned()))
}

pub(crate) fn base_ureq_agent() -> ureq::Agent {
  #[allow(unused_mut)]
  let mut config_builder = ureq::Agent::config_builder()
    .user_agent(BUNDLER_USER_AGENT)
    .proxy(ureq::Proxy::try_from_env());

  #[cfg(feature = "platform-certs")]
  {
    config_builder = config_builder.tls_config(
      ureq::tls::TlsConfig::builder()
        .root_certs(ureq::tls::RootCerts::PlatformVerifier)
        .build(),
    );
  }

  config_builder.build().into()
}

#[allow(dead_code)]
pub fn download(url: &str) -> crate::Result<Vec<u8>> {
  let (agent, final_url) = create_agent_and_url(url);

  log::info!(action = "Downloading"; "{}", final_url);

  let response = agent.get(&final_url).call().map_err(Box::new)?;
  let mut bytes = Vec::new();
  response.into_body().into_reader().read_to_end(&mut bytes)?;
  Ok(bytes)
}

#[allow(dead_code)]
#[derive(Clone, Copy)]
pub enum HashAlgorithm {
  #[cfg(target_os = "windows")]
  Sha256,
  Sha1,
}

/// Function used to download a file and checks SHA256 to verify the download.
#[allow(dead_code)]
pub fn download_and_verify(
  url: &str,
  hash: &str,
  hash_algorithm: HashAlgorithm,
) -> crate::Result<Vec<u8>> {
  let data = download(url)?;
  log::info!("validating hash");
  verify_hash(&data, hash, hash_algorithm)?;
  Ok(data)
}

#[allow(dead_code)]
pub fn verify_hash(data: &[u8], hash: &str, hash_algorithm: HashAlgorithm) -> crate::Result<()> {
  match hash_algorithm {
    #[cfg(target_os = "windows")]
    HashAlgorithm::Sha256 => {
      let hasher = sha2::Sha256::new();
      verify_data_with_hasher(data, hash, hasher)
    }
    HashAlgorithm::Sha1 => {
      let hasher = sha1::Sha1::new();
      verify_data_with_hasher(data, hash, hasher)
    }
  }
}

fn verify_data_with_hasher(data: &[u8], hash: &str, mut hasher: impl Digest) -> crate::Result<()> {
  hasher.update(data);

  let url_hash = hasher.finalize().to_vec();
  let expected_hash = hex::decode(hash)?;
  if expected_hash == url_hash {
    Ok(())
  } else {
    Err(crate::Error::HashError)
  }
}

#[allow(dead_code)]
pub fn verify_file_hash<P: AsRef<Path>>(
  path: P,
  hash: &str,
  hash_algorithm: HashAlgorithm,
) -> crate::Result<()> {
  let data = std::fs::read(path)?;
  verify_hash(&data, hash, hash_algorithm)
}

/// Extracts the zips from memory into a usable path.
#[allow(dead_code)]
pub fn extract_zip(data: &[u8], path: &Path) -> crate::Result<()> {
  let cursor = Cursor::new(data);

  let mut zipa = ZipArchive::new(cursor)?;

  for i in 0..zipa.len() {
    let mut file = zipa.by_index(i)?;

    if let Some(name) = file.enclosed_name() {
      let dest_path = path.join(name);
      if file.is_dir() {
        create_dir_all(&dest_path)?;
        continue;
      }

      let parent = dest_path.parent().expect("Failed to get parent");

      if !parent.exists() {
        create_dir_all(parent)?;
      }

      let mut buff: Vec<u8> = Vec::new();
      file.read_to_end(&mut buff)?;
      let mut fileout = File::create(dest_path).expect("Failed to open file");

      fileout.write_all(&buff)?;
    }
  }

  Ok(())
}

#[cfg(test)]
mod tests {
  use super::generate_github_mirror_url_from_template;
  use std::env;

  const GITHUB_ASSET_URL: &str =
    "https://github.com/wixtoolset/wix3/releases/download/wix3112rtm/wix311-binaries.zip";
  const NON_GITHUB_ASSET_URL: &str = "https://someotherwebsite.com/somefile.zip";

  #[test]
  #[serial_test::serial]
  fn test_generate_mirror_url_no_env_var() {
    unsafe { env::remove_var("TAURI_BUNDLER_TOOLS_GITHUB_MIRROR_TEMPLATE") };

    assert!(generate_github_mirror_url_from_template(GITHUB_ASSET_URL).is_none());
  }

  #[test]
  #[serial_test::serial]
  fn test_generate_mirror_url_non_github_url() {
    unsafe {
      env::set_var(
        "TAURI_BUNDLER_TOOLS_GITHUB_MIRROR_TEMPLATE",
        "https://mirror.example.com/<owner>/<repo>/releases/download/<version>/<asset>",
      )
    };

    assert!(generate_github_mirror_url_from_template(NON_GITHUB_ASSET_URL).is_none());
  }

  struct TestCase {
    template: &'static str,
    expected_url: &'static str,
  }

  #[test]
  #[serial_test::serial]
  fn test_generate_mirror_url_correctly() {
    let test_cases = vec![
      TestCase {
        template: "https://mirror.example.com/<owner>/<repo>/releases/download/<version>/<asset>",
        expected_url: "https://mirror.example.com/wixtoolset/wix3/releases/download/wix3112rtm/wix311-binaries.zip",
      },
      TestCase {
        template: "https://mirror.example.com/<asset>",
        expected_url: "https://mirror.example.com/wix311-binaries.zip",
      },
    ];

    for case in test_cases {
      unsafe { env::set_var("TAURI_BUNDLER_TOOLS_GITHUB_MIRROR_TEMPLATE", case.template) };
      assert_eq!(
        generate_github_mirror_url_from_template(GITHUB_ASSET_URL),
        Some(case.expected_url.to_string())
      );
    }
  }
}

```

### Core Architecture Module: `crates/tauri-bundler/src/utils/mod.rs`
```
// Copyright 2016-2019 Cargo-Bundle developers <https://github.com/burtonageo/cargo-bundle>
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::{
  ffi::OsStr,
  io::{BufRead, BufReader},
  path::Path,
  process::{Command, ExitStatus, Output, Stdio},
  sync::{Arc, Mutex},
};

pub mod fs_utils;
pub mod http_utils;

/// Returns true if the path has a filename indicating that it is a high-density
/// "retina" icon.  Specifically, returns true the file stem ends with
/// "@2x" (a convention specified by the [Apple developer docs](
/// <https://developer.apple.com/library/mac/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html>)).
#[allow(dead_code)]
pub fn is_retina(path: &Path) -> bool {
  path
    .file_stem()
    .and_then(OsStr::to_str)
    .map(|stem| stem.ends_with("@2x"))
    .unwrap_or(false)
}

pub trait CommandExt {
  // The `pipe` function sets the stdout and stderr to properly
  // show the command output in the Node.js wrapper.
  fn piped(&mut self) -> std::io::Result<ExitStatus>;
  fn output_ok(&mut self) -> crate::Result<Output>;
}

impl CommandExt for Command {
  fn piped(&mut self) -> std::io::Result<ExitStatus> {
    self.stdin(os_pipe::dup_stdin()?);
    self.stdout(os_pipe::dup_stdout()?);
    self.stderr(os_pipe::dup_stderr()?);
    let program = self.get_program().to_string_lossy().into_owned();
    log::debug!(action = "Running"; "Command `{} {}`", program, self.get_args().map(|arg| arg.to_string_lossy()).fold(String::new(), |acc, arg| format!("{acc} {arg}")));

    self.status()
  }

  fn output_ok(&mut self) -> crate::Result<Output> {
    let program = self.get_program().to_string_lossy().into_owned();
    log::debug!(action = "Running"; "Command `{} {}`", program, self.get_args().map(|arg| arg.to_string_lossy()).fold(String::new(), |acc, arg| format!("{acc} {arg}")));

    self.stdout(Stdio::piped());
    self.stderr(Stdio::piped());

    let mut child = self.spawn()?;

    let mut stdout = child.stdout.take().map(BufReader::new).unwrap();
    let stdout_lines = Arc::new(Mutex::new(Vec::new()));
    let stdout_lines_ = stdout_lines.clone();
    std::thread::spawn(move || {
      let mut line = String::new();
      let mut lines = stdout_lines_.lock().unwrap();
      loop {
        line.clear();
        match stdout.read_line(&mut line) {
          Ok(0) => break,
          Ok(_) => {
            log::debug!(action = "stdout"; "{}", line.trim_end());
            lines.extend(line.as_bytes().to_vec());
          }
          Err(_) => (),
        }
      }
    });

    let mut stderr = child.stderr.take().map(BufReader::new).unwrap();
    let stderr_lines = Arc::new(Mutex::new(Vec::new()));
    let stderr_lines_ = stderr_lines.clone();
    std::thread::spawn(move || {
      let mut line = String::new();
      let mut lines = stderr_lines_.lock().unwrap();
      loop {
        line.clear();
        match stderr.read_line(&mut line) {
          Ok(0) => break,
          Ok(_) => {
            log::debug!(action = "stderr"; "{}", line.trim_end());
            lines.extend(line.as_bytes().to_vec());
          }
          Err(_) => (),
        }
      }
    });

    let status = child.wait()?;
    let output = Output {
      status,
      stdout: std::mem::take(&mut *stdout_lines.lock().unwrap()),
      stderr: std::mem::take(&mut *stderr_lines.lock().unwrap()),
    };

    if output.status.success() {
      Ok(output)
    } else {
      Err(crate::Error::GenericError(format!(
        "failed to run {program}"
      )))
    }
  }
}

#[cfg(test)]
mod tests {
  use std::path::{Path, PathBuf};

  use tauri_utils::resources::resource_relpath;

  use super::is_retina;

  #[test]
  fn retina_icon_paths() {
    assert!(!is_retina(Path::new("data/icons/512x512.png")));
    assert!(is_retina(Path::new("data/icons/512x512@2x.png")));
  }

  #[test]
  fn resource_relative_paths() {
    assert_eq!(
      resource_relpath(Path::new("./data/images/button.png")),
      PathBuf::from("data/images/button.png")
    );
    assert_eq!(
      resource_relpath(Path::new("../../images/wheel.png")),
      PathBuf::from("_up_/_up_/images/wheel.png")
    );
    assert_eq!(
      resource_relpath(Path::new("/home/ferris/crab.png")),
      PathBuf::from("_root_/home/ferris/crab.png")
    );
  }
}

```

### Core Architecture Module: `crates/tauri-runtime-wry/src/util.rs`
```
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

#[cfg_attr(not(windows), allow(unused_imports))]
pub use imp::*;

#[cfg(not(windows))]
mod imp {}

#[cfg(windows)]
mod imp {
  use std::{iter::once, os::windows::ffi::OsStrExt};

  use once_cell::sync::Lazy;
  use windows::{
    Win32::{
      Foundation::*,
      Graphics::Gdi::*,
      System::LibraryLoader::{GetProcAddress, LoadLibraryW},
      UI::{HiDpi::*, WindowsAndMessaging::*},
    },
    core::{HRESULT, PCSTR, PCWSTR},
  };

  pub fn encode_wide(string: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    string.as_ref().encode_wide().chain(once(0)).collect()
  }

  // Helper function to dynamically load function pointer.
  // `library` and `function` must be zero-terminated.
  pub(super) fn get_function_impl(library: &str, function: &str) -> FARPROC {
    let library = encode_wide(library);
    assert_eq!(function.chars().last(), Some('\0'));

    // Library names we will use are ASCII so we can use the A version to avoid string conversion.
    let module = unsafe { LoadLibraryW(PCWSTR::from_raw(library.as_ptr())) }.unwrap_or_default();
    if module.is_invalid() {
      return None;
    }

    unsafe { GetProcAddress(module, PCSTR::from_raw(function.as_ptr())) }
  }

  macro_rules! get_function {
    ($lib:expr, $func:ident) => {
      $crate::util::get_function_impl($lib, concat!(stringify!($func), '\0'))
        .map(|f| unsafe { std::mem::transmute::<_, $func>(f) })
    };
  }

  type GetDpiForWindow = unsafe extern "system" fn(hwnd: HWND) -> u32;
  type GetDpiForMonitor = unsafe extern "system" fn(
    hmonitor: HMONITOR,
    dpi_type: MONITOR_DPI_TYPE,
    dpi_x: *mut u32,
    dpi_y: *mut u32,
  ) -> HRESULT;
  type GetSystemMetricsForDpi =
    unsafe extern "system" fn(nindex: SYSTEM_METRICS_INDEX, dpi: u32) -> i32;

  static GET_DPI_FOR_WINDOW: Lazy<Option<GetDpiForWindow>> =
    Lazy::new(|| get_function!("user32.dll", GetDpiForWindow));
  static GET_DPI_FOR_MONITOR: Lazy<Option<GetDpiForMonitor>> =
    Lazy::new(|| get_function!("shcore.dll", GetDpiForMonitor));
  static GET_SYSTEM_METRICS_FOR_DPI: Lazy<Option<GetSystemMetricsForDpi>> =
    Lazy::new(|| get_function!("user32.dll", GetSystemMetricsForDpi));

  #[allow(non_snake_case)]
  pub unsafe fn hwnd_dpi(hwnd: HWND) -> u32 {
    unsafe {
      if let Some(GetDpiForWindow) = *GET_DPI_FOR_WINDOW {
        // We are on Windows 10 Anniversary Update (1607) or later.
        match GetDpiForWindow(hwnd) {
          0 => USER_DEFAULT_SCREEN_DPI, // 0 is returned if hwnd is invalid
          dpi => dpi,
        }
      } else if let Some(GetDpiForMonitor) = *GET_DPI_FOR_MONITOR {
        // We are on Windows 8.1 or later.
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if monitor.is_invalid() {
          return USER_DEFAULT_SCREEN_DPI;
        }

        let mut dpi_x = 0;
        let mut dpi_y = 0;
        if GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y).is_ok() {
          dpi_x
        } else {
          USER_DEFAULT_SCREEN_DPI
        }
      } else {
        // We are on Vista or later.
        if IsProcessDPIAware().as_bool() {
          let hdc = GetDC(Some(hwnd));
          if hdc.is_invalid() {
            return USER_DEFAULT_SCREEN_DPI;
          }
          // If the process is DPI aware, then scaling must be handled by the application using
          // this DPI value.
          let dpi = GetDeviceCaps(Some(hdc), LOGPIXELSX) as u32;
          ReleaseDC(Some(hwnd), hdc);
          dpi
        } else {
          // If the process is DPI unaware, then scaling is performed by the OS; we thus return
          // 96 (scale factor 1.0) to prevent the window from being re-scaled by both the
          // application and the WM.
          USER_DEFAULT_SCREEN_DPI
        }
      }
    }
  }

  #[allow(non_snake_case)]
  pub unsafe fn get_system_metrics_for_dpi(nindex: SYSTEM_METRICS_INDEX, dpi: u32) -> i32 {
    unsafe {
      if let Some(GetSystemMetricsForDpi) = *GET_SYSTEM_METRICS_FOR_DPI {
        GetSystemMetricsForDpi(nindex, dpi)
      } else {
        GetSystemMetrics(nindex)
      }
    }
  }
}

```

### Core Architecture Module: `crates/tauri-schema-worker/src/config.rs`
```
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

// axum Error is too large
#![allow(clippy::result_large_err)]

use anyhow::Context;
use axum::{
  Router,
  extract::Path,
  http::{HeaderValue, StatusCode, header},
  response::{IntoResponse, Result},
  routing::get,
};
use semver::{Version, VersionReq};
use serde::Deserialize;
use worker::*;

#[derive(Deserialize)]
pub struct CrateReleases {
  pub versions: Vec<CrateRelease>,
}

#[derive(Debug, Deserialize)]
pub struct CrateRelease {
  #[serde(alias = "num")]
  pub version: Version,
  pub yanked: Option<bool>,
}

#[derive(Deserialize)]
pub struct CrateMetadataFull {
  #[serde(rename = "crate")]
  pub crate_: CrateMetadata,
}

#[derive(Deserialize)]
pub struct CrateMetadata {
  pub max_stable_version: Version,
}

const USERAGENT: &str = "tauri-schema-worker (contact@tauri.app)";

pub fn router() -> Router {
  Router::new()
    .route("/config", get(stable_schema))
    .route("/config/latest", get(stable_schema))
    .route("/config/stable", get(stable_schema))
    .route("/config/next", get(next_schema)) // pre-releases versions, (rc, alpha and beta)
    .route("/config/{version}", get(schema_for_version))
}

async fn schema_for_version(Path(version): Path<String>) -> Result<JsonResponse> {
  try_schema_for_version(version)
    .await
    .map(JsonResponse)
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    .map_err(Into::into)
}

async fn stable_schema() -> Result<JsonResponse> {
  try_stable_schema()
    .await
    .map(JsonResponse)
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    .map_err(Into::into)
}

async fn next_schema() -> Result<JsonResponse> {
  try_next_schema()
    .await
    .map(JsonResponse)
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    .map_err(Into::into)
}

#[worker::send]
async fn try_schema_for_version(version: String) -> anyhow::Result<String> {
  let version = version.parse::<VersionReq>()?;

  let releases = crate_releases("tauri").await?;

  if releases.is_empty() {
    return try_stable_schema().await;
  }

  let Some(version) = releases.into_iter().find(|r| version.matches(&r.version)) else {
    return try_stable_schema().await;
  };

  schema_file_for_version(version.version).await
}

#[worker::send]
async fn try_stable_schema() -> anyhow::Result<String> {
  let max = stable_version("tauri").await?;
  schema_file_for_version(max).await
}

#[worker::send]
async fn try_next_schema() -> anyhow::Result<String> {
  let releases = crate_releases("tauri").await?;
  let version = releases
    .into_iter()
    .filter(|r| !r.version.pre.is_empty())
    .map(|r| r.version)
    .max()
    .context("Couldn't find latest pre-release")?;
  schema_file_for_version(version).await
}

async fn schema_file_for_version(version: Version) -> anyhow::Result<String> {
  let cache = Cache::open("schema".to_string()).await;
  let cache_key = format!("https://schema.tauri.app/config/{version}");
  if let Some(mut cached) = cache.get(cache_key.clone(), true).await? {
    console_log!("Serving schema for {version} from cache");
    return cached.text().await.map_err(Into::into);
  }

  console_log!("Fetching schema for {version} from remote");

  let path = if version.major >= 2 {
    "crates/tauri-schema-generator/schemas/config.schema.json"
  } else {
    "core/tauri-config-schema/schema.json"
  };
  let url = format!("https://raw.githubusercontent.com/tauri-apps/tauri/tauri-v{version}/{path}");
  let mut res = Fetch::Request(fetch_req(&url)?).send().await?;

  cache.put(cache_key, res.cloned()?).await?;

  res.text().await.map_err(Into::into)
}

async fn crate_releases(crate_: &str) -> anyhow::Result<Vec<CrateRelease>> {
  let url = format!("https://crates.io/api/v1/crates/{crate_}/versions");
  let mut res = Fetch::Request(fetch_req(&url)?).send().await?;

  let versions: CrateReleases = res.json().await?;
  let versions = versions.versions;

  let flt = |r: &CrateRelease| r.yanked == Some(false);
  Ok(versions.into_iter().filter(flt).collect())
}

async fn stable_version(crate_: &str) -> anyhow::Result<Version> {
  let url = format!("https://crates.io/api/v1/crates/{crate_}");
  let mut res = Fetch::Request(fetch_req(&url)?).send().await?;
  let metadata: CrateMetadataFull = res.json().await?;
  Ok(metadata.crate_.max_stable_version)
}

fn fetch_req(url: &str) -> anyhow::Result<worker::Request> {
  let headers = Headers::new();
  headers.append(header::USER_AGENT.as_str(), USERAGENT)?;

  worker::Request::new_with_init(
    url,
    &RequestInit {
      method: Method::Get,
      headers,
      cf: CfProperties {
        cache_ttl: Some(86400),
        cache_everything: Some(true),
        cache_ttl_by_status: Some(
          [
            ("200-299".to_string(), 86400),
            ("404".to_string(), 1),
            ("500-599".to_string(), 0),
          ]
          .into(),
        ),
        ..Default::default()
      },
      ..Default::default()
    },
  )
  .map_err(Into::into)
}

struct JsonResponse(String);

impl IntoResponse for JsonResponse {
  fn into_response(self) -> axum::response::Response {
    (
      [(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
      )],
      self.0,
    )
      .into_response()
  }
}

```

### Core Architecture Module: `crates/tauri-schema-worker/src/lib.rs`
```
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use axum::{Router, routing::get};
use tower_service::Service;
use worker::*;

mod config;

#[worker::event(fetch)]
async fn main(
  req: HttpRequest,
  _env: Env,
  _ctx: Context,
) -> worker::Result<axum::http::Response<axum::body::Body>> {
  console_error_panic_hook::set_once();
  Ok(router().call(req).await?)
}

fn router() -> Router {
  Router::new().route("/", get(root)).merge(config::router())
}

async fn root() -> &'static str {
  "tauri schema worker"
}

```

### Core Architecture Module: `crates/tauri-utils/src/acl/capability.rs`
```
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! End-user abstraction for selecting permissions a window has access to.

use std::{path::Path, str::FromStr};

use crate::{acl::Identifier, platform::Target};
use serde::{
  Deserialize, Deserializer, Serialize,
  de::{Error, IntoDeserializer},
};
use serde_untagged::UntaggedEnumVisitor;

use super::Scopes;

/// An entry for a permission value in a [`Capability`] can be either a raw permission [`Identifier`]
/// or an object that references a permission and extends its scope.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(untagged)]
pub enum PermissionEntry {
  /// Reference a permission or permission set by identifier.
  PermissionRef(Identifier),
  /// Reference a permission or permission set by identifier and extends its scope.
  ExtendedPermission {
    /// Identifier of the permission or permission set.
    identifier: Identifier,
    /// Scope to append to the existing permission scope.
    #[serde(default, flatten)]
    scope: Scopes,
  },
}

impl PermissionEntry {
  /// The identifier of the permission referenced in this entry.
  pub fn identifier(&self) -> &Identifier {
    match self {
      Self::PermissionRef(identifier) => identifier,
      Self::ExtendedPermission {
        identifier,
        scope: _,
      } => identifier,
    }
  }
}

impl<'de> Deserialize<'de> for PermissionEntry {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    #[derive(Deserialize)]
    struct ExtendedPermissionStruct {
      identifier: Identifier,
      #[serde(default, flatten)]
      scope: Scopes,
    }

    UntaggedEnumVisitor::new()
      .string(|string| {
        let de = string.into_deserializer();
        Identifier::deserialize(de).map(Self::PermissionRef)
      })
      .map(|map| {
        let ext_perm = map.deserialize::<ExtendedPermissionStruct>()?;
        Ok(Self::ExtendedPermission {
          identifier: ext_perm.identifier,
          scope: ext_perm.scope,
        })
      })
      .deserialize(deserializer)
  }
}

/// A grouping and boundary mechanism developers can use to isolate access to the IPC layer.
///
/// It controls application windows' and webviews' fine grained access
/// to the Tauri core, application, or plugin commands.
/// If a webview or its window is not matching any capability then it has no access to the IPC layer at all.
///
/// This can be done to create groups of windows, based on their required system access, which can reduce
/// impact of frontend vulnerabilities in less privileged windows.
/// Windows can be added to a capability by exact name (e.g. `main-window`) or glob patterns like `*` or `admin-*`.
/// A Window can have none, one, or multiple associated capabilities.
///
/// ## Example
///
/// ```json
/// {
///   "identifier": "main-user-files-write",
///   "description": "This capability allows the `main` window on macOS and Windows access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.",
///   "windows": [
///     "main"
///   ],
///   "permissions": [
///     "core:default",
///     "dialog:open",
///     {
///       "identifier": "fs:allow-write-text-file",
///       "allow": [{ "path": "$HOME/test.txt" }]
///     },
///   ],
///   "platforms": ["macOS","windows"]
/// }
/// ```
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Capability {
  /// Identifier of the capability.
  ///
  /// ## Example
  ///
  /// `main-user-files-write`
  ///
  pub identifier: String,
  /// Description of what the capability is intended to allow on associated windows.
  ///
  /// It should contain a description of what the grouped permissions should allow.
  ///
  /// ## Example
  ///
  /// This capability allows the `main` window access to `filesystem` write related
  /// commands and `dialog` commands to enable programmatic access to files selected by the user.
  #[serde(default)]
  pub description: String,
  /// Configure remote URLs that can use the capability permissions.
  ///
  /// This setting is optional and defaults to not being set, as our
  /// default use case is that the content is served from our local application.
  ///
  /// :::caution
  /// Make sure you understand the security implications of providing remote
  /// sources with local system access.
  /// :::
  ///
  /// ## Example
  ///
  /// ```json
  /// {
  ///   "urls": ["https://*.mydomain.dev"]
  /// }
  /// ```
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub remote: Option<CapabilityRemote>,
  /// Whether this capability is enabled for local app URLs or not. Defaults to `true`.
  #[serde(default = "default_capability_local")]
  pub local: bool,
  /// List of windows that are affected by this capability. Can be a glob pattern.
  ///
  /// If a window label matches any of the patterns in this list,
  /// the capability will be enabled on all the webviews of that window,
  /// regardless of the value of [`Self::webviews`].
  ///
  /// On multiwebview windows, prefer specifying [`Self::webviews`] and omitting [`Self::windows`]
  /// for a fine grained access control.
  ///
  /// ## Example
  ///
  /// `["main"]`
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub windows: Vec<String>,
  /// List of webviews that are affected by this capability. Can be a glob pattern.
  ///
  /// The capability will be enabled on all the webviews
  /// whose label matches any of the patterns in this list,
  /// regardless of whether the webview's window label matches a pattern in [`Self::windows`].
  ///
  /// ## Example
  ///
  /// `["sub-webview-one", "sub-webview-two"]`
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub webviews: Vec<String>,
  /// List of permissions attached to this capability.
  ///
  /// Must include the plugin name as prefix in the form of `${plugin-name}:${permission-name}`.
  /// For commands directly implemented in the application itself only `${permission-name}`
  /// is required.
  ///
  /// ## Example
  ///
  /// ```json
  /// [
  ///   "core:default",
  ///   "shell:allow-open",
  ///   "dialog:open",
  ///   {
  ///     "identifier": "fs:allow-write-text-file",
  ///     "allow": [{ "path": "$HOME/test.txt" }]
  ///   }
  /// ]
  /// ```
  #[cfg_attr(feature = "schema", schemars(schema_with = "unique_permission"))]
  pub permissions: Vec<PermissionEntry>,
  /// Limit which target platforms this capability applies to.
  ///
  /// By default all platforms are targeted.
  ///
  /// ## Example
  ///
  /// `["macOS","windows"]`
  #[serde(skip_serializing_if = "Option::is_none")]
  pub platforms: Option<Vec<Target>>,
}

impl Capability {
  /// Whether this capability should be active based on the platform target or not.
  pub fn is_active(&self, target: &Target) -> bool {
    self
      .platforms
      .as_ref()
      .map(|platforms| platforms.contains(target))
      .unwrap_or(true)
  }
}

#[cfg(feature = "schema")]
fn unique_permission(generator: &mut schemars::r#gen::SchemaGenerator) -> schemars::schema::Schema {
  use schemars::schema;
  schema::SchemaObject {
    instance_type: Some(schema::InstanceType::Array.into()),
    array: Some(Box::new(schema::ArrayValidation {
      unique_items: Some(true),
      items: Some(generator.subschema_for::<PermissionEntry>().into()),
      ..Default::default()
    })),
    ..Default::default()
  }
  .into()
}

fn default_capability_local() -> bool {
  true
}

/// Configuration for remote URLs that are associated with the capability.
#[derive(Debug, Default, Clone, Serialize, Deserialize, Eq, PartialEq, PartialOrd, Ord, Hash)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct CapabilityRemote {
  /// Remote domains this capability refers to using the [URLPattern standard](https://urlpattern.spec.whatwg.org/).
  ///
  /// ## Examples
  ///
  /// - "https://*.mydomain.dev": allows subdomains of mydomain.dev
  /// - "https://mydomain.dev/api/*": allows any subpath of mydomain.dev/api
  pub urls: Vec<String>,
}

/// Capability formats accepted in a capability file.
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "schema", schemars(untagged))]
#[cfg_attr(test, derive(Debug, PartialEq))]
pub enum CapabilityFile {
  /// A single capability.
  Capability(Capability),
  /// A list of capabilities.
  List(Vec<Capability>),
  /// A list of capabilities.
  NamedList {
    /// The list of capabilities.
    capabilities: Vec<Capability>,
  },
}

impl CapabilityFile {
  /// Load the given capability file.
  pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, super::Error> {
    let path = path.as_ref();
    let capability_file =
      std::fs::read_to_string(path).map_err(|e| super::Error::ReadFile(e, path.into()))?;
    let ext = path.extension().unwrap().to_string_lossy().to_string();
    let file: Self = match ext.as_str() {
      "toml" => toml::from_str(&capability_file)?,
      "json" => serde_json::from_str(&capability_file)?,
      #[cfg(feature = "config-json5")]
      "json5" => json5::from_str(&capability_file)?,
      _ => return Err(super::Error::UnknownCapabilityFormat(ext)),
    };
    Ok(file)
  }
}

impl<'de> Deserialize<'de> for CapabilityFile {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    UntaggedEnumVisitor::new()
      .seq(|seq| seq.deserialize::<Vec<Capability>>().map(Self::List))
      .map(|map| {
        #[derive(Deserialize)]
        struct CapabilityNamedList {
          capabilities: Vec<Capability>,
        }

        let value: serde_json::Map<String, serde_json::Value> = map.deserialize()?;
        if value.contains_key("capabilitie
```

### Core Architecture Module: `crates/tauri-utils/src/acl/identifier.rs`
```
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Identifier for plugins.

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::num::NonZeroU8;
use thiserror::Error;

const IDENTIFIER_SEPARATOR: u8 = b':';
const PLUGIN_PREFIX: &str = "tauri-plugin-";
const CORE_PLUGIN_IDENTIFIER_PREFIX: &str = "core:";

// <https://doc.rust-lang.org/cargo/reference/manifest.html#the-name-field>
const MAX_LEN_PREFIX: usize = 64 - PLUGIN_PREFIX.len();
const MAX_LEN_BASE: usize = 64;
const MAX_LEN_IDENTIFIER: usize = MAX_LEN_PREFIX + 1 + MAX_LEN_BASE;

/// Permission identifier.
///
/// Typically used in the [`permissions`](crate::acl::Capability::permissions) field of a capability file.
/// (e.g. `core:default`, `sample:allow-ping-scoped`)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Identifier {
  inner: String,
  separator: Option<NonZeroU8>,
}

#[cfg(feature = "schema")]
impl schemars::JsonSchema for Identifier {
  fn schema_name() -> String {
    "Identifier".to_string()
  }

  fn schema_id() -> std::borrow::Cow<'static, str> {
    // Include the module, in case a type with the same name is in another module/crate
    std::borrow::Cow::Borrowed(concat!(module_path!(), "::Identifier"))
  }

  fn json_schema(generator: &mut schemars::r#gen::SchemaGenerator) -> schemars::schema::Schema {
    String::json_schema(generator)
  }
}

impl AsRef<str> for Identifier {
  #[inline(always)]
  fn as_ref(&self) -> &str {
    &self.inner
  }
}

impl Identifier {
  /// Get the identifier str.
  #[inline(always)]
  pub fn get(&self) -> &str {
    self.as_ref()
  }

  /// Get the identifier without prefix.
  pub fn get_base(&self) -> &str {
    match self.separator_index() {
      None => self.get(),
      Some(i) => &self.inner[i + 1..],
    }
  }

  /// Get the prefix of the identifier.
  pub fn get_prefix(&self) -> Option<&str> {
    self.separator_index().map(|i| &self.inner[0..i])
  }

  /// Set the identifier prefix.
  pub fn set_prefix(&mut self) -> Result<(), ParseIdentifierError> {
    todo!()
  }

  /// Get the identifier string and its separator.
  pub fn into_inner(self) -> (String, Option<NonZeroU8>) {
    (self.inner, self.separator)
  }

  fn separator_index(&self) -> Option<usize> {
    self.separator.map(|i| i.get() as usize)
  }
}

#[derive(Debug)]
enum ValidByte {
  Separator,
  Byte(u8),
}

impl ValidByte {
  fn alpha_numeric(byte: u8) -> Option<Self> {
    byte.is_ascii_alphanumeric().then_some(Self::Byte(byte))
  }

  fn alpha_numeric_hyphen(byte: u8) -> Option<Self> {
    (byte.is_ascii_alphanumeric() || byte == b'-').then_some(Self::Byte(byte))
  }

  fn next(&self, next: u8) -> Option<ValidByte> {
    match (self, next) {
      (ValidByte::Byte(b'-'), IDENTIFIER_SEPARATOR) => None,
      (ValidByte::Separator, b'-') => None,

      (_, IDENTIFIER_SEPARATOR) => Some(ValidByte::Separator),
      (ValidByte::Separator, next) => ValidByte::alpha_numeric(next),
      (ValidByte::Byte(b'-'), next) => ValidByte::alpha_numeric_hyphen(next),
      (ValidByte::Byte(b'_'), next) => ValidByte::alpha_numeric_hyphen(next),
      (ValidByte::Byte(_), next) => ValidByte::alpha_numeric_hyphen(next),
    }
  }
}

/// Errors that can happen when parsing an identifier.
#[derive(Debug, Error)]
pub enum ParseIdentifierError {
  /// Identifier start with the plugin prefix.
  #[error("identifiers cannot start with {}", PLUGIN_PREFIX)]
  StartsWithTauriPlugin,

  /// Identifier empty.
  #[error("identifiers cannot be empty")]
  Empty,

  /// Identifier is too long.
  #[error("identifiers cannot be longer than {len}, found {0}", len = MAX_LEN_IDENTIFIER)]
  Humongous(usize),

  /// Identifier is not in a valid format.
  #[error(
    "identifiers can only include lowercase ASCII, hyphens which are not leading or trailing, and a single colon if using a prefix"
  )]
  InvalidFormat,

  /// Identifier has multiple separators.
  #[error(
    "identifiers can only include a single separator '{}'",
    IDENTIFIER_SEPARATOR
  )]
  MultipleSeparators,

  /// Identifier has a trailing hyphen.
  #[error("identifiers cannot have a trailing hyphen")]
  TrailingHyphen,

  /// Identifier has a prefix without a base.
  #[error("identifiers cannot have a prefix without a base")]
  PrefixWithoutBase,
}

impl TryFrom<String> for Identifier {
  type Error = ParseIdentifierError;

  fn try_from(value: String) -> Result<Self, Self::Error> {
    if value.starts_with(PLUGIN_PREFIX) {
      return Err(Self::Error::StartsWithTauriPlugin);
    }

    if value.is_empty() {
      return Err(Self::Error::Empty);
    }

    if value.len() > MAX_LEN_IDENTIFIER {
      return Err(Self::Error::Humongous(value.len()));
    }

    let is_core_identifier = value.starts_with(CORE_PLUGIN_IDENTIFIER_PREFIX);

    let mut bytes = value.bytes();

    // grab the first byte only before parsing the rest
    let mut prev = bytes
      .next()
      .and_then(ValidByte::alpha_numeric)
      .ok_or(Self::Error::InvalidFormat)?;

    let mut idx = 0;
    let mut separator = None;
    for byte in bytes {
      idx += 1; // we already consumed first item
      match prev.next(byte) {
        None => return Err(Self::Error::InvalidFormat),
        Some(next @ ValidByte::Byte(_)) => prev = next,
        Some(ValidByte::Separator) => {
          if separator.is_none() || is_core_identifier {
            // safe to unwrap because idx starts at 1 and cannot go over MAX_IDENTIFIER_LEN
            separator = Some(idx.try_into().unwrap());
            prev = ValidByte::Separator
          } else {
            return Err(Self::Error::MultipleSeparators);
          }
        }
      }
    }

    match prev {
      // empty base
      ValidByte::Separator => return Err(Self::Error::PrefixWithoutBase),

      // trailing hyphen
      ValidByte::Byte(b'-') => return Err(Self::Error::TrailingHyphen),

      _ => (),
    }

    Ok(Self {
      inner: value,
      separator,
    })
  }
}

impl<'de> Deserialize<'de> for Identifier {
  fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    let raw = String::deserialize(deserializer)?;
    Self::try_from(raw.clone()).map_err(|e| {
      serde::de::Error::custom(format!(
        "invalid plugin or permission identifier '{raw}': {e}"
      ))
    })
  }
}

impl Serialize for Identifier {
  fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    serializer.serialize_str(self.get())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn ident(s: impl Into<String>) -> Result<Identifier, ParseIdentifierError> {
    Identifier::try_from(s.into())
  }

  #[test]
  fn max_len_fits_in_u8() {
    assert!(MAX_LEN_IDENTIFIER < u8::MAX as usize)
  }

  #[test]
  fn format() {
    assert!(ident("prefix:base").is_ok());
    assert!(ident("prefix3:base").is_ok());
    assert!(ident("preFix:base").is_ok());

    // bad
    assert!(ident("tauri-plugin-prefix:base").is_err());

    assert!(ident("-prefix-:-base-").is_err());
    assert!(ident("-prefix:base").is_err());
    assert!(ident("prefix-:base").is_err());
    assert!(ident("prefix:-base").is_err());
    assert!(ident("prefix:base-").is_err());

    assert!(ident("pre--fix:base--sep").is_ok());
    assert!(ident("prefix:base--sep").is_ok());
    assert!(ident("pre--fix:base").is_ok());

    assert!(ident("prefix::base").is_err());
    assert!(ident(":base").is_err());
    assert!(ident("prefix:").is_err());
    assert!(ident(":prefix:base:").is_err());
    assert!(ident("base:").is_err());

    assert!(ident("").is_err());
    assert!(ident("💩").is_err());

    assert!(ident("a".repeat(MAX_LEN_IDENTIFIER + 1)).is_err());
  }

  #[test]
  fn base() {
    assert_eq!(ident("prefix:base").unwrap().get_base(), "base");
    assert_eq!(ident("base").unwrap().get_base(), "base");
  }

  #[test]
  fn prefix() {
    assert_eq!(ident("prefix:base").unwrap().get_prefix(), Some("prefix"));
    assert_eq!(ident("base").unwrap().get_prefix(), None);
  }
}

#[cfg(any(feature = "build", feature = "build-2"))]
mod build {
  use proc_macro2::TokenStream;
  use quote::{ToTokens, TokenStreamExt, quote};

  use super::*;

  impl ToTokens for Identifier {
    fn to_tokens(&self, tokens: &mut TokenStream) {
      let s = self.get();
      tokens
        .append_all(quote! { ::tauri::utils::acl::Identifier::try_from(#s.to_string()).unwrap() })
    }
  }
}

```

### Core Architecture Module: `crates/tauri-utils/src/acl/manifest.rs`
```
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Plugin ACL types.

use std::{collections::BTreeMap, num::NonZeroU64};

use super::{Permission, PermissionSet};
#[cfg(feature = "schema")]
use schemars::schema::*;
use serde::{Deserialize, Serialize};

/// The default permission set of the plugin.
///
/// Works similarly to a permission with the "default" identifier.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct DefaultPermission {
  /// The version of the permission.
  pub version: Option<NonZeroU64>,

  /// Human-readable description of what the permission does.
  /// Tauri convention is to use `<h4>` headings in markdown content
  /// for Tauri documentation generation purposes.
  pub description: Option<String>,

  /// All permissions this set contains.
  pub permissions: Vec<String>,
}

/// Permission file that can define a default permission, a set of permissions or a list of inlined permissions.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct PermissionFile {
  /// The default permission set for the plugin
  pub default: Option<DefaultPermission>,

  /// A list of permissions sets defined
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub set: Vec<PermissionSet>,

  /// A list of inlined permissions
  #[serde(default)]
  pub permission: Vec<Permission>,
}

/// Plugin manifest.
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Manifest {
  /// Default permission.
  pub default_permission: Option<PermissionSet>,
  /// Plugin permissions.
  pub permissions: BTreeMap<String, Permission>,
  /// Plugin permission sets.
  pub permission_sets: BTreeMap<String, PermissionSet>,
  /// The global scope schema.
  pub global_scope_schema: Option<serde_json::Value>,
}

impl Manifest {
  /// Creates a new manifest from the given plugin permission files and global scope schema.
  pub fn new(
    permission_files: Vec<PermissionFile>,
    global_scope_schema: Option<serde_json::Value>,
  ) -> Self {
    let mut manifest = Self {
      default_permission: None,
      permissions: BTreeMap::new(),
      permission_sets: BTreeMap::new(),
      global_scope_schema,
    };

    for permission_file in permission_files {
      if let Some(default) = permission_file.default {
        manifest.default_permission.replace(PermissionSet {
          identifier: "default".into(),
          description: default
            .description
            .unwrap_or_else(|| "Default plugin permissions.".to_string()),
          permissions: default.permissions,
        });
      }

      for permission in permission_file.permission {
        let key = permission.identifier.clone();
        manifest.permissions.insert(key, permission);
      }

      for set in permission_file.set {
        let key = set.identifier.clone();
        manifest.permission_sets.insert(key, set);
      }
    }

    manifest
  }
}

#[cfg(feature = "schema")]
type ScopeSchema = (Schema, schemars::Map<String, Schema>);

#[cfg(feature = "schema")]
impl Manifest {
  /// Return scope schema and extra schema definitions for this plugin manifest.
  pub fn global_scope_schema(&self) -> Result<Option<ScopeSchema>, super::Error> {
    self
      .global_scope_schema
      .as_ref()
      .map(|s| {
        serde_json::from_value::<RootSchema>(s.clone()).map(|s| {
          // convert RootSchema to Schema
          let scope_schema = Schema::Object(SchemaObject {
            array: Some(Box::new(ArrayValidation {
              items: Some(Schema::Object(s.schema).into()),
              ..Default::default()
            })),
            ..Default::default()
          });

          (scope_schema, s.definitions)
        })
      })
      .transpose()
      .map_err(Into::into)
  }
}

#[cfg(any(feature = "build", feature = "build-2"))]
mod build {
  use proc_macro2::TokenStream;
  use quote::{ToTokens, TokenStreamExt, quote};
  use std::convert::identity;

  use super::*;
  use crate::{literal_struct, tokens::*};

  impl ToTokens for DefaultPermission {
    fn to_tokens(&self, tokens: &mut TokenStream) {
      let version = opt_lit_owned(self.version.as_ref().map(|v| {
        let v = v.get();
        quote!(::core::num::NonZeroU64::new(#v).unwrap())
      }));
      // Only used in build script and macros, so don't include them in runtime
      let description = quote! { ::core::option::Option::None };
      let permissions = vec_lit(&self.permissions, str_lit);
      literal_struct!(
        tokens,
        ::tauri::utils::acl::plugin::DefaultPermission,
        version,
        description,
        permissions
      )
    }
  }

  impl ToTokens for Manifest {
    fn to_tokens(&self, tokens: &mut TokenStream) {
      let default_permission = opt_lit(self.default_permission.as_ref());

      let permissions = map_lit(
        quote! { ::std::collections::BTreeMap },
        &self.permissions,
        str_lit,
        identity,
      );

      let permission_sets = map_lit(
        quote! { ::std::collections::BTreeMap },
        &self.permission_sets,
        str_lit,
        identity,
      );

      // Only used in build script and macros, so don't include them in runtime
      // let global_scope_schema =
      //   opt_lit_owned(self.global_scope_schema.as_ref().map(json_value_lit));
      let global_scope_schema = quote! { ::core::option::Option::None };

      literal_struct!(
        tokens,
        ::tauri::utils::acl::manifest::Manifest,
        default_permission,
        permissions,
        permission_sets,
        global_scope_schema
      )
    }
  }
}

```

### Core Architecture Module: `crates/tauri-utils/src/acl/mod.rs`
```
// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Access Control List types.
//!
//! # Stability
//!
//! This is a core functionality that is not considered part of the stable API.
//! If you use it, note that it may include breaking changes in the future.
//!
//! These items are intended to be non-breaking from a de/serialization standpoint only.
//! Using and modifying existing config values will try to avoid breaking changes, but they are
//! free to add fields in the future - causing breaking changes for creating and full destructuring.
//!
//! To avoid this, [ignore unknown fields when destructuring] with the `{my, config, ..}` pattern.
//! If you need to create the Rust config directly without deserializing, then create the struct
//! the [Struct Update Syntax] with `..Default::default()`, which may need a
//! `#[allow(clippy::needless_update)]` attribute if you are declaring all fields.
//!
//! [ignore unknown fields when destructuring]: https://doc.rust-lang.org/book/ch18-03-pattern-syntax.html#ignoring-remaining-parts-of-a-value-with-
//! [Struct Update Syntax]: https://doc.rust-lang.org/book/ch05-01-defining-structs.html#creating-instances-from-other-instances-with-struct-update-syntax

use anyhow::Context;
use capability::{Capability, CapabilityFile};
use serde::{Deserialize, Serialize};
use std::{
  collections::{BTreeMap, HashSet},
  fs,
  num::NonZeroU64,
  path::PathBuf,
  str::FromStr,
  sync::Arc,
};
use thiserror::Error;
use url::Url;

use crate::{
  config::{CapabilityEntry, Config},
  platform::Target,
};

pub use self::{identifier::*, value::*};

/// Known foldername of the permission schema files
pub const PERMISSION_SCHEMAS_FOLDER_NAME: &str = "schemas";
/// Known filename of the permission schema JSON file
pub const PERMISSION_SCHEMA_FILE_NAME: &str = "schema.json";
/// Known ACL key for the app permissions.
pub const APP_ACL_KEY: &str = "__app-acl__";
/// Known acl manifests file
pub const ACL_MANIFESTS_FILE_NAME: &str = "acl-manifests.json";
/// Known capabilities file
pub const CAPABILITIES_FILE_NAME: &str = "capabilities.json";
/// Allowed commands file name
pub const ALLOWED_COMMANDS_FILE_NAME: &str = "allowed-commands.json";
/// Set by the CLI with when `build > removeUnusedCommands` is set for dead code elimination,
/// the value is set to the config's directory
pub const REMOVE_UNUSED_COMMANDS_ENV_VAR: &str = "REMOVE_UNUSED_COMMANDS";

#[cfg(any(feature = "build", feature = "build-2"))]
pub mod build;
pub mod capability;
pub mod identifier;
pub mod manifest;
pub mod resolved;
#[cfg(feature = "schema")]
pub mod schema;
pub mod value;

/// Possible errors while processing ACL files.
#[derive(Debug, Error)]
pub enum Error {
  /// Could not find an environmental variable that is set inside of build scripts.
  ///
  /// Whatever generated this should be called inside of a build script.
  #[error(
    "expected build script env var {0}, but it was not found - ensure this is called in a build script"
  )]
  BuildVar(&'static str),

  /// The links field in the manifest **MUST** be set and match the name of the crate.
  #[error(
    "package.links field in the Cargo manifest is not set, it should be set to the same as package.name"
  )]
  LinksMissing,

  /// The links field in the manifest **MUST** match the name of the crate.
  #[error(
    "package.links field in the Cargo manifest MUST be set to the same value as package.name"
  )]
  LinksName,

  /// IO error while reading a file
  #[error("failed to read file '{}': {}", _1.display(), _0)]
  ReadFile(std::io::Error, PathBuf),

  /// IO error while writing a file
  #[error("failed to write file '{}': {}", _1.display(), _0)]
  WriteFile(std::io::Error, PathBuf),

  /// IO error while creating a file
  #[error("failed to create file '{}': {}", _1.display(), _0)]
  CreateFile(std::io::Error, PathBuf),

  /// IO error while creating a dir
  #[error("failed to create dir '{}': {}", _1.display(), _0)]
  CreateDir(std::io::Error, PathBuf),

  /// [`cargo_metadata`] was not able to complete successfully
  #[cfg(any(feature = "build", feature = "build-2"))]
  #[error("failed to execute: {0}")]
  Metadata(#[from] ::cargo_metadata::Error),

  /// Invalid glob
  #[error("failed to run glob: {0}")]
  Glob(#[from] glob::PatternError),

  /// Invalid TOML encountered
  #[error("failed to parse TOML: {0}")]
  Toml(#[from] toml::de::Error),

  /// Invalid JSON encountered
  #[error("failed to parse JSON: {0}")]
  Json(#[from] serde_json::Error),

  /// Invalid JSON5 encountered
  #[cfg(feature = "config-json5")]
  #[error("failed to parse JSON5: {0}")]
  Json5(#[from] json5::Error),

  /// Invalid permissions file format
  #[error("unknown permission format {0}")]
  UnknownPermissionFormat(String),

  /// Invalid capabilities file format
  #[error("unknown capability format {0}")]
  UnknownCapabilityFormat(String),

  /// Permission referenced in set not found.
  #[error("permission {permission} not found from set {set}")]
  SetPermissionNotFound {
    /// Permission identifier.
    permission: String,
    /// Set identifier.
    set: String,
  },

  /// Unknown ACL manifest.
  #[error("unknown ACL for {key}, expected one of {available}")]
  UnknownManifest {
    /// Manifest key.
    key: String,
    /// Available manifest keys.
    available: String,
  },

  /// Unknown permission.
  #[error("unknown permission {permission} for {key}")]
  UnknownPermission {
    /// Manifest key.
    key: String,

    /// Permission identifier.
    permission: String,
  },

  /// Capability with the given identifier already exists.
  #[error("capability with identifier `{identifier}` already exists")]
  CapabilityAlreadyExists {
    /// Capability identifier.
    identifier: String,
  },
}

/// Allowed and denied commands inside a permission.
///
/// If two commands clash inside of `allow` and `deny`, it should be denied by default.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Commands {
  /// Allowed command.
  #[serde(default)]
  pub allow: Vec<String>,

  /// Denied command, which takes priority.
  #[serde(default)]
  pub deny: Vec<String>,
}

/// An argument for fine grained behavior control of Tauri commands.
///
/// It can be of any serde serializable type and is used to allow or prevent certain actions inside a Tauri command.
/// The configured scope is passed to the command and will be enforced by the command implementation.
///
/// ## Example
///
/// ```json
/// {
///   "allow": [{ "path": "$HOME/**" }],
///   "deny": [{ "path": "$HOME/secret.txt" }]
/// }
/// ```
#[derive(Debug, Default, PartialEq, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Scopes {
  /// Data that defines what is allowed by the scope.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub allow: Option<Vec<Value>>,
  /// Data that defines what is denied by the scope. This should be prioritized by validation logic.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub deny: Option<Vec<Value>>,
}

impl Scopes {
  fn is_empty(&self) -> bool {
    self.allow.is_none() && self.deny.is_none()
  }
}

/// Descriptions of explicit privileges of commands.
///
/// It can enable commands to be accessible in the frontend of the application.
///
/// If the scope is defined it can be used to fine grain control the access of individual or multiple commands.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Permission {
  /// The version of the permission.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub version: Option<NonZeroU64>,

  /// A unique identifier for the permission.
  pub identifier: String,

  /// Human-readable description of what the permission does.
  /// Tauri internal convention is to use `<h4>` headings in markdown content
  /// for Tauri documentation generation purposes.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub description: Option<String>,

  /// Allowed or denied commands when using this permission.
  #[serde(default)]
  pub commands: Commands,

  /// Allowed or denied scoped when using this permission.
  #[serde(default, skip_serializing_if = "Scopes::is_empty")]
  pub scope: Scopes,

  /// Target platforms this permission applies. By default all platforms are affected by this permission.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub platforms: Option<Vec<Target>>,
}

impl Permission {
  /// Whether this permission should be active based on the platform target or not.
  pub fn is_active(&self, target: &Target) -> bool {
    self
      .platforms
      .as_ref()
      .map(|platforms| platforms.contains(target))
      .unwrap_or(true)
  }
}

/// A set of direct permissions grouped together under a new name.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct PermissionSet {
  /// A unique identifier for the permission.
  pub identifier: String,

  /// Human-readable description of what the permission does.
  pub description: String,

  /// All permissions this set contains.
  pub permissions: Vec<String>,
}

/// UrlPattern for [`ExecutionContext::Remote`].
#[derive(Debug, Clone)]
pub struct RemoteUrlPattern(Arc<urlpattern::UrlPattern>, String);

impl FromStr for RemoteUrlPattern {
  type Err = urlpattern::quirks::Error;

  fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
    let mut init = urlpattern::UrlPatternInit::parse_constructor_string::<regex::Regex>(s, None)?;
    if init.search.as_ref().map(|p| p.is_empty()).unwrap_or(true) {
      init.search.replace("*".to_string());
    }
    if init.hash.as_ref().map(|p| p.is_empty()).unwrap_or(true) {
      init.hash.replace("*".to_string());
    }
    if init
      .pathname
      .as_ref(
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16228** (2026-10-07): **fix(core): do not panic when a replayed queued emit reaches a once handler**
  *Symptoms*: Fixes #16214.  `Listener::once` panics with `attempted to call handler more than once` when a queued emit is replayed before the handler's own queued unlisten is processed. This needs a listener present that emits the same event from inside its handler: handlers run while the listeners lock is held, so the re-emit and the `once` handler's `unlisten` both queue, and when the queued emit is replayed it can reach the `once` listener a second time before the pending unlisten runs. The reporter's repro on the public API hits the panic 199 out of 200 runs depending on HashMap order.  The `take().expect()` guard was introduced in #15475 to make `once` tolerate multiple calls on one path, but a double dispatch through the queued-emit replay still trips it. A second dispatch of an already-consumed `once` handler should be a no-op, not a panic, so this changes the call site to consume the handler before calling it:  ```rust if let Some(handler) = handler.take() {   handler(event); } ```  This is the same change the reporter validated in the issue (0 out of 200 runs panic with it).  The new `once_survives_a_replayed_queued_emit` test registers 32 re-emitting listeners and one `once` listener on the raw `Listeners` API, then emits. Verified against both forms: it fails with the #16214 panic on the current code and passes with this change. It sits next to the existing `event_no_deadlocks` test, which covers the single-listener variant of this scenario. 

- **Issue #16222** (2026-10-07): **fix: panic on repeated `once` listener events**
  *Symptoms*: Fix #16214 closes #16228
  **Post-Mortem & Fix Analysis**:
  > <!-- Covector Action --> <!-- Covector Action --> ### Package Changes Through f4d6b2aed88831d5dc9c0182cbc6c3d9e61a765a There are 2 changes which include @tauri-apps/api with patch, tauri with patch  <details> <summary><i>Planned Package Versions</i></summary>  The following package releases are the planned based on the context of changes in this pull request. | package | current | next |   |----|----|----| | @tauri-apps/api | 2.12.1 | 2.12.2 |  tauri | 2.12.1 | 2.12.2 |  </details>  [Add another change file through the GitHub UI by following this link.](https://github.com/Legend-Master/tauri/new/once-listener-panic?filename=.changes/change-pr-16222.md&value=---%0A%22@tauri-apps/api%22:%20patch%0A%22tauri-utils%22:%20patch%0A%22tauri-macos-sign%22:%20patch%0A%22tauri-bundler%22:%20patch%0A%22tauri-runtime%22:%20patch%0A%22tauri-runtime-wry%22:%20patch%0A%22tauri-codegen%22:%20patch%0A%22tauri-macros%22:%20patch%0A%22tauri-plugin%22:%20patch%0A%22tauri-build%22:%20patch%0A%22tauri%22:%20

- **Issue #16214** (2026-10-07): **[bug] `Listener::once` panics when a queued emit is replayed before its queued unlisten**
  *Symptoms*: ### Describe the bug  `once` wraps the handler as `unlisten(id)` and then `handler.take().expect("attempted to call handler more than once")`. While `emit_filter` holds the handlers lock, that `unlisten` is queued in `pending`. An emit of the same event that arrived while the lock was held is queued there too. If that emit was queued *before* the handler ran, `flush_pending` replays it first. The handler is still registered, so it runs a second time and panics.  #15475 fixed the case where the handler itself emits, but not an emit that was already queued. #15759 makes it more likely, because the replayed emit has lost its target filter, so events for other windows reach the listener too.  ### Reproduction  Intermittent. We hit it on Linux (WebKitGTK) when waiting with `WebviewWindow::once("tauri://resize" | "tauri://move", …)` after `set_size` / `unmaximize`. GTK sends configure events in bursts. It reproduces on 2.11.2 and 2.12.1, and the code is unchanged on `dev`.  ``` panicked at tauri-2.11.2/src/event/listener.rs:173:10: attempted to call handler more than once   Listeners::once::{closure}   Listeners::emit_filter   Listeners::emit             <- replayed Pending::Emit   Listeners::flush_pending   Listeners::emit_filter      <- Window::emit_to_window (tauri://resize)   manager::window::on_window_event ```  ### Expected behavior  A `once` handler runs at most once, without panicking.  ### Suggested fix  Skip a repeat call instead of panicking:  ```rust if let Some(handler
  **Post-Mortem & Fix Analysis**:
  > A repro using the public API and the mock runtime (`tauri = { version = "2.12.1", features = ["test"] }`). It doubles as a regression test:  ```rust use std::sync::atomic::{AtomicBool, Ordering}; use tauri::{Emitter, Listener};  #[test] fn once_survives_a_replayed_queued_emit() {     for _ in 0..10 {         let app = tauri::test::mock_app();         for _ in 0..32 {             let handle = app.handle().clone();             let emitted = AtomicBool::new(false);             app.listen("event", move |_| {                 // The listener lock is held while handlers run, so this emit is queued.                 if !emitted.swap(true, Ordering::SeqCst) {                     let _ = handle.emit("event", ());                 }             });         }         app.once("event", |_| {});         // Panics whenever a re-emitter runs before the `once` handler (HashMap order).         app.emit("event", ()).unwrap();     } } ```  - **2.12.1:** fails with `panicked at tauri-2.12.1/src/event/listene

- **Issue #16212** (2026-10-05): **feat(bundler): add `sidecarEntitlements` option to sign macOS sidecars with their own entitlements**
  *Symptoms*: Closes #16211  ## Problem  On macOS every external binary (`bundle > externalBin`) is signed with the app's entitlements. If the app uses a restricted entitlement (iCloud, associated domains, push notifications, ...), the sidecar claims it too. The embedded provisioning profile only authorizes the main executable, so AMFI kills the sidecar at launch (`Killed: 9`, "No matching profile found"). `codesign --verify` and notarization still pass.  ## Change  - New config option `bundle > macOS > sidecarEntitlements`: path to the entitlements file used to sign external binaries. - When the option is unset, external binaries are signed with the app's entitlements as before. Existing projects see no change. - `SignTarget` gets an `entitlements: SignEntitlements` field (`None`, `App`, `Sidecar`), so each sign target states which entitlements it gets. `sign()` no longer reads the app entitlements for every target. - Libraries, frameworks and the DMG are `SignEntitlements::None`. This restores the intent of #12423, whose `is_an_executable` condition was dropped in #14031. - Executables nested inside bundled frameworks keep the app's entitlements, as they did after #12423. This PR does not change them.  Example:  ```json "bundle": {   "externalBin": ["binaries/my-sidecar"],   "macOS": {     "entitlements": "Entitlements.plist",     "sidecarEntitlements": "Sidecar.entitlements.plist"   } } ```  An empty `<dict/>` plist signs the sidecars with no entitlements.  ## Alternatives considered  -

- **Issue #16211** (2026-10-05): **[bug] macOS: sidecars (externalBin) are signed with the app's entitlements, so restricted entitlements make them crash at launch**
  *Symptoms*: ### Describe the bug  On macOS, the bundler signs every external binary (`bundle > externalBin`) with the same entitlements file as the app (`bundle > macOS > entitlements`). There is no way to give a sidecar different entitlements, or none.  This breaks any app that combines a sidecar with a *restricted* entitlement, that is, one that must be authorized by a provisioning profile (iCloud, associated domains, push notifications, and so on). The embedded provisioning profile only authorizes the main executable of the bundle. A sidecar that claims the same entitlement has no matching profile, so AMFI kills it at launch. This is the log from a Developer ID signed and notarized build:  ``` amfid: Restricted entitlements not validated, bailing out. Error: Error Domain=AppleMobileFileIntegrityError Code=-413 "No matching profile found" amfid: /path/to/My.app/Contents/MacOS/my-sidecar not valid: Error Domain=AppleMobileFileIntegrityError Code=-413 "No matching profile found" ```  The process exits with `Killed: 9` (exit code 137). `codesign --verify --deep --strict` and notarization both pass, so nothing in the build reports the problem.  Tauri can also trigger this by itself: when the deep-link plugin config has `domains`, the CLI adds `com.apple.developer.associated-domains` to the entitlements (#14031), and that entitlement is then applied to every sidecar too.  Where it happens (tag `tauri-cli-v2.12.1`):  - `crates/tauri-bundler/src/bundle/macos/app.rs` adds each external binary 

- **Issue #16209** (2026-10-04): **[bug] tauri-runtime 2.12 contains breaking changes to RuntimeHandle::primary_monitor which breaks compatibility with tauri 2.11.5**
  *Symptoms*: ### Describe the bug  tauri-runtime 2.12.1 contains breaking changes to RuntimeHandle::primary_monitor which breaks compatibility with tauri 2.11.5.    ### Reproduction  1. Install tauri 2.11.5 with tauri-runtime 2.12.1. 2. compile  ### Expected behavior  No compile error.  ### Full `tauri info` output  ```text [✔] Environment     - OS: Mac OS 27.0.0 arm64 (X64)     ✔ Xcode Command Line Tools: installed     ✔ Xcode: 26.6     ✔ rustc: 1.100.0-beta.1 (e3feeb59c 2026-09-27)     ✔ cargo: 1.100.0-beta.1 (3d7cf6e93 2026-09-25)     ✔ rustup: 1.29.0 (28d1352db 2026-03-05)     ✔ Rust toolchain: beta-aarch64-apple-darwin (overridden by '/Users/anatawa12/RustroverProjects/vrc-get/rust-toolchain.toml')     - node: 24.18.0     - pnpm: 11.17.0     - yarn: 1.22.22     - npm: 11.16.0     - deno: deno 2.8.1  [-] Packages     - tauri 🦀: 2.11.5, (outdated, latest: 2.12.1)     - tauri-build 🦀: 2.7.1     - wry 🦀: 0.57.0     - tao 🦀: 0.37.1     - @tauri-apps/api  ⱼₛ: 2.11.1 (outdated, latest: 2.12.1)     - @tauri-apps/cli  ⱼₛ: 2.11.4 (outdated, latest: 2.12.1)  [-] Plugins     - tauri-plugin-single-instance 🦀: 2.4.5, (outdated, latest: 2.5.2)     - @tauri-apps/plugin-single-instance  ⱼₛ: not installed!     - tauri-plugin-dialog 🦀: 2.7.3, (outdated, latest: 2.8.1)     - @tauri-apps/plugin-dialog  ⱼₛ: not installed!     - tauri-plugin-fs 🦀: 2.5.2, (outdated, latest: 2.6.0)     - @tauri-apps/plugin-fs  ⱼₛ: not installed!  [-] App     - build-type: build     - CSP: unset     - frontendDist: out
  **Post-Mortem & Fix Analysis**:
  > can you share the error message?
  > https://github.com/tauri-apps/tauri/pull/15630#issuecomment-5236309687 for the reference. Ideally this wouldn't be a problem in the future that we now lock tauri-runtime in tauri to minor versions now.  I don't think there's much we can do here, just update both at the same time 😥 (I think it had breakages in every minor but maybe not affecting tauri, just the implementer crates like the tauri-runtime-wry so nobody noticed)
  > ahhh i remember, thanks. sucks but it is what it is

- **Issue #16208** (2026-10-04): **[bug] NSIS: signed plugin copies are never used, so System.dll, nsDialogs.dll, StartMenu.dll and NSISdl.dll ship unsigned**
  *Symptoms*: ### Describe the bug  With Windows signing configured (`bundle.windows.signCommand`), the NSIS bundler logs "Signing NSIS plugins" and signs copies of the stock plugins. The installer it produces still contains unsigned `System.dll`, `nsDialogs.dll`, `StartMenu.dll` and `NSISdl.dll`. Only `nsis_tauri_utils.dll` comes out signed.  The cause is in `crates/tauri-bundler/src/bundle/windows/nsis/mod.rs` (tauri-bundler 2.9.2, as shipped with @tauri-apps/cli 2.11.2):  1. It copies `Plugins/x86-unicode` from the NSIS toolset into `<output>/Plugins` (around line 244). 2. It signs the files in `NSIS_PLUGIN_FILES` inside that copy (around line 646). 3. It hands the copy to makensis through an environment variable: `nsis_cmd.env("NSISPLUGINS", plugins_path)` (line 665).  makensis does not read `NSISPLUGINS`. The name does not appear anywhere in the NSIS 3.11 source. Default plugins are loaded only from `${NSISDIR}/Plugins/<target>` (`Source/build.cpp`, around line 3766 in v311), so the unsigned originals in the toolset are the ones that get packed. `nsis_tauri_utils.dll` is unaffected because `installer.nsi` adds its folder explicitly with `!addplugindir "${ADDITIONALPLUGINSPATH}"`, and when signing that path points at the signed copy.  We observed this bundling on macOS with NSIS 3.11. From reading the source, Windows looks the same, since makensis.exe there also takes its default plugins from its own toolset folder, but we have not run it on Windows.  ### Reproduction  1. Configure `bu
  **Post-Mortem & Fix Analysis**:
  > > (tauri-bundler 2.9.2, as shipped with @tauri-apps/cli 2.11.2):  That is crazy unlucky. It was fixed in cli 2.11.3 via https://github.com/tauri-apps/tauri/pull/15422  Please re-test it with a newer version of the cli. If it still has issues we can re-open this issue.

- **Issue #16195** (2026-10-07): **fix(api): return awaitable cleanup from combined event listeners**
  *Symptoms*: ### What kind of change does this PR introduce?  Bug fix.  The combined cleanup functions returned by `Webview.onDragDropEvent`, `Window.onDragDropEvent` and `Window.onFocusChanged` in `@tauri-apps/api` called each inner unlisten function but discarded the promises they return. The cleanup returned `undefined`, so a rejecting inner unlisten (e.g. the listener was already removed, or the `plugin:event|unlisten` invoke failed) surfaced as an unhandled promise rejection — commonly on React unmount, when cleanup races listener registration or teardown.  ### What is the current behavior?  ```ts return () => {   unlistenDragEnter()   unlistenDragDrop()   unlistenDragOver()   unlistenDragLeave() } ```  Callers have nothing to `await` or `.catch()`. See #16194.  ### What is the new behavior?  Each combined cleanup is now `async` and awaits all inner unlistens:  ```ts return async () => {   await Promise.all([     unlistenDragEnter(),     unlistenDragDrop(),     unlistenDragOver(),     unlistenDragLeave()   ]) } ```  Affected APIs:  - `Webview.onDragDropEvent` (`packages/api/src/webview.ts`) — 4 listeners - `Window.onDragDropEvent` (`packages/api/src/window.ts`) — 4 listeners - `Window.onFocusChanged` (`packages/api/src/window.ts`) — 2 listeners  A grep of `packages/api/src` for other `return () => { unlistenX(); ... }` combined cleanups found no other instances.  ### Backwards compatibility  `UnlistenFn` is typed `() => void`, so an async function stays assignable and the public type
  **Post-Mortem & Fix Analysis**:
  > <!-- Covector Action --> <!-- Covector Action --> ### Package Changes Through a3f2e495746cd2778b37d9a15db385dc6d6fc42a There are 1 changes which include @tauri-apps/api with patch  <details> <summary><i>Planned Package Versions</i></summary>  The following package releases are the planned based on the context of changes in this pull request. | package | current | next |   |----|----|----| | @tauri-apps/api | 2.12.1 | 2.12.2 |  </details>  [Add another change file through the GitHub UI by following this link.](https://github.com/alessandrorodi/tauri/new/fix/api-composite-unlisten?filename=.changes/change-pr-16195.md&value=---%0A%22@tauri-apps/api%22:%20patch%0A%22tauri-utils%22:%20patch%0A%22tauri-macos-sign%22:%20patch%0A%22tauri-bundler%22:%20patch%0A%22tauri-runtime%22:%20patch%0A%22tauri-runtime-wry%22:%20patch%0A%22tauri-codegen%22:%20patch%0A%22tauri-macros%22:%20patch%0A%22tauri-plugin%22:%20patch%0A%22tauri-build%22:%20patch%0A%22tauri%22:%20patch%0A%22@tauri-apps/cli%22:%20patc

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

### Incident Patch 1: `a225a18e` (2026-10-07)
**Commit Message**: fix: panic on repeated `once` listener events (#16222)

* fix: panic on repeated `once` listener events

* Add change file

* Add unit test

Co-authored-by: goosewobbler <[REDACTED_EMAIL]>

---------

Co-authored-by: goosewobbler <[REDACTED_EMAIL]>

**File**: `.changes/once-listener-panic.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'tauri': 'patch:bug'
+---
+
+Fix a panic when a `once` event listener receives multiple events before its queued removal is processed.
```

**File**: `crates/tauri/src/event/listener.rs` (modified, +43/-6)
```diff
@@ -169,12 +169,12 @@ impl Listeners {
     let handler = Cell::new(Some(handler));
 
     self.listen(event, target, move |event| {
-      let id = event.id;
-      self_.unlisten(id);
-      let handler = handler
-        .take()
-        .expect("attempted to call handler more than once");
-      handler(event);
+      // This can potentially be called multiple times if the `unlisten` was queued,
+      // see https://github.com/tauri-apps/tauri/issues/16214
+      if let Some(handler) = handler.take() {
+        self_.unlisten(event.id);
+        handler(event);
+      }
     })
   }
 
@@ -439,6 +439,43 @@ mod test {
       .unwrap();
   }
 
+  #[test]
+  fn once_survives_a_replayed_queued_emit() {
+    use std::sync::atomic::AtomicBool;
+
+    let listeners = Listeners::default();
+    let event = crate::EventName::new("event".to_owned()).unwrap();
+
+    // Since the listeners are stored in a HashMap,
+    // use more listens to make it more likely to have one of these to happen before the `once` handler later
+    for _ in 0..100 {
+      let listeners_clone = listeners.clone();
+      let event_clone = event.clone();
+      let emitted = AtomicBool::new(false);
+      listeners.listen(event.clone(), EventTarget::Any, move |_| {
+        // The listener lock is held while handlers run, so this emit is queued.
+        if !emitted.swap(true, Ordering::SeqCst) {
+          listeners_clone
+            .emit(EmitArgs::new(event_clone.as_str_event(), &()).unwrap())
+            .unwrap();
+        }
+      });
+    }
+
+    let calls = Arc::new(AtomicU32::new(0));
+    let calls_clone = calls.clone();
+
+    listeners.once(event.clone(), EventTarget::Any, move |_| {
+      calls_clone.fetch_add(1, Ordering::SeqCst);
+    });
+
+    listeners
+      .emit(EmitArgs::new(event.as_str_event(), &()).unwrap())
+      .unwrap();
+
+    assert_eq!(calls.load(Ordering::SeqCst), 1);
+  }
+
   #[test]
   fn listeners_removed_on_webview_close() {
     let listeners = Listeners::default();
```

---

### Incident Patch 2: `a916205d` (2026-10-07)
**Commit Message**: fix(api): return awaitable cleanup from combined event listeners (#16195)

**File**: `.changes/fix-api-composite-unlisten.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@tauri-apps/api": patch:bug
+---
+
+Return an awaitable cleanup function from `Window.onDragDropEvent`, `Window.onFocusChanged` and `Webview.onDragDropEvent` so rejections from the inner unlisten calls can be handled instead of surfacing as unhandled promise rejections.
```

**File**: `crates/tauri/scripts/bundle.global.js` (modified, +1/-1)
```diff
@@ -1 +1 @@
-var __TAURI_IIFE__=function(e){"use strict";function n(e,n,t,i){if("a"===t&&!i)throw new TypeError("Private accessor was defined without a getter");if("function"==typeof n?e!==n||!i:!n.has(e))throw new TypeError("Cannot read private member from an object whose class did not declare it");return"m"===t?i:"a"===t?i.call(e):i?i.value:n.get(e)}function t(e,n,t,i,r){if("m"===i)throw new TypeError("Private method is not writable");if("a"===i&&!r)throw new TypeError("Private accessor was defined without a setter");if("function"==typeof n?e!==n||!r:!n.has(e))throw new TypeError("Cannot write private member to an object whose class did not declare it");return"a"===i?r.call(e,t):r?r.value=t:n.set(e,t),t}var i,r,s,a,l;"function"==typeof SuppressedError&&SuppressedError;const o="__TAURI_TO_IPC_KEY__";function u(e,n=!1){return window.__TAURI_INTERNALS__.transformCallback(e,n)}class c{constructor(e){i.set(this,void 0),r.set(this,0),s.set(this,[]),a.set(this,void 0),t(this,i,e||(()=>{}),"f"),this.id=u(e=>{const l=e.index;if("end"in e)return void(l==n(this,r,"f")?this.cleanupCallback():t(this,a,l,"f"));const o=e.message;if(l==n(this,r,"f")){for(n(this,i,"f").call(this,o),t(this,r,n(this,r,"f")+1,"f");n(this,r,"f")in n(this,s,"f");){const e=n(this,s,"f")[n(this,r,"f")];n(this,i,"f").call(this,e),delete n(this,s,"f")[n(this,r,"f")],t(this,r,n(this,r,"f")+1,"f")}n(this,r,"f")===n(this,a,"f")&&this.cleanupCallback()}else n(this,s,"f")[l]=o})}cleanupCallback(){window.__TAURI_INTERNALS__.unregisterCallback(this.id)}set onmessage(e){t(this,i,e,"f")}get onmessage(){return n(this,i,"f")}[(i=new WeakMap,r=new WeakMap,s=new WeakMap,a=new WeakMap,o)](){return`__CHANNEL__:${this.id}`}toJSON(){return this[o]()}}class d{constructor(e,n,t){this.plugin=e,this.event=n,this.channelId=t}async unregister(){return h(`plugin:${this.plugin}|remove_listener`,{event:this.event,channelId:this.channelId})}}async function p(e,n,t){const i=new c(t);try{return await h(`plugin:${e}|register_listener`,{event:n,handler:i}),new d(e,n,i.id)}catch{return await h(`plugin:${e}|registerListener`,{event:n,handler:i}),new d(e,n,i.id)}}async function h(e,n={},t){return window.__TAURI_INTERNALS__.invoke(e,n,t)}class w{get rid(){return n(this,l,"f")}constructor(e){l.set(this,void 0),t(this,l,e,"f")}async close(){return h("plugin:resources|close",{rid:this.rid})}async[(l=new WeakMap,Symbol.asyncDispose)](){await this.close()}}var _=Object.freeze({__proto__:null,Channel:c,PluginListener:d,Resource:w,SERIALIZE_TO_IPC_FN:o,addPluginListener:p,checkPermissions:async function(e){return h(`plugin:${e}|check_permissions`)},convertFileSrc:function(e,n="asset"){return window.__TAURI_INTERNALS__.convertFileSrc(e,n)},invoke:h,isTauri:function(){return!!(globalThis||window).isTauri},requestPermissions:async function(e){return h(`plugin:${e}|request_permissions`)},transformCallback:u});class y extends w{constructor(e){super(e)}static async new(e,n,t){return h("plugin:image|new",{rgba:e,width:n,height:t}).then(e=>new y(e))}static async fromBytes(e){return h("plugin:image|from_bytes",{bytes:e}).then(e=>new y(e))}static async fromPath(e){return h("plugin:image|from_path",{path:e}).then(e=>new y(e))}async rgba(){return h("plugin:image|rgba",{rid:this.rid}).then(e=>new Uint8Array(e))}async size(){return h("plugin:image|size",{rid:this.rid})}}function g(e){return null==e?null:"string"==typeof e?e:e instanceof y?e.rid:e}var b,m=Object.freeze({__proto__:null,Image:y,transformImage:g});!function(e){e.Nsis="nsis",e.Msi="msi",e.Deb="deb",e.Rpm="rpm",e.AppImage="appimage",e.App="app"}(b||(b={}));var v=Object.freeze({__proto__:null,get BundleType(){return b},defaultWindowIcon:async function(){return h("plugin:app|default_window_icon").then(e=>e?new y(e):null)},exit:async function(e=0){return h("plugin:app|exit",{code:e})},fetchDataStoreIdentifiers:async function(){return h("plugin:app|fetch_data_store_identifiers")},getBundleType:async function(){return h("plugin:app|bundle_type")},getIdentifier:async function(){return h("plugin:app|identifier")},getName:async function(){return h("plugin:app|name")},getTauriVersion:async function(){return h("plugin:app|tauri_version")},getVersion:async function(){return h("plugin:app|version")},hide:async function(){return h("plugin:app|app_hide")},onBackButtonPress:async function(e){return p("app","back-button",e)},removeDataStore:async function(e){return h("plugin:app|remove_data_store",{uuid:e})},setDockVisibility:async function(e){return h("plugin:app|set_dock_visibility",{visible:e})},setTheme:async function(e){return h("plugin:app|set_app_theme",{theme:e})},show:async function(){return h("plugin:app|app_show")},supportsMultipleWindows:async function(){return h("plugin:app|supports_multiple_windows")}});class f{constructor(...e){this.type="Logical",1===e.length?"Logical"in e[0]?(this.width=e[0].Logical.width,this.height=e[0].Logical.height):(this.width=e[0].width,this.height=e[0].height):(this.width=e[0],this.height=e[1])}toPhysical(e){return 
```

**File**: `packages/api/src/webview.ts` (modified, +7/-5)
```diff
@@ -819,11 +819,13 @@ class Webview {
       }
     )
 
-    return () => {
-      unlistenDragEnter()
-      unlistenDragDrop()
-      unlistenDragOver()
-      unlistenDragLeave()
+    return async () => {
+      await Promise.all([
+        unlistenDragEnter(),
+        unlistenDragDrop(),
+        unlistenDragOver(),
+        unlistenDragLeave()
+      ])
     }
   }
 }
```

**File**: `packages/api/src/window.ts` (modified, +9/-8)
```diff
@@ -2457,11 +2457,13 @@ class Window {
       }
     )
 
-    return () => {
-      unlistenDrag()
-      unlistenDrop()
-      unlistenDragOver()
-      unlistenCancel()
+    return async () => {
+      await Promise.all([
+        unlistenDrag(),
+        unlistenDrop(),
+        unlistenDragOver(),
+        unlistenCancel()
+      ])
     }
   }
 
@@ -2499,9 +2501,8 @@ class Window {
         handler({ ...event, payload: false })
       }
     )
-    return () => {
-      unlistenFocus()
-      unlistenBlur()
+    return async () => {
+      await Promise.all([unlistenFocus(), unlistenBlur()])
     }
   }
 
```

---

### Incident Patch 3: `61285f6f` (2026-10-04)
**Commit Message**: fix(tauri-utils): doctests (#16142)

* fix(tauri-utils): doctests

* update config schemas [skip ci]

* reuse tauri fixture

* update schemas

**File**: `.github/workflows/test-core.yml` (modified, +2/-2)
```diff
@@ -122,8 +122,8 @@ jobs:
         run: echo "${{ runner.tool_cache }}/cross/bin" >> $GITHUB_PATH
 
       - name: test tauri-utils
-        # Using --lib --bins --tests to skip doc tests
-        run: ${{ matrix.platform.cargo }} ${{ matrix.platform.command }} --target ${{ matrix.platform.target }} ${{ matrix.features.args }} --lib --bins --tests --manifest-path crates/tauri-utils/Cargo.toml
+        # `build` only compiles the lib and bins by default, so also build the tests on mobile
+        run: ${{ matrix.platform.cargo }} ${{ matrix.platform.command }} --target ${{ matrix.platform.target }} ${{ matrix.features.args }} ${{ matrix.platform.command == 'build' && '--lib --bins --tests' || '' }} --manifest-path crates/tauri-utils/Cargo.toml
 
       - name: run acl-tests
         if: ${{ matrix.features.key != 'no-default' && matrix.platform.command == 'test' }}
```

**File**: `crates/tauri-cli/config.schema.json` (modified, +3/-3)
```diff
@@ -170,7 +170,7 @@
       "type": "object",
       "properties": {
         "windows": {
-          "description": "The app windows configuration.\n\n ## Example:\n\n To create a window at app startup\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n If not specified, the window's label (its identifier) defaults to \"main\",\n you can use this label to get the window through\n `app.get_webview_window` in Rust or `WebviewWindow.getByLabel` in JavaScript\n\n When working with multiple windows, each window will need an unique label\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"label\": \"main\", \"width\": 800, \"height\": 600 },\n       { \"label\": \"secondary\", \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n You can also set `create` to false and use this config through the Rust APIs\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"create\": false, \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n and use it like this\n\n ```rust\n tauri::Builder::default()\n   .setup(|app| {\n     tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?.build()?;\n     Ok(())\n   });\n ```",
+          "description": "The app windows configuration.\n\n ## Example:\n\n To create a window at app startup\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n If not specified, the window's label (its identifier) defaults to \"main\",\n you can use this label to get the window through\n `app.get_webview_window` in Rust or `WebviewWindow.getByLabel` in JavaScript\n\n When working with multiple windows, each window will need an unique label\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"label\": \"main\", \"width\": 800, \"height\": 600 },\n       { \"label\": \"secondary\", \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n You can also set `create` to false and use this config through the Rust APIs\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"create\": false, \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n and use it like this\n\n ```rust,no_run\n tauri::Builder::default()\n   .setup(|app| {\n     tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?.build()?;\n     Ok(())\n   });\n ```",
           "default": [],
           "type": "array",
           "items": {
@@ -224,7 +224,7 @@
           "type": "boolean"
         },
         "appDirectoriesOverride": {
-          "description": "Overrides the directories returned by the `app_*_dir` path APIs (`app_config_dir`, `app_data_dir`,\n `app_local_data_dir`, `app_cache_dir` and `app_log_dir`) and the matching `$APPCONFIG`, `$APPDATA`,\n `$APPLOCALDATA`, `$APPCACHE` and `$APPLOG` base directory variables.\n\n This is useful for portable apps that keep all of their data next to the executable,\n and for apps that want their app directories in a location they choose, such as `$DOCUMENT/my-app`.\n Everything that resolves paths through these APIs follows the override, including Tauri itself\n (the default webview data directory on Windows and Linux) and plugins,\n so the storage locations do not need to be configured one by one.\n The only exception is a window's `dataDirectory` config, which is not affected.\n\n It can also isolate the data of a development build from an installed version of the app,\n though a distinct `identifier` for development builds achieves that while keeping the production directory layout.\n\n The value is either a single path used as the root of every app directory\n (config, data and local data resolve to the root itself, cache to `<root>/caches` and log to `<root>/logs`),\n or an object that overrides individual directories (`config`, `data`, `localData`, `cache` and `log`),\n each resolving to exactly the configured path. Directories that are not listed in the object keep their default location.\n\n Each path is resolved as follows:\n\n - A path starting with a base directory variable is resolved relative to that directory.\n   The supported variables are `$AUDIO`, `$CACHE`, `$CONFIG`, `$DATA`, `$LOCALDATA`, `$DESKTOP`, `$DOCUMENT`,\n   `$DOWNLOAD`, `$HOME`, `$PICTURE`, `$PUBLIC`, `$TEMP` and `$VIDEO`.\n   `..` components are kept, so `$DATA/../my-app` refers to a sibling of the data directory.\n - An absolute path is used as is.\n - Any other path is resolved relative to the directory containing the executable,\n   which must be writable, see the platform-specific notes below.\n\n ## Examples\n\n Keep all data in an `app-data` folder next to the executable, for a portable build:\n\n ```json\n {\n   \"app\": {\n     \"appDirectoriesOverride\": \"./app-data\"\n   }\n }\n ```\n\n Only move the logs and the cache:\n\n ```json\n {\n   \"app\": {\n     \"appDirectoriesOverride\": {\n       \"log\": \"$DATA/my-app/logs\",\n       \"cache\"
```

**File**: `crates/tauri-schema-generator/schemas/config.schema.json` (modified, +3/-3)
```diff
@@ -170,7 +170,7 @@
       "type": "object",
       "properties": {
         "windows": {
-          "description": "The app windows configuration.\n\n ## Example:\n\n To create a window at app startup\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n If not specified, the window's label (its identifier) defaults to \"main\",\n you can use this label to get the window through\n `app.get_webview_window` in Rust or `WebviewWindow.getByLabel` in JavaScript\n\n When working with multiple windows, each window will need an unique label\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"label\": \"main\", \"width\": 800, \"height\": 600 },\n       { \"label\": \"secondary\", \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n You can also set `create` to false and use this config through the Rust APIs\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"create\": false, \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n and use it like this\n\n ```rust\n tauri::Builder::default()\n   .setup(|app| {\n     tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?.build()?;\n     Ok(())\n   });\n ```",
+          "description": "The app windows configuration.\n\n ## Example:\n\n To create a window at app startup\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n If not specified, the window's label (its identifier) defaults to \"main\",\n you can use this label to get the window through\n `app.get_webview_window` in Rust or `WebviewWindow.getByLabel` in JavaScript\n\n When working with multiple windows, each window will need an unique label\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"label\": \"main\", \"width\": 800, \"height\": 600 },\n       { \"label\": \"secondary\", \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n You can also set `create` to false and use this config through the Rust APIs\n\n ```json\n {\n   \"app\": {\n     \"windows\": [\n       { \"create\": false, \"width\": 800, \"height\": 600 }\n     ]\n   }\n }\n ```\n\n and use it like this\n\n ```rust,no_run\n tauri::Builder::default()\n   .setup(|app| {\n     tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?.build()?;\n     Ok(())\n   });\n ```",
           "default": [],
           "type": "array",
           "items": {
@@ -224,7 +224,7 @@
           "type": "boolean"
         },
         "appDirectoriesOverride": {
-          "description": "Overrides the directories returned by the `app_*_dir` path APIs (`app_config_dir`, `app_data_dir`,\n `app_local_data_dir`, `app_cache_dir` and `app_log_dir`) and the matching `$APPCONFIG`, `$APPDATA`,\n `$APPLOCALDATA`, `$APPCACHE` and `$APPLOG` base directory variables.\n\n This is useful for portable apps that keep all of their data next to the executable,\n and for apps that want their app directories in a location they choose, such as `$DOCUMENT/my-app`.\n Everything that resolves paths through these APIs follows the override, including Tauri itself\n (the default webview data directory on Windows and Linux) and plugins,\n so the storage locations do not need to be configured one by one.\n The only exception is a window's `dataDirectory` config, which is not affected.\n\n It can also isolate the data of a development build from an installed version of the app,\n though a distinct `identifier` for development builds achieves that while keeping the production directory layout.\n\n The value is either a single path used as the root of every app directory\n (config, data and local data resolve to the root itself, cache to `<root>/caches` and log to `<root>/logs`),\n or an object that overrides individual directories (`config`, `data`, `localData`, `cache` and `log`),\n each resolving to exactly the configured path. Directories that are not listed in the object keep their default location.\n\n Each path is resolved as follows:\n\n - A path starting with a base directory variable is resolved relative to that directory.\n   The supported variables are `$AUDIO`, `$CACHE`, `$CONFIG`, `$DATA`, `$LOCALDATA`, `$DESKTOP`, `$DOCUMENT`,\n   `$DOWNLOAD`, `$HOME`, `$PICTURE`, `$PUBLIC`, `$TEMP` and `$VIDEO`.\n   `..` components are kept, so `$DATA/../my-app` refers to a sibling of the data directory.\n - An absolute path is used as is.\n - Any other path is resolved relative to the directory containing the executable,\n   which must be writable, see the platform-specific notes below.\n\n ## Examples\n\n Keep all data in an `app-data` folder next to the executable, for a portable build:\n\n ```json\n {\n   \"app\": {\n     \"appDirectoriesOverride\": \"./app-data\"\n   }\n }\n ```\n\n Only move the logs and the cache:\n\n ```json\n {\n   \"app\": {\n     \"appDirectoriesOverride\": {\n       \"log\": \"$DATA/my-app/logs\",\n       \"cache\"
```

**File**: `crates/tauri-utils/build.rs` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
+// SPDX-License-Identifier: Apache-2.0
+// SPDX-License-Identifier: MIT
+
+// `tauri::generate_context!` writes its output to `OUT_DIR`, which Cargo only sets for the doc tests
+// of packages that have a build script.
+fn main() {}
```

**File**: `crates/tauri-utils/src/config.rs` (modified, +5/-4)
```diff
@@ -1956,7 +1956,7 @@ pub struct WindowConfig {
   ///
   /// ## Example:
   ///
-  /// ```rust
+  /// ```rust,no_run
   /// tauri::Builder::default()
   ///   .setup(|app| {
   ///     tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?.build()?;
@@ -3353,7 +3353,7 @@ pub struct AppConfig {
   ///
   /// and use it like this
   ///
-  /// ```rust
+  /// ```rust,no_run
   /// tauri::Builder::default()
   ///   .setup(|app| {
   ///     tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?.build()?;
@@ -3451,11 +3451,12 @@ pub struct AppConfig {
   /// or a directory picked by the user, by modifying the config returned by `tauri::generate_context!()`
   /// before building the app:
   ///
-  /// ```rust
+  /// ```rust,no_run
   /// use tauri::utils::config::AppDirectoriesOverride;
   ///
   /// fn main() {
-  ///   let mut context = tauri::generate_context!();
+  ///   // on an actual app, remove the string argument
+  ///   let mut context = tauri::generate_context!("../tauri/test/fixture/src-tauri/tauri.conf.json");
   ///
   ///   if let Ok(data_dir) = std::env::var("MY_APP_DATA_DIR") {
   ///     context.config_mut().app.app_directories_override =
```

---

### Incident Patch 4: `1aefcf6e` (2026-09-30)
**Commit Message**: fix: pnpm audit

**File**: `pnpm-lock.yaml` (modified, +34/-32)
```diff
@@ -163,9 +163,11 @@ settings:
   excludeLinksFromLockfile: false
 
 overrides:
+  axios@<1.20.0: ^1.20.0
   devalue@<5.9.1: ^5.9.1
   morgan@<1.12.0: ^1.12.0
   serialize-javascript@<7.0.5: ^7.0.5
+  undici@>=7.0.0 <7.29.1: ^7.29.1
 
 importers:
 
@@ -2604,8 +2606,8 @@ packages:
   asynckit@0.4.0:
     resolution: {integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==}
 
-  axios@1.19.0:
-    resolution: {integrity: sha512-ht/iuYZXEjFxLH/Hkezgd7m6JKlHHXEUSneaDz8uZe1Gj5QZtCnpyDsckvAiEnT89OEbCLmnte4R4sn7P0EKFw==}
+  axios@1.20.0:
+    resolution: {integrity: sha512-r8aOh8j9cGKpgQAqpzrUHnSIc6a59Y3Xf/cv8sy1DrHCkZHzQGEuoq1tARk6qSyDdtQGSDgpb9kFlruzPvrgwg==}
 
   axobject-query@4.1.0:
     resolution: {integrity: sha512-qIj0G9wZbMGNLjLmg1PT6v2mE9AH2zlnADJD/2tC6E00hgmhUOfEB6greHPAfLRSufHqROIUTkw6E+M3lH0PTQ==}
@@ -2712,14 +2714,14 @@ packages:
     resolution: {integrity: sha512-apC2+fspHGI3mMKj+dGevkGo/tCqVB8jMb6i+OX+E29p0Iposz07fABkRIfVUPNd5A5VbuOz1bZbnmkKLYF+wQ==}
     engines: {node: '>= 5.10.0'}
 
-  brace-expansion@1.1.18:
-    resolution: {integrity: sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==}
+  brace-expansion@1.1.21:
+    resolution: {integrity: sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==}
 
-  brace-expansion@2.1.4:
-    resolution: {integrity: sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==}
+  brace-expansion@2.1.7:
+    resolution: {integrity: sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g==}
 
-  brace-expansion@5.0.9:
-    resolution: {integrity: sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==}
+  brace-expansion@5.0.12:
+    resolution: {integrity: sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==}
     engines: {node: 20 || >=22}
 
   braces@3.0.3:
@@ -3671,8 +3673,8 @@ packages:
       '@types/node':
         optional: true
 
-  ip-address@10.7.0:
-    resolution: {integrity: sha512-BGFsyJd5mpXp3rK6jIdADLNgpJUK1jnjzvYF8lK+VyDab9JAmqN0YOKDdP17HlgKb2+ehPgDc8EtnRLbGCAMhA==}
+  ip-address@10.7.2:
+    resolution: {integrity: sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==}
     engines: {node: '>= 12'}
 
   ipaddr.js@1.9.1:
@@ -4931,12 +4933,12 @@ packages:
   undici-types@7.16.0:
     resolution: {integrity: sha512-Zz+aZWSj8LE6zoxD+xrjh4VfkIG8Ya6LvYkZqtUQGJPZjYl53ypCaUwWqo7eI0x66KBGeRo+mlBEkMSeSZ38Nw==}
 
-  undici@6.28.1:
-    resolution: {integrity: sha512-zWpdTVD54H48CIybL0rWQ3ukpb9d23wM7eH5RtfdmeP70cWHNjtfo7P4vZX+5CoDcO53J4Pu5uXp7lNfjc6DRA==}
+  undici@6.29.0:
+    resolution: {integrity: sha512-R+RODBqp6i2pPflGdq+xIOUkl+RNfGgHwoinecKu/JCuf2uO06cOKoDbI2P7Dn6KcswdKwrczbU6IYJ6K8X+wg==}
     engines: {node: '>=18.17'}
 
-  undici@7.29.0:
-    resolution: {integrity: sha512-IDxfleLmmbSskfWSUATiN1nfn2rDuvnMOqb5CWR92iIfojA0Ud+ulOAAEQ57LPr9rWmsreUyf5lwyao+7GNNVw==}
+  undici@7.30.0:
+    resolution: {integrity: sha512-dkrQXeHSaoamnItlYbmzG0wFYrM0ZwDxCIg0A7aKjTyyhh9svRzCNFEzV+Vm05/yehjCzjDZ31KXfGEjYSztDQ==}
     engines: {node: '>=20.18.1'}
 
   unenv@2.0.0-rc.24:
@@ -5320,7 +5322,7 @@ snapshots:
       '@appium/types': 1.7.0(@appium/logger@2.0.11)
       async-lock: 1.4.1
       asyncbox: 6.4.2
-      axios: 1.19.0(debug@4.4.3(supports-color@8.1.1))(supports-color@8.1.1)
+      axios: 1.20.0(debug@4.4.3(supports-color@8.1.1))(supports-color@8.1.1)
       body-parser: 2.3.0(supports-color@8.1.1)
       express: 5.2.1(supports-color@8.1.1)
       fastest-levenshtein: 1.0.16
@@ -5390,7 +5392,7 @@ snapshots:
       '@appium/types': 1.7.0(@appium/logger@2.0.11)
       archiver: 8.0.0
       asyncbox: 6.4.2
-      axios: 1.19.0(debug@4.4.3(supports-color@8.1.1))(supports-color@8.1.1)
+      axios: 1.20.0(debug@4.4.3(supports-color@8.1.1))(supports-color@8.1.1)
       bluebird: 3.7.2
       bplist-creator: 0.1.1
       bplist-parser: 0.3.2
@@ -7401,7 +7403,7 @@ snapshots:
       ajv-formats: 3.0.1(ajv@8.20.0)
       argparse: 3.0.0
       asyncbox: 6.4.2
-      axios: 1.19.0(debug@4.4.3(supports-color@8.1.1))(supports-color@8.1.1)
+      axios: 1.20.0(debug@4.4.3(supports-color@8.1.1))(supports-color@8.1.1)
       lilconfig: 3.1.3
       lru-cache: 11.5.2
       ora: 5.4.1
@@ -7485,7 +7487,7 @@ snapshots:
 
   asynckit@0.4.0: {}
 
-  axios@1.19.0(debug@4.4.3(supports-color@8.1.1))(supports-color@8.1.1):
+  axios@1.20.0(debug@4.4.3(supports-color@8.1.1))(supports-color@8.1.1):
     dependencies:
       follow-redirects: 1.16.0(debug@4.4.3(supports-color@8.1.1))
       form-data: 4.0.6
@@ -7584,16 +7586,16 @@ snapshots:
     dependencies:
       big-integer: 1.6.52
 
-  brace-expansion@1.1.18:
+  brace-expansion@1.1.21:
     dependencies:
       balanced-match: 1.0.2
       concat-map: 0.0.1
 
-  brace-expansion@2.1.4:
+  b
```

**File**: `pnpm-workspace.yaml` (modified, +2/-0)
```diff
@@ -21,9 +21,11 @@ allowBuilds:
   workerd: true
 
 overrides:
+  axios@<1.20.0: ^1.20.0
   devalue@<5.9.1: ^5.9.1
   morgan@<1.12.0: ^1.12.0
   serialize-javascript@<7.0.5: ^7.0.5
+  undici@>=7.0.0 <7.29.1: ^7.29.1
 
 auditConfig:
   ignoreGhsas:
```

---

### Incident Patch 5: `a4dcca82` (2026-09-30)
**Commit Message**: fix(plugin): skip build script writes on docs.rs builds (#16186)

fixes mobile docs.rs builds e.g. https://docs.rs/crate/tauri-plugin-haptics/latest/builds/4610969

> [INFO] [stderr]   thread 'main' (6484) panicked at build.rs:21:16:
[INFO] [stderr]   called `Result::unwrap()` on an `Err` value: failed to create .tauri directory

**File**: `.changes/plugin-docs-rs-mobile.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"tauri-plugin": patch:bug
+---
+
+Skip the Android and iOS project setup in `Builder::build` and `Builder::try_build` when building on docs.rs, which mounts the sources read-only, so plugins with native mobile projects can build their documentation for mobile targets.
```

**File**: `crates/tauri-plugin/src/build/mobile.rs` (modified, +6/-0)
```diff
@@ -109,6 +109,12 @@ pub(crate) fn setup(
   cfg_alias("mobile", mobile);
   cfg_alias("desktop", !mobile);
 
+  // docs.rs mounts the crate sources read-only, so the native projects can't get their `.tauri` directory,
+  // and the documentation doesn't need them anyway
+  if std::env::var_os("DOCS_RS").is_some() {
+    return Ok(());
+  }
+
   match target_os.as_str() {
     "android" => {
       if let Some(path) = android_path {
```

---

### Incident Patch 6: `c9a3cb89` (2026-09-29)
**Commit Message**: fix: enable macos private apis regardless of feature flags (#16166)

**File**: `.changes/deprecate-macos-private-api.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+tauri: patch:bug
+tauri-utils: patch:bug
+tauri-runtime: patch:bug
+tauri-runtime-wry: patch:bug
+"@tauri-apps/api": patch:bug
+---
+
+The `macos-private-api` feature flag / `macOSPrivateAPI` tauri.conf.json value is no longer required to use transparency or fullscreen on macOS.
```

**File**: `crates/tauri-cli/config.schema.json` (modified, +2/-2)
```diff
@@ -209,7 +209,7 @@
           ]
         },
         "macOSPrivateApi": {
-          "description": "MacOS private API configuration. Enables the transparent background API and sets the `fullScreenEnabled` preference to `true`.",
+          "description": "MacOS private API configuration. Enables the transparent background API and sets the `fullScreenEnabled` preference to `true`.\n\n No-op in Tauri 2.12.1+ because the APIs are always enabled now.",
           "default": false,
           "type": "boolean"
         },
@@ -389,7 +389,7 @@
           "type": "boolean"
         },
         "transparent": {
-          "description": "Whether the window is transparent or not.\n\n ## Platform-specific\n\n - **macOS**: Requires the `macos-private-api` Cargo feature, which is enabled by setting\n   `app > macOSPrivateApi` to `true` in the configuration file.\n   **WARNING:** Using private APIs on macOS prevents your application from being accepted to the App Store.\n   If you only need a translucent background, use `windowEffects` instead, which relies on public APIs.\n - **Windows**: Using `noRedirectionBitmap` can help avoid a white flash when creating a transparent window.",
+          "description": "Whether the window is transparent or not.\n\n ## Platform-specific\n\n - **Windows**: Using `noRedirectionBitmap` can help avoid a white flash when creating a transparent window.",
           "default": false,
           "type": "boolean"
         },
```

**File**: `crates/tauri-runtime-wry/Cargo.toml` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@ jni = "0.21"
 default = ["x11", "dbus"]
 devtools = ["wry/devtools", "tauri-runtime/devtools"]
 x11 = ["tao/x11", "wry/x11"]
+# TODO: Remove in v3 - wry does not have this feature anymore
 macos-private-api = ["tauri-runtime/macos-private-api"]
 # TODO: Remove in v3 - wry does not have this feature anymore
 objc-exception = []
```

**File**: `crates/tauri-runtime-wry/src/lib.rs` (modified, +2/-18)
```diff
@@ -811,22 +811,6 @@ impl WindowBuilder for WindowBuilderWrapper {
       }
     }
 
-    #[cfg(any(not(target_os = "macos"), feature = "macos-private-api"))]
-    {
-      window = window.transparent(config.transparent);
-    }
-    #[cfg(all(
-      target_os = "macos",
-      not(feature = "macos-private-api"),
-      debug_assertions
-    ))]
-    if config.transparent {
-      eprintln!(
-        "The window is set to be transparent but the `macos-private-api` is not enabled.
-        This can be enabled via the `tauri.macOSPrivateApi` configuration property <https://v2.tauri.app/reference/config/#macosprivateapi>
-      ");
-    }
-
     #[cfg(any(
       target_os = "linux",
       target_os = "dragonfly",
@@ -885,7 +869,8 @@ impl WindowBuilder for WindowBuilderWrapper {
       .closable(config.closable)
       .maximizable(config.maximizable)
       .minimizable(config.minimizable)
-      .shadow(config.shadow);
+      .shadow(config.shadow)
+      .transparent(config.transparent);
 
     let mut constraints = WindowSizeConstraints::default();
 
@@ -1049,7 +1034,6 @@ impl WindowBuilder for WindowBuilderWrapper {
     self
   }
 
-  #[cfg(any(not(target_os = "macos"), feature = "macos-private-api"))]
   fn transparent(mut self, transparent: bool) -> Self {
     self.inner = self.inner.with_transparent(transparent);
     self
```

**File**: `crates/tauri-runtime/Cargo.toml` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ objc2-web-kit = { version = "0.3.2", default-features = false, features = [
 
 [features]
 devtools = []
+# TODO: Remove in v3 - wry does not have this feature anymore
 macos-private-api = []
 
 [lints]
```

**File**: `crates/tauri-runtime/src/webview.rs` (modified, +1/-5)
```diff
@@ -462,6 +462,7 @@ impl From<&WindowConfig> for WebviewAttributes {
       .browser_extensions_enabled(config.browser_extensions_enabled)
       .background_throttling(config.background_throttling.clone())
       .devtools(config.devtools)
+      .transparent(config.transparent)
       .scroll_bar_style(match config.scroll_bar_style {
         ConfigScrollBarStyle::Default => ScrollBarStyle::Default,
         #[cfg(windows)]
@@ -471,10 +472,6 @@ impl From<&WindowConfig> for WebviewAttributes {
       .limit_navigations_to_app_bound_domains(config.limit_navigations_to_app_bound_domains)
       .general_autofill_enabled(config.general_autofill_enabled);
 
-    #[cfg(any(not(target_os = "macos"), feature = "macos-private-api"))]
-    {
-      builder = builder.transparent(config.transparent);
-    }
     #[cfg(target_os = "macos")]
     {
       if let Some(position) = &config.traffic_light_position {
@@ -678,7 +675,6 @@ impl WebviewAttributes {
   }
 
   /// Enable or disable transparency for the WebView.
-  #[cfg(any(not(target_os = "macos"), feature = "macos-private-api"))]
   #[must_use]
   pub fn transparent(mut self, transparent: bool) -> Self {
     self.transparent = transparent;
```

**File**: `crates/tauri-runtime/src/window.rs` (modified, +0/-5)
```diff
@@ -368,11 +368,6 @@ pub trait WindowBuilder: WindowBuilderBase {
   ///
   /// On Windows, using `no_redirection_bitmap` can help avoid a white flash when
   /// creating a transparent window.
-  #[cfg(any(not(target_os = "macos"), feature = "macos-private-api"))]
-  #[cfg_attr(
-    docsrs,
-    doc(cfg(any(not(target_os = "macos"), feature = "macos-private-api")))
-  )]
   #[must_use]
   fn transparent(self, transparent: bool) -> Self;
 
```

**File**: `crates/tauri-schema-generator/schemas/config.schema.json` (modified, +2/-2)
```diff
@@ -209,7 +209,7 @@
           ]
         },
         "macOSPrivateApi": {
-          "description": "MacOS private API configuration. Enables the transparent background API and sets the `fullScreenEnabled` preference to `true`.",
+          "description": "MacOS private API configuration. Enables the transparent background API and sets the `fullScreenEnabled` preference to `true`.\n\n No-op in Tauri 2.12.1+ because the APIs are always enabled now.",
           "default": false,
           "type": "boolean"
         },
@@ -389,7 +389,7 @@
           "type": "boolean"
         },
         "transparent": {
-          "description": "Whether the window is transparent or not.\n\n ## Platform-specific\n\n - **macOS**: Requires the `macos-private-api` Cargo feature, which is enabled by setting\n   `app > macOSPrivateApi` to `true` in the configuration file.\n   **WARNING:** Using private APIs on macOS prevents your application from being accepted to the App Store.\n   If you only need a translucent background, use `windowEffects` instead, which relies on public APIs.\n - **Windows**: Using `noRedirectionBitmap` can help avoid a white flash when creating a transparent window.",
+          "description": "Whether the window is transparent or not.\n\n ## Platform-specific\n\n - **Windows**: Using `noRedirectionBitmap` can help avoid a white flash when creating a transparent window.",
           "default": false,
           "type": "boolean"
         },
```

---

### Incident Patch 7: `64bfdd90` (2026-09-29)
**Commit Message**: fix: ignore `src-tauri` in vite configs (#16165)

* fix: ignore `src-tauri` in vite configs

* Add change file

**File**: `.changes/ignore-src-tauri-vite.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"tauri-cli": patch:enhance
+"@tauri-apps/cli": patch:enhance
+---
+
+Ignore `src-tauri` in `tauri plugin init` example template
```

**File**: `crates/tauri-cli/templates/plugin/__example-api/tauri-app/vite.config.js` (modified, +3/-0)
```diff
@@ -20,5 +20,8 @@ export default defineConfig({
       host,
       port: 1421
     } : undefined,
+    watch: {
+      ignored: ['**/src-tauri/**']
+    },
   },
 })
```

**File**: `examples/api/vite.config.js` (modified, +3/-0)
```diff
@@ -37,6 +37,9 @@ export default defineConfig({
           port: 1430
         }
       : undefined,
+    watch: {
+      ignored: ['**/src-tauri/**']
+    },
     fs: {
       allow: ['.', '../../packages/api/dist']
     }
```

---

### Incident Patch 8: `793f0c4a` (2026-09-29)
**Commit Message**: fix(window): copy `WebView2Loader.dll` for nightly (#16164)

**File**: `.changes/webview2-loader-build-dir.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"tauri-build": "patch:bug"
+---
+
+Fix copying `WebView2Loader.dll` for Windows GNU targets when using Cargo's new build directory layout on nightly.
```

**File**: `crates/tauri-build/src/lib.rs` (modified, +13/-2)
```diff
@@ -886,13 +886,24 @@ pub fn try_build(attributes: Attributes) -> Result<()> {
           arch => None,
         };
         if let Some(target_arch) = target_arch {
-          for entry in fs::read_dir(target_dir.join("build"))? {
+          // The `out` dir is
+          //   - `<target dir>/build/<pkg>-<hash>/out` on stable
+          //   - `<target dir>/build/<pkg>/<hash>/out` on recent nightlies
+          let build_dir = target_dir.join("build");
+          let webview2_com_sys_build = build_dir.join("webview2-com-sys");
+          let (build_dir, new_layout) = if webview2_com_sys_build.exists() {
+            (webview2_com_sys_build, true)
+          } else {
+            (build_dir, false)
+          };
+          for entry in fs::read_dir(build_dir)? {
             let path = entry?.path();
             let webview2_loader_path = path
               .join("out")
               .join(target_arch)
               .join("WebView2Loader.dll");
-            if path.to_string_lossy().contains("webview2-com-sys") && webview2_loader_path.exists()
+            if webview2_loader_path.exists()
+              && (new_layout || path.to_string_lossy().contains("webview2-com-sys"))
             {
               fs::copy(webview2_loader_path, target_dir.join("WebView2Loader.dll"))?;
               break;
```

---

### Incident Patch 9: `d15cf9b1` (2026-09-27)
**Commit Message**: fix(bundler): make glob error variants available on all platforms (#16149)

**File**: `.changes/bundler-freebsd-glob-error.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"tauri-bundler": "patch:bug"
+---
+
+Make the `Glob` and `GlobPattern` error variants available on all platforms, fixing a compile error in the Windows bundler utilities on targets other than Windows, macOS and Linux.
```

**File**: `crates/tauri-bundler/src/error.rs` (modified, +0/-2)
```diff
@@ -80,11 +80,9 @@ pub enum Error {
   #[error("`{0}`")]
   HttpError(#[from] Box<ureq::Error>),
   /// Invalid glob pattern.
-  #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
   #[error("{0}")]
   GlobPattern(#[from] glob::PatternError),
   /// Failed to use glob pattern.
-  #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
   #[error("`{0}`")]
   Glob(#[from] glob::GlobError),
   /// Failed to parse the URL
```

---

### Incident Patch 10: `447fa9f3` (2026-09-26)
**Commit Message**: fix(core): tauri-utils publish

tauri dep from workspace defines the version, so it has a publish race condition since tauri-utils gets published before tauri, so the new version requirement is not available - we're changing it to be just a path dependency since it's dev only

**File**: `crates/tauri-utils/Cargo.toml` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ swift-rs = { version = "1.0.8", optional = true, features = ["build"] }
 getrandom = { version = "0.3", features = ["std"] }
 serial_test = "3.5"
 # For doc tests
-tauri = { workspace = true }
+tauri = { path = "../tauri", default-features = false, features = ["wry"] }
 tempfile = "3.15.0"
 
 [features]
```

---

### Incident Patch 11: `4f46cfc1` (2026-09-26)
**Commit Message**: fix(ci): pnpm publish should use "debug" loglevel instead of "silly"

**File**: `.changes/config.json` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@
           "pipe": true
         },
         {
-          "command": "pnpm publish --access public --loglevel silly --no-git-checks",
+          "command": "pnpm publish --access public --loglevel debug --no-git-checks",
           "dryRunCommand": "npm publish --dry-run --access public --no-git-checks",
           "pipe": true
         },
```

**File**: `packages/api/package.json` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@
     "build": "rollup -c --configPlugin typescript",
     "build:debug": "rollup -c --configPlugin typescript",
     "npm-pack": "pnpm build && cd ./dist && npm pack",
-    "npm-publish": "pnpm build && cd ./dist && pnpm publish --access public --loglevel silly --no-git-checks",
+    "npm-publish": "pnpm build && cd ./dist && pnpm publish --access public --loglevel debug --no-git-checks",
     "ts:check": "tsc --noEmit",
     "eslint:check": "eslint src/**/*.ts",
     "eslint:fix": "eslint src/**/*.ts --fix"
```

---

### Incident Patch 12: `dc894d40` (2026-09-26)
**Commit Message**: chore: remove change file for unreleased fix (#16140)

change file from https://github.com/tauri-apps/tauri/commit/078a0e044102679804b4e0e32547a682404d46e7 is not needed - bug fix for a change not released yet

**File**: `.changes/rust-destroyed-listeners.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-"tauri": "patch:bug"
----
-
-Fix Rust `tauri://destroyed` listeners registered on a `Window` or `WebviewWindow` never running, because the window's listeners were purged before the event was emitted.
```

---

### Incident Patch 13: `152529eb` (2026-09-26)
**Commit Message**: Revert "feat(core): add android activityEmbedding config (#15255)" (#16138)

This reverts commit 93bf07f4bb580a5f15a60180fd636d29012dcad9.

**File**: `.changes/android-embedded-activity-config.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-"tauri-utils": minor:feat
----
-
-Added `tauri.conf.json > bundle > android > activityEmbedding` config to enable Activity embedding and define split rules for Android multi-window support.
```

**File**: `.changes/android-embedded-activity-generator.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-"tauri-build": minor:feat
----
-
-Enable Android Activity embedding when `tauri.conf.json > bundle > android > activityEmbedding > enabled` is true: generate the Gradle dependencies, manifest entries and split rules from `splitRules`, plus a default `TauriActivity` subclass for each secondary activity not defined by the app. Generated files and manifest entries are removed again when the feature is disabled.
```

**File**: `.changes/android-manifest-block-removal.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-"tauri-utils": minor:feat
----
-
-Added `build::remove_xml_block`, and `build::update_android_manifest` now removes the generated block when given empty content.
```

**File**: `crates/tauri-build/src/lib.rs` (modified, +2/-11)
```diff
@@ -704,21 +704,12 @@ pub fn try_build(attributes: Attributes) -> Result<()> {
   println!("cargo:rustc-env=TAURI_ANDROID_PACKAGE_NAME_PREFIX={android_package_prefix}");
 
   if let Some(project_dir) = env::var_os("TAURI_ANDROID_PROJECT_PATH").map(PathBuf::from) {
-    let activity_embedding = config
-      .bundle
-      .android
-      .activity_embedding
-      .as_ref()
-      .filter(|c| c.enabled && !c.split_rules.is_empty());
-
-    mobile::generate_gradle_files(project_dir.clone(), activity_embedding)?;
+    mobile::generate_gradle_files(project_dir)?;
 
+    // Update Android manifest with file associations
     if let Some(associations) = config.bundle.file_associations.as_ref() {
       mobile::update_android_manifest_file_associations(associations)?;
     }
-
-    // always runs so previously generated files and manifest entries are removed when disabled
-    mobile::sync_activity_embedding(&project_dir, activity_embedding, &config.identifier)?;
   }
 
   cfg_alias("dev", is_dev());
```

**File**: `crates/tauri-build/src/mobile.rs` (modified, +4/-813)
```diff
@@ -2,19 +2,10 @@
 // SPDX-License-Identifier: Apache-2.0
 // SPDX-License-Identifier: MIT
 
-use std::{
-  collections::HashSet,
-  path::{Path, PathBuf},
-};
+use std::{collections::HashSet, path::PathBuf};
 
 use anyhow::{Context, Result};
-use tauri_utils::{
-  config::{
-    ActivityEmbeddingConfig, AndroidIntentAction, EmbeddingAspectRatio, SplitFinishBehavior,
-    SplitLayoutDirection, SplitPairRule, SplitType,
-  },
-  write_if_changed,
-};
+use tauri_utils::{config::AndroidIntentAction, write_if_changed};
 
 /// Updates the Android manifest to add file association intent filters
 pub fn update_android_manifest_file_associations(
@@ -153,10 +144,7 @@ fn extension_to_mime_type(ext: &str) -> Option<String> {
   )
 }
 
-pub fn generate_gradle_files(
-  project_dir: PathBuf,
-  activity_embedding: Option<&ActivityEmbeddingConfig>,
-) -> Result<()> {
+pub fn generate_gradle_files(project_dir: PathBuf) -> Result<()> {
   let gradle_settings_path = project_dir.join("tauri.settings.gradle");
   let app_build_gradle_path = project_dir.join("app").join("tauri.build.gradle.kts");
 
@@ -168,11 +156,6 @@ dependencies {
   implementation(\"androidx.lifecycle:lifecycle-process:2.10.0\")"
     .to_string();
 
-  if activity_embedding.is_some() {
-    app_build_gradle.push_str("\n  implementation(\"androidx.window:window:1.5.0\")");
-    app_build_gradle.push_str("\n  implementation(\"androidx.startup:startup-runtime:1.2.0\")");
-  }
-
   for (env, value) in std::env::vars_os() {
     let env = env.to_string_lossy();
     if env.starts_with("DEP_") && env.ends_with("_ANDROID_LIBRARY_PATH") {
@@ -204,6 +187,7 @@ dependencies {
 
   app_build_gradle.push_str("\n}");
 
+  // Overwrite only if changed to not trigger rebuilds
   write_if_changed(&gradle_settings_path, gradle_settings)
     .context("failed to write tauri.settings.gradle")?;
 
@@ -215,796 +199,3 @@ dependencies {
 
   Ok(())
 }
-
-/// Identifier of the auto-generated Android manifest block for activity embedding.
-const MANIFEST_BLOCK_ID: &str = "tauri-activity-embedding";
-/// First line of every Kotlin source generated by this module, used to recognize stale files.
-const GENERATED_HEADER: &str =
-  "// THIS IS AN AUTOGENERATED FILE BY TAURI ACTIVITY EMBEDDING. DO NOT EDIT THIS FILE DIRECTLY.";
-const SPLIT_INITIALIZER_CLASS: &str = "TauriSplitInitializer";
-/// Same `configChanges` set the `MainActivity` template uses, so secondary activities
-/// (and their webviews) are not recreated on dark mode, keyboard or locale changes.
-const ACTIVITY_CONFIG_CHANGES: &str =
-  "orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode";
-
-/// The app's Android package name as used by Kotlin sources and by the manifest.
-struct AndroidPackage {
-  /// Package with Kotlin-only keywords escaped with backticks (`package` statements, class references).
-  kotlin: String,
-  /// Raw package name (manifest entries, file system paths).
-  unescaped: String,
-}
-
-impl AndroidPackage {
-  /// Uses the package names exported by the Tauri CLI, deriving them from the identifier when unset.
-  fn resolve(identifier: &str) -> Self {
-    let kotlin = std::env::var("WRY_ANDROID_PACKAGE").ok();
-    let unescaped = std::env::var("TAURI_ANDROID_PACKAGE_UNESCAPED")
-      .ok()
-      .or_else(|| kotlin.as_ref().map(|p| p.replace('`', "")))
-      .unwrap_or_else(|| identifier.replace('-', "_"));
-    Self {
-      kotlin: kotlin.unwrap_or_else(|| unescaped.clone()),
-      unescaped,
-    }
-  }
-}
-
-/// Synchronizes the Android project with the `bundle > android > activityEmbedding` configuration.
-///
-/// When `config` is enabled and has split rules, this validates it, writes
-/// `TauriSplitInitializer.kt` plus a default `TauriActivity` subclass for each secondary
-/// activity the app sources do not define, and declares the secondary activities in the manifest.
-/// Otherwise every previously generated file and manifest entry is removed.
-pub fn sync_activity_embedding(
-  project_dir: &Path,
-  config: Option<&ActivityEmbeddingConfig>,
-  identifier: &str,
-) -> Result<()> {
-  let config = config.filter(|c| c.enabled && !c.split_rules.is_empty());
-  let package = AndroidPackage::resolve(identifier);
-  let out_dir = kotlin_out_dir(project_dir, &package);
-
-  let mut sources: Vec<(String, String)> = Vec::new();
-  let mut manifest_xml = String::new();
-
-  if let Some(config) = config {
-    validate_activity_embedding(config)?;
-
-    let manifest_path = project_dir.join("app/src/main/AndroidManifest.xml");
-    let manifest = if manifest_path.exists() {
-      std::fs::read_to_string(&manifest_path).context("failed to read AndroidManifest.xml")?
-    } else {
-      String::new()
-    };
-    let user_manifest = tauri_utils::build::remove_xml_block(&manifest, MANIFEST_BLOCK_ID);
-
-    manifest_xml = activity_embedding_manifest_xml(config, &package.unescaped, &user_manifest);
-    sources.push((
-      format!("{SPLIT_INITIALIZER_
```

**File**: `crates/tauri-cli/config.schema.json` (modified, +0/-296)
```diff
@@ -4058,306 +4058,10 @@
             "string",
             "null"
           ]
-        },
-        "activityEmbedding": {
-          "description": "Activity embedding for large screens (tablets, foldables).\n\n When set and enabled, Tauri generates the Gradle dependencies, Android manifest entries,\n a `TauriSplitInitializer` Kotlin class and a default `TauriActivity` subclass for each\n secondary activity the app sources do not define.",
-          "anyOf": [
-            {
-              "$ref": "#/definitions/ActivityEmbeddingConfig"
-            },
-            {
-              "type": "null"
-            }
-          ]
-        }
-      },
-      "additionalProperties": false
-    },
-    "ActivityEmbeddingConfig": {
-      "description": "Configuration for Android Activity Embedding, which splits activities\n side by side on large screens.\n\n When enabled with at least one split rule, the build script generates the Gradle\n dependencies, the Android manifest entries and a `TauriSplitInitializer` Kotlin class.\n Each secondary activity is declared in the manifest automatically, and a default\n `TauriActivity` subclass is generated for it unless the app sources already define\n a class with that name in the application package.\n\n See <https://developer.android.com/guide/topics/large-screens/activity-embedding>",
-      "type": "object",
-      "properties": {
-        "enabled": {
-          "description": "When `false`, Tauri does not generate embedding Gradle entries, manifest updates, or `TauriSplitInitializer`.",
-          "default": true,
-          "type": "boolean"
-        },
-        "splitRules": {
-          "description": "Split pair rules defining how activities are laid out side by side.",
-          "default": [],
-          "type": "array",
-          "items": {
-            "$ref": "#/definitions/SplitPairRule"
-          }
-        }
-      },
-      "additionalProperties": false
-    },
-    "SplitPairRule": {
-      "description": "A split pair rule for Android Activity Embedding.\n\n Defines how a primary and secondary activity are displayed side by side\n on screens that satisfy the configured minimum dimensions.\n\n Mirrors the fields of [`androidx.window.embedding.SplitPairRule.Builder`] and\n the [`SplitPairFilter`] it accepts. Only [`primary`](Self::primary) and\n [`secondary`](Self::secondary) are required; all other fields fall back to\n the Android SDK defaults when omitted.\n\n [`androidx.window.embedding.SplitPairRule.Builder`]: https://developer.android.com/reference/androidx/window/embedding/SplitPairRule.Builder\n [`SplitPairFilter`]: https://developer.android.com/reference/androidx/window/embedding/SplitPairFilter",
-      "type": "object",
-      "required": [
-        "primary",
-        "secondary"
-      ],
-      "properties": {
-        "primary": {
-          "description": "The primary activity class name, relative to the application package\n (e.g. `\"MainActivity\"` or a fully-qualified name like\n `\"com.example.MainActivity\"`). The activity must exist and be declared\n in the Android manifest, as `MainActivity` is by default.",
-          "type": "string"
-        },
-        "secondary": {
-          "description": "The secondary activity class name, relative to the application package\n (e.g. `\"DetailActivity\"` or a fully-qualified name).\n\n Secondary activities are declared in the Android manifest automatically\n unless the manifest already declares them. When no source file with this\n name exists in the application package, a default class extending\n `TauriActivity` is generated. A custom implementation must extend\n `TauriActivity` so it can host a webview window.",
-          "type": "string"
-        },
-        "secondaryIntentAction": {
-          "description": "Optional intent action used to match the secondary activity when it is\n started via an implicit intent.",
-          "type": [
-            "string",
-            "null"
-          ]
-        },
-        "splitType": {
-          "description": "How the parent window is split. When omitted, the SDK uses an equal\n 50/50 ratio.",
-          "anyOf": [
-            {
-              "$ref": "#/definitions/SplitType"
-            },
-            {
-              "type": "null"
-            }
-          ]
-        },
-        "layoutDirection": {
-          "description": "The layout direction of the primary/secondary containers. Defaults to\n the system locale direction.",
-          "anyOf": [
-            {
-              "$ref": "#/definitions/SplitLayoutDirection"
-            },
-            {
-              "type": "null"
-            }
-          ]
-        },
-        "minWidthDp": {
-          "description": "Minimum parent window width in dp for the split to apply. Defaults to the\n SDK value (`600`).",
-          "type": [
-            "integer",
-            "null"
-          ],
-          "format": "uint32",
-          "minimum": 0.0
-        },
-        "minHeightD
```

**File**: `crates/tauri-schema-generator/schemas/config.schema.json` (modified, +0/-296)
```diff
@@ -4058,306 +4058,10 @@
             "string",
             "null"
           ]
-        },
-        "activityEmbedding": {
-          "description": "Activity embedding for large screens (tablets, foldables).\n\n When set and enabled, Tauri generates the Gradle dependencies, Android manifest entries,\n a `TauriSplitInitializer` Kotlin class and a default `TauriActivity` subclass for each\n secondary activity the app sources do not define.",
-          "anyOf": [
-            {
-              "$ref": "#/definitions/ActivityEmbeddingConfig"
-            },
-            {
-              "type": "null"
-            }
-          ]
-        }
-      },
-      "additionalProperties": false
-    },
-    "ActivityEmbeddingConfig": {
-      "description": "Configuration for Android Activity Embedding, which splits activities\n side by side on large screens.\n\n When enabled with at least one split rule, the build script generates the Gradle\n dependencies, the Android manifest entries and a `TauriSplitInitializer` Kotlin class.\n Each secondary activity is declared in the manifest automatically, and a default\n `TauriActivity` subclass is generated for it unless the app sources already define\n a class with that name in the application package.\n\n See <https://developer.android.com/guide/topics/large-screens/activity-embedding>",
-      "type": "object",
-      "properties": {
-        "enabled": {
-          "description": "When `false`, Tauri does not generate embedding Gradle entries, manifest updates, or `TauriSplitInitializer`.",
-          "default": true,
-          "type": "boolean"
-        },
-        "splitRules": {
-          "description": "Split pair rules defining how activities are laid out side by side.",
-          "default": [],
-          "type": "array",
-          "items": {
-            "$ref": "#/definitions/SplitPairRule"
-          }
-        }
-      },
-      "additionalProperties": false
-    },
-    "SplitPairRule": {
-      "description": "A split pair rule for Android Activity Embedding.\n\n Defines how a primary and secondary activity are displayed side by side\n on screens that satisfy the configured minimum dimensions.\n\n Mirrors the fields of [`androidx.window.embedding.SplitPairRule.Builder`] and\n the [`SplitPairFilter`] it accepts. Only [`primary`](Self::primary) and\n [`secondary`](Self::secondary) are required; all other fields fall back to\n the Android SDK defaults when omitted.\n\n [`androidx.window.embedding.SplitPairRule.Builder`]: https://developer.android.com/reference/androidx/window/embedding/SplitPairRule.Builder\n [`SplitPairFilter`]: https://developer.android.com/reference/androidx/window/embedding/SplitPairFilter",
-      "type": "object",
-      "required": [
-        "primary",
-        "secondary"
-      ],
-      "properties": {
-        "primary": {
-          "description": "The primary activity class name, relative to the application package\n (e.g. `\"MainActivity\"` or a fully-qualified name like\n `\"com.example.MainActivity\"`). The activity must exist and be declared\n in the Android manifest, as `MainActivity` is by default.",
-          "type": "string"
-        },
-        "secondary": {
-          "description": "The secondary activity class name, relative to the application package\n (e.g. `\"DetailActivity\"` or a fully-qualified name).\n\n Secondary activities are declared in the Android manifest automatically\n unless the manifest already declares them. When no source file with this\n name exists in the application package, a default class extending\n `TauriActivity` is generated. A custom implementation must extend\n `TauriActivity` so it can host a webview window.",
-          "type": "string"
-        },
-        "secondaryIntentAction": {
-          "description": "Optional intent action used to match the secondary activity when it is\n started via an implicit intent.",
-          "type": [
-            "string",
-            "null"
-          ]
-        },
-        "splitType": {
-          "description": "How the parent window is split. When omitted, the SDK uses an equal\n 50/50 ratio.",
-          "anyOf": [
-            {
-              "$ref": "#/definitions/SplitType"
-            },
-            {
-              "type": "null"
-            }
-          ]
-        },
-        "layoutDirection": {
-          "description": "The layout direction of the primary/secondary containers. Defaults to\n the system locale direction.",
-          "anyOf": [
-            {
-              "$ref": "#/definitions/SplitLayoutDirection"
-            },
-            {
-              "type": "null"
-            }
-          ]
-        },
-        "minWidthDp": {
-          "description": "Minimum parent window width in dp for the split to apply. Defaults to the\n SDK value (`600`).",
-          "type": [
-            "integer",
-            "null"
-          ],
-          "format": "uint32",
-          "minimum": 0.0
-        },
-        "minHeightD
```

**File**: `crates/tauri-utils/src/build.rs` (modified, +10/-75)
```diff
@@ -100,7 +100,7 @@ fn link_xcode_library(name: &str, source: impl AsRef<std::path::Path>) {
 /// Updates the Android manifest by inserting XML content into a specified parent tag.
 ///
 /// The content is wrapped in auto-generated comments and will replace any existing
-/// content with the same block identifier. Empty content removes the block.
+/// content with the same block identifier.
 ///
 /// # Arguments
 ///
@@ -136,44 +136,27 @@ fn xml_block_comment(id: &str) -> String {
   format!("<!-- {id}. AUTO-GENERATED. DO NOT REMOVE. -->")
 }
 
-/// Removes the auto-generated block identified by `block_identifier` from the given XML string.
-///
-/// The block is delimited by the comments written by [`update_android_manifest`].
-/// Returns the input unchanged when no such block exists.
-pub fn remove_xml_block(xml: &str, block_identifier: &str) -> String {
+fn insert_into_xml(xml: &str, block_identifier: &str, parent_tag: &str, contents: &str) -> String {
   let block_comment = xml_block_comment(block_identifier);
 
   let mut rewritten = Vec::new();
-  let mut in_block = false;
+  let mut found_block = false;
+  let parent_closing_tag = format!("</{parent_tag}>");
   for line in xml.split('\n') {
     if line.contains(&block_comment) {
-      in_block = !in_block;
+      found_block = !found_block;
       continue;
     }
-    if !in_block {
-      rewritten.push(line);
-    }
-  }
-
-  rewritten.join("\n")
-}
-
-fn insert_into_xml(xml: &str, block_identifier: &str, parent_tag: &str, contents: &str) -> String {
-  let block_comment = xml_block_comment(block_identifier);
-  let without_block = remove_xml_block(xml, block_identifier);
 
-  // an empty block only removes the previously generated contents
-  if contents.trim().is_empty() {
-    return without_block;
-  }
+    // found previous block which should be removed
+    if found_block {
+      continue;
+    }
 
-  let mut rewritten = Vec::new();
-  let parent_closing_tag = format!("</{parent_tag}>");
-  for line in without_block.split('\n') {
     if let Some(index) = line.find(&parent_closing_tag) {
       let indentation = " ".repeat(index + 4);
       rewritten.push(format!("{indentation}{block_comment}"));
-      for l in contents.trim_end_matches('\n').split('\n') {
+      for l in contents.split('\n') {
         rewritten.push(format!("{indentation}{l}"));
       }
       rewritten.push(format!("{indentation}{block_comment}"));
@@ -184,51 +167,3 @@ fn insert_into_xml(xml: &str, block_identifier: &str, parent_tag: &str, contents
 
   rewritten.join("\n")
 }
-
-#[cfg(test)]
-mod tests {
-  use super::{insert_into_xml, remove_xml_block};
-
-  const MANIFEST: &str = r#"<manifest>
-    <application>
-        <activity android:name=".MainActivity" />
-    </application>
-</manifest>"#;
-
-  #[test]
-  fn inserts_block_before_parent_closing_tag() {
-    let rewritten = insert_into_xml(MANIFEST, "test-block", "application", "<a />\n<b />\n");
-    assert_eq!(
-      rewritten,
-      r#"<manifest>
-    <application>
-        <activity android:name=".MainActivity" />
-        <!-- test-block. AUTO-GENERATED. DO NOT REMOVE. -->
-        <a />
-        <b />
-        <!-- test-block. AUTO-GENERATED. DO NOT REMOVE. -->
-    </application>
-</manifest>"#
-    );
-  }
-
-  #[test]
-  fn replaces_existing_block() {
-    let first = insert_into_xml(MANIFEST, "test-block", "application", "<a />");
-    let second = insert_into_xml(&first, "test-block", "application", "<b />");
-    assert!(!second.contains("<a />"));
-    assert_eq!(second.matches("test-block").count(), 2);
-    assert!(second.contains("<b />"));
-  }
-
-  #[test]
-  fn empty_contents_removes_block() {
-    let inserted = insert_into_xml(MANIFEST, "test-block", "application", "<a />");
-    assert_eq!(
-      insert_into_xml(&inserted, "test-block", "application", ""),
-      MANIFEST
-    );
-    assert_eq!(remove_xml_block(&inserted, "test-block"), MANIFEST);
-    assert_eq!(remove_xml_block(MANIFEST, "test-block"), MANIFEST);
-  }
-}
```

---

### Incident Patch 14: `7456ddd8` (2026-09-26)
**Commit Message**: Revert "fix(core): proper unique identifier for menu items on channels store" (#16137)

This reverts commit bce71b07ec11c1d693f16ab4bcdaf34b7348e36b.

**File**: `.changes/cleanup-js-menu-channel.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 "tauri": "patch:bug"
 ---
 
-Remove the `Channel` used to send event to JavaScript side on dropping the menu. Items sharing the same id each keep their own handler, so dropping one no longer removes another's.
+Remove the `Channel` used to send event to JavaScript side on dropping the menu
```

**File**: `crates/tauri/src/menu/mod.rs` (modified, +1/-9)
```diff
@@ -95,7 +95,7 @@ macro_rules! gen_wrappers {
 
       impl<R: Runtime> Drop for $inner<R> {
         fn drop(&mut self) {
-          remove_menu_channel(&self.app_handle, self.inner.id(), self as *const Self as usize);
+          remove_menu_channel(&self.app_handle, self.inner.id());
           // SAFETY: we will not access `self.inner` after this
           let inner = unsafe { ManuallyDrop::take(&mut self.inner) };
           // SAFETY: inner was created on main thread and is being dropped on main thread
@@ -121,14 +121,6 @@ macro_rules! gen_wrappers {
         }
       }
 
-      impl<R: $crate::Runtime> $type<R> {
-        /// Identifies this item among others sharing the same [`MenuId`],
-        /// matches the key passed to [`remove_menu_channel`] on drop.
-        pub(crate) fn channel_key(&self) -> usize {
-          ::std::sync::Arc::as_ptr(&self.0) as usize
-        }
-      }
-
       $(
         impl<R: $crate::Runtime> $crate::menu::sealed::IsMenuItemBase for $type<R> {
           fn inner_muda(&self) -> &dyn muda::IsMenuItem {
```

**File**: `crates/tauri/src/menu/plugin.rs` (modified, +40/-90)
```diff
@@ -9,7 +9,7 @@ use tauri_runtime::dpi::Position;
 
 use super::{sealed::ContextMenuBase, *};
 use crate::{
-  Manager, ResourceTable, RunEvent, Runtime, Webview, Window, command,
+  Manager, ResourceTable, RunEvent, Runtime, State, Webview, Window, command,
   image::JsImage,
   ipc::{Channel, channel::JavaScriptChannelId},
   plugin::{Builder, TauriPlugin},
@@ -160,7 +160,12 @@ impl CheckMenuItemPayload {
 
     if let Some(handler) = self.handler {
       let handler = handler.channel_on(webview.clone());
-      add_menu_channel(webview, item.id().clone(), item.channel_key(), handler);
+      webview
+        .state::<MenuChannels>()
+        .0
+        .lock()
+        .unwrap()
+        .insert(item.id().clone(), handler);
     }
 
     Ok(item)
@@ -211,7 +216,12 @@ impl IconMenuItemPayload {
 
     if let Some(handler) = self.handler {
       let handler = handler.channel_on(webview.clone());
-      add_menu_channel(webview, item.id().clone(), item.channel_key(), handler);
+      webview
+        .state::<MenuChannels>()
+        .0
+        .lock()
+        .unwrap()
+        .insert(item.id().clone(), handler);
     }
 
     Ok(item)
@@ -245,7 +255,12 @@ impl MenuItemPayload {
 
     if let Some(handler) = self.handler {
       let handler = handler.channel_on(webview.clone());
-      add_menu_channel(webview, item.id().clone(), item.channel_key(), handler);
+      webview
+        .state::<MenuChannels>()
+        .0
+        .lock()
+        .unwrap()
+        .insert(item.id().clone(), handler);
     }
 
     Ok(item)
@@ -346,12 +361,13 @@ fn new<R: Runtime>(
   webview: Webview<R>,
   kind: ItemKind,
   options: Option<NewOptions>,
+  channels: State<'_, MenuChannels>,
   handler: Channel<MenuId>,
 ) -> crate::Result<(ResourceId, MenuId)> {
   let options = options.unwrap_or_default();
   let mut resources_table = webview.resources_table();
 
-  let (rid, id, key) = match kind {
+  let (rid, id) = match kind {
     ItemKind::Menu => {
       let mut builder = MenuBuilder::new(&webview);
       if let Some(id) = options.id {
@@ -364,10 +380,9 @@ fn new<R: Runtime>(
       }
       let menu = builder.build()?;
       let id = menu.id().clone();
-      let key = menu.channel_key();
       let rid = resources_table.add(menu);
 
-      (rid, id, key)
+      (rid, id)
     }
 
     ItemKind::Submenu => {
@@ -380,10 +395,9 @@ fn new<R: Runtime>(
       }
       .create_item(&webview, &resources_table)?;
       let id = submenu.id().clone();
-      let key = submenu.channel_key();
       let rid = resources_table.add(submenu);
 
-      (rid, id, key)
+      (rid, id)
     }
 
     ItemKind::MenuItem => {
@@ -397,9 +411,8 @@ fn new<R: Runtime>(
       }
       .create_item(&webview)?;
       let id = item.id().clone();
-      let key = item.channel_key();
       let rid = resources_table.add(item);
-      (rid, id, key)
+      (rid, id)
     }
 
     ItemKind::Predefined => {
@@ -411,9 +424,8 @@ fn new<R: Runtime>(
       }
       .create_item(&webview, &resources_table)?;
       let id = item.id().clone();
-      let key = item.channel_key();
       let rid = resources_table.add(item);
-      (rid, id, key)
+      (rid, id)
     }
 
     ItemKind::Check => {
@@ -428,9 +440,8 @@ fn new<R: Runtime>(
       }
       .create_item(&webview)?;
       let id = item.id().clone();
-      let key = item.channel_key();
       let rid = resources_table.add(item);
-      (rid, id, key)
+      (rid, id)
     }
 
     ItemKind::Icon => {
@@ -445,13 +456,12 @@ fn new<R: Runtime>(
       }
       .create_item(&webview, &resources_table)?;
       let id = item.id().clone();
-      let key = item.channel_key();
       let rid = resources_table.add(item);
-      (rid, id, key)
+      (rid, id)
     }
   };
 
-  add_menu_channel(&webview, id.clone(), key, handler);
+  channels.0.lock().unwrap().insert(id.clone(), handler);
 
   Ok((rid, id))
 }
@@ -876,40 +886,11 @@ fn set_icon<R: Runtime>(
   )
 }
 
-/// JS event handlers tagged with the owning item's [`channel_key`](Menu::channel_key)
-type KeyedChannels = Vec<(usize, Channel<MenuId>)>;
-
-/// JS event handlers by menu id, keyed per item since ids are not unique
-struct MenuChannels(Mutex<HashMap<MenuId, KeyedChannels>>);
-
-fn add_menu_channel<R: Runtime, M: Manager<R>>(
-  manager: &M,
-  id: MenuId,
-  key: usize,
-  channel: Channel<MenuId>,
-) {
-  manager
-    .state::<MenuChannels>()
-    .0
-    .lock()
-    .unwrap()
-    .entry(id)
-    .or_default()
-    .push((key, channel));
-}
+struct MenuChannels(Mutex<HashMap<MenuId, Channel<MenuId>>>);
 
 // Called in `Menu`'s `Drop` to clean up the event handlers
-pub(crate) fn remove_menu_channel<R: Runtime>(app: &AppHandle<R>, id: &MenuId, key: usize) {
-  let Some(channels) = app.try_state::<MenuChannels>() else {
-    return;
-  };
-  let mut channels = channels.0.lock().unwrap();
-  if let Some(handlers) = channels.get_mut(id) {
-    handlers.retain(|(k, _)| *k != key);
-    if handlers.is_empty() {
-      channels
```

---

### Incident Patch 15: `15468de7` (2026-09-25)
**Commit Message**: fix(bundler): recognize deb and rpm as self-contained updater targets (#16064)

* fix(bundler): recognize deb and rpm as self-contained updater targets

The self-contained updater check excluded RPM and the "no updater-enabled targets" warning omitted deb/rpm, although both are signed as updater artifacts and supported by the updater plugin.

* cr

* cr

**File**: `.changes/bundler-updater-targets-deb-rpm.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"tauri-bundler": "patch:bug"
+---
+
+Recognize `.deb` and `.rpm` as self contained updater artifacts (the updater plugin installs them directly): the "no updater-enabled targets were built" warning is no longer printed when only a `.rpm` bundle is produced, and it now lists both targets. Setting `createUpdaterArtifacts` to `"v1Compatible"` no longer fails with "Unable to find a bundled project for the updater" when only a `.deb` bundle is built; the legacy updater never supported `.deb`, so the bundler now warns that no v1 compatible artifact was created instead.
```

**File**: `crates/tauri-bundler/src/bundle.rs` (modified, +25/-17)
```diff
@@ -219,38 +219,46 @@ pub fn bundle_project(settings: &Settings) -> crate::Result<Vec<Bundle>> {
   }
 
   if let Some(updater) = settings.updater() {
-    if package_types.iter().any(|package_type| {
-      if updater.v1_compatible {
+    // Targets the legacy v1 updater can consume once they are wrapped in a tar.gz / zip.
+    let has_v1_target = updater.v1_compatible
+      && package_types.iter().any(|package_type| {
         matches!(
           package_type,
           PackageType::AppImage
             | PackageType::MacOsBundle
             | PackageType::Nsis
             | PackageType::WindowsMsi
-            | PackageType::Deb
         )
-      } else {
-        matches!(package_type, PackageType::MacOsBundle)
-      }
-    }) {
+      });
+    // Targets the v2 updater plugin installs directly, no wrapping needed.
+    let has_self_contained_target = package_types.iter().any(|package_type| {
+      matches!(
+        package_type,
+        PackageType::AppImage
+          | PackageType::Nsis
+          | PackageType::WindowsMsi
+          | PackageType::Deb
+          | PackageType::Rpm
+      )
+    });
+
+    // the macOS app bundle is always archived, the other v1 targets only for the legacy updater
+    if package_types.contains(&PackageType::MacOsBundle) || has_v1_target {
       let updater_paths = updater_bundle::bundle_project(settings, &bundles)?;
       bundles.push(Bundle {
         package_type: PackageType::Updater,
         bundle_paths: updater_paths,
       });
-    } else if updater.v1_compatible
-      || !package_types.iter().any(|package_type| {
-        // Self contained updater, no need to zip
-        matches!(
-          package_type,
-          PackageType::AppImage | PackageType::Nsis | PackageType::WindowsMsi | PackageType::Deb
-        )
-      })
-    {
+    } else if updater.v1_compatible {
       log::warn!(
-        "The bundler was configured to create updater artifacts but no updater-enabled targets were built. Please enable one of these targets: app, appimage, msi, nsis"
+        "No v1 compatible updater artifact was created: the legacy updater only supports the app, appimage, msi and nsis targets. deb and rpm bundles can only be installed by the v2 updater plugin."
+      );
+    } else if !has_self_contained_target {
+      log::warn!(
+        "The bundler was configured to create updater artifacts but no updater-enabled targets were built. Please enable one of these targets: app, appimage, deb, rpm, msi, nsis"
       );
     }
+
     if updater.v1_compatible {
       log::warn!(
         "Legacy v1 compatible updater is deprecated and will be removed in v3, change bundle > createUpdaterArtifacts to true when your users are updated to the version with v2 updater plugin"
```

#### Recent Merged Pull Requests:
- **PR #16228** (closed): fix(core): do not panic when a replayed queued emit reaches a once handler (@entity-0-0-2)
- **PR #16222** (2026-10-07): fix: panic on repeated `once` listener events (@Legend-Master)
- **PR #16212** (closed): feat(bundler): add `sidecarEntitlements` option to sign macOS sidecars with their own entitlements (@ocavuebot)
- **PR #16195** (2026-10-07): fix(api): return awaitable cleanup from combined event listeners (@alessandrorodi)
- **PR #16190** (2026-10-06): chore: add publiccode.yml file (@lucasfernog)
- **PR #16186** (2026-09-30): fix(plugin): skip build script writes on docs.rs builds (@lucasfernog)
- **PR #16166** (2026-09-29): fix: enable macos private apis regardless of feature flags (@FabianLars)
- **PR #16165** (2026-09-29): fix: ignore `src-tauri` in vite configs (@Legend-Master)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
