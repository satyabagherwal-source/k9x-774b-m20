# Forensic Learning Record (Deep Inspection): arxanas/git-branchless

> **Canonical Artifact**: `07_PROJECT_LEARNING/arxanas-git-branchless-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arxanas/git-branchless](https://github.com/arxanas/git-branchless))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:51:32.698Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arxanas/git-branchless`
- **Description**: High-velocity, monorepo-scale workflow for Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4132 stars

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
                    name: ReferenceName::from(refname),
                }),
                None => Ok(ReferenceTarget::Direct {
                    oid: value.parse()?,
                }),
            }
        }
    }

    #[instrument]
    fn parse_packed_refs_line(line: &str) -> Option<(ReferenceName, MaybeZeroOid)> {
        if line.is_empty() {
            return None;
        }
        if line.starts_with('#') {
            // The leading `# pack-refs with:` pragma.
            return None;
        }
        if line.starts_with('^') {
            // A peeled ref
            // FIXME actually support peeled refs in packed-refs
            return None;
        }
        if !line.starts_with(|c: char| c.is_ascii_hexdigit()) {
            warn!(?line, "Unrecognized pack-refs line starting character");
            return None;
        }

        lazy_static! {
            static ref RE: regex::Regex = regex::Regex::new(r"^([^ ]+) (.+)$").unwrap();
        };
        match RE.captures(line) {
            None => {
                warn!(?line, "No regex match for pack-refs line");
                None
            }

            Some(captures) => {
                let oid = &captures[1];
                let oid = match MaybeZeroOid::from_str(oid) {
                    Ok(oid) => oid,
                    Err(err) => {
                        warn!(?oid, ?err, "Could not parse OID for pack-refs line");
                        return None;
                    }
                };

                let reference_name = &captures[2];
                let reference_name = ReferenceName::from(reference_name);

                Some((reference_name, oid))
            }
        }
    }

    #[cfg(test)]
    #[test]
    fn test_parse_packed_refs_line() {
        use super::*;

        let line = "1234567812345678123456781234567812345678 refs/foo/bar";
        let name = ReferenceName::from("refs/foo/bar");
        let oid = MaybeZeroOid::from_str("1234567812345678123456781234567812345678").unwrap();
        as
```

### Core Architecture Module: `git-branchless-hook/src/main.rs`
```
fn main() {
    git_branchless_invoke::invoke_subcommand_main(git_branchless_hook::command_main)
}

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
/// All tracked working copy contents are **discarded**, so the caller should
/// take a snapshot of them first, or otherwise ensure that the user's work is
/// not lost.
///
/// If there are untracked changes in the working copy, they are left intact,
/// *unless* they would conflict with the working copy snapshot contents. In
/// that case, the operation is aborted.
pub fn restore_snapshot(
    effects: &Effects,
    git_run_info: &GitRunInfo,
    repo: &Repo,
    event_tx_id: EventTransactionId,
    snapshot: &WorkingCopySnapshot,
) -> EyreExitOr<()> {
    writeln!(
        effects.get_error_stream(),
        "branchless: restoring from snapshot"
    )?;

    // Discard any working copy changes. The caller is responsible for having
    // snapshotted them if necessary.
    try_exit_code!(
        git_run_info
            .run(
                effects,
                Some(event_tx_id),
                &["reset", "--hard", "HEAD", "--"]
            )
            .wrap_err("Discarding working copy changes")?
    );

    // Check out the unstaged changes. Note that we don't call `git reset --hard
    // <target>` directly as part of the previous step, and instead do this
    // two-step process. This second `git checkout` is so that untracked files
    // don't get thrown away as part of checking out the snapshot, but instead
    // abort the procedure.
    // FIXME: it might be worth attempting to un-check-out this commit?
    try_exit_code!(
        git_run_info
            .run(
                effects,
                Some(event_tx_id),
                &[
                    "checkout",
                    &snapshot.commit_unstaged.get_oid().to_string(),
                    "--"
                ],
            )
            .wrap_err("Checking out unstaged changes (fail if conflict)")?
    );

    // Restore any unstaged changes. They're already present in the working
    // copy, so we just have to adjust `HEAD`.
    match &snapshot.head_commit {
        Some(head_commit) => {
            try_exit_code!(
                git
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
pub fn get_restack_preserve_timestamps(repo: &Repo) -> eyre::Result<bool> {
    repo.get_readonly_config()?
        .get_or("branchless.restack.preserveTimestamps", false)
}

/// If `true`, when advancing to a "next" commit, prompt interactively to
/// if there is ambiguity in which commit to advance to.
#[instrument]
pub fn get_next_interactive(repo: &Repo) -> eyre::Result<bool> {
    repo.get_readonly_config()?
        .get_or("branchless.next.interactive", false)
}

/// If `true`, show branches pointing to each commit in the smartlog.
#[instrument]
pub fn get_commit_descriptors_branches(repo: &Repo) -> eyre::Result<bool> {
    repo.get_readonly_config()?
        .get_or("branchless.commitDescriptors.branches", true)
}

/// If `true`, show associated Phabricator commits in the smartlog.
#[instrument]
pub fn get_commit_descriptors_differential_revision(repo: &Repo) -> eyre::Result<bool> {
    repo.get_readonly_config()?
        .get_or("branchless.commitDescriptors.differentialRevision", true)
}

/// If `true`, show the age of each commit in the smartlog.
#[instrument]
pub fn get_commit_descriptors_relative_time(repo: &Repo) -> eyre::Result<bool> {
    repo.get_readonly_config()?
        .get_or("branchless.commitDescriptors.relativeTime", true)
}

/// Config key for `get_restack_warn_abandoned`.
pub const RESTACK_WARN_ABANDONED_CONFIG_KEY: &str = "branchless.restack.warnAbandoned";

/// Possible hint types.
#[derive(Clone, Debug)]
pub enum Hint {
    /// Suggest running `git add` on skipped, untracked files, which are never
    /// automatically reconsidered for tracking.
    AddSkippedFiles,

    /// Suggest running `git test clean` in order to clean cached test results.
    CleanCachedTestResults,

    /// Suggest omitting arguments when they would default to `HEAD`.
    MoveImplicitHeadArgument,

    /// Suggest running `git restack` when a commit is abandoned as part of a `rewrite` event.
    RestackWarnAbandoned,

    /// Suggest running `git restack` when the smartlog prints an abandoned commit.
    SmartlogFixAbando
```

### Core Architecture Module: `git-branchless-lib/src/core/dag.rs`
```
//! Wrapper around the Eden SCM directed acyclic graph implementation, which
//! allows for efficient graph queries.

use std::cmp::Ordering;
use std::collections::HashMap;
use std::fmt::Debug;
use std::future::Future;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use eden_dag::ops::{DagPersistent, Parents};
use eden_dag::set::hints::Hints;
use eden_dag::{DagAlgorithm, Group, VertexListWithOptions, VertexOptions};
use eyre::Context;
use futures::{StreamExt, TryStreamExt};
use itertools::Itertools;
use once_cell::sync::OnceCell;
use tracing::{instrument, trace, warn};

use crate::core::effects::{Effects, OperationType};
use crate::core::eventlog::{CommitActivityStatus, EventCursor, EventReplayer};
use crate::git::{Commit, MaybeZeroOid, NonZeroOid, Repo, Time};

use super::repo_ext::RepoReferencesSnapshot;

impl From<NonZeroOid> for eden_dag::Vertex {
    fn from(oid: NonZeroOid) -> Self {
        eden_dag::Vertex::copy_from(oid.as_bytes())
    }
}

impl TryFrom<eden_dag::Vertex> for MaybeZeroOid {
    type Error = eyre::Error;

    fn try_from(value: eden_dag::Vertex) -> Result<Self, Self::Error> {
        let oid = git2::Oid::from_bytes(value.as_ref())?;
        let oid = MaybeZeroOid::from(oid);
        Ok(oid)
    }
}

impl TryFrom<eden_dag::Vertex> for NonZeroOid {
    type Error = eyre::Error;

    fn try_from(value: eden_dag::Vertex) -> Result<Self, Self::Error> {
        let oid = MaybeZeroOid::try_from(value)?;
        let oid = NonZeroOid::try_from(oid)?;
        Ok(oid)
    }
}

/// A compact set of commits, backed by the Eden DAG.
pub type CommitSet = eden_dag::Set;

/// A vertex referring to a single commit in the Eden DAG.
pub type CommitVertex = eden_dag::Vertex;

impl From<NonZeroOid> for CommitSet {
    fn from(oid: NonZeroOid) -> Self {
        let vertex = CommitVertex::from(oid);
        CommitSet::from_static_names([vertex])
    }
}

impl FromIterator<NonZeroOid> for CommitSet {
    fn from_iter<T: IntoIterator<Item = NonZeroOid>>(iter: T) -> Self {
        let oids = iter
            .into_iter()
            .map(CommitVertex::from)
            .map(Ok)
            .collect_vec();
        CommitSet::from_iter(oids, Hints::default())
    }
}

/// Union together a list of [CommitSet]s.
pub fn union_all(commits: &[CommitSet]) -> CommitSet {
    commits
        .iter()
        .fold(CommitSet::empty(), |acc, elem| acc.union(elem))
}

struct GitParentsBlocking {
    repo: Arc<Mutex<Repo>>,
}

#[async_trait]
impl Parents for GitParentsBlocking {
    async fn parent_names(&self, v: CommitVertex) -> eden_dag::Result<Vec<CommitVertex>> {
        use eden_dag::errors::BackendError;
        trace!(?v, "visiting Git commit");

        let oid = MaybeZeroOid::from_bytes(v.as_ref())
            .map_err(|_e| anyhow::anyhow!("Could not convert to Git oid: {:?}", &v))
            .map_err(BackendError::Other)?;
        let oid = match oid {
            MaybeZeroOid::NonZero(oid) => oid,
            MaybeZeroOid::Zero => return Ok(Vec::new()),
        };

        let repo = self.repo.lock().unwrap();
        let commit = repo
            .find_commit(oid)
            .map_err(|_e| anyhow::anyhow!("Could not resolve to Git commit: {:?}", &v))
            .map_err(BackendError::Other)?;
        let commit = match commit {
            Some(commit) => commit,
            None => {
                // This might be an OID that's been garbage collected, or
                // just a non-commit object. Ignore it in either case.
                return Ok(Vec::new());
            }
        };

        Ok(commit
            .get_parent_oids()
            .into_iter()
            .map(CommitVertex::from)
            .collect())
    }

    async fn hint_subdag_for_insertion(
        &self,
        _heads: &[CommitVertex],
    ) -> Result<eden_dag::MemDag, eden_dag::Error> {
        Ok(eden_dag::MemDag::new())
    }
}

/// Interface to access the directed acyclic graph (DAG) representing Git's
/// commit graph. Based on the Eden SCM DAG.
pub struct Dag {
    inner: eden_dag::Dag,

    /// A set containing the commit which `HEAD` points to. If `HEAD` is unborn,
    /// this is an empty set.
    pub head_commit: CommitSet,

    /// A set containing the commit that the main branch currently points to.
    pub main_branch_commit: CommitSet,

    /// A set containing all commits currently pointed to by local branches.
    pub branch_commits: CommitSet,

    /// A set containing all commits that have been observed by the
    /// `EventReplayer`.
    observed_commits: CommitSet,

    /// A set containing all commits that have been determined to be obsolete by
    /// the `EventReplayer`.
    obsolete_commits: CommitSet,

    public_commits: OnceCell<CommitSet>,
    visible_heads: OnceCell<CommitSet>,
    visible_commits: OnceCell<CommitSet>,
    draft_commits: OnceCell<CommitSet>,
}

impl Dag {
    /// Reopen the DAG for the given repository.
    pub fn try_clone(&self, repo: &Repo) -> eyre::Result<Self> {
        let inner = Self::open_inner_dag(repo)?;
        Ok(Self {
            inner,
            head_commit: self.head_commit.clone(),
            main_branch_commit: self.main_branch_commit.clone(),
            branch_commits: self.branch_commits.clone(),
            observed_commits: self.observed_commits.clone(),
            obsolete_commits: self.obsolete_commits.clone(),
            public_commits: OnceCell::new(),
            visible_heads: OnceCell::new(),
            visible_commits: OnceCell::new(),
            draft_commits: OnceCell::new(),
        })
    }

    /// Initialize the DAG for the given repository, and update it with any
    /// newly-referenced commits.
    #[instrument]
    pub fn open_and_sync(
        effects: &Effects,
        repo: &Repo,
        event_replayer: &EventReplayer,
        event_cursor: EventCursor,
        references_snapshot: &RepoReferencesSnapshot,
    ) -> eyre::Result<Self> {
        let mut dag = Self::open_without_syncing(
            effects,
            repo,
            event_replayer,
            event_cursor,
            references_snapshot,
        )?;
        dag.sync(effects, repo)?;
        Ok(dag)
    }

    /// Initialize a DAG for the given repository, without updating it with new
    /// commits that may have appeared.
    ///
    /// If used improperly, commit lookups could fail at runtime. This function
    /// should only be used for opening the DAG when it's known that no more
    /// live commits have appeared.
    #[instrument]
    pub fn open_without_syncing(
        effects: &Effects,
        repo: &Repo,
        event_replayer: &EventReplayer,
        event_cursor: EventCursor,
        references_snapshot: &RepoReferencesSnapshot,
    ) -> eyre::Result<Self> {
        let observed_commits = event_replayer.get_cursor_oids(event_cursor);
        let RepoReferencesSnapshot {
            head_oid,
            main_branch_oid,
            branch_oid_to_names,
        } = references_snapshot;

        let obsolete_commits: CommitSet = observed_commits
            .iter()
            .copied()
            .filter(|commit_oid| {
                match event_replayer.get_cursor_commit_activity_status(event_cursor, *commit_oid) {
                    CommitActivityStatus::Active | CommitActivityStatus::Inactive => false,
                    CommitActivityStatus::Obsolete => true,
                }
            })
            .collect();

        let dag = Self::open_inner_dag(repo)?;

        let observed_commits: CommitSet = observed_commits.into_iter().collect();
        let head_commit = match head_oid {
            Some(head_oid) => CommitSet::from(*head_oid),
            None => CommitSet::empty(),
        };
        let main_branch_commit = CommitSet::from(*main_branch_oid);
        let branch_commits: CommitSet = branch_oid_to_names.keys().copied().collect();

        Ok(Self {
            inner: dag,
            head_commit,
            main_branch_commit,
            branch_commits,
            observed_commits,
            obsolete_commits,
            public_commits: Default::default(),
            visible_heads: Default::default(),
            visible_commits: Default::default(),
            draft_commits: Default::default(),
        })
    }

    #[instrument]
    fn open_inner_dag(repo: &Repo) -> eyre::Result<eden_dag::Dag> {
        let dag_dir = repo.get_dag_dir()?;
        std::fs::create_dir_all(&dag_dir).wrap_err("Creating .git/branchless/dag dir")?;
        let dag = eden_dag::Dag::open(&dag_dir)
            .wrap_err_with(|| format!("Opening DAG directory at: {:?}", &dag_dir))?;
        Ok(dag)
    }

    fn run_blocking<T>(&self, fut: impl Future<Output = T>) -> T {
        futures::executor::block_on(fut)
    }

    /// Update the DAG with all commits reachable from branches.
    #[instrument]
    fn sync(&mut self, effects: &Effects, repo: &Repo) -> eyre::Result<()> {
        let master_heads = self.main_branch_commit.clone();
        let non_master_heads = self
            .observed_commits
            .union(&self.head_commit)
            .union(&self.branch_commits);
        self.sync_from_oids(effects, repo, master_heads, non_master_heads)
    }

    /// Update the DAG with the given heads.
    #[instrument]
    pub fn sync_from_oids(
        &mut self,
        effects: &Effects,
        repo: &Repo,
        master_heads: CommitSet,
        non_master_heads: CommitSet,
    ) -> eyre::Result<()> {
        let (effects, _progress) = effects.start_operation(OperationType::UpdateCommitGraph);
        let _effects = effects;

        let master_group_options = {
            let mut options = VertexOptions::default();
            options.desired_group = Group::MASTER;
            options
        };
        let master_heads = self
            .commit_set_to_vec(&master_heads)?
            .into_iter()
            .map(|vertex| (CommitVertex::from(vertex), master_group_options.clone()))
            .collect_vec();
        let non_ma
```

### Core Architecture Module: `git-branchless-lib/src/core/effects.rs`
```
//! Wrappers around various side effects.

use bstr::ByteSlice;
use std::fmt::{Debug, Display, Write};
use std::io::{Stderr, Stdout, Write as WriteIo, stderr, stdout};
use std::mem::take;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use std::{io, thread};

use indicatif::{MultiProgress, ProgressBar, ProgressDrawTarget, ProgressStyle};
use itertools::Itertools;
use lazy_static::lazy_static;
use tracing::warn;

use crate::core::formatting::Glyphs;

#[allow(missing_docs)]
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum OperationType {
    BuildRebasePlan,
    CalculateDiff,
    CalculatePatchId,
    CheckForCycles,
    ConstrainCommits,
    DetectDuplicateCommits,
    EvaluateRevset(Arc<String>),
    FilterByTouchedPaths,
    FilterCommits,
    FindPathToMergeBase,
    GetMergeBase,
    GetTouchedPaths,
    GetUpstreamPatchIds,
    InitializeRebase,
    MakeGraph,
    ProcessEvents,
    PushCommits,
    QueryWorkingCopy,
    ReadingFromCache,
    RebaseCommits,
    RepairBranches,
    RepairCommits,
    RunGitCommand(Arc<String>),
    RunTestOnCommit(Arc<String>),
    RunTests(Arc<String>),
    SortCommits,
    SyncCommits,
    UpdateCommitGraph,
    UpdateCommits,
    WalkCommits,
}

impl Display for OperationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OperationType::BuildRebasePlan => write!(f, "Building rebase plan"),
            OperationType::CalculateDiff => write!(f, "Computing diffs"),
            OperationType::CalculatePatchId => write!(f, "Hashing commit contents"),
            OperationType::CheckForCycles => write!(f, "Checking for cycles"),
            OperationType::ConstrainCommits => write!(f, "Creating commit constraints"),
            OperationType::DetectDuplicateCommits => write!(f, "Checking for duplicate commits"),
            OperationType::EvaluateRevset(revset) => {
                write!(f, "Evaluating revset: {revset}")
            }
            OperationType::FilterByTouchedPaths => {
                write!(f, "Filtering upstream commits by touched paths")
            }
            OperationType::FilterCommits => write!(f, "Filtering commits"),
            OperationType::FindPathToMergeBase => write!(f, "Finding path to merge-base"),
            OperationType::GetMergeBase => write!(f, "Calculating merge-bases"),
            OperationType::GetTouchedPaths => write!(f, "Getting touched paths"),
            OperationType::GetUpstreamPatchIds => write!(f, "Enumerating patch IDs"),
            OperationType::InitializeRebase => write!(f, "Initializing rebase"),
            OperationType::MakeGraph => write!(f, "Examining local history"),
            OperationType::PushCommits => write!(f, "Pushing branches"),
            OperationType::ProcessEvents => write!(f, "Processing events"),
            OperationType::QueryWorkingCopy => write!(f, "Querying the working copy"),
            OperationType::ReadingFromCache => write!(f, "Reading from cache"),
            OperationType::RebaseCommits => write!(f, "Rebasing commits"),
            OperationType::RepairBranches => write!(f, "Checking for broken branches"),
            OperationType::RepairCommits => write!(f, "Checking for broken commits"),
            OperationType::RunGitCommand(command) => {
                write!(f, "Running Git command: {}", &command)
            }
            OperationType::RunTests(command) => write!(f, "Running command: {command}"),
            OperationType::RunTestOnCommit(commit) => write!(f, "Waiting to run on {commit}"),
            OperationType::SortCommits => write!(f, "Sorting commits"),
            OperationType::SyncCommits => write!(f, "Syncing commit stacks"),
            OperationType::UpdateCommits => write!(f, "Updating commits"),
            OperationType::UpdateCommitGraph => write!(f, "Updating commit graph"),
            OperationType::WalkCommits => write!(f, "Walking commits"),
        }
    }
}

#[derive(Clone, Debug)]
enum OutputDest {
    Stdout,
    Suppress,
    BufferForTest {
        stdout: Arc<Mutex<Vec<u8>>>,
        stderr: Arc<Mutex<Vec<u8>>>,
    },
}

/// An index into the recursive hierarchy of progress bars. For example, the key
/// `[OperationType::GetMergeBase, OperationType::WalkCommits]` refers to the
/// "walk commits" operation which is nested under the "get merge-base"
/// operation.
type OperationKey = [OperationType];

#[derive(Debug, Default)]
struct RootOperation {
    multi_progress: MultiProgress,
    children: Vec<OperationState>,
}

impl RootOperation {
    pub fn hide_multi_progress(&mut self) {
        self.multi_progress
            .set_draw_target(ProgressDrawTarget::hidden());
    }

    pub fn show_multi_progress(&mut self) {
        self.multi_progress
            .set_draw_target(ProgressDrawTarget::stderr());
    }

    /// If all operations are no longer in progress, clear the multi-progress bar.
    pub fn clear_operations_if_finished(&mut self) {
        if self
            .children
            .iter()
            .all(|operation_state| operation_state.start_times.is_empty())
        {
            if self.multi_progress.clear().is_err() {
                // Ignore error. Assume that the draw target is no longer available
                // to write to.
            }
            self.children.clear();
        }
    }

    pub fn get_or_create_child(&mut self, key: &[OperationType]) -> &mut OperationState {
        match key {
            [] => panic!("Empty operation key"),
            [first, rest @ ..] => {
                let index = match self
                    .children
                    .iter()
                    .find_position(|child| &child.operation_type == first)
                {
                    Some((child_index, _)) => child_index,
                    None => {
                        self.children.push(OperationState {
                            operation_type: first.clone(),
                            progress_bar: ProgressBar::new_spinner(),
                            has_meter: Default::default(),
                            icon: Default::default(),
                            progress_message: first.to_string(),
                            start_times: Default::default(),
                            elapsed_duration: Default::default(),
                            children: Default::default(),
                        });
                        self.children.len() - 1
                    }
                };
                self.children
                    .get_mut(index)
                    .unwrap()
                    .get_or_create_child(rest)
            }
        }
    }

    pub fn get_child(&mut self, key: &[OperationType]) -> Option<&mut OperationState> {
        match key {
            [] => panic!("Empty operation key"),
            [first, rest @ ..] => {
                let index = self
                    .children
                    .iter()
                    .find_position(|child| &child.operation_type == first);
                match index {
                    Some((index, _)) => self.children.get_mut(index).unwrap().get_child(rest),
                    None => None,
                }
            }
        }
    }

    /// Re-render all operation progress bars. This does not change their
    /// ordering like [`Self::refresh_multi_progress`] does.
    pub fn tick(&mut self) {
        let operations = {
            let mut acc = Vec::new();
            Self::traverse_operations(&mut acc, 0, &self.children);
            acc
        };
        for (nesting_level, operation) in operations {
            operation.tick(nesting_level);
        }
    }

    /// Update the ordering of progress bars in the multi-progress. This should be called after
    pub fn refresh_multi_progress(&mut self) {
        let operations = {
            let mut acc = Vec::new();
            Self::traverse_operations(&mut acc, 0, &self.children);
            acc
        };
        if self.multi_progress.clear().is_err() {
            // Ignore the error and assume that the multi-progress is now dead,
            // so it doesn't need to be updated.
        }
        for (nesting_level, operation) in operations {
            // Avoid deadlock inside the progress bar library when we call
            // `add`, which sets the draw target again.
            operation
                .progress_bar
                .set_draw_target(ProgressDrawTarget::hidden());

            self.multi_progress.add(operation.progress_bar.clone());

            // Re-render only after it's been added to the multi-progress, so
            // that the draw target has been set.
            operation.tick(nesting_level);
        }
    }

    fn traverse_operations<'a>(
        acc: &mut Vec<(usize, &'a OperationState)>,
        current_level: usize,
        operations: &'a [OperationState],
    ) {
        for operation in operations {
            acc.push((current_level, operation));
            Self::traverse_operations(acc, current_level + 1, &operation.children);
        }
    }
}

/// The string values associated with [`OperationIcon`]s.
pub mod icons {
    /// Used to indicate success.
    pub const CHECKMARK: &str = "✓";

    /// Used to indicate a warning.
    pub const EXCLAMATION: &str = "!";

    /// Used to indicate failure.
    ///
    /// Can't use "✗️" in interactive progress meters because some terminals think its width is >1,
    /// which seems to cause rendering issues because we use 1 as its width.
    pub const CROSS: &str = "X";
}

/// An icon denoting the status of an operation.
#[derive(Clone, Copy, Debug)]
pub enum OperationIcon {
    /// A suitable waiting icon should be rendered.
    InProgress,

    /// The operation was a success.
    Success,

    /// The operation produced a warning.
    Warning,

    /// The operation was a failure.
    Failure,
}

impl Default for OperationIcon {
    fn default() -> Self {
```

### Core Architecture Module: `git-branchless-lib/src/core/eventlog.rs`
```
//! Process our event log.
//!
//! We use Git hooks to record the actions that the user takes over time, and put
//! them in persistent storage. Later, we play back the actions in order to
//! determine what actions the user took on the repository, and which commits
//! they're still working on.

use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

use std::fmt::Display;
use std::str::FromStr;
use std::time::{Duration, SystemTime};

use eyre::Context;
use tracing::{error, instrument};

use crate::core::effects::{Effects, OperationType};
use crate::core::repo_ext::RepoExt;
use crate::git::{CategorizedReferenceName, MaybeZeroOid, NonZeroOid, ReferenceName, Repo};

use super::repo_ext::RepoReferencesSnapshot;

/// When this environment variable is set, we reuse the ID for the transaction
/// which the caller has already started.
pub const BRANCHLESS_TRANSACTION_ID_ENV_VAR: &str = "BRANCHLESS_TRANSACTION_ID";

// Wrapper around the row stored directly in the database.
#[derive(Clone, Debug)]
struct Row {
    timestamp: f64,
    type_: String,
    event_tx_id: isize,
    ref1: Option<ReferenceName>,
    ref2: Option<ReferenceName>,
    ref_name: Option<ReferenceName>,
    message: Option<ReferenceName>,
}

/// The ID associated with the transactions that created an event.
///
/// A "event transaction" is a group of logically-related events. For example,
/// during a rebase operation, all of the rebased commits have different
/// `CommitEvent`s, but should belong to the same transaction. This improves the
/// experience for `git undo`, since the user probably wants to see or undo all
/// of the logically-related events at once, rather than individually.
///
/// Note that some logically-related events may not be included together in the
/// same transaction. For example, if a rebase is interrupted due to a merge
/// conflict, then the commits applied due to `git rebase` and the commits
/// applied due to `git rebase --continue` may not share the same transaction.
/// In this sense, a transaction is "best-effort".
///
/// Unlike in a database, there is no specific guarantee that an event
/// transaction is an atomic unit of work.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EventTransactionId {
    /// A normal transaction ID.
    Id(isize),

    /// A value indicating that the no events should actually be added for this transaction.
    Suppressed,
}

impl Display for EventTransactionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventTransactionId::Id(event_id) => write!(f, "{event_id}"),
            EventTransactionId::Suppressed => write!(f, "SUPPRESSED"),
        }
    }
}

impl FromStr for EventTransactionId {
    type Err = <isize as FromStr>::Err;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s == "SUPPRESSED" {
            Ok(EventTransactionId::Suppressed)
        } else {
            let event_id = s.parse()?;
            Ok(EventTransactionId::Id(event_id))
        }
    }
}

/// An event that occurred to one of the commits in the repository.
#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    /// Indicates that the commit was rewritten.
    ///
    /// Examples of rewriting include rebases and amended commits.
    ///
    /// We typically want to mark the new version of the commit as active and
    /// the old version of the commit as obsolete.
    RewriteEvent {
        /// The timestamp of the event.
        timestamp: f64,

        /// The transaction ID of the event.
        event_tx_id: EventTransactionId,

        /// The OID of the commit before the rewrite.
        old_commit_oid: MaybeZeroOid,

        /// The OID of the commit after the rewrite.
        new_commit_oid: MaybeZeroOid,
    },

    /// Indicates that a reference was updated.
    ///
    /// The most important reference we track is HEAD. In principle, we can also
    /// track branch moves in this way, but Git doesn't support the appropriate
    /// hook until v2.29 (`reference-transaction`).
    RefUpdateEvent {
        /// The timestamp of the event.
        timestamp: f64,

        /// The transaction ID of the event.
        event_tx_id: EventTransactionId,

        /// The full name of the reference that was updated.
        ///
        /// For example, `HEAD` or `refs/heads/master`.
        ref_name: ReferenceName,

        /// The old referent OID.
        old_oid: MaybeZeroOid,

        /// The updated referent OID.
        new_oid: MaybeZeroOid,

        /// A message associated with the rewrite, if any.
        message: Option<ReferenceName>,
    },

    /// Indicate that the user made a commit.
    ///
    /// User commits should be marked as active.
    CommitEvent {
        /// The timestamp of the event.
        timestamp: f64,

        /// The transaction ID of the event.
        event_tx_id: EventTransactionId,

        /// The new commit OID.
        commit_oid: NonZeroOid,
    },

    /// Indicates that a commit was explicitly obsoleted by the user.
    ///
    /// If the commit in question was not already active, then this has no
    /// practical effect.
    ObsoleteEvent {
        /// The timestamp of the event.
        timestamp: f64,

        /// The transaction ID of the event.
        event_tx_id: EventTransactionId,

        /// The OID of the commit that was obsoleted.
        commit_oid: NonZeroOid,
    },

    /// Indicates that a commit was explicitly un-obsoleted by the user.
    ///
    /// If the commit in question was not already obsolete, then this has no
    /// practical effect.
    UnobsoleteEvent {
        /// The timestamp of the event.
        timestamp: f64,

        /// The transaction ID of the event.
        event_tx_id: EventTransactionId,

        /// The OID of the commit that was unobsoleted.
        commit_oid: NonZeroOid,
    },

    /// Represents a snapshot of the working copy made at a certain time,
    /// typically before a potentially-destructive operation.
    WorkingCopySnapshot {
        /// The timestamp of the event.
        timestamp: f64,

        /// The transaction ID of the event.
        event_tx_id: EventTransactionId,

        /// The OID of the current HEAD commit.
        head_oid: MaybeZeroOid,

        /// The OID of the commit containing metadata about the working copy
        /// snapshot.
        commit_oid: NonZeroOid,

        /// The name of the checked-out branch, if any. This should be a full
        /// reference name like `refs/heads/foo`.
        ref_name: Option<ReferenceName>,
    },
}

impl Event {
    /// Get the timestamp associated with this event.
    pub fn get_timestamp(&self) -> SystemTime {
        let timestamp = match self {
            Event::RewriteEvent { timestamp, .. } => timestamp,
            Event::RefUpdateEvent { timestamp, .. } => timestamp,
            Event::CommitEvent { timestamp, .. } => timestamp,
            Event::ObsoleteEvent { timestamp, .. } => timestamp,
            Event::UnobsoleteEvent { timestamp, .. } => timestamp,
            Event::WorkingCopySnapshot { timestamp, .. } => timestamp,
        };
        SystemTime::UNIX_EPOCH + Duration::from_secs_f64(*timestamp)
    }

    /// Get the event transaction ID associated with this event.
    pub fn get_event_tx_id(&self) -> EventTransactionId {
        match self {
            Event::RewriteEvent { event_tx_id, .. } => *event_tx_id,
            Event::RefUpdateEvent { event_tx_id, .. } => *event_tx_id,
            Event::CommitEvent { event_tx_id, .. } => *event_tx_id,
            Event::ObsoleteEvent { event_tx_id, .. } => *event_tx_id,
            Event::UnobsoleteEvent { event_tx_id, .. } => *event_tx_id,
            Event::WorkingCopySnapshot { event_tx_id, .. } => *event_tx_id,
        }
    }
}

impl TryFrom<Event> for Row {
    type Error = ();

    fn try_from(event: Event) -> Result<Self, Self::Error> {
        let row = match event {
            Event::RewriteEvent {
                event_tx_id: EventTransactionId::Suppressed,
                ..
            }
            | Event::RefUpdateEvent {
                event_tx_id: EventTransactionId::Suppressed,
                ..
            }
            | Event::CommitEvent {
                event_tx_id: EventTransactionId::Suppressed,
                ..
            }
            | Event::ObsoleteEvent {
                event_tx_id: EventTransactionId::Suppressed,
                ..
            }
            | Event::UnobsoleteEvent {
                event_tx_id: EventTransactionId::Suppressed,
                ..
            }
            | Event::WorkingCopySnapshot {
                event_tx_id: EventTransactionId::Suppressed,
                ..
            } => return Err(()),

            Event::RewriteEvent {
                timestamp,
                event_tx_id: EventTransactionId::Id(event_tx_id),
                old_commit_oid,
                new_commit_oid,
            } => Row {
                timestamp,
                event_tx_id,
                type_: String::from("rewrite"),
                ref1: Some(old_commit_oid.into()),
                ref2: Some(new_commit_oid.into()),
                ref_name: None,
                message: None,
            },

            Event::RefUpdateEvent {
                timestamp,
                event_tx_id: EventTransactionId::Id(event_tx_id),
                ref_name,
                old_oid,
                new_oid,
                message,
            } => Row {
                timestamp,
                event_tx_id,
                type_: String::from("ref-move"),
                ref1: Some(old_oid.into()),
                ref2: Some(new_oid.into()),
                ref_name: Some(ref_name),
                message,
            },

            Event::CommitEvent {
                timestamp,
                event_tx_id: EventTransactionId::Id(event_tx_id),
                commit_oid,
            } => Row {
                timestamp,
       
```

### Core Architecture Module: `git-branchless-lib/src/core/formatting.rs`
```
//! Formatting and output helpers.
//!
//! We try to handle both textual output and interactive output (output to a
//! "TTY"). In the case of interactive output, we render with prettier non-ASCII
//! characters and with colors, using shell-specific escape codes.

use std::fmt::Display;

use cursive::theme::{ConcreteEffects, Effect, Style};
use cursive::utils::markup::StyledString;
use cursive::utils::span::Span;

/// Pluralize a quantity, as appropriate. Example:
///
/// ```
/// # use branchless::core::formatting::Pluralize;
/// let p = Pluralize {
///     determiner: None,
///     amount: 1,
///     unit: ("thing", "things"),
/// };
/// assert_eq!(p.to_string(), "1 thing");
///
/// let p = Pluralize {
///     determiner: Some(("this", "these")),
///     amount: 2,
///     unit: ("thing", "things")
/// };
/// assert_eq!(p.to_string(), "these 2 things");
/// ```
pub struct Pluralize<'a> {
    /// The string to render before the amount if the amount is singular vs plural.
    pub determiner: Option<(&'a str, &'a str)>,

    /// The amount of the quantity.
    pub amount: usize,

    /// The string to render after the amount if the amount is singular vs plural.
    pub unit: (&'a str, &'a str),
}

impl Display for Pluralize<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self {
                amount: 1,
                unit: (unit, _),
                determiner: None,
            } => write!(f, "{} {}", 1, unit),

            Self {
                amount,
                unit: (_, unit),
                determiner: None,
            } => write!(f, "{amount} {unit}"),

            Self {
                amount: 1,
                unit: (unit, _),
                determiner: Some((determiner, _)),
            } => write!(f, "{} {} {}", determiner, 1, unit),

            Self {
                amount,
                unit: (_, unit),
                determiner: Some((_, determiner)),
            } => write!(f, "{determiner} {amount} {unit}"),
        }
    }
}

/// Glyphs to use for rendering the smartlog.
#[derive(Clone)]
pub struct Glyphs {
    /// Whether or not ANSI escape codes should be emitted (e.g. to render
    /// color).
    pub should_write_ansi_escape_codes: bool,

    /// Line connecting a parent commit to its single child commit.
    pub line: &'static str,

    /// Line connecting a parent commit with two or more child commits.
    pub line_with_offshoot: &'static str,

    /// Denotes an omitted sequence of commits.
    pub vertical_ellipsis: &'static str,

    /// Line used to connect a parent commit to its non-first child commit.
    pub split: &'static str,

    /// Line used to connect a child commit to its non-first parent commit.
    pub merge: &'static str,

    /// Cursor for a normal visible commit which is not currently checked out.
    pub commit_visible: &'static str,

    /// Cursor for the visible commit which is currently checked out.
    pub commit_visible_head: &'static str,

    /// Cursor for an obsolete commit.
    pub commit_obsolete: &'static str,

    /// Cursor for the obsolete commit which is currently checked out.
    pub commit_obsolete_head: &'static str,

    /// Cursor for a commit belonging to the main branch, which is not currently
    /// checked out.
    pub commit_main: &'static str,

    /// Cursor for a commit belonging to the main branch, which is currently
    /// checked out.
    pub commit_main_head: &'static str,

    /// Cursor for an obsolete commit belonging to the main branch. (This is an
    /// unusual situation.)
    pub commit_main_obsolete: &'static str,

    /// Cursor for an obsolete commit belonging to the main branch, which is
    /// currently checked out. (This is an unusual situation.)
    pub commit_main_obsolete_head: &'static str,

    /// Cursor indicating that some number of commits have been omitted from the
    /// smartlog at this position.
    pub commit_omitted: &'static str,

    /// Cursor indicating that a commit was either merging into this child
    /// commit or merged from this parent commit.
    pub commit_merge: &'static str,

    /// Alternative character for `commit_merge` when the smartlog orientation
    /// is reversed.
    pub commit_merge_rev: &'static str,

    /// Character used to point to the currently-checked-out branch.
    pub branch_arrow: &'static str,

    /// Character used to point to the current worktree.
    pub worktree_current: &'static str,

    /// Character used to point to a linked worktree.
    pub worktree_linked: &'static str,

    /// Bullet-point character for a list of newline-separated items.
    pub bullet_point: &'static str,

    /// Arrow character used when printing a commit cycle.
    pub cycle_arrow: &'static str,

    /// Horizontal line character used when printing a commit cycle.
    pub cycle_horizontal_line: &'static str,

    /// Vertical line character used when printing a commit cycle.
    pub cycle_vertical_line: &'static str,

    /// Corner at the upper left of the arrow used when printing a commit cycle.
    pub cycle_upper_left_corner: &'static str,

    /// Corner at the lower left of the arrow used when printing a commit cycle.
    pub cycle_lower_left_corner: &'static str,
}

impl Glyphs {
    /// Make the `Glyphs` object appropriate for `stdout`.
    pub fn detect() -> Self {
        let color_support = concolor::get(concolor::Stream::Stdout);
        if color_support.color() {
            Glyphs::pretty()
        } else {
            Glyphs::text()
        }
    }

    /// Glyphs used for output to a text file or non-TTY.
    pub fn text() -> Self {
        Glyphs {
            should_write_ansi_escape_codes: false,
            line: "|",
            line_with_offshoot: "|",
            vertical_ellipsis: ":",
            split: "\\",
            merge: "/",
            commit_visible: "o",
            commit_visible_head: "@",
            commit_obsolete: "x",
            commit_obsolete_head: "%",
            commit_main: "O",
            commit_main_head: "@",
            commit_main_obsolete: "X",
            commit_main_obsolete_head: "%",
            commit_omitted: "#",
            commit_merge: "&",
            commit_merge_rev: "&",
            branch_arrow: ">",
            worktree_current: ">",
            worktree_linked: "wt",
            bullet_point: "-",
            cycle_arrow: ">",
            cycle_horizontal_line: "-",
            cycle_vertical_line: "|",
            cycle_upper_left_corner: ",",
            cycle_lower_left_corner: "`",
        }
    }

    /// Glyphs used for output to a TTY.
    pub fn pretty() -> Self {
        Glyphs {
            should_write_ansi_escape_codes: true,
            line: "│",
            line_with_offshoot: "├",
            vertical_ellipsis: "⋮",
            split: "─╮",
            merge: "─╯",
            commit_visible: "○",
            commit_visible_head: "●",
            commit_obsolete: "✕",
            commit_obsolete_head: "⦻",
            commit_omitted: "◌",
            commit_merge: "↓",
            commit_merge_rev: "↑",
            commit_main: "◇",
            commit_main_head: "◆",
            commit_main_obsolete: "✕",
            commit_main_obsolete_head: "❖",
            branch_arrow: "ᐅ",
            worktree_current: "ᐅ",
            worktree_linked: "⎇",
            bullet_point: "•",
            cycle_arrow: "ᐅ",
            cycle_horizontal_line: "─",
            cycle_vertical_line: "│",
            cycle_upper_left_corner: "┌",
            cycle_lower_left_corner: "└",
        }
    }

    /// Return a `Glyphs` object suitable for rendering graphs in the reverse of
    /// their usual order.
    pub fn reverse_order(mut self, reverse: bool) -> Self {
        if reverse {
            std::mem::swap(&mut self.split, &mut self.merge);
            std::mem::swap(&mut self.commit_merge, &mut self.commit_merge_rev);
        }
        self
    }

    /// Write the provided string to `out`, using ANSI escape codes as necessary to
    /// style it.
    ///
    /// TODO: return something that implements `Display` instead of a `String`.
    pub fn render(&self, string: StyledString) -> eyre::Result<String> {
        let result = string
            .spans()
            .map(|span| {
                let Span {
                    content,
                    attr,
                    width: _,
                } = span;
                if self.should_write_ansi_escape_codes {
                    Ok(render_style_as_ansi(content, *attr)?)
                } else {
                    Ok(content.to_string())
                }
            })
            .collect::<eyre::Result<String>>()?;
        Ok(result)
    }
}

impl std::fmt::Debug for Glyphs {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "<Glyphs pretty={:?}>",
            self.should_write_ansi_escape_codes
        )
    }
}

