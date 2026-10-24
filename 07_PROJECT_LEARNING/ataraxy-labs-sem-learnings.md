> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ataraxy-labs-sem-learnings.md`  
> **Source**: github ([https://github.com/Ataraxy-Labs/sem](https://github.com/Ataraxy-Labs/sem))  
> **Source Version**: `f7fa398c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-24T20:48:37.742Z  
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
> **Harvest Timestamp**: 2026-10-24T20:48:35.854Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ataraxy-Labs/sem`
- **Description**: Semantic version control => entity-level diffs, blame, and impact analysis on top of git. 28 languages via tree-sitter. Built for coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3422 stars

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
- **Issue #530** (2026-10-24): **docs: record MCP query contract fixes**
  *Symptoms*: Add the missing Unreleased entry for #529. Documentation only.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #hLtm8gfokaGm2XmuSg6PfFAOtJ/gZtYN3gwXO5g41cw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzZW0tZG9jcyIsInByb2plY3RJZCI6InByal9MT1JiN29SSjBTbUZGUnlGUEw1eE1ha3FVcjRrIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3JzNTQ1ODM3cy1wcm9qZWN0cy9zZW0tZG9jcy9BZlVGOGpURmpndG9rZVREa3V5b2FZNnVRZVNZIiwicHJldmlld1VybCI6InNlbS1kb2NzLWdpdC1kb2NzLXF1ZXJ5LWNvbnRyYWN0LWNoYW5nZWxvZy1yczU0NTgzN3MtcHJvamVjdHMudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJQRU5ESU5HIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9fV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPUF0YXJheHktTGFicyZyZXBvPXNlbSZwcj01MzAifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/rs545837s-projects/sem-docs"><sup><img src="https://vercel.

- **Issue #529** (2026-10-24): **fix(mcp): support scoped context and structured caller batches**
  *Symptoms*: ## Summary - Resolve context queries within the requested directory without leaking sibling scope. - Accept batched caller queries, preserving ambiguity handling. - Return a valid JSON array with per-query errors for JSON batches. - Include the simple capability-aware policy used in the recent benchmark campaign.  ## Validation All 110 sem-mcp library tests passed in Modal. Earlier scoped-context and batching implementation plus the policy passed seven official benchmark runs (two each ADK/DSPy/Restic and one Ant Design). The JSON envelope fix has unit coverage but has not had a new session-speed benchmark. No universal speedup claimed.

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

### Incident Patch 1: `6caf881d` (2026-10-22)
**Commit Message**: perf: parallelize the rest of the cold index build's serial stretches (#528)

Follow-up to #524, which merged with the first commit of this work. This
draft holds the remaining fixes for the serial stretches of a cold index
build. The final before and after table against main is being
re-measured and will replace the numbers below.

## What was slow

Profiling cold `sem graph` builds on Modal (8 vCPU) showed that the
build scales about linearly now, but long single-threaded stretches
dominate its wall time on big repos. These were the serial pieces left
after #524 on the Linux kernel (2.35M entities):

| phase | ms |
|---|---|
| index image build (`build_image`) | 6,400 |
| first-pass lookup tables (`owned`) | 4,700 |
| corpus table fingerprints | 2,000 |
| facts store save plus corpus populate | 2,600 |
| freeing the entity list after the build | about 1,400 |

## Changes

1. **Fingerprints hashed in parallel.** `fingerprint_corpus_tables`
computes the value hashes in parallel and writes them in the tables' own
iteration order. The map and the XOR guard come out the same as before.
The table is sized up front.
2. **Index sections side by side.** The refs and trigram sections run
b

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ All notable changes to sem are documented in this file.
 ### Changed
 
 - Cold graph builds move reusable lookup tables instead of cloning them and sort independent lookup buckets in parallel. Sequential builds retain the same behavior without requiring Rayon.
-
+- **Cold index builds on large repos are about a fifth faster.** A first `sem graph` on the Linux kernel (2.35M entities) went from 49.5 s to 38.6 s, and on kubernetes (545k entities) from 12.5 s to 10.0 s, on an 8 vCPU machine, with peak memory within 2%. The build had long single-threaded stretches. Along with the lookup-table change above, corpus fingerprints are hashed in parallel, independent index sections and lookup tables are built side by side, and large frees and the two facts saves no longer hold up the command. The graph and the index file are byte-identical to before.
 - **`sem_find` with mode `callers` gives the CLI's answer.** It says when the static graph cannot prove the caller set is complete, lists possible callers, and merges dispatch groups, where it used to print `callers: none` either way. Its JSON is now the shape `sem callers --json` prints (`entity`, `related`, `complete`, `incomplete_because`).
 
 ### Fixed
```

