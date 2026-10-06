# Forensic Learning Record (Deep Inspection): topgrade-rs/topgrade

> **Canonical Artifact**: `07_PROJECT_LEARNING/topgrade-rs-topgrade-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/topgrade-rs/topgrade](https://github.com/topgrade-rs/topgrade))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:41:30.843Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `topgrade-rs/topgrade`
- **Description**: Upgrade all the things
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 4624 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils.rs`
```
use crate::output_changed_message;
use std::ffi::OsStr;
use std::fmt::Debug;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, OnceLock};

use color_eyre::eyre::{Context, Result, eyre};
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

/// `which`, but skips executables on Windows drive mounts.
fn which_native_in_wsl<T: AsRef<OsStr> + Debug>(binary_name: T) -> Result<Option<PathBuf>> {
    let mut candidates = match which_crate::which_all(&binary_name) {
        Ok(candidates) => candidates,
        Err(which_crate::Error::CannotFindBinaryPath) => {
            debug!("Cannot find {:?}", &binary_name);
            return Ok(None);
        }
        Err(e) => return Err(eyre!(e).wrap_err(format!("Detecting {:?} failed", binary_name))),
    };

    let mut saw_candidate = false;
    let native = candidates.find(|path| {
        saw_candidate = true;
        !is_windows_mount_path(path)
    });
    match native {
        Some(path) => {
            debug!("Detected {:?} as {:?}", &path, &binary_name);
            Ok(Some(path))
        }
        // Every PATH match was a Windows binary on a drive mount.
        None if saw_candidate => {
            debug!(
                "Cannot find native {:?} in PATH (only Windows binaries via WSL interop)",
                &binary_name
            );
            Ok(None)
        }
        None => {
            debug!("Cannot find {:?}", &binary_name);
            Ok(None)
        }
    }
}

pub fn which<T: AsRef<OsStr> + Debug>(binary_name: T) -> Result<Option<PathBuf>> {
    if wsl_windows_path_filter_enabled() {
        return which_native_in_wsl(&binary_name);
    }

    match which_crate::which(&binary_name) {
        Ok(path) => {
            debug!("Detected {:?} as {:?}", &path, &binary_name);
            Ok(Some(path))
        }
        Err(which_crate::Error::CannotFindBinaryPath) => {
            debug!("Cannot find {:?}", &binary_name);
            Ok(None)
        }
        Err(e) => Err(eyre!(e).wrap_err(format!("Detecting {:?} failed", binary_name))),
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
            debug!("Found required path at {:?}", path);
            return Ok(path.to_path_buf());
        } else {
            failed_paths.push(path_s);
        }
    }

    Err(SkipStep(format!(
        "{}",
        t!(
            "None of {paths} exist",
            paths = failed_paths
                .iter()
                .format_with(", ", |path, f| f(&format_args!("{:?}", path)))
        )
    ))
    .into())
}

#[allow(dead_code)]
pub fn require_option<T>(option: Option<T>, cause: String) -> Result<T> {
    if let Some(value) = option {
        Ok(value)
    } else {
        Err(SkipStep(cause).into())
    }
}

pub fn string_prepend_str(string: &mut String, s: &str) {
    let mut new_string = String::with_capacity(string.len() + s.len());
    new_string.push_str(s);
    new_string.push_str(string);
    *string = new_string;
}

#[cfg(unix)]
pub fn hostname() -> Result<String> {
    match nix::unistd::gethostname() {
        Ok(os_str) => Ok(os_str
            .into_string()
            .map_err(|_| SkipStep(t!("Failed to get a UTF-8 encoded hostname").into()))?),
        Err(e) => Err(e.into()),
    }
}

#[cfg(windows)]
pub fn hostname() -> Result<String> {
    std::env::var("COMPUTERNAME")
        .map_err(|err| SkipStep(t!("Failed to get hostname: {err}", err = err).to_string()).into())
}

#[cfg(unix)]
pub fn is_elevated() -> bool {
    let euid = nix::unistd::Uid::effective();
    debug!("Runni
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

    #[merge(strategy = crate::utils::merge_strategies::ve
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

### Core Architecture Module: `src/executor.rs`
```
//! Utilities for command execution
use std::ffi::{OsStr, OsString};
use std::fmt::Debug;
use std::iter;
use std::path::Path;
use std::process::{Child, Command, ExitStatus, Output, Stdio};

use color_eyre::eyre::Result;
use itertools::Itertools;
use rust_i18n::t;
use tracing::{Level, debug, enabled};

use crate::command::CommandExt;
use crate::error::DryRun;

/// An enum providing a similar interface to `std::process::Command`.
/// If the enum is set to `Wet`, execution will be performed with `std::process::Command`.
/// If the enum is set to `Dry`, execution will just print the command with its arguments.
pub enum Executor {
    Wet(Command),
    Damp(Command),
    Dry(DryCommand),
}

impl Executor {
    /// Convert this executor to always run, even in dry-run mode.
    ///
    /// Use this for read-only commands that detect environment, check versions, or query
    /// configuration. These commands need to run even during dry-run to make correct decisions.
    ///
    /// This converts `Dry` to `Wet` (which executes), while leaving `Wet` and
    /// `Damp` unchanged.
    pub fn always(self) -> Self {
        match self {
            Executor::Dry(c) => Executor::Wet(c.into_command()),
            other => other,
        }
    }

    /// Get the name of the program being run.
    ///
    /// Will give weird results for non-UTF-8 programs; see `to_string_lossy()`.
    pub fn get_program(&self) -> String {
        match self {
            Executor::Wet(c) | Executor::Damp(c) => c.get_program().to_string_lossy().into_owned(),
            Executor::Dry(c) => c.program.to_string_lossy().into_owned(),
        }
    }

    /// See `std::process::Command::arg`
    pub fn arg<S: AsRef<OsStr>>(&mut self, arg: S) -> &mut Executor {
        match self {
            Executor::Wet(c) | Executor::Damp(c) => {
                c.arg(arg);
            }
            Executor::Dry(c) => {
                c.args.push(arg.as_ref().into());
            }
        }

        self
    }

    /// See `std::process::Command::args`
    pub fn args<I, S>(&mut self, args: I) -> &mut Executor
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        match self {
            Executor::Wet(c) | Executor::Damp(c) => {
                c.args(args);
            }
            Executor::Dry(c) => {
                c.args.extend(args.into_iter().map(|arg| arg.as_ref().into()));
            }
        }

        self
    }

    #[allow(dead_code)]
    /// See `std::process::Command::arg`
    pub fn arg_if<S: AsRef<OsStr>>(&mut self, cond: bool, arg: S) -> &mut Executor {
        if cond { self.arg(arg) } else { self }
    }

    #[allow(dead_code)]
    /// See `std::process::Command::args`
    pub fn args_if<I, S>(&mut self, cond: bool, args: I) -> &mut Executor
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        if cond { self.args(args) } else { self }
    }

    #[allow(dead_code)]
    /// See `std::process::Command::arg`
    pub fn arg_if_some<T, F, S>(&mut self, opt: Option<T>, f: F) -> &mut Executor
    where
        F: FnOnce(T) -> S,
        S: AsRef<OsStr>,
    {
        if let Some(val) = opt {
            self.arg(f(val));
        }
        self
    }

    #[allow(dead_code)]
    /// See `std::process::Command::args`
    pub fn args_if_some<T, F, I, S>(&mut self, opt: Option<T>, f: F) -> &mut Executor
    where
        F: FnOnce(T) -> I,
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        if let Some(val) = opt {
            self.args(f(val));
        }
        self
    }

    #[allow(dead_code)]
    /// See `std::process::Command::current_dir`
    pub fn current_dir<P: AsRef<Path>>(&mut self, dir: P) -> &mut Executor {
        match self {
            Executor::Wet(c) | Executor::Damp(c) => {
                c.current_dir(dir);
            }
            Executor::Dry(c) => c.directory = Some(dir.as_ref().into()),
        }

        self
    }

    #[allow(dead_code)]
    /// See `std::process::Command::stdin`
    pub fn stdin<T: Into<Stdio>>(&mut self, cfg: T) -> &mut Executor {
        let stdio = cfg.into();
        match self {
            Executor::Wet(c) | Executor::Damp(c) => {
                c.stdin(stdio);
            }
            Executor::Dry(c) => {
                c.stdin = Some(stdio);
            }
        }

        self
    }

    #[allow(dead_code)]
    /// See `std::process::Command::remove_env`
    pub fn env_remove<K>(&mut self, key: K) -> &mut Executor
    where
        K: AsRef<OsStr>,
    {
        match self {
            Executor::Wet(c) | Executor::Damp(c) => {
                c.env_remove(key);
            }
            Executor::Dry(c) => {
                c.env_removals.push(key.as_ref().to_os_string());
            }
        }

        self
    }

    #[allow(dead_code)]
    /// See `std::process::Command::env`
    pub fn env<K, V>(&mut self, key: K, val: V) -> &mut Executor
    where
        K: AsRef<OsStr>,
        V: AsRef<OsStr>,
    {
        match self {
            Executor::Wet(c) | Executor::Damp(c) => {
                c.env(key, val);
            }
            Executor::Dry(c) => {
                c.envs.push((key.as_ref().to_os_string(), val.as_ref().to_os_string()));
            }
        }

        self
    }

    #[allow(dead_code)]
    /// See `std::process::Command::env`
    pub fn env_if<K, V>(&mut self, cond: bool, key: K, val: V) -> &mut Executor
    where
        K: AsRef<OsStr>,
        V: AsRef<OsStr>,
    {
        if cond { self.env(key, val) } else { self }
    }

    /// See `std::process::Command::spawn`
    pub fn spawn(&mut self) -> Result<ExecutorChild> {
        self.log_command();
        let result = match self {
            Executor::Wet(c) | Executor::Damp(c) => {
                debug!("Running {:?}", c);
                // We should use `spawn()` here rather than `spawn_checked()` since
                // their semantics and behaviors are different.
                #[expect(clippy::disallowed_methods)]
                c.spawn().map(ExecutorChild::Wet)?
            }
            Executor::Dry(_) => ExecutorChild::Dry,
        };

        Ok(result)
    }

    /// See `std::process::Command::output`
    pub fn output(&mut self) -> Result<ExecutorOutput> {
        self.log_command();
        match self {
            Executor::Wet(c) | Executor::Damp(c) => {
                // We should use `output()` here rather than `output_checked()` since
                // their semantics and behaviors are different.
                #[expect(clippy::disallowed_methods)]
                Ok(ExecutorOutput::Wet(c.output()?))
            }
            Executor::Dry(_) => Ok(ExecutorOutput::Dry),
        }
    }

    /// An extension of `status_checked` that allows you to set a sequence of codes
    /// that can indicate success of a script
    #[allow(dead_code)]
    pub fn status_checked_with_codes(&mut self, codes: &[i32]) -> Result<()> {
        self.log_command();
        match self {
            Executor::Wet(c) | Executor::Damp(c) => c.status_checked_with(|status| {
                if status.success() || status.code().as_ref().is_some_and(|c| codes.contains(c)) {
                    Ok(())
                } else {
                    Err(())
                }
            }),
            Executor::Dry(_) => Ok(()),
        }
    }

    fn log_command(&self) {
        match self {
            Executor::Wet(_) => (),
            Executor::Damp(c) => {
                log_command(
                    "Executing: {program_name} {arguments}",
                    c.get_program(),
                    c.get_args(),
                    c.get_envs(),
                    c.get_current_dir(),
                );
            }
            Executor::Dry(c) => log_command(
                "Dry running: {program_name} {arguments}",
                &c.program,
                &c.args,
                iter::empty(),
                c.directory.as_ref(),
            ),
        }
    }
}