/// Helper to build `StyledString`s by combining multiple strings (both regular
/// `String`s and `StyledString`s).
pub struct StyledStringBuilder {
    elements: Vec<StyledString>,
}

impl Default for StyledStringBuilder {
    fn default() -> Self {
        StyledStringBuilder::new()
    }
}

impl StyledStringBuilder {
    /// Constructor.
    pub fn new() -> Self {
        Self {
            elements: Vec::new(),
        }
    }

    fn append_plain_inner(mut self, text: &str) -> Self {
        self.elements.push(StyledString::plain(text));
        self
    }

    /// Append a plain-text string to the internal buffer.
    pub fn append_plain(self, text: impl AsRef<str>) -> Self {
        self.append_plain_inner(text.as_ref())
    }

    fn append_styled_inner(mut self, text: &str, style: Style) -> Self {
        self.elements.push(StyledString::styled(text, style));
        self
    }

    /// Style the provided `text` using `style`, then append it to the internal
    /// buffer.

```

### Core Architecture Module: `git-branchless-lib/src/core/gc.rs`
```
//! Deal with Git's garbage collection mechanism.
//!
//! Git treats a commit as unreachable if there are no references that point to
//! it or one of its descendants. However, the branchless workflow requires
//! keeping such commits reachable until the user has obsoleted them.
//!
//! This module is responsible for adding extra references to Git, so that Git's
//! garbage collection doesn't collect commits which branchless thinks are still
//! active.

use std::fmt::Write;

use eyre::Context;
use tracing::instrument;

use crate::core::effects::Effects;
use crate::core::eventlog::{
    CommitActivityStatus, EventCursor, EventLogDb, EventReplayer, is_gc_ref,
};
use crate::core::formatting::Pluralize;
use crate::git::{NonZeroOid, Reference, Repo};

/// Find references under `refs/branchless/` which point to commits which are no
/// longer active. These are safe to remove.
pub fn find_dangling_references<'repo>(
    repo: &'repo Repo,
    event_replayer: &EventReplayer,
    event_cursor: EventCursor,
) -> eyre::Result<Vec<Reference<'repo>>> {
    let mut result = Vec::new();
    for reference in repo.get_all_references()? {
        let reference_name = reference.get_name()?;
        if !is_gc_ref(&reference_name) {
            continue;
        }

        // The graph only contains commits, so we don't need to handle the
        // case of the reference not peeling to a valid commit. (It might be
        // a reference to a different kind of object.)
        let commit = match reference.peel_to_commit()? {
            Some(commit) => commit,
            None => continue,
        };

        match event_replayer.get_cursor_commit_activity_status(event_cursor, commit.get_oid()) {
            CommitActivityStatus::Active => {
                // Do nothing.
            }
            CommitActivityStatus::Inactive => {
                // This commit hasn't been observed, but it's possible that the user expected it
                // to remain. Do nothing. See https://github.com/arxanas/git-branchless/issues/412.
            }
            CommitActivityStatus::Obsolete => {
                // This commit was explicitly hidden by some operation.
                result.push(reference)
            }
        }
    }
    Ok(result)
}

