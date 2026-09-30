# Forensic Learning Record (Deep Inspection): arxanas/git-branchless

> **Canonical Artifact**: `07_PROJECT_LEARNING/arxanas-git-branchless-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arxanas/git-branchless](https://github.com/arxanas/git-branchless))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:23:32.067Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arxanas/git-branchless`
- **Description**: High-velocity, monorepo-scale workflow for Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4131 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `git-branchless-hook/src/lib.rs`
```
//! Callbacks for Git hooks.
//!
//! Git uses "hooks" to run user-defined scripts after certain events. We
//! extensively use these hooks to track user activity and e.g. decide if a
//! commit should be considered obsolete.
//!
//! The hooks are installed by the `branchless init` command. This module
//! contains the implementations for the hooks.

#![warn(missing_docs)]
#![warn(
    clippy::all,
    clippy::as_conversions,
    clippy::clone_on_ref_ptr,
    clippy::dbg_macro
)]
#![allow(clippy::too_many_arguments, clippy::blocks_in_conditions)]

use std::fmt::Write;
use std::fs::File;
use std::io::{BufRead, stdin};
use std::time::SystemTime;

use eyre::Context;
use git_branchless_invoke::CommandContext;
use git_branchless_opts::{HookArgs, HookSubcommand};
use itertools::Itertools;
use lib::core::dag::Dag;
use lib::core::repo_ext::RepoExt;
use lib::core::rewrite::rewrite_hooks::get_deferred_commits_path;
use lib::util::EyreExitOr;
use tracing::{error, instrument, warn};

use lib::core::eventlog::{Event, EventLogDb, EventReplayer, should_ignore_ref_updates};
use lib::core::formatting::{Glyphs, Pluralize};
use lib::core::gc::{gc, mark_commit_reachable};
use lib::git::{CategorizedReferenceName, MaybeZeroOid, NonZeroOid, ReferenceName, Repo};

use lib::core::effects::Effects;
pub use lib::core::rewrite::rewrite_hooks::{
    hook_drop_commit_if_empty, hook_post_rewrite, hook_register_extra_post_rewrite_hook,
    hook_skip_upstream_applied_commit,
};

/// Handle Git's `post-checkout` hook.
///
/// See the man-page for `githooks(5)`.
#[instrument]
fn hook_post_checkout(
    effects: &Effects,
    previous_head_oid: &str,
    current_head_oid: &str,
    is_branch_checkout: isize,
) -> eyre::Result<()> {
    if is_branch_checkout == 0 {
        return Ok(());
    }

    let now = SystemTime::now();
    let timestamp = now.duration_since(SystemTime::UNIX_EPOCH)?;
    writeln!(
        effects.get_output_stream(),
        "branchless: processing checkout"
    )?;

    let repo = Repo::from_current_dir()?;
    let conn = repo.get_db_conn()?;
    let event_log_db = EventLogDb::new(&conn)?;
    let event_tx_id = event_log_db.make_transaction_id(now, "hook-post-checkout")?;
    event_log_db.add_events(vec![Event::RefUpdateEvent {
        timestamp: timestamp.as_secs_f64(),
        event_tx_id,
        old_oid: previous_head_oid.parse()?,
        new_oid: {
            let oid: MaybeZeroOid = current_head_oid.parse()?;
            oid
        },
        ref_name: ReferenceName::from("HEAD"),
        message: None,
    }])?;
    Ok(())
}

fn hook_post_commit_common(effects: &Effects, hook_name: &str) -> eyre::Result<()> {
    let now = SystemTime::now();
    let glyphs = Glyphs::detect();
    let repo = Repo::from_current_dir()?;
    let conn = repo.get_db_conn()?;
    let event_log_db = EventLogDb::new(&conn)?;

    let commit_oid = match repo.get_head_info()?.oid {
        Some(commit_oid) => commit_oid,
        None => {
            // A strange situation, but technically possible.
            warn!(
                "`{}` hook called, but could not determine the OID of `HEAD`",
                hook_name
            );
            return Ok(());
        }
    };

    let commit = repo
        .find_commit_or_fail(commit_oid)
        .wrap_err("Looking up `HEAD` commit")?;
    mark_commit_reachable(&repo, commit_oid)
        .wrap_err("Marking commit as reachable for GC purposes")?;

    let event_replayer = EventReplayer::from_event_log_db(effects, &repo, &event_log_db)?;
    let event_cursor = event_replayer.make_default_cursor();
    let references_snapshot = repo.get_references_snapshot()?;
    Dag::open_and_sync(
        effects,
        &repo,
        &event_replayer,
        event_cursor,
        &references_snapshot,
    )?;

    if repo.is_rebase_underway()? {
        let deferred_commits_path = get_deferred_commits_path(&repo);
        let mut deferred_commits_file = File::options()
            .create(true)
            .append(true)
            .open(&deferred_commits_path)
            .with_context(|| {
                format!("Opening deferred commits file at {deferred_commits_path:?}")
            })?;

        use std::io::Write;
        writeln!(deferred_commits_file, "{commit_oid}")?;
        return Ok(());
    }

    let timestamp = commit.get_time().to_system_time()?;

    // Potentially lossy conversion. The semantics are to round to the nearest
    // possible float:
    // https://doc.rust-lang.org/reference/expressions/operator-expr.html#semantics.
    // We don't rely on the timestamp's correctness for anything, so this is
    // okay.
    let timestamp = timestamp
        .duration_since(SystemTime::UNIX_EPOCH)?
        .as_secs_f64();

    let event_tx_id = event_log_db.make_transaction_id(now, hook_name)?;
    event_log_db.add_events(vec![Event::CommitEvent {
        timestamp,
        event_tx_id,
        commit_oid: commit.get_oid(),
    }])?;
    writeln!(
        effects.get_output_stream(),
        "branchless: processed commit: {}",
        glyphs.render(commit.friendly_describe(&glyphs)?)?,
    )?;

    Ok(())
}

/// Handle Git's `post-commit` hook.
///
/// See the man-page for `githooks(5)`.
#[instrument]
fn hook_post_commit(effects: &Effects) -> eyre::Result<()> {
    hook_post_commit_common(effects, "post-commit")
}

/// Handle Git's `post-merge` hook. It seems that Git doesn't invoke the
/// `post-commit` hook after a merge commit, so we need to handle this case
/// explicitly with another hook.
///
/// See the man-page for `githooks(5)`.
#[instrument]
fn hook_post_merge(effects: &Effects, _is_squash_merge: isize) -> eyre::Result<()> {
    hook_post_commit_common(effects, "post-merge")
}

/// Handle Git's `post-applypatch` hook.
///
/// See the man-page for `githooks(5)`.
#[instrument]
fn hook_post_applypatch(effects: &Effects) -> eyre::Result<()> {
    hook_post_commit_common(effects, "post-applypatch")
}

mod reference_transaction {
    use std::collections::HashMap;
    use std::fs::File;
    use std::io::{BufRead, BufReader};
    use std::str::FromStr;

    use eyre::Context;
    use itertools::Itertools;
    use lazy_static::lazy_static;
    use tracing::{instrument, warn};

    use lib::git::{MaybeZeroOid, ReferenceName, Repo};

    /// A reference target parsed from a reference line.
    #[derive(Clone, Debug, PartialEq, Eq)]
    pub enum ReferenceTarget {
        /// A reference target that was in the transaction line as a normal commit hash.
        Direct { oid: MaybeZeroOid },

        /// A reference target that was in the transaction line as a symbolic
        /// reference: `ref:<refname>`.
        Symbolic { name: ReferenceName },
    }

    impl ReferenceTarget {
        /// Attempt to convert the provided reference target into an OID hash value.
        ///
        /// For [ReferenceTarget::Direct] types, this always succeeds, and just
        /// returns the wrapped OID.
        ///
        /// For [ReferenceTarget::Symbolic] types, this attempts to convert the
        /// provided symbolic ref name into an OID hash using the provided
        /// [Repo].
        #[instrument]
        pub fn as_oid(&self, repo: &Repo) -> eyre::Result<MaybeZeroOid> {
            match self {
                ReferenceTarget::Direct { oid } => Ok(*oid),
                ReferenceTarget::Symbolic { name } => Ok(repo.reference_name_to_oid(name)?),
            }
        }
    }

    impl FromStr for ReferenceTarget {
        type Err = eyre::ErrReport;

        /// Attempts to parse a string as a [ReferenceTarget].
        /// The string is expected to be one field from a reference transaction
        /// line, which can be one of the following values:
        ///
        /// - `ref:<symbolic ref name>`
        /// - `<commit hash>`
        fn from_str(value: &str) -> Result<Self, Self::Err> {
            match value.strip_prefix("ref:") {
                Some(refname) => Ok(ReferenceTarget::Symbolic {
                    name: Refer
```

### Core Architecture Module: `git-branchless-hook/src/main.rs`
```
fn main() {
    git_branchless_invoke::invoke_subcommand_main(git_branchless_hook::command_main)
}

```

