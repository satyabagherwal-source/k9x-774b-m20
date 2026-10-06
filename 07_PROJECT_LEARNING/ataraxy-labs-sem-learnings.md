# Forensic Learning Record (Deep Inspection): Ataraxy-Labs/sem

> **Canonical Artifact**: `07_PROJECT_LEARNING/ataraxy-labs-sem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ataraxy-Labs/sem](https://github.com/Ataraxy-Labs/sem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:16:11.723Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ataraxy-Labs/sem`
- **Description**: Semantic version control => entity-level diffs, blame, and impact analysis on top of git. 28 languages via tree-sitter. Built for coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3393 stars

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
//! Reads a Claude Code UserPromptSubmit event from stdin and extracts
//! identifier-shaped tokens from the prompt. Used to resolve them against
//! the resident sem MCP server's socket sidecar; that sidecar is deleted
//! (GREP-KILLER S4, — measured it
//! at 0% availability in production, so this path was already always a
//! silent no-op in practice) and `socket_lookup` now always returns `None`.
//! Kept registered rather than removed: its own documented contract already
//! covers this exact case.
//!
//! Silent by design: no candidates, no repo, no socket, any error — print
//! nothing and exit 0. The hook must never disturb a prompt.

use std::io::Read;
use std::path::{Path, PathBuf};

const MAX_ENTITIES: usize = 2;

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
    for name in &names {
        if let Some(text) = socket_lookup(&repo_root, name) {
            blocks.push(text);
        }
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

/// Used to be a one-call context lookup against the resident server's socket
/// sidecar (GREP-KILLER S4, — deleted:
/// see sem-mcp/src/lib.rs). own measurement found that socket never
/// answered in production (0% availability), so this always returned `None`
/// in practice already — deleting the dead connection attempt changes no
/// observable behavior. `sem hook prompt-submit` stays registered (its
/// documented contract is "silent by design... any error — print nothing
/// and exit 0"), it just now honestly never has a data source to try,
/// instead of unconditionally failing a connection it made.
fn socket_lookup(_repo_root: &Path, _name: &str) -> Option<String> {
    None
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
    fn candidates_cap_at_two() {
        let c = candidates("`alpha_one` `beta_two` `gamma_three`");
        assert_eq!(c.len(), 2);
    }
}

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

### Core Architecture Module: `crates/sem-core/examples/edge_dump_probe.rs`
```
//! One-off diagnostic (follow-up): dump every resolved edge,
//! sorted, so two runs (e.g. at different `SCOPE_RESOLVE_FILE_CHUNK_SIZE`
//! values) can be diffed to find exactly which edge(s) differ. Not part of
//! the public example surface this change ships.
//!
//! Usage: cargo run --release --example edge_dump_probe -- <repo_root> <out_file>
//!
//! DANGLING_EDGE_ORACLE (a follow-up to the Go memory-check work): every edge's
//! `to_entity`/`from_entity` must name a real id in this same build's
//! entity set — the invariant `PrecomputedFileFacts::rekey_entity_ids`'
//! `Scope::defs`/`Scope::owner_id` gap violated (a stale pre-Go-rewrite id
//! left in a precomputed scope's `.defs` survived into an edge whose
//! target no entity held any more, only detected by hand via
//! `entity_probe`). This oracle makes that bug class self-detecting:
//! printed once as `DANGLING_EDGE name=... from=... to=... ref_type=...`
//! per offender, then a gating `DANGLING_EDGE_ORACLE edges=... checked=...
//! dangling=... verdict=ok|MISMATCH` line, matching this crate's other
//! probes' `ORACLE ... verdict=` convention (see `index_probe.rs`,
//! `incr_probe.rs`). Runs unconditionally — the check is O(edges) against
//! an already-built `HashSet<&str>`, not a second graph build.
use std::collections::HashSet;
use std::io::Write;
use std::path::{Path, PathBuf};

use sem_core::parser::graph::EntityGraph;
use sem_core::parser::plugins::create_default_registry;
use sem_core::parser::registry::ParserRegistry;
use sem_core::utils::scan::{is_default_excluded, is_probably_binary_path};

fn make_registry(root: &Path) -> ParserRegistry {
    let mut registry = create_default_registry();
    registry.load_semrc(root);
    registry.load_gitattributes(root);
    registry
}

fn walk_files(root: &Path, _registry: &ParserRegistry) -> Vec<String> {
    let mut files = Vec::new();
    let mut builder = ignore::WalkBuilder::new(root);
    builder
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true);
    for entry in builder.build() {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let rel = match path.strip_prefix(root) {
            Ok(r) => r,
            Err(_) => continue,
        };
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if is_default_excluded(&rel_str) {
            continue;
        }
        if is_probably_binary_path(&rel_str) {
            continue;
        }
        files.push(rel_str);
    }
    files.sort();
    files
}

fn main() {
    let mut args = std::env::args().skip(1);
    let root: PathBuf = args
        .next()
        .expect("usage: edge_dump_probe <repo_root> <out_file>")
        .into();
    let out_path: PathBuf = args
        .next()
        .expect("usage: edge_dump_probe <repo_root> <out_file>")
        .into();

    let registry = make_registry(&root);
    let file_paths = walk_files(&root, &registry);
    let (graph, entities) = EntityGraph::build(&root, &file_paths, &registry);

    let mut lines: Vec<String> = graph
        .edges
        .iter()
        .map(|e| format!("{}\t{:?}\t{}", e.from_entity, e.ref_type, e.to_entity))
        .collect();
    lines.sort();

    let mut f = std::fs::File::create(&out_path).expect("create out file");
    for line in &lines {
        writeln!(f, "{line}").expect("write line");
    }
    eprintln!("wrote {} edges to {}", lines.len(), out_path.display());

    dangling_edge_oracle(&graph.edges, &entities);
}

/// DANGLING_EDGE_ORACLE: `∀ e ∈ edges. e.from_entity ∈ ids ∧ e.to_entity ∈
/// ids`, where `ids` is this same build's own entity set. A build that
/// produces an edge naming an id nothing declared is always a bug (a
/// resolver-internal id going stale between when it was captured and when
/// it was read, e.g. a rewrite this crate ran without rekeying every place
/// that id could be cached) — never a legitimate "the target doesn't exist
/// yet" case, since `resolve_ref` only ever returns ids it read out of this
/// same build's own tables.
fn dangling_edge_oracle(
    edges: &[sem_core::parser::graph::EntityRef],
    entities: &[sem_core::model::entity::SemanticEntity],
) {
    let ids: HashSet<&str> = entities.iter().map(|e| e.id.as_str()).collect();
    let mut dangling = 0usize;
    for e in edges {
        let from_ok = ids.contains(e.from_entity.as_str());
        let to_ok = ids.contains(e.to_entity.as_str());
        if !from_ok || !to_ok {
            dangling += 1;
            if !from_ok {
                eprintln!(
                    "DANGLING_EDGE endpoint=from from={} ref_type={:?} to={}",
                    e.from_entity, e.ref_type, e.to_entity
                );
            }
            if !to_ok {
                eprintln!(
                    "DANGLING_EDGE endpoint=to from={} ref_type={:?} to={}",
                    e.from_entity, e.ref_type, e.to_entity
                );
            }
        }
    }
    let verdict = if dangling == 0 { "ok" } else { "MISMATCH" };
    eprintln!(
        "DANGLING_EDGE_ORACLE edges={} entities={} dangling={dangling} verdict={verdict}",
        edges.len(),
        entities.len()
    );
}

```

### Core Architecture Module: `crates/sem-core/examples/facts_corpus_probe.rs`
```
//! Cross-repo proof + timing probe for the machine-global facts corpus
//! (Phase B's local tier). Companion to `facts_probe.rs` (the
//! per-repo tier's own cross-process oracle) — this probe proves the *new*
//! claim: identical file content at the same relative path, in two
//! *different* repo roots on this machine, shares extracted facts, without
//! ever touching cached resolution edges (see `facts_store.rs`'s "Cross-repo
//! corpus" doc section for why that scope boundary is deliberate).
//!
//! Not part of the public API and not wired into any product code path.
//!
//! Usage:
//!   cargo run --release --example facts_corpus_probe -- \
//!       populate <repo_a_root> <corpus_dir> [label]
//!   cargo run --release --example facts_corpus_probe -- \
//!       consume <repo_b_root> <corpus_dir> [label]
//!
//! `populate` cold-builds `repo_a_root` and writes every file's facts into
//! the corpus at `corpus_dir` (as a real `sem` invocation would, via
//! `FactsCorpus::populate_delta` with `previous = None`).
//!
//! `consume` treats `repo_b_root` as a *fresh checkout with no local
//! FactsStore snapshot of its own* (`local = None`, matching a repo's first
//! build) and:
//!   1. Merges against the corpus (`FactsCorpus::merge_with_local`), then
//!      warm-starts a session from the result — this is the "corpus-assisted
//!      build" whose wall time and reuse counts get reported.
//!   2. Separately cold-builds the same tree with `EntityGraph::build` (no
//!      corpus involved at all) and fingerprints it.
//!   3. Asserts (a) the corpus-assisted build's fingerprint equals the cold
//! build's — proof (a) from the change: bit-identical graph vs a
//!      no-corpus cold build.
//!   4. Reports `files probed`/`files hit` from the merge stats — proof (b):
//!      cross-repo reuse actually happened (`hits > 0` whenever the two
//!      repos share content, which the caller controls by choice of
//!      `repo_b_root`).
//!   5. Reports the wall-time delta between the corpus-assisted build and
//!      the cold build — proof (c): measured time saving.
//!   6. Runs the negative proof in-process: picks one file the corpus did
//!      hit, writes its exact bytes to a *new*, never-before-seen relative
//!      path inside `repo_b_root`, and asserts a merge against just that one
//!      new path misses the corpus — same content, different path, must not
//!      share.
//!
//! # `remote-populate` / `remote-consume`: the cloud-ingestion path
//!
//! `populate`/`consume` above prove the *local* corpus tier (`populate_delta`,
//! a process deriving facts from its own read+hash pass). They do not exercise
//! `FactsCorpus::ingest_remote` at all — the API this change adds for facts that
//! arrived over a network, from a process that never touched `repo_b_root`'s
//! files itself. `remote-populate`/`remote-consume` extend this probe's
//! existing two-machine shape (two independent roots + a shared corpus dir
//! standing in for "two machines") to cover that path instead:
//!
//!   cargo run --release --example facts_corpus_probe -- \
//!       remote-populate <repo_a_root> <wire_file> [label]
//!   cargo run --release --example facts_corpus_probe -- \
//!       remote-consume <repo_b_root> <corpus_dir> <wire_file> [label] [--tamper]
//!
//! `remote-populate` cold-builds `repo_a_root` and writes every file's facts
//! to `<wire_file>` in the exact shape sem-cloud's `/v1/facts/download`
//! response uses (`FACTS-SERVICE.md`'s `FactRecord`: an echoed
//! `(relativePath, contentHash, languageSalt, schemaVersion)` key alongside an
//! opaque CBOR `payload`) — this file stands in for "what machine A uploaded
//! and the cloud served back," so `remote-consume` never touches
//! `repo_a_root` at all, only this one blob.
//!
//! `remote-consume` treats `repo_b_root` as a fresh checkout with a **brand
//! new, never-populated `corpus_dir`** (proving this is genuinely the
//! ingestion path, not `populate_delta` under another name) and:
//!   1. Decodes `<wire_file>` into `RemoteFact`s exactly like `sem-cli`'s
//!      `facts_remote.rs::decode_download_response` does, optionally
//!      tampering one record first (`--tamper`: mutates the claimed
//!      `contentHash` so it disagrees with the payload's own embedded hash —
//! the mismatched-key-vs-content shape this change's tamper proof targets).
//!   2. Calls `FactsCorpus::ingest_remote` and reports accepted/rejected
//!      counts and reasons — proof (c) starts here: a tampered fact must be
//!      rejected with a typed `IngestError`, never silently written.
//!   3. Merges the (now-populated-via-ingestion) corpus against `local = None`
//!      and warm-starts — proof (b): `corpus_hits`/`files_reused_directly`
//!      show every accepted file skipped re-extraction, and (with `--tamper`)
//!      the rejected file's `corpus_hits` count is one less than without it.
//!   4. Cold-builds the same tree and asserts bit-identical — proof (a),
//!      including under `--tamper`: the rejected file simply falls back to
//!      local extraction, so the final graph is unaffected (correct, not
//!      poisoned) even though ingestion refused one of its inputs.

use std::path::{Path, PathBuf};
use std::time::Instant;

use sem_core::model::entity::SemanticEntity;
use sem_core::parser::facts_store::{FactsCorpus, IngestError, RemoteFact, FACTS_SCHEMA_VERSION};
use sem_core::parser::graph::EntityGraph;
use sem_core::parser::incremental::FileFacts;
use sem_core::parser::plugins::code::languages::get_language_config;
use sem_core::parser::plugins::create_default_registry;
use sem_core::parser::registry::ParserRegistry;
use sem_core::parser::session::GraphSession;
use sem_core::utils::scan::{is_default_excluded, is_probably_binary_path};
use serde::{Deserialize, Serialize};

fn make_registry(root: &Path) -> ParserRegistry {
    let mut registry = create_default_registry();
    registry.load_semrc(root);
    registry.load_gitattributes(root);
    registry
}

fn walk_files(root: &Path, registry: &ParserRegistry) -> Vec<String> {
    let mut files = Vec::new();
    let mut builder = ignore::WalkBuilder::new(root);
    builder
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true);
    for entry in builder.build().flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Ok(rel) = path.strip_prefix(root) else {
            continue;
        };
        let rel = rel.to_string_lossy().replace('\\', "/");
        if is_default_excluded(&rel) || is_probably_binary_path(&rel) {
            continue;
        }
        if registry.get_explicit_plugin(&rel).is_none() {
            continue;
        }
        files.push(rel);
    }
    files.sort();
    files
}

struct Fingerprint {
    entities: usize,
    edges: usize,
    edge_hash: u64,
}

fn fingerprint(graph: &EntityGraph, entities: &[SemanticEntity]) -> Fingerprint {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut edges: Vec<String> = graph
        .edges
        .iter()
        .map(|e| {
            let kind = e.ref_type.as_str();
            format!("{}\u{1f}{}\u{1f}{}", e.from_entity, e.to_entity, kind)
        })
        .collect();
    edges.sort();
    let mut h = DefaultHasher::new();
    for edge in &edges {
        edge.hash(&mut h);
    }
    Fingerprint {
        entities: entities.len(),
        edges: graph.edges.len(),
        edge_hash: h.finish(),
    }
}

fn cmd_populate(root: &Path, corpus_dir: &Path, label: &str) {
    let registry = make_registry(root);
    let files = walk_files(root, &registry);

    let build_t0 = Instant::now();
    let session = GraphSession::build(root, &files, &registry);
    let build_ms = build_t0.elapsed().as_secs_f64() * 1000.0;
    let fp = fingerprint(session.graph(), session.entities());

    let exported = session.export_persisted();
    let corpus = FactsCorpus::open(corpus_dir);

    let populate_t0 = Instant::now();
    let stats = corpus
        .populate_delta(None, &exported, &registry)
        .expect("populate_delta");
    let populate_ms = populate_t0.elapsed().as_secs_f64() * 1000.0;

    let corpus_bytes: u64 = std::fs::read_dir(corpus_dir)
        .map(|entries| {
            entries
                .flatten()
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum()
        })
        .unwrap_or(0);

    println!(
        "POPULATE label={label} files={} entities={} edges={} edge_hash={:016x} build_ms={build_ms:.2} populate_ms={populate_ms:.2} files_written={} shards_written={} corpus_bytes={corpus_bytes}",
        files.len(),
        fp.entities,
        fp.edges,
        fp.edge_hash,
        stats.files_written,
        stats.shards_written,
    );
}

fn cmd_consume(root: &Path, corpus_dir: &Path, label: &str) {
    let registry = make_registry(root);
    let files = walk_files(root, &registry);
    let corpus = FactsCorpus::open(corpus_dir);

    // Corpus-assisted build: repo B is treated as a fresh checkout with no
    // local FactsStore snapshot of its own (`local = None`).
    let merge_t0 = Instant::now();
    let (merged, stats) = corpus.merge_with_local(root, &files, &registry, None);
    let merge_ms = merge_t0.elapsed().as_secs_f64() * 1000.0;
    // Captured before `merged` moves into `warm_start` below — the negative
    // proof at the bottom needs one path the corpus actually hit.
    let a_hit_path: Option<String> = files.iter().find(|p| merged.files_contains(p)).cloned();

    let warm_t0 = Instant::now();
    let (session, rebuild_stats) = if merged.file_count() > 0 {
        GraphSession::warm_start(root, &files, &registry, merged)
    } else {
        (
            GraphSession::build(root, &files, &registry),
            Default::default(),
        )
    };
    let warm_ms = warm_t0.elapsed().as_secs_f64() * 1000.0;
    let warm_total_ms = me
```

### Core Architecture Module: `crates/sem-core/examples/facts_probe.rs`
```
//! Cross-process oracle + timing probe for the on-disk facts store.
//!
//! Not part of the public API and not wired into any product code path.
//!
//! Unlike `incr_probe`'s in-process oracle, this probe is meant to be run as
//! **two separate OS processes** so the only channel between them is the disk
//! — the same guarantee `sem-cli` gets from `FactsStore` across two `sem`
//! invocations. `save` does a cold build, exports the facts layer, and writes
//! it to `<store_dir>`. `load` starts a brand-new process, loads that
//! snapshot, warm-starts a session from it, optionally mutates a scenario's
//! files first, and asserts entity/edge counts + a sorted-edge hash against a
//! from-scratch cold build of the same on-disk state.
//!
//! Usage:
//!   cargo run --release --example facts_probe -- save <repo_root> <store_dir> [label]
//!   cargo run --release --example facts_probe -- load <repo_root> <store_dir> <none|leaf|mixed50|hub> [label]
//!
//! Prints tagged, greppable lines:
//!   COLD    — cold build + save wall time, entity/edge counts, edge hash, store size
//!   WARM    — cross-process warm-start wall time (load + rebuild), red-green counters
//!   ORACLE  — `ok` when warm == cold at the (possibly mutated) state, `MISMATCH` otherwise

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Instant;

use sem_core::model::entity::SemanticEntity;
use sem_core::parser::facts_store::FactsStore;
use sem_core::parser::graph::EntityGraph;
use sem_core::parser::plugins::create_default_registry;
use sem_core::parser::registry::ParserRegistry;
use sem_core::parser::session::GraphSession;
use sem_core::utils::scan::{is_default_excluded, is_probably_binary_path};

const PROBE_SUFFIX_JS_TS: &str = "\n// facts probe\nfunction __factsHelper() { return 1; }\nexport function __factsProbe() { return __factsHelper(); }\n";
const PROBE_SUFFIX_PY: &str =
    "\n\ndef __facts_helper():\n    return 1\n\n\ndef __facts_probe():\n    return __facts_helper()\n";
const PROBE_SUFFIX_GO: &str =
    "\n\nfunc factsHelper() int { return 1 }\n\nfunc factsProbe() int { return factsHelper() }\n";
const PROBE_SUFFIX_RUST: &str =
    "\n\nfn facts_helper() -> i32 { 1 }\n\npub fn facts_probe() -> i32 { facts_helper() }\n";

/// A same-file, syntactically-valid append for whichever language `path`
/// detects as (: generalized past the JS/TS-only original so this
/// probe can exercise the newly-attributed languages too). Falls back to the
/// JS/TS snippet for anything else — callers only ever invoke this on a path
/// [`is_reuse_eligible`] already accepted, so the fallback is unreachable in
/// practice, not a silent wrong-language mutation.
fn probe_suffix_for(path: &str) -> &'static str {
    if path.ends_with(".py") {
        PROBE_SUFFIX_PY
    } else if path.ends_with(".go") {
        PROBE_SUFFIX_GO
    } else if path.ends_with(".rs") {
        PROBE_SUFFIX_RUST
    } else {
        PROBE_SUFFIX_JS_TS
    }
}

fn make_registry(root: &Path) -> ParserRegistry {
    let mut registry = create_default_registry();
    registry.load_semrc(root);
    registry.load_gitattributes(root);
    registry
}

fn walk_files(root: &Path, registry: &ParserRegistry) -> Vec<String> {
    let mut files = Vec::new();
    let mut builder = ignore::WalkBuilder::new(root);
    builder
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true);
    for entry in builder.build().flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Ok(rel) = path.strip_prefix(root) else {
            continue;
        };
        let rel = rel.to_string_lossy().replace('\\', "/");
        if is_default_excluded(&rel) || is_probably_binary_path(&rel) {
            continue;
        }
        if registry.get_explicit_plugin(&rel).is_none() {
            continue;
        }
        files.push(rel);
    }
    files.sort();
    files
}

fn is_js_ts(path: &str) -> bool {
    [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]
        .iter()
        .any(|ext| path.ends_with(ext))
}

/// Mirrors `sem_core::parser::import_resolution::is_reuse_eligible_file`
/// Duplicated here because that function is `pub(crate)` and this
/// probe links against the crate as an ordinary dependent, not from inside
/// it. Extensions must be kept in sync by hand; both lists are small and
/// change rarely.
fn is_reuse_eligible(path: &str) -> bool {
    is_js_ts(path) || path.ends_with(".py") || path.ends_with(".go") || path.ends_with(".rs")
}

struct Fingerprint {
    entities: usize,
    edges: usize,
    edge_hash: u64,
}

fn fingerprint(graph: &EntityGraph, entities: &[SemanticEntity]) -> Fingerprint {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut edges: Vec<String> = graph
        .edges
        .iter()
        .map(|e| {
            let kind = e.ref_type.as_str();
            format!("{}\u{1f}{}\u{1f}{}", e.from_entity, e.to_entity, kind)
        })
        .collect();
    edges.sort();
    let mut h = DefaultHasher::new();
    for edge in &edges {
        edge.hash(&mut h);
    }
    Fingerprint {
        entities: entities.len(),
        edges: graph.edges.len(),
        edge_hash: h.finish(),
    }
}

/// Restores every mutated file on drop, including on panic — a probe that
/// leaves a real checkout mutated is worse than no probe.
struct Restore {
    root: PathBuf,
    originals: HashMap<String, String>,
}

impl Restore {
    fn mutate(&mut self, rel: &str) -> bool {
        let full = self.root.join(rel);
        let Ok(original) = std::fs::read_to_string(&full) else {
            return false;
        };
        let mutated = format!("{original}{}", probe_suffix_for(rel));
        if std::fs::write(&full, mutated).is_err() {
            return false;
        }
        self.originals.insert(rel.to_string(), original);
        true
    }
}

impl Drop for Restore {
    fn drop(&mut self) {
        for (rel, original) in &self.originals {
            let _ = std::fs::write(self.root.join(rel), original);
        }
    }
}

fn pick(scenario: &str, graph: &EntityGraph, files: &[String]) -> Vec<String> {
    match scenario {
        "none" => Vec::new(),
        "leaf" => {
            let mut targeted: std::collections::HashSet<&str> = std::collections::HashSet::new();
            for edge in &graph.edges {
                if let Some(to_file) = edge.to_entity.split("::").next() {
                    targeted.insert(to_file);
                }
            }
            files
                .iter()
                .find(|f| !targeted.contains(f.as_str()) && is_reuse_eligible(f))
                .cloned()
                .into_iter()
                .collect()
        }
        "hub" => {
            let mut dependents: HashMap<&str, std::collections::HashSet<&str>> = HashMap::new();
            for edge in &graph.edges {
                let Some(to_file) = edge.to_entity.split("::").next() else {
                    continue;
                };
                let Some(from_file) = edge.from_entity.split("::").next() else {
                    continue;
                };
                if to_file == from_file {
                    continue;
                }
                dependents.entry(to_file).or_default().insert(from_file);
            }
            let known: std::collections::HashSet<&str> = files.iter().map(String::as_str).collect();
            dependents
                .into_iter()
                .filter(|(f, _)| known.contains(f))
                .max_by_key(|(_, deps)| deps.len())
                .map(|(f, _)| f.to_string())
                .into_iter()
                .collect()
        }
        _ => {
            // mixed50: 50 files spread evenly across the corpus.
            let eligible: Vec<&String> = files.iter().filter(|f| is_reuse_eligible(f)).collect();
            if eligible.is_empty() {
                return Vec::new();
            }
            let step = (eligible.len() / 50).max(1);
            eligible
                .iter()
                .step_by(step)
                .take(50)
                .map(|f| (*f).clone())
                .collect()
        }
    }
}