/// Mark a commit as reachable.
///
/// Once marked as reachable, the commit won't be collected by Git's garbage
/// collection mechanism until first garbage-collected by branchless itself
/// (using the `gc` function).
///
/// If the commit does not exist (such as if it was already garbage-collected), then this is a no-op.
///
/// Args:
/// * `repo`: The Git repository.
/// * `commit_oid`: The commit OID to mark as reachable.
#[instrument]
pub fn mark_commit_reachable(repo: &Repo, commit_oid: NonZeroOid) -> eyre::Result<()> {
    let ref_name = format!("refs/branchless/{commit_oid}");
    eyre::ensure!(
        Reference::is_valid_name(&ref_name),
        format!("Invalid ref name to mark commit as reachable: {ref_name}")
    );

    // NB: checking for the commit first with `find_commit` is racy, as the `create_reference` call
    // could still fail if the commit is deleted by then, but it's too hard to propagate whether the
    // commit was not found from `create_reference`.
    if repo.find_commit(commit_oid)?.is_some() {
        repo.create_reference(
            &ref_name.into(),
            commit_oid,
            true,
            "branchless: marking commit as reachable",
        )
        .wrap_err("Creating reference")?;
    }

    Ok(())
}

/// Run branchless's garbage collection.
///
/// Frees any references to commits which are no longer visible in the smartlog.
#[instrument]
pub fn gc(effects: &Effects) -> eyre::Result<()> {
    let repo = Repo::from_current_dir()?;
    let conn = repo.get_db_conn()?;
    let event_log_db = EventLogDb::new(&conn)?;
    let event_replayer = EventReplayer::from_event_log_db(effects, &repo, &event_log_db)?;
    let event_cursor = event_replayer.make_default_cursor();

    writeln!(
        effects.get_output_stream(),
        "branchless: collecting garbage"
    )?;
    let dangling_references = find_dangling_references(&repo, &event_replayer, event_cursor)?;
    let num_dangling_references = Pluralize {
        determiner: None,
        amount: dangling_references.len(),
        unit: ("dangling reference", "dangling references"),
    }
    .to_string();
    for mut reference in dangling_references.into_iter() {
        reference.delete()?;
    }

    writeln!(
        effects.get_output_stream(),
        "branchless: {num_dangling_references} deleted",
    )?;
    Ok(())
}