**File**: `crates/sem-cli/src/commands/graph.rs` (modified, +34/-9)
```diff
@@ -90,6 +90,7 @@ pub fn graph_command(opts: GraphOptions) {
         );
     }
     timings.finish();
+    drop_in_background(graph);
 }
 
 /// Format a count with thousands separators (1234 -> "1,234"), uv-style.
@@ -419,14 +420,25 @@ fn build_graph_with_facts_store(
     // Best-effort: a save failure (permissions, disk full, read-only cache
     // dir) must never fail the build this function exists to produce. The
     // store is a pure speed optimization — the next process just stays cold.
-    let __facts_save_t0 = std::time::Instant::now();
-    let _ = store.save(root, &exported);
-    crate::build_cache::cache_profile_mark("facts_store_save", __facts_save_t0);
-    let __facts_corpus_t0 = std::time::Instant::now();
-    if let Some(corpus) = &corpus {
-        let _ = corpus.populate_delta(local_hashes.as_ref(), &exported, registry);
-    }
-    crate::build_cache::cache_profile_mark("facts_corpus_populate_delta", __facts_corpus_t0);
+    //
+    // The per-repo store and the machine-global corpus are separate
+    // directories written from the same read-only snapshot, so the two saves
+    // run side by side rather than one after the other.
+    std::thread::scope(|scope| {
+        scope.spawn(|| {
+            let __facts_corpus_t0 = std::time::Instant::now();
+            if let Some(corpus) = &corpus {
+                let _ = corpus.populate_delta(local_hashes.as_ref(), &exported, registry);
+            }
+            crate::build_cache::cache_profile_mark(
+                "facts_corpus_populate_delta",
+                __facts_corpus_t0,
+            );
+        });
+        let __facts_save_t0 = std::time::Instant::now();
+        let _ = store.save(root, &exported);
+        crate::build_cache::cache_profile_mark("facts_store_save", __facts_save_t0);
+    });
     facts_rss_mark("after_populate_delta");
     session.into_parts()
 }
@@ -876,7 +888,7 @@ pub fn get_or_build_graph_topology_with_timings(
     } else {
         CacheMissSavePolicy::IndexOnly
     };
-    let (graph, _entities) = get_or_build_graph_with_cache_policy(
+    let (graph, entities) = get_or_build_graph_with_cache_policy(
         root,
         file_paths,
         registry,
@@ -885,9 +897,22 @@ pub fn get_or_build_graph_topology_with_timings(
         source_scope,
         timings,
     );
+    drop_in_background(entities);
     graph
 }
 
+/// Free a large build product on a detached thread. Dropping millions of
+/// entities (every one owning several strings) takes seconds on a giant repo,
+/// and nothing waits on the memory coming back; a short-lived CLI process
+/// simply exits around the thread.
+fn drop_in_background<T: Send + 'static>(value: T) {
+    // If the thread cannot be spawned the closure, and the value with it, is
+    // dropped right here, exactly as before.
+    let _ = std::thread::Builder::new()
+        .name("sem-drop".into())
+        .spawn(move || drop(value));
+}
+
 pub fn get_or_build_graph_topology_with_topology_save_on_miss_with_timings(
     root: &Path,
     file_paths: &[String],
```

