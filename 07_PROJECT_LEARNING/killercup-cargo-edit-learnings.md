# Forensic Learning Record (Deep Inspection): killercup/cargo-edit

> **Canonical Artifact**: `07_PROJECT_LEARNING/killercup-cargo-edit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/killercup/cargo-edit](https://github.com/killercup/cargo-edit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:07:03.877Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `killercup/cargo-edit`
- **Description**: A utility for managing cargo dependencies from the command line.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3458 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/util.rs`
```
use std::io::Write;

pub use termcolor::{Color, ColorChoice};
use termcolor::{ColorSpec, StandardStream, WriteColor};

use crate::{CargoResult, Context};

/// Whether to color logged output
pub fn colorize_stderr() -> ColorChoice {
    if concolor_control::get(concolor_control::Stream::Stderr).color() {
        ColorChoice::Always
    } else {
        ColorChoice::Never
    }
}

/// Whether to color logged output
pub(crate) fn colorize_stdout() -> ColorChoice {
    if concolor_control::get(concolor_control::Stream::Stdout).color() {
        ColorChoice::Always
    } else {
        ColorChoice::Never
    }
}

/// Print a message with a colored title in the style of Cargo shell messages.
pub fn shell_print(status: &str, message: &str, color: Color, justified: bool) -> CargoResult<()> {
    let color_choice = colorize_stderr();
    let mut output = StandardStream::stderr(color_choice);

    output.set_color(ColorSpec::new().set_fg(Some(color)).set_bold(true))?;
    if justified {
        write!(output, "{status:>12}")?;
    } else {
        write!(output, "{status}")?;
        output.set_color(ColorSpec::new().set_bold(true))?;
        write!(output, ":")?;
    }
    output.reset()?;

    writeln!(output, " {message}").with_context(|| "Failed to write message")?;

    Ok(())
}

/// Print a styled action message.
pub fn shell_status(action: &str, message: &str) -> CargoResult<()> {
    shell_print(action, message, Color::Green, true)
}

/// Print a styled warning message.
pub fn shell_warn(message: &str) -> CargoResult<()> {
    shell_print("warning", message, Color::Yellow, false)
}

/// Print a styled warning message.
pub fn shell_note(message: &str) -> CargoResult<()> {
    shell_print("note", message, Color::Cyan, false)
}

/// Print a part of a line with formatting
pub fn shell_write_stderr(fragment: impl std::fmt::Display, spec: &ColorSpec) -> CargoResult<()> {
    let color_choice = colorize_stderr();
    let mut output = StandardStream::stderr(color_choice);

    output.set_color(spec)?;
    write!(output, "{fragment}")?;
    output.reset()?;
    Ok(())
}

/// Print a part of a line with formatting
pub fn shell_write_stdout(fragment: impl std::fmt::Display, spec: &ColorSpec) -> CargoResult<()> {
    let color_choice = colorize_stdout();
    let mut output = StandardStream::stdout(color_choice);

    output.set_color(spec)?;
    write!(output, "{fragment}")?;
    output.reset()?;
    Ok(())
}

```

### Core Architecture Module: `src/bin/add/add.rs`
```
#![allow(clippy::bool_assert_comparison)]

use cargo_edit::CargoResult;
use clap::Args;

/// Add dependencies to a Cargo.toml manifest file.
#[derive(Debug, Args)]
#[command(version)]
#[command(after_help = "\
Examples:
  $ cargo add regex --build
  $ cargo add trycmd --dev
  $ cargo add ./crate/parser/
  $ cargo add serde +derive serde_json
")]
#[command(override_usage = "\
       cargo add [OPTIONS] <DEP>[@<VERSION>] [+<FEATURE>,...] ...
       cargo add [OPTIONS] <DEP_PATH> [+<FEATURE>,...] ...")]
pub(crate) struct AddArgs {
    /// Reference to a package to add as a dependency
    ///
    /// You can reference a packages by:{n}
    /// - `<name>`, like `cargo add serde` (latest version will be used){n}
    /// - `<name>@<version-req>`, like `cargo add serde@1` or `cargo add serde@=1.0.38`{n}
    /// - `<path>`, like `cargo add ./crates/parser/`
    ///
    /// Additionally, you can specify features for a dependency by following it with a
    /// `+<FEATURE>`.
    #[arg(value_name = "DEP_ID")]
    pub crates: Vec<String>,

    /// Disable the default features
    #[arg(long)]
    no_default_features: bool,
    /// Re-enable the default features
    #[arg(long, overrides_with = "no_default_features")]
    default_features: bool,

    /// Space-separated list of features to add
    ///
    /// Alternatively, you can specify features for a dependency by following it with a
    /// `+<FEATURE>`.
    #[arg(short = 'F', long)]
    pub features: Option<Vec<String>>,

    /// Mark the dependency as optional
    ///
    /// The package name will be exposed as feature of your crate.
    #[arg(long, conflicts_with = "dev")]
    pub optional: bool,

    /// Mark the dependency as required
    ///
    /// The package will be removed from your features.
    #[arg(long, conflicts_with = "dev", overrides_with = "optional")]
    pub no_optional: bool,

    /// Rename the dependency
    ///
    /// Example uses:{n}
    /// - Depending on multiple versions of a crate{n}
    /// - Depend on crates with the same name from different registries
    #[arg(long, short)]
    pub rename: Option<String>,

    /// Package registry for this dependency
    #[arg(long, conflicts_with = "git")]
    pub registry: Option<String>,

    /// Add as development dependency
    ///
    /// Dev-dependencies are not used when compiling a package for building, but are used for compiling tests, examples, and benchmarks.
    ///
    /// These dependencies are not propagated to other packages which depend on this package.
    #[arg(short = 'D', long, help_heading = "Section", group = "section")]
    pub dev: bool,

    /// Add as build dependency
    ///
    /// Build-dependencies are the only dependencies available for use by build scripts (`build.rs`
    /// files).
    #[arg(short = 'B', long, help_heading = "Section", group = "section")]
    pub build: bool,

    /// Add as dependency to the given target platform.
    #[arg(long, help_heading = "Section", group = "section")]
    pub target: Option<String>,

    /// Path to `Cargo.toml`
    #[arg(long, value_name = "PATH")]
    pub manifest_path: Option<std::path::PathBuf>,

    /// Package to modify
    #[arg(short = 'p', long = "package", value_name = "PKGID")]
    pub pkgid: Option<String>,

    /// Run without accessing the network
    #[arg(long)]
    pub offline: bool,

    /// Don't actually write the manifest
    #[arg(long)]
    pub dry_run: bool,

    /// Do not print any output in case of success.
    #[arg(long)]
    pub quiet: bool,

    /// Git repository location
    ///
    /// Without any other information, cargo will use latest commit on the main branch.
    #[arg(long, value_name = "URI", help_heading = "Unstable")]
    pub git: Option<String>,

    /// Git branch to download the crate from.
    #[arg(
        long,
        value_name = "BRANCH",
        help_heading = "Unstable",
        requires = "git",
        group = "git-ref"
    )]
    pub branch: Option<String>,

    /// Git tag to download the crate from.
    #[arg(
        long,
        value_name = "TAG",
        help_heading = "Unstable",
        requires = "git",
        group = "git-ref"
    )]
    pub tag: Option<String>,

    /// Git reference to download the crate from
    ///
    /// This is the catch all, handling hashes to named references in remote repositories.
    #[arg(
        long,
        value_name = "REV",
        help_heading = "Unstable",
        requires = "git",
        group = "git-ref"
    )]
    pub rev: Option<String>,
}

impl AddArgs {
    pub(crate) fn exec(self) -> CargoResult<()> {
        anyhow::bail!(
            "`cargo add` has been merged into cargo 1.62+ as of cargo-edit 0.10, either
- Upgrade cargo, like with `rustup update`
- Downgrade `cargo-edit`, like with `cargo install cargo-edit --version 0.9.1`"
        );
    }
}

```

### Core Architecture Module: `src/bin/add/cli.rs`
```
use cargo_edit::CargoResult;
use clap::Parser;

#[derive(Debug, Parser)]
#[command(bin_name = "cargo")]
pub(crate) enum Command {
    Add(crate::add::AddArgs),
}

impl Command {
    pub(crate) fn exec(self) -> CargoResult<()> {
        match self {
            Self::Add(add) => add.exec(),
        }
    }
}

#[test]
fn verify_app() {
    use clap::CommandFactory;
    Command::command().debug_assert();
}

```

### Core Architecture Module: `src/bin/add/main.rs`
```
//! `cargo add`
#![warn(
    missing_docs,
    missing_debug_implementations,
    missing_copy_implementations,
    trivial_casts,
    trivial_numeric_casts,
    unsafe_code,
    unstable_features,
    unused_import_braces,
    unused_qualifications
)]

mod add;
mod cli;

use std::process;

use clap::Parser;

fn main() {
    let args = cli::Command::parse();

    if let Err(err) = args.exec() {
        eprintln!("Error: {err:?}");

        process::exit(1);
    }
}

```

### Core Architecture Module: `src/bin/rm/cli.rs`
```
use cargo_edit::CargoResult;
use clap::Parser;

#[derive(Debug, Parser)]
#[command(bin_name = "cargo")]
pub(crate) enum Command {
    Rm(crate::rm::RmArgs),
}

impl Command {
    pub(crate) fn exec(self) -> CargoResult<()> {
        match self {
            Self::Rm(add) => add.exec(),
        }
    }
}

#[test]
fn verify_app() {
    use clap::CommandFactory;
    Command::command().debug_assert();
}

```