### Core Architecture Module: `git-branchless-init/src/lib.rs`
```
//! Install any hooks, aliases, etc. to set up `git-branchless` in this repo.

#![warn(missing_docs)]
#![warn(
    clippy::all,
    clippy::as_conversions,
    clippy::clone_on_ref_ptr,
    clippy::dbg_macro
)]
#![allow(clippy::too_many_arguments, clippy::blocks_in_conditions)]

use std::fmt::Write;
use std::io::{BufRead, BufReader, Write as WriteIo, stdin, stdout};
use std::path::{Path, PathBuf};

use console::style;
use eyre::Context;
use git_branchless_invoke::CommandContext;
use itertools::Itertools;
use lib::core::config::env_vars::should_use_separate_command_binary;
use lib::util::EyreExitOr;
use path_slash::PathExt;
use tracing::{instrument, warn};

use git_branchless_opts::{InitArgs, InstallManPagesArgs, write_man_pages};
use lib::core::config::{
    get_default_branch_name, get_default_hooks_dir, get_main_worktree_hooks_dir,
};
use lib::core::dag::Dag;
use lib::core::effects::Effects;
use lib::core::eventlog::{EventLogDb, EventReplayer};
use lib::core::repo_ext::RepoExt;
use lib::git::{BranchType, Config, ConfigRead, ConfigWrite, GitRunInfo, GitVersion, Repo};

/// The contents of all Git hooks to install.
pub const ALL_HOOKS: &[(&str, &str)] = &[
    (
        "post-applypatch",
        r#"
git branchless hook post-applypatch "$@"
"#,
    ),
    (
        "post-checkout",
        r#"
git branchless hook post-checkout "$@"
"#,
    ),
    (
        "post-commit",
        r#"
git branchless hook post-commit "$@"
"#,
    ),
    (
        "post-merge",
        r#"
git branchless hook post-merge "$@"
"#,
    ),
    (
        "post-rewrite",
        r#"
git branchless hook post-rewrite "$@"
"#,
    ),
    (
        "pre-auto-gc",
        r#"
git branchless hook pre-auto-gc "$@"
"#,
    ),
    (
        "reference-transaction",
        r#"
# Avoid canceling the reference transaction in the case that `branchless` fails
# for whatever reason.
git branchless hook reference-transaction "$@" || (
echo 'branchless: Failed to process reference transaction!'
echo 'branchless: Some events (e.g. branch updates) may have been lost.'
echo 'branchless: This is a bug. Please report it.'
)
"#,
    ),
];

const ALL_ALIASES: &[(&str, &str)] = &[
    ("amend", "amend"),
    ("hide", "hide"),
    ("move", "move"),
    ("next", "next"),
    ("prev", "prev"),
    ("query", "query"),
    ("record", "record"),
    ("restack", "restack"),
    ("reword", "reword"),
    ("sl", "smartlog"),
    ("split", "split"),
    ("smartlog", "smartlog"),
    ("submit", "submit"),
    ("sw", "switch"),
    ("sync", "sync"),
    ("test", "test"),
    ("undo", "undo"),
    ("unhide", "unhide"),
];

/// A specification for installing a Git hook on disk.
#[derive(Debug)]
pub enum Hook {
    /// Regular Git hook.
    RegularHook {
        /// The path to the hook script.
        path: PathBuf,
    },

    /// For Twitter multihooks. (But does anyone even work at Twitter anymore?)
    MultiHook {
        /// The path to the hook script.
        path: PathBuf,
    },
}

/// Determine the path where all hooks are installed.
#[instrument]
pub fn determine_hook_path(repo: &Repo, hooks_dir: &Path, hook_type: &str) -> eyre::Result<Hook> {
    let multi_hooks_path = repo.get_path().join("hooks_multi");
    let hook = if multi_hooks_path.exists() {
        let path = multi_hooks_path
            .join(format!("{hook_type}.d"))
            .join("00_local_branchless");
        Hook::MultiHook { path }
    } else {
        let path = hooks_dir.join(hook_type);
        Hook::RegularHook { path }
    };
    Ok(hook)
}

const SHEBANG: &str = "#!/bin/sh";
const UPDATE_MARKER_START: &str = "## START BRANCHLESS CONFIG";
const UPDATE_MARKER_END: &str = "## END BRANCHLESS CONFIG";

fn append_hook(new_lines: &mut String, hook_contents: &str) {
    new_lines.push_str(UPDATE_MARKER_START);
    new_lines.push('\n');
    new_lines.push_str(hook_contents);
    new_lines.push_str(UPDATE_MARKER_END);
    new_lines.push('\n');
}

fn update_between_lines(lines: &str, updated_lines: &str) -> String {
    let mut new_lines = String::new();
    let mut found_marker = false;
    let mut is_ignoring_lines = false;
    for line in lines.lines() {
        if line == UPDATE_MARKER_START {
            found_marker = true;
            is_ignoring_lines = true;
            append_hook(&mut new_lines, updated_lines);
        } else if line == UPDATE_MARKER_END {
            is_ignoring_lines = false;
        } else if !is_ignoring_lines {
            new_lines.push_str(line);
            new_lines.push('\n');
        }
    }
    if is_ignoring_lines {
        warn!("Unterminated branchless config comment in hook");
    } else if !found_marker {
        append_hook(&mut new_lines, updated_lines);
    }
    new_lines
}

#[instrument]
fn write_script(path: &Path, contents: &str) -> eyre::Result<()> {
    let script_dir = path
        .parent()
        .ok_or_else(|| eyre::eyre!("No parent for dir {:?}", path))?;
    std::fs::create_dir_all(script_dir).wrap_err("Creating script dir")?;

    let contents = if should_use_separate_command_binary("hook") {
        contents.replace("branchless hook", "branchless-hook")
    } else {
        contents.to_string()
    };
    std::fs::write(path, contents).wrap_err("Writing script contents")?;

    // Setting hook file as executable only supported on Unix systems.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(path).wrap_err("Reading script permissions")?;
        let mut permissions = metadata.permissions();
        let mode = permissions.mode();
        // Set execute bits.
        let mode = mode | 0o111;
        permissions.set_mode(mode);
        std::fs::set_permissions(path, permissions)
            .wrap_err_with(|| format!("Marking {path:?} as executable"))?;
    }

    Ok(())
}

#[instrument]
fn update_hook_contents(hook: &Hook, hook_contents: &str) -> eyre::Result<()> {
    let (hook_path, hook_contents) = match hook {
        Hook::RegularHook { path } => match std::fs::read_to_string(path) {
            Ok(lines) => {
                let lines = update_between_lines(&lines, hook_contents);
                (path, lines)
            }
            Err(ref err) if err.kind() == std::io::ErrorKind::NotFound => {
                let hook_contents = format!(
                    "{SHEBANG}\n{UPDATE_MARKER_START}\n{hook_contents}\n{UPDATE_MARKER_END}\n"
                );
                (path, hook_contents)
            }
            Err(other) => {
                return Err(eyre::eyre!(other));
            }
        },
        Hook::MultiHook { path } => (path, format!("{SHEBANG}\n{hook_contents}")),
    };

    write_script(hook_path, &hook_contents).wrap_err("Writing hook script")?;

    Ok(())
}

#[instrument]
fn install_hook(
    repo: &Repo,
    hooks_dir: &Path,
    hook_type: &str,
    hook_script: &str,
) -> eyre::Result<()> {
    let hook = determine_hook_path(repo, hooks_dir, hook_type)?;
    update_hook_contents(&hook, hook_script)?;
    Ok(())
}

#[instrument]
fn install_hooks(effects: &Effects, git_run_info: &GitRunInfo, repo: &Repo) -> eyre::Result<()> {
    writeln!(
        effects.get_output_stream(),
        "Installing hooks: {}",
        ALL_HOOKS
            .iter()
            .map(|(hook_type, _hook_script)| hook_type)
            .join(", ")
    )?;
    let hooks_dir = get_main_worktree_hooks_dir(git_run_info, repo, None)?;
    for (hook_type, hook_script) in ALL_HOOKS {
        install_hook(repo, &hooks_dir, hook_type, hook_script)?;
    }

    let default_hooks_dir = get_default_hooks_dir(repo)?;
    if hooks_dir != default_hooks_dir {
        writeln!(
            effects.get_output_stream(),
            "\
{}: the configuration value core.hooksPath was set to: {},
which is not the expected default value of: {}
The Git hooks above may have been installed to an unexpected global location.",
            style("Warning").yellow().bold(),
            hooks_dir.to_string_lossy(),
            default_ho
```

### Core Architecture Module: `git-branchless-init/src/main.rs`
```
fn main() {
    git_branchless_invoke::invoke_subcommand_main(git_branchless_init::command_main)
}

```

### Core Architecture Module: `git-branchless-invoke/src/lib.rs`
```
//! This crate is used to invoke `git-branchless` either directly via a
//! subcommand (such as `git-branchless foo`) or via an entirely separate
//! executable (such as `git-branchless-foo`). The objective is to improve
//! developer iteration times by allowing them to build and test a single
//! subcommand in isolation.

#![warn(missing_docs)]
#![warn(
    clippy::all,
    clippy::as_conversions,
    clippy::clone_on_ref_ptr,
    clippy::dbg_macro
)]
#![allow(clippy::too_many_arguments, clippy::blocks_in_conditions)]

use std::any::Any;
use std::collections::HashMap;
use std::ffi::OsString;
use std::fmt::Write;
use std::path::PathBuf;
use std::time::SystemTime;

use clap::{CommandFactory, FromArgMatches, Parser};
use cursive_core::theme::BaseColor;
use cursive_core::utils::markup::StyledString;
use eyre::Context;
use git_branchless_opts::{ColorSetting, GlobalArgs};
use lib::core::config::env_vars::{get_git_exec_path, get_path_to_git};
use lib::core::effects::Effects;
use lib::core::formatting::Glyphs;
use lib::git::GitRunInfo;
use lib::git::{Repo, RepoError};
use lib::util::{ExitCode, EyreExitOr};
use tracing::level_filters::LevelFilter;
use tracing::{info, instrument, warn};
use tracing_chrome::ChromeLayerBuilder;
use tracing_error::ErrorLayer;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::fmt as tracing_fmt;
use tracing_subscriber::prelude::*;

/// Shared context for all commands.
#[derive(Clone, Debug)]
pub struct CommandContext {
    /// The `Effects` to use.
    pub effects: Effects,

    /// Information about the Git executable currently being used.
    pub git_run_info: GitRunInfo,
}

#[must_use = "This function returns a guard object to flush traces. Dropping it immediately is probably incorrect. Make sure that the returned value lives until tracing has finished."]
#[instrument]
fn install_tracing(effects: Effects) -> eyre::Result<impl Drop> {
    let env_filter = EnvFilter::builder()
        .with_default_directive(LevelFilter::WARN.into())
        .parse(std::env::var(EnvFilter::DEFAULT_ENV).unwrap_or_else(|_|
                // Limit to first-party logs by default in case third-party
                // packages log spuriously. See
                // https://discord.com/channels/968932220549103686/968932220549103689/1077096194276339772
                "git_branchless=warn".to_string()))?;
    let fmt_layer = tracing_fmt::layer().with_writer(move || effects.clone().get_error_stream());

    let (profile_layer, flush_guard): (_, Box<dyn Any>) = {
        // We may invoke a hook that calls back into `git-branchless`. In that case,
        // we have to be careful not to write to the same logging file.
        const NESTING_LEVEL_KEY: &str = "RUST_LOGGING_NESTING_LEVEL";
        let nesting_level = match std::env::var(NESTING_LEVEL_KEY) {
            Ok(nesting_level) => nesting_level.parse::<usize>().unwrap_or_default(),
            Err(_) => 0,
        };
        // SAFETY: We're setting an environment variable that we control and read immediately
        // after. This is done at the start of execution before any threading occurs.
        unsafe {
            std::env::set_var(NESTING_LEVEL_KEY, (nesting_level + 1).to_string());
        }

        let should_include_function_args = match std::env::var("RUST_PROFILE_INCLUDE_ARGS") {
            Ok(value) if !value.is_empty() => true,
            Ok(_) | Err(_) => false,
        };

        let filename = match std::env::var("RUST_PROFILE") {
            Ok(value) if value == "1" || value == "true" => {
                let filename = format!(
                    "trace-{}.json-{}",
                    SystemTime::now()
                        .duration_since(SystemTime::UNIX_EPOCH)?
                        .as_secs(),
                    nesting_level,
                );
                Some(filename)
            }
            Ok(value) if !value.is_empty() => Some(format!("{value}-{nesting_level}")),
            Ok(_) | Err(_) => None,
        };

        match filename {
            Some(filename) => {
                let (layer, flush_guard) = ChromeLayerBuilder::new()
                    .file(filename)
                    .include_args(should_include_function_args)
                    .build();
                (Some(layer), Box::new(flush_guard))
            }
            None => {
                struct TrivialDrop;
                (None, Box::new(TrivialDrop))
            }
        }
    };

    tracing_subscriber::registry()
        .with(ErrorLayer::default())
        .with(fmt_layer.with_filter(env_filter))
        .with(profile_layer)
        .try_init()?;

    Ok(flush_guard)
}

#[instrument]
fn install_libgit2_tracing() {
    fn git_trace(level: git2::TraceLevel, msg: &[u8]) {
        info!("[{:?}]: {}", level, String::from_utf8_lossy(msg));
    }

    if let Err(err) = git2::trace_set(git2::TraceLevel::Trace, git_trace) {
        warn!("Failed to install libgit2 tracing: {err}");
    }
}

#[instrument]
fn check_unsupported_config_options(effects: &Effects) -> eyre::Result<Option<ExitCode>> {
    let _repo = match Repo::from_current_dir() {
        Ok(repo) => repo,
        Err(RepoError::UnsupportedExtensionWorktreeConfig(_)) => {
            writeln!(
                effects.get_output_stream(),
                "\
{error}

Usually, this configuration setting is enabled when initializing a sparse
checkout. See https://github.com/arxanas/git-branchless/issues/278 for more
information.

Here are some options:

- To unset the configuration option, run: git config --unset extensions.worktreeConfig
  - This is safe unless you created another worktree also using a sparse checkout.
- Try upgrading to Git v2.36+ and reinitializing your sparse checkout.",
                error = effects.get_glyphs().render(StyledString::styled(
                    "\
Error: the Git configuration setting `extensions.worktreeConfig` is enabled in
this repository. Due to upstream libgit2 limitations, git-branchless does not
support repositories with this configuration option enabled.",
                    BaseColor::Red.light()
                ))?,
            )?;
            return Ok(Some(ExitCode(1)));
        }
        Err(_) => return Ok(None),
    };

    Ok(None)
}

/// Wrapper function for `main` to ensure that `Drop` is called for local
/// variables, since `std::process::exit` will skip them. You probably want to
/// call `invoke_subcommand_main` instead.
#[instrument(skip(f))]
pub fn do_main_and_drop_locals<T: Parser>(
    f: impl Fn(CommandContext, T) -> EyreExitOr<()>,
    args: Vec<OsString>,
) -> eyre::Result<i32> {
    let command = GlobalArgs::command();
    let command_args = T::parse_from(&args);
    let matches = command.ignore_errors(true).get_matches_from(&args);
    let GlobalArgs {
        working_directory,
        color,
    } = GlobalArgs::from_arg_matches(&matches)
        .map_err(|err| eyre::eyre!("Could not parse global arguments: {err}"))?;

    if let Some(working_directory) = working_directory {
        std::env::set_current_dir(&working_directory).wrap_err_with(|| {
            format!(
                "Could not set working directory to: {:?}",
                &working_directory
            )
        })?;
    }

    let path_to_git = get_path_to_git().unwrap_or_else(|_| PathBuf::from("git"));
    let path_to_git = PathBuf::from(&path_to_git);
    let git_run_info = GitRunInfo {
        path_to_git,
        working_directory: std::env::current_dir()?,
        env: {
            let mut env: HashMap<OsString, OsString> = std::env::vars_os().collect();
            if let Ok(git_exec_path) = get_git_exec_path() {
                env.entry("GIT_EXEC_PATH".into())
                    .or_insert(git_exec_path.into());
            }
            env
        },
    };

    let color = match color {
        Some(ColorSetting::Always) => Glyphs::pretty(),
        Some(ColorSetting::Never) => Glyphs::text(),
        Some(ColorSetting::Auto) | None => Glyphs::detect(),

```

