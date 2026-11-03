> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/topgrade-rs-topgrade-learnings.md`  
> **Source**: github ([https://github.com/topgrade-rs/topgrade](https://github.com/topgrade-rs/topgrade))  
> **Source Version**: `2dfd6fcd`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T11:45:00.818Z  
> **Learning ID**: `learn-github-topgrade-rs-topgrade`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): topgrade-rs/topgrade

> **Canonical Artifact**: `07_PROJECT_LEARNING/topgrade-rs-topgrade-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/topgrade-rs/topgrade](https://github.com/topgrade-rs/topgrade))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-03T11:38:58.520Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `topgrade-rs/topgrade`
- **Description**: Upgrade all the things
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 4729 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils.rs`
```
#[cfg(windows)]
use crate::WINDOWS_DIRS;
#[cfg(unix)]
use crate::XDG_DIRS;
use crate::output_changed_message;
use std::collections::HashSet;
use std::env;
use std::ffi::OsStr;
use std::fmt::Debug;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{LazyLock, OnceLock};

use color_eyre::eyre::{Context, Result, eyre};
use etcetera::BaseStrategy;
use itertools::Itertools;
use rust_i18n::t;

use tracing::{debug, warn};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::reload::{Handle, Layer};
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, registry};
use tracing_subscriber::{Registry, fmt};

use crate::command::CommandExt;
use crate::config::DEFAULT_LOG_LEVEL;
use crate::error::SkipStep;
use crate::execution_context::ExecutionContext;
use crate::executor::Executor;
use crate::steps::generic::IS_WSL;

pub trait PathExt
where
    Self: Sized,
{
    fn if_exists(self) -> Option<Self>;
    fn is_descendant_of(&self, ancestor: &Path) -> bool;

    /// Used to check for UNIX launcher shims that shadow a real executable
    fn has_shebang(&self) -> bool;

    /// Returns the path if it exists or ErrorKind::SkipStep otherwise
    fn require(self) -> Result<Self>;
}

impl<T> PathExt for T
where
    T: AsRef<Path>,
{
    fn if_exists(self) -> Option<Self> {
        if self.as_ref().exists() {
            debug!("Path {:?} exists", self.as_ref());
            Some(self)
        } else {
            debug!("Path {:?} doesn't exist", self.as_ref());
            None
        }
    }

    fn is_descendant_of(&self, ancestor: &Path) -> bool {
        self.as_ref().iter().zip(ancestor.iter()).all(|(a, b)| a == b)
    }

    fn has_shebang(&self) -> bool {
        use std::io::Read;

        // checks for `#!` by the reading the first 2 bytes of the file
        let mut magic = [0u8; 2];
        std::fs::File::open(self.as_ref())
            .and_then(|mut file| file.read_exact(&mut magic))
            .is_ok()
            && &magic == b"#!"
    }

    fn require(self) -> Result<Self> {
        if self.as_ref().exists() {
            debug!("Path {:?} exists", self.as_ref());
            Ok(self)
        } else {
            Err(SkipStep(format!(
                "{}",
                t!("Path {path} doesn't exist", path = format!("{:?}", self.as_ref()))
            ))
            .into())
        }
    }
}

#[allow(unused)]
pub trait OptionExt<T> {
    fn or_else_fallible<F: FnOnce() -> Result<Option<T>>>(self, f: F) -> Result<Option<T>>;
}

impl<T> OptionExt<T> for Option<T> {
    fn or_else_fallible<F: FnOnce() -> Result<Option<T>>>(self, f: F) -> Result<Option<T>> {
        match self {
            Some(x) => Ok(Some(x)),
            None => f(),
        }
    }
}

/// `[linux] wsl_use_windows_path`, set once at startup. While unset the filter keeps its
/// default: off outside WSL, on inside.
static WSL_USE_WINDOWS_PATH: OnceLock<bool> = OnceLock::new();

pub fn set_wsl_use_windows_path(use_windows_path: bool) -> Result<()> {
    WSL_USE_WINDOWS_PATH
        .set(use_windows_path)
        .map_err(|_| eyre!("WSL Windows-path setting was already initialized"))
}

/// Inside WSL a plain PATH lookup can resolve a Windows executable on `/mnt/*` that
/// fails to run in the guest (topgrade-rs/topgrade#1243). When on, detection skips those.
/// Off via `wsl_use_windows_path = true`.
fn wsl_windows_path_filter_enabled() -> bool {
    *IS_WSL && !WSL_USE_WINDOWS_PATH.get().copied().unwrap_or(false)
}

/// Mount points backed by Windows drives (drvfs on WSL1, 9p/virtiofs on WSL2).
static PREFIXES: LazyLock<Vec<PathBuf>> = LazyLock::new(|| {
    // On a read failure the list stays empty, so the filter is inert (plain lookup).
    let mounts = std::fs::read_to_string("/proc/mounts").unwrap_or_else(|e| {
        warn!("Could not read /proc/mounts: {e}; WSL Windows-path filter stays inert");
        String::new()
    });
    mounts
        .lines()
        .filter_map(|line| {
            let mut cols = line.split_whitespace();
            let _source = cols.next()?;
            let mount_point = cols.next()?;
            let fstype = cols.next()?;
            let options = cols.next().unwrap_or("");
            // A Windows drive is WSL1 drvfs, or a WSL2 9p/virtiofs mount tagged
            // `aname=drvfs`. Keying on that tag rather than the fstype avoids WSL's own
            // 9p/virtiofs mounts (/usr/lib/wsl/drivers, /mnt/wslg) and still catches a
            // drive mounted via virtiofs.
            (fstype == "drvfs" || options.contains("aname=drvfs")).then(|| PathBuf::from(mount_point))
        })
        .collect()
});

fn is_windows_mount_path(path: &Path) -> bool {
    PREFIXES.iter().any(|prefix| path.starts_with(prefix))
}

/// Mise shims dir, normally ~/.local/share/mise/shims
static MISE_SHIMS: LazyLock<PathBuf> = LazyLock::new(|| {
    env::var("MISE_SHIMS_DIR").map(PathBuf::from).unwrap_or_else(|_| {
        env::var("MISE_DATA_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                #[cfg(unix)]
                let data_dir = XDG_DIRS.data_dir();
                #[cfg(windows)]
                let data_dir = WINDOWS_DIRS.cache_dir(); // AppData\Local
                data_dir.join("mise")
            })
            .join("shims")
    })
});

