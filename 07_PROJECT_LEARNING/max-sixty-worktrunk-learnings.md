> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/max-sixty-worktrunk-learnings.md`  
> **Source**: github ([https://github.com/max-sixty/worktrunk](https://github.com/max-sixty/worktrunk))  
> **Source Version**: `71d99c7e`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T00:15:23.834Z  
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
> **Harvest Timestamp**: 2026-11-08T00:15:22.855Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `max-sixty/worktrunk`
- **Description**: Worktrunk is a CLI for Git worktree management, designed for parallel AI agent workflows
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11948 stars

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

import { lstatSync } from "node:fs";
import { delimiter, join } from "node:path";

import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

// The worktrunk binary, chosen as `plugins/worktrunk/hooks/wt.sh` chooses it.
// On Windows, `wt` is usually Windows Terminal's app-execution alias, which
// accepts any arguments, exits 0, and reports the unknown program in a popup
// window. So prefer `git-wt.exe` there, and never run a `wt` from WindowsApps.
// `lstat` rather than `exists`: the alias is a reparse point, and it has to be
// seen for the lookup to stop where Windows' own PATH search would.
// `undefined` means no worktrunk binary was found.
function worktrunkBin(): string | undefined {
  if (process.env.WORKTRUNK_BIN) return process.env.WORKTRUNK_BIN;
  if (process.platform !== "win32") return "wt";
  const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const find = (name: string) =>
    dirs
      .map((dir) => join(dir, name))
      .find((path) => {
        try {
          lstatSync(path);
          return true;
        } catch {
          return false;
        }
      });
  if (find("git-wt.exe")) return "git-wt.exe";
  const wt = find("wt.exe");
  return wt && !/[\\/]WindowsApps[\\/]/i.test(wt) ? "wt" : undefined;
}

export default function worktrunkActivity(pi: HookAPI): void {
  const run = async (
    ctx: { cwd: string },
    args: ["set", string] | ["clear"],
  ): Promise<void> => {
    const bin = worktrunkBin();
    if (!bin) return;
    try {
      await pi.exec(bin, ["config", "state", "marker", ...args], {
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

### Core Architecture Module: `plugins/worktrunk/hooks/patch.ts`
```
import type { FileDiff } from '../types'

/**
 * Splits a `git diff` patch into its files, keeping each file's hunks as the
 * source a `Code` element draws under `format: 'diff'`.
 *
 * Reads the headers git writes with `--no-color --no-ext-diff`, the `a/` and
 * `b/` prefixes and `core.quotePath=false`: `diff --git a/<old> b/<new>`, then
 * `new file`, `deleted file`, `rename to`, `Binary files` or `---`/`+++`
 * lines, then hunks. Git ends a `---`/`+++` name holding a space with a tab,
 * and still C-quotes one holding a tab, newline, quote or backslash.
 */
