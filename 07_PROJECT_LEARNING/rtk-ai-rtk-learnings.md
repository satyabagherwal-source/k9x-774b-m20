# Forensic Learning Record (Deep Inspection): rtk-ai/rtk

> **Canonical Artifact**: `07_PROJECT_LEARNING/rtk-ai-rtk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:07:34.679Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rtk-ai/rtk`
- **Description**: CLI proxy that reduces LLM token consumption by 60-90% on common dev commands. Single Rust binary, zero dependencies
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 82435 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `hooks/hermes/rtk-rewrite/__init__.py`
```
"""Hermes plugin adapter for RTK command rewriting.

All rewrite logic lives in RTK's Rust ``rtk rewrite`` command; this module
only bridges Hermes ``pre_tool_call`` payloads to that command and fails open.
"""

import shutil
import subprocess
import sys


ACCEPTED_REWRITE_RETURN_CODES = {0, 3}
EXPECTED_PASSTHROUGH_RETURN_CODES = {1, 2}
_rtk_available = None
_rtk_missing_warned = False


def register(ctx):
    """Register the Hermes pre-tool callback."""
    if not _check_rtk():
        return

    ctx.register_hook("pre_tool_call", _pre_tool_call)


def _check_rtk():
    """Return whether the rtk binary is in PATH, warning once when missing."""
    global _rtk_available, _rtk_missing_warned

    if _rtk_available is None:
        _rtk_available = shutil.which("rtk") is not None

    if not _rtk_available and not _rtk_missing_warned:
        _warn("rtk binary not found in PATH; Hermes hook not registered")
        _rtk_missing_warned = True

    return _rtk_available


def _pre_tool_call(tool_name=None, args=None, **_kwargs):
    """Rewrite mutable Hermes terminal command args when RTK provides a change."""
    try:
        if tool_name != "terminal" or not isinstance(args, dict):
            return

        command = args.get("command")
        if not isinstance(command, str) or not command.strip():
            return

        try:
            result = subprocess.run(
                ["rtk", "rewrite", command],
                shell=False,
                timeout=2,
                capture_output=True,
                text=True,
            )
        except subprocess.TimeoutExpired:
            _warn("rtk rewrite timed out")
            return

        if result.returncode not in ACCEPTED_REWRITE_RETURN_CODES:
            if result.returncode not in EXPECTED_PASSTHROUGH_RETURN_CODES:
                details = f"rtk rewrite failed with exit {result.returncode}"
                stderr = result.stderr.strip()
                if stderr:
                    details = f"{details}: {stderr}"
                _warn(details)
            return

        rewritten = result.stdout.strip()
        if rewritten and rewritten != command:
            args["command"] = rewritten
    except Exception as e:
        _warn(str(e))
        return


def _warn(message):
    print(f"rtk: hermes plugin warning: {message}", file=sys.stderr)

```

### Core Architecture Module: `hooks/opencode/rtk.ts`
```
import type { Plugin } from "@opencode-ai/plugin"

// RTK OpenCode plugin — rewrites commands to use rtk for token savings.
// Requires: an rtk with the `rtk hook opencode` subcommand (newer than
// v0.51). An older rtk answers nothing, so commands pass through unrewritten
// rather than breaking.
//
// This is a thin delegating plugin: all rewrite and permission logic lives
// in `rtk hook opencode`, which is the single source of truth
// (src/discover/registry.rs). It judges the command against OpenCode's own
// permission rules and answers `{}` whenever the rewrite would change what
// those rules decide — OpenCode evaluates the final command itself, so a
// rewrite RTK does return never lifts a deny, silences an ask, or blocks an
// allow. To add or change rewrite rules, edit the Rust registry — not this
// file.

type Answer = { command?: string }

export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
  try {
    await $`which rtk`.quiet()
  } catch {
    console.warn("[rtk] rtk binary not found in PATH — plugin disabled")
    return {}
  }

  return {
    "tool.execute.before": async (input, output) => {
      const tool = String(input?.tool ?? "").toLowerCase()
      if (tool !== "bash" && tool !== "shell") return
      const args = output?.args
      if (!args || typeof args !== "object") return

      const command = (args as Record<string, unknown>).command
      if (typeof command !== "string" || !command) return

      try {
        const result = await $`rtk hook opencode ${command}`.quiet().nothrow()
        const answer = JSON.parse(String(result.stdout).trim() || "{}") as Answer
        if (answer.command && answer.command !== command) {
          ;(args as Record<string, unknown>).command = answer.command
        }
      } catch {
        // rtk hook opencode failed or answered nothing — pass through unchanged
      }
    },
  }
}

```

### Core Architecture Module: `hooks/pi/rtk.ts`
```
// RTK Pi extension — rewrites bash commands to use rtk for token savings.
// Shared with Oh My Pi (OMP) — OMP loads this same file via its legacy-pi-compat layer.
// Requires: rtk >= 0.23.0 in PATH.
//
// This is a thin delegating extension: all rewrite logic lives in `rtk rewrite`,
// which is the single source of truth (src/discover/registry.rs).
// To add or change rewrite rules, edit the Rust registry — not this file.
//
// Exit code contract for `rtk rewrite`:
//   0 + stdout  Rewrite found → mutate command
//   1           No RTK equivalent → pass through unchanged
//   3 + stdout  Rewrite (advisory) → mutate command

import type {
  BashToolCallEvent,
  ExtensionAPI,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent"

const REWRITE_TIMEOUT_MS = 2_000
const MIN_SUPPORTED_RTK_MINOR = 23

// Local reimplementation of the package's `isToolCallEventType("bash", event)` type
// guard. That helper is a value export, so importing it pulls in the whole
// `@earendil-works/pi-coding-agent` barrel at extension load — profiled at ~250ms
// warmed, vs ~10ms for a type-only import. `BashToolCallEvent`/`ToolCallEvent`
// below are type-only imports and are erased at compile time, so they carry none
// of that cost. See #2753.
function isBashToolCallEvent(event: ToolCallEvent): event is BashToolCallEvent {
  return event.toolName === "bash"
}

// Parse "X.Y.Z" semver, return [major, minor, patch] or null.
function parseSemver(raw: string): [number, number, number] | null {
  const m = raw.trim().match(/(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
}

// Calls `rtk rewrite`; returns the rewritten command or null (pass through).
async function rewriteCommand(
  pi: ExtensionAPI,
  cmd: string,
  signal?: AbortSignal
): Promise<string | null> {
  const result = await pi.exec("rtk", ["rewrite", cmd], {
    timeout: REWRITE_TIMEOUT_MS,
    signal,
  })
  if (result.killed) return null
  if (result.code !== 0 && result.code !== 3) return null
  return result.stdout.trim() || null
}

type StatusContext = {
  ui?: {
    setStatus?: (key: string, text: string) => void
  }
}

// Register before the async version probe so a host cannot miss the handler
// while the probe is in flight. If session_start happens first, retain its
// context and apply the status as soon as the probe reports a failure.
// pi.notify is intentionally not used — OMP wipes it on the initial render.
function registerRtkUnavailableNotice(pi: ExtensionAPI) {
  let reason: string | undefined
  let sessionContext: StatusContext | undefined

  const applyStatus = () => {
    if (!reason || !sessionContext) return
    try {
      sessionContext.ui?.setStatus?.("rtk", `RTK disabled: ${reason}`)
    } catch {
      // Status reporting must never affect the extension's fail-open behavior.
    }
  }

  try {
    pi.on("session_start", (_event: unknown, ctx: unknown) => {
      sessionContext = ctx as StatusContext
      applyStatus()
    })
  } catch {
    // Runtimes without a session_start event: nothing to report.
    return (_reason: string) => {}
  }

  return (nextReason: string) => {
    reason = nextReason
    applyStatus()
  }
}

export default async function (pi: ExtensionAPI) {
  const reportRtkUnavailable = registerRtkUnavailableNotice(pi)

  // Probe rtk version at load time; disables extension if missing or too old.
  const ver = await pi.exec("rtk", ["--version"], { timeout: REWRITE_TIMEOUT_MS })
  if (ver.code !== 0) {
    reportRtkUnavailable("rtk binary not found in PATH")
    console.warn("[rtk] rtk binary not found in PATH — extension disabled")
    return
  }

  // Warn and bail if rtk predates 0.23.0 (when `rtk rewrite` was introduced).
  const parsed = parseSemver(ver.stdout.replace(/^rtk\s+/, ""))
  if (parsed) {
    const [major, minor] = parsed
    if (major === 0 && minor < MIN_SUPPORTED_RTK_MINOR) {
      reportRtkUnavailable(`rtk ${parsed.join(".")} is too old (need >= 0.23.0)`)
      console.warn(`[rtk] rtk ${ver.stdout.trim()} is too old (need >= 0.23.0) — extension disabled`)
      return
    }
  }

  pi.on("tool_call", async (event, ctx) => {
    try {
      if (!isBashToolCallEvent(event)) return

      const cmd = event.input.command
      if (typeof cmd !== "string" || cmd.trim() === "") return

      if (cmd.startsWith("rtk ")) return
      if (process.env.RTK_DISABLED === "1") return

      // Delegate to RTK.
      const rewritten = await rewriteCommand(pi, cmd, ctx.signal)
      if (rewritten && rewritten !== cmd) {
        event.input.command = rewritten
      }
    } catch (err) {
      // Fail open: never block execution on an unexpected error.
      console.warn("[rtk] unexpected error in tool_call handler; passing through command", err)
      return
    }
  })
}

```

### Core Architecture Module: `src/cmds/php/utils.rs`
```
use crate::core::utils::{composer_tool_paths, resolve_binary, resolved_command};
use regex::Regex;
use std::path::Path;
use std::process::Command;
use std::sync::LazyLock;

static ANSI_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\x1b\[[0-9;]*[A-Za-z]").unwrap());
static CONTROL_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]").unwrap());

pub fn php_tool_command(tool: &str) -> Command {
    for local_tool in composer_tool_paths(tool) {
        let local_tool_name = local_tool.to_string_lossy().into_owned();
        // Route through resolved_command (the sanctioned constructor) rather than
        // a raw dynamic command constructor, so the binary still resolves
        // PATHEXT-aware on Windows and the security scan's no-dynamic-exec rule holds.
        if resolve_binary(&local_tool_name).is_ok() || local_tool.exists() {
            return resolved_command(&local_tool_name);
        }
    }

    resolved_command(tool)
}

fn composer_tool_exists(tool: &str) -> bool {
    composer_tool_paths(tool).into_iter().any(|local_tool| {
        let local_tool_name = local_tool.to_string_lossy().into_owned();
        resolve_binary(&local_tool_name).is_ok() || local_tool.exists()
    })
}

pub fn strip_ansi_and_controls(input: &str) -> String {
    let no_ansi = ANSI_RE.replace_all(input, "");
    CONTROL_RE.replace_all(&no_ansi, "").to_string()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhpTestRunner {
    Pest,
    Phpunit,
    Unknown,
}

pub fn detect_php_test_runner() -> PhpTestRunner {
    // Pest's canonical marker is the `vendor/bin/pest` binary (composer dep).
    // There is no root `pest.php` file — Pest's bootstrap lives at `tests/Pest.php`
    // — so a root-level `pest.php` check both never matches Pest and false-positives
    // on unrelated utility files in PHPUnit-only projects.
    if composer_tool_exists("pest") {
        return PhpTestRunner::Pest;
    }

    if composer_tool_exists("phpunit")
        || Path::new("phpunit.xml").exists()
        || Path::new("phpunit.xml.dist").exists()
    {
        return PhpTestRunner::Phpunit;
    }

    PhpTestRunner::Unknown
}

```

### Core Architecture Module: `src/core/arg_tokenizer.rs`
```
//! Shared tokenizer for re-classifying an already-`--`-restored passthrough args slice
//! (see [`crate::core::args_utils::restore_double_dash`]) into flags, their values, and
//! positionals, matching the GNU/POSIX-ish conventions used by git, cargo, rg, and friends.
//! Callers keep their own list of which flags take a value (inherently per-tool) and pass it in
//! as a predicate instead of reimplementing the token-walking around it.
//!
//! Not merged with `restore_double_dash`: `Token<'a>` borrows straight from `args`, so
//! tokenizing an owned `Vec<String>` built *inside* this module would tie every `Token` to a
//! value dropped when the function returns.

/// What kind of unit a [`Token`] represents.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenKind {
    /// The literal `--` separator. Emitted exactly once, for the first `--` encountered. Under
    /// [`Dialect::Posix`] it ends option parsing (everything after is `Positional`); under
    /// [`Dialect::Msbuild`] it's an argument-*forwarding* boundary instead, so classification
    /// continues normally past it, with only its position recorded.
    DashDash,
    /// `--name` (see `Token::text` for the name, without the leading `--`).
    Long,
    /// A positional/value token — either free-standing or consumed by a preceding `Long`/`Short`
    /// as its separate-token value (see `Token::linked`).
    Positional,
    /// One character of a `-x` / `-xyz` short-option cluster (see `Token::text`, without the
    /// leading `-`). A run of only digits (`-20`) is a widely-used shorthand for a numeric
    /// value in its own right (git log/head/tail's `-N` count) rather than a cluster of
    /// per-digit boolean flags, so it is kept as one `Short` token with the whole digit run as
    /// `text`, never decomposed.
    Short,
}

/// One classified unit of an args slice, as produced by [`tokenize`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Token<'a> {
    pub kind: TokenKind,
    /// Flag name without leading dash(es) for `Long`/`Short`; raw text for `Positional`; empty
    /// for `DashDash`.
    pub text: &'a str,
    /// Value attached directly to this token: `--flag=value`, or the trailing remainder of a
    /// short cluster (`-A3` → `Short` "A" with `attached: Some("3")`).
    pub attached: Option<&'a str>,
    /// For `Long`/`Short`: index into the returned `Vec` of the `Positional` token consumed as
    /// this flag's separate-token value (only set when `takes_value` returned `true` and there
    /// was no attached value). For a consumed `Positional`: index of the flag token that owns
    /// it. `None` for a free-standing positional, an unconsumed flag, or `DashDash`.
    pub linked: Option<usize>,
    /// Index into the original `args` slice this token was produced from. Every `Short` token
    /// from the same `-xyz` cluster shares one `source_index` (they came from one arg); a
    /// consumed separate-token value always has its own, since it's a distinct arg. Lets a
    /// caller that needs to rebuild exact per-arg boundaries (e.g. whether `-r`/`-n` were typed
    /// as one cluster or two separate flags) do so without re-scanning `args` itself.
    pub source_index: usize,
    /// True if a `Long` token was written with a literal `--` prefix, as opposed to `-flag` or
    /// `/flag` under [`Dialect::Msbuild`] (all three tokenize uniformly as `Long` there, but
    /// they are *not* uniformly valid dotnet CLI syntax — see [`has_flag`] vs
    /// [`has_double_dash_flag`]). Always `true` for `Long` under [`Dialect::Posix`] (its `Long`
    /// is always `--`); always `false` for `Short`/`Positional`/`DashDash`.
    pub double_dash: bool,
    /// True for the `/flag` spelling under [`Dialect::Msbuild`], which is MSBuild's own switch
    /// syntax rather than dotnet's CLI syntax -- `/l:` is MSBuild's logger-assembly switch, not
    /// dotnet's `-l`/`--logger`. Always `false` otherwise.
    pub slash: bool,
}

impl<'a> Token<'a> {
    /// This token's value, whether attached (`--flag=value`, `-fvalue`) or consumed as a
    /// separate token (`--flag value`, `-f value`). `None` for a boolean flag, an unrecognized
    /// flag, or a non-flag token. `tokens` must be the same slice `self` came from.
    pub fn value(&self, tokens: &[Token<'a>]) -> Option<&'a str> {
        if self.kind == TokenKind::Positional {
            // `linked` points the other way here -- at the flag that consumed this token, whose
            // *name* is not this token's value.
            return None;
        }
        self.attached.or_else(|| {
            // Indices address the vec this token came from; a caller holding a slice of it
            // (before_dashdash, `tokens[i + 1..]`) would otherwise index out of bounds, and a
            // panic in a filter is the one thing RTK must never do.
            self.linked
                .and_then(|index| tokens.get(index))
                .map(|token| token.text)
        })
    }

    /// True for a genuine free-standing positional: `Positional` kind, not itself consumed as
    /// some preceding flag's separate-token value (`Token::linked`).
    pub fn is_free_positional(&self) -> bool {
        self.kind == TokenKind::Positional && self.linked.is_none()
    }
}

/// True if `text` is a non-empty run of ASCII digits, e.g. a `Short` token's text for `-20`
/// (git/head/tail's `-N` count shorthand — see [`TokenKind::Short`]). Exposed so callers that
/// need to tell "this Short token is a digit-run flag" from "this Short token is a single
/// boolean-flag letter" don't re-derive the same predicate the tokenizer itself already used to
/// decide clustering.
pub fn is_digit_run(text: &str) -> bool {
    !text.is_empty() && text.bytes().all(|b| b.is_ascii_digit())
}

/// True if `text` (a `Long` token's name) matches `name` under `dialect`'s naming rules: exact
/// for [`Dialect::Posix`], ASCII case-insensitive for [`Dialect::Msbuild`] (MSBuild-ecosystem
/// tools fold case broadly, e.g. `/nologo` and `/NoLogo` are equally valid).
fn flag_name_matches(text: &str, name: &str, dialect: Dialect) -> bool {
    match dialect {
        Dialect::Msbuild => text.eq_ignore_ascii_case(name),
        Dialect::Posix => text == name,
    }
}

/// Index into `tokens` of the `--` boundary, if one was emitted (see [`TokenKind::DashDash`]).
/// `tokens[i].source_index` recovers its position in the original args slice, for a caller that
/// needs to insert/compare against raw arg indices rather than the token vec's own index.
pub fn dashdash_index(tokens: &[Token<'_>]) -> Option<usize> {
    tokens.iter().position(|t| t.kind == TokenKind::DashDash)
}

/// The tokens before the `--` boundary, or all of them when there is none. Under
/// [`Dialect::Msbuild`] classification continues past `--` (it forwards arguments rather than
/// ending option parsing), so a lookup for the tool's *own* flags has to slice here first --
/// otherwise it reads what the user forwarded to the test runner as if dotnet had seen it.
pub fn before_dashdash<'t, 'a>(tokens: &'t [Token<'a>]) -> &'t [Token<'a>] {
    match dashdash_index(tokens) {
        Some(index) => &tokens[..index],
        None => tokens,
    }
}

/// Where RTK's own flags have to be spliced into `args`: before the user's `--`, since
/// anything past the boundary is a pathspec or an argument forwarded to another program, not
/// an option the tool will read. `args_len` when there is no boundary.
///
/// Takes the **whole** token vec, never a slice: `dashdash_index` on a slice whose `--` was
/// cut off reports "no boundary" and this returns `args_len`, which would splice RTK's flags
/// past the boundary -- the exact thing it exists to prevent.
pub fn injection_point(tokens: &[Token<'_>], args_len: usize) -> usize {
    dashdash_index(tokens)
        .map(|index| tokens[index].source_index)
        .unwrap_or(args_len)
}

/// True if `tokens` has a `--` boundary at all.
pub fn has_dashdash(tokens: &[Token<'_>]) -> bool {
    dashdash_index(tokens).is_some()
}

/// True if `name` (matched per `dialect`) appears as a `Long` token anywhere in `tokens`. Under
/// `Dialect::Msbuild`, this matches `-flag`/`--flag`/`/flag` uniformly — correct only for
/// legacy MSBuild.exe passthrough switches (`nologo`, `bl`, `v`); see [`has_double_dash_flag`]
/// for anything else.
pub fn has_flag(tokens: &[Token<'_>], dialect: Dialect, name: &str) -> bool {
    tokens
        .iter()
        .any(|t| t.kind == TokenKind::Long && flag_name_matches(t.text, name, dialect))
}

/// Like [`double_dash_flag_value`], but only reports presence, not the value; only matches a
/// token written with a literal `--` prefix (`Token::double_dash`), not `-flag`/`/flag` under
/// [`Dialect::Msbuild`]. Under that dialect, a single-dash or slash spelling of a modern
/// System.CommandLine option (e.g. dotnet's `--logger`) doesn't just get rejected — it gets
/// misparsed as an unrelated legacy MSBuild switch — so use this (not [`has_flag`]) for any
/// option that isn't a genuine legacy MSBuild.exe passthrough switch.
pub fn has_double_dash_flag(tokens: &[Token<'_>], dialect: Dialect, name: &str) -> bool {
    tokens.iter().any(|t| is_double_dash_flag(t, dialect, name))
}

/// This flag's value, if `name` (matched per `dialect`) appears as a `Long` token written with
/// a literal `--` prefix (`Token::double_dash`) anywhere in `tokens`. See
/// [`has_double_dash_flag`] for why this distinction is load-bearing under `Dialect::Msbuild`.
pub fn double_dash_flag_value<'a>(
    tokens: &[Token<'a>],
    dialect: Dialect,
    name: &str,
) -> Option<&'a str> {
    tokens
        .iter()
        .find(|t| is_double_dash_flag(t, dialect, name))
        .and_then(|t| t.value(tokens))
}

/// Every value for `name` (matched per `dialect`), in order, for a `--`-prefixed flag that can
/// legitimately repeat (e.g. dotnet test's `--logger`, usable more than once) — unlike
/// [`double_dash_flag_value`], which only repor
```

### Core Architecture Module: `src/core/args_utils.rs`
```
//! Utility functions for argument handling, particularly for restoring "--" escape
//! arguments that clap consumes during parsing.

/// Restores `--` tokens that clap consumed when using `trailing_var_arg = true`.
///
/// Returns `parsed_args` unchanged when `raw_args` has the same or fewer `--` tokens
/// than `parsed_args` (nothing was consumed). Otherwise restores all consumed `--` at
/// their original positions by returning the user-args suffix of `raw_args` verbatim.
pub fn restore_double_dash(parsed_args: &[String]) -> Vec<String> {
    let raw_args: Vec<String> = std::env::args().collect();
    restore_double_dash_with_raw(parsed_args, &raw_args)
}

/// Testable version that takes raw_args explicitly.
///
/// Precondition: all callers use `trailing_var_arg = true`, which guarantees that
/// `parsed_args` is the exact suffix of `raw_args` minus any `--` tokens that clap
/// stripped. This makes the user-args region length-deterministic:
///
///   user_region_len   = parsed_args.len() + missing_dashes
///   user_region_start = raw_args.len() - user_region_len
///
/// Returning `raw_args[user_region_start..]` restores all stripped `--` tokens at
/// their original positions without any value-based matching.
pub fn restore_double_dash_with_raw(parsed_args: &[String], raw_args: &[String]) -> Vec<String> {
    let raw_dash_count = raw_args.iter().filter(|a| a.as_str() == "--").count();
    let parsed_dash_count = parsed_args.iter().filter(|a| a.as_str() == "--").count();

    if raw_dash_count <= parsed_dash_count {
        return parsed_args.to_vec();
    }

    let missing_dashes = raw_dash_count - parsed_dash_count;
    let user_region_len = parsed_args.len() + missing_dashes;

    if raw_args.len() <= user_region_len {
        return parsed_args.to_vec();
    }

    let user_region_start = raw_args.len() - user_region_len;
    raw_args[user_region_start..].to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn restore_with_raw(parsed: &[&str], raw: &[&str]) -> Vec<String> {
        let parsed: Vec<String> = parsed.iter().map(|s| s.to_string()).collect();
        let raw: Vec<String> = raw.iter().map(|s| s.to_string()).collect();
        restore_double_dash_with_raw(parsed.as_slice(), raw.as_slice())
    }

    // ============ Single "--" swallowed ============

    #[test]
    fn test_single_dash_swallowed() {
        // rtk git diff -- file → clap gave ["file"], restore "--"
        let raw = vec!["rtk", "git", "diff", "--", "file"];
        let parsed = vec!["file"];
        assert_eq!(restore_with_raw(&parsed, &raw), vec!["--", "file"]);
    }

    #[test]
    fn test_args_before_dash() {
        // rtk cargo test name -- --nocapture → args before "--" stay before
        let raw = vec!["rtk", "cargo", "test", "name", "--", "--nocapture"];
        let parsed = vec!["name", "--nocapture"];
        assert_eq!(
            restore_with_raw(&parsed, &raw),
            vec!["name", "--", "--nocapture"]
        );
    }

    // ============ Multiple "--" swallowed ============

    #[test]
    fn test_multiple_dashes_all_swallowed() {
        // rtk git diff -- -- -- → all 3 "--" swallowed, consecutive in output
        let raw = vec!["rtk", "git", "diff", "--", "--", "--"];
        let parsed: Vec<&str> = vec![];
        assert_eq!(restore_with_raw(&parsed, &raw), vec!["--", "--", "--"]);
    }

    #[test]
    fn test_dashes_with_args_between() {
        // rtk git diff -- arg1 -- arg2 → both "--" consumed, preserve positions
        let raw = vec!["rtk", "git", "diff", "--", "arg1", "--", "arg2"];
        let parsed = vec!["arg1", "arg2"];
        // Result: each "--" inserted at its original position relative to args
        assert_eq!(
            restore_with_raw(&parsed, &raw),
            vec!["--", "arg1", "--", "arg2"]
        );
    }

    #[test]
    fn test_multiple_dashes_some_preserved() {
        // rtk git diff -- -- → 2 in raw, 1 preserved in parsed
        let raw = vec!["rtk", "git", "diff", "--", "--"];
        let parsed = vec!["--"];
        assert_eq!(restore_with_raw(&parsed, &raw), vec!["--", "--"]);
    }

    // ============ "--" already present (no change needed) ============

    #[test]
    fn test_dash_already_preserved() {
        // rtk cargo clippy -p pkg -- -D warnings → clap kept "--"
        let raw = vec![
            "rtk", "cargo", "clippy", "-p", "pkg", "--", "-D", "warnings",
        ];
        let parsed = vec!["-p", "pkg", "--", "-D", "warnings"];
        assert_eq!(
            restore_with_raw(&parsed, &raw),
            vec!["-p", "pkg", "--", "-D", "warnings"]
        );
    }

    #[test]
    fn test_trailing_dash_preserved() {
        // rtk git diff file -- → trailing "--" preserved
        let raw = vec!["rtk", "git", "diff", "file", "--"];
        let parsed = vec!["file", "--"];
        assert_eq!(restore_with_raw(&parsed, &raw), vec!["file", "--"]);
    }

    // ============ No "--" in original (no injection) ============

    #[test]
    fn test_no_dash_in_original() {
        // Various cases: branch with /, range, bare word, flags only
        // All should return args unchanged (no injection)
        let cases = vec![
            (
                vec!["rtk", "git", "diff", "feature/auth"],
                vec!["feature/auth"],
            ),
            (
                vec!["rtk", "git", "diff", "main...feature"],
                vec!["main...feature"],
            ),
            (vec!["rtk", "git", "diff", "main"], vec!["main"]),
            (
                vec!["rtk", "git", "diff", "--stat", "--cached"],
                vec!["--stat", "--cached"],
            ),
        ];
        for (raw, parsed) in cases {
            assert_eq!(restore_with_raw(&parsed, &raw), parsed);
        }
    }

    // ============ Edge cases ============

    #[test]
    fn test_duplicate_args_both_sides() {
        // -p pkg1 -p pkg2 -- -p pkg3 → restore after last -p
        let raw = vec![
            "rtk", "cargo", "clippy", "-p", "p1", "-p", "p2", "--", "-p", "p3",
        ];
        let parsed = vec!["-p", "p1", "-p", "p2", "-p", "p3"];
        assert_eq!(
            restore_with_raw(&parsed, &raw),
            vec!["-p", "p1", "-p", "p2", "--", "-p", "p3"]
        );
    }

    #[test]
    fn test_empty_args() {
        let raw = vec!["rtk", "cargo", "test"];
        let parsed: Vec<&str> = vec![];
        assert_eq!(restore_with_raw(&parsed, &raw), Vec::<String>::new());
    }

    #[test]
    fn test_cargo_clippy_missing_dash() {
        // No "--" in original → no injection
        let raw = vec!["rtk", "cargo", "clippy", "-D", "warnings"];
        let parsed = vec!["-D", "warnings"];
        assert_eq!(restore_with_raw(&parsed, &raw), vec!["-D", "warnings"]);
    }

    // ============ Positional collision with command token ============

    #[test]
    fn test_positional_equals_subcommand() {
        // rtk git diff -- diff: filename "diff" same value as subcommand token
        let raw = vec!["rtk", "git", "diff", "--", "diff"];
        let parsed = vec!["diff"];
        assert_eq!(restore_with_raw(&parsed, &raw), vec!["--", "diff"]);
    }

    #[test]
    fn test_cargo_test_named_cargo() {
        // rtk cargo test cargo -- --nocapture: test named "cargo"
        let raw = vec!["rtk", "cargo", "test", "cargo", "--", "--nocapture"];
        let parsed = vec!["cargo", "--nocapture"];
        assert_eq!(
            restore_with_raw(&parsed, &raw),
            vec!["cargo", "--", "--nocapture"]
        );
    }

    #[test]
    fn test_consecutive_dashes_before_file() {
        // rtk git diff -- -- file: stable regardless of how many "--" clap consumed
        let raw = vec!["rtk", "git", "diff", "--", "--", "file"];
        // Case A: clap consumed one, kept second as positional
        let parsed_a = vec!["--", "file"];
        assert_eq!(restore_with_raw(&parsed_a, &raw), vec!["--", "--", "file"]);
        // Case B: clap consumed both
        let parsed_b = vec!["file"];
        assert_eq!(restore_with_raw(&parsed_b, &raw), vec!["--", "--", "file"]);
    }

    // ============ Git diff specific cases ============

    #[test]
    fn test_git_diff_ref_before_path() {
        // rtk git diff HEAD -- file
        let raw = vec!["rtk", "git", "diff", "HEAD", "--", "file"];
        let parsed = vec!["HEAD", "file"];
        assert_eq!(restore_with_raw(&parsed, &raw), vec!["HEAD", "--", "file"]);
    }

    #[test]
    fn test_git_diff_flags_before_path() {
        // rtk git diff --cached -- file
        let raw = vec!["rtk", "git", "diff", "--cached", "--", "file"];
        let parsed = vec!["--cached", "file"];
        assert_eq!(
            restore_with_raw(&parsed, &raw),
            vec!["--cached", "--", "file"]
        );
    }

    #[test]
    fn test_git_diff_multiple_files() {
        // Original issue: multiple files caused "fatal: bad revision"
        let raw = vec!["rtk", "git", "diff", "--", "file1", "file2", "file3"];
        let parsed = vec!["file1", "file2", "file3"];
        assert_eq!(
            restore_with_raw(&parsed, &raw),
            vec!["--", "file1", "file2", "file3"]
        );
    }
}

```

### Core Architecture Module: `src/core/config.rs`
```
//! Reads user settings from config.toml.

use super::constants::{CONFIG_TOML, DEFAULT_HISTORY_DAYS, RTK_DATA_DIR};
use crate::core::user_dirs;
use crate::core::user_env;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub tracking: TrackingConfig,
    #[serde(default)]
    pub display: DisplayConfig,
    #[serde(default)]
    pub filters: FilterConfig,
    #[serde(default)]
    pub retriever: crate::core::retriever::RetrieverConfig,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tee: Option<LegacyTeeConfig>,
    #[serde(skip)]
    pub migrated_from_legacy_tee: bool,
    #[serde(skip)]
    pub legacy_tee_fields_merged: bool,
    #[serde(default)]
    pub telemetry: TelemetryConfig,
    #[serde(default)]
    pub hooks: HooksConfig,
    #[serde(default)]
    pub limits: LimitsConfig,
    #[serde(default)]
    pub awareness: AwarenessConfig,
}

/// How much the agent is told about RTK by the instructions file `rtk init` writes.
///
/// - `default`: output contract only. The agent never learns rtk exists.
/// - `high`: adds what RTK is and its meta commands (`rtk gain`, `rtk proxy`, `RTK_DISABLED=1`).
/// - `full`: adds "prefix every command with `rtk`". Required for agents without a command
///   hook; those agents always receive `full` regardless of this setting.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AwarenessLevel {
    #[default]
    Default,
    High,
    Full,
}

impl AwarenessLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            AwarenessLevel::Default => "default",
            AwarenessLevel::High => "high",
            AwarenessLevel::Full => "full",
        }
    }
}