```

### Core Architecture Module: `git-branchless-lib/src/core/mod.rs`
```
//! Core algorithms and data structures.

pub mod check_out;
pub mod config;
pub mod dag;
pub mod effects;
pub mod eventlog;
pub mod formatting;
pub mod gc;
pub mod node_descriptors;
pub mod repo_ext;
pub mod rewrite;
pub mod task;
pub mod untracked_file_cache;
pub mod worktree;

```

### Core Architecture Module: `git-branchless-lib/src/core/node_descriptors.rs`
```
//! Additional description metadata to display for commits.
//!
//! These are rendered inline in the smartlog, between the commit hash and the
//! commit message.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use bstr::{ByteSlice, ByteVec};
use cursive::theme::BaseColor;
use cursive::utils::markup::StyledString;
use lazy_static::lazy_static;
use regex::Regex;
use tracing::instrument;

use crate::core::config::{
    get_commit_descriptors_branches, get_commit_descriptors_differential_revision,
    get_commit_descriptors_relative_time,
};
use crate::git::{
    CategorizedReferenceName, Commit, NonZeroOid, ReferenceName, Repo, ResolvedReferenceInfo,
};

use super::eventlog::{Event, EventCursor, EventReplayer};
use super::formatting::{Glyphs, StyledStringBuilder};
use super::repo_ext::RepoReferencesSnapshot;
use super::rewrite::find_rewrite_target;