### Core Architecture Module: `src/bin/rm/main.rs`
```
//! `cargo rm`
#![warn(
    missing_docs,
    missing_debug_implementations,
    missing_copy_implementations,
    trivial_casts,
    trivial_numeric_casts,
    unsafe_code,
    unstable_features,
    unused_import_braces,
    unused_qualifications
)]

mod cli;
mod rm;

use std::process;

use clap::Parser;

fn main() {
    let args = cli::Command::parse();

    if let Err(err) = args.exec() {
        eprintln!("Error: {err:?}");

        process::exit(1);
    }
}

```

### Core Architecture Module: `src/bin/rm/rm.rs`
```
use cargo_edit::CargoResult;
use clap::Args;
use std::path::PathBuf;

/// Remove a dependency from a Cargo.toml manifest file.
#[derive(Debug, Args)]
#[command(version)]
pub(crate) struct RmArgs {
    /// Dependencies to be removed
    #[arg(value_name = "DEP_ID", required = true)]
    crates: Vec<String>,

    /// Remove as development dependency
    #[arg(long, short = 'D', conflicts_with = "build", help_heading = "Section")]
    dev: bool,

    /// Remove as build dependency
    #[arg(long, short = 'B', conflicts_with = "dev", help_heading = "Section")]
    build: bool,

    /// Remove as dependency from the given target platform
    #[arg(long, value_parser = clap::builder::NonEmptyStringValueParser::new(), help_heading = "Section")]
    target: Option<String>,

    /// Path to the manifest to remove a dependency from
    #[arg(long, value_name = "PATH")]
    manifest_path: Option<PathBuf>,

    /// Package to remove from
    #[arg(long = "package", short = 'p', value_name = "PKGID")]
    pkgid: Option<String>,

    /// Unstable (nightly-only) flags
    #[arg(short = 'Z', value_name = "FLAG", global = true, value_enum)]
    unstable_features: Vec<UnstableOptions>,

    /// Don't actually write the manifest
    #[arg(long)]
    dry_run: bool,

    /// Do not print any output in case of success
    #[arg(long, short)]
    quiet: bool,
}

impl RmArgs {
    pub(crate) fn exec(&self) -> CargoResult<()> {
        anyhow::bail!(
            "`cargo rm` has been merged into cargo 1.66+ as of cargo-edit 0.12, either
- Upgrade cargo, like with `rustup update`
- Downgrade `cargo-edit`, like with `cargo install cargo-edit --version 0.11`"
        );
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, clap::ValueEnum)]
enum UnstableOptions {}

```

### Core Architecture Module: `src/bin/set-version/cli.rs`
```
use cargo_edit::CargoResult;
use clap::Parser;

#[derive(Debug, Parser)]
#[command(bin_name = "cargo")]
#[command(styles = clap_cargo::style::CLAP_STYLING)]
pub(crate) enum Command {
    SetVersion(crate::set_version::VersionArgs),
}

impl Command {
    pub(crate) fn exec(self) -> CargoResult<()> {
        match self {
            Self::SetVersion(add) => add.exec(),
        }
    }
}

#[test]
fn verify_app() {
    use clap::CommandFactory;
    Command::command().debug_assert();
}

```

### Core Architecture Module: `src/bin/set-version/errors.rs`
```
use std::fmt::Display;

pub(crate) use cargo_edit::CargoResult;

pub(crate) use cargo_edit::Error;

/// User requested to downgrade a crate
pub(crate) fn version_downgrade_err(current: impl Display, requested: impl Display) -> Error {
    anyhow::format_err!("Cannot downgrade from {current} to {requested}")
}

```

### Core Architecture Module: `src/bin/set-version/main.rs`
```
//! `cargo version`
#![warn(
    missing_docs,
    missing_debug_implementations,
    missing_copy_implementations,
    trivial_casts,
    trivial_numeric_casts,
    unsafe_code,
    unstable_features,
    unused_import_braces,
    unused_qualifications
)]
#![allow(clippy::comparison_chain)]

mod cli;
mod errors;
mod set_version;
mod version;

use std::process;

use clap::Parser;

fn main() {
    let args = cli::Command::parse();

    if let Err(err) = args.exec() {
        eprintln!("Error: {err:?}");

        process::exit(1);
    }
}

```

### Core Architecture Module: `src/bin/set-version/set_version.rs`
```
use std::path::Path;
use std::path::PathBuf;

use cargo_edit::{LocalManifest, shell_status, shell_warn, upgrade_requirement};
use clap::Args;

use crate::errors::CargoResult;
use crate::version::BumpLevel;
use crate::version::TargetVersion;

/// Change a package's version in the local manifest file (i.e. Cargo.toml).
#[derive(Debug, Args)]
#[command(version)]
#[command(group = clap::ArgGroup::new("ver").multiple(false))]
pub(crate) struct VersionArgs {
    /// Version to change manifests to
    #[arg(group = "ver")]
    target: Option<semver::Version>,

    /// Increment manifest version
    #[arg(long, group = "ver")]
    bump: Option<BumpLevel>,

    /// Specify the version metadata field (e.g. a wrapped libraries version)
    #[arg(short, long)]
    pub metadata: Option<String>,

    /// Path to the manifest to upgrade
    #[arg(long, value_name = "PATH")]
    manifest_path: Option<PathBuf>,

    /// Package id of the crate to change the version of.
    #[arg(
        long = "package",
        short = 'p',
        value_name = "PKGID",
        conflicts_with = "all",
        conflicts_with = "workspace"
    )]
    pkgid: Vec<String>,

    /// Modify all packages in the workspace.
    #[arg(
        long,
        help = "[deprecated in favor of `--workspace`]",
        conflicts_with = "workspace",
        conflicts_with = "pkgid"
    )]
    all: bool,

    /// Modify all packages in the workspace.
    #[arg(long, conflicts_with = "all", conflicts_with = "pkgid")]
    workspace: bool,

    /// Print changes to be made without making them.
    #[arg(long, short = 'n')]
    dry_run: bool,

    /// Crates to exclude and not modify.
    #[arg(long)]
    exclude: Vec<String>,

    /// Run without accessing the network
    #[arg(long)]
    offline: bool,

    /// Require `Cargo.toml` to be up to date
    #[arg(long)]
    locked: bool,

    #[command(flatten)]
    verbose: clap_verbosity_flag::Verbosity,

    /// Unstable (nightly-only) flags
    #[arg(short = 'Z', value_name = "FLAG", global = true, value_enum)]
    unstable_features: Vec<UnstableOptions>,
}

impl VersionArgs {
    pub(crate) fn exec(self) -> CargoResult<()> {
        exec(self)
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, clap::ValueEnum)]
enum UnstableOptions {}

/// Main processing function. Allows us to return a `Result` so that `main` can print pretty error
/// messages.
fn exec(args: VersionArgs) -> CargoResult<()> {
    env_logger::Builder::from_env("CARGO_LOG")
        .filter_level(args.verbose.log_level_filter())
        .init();

    let VersionArgs {
        target,
        bump,
        metadata,
        manifest_path,
        pkgid,
        all,
        dry_run,
        workspace,
        exclude,
        locked,
        offline,
        verbose: _,
        unstable_features: _,
    } = args;

    let target = match (target, bump) {
        (None, None) => TargetVersion::Relative(BumpLevel::Release),
        (None, Some(level)) => TargetVersion::Relative(level),
        (Some(version), None) => TargetVersion::Absolute(version),
        (Some(_), Some(_)) => unreachable!("clap groups should prevent this"),
    };

    let ws_metadata = resolve_ws(manifest_path.as_deref(), locked, offline)?;
    let root_manifest_path = ws_metadata.workspace_root.as_std_path().join("Cargo.toml");
    let workspace_members = find_ws_members(&ws_metadata);

    let mut missing = Vec::new();
    for name in &pkgid {
        let name = name.as_str();
        if !workspace_members
            .iter()
            .any(|package| package.name.as_str() == name)
            && !missing.contains(&name)
        {
            missing.push(name);
        }
    }
    match missing.len() {
        0 => {}
        1 => anyhow::bail!("package {} doesn't exist", missing.join(", ")),
        _ => anyhow::bail!("packages {} don't exist", missing.join(", ")),
    }

    if all {
        shell_warn("The flag `--all` has been deprecated in favor of `--workspace`")?;
    }
    let workspace = workspace || all || pkgid.is_empty();
    let mut selected = if workspace {
        workspace_members
            .iter()
            .filter(|p| !exclude.contains(&p.name))
            .collect::<Vec<_>>()
    } else {
        workspace_members
            .iter()
            .filter(|p| pkgid.contains(&p.name))
            .collect::<Vec<_>>()
    };

    let update_workspace_version;
    let mut changed = false;
    if workspace && exclude.is_empty() {
        // Fast path
        update_workspace_version = true;
    } else {
        let explicit_selected = selected
            .iter()
            .filter(|p| {
                LocalManifest::try_new(Path::new(&p.manifest_path))
                    .map(|m| m.version_is_inherited())
                    .unwrap_or(false)
            })
            .map(|p| p.name.as_str())
            .collect::<Vec<_>>();
        update_workspace_version = !explicit_selected.is_empty();
        if update_workspace_version {
            let implicit = workspace_members
                .iter()
                .filter(|i| !selected.iter().any(|s| i.id == s.id))
                .filter(|i| {
                    LocalManifest::try_new(Path::new(&i.manifest_path))
                        .map(|m| m.version_is_inherited())
                        .unwrap_or(false)
                })
                .collect::<Vec<_>>();
            let exclude_implicit = implicit
                .iter()
                .filter(|p| exclude.contains(&p.name))
                .map(|p| p.name.as_str())
                .collect::<Vec<_>>();
            if !exclude_implicit.is_empty() {
                anyhow::bail!(
                    "Cannot exclude {} package(s) when {} package(s) modify `workspace.package.version`",
                    exclude_implicit.join(", "),
                    explicit_selected.join(", ")
                );
            }
            selected.extend(implicit);
        }
    }

    if update_workspace_version {
        let mut ws_manifest = LocalManifest::try_new(&root_manifest_path)?;
        if let Some(current) = ws_manifest.get_workspace_version()
            && let Some(next) = target.bump(&current, metadata.as_deref())?
        {
            shell_status(
                "Upgrading",
                &format!("workspace version from {current} to {next}"),
            )?;
            ws_manifest.set_workspace_version(&next);
            changed = true;
            if !dry_run {
                ws_manifest.write()?;
            }

            // Deferring `update_dependents` to the per-package logic
        }
    }

    for package in selected {
        let current = &package.version;
        let next = target.bump(current, metadata.as_deref())?;
        if let Some(next) = next {
            let mut manifest = LocalManifest::try_new(Path::new(&package.manifest_path))?;
            if manifest.version_is_inherited() {
                shell_status(
                    "Upgrading",
                    &format!(
                        "{} from {} to {} (inherited from workspace)",
                        package.name, current, next,
                    ),
                )?;
            } else {
                shell_status(
                    "Upgrading",
                    &format!("{} from {} to {}", package.name, current, next),
                )?;
                manifest.set_package_version(&next);
                changed = true;
                if !dry_run {
                    manifest.write()?;
                }
            }

            let crate_root =
                dunce::canonicalize(package.manifest_path.parent().expect("at least a parent"))?;
            update_dependents(
                &crate_root,
                &next,
                &root_manifest_path,
                &workspace_members,
                dry_run,
            )?;
        }
    }

    if changed {
        resolve_ws(manifest_path.as_deref(), locked, offline)?;
    }
    if dry_run {
        shell_warn("aborting set-version due to dry run")?;
    }

    Ok(())
}

fn update_dependents(
    crate_root: &Path,
    next: &semver::Version,
    root_manifest_path: &Path,
    workspace_members: &[cargo_metadata::Package],
    dry_run: bool,
) -> CargoResult<()> {
    // This is redundant with iterating over `workspace_members`
    // - As `get_dependency_tables_mut` returns workspace dependencies
    // - If there is a root package
    //
    // But split this out for
    // - Virtual manifests
    // - Nicer message to the user
    {
        update_dependent(crate_root, next, root_manifest_path, "workspace", dry_run)?;
    }

    for member in workspace_members.iter() {
        update_dependent(
            crate_root,
            next,
            member.manifest_path.as_std_path(),
            &member.name,
            dry_run,
        )?;
    }

    Ok(())
}

fn is_relevant(d: &dyn toml_edit::TableLike, dep_crate_root: &Path, crate_root: &Path) -> bool {
    if !d.contains_key("version") {
        return false;
    }
    match d
        .get("path")
        .and_then(|i| i.as_str())
        .and_then(|relpath| dunce::canonicalize(dep_crate_root.join(relpath)).ok())
    {
        Some(dep_path) => dep_path == crate_root,
        None => false,
    }
}

fn update_dependent(
    crate_root: &Path,
    next: &semver::Version,
    manifest_path: &Path,
    name: &str,
    dry_run: bool,
) -> CargoResult<()> {
    let mut dep_manifest = LocalManifest::try_new(manifest_path)?;
    let mut changed = false;
    let dep_crate_root = dep_manifest
        .path
        .parent()
        .expect("at least a parent")
        .to_owned();

    for dep in dep_manifest
        .get_dependency_tables_mut()
        .flat_map(|t| t.iter_mut().filter_map(|(_, d)| d.as_table_like_mut()))
        .filter(|d| is_relevant(*d, &dep_crate_root, crate_root))
    {
        let old_req = dep
            .get("version")
            .expect("filter ensures this")
            .as_str()
     
```