pub enum ExecutorOutput {
    Wet(Output),
    Dry,
}

impl ExecutorOutput {
    /// Can be used on output returned by `.always()` executors
    pub fn unwrap_wet(self) -> Output {
        match self {
            Self::Wet(output) => output,
            Self::Dry => panic!("Called `unwrap_wet` on dry output. Improper use of `unwrap_wet`."),
        }
    }
}

/// A struct representing a command. Trying to execute it will just print its arguments.
pub struct DryCommand {
    program: OsString,
    args: Vec<OsString>,
    directory: Option<OsString>,
    envs: Vec<(OsString, OsString)>,
    env_removals: Vec<OsString>,
    stdin: Option<Stdio>,
}

impl DryCommand {
    pub fn new<S: AsRef<OsStr>>(program: S) -> Self {
        Self {
            program: program.as_ref().to_os_string(),
            args: Vec::new(),
            directory: None,
            envs: Vec::new(),
            env_removals: Vec::new(),
            stdin: None,
        }
    }

    /// Convert this dry command into a real Command that will execute.
    #[expect(clippy::disallowed_methods)]
    fn into_command(self) -> Command {
        let mut cmd = Command::new(&self.program);
        cmd.args(&self.args);
        if let Some(dir) = &self.directory {
            cmd.current_dir(dir);
        }
        for (key, val) in &self.envs {
            cmd.env(key, val);
        }
        for key in &self.env_removals {
            cmd.env_remove(key);
        }
        if let Some(stdin) = self.stdin {
            cmd.stdin(stdin);
        }
        cmd
    }
}

/// The Result of spawn. Contains an actual `std::process::Child` if executed by a wet command.
pub enum ExecutorChild {
    // Both RunType::Wet and RunType::Damp use this variant
    Wet(Child),
    Dry,
}

impl CommandExt for Executor {
    type Child = ExecutorChild;

    // TODO: It might be nice to make `output_checked_with` return something that has a
    // variant for wet/dry runs.