impl std::fmt::Display for AwarenessLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AwarenessConfig {
    #[serde(default)]
    pub level: AwarenessLevel,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(default)]
struct LegacyTeeConfig {
    enabled: Option<bool>,
    mode: Option<String>,
    max_files: Option<usize>,
    max_file_size: Option<usize>,
    directory: Option<PathBuf>,
}

struct LegacyMapping {
    mode: Option<crate::core::retriever::RecoveryMode>,
    tee_on_success: Option<bool>,
    tee_max_files: Option<usize>,
    tee_max_file_size: Option<usize>,
    tee_directory: Option<PathBuf>,
}

/// The single source of truth for mapping a legacy `[tee]` section onto
/// `[retriever]`, shared by `Config::load()` and `rtk config recall` so the
/// two paths can never disagree on the same input.
fn map_legacy_tee(
    tee: &LegacyTeeConfig,
    has_retriever: bool,
    explicit_retriever_keys: &[String],
) -> LegacyMapping {
    use crate::core::retriever::RecoveryMode;
    let explicit = |key: &str| explicit_retriever_keys.iter().any(|k| k == key);
    let mode = if has_retriever {
        None
    } else if tee.enabled == Some(false) || tee.mode.as_deref() == Some("never") {
        Some(RecoveryMode::Disabled)
    } else {
        Some(RecoveryMode::Tee)
    };
    LegacyMapping {
        mode,
        tee_on_success: (tee.mode.as_deref() == Some("always") && !explicit("tee_on_success"))
            .then_some(true),
        tee_max_files: tee.max_files.filter(|_| !explicit("tee_max_files")),
        tee_max_file_size: tee.max_file_size.filter(|_| !explicit("tee_max_file_size")),
        tee_directory: tee.directory.clone().filter(|_| !explicit("tee_directory")),
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct HooksConfig {
    /// Commands to exclude from auto-rewrite (e.g. ["curl", "playwright"]).
    /// Survives `rtk init -g` re-runs since config.toml is user-owned.
    #[serde(default)]
    pub exclude_commands: Vec<String>,

    /// Wrapper prefixes that should be transparently stripped before routing
    /// to a filter, then re-prepended on the rewrite. For example, with
    /// `transparent_prefixes = ["docker exec mycontainer"]`, the command
    /// `docker exec mycontainer git status` rewrites to
    /// `docker exec mycontainer rtk git status` instead of passing through
    /// unrewritten.
    ///
    /// Useful for any per-project env wrapper that sits in front of every
    /// command — e.g. `docker exec mycontainer`, `direnv exec .`, `poetry run`,
    /// or `bundle exec`.
    ///
    /// Matching is literal, not pattern-based. Configure the exact concrete
    /// prefix you actually use, such as `docker exec mycontainer`.
    ///
    /// Extends the built-in `SHELL_PREFIX_BUILTINS` list (`noglob`, `command`,
    /// `builtin`, `exec`, `nocorrect`) with user- or organization-specific
    /// wrappers. Matching is strict: a configured prefix `"foo bar"` matches
    /// a command that starts with `"foo bar "` (or strictly equals `"foo bar"`),
    /// not anything else.
    #[serde(default)]
    pub transparent_prefixes: Vec<String>,
    /// Suppress the "No hook installed" warning only.
    /// Useful when running rtk via CLAUDE.md instructions instead of hooks,
    /// or with tools like OpenCode that don't use Claude Code hooks.
    /// Does not mute the "Hook outdated" upgrade prompt.
    #[serde(default)]
    pub suppress_hook_warning: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackingConfig {
    pub enabled: bool,
    pub history_days: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_path: Option<PathBuf>,
}

impl Default for TrackingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            history_days: DEFAULT_HISTORY_DAYS as u32,
            database_path: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DisplayConfig {
    pub colors: bool,
    pub emoji: bool,
    pub max_width: usize,
}

impl Default for DisplayConfig {
    fn default() -> Self {
        Self {
            colors: true,
            emoji: true,
            max_width: 120,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FilterConfig {
    pub ignore_dirs: Vec<String>,
    pub ignore_files: Vec<String>,
}

impl Default for FilterConfig {
    fn default() -> Self {
        Self {
            ignore_dirs: vec![
                ".git".into(),
                "node_modules".into(),
                "target".into(),
                "__pycache__".into(),
                ".venv".into(),
                "vendor".into(),
            ],
            ignore_files: vec!["*.lock".into(), "*.min.js".into(), "*.min.css".into()],
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct TelemetryConfig {
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consent_given: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consent_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LimitsConfig {
    /// Max total grep results to show (default: 200)
    pub grep_max_results: usize,
    /// Max matches per file in grep output (default: 25)
    pub grep_max_per_file: usize,
    /// Max staged/modified files shown in git status (default: 15)
    pub status_max_files: usize,
    /// Max untracked files shown in git status (default: 10)
    pub status_max_untracked: usize,
    /// Max chars for parser passthrough fallback (default: 2000)
    pub passthrough_max_chars: usize,
}

impl Default for LimitsConfig {
    fn default() -> Self {
        Self {
            grep_max_results: 200,
            grep_max_per_file: 25,
            status_max_files: 15,
            status_max_untracked: 10,
            passthrough_max_chars: 2000,
        }
    }
}

/// Get limits config. Falls back to defaults if config can't be loaded.
pub fn limits() -> LimitsConfig {
    Config::load().map(|c| c.limits).unwrap_or_default()
}

/// Get `(exclude_commands, transparent_prefixes)` for hook-rewrite decisions.
/// Falls back to empty (no exclusions/prefixes) if config can't be loaded.
/// Shared by every place that decides whether/how to rewrite a command
/// (`hooks::hook_cmd`, `hooks::rewrite_cmd`, `discover`, `rtk rewrite`'s CLI
/// entry point in `main.rs`) so they can't drift from each other.
///
/// Reads the process-wide cached config (see `cached_config`), not a fresh
/// `Config::load()`: this is on the PreToolUse hook's hot path, and
/// `tracking::get_db_path` (called via `Tracker::new()` for `hook_decisions`
/// logging, right after this in the same hook invocation) also reads config —
/// without caching, that's two full disk-read-plus-TOML-parse round trips per
/// single Bash tool call instead of one.
pub fn hook_rewrite_params() -> (Vec<String>, Vec<String>) {
    let c = cached_config();
    (
        c.hooks.exclude_commands.clone(),
        c.hooks.transparent_prefixes.clone(),
    )
}

/// Process-wide cached `Config::load()` result, populated on first use.
///
/// Safe for read-only callers on hot paths that may load config multiple times
/// within a single `rtk` invocation (a `rtk` process is short-lived and exits
/// after one subcommand, so there's no cross-invocation staleness to worry
/// about) — but NOT used by any path that mutates and saves config within the
/// same process run (e.g. `hooks::init::save_telemetry_consent`'s load-mutate-save),
/// since those must always observe a fresh read. Only reach for this from a
/// caller that never itself writes config.toml.
///
/// In a test build every call loads afresh from the calling test's own
/// `user_dirs::config`: a process-wide cache would hold whichever test's
/// configuration was read first, and hand it to all the others.
pub(crate) fn cached_config() -> std::sync::Arc<Config> {
    #[cfg(not(test))]
    {
        static CA
```

### Core Architecture Module: `src/core/constants.rs`
```
pub const RTK_DATA_DIR: &str = "rtk";
pub const HISTORY_DB: &str = "history.db";
pub const RECALL_DB: &str = "recall.db";
pub const CONFIG_TOML: &str = "config.toml";
pub const FILTERS_TOML: &str = "filters.toml";
pub const TRUSTED_FILTERS_JSON: &str = "trusted_filters.json";
pub const DEFAULT_HISTORY_DAYS: i64 = 90;

/// RTK-only subcommands that should never fall back to raw execution.
/// When adding a new RTK-only subcommand to `Commands`, add its clap name here.
pub const RTK_META_COMMANDS: &[&str] = &[
    "gain",
    "discover",
    "learn",
    "init",
    "config",
    "proxy",
    "recall",
    "run",
    "hook",
    "hook-audit",
    "pipe",
    "cc-economics",
    "verify",
    "trust",
    "untrust",
    "session",
    "rewrite",
    "telemetry",
    "smart",
    "deps",
    "json",
    // `err` and `summary` name no real binary, and since they grew `--shell`
    // they have a flag to get wrong. Falling through would try to exec a
    // program called `err` instead of reporting the flag error (#4125 review).
    "err",
    "summary",
];

```

### Core Architecture Module: `src/core/display_helpers.rs`
```
//! Formats token counts and savings tables for terminal display.
//!
//! Eliminates duplication in gain.rs and cc_economics.rs by providing
//! a unified trait-based system for displaying daily/weekly/monthly data.

use crate::core::tracking::{DayStats, MonthStats, WeekStats};
use crate::core::utils::format_tokens;

/// Format duration in milliseconds to human-readable string
pub fn format_duration(ms: u64) -> String {
    if ms < 1000 {
        format!("{}ms", ms)
    } else if ms < 60_000 {
        format!("{:.1}s", ms as f64 / 1000.0)
    } else {
        let minutes = ms / 60_000;
        let seconds = (ms % 60_000) / 1000;
        format!("{}m{}s", minutes, seconds)
    }
}

/// Trait for period-based statistics that can be displayed in tables
pub trait PeriodStats {
    /// Icon for this period type (e.g., "D", "W", "M")
    fn icon() -> &'static str;

    /// Label for this period type (e.g., "Daily", "Weekly", "Monthly")
    fn label() -> &'static str;

    /// Period identifier (e.g., "2026-01-20", "01-20 → 01-26", "2026-01")
    fn period(&self) -> String;

    /// Number of commands in this period
    fn commands(&self) -> usize;

    /// Input tokens in this period
    fn input_tokens(&self) -> usize;

    /// Output tokens in this period
    fn output_tokens(&self) -> usize;

    /// Saved tokens in this period
    fn saved_tokens(&self) -> usize;

    /// Savings percentage
    fn savings_pct(&self) -> f64;

    /// Total execution time in milliseconds
    fn total_time_ms(&self) -> u64;

    /// Average execution time per command in milliseconds
    fn avg_time_ms(&self) -> u64;

    /// Period column width for alignment
    fn period_width() -> usize;

    /// Total separator line width
    fn separator_width() -> usize;
}

/// Generic table printer for any period statistics
pub fn print_period_table<T: PeriodStats>(data: &[T]) {
    if data.is_empty() {
        println!("No {} data available.", T::label().to_lowercase());
        return;
    }

    let period_width = T::period_width();
    let separator = "═".repeat(T::separator_width());

    println!(
        "\n{} {} Breakdown ({} {}s)",
        T::icon(),
        T::label(),
        data.len(),
        T::label().to_lowercase()
    );
    println!("{}", separator);
    println!(
        "{:<width$} {:>7} {:>10} {:>10} {:>10} {:>7} {:>8}",
        match T::label() {
            "Weekly" => "Week",
            "Monthly" => "Month",
            _ => "Date",
        },
        "Cmds",
        "Input",
        "Output",
        "Saved",
        "Save%",
        "Time",
        width = period_width
    );
    println!("{}", "─".repeat(T::separator_width()));

    for period in data {
        println!(
            "{:<width$} {:>7} {:>10} {:>10} {:>10} {:>6.1}% {:>8}",
            period.period(),
            period.commands(),
            format_tokens(period.input_tokens()),
            format_tokens(period.output_tokens()),
            format_tokens(period.saved_tokens()),
            period.savings_pct(),
            format_duration(period.avg_time_ms()),
            width = period_width
        );
    }

    // Compute totals
    let total_cmds: usize = data.iter().map(|d| d.commands()).sum();
    let total_input: usize = data.iter().map(|d| d.input_tokens()).sum();
    let total_output: usize = data.iter().map(|d| d.output_tokens()).sum();
    let total_saved: usize = data.iter().map(|d| d.saved_tokens()).sum();
    let total_time: u64 = data.iter().map(|d| d.total_time_ms()).sum();
    let avg_pct = if total_input > 0 {
        (total_saved as f64 / total_input as f64) * 100.0
    } else {
        0.0
    };
    let avg_time = if total_cmds > 0 {
        total_time / total_cmds as u64
    } else {
        0
    };

    println!("{}", "─".repeat(T::separator_width()));
    println!(
        "{:<width$} {:>7} {:>10} {:>10} {:>10} {:>6.1}% {:>8}",
        "TOTAL",
        total_cmds,
        format_tokens(total_input),
        format_tokens(total_output),
        format_tokens(total_saved),
        avg_pct,
        format_duration(avg_time),
        width = period_width
    );
    println!();
}

// ── Trait Implementations ──

impl PeriodStats for DayStats {
    fn icon() -> &'static str {
        "D"
    }

    fn label() -> &'static str {
        "Daily"
    }

    fn period(&self) -> String {
        self.date.clone()
    }

    fn commands(&self) -> usize {
        self.commands
    }

    fn input_tokens(&self) -> usize {
        self.input_tokens
    }

    fn output_tokens(&self) -> usize {
        self.output_tokens
    }

    fn saved_tokens(&self) -> usize {
        self.saved_tokens
    }

    fn savings_pct(&self) -> f64 {
        self.savings_pct
    }

    fn total_time_ms(&self) -> u64 {
        self.total_time_ms
    }

    fn avg_time_ms(&self) -> u64 {
        self.avg_time_ms
    }

    fn period_width() -> usize {
        12
    }

    fn separator_width() -> usize {
        74
    }
}

impl PeriodStats for WeekStats {
    fn icon() -> &'static str {
        "W"
    }

    fn label() -> &'static str {
        "Weekly"
    }

    fn period(&self) -> String {
        let start = if self.week_start.len() > 5 {
            &self.week_start[5..]
        } else {
            &self.week_start
        };
        let end = if self.week_end.len() > 5 {
            &self.week_end[5..]
        } else {
            &self.week_end
        };
        format!("{} → {}", start, end)
    }

    fn commands(&self) -> usize {
        self.commands
    }

    fn input_tokens(&self) -> usize {
        self.input_tokens
    }

    fn output_tokens(&self) -> usize {
        self.output_tokens
    }

    fn saved_tokens(&self) -> usize {
        self.saved_tokens
    }

    fn savings_pct(&self) -> f64 {
        self.savings_pct
    }

    fn total_time_ms(&self) -> u64 {
        self.total_time_ms
    }

    fn avg_time_ms(&self) -> u64 {
        self.avg_time_ms
    }

    fn period_width() -> usize {
        22
    }

    fn separator_width() -> usize {
        82
    }
}

impl PeriodStats for MonthStats {
    fn icon() -> &'static str {
        "M"
    }

    fn label() -> &'static str {
        "Monthly"
    }

    fn period(&self) -> String {
        self.month.clone()
    }

    fn commands(&self) -> usize {
        self.commands
    }

    fn input_tokens(&self) -> usize {
        self.input_tokens
    }

    fn output_tokens(&self) -> usize {
        self.output_tokens
    }

    fn saved_tokens(&self) -> usize {
        self.saved_tokens
    }

    fn savings_pct(&self) -> f64 {
        self.savings_pct
    }

    fn total_time_ms(&self) -> u64 {
        self.total_time_ms
    }

    fn avg_time_ms(&self) -> u64 {
        self.avg_time_ms
    }

    fn period_width() -> usize {
        10
    }

    fn separator_width() -> usize {
        74
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_day_stats_trait() {
        let day = DayStats {
            date: "2026-01-20".to_string(),
            commands: 10,
            input_tokens: 1000,
            output_tokens: 500,
            saved_tokens: 200,
            savings_pct: 20.0,
            total_time_ms: 1500,
            avg_time_ms: 150,
        };

        assert_eq!(day.period(), "2026-01-20");
        assert_eq!(day.commands(), 10);
        assert_eq!(day.saved_tokens(), 200);
        assert_eq!(day.avg_time_ms(), 150);
        assert_eq!(DayStats::icon(), "D");
        assert_eq!(DayStats::label(), "Daily");
    }

    #[test]
    fn test_week_stats_trait() {
        let week = WeekStats {
            week_start: "2026-01-20".to_string(),
            week_end: "2026-01-26".to_string(),
            commands: 50,
            input_tokens: 5000,
            output_tokens: 2500,
            saved_tokens: 1000,
            savings_pct: 40.0,
            total_time_ms: 5000,
            avg_time_ms: 100,
        };

        assert_eq!(week.period(), "01-20 → 01-26");
        assert_eq!(week.avg_time_ms(), 100);
        assert_eq!(WeekStats::icon(), "W");
        assert_eq!(WeekStats::label(), "Weekly");
    }

    #[test]
    fn test_month_stats_trait() {
        let month = MonthStats {
            month: "2026-01".to_string(),
            commands: 200,
            input_tokens: 20000,
            output_tokens: 10000,
            saved_tokens: 5000,
            savings_pct: 50.0,
            total_time_ms: 20000,
            avg_time_ms: 100,
        };

        assert_eq!(month.period(), "2026-01");
        assert_eq!(month.avg_time_ms(), 100);
        assert_eq!(MonthStats::icon(), "M");
        assert_eq!(MonthStats::label(), "Monthly");
    }

    #[test]
    fn test_print_period_table_empty() {
        let data: Vec<DayStats> = vec![];
        print_period_table(&data);
        // Should print "No daily data available."
    }

    #[test]
    fn test_print_period_table_with_data() {
        let data = vec![
            DayStats {
                date: "2026-01-20".to_string(),
                commands: 10,
                input_tokens: 1000,
                output_tokens: 500,
                saved_tokens: 200,
                savings_pct: 20.0,
                total_time_ms: 1500,
                avg_time_ms: 150,
            },
            DayStats {
                date: "2026-01-21".to_string(),
                commands: 15,
                input_tokens: 1500,
                output_tokens: 750,
                saved_tokens: 300,
                savings_pct: 30.0,
                total_time_ms: 2250,
                avg_time_ms: 150,
            },
        ];
        print_period_table(&data);
        // Should print table with 2 rows + total
    }
}

```

### Core Architecture Module: `src/core/filter.rs`
```
//! Strips comments and boilerplate from source code to save tokens.

use regex::Regex;
use std::str::FromStr;
use std::sync::LazyLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterLevel {
    None,
    Minimal,
    Aggressive,
}

impl FromStr for FilterLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "none" => Ok(FilterLevel::None),
            "minimal" => Ok(FilterLevel::Minimal),
            "aggressive" => Ok(FilterLevel::Aggressive),
            _ => Err(format!("Unknown filter level: {}", s)),
        }
    }
}

impl std::fmt::Display for FilterLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FilterLevel::None => write!(f, "none"),
            FilterLevel::Minimal => write!(f, "minimal"),
            FilterLevel::Aggressive => write!(f, "aggressive"),
        }
    }
}

pub trait FilterStrategy {
    fn filter(&self, content: &str, lang: &Language) -> String;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    Rust,
    Python,
    JavaScript,
    TypeScript,
    Go,
    C,
    Cpp,
    Java,
    Ruby,
    Shell,
    /// Data formats (JSON, YAML, TOML, XML, CSV) — no comment stripping
    Data,
    Unknown,
}

impl Language {
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "rs" => Language::Rust,
            "py" | "pyw" => Language::Python,
            "js" | "mjs" | "cjs" => Language::JavaScript,
            "ts" | "tsx" => Language::TypeScript,
            "go" => Language::Go,
            "c" | "h" => Language::C,
            "cpp" | "cc" | "cxx" | "hpp" | "hh" => Language::Cpp,
            "java" => Language::Java,
            "rb" => Language::Ruby,
            "sh" | "bash" | "zsh" => Language::Shell,
            "json" | "jsonc" | "json5" | "yaml" | "yml" | "toml" | "xml" | "csv" | "tsv"
            | "graphql" | "gql" | "sql" | "md" | "markdown" | "txt" | "env" | "lock" => {
                Language::Data
            }
            _ => Language::Unknown,
        }
    }

    pub fn comment_patterns(&self) -> CommentPatterns {
        match self {
            Language::Rust => CommentPatterns {
                line: Some("//"),
                block_start: Some("/*"),
                block_end: Some("*/"),
                doc_line: Some("///"),
                doc_block_start: Some("/**"),
            },
            Language::Python => CommentPatterns {
                line: Some("#"),
                block_start: Some("\"\"\""),
                block_end: Some("\"\"\""),
                doc_line: None,
                doc_block_start: Some("\"\"\""),
            },
            Language::JavaScript
            | Language::TypeScript
            | Language::Go
            | Language::C
            | Language::Cpp
            | Language::Java => CommentPatterns {
                line: Some("//"),
                block_start: Some("/*"),
                block_end: Some("*/"),
                doc_line: None,
                doc_block_start: Some("/**"),
            },
            Language::Ruby => CommentPatterns {
                line: Some("#"),
                block_start: Some("=begin"),
                block_end: Some("=end"),
                doc_line: None,
                doc_block_start: None,
            },
            Language::Shell => CommentPatterns {
                line: Some("#"),
                block_start: None,
                block_end: None,
                doc_line: None,
                doc_block_start: None,
            },
            Language::Data => CommentPatterns {
                line: None,
                block_start: None,
                block_end: None,
                doc_line: None,
                doc_block_start: None,
            },
            Language::Unknown => CommentPatterns {
                line: Some("//"),
                block_start: Some("/*"),
                block_end: Some("*/"),
                doc_line: None,
                doc_block_start: None,
            },
        }
    }
}