fn cmd_save(root: &Path, store_dir: &Path, label: &str) {
    let registry = make_registry(root);
    let files = walk_files(root, &registry);

    let build_t0 = Instant::now();
    let session = GraphSession::build(root, &files, &registry);
    let build_ms = build_t0.elapsed().as_secs_f64() * 1000.0;
    let fp = fingerprint(session.graph(), session.entities());

    let export_t0 = Instant::now();
    let exported = session.export_persisted();
    let export_ms = export_t0.elapsed().as_secs_f64() * 1000.0;

    let store = FactsStore::open(store_dir);
    let save_t0 = Instant::now();
    store.save(root, &exported).expect("save");
    let save_ms = save_t0.elapsed().as_secs_f64() * 1000.0;

    let store_bytes: u64 = std::fs::read_dir(store_dir)
        .map(|entries| {
            entries
                .flatten()
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum()
        })
        .unwrap_or(0);

    println!(
        "COLD label={label} files={} entities={} edges={} edge_hash={:016x} build_ms={build_ms:.2} export_ms={export_ms:.2} save_ms={save_ms:.2} store_bytes={store_bytes}",
        files.len(),
        fp.entities,
        fp.edges,
        fp.edge_hash,
    );
}

fn cmd_load(root: &Path, store_dir: &Path, scenario: &str, label: &str) {
    let registry = make_registry(root);
    let files = walk_files(root, &registry);

    // Apply the scenario's mutation *before* the warm process ever looks at
    // the tree, exactly like an editor session handing `sem` a dirty
    // checkout — the store's stale entries for touched files must miss.
    //
    // Picking mutation targets needs a graph, so build one cheaply from the
    // pre-mutati
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #508** (2026-10-05): **ci: run Windows tests in release and report every failure**
  *Symptoms*: ## Why Windows CI has failed on the last four pushes to main, each time on a different test: - `arch_diff_budget`: `--budget 10` took 24.1s against a 22.5s limit - `arch_diff_scale`: the 50k-file repo test ran 890s and exhausted its time budget - earlier: `arch_diff_review` (since gated to Linux/macOS) and `accessor_cli` (stack overflow, fixed by the 16 MB stack change)  This workflow is the only CI job that runs the sem-core and sem-cli suites, and it ran them as a debug build. The newer wall-time and scale tests are calibrated for optimized binaries, so debug on the Windows runner overruns them. `cargo test` also stops at the first failing test binary, which is why each run surfaced a different test.  ## Change - Tests run with `--release --target x86_64-pc-windows-msvc`, the build step's target, so its artifacts are reused. - `--no-fail-fast` reports every failing binary at once.  ## Verification This PR's own Windows run is the check. If anything still fails in release it will show up all at once here.

- **Issue #507** (2026-10-05): **fix(pi): locate addImport's imports with the parser instead of a line scan**
  *Symptoms*: ### Follow-up to #506: locate `addImport`'s imports with the parser, not a line scan  This is the separate, larger follow-up you asked for in #506 (https://github.com/Ataraxy-Labs/sem/pull/506#issuecomment-5986296992). It keeps #506's targeted fix intact and goes after the root cause: `addImport` reasoned about imports by scanning trimmed lines, so it couldn't tell a real top-level `import` from import-shaped text, it missed multi-line imports, and it stopped at the first statement.  For TypeScript and JavaScript, `addImport` now gets the file's real top-level import statements from the tree-sitter parser instead. I added a small internal command, `sem imports <file> --json`, backed by `sem_core::parser::plugins::code::top_level_imports`, which walks the direct children of the syntax-tree root and returns each import's kind, line span, byte span and source text. Because it only looks at real top-level import nodes:  - it only ever touches genuine top-level imports; - import-shaped text inside a string or template literal, inside a comment, or nested in a block such as `declare module { ... }` is never returned, so it is never rewritten; - a multi-line import comes back as one node and is handled as one statement; - an import placed after other statements is still found.  `addImport` uses those positions for supersede and placement, and falls back to the previous line scan when the parser is unavailable (older/missing binary) or the file isn't TS/JS, so other languages are unc

- **Issue #506** (2026-10-05): **fix(pi): confine addImport's ES supersede to the leading import block**
  *Symptoms*: ## What I saw  `addImport` ends with a placement scan whose comment says, in its own words, that scanning the whole file is wrong — "an unindented line inside a raw-string test fixture that embeds source code" matches the same trimmed shape as a real declaration. The ES supersede pass sits a few lines above it and still does exactly that whole-file scan, on `lines[i].trim()`. Placement only picks a bad insert point when it guesses wrong; supersede **rewrites or deletes** the line it matches.  Given `a.ts`:  ```ts import { parse } from "./parser.js";  export const FIXTURE = ` import { parse } from "./legacy.js"; export const value = parse(); `; ```  `sem.addImport("a.ts", 'import { parse } from "./parser-v2.js"')` returns  ``` superseded: [ { symbol: "parse", from: "./parser.js" },               { symbol: "parse", from: "./legacy.js" } ] ```  and the file comes back with the line gone from **inside the template literal**. The fixture string is now a different string. Same thing one block over, with an import indented inside an ambient module:  ```ts declare module "legacy" {   import { parse } from "./legacy.js";   // deleted outright   export const value: typeof parse; } ```  The caller asked for one import line to be added; it got an unrelated line removed from a string literal, silently.  ## The change  I moved the supersede pass below the placement scan and bounded it by `lastImportIdx` — the same leading declaration block the insert point is already measured from — decrem
  **Post-Mortem & Fix Analysis**:
  > Thanks for catching this and adding the regression tests. The whole-file supersede scan could silently alter fixture strings and nested imports, so restricting it to the leading import block makes sense as a targeted fix. Longer term, we should use parser-backed import locations rather than line matching. Appreciate the clear reproduction and testing notes!
  > Would you be interested in a follow-up PR that uses parser-backed locations for ES import declarations instead of line matching? The goal would be to update only actual top-level imports, preserve comments and string contents, and handle multiline imports and imports after other statements safely. Happy to keep this targeted fix separate from that broader change.
  > @rs545837 Yeah, I got you! I can definitely take care of that in a follow-up PR.

- **Issue #504** (2026-10-03): **feat(pi): report callers a batch leaves behind after signature changes**
  *Symptoms*: ## Changes - Before `weave_transaction` deletes an entity or applies an edit with `allow_signature_change`, it queries sem's graph for that entity's dependents and returns the ones the batch did not edit as `caller_review.unedited_dependents`. Informational only: a failed graph query never blocks the edit. Targets the missed-caller repair loops seen in the Restic traces. - Integer arguments are clamped instead of rejected, so `max_entities: 0` no longer fails a call and costs a turn. - One policy line tells the agent to update or confirm listed dependents before validating. - `pi/README.md` rewritten: what the package does, when to use each mode, the transaction interface as it runs today (the old section described the removed strict protocol), one environment variable table, and failure modes.  ## Verification - Simple interface suite: 149 passed, 1 skipped, 1 failed. The failure (`address profile performs metadata-first read...`, INLINE_ENTITY_NOT_SUPPORTED) reproduces on unchanged main with the local sem 0.24 binary. - New caller-check unit tests pass; end-to-end, a rename with one updated and one missed caller reported only the missed one. - TypeScript typecheck passed.  Not yet benchmarked on agent sessions.

- **Issue #503** (2026-10-03): **perf(pi): reduce repeated source and validation work**
  *Symptoms*: ## Changes - Explicit source receipts on sem_exact reads; only caller-acknowledged unchanged bodies are omitted. Exact edit IDs and stale-file guards remain intact. - Content-only diff reviews since a prior review ID in the same scope, with explicit expiry and scope errors. - Bounded parallel cold parsing; per-file content caching still reparses only changed files and preserves deterministic IDs. - Indexed edit-ID lookup and one preflight file read per batch target; queued per-edit hash guards remain enabled. - Opt-in validation result reuse through an operator-owned complete-input fingerprint provider. Disabled by default; failures never cached; changed input keys invalidate verdicts. - Keep direct entity reads, batched edits and on-demand relationships; no additional mandatory agent phases.  ## Verification - Simple interface suite: 147 passed, 1 optional recorded-replay test skipped. - Python checker suite: 47 passed. - TypeScript typecheck passed; git diff --check passed. - Broad Pi suite: 728 passed, 15 failed, 11 cancelled, 2 skipped. All failing/cancelled cases reproduced against unchanged main 603cf556 in baseline runs (rename/ambiguity, live coordination protocol, sandbox async limits). No claim that the whole suite is green.  ## Local microbenchmark (not an agent-session claim) 16 Python files, five samples per cold-capture setting: median 80.4ms with one parser versus 36.1ms with four. Changing one file invokes one parser and reuses 15 cached parses. Explicit ackno

- **Issue #502** (2026-10-03): **MCP on AGY CLI: `error: expect initialized request`**
  *Symptoms*: ```text ✗ sem  error: error: expect initialized request, but received: Some(Request(JsonRpcRequest { jsonrpc: JsonRpcVersion2_0, id: Number(1), request: CustomRequest(CustomRequest { method: "server/discover", params: Some(Object {}), extensions: Extensions }) })) : connection closed: calling "initialize": client is closing: EOF ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting\! AGY sends `server/discover` before `initialize`, which caused Sem to close the connection. [[v0.26.0](https://github.com/Ataraxy-Labs/sem/releases/tag/v0.26.0)](<https://github.com/Ataraxy-Labs/sem/releases/tag/v0.26.0>) handles that probe without disconnecting, allowing initialization to continue.  Could you update Sem, restart AGY, and try again

- **Issue #501** (2026-10-01): **feat(pi): publish explicit-read batched transaction interface**
  *Symptoms*: Promote the preserved simple transaction interface: opt-in source reads, batched guarded edits, evidence handling and validation scheduling. Fix per-edit snapshot guards and rollback, and make JeV external ranking explicitly opt-in so the portable server starts without credentials. Preserve tests, benchmark logs and local runner files outside the repository. Validation: simple runtime 135 passed / 1 skipped; Python 47 passed; TypeScript typecheck passed. Broader Pi suite and CI are being checked before merge. This remains experimental; benchmark speed and correctness vary by task.

- **Issue #500** (2026-10-01): **fix: search unparsed text files and expose search coverage**
  *Symptoms*: Fixes text discovery omitting files such as Objective-C++ .mm because grep reused the structural parser file filter. Includes eligible unparsed files in cold searches and supplements warm structural indexes. Preserves ignore/default exclusions, skips NUL-containing binary content and symlinks in text discovery, and distinguishes result pagination from search scope in agent responses. Tests: cold/warm/new-file coverage regression; eight multi-query CLI tests; seventeen focused JS tests; TypeScript typecheck. No benchmark results or experimental branch dump included.

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

### Incident Patch 1: `d5adbe61` (2026-10-05)
**Commit Message**: fix(pi): locate addImport's imports with the parser instead of a line scan (#507)

### Follow-up to #506: locate `addImport`'s imports with the parser, not
a line scan

This is the separate, larger follow-up you asked for in #506
(https://github.com/Ataraxy-Labs/sem/pull/506#issuecomment-5986296992).
It keeps #506's targeted fix intact and goes after the root cause:
`addImport` reasoned about imports by scanning trimmed lines, so it
couldn't tell a real top-level `import` from import-shaped text, it
missed multi-line imports, and it stopped at the first statement.

For TypeScript and JavaScript, `addImport` now gets the file's real
top-level import statements from the tree-sitter parser instead. I added
a small internal command, `sem imports <file> --json`, backed by
`sem_core::parser::plugins::code::top_level_imports`, which walks the
direct children of the syntax-tree root and returns each import's kind,
line span, byte span and source text. Because it only looks at real
top-level import nodes:

- it only ever touches genuine top-level imports;
- import-shaped text inside a string or template literal, inside a
comment, or nested in a block such as `declare module { ... }` is neve

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -4,6 +4,12 @@ All notable changes to sem are documented in this file.
 
 ## [Unreleased]
 
+### Changed
+
+- TS/JS import edits preserve exact UTF-8 byte ranges and surrounding same-line code. Duplicate detection uses parsed declarations, and unavailable/invalid parsing refuses edits without changing the file rather than falling back to text matching.
+
+- **`sem.addImport` now locates imports with the tree-sitter parser instead of scanning lines.** A new internal `sem imports` command returns a file's real top-level import statements by position, and `addImport` uses it for TypeScript/JavaScript files to supersede and place imports. Strings, comments and nested declarations are not import targets. Multi-line and non-leading imports are supported. With no imports, insertion appends a top-level declaration to preserve directive prologues and shebangs. Other languages retain their existing behavior.
+
 ## [0.27.0] - 2026-10-04
 
 ### Changed
```

**File**: `crates/sem-cli/src/commands/imports.rs` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+use std::path::{Path, PathBuf};
+
+use sem_core::parser::plugins::code::top_level_imports;
+
+pub struct ImportsOptions {
+    pub cwd: String,
+    pub path: String,
+    pub json: bool,
+}
+
+/// `sem imports <file> [--json]`: the file's top-level import statements, as
+/// the tree-sitter parser sees them (kind, 1-based line span, byte span, and
+/// the statement's own source text). Internal helper for tooling that needs
+/// import POSITIONS rather than a text scan -- notably `pi`'s `sem.addImport`,
+/// which uses it to supersede/place imports without ever touching
+/// import-shaped text inside a string, a comment, or a nested block. A file
+/// this build cannot parse, or a language with no import kind registered,
+/// exits unsuccessfully rather than masquerading as a valid empty import list.
+pub fn imports_command(opts: ImportsOptions) {
+    let root = Path::new(&opts.cwd);
+    let candidate = Path::new(&opts.path);
+    let full: PathBuf = if candidate.is_absolute() {
+        candidate.to_path_buf()
+    } else {
+        root.join(candidate)
+    };
+
+    let content = match std::fs::read_to_string(&full) {
+        Ok(c) => c,
+        Err(e) => {
+            eprintln!("error: cannot read {}: {e}", full.display());
+            std::process::exit(2);
+        }
+    };
+
+    let Some(imports) = top_level_imports(&full.to_string_lossy(), &content) else {
+        eprintln!("error: imports unavailable: unsupported language or invalid syntax");
+        std::process::exit(2);
+    };
+
+    if opts.json {
+        match serde_json::to_string(&imports) {
+            Ok(s) => println!("{s}"),
+            Err(e) => {
+                eprintln!("error: {e}");
+                std::process::exit(2);
+            }
+        }
+    } else {
+        for imp in &imports {
+            println!(
+                "{}:{} {} {}",
+                imp.start_line,
+                imp.end_line,
+                imp.kind,
+                imp.text.lines().next().unwrap_or("")
+            );
+        }
+    }
+}
```

**File**: `crates/sem-cli/src/commands/mod.rs` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ pub mod graph;
 pub mod grep;
 pub mod hook;
 pub mod impact;
+pub mod imports;
 pub mod impact_diff;
 pub mod log;
 pub mod promises;
```

**File**: `crates/sem-cli/src/main.rs` (modified, +24/-0)
```diff
@@ -22,6 +22,7 @@ use commands::diff::{diff_command, DiffOptions, OutputFormat};
 use commands::entities::{entities_command, EntitiesOptions};
 use commands::graph::{graph_command, GraphOptions};
 use commands::impact::{impact_command, ImpactMode, ImpactOptions};
+use commands::imports::{imports_command, ImportsOptions};
 use commands::log::{history_command, log_command, HistoryOptions, LogOptions};
 
 const ABOUT: &str = "sem: entity-level code intelligence for git repos (functions, classes and the calls between them)";
@@ -823,6 +824,24 @@ enum Commands {
         #[arg(long)]
         signatures: bool,
     },
+    /// List a file's top-level import statements as the parser sees them
+    /// (kind, line span, byte span, source text). Internal: pi's sem.addImport
+    /// uses it to place and supersede imports by parser position rather than
+    /// by a text scan, so import-shaped text in a string, comment, or nested
+    /// block is never mistaken for a real import.
+    #[command(hide = true)]
+    Imports {
+        /// File to list top-level imports for.
+        path: String,
+
+        /// Output format
+        #[arg(long, value_parser = ["terminal", "json"])]
+        format: Option<String>,
+
+        /// Output as JSON (shorthand for --format json)
+        #[arg(long)]
+        json: bool,
+    },
     /// Show token-budgeted context for an entity
     #[command(hide = true)]
     Context {
@@ -1121,6 +1140,7 @@ fn telemetry_command_name(command: &Option<Commands>) -> Option<&'static str> {
         Some(Commands::Hook { .. }) => "hook",
         Some(Commands::Log { .. }) => "log",
         Some(Commands::Entities { .. }) => "entities",
+        Some(Commands::Imports { .. }) => "imports",
         Some(Commands::Find { .. }) => "find",
         Some(Commands::Callers { .. }) => "callers",
         Some(Commands::Refs { .. }) => "refs",
@@ -1836,6 +1856,10 @@ fn sem_main() {
                 signatures,
             });
         }
+        Some(Commands::Imports { path, format, json }) => {
+            let json = resolve_json(format, json);
+            imports_command(ImportsOptions { cwd: cwd_string(), path, json });
+        }
         Some(Commands::Context {
             entity,
             entities,
```

**File**: `crates/sem-core/src/parser/plugins/code/mod.rs` (modified, +110/-0)
```diff
@@ -55,6 +55,81 @@ pub fn parse_tree(
     parse_tree_incremental(config, content, None)
 }
 
+/// One top-level import statement located by the tree-sitter parser: a direct
+/// child of the syntax-tree root whose node kind is an import kind for the
+/// file's language. Line numbers are 1-based; byte offsets are into the file.
+#[derive(Debug, Clone, serde::Serialize)]
+pub struct TopLevelImport {
+    pub kind: String,
+    pub start_line: usize,
+    pub end_line: usize,
+    pub start_byte: usize,
+    pub end_byte: usize,
+    pub text: String,
+}
+
+/// The file's top-level import statements, as the parser sees them.
+///
+/// Only direct children of the tree root are considered, so an import-shaped
+/// run of text inside a string or template literal (not a node at all), inside
+/// a comment, or nested in a block such as `declare module { ... }` (a child of
+/// that block, not of the root) never appears. A multi-line import is one node,
+/// returned with the line span of the whole statement. An import that follows
+/// other statements is still a top-level child, so it is returned too.
+///
+/// Returns None for unsupported languages or invalid syntax. Some(empty)
+/// means a successful parse with no imports; callers must not confuse them.
+pub fn top_level_imports(file_path: &str, content: &str) -> Option<Vec<TopLevelImport>> {
+    let Some(config) = language_config_for_content(content, file_path) else {
+        return None;
+    };
+    let Some(tree) = parse_tree(config, content) else {
+        return None;
+    };
+    let src = content.as_bytes();
+    let root = tree.root_node();
+    if root.has_error() || !matches!(config.id, "typescript" | "tsx" | "javascript" | "python" | "rust" | "go" | "java" | "c" | "cpp") {
+        return None;
+    }
+    let mut cursor = root.walk();
+    let mut out = Vec::new();
+    for child in root.children(&mut cursor) {
+        if !is_import_node_kind(config.id, child.kind()) {
+            continue;
+        }
+        let start = child.start_byte();
+        let end = child.end_byte();
+        out.push(TopLevelImport {
+            kind: child.kind().to_string(),
+            start_line: child.start_position().row + 1,
+            end_line: child.end_position().row + 1,
+            start_byte: start,
+            end_byte: end,
+            text: String::from_utf8_lossy(&src[start..end]).into_owned(),
+        });
+    }
+    Some(out)
+}
+
+/// Whether `kind` is the tree-sitter node kind of an import/use declaration for
+/// the language `lang_id`. Covers the languages `sem.addImport` reasons about;
+/// an unlisted language yields no parser-backed imports and the caller falls
+/// back to its text scan.
+fn is_import_node_kind(lang_id: &str, kind: &str) -> bool {
+    match lang_id {
+        "typescript" | "tsx" | "javascript" => kind == "import_statement",
+        "python" => matches!(
+            kind,
+            "import_statement" | "import_from_statement" | "future_import_statement"
+        ),
+        "rust" => matches!(kind, "use_declaration" | "mod_item"),
+        "go" => kind == "import_declaration",
+        "java" => kind == "import_declaration",
+        "c" | "cpp" => kind == "preproc_include",
+        _ => false,
+    }
+}
+
 /// Hard wall-clock ceiling for a single-file parse. Healthy files parse in
 /// microseconds to low milliseconds, so this budget is far above the normal
 /// case and never fires for healthy input. It exists for the pathological
@@ -4011,4 +4086,39 @@ test "basic addition" {
         assert!(names.contains(&"foo"), "Should find foo, got: {:?}", names);
         assert!(names.contains(&"bar"), "Should find bar, got: {:?}", names);
     }
+
+    #[test]
+    #[cfg(feature = "lang-typescript")]
+    fn test_top_level_imports_excludes_strings_comments_and_nested() {
+        assert!(top_level_imports("a.ts", "const x = 1;").unwrap().is_empty());
+        assert!(top_level_imports("a.ts", "import { broken").is_none());
+        assert!(top_level_imports("a.unknown", "something").is_none());
+        let code = concat!(
+            "import { parse } from \"./parser.js\";\n",
+            "\n",
+            "export const FIXTURE = `\n",
+            "import { parse } from \"./legacy.js\";\n",
+            "`;\n",
+            "\n",
+            "declare module \"m\" {\n",
+            "  import { x } from \"./nested.js\";\n",
+            "}\n",
+            "\n",
+            "const y = 1;\n",
+            "import {\n",
+            "  a,\n",
+            "  b\n",
+            "} from \"./ab.js\";\n",
+        );
+        let imports = top_level_imports("a.ts", code).expect("valid TypeScript");
+        let texts: Vec<&str> = imports.iter().map(|i| i.text.as_str()).collect();
+        // Two real top-level imports: the leading one, and the one after `const y`.
+        assert_eq!(imports.len(), 2, "got: {texts:?}");
+        assert_eq!((imports[0].start_line, imports[0].end_line), (1, 1));
+        // The 
```

**File**: `pi/src/codemode/api.ts` (modified, +84/-20)
```diff
@@ -3083,6 +3083,43 @@ const IMPORT_LIKE_RE = /^(?:import\s|from\s+\S+\s+import\s|(?:pub(?:\(crate\))?\
 
 const normalizeDecl = (line: string): string => line.trim().replace(/;$/, "").replace(/\s+/g, " ");
 
+/** TS/JS file extensions whose imports addImport locates through the parser. */
+const TS_JS_EXT_RE = /\.(?:[mc]?tsx?|[mc]?jsx?)$/i;
+
+interface ParsedImport {
+  startByte: number;
+  endByte: number;
+  /** 1-based line of the import statement's first line. */
+  startLine: number;
+  /** 1-based line of its last line (equal to startLine unless multi-line). */
+  endLine: number;
+  /** The statement's own source text, exactly as written. */
+  text: string;
+}
+
+/**
+ * The file's top-level import statements, located by sem's tree-sitter parser
+ * (`sem imports --json`) rather than by scanning lines. Each entry is a REAL
+ * top-level `import ...` statement: never import-shaped text inside a string
+ * or template literal, inside a comment, or nested in a block such as
+ * `declare module { ... }`, and a multi-line import comes back as ONE entry
+ * spanning its whole line range. Returns null when the parse is unavailable
+ * (older/missing binary, non-zero exit, unparseable output) so the caller can
+ * refuse unsafe mutation; returns [] for a parseable file that genuinely
+ * has no top-level imports.
+ */
+async function topLevelImports(absPath: string, deps: SemApiDeps): Promise<ParsedImport[] | null> {
+  try {
+    const result = await runCommand(deps.semBin ?? "sem", ["imports", "--json", absPath], deps.cwd);
+    if (result.exitCode !== 0) return null;
+    const raw = JSON.parse(result.stdout) as Array<{ start_byte: number; end_byte: number; start_line: number; end_line: number; text: string }>;
+    if (!Array.isArray(raw)) return null;
+    return raw.map((r) => ({ startByte: r.start_byte, endByte: r.end_byte, startLine: r.start_line, endLine: r.end_line, text: r.text }));
+  } catch {
+    return null;
+  }
+}
+
 /**
  * Adds one import statement or module declaration LINE to an EXISTING file --
  * the gap sem.edit() can't fill, since import/mod lines aren't
@@ -3110,6 +3147,53 @@ async function addImport(file: string, spec: string, deps: SemApiDeps, changes:
   const rustMod = RUST_MOD_RE.exec(spec.trim());
   const esImport = ES_IMPORT_RE.exec(spec.trim());
 
+  if (TS_JS_EXT_RE.test(file)) {
+    const nodes = await topLevelImports(absPath, deps);
+    if (nodes === null) throw toCodeModeError("sem.addImport: parser unavailable or invalid syntax; update sem before editing TS/JS imports (file unchanged).");
+    let bytes = Buffer.from(original, "utf8");
+    let previousEnd = 0;
+    for (const n of nodes) {
+      if (!Number.isSafeInteger(n.startByte) || !Number.isSafeInteger(n.endByte) || n.startByte < previousEnd || n.endByte <= n.startByte || n.endByte > bytes.length || bytes.subarray(n.startByte, n.endByte).toString("utf8") !== n.text) {
+        throw toCodeModeError("sem.addImport: stale or invalid parser ranges; file unchanged.");
+      }
+      previousEnd = n.endByte;
+    }
+    const existing = nodes.find(n => normalizeDecl(n.text) === specNorm);
+    if (existing) return { file, line: existing.startLine, added: false, alreadyPresent: true };
+    const superseded: Array<{ symbol: string; from: string }> = [];
+    // After the last complete import; preserve same-line statements and comments.
+    // With no imports, preserve a shebang and JS directive prologue by appending.
+    let offset = nodes.length ? nodes[nodes.length - 1]!.endByte : bytes.length;
+    if (esImport) {
+      const wanted = esImport[2]!.split(",").map(s => s.trim()).filter(Boolean);
+      for (const n of [...nodes].reverse()) {
+        const m = ES_IMPORT_RE.exec(n.text.trim());
+        if (!m || m[3] === esImport[3]) continue;
+        const symbols = m[2]!.split(",").map(s => s.trim()).filter(Boolean);
+        const kept = symbols.filter(s => !wanted.includes(s));
+        if (kept.length === symbols.length) continue;
+        for (const symbol of symbols) if (wanted.includes(symbol)) superseded.unshift({ symbol, from: m[3]! });
+        const replacement = Buffer.from(kept.length ? `import ${m[1] ?? ""}{ ${kept.join(", ")} } from "${m[3]}";` : "", "utf8");
+        bytes = Buffer.concat([bytes.subarray(0, n.startByte), replacement, bytes.subarray(n.endByte)]);
+        offset += replacement.length - (n.endByte - n.startByte);
+      }
+    }
+    const newline = original.includes("\r\n") ? "\r\n" : "\n";
+    const prefix = bytes.subarray(0, offset).toString("utf8");
+    const suffix = bytes.subarray(offset).toString("utf8");
+    const separator = prefix && !prefix.endsWith("\n") ? newline : "";
+    const content = prefix + separator + spec.trim().replace(/;?$/, ";") + newline + suffix;
+    const line = (prefix + separator).split("\n").length;
+    const contentBytes = Buffer.byteLength(content, "utf8");
+    const classification = auditWriteCommand(file, contentBytes, true, proce
```

**File**: `pi/test/codemode/api-add-import.test.ts` (modified, +195/-0)
```diff
@@ -23,6 +23,64 @@ function makeDir(files: Record<string, string>): string {
 
 const api = (dir: string, changes = createChangeLog()) => ({ sem: buildSemApi({ cwd: dir, semBin: "sem", changes }), changes });
 
+test("parser edits preserve same-line code, comments and UTF-8 byte offsets", async () => {
+  const dir = makeDir({ "a.ts": '// café 😀\nimport { parse, keep } from "./old.js"; const important = "é"; // retained\n' });
+  try {
+    const { sem } = api(dir);
+    await sem.addImport("a.ts", 'import { parse } from "./new.js";');
+    const content = readFileSync(join(dir, "a.ts"), "utf8");
+    assert.ok(content.startsWith('// café 😀\n'));
+    assert.ok(content.includes('const important = "é"; // retained'));
+    assert.ok(content.includes('import { keep } from "./old.js";'));
+    await sem.addImport("a.ts", 'import { keep } from "./other.js";');
+    assert.ok(readFileSync(join(dir, "a.ts"), "utf8").includes('const important = "é"; // retained'));
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+});
+
+test("fixture text is not a duplicate when there are no top-level imports", async () => {
+  const original = '"use strict";\nexport const fixture = `\nimport { parse } from "./new.js";\n`;\n';
+  const dir = makeDir({ "a.ts": original });
+  try {
+    const { sem } = api(dir);
+    assert.equal((await sem.addImport("a.ts", 'import { parse } from "./new.js";')).added, true);
+    assert.ok(readFileSync(join(dir, "a.ts"), "utf8").startsWith(original));
+    assert.equal((await sem.addImport("a.ts", 'import { parse } from "./new.js";')).alreadyPresent, true);
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+});
+
+test("missing parser refuses mutation rather than unsafe fallback", async () => {
+  const original = 'import { parse } from "./old.js";\n';
+  const dir = makeDir({ "a.ts": original });
+  try {
+    const sem = buildSemApi({ cwd: dir, semBin: join(dir, "missing-sem"), changes: createChangeLog() });
+    await assert.rejects(() => sem.addImport("a.ts", 'import { parse } from "./new.js";'), /parser unavailable/);
+    assert.equal(readFileSync(join(dir, "a.ts"), "utf8"), original);
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+});
+
+test("invalid syntax refuses mutation", async () => {
+  const original = 'import { broken';
+  const dir = makeDir({ "a.ts": original });
+  try {
+    await assert.rejects(() => api(dir).sem.addImport("a.ts", 'import { x } from "./x.js";'), /parser unavailable/);
+    assert.equal(readFileSync(join(dir, "a.ts"), "utf8"), original);
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+});
+
+test("multiple same-line imports and CRLF preserve all non-import source", async () => {
+  const dir = makeDir({ "a.ts": 'import { x } from "./x.js"; import { y } from "./y.js"; const keep = 1;\r\n' });
+  try {
+    const { sem } = api(dir);
+    await sem.addImport("a.ts", 'import { x, y } from "./new.js";');
+    const content = readFileSync(join(dir, "a.ts"), "utf8");
+    assert.ok(content.includes('const keep = 1;\r\n'));
+    assert.ok(content.includes('import { x, y } from "./new.js";\r\n'));
+    assert.ok(!content.includes('from "./x.js"'));
+    assert.ok(!content.includes('from "./y.js"'));
+    assert.equal((await sem.addImport("a.ts", 'import { x, y } from "./new.js";')).alreadyPresent, true);
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+});
+
 test("Go grouped and standalone imports are idempotent with either spec syntax", async () => {
   for (const declaration of ['import (\n\talias "example.com/lib"\n)', 'import alias "example.com/lib"']) {
     const original = `package shared\n\n${declaration}\n\nfunc f() {}\n`;
@@ -214,6 +272,143 @@ test("an unrelated import from another source is untouched by supersede", async
   }
 });
 
+test("supersede stays inside the leading import block, not in a fixture string", async () => {
+  const original = [
+    'import { parse } from "./parser.js";',
+    "",
+    "export const FIXTURE = `",
+    'import { parse } from "./legacy.js";',
+    "export const value = parse();",
+    "`;",
+    "",
+  ].join("\n");
+  const dir = makeDir({ "a.ts": original });
+  try {
+    const { sem } = api(dir);
+    const r = (await sem.addImport("a.ts", 'import { parse } from "./parser-v2.js";')) as AddImportResult;
+    const content = readFileSync(join(dir, "a.ts"), "utf8");
+    // The real import is superseded...
+    assert.deepEqual(r.superseded, [{ symbol: "parse", from: "./parser.js" }]);
+    assert.doesNotMatch(content, /"\.\/parser\.js"/);
+    // ...and the fixture's own source text is left exactly as it was.
+    assert.match(content, /export const FIXTURE = `\nimport \{ parse \} from "\.\/legacy\.js";\nexport const value = parse\(\);\n`;/);
+  } finally {
+    rmSync(dir, { recursive: true, force: true });
+  }
+});
+
+test("supersede ignores an indented import inside an ambient module block", async () => {
+  const original = [
+    'im
```

---

### Incident Patch 2: `8c2f397b` (2026-10-04)
**Commit Message**: fix(cli): run on a 16 MB stack so Windows debug builds do not overflow

Windows gives the main thread 1 MB; dispatching the command set in a debug
build exceeded it (the accessor CLI test overflowed on windows-latest).

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01C8skMrcgG13b2zWrXXzBFC

**File**: `crates/sem-cli/src/main.rs` (modified, +14/-0)
```diff
@@ -1411,7 +1411,21 @@ fn run_completions(shell: clap_complete_command::Shell) {
     shell.generate(&mut Cli::command(), &mut std::io::stdout());
 }
 
+/// Windows gives the main thread a 1 MB stack, against 8 MB on Linux and macOS.
+/// Parsing and dispatching this many commands in a debug build can exceed it,
+/// so the CLI runs on a thread with the stack it gets everywhere else.
 fn main() {
+    let worker = std::thread::Builder::new()
+        .name("sem".into())
+        .stack_size(16 * 1024 * 1024)
+        .spawn(sem_main)
+        .expect("spawn the sem main thread");
+    if let Err(panic) = worker.join() {
+        std::panic::resume_unwind(panic);
+    }
+}
+
+fn sem_main() {
     let cli = Cli::parse();
 
     if let Some(name) = telemetry_command_name(&cli.command) {
```

---

### Incident Patch 3: `0e6c9032` (2026-10-03)
**Commit Message**: check(lint): fixture: new non-lint files stay incremental under flat config

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01C8skMrcgG13b2zWrXXzBFC
(cherry picked from commit 4f0982e423a37152b43642ebd4a5351d1d1ae54f)

**File**: `crates/sem-cli/tests/check_cli.rs` (modified, +10/-1)
```diff
@@ -522,10 +522,19 @@ fn eslint_verdicts_equal_eslint_in_every_case() {
 
     // a new file is found and linted
     repo.write("src/d.js", "const y = 3;\n");
-    let _c4 = repo.commit("new file");
+    let c4 = repo.commit("new file");
     let c = lint_case(&repo, Some(&c3), "new file");
     assert_eq!(c["mode"], "incremental", "{c:#}");
     assert!(strs(&c["filesRechecked"]).contains(&"src/d.js".to_string()));
+
+    // new files no config matches (docs, data) are neither linted nor a reason
+    // to give up: the flat config decides which files are lint targets
+    repo.write("README.md", "# lint fixture\n");
+    repo.write("src/data.json", "{\"a\": 1}\n");
+    let _c5 = repo.commit("non-js files");
+    let c = lint_case(&repo, Some(&c4), "non-js files");
+    assert_eq!(c["mode"], "incremental", "{c:#}");
+    assert_eq!(c["filesRecheckedCount"], 0, "{c:#}");
 }
 
 #[test]
```

---

### Incident Patch 4: `706a29d1` (2026-10-03)
**Commit Message**: fix(impact): --diff's per-entity runs do not count telemetry or check for updates again

Their order in the test no longer matters either.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01C8skMrcgG13b2zWrXXzBFC

**File**: `crates/sem-cli/src/commands/impact_diff.rs` (modified, +5/-1)
```diff
@@ -90,7 +90,11 @@ pub fn impact_diff_command(opts: ImpactDiffOptions) -> Result<(), Box<dyn std::e
     let mut missing = 0usize;
     for id in ids {
         let mut cmd = std::process::Command::new(&exe);
-        cmd.current_dir(&root).args([
+        // The parent run already counted itself and checked for updates.
+        cmd.current_dir(&root)
+            .env("SEM_NO_TELEMETRY", "1")
+            .env("SEM_NO_UPDATE_CHECK", "1");
+        cmd.args([
             "impact",
             "--entity-id",
             &id,
```

**File**: `crates/sem-cli/tests/cli_simplify.rs` (modified, +20/-5)
```diff
@@ -705,11 +705,12 @@ fn impact_diff_reports_each_changed_entity_in_impact_shape() {
         .lines()
         .map(|l| serde_json::from_str(l).unwrap())
         .collect();
-    let names: Vec<&str> = docs
+    let mut names: Vec<&str> = docs
         .iter()
         .map(|d| d["entity"]["name"].as_str().unwrap())
         .collect();
-    assert_eq!(names, ["parse_config", "main"]);
+    names.sort();
+    assert_eq!(names, ["main", "parse_config"]);
     // each one is exactly `sem impact --entity-id <id> --json`
     let single = sem(
         repo.path(),
@@ -722,7 +723,13 @@ fn impact_diff_reports_each_changed_entity_in_impact_shape() {
         ],
     );
     assert_eq!(
-        normalize(text.lines().next().unwrap().as_bytes(), repo.path()),
+        normalize(
+            text.lines()
+                .find(|l| l.contains("\"name\":\"parse_config\",\"type\""))
+                .unwrap()
+                .as_bytes(),
+            repo.path()
+        ),
         normalize(&single.stdout, repo.path())
     );
 
@@ -744,8 +751,16 @@ fn impact_diff_reports_each_changed_entity_in_impact_shape() {
         .lines()
         .map(|l| serde_json::from_str(l).unwrap())
         .collect();
-    assert_eq!(docs[0]["tests"][0]["name"], "test_parse_config");
-    assert_eq!(docs[1]["noTestReaches"], true);
+    let by_name = |n: &str| {
+        docs.iter()
+            .find(|d| d["entity"]["name"] == n)
+            .unwrap_or_else(|| panic!("no report for {n}"))
+    };
+    assert_eq!(
+        by_name("parse_config")["tests"][0]["name"],
+        "test_parse_config"
+    );
+    assert_eq!(by_name("main")["noTestReaches"], true);
 }
 
 #[test]
```

---

### Incident Patch 5: `28e08dcd` (2026-10-03)
**Commit Message**: check(ts): tsgo lists the files it checked; fixture for the tsgo backend

`--listFiles` gives the program files tsgo checked (repo files reported as
rechecked, node_modules left out). The fixture tools pin
@typescript/native-preview so the integration tests cover auto-selection
(a package.json script runs tsgo) and verdict equality with the tsgo CLI.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01C8skMrcgG13b2zWrXXzBFC
(cherry picked from commit 8d579a568fe1d2cece003abf9f7d6a0e0fbe7c2e)

**File**: `crates/sem-cli/src/commands/check/ts.rs` (modified, +12/-2)
```diff
@@ -201,7 +201,7 @@ fn tsgo(ctx: &Ctx, project: &str) -> Outcome {
     };
     // never write outputs into the tree: emit (if the config emits) goes to scratch
     let mut cmd = std::process::Command::new(&bin);
-    cmd.args(["-p", project, "--pretty", "false", "--outDir"])
+    cmd.args(["-p", project, "--pretty", "false", "--listFiles", "--outDir"])
         .arg(scratch.path("out"))
         .arg("--tsBuildInfoFile")
         .arg(scratch.path("tsbuildinfo"))
@@ -210,7 +210,17 @@ fn tsgo(ctx: &Ctx, project: &str) -> Outcome {
         Ok(r) => r,
         Err(e) => return Outcome::undecided("ts", "tsgo", e),
     };
-    o.diagnostics = parse_tsc_output(&ran.stdout);
+    // --listFiles prints every program file as an absolute path line
+    let (files, rest): (Vec<&str>, Vec<&str>) = ran.stdout.lines().partition(|l| l.starts_with('/') && Path::new(l).is_file());
+    let canon = ctx.root.canonicalize().unwrap_or_else(|_| ctx.root.clone());
+    o.rechecked = files
+        .iter()
+        .filter_map(|f| Path::new(f).strip_prefix(&ctx.root).or_else(|_| Path::new(f).strip_prefix(&canon)).ok())
+        .map(|p| p.to_string_lossy().replace('\\', "/"))
+        .filter(|p| !p.contains("node_modules/"))
+        .collect();
+    o.rechecked.sort();
+    o.diagnostics = parse_tsc_output(&rest.join("\n"));
     o.errors = o.diagnostics.iter().filter(|d| is_error(d)).count();
     o.verdict = if o.errors > 0 {
         Verdict::Fail
```

**File**: `crates/sem-cli/tests/check_cli.rs` (modified, +37/-0)
```diff
@@ -368,6 +368,43 @@ fn typescript_external_declarations_changing_forces_full() {
     assert_eq!(c["verdict"], "fail");
 }
 
+#[test]
+fn tsgo_backend_when_the_project_uses_tsgo() {
+    let Some(t) = tools() else { return };
+    if !t.join(".bin/tsgo").exists() {
+        return;
+    }
+    let repo = Repo::new(
+        &[
+            ("package.json", r#"{"name":"fx","private":true,"scripts":{"typecheck":"tsgo"}}"#),
+            ("tsconfig.json", r#"{"compilerOptions":{"strict":true,"noEmit":true,"module":"ESNext","moduleResolution":"bundler","types":[]},"include":["src"]}"#),
+            ("src/a.ts", "export const x: number = 1;\n"),
+        ],
+        Some(&t),
+    );
+    let tsgo = |r: &Repo| {
+        let o = Command::new(t.join(".bin/tsgo")).current_dir(r.path()).args(["--pretty", "false"]).output().unwrap();
+        let mut d: Vec<String> = String::from_utf8_lossy(&o.stdout).lines().filter(|l| !l.trim().is_empty()).map(String::from).collect();
+        d.sort();
+        d
+    };
+    let (code, v) = repo.sem(&["--checkers", "ts"]);
+    let c = checker(&v, "ts");
+    assert_eq!(c["tool"], "tsgo", "{c:#}");
+    assert_eq!(c["mode"], "full");
+    assert_eq!(code, 0);
+    assert_eq!(strs(&c["filesRechecked"]), vec!["src/a.ts"]);
+    repo.write("src/b.ts", "export const y: string = 1;\n");
+    let (code, v) = repo.sem(&["--checkers", "ts"]);
+    let c = checker(&v, "ts");
+    assert_eq!(code, 1);
+    assert_eq!(strs(&c["diagnostics"]), tsgo(&repo));
+    // the project's tsc instead, on request: same verdict here
+    let (code, v) = repo.sem(&["--checkers", "ts", "--ts-backend", "tsc"]);
+    assert_eq!(code, 1);
+    assert_eq!(checker(&v, "ts")["tool"], "tsc");
+}
+
 // ---- ESLint ------------------------------------------------------------------
 
 /// `eslint .` on the repo, in sem check's message format, sorted; and whether it passed.
```

**File**: `crates/sem-cli/tests/fixtures/check-tools/package.json` (modified, +2/-1)
```diff
@@ -6,6 +6,7 @@
     "typescript": "5.9.3",
     "eslint": "9.36.0",
     "eslint-plugin-import": "2.32.0",
-    "vitest": "3.2.4"
+    "vitest": "3.2.4",
+    "@typescript/native-preview": "7.0.0-dev.20260707.2"
   }
 }
```

---

### Incident Patch 6: `1094341b` (2026-10-03)
**Commit Message**: fix(graph): byte limit for retained parse trees without an always-true comparison

The test build kept a u64::MAX byte limit, which clippy denies as an
absurd comparison. Unit tests now skip the byte check through a cfg(test)
helper instead; release behaviour is unchanged (24 MB of source).

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01C8skMrcgG13b2zWrXXzBFC

**File**: `crates/sem-core/src/parser/graph.rs` (modified, +12/-5)
```diff
@@ -254,8 +254,6 @@ const SCOPE_RESOLVE_BYTE_BUDGET: u64 = 150;
 /// chunked path, whose peak is bounded by `SCOPE_RESOLVE_BYTE_BUDGET`.
 #[cfg(not(test))]
 const PARSED_FILE_REUSE_BYTE_LIMIT: u64 = 24 * 1024 * 1024;
-#[cfg(test)]
-const PARSED_FILE_REUSE_BYTE_LIMIT: u64 = u64::MAX;
 
 /// Total on-disk size of `file_paths` under `root` (`stat` only).
 pub fn source_bytes(root: &Path, file_paths: &[String]) -> u64 {
@@ -268,9 +266,18 @@ pub fn source_bytes(root: &Path, file_paths: &[String]) -> u64 {
 /// Whether a build over `file_paths` keeps all parse trees (see
 /// `PARSED_FILE_REUSE_LIMIT` and `PARSED_FILE_REUSE_BYTE_LIMIT`).
 pub(crate) fn retain_parsed_files(root: &Path, file_paths: &[String]) -> bool {
-    file_paths.len() <= PARSED_FILE_REUSE_LIMIT
-        && (PARSED_FILE_REUSE_BYTE_LIMIT == u64::MAX
-            || source_bytes(root, file_paths) <= PARSED_FILE_REUSE_BYTE_LIMIT)
+    file_paths.len() <= PARSED_FILE_REUSE_LIMIT && within_reuse_byte_limit(root, file_paths)
+}
+
+#[cfg(not(test))]
+fn within_reuse_byte_limit(root: &Path, file_paths: &[String]) -> bool {
+    source_bytes(root, file_paths) <= PARSED_FILE_REUSE_BYTE_LIMIT
+}
+
+/// Unit tests keep every parse tree, whatever the size.
+#[cfg(test)]
+fn within_reuse_byte_limit(_root: &Path, _file_paths: &[String]) -> bool {
+    true
 }
 
 /// Partition `file_paths` (assumed already in a stable, deterministic order —
```

---

### Incident Patch 7: `4ee3a47f` (2026-10-03)
**Commit Message**: feat(dataflow,arch-diff): bounded time and memory, monorepo scope, precision

Bounds:
- dataflow and arch-diff run in bounded time and memory: a bounded call
  memo, minified bundles skipped, escapes resolved once by reachability
  (a deep chain no longer grows memory with the cube of its depth),
  --max-memory honoured while lowering
- above the size whose whole-tree analysis would not fit --max-memory,
  arch-diff analyzes the diff's region (changed files, their callers,
  importers and the definitions they call) and says so; --scope auto
  estimates from code bytes, and the scope note states which diff-scoped
  callers are complete and the name-fallback caveat
- the graph retains parse trees by source bytes, not file count alone (a
  live tree costs 24-40x its source bytes); inherited tsconfig path tables
  are shared

Precision and coverage:
- a call of a base or trait method may run every override
- file-path sink class (path traversal) for all four languages; a model
  beats resolving into the library's own source; sources where agent PRs
  add entry points
- whole-repo topology; Go and JS/TS dependencies from imports only;
  production files for import edges; per-crate cycle

**File**: `crates/sem-cli/src/commands/arch_diff.rs` (modified, +453/-61)
```diff
@@ -42,6 +42,14 @@ pub struct ArchDiffOptions {
     pub models: Vec<PathBuf>,
     pub format: Format,
     pub max_items: usize,
+    /// Time the data-flow analysis of each tree may take.
+    pub budget: Option<std::time::Duration>,
+    /// Resident memory the process may reach during data flow, in bytes.
+    pub max_memory: Option<usize>,
+    /// Keep examples/, benches/ and tests in the dependency graph.
+    pub include_examples: bool,
+    /// Whole trees, or the diff's region (see `region`).
+    pub scope: certify::Scope,
 }
 
 #[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
@@ -71,6 +79,24 @@ struct Finding {
     data: Value,
 }
 
+/// Peak resident bytes a whole-tree arch-diff takes per byte of head code,
+/// both trees and data flow included. Measured: TypeScript 26x (Azure JS
+/// SDK), Go 41x (Azure Go SDK, data flow cut short) to 121x (evergreen),
+/// Rust 64x (risingwave), Python 137x (a generated 50k-file repo).
+const FULL_BYTES_PER_SOURCE_BYTE: u64 = 128;
+
+/// The `--scope` choice. `auto` analyzes whole trees when their estimated
+/// peak fits in `max_memory_mb` (always, when it is 0).
+pub fn scope_of(scope: &str, max_memory_mb: u64, region_mb: u64) -> certify::Scope {
+    let budget = region_mb * 1024 * 1024;
+    match scope {
+        "full" => certify::Scope::Full,
+        "diff" => certify::Scope::Diff { budget },
+        _ if max_memory_mb == 0 => certify::Scope::Full,
+        _ => certify::Scope::Auto { full_max: max_memory_mb * 1024 * 1024 / FULL_BYTES_PER_SOURCE_BYTE, budget },
+    }
+}
+
 /// Models: built-ins, then `.sem/models/*.json` at head, then `--models`.
 pub(crate) fn load_models(extra_dirs: &[&Path], files: &[PathBuf]) -> Result<Models, Box<dyn std::error::Error>> {
     let mut m = Models::builtin();
@@ -96,10 +122,10 @@ pub(crate) fn load_models(extra_dirs: &[&Path], files: &[PathBuf]) -> Result<Mod
 }
 
 /// Data flow over one materialized tree.
-pub(crate) fn analyze_tree(dir: &Path, files: &[String], entities: &[sem_core::model::entity::SemanticEntity], models: &Models) -> Analysis {
-    let specs = super::topology::spec_targets(&dir.to_string_lossy());
+pub(crate) fn analyze_tree(dir: &Path, files: &[String], entities: &[sem_core::model::entity::SemanticEntity], models: &Models, limits: dataflow::Limits, scope: Option<&std::collections::HashSet<String>>) -> Analysis {
+    let specs = super::topology::spec_targets(&dir.to_string_lossy(), scope);
     let resolve = move |from: &str, spec: &str| specs.get(&(from.to_string(), spec.to_string())).cloned();
-    dataflow::analyze(dir, files, entities, &resolve, models)
+    dataflow::analyze_until(dir, files, entities, &resolve, models, limits)
 }
 
 fn is_test_file(p: &str) -> bool {
@@ -110,6 +136,35 @@ fn is_test_file(p: &str) -> bool {
         || leaf.starts_with("test_") || leaf.ends_with("_test.py") || leaf.ends_with("_test.go") || leaf == "conftest.py"
 }
 
+/// Example programs and benchmarks: they depend on the library, not the
+/// other way round, and are not shipped with it.
+fn is_example_or_bench(p: &str) -> bool {
+    let l = p.to_ascii_lowercase();
+    l.split('/').rev().skip(1).any(|d| matches!(d, "examples" | "example" | "benches" | "bench" | "benchmarks"))
+}
+
+/// Code outside the shipped architecture: tests, examples, benchmarks
+/// (all of it counts with `include`).
+fn non_prod(p: &str, include: bool) -> bool {
+    !include && (is_test_file(p) || is_example_or_bench(p))
+}
+
+/// The Cargo crate a Rust file belongs to: the nearest directory above it
+/// holding a `Cargo.toml` (`None` for other files).
+fn crate_of(dir: &Path, file: &str) -> Option<String> {
+    if !file.ends_with(".rs") {
+        return None;
+    }
+    let mut d = Path::new(file).parent();
+    while let Some(x) = d {
+        if dir.join(x).join("Cargo.toml").is_file() {
+            return Some(x.to_string_lossy().to_string());
+        }
+        d = x.parent();
+    }
+    Some(String::new())
+}
+
 fn package_of(file: &str) -> String {
     match file.rsplit_once('/') {
         Some((d, _)) => d.to_string(),
@@ -123,14 +178,29 @@ struct Deps {
     files: Vec<String>,
     edges: BTreeSet<(String, String)>,
     pkg_edges: BTreeMap<(String, String), (String, String)>,
+    /// Rust file -> its crate. Cargo forbids dependency cycles between
+    /// crates, so a cycle crossing crates is an artifact (a dev-dependency,
+    /// a mis-resolved name): cycles are computed within a crate only.
+    krate: HashMap<String, String>,
+}
+
+impl Deps {
+    /// An edge that can take part in a cycle: not between two crates.
+    fn cyclic(&self, a: &str, b: &str) -> bool {
+        match (self.krate.get(a), self.krate.get(b)) {
+            (Some(x), Some(y)) => x == y,
+            _ => true,
+        }
+    }
 }
 
 /// File-level import edges for Python / Go / Rust, from each file's
 /// imports: a Python dotted module, a Go import path under the repo's
 /// module path, a Rust `crate::` path —
```

**File**: `crates/sem-cli/src/commands/certify.rs` (modified, +197/-15)
```diff
@@ -50,7 +50,12 @@ pub(crate) struct Tree {
     pub(crate) dir: tempfile::TempDir,
     pub(crate) graph: EntityGraph,
     pub(crate) entities: Vec<SemanticEntity>,
+    /// The files analyzed: every supported file, or a diff-scoped region's.
     pub(crate) files: Vec<String>,
+    /// Every supported file of the tree.
+    pub(crate) all_files: Vec<String>,
+    /// The region `files` was restricted to (`None`: the whole tree).
+    pub(crate) scope: Option<HashSet<String>>,
 }
 
 pub(crate) fn git(root: &Path, args: &[&str]) -> Result<String, String> {
@@ -84,14 +89,105 @@ fn materialize(root: &Path, sha: &str) -> Result<tempfile::TempDir, String> {
     Ok(dir)
 }
 
-pub(crate) fn build_tree(root: &Path, sha: &str) -> Result<Tree, String> {
+/// A materialized tree and its supported source files.
+fn list_tree(root: &Path, sha: &str) -> Result<(tempfile::TempDir, Vec<String>), String> {
     let dir = materialize(root, sha)?;
     let registry = super::create_registry(&dir.path().to_string_lossy());
     let files = super::graph::find_supported_files_public(dir.path(), &registry, &[]);
+    Ok((dir, files))
+}
+
+fn graph_tree(dir: tempfile::TempDir, all_files: Vec<String>, scope: Option<&HashSet<String>>) -> Tree {
+    let registry = super::create_registry(&dir.path().to_string_lossy());
+    let files: Vec<String> = match scope {
+        Some(r) => all_files.iter().filter(|f| r.contains(f.as_str())).cloned().collect(),
+        None => all_files.clone(),
+    };
     let (graph, entities) = EntityGraph::build(dir.path(), &files, &registry);
-    Ok(Tree { dir, graph, entities, files })
+    Tree { dir, graph, entities, files, all_files, scope: scope.cloned() }
+}
+
+/// How much of the two trees `arch-diff` analyzes.
+#[derive(Clone, Copy, Debug)]
+pub(crate) enum Scope {
+    /// Every file.
+    Full,
+    /// The diff's region (see `region`), within this many source bytes.
+    Diff { budget: u64 },
+    /// Full when the head tree has at most `full_max` bytes of code, else
+    /// diff-scoped.
+    Auto { full_max: u64, budget: u64 },
+}
+
+/// The paths a range touches and its semantic changes.
+pub(crate) fn semantic_changes(root: &Path, base: &str, head: &str) -> Result<(BTreeSet<String>, Vec<SemanticChange>), Box<dyn std::error::Error>> {
+    let bridge = GitBridge::open(root)?;
+    let file_changes = bridge.get_changed_files(&DiffScope::Range { from: base.to_string(), to: head.to_string() }, &[])?;
+    let registry = super::create_registry(&root.to_string_lossy());
+    let diff = compute_semantic_diff(&file_changes, &registry, None, None);
+    let mut paths: BTreeSet<String> = BTreeSet::new();
+    for f in &file_changes {
+        paths.insert(f.file_path.clone());
+        if let Some(o) = &f.old_file_path {
+            paths.insert(o.clone());
+        }
+    }
+    Ok((paths, diff.changes))
+}
+
+/// Both trees of a range under `scope`, and the region when diff-scoped.
+pub(crate) fn build_trees_in(root: &Path, base: &str, head: &str, scope: Scope) -> Result<(Tree, Tree, Option<super::region::Region>), Box<dyn std::error::Error>> {
+    let (bl, hl) = std::thread::scope(|s| {
+        let b = s.spawn(|| list_tree(root, base));
+        let h = s.spawn(|| list_tree(root, head));
+        (b.join().expect("base materialize"), h.join().expect("head materialize"))
+    });
+    let ((bd, bf), (hd, hf)) = (bl?, hl?);
+    let head_bytes = sem_core::parser::graph::source_bytes(hd.path(), &hf);
+    // the whole-tree cost is that of code (data, markup and config files are cheap)
+    let code: Vec<String> = hf.iter().filter(|f| super::region::is_code(f)).cloned().collect();
+    let code_bytes = sem_core::parser::graph::source_bytes(hd.path(), &code);
+    let budget = match scope {
+        Scope::Full => None,
+        Scope::Diff { budget } => Some(budget),
+        Scope::Auto { full_max, budget } => (code_bytes > full_max).then_some(budget),
+    };
+    let region = match budget {
+        Some(budget) => {
+            let (changed, changes) = semantic_changes(root, base, head)?;
+            Some(super::region::select([(bd.path(), &bf), (hd.path(), &hf)], &changed, &changes, budget))
+        }
+        None => None,
+    };
+    if std::env::var_os("SEM_TIMINGS").is_some() {
+        match &region {
+            Some(r) => eprintln!("scope diff: head {head_bytes} source bytes, {code_bytes} code; region {} files, {} bytes of {} files; {} names not followed", r.files.len(), r.bytes, r.repo_files, r.unexplored.len()),
+            None => eprintln!("scope full: head {head_bytes} source bytes, {code_bytes} code"),
+        }
+    }
+    let r = region.as_ref().map(|r| &r.files);
+    let analyzed = match r {
+        Some(_) => region.as_ref().map_or(0, |r| r.bytes),
+        None => head_bytes,
+    };
+    if analyzed > PARALLEL_BUILD_MAX_BYTES {
+        let bt = graph_tree(bd, bf, r);
+        let ht = graph_tree(hd, hf, r);
+        return Ok((bt, ht, region));
+    }
+    l
```

**File**: `crates/sem-cli/src/commands/mod.rs` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ pub mod impact;
 pub mod log;
 pub mod promises;
 pub mod query;
+pub(crate) mod region;
 pub mod repos;
 pub(crate) mod review;
 pub mod setup;
```

**File**: `crates/sem-cli/src/commands/region.rs` (added, +260/-0)
```diff
@@ -0,0 +1,260 @@
+//! The analysis region of a diff-scoped `arch-diff`: which files of a huge
+//! repository are analyzed, so that memory follows the size of the change
+//! rather than the size of the repository.
+//!
+//! The region is the changed files plus every file that mentions, as an
+//! identifier token:
+//!
+//! - **caller** names: a modified, deleted, renamed or moved entity's name.
+//!   Every reference the resolver can make to such an entity is by name, so
+//!   every static caller, and every competing definition the resolver
+//!   weighs, mentions it. Callers resolved through scope and imports are
+//!   therefore found as in a whole-tree run when the name is in the region.
+//!   A caller attributed by the name-only fallback (receiver type unknown)
+//!   can differ, since that fallback weighs the files it was given.
+//! - **importer** stems: a changed file's stem (its directory for `index`,
+//!   `mod`, `__init__`), for imports that bind a local name of their own
+//!   (`import X from './file'`).
+//! - **added** names: a new definition can capture references elsewhere.
+//! - **callee** names: identifiers used by changed entities that at most
+//!   [`CALLEE_MAX_FILES`] files mention (definitions of what the change calls;
+//!   keywords and ubiquitous names drop out by count).
+//!
+//! Groups are admitted smallest first, callers before importers before added
+//! names before callees, while the region stays within its byte budget. A
+//! name whose files do not fit is recorded in [`Region::unexplored`] with the
+//! number of files that mention it: what lies there is reported as unknown,
+//! never as absent.
+//!
+//! The scan reads each file once and keeps, per file, only the seed names it
+//! mentions: memory is the region plus that index.
+
+use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
+use std::path::Path;
+
+use rayon::prelude::*;
+
+use sem_core::model::change::{ChangeType, SemanticChange};
+
+/// A callee name mentioned in more files than this is not followed: it is a
+/// keyword, a builtin or a ubiquitous helper, and its definition is not what
+/// makes the change's behavior.
+pub(crate) const CALLEE_MAX_FILES: usize = 32;
+
+#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
+pub(crate) enum Role {
+    Caller,
+    /// The other files of a changed code file's directory (its package):
+    /// a package's dependencies are those of all its files.
+    Sibling,
+    Importer,
+    Added,
+    Callee,
+}
+
+impl Role {
+    pub(crate) fn as_str(self) -> &'static str {
+        match self {
+            Role::Caller => "callers",
+            Role::Sibling => "files of a changed package",
+            Role::Importer => "importers",
+            Role::Added => "references to an added name",
+            Role::Callee => "definitions of a called name",
+        }
+    }
+}
+
+pub(crate) struct Region {
+    /// Repo-relative paths analyzed (in either tree).
+    pub files: HashSet<String>,
+    pub bytes: u64,
+    pub repo_files: usize,
+    pub repo_bytes: u64,
+    /// Names whose mentioning files were not analyzed: (name, role, files
+    /// mentioning it outside the region).
+    pub unexplored: Vec<(String, Role, usize)>,
+    pub budget: u64,
+}
+
+impl Region {
+    /// Files outside the region that mention `name` (as a caller name),
+    /// when its callers were not analyzed.
+    pub(crate) fn unexplored_callers(&self, name: &str) -> Option<usize> {
+        self.unexplored.iter().find(|(n, r, _)| n == name && *r == Role::Caller).map(|x| x.2)
+    }
+}
+
+/// Identifier tokens (`[A-Za-z_$][A-Za-z0-9_$]*`) of `src`.
+pub(crate) fn idents(src: &[u8], mut f: impl FnMut(&str)) {
+    let word = |c: u8| c.is_ascii_alphanumeric() || c == b'_' || c == b'$';
+    let mut i = 0;
+    while i < src.len() {
+        let c = src[i];
+        if c.is_ascii_alphabetic() || c == b'_' || c == b'$' {
+            let s = i;
+            while i < src.len() && word(src[i]) {
+                i += 1;
+            }
+            // ASCII only, so valid UTF-8
+            f(std::str::from_utf8(&src[s..i]).unwrap_or(""));
+        } else if c.is_ascii_digit() {
+            while i < src.len() && word(src[i]) {
+                i += 1;
+            }
+        } else {
+            i += 1;
+        }
+    }
+}
+
+fn stem(path: &str) -> Option<String> {
+    let p = Path::new(path);
+    let s = p.file_stem()?.to_string_lossy().to_string();
+    let s = s.split('.').next().unwrap_or(&s).to_string();
+    if matches!(s.as_str(), "index" | "mod" | "__init__" | "lib" | "main") {
+        return p.parent()?.file_name().map(|d| d.to_string_lossy().to_string());
+    }
+    Some(s)
+}
+
+/// Source code (not data, markup or config): its names are code names.
+pub(crate) fn is_code(path: &str) -> bool {
+    sem_core::dataflow::ir::Lang::for_path(path).is_some()
+        || [".java", ".kt", ".cs", ".rb", ".php", ".swift", ".c", ".cc", ".cpp", ".h", ".hpp", ".scala
```

**File**: `crates/sem-cli/src/commands/topology.rs` (modified, +22/-7)
```diff
@@ -131,6 +131,14 @@ impl Common {
         let cmd = Common::augment_args(clap::Command::new("sem"));
         Common::from_arg_matches(&cmd.get_matches_from(["sem", "--repo-root", repo_root])).expect("defaults parse")
     }
+
+    /// Defaults, with the repository root as a package too: single-package
+    /// repos and apps nested without a workspaces entry get nodes.
+    pub fn whole_repo(repo_root: &str) -> Common {
+        use clap::FromArgMatches;
+        let cmd = Common::augment_args(clap::Command::new("sem"));
+        Common::from_arg_matches(&cmd.get_matches_from(["sem", "--repo-root", repo_root, "--root-package"])).expect("defaults parse")
+    }
 }
 
 /// What laws are checked against: the workspace extraction is loaded only
@@ -159,6 +167,11 @@ struct Loaded {
 
 impl Loaded {
     fn load(common: Common) -> Loaded {
+        Self::load_in(common, None)
+    }
+
+    /// Reads only the files in `scope` (see `Extraction::run_in`).
+    fn load_in(common: Common, scope: Option<&std::collections::HashSet<String>>) -> Loaded {
         let t0 = Instant::now();
         let root = PathBuf::from(&common.repo_root);
         let disc = Discovery {
@@ -169,7 +182,7 @@ impl Loaded {
         };
         let ws = Workspace::discover(&root, &disc);
         let paths = ws.source_files(&disc);
-        let ex = Extraction::run(&root, ws, &paths);
+        let ex = Extraction::run_in(&root, ws, &paths, scope);
         Loaded { ex, common, t_extract: t0.elapsed() }
     }
 
@@ -231,8 +244,9 @@ impl Loaded {
 /// Empty when the root holds no JS/TS workspace.
 /// JS/TS import resolution of the tree at `repo_root`: `(importing file,
 /// specifier) -> repo file`, for every specifier that lands on a source file.
-pub(crate) fn spec_targets(repo_root: &str) -> std::collections::HashMap<(String, String), String> {
-    let l = Loaded::load(Common::at(repo_root));
+/// `scope`: only those importing files (all when `None`).
+pub(crate) fn spec_targets(repo_root: &str, scope: Option<&std::collections::HashSet<String>>) -> std::collections::HashMap<(String, String), String> {
+    let l = Loaded::load_in(Common::whole_repo(repo_root), scope);
     let mut out = std::collections::HashMap::new();
     for f in &l.ex.files {
         for r in &f.refs {
@@ -246,9 +260,9 @@ pub(crate) fn spec_targets(repo_root: &str) -> std::collections::HashMap<(String
 
 /// Relative JS/TS imports that land on no file at all: `(importing file,
 /// specifier)`.
-pub(crate) fn broken_relative_imports(repo_root: &str) -> BTreeSet<(String, String)> {
+pub(crate) fn broken_relative_imports(repo_root: &str, scope: Option<&std::collections::HashSet<String>>) -> BTreeSet<(String, String)> {
     use sem_core::topology::resolve::Target;
-    let l = Loaded::load(Common::at(repo_root));
+    let l = Loaded::load_in(Common::whole_repo(repo_root), scope);
     let root = std::path::Path::new(repo_root);
     let mut out = BTreeSet::new();
     for f in &l.ex.files {
@@ -268,8 +282,9 @@ pub(crate) fn broken_relative_imports(repo_root: &str) -> BTreeSet<(String, Stri
     out
 }
 
-pub(crate) fn module_value_graph(repo_root: &str) -> (Vec<String>, algo::Adj) {
-    let l = Loaded::load(Common::at(repo_root));
+/// With `scope`, the edges out of those files only.
+pub(crate) fn module_value_graph(repo_root: &str, scope: Option<&std::collections::HashSet<String>>) -> (Vec<String>, algo::Adj) {
+    let l = Loaded::load_in(Common::whole_repo(repo_root), scope);
     let g = l.graph(Some(Granularity::Module), Some(Selector::Value), &[FileKind::Prod], false);
     let adj = g.adjacency();
     (g.nodes.iter().map(|n| n.id.clone()).collect(), adj)
```

**File**: `crates/sem-cli/src/main.rs` (modified, +33/-2)
```diff
@@ -339,6 +339,26 @@ enum Commands {
         /// Items listed per section
         #[arg(long, default_value_t = 8)]
         max_items: usize,
+        /// Seconds the data-flow analysis of each tree may take; past it the
+        /// data-path results are partial and the report says so (0 = no limit)
+        #[arg(long, default_value_t = 45)]
+        budget: u64,
+        /// Resident memory (MB) the process may reach during data flow; past it the
+        /// data-path results are partial and the report says so (0 = no limit)
+        #[arg(long, default_value_t = 4096)]
+        max_memory: u64,
+        /// Count examples/, benches/ and test code in the dependency graph and cycles
+        #[arg(long)]
+        include_examples: bool,
+        /// What is analyzed: `full` (both whole trees), `diff` (the changed
+        /// files, their callers, importers and the definitions they call), or
+        /// `auto` (diff when the whole trees would not fit in --max-memory)
+        #[arg(long, default_value = "auto", value_parser = ["auto", "full", "diff"])]
+        scope: String,
+        /// Source MB a diff-scoped region may hold; names mentioned in more
+        /// files than fit are reported as not analyzed
+        #[arg(long, default_value_t = 16)]
+        region_mb: u64,
     },
     /// Data flow of the working tree: per-function reads/writes (env, files, DB,
     /// network, subprocess, logs, module state, fields) and source -> sink paths
@@ -797,7 +817,7 @@ fn main() {
                 std::process::exit(2);
             }
         }
-        Some(Commands::ArchDiff { range, json, md, laws, models, max_items }) => {
+        Some(Commands::ArchDiff { range, json, md, laws, models, max_items, budget, max_memory, include_examples, scope, region_mb }) => {
             let cwd = std::env::current_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|_| ".".into());
             let format = if json {
                 commands::arch_diff::Format::Json
@@ -806,7 +826,18 @@ fn main() {
             } else {
                 commands::arch_diff::Format::Text
             };
-            if let Err(e) = commands::arch_diff::arch_diff_command(commands::arch_diff::ArchDiffOptions { cwd, range, laws, models, format, max_items }) {
+            if let Err(e) = commands::arch_diff::arch_diff_command(commands::arch_diff::ArchDiffOptions {
+                cwd,
+                range,
+                laws,
+                models,
+                format,
+                max_items,
+                budget: (budget > 0).then(|| std::time::Duration::from_secs(budget)),
+                max_memory: (max_memory > 0).then(|| max_memory as usize * 1024 * 1024),
+                include_examples,
+                scope: commands::arch_diff::scope_of(&scope, max_memory, region_mb),
+            }) {
                 eprintln!("error: {e}");
                 std::process::exit(2);
             }
```

**File**: `crates/sem-cli/tests/arch_diff_review.rs` (added, +287/-0)
```diff
@@ -0,0 +1,287 @@
+//! `sem arch-diff` on synthetic two-commit repos, one per gap a reviewer
+//! study on large agent PRs found: what the report must say, and what it
+//! must not claim.
+
+use std::fs;
+use std::path::Path;
+use std::process::{Command, Output};
+
+use serde_json::Value;
+
+fn sem(repo: &Path, args: &[&str]) -> Output {
+    Command::new(env!("CARGO_BIN_EXE_sem")).current_dir(repo).args(args).output().expect("run sem")
+}
+
+fn git(repo: &Path, args: &[&str]) {
+    let o = Command::new("git").current_dir(repo).args(args).output().expect("run git");
+    assert!(o.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&o.stderr));
+}
+
+fn write(r: &Path, files: &[(&str, &str)]) {
+    for (p, src) in files {
+        let path = r.join(p);
+        fs::create_dir_all(path.parent().unwrap()).unwrap();
+        fs::write(path, src).unwrap();
+    }
+}
+
+fn remove(r: &Path, files: &[&str]) {
+    for p in files {
+        fs::remove_file(r.join(p)).unwrap();
+    }
+}
+
+fn commit(r: &Path, msg: &str) {
+    git(r, &["add", "-A"]);
+    git(r, &["-c", "commit.gpgsign=false", "commit", "-qm", msg]);
+}
+
+/// A repo with `base` committed, then `head` applied (files written,
+/// `gone` removed) and committed.
+fn two_commits(base: &[(&str, &str)], head: &[(&str, &str)], gone: &[&str]) -> tempfile::TempDir {
+    let dir = tempfile::tempdir().unwrap();
+    let r = dir.path();
+    for args in [&["init", "-q"][..], &["config", "user.email", "t@example.com"], &["config", "user.name", "T"]] {
+        git(r, args);
+    }
+    write(r, base);
+    commit(r, "base");
+    write(r, head);
+    remove(r, gone);
+    commit(r, "head");
+    dir
+}
+
+fn report(dir: &Path, extra: &[&str]) -> Value {
+    let mut args = vec!["arch-diff", "HEAD~1..HEAD", "--json"];
+    args.extend_from_slice(extra);
+    let o = sem(dir, &args);
+    assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr));
+    serde_json::from_slice(&o.stdout).unwrap()
+}
+
+fn md(dir: &Path, extra: &[&str]) -> String {
+    let mut args = vec!["arch-diff", "HEAD~1..HEAD", "--md"];
+    args.extend_from_slice(extra);
+    let o = sem(dir, &args);
+    assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr));
+    String::from_utf8_lossy(&o.stdout).into_owned()
+}
+
+fn findings(v: &Value) -> Vec<(String, String, String)> {
+    v["findings"]
+        .as_array()
+        .unwrap()
+        .iter()
+        .map(|f| (f["severity"].as_str().unwrap().to_string(), f["kind"].as_str().unwrap().to_string(), f["title"].as_str().unwrap().to_string()))
+        .collect()
+}
+
+const WEB_BASE: &str = "import subprocess\nfrom flask import request\n\ndef run():\n    return 'ok'\n";
+const WEB_HEAD: &str = "import subprocess\nfrom flask import request\n\ndef run():\n    subprocess.run(request.args['cmd'], shell=True)\n    return 'ok'\n";
+
+#[test]
+fn a_memory_budget_degrades_to_a_partial_report() {
+    let dir = two_commits(&[("app/web.py", WEB_BASE)], &[("app/web.py", WEB_HEAD)], &[]);
+    // 1 MB: the limit trips at once; the report is partial and says so
+    let v = report(dir.path(), &["--max-memory", "1", "--scope", "full"]);
+    assert_eq!(v["incomplete"], true, "{v:#}");
+    assert_eq!(v["budgetExhausted"]["why"], "memory budget", "{v:#}");
+    let u: Vec<&str> = v["unchanged"].as_array().unwrap().iter().map(|x| x.as_str().unwrap()).collect();
+    assert!(!u.iter().any(|x| x.contains("No source->sink data path")), "a partial analysis proves no absence: {u:#?}");
+    let m = md(dir.path(), &["--max-memory", "1", "--scope", "full"]);
+    assert!(m.contains("Budget exhausted (memory budget"), "{m}");
+    // without the limit the same change is complete, with its data path
+    let v = report(dir.path(), &[]);
+    assert_eq!(v["incomplete"], false);
+    assert!(findings(&v).iter().any(|(s, k, _)| s == "high" && k == "new-data-path"), "{v:#}");
+}
+
+#[test]
+fn a_calls_own_result_reaching_its_argument_is_not_a_data_path() {
+    let base = "package main\n\nfunc handle(q string) string {\n\treturn q\n}\n";
+    let head = "package main\n\nimport (\n\t\"os\"\n\t\"strings\"\n)\n\nfunc resolve(q string) (string, error) {\n\tq = strings.TrimSpace(q)\n\tc, err := os.ReadFile(q)\n\tif err != nil {\n\t\treturn \"\", err\n\t}\n\treturn string(c), nil\n}\n\nfunc handle(q string) string {\n\tq, _ = resolve(q)\n\treturn q\n}\n";
+    let dir = two_commits(&[("go.mod", "module example.com/app\n\ngo 1.22\n"), ("main.go", base)], &[("main.go", head)], &[]);
+    let v = report(dir.path(), &[]);
+    let f = findings(&v);
+    // flow-insensitively the read's result comes back through `handle` into
+    // its own path argument: labeled, not ranked as a new data path
+    assert!(!f.iter().any(|(_, k, t)| k == "new-data-path" && t.contains("file-read")), "{f:#?}");
+    assert!(f.iter().any(|(s, k, t)| s == "info" && k == "self-data-path" && t.contains("resolve")), "{f:#?}");
+}
+
+const WS: &str = "[workspace]
```

**File**: `crates/sem-cli/tests/arch_diff_scale.rs` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+//! `sem arch-diff` memory on a huge repository with a tiny change.
+//!
+//! Every agent edit goes through `arch-diff`, so its memory must follow the
+//! change, not the repository. Whole-tree analysis held both trees' entity
+//! graphs, parse trees and data flow at once: on 230-270 MB monorepos it
+//! went past 6 GB before reporting anything. Above the size whose whole-tree
+//! analysis would not fit `--max-memory`, arch-diff now analyzes the diff's
+//! region (the changed files, their callers, importers and the definitions
+//! they call) and says so.
+//!
+//! `SEM_BIN=<path>` runs another binary on the same repo (to show the old
+//! one exceeds the bound); `SEM_SCALE_DIR=<dir>` generates the repo there and
+//! keeps it.
+
+use std::fmt::Write as _;
+use std::fs;
+use std::path::Path;
+use std::process::{Command, Stdio};
+use std::time::{Duration, Instant};
+
+use serde_json::Value;
+
+const PACKAGES: usize = 500;
+const MODULES: usize = 100;
+/// The bound the test holds arch-diff to.
+const MAX_MB: u64 = 1024;
+
+fn git(repo: &Path, args: &[&str]) {
+    let o = Command::new("git").current_dir(repo).args(args).output().expect("run git");
+    assert!(o.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&o.stderr));
+}
+
+/// One module: four functions; `f0` calls the next module's `f0`, `f3` calls
+/// the next package's `f1` (so every `f1` has a caller in another package).
+fn module(p: usize, m: usize, changed: bool) -> String {
+    let mut s = String::new();
+    let (np, nm) = ((p + 1) % PACKAGES, m + 1);
+    writeln!(s, "\"\"\"Module {m} of package {p}.\n\nA store and four steps of a pipeline: each step loads its input from the service,\nhands it to the next module's step, and records what it did. The service is\ninjected so that tests can replace it; nothing here touches the network or the\nfile system directly, and every external effect goes through `svc`.\n\"\"\"\n").unwrap();
+    s += "import os\nimport subprocess\n";
+    if nm < MODULES {
+        writeln!(s, "from pkg_{p}.mod_{nm} import p{p}_m{nm}_f0").unwrap();
+    }
+    writeln!(s, "from pkg_{np}.mod_{m} import p{np}_m{m}_f1\n").unwrap();
+    writeln!(s, "\nclass Store{p}x{m}:\n    def __init__(self, svc):\n        self.svc = svc\n        self.items = []\n").unwrap();
+    writeln!(s, "    def put(self, key, value):\n        self.items.append((key, value))\n        return self.svc.save(key, value)\n").unwrap();
+    writeln!(s, "\ndef p{p}_m{m}_f0(x, svc):\n    y = svc.load(x)\n    z = [i for i in range(10) if i % 2]").unwrap();
+    if nm < MODULES {
+        writeln!(s, "    return p{p}_m{nm}_f0(y, svc)\n").unwrap();
+    } else {
+        s += "    return z\n\n";
+    }
+    if changed {
+        // a required parameter added: the caller in the previous package breaks
+        writeln!(s, "\ndef p{p}_m{m}_f1(x, svc, mode):\n    total = 0\n    for i in range(x):\n        total += svc.weight(i, mode)\n    return total\n").unwrap();
+        // and a new path from the environment into a command
+        writeln!(s, "\ndef p{p}_m{m}_f2(svc):\n    cmd = os.environ['CMD']\n    subprocess.run(cmd, shell=True)\n    return svc.done()\n").unwrap();
+    } else {
+        writeln!(s, "\ndef p{p}_m{m}_f1(x, svc):\n    total = 0\n    for i in range(x):\n        total += svc.weight(i)\n    return total\n").unwrap();
+        writeln!(s, "\ndef p{p}_m{m}_f2(svc):\n    cmd = 'true'\n    subprocess.run(cmd, shell=True)\n    return svc.done()\n").unwrap();
+    }
+    writeln!(s, "\ndef p{p}_m{m}_f3(x, svc):\n    store = Store{p}x{m}(svc)\n    store.put('k', x)\n    return p{np}_m{m}_f1(x, svc)\n").unwrap();
+    s
+}
+
+fn huge_repo(r: &Path) {
+    for p in 0..PACKAGES {
+        let d = r.join(format!("pkg_{p}"));
+        fs::create_dir_all(&d).unwrap();
+        fs::write(d.join("__init__.py"), "").unwrap();
+        for m in 0..MODULES {
+            fs::write(d.join(format!("mod_{m}.py")), module(p, m, false)).unwrap();
+        }
+    }
+    for args in [&["init", "-q"][..], &["config", "user.email", "t@example.com"], &["config", "user.name", "T"]] {
+        git(r, args);
+    }
+    git(r, &["add", "."]);
+    git(r, &["-c", "commit.gpgsign=false", "commit", "-qm", "base"]);
+    fs::write(r.join("pkg_250/mod_50.py"), module(250, 50, true)).unwrap();
+    git(r, &["-c", "commit.gpgsign=false", "commit", "-qam", "head"]);
+}
+
+fn rss_mb(pid: u32) -> Option<u64> {
+    let o = Command::new("ps").args(["-o", "rss=", "-p", &pid.to_string()]).output().ok()?;
+    String::from_utf8_lossy(&o.stdout).trim().parse::<u64>().ok().map(|kb| kb / 1024)
+}
+
+/// `sem arch-diff HEAD~1..HEAD --json`, killed past `max_mb` or `max_secs`.
+fn run_bounded(dir: &Path, max_mb: u64, max_secs: u64) -> Result<(u64, f64, String), String> {
+    let out = dir.join("..").join(format!("{}.json", dir.file_name().unwrap().to_string_lossy()));
+    let bin = std::env::var("SEM_BIN").unwrap_or_else(|_| env!("CARGO_BIN_EXE_sem").to
```

---

### Incident Patch 8: `102f8e80` (2026-10-03)
**Commit Message**: fix(query): agent-facing fixes for find, callers, context, grep and Python

- find/callers/refs: a cold query builds through the shared graph cache, so
  the full cache and a complete index are saved once and every later verb
  is answered from it
- callers: after the resolved callers, list name-matched call sites for
  members with untyped receivers (labelled as a by-name match, capped by
  --limit) instead of a misleading "callers: none"
- context/impact: when a name is not found, suggest the entities carrying
  the bare member name with their owner and location; the context map
  labels every packed entity with file:start-end
- grep: rg-style trailing paths, -l/--files-with-matches, -n accepted
- python: extract members of decorated classes (facts and disk-cache schema
  versions bumped so unchanged files re-extract)
- topology check: forbidImport/allowImports accept kind (value|type|both);
  noCrossPackageRelative accepts except globs

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01C8skMrcgG13b2zWrXXzBFC

**File**: `crates/sem-cli/src/commands/context.rs` (modified, +5/-1)
```diff
@@ -224,11 +224,13 @@ fn render_context(
                 println!("  {}:", role_label);
             }
 
+            // `file:start-end` so a follow-up read or edit can go straight to
+            // the lines instead of re-searching the file.
             println!(
                 "    {} {} ({}, ~{} tokens)",
                 entry.entity_type.dimmed(),
                 entry.entity_name.bold(),
-                entry.file_path.dimmed(),
+                format!("{}:{}-{}", entry.file_path, entry.start_line, entry.end_line).dimmed(),
                 entry.estimated_tokens,
             );
             // The target is what you asked to read: print its full body. Related
@@ -571,6 +573,7 @@ fn find_entity<'a>(
 
     if matching.is_empty() {
         eprintln!("{} Entity '{}' not found", "error:".red().bold(), name);
+        super::print_name_suggestions(graph, name, "context");
         std::process::exit(1);
     }
 
@@ -590,6 +593,7 @@ fn find_entity<'a>(
                 name,
                 file
             );
+            super::print_name_suggestions(graph, name, "context");
             std::process::exit(1);
         }
         matching = filtered;
```

**File**: `crates/sem-cli/src/commands/grep.rs` (modified, +69/-19)
```diff
@@ -13,6 +13,45 @@ pub struct GrepOptions {
     pub pattern: String,
     pub case_insensitive: bool,
     pub json: bool,
+    pub scope: Scope,
+}
+
+/// Output scoping shared by the single and multi-pattern forms: rg-style
+/// trailing paths (hits outside them are dropped) and `-l`.
+#[derive(Default)]
+pub struct Scope {
+    pub paths: Vec<String>,
+    pub files_with_matches: bool,
+}
+
+impl Scope {
+    /// Keep hits under one of the requested paths (repo-relative prefixes),
+    /// then collapse to one row per file under `-l`.
+    fn apply(&self, cwd: &str, hits: Vec<GrepHit>) -> Vec<GrepHit> {
+        let hits = if self.paths.is_empty() {
+            hits
+        } else {
+            let root = super::repo_root_or_cwd(cwd);
+            let prefixes: Vec<String> = self
+                .paths
+                .iter()
+                .map(|p| super::normalize_repo_relative_path(std::path::Path::new(cwd), &root, p))
+                .map(|p| p.trim_end_matches('/').to_string())
+                .collect();
+            hits.into_iter()
+                .filter(|h| {
+                    prefixes.iter().any(|p| {
+                        p == "." || p.is_empty() || h.file == *p || h.file.starts_with(&format!("{p}/"))
+                    })
+                })
+                .collect()
+        };
+        if !self.files_with_matches {
+            return hits;
+        }
+        let mut seen = std::collections::HashSet::new();
+        hits.into_iter().filter(|h| seen.insert(h.file.clone())).collect()
+    }
 }
 
 pub fn grep_command(opts: GrepOptions) {
@@ -21,7 +60,8 @@ pub fn grep_command(opts: GrepOptions) {
             Ok(parts) => parts,
             Err(e) => fail(&e),
         };
-    render(&hits, origin, candidate_files, total_files, opts.json);
+    let hits = opts.scope.apply(&opts.cwd, hits);
+    render(&hits, origin, candidate_files, total_files, opts.json, opts.scope.files_with_matches);
 }
 
 /// `sem grep -e p1 -e p2 …` — several patterns in one invocation, each
@@ -30,11 +70,19 @@ pub fn grep_command(opts: GrepOptions) {
 /// same index/full-scan tiers as a single `sem grep`. Exit codes match the
 /// single form's conventions extended to the batch: 2 on the first invalid
 /// pattern, 1 when every pattern produced zero hits, 0 otherwise.
-pub fn grep_multi_command(cwd: String, patterns: Vec<String>, case_insensitive: bool, json: bool) {
+pub fn grep_multi_command(
+    cwd: String,
+    patterns: Vec<String>,
+    case_insensitive: bool,
+    json: bool,
+    scope: &Scope,
+) {
     let mut per_pattern = Vec::with_capacity(patterns.len());
     for pattern in &patterns {
         match search_one(&cwd, pattern, case_insensitive) {
-            Ok(parts) => per_pattern.push(parts),
+            Ok((hits, origin, candidates, total)) => {
+                per_pattern.push((scope.apply(&cwd, hits), origin, candidates, total))
+            }
             Err(e) => fail(&e),
         }
     }
@@ -70,14 +118,7 @@ pub fn grep_multi_command(cwd: String, patterns: Vec<String>, case_insensitive:
             }
             println!("{}", format!("pattern \"{pattern}\":").dimmed());
             for hit in hits {
-                println!(
-                    "{}{}{}{}{}",
-                    hit.file.magenta(),
-                    ":".dimmed(),
-                    hit.line.to_string().green(),
-                    ":".dimmed(),
-                    hit.text
-                );
+                print_hit(hit, scope.files_with_matches);
             }
             if hits.is_empty() {
                 println!("{}", "  (no hits)".dimmed());
@@ -186,12 +227,28 @@ fn origin_label(origin: CandidateOrigin) -> &'static str {
     }
 }
 
+fn print_hit(hit: &GrepHit, file_only: bool) {
+    if file_only {
+        println!("{}", hit.file.magenta());
+        return;
+    }
+    println!(
+        "{}{}{}{}{}",
+        hit.file.magenta(),
+        ":".dimmed(),
+        hit.line.to_string().green(),
+        ":".dimmed(),
+        hit.text
+    );
+}
+
 fn render(
     hits: &[GrepHit],
     origin: CandidateOrigin,
     candidate_files: usize,
     total_files: usize,
     json: bool,
+    file_only: bool,
 ) {
     if json {
         let report = Report {
@@ -212,14 +269,7 @@ fn render(
         println!("{}", serde_json::to_string(&report).unwrap_or_default());
     } else {
         for hit in hits {
-            println!(
-                "{}{}{}{}{}",
-                hit.file.magenta(),
-                ":".dimmed(),
-                hit.line.to_string().green(),
-                ":".dimmed(),
-                hit.text
-            );
+            print_hit(hit, file_only);
         }
         if let Ok(val) = std::env::var("SEM_GREP_STATS") {
             if val == "1" {
```

**File**: `crates/sem-cli/src/commands/impact.rs` (modified, +2/-0)
```diff
@@ -878,6 +878,7 @@ fn find_entity<'a>(
 
     if matching.is_empty() {
         eprintln!("{} Entity '{}' not found", "error:".red().bold(), name);
+        super::print_name_suggestions(graph, name, "impact");
         std::process::exit(1);
     }
 
@@ -897,6 +898,7 @@ fn find_entity<'a>(
                 name,
                 file
             );
+            super::print_name_suggestions(graph, name, "impact");
             std::process::exit(1);
         }
         // Multiple matches even within the file — fall through to ambiguity error
```

**File**: `crates/sem-cli/src/commands/mod.rs` (modified, +35/-0)
```diff
@@ -214,6 +214,41 @@ pub fn entity_matches_qualified(
     false
 }
 
+/// "Did you mean": when a (possibly qualified or file-scoped) name resolves to
+/// nothing, list the entities carrying its bare member name, each with its
+/// owner and location, on stdout — so a wrong guess at the owning class
+/// (`ModelAdmin.lookup_allowed` for a method defined on `BaseModelAdmin`) or
+/// at the file costs one retry instead of a switch back to grep.
+pub fn print_name_suggestions(
+    graph: &sem_core::parser::graph::EntityGraph,
+    query: &str,
+    command: &str,
+) {
+    let bare = query
+        .rsplit_once("::")
+        .or_else(|| query.rsplit_once('.'))
+        .map(|(_, child)| child)
+        .unwrap_or(query);
+    let mut hits: Vec<_> = graph.entities.values().filter(|e| e.name == bare).collect();
+    if hits.is_empty() {
+        return;
+    }
+    hits.sort_by_key(|e| (&e.file_path, e.start_line));
+    println!("'{query}' not found; entities named '{bare}' (re-run `sem {command}` with `Owner.{bare}` or --file):");
+    for e in hits.iter().take(12) {
+        let owner = e
+            .parent_id
+            .as_ref()
+            .and_then(|pid| graph.entities.get(pid))
+            .map(|p| format!("{}.", p.name))
+            .unwrap_or_default();
+        println!("  {} {owner}{} {}:{}", e.entity_type, e.name, e.file_path, e.start_line);
+    }
+    if hits.len() > 12 {
+        println!("  … {} more", hits.len() - 12);
+    }
+}
+
 fn split_type_qualified_query(query: &str) -> Option<(&str, &str)> {
     let (entity_type, name) = query.split_once(' ')?;
     if entity_type.is_empty() || name.is_empty() {
```

**File**: `crates/sem-cli/src/commands/query.rs` (modified, +91/-14)
```diff
@@ -33,11 +33,10 @@ use std::path::{Path, PathBuf};
 
 use colored::Colorize;
 use sem_core::index::{self, QueryIndex};
-use sem_core::parser::graph::{EntityGraph, EntityInfo};
+use sem_core::parser::graph::EntityInfo;
 use sem_core::parser::registry::ParserRegistry;
 use serde::Serialize;
 
-use crate::build_cache::write_query_index;
 
 pub struct QueryOptions {
     pub cwd: String,
@@ -134,6 +133,87 @@ pub fn callers_command(opts: QueryOptions, limit: Option<usize>) {
     if hidden > 0 && !opts.json {
         println!("{}", format!("  … {hidden} more (raise --limit)").dimmed());
     }
+    if !opts.json {
+        if let (Some(def), Some(related)) = (answer.defs.first(), answer.related.first()) {
+            print_name_matched_call_sites(&opts.cwd, def, related, limit.unwrap_or(25));
+        }
+    }
+}
+
+/// Call sites the graph could not attribute: for a *member* (method,
+/// property), `obj.name(...)` with an untyped receiver — the common case in
+/// Python/Ruby/JS — resolves to nothing, so "callers: none" would read as
+/// "safe to change". List the entities whose body contains `.name(` instead,
+/// clearly labelled as a by-name match (they may call a same-named member of
+/// another class). Served from the index's trigram tier; skipped when there
+/// is no index.
+fn print_name_matched_call_sites(cwd: &str, def: &EntityInfo, resolved: &[EntityInfo], cap: usize) {
+    if def.parent_id.is_none() || def.name.len() < 3 {
+        return;
+    }
+    let root = super::repo_root_or_cwd(cwd);
+    let Some(idx) = open_index(&root) else {
+        return;
+    };
+    let pattern = format!(r"\.{}\s*\(", regex::escape(&def.name));
+    let registry = super::create_registry(cwd);
+    let Ok(report) = index::grep::search(
+        &idx,
+        &root,
+        &pattern,
+        &index::grep::GrepOptions { case_insensitive: false },
+        |dir: &Path| super::files::find_supported_files_in_path(&root, dir, &registry, &[], false),
+    ) else {
+        return;
+    };
+    let known: std::collections::HashSet<String> = resolved
+        .iter()
+        .map(|e| e.id.to_string())
+        .chain(std::iter::once(def.id.to_string()))
+        .collect();
+    let mut seen = std::collections::HashSet::new();
+    let mut rows: Vec<(EntityInfo, usize)> = Vec::new();
+    for hit in &report.hits {
+        // innermost entity enclosing the hit line
+        let enclosing = idx
+            .entities_in_file(&hit.file)
+            .into_iter()
+            .filter(|e| e.start_line() <= hit.line && hit.line <= e.end_line())
+            .min_by_key(|e| e.end_line() - e.start_line());
+        let Some(e) = enclosing else { continue };
+        let info = e.to_entity_info();
+        let id = info.id.to_string();
+        if known.contains(&id) || !seen.insert(id) {
+            continue;
+        }
+        rows.push((info, hit.line));
+    }
+    if rows.is_empty() {
+        return;
+    }
+    println!(
+        "  {}",
+        format!(
+            "+ {} more by name `.{}(` (receiver type not resolved; may be another class's {}):",
+            rows.len(),
+            def.name,
+            def.name
+        )
+        .dimmed()
+    );
+    for (info, line) in rows.iter().take(cap) {
+        println!(
+            "  {} {} {}:{} (call at L{})",
+            info.entity_type.dimmed(),
+            info.name,
+            info.file_path,
+            info.start_line,
+            line
+        );
+    }
+    if rows.len() > cap {
+        println!("{}", format!("  … {} more (raise --limit)", rows.len() - cap).dimmed());
+    }
 }
 
 /// The callers-verb refusal: every candidate definition listed, exit 1.
@@ -451,7 +531,13 @@ fn index_answer_verified(
 fn cold_build_answer(root: &Path, opts: &QueryOptions, verb: Verb) -> Answer {
     let registry = super::create_registry(&opts.cwd);
     let file_paths = super::graph::find_supported_files_with_options(root, &registry, &[], false);
-    let (graph, _entities) = EntityGraph::build(root, &file_paths, &registry);
+    // One cold build serves every verb: go through the shared graph cache
+    // (full save + a complete index with test flags and byte spans), so the
+    // `sem context` / `sem impact` that usually follow a first `sem find`
+    // answer from the index instead of paying for a second full build.
+    let source_scope = super::graph::cache_source_scope(root, &[], false);
+    let (graph, _entities) =
+        super::graph::get_or_build_graph(root, &file_paths, &registry, false, source_scope);
 
     let defs: Vec<EntityInfo> = graph
         .entities
@@ -482,17 +568,8 @@ fn cold_build_answer(root: &Path, opts: &QueryOptions, verb: Verb) -> Answer {
             .collect()
     };
 
-    // Self-heal: a repo that reaches this fallback now has a fresh index for
-    // every subsequent query (the change's item 4).
-    // `None` for the test classification: this path builds topology only and
-    // has no `SemanticEntity` bodies, whi
```

**File**: `crates/sem-cli/src/commands/topology.rs` (modified, +12/-5)
```diff
@@ -456,10 +456,11 @@ fn any_match(pats: &[String], text: &str) -> bool {
 ///   { "only": { "to", "from": [..] } }                              only `from` may depend on `to`
 ///   { "acyclic": { "scope" } }                                      no cycle inside scope
 ///   { "layers": [lowest, .., highest] }                             no edge from a lower to a higher layer
-/// Reference laws (over every import in scanned files; globs or lists of globs):
+/// Reference laws (over every import in scanned files; globs or lists of globs; optional
+/// `kind`: value | type | both, default both — `value` skips `import type` / all-`type` specifiers):
 ///   { "forbidImport": { "from", "except", "specifier", "to", "forms" } }  matching files must not import it
 ///   { "allowImports": { "from", "except", "specifiers", "forms" } }       matching files import only these
-///   { "noCrossPackageRelative": { "from" } }                              relative imports stay in their package
+///   { "noCrossPackageRelative": { "from", "except" } }                    relative imports stay in their package
 /// Code-shape laws (a tree-sitter query; every non-`_` capture is a violation):
 ///   { "forbidPattern": { "from", "except", "query", "within" } }   within: node kinds the hit must be inside
 /// Any law may carry "promise": the human statement it verifies; results report "kept".
@@ -487,9 +488,15 @@ pub fn check(ctx: &Ctx, laws: &[Value], scope: Option<&BTreeSet<String>>) -> Res
             let (from, except) = (globs(&f["from"]), globs(&f["except"]));
             let (specs, to) = (globs(if allow { &f["specifiers"] } else { &f["specifier"] }), globs(&f["to"]));
             let forms = globs(&f["forms"]);
+            // optional reference kind filter, as for graph laws: value | type | both (default both)
+            let sel = match law["kind"].as_str().unwrap_or("both") {
+                "value" => Selector::Value,
+                "type" => Selector::Type,
+                _ => Selector::Both,
+            };
             for file in l.ex.files.iter().filter(|x| any_match(&from, &x.path) && !any_match(&except, &x.path)) {
                 for r in &file.refs {
-                    if !forms.is_empty() && !forms.contains(&form_name(r.form)) {
+                    if (!forms.is_empty() && !forms.contains(&form_name(r.form))) || !sel.admits(r.kind) {
                         continue;
                     }
                     let hit_spec = any_match(&specs, &r.specifier);
@@ -503,8 +510,8 @@ pub fn check(ctx: &Ctx, laws: &[Value], scope: Option<&BTreeSet<String>>) -> Res
         }
         if let Some(f) = law.get("noCrossPackageRelative") {
             let l = ctx.l();
-            let from = globs(&f["from"]);
-            for file in l.ex.files.iter().filter(|x| from.is_empty() || any_match(&from, &x.path)) {
+            let (from, except) = (globs(&f["from"]), globs(&f["except"]));
+            for file in l.ex.files.iter().filter(|x| (from.is_empty() || any_match(&from, &x.path)) && !any_match(&except, &x.path)) {
                 for r in file.refs.iter().filter(|r| r.specifier.starts_with('.')) {
                     let owner = match &r.target {
                         Target::File(p) | Target::Path(p) => l.ex.ws.owner_of(p),
```

**File**: `crates/sem-cli/src/main.rs` (modified, +30/-2)
```diff
@@ -248,13 +248,26 @@ enum Commands {
 
         /// Pattern to search for, repeatable (rg-style `-e p1 -e p2`); each
         /// pattern's hits are reported separately rather than merged
-        #[arg(long = "regexp", short = 'e', conflicts_with = "pattern")]
+        #[arg(long = "regexp", short = 'e')]
         patterns: Vec<String>,
 
         /// Case-insensitive match (disables the trigram prefilter)
         #[arg(long, short = 'i')]
         ignore_case: bool,
 
+        /// Only report hits under these files or directories (rg-style
+        /// trailing paths, relative to the current directory)
+        #[arg(value_name = "PATH")]
+        paths: Vec<String>,
+
+        /// Print only the paths of files with at least one hit (rg -l)
+        #[arg(long = "files-with-matches", short = 'l')]
+        files_with_matches: bool,
+
+        /// Accepted for rg/grep compatibility: line numbers are always shown
+        #[arg(long = "line-number", short = 'n', hide = true)]
+        line_number: bool,
+
         /// Output as JSON (one object: hits, candidate_files, total_files, origin)
         #[arg(long)]
         json: bool,
@@ -850,14 +863,28 @@ fn main() {
             pattern,
             patterns,
             ignore_case,
+            paths,
+            files_with_matches,
+            line_number: _,
             json,
         }) => {
             let cwd = std::env::current_dir()
                 .unwrap_or_default()
                 .to_string_lossy()
                 .to_string();
+            // With `-e`, every positional is a path (rg semantics), so the
+            // first positional clap parsed as `pattern` joins `paths`.
+            let (pattern, paths) = if patterns.is_empty() {
+                (pattern, paths)
+            } else {
+                (None, pattern.into_iter().chain(paths).collect())
+            };
+            let scope = commands::grep::Scope {
+                paths,
+                files_with_matches,
+            };
             if patterns.len() > 1 {
-                commands::grep::grep_multi_command(cwd, patterns, ignore_case, json);
+                commands::grep::grep_multi_command(cwd, patterns, ignore_case, json, &scope);
             } else {
                 // Positional pattern, or exactly one -e: the single form,
                 // byte-identical to what it always produced.
@@ -869,6 +896,7 @@ fn main() {
                     pattern: single,
                     case_insensitive: ignore_case,
                     json,
+                    scope,
                 });
             }
         }
```

**File**: `crates/sem-core/src/parser/facts_store.rs` (modified, +3/-1)
```diff
@@ -208,7 +208,9 @@ macro_rules! maybe_par_iter {
 /// 4 -> 5: Dart call/scope extraction and language/owner-aware member
 /// resolution changed. Invalidate persisted edges and query indexes even
 /// when source bytes and the development package version are unchanged.
-pub const FACTS_SCHEMA_VERSION: u32 = 5;
+/// 5 -> 6: members of decorated Python classes (`@deco class A:`) are now
+/// extracted; unchanged files must re-extract to gain them.
+pub const FACTS_SCHEMA_VERSION: u32 = 6;
 
 const MAGIC: &[u8; 8] = b"SEMFACT1";
 
```

---

### Incident Patch 9: `d713ce23` (2026-10-01)
**Commit Message**: fix: search unparsed text files and expose search coverage (#500)

Fixes text discovery omitting files such as Objective-C++ .mm because
grep reused the structural parser file filter. Includes eligible
unparsed files in cold searches and supplements warm structural indexes.
Preserves ignore/default exclusions, skips NUL-containing binary content
and symlinks in text discovery, and distinguishes result pagination from
search scope in agent responses. Tests: cold/warm/new-file coverage
regression; eight multi-query CLI tests; seventeen focused JS tests;
TypeScript typecheck. No benchmark results or experimental branch dump
included.

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ All notable changes to sem are documented in this file.
 
 ### Fixed
 
+- Text search includes eligible files without a structural parser (such as Objective-C++ `.mm` and custom build files), including alongside a warm structural index. Search responses preserve coverage limits separately from result pagination; binary content remains excluded.
+
 - Simple transaction edits preserve overloaded entity selectors. Timed-out public checks retain partial diagnostics and restart their disposable checker so subsequent validation can proceed.
 
 - Simple transaction read batches preserve valid results when another selector is malformed or a requested path is rejected as a symlink. Partial captures report their errors explicitly; strict capture and edit checks remain unchanged.
```

**File**: `crates/sem-cli/src/commands/files.rs` (modified, +28/-2)
```diff
@@ -10,6 +10,28 @@ pub fn find_supported_files_in_path(
     registry: &ParserRegistry,
     ext_filter: &[String],
     no_default_excludes: bool,
+) -> Vec<String> {
+    find_files_in_path(
+        root,
+        scan_path,
+        Some(registry),
+        ext_filter,
+        no_default_excludes,
+    )
+}
+
+/// Text discovery must not depend on whether a structural parser exists.
+/// Retains Sem's ignore, hidden-file and binary-path exclusions.
+pub fn find_search_files(root: &Path) -> Vec<String> {
+    find_files_in_path(root, root, None, &[], false)
+}
+
+fn find_files_in_path(
+    root: &Path,
+    scan_path: &Path,
+    registry: Option<&ParserRegistry>,
+    ext_filter: &[String],
+    no_default_excludes: bool,
 ) -> Vec<String> {
     let mut files = Vec::new();
 
@@ -57,7 +79,9 @@ pub fn find_supported_files_in_path(
         };
 
         let path = entry.path();
-        if !path.is_file() {
+        if !path.is_file()
+            || (registry.is_none() && !entry.file_type().is_some_and(|kind| kind.is_file()))
+        {
             continue;
         }
 
@@ -78,7 +102,9 @@ pub fn find_supported_files_in_path(
         if is_probably_binary_path(&rel_path) {
             continue;
         }
-        if !has_supported_plugin(path, &rel_path, registry, ext_filter) {
+        if registry
+            .is_some_and(|registry| !has_supported_plugin(path, &rel_path, registry, ext_filter))
+        {
             continue;
         }
         files.push(rel_path);
```

**File**: `crates/sem-cli/src/commands/grep.rs` (modified, +31/-6)
```diff
@@ -58,6 +58,7 @@ pub fn grep_multi_command(cwd: String, patterns: Vec<String>, case_insensitive:
                     "candidate_files": candidate_files,
                     "total_files": total_files,
                     "origin": origin_label(*origin),
+                    "coverage": "eligible_text_files_best_effort; ignore_hidden_binary_and_default_exclusions_apply",
                 })
             })
             .collect();
@@ -100,12 +101,35 @@ fn search_one(
     let root = super::repo_root_or_cwd(cwd);
     let grep_opts = grep::GrepOptions { case_insensitive };
 
-    let registry = super::create_registry(cwd);
+    let file_paths = super::files::find_search_files(&root);
     let from_index = if std::env::var_os("SEM_NO_INDEX").is_none() {
         super::query::open_index(&root).map(|idx| {
-            grep::search(&idx, &root, pattern, &grep_opts, |dir: &std::path::Path| {
-                super::files::find_supported_files_in_path(&root, dir, &registry, &[], false)
-            })
+            let indexed: std::collections::HashSet<_> = (0..idx.file_count())
+                .map(|i| idx.file_path(i as u32).to_string())
+                .collect();
+            // The structural index cannot contain every text file. Search the
+            // unindexed remainder even when no directory mtime has changed.
+            let extra: Vec<_> = file_paths
+                .iter()
+                .filter(|file| !indexed.contains(*file))
+                .cloned()
+                .collect();
+            let mut report = grep::search(&idx, &root, pattern, &grep_opts, |_| Vec::new())?;
+            report
+                .hits
+                .retain(|hit| file_paths.binary_search(&hit.file).is_ok());
+            report
+                .hits
+                .extend(grep::full_scan(&root, &extra, pattern, &grep_opts)?);
+            report
+                .hits
+                .sort_by(|a, b| (&a.file, a.line).cmp(&(&b.file, b.line)));
+            report
+                .hits
+                .dedup_by(|a, b| a.file == b.file && a.line == b.line);
+            report.candidate_files += extra.len();
+            report.total_files = file_paths.len();
+            Ok::<_, regex::Error>(report)
         })
     } else {
         None
@@ -126,8 +150,6 @@ fn search_one(
         // (a bare `sem grep` on an unindexed repo does not itself trigger a
         // corpus-level build — the next `graph`/`diff`/`impact`/`find` does).
         None => {
-            let file_paths =
-                super::graph::find_supported_files_with_options(&root, &registry, &[], false);
             let hits = grep::full_scan(&root, &file_paths, pattern, &grep_opts)?;
             let n = file_paths.len();
             Ok((hits, CandidateOrigin::FullScan, n, n))
@@ -149,6 +171,7 @@ struct HitRow {
 
 #[derive(Serialize)]
 struct Report {
+    coverage: &'static str,
     hits: Vec<HitRow>,
     candidate_files: usize,
     total_files: usize,
@@ -172,6 +195,8 @@ fn render(
 ) {
     if json {
         let report = Report {
+            coverage:
+                "eligible_text_files_best_effort; ignore_hidden_binary_and_default_exclusions_apply",
             hits: hits
                 .iter()
                 .map(|h| HitRow {
```

**File**: `crates/sem-cli/tests/grep_text_coverage.rs` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+use serde_json::Value;
+use std::{fs, process::Command};
+use tempfile::TempDir;
+
+fn search(repo: &TempDir) -> Value {
+    let output = Command::new(env!("CARGO_BIN_EXE_sem"))
+        .current_dir(repo.path())
+        .env("DO_NOT_TRACK", "1")
+        .env("SEM_LOCAL", "1")
+        .args(["grep", "coverage_marker", "--json"])
+        .output()
+        .unwrap();
+    assert!(
+        output.status.success(),
+        "{}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+    serde_json::from_slice(&output.stdout).unwrap()
+}
+
+#[test]
+fn grep_finds_unparsed_text_before_and_after_structural_index() {
+    let repo = TempDir::new().unwrap();
+    fs::write(repo.path().join("lib.rs"), "fn coverage_marker() {}\n").unwrap();
+    for file in ["OSXScreen.mm", "notes.unknown", "BUILD_CUSTOM"] {
+        fs::write(repo.path().join(file), "coverage_marker\n").unwrap();
+    }
+    fs::write(repo.path().join("binary.unknown"), b"coverage_marker\0\n").unwrap();
+    fs::write(repo.path().join(".hidden"), "coverage_marker\n").unwrap();
+    fs::write(repo.path().join("ignored.mm"), "coverage_marker\n").unwrap();
+    fs::write(repo.path().join(".semignore"), "ignored.mm\n").unwrap();
+    let cold = search(&repo);
+    let files: Vec<_> = cold["hits"]
+        .as_array()
+        .unwrap()
+        .iter()
+        .map(|hit| hit["file"].as_str().unwrap())
+        .collect();
+    assert_eq!(
+        files,
+        ["BUILD_CUSTOM", "OSXScreen.mm", "lib.rs", "notes.unknown"]
+    );
+    assert!(cold["coverage"]
+        .as_str()
+        .unwrap()
+        .contains("exclusions_apply"));
+    let build = Command::new(env!("CARGO_BIN_EXE_sem"))
+        .current_dir(repo.path())
+        .env("DO_NOT_TRACK", "1")
+        .env("SEM_LOCAL", "1")
+        .args(["find", "coverage_marker", "--json"])
+        .output()
+        .unwrap();
+    assert!(build.status.success());
+    assert_eq!(search(&repo)["hits"], cold["hits"]);
+    fs::write(repo.path().join("new.mm"), "coverage_marker\n").unwrap();
+    assert_eq!(search(&repo)["hits"].as_array().unwrap().len(), 5);
+}
```

**File**: `crates/sem-core/src/index/grep.rs` (modified, +3/-0)
```diff
@@ -183,6 +183,9 @@ fn verify_file(root: &Path, path: &str, matcher: &Regex, hits: &mut Vec<GrepHit>
     let Ok(bytes) = std::fs::read(root.join(path)) else {
         return;
     };
+    if bytes.contains(&0) {
+        return;
+    }
     for (i, mut line) in bytes.split(|&b| b == b'\n').enumerate() {
         if line.last() == Some(&b'\r') {
             line = &line[..line.len() - 1];
```

**File**: `pi/src/tools/sem-grep.ts` (modified, +10/-3)
```diff
@@ -38,6 +38,7 @@ interface RawGrepHit {
 
 interface RawGrepOutput {
   hits: RawGrepHit[];
+  coverage?: string;
 }
 
 const SemGrepParamsSchema = Type.Object({
@@ -150,7 +151,7 @@ function matchesPathFilter(file: string, path: string): boolean {
  * NOT an error), so any exit code is accepted as long as stdout parses as
  * JSON; only unparseable output (crash, invalid regex → exit 2) throws.
  */
-async function runSemGrepJson(pattern: string, deps: SemGrepDeps): Promise<RawGrepHit[]> {
+async function runSemGrepJson(pattern: string, deps: SemGrepDeps): Promise<RawGrepOutput> {
   const result = await runCommand(deps.semBin, ["grep", pattern, "--json"], deps.cwd, deps.signal);
 
   let parsed: RawGrepOutput;
@@ -163,7 +164,10 @@ async function runSemGrepJson(pattern: string, deps: SemGrepDeps): Promise<RawGr
       }`,
     );
   }
-  return Array.isArray(parsed?.hits) ? parsed.hits : [];
+  if ((result.exitCode !== 0 && result.exitCode !== 1) || !Array.isArray(parsed?.hits)) {
+    throw new Error(`Invalid search response (exit ${result.exitCode})`);
+  }
+  return parsed;
 }
 
 /** Renders one hit as the plain single line used when context is off. */
@@ -209,11 +213,14 @@ async function runOnePattern(pattern: string, params: SemGrepParams, deps: SemGr
     path: params.path ?? null,
     glob: params.glob ?? null,
     context: params.context ?? 0,
+    coverage: "unspecified_cli_search_scope",
   };
 
   let rawHits: RawGrepHit[];
   try {
-    rawHits = await runSemGrepJson(searchPattern(pattern, params.literal), deps);
+    const result = await runSemGrepJson(searchPattern(pattern, params.literal), deps);
+    rawHits = result.hits;
+    baseDetails.coverage = result.coverage ?? "parser_supported_files_only; unsupported_files_may_be_absent";
   } catch (err) {
     const message = err instanceof Error ? err.message : String(err);
     // P7: the fix for a parse error is almost always "I meant that as
```

**File**: `pi/src/transaction/simple/discovery-inventory.mjs` (modified, +2/-0)
```diff
@@ -9,6 +9,8 @@ export function matchInventory(group, hits, offset = 0, limit = 60) {
     pattern: group.pattern, total, returned: page.length,
     omitted: Math.max(0, total - page.length),
     complete: offset === 0 && !availableMore && !upstreamTruncated,
+    completeness_scope: 'returned_search_results_not_repository_coverage',
+    coverage: group.coverage ?? 'unspecified_upstream_search_scope',
     next_offset: availableMore ? offset + page.length : null,
     upstream_truncated: upstreamTruncated,
     next_action: availableMore ? 'Repeat with match_offset=next_offset.' :
```

**File**: `pi/src/transaction/simple/search-coverage.test.mjs` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import {test} from 'node:test';
+import assert from 'node:assert/strict';
+import {matchInventory} from './discovery-inventory.mjs';
+
+test('pagination completeness does not claim repository coverage', () => {
+  const result=matchInventory({pattern:'x',total:0,coverage:'parser_supported_files_only'},[]);
+  assert.equal(result.complete,true);
+  assert.equal(result.completeness_scope,'returned_search_results_not_repository_coverage');
+  assert.equal(result.coverage,'parser_supported_files_only');
+  assert.equal(matchInventory({total:0},[]).coverage,'unspecified_upstream_search_scope');
+});
```

---

### Incident Patch 10: `ca436cfa` (2026-09-30)
**Commit Message**: fix(pi): preserve overloaded entity targets and recover timed-out checks (#499)

## Changes
- Preserve parser-provided overload locations through edit generation
and normalize them to explicit selectors.
- Restart disposable validation checkers after timeouts while retaining
partial diagnostics and unknown validation status.
- Restart stopped checkers before subsequent checks.
- Add regression coverage for overload selection, stale locations,
timeout recovery, and recovery failure.

## Validation
12 focused Node tests and one Python test passed. No benchmark artifacts
or task-specific patches included. No end-to-end speedup claim.

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ All notable changes to sem are documented in this file.
 
 ### Fixed
 
+- Simple transaction edits preserve overloaded entity selectors. Timed-out public checks retain partial diagnostics and restart their disposable checker so subsequent validation can proceed.
+
 - Simple transaction read batches preserve valid results when another selector is malformed or a requested path is rejected as a symlink. Partial captures report their errors explicitly; strict capture and edit checks remain unchanged.
 
 - **Copilot CLI can connect to the MCP server again.** Unsupported discovery probes return `Method not found` without closing the connection, allowing clients to fall back to `initialize` in both standalone and shared modes. Fixes #497.
```

**File**: `pi/src/transaction/simple/container-check-v8.py` (modified, +17/-4)
```diff
@@ -39,6 +39,10 @@ def _check(command):
             head=run(['docker','exec',name,'git','-C','/testbed','rev-parse','HEAD'],**options).stdout.strip()
             if head!=os.environ['SEM_VALIDATION_BASE']:
                 return {'pass':None,'stage':'unavailable','error':'Validation image is not at the task base revision'}
+        else:
+            state=json.loads(run(['docker','inspect','--format','{{json .State}}',name],**options).stdout)
+            if state.get('Running') is False:
+                run(['docker','start',name],**options)
         run(['git','add','-N','--','.'],cwd=cwd,**options)
         patch=run(['git','diff','--no-ext-diff','--binary','HEAD'],cwd=cwd,**options).stdout
         previous=subprocess.run(['docker','exec',name,'cat','/tmp/sem-applied.diff'],capture_output=True,text=True)
@@ -77,10 +81,19 @@ def _check(command):
             'executed_argv':argv,
             'patch_unchanged':unchanged,'applied_delta_bytes':len(delta.encode()),
             'exit_code':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
-    except subprocess.TimeoutExpired:
-        # Terminate only this trial's disposable checker, including running tests.
-        subprocess.run(['docker','stop','-t','1',name],capture_output=True,timeout=30)
-        return {'pass':None,'stage':'timeout','error':'Public validation exceeded its bounded timeout'}
+    except subprocess.TimeoutExpired as error:
+        # Terminate the test tree, preserving this disposable checker's caches.
+        def decoded(value):
+            return value.decode('utf-8',errors='replace') if isinstance(value,bytes) else (value or '')
+        recovery='checker_restarted; retry a narrower test target'
+        try:
+            run(['docker','restart','-t','1',name],timeout=30)
+        except (subprocess.SubprocessError,OSError) as restart_error:
+            recovery='checker_restart_failed: '+str(restart_error)[:300]
+        return {'pass':None,'stage':'timeout','error':'Public validation exceeded its bounded timeout',
+                'stdout':decoded(error.stdout),'stderr':decoded(error.stderr),
+                'recovery':recovery,'executed_argv':argv,
+                'checked_patch_sha256':hashlib.sha256(patch.encode()).hexdigest() if 'patch' in locals() else None}
     except (subprocess.CalledProcessError,OSError) as error:
         return {'pass':None,'stage':'unavailable','error':str(getattr(error,'stderr',None) or error)[-12000:]}
 
```

**File**: `pi/src/transaction/simple/edit-program.mjs` (modified, +11/-1)
```diff
@@ -6,7 +6,17 @@ const {parentPort,workerData}=require('node:worker_threads');
 const vm=require('node:vm');
 try {
  const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
- const source='JSON.stringify((function(){"use strict";const entities='+JSON.stringify(workerData.entities)+';const files='+JSON.stringify(workerData.files)+';'+workerData.code+'\\n})())';
+ const helper=String.raw\`function replaceEntity(row,old,value) {
+   if(!entities.includes(row)||!row.entity||typeof row.content!=='string')
+     throw Error('replaceEntity requires a provided entity');
+   if(typeof old!=='string'||!old||typeof value!=='string'||row.content.split(old).length!==2)
+     throw Error('replaceEntity anchor must occur exactly once');
+   const {name,parent_name,start_line}=row.entity;
+   const entity_type=row.entity.entity_type??row.entity.type;
+   if(!name||!entity_type)throw Error('Parser name and kind required');
+   return {file:row.file,entity:{name,entity_type,...(parent_name?{parent_name}:{}),...(Number.isInteger(start_line)?{start_line}:{})},old,new:value};
+ }\`;
+ const source='JSON.stringify((function(){"use strict";const entities='+JSON.stringify(workerData.entities)+';const files='+JSON.stringify(workerData.files)+';'+helper+workerData.code+'\\n})())';
  const value=new vm.Script(source).runInContext(context,{timeout:500});
  if(typeof value!=='string'||value.length>500000)throw new Error('Program must return bounded JSON');
  parentPort.postMessage({value});
```

**File**: `pi/src/transaction/simple/entity-overloads.test.mjs` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import {test} from 'node:test';
+import assert from 'node:assert/strict';
+import fs from 'node:fs/promises';
+import os from 'node:os';
+import path from 'node:path';
+import {generateEdits} from './edit-program.mjs';
+import {selectEntity} from './repair-contract.mjs';
+import {normalizeEdits} from './normalize-edits-simple.mjs';
+test('overloaded entity remains addressable through generation and normalization',async()=>{
+ const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'sem-overloads-'));
+ const outline=[1,2].map(start_line=>({name:'create',type:'method',start_line,end_line:start_line}));
+ const rows=outline.map(entity=>({file:'a.java',entity,content:'void create() { old(); }'}));
+ try {
+  await fs.writeFile(path.join(cwd,'a.java'),rows.map(r=>r.content).join('\n'));
+  const generated=await generateEdits('return {edits:[replaceEntity(entities[1],"old","new")]};',rows);
+  assert.equal(selectEntity(outline,generated.edits[0].entity),outline[1]);
+  assert.throws(()=>selectEntity(outline,{...generated.edits[0].entity,start_line:3}),/Ambiguous/);
+  const normalized=await normalizeEdits(generated.edits,cwd,{outline:async()=>({entities:outline})});
+  assert.equal(normalized.edits[0].entity.ordinal,1);
+  assert.match(normalized.edits[0].content,/new/);
+ } finally {await fs.rm(cwd,{recursive:true,force:true});}
+});
```

**File**: `pi/src/transaction/simple/normalize-edits-simple.mjs` (modified, +1/-0)
```diff
@@ -185,6 +185,7 @@ export async function normalizeEdits(rawEdits, cwd, api) {
         name: enclosing.name,
         entity_type: enclosing.type,
         ...(enclosing.parent_name ? { parent_name: enclosing.parent_name } : {}),
+        ordinal: (outlines.get(file).entities ?? []).filter(e=>e.name===enclosing.name && e.type===enclosing.type && (!enclosing.parent_name || e.parent_name===enclosing.parent_name)).findIndex(e=>e.start_line===enclosing.start_line && e.end_line===enclosing.end_line),
       },
       op: "replace",
       content,
```

**File**: `pi/src/transaction/simple/repair-contract.mjs` (modified, +6/-1)
```diff
@@ -9,7 +9,12 @@ export function selectEntity(entities, requested) {
     const exactParent=candidates.filter(e=>e.parent_name===requested.parent_name);
     candidates=exactParent.length?exactParent:candidates.filter(e=>e.parent_name?.toLowerCase()===requested.parent_name.toLowerCase());
   }
-  const ordinal=requested.ordinal;
+  if(requested.start_line!==undefined) {
+    if(!Number.isInteger(requested.start_line)||requested.start_line<1)
+      throw new Error('Invalid entity start_line');
+    candidates=candidates.filter(e=>e.start_line===requested.start_line);
+  }
+  const ordinal=requested.start_line!==undefined ? undefined : requested.ordinal;
   if((ordinal!==undefined&&(!Number.isInteger(ordinal)||ordinal<0||ordinal>=candidates.length))
       ||(ordinal===undefined&&candidates.length!==1)) {
     throw new Error('Ambiguous or incompatible entity selector; use an exact type/parent/ordinal: '+JSON.stringify(sameName.map(e=>({name:e.name,entity_type:e.type,parent_name:e.parent_name,start_line:e.start_line}))));
```

**File**: `pi/src/transaction/simple/sem-session-simple-mcp.mjs` (modified, +1/-0)
```diff
@@ -125,6 +125,7 @@ const entity = object({
   entity_type: { type: "string" },
   parent_name: { type: "string" },
   ordinal: { type: "integer", minimum: 0 },
+  start_line: { type: "integer", minimum: 1, description: "Parser-provided start line in the current input snapshot; disambiguates overloaded entities." },
 }, ["name"]);
 const edit = object({
   file: { type: "string" },
```

**File**: `pi/src/transaction/simple/test_checker_recovery.py` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+import importlib.util
+import os
+from pathlib import Path
+import subprocess
+from types import SimpleNamespace
+import unittest
+from unittest.mock import patch
+
+spec=importlib.util.spec_from_file_location('checker',Path(__file__).with_name('container-check-v8.py'))
+checker=importlib.util.module_from_spec(spec)
+spec.loader.exec_module(checker)
+
+class RecoveryTests(unittest.TestCase):
+    def test_timeout_preserves_diagnostics_and_retry_works(self):
+        for restart_fails in (False,True):
+            calls=[]
+            def invoke(argv,**kwargs):
+                calls.append(argv)
+                if 'env' in argv:
+                    raise subprocess.TimeoutExpired(argv,600,output=b'Running TestSlow',stderr=b'warning')
+                if argv[:2]==['docker','restart'] and restart_fails:
+                    raise subprocess.CalledProcessError(1,argv)
+                stdout=''
+                if argv[:2]==['git','diff'] or '/tmp/sem-applied.diff' in argv: stdout='same patch'
+                elif argv[:3]==['docker','inspect','--format']: stdout='{"Running":false}'
+                return SimpleNamespace(returncode=0,stdout=stdout,stderr='')
+            env={'SEM_VALIDATION_CONTAINER':'fixture','SEM_VALIDATION_IMAGE':'image',
+                 'SEM_VALIDATION_CWD':'/tmp','SEM_VALIDATION_BASE':'base'}
+            with patch.dict(os.environ,env),patch.object(checker.subprocess,'run',side_effect=invoke):
+                result=checker._check('go test ./...')
+            self.assertIsNone(result['pass'])
+            self.assertEqual(result['stdout'],'Running TestSlow')
+            self.assertEqual(result['stderr'],'warning')
+            self.assertIn(['docker','start','fixture'],calls)
+            self.assertIn(['docker','restart','-t','1','fixture'],calls)
+            self.assertIn('checker_restart_failed' if restart_fails else 'checker_restarted',result['recovery'])
```

---

### Incident Patch 11: `e830de88` (2026-09-30)
**Commit Message**: fix(pi): preserve valid read results in partial query batches (#498)

Preserve valid siblings in read-only query batches when a path is
rejected, and return malformed selectors as per-item errors. Partial
snapshots expose file errors and remain distinct from complete
snapshots. Strict capture and edit checks remain unchanged.

Validation: 8 focused tests pass, including the real Sem parser, partial
batches, snapshot identity, and strict-capture regression checks. Server
syntax check passes. No end-to-end speedup is claimed; the Ant Design
development replay is separate.

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ All notable changes to sem are documented in this file.
 
 ### Fixed
 
+- Simple transaction read batches preserve valid results when another selector is malformed or a requested path is rejected as a symlink. Partial captures report their errors explicitly; strict capture and edit checks remain unchanged.
+
 - **Copilot CLI can connect to the MCP server again.** Unsupported discovery probes return `Method not found` without closing the connection, allowing clients to fall back to `initialize` in both standalone and shared modes. Fixes #497.
 - **Indexed name lookup sees renames and added definitions in edited files.** `sem find` checks indexed file freshness and reparses changed files on demand, without requiring a whole dependency-graph refresh. Includes TypeScript, Python and Rust regression coverage.
 - **Dart dependency graphs now resolve ordinary calls, constructor-bound receivers and typed parameters.** Callers and refs no longer select a same-named Dart method for a TypeScript receiver (or vice versa); imported class owners take precedence. Persisted graph/query caches are invalidated so upgrades rebuild the affected edges. Fixes #491.
```

**File**: `pi/src/transaction/simple/exact-code.mjs` (modified, +12/-6)
```diff
@@ -38,11 +38,12 @@ export class ExactCode {
     if(!Number.isSafeInteger(maxSnapshots)||maxSnapshots<1) fail('INVALID_SNAPSHOT_CAPACITY');
     Object.assign(this,{semBin,maxBytes,maxSnapshots}); this.snapshots=new Map();
   }
-  async capture(cwd, files, {allowMissing=false}={}) {
+  async capture(cwd, files, {allowMissing=false,partialReads=false}={}) {
     if(!Array.isArray(files)||!files.length||files.length>64) fail('INVALID_FILE_SCOPE');
     const root=await fs.realpath(cwd), sources=new Map();
     let total=0;
     const missing=[];
+    const fileErrors=[];
     for(const file of [...new Set(files)].sort(order)) {
       if(typeof file!=='string'||!file||path.isAbsolute(file)||file.split('/').some(x=>!x||x==='.'||x==='..')) fail('INVALID_PATH');
       const absolute=path.join(root,file);
@@ -52,6 +53,9 @@ export class ExactCode {
         stat=await fs.stat(absolute);
       } catch(error) {
         if(allowMissing&&error.code==='ENOENT') {missing.push(file);continue;}
+        if(partialReads&&error.message==='SYMLINK_NOT_SUPPORTED') {
+          fileErrors.push({file,code:'SYMLINK_NOT_SUPPORTED'});continue;
+        }
         throw error;
       }
       if(!stat.isFile()||stat.size>this.maxBytes-total) fail('SCOPE_TOO_LARGE');
@@ -61,7 +65,7 @@ export class ExactCode {
       sources.set(file,bytes);
     }
     const manifest=[...sources].map(([file,b])=>({file,sha256:hash(b)}));
-    const revision=hash(JSON.stringify([manifest,missing]));
+    const revision=hash(JSON.stringify(fileErrors.length?[manifest,missing,fileErrors]:[manifest,missing]));
     if(!this.snapshots.has(revision)) {
       const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sem-exact-'));
       const entities=[];
@@ -83,13 +87,13 @@ export class ExactCode {
       entities.sort((a,b)=>order(a.file,b.file)||a.start-b.start||a.end-b.end||order(a.id,b.id));
       // Lexical containment only, not receiver/type or runtime resolution.
       qualifyEntities(entities);
-      this.snapshots.set(revision,{sources,entities,manifest,...indexEntities(entities)});
+      this.snapshots.set(revision,{sources,entities,manifest,fileErrors,...indexEntities(entities)});
       // Evict only after a successful capture. Failed parsing must not destroy
       // usable snapshots. IDs remain revision-bound, never redirected.
       while(this.snapshots.size>this.maxSnapshots) this.snapshots.delete(this.snapshots.keys().next().value);
     }
     this.get(revision);
-    return {revision,files:manifest,missing_files:missing,scope:'explicit_files',coverage:'parser_reported_only',consistency:'captured_file_bytes_not_atomic_repository_snapshot'};
+    return {revision,files:manifest,missing_files:missing,...(fileErrors.length?{file_errors:fileErrors,complete:false}:{}),scope:'explicit_files',coverage:'parser_reported_only',consistency:'captured_file_bytes_not_atomic_repository_snapshot'};
   }
   get(revision) {
     const snapshot=this.snapshots.get(revision);
@@ -116,6 +120,8 @@ export class ExactCode {
     const s=this.get(revision), sources=new Map(), files=new Map();
     let fileBudget=48000;
     const results=selectors.map(selector=>{
+      const unavailable=s.fileErrors?.find(error=>error.file===selector?.file);
+      if(unavailable) return {selector,status:'error',error:unavailable,complete:false};
       if(selector && typeof selector==='object' && Object.keys(selector).length===1 && typeof selector.file==='string' && selector.file) {
         const bytes=s.sources.get(selector.file);
         if(!bytes) return {selector,status:'not_found'};
@@ -129,7 +135,7 @@ export class ExactCode {
       if(!selector||typeof selector!=='object'||Array.isArray(selector)||
          Object.keys(selector).some(k=>!['id','name','file','type'].includes(k))||
          (typeof selector.id==='string')===(typeof selector.name==='string')||
-         Object.values(selector).some(v=>typeof v!=='string'||!v)) fail('INVALID_SELECTOR');
+         Object.values(selector).some(v=>typeof v!=='string'||!v)) return {selector,status:'error',error:{code:'INVALID_SELECTOR'},complete:false};
       const matches=lookupEntities(s,selector);
       const status=matches.length===0?'not_found':matches.length===1?'unique':'ambiguous';
       if(status==='unique') {
@@ -144,7 +150,7 @@ export class ExactCode {
     });
     // Reuse containing source only within this response. No assumption that a
     // previous tool response is still in the model's context.
-    return {revision,results,sources:compactSources([...sources.values()]),...(files.size?{files:[...files.values()]}:{}),coverage:'parser_reported_only'};
+    return {revision,results,...(s.fileErrors?.length?{file_errors:s.fileErrors,complete:false}:{}),sources:compactSources([...sources.values()]),...(files.size?{files:[...files.values()]}:{}),coverage:'parser_reported_only'};
   }
   prepare(revision,edits) {
     if(!Array.isArray(edits)||!edits.length||edits.length>64) fail('INVALID_EDITS');
```

**File**: `pi/src/transaction/simple/exact-code.test.mjs` (modified, +2/-2)
```diff
@@ -85,8 +85,8 @@ test('exact snapshot contract against real SEM parser',async()=>{
     assert.equal(api.query(s.revision,[{file:'absent.ts'}]).results[0].status,'not_found');
     assert.deepEqual({revision:s.revision,...batch.sources[0]},read);
     assert.throws(()=>api.query(s.revision,[]),/INVALID_SELECTORS/);
-    assert.throws(()=>api.query(s.revision,[{name:'same',id:e.id}]),/INVALID_SELECTOR/);
-    assert.throws(()=>api.query(s.revision,[{name:'same',file:42}]),/INVALID_SELECTOR/);
+    assert.equal(api.query(s.revision,[{name:'same',id:e.id}]).results[0].error.code,'INVALID_SELECTOR');
+    assert.equal(api.query(s.revision,[{name:'same',file:42}]).results[0].error.code,'INVALID_SELECTOR');
     assert.equal(read.content,Buffer.from(source).subarray(e.start,e.end).toString());
     const replacement='export function same() { return 42; }';
     const prepared=api.prepare(s.revision,[{id:e.id,content:replacement}]);
```

**File**: `pi/src/transaction/simple/partial-read.test.mjs` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import {test} from 'node:test';
+import assert from 'node:assert/strict';
+import fs from 'node:fs/promises';
+import os from 'node:os';
+import path from 'node:path';
+import {ExactCode} from './exact-code.mjs';
+
+test('read batches preserve valid siblings without following symlinks or weakening capture',async()=>{
+  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sem-partial-read-'));
+  try {
+    const content='def value():\n    return 1\n';
+    await fs.writeFile(path.join(root,'good.py'),content);
+    await fs.symlink('good.py',path.join(root,'alias.py'));
+    const exact=new ExactCode({semBin:process.env.SEM_TEST_BIN||'sem'});
+    const captured=await exact.capture(root,['good.py','alias.py'],{partialReads:true});
+    assert.equal(captured.complete,false);
+    const selectors=[{file:'alias.py'},{file:'good.py'},null,{name:'value'}];
+    const result=exact.query(captured.revision,selectors);
+    assert.deepEqual(result.results.map(r=>r.status),['error','unique','error','unique']);
+    assert.equal(result.results[0].error.code,'SYMLINK_NOT_SUPPORTED');
+    assert.equal(result.results[2].error.code,'INVALID_SELECTOR');
+    assert.equal(result.files[0].content,content);
+    assert.equal(result.sources[0].entity.name,'value');
+    assert.equal(result.complete,false);
+    assert.equal(result.file_errors.length,1);
+    assert.deepEqual(exact.query(captured.revision,selectors),result);
+    await assert.rejects(exact.capture(root,['good.py','alias.py']),/SYMLINK_NOT_SUPPORTED/);
+    await assert.rejects(exact.capture(root,['../outside'],{partialReads:true}),/INVALID_PATH/);
+    const complete=await exact.capture(root,['good.py']);
+    assert.notEqual(complete.revision,captured.revision);
+    assert.throws(()=>exact.query(complete.revision,[]),/INVALID_SELECTORS/);
+  } finally {await fs.rm(root,{recursive:true,force:true});}
+});
```

**File**: `pi/src/transaction/simple/sem-session-simple-mcp.mjs` (modified, +1/-1)
```diff
@@ -882,7 +882,7 @@ if(process.env.SEM_EXACT_TOOLS === '1') {
         }
         case 'query': {
           if(Boolean(p.revision)===Boolean(p.files)) throw new Error('PROVIDE_REVISION_OR_FILES');
-          const snapshot=p.files?await exact.capture(cwd,p.files,{allowMissing:true}):null;
+          const snapshot=p.files?await exact.capture(cwd,p.files,{allowMissing:true,partialReads:true}):null;
           return {...exact.query(snapshot?.revision??p.revision,p.selectors),...(snapshot?{snapshot}: {})};
         }
         case 'capture': return exact.capture(cwd,p.files);
```

---

### Incident Patch 12: `59cf209a` (2026-09-27)
**Commit Message**: fix(mcp): tolerate discovery probes before initialization

Return Method not found for unsupported extension requests without closing standalone or shared MCP sessions. Verify Copilot fallback initialization and subsequent tool calls. Fixes #497.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ All notable changes to sem are documented in this file.
 
 ### Fixed
 
+- **Copilot CLI can connect to the MCP server again.** Unsupported discovery probes return `Method not found` without closing the connection, allowing clients to fall back to `initialize` in both standalone and shared modes. Fixes #497.
 - **Indexed name lookup sees renames and added definitions in edited files.** `sem find` checks indexed file freshness and reparses changed files on demand, without requiring a whole dependency-graph refresh. Includes TypeScript, Python and Rust regression coverage.
 - **Dart dependency graphs now resolve ordinary calls, constructor-bound receivers and typed parameters.** Callers and refs no longer select a same-named Dart method for a TypeScript receiver (or vice versa); imported class owners take precedence. Persisted graph/query caches are invalidated so upgrades rebuild the affected edges. Fixes #491.
 - **Shared MCP clients keep independent context history and stay bound to their repository.** Concurrent daemon startup is serialized with an OS lock, stale sockets recover after crashes, and handshakes are bounded. Adds `sem mcp --status` for health checks and reproducible lifecycle coverage on macOS and Linux.
```

**File**: `benchmarks/shared-mcp/run.py` (modified, +13/-2)
```diff
@@ -17,7 +17,7 @@
 import time
 
 
-def read_reply(process, request_id):
+def read_reply(process, request_id, expected_error=None):
     deadline = time.monotonic() + 30
     while time.monotonic() < deadline:
         ready, _, _ = select.select([process.stdout], [], [], max(0, deadline - time.monotonic()))
@@ -28,13 +28,16 @@ def read_reply(process, request_id):
             raise RuntimeError("MCP exited before response")
         reply = json.loads(line)
         if reply.get("id") == request_id:
+            if expected_error is not None:
+                assert reply.get("error", {}).get("code") == expected_error, reply
+                return reply["error"]
             if "error" in reply:
                 raise RuntimeError(reply)
             return reply["result"]
     raise TimeoutError("MCP response timed out")
 
 
-def session(binary, repo, shared):
+def session(binary, repo, shared, discovery=False):
     env = dict(os.environ)
     env.pop("SEM_MCP_SHARED_DAEMON", None)
     if shared:
@@ -54,6 +57,9 @@ def send(method, params, ident=None):
         process.stdin.write((json.dumps(message) + "\n").encode())
         process.stdin.flush()
     try:
+        if discovery:
+            send("server/discover", {}, 0)
+            read_reply(process, 0, expected_error=-32601)
         send("initialize", {"protocolVersion": "2025-03-26", "capabilities": {},
                             "clientInfo": {"name": "shared-benchmark", "version": "1"}}, 1)
         read_reply(process, 1)
@@ -111,6 +117,10 @@ def main():
         stale.close()
         try:
             cold = session(binary, repo, True)
+            # Copilot's discovery probe must not prevent legacy initialization
+            # or actual tool calls, on either transport path.
+            session(binary, repo, False, discovery=True)
+            session(binary, repo, True, discovery=True)
             stop_daemon(repo, crash=True)
             with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                 concurrent_results = list(pool.map(lambda _: session(binary, repo, True), range(8)))
@@ -130,6 +140,7 @@ def main():
                       "build": str(binary), "concurrent_clients": len(concurrent_results),
                       "stale_socket_recovery": True, "restart_recovery": True,
                       "session_context_isolation": True,
+                      "discovery_fallback_standalone_and_shared": True,
                       "cold_start_ms": cold["ms"],
                       "model_tokens": None, "samples": samples}
             report["summary"] = {name: {"n": len(rows),
```

**File**: `crates/sem-mcp/src/transport.rs` (modified, +62/-2)
```diff
@@ -1,6 +1,8 @@
 use std::{future::Future, sync::Arc};
 
-use rmcp::model::{ClientJsonRpcMessage, ServerJsonRpcMessage};
+use rmcp::model::{
+    ClientJsonRpcMessage, ClientRequest, ErrorCode, ErrorData, ServerJsonRpcMessage,
+};
 use rmcp::transport::Transport;
 use rmcp::RoleServer;
 use serde::Serialize;
@@ -60,7 +62,35 @@ where
 
             let line = without_line_ending(&line);
             match parse_client_message(line) {
-                IncomingLine::Message(message) => return Some(*message),
+                IncomingLine::Message(message) => {
+                    // Reject unsupported extension methods here, before RMCP's
+                    // initialize gate. Clients such as Copilot probe server/discover
+                    // first and fall back to initialize on Method not found.
+                    // Passing the probe to RMCP 1.x instead terminates the session.
+                    if let ClientJsonRpcMessage::Request(request) = message.as_ref() {
+                        if matches!(request.request, ClientRequest::CustomRequest(_)) {
+                            if let Err(error) = self
+                                .send(ServerJsonRpcMessage::error(
+                                    ErrorData::new(
+                                        ErrorCode::METHOD_NOT_FOUND,
+                                        "Method not found",
+                                        None,
+                                    ),
+                                    request.id.clone(),
+                                ))
+                                .await
+                            {
+                                tracing::error!(
+                                    "Error writing method not found response: {}",
+                                    error
+                                );
+                                return None;
+                            }
+                            continue;
+                        }
+                    }
+                    return Some(*message);
+                }
                 IncomingLine::Ignore => {}
                 IncomingLine::ParseError => {
                     tracing::debug!("Malformed JSON-RPC frame received");
@@ -242,6 +272,36 @@ mod tests {
     use rmcp::model::{ClientRequest, JsonRpcMessage, NumberOrString};
     use tokio::io::AsyncReadExt;
 
+    #[tokio::test]
+    async fn unsupported_probes_preserve_ids_and_keep_transport_open() {
+        let (mut client_input, server_input) = tokio::io::duplex(4096);
+        let (server_output, client_output) = tokio::io::duplex(4096);
+        let mut transport = ResilientStdioTransport::new(server_input, server_output);
+        client_input
+            .write_all(
+                br#"{"jsonrpc":"2.0","id":0,"method":"server/discover","params":{}}
+{"jsonrpc":"2.0","id":"probe","method":"future/extension","params":{}}
+{"jsonrpc":"2.0","id":2,"method":"ping"}
+"#,
+            )
+            .await
+            .unwrap();
+        let message = tokio::time::timeout(std::time::Duration::from_secs(2), transport.receive())
+            .await
+            .unwrap()
+            .unwrap();
+        assert!(matches!(message, ClientJsonRpcMessage::Request(request)
+            if matches!(request.request, ClientRequest::PingRequest(_))));
+        let mut output = BufReader::new(client_output);
+        for id in [serde_json::json!(0), serde_json::json!("probe")] {
+            let mut line = String::new();
+            output.read_line(&mut line).await.unwrap();
+            let response: serde_json::Value = serde_json::from_str(&line).unwrap();
+            assert_eq!(response["id"], id);
+            assert_eq!(response["error"]["code"], -32601);
+        }
+    }
+
     #[tokio::test]
     async fn malformed_json_emits_parse_error_and_keeps_reading() {
         let (mut client_input, server_input) = tokio::io::duplex(1024);
```

**File**: `crates/sem-mcp/tests/mcp_protocol.rs` (modified, +29/-0)
```diff
@@ -38,6 +38,10 @@ struct McpClient {
 
 impl McpClient {
     fn spawn(repo: &Path) -> Self {
+        Self::spawn_with_discovery(repo, false)
+    }
+
+    fn spawn_with_discovery(repo: &Path, discovery: bool) -> Self {
         let mut child = Command::new(env!("CARGO_BIN_EXE_sem-mcp"))
             .current_dir(repo)
             // These tests exercise one isolated stdio server each.
@@ -55,6 +59,15 @@ impl McpClient {
             stdout,
             next_id: 1,
         };
+        if discovery {
+            let response = client.request("server/discover", json!({
+                "_meta": {
+                    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
+                    "io.modelcontextprotocol/clientInfo": {"name": "copilot-cli", "version": "1.0.88"}
+                }
+            }));
+            assert_eq!(response["error"]["code"], -32601, "{response}");
+        }
         client.initialize();
         client
     }
@@ -173,6 +186,22 @@ fn tool_text(resp: &Value) -> String {
 
 // ── Fixture repo ──
 
+#[test]
+fn copilot_discovery_falls_back_to_initialize_and_tools_work() {
+    let repo = fixture_repo();
+    let mut client = McpClient::spawn_with_discovery(repo.path(), true);
+    assert!(client
+        .tools_list()
+        .iter()
+        .any(|tool| tool["name"] == "sem_entities"));
+    let response = client.call_tool("sem_entities", json!({"path": "src/needle.py"}));
+    assert!(tool_text(&response).contains("needle_target_fn"));
+    // Unknown methods must also leave an initialized session usable.
+    let response = client.request("future/extension", json!({}));
+    assert_eq!(response["error"]["code"], -32601);
+    assert!(!client.tools_list().is_empty());
+}
+
 fn git(repo: &Path, args: &[&str]) {
     let status = Command::new("git")
         .current_dir(repo)
```

---

### Incident Patch 13: `a260f75a` (2026-09-27)
**Commit Message**: fix(pi): harden snapshot lifecycle, entity selectors and imports

**File**: `pi/src/codemode/api.ts` (modified, +19/-1)
```diff
@@ -3169,15 +3169,33 @@ async function addImport(file: string, spec: string, deps: SemApiDeps, changes:
       if (lines[i]?.trim() === "import (") {
         goImportBlock = true;
         i++;
-        while (i < lines.length && lines[i]!.trim() !== ")") i++;
+        while (i < lines.length && lines[i]!.trim() !== ")") {
+          // Grouped Go specs are indented, unlike top-level declarations.
+          // Compare the whole spec, including aliases; never confuse a
+          // quoted string in a function body with an existing import.
+          if (lines[i]!.trim() === goSpec) {
+            return { file, line: i + 1, added: false, alreadyPresent: true };
+          }
+          i++;
+        }
         if (i < lines.length) goInsertAt = i;
       } else {
         goInsertAt = i;
+        while (/^import\s+/.test(lines[i]?.trim() ?? "")) {
+          if (lines[i]!.trim().replace(/^import\s+/, "") === goSpec) {
+            return { file, line: i + 1, added: false, alreadyPresent: true };
+          }
+          i++;
+        }
       }
     }
   }
   for (let i = 0; i < lines.length; ) {
     const t = lines[i]!.trim();
+    if (file.endsWith(".java") && /^package\s+[\w.]+\s*;/.test(t)) {
+      lastImportIdx = i++;
+      continue;
+    }
     if (/^#\s*include\b/.test(t)) {
       lastImportIdx = i;
       i++;
```

**File**: `pi/src/transaction/simple/exact-code.mjs` (modified, +12/-2)
```diff
@@ -35,6 +35,7 @@ export function compactSources(sources) {
 // Session-local immutable, explicitly scoped snapshots. Not a whole-repo revision.
 export class ExactCode {
   constructor({semBin='sem', maxBytes=4*1024*1024, maxSnapshots=8}={}) {
+    if(!Number.isSafeInteger(maxSnapshots)||maxSnapshots<1) fail('INVALID_SNAPSHOT_CAPACITY');
     Object.assign(this,{semBin,maxBytes,maxSnapshots}); this.snapshots=new Map();
   }
   async capture(cwd, files, {allowMissing=false}={}) {
@@ -62,7 +63,6 @@ export class ExactCode {
     const manifest=[...sources].map(([file,b])=>({file,sha256:hash(b)}));
     const revision=hash(JSON.stringify([manifest,missing]));
     if(!this.snapshots.has(revision)) {
-      if(this.snapshots.size>=this.maxSnapshots) fail('SNAPSHOT_CAPACITY_REACHED');
       const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sem-exact-'));
       const entities=[];
       try {
@@ -84,10 +84,20 @@ export class ExactCode {
       // Lexical containment only, not receiver/type or runtime resolution.
       qualifyEntities(entities);
       this.snapshots.set(revision,{sources,entities,manifest,...indexEntities(entities)});
+      // Evict only after a successful capture. Failed parsing must not destroy
+      // usable snapshots. IDs remain revision-bound, never redirected.
+      while(this.snapshots.size>this.maxSnapshots) this.snapshots.delete(this.snapshots.keys().next().value);
     }
+    this.get(revision);
     return {revision,files:manifest,missing_files:missing,scope:'explicit_files',coverage:'parser_reported_only',consistency:'captured_file_bytes_not_atomic_repository_snapshot'};
   }
-  get(revision) {return this.snapshots.get(revision)??fail('UNKNOWN_SNAPSHOT');}
+  get(revision) {
+    const snapshot=this.snapshots.get(revision);
+    if(!snapshot) fail('UNKNOWN_SNAPSHOT: missing or expired; recapture files and use returned revision and entity IDs');
+    this.snapshots.delete(revision);
+    this.snapshots.set(revision,snapshot);
+    return snapshot;
+  }
   resolve(revision,name) {
     if(typeof name!=='string'||!name) fail('INVALID_NAME');
     const matches=lookupEntities(this.get(revision),{name});
```

**File**: `pi/src/transaction/simple/exact-code.test.mjs` (modified, +32/-2)
```diff
@@ -5,6 +5,33 @@ import os from 'node:os';
 import path from 'node:path';
 import {ExactCode} from './exact-code.mjs';
 const semBin=process.env.SEM_TEST_BIN || 'sem';
+test('snapshot LRU survives long sessions and failed captures without reusing stale IDs',async()=>{
+  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sem-lru-test-'));
+  try {
+    for(const file of ['a.ts','b.ts','c.ts']) await fs.writeFile(path.join(root,file),'export function value() { return 1; }\n');
+    const api=new ExactCode({semBin,maxSnapshots:2});
+    const a=await api.capture(root,['a.ts']), b=await api.capture(root,['b.ts']);
+    api.query(a.revision,[{file:'a.ts'}]);
+    await api.capture(root,['c.ts']);
+    assert.throws(()=>api.get(b.revision),/expired/);
+    assert.ok(api.get(a.revision));
+    const oldId=api.resolve(a.revision,'value').matches[0].id;
+    const savedBin=api.semBin;
+    api.semBin=path.join(root,'missing-parser');
+    await assert.rejects(api.capture(root,['b.ts']),/ENOENT/);
+    assert.ok(api.get(a.revision));
+    api.semBin=savedBin;
+    for(let n=2;n<=12;n++) {
+      await fs.writeFile(path.join(root,'a.ts'),`export function value() { return ${n}; }\n`);
+      const s=await api.capture(root,['a.ts']);
+      assert.throws(()=>api.read(s.revision,oldId),/UNKNOWN_ENTITY/);
+      assert.ok(api.snapshots.size<=2);
+    }
+    assert.throws(()=>api.prepare(a.revision,[{id:oldId,content:'bad'}]),/expired/);
+    assert.match(await fs.readFile(path.join(root,'a.ts'),'utf8'),/return 12/);
+    for(const maxSnapshots of [0,-1,1.5,NaN]) assert.throws(()=>new ExactCode({maxSnapshots}),/INVALID_SNAPSHOT_CAPACITY/);
+  } finally {await fs.rm(root,{recursive:true,force:true});}
+});
 test('scoped Python methods and missing files resolve without a recovery call',async()=>{
   const root=await fs.mkdtemp(path.join(os.tmpdir(),'sem-scoped-test-'));
   try {
@@ -79,7 +106,10 @@ test('exact snapshot contract against real SEM parser',async()=>{
     await assert.rejects(api.capture(root,['link.ts']),/SYMLINK/);
     await assert.rejects(new ExactCode({semBin,maxBytes:1}).capture(root,['a.ts']),/SCOPE_TOO_LARGE/);
     const limited=new ExactCode({semBin,maxSnapshots:1});
-    await limited.capture(root,['a.ts']);
-    await assert.rejects(limited.capture(root,['b.ts']),/CAPACITY/);
+    const first=await limited.capture(root,['a.ts']);
+    const next=await limited.capture(root,['b.ts']);
+    assert.equal(limited.snapshots.size,1);
+    assert.throws(()=>limited.get(first.revision),/expired.*recapture/);
+    assert.equal(limited.query(next.revision,[{file:'b.ts'}]).files[0].content,source);
   } finally {await fs.rm(root,{recursive:true,force:true});}
 });
```

**File**: `pi/src/transaction/simple/plan-policy.mjs` (modified, +6/-0)
```diff
@@ -58,6 +58,12 @@ export function compactDefinition(definition) {
   if (related?.length) result.related = related;
   if (result.entity) {
     result.entity = {...result.entity};
+    // Expose the same field name accepted by edit selectors, rather than
+    // making the model translate (and sometimes invent) a language kind.
+    if (result.entity.type !== undefined && result.entity.entity_type === undefined) {
+      result.entity.entity_type = result.entity.type;
+      delete result.entity.type;
+    }
     if (result.entity.file === result.file) delete result.entity.file;
     if (result.entity.parent_name === null) delete result.entity.parent_name;
   }
```

**File**: `pi/src/transaction/simple/plan-policy.test.mjs` (modified, +8/-0)
```diff
@@ -1,6 +1,14 @@
 import { test } from 'node:test';
 import assert from 'node:assert/strict';
 import { boundedInteger, inScope, candidatePage, MAX_PLAN_CALLS, focusedCheck, compactEditReceipt, packDefinitions, compactDefinition } from './plan-policy.mjs';
+test('definition kinds use the edit selector vocabulary without inventing language kinds', () => {
+  const original = {file:'a.go', entity:{name:'Backend',type:'type',file:'a.go'}, content:'type Backend interface {}'};
+  const compact = compactDefinition(original);
+  assert.equal(compact.entity.entity_type, 'type');
+  assert.equal(compact.entity.type, undefined);
+  assert.equal(original.entity.type, 'type');
+  assert.equal(compact.content, original.content);
+});
 test('pages expose all ambiguous definitions without gaps', () => {
   const hits = Array.from({length: 23}, (_,i) => i);
   const seen = []; let offset = 0;
```

**File**: `pi/src/transaction/simple/repair-contract.mjs` (modified, +7/-3)
```diff
@@ -2,9 +2,13 @@ import {createHash} from 'node:crypto';
 import fs from 'node:fs/promises';
 import path from 'node:path';
 export function selectEntity(entities, requested) {
-  const sameName=entities.filter(e=>e.name?.toLowerCase()===requested.name.toLowerCase());
-  const candidates=sameName.filter(e=>(!requested.entity_type||e.type===requested.entity_type)
-    &&(!requested.parent_name||e.parent_name?.toLowerCase()===requested.parent_name.toLowerCase()));
+  const exactName=entities.filter(e=>e.name===requested.name);
+  const sameName=exactName.length?exactName:entities.filter(e=>e.name?.toLowerCase()===requested.name.toLowerCase());
+  let candidates=sameName.filter(e=>(!requested.entity_type||e.type===requested.entity_type));
+  if(requested.parent_name) {
+    const exactParent=candidates.filter(e=>e.parent_name===requested.parent_name);
+    candidates=exactParent.length?exactParent:candidates.filter(e=>e.parent_name?.toLowerCase()===requested.parent_name.toLowerCase());
+  }
   const ordinal=requested.ordinal;
   if((ordinal!==undefined&&(!Number.isInteger(ordinal)||ordinal<0||ordinal>=candidates.length))
       ||(ordinal===undefined&&candidates.length!==1)) {
```

**File**: `pi/src/transaction/simple/repair-contract.test.mjs` (modified, +9/-0)
```diff
@@ -5,6 +5,15 @@ import os from 'node:os';
 import path from 'node:path';
 import {createHash} from 'node:crypto';
 import {selectEntity,invalidateChanged,acknowledgeDefinitions} from './repair-contract.mjs';
+test('exact-case names and parents win without weakening type guards',()=>{
+  const entries=[{name:'ProcessState',type:'function'}, {name:'processState',type:'method',parent_name:'ConnectionState'}];
+  assert.equal(selectEntity(entries,{name:'ProcessState'}),entries[0]);
+  assert.equal(selectEntity(entries,{name:'processState'}),entries[1]);
+  assert.throws(()=>selectEntity(entries,{name:'PROCESSSTATE'}),/Ambiguous/);
+  assert.throws(()=>selectEntity(entries,{name:'ProcessState',entity_type:'method'}),/incompatible/);
+  const members=[{name:'run',type:'method',parent_name:'A'},{name:'run',type:'method',parent_name:'a'}];
+  assert.equal(selectEntity(members,{name:'run',parent_name:'a'}),members[1]);
+});
 test('typed selectors never collapse impl into same-name struct',()=>{
   const entries=[{name:'BuildConfig',type:'struct',start_line:1},{name:'BuildConfig',type:'impl',start_line:10}];
   assert.equal(selectEntity(entries,{name:'BuildConfig',entity_type:'impl'}).start_line,10);
```

**File**: `pi/test/codemode/api-add-import.test.ts` (modified, +29/-0)
```diff
@@ -23,6 +23,35 @@ function makeDir(files: Record<string, string>): string {
 
 const api = (dir: string, changes = createChangeLog()) => ({ sem: buildSemApi({ cwd: dir, semBin: "sem", changes }), changes });
 
+test("Go grouped and standalone imports are idempotent with either spec syntax", async () => {
+  for (const declaration of ['import (\n\talias "example.com/lib"\n)', 'import alias "example.com/lib"']) {
+    const original = `package shared\n\n${declaration}\n\nfunc f() {}\n`;
+    const dir = makeDir({ "a.go": original });
+    try {
+      const { sem } = api(dir);
+      for (const spec of ['alias "example.com/lib"', 'import alias "example.com/lib"']) {
+        assert.equal((await sem.addImport("a.go", spec)).alreadyPresent, true);
+        assert.equal(readFileSync(join(dir, "a.go"), "utf8"), original);
+      }
+    } finally { rmSync(dir, { recursive: true, force: true }); }
+  }
+});
+
+test("Java imports follow the package and any existing imports", async () => {
+  for (const existing of ["", "\nimport java.util.List;\n"]) {
+    const dir = makeDir({ "A.java": `// License\npackage example.app;\n${existing}\nclass A {}\n` });
+    try {
+      const { sem } = api(dir);
+      await sem.addImport("A.java", "import java.util.Map;");
+      const content = readFileSync(join(dir, "A.java"), "utf8");
+      assert.ok(content.indexOf("package example.app;") < content.indexOf("import java.util.Map;"));
+      if (existing) assert.ok(content.indexOf("import java.util.List;") < content.indexOf("import java.util.Map;"));
+      assert.ok(content.indexOf("import java.util.Map;") < content.indexOf("class A"));
+      assert.equal((await sem.addImport("A.java", "import java.util.Map;")).alreadyPresent, true);
+    } finally { rmSync(dir, { recursive: true, force: true }); }
+  }
+});
+
 test("adds a Rust mod declaration after existing mods", async () => {
   const dir = makeDir({ "lib.rs": "pub mod alpha;\nmod beta;\n\npub fn x() {}\n" });
   try {
```

---

### Incident Patch 14: `5dd2afec` (2026-09-24)
**Commit Message**: docs: record lazy indexed name freshness fix (#494)

Adds the required Unreleased changelog entry for #493. No code changes.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ All notable changes to sem are documented in this file.
 
 ### Fixed
 
+- **Indexed name lookup sees renames and added definitions in edited files.** `sem find` checks indexed file freshness and reparses changed files on demand, without requiring a whole dependency-graph refresh. Includes TypeScript, Python and Rust regression coverage.
 - **Dart dependency graphs now resolve ordinary calls, constructor-bound receivers and typed parameters.** Callers and refs no longer select a same-named Dart method for a TypeScript receiver (or vice versa); imported class owners take precedence. Persisted graph/query caches are invalidated so upgrades rebuild the affected edges. Fixes #491.
 - **Shared MCP clients keep independent context history and stay bound to their repository.** Concurrent daemon startup is serialized with an OS lock, stale sockets recover after crashes, and handshakes are bounded. Adds `sem mcp --status` for health checks and reproducible lifecycle coverage on macOS and Linux.
 - **Telemetry uploads are no longer rejected by the server.** 0.21.0 removed the install id from the upload payload while the ingest endpoint still required one, so every batch uploaded since then was refused and active-install counts only ever reflected 0.20.0 and older. Uploads now carry `hash(local seed + day number)`, where the seed is generated once, stays on the machine and is never sent, so a batch groups with the rest of that machine's day and with nothing before or after it. Telemetry is still local-by-default and opt-in, so this only changes the contents of an upload that someone enabled with `sem telemetry on`.
```

---

### Incident Patch 15: `c5d253a2` (2026-09-24)
**Commit Message**: fix: resolve renamed definitions without eager graph refresh (#493)

Fix indexed name lookup missing renamed or newly added definitions in
existing files. Check indexed file freshness and re-extract only changed
files for definition queries; do not rebuild dependency topology. Adds
repeated-edit, duplicate-name, TypeScript, Python and Rust coverage.
Validation: 25 CLI integration tests passed across index_membership,
callers_cli, graph_json and multi_query_cli. This is a targeted
correctness fix enabling lazy lookup, not a claim of full incremental
graph maintenance or end-to-end session speedup.

**File**: `crates/sem-cli/src/commands/query.rs` (modified, +30/-6)
```diff
@@ -252,12 +252,10 @@ pub(crate) fn is_file_stale(idx: &QueryIndex, root: &Path, path: &str) -> bool {
 /// *corpus-shaped* index answer needs (: `sem impact --all/--tests`'
 /// transitive walk, `sem graph`'s whole-repo dump, `sem context`'s subgraph).
 ///
-/// The entity-scoped verbs (`find`/`callers`/`refs`/`impact --deps`) get away
-/// with proving only the files their own answer touches, because an edit
-/// anywhere else cannot change *their* answer. A transitive walk has no such
-/// boundary: an edit in a file the walk never visits can add an edge *into*
-/// the closure, so the only honest gate is the one the SQL path already
-/// used — the whole corpus, membership and content both.
+/// Name lookup must also inspect changed files that did not previously match:
+/// an edit can introduce a new name. It repairs definition rows locally rather
+/// than rebuilding topology. A transitive walk additionally needs fresh edges
+/// from the whole corpus, so its gate proves membership and content together.
 ///
 /// - membership: `index::complete_check` (`Complete` tier), which needs
 ///   `DIRS`; an image without it is refused outright rather than trusted,
@@ -368,6 +366,32 @@ fn index_answer_verified(
     let registry = super::create_registry(&opts.cwd);
     let mut defs = resolve_defs(idx, &opts.query, opts.file.as_deref());
 
+    if verb == Verb::Find {
+        use rayon::prelude::*;
+        // A rename or a new declaration in an existing file is absent from
+        // NAMES. Checking only files of existing hits silently misses it.
+        // Stat the indexed corpus, but parse only changed files: no topology
+        // rebuild or whole-graph serialization is needed for definitions.
+        let files = idx.all_file_paths();
+        let stale: Vec<_> = files
+            .par_iter()
+            .copied()
+            .filter(|path| opts.file.as_deref().is_none_or(|file| file == *path))
+            .filter(|path| file_is_stale(idx, root, path))
+            .collect();
+        defs.retain(|entity| !stale.iter().any(|path| entity.file_path == *path));
+        let fresh: Vec<EntityInfo> = stale
+            .par_iter()
+            .flat_map_iter(|path| reextract_file(&registry, root, path))
+            .filter(|entity| matches_query(entity, &opts.query))
+            .collect();
+        defs.extend(fresh);
+        return Some(Answer {
+            defs,
+            related: Vec::new(),
+        });
+    }
+
     // Definition-side freshness: content-local, repaired in place.
     let def_files: Vec<String> = defs.iter().map(|e| e.file_path.clone()).collect();
     for path in dedup(def_files) {
```

**File**: `crates/sem-cli/tests/index_membership.rs` (modified, +78/-0)
```diff
@@ -54,6 +54,84 @@ fn prime_index(repo: &Path, cache: &Path) {
     );
 }
 
+#[test]
+fn find_repairs_renames_and_added_duplicates_without_refresh() {
+    let repo = TempDir::new().unwrap();
+    let cache = TempDir::new().unwrap();
+    fs::write(repo.path().join("a.ts"), "export function original() {}\n").unwrap();
+    fs::write(repo.path().join("b.ts"), "export function existing() {}\n").unwrap();
+    prime_index(repo.path(), cache.path());
+    fs::write(repo.path().join("a.ts"),
+        "export function newlyRenamed() { return 123; }\nexport function existing() { return 456; }\n").unwrap();
+    for (query, expected) in [("newlyRenamed", 1), ("original", 0), ("existing", 2)] {
+        let out = assert_success(
+            sem(repo.path(), cache.path(), &["find", query, "--json"]),
+            query,
+        );
+        let rows: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
+        assert_eq!(
+            rows.as_array().unwrap().len(),
+            expected,
+            "{query}: {}",
+            output_text(&out)
+        );
+    }
+    // A second edit must also be visible; no eager graph refresh is involved.
+    fs::write(
+        repo.path().join("a.ts"),
+        "export function finalNameAfterSecondEdit() {}\n",
+    )
+    .unwrap();
+    let out = assert_success(
+        sem(
+            repo.path(),
+            cache.path(),
+            &["find", "finalNameAfterSecondEdit", "--json"],
+        ),
+        "second edit",
+    );
+    let rows: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
+    assert_eq!(rows.as_array().unwrap().len(), 1);
+}
+
+#[test]
+fn find_repairs_existing_files_across_languages() {
+    for (file, before, after) in [
+        (
+            "a.py",
+            "def old_name():\n    return 1\n",
+            "def newly_added_name():\n    return 123\n",
+        ),
+        (
+            "a.rs",
+            "fn old_name() {}\n",
+            "fn newly_added_name() { let _x = 123; }\n",
+        ),
+    ] {
+        let repo = TempDir::new().unwrap();
+        let cache = TempDir::new().unwrap();
+        fs::write(repo.path().join(file), before).unwrap();
+        prime_index(repo.path(), cache.path());
+        fs::write(repo.path().join(file), after).unwrap();
+        let out = assert_success(
+            sem(
+                repo.path(),
+                cache.path(),
+                &["find", "newly_added_name", "--json"],
+            ),
+            file,
+        );
+        let rows: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
+        assert_eq!(
+            rows.as_array().unwrap().len(),
+            1,
+            "{file}: {}",
+            output_text(&out)
+        );
+        assert_eq!(rows[0]["file"], file);
+    }
+}
+
 /// Wait until `dir`'s mtime has visibly moved past `before` — the POSIX
 /// signal `Complete` freshness leans on: creating,
 /// deleting, or renaming a directory entry bumps the directory's own mtime.
```

#### Recent Merged Pull Requests:
- **PR #508** (2026-10-05): ci: run Windows tests in release and report every failure (@rs545837)
- **PR #507** (2026-10-05): fix(pi): locate addImport's imports with the parser instead of a line scan (@Dev-next-gen)
- **PR #506** (closed): fix(pi): confine addImport's ES supersede to the leading import block (@Dev-next-gen)
- **PR #504** (2026-10-03): feat(pi): report callers a batch leaves behind after signature changes (@rs545837)
- **PR #503** (2026-10-03): perf(pi): reduce repeated source and validation work (@rs545837)
- **PR #501** (2026-10-01): feat(pi): publish explicit-read batched transaction interface (@rs545837)
- **PR #500** (2026-10-01): fix: search unparsed text files and expose search coverage (@rs545837)
- **PR #499** (2026-09-30): fix(pi): preserve overloaded entity targets and recover timed-out checks (@rs545837)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