    fn output_checked_wit
```

### Core Architecture Module: `src/main.rs`
```
#![allow(clippy::cognitive_complexity)]

use std::env;
use std::env::home_dir;
use std::io;
use std::path::PathBuf;
use std::process::exit;
use std::time::Duration;

use clap::CommandFactory;
use clap::{Parser, crate_version};
use color_eyre::eyre::Context;
use color_eyre::eyre::Result;
use crossterm::event::KeyCode;
#[cfg(windows)]
use etcetera::base_strategy::Windows;
#[cfg(unix)]
use etcetera::base_strategy::Xdg;
use rust_i18n::{i18n, t};
use std::sync::{LazyLock, OnceLock};
use tempfile::{TempDir, tempdir};
use tracing::debug;

use self::config::{CommandLineArgs, Config};
use self::error::StepFailed;
use self::runner::StepResult;
use self::steps::{remote::*, *};
use self::sudo::{Sudo, SudoCreateError, SudoKind};
use self::terminal::*;
use self::utils::{install_color_eyre, install_tracing, is_elevated, set_wsl_use_windows_path, update_tracing};

mod breaking_changes;
mod command;
mod config;
mod ctrlc;
mod error;
mod execution_context;
mod executor;
mod runner;
#[cfg(windows)]
mod self_renamer;
#[cfg(feature = "self-update")]
mod self_update;
mod step;
mod steps;
mod sudo;
mod terminal;
#[cfg(unix)]
mod tmux;
mod utils;

// Users without home directory are possible, but no-one has complained yet
pub(crate) static HOME_DIR: LazyLock<PathBuf> = LazyLock::new(|| home_dir().expect("No home directory"));
#[cfg(unix)]
pub(crate) static XDG_DIRS: LazyLock<Xdg> = LazyLock::new(|| Xdg::new().expect("No home directory"));
#[cfg(windows)]
pub(crate) static WINDOWS_DIRS: LazyLock<Windows> = LazyLock::new(|| Windows::new().expect("No home directory"));

// Init and load the i18n files
i18n!("locales", fallback = "en");

pub(crate) static OLD_CWD: OnceLock<PathBuf> = OnceLock::new();

struct TempCwd {
    #[allow(unused)]
    temp_dir: TempDir,
    old_cwd: PathBuf,
}

impl TempCwd {
    fn new() -> Result<Self> {
        let old_cwd = env::current_dir()?;
        let temp_dir = tempdir()?;
        env::set_current_dir(&temp_dir)?;
        Ok(Self { temp_dir, old_cwd })
    }
}

impl Drop for TempCwd {
    fn drop(&mut self) {
        env::set_current_dir(&self.old_cwd).expect("Restoring cwd failed");
    }
}

fn run() -> Result<()> {
    install_color_eyre()?;
    ctrlc::set_handler();

    let opt = CommandLineArgs::parse();
    // Set up the logger with the filter directives from:
    //     1. CLI option `--log-filter`
    //     2. `debug` if the `--verbose` option is present
    // We do this because we need our logger to work while loading the
    // configuration file.
    //
    // When the configuration file is loaded, update the logger with the full
    // filter directives.
    //
    // For more info, see the comments in `CommandLineArgs::tracing_filter_directives()`
    // and `Config::tracing_filter_directives()`.
    let reload_handle = install_tracing(&opt.tracing_filter_directives())?;

    // Get current system locale and set it as the default locale
    let system_locale = sys_locale::get_locale().unwrap_or("en".to_string());
    rust_i18n::set_locale(&system_locale);
    debug!("Current system locale is {system_locale}");

    if let Some(shell) = opt.gen_completion {
        let cmd = &mut CommandLineArgs::command();
        clap_complete::generate(shell, cmd, clap::crate_name!(), &mut io::stdout());
        return Ok(());
    }

    if opt.gen_manpage {
        let man = clap_mangen::Man::new(CommandLineArgs::command());
        man.render(&mut io::stdout())?;
        return Ok(());
    }

    for (key, value) in opt.env_variables() {
        unsafe { env::set_var(key, value) };
    }

    if opt.edit_config() {
        Config::edit()?;
        return Ok(());
    };

    if opt.show_config_reference() {
        print!("{}", config::EXAMPLE_CONFIG);
        return Ok(());
    }

    let config = Config::load(opt)?;
    // Update the logger with the full filter directives.
    update_tracing(&reload_handle, &config.tracing_filter_directives())?;
    set_title(config.set_title());
    display_time(config.display_time());
    set_desktop_notifications(config.notify_each_step());
    set_wsl_use_windows_path(config.wsl_use_windows_path())?;

    debug!("Version: {}", crate_version!());
    debug!("OS: {}", env!("TARGET"));
    debug!("{:?}", env::args());
    debug!("Binary path: {:?}", env::current_exe());
    debug!("self-update Feature Enabled: {:?}", cfg!(feature = "self-update"));
    debug!("Configuration: {:?}", config);

    if config.run_in_tmux() && env::var("TOPGRADE_INSIDE_TMUX").is_err() {
        #[cfg(unix)]
        {
            tmux::run_in_tmux(config.tmux_config()?)?;
            return Ok(());
        }
    }

    // Some steps (like mise or pi) have different behavior when ran in a project directory.
    //  Since Topgrade only handles global updates, run all commands in a temporary directory.
    let temp_cwd = TempCwd::new()?;
    OLD_CWD.set(temp_cwd.old_cwd.clone()).unwrap();

    let elevated = is_elevated();

    #[cfg(unix)]
    if !config.allow_root() && elevated {
        print_warning(t!(
            "Topgrade should not be run as root, it will run commands with sudo or equivalent where needed."
        ));
        if !prompt_yesno(&t!("Continue?"))? {
            exit(1)
        }
    }

    let sudo = match config.sudo_command() {
        Some(kind) => Sudo::new(kind),
        None if elevated => Sudo::new(SudoKind::Null),
        None => Sudo::detect(),
    };
    debug!("Sudo: {:?}", sudo);

    let (sudo, sudo_err) = match sudo {
        Ok(sudo) => (Some(sudo), None),
        Err(e) => (None, Some(e)),
    };

    #[cfg(target_os = "linux")]
    let distribution = linux::Distribution::detect();

    let run_type = config.run_type();
    let ctx = execution_context::ExecutionContext::new(
        run_type,
        sudo,
        &config,
        #[cfg(target_os = "linux")]
        &distribution,
    );
    let mut runner = runner::Runner::new(&ctx);

    if !breaking_changes::should_skip() {
        breaking_changes::run()?;
    }

    step::Step::SelfUpdate.run(&mut runner, &ctx)?;

    #[cfg(windows)]
    let _self_rename = if config.self_rename() {
        Some(crate::self_renamer::SelfRenamer::create()?)
    } else {
        None
    };

    if let Some(sudo) = ctx.sudo()
        && (config.pre_sudo() || (config.sudo_loop() && sudo.can_refresh()))
    {
        sudo.elevate(&ctx)?;
    }

    // Held until `run()` returns — dropping would stop the background thread.
    let _sudo_loop_guard = spawn_sudo_loop(&ctx, &config)?;

    if let Some(commands) = config.pre_commands() {
        for (name, command) in commands {
            generic::run_custom_command(name, command, &ctx)?;
        }
    }

    for step in config.steps()? {
        match step.run(&mut runner, &ctx) {
            Ok(()) => (),
            Err(error)
                if error
                    .downcast_ref::<io::Error>()
                    .is_some_and(|e| e.kind() == io::ErrorKind::Interrupted) =>
            {
                println!();
                debug!("Interrupted (possibly with 'q' during retry prompt). Printing summary.");
                break;
            }
            Err(error) => return Err(error),
        }
    }

    let mut failed = false;

    let report = runner.report();
    if !report.is_empty() {
        print_separator(t!("Summary"));

        let mut skipped_missing_sudo = false;

        for (key, result) in report {
            if !failed && result.failed() {
                failed = true;
            }
            if let StepResult::SkippedMissingSudo = result {
                skipped_missing_sudo = true;
            }
            print_result(key, result);
        }

        if skipped_missing_sudo {
            print_warning(t!(
                "\nSome steps were skipped as sudo or equivalent could not be found."
            ));
            // Steps can only fail with SkippedMissingSudo if sudo is None,
            // therefore we must have a sudo_err
            match sudo_err.unwrap() {
                SudoCreateError::CannotFindBinary => {
                    #[cfg(unix)]
                    print_warning(t!(
                        "Install one of `sudo`, `doas`, `pkexec`, `run0` or `please` to run these steps."
                    ));

                    // If this Windows version supported Windows Sudo, the error would have been WinSudoDisabled
                    #[cfg(windows)]
                    print_warning(t!("Install gsudo to run these steps."));
                }
                #[cfg(windows)]
                SudoCreateError::WinSudoDisabled => {
                    print_warning(t!(
                        "Install gsudo or enable Windows Sudo to run these steps.\nFor Windows Sudo, the default 'In a new window' mode is not supported as it prevents Topgrade from waiting for commands to finish. Please configure it to use 'Inline' mode instead.\nGo to https://go.microsoft.com/fwlink/?linkid=2257346 to learn more."
                    ));
                }
                #[cfg(windows)]
                SudoCreateError::WinSudoNewWindowMode => {
                    print_warning(t!(
                        "Windows Sudo was found, but it is set to 'In a new window' mode, which prevents Topgrade from waiting for commands to finish. Please configure it to use 'Inline' mode instead.\nGo to https://go.microsoft.com/fwlink/?linkid=2257346 to learn more."
                    ));
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    if config.show_distribution_summary()
        && let Ok(distribution) = &distribution
    {
        distribution.show_summary();
    }

    if let Some(commands) = config.post_commands() {
        for (name, command) in commands {
            let result = generic::run_custom_command(name, command, &ctx);
            if !failed && result.is_err() {
                failed = true;
            }
        }
    }

    if config.keep_at_end() {
        print_info(t!("\n(R)eboot\n(P)oweroff\n(S)hell
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2394** (2026-10-05): **docs: add sponsor button**
  *Symptoms*: 

- **Issue #2392** (2026-10-05): **chore(deps): lock file maintenance**
  *Symptoms*: This PR contains the following updates:  | Update | Change | |---|---| | lockFileMaintenance | All locks refreshed |  🔧 This Pull Request updates lock files to use the latest dependency versions.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - Between 12:00 AM and 03:59 AM, only on Monday (`* 0-3 * * 1`) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  👻 **Immortal**: This PR will be recreated if closed unmerged. Get [config help](https://redirect.github.com/renovatebot/renovate/discussions) if that's undesired.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/topgrade-rs/topgrade). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMjUuMSIsInVwZGF0ZWRJblZlciI6IjQ0LjEyNS4xIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 

- **Issue #2391** (2026-10-02): **fix: restore old working directory when opening a shell**
  *Symptoms*: Closes #2379

- **Issue #2389** (2026-10-01): **Add 0install**
  *Symptoms*: ### Checklist  - [x] I have searched the issue tracker for [existing feature requests](https://github.com/topgrade-rs/topgrade/issues?q=type%3AFeature).  ### I want to suggest a feature  It would be great if Topgrade could support 0install.  https://0install.net/ >A decentralised cross-platform software installation system. Run applications without having to install them first. Control everything from a command-line or graphical interface.  Platforms supported: Linux, Windows, macOS  Example command: ``` # Windows 0install update-all --clean ```  ``` # Linux, macOS 0install list 0install update <name> ```  ### Contribution  - [ ] I am able and willing to implement this feature myself. - [ ] I am willing to test if someone else implements it. [Guide](https://github.com/topgrade-rs/topgrade?tab=contributing-ov-file#testing-a-pull-request)

- **Issue #2388** (2026-10-01): **Add pkgsrc**
  *Symptoms*: ### Checklist  - [x] I have searched the issue tracker for [existing feature requests](https://github.com/topgrade-rs/topgrade/issues?q=type%3AFeature).  ### I want to suggest a feature  It would be great if Topgrade could support pkgsrc. I think topgrade already supports `pkgin` (binary packages).  https://www.pkgsrc.org/ >pkgsrc is a framework for managing third-party software on UNIX-like systems, currently containing over 26,000 packages. It is the default package manager of [NetBSD](https://www.netbsd.org/) and [SmartOS](https://wiki.smartos.org/), and can be used to enable freely available software to be built easily on a large number of other UNIX-like platforms. The binary packages that are produced by pkgsrc can be used without having to compile anything from source. It can be easily used to complement the software on an existing system.  Platforms supported: NetBSD, Linux, Illumos, Solaris, macOS  Example commands:  ``` # PKGSRCDIR is often /usr/pkgsrc cd "$PKGSRCDIR" && cvs update -dP   # or git pull, if the tree is git pkg_rolling-replace -rusv ```  ### Contribution  - [ ] I am able and willing to implement this feature myself. - [ ] I am willing to test if someone else implements it. [Guide](https://github.com/topgrade-rs/topgrade?tab=contributing-ov-file#testing-a-pull-request)

- **Issue #2387** (2026-10-01): **Add cpak**
  *Symptoms*: ### Checklist  - [x] I have searched the issue tracker for [existing feature requests](https://github.com/topgrade-rs/topgrade/issues?q=type%3AFeature).  ### I want to suggest a feature  It would be great if Topgrade could support cpak.  https://github.com/containerpak/cpak >cpak installs applications from OCI images while keeping package metadata in a Git repository. It provides native desktop integration, shared content-addressed layers, atomic updates and a rootless Linux sandbox from one Go binary.  Platforms supported: Linux  Example commands: ``` cpak update --non-interactive cpak self-update ```  ### Contribution  - [ ] I am able and willing to implement this feature myself. - [ ] I am willing to test if someone else implements it. [Guide](https://github.com/topgrade-rs/topgrade?tab=contributing-ov-file#testing-a-pull-request)
  **Post-Mortem & Fix Analysis**:
  > Please re-open using the "New step request" issue template

- **Issue #2386** (2026-10-01): **chore(deps): update rust to v1.99.0**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [rust](https://rust-lang.org/) ([source](https://redirect.github.com/rust-lang/rust), [changelog](https://redirect.github.com/rust-lang/rust/blob/main/RELEASES.md)) | toolchain | minor | `1.98.1` → `1.99.0` | | [rust](https://redirect.github.com/rust-lang/rust) |  | minor | `1.98.1` → `1.99.0` |  ---  ### Release Notes  <details> <summary>rust-lang/rust (rust)</summary>  ### [`v1.99.0`](https://redirect.github.com/rust-lang/rust/blob/HEAD/RELEASES.md#Version-1990-2026-10-01)  [Compare Source](https://redirect.github.com/rust-lang/rust/compare/1.98.1...1.99.0)  \==========================  <a id="1.99.0-Language"></a>  ## Language  - [Add allow-by-default `raw_borrows_via_references` lint that checks for references that decay immediately into raw borrows](https://redirect.github.com/rust-lang/rust/pull/138230) - [Extend `unconditional_panic` lint to function calls that panic when the chunks/windows size is zero](https://redirect.github.com/rust-lang/rust/pull/153563) - [Stabilize C-variadic function definitions](https://redirect.github.com/rust-lang/rust/pull/155697) - [Stabilize the ability to use `#[unsafe(naked)]` functions to define C-variadic functions (`#![feature(c_variadic_naked_functions)]`).](https://redirect.github.com/rust-lang/rust/pull/159746) - [Trait methods are now resolved on an adjusted never type (producing a FCW)](https://redirect.github.com/rust-lang/rust/pul

- **Issue #2384** (2026-09-29): **chore(pre-commit): autoupdate**
  *Symptoms*: <!--pre-commit.ci start--> updates: - [github.com/adhtruong/mirrors-typos: v1.50.2 → v1.50.3](https://github.com/adhtruong/mirrors-typos/compare/v1.50.2...v1.50.3) <!--pre-commit.ci end-->

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

### Incident Patch 1: `8d7666d4` (2026-08-16)
**Commit Message**: fix(locales): correct mistranslations and command names

**File**: `locales/app.yml` (modified, +33/-33)
```diff
@@ -180,7 +180,7 @@ _version: 2
   en: "Error detecting current distribution: %{error}"
   lt: "Klaida nustatant dabartinę distribuciją: %{error}"
   es: "Error al detectar la distribución actual: %{error}"
-  fr: "Erreur lors de la détection de la distribution acutelle: %{error}"
+  fr: "Erreur lors de la détection de la distribution actuelle: %{error}"
   zh_CN: "无法检测当前操作系统：%{error}"
   zh_TW: "無法偵測作業系統：%{error}"
   de: "Fehler bei der Erkennung der aktuellen Distribution: %{error}"
@@ -296,11 +296,11 @@ _version: 2
   de: "Das Paket-Audit war erfolgreich, aber es befinden sich noch anfällige Pakete im System"
 "Syncing Portage":
   en: "Syncing Portage"
-  lt: "Sinchronizuojamas portage"
-  es: "Sincronizando portage"
-  fr: "Synchronisation du portage"
-  zh_CN: "正在同步 portage"
-  zh_TW: "正在同步 portage"
+  lt: "Sinchronizuojamas Portage"
+  es: "Sincronizando Portage"
+  fr: "Synchronisation du Portage"
+  zh_CN: "正在同步 Portage"
+  zh_TW: "正在同步 Portage"
   de: "Synchronisiere Portage"
 "Finding available software":
   en: "Finding available software"
@@ -387,8 +387,8 @@ _version: 2
   lt: "Renkamos Vagrant dėžutės"
   es: "Recolectando cajas Vagrant"
   fr: "Collecte des boîtes Vagrant"
-  zh_CN: "正在收集 Vagrant 容器"
-  zh_TW: "正在收集 Vagrant 容器"
+  zh_CN: "正在收集 Vagrant 盒子"
+  zh_TW: "正在收集 Vagrant 盒子"
   de: "Sammle Vagrant-Boxen"
 "No Vagrant directories were specified in the configuration file":
   en: "No Vagrant directories were specified in the configuration file"
@@ -403,16 +403,16 @@ _version: 2
   lt: "Vagrant dėžutės"
   es: "Cajas Vagrant"
   fr: "Boîtes Vagrant"
-  zh_CN: "Vagrant 容器"
-  zh_TW: "Vagrant 容器"
+  zh_CN: "Vagrant 盒子"
+  zh_TW: "Vagrant 盒子"
   de: "Vagrant-Boxen"
 "No outdated boxes":
   en: "No outdated boxes"
   lt: "Nėra pasenusių dėžučių"
   es: "Sin cajas obsoletas"
   fr: "Aucune boîte obsolète"
-  zh_CN: "没有需要更新的容器"
-  zh_TW: "沒有需要更新的容器"
+  zh_CN: "没有需要更新的盒子"
+  zh_TW: "沒有需要更新的盒子"
   de: "Keine veralteten Boxen"
 "Summary":
   en: "Summary"
@@ -505,7 +505,7 @@ _version: 2
 "{python} is a Python shim, skip.":
   en: "%{python} is a Python shim, skip."
   lt: "%{python} yra Python tarpinė, praleidžiama."
-  es: "%{python} es una corrección de Python, omitiendo."
+  es: "%{python} es un shim de Python, omitiendo."
   fr: "%{python} est un shim Python, ignoré."
   zh_CN: "%{python} 是 Python shim，跳过。"
   zh_TW: "%{python} 是 Python shim，略過。"
@@ -635,8 +635,8 @@ _version: 2
   lt: "Snapd lizdas neegzistuoja"
   es: "El socket Snapd no existe"
   fr: "Le socket Snapd n'existe pas"
-  zh_CN: "找不到 Snapd 程序"
-  zh_TW: "找不到 Snapd 程式"
+  zh_CN: "找不到 Snapd 套接字"
+  zh_TW: "找不到 Snapd 套接字"
   de: "Snapd-Socket existiert nicht"
 "You need to specify at least one container":
   en: "You need to specify at least one container"
@@ -665,10 +665,10 @@ _version: 2
 "Going to execute `waydroid upgrade`, which would STOP the running container, is this ok?":
   en: "Going to execute `waydroid upgrade`, which would STOP the running container, is this ok?"
   lt: "Vykdysime `waydroid upgrade`, kuris sustabdys veikiančią konteinerį, ar tai priimtina?"
-  es: "Se ejecutará `waydroid update`, lo que DETENDRÁ el contenedor en ejecución. ¿Está bien?"
+  es: "Se ejecutará `waydroid upgrade`, lo que DETENDRÁ el contenedor en ejecución. ¿Está bien?"
   fr: "`waydroid upgrade` va s'exécuter, ce qui ARRÊTERA le conteneur en cours d'exécution, est-ce ok ?"
-  zh_CN: "将跳过 `waydroid upgrade`，并且“停止”运行容器。是否继续？"
-  zh_TW: "將略過 `waydroid upgrade`，並且「停止」執行容器。是否繼續？"
+  zh_CN: "将执行 `waydroid upgrade`，并且“停止”运行容器。是否继续？"
+  zh_TW: "將執行 `waydroid upgrade`，並且「停止」執行容器。是否繼續？"
   de: "`waydroid upgrade` wird ausgeführt, was den laufenden Container STOPPEN würde. Ist das in Ordnung?"
 "Skip the Waydroid step because the user doesn't want to proceed":
   en: "Skip the Waydroid step because the user doesn't want to proceed"
@@ -793,17 +793,17 @@ _version: 2
 "`nix upgrade-nix` can only be used on macOS or non-NixOS Linux":
   en: "`nix upgrade-nix` can only be used on macOS or non-NixOS Linux"
   lt: "`nix upgrade-nix` gali būti naudojamas tik macOS arba Linux, kuris nėra NixOS"
-  es: "`nix update-nix` solo puede usarse en macOS o Linux que no sea NixOS"
+  es: "`nix upgrade-nix` solo puede usarse en macOS o Linux que no sea NixOS"
   fr: "`nix upgrade-nix` ne peut être utilisée que sur macOS ou Linux non-NixOS"
   zh_CN: "`nix upgrade-nix` 仅能在 macOS 或非 NixOS 的 Linux 上使用"
   zh_TW: "`nix upgrade-nix` 僅能在 macOS 或非 NixOS 的 Linux 上使用"
   de: "`nix upgrade-nix` kann nur auf macOS oder nicht-NixOS-Linux verwendet werden"
 "`nix upgrade-nix` cannot be run when Nix is installed in a profile":
   en: "`nix upgrade-nix` cannot be run when Nix is installed in a profile"
   lt: "`nix upgrade-nix` negali būti paleistas, kai Nix įdiegtas vartotojo aplinkoje"
-  es: "`nix Upgrade-nix` no puede ejecutarse cuando Nix está instalado en un perfil"
+  es: "`nix upgrade-nix` no puede ejecutarse cuando Nix está instalado en un perfil"
   fr: "`nix upgrade-nix`
```

---

### Incident Patch 2: `44e6fe05` (2026-08-14)
**Commit Message**: fix: align summary names with step separators

**File**: `src/step.rs` (modified, +8/-8)
```diff
@@ -321,7 +321,7 @@ impl Step {
             }
             Codex => runner.execute(*self, "Codex", || generic::run_codex(ctx))?,
             Colima => runner.execute(*self, "Colima", || generic::run_colima(ctx))?,
-            Composer => runner.execute(*self, "composer", || generic::run_composer_update(ctx))?,
+            Composer => runner.execute(*self, "Composer", || generic::run_composer_update(ctx))?,
             Conda => runner.execute(*self, "conda", || generic::run_conda_update(ctx))?,
             ConfigUpdate =>
             {
@@ -381,7 +381,7 @@ impl Step {
                 #[cfg(target_os = "linux")]
                 runner.execute(*self, "Gear Lever", || linux::run_gearlever(ctx))?
             }
-            Gem => runner.execute(*self, "gem", || generic::run_gem(ctx))?,
+            Gem => runner.execute(*self, "Gems", || generic::run_gem(ctx))?,
             Getnf => runner.execute(*self, "getnf", || generic::run_getnf_update(ctx))?,
             Ghcup => runner.execute(*self, "ghcup", || generic::run_ghcup_update(ctx))?,
             GitRepos => runner.execute(*self, "Git Repositories", || git::run_git_pull_or_fetch(ctx))?,
@@ -391,7 +391,7 @@ impl Step {
             GnomeShellExtensions =>
             {
                 #[cfg(all(unix, not(any(target_os = "macos", target_os = "android"))))]
-                runner.execute(*self, "Gnome Shell Extensions", || unix::upgrade_gnome_extensions(ctx))?
+                runner.execute(*self, "GNOME Shell extensions", || unix::upgrade_gnome_extensions(ctx))?
             }
             Go => {
                 runner.execute(*self, "go-global-update", || go::run_go_global_update(ctx))?;
@@ -423,7 +423,7 @@ impl Step {
                 runner.execute(*self, "Install Release", || unix::run_install_release(ctx))?
             }
             JetbrainsAqua => runner.execute(*self, "JetBrains Aqua Plugins", || generic::run_jetbrains_aqua(ctx))?,
-            JetbrainsClion => runner.execute(*self, "JetBrains CL", || generic::run_jetbrains_clion(ctx))?,
+            JetbrainsClion => runner.execute(*self, "JetBrains CLion", || generic::run_jetbrains_clion(ctx))?,
             JetbrainsDatagrip => {
                 runner.execute(*self, "JetBrains DataGrip", || generic::run_jetbrains_datagrip(ctx))?
             }
@@ -543,7 +543,7 @@ impl Step {
             Pixi => runner.execute(*self, "pixi", || generic::run_pixi_update(ctx))?,
             Pkg => {
                 #[cfg(target_os = "dragonfly")]
-                runner.execute(*self, "Dragonfly BSD Packages", || dragonfly::upgrade_packages(ctx))?;
+                runner.execute(*self, "DragonFly BSD Packages", || dragonfly::upgrade_packages(ctx))?;
                 #[cfg(target_os = "freebsd")]
                 runner.execute(*self, "FreeBSD Packages", || freebsd::upgrade_packages(ctx))?;
                 #[cfg(target_os = "openbsd")]
@@ -609,7 +609,7 @@ impl Step {
                 runner.execute(*self, "Restarts", || linux::run_needrestart(ctx))?
             }
             Rtcl => runner.execute(*self, "rtcl", || generic::run_rtcl(ctx))?,
-            RubyGems => runner.execute(*self, "rubygems", || generic::run_rubygems(ctx))?,
+            RubyGems => runner.execute(*self, "RubyGems", || generic::run_rubygems(ctx))?,
             Rustup => runner.execute(*self, "rustup", || generic::run_rustup(ctx))?,
             Rye => runner.execute(*self, "rye", || generic::run_rye(ctx))?,
             Scoop =>
@@ -697,7 +697,7 @@ impl Step {
                     runner.execute(*self, "pihole", || linux::run_pihole_update(ctx))?;
                 }
                 #[cfg(windows)]
-                runner.execute(*self, "Windows update", || windows::windows_update(ctx))?;
+                runner.execute(*self, "Windows Update", || windows::windows_update(ctx))?;
                 #[cfg(target_os = "macos")]
                 runner.execute(*self, "System update", || macos::upgrade_macos(ctx))?;
                 #[cfg(target_os = "freebsd")]
@@ -743,7 +743,7 @@ impl Step {
                 runner.execute(*self, "The Ultimate vimrc", || vim::upgrade_ultimate_vimrc(ctx))?;
                 runner.execute(*self, "voom", || vim::run_voom(ctx))?
             }
-            VitePlus => runner.execute(*self, "viteplus", || node::run_viteplus_upgrade(ctx))?,
+            VitePlus => runner.execute(*self, "Vite+", || node::run_viteplus_upgrade(ctx))?,
             VoltaPackages => runner.execute(*self, "volta packages", || node::run_volta_packages_upgrade(ctx))?,
             Vscode => runner.execute(*self, "Visual Studio Code extensions", || {
                 generic::run_vscode_extensions_update(ctx)
```

---

### Incident Patch 3: `042a08ab` (2026-08-14)
**Commit Message**: fix(flatpak): translate the user packages separator

**File**: `locales/app.yml` (modified, +8/-0)
```diff
@@ -622,6 +622,14 @@ _version: 2
   zh_CN: "Flatpak 系统软件包"
   zh_TW: "Flatpak 系統套件"
   de: "Flatpak Systempakete"
+"Flatpak User Packages":
+  en: "Flatpak User Packages"
+  lt: "Flatpak vartotojo paketai"
+  es: "Paquetes de usuario de Flatpak"
+  fr: "Paquets utilisateur Flatpak"
+  zh_CN: "Flatpak 用户软件包"
+  zh_TW: "Flatpak 使用者套件"
+  de: "Flatpak Benutzerpakete"
 "Snapd socket does not exist":
   en: "Snapd socket does not exist"
   lt: "Snapd lizdas neegzistuoja"
```

**File**: `src/steps/os/linux.rs` (modified, +1/-1)
```diff
@@ -878,7 +878,7 @@ pub fn run_flatpak(ctx: &ExecutionContext) -> Result<()> {
 
     let cleanup = ctx.config().cleanup();
     let yes = ctx.config().yes(Step::Flatpak);
-    print_separator("Flatpak User Packages");
+    print_separator(t!("Flatpak User Packages"));
 
     let mut update_args = vec!["update", "--user"];
     if yes {
```

---

### Incident Patch 4: `fa96bda4` (2026-08-14)
**Commit Message**: chore: fix comment typos

**File**: `src/config.rs` (modified, +1/-1)
```diff
@@ -1803,7 +1803,7 @@ impl Config {
             .unwrap_or(false)
     }
 
-    /// Use rpm-ostree *when rpm-ostree is detected* (default: true)
+    /// Use rpm-ostree *when rpm-ostree is detected* (default: false)
     pub fn rpm_ostree(&self) -> bool {
         self.config_file
             .linux
```

**File**: `src/steps/node.rs` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ impl Yarn {
         // Get the version of Yarn. After Yarn 2.x (berry),
         // "yarn global" has been replaced with "yarn dlx".
         //
-        // As "yarn dlx" don't need to "upgrade", we
+        // As "yarn dlx" doesn't need to "upgrade", we
         // ignore the whole task if Yarn is 2.x or above.
         let version = ctx
             .execute(&self.command)
```

**File**: `src/utils.rs` (modified, +1/-1)
```diff
@@ -376,7 +376,7 @@ pub mod merge_strategies {
 /// # Shim
 /// On Windows, if you install `python` through `winget`, an actual `python`
 /// is installed as well as a `python3` shim. Shim is invocable, but when you
-/// execute it, the Microsoft App Store will be launched instead of a Python
+/// execute it, the Microsoft Store will be launched instead of a Python
 /// shell.
 ///
 /// We do this check through `python -V`, a shim will just give `Python` with
```

---

### Incident Patch 5: `e437ab4c` (2026-08-14)
**Commit Message**: build: drop stale breaking-changes exclude from Cargo.toml

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ license = "GPL-3.0-or-later"
 repository = "https://github.com/topgrade-rs/topgrade"
 rust-version = "1.88.0"
 version = "17.12.3"
-exclude = ["doc/screenshot.gif", "BREAKINGCHANGES_dev.md"]
+exclude = ["doc/screenshot.gif"]
 edition = "2024"
 
 readme = "README.md"
```

---

### Incident Patch 6: `6daec97e` (2026-08-14)
**Commit Message**: docs: fix stale links and casing, drop breaking-changes section

**File**: `CONTRIBUTING.md` (modified, +1/-16)
```diff
@@ -58,7 +58,7 @@ To add a new step to `topgrade`:
    a file under [`src/steps`](https://github.com/topgrade-rs/topgrade/tree/main/src/steps),
    the file names are self-explanatory, for example, steps related to `zsh` are
    placed in [`steps/zsh.rs`](https://github.com/topgrade-rs/topgrade/blob/main/src/steps/zsh.rs), and steps that run on
-   Linux only are placed in [`steps/linux.rs`](https://github.com/topgrade-rs/topgrade/blob/main/src/steps/linux.rs).
+   Linux only are placed in [`steps/os/linux.rs`](https://github.com/topgrade-rs/topgrade/blob/main/src/steps/os/linux.rs).
 
    Then you implement the update function, and put it in the file where it belongs.
 
@@ -150,21 +150,6 @@ cargo install --git https://github.com/OWNER/topgrade --branch BRANCH
 
 This replaces Cargo-installed `topgrade` binary with the contributor's version. You can go back by running `cargo install topgrade`.
 
-### Breaking changes
-
-If your PR introduces a breaking change, document it in [`BREAKINGCHANGES_dev.md`][bc_dev].
-It should be written in Markdown and wrapped at 80, for example:
-
-```md
-1. The configuration location has been updated to x.
-
-2. The step x has been removed.
-
-3. ...
-```
-
-[bc_dev]: https://github.com/topgrade-rs/topgrade/blob/main/BREAKINGCHANGES_dev.md
-
 ### I18n
 
 If your PR introduces user-facing messages, we need to ensure they are translated.
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ To remedy this, **Topgrade** detects which tools you use and runs the appropriat
   [`deb-get install topgrade`](https://github.com/wimpysworld/deb-get/blob/main/01-main/packages/topgrade)
 - Arch Linux (AUR): [topgrade](https://aur.archlinux.org/packages/topgrade)
   or [topgrade-bin](https://aur.archlinux.org/packages/topgrade-bin)
-- [PyPi](https://pypi.org/): `pip`, `pipx`, or `uv tool` [
+- [PyPI](https://pypi.org/): `pip`, `pipx`, or `uv tool` [
   `install topgrade`](https://pypi.org/project/topgrade/)
 - Windows ([Winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/)): [
   `winget install --id=topgrade-rs.topgrade  -e`](https://winstall.app/apps/topgrade-rs.topgrade)
```

**File**: `config.example.toml` (modified, +11/-4)
```diff
@@ -183,13 +183,13 @@
 # greedy_cask = true
 
 # For the BrewCask step
-# If `Repo Cask Upgrade` does not exist, then use the `--greedy_latest` option.
+# If `Repo Cask Upgrade` does not exist, then use the `--greedy-latest` option.
 # NOTE: the above entry `greedy_cask` contains this entry, though you can enable
 # both of them, they won't clash with each other.
 # greedy_latest = true
 
 # For the BrewCask step
-# If `Repo Cask Upgrade` does not exist, then use the `--greedy_auto_updates` option.
+# If `Repo Cask Upgrade` does not exist, then use the `--greedy-auto-updates` option.
 # NOTE: the above entry `greedy_cask` contains this entry, though you can enable
 # both of them, they won't clash with each other.
 # greedy_auto_updates = true
@@ -215,6 +215,9 @@
 # Arguments to pass dnf when updating packages
 # dnf_arguments = "--refresh"
 
+# Arguments to pass apt when updating packages
+# apt_arguments = "-o Dpkg::Progress-Fancy=1"
+
 # aura_aur_arguments = "-kx"
 
 # aura_pacman_arguments = ""
@@ -438,7 +441,7 @@
 # use_sudo = false
 
 [lensfun]
-# If disabled, Topgrade invokes `lensfun‑update‑data` without root privilege,
+# If disabled, Topgrade invokes `lensfun-update-data` without root privilege,
 # then the update will be only available to you. Otherwise, `sudo` is required,
 # and the update will be installed system-wide, i.e., available to all users.
 # (default: false)
@@ -509,7 +512,11 @@
 # (default: false)
 # quiet = true
 
-# Other options like `--locked` or `--jobs` can be passed to `cargo install`
+# If this is set to true, `cargo install-update` passes `--locked` to `cargo install`.
+# (default: false)
+# locked = true
+
+# Other options like `--jobs` can be passed to `cargo install`
 # using the `CARGO_INSTALL_OPTS` environment variable.
 
 [rustup]
```

---

### Incident Patch 7: `66163c72` (2026-08-14)
**Commit Message**: fix(locales): fix stray zh_CH key on PATH lookup message

**File**: `locales/app.yml` (modified, +1/-1)
```diff
@@ -467,7 +467,7 @@ _version: 2
   lt: "Nepavyksta rasti jokių %{binary_names} PATH sąraše"
   es: "No se puede encontrar ninguno de %{binary_names} en PATH"
   fr: "Impossible de trouver l'un des %{binary_names} dans le PATH"
-  zh_CH: "在 PATH 中找不到 %{binary_names}"
+  zh_CN: "在 PATH 中找不到 %{binary_names}"
   zh_TW: "在 PATH 中找不到 %{binary_names}"
   de: "Kann keines von %{binary_names} im PATH finden"
 "None of {paths} exist":
```

---

### Incident Patch 8: `0654b6d1` (2026-08-14)
**Commit Message**: fix(containers): close unclosed backtick in error messages

**File**: `src/steps/containers.rs` (modified, +2/-2)
```diff
@@ -120,7 +120,7 @@ fn list_containers(ctx: &ExecutionContext, crt: &Path) -> Result<Vec<Container>>
         let split_res = line.split(' ').collect::<Vec<&str>>();
         if split_res.len() != 2 {
             bail!(format!(
-                "Got erroneous output from `{} image ls --format \"{{.Repository}}:{{.Tag}} {{.ID}}\"; Expected line to split into 2 parts",
+                "Got erroneous output from `{} image ls --format \"{{.Repository}}:{{.Tag}} {{.ID}}\"`; Expected line to split into 2 parts",
                 crt.display()
             ));
         }
@@ -154,7 +154,7 @@ fn list_containers(ctx: &ExecutionContext, crt: &Path) -> Result<Vec<Container>>
         platform.truncate(platform.len() - 1);
         if !platform.contains('/') {
             bail!(format!(
-                "Got erroneous output from `{} image ls --format \"{{.Repository}}:{{.Tag}} {{.ID}}\"; Expected platform to contain '/'",
+                "Got erroneous output from `{} image ls --format \"{{.Repository}}:{{.Tag}} {{.ID}}\"`; Expected platform to contain '/'",
                 crt.display()
             ));
         }
```

---

### Incident Patch 9: `28e6e6a4` (2026-08-14)
**Commit Message**: fix(steps): fix grammar and casing in step messages

**File**: `locales/app.yml` (modified, +16/-16)
```diff
@@ -294,8 +294,8 @@ _version: 2
   zh_CN: "软件包审计已通过，但系统中仍存在含漏洞的软件包"
   zh_TW: "雖然套件審查成功，但系統仍然殘留危險套件"
   de: "Das Paket-Audit war erfolgreich, aber es befinden sich noch anfällige Pakete im System"
-"Syncing portage":
-  en: "Syncing portage"
+"Syncing Portage":
+  en: "Syncing Portage"
   lt: "Sinchronizuojamas portage"
   es: "Sincronizando portage"
   fr: "Synchronisation du portage"
@@ -662,8 +662,8 @@ _version: 2
   zh_CN: "将跳过 `waydroid upgrade`，并且“停止”运行容器。是否继续？"
   zh_TW: "將略過 `waydroid upgrade`，並且「停止」執行容器。是否繼續？"
   de: "`waydroid upgrade` wird ausgeführt, was den laufenden Container STOPPEN würde. Ist das in Ordnung?"
-"Skip the Waydroid step because the user don't want to proceed":
-  en: "Skip the Waydroid step because the user don't want to proceed"
+"Skip the Waydroid step because the user doesn't want to proceed":
+  en: "Skip the Waydroid step because the user doesn't want to proceed"
   lt: "Praleisti Waydroid žingsnį, nes vartotojas nenori tęsti"
   es: "Omitiendo el paso de Waydroid debido a que el usuario no quiere continuar"
   fr: "Passer l'étape Waydroid car l'utilisateur ne souhaite pas l'exécuter"
@@ -734,16 +734,16 @@ _version: 2
   zh_CN: "桌面环境不是 GNOME"
   zh_TW: "桌面環境不是 GNOME"
   de: "Desktop scheint nicht GNOME zu sein"
-"Command `apm` does not appear to be Atom Package Manager":
-  en: "Command `apm` does not appear to be Atom Package Manager"
+"Command `apm` does not appear to be the Atom Package Manager":
+  en: "Command `apm` does not appear to be the Atom Package Manager"
   lt: "Panašu, kad komanda `apm` nėra „Atom Package Manager“"
   es: "El comando `apm` no parece ser Atom Package Manager"
   fr: "La commande `apm` ne semble pas être Atom Package Manager"
   zh_CN: "`apm` 命令似乎不是 Atom Package Manager"
   zh_TW: "`apm` 命令似乎不是 Atom Package Manager"
   de: "Der Befehl `apm` scheint nicht der Atom Package Manager zu sein"
-"GNOME shell extensions are unregistered in DBus":
-  en: "GNOME shell extensions are unregistered in DBus"
+"GNOME Shell extensions are unregistered in DBus":
+  en: "GNOME Shell extensions are unregistered in DBus"
   lt: "GNOME Shell priedai nėra užregistruoti DBus'e"
   es: "Las extensiones de GNOME Shell no están registradas en DBus"
   fr: "Les extensions de GNOME Shell ne sont pas enregistrées dans DBus"
@@ -918,8 +918,8 @@ _version: 2
   zh_CN: "找不到 Emacs 目录"
   zh_TW: "找不到 Emacs 資料夾"
   de: "Emacs-Verzeichnis existiert nicht"
-"Error getting the composer directory: {error}":
-  en: "Error getting the composer directory: %{error}"
+"Error getting the Composer directory: {error}":
+  en: "Error getting the Composer directory: %{error}"
   lt: "Klaida gaunant Composer katalogą: %{error}"
   es: "Error al obtener el directorio de composer: %{error}"
   fr: "Erreur lors de la récupération du répertoire de Composer : %{error}"
@@ -990,8 +990,8 @@ _version: 2
   zh_CN: "Julia 软件包"
   zh_TW: "Julia 套件"
   de: "Julia-Pakete"
-"Update ClamAV Database(FreshClam)":
-  en: "Update ClamAV Database(FreshClam)"
+"Update ClamAV Database (FreshClam)":
+  en: "Update ClamAV Database (FreshClam)"
   lt: "Atnaujinti ClamAV duomenų bazę (FreshClam)"
   es: "Actualizando base de datos ClamAV (FreshClam)"
   fr: "Mise à jour de la base de données ClamAV (FreshClam)"
@@ -1086,8 +1086,8 @@ _version: 2
   zh_CN: "The Ultimate vimrc"
   zh_TW: "終極 vimrc（The Ultimate vimrc）"
   de: "Das ultimative vimrc"
-"vim binary might be actually nvim":
-  en: "vim binary might be actually nvim"
+"vim binary might actually be nvim":
+  en: "vim binary might actually be nvim"
   lt: "vim vykdomasis failas gali būti iš tikrųjų nvim"
   es: "el binario vim puede ser nvim"
   fr: "Le binaire vim pourrait être en réalité nvim"
@@ -1522,8 +1522,8 @@ _version: 2
   zh_CN: "Flatpak %{name} 未安装"
   zh_TW: "Flatpak %{name} 未安装"
   de: "Flatpak %{name} ist nicht installiert"
-"OpenCode not installed with the official script":
-  en: "OpenCode not installed with the official script"
+"OpenCode is not installed with the official script":
+  en: "OpenCode is not installed with the official script"
   lt: "OpenCode neįdiegtas oficialiu skriptu"
   es: "OpenCode no está instalado con el script oficial"
   fr: "OpenCode n'est pas installé avec le script officiel"
```

**File**: `src/steps/generic.rs` (modified, +14/-11)
```diff
@@ -66,7 +66,7 @@ pub fn run_cargo_update(ctx: &ExecutionContext) -> Result<()> {
     let toml_file = cargo_dir.join(".crates.toml").require()?;
 
     if fs::metadata(&toml_file)?.len() == 0 {
-        return Err(SkipStep(format!("{} exists but empty", toml_file.display())).into());
+        return Err(SkipStep(format!("{} exists but is empty", toml_file.display())).into());
     }
 
     print_separator("Cargo");
@@ -252,7 +252,7 @@ impl Apm {
         match self {
             Self::AtomPackageManager(apm) => Ok(apm),
             Self::Other => {
-                Err(SkipStep(t!("Command `apm` does not appear to be Atom Package Manager").to_string()).into())
+                Err(SkipStep(t!("Command `apm` does not appear to be the Atom Package Manager").to_string()).into())
             }
         }
     }
@@ -807,7 +807,10 @@ fn run_vscode_compatible(variant: VSCodeVariant, ctx: &ExecutionContext) -> Resu
     debug!("Detected {name} version as: {version}");
 
     if version < Version::new(1, 86, 0) {
-        return Err(SkipStep(format!("Too old {name} version to have update extensions command")).into());
+        return Err(SkipStep(format!(
+            "The {name} version is too old to have the update extensions command"
+        ))
+        .into());
     }
 
     print_separator(variant.display_name());
@@ -1204,7 +1207,7 @@ pub fn run_pip3_update(ctx: &ExecutionContext) -> Result<()> {
         (Ok(py), _) => py,
         (Err(_), Ok(py3)) => py3,
         (Err(py_err), Err(py3_err)) => {
-            return Err(SkipStep(format!("Skip due to following reasons: {py_err} {py3_err}")).into());
+            return Err(SkipStep(format!("Skip due to the following reasons: {py_err} {py3_err}")).into());
         }
     };
 
@@ -1327,12 +1330,12 @@ pub fn run_pip_review_local_update(ctx: &ExecutionContext) -> Result<()> {
 pub fn run_pipupgrade_update(ctx: &ExecutionContext) -> Result<()> {
     let pipupgrade = require("pipupgrade")?;
 
-    print_separator("Pipupgrade");
+    print_separator("pipupgrade");
     if !ctx.config().enable_pipupgrade() {
         print_warning(
-            "Pipupgrade is disabled by default. Enable it by setting enable_pipupgrade=true in the configuration.",
+            "pipupgrade is disabled by default. Enable it by setting enable_pipupgrade=true in the configuration.",
         );
-        return Err(SkipStep(String::from("Pipupgrade is disabled by default")).into());
+        return Err(SkipStep(String::from("pipupgrade is disabled by default")).into());
     }
     ctx.execute(pipupgrade)
         .args(ctx.config().pipupgrade_arguments().split_whitespace())
@@ -1477,7 +1480,7 @@ pub fn run_composer_update(ctx: &ExecutionContext) -> Result<()> {
         .always()
         .args(["global", "config", "--absolute", "--quiet", "home"])
         .output_checked_utf8()
-        .map_err(|e| SkipStep(t!("Error getting the composer directory: {error}", error = e).to_string()))
+        .map_err(|e| SkipStep(t!("Error getting the Composer directory: {error}", error = e).to_string()))
         .map(|s| PathBuf::from(s.stdout.trim()))?
         .require()?;
 
@@ -1767,7 +1770,7 @@ pub fn run_raco_update(ctx: &ExecutionContext) -> Result<()> {
 pub fn bin_update(ctx: &ExecutionContext) -> Result<()> {
     let bin = require("bin")?;
 
-    print_separator("Bin");
+    print_separator("bin");
     ctx.execute(bin).arg("update").status_checked()
 }
 
@@ -1879,7 +1882,7 @@ pub fn run_freshclam(ctx: &ExecutionContext) -> Result<()> {
         }
     }
 
-    print_separator(t!("Update ClamAV Database(FreshClam)"));
+    print_separator(t!("Update ClamAV Database (FreshClam)"));
 
     let output = ctx.execute(&freshclam).output()?;
     let output = match output {
@@ -2702,7 +2705,7 @@ pub fn run_opencode(ctx: &ExecutionContext) -> Result<()> {
         .canonicalize()
         .is_ok_and(|p| p.is_descendant_of(&script_install_path))
     {
-        return Err(SkipStep(t!("OpenCode not installed with the official script").to_string()).into());
+        return Err(SkipStep(t!("OpenCode is not installed with the official script").to_string()).into());
     }
     print_separator("OpenCode");
     ctx.execute(opencode).arg("upgrade").status_checked()
```

**File**: `src/steps/node.rs` (modified, +3/-3)
```diff
@@ -317,7 +317,7 @@ fn should_use_sudo(npm: &Npm, ctx: &ExecutionContext) -> Result<bool> {
         if ctx.config().npm_use_sudo() {
             Ok(true)
         } else {
-            Err(SkipStep(format!("{} root is owned by another user which is not the current user. Set use_sudo = true under the [npm] section in your configuration to run {} as sudo", npm.variant, npm.variant))
+            Err(SkipStep(format!("{} root is owned by another user who is not the current user. Set use_sudo = true under the [npm] section in your configuration to run {} as sudo", npm.variant, npm.variant))
                 .into())
         }
     } else {
@@ -331,7 +331,7 @@ fn should_use_sudo_viteplus(viteplus: &VitePlus, ctx: &ExecutionContext) -> Resu
         if ctx.config().viteplus_use_sudo() {
             Ok(true)
         } else {
-            Err(SkipStep("Vite+ root is owned by another user which is not the current user. Set use_sudo = true under the [viteplus] section in your configuration to run Vite+ as sudo".to_string())
+            Err(SkipStep("Vite+ root is owned by another user who is not the current user. Set use_sudo = true under the [viteplus] section in your configuration to run Vite+ as sudo".to_string())
                 .into())
         }
     } else {
@@ -345,7 +345,7 @@ fn should_use_sudo_yarn(yarn: &Yarn, ctx: &ExecutionContext) -> Result<bool> {
         if ctx.config().yarn_use_sudo() {
             Ok(true)
         } else {
-            Err(SkipStep("Yarn root is owned by another user which is not the current user. Set use_sudo = true under the [yarn] section in your configuration to run Yarn as sudo".to_string())
+            Err(SkipStep("Yarn root is owned by another user who is not the current user. Set use_sudo = true under the [yarn] section in your configuration to run Yarn as sudo".to_string())
                 .into())
         }
     } else {
```

**File**: `src/steps/os/linux.rs` (modified, +2/-2)
```diff
@@ -426,7 +426,7 @@ fn upgrade_gentoo(ctx: &ExecutionContext) -> Result<()> {
         sudo.execute(ctx, &layman)?.args(["-s", "ALL"]).status_checked()?;
     }
 
-    println!("{}", t!("Syncing portage"));
+    println!("{}", t!("Syncing Portage"));
     if let Some(ego) = which("ego")? {
         // The Funtoo team doesn't recommend running both ego sync and emerge --sync
         sudo.execute(ctx, &ego)?.arg("sync").status_checked()?;
@@ -1085,7 +1085,7 @@ pub fn run_waydroid(ctx: &ExecutionContext) -> Result<()> {
         ))?;
         if !update_allowed {
             return Err(
-                SkipStep(t!("Skip the Waydroid step because the user don't want to proceed").to_string()).into(),
+                SkipStep(t!("Skip the Waydroid step because the user doesn't want to proceed").to_string()).into(),
             );
         }
     }
```

**File**: `src/steps/os/unix.rs` (modified, +1/-1)
```diff
@@ -356,7 +356,7 @@ pub fn upgrade_gnome_extensions(ctx: &ExecutionContext) -> Result<()> {
 
     debug!("Checking for GNOME extensions: {}", output);
     if !output.stdout.contains("org.gnome.Shell.Extensions") {
-        return Err(SkipStep(t!("GNOME shell extensions are unregistered in DBus").to_string()).into());
+        return Err(SkipStep(t!("GNOME Shell extensions are unregistered in DBus").to_string()).into());
     }
 
     print_separator(t!("GNOME Shell extensions"));
```

**File**: `src/steps/vim.rs` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ pub fn upgrade_vim(ctx: &ExecutionContext) -> Result<()> {
 
     let output = ctx.execute(&vim).always().arg("--version").output_checked_utf8()?;
     if !output.stdout.starts_with("VIM") {
-        return Err(SkipStep(t!("vim binary might be actually nvim").to_string()).into());
+        return Err(SkipStep(t!("vim binary might actually be nvim").to_string()).into());
     }
 
     let vimrc = vimrc()?;
```

---

### Incident Patch 10: `c82ead8e` (2026-10-02)
**Commit Message**: fix: restore old working directory when opening a shell (#2391)

**File**: `src/main.rs` (modified, +5/-2)
```diff
@@ -17,7 +17,7 @@ use etcetera::base_strategy::Windows;
 #[cfg(unix)]
 use etcetera::base_strategy::Xdg;
 use rust_i18n::{i18n, t};
-use std::sync::LazyLock;
+use std::sync::{LazyLock, OnceLock};
 use tempfile::{TempDir, tempdir};
 use tracing::debug;
 
@@ -59,6 +59,8 @@ pub(crate) static WINDOWS_DIRS: LazyLock<Windows> = LazyLock::new(|| Windows::ne
 // Init and load the i18n files
 i18n!("locales", fallback = "en");
 
+pub(crate) static OLD_CWD: OnceLock<PathBuf> = OnceLock::new();
+
 struct TempCwd {
     #[allow(unused)]
     temp_dir: TempDir,
@@ -154,7 +156,8 @@ fn run() -> Result<()> {
 
     // Some steps (like mise or pi) have different behavior when ran in a project directory.
     //  Since Topgrade only handles global updates, run all commands in a temporary directory.
-    let _temp_cwd = TempCwd::new()?;
+    let temp_cwd = TempCwd::new()?;
+    OLD_CWD.set(temp_cwd.old_cwd.clone()).unwrap();
 
     let elevated = is_elevated();
 
```

**File**: `src/terminal.rs` (modified, +5/-1)
```diff
@@ -17,6 +17,7 @@ use tracing::{debug, error};
 #[cfg(windows)]
 use which_crate::which;
 
+use crate::OLD_CWD;
 use crate::command::CommandExt;
 use crate::runner::StepResult;
 
@@ -34,7 +35,10 @@ pub fn shell() -> &'static str {
 
 #[expect(clippy::disallowed_methods)]
 pub fn run_shell() -> eyre::Result<()> {
-    Command::new(shell()).env("IN_TOPGRADE", "1").status_checked()
+    Command::new(shell())
+        .env("IN_TOPGRADE", "1")
+        .current_dir(OLD_CWD.get().expect("OLD_CWD should be set at this point"))
+        .status_checked()
 }
 
 struct Terminal {
```

---

### Incident Patch 11: `0846e3cc` (2026-09-28)
**Commit Message**: fix(mise): skip self-update when disabled by the package manager (#2374)

**File**: `src/command.rs` (modified, +0/-3)
```diff
@@ -115,9 +115,6 @@ pub trait CommandExt {
     ///
     /// Returns an `Err` if the command failed to execute, if `succeeded` returns an `Err`, or if
     /// the output contains invalid UTF-8.
-    // This function is currently unused, but is useful and makes sense with `output_checked_with`
-    //  and `output_checked_utf8` existing.
-    #[allow(dead_code)]
     #[track_caller]
     fn output_checked_with_utf8(
         &mut self,
```

**File**: `src/steps/generic.rs` (modified, +33/-9)
```diff
@@ -2827,6 +2827,38 @@ pub fn run_ollama_pull(ctx: &ExecutionContext) -> Result<()> {
     pull_result
 }
 
+#[derive(Deserialize)]
+struct MiseDoctor {
+    // Added in mise 2025.7.2
+    self_update_available: Option<bool>,
+}
+
+/// Packagers can disable `mise self-update` without removing the subcommand (e.g. the APT package
+/// ships a `mise-self-update-instructions.toml`), in which case it still shows up in `mise --help`
+/// but fails when run. `mise doctor` reports whether self-update is actually available.
+fn mise_supports_self_update(ctx: &ExecutionContext, mise: &Path) -> Result<bool> {
+    // `mise doctor` exits with 1 when it finds problems, so don't check the exit code.
+    let output = ctx
+        .execute(mise)
+        .always()
+        .args(["doctor", "--json"])
+        .output_checked_with_utf8(|_| Ok(()))?;
+    let doctor: MiseDoctor = serde_json::from_str(&output.stdout)
+        .wrap_err_with(|| output_changed_message!("mise doctor --json", "json output invalid"))?;
+    if let Some(available) = doctor.self_update_available {
+        return Ok(available);
+    }
+
+    // Older versions don't report it, but omit the subcommand when built without self-update.
+    Ok(ctx
+        .execute(mise)
+        .always()
+        .arg("--help")
+        .output_checked_utf8()?
+        .stdout
+        .contains("self-update"))
+}
+
 pub fn run_mise(ctx: &ExecutionContext) -> Result<()> {
     let mise = require("mise")?;
 
@@ -2839,15 +2871,7 @@ pub fn run_mise(ctx: &ExecutionContext) -> Result<()> {
     } else {
         // This used to run self-update and check for exit code 1 and the string 'cannot update' in stderr.
         //  However, this caused issues with mise's y/n prompt (https://github.com/topgrade-rs/topgrade/issues/2307).
-        let supports_self_update = ctx
-            .execute(&mise)
-            .always()
-            .arg("--help")
-            .output_checked_utf8()?
-            .stdout
-            .contains("self-update");
-
-        if supports_self_update {
+        if mise_supports_self_update(ctx, &mise)? {
             ctx.execute(&mise)
                 .args(["self-update"])
                 .arg_if(ctx.config().yes(Step::Mise), "--yes")
```

---

### Incident Patch 12: `81e069aa` (2026-09-26)
**Commit Message**: fix(hyprpm): run hyprpm at the end to avoid dropping cached sudo credentials for other steps

**File**: `src/step.rs` (modified, +2/-1)
```diff
@@ -878,7 +878,6 @@ pub(crate) fn default_steps() -> Vec<Step> {
         Rcm,
         Maza,
         Adless,
-        Hyprpm,
         Atuin,
         Atom,
         Fossil,
@@ -1004,6 +1003,8 @@ pub(crate) fn default_steps() -> Vec<Step> {
         // Runs `sudo -k` at startup, which drops cached sudo credentials for every later step
         BrewFormula,
         BrewCask,
+        // Runs `sudo -k` at the end, which drops cached sudo credentials for every later step
+        Hyprpm,
         // Last out of convention
         CustomCommands,
         // Last because it prompts for restart
```

---

### Incident Patch 13: `4757e7d7` (2026-09-26)
**Commit Message**: fix(brew): run brew at the end to avoid dropping cached sudo credentials for other steps

**File**: `src/step.rs` (modified, +3/-2)
```diff
@@ -827,8 +827,6 @@ pub(crate) fn default_steps() -> Vec<Step> {
         Winget,
         System,
         MicrosoftStore,
-        BrewFormula,
-        BrewCask,
         Zerobrew,
         Macports,
         Xcodes,
@@ -1003,6 +1001,9 @@ pub(crate) fn default_steps() -> Vec<Step> {
         AntigravityCli,
         Zed,
         // Steps that should run last
+        // Runs `sudo -k` at startup, which drops cached sudo credentials for every later step
+        BrewFormula,
+        BrewCask,
         // Last out of convention
         CustomCommands,
         // Last because it prompts for restart
```

---

### Incident Patch 14: `14c3f001` (2026-09-24)
**Commit Message**: fix(zed): support preview channel (#2372)

Co-authored-by: Gideon <[REDACTED_EMAIL]>

**File**: `locales/app.yml` (modified, +16/-0)
```diff
@@ -1554,3 +1554,19 @@ _version: 2
   zh_CN: "已删除已废弃的扩展目录：%{path}"
   zh_TW: "已刪除已淘汰的擴充功能目錄：%{path}"
   de: "Veraltetes Erweiterungsverzeichnis entfernt: %{path}"
+"Updates unsupported for the Zed {channel} channel":
+  en: "Updates unsupported for the Zed %{channel} channel"
+  lt: "Zed %{channel} kanalo atnaujinimai nepalaikomi"
+  es: "No se admiten actualizaciones para el canal %{channel} de Zed"
+  fr: "Les mises à jour ne sont pas prises en charge pour le canal %{channel} de Zed"
+  zh_CN: "不支持更新 Zed %{channel} 渠道"
+  zh_TW: "不支援更新 Zed %{channel} 通道"
+  de: "Updates für den Zed-Kanal %{channel} werden nicht unterstützt"
+"No Zed preview release found on GitHub":
+  en: "No Zed preview release found on GitHub"
+  lt: "GitHub'e nerasta Zed preview leidimo"
+  es: "No se encontró ninguna versión preview de Zed en GitHub"
+  fr: "Aucune version preview de Zed trouvée sur GitHub"
+  zh_CN: "在 GitHub 上找不到 Zed preview 版本"
+  zh_TW: "在 GitHub 上找不到 Zed preview 版本"
+  de: "Keine Zed-Preview-Version auf GitHub gefunden"
```

**File**: `src/steps/os/linux.rs` (modified, +46/-22)
```diff
@@ -1209,47 +1209,71 @@ pub fn run_zed(ctx: &ExecutionContext) -> Result<()> {
 
     print_separator("Zed");
 
-    let version = Version::parse(
-        ctx.execute(zed)
-            .always()
-            .arg("--version")
-            .output_checked_utf8()?
-            .stdout
-            .split(' ')
-            .nth(1)
-            .ok_or_else(|| {
-                eyre!(output_changed_message!(
-                    "zed --version",
-                    "Should be in 'Zed x.y.z <...>' format"
-                ))
-            })?,
-    )
-    .wrap_err_with(|| output_changed_message!("zed --version", "Should be a valid version"))?;
+    let output = ctx.execute(zed).always().arg("--version").output_checked_utf8()?.stdout;
+    let mut words = output.split_whitespace();
+    // Stable prints `Zed x.y.z <...>`, other channels print `Zed <channel> x.y.z <...>`
+    let (channel, version) = match (words.next(), words.next(), words.next()) {
+        (Some("Zed"), Some(channel @ ("preview" | "nightly" | "dev")), Some(version)) => (channel, version),
+        (Some("Zed"), Some(version), _) => ("stable", version),
+        _ => {
+            return Err(eyre!(output_changed_message!(
+                "zed --version",
+                "Should be in 'Zed [channel] x.y.z <...>' format"
+            )));
+        }
+    };
+    let version = Version::parse(version)
+        .wrap_err_with(|| output_changed_message!("zed --version", "Should be a valid version"))?;
+
+    if channel != "stable" && channel != "preview" {
+        return Err(
+            SkipStep(t!("Updates unsupported for the Zed {channel} channel", channel = channel).to_string()).into(),
+        );
+    }
 
     let client = reqwest::blocking::Client::builder().user_agent("Topgrade").build()?;
 
     #[derive(Deserialize)]
     struct Response {
         tag_name: String,
+        prerelease: bool,
     }
 
-    let latest = Version::parse(
+    let release = if channel == "stable" {
         client
             .get("https://api.github.com/repos/zed-industries/zed/releases/latest")
             .send()
             .wrap_err("Failed to get latest version")?
             .json::<Response>()?
-            .tag_name
-            .strip_prefix('v')
-            .ok_or_eyre("Tag on GitHub doesn't start with 'v'")?,
-    )?;
+    } else {
+        // Preview releases are GitHub prereleases tagged `vx.y.z-pre`; the list is sorted newest first
+        client
+            .get("https://api.github.com/repos/zed-industries/zed/releases")
+            .send()
+            .wrap_err("Failed to fetch releases")?
+            .json::<Vec<Response>>()?
+            .into_iter()
+            .find(|release| release.prerelease && release.tag_name.ends_with("-pre"))
+            .ok_or_else(|| eyre!(t!("No Zed preview release found on GitHub")))?
+    };
+
+    let tag = release
+        .tag_name
+        .strip_prefix('v')
+        .ok_or_eyre("Tag on GitHub doesn't start with 'v'")?;
+    // The installed preview reports `x.y.z` without the `-pre` suffix
+    let latest = Version::parse(tag.strip_suffix("-pre").unwrap_or(tag))?;
 
     if version < latest {
         let mut response = client
             .get("https://zed.dev/install.sh")
             .send()
             .wrap_err("Failed to download install script")?;
-        let child = ctx.execute("sh").stdin(Stdio::piped()).spawn()?;
+        let child = ctx
+            .execute("sh")
+            .env("ZED_CHANNEL", channel)
+            .stdin(Stdio::piped())
+            .spawn()?;
         let mut child = match child {
             ExecutorChild::Wet(child) => child,
             ExecutorChild::Dry => return Ok(()),
```

---

### Incident Patch 15: `3daf37ee` (2026-09-21)
**Commit Message**: fix: don't set cwd when respawning in tmux to fix crash (#2367)

**File**: `src/main.rs` (modified, +4/-4)
```diff
@@ -144,10 +144,6 @@ fn run() -> Result<()> {
     debug!("self-update Feature Enabled: {:?}", cfg!(feature = "self-update"));
     debug!("Configuration: {:?}", config);
 
-    // Some steps (like mise or pi) have different behavior when ran in a project directory.
-    //  Since Topgrade only handles global updates, run all commands in a temporary directory.
-    let _temp_cwd = TempCwd::new()?;
-
     if config.run_in_tmux() && env::var("TOPGRADE_INSIDE_TMUX").is_err() {
         #[cfg(unix)]
         {
@@ -156,6 +152,10 @@ fn run() -> Result<()> {
         }
     }
 
+    // Some steps (like mise or pi) have different behavior when ran in a project directory.
+    //  Since Topgrade only handles global updates, run all commands in a temporary directory.
+    let _temp_cwd = TempCwd::new()?;
+
     let elevated = is_elevated();
 
     #[cfg(unix)]
```

#### Recent Merged Pull Requests:
- **PR #2394** (2026-10-05): docs: add sponsor button (@GideonBear)
- **PR #2392** (2026-10-05): chore(deps): lock file maintenance (@renovate[bot])
- **PR #2391** (2026-10-02): fix: restore old working directory when opening a shell (@GideonBear)
- **PR #2386** (2026-10-01): chore(deps): update rust to v1.99.0 (@renovate[bot])
- **PR #2384** (2026-09-29): chore(pre-commit): autoupdate (@pre-commit-ci[bot])
- **PR #2383** (2026-10-02): chore: release v17.12.3 (@github-actions[bot])
- **PR #2381** (2026-09-28): chore(deps): lock file maintenance (@renovate[bot])
- **PR #2378** (2026-09-28): chore(deps): update vmactions/openbsd-vm action to v1.4.8 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