### Core Architecture Module: `src/bin/set-version/version.rs`
```
use std::str::FromStr;

use cargo_edit::VersionExt;

use crate::errors::{CargoResult, version_downgrade_err};

#[derive(Clone, Debug)]
pub(crate) enum TargetVersion {
    Relative(BumpLevel),
    Absolute(semver::Version),
}

impl TargetVersion {
    pub(crate) fn bump(
        &self,
        current: &semver::Version,
        metadata: Option<&str>,
    ) -> CargoResult<Option<semver::Version>> {
        match self {
            TargetVersion::Relative(bump_level) => {
                let mut potential_version = current.to_owned();
                bump_level.bump_version(&mut potential_version, metadata)?;
                if potential_version != *current {
                    let version = potential_version;
                    Ok(Some(version))
                } else {
                    Ok(None)
                }
            }
            TargetVersion::Absolute(version) => {
                if current < version {
                    let mut version = version.clone();
                    if version.build.is_empty() {
                        if let Some(metadata) = metadata {
                            version.build = semver::BuildMetadata::new(metadata)?;
                        } else {
                            version.build = current.build.clone();
                        }
                    }

                    Ok(Some(version))
                } else if current == version {
                    Ok(None)
                } else {
                    Err(version_downgrade_err(current, version))
                }
            }
        }
    }
}

impl Default for TargetVersion {
    fn default() -> Self {
        TargetVersion::Relative(BumpLevel::Release)
    }
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum BumpLevel {
    Major,
    Minor,
    Patch,
    /// Strip all pre-release flags
    Release,
    Rc,
    Beta,
    Alpha,
}

impl FromStr for BumpLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "major" => Ok(BumpLevel::Major),
            "minor" => Ok(BumpLevel::Minor),
            "patch" => Ok(BumpLevel::Patch),
            "release" => Ok(BumpLevel::Release),
            "rc" => Ok(BumpLevel::Rc),
            "beta" => Ok(BumpLevel::Beta),
            "alpha" => Ok(BumpLevel::Alpha),
            _ => Err(String::from(
                "[valid values: major, minor, patch, rc, beta, alpha]",
            )),
        }
    }
}

impl BumpLevel {
    pub(crate) fn bump_version(
        self,
        version: &mut semver::Version,
        metadata: Option<&str>,
    ) -> CargoResult<()> {
        match self {
            BumpLevel::Major => {
                version.increment_major();
            }
            BumpLevel::Minor => {
                version.increment_minor();
            }
            BumpLevel::Patch => {
                if !version.is_prerelease() {
                    version.increment_patch();
                } else {
                    version.pre = semver::Prerelease::EMPTY;
                }
            }
            BumpLevel::Release => {
                if version.is_prerelease() {
                    version.pre = semver::Prerelease::EMPTY;
                }
            }
            BumpLevel::Rc => {
                version.increment_rc()?;
            }
            BumpLevel::Beta => {
                version.increment_beta()?;
            }
            BumpLevel::Alpha => {
                version.increment_alpha()?;
            }
        };

        if let Some(metadata) = metadata {
            version.metadata(metadata)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;

    fn abs(version: &str) -> TargetVersion {
        let abs = semver::Version::parse(version).unwrap();
        TargetVersion::Absolute(abs)
    }

    #[test]
    fn abs_bump_from_dev() {
        let expected = "2022.3.0";
        let current = "2022.3.0-dev-12345";

        let target = abs(expected);
        let current = semver::Version::parse(current).unwrap();
        let actual = target.bump(&current, None).unwrap();
        let actual = actual.expect("Version changed").to_string();
        assert_eq!(actual, expected);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #891** (2026-03-02): **Cargo `set-version --workspace` does not update `Cargo.lock` with private crate reference**
  *Symptoms*: Apparently, when using the `cargo set-version --workspace` command in GitHub actions using a linux runner, the `Cargo.lock` file does not get updated with the updated version. When running on Windows, my WIP has a `Cargo.toml` and `Cargo.lock` change. In our scenario, the repository using the action is setup to use workspaces.  **Update**: Apparently, the issue recreates for `windows-latest` runners too. I could only recreate the issue in my sample repository once I added a private crate.  This is with the latest version: `0.12.2`
  **Post-Mortem & Fix Analysis**:
  > Can you provide local reproduction steps?
  > I setup a repository that demonstrates the issue.  Check out the actions to see what I'm talking about:  - First action where it is failing to update `Cargo.lock`: https://github.com/brogdonm/cargo-edit-issue-891/actions/runs/8637628362/job/23680249988   Turns out, it fails on `windows-latest` too and from my steps of setting up a simple repository to recreate it appears to happen when there is a crate dependency that is "private".  For example, this fails: https://github.com/brogdonm/cargo-edit-issue-891/commit/fa566e159a8f7db9753e072f7f4fbb00e593386d  This does not: https://github.com/brogdonm/cargo-edit-issue-891/commit/6da6ddcd09e09f7e0a8ff35d25b0ac3bf6277755
  > Can you provide **local** reproduction steps.  Meaning without the use of an action

- **Issue #888** (2026-07-14): **Specifying nonexistent package name results in "successful" no-op run**
  *Symptoms*: Hi.  Thanks for this tool which we rely on heavily for our releases.  I have an infelicity to report:  ### To reproduce  ``` git clone https://gitlab.torproject.org/tpo/core/arti cd arti git checkout arti-v1.1.13 cargo --offline set-version --bump patch -p this-package-does-not-exist echo $? ```  ### Expected behavour  An error message, and a non-zero exit status.  ### Actual behaviour  No output, no change to the tree, and a zero exit status.

- **Issue #792** (2022-09-09): **`cargo upgrade` does not handle git dependencies**
  *Symptoms*: If `cargo upgrade` is being designed as a replacement for `cargo update`, it needs to update git dependencies.