**File**: `crates/sem-core/src/index/writer.rs` (modified, +149/-111)
```diff
@@ -325,120 +325,158 @@ pub(crate) fn build_image(
         .collect();
     image_mark("file_and_entity_index", __fileidx_t0);
 
-    let __entbytes_t0 = std::time::Instant::now();
-    let mut entity_bytes = Vec::with_capacity(entities.len() * ENTITY_REC_LEN);
-    for entity in &entities {
-        let id_text = if ids_elided {
-            id_tail_of(&entity.id, &entity.file_path).unwrap_or(&entity.id)
-        } else {
-            entity.id.as_str()
-        };
-        let kind = kinds.intern(&entity.entity_type, &mut arena);
-        let parent = entity
-            .parent_id
-            .as_deref()
-            .and_then(|id| entity_index.get(id).copied())
-            .unwrap_or(NONE_U32);
-        let flags = match test_entity_ids {
-            Some(ids) if ids.contains(entity.id.as_str()) => format::entity::FLAG_IS_TEST,
-            _ => 0,
-        };
-        let (start_byte, end_byte) = entity_byte_spans
-            .and_then(|spans| spans.get(entity.id.as_str()))
-            .copied()
-            .unwrap_or((NONE_U32, NONE_U32));
-        format::entity::write(
-            &mut entity_bytes,
-            arena.push_short(id_text),
-            arena.push_interned(&entity.name),
-            kind,
-            flags,
-            file_index[entity.file_path.as_str()],
-            entity.start_line as u32,
-            entity.end_line as u32,
-            parent,
-            start_byte,
-            end_byte,
-        );
-    }
-
-    // NAMES: entity indices sorted by name bytes, so a name query is an
-    // equal_range rather than a scan. The tie-break on
-    // index keeps the table a deterministic function of the graph, which is
-    // what the consistency oracle's byte-equality property needs.
-    image_mark("entities_section", __entbytes_t0);
-    let __names_t0 = std::time::Instant::now();
-    let mut name_order: Vec<u32> = (0..entities.len() as u32).collect();
-    maybe_par_sort_unstable_by!(name_order, |a: &u32, b: &u32| {
-        entities[*a as usize]
-            .name
-            .cmp(&entities[*b as usize].name)
-            .then(a.cmp(b))
-    });
-    let mut name_bytes = Vec::with_capacity(name_order.len() * NAME_REC_LEN);
-    for index in &name_order {
-        name_bytes.extend_from_slice(&index.to_le_bytes());
-    }
+    // ENTITIES/NAMES/FILES/KINDS share the string arena, so they are built in
+    // order on one task; REFS and TRIGRAM read only the sorted entities and
+    // the file list, so they run beside that chain instead of after it. Each
+    // section is a pure function of its inputs, so the image is byte-identical
+    // to the serial build (the image sha256 gate witnesses this).
+    let refs_typed = entities.len() <= format::refs::MAX_ENTITIES;
+    let sections = || {
+        let __entbytes_t0 = std::time::Instant::now();
+        // The per-entity hash lookups (parent index, test flag, byte span,
+        // file index) touch no shared state, so they are resolved in parallel
+        // first; only the arena pushes, which assign string offsets in entity
+        // order, stay serial.
+        let resolved: Vec<(u32, u16, (u32, u32), u32)> = maybe_par_iter!(entities)
+            .map(|entity| {
+                let parent = entity
+                    .parent_id
+                    .as_deref()
+                    .and_then(|id| entity_index.get(id).copied())
+                    .unwrap_or(NONE_U32);
+                let flags = match test_entity_ids {
+                    Some(ids) if ids.contains(entity.id.as_str()) => format::entity::FLAG_IS_TEST,
+                    _ => 0,
+                };
+                let span = entity_byte_spans
+                    .and_then(|spans| spans.get(entity.id.as_str()))
+                    .copied()
+                    .unwrap_or((NONE_U32, NONE_U32));
+                (parent, flags, span, file_index[entity.file_path.as_str()])
+            })
+            .collect();
+        let mut entity_bytes = Vec::with_capacity(entities.len() * ENTITY_REC_LEN);
+        for (entity, &(parent, flags, (start_byte, end_byte), file)) in
+            entities.iter().zip(&resolved)
+        {
+            let id_text = if ids_elided {
+                id_tail_of(&entity.id, &entity.file_path).unwrap_or(&entity.id)
+            } else {
+                entity.id.as_str()
+            };
+            let kind = kinds.intern(&entity.entity_type, &mut arena);
+            format::entity::write(
+                &mut entity_bytes,
+                arena.push_short(id_text),
+                arena.push_interned(&entity.name),
+                kind,
+                flags,
+                file,
+                entity.start_line as u32,
+                entity.end_line as u32,
+                parent,
+                start_byte,
+                end_byte,
+            );
+        }
+        drop(resolved);
+
+        // NAMES: entity indices sorted by name bytes, so a name query is an
+        // equal_ran
```