### Core Architecture Module: `git-branchless-lib/benches/benches.rs`
```
use std::collections::HashSet;
use std::path::PathBuf;

use branchless::core::dag::{CommitSet, Dag};
use branchless::core::effects::Effects;
use branchless::core::eventlog::{EventLogDb, EventReplayer};
use branchless::core::formatting::Glyphs;
use branchless::core::repo_ext::RepoExt;
use branchless::core::rewrite::{
    BuildRebasePlanOptions, RebasePlanBuilder, RebasePlanPermissions, RepoResource,
};
use branchless::git::{CherryPickFastOptions, Commit, Diff, Repo};
use criterion::{BatchSize, Criterion, criterion_group, criterion_main};
use rayon::ThreadPoolBuilder;

fn get_repo() -> Repo {
    let repo_dir =
        std::env::var("PATH_TO_REPO").expect("`PATH_TO_REPO` environment variable not set");
    Repo::from_dir(&PathBuf::from(repo_dir)).unwrap()
}

fn nth_parent(commit: Commit, n: usize) -> Commit {
    let mut commit = commit.clone();
    for _i in 0..n {
        commit = match commit.get_parents().first() {
            Some(commit) => commit.clone(),
            None => panic!("Couldn't find parent of: {commit:?}"),
        }
    }
    commit
}

fn bench_rebase_plan(c: &mut Criterion) {
    c.bench_function("RebasePlanBuilder::build", |b| {
        let repo = get_repo();
        let references_snapshot = repo.get_references_snapshot().unwrap();
        let head_oid = repo.get_head_info().unwrap().oid.unwrap();
        let later_commit = nth_parent(repo.find_commit_or_fail(head_oid).unwrap(), 20);
        let earlier_commit = nth_parent(later_commit.clone(), 1000);
        println!("Comparing {:?} with {:?}", &earlier_commit, &later_commit);

        let effects = Effects::new_suppress_for_test(Glyphs::text());
        let conn = repo.get_db_conn().unwrap();
        let event_log_db = EventLogDb::new(&conn).unwrap();
        let event_replayer =
            EventReplayer::from_event_log_db(&effects, &repo, &event_log_db).unwrap();
        let event_cursor = event_replayer.make_default_cursor();
        let dag = Dag::open_and_sync(
            &effects,
            &repo,
            &event_replayer,
            event_cursor,
            &references_snapshot,
        )
        .unwrap();
        let pool = ThreadPoolBuilder::new().build().unwrap();
        let repo_pool = RepoResource::new_pool(&repo).unwrap();

        let build_options = BuildRebasePlanOptions {
            force_rewrite_public_commits: true,
            dump_rebase_constraints: false,
            dump_rebase_plan: false,
            detect_duplicate_commits_via_patch_id: true,
        };
        let permissions = RebasePlanPermissions::verify_rewrite_set(
            &dag,
            build_options,
            &CommitSet::from(later_commit.get_oid()),
        )
        .unwrap()
        .unwrap();
        let mut builder = RebasePlanBuilder::new(&dag, permissions);
        builder
            .move_subtree(later_commit.get_oid(), vec![earlier_commit.get_oid()])
            .unwrap();
        b.iter_batched(
            || builder.clone(),
            |builder| {
                builder
                    .build(&effects, &pool, &repo_pool)
                    .unwrap()
                    .unwrap()
                    .unwrap()
            },
            BatchSize::PerIteration,
        )
    });
}

fn bench_cherry_pick_fast(c: &mut Criterion) {
    let mut group = c.benchmark_group("cherry-pick");
    group.sample_size(10);
    group.bench_function("Repo::cherry_pick_commit", |b| {
        let repo = get_repo();
        let head_oid = repo.get_head_info().unwrap().oid.unwrap();
        let head_commit = repo.find_commit_or_fail(head_oid).unwrap();
        let target_commit = nth_parent(head_commit.clone(), 1);

        b.iter(|| {
            let mut index = repo
                .cherry_pick_commit(&head_commit, &target_commit, 0)
                .unwrap();
            let tree_oid = repo.write_index_to_tree(&mut index).unwrap();
            repo.find_tree(tree_oid).unwrap().unwrap()
        })
    });
    group.bench_function("Repo::cherry_pick_fast", |b| {
        let repo = get_repo();
        let head_oid = repo.get_head_info().unwrap().oid.unwrap();
        let head_commit = repo.find_commit_or_fail(head_oid).unwrap();
        let target_commit = nth_parent(head_commit.clone(), 1);

        b.iter(|| {
            repo.cherry_pick_fast(
                &head_commit,
                &target_commit,
                &CherryPickFastOptions {
                    reuse_parent_tree_if_possible: false,
                },
            )
            .unwrap();
        });
    });
}

fn bench_diff_fast(c: &mut Criterion) {
    let mut group = c.benchmark_group("diff");
    group.sample_size(10);
    group.bench_function("git2::Repository::diff_tree_to_tree", |b| {
        let repo = get_repo();
        let repo = git2::Repository::open(repo.get_path()).unwrap();
        let commit = repo.head().unwrap().peel_to_commit().unwrap();

        b.iter(|| -> git2::Diff {
            repo.diff_tree_to_tree(
                Some(&commit.tree().unwrap()),
                Some(&commit.parent(0).unwrap().tree().unwrap()),
                None,
            )
            .unwrap()
        })
    });

    group.bench_function("Repo::get_patch_for_commit", |b| {
        let repo = get_repo();
        let oid = repo.get_head_info().unwrap().oid.unwrap();
        let commit = repo.find_commit_or_fail(oid).unwrap();
        let effects = Effects::new_suppress_for_test(Glyphs::text());

        b.iter(|| -> Option<Diff> { repo.get_patch_for_commit(&effects, &commit).unwrap() });
    });
}

fn bench_get_paths_touched_by_commits(c: &mut Criterion) {
    c.bench_function("Repo::get_paths_touched_by_commit", |b| {
        let repo = get_repo();
        let oid = repo.get_head_info().unwrap().oid.unwrap();
        let commit = repo.find_commit_or_fail(oid).unwrap();

        b.iter(|| -> HashSet<PathBuf> { repo.get_paths_touched_by_commit(&commit).unwrap() });
    });
}

criterion_group!(
    name = benches;
    config = Criterion::default().sample_size(10);
    targets =
        bench_cherry_pick_fast,
        bench_diff_fast,
        bench_get_paths_touched_by_commits,
        bench_rebase_plan,
);
criterion_main!(benches);

```

### Core Architecture Module: `git-branchless-lib/src/core/check_out.rs`
```
//! Handle checking out commits on disk.

use std::ffi::{OsStr, OsString};
use std::fmt::Write;
use std::time::{SystemTime, UNIX_EPOCH};

use cursive::theme::BaseColor;
use cursive::utils::markup::StyledString;
use eyre::Context;
use itertools::Itertools;
use tracing::instrument;

use crate::core::config::get_auto_switch_branches;
use crate::git::{
    CategorizedReferenceName, GitRunInfo, MaybeZeroOid, NonZeroOid, ReferenceName, Repo, Stage,
    UpdateIndexCommand, WorkingCopySnapshot, update_index,
};
use crate::try_exit_code;
use crate::util::EyreExitOr;

use super::config::get_undo_create_snapshots;
use super::effects::Effects;
use super::eventlog::{Event, EventLogDb, EventTransactionId};
use super::repo_ext::{RepoExt, RepoReferencesSnapshot};

/// An entity to check out.
#[derive(Clone, Debug)]
pub enum CheckoutTarget {
    /// A commit addressed directly by OID.
    Oid(NonZeroOid),

    /// A reference. If the reference is a branch, then the branch will be
    /// checked out.
    Reference(ReferenceName),

    /// The type of checkout target is not known, as it was provided from the
    /// user and we haven't resolved it ourselves.
    Unknown(String),
}

/// Options for checking out a commit.
#[derive(Clone, Debug)]
pub struct CheckOutCommitOptions {
    /// Additional arguments to pass to `git checkout`.
    pub additional_args: Vec<OsString>,

    /// Ignore the `autoSwitchBranches` setting?
    pub force_detach: bool,

    /// Use `git reset` rather than `git checkout`; that is, leave the index and
    /// working copy unchanged, and just adjust the `HEAD` pointer.
    pub reset: bool,

    /// Whether or not to render the smartlog after the checkout has completed.
    pub render_smartlog: bool,
}

impl Default for CheckOutCommitOptions {
    fn default() -> Self {
        Self {
            additional_args: Default::default(),
            force_detach: false,
            reset: false,
            render_smartlog: true,
        }
    }
}

fn maybe_get_branch_name(
    current_target: Option<String>,
    oid: Option<NonZeroOid>,
    repo: &Repo,
) -> eyre::Result<Option<String>> {
    let RepoReferencesSnapshot {
        head_oid,
        branch_oid_to_names,
        ..
    } = repo.get_references_snapshot()?;
    let oid = match current_target {
        Some(_) => oid,
        None => head_oid,
    };
    if current_target.is_some()
        && ((head_oid.is_some() && head_oid == oid)
            || current_target == head_oid.map(|o| o.to_string()))
    {
        // Don't try to checkout the branch if we aren't actually checking anything new out.
        return Ok(current_target);
    }

    // Determine if the oid corresponds to exactly a single branch. If so,
    // check that out directly.
    match oid {
        Some(oid) => match branch_oid_to_names.get(&oid) {
            Some(branch_names) => match branch_names.iter().exactly_one() {
                Ok(branch_name) => {
                    // To remove the `refs/heads/` prefix
                    let name = CategorizedReferenceName::new(branch_name);
                    Ok(Some(name.render_suffix()))
                }
                Err(_) => Ok(current_target),
            },
            None => Ok(current_target),
        },
        None => Ok(current_target),
    }
}

/// Checks out the requested commit. If the operation succeeds, then displays
/// the new smartlog. Otherwise displays a warning message.
#[instrument]
pub fn check_out_commit(
    effects: &Effects,
    git_run_info: &GitRunInfo,
    repo: &Repo,
    event_log_db: &EventLogDb,
    event_tx_id: EventTransactionId,
    target: Option<CheckoutTarget>,
    options: &CheckOutCommitOptions,
) -> EyreExitOr<()> {
    let CheckOutCommitOptions {
        additional_args,
        force_detach,
        reset,
        render_smartlog,
    } = options;

    let (target, oid) = match target {
        None => (None, None),
        Some(CheckoutTarget::Reference(reference_name)) => {
            let categorized_target = CategorizedReferenceName::new(&reference_name);
            (Some(categorized_target.render_suffix()), None)
        }
        Some(CheckoutTarget::Oid(oid)) => (Some(oid.to_string()), Some(oid)),
        Some(CheckoutTarget::Unknown(target)) => (Some(target), None),
    };

    if get_undo_create_snapshots(repo)? {
        create_snapshot(effects, git_run_info, repo, event_log_db, event_tx_id)?;
    }

    let target = if get_auto_switch_branches(repo)? && !reset && !force_detach {
        maybe_get_branch_name(target, oid, repo)?
    } else {
        target
    };

    if *reset {
        if let Some(target) = &target {
            try_exit_code!(git_run_info.run(
                effects,
                Some(event_tx_id),
                &["reset", target, "--"]
            )?);
        }
    } else {
        let checkout_args = {
            let mut args = vec![OsStr::new("checkout")];
            if let Some(target) = &target {
                args.push(OsStr::new(target.as_str()));
            }
            args.extend(additional_args.iter().map(OsStr::new));
            args.push(OsStr::new("--"));
            args
        };
        match git_run_info.run(effects, Some(event_tx_id), checkout_args.as_slice())? {
            Ok(()) => {}
            Err(exit_code) => {
                writeln!(
                    effects.get_output_stream(),
                    "{}",
                    effects.get_glyphs().render(StyledString::styled(
                        match target {
                            Some(target) => format!("Failed to check out commit: {target}"),
                            None => "Failed to check out commit".to_string(),
                        },
                        BaseColor::Red.light()
                    ))?
                )?;
                return Ok(Err(exit_code));
            }
        }
    }

    // Determine if we currently have a snapshot checked out, and, if so,
    // attempt to restore it.
    {
        let head_info = repo.get_head_info()?;
        if let Some(head_oid) = head_info.oid {
            let head_commit = repo.find_commit_or_fail(head_oid)?;
            if let Some(snapshot) = WorkingCopySnapshot::try_from_base_commit(repo, &head_commit)? {
                try_exit_code!(restore_snapshot(
                    effects,
                    git_run_info,
                    repo,
                    event_tx_id,
                    &snapshot
                )?);
            }
        }
    }

    if *render_smartlog {
        try_exit_code!(
            git_run_info.run_direct_no_wrapping(Some(event_tx_id), &["branchless", "smartlog"])?
        );
    }
    Ok(Ok(()))
}

/// Create a working copy snapshot containing the working copy's current contents.
///
/// The working copy contents are not changed by this operation. That is, the
/// caller would be responsible for discarding local changes (which might or
/// might not be the natural next step for the operation).
pub fn create_snapshot<'repo>(
    effects: &Effects,
    git_run_info: &GitRunInfo,
    repo: &'repo Repo,
    event_log_db: &EventLogDb,
    event_tx_id: EventTransactionId,
) -> eyre::Result<WorkingCopySnapshot<'repo>> {
    writeln!(
        effects.get_error_stream(),
        "branchless: creating working copy snapshot"
    )?;

    let head_info = repo.get_head_info()?;
    let index = repo.get_index()?;
    let (snapshot, _status) =
        repo.get_status(effects, git_run_info, &index, &head_info, Some(event_tx_id))?;
    event_log_db.add_events(vec![Event::WorkingCopySnapshot {
        timestamp: SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs_f64(),
        event_tx_id,
        head_oid: MaybeZeroOid::from(head_info.oid),
        commit_oid: snapshot.base_commit.get_oid(),
        ref_name: head_info.reference_name,
    }])?;
    Ok(snapshot)
}

/// Restore the given snapshot's contents into the working copy.
///
/// All tracked working copy contents are **discarded**, so the
```

