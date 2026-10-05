# Forensic Learning Record (Deep Inspection): max-sixty/worktrunk

> **Canonical Artifact**: `07_PROJECT_LEARNING/max-sixty-worktrunk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/max-sixty/worktrunk](https://github.com/max-sixty/worktrunk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:25:09.205Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `max-sixty/worktrunk`
- **Description**: Worktrunk is a CLI for Git worktree management, designed for parallel AI agent workflows
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 8838 stars

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
            let suggestions = crate::commands::did_you_mean(other, candidates);
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
            .and_then(|s| s
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
//! - Previous branch (git config `worktrunk.history`)
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
/// and a background `rm -rf` cleans them up; entries still present here are
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
/// is a read-only inspector and can race with the background `rm -rf`, so a
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
                name: entry.file_name().to_string_lossy().into_owned(),
                path: entry.path().to_slash_lossy().into_owned(),
  
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
use super::hook_filter::HookSource;

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
            make_sourced_step(PreparedStep::Single(make_cmd(Som
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
    ALIAS_ARGS_KEY, Approvals, CommandConfig, ProjectConfig, UserConfig, referenced_vars_for_config,
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
use super::hook_filter::HookSource;
use super::hooks::{HookAnnouncer, prepare_and_check, run_hooks_foreground};
use super::project_config::command_label;
use super::template_vars::TemplateVars;

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
        );
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
    // Derive context from the current environment; `config` isn't in hand here,
    // so let the repository supply its cached load.
    let env = CommandEnv::for_action_loading_config()?;
    let repo = &env.repo;
    let ctx = env.context(yes);

    // Load project config (optional - user hooks can run without project config)
    let project_config = repo.load_project_config()?;

    if !dry_run {
        // "Approve at the Gate": approve project hooks upfront
        // Pass name_filters to only approve the targeted hooks, not all hooks of this type
        let approved = approve_hooks_filtered(&ctx, &[hook_type], name_filters)?;
        // If declined, return early - the whole point of `wt hook` is to run hooks
        if !a
```

### Core Architecture Module: `src/commands/hook_filter.rs`
```
//! Hook filter types for command filtering by source and name.
//!
//! These types are shared between `hooks.rs` (command preparation/execution)
//! and `command_approval.rs` (approval flow). Re-exported from `hooks.rs`
//! for backward compatibility.

/// Whether a hook or alias body came from user config or project config.
///
/// Drives approval and source-qualified filtering.
#[derive(
    Clone,
    Copy,
    Debug,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    serde::Serialize,
    serde::Deserialize,
    strum::Display,
    strum::EnumString,
)]
#[serde(rename_all = "kebab-case")]
#[strum(serialize_all = "kebab-case")]
pub enum HookSource {
    /// User config (~/.config/worktrunk/config.toml). No approval required.
    User,
    /// Project config (.config/wt.toml). Approval is handled at the gate.
    Project,
}

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
use worktrunk::config::{Approvals, Command, CommandConfig, ProjectConfig, UserConfig};
use worktrunk::git::add_hook_skip_hint;

use super::command_approval::approve_command_batch;
use super::command_executor::{
    CommandContext, FailureStrategy, PipelineKind, execute_pipeline_foreground, prepare_steps,
};
use super::hook_announcement::SourcedStep;
use super::hook_filter::HookSource;
use super::hooks::{HookAnnouncer, into_source_groups, sourced_steps_to_foreground};
use super::project_config::{ApprovableCommand, Phase};

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
    project_id: Option<&'a str>,
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
        project_id: Option<&'a str>,
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
        project_id: Option<&str>,
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
        // `approve_command_batch` with `yes = true` is an unconditional
        // `Ok(true)`, so loading `Approvals` here would be dead work.
        let approved = if yes {
            true
        } else {
            let approvals = Approvals::load().context("Failed to load approvals")?;
            approve_command_batch(&approvable, project_id, &approvals, false, false)?
        };
        if !approved {
            return Ok(None);
        }
        Ok(Some(ApprovedHookPlan {
            entries: self.entries,
        }))
    }

    /// Build an approved plan without prompting: project pipel
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
//! | `pre-merge`, `pre-remove`, `post-remove` | the feature/removed worktree | `merge::approve_merge_plan`, `remove::handle_remove_command`'s `approve_remove`, `step::prune::approve_prune_hooks` |
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
//! `ctx.repo` is the invoking worktree — except `wt step commit --branch <b>`
//! and `wt -C <path>` re-root the whole command (the commit, its hooks, and
//! `ctx.repo` are all `<b>`), so "the invoking worktree" follows them.
//!
//! A present-but-malformed config aborts the operation rather than silently
//! running something else. `WORKTRUNK_PROJECT_CONFIG_PATH` overrides the path
//! (test isolation); user config (`~/.config/worktrunk/config.toml`) is global
//! and unaffected.

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

// Re-export for backward compatibility with existing imports
pub use super::hook_filter::{HookSource, ParsedFilter};

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
    // would leave the name unmentioned and offer an invocation nobody typed —
    // so a mixed list falls through to `HookCommandNotFound`, 
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

### Core Architecture Module: `src/commands/worktree/hooks.rs`
```
//! Hook execution for worktree operations.
//!
//! CommandContext implementations for pre-start hooks, and PostRemoveContext
//! for building template variables for post-remove hooks.

use std::path::Path;

use worktrunk::HookType;
use worktrunk::git::Repository;
use worktrunk::path::to_posix_path;

use crate::commands::command_executor::CommandContext;
use crate::commands::command_executor::FailureStrategy;
use crate::commands::hook_plan::{ApprovedHookPlan, execute_planned_hook};

impl<'a> CommandContext<'a> {
    /// Execute pre-start commands sequentially (blocking) from the frozen plan.
    ///
    /// Runs user hooks first, then project hooks. `anchor` is the new
    /// worktree's path — the gate selected `pre-start` under it from the
    /// invoking worktree's config; the executor never re-reads any config.
    /// Shows path in hook announcements when shell integration isn't active
    /// (the user's shell won't cd to the new worktree).
    pub fn execute_pre_create_commands(
        &self,
        extra_vars: &[(&str, &str)],
        plan: &ApprovedHookPlan,
        anchor: &Path,
    ) -> anyhow::Result<()> {
        execute_planned_hook(
            plan,
            anchor,
            self,
            HookType::PreCreate,
            extra_vars,
            FailureStrategy::FailFast,
            crate::output::post_hook_display_path(self.worktree_path),
        )
    }
}

/// Context for post-remove hooks, holding owned strings for template variables.
///
/// Post-remove hooks need template variables that reflect the *removed* worktree
/// (not the destination), since hooks may reference the removed path and branch
/// (e.g., for cleanup scripts that use the path in container names). This struct
/// owns the computed strings so callers can borrow them as extra_vars.
pub(crate) struct PostRemoveContext {
    worktree_path_str: String,
    worktree_name: String,
    commit: String,
    short_commit: String,
    target_path_str: String,
    target_branch: Option<String>,
}

impl PostRemoveContext {
    pub fn new(
        removed_worktree_path: &Path,
        removed_commit: Option<&str>,
        main_path: &Path,
        repo: &Repository,
    ) -> Self {
        let worktree_path_str = to_posix_path(&removed_worktree_path.to_string_lossy());
        let worktree_name = removed_worktree_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let commit = removed_commit.unwrap_or("").to_string();
        // Empty commit (no removal SHA recorded) skips the short form rather
        // than asking git to abbreviate "". For a real SHA, fall back to the
        // full string only if `rev-parse --short` errors (very rare).
        let short_commit = if commit.is_empty() {
            String::new()
        } else {
            repo.short_sha(&commit).unwrap_or_else(|_| commit.clone())
        };

        // Target vars: where the user ends up after removal (primary worktree).
        // A detached primary worktree leaves `target` unset rather than empty,
        // matching `branch`: `format_variables_table` renders an absent var as
        // `(unset)` — "the operation couldn't supply this" — and that label only
        // holds while a branch var nobody can name stays out of the map.
        let target_path_str = to_posix_path(&main_path.to_string_lossy());
        let target_branch = repo.worktree_at(main_path).branch().ok().flatten();

        Self {
            worktree_path_str,
            worktree_name,
            commit,
            short_commit,
            target_path_str,
            target_branch,
        }
    }

    /// Build extra_vars that override the base context with removed-worktree identity.
    ///
    /// `removed_branch` is borrowed from the caller (it outlives the returned Vec).
    /// It is `None` when the removed worktree was detached: `extra_vars` is
    /// applied unconditionally at the end of `build_hook_context`, so emitting a
    /// `"HEAD"` literal here would overwrite the unset `branch` that context
    /// deliberately leaves out (issue #4009). `target` is skipped the same way
    /// when the primary worktree the removal lands in is itself detached.
    pub fn extra_vars<'a>(&'a self, removed_branch: Option<&'a str>) -> Vec<(&'a str, &'a str)> {
        let mut vars = vec![
            ("worktree_path", &*self.worktree_path_str),
            ("worktree", &self.worktree_path_str), // deprecated alias
            ("worktree_name", &self.worktree_name),
            ("commit", &self.commit),
            ("short_commit", &self.short_commit),
            ("target_worktree_path", &self.target_path_str),
        ];
        if let Some(target) = self.target_branch.as_deref() {
            vars.push(("target", target));
        }
        if let Some(branch) = removed_branch {
            vars.push(("branch", branch));
        }
        vars
    }
}

```

### Core Architecture Module: `src/config/hooks.rs`
```
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::git::HookType;

use super::commands::CommandConfig;

/// Shared hook configuration for user and project configs.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, JsonSchema)]
pub struct HooksConfig {
    /// Commands to execute before switch begins (blocking, fail-fast)
    #[serde(
        default,
        rename = "pre-switch",
        skip_serializing_if = "Option::is_none"
    )]
    pub pre_switch: Option<CommandConfig>,

    /// Commands to execute after switching to a worktree (background)
    #[serde(
        default,
        rename = "post-switch",
        skip_serializing_if = "Option::is_none"
    )]
    pub post_switch: Option<CommandConfig>,

    /// Commands to execute after worktree creation (blocking, fail-fast)
    #[serde(
        default,
        rename = "pre-start",
        alias = "pre-create",
        skip_serializing_if = "Option::is_none"
    )]
    pub pre_create: Option<CommandConfig>,

    /// Commands to execute after worktree creation (background)
    #[serde(
        default,
        rename = "post-start",
        alias = "post-create",
        skip_serializing_if = "Option::is_none"
    )]
    pub post_create: Option<CommandConfig>,

    /// Commands to execute before committing during merge (blocking, fail-fast)
    #[serde(
        default,
        rename = "pre-commit",
        skip_serializing_if = "Option::is_none"
    )]
    pub pre_commit: Option<CommandConfig>,

    /// Commands to execute after committing (background)
    #[serde(
        default,
        rename = "post-commit",
        skip_serializing_if = "Option::is_none"
    )]
    pub post_commit: Option<CommandConfig>,

    /// Commands to execute before merging (blocking, fail-fast)
    #[serde(default, rename = "pre-merge", skip_serializing_if = "Option::is_none")]
    pub pre_merge: Option<CommandConfig>,

    /// Commands to execute after successful merge (background)
    #[serde(
        default,
        rename = "post-merge",
        skip_serializing_if = "Option::is_none"
    )]
    pub post_merge: Option<CommandConfig>,

    /// Commands to execute before worktree removal (blocking, fail-fast)
    #[serde(
        default,
        rename = "pre-remove",
        skip_serializing_if = "Option::is_none"
    )]
    pub pre_remove: Option<CommandConfig>,

    /// Commands to execute after worktree removal (background)
    #[serde(
        default,
        rename = "post-remove",
        skip_serializing_if = "Option::is_none"
    )]
    pub post_remove: Option<CommandConfig>,
}

impl HooksConfig {
    pub fn get(&self, hook: HookType) -> Option<&CommandConfig> {
        match hook {
            HookType::PreSwitch => self.pre_switch.as_ref(),
            HookType::PostSwitch => self.post_switch.as_ref(),
            HookType::PreCreate => self.pre_create.as_ref(),
            HookType::PostCreate => self.post_create.as_ref(),
            HookType::PreCommit => self.pre_commit.as_ref(),
            HookType::PostCommit => self.post_commit.as_ref(),
            HookType::PreMerge => self.pre_merge.as_ref(),
            HookType::PostMerge => self.post_merge.as_ref(),
            HookType::PreRemove => self.pre_remove.as_ref(),
            HookType::PostRemove => self.post_remove.as_ref(),
        }
    }
}

use super::user::Merge;

/// Merge two optional command configs by appending (base commands first, then overlay).
fn merge_append_hooks(
    base: &Option<CommandConfig>,
    overlay: &Option<CommandConfig>,
) -> Option<CommandConfig> {
    match (base, overlay) {
        (None, None) => None,
        (Some(b), None) => Some(b.clone()),
        (None, Some(o)) => Some(o.clone()),
        (Some(b), Some(o)) => Some(b.merge_append(o)),
    }
}