/// An object which can be rendered in the smartlog.
#[derive(Clone, Debug)]
pub enum NodeObject<'repo> {
    /// A commit.
    Commit {
        /// The commit.
        commit: Commit<'repo>,
    },

    /// A commit which has been garbage collected, for which detailed
    /// information is no longer available.
    GarbageCollected {
        /// The OID of the garbage-collected commit.
        oid: NonZeroOid,
    },
}

impl NodeObject<'_> {
    fn get_oid(&self) -> NonZeroOid {
        match self {
            NodeObject::Commit { commit } => commit.get_oid(),
            NodeObject::GarbageCollected { oid } => *oid,
        }
    }

    fn get_short_oid(&self) -> eyre::Result<String> {
        match self {
            NodeObject::Commit { commit } => Ok(commit.get_short_oid()?),
            NodeObject::GarbageCollected { oid } => {
                // `7` is the default value for config setting `core.abbrev`.
                Ok(oid.to_string()[..7].to_string())
            }
        }
    }
}

/// Object responsible for redacting sensitive information, so that it can be
/// included in a bug report.
#[derive(Debug)]
pub enum Redactor {
    /// No redaction will be performed. This is the default for general use.
    Disabled,

    /// Redaction will be performed.
    Enabled {
        /// A set of ref names which *shouldn't* be redacted. For example, the
        /// main branch should probably keep its name.
        preserved_ref_names: HashSet<ReferenceName>,

        /// A mapping from ref name to its redacted version.
        ref_names: Arc<Mutex<HashMap<ReferenceName, ReferenceName>>>,
    },
}

impl Redactor {
    /// Constructor.
    pub fn new(preserved_ref_names: HashSet<ReferenceName>) -> Self {
        Self::Enabled {
            preserved_ref_names,
            ref_names: Default::default(),
        }
    }

    /// Redact the given ref name, if appropriate.
    pub fn redact_ref_name(&self, ref_name: ReferenceName) -> ReferenceName {
        match self {
            Redactor::Disabled => ref_name,
            Redactor::Enabled {
                preserved_ref_names,
                ref_names,
            } => {
                if preserved_ref_names.contains(&ref_name) || !ref_name.as_str().contains('/') {
                    return ref_name;
                }

                let mut ref_names = ref_names.lock().expect("Poisoned mutex");
                let len = ref_names.len();
                ref_names
                    .entry(ref_name)
                    .or_insert_with_key(|ref_name| {
                        let categorized_ref_name = CategorizedReferenceName::new(ref_name);
                        let prefix = match categorized_ref_name {
                            CategorizedReferenceName::LocalBranch { name: _, prefix } => prefix,
                            CategorizedReferenceName::RemoteBranch { name: _, prefix } => prefix,
                            CategorizedReferenceName::OtherRef { name: _ } => "",
                        };
                        format!("{prefix}redacted-ref-{len}").into()
                    })
                    .clone()
            }
        }
    }

    /// Redact the given commit summary, if appropriate.
    pub fn redact_commit_summary(&self, summary: String) -> String {
        match self {
            Redactor::Disabled => summary,
            Redactor::Enabled {
                preserved_ref_names: _,
                ref_names: _,
            } => summary
                .chars()
                .map(|char| {
                    if char.is_ascii_whitespace() {
                        char
                    } else {
                        'x'
                    }
                })
                .collect(),
        }
    }
}

/// Interface to display information about a node in the smartlog.
pub trait NodeDescriptor {
    /// Provide a description of the given commit.
    ///
    /// A return value of `None` indicates that this commit descriptor was
    /// inapplicable for the provided commit.
    fn describe_node(
        &mut self,
        glyphs: &Glyphs,
        object: &NodeObject,
    ) -> eyre::Result<Option<StyledString>>;
}

/// Get the complete description for a given commit.
#[instrument(skip(node_descriptors))]
pub fn render_node_descriptors(
    glyphs: &Glyphs,
    object: &NodeObject,
    node_descriptors: &mut [&mut dyn NodeDescriptor],
) -> eyre::Result<StyledString> {
    let descriptions = node_descriptors
        .iter_mut()
        .filter_map(|provider: &mut &mut dyn NodeDescriptor| {
            provider.describe_node(glyphs, object).transpose()
        })
        .collect::<eyre::Result<Vec<_>>>()?;
    let result = StyledStringBuilder::join(" ", descriptions);
    Ok(result)
}

/// Display an abbreviated commit hash.
#[derive(Debug)]
pub struct CommitOidDescriptor {
    use_color: bool,
}