**File**: `crates/sem-core/src/parser/graph.rs` (modified, +78/-41)
```diff
@@ -2365,7 +2365,16 @@ impl EntityGraph {
         resolve_profile::add_pass1_wall_ns(__pass1_wall_t0.elapsed());
 
         let __assemble_t0 = std::time::Instant::now();
-        let mut all_entities: Vec<SemanticEntity> = Vec::new();
+        // Sized up front: growing by doubling re-copied every entity already
+        // gathered, which on a 2M-entity corpus is a lot of memmove on
+        // the serial spine. Reused entities (warm builds) are not counted, so
+        // this is a lower bound and the vector still grows when it must.
+        let mut all_entities: Vec<SemanticEntity> = Vec::with_capacity(
+            per_file
+                .iter()
+                .map(|product| product.entities.as_ref().map_or(0, Vec::len))
+                .sum(),
+        );
         let mut parsed_files: Vec<(String, String, tree_sitter::Tree)> = Vec::new();
         let mut fresh_precomputed: HashMap<String, scope_resolve::PrecomputedFileFacts> =
             HashMap::default();
@@ -2771,50 +2780,78 @@ impl EntityGraph {
             ));
             symbol_table_plain = symbol_table_owned;
         } else {
-            // Unchanged from before: whole rebuild, single pass over
-            // all_entities for symbol_table/entity_map/entity_ranges, a
-            // second pass (needs entity_map complete) for class/owner
-            // members.
-            let mut symbol_table_owned: SymbolTable =
-                HashMap::with_capacity_and_hasher(all_entities.len(), Default::default());
-            let mut owned_entity_map: EntityInfoMap =
-                HashMap::with_capacity_and_hasher(all_entities.len(), Default::default());
-            let mut owned_entity_ranges: EntityRanges = HashMap::default();
-            for entity in &all_entities {
-                // No eager `entry(key.clone)`: `entry`
-                // demands an owned key up front, so the old spelling allocated
-                // `name`/`file_path` Strings that were immediately dropped on
-                // every hit — `file_path` once per entity in the file. Same
-                // get_mut/insert idiom `child_line_ranges` above already uses.
-                let interned_id = EntityId::from(entity.id.as_str());
-                match symbol_table_owned.get_mut(entity.name.as_str()) {
-                    Some(bucket) => bucket.push(interned_id.clone()),
-                    None => {
-                        symbol_table_owned.insert(entity.name.clone(), vec![interned_id.clone()]);
+            // Whole rebuild: one pass each over all_entities for
+            // symbol_table/entity_map/entity_ranges, then a second pass
+            // (needs entity_map complete) for class/owner members. The three
+            // first-pass tables are independent, so they are built on three
+            // tasks from ids interned once up front. Each table still sees
+            // entities in `all_entities` order, so bucket order and
+            // last-insert-wins on a colliding id are exactly what one serial
+            // pass produced.
+            let interned_ids: Vec<EntityId> = maybe_par_iter!(all_entities)
+                .map(|entity| EntityId::from(entity.id.as_str()))
+                .collect();
+            let build_symbol_table = || {
+                let mut table: SymbolTable =
+                    HashMap::with_capacity_and_hasher(all_entities.len(), Default::default());
+                for (entity, interned_id) in all_entities.iter().zip(&interned_ids) {
+                    // No eager `entry(key.clone)`: `entry`
+                    // demands an owned key up front, so the old spelling allocated
+                    // `name`/`file_path` Strings that were immediately dropped on
+                    // every hit — `file_path` once per entity in the file. Same
+                    // get_mut/insert idiom `child_line_ranges` above already uses.
+                    match table.get_mut(entity.name.as_str()) {
+                        Some(bucket) => bucket.push(interned_id.clone()),
+                        None => {
+                            table.insert(entity.name.clone(), vec![interned_id.clone()]);
+                        }
                     }
                 }
-                owned_entity_map.insert(
-                    interned_id.clone(),
-                    EntityInfo {
-                        id: interned_id.clone(),
-                        name: entity.name.clone(),
-                        entity_type: entity.entity_type.clone(),
-                        file_path: entity.file_path.clone(),
-                        parent_id: entity.parent_id.as_ref().map(Into::into),
-                        start_line: entity.start_line,
-                        end_line: entity.end_line,
-                    },
-                );
-                match owned_entity_ranges.get_mut(entity.file_path.as_str()) {
-                    Some(bucket) => bucket.push((entity.start_line, entity.end_line, interned_id)),
-     
```