fn mise_shim_is_nonfunctional(path: &Path) -> Result<bool> {
    // --help is usually safe to run. A program not supporting it and erroring is okay too.
    debug!("{path:?} is in mise shims dir ({MISE_SHIMS:?}), running `{path:?} --help` to check if it is functional");
    // TODO: There's no easy way to do this without `which` and `require` taking `ctx`.
    //  This loses automatic logging and damp runs.
    #[expect(clippy::disallowed_methods)]
    let out = Command::new(path)
        .arg("--help")
        .output()
        .wrap_err_with(|| format!("Running `{} --help` failed", path.display()))?;
    let stderr = match String::from_utf8(out.stderr) {
        Ok(stderr) => stderr,
        Err(_) => return Ok(false), // Non-UTF-8 output is weird, but mise's shim errors are UTF-8 so it must be working
    };
    Ok(stderr.contains("mise ERROR No version is set for shim:"))
}

pub fn which<T: AsRef<OsStr> + Debug>(binary_name: T) -> Result<Option<PathBuf>> {
    #[expect(clippy::disallowed_methods)]
    let candidates = match which_crate::which_all(&binary_name) {
        Ok(candidates) => candidates,
        Err(which_crate::Error::CannotFindBinaryPath) => {
            debug!("Cannot find {:?}", &binary_name);
            return Ok(None);
        }
        Err(e) => return Err(eyre!(e).wrap_err(format!("Detecting {:?} failed", binary_name))),
    };

    let mut errors = HashSet::new();
    let path = 'find: {
        for path in candidates {
            if path.starts_with(&*MISE_SHIMS) && mise_shim_is_nonfunctional(&path)? {
                errors.insert("a Mise shim without global default version");
                continue;
            }
            if wsl_windows_path_filter_enabled() && is_windows_mount_path(&path) {
                errors.insert("a Windows binary via WSL interop");
                continue;
            }
            break 'find Some(path);
        }
        None
    };

    match path {
        Some(path) => {
            debug!("Detected {:?} as {:?}", &path, &binary_name);
            Ok(Some(path))
        }
        None => {
            if !errors.is_empty() {
                debug!(
                    "Cannot find usable {:?} in PATH (only {})",
                    &binary_name,
                    errors.into_iter().sorted().join(", and ")
                );
            } else {
                debug!("Cannot find {:?}", &binary_name);
            }
            Ok(None)
        }
    }
}

pub fn require<T: AsRef<OsStr> + Debug>(binary_name: T) -> Result<PathBuf> {
    which(&binary_name)?.ok_or_else(|| {
        SkipStep(format!(
            "{}",
            t!(
                "Cannot find {binary_name} in PATH",
                binary_name = format!("{:?}", &binary_name)
            )
        ))
        .into()
    })
}

#[allow(unused)]
pub fn require_flatpak(ctx: &ExecutionContext, name: &str) -> Result<Executor> {
    let flatpak = require("flatpak")?;

    let result = ctx.execute(&flatpak).always().args(["info", name]).output_checked();

    match result {
        Ok(_) => {
            debug!("Flatpak {name:?} is installed");
            let mut cmd = ctx.execute(&flatpak);
            cmd.args(["run", name]);
            Ok(cmd)
        }
        _ => Err(SkipStep(t!("Flatpak {name} is not installed", name = name).to_string()).into()),
    }
}