### Core Architecture Module: `git-branchless-lib/src/core/config.rs`
```
//! Accesses repo-specific configuration.

use std::ffi::OsString;
use std::fmt::Write;
use std::path::PathBuf;

use cursive::theme::{BaseColor, Effect, Style};
use cursive::utils::markup::StyledString;
use eyre::Context;
use tracing::{instrument, warn};

use crate::core::formatting::StyledStringBuilder;
use crate::git::{ConfigRead, GitRunInfo, GitRunOpts, Repo};

use super::effects::Effects;
use super::eventlog::EventTransactionId;

/// Get the expected hooks dir inside `.git`, assuming that the user has not
/// overridden it.
#[instrument]
pub fn get_default_hooks_dir(repo: &Repo) -> eyre::Result<PathBuf> {
    let parent_repo = repo.open_worktree_parent_repo()?;
    let repo = parent_repo.as_ref().unwrap_or(repo);
    Ok(repo.get_path().join("hooks"))
}

/// Get the path where the main worktree's Git hooks are stored on disk.
///
/// Git hooks live at `$GIT_DIR/hooks` by default, which means that they will be
/// different per wortkree. Most people, when creating a new worktree, will not
/// also reinstall hooks or reinitialize git-branchless in that worktree, so we
/// instead look up hooks for the main worktree, which is most likely to have them
/// installed.
///
/// This could in theory cause problems for users who have different
/// per-worktree hooks.
#[instrument]
pub fn get_main_worktree_hooks_dir(
    git_run_info: &GitRunInfo,
    repo: &Repo,
    event_tx_id: Option<EventTransactionId>,
) -> eyre::Result<PathBuf> {
    let result = git_run_info
        .run_silent(
            repo,
            event_tx_id,
            &["config", "--type", "path", "core.hooksPath"],
            GitRunOpts {
                treat_git_failure_as_error: false,
                ..Default::default()
            },
        )
        .context("Reading core.hooksPath")?;
    let hooks_path = if result.exit_code.is_success() {
        let path = String::from_utf8(result.stdout)
            .context("Decoding git config output for hooks path")?;
        PathBuf::from(path.strip_suffix('\n').unwrap_or(&path))
    } else {
        get_default_hooks_dir(repo)?
    };
    Ok(hooks_path)
}

/// Get the configured name of the main branch.
///
/// The following config values are resolved, in order. The first valid value is returned.
/// - branchless.core.mainBranch
/// - (deprecated) branchless.mainBranch
/// - init.defaultBranch
/// - finally, default to "master"
#[instrument]
pub fn get_main_branch_name(repo: &Repo) -> eyre::Result<String> {
    let config = repo.get_readonly_config()?;

    if let Some(branch_name) = config.get("branchless.core.mainBranch")? {
        return Ok(branch_name);
    }

    if let Some(branch_name) = config.get("branchless.mainBranch")? {
        return Ok(branch_name);
    }

    if let Some(branch_name) = get_default_branch_name(repo)? {
        return Ok(branch_name);
    }

    Ok("master".to_string())
}

/// If `true`, switch to the branch associated with a target commit instead of
/// the commit directly.
///
/// The switch will only occur if it is the only branch on the target commit.
#[instrument]
pub fn get_auto_switch_branches(repo: &Repo) -> eyre::Result<bool> {
    repo.get_readonly_config()?
        .get_or("branchless.navigation.autoSwitchBranches", true)
}

/// The default smartlog revset to render. This will be used when running `git
/// smartlog` with no arguments, and also when the smartlog is rendered
/// automatically as part of some commands like `git next`/`git prev`.
#[instrument]
pub fn get_smartlog_default_revset(repo: &Repo) -> eyre::Result<String> {
    repo.get_readonly_config()?
        .get_or_else("branchless.smartlog.defaultRevset", || {
            "((draft() | branches() | @) % main()) | branches() | @".to_string()
        })
}

/// Whether to reverse the smartlog direction by default
#[instrument]
pub fn get_smartlog_reverse(repo: &Repo) -> eyre::Result<bool> {
    repo.get_readonly_config()?
        .get_or("branchless.smartlog.reverse", false)
}

/// Whether to show linked worktrees in the smartlog by default.
#[instrument]
pub fn get_smartlog_show_worktrees(repo: &Repo) -> eyre::Result<bool> {
    repo.get_readonly_config()?
        .get_or("branchless.smartlog.showWorktrees", false)
}

/// Get the default comment character.
#[instrument]
pub fn get_comment_char(repo: &Repo) -> eyre::Result<char> {
    let from_config: Option<String> = repo.get_readonly_config()?.get("core.commentChar")?;
    let comment_char = match from_config {
        // Note that git also allows `core.commentChar="auto"`, which we do not currently support.
        Some(comment_char) => comment_char.chars().next().unwrap(),
        None => char::from(git2::DEFAULT_COMMENT_CHAR.unwrap()),
    };
    Ok(comment_char)
}

/// Get the commit template message, if any.
#[instrument]
pub fn get_commit_template(repo: &Repo) -> eyre::Result<Option<String>> {
    let commit_template_path: Option<String> =
        repo.get_readonly_config()?.get("commit.template")?;
    let commit_template_path = match commit_template_path {
        Some(commit_template_path) => PathBuf::from(commit_template_path),
        None => return Ok(None),
    };

    let commit_template_path = if commit_template_path.is_relative() {
        match repo.get_working_copy_path() {
            Some(root) => root.join(commit_template_path),
            None => {
                warn!(
                    ?commit_template_path,
                    "Commit template path was relative, but this repository does not have a working copy"
                );
                return Ok(None);
            }
        }
    } else {
        commit_template_path
    };

    match std::fs::read_to_string(&commit_template_path) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) => {
            warn!(?e, ?commit_template_path, "Could not read commit template");
            Ok(None)
        }
    }
}

/// Get the default init branch name.
#[instrument]
pub fn get_default_branch_name(repo: &Repo) -> eyre::Result<Option<String>> {
    let config = repo.get_readonly_config()?;
    let default_branch_name: Option<String> = config.get("init.defaultBranch")?;
    Ok(default_branch_name)
}

/// Get the configured editor, if any.
///
/// Because this is primarily intended for use w/ dialoguer::Editor, and it already considers
/// several environment variables, we only need to consider git-specific config options: the
/// `$GIT_EDITOR` environment var and the `core.editor` config setting. We do so in that order to
/// match how git resolves the editor to use.
///
/// FMI see <https://git-scm.com/docs/git-var#Documentation/git-var.txt-GITEDITOR>
#[instrument]
pub fn get_editor(git_run_info: &GitRunInfo, repo: &Repo) -> eyre::Result<Option<OsString>> {
    if let Ok(result) =
        git_run_info.run_silent(repo, None, &["var", "GIT_EDITOR"], GitRunOpts::default())
    {
        if result.exit_code.is_success() {
            let editor =
                std::str::from_utf8(&result.stdout).context("Decoding git var output as UTF-8")?;
            let editor = editor.trim_end();
            let editor = OsString::from(editor);
            return Ok(Some(editor));
        } else {
            warn!(?result, "`git var` invocation failed");
        }
    }

    let editor = std::env::var_os("GIT_EDITOR");
    if editor.is_some() {
        return Ok(editor);
    }

    let config = repo.get_readonly_config()?;
    let editor: Option<String> = config.get("core.editor")?;
    match editor {
        Some(editor) => Ok(Some(editor.into())),
        None => Ok(None),
    }
}

/// If `true`, create working copy snapshots automatically after certain
/// operations.
#[instrument]
pub fn get_undo_create_snapshots(repo: &Repo) -> eyre::Result<bool> {
    repo.get_readonly_config()?
        .get_or("branchless.undo.createSnapshots", true)
}

/// If `true`, when restacking a commit, do not update its timestamp to the
/// current time.
#[instrument]
pub fn get_restack_preserve_timestamps(repo: &Repo) -> eyre:
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1652** (2026-02-26): **git-branchless panics when operating from a worktree of a cloned-bare repository**
  *Symptoms*: ### Description of the bug  Running `git-branchless` from a linked worktree of a bare-clone repo caused a fatal crash rather than displaying output.  **Reproduction Steps**  ```bash # cwd = $USER/repos git clone --bare https://github.com/arxanas/git-branchless git-branchless git -C git-branchless/ branchless init git -C git-branchless/ worktree add ../master master git -C master sl ```  ### Expected behavior  I expected to see a smartlog from the worktree.  ### Actual behavior  ```text The application panicked (crashed). Message:  A fatal error occurred:    0: could not open repository: could not find repository at '$USER/repos/; class=Repository (6); code=NotFound (-3)    1: could not find repository at '$USER/repos/'; class=Repository (6); code=NotFound (-3)  Location:    git-branchless-hook/src/lib.rs:516 … ```  ### Version of `rustc`  rustc 1.82.0 (f6e511eec 2024-10-15)  ### Automated bug report  #### Software version  git-branchless 0.10.0  #### Operating system  macOS 26.3 (Darwin 25.3.0)  #### Command-line  ```bash /Users/feo/.cargo/bin/git-branchless bug-report  ```  #### Environment variables  ```bash SHELL=/opt/homebrew/bin/fish EDITOR='code -w' ```  #### Git version  ``` > git version  git version 2.53.0 ```  #### Hooks  Error: could not open repository: could not find repository at '/Users/feo/Projects/repos'; class=Repository (6); code=NotFound (-3)  #### Events  Error: could not open repository: could not find repository at '/Users/feo/Projects/repos'; class=Rep
  **Post-Mortem & Fix Analysis**:
  > I sort of worked backwards here. I started with the PR and then filed the bug report (sorry about that). I figured I should file this report for completeness.  I was able to root cause the problem.  This is happening because `open_worktree_parent_repo` assumed the worktree's git directory looked like `$USER/repos/git-branchless/.git/worktrees/master` and it would traverse three levels up looking for the parent directory.   For bare clones there is no `.git` subdirectory, so the path is `$USER/repos/git-branchless/worktrees/master` and navigating up three levels lands us at the wrong directory.  