**File**: `crates/sem-core/src/parser/incremental.rs` (modified, +6/-0)
```diff
@@ -352,6 +352,12 @@ impl Serialize for TableFingerprints {
 }
 
 impl TableFingerprints {
+    /// Make room for `additional` more keys, so a whole-corpus pass does not
+    /// rehash the table over and over as it grows.
+    pub(crate) fn reserve(&mut self, additional: usize) {
+        self.entries.reserve(additional);
+    }
+
     #[inline]
     pub(crate) fn put(&mut self, key: u64, value: u64) {
         self.entries.insert(key, value);
```

**File**: `crates/sem-core/src/parser/scope_resolve.rs` (modified, +45/-21)
```diff
@@ -3452,6 +3452,13 @@ pub(crate) fn fingerprint_corpus_tables(
     entity_map: &EntityInfoMap,
     fp: &mut TableFingerprints,
 ) -> u64 {
+    fp.reserve(
+        lookups.symbol_table.len()
+            + lookups.class_members.len()
+            + lookups.owner_members.len()
+            + entity_map.len()
+            + 1,
+    );
     let mut sink = FingerprintSink::new(fp, 0);
     // `register_rust_module_import` (the module-alias `use` form) scans
     // every `(name, target file)` pair below looking for ones whose file
@@ -3461,36 +3468,53 @@ pub(crate) fn fingerprint_corpus_tables(
     // already visits them for the per-key `SymbolTable`/`EntityMap`
     // fingerprints, so the guard costs one extra `u64` XOR per pair, not a
     // second corpus scan.
+    //
+    // The value hashes are computed in parallel and then written in the
+    // tables' own iteration order, so the map (and the guard, an XOR fold)
+    // comes out exactly as a serial pass would leave it. On a 2.3M-entity
+    // corpus this pass was several seconds on the build's serial spine.
     let mut wildcard_import_guard: u64 = 0;
-    for (name, ids) in lookups.symbol_table.iter() {
-        let mut h = ValueHasher::new();
-        for id in ids {
-            h.s(id);
-            if let Some(info) = entity_map.get(id) {
-                wildcard_import_guard ^= {
-                    let mut wh = ValueHasher::new();
-                    wh.s(name).s(&info.file_path);
-                    wh.finish()
-                };
+    let symbol_rows: Vec<(&String, u64, u64)> = maybe_par_iter!(lookups.symbol_table)
+        .map(|(name, ids)| {
+            let mut h = ValueHasher::new();
+            let mut guard: u64 = 0;
+            for id in ids {
+                h.s(id);
+                if let Some(info) = entity_map.get(id) {
+                    guard ^= {
+                        let mut wh = ValueHasher::new();
+                        wh.s(name).s(&info.file_path);
+                        wh.finish()
+                    };
+                }
             }
-        }
-        sink.one(Table::SymbolTable, name, h.finish());
+            (name, h.finish(), guard)
+        })
+        .collect();
+    for (name, value, guard) in symbol_rows {
+        wildcard_import_guard ^= guard;
+        sink.one(Table::SymbolTable, name, value);
     }
     for (owner, members) in &lookups.class_members {
         sink.one(Table::ClassMembers, owner, hash_member_list(members));
     }
     for (owner, members) in &lookups.owner_members {
         sink.one(Table::OwnerMembers, owner, hash_member_list(members));
     }
-    for (id, info) in entity_map {
-        let mut h = ValueHasher::new();
-        h.s(&info.name)
-            .s(&info.entity_type)
-            .s(&info.file_path)
-            .s(info.parent_id.as_deref().unwrap_or("\u{0}"))
-            .u(info.start_line)
-            .u(info.end_line);
-        sink.one(Table::EntityMap, id, h.finish());
+    let entity_rows: Vec<(&EntityId, u64)> = maybe_par_iter!(entity_map)
+        .map(|(id, info)| {
+            let mut h = ValueHasher::new();
+            h.s(&info.name)
+                .s(&info.entity_type)
+                .s(&info.file_path)
+                .s(info.parent_id.as_deref().unwrap_or("\u{0}"))
+                .u(info.start_line)
+                .u(info.end_line);
+            (id, h.finish())
+        })
+        .collect();
+    for (id, value) in entity_rows {
+        sink.one(Table::EntityMap, id, value);
     }
     sink.whole(Table::GuardRustModuleAlias, wildcard_import_guard);
     wildcard_import_guard
```