impl CommitOidDescriptor {
    /// Constructor.
    pub fn new(use_color: bool) -> eyre::Result<Self> {
        Ok(CommitOidDescriptor { use_color })
    }
}

impl NodeDescriptor for CommitOidDescriptor {
    #[instrument]
    fn describe_node(
        &mut self,
        _glyphs: &Glyphs,
        object: &NodeObject,
    ) -> eyre::Result<Option<StyledString>> {
        let oid = object.get_short_oid()?;
        let oid = if self.use_color {
            StyledString::styled(oid, BaseColor::Yellow.dark())
        } else {
            StyledString::plain(oid)
        };
        Ok(Some(oid))
    }
}

/// Display the first line of the commit message.
#[derive(Debug)]
pub struct CommitMessageDescriptor<'a> {
    redactor: &'a Redactor,
}

impl<'a> CommitMessageDescriptor<'a> {
    /// Constructor.
    pub fn new(redactor: &'a Redactor) -> eyre::Result<Self> {
        Ok(CommitMessageDescriptor { redactor })
    }
}

impl NodeDescriptor for CommitMessageDescriptor<'_> {
    #[instrument]
    fn describe_node(
        &mut self,
        _glyphs: &Glyphs,
        object: &NodeObject,
    ) -> eyre::Result<Option<StyledString>> {
        let summary = match object {
            NodeObject::Commit { commit } => {
                let summary = commit.get_summary()?.to_vec();
                summary.into_string_lossy()
            }
            NodeObject::GarbageCollected { oid: _ } => "<garbage collected>".to_string(),
        };
        let summary = self.redactor.redact_commit_summary(summary);
        Ok(Some(StyledString::plain(summary)))
    }
}

/// For obsolete commits, provide the reason that it's obsolete.
pub struct ObsolescenceExplanationDescriptor<'a> {
    event_replayer: &'a EventReplayer,
    event_cursor: EventCursor,
}

impl<'a> ObsolescenceExplanationDescriptor<'a> {
    /// Constructor.
    pub fn new(event_replayer: &'a EventReplayer, event_cursor: EventCursor) -> eyre::Result<Self> {
        Ok(ObsolescenceExplanationDescriptor {
            event_replayer,
            event_cursor,
        })
    }
}

impl NodeDescriptor for ObsolescenceExplanationDescriptor<'_> {
    fn describe_node(
        &mut self,
        _glyphs: &Glyphs,
        object: &NodeObject,
    ) -> eyre::Result<Option<StyledString>> {
        let event = self
            .event_replayer
            .get_cursor_commit_latest_event(self.event_cursor, object.get_oid());

        let event = match event {
            Some(event) => event,
            None => return Ok(None),
        };

        let result = match event {
            Event::RewriteEvent { .. } => {
                let rewrite_target =
                    find_rewrite_target(self.event_replayer, self.event_cursor, object.get_oid());
                rewrite_target.map(|rewritten_oid| {
                    StyledString::styled(
                        format!("(rewritten as {})", &rewritten_oid.to_string()[..8]),
                        BaseColor::Black.light(),
                    )
                })
            }

            Event::ObsoleteEvent { .. } => Some(StyledString::styled(
                "(manually hidden)",
                BaseColor::Black.light(),
            )),

            Event::RefUpdateEvent { .. }
            | Event::CommitEvent { .. }
            | Event::UnobsoleteEvent { .. }
            | Event::WorkingCopySnapshot { .. } => None,
        };
        Ok(result)
    }
}

/// Display branches that point to a given commit.
#[derive(Debug)]
pub struct BranchesDescriptor<'a> {
    is_enabled: bool,
    head_info: &'a ResolvedReferenceInfo,
    references_snapshot: &'a RepoReferencesSnapshot,
    redactor: &'a Redactor,
}

impl<'a> BranchesDescriptor<'a> {
    /// Constructor.
    pub fn new(
        repo: &Repo,
        head_info: &'a ResolvedReferenceInfo,
        references_snapshot: &'a RepoReferencesSnapshot,
        redactor: &'a Redactor,
    ) -> eyre::Result<Self> {
        let is_enabled = get_commit_descriptors_branches(repo)?;
        Ok(BranchesDescriptor {
            is_enabled,
            head_info,
            references_snapshot,
            redactor,
        })
    }
}

impl NodeDescriptor for BranchesDescriptor<'_> {
    #[instrument]
    fn describe_nod
```

### Core Architecture Module: `git-branchless-lib/src/core/repo_ext.rs`
```
//! Helper functions on [`Repo`].

use std::collections::{HashMap, HashSet};

use color_eyre::Help;
use eyre::Context;
use tracing::instrument;

use crate::git::{
    Branch, BranchType, CategorizedReferenceName, ConfigRead, NonZeroOid, ReferenceName, Repo,
};

use super::config::get_main_branch_name;

/// A snapshot of all the positions of references we care about in the repository.
#[derive(Debug)]
pub struct RepoReferencesSnapshot {
    /// The location of the `HEAD` reference. This may be `None` if `HEAD` is unborn.
    pub head_oid: Option<NonZeroOid>,

    /// The location of the main branch.
    pub main_branch_oid: NonZeroOid,

    /// A mapping from commit OID to the branches which point to that commit.
    pub branch_oid_to_names: HashMap<NonZeroOid, HashSet<ReferenceName>>,
}

/// Helper functions on [`Repo`].
pub trait RepoExt {
    /// Get the `Branch` for the main branch for the repository.
    fn get_main_branch(&self) -> eyre::Result<Branch<'_>>;

    /// Get the OID corresponding to the main branch.
    fn get_main_branch_oid(&self) -> eyre::Result<NonZeroOid>;

    /// Get a mapping from OID to the names of branches which point to that OID.
    ///
    /// The returned branch names include the `refs/heads/` prefix, so it must
    /// be stripped if desired.
    fn get_branch_oid_to_names(&self) -> eyre::Result<HashMap<NonZeroOid, HashSet<ReferenceName>>>;

    /// Get the positions of references in the repository.
    fn get_references_snapshot(&self) -> eyre::Result<RepoReferencesSnapshot>;

    /// Get the default remote to push to for new branches in this repository.
    fn get_default_push_remote(&self) -> eyre::Result<Option<String>>;
}

impl RepoExt for Repo {
    fn get_main_branch(&self) -> eyre::Result<Branch<'_>> {
        let main_branch_name = get_main_branch_name(self)?;
        match self.find_branch(&main_branch_name, BranchType::Local)? {
            Some(branch) => Ok(branch),
            None => {
                let suggestion = format!(
                    r"
The main branch {:?} could not be found in your repository
at path: {:?}.
These branches exist: {:?}
Either create it, or update the main branch setting by running:

    git branchless init --main-branch <branch>

Note that remote main branches are no longer supported as of v0.6.0. See
https://github.com/arxanas/git-branchless/discussions/595 for more details.",
                    get_main_branch_name(self)?,
                    self.get_path(),
                    self.get_all_local_branches()?
                        .into_iter()
                        .map(|branch| {
                            branch
                                .into_reference()
                                .get_name()
                                .map(|s| format!("{s:?}"))
                                .wrap_err("converting branch to reference")
                        })
                        .collect::<eyre::Result<Vec<String>>>()?,
                );
                Err(eyre::eyre!("Could not find repository main branch")
                    .with_suggestion(|| suggestion))
            }
        }
    }

    #[instrument]
    fn get_main_branch_oid(&self) -> eyre::Result<NonZeroOid> {
        let main_branch = self.get_main_branch()?;
        let main_branch_oid = main_branch.get_oid()?;
        match main_branch_oid {
            Some(main_branch_oid) => Ok(main_branch_oid),
            None => eyre::bail!(
                "Could not find commit pointed to by main branch: {:?}",
                main_branch.get_name()?,
            ),
        }
    }

    #[instrument]
    fn get_branch_oid_to_names(&self) -> eyre::Result<HashMap<NonZeroOid, HashSet<ReferenceName>>> {
        let mut result: HashMap<NonZeroOid, HashSet<ReferenceName>> = HashMap::new();
        for branch in self.get_all_local_branches()? {
            let reference = branch.into_reference();
            let reference_name = reference.get_name()?;
            let reference_info = self.resolve_reference(&reference)?;
            if let Some(reference_oid) = reference_info.oid {
                result
                    .entry(reference_oid)
                    .or_default()
                    .insert(reference_name);
            }
        }

        Ok(result)
    }

    fn get_references_snapshot(&self) -> eyre::Result<RepoReferencesSnapshot> {
        let head_oid = self.get_head_info()?.oid;
        let main_branch_oid = self.get_main_branch_oid()?;
        let branch_oid_to_names = self.get_branch_oid_to_names()?;

        Ok(RepoReferencesSnapshot {
            head_oid,
            main_branch_oid,
            branch_oid_to_names,
        })
    }

    fn get_default_push_remote(&self) -> eyre::Result<Option<String>> {
        let main_branch_name = self.get_main_branch()?.get_reference_name()?;
        match CategorizedReferenceName::new(&main_branch_name) {
            name @ CategorizedReferenceName::LocalBranch { .. } => {
                if let Some(main_branch) =
                    self.find_branch(&name.render_suffix(), BranchType::Local)?
                {
                    if let Some(remote_name) = main_branch.get_push_remote_name()? {
                        return Ok(Some(remote_name));
                    }
                }
            }

            name @ CategorizedReferenceName::RemoteBranch { .. } => {
                let name = name.render_suffix();
                if let Some((remote_name, _reference_name)) = name.split_once('/') {
                    return Ok(Some(remote_name.to_owned()));
                }
            }

            CategorizedReferenceName::OtherRef { .. } => {
                // Do nothing.
            }
        }

        let push_default_remote_opt = self.get_readonly_config()?.get("remote.pushDefault")?;
        Ok(push_default_remote_opt)
    }
}

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

### Incident Patch 3: `4e2f7bbb` (2026-07-10)
**Commit Message**: build: set rust-toolchain components

I was running into issues running RA in Zed in this repo because Zed was using their bundled and (very) current version of RA and it was panicing, presumably due to some version incompat between their newer RA and our older rust. Setting these components allows Zed to use the toolchain version of RA and Zed diagnostics are working again.

**File**: `rust-toolchain.toml` (modified, +1/-0)
```diff
@@ -2,3 +2,4 @@
 # Current minimum-supported Rust version
 channel = "1.86"
 profile = "default"
+components = [ "rustfmt", "clippy", "rust-analyzer" ]
```

---