- **Issue #1649** (2026-02-20): **Update version of git-branchless**
  *Symptoms*: ### Description of the bug  I am seeing this error when installing git-branchless:  ``` error[E0308]: `match` arms have incompatible types    --> /Users/v-pramachandran/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/esl01-indexedlog-0.3.0/src/lock.rs:138:30     | 134 | /         match (opts.exclusive, opts.non_blocking) { 135 | |             (true, false) => file.lock_exclusive(),     | |                              --------------------- this is found to be of type `std::result::Result<(), std::io::Error>` 136 | |             (true, true) => file.try_lock_exclusive(),     | |                             ------------------------- this is found to be of type `std::result::Result<(), std::io::Error>` 137 | |             (false, false) => file.lock_shared(),     | |                               ------------------ this is found to be of type `std::result::Result<(), std::io::Error>` 138 | |             (false, true) => file.try_lock_shared(),     | |                              ^^^^^^^^^^^^^^^^^^^^^^ expected `Result<(), Error>`, found `Result<(), TryLockError>` 139 | |         }     | |_________- `match` arms have incompatible types     |     = note: expected enum `std::result::Result<_, std::io::Error>`                found enum `std::result::Result<_, std::fs::TryLockError>`     Compiling predicates v3.1.4    Compiling backtrace v0.3.76    Compiling predicates-tree v1.0.13 For more information about this error, try `rustc --explain E0308`. error: could not compile `esl
  **Post-Mortem & Fix Analysis**:
  > I think this is a duplicate of #1585.
  > > duplicate of #1585  Yes, I agree. @v-rdwivedi please see if #1585 is any help for you. Summary: this is fixed on `master` but is not yet released. (And there is no specific timeframe for a release at this time.)
  > may we please please have a dot release?

- **Issue #1642** (2026-02-03): **smartlog: rendering broken on master**
  *Symptoms*: ### Description of the bug  smartlog rendering is broken on master as of b9e7e3a. Output glyphs appear to be correct (ie unicode box drawing chars are used) but the colors and styles are all wrong, perhaps reversed? Or maybe just mixed up?  The issue was introduced in #1637, either the one of the dep updates in 694bd68, or perhaps a botched code update in ed946a9. Commit 39987fb seems correct, but output is incorrect by f6a7008.  ### Expected behavior  `git switch --detach 39987fb ; cargo run -- smartlog`  ![Image](https://github.com/user-attachments/assets/8ae94be7-9ebc-422f-b1b6-90e62645b927)  ### Actual behavior  `git switch --detach f6a7008 ; cargo run -- smartlog`  ![Image](https://github.com/user-attachments/assets/9132affc-ac15-4737-a937-ae6a4172dfd7)  ### Version of `rustc`  rustc 1.86.0 (05f9846f8 2025-03-31)  ### Automated bug report  n/a  ### Version of `git-branchless`  master  ### Version of `git`  _No response_

- **Issue #1629** (2026-06-02): **(Windows) Panic during `git test` if `-x` script contains characters which are invalid in a file path**
  *Symptoms*: ### Description of the bug  Running a `git test run ...` where the script part contains e.g. `:` panics on Windows. It seems the `:` is copied as-is into the filepath, and because it's Windows, that's not ok. On WSL it works fine.  ## Minimal reproduction `git test run main..HEAD -x 'echo :'`   ### Expected behavior  I expected the script to run as usual, meaning I expect that the command will be converted to a valid path before trying to make a new directory.  ### Actual behavior  While running `git test main..HEAD -x 'pnpm check:prettier'` I got the following output: ``` The application panicked (crashed). Message:  A fatal error occurred:    0: Failed waiting on workers    1: Worker 1 failed when processing commit ec9d22ab59b5d0aca2679c8e5db19ddd07c5b34f: Creating command directory "D:/Projects/awpw-node/.git/branchless\\test\\13f2bb5e83b30b6b69add54247527753ed5c8ef1\\pnpm__run__check:prettier" ```  ### Version of `rustc`  rustc 1.88.0-nightly (2e6882ac5 2025-05-05)  ### Automated bug report  [git-branchless-bug-report.txt](https://github.com/user-attachments/files/23655842/git-branchless-bug-report.txt)  > edit: typos
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this. That error is originating here:  https://github.com/arxanas/git-branchless/blob/master/git-branchless-test/src/lib.rs#L2376-L2378  As you can see, we're "slugifying" the command (as passed to `test -x`), and trying to create a directory named by that slug. The slug fn is defined here:  https://github.com/arxanas/git-branchless/blob/master/git-branchless-lib/src/git/test.rs#L45-L47  The simplest fix for this issue would be to add `':'` to the list of replaced chars in that fn. However, a more robust fix would probably replace/slugify the commands according to a platform specific list of chars to exclude, or to simply replace all non-aphanumeric chars. (I suspect that the latter would still give us a reasonable level of cache uniqueness.)  I took a stab at fixing this, but I couldn't reproduce the issue in a failing test. (I'm running on a mac, and `:` is a valid directory char[^1].) I'm not going to pursue this further until someone can provide a failing te

- **Issue #1585** (2026-06-21): **Fails to build with rust 1.89.0**
  *Symptoms*: ### Description of the bug  ``` error[E0308]: `match` arms have incompatible types    --> /wrkdirs/usr/ports/devel/git-branchless/work/git-branchless-0.10.0/cargo-crates/esl01-indexedlog-0.3.0/src/lock.rs:138:30     | 134 | /         match (opts.exclusive, opts.non_blocking) { 135 | |             (true, false) => file.lock_exclusive(),     | |                              --------------------- this is found to be of type `std::result::Result<(), std::io::Error>` 136 | |             (true, true) => file.try_lock_exclusive(),     | |                             ------------------------- this is found to be of type `std::result::Result<(), std::io::Error>` 137 | |             (false, false) => file.lock_shared(),     | |                               ------------------ this is found to be of type `std::result::Result<(), std::io::Error>` 138 | |             (false, true) => file.try_lock_shared(),     | |                              ^^^^^^^^^^^^^^^^^^^^^^ expected `Result<(), Error>`, found `Result<(), TryLockError>` 139 | |         }     | |_________- `match` arms have incompatible types ```  [Downstream bug report](https://bugs.freebsd.org/bugzilla/show_bug.cgi?id=289015).  Version: 0.10.0 FreeBSD 14.3  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Version of `rustc`  _No response_  ### Automated bug report  _No response_  ### Version of `git-branchless`  _No response_  ### Version of `git`  _No response_
  **Post-Mortem & Fix Analysis**:
  > I am also getting this error.
  > I think https://crates.io/crates/esl01-indexedlog crate causes the error. The last commit of the crate has been done FOUR YEARS ago
  > Thanks for the report. It looks like this has already been fixed upstream, but has not been released/published in a crate yet. I've opened https://github.com/facebook/sapling/issues/1119 to request an updated crate.  Until then, I'll note that our current MSRV is still 1.74: https://github.com/arxanas/git-branchless/blob/master/git-branchless/Cargo.toml#L14 

- **Issue #1544** (2025-05-05): **git branchless init failing: attempting write to /dev/null/post-applypatch**
  *Symptoms*: ### Description of the bug  ## Overview  For some reason the hook installs are trying to write to the path `/dev/null/<file>`, causing `git branchless init` to fail. I suspect there might be an unaccounted for environment dependency. Would you mind sanity checking me?  ## Reproduction  ``` $ nix shell github:arxanas/git-branchless $ cd $(mktemp -d) $ git init Initialized empty Git repository in /tmp/tmp.XXX/.git/ $ git branchless init Created config file at /tmp/tmp.XXX/.git/branchless/config Your main branch name could not be auto-detected! Examples of a main branch: master, main, trunk, etc. See https://github.com/arxanas/git-branchless/wiki/Concepts#main-branch Enter the name of your main branch: master Installing hooks: post-applypatch, post-checkout, post-commit, post-merge, post-rewrite, pre-auto-gc, reference-transaction The application panicked (crashed). Message:  A fatal error occurred:    0: Not a directory (os error 20)  Location:    /build/rustc-1.75.0-src/library/core/src/convert/mod.rs:757    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SPANTRACE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     0: git_branchless_init::update_hook_contents with hook=RegularHook { path: "/dev/null/post-applypatch" } hook_contents="\ngit branchless hook post-applypatch \"$@\"\n"       at git-branchless-init/src/lib.rs:206    1: git_branchless_init::install_hook with repo=<Git repository at: "/tmp/tmp.XXX/.git/"> hooks_dir="/dev/null" hook_type="post-applypatch" hook_script="\ngit branchless hook pos
  **Post-Mortem & Fix Analysis**:
  > This sounds a lot like #1328. Can you investigate to see if adjusting your config may help?
  > @claytonrcarter Confirmed [ID-10T][0] here. I had `core.hooksPath = /dev/null` set globally.  [0]:https://en.wikipedia.org/wiki/User_error

- **Issue #1543** (2026-07-10): **Slow performance during tag updates with git-branchless**
  *Symptoms*: ### Description of the bug  When running `git fetch` in a repository with git-branchless enabled, the operation takes an excessively long time when processing a large number of tag updates. The issue appears to be related to how git-branchless processes tag updates sequentially, with each tag being processed individually rather than in batches.  For each tag update, the following output is displayed: ``` branchless: processing 1 update: ref refs/tags/[tag-name]  * [new tag]                 [tag-name]                                      -> [tag-name] ```  This pattern repeats for every single tag being fetched (potentially hundreds of tags), leading to significant performance degradation.  ### Steps to reproduce: 1. Set up a repository with git-branchless (`git branchless init`) 2. Configure a remote with many tags (100+) 3. Run `git fetch` 4. Observe the slow processing of each tag individually with timestamps showing several minutes elapsing    ### Expected behavior  Git fetch with git-branchless should process tag updates more efficiently, either by: 1. Batching tag updates together for processing instead of handling each one individually 2. Optimizing the processing of individual tags to be faster 3. Providing a configuration option to ignore or batch-process tag updates  The operation should complete in a time comparable to standard git fetch without git-branchless enabled (seconds rather than minutes).   ### Actual behavior  A simple `git fetch` operation that should co
  **Post-Mortem & Fix Analysis**:
  > I'm experiencing the same issue in a large repo with lots of tag updates.  ``` git-branchless-opts 0.11.1 rustc 1.96.0 (ac68faa20 2026-05-25) macOS 26.5.2 (25F84) (Darwin 25.5.0) zsh 5.9 (arm64-apple-darwin25.0) ```
  > Is this behavior unique to tags, or does it happen with other refs? I wonder if it might be generic to all remote refs bc I’ve seen something similar when I pull from a popular remote with lots of PRs being created, leading to lots of remote branches being fetched, too.   Beyond that, it’s notable that branchless doesn’t actually support tags, so I suspect it may not be doing any actual updates beyond what git does itself. 
  > > does it happen with other refs?  Yes, this is the case, I see it happen with a large number of branches, too.  This is related to the `reference-transaction` hook that we install, and the fact that that hook is called once rep ref update, not in a batch for all ref updates. So every ref will incur overhead to call the hook + call in to git branchless + do the actual ref update w/i git branchless.  In a local demo repo with 100 tags, I saw this for timings (single runs, just for example) when calling `git fetch --all` from another local repo: - no `reference-transaction` hook installed: 65.81 ms - empty `reference-transaction` hook installed: 843.41 ms - modified branchless hook (no-op, immediate return): 1630 ms - modified branchless hook (does some stuff, but skips tags): 1730 secs - real branchless hook (does stuff): 2710 ms  Summary:  - ~800ms just to call the hook script 100× - ~800ms just to call into git-branchless 100× - ~100ms just to set up the ref-xact processing code and r

- **Issue #1537** (2026-05-20): **Support `git branchless move --reparent`**
  *Symptoms*: ### Description of the bug  The use case is the same as `git amend --reparent`, but in particular, sometimes I do a regular `git amend` and get a note that I'll need to run `git restack --merge`, and now it's too late to run `git amend --reparent`.  So in particular, the steps to reproduce are: - Run `git move -s foo -d bar --reparent` Or perhaps even: - Run `git restack --reparent`  (Sorry if a Bug isn't the right venue for this, but I figured it was a sufficiently direct feature request that it made sense as an issue, rather than a discussion.)  ### Expected behavior  The move happens, but without any changes being applied to the trees of the moved patches.  ### Actual behavior  Not supported.  ### Version of `rustc`  _No response_  ### Automated bug report  _No response_  ### Version of `git-branchless`  _No response_  ### Version of `git`  _No response_
  **Post-Mortem & Fix Analysis**:
  > I think this is a valuable suggestion! Often I need to rewrite the history for a large set of patches in order to re-organize my changes and present it better for PR reviewers. In this case I do _not_ want to change the actual contents of the final tree, only how changes are "distributed" between individual commits / patches.  Furthermore since git internally stores tree objects instead of diffs, this should be a rather cheap operation, but I do not know how to actually achieve this even in vanilla git.
  > I made a very rough PR about this: - #1631
  > I also feel the pain of `amend` → merge conflict → "oops, I meant to use `--reparent` and now I can't", so I can definitely see a use case for that scenario.  I'm struggling to see a lot of other use cases, though. Or rather, perhaps I just don't see the possibilities? @bryango in your examples, where you are rearranging commits in a stack, can't you achieve that with a combination of `move --exact ... --insert`? Wouldn't `--reparent` mean that the changes (diffs?) that you are distributing themselves change,   In a situation where you have commits `A←B←C`, if you were to do a `move --exact C --dest A --insert --reparent`, you would end up with `A→C'←B'`, where `C'` will show up as if `B+C` had been squashed together, and then `B'` will show something like `git revert C` (the original commit C) on top of the new commit `C'`. Not that there aren't legitimate uses for something like this, but I'm having a hard time seeing them and it seems like a very small niche to fill.  I would love t

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