export function parsePatch(patch: string): FileDiff[] {
  const files: FileDiff[] = []
  for (const chunk of patch.split(/^(?=diff --git )/m)) {
    if (!chunk.startsWith('diff --git ')) {
      continue
    }
    const lines = chunk.split('\n')
    const first = lines[0] ?? ''
    const hunkAt = lines.findIndex(line => line.startsWith('@@'))
    const header = hunkAt === -1 ? lines : lines.slice(0, hunkAt)
    const body = hunkAt === -1 ? [] : lines.slice(hunkAt)
    const named = (prefix: string) => {
      const rest = header.find(line => line.startsWith(prefix))?.slice(prefix.length)
      return rest === undefined ? undefined : unquote(rest)
    }
    // A `---` or `+++` name without its side's prefix; `/dev/null` has none.
    const side = (prefix: string, at: string) => {
      const name = named(prefix)
      return name?.startsWith(at) === true ? name.slice(at.length) : undefined
    }
    const has = (prefix: string) => header.some(line => line.startsWith(prefix))

    // `+++ b/<path>` names the file after the change; a deletion has
    // `+++ /dev/null` and names it on `---`. A file with no hunks (binary,
    // mode-only, pure rename) names it only on `diff --git`.
    const quoted = / ("(?:[^"\\]|\\.)*")$/.exec(first)?.[1]
    const path =
      named('rename to ') ??
      side('+++ ', 'b/') ??
      side('--- ', 'a/') ??
      (quoted === undefined
        ? first.replace(/^diff --git a\/.* b\//, '')
        : unquote(quoted).replace(/^b\//, ''))

    let added = 0
    let deleted = 0
    for (const line of body) {
      if (line.startsWith('+')) {
        added += 1
      } else if (line.startsWith('-')) {
        deleted += 1
      }
    }

    const status: FileDiff['status'] = has('Binary files ')
      ? 'binary'
      : has('new file mode')
        ? 'added'
        : has('deleted file mode')
          ? 'deleted'
          : has('rename to ')
            ? 'renamed'
            : 'modified'

    const from = named('rename from ')
    const modes = [named('old mode '), named('new mode ')]
    const notes = [
      from === undefined ? null : `from ${from}`,
      modes[0] === undefined ? null : `mode ${modes[0]} → ${modes[1]}`,
    ].filter(note => note !== null)

    files.push({
      path: printable(path),
      status,
      added,
      deleted,
      note: notes.length === 0 ? null : printable(notes.join(', ')),
      hunks: printable(body.join('\n').replace(/\n+$/, '')),
    })
  }
  return files
}

const ESCAPES: Record<string, string> = {
  a: String.fromCharCode(7),
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
}

/**
 * A name as git wrote it on a header line: C-quoted and escaped, or bare and
 * ended with a tab when it holds a space.
 */
function unquote(name: string): string {
  if (!name.startsWith('"')) {
    return name.replace(/\t$/, '')
  }
  return name
    .slice(1, name.lastIndexOf('"'))
    .replace(/\\([0-7]{3}|.)/g, (_, code: string) =>
      code.length === 3 ? String.fromCharCode(Number.parseInt(code, 8)) : (ESCAPES[code] ?? code),
    )
}

/**
 * Replaces the control characters a drawn text refuses (all but tab and
 * newline: a CRLF file's `\r`, an escape sequence in a fixture) with U+FFFD.
 */
export function printable(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '�')
}

```

### Core Architecture Module: `plugins/worktrunk/hooks/register.tsx`
```
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { DiffView, FileDiff, Row, Touched } from '../types'
import { parsePatch, printable } from './patch'

/**
 * `/wt-diff`: a pane showing `wt step diff` for each worktree this session
 * worked in. Claude Code only; it is the plugin's one hooks module.
 *
 * Until the pane opens, the hooks only note directories: the session's own,
 * each directory Edit, Write or NotebookEdit wrote a file in, and each one a
 * Bash call ran in or changed a file in, subagents' calls included. Nothing
 * runs git or `wt`, and nothing is drawn. A hook reads `$.session.cwd()` as its
 * own loop's directory, so the session's directory, which the pane marks `@`,
 * is read only in hooks of the main loop: at the session's start, after each
 * of its turns and of its tool calls that were not read-only, and on a press.
 *
 * While the pane is open, each refresh resolves the noted directories to
 * worktrees with `git rev-parse`, cached per directory, and Worktrunk computes
 * everything shown: `wt list --format=json` the rows, one call per repository,
 * and `wt step diff` the selected worktree's files. It refreshes when the pane
 * opens, when a worktree is selected, after tool calls that were not
 * read-only (once a burst of them goes quiet) and at the end of each turn.
 */

const PANE = 'wt-diff'
// Characters of hunks drawn at once; a drawing draws its first 100,000.
const BUDGET = 80_000
// `wt list` JSON in the envelope this module reads, whatever schema the
// person's config picks.
const LIST_JSON = ['--config-set', 'list.json-schema=2', 'list', '--format=json']
// `git -c core.quotePath=false`, through git's environment spelling of `-c`.
const QUOTE_PATH_OFF = {
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'core.quotePath',
  GIT_CONFIG_VALUE_0: 'false',
}

const seen = atom({ plugin: 'worktrunk', key: 'seen' } as const, [], {
  shape: 'seen-1',
})
const here = atom({ plugin: 'worktrunk', key: 'here' } as const, null)
const touched = atom({ plugin: 'worktrunk', key: 'touched' } as const, [], {
  shape: 'touched-1',
})
const rows = atom({ plugin: 'worktrunk', key: 'rows' } as const, [], {
  shape: 'rows-1',
})
const current = atom({ plugin: 'worktrunk', key: 'current' } as const, null)
const selected = atom({ plugin: 'worktrunk', key: 'selected' } as const, null)
const diffs = atom({ plugin: 'worktrunk', key: 'diffs' } as const, {}, {
  shape: 'diffs-1',
})
// -1 while the pane shows its top, so the first `j` reaches the first file.
const cursor = atom({ plugin: 'worktrunk', key: 'cursor' } as const, -1)

type Located = { root: string; commonDir: string }

// Per load: a reload asks git again and drops a pending refresh.
const located = new Map<string, Located | null>()
let refreshTimer: Timer | undefined
let refreshing: Promise<void> = Promise.resolve()

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'wt-diff',
      description: 'Show `wt step diff` for the worktrees this session worked in',
      argumentHint: '[branch]',
      immediate: true,
    })
    const started = await next(e)
    await note($, [await noteHere($)])
    return started
  })

  on('command.run', { command: 'wt-diff' }, async ($, e) => {
    const branch = e.args.trim()
    const cwd = await $.session.cwd()
    // Bare on an open pane, it gives the pane the keys and keeps what it shows.
    const shown = branch === '' && (await isPaneOpen($)) ? await read($, selected) : null
    const root =
      shown ??
      (branch === ''
        ? ((await locate($, cwd))?.root ?? null)
        : await worktreeOf($, cwd, branch))
    if (root === null) {
      return {
        text:
          branch === ''
            ? `wt-diff: ${cwd} is in no git worktree`
            : `wt-diff: no worktree for branch ${branch}`,
      }
    }
    await note($, [await noteHere($), root])
    if (shown === null) {
      await select($, root)
    }
    const opened = await $.ui.open({ id: PANE, title: 'wt step diff', focus: true })
    await refresh($)
    return opened.isPlaced ? {} : { text: 'wt-diff: the pane is open but not shown here.' }
  })

  // It judges nothing: where it fails, the call goes on as it ran.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    // A call the tool ran read-only changed no file and no directory.
    if (ran.deny !== undefined || ran.isReadOnly === true) {
      return ran
    }
    const dirs: string[] = []
    if (e.tool === 'Edit' || e.tool === 'Write') {
      dirs.push(parentOf(e.file_path))
    } else if (e.tool === 'NotebookEdit') {
      dirs.push(parentOf(e.notebook_path))
    } else if (e.tool === 'Bash') {
      // Where the command ran: a subagent's own directory, in its calls.
      dirs.push(await $.session.cwd(), ...changedFiles(ran.result).map(parentOf))
    }
    if (e.agentId === undefined) {
      dirs.push(await noteHere($))
    }
    await note($, dirs)
    // What the call changed shows once a burst of calls goes quiet.
    if (await isPaneOpen($)) {
      refreshTimer?.cancel()
      refreshTimer = $.clock.after(400, () => {
        void refresh($)
      })
    }
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      await note($, [await noteHere($)])
      void refresh($)
    }
    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Code, Text } = $.ui.resolve(e)
    const [list, known, own, root, all, at] = await Promise.all([
      read($, touched),
      read($, rows),
      read($, current),
      read($, selected),
      read($, diffs),
      read($, cursor),
    ])

    // The session's own worktree first, then the most recently worked in.
    const ordered = [...list].sort(
      (a, b) =>
        Number(b.root === own) - Number(a.root === own) || b.lastAt - a.lastAt,
    )
    const rowOf = (one: string) => known.find(row => row.root === one)
    const view = root === null ? undefined : all[root]
    const row = root === null ? undefined : rowOf(root)
    const files = view?.files ?? []
    // At the top, the first file is the one shown first.
    const drawn = drawnFiles(files, Math.max(at, 0))

    return (
      <Box flexDirection="column">
        <Text bold>Worktrees this session worked in</Text>
        {ordered.length === 0 && <Text dimColor>None yet.</Text>}
        {ordered.map((one, index) => {
          const info = rowOf(one.root)
          return (
            <Button
              key={`wt:${one.root}`}
              plain
              hotkey={index < 9 ? String(index + 1) : undefined}
              onPress={() => pick($, one.root)}
            >
              {one.root === root ? '▸ ' : '  '}
              {info?.branch ?? baseName(one.root)}
              {one.root === own ? ' @' : ''}{' '}
              <Text dimColor>{info === undefined ? '' : summary(info)}</Text>
            </Button>
          )
        })}
        <Text dimColor>{'─'.repeat(Math.max(10, e.props.bodyColumns))}</Text>
        {root === null ? (
          <Text dimColor>Select a worktree.</Text>
        ) : (
          <Box flexDirection="column">
            <Text>
              <Text bold>{row?.branch ?? baseName(root)}</Text>
              <Text dimColor>
                {' '}
                vs {row?.target ?? 'default branch'} · {files.length} files ·{' '}
              </Text>
              <Text color="diffAdded">+{sum(files, 'added')}</Text>{' '}
              <Text color="diffRemoved">-{sum(files, 'deleted')}</Text>
            </Text>
            <Box flexDirection="row" gap={2}>
              <Button key="refresh" plain hotkey="r" label="refresh" onPress={() => reload($)} />
              {/* j and k as in Claude Code's diff dialog; the `action` also
                  presses each from the prompt by the person's chord for the
                  diff panel's file list (ctrl+↓ and ctrl+↑ by default). */}
              <Button
                key="next"
                plain
                hotkey="j"
                action="app:diffFileListDown"
                label="next file"
                onPress={() => move($, 1)}
              />
              <Button
                key="prev"
                plain
                hotkey="k"
                action="app:diffFileListUp"
                label="previous"
                onPress={() => move($, -1)}
              />
              {/* The keys above reach the pane only while it holds the keyboard. */}
              <Text dimColor>
                {e.props.isFocused ? '↑↓ scroll · esc: prompt' : 'ctrl+x tab: focus'}
              </Text>
            </Box>
            {view === undefined && <Text dimColor>Loading…</Text>}
            {view?.isTruncated === true && (
              <Text color="warning">
                The diff passed 4 MiB; the files after these are not shown.
              </Text>
            )}
            {view !== undefined && view.error !== null && (
              <Text color="error">{view.error}</Text>
            )}
            {view !== undefined && view.error === null && files.length === 0 && (
              <Text dimColor>No changes since the merge base.</Text>
            )}
            {files.map((file, index) => (
              <Button
                key={`file:${file.path}`}
                plain
                dimColor={index !== at}
                onPress={() => jump($, index, file.path)}
              >
                {glyph(file)} {file.path}{' '}
                <Text color="diffAdded">+{file.added}</Text>{' '}
                <Text color="diffRemoved">-{file.deleted}</Text>
              </Button>
            ))}
            {files.map((file, index) => (
              <Box key={`box:${file.path}`} flexDirection="column" marginTop={1}>
            
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
//! - Default branch override (git config `worktrunk.default-branch`)
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
                nam
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
use super::hook_filter::selected_hook_configs;
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

    // Each source runs independently, including when names are filtered.
    let mut announcer = HookAnnouncer::new(ctx.repo, false);
    let steps = prepare_and_check(
        ctx,
        user_config,
        project_config,
        hook_type,
        extra_vars,
        name_filters,
    )?;
    announcer.add_steps(ctx, hook_type, None, steps);
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

/// Union of top-level variables referenced by selected commands.
/// A reference in any selected step makes the variable a binding candidate.
fn referenced_vars_union(
    selected: &[(HookSource, CommandConfig)],
    hook_type: HookType,
) -> anyhow::Result<std::collections::BTreeSet<String>> {
    let mut out = std::collections::BTreeSet::new();
    for (source, config) in selected {
        out.extend(referenced_vars_for_config(config, |name| {
            source.hook_label(hook_type, name)
        })?);
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
    /// bind if a selected template references KEY, else forward to `{{ args }}`.
    pub shorthand_vars: &'a [String],
    /// Tokens after `--` that forward to `{{ args }}` verbatim.
    pub forwarded_args: &'a [String],
}

/// Handle `wt hook` command
///
/// Runs configured user and project hooks selected by optional source/name filters.
///
/// Works in detached HEAD state - the `{{ branch }}` template variable (and the
/// `{{ base }}` / `{{ target }}` names derived from it) is simply unset there.
///
/// Template variables come from three sources in [`HookCliArgs`], routed per
/// alias semantics:
/// - `shorthand_vars` (`--KEY=VALUE`): binds `{{ KEY }}` if a selected hook template
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
        // If declined, return early - the whole point of `wt hook` is to run hooks
        if !approved {
            eprintln!("{}", worktrunk::styling::info_message("Commands declined"));
            return Ok(());
        }
    }

    // Get effective user hooks (global + per-project merged)
    let user_hooks = ctx.config.hooks(ctx.project_id().as_ref());
    let user_config = user_hooks.get(hook_type);
    let proj_config = project_config.as_ref().and_then(|c| c.hooks.get(hook_type));
    // No hooks configured: warn and exit successfully. Running hooks that
    // don't exist is a no-op, so scripts can invoke `wt hook <type>`
    // unconditionally without special-casing empty configuration.
    if user_config.is_none() && pr
```

### Core Architecture Module: `src/commands/hook_filter.rs`
```
//! Hook filter types for command filtering by source and name.

use worktrunk::config::{CommandConfig, HookSource};

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

/// Select commands before template parsing, preparation, or execution.
/// Shared by manual-hook argument routing and pipeline preparation.
pub(crate) fn selected_hook_configs(
    user_config: Option<&CommandConfig>,
    project_config: Option<&CommandConfig>,
    name_filters: &[String],
) -> Vec<(HookSource, CommandConfig)> {
    let filters: Vec<_> = name_filters
        .iter()
        .map(|name| ParsedFilter::parse(name))
        .collect();
    [
        (HookSource::User, user_config),
        (HookSource::Project, project_config),
    ]
    .into_iter()
    .filter_map(|(source, config)| {
        let config = config?.filtered(|command| {
            filters.is_empty()
                || filters
                    .iter()
                    .any(|filter| filter.matches_command(source, command.name.as_deref()))
        });
        let has_commands = config.commands().next().is_some();
        has_commands.then_some((source, config))
    })
    .collect()
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
//! ([`prepare_selected`] takes the frozen [`CommandConfig`] list, never config),
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
    CommandContext, FailureStrategy, PipelineKind, execute_pipeline_foreground,
};
use super::hooks::{HookAnnouncer, prepare_selected, sourced_steps_to_foreground};
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
    /// skipping the rest" rule. An absent `project_id` (unresolvable
    /// identifier) drops every project p
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
//! from `ctx.repo.load_project_config()` at invocation; manual hooks pass the
//! loaded configs directly to preparation. Two facts make a re-read safe, and a new
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
    CommandContext, FailureStrategy, ForegroundStep, PipelineKind, alias_error_wrapper,
    execute_pipeline_foreground, hook_error_wrapper, prepare_steps,
};
use super::hook_announcement::{SourcedStep, format_pipeline_summary};
use crate::commands::process::{HookLog, spawn_detached_exec};
use crate::output::DirectivePassthrough;

use super::hook_filter::{ParsedFilter, selected_hook_configs};
use worktrunk::config::HookSource;

/// Prepare hook steps from both user and project configs, preserving pipeline
/// structure, and verify any name filter matched at least one command.
/// Returns the steps (possibly empty if no hooks are configured).
///
/// Collects steps from user config first, then project config, applying the
/// name filter to individual commands within each step. The filter supports
/// source prefixes: `user:foo` or `project:foo` to run only from one source.
///
/// Shared by foreground, background registration, and dry-run so each path
/// produces the same "no commands matched" error when a filter mismatches.
pub(crate) fn prepare_and_check(
    ctx: &CommandContext,
    user_config: Option<&CommandConfig>,
    project_config: Option<&CommandConfig>,
    hook_type: HookType,
    extra_vars: &[(&str, &str)],
    name_filters: &[String],
) -> anyhow::Result<Vec<SourcedStep>> {
    let selected = selected_hook_configs(user_config, project_config, name_filters);
    let result = prepare_selected(&selected, ctx, extra_vars, hook_type)?;

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

/// Prepare frozen source/config selections without reading configuration.
pub(crate) fn prepare_selected(
    entries: &[(HookSource, CommandConfig)],
    ctx: &CommandContext<'_>,
    extra_vars: &[(&str, &str)],
    hook_type: HookType,
) -> anyhow::Result<Vec<SourcedStep>> {
    let mut out = Vec::new();
    for (source, config) in entries {
        let steps = prepare_steps(config, ctx, extra_vars, hook_type, *source)?.validated()?;
        out.extend(steps.into_iter().map(|step| SourcedStep {
            step,
            source: *source,
        }));
    }
    Ok(out)
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
    // so a mixed list falls through to `HookCommandNotFound`, which lists what
    // is available across the scopes the filters named.
    let all_bare = parsed_filters.iter().all(|f| f.name.is_empty());
    if let Some(source) = all_bare
        .then(|| {
            parsed_filters
                .iter()
                .filter_map(|f| f.source)
                .find(|source| !configured(*source))
        })
        .flatten()
    {
        let other = match source {
            HookSource::User => HookSource::Project,
            HookSource::Project => HookSource::User,
        };
        return worktrunk::git::GitError::HookSourceNotConfigured {
            source: source.to_string(),
            hook_type,
            other_source: configured(other).then(|| other.to_string()),
        }
        .into();
    }

    let mut available = Vec::new();

    let sources = [
        (HookSource::User, user_config),
        (HookSource::Project, project_config),
    ];
    for (source, config) in sources {
        let Some(config) = config else { continue };
        // Include this source if any filter matches it
        if !parsed_filters.iter().any(|f| f.matches_source(source)) {
            continue;
        }
        available.extend(config.commands().filter_map(|c| {
            c.name
                .as_deref()
             
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

### Incident Patch 1: `eb231c18` (2026-11-07)
**Commit Message**: ci: stop fast-checks saving the shared Linux rust cache (#4724)

On main, `fast-checks` and `test (linux)` both save the
`v1-rust-shared-Linux-x64-*` rust cache. When the key changes (a
`Cargo.lock` or toolchain change), `fast-checks` finishes minutes
earlier and reserves the key with a cache built only for lockfile,
doctest, and rustdoc. `test (linux)` then fails to save, and later Linux
runs restore that partial cache until the key changes again. This PR
passes `save-cache: "false"` to `fast-checks`, as `collect-affected`,
`affected-tests`, and `release-target` already do, so `test` stays the
only job that saves the cache, as the `test-setup` input description
says.

Two recent main runs show the race:

-
[41815243371](https://github.com/max-sixty/worktrunk/actions/runs/41815243371):
`fast-checks` started `Saving cache` at 10:37:15. `test (linux)` reached
its save at 10:44:25 and got `Failed to save: Unable to reserve cache
with key v1-rust-shared-Linux-x64-867d58cd-d69464dc, another job may be
creating this cache.`
-
[41832227759](https://github.com/max-sixty/worktrunk/actions/runs/41832227759):
the same thing happened with key `…-659612d8`.

When the key is unchanged, every job

**File**: `.github/actions/test-setup/action.yaml` (modified, +6/-4)
```diff
@@ -9,10 +9,12 @@ inputs:
     description: >-
       Whether this job may save the shared rust cache (and then only on main).
       `test` is the canonical saver and leaves this at the default; everyone
-      else (collect-affected, affected-tests, release-target) passes 'false' so
-      they restore main's cache but never write — keeps instrumented
-      (collect-affected) and cross-compiled (release-target) artifacts out of
-      the shared cache, and stops PR runs depositing single-use caches.
+      else (fast-checks, collect-affected, affected-tests, release-target)
+      passes 'false' so they restore main's cache but never write — keeps
+      instrumented (collect-affected) and cross-compiled (release-target)
+      artifacts out of the shared cache, stops a faster job (fast-checks)
+      winning the save race with a partial build, and stops PR runs
+      depositing single-use caches.
     default: "true"
 
 runs:
```

**File**: `.github/workflows/ci.yaml` (modified, +5/-0)
```diff
@@ -159,6 +159,11 @@ jobs:
       uses: actions/checkout@v7
 
     - uses: ./.github/actions/test-setup
+      with:
+        # Restore-only: this job finishes minutes before `test (linux)`, so
+        # when the cache key changes it would win the save race with a cache
+        # missing the nextest build, and `test` could no longer reserve the key.
+        save-cache: "false"
 
     - name: Install wt
       uses: baptiste0928/cargo-install@v3
```

---

### Incident Patch 2: `1a406817` (2026-11-06)
**Commit Message**: fix(docs): restore 48px favicon and apple-touch-icon links (#4719)

The Astro rebuild (#3866) moved `favicon-48.png` and
`apple-touch-icon.png` into `docs/public/` but dropped the `<link>` tags
that #627 had added to the old Zola base template. Since then every page
emits only `<link rel="shortcut icon" href="/favicon.png">` (32×32).
This PR adds the two links back through Starlight's `head` option, so
the larger icons are discoverable again.

This restores metadata. It doesn't fix the generic globe in Google
Search (#4718), because nothing establishes the cause. [Google's favicon
guidance](https://developers.google.com/search/docs/appearance/favicon-in-search)
accepts a square icon of at least 8×8 and supports `shortcut icon`, so
the existing 32×32 icon is not inherently ineligible. Advertising a
48×48 icon follows Google's recommendation for a larger size, but
whether it changes the search result is unverified.

A new `built-site.test.mjs` case requires both links on every rendered
page, so they can't drop out silently again. It fails on the current
build and passes with this change. `npm run check`, `npm test`, and the
rest of `test:site` pass locally. The exception is the exist

**File**: `docs/astro.config.mjs` (modified, +12/-0)
```diff
@@ -41,6 +41,18 @@ export default defineConfig({
       description: 'Git worktree management for parallel AI agent workflows.',
       disable404Route: true,
       favicon: '/favicon.png',
+      head: [
+        // Restores the icon links the Zola site carried (#627); `favicon` above
+        // emits only the 32x32 shortcut icon.
+        {
+          tag: 'link',
+          attrs: { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon-48.png' },
+        },
+        {
+          tag: 'link',
+          attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
+        },
+      ],
       logo: {
         src: './public/logo.png',
         alt: 'Worktrunk',
```

**File**: `docs/tests/built-site.test.mjs` (modified, +18/-0)
```diff
@@ -345,6 +345,24 @@ test('every command reference receives semantic syntax roles', async () => {
   assert.equal(frameCount, headingCount, 'some command references remain plain code blocks');
 });
 
+test('built pages link the 48px favicon and apple-touch-icon', async () => {
+  // Starlight's `favicon` option links only favicon.png, so these icon files in
+  // docs/public/ stay reachable only through the `head` entries.
+  for (const page of renderedPages) {
+    const html = await readFile(page, 'utf8');
+    assert.match(
+      html,
+      /<link rel="icon" type="image\/png" sizes="48x48" href="\/favicon-48\.png"\/?>/,
+      `${page} lacks a 48x48 favicon link`,
+    );
+    assert.match(
+      html,
+      /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"\/?>/,
+      `${page} lacks an apple-touch-icon link`,
+    );
+  }
+});
+
 test('built pages only reference emitted local assets', async () => {
   const files = new Set(await allFiles());
 
```

---

### Incident Patch 3: `c45a2f63` (2026-11-07)
**Commit Message**: fix(switch): use a GitHub PR URL's host for gh api (#4722)

`wt switch https://host/owner/repo/pull/N` asked `gh api` with no
`--hostname`, so the lookup went to gh's default host. An Enterprise URL
then 404'd when the git remote was github.com, even though gh was logged
in on the URL's host.

When `forge.hostname` is unset, the `/pull/N` URL's host is now passed
as `--hostname` if `gh auth token` succeeds for it. `pr:N` still follows
the remote, and the 404 hint is unchanged.

Checked with the new switch cases (logged in and not), the existing
enterprise-remote regression, the URL-host unit test, `cargo test
--doc`, and `cargo clippy --all-targets --all-features -- -D warnings`.

Refs #4709

**File**: `src/commands/worktree/switch.rs` (modified, +17/-13)
```diff
@@ -290,12 +290,13 @@ fn fetch_ref_info(
     forge: ForgeKind,
     number: u32,
     repo: &Repository,
+    url_host: Option<&str>,
 ) -> anyhow::Result<RemoteRefInfo> {
     let _watchdog = worktrunk::progress::Watchdog::start(
         &format!("the {} lookup", forge.ref_type().name()),
         None,
     );
-    remote_ref::fetch_info(forge, number, repo)
+    remote_ref::fetch_info(forge, number, repo, url_host)
 }
 
 /// Resolve a remote ref (PR or MR) through the selected forge.
@@ -304,6 +305,7 @@ fn resolve_remote_ref(
     forge: ForgeKind,
     number: u32,
     create: bool,
+    url_host: Option<&str>,
 ) -> anyhow::Result<ResolvedTarget> {
     let ref_type = forge.ref_type();
     let symbol = ref_type.symbol();
@@ -314,7 +316,7 @@ fn resolve_remote_ref(
         progress_message(cformat!("Fetching {} {symbol}{number}...", ref_type.name()))
     );
 
-    let info = fetch_ref_info(forge, number, repo)?;
+    let info = fetch_ref_info(forge, number, repo, url_host)?;
 
     // Display context with URL (as gutter under fetch progress)
     eprintln!("{}", format_with_gutter(&format_ref_context(&info), None));
@@ -537,20 +539,21 @@ fn fetch_same_repo_branch(repo: &Repository, info: &RemoteRefInfo) -> anyhow::Re
 /// `https://github.com/owner/repo/pull/123`) into the same literal shortcut so
 /// both forms flow through one dispatch. Returns `None` for a regular branch
 /// name, which callers resolve as an ordinary ref.
-fn parse_ref_shortcut(input: &str) -> Option<(RefType, u32)> {
+fn parse_ref_shortcut(input: &str) -> Option<(RefType, u32, Option<String>)> {
     let normalised = parse_ref_url(input);
-    let input = normalised.as_deref().unwrap_or(input);
-    if let Some(number) = input
+    let shortcut = normalised.as_deref().unwrap_or(input);
+    if let Some(number) = shortcut
         .strip_prefix("pr:")
         .and_then(|s| s.parse::<u32>().ok())
     {
-        return Some((RefType::Pr, number));
+        // Only a GitHub `/pull/N` URL names a host; literal `pr:N` doesn't.
+        return Some((RefType::Pr, number, remote_ref::github_pull_url_host(input)));
     }
-    if let Some(number) = input
+    if let Some(number) = shortcut
         .strip_prefix("mr:")
         .and_then(|s| s.parse::<u32>().ok())
     {
-        return Some((RefType::Mr, number));
+        return Some((RefType::Mr, number, None));
     }
     None
 }
@@ -575,12 +578,12 @@ fn resolve_base_ref(
     repo: &Repository,
     base: &str,
 ) -> anyhow::Result<(String, Option<(String, String)>)> {
-    if let Some((ref_type, number)) = parse_ref_shortcut(base) {
+    if let Some((ref_type, number, url_host)) = parse_ref_shortcut(base) {
         let forge = match ref_type {
             RefType::Pr => choose_pr_forge(repo)?,
             RefType::Mr => ForgeKind::GitLab,
         };
-        return resolve_remote_ref_as_base(repo, forge, number);
+        return resolve_remote_ref_as_base(repo, forge, number, url_host.as_deref());
     }
 
     let selector = repo.expand_selector(base)?;
@@ -612,6 +615,7 @@ fn resolve_remote_ref_as_base(
     repo: &Repository,
     forge: ForgeKind,
     number: u32,
+    url_host: Option<&str>,
 ) -> anyhow::Result<(String, Option<(String, String)>)> {
     let ref_type = forge.ref_type();
     let symbol = ref_type.symbol();
@@ -624,7 +628,7 @@ fn resolve_remote_ref_as_base(
         ))
     );
 
-    let info = fetch_ref_info(forge, number, repo)?;
+    let info = fetch_ref_info(forge, number, repo, url_host)?;
     eprintln!("{}", format_with_gutter(&format_ref_context(&info), None));
 
     if !info.is_cross_repo {
@@ -676,7 +680,7 @@ fn resolve_ref_shortcut_target(
 ) -> anyhow::Result<Option<ResolvedTarget>> {
     // `pr:N` dispatches to GitHub, Gitea, or Azure DevOps based on remotes;
     // `mr:N` to GitLab. Forge PR/MR web URLs normalise to the same shortcuts.
-    let Some((ref_type, number)) = parse_ref_shortcut(branch) else {
+    let Some((ref_type, number, url_host)) = parse_ref_shortcut(branch) else {
         return Ok(None);
     };
     // Fail closed on a malformed project config before choosing a forge:
@@ -694,7 +698,7 @@ fn resolve_ref_shortcut_target(
         RefType::Pr => choose_pr_forge(repo)?,
         RefType::Mr => ForgeKind::GitLab,
     };
-    resolve_remote_ref(repo, forge, number, create).map(Some)
+    resolve_remote_ref(repo, forge, number, create, url_host.as_deref()).map(Some)
 }
 
 /// Decide how a new worktree for `branch` gets created, validating
```

**File**: `src/git/remote_ref/github.rs` (modified, +28/-8)
```diff
@@ -81,7 +81,11 @@ fn gh_default_repo(repo_root: &Path) -> Option<(String, String)> {
 }
 
 /// Fetch PR information from GitHub using the `gh` CLI.
-pub(super) fn fetch_pr_info(pr_number: u32, repo: &Repository) -> anyhow::Result<RemoteRefInfo> {
+pub(super) fn fetch_pr_info(
+    pr_number: u32,
+    repo: &Repository,
+    url_host: Option<&str>,
+) -> anyhow::Result<RemoteRefInfo> {
     let repo_root = repo.repo_path()?;
 
     // Determine which owner/repo to query. Prefer gh's default repo
@@ -109,14 +113,16 @@ pub(super) fn fetch_pr_info(pr_number: u32, repo: &Repository) -> anyhow::Result
 
     // `gh api` doesn't infer the host from the repository: without
     // `--hostname` it asks gh's default host, which is github.com once several
-    // hosts are logged in. A configured `forge.hostname` wins; otherwise a
-    // GitHub Enterprise remote's host is the API host when gh holds a login
-    // for it. An SSH alias (`git@github-personal:…`) has no login, so it keeps
-    // gh's default (#1790).
+    // hosts are logged in. A configured `forge.hostname` wins. Otherwise a
+    // non-github.com host in a `/pull/N` URL the user passed wins when gh is
+    // logged in there (#4709), then a GitHub Enterprise remote's host. An SSH alias
+    // (`git@github-personal:…`) has no login, so it keeps gh's default (#1790).
     let hostname = repo.forge_hostname().or_else(|| {
-        repo.forge_remote_parsed_url(|u| u.is_github())
-            .map(|u| u.host().to_string())
-            .filter(|host| !host.eq_ignore_ascii_case("github.com") && is_authed_for(host))
+        authed_enterprise_host(url_host).or_else(|| {
+            repo.forge_remote_parsed_url(|u| u.is_github())
+                .map(|u| u.host().to_string())
+                .and_then(|host| authed_enterprise_host(Some(&host)))
+        })
     });
 
     let mut args = vec!["api", api_path.as_str()];
@@ -224,6 +230,20 @@ fn use_ssh_protocol(host: &str) -> bool {
     cli_config_value("gh", &["git_protocol", "--host", host]).as_deref() == Some("ssh")
 }
 
+/// Enterprise host to pass as `gh api --hostname`, when gh is logged in there.
+///
+/// `github.com` is the no-flag default once more than one host is logged in,
+/// so naming it would only repeat that path. No login reads as `None` and the
+/// caller tries the next candidate.
+fn authed_enterprise_host(host: Option<&str>) -> Option<String> {
+    let host = host?;
+    if host.eq_ignore_ascii_case("github.com") || !is_authed_for(host) {
+        None
+    } else {
+        Some(host.to_string())
+    }
+}
+
 /// Whether `gh` has an authentication token configured for `host`.
 ///
 /// `gh auth token --hostname <host>` reads from `~/.config/gh/hosts.yml`, the
```

**File**: `src/git/remote_ref/mod.rs` (modified, +46/-2)
```diff
@@ -16,7 +16,7 @@
 //! use worktrunk::git::{ForgeKind, remote_ref};
 //! # fn example() -> Result<(), Box<dyn std::error::Error>> {
 //! let repo = Repository::at(".")?;
-//! let info = remote_ref::fetch_info(ForgeKind::GitHub, 123, &repo)?;
+//! let info = remote_ref::fetch_info(ForgeKind::GitHub, 123, &repo, None)?;
 //! println!("PR #{}: {}", info.number, info.title);
 //! # Ok(())
 //! # }
@@ -105,15 +105,30 @@ pub fn fetch_info(
     forge: ForgeKind,
     number: u32,
     repo: &Repository,
+    url_host: Option<&str>,
 ) -> anyhow::Result<RemoteRefInfo> {
     match forge {
-        ForgeKind::GitHub => github::fetch_pr_info(number, repo),
+        // A GitHub `/pull/N` URL names its host. `pr:N` has none (`url_host` is
+        // `None`) and keeps the remote-host lookup.
+        ForgeKind::GitHub => github::fetch_pr_info(number, repo, url_host),
         ForgeKind::GitLab => gitlab::fetch_mr_info(number, repo),
         ForgeKind::Gitea => gitea::fetch_pr_info(number, repo),
         ForgeKind::AzureDevOps => azure::fetch_pr_info(number, repo),
     }
 }
 
+/// Host named by a GitHub `/pull/N` web URL.
+///
+/// Literal `pr:N` and the other forges' URL shapes (`/pulls/`, `/pullrequest/`,
+/// `/-/merge_requests/`) return `None`. A port in the authority is kept.
+pub fn github_pull_url_host(input: &str) -> Option<String> {
+    let parts = parse_ref_url_parts(input)?;
+    if parts.segments.get(parts.marker_index).copied() != Some("pull") {
+        return None;
+    }
+    authority_host(parts.segments.first().copied()?).map(str::to_string)
+}
+
 /// Whether `forge`'s CLI holds a login for `host`.
 ///
 /// Each CLI answers from its own local state, so the answer needs no network
@@ -628,6 +643,35 @@ mod tests {
         );
     }
 
+    #[test]
+    fn github_pull_url_host_keeps_only_github_pull_urls() {
+        assert_eq!(
+            github_pull_url_host("https://github.example.com/acme/app/pull/62").as_deref(),
+            Some("github.example.com")
+        );
+        assert_eq!(
+            github_pull_url_host("https://github.com/owner/repo/pull/123/files").as_deref(),
+            Some("github.com")
+        );
+        assert_eq!(
+            github_pull_url_host("https://ghe.acme.internal/acme/app/pull/7").as_deref(),
+            Some("ghe.acme.internal")
+        );
+        assert_eq!(github_pull_url_host("pr:62"), None);
+        assert_eq!(
+            github_pull_url_host("https://codeberg.org/owner/repo/pulls/55"),
+            None
+        );
+        assert_eq!(
+            github_pull_url_host("https://gitlab.com/group/repo/-/merge_requests/42"),
+            None
+        );
+        assert_eq!(
+            github_pull_url_host("https://dev.azure.com/org/project/_git/repo/pullrequest/9"),
+            None
+        );
+    }
+
     #[test]
     fn parse_ref_url_gitea() {
         // Gitea / Codeberg use /pulls/N rather than GitHub's /pull/N.
```

**File**: `tests/integration_tests/switch.rs` (modified, +21/-12)
```diff
@@ -6575,15 +6575,24 @@ fn test_switch_pr_self_hosted_defaults_to_github(
     }
 }
 
-/// A GitHub Enterprise remote with no `forge.hostname`: `gh api` sends a
-/// request without `--hostname` to gh's default host, so the PR lookup must
-/// name the remote's host when gh holds a login for it, and leave gh's default
-/// alone when it doesn't (an SSH alias such as `github-personal`, #1790).
-#[rstest]
-#[case::authed_host(true)]
-#[case::unauthed_host(false)]
-fn test_switch_pr_enterprise_remote_passes_hostname(
+const GHE_REMOTE: &str = "https://github.example.com/owner/test-repo.git";
+const ALIAS_REMOTE: &str = "git@github-work:owner/test-repo.git";
+const GHE_PR_URL: &str = "https://github.example.com/owner/test-repo/pull/101";
+
+/// With no `forge.hostname`, `gh api` sends a request without `--hostname` to
+/// gh's default host. The PR lookup names a host only when gh holds a login
+/// for it: the host in a `/pull/N` URL first (#4709), then a GitHub Enterprise
+/// remote's host. An SSH alias (`github-work`, #1790) has no login; the alias
+/// cases pass only if the URL host is tried before the remote host.
+#[rstest]
+#[case::authed_remote_host(GHE_REMOTE, "pr:101", true)]
+#[case::unauthed_remote_host(GHE_REMOTE, "pr:101", false)]
+#[case::authed_url_host_over_alias_remote(ALIAS_REMOTE, GHE_PR_URL, true)]
+#[case::unauthed_url_host(ALIAS_REMOTE, GHE_PR_URL, false)]
+fn test_switch_pr_enterprise_passes_hostname(
     #[from(repo_with_remote)] mut repo: TestRepo,
+    #[case] origin_url: &str,
+    #[case] switch_arg: &str,
     #[case] gh_authed: bool,
 ) {
     repo.add_worktree("feature-auth");
@@ -6599,9 +6608,8 @@ fn test_switch_pr_enterprise_remote_passes_hostname(
     )
     .trim()
     .to_string();
-    let ghe_url = "https://github.example.com/owner/test-repo.git";
-    repo.run_git(&["remote", "set-url", "origin", ghe_url]);
-    repo.run_git(&["config", &format!("url.{bare_url}.insteadOf"), ghe_url]);
+    repo.run_git(&["remote", "set-url", "origin", origin_url]);
+    repo.run_git(&["config", &format!("url.{bare_url}.insteadOf"), origin_url]);
 
     let gh_response = r#"{
         "title": "Enterprise PR",
@@ -6623,6 +6631,7 @@ fn test_switch_pr_enterprise_remote_passes_hostname(
     fs::write(mock_bin.join("pr_response.json"), gh_response).unwrap();
     let mut gh = MockConfig::new("gh").command("api", MockResponse::file("pr_response.json"));
     if gh_authed {
+        // Answers for any host, so the alias cases check host precedence.
         gh = gh.command("auth token --hostname", MockResponse::output("gho_mock"));
     }
     gh.command("_default", MockResponse::exit(1))
@@ -6632,7 +6641,7 @@ fn test_switch_pr_enterprise_remote_passes_hostname(
     let mut cmd = repo.wt_command();
     configure_mock_cli_env(&mut cmd, &mock_bin);
     let output = cmd
-        .args(["switch", "pr:101"])
+        .args(["switch", switch_arg])
         .env("WORKTRUNK_TEST_MOCK_CALL_LOG_DIR", call_log.path())
         .output()
         .unwrap();
```

#### Recent Merged Pull Requests:
- **PR #4725** (2026-11-07): skills(writing-user-outputs): fold a second suggestion into the existing hint (@worktrunk-bot)
- **PR #4724** (2026-11-07): ci: stop fast-checks saving the shared Linux rust cache (@worktrunk-bot)
- **PR #4722** (2026-11-07): fix(switch): use a GitHub PR URL's host for gh api (@anqorithm)
- **PR #4721** (2026-11-06): fix(completion): filter PowerShell completions by prefix (@Bortlesboat)
- **PR #4720** (closed): docs(readme): add pt-BR and es translations (@Cabreira97)
- **PR #4719** (2026-11-06): fix(docs): restore 48px favicon and apple-touch-icon links (@worktrunk-bot)

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

## X. ci: stop fast-checks saving the shared Linux rust cache (#4724)

**RULE**:
When implementing operations in `.github/actions/test-setup/action.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in max-sixty/worktrunk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eb231c18`: ci: stop fast-checks saving the shared Linux rust cache (#4724). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/actions/test-setup/action.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      else (fast-checks, collect-affected, affected-tests, release-target)
      passes 'false' so they restore main's cache but never write — keeps
      instrumented (collect-affected) and cross-compiled (release-target)
      artifacts out of the shared cache, stops a faster job (fast-checks)
      winning the save race with a partial build, and stops PR runs
      depositing single-use caches.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
      else (collect-affected, affected-tests, release-target) passes 'false' so
      they restore main's cache but never write — keeps instrumented
      (collect-affected) and cross-compiled (release-target) artifacts out of
      the shared cache, and stops PR runs depositing single-use caches.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eb231c18` are properly handled with clean fallback behavior.