### Incident Patch 4: `16d97859` (2026-05-20)
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
+            effects,
+            Some(*event_tx_id),
+            &["update-ref", ref_name.as_str(), &new_oid.to_string()],
+        )?);
+        CheckoutTarget::Reference(ref_name)
+    } else {
+        // Detached HEAD, no --create: check out by OID.
+        CheckoutTarget::Oid(new_oid)
+    };
 
     try_exit_code!(check_out_commit(
         effects,
         git_run_info,
         repo,
         event_log_db,
         *event_tx_id,
-        Some(CheckoutTarget::Oid(new_oid)),
+        Some(checkout_target),
         &CheckOutCommitOptions {
-            additional_args: vec![],
-            force_detach: false,
-            reset: false,
             render_smartlog: false,
+            ..Default::default()
         },
     )?);
 
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
+    if !git.supports_reference_transactions()? {
+        return Ok(());
+    }
+    git.init_repo()?;
+    git.commit_file("test1", 1)?;
+
+    let stdout = git.smartlog()?;
+    insta::assert_snapshot!(stdout, @r###"
+        :
+        @ 62fc20d (> master) create test1.txt
+    "###);
+
+    {
+        // Create a new commit and a new branch, which should be checked out.
+        git.branchless(
+            "record",
+            &["-m", "empty commit 1", "--new", "--create", "foo"],
+        )?;
+
+        let stdout = git.smartlog()?;
+        insta::assert_snapshot!(stdout, @r###"
+        :
+        O 62fc20d (master) create test1.txt
+        |
+        @ dc158fa (> foo) empty commit 1
+        "###);
+    }
+
+    Ok(())
+}
```

---

### Incident Patch 5: `6f9041fa` (2026-05-20)
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

### Incident Patch 6: `428fcfe7` (2026-05-18)
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

### Incident Patch 7: `5da501d9` (2026-07-01)
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

### Incident Patch 8: `62764778` (2026-07-01)
**Commit Message**: build: bump the actions-deps group with 2 updates

Bumps the actions-deps group with 2 updates: [actions/checkout](https://github.com/actions/checkout) and [actions/cache](https://github.com/actions/cache).


Updates `actions/checkout` from 6 to 7
- [Release notes](https://github.com/actions/checkout/releases)
- [Changelog](https://github.com/actions/checkout/blob/main/CHANGELOG.md)
- [Commits](https://github.com/actions/checkout/compare/v6...v7)

Updates `actions/cache` from 5 to 6
- [Release notes](https://github.com/actions/cache/releases)
- [Changelog](https://github.com/actions/cache/blob/main/RELEASES.md)
- [Commits](https://github.com/actions/cache/compare/v5...v6)

---
updated-dependencies:
- dependency-name: actions/checkout
  dependency-version: '7'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: actions-deps
- dependency-name: actions/cache
  dependency-version: '6'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: actions-deps
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/generate-wiki-toc.yml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ jobs:
   "generate-toc":
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
         with:
           repository: ${{ github.repository }}.wiki
           token: ${{ secrets.WIKI_UPDATE_TOC_TOKEN }}
```

**File**: `.github/workflows/lint.yml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ jobs:
     runs-on: ubuntu-latest
 
     steps:
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
 
       - name: Forbid nocommit string
         run: |
```

**File**: `.github/workflows/linux-git-devel.yml` (modified, +3/-3)
```diff
@@ -26,13 +26,13 @@ jobs:
     runs-on: ubuntu-latest
 
     steps:
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
         with:
           path: git-master
           repository: git/git
           ref: master
 
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
         with:
           path: git-next
           repository: git/git
@@ -57,7 +57,7 @@ jobs:
           toolchain: 1.86
           override: true
 
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
         with:
           path: git-branchless
 
```

**File**: `.github/workflows/linux.yml` (modified, +3/-3)
```diff
@@ -21,12 +21,12 @@ jobs:
         git-version: ["v2.24.3", "v2.29.2", "v2.33.1", "v2.37.3"]
 
     steps:
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
         with:
           repository: git/git
           ref: ${{ matrix.git-version }}
 
-      - uses: actions/cache@v5
+      - uses: actions/cache@v6
         id: cache-git-build
         with:
           key: ${{ runner.os }}-git-${{ matrix.git-version }}
@@ -61,7 +61,7 @@ jobs:
         git-version: ["v2.24.3", "v2.29.2", "v2.33.1", "v2.37.3"]
 
     steps:
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
       - name: "Download artifact: git"
         uses: actions/download-artifact@v8
         with:
```

**File**: `.github/workflows/macos.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
     runs-on: macos-latest
 
     steps:
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
 
       - name: Set up Rust
         uses: actions-rs/toolchain@v1
```

**File**: `.github/workflows/nix-linux.yml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ jobs:
     name: nix-build
     timeout-minutes: 40
     steps:
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
         with:
           fetch-depth: 0
       - uses: cachix/install-nix-action@v31
```

**File**: `.github/workflows/nix-macos.yml` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ jobs:
     name: nix-build
     timeout-minutes: 40
     steps:
-      - uses: actions/checkout@v6
+      - uses: actions/checkout@v7
         with:
           fetch-depth: 0
       - uses: cachix/install-nix-action@v31
```

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ jobs:
 
     steps:
       - name: Checkout repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: Install packages (Ubuntu)
         if: startsWith(matrix.os, 'ubuntu-24.04')
```

---

### Incident Patch 9: `624edd20` (2026-06-20)
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

### Incident Patch 10: `b7c825c2` (2026-05-31)
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

### Incident Patch 11: `4f045800` (2026-05-22)
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

### Incident Patch 12: `69eaf9cb` (2026-05-21)
**Commit Message**: build: release v0.11.1

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -15,6 +15,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+## [v0.11.1] - 2026-05-21
+
+### Changed
+
+- (#1672): `scm-bisect` has been updated (was missed in v0.11.0)
+
 ## [v0.11.0] - 2026-05-21
 
 ### Added
```

**File**: `Cargo.lock` (modified, +17/-17)
```diff
@@ -1481,7 +1481,7 @@ checksum = "4271d37baee1b8c7e4b708028c57d816cf9d2434acb33a549475f78c181f6253"
 
 [[package]]
 name = "git-branchless"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "bstr",
  "bugreport",
@@ -1526,7 +1526,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-hook"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "console",
  "eyre",
@@ -1542,7 +1542,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-init"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "console",
  "eyre",
@@ -1556,7 +1556,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-invoke"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "clap",
  "color-eyre",
@@ -1573,7 +1573,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-lib"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -1615,7 +1615,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-move"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "eyre",
  "git-branchless-lib",
@@ -1629,7 +1629,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-navigation"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "cursive",
  "eyre",
@@ -1645,7 +1645,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-opts"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "clap",
  "clap_mangen",
@@ -1656,7 +1656,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-query"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "eyre",
  "git-branchless-invoke",
@@ -1671,7 +1671,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-record"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "cursive",
  "cursive_buffered_backend",
@@ -1690,7 +1690,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-revset"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "bstr",
  "chrono",
@@ -1716,7 +1716,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-reword"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "bstr",
  "chrono",
@@ -1734,7 +1734,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-smartlog"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "cursive_core 0.4.6",
  "eyre",
@@ -1749,7 +1749,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-submit"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "clap",
  "cursive_core 0.4.6",
@@ -1775,7 +1775,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-test"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "bstr",
  "clap",
@@ -1805,7 +1805,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-undo"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "cursive",
  "cursive_buffered_backend",
@@ -3595,7 +3595,7 @@ checksum = "088c5d71572124929ea7549a8ce98e1a6fd33d0a38367b09027b382e67c033db"
 
 [[package]]
 name = "scm-bisect"
-version = "0.11.0"
+version = "0.11.1"
 dependencies = [
  "indexmap",
  "insta",
```

**File**: `Cargo.toml` (modified, +16/-16)
```diff
@@ -55,20 +55,20 @@ eden_dag = { package = "sapling-dag", version = "0.1.0" }
 eyre = "0.6.12"
 fslock = "0.2.1"
 futures = "0.3.32"
-git-branchless-hook = { version = "0.11.0", path = "git-branchless-hook" }
-git-branchless-init = { version = "0.11.0", path = "git-branchless-init" }
-git-branchless-invoke = { version = "0.11.0", path = "git-branchless-invoke" }
-git-branchless-move = { version = "0.11.0", path = "git-branchless-move" }
-git-branchless-navigation = { version = "0.11.0", path = "git-branchless-navigation" }
-git-branchless-opts = { version = "0.11.0", path = "git-branchless-opts" }
-git-branchless-query = { version = "0.11.0", path = "git-branchless-query" }
-git-branchless-record = { version = "0.11.0", path = "git-branchless-record" }
-git-branchless-revset = { version = "0.11.0", path = "git-branchless-revset" }
-git-branchless-reword = { version = "0.11.0", path = "git-branchless-reword" }
-git-branchless-smartlog = { version = "0.11.0", path = "git-branchless-smartlog" }
-git-branchless-submit = { version = "0.11.0", path = "git-branchless-submit" }
-git-branchless-test = { version = "0.11.0", path = "git-branchless-test" }
-git-branchless-undo = { version = "0.11.0", path = "git-branchless-undo" }
+git-branchless-hook = { version = "0.11.1", path = "git-branchless-hook" }
+git-branchless-init = { version = "0.11.1", path = "git-branchless-init" }
+git-branchless-invoke = { version = "0.11.1", path = "git-branchless-invoke" }
+git-branchless-move = { version = "0.11.1", path = "git-branchless-move" }
+git-branchless-navigation = { version = "0.11.1", path = "git-branchless-navigation" }
+git-branchless-opts = { version = "0.11.1", path = "git-branchless-opts" }
+git-branchless-query = { version = "0.11.1", path = "git-branchless-query" }
+git-branchless-record = { version = "0.11.1", path = "git-branchless-record" }
+git-branchless-revset = { version = "0.11.1", path = "git-branchless-revset" }
+git-branchless-reword = { version = "0.11.1", path = "git-branchless-reword" }
+git-branchless-smartlog = { version = "0.11.1", path = "git-branchless-smartlog" }
+git-branchless-submit = { version = "0.11.1", path = "git-branchless-submit" }
+git-branchless-test = { version = "0.11.1", path = "git-branchless-test" }
+git-branchless-undo = { version = "0.11.1", path = "git-branchless-undo" }
 git2 = { version = "0.20.4", default-features = false }
 glob = "0.3.3"
 indexmap = "2.14.0"
@@ -77,7 +77,7 @@ itertools = "0.14.0"
 lalrpop = "0.23.1"
 lalrpop-util = "0.23.0"
 lazy_static = "1.5.0"
-lib = { package = "git-branchless-lib", version = "0.11.0", path = "git-branchless-lib" }
+lib = { package = "git-branchless-lib", version = "0.11.1", path = "git-branchless-lib" }
 man = "0.3.0"
 num_cpus = "1.17.0"
 once_cell = "1.21.4"
@@ -86,7 +86,7 @@ portable-pty = "0.9.0"
 rayon = "1.12.0"
 regex = "1.12.3"
 rusqlite = { version = "0.39.0", features = ["bundled"] }
-scm-bisect = { version = "0.11.0", path = "scm-bisect" }
+scm-bisect = { version = "0.11.1", path = "scm-bisect" }
 scm-diff-editor = "0.10.1"
 scm-record = "0.10.1"
 serde = { version = "1.0.219", features = ["derive"] }
```

**File**: `flake.nix` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
             { meta, ... }:
             {
               name = "git-branchless";
-              version = "0.11.0";
+              version = "0.11.1";
               src = self;
               cargoDeps = final.rustPlatform.importCargoLock {
                 lockFile = ./Cargo.lock;
```

**File**: `git-branchless-hook/Cargo.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ edition = "2024"
 license = "MIT OR Apache-2.0"
 name = "git-branchless-hook"
 repository = "https://github.com/arxanas/git-branchless"
-version = "0.11.0"
+version = "0.11.1"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

**File**: `git-branchless-init/Cargo.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ edition = "2024"
 license = "MIT OR Apache-2.0"
 name = "git-branchless-init"
 repository = "https://github.com/arxanas/git-branchless"
-version = "0.11.0"
+version = "0.11.1"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

**File**: `git-branchless-invoke/Cargo.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ edition = "2024"
 license = "MIT OR Apache-2.0"
 name = "git-branchless-invoke"
 repository = "https://github.com/arxanas/git-branchless"
-version = "0.11.0"
+version = "0.11.1"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

**File**: `git-branchless-lib/Cargo.toml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ license = "MIT OR Apache-2.0"
 name = "git-branchless-lib"
 repository = "https://github.com/arxanas/git-branchless"
 rust-version = "1.86"
-version = "0.11.0"
+version = "0.11.1"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

---

### Incident Patch 13: `7dd60baa` (2026-05-21)
**Commit Message**: build: bump scm-bisect to v0.11.0

This will align it with the other git-branchless crates, which I hope will make it easier to release with the rest of the crates.

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -3595,7 +3595,7 @@ checksum = "088c5d71572124929ea7549a8ce98e1a6fd33d0a38367b09027b382e67c033db"
 
 [[package]]
 name = "scm-bisect"
-version = "0.3.0"
+version = "0.11.0"
 dependencies = [
  "indexmap",
  "insta",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ portable-pty = "0.9.0"
 rayon = "1.12.0"
 regex = "1.12.3"
 rusqlite = { version = "0.39.0", features = ["bundled"] }
-scm-bisect = { version = "0.3.0", path = "scm-bisect" }
+scm-bisect = { version = "0.11.0", path = "scm-bisect" }
 scm-diff-editor = "0.10.1"
 scm-record = "0.10.1"
 serde = { version = "1.0.219", features = ["derive"] }
```

**File**: `scm-bisect/Cargo.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ edition = "2024"
 license = "MIT OR Apache-2.0"
 name = "scm-bisect"
 repository = "https://github.com/arxanas/git-branchless"
-version = "0.3.0"
+version = "0.11.0"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

---

### Incident Patch 14: `d7d80654` (2026-05-21)
**Commit Message**: build: release v0.11.0

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -11,6 +11,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 
+### Changed
+
+### Fixed
+
+## [v0.11.0] - 2026-05-21
+
+### Added
+
 - (#1461): added `!` revset postfix operator as shortcut for "only child"
 - (#1464): created `git split` command to extract changes from a commit
 - (#1603): added `git move --dry-run` to test in-memory rebases
```

**File**: `Cargo.lock` (modified, +16/-16)
```diff
@@ -1481,7 +1481,7 @@ checksum = "4271d37baee1b8c7e4b708028c57d816cf9d2434acb33a549475f78c181f6253"
 
 [[package]]
 name = "git-branchless"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "bstr",
  "bugreport",
@@ -1526,7 +1526,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-hook"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "console",
  "eyre",
@@ -1542,7 +1542,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-init"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "console",
  "eyre",
@@ -1556,7 +1556,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-invoke"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "clap",
  "color-eyre",
@@ -1573,7 +1573,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-lib"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -1615,7 +1615,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-move"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "eyre",
  "git-branchless-lib",
@@ -1629,7 +1629,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-navigation"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "cursive",
  "eyre",
@@ -1645,7 +1645,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-opts"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "clap",
  "clap_mangen",
@@ -1656,7 +1656,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-query"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "eyre",
  "git-branchless-invoke",
@@ -1671,7 +1671,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-record"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "cursive",
  "cursive_buffered_backend",
@@ -1690,7 +1690,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-revset"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "bstr",
  "chrono",
@@ -1716,7 +1716,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-reword"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "bstr",
  "chrono",
@@ -1734,7 +1734,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-smartlog"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "cursive_core 0.4.6",
  "eyre",
@@ -1749,7 +1749,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-submit"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "clap",
  "cursive_core 0.4.6",
@@ -1775,7 +1775,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-test"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "bstr",
  "clap",
@@ -1805,7 +1805,7 @@ dependencies = [
 
 [[package]]
 name = "git-branchless-undo"
-version = "0.10.0"
+version = "0.11.0"
 dependencies = [
  "cursive",
  "cursive_buffered_backend",
```

**File**: `Cargo.toml` (modified, +15/-15)
```diff
@@ -55,20 +55,20 @@ eden_dag = { package = "sapling-dag", version = "0.1.0" }
 eyre = "0.6.12"
 fslock = "0.2.1"
 futures = "0.3.32"
-git-branchless-hook = { version = "0.10.0", path = "git-branchless-hook" }
-git-branchless-init = { version = "0.10.0", path = "git-branchless-init" }
-git-branchless-invoke = { version = "0.10.0", path = "git-branchless-invoke" }
-git-branchless-move = { version = "0.10.0", path = "git-branchless-move" }
-git-branchless-navigation = { version = "0.10.0", path = "git-branchless-navigation" }
-git-branchless-opts = { version = "0.10.0", path = "git-branchless-opts" }
-git-branchless-query = { version = "0.10.0", path = "git-branchless-query" }
-git-branchless-record = { version = "0.10.0", path = "git-branchless-record" }
-git-branchless-revset = { version = "0.10.0", path = "git-branchless-revset" }
-git-branchless-reword = { version = "0.10.0", path = "git-branchless-reword" }
-git-branchless-smartlog = { version = "0.10.0", path = "git-branchless-smartlog" }
-git-branchless-submit = { version = "0.10.0", path = "git-branchless-submit" }
-git-branchless-test = { version = "0.10.0", path = "git-branchless-test" }
-git-branchless-undo = { version = "0.10.0", path = "git-branchless-undo" }
+git-branchless-hook = { version = "0.11.0", path = "git-branchless-hook" }
+git-branchless-init = { version = "0.11.0", path = "git-branchless-init" }
+git-branchless-invoke = { version = "0.11.0", path = "git-branchless-invoke" }
+git-branchless-move = { version = "0.11.0", path = "git-branchless-move" }
+git-branchless-navigation = { version = "0.11.0", path = "git-branchless-navigation" }
+git-branchless-opts = { version = "0.11.0", path = "git-branchless-opts" }
+git-branchless-query = { version = "0.11.0", path = "git-branchless-query" }
+git-branchless-record = { version = "0.11.0", path = "git-branchless-record" }
+git-branchless-revset = { version = "0.11.0", path = "git-branchless-revset" }
+git-branchless-reword = { version = "0.11.0", path = "git-branchless-reword" }
+git-branchless-smartlog = { version = "0.11.0", path = "git-branchless-smartlog" }
+git-branchless-submit = { version = "0.11.0", path = "git-branchless-submit" }
+git-branchless-test = { version = "0.11.0", path = "git-branchless-test" }
+git-branchless-undo = { version = "0.11.0", path = "git-branchless-undo" }
 git2 = { version = "0.20.4", default-features = false }
 glob = "0.3.3"
 indexmap = "2.14.0"
@@ -77,7 +77,7 @@ itertools = "0.14.0"
 lalrpop = "0.23.1"
 lalrpop-util = "0.23.0"
 lazy_static = "1.5.0"
-lib = { package = "git-branchless-lib", version = "0.10.0", path = "git-branchless-lib" }
+lib = { package = "git-branchless-lib", version = "0.11.0", path = "git-branchless-lib" }
 man = "0.3.0"
 num_cpus = "1.17.0"
 once_cell = "1.21.4"
```

**File**: `flake.nix` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@
             { meta, ... }:
             {
               name = "git-branchless";
+              version = "0.11.0";
               src = self;
               cargoDeps = final.rustPlatform.importCargoLock {
                 lockFile = ./Cargo.lock;
```

**File**: `git-branchless-hook/Cargo.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ edition = "2024"
 license = "MIT OR Apache-2.0"
 name = "git-branchless-hook"
 repository = "https://github.com/arxanas/git-branchless"
-version = "0.10.0"
+version = "0.11.0"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

**File**: `git-branchless-init/Cargo.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ edition = "2024"
 license = "MIT OR Apache-2.0"
 name = "git-branchless-init"
 repository = "https://github.com/arxanas/git-branchless"
-version = "0.10.0"
+version = "0.11.0"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

**File**: `git-branchless-invoke/Cargo.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ edition = "2024"
 license = "MIT OR Apache-2.0"
 name = "git-branchless-invoke"
 repository = "https://github.com/arxanas/git-branchless"
-version = "0.10.0"
+version = "0.11.0"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

**File**: `git-branchless-lib/Cargo.toml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ license = "MIT OR Apache-2.0"
 name = "git-branchless-lib"
 repository = "https://github.com/arxanas/git-branchless"
 rust-version = "1.86"
-version = "0.10.0"
+version = "0.11.0"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

---

### Incident Patch 15: `53dc2362` (2026-05-21)
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
- **PR #1698** (closed): build: bump the deps group across 1 directory with 21 updates (@dependabot[bot])
- **PR #1695** (closed): build: bump the deps group across 1 directory with 17 updates (@dependabot[bot])
- **PR #1694** (2026-07-15): fix(move fixup): correctly handle squashing deleted and renamed files (@claytonrcarter)
- **PR #1693** (2026-07-10): build: set rust-toolchain components (@claytonrcarter)
- **PR #1692** (2026-07-10): feat(hooks): ignore ref updates for tags (@claytonrcarter)
- **PR #1690** (2026-07-01): [1/1] fix(docs): fix warnings for private items (@arxanas)
- **PR #1689** (closed): build: bump the deps group across 1 directory with 12 updates (@dependabot[bot])
- **PR #1688** (2026-07-01): build: bump the actions-deps group with 2 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