### Incident Patch 1: `03d6ab8d` (2026-07-15)
**Commit Message**: fix(move fixup): correctly squash renamed files

**File**: `git-branchless/tests/test_move.rs` (modified, +90/-0)
```diff
@@ -6416,6 +6416,96 @@ fn test_move_fixup_deleted_files() -> eyre::Result<()> {
     Ok(())
 }
 
+#[test]
+fn test_move_fixup_renamed_files() -> eyre::Result<()> {
+    let git = make_git()?;
+    git.init_repo()?;
+    git.detach_head()?;
+
+    git.commit_file("test1", 1)?;
+    git.commit_file("test2", 2)?;
+
+    git.run(&["mv", "test1.txt", "test1-renamed.txt"])?;
+    git.run(&["commit", "-m", "rename test1"])?;
+
+    git.write_file_txt("test2", "new contents")?;
+    git.run(&["add", "."])?;
+    git.run(&["commit", "-m", "update test2"])?;
+
+    {
+        let (stdout, _stderr) = git.branchless("smartlog", &[])?;
+        insta::assert_snapshot!(stdout, @"
+        O f777ecc (master) create initial.txt
+        |
+        o 62fc20d create test1.txt
+        |
+        o 96d1c37 create test2.txt
+        |
+        o 7111570 rename test1
+        |
+        @ bdef94f update test2
+        ");
+
+        let (stdout, _stderr) = git.run(&["ls-files"])?;
+        insta::assert_snapshot!(stdout, @"
+        initial.txt
+        test1-renamed.txt
+        test2.txt
+        ");
+
+        let (stdout, _stderr) = git.run(&["show", "--pretty=format:", "--stat", "HEAD~"])?;
+        insta::assert_snapshot!(&stdout, @"
+        test1.txt => test1-renamed.txt | 0
+        1 file changed, 0 insertions(+), 0 deletions(-)
+        ");
+
+        let (stdout, _stderr) = git.run(&["show", "--pretty=format:", "--stat", "HEAD~~"])?;
+        insta::assert_snapshot!(&stdout, @"
+        test2.txt | 1 +
+        1 file changed, 1 insertion(+)
+        ");
+    }
+
+    {
+        let (stdout, _stderr) = git.branchless(
+            "move",
+            &["--in-memory", "--fixup", "-x", "HEAD~", "-d", "HEAD~~"],
+        )?;
+
+        insta::assert_snapshot!(stdout, @"
+        Attempting rebase in-memory...
+        [1/2] Committed as: b2e638e create test2.txt
+        [2/2] Committed as: 8b45ead update test2
+        branchless: processing 3 rewritten commits
+        branchless: running command: <git-executable> checkout 8b45ead20e7afdc53784baf7f3a48c0733147669 --
+        O f777ecc (master) create initial.txt
+        |
+        o 62fc20d create test1.txt
+        |
+        o b2e638e create test2.txt
+        |
+        @ 8b45ead update test2
+        In-memory rebase succeeded.
+        ");
+
+        let (stdout, _stderr) = git.run(&["ls-files"])?;
+        insta::assert_snapshot!(stdout, @"
+        initial.txt
+        test1-renamed.txt
+        test2.txt
+        ");
+
+        let (stdout, _stderr) = git.run(&["show", "--pretty=format:", "--stat", "HEAD~"])?;
+        insta::assert_snapshot!(&stdout, @"
+        test1.txt => test1-renamed.txt | 0
+        test2.txt                      | 1 +
+        2 files changed, 1 insertion(+)
+        ");
+    }
+
+    Ok(())
+}
+
 #[test]
 fn test_move_reparent() -> eyre::Result<()> {
     let git = make_git()?;
```

---

### Incident Patch 2: `928d3c72` (2026-07-15)
**Commit Message**: fix(move fixup): correctly squash deleted files

**File**: `git-branchless-lib/src/git/repo.rs` (modified, +2/-1)
```diff
@@ -1660,7 +1660,8 @@ impl Repo {
                         Ok(Some(entry)) => {
                             Some((path.clone(), Some((entry.get_oid(), entry.get_filemode()))))
                         }
-                        Ok(None) | Err(_) => None,
+                        Ok(None) => Some((path.clone(), None)),
+                        Err(_) => None,
                     })
                     .collect::<HashMap<_, _>>()
             }
```

**File**: `git-branchless/tests/test_move.rs` (modified, +89/-0)
```diff
@@ -6327,6 +6327,95 @@ fn test_move_fixup_added_files() -> eyre::Result<()> {
     Ok(())
 }
 
+#[test]
+fn test_move_fixup_deleted_files() -> eyre::Result<()> {
+    let git = make_git()?;
+    git.init_repo()?;
+    git.detach_head()?;
+
+    git.commit_file("test1", 1)?;
+    git.commit_file("test2", 2)?;
+
+    git.delete_file("test1")?;
+    git.run(&["add", "."])?;
+    git.run(&["commit", "-m", "delete test1"])?;
+
+    git.write_file_txt("test2", "new contents")?;
+    git.run(&["add", "."])?;
+    git.run(&["commit", "-m", "update test2"])?;
+
+    {
+        let (stdout, _stderr) = git.branchless("smartlog", &[])?;
+        insta::assert_snapshot!(stdout, @"
+        O f777ecc (master) create initial.txt
+        |
+        o 62fc20d create test1.txt
+        |
+        o 96d1c37 create test2.txt
+        |
+        o 0de4211 delete test1
+        |
+        @ 53f89c9 update test2
+        ");
+
+        let (stdout, _stderr) = git.run(&["ls-files"])?;
+        insta::assert_snapshot!(stdout, @"
+        initial.txt
+        test2.txt
+        ");
+
+        let (stdout, _stderr) = git.run(&["show", "--pretty=format:", "--stat", "HEAD~"])?;
+        insta::assert_snapshot!(&stdout, @"
+        test1.txt | 1 -
+        1 file changed, 1 deletion(-)
+        ");
+
+        let (stdout, _stderr) = git.run(&["show", "--pretty=format:", "--stat", "HEAD~~"])?;
+        insta::assert_snapshot!(&stdout, @"
+        test2.txt | 1 +
+        1 file changed, 1 insertion(+)
+        ");
+    }
+
+    {
+        let (stdout, _stderr) = git.branchless(
+            "move",
+            &["--in-memory", "--fixup", "-x", "HEAD~", "-d", "HEAD~~"],
+        )?;
+
+        insta::assert_snapshot!(stdout, @"
+        Attempting rebase in-memory...
+        [1/2] Committed as: f0f0727 create test2.txt
+        [2/2] Committed as: 66e6aae update test2
+        branchless: processing 3 rewritten commits
+        branchless: running command: <git-executable> checkout 66e6aae105e43c390f98cba9d085aa029b56fdc6 --
+        O f777ecc (master) create initial.txt
+        |
+        o 62fc20d create test1.txt
+        |
+        o f0f0727 create test2.txt
+        |
+        @ 66e6aae update test2
+        In-memory rebase succeeded.
+        ");
+
+        let (stdout, _stderr) = git.run(&["ls-files"])?;
+        insta::assert_snapshot!(stdout, @"
+        initial.txt
+        test2.txt
+        ");
+
+        let (stdout, _stderr) = git.run(&["show", "--pretty=format:", "--stat", "HEAD~"])?;
+        insta::assert_snapshot!(&stdout, @"
+        test1.txt | 1 -
+        test2.txt | 1 +
+        2 files changed, 1 insertion(+), 1 deletion(-)
+        ");
+    }
+
+    Ok(())
+}
+
 #[test]
 fn test_move_reparent() -> eyre::Result<()> {
     let git = make_git()?;
```

---

### Incident Patch 3: `16d97859` (2026-05-20)
**Commit Message**: fix(record): support --create, advance branches, mark reachable

Fixes various defects encountered during testing.

**File**: `git-branchless-record/src/lib.rs` (modified, +44/-17)
```diff
@@ -12,10 +12,10 @@
 use std::collections::HashSet;
 use std::ffi::OsString;
 use std::fmt::Write;
-use std::time::SystemTime;
+use std::time::{SystemTime, UNIX_EPOCH};
 
 use chrono::DateTime;
-use eyre::OptionExt;
+use eyre::{OptionExt, WrapErr};
 use git_branchless_invoke::CommandContext;
 use git_branchless_opts::{MessageArgs, RecordArgs, ResolveRevsetOptions, Revset};
 use git_branchless_reword::{ResolveFixupCommitError, edit_message, resolve_commit_to_fixup};
@@ -24,8 +24,9 @@ use lib::core::check_out::{CheckOutCommitOptions, CheckoutTarget, check_out_comm
 use lib::core::config::{get_commit_template, get_restack_preserve_timestamps};
 use lib::core::dag::{CommitSet, Dag};
 use lib::core::effects::{Effects, OperationType};
-use lib::core::eventlog::{EventLogDb, EventReplayer, EventTransactionId};
+use lib::core::eventlog::{Event as LogEvent, EventLogDb, EventReplayer, EventTransactionId};
 use lib::core::formatting::Pluralize;
+use lib::core::gc::mark_commit_reachable;
 use lib::core::repo_ext::RepoExt;
 use lib::core::rewrite::{
     BuildRebasePlanError, BuildRebasePlanOptions, ExecuteRebasePlanOptions,
@@ -34,10 +35,10 @@ use lib::core::rewrite::{
 };
 use lib::core::untracked_file_cache::{UntrackedFileStrategy, process_untracked_files};
 use lib::git::{
-    CategorizedReferenceName, ConfigRead, FileMode, GitRunInfo, MaybeZeroOid, NonZeroOid, Repo,
-    ResolvedReferenceInfo, Signature, Stage, UpdateIndexCommand, WorkingCopyChangesType,
-    WorkingCopySnapshot, process_diff_for_record, summarize_diff_for_temporary_commit,
-    update_index,
+    CategorizedReferenceName, ConfigRead, FileMode, GitRunInfo, MaybeZeroOid, NonZeroOid,
+    ReferenceName, Repo, ResolvedReferenceInfo, Signature, Stage, UpdateIndexCommand,
+    WorkingCopyChangesType, WorkingCopySnapshot, process_diff_for_record,
+    summarize_diff_for_temporary_commit, update_index,
 };
 use lib::try_exit_code;
 use lib::util::{ExitCode, EyreExitOr};
@@ -112,6 +113,7 @@ fn record(
             &event_log_db,
             &event_tx_id,
             messages,
+            branch_name,
         )?);
     } else {
         try_exit_code!(create_commit_with_changes(
@@ -454,13 +456,14 @@ fn create_new_commit(
     event_log_db: &EventLogDb,
     event_tx_id: &EventTransactionId,
     messages: Vec<String>,
+    branch_name: Option<String>,
 ) -> EyreExitOr<()> {
     let head_info = repo.get_head_info()?;
-    let current_commit_oid = match head_info {
+    let (current_commit_oid, existing_ref_name) = match head_info {
         ResolvedReferenceInfo {
             oid: Some(oid),
-            reference_name: _,
-        } => oid,
+            reference_name,
+        } => (oid, reference_name),
         ResolvedReferenceInfo {
             oid: None,
             reference_name: _,
@@ -510,22 +513,46 @@ fn create_new_commit(
         vec![&current_commit],
     )?;
 
-    // TODO: move branch if ref_name
-    // TODO: mark commit reachable (will show in sl if descendants, but not if detached)
-    // FIXME: --new --create <branch> doesn't seem to work
+    mark_commit_reachable(repo, new_oid)
+        .wrap_err("Marking commit as reachable for GC purposes.")?;
+    event_log_db.add_events(vec![LogEvent::CommitEvent {
+        timestamp: now.duration_since(UNIX_EPOCH)?.as_secs_f64(),
+        event_tx_id: *event_tx_id,
+        commit_oid: new_oid,
+    }])?;
+
+    let checkout_target = if let Some(name) = branch_name {
+        // --create <branch>: create the new branch at the new commit.
+        try_exit_code!(git_run_info.run(
+            effects,
+            Some(*event_tx_id),
+            &["branch", &name, &new_oid.to_string()],
+        )?);
+        let ref_name = ReferenceName::from(format!("refs/heads/{name}"));
+        CheckoutTarget::Reference(ref_name)
+    } else if let Some(ref_name) = existing_ref_name {
+        // On a named branch: advance it to the new commit, mirroring `git commit`.
+        try_exit_code!(git_run_info.run(
+       
```

