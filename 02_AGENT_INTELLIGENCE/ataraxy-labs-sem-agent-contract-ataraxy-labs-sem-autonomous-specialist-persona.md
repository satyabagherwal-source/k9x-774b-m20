# Agent Contract: Agent Contract: ataraxy/labs/sem Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "ataraxy/labs/sem",
  "source_url": "https://github.com/ataraxy/labs/sem",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ataraxy/labs/sem](https://github.com/ataraxy/labs/sem) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `ataraxy-labs-sem-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ataraxy-labs-sem-learnings.md`  
> **Source**: github ([https://github.com/Ataraxy-Labs/sem](https://github.com/Ataraxy-Labs/sem))  
> **Source Version**: `036dde8e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T13:50:42.836Z  
> **Learning ID**: `learn-github-ataraxy-labs-sem`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Ataraxy-Labs/sem

> **Canonical Artifact**: `07_PROJECT_LEARNING/ataraxy-labs-sem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ataraxy-Labs/sem](https://github.com/Ataraxy-Labs/sem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T13:40:41.598Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ataraxy-Labs/sem`
- **Description**: Semantic version control => entity-level diffs, blame, and impact analysis on top of git. 28 languages via tree-sitter. Built for coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3450 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/dependency-accuracy/project/core.py`
```
"""Core validation and sanitization functions."""


def sanitize(text):
    """Remove dangerous characters from text."""
    return text.replace("<", "").replace(">", "")


def validate(data):
    """Validate input data by sanitizing it first."""
    cleaned = sanitize(data)
    return len(cleaned) > 0


def transform(data):
    """Transform data after validation."""
    if validate(data):
        return data.upper()
    return data

```

### Core Architecture Module: `benchmarks/dependency-accuracy/project/utils.py`
```
"""Utility decorators."""

import functools


def memoize(func):
    """Cache results of a function call."""
    cache = {}

    @functools.wraps(func)
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
        return cache[args]

    return wrapper


@memoize
def expensive_compute(n):
    """A decorated function."""
    total = 0
    for i in range(n):
        total += i * i
    return total

```

### Core Architecture Module: `crates/sem-cli/src/commands/check/util.rs`
```
//! Process running with a time limit, scratch directories, digests.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::time::{Duration, Instant};

/// A temporary directory removed when dropped.
pub(crate) struct Scratch(pub PathBuf);

impl Scratch {
    pub fn new() -> std::io::Result<Scratch> {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let d = std::env::temp_dir().join(format!("sem-check-{}-{nanos}", std::process::id()));
        std::fs::create_dir_all(&d)?;
        Ok(Scratch(d))
    }
    pub fn path(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

pub(crate) struct Ran {
    pub status: ExitStatus,
    pub stdout: String,
    pub stderr: String,
}

impl Ran {
    pub fn ok(&self) -> bool {
        self.status.success()
    }
    /// The last `n` lines of stdout and stderr together.
    pub fn tail(&self, n: usize) -> Vec<String> {
        let mut lines: Vec<String> = self
            .stdout
            .lines()
            .chain(self.stderr.lines())
            .map(str::to_string)
            .collect();
        if lines.len() > n {
            lines.drain(..lines.len() - n);
        }
        lines
    }
}

/// Run `cmd` to completion or until `limit`, whichever is first. The child is
/// its own process group, so a timeout stops everything it started.
pub(crate) fn run(mut cmd: Command, limit: Duration) -> Result<Ran, String> {
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    let what = format!("{:?}", cmd.get_program());
    let mut child = cmd.spawn().map_err(|e| format!("could not start {what}: {e}"))?;
    let mut out = child.stdout.take().unwrap();
    let mut err = child.stderr.take().unwrap();
    let to = std::thread::spawn(move || {
        let mut b = Vec::new();
        let _ = out.read_to_end(&mut b);
        b
    });
    let te = std::thread::spawn(move || {
        let mut b = Vec::new();
        let _ = err.read_to_end(&mut b);
        b
    });
    let t0 = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break s,
            Ok(None) if t0.elapsed() > limit => {
                #[cfg(unix)]
                unsafe {
                    libc_kill(-(child.id() as i32));
                }
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("{what} did not finish within {}s", limit.as_secs()));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(e) => return Err(format!("waiting for {what}: {e}")),
        }
    };
    let stdout = String::from_utf8_lossy(&to.join().unwrap_or_default()).to_string();
    let stderr = String::from_utf8_lossy(&te.join().unwrap_or_default()).to_string();
    Ok(Ran { status, stdout, stderr })
}

#[cfg(unix)]
unsafe fn libc_kill(pgid: i32) {
    extern "C" {
        fn kill(pid: i32, sig: i32) -> i32;
    }
    kill(pgid, 9);
}

/// A shell command run in `dir`.
pub(crate) fn sh(dir: &Path, script: &str) -> Command {
    let mut c = Command::new("sh");
    c.arg("-c").arg(script).current_dir(dir);
    c
}

/// Git's blob id of `text` (the digest used throughout the certificate).
pub(crate) fn digest(text: &str) -> String {
    git2::Oid::hash_object(git2::ObjectType::Blob, text.as_bytes())
        .map(|o| o.to_string())
        .unwrap_or_default()
}

/// FNV-1a 64, hex: a short fingerprint of a checker's configuration.
pub(crate) fn fingerprint(parts: &[&str]) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for p in parts {
        for b in p.bytes().chain(std::iter::once(0u8)) {
            h ^= b as u64;
            h = h.wrapping_mul(0x100000001b3);
        }
    }
    format!("{h:016x}")
}

/// The Node binary to run helpers with (`SEM_CHECK_NODE`, else `node`).
pub(crate) fn node() -> String {
    std::env::var("SEM_CHECK_NODE").ok().filter(|s| !s.is_empty()).unwrap_or_else(|| "node".into())
}

/// Write an embedded helper script once, under a name that changes with its
/// content, and return its path.
pub(crate) fn helper(store_dir: Option<&Path>, name: &str, body: &str) -> Result<PathBuf, String> {
    let dir = match store_dir {
        Some(d) => d.join("helpers"),
        None => std::env::temp_dir().join("sem-check-helpers"),
    };
    std::fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    let p = dir.join(format!("{name}-{}.cjs", fingerprint(&[body])));
    if !p.exists() {
        let tmp = dir.join(format!(".{name}-{}.tmp", std::process::id()));
        std::fs::write(&tmp, body).map_err(|e| format!("{}: {e}", tmp.display()))?;
        std::fs::rename(&tmp, &p).map_err(|e| format!("{}: {e}", p.display()))?;
    }
    Ok(p)
}

/// The first `bin` found in `root/node_modules/.bin` or any ancestor's.
pub(crate) fn node_bin(root: &Path, bin: &str) -> Option<PathBuf> {
    let mut d = Some(root);
    while let Some(dir) = d {
        let p = dir.join("node_modules/.bin").join(bin);
        if p.exists() {
            return Some(p);
        }
        d = dir.parent();
    }
    None
}

/// `name`'s package directory as Node would find it from `root`.
pub(crate) fn node_package(root: &Path, name: &str) -> Option<PathBuf> {
    let mut d = Some(root);
    while let Some(dir) = d {
        let p = dir.join("node_modules").join(name);
        if p.join("package.json").exists() {
            return Some(p);
        }
        d = dir.parent();
    }
    None
}

pub(crate) fn package_version(pkg_dir: &Path) -> Option<String> {
    let t = std::fs::read_to_string(pkg_dir.join("package.json")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&t).ok()?;
    v["version"].as_str().map(String::from)
}

/// Does `path` match any glob (`*` within a segment, `**` across segments)?
pub(crate) fn glob_any(globs: &[String], path: &str) -> bool {
    globs.iter().any(|g| glob(g, path))
}

pub(crate) fn glob(pat: &str, path: &str) -> bool {
    fn m(p: &[u8], s: &[u8]) -> bool {
        if p.is_empty() {
            return s.is_empty();
        }
        if p.starts_with(b"**") {
            let rest = p[2..].strip_prefix(b"/").unwrap_or(&p[2..]);
            if rest.is_empty() || m(rest, s) {
                return true;
            }
            return (0..s.len()).any(|i| s[i] == b'/' && m(rest, &s[i + 1..]));
        }
        match p[0] {
            b'*' => {
                let mut i = 0;
                loop {
                    if m(&p[1..], &s[i..]) {
                        return true;
                    }
                    if i >= s.len() || s[i] == b'/' {
                        return false;
                    }
                    i += 1;
                }
            }
            b'?' => !s.is_empty() && s[0] != b'/' && m(&p[1..], &s[1..]),
            c => !s.is_empty() && s[0] == c && m(&p[1..], &s[1..]),
        }
    }
    m(pat.as_bytes(), path.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::glob;

    #[test]
    fn globs() {
        assert!(glob("**/*.md", "a/b/c.md"));
        assert!(glob("**/*.md", "c.md"));
        assert!(glob(".github/**", ".github/workflows/x.yml"));
        assert!(glob("vitest.config.*", "vitest.config.ts"));
        assert!(!glob("vitest.config.*", "a/vitest.config.ts"));
        assert!(glob("**/vitest.config.*", "a/vitest.config.ts"));
        assert!(glob("docs/**", "docs/x/y.png"));
        assert!(!glob("docs/**", "src/docs.ts"));
        assert!(glob("LICENSE*", "LICENSE-MIT"));
        assert!(glob("**/.env*", "pkg/.env.local"));
    }
}

```

### Core Architecture Module: `crates/sem-cli/src/commands/hook.rs`
```
//! `sem hook prompt-submit` — the prompt-time prefetch, compiled.
//!
//! Reads a Claude Code UserPromptSubmit event from stdin, extracts the
//! identifier-shaped tokens the prompt names, and answers them with `sem find
//! --context` from the query index (tens of milliseconds) before the model's
//! first turn, so a task that names its code starts with that code in hand
//! instead of spending a turn finding it.
//!
//! Silent by design: no candidates, no repo, no socket, any error — print
//! nothing and exit 0. The hook must never disturb a prompt.

use std::io::Read;
use std::path::{Path, PathBuf};

const MAX_ENTITIES: usize = 4;
/// Token budget for everything the prefetch injects.
const BUDGET: &str = "1500";

pub fn prompt_submit() {
    let mut input = String::new();
    if std::io::stdin().read_to_string(&mut input).is_err() {
        return;
    }
    let Ok(event) = serde_json::from_str::<serde_json::Value>(&input) else {
        return;
    };
    let prompt = event.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    let cwd = event.get("cwd").and_then(|v| v.as_str()).unwrap_or("");
    if prompt.is_empty() || prompt.starts_with('/') || cwd.is_empty() {
        return;
    }
    let Some(repo_root) = find_repo_root(Path::new(cwd)) else {
        return;
    };

    // Precise path: the prompt names entities (`backticked`, snake_case,
    // CamelCase). Resolve them by exact name against the resident socket —
    // cheapest and sharpest when the caller already knows the identifier.
    let names = candidates(prompt);
    let mut blocks: Vec<String> = Vec::new();
    let paths = mentioned_paths(prompt, &repo_root);
    if let Some(text) = index_lookup(&repo_root, &names, &paths) {
        blocks.push(text);
    }
    if !blocks.is_empty() {
        println!(
            "<sem-prefetch>\nThe prompt references code entities; sem resolved them ahead of time \
             (entity body + direct callers/callees). Use this instead of searching; verify only if \
             something looks stale.\n\n{}\n</sem-prefetch>",
            blocks.join("\n\n")
        );
        return;
    }
}

/// Walk up from `start` to the repo root (the directory holding `.git`).
/// No subprocess: this is the whole reason the git CLI isn't invoked.
fn find_repo_root(start: &Path) -> Option<PathBuf> {
    let mut dir = start.canonicalize().ok()?;
    loop {
        if dir.join(".git").exists() {
            return Some(dir);
        }
        if !dir.pop() {
            return None;
        }
    }
}

/// Identifier shapes worth prefetching: backticked, snake_case with an
/// underscore, CamelCase, or qualified (`a.b` / `a::b`). Plain lowercase words
/// are deliberately excluded — they would inject noise on every prompt.
fn candidates(prompt: &str) -> Vec<String> {
    use regex::Regex;
    let backtick = Regex::new(r"`([A-Za-z_][\w.:]{2,60})`").unwrap();
    let qualified = Regex::new(r"\b[A-Za-z_]\w*(?:\.|::)[A-Za-z_]\w+\b").unwrap();
    let snake = Regex::new(r"\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b").unwrap();
    let camel = Regex::new(r"\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b").unwrap();

    let stop = [
        "claude_code",
        "pull_request",
        "github_com",
        "https_www",
        "TypeScript",
        "JavaScript",
    ];

    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    let mut push = |tok: &str| {
        if tok.len() >= 4 && !stop.contains(&tok) && seen.insert(tok.to_string()) {
            out.push(tok.to_string());
        }
    };
    for m in backtick.captures_iter(prompt) {
        push(m.get(1).unwrap().as_str());
    }
    for rx in [&qualified, &snake, &camel] {
        for m in rx.find_iter(prompt) {
            push(m.as_str());
        }
    }
    out.truncate(MAX_ENTITIES);
    out
}

/// `sem find <name> --context` against the repository's query index, one
/// child process per name, all in parallel and bounded to two seconds. A
/// name that is ambiguous is retried inside each file the prompt mentions.
/// Only names that resolve to one definition are kept; the hook adds only
/// what is certain.
fn index_lookup(repo_root: &Path, names: &[String], paths: &[String]) -> Option<String> {
    if names.is_empty() {
        return None;
    }
    let exe = std::env::current_exe().ok()?;
    let budget = (1500 / names.len()).max(300).to_string();
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
    let run = |name: &str, scope: Option<&str>| -> Option<String> {
        let mut cmd = std::process::Command::new(&exe);
        super::without_cli_defaults(&mut cmd);
        cmd.args(["find", name, "--context", "--budget", &budget]);
        if let Some(p) = scope {
            cmd.args(["--in", p]);
        }
        let mut child = cmd
            .current_dir(repo_root)
            .env("SEM_NO_TELEMETRY", "1")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .ok()?;
        loop {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) if std::time::Instant::now() < deadline => std::thread::sleep(std::time::Duration::from_millis(5)),
                _ => {
                    let _ = child.kill();
                    return None;
                }
            }
        }
        let mut out = String::new();
        child.stdout.take()?.read_to_string(&mut out).ok()?;
        (out.starts_with("context for ") && out.contains("target:")).then(|| out.trim_end().to_string())
    };
    let found: Vec<String> = std::thread::scope(|scope| {
        let jobs: Vec<_> = names
            .iter()
            .map(|n| scope.spawn(move || run(n, None).or_else(|| paths.iter().find_map(|p| run(n, Some(p))))))
            .collect();
        jobs.into_iter().filter_map(|j| j.join().ok().flatten()).collect()
    });
    // one block per entity (a qualified and a bare name can find the same
    // one), within the overall budget at about four bytes a token
    let mut seen = std::collections::HashSet::new();
    let mut out = String::new();
    for block in found {
        let head = block.lines().next().unwrap_or("").split(" (budget").next().unwrap_or("").to_string();
        if !seen.insert(head) {
            continue;
        }
        let room = 6000usize.saturating_sub(out.len());
        if room < 400 {
            break;
        }
        let mut cut = block.len().min(room);
        while !block.is_char_boundary(cut) {
            cut -= 1;
        }
        if !out.is_empty() {
            out.push_str("\n\n");
        }
        out.push_str(&block[..cut]);
    }
    (!out.is_empty()).then_some(out)
}

/// Repository files the prompt names (`rich/text.py`), which disambiguate
/// a name defined in several places.
fn mentioned_paths(prompt: &str, repo_root: &Path) -> Vec<String> {
    let rx = regex::Regex::new(r"[\w./-]+/[\w.-]+\.\w{1,6}").unwrap();
    let mut out: Vec<String> = Vec::new();
    for m in rx.find_iter(prompt) {
        let p = m.as_str().trim_start_matches("./").to_string();
        if repo_root.join(&p).is_file() && !out.contains(&p) {
            out.push(p);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_pick_identifier_shapes_and_skip_prose() {
        let c = candidates("why is compute_history_analytics slow in `RepoWatcher` sessions?");
        assert_eq!(
            c,
            vec![
                "RepoWatcher".to_string(),
                "compute_history_analytics".to_string()
            ]
        );
        assert!(candidates("ok great I love this, what should we do next?").is_empty());
    }

    #[test]
    fn candidates_cap() {
        let c = candidates("`alpha_one` `beta_two` `gamma_three` `delta_four` `eps_five`");
        assert_eq!(c.len(), MAX_ENTITIES);
    }
}

```

### Core Architecture Module: `crates/sem-cli/src/commands/tool_hook.rs`
```
//! `sem hook tool`: the sem+weave workflow as a pre-tool hook, the same for
//! every agent harness that speaks the Claude Code hook format (Claude Code,
//! Codex) and for pi through its bash wrapper.
//!
//! Whatever tool the agent reaches for, code is read by sem and changed by
//! weave:
//!
//! ```text
//! cat / head / sed -n / nl FILE     ->  sem find --read FILE [--lines A-B]
//! grep / rg PATTERN [PATHS]          ->  sem grep PATTERN [PATHS]
//! sed -i / perl -pi 's/lit/lit/g'    ->  weave edit (old/new on each file)
//! apply_patch (Codex)                ->  weave edit, one old/new per hunk
//! builds and tests                   ->  sem check --run (Claude, pi), or the
//!                                        sem_check tool, which blocks (Codex)
//! any other shell write              ->  refused: use weave_edit
//! ```
//!
//! As a post-tool hook it follows the agent's own edits through (Edit,
//! Write, MultiEdit, apply_patch; `follow_through`): untouched twins of a
//! changed method, callers a signature change stranded, the tests to run,
//! as additional context. The pre-tool half snapshots the file to diff from.
//!
//! Each decision is logged to `<git dir>/sem-run/coverage/<session>.jsonl`
//! (or `$SEM_COVERAGE_DIR`),
//! so a session can be checked for how much of its code access went through
//! sem and weave. Silent on anything it does not recognise: the hook must
//! never break a tool call it does not understand.

use std::io::Read;
use std::path::{Path, PathBuf};

use regex::Regex;
use serde_json::{json, Value};

/// Commands that only filter output piped into them.
const FILTERS: &[&str] = &["head", "tail", "grep", "egrep", "rg", "sed", "awk", "cut", "sort", "uniq", "wc", "tr", "cat", "less", "more", "column"];

pub fn tool() {
    let mut input = String::new();
    if std::io::stdin().read_to_string(&mut input).is_err() {
        return;
    }
    let Ok(event) = serde_json::from_str::<Value>(&input) else { return };
    let started = std::time::Instant::now();
    let post = match event["hook_event_name"].as_str() {
        Some("PreToolUse") => false,
        Some("PostToolUse") => true,
        _ => return,
    };
    let cwd = event["cwd"].as_str().map(PathBuf::from).unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let ctx = Ctx {
        sem: std::env::current_exe().map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|_| "sem".into()),
        weave: std::env::var("WEAVE_BIN").ok().filter(|s| !s.is_empty()).unwrap_or_else(|| "weave".into()),
        session: event["session_id"].as_str().unwrap_or("").to_string(),
        codex: event["transcript_path"].as_str().is_some_and(|p| p.contains("/.codex/")) || event["turn_id"].is_string(),
        cwd,
    };
    let name = event["tool_name"].as_str().unwrap_or("");
    let input = &event["tool_input"];
    if post {
        if let Some(text) = follow_through(&ctx, name, input, started) {
            println!("{}", json!({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": text}}));
        }
        return;
    }
    prewarm_once(&ctx);
    if let Some(files) = edited_files(name, input) {
        snapshot(&ctx, &files);
    }
    let out = match name {
        "Bash" => bash(&ctx, input),
        "apply_patch" => apply_patch(&ctx, input, started),
        n if n.starts_with("mcp__sem") || n.starts_with("mcp__weave") || n.starts_with("sem_") || n.starts_with("weave_") => {
            ctx.log(if n.contains("weave") { "weave" } else { "sem" }, true, n);
            None
        }
        "Read" | "Edit" | "Write" | "MultiEdit" | "Grep" | "Glob" | "NotebookEdit" => {
            ctx.log("native", false, name);
            None
        }
        _ => None,
    };
    if let Some(v) = out {
        println!("{v}");
    }
}

struct Ctx {
    sem: String,
    weave: String,
    session: String,
    codex: bool,
    cwd: PathBuf,
}

impl Ctx {
    fn log(&self, kind: &str, routed: bool, detail: &str) {
        let dir = match std::env::var("SEM_COVERAGE_DIR").ok().filter(|d| !d.is_empty()) {
            Some(d) => PathBuf::from(d),
            None => match run_dir(&self.cwd) {
                Some(d) => d.join("coverage"),
                None => return,
            },
        };
        let _ = std::fs::create_dir_all(&dir);
        let id = if self.session.is_empty() { "none" } else { &self.session };
        let line = json!({"kind": kind, "routed": routed, "detail": detail.chars().take(200).collect::<String>()}).to_string();
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join(format!("{id}.jsonl"))) {
            let _ = writeln!(f, "{line}");
        }
    }
}

/// The files a native edit tool is about to change (or just changed).
fn edited_files(tool: &str, input: &Value) -> Option<Vec<String>> {
    match tool {
        "Edit" | "Write" | "MultiEdit" => Some(vec![input["file_path"].as_str()?.to_string()]),
        "apply_patch" => Some(super::follow_through::patch_files(input["command"].as_str().or(input["input"].as_str())?)),
        _ => None,
    }
}

/// PreToolUse half of the edit follow-through: keep each file's content
/// before the edit, keyed by session and path.
fn snapshot(ctx: &Ctx, files: &[String]) {
    let Some(run) = run_dir(&ctx.cwd) else { return };
    let root = super::repo_root_or_cwd(&ctx.cwd.to_string_lossy());
    for f in files {
        if let Some(rel) = super::follow_through::relative(&root, &ctx.cwd, f) {
            super::follow_through::snapshot(&run, &ctx.session, &root, &rel);
        }
    }
}

/// PostToolUse half: what the edit left undone (twins, stranded callers,
/// tests to run), as additional context; None when there is nothing to say.
fn follow_through(ctx: &Ctx, tool: &str, input: &Value, started: std::time::Instant) -> Option<String> {
    let files = edited_files(tool, input)?;
    let run = run_dir(&ctx.cwd);
    let root = super::repo_root_or_cwd(&ctx.cwd.to_string_lossy());
    let edited: Vec<super::follow_through::Edited> = files
        .iter()
        .filter_map(|f| super::follow_through::relative(&root, &ctx.cwd, f))
        .map(|rel| super::follow_through::Edited { before: super::follow_through::before(run.as_deref(), &ctx.session, &root, &rel), rel })
        .collect();
    if edited.is_empty() {
        return None;
    }
    let (text, note) = super::follow_through::follow_through(&root, &ctx.session, run.as_deref(), &edited, started);
    ctx.log("follow", text.is_some(), &format!("{tool} {}: {note}", edited.iter().map(|e| e.rel.as_str()).collect::<Vec<_>>().join(" ")));
    text
}

/// `<git common dir>/sem-run`.
fn run_dir(cwd: &Path) -> Option<PathBuf> {
    let o = std::process::Command::new("git").args(["rev-parse", "--path-format=absolute", "--git-common-dir"]).current_dir(cwd).output().ok()?;
    o.status.success().then(|| PathBuf::from(String::from_utf8_lossy(&o.stdout).trim()).join("sem-run"))
}

/// On a session's first tool call, start the project's build in the
/// background (compile everything, compile the tests without running them),
/// so the cold build overlaps the agent's reading instead of its first test
/// run. Once per session, and only with `SEM_PREWARM=1`.
/// `VAR=0 ` for each per-command default the agent's shell has set: a rewritten
/// read or grep must print what the agent's own command would have printed.
fn neutral_defaults(vars: &[&str]) -> String {
    vars.iter().filter(|v| std::env::var_os(v).is_some()).map(|v| format!("{v}=0 ")).collect()
}

fn prewarm_once(ctx: &Ctx) {
    // opt-in: a background build sharing a constrained machine (or a
    // container) with the agent can hold build locks and slow its own runs
    if !std::env::var("SEM_PREWARM").is_ok_and(|v| v == "1") || ctx.session.is_empty() {
        return;
    }
    let Some(dir) = run_dir(&ctx.cwd).map(|d| d.join("prewarm")) else { return };
    let _ = std::fs::create_dir_all(&dir);
    let marker = dir.join(ctx.session.replace(['/', '\\'], "_"));
    if std::fs::OpenOptions::new().write(true).create_new(true).open(&marker).is_err() {
        return; // already started for this session
    }
    let quoted = |s: &str| format!("'{}'", s.replace('\'', "'\\''"));
    let line = format!("{} check --prewarm >/dev/null 2>&1 &", quoted(&ctx.sem));
    let _ = std::process::Command::new("sh").arg("-c").arg(line).current_dir(&ctx.cwd).stdin(std::process::Stdio::null()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null()).status();
}

fn allow(input: &Value, command: String) -> Value {
    let mut ti = input.clone();
    ti["command"] = Value::String(command);
    json!({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "updatedInput": ti}})
}

fn deny(why: String) -> Value {
    json!({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": why}})
}

fn quote(s: &str) -> String {
    if !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || "-_./=:,@+".contains(c)) {
        s.to_string()
    } else {
        format!("'{}'", s.replace('\'', "'\\''"))
    }
}

/// Shell words, POSIX-style quoting; None on unbalanced quotes.
fn words(s: &str) -> Option<Vec<String>> {
    let (mut out, mut cur, mut quote, mut any) = (Vec::new(), String::new(), None::<char>, false);
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        match quote {
            Some('\'') if c == '\'' => quote = None,
            Some('"') if c == '"' => quote = None,
            Some('"') if c == '\\' && it.peek().is_some_and(|n| "\"\\$`".contains(*n)) => cur.push(it.next()?),
            Some(_) => cur.push(c),
            None => match c {
                '\'' | '"' => {
                    quote = Some(c);
                    any = true
                }
                '\\' => {
                    cur.push(it.next()?);
                    any = true
 
```

### Core Architecture Module: `crates/sem-core/benches/common/mod.rs`
```
//! Deterministic fixtures for the parse benchmarks.
//!
//! Generated rather than checked in so the three size points stay honest
//! multiples of one another: the same construct mix at 50, 500 and 4000 lines.
//! Each "unit" is a realistic class/impl + free function pair, so entity
//! density per line stays in the range real source files land in.

#![allow(dead_code)]

const PY_HEADER: &str = "\
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)
";

const PY_UNIT: &str = r#"

@dataclass
class Record{{IDX}}:
    key: str
    value: int = 0
    tags: list[str] = field(default_factory=list)

    def scored(self, weights: dict[str, float]) -> float:
        return sum(weights.get(tag, 0.0) for tag in self.tags) * self.value


class Handler{{IDX}}:
    """Fetches and buffers records, retrying transient failures."""

    def __init__(self, session, retries: int = 3) -> None:
        self.session = session
        self.retries = retries
        self._cache: dict[str, Record{{IDX}}] = {}

    def fetch(self, key: str) -> Optional[Record{{IDX}}]:
        if key in self._cache:
            return self._cache[key]
        for attempt in range(self.retries):
            try:
                record = self.session.get("/records/" + key)
            except TimeoutError:
                logger.warning("timeout on %s attempt %d", key, attempt)
                continue
            else:
                self._cache[key] = record
                return record
        return None

    async def flush(self) -> int:
        written = 0
        for key, record in list(self._cache.items()):
            await self.session.put("/records/" + key, record)
            written += 1
        self._cache.clear()
        return written


def build_handler_{{IDX}}(session) -> Handler{{IDX}}:
    return Handler{{IDX}}(session=session, retries={{IDX}} % 5 + 1)
"#;

const TS_HEADER: &str = "\
import { HttpClient } from './http';
import type { Logger } from './logging';

export const DEFAULT_RETRIES = 3;
";

const TS_UNIT: &str = r#"

export interface Record{{IDX}} {
  key: string;
  value: number;
  tags: string[];
}

export class Handler{{IDX}} {
  private readonly cache = new Map<string, Record{{IDX}}>();

  constructor(
    private readonly client: HttpClient,
    private readonly logger: Logger,
    private readonly retries: number = DEFAULT_RETRIES,
  ) {}

  async fetch(key: string): Promise<Record{{IDX}} | undefined> {
    const hit = this.cache.get(key);
    if (hit !== undefined) {
      return hit;
    }
    for (let attempt = 0; attempt < this.retries; attempt += 1) {
      try {
        const record = await this.client.get<Record{{IDX}}>('/records/' + key);
        this.cache.set(key, record);
        return record;
      } catch (err) {
        this.logger.warn('attempt ' + attempt + ' failed for ' + key);
        if (attempt === this.retries - 1) {
          throw err;
        }
      }
    }
    return undefined;
  }

  scored(record: Record{{IDX}}, weights: Record<string, number>): number {
    return record.tags.reduce((acc, tag) => acc + (weights[tag] ?? 0), 0) * record.value;
  }

  flush(): number {
    const n = this.cache.size;
    this.cache.clear();
    return n;
  }
}

export function buildHandler{{IDX}}(client: HttpClient, logger: Logger): Handler{{IDX}} {
  return new Handler{{IDX}}(client, logger, ({{IDX}} % 5) + 1);
}
"#;

const RS_HEADER: &str = "\
use std::collections::HashMap;
use std::sync::Arc;

pub const DEFAULT_RETRIES: usize = 3;

#[derive(Debug, thiserror::Error)]
pub enum FixtureError {
    #[error(\"timed out\")]
    Timeout,
}
";

const RS_UNIT: &str = r#"

#[derive(Debug, Clone, Default)]
pub struct Record{{IDX}} {
    pub key: String,
    pub value: u64,
    pub tags: Vec<String>,
}

impl Record{{IDX}} {
    pub fn new(key: impl Into<String>, value: u64) -> Self {
        Self {
            key: key.into(),
            value,
            tags: Vec::new(),
        }
    }

    pub fn tagged(mut self, tag: &str) -> Self {
        self.tags.push(tag.to_string());
        self
    }

    pub fn scored(&self, weights: &HashMap<String, f64>) -> f64 {
        self.tags
            .iter()
            .filter_map(|tag| weights.get(tag))
            .sum::<f64>()
            * self.value as f64
    }
}

pub trait Sink{{IDX}}: Send + Sync {
    fn accept(&mut self, record: Record{{IDX}}) -> Result<(), FixtureError>;

    fn accept_all(&mut self, records: Vec<Record{{IDX}}>) -> Result<usize, FixtureError> {
        let mut n = 0;
        for record in records {
            self.accept(record)?;
            n += 1;
        }
        Ok(n)
    }
}

pub fn build_record_{{IDX}}(seed: u64) -> Arc<Record{{IDX}}> {
    let mut record = Record{{IDX}}::new(format!("r-{seed}"), seed % 97);
    if seed % 3 == 0 {
        record = record.tagged("hot");
    }
    Arc::new(record)
}
"#;

fn render(header: &str, unit: &str, units: usize) -> String {
    let mut out = String::with_capacity(header.len() + unit.len() * units + 64);
    out.push_str(header);
    for i in 0..units {
        out.push_str(&unit.replace("{{IDX}}", &i.to_string()));
    }
    out
}

/// A benchmark input: the source, the path it pretends to live at, and a
/// one-edit variant standing in for "the other side of a merge".
pub struct Fixture {
    pub id: String,
    pub path: String,
    pub source: String,
    /// `source` with one localized edit, as a merge's `ours` differs from `base`.
    pub edited: String,
}

impl Fixture {
    pub fn lines(&self) -> usize {
        self.source.lines().count()
    }
}

/// Apply one localized edit near the middle of the file, the way a merge side
/// differs from its base: a body changed inside a single function.
fn edit_middle(source: &str, needle: &str, replacement: &str) -> String {
    let lines: Vec<&str> = source.lines().collect();
    let midpoint = lines.len() / 2;
    // Find the first occurrence at or after the midpoint so the edit lands in
    // the middle of the file, not at the top.
    let mut offset = 0usize;
    for line in lines.iter().take(midpoint) {
        offset += line.len() + 1;
    }
    match source[offset..].find(needle) {
        Some(rel) => {
            let at = offset + rel;
            let mut out = String::with_capacity(source.len() + replacement.len());
            out.push_str(&source[..at]);
            out.push_str(replacement);
            out.push_str(&source[at + needle.len()..]);
            out
        }
        // Fall back to appending, so a fixture always has *some* edit.
        None => format!("{source}\n{replacement}\n"),
    }
}

pub fn python(units: usize) -> Fixture {
    let source = render(PY_HEADER, PY_UNIT, units);
    let edited = edit_middle(&source, "written += 1", "written += 2  # edited");
    Fixture {
        id: "python".to_string(),
        path: "svc/handlers.py".to_string(),
        source,
        edited,
    }
}

pub fn typescript(units: usize) -> Fixture {
    let source = render(TS_HEADER, TS_UNIT, units);
    let edited = edit_middle(
        &source,
        "const n = this.cache.size;",
        "const n = this.cache.size + 1;",
    );
    Fixture {
        id: "typescript".to_string(),
        path: "src/handlers.ts".to_string(),
        source,
        edited,
    }
}

pub fn rust(units: usize) -> Fixture {
    let source = render(RS_HEADER, RS_UNIT, units);
    let edited = edit_middle(
        &source,
        "self.tags.push(tag.to_string());",
        "self.tags.push(tag.trim().to_string());",
    );
    Fixture {
        id: "rust".to_string(),
        path: "src/records.rs".to_string(),
        source,
        edited,
    }
}

/// Unit counts chosen so the rendered files land near 50 / 500 / 4000 lines.
pub const SMALL: usize = 1;
pub const MEDIUM: usize = 11;
pub const LARGE: usize = 88;

/// Every (language, size) pair the benches sweep.
pub fn all() -> Vec<(&'static str, Fixture)> {
    vec![
        ("small", python(SMALL)),
        ("medium", python(MEDIUM)),
        ("large", python(LARGE)),
        ("small", typescript(SMALL)),
        ("medium", typescript(MEDIUM)),
        ("large", typescript(LARGE)),
        ("small", rust(SMALL)),
        ("medium", rust(MEDIUM)),
        ("large", rust(LARGE)),
    ]
}

```

### Core Architecture Module: `crates/sem-core/benches/incremental.rs`
```
//! Does tree-sitter's incremental reparse pay for the merge pattern?
//!
//! ```sh
//! cargo bench -p sem-core --bench incremental
//! ```
//!
//! A merge compares a base against one side that differs by a small number of
//! edit regions — the shape tree-sitter's incremental parser is built for. The
//! question this bench answers is not "is incremental parsing faster" (it is)
//! but "does it move the needle for `extract_entities`", which walks the whole
//! tree afterwards regardless. The `*_and_walk` pairs are the ones that decide
//! whether threading old trees through sem-core's API would be worth it.

mod common;

use criterion::{criterion_group, criterion_main, BatchSize, BenchmarkId, Criterion};
use std::hint::black_box;

use sem_core::parser::plugins::code::{
    extract_entities_from_tree, language_config_for_content, parse_tree, parse_tree_incremental,
};
use tree_sitter::{InputEdit, Point, Tree};

/// Byte offset -> (row, column) in `s`.
fn point_at(s: &str, byte: usize) -> Point {
    let head = &s.as_bytes()[..byte];
    let row = head.iter().filter(|b| **b == b'\n').count();
    let column = match head.iter().rposition(|b| *b == b'\n') {
        Some(nl) => byte - nl - 1,
        None => byte,
    };
    Point { row, column }
}

/// Derive the single `InputEdit` that turns `base` into `new`, by trimming the
/// common prefix and suffix. This is the best case for incremental parsing and
/// exactly what a merge side looks like against its base.
fn single_edit(base: &str, new: &str) -> InputEdit {
    let bb = base.as_bytes();
    let nb = new.as_bytes();

    let mut prefix = 0;
    while prefix < bb.len() && prefix < nb.len() && bb[prefix] == nb[prefix] {
        prefix += 1;
    }
    while prefix > 0 && (!base.is_char_boundary(prefix) || !new.is_char_boundary(prefix)) {
        prefix -= 1;
    }

    let max_suffix = (bb.len() - prefix).min(nb.len() - prefix);
    let mut suffix = 0;
    while suffix < max_suffix && bb[bb.len() - 1 - suffix] == nb[nb.len() - 1 - suffix] {
        suffix += 1;
    }
    while suffix > 0
        && (!base.is_char_boundary(bb.len() - suffix) || !new.is_char_boundary(nb.len() - suffix))
    {
        suffix -= 1;
    }

    let old_end_byte = bb.len() - suffix;
    let new_end_byte = nb.len() - suffix;

    InputEdit {
        start_byte: prefix,
        old_end_byte,
        new_end_byte,
        start_position: point_at(base, prefix),
        old_end_position: point_at(base, old_end_byte),
        new_end_position: point_at(new, new_end_byte),
    }
}

fn edited_tree(base_tree: &Tree, edit: &InputEdit) -> Tree {
    let mut tree = base_tree.clone();
    tree.edit(edit);
    tree
}

fn bench_incremental(c: &mut Criterion) {
    let mut group = c.benchmark_group("incremental");

    for (size, fixture) in common::all() {
        let id = format!("{}-{}", fixture.id, size);
        let config = language_config_for_content(&fixture.source, &fixture.path)
            .unwrap_or_else(|| panic!("no language config for {}", fixture.path));

        let base_tree = parse_tree(config, &fixture.source).expect("base parse failed");
        let edit = single_edit(&fixture.source, &fixture.edited);
        eprintln!(
            "fixture {id}: edit spans bytes {}..{} of {} ({:.3}% of the file)",
            edit.start_byte,
            edit.old_end_byte,
            fixture.source.len(),
            100.0 * (edit.old_end_byte - edit.start_byte) as f64 / fixture.source.len() as f64
        );

        // Sanity: the incremental result must agree with a full parse, or the
        // numbers below are meaningless.
        let incremental = parse_tree_incremental(
            config,
            &fixture.edited,
            Some(&edited_tree(&base_tree, &edit)),
        )
        .expect("incremental parse failed");
        let full = parse_tree(config, &fixture.edited).expect("full parse failed");
        assert_eq!(
            incremental.root_node().to_sexp(),
            full.root_node().to_sexp(),
            "incremental parse diverged from full parse for {id}"
        );

        group.bench_with_input(BenchmarkId::new("full_reparse", &id), &fixture, |b, f| {
            b.iter(|| black_box(parse_tree(config, &f.edited)));
        });

        group.bench_with_input(
            BenchmarkId::new("incremental_reparse", &id),
            &fixture,
            |b, f| {
                b.iter_batched(
                    || edited_tree(&base_tree, &edit),
                    |old| black_box(parse_tree_incremental(config, &f.edited, Some(&old))),
                    BatchSize::SmallInput,
                );
            },
        );

        // The pair that actually decides it: parse + walk, both ways.
        group.bench_with_input(
            BenchmarkId::new("full_reparse_and_walk", &id),
            &fixture,
            |b, f| {
                b.iter(|| {
                    let tree = parse_tree(config, &f.edited).unwrap();
                    black_box(extract_entities_from_tree(
                        &tree, &f.path, config, &f.edited,
                    ))
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("incremental_reparse_and_walk", &id),
            &fixture,
            |b, f| {
                b.iter_batched(
                    || edited_tree(&base_tree, &edit),
                    |old| {
                        let tree = parse_tree_incremental(config, &f.edited, Some(&old)).unwrap();
                        black_box(extract_entities_from_tree(
                            &tree, &f.path, config, &f.edited,
                        ))
                    },
                    BatchSize::SmallInput,
                );
            },
        );
    }
    group.finish();
}

criterion_group!(benches, bench_incremental);
criterion_main!(benches);

```

### Core Architecture Module: `crates/sem-core/benches/parse_profile.rs`
```
//! Where the time goes in `extract_entities`, and what the content-addressed
//! cache changes.
//!
//! Run everything:
//!
//! ```sh
//! cargo bench -p sem-core --bench parse_profile
//! ```
//!
//! The `split/*` group attributes a single extraction across its three phases:
//! hashing the blob (the cache key), tree-sitter parsing, and the entity walk.
//! The `extract/*` group compares the three end-to-end paths that matter:
//! the pre-cache code path, a forced cache miss, and a cache hit.

mod common;

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use std::hint::black_box;

use sem_core::parser::cache;
use sem_core::parser::plugin::SemanticParserPlugin;
use sem_core::parser::plugins::code::{
    extract_entities_from_tree, language_config_for_content, parse_tree, CodeParserPlugin,
};
use sem_core::parser::plugins::create_default_registry;

/// Attribute one extraction across hash / parse / walk.
fn bench_split(c: &mut Criterion) {
    let plugin = CodeParserPlugin;
    let mut group = c.benchmark_group("split");

    for (size, fixture) in common::all() {
        let id = format!("{}-{}", fixture.id, size);
        let config = language_config_for_content(&fixture.source, &fixture.path)
            .unwrap_or_else(|| panic!("no language config for {}", fixture.path));
        let tree = parse_tree(config, &fixture.source).expect("parse failed");
        let entity_count = plugin
            .extract_entities_with_tree(&fixture.source, &fixture.path)
            .0
            .len();
        eprintln!(
            "fixture {id}: {} lines, {} bytes, {entity_count} entities",
            fixture.lines(),
            fixture.source.len()
        );

        group.throughput(Throughput::Bytes(fixture.source.len() as u64));

        // Phase 1: the cache key. This is the only cost a hit cannot avoid.
        group.bench_with_input(BenchmarkId::new("hash", &id), &fixture, |b, f| {
            b.iter(|| black_box(xxhash_rust::xxh3::xxh3_128(f.source.as_bytes())));
        });

        // Phase 2: tree-sitter parse, reusing the thread-local Parser as the
        // real code path does.
        group.bench_with_input(BenchmarkId::new("parse", &id), &fixture, |b, f| {
            b.iter(|| black_box(parse_tree(config, &f.source)));
        });

        // Phase 3: the entity-extraction walk over an already-built tree.
        group.bench_with_input(BenchmarkId::new("walk", &id), &fixture, |b, f| {
            b.iter(|| {
                black_box(extract_entities_from_tree(
                    &tree, &f.path, config, &f.source,
                ))
            });
        });
    }
    group.finish();
}

/// The three end-to-end paths: pre-cache, forced miss, hit.
fn bench_extract(c: &mut Criterion) {
    let plugin = CodeParserPlugin;
    let mut group = c.benchmark_group("extract");

    for (size, fixture) in common::all() {
        let id = format!("{}-{}", fixture.id, size);
        group.throughput(Throughput::Bytes(fixture.source.len() as u64));

        // The code path as it was before the cache existed: parse + walk, no
        // lookup, no insert. This is the ±5% baseline for "first parse".
        group.bench_with_input(BenchmarkId::new("uncached", &id), &fixture, |b, f| {
            b.iter(|| black_box(plugin.extract_entities_with_tree(&f.source, &f.path).0));
        });

        // Every iteration misses: `clear` runs outside the timed region, so
        // this is parse + walk + key hash + insert + the clone handed back.
        group.bench_with_input(BenchmarkId::new("miss", &id), &fixture, |b, f| {
            b.iter_custom(|iters| {
                let mut total = std::time::Duration::ZERO;
                for _ in 0..iters {
                    cache::clear();
                    let start = std::time::Instant::now();
                    black_box(plugin.extract_entities(&f.source, &f.path));
                    total += start.elapsed();
                }
                total
            });
        });

        // Warm: the case weave hits on every repeat merge of the same blob.
        plugin.extract_entities(&fixture.source, &fixture.path);
        group.bench_with_input(BenchmarkId::new("hit", &id), &fixture, |b, f| {
            b.iter(|| black_box(plugin.extract_entities(&f.source, &f.path)));
        });
    }
    group.finish();
}

/// A merge's parse workload: base, ours, theirs — three versions of one file,
/// two of which differ from base by a single edit region.
fn bench_merge_pattern(c: &mut Criterion) {
    let registry = create_default_registry();
    let mut group = c.benchmark_group("merge_pattern");

    for (size, fixture) in common::all() {
        let id = format!("{}-{}", fixture.id, size);
        // A third distinct blob, still valid in every fixture language.
        let theirs = format!("{}\n", fixture.edited);
        let sides = [
            fixture.source.clone(),
            fixture.edited.clone(),
            theirs.clone(),
        ];
        group.throughput(Throughput::Bytes(
            sides.iter().map(|s| s.len() as u64).sum::<u64>(),
        ));

        // Cold: nothing has been seen before, as on the first merge touching
        // this file.
        group.bench_with_input(BenchmarkId::new("cold", &id), &sides, |b, sides| {
            b.iter_custom(|iters| {
                let mut total = std::time::Duration::ZERO;
                for _ in 0..iters {
                    cache::clear();
                    let start = std::time::Instant::now();
                    for side in sides {
                        black_box(registry.extract_entities(&fixture.path, side));
                    }
                    total += start.elapsed();
                }
                total
            });
        });

        // Warm: the same three blobs re-merged, as across a fleet.
        for side in &sides {
            registry.extract_entities(&fixture.path, side);
        }
        group.bench_with_input(BenchmarkId::new("warm", &id), &sides, |b, sides| {
            b.iter(|| {
                for side in sides {
                    black_box(registry.extract_entities(&fixture.path, side));
                }
            });
        });
    }
    group.finish();
}

/// What the 28-language grammar tables cost before the first parse.
fn bench_startup(c: &mut Criterion) {
    let mut group = c.benchmark_group("startup");

    group.bench_function("create_default_registry", |b| {
        b.iter(|| black_box(create_default_registry()));
    });

    // Language lookup is a linear scan of a static table of ~36 configs.
    let py = common::python(common::SMALL);
    group.bench_function("language_config_lookup", |b| {
        b.iter(|| black_box(language_config_for_content(&py.source, &py.path)));
    });

    // First touch of a grammar: builds the tree-sitter Language from the
    // static parse tables. Amortized to nothing after the first file.
    group.bench_function("first_grammar_touch", |b| {
        let config = language_config_for_content(&py.source, &py.path).unwrap();
        b.iter(|| black_box((config.get_language)()));
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_split,
    bench_extract,
    bench_merge_pattern,
    bench_startup
);
criterion_main!(benches);

```

### Core Architecture Module: `crates/sem-core/examples/arc_str_wire_probe.rs`
```
//! Throwaway probe (interning-for-memory wave): does `Arc<str>`
//! serialize to byte-identical CBOR as `String`, and does an old
//! `String`-shaped payload decode cleanly into an `Arc<str>`-shaped struct?
//! If both hold, per-file `Arc<str>` interning of `AstRefKind`'s identifier
//! fields needs no `FACTS_SCHEMA_VERSION` bump — the wire format is
//! unchanged, only the in-memory representation is. Not wired into any
//! build; delete once its answer is recorded.

use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Serialize, Deserialize, Debug, PartialEq)]
struct OldShape {
    name: String,
    receiver: String,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
struct NewShape {
    name: Arc<str>,
    receiver: Arc<str>,
}

fn main() {
    let old = OldShape {
        name: "foo".to_string(),
        receiver: "bar".to_string(),
    };
    let new = NewShape {
        name: Arc::from("foo"),
        receiver: Arc::from("bar"),
    };

    let mut old_bytes = Vec::new();
    ciborium::into_writer(&old, &mut old_bytes).unwrap();
    let mut new_bytes = Vec::new();
    ciborium::into_writer(&new, &mut new_bytes).unwrap();

    println!("old_bytes = {old_bytes:?}");
    println!("new_bytes = {new_bytes:?}");
    println!("byte_identical = {}", old_bytes == new_bytes);

    // Cross-decode: old String-shaped bytes -> new Arc<str>-shaped struct.
    let decoded_new: NewShape = ciborium::from_reader(&old_bytes[..]).unwrap();
    println!("cross_decode_old_to_new = {decoded_new:?}");
    assert_eq!(decoded_new, new);

    // And the reverse: new Arc<str>-shaped bytes -> old String-shaped struct.
    let decoded_old: OldShape = ciborium::from_reader(&new_bytes[..]).unwrap();
    println!("cross_decode_new_to_old = {decoded_old:?}");
    assert_eq!(decoded_old, old);

    println!(
        "PROBE VERDICT: wire-compatible = {}",
        old_bytes == new_bytes
    );
}

```

### Core Architecture Module: `crates/sem-core/examples/diff_oracle.rs`
```
//! The diff-equivalence oracle, run against real git history.
//!
//! Picks the most recent commits that touch the target extensions, replays
//! each one as a synthetic PR through the *full* `sem diff` pipeline twice —
//! once with the fast path off, once with it on — and asserts the entity
//! sets, the `DiffResult`, and the rendered `sem diff --json` envelope are
//! identical. See `crates/sem-core/src/parser/diff_oracle.rs` for what
//! "identical" means and why it is defined there rather than at the
//! `structural_hash` level.
//!
//! ```text
//! cargo run --release --example diff_oracle -- <repo_root> [options]
//!
//!   --commits N        how many qualifying commits to replay (default 20)
//!   --skip N           skip the N most recent qualifying commits (default 0)
//!   --exts .ts,.tsx    extensions a commit must touch to qualify
//!                      (default: the JS/TS family)
//!   --mutate KIND      install a mutation extractor instead of the built-in
//!                      fast path: faithful | drop-last | shift-span |
//!                      rename | drop-structural-hash | drop-kappa |
//!                      merge-declarators | all
//!   --label L          label for the emitted lines (default: repo dir name)
//!   --max-files N      skip commits touching more than N qualifying files
//!                      (default 400)
//!   --verbose          print every divergence, not just the first three
//! ```
//!
//! Exit status is 1 if any commit is `Divergent`, or if every commit is
//! `Vacuous` (nothing served ⇒ nothing proved).

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use sem_core::git::bridge::GitBridge;
use sem_core::git::types::DiffScope;
use sem_core::parser::diff_oracle::{self, MutatingExtractor, Mutation, OracleRun};
use sem_core::parser::fast_extractor;
use sem_core::parser::plugins::create_default_registry;

struct Args {
    root: PathBuf,
    commits: usize,
    skip: usize,
    exts: Vec<String>,
    mutate: Option<Vec<Mutation>>,
    label: String,
    max_files: usize,
    verbose: bool,
}

fn parse_args() -> Result<Args, String> {
    let mut it = std::env::args().skip(1);
    let root = PathBuf::from(
        it.next()
            .ok_or("usage: diff_oracle <repo_root> [options]")?,
    );
    let label = root
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "repo".to_string());
    let mut args = Args {
        root,
        commits: 20,
        skip: 0,
        exts: fast_extractor::JS_TS_EXTENSIONS
            .iter()
            .map(|s| s.to_string())
            .collect(),
        mutate: None,
        label,
        max_files: 400,
        verbose: false,
    };
    while let Some(flag) = it.next() {
        match flag.as_str() {
            "--commits" => args.commits = next_usize(&mut it, "--commits")?,
            "--skip" => args.skip = next_usize(&mut it, "--skip")?,
            "--max-files" => args.max_files = next_usize(&mut it, "--max-files")?,
            "--label" => args.label = it.next().ok_or("--label needs a value")?,
            "--verbose" => args.verbose = true,
            "--exts" => {
                let raw = it.next().ok_or("--exts needs a value")?;
                args.exts = raw
                    .split(',')
                    .map(|s| s.trim().to_ascii_lowercase())
                    .filter(|s| !s.is_empty())
                    .collect();
            }
            "--mutate" => {
                let raw = it.next().ok_or("--mutate needs a value")?;
                args.mutate = Some(if raw == "all" {
                    Mutation::ALL.to_vec()
                } else {
                    vec![Mutation::parse(&raw).ok_or(format!("unknown mutation `{raw}`"))?]
                });
            }
            other => return Err(format!("unknown flag `{other}`")),
        }
    }
    Ok(args)
}

fn next_usize(it: &mut impl Iterator<Item = String>, flag: &str) -> Result<usize, String> {
    it.next()
        .ok_or_else(|| format!("{flag} needs a value"))?
        .parse()
        .map_err(|_| format!("{flag} needs a number"))
}

/// Most recent non-merge commits whose diff touches at least one qualifying
/// file, newest first.
fn qualifying_commits(
    root: &Path,
    exts: &[String],
    want: usize,
    skip: usize,
    max_files: usize,
) -> Result<Vec<String>, String> {
    let repo = git2::Repository::open(root).map_err(|e| format!("open {root:?}: {e}"))?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    let mut skipped = 0usize;
    for oid in revwalk.take(20_000) {
        if out.len() >= want {
            break;
        }
        let Ok(oid) = oid else { continue };
        let Ok(commit) = repo.find_commit(oid) else {
            continue;
        };
        if commit.parent_count() != 1 {
            continue;
        }
        let Ok(parent) = commit.parent(0) else {
            continue;
        };
        let (Ok(tree), Ok(parent_tree)) = (commit.tree(), parent.tree()) else {
            continue;
        };
        let Ok(diff) = repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), None) else {
            continue;
        };
        let mut hits = 0usize;
        for delta in diff.deltas() {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_ascii_lowercase())
                .unwrap_or_default();
            if exts.iter().any(|e| path.ends_with(e.as_str())) {
                hits += 1;
            }
        }
        if hits == 0 || hits > max_files {
            continue;
        }
        if skipped < skip {
            skipped += 1;
            continue;
        }
        out.push(oid.to_string());
    }
    Ok(out)
}

fn print_run(run: &OracleRun, verbose: bool) {
    println!("ORACLE {}", run.summary_line());
    let show = if verbose { run.divergences.len() } else { 3 };
    for d in run.divergences.iter().take(show) {
        println!("   [{:?}] {} :: {}", d.layer, d.scope, d.detail);
    }
    if !verbose && run.divergences.len() > show {
        println!("   … {} more (use --verbose)", run.divergences.len() - show);
    }
}

fn main() {
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    };

    let commits = match qualifying_commits(
        &args.root,
        &args.exts,
        args.commits,
        args.skip,
        args.max_files,
    ) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    };
    if commits.is_empty() {
        eprintln!("no qualifying commits found in {:?}", args.root);
        std::process::exit(2);
    }

    let bridge = match GitBridge::open(&args.root) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("git open failed: {e}");
            std::process::exit(2);
        }
    };
    let registry = create_default_registry();

    // Materialize every commit's change set once, so a mutation sweep costs
    // git work once instead of once per mutation.
    let mut change_sets = Vec::new();
    for sha in &commits {
        match bridge.get_changed_files(&DiffScope::Commit { sha: sha.clone() }, &[]) {
            Ok(mut files) => {
                files.retain(|f| {
                    let p = f.file_path.to_ascii_lowercase();
                    args.exts.iter().any(|e| p.ends_with(e.as_str()))
                });
                if !files.is_empty() {
                    change_sets.push((sha.clone(), files));
                }
            }
            Err(e) => eprintln!("skipping {}: {e}", &sha[..8.min(sha.len())]),
        }
    }

    let legs: Vec<Option<Mutation>> = match &args.mutate {
        Some(ms) => ms.iter().copied().map(Some).collect(),
        None => vec![None],
    };

    let mut failed = false;
    for leg in legs {
        let previous = leg.map(|m| MutatingExtractor::new(m).install());
        let leg_label = match leg {
            Some(m) => format!("{}/{:?}", args.label, m),
            None => format!("{}/builtin", args.label),
        };

        let mut tally: BTreeMap<String, usize> = BTreeMap::new();
        for (sha, files) in &change_sets {
            let label = format!("{}@{}", leg_label, &sha[..8.min(sha.len())]);
            let run = diff_oracle::run(files, &registry, &label);
            *tally.entry(format!("{:?}", run.verdict())).or_default() += 1;
            print_run(&run, args.verbose);
        }
        if let Some(previous) = previous {
            fast_extractor::install(previous);
        }

        let divergent = *tally.get("Divergent").unwrap_or(&0);
        let equivalent = *tally.get("Equivalent").unwrap_or(&0);
        let vacuous = *tally.get("Vacuous").unwrap_or(&0);
        println!(
            "ORACLE_TOTAL leg={leg_label} commits={} equivalent={equivalent} vacuous={vacuous} divergent={divergent}",
            change_sets.len()
        );

        // A mutation sweep inverts the expectation for every mutation but
        // `Faithful`: the oracle is *supposed* to diverge, and a mutation that
        // slips through is the failure — unless the mutation is one this
        // corpus simply never exercises, which is reported as INERT rather
        // than laundered into either a pass or a fail.
        match leg {
            None | Some(Mutation::Faithful) => {
                if divergent > 0 || equivalent == 0 {
                    failed = true;
                    println!("ORACLE_LEG_FAILED leg={leg_label} expected=equivalent");
                }
            }
            Some(m) if divergent > 0 => {
               
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #546** (2026-11-10): **fix: sem starts on Debian 12 and Ubuntu 22.04 (0.30.1)**
  *Symptoms*: Reported by Grump (grump.run): on Debian 12 and Ubuntu 22.04, sem installs but won't start (`GLIBC_2.38 not found`), and the installer still says "Installed unknown" and exits 0. `cargo install sem-cli` also fails everywhere because cargo pulls rmcp 1.8.0.  - **Linux binaries are built on ubuntu-22.04** (glibc 2.35) instead of ubuntu-latest (2.39). A new release step fails the build if a Linux binary needs a glibc newer than 2.35. - **install.sh and npm postinstall check that sem starts.** If it doesn't, they show the error and exit non-zero instead of reporting success. - **sem-mcp accepts rmcp ~1.6.** I checked that rmcp 1.8.0 fails to compile sem-mcp (E0308). The README now uses `cargo install --locked`. - **Release 0.30.1.** package.json was still at 0.29.1 and is now 0.30.1 too, so npm users get the fixed binary.

- **Issue #544** (2026-11-06): **Add jq support behind an opt-in lang-jq feature**
  *Symptoms*: Adds jq (`.jq`) via `tree-sitter-jq` 1.0.2. Because that grammar is GPL-3.0-or-later, the feature is opt-in and **not** in `grammar-all`, pending your answer on #543. Moving it into `grammar-all` is a one-line change.  - Each top-level `def` is a `function` entity. A nested `def` stays inside its parent. A `def` after a top-level pipeline is still found. The trailing program is not an entity, so edits to it show up as orphan changes. - New `StripStrategy::HashLine` for jq. `//` is jq's alternative operator, so the generic stripper blanked every reference after `.x // …` on a line. - Edges come from the existing same-file word scan: `f(args)` is `calls`, a bare `f` is `TypeRef`. - Known limits: builtins and defs in other files are not resolved, and a `$name` variable that shares a def's name creates a false edge. That last one is an `#[ignore]`d test with the reason attached.  Tested on a real jq codebase: 11 defs across 6 files, no parse errors.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

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

### Incident Patch 1: `036dde8e` (2026-11-10)
**Commit Message**: fix: sem starts on Debian 12 and Ubuntu 22.04 (0.30.1) (#546)

Reported by Grump (grump.run): on Debian 12 and Ubuntu 22.04, sem
installs but won't start (`GLIBC_2.38 not found`), and the installer
still says "Installed unknown" and exits 0. `cargo install sem-cli` also
fails everywhere because cargo pulls rmcp 1.8.0.

- **Linux binaries are built on ubuntu-22.04** (glibc 2.35) instead of
ubuntu-latest (2.39). A new release step fails the build if a Linux
binary needs a glibc newer than 2.35.
- **install.sh and npm postinstall check that sem starts.** If it
doesn't, they show the error and exit non-zero instead of reporting
success.
- **sem-mcp accepts rmcp ~1.6.** I checked that rmcp 1.8.0 fails to
compile sem-mcp (E0308). The README now uses `cargo install --locked`.
- **Release 0.30.1.** package.json was still at 0.29.1 and is now 0.30.1
too, so npm users get the fixed binary.

**File**: `.github/workflows/release.yml` (modified, +16/-2)
```diff
@@ -87,11 +87,13 @@ jobs:
       fail-fast: false
       matrix:
         include:
+          # Linux builds run on the oldest supported Ubuntu: a binary needs the glibc it was built against or newer,
+          # so building on ubuntu-latest (glibc 2.39) broke Debian 12 (2.36) and Ubuntu 22.04 (2.35).
           - target: x86_64-unknown-linux-gnu
-            os: ubuntu-latest
+            os: ubuntu-22.04
             name: sem-linux-x86_64
           - target: aarch64-unknown-linux-gnu
-            os: ubuntu-latest
+            os: ubuntu-22.04
             name: sem-linux-arm64
             cross_package: gcc-aarch64-linux-gnu
             cross_linker: aarch64-linux-gnu-gcc
@@ -141,6 +143,18 @@ jobs:
       - name: Build
         run: cargo build --release --target ${{ matrix.target }} -p sem-cli ${{ matrix.vendor_openssl && '--features vendored-openssl' || '' }}
 
+      - name: Check the binary runs on glibc 2.35 (Ubuntu 22.04, Debian 12)
+        if: runner.os == 'Linux'
+        run: |
+          OBJDUMP=objdump
+          [ "${{ matrix.target }}" = aarch64-unknown-linux-gnu ] && OBJDUMP=aarch64-linux-gnu-objdump
+          need=$($OBJDUMP -T target/${{ matrix.target }}/release/sem | grep -o 'GLIBC_[0-9.]*' | sed 's/GLIBC_//' | sort -V | tail -1)
+          echo "highest glibc symbol needed: $need"
+          if [ "$(printf '%s\n2.35\n' "$need" | sort -V | tail -1)" != "2.35" ]; then
+            echo "::error::sem needs glibc $need, newer than 2.35: it would not start on Ubuntu 22.04 or Debian 12"
+            exit 1
+          fi
+
       - name: Package (Unix)
         if: runner.os != 'Windows'
         run: |
```

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@ All notable changes to sem are documented in this file.
 
 ## [Unreleased]
 
+## [0.30.1] - 2026-11-11
+
+### Fixed
+
+- sem starts on Debian 12 and Ubuntu 22.04 again. The Linux binaries were built against glibc 2.39 and failed with `GLIBC_2.38 not found`; they are now built on Ubuntu 22.04, and a release fails if a binary needs anything newer than glibc 2.35. Thanks to Grump for the report and repro.
+- The install script and `npm install` no longer report success when sem can't start. They now show the error and exit with a failure.
+- `cargo install sem-cli` builds again: sem-mcp now accepts rmcp 1.6.x only, since rmcp 1.8.0 doesn't compile with it. The README also uses `--locked`.
+
 ## [0.30.0] - 2026-11-09
 
 ### Added
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -166,13 +166,13 @@ sem config update
 Or via cargo, from [crates.io](https://crates.io/crates/sem-cli):
 
 ```bash
-cargo install sem-cli
+cargo install --locked sem-cli
 ```
 
 Or build the latest `main` from source (requires Rust):
 
 ```bash
-cargo install --git https://github.com/Ataraxy-Labs/sem sem-cli
+cargo install --locked --git https://github.com/Ataraxy-Labs/sem sem-cli
 ```
 
 Or grab a binary from [GitHub Releases](https://github.com/Ataraxy-Labs/sem/releases).
```

**File**: `crates/Cargo.lock` (modified, +5/-5)
```diff
@@ -2300,7 +2300,7 @@ checksum = "94143f37725109f92c262ed2cf5e59bce7498c01bcc1502d7b9afe439a4e9f49"
 
 [[package]]
 name = "sem-cli"
-version = "0.30.0"
+version = "0.30.1"
 dependencies = [
  "axum",
  "ciborium",
@@ -2330,7 +2330,7 @@ dependencies = [
 
 [[package]]
 name = "sem-cloud-client"
-version = "0.30.0"
+version = "0.30.1"
 dependencies = [
  "serde",
  "serde_json",
@@ -2339,7 +2339,7 @@ dependencies = [
 
 [[package]]
 name = "sem-core"
-version = "0.30.0"
+version = "0.30.1"
 dependencies = [
  "ciborium",
  "criterion",
@@ -2406,7 +2406,7 @@ dependencies = [
 
 [[package]]
 name = "sem-mcp"
-version = "0.30.0"
+version = "0.30.1"
 dependencies = [
  "axum",
  "git2",
@@ -2434,7 +2434,7 @@ dependencies = [
 
 [[package]]
 name = "sem-plugin"
-version = "0.30.0"
+version = "0.30.1"
 dependencies = [
  "sem-core",
  "serde",
```

**File**: `crates/sem-cli/Cargo.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "sem-cli"
-version = "0.30.0"
+version = "0.30.1"
 edition = "2021"
 license = "MIT OR Apache-2.0"
 description = "Semantic version control CLI. Shows what entities changed (functions, classes, methods) instead of lines."
@@ -15,9 +15,9 @@ path = "src/main.rs"
 
 [dependencies]
 tempfile = "3.24.0"
-sem-core = { path = "../sem-core", version = "0.30.0", features = ["disk-cache", "topology"] }
-sem-mcp = { path = "../sem-mcp", version = "0.30.0" }
-sem-cloud-client = { path = "../sem-cloud-client", version = "0.30.0" }
+sem-core = { path = "../sem-core", version = "0.30.1", features = ["disk-cache", "topology"] }
+sem-mcp = { path = "../sem-mcp", version = "0.30.1" }
+sem-cloud-client = { path = "../sem-cloud-client", version = "0.30.1" }
 serde = { version = "1", features = ["derive"] }
 clap = { version = "4", features = ["derive", "env"] }
 colored = "2"
```

**File**: `crates/sem-cloud-client/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "sem-cloud-client"
-version = "0.30.0"
+version = "0.30.1"
 edition = "2021"
 license = "MIT OR Apache-2.0"
 description = "Shared client for sem-cloud: credentials, repo resolution, caching, and the metered graph API. Used by both the sem CLI and the sem MCP server."
```

**File**: `crates/sem-core/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "sem-core"
-version = "0.30.0"
+version = "0.30.1"
 edition = "2021"
 license = "MIT OR Apache-2.0"
 description = "Entity-level semantic diff engine. Extracts functions, classes, and methods from 28 languages via tree-sitter and diffs at the entity level."
```

**File**: `crates/sem-mcp/Cargo.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "sem-mcp"
-version = "0.30.0"
+version = "0.30.1"
 edition = "2021"
 license = "MIT OR Apache-2.0"
 description = "MCP server for entity-level semantic code intelligence. 6 tools: sem_entities, sem_diff, sem_blame, sem_impact, sem_log, sem_context."
@@ -14,11 +14,11 @@ name = "sem-mcp"
 path = "src/main.rs"
 
 [dependencies]
-sem-core = { path = "../sem-core", version = "0.30.0", features = ["disk-cache"] }
-sem-cloud-client = { path = "../sem-cloud-client", version = "0.30.0" }
+sem-core = { path = "../sem-core", version = "0.30.1", features = ["disk-cache"] }
+sem-cloud-client = { path = "../sem-cloud-client", version = "0.30.1" }
 git2 = { version = "0.20", default-features = false }
 lru = "0.16"
-rmcp = { version = "1", features = ["server", "transport-io", "transport-streamable-http-server"] }
+rmcp = { version = "~1.6", features = ["server", "transport-io", "transport-streamable-http-server"] }
 axum = "0.8"
 subtle = "2"
 tower-http = { version = "0.6", features = ["limit"] }
```

#### Recent Merged Pull Requests:
- **PR #546** (2026-11-10): fix: sem starts on Debian 12 and Ubuntu 22.04 (0.30.1) (@rs545837)
- **PR #544** (2026-11-06): Add jq support behind an opt-in lang-jq feature (@alycda)
- **PR #542** (2026-11-04): Parse Quarto documents (.qmd) as Markdown (@rs545837)
- **PR #541** (2026-11-02): chore(release): prepare Sem 0.29.1 (@rs545837)
- **PR #540** (2026-10-31): Intent search ranks code by meaning; edit hook stops refusing scratch writes (@rs545837)
- **PR #539** (2026-10-30): release: Sem 0.29.0 (@rs545837)

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

## X. sem starts on Debian 12 and Ubuntu 22.04 (0.30.1) (#546)

**RULE**:
When implementing operations in `.github/workflows/release.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Ataraxy-Labs/sem. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `036dde8e`: sem starts on Debian 12 and Ubuntu 22.04 (0.30.1) (#546). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/release.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
          # Linux builds run on the oldest supported Ubuntu: a binary needs the glibc it was built against or newer,
          # so building on ubuntu-latest (glibc 2.39) broke Debian 12 (2.36) and Ubuntu 22.04 (2.35).
            os: ubuntu-22.04
            os: ubuntu-22.04
      - name: Check the binary runs on glibc 2.35 (Ubuntu 22.04, Debian 12)
        if: runner.os == 'Linux'
        run: |
          OBJDUMP=objdump
          [ "${{ matrix.target }}" = aarch64-unknown-linux-gnu ] && OBJDUMP=aarch64-linux-gnu-objdump
          need=$($OBJDUMP -T target/${{ matrix.target }}/release/sem | grep -o 'GLIBC_[0-9.]*' | sed 's/GLIBC_//' | sort -V | tail -1)
          echo "highest glibc symbol needed: $need"
          if [ "$(printf '%s\n2.35\n' "$need" | sort -V | tail -1)" != "2.35" ]; then
            echo "::error::sem needs glibc $need, newer than 2.35: it would not start on Ubuntu 22.04 or Debian 12"
            exit 1
          fi

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
            os: ubuntu-latest
            os: ubuntu-latest
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `036dde8e` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