#[allow(unused)]
pub fn which_one<T: AsRef<OsStr> + Debug>(binary_names: impl IntoIterator<Item = T>) -> Result<Option<PathBuf>> {
    for bin in binary_names {
        if let Some(path) = which(&bin)? {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

pub fn require_one<T: AsRef<OsStr> + Debug>(binary_names: impl IntoIterator<Item = T>) -> Result<PathBuf> {
    let mut failed_bins = Vec::new();
    for bin in binary_names {
        match which(&bin)? {
            Some(path) => return Ok(path),
            None => failed_bins.push(bin),
        }
    }

    Err(SkipStep(format!(
        "{}",
        t!(
            "Cannot find any of {binary_names} in PATH",
            binary_names = failed_bins
                .iter()
                .format_with(", ", |bin, f| f(&format_args!("{:?}", bin)))
        )
    ))
    .into())
}

pub fn is_installed_via_homebrew(binary: &Path) -> bool {
    binary
        .canonicalize()
        .is_ok_and(|p| p.to_string_lossy().contains("/Cellar/"))
}

#[allow(dead_code)]
pub fn require_one_path<T: AsRef<Path> + Debug>(paths: impl IntoIterator<Item = T>) -> Result<PathBuf> {
    let mut failed_paths = Vec::new();
    for path_s in paths {
        let path = path_s.as_ref();
        if path.exists() {
            debug!("Found required pat
```

### Core Architecture Module: `src/breaking_changes.rs`
```
//! Inform the users of the breaking changes introduced in this major release.
//!
//! Print the breaking changes and possibly a migration guide when:
//!     1. The Topgrade being executed is a new major release
//!     2. This is the first launch of that major release

#[cfg(windows)]
use crate::WINDOWS_DIRS;
#[cfg(unix)]
use crate::XDG_DIRS;
use crate::terminal::{print_separator, prompt_yesno};
use color_eyre::eyre::{Context, Result};
use etcetera::base_strategy::BaseStrategy;
use rust_i18n::t;
use semver::Version;
use std::path::PathBuf;
use std::process::exit;
use std::sync::LazyLock;
use std::{env, fs};

/// Version string x.y.z as supplied by cargo
static VERSION_STR: &str = env!("CARGO_PKG_VERSION");
static VERSION: LazyLock<Version> = LazyLock::new(|| VERSION_STR.parse::<Version>().unwrap());

/// Topgrade's breaking changes
///
/// We store them in the compiled binary. They are generated by build.rs.
static BREAKINGCHANGES: &str = include_str!(concat!(env!("OUT_DIR"), "/breaking_changes.txt"));

pub(crate) fn run() -> Result<()> {
    let keep_file = keep_file_path();

    // This is the first run of Topgrade, or the first run of Topgrade v17 (which added the current
    //  breaking changes functionality)
    if !keep_file.exists() {
        // If this is the first run of Topgrade, there's no need to notify the user about any changes
        // If this is the first run of Topgrade v17, there are no breaking changes. We will
        //  assume every user runs Topgrade v17 before running Topgrade v18, causing a 17.x.x
        //  version to be written to the keep file, causing v18 to trigger the breaking changes notification.
        write_keep_file()?;
        return Ok(());
    }

    // If the major version is higher than the major part of the last run version
    //  (this does only show v3 release notes if upgrading from v1 to v3 (skipping v2), but
    //  that isn't going to happen a lot anyway, and this is a lot simpler.)
    if VERSION.major
        > fs::read_to_string(&keep_file)?
            .parse::<Version>()
            .wrap_err_with(|| format!("Invalid version in Topgrade keep file at {}", keep_file.display()))?
            .major
    {
        print_separator(t!(
            "Topgrade {version_str} Breaking Changes",
            version_str = format!("v{}", VERSION.major)
        ));
        let contents = if BREAKINGCHANGES.is_empty() {
            t!("No breaking changes").to_string()
        } else {
            BREAKINGCHANGES.to_string()
        };
        println!(
            "{contents}\nSee the full release notes at {}\n",
            release_notes_link(VERSION_STR)
        );

        if prompt_yesno(&t!("Continue?"))? {
            write_keep_file()?;
        } else {
            exit(1);
        }
    }

    Ok(())
}

fn release_notes_link(version: &str) -> String {
    format!("https://github.com/topgrade-rs/topgrade/releases/tag/v{version}")
}

fn write_keep_file() -> Result<()> {
    fs::create_dir_all(data_dir())?;
    fs::write(keep_file_path(), VERSION_STR)?;
    Ok(())
}

/// Return platform's data directory.
fn data_dir() -> PathBuf {
    #[cfg(unix)]
    return XDG_DIRS.data_dir();

    #[cfg(windows)]
    return WINDOWS_DIRS.data_dir();
}

/// Return Topgrade's keep file path.
///
/// keep file is a file under the data directory containing a major version
/// number, it will be created on first run and is used to check if an execution
/// of Topgrade is the first run of a major release, for more details, see
/// `first_run_of_major_release()`.
fn keep_file_path() -> PathBuf {
    data_dir().join("topgrade_keep")
}

/// If environment variable `TOPGRADE_SKIP_BRKC_NOTIFY` is set to `true`, then
/// we won't notify the user of the breaking changes.
pub(crate) fn should_skip() -> bool {
    env::var("TOPGRADE_SKIP_BRKC_NOTIFY").is_ok_and(|var| var.as_str() == "true")
}

```

### Core Architecture Module: `src/command.rs`
```
//! Utilities for running commands and providing user-friendly error messages.

use std::fmt::Display;
use std::process::Child;
use std::process::{Command, ExitStatus, Output};

use color_eyre::eyre;
use color_eyre::eyre::Context;
use color_eyre::eyre::eyre;

use crate::error::TopgradeError;

use tracing::debug;

/// Like [`Output`], but UTF-8 decoded.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Utf8Output {
    pub status: ExitStatus,
    pub stdout: String,
    pub stderr: String,
}

impl TryFrom<Output> for Utf8Output {
    type Error = eyre::Error;

    fn try_from(Output { status, stdout, stderr }: Output) -> Result<Self, Self::Error> {
        let stdout = String::from_utf8(stdout).map_err(|err| {
            eyre!(
                "Stdout contained invalid UTF-8: {}",
                String::from_utf8_lossy(err.as_bytes())
            )
        })?;
        let stderr = String::from_utf8(stderr).map_err(|err| {
            eyre!(
                "Stderr contained invalid UTF-8: {}",
                String::from_utf8_lossy(err.as_bytes())
            )
        })?;

        Ok(Utf8Output { status, stdout, stderr })
    }
}

impl TryFrom<&Output> for Utf8Output {
    type Error = eyre::Error;

    fn try_from(Output { status, stdout, stderr }: &Output) -> Result<Self, Self::Error> {
        let stdout = String::from_utf8(stdout.clone()).map_err(|err| {
            eyre!(
                "Stdout contained invalid UTF-8: {}",
                String::from_utf8_lossy(err.as_bytes())
            )
        })?;
        let stderr = String::from_utf8(stderr.clone()).map_err(|err| {
            eyre!(
                "Stderr contained invalid UTF-8: {}",
                String::from_utf8_lossy(err.as_bytes())
            )
        })?;
        let status = *status;

        Ok(Utf8Output { status, stdout, stderr })
    }
}

impl Display for Utf8Output {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.stdout)
    }
}

/// Extension trait for [`Command`], adding helpers to gather output while checking the exit
/// status.
///
/// These also give us significantly better error messages, which include:
///
/// 1. The command and arguments that were executed, escaped with familiar `sh` syntax.
/// 2. The exit status of the command or the signal that killed it.
/// 3. If we were capturing the output of the command, rather than forwarding it to the user's
///    stdout/stderr, the error message includes the command's stdout and stderr output.
///
/// Additionally, executing commands with these methods will log the command at debug-level,
/// useful when gathering error reports.
pub trait CommandExt {
    type Child;

    /// Like [`Command::output`], but checks the exit status and provides nice error messages.
    ///
    /// Returns an `Err` if the command failed to execute or returned a non-zero exit code.
    #[track_caller]
    fn output_checked(&mut self) -> eyre::Result<Output> {
        self.output_checked_with(|output: &Output| if output.status.success() { Ok(()) } else { Err(()) })
    }

    /// Like [`output_checked`], but also decodes Stdout and Stderr as UTF-8.
    ///
    /// Returns an `Err` if the command failed to execute, returned a non-zero exit code, or if the
    /// output contains invalid UTF-8.
    #[track_caller]
    fn output_checked_utf8(&mut self) -> eyre::Result<Utf8Output> {
        let output = self.output_checked()?;
        output.try_into()
    }

    /// Like [`output_checked`] but a closure determines if the command failed instead of
    /// [`ExitStatus::success`].
    ///
    /// Returns an `Err` if the command failed to execute or if `succeeded` returns an `Err`.
    /// (This lets the caller substitute their own notion of "success" instead of assuming
    /// non-zero exit codes indicate success.)
    #[track_caller]
    fn output_checked_with(&mut self, succeeded: impl Fn(&Output) -> Result<(), ()>) -> eyre::Result<Output>;

    /// Like [`output_checked_with`], but also decodes Stdout and Stderr as UTF-8.
    ///
    /// Returns an `Err` if the command failed to execute, if `succeeded` returns an `Err`, or if
    /// the output contains invalid UTF-8.
    #[track_caller]
    fn output_checked_with_utf8(
        &mut self,
        succeeded: impl Fn(&Utf8Output) -> Result<(), ()>,
    ) -> eyre::Result<Utf8Output> {
        // This decodes the Stdout and Stderr as UTF-8 twice...
        let output =
            self.output_checked_with(|output| output.try_into().map_err(|_| ()).and_then(|o| succeeded(&o)))?;
        output.try_into()
    }

    /// Like [`Command::status`], but gives a nice error message if the status is unsuccessful
    /// rather than returning the [`ExitStatus`].
    ///
    /// Returns `Ok` if the command executes successfully, returns `Err` if the command fails to
    /// execute or returns a non-zero exit code.
    #[track_caller]
    fn status_checked(&mut self) -> eyre::Result<()> {
        self.status_checked_with(|status| if status.success() { Ok(()) } else { Err(()) })
    }

    /// Like [`status_checked`], but gives a nice error message if the status is unsuccessful
    /// rather than returning the [`ExitStatus`].
    ///
    /// Returns `Ok` if the command executes successfully, returns `Err` if the command fails to
    /// execute or if `succeeded` returns an `Err`.
    /// (This lets the caller substitute their own notion of "success" instead of assuming
    /// non-zero exit codes indicate success.)
    #[track_caller]
    fn status_checked_with(&mut self, succeeded: impl Fn(ExitStatus) -> Result<(), ()>) -> eyre::Result<()>;

    /// Like [`Command::spawn`], but gives a nice error message if the command fails to
    /// execute.
    #[track_caller]
    #[allow(dead_code)]
    fn spawn_checked(&mut self) -> eyre::Result<Self::Child>;
}

impl CommandExt for Command {
    type Child = Child;

    fn output_checked_with(&mut self, succeeded: impl Fn(&Output) -> Result<(), ()>) -> eyre::Result<Output> {
        let command = log(self);

        // This is where we implement `output_checked`, which is what we prefer to use instead of
        // `output`, so we allow `Command::output` here.
        #[expect(clippy::disallowed_methods)]
        let output = self
            .output()
            .with_context(|| format!("Failed to execute `{command}`"))?;

        if succeeded(&output).is_ok() {
            Ok(output)
        } else {
            let mut message = format!("Command failed: `{command}`");
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);

            let stdout_trimmed = stdout.trim();
            if !stdout_trimmed.is_empty() {
                message.push_str(&format!("\n\nStdout:\n{stdout_trimmed}"));
            }
            let stderr_trimmed = stderr.trim();
            if !stderr_trimmed.is_empty() {
                message.push_str(&format!("\n\nStderr:\n{stderr_trimmed}"));
            }

            let (program, _) = get_program_and_args(self);
            let err = TopgradeError::ProcessFailedWithOutput(program, output.status, stderr.into_owned());

            let ret = Err(err).with_context(|| message);
            debug!("Command failed: {ret:?}");
            ret
        }
    }

    fn status_checked_with(&mut self, succeeded: impl Fn(ExitStatus) -> Result<(), ()>) -> eyre::Result<()> {
        let command = log(self);
        let message = format!("Failed to execute `{command}`");

        // This is where we implement `status_checked`, which is what we prefer to use instead of
        // `status`, so we allow `Command::status` here.
        #[expect(clippy::disallowed_methods)]
        let status = self.status().with_context(|| message.clone())?;

        if succeeded(status).is_ok() {
            Ok(())
        } else {
            let (program, _) = get_program_and_args(self);
            let err = TopgradeError::ProcessFailed(program, status);
            let ret = Err(err).with_context(|| format!("Command failed: `{command}`"));
            debug!("Command failed: {ret:?}");
            ret
        }
    }

    fn spawn_checked(&mut self) -> eyre::Result<Self::Child> {
        let command = log(self);
        let message = format!("Failed to execute `{command}`");

        // This is where we implement `spawn_checked`, which is what we prefer to use instead of
        // `spawn`, so we allow `Command::spawn` here.
        #[expect(clippy::disallowed_methods)]
        {
            self.spawn().with_context(|| message.clone())
        }
    }
}

fn get_program_and_args(cmd: &Command) -> (String, String) {
    // We're not doing anything weird with commands that are invalid UTF-8, so this is fine.
    let program = cmd.get_program().to_string_lossy().into_owned();
    let args = shell_words::join(cmd.get_args().map(|arg| arg.to_string_lossy()));
    (program, args)
}

fn format_program_and_args(cmd: &Command) -> String {
    let (program, args) = get_program_and_args(cmd);
    if args.is_empty() {
        program
    } else {
        format!("{program} {args}")
    }
}

fn log(cmd: &Command) -> String {
    let command = format_program_and_args(cmd);
    debug!("Executing command `{command}`");
    command
}

```

### Core Architecture Module: `src/config.rs`
```
#![allow(dead_code)]

use std::collections::HashSet;
use std::fs::{File, write};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use std::{env, fmt, fs};

use clap::{Parser, ValueEnum};
use clap_complete::Shell;
use color_eyre::eyre::Result;
use color_eyre::eyre::{Context, OptionExt};
use etcetera::base_strategy::BaseStrategy;
use indexmap::IndexMap;
use merge2::Merge;
use regex::Regex;
use regex_split::RegexSplit;
use rust_i18n::t;
use serde::Deserialize;
use strum::IntoEnumIterator;
use tracing::{debug, error};

use crate::execution_context::RunType;
use crate::step::{DEPRECATED_STEPS, Step};
use crate::sudo::SudoKind;
use crate::terminal::print_warning;
use crate::utils::string_prepend_str;

// TODO: Add i18n to this. Tracking issue: https://github.com/topgrade-rs/topgrade/issues/859
pub static EXAMPLE_CONFIG: &str = include_str!("../config.example.toml");

/// Topgrade's default log level.
pub const DEFAULT_LOG_LEVEL: &str = "warn";

#[allow(unused_macros)]
macro_rules! str_value {
    ($section:ident, $value:ident) => {
        pub fn $value(&self) -> Option<&str> {
            self.config_file
                .$section
                .as_ref()
                .and_then(|section| section.$value.as_deref())
        }
    };
}

pub type Commands = IndexMap<String, String>;

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Include {
    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    paths: Option<Vec<String>>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Containers {
    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    ignored_containers: Option<Vec<String>>,
    runtime: Option<ContainerRuntime>,
    system_prune: Option<bool>,
    use_sudo: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Mandb {
    enable: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Git {
    max_concurrency: Option<usize>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    repos: Option<Vec<String>>,

    pull_predefined: Option<bool>,

    fetch_only: Option<bool>,

    fallback_to_fetch_default: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Vagrant {
    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    directories: Option<Vec<String>>,

    power_on: Option<bool>,
    always_suspend: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Copy, Clone)]
#[serde(rename_all = "snake_case")]
pub enum UpdatesAutoReboot {
    Yes,
    #[default]
    No,
    Ask,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Windows {
    accept_all_updates: Option<bool>,
    updates_auto_reboot: Option<UpdatesAutoReboot>,
    self_rename: Option<bool>,
    open_remotes_in_new_terminal: Option<bool>,
    wsl_update_pre_release: Option<bool>,
    wsl_update_use_web_download: Option<bool>,
    winget_silent_install: Option<bool>,
    winget_use_sudo: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Python {
    enable_pip_review: Option<bool>,
    enable_pip_review_local: Option<bool>,
    enable_pipupgrade: Option<bool>,
    pipupgrade_arguments: Option<String>,
    poetry_force_self_update: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Conda {
    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    env_names: Option<Vec<String>>,

    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    env_paths: Option<Vec<String>>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Distrobox {
    use_root: Option<bool>,

    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    containers: Option<Vec<String>>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Yarn {
    use_sudo: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct VitePlus {
    use_sudo: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Npm {
    use_sudo: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Skills {
    package_manager: Option<SkillsPackageManager>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Deno {
    version: Option<String>,
    no_delta: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Chezmoi {
    exclude_encrypted: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Mise {
    bump: Option<bool>,
    interactive: Option<bool>,
    jobs: Option<u32>,
    verbose: Option<bool>,
    quiet: Option<bool>,
    silent: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Firmware {
    upgrade: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Flatpak {
    use_sudo: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Pixi {
    include_release_notes: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Brew {
    greedy_cask: Option<bool>,
    greedy_latest: Option<bool>,
    greedy_auto_updates: Option<bool>,
    autoremove: Option<bool>,
    fetch_head: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Go {
    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    gup_exclude: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Clone, Copy, Default)]
#[serde(rename_all = "snake_case")]
pub enum ArchPackageManager {
    #[default]
    Autodetect,
    Aura,
    GarudaUpdate,
    Pacman,
    Pamac,
    Paru,
    Pikaur,
    Shelly,
    Trizen,
    Yay,
}

#[derive(Debug, Deserialize, Clone, Copy, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SkillsPackageManager {
    #[default]
    #[serde(alias = "npx")]
    Npm,
    Pnpm,
    Bun,
    Yarn,
}

#[derive(Clone, Copy, Debug, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ContainerRuntime {
    #[default] // defaults to a popular choice
    Docker,
    Podman,
}

impl fmt::Display for ContainerRuntime {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ContainerRuntime::Docker => write!(f, "docker"),
            ContainerRuntime::Podman => write!(f, "podman"),
        }
    }
}

#[derive(Debug, Deserialize, Clone, Copy, Default, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum NixHandler {
    #[default]
    Autodetect,
    Nh,
    Vanilla,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Linux {
    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    yay_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    aura_aur_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    aura_pacman_arguments: Option<String>,
    arch_package_manager: Option<ArchPackageManager>,
    show_arch_news: Option<bool>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    garuda_update_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    trizen_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    pikaur_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    pamac_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    shelly_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    dnf_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    nix_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    nix_env_arguments: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    apt_arguments: Option<String>,

    enable_tlmgr: Option<bool>,
    redhat_distro_sync: Option<bool>,
    suse_dup: Option<bool>,
    rpm_ostree: Option<bool>,
    bootc: Option<bool>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    emerge_sync_flags: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::string_append_opt)]
    emerge_update_flags: Option<String>,

    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    home_manager_arguments: Option<Vec<String>>,

    wsl_use_windows_path: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Composer {
    self_update: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Vim {
    force_plug_update: Option<bool>,

    vim_pack_prune: Option<bool>,
}

#[derive(Deserialize, Default, Debug, Merge)]
#[serde(deny_unknown_fields)]
pub struct Misc {
    allow_root: Option<bool>,

    pre_sudo: Option<bool>,

    sudo_loop: Option<bool>,

    sudo_loop_interval: Option<u16>,

    sudo_command: Option<SudoKind>,

    #[merge(strategy = crate::utils::merge_strategies::vec_prepend_opt)]
    disable: Option<Vec<Step>>,

    #[merge(strategy = crate:
```

### Core Architecture Module: `src/ctrlc/interrupted.rs`
```
use std::sync::atomic::{AtomicBool, Ordering};

/// A global variable telling whether the application has been interrupted.
static INTERRUPTED: AtomicBool = AtomicBool::new(false);

/// Tells whether the program has been interrupted
pub fn interrupted() -> bool {
    INTERRUPTED.load(Ordering::SeqCst)
}

/// Clears the interrupted flag
pub fn unset_interrupted() {
    debug_assert!(INTERRUPTED.load(Ordering::SeqCst));
    INTERRUPTED.store(false, Ordering::SeqCst);
}

pub fn set_interrupted() {
    INTERRUPTED.store(true, Ordering::SeqCst);
}

```

### Core Architecture Module: `src/ctrlc/mod.rs`
```
mod interrupted;

#[cfg(unix)]
mod unix;
#[cfg(unix)]
pub use self::unix::set_handler;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use self::windows::set_handler;

pub use self::interrupted::*;

```

### Core Architecture Module: `src/ctrlc/unix.rs`
```
//! SIGINT handling in Unix systems.
use crate::ctrlc::interrupted::set_interrupted;
use nix::sys::signal::{SaFlags, SigAction, SigHandler, SigSet, Signal, sigaction};

/// Handle SIGINT. Set the interruption flag.
extern "C" fn handle_sigint(_: i32) {
    set_interrupted();
}

/// Set the necessary signal handlers.
/// The function panics on failure.
pub fn set_handler() {
    let sig_action = SigAction::new(SigHandler::Handler(handle_sigint), SaFlags::empty(), SigSet::empty());
    unsafe {
        sigaction(Signal::SIGINT, &sig_action).unwrap();
    }
}

```

### Core Architecture Module: `src/ctrlc/windows.rs`
```
//! A stub for Ctrl + C handling.
use crate::ctrlc::interrupted::set_interrupted;
use tracing::error;
use windows::Win32::System::Console::{CTRL_C_EVENT, SetConsoleCtrlHandler};
use windows::core::BOOL;

extern "system" fn handler(ctrl_type: u32) -> BOOL {
    match ctrl_type {
        CTRL_C_EVENT => {
            set_interrupted();
            true.into()
        }
        _ => false.into(),
    }
}

pub fn set_handler() {
    if let Err(e) = unsafe { SetConsoleCtrlHandler(Some(handler), true) } {
        error!("Cannot set a control C handler: {e}")
    }
}

```

### Core Architecture Module: `src/error.rs`
```
use std::{fmt::Display, process::ExitStatus};

use rust_i18n::t;
use thiserror::Error;

use crate::sudo::SudoKind;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum TopgradeError {
    ProcessFailed(String, ExitStatus),

    ProcessFailedWithOutput(String, ExitStatus, String),

    #[cfg(target_os = "linux")]
    UnknownLinuxDistribution,

    #[cfg(target_os = "linux")]
    EmptyOSReleaseFile,

    #[cfg(target_os = "linux")]
    FailedGettingPackageManager,
}

impl Display for TopgradeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TopgradeError::ProcessFailed(process, exit_status) => {
                write!(
                    f,
                    "{}",
                    t!(
                        "`{process}` failed: {exit_status}",
                        process = process,
                        exit_status = exit_status
                    )
                )
            }
            TopgradeError::ProcessFailedWithOutput(process, exit_status, output) => {
                write!(
                    f,
                    "{}",
                    t!(
                        "`{process}` failed: {exit_status} with {output}",
                        process = process,
                        exit_status = exit_status,
                        output = output
                    )
                )
            }
            #[cfg(target_os = "linux")]
            TopgradeError::UnknownLinuxDistribution => write!(f, "{}", t!("Unknown Linux Distribution")),
            #[cfg(target_os = "linux")]
            TopgradeError::EmptyOSReleaseFile => {
                write!(f, "{}", t!("File \"/etc/os-release\" does not exist or is empty"))
            }
            #[cfg(target_os = "linux")]
            TopgradeError::FailedGettingPackageManager => {
                write!(f, "{}", t!("Failed getting the system package manager"))
            }
        }
    }
}

#[derive(Error, Debug)]
pub struct StepFailed;

impl Display for StepFailed {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", t!("A step failed"))
    }
}

#[derive(Error, Debug)]
pub struct UnsupportedSudo<'a> {
    pub sudo_kind: SudoKind,
    pub option: &'a str,
}

impl Display for UnsupportedSudo<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            t!(
                "{sudo_kind} does not support the {option} option",
                sudo_kind = self.sudo_kind,
                option = self.option
            )
        )
    }
}

#[derive(Error, Debug)]
pub struct MissingSudo();

impl Display for MissingSudo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", t!("Could not find sudo"))
    }
}

#[derive(Error, Debug)]
pub struct DryRun();

impl Display for DryRun {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", t!("Dry running"))
    }
}

#[derive(Error, Debug, Clone)]
pub struct SkipStep(pub String);

impl Display for SkipStep {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

```

### Core Architecture Module: `src/execution_context.rs`
```
#![allow(dead_code)]
use std::env::var;
use std::ffi::OsStr;
use std::process::Command;
use std::sync::{Mutex, OnceLock};

use clap::ValueEnum;
use color_eyre::eyre::{Result, eyre};
use serde::Deserialize;
use strum::EnumString;

use crate::config::Config;
use crate::error::{MissingSudo, SkipStep};
use crate::executor::{DryCommand, Executor};
use crate::powershell::Powershell;
#[cfg(target_os = "linux")]
use crate::steps::linux::Distribution;
use crate::sudo::Sudo;

/// An enum telling whether Topgrade should perform dry runs or actually perform the steps.
#[derive(Clone, Copy, Debug, Deserialize, Default, EnumString, ValueEnum)]
pub enum RunType {
    /// Executing commands will just print the command with its arguments.
    Dry,

    /// Executing commands will perform actual execution.
    #[default]
    Wet,

    /// Executing commands will print the command and perform actual execution.
    Damp,
}

impl RunType {
    /// Tells whether we're performing a dry run.
    pub fn dry(self) -> bool {
        match self {
            RunType::Dry => true,
            RunType::Wet => false,
            RunType::Damp => false,
        }
    }

    /// Create an `Executor` for the given program using this run type.
    #[expect(clippy::disallowed_methods)]
    pub fn execute<S: AsRef<OsStr>>(self, program: S) -> Executor {
        match self {
            RunType::Dry => Executor::Dry(DryCommand::new(program)),
            RunType::Wet => Executor::Wet(Command::new(program)),
            RunType::Damp => Executor::Damp(Command::new(program)),
        }
    }
}

pub struct ExecutionContext<'a> {
    run_type: RunType,
    sudo: Option<Sudo>,
    config: &'a Config,
    /// Name of a tmux session to execute commands in, if any.
    /// This is used in `./steps/remote/ssh.rs`, where we want to run `topgrade` in a new
    /// tmux window for each remote.
    tmux_session: Mutex<Option<String>>,
    /// True if topgrade is running under ssh.
    under_ssh: bool,
    #[cfg(target_os = "linux")]
    distribution: &'a Result<Distribution>,
    powershell: OnceLock<Result<Powershell>>,
}

impl<'a> ExecutionContext<'a> {
    pub fn new(
        run_type: RunType,
        sudo: Option<Sudo>,
        config: &'a Config,
        #[cfg(target_os = "linux")] distribution: &'a Result<Distribution>,
    ) -> Self {
        let under_ssh = var("SSH_CLIENT").is_ok() || var("SSH_TTY").is_ok();
        Self {
            run_type,
            sudo,
            config,
            tmux_session: Mutex::new(None),
            under_ssh,
            #[cfg(target_os = "linux")]
            distribution,
            powershell: OnceLock::new(),
        }
    }

    /// Create an instance of `Executor` that should run `program`.
    pub fn execute<S: AsRef<OsStr>>(&self, program: S) -> Executor {
        self.run_type.execute(program)
    }

    pub fn run_type(&self) -> RunType {
        self.run_type
    }

    pub fn sudo(&self) -> &Option<Sudo> {
        &self.sudo
    }

    pub fn require_sudo(&self) -> Result<&Sudo> {
        if let Some(value) = self.sudo() {
            Ok(value)
        } else {
            Err(MissingSudo().into())
        }
    }

    pub fn config(&self) -> &Config {
        self.config
    }

    pub fn under_ssh(&self) -> bool {
        self.under_ssh
    }

    pub fn set_tmux_session(&self, session_name: String) {
        self.tmux_session.lock().unwrap().replace(session_name);
    }

    pub fn get_tmux_session(&self) -> Option<String> {
        self.tmux_session.lock().unwrap().clone()
    }

    #[cfg(target_os = "linux")]
    pub fn distribution(&self) -> &Result<Distribution> {
        self.distribution
    }

    fn powershell(&self) -> &Result<Powershell> {
        self.powershell.get_or_init(|| Powershell::new(self))
    }

    pub fn require_powershell(&self) -> Result<&Powershell> {
        self.powershell()
            .as_ref()
            // necessary because `e` is a `&Result` borrowed from `self` (`e.into()` gives E0521)
            .map_err(|e| {
                if let Some(skip) = e.downcast_ref::<SkipStep>() {
                    skip.clone().into()
                } else {
                    // Loses error context
                    eyre!("{}", e)
                }
            })
    }

    pub fn opt_powershell(&self) -> Result<Option<&Powershell>> {
        match self.require_powershell() {
            Ok(powershell) => Ok(Some(powershell)),
            Err(e) if e.downcast_ref::<SkipStep>().is_some() => Ok(None),
            Err(e) => Err(e),
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2473** (2026-11-02): **fix(zed): query Zed's release endpoint to avoid GitHub rate limits**
  *Symptoms*: ## What does this PR do?  Fixes the Zed step failing with `invalid type: map, expected a sequence`.  The step fetched the release list from api.github.com and parsed the body as a `Vec`. It never checked the response status, and unauthenticated GitHub API requests are capped at 60 per hour per IP. Once the cap is hit, GitHub answers 403 with a JSON object, so serde complained about a map where it expected a sequence. The cap resets hourly, so the step failed intermittently and looked like a parsing bug.  The version lookup now uses Zed's own release endpoint on `cloud.zed.dev`, the one `zed.dev/install.sh` already queries before downloading. It needs no token and is not rate limited, and it returns a single version field instead of a list, so the prerelease scan and the tag parsing for the preview channel are gone as well.  The 60/hour cap applies to `api.github.com`, not to the release downloads served behind `github.com`, so nothing is lost by leaving the REST API.  ## Standards checklist  - [x] I have read `CONTRIBUTING.md` - [x] *Optional:* The PR title is a descriptive commit message (this will appear in release notes, leave unchecked if you want a maintainer to improve it) - [x] *Optional:* I have tested the code myself, with the relevant tools installed. If yes, add Topgrade's output of the relevant steps. - [x] If this PR introduces new user-facing messages, they are translated  ### AI involvement  AI generated the majority of the PR. An AI agent investigated the endp

- **Issue #2472** (2026-11-02): **chore(deps): lock file maintenance**
  *Symptoms*: This PR contains the following updates:  | Update | Change | |---|---| | lockFileMaintenance | All locks refreshed |  🔧 This Pull Request updates lock files to use the latest dependency versions.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - Between 12:00 AM and 03:59 AM, only on Monday (`* 0-3 * * 1`) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  👻 **Immortal**: This PR will be recreated if closed unmerged. Get [config help](https://redirect.github.com/renovatebot/renovate/discussions) if that's undesired.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/topgrade-rs/topgrade). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xODguMiIsInVwZGF0ZWRJblZlciI6IjQ0LjE4OC4yIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 

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

### Incident Patch 1: `8497c4e3` (2026-11-02)
**Commit Message**: fix(zed): query Zed's release endpoint to avoid GitHub rate limits (#2473)

**File**: `locales/app.yml` (modified, +0/-9)
```diff
@@ -1728,12 +1728,3 @@ _version: 2
   zh_TW: "不支援更新 Zed %{channel} 通道"
   de: "Updates für den Zed-Kanal %{channel} werden nicht unterstützt"
   ko: "Zed %{channel} 채널은 업데이트를 지원하지 않습니다"
-"No Zed preview release found on GitHub":
-  en: "No Zed preview release found on GitHub"
-  lt: "GitHub'e nerasta Zed preview leidimo"
-  es: "No se encontró ninguna versión preview de Zed en GitHub"
-  fr: "Aucune version preview de Zed trouvée sur GitHub"
-  zh_CN: "在 GitHub 上找不到 Zed preview 版本"
-  zh_TW: "在 GitHub 上找不到 Zed preview 版本"
-  de: "Keine Zed-Preview-Version auf GitHub gefunden"
-  ko: "GitHub에서 Zed 프리뷰 릴리스를 찾을 수 없습니다"
```

**File**: `src/steps/os/linux.rs` (modified, +16/-26)
```diff
@@ -3,7 +3,7 @@ use std::io::Write;
 use std::path::{Path, PathBuf};
 use std::process::Stdio;
 
-use color_eyre::eyre::{OptionExt, Result, WrapErr, eyre};
+use color_eyre::eyre::{Result, WrapErr, eyre};
 use ini::Ini;
 use rust_i18n::t;
 use semver::Version;
@@ -1279,34 +1279,24 @@ pub fn run_zed(ctx: &ExecutionContext) -> Result<()> {
 
     #[derive(Deserialize)]
     struct Response {
-        tag_name: String,
-        prerelease: bool,
+        version: String,
     }
 
-    let release = if channel == "stable" {
-        client
-            .get("https://api.github.com/repos/zed-industries/zed/releases/latest")
-            .send()
-            .wrap_err("Failed to get latest version")?
-            .json::<Response>()?
-    } else {
-        // Preview releases are GitHub prereleases tagged `vx.y.z-pre`; the list is sorted newest first
-        client
-            .get("https://api.github.com/repos/zed-industries/zed/releases")
-            .send()
-            .wrap_err("Failed to fetch releases")?
-            .json::<Vec<Response>>()?
-            .into_iter()
-            .find(|release| release.prerelease && release.tag_name.ends_with("-pre"))
-            .ok_or_else(|| eyre!(t!("No Zed preview release found on GitHub")))?
-    };
+    let arch = std::env::consts::ARCH;
+    if !["x86_64", "aarch64"].contains(&arch) {
+        return Err(SkipStep(format!("No Zed build for the {arch} architecture")).into());
+    }
+
+    let release = client
+        .get(format!(
+            "https://cloud.zed.dev/releases/{channel}/latest/asset?asset=zed&os=linux&arch={arch}"
+        ))
+        .send()
+        .and_then(|response| response.error_for_status())
+        .wrap_err("Failed to fetch the latest Zed release")?
+        .json::<Response>()?;
 
-    let tag = release
-        .tag_name
-        .strip_prefix('v')
-        .ok_or_eyre("Tag on GitHub doesn't start with 'v'")?;
-    // The installed preview reports `x.y.z` without the `-pre` suffix
-    let latest = Version::parse(tag.strip_suffix("-pre").unwrap_or(tag))?;
+    let latest = Version::parse(&release.version)?;
 
     if version < latest {
         let mut response = client
```

---

### Incident Patch 2: `7a939362` (2026-11-02)
**Commit Message**: fix: exclude run0 from Toolbx privilege escalation (#2453)

Signed-off-by: Matt Van Horn <[REDACTED_EMAIL]>
Co-authored-by: Matt Van Horn <[REDACTED_EMAIL]>

**File**: `src/main.rs` (modified, +41/-5)
```diff
@@ -82,6 +82,43 @@ impl Drop for TempCwd {
     }
 }
 
+/// Whether `TOPGRADE_PREFIX` is the Toolbx child Topgrade.
+///
+/// Toolbx shares the host home and the host system bus, so a configured `run0`
+/// would execute on the host (exit status 203 inside the container).
+/// `src/steps/toolbx.rs` passes `TOPGRADE_PREFIX=Toolbx <name>` to `env`.
+/// The name must be nonempty: SSH hosts, Distrobox, and any other prefix stay
+/// unrestricted.
+///
+/// See: https://github.com/topgrade-rs/topgrade/issues/2373
+fn is_toolbx_child(prefix: Option<&str>) -> bool {
+    matches!(prefix.and_then(|prefix| prefix.strip_prefix("Toolbx ")), Some(name) if !name.is_empty())
+}
+
+/// Choose the privilege-escalation command.
+///
+/// Explicit kinds other than `run0` are kept. Inside Toolbx, configured `run0`
+/// is treated as unset, so detection runs with `run0` removed. Elevated
+/// execution with no kind, including that rewritten `run0`, stays `Null`.
+fn select_sudo(configured: Option<SudoKind>, elevated: bool, prefix: Option<&str>) -> Result<Sudo, SudoCreateError> {
+    let in_toolbx = is_toolbx_child(prefix);
+    if in_toolbx {
+        debug!("Toolbx child: excluding run0 from privilege escalation");
+    }
+
+    let configured = match configured {
+        Some(SudoKind::Run0) if in_toolbx => None,
+        other => other,
+    };
+    match configured {
+        Some(kind) => Sudo::new(kind),
+        None if elevated => Sudo::new(SudoKind::Null),
+        // Toolbx exposes the host system bus, so `run0` would act on the host.
+        None if in_toolbx => Sudo::detect(&[SudoKind::Run0]),
+        None => Sudo::detect(&[]),
+    }
+}
+
 fn run() -> Result<()> {
     install_color_eyre()?;
     ctrlc::set_handler();
@@ -171,11 +208,10 @@ fn run() -> Result<()> {
         }
     }
 
-    let sudo = match config.sudo_command() {
-        Some(kind) => Sudo::new(kind),
-        None if elevated => Sudo::new(SudoKind::Null),
-        None => Sudo::detect(),
-    };
+    // The Toolbx child inherits the host config. Its prefix is what tells us
+    // to keep `run0` off the host bus; other prefixes stay on the normal path.
+    let prefix = env::var("TOPGRADE_PREFIX").ok();
+    let sudo = select_sudo(config.sudo_command(), elevated, prefix.as_deref());
     debug!("Sudo: {:?}", sudo);
 
     let (sudo, sudo_err) = match sudo {
```

**File**: `src/steps/toolbx.rs` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ pub fn run_toolbx(ctx: &ExecutionContext) -> Result<()> {
     let topgrade_path = topgrade_path.to_str().ok_or_eyre("Non-UTF-8 path")?;
 
     for tb in toolboxes.iter() {
-        let topgrade_prefix = format!("TOPGRADE_PREFIX='Toolbx {tb}'");
+        let topgrade_prefix = format!("TOPGRADE_PREFIX=Toolbx {tb}");
         let mut args = vec![
             "run",
             "-c",
```

**File**: `src/sudo.rs` (modified, +8/-2)
```diff
@@ -148,10 +148,16 @@ const DETECT_ORDER: [SudoKind; 2] = [SudoKind::Gsudo, SudoKind::WinSudo];
 
 impl Sudo {
     /// Get the `sudo` binary for this platform.
-    pub fn detect() -> Result<Self, SudoCreateError> {
+    ///
+    /// Kinds in `disallowed_kinds` are skipped. Later candidates keep their
+    /// order, and the existing not-found / Windows errors are unchanged.
+    pub fn detect(disallowed_kinds: &[SudoKind]) -> Result<Self, SudoCreateError> {
         use SudoCreateError::*;
 
         for kind in DETECT_ORDER {
+            if disallowed_kinds.contains(&kind) {
+                continue;
+            }
             match Self::new(kind) {
                 Ok(sudo) => return Ok(sudo),
                 Err(CannotFindBinary) => continue,
@@ -566,7 +572,7 @@ impl Sudo {
 // We always define both though, so that we don't have to put
 // #[cfg(...)] everywhere.
 
-#[derive(Clone, Copy, Debug, Display, Deserialize)]
+#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Deserialize)]
 #[serde(rename_all = "lowercase")]
 #[strum(serialize_all = "lowercase")]
 pub enum SudoKind {
```

#### Recent Merged Pull Requests:
- **PR #2473** (2026-11-02): fix(zed): query Zed's release endpoint to avoid GitHub rate limits (@d-enk)
- **PR #2472** (2026-11-02): chore(deps): lock file maintenance (@renovate[bot])
- **PR #2470** (2026-10-30): chore(renovate): switch to weekly schedule (@GideonBear)
- **PR #2469** (closed): chore(deps): update rust crate sysinfo to 0.40.0 (@renovate[bot])
- **PR #2468** (2026-10-28): fix(rubygems): skip --system update when gem is managed by Homebrew or macOS (@thedavidweng)
- **PR #2466** (closed): fix(skills): always pass --yes to npx runner (@thedavidweng)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