**File**: `git-branchless-record/tests/test_record.rs` (modified, +102/-11)
```diff
@@ -526,7 +526,8 @@ fn test_record_new() -> eyre::Result<()> {
             },
         )?;
         insta::assert_snapshot!(stdout, @r###"
-        branchless: running command: <git-executable> checkout f25fe40ff47319c8b8c61a32c03f2c3558aacadd --
+        branchless: running command: <git-executable> update-ref refs/heads/master f25fe40ff47319c8b8c61a32c03f2c3558aacadd
+        branchless: running command: <git-executable> checkout master --
         M	test1.txt
         "###);
 
@@ -542,9 +543,7 @@ fn test_record_new() -> eyre::Result<()> {
         let stdout = git.smartlog()?;
         insta::assert_snapshot!(stdout, @r###"
         :
-        O 62fc20d (master) create test1.txt
-        |
-        @ f25fe40 empty commit 1
+        @ f25fe40 (> master) empty commit 1
         "###);
     }
 
@@ -561,7 +560,8 @@ fn test_record_new() -> eyre::Result<()> {
             },
         )?;
         insta::assert_snapshot!(stdout, @r###"
-        branchless: running command: <git-executable> checkout 46ba0c4efce07dc705498e7b79f7116d4e9ef7a3 --
+        branchless: running command: <git-executable> update-ref refs/heads/master 46ba0c4efce07dc705498e7b79f7116d4e9ef7a3
+        branchless: running command: <git-executable> checkout master --
         M	test1.txt
         "###);
 
@@ -577,11 +577,7 @@ fn test_record_new() -> eyre::Result<()> {
         let stdout = git.smartlog()?;
         insta::assert_snapshot!(stdout, @r###"
         :
-        O 62fc20d (master) create test1.txt
-        |
-        o f25fe40 empty commit 1
-        |
-        @ 46ba0c4 empty commit 2
+        @ 46ba0c4 (> master) empty commit 2
         "###);
     }
 
@@ -624,7 +620,8 @@ fn test_record_new_uses_user_name_and_email() -> eyre::Result<()> {
             },
         )?;
         insta::assert_snapshot!(stdout, @r###"
-        branchless: running command: <git-executable> checkout d4aea9dcdb2ad9ddedc964de9e782aad5a97b864 --
+        branchless: running command: <git-executable> update-ref refs/heads/master d4aea9dcdb2ad9ddedc964de9e782aad5a97b864
+        branchless: running command: <git-executable> checkout master --
         M	test1.txt
         "###);
 
@@ -1363,3 +1360,97 @@ fn test_record_fixup() -> eyre::Result<()> {
 
     Ok(())
 }
+
+#[test]
+fn test_record_new_moves_branch() -> eyre::Result<()> {
+    let git = make_git()?;
+    if !git.supports_reference_transactions()? {
+        return Ok(());
+    }
+    git.init_repo()?;
+
+    {
+        // Switch to a new branch and then create a new commit. The branch
+        // pointer should advance with the new commit.
+        git.run(&["switch", "--create", "test"])?;
+        git.branchless("record", &["-m", "empty commit 1", "--new"])?;
+
+        let stdout = git.smartlog()?;
+        insta::assert_snapshot!(stdout, @r###"
+        O f777ecc (master) create initial.txt
+        |
+        @ 1fa4693 (> test) empty commit 1
+        "###);
+    }
+
+    Ok(())
+}
+
+#[test]
+fn test_record_new_marks_commit_reachable() -> eyre::Result<()> {
+    let git = make_git()?;
+    if !git.supports_reference_transactions()? {
+        return Ok(());
+    }
+    git.init_repo()?;
+    git.commit_file("test1", 1)?;
+    git.detach_head()?;
+
+    let stdout = git.smartlog()?;
+    insta::assert_snapshot!(stdout, @r###"
+        :
+        @ 62fc20d (master) create test1.txt
+    "###);
+
+    {
+        // Create new commit then switch back to master.
+        git.branchless("record", &["-m", "empty commit 1", "--new"])?;
+        git.run(&["switch", "master"])?;
+
+        // The new commit should still appear in the smartlog even though no
+        // branch points to it.
+        let stdout = git.smartlog()?;
+        insta::assert_snapshot!(stdout, @r###"
+        :
+        @ 62fc20d (> master) create test1.txt
+        |
+        o dc158fa empty commit 1
+        "###);
+    }
+
+    Ok(())
+}
+
+#[test]
+fn test_record_new_with_create() -> eyre::Result<()> {
+    let git = make_git()?;
+    if !gi
```

---

### Incident Patch 4: `6f9041fa` (2026-05-20)
**Commit Message**: fix(tests): set TZ env var for test git

`record --new` is the first feature in which we create entirely new
commits (vs rewriting or splitting existing commits) and I was running
into test failures in CI that seemed to only differ by timezone.
Explicitly setting the time zone in the test git environment resolved
the issue.

**File**: `git-branchless-lib/src/testing.rs` (modified, +9/-0)
```diff
@@ -228,15 +228,24 @@ impl Git {
         // ":" is understood by `git` to skip editing.
         let git_editor = OsString::from(":");
 
+        // Set timezone to avoid snapshot conflicts between local machines in
+        // different timezones, and CI. This may only affect places where we
+        // create wholely new commits, eg `record --new`.
+        let git_timezone = OsString::from("UTC");
+
         let new_path = self.get_path_for_env();
         let envs = vec![
             ("GIT_CONFIG_NOSYSTEM", OsString::from("1")),
+            // Note that git also supports a GIT_TEST_DATE_NOW env var, which
+            // may come in useful in the future:
+            // https://github.com/git/git/blob/7bcaabddcf68bd0702697da5904c3b68c52f94cf/date.c#L128
             ("GIT_AUTHOR_DATE", date.clone()),
             ("GIT_COMMITTER_DATE", date),
             ("GIT_EDITOR", git_editor),
             ("GIT_EXEC_PATH", self.git_exec_path.as_os_str().into()),
             ("LC_ALL", "C".into()),
             ("PATH", new_path),
+            ("TZ", git_timezone),
             (TEST_GIT, self.path_to_git.as_os_str().into()),
             (
                 TEST_SEPARATE_COMMAND_BINARIES,
```

---

### Incident Patch 5: `428fcfe7` (2026-05-18)
**Commit Message**: fix(tests): use correct RFC2822 time format

DUMMY_DATE is used to populate GIT_AUTHOR_DATE and GIT_COMMITTER_DATE, both of
which expect dates in RFC2822 format, but DUMMY_DATE was itselt not in RFC2822
format, and it was made less so by appending a 2 digit timezone offset.

This has not been an issue thus far because we were only passing the date to
git as a string, and git seems to be fairly liberal when parsing dates. `git
record --new` seems to be the first time we're actually creating wholey new
commits (vs just modifying existing commits), so we need to set a current time
on these new commits. To do so, we need to parse DUMMY_DATE into a SystemTime
with chrono, and chrono is not lenient when parsing dates, leading to various
errors:

1. The existing format yielded Invalid, because of the time/year order.
2. Fixing the order of the year led to TooShort, because of the 2 digit
   timezone offset.
3. Fixing the timezone offset yielded Impossible, because 2020-10-29 was
   not a Wednesday.

Fun! Regardless, I don't expect these changes to have any impact outside of
the upcoming tests for `record --new`.

Old format: Wed 29 Oct 12:34:56 2020 PDT -02
New format: Thu, 29 Oct 2020 12

**File**: `git-branchless-lib/src/testing.rs` (modified, +2/-2)
```diff
@@ -62,7 +62,7 @@ fn get_shell_utils_dir() -> Option<PathBuf> {
 
 const DUMMY_NAME: &str = "Testy McTestface";
 const DUMMY_EMAIL: &str = "test@example.com";
-const DUMMY_DATE: &str = "Wed 29 Oct 12:34:56 2020 PDT";
+const DUMMY_DATE: &str = "Thu, 29 Oct 2020 12:34:56";
 
 /// Wrapper around the Git executable, for testing.
 #[derive(Clone, Debug)]
@@ -218,7 +218,7 @@ impl Git {
     pub fn get_base_env(&self, time: isize) -> Vec<(OsString, OsString)> {
         // Required for determinism, as these values will be baked into the commit
         // hash.
-        let date: OsString = format!("{DUMMY_DATE} -{time:0>2}").into();
+        let date: OsString = format!("{DUMMY_DATE} -{time:0>2}00").into();
 
         // Fake "editor" which accepts the default contents of any commit
         // messages. Usually, we can set this with `git commit -m`, but we have
```

---

### Incident Patch 6: `5da501d9` (2026-07-01)
**Commit Message**: fix(docs): fix warnings for private items

Test plan
---------

```scrut
$ RUSTDOCFLAGS='--deny warnings' cargo doc --workspace --no-deps --document-private-items
```

**File**: `.github/workflows/lint.yml` (modified, +1/-1)
```diff
@@ -54,4 +54,4 @@ jobs:
       - name: Run `cargo doc`
         env:
           RUSTDOCFLAGS: "--deny warnings"
-        run: cargo doc --workspace --no-deps
+        run: cargo doc --workspace --no-deps --document-private-items
```

**File**: `git-branchless-hook/src/lib.rs` (modified, +4/-4)
```diff
@@ -233,8 +233,8 @@ mod reference_transaction {
         /// The string is expected to be one field from a reference transaction
         /// line, which can be one of the following values:
         ///
-        /// ref:<symbolic ref name>
-        /// <commit hash>
+        /// - `ref:<symbolic ref name>`
+        /// - `<commit hash>`
         fn from_str(value: &str) -> Result<Self, Self::Err> {
             match value.strip_prefix("ref:") {
                 Some(refname) => Ok(ReferenceTarget::Symbolic {
@@ -426,10 +426,10 @@ mod reference_transaction {
         }
     }
     /// As per the discussion at
-    /// https://public-inbox.org/git/CAKjfCeBcuYC3OXRVtxxDGWRGOxC38Fb7CNuSh_dMmxpGVip_9Q@mail.gmail.com/,
+    /// <https://public-inbox.org/git/CAKjfCeBcuYC3OXRVtxxDGWRGOxC38Fb7CNuSh_dMmxpGVip_9Q@mail.gmail.com/>,
     /// the OIDs passed to the reference transaction can't actually be trusted
     /// when dealing with packed references, so we need to look up their actual
-    /// values on disk again. See https://git-scm.com/docs/git-pack-refs for
+    /// values on disk again. See <https://git-scm.com/docs/git-pack-refs> for
     /// details about packed references.
     ///
     /// Supposing we have a ref named `refs/heads/foo` pointing to an OID
```

**File**: `git-branchless-lib/src/core/effects.rs` (modified, +1/-1)
```diff
@@ -190,7 +190,7 @@ impl RootOperation {
     }
 
     /// Re-render all operation progress bars. This does not change their
-    /// ordering like [`refresh_multi_progress`] does.
+    /// ordering like [`Self::refresh_multi_progress`] does.
     pub fn tick(&mut self) {
         let operations = {
             let mut acc = Vec::new();
```

**File**: `git-branchless-lib/src/core/eventlog.rs` (modified, +1/-1)
```diff
@@ -955,7 +955,7 @@ impl EventReplayer {
         };
     }
 
-    /// See https://github.com/arxanas/git-branchless/issues/7.
+    /// See <https://github.com/arxanas/git-branchless/issues/7>.
     fn fix_event_git_v2_31(&self, event: Event) -> Option<Event> {
         let event = match event {
             // Git v2.31 will sometimes fail to set the `old_ref` field when
```