impl Merge for HooksConfig {
    /// Merge two hook configs using append semantics.
    ///
    /// Both global and per-project hooks run (global first, then per-project).
    fn merge_with(&self, other: &Self) -> Self {
        Self {
            pre_switch: merge_append_hooks(&self.pre_switch, &other.pre_switch),
            post_switch: merge_append_hooks(&self.post_switch, &other.post_switch),
            pre_create: merge_append_hooks(&self.pre_create, &other.pre_create),
            post_create: merge_append_hooks(&self.post_create, &other.post_create),
            pre_commit: merge_append_hooks(&self.pre_commit, &other.pre_commit),
            post_commit: merge_append_hooks(&self.post_commit, &other.post_commit),
            pre_merge: merge_append_hooks(&self.pre_merge, &other.pre_merge),
            post_merge: merge_append_hooks(&self.post_merge, &other.post_merge),
            pre_remove: merge_append_hooks(&self.pre_remove, &other.pre_remove),
            post_remove: merge_append_hooks(&self.post_remove, &other.post_remove),
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2837** (2026-05-21): **`wt switch` interactive picker with `cd = false` skips switch hooks**
  *Symptoms*: ## Bug  With `[switch] cd = false` (or `--no-cd`), the interactive picker prints the selected branch and exits without firing any switch hooks. The same `wt switch <branch> --no-cd` invocation with a branch arg fires hooks normally, so the picker path is inconsistent with the direct-arg path.  Surfaced in #2796 — @endigma's working cmux recipe needs a `wt pick` alias that runs the picker twice to force hooks to fire:  ```toml [aliases] pick = """ b=$(wt switch) [ -n "$b" ] && wt switch "$b" """ ```  ## Reproduce  `wt.toml`:  ```toml [switch] cd = false  [pre-switch] trace = "echo pre-switch fired for {{ branch }} >&2" ```  - `wt switch other-branch` → prints `pre-switch fired for other-branch` ✓ - `wt switch` (picker, select `other-branch`) → prints `other-branch`, no hook output ✗  `post-switch`, `pre-start`, `post-start` are also skipped on the picker path.  ## Cause  [`src/commands/picker/mod.rs:767-777`](https://github.com/max-sixty/worktrunk/blob/5c87bf22ca77ec9846e799e5a45d66d8526619d2/src/commands/picker/mod.rs#L767-L777) early-returns on `!change_dir`, before `run_pre_switch_hooks` / `plan_switch` / `execute_switch` / the background-hook spawn that the `change_dir = true` branch flows into.  Comment on the branch says "read-only, no side effects" — that was the intent when #1330 added `--no-cd` support to the picker, but the same shape later bit #1704 (`alt-r` removal in the picker skipping `pre-remove` / `post-remove`).  ## Constraint  Pre-switch hooks can't run whil
  **Post-Mortem & Fix Analysis**:
  > Verified the analysis: the early-return at [src/commands/picker/mod.rs:767-777](https://github.com/max-sixty/worktrunk/blob/5c87bf22ca77ec9846e799e5a45d66d8526619d2/src/commands/picker/mod.rs#L767-L777) does skip the entire hook + execute pipeline that the `change_dir = true` branch flows into (`run_pre_switch_hooks` → `plan_switch` → `execute_switch` → background hooks).  One missing piece of context: the no-hooks behavior on the picker `--no-cd` path was an explicit design decision in #1445 ("When `wt switch --no-cd` opens the interactive picker (no branch argument), selecting a branch prints its name to stdout and exits — no switching, no cd directive, **no hooks**"), and `test_switch_picker_no_cd_prints_branch_without_switching` in `tests/integration_tests/switch_picker.rs` locks that contract in. So the fix is a contract change, not just a missing call: any patch that makes hooks fire needs to revisit #1445's intent and rework that test, and reason about what `alt-c` (create) with
  > OK, I think we probably should run the switch hooks, even though we're not `cd`-ing?   @endigma do you agree? or is the existing state what you would expect?
  > I would expect the interactive picker to work identically to when providing the branch as an argument, which is what the dumb pick alias is hacking it to do so it works

- **Issue #2334** (2026-04-20): **Flaky: test_switch_picker_preview_panel_main_diff on macOS**
  *Symptoms*: `test_switch_picker_preview_panel_main_diff` failed on macOS in PR #2333 (a docs-only change — 6 files, -137 lines, only markdown and `after_long_help` strings), suggesting an intermittent environment-dependent issue.  **Snapshot diff:**  The expected output has one branch row (`feature`); the actual output has an extra `main` row appearing below it — as if the picker's branch-list rendering reached a different state than the test expects.  ```     1     1 │ > [QUERY]     2     2 │     Branch   Status        HEAD±    main↕  Remote⇅  Commit     3       │-> + feature      ↑                 ↑2               [HASH]..           3 │+> + feature      ↑                 ↑2               [HASH]..           4 │+  @ main         ^                                  [HASH] ```  **Run:** https://github.com/max-sixty/worktrunk/actions/runs/24653821440/job/72082401646  macOS passed on the latest main CI run (24652863009, same SHA `1a0a3e2f` this PR branched from), so this is intermittent. Related (closed): #1592, same family of flakes in `switch_picker` preview tests on macOS.  > _This was written by Claude Code on behalf of Maximilian Roos_
  **Post-Mortem & Fix Analysis**:
  > Looked at this without being able to reproduce on Linux, so this is code reading rather than a verified diagnosis.  One plausible mechanism for the extra `main` row:  - Pressing `3` is bound to `execute-silent(echo 3 > …)+refresh-preview` ([picker/mod.rs:558-561](https://github.com/max-sixty/worktrunk/blob/1043726fd98f6c7accc1da4794cac6c9927fd531/src/commands/picker/mod.rs#L558-L561)). It refreshes the preview but does not touch the query, so the list should stay filtered to `feature`. - The test waits for `diff --git` via `wait_for_stable_with_content` ([switch_picker.rs:802](https://github.com/max-sixty/worktrunk/blob/1043726fd98f6c7accc1da4794cac6c9927fd531/tests/integration_tests/switch_picker.rs#L802)). That helper has a `content_found_at` fallback ([switch_picker.rs:458-462](https://github.com/max-sixty/worktrunk/blob/1043726fd98f6c7accc1da4794cac6c9927fd531/tests/integration_tests/switch_picker.rs#L458-L462)) that returns once the expected string has been continuously present fo

- **Issue #1706** (2026-03-24): **bug: snapshot_formatting_guard `---` delimiter matches mid-line**
  *Symptoms*: ## Bug  In `tests/integration_tests/snapshot_formatting_guard.rs:150`, `extract_output_sections` searches for `"---"` as a bare substring:  ```rust if let Some(first_delim) = content.find("---") {     let after_first = &content[first_delim + 3..];     if let Some(second_delim) = after_first.find("---") { ```  This matches `---` anywhere in the content, not at line boundaries. A snapshot whose YAML header or output body contains `---` (e.g., a git diff showing `--- a/file.txt`) would cause incorrect section boundary detection, potentially missing double-blank-line violations in the truncated output.  ### Fix  Use line-boundary matching: search for `"\n---\n"` instead of bare `"---"` substring.
  **Post-Mortem & Fix Analysis**:
  > @worktrunk-bot fix

- **Issue #1704** (2026-03-26): **picker alt-r removal skips pre-remove and post-remove hooks**
  *Symptoms*: ## Bug  Worktree removal via alt-r in the picker (`wt switch` TUI) skips `pre-remove` and `post-remove` hooks entirely.  The code at `src/commands/picker/mod.rs:70` explicitly notes: > No output, no hooks, no cd directives — we're inside skim's TUI.  ### Impact  - `pre-remove` hooks intended as safety checks (e.g., preventing removal of worktrees with uncommitted work) are bypassed - `post-remove` cleanup hooks (e.g., stopping services, cleaning up ports) never run  ### Context  Running hooks inside skim's TUI event loop is architecturally constrained — the main thread blocks skim, and hooks may produce output or require user interaction. However:  1. `pre-remove` hooks could run before signaling skim to reload (they're blocking by design) 2. `post-remove` hooks could be spawned in the background thread alongside the git operations  ### Suggestion  At minimum, run `pre-remove` hooks before the removal. If the hook fails, skip the removal and show a brief indicator. For `post-remove`, spawn in the background thread after `execute_removal`.  If hooks can't be supported, document this limitation in `wt switch --help` and the picker legend, not just as an inline code comment.
  **Post-Mortem & Fix Analysis**:
  > @worktrunk-bot fix
  > Fix in #1710.  The picker's background thread now runs pre-remove hooks (silently, with suppressed output) before `execute_removal`, and spawns post-remove hooks via `spawn_background_hooks` after. Pre-remove hook failure aborts the removal. Template variables match the normal `wt remove` flow.  Added `run_hooks_silently()` for TUI contexts where stderr output would corrupt skim's display — it runs each hook command, checks exit codes, and bails on first failure. 

- **Issue #1703** (2026-03-24): **bug: `wt hook pre-start` uses FailFast instead of Warn**
  *Symptoms*: ## Bug  `wt hook pre-start` uses `HookFailureStrategy::FailFast` (aborts on failure), but `execute_pre_start_commands` during automatic worktree creation uses `HookFailureStrategy::Warn` (warns and continues).  The documentation in `wt hook --help` explicitly says: > failure aborts the operation (except `pre-start`, which warns and continues)  ### Reproduction  ```bash # Configure a pre-start hook that fails wt config create --hooks.pre-start='["false"]'  # Manual invocation aborts (bug — should warn and continue) wt hook pre-start  # exits non-zero  # Automatic invocation during create warns and continues (correct) wt switch --create test-branch ```  ### Root Cause  In `src/commands/hook_commands.rs:265`, `HookType::PreStart` is grouped with `PreSwitch`, `PreRemove`, `PreCommit`, and `PreMerge` in the `FailFast` match arm. It should have its own match arm using `HookFailureStrategy::Warn`, matching the behavior in `src/commands/worktree/hooks.rs:28`.  ### Fix  Separate `PreStart` from the `FailFast` group and give it `Warn` strategy.

- **Issue #1592** (2026-04-09): **Flaky: test_switch_picker_preview_panel_log on macOS**
  *Symptoms*: `test_switch_picker_preview_panel_log` failed on macOS in PR #1576 (a CLAUDE.md-only change), suggesting an intermittent environment-dependent issue.  **Snapshot diff:**  The expected output shows status columns with values (`↑`, `↑5`), but the actual output shows dots (`·`) for all status columns — as if the git status data wasn't populated in time.  ``` -  > + feature      ↑                 ↑5               [HASH].. +  > + feature  ·                 ·        ·        ·  [HASH] ```  **Run:** https://github.com/max-sixty/worktrunk/actions/runs/23214881790/job/67472979949  macOS passed on the latest main CI run (23214660811), so this is intermittent.

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

### Incident Patch 1: `7ea43463` (2026-10-04)
**Commit Message**: fix(switch): suggest a dev.azure.com URL when the Azure remote is SSH (#4364)

For a user whose Azure DevOps remote is SSH
(`[REDACTED_EMAIL]:v3/...`), `wt switch pr:N` could suggest adding
a remote at `https://ssh.dev.azure.com/...`, which isn't a web host.
This PR makes the suggestion use `https://dev.azure.com/...`.

**Path:** when `az repos pr show` returns no `repository.webUrl`,
`fetch_pr_info` falls back to the `(host, org)` that
[`detect_azure_target`](https://github.com/max-sixty/worktrunk/blob/981b91661e61538ab3f7e512c9400300cf8da0d0/src/git/remote_ref/azure.rs#L120-L149)
reads from local remotes. Before this change it returned the remote's
raw host. If the PR then belongs to a repository with no local remote
(PR ids are org-scoped, so another repo in the org qualifies),
[`azure::fork_remote_url`](https://github.com/max-sixty/worktrunk/blob/981b91661e61538ab3f7e512c9400300cf8da0d0/src/git/remote_ref/mod.rs#L274-L279)
builds the "Add the remote" hint on that SSH host. The PR link printed
just above it was already correct, because `pr_web_url` maps every
non-visualstudio host to `dev.azure.com`.

**Fix:** `detect_azure_target` now returns a web host, the same shape
`parse_w

**File**: `src/git/remote_ref/azure.rs` (modified, +18/-10)
```diff
@@ -122,22 +122,30 @@ struct AzForkRepository {
 /// Prefers the primary remote (typically `origin` or whatever the user pushed
 /// with) so fork workflows hit the right tenant. Falls back to the first
 /// Azure remote found if the primary isn't Azure DevOps.
+///
+/// The host is a web host, the same shape [`parse_web_url`] returns: an
+/// `ssh.dev.azure.com` remote reports `dev.azure.com`, since the URL builders
+/// that consume it put the host into an HTTPS URL.
 fn detect_azure_target(repo: &Repository) -> Option<(String, String)> {
+    let target = |parsed: &GitRemoteUrl| {
+        let org = parsed.azure_organization()?;
+        let host = if host_is_within(parsed.host(), "visualstudio.com") {
+            parsed.host()
+        } else {
+            "dev.azure.com"
+        };
+        Some((host.to_string(), org.to_string()))
+    };
     if let Ok(remote) = repo.primary_remote()
         && let Some(url) = repo.effective_remote_url(&remote)
         && let Some(parsed) = GitRemoteUrl::parse(&url)
-        && let Some(org) = parsed.azure_organization()
+        && let Some(found) = target(&parsed)
     {
-        return Some((parsed.host().to_string(), org.to_string()));
-    }
-    for (_, url) in repo.all_remote_urls() {
-        if let Some(parsed) = GitRemoteUrl::parse(&url)
-            && let Some(org) = parsed.azure_organization()
-        {
-            return Some((parsed.host().to_string(), org.to_string()));
-        }
+        return Some(found);
     }
-    None
+    repo.all_remote_urls()
+        .into_iter()
+        .find_map(|(_, url)| target(&GitRemoteUrl::parse(&url)?))
 }
 
 /// Build the `--org` URL for the `az` CLI from a host and organization.
```

**File**: `tests/integration_tests/switch.rs` (modified, +35/-0)
```diff
@@ -6787,6 +6787,41 @@ fn test_switch_pr_azure_fork(#[from(repo_with_remote)] repo: TestRepo) {
     });
 }
 
+/// With no `webUrl` in the response, the org and host come from the local
+/// remote. An `ssh.dev.azure.com` remote must still suggest an HTTPS
+/// `dev.azure.com` URL for the PR's repository, not one on the SSH host.
+#[rstest]
+fn test_switch_pr_azure_ssh_remote_suggests_web_host(#[from(repo_with_remote)] repo: TestRepo) {
+    repo.run_git(&[
+        "remote",
+        "set-url",
+        "origin",
+        "git@ssh.dev.azure.com:v3/myorg/myproject/test-repo",
+    ]);
+
+    let az_response = r#"{
+        "title": "Fix in a sibling repository",
+        "createdBy": {"uniqueName": "alice@example.com"},
+        "status": "active",
+        "isDraft": false,
+        "sourceRefName": "refs/heads/feature-auth",
+        "repository": {
+            "name": "other-repo",
+            "project": {"name": "myproject"}
+        },
+        "forkSource": null
+    }"#;
+
+    let mock_bin = setup_mock_az(&repo, az_response);
+
+    let settings = setup_snapshot_settings(&repo);
+    settings.bind(|| {
+        let mut cmd = make_snapshot_cmd(&repo, "switch", &["pr:101"], None);
+        configure_mock_cli_env(&mut cmd, &mock_bin);
+        assert_cmd_snapshot!("switch_pr_azure_ssh_remote_suggests_web_host", cmd);
+    });
+}
+
 /// A missing PR reaches the user as the `TF401174` line `az` printed.
 ///
 /// Once the extension question is settled, `azure::fetch_pr_info` classifies
```

**File**: `tests/snapshots/integration__integration_tests__switch__switch_pr_azure_ssh_remote_suggests_web_host.snap` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+---
+source: tests/integration_tests/switch.rs
+info:
+  program: wt
+  args:
+    - switch
+    - "pr:101"
+  env:
+    APPDATA: "[TEST_CONFIG_HOME]"
+    CLAUDE_CONFIG_DIR: "[TEST_CLAUDE_CONFIG]"
+    CLICOLOR_FORCE: "1"
+    COLUMNS: "500"
+    GIT_ALLOW_PROTOCOL: file
+    GIT_AUTHOR_DATE: "2025-01-01T00:00:00Z"
+    GIT_AUTHOR_EMAIL: test@example.com
+    GIT_AUTHOR_NAME: Test User
+    GIT_COMMITTER_DATE: "2025-01-01T00:00:00Z"
+    GIT_COMMITTER_EMAIL: test@example.com
+    GIT_COMMITTER_NAME: Test User
+    GIT_CONFIG_COUNT: "2"
+    GIT_CONFIG_GLOBAL: /nonexistent/wt/gitconfig
+    GIT_CONFIG_KEY_0: user.useConfigOnly
+    GIT_CONFIG_KEY_1: rerere.enabled
+    GIT_CONFIG_SYSTEM: /nonexistent/wt/gitconfig
+    GIT_CONFIG_VALUE_0: "true"
+    GIT_CONFIG_VALUE_1: "false"
+    GIT_TERMINAL_PROMPT: "0"
+    HOME: "[TEST_HOME]"
+    LANG: C
+    LC_ALL: C
+    LLVM_PROFILE_FILE: "[LLVM_PROFILE_FILE]"
+    OPENCODE_CONFIG_DIR: "[TEST_OPENCODE_CONFIG]"
+    PATH: "[PATH]"
+    TERM: alacritty
+    USERPROFILE: "[TEST_HOME]"
+    WORKTRUNK_APPROVALS_PATH: "[TEST_APPROVALS]"
+    WORKTRUNK_CONFIG_PATH: "[TEST_CONFIG]"
+    WORKTRUNK_SYSTEM_CONFIG_PATH: "[TEST_SYSTEM_CONFIG]"
+    WORKTRUNK_TEST_BASH_INSTALLED: "0"
+    WORKTRUNK_TEST_CLAUDE_INSTALLED: "0"
+    WORKTRUNK_TEST_CODEX_INSTALLED: "0"
+    WORKTRUNK_TEST_DELAYED_STREAM_MS: "-1"
+    WORKTRUNK_TEST_EPOCH: "1735776000"
+    WORKTRUNK_TEST_FISH_INSTALLED: "0"
+    WORKTRUNK_TEST_GEMINI_INSTALLED: "0"
+    WORKTRUNK_TEST_MOCK_CONFIG_DIR: "[TEST_MOCK_CONFIG]"
+    WORKTRUNK_TEST_NUSHELL_ENV: "0"
+    WORKTRUNK_TEST_OPENCODE_INSTALLED: "0"
+    WORKTRUNK_TEST_PARENT_SHELL: ""
+    WORKTRUNK_TEST_POWERSHELL_ENV: "0"
+    WORKTRUNK_TEST_POWERSHELL_INSTALLED: "0"
+    WORKTRUNK_TEST_PROBE_TIMEOUT_MS: "60000"
+    WORKTRUNK_TEST_SKIP_URL_HEALTH_CHECK: "1"
+    WORKTRUNK_TEST_ZSH_INSTALLED: "0"
+    XDG_CONFIG_HOME: "[TEST_CONFIG_HOME]"
+---
+success: false
+exit_code: 1
+----- stdout -----
+
+----- stderr -----
+[36m◎[39m [36mFetching PR #101...[39m
+[107m [0m [1mFix in a sibling repository[22m (#101)
+[107m [0m by @alice@example.com · active · feature-auth · [90mhttps://dev.azure.com/myorg/myproject/_git/other-repo/pullrequest/101[39m
+[31m✗[39m [31mNo remote found for [1mmyorg/other-repo[22m[39m
+[2m↳[22m [2mAdd the remote: [4mgit remote add upstream https://dev.azure.com/myorg/myproject/_git/other-repo[24m[22m
```

---

### Incident Patch 2: `f844d09c` (2026-10-04)
**Commit Message**: fix(remove): name trash staging dirs by worktree registration (#4361)

A `wt step prune` printed every per-item line quickly, then sat for
about 10s before its `Pruned …` summary. Two of the pruned worktrees
were Codex worktrees, which all live at `~/.codex/worktrees/<id>/<repo>`
and so share the basename `Mackup`. Removal staged each worktree at
`.git/wt/trash/<basename>-<epoch-second>`, so the two concurrent
removals picked the same path in the same second. The second rename
failed onto the existing directory, and prune's synchronous fallback ran
`git worktree remove` in the foreground; the summary waited for that
recursive delete. The run's logs show it: nine worktrees got a detached
`internal/remove.log`, the tenth (`codex/promptfoo-followups`) none.

Staging names now use the worktree's registration id under
`<common>/worktrees/`, which git keeps unique among a repository's
worktrees. `ensure_holds_this_worktree` already resolves and verifies
that git dir, so it now returns it. A failed rename also logs its error
at debug level instead of discarding it.

The collision predates #4337: v0.80.0 shows the same 3.4s stall on a
two-worktree repro (50k ignored files each), which drop

**File**: `src/git/remove.rs` (modified, +23/-12)
```diff
@@ -462,7 +462,7 @@ pub fn stage_worktree_removal(
     force_worktree: bool,
 ) -> anyhow::Result<Option<PathBuf>> {
     let worktree = repo.worktree_at(worktree_path);
-    worktree.ensure_holds_this_worktree()?;
+    let git_dir = worktree.ensure_holds_this_worktree()?;
 
     // Lock is the user's explicit "don't remove this". `--force` does not
     // override it, matching `git worktree remove` and `prepare_worktree_removal`.
@@ -487,7 +487,7 @@ pub fn stage_worktree_removal(
 
     stop_fsmonitor_daemon(&repo.worktree_at(worktree_path));
 
-    Ok(rename_into_trash(repo, worktree_path))
+    Ok(rename_into_trash(repo, worktree_path, &git_dir))
 }
 
 /// Rename a worktree into `<git-common-dir>/wt/trash/` and prune git metadata.
@@ -501,12 +501,17 @@ pub fn stage_worktree_removal(
 /// sweeping the repository, so a sibling worktree whose directory happens to
 /// be absent right now keeps its registration. A locked worktree never reaches
 /// here — [`stage_worktree_removal`] rejects one before the rename.
-fn rename_into_trash(repo: &Repository, worktree_path: &Path) -> Option<PathBuf> {
+fn rename_into_trash(repo: &Repository, worktree_path: &Path, git_dir: &Path) -> Option<PathBuf> {
     let trash_dir = repo.wt_trash_dir();
     let _ = std::fs::create_dir_all(&trash_dir);
-    let staged_path = generate_removing_path(&trash_dir, worktree_path);
+    let staged_path = generate_removing_path(&trash_dir, git_dir);
 
-    if std::fs::rename(worktree_path, &staged_path).is_ok() {
+    if std::fs::rename(worktree_path, &staged_path)
+        .inspect_err(|e| {
+            tracing::debug!(error = %e, "Failed to stage worktree into trash, falling back: {e}");
+        })
+        .is_ok()
+    {
         // The rename moved the directory out from under `worktree_path`,
         // leaving its registration stale for the prune to delete.
         if let Err(e) = repo.prune_worktree_entry(worktree_path) {
@@ -676,10 +681,16 @@ fn cas_delete_branch_outcome(
 /// worktrees on different mount points will get EXDEV and fall back to the
 /// `git worktree remove` path.
 ///
-/// Format: `<trash-dir>/<name>-<timestamp>`
-pub(crate) fn generate_removing_path(trash_dir: &Path, worktree_path: &Path) -> PathBuf {
+/// Format: `<trash-dir>/<name>-<timestamp>`, where `<name>` is the final
+/// component of the worktree's `git_dir`: its registration id under
+/// `<common>/worktrees/`, which git keeps unique among a repository's
+/// worktrees. The directory's basename is not unique — Codex places every
+/// worktree at `<id>/<repo>` — and two removals sharing a staging path in the
+/// same second would make the second rename fail onto the synchronous
+/// fallback.
+pub(crate) fn generate_removing_path(trash_dir: &Path, git_dir: &Path) -> PathBuf {
     let timestamp = epoch_now();
-    let name = worktree_path
+    let name = git_dir
         .file_name()
         .map(|n| n.to_string_lossy())
         .unwrap_or_default();
@@ -1056,11 +1067,11 @@ mod tests {
     #[test]
     fn test_generate_removing_path() {
         let trash_dir = PathBuf::from("/some/path/.git/wt/trash");
-        let path = PathBuf::from("/foo/bar/feature-branch");
-        let removing_path = generate_removing_path(&trash_dir, &path);
-        // Format: <trash>/<name>-<timestamp>
+        let git_dir = PathBuf::from("/some/path/.git/worktrees/repo1");
+        let removing_path = generate_removing_path(&trash_dir, &git_dir);
+        // Format: <trash>/<registration>-<timestamp>
         let name = removing_path.file_name().unwrap().to_string_lossy();
-        assert!(name.starts_with("feature-branch-"));
+        assert!(name.starts_with("repo1-"));
         assert!(removing_path.starts_with(&trash_dir));
     }
 
```

**File**: `src/git/repository/working_tree.rs` (modified, +14/-10)
```diff
@@ -890,30 +890,34 @@ impl<'a> WorkingTree<'a> {
     /// two cover different halves of "the directory no longer holds this
     /// worktree": prunable is the half git notices, this is the half it does
     /// not.
-    pub fn ensure_holds_this_worktree(&self) -> anyhow::Result<()> {
+    ///
+    /// Returns the git dir that answers for this worktree: the common dir for
+    /// the main worktree, its registration under `<common>/worktrees/`
+    /// otherwise.
+    pub fn ensure_holds_this_worktree(&self) -> anyhow::Result<PathBuf> {
         let common_dir = self.repo.git_common_dir();
         // A git dir that can't be resolved at all is the strongest form of "not
         // this worktree": nothing there answers for it. Treating that as a
         // refusal keeps the failure closed.
         let git_dir = Repository::git_dir_at(&self.path);
         if git_dir.as_deref() == Some(common_dir) {
-            return Ok(());
+            return Ok(common_dir.to_path_buf());
         }
 
         // Where the occupant's own registration says it lives. `None` when there
         // is no registration of ours to ask — the occupant answers to a
         // different repository, or its registration here has lost its `gitdir`
         // file.
         let registrations = common_dir.join("worktrees");
-        let occupant_registered_at = git_dir
-            .filter(|git_dir| git_dir.parent() == Some(registrations.as_path()))
-            .as_deref()
-            .and_then(registration_worktree_path);
-        if occupant_registered_at
-            .as_deref()
-            .is_some_and(|recorded| crate::path::paths_match(recorded, &self.path))
+        let registration =
+            git_dir.filter(|git_dir| git_dir.parent() == Some(registrations.as_path()));
+        let occupant_registered_at = registration.as_deref().and_then(registration_worktree_path);
+        if let Some(registration) = registration
+            && occupant_registered_at
+                .as_deref()
+                .is_some_and(|recorded| crate::path::paths_match(recorded, &self.path))
         {
-            return Ok(());
+            return Ok(registration);
         }
 
         Err(GitError::WorktreePathNotOurs {
```

**File**: `tests/integration_tests/step_prune.rs` (modified, +37/-0)
```diff
@@ -79,6 +79,43 @@ fn test_prune_removes_merged(mut repo: TestRepo) {
     assert!(!worktree_path.exists(), "Worktree should be fully removed");
 }
 
+/// Worktrees sharing a directory basename (Codex's `<id>/<repo>` layout) each
+/// stage into trash. The suite pins `epoch_now()`, so with basename-derived
+/// staging names the second rename would collide and fall back to a
+/// synchronous `git worktree remove`, which spawns no detached cleanup.
+#[rstest]
+fn test_prune_stages_worktrees_sharing_a_basename(mut repo: TestRepo) {
+    repo.commit("initial");
+    let parent = repo.root_path().parent().unwrap().to_path_buf();
+    let worktrees = [
+        ("one", parent.join("aaaa/repo")),
+        ("two", parent.join("bbbb/repo")),
+    ];
+    for (branch, path) in &worktrees {
+        repo.add_worktree_at_path(branch, path);
+    }
+
+    let output = repo
+        .wt_command()
+        .args(["step", "prune", "--yes", "--min-age=0s"])
+        .output()
+        .unwrap();
+    assert!(
+        output.status.success(),
+        "{}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+
+    let logs = crate::common::resolve_git_common_dir(repo.root_path()).join("wt/logs");
+    for (branch, path) in &worktrees {
+        assert!(!path.exists(), "{branch} must be removed");
+        assert!(
+            logs.join(branch).join("internal/remove.log").exists(),
+            "{branch} must be staged into trash with a detached cleanup"
+        );
+    }
+}
+
 /// Prune skips worktrees with unique commits (not merged)
 #[rstest]
 fn test_prune_skips_unmerged(mut repo: TestRepo) {
```

---

### Incident Patch 3: `fc044f98` (2026-10-03)
**Commit Message**: fix(remove): continue after per-target execution failures (#4357)

A pre-remove hook or synchronous Git failure in one target currently
stops a multi-target removal before later targets are attempted.
Continue with the remaining valid targets, report each ordinary failure,
and return exit status 1 if any target failed. JSON includes successful
targets in execution order, including branch-only removal and the
current worktree executed last.

SIGINT and SIGTERM cancel the batch immediately with exit status 130 or
143. Preserve the underlying error in foreground removal diagnostics so
a captured Git interruption reaches the batch cancellation check.

Validation: 5,068 tests passed (one skipped), doctests and documentation
build passed, and all final pre-commit checks passed. Integration
coverage exercises hook and execution-time removal failures in
foreground/background modes, correct JSON attribution, and hook/Git
interruptions, including a detached checkout. Four Git-interruption
regressions fail against the original executable and pass with this
change; independent review found no remaining issues. Help and generated
documentation checks passed after updating from main.

> _This wa

**File**: `src/commands/remove.rs` (modified, +24/-20)
```diff
@@ -1,13 +1,18 @@
 //! The `wt remove` command: validate removal targets, approve hooks, and
 //! dispatch each removal to the output handler.
+//!
+//! Target failures are reported independently; later targets still run and
+//! the batch exits unsuccessfully. An interrupt cancels the batch immediately.
 
 use std::collections::HashSet;
 use std::path::Path;
 
 use anyhow::Context;
 use worktrunk::HookType;
 use worktrunk::config::UserConfig;
-use worktrunk::git::{BranchDeletionMode, ErrorExt, GitError, Repository, ResolvedWorktree};
+use worktrunk::git::{
+    BranchDeletionMode, ErrorExt, GitError, Repository, ResolvedWorktree, WorktrunkError,
+};
 use worktrunk::styling::{eprintln, info_message};
 
 use crate::cli::{RemoveArgs, SwitchFormat};
@@ -548,27 +553,26 @@ pub fn handle_remove_command(args: RemoveArgs, yes: bool) -> anyhow::Result<()>
                     announcer.flush()?;
                     Ok(fate)
                 };
-                // Fates in execution order, which is also the JSON order below.
-                let mut fates = Vec::new();
-                for result in &plans.others {
-                    fates.push(run(result)?);
-                }
-                for result in &plans.branch_only {
-                    fates.push(run(result)?);
-                }
-                if let Some(ref result) = plans.current {
-                    fates.push(run(result)?);
+                let mut failed = !plans.errors.is_empty();
+                let mut json_items = Vec::new();
+                for result in all_plans() {
+                    match run(result) {
+                        Ok(fate) => {
+                            if json_mode {
+                                json_items.push(result.to_json(fate));
+                            }
+                        }
+                        Err(e) => {
+                            if let Some(signal) = e.interrupt_signal() {
+                                return Err(WorktrunkError::Interrupted { signal, hint: None }.into());
+                            }
+                            crate::print_command_error(&e);
+                            failed = true;
+                        }
+                    }
                 }
 
                 if json_mode {
-                    let json_items: Vec<serde_json::Value> = plans
-                        .others
-                        .iter()
-                        .chain(&plans.branch_only)
-                        .chain(plans.current.as_ref())
-                        .zip(fates)
-                        .map(|(removal, fate)| removal.to_json(fate))
-                        .collect();
                     print_json(&json_items)?;
                 }
 
@@ -577,7 +581,7 @@ pub fn handle_remove_command(args: RemoveArgs, yes: bool) -> anyhow::Result<()>
                 // it never delays the user-visible progress/success messages.
                 super::process::run_internal_sweep(&repo);
 
-                if !plans.errors.is_empty() {
+                if failed {
                     anyhow::bail!("");
                 }
 
```

**File**: `src/git/error.rs` (modified, +21/-11)
```diff
@@ -123,8 +123,8 @@ pub trait ErrorExt {
     /// short single-line label.
     ///
     /// Use this when embedding a sub-error's text inside another typed error's
-    /// message field (e.g., `GitError::WorktreeRemovalFailed::error`,
-    /// `GitError::PushFailed::error`) so the user sees git's real reason
+    /// message field (e.g., `GitError::PushFailed::error`) so the user sees git's
+    /// real reason
     /// rather than just the [`CommandError`] single-line summary.
     fn display_message(&self) -> String;
 
@@ -382,7 +382,7 @@ impl SwitchSuggestionCtx {
 ///     println!("branch {branch} already exists");
 /// }
 /// ```
-#[derive(Debug, Clone)]
+#[derive(Debug)]
 pub enum GitError {
     // Git state errors
     /// A worktree is not on a branch, so a command needing one refuses.
@@ -539,7 +539,7 @@ pub enum GitError {
     WorktreeRemovalFailed {
         branch: String,
         path: PathBuf,
-        error: String,
+        error: anyhow::Error,
         /// Top-level entries remaining in the directory (for "Directory not empty" diagnostics)
         remaining_entries: Option<Vec<String>>,
     },
@@ -720,7 +720,14 @@ pub enum GitError {
     },
 }
 
-impl std::error::Error for GitError {}
+impl std::error::Error for GitError {
+    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
+        match self {
+            Self::WorktreeRemovalFailed { error, .. } => Some(error.as_ref()),
+            _ => None,
+        }
+    }
+}
 
 /// `"1 path with unresolved conflicts"` — the shared tail of every message
 /// about an unmerged index. [`GitError::UnmergedPaths`] refuses outright;
@@ -1335,8 +1342,9 @@ impl GitError {
                 remaining_entries,
                 ..
             } => {
+                let error = error.display_message();
                 let title = self.title();
-                write!(f, "{}", format_error_block(error_message(&title), error))?;
+                write!(f, "{}", format_error_block(error_message(&title), &error))?;
                 if let Some(entries) = remaining_entries {
                     const MAX_SHOWN: usize = 10;
                     let listing = if entries.len() > MAX_SHOWN {
@@ -2336,7 +2344,7 @@ mod tests {
             GitError::WorktreeRemovalFailed {
                 branch: "feature".into(),
                 path: PathBuf::from("/tmp/repo.feature"),
-                error: "fatal: …".into(),
+                error: anyhow::anyhow!("fatal: …"),
                 remaining_entries: None,
             }.to_string(),
             @"Failed to remove worktree for feature @ /tmp/repo.feature"
@@ -2361,14 +2369,15 @@ mod tests {
         let inner = GitError::BranchAlreadyExists {
             branch: "feature".into(),
         };
+        let expected = inner.to_string();
         let wrapped = GitError::WithSwitchSuggestion {
-            source: Box::new(inner.clone()),
+            source: Box::new(inner),
             ctx: SwitchSuggestionCtx {
                 extra_flags: vec!["--execute=claude".into()],
                 trailing_args: vec![],
             },
         };
-        assert_eq!(inner.to_string(), wrapped.to_string());
+        assert_eq!(expected, wrapped.to_string());
 
         // WorktrunkError variants
         assert_snapshot!(
@@ -2882,15 +2891,16 @@ mod tests {
             action: Some("merge".into()),
             worktree: None,
         };
+        let expected = inner.to_string();
         let wrapped = GitError::WithSwitchSuggestion {
-            source: Box::new(inner.clone()),
+            source: Box::new(inner),
             ctx: SwitchSuggestionCtx {
                 extra_flags: vec!["--execute=claude".into()],
                 trailing_args: vec!["Check my emails".into()],
             },
         };
         // Errors without switch suggestions should render identically
-        assert_eq!(inner.to_string(), wrapped.to_string());
+        assert_eq!(expected, wrapped.to_string());
     }
 
     fn sample_command_error() -> CommandError {
```

**File**: `src/main.rs` (modified, +2/-2)
```diff
@@ -1338,8 +1338,8 @@ mod tests {
         assert!(out.contains("git fetch failed"));
     }
 
-    /// Codex P2: typed `GitError` wrappers (e.g., `WorktreeRemovalFailed`,
-    /// `PushFailed`) embed a stringified sub-error into their `error`
+    /// Typed `GitError` wrappers (e.g., `PushFailed`) embed a stringified
+    /// sub-error into their `error`
     /// field. With `display_message`, that field carries git's stderr
     /// rather than our `CommandError` summary.
     #[test]
```

**File**: `src/output/handlers.rs` (modified, +2/-2)
```diff
@@ -1916,7 +1916,7 @@ fn handle_detached_removed_worktree_output(
             branch: path_dir_name(ctx.worktree_path).to_string(),
             path: ctx.worktree_path.to_path_buf(),
             remaining_entries: list_remaining_entries(ctx.worktree_path),
-            error: err.display_message(),
+            error: err,
         })?;
         let (files, bytes) = output
             .staged_path
@@ -1995,7 +1995,7 @@ fn handle_named_removed_worktree_foreground(
         branch: branch_name.into(),
         path: ctx.worktree_path.to_path_buf(),
         remaining_entries: list_remaining_entries(ctx.worktree_path),
-        error: err.display_message(),
+        error: err,
     })?;
     let stats = output
         .staged_path
```

**File**: `tests/integration_tests/git_error_display.rs` (modified, +12/-5)
```diff
@@ -42,7 +42,9 @@ fn worktree_errors_render() {
             GitError::WorktreeRemovalFailed {
                 branch: "feature-x".into(),
                 path: PathBuf::from("/tmp/repo.feature-x"),
-                error: "fatal: worktree is dirty\nerror: could not remove worktree".into(),
+                error: anyhow::anyhow!(
+                    "fatal: worktree is dirty\nerror: could not remove worktree"
+                ),
                 remaining_entries: None,
             }
             .render(),
@@ -52,7 +54,9 @@ fn worktree_errors_render() {
             GitError::WorktreeRemovalFailed {
                 branch: "feature-x".into(),
                 path: PathBuf::from("/tmp/repo.feature-x"),
-                error: "error: failed to delete '/tmp/repo.feature-x': Directory not empty".into(),
+                error: anyhow::anyhow!(
+                    "error: failed to delete '/tmp/repo.feature-x': Directory not empty"
+                ),
                 remaining_entries: Some(vec![
                     ".vite/".into(),
                     "node_modules/".into(),
@@ -66,8 +70,9 @@ fn worktree_errors_render() {
             GitError::WorktreeRemovalFailed {
                 branch: "feature-x".into(),
                 path: PathBuf::from("/tmp/repo.feature-x"),
-                error: "error: failed to remove '/tmp/repo.feature-x/target': Permission denied"
-                    .into(),
+                error: anyhow::anyhow!(
+                    "error: failed to remove '/tmp/repo.feature-x/target': Permission denied"
+                ),
                 remaining_entries: Some(vec!["target/".into()]),
             }
             .render(),
@@ -77,7 +82,9 @@ fn worktree_errors_render() {
             GitError::WorktreeRemovalFailed {
                 branch: "feature-x".into(),
                 path: PathBuf::from("/tmp/repo.feature-x"),
-                error: "error: failed to delete '/tmp/repo.feature-x': Directory not empty".into(),
+                error: anyhow::anyhow!(
+                    "error: failed to delete '/tmp/repo.feature-x': Directory not empty"
+                ),
                 remaining_entries: Some((0..15).map(|i| format!("dir-{i:02}/")).collect()),
             }
             .render(),
```

**File**: `tests/integration_tests/remove.rs` (modified, +190/-0)
```diff
@@ -1071,6 +1071,196 @@ fn test_remove_partial_success(mut repo: TestRepo) {
     );
 }
 
+/// Execution failures belong to their target, just like validation failures.
+/// Successful JSON entries must still name the right targets after failures,
+/// including branch-only removal and the current worktree executed last.
+#[rstest]
+#[case::hook_foreground("exit 7", true, "hook_foreground")]
+#[case::hook_background("exit 7", false, "hook_background")]
+#[case::dirty_foreground("printf uncommitted > dirty.txt", true, "dirty_foreground")]
+#[case::dirty_background("printf uncommitted > dirty.txt", false, "dirty_background")]
+fn test_remove_continues_after_execution_failures(
+    mut repo: TestRepo,
+    #[case] failure: &str,
+    #[case] foreground: bool,
+    #[case] snapshot_name: &str,
+) {
+    let hook = format!("case '{{{{ branch }}}}' in failed-*) {failure} ;; esac");
+    repo.write_project_config(&format!("pre-remove = {hook:?}"));
+    repo.commit("Add conditional pre-remove hook");
+    let failed_a = repo.add_worktree("failed-a");
+    let valid = repo.add_worktree("valid");
+    let failed_b = repo.add_worktree("failed-b");
+    let current = repo.add_worktree("current");
+    repo.create_branch("branch-only");
+
+    let mut cmd = repo.wt_command();
+    // Select the logical current worktree without holding its directory open:
+    // Windows cannot remove a live process's physical working directory.
+    cmd.arg("-C").arg(&current).args([
+        "remove",
+        "current",
+        "failed-a",
+        "valid",
+        "failed-b",
+        "branch-only",
+        "--format=json",
+        "--yes",
+    ]);
+    if foreground {
+        cmd.arg("--foreground");
+    }
+    let output = cmd.output().unwrap();
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    assert_eq!(output.status.code(), Some(1), "stderr:\n{stderr}");
+    assert!(
+        failed_a.exists() && failed_b.exists(),
+        "failed targets must survive"
+    );
+    assert!(
+        !valid.exists(),
+        "a later valid worktree must be removed; stderr:\n{stderr}"
+    );
+    crate::common::wait_for_worktree_removed(&current);
+    assert_branch_exists(&repo, "branch-only", false, &stderr);
+
+    let json: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
+    let branches: Vec<_> = json
+        .as_array()
+        .unwrap()
+        .iter()
+        .map(|item| item["branch"].as_str().unwrap())
+        .collect();
+    assert_eq!(branches, ["valid", "branch-only", "current"]);
+    setup_snapshot_settings(&repo).bind(|| {
+        assert_snapshot!(format!("remove_continues_{snapshot_name}"), stderr);
+    });
+}
+
+/// Cancellation stops the batch before its next worktree. The hook signals
+/// its own shell, exercising child signal identity without signaling cargo.
+#[cfg(unix)]
+#[rstest]
+#[case::sigint("INT", 130)]
+#[case::sigterm("TERM", 143)]
+fn test_remove_interrupt_stops_batch(
+    mut repo: TestRepo,
+    #[case] signal: &str,
+    #[case] exit_code: i32,
+) {
+    let hook = format!("kill -{signal} $$");
+    repo.write_project_config(&format!("pre-remove = {hook:?}"));
+    repo.commit("Add interrupting pre-remove hook");
+    let interrupted = repo.add_worktree("interrupted");
+    let later = repo.add_worktree("later");
+    let output = repo
+        .wt_command()
+        .args(["remove", "interrupted", "later", "--foreground", "--yes"])
+        .output()
+        .unwrap();
+    assert_eq!(
+        output.status.code(),
+        Some(exit_code),
+        "stderr:\n{}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+    assert!(
+        interrupted.exists() && later.exists(),
+        "interrupt must stop all removals"
+    );
+}
+
+/// Signals from execution-time Git commands cancel removal just like hook
+/// signals. The hook arms the shim only after validation has succeeded;
+/// everything except the selected Git boundary delegates to real Git.
+#[cfg(unix)]
+#[rstest]
+#[case::status_foreground("status", true, false, "INT", 130)]
+#[case::status_background("status", false, false, "TERM", 143)]
+#[case::delete_foreground("delete", true, false, "TERM", 143)]
+#[case::delete_background("delete", false, false, "INT", 130)]
+#[case::detached_status_foreground("status", true, true, "TERM", 143)]
+fn test_remove_git_interrupt_stops_batch(
+    mut repo: TestRepo,
+    #[case] boundary: &str,
+    #[case] foreground: bool,
+    #[case] detached: bool,
+    #[case] signal: &str,
+    #[case] exit_code: i32,
+) {
+    use std::os::unix::fs::PermissionsExt;
+
+    repo.write_project_config("pre-remove = 'touch \"$WORKTRUNK_TEST_INTERRUPT_ARMED\"'");
+    repo.commit("Add hook arming the Git interrupt shim");
+    let interrupted = repo.add_worktree("interrupted");
+    let later = repo.add_worktree("later");
+    if detached {
+        repo.detach_head_in_worktree("interrupted");
+    }
+    let armed = repo.home_path().join("interrupt-armed");
+    
```

**File**: `tests/snapshots/integration__integration_tests__remove__remove_continues_dirty_background.snap` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+---
+source: tests/integration_tests/remove.rs
+expression: stderr
+---
+[36m◎[39m [36mRunning pre-remove project hook @ [1m_REPO_.failed-a[22m[39m
+[107m [0m [2m[0m[2m[35mcase[0m[2m [0m[2m[32m'failed-a'[0m[2m [0m[2m[35min[0m[2m failed-*) [0m[2m[34mprintf[0m[2m uncommitted [0m[2m[36m>[0m[2m dirty.txt ;; [0m[2m[35mesac[0m
+[0m[36m◎[39m [36mRemoving [1mfailed-a[22m worktree & branch in background (same commit as [1mmain[22m,[39m [2m_[22m[36m)[39m
+[31m✗[39m [31mCannot remove worktree: [1mfailed-a[22m has uncommitted changes[39m
+[107m [0m ?? dirty.txt
+[2m↳[22m [2mCommit or stash changes first, or to lose uncommitted changes, run [4mwt remove --force failed-a[24m[22m
+[36m◎[39m [36mRunning pre-remove project hook @ [1m_REPO_.valid[22m[39m
+[107m [0m [2m[0m[2m[35mcase[0m[2m [0m[2m[32m'valid'[0m[2m [0m[2m[35min[0m[2m failed-*) [0m[2m[34mprintf[0m[2m uncommitted [0m[2m[36m>[0m[2m dirty.txt ;; [0m[2m[35mesac[0m
+[0m[36m◎[39m [36mRemoving [1mvalid[22m worktree & branch in background (same commit as [1mmain[22m,[39m [2m_[22m[36m)[39m
+[36m◎[39m [36mRunning pre-remove project hook @ [1m_REPO_.failed-b[22m[39m
+[107m [0m [2m[0m[2m[35mcase[0m[2m [0m[2m[32m'failed-b'[0m[2m [0m[2m[35min[0m[2m failed-*) [0m[2m[34mprintf[0m[2m uncommitted [0m[2m[36m>[0m[2m dirty.txt ;; [0m[2m[35mesac[0m
+[0m[36m◎[39m [36mRemoving [1mfailed-b[22m worktree & branch in background (same commit as [1mmain[22m,[39m [2m_[22m[36m)[39m
+[31m✗[39m [31mCannot remove worktree: [1mfailed-b[22m has uncommitted changes[39m
+[107m [0m ?? dirty.txt
+[2m↳[22m [2mCommit or stash changes first, or to lose uncommitted changes, run [4mwt remove --force failed-b[24m[22m
+[2m○[22m No worktree found for branch [1mbranch-only[22m
+[32m✓ Removed branch [1mbranch-only[22m (same commit as [1mmain[22m,[39m [2m_[22m[32m)[39m
+[36m◎[39m [36mRunning pre-remove project hook[39m
+[107m [0m [2m[0m[2m[35mcase[0m[2m [0m[2m[32m'current'[0m[2m [0m[2m[35min[0m[2m failed-*) [0m[2m[34mprintf[0m[2m uncommitted [0m[2m[36m>[0m[2m dirty.txt ;; [0m[2m[35mesac[0m
+[0m[36m◎[39m [36mRemoving [1mcurrent[22m worktree & branch in background (same commit as [1mmain[22m,[39m [2m_[22m[36m)[39m
+[33m▲[39m [33mWorktree for [1mmain[22m @ [1m_REPO_[22m, but cannot change directory — shell integration not installed[39m
+[2m↳[22m [2mTo enable automatic cd, run [4mwt config shell install[24m[22m
+[2m↳[22m [2mCurrent directory was removed; to see worktrees, run [4mwt list[24m[22m
```

**File**: `tests/snapshots/integration__integration_tests__remove__remove_continues_dirty_foreground.snap` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+---
+source: tests/integration_tests/remove.rs
+expression: stderr
+---
+[36m◎[39m [36mRunning pre-remove project hook @ [1m_REPO_.failed-a[22m[39m
+[107m [0m [2m[0m[2m[35mcase[0m[2m [0m[2m[32m'failed-a'[0m[2m [0m[2m[35min[0m[2m failed-*) [0m[2m[34mprintf[0m[2m uncommitted [0m[2m[36m>[0m[2m dirty.txt ;; [0m[2m[35mesac[0m
+[0m[36m◎[39m [36mRemoving [1mfailed-a[22m worktree...[39m
+[31m✗[39m [31mFailed to remove worktree for [1mfailed-a[22m @ [1m_REPO_.failed-a[22m[39m
+[107m [0m Cannot remove worktree: failed-a has uncommitted changes
+[2m↳[22m [2mRemaining in directory: [4m.config/, .git, .gitattributes, dirty.txt, file.txt[24m[22m
+[36m◎[39m [36mRunning pre-remove project hook @ [1m_REPO_.valid[22m[39m
+[107m [0m [2m[0m[2m[35mcase[0m[2m [0m[2m[32m'valid'[0m[2m [0m[2m[35min[0m[2m failed-*) [0m[2m[34mprintf[0m[2m uncommitted [0m[2m[36m>[0m[2m dirty.txt ;; [0m[2m[35mesac[0m
+[0m[36m◎[39m [36mRemoving [1mvalid[22m worktree...[39m
+[32m✓[39m [32mRemoved [1mvalid[22m worktree & branch (same commit as [1mmain[22m,[39m [2m_[22m[32m)[39m [90m(4 files · [BYTES] B[39m[90m)[39m
+[36m◎[39m [36mRunning pre-remove project hook @ [1m_REPO_.failed-b[22m[39m
+[107m [0m [2m[0m[2m[35mcase[0m[2m [0m[2m[32m'failed-b'[0m[2m [0m[2m[35min[0m[2m failed-*) [0m[2m[34mprintf[0m[2m uncommitted [0m[2m[36m>[0m[2m dirty.txt ;; [0m[2m[35mesac[0m
+[0m[36m◎[39m [36mRemoving [1mfailed-b[22m worktree...[39m
+[31m✗[39m [31mFailed to remove worktree for [1mfailed-b[22m @ [1m_REPO_.failed-b[22m[39m
+[107m [0m Cannot remove worktree: failed-b has uncommitted changes
+[2m↳[22m [2mRemaining in directory: [4m.config/, .git, .gitattributes, dirty.txt, file.txt[24m[22m
+[2m○[22m No worktree found for branch [1mbranch-only[22m
+[32m✓ Removed branch [1mbranch-only[22m (same commit as [1mmain[22m,[39m [2m_[22m[32m)[39m
+[36m◎[39m [36mRunning pre-remove project hook[39m
+[107m [0m [2m[0m[2m[35mcase[0m[2m [0m[2m[32m'current'[0m[2m [0m[2m[35min[0m[2m failed-*) [0m[2m[34mprintf[0m[2m uncommitted [0m[2m[36m>[0m[2m dirty.txt ;; [0m[2m[35mesac[0m
+[0m[36m◎[39m [36mRemoving [1mcurrent[22m worktree...[39m
+[32m✓[39m [32mRemoved [1mcurrent[22m worktree & branch (same commit as [1mmain[22m,[39m [2m_[22m[32m)[39m [90m(4 files · [BYTES] B[39m[90m)[39m
+[33m▲[39m [33mWorktree for [1mmain[22m @ [1m_REPO_[22m, but cannot change directory — shell integration not installed[39m
+[2m↳[22m [2mTo enable automatic cd, run [4mwt config shell install[24m[22m
+[2m↳[22m [2mCurrent directory was removed; to see worktrees, run [4mwt list[24m[22m
```

---

### Incident Patch 4: `f4f1bbde` (2026-10-03)
**Commit Message**: fix(prune): serialize safe deletions and run hooks concurrently (#4337)

Concurrent prune deletions can exhaust Git's packed-refs lock timeout.
An unchanged branch was then reported as "moved during deletion", and
removal could absorb the Git failure while reporting success. This
change serializes safe ref deletions within the repository, reports
movement only when the surviving SHA changed, and propagates other
failures after arranging cleanup and teardown hooks. A missing snapshot
SHA fails closed.

Each safe deletion uses one `git update-ref -d` with the original
expected SHA. The repository mutex covers that mutation and its failure
classification; interruptions cancel waiting deletions before they can
mutate anything. Integration and checkout reads remain outside the
mutex. Checkout protection remains best effort; Git's atomic
expected-SHA comparison protects concurrent commits to the candidate
branch. Worktree registry coordination independently keeps enumeration
and teardown from overlapping.

Prune runs pre-remove hooks concurrently across worktrees. Each
worktree's hook pipeline finishes before fresh ownership, lock, and
cleanliness checks. Hooks coordinate shared writes t

**File**: `docs/src/content/docs/step.md` (modified, +2/-0)
```diff
@@ -819,6 +819,8 @@ In `wt list`, candidates show `_` (same commit) or `⊂` (content integrated). R
 
 Locked worktrees, worktrees with uncommitted changes, and the main worktree are always skipped. The current worktree is removed last, triggering cd to the primary worktree. Pre-remove and post-remove hooks run for each removal; a candidate whose hooks include an unapproved project command is skipped with `(approval required)` (pre-approve with `wt config approvals add`, or pass `--yes`).
 
+Removals and their hooks may run concurrently across worktrees. Each worktree's pre-remove hooks finish before its removal begins. Hooks must coordinate writes to shared resources and avoid writing into other worktrees being pruned. On Windows, rewriting shared Git configuration from a hook can cause concurrent Git reads to fail.
+
 ### Min-age guard
 
 Candidates younger than `--min-age` (default: 1 day) are skipped. A worktree's age comes from its creation time. A branch with no worktree takes its age from its oldest reflog entry, or, when it has none (common in bare repositories), from when git last wrote its ref. Operations such as `git gc` or deleting a branch can rewrite many refs at once, so afterwards older branches without a reflog are skipped until `--min-age` has passed. This prevents removing a worktree just created from the default branch: it looks "merged" because its branch points at the same commit.
```

**File**: `plugins/worktrunk/skills/worktrunk/reference/step.md` (modified, +2/-0)
```diff
@@ -807,6 +807,8 @@ In `wt list`, candidates show `_` (same commit) or `⊂` (content integrated). R
 
 Locked worktrees, worktrees with uncommitted changes, and the main worktree are always skipped. The current worktree is removed last, triggering cd to the primary worktree. Pre-remove and post-remove hooks run for each removal; a candidate whose hooks include an unapproved project command is skipped with `(approval required)` (pre-approve with `wt config approvals add`, or pass `--yes`).
 
+Removals and their hooks may run concurrently across worktrees. Each worktree's pre-remove hooks finish before its removal begins. Hooks must coordinate writes to shared resources and avoid writing into other worktrees being pruned. On Windows, rewriting shared Git configuration from a hook can cause concurrent Git reads to fail.
+
 ### Min-age guard
 
 Candidates younger than `--min-age` (default: 1 day) are skipped. A worktree's age comes from its creation time. A branch with no worktree takes its age from its oldest reflog entry, or, when it has none (common in bare repositories), from when git last wrote its ref. Operations such as `git gc` or deleting a branch can rewrite many refs at once, so afterwards older branches without a reflog are skipped until `--min-age` has passed. This prevents removing a worktree just created from the default branch: it looks "merged" because its branch points at the same commit.
```

**File**: `skills/worktrunk/reference/step.md` (modified, +2/-0)
```diff
@@ -807,6 +807,8 @@ In `wt list`, candidates show `_` (same commit) or `⊂` (content integrated). R
 
 Locked worktrees, worktrees with uncommitted changes, and the main worktree are always skipped. The current worktree is removed last, triggering cd to the primary worktree. Pre-remove and post-remove hooks run for each removal; a candidate whose hooks include an unapproved project command is skipped with `(approval required)` (pre-approve with `wt config approvals add`, or pass `--yes`).
 
+Removals and their hooks may run concurrently across worktrees. Each worktree's pre-remove hooks finish before its removal begins. Hooks must coordinate writes to shared resources and avoid writing into other worktrees being pruned. On Windows, rewriting shared Git configuration from a hook can cause concurrent Git reads to fail.
+
 ### Min-age guard
 
 Candidates younger than `--min-age` (default: 1 day) are skipped. A worktree's age comes from its creation time. A branch with no worktree takes its age from its oldest reflog entry, or, when it has none (common in bare repositories), from when git last wrote its ref. Operations such as `git gc` or deleting a branch can rewrite many refs at once, so afterwards older branches without a reflog are skipped until `--min-age` has passed. This prevents removing a worktree just created from the default branch: it looks "merged" because its branch points at the same commit.
```

**File**: `src/cli/step.rs` (modified, +2/-0)
```diff
@@ -621,6 +621,8 @@ In `wt list`, candidates show `_` (same commit) or `⊂` (content integrated). R
 
 Locked worktrees, worktrees with uncommitted changes, and the main worktree are always skipped. The current worktree is removed last, triggering cd to the primary worktree. Pre-remove and post-remove hooks run for each removal; a candidate whose hooks include an unapproved project command is skipped with `(approval required)` (pre-approve with `wt config approvals add`, or pass `--yes`).
 
+Removals and their hooks may run concurrently across worktrees. Each worktree's pre-remove hooks finish before its removal begins. Hooks must coordinate writes to shared resources and avoid writing into other worktrees being pruned. On Windows, rewriting shared Git configuration from a hook can cause concurrent Git reads to fail.
+
 ## Min-age guard
 
 Candidates younger than `--min-age` (default: 1 day) are skipped. A worktree's age comes from its creation time. A branch with no worktree takes its age from its oldest reflog entry, or, when it has none (common in bare repositories), from when git last wrote its ref. Operations such as `git gc` or deleting a branch can rewrite many refs at once, so afterwards older branches without a reflog are skipped until `--min-age` has passed. This prevents removing a worktree just created from the default branch: it looks "merged" because its branch points at the same commit.
```

**File**: `src/commands/process.rs` (modified, +21/-134)
```diff
@@ -20,6 +20,8 @@ use crate::commands::hook_filter::HookSource;
 pub enum InternalOp {
     /// Background worktree removal (`wt remove` in background mode)
     Remove,
+    /// Delayed cleanup of the removed current worktree's empty PWD placeholder.
+    RemovePlaceholder,
     /// Background cleanup of stale entries in `.git/wt/trash/`
     TrashSweep,
 }
@@ -590,139 +592,28 @@ fn parse_trash_entry_timestamp(name: &str) -> Option<u64> {
     suffix.parse::<u64>().ok()
 }
 
-/// Build shell command for background removal of a staged (renamed) worktree.
+/// Remove an already-staged worktree's trash independently of branch deletion.
 ///
-/// This is used after the worktree has been renamed to a staging path,
-/// git metadata has been pruned, and the branch has been deleted synchronously.
-///
-/// When `changed_directory` is true — the shell is cd-ing away from the removed
-/// worktree — a placeholder directory is created at `original_path` so the shell's
-/// working directory remains valid until the wrapper has processed the `cd`
-/// directive. Without this, shells that validate `$env.PWD` (notably Nushell)
-/// emit errors between binary exit and the `cd`. The background command then
-/// waits for the shell wrapper before cleaning up the placeholder.
-///
-/// When `changed_directory` is false, no placeholder exists, so the background
-/// command just removes the staged directory directly.
-///
-/// # Design alternatives evaluated (2026-04)
-///
-/// Two weaknesses in the current design prompted an investigation:
-///
-/// 1. **Silent `rmdir` failure.** If anything lands in the placeholder
-///    during the 1-second sleep (e.g., macOS `.DS_Store`, a filesystem
-///    race, an editor saving against the old path), `rmdir` fails silently
-///    because of `2>/dev/null`, and the empty directory at `original_path`
-///    lingers forever. This was the root cause of an intermittent
-///    `test_bare_repo_merge_workflow` flake.
-/// 2. **"Create then delete" placeholder lifecycle.** wt creates an empty
-///    directory that the background shell removes one second later; its
-///    only purpose is keeping `$PWD` valid for shells (notably Nushell)
-///    that stat it between wt's exit and the wrapper's `cd`.
-///
-/// Two alternatives were prototyped and reviewed; neither was adopted.
-///
-/// ## Option A — Fully deferred cleanup with a pending-removal marker
-///
-/// Sync phase shrinks to: write a `PendingRemoval` marker under
-/// `<git-common-dir>/wt/pending/`, spawn detached `wt internal
-/// finish-removal <marker>`, exit. The detached process sleeps 1 second,
-/// then does rename + prune + `branch -D` + `rm -rf` + marker delete —
-/// the work that today happens synchronously. Concurrent operations
-/// (e.g., `wt switch --create <same-branch>` within the 1-second window)
-/// check for matching markers and force-finish the cleanup inline via a
-/// `finish_blocking_for` helper. Crashed cleanup processes are reclaimed
-/// by extending the existing `sweep_stale_trash` path with a
-/// `sweep_stale_pending` variant.
-///
-/// Benefits: eliminates the placeholder lifecycle entirely (the original
-/// path never disappears during wt's execution, so `$PWD` stays valid
-/// "for free"); no `rmdir` silent-failure mode; marker-based
-/// coordination on the recreate race.
-///
-/// Drawbacks surfaced by Codex review:
-///
-/// - **Data safety (P1).** The clean-check runs sync but the rename
-///   runs ~1 second later. Writes to existing files during that window
-///   (editor save, background build) are silently renamed into trash
-///   and `rm -rf`'d. Today's sync rename keeps that window
-///   microsecond-wide. Mitigation: revalidate cleanliness in the
-///   finisher and bail on dirty — but that turns "remove" into a silent
-///   no-op visible only in log files.
-/// - **Hook timing (P2).** `spawn_hooks_after_remove` runs right after
-///   the sync phase returns. In the deferred design, `post-remove`
-///   hooks fire while `git worktree list` still reports the worktree
-///   and the branch still exists, contrary to the hook's documented
-///   contract. Fix: move hook invocation into the finisher.
-/// - **Retained-branch coordination (P1).** The marker's `branch` field
-///   must be recorded independently of the `delete_branch` flag, or
-///   `finish_blocking_for(Some("feature"), ..)` misses markers whose
-///   branch was retained (`--no-delete-branch`, unmerged safe-delete).
-/// - **Complexity cost.** New module (`src/commands/pending.rs`), new
-///   hidden CLI subcommand (`wt internal finish-removal`), sweep
-///   recovery, coordination calls in `plan_switch`,
-///   `validate_worktree_creation`, and `handle_remove_command`. ~450
-///   lines of new code plus tests.
-///
-/// ## Option B — Sync rename + `rm -rf` instead of `rmdir`
-///
-/// Keep the current sync phase (rename + prune + `branch -D` + create
-/// placeholder), add the pending-removal marker + coordination hooks,
-
```

**File**: `src/commands/repository_ext.rs` (modified, +1/-1)
```diff
@@ -569,7 +569,7 @@ pub(crate) fn compute_integration_reason(
 ///
 /// A branch reaches two worktrees only through `git worktree add --force`,
 /// which worktrunk never runs itself. Once it has, the ref is live in both, and
-/// worktrunk deletes branches with `git update-ref -d` — git's compare-and-swap
+/// worktrunk deletes branches with `git update-ref` — git's compare-and-swap
 /// primitive, which unlike `git branch -d` does not refuse a ref that is
 /// checked out somewhere. Deleting it leaves the other checkout at a null OID
 /// with an unresolvable `HEAD`, so every removal that could delete a branch
```

**File**: `src/commands/step/prune.rs` (modified, +48/-86)
```diff
@@ -3,10 +3,11 @@
 //! Live-path concurrency: candidate checks fan out on the rayon pool and
 //! stream results to the main thread, which queues per-candidate jobs
 //! (removals and skip lines) in scan-completion order onto a worker pool
-//! sized like rayon's ([`RemovalJob`]). Checks and hook-free removals hold
-//! the read side of [`RemovalContext::check_lock`] and run concurrently; the
-//! exceptional removals serialize on the write side
-//! ([`removal_needs_write`]). Repository operations coordinate the narrower
+//! sized like rayon's ([`RemovalJob`]). Checks, background removals, and
+//! their pre-remove hooks run concurrently. The output lock excludes other
+//! removals and skip messages only while foreground/current removals own
+//! terminal output ([`removal_needs_write`]).
+//! Repository operations coordinate the narrower
 //! Git worktree-registry reads and teardowns themselves, so status checks,
 //! fsmonitor shutdown, and trash renames still overlap. One FIFO queue carrying
 //! both removals and skip lines means a single worker (`RAYON_NUM_THREADS=1`)
@@ -233,38 +234,16 @@ struct RemovalContext<'a> {
     repo: &'a Repository,
     foreground: bool,
     hook_plan: &'a ApprovedHookPlan,
-    /// Coordinates the parallel workers (scan checks and removals, both on
-    /// the read side) against the few removals that need exclusivity (write
-    /// side — see [`removal_needs_write`]).
-    ///
-    /// The lock exists for the Windows `.git/config` race: git rewrites
-    /// config via lockfile + atomic rename, and a concurrent reader's plain
-    /// `fopen` fails on the rename (#2801). Historically every removal held
-    /// the write side because branch deletion was `git branch -D`, which
-    /// rewrites `.git/config` (it drops the `[branch "<name>"]` section —
-    /// even when none exists). The removal chain has since moved to the CAS
-    /// `git update-ref -d`, and neither it nor `git worktree remove` (both the
-    /// scoped metadata prune and the rename-failure fallback) touches
-    /// `.git/config`, so hook-free removals never rewrite it and can run
-    /// concurrently. Verified empirically: with `.git/config` made immutable,
-    /// only `git branch -D` reports `could not write config file`.
-    /// (`git branch -D` remains reachable only via `delete_branch_if_safe`'s
-    /// force arm, which prune never uses, and its snapshot-miss arm,
-    /// unreachable here because the chain captures the snapshot immediately
-    /// before consulting it.)
-    check_lock: &'a RwLock<()>,
+    /// Keeps background removal output and skip messages out of a foreground
+    /// spinner's terminal window. Shared guards do not serialize background
+    /// removals or their hooks. Repository mutation coordination belongs to
+    /// the registry accessors and the safe-ref deletion coordinator.
+    output_lock: &'a RwLock<()>,
 }
 
-/// Which removals must hold the write side of [`RemovalContext::check_lock`]
+/// Which removals must hold the write side of [`RemovalContext::output_lock`]
 /// instead of joining the parallel (read-side) fan-out:
 ///
-/// - **Hook-bearing worktree removals** — the `pre-remove` body runs
-///   foreground here, and hook bodies are arbitrary commands (`git branch
-///   -D`, `git config`, anything), so it keeps the exclusion every removal
-///   had before removals parallelized; the write side also keeps the hook
-///   stream and announce lines from interleaving with other candidates'
-///   output. (`post-remove`/`post-switch` pipelines spawn detached and
-///   always ran outside the lock.)
 /// - **`--foreground` worktree removals** — the foreground path runs a TTY
 ///   trash-cleanup spinner, and concurrent spinners would fight over the
 ///   cursor.
@@ -276,22 +255,17 @@ struct RemovalContext<'a> {
 /// a hook body nor a spinner, whatever selected it. `StaleDetached` never
 /// reaches here — [`try_remove`] prunes its entry and returns.
 ///
-/// Everything else fans out on the read side. The Git worktree-registry calls
-/// inside those removals take their own repository-scoped lock; see
-/// [`prune_worktree_entry`](Repository::prune_worktree_entry).
+/// Everything else fans out on the read side, including pre-remove hooks.
+/// The Git worktree-registry calls inside those removals take their own
+/// repository-scoped lock; see [`prune_worktree_entry`](Repository::prune_worktree_entry).
+/// Safe branch deletions serialize ref mutation independently of terminal output.
 fn removal_needs_write(kind: CandidateKind, plan: &RemovalPlan, ctx: &RemovalContext<'_>) -> bool {
     if matches!(kind, CandidateKind::Current) {
         return true;
     }
     match plan {
-        // The worktree whose `pre-remove` body and trash-cleanup spinner this
-        // removal runs.
-        RemovalPlan::Worktree { worktree_path, .. } => {
-            ctx.foreground
-                || ctx
-                    .hook_plan
-                    .has_hoo
```

**File**: `src/git/mod.rs` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ mod parse;
 #[cfg(unix)]
 pub mod reap;
 pub mod recover;
+mod ref_deletion;
 pub mod remote_ref;
 pub mod remove;
 mod repository;
```

---

### Incident Patch 5: `9669d4a7` (2026-10-02)
**Commit Message**: test(shell): isolate fish startup configuration in PTY fixtures (#4353)

Fish PTY tests currently load startup configuration, which can prepend
PATH and replace a fixture's stub command with a host command. Launch
fish with `--no-config`, matching the existing non-PTY shell helper, and
keep the error-forwarding fixture's HOME and XDG_CONFIG_HOME inside its
temporary directory.

The regression fixture installs a fish startup config that would select
a fake cargo exiting with status 23; the expected CLI error must still
come from the intended cargo stub. This changes test isolation only.

Validation: the full project pre-merge gate passed: 5,021 tests, one
skipped, plus formatting, lint, documentation and doctests. Real fish
PTY tests exercise the startup-config regression.

> _This was written by Codex on behalf of max-sixty_

**File**: `tests/integration_tests/shell_wrapper.rs` (modified, +35/-1)
```diff
@@ -444,8 +444,12 @@ fn exec_in_pty_shell(
             cmd.arg("-c");
             cmd.arg(script);
         }
+        "fish" => {
+            cmd.arg("--no-config");
+            cmd.arg("-c");
+            cmd.arg(script);
+        }
         _ => {
-            // fish and other shells
             cmd.arg("-c");
             cmd.arg(script);
         }
@@ -1782,6 +1786,28 @@ approved-commands = ["echo 'fish background task'"]
             env::var("PATH").unwrap_or_default()
         );
 
+        // Fish startup configuration can prepend PATH and displace the cargo
+        // stub. Shell tests must bypass it, just as bash bypasses ~/.bashrc.
+        let startup_bin = repo.home_path().join("startup-bin");
+        fs::create_dir_all(&startup_bin).unwrap();
+        let startup_cargo = startup_bin.join("cargo");
+        fs::write(
+            &startup_cargo,
+            "#!/bin/sh\necho 'unexpected startup cargo' >&2\nexit 23\n",
+        )
+        .unwrap();
+        fs::set_permissions(&startup_cargo, fs::Permissions::from_mode(0o755)).unwrap();
+        let fish_config = repo.home_path().join(".config/fish");
+        fs::create_dir_all(&fish_config).unwrap();
+        fs::write(
+            fish_config.join("config.fish"),
+            format!(
+                "fish_add_path {}\n",
+                shell_quote(&startup_bin.to_string_lossy())
+            ),
+        )
+        .unwrap();
+
         // Get the worktrunk source directory (where this test is running from)
         // This is the directory that contains Cargo.toml with the workspace
         let worktrunk_source = canonicalize(&env::current_dir().unwrap()).unwrap();
@@ -1803,7 +1829,15 @@ approved-commands = ["echo 'fish background task'"]
 
         let config_path = repo.test_config_path().to_string_lossy().to_string();
         let approvals_path = repo.test_approvals_path().to_string_lossy().to_string();
+        let fixture_home = repo.home_path().to_string_lossy().to_string();
+        let xdg_config = repo
+            .home_path()
+            .join(".config")
+            .to_string_lossy()
+            .to_string();
         let env_vars: Vec<(&str, &str)> = vec![
+            ("HOME", &fixture_home),
+            ("XDG_CONFIG_HOME", &xdg_config),
             ("PATH", &stub_path),
             ("CLICOLOR_FORCE", "1"),
             ("WORKTRUNK_CONFIG_PATH", &config_path),
```

---

### Incident Patch 6: `85e685e3` (2026-10-01)
**Commit Message**: fix(list): align JSON status symbols with terminal output (#4335)

`wt list` JSON appended worktree state after the main and upstream
symbols, while the rendered Status column places it first. Both JSON
schemas now use the status model’s shared gate ordering and operation
priority, so a row with symbols `!⚐↑⇡*` serializes in that same order.

Raw JSON retains its existing rename/delete glyphs and marker text.
Regression coverage compares both schemas with a real rendered row and
checks unresolved gates, operation priority, and the raw working-tree
glyphs. The shared snapshot normalizer also accounts for Git 2.56’s
ambiguous remote-branch diagnostic.

Validation: the full project pre-merge gate passed: 5,021 tests, one
skipped, plus lint, formatting, documentation, doctests, and lockfile
checks. Independent review found no remaining issues.

> _This was written by Codex on behalf of max-sixty_

---------

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/commands/list/json_output.rs` (modified, +2/-125)
```diff
@@ -111,7 +111,7 @@ pub struct JsonItem {
     #[serde(skip_serializing_if = "Option::is_none")]
     pub statusline: Option<String>,
 
-    /// Raw status symbols without ANSI colors (e.g., "+! ✖ ↑")
+    /// Raw status symbols without ANSI colors (e.g., `"+!⚐↑"`)
     #[serde(skip_serializing_if = "Option::is_none")]
     pub symbols: Option<String>,
 
@@ -391,7 +391,7 @@ impl JsonItem {
 
         // Statusline and symbols (raw, without ANSI codes)
         let statusline = item.statusline.clone();
-        let symbols = Some(format_raw_symbols(&item.status_symbols)).filter(|s| !s.is_empty());
+        let symbols = Some(item.status_symbols.format_raw()).filter(|s| !s.is_empty());
         let marker = item.user_marker.clone().flatten();
 
         // Per-branch vars data (pre-fetched, moved out to avoid cloning)
@@ -511,62 +511,6 @@ impl JsonCi {
     }
 }
 
-/// Format status symbols as raw characters (no ANSI codes).
-///
-/// Unresolved gates (`None` fields) contribute nothing — their symbols are
-/// simply absent from the output string, not replaced by a placeholder.
-/// This matches the per-symbol atomic model: machine consumers see only the
-/// symbols that have been computed so far.
-///
-/// Shared with `json_v2` (the `display.symbols` field).
-pub(crate) fn format_raw_symbols(symbols: &super::model::StatusSymbols) -> String {
-    let mut result = String::new();
-
-    // Working tree symbols (gate 1)
-    if let Some(wt) = symbols.working_tree {
-        result.push_str(&wt.to_symbols());
-    }
-
-    // Main state (gate 3) — merged column: ^_⊂✗↕↑↓
-    if let Some(ms) = symbols.main_state {
-        let s = ms.to_string();
-        if !s.is_empty() {
-            result.push_str(&s);
-        }
-    }
-
-    // Upstream divergence (gate 4)
-    if let Some(div) = symbols.upstream_divergence {
-        let s = div.symbol();
-        if !s.is_empty() {
-            result.push_str(s);
-        }
-    }
-
-    // Worktree state (gate 2) — operations (✘↻) take priority over
-    // location (/⚐⊟⊞). Gate 2 is "operation_state is Some"; the metadata
-    // worktree_state is filled synchronously and always Some by the time
-    // the operation family is known.
-    if let Some(op) = symbols.operation_state {
-        let s = op.to_string();
-        if !s.is_empty() {
-            result.push_str(&s);
-        } else if let Some(wt_state) = symbols.worktree_state {
-            let s = wt_state.to_string();
-            if !s.is_empty() {
-                result.push_str(&s);
-            }
-        }
-    }
-
-    // User marker (gate 5)
-    if let Some(Some(ref marker)) = symbols.user_marker {
-        result.push_str(marker);
-    }
-
-    result
-}
-
 /// Convert a list of ListItems to JSON output
 ///
 /// Reads all vars from the bulk config snapshot (no subprocess, and —
@@ -601,7 +545,6 @@ pub fn to_json_items(
 mod tests {
     use insta::assert_snapshot;
     use worktrunk::git::GitRepoProvider;
-    use worktrunk::git::InProgressOperation;
 
     use super::*;
     use crate::commands::list::ci_status::{CiStatus, PrRef};
@@ -920,72 +863,6 @@ mod tests {
         assert_eq!(reason, Some("in use".to_string()));
     }
 
-    // ============================================================================
-    // format_raw_symbols Tests
-    // ============================================================================
-
-    #[test]
-    fn test_format_raw_symbols_empty() {
-        let symbols = StatusSymbols::default();
-        assert!(format_raw_symbols(&symbols).is_empty());
-    }
-
-    #[test]
-    fn test_format_raw_symbols_each_category() {
-        let working_tree = format_raw_symbols(&StatusSymbols {
-            working_tree: Some(WorkingTreeStatus::new(true, true, true, false, false)),
-            ..Default::default()
-        });
-        assert_snapshot!(working_tree, @"+!?");
-
-        let main_state = format_raw_symbols(&StatusSymbols {
-            main_state: Some(MainState::Ahead),
-            ..Default::default()
-        });
-        assert_snapshot!(main_state, @"↑");
-
-        let upstream = format_raw_symbols(&StatusSymbols {
-            upstream_divergence: Some(Divergence::Behind),
-            ..Default::default()
-        });
-        assert_snapshot!(upstream, @"⇣");
-
-        // Operation state takes priority over worktree state
-        let operation = format_raw_symbols(&StatusSymbols {
-            operation_state: Some(OperationState::InProgress(InProgressOperation::Rebase)),
-            ..Default::default()
-        });
-        assert_snapshot!(operation, @"↻");
-
-        // Worktree metadata renders only once the operation-family gate
-        // has resolved to "no operation" — otherwise we can't rule out
-        // ✘↻ taking priority. Callers that want just the metadata
-        // symbol must set both `operation_state` and `worktree_state`.
-        let worktree = format_raw_symbols(&StatusSymbols {
-            operation_state: Som
```

**File**: `src/commands/list/json_v2.rs` (modified, +2/-2)
```diff
@@ -38,7 +38,7 @@ use worktrunk::git::{
 
 use super::ci_status::{CiSource, CiStatus, PrStatus, ReviewState};
 use super::custom_columns::ResolvedCustomColumn;
-use super::json_output::{JsonDiff, format_raw_symbols};
+use super::json_output::JsonDiff;
 use super::model::{BranchScope, Collected, ItemKind, ListItem, MainState, WorktreeData};
 
 /// Tri-state field encoding the absence rule (see module docs).
@@ -704,7 +704,7 @@ impl JsonItemV2 {
                 .status_symbols
                 .main_state
                 .and_then(JsonMainState::from_main_state),
-            symbols: Some(format_raw_symbols(&item.status_symbols)).filter(|s| !s.is_empty()),
+            symbols: Some(item.status_symbols.format_raw()).filter(|s| !s.is_empty()),
             statusline: item.statusline.clone(),
             columns,
         };
```

**File**: `src/commands/list/model/status_symbols.rs` (modified, +188/-25)
```diff
@@ -342,7 +342,7 @@ impl WorkingTreeStatus {
 
     /// Format as display string for JSON serialization and raw output (e.g., "+!?").
     ///
-    /// For styled terminal rendering, use `StatusSymbols::styled_symbols()` instead.
+    /// For styled terminal rendering, use `StatusSymbols::render_with_mask()` instead.
     pub fn to_symbols(self) -> String {
         let mut s = String::with_capacity(5);
         if self.staged {
@@ -459,7 +459,7 @@ impl StatusSymbols {
 
         let mut result = String::with_capacity(64);
 
-        for (pos, slot) in self.styled_symbols() {
+        for (pos, slot) in self.symbols(SymbolFormat::Styled) {
             let allocated_width = mask.width(pos);
 
             match slot {
@@ -495,7 +495,7 @@ impl StatusSymbols {
     ///
     /// Uses the same styled symbols as `render_with_mask()`, just without padding.
     pub fn format_compact(&self) -> String {
-        self.styled_symbols()
+        self.symbols(SymbolFormat::Styled)
             .into_iter()
             .filter_map(|(_, slot)| match slot {
                 SlotState::Visible(s) => Some(s),
@@ -507,7 +507,21 @@ impl StatusSymbols {
             .collect()
     }
 
-    /// Build styled symbols array with position indices.
+    /// Raw JSON symbols in the same gate order as terminal output.
+    ///
+    /// Unresolved gates are omitted. Working-tree rename/delete glyphs and
+    /// user marker text retain their raw JSON representation.
+    pub(crate) fn format_raw(&self) -> String {
+        self.symbols(SymbolFormat::Raw)
+            .into_iter()
+            .filter_map(|(_, slot)| match slot {
+                SlotState::Visible(s) => Some(s),
+                SlotState::Loading | SlotState::Empty => None,
+            })
+            .collect()
+    }
+
+    /// Build symbols in Status-column order with shared gate selection.
     ///
     /// Returns one [`SlotState`] per position. The renderer uses this to
     /// emit three kinds of cell content: `Loading` slots are rendered as the
@@ -522,14 +536,20 @@ impl StatusSymbols {
     /// - Red: Conflicts (blocking problems)
     /// - Yellow: Git operations, would_conflict, locked/prunable (states needing attention)
     /// - Dimmed: Main state symbols, divergence arrows, branch indicator (informational)
-    pub(crate) fn styled_symbols(&self) -> [(usize, SlotState); 7] {
+    fn symbols(&self, format: SymbolFormat) -> [(usize, SlotState); 7] {
         use color_print::cformat;
 
         // Gate 1 — working tree flags (positions 0-2). One logical decision,
         // so while loading we emit a single `·` at the lead position and
         // blank-pad the other two — keeps the gate's visual weight equal to
-        // the single-position gates 2-5.
+        // the single-position gates 2-5. Raw output has no alignment, so
+        // the lead slot contains all working-tree glyphs, including »✘.
         let (staged, modified, untracked) = match self.working_tree {
+            Some(wt) if matches!(format, SymbolFormat::Raw) => (
+                SlotState::from_content(wt.to_symbols()),
+                SlotState::Empty,
+                SlotState::Empty,
+            ),
             Some(wt) => {
                 let flag = |has: bool, sym: char| -> SlotState {
                     if has {
@@ -549,19 +569,19 @@ impl StatusSymbols {
 
         // Gate 3 — main state (position 4).
         let main_state_slot = match self.main_state {
-            Some(ms) => match ms.styled() {
-                Some(s) => SlotState::Visible(s),
-                None => SlotState::Empty,
-            },
+            Some(ms) => SlotState::from_content(match format {
+                SymbolFormat::Raw => ms.to_string(),
+                SymbolFormat::Styled => ms.styled().unwrap_or_default(),
+            }),
             None => SlotState::Loading,
         };
 
         // Gate 4 — upstream divergence (position 5).
         let upstream_slot = match self.upstream_divergence {
-            Some(d) => match d.styled() {
-                Some(s) => SlotState::Visible(s),
-                None => SlotState::Empty,
-            },
+            Some(d) => SlotState::from_content(match format {
+                SymbolFormat::Raw => d.symbol().to_string(),
+                SymbolFormat::Styled => d.styled().unwrap_or_default(),
+            }),
             None => SlotState::Loading,
         };
 
@@ -575,17 +595,21 @@ impl StatusSymbols {
         // it's always `Some` by the time `operation_state` resolves).
         let worktree_slot = match self.operation_state {
             None => SlotState::Loading,
-            Some(op) if op != OperationState::None => {
-                SlotState::Visible(op.styled().unwrap_or_default())
-            }
+            Some(op) if op != OperationState::None => SlotState::Visible(match format {
+                SymbolFormat::Raw => op.to_string(),
+                SymbolFormat::Styled => op.styled().unwrap_or_default(),
+       
```

**File**: `tests/common/mod.rs` (modified, +7/-0)
```diff
@@ -1084,6 +1084,13 @@ fn setup_snapshot_settings_for_paths_with_home(
         "$1 # $2",
     );
 
+    // Git 2.56 names ambiguous remote-tracking branches; older Git reports
+    // the same failed worktree-add lookup as an invalid reference.
+    settings.add_filter(
+        r"fatal: '([^'\r\n]+)' matched multiple \(\d+\) remote tracking branches",
+        "fatal: invalid reference: $1",
+    );
+
     // Normalize OS-specific error messages in gutter output
     // Ubuntu may produce "Broken pipe (os error 32)" instead of the expected error
     // when capturing stderr from shell commands due to timing/buffering differences
```

**File**: `tests/integration_tests/list.rs` (modified, +79/-0)
```diff
@@ -1178,6 +1178,85 @@ fn test_list_json_with_user_marker(mut repo: TestRepo) {
     });
 }
 
+/// Extract the populated Status cell from the all-gates fixture below.
+/// Its ASCII marker leaves the column padding as runs of two or more spaces.
+fn status_cell(table: &str, branch: &str) -> String {
+    let fields = table
+        .lines()
+        .map(|line| {
+            line.split("  ")
+                .map(str::trim)
+                .filter(|field| !field.is_empty())
+                .collect::<Vec<_>>()
+        })
+        .find(|fields| fields.first().is_some_and(|f| f.ends_with(branch)))
+        .unwrap_or_else(|| panic!("no row for {branch:?}:\n{table}"));
+    fields[1].chars().filter(|c| !c.is_whitespace()).collect()
+}
+
+/// Both JSON schemas follow the rendered Status column's gate order.
+/// The fixture populates every gate: an off-template worktree path, commits
+/// missing from main and upstream, an uncommitted edit, and an ASCII marker.
+#[rstest]
+fn test_list_json_symbols_follow_status_column(#[from(repo_with_remote)] mut repo: TestRepo) {
+    use ansi_str::AnsiStr;
+
+    let off_template = repo
+        .root_path()
+        .parent()
+        .expect("repo has a parent directory")
+        .join("off-template");
+    let feature = repo.add_worktree_at_path("feature", &off_template);
+    repo.commit_in_worktree(&feature, "feature.txt", "one\n", "Add feature file");
+    repo.run_git_in(&feature, &["push", "-u", "origin", "feature"]);
+    repo.commit_in_worktree(&feature, "second.txt", "two\n", "Add second file");
+    std::fs::write(feature.join("feature.txt"), "edited\n").unwrap();
+    repo.set_marker("feature", "*");
+
+    let run = |args: &[&str]| {
+        let output = repo
+            .wt_command()
+            .args(args)
+            .current_dir(repo.root_path())
+            .output()
+            .unwrap();
+        assert!(output.status.success(), "wt {args:?} should succeed");
+        output.stdout
+    };
+
+    repo.write_test_config("[list]\njson-schema = 2\n");
+    let table = String::from_utf8_lossy(&run(&["list"]))
+        .ansi_strip()
+        .into_owned();
+    let rendered = status_cell(&table, "feature");
+    assert_eq!(rendered, "!⚐↑⇡*", "every gate populated:\n{table}");
+
+    let envelope: serde_json::Value =
+        serde_json::from_slice(&run(&["list", "--format=json"])).unwrap();
+    let schema_2 = envelope["items"]
+        .as_array()
+        .expect("items array")
+        .iter()
+        .find(|item| item["branch"] == "feature")
+        .expect("feature row")["display"]["symbols"]
+        .as_str()
+        .expect("symbols")
+        .to_string();
+    assert_eq!(schema_2, rendered, "schema 2 follows the rendered order");
+
+    repo.write_test_config("[list]\njson-schema = 1\n");
+    let items: Vec<serde_json::Value> =
+        serde_json::from_slice(&run(&["list", "--format=json"])).unwrap();
+    let schema_1 = items
+        .iter()
+        .find(|item| item["branch"] == "feature")
+        .expect("feature row")["symbols"]
+        .as_str()
+        .expect("symbols")
+        .to_string();
+    assert_eq!(schema_1, rendered, "schema 1 follows the rendered order");
+}
+
 /// Schema 2 reports the branch marker as its own `marker` field, and folds
 /// it into `display.symbols` the way the table folds it into the Status
 /// column. A branch with no marker set omits the field entirely.
```

**File**: `tests/snapshots/integration__integration_tests__list__list_bisect_json.snap` (modified, +1/-1)
```diff
@@ -153,7 +153,7 @@ exit_code: 0
       },
       "display": {
         "state": "empty",
-        "symbols": "_↻",
+        "symbols": "↻_",
         "statusline": "bisecting  \u001b[33m↻\u001b[39m\u001b[2m_\u001b[22m"
       }
     },
```

**File**: `tests/snapshots/integration__integration_tests__list__list_json_schema_2_envelope.snap` (modified, +1/-1)
```diff
@@ -338,7 +338,7 @@ exit_code: 0
       },
       "display": {
         "state": "empty",
-        "symbols": "_⊞",
+        "symbols": "⊞_",
         "statusline": "locked-feature  \u001b[33m⊞\u001b[39m\u001b[2m_\u001b[22m"
       }
     }
```

**File**: `tests/snapshots/integration__integration_tests__list__list_json_with_git_operation.snap` (modified, +1/-1)
```diff
@@ -285,7 +285,7 @@ exit_code: 0
       },
       "display": {
         "state": "would_conflict",
-        "symbols": "✗✘",
+        "symbols": "✘✗",
         "statusline": "feature  \u001b[31m✘\u001b[39m\u001b[33m✗\u001b[39m  \u001b[32m↑1\u001b[0m \u001b[2m\u001b[31m↓1\u001b[0m  ^\u001b[32m+2\u001b[0m \u001b[31m-2\u001b[0m"
       }
     }
```

---

### Incident Patch 7: `44235483` (2026-10-01)
**Commit Message**: fix(list): disclose clipped rows in the loading footer (#4333)

The progressive loading footer reported the entire inventory as
“Showing” even when terminal height limited the table to its first rows.
Keep the inventory totals and add the actual displayed count when
clipped: `63 worktrees, 35 branches — first 50 of 98 shown — loading
details…`. A fitting table omits the clipping qualification.

The count comes from the renderer's row limit and stays accurate before
details arrive, during updates, and in slow-loading diagnostics.
Inventory formatting is shared with the final summary.

The selected wording uses “loading details…” instead of the old
completed/total task counter. That counter counted detail-collection
tasks, not entries; on a clipped table, off-screen task progress is no
longer quantified. Slow-loading diagnostics still identify pending
tasks.

Validation: all nine progressive-list tests, 297 list unit tests, and
direct Leaf runs at both heights passed. The project gate passed lint
and documentation checks and 5,016 of 5,017 tests. Its remaining
ambiguous-remote snapshot failure also reproduces on the unchanged base
with Homebrew Git 2.56; normalization is already part

**File**: `src/commands/list/collect/mod.rs` (modified, +28/-44)
```diff
@@ -751,15 +751,18 @@ fn render_reveal(
         .collect()
 }
 
+fn format_loading_footer(footer_base: &str) -> String {
+    let dim = Style::new().dimmed();
+    format!("{INFO_SYMBOL} {dim}{footer_base} — loading details…{dim:#}")
+}
+
 /// Build the progressive-table footer shown while the drain is stalled.
 ///
 /// Pure so it can be snapshot-tested without spinning up the live table.
 /// `first_name` is a branch / display name from the pending set;
 /// `pending_count` is the total outstanding-result count (≥ 1).
 fn format_stall_footer(
     footer_base: &str,
-    completed: usize,
-    total: usize,
     pending_count: usize,
     first_kind: TaskKind,
     first_name: &str,
@@ -773,9 +776,7 @@ fn format_stall_footer(
             "waiting on {pending_count} tasks, including <underline>{kind_name}</> for <underline>{first_name}</>"
         )
     };
-    cformat!(
-        "{INFO_SYMBOL} {dim}{footer_base} ({completed}/{total} loaded, no recent progress; {waiting_clause}){dim:#}"
-    )
+    cformat!("{INFO_SYMBOL} {dim}{footer_base} — no recent progress; {waiting_clause}{dim:#}")
 }
 
 /// Caps on the message shown per failed task: at most `MAX_LINES` lines,
@@ -1513,27 +1514,9 @@ pub fn collect(
 
     // Track expected results per item - populated as spawns are queued
     let expected_results = std::sync::Arc::new(ExpectedResults::default());
-    let num_worktrees = all_items
-        .iter()
-        .filter(|item| item.worktree_data().is_some())
-        .count();
-    let num_local_branches = branches_without_worktrees.len();
-    let num_remote_branches = remote_branches.len();
-
-    let footer_base =
-        if (show_branches && num_local_branches > 0) || (show_remotes && num_remote_branches > 0) {
-            let mut parts = vec![format!("{} worktrees", num_worktrees)];
-            if show_branches && num_local_branches > 0 {
-                parts.push(format!("{} branches", num_local_branches));
-            }
-            if show_remotes && num_remote_branches > 0 {
-                parts.push(format!("{} remote branches", num_remote_branches));
-            }
-            format!("Showing {}", parts.join(", "))
-        } else {
-            let plural = if num_worktrees == 1 { "" } else { "s" };
-            format!("Showing {} worktree{}", num_worktrees, plural)
-        };
+    let mut footer_base = super::SummaryMetrics::from_items(&all_items)
+        .inventory_parts(show_branches || show_remotes)
+        .join(", ");
 
     // Track which placeholder rendering currently uses. Progressive renderers
     // (table or picker) start blank so commands that finish under
@@ -1550,8 +1533,6 @@ pub fn collect(
 
     // Create progressive table if showing progress.
     let mut progressive_table = if show_progress {
-        let dim = Style::new().dimmed();
-
         // Build skeleton rows for both worktrees and branches
         // All items need skeleton rendering since computed data (timestamp, ahead/behind, etc.)
         // hasn't been loaded yet. Using format_list_item_line would show default values like "55y".
@@ -1560,14 +1541,20 @@ pub fn collect(
             .map(|item| layout.render_skeleton_row(item, placeholder).render())
             .collect();
 
-        let initial_footer = format!("{INFO_SYMBOL} {dim}{footer_base} (loading...){dim:#}");
-
         let mut table = ProgressiveTable::new(
             layout.format_header_line(),
             skeletons,
-            initial_footer,
+            String::new(),
             max_width,
         );
+        let visible_rows = table.visible_row_count();
+        if visible_rows < all_items.len() {
+            footer_base = format!(
+                "{footer_base} — first {visible_rows} of {} shown",
+                all_items.len()
+            );
+        }
+        table.update_footer(format_loading_footer(&footer_base));
         table.render_skeleton()?;
         worktrunk::trace::instant("Skeleton rendered");
         Some(table)
@@ -1960,7 +1947,6 @@ pub fn collect(
         drain_deadline,
         primary_target,
         |event| {
-            let dim = Style::new().dimmed();
             let total_results = expected_results.count();
 
             match event {
@@ -1997,10 +1983,7 @@ pub fn collect(
                             s.progress_overflow = true;
                         }
 
-                        let completed = s.completed_results;
-                        let footer_msg = format!(
-                            "{INFO_SYMBOL} {dim}{footer_base} ({completed}/{total_results} loaded){dim:#}"
-                        );
+                        let footer_msg = format_loading_footer(&footer_base);
                         s.table.update_footer(footer_msg);
                         s.table.update_row(item_idx, rendered.clone());
 
@@ -2044,8 +2027,6 @@ pub fn collect(
                         let mut s = state_cell.borrow_mut();
                         let footer_msg = format_stall_footer(
       
```

**File**: `src/commands/list/mod.rs` (modified, +11/-5)
```diff
@@ -297,11 +297,7 @@ impl SummaryMetrics {
         }
     }
 
-    pub(super) fn summary_parts(
-        &self,
-        include_branches: bool,
-        hidden_columns: &[String],
-    ) -> Vec<String> {
+    pub(super) fn inventory_parts(&self, include_branches: bool) -> Vec<String> {
         let mut parts = Vec::new();
 
         let plural = if self.worktrees == 1 { "" } else { "s" };
@@ -318,6 +314,16 @@ impl SummaryMetrics {
             }
         }
 
+        parts
+    }
+
+    pub(super) fn summary_parts(
+        &self,
+        include_branches: bool,
+        hidden_columns: &[String],
+    ) -> Vec<String> {
+        let mut parts = self.inventory_parts(include_branches);
+
         if self.dirty_worktrees > 0 {
             parts.push(format!("{} with changes", self.dirty_worktrees));
         }
```

**File**: `src/commands/list/progressive_table.rs` (modified, +5/-0)
```diff
@@ -229,6 +229,11 @@ impl ProgressiveTable {
         Ok(())
     }
 
+    /// Number of data rows displayed during progressive rendering.
+    pub fn visible_row_count(&self) -> usize {
+        self.row_count
+    }
+
     /// Print all lines to stdout, followed by the prompt-reserve rows.
     fn print_all(&self) -> std::io::Result<()> {
         let mut stdout = stdout();
```

**File**: `tests/integration_tests/list_progressive.rs` (modified, +55/-0)
```diff
@@ -7,8 +7,63 @@
 use crate::common::progressive_output::{ProgressiveCaptureOptions, capture_progressive_output};
 use crate::common::pty::{build_pty_command, exec_cmd_in_pty};
 use crate::common::{TestRepo, repo, wt_bin};
+use ansi_str::AnsiStr;
 use rstest::rstest;
 
+/// Loading footers describe the inventory separately from the displayed rows,
+/// both before results arrive and as rows fill in. Capture the complete PTY
+/// stream so even a fast run must exercise its initial loading footer.
+#[test]
+fn test_list_progressive_loading_footer() {
+    let mut repo = TestRepo::standard_main_only();
+    repo.add_worktree("feature-a");
+    repo.add_worktree("feature-b");
+    for branch in ["branch-a", "branch-b"] {
+        repo.run_git(&["branch", branch]);
+    }
+
+    for (height, expected) in [
+        (30, "○ 3 worktrees, 2 branches — loading details…"),
+        (
+            9,
+            "○ 3 worktrees, 2 branches — first 3 of 5 shown — loading details…",
+        ),
+    ] {
+        let pair = crate::common::open_pty_with_size(height, 150);
+        let cmd = build_pty_command(
+            wt_bin().to_str().unwrap(),
+            &["list", "--progressive", "--branches"],
+            repo.root_path(),
+            &repo.test_env_vars(),
+            None,
+        );
+        let mut child = pair.slave.spawn_command(cmd).unwrap();
+        drop(pair.slave);
+        let reader = pair.master.try_clone_reader().unwrap();
+        let writer = pair.master.take_writer().unwrap();
+        let (raw, exit_code) =
+            crate::common::pty::read_pty_output(reader, writer, pair.master, &mut child);
+        assert_eq!(exit_code, 0);
+        let output = raw.ansi_strip();
+        let loading_footers: Vec<_> = output
+            .lines()
+            .filter(|line| line.contains("loading details…"))
+            .map(|line| &line[line.find('○').unwrap()..])
+            .collect();
+        assert!(
+            !loading_footers.is_empty(),
+            "initial footer missing: {output}"
+        );
+        for footer in loading_footers {
+            assert_eq!(footer.trim_end(), expected);
+        }
+        assert!(
+            output.contains("Showing 3 worktrees, 2 branches"),
+            "final summary missing: {output}"
+        );
+    }
+}
+
 /// Tests progressive rendering with multiple worktrees.
 /// Verifies: headers appear immediately, dots decrease over time, all worktrees visible.
 /// (Consolidates previous tests: rendering_basic, dots_decrease, many_worktrees)
```

---

### Incident Patch 8: `efb4e8b9` (2026-10-01)
**Commit Message**: fix(completion): stop offering --dry-run and --var after an alias (#4329)

`wt <alias> --<Tab>` (and `wt step <alias> --<Tab>`) offered `--dry-run`
and `--var`, but neither does anything useful after an alias.
`AliasOptions::parse` rejects `--dry-run` with "`--dry-run` is no longer
supported; use `wt config alias dry-run <name>` instead" (unless the
template references `dry_run`), and passes `--var KEY=VALUE` through to
the alias as plain positional arguments. Completion was steering users
into an error or a flag that silently does nothing.

The flags come from `build_alias_completion_command` in
`src/completion.rs`, a stub that predates alias argument routing (added
in #1641; `--dry-run` was retired for aliases in #2291 and #2304). This
PR removes the stub's own `--dry-run`, `--yes` and `--var` declarations,
so the stub declares nothing beyond the alias name and help text.
Aliases that wrap a built-in (`co = "wt switch {{ args }}"`) still
mirror that built-in's flags through `mirror_alias_command`, which this
PR doesn't touch.

**Test:** `test_complete_step_alias_shows_flags`, which asserted the
stale flags were present, becomes
`test_complete_step_alias_offers_no_misleading_flags

**File**: `src/completion.rs` (modified, +9/-14)
```diff
@@ -573,10 +573,9 @@ pub(crate) fn inject_hook_subcommands(cmd: Command) -> Command {
     })
 }
 
-/// Build a completion stub `clap::Command` for a hook type. Same shape as
-/// `build_alias_completion_command` — declares the known flags (so they show
-/// up in `wt hook pre-merge --<Tab>` completions) and wires the name completer
-/// for the first positional (hook command name filter).
+/// Build a completion stub `clap::Command` for a hook type. Declares the known
+/// flags (so they show up in `wt hook pre-merge --<Tab>` completions) and wires
+/// the name completer for the first positional (hook command name filter).
 fn build_hook_completion_command(name: &'static str) -> Command {
     let about: &'static str = Box::leak(format!("Run {name} hooks").into_boxed_str());
     Command::new(name)
@@ -756,6 +755,11 @@ fn mirror_alias_command(leaf: Command, alias_name: &str, rep: &CommandConfig) ->
 
 /// Build a completion stub `clap::Command` for an alias. Leaks strings since
 /// completion is a short-lived subprocess that exits after printing candidates.
+///
+/// The stub declares no flags of its own. An alias's flags are its template
+/// variables (`--KEY=VALUE`), which vary per alias: `AliasOptions::parse`
+/// rejects `--dry-run` unless the template references `dry_run`, and forwards
+/// `--var` to the alias as a plain argument.
 fn build_alias_completion_command(name: &str, cmd_config: &CommandConfig) -> Command {
     // Use the first command's template for the help text
     let first_template = cmd_config
@@ -766,16 +770,7 @@ fn build_alias_completion_command(name: &str, cmd_config: &CommandConfig) -> Com
     let help = truncate_template(first_template);
     let name: &'static str = Box::leak(name.to_string().into_boxed_str());
     let about: &'static str = Box::leak(format!("alias: {help}").into_boxed_str());
-    Command::new(name)
-        .about(about)
-        .arg(clap::Arg::new("dry-run").long("dry-run"))
-        .arg(clap::Arg::new("yes").short('y').long("yes"))
-        .arg(
-            clap::Arg::new("var")
-                .long("var")
-                .num_args(1)
-                .action(clap::ArgAction::Append),
-        )
+    Command::new(name).about(about)
 }
 
 /// Load aliases from user and project config for completion. Outside a git
```

**File**: `tests/integration_tests/completion.rs` (modified, +7/-7)
```diff
@@ -1861,8 +1861,11 @@ deploy = "make deploy"
     assert!(subcommands.contains(&"deploy"));
 }
 
+/// The generic alias stub offers no `--dry-run` (an error after an alias; the
+/// dry run is `wt config alias dry-run`) or `--var` (forwarded to the alias as
+/// a plain argument).
 #[rstest]
-fn test_complete_step_alias_shows_flags(repo: TestRepo) {
+fn test_complete_step_alias_offers_no_misleading_flags(repo: TestRepo) {
     repo.commit("initial");
     repo.write_project_config(
         r#"
@@ -1880,12 +1883,9 @@ deploy = "make deploy"
     assert!(output.status.success());
     let stdout = String::from_utf8_lossy(&output.stdout);
 
-    assert!(
-        stdout.contains("--dry-run"),
-        "Missing --dry-run flag: {stdout}"
-    );
-    assert!(stdout.contains("--yes"), "Missing --yes flag: {stdout}");
-    assert!(stdout.contains("--var"), "Missing --var flag: {stdout}");
+    for flag in ["--dry-run", "--var"] {
+        assert!(!stdout.contains(flag), "Unexpected {flag} flag: {stdout}");
+    }
 }
 
 // --- Alias argument-completion mirroring -------------------------------------
```

---

### Incident Patch 9: `a3bf152f` (2026-10-01)
**Commit Message**: fix(plugin): use Worktrunk branding in Codex (#4327)

The Codex plugin listing currently shows a generic icon because its
manifest has no branding asset references. Point both `interface.logo`
and `interface.composerIcon` at the existing square Worktrunk mark
already packaged with the Claude plugin.

Validated the JSON, the 512×512 image, and the plugin layout integration
test. Local lint and documentation gates pass. The full local suite
reports 5,015 passing tests and one failure because Git 2.56 changed the
ambiguous-remote error text; that test passes with Apple Git 2.50.1. CI
remains the full merge gate.

> _This was written by Codex on behalf of max-sixty_

**File**: `plugins/worktrunk/.codex-plugin/plugin.json` (modified, +2/-0)
```diff
@@ -61,6 +61,8 @@
   },
   "interface": {
     "displayName": "Worktrunk",
+    "logo": "./.claude-plugin/icon.png",
+    "composerIcon": "./.claude-plugin/icon.png",
     "shortDescription": "Git worktree workflows for parallel Codex sessions.",
     "longDescription": "Use Worktrunk from Codex to manage linked worktrees, set up LLM commit workflows, and configure project hooks.",
     "developerName": "Worktrunk",
```

---

### Incident Patch 10: `37b537be` (2026-09-30)
**Commit Message**: fix(list): scope the Azure DevOps PR lookup to this repository (#4326)

On an Azure DevOps remote, the `wt list --full` CI column could show a
PR from a different repository. When a sibling repository in the same
Azure project had an active PR from a branch with the same name, that
PR's number, merge status, and link appeared on this repository's row,
dimmed as stale. This PR passes `--repository` to `az repos pr list`,
taking the name from the remote URL.

**Why the lookup was unscoped.** `az repos pr list` only infers the
repository from the git remote when `--org` is absent
([`resolve_instance_project_and_repo`](https://github.com/Azure/azure-devops-cli-extension/blob/master/azure-devops/azext_devops/dev/common/services.py)).
Worktrunk always passes `--org`, so the repository came through as
`None`. With no repository,
[`list_pull_requests`](https://github.com/Azure/azure-devops-cli-extension/blob/master/azure-devops/azext_devops/dev/repos/pull_request.py)
calls `get_pull_requests_by_project`, which searches every repository in
the project. The lookup took the first active PR from any repository's
matching source branch.

**Test.** `test_list_full_azure_pr_lookup_names_the_repos

**File**: `src/commands/list/ci_status/azure.rs` (modified, +39/-3)
```diff
@@ -12,8 +12,8 @@ use super::{
     parse_json, retriable_pr_error,
 };
 
-/// Resolve the Azure DevOps context (host, org, project, `--org` URL) for this
-/// branch's `az` invocations.
+/// Resolve the Azure DevOps context (host, org, project, repository, `--org`
+/// URL) for this branch's `az` invocations.
 ///
 /// Walks the shared [`branch_remote_url`] chain first — so a remote-branch
 /// row from `wt list --remotes --full` queries the right tenant in
@@ -30,11 +30,17 @@ fn azure_context(repo: &Repository, branch: &CiBranchName) -> Option<AzureContex
         let host = parsed.host().to_string();
         let organization = parsed.azure_organization()?.to_string();
         let project = parsed.azure_project()?.to_string();
+        // Clone URLs percent-encode the name (`My%20Repo`), and `az` encodes
+        // `--repository` again when building the REST path.
+        let repository =
+            String::from_utf8_lossy(&urlencoding::decode_binary(parsed.repo().as_bytes()))
+                .into_owned();
         let org_url = az_url::az_org_url(&host, &organization);
         Some(AzureContext {
             host,
             organization,
             project,
+            repository,
             org_url,
         })
     };
@@ -56,12 +62,18 @@ struct AzureContext {
     host: String,
     organization: String,
     project: String,
+    /// Repository name. `az` infers it from the git remote only when `--org`
+    /// is absent, and we always pass `--org`, so a command scoped to this
+    /// repository has to name it.
+    repository: String,
     org_url: String,
 }
 
 /// Detect Azure DevOps PR CI status for a branch.
 ///
-/// Uses `az repos pr list` to find an open PR for the branch.
+/// Uses `az repos pr list` to find an open PR for the branch in this
+/// repository. Without `--repository` the list spans every repository in the
+/// project, so a same-named branch in a sibling repository would match.
 pub(super) fn detect_azure_pr(
     repo: &Repository,
     branch: &CiBranchName,
@@ -83,6 +95,8 @@ pub(super) fn detect_azure_pr(
             "active",
             "--project",
             &ctx.project,
+            "--repository",
+            &ctx.repository,
             "--org",
             &ctx.org_url,
             "--output",
@@ -364,6 +378,28 @@ mod tests {
         let ctx = azure_context(&repo, &branch).expect("scan should find the azure remote");
         assert_eq!(ctx.organization, "myorg");
         assert_eq!(ctx.project, "myproject");
+        assert_eq!(ctx.repository, "myrepo");
+    }
+
+    /// The repository name is decoded, since `az` percent-encodes it again.
+    #[test]
+    fn test_azure_context_decodes_repository_name() {
+        let test = TestRepo::with_initial_commit();
+        test.run_git(&[
+            "remote",
+            "add",
+            "origin",
+            "https://dev.azure.com/myorg/myproject/_git/My%20Repo",
+        ]);
+        let repo = Repository::at(test.root_path()).unwrap();
+        let branch = CiBranchName {
+            full_name: "feature".to_string(),
+            remote: None,
+            name: "feature".to_string(),
+        };
+
+        let ctx = azure_context(&repo, &branch).expect("origin is an azure remote");
+        assert_eq!(ctx.repository, "My Repo");
     }
 
     /// No Azure remote anywhere → `None`.
```

**File**: `tests/integration_tests/ci_status.rs` (modified, +41/-0)
```diff
@@ -1203,6 +1203,47 @@ fn test_list_full_with_azure_stale_pipeline(mut repo: TestRepo) {
     run_azure_ci_status_test(&mut repo, "azure_stale_pipeline", "[]", runs_json);
 }
 
+/// `az repos pr list` searches every repository in the project unless it is
+/// told which one, and `az` infers the repository from the git remote only when
+/// `--org` is absent. Since the lookup passes `--org`, it must pass
+/// `--repository` too, or a same-named branch's PR in a sibling repository
+/// shows up on this repository's row.
+#[rstest]
+fn test_list_full_azure_pr_lookup_names_the_repository(mut repo: TestRepo) {
+    setup_azure_repo_with_feature(&mut repo);
+    repo.setup_mock_az_with_ci_data("[]", "[]");
+
+    // Outside the repo under test, so the log can't dirty the working tree the
+    // command is inspecting.
+    let call_log = tempfile::tempdir().unwrap();
+    let mut cmd = repo.wt_command();
+    cmd.args(["list", "--full"]);
+    repo.configure_mock_commands(&mut cmd);
+    cmd.env("WORKTRUNK_TEST_MOCK_CALL_LOG_DIR", call_log.path());
+    let output = cmd.output().unwrap();
+    assert!(
+        output.status.success(),
+        "wt list --full should succeed: {}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+
+    let calls = mock_calls(call_log.path(), "az");
+    let pr_lists: Vec<_> = calls
+        .iter()
+        .filter(|call| call.starts_with("repos pr list"))
+        .collect();
+    assert!(
+        !pr_lists.is_empty(),
+        "the fixture must reach PR detection. calls: {calls:#?}"
+    );
+    for call in pr_lists {
+        assert!(
+            call.contains("--repository test-repo"),
+            "PR lookup must be scoped to this repository: {call}"
+        );
+    }
+}
+
 /// No PR and no pipeline runs → no CI indicator.
 #[rstest]
 fn test_list_full_with_azure_no_ci(mut repo: TestRepo) {
```

---

### Incident Patch 11: `ccacf213` (2026-09-30)
**Commit Message**: fix(relocate): move the shell with its worktree through a swap, and not out of a nested worktree (#4325)

`wt step relocate` could leave the user's shell in the wrong worktree in
two cases. This PR moves the shell only when the worktree it actually
stands in moves, and on both of the routes a relocation can take.

- **Swaps.** When two worktrees sit at each other's expected paths, one
of them goes through a temporary location. Only the direct-move path
sent the shell's `cd`, so a user standing in the worktree that took the
temporary route stayed at its old path, which by the end holds the other
branch's worktree. `git branch --show-current` there printed the other
branch.
- **Nested worktrees.** The `cd` fired for any cwd under the moved path.
With the documented `worktree-path = ".worktrees/{{ branch | sanitize
}}"` layout, every linked worktree is nested inside the main worktree.
So relocating the main worktree's branch pulled a shell standing in
`.worktrees/other` over to `.worktrees/feature`, even though `other`
never moved.

The fix works out once, before anything moves, which pending worktree
holds the shell: the one with the longest path containing the cwd. It
then sends the

**File**: `src/commands/relocate.rs` (modified, +68/-24)
```diff
@@ -83,6 +83,13 @@ struct TempRelocation {
     original_path: PathBuf,
 }
 
+/// Where the user's shell stands: its cwd and the pending worktree holding it.
+#[derive(Clone, Copy)]
+struct ShellPosition<'a> {
+    cwd: &'a Path,
+    index: usize,
+}
+
 /// A worktree that was successfully relocated.
 pub struct RelocatedEntry {
     pub branch: String,
@@ -475,6 +482,11 @@ impl<'a> RelocationExecutor<'a> {
 
     /// Execute all relocations in dependency order.
     pub fn execute(&mut self, default_branch: &str, cwd: Option<&Path>) -> anyhow::Result<()> {
+        let shell = cwd
+            .map(|cwd| self.shell_position(cwd))
+            .transpose()?
+            .flatten();
+
         // Process until all pending are moved or in temp
         loop {
             let mut made_progress = false;
@@ -487,7 +499,7 @@ impl<'a> RelocationExecutor<'a> {
 
                 match self.is_target_empty(i) {
                     Some(true) => {
-                        self.move_worktree(i, default_branch, cwd)?;
+                        self.move_worktree(i, default_branch, shell)?;
                         made_progress = true;
                     }
                     Some(false) => {
@@ -542,7 +554,7 @@ impl<'a> RelocationExecutor<'a> {
         }
 
         // Move temp-relocated worktrees to final destinations
-        self.finalize_temp_relocations()?;
+        self.finalize_temp_relocations(shell)?;
 
         // Clean up temp directory if empty
         if self.temp_dir.exists() {
@@ -552,6 +564,25 @@ impl<'a> RelocationExecutor<'a> {
         Ok(())
     }
 
+    /// Find the pending worktree the user's shell stands in, if any.
+    ///
+    /// The owner is the worktree whose path is the longest prefix of `cwd`, so
+    /// a shell inside a worktree nested under another (the
+    /// `.worktrees/{{ branch }}` layout nests every linked worktree under the
+    /// main one) belongs to the inner worktree, not the outer.
+    fn shell_position<'c>(&self, cwd: &'c Path) -> anyhow::Result<Option<ShellPosition<'c>>> {
+        let owner = self
+            .repo
+            .list_worktrees()?
+            .iter()
+            .map(|wt| wt.path.as_path())
+            .filter(|path| cwd.starts_with(path))
+            .max_by_key(|path| path.components().count());
+        Ok(owner
+            .and_then(|owner| self.pending.iter().position(|c| c.wt.path == owner))
+            .map(|index| ShellPosition { cwd, index }))
+    }
+
     /// Check if target path is empty (not occupied by a pending worktree).
     ///
     /// Returns:
@@ -601,7 +632,7 @@ impl<'a> RelocationExecutor<'a> {
         &mut self,
         idx: usize,
         default_branch: &str,
-        cwd: Option<&Path>,
+        shell: Option<ShellPosition<'_>>,
     ) -> anyhow::Result<()> {
         // Extract data we need before any mutable borrows
         let branch = self.pending[idx].branch().to_string();
@@ -626,26 +657,7 @@ impl<'a> RelocationExecutor<'a> {
         let msg = cformat!("Relocated <bold>{branch}</>: {src_display} → {dest_display}");
         eprintln!("{}", success_message(msg));
 
-        // Update shell if user is inside this worktree, preserving their
-        // subdirectory position via the same helper as `switch`/`remove` so
-        // every path-switching command behaves identically.
-        if let Some(cwd_path) = cwd
-            && cwd_path.starts_with(&src_path)
-        {
-            let cd_target = crate::output::handlers::resolve_subdir_in_target(
-                &dest_path,
-                Some(&src_path),
-                cwd_path,
-            );
-            crate::output::change_directory(cd_target)?;
-            if crate::output::retired_shell_wrapper_active() {
-                eprintln!(
-                    "{}",
-                    warning_message("Cannot change directory — shell wrapper is out of date")
-                );
-                crate::output::print_outdated_shell_wrapper_hint_once();
-            }
-        }
+        follow_shell(shell, idx, &src_path, &dest_path)?;
 
         self.moved.insert(idx);
         self.relocated_entries.push(RelocatedEntry {
@@ -745,7 +757,10 @@ impl<'a> RelocationExecutor<'a> {
     }
 
     /// Move worktrees from temp locations to their final destinations.
-    fn finalize_temp_relocations(&mut self) -> anyhow::Result<()> {
+    fn finalize_temp_relocations(
+        &mut self,
+        shell: Option<ShellPosition<'_>>,
+    ) -> anyhow::Result<()> {
         for temp in std::mem::take(&mut self.temp_relocated) {
             let candidate = &self.pending[temp.index];
             let branch = candidate.branch();
@@ -763,6 +778,9 @@ impl<'a> RelocationExecutor<'a> {
             let msg = cformat!("Relocated <bold>{branch}</>: {src_display} → {dest_display}");
             eprintln!("{}", success_message(msg));
 
+            let (from, to) = (&temp.original_path, &candidate.expected_path);
+            follow_shell(shell, temp.index, from, 
```

**File**: `tests/integration_tests/step_relocate.rs` (modified, +100/-0)
```diff
@@ -1641,3 +1641,103 @@ fn step_relocate_rejects_prunable_worktree(mut repo: TestRepo) {
         "expected a prunable-worktree error, got: {stderr}"
     );
 }
+
+/// A swap moves one worktree through a temporary location. The shell of a user
+/// standing in either worktree must follow its branch to the new path, whichever
+/// of the two takes the temporary route.
+///
+/// Ignored on Windows for the same reason as `test_relocate_preserves_subdir`.
+#[rstest]
+#[case::in_alpha("alpha")]
+#[case::in_beta("beta")]
+#[cfg_attr(windows, ignore)]
+fn test_relocate_swap_moves_shell_with_its_branch(repo: TestRepo, #[case] standing_in: &str) {
+    let parent = worktree_parent(&repo);
+    let (cd_path, _guard) = directive_file();
+
+    // alpha sits at beta's expected path and beta at alpha's.
+    let path_for_beta = parent.join("repo.beta");
+    let path_for_alpha = parent.join("repo.alpha");
+    repo.run_git(&[
+        "worktree",
+        "add",
+        "-b",
+        "alpha",
+        path_for_beta.to_str().unwrap(),
+    ]);
+    repo.run_git(&[
+        "worktree",
+        "add",
+        "-b",
+        "beta",
+        path_for_alpha.to_str().unwrap(),
+    ]);
+
+    let (cwd, expected) = if standing_in == "alpha" {
+        (&path_for_beta, &path_for_alpha)
+    } else {
+        (&path_for_alpha, &path_for_beta)
+    };
+
+    let mut cmd = repo.wt_command();
+    configure_directive_file(&mut cmd, &cd_path);
+    cmd.args(["step", "relocate"]).current_dir(cwd);
+    let output = cmd.output().unwrap();
+    assert!(
+        output.status.success(),
+        "wt step relocate failed: {}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+
+    let cd_content = fs::read_to_string(&cd_path).unwrap_or_default();
+    assert_eq!(
+        cd_content.trim(),
+        expected.to_string_lossy(),
+        "the shell should follow {standing_in} to its new path"
+    );
+}
+
+/// Relocating the main worktree's branch must not move a shell that stands in a
+/// different worktree nested inside the main one, as the
+/// `.worktrees/{{ branch | sanitize }}` layout produces.
+#[rstest]
+fn test_relocate_main_leaves_shell_in_nested_worktree(repo: TestRepo) {
+    let root = repo.root_path().to_path_buf();
+    let (cd_path, _guard) = directive_file();
+    fs::write(
+        repo.test_config_path(),
+        "worktree-path = \".worktrees/{{ branch | sanitize }}\"\n",
+    )
+    .unwrap();
+    fs::write(root.join(".git/info/exclude"), ".worktrees\n").unwrap();
+
+    // `other` is already at its expected nested path; the main worktree is on
+    // `feature`, so relocate moves `feature` out to `.worktrees/feature`.
+    let other_path = root.join(".worktrees").join("other");
+    repo.run_git(&[
+        "worktree",
+        "add",
+        "-b",
+        "other",
+        other_path.to_str().unwrap(),
+    ]);
+    repo.run_git(&["checkout", "-b", "feature"]);
+
+    let mut cmd = repo.wt_command();
+    configure_directive_file(&mut cmd, &cd_path);
+    cmd.args(["step", "relocate"]).current_dir(&other_path);
+    let output = cmd.output().unwrap();
+    assert!(
+        output.status.success(),
+        "wt step relocate failed: {}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+    assert!(root.join(".worktrees").join("feature").exists());
+
+    let cd_content = fs::read_to_string(&cd_path).unwrap_or_default();
+    assert_eq!(
+        cd_content.trim(),
+        "",
+        "the shell in `other` should stay put, not follow `feature`"
+    );
+}
```

---

### Incident Patch 12: `3949c211` (2026-09-29)
**Commit Message**: fix(squash): run pre-commit hooks before staging so their edits reach the commit (#4321)

`wt step squash`, and the squash path `wt merge` takes by default,
staged changes before running `pre-commit` hooks. Anything a formatter
hook changed was therefore left out of the squash commit and stayed in
the working tree. `wt step commit` already runs hooks first and then
stages. This PR gives
[`handle_squash`](https://github.com/max-sixty/worktrunk/blob/28cc4d14ccf1f289b729d90fec33f1469295d0c1/src/commands/step/squash.rs#L161-L175)
the same order. The `wt hook` docs list `pre-commit` for "Formatters,
linters, type checking … `wt step squash`, and the commit `wt merge`
makes".

**Effect on `wt merge`:** after the squash commit, the hook's edits
leave a dirty tree, so the merge lands but cannot remove the worktree
("Cannot remove worktree after merge: feat has uncommitted changes").
The existing `user_pre_commit_executes` snapshot had locked that in. Its
hook writes `user_precommit.txt`, and the merge committed only
`uncommitted.txt`. The snapshot now shows both files in the commit.

**Verification:**
- New test `test_step_squash_includes_pre_commit_hook_edits`: a
pre-commit hook writes `f

**File**: `src/commands/step/squash.rs` (modified, +8/-7)
```diff
@@ -158,13 +158,9 @@ pub fn handle_squash(
         .unwrap_or_else(|| integration_target.clone());
     let template_vars = TemplateVars::new().with_target(&integration_target);
 
-    // Auto-stage changes before running pre-commit hooks so both beta and merge paths behave identically
-    if stage_mode == StageMode::All {
-        warn_about_untracked_files(&wt)?;
-    }
-    wt.stage(stage_mode)?;
-
-    // Run pre-commit hooks (user first, then project).
+    // Run pre-commit hooks (user first, then project) before staging, as
+    // `wt step commit` does, so the edits a formatter hook makes are staged
+    // into the squash commit rather than left in the working tree.
     if hooks.run() {
         execute_hook(
             &ctx,
@@ -174,6 +170,11 @@ pub fn handle_squash(
         )?;
     }
 
+    if stage_mode == StageMode::All {
+        warn_about_untracked_files(&wt)?;
+    }
+    wt.stage(stage_mode)?;
+
     // Resolve HEAD once, so the span, the message's commit list, and the
     // compare-and-swap that finally moves the branch all describe one tip.
     let head_sha = wt.run_command(&["rev-parse", "HEAD"])?.trim().to_string();
```

**File**: `tests/integration_tests/merge.rs` (modified, +44/-0)
```diff
@@ -1289,6 +1289,50 @@ fn test_merge_pre_commit_collected_for_squash_clean_worktree(
     ));
 }
 
+/// A pre-commit hook's edits land in the squash commit, as they do in the
+/// commit `wt step commit` makes: the hook runs before staging, not after.
+#[rstest]
+fn test_step_squash_includes_pre_commit_hook_edits(repo_with_multi_commit_feature: TestRepo) {
+    let repo = &repo_with_multi_commit_feature;
+    let feature_wt = repo.worktrees["feature"].clone();
+
+    let config_dir = feature_wt.join(".config");
+    fs::create_dir_all(&config_dir).unwrap();
+    fs::write(
+        config_dir.join("wt.toml"),
+        "pre-commit = \"echo formatted > fmt.txt\"",
+    )
+    .unwrap();
+    repo.run_git_in(&feature_wt, &["add", ".config/wt.toml"]);
+    repo.run_git_in(&feature_wt, &["commit", "-m", "Add config"]);
+
+    let output = repo
+        .wt_command()
+        .args(["step", "squash", "--yes"])
+        .current_dir(&feature_wt)
+        .env(
+            "WORKTRUNK_COMMIT__GENERATION__COMMAND",
+            "cat >/dev/null && echo 'feat: combined'",
+        )
+        .output()
+        .unwrap();
+    assert!(
+        output.status.success(),
+        "step squash failed: {}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+
+    assert_eq!(
+        repo.git_output(&["rev-parse", "feature^"]),
+        repo.git_output(&["rev-parse", "main"])
+    );
+    assert_eq!(repo.git_output(&["show", "feature:fmt.txt"]), "formatted");
+    assert_eq!(
+        repo.git_output(&["-C", feature_wt.to_str().unwrap(), "status", "--porcelain"]),
+        ""
+    );
+}
+
 // README EXAMPLE GENERATION TESTS
 // These tests are specifically designed to generate realistic output examples for the README.
 // The snapshots from these tests are manually copied into README.md to show users what
```

**File**: `tests/snapshots/integration__integration_tests__merge__merge_pre_commit_command_failure.snap` (modified, +0/-2)
```diff
@@ -60,8 +60,6 @@ exit_code: 1
 ----- stdout -----
 
 ----- stderr -----
-[33m▲[39m [33mAuto-staging 1 untracked path:[39m
-[107m [0m feature.txt
 [36m◎[39m [36mRunning pre-commit project hook[39m
 [107m [0m [2m[0m[2m[34mexit[0m[2m 1[0m
 [0m[31m✗[39m [31mpre-commit command failed: exit status: 1[39m
```

**File**: `tests/snapshots/integration__integration_tests__merge__merge_pre_commit_command_success.snap` (modified, +2/-2)
```diff
@@ -60,11 +60,11 @@ exit_code: 0
 ----- stdout -----
 
 ----- stderr -----
-[33m▲[39m [33mAuto-staging 1 untracked path:[39m
-[107m [0m feature.txt
 [36m◎[39m [36mRunning pre-commit project hook[39m
 [107m [0m [2m[0m[2m[34mecho[0m[2m [0m[2m[32m'Pre-commit check passed'[0m
 [0mPre-commit check passed
+[33m▲[39m [33mAuto-staging 1 untracked path:[39m
+[107m [0m feature.txt
 [36m◎[39m [36mCommitting changes with default message... [90m(1 file, [32m+1[39m, no squashing needed[39m[90m)[39m[39m
 [2m↳[22m [2mUsing fallback commit message. For LLM setup guide, run [4mwt config --help[24m[22m
 [107m [0m [1mChanges to feature.txt[22m
```

**File**: `tests/snapshots/integration__integration_tests__user_hooks__user_pre_commit_executes.snap` (modified, +10/-8)
```diff
@@ -61,17 +61,19 @@ exit_code: 0
 ----- stdout -----
 
 ----- stderr -----
-[33m▲[39m [33mAuto-staging 1 untracked path:[39m
-[107m [0m uncommitted.txt
 [36m◎[39m [36mRunning pre-commit [1muser:lint[22m[39m
 [107m [0m [2m[0m[2m[34mecho[0m[2m [0m[2m[32m'USER_PRE_COMMIT_RAN'[0m[2m [0m[2m[36m>[0m[2m user_precommit.txt[0m
-[0m[36m◎[39m [36mCommitting changes with default message... [90m(1 file, [32m+1[39m, no squashing needed[39m[90m)[39m[39m
+[0m[33m▲[39m [33mAuto-staging 2 untracked paths:[39m
+[107m [0m uncommitted.txt
+[107m [0m user_precommit.txt
+[36m◎[39m [36mCommitting changes with default message... [90m(2 files, [32m+2[39m, no squashing needed[39m[90m)[39m[39m
 [2m↳[22m [2mUsing fallback commit message. For LLM setup guide, run [4mwt config --help[24m[22m
-[107m [0m [1mChanges to uncommitted.txt[22m
+[107m [0m [1mChanges to uncommitted.txt & user_precommit.txt[22m
 [32m✓[39m [32mCommitted changes @ [2m[HASH][22m[39m
 [36m◎[39m [36mMerging 1 commit to [1mmain[22m @ [2m[HASH][22m (no rebase needed)[39m
-[107m [0m * [33m[HASH][m Changes to uncommitted.txt
-[107m [0m  uncommitted.txt | 1 [32m+[m
-[107m [0m  1 file changed, 1 insertion(+)
-[32m✓[39m [32mMerged to [1mmain[22m [90m(1 commit, 1 file, [32m+1[39m[39m[90m)[39m[39m
+[107m [0m * [33m[HASH][m Changes to uncommitted.txt & user_precommit.txt
+[107m [0m  uncommitted.txt    | 1 [32m+[m
+[107m [0m  user_precommit.txt | 1 [32m+[m
+[107m [0m  2 files changed, 2 insertions(+)
+[32m✓[39m [32mMerged to [1mmain[22m [90m(1 commit, 2 files, [32m+2[39m[39m[90m)[39m[39m
 [2m○[22m Worktree preserved (--no-remove)
```

**File**: `tests/snapshots/integration__integration_tests__user_hooks__user_pre_commit_failure.snap` (modified, +0/-2)
```diff
@@ -61,8 +61,6 @@ exit_code: 1
 ----- stdout -----
 
 ----- stderr -----
-[33m▲[39m [33mAuto-staging 1 untracked path:[39m
-[107m [0m uncommitted.txt
 [36m◎[39m [36mRunning pre-commit [1muser:lint[22m[39m
 [107m [0m [2m[0m[2m[34mexit[0m[2m 1[0m
 [0m[31m✗[39m [31mpre-commit command failed: [1mlint[22m: exit status: 1[39m
```

---

### Incident Patch 13: `b0bb0cdb` (2026-09-29)
**Commit Message**: fix(list): register untracked files literally so a ':x' name can't fail the diff (#4320)

An untracked file whose name starts with `:` makes `wt list`'s
working-tree diff fail. The row loses its `HEAD±` value and `?` marker,
and the footer reports `▲ 1 task failed: main: working-tree diff (fatal:
pathspec ':x' did not match any files)`. This PR registers those files
literally.

The cause is in `register_untracked_paths`: it feeds the NUL-separated
names from `ls-files --others` to `git add --intent-to-add
--pathspec-from-file=-`, and git parses each name as a pathspec. `:x`
reads as magic, and `*`, `?` and `[` read as globs (the glob case is
silent: a name like `b[1].txt` can match a different file or none). The
fix sets `GIT_LITERAL_PATHSPECS=1` on that one command. Git refuses the
literal setting alongside `GIT_GLOB_PATHSPECS` or `GIT_ICASE_PATHSPECS`
("global 'literal' pathspec setting is incompatible with all other
global pathspec settings"), so the command also drops those two
variables if the user exported them.

Call path: `wt list` → `compute_working_tree_diff` →
`working_tree_diff_stats_with_untracked` → `register_untracked_paths`.

**Verification:**
- A new unit test,
`wo

**File**: `src/git/repository/working_tree.rs` (modified, +55/-29)
```diff
@@ -1322,17 +1322,28 @@ impl TempIndex {
     }
 
     /// Register an exact NUL-separated set of untracked paths as intent-to-add.
+    ///
+    /// The paths are file names from `ls-files`, not pathspecs, so
+    /// `GIT_LITERAL_PATHSPECS` keeps a name like `:x` from parsing as magic and
+    /// `b[1].txt` from matching as a glob. Git refuses the literal setting
+    /// alongside the glob and icase ones, so a user's exported
+    /// `GIT_GLOB_PATHSPECS` or `GIT_ICASE_PATHSPECS` is dropped for this call.
     fn register_untracked_paths(&self, paths: Vec<u8>) -> anyhow::Result<()> {
-        self.run_command_output_with_input(
-            [
-                "add",
-                "--intent-to-add",
-                "--sparse",
-                "--pathspec-from-file=-",
-                "--pathspec-file-nul",
-            ],
-            paths,
-        )?;
+        let args = [
+            "add",
+            "--intent-to-add",
+            "--sparse",
+            "--pathspec-from-file=-",
+            "--pathspec-file-nul",
+        ]
+        .map(String::from);
+        let command = self
+            .command(args.iter().cloned())
+            .env_remove("GIT_GLOB_PATHSPECS")
+            .env_remove("GIT_ICASE_PATHSPECS")
+            .env("GIT_LITERAL_PATHSPECS", "1")
+            .stdin_bytes(paths);
+        run_checked(command, &args)?;
         Ok(())
     }
 
@@ -1365,27 +1376,9 @@ impl TempIndex {
     fn run_command_output(
         &self,
         args: impl IntoIterator<Item = impl Into<String>>,
-    ) -> anyhow::Result<std::process::Output> {
-        self.run_command_output_with_input(args, Vec::new())
-    }
-
-    fn run_command_output_with_input(
-        &self,
-        args: impl IntoIterator<Item = impl Into<String>>,
-        stdin: Vec<u8>,
     ) -> anyhow::Result<std::process::Output> {
         let args: Vec<String> = args.into_iter().map(Into::into).collect();
-        let mut command = self.command(args.iter().cloned());
-        if !stdin.is_empty() {
-            command = command.stdin_bytes(stdin);
-        }
-        let output = command
-            .run()
-            .with_context(|| format!("Failed to execute: git {}", args.join(" ")))?;
-        if !output.status.success() {
-            return Err(CommandError::from_failed_output("git", &args, &output).into());
-        }
-        Ok(output)
+        run_checked(self.command(args.iter().cloned()), &args)
     }
 
     /// Build a `git` command pointed at this temp index.
@@ -1419,6 +1412,17 @@ impl TempIndex {
     }
 }
 
+/// Run a `git` command built from `args`, turning a non-zero exit into an error.
+fn run_checked(command: Cmd, args: &[String]) -> anyhow::Result<std::process::Output> {
+    let output = command
+        .run()
+        .with_context(|| format!("Failed to execute: git {}", args.join(" ")))?;
+    if !output.status.success() {
+        return Err(CommandError::from_failed_output("git", args, &output).into());
+    }
+    Ok(output)
+}
+
 #[cfg(test)]
 mod tests {
     use super::has_initialized_submodules_from_status;
@@ -1942,6 +1946,28 @@ mod tests {
         );
     }
 
+    #[cfg(unix)]
+    #[test]
+    fn working_tree_diff_stats_with_untracked_counts_pathspec_magic_names() {
+        // `ls-files` reports names verbatim; registering them must not read
+        // `:x` as pathspec magic or `[1]` as a glob.
+        let test = TestRepo::with_initial_commit();
+        for name in [":x", "b[1].txt", "*"] {
+            std::fs::write(test.root_path().join(name), "one\ntwo\n").unwrap();
+        }
+
+        let repo = Repository::at(test.root_path()).unwrap();
+        assert_eq!(
+            repo.current_worktree()
+                .working_tree_diff_stats_with_untracked()
+                .unwrap(),
+            LineDiff {
+                added: 6,
+                deleted: 0
+            }
+        );
+    }
+
     #[test]
     fn observation_object_directory_is_excluded_from_status_and_diff() {
         let test = TestRepo::with_initial_commit();
```

---

### Incident Patch 14: `7c94d698` (2026-09-29)
**Commit Message**: fix(copy-ignored): stamp copied files with one mtime so cargo keeps its cache (#4319)

On Linux, `wt step copy-ignored` gives each copied file the time its
copy happened to finish. Leaves are copied in parallel, so inside
`target/` a dependency's `.rlib` can end up newer than the dep-info of a
crate that depends on it, and cargo marks that crate dirty. This PR
gives every file the step copies a single mtime, taken before the copy
starts. @max-sixty asked in #4248 for a repro where this matters before
adding it, and @paul-hansen [supplied
one](https://github.com/max-sixty/worktrunk/issues/4248#issuecomment-5883336111).

Their repro, run against this repo at `ffbfcaf7b` on ext4:

| Seeding the new worktree | Units `cargo build` recompiles |
|---|---|
| `wt step copy-ignored` on main | 203 |
| `cp -a` (source mtimes preserved) | 2 |
| `wt step copy-ignored` with this PR | 2 |

With `CARGO_LOG=cargo::core::compiler::fingerprint=info`, main's rebuild
starts from `StaleDependency { dep_mtime, max_mtime }` entries a few
hundred ms apart, and `StaleDepFingerprint` carries them up the graph.
With this PR, the only dirty item left is `MissingFile { .git/HEAD }`:
worktrunk's build script watc

**File**: `src/commands/step/copy_ignored.rs` (modified, +16/-6)
```diff
@@ -2,6 +2,7 @@
 
 use std::fs;
 use std::path::PathBuf;
+use std::time::SystemTime;
 
 use anyhow::Context;
 use color_print::cformat;
@@ -256,6 +257,10 @@ pub fn step_copy_ignored(
         Progress::start("Copying")
     };
 
+    // One mtime for everything this run copies, taken before the first file
+    // lands — see `worktrunk::copy` for why build caches need it.
+    let stamp = Some(SystemTime::now());
+
     for (src_entry, is_dir) in &entries_to_copy {
         let relative = src_entry
             .strip_prefix(&source_path)
@@ -264,11 +269,15 @@ pub fn step_copy_ignored(
 
         if *is_dir {
             // A pure copy deletes no source, so the skip count has nothing to guard.
-            let _skipped =
-                copy_dir_recursive(src_entry, &dest_entry, Some(&dest_path), force, &progress)
-                    .with_context(|| {
-                        format!("copying directory {}", format_path_for_display(relative))
-                    })?;
+            let _skipped = copy_dir_recursive(
+                src_entry,
+                &dest_entry,
+                Some(&dest_path),
+                force,
+                stamp,
+                &progress,
+            )
+            .with_context(|| format!("copying directory {}", format_path_for_display(relative)))?;
         } else {
             if let Some(parent) = dest_entry.parent() {
                 fs::create_dir_all(parent).with_context(|| {
@@ -278,7 +287,8 @@ pub fn step_copy_ignored(
                     )
                 })?;
             }
-            if let Some((bytes, data)) = copy_leaf(src_entry, &dest_entry, Some(&dest_path), force)?
+            if let Some((bytes, data)) =
+                copy_leaf(src_entry, &dest_entry, Some(&dest_path), force, stamp)?
             {
                 progress.record(bytes, data);
             }
```

**File**: `src/commands/step/promote.rs` (modified, +2/-2)
```diff
@@ -42,9 +42,9 @@ fn move_entry(src: &Path, dest: &Path, is_dir: bool) -> anyhow::Result<()> {
 /// refusing over one would abort a promote after the branch exchange.
 fn copy_and_remove(src: &Path, dest: &Path, is_dir: bool) -> anyhow::Result<()> {
     let skipped = if is_dir {
-        copy_dir_recursive(src, dest, None, true, &Progress::disabled())?
+        copy_dir_recursive(src, dest, None, true, None, &Progress::disabled())?
     } else {
-        usize::from(copy_leaf(src, dest, None, true)?.is_none())
+        usize::from(copy_leaf(src, dest, None, true, None)?.is_none())
     };
     if skipped > 0 {
         bail!(
```

**File**: `src/copy.rs` (modified, +115/-9)
```diff
@@ -25,12 +25,25 @@
 //! through to `fs::copy`. The signal is exact per file but says only that a
 //! clone did not happen, never why — an unsupported filesystem and a
 //! cross-device copy are indistinguishable here.
+//!
+//! A caller can pass a `stamp` to give every copied regular file the same
+//! modification time. Without one, a file keeps whatever time its copy left it:
+//! APFS clones and Windows' `CopyFileEx` carry the source's, while Linux's
+//! `FICLONE` and `fs::copy` fallback write the time of the copy — and since
+//! leaves copy in parallel, that time orders files by thread scheduling.
+//! Build tools read that order: cargo marks a crate dirty when a dependency's
+//! output is newer than its own, so a `target/` copied that way recompiles a
+//! scattering of crates (#4248). Stamping with a time taken before the copy
+//! makes files within the tree compare equal and keeps them no older than a
+//! checkout that preceded it; preserving source times instead would make
+//! outputs older than freshly checked-out sources.
 
 use std::fs;
 use std::io::ErrorKind;
 use std::path::{Path, PathBuf};
 use std::sync::LazyLock;
 use std::sync::atomic::{AtomicUsize, Ordering};
+use std::time::SystemTime;
 
 use anyhow::Context;
 use rayon::prelude::*;
@@ -107,11 +120,16 @@ static COPY_POOL: LazyLock<rayon::ThreadPool> = LazyLock::new(|| {
 /// outside `root`. The check guards the parent chain, not the final leaf, so
 /// leaf-symlink behavior is preserved (without `force` the symlink is skipped;
 /// with `force` the symlink itself is replaced).
+///
+/// When `stamp` is `Some`, a copied regular file gets it as its modification
+/// time (see the module docs). Symlinks keep theirs: `std` can't set a link's
+/// own times without following it.
 pub fn copy_leaf(
     src: &Path,
     dest: &Path,
     root: Option<&Path>,
     force: bool,
+    stamp: Option<SystemTime>,
 ) -> anyhow::Result<Option<(u64, DataCopy)>> {
     if let Some(root) = root {
         ensure_path_within_root(dest.parent().unwrap_or(dest), root)?;
@@ -187,6 +205,9 @@ pub fn copy_leaf(
                     fs::set_permissions(dest, src_meta.permissions())
                         .context("setting destination file permissions")?;
                 }
+                if let Some(stamp) = stamp {
+                    set_modified(dest, stamp);
+                }
                 FORCED_DATA_COPY.unwrap_or(classify_copy(fallback))
             }
             Err(e) if e.kind() == ErrorKind::AlreadyExists => {
@@ -210,6 +231,29 @@ pub fn copy_leaf(
     Ok(Some((bytes, data)))
 }
 
+/// Set a copied file's modification time, best-effort: the contents are already
+/// in place, so a file we can't reopen keeps its copy-time mtime rather than
+/// failing a batch that otherwise succeeded. Logged at debug, so `wt -vv` shows
+/// it.
+fn set_modified(path: &Path, stamp: SystemTime) {
+    // Windows needs a handle with FILE_WRITE_ATTRIBUTES, which a read-only
+    // open doesn't grant; Unix sets times on any descriptor the owner holds.
+    #[cfg(windows)]
+    let file = {
+        use std::os::windows::fs::OpenOptionsExt;
+        const FILE_WRITE_ATTRIBUTES: u32 = 0x0100;
+        fs::OpenOptions::new()
+            .access_mode(FILE_WRITE_ATTRIBUTES)
+            .open(path)
+    };
+    #[cfg(not(windows))]
+    let file = fs::File::open(path);
+
+    if let Err(e) = file.and_then(|file| file.set_modified(stamp)) {
+        tracing::debug!(path = %path.display(), "leaving copy-time mtime on {}: {e}", path.display());
+    }
+}
+
 fn ensure_path_within_root(path: &Path, root: &Path) -> anyhow::Result<()> {
     let canonical_root = canonicalize_with_parents(root);
     let canonical_path = canonicalize_with_parents(path);
@@ -266,12 +310,15 @@ struct CopyLeaf {
 /// When `root` is `Some`, refuses destination directory ancestry that resolves
 /// outside `root`. Leaves inherit the guarantee because `entry.file_name()` is
 /// a single basename and cannot escape the validated parent directory.
+///
+/// `stamp` is passed to each [`copy_leaf`].
 #[must_use = "a caller that deletes the source must refuse on a non-zero skip count"]
 pub fn copy_dir_recursive(
     src: &Path,
     dest: &Path,
     root: Option<&Path>,
     force: bool,
+    stamp: Option<SystemTime>,
     progress: &Progress,
 ) -> anyhow::Result<usize> {
     // Phase 1: Walk directories iteratively, creating dest dirs and collecting leaves.
@@ -346,7 +393,7 @@ pub fn copy_dir_recursive(
         leaves
             .par_iter()
             .try_for_each(|leaf| -> anyhow::Result<()> {
-                match copy_leaf(&leaf.src, &leaf.dest, None, force)? {
+                match copy_leaf(&leaf.src, &leaf.dest, None, force, stamp)? {
                     Some((bytes, data)) => progress.record(bytes, data),
                     None => {
                         skipped_leaves.fetch_add(1, Ordering::Relaxed);
@@ -457,7 +504,7 @@ mod tests {
         let src = dest_dir.pa
```

---

### Incident Patch 15: `d0594169` (2026-09-28)
**Commit Message**: fix(remove): don't point at a detached worktree removed in the same run (#4313)

#3791 made a branch-only `wt remove` name the detached worktree still
sitting at the branch's path, with a hint to run `wt remove <that
path>`. When the user does that in the same command, `wt remove feature
../repo.feature`, the worktree removal runs first. The branch-only line
then still reports the now-deleted directory and suggests removing it:

```
✓ Removed worktree @ ~/repo.both-detached (detached HEAD, no branch to delete)
○ No worktree found for branch both-detached; a detached worktree is @ ~/repo.both-detached
↳ To remove the detached worktree, run wt remove ~/repo.both-detached
✓ Removed branch both-detached (same commit as main, _)
```

`--format=json` carries the same stale `detached_worktree` path. The
annotation is computed per target inside `validate_remove_targets`,
before the other targets are known. This PR clears it after the loop
when another plan in the same run (`others` or `current`) removes that
path. The check runs after the loop because the path argument can come
before or after the branch. A path target that failed validation isn't
removed, so its hint stays.

`test_remove_

**File**: `src/commands/remove.rs` (modified, +23/-0)
```diff
@@ -250,6 +250,29 @@ fn validate_remove_targets(
         }
     }
 
+    // `wt remove <branch> <its-detached-path>` removes that directory in this
+    // run, so it isn't left behind. Checked after the loop because the path
+    // argument can come before or after the branch.
+    let removed: Vec<&Path> = plans
+        .others
+        .iter()
+        .chain(&plans.current)
+        .filter_map(RemovalPlan::removed_worktree_path)
+        .collect();
+    for plan in &mut plans.branch_only {
+        if let RemovalPlan::BranchOnly {
+            detached_worktree, ..
+        } = plan
+            && detached_worktree.as_deref().is_some_and(|detached| {
+                removed
+                    .iter()
+                    .any(|path| worktrunk::path::paths_match(path, detached))
+            })
+        {
+            *detached_worktree = None;
+        }
+    }
+
     plans
 }
 
```

**File**: `tests/integration_tests/remove.rs` (modified, +42/-0)
```diff
@@ -4792,6 +4792,48 @@ fn test_remove_json_reports_detached_worktree(mut repo: TestRepo) {
     );
 }
 
+/// Naming the detached worktree by path alongside the branch — the removal the
+/// hint above suggests — removes that directory in the same run, so the
+/// branch-only removal must not report it as left behind.
+#[rstest]
+fn test_remove_branch_and_its_detached_worktree_together(mut repo: TestRepo) {
+    let worktree_path = repo.add_worktree("both-detached");
+    repo.detach_head_in_worktree("both-detached");
+
+    let output = repo
+        .wt_command()
+        .args([
+            "remove",
+            "both-detached",
+            worktree_path.to_str().unwrap(),
+            "--format=json",
+            "--yes",
+            "--foreground",
+        ])
+        .output()
+        .unwrap();
+    assert!(output.status.success());
+    assert!(!worktree_path.exists(), "detached worktree must be removed");
+
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    assert!(
+        !stderr.contains("a detached worktree is @"),
+        "must not point at a directory this run removed; stderr:\n{stderr}"
+    );
+    let json: serde_json::Value =
+        serde_json::from_str(&String::from_utf8_lossy(&output.stdout)).unwrap();
+    let branch_only = json
+        .as_array()
+        .unwrap()
+        .iter()
+        .find(|e| e["kind"] == "branch_only")
+        .unwrap_or_else(|| panic!("expected a branch_only entry: {json}"));
+    assert!(
+        branch_only["detached_worktree"].is_null(),
+        "json must not name a directory this run removed: {json}"
+    );
+}
+
 #[cfg(not(target_os = "windows"))]
 #[rstest]
 fn test_remove_json_multi_with_branch_only(mut repo: TestRepo) {
```

#### Recent Merged Pull Requests:
- **PR #4376** (closed): chore: pre-commit autoupdate (@pre-commit-ci[bot])
- **PR #4369** (2026-10-05): ci: upgrade Tend and install Codecov uploaders from PyPI (@max-sixty)
- **PR #4367** (2026-10-04): chore: bump MSRV and toolchain to Rust 1.98 (@worktrunk-bot)
- **PR #4366** (2026-10-04): ci: bump cargo-insta pin to 1.49.0 (@worktrunk-bot)
- **PR #4365** (2026-10-04): ci: bump pinned worktrunk to 0.80.0 (@worktrunk-bot)
- **PR #4364** (2026-10-04): fix(switch): suggest a dev.azure.com URL when the Azure remote is SSH (@worktrunk-bot)
- **PR #4363** (2026-10-04): docs(config): correct stale examples and lists in wt config help (@worktrunk-bot)
- **PR #4362** (2026-10-04): chore: update tend workflows (0.3.5 → 0.3.7) (@worktrunk-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