#[derive(Debug, Clone)]
pub struct CommentPatterns {
    pub line: Option<&'static str>,
    pub block_start: Option<&'static str>,
    pub block_end: Option<&'static str>,
    pub doc_line: Option<&'static str>,
    pub doc_block_start: Option<&'static str>,
}

pub struct NoFilter;

impl FilterStrategy for NoFilter {
    fn filter(&self, content: &str, _lang: &Language) -> String {
        content.to_string()
    }
}

pub struct MinimalFilter;

static MULTIPLE_BLANK_LINES: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\n{3,}").unwrap());

/// Advances triple-quoted string state across one line, returning the delimiter
/// still open at end of line. The two quote kinds are tracked separately so a
/// `'''` inside a `"""` string is text rather than a close. Outside a string, a
/// one-line string literal is skipped whole and a `#` ends the scan, so a `"""`
/// written inside `'"""'` or after a trailing comment opens nothing. A backslash
/// escapes the next byte in every kind of string, raw ones included.
fn advance_triple_quote(line: &str, open: Option<&'static str>) -> Option<&'static str> {
    let bytes = line.as_bytes();
    let mut state = open;
    let mut i = 0;

    while i < bytes.len() {
        let rest = &bytes[i..];
        if let Some(current) = state {
            if rest[0] == b'\\' {
                i += 2;
            } else if rest.starts_with(current.as_bytes()) {
                state = None;
                i += 3;
            } else {
                i += 1;
            }
            continue;
        }

        match rest[0] {
            b'#' => break,
            b'"' if rest.starts_with(b"\"\"\"") => {
                state = Some("\"\"\"");
                i += 3;
            }
            b'\'' if rest.starts_with(b"'''") => {
                state = Some("'''");
                i += 3;
            }
            quote @ (b'"' | b'\'') => {
                let interpolated = has_interpolation_prefix(&bytes[..i]);
                let mut depth = 0usize;
                i += 1;
                while i < bytes.len() {
                    match bytes[i] {
                        b'\\' => i += 1,
                        b'{' if interpolated => {
                            if depth == 0 && bytes.get(i + 1) == Some(&b'{') {
                                i += 1;
                            } else {
                                depth += 1;
                            }
                        }
                        b'}' if interpolated && depth > 0 => depth -= 1,
                        b if b == quote && depth == 0 => break,
                        _ => {}
                    }
                    i += 1;
                }
                i += 1;
            }
            _ => i += 1,
        }
    }
    state
}

/// True when the identifier ending at `before` is an f-string or t-string prefix.
/// A replacement field in those may reuse the outer quote (PEP 701), so the
/// quote only ends the string outside `{...}`.
fn has_interpolation_prefix(before: &[u8]) -> bool {
    let start = before
        .iter()
        .rposition(|b| !(b.is_ascii_alphanumeric() || *b == b'_'))
        .map_or(0, |p| p + 1);
    matches!(
        before[start..].to_ascii_lowercase().as_slice(),
        b"f" | b"fr" | b"rf" | b"t" | b"tr" | b"rt"
    )
}

/// Python has no block comments. `"""` opens a *string*, which may be a
/// docstring or an ordinary value, so it cannot be matched with the
/// line-oriented block-comment rules the other languages use: a line such as
/// `QUERY = """` both contains and "closes" the delimiter, and a single-line
/// docstring toggles the state once and never back.
///
/// Minimal keeps docstrings, so the only thing to remove here is `#` comments,
/// and the only state needed is whether we are inside a triple-quoted string.
fn filter_python_minimal(content: &str) -> String {
    let mut result = String::with_capacity(content.len());
    let mut open_string: Option<&'static str> = None;

    for line in content.lines() {
        let trimmed = line.trim();

        // Inside a string every line is literal text, including one that starts
        // with `#`.
        if open_string.is_some() {
            result.push_str(line);
            result.push('\n');
            open_string = advance_triple_quote(line, open_string);
            continue;
        }

        // A comment's contents are not code, so any delimiter in it is not real.
        if trimmed.starts_with('#') {
            continue;
        }

        if trimmed.is_empty() {
            result.push('\n');
            continue;
        }

        result.push_str(line);
        result.push('\n');
        open_string = advance_triple_quote(line, None);
    }

    let result = MULTIPLE_BLANK_LINES.replace_all(&result, "\n\n");
    result.trim().to_string()
}

impl FilterStrategy for MinimalFilter {
    fn filter(&self, content: &str, lang: &Language) -> String {
        if *lang == Language::Python {
            return filter_python_minimal(content);
        }

        let patterns = lang.comment_patterns();
        let mut result = String::with_capacity(content.len());
        let mut in_block_comment = false;
        let mut in_docstring = false;

        for line in content.lines() {
            let trimmed = line.trim();

            // Handle block comments
            if let (Some(start), Some(end)) = (patterns.block_start, patterns.block_end) {
                // starts_with, not contains: `/*` inside a string literal or
                // glob (e.g. "src/*.rs") must not open a comment block (#2385)
                if !in_docstring
                    && trimmed.starts_with(start)
                    && !trimmed.starts_with(patterns.doc_block_start.unwrap_or("###"))
                {
                    in_block_comme
```

### Core Architecture Module: `src/core/guard.rs`
```
//! Never-worse output guard: RTK never emits more tokens than the raw command.
//!
//! Two callers are allowed past it. `rtk diff` prints a one-line message for a
//! difference `str::lines()` cannot render — CRLF against LF, or a missing
//! final newline — where the raw fallback is two blobs that look identical and
//! answer the question worse at any size. The exception is bounded by the case
//! rather than by a token count: it fires only when the bytes differ and the
//! line vectors do not, so the message never competes with a change list. A
//! fixed allowance above raw was tried and could not be met by construction:
//! the shortest form of the message is ~20 tokens and a one-line pair is ~2, so
//! the ceiling sat under the message's own floor and dropped it on 90% of
//! one-line pairs.
//!
//! The other is a clean run of a command whose output format rtk injected
//! (`runner::RunOptions::clean_outputs`): ruff's `[]` answers a question the
//! user never asked, so the filter's summary is shown although it is longer.

use crate::core::tracking::estimate_tokens;

/// Returns `filtered`, or `raw` when `filtered` would emit more tokens.
pub fn never_worse<'a>(raw: &'a str, filtered: &'a str) -> &'a str {
    if estimate_tokens(filtered) > estimate_tokens(raw) {
        raw
    } else {
        filtered
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_filtered_when_smaller() {
        let raw = "a".repeat(400);
        assert_eq!(never_worse(&raw, "ok"), "ok");
    }

    #[test]
    fn falls_back_to_raw_when_filtered_bigger() {
        let raw = "{}";
        let filtered = "{\n  \"pretty\": true\n}";
        assert_eq!(never_worse(raw, filtered), raw);
    }

    #[test]
    fn tie_keeps_filtered() {
        assert_eq!(never_worse("abcd", "wxyz"), "wxyz");
    }

    #[test]
    fn token_boundary_follows_estimate_tokens() {
        assert_eq!(never_worse("abcd", "abcde"), "abcd");
        assert_eq!(never_worse("abcdefgh", "ijklmnop"), "ijklmnop");
    }

    #[test]
    fn empty_raw_returns_raw() {
        assert_eq!(never_worse("", "0 matches"), "");
    }

    #[test]
    fn empty_filtered_returns_filtered() {
        assert_eq!(never_worse("data", ""), "");
    }

    #[test]
    fn both_empty_returns_filtered() {
        assert_eq!(never_worse("", ""), "");
    }
}

```

### Core Architecture Module: `src/core/mod.rs`
```
//! Building blocks shared across all RTK modules.

pub mod arg_tokenizer;
pub mod args_utils;
pub mod config;
pub mod constants;
pub mod display_helpers;
pub mod filter;
pub mod guard;
pub mod retriever;
pub mod runner;
pub mod shell;
pub mod stream;
pub mod tee;
pub mod tee_file;
pub mod telemetry;
pub mod telemetry_cmd;
#[cfg(test)]
pub mod test_isolation;
pub mod toml_filter;
pub mod tracking;
pub mod truncate;
pub mod user_dirs;
pub mod user_env;
pub mod utils;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4441** (2026-10-04): **rewrite: `tail -c N` is not in the registry, so the hook never reaches it (the four line spellings do)**
  *Symptoms*: ## Summary  `tail -c N file` (byte window) has no rewrite rule, so it never reaches the `PreToolUse` hook and runs raw — while the three line-based spellings all rewrite to `rtk read`:  ``` $ rtk hook check "tail -n 20 f.txt" rtk read f.txt --tail-lines 20  $ rtk hook check "tail -20 f.txt" rtk read f.txt --tail-lines 20  $ rtk hook check "tail --lines=20 f.txt" rtk read f.txt --tail-lines 20  $ rtk hook check "tail -c 2000 f.txt" No rewrite for: tail -c 2000 f.txt ```  The four line-spellings exist as regexes in `src/discover/registry.rs` (`TAIL_N`, `TAIL_N_SPACE`, `TAIL_LINES_EQ`, `TAIL_LINES_SPACE`); the byte form is simply absent.  ## Why it matters more than it looks  `tail -c N` is the spelling people reach for when the file is large and they want a *bounded* read of the end — exactly the case where compression pays. It is also the natural companion to `head -c N`, which has the same gap.  In a 30-day sweep of my own history (`rtk discover`, 31 737 Bash commands), `tail -c` was the **single largest missed-savings item among commands rtk already supports** — 246 occurrences, ahead of `git commit` (330, which *does* rewrite) on savings per call because the files involved are large logs.  ## What I validated before filing  - `rtk read --tail-lines N` handles the line case correctly, so the target subcommand already exists — this is a registry gap, not a missing feature. - A trusted project `.rtk/filters.toml` entry with `match_command = "^tail\\s+-c\\s"` *does* filter corr
  **Post-Mortem & Fix Analysis**:
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 🔍 Automated Triage  | | | |---|---| | 🐛 **Category** | `bug` | | 🟡 **Priority** | `medium` | | 🎯 **Confidence** | 86% |  ### Summary  `tail -c N` (and `head -c N`) is missing from the rewrite registry, so byte-window reads bypass the PreToolUse hook and run uncompressed.  > This looks like a **simple fix** that could be auto-resolved. Repo maintainers can use `/wshm fix` to attempt it.  <details> <summary>📁 Relevant files</summary>  - `src/discover/registry.rs`  </details>  ### Suggested Actions  1. Decide the `rtk read` byte-window target (e.g. a `--tail-bytes` flag) before merging, per author's note that this is a … 1. Accept the offered PR against src/discover/registry.rs adding TAIL_C/HEAD_C regexes plus tests 1. Cross-check #4366 (head/tail savings accounting) since byte-window rewrites will interact with gain tracking 1. If no
  > Withdrawing — resolving this locally in our own hook/config fork instead of upstream. Apologies for the noise.

- **Issue #4387** (2026-10-02): **hooks/hermes: adapter rewrites silently with a hardcoded 2s timeout — add passthrough guard, timeout env, audit log and version check**
  *Symptoms*: ## Summary  `hooks/hermes/rtk-rewrite` (plugin v0.1.0, `__init__.py` @ 6dcf44e) bridges Hermes' `pre_tool_call` hook to `rtk rewrite`. Four gaps surfaced on a live Hermes gateway:  1. **No guard against rewrites the rtk parser itself rejects.** The adapter substitutes unconditionally; when the installed binary lags the rewrite contract, every affected call becomes a guaranteed parse-fail + shell fallback (zero savings, one extra subprocess, one `parse_failures` row). 2. **Hardcoded 2s timeout** — real rewrites can exceed it, and the adapter then skips the rewrite entirely. 3. **No `stdin=subprocess.DEVNULL`** — the child inherits the gateway's stdin pipe. 4. **Rewrites are silent** — nothing records which command was replaced, so a degraded no-op looks identical to a working install.  This is an adapter-side report. Root cause of the arg-parsing half is tracked in #1604 (grep flags; **fixed in v0.47.0 via #2628** — confirmed by @KuSh in that thread). The hook-timeout reports #218 / #1804 cover Claude Code and Gemini CLI config entries, not this adapter.  ## Environment (where the evidence came from)  - rtk **0.42.1** — deliberately older than the #1604 fix, which is exactly what made these gaps visible - Hermes Agent gateway (systemd user service), plugin enabled with `plugins.enabled: [rtk-rewrite]` - Installed file is byte-identical to `hooks/hermes/rtk-rewrite/__init__.py` upstream  ## Evidence  Works overall — `~/.local/share/rtk/history.db` → `commands`: **141 rows in on
  **Post-Mortem & Fix Analysis**:
  > Closing this — we resolved it locally and the underlying cause is already fixed upstream.  - Root cause of the grep parse failures was our own stale binary (0.42.1 < v0.47.0); #1604 / #2628 fixed it, confirmed here after upgrading to v0.50.0 (all of `-rn`, `-c`, `-ac`, `-nE`, `-l`, `-A/-B/-C`, `--include=`, `-q/-i/-v/-w/-o/-h/-e` now parse). - The Hermes-side gaps (2s hardcoded timeout, no `stdin=DEVNULL`, silent rewrites, no version check) are patched on our box: `RTK_HERMES_TIMEOUT` (default 5s), DEVNULL stdin, JSONL audit log at `~/.hermes/logs/rtk-rewrites.jsonl`, and a one-time warning when `rtk --version` < 0.47.0.  Withdrawn rather than leaving duplicate work in your queue — no action needed from maintainers. If a PR for `hooks/hermes/` is still welcome, I can send the patch; otherwise consider this withdrawn. Thanks!
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 🔍 Automated Triage  | | | |---|---| | 🐛 **Category** | `bug` | | 🟡 **Priority** | `medium` | | 🎯 **Confidence** | 82% |  ### Summary  Hermes adapter substitutes rewrites unconditionally with a hardcoded 2s timeout, inherited stdin, and no audit trail, causing avoidable parse-fail fallbacks (grep flags) against older rtk binaries.  <details> <summary>📁 Relevant files</summary>  - `hooks/hermes/rtk-rewrite/__init__.py`  </details>  ### Suggested Actions  1. Review the local patch the reporter offers to send as a PR for hooks/hermes/__init__.py 1. Cross-check with #1604/#2628 (grep flag fix) to confirm which rtk versions still need the passthrough guard 1. Note overlap with #3589 (retracted hook-timeout report) when evaluating the timeout change 1. Decide on default for RTK_HERMES_TIMEOUT and the version-handshake minimum before mergin

- **Issue #4384** (2026-10-03): **fix(tracking): bucket `rtk uv …` rows as python in categorize_command (fixes #4316)**
  *Symptoms*: ## Summary  Fixes #4316: `categorize_command` had no `uv` arm, so every row `src/cmds/python/uv_cmd.rs` writes (`rtk uv sync`, `rtk uv run …`, `rtk uv pip …`) fell through to `other` in the ecosystem mix.  ## Changes  1. **src/core/tracking.rs** — `categorize_command`: add `uv` to the `python` arm, matching `pytest`/`ruff`/`mypy`/`pip`/`sqlfluff`. After #4053 the pip proxy's uv-fallback rows are labelled `rtk pip …` and count as `python`, so the same uv invocation was bucketed differently depending on whether it entered through `rtk pip` or `rtk uv`. 2. **src/core/tracking.rs** — `test_categorize_uv_as_python` pins the forms uv_cmd.rs writes: all `python`, none `other`.  ## Testing  - `cargo test --bin rtk categorize`: 2 passed (new uv test + existing) - `cargo test --all`: full suite green - `cargo fmt --all -- --check` and `cargo clippy --all-targets` pass  @KuSh could you please review?
  **Post-Mortem & Fix Analysis**:
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 📊 Automated PR Analysis  | | | |---|---| | 🐛 **Type** | `bug-fix` | | 🟢 **Risk** | `low` |  ### Summary  Adds `uv` to the python arm of `categorize_command` so `rtk uv sync/run/pip` rows are bucketed as python instead of falling through to `other`, matching how uv invocations via `rtk pip`'s uv fallback are already categorized. Includes a new unit test pinning the expected categorization for several uv command forms.  ### Review Checklist - [x] Tests present - [ ] Breaking change - [ ] Docs updated  **Linked issues:** #4316  --- *Analyzed automatically by [wshm](https://github.com/wshm-dev/wshm)* · This is an automated analysis, not a human review. <!-- wshm -->
  > Thanks for the fix and the clear write-up. #4328 makes the same one-word change to the python arm of `categorize_command`, with a test for the same three `rtk uv` forms, and was opened on 2026-09-28, before this one. Its CI is green and it merges cleanly on current `develop`, so I'm closing this as a duplicate to keep the review in one place.  The change itself checks out: with a local telemetry collector compiled in and real `uv run` rows recorded, the ecosystem mix goes from `{"other": 50, "python": 50}` to `{"python": 100}`.

- **Issue #4383** (2026-10-03): **fix(diff): report a one-operand call as a usage error with exit 2 (fixes #4320)**
  *Symptoms*: ## Summary  Fixes #4320: `rtk diff <file>` with a single file operand treated it as the stdin form — it ignored the file, echoed stdin back as a diff to condense, and exited 0. Real `diff` reports a usage error and exits 2.  ## Changes  1. **src/main.rs** — `Commands::Diff` dispatch: with no second file, only the `-` operand reads a piped diff from stdin; a real file operand alone now prints diff's own message (`diff: missing operand after '<file>'`) and exits 2, before opening the file — the same order real `diff` uses, so a missing operand is reported too. 2. **src/main.rs** — the `Diff` variant doc now states the full contract: 0 identical, 1 different, 2 read error or usage error; `-` is the stdin form.  ## Testing  - `one_file_operand_is_a_usage_error_not_a_stdin_condense`: exits 2 with the `missing operand after` message, stdin not echoed back - `explicit_stdin_dash_still_condenses`: `rtk diff -` keeps reading a piped diff and exits 0 - `cargo fmt --all -- --check`, `cargo clippy --all-targets`, and `cargo test --all` pass  @KuSh could you please review?
  **Post-Mortem & Fix Analysis**:
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 📊 Automated PR Analysis  | | | |---|---| | 🐛 **Type** | `bug-fix` | | 🟢 **Risk** | `low` |  ### Summary  Fixes a bug where `rtk diff <file>` with a single file operand was incorrectly treated as the stdin form, silently echoing stdin back as a diff and exiting 0. Now only `rtk diff -` triggers stdin mode, while a lone file operand prints a `missing operand` usage error and exits 2, matching real `diff`'s behavior.  ### Review Checklist - [x] Tests present - [x] Breaking change - [x] Docs updated  **Linked issues:** #4320  --- *Analyzed automatically by [wshm](https://github.com/wshm-dev/wshm)* · This is an automated analysis, not a human review. <!-- wshm -->

- **Issue #4381** (2026-10-02): **fix(shell): run unresolvable single-string commands through the platform shell**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/rtk-ai/rtk?pullRequest=4381) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/rtk-ai/rtk?pullRequest=4381) before we can accept your contribution.<br/><hr/>**Adrien EPPLING** seems not to be a GitHub user. You need a GitHub account to be able to sign the CLA. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/rtk-ai/rtk?pullRequest=4381) it.</sub>
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 📊 Automated PR Analysis  | | | |---|---| | 🐛 **Type** | `bug-fix` | | 🟡 **Risk** | `medium` |  ### Summary  Fixes rtk's single-string command handling so that an unresolvable single-argument command containing shell metacharacters (or an empty string) falls back to running through the platform shell instead of immediately reporting it as not found. Includes a stderr warning advising users to pass arguments separately or use --shell, plus new unit and integration tests covering the fallback, exit code propagation, and cases where the fallback should not trigger (multiple args, bare unresolvable words,…  ### Review Checklist - [x] Tests present - [ ] Breaking change - [ ] Docs updated  --- *Analyzed automatically by [wshm](https://github.com/wshm-dev/wshm)* · This is an automated analysis, not a human review. <!-- wshm -->

- **Issue #4370** (2026-10-03): **fix(curl): inherit stdin so -d @- / -T - / --data-binary @- work (fixes #4084)**
  *Symptoms*: ## Summary  Fixes #4084: `rtk curl -d @-` (and `-T -`, `--data-binary @-`, `-F field=@-`, `-K -`) sends an empty body because the child process gets an immediate-EOF stdin.  ## Root Cause  `curl_cmd::run()` spawns curl via `cmd.output()` without configuring stdin. Per std's documented behavior, `output()` gives the child an immediate-EOF stdin. curl's `@-` forms read from stdin, so they receive EOF → empty body.  ## Fix  Added `cmd.stdin(std::process::Stdio::inherit())` before `cmd.output()` in `curl_cmd::run()`. This mirrors the existing pattern in `npm_cmd.rs` / `wc_cmd.rs` (`RunOptions::inherit_stdin()`).  Covers all stdin-reading forms: `-d @-`, `-T -`, `--data-binary @-`, `-F field=@-`, `-K -`.  ## Testing  - Existing 15 filter/binary tests in `curl_cmd.rs` still pass - Verified the fix manually: `echo '{"test":1}' | rtk curl -d @- ...` now sends the body instead of LEN=0 - Follow-up: add integration test with an echo server (follow-up issue)
  **Post-Mortem & Fix Analysis**:
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 📊 Automated PR Analysis  | | | |---|---| | 🐛 **Type** | `bug-fix` | | 🟢 **Risk** | `low` |  ### Summary  Fixes rtk curl dropping request bodies when using stdin-reading forms like -d @-, -T -, --data-binary @-, -F field=@-, or -K -. The root cause was that cmd.output() gives the child process immediate-EOF stdin, so the fix adds cmd.stdin(Stdio::inherit()) before spawning curl, mirroring the existing pattern in npm_cmd.rs and wc_cmd.rs.  ### Review Checklist - [ ] Tests present - [ ] Breaking change - [ ] Docs updated  **Linked issues:** #4084  --- *Analyzed automatically by [wshm](https://github.com/wshm-dev/wshm)* · This is an automated analysis, not a human review. <!-- wshm -->
  > Hi @KuSh , Could you please review this ?  
  > Thanks for picking this up, @TechWizard9999. #4085 makes the same change (`cmd.stdin(Stdio::inherit())` before `cmd.output()`), was opened on 2026-09-15 by the reporter of #4084, and adds an integration test with an in-process HTTP server that fails without the line and passes with it. I ran both heads against an echo server: they behave identically on `-d @-`, `--data-binary @-`, `-T -`, `-F field=@-` and `-K -`, where develop sends an empty body on all of them. Closing this one as a duplicate; the review continues on #4085.

- **Issue #4367** (2026-10-05): **Part of #4366: fix(read): use window size as tracking baseline for --head-lines/--tail-lines**
  *Symptoms*: ## Summary  Part of #4366: Fix tracking baseline for `head -N` / `tail -N` rewrites in `rtk read`.  ## Changes  1. **Fast path (`--head-lines N`)**: Changed tracking baseline from `cat {file}` with full file size to `head -N {file}` with `window.len()` (the actual N-line window size).  2. **Byte-window path (`--tail-lines` or `--head-lines` with `-n`)**: Fixed tracking baseline from `cat {file}` with full file content to actual command (`head -N`/`tail -N`) with `window.len()`.  3. **Fallback path**: Updated tracking to use actual command (`head -N`/`tail -N`/`cat`) instead of always `cat`.  4. **Added regression test**: `test_head_tail_tracking_baseline_is_window_not_full_file` uses in-memory tracker to verify the fix.  5. **Removed dead code**: Removed `regular_file_len` function and its test (no longer used).  ## Fixed Regressions  | Command | Before (baseline) | After (baseline) | |---------|-------------------|------------------| | `head -5 big.txt` | `cat big.txt` (6673 tokens) | `head -5 big.txt` (81 tokens) | | `tail -5 big.txt` | `cat big.txt` (6673 tokens) | `tail -5 big.txt` (83 tokens) | | `grep ... | head -3` | `grep ...` (7846 tokens) | (separate issue - pipeline tracking) |  ## Testing  - All existing tests pass - New regression test `test_head_tail_tracking_baseline_is_window_not_full_file` added - Uses `Tracker::new_in_memory()` to avoid polluting developer's DB - Uses `test_isolation::with_root` for proper database isolation  Fixes #4366
  **Post-Mortem & Fix Analysis**:
  > @KuSh — ready for review. All CI checks should pass. This fixes #4366 by fixing the tracking baseline for head/tail rewrites to use the actual N-line window size instead of the full file size. Includes regression test.
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 📊 Automated PR Analysis  | | | |---|---| | 🐛 **Type** | `bug-fix` | | 🟡 **Risk** | `medium` |  ### Summary  Fixes gain token tracking for `head -N`/`tail -N` rewrites so the baseline is the actual line-window size rather than the full file (previously miscounted as a full `cat`), adding a regression test using an in-memory tracker. The diff also bundles unrelated fixes: making `rtk init --opencode` install the Claude Code setup alongside the OpenCode plugin, ensuring the Claude config directory is created on Windows, and related README/docs wording updates.  ### Review Checklist - [x] Tests present - [ ] Breaking change - [x] Docs updated  **Linked issues:** #4366, #2519, #4046  --- *Analyzed automatically by [wshm](https://github.com/wshm-dev/wshm)* · This is an automated analysis, not a human review. <!-- wshm -->
  > Sorry got corrupted , Tried to trigger CI but couldnt will create an new pr 

- **Issue #4361** (2026-09-30): **rtk go test -C DIR fails: -json is injected before -C**
  *Symptoms*: ## Repro  ``` rtk go test -C ./sub ./... ```  ## Actual  rtk runs `go test -json -C ./sub ./...`, and Go rejects it:  ``` go: -C flag must be first flag on command line ```  No tests run.  ## Expected  `-json` goes after the chdir flag: `go test -C ./sub -json ./...`. Go accepts `-C DIR`, `-C=DIR`, `--C DIR` and `--C=DIR` (https://go.dev/src/cmd/go/main.go).  ## Impact  The hook rewrites `go test` to `rtk go test`, so a command that works when run directly fails once it goes through rtk. Workaround: `cd DIR && go test ./...`.  Fix: #3520 
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #4362
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 🔍 Automated Triage  | | | |---|---| | 🐛 **Category** | `bug` | | 🟠 **Priority** | `high` | | 🎯 **Confidence** | 95% |  ### Summary  rtk injects -json before Go's -C flag in `go test -C DIR ...`, causing Go to reject the command with 'must be first flag'.  > This looks like a **simple fix** that could be auto-resolved. Repo maintainers can use `/wshm fix` to attempt it.  <details> <summary>📁 Relevant files</summary>  - `src/filters/go.rs` - `src/rewrite.rs`  </details>  ### Suggested Actions  1. Fix flag ordering so injected -json is placed after -C/--C (with = or space forms) rather than before it 1. Reference #3520 which the reporter links as a related fix 1. Add a regression test covering `go test -C DIR`, `-C=DIR`, `--C DIR`, `--C=DIR`  --- *Triaged automatically by [wshm](https://github.com/wshm-dev/wshm)* · This is an automated

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

### Incident Patch 1: `cf018aff` (2026-10-05)
**Commit Message**: Merge pull request #4349 from rtk-ai/fix/opencode-native-permission-host

fix(hooks): judge OpenCode against its own permission rules

**File**: `hooks/opencode/README.md` (modified, +7/-2)
```diff
@@ -5,7 +5,12 @@
 ## Specifics
 
 - TypeScript plugin using the zx library (not a shell hook)
-- Intercepts `tool.execute.before` events, calls `rtk rewrite` as a subprocess
+- Intercepts `tool.execute.before` events, calls `rtk hook opencode` as a subprocess
+- The Rust side judges the command against OpenCode's own permission rules
+  (root and project `opencode.json`/`.jsonc`, last match wins) and answers `{}`
+  whenever the rewrite would change the verdict those rules give — OpenCode
+  evaluates the final command itself, so RTK never lifts a deny, silences an
+  ask, or blocks an allow (#4195)
 - Uses `.quiet().nothrow()` to silently ignore failures
-- Mutates `args.command` in-place if rewrite differs from original
+- Mutates `args.command` in-place if the answered rewrite differs from original
 - Installed to `~/.config/opencode/plugins/rtk.ts` by `rtk init -g --opencode`
```

**File**: `hooks/opencode/rtk.ts` (modified, +18/-9)
```diff
@@ -1,11 +1,20 @@
 import type { Plugin } from "@opencode-ai/plugin"
 
 // RTK OpenCode plugin — rewrites commands to use rtk for token savings.
-// Requires: rtk >= 0.23.0 in PATH.
+// Requires: an rtk with the `rtk hook opencode` subcommand (newer than
+// v0.51). An older rtk answers nothing, so commands pass through unrewritten
+// rather than breaking.
 //
-// This is a thin delegating plugin: all rewrite logic lives in `rtk rewrite`,
-// which is the single source of truth (src/discover/registry.rs).
-// To add or change rewrite rules, edit the Rust registry — not this file.
+// This is a thin delegating plugin: all rewrite and permission logic lives
+// in `rtk hook opencode`, which is the single source of truth
+// (src/discover/registry.rs). It judges the command against OpenCode's own
+// permission rules and answers `{}` whenever the rewrite would change what
+// those rules decide — OpenCode evaluates the final command itself, so a
+// rewrite RTK does return never lifts a deny, silences an ask, or blocks an
+// allow. To add or change rewrite rules, edit the Rust registry — not this
+// file.
+
+type Answer = { command?: string }
 
 export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
   try {
@@ -26,13 +35,13 @@ export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
       if (typeof command !== "string" || !command) return
 
       try {
-        const result = await $`rtk rewrite ${command}`.quiet().nothrow()
-        const rewritten = String(result.stdout).trim()
-        if (rewritten && rewritten !== command) {
-          ;(args as Record<string, unknown>).command = rewritten
+        const result = await $`rtk hook opencode ${command}`.quiet().nothrow()
+        const answer = JSON.parse(String(result.stdout).trim() || "{}") as Answer
+        if (answer.command && answer.command !== command) {
+          ;(args as Record<string, unknown>).command = answer.command
         }
       } catch {
-        // rtk rewrite failed — pass through unchanged
+        // rtk hook opencode failed or answered nothing — pass through unchanged
       }
     },
   }
```

**File**: `src/core/test_isolation/scratch.rs` (modified, +2/-1)
```diff
@@ -127,13 +127,14 @@ fn remove_at_exit(dir: &Path) {
 /// whether a project's settings are read; the CI indicators the filter-trust
 /// override checks; and Composer's bin directory, which decides which tool a
 /// PHP command runs.
-const INHERITED_VARS: [&str; 13] = [
+const INHERITED_VARS: [&str; 14] = [
     "CLAUDE_CONFIG_DIR",
     "CODEX_HOME",
     "HERMES_HOME",
     "COPILOT_HOME",
     "PI_CODING_AGENT_DIR",
     "FACTORY_HOME_OVERRIDE",
+    "OPENCODE_CONFIG",
     "GEMINI_CLI_TRUST_WORKSPACE",
     "CI",
     "GITHUB_ACTIONS",
```

**File**: `src/hooks/decision.rs` (modified, +17/-4)
```diff
@@ -193,9 +193,10 @@ pub(crate) fn decide_for_agent(cmd: &str, verdict: PermissionVerdict) -> HookDec
 /// so it refuses the command and tells the user to re-run the very thing they
 /// ran; Cursor raises a permission prompt for it. The plugins that shell out to
 /// `rtk rewrite` reach the same outcome in their own code --
-/// `hooks/opencode/rtk.ts`, `hooks/pi/rtk.ts` (shared with omp),
-/// `hooks/hermes/rtk-rewrite/__init__.py` and `openclaw/index.ts` all gate on
-/// `rewritten != command`.
+/// `hooks/pi/rtk.ts` (shared with omp), `hooks/hermes/rtk-rewrite/__init__.py`
+/// and `openclaw/index.ts` all gate on `rewritten != command`.
+/// `hooks/opencode/rtk.ts` shells out to `rtk hook opencode` instead, which
+/// goes through here in-process and answers `{}` for the no-op.
 ///
 /// `Defer` is not uniformly neutral, though: Gemini renders it as `ask_user`,
 /// so there suppression trades a no-op rewrite for a confirmation prompt even
@@ -292,7 +293,8 @@ impl AgentPath {
             // settings (#3908). Its deny gate is unaffected -- see
             // `ApprovalOwner`.
             "openclaw" => Some(Self::ViaRewrite(ApprovalOwner::Delegate)),
-            "hermes" | "omp" | "opencode" | "pi" => Some(Self::ViaRewrite(ApprovalOwner::Rtk)),
+            "opencode" => Some(Self::InProcess(Host::OpenCode)),
+            "hermes" | "omp" | "pi" => Some(Self::ViaRewrite(ApprovalOwner::Rtk)),
             "vibe" => Some(Self::InProcess(Host::Vibe)),
             _ => None,
         }
@@ -497,6 +499,17 @@ mod tests {
         }
     }
 
+    /// OpenCode decides in-process against its own rules. On `ViaRewrite` the
+    /// plugin and `rtk hook check --agent opencode` would silently drift back
+    /// to judging against Claude Code's settings (#4195).
+    #[test]
+    fn opencode_is_judged_in_process_against_its_own_host() {
+        assert!(matches!(
+            AgentPath::lookup("opencode"),
+            Some(AgentPath::InProcess(Host::OpenCode))
+        ));
+    }
+
     /// Everything advertised in the error message must actually resolve.
     #[test]
     fn every_listed_agent_resolves() {
```

**File**: `src/hooks/hook_cmd.rs` (modified, +167/-0)
```diff
@@ -6,6 +6,7 @@
 use super::constants::PRE_TOOL_USE_KEY;
 use super::decision::{self, HookDecision};
 use super::permissions::{self, PermissionVerdict};
+use super::permissions_opencode;
 use anyhow::{Context, Result};
 use serde_json::{Value, json};
 use std::io::{self, Read, Write};
@@ -1193,6 +1194,55 @@ fn droid_response_from_decision(v: &Value, cmd: &str, decision: HookDecision) ->
     Some(pre_tool_use_rewrite_output(v, &rewritten, None))
 }
 
+/// Answer OpenCode's plugin: the rewrite as JSON, or `{}` to leave the
+/// command untouched.
+pub fn run_opencode(cmd: &str, agent: Option<&str>) -> Result<()> {
+    let _ = writeln!(io::stdout(), "{}", opencode_answer_for(cmd, agent));
+    Ok(())
+}
+
+/// [`opencode_answer`] against the rules OpenCode resolves for `agent`.
+fn opencode_answer_for(cmd: &str, agent: Option<&str>) -> Value {
+    let rules = permissions_opencode::load_opencode_rules(agent);
+    opencode_answer(cmd, &rules)
+}
+
+/// Decide what the plugin should do with `cmd` under OpenCode's own rules.
+///
+/// OpenCode evaluates whatever command the plugin hands back against the
+/// user's permission rules itself, and from 1.1.4 on plugins cannot
+/// influence that verdict: there is no `permission.ask` plugin hook (1.0.142
+/// had one). So the one thing RTK must guarantee is that the rewrite never
+/// changes what those rules decide: whenever the verdict for `rtk <cmd>`
+/// differs from the verdict for `cmd` as typed, RTK steps aside and returns
+/// `{}`, trading token savings on that command for the user's own policy
+/// (#4195). An allow stays an allow, an ask stays a prompt, and a deny stays
+/// denied — RTK never blocks, lifts or silences anything.
+fn opencode_answer(cmd: &str, rules: &[permissions_opencode::Rule]) -> Value {
+    if cmd.trim().is_empty() {
+        return json!({});
+    }
+    let before = permissions_opencode::check_command_with_opencode_rules(cmd, rules);
+    let rewritten = match decide_from_verdict(cmd, before) {
+        // OpenCode denies the typed command itself; a rewrite could only
+        // un-match the deny rule.
+        HookDecision::Deny => {
+            audit_log("deny", cmd, "");
+            return json!({});
+        }
+        HookDecision::Defer => return json!({}),
+        HookDecision::AllowRewrite(r) | HookDecision::AskRewrite(r) => r,
+    };
+
+    let after = permissions_opencode::check_command_with_opencode_rules(&rewritten, rules);
+    if before != after {
+        return json!({});
+    }
+
+    audit_log("rewrite", cmd, &rewritten);
+    json!({ "command": rewritten })
+}
+
 /// Run the Factory Droid PreToolUse hook natively.
 pub fn run_droid() -> Result<()> {
     let input = read_stdin_limited()?;
@@ -2563,6 +2613,123 @@ mod tests {
         let _ = run_claude_inner(&input);
     }
 
+    // --- OpenCode: the answer the plugin acts on ---
+    //
+    // OpenCode judges whatever command runs against the user's own rules;
+    // plugins cannot change that verdict. So the invariant pinned here is:
+    // a rewrite is returned only when it leaves the verdict untouched.
+
+    mod opencode_answer {
+        use super::super::opencode_answer;
+        use crate::hooks::permissions_opencode::{Action, Rule};
+        use serde_json::json;
+
+        fn rule(pattern: &str, action: Action) -> Rule {
+            Rule {
+                permission: "bash".to_string(),
+                pattern: pattern.to_string(),
+                action,
+            }
+        }
+
+        #[test]
+        fn an_empty_command_gets_no_answer() {
+            assert_eq!(opencode_answer("   ", &[]), json!({}));
+        }
+
+        #[test]
+        fn an_already_prefixed_command_gets_no_answer() {
+            assert_eq!(opencode_answer("rtk git status", &[]), json!({}));
+        }
+
+        #[test]
+        fn with_no_rules_the_rewrite_happens() {
+            assert_eq!(
+                opencode_answer("git status", &[]),
+                json!({ "command": "rtk git status" })
+            );
+        }
+
+        #[test]
+        fn a_uniform_policy_keeps_the_rewrite() {
+            // allow or ask on everything: the rtk form gets the same verdict,
+            // so the rewrite costs the user nothing.
+            for action in [Action::Allow, Action::Ask] {
+                let rules = [rule("*", action)];
+                assert_eq!(
+                    opencode_answer("ls -la", &rules),
+                    json!({ "command": "rtk ls -la" }),
+                    "action: {action:?}"
+                );
+            }
+        }
+
+        #[test]
+        fn the_4195_allow_survives_because_the_rewrite_is_skipped() {
+            // {"*": "deny", "git status": "allow"} — the typed command is
+            // allowed, its rtk form would be denied. RTK steps aside so
+            // OpenCode runs the typed `git status` under the user's rule.
+            let rules = [rule("*", Action::Deny), rule("git status", Action::Allow)];
+   
```

**File**: `src/hooks/mod.rs` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ pub mod hook_cmd;
 pub mod init;
 pub mod integrity;
 pub mod permissions;
+pub mod permissions_opencode;
 pub mod rewrite_cmd;
 pub mod trust;
 pub mod verify_cmd;
```

**File**: `src/hooks/permissions.rs` (modified, +10/-0)
```diff
@@ -42,9 +42,18 @@ pub enum Host {
     Droid,
     Vibe,
     Antigravity,
+    OpenCode,
 }
 
 pub fn check_command_for(cmd: &str, host: Host) -> PermissionVerdict {
+    check_command_for_agent(cmd, host, None)
+}
+
+pub fn check_command_for_agent(cmd: &str, host: Host, agent: Option<&str>) -> PermissionVerdict {
+    if host == Host::OpenCode {
+        let rules = super::permissions_opencode::load_opencode_rules(agent);
+        return super::permissions_opencode::check_command_with_opencode_rules(cmd, &rules);
+    }
     let (deny_rules, ask_rules, allow_rules) = load_rules_for(host);
     check_command_with_rules(cmd, &deny_rules, &ask_rules, &allow_rules)
 }
@@ -68,6 +77,7 @@ pub(crate) fn load_rules_for(host: Host) -> (Vec<String>, Vec<String>, Vec<Strin
         Host::Codex | Host::Trae | Host::Vibe | Host::Antigravity => {
             (Vec::new(), Vec::new(), Vec::new())
         }
+        Host::OpenCode => (Vec::new(), Vec::new(), Vec::new()),
     }
 }
 
```

**File**: `src/hooks/permissions_opencode.rs` (added, +598/-0)
```diff
@@ -0,0 +1,598 @@
+use super::constants::{CONFIG_DIR, OPENCODE_SUBDIR};
+use super::permissions::PermissionVerdict;
+use crate::core::user_dirs;
+use crate::discover::lexer::{contains_unattestable_construct, split_for_permissions};
+use serde_json::Value;
+use std::path::{Path, PathBuf};
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(crate) enum Action {
+    Allow,
+    Ask,
+    Deny,
+}
+
+impl Action {
+    fn parse(raw: &str) -> Option<Self> {
+        match raw {
+            "allow" => Some(Self::Allow),
+            "ask" => Some(Self::Ask),
+            "deny" => Some(Self::Deny),
+            _ => None,
+        }
+    }
+}
+
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub(crate) struct Rule {
+    pub(crate) permission: String,
+    pub(crate) pattern: String,
+    pub(crate) action: Action,
+}
+
+pub(crate) fn wildcard_match(text: &str, pattern: &str) -> bool {
+    let text = text.replace('\\', "/");
+    let pattern = pattern.replace('\\', "/");
+
+    if let Some(base) = pattern.strip_suffix(" *")
+        && glob_match(&text, base)
+    {
+        return true;
+    }
+    glob_match(&text, &pattern)
+}
+
+fn glob_match(text: &str, pattern: &str) -> bool {
+    let t: Vec<char> = text.chars().collect();
+    let p: Vec<char> = pattern.chars().collect();
+    let (mut ti, mut pi) = (0usize, 0usize);
+    let mut star: Option<(usize, usize)> = None;
+
+    while ti < t.len() {
+        if pi < p.len() && (p[pi] == '?' || chars_eq(p[pi], t[ti])) {
+            ti += 1;
+            pi += 1;
+        } else if pi < p.len() && p[pi] == '*' {
+            pi += 1;
+            star = Some((pi, ti));
+        } else if let Some((resume_pi, resume_ti)) = star {
+            pi = resume_pi;
+            ti = resume_ti + 1;
+            star = Some((resume_pi, resume_ti + 1));
+        } else {
+            return false;
+        }
+    }
+
+    while pi < p.len() && p[pi] == '*' {
+        pi += 1;
+    }
+    pi == p.len()
+}
+
+#[cfg(windows)]
+fn chars_eq(a: char, b: char) -> bool {
+    a.eq_ignore_ascii_case(&b) || a.to_lowercase().eq(b.to_lowercase())
+}
+
+#[cfg(not(windows))]
+fn chars_eq(a: char, b: char) -> bool {
+    a == b
+}
+
+pub(crate) fn evaluate(cmd: &str, rules: &[Rule]) -> Option<Action> {
+    rules
+        .iter()
+        .rev()
+        .find(|rule| wildcard_match("bash", &rule.permission) && wildcard_match(cmd, &rule.pattern))
+        .map(|rule| rule.action)
+}
+
+pub(crate) fn check_command_with_opencode_rules(cmd: &str, rules: &[Rule]) -> PermissionVerdict {
+    // `split_for_permissions` returns trimmed, non-empty segments only.
+    let actions: Vec<Option<Action>> = split_for_permissions(cmd)
+        .iter()
+        .map(|segment| evaluate(segment, rules))
+        .collect();
+
+    if actions.contains(&Some(Action::Deny)) {
+        return PermissionVerdict::Deny;
+    }
+
+    if contains_unattestable_construct(cmd) {
+        return PermissionVerdict::Ask;
+    }
+
+    if actions.is_empty() {
+        return PermissionVerdict::Default;
+    }
+
+    if actions.iter().all(|a| *a == Some(Action::Allow)) {
+        return PermissionVerdict::Allow;
+    }
+
+    if actions.contains(&Some(Action::Ask)) {
+        return PermissionVerdict::Ask;
+    }
+
+    PermissionVerdict::Default
+}
+
+pub(crate) fn load_opencode_rules(agent: Option<&str>) -> Vec<Rule> {
+    let mut rules = Vec::new();
+    for config in opencode_configs() {
+        if let Some(permission) = config.get("permission") {
+            append_rules(permission, &mut rules);
+        }
+        if let Some(block) =
+            agent.and_then(|name| config.pointer(&format!("/agent/{name}/permission")))
+        {
+            append_rules(block, &mut rules);
+        }
+    }
+    rules
+}
+
+fn append_rules(permission: &Value, rules: &mut Vec<Rule>) {
+    let Some(entries) = permission.as_object() else {
+        return;
+    };
+    for (name, value) in entries {
+        match value {
+            Value::String(action) => {
+                if let Some(action) = Action::parse(action) {
+                    rules.push(Rule {
+                        permission: name.clone(),
+                        pattern: "*".to_string(),
+                        action,
+                    });
+                }
+            }
+            Value::Object(patterns) => {
+                for (pattern, action) in patterns {
+                    if let Some(action) = action.as_str().and_then(Action::parse) {
+                        rules.push(Rule {
+                            permission: name.clone(),
+                            pattern: pattern.clone(),
+                            action,
+                        });
+                    }
+                }
+            }
+            _ => {}
+        }
+    }
+}
+
+fn opencode_configs() -> Vec<Value> {
+    let mut configs = Vec::new();
+
+    if let Some(path) = user_dirs::env_path("OPENCODE_CONFIG") {
+        if let Some(v) = read_config(Path::new(&
```

---

### Incident Patch 2: `aec5fa95` (2026-10-05)
**Commit Message**: Merge pull request #4340 from rtk-ai/fix/golangci-rewrite-keeps-redirect

fix(discover): keep a trailing redirect when rewriting golangci-lint

**File**: `src/discover/registry.rs` (modified, +87/-3)
```diff
@@ -1779,7 +1779,18 @@ fn rewrite_segment_inner(
         return None;
     }
 
-    if let Some(parts) = parse_golangci_run_parts(cmd_part) {
+    // The trailing redirect is the shell's, not the tool's: every rewrite of a
+    // supported command re-attaches it here, once, exactly as typed.
+    rewrite_command_part(rule, cmd_part)
+        .map(|rewritten| format!("{}{}", rewritten, redirect_suffix))
+}
+
+/// Rewrite the command part of a segment (trailing redirects already split
+/// off) with `rule`, or `None` when this rule does not rewrite it.
+fn rewrite_command_part(rule: &RtkRule, cmd_part: &str) -> Option<String> {
+    if rule.rtk_cmd == "rtk golangci-lint run"
+        && let Some(parts) = parse_golangci_run_parts(cmd_part)
+    {
         let rewritten = if parts.global_segment.is_empty() {
             format!("rtk golangci-lint {}", parts.run_segment)
         } else {
@@ -1820,9 +1831,9 @@ fn rewrite_segment_inner(
     for &prefix in rule.rewrite_prefixes {
         if let Some(rest) = strip_word_prefix(strip_target, prefix) {
             let rewritten = if rest.is_empty() {
-                format!("{}{}", rule.rtk_cmd, redirect_suffix)
+                rule.rtk_cmd.to_string()
             } else {
-                format!("{} {}{}", rule.rtk_cmd, rest, redirect_suffix)
+                format!("{} {}", rule.rtk_cmd, rest)
             };
             return Some(rewritten);
         }
@@ -5396,6 +5407,79 @@ mod tests {
         );
     }
 
+    #[test]
+    fn test_rewrite_golangci_lint_keeps_trailing_redirects() {
+        // The redirect belongs to the shell, not to golangci-lint: dropping it
+        // sends output meant for a file or /dev/null to the terminal.
+        for (input, expected) in [
+            ("golangci-lint run 2>&1", "rtk golangci-lint run 2>&1"),
+            (
+                "golangci-lint run ./... >/dev/null",
+                "rtk golangci-lint run ./... >/dev/null",
+            ),
+            (
+                "golangci-lint run 2>/dev/null",
+                "rtk golangci-lint run 2>/dev/null",
+            ),
+            (
+                "golangci-lint run &>/dev/null",
+                "rtk golangci-lint run &>/dev/null",
+            ),
+            (
+                "FOO=1 golangci-lint run 2>&1",
+                "FOO=1 rtk golangci-lint run 2>&1",
+            ),
+            (
+                "golangci-lint --color never run ./... 2>&1",
+                "rtk golangci-lint --color never run ./... 2>&1",
+            ),
+            (
+                "golangci-lint run ./... 2>&1 | tail -5",
+                "rtk golangci-lint run ./... 2>&1 | tail -5",
+            ),
+            // No space before the redirect: the boundary is kept exactly as
+            // typed, so a word ending in digits is not turned into a
+            // descriptor number and vice versa.
+            (
+                "golangci-lint run -c x.yml>/dev/null",
+                "rtk golangci-lint run -c x.yml>/dev/null",
+            ),
+            (
+                "golangci-lint run ${PKG}2>/dev/null",
+                "rtk golangci-lint run ${PKG}2>/dev/null",
+            ),
+        ] {
+            assert_eq!(
+                rewrite_command_no_prefixes(input, &[]).as_deref(),
+                Some(expected),
+                "{input}"
+            );
+        }
+    }
+
+    #[test]
+    fn test_rewrite_supported_commands_reattach_redirects_as_typed() {
+        for (input, expected) in [
+            (
+                "git status ${PKG}2>/dev/null",
+                Some("rtk git status ${PKG}2>/dev/null"),
+            ),
+            ("git status 2>&1", Some("rtk git status 2>&1")),
+            // gh's structured-output flags still skip the rewrite with a redirect.
+            ("gh pr list --json number 2>&1", None),
+            (
+                "vendor/bin/phpunit tests 2>&1",
+                Some("rtk phpunit tests 2>&1"),
+            ),
+        ] {
+            assert_eq!(
+                rewrite_command_no_prefixes(input, &[]).as_deref(),
+                expected,
+                "{input}"
+            );
+        }
+    }
+
     #[test]
     fn test_rewrite_golangci_lint_with_flag_before_run() {
         assert_eq!(
```

---

### Incident Patch 3: `5019e9c9` (2026-10-05)
**Commit Message**: Merge pull request #4038 from KuSh/fix/gain-hook-warning-every-view

fix(gain): report a missing hook on every view, not just the default one with data

**File**: `src/analytics/gain.rs` (modified, +30/-23)
```diff
@@ -12,6 +12,31 @@ use serde::Serialize;
 use std::io::IsTerminal;
 use std::path::PathBuf;
 
+/// Reports a missing or outdated hook on stderr.
+///
+/// `suppress_hook_warning` hides the missing-hook arm: a user who runs rtk
+/// without hooks on purpose reads this report most often. The outdated-hook
+/// arm stays visible either way.
+fn warn_hook_issues() {
+    match hook_check::status() {
+        hook_check::HookStatus::Missing if !crate::core::config::hook_warning_suppressed() => {
+            eprintln!(
+                "{}",
+                "[warn] No hook installed — run `rtk init -g` for automatic token savings".yellow()
+            );
+            eprintln!();
+        }
+        hook_check::HookStatus::Outdated => {
+            eprintln!(
+                "{}",
+                "[warn] Hook outdated — run `rtk init -g` to update".yellow()
+            );
+            eprintln!();
+        }
+        hook_check::HookStatus::Missing | hook_check::HookStatus::Ok => {}
+    }
+}
+
 #[allow(clippy::too_many_arguments)]
 pub fn run(
     project: bool, // added: per-project scope flag
@@ -93,6 +118,11 @@ pub fn run(
         eprintln!();
     }
 
+    // Reported for every text view, including the empty one: with no hook
+    // nothing is tracked, so a missing hook is the likeliest reason there is
+    // nothing to show. The JSON and CSV exports return earlier and stay clean.
+    warn_hook_issues();
+
     if summary.total_commands == 0 {
         println!("No tracking data yet.");
         println!("Run some rtk commands to start tracking savings.");
@@ -138,29 +168,6 @@ pub fn run(
         print_efficiency_meter(summary.avg_savings_pct);
         println!();
 
-        // Warn about hook issues that silently kill savings (stderr, not stdout).
-        // `suppress_hook_warning` hides the missing-hook arm here too: a user who
-        // runs rtk without hooks on purpose reads this report most often, and the
-        // outdated-hook arm stays visible either way.
-        match hook_check::status() {
-            hook_check::HookStatus::Missing if !crate::core::config::hook_warning_suppressed() => {
-                eprintln!(
-                    "{}",
-                    "[warn] No hook installed — run `rtk init -g` for automatic token savings"
-                        .yellow()
-                );
-                eprintln!();
-            }
-            hook_check::HookStatus::Outdated => {
-                eprintln!(
-                    "{}",
-                    "[warn] Hook outdated — run `rtk init -g` to update".yellow()
-                );
-                eprintln!();
-            }
-            hook_check::HookStatus::Missing | hook_check::HookStatus::Ok => {}
-        }
-
         // Lightweight RTK_DISABLED bypass check (best-effort, silent on failure)
         if let Some(warning) = check_rtk_disabled_bypass() {
             eprintln!("{}", warning.yellow());
```

**File**: `tests/gain_hook_warning_test.rs` (added, +272/-0)
```diff
@@ -0,0 +1,272 @@
+//! Integration tests: `rtk gain` hook-status warning coverage.
+//!
+//! Matrix contributed by @AngelVRodC in rtk-ai/rtk#4039.
+//!
+//! Change: fix-gain-hook-warning (rtk-ai/rtk#4035) — the missing-hook warning
+//! must appear on every text view (default, --daily, --weekly, --monthly,
+//! --all) and on the empty-database report, exactly once per invocation.
+//! JSON/CSV exports stay warning-free; the not-applicable state (no ~/.claude)
+//! stays silent.
+#![cfg(unix)]
+
+use std::path::Path;
+use tempfile::TempDir;
+
+mod common;
+
+const NEEDLE: &str = "[warn] No hook installed";
+
+/// Pins every directory the binary resolves from the environment, so a runner
+/// that exports `XDG_*` cannot reach past the temporary home.
+fn isolating_env(home: &Path) -> Vec<(String, std::ffi::OsString)> {
+    vec![
+        ("HOME".into(), home.as_os_str().to_owned()),
+        ("RTK_DB_PATH".into(), home.join("rtk.db").into_os_string()),
+        (
+            "XDG_CONFIG_HOME".into(),
+            home.join(".config").into_os_string(),
+        ),
+        (
+            "XDG_DATA_HOME".into(),
+            home.join(".local").join("share").into_os_string(),
+        ),
+    ]
+}
+
+/// Run `rtk gain <args>` with HOME isolated to `home`, returning
+/// (stdout, stderr) as lossy UTF-8 strings.
+fn gain_split(args: &[&str], home: &Path) -> (String, String) {
+    gain_split_env(args, home, &[])
+}
+
+/// As `gain_split`, with extra environment variables applied.
+fn gain_split_env(args: &[&str], home: &Path, env: &[(&str, &str)]) -> (String, String) {
+    // `rtk_command` clears the inherited `RTK_*` and agent-home variables and
+    // pins rtk's own paths; `isolating_env` then moves them onto this test's
+    // temporary home. `LC_ALL` is this test's to set: it reads rtk's own
+    // wording, not a native tool's.
+    let mut cmd = common::rtk_command();
+    cmd.args(args).envs(isolating_env(home)).env("LC_ALL", "C");
+    for (key, value) in env {
+        cmd.env(key, value);
+    }
+    let output = cmd.output().expect("spawn rtk gain");
+    assert!(
+        output.status.success(),
+        "rtk gain {} failed: {}",
+        args.join(" "),
+        String::from_utf8_lossy(&output.stderr)
+    );
+    (
+        String::from_utf8_lossy(&output.stdout).into_owned(),
+        String::from_utf8_lossy(&output.stderr).into_owned(),
+    )
+}
+
+/// Combined stdout+stderr (ANSI codes wrap, never split, the needle).
+fn gain(args: &[&str], home: &Path) -> String {
+    let (out, err) = gain_split(args, home);
+    format!("{out}{err}")
+}
+
+fn count(haystack: &str, needle: &str) -> usize {
+    haystack.matches(needle).count()
+}
+
+/// HOME with a `.claude` dir but no hook registered → status() == Missing.
+fn missing_hook_home() -> TempDir {
+    let tmp = tempfile::tempdir().expect("tempdir");
+    std::fs::create_dir_all(tmp.path().join(".claude")).expect("create .claude");
+    tmp
+}
+
+/// Missing-hook home plus one tracked record (via `rtk proxy true`, which
+/// records usage with 0% reduction).
+fn seeded_home() -> TempDir {
+    let tmp = missing_hook_home();
+    let out = common::rtk_command()
+        .args(["proxy", "true"])
+        .envs(isolating_env(tmp.path()))
+        .env("LC_ALL", "C")
+        .output()
+        .expect("spawn rtk proxy seed");
+    assert!(
+        out.status.success(),
+        "rtk proxy true failed: {}",
+        String::from_utf8_lossy(&out.stderr)
+    );
+    tmp
+}
+
+#[test]
+fn default_view_with_data_warns_exactly_once_on_stderr() {
+    let home = seeded_home();
+    let (stdout, stderr) = gain_split(&["gain"], home.path());
+    assert_eq!(
+        count(&format!("{stdout}{stderr}"), NEEDLE),
+        1,
+        "warning must appear exactly once"
+    );
+    assert!(
+        !stdout.contains(NEEDLE),
+        "warning must be routed to stderr, not stdout"
+    );
+}
+
+#[test]
+fn daily_view_warns_exactly_once() {
+    let home = seeded_home();
+    assert_eq!(count(&gain(&["gain", "--daily"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn weekly_view_warns_exactly_once() {
+    let home = seeded_home();
+    assert_eq!(count(&gain(&["gain", "--weekly"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn monthly_view_warns_exactly_once() {
+    let home = seeded_home();
+    assert_eq!(count(&gain(&["gain", "--monthly"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn all_view_warns_exactly_once() {
+    let home = seeded_home();
+    assert_eq!(count(&gain(&["gain", "--all"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn empty_database_still_warns_once() {
+    // The rtk-ai/rtk#4035 regression: empty tracking data must not swallow
+    // the hook warning (it explains WHY there is no data).
+    let home = missing_hook_home();
+    assert_eq!(count(&gain(&["gain"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn json_export_is_warning_free() {
+    let home = seeded_home();
+    let (stdout, stderr) = gain_split(&["gain", "--format", "json"],
```

---

### Incident Patch 4: `7231fd2e` (2026-09-19)
**Commit Message**: fix(gain): report a missing hook on every view

`rtk gain` only reported a missing or outdated hook on the default view with
tracking data, so `--daily`, `--weekly`, `--monthly`, `--all` and the empty
report stayed silent. The empty report is where the advice matters most: with
no hook nothing is tracked, which is the likeliest reason there is nothing to
show.

Hoist the check into `warn_hook_issues()` and call it once, above the
empty-report early return and outside the view branch. The JSON and CSV
exports return earlier and stay free of it. `suppress_hook_warning` keeps
hiding the missing-hook arm, and keeps leaving the outdated-hook arm visible.

The tests spawn the binary through `common::rtk_command()` and pin `HOME`,
`RTK_DB_PATH` and the `XDG_*` directories onto a temporary home, so a runner
that exports any of them cannot reach past it.

Co-Authored-By: Angel V. Rodriguez C. <[REDACTED_EMAIL]>
Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/analytics/gain.rs` (modified, +30/-23)
```diff
@@ -12,6 +12,31 @@ use serde::Serialize;
 use std::io::IsTerminal;
 use std::path::PathBuf;
 
+/// Reports a missing or outdated hook on stderr.
+///
+/// `suppress_hook_warning` hides the missing-hook arm: a user who runs rtk
+/// without hooks on purpose reads this report most often. The outdated-hook
+/// arm stays visible either way.
+fn warn_hook_issues() {
+    match hook_check::status() {
+        hook_check::HookStatus::Missing if !crate::core::config::hook_warning_suppressed() => {
+            eprintln!(
+                "{}",
+                "[warn] No hook installed — run `rtk init -g` for automatic token savings".yellow()
+            );
+            eprintln!();
+        }
+        hook_check::HookStatus::Outdated => {
+            eprintln!(
+                "{}",
+                "[warn] Hook outdated — run `rtk init -g` to update".yellow()
+            );
+            eprintln!();
+        }
+        hook_check::HookStatus::Missing | hook_check::HookStatus::Ok => {}
+    }
+}
+
 #[allow(clippy::too_many_arguments)]
 pub fn run(
     project: bool, // added: per-project scope flag
@@ -93,6 +118,11 @@ pub fn run(
         eprintln!();
     }
 
+    // Reported for every text view, including the empty one: with no hook
+    // nothing is tracked, so a missing hook is the likeliest reason there is
+    // nothing to show. The JSON and CSV exports return earlier and stay clean.
+    warn_hook_issues();
+
     if summary.total_commands == 0 {
         println!("No tracking data yet.");
         println!("Run some rtk commands to start tracking savings.");
@@ -138,29 +168,6 @@ pub fn run(
         print_efficiency_meter(summary.avg_savings_pct);
         println!();
 
-        // Warn about hook issues that silently kill savings (stderr, not stdout).
-        // `suppress_hook_warning` hides the missing-hook arm here too: a user who
-        // runs rtk without hooks on purpose reads this report most often, and the
-        // outdated-hook arm stays visible either way.
-        match hook_check::status() {
-            hook_check::HookStatus::Missing if !crate::core::config::hook_warning_suppressed() => {
-                eprintln!(
-                    "{}",
-                    "[warn] No hook installed — run `rtk init -g` for automatic token savings"
-                        .yellow()
-                );
-                eprintln!();
-            }
-            hook_check::HookStatus::Outdated => {
-                eprintln!(
-                    "{}",
-                    "[warn] Hook outdated — run `rtk init -g` to update".yellow()
-                );
-                eprintln!();
-            }
-            hook_check::HookStatus::Missing | hook_check::HookStatus::Ok => {}
-        }
-
         // Lightweight RTK_DISABLED bypass check (best-effort, silent on failure)
         if let Some(warning) = check_rtk_disabled_bypass() {
             eprintln!("{}", warning.yellow());
```

**File**: `tests/gain_hook_warning_test.rs` (added, +272/-0)
```diff
@@ -0,0 +1,272 @@
+//! Integration tests: `rtk gain` hook-status warning coverage.
+//!
+//! Matrix contributed by @AngelVRodC in rtk-ai/rtk#4039.
+//!
+//! Change: fix-gain-hook-warning (rtk-ai/rtk#4035) — the missing-hook warning
+//! must appear on every text view (default, --daily, --weekly, --monthly,
+//! --all) and on the empty-database report, exactly once per invocation.
+//! JSON/CSV exports stay warning-free; the not-applicable state (no ~/.claude)
+//! stays silent.
+#![cfg(unix)]
+
+use std::path::Path;
+use tempfile::TempDir;
+
+mod common;
+
+const NEEDLE: &str = "[warn] No hook installed";
+
+/// Pins every directory the binary resolves from the environment, so a runner
+/// that exports `XDG_*` cannot reach past the temporary home.
+fn isolating_env(home: &Path) -> Vec<(String, std::ffi::OsString)> {
+    vec![
+        ("HOME".into(), home.as_os_str().to_owned()),
+        ("RTK_DB_PATH".into(), home.join("rtk.db").into_os_string()),
+        (
+            "XDG_CONFIG_HOME".into(),
+            home.join(".config").into_os_string(),
+        ),
+        (
+            "XDG_DATA_HOME".into(),
+            home.join(".local").join("share").into_os_string(),
+        ),
+    ]
+}
+
+/// Run `rtk gain <args>` with HOME isolated to `home`, returning
+/// (stdout, stderr) as lossy UTF-8 strings.
+fn gain_split(args: &[&str], home: &Path) -> (String, String) {
+    gain_split_env(args, home, &[])
+}
+
+/// As `gain_split`, with extra environment variables applied.
+fn gain_split_env(args: &[&str], home: &Path, env: &[(&str, &str)]) -> (String, String) {
+    // `rtk_command` clears the inherited `RTK_*` and agent-home variables and
+    // pins rtk's own paths; `isolating_env` then moves them onto this test's
+    // temporary home. `LC_ALL` is this test's to set: it reads rtk's own
+    // wording, not a native tool's.
+    let mut cmd = common::rtk_command();
+    cmd.args(args).envs(isolating_env(home)).env("LC_ALL", "C");
+    for (key, value) in env {
+        cmd.env(key, value);
+    }
+    let output = cmd.output().expect("spawn rtk gain");
+    assert!(
+        output.status.success(),
+        "rtk gain {} failed: {}",
+        args.join(" "),
+        String::from_utf8_lossy(&output.stderr)
+    );
+    (
+        String::from_utf8_lossy(&output.stdout).into_owned(),
+        String::from_utf8_lossy(&output.stderr).into_owned(),
+    )
+}
+
+/// Combined stdout+stderr (ANSI codes wrap, never split, the needle).
+fn gain(args: &[&str], home: &Path) -> String {
+    let (out, err) = gain_split(args, home);
+    format!("{out}{err}")
+}
+
+fn count(haystack: &str, needle: &str) -> usize {
+    haystack.matches(needle).count()
+}
+
+/// HOME with a `.claude` dir but no hook registered → status() == Missing.
+fn missing_hook_home() -> TempDir {
+    let tmp = tempfile::tempdir().expect("tempdir");
+    std::fs::create_dir_all(tmp.path().join(".claude")).expect("create .claude");
+    tmp
+}
+
+/// Missing-hook home plus one tracked record (via `rtk proxy true`, which
+/// records usage with 0% reduction).
+fn seeded_home() -> TempDir {
+    let tmp = missing_hook_home();
+    let out = common::rtk_command()
+        .args(["proxy", "true"])
+        .envs(isolating_env(tmp.path()))
+        .env("LC_ALL", "C")
+        .output()
+        .expect("spawn rtk proxy seed");
+    assert!(
+        out.status.success(),
+        "rtk proxy true failed: {}",
+        String::from_utf8_lossy(&out.stderr)
+    );
+    tmp
+}
+
+#[test]
+fn default_view_with_data_warns_exactly_once_on_stderr() {
+    let home = seeded_home();
+    let (stdout, stderr) = gain_split(&["gain"], home.path());
+    assert_eq!(
+        count(&format!("{stdout}{stderr}"), NEEDLE),
+        1,
+        "warning must appear exactly once"
+    );
+    assert!(
+        !stdout.contains(NEEDLE),
+        "warning must be routed to stderr, not stdout"
+    );
+}
+
+#[test]
+fn daily_view_warns_exactly_once() {
+    let home = seeded_home();
+    assert_eq!(count(&gain(&["gain", "--daily"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn weekly_view_warns_exactly_once() {
+    let home = seeded_home();
+    assert_eq!(count(&gain(&["gain", "--weekly"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn monthly_view_warns_exactly_once() {
+    let home = seeded_home();
+    assert_eq!(count(&gain(&["gain", "--monthly"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn all_view_warns_exactly_once() {
+    let home = seeded_home();
+    assert_eq!(count(&gain(&["gain", "--all"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn empty_database_still_warns_once() {
+    // The rtk-ai/rtk#4035 regression: empty tracking data must not swallow
+    // the hook warning (it explains WHY there is no data).
+    let home = missing_hook_home();
+    assert_eq!(count(&gain(&["gain"], home.path()), NEEDLE), 1);
+}
+
+#[test]
+fn json_export_is_warning_free() {
+    let home = seeded_home();
+    let (stdout, stderr) = gain_split(&["gain", "--format", "json"],
```

---

### Incident Patch 5: `4ddc78d5` (2026-10-05)
**Commit Message**: fix(hooks): skip the OpenCode rewrite when it would change the verdict

OpenCode never consults plugins through permission.ask — no release from
1.1.4 to 2.0.22 has a trigger site for it — so the status channel could
not deliver the verdict and #4195's allowed command stayed blocked, while
an ask rule could be silently bypassed by the rewrite un-matching it.

Replace the channel with the one mechanism that works on every version:
judge both the typed command and its rtk form against OpenCode's own
rules, and answer {} whenever the rewrite would change the verdict.
OpenCode then runs the typed command under the user's own policy; an
allow stays an allow, an ask stays a prompt, a deny stays denied. The
plugin loses permission.ask, the pending map and the status field.

Also post-rebase on develop: config discovery goes through user_dirs
(home, current_dir, env_path) and OPENCODE_CONFIG joins INHERITED_VARS,
so the test-isolation guards hold; rules load once per answer instead of
twice; and tests pin the answer rows, config discovery order, agent-block
ordering, in-process routing and the deny-before-unattestable aggregation.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `hooks/opencode/README.md` (modified, +7/-2)
```diff
@@ -5,7 +5,12 @@
 ## Specifics
 
 - TypeScript plugin using the zx library (not a shell hook)
-- Intercepts `tool.execute.before` events, calls `rtk rewrite` as a subprocess
+- Intercepts `tool.execute.before` events, calls `rtk hook opencode` as a subprocess
+- The Rust side judges the command against OpenCode's own permission rules
+  (root and project `opencode.json`/`.jsonc`, last match wins) and answers `{}`
+  whenever the rewrite would change the verdict those rules give — OpenCode
+  evaluates the final command itself, so RTK never lifts a deny, silences an
+  ask, or blocks an allow (#4195)
 - Uses `.quiet().nothrow()` to silently ignore failures
-- Mutates `args.command` in-place if rewrite differs from original
+- Mutates `args.command` in-place if the answered rewrite differs from original
 - Installed to `~/.config/opencode/plugins/rtk.ts` by `rtk init -g --opencode`
```

**File**: `hooks/opencode/rtk.ts` (modified, +13/-29)
```diff
@@ -1,15 +1,20 @@
 import type { Plugin } from "@opencode-ai/plugin"
 
 // RTK OpenCode plugin — rewrites commands to use rtk for token savings.
-// Requires: rtk >= 0.23.0 in PATH.
+// Requires: an rtk with the `rtk hook opencode` subcommand (newer than
+// v0.51). An older rtk answers nothing, so commands pass through unrewritten
+// rather than breaking.
 //
-// This is a thin delegating plugin: all rewrite logic lives in `rtk hook opencode`,
-// which is the single source of truth (src/discover/registry.rs).
-// To add or change rewrite rules, edit the Rust registry — not this file.
+// This is a thin delegating plugin: all rewrite and permission logic lives
+// in `rtk hook opencode`, which is the single source of truth
+// (src/discover/registry.rs). It judges the command against OpenCode's own
+// permission rules and answers `{}` whenever the rewrite would change what
+// those rules decide — OpenCode evaluates the final command itself, so a
+// rewrite RTK does return never lifts a deny, silences an ask, or blocks an
+// allow. To add or change rewrite rules, edit the Rust registry — not this
+// file.
 
-type Answer = { command?: string; status?: "allow" | "ask" | "deny" }
-
-const MAX_PENDING = 256
+type Answer = { command?: string }
 
 export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
   try {
@@ -19,17 +24,6 @@ export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
     return {}
   }
 
-  const pending = new Map<string, "allow" | "ask" | "deny">()
-
-  const remember = (callID: string | undefined, status: Answer["status"]) => {
-    if (!callID || !status) return
-    if (pending.size >= MAX_PENDING) {
-      const oldest = pending.keys().next()
-      if (!oldest.done) pending.delete(oldest.value)
-    }
-    pending.set(callID, status)
-  }
-
   return {
     "tool.execute.before": async (input, output) => {
       const tool = String(input?.tool ?? "").toLowerCase()
@@ -43,22 +37,12 @@ export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
       try {
         const result = await $`rtk hook opencode ${command}`.quiet().nothrow()
         const answer = JSON.parse(String(result.stdout).trim() || "{}") as Answer
-        remember(input?.callID, answer.status)
         if (answer.command && answer.command !== command) {
           ;(args as Record<string, unknown>).command = answer.command
         }
       } catch {
-        // rtk rewrite failed — pass through unchanged
+        // rtk hook opencode failed or answered nothing — pass through unchanged
       }
     },
-
-    "permission.ask": async (input, output) => {
-      const callID = input?.callID
-      if (!callID) return
-      const status = pending.get(callID)
-      if (!status) return
-      pending.delete(callID)
-      output.status = status
-    },
   }
 }
```

**File**: `src/core/test_isolation/scratch.rs` (modified, +2/-1)
```diff
@@ -127,13 +127,14 @@ fn remove_at_exit(dir: &Path) {
 /// whether a project's settings are read; the CI indicators the filter-trust
 /// override checks; and Composer's bin directory, which decides which tool a
 /// PHP command runs.
-const INHERITED_VARS: [&str; 13] = [
+const INHERITED_VARS: [&str; 14] = [
     "CLAUDE_CONFIG_DIR",
     "CODEX_HOME",
     "HERMES_HOME",
     "COPILOT_HOME",
     "PI_CODING_AGENT_DIR",
     "FACTORY_HOME_OVERRIDE",
+    "OPENCODE_CONFIG",
     "GEMINI_CLI_TRUST_WORKSPACE",
     "CI",
     "GITHUB_ACTIONS",
```

**File**: `src/hooks/decision.rs` (modified, +15/-3)
```diff
@@ -193,9 +193,10 @@ pub(crate) fn decide_for_agent(cmd: &str, verdict: PermissionVerdict) -> HookDec
 /// so it refuses the command and tells the user to re-run the very thing they
 /// ran; Cursor raises a permission prompt for it. The plugins that shell out to
 /// `rtk rewrite` reach the same outcome in their own code --
-/// `hooks/opencode/rtk.ts`, `hooks/pi/rtk.ts` (shared with omp),
-/// `hooks/hermes/rtk-rewrite/__init__.py` and `openclaw/index.ts` all gate on
-/// `rewritten != command`.
+/// `hooks/pi/rtk.ts` (shared with omp), `hooks/hermes/rtk-rewrite/__init__.py`
+/// and `openclaw/index.ts` all gate on `rewritten != command`.
+/// `hooks/opencode/rtk.ts` shells out to `rtk hook opencode` instead, which
+/// goes through here in-process and answers `{}` for the no-op.
 ///
 /// `Defer` is not uniformly neutral, though: Gemini renders it as `ask_user`,
 /// so there suppression trades a no-op rewrite for a confirmation prompt even
@@ -498,6 +499,17 @@ mod tests {
         }
     }
 
+    /// OpenCode decides in-process against its own rules. On `ViaRewrite` the
+    /// plugin and `rtk hook check --agent opencode` would silently drift back
+    /// to judging against Claude Code's settings (#4195).
+    #[test]
+    fn opencode_is_judged_in_process_against_its_own_host() {
+        assert!(matches!(
+            AgentPath::lookup("opencode"),
+            Some(AgentPath::InProcess(Host::OpenCode))
+        ));
+    }
+
     /// Everything advertised in the error message must actually resolve.
     #[test]
     fn every_listed_agent_resolves() {
```

**File**: `src/hooks/hook_cmd.rs` (modified, +146/-46)
```diff
@@ -6,6 +6,7 @@
 use super::constants::PRE_TOOL_USE_KEY;
 use super::decision::{self, HookDecision};
 use super::permissions::{self, PermissionVerdict};
+use super::permissions_opencode;
 use anyhow::{Context, Result};
 use serde_json::{Value, json};
 use std::io::{self, Read, Write};
@@ -1193,46 +1194,56 @@ fn droid_response_from_decision(v: &Value, cmd: &str, decision: HookDecision) ->
     Some(pre_tool_use_rewrite_output(v, &rewritten, None))
 }
 
-/// Run the Factory Droid PreToolUse hook natively.
+/// Answer OpenCode's plugin: the rewrite as JSON, or `{}` to leave the
+/// command untouched.
 pub fn run_opencode(cmd: &str, agent: Option<&str>) -> Result<()> {
-    let _ = writeln!(io::stdout(), "{}", opencode_answer(cmd, agent));
+    let _ = writeln!(io::stdout(), "{}", opencode_answer_for(cmd, agent));
     Ok(())
 }
 
-fn opencode_answer(cmd: &str, agent: Option<&str>) -> Value {
+/// [`opencode_answer`] against the rules OpenCode resolves for `agent`.
+fn opencode_answer_for(cmd: &str, agent: Option<&str>) -> Value {
+    let rules = permissions_opencode::load_opencode_rules(agent);
+    opencode_answer(cmd, &rules)
+}
+
+/// Decide what the plugin should do with `cmd` under OpenCode's own rules.
+///
+/// OpenCode evaluates whatever command the plugin hands back against the
+/// user's permission rules itself — plugins cannot influence that verdict
+/// (no OpenCode release triggers a `permission.ask` plugin hook, verified
+/// on 1.1.4–2.0.22). So the one thing RTK must guarantee is that the
+/// rewrite never changes what those rules decide: whenever the verdict for
+/// `rtk <cmd>` differs from the verdict for `cmd` as typed, RTK steps aside
+/// and returns `{}`, trading token savings on that command for the user's
+/// own policy (#4195). An allow stays an allow, an ask stays a prompt, and
+/// a deny stays denied — RTK never blocks, lifts or silences anything.
+fn opencode_answer(cmd: &str, rules: &[permissions_opencode::Rule]) -> Value {
     if cmd.trim().is_empty() {
         return json!({});
     }
-    let verdict = permissions::check_command_for_agent(cmd, permissions::Host::OpenCode, agent);
-    let rewritten = match decide_from_verdict(cmd, verdict) {
+    let before = permissions_opencode::check_command_with_opencode_rules(cmd, rules);
+    let rewritten = match decide_from_verdict(cmd, before) {
+        // OpenCode denies the typed command itself; a rewrite could only
+        // un-match the deny rule.
         HookDecision::Deny => {
             audit_log("deny", cmd, "");
-            return json!({ "status": "deny" });
+            return json!({});
         }
         HookDecision::Defer => return json!({}),
         HookDecision::AllowRewrite(r) | HookDecision::AskRewrite(r) => r,
     };
-    audit_log("rewrite", cmd, &rewritten);
 
-    let after =
-        permissions::check_command_for_agent(&rewritten, permissions::Host::OpenCode, agent);
-    match opencode_status(verdict, after) {
-        Some(status) => json!({ "command": rewritten, "status": status }),
-        None => json!({ "command": rewritten }),
+    let after = permissions_opencode::check_command_with_opencode_rules(&rewritten, rules);
+    if before != after {
+        return json!({});
     }
-}
 
-fn opencode_status(before: PermissionVerdict, after: PermissionVerdict) -> Option<&'static str> {
-    if before == after {
-        return None;
-    }
-    Some(match before {
-        PermissionVerdict::Allow => "allow",
-        PermissionVerdict::Deny => "deny",
-        PermissionVerdict::Ask | PermissionVerdict::Default => "ask",
-    })
+    audit_log("rewrite", cmd, &rewritten);
+    json!({ "command": rewritten })
 }
 
+/// Run the Factory Droid PreToolUse hook natively.
 pub fn run_droid() -> Result<()> {
     let input = read_stdin_limited()?;
 
@@ -2602,32 +2613,121 @@ mod tests {
         let _ = run_claude_inner(&input);
     }
 
-    #[test]
-    fn opencode_reports_no_status_when_the_rewrite_keeps_the_verdict() {
-        for v in [
-            PermissionVerdict::Allow,
-            PermissionVerdict::Ask,
-            PermissionVerdict::Default,
-            PermissionVerdict::Deny,
-        ] {
-            assert_eq!(super::opencode_status(v, v), None);
+    // --- OpenCode: the answer the plugin acts on ---
+    //
+    // OpenCode judges whatever command runs against the user's own rules;
+    // plugins cannot change that verdict. So the invariant pinned here is:
+    // a rewrite is returned only when it leaves the verdict untouched.
+
+    mod opencode_answer {
+        use super::super::opencode_answer;
+        use crate::hooks::permissions_opencode::{Action, Rule};
+        use serde_json::json;
+
+        fn rule(pattern: &str, action: Action) -> Rule {
+            Rule {
+                permission: "bash".to_string(),
+                pattern: pattern.to_string(),
+                action,
+            }
         }
-    }
 
-    #[test]
-    fn opencode_reports_the_original_v
```

**File**: `src/hooks/permissions_opencode.rs` (modified, +191/-14)
```diff
@@ -1,5 +1,6 @@
 use super::constants::{CONFIG_DIR, OPENCODE_SUBDIR};
 use super::permissions::PermissionVerdict;
+use crate::core::user_dirs;
 use crate::discover::lexer::{contains_unattestable_construct, split_for_permissions};
 use serde_json::Value;
 use std::path::{Path, PathBuf};
@@ -88,10 +89,9 @@ pub(crate) fn evaluate(cmd: &str, rules: &[Rule]) -> Option<Action> {
 }
 
 pub(crate) fn check_command_with_opencode_rules(cmd: &str, rules: &[Rule]) -> PermissionVerdict {
+    // `split_for_permissions` returns trimmed, non-empty segments only.
     let actions: Vec<Option<Action>> = split_for_permissions(cmd)
         .iter()
-        .map(|segment| segment.trim())
-        .filter(|segment| !segment.is_empty())
         .map(|segment| evaluate(segment, rules))
         .collect();
 
@@ -107,7 +107,7 @@ pub(crate) fn check_command_with_opencode_rules(cmd: &str, rules: &[Rule]) -> Pe
         return PermissionVerdict::Default;
     }
 
-    if !rules.is_empty() && actions.iter().all(|a| *a == Some(Action::Allow)) {
+    if actions.iter().all(|a| *a == Some(Action::Allow)) {
         return PermissionVerdict::Allow;
     }
 
@@ -167,7 +167,7 @@ fn append_rules(permission: &Value, rules: &mut Vec<Rule>) {
 fn opencode_configs() -> Vec<Value> {
     let mut configs = Vec::new();
 
-    if let Some(path) = std::env::var_os("OPENCODE_CONFIG") {
+    if let Some(path) = user_dirs::env_path("OPENCODE_CONFIG") {
         if let Some(v) = read_config(Path::new(&path)) {
             configs.push(v);
         }
@@ -183,19 +183,14 @@ fn opencode_configs() -> Vec<Value> {
 }
 
 fn global_opencode_dir() -> Option<PathBuf> {
-    Some(dirs::home_dir()?.join(CONFIG_DIR).join(OPENCODE_SUBDIR))
+    Some(user_dirs::home()?.join(CONFIG_DIR).join(OPENCODE_SUBDIR))
 }
 
 fn project_root_with_config() -> Option<PathBuf> {
-    let mut dir = std::env::current_dir().ok()?;
-    loop {
-        if CONFIG_NAMES.iter().any(|name| dir.join(name).is_file()) {
-            return Some(dir);
-        }
-        if !dir.pop() {
-            return None;
-        }
-    }
+    let start = user_dirs::current_dir().ok()?;
+    user_dirs::ancestors(&start)
+        .find(|dir| CONFIG_NAMES.iter().any(|name| dir.join(name).is_file()))
+        .map(Path::to_path_buf)
 }
 
 const CONFIG_NAMES: [&str; 2] = ["opencode.json", "opencode.jsonc"];
@@ -364,6 +359,26 @@ mod tests {
         );
     }
 
+    #[test]
+    fn an_ask_rule_reports_ask_not_default() {
+        let rules = [rule("git push *", Action::Ask)];
+        assert_eq!(
+            check_command_with_opencode_rules("git push origin main", &rules),
+            PermissionVerdict::Ask
+        );
+    }
+
+    #[test]
+    fn a_denied_segment_pre_empts_the_unattestable_ask() {
+        // Deny is checked before the unattestable gate: a command that is both
+        // must report Deny, or a deny rule could be softened to a prompt.
+        let rules = [rule("rm *", Action::Deny)];
+        assert_eq!(
+            check_command_with_opencode_rules("echo $(date) && rm -rf /", &rules),
+            PermissionVerdict::Deny
+        );
+    }
+
     #[test]
     fn config_rules_keep_the_order_the_file_declares() {
         let config: Value = serde_json::from_str(
@@ -395,4 +410,166 @@ mod tests {
         append_rules(&config, &mut rules);
         assert!(rules.is_empty());
     }
+
+    // --- Config discovery (runs against the test scratch, never the
+    // developer's own ~/.config/opencode or working directory) ---
+
+    use crate::core::test_isolation;
+    use crate::core::user_env;
+
+    fn write_json(path: &Path, content: &str) {
+        std::fs::create_dir_all(path.parent().expect("config path has a parent"))
+            .expect("create config directory");
+        std::fs::write(path, content).expect("write config file");
+    }
+
+    #[test]
+    fn a_project_config_is_found_from_a_subdirectory() {
+        let tmp = test_isolation::tempdir();
+        let root = tmp.path().join("project");
+        let sub = root.join("src").join("deep");
+        std::fs::create_dir_all(&sub).expect("create subdirectory");
+        write_json(
+            &root.join("opencode.json"),
+            r#"{ "permission": { "bash": "deny" } }"#,
+        );
+
+        test_isolation::with_root(&tmp.path().join("home"), || {
+            let _entered = test_isolation::enter(&sub);
+            let rules = load_opencode_rules(None);
+            assert_eq!(rules, vec![rule("*", Action::Deny)]);
+        });
+    }
+
+    #[test]
+    fn the_project_rule_wins_because_it_loads_after_the_global_one() {
+        let tmp = test_isolation::tempdir();
+        let home = tmp.path().join("home");
+        write_json(
+            &home
+                .join(CONFIG_DIR)
+                .join(OPENCODE_SUBDIR)
+                .join("opencode.json"),
+            r#"{ "permission": { "bash": { "git *": "deny" } } }"#,
+        );
+        let project = tmp.path().join("project");
+        write_jso
```

**File**: `src/main.rs` (modified, +2/-1)
```diff
@@ -1013,7 +1013,8 @@ enum HookCommands {
     Antigravity,
     /// Process Mistral Vibe CLI pre_tool hook (reads JSON from stdin)
     Vibe,
-    /// Answer for OpenCode's plugin: the rewrite and the verdict, as JSON
+    /// Answer for OpenCode's plugin: the rewrite as JSON, or `{}` when
+    /// rewriting would change what OpenCode's own permission rules decide
     Opencode {
         /// Active OpenCode agent, when its rules scope permissions by one
         #[arg(long)]
```

---

### Incident Patch 6: `08576295` (2026-09-29)
**Commit Message**: fix(hooks): report a status to OpenCode only when the rewrite changes it

**File**: `src/hooks/hook_cmd.rs` (modified, +51/-11)
```diff
@@ -1204,23 +1204,35 @@ fn opencode_answer(cmd: &str, agent: Option<&str>) -> Value {
         return json!({});
     }
     let verdict = permissions::check_command_for_agent(cmd, permissions::Host::OpenCode, agent);
-    match decide_from_verdict(cmd, verdict) {
+    let rewritten = match decide_from_verdict(cmd, verdict) {
         HookDecision::Deny => {
             audit_log("deny", cmd, "");
-            json!({ "status": "deny" })
+            return json!({ "status": "deny" });
         }
-        HookDecision::AllowRewrite(rewritten) => {
-            audit_log("rewrite", cmd, &rewritten);
-            json!({ "command": rewritten, "status": "allow" })
-        }
-        HookDecision::AskRewrite(rewritten) => {
-            audit_log("rewrite", cmd, &rewritten);
-            json!({ "command": rewritten, "status": "ask" })
-        }
-        HookDecision::Defer => json!({}),
+        HookDecision::Defer => return json!({}),
+        HookDecision::AllowRewrite(r) | HookDecision::AskRewrite(r) => r,
+    };
+    audit_log("rewrite", cmd, &rewritten);
+
+    let after =
+        permissions::check_command_for_agent(&rewritten, permissions::Host::OpenCode, agent);
+    match opencode_status(verdict, after) {
+        Some(status) => json!({ "command": rewritten, "status": status }),
+        None => json!({ "command": rewritten }),
     }
 }
 
+fn opencode_status(before: PermissionVerdict, after: PermissionVerdict) -> Option<&'static str> {
+    if before == after {
+        return None;
+    }
+    Some(match before {
+        PermissionVerdict::Allow => "allow",
+        PermissionVerdict::Deny => "deny",
+        PermissionVerdict::Ask | PermissionVerdict::Default => "ask",
+    })
+}
+
 pub fn run_droid() -> Result<()> {
     let input = read_stdin_limited()?;
 
@@ -2590,6 +2602,34 @@ mod tests {
         let _ = run_claude_inner(&input);
     }
 
+    #[test]
+    fn opencode_reports_no_status_when_the_rewrite_keeps_the_verdict() {
+        for v in [
+            PermissionVerdict::Allow,
+            PermissionVerdict::Ask,
+            PermissionVerdict::Default,
+            PermissionVerdict::Deny,
+        ] {
+            assert_eq!(super::opencode_status(v, v), None);
+        }
+    }
+
+    #[test]
+    fn opencode_reports_the_original_verdict_when_the_rewrite_changes_it() {
+        assert_eq!(
+            super::opencode_status(PermissionVerdict::Allow, PermissionVerdict::Deny),
+            Some("allow")
+        );
+        assert_eq!(
+            super::opencode_status(PermissionVerdict::Default, PermissionVerdict::Deny),
+            Some("ask")
+        );
+        assert_eq!(
+            super::opencode_status(PermissionVerdict::Ask, PermissionVerdict::Allow),
+            Some("ask")
+        );
+    }
+
     #[test]
     fn test_cursor_deny_blocks_rewrite() {
         use super::permissions::check_command_with_rules;
```

---

### Incident Patch 7: `aaa8ad0b` (2026-09-29)
**Commit Message**: fix(hooks): judge OpenCode against its own permission rules

**File**: `hooks/opencode/rtk.ts` (modified, +30/-5)
```diff
@@ -3,10 +3,14 @@ import type { Plugin } from "@opencode-ai/plugin"
 // RTK OpenCode plugin — rewrites commands to use rtk for token savings.
 // Requires: rtk >= 0.23.0 in PATH.
 //
-// This is a thin delegating plugin: all rewrite logic lives in `rtk rewrite`,
+// This is a thin delegating plugin: all rewrite logic lives in `rtk hook opencode`,
 // which is the single source of truth (src/discover/registry.rs).
 // To add or change rewrite rules, edit the Rust registry — not this file.
 
+type Answer = { command?: string; status?: "allow" | "ask" | "deny" }
+
+const MAX_PENDING = 256
+
 export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
   try {
     await $`which rtk`.quiet()
@@ -15,6 +19,17 @@ export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
     return {}
   }
 
+  const pending = new Map<string, "allow" | "ask" | "deny">()
+
+  const remember = (callID: string | undefined, status: Answer["status"]) => {
+    if (!callID || !status) return
+    if (pending.size >= MAX_PENDING) {
+      const oldest = pending.keys().next()
+      if (!oldest.done) pending.delete(oldest.value)
+    }
+    pending.set(callID, status)
+  }
+
   return {
     "tool.execute.before": async (input, output) => {
       const tool = String(input?.tool ?? "").toLowerCase()
@@ -26,14 +41,24 @@ export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
       if (typeof command !== "string" || !command) return
 
       try {
-        const result = await $`rtk rewrite ${command}`.quiet().nothrow()
-        const rewritten = String(result.stdout).trim()
-        if (rewritten && rewritten !== command) {
-          ;(args as Record<string, unknown>).command = rewritten
+        const result = await $`rtk hook opencode ${command}`.quiet().nothrow()
+        const answer = JSON.parse(String(result.stdout).trim() || "{}") as Answer
+        remember(input?.callID, answer.status)
+        if (answer.command && answer.command !== command) {
+          ;(args as Record<string, unknown>).command = answer.command
         }
       } catch {
         // rtk rewrite failed — pass through unchanged
       }
     },
+
+    "permission.ask": async (input, output) => {
+      const callID = input?.callID
+      if (!callID) return
+      const status = pending.get(callID)
+      if (!status) return
+      pending.delete(callID)
+      output.status = status
+    },
   }
 }
```

**File**: `src/hooks/decision.rs` (modified, +2/-1)
```diff
@@ -292,7 +292,8 @@ impl AgentPath {
             // settings (#3908). Its deny gate is unaffected -- see
             // `ApprovalOwner`.
             "openclaw" => Some(Self::ViaRewrite(ApprovalOwner::Delegate)),
-            "hermes" | "omp" | "opencode" | "pi" => Some(Self::ViaRewrite(ApprovalOwner::Rtk)),
+            "opencode" => Some(Self::InProcess(Host::OpenCode)),
+            "hermes" | "omp" | "pi" => Some(Self::ViaRewrite(ApprovalOwner::Rtk)),
             "vibe" => Some(Self::InProcess(Host::Vibe)),
             _ => None,
         }
```

**File**: `src/hooks/hook_cmd.rs` (modified, +27/-0)
```diff
@@ -1194,6 +1194,33 @@ fn droid_response_from_decision(v: &Value, cmd: &str, decision: HookDecision) ->
 }
 
 /// Run the Factory Droid PreToolUse hook natively.
+pub fn run_opencode(cmd: &str, agent: Option<&str>) -> Result<()> {
+    let _ = writeln!(io::stdout(), "{}", opencode_answer(cmd, agent));
+    Ok(())
+}
+
+fn opencode_answer(cmd: &str, agent: Option<&str>) -> Value {
+    if cmd.trim().is_empty() {
+        return json!({});
+    }
+    let verdict = permissions::check_command_for_agent(cmd, permissions::Host::OpenCode, agent);
+    match decide_from_verdict(cmd, verdict) {
+        HookDecision::Deny => {
+            audit_log("deny", cmd, "");
+            json!({ "status": "deny" })
+        }
+        HookDecision::AllowRewrite(rewritten) => {
+            audit_log("rewrite", cmd, &rewritten);
+            json!({ "command": rewritten, "status": "allow" })
+        }
+        HookDecision::AskRewrite(rewritten) => {
+            audit_log("rewrite", cmd, &rewritten);
+            json!({ "command": rewritten, "status": "ask" })
+        }
+        HookDecision::Defer => json!({}),
+    }
+}
+
 pub fn run_droid() -> Result<()> {
     let input = read_stdin_limited()?;
 
```

**File**: `src/hooks/mod.rs` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ pub mod hook_cmd;
 pub mod init;
 pub mod integrity;
 pub mod permissions;
+pub mod permissions_opencode;
 pub mod rewrite_cmd;
 pub mod trust;
 pub mod verify_cmd;
```

**File**: `src/hooks/permissions.rs` (modified, +10/-0)
```diff
@@ -42,9 +42,18 @@ pub enum Host {
     Droid,
     Vibe,
     Antigravity,
+    OpenCode,
 }
 
 pub fn check_command_for(cmd: &str, host: Host) -> PermissionVerdict {
+    check_command_for_agent(cmd, host, None)
+}
+
+pub fn check_command_for_agent(cmd: &str, host: Host, agent: Option<&str>) -> PermissionVerdict {
+    if host == Host::OpenCode {
+        let rules = super::permissions_opencode::load_opencode_rules(agent);
+        return super::permissions_opencode::check_command_with_opencode_rules(cmd, &rules);
+    }
     let (deny_rules, ask_rules, allow_rules) = load_rules_for(host);
     check_command_with_rules(cmd, &deny_rules, &ask_rules, &allow_rules)
 }
@@ -68,6 +77,7 @@ pub(crate) fn load_rules_for(host: Host) -> (Vec<String>, Vec<String>, Vec<Strin
         Host::Codex | Host::Trae | Host::Vibe | Host::Antigravity => {
             (Vec::new(), Vec::new(), Vec::new())
         }
+        Host::OpenCode => (Vec::new(), Vec::new(), Vec::new()),
     }
 }
 
```

**File**: `src/hooks/permissions_opencode.rs` (added, +398/-0)
```diff
@@ -0,0 +1,398 @@
+use super::constants::{CONFIG_DIR, OPENCODE_SUBDIR};
+use super::permissions::PermissionVerdict;
+use crate::discover::lexer::{contains_unattestable_construct, split_for_permissions};
+use serde_json::Value;
+use std::path::{Path, PathBuf};
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(crate) enum Action {
+    Allow,
+    Ask,
+    Deny,
+}
+
+impl Action {
+    fn parse(raw: &str) -> Option<Self> {
+        match raw {
+            "allow" => Some(Self::Allow),
+            "ask" => Some(Self::Ask),
+            "deny" => Some(Self::Deny),
+            _ => None,
+        }
+    }
+}
+
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub(crate) struct Rule {
+    pub(crate) permission: String,
+    pub(crate) pattern: String,
+    pub(crate) action: Action,
+}
+
+pub(crate) fn wildcard_match(text: &str, pattern: &str) -> bool {
+    let text = text.replace('\\', "/");
+    let pattern = pattern.replace('\\', "/");
+
+    if let Some(base) = pattern.strip_suffix(" *")
+        && glob_match(&text, base)
+    {
+        return true;
+    }
+    glob_match(&text, &pattern)
+}
+
+fn glob_match(text: &str, pattern: &str) -> bool {
+    let t: Vec<char> = text.chars().collect();
+    let p: Vec<char> = pattern.chars().collect();
+    let (mut ti, mut pi) = (0usize, 0usize);
+    let mut star: Option<(usize, usize)> = None;
+
+    while ti < t.len() {
+        if pi < p.len() && (p[pi] == '?' || chars_eq(p[pi], t[ti])) {
+            ti += 1;
+            pi += 1;
+        } else if pi < p.len() && p[pi] == '*' {
+            pi += 1;
+            star = Some((pi, ti));
+        } else if let Some((resume_pi, resume_ti)) = star {
+            pi = resume_pi;
+            ti = resume_ti + 1;
+            star = Some((resume_pi, resume_ti + 1));
+        } else {
+            return false;
+        }
+    }
+
+    while pi < p.len() && p[pi] == '*' {
+        pi += 1;
+    }
+    pi == p.len()
+}
+
+#[cfg(windows)]
+fn chars_eq(a: char, b: char) -> bool {
+    a.eq_ignore_ascii_case(&b) || a.to_lowercase().eq(b.to_lowercase())
+}
+
+#[cfg(not(windows))]
+fn chars_eq(a: char, b: char) -> bool {
+    a == b
+}
+
+pub(crate) fn evaluate(cmd: &str, rules: &[Rule]) -> Option<Action> {
+    rules
+        .iter()
+        .rev()
+        .find(|rule| wildcard_match("bash", &rule.permission) && wildcard_match(cmd, &rule.pattern))
+        .map(|rule| rule.action)
+}
+
+pub(crate) fn check_command_with_opencode_rules(cmd: &str, rules: &[Rule]) -> PermissionVerdict {
+    let actions: Vec<Option<Action>> = split_for_permissions(cmd)
+        .iter()
+        .map(|segment| segment.trim())
+        .filter(|segment| !segment.is_empty())
+        .map(|segment| evaluate(segment, rules))
+        .collect();
+
+    if actions.contains(&Some(Action::Deny)) {
+        return PermissionVerdict::Deny;
+    }
+
+    if contains_unattestable_construct(cmd) {
+        return PermissionVerdict::Ask;
+    }
+
+    if actions.is_empty() {
+        return PermissionVerdict::Default;
+    }
+
+    if !rules.is_empty() && actions.iter().all(|a| *a == Some(Action::Allow)) {
+        return PermissionVerdict::Allow;
+    }
+
+    if actions.contains(&Some(Action::Ask)) {
+        return PermissionVerdict::Ask;
+    }
+
+    PermissionVerdict::Default
+}
+
+pub(crate) fn load_opencode_rules(agent: Option<&str>) -> Vec<Rule> {
+    let mut rules = Vec::new();
+    for config in opencode_configs() {
+        if let Some(permission) = config.get("permission") {
+            append_rules(permission, &mut rules);
+        }
+        if let Some(block) =
+            agent.and_then(|name| config.pointer(&format!("/agent/{name}/permission")))
+        {
+            append_rules(block, &mut rules);
+        }
+    }
+    rules
+}
+
+fn append_rules(permission: &Value, rules: &mut Vec<Rule>) {
+    let Some(entries) = permission.as_object() else {
+        return;
+    };
+    for (name, value) in entries {
+        match value {
+            Value::String(action) => {
+                if let Some(action) = Action::parse(action) {
+                    rules.push(Rule {
+                        permission: name.clone(),
+                        pattern: "*".to_string(),
+                        action,
+                    });
+                }
+            }
+            Value::Object(patterns) => {
+                for (pattern, action) in patterns {
+                    if let Some(action) = action.as_str().and_then(Action::parse) {
+                        rules.push(Rule {
+                            permission: name.clone(),
+                            pattern: pattern.clone(),
+                            action,
+                        });
+                    }
+                }
+            }
+            _ => {}
+        }
+    }
+}
+
+fn opencode_configs() -> Vec<Value> {
+    let mut configs = Vec::new();
+
+    if let Some(path) = std::env::var_os("OPENCODE_CONFIG") {
+        if let Some(v) = read_config(Path::ne
```

**File**: `src/main.rs` (modified, +13/-0)
```diff
@@ -1013,6 +1013,15 @@ enum HookCommands {
     Antigravity,
     /// Process Mistral Vibe CLI pre_tool hook (reads JSON from stdin)
     Vibe,
+    /// Answer for OpenCode's plugin: the rewrite and the verdict, as JSON
+    Opencode {
+        /// Active OpenCode agent, when its rules scope permissions by one
+        #[arg(long)]
+        agent: Option<String>,
+        /// Raw command to judge and rewrite
+        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
+        args: Vec<String>,
+    },
     /// Check how a command would be rewritten by the hook engine (dry-run)
     Check {
         /// Target agent
@@ -3074,6 +3083,10 @@ fn run_cli() -> Result<i32> {
                 hooks::hook_cmd::run_vibe()?;
                 0
             }
+            HookCommands::Opencode { agent, args } => {
+                hooks::hook_cmd::run_opencode(&args.join(" "), agent.as_deref())?;
+                0
+            }
             HookCommands::Check { agent, command } => {
                 // Answers the same question the hooks answer, through the same
                 // decision (`hooks::decision`) — not just "does a rewrite rule
```

---

### Incident Patch 8: `c356374f` (2026-10-03)
**Commit Message**: Merge pull request #1444 from matheus-meneses/fix/go-bench-fuzz-filter

fix(go): keep the final fuzz stats in the go test summary

**File**: `src/cmds/go/go_cmd.rs` (modified, +130/-0)
```diff
@@ -43,6 +43,7 @@ struct PackageResult {
     failed_tests: Vec<(String, Vec<String>)>, // (test_name, output_lines)
     package_failed: bool,                     // package-level failure (timeout, signal, etc.)
     package_fail_output: Vec<String>,         // output lines collected before the package fail
+    fuzz_summary: Option<String>,
 }
 
 pub fn run_test(args: &[String], verbose: u8) -> Result<i32> {
@@ -366,6 +367,10 @@ pub(crate) fn filter_go_test_json(output: &str) -> String {
             "output" => {
                 if let Some(output_text) = &event.output {
                     if let Some(test) = &event.test {
+                        // Keep the package's last fuzz progress line: Go prints the final stats there
+                        if output_text.starts_with("fuzz: elapsed:") {
+                            pkg_result.fuzz_summary = Some(output_text.trim_end().to_string());
+                        }
                         // Collect output for current test
                         let key = (package.clone(), test.clone());
                         current_test_output
@@ -405,6 +410,14 @@ pub(crate) fn filter_go_test_json(output: &str) -> String {
         return "Go test: No tests found".to_string();
     }
 
+    let total_fuzz = packages
+        .values()
+        .filter(|p| p.fuzz_summary.is_some())
+        .count();
+    if !has_failures && total_fuzz > 0 {
+        return format_fuzz_summary(&packages, total_pass, total_fuzz);
+    }
+
     if !has_failures {
         return format!(
             "Go test: {} passed in {} packages",
@@ -486,6 +499,32 @@ pub(crate) fn filter_go_test_json(output: &str) -> String {
     result.trim().to_string()
 }
 
+fn format_fuzz_summary(
+    packages: &HashMap<String, PackageResult>,
+    total_pass: usize,
+    total_fuzz: usize,
+) -> String {
+    let mut result = format!(
+        "Go test: {} passed, {} fuzz in {} packages\n",
+        total_pass,
+        total_fuzz,
+        packages.len()
+    );
+    let mut fuzzed: Vec<(&String, &String)> = packages
+        .iter()
+        .filter_map(|(pkg, r)| r.fuzz_summary.as_ref().map(|s| (pkg, s)))
+        .collect();
+    fuzzed.sort();
+    for (package, summary) in fuzzed {
+        result.push_str(&format!(
+            "{}\n  {}\n",
+            compact_package_name(package),
+            summary
+        ));
+    }
+    result.trim().to_string()
+}
+
 fn select_go_test_failure_lines(outputs: &[String]) -> Vec<String> {
     let mut relevant = Vec::new();
     let mut keep_next_context_line = false;
@@ -1132,4 +1171,95 @@ utils.go:15:5: unreachable code"#;
         assert!(!has_golangci_format_flag(&os(&[])));
         assert!(!has_golangci_format_flag(&os(&["--fix"])));
     }
+
+    #[test]
+    fn test_filter_go_test_fuzz_keeps_last_elapsed_line() {
+        let output = r#"{"Action":"start","Package":"example.com/foo"}
+{"Action":"run","Package":"example.com/foo","Test":"FuzzBar"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzBar","Output":"=== RUN   FuzzBar\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzBar","Output":"fuzz: elapsed: 0s, gathering baseline coverage: 0/6 completed\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzBar","Output":"fuzz: elapsed: 3s, execs: 224325 (74749/sec), new interesting: 0 (total: 6)\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzBar","Output":"fuzz: elapsed: 10s, execs: 842077 (78542/sec), new interesting: 0 (total: 6)\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzBar","Output":"--- PASS: FuzzBar (10.10s)\n"}
+{"Action":"pass","Package":"example.com/foo","Test":"FuzzBar","Elapsed":10.1}
+{"Action":"output","Package":"example.com/foo","Output":"PASS\n"}
+{"Action":"pass","Package":"example.com/foo","Elapsed":10.414}"#;
+
+        let result = filter_go_test_json(output);
+
+        assert_eq!(
+            result,
+            "Go test: 1 passed, 1 fuzz in 1 packages\nfoo\n  fuzz: elapsed: 10s, execs: 842077 (78542/sec), new interesting: 0 (total: 6)"
+        );
+    }
+
+    #[test]
+    fn test_filter_go_test_fuzz_with_unit_tests() {
+        let output = r#"{"Action":"pass","Package":"example.com/foo","Test":"TestUnit","Elapsed":0.01}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzBar","Output":"fuzz: elapsed: 3s, execs: 100000 (33333/sec), new interesting: 1 (total: 5)\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzBar","Output":"fuzz: elapsed: 5s, execs: 200000 (40000/sec), new interesting: 2 (total: 6)\n"}
+{"Action":"pass","Package":"example.com/foo","Test":"FuzzBar","Elapsed":5.0}
+{"Action":"pass","Package":"example.com/foo","Elapsed":5.1}"#;
+
+        let result = filter_go_test_json(output);
+
+        assert!(result.starts_with("Go test: 2 passed, 1 fuzz in 1 packages"));
+        assert!(result.contains("execs: 200000"));
+        assert!(!result.contains("execs: 100000"));
+    }
+
+    #[test]
+    fn test_filter_go_te
```

---

### Incident Patch 9: `58d25021` (2026-10-03)
**Commit Message**: fix(jest): run the hook integrity check for rtk jest, and pin what vitest and jest spawn

rtk jest was missing from is_operational_command, so a tampered legacy hook
that stops rtk vitest let rtk jest run.

run_vitest and run_jest now build a TestInvocation (framework, arguments,
passthrough) that run_framework_test executes, so tests can assert the
tool each one runs, its arguments and whether reporter output passes through.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/cmds/js/vitest_cmd.rs` (modified, +99/-56)
```diff
@@ -3,7 +3,6 @@
 use anyhow::{Context, Result};
 use regex::Regex;
 use serde::Deserialize;
-use std::process::Command;
 use std::sync::LazyLock;
 
 use crate::core::stream::exec_capture;
@@ -200,39 +199,74 @@ fn extract_failures_regex(output: &str) -> Vec<TestFailure> {
 }
 
 pub fn run_vitest(args: &[String], verbose: u8) -> Result<i32> {
-    let mut cmd = package_manager_exec("vitest");
-    let effective_args = build_vitest_effective_args(args);
-    cmd.args(effective_args.args);
-    run_framework_test("vitest", cmd, effective_args.passthrough, verbose)
+    run_framework_test(vitest_invocation(args), verbose)
 }
 
 pub fn run_jest(args: &[String], verbose: u8) -> Result<i32> {
-    let mut cmd = package_manager_exec("jest");
-    cmd
-        // Force non-watch mode
-        .arg("--no-watch")
-        // Enable JSON structured output
-        .arg("--json");
+    run_framework_test(jest_invocation(args), verbose)
+}
+
+/// What `rtk vitest` or `rtk jest` spawns: the tool, the arguments it gets,
+/// and whether the user's own reporter output is shown instead of parsed.
+struct TestInvocation {
+    framework: &'static str,
+    args: Vec<String>,
+    passthrough: bool,
+}
+
+fn vitest_invocation(args: &[String]) -> TestInvocation {
+    let passthrough = has_explicit_vitest_reporter(args);
+    let mut effective = vec!["run".to_string()];
+
+    if !passthrough {
+        effective.push("--reporter=json".to_string());
+    }
+
     for arg in args {
-        if arg == "run"
-            || arg.starts_with("--json")
-            || arg.starts_with("--reporter")
-            || arg.starts_with("--watch")
-        {
+        if should_skip_vitest_arg(arg) {
             continue;
         }
-        cmd.arg(arg);
+        effective.push(arg.clone());
+    }
+
+    TestInvocation {
+        framework: "vitest",
+        args: effective,
+        passthrough,
     }
-    run_framework_test("jest", cmd, false, verbose)
 }
 
-fn run_framework_test(
-    framework: &str,
-    mut cmd: Command,
-    passthrough_requested: bool,
-    verbose: u8,
-) -> Result<i32> {
+fn jest_invocation(args: &[String]) -> TestInvocation {
+    let mut effective = vec![
+        // Force non-watch mode
+        "--no-watch".to_string(),
+        // Enable JSON structured output
+        "--json".to_string(),
+    ];
+    effective.extend(
+        args.iter()
+            .filter(|arg| !should_skip_jest_arg(arg))
+            .cloned(),
+    );
+    TestInvocation {
+        framework: "jest",
+        args: effective,
+        passthrough: false,
+    }
+}
+
+fn should_skip_jest_arg(arg: &str) -> bool {
+    arg == "run"
+        || arg.starts_with("--json")
+        || arg.starts_with("--reporter")
+        || arg.starts_with("--watch")
+}
+
+fn run_framework_test(invocation: TestInvocation, verbose: u8) -> Result<i32> {
     let timer = tracking::TimedExecution::start();
+    let framework = invocation.framework;
+    let mut cmd = package_manager_exec(framework);
+    cmd.args(&invocation.args);
 
     let result = exec_capture(&mut cmd).context(format!("Failed to run {}", framework))?;
     let combined = result.combined();
@@ -241,7 +275,7 @@ fn run_framework_test(
         framework,
         &result.stdout,
         &combined,
-        passthrough_requested,
+        invocation.passthrough,
         verbose,
     );
     let tee_label = format!("{}_run", framework);
@@ -262,11 +296,6 @@ fn run_framework_test(
     Ok(0)
 }
 
-struct EffectiveVitestArgs {
-    args: Vec<String>,
-    passthrough: bool,
-}
-
 struct FormattedTestOutput {
     text: String,
     truncated: bool,
@@ -288,27 +317,6 @@ impl FormattedTestOutput {
     }
 }
 
-fn build_vitest_effective_args(args: &[String]) -> EffectiveVitestArgs {
-    let passthrough = has_explicit_vitest_reporter(args);
-    let mut effective = vec!["run".to_string()];
-
-    if !passthrough {
-        effective.push("--reporter=json".to_string());
-    }
-
-    for arg in args {
-        if should_skip_vitest_arg(arg) {
-            continue;
-        }
-        effective.push(arg.clone());
-    }
-
-    EffectiveVitestArgs {
-        args: effective,
-        passthrough,
-    }
-}
-
 fn has_explicit_vitest_reporter(args: &[String]) -> bool {
     args.iter()
         .any(|arg| arg == "--reporter" || arg.starts_with("--reporter="))
@@ -414,6 +422,43 @@ mod tests {
         values.iter().map(|value| value.to_string()).collect()
     }
 
+    #[test]
+    fn test_vitest_invocation_runs_vitest() {
+        let invocation = vitest_invocation(&args(&["src/a.test.ts"]));
+
+        assert_eq!(invocation.framework, "vitest");
+    }
+
+    #[test]
+    fn test_jest_invocation_runs_jest_once_with_json_output() {
+        let invocation = jest_invocation(&args(&["src/a.test.js"]));
+
+        assert_eq!(invocation.framework, "jest");
+        assert_eq!(
+            invocation.args,
+            args(&["--no-watch", "--json", "src/a.test.js"])
+        );
+        assert!(!inv
```

**File**: `src/main.rs` (modified, +10/-0)
```diff
@@ -3443,6 +3443,7 @@ fn is_operational_command(cmd: &Commands) -> bool {
             | Commands::Rg { .. }
             | Commands::AstGrep { .. }
             | Commands::Wget { .. }
+            | Commands::Jest { .. }
             | Commands::Vitest { .. }
             | Commands::Ctest { .. }
             | Commands::Prisma { .. }
@@ -3488,6 +3489,15 @@ mod tests {
     use clap::Parser;
     use std::cell::Cell;
 
+    #[test]
+    fn test_jest_and_vitest_get_the_hook_integrity_check() {
+        for framework in ["jest", "vitest"] {
+            let cli = Cli::try_parse_from(["rtk", framework, "src/a.test.js"])
+                .expect("rtk <framework> <path> parses");
+            assert!(is_operational_command(&cli.command), "{framework}");
+        }
+    }
+
     #[test]
     fn test_git_commit_single_message() {
         let cli = Cli::try_parse_from(["rtk", "git", "commit", "-m", "fix: typo"]).unwrap();
```

---

### Incident Patch 10: `aaa2fba8` (2026-10-03)
**Commit Message**: Merge pull request #4328 from amandeavor/fix/categorize-uv-python

fix(tracking): count `rtk uv` rows as python in ecosystem mix

**File**: `src/core/tracking.rs` (modified, +8/-1)
```diff
@@ -1588,7 +1588,7 @@ fn categorize_command(rtk_cmd: &str) -> String {
         "cargo" => "cargo",
         "npm" | "npx" | "pnpm" | "bun" | "bunx" | "deno" | "vitest" | "tsc" | "lint"
         | "prettier" | "next" | "playwright" | "prisma" => "js",
-        "pytest" | "ruff" | "mypy" | "pip" | "sqlfluff" => "python",
+        "pytest" | "ruff" | "mypy" | "pip" | "sqlfluff" | "uv" => "python",
         "go" | "golangci-lint" => "go",
         "docker" | "kubectl" => "cloud",
         "rspec" | "rubocop" | "rake" => "ruby",
@@ -2774,6 +2774,13 @@ mod tests {
         }
     }
 
+    #[test]
+    fn test_categorize_uv_as_python() {
+        for cmd in ["rtk uv sync", "rtk uv run pytest", "rtk uv pip install foo"] {
+            assert_eq!(categorize_command(cmd), "python", "{cmd}");
+        }
+    }
+
     // 14. get_by_command uses weighted savings rate, not unweighted average
     //
     // Regression test for: AVG(savings_pct) gave wrong results when small invocations
```

---

### Incident Patch 11: `1ed8c7c1` (2026-10-03)
**Commit Message**: Merge pull request #4383 from TechWizard9999/fix/4320-diff-one-operand-usage

fix(diff): report a one-operand call as a usage error with exit 2 (fixes #4320)

**File**: `docs/usage/FEATURES.md` (modified, +1/-1)
```diff
@@ -264,7 +264,7 @@ Seul `run` est filtre : soit nomme explicitement, soit implicite quand aucun pos
 **Syntaxe :**
 ```bash
 rtk diff <fichier1> <fichier2>
-rtk diff <fichier1>              # Stdin comme second fichier
+rtk diff -                       # Condense un diff unifie lu sur stdin
 ```
 
 Pour comparer deux fichiers : code de sortie **0** si identiques, **1** si differents,
```

**File**: `src/main.rs` (modified, +10/-3)
```diff
@@ -294,11 +294,13 @@ enum Commands {
     /// Ultra-condensed diff (only changed lines)
     ///
     /// Comparing two files exits 0 if identical, 1 if different, and 2 on a
-    /// file-read error. Non-UTF-8 files are compared byte for byte.
+    /// file-read error. A single file operand is a usage error (exit 2), not a
+    /// diff to condense; `-` reads a piped diff from stdin. Non-UTF-8 files are
+    /// compared byte for byte.
     Diff {
         /// First file or - for stdin (unified diff)
         file1: PathBuf,
-        /// Second file (optional if stdin)
+        /// Second file (omit only when the first is - for stdin)
         file2: Option<PathBuf>,
     },
 
@@ -2408,9 +2410,14 @@ fn run_cli() -> Result<i32> {
         Commands::Diff { file1, file2 } => {
             if let Some(f2) = file2 {
                 diff_cmd::run(&file1, &f2, cli.verbose)?
-            } else {
+            } else if file1.as_os_str() == "-" {
                 diff_cmd::run_stdin(cli.verbose)?;
                 0
+            } else {
+                // `diff` rejects a lone file operand as a usage error, exit 2,
+                // before opening it, so `diff <file> && next` stops here too.
+                eprintln!("diff: missing operand after '{}'", file1.display());
+                2
             }
         }
 
```

**File**: `tests/diff_byte_accuracy_test.rs` (modified, +83/-0)
```diff
@@ -100,3 +100,86 @@ fn non_utf8_files_are_compared_instead_of_reported_as_io_errors() {
         }
     }
 }
+
+#[test]
+fn one_file_operand_is_a_usage_error_not_a_stdin_condense() {
+    let dir = tempfile::tempdir().unwrap();
+    let file = dir.path().join("o.txt");
+    fs::write(&file, "a\n").unwrap();
+
+    let output = common::rtk_command()
+        .args([DIFF_SUBCOMMAND, &file.display().to_string()])
+        .stdin(std::process::Stdio::null())
+        .output()
+        .expect("run rtk diff with one operand");
+
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    assert_eq!(
+        output.status.code(),
+        Some(2),
+        "a single file operand is a usage error, not a diff to condense: {stderr}"
+    );
+    assert!(
+        stderr.contains("missing operand after"),
+        "the usage error must name the form, like diff does: {stderr}"
+    );
+}
+
+#[test]
+fn one_missing_operand_is_a_usage_error_before_any_read() {
+    let dir = tempfile::tempdir().expect("tempdir");
+    let piped = dir.path().join("piped.diff");
+    fs::write(&piped, "--- a/f\n+++ b/f\n@@ -1 +1 @@\n-x\n+y\n").expect("write piped diff");
+    let missing = dir.path().join("missing.txt");
+
+    let output = common::rtk_command()
+        .args([DIFF_SUBCOMMAND, &missing.display().to_string()])
+        .stdin(fs::File::open(&piped).expect("open piped diff"))
+        .output()
+        .expect("run rtk diff with one missing operand");
+
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    assert_eq!(output.status.code(), Some(2), "{stderr}");
+    assert!(
+        stderr.contains("missing operand after"),
+        "the usage error comes before the operand is opened: {stderr}"
+    );
+    assert!(
+        !stderr.contains("rtk diff:"),
+        "the missing operand is not read: {stderr}"
+    );
+    assert!(
+        output.stdout.is_empty(),
+        "stdin is not condensed on a usage error: {}",
+        String::from_utf8_lossy(&output.stdout)
+    );
+}
+
+#[test]
+fn explicit_stdin_dash_still_condenses() {
+    use std::io::Write as _;
+    use std::process::Stdio;
+
+    let mut child = common::rtk_command()
+        .args([DIFF_SUBCOMMAND, "-"])
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn rtk diff -");
+    child
+        .stdin
+        .take()
+        .expect("stdin pipe")
+        .write_all(b"--- a/f\n+++ b/f\n@@ -1 +1 @@\n-x\n+y\n")
+        .expect("write diff to stdin");
+    let output = child.wait_with_output().expect("wait for rtk diff -");
+
+    assert_eq!(
+        output.status.code(),
+        Some(0),
+        "the `-` form is the stdin mode"
+    );
+    let stdout = String::from_utf8_lossy(&output.stdout);
+    assert!(stdout.contains("-x") || stdout.contains("+y"), "{stdout}");
+}
```

---

### Incident Patch 12: `a4f444e0` (2026-10-03)
**Commit Message**: Merge pull request #4085 from log0u7/fix/curl-stdin-body-dropped

fix(curl): forward stdin to curl so -d @- bodies are not dropped

**File**: `src/cmds/cloud/curl_cmd.rs` (modified, +6/-0)
```diff
@@ -17,6 +17,7 @@ use crate::core::utils::resolved_command;
 use anyhow::{Context, Result};
 use std::borrow::Cow;
 use std::io::{IsTerminal, Write};
+use std::process::Stdio;
 
 const MAX_RESPONSE_SIZE: usize = 500;
 
@@ -33,6 +34,11 @@ pub fn run(args: &[String], verbose: u8) -> Result<i32> {
         eprintln!("Running: curl -s {}", args.join(" "));
     }
 
+    // Forward our stdin: `Command::output()` gives the child an immediate-EOF
+    // stdin, which empties stdin-based bodies (`-d @-`, `--data-binary @-`,
+    // `-T -`, `-K -`). Mirrors `RunOptions::inherit_stdin` (#4084).
+    cmd.stdin(Stdio::inherit());
+
     // Capture stdout as raw bytes (not UTF-8 String) so binary downloads
     // survive intact. `String::from_utf8_lossy` would otherwise replace
     // every non-UTF-8 byte with U+FFFD (3 bytes), corrupting e.g. gzip
```

**File**: `tests/curl_stdin_test.rs` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+#![cfg(unix)]
+
+use std::io::{Read, Write};
+use std::net::TcpListener;
+use std::process::Stdio;
+
+mod common;
+
+/// Accept one HTTP request on `listener` and return the exact request body.
+fn read_one_request_body(listener: TcpListener) -> Vec<u8> {
+    let (mut stream, _) = listener.accept().expect("accept connection");
+
+    let mut buf = Vec::new();
+    let mut chunk = [0u8; 4096];
+    // Read until end of headers.
+    let header_end = loop {
+        let n = stream.read(&mut chunk).expect("read request");
+        assert!(n > 0, "connection closed before headers were complete");
+        buf.extend_from_slice(&chunk[..n]);
+        if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
+            break pos + 4;
+        }
+    };
+
+    let headers = String::from_utf8_lossy(&buf[..header_end]).into_owned();
+    let content_length: usize = headers
+        .lines()
+        .find_map(|l| {
+            let (name, value) = l.split_once(':')?;
+            name.eq_ignore_ascii_case("content-length")
+                .then(|| value.trim().parse().ok())?
+        })
+        .expect("Content-Length header");
+
+    let mut body = buf[header_end..].to_vec();
+    while body.len() < content_length {
+        let n = stream.read(&mut chunk).expect("read body");
+        assert!(n > 0, "connection closed before body was complete");
+        body.extend_from_slice(&chunk[..n]);
+    }
+    body.truncate(content_length);
+
+    // Reply so curl exits 0 instead of erroring with "empty reply".
+    stream
+        .write_all(b"HTTP/1.1 204 No Content\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
+        .expect("write response");
+    body
+}
+
+#[test]
+fn curl_forwards_piped_stdin_body() {
+    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
+    let port = listener.local_addr().expect("local addr").port();
+    let server = std::thread::spawn(move || read_one_request_body(listener));
+
+    let body = b"{\"via\":\"heredoc\"}";
+    let mut child = common::rtk_command()
+        .args([
+            "curl",
+            "-sS",
+            "--noproxy",
+            "*",
+            "-X",
+            "PUT",
+            "-H",
+            "Content-Type: application/json",
+            "-d",
+            "@-",
+            &format!("http://127.0.0.1:{port}/t"),
+        ])
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn rtk curl");
+    child
+        .stdin
+        .take()
+        .expect("piped stdin")
+        .write_all(body)
+        .expect("write stdin");
+
+    let output = child.wait_with_output().expect("wait for rtk curl");
+    assert!(
+        output.status.success(),
+        "rtk curl failed: {}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+
+    let received = server.join().expect("server thread");
+    assert_eq!(received, body, "server must receive the exact stdin body");
+}
```

---

### Incident Patch 13: `f62874b8` (2026-10-03)
**Commit Message**: Merge branch 'develop' into fix/curl-stdin-body-dropped

**File**: `.claude/agents/rust-rtk.md` (modified, +1/-1)
```diff
@@ -325,7 +325,7 @@ fn test_real_git_log() {
 - `src/cmds/system/` - ls.rs, tree.rs, read.rs, grep_cmd.rs, find_cmd.rs, etc.
 
 **Hook & analytics** (`src/hooks/`, `src/analytics/`):
-- `src/hooks/init.rs` - rtk init command
+- `src/hooks/init/` - rtk init command
 - `src/analytics/gain.rs` - rtk gain command
 
 **Tests**:
```

**File**: `.claude/commands/tech/codereview.md` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ git diff "$BASE_BRANCH"...HEAD --stat
 | `src/main.rs`                  | Command routing + Commands enum            |
 | `src/core/tracking.rs`         | SQLite patterns + DB path config           |
 | `src/core/config.rs`           | Configuration system                       |
-| `src/hooks/init.rs`            | Init patterns + hook installation          |
+| `src/hooks/init/`              | Init patterns + hook installation          |
 | `.github/workflows/`           | CI/CD multi-platform build targets         |
 | `tests/` ou `fixtures/`        | Testing Strategy (CLAUDE.md)               |
 | `Cargo.toml`                   | Dependencies + build optimizations         |
```

**File**: `.claude/hooks/rtk-rewrite.sh` (modified, +11/-7)
```diff
@@ -1,16 +1,16 @@
 #!/usr/bin/env bash
-# rtk-hook-version: 3
+# rtk-hook-version: 4
 # RTK auto-rewrite hook for Claude Code PreToolUse:Bash
 # Transparently rewrites raw commands to their RTK equivalents.
 # Uses `rtk rewrite` as single source of truth — no duplicate mapping logic here.
 #
 # To add support for new commands, update src/discover/registry.rs (PATTERNS + RULES).
 #
 # Exit code protocol for `rtk rewrite`:
-#   0 + stdout  Rewrite found, no deny/ask rule matched → auto-allow
+#   0 + stdout  Rewrite found, an allow rule matched → auto-allow
 #   1           No RTK equivalent → pass through unchanged
 #   2           Deny rule matched → pass through (Claude Code native deny handles it)
-#   3 + stdout  Ask rule matched → rewrite but let Claude Code prompt the user
+#   3 + stdout  Ask rule matched, or no rule matched → rewrite but let Claude Code prompt the user
 
 # --- Audit logging (opt-in via RTK_HOOK_AUDIT=1) ---
 _rtk_audit_log() {
@@ -45,13 +45,17 @@ case "$CMD" in
 esac
 
 # Rewrite via rtk — single source of truth for all command mappings and permission checks.
+# Scrub RTK_REWRITE_HOST: that channel relaxes RTK's approval gate, and this
+# hook turns exit 0 into an explicit allow, so an inherited value (a shell rc,
+# .envrc, or CI env) must not reach it. Only the delegate that sets it may
+# rely on it.
 # Use "|| EXIT_CODE=$?" to capture non-zero exit codes without triggering set -e.
 EXIT_CODE=0
-REWRITTEN=$(rtk rewrite "$CMD" 2>/dev/null) || EXIT_CODE=$?
+REWRITTEN=$(env -u RTK_REWRITE_HOST rtk rewrite "$CMD" 2>/dev/null) || EXIT_CODE=$?
 
 case $EXIT_CODE in
   0)
-    # Rewrite found, no permission rules matched — safe to auto-allow.
+    # Rewrite found and an allow rule matched — safe to auto-allow.
     if [ "$CMD" = "$REWRITTEN" ]; then
       _rtk_audit_log "skip:already_rtk" "$CMD"
       exit 0
@@ -68,8 +72,8 @@ case $EXIT_CODE in
     exit 0
     ;;
   3)
-    # Ask rule matched — rewrite the command but do NOT auto-allow so that
-    # Claude Code prompts the user for confirmation.
+    # An ask rule matched, or no rule did — rewrite the command but do NOT
+    # auto-allow, so Claude Code prompts the user for confirmation.
     ;;
   *)
     exit 0
```

**File**: `.claude/rules/cli-testing.md` (modified, +43/-12)
```diff
@@ -190,18 +190,52 @@ behavior (search/grep compression, guard rails, faithful formatting) rather than
 filter module, and several of them draw on `tests/fixtures/` (real captured aws/glab/gradlew/
 mvn/phpstan/dotnet output) alongside their own inline cases.
 
+### Machine independence (🔴 Critical)
+
+A test that spawns a real process must not depend on the machine it runs on. Two rules,
+both with `src/core/test_isolation/` helpers behind them (`tests/common/mod.rs` for the
+integration tests):
+
+- **Never assert on a third-party tool's wording.** git, grep and coreutils translate their
+  messages, so `stderr.contains("not a git repository")` fails outright in a French shell —
+  and a *negative* assertion (`!out.contains("Is a directory")`) is worse, passing vacuously
+  while testing nothing. Assert RTK's own output, or the structure (exit code, which stream
+  the message went to). Spawn rtk through `test_isolation::rtk_command()`
+  (`common::rtk_command()` under `tests/`): it redirects rtk's data and neutralizes the
+  contributor's git config and exported `GIT_*` variables, but leaves the locale to the
+  test. When a test genuinely needs a tool's English text, set `LC_ALL=C` on that command,
+  and on any native tool its output is compared with. A git the test runs itself goes
+  through `isolate_git()`, which pins it.
+- **Never touch the ambient repository.** Use `test_isolation::temp_git_repo()` and
+  `.current_dir(repo.path())`. A test that runs `git branch` in whatever repo the
+  contributor is sitting in mutates their work, and one that assumes it is inside a repo at
+  all silently stops exercising anything when it isn't.
+
+Verify a change here against a hostile environment, not just yours:
+
+```bash
+LC_ALL=de_DE.UTF-8 LANGUAGE=de cargo test --all -- --include-ignored
+GIT_DIR=/path/to/another/repo/.git RTK_NO_TOML=1 RTK_TEE=0 cargo test --all -- --include-ignored
+TMPDIR=/path/inside/a/git/repo cargo test --all -- --include-ignored
+```
+
+and with a `~/.gitconfig` that signs commits, deny rules in `~/.claude/settings.json`, and a
+`global.json` or `.ignore` above `TMPDIR`: none of it may change a result, and none of it may
+be written to.
+
 ### Real Command Execution
 
 ```rust
 #[test]
 #[ignore] // Run with: cargo test --ignored
 fn test_real_git_log() {
-    // Requires:
-    // 1. RTK binary installed (cargo install --path .)
-    // 2. Git repository available
-
-    let output = std::process::Command::new("rtk")
+    // The binary cargo built for this run, with rtk's data redirected to a
+    // scratch directory (the installed `rtk` would write to the developer's own),
+    // in a throwaway repository rather than the one the tests run from.
+    let repo = common::temp_git_repo();
+    let output = common::rtk_command()
         .args(&["git", "log", "-10"])
+        .current_dir(repo.path())
         .output()
         .expect("Failed to run rtk");
 
@@ -217,16 +251,13 @@ fn test_real_git_log() {
 ### Running Integration Tests
 
 ```bash
-# 1. Install RTK locally
-cargo install --path .
-
-# 2. Run all tests, including top-level tests/*.rs integration tests
+# 1. Run all tests, including top-level tests/*.rs integration tests
 cargo test --all
 
-# 3. Run ignored (real-process) integration tests
+# 2. Run ignored (real-process) integration tests
 cargo test --ignored
 
-# 4. Run specific test
+# 3. Run specific test
 cargo test --ignored test_real_git_log
 ```
 
@@ -457,7 +488,7 @@ fn test_ansi_codes() {
 #[test]
 #[ignore]
 fn test_real_command_execution() {
-    let output = std::process::Command::new("rtk")
+    let output = common::rtk_command()
         .args(&["cmd", "args"])
         .output()
         .expect("Failed to run rtk");
```

**File**: `.claude/rules/search-strategy.md` (modified, +3/-3)
```diff
@@ -32,7 +32,7 @@ src/
 │   ├── runner.rs              ← Command execution runner
 │   └── stream.rs              ← Streaming output handling
 ├── hooks/                     ← Hook system
-│   ├── init.rs                ← rtk init command
+│   ├── init/                  ← rtk init command
 │   ├── rewrite_cmd.rs         ← rtk rewrite command
 │   ├── hook_cmd.rs            ← Gemini/Copilot hook processors
 │   ├── hook_check.rs          ← Hook status detection
@@ -62,7 +62,7 @@ src/
 ├── discover/                  ← Claude Code history analysis
 ├── learn/                     ← CLI correction detection
 ├── parser/                    ← Parser infrastructure
-└── filters/                   ← 63 TOML filter configs
+└── filters/                   ← 62 TOML filter configs
 ```
 
 ## Common Search Patterns
@@ -146,7 +146,7 @@ Glob pattern="tests/fixtures/*.txt"
 ### Configuration issues
 
 1. `src/core/config.rs` → `RtkConfig` struct
-2. `src/hooks/init.rs` → `rtk init` command
+2. `src/hooks/init/` → `rtk init` command
 3. Config file: `~/.config/rtk/config.toml`
 4. Filter files: `~/.config/rtk/filters/` (global) or `.rtk/filters/` (project)
 
```

**File**: `.claude/skills/rtk-tdd/references/testing-patterns.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ Prioritized by testability (pure functions first, I/O-heavy last).
 | `find_cmd.rs` | Directory grouping logic | Filesystem-dependent |
 | `wget_cmd.rs` | `compact_url`, `format_size`, `truncate_line`, `extract_filename_from_output` | Some pure helpers worth testing |
 | `gain.rs` | Display formatting | Depends on tracking DB |
-| `init.rs` | CLAUDE.md generation | File I/O |
+| `hooks/init/` | CLAUDE.md generation | File I/O |
 | `main.rs` | CLI routing | Covered by smoke tests |
 
 ## RTK Test Patterns
```

**File**: `.github/workflows/cd.yml` (modified, +2/-2)
```diff
@@ -26,7 +26,7 @@ jobs:
     outputs:
       tag: ${{ steps.tag.outputs.tag }}
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
         with:
           fetch-depth: 0
           fetch-tags: true
@@ -143,7 +143,7 @@ jobs:
           private-key: ${{ secrets.APP_PRIVATE_KEY }}
           permission-contents: write
 
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
         with:
           fetch-depth: 0
           token: ${{ steps.app-token.outputs.token }}
```

**File**: `.github/workflows/ci.yml` (modified, +10/-10)
```diff
@@ -18,7 +18,7 @@ jobs:
     name: test presence
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
         with:
           fetch-depth: 50
       - name: Check filter modules have tests
@@ -30,7 +30,7 @@ jobs:
     name: fmt
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
       - uses: dtolnay/rust-toolchain@stable
         with:
           components: rustfmt
@@ -41,7 +41,7 @@ jobs:
     needs: fmt
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
       - uses: dtolnay/rust-toolchain@stable
         with:
           components: clippy
@@ -59,7 +59,7 @@ jobs:
       matrix:
         os: [ubuntu-latest, windows-latest, macos-latest]
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
         with:
           fetch-depth: 0
       - uses: dtolnay/rust-toolchain@stable
@@ -71,7 +71,7 @@ jobs:
     needs: clippy
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
         with:
           fetch-depth: 0
 
@@ -194,7 +194,7 @@ jobs:
     container:
       image: semgrep/semgrep
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
         with:
           fetch-depth: 0
       - run: semgrep scan --config .semgrep.yml --baseline-commit ${{ github.event.pull_request.base.sha }} --error
@@ -204,7 +204,7 @@ jobs:
     needs: clippy
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
 
       - uses: dtolnay/rust-toolchain@stable
 
@@ -214,13 +214,13 @@ jobs:
         run: cargo build --release
 
       - name: Install system tools
-        run: sudo apt-get install -y tree
+        run: sudo apt-get install -y tree ripgrep
 
       - name: Install Python tools
         run: pip install ruff pytest mypy
 
       - name: Install Go
-        uses: actions/setup-go@v5
+        uses: actions/setup-go@v7
         with:
           go-version: "stable"
 
@@ -237,7 +237,7 @@ jobs:
     if: github.base_ref == 'develop'
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
         with:
           fetch-depth: 0
 
```

---

### Incident Patch 14: `6f5503d0` (2026-10-03)
**Commit Message**: Merge pull request #4350 from mvanhorn/fix/docs-windows-native-hook-troubleshooting

docs: update native Windows hook troubleshooting

**File**: `README.md` (modified, +1/-1)
```diff
@@ -423,7 +423,7 @@ Prefer [`winget`](#winget-windows) if you can — it handles PATH for you.
 rtk init -g
 ```
 
-**Upgrading from an older install?** If you set RTK up before v0.37.2 you may still have the legacy `rtk-rewrite.sh` shell hook (which does need a Unix shell). Re-run `rtk init -g` to migrate to the native binary hook.
+**Upgrading from an older install?** Before v0.37.2, `rtk init -g` on native Windows fell back to CLAUDE.md injection and registered no hook. Re-run `rtk init -g` and answer `y` when it asks to patch `settings.json` (or pass `--auto-patch`) to install the native binary hook.
 
 **Prerequisites**: some filters shell out to [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`). Install it and keep it on your PATH (e.g. `winget install BurntSushi.ripgrep.MSVC`) to avoid `Binary 'rg' not found on PATH` warnings.
 
```

**File**: `docs/guide/getting-started/supported-agents.md` (modified, +2/-6)
```diff
@@ -325,13 +325,9 @@ Rules file integrations (Cline, Windsurf, Kilo Code) rely on the model following
 
 ## Windows support
 
-The shell hook (`rtk-rewrite.sh`) requires a Unix shell. On native Windows:
+Since v0.37.2, `rtk init -g` registers the native `rtk hook claude` command on Windows, so Claude Code gets full auto-rewrite without a Unix shell. Setups created before v0.37.2 used CLAUDE.md injection and have no hook; re-running `rtk init -g` migrates them, and adds the hook once you answer `y` to the `settings.json` prompt (or pass `--auto-patch`).
 
-- `rtk init -g` automatically falls back to **CLAUDE.md injection mode** (prompt-level instructions)
-- Filters work normally (`rtk cargo test`, `rtk git status`)
-- Auto-rewrite does not work — the AI assistant is instructed to use RTK but commands are not intercepted
-
-For full shell-hook support on Windows, use [WSL](https://learn.microsoft.com/en-us/windows/wsl/install). Inside WSL, agents with shell hook integration (Claude Code, Cursor, Gemini) work identically to Linux. Native Rust hook integrations such as Trae do not depend on `rtk-rewrite.sh`.
+Integrations that install a shell wrapper script (such as Gemini) still need a Unix shell. For those, use [WSL](https://learn.microsoft.com/en-us/windows/wsl/install), where they work identically to Linux. Native Rust hook integrations such as Trae do not depend on a shell script.
 
 ## Graceful degradation
 
```

**File**: `docs/guide/resources/troubleshooting.md` (modified, +18/-8)
```diff
@@ -105,18 +105,28 @@ rtk --version
 
 ### Hook not working (no auto-rewrite)
 
-**Symptom:** `rtk init -g` shows "Falling back to --claude-md mode" on Windows.
+**Symptom:** On native Windows, commands are not auto-rewritten. An older `rtk init -g` printed "Falling back to --claude-md mode".
 
-**Cause:** The auto-rewrite hook (`rtk-rewrite.sh`) requires a Unix shell. Native Windows doesn't have one.
+**Cause:** Before v0.37.2, `rtk init -g` registered no hook on native Windows: it fell back to injecting the full RTK instructions into `~/.claude/CLAUDE.md`. A setup made then still has no hook.
 
-**Fix:** Use [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) for full hook support:
-```bash
-# Inside WSL
-curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
-rtk init -g    # full hook mode works in WSL
+**Fix:** Upgrade to v0.37.2 or later, where `rtk init -g` registers the auto-rewrite hook on Windows as a native binary command (`rtk hook claude`). No Unix shell, bash, or jq is required. Re-run `rtk init -g`: it replaces the CLAUDE.md block with an `@RTK.md` reference and, once you confirm, adds `rtk hook claude` to `settings.json`. A legacy `~/.claude/hooks/rtk-rewrite.sh` hook, if one exists, is deleted along with its `.rtk-hook.sha256` and its `settings.json` entry.
+
+Answer `y` when it asks to patch `settings.json`. Outside a terminal it cannot ask and defaults to `N`, so use `--auto-patch` there:
+
+```powershell
+rtk init -g                # answer y at the settings.json prompt
+rtk init -g --auto-patch   # or: patch settings.json without asking
 ```
 
-On native Windows, RTK falls back to CLAUDE.md injection. Your AI assistant gets RTK instructions but won't auto-rewrite commands. It can still use RTK manually: `rtk cargo test`, `rtk git status`, etc.
+The default `N` leaves no hook registered: any legacy `rtk-rewrite.sh` entry is removed and `rtk hook claude` is not added. The `RTK hook registered (global).` banner prints either way; the line that confirms the patch is `settings.json: hook added` (or `settings.json: hook already present` when an earlier run added it). Restart Claude Code, then confirm:
+
+```powershell
+rtk init --show
+```
+
+It should report `[ok] Hook: rtk hook claude (native binary command)`.
+
+[WSL](https://learn.microsoft.com/en-us/windows/wsl/install) also works and behaves like Linux if you prefer it.
 
 ### Node.js tools not found
 
```

---

### Incident Patch 15: `4daca6a7` (2026-10-03)
**Commit Message**: fix(go): drop non-JSON surfacing and pin failing-fuzz precedence

Non-JSON stdout never reaches the filter from rtk go test (Go writes errors to stderr), and via rtk pipe it hid real failures, so the arm and its tests are removed. Add a test asserting a failing fuzz run reports the failure instead of the green fuzz summary.

**File**: `src/cmds/go/go_cmd.rs` (modified, +24/-66)
```diff
@@ -296,8 +296,6 @@ pub(crate) fn filter_go_test_json(output: &str) -> String {
     let mut packages: HashMap<String, PackageResult> = HashMap::new();
     let mut current_test_output: HashMap<(String, String), Vec<String>> = HashMap::new(); // (package, test) -> outputs
     let mut build_output: HashMap<String, Vec<String>> = HashMap::new(); // import_path -> error lines
-    let mut non_json_lines: Vec<String> = Vec::new();
-
     for line in output.lines() {
         let trimmed = line.trim();
         if trimmed.is_empty() {
@@ -306,10 +304,7 @@ pub(crate) fn filter_go_test_json(output: &str) -> String {
 
         let event: GoTestEvent = match serde_json::from_str(trimmed) {
             Ok(e) => e,
-            Err(_) => {
-                non_json_lines.push(trimmed.to_string());
-                continue;
-            }
+            Err(_) => continue, // Skip non-JSON lines
         };
 
         // Handle build-output/build-fail events (use ImportPath, no Package)
@@ -410,10 +405,7 @@ pub(crate) fn filter_go_test_json(output: &str) -> String {
     let has_failures = total_fail > 0 || total_build_fail > 0 || total_pkg_fail > 0;
 
     if !has_failures && total_pass == 0 {
-        if non_json_lines.is_empty() {
-            return "Go test: No tests found".to_string();
-        }
-        return format_non_json_lines(&non_json_lines);
+        return "Go test: No tests found".to_string();
     }
 
     let total_fuzz = packages
@@ -505,17 +497,6 @@ pub(crate) fn filter_go_test_json(output: &str) -> String {
     result.trim().to_string()
 }
 
-fn format_non_json_lines(lines: &[String]) -> String {
-    let mut result = String::from("Go test: error\n");
-    for line in lines.iter().take(CAP_ERRORS) {
-        result.push_str(&format!("{}\n", truncate(line, 120)));
-    }
-    if lines.len() > CAP_ERRORS {
-        result.push_str(&format!("... +{} more lines\n", lines.len() - CAP_ERRORS));
-    }
-    result.trim().to_string()
-}
-
 fn format_fuzz_summary(
     packages: &HashMap<String, PackageResult>,
     total_pass: usize,
@@ -1189,43 +1170,6 @@ utils.go:15:5: unreachable code"#;
         assert!(!has_golangci_format_flag(&os(&["--fix"])));
     }
 
-    #[test]
-    fn test_filter_go_test_non_json_lines_surface_instead_of_no_tests_found() {
-        let output = "error: cannot find package\nsome other error line";
-
-        let result = filter_go_test_json(output);
-
-        assert_eq!(
-            result,
-            "Go test: error\nerror: cannot find package\nsome other error line"
-        );
-    }
-
-    #[test]
-    fn test_filter_go_test_non_json_lines_capped() {
-        let output = (0..25)
-            .map(|i| format!("line {}", i))
-            .collect::<Vec<_>>()
-            .join("\n");
-
-        let result = filter_go_test_json(&output);
-
-        assert!(result.contains("line 19"));
-        assert!(!result.contains("line 20"));
-        assert!(result.ends_with("... +5 more lines"));
-    }
-
-    #[test]
-    fn test_filter_go_test_non_json_ignored_when_tests_pass() {
-        let output = r#"stray line
-{"Action":"pass","Package":"example.com/foo","Test":"TestA","Elapsed":0.01}
-{"Action":"pass","Package":"example.com/foo","Elapsed":0.02}"#;
-
-        let result = filter_go_test_json(output);
-
-        assert_eq!(result, "Go test: 1 passed in 1 packages");
-    }
-
     #[test]
     fn test_filter_go_test_fuzz_keeps_last_elapsed_line() {
         let output = r#"{"Action":"start","Package":"example.com/foo"}
@@ -1263,17 +1207,31 @@ utils.go:15:5: unreachable code"#;
     }
 
     #[test]
-    fn test_filter_go_test_fuzz_multi_package_sorted() {
-        let output = r#"{"Action":"output","Package":"example.com/b","Test":"FuzzB","Output":"fuzz: elapsed: 2s, execs: 20\n"}
-{"Action":"pass","Package":"example.com/b","Test":"FuzzB","Elapsed":2.0}
-{"Action":"output","Package":"example.com/a","Test":"FuzzA","Output":"fuzz: elapsed: 1s, execs: 10\n"}
-{"Action":"pass","Package":"example.com/a","Test":"FuzzA","Elapsed":1.0}"#;
+    fn test_filter_go_test_failing_fuzz_reports_failure_not_fuzz_summary() {
+        let output = r#"{"Action":"start","Package":"example.com/foo"}
+{"Action":"run","Package":"example.com/foo","Test":"FuzzRev"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzRev","Output":"=== RUN   FuzzRev\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzRev","Output":"fuzz: elapsed: 0s, gathering baseline coverage: 0/3 completed\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzRev","Output":"fuzz: elapsed: 0s, execs: 1234 (12345/sec), new interesting: 1 (total: 4)\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzRev","Output":"--- FAIL: FuzzRev (0.11s)\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzRev","Output":"    --- FAIL: FuzzRev (0.00s)\n"}
+{"Action":"output","Package":"example.com/foo","Test":"FuzzRev","Output":"        rev_test.go:17: Reverse produced invalid UTF-8 string \"\
```

#### Recent Merged Pull Requests:
- **PR #4392** (2026-10-02): Next Release (@rtk-release-bot[bot])
- **PR #4389** (2026-10-02): chore: release 0.51.0 (@aeppling)
- **PR #4388** (2026-10-02): chore(master): release 0.51.0 (@rtk-release-bot[bot])
- **PR #4384** (closed): fix(tracking): bucket `rtk uv …` rows as python in categorize_command (fixes #4316) (@TechWizard9999)
- **PR #4383** (2026-10-03): fix(diff): report a one-operand call as a usage error with exit 2 (fixes #4320) (@TechWizard9999)
- **PR #4381** (2026-10-02): fix(shell): run unresolvable single-string commands through the platform shell (@aeppling)
- **PR #4371** (2026-10-01): ci(transparency): trigger transparency analyze (@aeppling)
- **PR #4370** (closed): fix(curl): inherit stdin so -d @- / -T - / --data-binary @- work (fixes #4084) (@TechWizard9999)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