**File**: `git-branchless-lib/src/testing.rs` (modified, +1/-1)
```diff
@@ -756,7 +756,7 @@ impl Deref for GitWrapper {
     }
 }
 
-/// From https://stackoverflow.com/a/65192210
+/// From <https://stackoverflow.com/a/65192210>
 /// License: CC-BY-SA 4.0
 fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
     fs::create_dir_all(&dst)?;
```

---

### Incident Patch 7: `624edd20` (2026-06-20)
**Commit Message**: fix(tests): fix tests on macOS with Git v2.37

See comments.

On my machine:

```console
$ uname -mrsv
Darwin 25.5.0 Darwin Kernel Version 25.5.0: Mon Apr 27 20:41:12 PDT 2026; root:xnu-12377.121.6~2/RELEASE_ARM64_T6050 arm64
```

These tests were failing:

```console
$ cargo nextest run --workspace --no-fail-fast
...
     Summary [ 136.013s] 423 tests run: 421 passed (1 leaky), 2 failed, 0 skipped
        FAIL [   6.240s] git-branchless::test_amend test_amend_with_dirty_submodule
        FAIL [   0.186s] git-branchless-lib::test_status test_get_status_with_dirty_submodule
error: test run failed
```

With errors like this:

```text
        FAIL [   0.186s] git-branchless-lib::test_status test_get_status_with_dirty_submodule
  stdout ───

    running 1 test
    test test_get_status_with_dirty_submodule ... FAILED

    failures:

    failures:
        test_get_status_with_dirty_submodule

    test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 3 filtered out; finished in 0.18s

  stderr ───
    Error:
       0: Git command "/Users/waleed/Workspace/git-v2.37.3/git" ["-c", "protocol.file.allow=always", "submodule", "add", "/var/folders/vb/1pq66tpx5p19gnnmh5bgxn3m0000gn/T/.t

**File**: `git-branchless-lib/src/testing.rs` (modified, +16/-1)
```diff
@@ -16,7 +16,7 @@ use crate::core::config::env_vars::{
     should_use_separate_command_binary,
 };
 use crate::git::{GitRunInfo, GitVersion, NonZeroOid, Repo};
-use crate::util::get_sh;
+use crate::util::{get_from_path, get_sh};
 use color_eyre::Help;
 use eyre::Context;
 use itertools::Itertools;
@@ -48,6 +48,18 @@ fn try_find_cargo_bin(name: &str) -> Option<PathBuf> {
     bin_path.exists().then_some(bin_path)
 }
 
+/// Look up the path where Git shell scripts (e.g. `git-submodule`) might want
+/// to invoke standard Unix utilities.
+///
+/// We add the directory containing the shell binary to the search path, but on
+/// macOS, `sh` lives in `/bin` but tools like `sed` and `basename` live in
+/// `/usr/bin`, so we need to add `/usr/bin` to the search path as well.
+fn get_shell_utils_dir() -> Option<PathBuf> {
+    let basename_path = get_from_path("basename")?;
+    let basename_dir = basename_path.parent()?;
+    Some(basename_dir.to_path_buf())
+}
+
 const DUMMY_NAME: &str = "Testy McTestface";
 const DUMMY_EMAIL: &str = "test@example.com";
 const DUMMY_DATE: &str = "Wed 29 Oct 12:34:56 2020 PDT";
@@ -188,13 +200,16 @@ impl Git {
             .expect("Unable to find git-branchless target directory");
         let bash = get_sh().expect("bash missing?");
         let bash_path = bash.parent().unwrap();
+        let shell_utils_dir = get_shell_utils_dir().expect("shell utils dir missing?");
         std::env::join_paths(vec![
             // For Git to be able to launch `git-branchless`.
             branchless_path.as_os_str(),
             // For our hooks to be able to call back into `git`.
             self.git_exec_path.as_os_str(),
             // For branchless to manually invoke bash when needed.
             bash_path.as_os_str(),
+            // For Git shell scripts to invoke standard Unix utilities.
+            shell_utils_dir.as_os_str(),
         ])
         .expect("joining paths")
     }
```

---

### Incident Patch 8: `b7c825c2` (2026-05-31)
**Commit Message**: fix(test): sanitize path-invalid characters in test command slug

`make_test_command_slug` builds a directory name from the `git test -x`
command but only replaced `/`, space, and newline. On Windows, the other
characters that are invalid in a path (`<>:"\|?*` and ASCII control
characters) passed through into the slug, so `git test` failed to create
its results directory for commands containing pipes, redirects, globs, etc.

Replace any control character or Windows-forbidden character with `__`.
Only path-invalid characters are replaced (not all non-alphanumerics), so
existing slugs for ordinary commands -- and the cached results keyed by
them -- are preserved.

Closes #1629

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- (#1629): `git test` no longer fails to create its results directory when the test command contains characters that are invalid in a path on Windows (such as `|`, `<`, `>`, `:`, `*`, `?`, `"`, or `\`).
+
 ## [v0.11.1] - 2026-05-21
 
 ### Changed
```

**File**: `git-branchless-lib/src/git/test.rs` (modified, +59/-1)
```diff
@@ -43,7 +43,23 @@ pub const TEST_ABORT_EXIT_CODE: i32 = 127;
 
 /// Convert a command string into a string that's safe to use as a filename.
 pub fn make_test_command_slug(command: String) -> String {
-    command.replace(['/', ' ', '\n'], "__")
+    // The slug is used as a directory name, so replace every character that is
+    // invalid in a path component on any supported platform. Windows forbids
+    // `<>:"/\|?*` and ASCII control characters (`/` is also a path separator on
+    // Unix); spaces are replaced for readability. Without this, `git test -x`
+    // commands containing e.g. pipes or redirects fail to create their cache
+    // directory on Windows. See
+    // https://github.com/arxanas/git-branchless/issues/1629.
+    command.replace(
+        |c: char| {
+            c.is_control()
+                || matches!(
+                    c,
+                    '/' | '\\' | '<' | '>' | ':' | '"' | '|' | '?' | '*' | ' '
+                )
+        },
+        "__",
+    )
 }
 
 /// A version of `NonZeroOid` that can be serialized and deserialized.
@@ -137,3 +153,45 @@ pub fn get_test_worktrees_dir(repo: &Repo) -> Result<PathBuf, RepoError> {
 pub fn get_latest_test_command_path(repo: &Repo) -> Result<PathBuf, RepoError> {
     Ok(get_test_dir(repo)?.join("latest-command"))
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn test_make_test_command_slug_replaces_path_invalid_chars() {
+        // The slug is used as a directory name, so it must not contain
+        // characters that are invalid in a path component on any supported
+        // platform. Windows forbids `<>:"/\|?*` and control characters; before
+        // #1629 these passed through unchanged and broke `git test`'s cache
+        // directory creation. This asserts the slug's output contract, so it
+        // fails on every platform (not just Windows).
+        let slug = make_test_command_slug("echo <a> | tee \"f:i*l?e\" > /x\\y".to_string());
+        for invalid in ['/', '\\', '<', '>', ':', '"', '|', '?', '*'] {
+            assert!(
+                !slug.contains(invalid),
+                "slug {slug:?} still contains path-invalid char {invalid:?}"
+            );
+        }
+    }
+
+    #[test]
+    fn test_make_test_command_slug_replaces_control_chars() {
+        // Control characters (including the newline handled before #1629) are
+        // invalid in Windows paths and must not survive into the slug.
+        let slug = make_test_command_slug("a\nb\tc\rd".to_string());
+        assert!(
+            !slug.chars().any(|c| c.is_control()),
+            "slug {slug:?} still contains a control character"
+        );
+    }
+
+    #[test]
+    fn test_make_test_command_slug_preserves_simple_command() {
+        // An ordinary command keeps a human-readable, unchanged slug.
+        assert_eq!(
+            make_test_command_slug("cargo test".to_string()),
+            "cargo__test"
+        );
+    }
+}
```

---

### Incident Patch 9: `4f045800` (2026-05-22)
**Commit Message**: fix(help): show correct name with --version

Without this, clap defaults the name to the crate name (in this case,
git-branchless-opts), not the application or workspace name.

```
❯ git branchless --version
git-branchless-opts 0.11.1

❯ cargo run -- --version
git-branchless 0.11.1
```

**File**: `git-branchless-opts/src/lib.rs` (modified, +1/-1)
```diff
@@ -842,7 +842,7 @@ pub struct GlobalArgs {
 ///
 /// See the documentation at https://github.com/arxanas/git-branchless/wiki.
 #[derive(Debug, Parser)]
-#[clap(version = env!("CARGO_PKG_VERSION"), author = "Waleed Khan <me@waleedkhan.name>")]
+#[clap(name = "git-branchless", version = env!("CARGO_PKG_VERSION"), author = "Waleed Khan <me@waleedkhan.name>")]
 pub struct Opts {
     /// Global arguments.
     #[clap(flatten)]
```

---

### Incident Patch 10: `53dc2362` (2026-05-21)
**Commit Message**: fix(revset): use correct revset expression

! was inplemented incorrectly: I had the lalrpop grammar translate `!` using
the `sole()` revset function, but `sole()` doesn't exist! I have a revset
*alias* defined locally that translates `sole()` to `exactly(.., 1)`, and this
alias was being used unwittingly when I have been using !

The test for `!` didn't catch this because it only did the translation; it
didn't try to evaluate the expression.

Disabling my local alias caused this operator to stop working, and this fix
restored it.

**File**: `git-branchless-revset/src/grammar.lalrpop` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ Expr4: Expr<'input> = {
     <lhs:Expr4> "~"            => Expr::FunctionCall(Cow::Borrowed("ancestors.nth"), vec![lhs, Expr::Name(Cow::Borrowed("1"))]),
     <lhs:Expr4> "~" <rhs:Name> => Expr::FunctionCall(Cow::Borrowed("ancestors.nth"), vec![lhs, Expr::Name(rhs)]),
 
-    <lhs:Expr4> "!"            => Expr::FunctionCall(Cow::Borrowed("sole"),  vec![Expr::FunctionCall(Cow::Borrowed("children"), vec![lhs])]),
+    <lhs:Expr4> "!"            => Expr::FunctionCall(Cow::Borrowed("exactly"),  vec![Expr::FunctionCall(Cow::Borrowed("children"), vec![lhs]), Expr::Name(Cow::Borrowed("1"))]),
 
     <Expr5>
 }
```

**File**: `git-branchless-revset/src/parser.rs` (modified, +16/-4)
```diff
@@ -673,7 +673,7 @@ mod tests {
         insta::assert_debug_snapshot!(parse("foo!"), @r###"
         Ok(
             FunctionCall(
-                "sole",
+                "exactly",
                 [
                     FunctionCall(
                         "children",
@@ -683,6 +683,9 @@ mod tests {
                             ),
                         ],
                     ),
+                    Name(
+                        "1",
+                    ),
                 ],
             ),
         )
@@ -694,7 +697,7 @@ mod tests {
                 "union",
                 [
                     FunctionCall(
-                        "sole",
+                        "exactly",
                         [
                             FunctionCall(
                                 "children",
@@ -704,16 +707,19 @@ mod tests {
                                     ),
                                 ],
                             ),
+                            Name(
+                                "1",
+                            ),
                         ],
                     ),
                     FunctionCall(
-                        "sole",
+                        "exactly",
                         [
                             FunctionCall(
                                 "children",
                                 [
                                     FunctionCall(
-                                        "sole",
+                                        "exactly",
                                         [
                                             FunctionCall(
                                                 "children",
@@ -723,10 +729,16 @@ mod tests {
                                                     ),
                                                 ],
                                             ),
+                                            Name(
+                                                "1",
+                                            ),
                                         ],
                                     ),
                                 ],
                             ),
+                            Name(
+                                "1",
+                            ),
                         ],
                     ),
                 ],
```

#### Recent Merged Pull Requests:
- **PR #1695** (closed): build: bump the deps group across 1 directory with 17 updates (@dependabot[bot])
- **PR #1694** (2026-07-15): fix(move fixup): correctly handle squashing deleted and renamed files (@claytonrcarter)
- **PR #1693** (2026-07-10): build: set rust-toolchain components (@claytonrcarter)
- **PR #1692** (2026-07-10): feat(hooks): ignore ref updates for tags (@claytonrcarter)
- **PR #1690** (2026-07-01): [1/1] fix(docs): fix warnings for private items (@arxanas)
- **PR #1689** (closed): build: bump the deps group across 1 directory with 12 updates (@dependabot[bot])
- **PR #1688** (2026-07-01): build: bump the actions-deps group with 2 updates (@dependabot[bot])
- **PR #1687** (closed): build: bump the deps group across 1 directory with 10 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