- **Issue #790** (2022-09-09): **No equivalent of `--precise` with new cargo upgrade**
  *Symptoms*: `cargo upgrade --package foo@10.1.1` but the lock file may pick a newer version.
  **Post-Mortem & Fix Analysis**:
  > The problem is cargo-upgrade is working on version reqs.  Maybe a `--precise` flag is needed to say "treat them as versions".  Or maybe we just infer that a fully specified version req is a version so that the lock file and manifest match.  I lean towards this last one as keeping the manifest and lock file in sync is one of our goals of this design.

- **Issue #789** (2022-09-09): **Upgrade with `--recursive=true` (default) will modify the lock file for skipped entries (like pinned)**
  *Symptoms*: #787 added recursive upgrading.  Since we don't have as much control through `cargo update` as is needed (without spawning 20 update calls), we are not restricting the `cargo update` to what cargo upgrade operated on  This applies to - pinned - `--exclude`

- **Issue #770** (2023-01-26): **Update git2?**
  *Symptoms*: It looks like you are currently depending on git2 v0.14. v0.15 fixes a [segfault while iterating over config entries](https://github.com/rust-lang/git2-rs/issues/836), so it might be a good idea to upgrade.
  **Post-Mortem & Fix Analysis**:
  > We are indirectly tied to cargo because we have branches off of master that are moving cargo-edit commands onto cargo's internals.  So this is blocked on https://github.com/rust-lang/cargo/pull/11004
  > For what it's worth, rust-lang/cargo#11004 has been merged.
  > Cargo is now on v0.16: https://github.com/rust-lang/cargo/pull/11556/files#diff-2e9d962a08321605940b5a657135052fbcef87b5e360662bb527c96d9a615542R31

- **Issue #752** (2022-10-06): **Support workspace inheritance in `cargo-set-version`**
  *Symptoms*: [Workspace inheritance](https://github.com/rust-lang/cargo/issues/8415) was [stabilized](https://github.com/rust-lang/cargo/pull/10859) recently and set to be released in Rust version `1.64` on [September 22, 2022](https://forge.rust-lang.org/#current-release-versions).  `cargo-set-version` currently does not allow setting the `version` in the `[workspace.package]` table. This needs to happen as workspace inheritance allows inheriting a version from the workspace root by setting `version.workspace = true` in the member and in the workspace root putting: ```rust [workspace.package] version = "0.1.0" ```
  **Post-Mortem & Fix Analysis**:
  > I'll work on this today

- **Issue #751** (2022-09-22): **Support workspace inheritance in `cargo-upgrade`**
  *Symptoms*: [Workspace inheritance](https://github.com/rust-lang/cargo/issues/8415) was [stabilized](https://github.com/rust-lang/cargo/pull/10859) recently and set to be released in Rust version `1.64` on [September 22, 2022](https://forge.rust-lang.org/#current-release-versions).  `cargo-upgrade` currently does not update dependencies in the `[workspace.dependencies]` table. Support for this should be added as one of the main motivations for workspace inheritance was updating the dependency version in one place not every member of the workspace.
  **Post-Mortem & Fix Analysis**:
  > Been thinking about what behavior we want - Touch `workspace.dependencies` when the full workspace is selected (e.g. `--workspace`) - Add a `note: run with --workspace` if workspace dependencies are used but `workspace.dependencies` aren't being upgraded.

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

### Incident Patch 1: `05a26609` (2026-07-15)
**Commit Message**: Merge pull request #969 from ychampion/fix/867-verbose-hint

fix(upgrade): show the next effective verbosity

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ The format is based on [Keep a Changelog].
 <!-- next-header -->
 ## Unreleased - ReleaseDate
 
+### Fixes
+
+- *(upgrade)* Point single-`--verbose` users to `--verbose --verbose` when more dependencies are hidden
+
 ## 0.13.12 - 2026-07-14
 
 ### Fixes
```

**File**: `src/bin/upgrade/upgrade.rs` (modified, +6/-1)
```diff
@@ -625,7 +625,12 @@ fn exec(args: UpgradeArgs) -> CargoResult<()> {
                 .or_insert_with(BTreeSet::new)
                 .insert(dep.name);
         }
-        let mut note = "Re-run with `--verbose` to show more dependencies".to_owned();
+        let verbose_flags = if args.is_verbose() {
+            "`--verbose --verbose`"
+        } else {
+            "`--verbose`"
+        };
+        let mut note = format!("Re-run with {verbose_flags} to show more dependencies");
         for (reason, deps) in categorize {
             use std::fmt::Write;
             write!(&mut note, "\n  {reason}: ")?;
```

**File**: `tests/cargo-upgrade/main.rs` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ mod upgrade_all;
 mod upgrade_everything;
 mod upgrade_renamed;
 mod upgrade_verbose;
+mod upgrade_verbose_hint;
 mod upgrade_workspace;
 mod virtual_manifest;
 mod workspace_inheritance;
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/in/Cargo.toml` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+[package]
+name = "None"
+version = "0.1.0"
+
+[lib]
+path = "dummy.rs"
+
+[dependencies]
+docopt = "0.4"
+pad = "0.1"
+serde_json = "20.0"
+syn = { version = "0.1.1", default-features = false }
+tar = { version = "0.4", default-features = false }
+ftp = "20.0.0"
+te = { package = "toml_edit", version = "0.1.1" }
+
+[dependencies.semver]
+version = "0.2"
+
+[dependencies.rn]
+package = "renamed"
+version = "0.1"
+
+[dev-dependencies]
+assert_cli = "0.2.0"
+tempdir = "0.1"
+
+[build-dependencies]
+serde = { version = "1.0", path = "../serde" }
+
+[target.'cfg(unix)'.dependencies]
+openssl = "0.4"
+
+[target."windows.json"]
+# let's make it an inline table
+dependencies = { rget = "0.4.0" }
+
+[target.'cfg(target_arch = "x86_64")'.dev-dependencies]
+geo = { version = "0.2.0", default-features = false }
+
+[target.foo.build-dependencies]
+ftp = "0.2.0"
+
+[features]
+default = []
+test-external-apis = []
+unstable = []
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/mod.rs` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+use cargo_test_support::Project;
+use cargo_test_support::compare::assert_ui;
+use cargo_test_support::file;
+use cargo_test_support::prelude::*;
+
+use crate::CargoCommand;
+use cargo_test_support::current_dir;
+
+#[cargo_test]
+fn case() {
+    cargo_test_support::registry::init();
+    crate::add_everything_registry_packages(false);
+    crate::add_git_registry_packages();
+    let project = Project::from_template(current_dir!().join("in"));
+    let project_root = project.root();
+    let cwd = &project_root;
+
+    snapbox::cmd::Command::cargo_ui()
+        .arg("upgrade")
+        .args(["--pinned", "--incompatible", "--verbose"])
+        .current_dir(cwd)
+        .assert()
+        .success()
+        .stdout_eq(file!["stdout.term.svg"])
+        .stderr_eq(file!["stderr.term.svg"]);
+
+    assert_ui().subset_matches(current_dir!().join("out"), &project_root);
+}
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/out/Cargo.toml` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+[package]
+name = "None"
+version = "0.1.0"
+
+[lib]
+path = "dummy.rs"
+
+[dependencies]
+docopt = "99999.0"
+pad = "99999.0"
+serde_json = "99999.0"
+syn = { version = "99999.0.0", default-features = false }
+tar = { version = "99999.0", default-features = false }
+ftp = "99999.0.0"
+te = { package = "toml_edit", version = "99999.0.0" }
+
+[dependencies.semver]
+version = "99999.0"
+
+[dependencies.rn]
+package = "renamed"
+version = "99999.0"
+
+[dev-dependencies]
+assert_cli = "99999.0.0"
+tempdir = "99999.0"
+
+[build-dependencies]
+serde = { version = "1.0", path = "../serde" }
+
+[target.'cfg(unix)'.dependencies]
+openssl = "99999.0"
+
+[target."windows.json"]
+# let's make it an inline table
+dependencies = { rget = "99999.0.0" }
+
+[target.'cfg(target_arch = "x86_64")'.dev-dependencies]
+geo = { version = "99999.0.0", default-features = false }
+
+[target.foo.build-dependencies]
+ftp = "99999.0.0"
+
+[features]
+default = []
+test-external-apis = []
+unstable = []
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/stderr.term.svg` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+<svg width="740px" height="128px" xmlns="http://www.w3.org/2000/svg">
+  <style>
+    .fg { fill: #AAAAAA }
+    .bg { background: #000000 }
+    .container {
+      padding: 0 10px;
+      line-height: 18px;
+    }
+    tspan {
+      font: 14px SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
+      white-space: pre;
+      line-height: 18px;
+    }
+  </style>
+
+  <rect width="100%" height="100%" y="0" rx="4.5" class="bg" />
+
+  <text xml:space="preserve" class="container fg">
+    <tspan x="10px" y="28px"><tspan>    Checking None's dependencies</tspan>
+</tspan>
+    <tspan x="10px" y="46px"><tspan>   Upgrading recursive dependencies</tspan>
+</tspan>
+    <tspan x="10px" y="64px"><tspan>     Locking 0 packages to latest compatible versions</tspan>
+</tspan>
+    <tspan x="10px" y="82px"><tspan>note: Re-run with `--verbose --verbose` to show more dependencies</tspan>
+</tspan>
+    <tspan x="10px" y="100px"><tspan>  latest: serde</tspan>
+</tspan>
+    <tspan x="10px" y="118px">
+</tspan>
+  </text>
+
+</svg>
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/stdout.term.svg` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+<svg width="740px" height="344px" xmlns="http://www.w3.org/2000/svg">
+  <style>
+    .fg { fill: #AAAAAA }
+    .bg { background: #000000 }
+    .container {
+      padding: 0 10px;
+      line-height: 18px;
+    }
+    tspan {
+      font: 14px SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
+      white-space: pre;
+      line-height: 18px;
+    }
+  </style>
+
+  <rect width="100%" height="100%" y="0" rx="4.5" class="bg" />
+
+  <text xml:space="preserve" class="container fg">
+    <tspan x="10px" y="28px"><tspan>name           old req compatible latest    new req  </tspan>
+</tspan>
+    <tspan x="10px" y="46px"><tspan>====           ======= ========== ======    =======  </tspan>
+</tspan>
+    <tspan x="10px" y="64px"><tspan>docopt         0.4     0.4.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="82px"><tspan>pad            0.1     0.1.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="100px"><tspan>serde_json     20.0    20.0.0     99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="118px"><tspan>syn            0.1.1   0.1.1      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="136px"><tspan>tar            0.4     0.4.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="154px"><tspan>ftp            20.0.0  20.0.0     99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="172px"><tspan>toml_edit (te) 0.1.1   0.1.1      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="190px"><tspan>semver         0.2     0.2.3      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="208px"><tspan>renamed (rn)   0.1     0.1.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="226px"><tspan>assert_cli     0.2.0   0.2.3      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="244px"><tspan>tempdir        0.1     0.1.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="262px"><tspan>openssl        0.4     0.4.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="280px"><tspan>rget           0.4.0   0.4.1      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="298px"><tspan>geo            0.2.0   0.2.3      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="316px"><tspan>ftp            0.2.0   0.2.3      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="334px">
+</tspan>
+  </text>
+
+</svg>
```

---

### Incident Patch 2: `e98ac32a` (2026-07-14)
**Commit Message**: fix(upgrade): show the next effective verbosity

Constraint: Preserve the existing three-level dependency filtering and default hint.

Rejected: Change verbosity semantics | The maintainer confirmed the filtering behavior is intentional.

Confidence: high

Scope-risk: narrow

Directive: Keep hints aligned with the next display level when verbosity behavior changes.

Tested: focused red-to-green UI snapshots; full locked all-feature suite; rustfmt; strict all-target/all-feature Clippy.

Not-tested: None.

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ The format is based on [Keep a Changelog].
 <!-- next-header -->
 ## Unreleased - ReleaseDate
 
+### Fixes
+
+- *(upgrade)* Point single-`--verbose` users to `--verbose --verbose` when more dependencies are hidden
+
 ## 0.13.12 - 2026-07-14
 
 ### Fixes
```

**File**: `src/bin/upgrade/upgrade.rs` (modified, +6/-1)
```diff
@@ -625,7 +625,12 @@ fn exec(args: UpgradeArgs) -> CargoResult<()> {
                 .or_insert_with(BTreeSet::new)
                 .insert(dep.name);
         }
-        let mut note = "Re-run with `--verbose` to show more dependencies".to_owned();
+        let verbose_flags = if args.is_verbose() {
+            "`--verbose --verbose`"
+        } else {
+            "`--verbose`"
+        };
+        let mut note = format!("Re-run with {verbose_flags} to show more dependencies");
         for (reason, deps) in categorize {
             use std::fmt::Write;
             write!(&mut note, "\n  {reason}: ")?;
```

**File**: `tests/cargo-upgrade/main.rs` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ mod upgrade_all;
 mod upgrade_everything;
 mod upgrade_renamed;
 mod upgrade_verbose;
+mod upgrade_verbose_hint;
 mod upgrade_workspace;
 mod virtual_manifest;
 mod workspace_inheritance;
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/in/Cargo.toml` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+[package]
+name = "None"
+version = "0.1.0"
+
+[lib]
+path = "dummy.rs"
+
+[dependencies]
+docopt = "0.4"
+pad = "0.1"
+serde_json = "20.0"
+syn = { version = "0.1.1", default-features = false }
+tar = { version = "0.4", default-features = false }
+ftp = "20.0.0"
+te = { package = "toml_edit", version = "0.1.1" }
+
+[dependencies.semver]
+version = "0.2"
+
+[dependencies.rn]
+package = "renamed"
+version = "0.1"
+
+[dev-dependencies]
+assert_cli = "0.2.0"
+tempdir = "0.1"
+
+[build-dependencies]
+serde = { version = "1.0", path = "../serde" }
+
+[target.'cfg(unix)'.dependencies]
+openssl = "0.4"
+
+[target."windows.json"]
+# let's make it an inline table
+dependencies = { rget = "0.4.0" }
+
+[target.'cfg(target_arch = "x86_64")'.dev-dependencies]
+geo = { version = "0.2.0", default-features = false }
+
+[target.foo.build-dependencies]
+ftp = "0.2.0"
+
+[features]
+default = []
+test-external-apis = []
+unstable = []
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/mod.rs` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+use cargo_test_support::Project;
+use cargo_test_support::compare::assert_ui;
+use cargo_test_support::file;
+use cargo_test_support::prelude::*;
+
+use crate::CargoCommand;
+use cargo_test_support::current_dir;
+
+#[cargo_test]
+fn case() {
+    cargo_test_support::registry::init();
+    crate::add_everything_registry_packages(false);
+    crate::add_git_registry_packages();
+    let project = Project::from_template(current_dir!().join("in"));
+    let project_root = project.root();
+    let cwd = &project_root;
+
+    snapbox::cmd::Command::cargo_ui()
+        .arg("upgrade")
+        .args(["--pinned", "--incompatible", "--verbose"])
+        .current_dir(cwd)
+        .assert()
+        .success()
+        .stdout_eq(file!["stdout.term.svg"])
+        .stderr_eq(file!["stderr.term.svg"]);
+
+    assert_ui().subset_matches(current_dir!().join("out"), &project_root);
+}
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/out/Cargo.toml` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+[package]
+name = "None"
+version = "0.1.0"
+
+[lib]
+path = "dummy.rs"
+
+[dependencies]
+docopt = "99999.0"
+pad = "99999.0"
+serde_json = "99999.0"
+syn = { version = "99999.0.0", default-features = false }
+tar = { version = "99999.0", default-features = false }
+ftp = "99999.0.0"
+te = { package = "toml_edit", version = "99999.0.0" }
+
+[dependencies.semver]
+version = "99999.0"
+
+[dependencies.rn]
+package = "renamed"
+version = "99999.0"
+
+[dev-dependencies]
+assert_cli = "99999.0.0"
+tempdir = "99999.0"
+
+[build-dependencies]
+serde = { version = "1.0", path = "../serde" }
+
+[target.'cfg(unix)'.dependencies]
+openssl = "99999.0"
+
+[target."windows.json"]
+# let's make it an inline table
+dependencies = { rget = "99999.0.0" }
+
+[target.'cfg(target_arch = "x86_64")'.dev-dependencies]
+geo = { version = "99999.0.0", default-features = false }
+
+[target.foo.build-dependencies]
+ftp = "99999.0.0"
+
+[features]
+default = []
+test-external-apis = []
+unstable = []
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/stderr.term.svg` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+<svg width="740px" height="128px" xmlns="http://www.w3.org/2000/svg">
+  <style>
+    .fg { fill: #AAAAAA }
+    .bg { background: #000000 }
+    .container {
+      padding: 0 10px;
+      line-height: 18px;
+    }
+    tspan {
+      font: 14px SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
+      white-space: pre;
+      line-height: 18px;
+    }
+  </style>
+
+  <rect width="100%" height="100%" y="0" rx="4.5" class="bg" />
+
+  <text xml:space="preserve" class="container fg">
+    <tspan x="10px" y="28px"><tspan>    Checking None's dependencies</tspan>
+</tspan>
+    <tspan x="10px" y="46px"><tspan>   Upgrading recursive dependencies</tspan>
+</tspan>
+    <tspan x="10px" y="64px"><tspan>     Locking 0 packages to latest compatible versions</tspan>
+</tspan>
+    <tspan x="10px" y="82px"><tspan>note: Re-run with `--verbose --verbose` to show more dependencies</tspan>
+</tspan>
+    <tspan x="10px" y="100px"><tspan>  latest: serde</tspan>
+</tspan>
+    <tspan x="10px" y="118px">
+</tspan>
+  </text>
+
+</svg>
```

**File**: `tests/cargo-upgrade/upgrade_verbose_hint/stdout.term.svg` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+<svg width="740px" height="344px" xmlns="http://www.w3.org/2000/svg">
+  <style>
+    .fg { fill: #AAAAAA }
+    .bg { background: #000000 }
+    .container {
+      padding: 0 10px;
+      line-height: 18px;
+    }
+    tspan {
+      font: 14px SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
+      white-space: pre;
+      line-height: 18px;
+    }
+  </style>
+
+  <rect width="100%" height="100%" y="0" rx="4.5" class="bg" />
+
+  <text xml:space="preserve" class="container fg">
+    <tspan x="10px" y="28px"><tspan>name           old req compatible latest    new req  </tspan>
+</tspan>
+    <tspan x="10px" y="46px"><tspan>====           ======= ========== ======    =======  </tspan>
+</tspan>
+    <tspan x="10px" y="64px"><tspan>docopt         0.4     0.4.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="82px"><tspan>pad            0.1     0.1.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="100px"><tspan>serde_json     20.0    20.0.0     99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="118px"><tspan>syn            0.1.1   0.1.1      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="136px"><tspan>tar            0.4     0.4.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="154px"><tspan>ftp            20.0.0  20.0.0     99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="172px"><tspan>toml_edit (te) 0.1.1   0.1.1      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="190px"><tspan>semver         0.2     0.2.3      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="208px"><tspan>renamed (rn)   0.1     0.1.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="226px"><tspan>assert_cli     0.2.0   0.2.3      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="244px"><tspan>tempdir        0.1     0.1.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="262px"><tspan>openssl        0.4     0.4.1      99999.0.0 99999.0  </tspan>
+</tspan>
+    <tspan x="10px" y="280px"><tspan>rget           0.4.0   0.4.1      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="298px"><tspan>geo            0.2.0   0.2.3      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="316px"><tspan>ftp            0.2.0   0.2.3      99999.0.0 99999.0.0</tspan>
+</tspan>
+    <tspan x="10px" y="334px">
+</tspan>
+  </text>
+
+</svg>
```

---

### Incident Patch 3: `24d89e7a` (2026-07-14)
**Commit Message**: Merge pull request #967 from ychampion/fix/set-version-missing-package

fix(set-version): reject unmatched package selectors

**File**: `src/bin/set-version/set_version.rs` (modified, +17/-0)
```diff
@@ -119,6 +119,23 @@ fn exec(args: VersionArgs) -> CargoResult<()> {
     let root_manifest_path = ws_metadata.workspace_root.as_std_path().join("Cargo.toml");
     let workspace_members = find_ws_members(&ws_metadata);
 
+    let mut missing = Vec::new();
+    for name in &pkgid {
+        let name = name.as_str();
+        if !workspace_members
+            .iter()
+            .any(|package| package.name.as_str() == name)
+            && !missing.contains(&name)
+        {
+            missing.push(name);
+        }
+    }
+    match missing.len() {
+        0 => {}
+        1 => anyhow::bail!("package {} doesn't exist", missing.join(", ")),
+        _ => anyhow::bail!("packages {} don't exist", missing.join(", ")),
+    }
+
     if all {
         shell_warn("The flag `--all` has been deprecated in favor of `--workspace`")?;
     }
```

**File**: `tests/cargo-set-version/main.rs` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@
 mod downgrade_error;
 mod dry_run;
 mod ignore_dependent;
+mod package_not_found;
+mod package_not_found_mixed;
+mod package_not_found_repeated;
+mod packages_not_found;
 mod relative_absolute_conflict;
 mod set_absolute_version;
 mod set_absolute_workspace_version;
```

**File**: `tests/cargo-set-version/package_not_found/in/Cargo.toml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+[workspace]
+
+[package]
+name = "sample"
+version = "0.1.0"
+edition = "2015"
+
+[lib]
+path = "dummy.rs"
```

**File**: `tests/cargo-set-version/package_not_found/mod.rs` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+use cargo_test_support::Project;
+use cargo_test_support::compare::assert_ui;
+use cargo_test_support::current_dir;
+use cargo_test_support::file;
+use cargo_test_support::prelude::*;
+
+use crate::CargoCommand;
+
+#[cargo_test]
+fn case() {
+    let project = Project::from_template(current_dir!().join("in"));
+    let project_root = project.root();
+
+    snapbox::cmd::Command::cargo_ui()
+        .arg("set-version")
+        .args(["2.0.0", "--package", "missing"])
+        .current_dir(&project_root)
+        .assert()
+        .code(1)
+        .stdout_eq(file!["stdout.term.svg"])
+        .stderr_eq(file!["stderr.term.svg"]);
+
+    assert_ui().subset_matches(current_dir!().join("out"), &project_root);
+}
```

**File**: `tests/cargo-set-version/package_not_found/out/Cargo.toml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+[workspace]
+
+[package]
+name = "sample"
+version = "0.1.0"
+edition = "2015"
+
+[lib]
+path = "dummy.rs"
```

**File**: `tests/cargo-set-version/package_not_found/stderr.term.svg` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+<svg width="740px" height="56px" xmlns="http://www.w3.org/2000/svg">
+  <style>
+    .fg { fill: #AAAAAA }
+    .bg { fill: #000000 }
+    .container {
+      padding: 0 10px;
+      line-height: 18px;
+    }
+    tspan {
+      font: 14px SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
+      white-space: pre;
+      line-height: 18px;
+    }
+  </style>
+
+  <rect width="100%" height="100%" y="0" rx="4.5" class="bg" />
+
+  <text xml:space="preserve" class="container fg">
+    <tspan x="10px" y="28px"><tspan>Error: package missing doesn't exist</tspan>
+</tspan>
+    <tspan x="10px" y="46px">
+</tspan>
+  </text>
+
+</svg>
```

**File**: `tests/cargo-set-version/package_not_found/stdout.term.svg` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+<svg width="740px" height="20px" xmlns="http://www.w3.org/2000/svg">
+  <style>
+    .fg { fill: #AAAAAA }
+    .bg { fill: #000000 }
+    .container {
+      padding: 0 10px;
+      line-height: 18px;
+    }
+    tspan {
+      font: 14px SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
+      white-space: pre;
+      line-height: 18px;
+    }
+  </style>
+
+  <rect width="100%" height="100%" y="0" rx="4.5" class="bg" />
+
+  <text xml:space="preserve" class="container fg">
+  </text>
+
+</svg>
```

**File**: `tests/cargo-set-version/package_not_found_mixed/in/Cargo.toml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+[workspace]
+
+[package]
+name = "sample"
+version = "0.1.0"
+edition = "2015"
+
+[lib]
+path = "dummy.rs"
```

---

### Incident Patch 4: `b91afe9b` (2026-07-14)
**Commit Message**: fix(set-version): reject unmatched package selectors

**File**: `src/bin/set-version/set_version.rs` (modified, +17/-0)
```diff
@@ -119,6 +119,23 @@ fn exec(args: VersionArgs) -> CargoResult<()> {
     let root_manifest_path = ws_metadata.workspace_root.as_std_path().join("Cargo.toml");
     let workspace_members = find_ws_members(&ws_metadata);
 
+    let mut missing = Vec::new();
+    for name in &pkgid {
+        let name = name.as_str();
+        if !workspace_members
+            .iter()
+            .any(|package| package.name.as_str() == name)
+            && !missing.contains(&name)
+        {
+            missing.push(name);
+        }
+    }
+    match missing.len() {
+        0 => {}
+        1 => anyhow::bail!("package {} doesn't exist", missing.join(", ")),
+        _ => anyhow::bail!("packages {} don't exist", missing.join(", ")),
+    }
+
     if all {
         shell_warn("The flag `--all` has been deprecated in favor of `--workspace`")?;
     }
```

**File**: `tests/cargo-set-version/package_not_found/mod.rs` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ fn case() {
         .args(["2.0.0", "--package", "missing"])
         .current_dir(&project_root)
         .assert()
-        .code(0)
+        .code(1)
         .stdout_eq(file!["stdout.term.svg"])
         .stderr_eq(file!["stderr.term.svg"]);
 
```

**File**: `tests/cargo-set-version/package_not_found/stderr.term.svg` (modified, +5/-1)
```diff
@@ -1,4 +1,4 @@
-<svg width="740px" height="20px" xmlns="http://www.w3.org/2000/svg">
+<svg width="740px" height="56px" xmlns="http://www.w3.org/2000/svg">
   <style>
     .fg { fill: #AAAAAA }
     .bg { fill: #000000 }
@@ -16,6 +16,10 @@
   <rect width="100%" height="100%" y="0" rx="4.5" class="bg" />
 
   <text xml:space="preserve" class="container fg">
+    <tspan x="10px" y="28px"><tspan>Error: package missing doesn't exist</tspan>
+</tspan>
+    <tspan x="10px" y="46px">
+</tspan>
   </text>
 
 </svg>
```

**File**: `tests/cargo-set-version/package_not_found_mixed/mod.rs` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ fn case() {
         .args(["2.0.0", "--package", "sample", "--package", "missing"])
         .current_dir(&project_root)
         .assert()
-        .code(0)
+        .code(1)
         .stdout_eq(file!["stdout.term.svg"])
         .stderr_eq(file!["stderr.term.svg"]);
 
```

**File**: `tests/cargo-set-version/package_not_found_mixed/out/Cargo.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 [package]
 name = "sample"
-version = "2.0.0"
+version = "0.1.0"
 edition = "2015"
 
 [lib]
```

**File**: `tests/cargo-set-version/package_not_found_mixed/stderr.term.svg` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   <rect width="100%" height="100%" y="0" rx="4.5" class="bg" />
 
   <text xml:space="preserve" class="container fg">
-    <tspan x="10px" y="28px"><tspan>   Upgrading sample from 0.1.0 to 2.0.0</tspan>
+    <tspan x="10px" y="28px"><tspan>Error: package missing doesn't exist</tspan>
 </tspan>
     <tspan x="10px" y="46px">
 </tspan>
```

**File**: `tests/cargo-set-version/package_not_found_repeated/mod.rs` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ fn case() {
         .args(["2.0.0", "-p", "missing", "-p", "missing"])
         .current_dir(&project_root)
         .assert()
-        .code(0)
+        .code(1)
         .stdout_eq(file!["stdout.term.svg"])
         .stderr_eq(file!["stderr.term.svg"]);
 
```

**File**: `tests/cargo-set-version/package_not_found_repeated/stderr.term.svg` (modified, +5/-1)
```diff
@@ -1,4 +1,4 @@
-<svg width="740px" height="20px" xmlns="http://www.w3.org/2000/svg">
+<svg width="740px" height="56px" xmlns="http://www.w3.org/2000/svg">
   <style>
     .fg { fill: #AAAAAA }
     .bg { fill: #000000 }
@@ -16,6 +16,10 @@
   <rect width="100%" height="100%" y="0" rx="4.5" class="bg" />
 
   <text xml:space="preserve" class="container fg">
+    <tspan x="10px" y="28px"><tspan>Error: package missing doesn't exist</tspan>
+</tspan>
+    <tspan x="10px" y="46px">
+</tspan>
   </text>
 
 </svg>
```

---

### Incident Patch 5: `d0565444` (2026-05-28)
**Commit Message**: fix: Build without default features

**File**: `src/errors.rs` (modified, +1/-0)
```diff
@@ -52,6 +52,7 @@ impl From<anyhow::Error> for CliError {
     }
 }
 
+#[cfg(feature = "clap")]
 impl From<clap::Error> for CliError {
     fn from(err: clap::Error) -> CliError {
         #[allow(clippy::bool_to_int_with_if)]
```

---

### Incident Patch 6: `c1a882fa` (2026-03-02)
**Commit Message**: Merge pull request #958 from rmseq/rmseq/fix-silent-no-deps-fallback

fix: propagate cargo metada errors instead of silent --no-deps fallback

**File**: `src/bin/set-version/set_version.rs` (modified, +1/-4)
```diff
@@ -348,10 +348,7 @@ fn resolve_ws(
     }
     cmd.other_options(other);
 
-    let ws = cmd.exec().or_else(|_| {
-        cmd.no_deps();
-        cmd.exec()
-    })?;
+    let ws = cmd.exec()?;
     Ok(ws)
 }
 
```

---

### Incident Patch 7: `eab31121` (2026-03-02)
**Commit Message**: fix: propagate cargo metada errors instead of silent --no-deps fallback

resolve_ws() silently retries with --no-deps when cargo metadata fails.
This hides errors and causes set-version to skip lockfile updates without any indication of failure.

Remove the or_else fallback so errors propagate to the caller.

Fixes #891

**File**: `src/bin/set-version/set_version.rs` (modified, +1/-4)
```diff
@@ -348,10 +348,7 @@ fn resolve_ws(
     }
     cmd.other_options(other);
 
-    let ws = cmd.exec().or_else(|_| {
-        cmd.no_deps();
-        cmd.exec()
-    })?;
+    let ws = cmd.exec()?;
     Ok(ws)
 }
 
```

---

### Incident Patch 8: `5094a7fa` (2025-05-27)
**Commit Message**: fix: Don't upgrade excluded git dependencies

**File**: `src/bin/upgrade/upgrade.rs` (modified, +3/-1)
```diff
@@ -256,7 +256,9 @@ fn exec(args: UpgradeArgs) -> CargoResult<()> {
                     None => {
                         let maybe_reason = match dependency.source() {
                             Some(Source::Git(_)) => {
-                                git_crates.insert(dependency.name.clone());
+                                if reason.is_none() {
+                                    git_crates.insert(dependency.name.clone());
+                                }
                                 Some(Reason::GitSource)
                             }
                             Some(Source::Path(_)) => Some(Reason::PathSource),
```

---

### Incident Patch 9: `e25e2629` (2025-05-27)
**Commit Message**: fix: Log commands for better debugging

**File**: `src/bin/upgrade/upgrade.rs` (modified, +3/-0)
```diff
@@ -504,6 +504,7 @@ fn exec(args: UpgradeArgs) -> CargoResult<()> {
                     cmd.arg("--package").arg(dep);
                     // If we're going to request an update, it would have already been done by now
                     cmd.arg("--offline");
+                    log::trace!("Running {cmd:?}");
                     let output = cmd.output().context("failed to lock to precise version")?;
                     if !output.status.success() {
                         return Err(anyhow::format_err!(
@@ -547,6 +548,7 @@ fn exec(args: UpgradeArgs) -> CargoResult<()> {
             }
             // If we're going to request an update, it would have already been done by now
             cmd.arg("--offline");
+            log::trace!("Running {cmd:?}");
             let status = cmd.status().context("recursive dependency update failed")?;
             if !status.success() {
                 anyhow::bail!("recursive dependency update failed");
@@ -583,6 +585,7 @@ fn exec(args: UpgradeArgs) -> CargoResult<()> {
             // If we're going to request an update, it would have already been done by now
             cmd.arg("--offline");
             if still_run {
+                log::trace!("Running {cmd:?}");
                 let status = cmd.status().context("recursive dependency update failed")?;
                 if !status.success() {
                     anyhow::bail!("recursive dependency update failed");
```

---

### Incident Patch 10: `bbd8d50a` (2025-05-07)
**Commit Message**: fix(upgrade): Improve config error messages

Inspired by #933

**File**: `src/errors.rs` (modified, +0/-4)
```diff
@@ -78,10 +78,6 @@ pub(crate) fn non_existent_dependency_err(name: impl Display, table: impl Displa
     )
 }
 
-pub(crate) fn invalid_cargo_config() -> Error {
-    anyhow::format_err!("Invalid cargo config")
-}
-
 pub(crate) fn unsupported_version_req(req: impl Display) -> Error {
     anyhow::format_err!("Support for modifying {} is currently unsupported", req)
 }
```

**File**: `src/registry.rs` (modified, +6/-3)
```diff
@@ -13,9 +13,11 @@ pub fn registry_url(manifest_path: &Path, registry: Option<&str>) -> CargoResult
         registries: &mut HashMap<String, Source>,
         path: impl AsRef<Path>,
     ) -> CargoResult<()> {
+        let path = path.as_ref();
         // TODO unit test for source replacement
         let content = std::fs::read_to_string(path)?;
-        let config = toml::from_str::<CargoConfig>(&content).map_err(|_| invalid_cargo_config())?;
+        let config = toml::from_str::<CargoConfig>(&content)
+            .with_context(|| anyhow::format_err!("invalid cargo config at {}", path.display()))?;
         for (key, value) in config.registries {
             registries.entry(key).or_insert(Source {
                 registry: value.index,
@@ -89,8 +91,9 @@ pub fn registry_url(manifest_path: &Path, registry: Option<&str>) -> CargoResult
 
     let registry_url = source
         .registry
-        .and_then(|x| Url::parse(&x).ok())
-        .with_context(invalid_cargo_config)?;
+        .ok_or_else(|| anyhow::format_err!("missing `registry`"))?;
+    let registry_url = Url::parse(&registry_url)
+        .with_context(|| anyhow::format_err!("invalid `registry` field"))?;
 
     Ok(registry_url)
 }
```

---

### Incident Patch 11: `9bb832ed` (2025-05-01)
**Commit Message**: fix(upgrade): Report which crate failed to load

**File**: `src/index.rs` (modified, +12/-4)
```diff
@@ -31,7 +31,9 @@ impl IndexCache {
     /// Determines if the specified crate exists in the crates.io index
     #[inline]
     pub fn has_krate(&mut self, registry: &Url, name: &str) -> CargoResult<bool> {
-        self.index(registry)?.has_krate(name)
+        self.index(registry)
+            .with_context(|| format!("failed to look up {name}"))?
+            .has_krate(name)
     }
 
     /// Determines if the specified crate version exists in the crates.io index
@@ -42,17 +44,23 @@ impl IndexCache {
         name: &str,
         version: &str,
     ) -> CargoResult<Option<bool>> {
-        self.index(registry)?.has_krate_version(name, version)
+        self.index(registry)
+            .with_context(|| format!("failed to look up {name}@{version}"))?
+            .has_krate_version(name, version)
     }
 
     #[inline]
     pub fn update_krate(&mut self, registry: &Url, name: &str) -> CargoResult<()> {
-        self.index(registry)?.update_krate(name);
+        self.index(registry)
+            .with_context(|| format!("failed to look up {name}"))?
+            .update_krate(name);
         Ok(())
     }
 
     pub fn krate(&mut self, registry: &Url, name: &str) -> CargoResult<Option<IndexKrate>> {
-        self.index(registry)?.krate(name)
+        self.index(registry)
+            .with_context(|| format!("failed to look up {name}"))?
+            .krate(name)
     }
 
     fn index<'s>(&'s mut self, registry: &Url) -> CargoResult<&'s mut AnyIndexCache> {
```

---

### Incident Patch 12: `2a34f76b` (2025-05-01)
**Commit Message**: fix(upgrade): Report which registry failed

**File**: `src/index.rs` (modified, +6/-2)
```diff
@@ -116,9 +116,13 @@ enum AnyIndex {
 impl AnyIndex {
     fn open(url: &Url, certs_source: CertsSource) -> CargoResult<Self> {
         if url.scheme() == "file" {
-            LocalIndex::open(url).map(Self::Local)
+            LocalIndex::open(url)
+                .map(Self::Local)
+                .with_context(|| format!("invalid local registry {url:?}"))
         } else {
-            RemoteIndex::open(url, certs_source).map(Self::Remote)
+            RemoteIndex::open(url, certs_source)
+                .map(Self::Remote)
+                .with_context(|| format!("invalid registry {url:?}"))
         }
     }
 
```

---

### Incident Patch 13: `4886da56` (2025-05-01)
**Commit Message**: fix(upgrade): Be more specific in local registry errors

**File**: `src/index.rs` (modified, +2/-2)
```diff
@@ -139,9 +139,9 @@ impl LocalIndex {
     fn open(url: &Url) -> CargoResult<Self> {
         let path = url
             .to_file_path()
-            .map_err(|()| anyhow::format_err!("invalid local registry {url}"))?;
+            .map_err(|_err| anyhow::format_err!("invalid file path {url:?}"))?;
         let path = tame_index::PathBuf::from_path_buf(path)
-            .map_err(|_err| anyhow::format_err!("invalid local registry {url:?}"))?;
+            .map_err(|_err| anyhow::format_err!("invalid file path {url:?}"))?;
         let index = tame_index::index::LocalRegistry::open(path.clone(), false)?;
         Ok(Self { index, root: path })
     }
```

---

### Incident Patch 14: `15ab09ac` (2025-03-17)
**Commit Message**: fix(upgrade): Don't silence network errors

Fixes #924

**File**: `src/bin/upgrade/upgrade.rs` (modified, +13/-16)
```diff
@@ -6,7 +6,7 @@ use std::path::PathBuf;
 use anyhow::Context as _;
 use cargo_edit::{
     CargoResult, CertsSource, CrateSpec, Dependency, IndexCache, LocalManifest, RustVersion,
-    Source, get_compatible_dependency, get_latest_dependency, registry_url, set_dep_version,
+    Source, find_compatible_version, find_latest_version, registry_url, set_dep_version,
     shell_note, shell_status, shell_warn, shell_write_stdout,
 };
 use clap::Args;
@@ -290,33 +290,30 @@ fn exec(args: UpgradeArgs) -> CargoResult<()> {
                     // we're offline.
                     let registry_url = registry_url(&manifest_path, dependency.registry())?;
                     let index = index.index(&registry_url)?;
+                    let krate = index.krate(&dependency.name)?;
+                    let versions = krate
+                        .as_ref()
+                        .map(|k| k.versions.as_slice())
+                        .unwrap_or_default();
                     let is_prerelease = old_version_req.contains('-');
 
                     let latest_compatible = VersionReq::parse(&old_version_req)
                         .ok()
                         .and_then(|old_version_req| {
-                            get_compatible_dependency(
-                                &dependency.name,
-                                &old_version_req,
-                                rust_version,
-                                index,
-                            )
-                            .ok()
+                            find_compatible_version(versions, &old_version_req, rust_version)
                         })
                         .map(|d| {
                             d.version()
                                 .expect("registry packages always have a version")
                                 .to_owned()
                         });
 
-                    let latest_version =
-                        get_latest_dependency(&dependency.name, is_prerelease, rust_version, index)
-                            .ok()
-                            .map(|d| {
-                                d.version()
-                                    .expect("registry packages always have a version")
-                                    .to_owned()
-                            });
+                    let latest_version = find_latest_version(versions, is_prerelease, rust_version)
+                        .map(|d| {
+                            d.version()
+                                .expect("registry packages always have a version")
+                                .to_owned()
+                        });
 
                     let latest_incompatible = if latest_version != latest_compatible {
                         latest_version
```

**File**: `src/errors.rs` (modified, +0/-4)
```diff
@@ -66,10 +66,6 @@ impl From<std::io::Error> for CliError {
     }
 }
 
-pub(crate) fn no_crate_err(name: impl Display) -> Error {
-    anyhow::format_err!("The crate `{}` could not be found in registry index.", name)
-}
-
 pub(crate) fn non_existent_table_err(table: impl Display) -> Error {
     anyhow::format_err!("The table `{}` could not be found.", table)
 }
```

**File**: `src/fetch.rs` (modified, +22/-273)
```diff
@@ -1,67 +1,6 @@
-use super::AnyIndexCache;
 use super::Dependency;
 use super::RegistrySource;
 use super::VersionExt;
-use super::errors::*;
-
-/// Query latest version from a registry index
-///
-/// The registry argument must be specified for crates
-/// from alternative registries.
-///
-/// The latest version will be returned as a `Dependency`. This will fail, when
-///
-/// - there is no Internet connection and offline is false.
-/// - summaries in registry index with an incorrect format.
-/// - a crate with the given name does not exist on the registry.
-pub fn get_latest_dependency(
-    crate_name: &str,
-    flag_allow_prerelease: bool,
-    rust_version: Option<RustVersion>,
-    index: &mut AnyIndexCache,
-) -> CargoResult<Dependency> {
-    if crate_name.is_empty() {
-        anyhow::bail!("Found empty crate name");
-    }
-
-    let crate_versions = fuzzy_query_registry_index(crate_name, index)?;
-
-    let dep = find_latest_version(&crate_versions, flag_allow_prerelease, rust_version)
-        .ok_or_else(|| {
-            anyhow::format_err!(
-                "No available versions exist. Either all were yanked \
-                         or only prerelease versions exist. Trying with the \
-                         --allow-prerelease flag might solve the issue."
-            )
-        })?;
-
-    Ok(dep)
-}
-
-/// Find the highest version compatible with a version req
-pub fn get_compatible_dependency(
-    crate_name: &str,
-    version_req: &semver::VersionReq,
-    rust_version: Option<RustVersion>,
-    index: &mut AnyIndexCache,
-) -> CargoResult<Dependency> {
-    if crate_name.is_empty() {
-        anyhow::bail!("Found empty crate name");
-    }
-
-    let crate_versions = fuzzy_query_registry_index(crate_name, index)?;
-
-    let dep =
-        find_compatible_version(&crate_versions, version_req, rust_version).ok_or_else(|| {
-            anyhow::format_err!(
-                "No available versions exist. Either all were yanked \
-                         or only prerelease versions exist. Trying with the \
-                         --allow-prerelease flag might solve the issue."
-            )
-        })?;
-
-    Ok(dep)
-}
 
 /// Simplified represetation of `package.rust-version`
 #[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
@@ -143,252 +82,62 @@ impl From<&'_ semver::Version> for RustVersion {
     }
 }
 
-#[derive(Debug)]
-struct CrateVersion {
-    name: String,
-    version: semver::Version,
-    rust_version: Option<RustVersion>,
-    yanked: bool,
-}
-
-/// Fuzzy query crate from registry index
-fn fuzzy_query_registry_index(
-    crate_name: impl Into<String>,
-    index: &mut AnyIndexCache,
-) -> CargoResult<Vec<CrateVersion>> {
-    let crate_name = crate_name.into();
-    let mut names = gen_fuzzy_crate_names(crate_name.clone());
-    if let Some(index) = names.iter().position(|x| *x == crate_name) {
-        // ref: https://github.com/killercup/cargo-edit/pull/317#discussion_r307365704
-        names.swap(index, 0);
-    }
-
-    for the_name in names {
-        let krate = match index.krate(&the_name) {
-            Ok(Some(krate)) => krate,
-            _ => continue,
-        };
-        return krate
-            .versions
-            .iter()
-            .map(|v| {
-                Ok(CrateVersion {
-                    name: v.name.to_string(),
-                    version: v.version.as_str().parse()?,
-                    rust_version: v.rust_version.as_ref().map(|r| r.parse()).transpose()?,
-                    yanked: v.yanked,
-                })
-            })
-            .collect();
-    }
-    Err(no_crate_err(crate_name))
-}
-
-/// Generate all similar crate names
-///
-/// Examples:
-///
-/// | input | output |
-/// | ----- | ------ |
-/// | cargo | cargo  |
-/// | cargo-edit | cargo-edit, cargo_edit |
-/// | parking_lot_core | parking_lot_core, parking_lot-core, parking-lot_core, parking-lot-core |
-fn gen_fuzzy_crate_names(crate_name: String) -> Vec<String> {
-    const PATTERN: [u8; 2] = [b'-', b'_'];
-
-    let wildcard_indexs = crate_name
-        .bytes()
-        .enumerate()
-        .filter(|(_, item)| PATTERN.contains(item))
-        .map(|(index, _)| index)
-        .take(10)
-        .collect::<Vec<usize>>();
-    if wildcard_indexs.is_empty() {
-        return vec![crate_name];
-    }
-
-    let mut result = vec![];
-    let mut bytes = crate_name.into_bytes();
-    for mask in 0..2u128.pow(wildcard_indexs.len() as u32) {
-        for (mask_index, wildcard_index) in wildcard_indexs.iter().enumerate() {
-            let mask_value = (mask >> mask_index) & 1 == 1;
-            if mask_value {
-                bytes[*wildcard_index] = b'-';
-            } else {
-                bytes[*wildcard_index] = b'_';
-            }
-        }
-        result.push(String::from_utf8(bytes.clone()).unwrap());
-    }
-    result
-}
-
 // Checks whether a version object is a stable release
-fn version_is_stable(version: &CrateVer
```

**File**: `src/lib.rs` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ pub use dependency::PathSource;
 pub use dependency::RegistrySource;
 pub use dependency::Source;
 pub use errors::*;
-pub use fetch::{RustVersion, get_compatible_dependency, get_latest_dependency};
+pub use fetch::{RustVersion, find_compatible_version, find_latest_version};
 pub use index::*;
 pub use manifest::{LocalManifest, Manifest, find, get_dep_version, set_dep_version};
 pub use metadata::manifest_from_pkgid;
```

---

### Incident Patch 15: `0db0f9de` (2025-03-17)
**Commit Message**: fix(index): Don't error on non-existent local entries

**File**: `src/index.rs` (modified, +3/-1)
```diff
@@ -157,7 +157,9 @@ impl LocalIndex {
             .strip_prefix("index")
             .map_err(|_err| anyhow::format_err!("invalid index path {entry_path:?}"))?;
         let entry_path = self.root.join(rel_path);
-        let entry = std::fs::read(&entry_path)?;
+        let Ok(entry) = std::fs::read(&entry_path) else {
+            return Ok(None);
+        };
         let results = IndexKrate::from_slice(&entry)?;
         Ok(Some(results))
     }
```

#### Recent Merged Pull Requests:
- **PR #969** (2026-07-15): fix(upgrade): show the next effective verbosity (@ychampion)
- **PR #967** (2026-07-14): fix(set-version): reject unmatched package selectors (@ychampion)
- **PR #962** (2026-05-28): chore: Set and verify MSRV (@epage)
- **PR #960** (closed): fix: resolve registry auth tokens for cargo upgrade (@r0wdiggity)
- **PR #959** (2026-04-17): chore: Upgrade dependencies (@epage)
- **PR #958** (2026-03-02): fix: propagate cargo metada errors instead of silent --no-deps fallback (@rmseq)
- **PR #955** (2025-11-11): test: Resolve deprecations (@epage)
- **PR #954** (2025-11-11): chore: Update dependencies (@epage)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
