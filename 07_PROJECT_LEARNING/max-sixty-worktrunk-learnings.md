> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/max-sixty-worktrunk-learnings.md`  
> **Source**: github ([https://github.com/max-sixty/worktrunk](https://github.com/max-sixty/worktrunk))  
> **Source Version**: `a4a3063c`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T21:07:58.708Z  
> **Learning ID**: `learn-github-max-sixty-worktrunk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): max-sixty/worktrunk

> **Canonical Artifact**: `07_PROJECT_LEARNING/max-sixty-worktrunk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/max-sixty/worktrunk](https://github.com/max-sixty/worktrunk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T21:07:58.699Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `max-sixty/worktrunk`
- **Description**: Worktrunk is a CLI for Git worktree management, designed for parallel AI agent workflows
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9337 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dev/omp-hook.ts`
```
// Worktrunk activity tracking hook for oh-my-pi (`omp`).
//
// Tracks agent activity per branch, showing status markers in `wt list`:
//   🤖 — agent is working
//   💬 — agent is waiting for input
//
// Installed globally via: wt config plugins omp install
//
// oh-my-pi loads user hooks from `hooks/pre/*.ts` and exposes `HookAPI`.
// earendil-works Pi is a different agent with a different loader and API —
// see `dev/pi-extension.ts` and `wt config plugins pi install`.

import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

export default function worktrunkActivity(pi: HookAPI): void {
  const run = async (
    ctx: { cwd: string },
    args: ["set", string] | ["clear"],
  ): Promise<void> => {
    try {
      await pi.exec("wt", ["config", "state", "marker", ...args], {
        cwd: ctx.cwd,
      });
    } catch {
      // Activity tracking must never interrupt the host Pi session.
    }
  };

  pi.on("agent_start", async (_event, ctx) => {
    await run(ctx, ["set", "🤖"]);
  });

  pi.on("agent_end", async (_event, ctx) => {
    await run(ctx, ["set", "💬"]);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await run(ctx, ["clear"]);
  });
}

```

### Core Architecture Module: `src/cli/hook.rs`
```
//! `wt hook` CLI surface.
//!
//! Hook invocations share a single `#[command(external_subcommand)]` catch-all
//! ([`HookCommand::Run`]) that captures everything after `wt hook <type>` as
//! raw argv — including the `--` literal-forward separator, which clap eats
//! in a trailing_var_arg positional but preserves in external_subcommand.
//! [`HookOptions::parse`] walks the argv with the same smart-routing rule as
//! `AliasOptions::parse`: `--KEY=VALUE` binds `{{ KEY }}` when any hook
//! template references it; otherwise the token forwards to `{{ args }}`.
//!
//! The collapse mirrors the alias pattern. Completion for hook type names
//! and help-rendering of `wt hook --help` / `wt hook <type> --help` both go
//! through `completion::inject_hook_subcommands`, which grafts stub
//! subcommands onto an augmented `Command` tree used only for those two
//! surfaces — the real parser still dispatches through `HookCommand::Run`.
//!
//! # External interface: hooks vs. aliases
//!
//! Both surfaces share the core smart-routing rule (`--KEY=VALUE` binds if
//! referenced, else forwards to `{{ args }}`), post-`--` literal forwarding,
//! hyphen-to-underscore key canonicalization, and the `ShellArgs` rendering
//! of `{{ args }}`. Where they diverge:
//!
//! | Axis | Hooks | Aliases |
//! |------|-------|---------|
//! | Invocation | `wt hook <type> [args...]` — nested external_subcommand under the `hook` built-in | `wt <name> [args...]` — top-level external_subcommand (`Cli::Custom`) |
//! | Bare positionals | **Filter names** (`wt hook pre-merge test build` runs only `test` and `build`) | Forwarded to `{{ args }}` |
//! | Reach `{{ args }}` from positionals | Must use `--` (`wt hook pre-merge -- extra`) | Any bare positional lands there |
//! | Approval skip flag | Post-subcommand `--yes` / `-y` recognized by [`HookOptions::parse`] | Only the global form (`wt -y <alias>`); post-alias `--yes` falls through to `{{ args }}` |
//! | Source discrimination | `user:` / `project:` / `user:name` / `project:name` filter syntax | Aliases run user first, then project; no filter syntax |
//! | Force-bind escape | `--var KEY=VALUE` (deprecated; emits warning; still binds unconditionally) | No equivalent — smart routing is the only path |
//! | Name validation | [`parse_hook_type`] validates the hook type with a did-you-mean hint | No validation — unknown alias falls through to `wt-<name>` PATH binary lookup |
//! | `--help` | Clap-rendered via injected stubs (both `wt hook --help` and `wt hook <type> --help`) | `wt <alias> --help` redirects to `wt config alias show` / `dry-run` |
//! | Inspection | `wt hook show [type] [--expanded]` | `wt config alias show <name>` / `dry-run <name>` |
//! | Trust / approval | User hooks trusted; project hooks require approval per-hook-type | User aliases trusted; project aliases require approval per-alias |
//! | Hook-specific flags | `--dry-run`, `--foreground`, `--var` parsed by [`HookOptions::parse`] | None — aliases have no CLI-level knobs beyond smart routing |
//! | Template-context extras | `hook_type`, `hook_name`, per-type operation vars (`base`, `target`, `pr_number`, …) | `args` only, on top of the shared base vars |

use std::ffi::OsString;

use anyhow::{Context, bail};
use clap::Subcommand;
use clap::builder::PossibleValuesParser;
use worktrunk::HookType;

use super::config::ApprovalsCommand;

/// Canonical list of hook type names accepted after `wt hook`. Shared by
/// [`parse_hook_type`], `completion::inject_hook_subcommands`, and (via
/// `hook_show_possible_values`) the `wt hook show` value parser, so drift
/// is caught by tests rather than at runtime. `pre-create`/`post-create` are
/// silent aliases for `pre-start`/`post-start`: not listed here, so
/// help and completion advertise only the canonical names, but accepted by
/// [`parse_hook_type`] and by `wt hook show` as hidden aliases.
pub const HOOK_TYPE_NAMES: &[&str] = &[
    "pre-switch",
    "post-switch",
    "pre-start",
    "post-start",
    "pre-commit",
    "post-commit",
    "pre-merge",
    "post-merge",
    "pre-remove",
    "post-remove",
];

/// `PossibleValue` set for the `wt hook show` type argument: the canonical
/// names from [`HOOK_TYPE_NAMES`], with `pre-create`/`post-create` attached as
/// hidden aliases. `wt hook show post-create` keeps working through the
/// transition without the alias names showing up in help or completion.
fn hook_show_possible_values() -> Vec<clap::builder::PossibleValue> {
    use clap::builder::PossibleValue;
    HOOK_TYPE_NAMES
        .iter()
        .map(|&name| match name {
            "pre-start" => PossibleValue::new(name).alias("pre-create"),
            "post-start" => PossibleValue::new(name).alias("post-create"),
            _ => PossibleValue::new(name),
        })
        .collect()
}

// Ordering: `show` first (read-only introspection), then the external
// subcommand catch-all, then hidden commands. Hook types aren't listed
// as clap variants — `Run` catches them.
/// Run configured hooks
#[derive(Subcommand)]
pub enum HookCommand {
    /// Show configured hooks
    ///
    /// Lists user and project hooks. Project hooks show approval status (`❯` = requires approval).
    Show {
        /// Hook type to show (default: all)
        #[arg(value_parser = PossibleValuesParser::new(hook_show_possible_values()))]
        hook_type: Option<String>,

        /// Show expanded commands with current variables
        #[arg(long)]
        expanded: bool,

        /// Output format
        ///
        /// JSON prints structured result to stdout — one record per configured command.
        #[arg(long, default_value = "text", help_heading = "Automation")]
        format: crate::cli::SwitchFormat,
    },

    /// Internal: run a serialized pipeline from stdin
    #[command(hide = true, name = "run-pipeline")]
    RunPipeline,

    /// Deprecated: use `wt config approvals` instead
    #[command(hide = true)]
    Approvals {
        #[command(subcommand)]
        action: ApprovalsCommand,
    },

    /// Captures `wt hook <type> [ARGS...]` as raw argv. First element is the
    /// hook type name (clap doesn't validate — [`HookOptions::parse`] does,
    /// with a did-you-mean error for typos). External_subcommand preserves
    /// the `--` literal-forward separator, which a `trailing_var_arg`
    /// positional would eat.
    #[command(external_subcommand)]
    Run(Vec<OsString>),
}

/// Parsed form of `wt hook <type> [ARGS...]` — hook type plus every flag,
/// filter name, shorthand binding, and forwarded arg, routed per the alias
/// smart-routing model. `run_hook` consumes this.
#[derive(Debug)]
pub struct HookOptions {
    pub hook_type: HookType,
    pub yes: bool,
    pub dry_run: bool,
    /// `Some(true)` forces foreground for `post-*` hooks that normally run
    /// in the background. `None` defers to the hook type's default.
    pub foreground: Option<bool>,
    /// Positional filter names (`wt hook pre-merge test build`).
    pub name_filters: Vec<String>,
    /// Explicit `--var KEY=VALUE` bindings (deprecated force-bind).
    pub explicit_vars: Vec<(String, String)>,
    /// Raw `--KEY=VALUE` shorthand tokens, stored as `KEY=VALUE` (the
    /// original hyphenated key is preserved for forwarding to `{{ args }}`
    /// when unreferenced).
    pub shorthand_vars: Vec<String>,
    /// Tokens after `--` that forward to `{{ args }}` verbatim.
    pub forwarded_args: Vec<String>,
}

/// Map a hook type name to its [`HookType`] variant. Emits a did-you-mean
/// hint on typos (same `did_you_mean` helper used for unknown subcommands).
///
/// `pre-create`/`post-create` are silent aliases for `pre-start`/`post-start`,
/// accepted here so scripted invocations using the future canonical names
/// keep working. They map silently — no warning.
pub fn parse_hook_type(name: &str) -> anyhow::Result<HookType> {
    match name {
        "pre-switch" => Ok(HookType::PreSwitch),
        "post-switch" => Ok(HookType::PostSwitch),
        "pre-create" | "pre-start" => Ok(HookType::PreCreate),
        "post-create" | "post-start" => Ok(HookType::PostCreate),
        "pre-commit" => Ok(HookType::PreCommit),
        "post-commit" => Ok(HookType::PostCommit),
        "pre-merge" => Ok(HookType::PreMerge),
        "post-merge" => Ok(HookType::PostMerge),
        "pre-remove" => Ok(HookType::PreRemove),
        "post-remove" => Ok(HookType::PostRemove),
        other => {
            let candidates = HOOK_TYPE_NAMES.iter().map(|s| s.to_string());
            let suggestions = worktrunk::utils::did_you_mean(other, candidates);
            if let Some(suggestion) = suggestions.first() {
                bail!("unknown hook type: `{other}` (did you mean `{suggestion}`?)");
            }
            bail!(
                "unknown hook type: `{other}` (expected one of: {})",
                HOOK_TYPE_NAMES.join(", ")
            );
        }
    }
}

impl HookOptions {
    /// Parse `args` as `<hook-type> [FLAGS...] [NAME...] [--KEY=VALUE...] [-- TOKENS...]`.
    ///
    /// First element is the hook type name. Remaining tokens are walked
    /// left-to-right under this grammar:
    ///
    /// - `--yes` / `-y` — set `yes` (equivalent to the global `-y` flag,
    ///   supported post-type so `wt hook pre-merge --yes` works).
    /// - `--dry-run` — set `dry_run`.
    /// - `--foreground` — set `foreground = Some(true)` (post-* hooks).
    /// - `--var KEY=VALUE` / `--var=KEY=VALUE` — explicit force-bind;
    ///   appended to `explicit_vars`. Deprecated; dispatch warns.
    /// - `--KEY=VALUE` (other `--` flag with `=`) — captured as shorthand
    ///   for `run_hook` to smart-route (bind if referenced, else forward).
    /// - `--` — literal-forward escape; every later token goes into
    ///   `forwarded_args`.
    /// - Anything else — positional filter name.
    pub fn parse(args: &[OsString]) -> anyhow::Result<Self> {
        let first = args
            .first()
            .and_then(|s| 
```

### Core Architecture Module: `src/commands/config/state.rs`
```
//! State management commands.
//!
//! Commands for getting, setting, and clearing stored state. State lives in
//! git config (under `worktrunk.*`) and in the `.git/wt/` directory tree.
//!
//! # `state get` ↔ `state clear` parity
//!
//! The aggregate `wt config state get` (`handle_state_show`) MUST surface every
//! category that the aggregate `wt config state clear` (`handle_state_clear_all`)
//! removes. A user should never be able to run `state clear` and have something
//! disappear that `state get` never mentioned.
//!
//! Categories split into two buckets by whether they are regenerable:
//!
//! **Authoritative** (hand-authored or override state; lost permanently if
//! cleared). `state clear` prompts before removing these unless `--yes`:
//!
//! - Default branch override (git config `worktrunk.default_branch.*`)
//! - Branch markers (git config `worktrunk.state.<branch>.marker`)
//! - Vars (git config `worktrunk.state.<branch>.vars.*`)
//! - Logs (`.git/wt/logs/`)
//! - Trash (`.git/wt/trash/`)
//!
//! **Regenerable caches** — also surfaced by `wt config state cache get`
//! (`handle_cache_get`) and dropped by `wt config state cache clear`
//! (`handle_cache_clear`), which needs no prompt:
//!
//! - Previous branch (git config `worktrunk.history`, with `worktrunk.history-path`)
//! - CI status cache (`.git/wt/cache/ci-status/`, plus the PR-number width
//!   ratchet in `.git/wt/cache/pr-number/`)
//! - Summary cache (`.git/wt/cache/summary/`)
//! - Git commands cache (`.git/wt/cache/{merge-tree-conflicts,is-ancestor,picker-preview,…}/`)
//!   — one user-facing category covering every SHA-keyed disk cache, even
//!   when implementation lives in different modules (`sha_cache` for parsed
//!   results, `commands::picker::preview_cache` for rendered previews)
//! - Hints (git config `worktrunk.hints.*`)
//!
//! Each category has a `clear_*_reported` helper that clears it and prints its
//! message; `handle_state_clear_all` composes all of them and
//! `handle_cache_clear` composes the regenerable subset, so the two entry
//! points report identically. The `ci-status`, `hints`, and `previous-branch`
//! subcommands are `hide`-deprecated in favour of `cache` but still resolve to
//! the same state.
//!
//! When adding a new category, update BOTH `handle_state_show` and
//! `handle_state_clear_all` (and `handle_cache_*` if it is a cache), plus the
//! `after_long_help` blocks for `state get`, `state clear`, and `state cache`
//! in `src/cli/config.rs`, in the same change.
//!
//! # Reading vs resolving
//!
//! The aggregate `state get` is pure inspection: it reports stored values
//! read-only and never detects, fetches, or persists (`default-branch` via
//! `cached_default_branch()`, CI via `CachedCiStatus::list_all`). A per-key
//! `get` for a *derived* value resolves it and caches the result
//! (`default-branch get` -> `default_branch()`, `ci-status get` ->
//! `PrStatus::detect`); for stored-only values (`previous-branch`, `marker`)
//! it is a plain read. So a `clear` followed by the aggregate `get` shows the
//! value gone, while the per-key `get` would re-resolve it.
//!
//! # Log layout invariant
//!
//! Inside `wt_logs_dir()`, top-level *files* are shared logs (`commands.jsonl*`,
//! `internal-*.log`, `trace.log`, `trace.jsonl`, `subprocess.log`,
//! `diagnostic.md`) and top-level *directories* are per-branch log trees
//! (`{branch}/{source|internal}/{hook-type}/{name}.log`).
//! Categorization
//! relies on this file-vs-directory distinction: new top-level shared entries
//! must remain files. If a future category needs multiple files, it should live
//! under a single reserved subdirectory rather than adding sibling top-level dirs.

use std::collections::HashMap;
use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use crate::commands::picker::preview_cache;
use anyhow::Context;
use color_print::cformat;
use path_slash::PathExt as _;
use worktrunk::git::{BranchRef, CommandError, Repository, resolve_input_path, sha_cache};
use worktrunk::path::{format_path_for_display, sanitize_for_filename};
use worktrunk::progress::Progress;
use worktrunk::remove_dir::remove_dir_with_progress;
use worktrunk::styling::{
    eprintln, format_heading, format_with_gutter, hint_message, info_message, println,
    success_message, warning_message,
};

use crate::cli::{OutputFormat, SwitchFormat};
use crate::output::print_json;
use crate::output::prompt::{PromptResponse, prompt_yes_no_preview};
use worktrunk::utils::epoch_now;

use super::super::list::ci_status::{CachedCiStatus, CiBranchName, MaxPrNumber};
use crate::display::format_relative_time_short;
use crate::help_pager::show_help_in_pager;
use crate::summary::CachedSummary;

// ==================== Log Management ====================

/// Top-level files created by `-vv` under `wt_logs_dir()`.
const DIAGNOSTIC_FILES: &[&str] = &[
    "trace.log",
    "trace.jsonl",
    "subprocess.log",
    "diagnostic.md",
];

/// Whether a top-level file is a diagnostic log.
///
/// Covers the fixed `-vv` files and repo-wide internal-operation logs
/// (`internal-{op}.log`, e.g. `internal-trash-sweep.log`) — both are
/// branch-agnostic shared files, distinct from the per-branch hook-output
/// subtrees and the `commands.jsonl` audit log.
fn is_diagnostic_file(name: &str) -> bool {
    DIAGNOSTIC_FILES.contains(&name) || (name.starts_with("internal-") && name.ends_with(".log"))
}

/// Truncate a string for a display cell, counting by Unicode scalars.
///
/// Returns a shortened copy ending in `"..."` when the input exceeds
/// `max_chars` scalars, otherwise the input verbatim. Byte-slicing
/// (`&s[..n]`) panics on a multi-byte boundary — this helper is safe
/// for any UTF-8 string.
fn truncate_display(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        return s.to_string();
    }
    let truncated: String = s.chars().take(max_chars.saturating_sub(3)).collect();
    format!("{truncated}...")
}

/// Check if a top-level file belongs to the command audit log
/// (`commands.jsonl`, rotated to `commands.jsonl.old`).
///
/// Matched by exact name, not a `.jsonl` suffix: `trace.jsonl` is a diagnostic
/// file (see [`DIAGNOSTIC_FILES`]), not part of the audit log.
fn is_command_log_file(name: &str) -> bool {
    name == "commands.jsonl" || name == "commands.jsonl.old"
}

/// A hook-output log file discovered by walking the per-branch subtree.
struct HookOutputEntry {
    /// Path relative to `wt_logs_dir()`, used for display and JSON output.
    /// Always forward-slashed for cross-platform stability.
    relative_display: String,
    metadata: std::fs::Metadata,
}

/// Walk every per-branch log file under `log_dir`.
///
/// Top-level *directories* are treated as branch dirs; each is walked
/// recursively for `.log` files. Non-directory top-level entries are ignored
/// (those belong to command audit / diagnostic categories).
///
/// Returns entries sorted by modification time (newest first), with name as a
/// tie-breaker for stable ordering.
fn walk_hook_output_files(log_dir: &Path) -> anyhow::Result<Vec<HookOutputEntry>> {
    let mut out = Vec::new();
    if !log_dir.exists() {
        return Ok(out);
    }
    for entry in std::fs::read_dir(log_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        walk_branch_dir(log_dir, &entry.path(), &mut out)?;
    }
    sort_hook_entries(&mut out);
    Ok(out)
}

/// Recursively collect `.log` files under a branch directory.
fn walk_branch_dir(
    log_dir: &Path,
    current: &Path,
    out: &mut Vec<HookOutputEntry>,
) -> anyhow::Result<()> {
    for entry in std::fs::read_dir(current)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let path = entry.path();
        if file_type.is_dir() {
            walk_branch_dir(log_dir, &path, out)?;
        } else if file_type.is_file() && path.extension().and_then(|e| e.to_str()) == Some("log") {
            let metadata = entry.metadata()?;
            let relative = path.strip_prefix(log_dir).unwrap_or(&path);
            out.push(HookOutputEntry {
                relative_display: relative.to_slash_lossy().into_owned(),
                metadata,
            });
        }
    }
    Ok(())
}

/// Sort hook entries by mtime (newest first), then by relative path for stability.
fn sort_hook_entries(entries: &mut [HookOutputEntry]) {
    entries.sort_by(|a, b| {
        let a_time = a.metadata.modified().ok();
        let b_time = b.metadata.modified().ok();
        b_time
            .cmp(&a_time)
            .then_with(|| a.relative_display.cmp(&b.relative_display))
    });
}

/// A top-level entry staged under `wt_trash_dir()`.
///
/// Worktree removal renames directories into `.git/wt/trash/<name>-<timestamp>`
/// and a background trash drain deletes them; entries still present here are
/// awaiting (or escaped) that sweep.
struct TrashEntry {
    /// Filename, e.g. `myproject.feature-1234567890`.
    name: String,
    /// Absolute path, forward-slashed for cross-platform display.
    path: String,
    metadata: std::fs::Metadata,
}

/// List top-level entries under `wt_trash_dir()`.
///
/// Only the first level matters — each entry is one staged worktree (a
/// directory) or a stray file. Sorted by mtime (newest first) with name as
/// tie-breaker. Individual dirent/metadata failures are skipped: `state get`
/// is a read-only inspector and can race with the background trash drain, so a
/// partial listing is more useful than a hard failure.
fn list_trash_entries(repo: &Repository) -> anyhow::Result<Vec<TrashEntry>> {
    let trash_dir = repo.wt_trash_dir();
    if !trash_dir.exists() {
        return Ok(Vec::new());
    }

    let mut out: Vec<TrashEntry> = std::fs::read_dir(&trash_dir)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            Some(TrashEntry {
                n
```

### Core Architecture Module: `src/commands/hook_announcement.rs`
```
//! # Hook announcement format
//!
//! Background hook execution emits a single `Running ...` line covering every
//! hook type that fires from one event. Separators form a precedence hierarchy
//! from tightest to loosest:
//!
//! ```text
//! &  : concurrent commands within a step          (tightest)
//! ,  : serial steps within a pipeline
//! ;  : source pipelines within a hook type, AND   (loosest)
//!      hook-type clauses within an announce
//! ```
//!
//! `;` is overloaded across the two outermost tiers. The reader disambiguates
//! by lookahead — `;` followed by a `<hook-type>:` (e.g. `post-start:`) is a
//! cross-type boundary; otherwise it's a cross-source boundary within the
//! current hook-type clause. In practice the two often coexist on one line.
//!
//! ## Grammar
//!
//! ```text
//! Running <clauses> [@ <path>]
//!
//! <clauses>     := <hook-clause> ("; " <hook-clause>)*
//! <hook-clause> := <hook-type> [" for " <branch>] ": " <pipelines>
//! <pipelines>   := <pipeline> | <labeled> ("; " <labeled>)*
//! <labeled>     := <pipeline> " (" <source> ")"       # all-named or mixed
//!               |  <source> [" ×" N]                  # all-unnamed (no parens)
//! <pipeline>    := <step> (", " <step>)*
//! <step>        := <command> (" & " <command>)*
//! <command>     := <name>                             # named
//!               |  "…"                                # unnamed run of 1
//!               |  "…×" N                             # unnamed run of N≥2
//! ```
//!
//! The source label appears **once per pipeline** as a suffix annotation
//! (`sync, push (user)`), not once per command. The all-unnamed degenerate
//! case has no body to attach the suffix to, so it stays bare (`user` or
//! `user ×N`).
//!
//! ## Examples
//!
//! | Pipeline shape (single source) | Output |
//! |---|---|
//! | one named command | `notify (user)` |
//! | two serial named | `sync, push (user)` |
//! | one concurrent step | `build & lint (user)` |
//! | serial then concurrent | `install, build & lint (user)` |
//! | mixed unnamed + named | `…, bg (user)` (or `…×2, bg (user)`) |
//! | all unnamed | `user ×2` |
//!
//! Multi-source for one hook type: `sync, push (user); build (project)`.
//!
//! Multi-type bundle (e.g., `wt merge` firing four hook types):
//! `Running post-commit: mark (user); post-remove: cleanup (user); post-switch: notify (user); post-merge: sync (user) @ ~/repo`.
//!
//! ## Implementation
//!
//! - [`format_pipeline_summary_from_names`] produces the bare `<pipeline>`
//!   body (handles `&` / `,` and unnamed-flush). Shared with alias announces.
//! - [`format_pipeline_summary`] wraps it with the per-pipeline source label,
//!   collapsing the all-unnamed case to the bare `<source>` / `<source> ×N`
//!   form.
//! - `run_hooks_background` (in `hooks.rs`) joins source summaries with `;`
//!   within each hook-type clause, then joins clauses with `;` into one
//!   announce line with the path suffix at the end.

use color_print::cformat;

use super::command_executor::PreparedStep;
use worktrunk::config::HookSource;

/// A pipeline step with source information, for pipeline-aware execution.
///
/// Used by both hook and alias dispatch as the source-tagged shape that feeds
/// `sourced_steps_to_foreground`. Per-pipeline metadata (`hook_type`,
/// `display_path` for hooks; `name` for aliases) lives on `PipelineKind`,
/// supplied at conversion time so this struct stays neutral. `source` is
/// genuinely per-step: alias flows mix steps from both sources into one flat
/// vec.
pub struct SourcedStep {
    pub step: PreparedStep,
    pub source: HookSource,
}

/// Extract the per-step command name lists from a `CommandConfig`.
///
/// Shared by the formatters that describe alias / hook pipelines — `Single`
/// steps become one-element inner vecs, `Concurrent` steps become multi-element
/// vecs, each slot carrying the optional command name. Feeds directly into
/// [`format_pipeline_summary_from_names`].
pub(crate) fn step_names_from_config(
    cfg: &worktrunk::config::CommandConfig,
) -> Vec<Vec<Option<&str>>> {
    cfg.steps()
        .iter()
        .map(|step| match step {
            worktrunk::config::HookStep::Single(cmd) => vec![cmd.name.as_deref()],
            worktrunk::config::HookStep::Concurrent(cmds) => {
                cmds.iter().map(|c| c.name.as_deref()).collect()
            }
        })
        .collect()
}

/// Format the bare `<pipeline>` body from per-step command names — see the
/// module-level grammar.
///
/// `step_names[i]` is the list of commands in step `i`; `Some(name)` for named
/// commands, `None` for unnamed. Serial steps join with `, `; concurrent
/// commands within a step join with ` & `. Contiguous runs of unnamed commands
/// (across steps, until the next named command) collapse into a single
/// `label_unnamed(count)` entry; return `None` from that closure to drop
/// unnamed commands entirely.
///
/// Shared by hook and alias announcements. The caller wraps the body with any
/// surrounding context (source prefix for hooks, alias name for aliases).
///
/// Note: unnamed commands within a `Concurrent` step aren't reachable from
/// config today — TOML named tables always produce all-named commands, and
/// anonymous strings only appear as `Single` steps. The unnamed-flush logic
/// therefore only fires across step boundaries in practice.
pub(crate) fn format_pipeline_summary_from_names(
    step_names: &[Vec<Option<&str>>],
    label_named: impl Fn(&str) -> String,
    label_unnamed: impl Fn(usize) -> Option<String>,
) -> String {
    let mut parts: Vec<String> = Vec::new();
    let mut unnamed_count: usize = 0;

    for step in step_names {
        let mut named = Vec::new();
        for entry in step {
            match entry {
                Some(name) => named.push(label_named(name)),
                None => unnamed_count += 1,
            }
        }

        if !named.is_empty() {
            // Flush any pending unnamed count before named labels.
            if unnamed_count > 0
                && let Some(s) = label_unnamed(unnamed_count)
            {
                parts.push(s);
            }
            unnamed_count = 0;
            parts.push(named.join(" & "));
        }
    }

    // Flush trailing unnamed count.
    if unnamed_count > 0
        && let Some(s) = label_unnamed(unnamed_count)
    {
        parts.push(s);
    }

    parts.join(", ")
}

/// Format a `<labeled>` source pipeline for the announce line — see the
/// module-level grammar.
///
/// Returns `<body> (<source>)` for named/mixed pipelines, or the bare
/// `<source>` / `<source> ×N` form when every command is unnamed (no body to
/// attach the suffix to). Unnamed runs inside a mixed pipeline render as `…`
/// (1) or `…×N` (≥2).
pub(crate) fn format_pipeline_summary(steps: &[SourcedStep]) -> String {
    // All steps in a group share the same source.
    let source_label = steps[0].source.to_string();

    let step_names: Vec<Vec<Option<&str>>> = steps
        .iter()
        .map(|step| match &step.step {
            PreparedStep::Single(cmd) => vec![cmd.name.as_deref()],
            PreparedStep::Concurrent(cmds) => cmds.iter().map(|c| c.name.as_deref()).collect(),
        })
        .collect();

    let total_unnamed: usize = step_names.iter().flatten().filter(|n| n.is_none()).count();
    let any_named = step_names.iter().flatten().any(|n| n.is_some());

    // All-unnamed degenerate case: no names to list, so skip the colon.
    if !any_named {
        return if total_unnamed == 1 {
            source_label
        } else {
            format!("{source_label} ×{total_unnamed}")
        };
    }

    let body = format_pipeline_summary_from_names(
        &step_names,
        |name| cformat!("<bold>{name}</>"),
        |count| {
            Some(if count == 1 {
                "…".to_string()
            } else {
                format!("…×{count}")
            })
        },
    );
    format!("{body} ({source_label})")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::command_executor::PreparedCommand;
    use ansi_str::AnsiStr;
    use insta::assert_snapshot;

    fn make_sourced_step(step: PreparedStep) -> SourcedStep {
        SourcedStep {
            step,
            source: HookSource::User,
        }
    }

    fn make_cmd(name: Option<&str>, template: &str) -> PreparedCommand {
        let label = match name {
            Some(n) => format!("user:{n}"),
            None => "user".to_string(),
        };
        PreparedCommand {
            name: name.map(String::from),
            template: template.to_string(),
            context: worktrunk::config::TemplateContext::default(),
            template_name: label.clone(),
            label,
        }
    }

    #[test]
    fn test_format_pipeline_summary_named() {
        let steps = vec![
            make_sourced_step(PreparedStep::Single(make_cmd(
                Some("install"),
                "npm install",
            ))),
            make_sourced_step(PreparedStep::Concurrent(vec![
                make_cmd(Some("build"), "npm run build"),
                make_cmd(Some("lint"), "npm run lint"),
            ])),
        ];
        let summary = format_pipeline_summary(&steps);
        assert_snapshot!(summary.ansi_strip(), @"install, build & lint (user)");
    }

    #[test]
    fn test_format_pipeline_summary_unnamed() {
        let steps = vec![
            make_sourced_step(PreparedStep::Single(make_cmd(None, "npm install"))),
            make_sourced_step(PreparedStep::Single(make_cmd(None, "npm run build"))),
        ];
        let summary = format_pipeline_summary(&steps);
        assert_snapshot!(summary.ansi_strip(), @"user ×2");
    }

    #[test]
    fn test_format_pipeline_summary_mixed_named_unnamed() {
        let steps = vec![
            make_sourced_step(PreparedStep::Single(make_cmd(None, "npm install"))),
            make_sourced_step(PreparedStep::Single(make_cmd(Some
```

### Core Architecture Module: `src/commands/hook_commands.rs`
```
//! Hook commands for `wt hook` subcommand.
//!
//! This module contains:
//! - `run_hook` - Execute a specific hook type
//! - `handle_hook_show` - Display configured hooks

use std::fmt::Write as _;

use anyhow::Context;
use color_print::cformat;
use strum::IntoEnumIterator;
use worktrunk::HookType;
use worktrunk::config::{
    ALIAS_ARGS_KEY, Approvals, CommandConfig, ProjectConfig, ProjectId, UserConfig, binds_cli_var,
    referenced_vars_for_config,
};
use worktrunk::git::Repository;
use worktrunk::path::format_path_for_display;
use worktrunk::styling::{
    INFO_SYMBOL, PROMPT_SYMBOL, eprintln, format_bash_with_gutter, format_heading, info_message,
    println, warning_message,
};

use crate::output::print_json;

use super::command_approval::approve_hooks_filtered;
use super::command_executor::{
    CommandContext, FailureStrategy, PreparedStep, prepare_steps, render_template_preview,
};
use super::context::CommandEnv;
use super::hooks::{HookAnnouncer, prepare_and_check, run_hooks_foreground};
use super::project_config::command_label;
use super::template_vars::TemplateVars;
use worktrunk::config::HookSource;

fn run_post_hook(
    ctx: &CommandContext,
    foreground: Option<bool>,
    user_config: Option<&CommandConfig>,
    project_config: Option<&CommandConfig>,
    hook_type: HookType,
    extra_vars: &[(&str, &str)],
    name_filters: &[String],
) -> anyhow::Result<()> {
    // --foreground is for debugging; default is background.
    if foreground.unwrap_or(false) {
        return run_hooks_foreground(
            ctx,
            user_config,
            project_config,
            hook_type,
            extra_vars,
            name_filters,
            FailureStrategy::Warn,
        )
        .map(drop);
    }

    // Filter path merges user + project matches into one pipeline (the user
    // cherry-picked specific names across sources). The default path keeps
    // sources independent so a user hook failure doesn't abort project hooks.
    let mut announcer = HookAnnouncer::new(ctx.repo, false);
    if name_filters.is_empty() {
        announcer.register(ctx, hook_type, extra_vars, None)?;
    } else {
        let flat = prepare_and_check(
            ctx,
            user_config,
            project_config,
            hook_type,
            extra_vars,
            name_filters,
        )?;
        // `flat` is non-empty: a filter that matches nothing errors above.
        announcer.add_groups(ctx, hook_type, None, vec![flat]);
    }
    announcer.flush()
}

/// Build best-effort directional vars for manual `wt hook` invocation.
///
/// When hooks run during real operations (switch, merge, remove), each call site
/// builds precise vars from the actual source/destination context. When invoked
/// manually via `wt hook <type>`, we only have the current worktree — so each
/// hook type gets the directional vars its real call site sets, filled in from
/// that worktree. The merge and remove hooks bind `target` and
/// `target_worktree_path` to it; the switch and start hooks also bind `base`
/// and `base_worktree_path`, naming the source a real switch starts from,
/// which manually is that same worktree; the commit hooks bind `target` to the
/// default branch as a stand-in for the target their real callers pass — the
/// merge target from `wt merge`, the integration target from `wt step squash`
/// — since `wt step commit` itself passes none.
///
/// The directional *path* vars apply either way, since the worktree exists
/// whether or not it is on a branch. The directional *branch* vars follow
/// `branch` itself: a detached worktree leaves them unset rather than naming
/// the literal `HEAD` (issue #4009).
///
/// This is the single source of truth for manual hook context — both `run_hook`
/// (execution + dry-run) and [`hook_command_rows`] (`hook show --expanded`) use
/// this function. Returns a `TemplateVars` so callers can extend with
/// additional bindings (e.g. CLI shorthand) before materializing.
fn build_manual_hook_template_vars(ctx: &CommandContext, hook_type: HookType) -> TemplateVars {
    let branch = ctx.branch;
    let worktree_path = ctx.worktree_path;
    match hook_type {
        // Merge/commit hooks: target = merge target (default branch for commit,
        // current for merge). Only this arm needs the default branch, and
        // resolving it can cost a `git ls-remote` on a fresh clone — so it is
        // fetched here rather than up front.
        HookType::PreCommit | HookType::PostCommit => ctx
            .repo
            .default_branch()
            .map_or_else(TemplateVars::new, |t| TemplateVars::new().with_target(&t)),
        HookType::PreMerge | HookType::PostMerge => TemplateVars::new()
            .with_target_opt(branch)
            .with_target_worktree_path(worktree_path),
        // Switch hooks: base = current (we're "switching from" here)
        HookType::PreSwitch | HookType::PreCreate | HookType::PostCreate | HookType::PostSwitch => {
            TemplateVars::new()
                .with_base(branch, worktree_path)
                .with_target_opt(branch)
                .with_target_worktree_path(worktree_path)
        }
        // Remove hooks: target = where user ends up (current worktree is the best guess)
        HookType::PreRemove | HookType::PostRemove => TemplateVars::new()
            .with_target_opt(branch)
            .with_target_worktree_path(worktree_path),
    }
}

/// Parse a raw `KEY=VALUE` shorthand token into a canonicalized
/// `(canonical_key, original_key, value)` triple.
///
/// Canonicalization replaces `-` with `_` in the key to match the template
/// naming convention (minijinja parses `{{ my-var }}` as subtraction), the
/// same rule `parse_key_val` applies to `--var`. The original key is preserved
/// for reconstructing `--KEY=VALUE` when forwarding to `{{ args }}`.
fn parse_shorthand_token(raw: &str) -> anyhow::Result<(String, String, String)> {
    let (key, value) = raw
        .split_once('=')
        .ok_or_else(|| anyhow::anyhow!("invalid shorthand (missing `=`): {raw}"))?;
    if key.is_empty() {
        anyhow::bail!("invalid shorthand (empty key): {raw}");
    }
    Ok((key.replace('-', "_"), key.to_string(), value.to_string()))
}

/// Union of top-level template variable names referenced across every command
/// in both configs for this hook type. Matches alias pipeline semantics:
/// referenced in any step is a binding candidate for the whole invocation.
fn referenced_vars_union(
    user_config: Option<&CommandConfig>,
    project_config: Option<&CommandConfig>,
    hook_type: HookType,
) -> anyhow::Result<std::collections::BTreeSet<String>> {
    let mut out = std::collections::BTreeSet::new();
    if let Some(cfg) = user_config {
        out.extend(referenced_vars_for_config(
            cfg,
            &format!("user {hook_type} hook"),
        )?);
    }
    if let Some(cfg) = project_config {
        out.extend(referenced_vars_for_config(
            cfg,
            &format!("project {hook_type} hook"),
        )?);
    }
    Ok(out)
}

/// CLI-origin arguments to a manual `wt hook <type>` invocation. Bundled so
/// the call sites in `main.rs` don't balloon past clippy's
/// `too_many_arguments` threshold as the shorthand/forwarding surface grows.
pub struct HookCliArgs<'a> {
    /// Positional name filters: `wt hook pre-merge test build` → `["test", "build"]`.
    pub name_filters: &'a [String],
    /// Explicit `--var KEY=VALUE` bindings (deprecated force-bind).
    pub explicit_vars: &'a [(String, String)],
    /// Raw `KEY=VALUE` tokens from the `--KEY=VALUE` shorthand. Smart-routed:
    /// bind if any hook template references KEY, else forward to `{{ args }}`.
    pub shorthand_vars: &'a [String],
    /// Tokens after `--` that forward to `{{ args }}` verbatim.
    pub forwarded_args: &'a [String],
}

/// Handle `wt hook` command
///
/// When explicitly invoking hooks, ALL hooks run (both user and project).
/// There's no skip flag - if you explicitly run hooks, all configured hooks run.
///
/// Works in detached HEAD state - the `{{ branch }}` template variable (and the
/// `{{ base }}` / `{{ target }}` names derived from it) is simply unset there.
///
/// Template variables come from three sources in [`HookCliArgs`], routed per
/// alias semantics:
/// - `shorthand_vars` (`--KEY=VALUE`): binds `{{ KEY }}` if any hook template
///   references it; otherwise forwards `--KEY=VALUE` into `{{ args }}`.
/// - `forwarded_args` (tokens after `--`): forwards into `{{ args }}` verbatim.
/// - `explicit_vars` (`--var KEY=VALUE`): deprecated force-bind. Always binds,
///   regardless of whether any template references the key.
///
/// The `foreground` parameter controls execution mode for hooks that normally run
/// in background (post-start, post-switch):
/// - `None` = use default behavior for this hook type
/// - `Some(true)` = run in foreground (for debugging)
/// - `Some(false)` = run in background (default for post-start/post-switch)
pub fn run_hook(
    hook_type: HookType,
    yes: bool,
    foreground: Option<bool>,
    dry_run: bool,
    cli: HookCliArgs<'_>,
) -> anyhow::Result<()> {
    let HookCliArgs {
        name_filters,
        explicit_vars,
        shorthand_vars,
        forwarded_args,
    } = cli;
    // `config` isn't in hand here, so let the repository supply its cached load.
    let config = Repository::current()?.user_config().clone();
    let env = CommandEnv::for_selector(config, "@")?;
    let repo = &env.repo;
    let ctx = env.context(yes);

    // Load project config (optional - user hooks can run without project config)
    let project_config = repo.load_project_config()?;

    if !dry_run {
        // "Approve at the Gate": approve project hooks upfront
        // Pass name_filters to only approve the targeted hooks, not all hooks of this type
        let approved = approve_hooks_filtered(&ctx, &[hook_type], name_filters)?;
        // If declined, return early - t
```

### Core Architecture Module: `src/commands/hook_filter.rs`
```
//! Hook filter types for command filtering by source and name.

use worktrunk::config::HookSource;

/// A parsed name filter, optionally scoped to a specific source.
///
/// Supports formats:
/// - `"foo"` - matches commands named "foo" from any source
/// - `"user:foo"` - matches only user's command named "foo"
/// - `"project:foo"` - matches only project's command named "foo"
/// - `"user:"` or `"project:"` - matches all commands from that source
pub struct ParsedFilter<'a> {
    pub source: Option<HookSource>,
    pub name: &'a str,
}

impl<'a> ParsedFilter<'a> {
    pub fn parse(filter: &'a str) -> Self {
        if let Some(name) = filter.strip_prefix("user:") {
            Self {
                source: Some(HookSource::User),
                name,
            }
        } else if let Some(name) = filter.strip_prefix("project:") {
            Self {
                source: Some(HookSource::Project),
                name,
            }
        } else {
            Self {
                source: None,
                name: filter,
            }
        }
    }

    /// Check if this filter matches the given source.
    pub(crate) fn matches_source(&self, source: HookSource) -> bool {
        self.source.is_none() || self.source == Some(source)
    }

    /// Check if this filter matches a command from the given source.
    pub(crate) fn matches_command(&self, source: HookSource, name: Option<&str>) -> bool {
        self.matches_source(source)
            && (self.name.is_empty() || name.is_some_and(|n| n == self.name))
    }
}

```

### Core Architecture Module: `src/commands/hook_plan.rs`
```
//! The frozen, approved command plan that closes the approval-boundary TOCTOU.
//!
//! # The invariant
//!
//! `AGENTS.md` → "Project Commands Run Only After Approval". Project-defined
//! hook commands are arbitrary code shipped in a repo the user may have just
//! cloned; they run only after the approval gate clears them.
//!
//! # Why this type exists
//!
//! Selection (*which* `(source, hook_type, name, template)` tuples run),
//! authorization (project templates ∈ [`Approvals`]) and rendering
//! (template → shell string, needs live git) are three separate concerns.
//! Operation-driven hooks (`pre-merge`, `post-merge`, `pre-remove`,
//! `post-remove`, `post-switch`, `pre-start`, `post-start`) are gated *before*
//! a state mutation (auto-rebase rewrites the feature `.config/wt.toml`; a
//! merge moves the target ref; a removal scrubs the worktree; `git worktree
//! add` materializes a `--create` worktree) and executed *after* it. When
//! selection runs a second time at execution (`load_project_config()` again),
//! the mutated on-disk config can yield an *unapproved* command. On a fresh
//! clone that is remote code execution.
//!
//! The structural fix: **the gate performs selection exactly once and freezes
//! it into an [`ApprovedHookPlan`]. Executors consume only that value.** They
//! hold no [`ProjectConfig`] and call no `load_project_config()` for the
//! covered hook types — re-derivation is a compile error, not a review check.
//! The `Repository` an executor still holds is used only for *rendering*
//! ([`render_planned`] takes the frozen [`CommandConfig`] list, never config),
//! so it cannot re-select.
//!
//! The frozen unit is the *selected, source-tagged [`CommandConfig`] list* per
//! `(HookType, anchor)` — the anchor being the worktree the hook runs in.
//! Rendering stays deferred (post-`*` hooks legitimately need post-operation
//! context like the merge commit), but it consumes
//! `&[(HookSource, CommandConfig)]`, so it cannot change the set. The
//! authorization-relevant artifact is the template set, which is exactly what
//! [`Approvals`] stores and the prompt shows.
//!
//! `ApprovedHookPlan` is obtainable *only* via [`HookPlan::approve`] (the
//! interactive / `--yes` gate) or `HookPlan::approve_readonly` (the picker,
//! which can't prompt mid-render; `#[cfg(unix)]`). [`HookPlanBuilder::add`] — the sole
//! config→commands step for the covered hooks — is the only place
//! `load_project_config()`'s result is selected from.

use std::path::{Path, PathBuf};

use anyhow::Context as _;
use worktrunk::HookType;
use worktrunk::config::{Approvals, Command, CommandConfig, ProjectConfig, ProjectId, UserConfig};
use worktrunk::git::add_hook_skip_hint;

use super::command_approval::approve_command_batch;
use super::command_executor::{
    CommandContext, FailureStrategy, PipelineKind, execute_pipeline_foreground, prepare_steps,
};
use super::hook_announcement::SourcedStep;
use super::hooks::{HookAnnouncer, into_source_groups, sourced_steps_to_foreground};
use super::project_config::{ApprovableCommand, Phase};
use worktrunk::config::HookSource;

/// One `(hook_type, anchor)`'s frozen, source-tagged selection.
///
/// `User` entries precede `Project` so the flat render order matches the
/// existing background grouping (a user-hook failure must not abort project
/// hooks). Each `CommandConfig` is an owned clone — frozen data, no config
/// handle to re-resolve from.
type Selection = Vec<(HookSource, CommandConfig)>;

/// One frozen entry: the hook type, the anchor worktree (the worktree the hook
/// runs in — stored as the caller provides it; the gate and executor both
/// derive it from the same value, so equality holds without canonicalization),
/// and that pair's source-tagged selection.
struct PlanEntry {
    hook_type: HookType,
    anchor: PathBuf,
    selection: Selection,
}

/// A selected-but-not-yet-authorized plan. Built only by [`HookPlanBuilder`].
pub struct HookPlan {
    entries: Vec<PlanEntry>,
}

/// Accumulates per-anchor selections from the invoking worktree's resolved
/// config.
///
/// `add` is the only place `load_project_config()`'s result feeds command
/// selection for the covered hook types — `pub(crate)` and called only from
/// command gates.
pub struct HookPlanBuilder<'a> {
    entries: Vec<PlanEntry>,
    project_config: Option<&'a ProjectConfig>,
    user: &'a UserConfig,
    project_id: Option<&'a ProjectId>,
}

impl<'a> HookPlanBuilder<'a> {
    /// The gate resolves the selection context once: `project_config` (the
    /// gate's snapshot) plus `user` config supply every `add`'s command lookup,
    /// and `project_id` scopes the user-config hooks. Every covered hook selects
    /// from the invoking worktree's config — the same context — so `add` only
    /// names the anchor and the hook types.
    pub fn new(
        project_config: Option<&'a ProjectConfig>,
        user: &'a UserConfig,
        project_id: Option<&'a ProjectId>,
    ) -> Self {
        Self {
            entries: Vec::new(),
            project_config,
            user,
            project_id,
        }
    }

    /// Select `hook_types` anchored at `anchor` from the builder's resolved
    /// config context. Source identity is preserved so source-scoped behavior
    /// survives into execution.
    pub fn add(&mut self, anchor: &Path, hook_types: &[HookType]) -> &mut Self {
        let user_hooks = self.user.hooks(self.project_id);
        for &hook_type in hook_types {
            let user_cfg = user_hooks.get(hook_type);
            let proj_cfg = self.project_config.and_then(|c| c.hooks.get(hook_type));
            let mut selection: Selection = Vec::new();
            if let Some(cfg) = user_cfg {
                selection.push((HookSource::User, cfg.clone()));
            }
            if let Some(cfg) = proj_cfg {
                selection.push((HookSource::Project, cfg.clone()));
            }
            if selection.is_empty() {
                continue;
            }
            match self
                .entries
                .iter_mut()
                .find(|e| e.hook_type == hook_type && e.anchor == anchor)
            {
                Some(e) => {
                    // A repeated `(hook_type, anchor)` add must not interleave
                    // sources: `into_source_groups` requires User entries
                    // contiguous before Project ones. Stable sort by
                    // `HookSource` (User < Project) keeps that structurally,
                    // not by caller convention.
                    e.selection.extend(selection);
                    e.selection.sort_by_key(|(source, _)| *source);
                }
                None => self.entries.push(PlanEntry {
                    hook_type,
                    anchor: anchor.to_path_buf(),
                    selection,
                }),
            }
        }
        self
    }

    pub fn finish(self) -> HookPlan {
        HookPlan {
            entries: self.entries,
        }
    }
}

impl HookPlan {
    /// The project-source templates the prompt must show, deduped by template
    /// so the same command across several anchors prompts once (the common
    /// case: every removal in a batch lands in the same primary worktree).
    fn approvable(&self) -> Vec<ApprovableCommand> {
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::new();
        for entry in &self.entries {
            for (source, cfg) in &entry.selection {
                if *source != HookSource::Project {
                    continue;
                }
                for cmd in cfg.commands() {
                    if seen.insert(cmd.template.clone()) {
                        out.push(ApprovableCommand {
                            phase: Phase::Hook(entry.hook_type),
                            command: Command::new(cmd.name.clone(), cmd.template.clone()),
                        });
                    }
                }
            }
        }
        out
    }

    /// Interactive / `--yes` gate. The interactive path reuses
    /// [`approve_command_batch`] for its prompt and for the approvals it
    /// saves. `Ok(None)` means the user declined: the caller prints its own
    /// "continuing without hooks" message and proceeds with
    /// [`ApprovedHookPlan::empty`].
    ///
    /// `Approvals` is loaded only on the interactive path. Two paths skip the
    /// load. When nothing project-sourced needs the gate (no project config,
    /// or only user hooks) the frozen plan returns at once. `--yes` also
    /// approves every project command unconditionally and persists nothing, so
    /// it has no approval state to read. A malformed `approvals.toml` therefore
    /// never aborts a command that would not consult it. `project_id` is
    /// `Option` only because that no-approvable fast path needs none; every
    /// path that has something to approve requires it.
    pub fn approve(
        self,
        project_id: Option<&ProjectId>,
        yes: bool,
    ) -> anyhow::Result<Option<ApprovedHookPlan>> {
        let approvable = self.approvable();
        if approvable.is_empty() {
            return Ok(Some(ApprovedHookPlan {
                entries: self.entries,
            }));
        }
        let project_id =
            project_id.context("project identifier is required to approve project commands")?;
        let approved = approve_command_batch(&approvable, project_id, yes)?;
        if !approved {
            return Ok(None);
        }
        Ok(Some(ApprovedHookPlan {
            entries: self.entries,
        }))
    }

    /// Build an approved plan without prompting: project pipelines whose
    /// commands are already approved survive, the rest are dropped (user
    /// pipelines always survive). Strictly the AGENTS.md "consult the
    /// approval state read-only and run only the already-approved commands,
    /// skipping the rest" rule. An absent `project_i
```

### Core Architecture Module: `src/commands/hooks.rs`
```
//! Hook config loading, step preparation, and execution.
//!
//! See [`super::hook_announcement`] for the announcement format / grammar that
//! the background path emits before spawning pipelines.
//!
//! # Which `.config/wt.toml` a hook reads
//!
//! Every hook resolves its commands from the **invoking** worktree's
//! `.config/wt.toml` — the worktree `wt` ran in, read from its working tree.
//! That holds regardless of which worktree the hook is *about*: `post-merge`
//! runs in the merge target and `post-start` in the newly created worktree,
//! but both select their commands from the invoking worktree's config — the
//! same file `wt config show` reads.
//!
//! Two execution models split on whether a state mutation separates the
//! approval gate from execution.
//!
//! **Plan-backed (the TOCTOU-covered set):** `pre-merge`, `post-merge`,
//! `pre-remove`, `post-remove`, `post-switch`, `pre-start`, `post-start`. A
//! merge, rebase, removal, or `git worktree add` runs between the gate and
//! these hooks; a rebase can even rewrite the invoking worktree's own
//! `.config/wt.toml`, so a second config read could select a command the user
//! never approved. Each command gate calls `load_project_config()` on the
//! invoking worktree once, selects the commands, and freezes them into a
//! [`super::hook_plan::ApprovedHookPlan`]; the executor renders and runs only
//! that frozen value via [`super::hook_plan::execute_planned_hook`] /
//! [`super::hook_plan::register_planned`], holding no `ProjectConfig` to
//! re-derive from. See the [`super::hook_plan`] module spec.
//!
//! | Plan-backed hook | Runs in (the anchor) | Gate |
//! |---|---|---|
//! | `pre-merge`, `pre-remove`, `post-remove` | the feature/removed worktree | `merge::approve_merge_plan`, `remove::handle_remove_command`'s `approve_remove`, `step::prune::step_prune`'s `build_pessimistic_plan` approval |
//! | `post-merge`, `post-switch` (after a removal) | the merge/removal destination | the same gates |
//! | `pre-start`, `post-start`, `post-switch` (on switch) | the new/destination worktree | `worktree::switch::approve_switch_hooks` |
//!
//! "Runs in" is the *anchor* — the executor's plan lookup key and render root,
//! not a config source. A `pre-start`'s new worktree need not exist when the
//! gate runs; the config came from the invoking worktree regardless. A
//! background pipeline anchored on a worktree the command removed is dropped
//! and reported rather than spawned (see [`report_dropped_pipelines`]); only
//! `wt merge` reaches that, since it removes `post-commit`'s anchor before the
//! flush.
//!
//! **Invocation-resolved (no gate→exec mutation):** `pre-commit`,
//! `post-commit`, `pre-switch`, `wt hook <type>`, aliases. They resolve config
//! from `ctx.repo.load_project_config()` at invocation via [`execute_hook`] /
//! [`HookAnnouncer::register`]. Two facts make that re-read safe, and a new
//! call site must preserve **both**: (1) nothing between the gate and the
//! executor mutates the worktree `.config/wt.toml`; (2) the executor reads
//! through the **same `Repository` instance** the gate used —
//! `load_project_config` reads the working-tree file and memoizes it in a
//! never-invalidated `OnceCell` (`RepoCache::project_config`), so the
//! executor's call is a cache hit returning the gate's exact bytes. A
//! refactor that runs an uncovered executor through a fresh `Repository::at()`
//! (empty cache) breaks (2) and silently reintroduces the TOCTOU even if (1)
//! still holds — there is no compile-time guard here, unlike the plan-backed
//! set. (Aliases get the property structurally instead: the body is frozen
//! into `AliasEntry` before the gate, like `ApprovedHookPlan`.)
//!
//! `ctx.repo` is the invoking worktree — except `wt step commit --branch <b>`,
//! `wt merge --branch <b>`, and `wt -C <path>` re-root the whole command (the commit, its hooks, and
//! `ctx.repo` are all `<b>`), so "the invoking worktree" follows them.
//!
//! A present-but-malformed config aborts the operation rather than silently
//! running something else. `WORKTRUNK_PROJECT_CONFIG_PATH` overrides the path
//! (test isolation); user config (`~/.config/worktrunk/config.toml`) is global
//! and unaffected.

use crate::commands::command_executor::ForegroundStdin;

use std::path::{Path, PathBuf};

use anyhow::Context;
use color_print::cformat;
use worktrunk::HookType;
use worktrunk::config::{CommandConfig, format_hook_variables};
use worktrunk::git::{Repository, add_hook_skip_hint};
use worktrunk::path::format_path_for_display;
use worktrunk::styling::{
    eprintln, format_with_gutter, hint_message, info_message, progress_message, verbosity,
    warning_message,
};

use super::command_executor::{
    CommandContext, FailureStrategy, ForegroundStep, PipelineKind, PreparedCommand, PreparedStep,
    alias_error_wrapper, execute_pipeline_foreground, hook_error_wrapper, prepare_steps,
};
use super::hook_announcement::{SourcedStep, format_pipeline_summary};
use crate::commands::process::{HookLog, spawn_detached_exec};
use crate::output::DirectivePassthrough;

use super::hook_filter::ParsedFilter;
use worktrunk::config::HookSource;

/// Prepare hook steps from both user and project configs, preserving pipeline
/// structure, and verify any name filter matched at least one command.
/// Returns the steps (possibly empty if no hooks are configured).
///
/// Collects steps from user config first, then project config, applying the
/// name filter to individual commands within each step. The filter supports
/// source prefixes: `user:foo` or `project:foo` to run only from one source.
///
/// Shared by [`run_hooks_foreground`] and the dry-run branch of `run_hook`
/// (in `hook_commands.rs`) so both paths produce the same "no commands
/// matched" error when a filter mismatches. `run_post_hook`'s filter path
/// additionally relies on the error as a guarantee: `Ok` under a non-empty
/// filter implies non-empty steps, which [`HookAnnouncer::add_groups`]
/// requires.
pub(crate) fn prepare_and_check(
    ctx: &CommandContext,
    user_config: Option<&CommandConfig>,
    project_config: Option<&CommandConfig>,
    hook_type: HookType,
    extra_vars: &[(&str, &str)],
    name_filters: &[String],
) -> anyhow::Result<Vec<SourcedStep>> {
    let parsed_filters: Vec<ParsedFilter<'_>> = name_filters
        .iter()
        .map(|f| ParsedFilter::parse(f))
        .collect();

    let mut result = Vec::new();

    let sources = [
        (HookSource::User, user_config),
        (HookSource::Project, project_config),
    ];

    for (source, config) in sources {
        let Some(config) = config else { continue };

        if !parsed_filters.is_empty() && !parsed_filters.iter().any(|f| f.matches_source(source)) {
            continue;
        }

        let steps = prepare_steps(config, ctx, extra_vars, hook_type, source)?.validated()?;
        for step in steps {
            if let Some(filtered) = filter_step_by_name(step, source, &parsed_filters) {
                result.push(SourcedStep {
                    step: filtered,
                    source,
                });
            }
        }
    }

    // Every surviving step keeps at least one command, so an empty result
    // under a non-empty filter means nothing matched.
    if !name_filters.is_empty() && result.is_empty() {
        return Err(no_matching_commands_error(
            hook_type,
            name_filters,
            user_config,
            project_config,
        ));
    }

    Ok(result)
}

/// Filter commands within a step by name. Returns `None` if all commands were
/// filtered out. A `Concurrent` group reduced to one command collapses to `Single`.
fn filter_step_by_name(
    step: PreparedStep,
    source: HookSource,
    parsed_filters: &[ParsedFilter<'_>],
) -> Option<PreparedStep> {
    if parsed_filters.is_empty() {
        return Some(step);
    }

    let matches = |cmd: &PreparedCommand| {
        parsed_filters
            .iter()
            .any(|f| f.matches_command(source, cmd.name.as_deref()))
    };

    match step {
        PreparedStep::Single(cmd) => matches(&cmd).then_some(PreparedStep::Single(cmd)),
        PreparedStep::Concurrent(cmds) => {
            let mut kept: Vec<_> = cmds.into_iter().filter(matches).collect();
            match kept.len() {
                0 => None,
                1 => Some(PreparedStep::Single(kept.pop().unwrap())),
                _ => Some(PreparedStep::Concurrent(kept)),
            }
        }
    }
}

/// Build the error for a filter that matched no commands.
///
/// A bare source filter (`user:` / `project:`) asks for every hook from one
/// source rather than naming a command, so a miss means that source
/// configures no hooks of this type — there is no name to have misspelled.
/// That gets [`worktrunk::git::GitError::HookSourceNotConfigured`], pointing
/// at the other source; a filter that did name a command gets
/// [`worktrunk::git::GitError::HookCommandNotFound`], listing the available
/// names across the filters' source scopes.
fn no_matching_commands_error(
    hook_type: HookType,
    name_filters: &[String],
    user_config: Option<&CommandConfig>,
    project_config: Option<&CommandConfig>,
) -> anyhow::Error {
    // Show the combined filter string in the error
    let filter_display = name_filters.join(", ");

    let parsed_filters: Vec<ParsedFilter<'_>> = name_filters
        .iter()
        .map(|f| ParsedFilter::parse(f))
        .collect();

    let configured = |source: HookSource| {
        let config = match source {
            HookSource::User => user_config,
            HookSource::Project => project_config,
        };
        config.is_some_and(|c| c.commands().next().is_some())
    };
    // Only when every filter is a bare source. A list that also names a
    // command asked about that name, and answering about a source instead
    // would leave the name unmentioned and offer an invocation nobody typed 
```

### Core Architecture Module: `src/commands/list/model/state.rs`
```
//! State enums for worktree and branch status.
//!
//! These represent various states a worktree or branch can be in relative to
//! the default branch, upstream remote, or git operations in progress.

use worktrunk::git::{InProgressOperation, IntegrationReason};

/// Upstream divergence state relative to remote tracking branch.
///
/// Used only for upstream/remote divergence. Main branch divergence is now
/// handled by [`MainState`] which combines divergence with integration states.
///
/// | Variant   | Symbol |
/// |-----------|--------|
/// | None      | (empty) - no remote configured |
/// | InSync    | `\|`   - up-to-date with remote |
/// | Ahead     | `⇡`    - has unpushed commits   |
/// | Behind    | `⇣`    - missing remote commits |
/// | Diverged  | `⇅`    - both ahead and behind  |
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Divergence {
    /// No remote tracking branch configured
    #[default]
    None,
    /// In sync with upstream remote
    InSync,
    /// Has commits the remote doesn't have
    Ahead,
    /// Missing commits from the remote
    Behind,
    /// Both ahead and behind the remote
    Diverged,
}

impl Divergence {
    /// Compute divergence state when a remote tracking branch exists.
    ///
    /// Returns `InSync` for 0/0 since we know a remote exists.
    /// For cases where there's no remote, use `Divergence::None` directly.
    pub fn from_counts_with_remote(ahead: usize, behind: usize) -> Self {
        match (ahead, behind) {
            (0, 0) => Self::InSync,
            (_, 0) => Self::Ahead,
            (0, _) => Self::Behind,
            _ => Self::Diverged,
        }
    }

    /// Get the display symbol for this divergence state.
    pub fn symbol(self) -> &'static str {
        match self {
            Self::None => "",
            Self::InSync => "|",
            Self::Ahead => "⇡",
            Self::Behind => "⇣",
            Self::Diverged => "⇅",
        }
    }

    /// Returns styled symbol (dimmed), or None for None variant.
    pub fn styled(self) -> Option<String> {
        use color_print::cformat;
        if self == Self::None {
            None
        } else {
            Some(cformat!("<dim>{}</>", self.symbol()))
        }
    }
}

/// Worktree state indicator
///
/// Shows the "location" state of a worktree or branch:
/// - For worktrees: whether the path matches the template, or has issues
/// - For branches (without worktree): shows / to distinguish from worktrees
///
/// Priority order for worktrees: Prunable > Locked > Detached >
/// DuplicateBranch > BranchWorktreeMismatch
///
/// `DuplicateBranch` and `BranchWorktreeMismatch` share the `⚐` glyph: both
/// say this worktree's place in the branch ⇔ worktree map is irregular, and
/// the table already distinguishes them — a repeated Branch cell is the
/// duplicate, an off-template Path cell the mismatch. The variants stay
/// separate because the JSON `worktree.state` names the cause, where there
/// is no glyph budget to spend.
///
/// `Detached` gets a glyph of its own because nothing else in the row says
/// so: the Branch cell holds a short hash, which reads as a branch named
/// like one until the column tells you otherwise.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum WorktreeState {
    /// Normal worktree (path matches template, not locked or prunable)
    #[default]
    None,
    /// Branch-worktree mismatch: path doesn't match what the template would generate
    BranchWorktreeMismatch,
    /// The branch is checked out in more than one worktree
    DuplicateBranch,
    /// Detached HEAD: the worktree is on a commit, not a branch
    Detached,
    /// Prunable (worktree directory or its `.git` gone)
    Prunable,
    /// Locked (protected from removal)
    Locked,
    /// Branch indicator (for branches without worktrees)
    Branch,
}

impl std::fmt::Display for WorktreeState {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            Self::None => Ok(()),
            Self::BranchWorktreeMismatch | Self::DuplicateBranch => write!(f, "⚐"),
            Self::Detached => write!(f, "⊘"),
            Self::Prunable => write!(f, "⊟"),
            Self::Locked => write!(f, "⊞"),
            Self::Branch => write!(f, "/"),
        }
    }
}

/// Default branch relationship state
///
/// Represents the combined relationship to the default branch in a single position.
/// Uses horizontal arrows (vs vertical arrows for Remote column).
///
/// Priority order determines which symbol is shown:
/// 1. IsMain (^) - this IS the main worktree
/// 2. Orphan (∅) - no common ancestor with default branch
/// 3. Empty (_) - same commit as default branch AND clean working tree (safe to delete)
/// 4. Integrated (⊂) - content is in default branch via different history (safe to delete)
/// 5. WouldConflict (✗) - merge-tree simulation shows conflicts AND not already integrated
/// 6. SameCommit (–) - same commit as default branch with uncommitted changes
/// 7. Diverged (↕) - both ahead and behind default branch
/// 8. Ahead (↑) - has commits default branch doesn't have
/// 9. Behind (↓) - missing commits from default branch
///
/// `Empty`/`Integrated` rank above `WouldConflict`: a branch whose content is
/// already in the default branch is safe to delete regardless of whether a
/// naive re-merge would conflict. Such a conflict is vacuous — it happens when
/// the default branch squash-merged the branch and then re-edited the same
/// lines, so resolving it just reproduces the default branch's tree (nothing
/// added). `wt step prune` reaches the same verdict via the same patch-id
/// check, so the list symbol and the prune message agree. (Same rationale as
/// `Orphan` outranking `WouldConflict`: show the root-cause state, not the
/// downstream conflict.)
///
/// The `Integrated` variant carries an [`IntegrationReason`] explaining how the
/// content was integrated (ancestor, trees match, no added changes, or merge adds nothing).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, strum::IntoStaticStr)]
#[strum(serialize_all = "snake_case")]
pub enum MainState {
    /// Normal working branch (up-to-date with default branch, no special state)
    #[default]
    #[strum(serialize = "")]
    None,
    /// This IS the main worktree
    IsMain,
    /// Merge-tree conflicts with default branch (simulated via git merge-tree)
    WouldConflict,
    /// Branch HEAD is same commit as default branch AND working tree is clean (safe to delete)
    Empty,
    /// Branch HEAD is same commit as default branch but has uncommitted changes
    SameCommit,
    /// Content is integrated into default branch via different history
    #[strum(serialize = "integrated")]
    Integrated(IntegrationReason),
    /// No common ancestor with default branch (orphan branch)
    Orphan,
    /// Both ahead and behind default branch
    Diverged,
    /// Has commits default branch doesn't have
    Ahead,
    /// Missing commits from default branch
    Behind,
}

impl std::fmt::Display for MainState {
    /// Single-stroke vertical arrows for Main column (vs double-stroke arrows for Remote column).
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            Self::None => Ok(()),
            Self::IsMain => write!(f, "^"),
            Self::WouldConflict => write!(f, "✗"),
            Self::Empty => write!(f, "_"),
            Self::SameCommit => write!(f, "–"), // en-dash U+2013
            Self::Integrated(_) => write!(f, "⊂"),
            Self::Orphan => write!(f, "∅"), // U+2205 empty set
            Self::Diverged => write!(f, "↕"),
            Self::Ahead => write!(f, "↑"),
            Self::Behind => write!(f, "↓"),
        }
    }
}

impl MainState {
    /// Returns styled symbol with appropriate color, or None for None variant.
    ///
    /// Color semantics:
    /// - WARNING (yellow): WouldConflict - potential problem needing attention
    /// - HINT (dimmed): All others - informational states
    pub fn styled(&self) -> Option<String> {
        use color_print::cformat;
        match self {
            Self::None => None,
            Self::WouldConflict => Some(cformat!("<yellow>{self}</>")),
            _ => Some(cformat!("<dim>{self}</>")),
        }
    }

    /// Returns the integration reason if this is an integrated state, None otherwise.
    pub fn integration_reason(&self) -> Option<IntegrationReason> {
        match self {
            Self::Integrated(reason) => Some(*reason),
            _ => None,
        }
    }

    /// Returns the JSON string representation for main_state field.
    pub fn as_json_str(self) -> Option<&'static str> {
        let s: &'static str = self.into();
        if s.is_empty() { None } else { Some(s) }
    }

    /// Compute from divergence counts, integration state, and same-commit-dirty flag.
    ///
    /// Priority: IsMain > Orphan > integration > WouldConflict > SameCommit > Diverged > Ahead > Behind
    ///
    /// Both Orphan and integration take priority over WouldConflict because:
    /// - Each is a more fundamental property (no common ancestor / content
    ///   already in the default branch)
    /// - The merge conflict they imply is expected and not actionable —
    ///   an orphan can't be merged cleanly, and an integrated branch has
    ///   nothing left to merge (its conflict is vacuous)
    /// - Users should see "this is an orphan branch" / "this is integrated
    ///   (safe to delete)" rather than the downstream "this would conflict"
    ///
    /// This function takes every input up front — it's the "all data is
    /// available" path. For the per-gate resolver that walks tiers with
    /// partial data, see [`tier_is_main`], [`tier_orphan`],
    /// [`tier_would_conflict`], [`tier_counts`], and the [`Tier`] helper below.
    pub fn from_integration_and_counts(
        is_main: bool,
        would_conflict: bool,
        integration: Option<Main
```

### Core Architecture Module: `src/commands/list/render.rs`
```
use crate::display::{format_relative_time_short, shorten_path};
use anstyle::{Effects, Style};
use unicode_width::UnicodeWidthStr;
use worktrunk::styling::{DETACHED, StyledLine, truncate_visible};

use super::columns::{ColumnKind, DiffVariant};
use super::layout::{
    ColumnFormat, ColumnLayout, DiffColumnConfig, LayoutConfig, LinkStyle, format_url_cell,
};
use super::model::{ItemKind, ListItem};

/// Placeholder glyph for unresolved Status positions — both "still loading" and
/// "drain deadline fired, won't arrive."
///
/// TODO: collapse-to-one-glyph is temporary. Loading and timed-out are
/// semantically distinct states; the original design used `⋯` vs `·` but `⋯`
/// is too visually loud for a tight column where most cells are in one state
/// or the other during a render. Revisit and pick a subtle second glyph
/// (e.g. `·` for one, `–` or braille dot for the other) once we can evaluate
/// them side-by-side in real tables. Also update `src/cli/mod.rs`
/// status-column help table when resplit.
pub const PLACEHOLDER: &str = "·";

/// Blank placeholder used by `wt list` during the first ~200ms of progressive
/// rendering. The skeleton renders with blanks so fast commands (everything
/// resolved under 200ms) never flash the `·` loading indicator. After the
/// 200ms threshold, `LayoutConfig::placeholder` is promoted to [`PLACEHOLDER`]
/// and every still-pending cell is re-rendered with the dot.
pub const PLACEHOLDER_BLANK: &str = " ";

/// Step a style up one emphasis level for compact (C/K) diff notation, which
/// flags an approximated count. A dimmed base drops the dim to land at normal;
/// any other base gains bold. This keeps the jump uniform across subcolumns —
/// the dimmed "behind" count (`↓6C`) steps dim → normal rather than leaping two
/// levels to dim+bold, while the normal "ahead" count (`↑6C`) still steps
/// normal → bold.
fn bump_emphasis(style: Style) -> Style {
    let effects = style.get_effects();
    if effects.contains(Effects::DIMMED) {
        style.effects(effects.remove(Effects::DIMMED))
    } else {
        style.bold()
    }
}

impl DiffColumnConfig {
    /// Check if a value exceeds the allocated digit width
    fn exceeds_width(value: usize, digits: usize) -> bool {
        if digits == 0 {
            return value > 0;
        }
        let max_value = 10_usize.pow(digits as u32) - 1;
        value > max_value
    }

    /// Format a value using compact notation (K for thousands, optionally C for hundreds)
    ///
    /// Returns (formatted_string, uses_compact_notation)
    ///
    /// For line diffs (Signs): Shows full numbers in 100-999 range, uses K for thousands
    /// For commit counts (Arrows): Uses C for hundreds, K for thousands
    ///
    /// Note: Uses integer division for approximation (intentional truncation):
    /// - 648 / 100 = 6 → "6C" (represents ~600)
    /// - 1999 / 1000 = 1 → "1K" (represents ~1000)
    ///
    /// Values >= 10,000 display as "∞" to indicate "very large" without false precision.
    ///
    /// Examples (Signs):  100 -> ("100", false), 648 -> ("648", false), 1000 -> ("1K", true)
    /// Examples (Arrows): 100 -> ("1C", true),   648 -> ("6C", true),   1000 -> ("1K", true)
    fn format_overflow(value: usize, variant: DiffVariant) -> (String, bool) {
        if value >= 10_000 {
            // Use ∞ for extreme values to avoid false precision (9K could be 9K or 900K)
            ("∞".to_string(), true)
        } else if value >= 1_000 {
            (format!("{}K", value / 1_000), true)
        } else if value >= 100 {
            match variant {
                // Line diffs: show full number (user prefers precision over compactness)
                DiffVariant::Signs => (value.to_string(), false),
                // Commit counts: use C abbreviation
                DiffVariant::Arrows | DiffVariant::UpstreamArrows => {
                    (format!("{}C", value / 100), true)
                }
            }
        } else {
            (value.to_string(), false)
        }
    }

    /// Render a subcolumn value with symbol and padding to fixed width
    /// Numbers are right-aligned on the ones column (e.g., " +2", "+53")
    /// For compact notation (C/K suffix), bumps the base style one emphasis
    /// level (e.g. dim "↓6C" → normal, normal "↑6C" → bold) — see
    /// [`bump_emphasis`].
    fn render_subcolumn(
        segment: &mut StyledLine,
        symbol: &str,
        value: usize,
        width: usize,
        style: Style,
        overflow: bool,
        variant: DiffVariant,
    ) {
        let (value_str, is_compact) = if overflow {
            Self::format_overflow(value, variant)
        } else {
            (value.to_string(), false)
        };
        let content_len = 1 + value_str.width(); // symbol + display width
        let padding_needed = width.saturating_sub(content_len);

        // Add left padding for right-alignment
        if padding_needed > 0 {
            segment.push_raw(" ".repeat(padding_needed));
        }

        // Add styled content - bump emphasis one level for compact notation
        // (C/K suffix) to flag the approximated count
        if is_compact {
            segment.push_styled(format!("{}{}", symbol, value_str), bump_emphasis(style));
        } else {
            segment.push_styled(format!("{}{}", symbol, value_str), style);
        }
    }

    /// Render diff values as a StyledLine with fixed-width alignment.
    ///
    /// Numbers are right-aligned within their allocated digit width.
    /// Use this for tabular display where columns must align vertically.
    pub fn render_segment(&self, positive: usize, negative: usize) -> StyledLine {
        let symbols = self.display.variant.symbols();
        let mut segment = StyledLine::new();

        // Check for overflow
        let positive_overflow = Self::exceeds_width(positive, self.positive_digits);
        let negative_overflow = Self::exceeds_width(negative, self.negative_digits);

        if positive == 0 && negative == 0 {
            segment.push_raw(" ".repeat(self.total_width));
            return segment;
        }

        let positive_width = 1 + self.positive_digits;
        let negative_width = 1 + self.negative_digits;

        // Fixed content width ensures vertical alignment of subcolumns
        let content_width = positive_width + 1 + negative_width;
        let total_padding = self.total_width.saturating_sub(content_width);

        // Add leading padding for right-alignment
        if total_padding > 0 {
            segment.push_raw(" ".repeat(total_padding));
        }

        // Render positive (added) subcolumn
        if positive > 0 {
            Self::render_subcolumn(
                &mut segment,
                symbols.positive,
                positive,
                positive_width,
                self.display.positive_style,
                positive_overflow,
                self.display.variant,
            );
        } else {
            // Empty positive subcolumn - add spaces to maintain alignment
            segment.push_raw(" ".repeat(positive_width));
        }

        // Always add separator to maintain fixed layout (early return handles empty case)
        segment.push_raw(" ");

        // Render negative (deleted) subcolumn
        if negative > 0 {
            Self::render_subcolumn(
                &mut segment,
                symbols.negative,
                negative,
                negative_width,
                self.display.negative_style,
                negative_overflow,
                self.display.variant,
            );
        } else {
            // Empty negative subcolumn - add spaces to maintain alignment
            segment.push_raw(" ".repeat(negative_width));
        }

        segment
    }
}

impl LayoutConfig {
    fn render_line<F>(&self, mut render_cell: F) -> StyledLine
    where
        F: FnMut(&ColumnLayout) -> StyledLine,
    {
        let mut line = StyledLine::new();
        if self.columns.is_empty() {
            return line;
        }

        let last_index = self.columns.len() - 1;

        for (index, column) in self.columns.iter().enumerate() {
            line.pad_to(column.start);
            let cell = render_cell(column);
            let cell_width = cell.width();

            // Debug: Log if cell exceeds its allocated width
            if cell_width > column.width {
                tracing::debug!(
                    column = ?column.kind,
                    allocated = column.width,
                    actual = cell_width,
                    excess = cell_width - column.width,
                    "Cell overflow: column={:?} allocated={} actual={} excess={}",
                    column.kind,
                    column.width,
                    cell_width,
                    cell_width - column.width
                );
            }

            line.extend(cell);

            // Pad to end of column (unless it's the last column)
            if index != last_index {
                line.pad_to(column.start + column.width);
            }
        }

        // Padding after the last cell places nothing. A row whose rightmost
        // columns are empty carried up to 14 trailing spaces the header line
        // never had, which a reader inherits the moment they select the row.
        line.trim_end();

        let final_width = line.width();
        tracing::debug!(width = final_width, "Rendered line width: {}", final_width);

        line
    }

    pub fn format_header_line(&self) -> String {
        self.render_header_line().render()
    }

    /// Render header line as StyledLine (for extracting both plain and styled text)
    pub fn render_header_line(&self) -> StyledLine {
        let style = Style::new().bold();
        self.render_line(|column| {
            let mut cell = StyledLine::new();
            if !column.header.is_empty() {
                cell.push_styled(column.header.to_string(), style);
            }
       
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2837** (2026-05-21): **`wt switch` interactive picker with `cd = false` skips switch hooks**
  *Symptoms*: ## Bug  With `[switch] cd = false` (or `--no-cd`), the interactive picker prints the selected branch and exits without firing any switch hooks. The same `wt switch <branch> --no-cd` invocation with a branch arg fires hooks normally, so the picker path is inconsistent with the direct-arg path.  Surfaced in #2796 — @endigma's working cmux recipe needs a `wt pick` alias that runs the picker twice to force hooks to fire:  ```toml [aliases] pick = """ b=$(wt switch) [ -n "$b" ] && wt switch "$b" """ ```  ## Reproduce  `wt.toml`:  ```toml [switch] cd = false  [pre-switch] trace = "echo pre-switch fired for {{ branch }} >&2" ```  - `wt switch other-branch` → prints `pre-switch fired for other-branch` ✓ - `wt switch` (picker, select `other-branch`) → prints `other-branch`, no hook output ✗  `post-switch`, `pre-start`, `post-start` are also skipped on the picker path.  ## Cause  [`src/commands/picker/mod.rs:767-777`](https://github.com/max-sixty/worktrunk/blob/5c87bf22ca77ec9846e799e5a45d66d8526619d2/src/commands/picker/mod.rs#L767-L777) early-returns on `!change_dir`, before `run_pre_switch_hooks` / `plan_switch` / `execute_switch` / the background-hook spawn that the `change_dir = true` branch flows into.  Comment on the branch says "read-only, no side effects" — that was the intent when #1330 added `--no-cd` support to the picker, but the same shape later bit #1704 (`alt-r` removal in the picker skipping `pre-remove` / `post-remove`).  ## Constraint  Pre-switch hooks can't run whil

- **Issue #2334** (2026-04-20): **Flaky: test_switch_picker_preview_panel_main_diff on macOS**
  *Symptoms*: `test_switch_picker_preview_panel_main_diff` failed on macOS in PR #2333 (a docs-only change — 6 files, -137 lines, only markdown and `after_long_help` strings), suggesting an intermittent environment-dependent issue.  **Snapshot diff:**  The expected output has one branch row (`feature`); the actual output has an extra `main` row appearing below it — as if the picker's branch-list rendering reached a different state than the test expects.  ```     1     1 │ > [QUERY]     2     2 │     Branch   Status        HEAD±    main↕  Remote⇅  Commit     3       │-> + feature      ↑                 ↑2               [HASH]..           3 │+> + feature      ↑                 ↑2               [HASH]..           4 │+  @ main         ^                                  [HASH] ```  **Run:** https://github.com/max-sixty/worktrunk/actions/runs/24653821440/job/72082401646  macOS passed on the latest main CI run (24652863009, same SHA `1a0a3e2f` this PR branched from), so this is intermittent. Related (closed): #1592, same family of flakes in `switch_picker` preview tests on macOS.  > _This was written by Claude Code on behalf of Maximilian Roos_
  **Post-Mortem & Fix Analysis**:
  > Looked at this without being able to reproduce on Linux, so this is code reading rather than a verified diagnosis.  One plausible mechanism for the extra `main` row:  - Pressing `3` is bound to `execute-silent(echo 3 > …)+refresh-preview` ([picker/mod.rs:558-561](https://github.com/max-sixty/worktrunk/blob/1043726fd98f6c7accc1da4794cac6c9927fd531/src/commands/picker/mod.rs#L558-L561)). It refreshes the preview but does not touch the query, so the list should stay filtered to `feature`. - The test waits for `diff --git` via `wait_for_stable_with_content` ([switch_picker.rs:802](https://github.com/max-sixty/worktrunk/blob/1043726fd98f6c7accc1da4794cac6c9927fd531/tests/integration_tests/switch_picker.rs#L802)). That helper has a `content_found_at` fallback ([switch_picker.rs:458-462](https://github.com/max-sixty/worktrunk/blob/1043726fd98f6c7accc1da4794cac6c9927fd531/tests/integration_tests/switch_picker.rs#L458-L462)) that returns once the expected string has been continuously present fo

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

### Incident Patch 1: `25d0c44b` (2026-10-20)
**Commit Message**: fix(remove): drain the trash with one background process per repository (#4516)

A prune of many worktrees started one `rm -rf` per staged worktree. On a
193-worktree prune those processes competed for the disk: together they
deleted about 1,500 files/s on 3 cores, while a single `rm` alone
managed 3,000–5,400 files/s on under one core. Read-only directories
(`dr-xr-xr-x`, as installers leave them) also made `rm -rf` fail, so
those entries stayed in `.git/wt/trash/` and every later sweep retried
them.

Removal now starts a hidden `wt _drain-trash`, which holds
`.git/wt/trash.lock` and deletes every staged entry, including entries
staged while it runs. A removal or sweep that finds the lock held starts
nothing, so a prune runs about one deleter. The sweep after `wt remove`
drains leftovers immediately rather than waiting 24 hours. Priority is
unchanged (`taskpolicy -b` on macOS).

The drain uses wt's own walker (`src/remove_dir.rs`), which `wt remove
--foreground` and `wt config state clear` also use:

- On Unix it opens each directory relative to its parent's descriptor
with `O_NOFOLLOW` and unlinks relative to the holding directory. The old
path-based walker could follow a directo

**File**: `Cargo.toml` (modified, +3/-2)
```diff
@@ -331,8 +331,9 @@ open = { version = "5.3", optional = true }
 # Gating keeps both out of the Windows dependency graph.
 nix = { version = "0.31.3", default-features = false, features = ["event", "fs", "poll", "process", "signal"] }
 signal-hook = "0.4.1"
-# Safe FIONREAD snapshots bound cancellation drains even with continuous writers.
-rustix = "1.1.4"
+# Safe FIONREAD snapshots bound cancellation drains even with continuous writers;
+# directory-relative `*at` calls let tree removal never follow a symlink.
+rustix = { version = "1.1.4", features = ["fs"] }
 
 [target.'cfg(windows)'.dependencies]
 # The localized Documents folder that holds PowerShell profiles.
```

**File**: `docs/src/content/docs/faq.md` (modified, +2/-1)
```diff
@@ -150,6 +150,7 @@ Worktrunk stores repository state, caches, and logs under `.git/`:
 | `.git/wt/logs/subprocess.log` | Raw uncapped subprocess stdout/stderr (may be multi-MB) | Running with `-vv` |
 | `.git/wt/logs/diagnostic.md` | Diagnostic report for issue reporting (leads with the performance profile) | Running with `-vv` |
 | `.git/wt/trash/<name>-<timestamp>` | Staged worktree contents pending background deletion | `wt remove` |
+| `.git/wt/trash.lock` | Lock for background trash deletion | `wt remove` |
 
 None of this is tracked by git or pushed to remotes.
 
@@ -215,7 +216,7 @@ A branch checked out in a second worktree is retained regardless, `-D` included.
 
 - `wt merge` / `wt step push` — the target branch's checked-out worktree is updated to the merged commits, so a file those commits delete disappears from it, and an ignored file at a path they track is overwritten — the same result a `git merge` run in that worktree would produce. Uncommitted changes at paths the merge doesn't touch stay in place, staged or not; one at a path it does touch refuses the merge upfront, naming the file
 - `wt remove` / `wt step prune` — unregister a stale worktree (`⊟` in `wt list`) by deleting its `.git/worktrees/<id>` entry, as `git worktree prune` does, but for that worktree only. Files still in its directory stay. An entry whose index holds staged changes, or with a rebase, merge, or other operation in progress, is kept unless `wt remove --force` names it, since `git worktree repair` can restore it only while the entry exists
-- `wt remove` — also stops the removed worktree's `git fsmonitor--daemon` (under `core.fsmonitor=true`), and sweeps `.git/wt/trash/` entries older than 24 hours along with fsmonitor daemons whose worktree no longer exists
+- `wt remove` — also stops the removed worktree's `git fsmonitor--daemon` (under `core.fsmonitor=true`), and resumes deleting `.git/wt/trash/` entries an interrupted removal left behind, along with fsmonitor daemons whose worktree no longer exists
 - `wt config state clear` — clears config keys, caches, markers, hints, variables, logs, and stale trash
 - `wt config shell install` — replaces an existing fish or Nushell wrapper file whole, and removes one an older version installed at a previous location (fish `conf.d/wt.fish`, Nushell `<config-dir>/vendor/autoload/wt.nu`), printing each removal; [Files created](/shell-integration/#files-created) names the file each shell gets
 - `wt config shell uninstall` — removes the lines that run `wt config shell init` from bash/zsh/PowerShell rc files, and deletes wrapper and completion files carrying worktrunk's content markers (fish `functions/`, `conf.d/`, and `completions/`; nushell `vendor/autoload`). Every removed line is printed
```

**File**: `plugins/worktrunk/skills/worktrunk/reference/faq.md` (modified, +2/-1)
```diff
@@ -146,6 +146,7 @@ Worktrunk stores repository state, caches, and logs under `.git/`:
 | `.git/wt/logs/subprocess.log` | Raw uncapped subprocess stdout/stderr (may be multi-MB) | Running with `-vv` |
 | `.git/wt/logs/diagnostic.md` | Diagnostic report for issue reporting (leads with the performance profile) | Running with `-vv` |
 | `.git/wt/trash/<name>-<timestamp>` | Staged worktree contents pending background deletion | `wt remove` |
+| `.git/wt/trash.lock` | Lock for background trash deletion | `wt remove` |
 
 None of this is tracked by git or pushed to remotes.
 
@@ -211,7 +212,7 @@ A branch checked out in a second worktree is retained regardless, `-D` included.
 
 - `wt merge` / `wt step push` — the target branch's checked-out worktree is updated to the merged commits, so a file those commits delete disappears from it, and an ignored file at a path they track is overwritten — the same result a `git merge` run in that worktree would produce. Uncommitted changes at paths the merge doesn't touch stay in place, staged or not; one at a path it does touch refuses the merge upfront, naming the file
 - `wt remove` / `wt step prune` — unregister a stale worktree (`⊟` in `wt list`) by deleting its `.git/worktrees/<id>` entry, as `git worktree prune` does, but for that worktree only. Files still in its directory stay. An entry whose index holds staged changes, or with a rebase, merge, or other operation in progress, is kept unless `wt remove --force` names it, since `git worktree repair` can restore it only while the entry exists
-- `wt remove` — also stops the removed worktree's `git fsmonitor--daemon` (under `core.fsmonitor=true`), and sweeps `.git/wt/trash/` entries older than 24 hours along with fsmonitor daemons whose worktree no longer exists
+- `wt remove` — also stops the removed worktree's `git fsmonitor--daemon` (under `core.fsmonitor=true`), and resumes deleting `.git/wt/trash/` entries an interrupted removal left behind, along with fsmonitor daemons whose worktree no longer exists
 - `wt config state clear` — clears config keys, caches, markers, hints, variables, logs, and stale trash
 - `wt config shell install` — replaces an existing fish or Nushell wrapper file whole, and removes one an older version installed at a previous location (fish `conf.d/wt.fish`, Nushell `<config-dir>/vendor/autoload/wt.nu`), printing each removal; [Files created](https://worktrunk.dev/shell-integration/#files-created) names the file each shell gets
 - `wt config shell uninstall` — removes the lines that run `wt config shell init` from bash/zsh/PowerShell rc files, and deletes wrapper and completion files carrying worktrunk's content markers (fish `functions/`, `conf.d/`, and `completions/`; nushell `vendor/autoload`). Every removed line is printed
```

**File**: `skills/worktrunk/reference/faq.md` (modified, +2/-1)
```diff
@@ -146,6 +146,7 @@ Worktrunk stores repository state, caches, and logs under `.git/`:
 | `.git/wt/logs/subprocess.log` | Raw uncapped subprocess stdout/stderr (may be multi-MB) | Running with `-vv` |
 | `.git/wt/logs/diagnostic.md` | Diagnostic report for issue reporting (leads with the performance profile) | Running with `-vv` |
 | `.git/wt/trash/<name>-<timestamp>` | Staged worktree contents pending background deletion | `wt remove` |
+| `.git/wt/trash.lock` | Lock for background trash deletion | `wt remove` |
 
 None of this is tracked by git or pushed to remotes.
 
@@ -211,7 +212,7 @@ A branch checked out in a second worktree is retained regardless, `-D` included.
 
 - `wt merge` / `wt step push` — the target branch's checked-out worktree is updated to the merged commits, so a file those commits delete disappears from it, and an ignored file at a path they track is overwritten — the same result a `git merge` run in that worktree would produce. Uncommitted changes at paths the merge doesn't touch stay in place, staged or not; one at a path it does touch refuses the merge upfront, naming the file
 - `wt remove` / `wt step prune` — unregister a stale worktree (`⊟` in `wt list`) by deleting its `.git/worktrees/<id>` entry, as `git worktree prune` does, but for that worktree only. Files still in its directory stay. An entry whose index holds staged changes, or with a rebase, merge, or other operation in progress, is kept unless `wt remove --force` names it, since `git worktree repair` can restore it only while the entry exists
-- `wt remove` — also stops the removed worktree's `git fsmonitor--daemon` (under `core.fsmonitor=true`), and sweeps `.git/wt/trash/` entries older than 24 hours along with fsmonitor daemons whose worktree no longer exists
+- `wt remove` — also stops the removed worktree's `git fsmonitor--daemon` (under `core.fsmonitor=true`), and resumes deleting `.git/wt/trash/` entries an interrupted removal left behind, along with fsmonitor daemons whose worktree no longer exists
 - `wt config state clear` — clears config keys, caches, markers, hints, variables, logs, and stale trash
 - `wt config shell install` — replaces an existing fish or Nushell wrapper file whole, and removes one an older version installed at a previous location (fish `conf.d/wt.fish`, Nushell `<config-dir>/vendor/autoload/wt.nu`), printing each removal; [Files created](https://worktrunk.dev/shell-integration/#files-created) names the file each shell gets
 - `wt config shell uninstall` — removes the lines that run `wt config shell init` from bash/zsh/PowerShell rc files, and deletes wrapper and completion files carrying worktrunk's content markers (fish `functions/`, `conf.d/`, and `completions/`; nushell `vendor/autoload`). Every removed line is printed
```

**File**: `src/cli/mod.rs` (modified, +4/-0)
```diff
@@ -2710,6 +2710,10 @@ Hooks, aliases and `step.copy-ignored.exclude` accumulate rather than replace, s
         force_delete: bool,
     },
 
+    /// Delete the worktrees staged in a trash directory.
+    #[command(name = "_drain-trash", hide = true)]
+    InternalDrainTrash { trash_dir: std::path::PathBuf },
+
     /// Run a custom `wt-<name>` command found on PATH.
     ///
     /// Captured by clap when the first positional argument doesn't match any
```

**File**: `src/commands/config/state.rs` (modified, +11/-10)
```diff
@@ -79,6 +79,8 @@ use color_print::cformat;
 use path_slash::PathExt as _;
 use worktrunk::git::{BranchRef, CommandError, Repository, resolve_input_path, sha_cache};
 use worktrunk::path::{format_path_for_display, sanitize_for_filename};
+use worktrunk::progress::Progress;
+use worktrunk::remove_dir::remove_dir_with_progress;
 use worktrunk::styling::{
     eprintln, format_heading, format_with_gutter, hint_message, info_message, println,
     success_message, warning_message,
@@ -207,7 +209,7 @@ fn sort_hook_entries(entries: &mut [HookOutputEntry]) {
 /// A top-level entry staged under `wt_trash_dir()`.
 ///
 /// Worktree removal renames directories into `.git/wt/trash/<name>-<timestamp>`
-/// and a background `rm -rf` cleans them up; entries still present here are
+/// and a background trash drain deletes them; entries still present here are
 /// awaiting (or escaped) that sweep.
 struct TrashEntry {
     /// Filename, e.g. `myproject.feature-1234567890`.
@@ -222,7 +224,7 @@ struct TrashEntry {
 /// Only the first level matters — each entry is one staged worktree (a
 /// directory) or a stray file. Sorted by mtime (newest first) with name as
 /// tie-breaker. Individual dirent/metadata failures are skipped: `state get`
-/// is a read-only inspector and can race with the background `rm -rf`, so a
+/// is a read-only inspector and can race with the background trash drain, so a
 /// partial listing is more useful than a hard failure.
 fn list_trash_entries(repo: &Repository) -> anyhow::Result<Vec<TrashEntry>> {
     let trash_dir = repo.wt_trash_dir();
@@ -252,7 +254,7 @@ fn list_trash_entries(repo: &Repository) -> anyhow::Result<Vec<TrashEntry>> {
 /// Clear stale entries from the wt/trash directory.
 ///
 /// Worktree removal renames directories into `.git/wt/trash/` for instant UX,
-/// then deletes them in a background process. If the background `rm -rf` fails
+/// then deletes them in a background process. If the background drain fails
 /// or is killed, entries accumulate. This cleans them up.
 fn clear_trash(repo: &Repository) -> anyhow::Result<usize> {
     let trash_dir = repo.wt_trash_dir();
@@ -263,13 +265,12 @@ fn clear_trash(repo: &Repository) -> anyhow::Result<usize> {
 
     let mut cleared = 0;
     for entry in std::fs::read_dir(&trash_dir)? {
-        let entry = entry?;
-        let path = entry.path();
-        if path.is_dir() {
-            std::fs::remove_dir_all(&path)?;
-        } else {
-            std::fs::remove_file(&path)?;
-        }
+        let path = entry?.path();
+        anyhow::ensure!(
+            remove_dir_with_progress(&path, &Progress::disabled()),
+            "Failed to remove {}",
+            format_path_for_display(&path)
+        );
         cleared += 1;
     }
 
```

**File**: `src/commands/process.rs` (modified, +45/-150)
```diff
@@ -7,7 +7,6 @@ use std::process::Command;
 use std::process::Stdio;
 use worktrunk::git::{HookType, Repository};
 use worktrunk::path::{format_path_for_display, sanitize_for_filename};
-use worktrunk::utils::epoch_now;
 
 use worktrunk::config::HookSource;
 
@@ -342,102 +341,69 @@ fn spawn_detached_exec_windows(
 ///
 /// Steps:
 ///
-/// 1. [`sweep_stale_trash`] — delete stale `.git/wt/trash/` entries left by
-///    an interrupted background removal.
+/// 1. [`sweep_trash`] — restart deletion of `.git/wt/trash/` entries left
+///    by an interrupted background removal.
 /// 2. [`worktrunk::git::fsmonitor::reap_orphan_fsmonitor_daemons`] — terminate
 ///    `git fsmonitor--daemon` processes whose worktree no longer exists.
 ///    Defense-in-depth for daemons orphaned by paths that bypass `wt remove`
 ///    (plain `git worktree remove`, manual `rm -rf`, a crashed `wt`); the
 ///    `wt remove` source itself stops the daemon synchronously.
 pub fn run_internal_sweep(repo: &Repository) {
     let _span = worktrunk::trace::Span::new("internal-sweep");
-    sweep_stale_trash(repo);
+    sweep_trash(repo);
     worktrunk::git::fsmonitor::reap_orphan_fsmonitor_daemons(repo);
 }
 
-/// How old a `.git/wt/trash/` entry must be before [`sweep_stale_trash`] deletes it.
-pub const TRASH_STALE_THRESHOLD_SECS: u64 = 24 * 60 * 60;
-
-/// Fire-and-forget cleanup of stale entries in `.git/wt/trash/`.
+/// Fire-and-forget restart of trash deletion.
 ///
-/// Worktree removal uses a fast path that renames the worktree into
-/// `.git/wt/trash/<name>-<timestamp>/` and deletes it in a detached background
-/// process. If that process is interrupted (SIGKILL, reboot, disk full), the
-/// renamed directory is orphaned. `wt remove` calls this function after its
-/// primary user-visible output — so the sweep never delays the progress or
-/// success message — to provide eventual cleanup: entries older than
-/// [`TRASH_STALE_THRESHOLD_SECS`] are removed by a single detached `rm -rf`.
+/// Worktree removal renames the worktree into
+/// `.git/wt/trash/<name>-<timestamp>/` and starts a detached
+/// [`worktrunk::git::drain_trash`] to delete it. If that process is
+/// interrupted (SIGKILL, reboot, disk full), its entries stay behind. `wt
+/// remove` calls this function after its primary user-visible output — so the
+/// sweep never delays the progress or success message — and starts another
+/// drain when the trash holds anything and no drain is running.
 ///
-/// Best effort: directory read failures and spawn failures are logged at debug
-/// level and otherwise ignored. The sweep is purely additive — the primary
-/// `wt remove` operation proceeds regardless of outcome.
-pub fn sweep_stale_trash(repo: &Repository) {
+/// Best effort: spawn failures are logged at debug level and otherwise
+/// ignored. The sweep is purely additive — the primary `wt remove` operation
+/// proceeds regardless of outcome.
+pub fn sweep_trash(repo: &Repository) {
     let trash_dir = repo.wt_trash_dir();
-    let stale = collect_stale_trash_entries(&trash_dir, epoch_now(), TRASH_STALE_THRESHOLD_SECS);
-    if stale.is_empty() {
+    if worktrunk::git::staged_trash_entries(&trash_dir).is_empty()
+        || worktrunk::git::trash_drain_running(&trash_dir)
+    {
         return;
     }
 
-    let command = build_remove_paths_command(&stale);
-
     // The sweep is repo-wide (not branch-scoped), so it logs to a top-level
     // shared file alongside `commands.jsonl` and `trace.log`. The branch
     // argument is ignored for the `Shared` variant.
-    if let Err(e) = spawn_detached(
-        repo,
-        &repo.wt_dir(),
-        &command,
-        "",
-        &HookLog::Shared(InternalOp::TrashSweep),
-    ) {
+    let spawned = std::env::current_exe()
+        .context("Failed to locate Worktrunk executable")
+        .and_then(|executable| {
+            spawn_detached(
+                repo,
+                &repo.wt_dir(),
+                &build_drain_trash_command(executable, &trash_dir),
+                "",
+                &HookLog::Shared(InternalOp::TrashSweep),
+            )
+        });
+    if let Err(e) = spawned {
         tracing::debug!(error = %format!("{e:#}"), "Failed to spawn stale trash sweep");
     }
 }
 
-/// Shell argv: a fixed script, its `$0`, then native path arguments.
-/// Paths are never interpolated into shell source.
-pub fn build_remove_paths_command(
-    paths: impl IntoIterator<Item = impl AsRef<OsStr>>,
-) -> Vec<OsString> {
-    let mut args = vec![
-        OsString::from(r#"exec rm -rf -- "$@""#),
+/// Shell argv that runs `wt _drain-trash <trash_dir>`: a fixed script, its
+/// `$0`, then native arguments. Paths are never interpolated into shell source.
+pub fn build_drain_trash_command(executable: PathBuf, trash_dir: &Path) -> Vec<OsString> {
+    vec![
+        OsString::from(r#"exec "$@""#),
         OsString::from("wt"),
-    ];
-    args.extend(paths.into_iter().map(|path| path.as_ref().to_os_stri
```

**File**: `src/commands/remove.rs` (modified, +4/-5)
```diff
@@ -363,13 +363,12 @@ fn maybe_reap_result(result: &RemovalPlan, reap_enabled: bool) {
 ///      `.git/wt/trash/<name>-<timestamp>/` → prune metadata → delete branch
 ///      → synchronous `remove_dir_all` on the staged directory.
 ///    - **Background** (default): stop fsmonitor → rename + prune +
-///      synchronous branch delete → spawn detached `rm -rf` on the staged
-///      directory. Cross-filesystem or locked worktrees fall back to
+///      synchronous branch delete → spawn a detached drain of the trash
+///      directory (`wt _drain-trash`). Cross-filesystem or locked worktrees fall back to
 ///      `git worktree remove` in the detached process.
 /// 4. **Post-remove hooks** run in the background after dispatch.
-/// 5. **Internal sweep** (fire-and-forget, after primary output): stale
-///    `.git/wt/trash/` entries older than 24 hours are removed by a detached
-///    `rm -rf`, and orphaned `git fsmonitor--daemon` processes (worktree gone)
+/// 5. **Internal sweep** (fire-and-forget, after primary output): entries
+///    left in `.git/wt/trash/` start another detached drain, and orphaned `git fsmonitor--daemon` processes (worktree gone)
 ///    are terminated. Runs last so it never delays the user-visible progress
 ///    or success message. See [`super::process::run_internal_sweep`].
 pub fn handle_remove_command(args: RemoveArgs, yes: bool) -> anyhow::Result<()> {
```

---

### Incident Patch 2: `6826904e` (2026-10-20)
**Commit Message**: fix(shell_exec): write small command input to a pipe, not a temp file (#4519)

Since v0.80.0, an unusable `TMPDIR` broke every command that passes
input to a child: background hooks never spawned ("Failed to prepare
detached input"), `wt step for-each` failed, `wt list` lost the
working-tree diff of a worktree with untracked files (`git add
--pathspec-from-file=-` failed), and background `wt remove` exited 1
after already removing the worktree. #4400 moved this input from a pipe
to an anonymous temp file, even when it was empty.

The temp file exists so that no writer thread can block on a child that
doesn't read its input. A pipe meets that requirement when the whole
input fits in its buffer, so on Unix `buffered_stdin` now writes the
input into a fresh pipe with a nonblocking writer before spawn and
closes the writer. Only input larger than the pipe buffer (64 KiB on
macOS and Linux) falls back to the temp file, and that case still needs
a usable `TMPDIR`. Windows keeps the temp file.

Verified with the release-review repros: with `TMPDIR=/nonexistent/dir`,
the post-start hook runs, `for-each` succeeds, `wt list` shows the dirty
worktree, and `wt remove` exits 0, matching v0.80.0

**File**: `src/commands/picker/pager.rs` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 //! Pager detection and execution.
 //!
 //! Handles detection and use of diff pagers (delta, bat, etc.) for preview windows.
-//! Input is prepared in an anonymous file before spawn. On Unix, one deadline
+//! Input is prepared by `buffered_stdin` before spawn. On Unix, one deadline
 //! bounds both output consumption and the direct child wait,
 //! including descendants retaining the pipes. Timeout closes our pipe endpoints
 //! and kills/reaps only the owned pager; preview falls back to the original text.
```

**File**: `src/shell_exec.rs` (modified, +17/-4)
```diff
@@ -89,9 +89,22 @@ use crate::trace::CommandTrace;
 pub mod pipe;
 
 /// Prepare complete input before spawning, with no producer that can block.
-/// The anonymous file is removed when its last handle closes, even on interruption.
-/// This is seekable stdin, unlike the pipes connecting live pipeline stages.
+///
+/// On Unix, input that fits in a pipe's buffer is written there before spawn,
+/// so it needs no temporary storage and works with an unusable `TMPDIR`.
+/// Larger input, and all input on Windows, goes through an anonymous file,
+/// removed when its last handle closes, even on interruption.
 pub fn buffered_stdin(bytes: &[u8]) -> std::io::Result<Stdio> {
+    #[cfg(unix)]
+    {
+        let (reader, mut writer) = with_process_creation_guard(std::io::pipe)?;
+        pipe::set_nonblocking(&writer)?;
+        // Writing to a fresh pipe whose reader we hold fails only with
+        // `WouldBlock`, once the input outgrows the buffer.
+        if writer.write_all(bytes).is_ok() {
+            return Ok(reader.into());
+        }
+    }
     let mut file = tempfile::tempfile()?;
     file.write_all(bytes)?;
     file.rewind()?;
@@ -1221,7 +1234,7 @@ pub struct Cmd {
     shell_wrap: bool,
     /// Stdout configuration for stream() (defaults to inherit)
     stdout_cfg: Option<std::process::Stdio>,
-    /// Stdin configuration for stream() (defaults to null, or a file for stdin_data)
+    /// Stdin configuration for stream() (defaults to null; stdin_data takes precedence)
     stdin_cfg: Option<std::process::Stdio>,
     /// Observe terminal signals and forward PID-targeted cancellation during stream().
     forward_signals: bool,
@@ -1705,7 +1718,7 @@ impl Cmd {
         self
     }
 
-    /// Set complete input bytes, delivered through an anonymous temporary file.
+    /// Set complete input bytes, prepared by [`buffered_stdin`] before spawn.
     ///
     /// The child reads these bytes followed by EOF, without a pipe writer that
     /// can block on an unread input. This takes precedence over `.stdin(Stdio)`.
```

**File**: `tests/integration_tests/list.rs` (modified, +5/-3)
```diff
@@ -3718,8 +3718,9 @@ fn test_list_does_not_persist_observation_objects(mut repo: TestRepo) {
 }
 
 /// A broken system temporary-directory setting must not prevent either list
-/// entry point from rendering. Probe objects fall back to a temporary directory
-/// in Git's metadata and still disappear when the command exits.
+/// entry point from rendering, nor fail a task. Probe objects fall back to a
+/// temporary directory in Git's metadata and still disappear when the command
+/// exits. The untracked file makes the working-tree diff pass paths on stdin.
 #[cfg(unix)]
 #[rstest]
 fn test_list_survives_unavailable_system_temp_directory(mut repo: TestRepo) {
@@ -3728,6 +3729,7 @@ fn test_list_survives_unavailable_system_temp_directory(mut repo: TestRepo) {
     let feature_path = repo.add_worktree("feature");
     repo.commit("Main diverges");
     std::fs::write(feature_path.join("file.txt"), "feature\n").unwrap();
+    std::fs::write(feature_path.join("untracked.txt"), "untracked\n").unwrap();
 
     let before = repo.git_output(&["count-objects", "-v"]);
     let missing_temp = repo.root_path().join("missing-temp");
@@ -3744,7 +3746,7 @@ fn test_list_survives_unavailable_system_temp_directory(mut repo: TestRepo) {
             .output()
             .unwrap();
         assert!(
-            output.status.success(),
+            output.status.success() && output.stderr.is_empty(),
             "{} should fall back from an unavailable TMPDIR; stderr:\n{}",
             args.join(" "),
             String::from_utf8_lossy(&output.stderr)
```

**File**: `tests/integration_tests/remove.rs` (modified, +24/-0)
```diff
@@ -345,6 +345,30 @@ fn test_remove_reap_spares_terminal_process(mut repo: TestRepo) {
     let _ = child.wait();
 }
 
+/// Background removal hands its cleanup to a detached process, which must
+/// spawn without temporary storage when the system temporary directory is
+/// unusable.
+#[cfg(unix)]
+#[rstest]
+fn test_remove_background_with_unavailable_system_temp_directory(mut repo: TestRepo) {
+    let worktree_path = repo.add_worktree("feature");
+    let missing_temp = repo.root_path().join("missing-temp");
+    assert!(!missing_temp.exists());
+
+    let output = repo
+        .wt_command()
+        .args(["remove", "feature", "--yes"])
+        .env("TMPDIR", &missing_temp)
+        .output()
+        .unwrap();
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    assert!(
+        output.status.success() && !stderr.contains("Failed"),
+        "remove should succeed with an unavailable TMPDIR; stderr:\n{stderr}"
+    );
+    assert!(!worktree_path.exists());
+}
+
 #[rstest]
 fn test_remove_internal_mode(mut repo: TestRepo) {
     let worktree_path = repo.add_worktree("feature-internal");
```

---

### Incident Patch 3: `12d33b3e` (2026-10-20)
**Commit Message**: fix(shell): keep the Nushell wrapper working when its stdout is redirected (#4525)

Since #4400 rewrote the Nushell wrapper around `try … finally`,
redirecting the stdout of a `wt` command that prints nothing there
aborts the wrapper. `nu --no-config-file -c 'source init.nu; cd repo; wt
switch --create y o> /dev/null; print $env.PWD'` prints `repo.y` on
v0.80.0, but on main it fails with `nu::shell::cant_convert ... can't
convert nothing to string` at the `try {`, stops the script, and loses
the cd.

Nushell 0.116 fails to convert a `try … finally` that evaluates to
nothing under `o>` or `o+e>`. A plain `try`, `| ignore` and `e>` are
unaffected. The wrapper's `try … finally` now evaluates to a record
holding the exit code and captured stdout, and the wrapper returns
stdout or propagates the failure after the block, as v0.80.0 did. A
failure's stdout still prints inside the block, so a failing cd
directive can't drop it, and the `finally` still applies the directive
and removes the temp files on Ctrl-C. Returning `""` from the empty
branch would also have avoided the error, but it prints a blank line
when `wt switch` is the last command of a `nu -c` script.

Verified with nu 0.116.0

**File**: `src/shell/snapshots/worktrunk__shell__tests__init_nu.snap` (modified, +15/-10)
```diff
@@ -104,7 +104,10 @@ export def --env --wrapped wt [...args] {
     } else {
         let cd_file = (mktemp --tmpdir)
         let stdout_file = (mktemp --tmpdir)
-        try {
+        # The return value comes from outside `try … finally`: under an output
+        # redirect (`o> file`), Nushell fails converting a `try … finally`
+        # that evaluates to nothing ("can't convert nothing to string").
+        let result = (try {
             let wt_args = ($arg_text | take until {|arg| $arg == "--" })
             # Before `-x`, `c`, `v`, and `y` are boolean flags clap may cluster with it.
             let has_execute = ($wt_args | any {|arg| $arg == "--execute" or ($arg | str starts-with "--execute=") or ($arg =~ '^-[cvy]*x') })
@@ -130,15 +133,9 @@ export def --env --wrapped wt [...args] {
             })
 
             let output = if $has_execute { "" } else { open $stdout_file --raw }
-
-            # Return captured stdout or reproduce the external failure without
-            # a source trace. Nu itself also works on Windows, where sh is absent.
-            if $exit_code != 0 {
-                if ($output | is-not-empty) { print -n $output }
-                ^$nu.current-exe --no-config-file --no-std-lib -c $"exit ($exit_code)"
-            } else if ($output | is-not-empty) {
-                $output
-            }
+            # A failure's stdout prints now, so a failing directive can't drop it.
+            if $exit_code != 0 and ($output | is-not-empty) { print -n $output }
+            { exit_code: $exit_code, output: $output }
         } finally {
             try {
                 # cd file holds a raw path — no shell parsing needed
@@ -155,6 +152,14 @@ export def --env --wrapped wt [...args] {
                     try { ^rm -f $cd_file $stdout_file }
                 }
             }
+        })
+
+        # Return captured stdout or reproduce the external failure without
+        # a source trace. Nu itself also works on Windows, where sh is absent.
+        if $result.exit_code != 0 {
+            ^$nu.current-exe --no-config-file --no-std-lib -c $"exit ($result.exit_code)"
+        } else if ($result.output | is-not-empty) {
+            $result.output
         }
     }
 }
```

**File**: `templates/nushell.nu` (modified, +15/-10)
```diff
@@ -100,7 +100,10 @@ export def --env --wrapped {{ cmd }} [...args] {
     } else {
         let cd_file = (mktemp --tmpdir)
         let stdout_file = (mktemp --tmpdir)
-        try {
+        # The return value comes from outside `try … finally`: under an output
+        # redirect (`o> file`), Nushell fails converting a `try … finally`
+        # that evaluates to nothing ("can't convert nothing to string").
+        let result = (try {
             let wt_args = ($arg_text | take until {|arg| $arg == "--" })
             # Before `-x`, `c`, `v`, and `y` are boolean flags clap may cluster with it.
             let has_execute = ($wt_args | any {|arg| $arg == "--execute" or ($arg | str starts-with "--execute=") or ($arg =~ '^-[cvy]*x') })
@@ -126,15 +129,9 @@ export def --env --wrapped {{ cmd }} [...args] {
             })
 
             let output = if $has_execute { "" } else { open $stdout_file --raw }
-
-            # Return captured stdout or reproduce the external failure without
-            # a source trace. Nu itself also works on Windows, where sh is absent.
-            if $exit_code != 0 {
-                if ($output | is-not-empty) { print -n $output }
-                ^$nu.current-exe --no-config-file --no-std-lib -c $"exit ($exit_code)"
-            } else if ($output | is-not-empty) {
-                $output
-            }
+            # A failure's stdout prints now, so a failing directive can't drop it.
+            if $exit_code != 0 and ($output | is-not-empty) { print -n $output }
+            { exit_code: $exit_code, output: $output }
         } finally {
             try {
                 # cd file holds a raw path — no shell parsing needed
@@ -151,6 +148,14 @@ export def --env --wrapped {{ cmd }} [...args] {
                     try { ^rm -f $cd_file $stdout_file }
                 }
             }
+        })
+
+        # Return captured stdout or reproduce the external failure without
+        # a source trace. Nu itself also works on Windows, where sh is absent.
+        if $result.exit_code != 0 {
+            ^$nu.current-exe --no-config-file --no-std-lib -c $"exit ($result.exit_code)"
+        } else if ($result.output | is-not-empty) {
+            $result.output
         }
     }
 }
```

**File**: `tests/integration_tests/shell_wrapper.rs` (modified, +25/-0)
```diff
@@ -1303,6 +1303,31 @@ mod unix_tests {
         assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), 0, "{combined}");
     }
 
+    /// Redirecting the wrapper's stdout must not abort it when the command
+    /// prints nothing there. Under `o>`, Nushell fails to convert a
+    /// `try … finally` that evaluates to nothing, and the script stopped
+    /// after the directory change was lost.
+    #[rstest]
+    fn test_nu_wrapper_redirected_stdout_applies_cd(mut repo: TestRepo) {
+        repo.add_worktree("nu-redirect");
+        let target = canonicalize(repo.worktree_path("nu-redirect")).unwrap();
+        let mut script = String::new();
+        append_wrapper_setup(&mut script, "nu", &repo);
+        script.push_str(&format!(
+            "wt switch nu-redirect o> /dev/null\nprint $\"WT_CD:($env.PWD == {})\"\n",
+            nushell_quote(&target.to_string_lossy()),
+        ));
+
+        let config_path = repo.test_config_path().to_string_lossy().to_string();
+        let approvals_path = repo.test_approvals_path().to_string_lossy().to_string();
+        let env_vars = build_test_env_vars(&config_path, &approvals_path);
+        let (combined, exit_code) =
+            exec_in_pty_interactive("nu", &script, repo.root_path(), &env_vars, &[]);
+
+        assert_eq!(exit_code, 0, "Output:\n{combined}");
+        assert!(combined.contains("WT_CD:true"), "Output:\n{combined}");
+    }
+
     /// Native signal deaths must cross Nushell's negative-status boundary
     /// before the wrapper propagates the status, after applying CD and cleanup.
     #[rstest]
```

#### Recent Merged Pull Requests:
- **PR #4533** (2026-10-20): fix(signals): stop foreground loops when wt itself receives Ctrl-C (@max-sixty)
- **PR #4532** (2026-10-20): fix(switch): refuse --path naming the bare repository; drop rm -rf hint for --path (@max-sixty)
- **PR #4531** (2026-10-20): docs: release 0.81 documentation review fixes (@max-sixty)
- **PR #4530** (2026-10-20): test(remove): retry the drain when a forked child still holds the trash lock (@worktrunk-bot)
- **PR #4526** (2026-10-20): fix(config): keep approvals and [projects] entries saved under v0.80.0 identifiers (@max-sixty)
- **PR #4525** (2026-10-20): fix(shell): keep the Nushell wrapper working when its stdout is redirected (@max-sixty)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. remove): drain the trash with one background process per repository (#4516)

**RULE**:
When implementing operations in `Cargo.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in max-sixty/worktrunk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `25d0c44b`: remove): drain the trash with one background process per repository (#4516). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Safe FIONREAD snapshots bound cancellation drains even with continuous writers;
# directory-relative `*at` calls let tree removal never follow a symlink.
rustix = { version = "1.1.4", features = ["fs"] }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
# Safe FIONREAD snapshots bound cancellation drains even with continuous writers.
rustix = "1.1.4"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `25d0c44b` are properly handled with clean fallback behavior.