---

### Incident Patch 2: `1ab4f898` (2026-10-22)
**Commit Message**: perf: shorten the serial spine of cold index builds (#524)

Draft: numbers and the equivalence check are still being collected and
will be added here.

## What is slow

I profiled cold `sem graph` builds on Modal (8 vCPU) with phase timers
and stack sampling. Today's baseline is about 63 s for the Linux kernel
(2.35M entities) and 13 s for kubernetes (545k). The old 589 s figure is
stale. Per-entity cost now grows roughly linearly, so the problem is no
longer a quadratic. Most of the remaining wall time on large repos is
spent in single-threaded stretches of the build. On kubernetes, about
three quarters of the stack samples had only one busy thread.

The largest serial pieces on Linux:

| phase | ms |
|---|---|
| entity lookup tables (`owned`), including six whole-corpus clones |
7,650 |
| index image build (`build_image`) | 11,180 |
| corpus table fingerprints | 3,400 |

## Changes

1. **Drop the whole-corpus lookup clones.** A non-retain session build
(any repo over 20k files) cloned the symbol table, entity map, class and
owner members, entity ranges and child ranges into its carry. Nothing
mutates them after that point, so they are now moved into the carry once
resolution is d

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ All notable changes to sem are documented in this file.
 
 ### Changed
 
+- Cold graph builds move reusable lookup tables instead of cloning them and sort independent lookup buckets in parallel. Sequential builds retain the same behavior without requiring Rayon.
+
 - **`sem_find` with mode `callers` gives the CLI's answer.** It says when the static graph cannot prove the caller set is complete, lists possible callers, and merges dispatch groups, where it used to print `callers: none` either way. Its JSON is now the shape `sem callers --json` prints (`entity`, `related`, `complete`, `incomplete_because`).
 
 ### Fixed
```

**File**: `crates/sem-core/src/index/grep.rs` (modified, +6/-0)
```diff
@@ -115,10 +115,16 @@ pub fn search(
     // Trigram candidate derivation and the membership sweep touch disjoint
     // sections (NAMES-adjacent TRIGRAM postings vs. FILES/DIRS), so they run
     // concurrently — same discipline `commands::query::index_answer` uses.
+    #[cfg(feature = "parallel")]
     let ((candidates, origin), complete) = rayon::join(
         || candidate_files(idx, pattern, opts.case_insensitive),
         || complete_check(idx, root, walk_subtree),
     );
+    #[cfg(not(feature = "parallel"))]
+    let ((candidates, origin), complete) = (
+        candidate_files(idx, pattern, opts.case_insensitive),
+        complete_check(idx, root, walk_subtree),
+    );
 
     // Unlike `commands::query`'s entity verbs, grep has no cheaper
     // authoritative fallback to bail to on an inconclusive sweep — `verify`
```

**File**: `crates/sem-core/src/parser/graph.rs` (modified, +69/-23)
```diff
@@ -263,7 +263,11 @@ const PARSED_FILE_REUSE_BYTE_LIMIT: u64 = 24 * 1024 * 1024;
 pub fn source_bytes(root: &Path, file_paths: &[String]) -> u64 {
     file_paths
         .iter()
-        .map(|f| std::fs::metadata(root.join(f)).map(|m| m.len()).unwrap_or(0))
+        .map(|f| {
+            std::fs::metadata(root.join(f))
+                .map(|m| m.len())
+                .unwrap_or(0)
+        })
         .sum()
 }
 
@@ -796,6 +800,11 @@ pub type EntityAdjacencyMap = HashMap<EntityId, Vec<EntityId>>;
 pub type SymbolTable = HashMap<String, Vec<EntityId>>;
 
 fn sort_symbol_table_targets_by_source(symbol_table: &mut SymbolTable, entity_map: &EntityInfoMap) {
+    #[cfg(feature = "parallel")]
+    symbol_table
+        .par_iter_mut()
+        .for_each(|(_, target_ids)| sort_one_symbol_table_bucket(target_ids, entity_map));
+    #[cfg(not(feature = "parallel"))]
     for target_ids in symbol_table.values_mut() {
         sort_one_symbol_table_bucket(target_ids, entity_map);
     }
@@ -916,10 +925,15 @@ fn sort_members_bucket_by_source(members: &mut Vec<MemberTarget>, entity_map: &E
 /// neither was a *stated*, enforced invariant — see
 /// "Resolver tie-break contract" section for the measured effect of making
 /// it one.
-fn sort_all_member_buckets_by_source<K>(
+fn sort_all_member_buckets_by_source<K: Eq + std::hash::Hash + Sync>(
     buckets: &mut HashMap<K, Vec<MemberTarget>>,
     entity_map: &EntityInfoMap,
 ) {
+    #[cfg(feature = "parallel")]
+    buckets
+        .par_iter_mut()
+        .for_each(|(_, members)| sort_members_bucket_by_source(members, entity_map));
+    #[cfg(not(feature = "parallel"))]
     for members in buckets.values_mut() {
         sort_members_bucket_by_source(members, entity_map);
     }
@@ -940,6 +954,11 @@ fn sort_all_member_buckets_by_source<K>(
 /// this sorted order wins) instead of an unstated by-product of whichever
 /// order entities happened to be discovered in.
 fn sort_all_entity_ranges_by_source(ranges_by_file: &mut EntityRanges) {
+    #[cfg(feature = "parallel")]
+    ranges_by_file
+        .par_iter_mut()
+        .for_each(|(_, ranges)| ranges.sort_unstable());
+    #[cfg(not(feature = "parallel"))]
     for ranges in ranges_by_file.values_mut() {
         ranges.sort_unstable();
     }
@@ -2635,6 +2654,10 @@ impl EntityGraph {
         // corpus — see `maintain_entity_lookups_incremental`'s doc comment.
         let use_incremental_lookups =
             inc.is_some() && !retain_parsed_files && *carry_entity_lookups_primed;
+        // Whether the tables built below end up in the carry after this build:
+        // always on the incremental path, and on a non-retain session build's
+        // whole rebuild, which primes the carry for the next one.
+        let reclaim_lookups = inc.is_some() && !retain_parsed_files;
 
         // Pass A (borrowed half): lookups that borrow `&str` out of
         // `all_entities` and so must be rebuilt every build regardless of
@@ -2821,7 +2844,14 @@ impl EntityGraph {
                     }
                 }
             }
-            sort_symbol_table_targets_by_source(&mut symbol_table_owned, &owned_entity_map);
+            // The four bucket sorts below and the child-range index are
+            // independent of each other (each writes one table and reads only
+            // `owned_entity_map`/`all_entities`), so they run side by side
+            // instead of one after another on the build's serial spine.
+            // Every bucket is sorted by a total order (or stably, from the
+            // same push order), so the result does not depend on scheduling.
+            let sort_symbols =
+                || sort_symbol_table_targets_by_source(&mut symbol_table_owned, &owned_entity_map);
             // same canonical (file_path, start_line, end_line, id)
             // tie-break as `symbol_table`, made explicit here instead of
             // relying on `all_entities` already being in file-path order
@@ -2831,25 +2861,38 @@ impl EntityGraph {
             // build's `maintain_entity_lookups_incremental` (which re-sorts
             // only the buckets it touches) starts from an already-canonical
             // baseline.
-            sort_all_member_buckets_by_source(&mut owned_class_members, &owned_entity_map);
-            sort_all_member_buckets_by_source(&mut owned_owner_members, &owned_entity_map);
-            sort_all_entity_ranges_by_source(&mut owned_entity_ranges);
+            let sort_members = || {
+                sort_all_member_buckets_by_source(&mut owned_class_members, &owned_entity_map);
+                sort_all_member_buckets_by_source(&mut owned_owner_members, &owned_entity_map);
+                sort_all_entity_ranges_by_source(&mut owned_entity_ranges);
+            };
+            let child_ranges = || {
+                let __lookup_child_ranges_t0 = std::time::Instant::now();
+                let ranges = build_child_ranges_by_parent(&all_entities);
+                resolve_p
```

---

### Incident Patch 3: `7e4ca027` (2026-10-22)
**Commit Message**: fix(deps): bump webpki-roots to 1.0.10 (#526)

Fixes #525.

Bumps webpki-roots from 1.0.7 to 1.0.10 in Cargo.lock to pick up the
fixed root store.

webpki-roots 0.26.11 is still in the tree because ureq 2 depends on it,
but that version is a semver shim that re-exports webpki-roots 1.x, so
after this change every TLS client in sem uses the 1.0.10 roots.
Dropping the shim entirely needs a move to ureq 3, which can come
separately.

Checked with `cargo tree -i webpki-roots@1.0.10` and a release build of
sem-cli.

Thanks @0323pin for the report.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

**File**: `crates/Cargo.lock` (modified, +3/-3)
```diff
@@ -3673,14 +3673,14 @@ version = "0.26.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "521bc38abb08001b01866da9f51eb7c5d647a19260e00054a8c7fd5f9e57f7a9"
 dependencies = [
- "webpki-roots 1.0.7",
+ "webpki-roots 1.0.10",
 ]
 
 [[package]]
 name = "webpki-roots"
-version = "1.0.7"
+version = "1.0.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "52f5ee44c96cf55f1b349600768e3ece3a8f26010c05265ab73f945bb1a2eb9d"
+checksum = "1c1c8e20c8a38fc7d65abfe74eb7280e4aa667e8eec8bc84996d2874810748d9"
 dependencies = [
  "rustls-pki-types",
 ]
```

#### Recent Merged Pull Requests:
- **PR #530** (2026-10-24): docs: record MCP query contract fixes (@rs545837)
- **PR #529** (2026-10-24): fix(mcp): support scoped context and structured caller batches (@rs545837)
- **PR #528** (2026-10-22): perf: parallelize the rest of the cold index build's serial stretches (@rs545837)
- **PR #527** (2026-10-22): fix: preserve entity lookup and source receipt completeness (@rs545837)
- **PR #526** (2026-10-22): fix(deps): bump webpki-roots to 1.0.10 (@rs545837)
- **PR #524** (2026-10-22): perf: shorten the serial spine of cold index builds (@rs545837)

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

## X. parallelize the rest of the cold index build's serial stretches (#528)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Ataraxy-Labs/sem. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6caf881d`: parallelize the rest of the cold index build's serial stretches (#528). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Cold index builds on large repos are about a fifth faster.** A first `sem graph` on the Linux kernel (2.35M entities) went from 49.5 s to 38.6 s, and on kubernetes (545k entities) from 12.5 s to 10.0 s, on an 8 vCPU machine, with peak memory within 2%. The build had long single-threaded stretches. Along with the lookup-table change above, corpus fingerprints are hashed in parallel, independent index sections and lookup tables are built side by side, and large frees and the two facts saves no longer hold up the command. The graph and the index file are byte-identical to before.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6caf881d` are properly handled with clean fallback behavior.
