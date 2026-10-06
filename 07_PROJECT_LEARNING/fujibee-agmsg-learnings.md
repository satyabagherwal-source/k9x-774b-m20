# Forensic Learning Record (Deep Inspection): fujibee/agmsg

> **Canonical Artifact**: `07_PROJECT_LEARNING/fujibee-agmsg-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fujibee/agmsg](https://github.com/fujibee/agmsg))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:57:41.667Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fujibee/agmsg`
- **Description**: Cross-vendor messaging for CLI AI coding agents — let Claude Code, Codex, Gemini & Copilot talk to each other in one team. Bash + SQLite, no daemon, no framework.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1538 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/src-tauri/src/agent_state.rs`
```
use std::collections::VecDeque;
use std::time::{Duration, Instant};

use serde::Serialize;

pub const TAIL_CAPACITY: usize = 8 * 1024;
pub const DETECTION_INTERVAL: std::time::Duration = std::time::Duration::from_millis(400);
const STARTUP_GRACE: Duration = Duration::from_secs(2);
const IDLE_CONFIRMATIONS: u8 = 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PaneState {
    Idle,
    Working,
    Blocked,
    Unknown,
}

pub struct DetectionTracker {
    agent_type: String,
    state: PaneState,
    created_at: Instant,
    idle_confirmations: u8,
    last_tail: Option<String>,
}

impl DetectionTracker {
    pub fn new(agent_type: String) -> Self {
        Self {
            agent_type,
            state: PaneState::Unknown,
            created_at: Instant::now(),
            idle_confirmations: 0,
            last_tail: None,
        }
    }

    pub fn state(&self) -> PaneState {
        self.state
    }

    pub fn observe(&mut self, tail: &str, now: Instant) -> Option<PaneState> {
        if now.saturating_duration_since(self.created_at) < STARTUP_GRACE {
            return None;
        }

        // Compares the DERIVED text, not a raw byte/push counter: a blinking
        // cursor or other zero-width escape noise still arrives as PTY bytes
        // every tick even while the pane is genuinely idle, so a push-based
        // "did anything arrive" signal never goes quiet and the 3-tick
        // debounce below never got to fire (#385 — panes stuck showing
        // Working forever after the agent actually finished).
        let tail_changed = self.last_tail.as_deref() != Some(tail);
        self.last_tail = Some(tail.to_string());
        let candidate = if tail_changed {
            classify(&self.agent_type, tail)
        } else {
            // A static tail means nothing new happened since last tick:
            // Working debounces down toward Idle below (no more output ==
            // probably done), and every other state — crucially including
            // Idle itself — just holds. Re-running classify() here on an
            // Idle pane's unchanged snapshot was the actual bug: if that
            // frozen frame still had a stale spinner glyph in it (a
            // synchronized-output redraw that stalled mid-animation), it
            // matched Working again immediately, bounced right back to
            // Idle after another 3-tick debounce, and repeated forever.
            match self.state {
                PaneState::Working => PaneState::Idle,
                other => other,
            }
        };
        let next = match (self.state, candidate) {
            (_, PaneState::Blocked) => {
                self.idle_confirmations = 0;
                PaneState::Blocked
            }
            (_, PaneState::Working) => {
                self.idle_confirmations = 0;
                PaneState::Working
            }
            (PaneState::Working, PaneState::Idle) => {
                self.idle_confirmations = self.idle_confirmations.saturating_add(1);
                if self.idle_confirmations < IDLE_CONFIRMATIONS {
                    PaneState::Working
                } else {
                    self.idle_confirmations = 0;
                    PaneState::Idle
                }
            }
            (_, next) => {
                self.idle_confirmations = 0;
                next
            }
        };

        if next == self.state {
            None
        } else {
            self.state = next;
            Some(next)
        }
    }
}

/// The last `n` NON-BLANK lines, in original order — herdr's
/// `bottom_non_empty_lines(n)`, used for grok's footer-hint dialogs below.
/// Unlike the rest of classify()'s substring matching (which runs against
/// the whole ~20-line window), these hints are only meaningful confined to
/// the very bottom of the screen — matching them anywhere in the wider
/// window risks tripping on ordinary scrollback that happens to mention
/// one of the same words (review, #384/grok).
fn bottom_non_empty_lines<'a>(lines: &[&'a str], n: usize) -> Vec<&'a str> {
    let mut result: Vec<&'a str> = lines
        .iter()
        .copied()
        .filter(|line| !line.trim().is_empty())
        .collect();
    if result.len() > n {
        result.drain(..result.len() - n);
    }
    result
}

/// True for grok's Working status line: contains the "[stop]" chip
/// anywhere. Originally required a Braille spinner glyph at the START of
/// the SAME line too (matching herdr's grok.toml, which anchors on that
/// pairing since the startup splash also draws its logo out of Braille
/// characters — a bare glyph alone isn't safe). Dropped after a live
/// capture (#384/grok) showed why: grok's real "thinking" animation
/// redraws several overlapping spinner/counter elements in the same
/// screen region every tick, and our tail buffer is a linear byte stream,
/// not a real 2D screen grid — those redraws interleave into the same
/// captured text rather than each overwriting the last, so the glyph and
/// "[stop]" frequently land nowhere near each other or even on different
/// reconstructed "lines" despite being adjacent on screen. That line-
/// anchored check matched only ~10 of 124 ticks during a real "thinking"
/// stretch; "[stop]" alone, unanchored, matched consistently across long
/// runs in the same capture — the splash-only false positive it was
/// meant to prevent doesn't apply here since the splash never contains
/// "[stop]" at all, so requiring it is still safe on its own.
fn grok_working_line(line: &str) -> bool {
    line.contains("[stop]")
}

// grok's footer-hint dialogs need AND logic and bottom-two-line scoping
// that plain substring matching over the whole flattened tail can't
// express (review, #384/grok) — TailBuffer::detection_tail evaluates
// them against the real, still-line-structured text (before flattening
// loses that structure) and bakes the result into these sentinels, which
// classify() then just treats as two more literal patterns like any other
// agent's. `\u{1}`-wrapped so they can never collide with real screen text.
//
// Covers two of grok's three known dialog shapes, confirmed against
// herdr's grok.toml (fork-herdr/src/detect/manifests/grok.toml) plus real
// Grok Build 0.2.82 observation. NOT covered: the option-select dialog
// (gutter + option key + ●/○ marker on one line, per herdr) — its exact
// on-screen format wasn't available to verify against real output, and
// guessing at it risks the same false-positive/negative class of bug this
// sentinel approach exists to avoid.
const GROK_PERMISSION_DIALOG_SENTINEL: &str = "\u{1}GROK_PERMISSION_DIALOG\u{1}";
const GROK_QUESTION_DIALOG_SENTINEL: &str = "\u{1}GROK_QUESTION_DIALOG\u{1}";
const GROK_WORKING_SENTINEL: &str = "\u{1}GROK_WORKING\u{1}";

pub fn classify(agent_type: &str, tail: &str) -> PaneState {
    if !matches!(
        agent_type,
        "claude-code" | "claude" | "codex" | "gemini" | "grok" | "grok-build"
    ) {
        return PaneState::Unknown;
    }

    const COMMON_BLOCKED: &[&str] = &[
        "Do you want to proceed?",
        "Allow this action?",
        "waiting for approval",
        "Waiting for approval",
        "Enter to confirm",
        "(y/n)",
        "[y/N]",
        "[Y/n]",
        // Generic numbered-choice menus (e.g. the plan-mode-exit conflict
        // dialog) don't say "Do you want to proceed?" at all — confirmed
        // from a live capture, #385 — but they all share this footer
        // regardless of which menu is showing, so it covers the class
        // instead of enumerating every prompt's own wording.
        "Enter to select",
        // Structural fallback for the SAME class of menu, for when even
        // that footer isn't there (confirmed from a live capture, #385: the
        // plan-review "Ready to code?" screen has neither "Do you want to
        // proceed?" nor "Enter to select" — just "Would you like to
        // proceed?" and a numbered list). Every one of these interactive
        // menus opens with its first option pre-selected behind "❯", so
        // matching that marker generalizes across prompt wording we
        // haven't seen yet instead of enumerating each one — the same idea
        // herdr uses for codex's "›" cursor glyph (src/detect/manifest.rs),
        // just applied to claude's own selector character.
        "❯ 1.",
    ];
    const BRAILLE_SPINNERS: &[&str] = &["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    // Claude Code's "thinking" spinner cycles through these sparkle glyphs,
    // not the braille dots above — confirmed from a real capture (#385):
    // "✻i…", "✳…", "✶5", "✢di", "✽n30" all rendering behind a whimsical
    // verb ("Considering…" etc). The braille set never matched claude panes,
    // and "esc to interrupt" doesn't appear in the current CLI build either
    // (checked via `strings` on the installed binary), so Working detection
    // for claude was relying on neither signal actually firing — any tick
    // without a Blocked match fell straight through to Idle mid-generation.
    const CLAUDE_SPINNERS: &[&str] = &["✢", "✳", "✶", "✻", "✽"];
    // Verified against herdr's codex.toml (src/detect/manifests/codex.toml)
    // rather than guessed: "Press enter to continue" and "Do you trust the
    // contents of this directory?" were never real Codex CLI strings (the
    // latter reads like VS Code's workspace-trust dialog, not Codex) and
    // never matched anything.
    const CODEX_BLOCKED: &[&str] = &[
        "Allow command?",
        "enter to submit answer",
        "enter to submit all",
        "press enter to confirm or esc to cancel",
        "[y/n]",
        "yes (y)",
        // Set in the window title, not the screen — TailBuffer::detection_tail
        // appends the last-seen title to the flattened text, so this still
        // matches via the same plain substring ch
```

### Core Architecture Module: `site/src/i18n/utils.js`
```
import en from "./en.js";
import ja from "./ja.js";
import zhCN from "./zh-CN.js";
import zhTW from "./zh-TW.js";
import ko from "./ko.js";
import es from "./es.js";
import fr from "./fr.js";
import de from "./de.js";
import ptBR from "./pt-BR.js";

export const defaultLang = "en";

// Display name shown in the footer language switcher — always in that
// language's own script, so a reader recognizes their language regardless of
// the page's current locale.
export const languages = {
  en: "English",
  ja: "日本語",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  "pt-BR": "Português (Brasil)",
};

const dictionaries = {
  en,
  ja,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ko,
  es,
  fr,
  de,
  "pt-BR": ptBR,
};

export function useTranslations(lang) {
  return dictionaries[lang] ?? dictionaries[defaultLang];
}

// Default locale is unprefixed ("/"); every other locale lives under "/<lang>/".
export function localizedPath(lang, path = "/") {
  return lang === defaultLang ? path : `/${lang}${path}`;
}

```

### Core Architecture Module: `app/poc-inject/src/main.rs`
```
// poc-inject — Phase 0 (c): the strategic core of the agmsg desktop app.
//
// Prove that by OWNING an interactive CLI agent's PTY we can deliver agmsg
// messages with no per-agent bridge: watch agmsg's SQLite DB, and when a new
// message addressed to the watched agent arrives, wait until the agent's PTY
// is at an idle/ready prompt, then write the message into its stdin. The agent
// reacts as if a human typed it. Works for ANY interactive CLI (claude, codex,
// a python REPL, ...) because the mechanism is PTY-level, not agent-specific.
//
// Config via env (all optional):
//   POC_CMD        program to spawn in the PTY        (default: "bash")
//   POC_ARGS       space-split args for POC_CMD       (default: none)
//   POC_QUIET_MS   idle debounce: ms of PTY silence   (default: 700)
//   POC_PROMPT     extra substring the (de-ANSI'd) tail must contain to count
//                  as "ready" (default: none -> debounce alone decides)
//   POC_MAX_WAIT_MS  give up waiting for idle and inject anyway (default: 15000)
//   POC_RUNTIME_MS   kill the child and exit after N ms (default: run forever).
//                    Lets us demo a non-exiting TUI (claude) without a broad kill.
//
//   Message source — pick ONE:
//   POC_DB + POC_TEAM + POC_TO   watch agmsg DB for new rows to POC_TO
//   POC_INJECT                   synthetic: inject this one string after idle
//
// Everything the child prints is mirrored to our stdout so the run log shows
// the agent's TUI and proves it reacted.

use std::io::{Read, Write};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, PtySize};

/// Shared view of the child's recent output, used to decide quiescence.
struct PtyState {
    last_output: Instant,
    /// Tail of recent output with ANSI escapes stripped, capped in size.
    tail: String,
}

impl PtyState {
    fn new() -> Self {
        PtyState { last_output: Instant::now(), tail: String::new() }
    }

    /// Idle = no output for `quiet` AND (if `need` set) the tail ends with it.
    /// Conservative on purpose: a mid-generation agent keeps emitting bytes, so
    /// the debounce alone already blocks injection until it settles.
    fn is_idle(&self, quiet: Duration, need: &Option<String>) -> bool {
        if self.last_output.elapsed() < quiet {
            return false;
        }
        match need {
            None => true,
            Some(s) => self.tail.trim_end().ends_with(s.as_str()),
        }
    }
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()
}

fn log(msg: &str) {
    // Distinct prefix so PoC events stand out amid the mirrored child output.
    eprintln!("\n[poc {}] {}", now_ms(), msg);
}

/// Strip a useful subset of ANSI/VT control sequences so prompt matching and
/// the tail buffer aren't polluted by cursor moves and colors. Operates on raw
/// bytes and keeps multibyte UTF-8 intact (claude's TUI emits box-drawing etc.).
fn strip_ansi(input: &[u8]) -> String {
    let mut out: Vec<u8> = Vec::with_capacity(input.len());
    let mut i = 0;
    while i < input.len() {
        let b = input[i];
        if b == 0x1b {
            // ESC: skip CSI (ESC [ ... final) or OSC (ESC ] ... BEL/ST) etc.
            if i + 1 < input.len() && input[i + 1] == b'[' {
                i += 2;
                while i < input.len() && !(0x40..=0x7e).contains(&input[i]) {
                    i += 1;
                }
                i += 1; // skip the final byte
            } else if i + 1 < input.len() && input[i + 1] == b']' {
                i += 2;
                while i < input.len() && input[i] != 0x07 {
                    i += 1;
                }
                i += 1;
            } else {
                i += 2; // ESC + one byte (e.g. ESC =)
            }
        } else if b == b'\r' {
            i += 1; // drop carriage returns; keep newlines
        } else {
            out.push(b); // keep the raw byte; UTF-8 sequences pass through
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn env(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|s| !s.is_empty())
}

fn main() -> Result<()> {
    let cmd = env("POC_CMD").unwrap_or_else(|| "bash".to_string());
    let args: Vec<String> =
        env("POC_ARGS").map(|s| s.split_whitespace().map(String::from).collect()).unwrap_or_default();
    let quiet = Duration::from_millis(env("POC_QUIET_MS").and_then(|s| s.parse().ok()).unwrap_or(700));
    let max_wait =
        Duration::from_millis(env("POC_MAX_WAIT_MS").and_then(|s| s.parse().ok()).unwrap_or(15_000));
    let runtime = env("POC_RUNTIME_MS").and_then(|s| s.parse::<u64>().ok()).map(Duration::from_millis);
    let need_prompt = env("POC_PROMPT");

    log(&format!(
        "spawning PTY: cmd={cmd:?} args={args:?} quiet={}ms prompt={:?}",
        quiet.as_millis(),
        need_prompt
    ));

    let pty_system = portable_pty::native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows: 30, cols: 100, pixel_width: 0, pixel_height: 0 })
        .context("openpty")?;

    let mut builder = CommandBuilder::new(&cmd);
    for a in &args {
        builder.arg(a);
    }
    builder.env("TERM", "xterm-256color");
    let mut child = pair.slave.spawn_command(builder).context("spawn child")?;
    drop(pair.slave);

    let state = Arc::new(Mutex::new(PtyState::new()));
    let mut reader = pair.master.try_clone_reader().context("clone reader")?;
    let mut writer = pair.master.take_writer().context("take writer")?;

    // Reader thread: mirror child output + update quiescence state.
    {
        let state = Arc::clone(&state);
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            let stdout = std::io::stdout();
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        // mirror raw so the TUI looks right in our terminal/log
                        let mut h = stdout.lock();
                        let _ = h.write_all(&buf[..n]);
                        let _ = h.flush();

                        let clean = strip_ansi(&buf[..n]);
                        let mut st = state.lock().unwrap();
                        st.last_output = Instant::now();
                        st.tail.push_str(&clean);
                        // Cap the tail, cutting only on a UTF-8 char boundary.
                        const CAP: usize = 2048;
                        if st.tail.len() > CAP {
                            let mut cut = st.tail.len() - CAP;
                            while cut < st.tail.len() && !st.tail.is_char_boundary(cut) {
                                cut += 1;
                            }
                            st.tail = st.tail.split_off(cut);
                        }
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Message source -> channel of bodies to inject.
    let (tx, rx): (Sender<String>, Receiver<String>) = channel();
    spawn_message_source(tx)?;

    // Injector: for each pending message, wait for idle then write to stdin.
    let injector = {
        let state = Arc::clone(&state);
        thread::spawn(move || {
            for body in rx {
                log(&format!("message received -> waiting for idle prompt: {body:?}"));
                let started = Instant::now();
                loop {
                    let idle = { state.lock().unwrap().is_idle(quiet, &need_prompt) };
                    if idle {
                        let waited = started.elapsed().as_millis();
                        log(&format!("idle detected after {waited}ms -> INJECTING into stdin"));
                        // Type the text, then submit with a carriage return.
                        if writer.write_all(body.as_bytes()).is_err() {
                            log("write failed (child gone?)");
                            return;
                        }
                        let _ = writer.write_all(b"\r");
                        let _ = writer.flush();
                        log("injected.");
                        break;
                    }
                    if started.elapsed() > max_wait {
                        log("max wait exceeded; injecting anyway (idle never settled)");
                        let _ = writer.write_all(body.as_bytes());
                        let _ = writer.write_all(b"\r");
                        let _ = writer.flush();
                        break;
                    }
                    thread::sleep(Duration::from_millis(50));
                }
            }
        })
    };

    // Poll for child exit (don't block) so a runtime deadline can fire.
    let deadline = runtime.map(|d| Instant::now() + d);
    loop {
        if let Some(status) = child.try_wait().context("try_wait child")? {
            log(&format!("child exited: {status:?}"));
            break;
        }
        if let Some(d) = deadline {
            if Instant::now() >= d {
                log("runtime deadline reached -> killing child");
                let _ = child.kill();
                let _ = child.wait();
                break;
            }
        }
        thread::sleep(Duration::from_millis(100));
    }
    let _ = injector.join();
    Ok(())
}

/// Decide the message source from env and feed bodies into `tx`.
fn spawn_message_source(tx: Sender<String>) -> Result<()> {
    if let Some(text) = env("POC_INJECT") {
        // Synthetic single-shot: fire after a short delay so the child boots.
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(300));
            let _ = tx.send(text);
        });
        return Ok(());
    }

    let (db, team, to) = match (env("POC_DB"), env("POC_T
```

### Core Architecture Module: `app/src-tauri/src/agmsg.rs`
```
// agmsg data access — VIEW-ONLY reader over the agmsg installation.
//
// The desktop app reads agmsg's own SQLite DB and team config directly; it never
// mutates agmsg state here (sending still goes through agmsg's scripts). This
// powers the default "team room": the whole cross-agent conversation as a
// read-only feed, plus the left-hand member list.

use std::path::PathBuf;
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

/// Resolves the user's home directory across platforms. HOME is a POSIX
/// convention — a native Windows GUI process (launched from the Start Menu
/// or a desktop shortcut, not a shell) doesn't have it set at all, silently
/// falling back to "." and resolving every agmsg path relative to whatever
/// the process's cwd happens to be — confirmed on real Windows hardware
/// (agmsg_is_installed()/run_script() both silently checking/using a
/// "./.agents/skills/agmsg" relative to nothing meaningful, sometimes
/// matching a stray leftover directory from an earlier broken run instead
/// of erroring outright). USERPROFILE is Windows' own always-set
/// equivalent, set by the OS itself regardless of what launched the process.
fn home_dir_string() -> Option<String> {
    std::env::var("HOME").ok().or_else(|| std::env::var("USERPROFILE").ok())
}

/// Base dir of the agmsg install (skill layout: db/, teams/, scripts/, ...).
///
/// `AGMSG_APP_BASE`, when set to a non-empty path, overrides the derived
/// location. This is the command layer's injection point — the test harness
/// points it at a temp dir of fake `scripts/*.sh` (mirrors resolve_bash's
/// `AGMSG_APP_BASH` override). In normal operation it is unset and the base is
/// `<home>/.agents/skills/agmsg`.
fn agmsg_base() -> PathBuf {
    if let Ok(over) = std::env::var("AGMSG_APP_BASE") {
        if !over.is_empty() {
            return PathBuf::from(over);
        }
    }
    let home = home_dir_string().unwrap_or_else(|| ".".into());
    PathBuf::from(home).join(".agents/skills/agmsg")
}

/// Converts to the full POSIX form Git Bash/MSYS resolve internally
/// ("C:/Users/name" -> "/c/Users/name"), matching `cygpath -u` — one step
/// further than agmsg-core's own scripts/lib/storage.sh convention
/// (`cygpath -m`'s mixed "C:/Users/..." form). Belt-and-suspenders: the
/// actual bug this was written for turned out to be resolve_bash() picking
/// up the wrong bash.exe entirely (see there), not the path format, but a
/// real Git Bash accepts both forms and going all the way removes any doubt.
/// A standalone string transform (rather than inline in bash_path below) so
/// it's testable on any host platform, not just Windows — its only
/// non-test caller is behind a Windows-only cfg, hence the dead_code
/// allowance on other platforms.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub(crate) fn to_bash_slashes(s: &str) -> String {
    let s = s.strip_prefix(r"\\?\").unwrap_or(s);
    let s = s.replace('\\', "/");
    let bytes = s.as_bytes();
    if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        format!("/{}{}", (bytes[0] as char).to_ascii_lowercase(), &s[2..])
    } else {
        s
    }
}

/// Converts an MSYS/Git-Bash path ("/c/Users/name") back to native Windows
/// form ("C:\\Users\\name") — the inverse of to_bash_slashes. Team
/// registrations on Windows store `project` in MSYS form (every skill script
/// keys identity on Git Bash's $(pwd)), but that string is worthless to a
/// native Win32 API: handed to create_dir_all or a PTY's cwd, Windows resolves
/// the rootless "/c/Users/..." against the current drive and yields the phantom
/// "C:\\c\\Users\\..." — a genuinely different directory, silently created and
/// spawned into, which splits the app-user and its agents into separate teams
/// whose messages never meet (see issue #315). Only the leading "/<drive>"
/// segment is rewritten; anything already native ("C:\\..." / "C:/...") or
/// relative passes through untouched. A standalone string transform so it's
/// testable on any host — its non-test callers (agmsg_join, pty::pty_spawn) are
/// behind Windows-only cfgs, hence the dead_code allowance elsewhere.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub(crate) fn msys_to_native(s: &str) -> String {
    let bytes = s.as_bytes();
    // "/c" or "/c/rest" -> drive letter, but not "/cygdrive/..." or "/home/..."
    // (a multi-char first segment is a real POSIX root, not a drive).
    if bytes.len() >= 2
        && bytes[0] == b'/'
        && bytes[1].is_ascii_alphabetic()
        && (bytes.len() == 2 || bytes[2] == b'/')
    {
        let drive = (bytes[1] as char).to_ascii_uppercase();
        let rest = s[2..].replace('/', "\\");
        format!("{drive}:{rest}")
    } else {
        s.to_string()
    }
}

/// Converts a native path into a form Git Bash on Windows accepts as an
/// argument. Without this, a raw Windows path handed to bash.exe has its
/// backslashes silently eaten by MSYS's argv parsing (backslash is an
/// escape character there) — "C:\Users\x\y.sh" arrives as "C:Usersxy.sh" and
/// bash reports "No such file or directory". Also strips the `\\?\`
/// extended-length prefix Path::canonicalize / Tauri's resource_dir() can
/// return, which bash doesn't understand either. Every path this app hands
/// to bash (install.sh, agmsg-core scripts, ...) must go through this —
/// found in review after first-run install and every agmsg-core script call
/// (join.sh, send.sh, ...) failed identically on real Windows hardware.
#[cfg(target_os = "windows")]
fn bash_path(p: &std::path::Path) -> String {
    to_bash_slashes(&p.to_string_lossy())
}

#[cfg(not(target_os = "windows"))]
fn bash_path(p: &std::path::Path) -> String {
    p.to_string_lossy().into_owned()
}

/// Resolves the actual Git Bash executable rather than trusting PATH to
/// hand back Git Bash for a bare "bash" — Windows 11 ships a WSL bash.exe
/// stub at %LOCALAPPDATA%\Microsoft\WindowsApps\bash.exe that PATH lookup
/// can resolve to ahead of Git Bash, and WSL's bash resolves Windows paths
/// completely differently ("C:/Users/..." doesn't exist there, only
/// "/mnt/c/Users/..."), so every bash invocation failed with a spurious "No
/// such file or directory" despite the target genuinely existing and being
/// runnable via Git Bash's own file association — confirmed on real Windows
/// hardware. Resolution order: an env var override, then deriving from
/// `where git`'s own install root, then the two standard install locations.
#[cfg(target_os = "windows")]
fn resolve_bash() -> Result<PathBuf, String> {
    if let Ok(over) = std::env::var("AGMSG_APP_BASH") {
        if !over.is_empty() && PathBuf::from(&over).is_file() {
            return Ok(PathBuf::from(over));
        }
    }

    let mut where_cmd = std::process::Command::new("where");
    where_cmd.arg("git");
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        where_cmd.creation_flags(CREATE_NO_WINDOW);
    }
    if let Ok(output) = where_cmd.output() {
        if output.status.success() {
            if let Some(first_line) = String::from_utf8_lossy(&output.stdout).lines().next() {
                // git.exe sits at <root>\cmd\git.exe or <root>\bin\git.exe;
                // bash.exe is always at <root>\bin\bash.exe either way.
                if let Some(root) = PathBuf::from(first_line.trim()).parent().and_then(|p| p.parent()) {
                    let candidate = root.join("bin").join("bash.exe");
                    if candidate.is_file() {
                        return Ok(candidate);
                    }
                }
            }
        }
    }

    for candidate in [r"C:\Program Files\Git\bin\bash.exe", r"C:\Program Files (x86)\Git\bin\bash.exe"] {
        let p = PathBuf::from(candidate);
        if p.is_file() {
            return Ok(p);
        }
    }

    Err("Git for Windows (Git Bash) wasn't found. Install it from https://git-scm.com/download/win, then restart the app.".into())
}

#[cfg(not(target_os = "windows"))]
fn resolve_bash() -> Result<PathBuf, String> {
    Ok(PathBuf::from("bash"))
}

/// A bash Command pre-configured for running agmsg-core scripts: resolved
/// via resolve_bash() (not a bare "bash" — see there), --noprofile --norc
/// so it doesn't spend a few seconds sourcing the user's shell profile on
/// every single call (these scripts don't depend on it, on any platform),
/// and on Windows CREATE_NO_WINDOW so spawning it doesn't flash a console
/// window on screen for every command — GUI processes get one by default.
/// Callers add the script path and its args on top of what this returns.
fn bash_command() -> Result<std::process::Command, String> {
    let mut cmd = std::process::Command::new(resolve_bash()?);
    cmd.args(["--noprofile", "--norc"]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    // Explicitly attach the PATH import_login_shell_path() resolved at
    // startup (lib.rs), same reasoning as pty::pty_spawn: don't rely on this
    // child implicitly inheriting the process's own (mutated) environment.
    // No-op on Windows / if the import never ran or failed.
    if let Some(path) = crate::imported_path() {
        cmd.env("PATH", path);
    }
    Ok(cmd)
}

/// Where one team's store is, as agmsg reports it — never as the app guesses.
///
/// The app used to join `db/messages.db` itself, which is why a storage
/// layout change broke it with nothing to notice: a hardcoded path cannot go
/// stale loudly. Asking means the answer follows the layout.
#[derive(Deserialize)]
struct StoreInfo {
    driver: String,
    path: String,
    /// A team that has never been written to has no store yet. Not an error —
    /// it is an empty room.
    e
```

### Core Architecture Module: `app/src-tauri/src/lib.rs`
```
mod agmsg;
mod agent_state;
mod menu_i18n;
mod pty;

use pty::PtyManager;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::menu::{AboutMetadataBuilder, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Wry};

/// The PATH import_login_shell_path() resolved, kept around so every spawn
/// site (pty::pty_spawn, agmsg::bash_command) can attach it to the child
/// process explicitly via .env("PATH", ...) rather than relying on the
/// spawned process implicitly inheriting this process's own (mutated)
/// environment — a real Finder-launch hardware failure persisted even with
/// the process-level std::env::set_var in place, so this makes the
/// propagation explicit instead of trusting inheritance. None on Windows
/// (import_login_shell_path is unix-only) and on unix if the import failed,
/// in which case callers fall back to their own default behavior.
static IMPORTED_PATH: OnceLock<String> = OnceLock::new();

pub(crate) fn imported_path() -> Option<&'static str> {
    IMPORTED_PATH.get().map(|s| s.as_str())
}

/// The native menu's current language (BCP-47 code, e.g. "ja", "zh-CN") —
/// the frontend pushes its i18next language here via `set_menu_language` on
/// startup and on every change, since React's i18n can't reach this
/// Rust-owned window chrome. Defaults to "en" until that first call arrives.
struct MenuLanguage(Mutex<String>);

/// Explicit toggle state for View > Show User Chat. We don't rely on
/// CheckMenuItem flipping its own checked state on click (that's an
/// implementation detail of the underlying menu library and isn't guaranteed),
/// so this is the single source of truth: the handler flips it, pushes it to
/// the checkbox via set_checked, and emits it to the frontend.
struct UserChatVisible(AtomicBool);

/// Same idea as UserChatVisible, for View > Show Team Room — when off, the
/// frontend removes the Team Room tab entirely (not just its content), and
/// falls back to whichever pane tab is active, or an empty-state hint if
/// none exist yet.
struct TeamRoomVisible(AtomicBool);

/// Handles to the View menu's two checkboxes — see make_menu's comment on
/// why these can't just be looked up via app.menu().get(id) each time.
/// Rebuilt (and these Mutexes overwritten) on every set_menu_language call,
/// since that constructs an entirely new Menu with fresh CheckMenuItems.
struct ViewMenuCheckboxes {
    team_room: Mutex<CheckMenuItem<Wry>>,
    user_chat: Mutex<CheckMenuItem<Wry>>,
}

/// Current webview zoom factor (1.0 = 100%). Tauri's WebviewWindow can set
/// the zoom but not read it back, so this is the source of truth the Zoom
/// In/Out/Actual Size menu items adjust and apply via set_zoom.
struct ZoomLevel(Mutex<f64>);

const ZOOM_STEP: f64 = 0.1;
const ZOOM_MIN: f64 = 0.5;
const ZOOM_MAX: f64 = 3.0;

/// Where the zoom level survives a restart — the only bit of window state
/// persisted so far (see App.tsx's LAST_TEAM_KEY for the equivalent on the
/// frontend side, which owns everything else). A flat `{"zoom": 1.2}` file
/// rather than reaching for a config crate — one f64, not worth it yet.
fn zoom_config_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("zoom.json"))
}

fn load_zoom(app: &AppHandle) -> f64 {
    (|| -> Option<f64> {
        let raw = std::fs::read_to_string(zoom_config_path(app)?).ok()?;
        let json: serde_json::Value = serde_json::from_str(&raw).ok()?;
        json.get("zoom")?.as_f64()
    })()
    .unwrap_or(1.0)
    .clamp(ZOOM_MIN, ZOOM_MAX)
}

fn save_zoom(app: &AppHandle, zoom: f64) {
    let Some(path) = zoom_config_path(app) else { return };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(path, serde_json::json!({ "zoom": zoom }).to_string());
}

/// Replaces this process's own PATH with the one the user's login shell
/// resolves — a Finder/LaunchServices-launched GUI app gets the OS's
/// minimal default PATH, missing anything the shell profile adds (Homebrew,
/// ~/.claude/local, nvm, etc.), so every agent spawn (pty::pty_spawn) fails
/// with "not found in PATH" despite working fine from a terminal-launched
/// `tauri dev`, which inherits the terminal's own full PATH. Must run
/// before anything could spawn a pane. Windows doesn't have this problem
/// (PATH comes from the registry regardless of launch method), so this is
/// only ever called under cfg(unix).
///
/// Runs the shell with -i (interactive) as well as -l (login): some PATH
/// setups (e.g. nvm) only run in .zshrc/.bashrc, which plain -l wouldn't
/// source. An interactive shell can print other things to stdout first
/// (MOTD, prompts) — wrapping the $PATH readout in unique markers and
/// extracting just what's between them keeps that noise from corrupting it.
#[cfg(unix)]
fn import_login_shell_path() {
    const START: &str = "__AGMSG_PATH_START__";
    const END: &str = "__AGMSG_PATH_END__";
    let shell = resolve_login_shell();
    log_path_import(&format!("resolved login shell: {shell}"));
    let script = format!("printf '{START}%s{END}' \"$PATH\"");
    let output = match std::process::Command::new(&shell).args(["-ilc", &script]).output() {
        Ok(o) => o,
        Err(e) => {
            let msg = format!("couldn't run login shell ({shell}) to import PATH: {e}");
            eprintln!("warning: {msg}");
            log_path_import(&msg);
            return;
        }
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    // Look for END strictly after START, not just anywhere in stdout — shell
    // startup noise printing the literal END text before our own marker
    // output would otherwise false-match against it.
    let parsed = stdout.find(START).and_then(|s| {
        let after_start = s + START.len();
        stdout[after_start..].find(END).map(|e| &stdout[after_start..after_start + e])
    });
    match parsed {
        Some(path) if !path.is_empty() => {
            log_path_import(&format!("imported PATH: {path}"));
            std::env::set_var("PATH", path);
            let _ = IMPORTED_PATH.set(path.to_string());
        }
        _ => {
            let msg = format!(
                "couldn't parse login shell PATH output from {shell} (stdout: {:?})",
                stdout.trim()
            );
            eprintln!("warning: {msg}");
            log_path_import(&msg);
        }
    }
}

/// Resolves the user's login shell for import_login_shell_path() above.
/// $SHELL isn't reliably set for a Finder/LaunchServices-launched GUI
/// process — confirmed on real hardware: present in the same user's
/// Terminal session, absent (or stale) when the app itself is launched via
/// Finder. `dscl` asks Directory Services directly for the account's
/// configured shell, independent of whatever this process's own
/// environment happens to have inherited. /bin/zsh (macOS's default shell
/// since Catalina) is the last-resort fallback if even that comes up empty.
#[cfg(unix)]
fn resolve_login_shell() -> String {
    if let Ok(s) = std::env::var("SHELL") {
        if !s.is_empty() {
            return s;
        }
    }
    let user = std::env::var("USER").unwrap_or_default();
    if !user.is_empty() {
        if let Ok(output) =
            std::process::Command::new("dscl").args([".", "-read", &format!("/Users/{user}"), "UserShell"]).output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                if let Some(shell) = text.trim().strip_prefix("UserShell: ") {
                    if !shell.is_empty() {
                        return shell.to_string();
                    }
                }
            }
        }
    }
    "/bin/zsh".into()
}

/// What to spawn for the free-shell tab (App.tsx's "+" tab and a tab's "Open
/// shell" menu item, unattached to any agent). `args` carries login+
/// interactive flags on unix so the shell sources the user's profile
/// (aliases, PATH additions, prompt) the same way a real terminal window
/// would — plain PTY attachment alone doesn't imply that, since e.g. zsh
/// only treats stdin-is-a-tty as sufficient for *interactive*, not *login*.
/// `home` is the frontend's cwd fallback when the current team has no
/// project dir configured — the frontend's own default-project value always
/// wins when set (cd'ing from $HOME every time is tedious), this is
/// only reached when that's empty. A login shell doesn't cd to $HOME on its
/// own; that's a real terminal app's spawn-time cwd, not shell behavior.
#[derive(Serialize)]
pub struct LoginShellInfo {
    cmd: String,
    args: Vec<String>,
    home: String,
}

#[tauri::command]
fn login_shell() -> LoginShellInfo {
    #[cfg(unix)]
    {
        LoginShellInfo {
            cmd: resolve_login_shell(),
            args: vec!["-il".into()],
            home: std::env::var("HOME").unwrap_or_default(),
        }
    }
    #[cfg(windows)]
    {
        let comspec = std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".into());
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        LoginShellInfo { cmd: comspec, args: vec![], home }
    }
}

/// Appends a timestamped line to ~/Library/Logs/agmsg/path-import.log. The
/// only real diagnostic available for import_login_shell_path(): it runs
/// before the webview (and thus DevTools) exists, and its failure mode was
/// otherwise silent — a prior Finder-launch gate failure took a slow
/// back-and-forth to root-cause because all it did on failure was warn to
/// stderr, which nothing launched from Finder is around to see.
#[cfg(unix)]
fn log_path_import(message: &str) {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    let dir = std::path::PathBuf::from(home).join("Library/Logs/agmsg");
    if std::fs::create_dir_all(&dir).is_err() {
    
```

### Core Architecture Module: `app/src-tauri/src/main.rs`
```
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    agmsg_app_lib::run()
}

```

### Core Architecture Module: `app/src-tauri/src/menu_i18n.rs`
```
use serde_json::Value;

/// Native-menu and update-dialog strings, embedded from the SAME locale
/// files the React UI uses (app/src/i18n/locales/*.json) — one source of
/// truth for translations, read here at compile time so the Rust-side
/// window chrome (which React's i18n can't reach) matches the language the
/// user picked in Settings instead of silently following the OS locale.
const LOCALES: &[(&str, &str)] = &[
    ("en", include_str!("../../src/i18n/locales/en.json")),
    ("ja", include_str!("../../src/i18n/locales/ja.json")),
    ("zh-CN", include_str!("../../src/i18n/locales/zh-CN.json")),
    ("zh-TW", include_str!("../../src/i18n/locales/zh-TW.json")),
    ("ko", include_str!("../../src/i18n/locales/ko.json")),
    ("es", include_str!("../../src/i18n/locales/es.json")),
    ("fr", include_str!("../../src/i18n/locales/fr.json")),
    ("de", include_str!("../../src/i18n/locales/de.json")),
    ("pt-BR", include_str!("../../src/i18n/locales/pt-BR.json")),
];

fn locale_json(lang: &str) -> &'static Value {
    use std::sync::OnceLock;
    static PARSED: OnceLock<Vec<(&'static str, Value)>> = OnceLock::new();
    let parsed = PARSED.get_or_init(|| {
        LOCALES
            .iter()
            .map(|(code, raw)| (*code, serde_json::from_str(raw).expect("locale JSON is valid (checked in CI/tests)")))
            .collect()
    });
    parsed
        .iter()
        .find(|(code, _)| *code == lang)
        .or_else(|| parsed.iter().find(|(code, _)| *code == "en"))
        .map(|(_, v)| v)
        .expect("en.json is always present")
}

/// Look up `section.key` (e.g. "nativeMenu.about") for `lang`, falling back
/// to English if the key or language is missing. `{{var}}` placeholders are
/// substituted from `vars` (simple string replace — no templating engine
/// needed for this small, known-shape set of strings).
pub fn t(lang: &str, section: &str, key: &str, vars: &[(&str, &str)]) -> String {
    let lookup = |l: &str| -> Option<String> {
        locale_json(l).get(section)?.get(key)?.as_str().map(String::from)
    };
    let mut s = lookup(lang).or_else(|| lookup("en")).unwrap_or_else(|| format!("{section}.{key}"));
    for (name, value) in vars {
        s = s.replace(&format!("{{{{{name}}}}}"), value);
    }
    s
}

```

### Core Architecture Module: `app/src-tauri/src/pty.rs`
```
// PTY session manager — the terminal-embedded core of the agmsg desktop app.
//
// The app OWNS each spawned agent's pseudo-terminal: it spawns the agent in a
// real PTY (so full TUIs render), streams output to the webview (xterm.js),
// forwards keystrokes back, and — the strategic bit — can INJECT an agmsg
// message straight into the agent's stdin. That injection is agent-agnostic:
// it works for any interactive CLI because it operates at the PTY layer, not
// via a per-agent bridge. Proven in poc-inject/.
//
// pty_inject used to wait for the PTY to go quiet before writing, on the
// theory that writing mid-generation could corrupt an in-flight response.
// Real-world testing (see conversation history) showed the opposite problem
// dominates: claude Code's multi-session launcher UI redraws a spinner
// nonstop even when otherwise idle, so the quiet-period never arrived and
// injection always hit the forced-timeout path — mid-spin, where the
// trailing Enter wasn't reliably registered as "submit". Every agent type
// tested handles a fresh task line as a new queued item regardless of
// whatever else is in flight, so there's nothing to wait for: inject writes
// immediately.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use base64::Engine;
use portable_pty::{CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::agent_state::{DetectionTracker, PaneState, TailBuffer, DETECTION_INTERVAL};

/// One live PTY-backed agent terminal.
struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    /// Child process id, so closing a pane can actually terminate the agent
    /// (and let its SessionEnd hook release the agmsg actas lock).
    pid: Option<u32>,
    tail: Arc<Mutex<TailBuffer>>,
    detection: Arc<Mutex<DetectionTracker>>,
}

/// All live sessions, keyed by a frontend-chosen id (e.g. "claude-1").
/// `Arc` so the idle-wait injector thread can share the map without unsafe.
#[derive(Default)]
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn start_detection_tick(&self, app: AppHandle) {
        let sessions = Arc::clone(&self.sessions);
        thread::spawn(move || loop {
            thread::sleep(DETECTION_INTERVAL);
            let snapshots: Vec<(String, Arc<Mutex<TailBuffer>>, Arc<Mutex<DetectionTracker>>)> = sessions
                .lock()
                .unwrap()
                .iter()
                .map(|(id, session)| {
                    (id.clone(), Arc::clone(&session.tail), Arc::clone(&session.detection))
                })
                .collect();
            let now = std::time::Instant::now();
            for (id, tail, detection) in snapshots {
                let tail = tail.lock().unwrap().detection_tail();
                if let Some(state) = detection.lock().unwrap().observe(&tail, now) {
                    let _ = app.emit("agent-state", AgentStateEvent { id, state });
                }
            }
        });
    }
}

#[derive(Clone, Serialize)]
struct AgentStateEvent {
    id: String,
    state: PaneState,
}

#[derive(Clone, Serialize)]
struct OutputEvent {
    id: String,
    /// base64 of the raw PTY bytes (keeps multibyte/escape sequences intact).
    b64: String,
}

#[derive(Clone, Serialize)]
struct ExitEvent {
    id: String,
}

/// Windows-only: turn a spawn cwd from a team registration (MSYS form,
/// /c/Users/...) into a native path, and refuse it if it isn't a real directory.
/// CreateProcessW resolves a rootless /c/Users/... against the current drive ->
/// the phantom C:\c\Users\... dir; the agent then boots there, its own $(pwd)
/// matches no registration, and it splits into a phantom team whose messages
/// never reach the app (#315). Erroring (instead of booting into a mangled dir)
/// surfaces in the terminal pane via the frontend's failed-spawn handler. Split
/// out from pty_spawn so it's unit-testable without a Tauri AppHandle.
#[cfg(target_os = "windows")]
fn resolve_windows_cwd(dir: &str) -> Result<String, String> {
    let native = crate::agmsg::msys_to_native(dir);
    if !std::path::Path::new(&native).is_dir() {
        return Err(format!(
            "agent working directory doesn't exist: {native} (from registration \
             path {dir}). Re-add the agent so its project points at a real folder."
        ));
    }
    Ok(native)
}

/// On Windows a bare agent CLI name can't be handed to CreateProcessW directly:
/// npm installs an extensionless POSIX shim ("claude") next to "claude.cmd", and
/// portable-pty's search_path prefers the exact extensionless match — so the
/// shell script reaches CreateProcessW and fails with os error 193 ("not a valid
/// Win32 application"), issues #314 / #313 (claude leg). A Store-installed
/// "codex" is worse: a WindowsApps execution alias (a 0-byte reparse point) that
/// only resolves when invoked *by name* through a shell, so a direct full-path
/// spawn fails os error 2 — #313 (codex leg). Routing the launch through
/// `cmd.exe /d /c <name> <args>` hands name resolution to cmd, which honors
/// PATHEXT and execution aliases and fixes both.
///
/// Quoting: cmd only strips the outer quote pair when the command string
/// *begins* with a quote. The agent name has no spaces so portable-pty leaves it
/// unquoted, the string begins with the name's first letter, cmd's strip rule
/// never fires — and a space-bearing arg like "/agmsg actas Ami" survives as a
/// single token addressed to the agent. `/d` skips any user AutoRun so a stray
/// registry command can't corrupt the launch. Standalone (not inlined) so it's
/// unit-testable on any host; its only caller is behind a Windows cfg, hence the
/// dead_code allowance elsewhere.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn windows_shell_argv(cmd: &str, args: &[String]) -> Vec<String> {
    let mut argv = vec!["/d".to_string(), "/c".to_string(), cmd.to_string()];
    argv.extend(args.iter().cloned());
    argv
}

/// Spawn `cmd args` in a fresh PTY and stream its output to the webview as
/// `pty-output` events. Stores the session under `id`.
#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    manager: State<'_, PtyManager>,
    id: String,
    cmd: String,
    args: Vec<String>,
    cwd: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<(), String> {
    let pty_system = portable_pty::native_pty_system();
    let size = PtySize {
        rows: rows.unwrap_or(30),
        cols: cols.unwrap_or(100),
        pixel_width: 0,
        pixel_height: 0,
    };
    let pair = pty_system.openpty(size).map_err(|e| e.to_string())?;

    // On Windows, launch the agent through cmd.exe so PATHEXT / execution-alias
    // resolution happens (see windows_shell_argv); elsewhere spawn it directly.
    #[cfg(target_os = "windows")]
    let mut builder = {
        let comspec = std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string());
        let mut b = CommandBuilder::new(comspec);
        for a in windows_shell_argv(&cmd, &args) {
            b.arg(a);
        }
        b
    };
    #[cfg(not(target_os = "windows"))]
    let mut builder = {
        let mut b = CommandBuilder::new(&cmd);
        for a in &args {
            b.arg(a);
        }
        b
    };
    if let Some(dir) = &cwd {
        #[cfg(target_os = "windows")]
        builder.cwd(resolve_windows_cwd(dir)?);
        #[cfg(not(target_os = "windows"))]
        builder.cwd(dir);
    }
    builder.env("TERM", "xterm-256color");
    // Explicitly set PATH from what import_login_shell_path() resolved at
    // startup (lib.rs) rather than relying on this child implicitly
    // inheriting the process's own (mutated) environment — a real
    // Finder-launch hardware gate still failed to find `claude`/`codex` even
    // after that process-level import, so this removes any dependence on
    // environment-inheritance behavior we can't fully control. No-op (falls
    // back to whatever this process's own PATH already is) if the import
    // never ran or failed, e.g. on Windows or if the login shell couldn't be
    // queried.
    if let Some(path) = crate::imported_path() {
        builder.env("PATH", path);
    }

    let mut child = pair.slave.spawn_command(builder).map_err(|e| e.to_string())?;
    drop(pair.slave);
    let pid = child.process_id();

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let tail = Arc::new(Mutex::new(TailBuffer::default()));
    let agent_type = std::path::Path::new(&cmd)
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or(&cmd)
        .to_ascii_lowercase();
    let detection = Arc::new(Mutex::new(DetectionTracker::new(agent_type)));

    // Reader thread: stream output to the webview.
    {
        let app = app.clone();
        let id = id.clone();
        let reader_tail = Arc::clone(&tail);
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        reader_tail.lock().unwrap().push(&buf[..n]);
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                        let _ = app.emit("pty-output", OutputEvent { id: id.clone(), b64 });
                    }
                    Err(_) => break,
                }
            }
            // Reap the child and notify the webview the pane is gone.
            let _ = child.wait();
            let _ = app.emit("pty-exit", ExitEvent { id: id.clone() });
        });
    }

    manager.sessions.lock().unwrap().insert(
        id,
        PtySession { master: pair.master, writer, pid, tail, detectio
```

### Core Architecture Module: `app/src/App.tsx`
```
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Maximize2,
  Minimize2,
  Minus,
  PanelLeftClose,
  Plus,
  RectangleHorizontal,
  Settings,
  Users,
} from "lucide-react";
import { TerminalPane } from "./TerminalPane";
import { aggregateTeamStatus, applyStateChange, type PaneStatusMap, type RawState } from "./agentStatus";
import { AUTO_TIMEZONE, formatMessageTime, isValidTimeZone, resolveTimeZone } from "./time";
import {
  AgentModal,
  AppUserModal,
  ConfirmModal,
  DeleteTeamModal,
  MAX_TERMINAL_FONT_SIZE,
  MIN_TERMINAL_FONT_SIZE,
  NewTeamModal,
  RenameModal,
  SettingsModal,
} from "./modals";
import {
  applyAtPath,
  classifyDrop,
  clampRatio,
  collectDividers,
  computeRects,
  dividerDragKey,
  insertAsNewLeaf,
  insertBeside,
  leaves,
  presetTree,
  renameLeaf,
  sameZone,
  spliceOutLeaf,
  swapLeaves,
  transposeGrid,
  updateRatioAtPath,
  type DividerInfo,
  type DropSide,
  type PaneRect,
  type SplitNode,
} from "./paneTree";
import { PulseDot } from "./pulseSync";
import { RailAvatar, SidebarUser } from "./SidebarUser";
import { resolveActiveTab } from "./tabMemory";
import "./App.css";

export type Member = { name: string; types: string[]; project: string };
type Message = {
  // Opaque. api.sh's contract: "Every id (message ids included) is a JSON
  // string, never a bare number." Event-log ids are UUIDs; only the legacy
  // table's were integers. Used as a React key and as the paging cursor,
  // neither of which needs it to be ordered or numeric.
  id: string;
  team: string;
  from: string;
  to: string;
  body: string;
  created_at: string;
};
export type Pane = {
  id: string;
  label: string;
  cmd: string;
  args: string[];
  cwd?: string;
  /** True only when this pane's type self-delivers agmsg messages (manifest
   *  monitor=yes) — the app must NOT also inject there (double-delivery).
   *  False for actas-booted types with no monitor of their own (codex,
   *  grok-build, hermes, ...): the app's stdin-inject IS their only delivery. */
  native: boolean;
  /** A free login shell (the "+" tab, or a tab's "Open shell" context menu
   *  item) — unattached to any agent. Drives the sidebar-click "spawn beside
   *  the shell instead of a new tab" behavior below: it has to be an
   *  explicit flag rather than inferred from `cmd`, since `cmd` is
   *  whatever login_shell resolved (zsh/bash/fish/...), not a fixed string. */
  shell?: boolean;
};
// A tab. Holds one or more panes, arranged as a binary split tree (see
// paneTree.ts) — draggable dividers and directional split/swap drag-drop
// (issue #317) both need real nested structure, which a flat list + layout
// enum couldn't represent (see the design doc on that issue for why).
export type Window = {
  id: string;
  root: SplitNode;
  /** User-set tab name (Rename); falls back to the joined pane labels. */
  customLabel?: string;
  /** The team this tab was spawned under. Agents can't message across
   *  teams, so a window's tab set is scoped to one team — showing another
   *  team's tabs alongside it would imply cross-team messaging works when
   *  it doesn't. Windows for other teams stay mounted (PTYs alive) but
   *  hidden until that team is selected again. */
  team: string;
};
// The three canonical arrangements offered from the right-click Layout
// submenu and the native View > Pane Layout menu. Picking one is a one-shot
// RESET (presetTree in paneTree.ts) — it discards whatever manual divider
// drags or split-drops produced and rebuilds a fresh tree matching the
// preset; it is NOT a persisted mode the window stays locked into.
type PaneLayout = "vertical" | "horizontal" | "tile";
// What Rust's login_shell resolved (see lib.rs) — the user's actual login
// shell binary plus the flags to make it behave like one (source profile,
// interactive prompt), for the free-shell "+" tab. `home` is the $HOME
// fallback used when the current team has no project dir configured.
export type LoginShellInfo = { cmd: string; args: string[]; home: string };

// Builds a free-shell Pane from Rust's resolved login shell — or null if
// it hasn't resolved (yet, or ever). Deliberately has NO "bash" guess-
// fallback: an earlier version defaulted to bash when `info` was still
// unresolved, which raced the mount-effect fetch (app just launched, user
// immediately hits "+") — broken on Windows (no bash), and not the user's
// actual login shell even on unix (review, PR #431). Pure so the
// no-fallback contract is unit-testable without mounting the app.
export function shellPaneFrom(info: LoginShellInfo | null, id: string, label: string, cwd: string | undefined): Pane | null {
  if (!info) return null;
  return { id, label, cmd: info.cmd, args: info.args, cwd, native: false, shell: true };
}

// Whether openShellTab's new window should still be committed after its
// getLoginShell await — false if the user switched teams while it was in
// flight. Committing anyway would silently add a window under the stale
// team (hidden — only the current team's windows render) while `active`
// pointed at it (#431).
export function shellTabStillValid(currentTeam: string, requestedTeam: string): boolean {
  return currentTeam === requestedTeam;
}

// Whether openShellInWindow's target tab is still a valid split target
// after its getLoginShell await — false if the user closed it (no window
// references it, and `active` would point at a nonexistent id), OR just
// switched teams while it was in flight: the target window can still exist
// but now belong to the team the user navigated away from, in which case
// splitting into it and setting `active` there produces the same
// hidden-active bug openShellTab's shellTabStillValid guards against — a
// window's `team` never changes after creation, so if the current team no
// longer matches `requestedTeam` the window can't be a live tab regardless
// of whether it's still present in `windows` (#431).
export function shellSplitStillValid(
  windows: ReadonlyArray<Pick<Window, "id" | "team">>,
  windowId: string,
  currentTeam: string,
  requestedTeam: string,
): boolean {
  if (currentTeam !== requestedTeam) return false;
  return windows.some((w) => w.id === windowId && w.team === requestedTeam);
}

// A window's `team` never changes after creation (see Window's own doc) —
// EXCEPT that renaming the team itself must repoint every one of its
// existing tabs at the new name, or the sidebar (which only ever renders
// `w.team === team` for the CURRENT, now-renamed team) hides them: the PTYs
// stay alive, but their tabs vanish from the tab bar with no way back to
// them short of a restart. Pure so onRenameTeam's rekeying is
// unit-testable without mounting the app or a real Tauri backend.
export function renameTeamInWindows<T extends Pick<Window, "team">>(
  windows: readonly T[],
  oldTeam: string,
  newTeam: string,
): T[] {
  return windows.map((w) => (w.team === oldTeam ? { ...w, team: newTeam } : w));
}

// Moves one team-keyed entry to its new key, leaving every other entry
// untouched — used for lastActiveTabByTeam (below) and any other bit of
// state keyed by team name a rename needs to follow. A no-op (same
// reference back) when oldTeam never had an entry, so callers can apply it
// unconditionally without a guard of their own.
export function renameTeamKey<T>(
  byTeam: Readonly<Record<string, T>>,
  oldTeam: string,
  newTeam: string,
): Record<string, T> {
  if (!(oldTeam in byTeam)) return byTeam;
  const { [oldTeam]: value, ...rest } = byTeam;
  return { ...rest, [newTeam]: value as T };
}

// C0 control characters (\u0000-\u001f) and DEL (\u007f) — legal in a
// macOS/Linux filename, but this string is about to be written straight
// into a PTY as literal input. A newline in a filename would submit
// whatever's currently on the target prompt the instant the file is
// dropped; ESC-prefixed bytes are terminal control sequences, not text.
// The whole drop is rejected rather than stripping the offending bytes:
// stripping would silently turn the dropped path into a DIFFERENT, wrong
// path instead of the one actually dropped (review, PR #481).
const DROP_PATH_CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/;

export function hasUnsafeDropPath(paths: string[]): boolean {
  return paths.some((p) => DROP_PATH_CONTROL_CHAR_RE.test(p));
}

// Multiple dropped files become one space-separated line of bare paths, or
// null if any of them fails the control-character check above (the whole
// drop is rejected, not just the unsafe path — see its doc). Deliberately
// NOT shell-quoted: the target of a drop is almost always an agent CLI's
// own prompt line (the framing — "same as cc/codex"), not a literal
// shell command, and quoting broke path recognition there in live testing
// — Claude Code's own file-path heuristic doesn't match a quote-wrapped
// string, it just reads as plain text (Codex tolerated quotes fine, but
// the common case has to work for both).
export function joinDroppedPaths(paths: string[]): string | null {
  if (hasUnsafeDropPath(paths)) return null;
  return paths.join(" ");
}

// Which pane, if any, a dropped file should land in when it didn't land on
// any specific pane cell (dropped on the sidebar, tab bar, Team Room, ...)
// — the active tab's actually-focused pane if it has one, else its first
// pane, per the spec ("when it cannot be determined, fall back to active" — a follow-up
// live-testing feedback: prefer the focused pane specifically, not just
// whichever leaf happens to be first in the tree). A pane found directly
// under the cursor is always already in the active window (inactive
// windows' panes are display:none — see the s
```

### Core Architecture Module: `app/src/SidebarUser.tsx`
```
import { Settings } from "lucide-react";

// The bits of the sidebar that show the current team's app-user (#1510).
//
// They are components of their own, with the "is there an app-user?" decision
// INSIDE them, so a test can render them and look at the markup. When that
// decision was an `{appUser && ...}` wrapped around JSX in App.tsx, nothing
// short of rendering the whole app could tell whether the block was still
// there for a team without an app-user -- and a unit test of the decision
// alone would keep passing if the wrapper came back.

// Just the slice of react-i18next's `t` these use, so a test can pass a
// trivial stand-in instead of initialising i18next.
export type Translate = (key: string, options?: { team?: string }) => string;

// What the bottom block shows for the current team. The block also carries
// the settings gear, and settings are app-wide, so it is never hidden -- it
// used to be gated on the team having an app-user, which took the gear away
// in every team without one (a team joined through remote sync, say) and left
// no way to reach settings from there. Only the identity line varies: the
// app-user's name; a prompt to add one; or nothing, when no team is selected
// at all (there is nothing to add an app-user to).
export type SidebarUserBlock =
  | { kind: "user"; name: string }
  | { kind: "none" }
  | { kind: "no-team" };

export function sidebarUserBlock(appUser: string, team: string): SidebarUserBlock {
  if (appUser) return { kind: "user", name: appUser };
  return team ? { kind: "none" } : { kind: "no-team" };
}

function identityTitle(block: SidebarUserBlock, team: string, t: Translate): string | undefined {
  if (block.kind === "user") return t("sidebar.user.title", { team });
  if (block.kind === "none") return t("sidebar.user.none");
  return undefined;
}

// The expanded sidebar's footer: identity line + the settings gear. The gear
// is unconditional.
export function SidebarUser({
  appUser,
  team,
  t,
  onAddUser,
  onOpenSettings,
}: {
  appUser: string;
  team: string;
  t: Translate;
  onAddUser: () => void;
  onOpenSettings: () => void;
}) {
  const block = sidebarUserBlock(appUser, team);
  return (
    <div className="sidebar-user" title={identityTitle(block, team, t)}>
      {block.kind === "user" && (
        <>
          <span className="avatar" />
          <div className="su-meta">
            <span className="su-name">{block.name}</span>
            <span className="su-team">{team}</span>
          </div>
        </>
      )}
      {block.kind === "none" && (
        <>
          <span className="avatar" />
          <div className="su-meta">
            <span className="su-none">{t("sidebar.user.none")}</span>
            <button className="link su-add" onClick={onAddUser}>
              {t("sidebar.user.add")}
            </button>
          </div>
        </>
      )}
      <button
        className="settings-btn"
        title={t("settings.title")}
        onClick={(e) => {
          e.stopPropagation();
          onOpenSettings();
        }}
      >
        <Settings size={15} />
      </button>
    </div>
  );
}

// The collapsed rail's avatar button (it expands the sidebar). Always
// rendered; only its tooltip depends on the app-user.
export function RailAvatar({
  appUser,
  team,
  t,
  onExpand,
}: {
  appUser: string;
  team: string;
  t: Translate;
  onExpand: () => void;
}) {
  const block = sidebarUserBlock(appUser, team);
  return (
    <button className="rail-avatar-btn" title={t("sidebar.expand")} onClick={onExpand}>
      <span className="avatar" title={identityTitle(block, team, t)} />
    </button>
  );
}

```

### Core Architecture Module: `app/src/TerminalPane.tsx`
```
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createWriteBatcher } from "./writeBatcher";
import { attachWebglAddon } from "./webglAttach";

type Props = {
  /** Stable session id; also the key the backend stores the PTY under. */
  id: string;
  cmd: string;
  args?: string[];
  cwd?: string;
  fontSize?: number;
  /** Whether this pane is the currently visible one. Every pane across
   * every tab/team stays mounted for its whole session (see the .stage
   * comment in App.tsx), so this drives WebGL context attach/detach — see
   * the dedicated effect below — rather than mount/unmount. */
  active: boolean;
  onAgentState?: (id: string, state: "idle" | "working" | "blocked" | "unknown") => void;
  /** Reported on every fit — the pane's current cell size in CSS px, so a
   * divider drag elsewhere can snap to whole terminal rows/cols. */
  onCellSize?: (widthPx: number, heightPx: number) => void;
  /** Fired when this pane's terminal actually receives keyboard focus (a
   * click inside it, or Tab-focus) — xterm.js's hidden input textarea is a
   * focusable descendant of the container div below, so a plain onFocus
   * there catches it via the bubbled focusin React normalizes to. Lets the
   * app track "which pane in this tab was last actually used" for the
   * external file-drop fallback target (prefer the focused pane over
   * just the tab's first one). */
  onFocusPane?: (id: string) => void;
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * One embedded agent terminal: an xterm.js view bound to a backend PTY session.
 * Output streams in via `pty-output` events; keystrokes go back via `pty_write`.
 */
export function TerminalPane({
  id,
  cmd,
  args = [],
  cwd,
  fontSize = 12,
  active,
  onAgentState,
  onCellSize,
  onFocusPane,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Live handles to the current terminal/fit addon, for the font-size effect
  // below to reach — that effect must NOT be a dependency of the main effect
  // (a fontSize change would otherwise kill and respawn the PTY, losing the
  // running process).
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  // Set only while a WebGL context is actually attached (see the `active`
  // effect below) — null whenever this pane is on the default DOM renderer,
  // whether because it's inactive or because WebGL was never attached/lost.
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const idRef = useRef(id);
  idRef.current = id;
  const { t } = useTranslation();

  useEffect(() => {
    let disposed = false;
    const term = new Terminal({
      fontSize,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      cursorBlink: true,
      // Lets Option+drag force native selection even when the child CLI has
      // taken mouse reporting (e.g. a fullscreen TUI) — otherwise there is no
      // way to select/copy pane output without leaving that mode first (#452).
      macOptionClickForcesSelection: true,
      theme: { background: "#0b0e14", foreground: "#c5c8c6" },
    });
    termRef.current = term;
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(ref.current!);

    // Fit to the container's CURRENT size and tell the PTY — but only when the
    // pane is actually laid out. A pane that mounts while its tab is inactive
    // (or before first layout) has 0 size; fitting then would size the terminal
    // to ~1 column. We keep xterm's 80x24 default until a real size arrives,
    // and a ResizeObserver re-fits when the pane gets/changes its size (initial
    // layout, tab switch from display:none, window resize).
    let lastRows = 0;
    let lastCols = 0;
    const fitNow = () => {
      const el = ref.current;
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
      try {
        fit.fit();
      } catch {
        return;
      }
      if (term.rows !== lastRows || term.cols !== lastCols) {
        lastRows = term.rows;
        lastCols = term.cols;
        void invoke("pty_resize", { id, rows: term.rows, cols: term.cols });
      }
      // Every pane uses the same fixed font today, so any one of them
      // reporting its cell size is representative of them all — a divider
      // drag doesn't need to know which specific panes it's between.
      onCellSize?.(el.offsetWidth / term.cols, el.offsetHeight / term.rows);
    };

    // Coalesce PTY output into at most one term.write() per animation frame
    // instead of one per backend event. The Rust reader thread emits an
    // event per raw PTY read (unbatched, no debounce) — a chatty CLI (issue
    // #383: Codex's title-escape-driven spinner churns very frequently)
    // can fire far more of these than the browser can usefully paint
    // between frames. Unverified hypothesis behind this change: each
    // term.write() resets xterm's cursor blink phase, so writing many
    // times within a single frame is a plausible source of the reported
    // visible flicker/jitter — batching bounds that to once per frame
    // regardless of how bursty the backend is. See writeBatcher.ts for why
    // this isn't just a bare requestAnimationFrame (it stalls in a
    // backgrounded/occluded webview, and agmsg mounts panes while hidden).
    const writeBatcher = createWriteBatcher({ onFlush: (data) => term.write(data) });

    const unlisteners: Array<() => void> = [];
    (async () => {
      // Register listeners BEFORE spawning so no early output is missed.
      // `listen()` is async — if this effect's cleanup runs while one of
      // these awaits is still in flight (a fast unmount/remount, or React
      // re-running the effect), the listener resolves into a component
      // that's already torn down. Each registration below checks `disposed`
      // right after its own await and, if already torn down, unregisters
      // itself immediately instead of joining `unlisteners` — otherwise the
      // Tauri listener would keep firing this closure's stale term/
      // writeBatcher forever (a real listener leak), and — before
      // writeBatcher.dispose() became permanent (see writeBatcher.ts) —
      // could even resurrect its scheduling after teardown. The `disposed`
      // check inside each callback body is defense in depth for an event
      // already queued at the moment unlisten() runs.
      const unlistenOutput = await listen<{ id: string; b64: string }>("pty-output", (e) => {
        if (disposed) return;
        if (e.payload.id === id) writeBatcher.push(b64ToBytes(e.payload.b64));
      });
      if (disposed) {
        unlistenOutput();
        return;
      }
      unlisteners.push(unlistenOutput);

      const unlistenExit = await listen<{ id: string }>("pty-exit", (e) => {
        if (disposed) return;
        if (e.payload.id !== id) return;
        // Flush synchronously first — any output still waiting for its
        // batched write must land before the exit banner, or the banner
        // could render above the process's own final lines.
        writeBatcher.flushNow();
        term.write(`\r\n\x1b[90m${t("terminal.processExited")}\x1b[0m\r\n`);
      });
      if (disposed) {
        unlistenExit();
        return;
      }
      unlisteners.push(unlistenExit);
      term.onData((data) => void invoke("pty_write", { id, data }));
      fitNow(); // size the PTY to the pane if it's already laid out
      try {
        await invoke("pty_spawn", { id, cmd, args, cwd, rows: term.rows, cols: term.cols });
      } catch (err) {
        // A failed spawn (missing CLI on PATH, bad cwd, ...) would otherwise
        // leave this pane blank forever with zero indication anything went
        // wrong. Write the failure straight into the terminal — it's already
        // the visible surface for this pane, no extra UI needed.
        term.write(`\r\n\x1b[91m${t("terminal.failedToStart", { cmd, error: String(err) })}\x1b[0m\r\n`);
        return;
      }
      void invoke<"idle" | "working" | "blocked" | "unknown">("agent_state", { id })
        .then((state) => onAgentState?.(id, state))
        .catch(() => {});
    })();

    // Re-fit whenever the pane's box changes — covers initial layout, switching
    // back to this tab (display:none -> block), and window resizes. Also
    // fires continuously while a divider is being dragged (issue #317):
    // debounced here rather than reacting to every single event, since
    // fitNow's fit.fit() + pty_resize is expensive and can spam some CLIs
    // with rapid SIGWINCH in a way that garbles their redraw — the dragged
    // pane's own CSS size still tracks the cursor live (that's just the
    // browser reflowing .pane-cell's inline style), only the actual PTY
    // resize + xterm reflow is throttled.
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitNow, 75);
    });
    if (ref.current) ro.observe(ref.current);

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      writeBatcher.dispose();
      ro.disconnect();
      unlisteners.forEach((u) => u());
      void invoke("pty_kill", { id });
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [id, cmd, cwd, onAgentState, onCellSize]);

  // Apply a fontSize change live, without recreating the terminal (which
  // 
```

### Core Architecture Module: `app/src/agentStatus.ts`
```
export type RawState = "idle" | "working" | "blocked" | "unknown";
export type PaneStatus = { state: RawState };
export type PaneStatusMap = Record<string, PaneStatus>;
// A team's aggregate is either one of the pane states, or "empty" — no
// agent has ever been started for that team. "unknown" (a pane exists but
// classify() doesn't recognize its agent type) is deliberately a distinct
// value from "empty" (no pane exists at all): #406 made "unknown" render
// green like idle, since an unhandled type isn't an anomaly, but a team
// nobody has started anything in isn't "idle" — it should read as inert
// gray instead of implying live, healthy agents.
export type TeamAggregateState = RawState | "empty";

export function applyStateChange(map: PaneStatusMap, paneId: string, newState: RawState): PaneStatusMap {
  if (map[paneId]?.state === newState) return map;
  return { ...map, [paneId]: { state: newState } };
}

export function aggregateTeamStatus(statuses: PaneStatus[]): TeamAggregateState {
  if (statuses.length === 0) return "empty";
  const priority: Record<RawState, number> = {
    blocked: 3,
    working: 2,
    idle: 1,
    unknown: 0,
  };
  return statuses.reduce<RawState>(
    (aggregate, status) => (priority[status.state] > priority[aggregate] ? status.state : aggregate),
    "unknown",
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1178** (2026-09-13): **flake: a third remote_sync_engine.test.mjs stub has the same undrained-stdin EPIPE race as #755**
  *Symptoms*: `tests/remote_sync_engine.test.mjs`'s "storage driver subprocess cannot observe HTTP or age identity secrets" test failed intermittently on a macOS CI shard with `write EPIPE`:  ``` not ok 421 Stage-1 sync engine protocol and security boundaries # ✖ storage driver subprocess cannot observe HTTP or age identity secrets (20.209417ms) #   Error: write EPIPE #       at Socket.end (node:net:1024:31) #       at scripts/internal/remote-sync.mjs:2071:19 #   { errno: -32, code: 'EPIPE', syscall: 'write', driverFailurePhase: 'stdin-write' } ```  Observed once so far, on run 32799226236 attempt 3 (PR #889, which does not touch this code); a grep over the other recently failed macOS jobs on main and PR runs found no other occurrence.  This is the mechanism #755 diagnosed and closed: the stub driver script this test writes prints a fixed JSON line and exits without ever reading stdin, while `driver()` writes the request to the child's stdin and then ends it. If the child has already exited by the time `end()` runs, the write lands on a closed pipe and raises EPIPE, which the stdin error handler correctly reports as a driver failure. The failure is a race between the parent's `end()` and the child's exit, not a defect in the code under test.  #755's fix (PR #759, commit ff7abba) added `cat >/dev/null` to the two stub scripts it found with this shape, and its commit message noted that a sibling of the same shape had not been seen to fail. The stub for this test (around `tests/remote_sync_en

- **Issue #783** (2026-08-14): **`whoami.sh` does not validate the agent type that `join.sh` validates, so a wrong type reports "not joined"**
  *Symptoms*: **Reported by:** Joel ([@JoelMitz](https://x.com/JoelMitz)), running a self-hosted reference server against v1.2.0-rc.5 from Linux, Windows 11 / Git Bash, and WSL2. Code locations below were re-derived on `integration/remote` before filing.  `join.sh:26` validates and rejects:  ``` Unknown agent type: '<type>' (supported: agmsg-app, antigravity, claude-code, codex, copilot, cursor, gemini, grok-build, hermes, opencode) ```  `whoami.sh:87` takes the same argument and never checks it:  ```sh AGENT_TYPE="${2:-$(detect_cli_type)}" ... AGENT_TYPE_SQL=$(printf '%s' "$AGENT_TYPE" | sed "s/'/''/g") ```  It goes straight into a SQL literal. An unknown type simply matches nothing:  ``` whoami.sh <project> claude              -> not_joined=true   (exit 0) whoami.sh <project> totally-bogus-type  -> not_joined=true   (exit 0) whoami.sh <project> claude-code         -> agent=<agent> teams=<team> ... ```  `agmsg_known_types` is already in scope in this file — `detect_cli_type` uses it at `:49` and `:73`. The list is present and simply not applied to the passed argument.  **Why this is more than a cosmetic asymmetry.** `SKILL.md` branches on `not_joined=true` and routes it to first-time setup, i.e. "run `join.sh`". So an agent that is already joined, invoked with a wrong type, is sent to register again. The path from a typo to a duplicate registration is unguarded.  `claude` for `claude-code` is the typo that will actually happen: `SKILL.md`'s worked examples use `codex`, and there is no Cla
  **Post-Mortem & Fix Analysis**:
  > Landed on `integration/remote` as `44e8b563e0a7dc3ed34c05301e17a657cb28c321` (#801).  Closing by hand: the PR's base is `integration/remote`, where a closing keyword does not fire.  The fix turned out to be two, and the second is the heavier one. `whoami.sh` now rejects a type the caller explicitly asked for — guarded on the argument being present, because detection's last exit is a literal the registry does not stand behind, and validating the resolved value would stop everyone on a broken install rather than only a caller who mistyped.  That alone did not fix the reported behaviour. `windows/dispatch.sh` passed its own `codex` default to the scripts that write registrations, so an already-joined user could be registered a second time under a type nobody chose. `codex` is a known type, so no amount of validation fires on it. The type is now detected once, after flag parsing, for every consumer — including `mode`, `join`, `reset` and `drop`, which never resolve an identity at all.

- **Issue #782** (2026-08-14): **A driver failure reports an undecoded wait status and names neither the team nor a path**
  *Symptoms*: **Reported by:** Joel ([@JoelMitz](https://x.com/JoelMitz)), running a self-hosted reference server against v1.2.0-rc.5 from Linux, Windows 11 / Git Bash, and WSL2. Code locations below were re-derived on `integration/remote` before filing.  `scripts/internal/remote-sync.mjs:1536-1542`:  ```js child.on("exit", (code, signal) => {   if (failure) { fail(failure); return; }   if (code === 0 && !signal) return;   const diagnostic = stderr.trim() ||     "driver returned a non-zero exit without diagnostics; inspect its team storage and binding";   fail(new Error(`${label} ${operation} failed (${signal ?? code}): ${diagnostic}`)); }); ```  Observed on Windows/Git Bash:  ``` storage sync prepare failed (3840) ```  `3840` is `15 << 8` — a raw wait status for "terminated by signal 15", arriving through `code` rather than through `signal`. On POSIX a signal death populates `signal` and this line prints a name; on this platform it does not, and the operator gets a number with no decoding.  The reporter produced this particular instance under an explicit `timeout 15`, so the SIGTERM was theirs. That does not make the reporting correct: a driver killed by a signal should say so on every platform.  Second, independent half: the fallback diagnostic says *"inspect its team storage and binding"* and names **no team and no path**, while `config.local_team` is in scope at the call site (`:1557`, `:1587`) and the driver was invoked with it as `args[1]`.  **Proposed:** 1. Decode a raw wait status 
  **Post-Mortem & Fix Analysis**:
  > **Two corrections to the description above.** The reported symptom stands; two statements made about it do not.  ## `3840` decodes the other way  The description reads it as *"a raw wait status for terminated by signal 15"*. Under the POSIX wait encoding it is the opposite:  ``` 3840 & 0x7f          = 0     -> WIFEXITED: not killed by a signal (3840 >> 8) & 0xff   = 15    -> exit status 15 ```  A death by signal 15 puts **15 in the low bits**, not the high ones — and a `bash` in the middle reports it as exit status **143** (`128 + 15`) rather than passing a wait status along at all. So `3840` reads as *exited 15*.  **What it actually was on that machine is not established here.** Nobody reproducing this has a Windows host, and the number alone cannot say which layer produced it. That is exactly why the proposal below changes:  > ~~1. Decode a raw wait status when `signal` is null and `code` is outside > 0–255, or report both fields.~~  **Report both fields, and show the decomposition w
  > Landed on `integration/remote` in `59cc42c6d1a97253a2cb7bd09290ca9f31b8d23a` (PR #793, head `33f2287554a1b9c039d235ea06f16a28c4e235af`).  Closed by hand: a closing keyword does not fire on a branch that is not the default one, so the PR carried the number without one.  The fix covers five throws in three files, not the two this report named — the set was derived from every `process.platform !== "win32"` under `scripts/`, and three more sites said the same thing about a condition they had already excluded. What is deliberately unchanged, and why, is in the PR body. 

- **Issue #781** (2026-08-14): **Checks that are skipped on win32 throw errors naming the condition they skipped**
  *Symptoms*: **Reported by:** Joel ([@JoelMitz](https://x.com/JoelMitz)), running a self-hosted reference server against v1.2.0-rc.5 from Linux, Windows 11 / Git Bash, and WSL2. Code locations below were re-derived on `integration/remote` before filing.  `scripts/internal/remote-sync.mjs:468-475`:  ```js async function readBoundedAuthorityFile(path, maxBytes, privateFile) {   const before = await lstat(path);   const unsafeMode = process.platform !== "win32" &&     (before.mode & (privateFile ? 0o077 : 0o022)) !== 0;   if (!before.isFile() || before.isSymbolicLink() || unsafeMode || before.size > maxBytes) {     throw new Error(privateFile ? "remote credential must be a private regular file" :       "connected team binding must be a non-writable regular file");   } ```  `unsafeMode` is `false` on win32 by construction. So on Windows this throw can only mean `!isFile()`, `isSymbolicLink()`, or `size > maxBytes` — never a permission problem. The message names a permission problem unconditionally.  Same shape at `:1131-1135`:  ```js if (!metadata.isFile() || metadata.isSymbolicLink() ||     (process.platform !== "win32" && (metadata.mode & 0o077) !== 0)) {   throw new Error("retained age checkpoint must be a private regular file"); } ```  **This misdirected a real investigation.** On the Linux host the same message was a genuine permission problem — `umask 0002` left `teams/<team>/config.json` at `0664`, `mode & 0o022 !== 0`, fatal, fixed by `chmod 644`. Carrying that experience to the Windo
  **Post-Mortem & Fix Analysis**:
  > **Correction and addition to the description above**, re-derived on `integration/remote` at `d0b762d47747682e5a466cc1ad0df903c2712ac1`.  ## There is a third site, and it is the same shape  The two sites above were found by reading a region. Deriving the set instead — every `process.platform !== "win32"` in the file — gives six, of which **three** throw a message naming a condition that guard has already excluded:  | line | message | verdict | |---|---|---| | 470-475 | `remote credential must be a private regular file` / `connected team binding must be a non-writable regular file` | **affected** — as described above | | 478-482 | `connection authority changed while it was being opened` | not affected — names a change, not a permission | | 1131-1135 | `retained age checkpoint must be a private regular file` | **affected** — as described above | | **1177-1180** | **`AGMSG_SYNC_TRUST_DIR must be a private directory`** | **affected — not previously listed** | | 1190 | platform guard around 
  > **Two more, in other files.** The previous comment derived the set within `remote-sync.mjs`. Deriving it across `scripts/` finds the same shape twice more, so the affected total is **five throws in three files**.  ``` $ grep -rn 'process.platform !== "win32"' scripts/ ```  **`scripts/internal/rename-sync-config.mjs:27`**  ```js if (!metadata.isFile() || metadata.isSymbolicLink() ||     (process.platform !== "win32" && (metadata.mode & 0o077) !== 0)) {   throw new Error("remote sync config must be a private regular file"); } ```  Identical to the first site in the report: on win32 only `!isFile()` and `isSymbolicLink()` survive, and the message still says *private*.  **`scripts/internal/sync-cipher.mjs:402`** — the same shape, and worse for the operator:  ```js export function readNativeAgeIdentity(path) {   try {     const metadata = statSync(path);     if (!metadata.isFile() || (process.platform !== "win32" && (metadata.mode & 0o077) !== 0)) {       throw new Error("identity file is n
  > Landed on `integration/remote` in `59cc42c6d1a97253a2cb7bd09290ca9f31b8d23a` (PR #793, head `33f2287554a1b9c039d235ea06f16a28c4e235af`).  Closed by hand: a closing keyword does not fire on a branch that is not the default one, so the PR carried the number without one.  The fix covers five throws in three files, not the two this report named — the set was derived from every `process.platform !== "win32"` under `scripts/`, and three more sites said the same thing about a condition they had already excluded. What is deliberately unchanged, and why, is in the PR body. 

- **Issue #780** (2026-08-14): **Applying a pull spawns up to 18 `jq` processes per message**
  *Symptoms*: **Reported by:** Joel ([@JoelMitz](https://x.com/JoelMitz)), running a self-hosted reference server against v1.2.0-rc.5 from Linux, Windows 11 / Git Bash, and WSL2. Code locations below were re-derived on `integration/remote` before filing.  `storage_sync_apply_pull` in `scripts/drivers/storage/sqlite-sync.sh:738` processes records in a `while IFS= read -r line` loop spanning `:752-945`. **All 18 `jq` invocations in the function sit inside that loop; none outside it.** So each applied message costs up to 18 process spawns.  (`scripts/internal/storage-sync-driver.sh` is a 39-line dispatcher and is not where this lives — noting it because it is the name the symptom points at. `scripts/drivers/storage/jsonl.sh:195` is the other implementation.)  Measured by the reporter at ~1,500–1,600 messages, i.e. on the order of 28,000 spawns:  ``` Windows 11 / Git Bash   minutes, then fork exhaustion and a crash (see #778) WSL2 native ext4        no crash; 1,578 messages took over 20 minutes ```  A detail worth keeping for whoever profiles this: the parent (`remote-sync.mjs run`) accumulated **3 seconds** of CPU across that 20 minutes. All the work is in short-lived children, so any monitoring that watches the parent's CPU time reads a busy import as an idle process.  **Proposed:** batch the per-message `jq` work so the spawn count scales with the batch rather than with the message count.  Same class and same proposed remedy as #449, different code path. 
  **Post-Mortem & Fix Analysis**:
  > Landed on `integration/remote` as `a05a978ecd406680751cfac03828a27219d48963` (PR #799, head `c0b7c660ff5e643dad764abbcb0cf1f5620b2cf8`). Closed by hand — a closing keyword does not fire off the default branch.  **Counted rather than taken from this issue:** 18 `jq` invocations inside `storage_sync_apply_pull`, 14 of them on the ordinary message path. Now 1.  Same input, same machine, three runs at different machine loads:  | | 18 calls/message | 1 call/message | ratio | |---|---|---|---| | run 1 | 163 ms | 6.0 ms | 27x | | run 2 | 86.5 ms | 5.2 ms | 16.7x | | run 3 (shipped filter) | 117.3 ms | 8.9 ms | 13.1x |  **The ratio is not the number to quote** — it moves with load. What does not move is that a message costs **seventeen fewer processes**, which is also why the ratio moves:  ``` jq --version spawn     8.0 ms /usr/bin/true spawn    5.1 ms ```  A `jq` that parses nothing costs within 3 ms of a program that does nothing, so the parse was never the expense. **On the question of whet

- **Issue #669** (2026-08-08): **Roster can be silently emptied when the journal is unreadable — the call returns success**
  *Symptoms*: **A team's roster can be silently emptied, on any platform, and the call that does it returns success.**  This was filed as a Windows failure. That was one symptom, and the smaller one.  ## The measurement  Journal unreadable, config readable — the ordinary shape of a permissions problem, a half-finished write, or a path the SQL layer cannot open:  ``` origin/integration/remote (current)   rc=0   agents={} ```  `agmsg_roster_project_config` returns **0**, says nothing on stdout or stderr, and writes back a config whose `agents` object is empty. Membership that was there before the call is gone after it.  This is present on the branch today. It is not introduced by any pending fix.  ## The three cases, because only one of them is dangerous  | journal | outcome | | |---|---|---| | absent | `[ -f "$journal" ] \|\| return 0` — early return | safe | | **present but unopenable** | **`rc=0`, roster emptied, nothing said** | **the defect** | | present, and config also unopenable | projection empty → `[ -n "$updated" ] \|\| return 1` | safe, by accident |  The third row is why this surfaced as "Windows." There, *every* path is unopenable, so both files fail together, the projection collapses to empty, and the existing non-empty guard catches it. `join.sh` exits 1 right after printing `Created team:` — noisy enough to notice, destructive of nothing.  The dangerous row is the one where only the journal fails. The fold sees no events, so it projects an empty roster; `json_set` then build
  **Post-Mortem & Fix Analysis**:
  > ## Where the readability check has to sit, measured  Recording this here because it exists nowhere searchable otherwise, and because the cheaper shape is an easy and reasonable-looking thing to propose again.  Both attempts at this issue reached for the same diagnosis: when the projection comes back **empty**, work out which file could not be read. That costs nothing on the happy path, which is the appeal. It also does not see the case that loses data.  With the journal unreadable and the team config fine, the projection **does not come back empty**. `readfile(journal)` is NULL, the fold sees no events, and `json_set()` still builds a perfectly well-formed config out of the readable side — with an empty roster.  Measured against a version whose check runs only after an empty result:  ``` before   agents={"alice":{"member_id":"019f...","registrations":[{...}]}}  chmod 000 roster.jsonl agmsg_roster_project_config <team_dir> <config>   status=0   nothing on stdout, nothing on stderr  afte
  > Landed on `integration/remote` as ecf31b5 (PR #674, head 76cc80a).  Closed by hand — `Closes #N` does not fire off the default branch.  On the destination: the readable-check runs at two sites before their projection queries (`roster-journal.sh:197`, `:362`), and `scripts/lib/sqlpath.sh` is present, so it ships with the skill via the recursive `scripts/lib` copy.  The property this closes is not the Windows symptom it was filed as. Measured across three revisions with the journal present but unopenable and the config readable:  | revision | rc | roster | |---|---|---| | `integration/remote` before this | 0 | `agents={}` | | #671 | 0 | `agents={}` | | this | 1 | intact, path named |  The silent wipe was platform-independent and already live. Windows failed safely only because *both* files were unopenable there, which collapsed the projection to empty and hit the `return 1`.

- **Issue #114** (2026-06-15): **send.sh / storage: concurrent writes fail with SQLITE_BUSY (no busy_timeout) — leader fan-out silently drops**
  *Symptoms*: ## Summary  `send.sh` (and every other `sqlite3` caller) opens the DB without a `busy_timeout`, so **concurrent writes fail immediately** with `SQLITE_BUSY` (exit 5) instead of waiting for the lock. A leader fanning a job out to N members hits this every time — only one write lands, the rest error out, and because `send.sh` just exits non-zero (no caller-visible retry), the dropped messages are **silently lost** (they never reach the DB at all — not a delivery/watermark problem).  Reported from a crew experiment: leader → 4 workers near-simultaneously delivered the job to only 1 worker; the other 3 stayed idle, with no rows in the DB for them.  ## Repro  ```sh for x in A B C D; do ( ~/.agents/skills/agmsg/scripts/send.sh team t tgt-$x "lock test $x" ) & done; wait # [A] Error: stepping, database is locked (5)   exit 5 # [B] Error: stepping, database is locked (5)   exit 5 # [C] Sent to tgt-C in team team                exit 0 # [D] Error: stepping, database is locked (5)   exit 5 ```  ## Root cause  WAL is enabled at init (`journal_mode=WAL`), which allows concurrent readers + one writer — but WAL does **not** let concurrent writers proceed; they serialize. With SQLite's default `busy_timeout=0`, a writer that finds the DB locked returns `SQLITE_BUSY` immediately rather than waiting. No call site sets `busy_timeout`:  - `scripts/send.sh:19` — the INSERT - `scripts/inbox.sh` / `check-inbox.sh` — `read_at` UPDATE (also contends) - `join.sh`, `actas-claim.sh`, `rename*.sh`, `res

- **Issue #112** (2026-06-22): **Shared registry helpers can't bind single-quote values (.param set tokenizer ignores SQL '' escaping)**
  *Symptoms*: ## Summary  The shared team-registry scripts pass `config.json` to `sqlite3` by interpolating it into a `.param set :json '<config>'` **dot-command**. The sqlite3 shell's dot-command tokenizer does **not** honour SQL `''` escaping, so any config value containing a single quote — a project path like `/tmp/pro'j`, or a team/agent name with an apostrophe — breaks the bind (the dot-command splits on the quote and `.param set` errors), and the affected (project, type) silently reads as "not registered".  This is a **codebase-wide** limitation, not specific to any one feature. Affected call sites include `whoami.sh`, `identities.sh`, and `join.sh` (and anything else binding config JSON via `.param set`). It surfaced as a downstream failure for `spawn` with a single-quote project path: `resolve_team` was hardened to read via `readfile()` + SQL string literals (#105), but the pre-join through `join.sh` still hits the `.param set` wall.  ## Repro  ```sh # join an agent under a project path containing a single quote ~/.agents/skills/agmsg/scripts/join.sh team alice claude-code "/tmp/pro'j" # subsequent lookups that bind the config via `.param set` mis-handle it: ~/.agents/skills/agmsg/scripts/whoami.sh "/tmp/pro'j" claude-code   # → not_joined / suggest ```  (Confirmed directly: `sqlite3 :memory: ".param set :p 'a''b'" "SELECT :p;"` prints the `.parameter` help instead of binding `a'b`, whereas the SQL literal `SELECT 'a''b';` correctly yields `a'b`.)  ## Fix direction  Move the shared
  **Post-Mortem & Fix Analysis**:
  > Implemented in https://github.com/fujibee/agmsg/pull/144 - fix: Bind single-quote-containing config values via readfile() instead of .param.

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

### Incident Patch 1: `ae237f38` (2026-10-05)
**Commit Message**: fix(sync): clean up outcome files leaked before #1572 on update and in doctor (#1575)

Before the fix in #1572, every successful remote-sync apply left a 3-byte outcome file in the temp directory, so machines that ran sync for a while have thousands to hundreds of thousands of them.

install --update now removes those leftovers on every run, and doctor reports them (doctor --fix removes them after a confirmation). A file is removed only when all of these hold: it sits directly in ${TMPDIR:-/tmp}; its name is exactly mktemp's default form; its size and content are exactly "ok\n" (3 bytes), "busy\n" (5) or "failed\n" (7); and it is older than 10 minutes. The set is re-scanned right before removal and only files matching both scans are removed. A failure while cleaning prints one warning and never stops the install. The test environment now isolates TMPDIR, so tests do not read the real temp directory.

**File**: `install.sh` (modified, +12/-0)
```diff
@@ -39,6 +39,8 @@ agmsg_load_renderable_skill_types
 # so the two cannot silently disagree about which files exist again.
 # shellcheck disable=SC1091
 . "$SCRIPT_DIR/scripts/lib/codex-config.sh"
+# shellcheck disable=SC1091
+. "$SCRIPT_DIR/scripts/lib/stale-outcome-files.sh"
 
 # Types that already get their OWN dedicated skill file, written elsewhere in
 # this script -- always in that type's own format, unconditionally, gated
@@ -842,6 +844,16 @@ $_agmsg_running_team"
   printf '%s\n' "$INSTALLED_VERSION" > "$SKILL_DIR/VERSION"
   echo "  + updated scripts, templates, and SKILL.md (version $INSTALLED_VERSION)"
   echo "  ~ DB and team configs preserved"
+  # #1572 fixed the leak; this sweeps up whatever an install made before
+  # that fix already left behind. Unconditional on every --update rather
+  # than gated on a once-only marker: once a cleaned install's temp
+  # directory holds none of these, the scan below finds nothing and costs
+  # one quick `find`, so there is no ongoing cost to running it again --
+  # see stale-outcome-files.sh for the full match criteria.
+  AGMSG_STALE_OUTCOME_REMOVED="$(agmsg_stale_outcome_candidates | agmsg_remove_stale_outcome_files)"
+  if [ "${AGMSG_STALE_OUTCOME_REMOVED:-0}" -gt 0 ]; then
+    echo "  + removed $AGMSG_STALE_OUTCOME_REMOVED leaked sync outcome file(s) from before #1572"
+  fi
   configure_codex_sandbox
   echo ""
   echo "  ! Restart any running agent sessions to pick up the updated scripts."
```

**File**: `scripts/doctor.sh` (modified, +99/-24)
```diff
@@ -106,6 +106,8 @@ RUN_DIR="$SKILL_DIR/run"
 . "$SCRIPT_DIR/lib/type-registry.sh"
 # shellcheck disable=SC1091
 . "$SCRIPT_DIR/lib/validate.sh"
+# shellcheck disable=SC1091
+. "$SCRIPT_DIR/lib/stale-outcome-files.sh"
 
 # --- orphaned run/ records (#1507) -----------------------------------------
 #
@@ -345,6 +347,36 @@ _doctor_print_locks() {
   echo
 }
 
+# --- leaked storage sync driver outcome files (#1572) -----------------------
+#
+# AGMSG_SQLITE_OUTCOME_FILE (lib/storage.sh `_agmsg_sqlite_recording`, read by
+# scripts/internal/storage-sync-driver.sh) used to go unremoved on every
+# ordinary successful "apply"/"read-apply" call before #1572, on an install
+# made before that fix. See lib/stale-outcome-files.sh for the exact match
+# criteria (location, name, size, content, age) this only ever removes a
+# file matching all of.
+STALE_OUTCOME_FILES=""
+_doctor_scan_stale_outcome_files() {
+  STALE_OUTCOME_FILES="$(agmsg_stale_outcome_candidates)"
+}
+
+_doctor_print_stale_outcome_files() {
+  local n dir example_n=0
+  [ -n "$STALE_OUTCOME_FILES" ] || return 0
+  n="$(printf '%s\n' "$STALE_OUTCOME_FILES" | grep -c . || true)"
+  dir="$(_agmsg_stale_outcome_dir)"
+  echo "leaked storage sync driver outcome files in $dir (#1572, fixed; left over from before the fix) ($n):"
+  while IFS= read -r f; do
+    [ -n "$f" ] || continue
+    example_n=$((example_n + 1))
+    [ "$example_n" -le 5 ] || continue
+    echo "  $f"
+  done <<< "$STALE_OUTCOME_FILES"
+  if [ "$n" -gt 5 ]; then echo "  ... and $((n - 5)) more"; fi
+  echo "  remove them with: doctor.sh --fix"
+  echo
+}
+
 # --- --fix: its own mode, not a flag on the report -------------------------
 #
 # Lists what would go, asks once (--yes skips only the question), then removes
@@ -360,36 +392,72 @@ if [ "$FIX" = 1 ]; then
     exit 2
   fi
   _doctor_scan_orphan_run_records
-  if [ -z "$ORPHAN_SEATS" ]; then
-    echo "nothing to fix: no orphaned run/ records."
+  _doctor_scan_stale_outcome_files
+  if [ -z "$ORPHAN_SEATS" ] && [ -z "$STALE_OUTCOME_FILES" ]; then
+    echo "nothing to fix: no orphaned run/ records, no leaked outcome files."
     if [ -n "$ORPHAN_AMBIGUOUS" ]; then echo; _doctor_print_orphans; fi
     exit 0
   fi
-  _doctor_print_orphans
-  if [ "$ASSUME_YES" != 1 ]; then
-    printf 'Remove the records listed above? (y/n) [n]: '
-    read -r _doctor_answer || _doctor_answer=""
-    case "$_doctor_answer" in y|Y) ;; *) echo "Aborted; nothing removed."; exit 1 ;; esac
+  _doctor_aborted=0
+  if [ -n "$ORPHAN_SEATS" ]; then
+    _doctor_print_orphans
+    if [ "$ASSUME_YES" != 1 ]; then
+      printf 'Remove the orphaned run/ records listed above? (y/n) [n]: '
+      read -r _doctor_answer || _doctor_answer=""
+      case "$_doctor_answer" in y|Y) ;; *) echo "Aborted; run/ records not removed."; _doctor_aborted=1; _doctor_answer="" ;; esac
+    else
+      _doctor_answer=y
+    fi
+    case "$_doctor_answer" in
+      y|Y)
+        _doctor_removed=0 _doctor_skipped=0
+        while IFS="$_DOCTOR_US" read -r _s _team _agent _pane _files; do
+          [ -n "$_s" ] || continue
+          # The scan is older than the question above: a team of this name may
+          # have been created while it waited, and its records now belong to a
+          # live team. Checked again, right before each seat's files go.
+          _enc_team="$(_actas_lock_encode "$_team")"
+          case $'\n'"$(_doctor_existing_enc_teams)"$'\n' in
+            *$'\n'"$_enc_team"$'\n'*) _doctor_skipped=$((_doctor_skipped + 1)); continue ;;
+          esac
+          for _f in $_files; do
+            rm -f "$RUN_DIR/$_f"
+          done
+          _doctor_removed=$((_doctor_removed + 1))
+        done <<< "$ORPHAN_SEATS"
+        echo "removed the run/ records of $_doctor_removed seat(s)."
+        if [ "$_doctor_skipped" -gt 0 ]; then
+          echo "left $_doctor_skipped seat(s) alone: their team exists now."
+        fi
+        ;;
+    esac
   fi
-  _doctor_removed=0 _doctor_skipped=0
-  while IFS="$_DOCTOR_US" read -r _s _team _agent _pane _files; do
-    [ -n "$_s" ] || continue
-    # The scan is older than the question above: a team of this name may have
-    # been created while it waited, and its records now belong to a live team.
-    # Checked again, right before each seat's files go.
-    _enc_team="$(_actas_lock_encode "$_team")"
-    case $'\n'"$(_doctor_existing_enc_teams)"$'\n' in
-      *$'\n'"$_enc_team"$'\n'*) _doctor_skipped=$((_doctor_skipped + 1)); continue ;;
+  if [ -z "$ORPHAN_SEATS" ] && [ -n "$ORPHAN_AMBIGUOUS" ]; then
+    # Only reached here when ORPHAN_SEATS was empty: otherwise the call
+    # above already printed this section too (it prints both at once).
+    _doctor_print_orphans
+  fi
+  # Independent of the orphan-records section above: either can be present
+  # without the other, so one being empty (or its own prompt declined) never
+  # skips the other.
+  if [ -n "$STALE_OUTCOME_FILES" ]; then
+    [ -n "$ORPHAN_SEATS$O
```

**File**: `scripts/lib/stale-outcome-files.sh` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+#!/usr/bin/env bash
+# Finding and removing the storage sync driver's leaked outcome files
+# (#1572: storage_sync_apply_pull and storage_sync_apply_read_state each
+# used to overwrite storage-sync-driver.sh's own EXIT trap without
+# restoring it, so AGMSG_SQLITE_OUTCOME_FILE -- a bare `mktemp`, default
+# name -- was never removed on an ordinary successful "apply" or
+# "read-apply" call. Fixed there; this is the one-time cleanup for
+# whatever already accumulated before that fix, on an install made before
+# it. Not sourced into every script: only install.sh's --update and
+# doctor.sh need it.
+#
+# Only a file matching ALL FOUR of these is ever removed -- another tool
+# could, in principle, happen to create a file matching every one of them
+# too (nothing here can rule that out by construction), but it is these
+# four conditions together, not an attempt to recognize this driver's
+# files specifically, that decide what goes:
+#   - location: directly under the install's own temp directory
+#     (${TMPDIR:-/tmp}), never a subdirectory.
+#   - name: exactly `tmp.` followed by 10 characters from [A-Za-z0-9] --
+#     mktemp(1)'s default template (coreutils and BSD/macOS agree on this
+#     one, confirmed on both).
+#   - size paired to content: exactly 3 bytes and "ok", exactly 5 and
+#     "busy", or exactly 7 and "failed" -- never any of the three words
+#     at any OTHER of the three sizes. A bash variable cannot hold a NUL
+#     byte at all (read into one drops it, the same way it drops a
+#     trailing newline), so content alone can never tell "busy\n" (5
+#     bytes) apart from "ok\n" plus two trailing NULs (also 5 bytes) --
+#     `read` on either yields the same two-character string. Pairing each
+#     size to the one word that size could ever legitimately hold closes
+#     that: the second example above is checked only against "busy" (its
+#     actual size's word), not "ok", and is correctly refused.
+#   - age: older than AGMSG_STALE_OUTCOME_MIN_AGE_S (default 600s/10min),
+#     so a driver that is still mid-call right now and has not reached its
+#     own cleanup yet is never mistaken for one of these.
+#
+# No external command runs per candidate: `find` alone decides location,
+# name, size and age (its own -name/-size/-mmin, no -exec, one call per
+# size/word pair -- three total, not one per file), and the content check
+# is a plain `read` redirection -- a shell builtin, not a fork. Only the
+# removal batches into chunks of external `rm` calls (and one `comm`/
+# `sort` pair for the re-check -- see agmsg_remove_stale_outcome_files),
+# not one call per file, because an install can be cleaning up several
+# hundred thousand of these.
+#
+# Both entry points are safe to call from a `set -e`/`pipefail` caller
+# (install.sh, doctor.sh both run under it) and never abort one: a failure
+# inside either -- an unreadable temp directory, a mktemp that cannot
+# create a scratch file (the same condition this whole cleanup exists
+# for: a full temp filesystem) -- is reported on stderr and otherwise
+# treated as "found/removed nothing this time", never as a reason to stop
+# whatever called this.
+
+_agmsg_stale_outcome_dir() {
+  printf '%s\n' "${TMPDIR:-/tmp}"
+}
+
+# One path per line, oldest-mtime-unordered. Caller decides what to do with
+# them (print examples, count, remove).
+agmsg_stale_outcome_candidates() {
+  local dir min_age min_minutes size word f base line extra
+  dir="$(_agmsg_stale_outcome_dir)" || return 0
+  [ -d "$dir" ] || return 0
+  min_age="${AGMSG_STALE_OUTCOME_MIN_AGE_S:-600}"
+  case "$min_age" in ''|*[!0-9]*) min_age=600 ;; esac
+  # `find -mmin` only resolves whole minutes; a sub-minute override (tests
+  # use 0, to tell an artificially backdated sample from one just created
+  # without a real wait) rounds down to the whole minute it is less than,
+  # never up to one it is not -- 0 therefore reaches find as +0 (anything
+  # with a completed minute of age), not +1 (which a file made moments ago
+  # has not reached and never incorrectly would).
+  min_minutes=$((min_age / 60))
+  for size in 3:ok 5:busy 7:failed; do
+    word="${size#*:}"; size="${size%%:*}"
+    while IFS= read -r f; do
+      [ -n "$f" ] || continue
+      base="${f##*/}"
+      [[ "$base" =~ ^tmp\.[A-Za-z0-9]{10}$ ]] || continue
+      # Size is already pinned to exactly $size bytes (find -size below),
+      # and that is paired to exactly one word -- see the header comment
+      # for why content alone, at any size, is not enough on its own.
+      line="" extra=""
+      { IFS= read -r line && ! IFS= read -r extra; } < "$f" 2>/dev/null || continue
+      [ -z "$extra" ] || continue
+      [ "$line" = "$word" ] && printf '%s\n' "$f"
+    done < <(find "$dir" -maxdepth 1 -type f -name 'tmp.??????????' \
+      -size "${size}c" -mmin "+$min_minutes" 2>/dev/null)
+  done
+  return 0
+}
+
+# Removes the paths given on stdin (one per line, as
+# agmsg_stale_outco
```

**File**: `tests/test_doctor.bats` (modified, +53/-0)
```diff
@@ -654,3 +654,56 @@ configured_off() {
   [ -d "$TEST_SKILL_DIR/teams/team/.config.lock" ]          # names its holder: kept
   [ -f "$TEST_SKILL_DIR/teams/team/.config.lock.holder" ]
 }
+
+# --- leaked storage sync driver outcome files (#1572) ----------------------
+
+@test "doctor: reports and removes only the storage sync driver's leaked outcome files, never another tool's temp file (#1572)" {
+  local tmp_dir="$TEST_SKILL_DIR/tmp"
+  mkdir -p "$tmp_dir/sub"
+
+  # Should be removed: right location, right name, right content, old enough.
+  printf 'ok\n' > "$tmp_dir/tmp.AAAAAAAAAA"
+  printf 'busy\n' > "$tmp_dir/tmp.BBBBBBBBBB"
+  printf 'failed\n' > "$tmp_dir/tmp.CCCCCCCCCC"
+  touch -t 202001010000 "$tmp_dir"/tmp.AAAAAAAAAA "$tmp_dir"/tmp.BBBBBBBBBB "$tmp_dir"/tmp.CCCCCCCCCC
+
+  # Should survive: each wrong on exactly one of the four conditions.
+  printf 'ok\n' > "$tmp_dir/tmp.DDDDDDDDDD"      # too new (not backdated)
+  printf 'nope\n' > "$tmp_dir/tmp.EEEEEEEEEE"    # wrong content
+  touch -t 202001010000 "$tmp_dir/tmp.EEEEEEEEEE"
+  printf 'ok\n' > "$tmp_dir/tmp.short"            # wrong name shape
+  touch -t 202001010000 "$tmp_dir/tmp.short"
+  printf 'ok\n' > "$tmp_dir/sub/tmp.FFFFFFFFFF"  # right everything, wrong location (subdirectory)
+  touch -t 202001010000 "$tmp_dir/sub/tmp.FFFFFFFFFF"
+  printf 'ok\n\0' > "$tmp_dir/tmp.GGGGGGGGGG"    # "ok\n" plus a trailing NUL -- 4 bytes, not 3
+  touch -t 202001010000 "$tmp_dir/tmp.GGGGGGGGGG"
+  printf 'ok\n\0\0' > "$tmp_dir/tmp.HHHHHHHHHH"  # "ok\n" plus two trailing NULs -- 5 bytes
+  touch -t 202001010000 "$tmp_dir/tmp.HHHHHHHHHH"  # (busy's size), but reads back as "ok", not "busy"
+
+  run env TMPDIR="$tmp_dir" bash "$SCRIPTS/doctor.sh"
+  [ "$status" -eq 1 ]
+  grep -qF 'leaked storage sync driver outcome files' <<<"$output"
+  grep -qF '(3):' <<<"$output"
+  grep -qF "$tmp_dir/tmp.AAAAAAAAAA" <<<"$output"
+  grep -qF "$tmp_dir/tmp.BBBBBBBBBB" <<<"$output"
+  grep -qF "$tmp_dir/tmp.CCCCCCCCCC" <<<"$output"
+  [ -z "$(grep -F 'tmp.DDDDDDDDDD' <<<"$output")" ]
+  [ -z "$(grep -F 'tmp.EEEEEEEEEE' <<<"$output")" ]
+  [ -z "$(grep -F 'tmp.short' <<<"$output")" ]
+  [ -z "$(grep -F 'tmp.FFFFFFFFFF' <<<"$output")" ]
+  [ -z "$(grep -F 'tmp.GGGGGGGGGG' <<<"$output")" ]
+  [ -z "$(grep -F 'tmp.HHHHHHHHHH' <<<"$output")" ]
+  [ -f "$tmp_dir/tmp.AAAAAAAAAA" ]   # reporting deletes nothing
+
+  run env TMPDIR="$tmp_dir" bash "$SCRIPTS/doctor.sh" --fix --yes
+  [ "$status" -eq 0 ]
+  [ ! -e "$tmp_dir/tmp.AAAAAAAAAA" ]
+  [ ! -e "$tmp_dir/tmp.BBBBBBBBBB" ]
+  [ ! -e "$tmp_dir/tmp.CCCCCCCCCC" ]
+  [ -f "$tmp_dir/tmp.DDDDDDDDDD" ]
+  [ -f "$tmp_dir/tmp.EEEEEEEEEE" ]
+  [ -f "$tmp_dir/tmp.short" ]
+  [ -f "$tmp_dir/sub/tmp.FFFFFFFFFF" ]
+  [ -f "$tmp_dir/tmp.GGGGGGGGGG" ]
+  [ -f "$tmp_dir/tmp.HHHHHHHHHH" ]
+}
```

**File**: `tests/test_helper.bash` (modified, +39/-1)
```diff
@@ -48,7 +48,17 @@ setup_test_env() {
   unset HERDR_ENV HERDR_PANE_ID HERDR_SOCKET_PATH HERDR_WORKSPACE_ID HERDR_TAB_ID HERDR_SESSION HERDR_BIN_PATH HERDR_STARTUP_CWD
   unset CLAUDE_CONFIG_DIR
   unset AGMSG_SESSION_ID CLAUDE_CODE_SESSION_ID CODEX_THREAD_ID
-  export TEST_SKILL_DIR="$(mktemp -d)"
+  # Saved ONCE (first call wins, via :=): a test that calls teardown_test_env
+  # and then setup_test_env again within its OWN body (several in
+  # test_remote.bats do, to re-enter with a different fixture) would
+  # otherwise have this SECOND call's `mktemp -d` run under the FIRST call's
+  # already-overridden TMPDIR (set below) -- pointed inside the very
+  # TEST_SKILL_DIR teardown just removed, so it fails outright. Always
+  # create TEST_SKILL_DIR under the REAL root, never under whatever TMPDIR
+  # setup_test_env itself last left behind.
+  : "${AGMSG_TEST_REAL_TMPDIR:=${TMPDIR:-/tmp}}"
+  export AGMSG_TEST_REAL_TMPDIR
+  export TEST_SKILL_DIR="$(TMPDIR="$AGMSG_TEST_REAL_TMPDIR" mktemp -d)"
   mkdir -p "$TEST_SKILL_DIR"/{scripts,db,teams}
 
   # Copy all scripts to isolated skill dir. Recursive so nested helper dirs
@@ -78,6 +88,27 @@ setup_test_env() {
   # export is scoped to the test and needs no restore. See #41.
   export HOME="$TEST_SKILL_DIR/home"
   mkdir -p "$HOME"
+
+  # Same reasoning as HOME above, now needed for a second path: doctor.sh's
+  # leaked-outcome-file check (#1572 cleanup) scans ${TMPDIR:-/tmp} directly,
+  # installation-wide, by design -- a bare `mktemp` always lands there
+  # regardless of SKILL_DIR. Without this, every test that does not already
+  # set its own TMPDIR would have that check see whatever is really in the
+  # developer's or CI runner's own temp directory at that moment (on a
+  # machine where the real leak this exists for is still happening, that is
+  # not empty), making unrelated tests fail for a reason that has nothing to
+  # do with what they test.
+  #
+  # A SIBLING of TEST_SKILL_DIR under the real root, not a subdirectory of
+  # it: several tests build their own fixture (a "project" dir, typically)
+  # with a bare `mktemp -d`, and more than one of those compares that path
+  # against SKILL_DIR to tell "this install's own files" apart from "a
+  # project's own" -- nesting TMPDIR inside TEST_SKILL_DIR put every such
+  # fixture inside the skill's own tree too, so those tests saw their own
+  # project as part of the skill. #1038's delivery test is the one CI
+  # caught; there may be others the same way, hence the sibling instead.
+  export AGMSG_TEST_TMPDIR="$(TMPDIR="$AGMSG_TEST_REAL_TMPDIR" mktemp -d)"
+  export TMPDIR="$AGMSG_TEST_TMPDIR"
 }
 
 # PIDs (one per line, this shell excluded) whose command line references <dir>.
@@ -179,6 +210,13 @@ _actas_session_path() {   # <team> <agent>
 }
 
 teardown_test_env() {
+  # Belt and braces alongside setup_test_env's own fix above: put TMPDIR back
+  # to the real root before removing AGMSG_TEST_TMPDIR (where this test's
+  # TMPDIR pointed) and TEST_SKILL_DIR, so nothing run between this teardown
+  # and a later setup -- in this test or, if a suite ever stopped resetting
+  # it per test, a later one -- reads a TMPDIR that no longer exists.
+  [ -n "${AGMSG_TEST_REAL_TMPDIR:-}" ] && export TMPDIR="$AGMSG_TEST_REAL_TMPDIR"
+  [ -n "${AGMSG_TEST_TMPDIR:-}" ] && rm -rf "$AGMSG_TEST_TMPDIR" 2>/dev/null
   # Try the plain rm FIRST, and only reap when it actually fails. The reaper's scan is a
   # full `ps -eo pid=,args=`; running it in EVERY teardown would add that cost to all of
   # the (vast majority of) tests that hold nothing — across the suite's hundreds of tests
```

---

### Incident Patch 2: `fecdd8a9` (2026-10-05)
**Commit Message**: fix(sync): remove the storage driver's outcome file on every exit (#1572)

storage-sync-driver.sh creates its outcome file with a bare mktemp and relied on an EXIT trap to remove it. storage_sync_apply_pull and storage_sync_apply_read_state set their own EXIT trap partway through and clear it on return, which silently replaced the driver's trap. Every successful apply or read-apply therefore left one 3-byte file ("ok") in the temp directory: on a long-running synced team this filled a Linux tmpfs until it ran out of inodes, and on macOS it accumulated hundreds of thousands of files in $TMPDIR. The driver now removes the file explicitly before each exit. The test wraps mktemp on PATH to find the file the real driver created and fails if the explicit removal is undone.

**File**: `scripts/internal/storage-sync-driver.sh` (modified, +15/-0)
```diff
@@ -72,6 +72,21 @@ esac || rc=$?
 if [ "$rc" -ne 0 ] && [ "$(cat "$AGMSG_SQLITE_OUTCOME_FILE" 2>/dev/null)" = busy ]; then
   printf 'agmsg: sqlite-sync: %s: the store is busy -- another writer held it past the %sms busy timeout (SQLITE_BUSY); this is not a failed check, the same call succeeds once that writer is done\n' \
     "$op" "${AGMSG_BUSY_TIMEOUT:-5000}" >&2
+  rm -f "$AGMSG_SQLITE_OUTCOME_FILE"
   exit 11
 fi
+# Explicit, not left to the EXIT trap above: storage_sync_apply_pull and
+# storage_sync_apply_read_state each set their OWN `trap ... EXIT INT TERM
+# HUP` for their own sql file partway through (sqlite-sync.sh), and a bash
+# trap for one signal replaces the previous handler rather than stacking --
+# so by the time either of those returns, the EXIT trap above has already
+# been silently replaced (or cleared) and no longer removes this file. That
+# happens on every ordinary, successful call to either operation, not only
+# on a hang or a kill, and was the actual cause of the real /tmp fill this
+# guards against -- not stacking traps to recover the old one back is the
+# point: it is also depended on directly by every test that calls the
+# sqlite-sync.sh functions on their own, without this driver process (and,
+# inside this one process, by `_agmsg_sqlite_recording`'s outcome write
+# itself needing the file to still exist for the busy check above).
+rm -f "$AGMSG_SQLITE_OUTCOME_FILE"
 exit "$rc"
```

**File**: `tests/test_remote_sync.bats` (modified, +64/-0)
```diff
@@ -996,6 +996,70 @@ _reconcile_one_ack_wire() {
   [ "$(sqlite3 "$db" "SELECT count(*) FROM messages WHERE body='arrived from elsewhere';" | tr -d '\r')" -eq 1 ]
 }
 
+# Regression: a successful apply used to leave storage-sync-driver.sh's own
+# AGMSG_SQLITE_OUTCOME_FILE (a bare `mktemp`, default name) on disk forever.
+# storage_sync_apply_pull sets its OWN `trap ... EXIT INT TERM HUP` for its sql
+# file partway through, and bash traps for one signal replace the previous
+# handler rather than stacking -- so the driver's outer trap, installed before
+# calling into here, was silently discarded on every call that reached this
+# function, not only on a crash or a kill. Run through the real driver
+# process (not a direct function call, like every other test in this file) so
+# this exercises the exact trap that was lost.
+@test "sync contract: a successful apply through the real driver process does not leak its own outcome file" {
+  # No override surface added to the driver for this: a `mktemp` wrapper is
+  # put ahead of it on PATH instead, recording the one BARE (no-template)
+  # call -- storage-sync-driver.sh's own AGMSG_SQLITE_OUTCOME_FILE -- while
+  # passing every call through to the real mktemp unchanged, templated ones
+  # (sqlite-sync.sh's own sql/jq temp files) included. Scanning the real
+  # system temp directory for an unrelated bare-named file afterward cannot
+  # be done reliably on a shared machine, and a bare `mktemp` ignores
+  # $TMPDIR entirely on macOS, so redirecting TMPDIR would not even reach
+  # the real leak this regresses (that leak landed in the real $TMPDIR on
+  # macOS too).
+  local wrap_dir real_mktemp bare_log outcome_file remote page
+  wrap_dir="$(mktemp -d)"
+  real_mktemp="$(command -v mktemp)"
+  bare_log="$wrap_dir/bare.log"
+  cat > "$wrap_dir/mktemp" <<EOF
+#!/usr/bin/env bash
+if [ "\$#" -eq 0 ]; then
+  result="\$("$real_mktemp")" || exit 1
+  printf '%s\n' "\$result" >> "$bare_log"
+  printf '%s\n' "\$result"
+else
+  exec "$real_mktemp" "\$@"
+fi
+EOF
+  chmod +x "$wrap_dir/mktemp"
+  remote=$(jq -nc '
+    {type:"sync_pull_message",server_seq:"1",
+     id:"550e8400-e29b-41d4-a716-4466554400a2",
+     server_received_at:"2026-07-20T13:00:01.000000Z",
+     envelope:{v:1,cipher:"none",key_id:null,blob:(
+       {body:"driver process apply",created_at:"2026-07-20T13:00:01.000000Z",
+        from_agent:"carol",to_agent:"bob"}|tojson|@base64)},
+     status:"importable",policy_revision:"0",local_security_revision:"0",
+     projection:{body:"driver process apply",created_at:"2026-07-20T13:00:01.000000Z",
+                 from_agent:"carol",to_agent:"bob"}}')
+  page=$(printf '%s\n%s\n' "$remote" '{"type":"sync_pull_cursor","next_after":"1"}')
+  # 3>&- 4>&-: fd 3 is bats' own TAP pipe under this runner; a subprocess that
+  # inherits it (here, through the pipeline inside the `bash -c`) holds it
+  # open past this test, which is what broke every test after this one the
+  # first time (`3: Bad file descriptor`, from a later test's own `run`
+  # finding fd 3 already gone).
+  run env PATH="$wrap_dir:$PATH" bash -c \
+    'printf "%s" "$1" | "$2" apply demo "$3" "$4" 1' \
+    _ "$page" "$SCRIPTS/internal/storage-sync-driver.sh" "$SERVER_ID" "$TEAM_ID" 3>&- 4>&-
+  [ "$status" -eq 0 ]
+  [ -s "$bare_log" ]
+  # Exactly one bare mktemp call is expected (the outcome file). More than
+  # one would mean this wrapper, or the driver's own behavior, changed in a
+  # way this test no longer accounts for -- not something to average over.
+  [ "$(wc -l < "$bare_log" | tr -d ' ')" -eq 1 ]
+  outcome_file="$(cat "$bare_log")"
+  [ ! -e "$outcome_file" ]
+}
+
 # A partial commit is the failure this batch has to be incapable of. It now
 # spans the event, its legacy mirror, the sync mapping and the transport cursor,
 # and the CLI's default is to report a statement error and keep going — so
```

---

### Incident Patch 3: `37aee11d` (2026-10-05)
**Commit Message**: fix(monitor): stop treating a missing TaskList entry as a failed watch (#1571)

The Claude Code Monitor directive called TaskList the reliable check that the watch is running. In the desktop app's Code tab, Monitor runs and delivers events but the task is not listed in TaskList, so the model could keep re-arming or tell the user delivery could not be confirmed. All nine copies of the directive (session start, delivery set, the template overlay, the rendered SKILL.md, README) now say that a missing TaskList entry is not a failure on its own: judge by the Monitor call starting and its events arriving. Retrying or reporting failure is kept for a Monitor call that itself fails. The actas and drop steps stop only a task_id taken from TaskList or returned by this conversation's own Monitor call, never a guessed one, and an empty list no longer means nothing is running.

**File**: `README.md` (modified, +2/-4)
```diff
@@ -278,17 +278,15 @@ For real-time delivery, verify the Claude Code runtime state:
 
 1. `ToolSearch select:Monitor` finds Claude Code's generic `Monitor` tool.
 2. The session starts `Monitor(agmsg inbox stream)` with the `watch.sh ... claude-code` command from the `AGMSG-DIRECTIVE` (or, after `actas <name>`, `Monitor(agmsg inbox stream (acting as <name>))`).
-3. `TaskList` shows a task whose description begins with `agmsg inbox stream` for this session.
-4. The transcript contains a `Monitor event: "agmsg inbox stream"` (or `"agmsg inbox stream (acting as <name>)"`) notification when messages arrive.
+3. The transcript contains a `Monitor event: "agmsg inbox stream"` (or `"agmsg inbox stream (acting as <name>)"`) notification when messages arrive.
 
 These are failure states, even if `delivery.sh status` says `mode: monitor`:
 
-- `TaskList` shows no task whose description begins with `agmsg inbox stream` for this session.
 - `watch.sh` is running only as a Bash/background/nohup shell process, not through the Monitor tool.
 - Tool search finds Azure Monitor, an MCP monitor, or any other monitor-branded tool instead of Claude Code's generic `Monitor` tool.
 - `ToolSearch select:Monitor` cannot find a generic `Monitor` tool.
 
-The background-task footer is not a reliable signal either way — it does not consistently reflect whether a Monitor is really streaming for this session, so check `TaskList` instead. If the Monitor tool is unavailable, use `turn` delivery or manual `/agmsg` inbox checks as a fallback. Those modes still deliver queued messages, but they are not real-time monitor delivery.
+TaskList may list this task, but not every environment does (the desktop app's Code tab runs the Monitor and delivers its events without listing it), so a task missing from TaskList is not a failure: judge by the Monitor call starting and its events arriving. The background-task footer is not a reliable check either. If the Monitor tool is unavailable, use `turn` delivery or manual `/agmsg` inbox checks as a fallback. Those modes still deliver queued messages, but they are not real-time monitor delivery.
 
 ### Migrating from legacy `hook on/off`
 
```

**File**: `SKILL.md` (modified, +8/-8)
```diff
@@ -201,9 +201,9 @@ If argument starts with "actas" followed by an agent name (e.g. "actas alice"):
     - `status=held team=<team> owner=<sid>`: another live session currently owns `<name>` in `<team>`. Tell the user: "Cannot actas as `<name>` — it is held by session `<sid>` in team `<team>`. Run `/agmsg drop <name>` in that session first, then retry." Then abort — do NOT touch the running Monitor.
     - `status=not_registered`: shouldn't happen if step 3 ran; treat as an error.
 5. **Switch receive too — exclusive role mode.**
-   a. Run TaskList. Find any task whose description begins with "agmsg inbox stream".
-   b. **If a matching task is found**: TaskStop it.
-   c. **If no matching task is found** (typical when /agmsg actas runs as the first command of a fresh session — SessionStart hasn't fired the Monitor directive yet, or you're invoking actas before the agent acted on it): skip TaskStop entirely. There is no Monitor to stop. Do NOT attempt TaskStop with a guessed or empty task_id — it will fail with "Invalid tool parameters" and confuse the flow.
+   a. Find this session's agmsg watch Monitor task: a task in TaskList whose description begins with "agmsg inbox stream", or the task_id returned by a Monitor call you made earlier in this conversation. Not every environment lists Monitor tasks in TaskList, so an empty list does not mean none is running.
+   b. **If you have such a task_id**: TaskStop it.
+   c. **If you have none** (typical when /agmsg actas runs as the first command of a fresh session — SessionStart hasn't fired the Monitor directive yet, or you're invoking actas before the agent acted on it): skip TaskStop. Do NOT attempt TaskStop with a guessed or empty task_id — it will fail with "Invalid tool parameters" and confuse the flow. Starting a new watcher for this session in step d replaces any previous one.
    d. Run `~/.agents/skills/agmsg/scripts/delivery.sh status claude-code "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode: both`**: invoke a fresh Monitor, regardless of whether step b or c applied:
         - command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name> --max-seconds=1750`
@@ -219,14 +219,14 @@ If argument starts with "actas" followed by an agent name (e.g. "actas alice"):
 6. Set the session's active FROM to `<name>` — use `<name>` in every `send.sh` call for the rest of this session.
 7. Tell the user: "Now acting as `<name>`. Sends use `<name>` as from; receive restricted to `<name>` only."
 8. **Only if this session was NOT launched via `spawn`** — check the environment variable `AGMSG_SPAWNED` (e.g. `printenv AGMSG_SPAWNED`): `spawn` exports `AGMSG_SPAWNED=1` and already named the session `<team>-<agent>` via `-n`, so when it is set, **skip this tip entirely**. When it is UNSET (a human typed `claude` then actas'd, so the session has no convention name), additionally suggest to the user: "Tip: rename this session to `<team>-<name>` with `/rename <team>-<name>` so it's easy to find in the `/resume` picker and stays labeled after a restart." `/rename` is a user-typed slash command — you cannot invoke it yourself, so only suggest it.
-9. **Confirm the Monitor actually attached** — only when step 5d invoked a fresh Monitor (`mode: monitor` or `mode: both`): run TaskList once more and confirm a task whose description begins with `agmsg inbox stream` is present. Do NOT read this off the terminal UI's background-task footer — it does not reliably reflect whether a Monitor is really streaming for this session; TaskList is the only check that does. If the task is missing, retry the Monitor invocation from step 5d once. If it is still missing after the retry, tell the user `actas` completed but delivery could not be confirmed as attached, and do not describe delivery as active.
+9. **Confirm the Monitor actually attached** — only when step 5d invoked a fresh Monitor (`mode: monitor` or `mode: both`): confirm the Monitor call from step 5d started (it returned a task id rather than an error). TaskList may list this task, but not every environment does (the desktop app's Code tab runs the Monitor and delivers its events without listing it), so a task missing from TaskList is not a failure: judge by the Monitor call starting and its events arriving. The background-task footer is not a reliable check either. If the Monitor call failed, retry the invocation from step 5d once. If it still fails after the retry, tell the user `actas` completed but delivery could not be confirmed as attached, and do not describe delivery as active.
 If argument starts with "drop" followed by an agent name (e.g. "drop alice"):
 1. Parse the role name.
 2. Run `~/.agents/skills/agmsg/scripts/reset.sh "$(pwd)" claude-code <name> "$CLAUDE_CODE_SESSION_ID"` to remove only that role's registration for this project. If the role has no other registrations left, reset.sh also drops it from the team config. The 4th argument releases any 
```

**File**: `scripts/delivery.sh` (modified, +10/-11)
```diff
@@ -630,11 +630,10 @@ AGMSG-DIRECTIVE: For this running session, invoke the Monitor tool now with:
 
 Pass the command above verbatim — the session_id is already filled in.
 Use Claude Code's generic Monitor tool only. Do not start this command with
-Bash/background/nohup or a shell task. Success is a TaskList entry whose
-description begins with "agmsg inbox stream" (after actas it reads
-"agmsg inbox stream (acting as <name>)") and, once messages arrive, a
-transcript event named to match. The background-task footer is not a
-reliable check either way; use TaskList. If ToolSearch cannot find the
+Bash/background/nohup or a shell task. Success is the Monitor call starting
+(description "agmsg inbox stream", after actas "agmsg inbox stream (acting as
+<name>)") and, once messages arrive, a transcript event named to match.
+TaskList may list this task, but not every environment does (the desktop app's Code tab runs the Monitor and delivers its events without listing it), so a task missing from TaskList is not a failure: judge by the Monitor call starting and its events arriving. The background-task footer is not a reliable check either. If ToolSearch cannot find the
 generic Monitor tool, use turn/manual inbox as a fallback; that is not
 real-time monitor delivery.${rearm_note}
 EOF
@@ -643,10 +642,11 @@ EOF
 emit_stop_directive() {
   cat <<'EOF'
 
-AGMSG-DIRECTIVE: If an agmsg watch Monitor task is running in this session,
-find it with TaskList (description starts with "agmsg inbox stream") and
-stop it with TaskStop. Existing watch.sh processes have already been killed
-by this command.
+AGMSG-DIRECTIVE: If you know of an agmsg watch Monitor task running in this
+session (listed by TaskList with a description that starts with "agmsg inbox
+stream", or the task_id returned by your own Monitor call), stop it with
+TaskStop; do not guess a task_id. Existing watch.sh processes have already been
+killed by this command.
 EOF
 }
 
@@ -972,8 +972,7 @@ do_status() {
 note: status reports configured hooks only. For real-time delivery, Claude Code
 must also have a generic Monitor task running in the current session whose
 description begins with "agmsg inbox stream" (after actas: "agmsg inbox
-stream (acting as <name>)"). Verify with TaskList, not the background-task
-footer — the footer is not a reliable signal either way. A watch.sh started
+stream (acting as <name>)"). TaskList may list this task, but not every environment does (the desktop app's Code tab runs the Monitor and delivers its events without listing it), so a task missing from TaskList is not a failure: judge by the Monitor call starting and its events arriving. The background-task footer is not a reliable check either. A watch.sh started
 as a shell/background/nohup task instead of through the Monitor tool is not
 real-time delivery even while its process stays alive.
 EOF
```

**File**: `scripts/drivers/types/claude-code/template.md` (modified, +8/-8)
```diff
@@ -59,9 +59,9 @@ If argument starts with "actas" followed by an agent name (e.g. "actas alice"):
     - `status=held team=<team> owner=<sid>`: another live session currently owns `<name>` in `<team>`. Tell the user: "Cannot actas as `<name>` — it is held by session `<sid>` in team `<team>`. Run `/__SKILL_NAME__ drop <name>` in that session first, then retry." Then abort — do NOT touch the running Monitor.
     - `status=not_registered`: shouldn't happen if step 3 ran; treat as an error.
 5. **Switch receive too — exclusive role mode.**
-   a. Run TaskList. Find any task whose description begins with "agmsg inbox stream".
-   b. **If a matching task is found**: TaskStop it.
-   c. **If no matching task is found** (typical when /__SKILL_NAME__ actas runs as the first command of a fresh session — SessionStart hasn't fired the Monitor directive yet, or you're invoking actas before the agent acted on it): skip TaskStop entirely. There is no Monitor to stop. Do NOT attempt TaskStop with a guessed or empty task_id — it will fail with "Invalid tool parameters" and confuse the flow.
+   a. Find this session's agmsg watch Monitor task: a task in TaskList whose description begins with "agmsg inbox stream", or the task_id returned by a Monitor call you made earlier in this conversation. Not every environment lists Monitor tasks in TaskList, so an empty list does not mean none is running.
+   b. **If you have such a task_id**: TaskStop it.
+   c. **If you have none** (typical when /__SKILL_NAME__ actas runs as the first command of a fresh session — SessionStart hasn't fired the Monitor directive yet, or you're invoking actas before the agent acted on it): skip TaskStop. Do NOT attempt TaskStop with a guessed or empty task_id — it will fail with "Invalid tool parameters" and confuse the flow. Starting a new watcher for this session in step d replaces any previous one.
    d. Run `~/.agents/skills/__SKILL_NAME__/scripts/delivery.sh status __AGENT_TYPE__ "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode: both`**: invoke a fresh Monitor, regardless of whether step b or c applied:
         - command: `~/.agents/skills/__SKILL_NAME__/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" __AGENT_TYPE__ <name> --max-seconds=1750`
@@ -77,17 +77,17 @@ If argument starts with "actas" followed by an agent name (e.g. "actas alice"):
 6. Set the session's active FROM to `<name>` — use `<name>` in every `send.sh` call for the rest of this session.
 7. Tell the user: "Now acting as `<name>`. Sends use `<name>` as from; receive restricted to `<name>` only."
 8. **Only if this session was NOT launched via `spawn`** — check the environment variable `AGMSG_SPAWNED` (e.g. `printenv AGMSG_SPAWNED`): `spawn` exports `AGMSG_SPAWNED=1` and already named the session `<team>-<agent>` via `-n`, so when it is set, **skip this tip entirely**. When it is UNSET (a human typed `claude` then actas'd, so the session has no convention name), additionally suggest to the user: "Tip: rename this session to `<team>-<name>` with `/rename <team>-<name>` so it's easy to find in the `/resume` picker and stays labeled after a restart." `/rename` is a user-typed slash command — you cannot invoke it yourself, so only suggest it.
-9. **Confirm the Monitor actually attached** — only when step 5d invoked a fresh Monitor (`mode: monitor` or `mode: both`): run TaskList once more and confirm a task whose description begins with `agmsg inbox stream` is present. Do NOT read this off the terminal UI's background-task footer — it does not reliably reflect whether a Monitor is really streaming for this session; TaskList is the only check that does. If the task is missing, retry the Monitor invocation from step 5d once. If it is still missing after the retry, tell the user `actas` completed but delivery could not be confirmed as attached, and do not describe delivery as active.
+9. **Confirm the Monitor actually attached** — only when step 5d invoked a fresh Monitor (`mode: monitor` or `mode: both`): confirm the Monitor call from step 5d started (it returned a task id rather than an error). TaskList may list this task, but not every environment does (the desktop app's Code tab runs the Monitor and delivers its events without listing it), so a task missing from TaskList is not a failure: judge by the Monitor call starting and its events arriving. The background-task footer is not a reliable check either. If the Monitor call failed, retry the invocation from step 5d once. If it still fails after the retry, tell the user `actas` completed but delivery could not be confirmed as attached, and do not describe delivery as active.
 <!-- /agmsg:slot actas -->
 
 <!-- agmsg:slot drop -->
 If argument starts with "drop" followed by an agent name (e.g. "drop alice"):
 1. Parse the role name.
 2. Run `~/.agents/skills/__SKILL_NAME__/scripts/reset.sh "$(pwd)" __AGENT_TYPE__ <name> "$CLAUDE_CODE_SESSION_ID"` to remove only that role's registration for this project. If th
```

**File**: `scripts/session-start.sh` (modified, +4/-6)
```diff
@@ -494,12 +494,11 @@ monitor-branded tools are not valid for agmsg delivery. Do not start watch.sh
 with Bash/background/nohup or a shell task. Success is:
 
   - Monitor(agmsg inbox stream (acting as $ROLE_NAME)) starts
-  - TaskList shows a task whose description begins with "agmsg inbox
-    stream (acting as $ROLE_NAME)" for this session (the reliable check;
-    the background-task footer is not)
   - the transcript later contains Monitor event: "agmsg inbox stream
     (acting as $ROLE_NAME)"
 
+TaskList may list this task, but not every environment does (the desktop app's Code tab runs the Monitor and delivers its events without listing it), so a task missing from TaskList is not a failure: judge by the Monitor call starting and its events arriving. The background-task footer is not a reliable check either.
+
 If the generic Monitor tool is unavailable, do not treat a background shell
 watcher as success. Switch to turn delivery or run manual inbox checks instead;
 those fallbacks are not real-time monitor delivery.
@@ -549,11 +548,10 @@ monitor-branded tools are not valid for agmsg delivery. Do not start watch.sh
 with Bash/background/nohup or a shell task. Success is:
 
   - Monitor(agmsg inbox stream) starts
-  - TaskList shows a task whose description begins with "agmsg inbox
-    stream" for this session (the reliable check; the background-task
-    footer is not)
   - the transcript later contains Monitor event: "agmsg inbox stream"
 
+TaskList may list this task, but not every environment does (the desktop app's Code tab runs the Monitor and delivers its events without listing it), so a task missing from TaskList is not a failure: judge by the Monitor call starting and its events arriving. The background-task footer is not a reliable check either.
+
 If the generic Monitor tool is unavailable, do not treat a background shell
 watcher as success. Switch to turn delivery or run manual inbox checks instead;
 those fallbacks are not real-time monitor delivery.
```

**File**: `tests/test_claude_template.bats` (modified, +4/-4)
```diff
@@ -50,16 +50,16 @@ setup() {
   grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name> --max-seconds=1750`' "$RENDERED"
   grep -Fq 'description: `agmsg inbox stream (acting as <name>)`' "$RENDERED"
   grep -Fq 'persistent: true' "$RENDERED"
-  grep -Fq 'Run TaskList. Find any task whose description begins with "agmsg inbox stream"' "$RENDERED"
+  grep -Fq 'a task in TaskList whose description begins with "agmsg inbox stream"' "$RENDERED"
   grep -Fq 'status=held team=<team> owner=<sid>' "$RENDERED"
   # drop's own re-subscribe must be equally explicit, not just actas's.
   grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code --max-seconds=1750`' "$RENDERED"
 }
 
-@test "Claude rendered skill's actas ends by confirming the Monitor attached via TaskList, not the UI footer" {
+@test "Claude rendered skill's actas ends by confirming the Monitor attached without treating TaskList as the only check" {
   grep -Fq 'Confirm the Monitor actually attached' "$RENDERED"
-  grep -Fq 'run TaskList once more and confirm a task whose description begins with `agmsg inbox stream` is present' "$RENDERED"
-  grep -Fq 'Do NOT read this off the terminal UI' "$RENDERED"
+  grep -Fq 'a task missing from TaskList is not a failure' "$RENDERED"
+  grep -Fq 'The background-task footer is not a reliable check either.' "$RENDERED"
 }
 
 @test "no rendered skill of any type still carries the unwired 'supplied by the type overlay' placeholder text" {
```

**File**: `tests/test_delivery.bats` (modified, +1/-1)
```diff
@@ -318,7 +318,7 @@ settings_file() {
   # claude-code-only note points at TaskList, not the background-task footer
   # (#270).
   grep -qF -- "configured hooks only" <<<"$output"
-  [[ "$output" == *"Verify with TaskList"* ]]
+  grep -qF -- "a task missing from TaskList is not a failure" <<<"$output"
 }
 
 # A pid that exists but this user cannot signal, so `kill -0` fails with EPERM
```

---

### Incident Patch 4: `bb153a0b` (2026-10-04)
**Commit Message**: fix(actas): drop the previous name's placement record for this pane on a switch (#1568)

Switching names with actas left the previous name's placement record on the same pane, so the new name was refused with "this pane is already recorded for <previous name>" and the warning repeated on every send. After a successful claim, actas now removes the placement record and named marker of another name in the same team that points at this pane, only when that name's actas lock is absent or held by this exact instance (<sid>.<pid>). A record held by another live instance, a bare-session owner or caller, another team's record, or a record for a different pane is kept.

**File**: `scripts/actas-claim.sh` (modified, +8/-1)
```diff
@@ -201,14 +201,21 @@ fi
 # unnamed and unaddressable. watch.sh does the same lookup and was corrected the
 # same way (watch.sh:271); this was the remaining site.
 #
+# `retire_previous "$SESSION_ID"` (the last two arguments) drops this pane's
+# record of the name this session was acting as before, which would otherwise
+# read as another seat's and refuse this one; see
+# _agmsg_placement_retire_previous. The composite $SESSION_ID is what the actas
+# locks are owned by, so it is what a seat's lock is compared with. Only this
+# call site passes them, and only here, after the claim above has won.
+#
 # Once per claimed team, mirroring the role-session loop above: each (team, role)
 # gets its own record, because that pair is what peek/poke resolve by. The
 # VISIBLE pane name is whichever team comes last — panes have one name and a role
 # in two teams is one pane. Stable, since the order is $TEAMS'.
 if declare -F agmsg_terminal_name_self_safe >/dev/null 2>&1; then
   while IFS= read -r team; do
     [ -z "$team" ] && continue
-    agmsg_terminal_name_self_safe "$BARE_SID" "$team" "$NAME" "$PROJECT_PHYS" "$TYPE" record || true
+    agmsg_terminal_name_self_safe "$BARE_SID" "$team" "$NAME" "$PROJECT_PHYS" "$TYPE" record retire_previous "$SESSION_ID" || true
   done <<< "$TEAMS"
 fi
 
```

**File**: `scripts/lib/terminal-registry.sh` (modified, +113/-4)
```diff
@@ -913,14 +913,18 @@ _agmsg_placement_split() {   # <ref>
   return 0
 }
 
-# <ref> <team> <agent>
+# <ref> <team> <agent> [all]
 #   Prints the claimant as its record file spells it ("<team>__<agent>", encoded)
 #   when ANOTHER seat's record claims this pane; prints nothing when the pane is
 #   unclaimed. Returns 1 when this seat's OWN ref cannot be parsed: ownership is
 #   then undecidable and the caller must not name or record (fail-closed).
+#
+#   With "all" it prints EVERY record that points at this pane, one per line, and
+#   skips a record whose ref cannot be read: "it cannot be ruled out as this
+#   pane" is a reason to refuse, and not a reason to take anything away.
 _agmsg_placement_claimed_by() {
-  local ref="$1" team="$2" agent="$3" dir f first mine enc_agent t is_mine
-  local want_term want_id want_sock
+  local ref="$1" team="$2" agent="$3" mode="${4:-first}" dir f first mine enc_agent t is_mine
+  local want_term want_id want_sock out=""
   _agmsg_placement_split "$ref" || return 1          # undecidable, not "unclaimed"
   want_term="$_AGMSG_PS_TERM"; want_id="$_AGMSG_PS_ID"; want_sock="$_AGMSG_PS_SOCK"
   mine="$(agmsg_spawn_path "$team" "$agent")" || return 1
@@ -952,6 +956,7 @@ _agmsg_placement_claimed_by() {
     # it lets a person drop it; waving it through is the fail-open this guard
     # exists to close.
     if [ -z "$first" ] || ! _agmsg_placement_split "$first"; then
+      if [ "$mode" = all ]; then continue; fi
       printf '%s' "${f##*/spawn.}"
       return 0
     fi
@@ -967,9 +972,108 @@ _agmsg_placement_claimed_by() {
        && [ "$_AGMSG_PS_SOCK" != "$want_sock" ]; then
       continue                                # different servers, different panes
     fi
+    if [ "$mode" = all ]; then
+      out="${out}${f##*/spawn.}"$'\n'
+      continue
+    fi
     printf '%s' "${f##*/spawn.}"
     return 0
   done
+  if [ "$mode" = all ]; then printf '%s' "$out"; fi
+  return 0
+}
+
+# The seat this session just stopped being. A session that acts as <agent> after
+# acting as another name in the SAME pane leaves the first name's record
+# pointing at the pane, and the placement guard then reads it as a rival: the new
+# name is neither named nor recorded, and warns on every action.
+#
+# Drops, of the records that point at THIS pane (the scan above, "all"), only
+# those that belong to a seat of THIS team and whose seat has no actas lock or
+# whose lock this very process holds, together with that seat's naming mark.
+#
+# THIS PROCESS, not this session id. A lock's owner is "<sid>.<pid>", and a
+# second process can carry the same sid (a resumed or forked session), so the
+# owner is compared whole against <instance>, the composite the claim itself
+# used; peeling the pid off made another live process's seat read as ours.
+# An owner, or an instance, that is only a bare sid cannot be shown not to be
+# another process's, so the record is kept.
+#
+# THIS TEAM, decided exactly: the candidates are the record paths of the team's
+# registered members, computed through agmsg_spawn_path -- never by cutting a
+# file name, because "__" is legal inside a name. A record of another team that
+# points at this pane is kept (and still refuses the new name, which is the
+# fail-closed side).
+#
+# Not touched either: a record for another pane, a seat another session holds, a
+# lock that cannot be read, and a record whose pane cannot be read. The new
+# name is only claimed once this has run, so every one of those keeps refusing
+# it exactly as before.
+#
+#   _agmsg_placement_retire_previous <ref> <team> <agent> <instance id>
+_agmsg_placement_retire_previous() {
+  local ref="$1" team="$2" agent="$3" instance="$4" suffixes s dir mine lock lockread owner role rt ra
+  local cfg esc m cand="" inteam
+  [ -n "$ref" ] && [ -n "$instance" ] || return 0
+  suffixes="$(_agmsg_placement_claimed_by "$ref" "$team" "$agent" all)" || return 0
+  [ -n "$suffixes" ] || return 0
+  mine="$(agmsg_spawn_path "$team" "$agent")" || return 0
+  dir="$(dirname "$mine")"
+  cfg="$(dirname "$dir")/teams/$team/config.json"
+  [ -f "$cfg" ] || return 0
+  esc="$(sed "s/'/''/g" "$cfg" 2>/dev/null)" || return 0
+  while IFS= read -r m; do
+    [ -n "$m" ] && [ "$m" != "$agent" ] || continue
+    cand="${cand}$(agmsg_spawn_path "$team" "$m" 2>/dev/null)"$'\n'
+  done <<EOF
+$(sqlite3 :memory: "SELECT key FROM json_each(json_extract('$esc', '\$.agents'));" 2>/dev/null | tr -d '\r')
+EOF
+  [ -n "$cand" ] || return 0
+  while IFS= read -r s; do
+    [ -n "$s" ] || continue
+    inteam=0
+    while IFS= read -r m; do
+      if [ -n "$m" ] && [ "$m" = "$dir/spawn.$s" ]; then inteam=1; break; fi
+    done <<EOF
+$cand
+EOF
+    [ "$inteam" -eq 1 ] || continue
+    lock="$dir/actas.$s.session"
+    lockread="$(_actas_lock_read_path "$lock")" || continue
+    case "${lockread%%$'\t'*}" in
+      absent) ;;
+      ok)
+        owner="${lockread#*$'\t'}"
+        [ "$owner" = "$instance" ] || continue
+        
```

**File**: `tests/test_self_name.bats` (modified, +68/-0)
```diff
@@ -293,6 +293,74 @@ _placement() {   # <team> <agent> -> "<terminal>:<id>" or empty
   # alice keeps everything.
   [ "$(_mark team alice)" = $'tmux:/tmp/s:%3\tpid=4242' ]
   [ "$(_placement team alice)" = 'tmux:/tmp/s:%3' ]
+
+  # An actas is different: the session is declaring that it now acts as bob, and
+  # alice was the name it acted as in this very pane a moment ago. Her record
+  # would otherwise refuse bob forever, so the claim retires it -- but only the
+  # records that point at THIS pane and belong to no other live session.
+  #   - alice in another team has a record for another pane: untouched
+  #   - a seat that another session holds, in another pane: its record stays and
+  #     it still refuses whoever acts from that pane
+  #   - a seat held by ANOTHER PROCESS OF THE SAME SESSION ID (the lock owner is
+  #     "<sid>.<pid>", and only the whole thing says whose it is): kept
+  #   - a record of ANOTHER TEAM that points at the same pane and has no lock:
+  #     kept, so the name acting from there is still refused
+  _join_unnamed team bob
+  _join_unnamed team2 alice
+  _join_unnamed team eve
+  _join_unnamed team frank
+  source "$SKILL_DIR/scripts/lib/actas-lock.sh"
+  agmsg_write_atomic "$(agmsg_spawn_path team2 alice)" "$(printf 'tmux:/tmp/s:%%9\t/tmp/p\tclaude-code')"
+  agmsg_write_atomic "$(agmsg_spawn_path team eve)" "$(printf 'tmux:/tmp/s:%%5\t/tmp/p\tclaude-code')"
+  printf 'other-session.99999\n' > "$(actas_lock_path team eve)"
+
+  run bash "$SKILL_DIR/scripts/actas-claim.sh" /tmp/p claude-code bob sid-bob
+  [ "$status" -eq 0 ]
+  grep -q 'status=ok' <<<"$output"
+  [ "$(_placement team bob)" = 'tmux:/tmp/s:%3' ]       # bob is named and recorded here now
+  [ -z "$(_placement team alice)" ]                     # alice's record for this pane is gone
+  [ -z "$(_mark team alice)" ]                          # and so is the mark that said she was named here
+  [ "$(_placement team2 alice)" = 'tmux:/tmp/s:%9' ]    # her other placement stays
+
+  _under_tmux /tmp/s 4242 %5
+  run bash "$SKILL_DIR/scripts/actas-claim.sh" /tmp/p claude-code frank sid-frank
+  grep -q 'already recorded as' <<<"$output"            # held by another session: still a rival
+  [ -z "$(_placement team frank)" ]
+  [ "$(_placement team eve)" = 'tmux:/tmp/s:%5' ]
+
+  # Same bare session id, another live process: the lock owner differs only in
+  # its pid, and that is enough for the seat to stay.
+  _join_unnamed team gina
+  _join_unnamed team hank
+  agmsg_write_atomic "$(agmsg_spawn_path team gina)" "$(printf 'tmux:/tmp/s:%%6\t/tmp/p\tclaude-code')"
+  printf 'sid-hank.12345\n' > "$(actas_lock_path team gina)"
+  _under_tmux /tmp/s 4242 %6
+  run bash "$SKILL_DIR/scripts/actas-claim.sh" /tmp/p claude-code hank sid-hank
+  grep -q 'already recorded as' <<<"$output"
+  [ -z "$(_placement team hank)" ]
+  [ "$(_placement team gina)" = 'tmux:/tmp/s:%6' ]
+
+  # A record of another team for the same pane, no lock: not this team's, so not
+  # retired, and it still refuses.
+  _join_unnamed team jack
+  _join_unnamed team2 iris
+  agmsg_write_atomic "$(agmsg_spawn_path team2 iris)" "$(printf 'tmux:/tmp/s:%%7\t/tmp/p\tclaude-code')"
+  _under_tmux /tmp/s 4242 %7
+  run bash "$SKILL_DIR/scripts/actas-claim.sh" /tmp/p claude-code jack sid-jack
+  grep -q 'already recorded as' <<<"$output"
+  [ -z "$(_placement team jack)" ]
+  [ "$(_placement team2 iris)" = 'tmux:/tmp/s:%7' ]
+
+  # Owner and instance both BARE: equal, and so no proof of whose the lock is.
+  _join_unnamed team lena
+  _join_unnamed team mark
+  agmsg_write_atomic "$(agmsg_spawn_path team lena)" "$(printf 'tmux:/tmp/s:%%8\t/tmp/p\tclaude-code')"
+  printf 'shared\n' > "$(actas_lock_path team lena)"
+  _under_tmux /tmp/s 4242 %8
+  run agmsg_terminal_name_self_safe shared team mark /tmp/p claude-code record retire_previous shared
+  grep -q 'already recorded as' <<<"$output"
+  [ -z "$(_placement team mark)" ]
+  [ "$(_placement team lena)" = 'tmux:/tmp/s:%8' ]
 }
 
 # --- order independence with the existing paths -------------------------------------
```

---

### Incident Patch 5: `e1da1581` (2026-10-04)
**Commit Message**: fix(watch): end the Claude Code watch at 1750 seconds, not 1790 (#1561)

The watcher checks --max-seconds only at the top of a poll cycle, so with 1790 a long cycle could still run past the host's 1800-second cap and get killed before printing its re-arm or stop line. The Claude Code launch commands now pass --max-seconds=1750, leaving room for a full cycle. watch.sh is unchanged.

**File**: `SKILL.md` (modified, +2/-2)
```diff
@@ -206,7 +206,7 @@ If argument starts with "actas" followed by an agent name (e.g. "actas alice"):
    c. **If no matching task is found** (typical when /agmsg actas runs as the first command of a fresh session — SessionStart hasn't fired the Monitor directive yet, or you're invoking actas before the agent acted on it): skip TaskStop entirely. There is no Monitor to stop. Do NOT attempt TaskStop with a guessed or empty task_id — it will fail with "Invalid tool parameters" and confuse the flow.
    d. Run `~/.agents/skills/agmsg/scripts/delivery.sh status claude-code "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode: both`**: invoke a fresh Monitor, regardless of whether step b or c applied:
-        - command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name> --max-seconds=1790`
+        - command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name> --max-seconds=1750`
         - description: `agmsg inbox stream (acting as <name>)`
         - persistent: true
         - timeout_ms: 1800000
@@ -229,7 +229,7 @@ If argument starts with "drop" followed by an agent name (e.g. "drop alice"):
    c. **If no matching task is found**: skip TaskStop. Do NOT attempt TaskStop with a guessed or empty task_id.
    d. Run `~/.agents/skills/agmsg/scripts/delivery.sh status claude-code "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode: both`**: invoke a fresh Monitor with the default subscription (no `actas` name filter — receives every (team, agent) pair currently registered for this project that isn't held by another session):
-        - command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code --max-seconds=1790`
+        - command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code --max-seconds=1750`
         - description: `agmsg inbox stream`
         - persistent: true
         - timeout_ms: 1800000
```

**File**: `scripts/delivery.sh` (modified, +1/-1)
```diff
@@ -611,7 +611,7 @@ EOF
   # with spaces or apostrophes intact; a plain '...' wrap breaks on /o'brien/...
   # (#188).
   local watch_command
-  watch_command="$(printf '%q %q %q %q' "$watch" "$session_id" "$project" "$type") --max-seconds=1790"
+  watch_command="$(printf '%q %q %q %q' "$watch" "$session_id" "$project" "$type") --max-seconds=1750"
   # The watch renews itself (scripts/watch.sh, _watch_renew_or_stop): launched
   # with --max-seconds it prints one "re-arm" or "stopping" line a
   # little before Claude Code's 30-minute Monitor cap and exits.
```

**File**: `scripts/drivers/types/claude-code/template.md` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ If argument starts with "actas" followed by an agent name (e.g. "actas alice"):
    c. **If no matching task is found** (typical when /__SKILL_NAME__ actas runs as the first command of a fresh session — SessionStart hasn't fired the Monitor directive yet, or you're invoking actas before the agent acted on it): skip TaskStop entirely. There is no Monitor to stop. Do NOT attempt TaskStop with a guessed or empty task_id — it will fail with "Invalid tool parameters" and confuse the flow.
    d. Run `~/.agents/skills/__SKILL_NAME__/scripts/delivery.sh status __AGENT_TYPE__ "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode: both`**: invoke a fresh Monitor, regardless of whether step b or c applied:
-        - command: `~/.agents/skills/__SKILL_NAME__/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" __AGENT_TYPE__ <name> --max-seconds=1790`
+        - command: `~/.agents/skills/__SKILL_NAME__/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" __AGENT_TYPE__ <name> --max-seconds=1750`
         - description: `agmsg inbox stream (acting as <name>)`
         - persistent: true
         - timeout_ms: 1800000
@@ -90,7 +90,7 @@ If argument starts with "drop" followed by an agent name (e.g. "drop alice"):
    c. **If no matching task is found**: skip TaskStop. Do NOT attempt TaskStop with a guessed or empty task_id.
    d. Run `~/.agents/skills/__SKILL_NAME__/scripts/delivery.sh status __AGENT_TYPE__ "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode: both`**: invoke a fresh Monitor with the default subscription (no `actas` name filter — receives every (team, agent) pair currently registered for this project that isn't held by another session):
-        - command: `~/.agents/skills/__SKILL_NAME__/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" __AGENT_TYPE__ --max-seconds=1790`
+        - command: `~/.agents/skills/__SKILL_NAME__/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" __AGENT_TYPE__ --max-seconds=1750`
         - description: `agmsg inbox stream`
         - persistent: true
         - timeout_ms: 1800000
```

**File**: `scripts/session-start.sh` (modified, +1/-1)
```diff
@@ -452,7 +452,7 @@ WATCH="$SKILL_DIR/scripts/watch.sh"
 REARM_NOTE="
 This watch renews itself. A little before the 30-minute cap it prints one line on its own and exits: on \`agmsg watch: re-arm - ...\`, invoke Monitor again with exactly the command and description that line names (persistent: true, timeout_ms: 1800000), silently — no message to the user, no \"re-armed\", no acknowledgement, no summary, since announcing it every 30 minutes wastes tokens for no benefit; on \`agmsg watch: stopping - ...\`, do not re-arm it. If the watch is instead killed at the cap and no such line arrived (an agmsg install from before this), re-arm it only when the expiry notification says it delivered something."
 # The launch commands below end with the option that turns self-management on.
-WATCH_MAX_ARG="--max-seconds=1790"
+WATCH_MAX_ARG="--max-seconds=1750"
 # Shell-quote each argv so the host can paste the command into Monitor and run
 # it verbatim. A plain '...' wrap breaks on paths with an apostrophe
 # (/Users/o'brien/...); printf %q escapes spaces, quotes and other metacharacters
```

**File**: `tests/test_claude_template.bats` (modified, +2/-2)
```diff
@@ -47,13 +47,13 @@ setup() {
   # way to know watch.sh must be started THROUGH Monitor rather than, say,
   # Bash. These assertions pin the specific facts that summary dropped.
   grep -Fq 'invoke a fresh Monitor' "$RENDERED"
-  grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name> --max-seconds=1790`' "$RENDERED"
+  grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name> --max-seconds=1750`' "$RENDERED"
   grep -Fq 'description: `agmsg inbox stream (acting as <name>)`' "$RENDERED"
   grep -Fq 'persistent: true' "$RENDERED"
   grep -Fq 'Run TaskList. Find any task whose description begins with "agmsg inbox stream"' "$RENDERED"
   grep -Fq 'status=held team=<team> owner=<sid>' "$RENDERED"
   # drop's own re-subscribe must be equally explicit, not just actas's.
-  grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code --max-seconds=1790`' "$RENDERED"
+  grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code --max-seconds=1750`' "$RENDERED"
 }
 
 @test "Claude rendered skill's actas ends by confirming the Monitor attached via TaskList, not the UI footer" {
```

**File**: `tests/test_delivery.bats` (modified, +2/-2)
```diff
@@ -610,7 +610,7 @@ eperm_pid() {
   # "stopping") instead of reading Claude Code's expiry notification.
   # AGMSG_CC_MONITOR_KEEP_ALIVE is read by the watcher, so the directive text
   # is the same with or without it.
-  grep -q 'watch.sh .* --max-seconds=1790' <<<"$output"
+  grep -q 'watch.sh .* --max-seconds=1750' <<<"$output"
   grep -q 'This watch renews itself' <<<"$output"
   grep -qF 'agmsg watch: re-arm - ...' <<<"$output"
   grep -qF 'agmsg watch: stopping - ...' <<<"$output"
@@ -871,7 +871,7 @@ _seed_role_record() {
   local cmdline; cmdline=$(printf '%s\n' "$output" | sed -n 's/^[[:space:]]*command: //p')
   eval "set -- $cmdline"
   [ "$#" -eq 5 ]
-  [ "$5" = "--max-seconds=1790" ]
+  [ "$5" = "--max-seconds=1750" ]
 }
 
 @test "session-start: a record for a role not registered here is ignored (#339)" {
```

**File**: `tests/test_resume_seat_guard.bats` (modified, +1/-1)
```diff
@@ -135,7 +135,7 @@ _run_session_start() {
   eval "set -- $cmd"
   [ "$#" -eq 6 ]
   [ "$5" = "bob" ]
-  [ "$6" = "--max-seconds=1790" ]
+  [ "$6" = "--max-seconds=1750" ]
 }
 
 @test "resume, role-session record present: says recorded, not the actas-lock basis" {
```

---

### Incident Patch 6: `0ce2f3dd` (2026-10-02)
**Commit Message**: fix(lock): break a registry lock only when its recorded holder is gone (#1556)

A registry lock (teams/<team>/.config.lock) whose owner was killed was never
broken, so the team's sync stopped until someone removed it by hand.

The lock is now broken only when its holder record is present, names this
host, carries a valid pid, and that pid is positively not running here. A
record from another host, an unreadable or invalid pid, or no record at all
keeps the lock. A lock with no holder record is never broken automatically:
the timeout message says so and gives the command to remove it, and doctor
lists such locks with that command, to be run only while no agmsg sync or
seat is running.

Refs #865, #778.

**File**: `scripts/doctor.sh` (modified, +68/-0)
```diff
@@ -284,6 +284,67 @@ _doctor_print_orphans() {
   fi
 }
 
+# --- registry locks with no holder record (#865) ---------------------------
+#
+# A registry lock (teams/<team>/.config.lock) names its holder in a record
+# beside it. The next command that needs the lock breaks one whose holder is
+# gone, but a lock with NO record cannot be told from one taken a moment ago
+# whose owner has not written the record yet, so nothing breaks it and every
+# command for that team then waits out its budget and fails.
+#
+# REPORTED, NEVER REMOVED, not even by --fix. Removing one safely needs the
+# acquiring side to cooperate: whatever this checks about the directory can stop
+# being true before the `rmdir` runs (the lock is released, a new owner takes
+# the same path and has not recorded itself yet), and no age or second look
+# closes that. So doctor finds them and prints the command; running it is the
+# operator's call, when every agmsg sync and seat is stopped.
+# Installation-wide, like the orphaned records above.
+LOCKS_NO_RECORD=""
+
+# Only the holder file is a record. The copy a killed release leaves behind
+# (`<lock>.holder.releasing.<pid>`) is not tied to the directory that is there
+# now, so it is not counted; a lock with only that is listed like any other.
+_doctor_lock_has_record() {   # <lock dir>
+  [ -f "$1.holder" ]
+}
+
+# Fills LOCKS_NO_RECORD with one team directory name per line. The three globs
+# are the ones remote.sh doctor uses: `*` skips a leading dot, so `.foo` and
+# `..foo` need their own.
+_doctor_scan_record_less_locks() {
+  local lock name
+  LOCKS_NO_RECORD=""
+  for lock in "$SKILL_DIR"/teams/*/.config.lock "$SKILL_DIR"/teams/.[!.]*/.config.lock "$SKILL_DIR"/teams/..?*/.config.lock; do
+    [ -d "$lock" ] || continue
+    if _doctor_lock_has_record "$lock"; then continue; fi
+    name="${lock%/.config.lock}"; name="${name##*/}"
+    LOCKS_NO_RECORD="${LOCKS_NO_RECORD}${name}"$'\n'
+  done
+}
+
+# Under --redacted the team name (and the path in the command) is replaced.
+_doctor_print_locks() {
+  local n name q
+  [ -n "$LOCKS_NO_RECORD" ] || return 0
+  n="$(printf '%s' "$LOCKS_NO_RECORD" | grep -c . || true)"
+  echo "registry locks with no holder record -- nothing can tell whether they are held ($n):"
+  while IFS= read -r name; do
+    [ -n "$name" ] || continue
+    if [ "$REDACTED" = 1 ]; then
+      _redact_team "$name"; echo "  team: $_REDACT_OUT"
+    else
+      # QUOTED, because this line is meant to be pasted: the store root and the
+      # team name can both contain a space. `rmdir`, not `rm -r`, so the paste
+      # cannot remove anything but an empty lock directory.
+      q="$(printf "'%s'" "$(printf '%s' "$SKILL_DIR/teams/$name/.config.lock" | sed "s/'/'\\\\''/g")")"
+      echo "  team: $name"
+      echo "    rmdir $q"
+    fi
+  done <<< "$LOCKS_NO_RECORD"
+  echo "  run a rmdir only when every agmsg sync and seat is stopped; a lock taken a moment ago looks the same."
+  echo
+}
+
 # --- --fix: its own mode, not a flag on the report -------------------------
 #
 # Lists what would go, asks once (--yes skips only the question), then removes
@@ -935,6 +996,12 @@ fi
 if [ -n "$ORPHAN_AMBIGUOUS" ]; then
   _warn "run/ holds records for a team that no longer exists that cannot be attributed to one seat (\"__\" inside a name); they are left alone, remove them by hand"
 fi
+# Registry locks with no holder record (#865): also installation-wide. Nothing
+# else ever breaks one, so a team that keeps timing out on its lock lands here.
+_doctor_scan_record_less_locks
+if [ -n "$LOCKS_NO_RECORD" ]; then
+  _warn "teams/ holds registry lock(s) with no holder record, and every command for those teams waits on them (see 'registry locks with no holder record' above); the rmdir to run by hand is listed there, only when every agmsg sync and seat is stopped"
+fi
 WARN_COUNT="$(printf '%s\n' "$WARNINGS" | grep -c . || true)"
 
 echo "$TEAM_COUNT team(s), $TOTAL_PAIR_COUNT registration(s), $WARN_COUNT warning(s)"
@@ -945,6 +1012,7 @@ if [ -n "$GLOBAL_WATCH_LINE" ]; then
 fi
 printf '%s' "$REPORT_BLOCKS"
 _doctor_print_orphans
+_doctor_print_locks
 
 if [ -n "$WARNINGS" ]; then
   echo "warnings:"
```

**File**: `scripts/lib/registry-lock.sh` (modified, +195/-2)
```diff
@@ -53,9 +53,145 @@ _agmsg_lock_describe_dir() {
   echo "agmsg:   running as: $(id 2>/dev/null || echo 'unknown')" >&2
 }
 
+# LIVENESS, from the library that already answers this question (#865).
+#
+# `kill -0` on its own reads EPERM as dead, which in a sandbox turns "cannot
+# signal" into "not running" — and here that would break a lock somebody is
+# holding. `_agmsg_pid_alive_local` treats EPERM as alive, a zombie as gone, and
+# cross-checks with `ps`. Sourced rather than reimplemented.
+#
+# LOADED ON FIRST USE, and located with builtins only. This file is sourced on
+# PATHs that carry almost nothing (`join` is required to work on one, and a test
+# runs a write with `rm` and `dirname` missing), so loading it must not need an
+# external command, and the uncontended path -- which never asks who holds a
+# lock -- must not pay for a library it does not use. Where this file lives is
+# worked out here, at load, because a relative path is only good until the
+# caller changes directory.
+_AGMSG_LOCK_SELF="${BASH_SOURCE[0]:-$0}"
+case "$_AGMSG_LOCK_SELF" in
+  */*) _AGMSG_LOCK_SELF_DIR="$(cd "${_AGMSG_LOCK_SELF%/*}" 2>/dev/null && pwd)" || _AGMSG_LOCK_SELF_DIR="" ;;
+  *) _AGMSG_LOCK_SELF_DIR="$(pwd)" ;;
+esac
+
+# Returns 0 when the liveness helpers are available, 1 when they could not be
+# loaded -- and then nothing here can ask whether a holder is running, which is
+# "cannot tell", never "dead".
+_agmsg_lock_load_liveness() {
+  if declare -f _agmsg_pid_alive_local >/dev/null 2>&1; then return 0; fi
+  [ -n "$_AGMSG_LOCK_SELF_DIR" ] && [ -f "$_AGMSG_LOCK_SELF_DIR/instance-id.sh" ] || return 1
+  # shellcheck source=instance-id.sh
+  source "$_AGMSG_LOCK_SELF_DIR/instance-id.sh" 2>/dev/null || return 1
+  declare -f _agmsg_pid_alive_local >/dev/null 2>&1
+}
+
+# Was this holder record written on THIS machine?
+#
+# The store can be shared (a second machine pointed at the first one's, which is
+# how the ownership message below came to exist), and a pid is a number in ONE
+# machine's table. A record from another machine whose number is not running
+# HERE says nothing about whether it is running THERE, so it is never judged.
+# The two spellings are what the two writers use: bash's HOSTNAME, and uname -n
+# (which is what the Node side's os.hostname() reports). A record that names no
+# host is not judged either.
+_agmsg_lock_same_host() {
+  local recorded="$1"
+  [ -n "$recorded" ] || return 1
+  [ "$recorded" = "${HOSTNAME:-}" ] && return 0
+  [ "$recorded" = "$(uname -n 2>/dev/null)" ] && return 0
+  return 1
+}
+
+# Is this lock's recorded holder gone?
+#
+# TRUE ONLY WHEN THERE IS SOMETHING TO ASK ABOUT, AND IT CAN BE ASKED HERE. No
+# holder file, one with no pid, or one written on another machine answers "no"
+# -- not because such a lock is healthy, but because nothing here can tell a lock
+# written by an older version of this file from one created microseconds ago
+# whose owner has not written its record yet, or say whether a process on
+# another machine is running. Breaking on "I cannot tell" would take a live lock
+# away, which is worse than the leak. A lock with no holder file is left to the
+# operator: the timeout below says how, and `doctor.sh` lists such locks.
+#
+# THE PID HAS TO BE A USABLE NUMBER BEFORE IT IS ASKED ABOUT.
+# `_agmsg_pid_alive_local` answers "not running" for a value it never put to the
+# process table at all (empty, zero, non-numeric, past the POSIX ceiling), so a
+# damaged record would read as a dead holder. Such a record is "cannot tell".
+#
+# The copy a killed release leaves behind (`<lock>.holder.releasing.<pid>`) is
+# deliberately NOT a record. Nothing ties it to the directory that is there now:
+# a release that finished normally can leave one too, and a new owner who
+# stopped right after its mkdir would then be judged by the previous owner's
+# pid. Such a lock is handled like one with no holder file.
+#
+# A recycled pid reads as ALIVE here, and that is the safe direction: this
+# process waits and reports contention instead of breaking a lock whose number
+# now belongs to a stranger. Fencing the number with a start time is the third
+# piece of #865 and is not in this change.
+_agmsg_lock_holder_gone() {
+  local lock="$1" pid host
+  [ -f "$lock.holder" ] || return 1
+  _agmsg_lock_load_liveness || return 1
+  pid="$(sed -n 's/^pid //p' "$lock.holder" 2>/dev/null | head -1)"
+  host="$(sed -n 's/^host //p' "$lock.holder" 2>/dev/null | head -1)"
+  _agmsg_pid_valid "$pid" 2147483647 || return 1
+  _agmsg_lock_same_host "$host" || return 1
+  _agmsg_pid_alive_local "$pid" && return 1
+  return 0
+}
+
+# Break a lock whose recorded holder is gone.
+#
+# CLAIM FIRST, JUDGE SECOND, and the order is the whole correctness argument.
+#
+# The first version read the holder, decided it was dead, and then renamed
+# whatever was at that path. Review took it apart: between the two, a different
+# breaker can claim the old holder and remove the directo
```

**File**: `tests/test_doctor.bats` (modified, +15/-1)
```diff
@@ -588,7 +588,7 @@ configured_off() {
 # report never deletes, the prompt defaults to no, and --yes removes exactly the
 # records whose team is provably gone -- not a live team's, not an ambiguous
 # "__" one, not an id-keyed one.
-@test "doctor: reports run/ records of a team that no longer exists, and removes only those on request (#1507)" {
+@test "doctor: reports orphaned run/ records and record-less registry locks, and removes only those on request (#1507, #865)" {
   local run_dir="$TEST_SKILL_DIR/run" gone='%2Ftmp%2Fsome%2Fproj'   # a project path used as the team name
   local id_team='11111111-1111-1111-1111-111111111111' id_member='22222222-2222-2222-2222-222222222222'
   mkdir -p "$run_dir"
@@ -610,6 +610,12 @@ configured_off() {
   bash "$SCRIPTS/join.sh" live.part worker claude-code "$PROJ" >/dev/null
   printf 'herdr:dot:w1:p5\t/proj\tclaude-code\n' > "$run_dir/spawn.live__part"
   printf '4242\n' > "$run_dir/codex-bridge.live.part.worker.pid"
+  # Registry locks (#865): one with no holder record, which nothing else ever
+  # breaks, and one that names its holder. Both are left in place by --fix: the
+  # record-less one is only listed, with the command to run by hand.
+  mkdir "$TEST_SKILL_DIR/teams/live.part/.config.lock"
+  mkdir "$TEST_SKILL_DIR/teams/team/.config.lock"
+  printf 'token t\npid 1\ncommand t\nhost h\n' > "$TEST_SKILL_DIR/teams/team/.config.lock.holder"
 
   run bash "$SCRIPTS/doctor.sh"
   [ "$status" -eq 1 ]
@@ -619,6 +625,10 @@ configured_off() {
   grep -qF 'team: /tmp/some/proj  agent: worker  pane: herdr:gone:w1:p9' <<<"$output"
   grep -qF 'team: live  agent: part  pane: herdr:dot:w1:p5' <<<"$output"
   grep -qF 'not attributable to one seat' <<<"$output"
+  grep -qF 'registry locks with no holder record' <<<"$output"
+  grep -qxF '  team: live.part' <<<"$output"
+  grep -qF "rmdir '$TEST_SKILL_DIR/teams/live.part/.config.lock'" <<<"$output"
+  [ -z "$(grep -xF '  team: team' <<<"$output")" ]
   [ -z "$(grep -F 'agent: alice' <<<"$output")" ]
   [ -z "$(grep -F 'herdr:id:w1:p3' <<<"$output")" ]
   [ -f "$run_dir/spawn.${gone}__worker" ]            # reporting deletes nothing
@@ -627,6 +637,7 @@ configured_off() {
   [ "$status" -eq 1 ]
   [ -f "$run_dir/spawn.${gone}__worker" ]            # the prompt defaults to no
 
+
   run bash "$SCRIPTS/doctor.sh" --fix --yes
   [ "$status" -eq 0 ]
   [ ! -e "$run_dir/spawn.${gone}__worker" ]
@@ -639,4 +650,7 @@ configured_off() {
   [ -f "$run_dir/role-session.team__alice" ]
   [ -f "$run_dir/spawn.x___y" ]
   [ -f "$run_dir/spawn.${id_team}__${id_member}" ]
+  [ -d "$TEST_SKILL_DIR/teams/live.part/.config.lock" ]     # no record: listed, never removed
+  [ -d "$TEST_SKILL_DIR/teams/team/.config.lock" ]          # names its holder: kept
+  [ -f "$TEST_SKILL_DIR/teams/team/.config.lock.holder" ]
 }
```

**File**: `tests/test_registry_lock.bats` (modified, +92/-0)
```diff
@@ -380,3 +380,95 @@ acquire() {  # runs the acquire in its own shell, with a short spin budget
   grep -q "^survived$" <<<"$output"
   [ ! -d "$TEAM_DIR/.config.lock" ]
 }
+
+# --- breaking a lock only when its holder is known to be gone (#865) ---------
+#
+# A killed holder leaves its directory behind and nothing ever removed it, so
+# the team stayed wedged until someone deleted it by hand. The lock is now
+# broken when the record beside it names a process on THIS machine that is not
+# running. Everything else stays put, and the case that matters most is in the
+# same run: taking a lock somebody IS using is worse than the leak.
+#
+# The order inside the library is claim first, judge second (rename the record
+# away, then ask whether its process is running, and put it back if so); that
+# is what lets two breakers race without one removing the directory a new owner
+# has just taken. This test does not cover that order: the wrong order only
+# shows up as a lost exclusion under one particular interleaving, which needs
+# the two processes held at specific points to reproduce.
+@test "lock: a dead holder's lock is broken; a live holder's, another machine's record and a record-less lock are kept (#865)" {
+  local gone live lock="$TEAM_DIR/.config.lock" me
+  me="$(uname -n)"
+  sleep 0 &
+  gone=$!
+  wait "$gone" 2>/dev/null || true
+  sleep 30 &
+  live=$!
+  # CONTROLS: the dead pid is really not running and the live one really is.
+  # Without them the "kept" cases pass whenever the number happens to be free.
+  run env PID="$gone" LOCKLIB="$LOCKLIB" bash -c '. "$LOCKLIB"; _agmsg_lock_load_liveness; _agmsg_pid_alive_local "$PID"'
+  [ "$status" -ne 0 ]
+  run env PID="$live" LOCKLIB="$LOCKLIB" bash -c '. "$LOCKLIB"; _agmsg_lock_load_liveness; _agmsg_pid_alive_local "$PID"'
+  [ "$status" -eq 0 ]
+
+  # A live holder on this machine: kept.
+  mkdir "$lock"
+  printf 'token t\npid %s\ncommand t\nhost %s\n' "$live" "$me" > "$lock.holder"
+  acquire
+  [ "$status" -ne 0 ]
+  grep -qF "timed out acquiring registry lock" <<<"$output"
+  refute grep -qF "broke a registry lock" <<<"$output"
+  [ -d "$lock" ]
+  [ -f "$lock.holder" ]
+
+  # The same dead number in a record another machine wrote: that machine's
+  # table is the one that knows, so it is kept.
+  printf 'token t\npid %s\ncommand t\nhost some-other-machine\n' "$gone" > "$lock.holder"
+  acquire
+  [ "$status" -ne 0 ]
+  refute grep -qF "broke a registry lock" <<<"$output"
+  grep -qF "not written on this machine" <<<"$output"
+  [ -d "$lock" ]
+
+  # No record at all: kept, and the timeout says how to remove it.
+  rm -f "$lock.holder"
+  acquire
+  [ "$status" -ne 0 ]
+  refute grep -qF "broke a registry lock" <<<"$output"
+  grep -qF "records no holder" <<<"$output"
+  grep -qF "rmdir" <<<"$output"
+  [ -d "$lock" ]
+
+  # A record whose pid is not a usable number (zero, text, past the ceiling) on
+  # this machine: "cannot tell", never "dead". The liveness helper answers "not
+  # running" for these without ever asking the process table.
+  local bad
+  for bad in 0 abc 99999999999; do
+    printf 'token t\npid %s\ncommand t\nhost %s\n' "$bad" "$me" > "$lock.holder"
+    acquire
+    [ "$status" -ne 0 ]
+    refute grep -qF "broke a registry lock" <<<"$output"
+    [ -d "$lock" ]
+  done
+  rm -f "$lock.holder"
+
+  # The copy a release leaves when it is killed after moving its record aside is
+  # not a record of THIS directory (a normal release can leave one too, and a
+  # new owner that stopped right after its mkdir would be judged by it), so it
+  # is treated like no record at all.
+  printf 'token t\npid %s\ncommand t\nhost %s\n' "$gone" "$me" > "$lock.holder.releasing.$gone"
+  acquire
+  [ "$status" -ne 0 ]
+  refute grep -qF "broke a registry lock" <<<"$output"
+  [ -d "$lock" ]
+  rm -f "$lock.holder.releasing.$gone"
+  rmdir "$lock"
+
+  # A dead holder on this machine: broken, and the acquire then succeeds.
+  mkdir "$lock"
+  printf 'token t\npid %s\ncommand t\nhost %s\n' "$gone" "$me" > "$lock.holder"
+  acquire
+  [ "$status" -eq 0 ]
+  grep -qF "broke a registry lock" <<<"$output"
+
+  kill "$live" 2>/dev/null || true
+}
```

---

### Incident Patch 7: `0e4e4c13` (2026-10-02)
**Commit Message**: fix(watch): renew or stop by itself shortly before the Monitor 30-minute cap (#1553)

Claude Code's Monitor kills a watch at its 30-minute cap and leaves no
completion record, so resuming a long session listed hundreds of unfinished
background tasks. The decision to re-arm was also left to the model reading the
expiry notice.

watch.sh now takes a trailing --max-seconds=N, passed only by the Claude Code
launch commands (session start, delivery set, the actas/drop overlay) as 1790.
At the top of a poll cycle past that limit it prints one line and exits 0:
"agmsg watch: re-arm - ..." with the exact command and description when it
delivered a message in this run or AGMSG_CC_MONITOR_KEEP_ALIVE is set, and
"agmsg watch: stopping - ..." otherwise. The elapsed time and delivery count
carry across an install-change restart, and a re-armed watch resumes from the
persistent read cursor. The four copies of the directive now say to follow
that line. Other callers (opencode, grok-build, manual use) are unchanged and
never end on their own.

**File**: `SKILL.md` (modified, +4/-4)
```diff
@@ -206,12 +206,12 @@ If argument starts with "actas" followed by an agent name (e.g. "actas alice"):
    c. **If no matching task is found** (typical when /agmsg actas runs as the first command of a fresh session — SessionStart hasn't fired the Monitor directive yet, or you're invoking actas before the agent acted on it): skip TaskStop entirely. There is no Monitor to stop. Do NOT attempt TaskStop with a guessed or empty task_id — it will fail with "Invalid tool parameters" and confuse the flow.
    d. Run `~/.agents/skills/agmsg/scripts/delivery.sh status claude-code "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode: both`**: invoke a fresh Monitor, regardless of whether step b or c applied:
-        - command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name>`
+        - command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name> --max-seconds=1790`
         - description: `agmsg inbox stream (acting as <name>)`
         - persistent: true
         - timeout_ms: 1800000
 
-        Check whether the environment variable `AGMSG_CC_MONITOR_KEEP_ALIVE` is set (e.g. `printenv AGMSG_CC_MONITOR_KEEP_ALIVE`). If it IS set: this watch expires after at most 30 minutes; when the expiry notice arrives, immediately re-arm it by invoking Monitor again with this exact command and description — delivery depends on it, since nothing else keeps the stream running. Re-arm it silently: no message to the user, no "re-armed", no acknowledgement, no summary — just invoke Monitor again and continue, since announcing it every 30 minutes wastes tokens for no benefit. If it is UNSET (the default): this watch still expires after at most 30 minutes. If the expiry notification says it delivered no events, do not re-arm it. Otherwise (it says it delivered something), re-arm it by invoking Monitor again with this exact command and description. Re-arm it silently, when you do: no message to the user, no "re-armed", no acknowledgement, no summary — just invoke Monitor again and continue, since announcing it every 30 minutes wastes tokens for no benefit.
+        This watch renews itself. A little before the 30-minute cap it prints one line on its own and exits: on `agmsg watch: re-arm - ...`, invoke Monitor again with exactly the command and description that line names (persistent: true, timeout_ms: 1800000), silently — no message to the user, no "re-armed", no acknowledgement, no summary, since announcing it every 30 minutes wastes tokens for no benefit; on `agmsg watch: stopping - ...`, do not re-arm it. If the watch is instead killed at the cap and no such line arrived (an agmsg install from before this), re-arm it only when the expiry notification says it delivered something.
       - **`mode: turn`**: leave it stopped, silently. `has_st=1` is the one case `delivery.sh` can actually confirm was a deliberate choice — someone configured turn-based delivery for this project — so `actas` starting nothing here needs no explanation.
       - **`mode: off (no agmsg delivery hooks installed for this project)`**: leave it stopped (`actas` must not start automatic delivery a project wasn't configured for), but **do not treat this as silently deliberate**. `delivery.sh` cannot tell whether someone ran `mode off` here or this project was simply never configured — both leave the exact same settings file (#687 review round 3). **Tell the user** — e.g. "agmsg delivery hooks are not installed for this project; automatic delivery remains stopped. Run `/agmsg mode <choice>` if you want to configure it." Keep it matter-of-fact, not a warning. Do not report `actas` as complete without saying this.
       - **`mode: off (unrecognized: ...)`**: leave it stopped too (same rule — do not guess a mode), but this is a stronger case than the no-hooks-installed one above: `delivery.sh` could not even find or read a settings file for this project, most often because the working directory does not match how the project was actually registered. **Tell the user explicitly** — e.g. "agmsg could not find a delivery configuration for this project at `<path from the message>` — delivery is stopped, but this may mean the project isn't registered here rather than that it was deliberately turned off. Check the path, or run `/agmsg mode <choice>` to configure it explicitly." Do not report `actas` as complete without saying this — a silent stop here is indistinguishable from the other off cases and is what let this go unnoticed before (#687).
@@ -229,12 +229,12 @@ If argument starts with "drop" followed by an agent name (e.g. "drop alice"):
    c. **If no matching task is found**: skip TaskStop. Do NOT attempt TaskStop with a guessed or empty task_id.
    d. Run `~/.agents/skills/agmsg/scripts/delivery.sh status claude-code "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode: both`**: invoke a fresh Monitor with the default subscription (no `ac
```

**File**: `scripts/delivery.sh` (modified, +8/-25)
```diff
@@ -611,32 +611,15 @@ EOF
   # with spaces or apostrophes intact; a plain '...' wrap breaks on /o'brien/...
   # (#188).
   local watch_command
-  watch_command="$(printf '%q %q %q %q' "$watch" "$session_id" "$project" "$type")"
-  # AGMSG_CC_MONITOR_KEEP_ALIVE, default OFF: timeout_ms: 1800000 always
-  # stays (the Monitor tool caps every watch there regardless). What differs
-  # is whether re-arming on expiry is UNCONDITIONAL or read off the expiry
-  # notification itself. Claude Code counts the events on its own side and
-  # names that count in the notification -- agmsg never counts it -- so the
-  # default case below is worded as a plain word match on that notification
-  # ("no events" present or not), never as reading a number: the exact
-  # phrasing may drift, and a seat that has to parse a count is a seat this
-  # can break by rewording the notification later.
+  watch_command="$(printf '%q %q %q %q' "$watch" "$session_id" "$project" "$type") --max-seconds=1790"
+  # The watch renews itself (scripts/watch.sh, _watch_renew_or_stop): launched
+  # with --max-seconds it prints one "re-arm" or "stopping" line a
+  # little before Claude Code's 30-minute Monitor cap and exits.
+  # timeout_ms: 1800000 always stays; AGMSG_CC_MONITOR_KEEP_ALIVE is read by the
+  # watcher itself. Word-for-word identical to scripts/session-start.sh.
   local rearm_note
-  if [ -n "${AGMSG_CC_MONITOR_KEEP_ALIVE:-}" ]; then
-    rearm_note=" This watch expires after at most 30 minutes; when the expiry
-notice arrives, immediately re-arm it by invoking Monitor again with this
-exact command and description — delivery depends on it, since nothing else
-keeps the stream running. Re-arm it silently: no message to the user, no
-\"re-armed\", no acknowledgement, no summary — just invoke Monitor again and
-continue, since announcing it every 30 minutes wastes tokens for no benefit."
-  else
-    rearm_note=" This watch expires after at most 30 minutes.
-If the expiry notification says it delivered no events, do not re-arm it.
-Otherwise (it says it delivered something), re-arm it by invoking Monitor again with this exact command and description.
-Re-arm it silently, when you do: no message to the user, no \"re-armed\", no
-acknowledgement, no summary — just invoke Monitor again and continue, since
-announcing it every 30 minutes wastes tokens for no benefit."
-  fi
+  rearm_note="
+This watch renews itself. A little before the 30-minute cap it prints one line on its own and exits: on \`agmsg watch: re-arm - ...\`, invoke Monitor again with exactly the command and description that line names (persistent: true, timeout_ms: 1800000), silently — no message to the user, no \"re-armed\", no acknowledgement, no summary, since announcing it every 30 minutes wastes tokens for no benefit; on \`agmsg watch: stopping - ...\`, do not re-arm it. If the watch is instead killed at the cap and no such line arrived (an agmsg install from before this), re-arm it only when the expiry notification says it delivered something."
   cat <<EOF
 
 AGMSG-DIRECTIVE: For this running session, invoke the Monitor tool now with:
```

**File**: `scripts/drivers/types/claude-code/template.md` (modified, +4/-4)
```diff
@@ -64,12 +64,12 @@ If argument starts with "actas" followed by an agent name (e.g. "actas alice"):
    c. **If no matching task is found** (typical when /__SKILL_NAME__ actas runs as the first command of a fresh session — SessionStart hasn't fired the Monitor directive yet, or you're invoking actas before the agent acted on it): skip TaskStop entirely. There is no Monitor to stop. Do NOT attempt TaskStop with a guessed or empty task_id — it will fail with "Invalid tool parameters" and confuse the flow.
    d. Run `~/.agents/skills/__SKILL_NAME__/scripts/delivery.sh status __AGENT_TYPE__ "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode: both`**: invoke a fresh Monitor, regardless of whether step b or c applied:
-        - command: `~/.agents/skills/__SKILL_NAME__/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" __AGENT_TYPE__ <name>`
+        - command: `~/.agents/skills/__SKILL_NAME__/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" __AGENT_TYPE__ <name> --max-seconds=1790`
         - description: `agmsg inbox stream (acting as <name>)`
         - persistent: true
         - timeout_ms: 1800000
 
-        Check whether the environment variable `AGMSG_CC_MONITOR_KEEP_ALIVE` is set (e.g. `printenv AGMSG_CC_MONITOR_KEEP_ALIVE`). If it IS set: this watch expires after at most 30 minutes; when the expiry notice arrives, immediately re-arm it by invoking Monitor again with this exact command and description — delivery depends on it, since nothing else keeps the stream running. Re-arm it silently: no message to the user, no "re-armed", no acknowledgement, no summary — just invoke Monitor again and continue, since announcing it every 30 minutes wastes tokens for no benefit. If it is UNSET (the default): this watch still expires after at most 30 minutes. If the expiry notification says it delivered no events, do not re-arm it. Otherwise (it says it delivered something), re-arm it by invoking Monitor again with this exact command and description. Re-arm it silently, when you do: no message to the user, no "re-armed", no acknowledgement, no summary — just invoke Monitor again and continue, since announcing it every 30 minutes wastes tokens for no benefit.
+        This watch renews itself. A little before the 30-minute cap it prints one line on its own and exits: on `agmsg watch: re-arm - ...`, invoke Monitor again with exactly the command and description that line names (persistent: true, timeout_ms: 1800000), silently — no message to the user, no "re-armed", no acknowledgement, no summary, since announcing it every 30 minutes wastes tokens for no benefit; on `agmsg watch: stopping - ...`, do not re-arm it. If the watch is instead killed at the cap and no such line arrived (an agmsg install from before this), re-arm it only when the expiry notification says it delivered something.
       - **`mode: turn`**: leave it stopped, silently. `has_st=1` is the one case `delivery.sh` can actually confirm was a deliberate choice — someone configured turn-based delivery for this project — so `actas` starting nothing here needs no explanation.
       - **`mode: off (no agmsg delivery hooks installed for this project)`**: leave it stopped (`actas` must not start automatic delivery a project wasn't configured for), but **do not treat this as silently deliberate**. `delivery.sh` cannot tell whether someone ran `mode off` here or this project was simply never configured — both leave the exact same settings file (#687 review round 3). **Tell the user** — e.g. "agmsg delivery hooks are not installed for this project; automatic delivery remains stopped. Run `/__SKILL_NAME__ mode <choice>` if you want to configure it." Keep it matter-of-fact, not a warning. Do not report `actas` as complete without saying this.
       - **`mode: off (unrecognized: ...)`**: leave it stopped too (same rule — do not guess a mode), but this is a stronger case than the no-hooks-installed one above: `delivery.sh` could not even find or read a settings file for this project, most often because the working directory does not match how the project was actually registered. **Tell the user explicitly** — e.g. "agmsg could not find a delivery configuration for this project at `<path from the message>` — delivery is stopped, but this may mean the project isn't registered here rather than that it was deliberately turned off. Check the path, or run `/__SKILL_NAME__ mode <choice>` to configure it explicitly." Do not report `actas` as complete without saying this — a silent stop here is indistinguishable from the other off cases and is what let this go unnoticed before (#687).
@@ -90,12 +90,12 @@ If argument starts with "drop" followed by an agent name (e.g. "drop alice"):
    c. **If no matching task is found**: skip TaskStop. Do NOT attempt TaskStop with a guessed or empty task_id.
    d. Run `~/.agents/skills/__SKILL_NAME__/scripts/delivery.sh status __AGENT_TYPE__ "$(pwd)"` and read its **first line**.
       - **`mode: monitor` or `mode
```

**File**: `scripts/session-start.sh` (modified, +15/-32)
```diff
@@ -440,42 +440,25 @@ if [ -n "$ROLE_NAME" ] && [ -n "$ROLE_TEAM" ]; then
 fi
 
 WATCH="$SKILL_DIR/scripts/watch.sh"
-# AGMSG_CC_MONITOR_KEEP_ALIVE, default OFF: timeout_ms: 1800000 always stays
-# in both directives below (the Monitor tool caps every watch there
-# regardless). What differs is whether re-arming on expiry is UNCONDITIONAL
-# or read off the expiry notification itself. Claude Code counts the events
-# on its own side and names that count in the notification -- agmsg never
-# counts it -- so the default case below is worded as a plain word match on
-# that notification ("no events" present or not), never as reading a
-# number: the exact phrasing may drift, and a seat that has to parse a
-# count is a seat this can break by rewording the notification later. Kept
-# word-for-word identical to scripts/delivery.sh's emit_monitor_directive
-# and scripts/drivers/types/claude-code/template.md's actas overlay -- the
-# three surfaces must never disagree with each other.
-REARM_NOTE=""
-if [ -n "${AGMSG_CC_MONITOR_KEEP_ALIVE:-}" ]; then
-  REARM_NOTE="
-This watch expires after at most 30 minutes; when the expiry notice arrives,
-immediately re-arm it by invoking Monitor again with this exact command and
-description — delivery depends on it, since nothing else keeps the stream
-running. Re-arm it silently: no message to the user, no \"re-armed\", no
-acknowledgement, no summary — just invoke Monitor again and continue,
-since announcing it every 30 minutes wastes tokens for no benefit."
-else
-  REARM_NOTE="
-This watch expires after at most 30 minutes.
-If the expiry notification says it delivered no events, do not re-arm it.
-Otherwise (it says it delivered something), re-arm it by invoking Monitor again with this exact command and description.
-Re-arm it silently, when you do: no message to the user, no \"re-armed\", no
-acknowledgement, no summary — just invoke Monitor again and continue, since
-announcing it every 30 minutes wastes tokens for no benefit."
-fi
+# The watch renews itself (scripts/watch.sh, _watch_renew_or_stop): when it was
+# launched with --max-seconds it prints one "re-arm" or "stopping" line
+# a little before Claude Code's 30-minute Monitor cap and exits, so the decision
+# is made by the watcher, not by the model reading an expiry notification later.
+# timeout_ms: 1800000 always stays in both directives below (the Monitor tool
+# caps every watch there regardless); AGMSG_CC_MONITOR_KEEP_ALIVE is read by the
+# watcher itself. Kept word-for-word identical to scripts/delivery.sh's
+# emit_monitor_directive and scripts/drivers/types/claude-code/template.md's
+# overlays -- the surfaces must never disagree with each other.
+REARM_NOTE="
+This watch renews itself. A little before the 30-minute cap it prints one line on its own and exits: on \`agmsg watch: re-arm - ...\`, invoke Monitor again with exactly the command and description that line names (persistent: true, timeout_ms: 1800000), silently — no message to the user, no \"re-armed\", no acknowledgement, no summary, since announcing it every 30 minutes wastes tokens for no benefit; on \`agmsg watch: stopping - ...\`, do not re-arm it. If the watch is instead killed at the cap and no such line arrived (an agmsg install from before this), re-arm it only when the expiry notification says it delivered something."
+# The launch commands below end with the option that turns self-management on.
+WATCH_MAX_ARG="--max-seconds=1790"
 # Shell-quote each argv so the host can paste the command into Monitor and run
 # it verbatim. A plain '...' wrap breaks on paths with an apostrophe
 # (/Users/o'brien/...); printf %q escapes spaces, quotes and other metacharacters
 # safely for shell re-execution (#188). A resumed role adds the 4th <agent> arg.
 if [ -n "$ROLE_NAME" ]; then
-  WATCH_COMMAND="$(printf '%q %q %q %q %q' "$WATCH" "$INSTANCE_ID" "$PROJECT" "$TYPE" "$ROLE_NAME")"
+  WATCH_COMMAND="$(printf '%q %q %q %q %q' "$WATCH" "$INSTANCE_ID" "$PROJECT" "$TYPE" "$ROLE_NAME") $WATCH_MAX_ARG"
   # State the seat's basis honestly: the reader launches a watcher on the strength
   # of this sentence, so a recorded seat and an inferred one must not read alike
   # (#982/#993). The record path has an explicit role-session record; the narrowing
@@ -543,7 +526,7 @@ fi
 # explicitly — which re-fires this hook down the role-filtered path above.
 _pair_count="$(printf '%s\n' "$PAIRS" | grep -c '.' || true)"
 if [ "${_pair_count:-0}" -le 1 ]; then
-  WATCH_COMMAND="$(printf '%q %q %q %q' "$WATCH" "$INSTANCE_ID" "$PROJECT" "$TYPE")"
+  WATCH_COMMAND="$(printf '%q %q %q %q' "$WATCH" "$INSTANCE_ID" "$PROJECT" "$TYPE") $WATCH_MAX_ARG"
   cat <<EOF
 $TERMINAL_LINE
 $TEAM_LINE
```

**File**: `scripts/watch.sh` (modified, +62/-1)
```diff
@@ -41,6 +41,21 @@ ORIG_ARGS=("$@")
 # libs are sourced) rather than failing hard, so a runtime that cannot bake one
 # in — notably Grok Build's `monitor` tool, where "$GROK_SESSION_ID" expands to
 # empty — still starts the watcher. project_path and agent_type are required.
+# `--max-seconds=N` (a trailing option agmsg's own Claude Code launch commands
+# add) turns on self-managed renewal; see _watch_renew_or_stop below. It is
+# taken out of the positional list here so the rest of the script is unchanged,
+# and it stays in ORIG_ARGS so a self-restart and the re-arm line replay it.
+WATCH_MAX_SECONDS=""
+_wargs=()
+for _a in "$@"; do
+  case "$_a" in
+    --max-seconds=*) WATCH_MAX_SECONDS="${_a#--max-seconds=}" ;;
+    *) _wargs+=("$_a") ;;
+  esac
+done
+set -- ${_wargs[@]+"${_wargs[@]}"}
+unset _wargs _a
+
 SESSION_ID="${1:-}"
 [ "$SESSION_ID" = "-" ] && SESSION_ID="" # #477: caller sentinel for empty session id
 PROJECT_PATH="${2:?Missing project_path}"
@@ -863,7 +878,12 @@ _handle_install_changed() {
       cleanup
       AGMSG_WATCH_RESTART_COUNT=$((restarts + 1))
       AGMSG_WATCH_RESTART_CHAIN="$_WATCH_INSTALL_RESTART_CHAIN"
-      export AGMSG_WATCH_RESTART_COUNT AGMSG_WATCH_RESTART_CHAIN
+      # The renewal clock and delivery count (see _watch_renew_or_stop) belong
+      # to the whole run, not to this process image: without them an update
+      # mid-run would restart the clock past the host's own cap.
+      AGMSG_WATCH_ELAPSED_BASE=$((SECONDS + _WATCH_ELAPSED_BASE))
+      AGMSG_WATCH_DELIVERED_BASE="$_WATCH_DELIVERED"
+      export AGMSG_WATCH_RESTART_COUNT AGMSG_WATCH_RESTART_CHAIN AGMSG_WATCH_ELAPSED_BASE AGMSG_WATCH_DELIVERED_BASE
       # The watch_report call below is reached only if exec itself fails to
       # replace the process image (e.g. an interpreter it can no longer
       # exec); it is the fallback for that failure, not dead code.
@@ -1143,7 +1163,47 @@ _AGMSG_EXIT_TEARDOWN_INCOMPLETE=76
 STUCK_MAP=""
 source "$SCRIPT_DIR/lib/watch-stuck-map.sh"
 
+# Self-managed renewal, for hosts that cap how long a watch may run (Claude Code's
+# Monitor kills one at 30 minutes and leaves no completion record, which piles up
+# as "background shell command tasks did not finish" on every resume).
+# --max-seconds is added only by the launch commands agmsg writes for that host;
+# without it (every other caller) the watcher never ends on its own.
+# Shortly before the cap, at the top of a cycle (so nothing is mid-delivery and
+# the read cursor has already been consumed), the watcher decides for itself and
+# prints one line on stdout -- one notification per cycle:
+#   - it delivered something this run, or AGMSG_CC_MONITOR_KEEP_ALIVE is set:
+#     "agmsg watch: re-arm ..." naming the command and description to hand back
+#     to Monitor unchanged;
+#   - otherwise "agmsg watch: stopping ...": nothing to renew.
+# Then it exits 0. A restart resumes from the persistent read cursor, so the gap
+# before the host re-arms loses nothing.
+case "$WATCH_MAX_SECONDS" in ''|*[!0-9]*) WATCH_MAX_SECONDS="" ;; esac
+_WATCH_ELAPSED_BASE="${AGMSG_WATCH_ELAPSED_BASE:-0}"
+case "$_WATCH_ELAPSED_BASE" in ''|*[!0-9]*) _WATCH_ELAPSED_BASE=0 ;; esac
+_WATCH_DELIVERED="${AGMSG_WATCH_DELIVERED_BASE:-0}"
+case "$_WATCH_DELIVERED" in ''|*[!0-9]*) _WATCH_DELIVERED=0 ;; esac
+unset AGMSG_WATCH_ELAPSED_BASE AGMSG_WATCH_DELIVERED_BASE
+
+_watch_renew_or_stop() {
+  local elapsed=$((SECONDS + _WATCH_ELAPSED_BASE)) cmd desc arg
+  [ "$elapsed" -ge "$WATCH_MAX_SECONDS" ] || return 0
+  if [ "$_WATCH_DELIVERED" -gt 0 ] || [ -n "${AGMSG_CC_MONITOR_KEEP_ALIVE:-}" ]; then
+    cmd="$(printf '%q' "$SCRIPT_DIR/watch.sh")"
+    for arg in "${ORIG_ARGS[@]}"; do
+      cmd="$cmd $(printf '%q' "$arg")"
+    done
+    desc="agmsg inbox stream"
+    [ -n "$ACTIVE_NAME" ] && desc="$desc (acting as $ACTIVE_NAME)"
+    watch_report "re-arm - this watch is about to reach the host's time cap; invoke the Monitor tool again with command: $cmd description: $desc persistent: true timeout_ms: 1800000"
+  else
+    watch_report "stopping - no messages were delivered in the last ${elapsed}s, so this watch is not re-armed (set AGMSG_CC_MONITOR_KEEP_ALIVE to keep it running)"
+  fi
+  exit 0
+}
+
 while true; do
+  # Renewal point: see _watch_renew_or_stop above.
+  [ -n "$WATCH_MAX_SECONDS" ] && _watch_renew_or_stop
   # Advance the per-cycle cache epoch as a PLAIN STATEMENT (never via $(...) —
   # see the actas-lock cache warming below for why): this is what lets
   # _agmsg_partition_load's per-team driver cache (lib/storage.sh) reuse one
@@ -1518,6 +1578,7 @@ EOF
         cleanup
         exit 0
       fi
+      _WATCH_DELIVERED=$((_WATCH_DELIVERED + 1))
       DELIVERED_IDS+=("$id")
     done <<< "$ROWS"
     # Second test seam, parked BETWEEN delivery and consume. One barrier cannot
```

**File**: `tests/test_claude_template.bats` (modified, +2/-2)
```diff
@@ -47,13 +47,13 @@ setup() {
   # way to know watch.sh must be started THROUGH Monitor rather than, say,
   # Bash. These assertions pin the specific facts that summary dropped.
   grep -Fq 'invoke a fresh Monitor' "$RENDERED"
-  grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name>`' "$RENDERED"
+  grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code <name> --max-seconds=1790`' "$RENDERED"
   grep -Fq 'description: `agmsg inbox stream (acting as <name>)`' "$RENDERED"
   grep -Fq 'persistent: true' "$RENDERED"
   grep -Fq 'Run TaskList. Find any task whose description begins with "agmsg inbox stream"' "$RENDERED"
   grep -Fq 'status=held team=<team> owner=<sid>' "$RENDERED"
   # drop's own re-subscribe must be equally explicit, not just actas's.
-  grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code`' "$RENDERED"
+  grep -Fq 'command: `~/.agents/skills/agmsg/scripts/watch.sh $CLAUDE_CODE_SESSION_ID "$(pwd)" claude-code --max-seconds=1790`' "$RENDERED"
 }
 
 @test "Claude rendered skill's actas ends by confirming the Monitor attached via TaskList, not the UI footer" {
```

**File**: `tests/test_delivery.bats` (modified, +17/-20)
```diff
@@ -605,29 +605,25 @@ eperm_pid() {
   # the 5-minute default -- timeout_ms is unconditional, present regardless
   # of AGMSG_CC_MONITOR_KEEP_ALIVE below.
   grep -q 'timeout_ms: 1800000' <<<"$output"
-  # AGMSG_CC_MONITOR_KEEP_ALIVE, default OFF: with it unset (the run above),
-  # the directive must carry the CONDITIONAL re-arm wording -- a plain word
-  # match on "no events" in Claude Code's own expiry notification, never a
-  # count to parse (the notification's exact phrasing may drift; #1270's
-  # count only ever appears as Claude Code's own text, agmsg does not count
-  # it). The unconditional wording ("immediately re-arm it") is reserved for
-  # KEEP_ALIVE, checked below.
-  refute grep -q 'immediately re-arm it by invoking Monitor again' <<<"$output"
-  grep -q 'says it delivered no events, do not re-arm it' <<<"$output"
-  grep -q 'Otherwise (it says it delivered something), re-arm it' <<<"$output"
-  grep -q 'Re-arm it silently' <<<"$output"
-
-  run env AGMSG_CC_MONITOR_KEEP_ALIVE=1 bash "$SCRIPTS/delivery.sh" set monitor claude-code "$TEST_PROJECT"
-  [ "$status" -eq 0 ]
-  grep -q 'timeout_ms: 1800000' <<<"$output"
-  grep -q 'immediately re-arm it by invoking Monitor again' <<<"$output"
-  # KEEP_ALIVE re-arms unconditionally, regardless of what the expiry
-  # notification says -- the conditional wording above must not appear here.
+  # The watch renews itself: the launch command carries --max-seconds, and the
+  # directive tells the host to follow the watcher's own last line ("re-arm" /
+  # "stopping") instead of reading Claude Code's expiry notification.
+  # AGMSG_CC_MONITOR_KEEP_ALIVE is read by the watcher, so the directive text
+  # is the same with or without it.
+  grep -q 'watch.sh .* --max-seconds=1790' <<<"$output"
+  grep -q 'This watch renews itself' <<<"$output"
+  grep -qF 'agmsg watch: re-arm - ...' <<<"$output"
+  grep -qF 'agmsg watch: stopping - ...' <<<"$output"
+  grep -qF 'no acknowledgement, no summary' <<<"$output"
   refute grep -q 'says it delivered no events, do not re-arm it' <<<"$output"
   # The maintainer's follow-up to #1270: an agent that announces every silent
   # re-arm ("re-armed", an acknowledgement, a summary) burns tokens every 30
   # minutes for no reader benefit, so the directive must say to do it quietly.
-  [[ "$output" =~ "Re-arm it silently" ]]
+  run env AGMSG_CC_MONITOR_KEEP_ALIVE=1 bash "$SCRIPTS/delivery.sh" set monitor claude-code "$TEST_PROJECT"
+  [ "$status" -eq 0 ]
+  grep -q 'timeout_ms: 1800000' <<<"$output"
+  grep -q 'This watch renews itself' <<<"$output"
+  grep -qF 'no acknowledgement, no summary' <<<"$output"
 }
 
 @test "delivery set both: emits AGMSG-DIRECTIVE for Monitor invocation" {
@@ -874,7 +870,8 @@ _seed_role_record() {
   # Generic directive: watch.sh has no 4th (role) arg.
   local cmdline; cmdline=$(printf '%s\n' "$output" | sed -n 's/^[[:space:]]*command: //p')
   eval "set -- $cmdline"
-  [ "$#" -eq 4 ]
+  [ "$#" -eq 5 ]
+  [ "$5" = "--max-seconds=1790" ]
 }
 
 @test "session-start: a record for a role not registered here is ignored (#339)" {
```

**File**: `tests/test_resume_seat_guard.bats` (modified, +2/-1)
```diff
@@ -133,8 +133,9 @@ _run_session_start() {
   refute grep -qF "was recorded as that role's seat" <<<"$output"
   local cmd; cmd="$(_directive_command "$output")"
   eval "set -- $cmd"
-  [ "$#" -eq 5 ]
+  [ "$#" -eq 6 ]
   [ "$5" = "bob" ]
+  [ "$6" = "--max-seconds=1790" ]
 }
 
 @test "resume, role-session record present: says recorded, not the actas-lock basis" {
```

---

### Incident Patch 8: `ca70e425` (2026-10-02)
**Commit Message**: fix: record optional Codex profile metadata without changing delivery (#1549)

## Summary

Extract only the optional Codex profile metadata from #1504 for the maintenance release. When the effective CODEX_HOME (or the default HOME/.codex) resolves to a physical absolute directory, record it as an optional codex_home field alongside the existing thread, type, project, and owner. Missing directories, control characters, relative paths, or failed resolution omit only this new field; they do not skip writing the existing session record.

Keep rollout discovery at HOME/.codex/sessions. Thread selection, app-server probing, bridge requests, and the existing best-effort record-writing behavior retain their main-branch behavior. The Codex template describes optional profile metadata without implying a routing change.

## Evidence that existing features are unaffected

1. This change records metadata only. `rg -l 'codex_home' scripts` reports exactly scripts/drivers/types/codex/codex-record-session.sh and scripts/lib/role-session.sh: the producer, its optional argument, and its conditional field write. There is no reader of the stored field in main's bridge, hook, watch, send, or receive pa

**File**: `scripts/drivers/types/codex/codex-record-session.sh` (modified, +21/-1)
```diff
@@ -211,8 +211,28 @@ fi
 # codex thread ids are already bare UUIDs (no composite pid form), so record
 # as-is. The project is recorded in its canonical (physical) form so records
 # carry one path spelling regardless of how the caller spelled the argument.
+# Add optional destination metadata without changing thread discovery. Failure
+# to resolve a profile never prevents the existing session record or delivery.
+codex_home="${CODEX_HOME:-${HOME:+$HOME/.codex}}"
+case "$codex_home" in
+  *[[:cntrl:]]*) codex_home="" ;;
+  /* | [A-Za-z]:/* | [A-Za-z]:\\*) ;;
+  *) codex_home="" ;;
+esac
+if [ -n "$codex_home" ] && [ -d "$codex_home" ]; then
+  codex_home="$(cd -- "$codex_home" 2>/dev/null && pwd -P)" || codex_home=""
+  codex_home="$(agmsg_normalize_project_path "$codex_home")" || codex_home=""
+  case "$codex_home" in
+    *[[:cntrl:]]*) codex_home="" ;;
+    /* | [A-Za-z]:/* | [A-Za-z]:\\*) ;;
+    *) codex_home="" ;;
+  esac
+else
+  codex_home=""
+fi
+
 agmsg_role_session_load "$TEAM" "$AGENT" 2>/dev/null || true
-agmsg_role_session_record "$TEAM" "$AGENT" "$thread" "$project_phys" codex "${AGMSG_ROLE_SESSION_OWNER:-}" || true
+agmsg_role_session_record "$TEAM" "$AGENT" "$thread" "$project_phys" codex "${AGMSG_ROLE_SESSION_OWNER:-}" "$codex_home" || true
 
 # The Codex actas flow reaches this script instead of actas-claim.sh. Publish
 # the same seat request here so a resumed seat's dispatcher has an authority
```

**File**: `scripts/drivers/types/codex/template.md` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ Do not use POSIX `'"'"'` quote splicing in PowerShell, and do not use escaped do
 <!-- agmsg:slot actas -->
 If argument starts with "actas" followed by an agent name:
 1. Run `~/.agents/skills/__SKILL_NAME__/scripts/identities.sh "$(pwd)" __AGENT_TYPE__`. If `<name>` is not listed, join with `~/.agents/skills/__SKILL_NAME__/scripts/join.sh <team> <name> __AGENT_TYPE__ "$(pwd)"`.
-2. Record the Codex thread so a later spawn can resume it: `~/.agents/skills/__SKILL_NAME__/scripts/drivers/types/codex/codex-record-session.sh <team> <name>`. Both arguments are required; `<team>` is the team `<name>` belongs to (from step 1). Without them nothing is recorded and the monitor cannot deliver to this thread.
+2. Record this Codex thread so a later spawn can resume it, together with optional profile metadata: `~/.agents/skills/__SKILL_NAME__/scripts/drivers/types/codex/codex-record-session.sh <team> <name>`. Both arguments are required; `<team>` is the team `<name>` belongs to (from step 1). Without them nothing is recorded and the monitor cannot deliver to this thread.
 3. Use the role as the active FROM; monitor delivery is routed only to its recorded thread.
 <!-- /agmsg:slot actas -->
 
```

**File**: `scripts/lib/role-session.sh` (modified, +3/-1)
```diff
@@ -137,9 +137,10 @@ agmsg_role_session_load() {
 #                          from the type manifest. Empty when unknown.
 #   project=<project>      the resolved project root
 #   owner=<instance_id>    the actas owner token written by actas-claim
+#   codex_home=<path>      the effective absolute Codex profile directory
 #   updated_at=<iso8601>   best-effort timestamp (empty if date(1) unavailable)
 agmsg_role_session_record() {
-  local team="$1" agent="$2" bare_sid="$3" project="${4:-}" type="${5:-}" owner="${6:-}"
+  local team="$1" agent="$2" bare_sid="$3" project="${4:-}" type="${5:-}" owner="${6:-}" codex_home="${7:-}"
   [ -n "$team" ] && [ -n "$agent" ] && [ -n "$bare_sid" ] || return 0
   local path dir tmp ts named_ref="" named_epoch="" named_at=""
   _agmsg_role_session_path_into "$team" "$agent"
@@ -163,6 +164,7 @@ agmsg_role_session_record() {
     printf 'type=%s\n' "$type"
     printf 'project=%s\n' "$project"
     [ -z "$owner" ] || printf 'owner=%s\n' "$owner"
+    [ -z "$codex_home" ] || printf 'codex_home=%s\n' "$codex_home"
     printf 'updated_at=%s\n' "$ts"
     [ -z "$named_ref" ] || printf 'named_ref=%s\n' "$named_ref"
     [ -z "$named_ref" ] || printf 'named_epoch=%s\n' "$named_epoch"
```

**File**: `tests/test_codex_resume.bats` (modified, +40/-0)
```diff
@@ -78,6 +78,46 @@ recorded_uuid() {
   [ "$(agmsg_role_session_get team alice type)" = "codex" ]
 }
 
+@test "codex record: adds the effective profile path without changing the thread" {
+  local proj explicit_home expected_home
+  proj="$(mktemp -d)"
+  explicit_home="$TEST_SKILL_DIR/codex profile"
+  mkdir -p "$explicit_home" "$HOME/.codex"
+  CODEX_HOME="$explicit_home" CODEX_THREAD_ID="profile-thread-1" \
+    bash "$TYPES/codex/codex-record-session.sh" team alice "$proj"
+  [ "$(recorded_uuid team alice)" = profile-thread-1 ]
+  source "$SCRIPTS/lib/role-session.sh"
+  source "$SCRIPTS/lib/resolve-project.sh"
+  expected_home="$(cd "$explicit_home" && pwd -P)"
+  expected_home="$(agmsg_normalize_project_path "$expected_home")"
+  [ "$(agmsg_role_session_get team alice codex_home)" = "$expected_home" ]
+  env -u CODEX_HOME CODEX_THREAD_ID="profile-thread-2" \
+    bash "$TYPES/codex/codex-record-session.sh" team alice "$proj"
+  [ "$(recorded_uuid team alice)" = profile-thread-2 ]
+  expected_home="$(cd "$HOME/.codex" && pwd -P)"
+  expected_home="$(agmsg_normalize_project_path "$expected_home")"
+  [ "$(agmsg_role_session_get team alice codex_home)" = "$expected_home" ]
+}
+
+@test "codex record: unresolved profile omits only the field and preserves legacy rollout discovery" {
+  local proj invalid_home
+  proj="$(mktemp -d)"
+  source "$SCRIPTS/lib/role-session.sh"
+  for invalid_home in "$TEST_SKILL_DIR/missing" "$TEST_SKILL_DIR/"$'bad\nprofile' .; do
+    run env CODEX_HOME="$invalid_home" CODEX_THREAD_ID=still-recorded \
+      bash "$TYPES/codex/codex-record-session.sh" team alice "$proj"
+    [ "$status" -eq 0 ]
+    [ "$(recorded_uuid team alice)" = still-recorded ]
+    [ -z "$(agmsg_role_session_get team alice codex_home)" ]
+  done
+  make_rollout legacy-profile-thread "$proj"
+  run env -u CODEX_THREAD_ID CODEX_HOME="$TEST_SKILL_DIR/missing" \
+    bash "$TYPES/codex/codex-record-session.sh" team bob "$proj"
+  [ "$status" -eq 0 ]
+  [ "$(recorded_uuid team bob)" = legacy-profile-thread ]
+  [ -z "$(agmsg_role_session_get team bob codex_home)" ]
+}
+
 @test "codex record: falls back to the unique matching-cwd rollout when env is unset" {
   local proj; proj="$(mktemp -d)"
   make_rollout "fallback-uuid" "$proj"
```

**File**: `tests/test_spawn.bats` (modified, +3/-1)
```diff
@@ -1834,7 +1834,9 @@ _assert_bridged_argv() {
   # assigned inside the stack before they are read, never environment inputs
   # (role-session lookup results, codex-monitor's parsed command/args/version,
   # the doc URL constant from delivery.sh).
-  local keep=" AGMSG_SPAWNED AGMSG_BASH AGMSG_WATCH_ONCE_INTERVAL AGMSG_WATCH_ONCE_TIMEOUT AGMSG_TEST_DISPATCHER_STALE_BARRIER AGMSG_TEST_ASSUME_CODEX_SOCKET AGMSG_ROLE_SESSION_UUID AGMSG_ROLE_SESSION_PROJECT CODEX_ARGS CODEX_COMMAND CODEX_VERSION CODEX_MONITOR_DOC_URL "
+  # CODEX_HOME is intentionally inherited: the session recorder records the
+  # effective profile for resume, and spawned Codex seats use that same profile.
+  local keep=" CODEX_HOME AGMSG_SPAWNED AGMSG_BASH AGMSG_WATCH_ONCE_INTERVAL AGMSG_WATCH_ONCE_TIMEOUT AGMSG_TEST_DISPATCHER_STALE_BARRIER AGMSG_TEST_ASSUME_CODEX_SOCKET AGMSG_ROLE_SESSION_UUID AGMSG_ROLE_SESSION_PROJECT CODEX_ARGS CODEX_COMMAND CODEX_VERSION CODEX_MONITOR_DOC_URL "
   local inventory missing=""
   inventory="$( { grep -ohE '\$\{?(AGMSG_[A-Z0-9_]+|CODEX_[A-Z0-9_]+)' "$dir"/codex-shim.sh "$dir"/codex-monitor.sh "$dir"/_app-server.sh "$dir"/codex-bridge-launcher.sh "$dir"/codex-record-session.sh "$dir"/_session-start.sh "$dir"/codex-shim-install.sh "$dir"/_delivery.sh | sed -E 's/^\$\{?//'; grep -ohE 'process\.env\.(AGMSG_[A-Z0-9_]+|CODEX_[A-Z0-9_]+)' "$dir"/codex-bridge.js | sed 's/process\.env\.//'; } | sort -u )"
   while IFS= read -r v; do
```

---

### Incident Patch 9: `07a67a3e` (2026-10-02)
**Commit Message**: fix(codex): pass the launcher flag to the app-server so SessionStart sees it (#1524)

Under `--remote`, SessionStart runs inside the seat's app-server, which did not have AGMSG_CODEX_BRIDGE_LAUNCHER, so the hook did not take the bridge-launcher path. codex-monitor now passes the existing flag to the app-server it starts, next to AGMSG_CODEX_SEAT_KEY. Plain codex launches are unchanged.

**File**: `scripts/drivers/types/codex/codex-monitor.sh` (modified, +1/-0)
```diff
@@ -198,6 +198,7 @@ port_alive() {  # $1 = port; succeeds if something is accepting on 127.0.0.1:$1
 # generated internally as digits and dots only (_agmsg_codex_seat_key_new),
 # so it is always safe inside this double-quoted TOML string unescaped.
 AGMSG_CODEX_SEAT_KEY="$SEAT_KEY" \
+  AGMSG_CODEX_BRIDGE_LAUNCHER=1 \
   "$REAL_CODEX" app-server \
     -c "shell_environment_policy.set.AGMSG_CODEX_SEAT_KEY=\"$SEAT_KEY\"" \
     --listen "ws://127.0.0.1:0" >>"$SEAT_LOG" 2>&1 3>&- 4>&- &
```

**File**: `tests/test_codex_monitor.bats` (modified, +28/-0)
```diff
@@ -7,6 +7,7 @@ setup() {
   export TEST_PROJECT="$(mktemp -d)"
   export CALL_LOG="$TEST_PROJECT/calls.log"
   export APP_SERVER_ARGV_LOG="$TEST_PROJECT/app-server-argv.log"
+  export APP_SERVER_ENV_LOG="$TEST_PROJECT/app-server-env.log"
 
   # Fake codex for codex-monitor tests.
   #   --version            -> prints "codex-cli $FAKE_CODEX_VERSION"
@@ -32,6 +33,7 @@ case "${1:-}" in
   app-server)
     for a in "$@"; do printf ' <%s>' "$a" >> "$APP_SERVER_ARGV_LOG"; done
     printf '\n' >> "$APP_SERVER_ARGV_LOG"
+    printf 'flag=%s\n' "${AGMSG_CODEX_BRIDGE_LAUNCHER:-}" >> "$APP_SERVER_ENV_LOG"
     if [ "${FAKE_CODEX_MODE:-listen}" = "broken" ]; then
       echo "error: unexpected argument '--listen' found" >&2
       exit 2
@@ -126,6 +128,17 @@ teardown() {
   grep -q -- '<-c> <shell_environment_policy\.set\.AGMSG_CODEX_SEAT_KEY="[0-9.]\{1,\}">' "$APP_SERVER_ARGV_LOG"
 }
 
+@test "codex-monitor: the app-server inherits AGMSG_CODEX_BRIDGE_LAUNCHER=1 so SessionStart sees the launcher flag" {
+  skip_on_windows "spawns a python socket listener; flaky on the Windows runner"
+
+  # 親環境のフラグを除去し、monitor 自身が付けた値だけを観測する（偽陰性防止）
+  run env -u AGMSG_CODEX_BRIDGE_LAUNCHER FAKE_CODEX_VERSION=0.142.2 AGMSG_REAL_CODEX="$FAKE_CODEX" \
+    AGMSG_CODEX_BRIDGE_LAUNCHER_CMD=/bin/true \
+    bash "$TYPES/codex/codex-monitor.sh" --project "$TEST_PROJECT" --codex-command codex --
+  [ "$status" -eq 0 ]
+  grep -qx 'flag=1' "$APP_SERVER_ENV_LOG"
+}
+
 # --- #1254: one app-server per seat, never reused ---
 
 @test "codex-monitor: a second launch in the same project never reuses the first launch's server (#1254)" {
@@ -316,6 +329,9 @@ EOF
 case "${1:-}" in
   --version) echo "codex-cli 0.144.1"; exit 0 ;;
   app-server)
+    printf 'flag=%s\nseat=%s\nurl=%s\n' \
+      "${AGMSG_CODEX_BRIDGE_LAUNCHER:-}" "${AGMSG_CODEX_SEAT_KEY:-}" \
+      "${AGMSG_CODEX_BRIDGE_APP_SERVER:-}" > "$TEST_PROJECT/app-server-env"
     node - <<'JS' &
 const net = require('net');
 const s = net.createServer((c) => c.destroy());
@@ -342,6 +358,18 @@ EOF
     bash "$TYPES/codex/codex-monitor.sh" --project "$TEST_PROJECT" --codex-command codex --
   [ "$status" -eq 0 ]
   grep -q 'plain-codex <--remote> <ws://127\.0\.0\.1:[0-9][0-9]*>' "$CALL_LOG"
+  grep -qx 'flag=1' "$TEST_PROJECT/app-server-env"
+  grep -qx 'url=' "$TEST_PROJECT/app-server-env"
+  local seat record port restored
+  seat="$(sed -n 's/^seat=//p' "$TEST_PROJECT/app-server-env")"
+  [ -n "$seat" ]
+  record="$TEST_SKILL_DIR/run/codex-app-server.$seat.record"
+  [ -f "$record" ]
+  port="$(sed -n 's/^port=//p' "$record")"
+  restored="$(SKILL_DIR="$TEST_SKILL_DIR" AGMSG_CODEX_SEAT_KEY="$seat" \
+    bash -c 'source "$1"; _agmsg_codex_app_server_url "$2"' bash \
+      "$TYPES/codex/_app-server.sh" "$TEST_PROJECT")"
+  [ "$restored" = "ws://127.0.0.1:$port" ]
   [[ "$output" != *"did not report a listening port"* ]]
 }
 
```

---

### Incident Patch 10: `bb94ebea` (2026-10-01)
**Commit Message**: fix(app): emit each message once when events and legacy rows are linked (#1542)

The app watcher read both copies of each message: MESSAGES_SINCE_SQL unions events and the legacy messages table, and did not exclude a messages row already linked from events through legacy_id. Each message was therefore emitted twice, shown twice in the team room and injected twice into a pane. Linked rows are now emitted once; unlinked legacy rows (stores without events, or rows written by older versions) are still emitted, and both cursors advance as before.

Closes #1511.

**File**: `app/src-tauri/src/agmsg.rs` (modified, +119/-28)
```diff
@@ -256,39 +256,66 @@ fn direct_store_path(team: &str) -> Option<PathBuf> {
 
 /// New messages, from the event log and the legacy table together.
 ///
-/// The read rule mirrors `storage_history()` in
-/// `scripts/drivers/storage/sqlite.sh`. `src` breaks ties between a legacy
-/// row and an event-log row carrying the same timestamp, so the two spaces
-/// interleave in one stable order — legacy first, matching the facade.
+/// The read rule mirrors `storage_list_unread()` in
+/// `scripts/drivers/storage/sqlite.sh` (and `storage_history()` for the
+/// ordering). `src` breaks ties between a legacy row and an event-log row
+/// carrying the same timestamp, so the two spaces interleave in one stable
+/// order -- legacy first, matching the facade.
+///
+/// The core writes every message to BOTH tables, the event carrying the
+/// legacy rowid in `events.legacy_id` (#689). A union of the two therefore
+/// lists each message twice, so the legacy half marks a row `linked` when its
+/// event is in the live space and the reader below leaves it out: the event
+/// copy is the one that is emitted. Live space only (`seq > 0`), exactly as in
+/// the core: a legacy row projected for push has an event too, but at a
+/// negative `seq` below every cursor, which the event half can never return --
+/// skipping the legacy row on its account would lose the message.
+///
+/// A linked row is still FETCHED, and both cursors advance past it. Dropping
+/// it in SQL instead would leave `legacy_id` behind it for good, and every
+/// later poll would fetch and discard the same rows again.
 ///
 /// NOT enforced: nothing checks that this stays in step with the shell. The
 /// tests below assert what this returns, not that the facade agrees, so a
-/// change to `storage_history()` will not turn anything red here. Keeping
-/// the two aligned is currently a matter of someone remembering.
+/// change to the core's read will not turn anything red here. Keeping the two
+/// aligned is currently a matter of someone remembering.
 ///
 /// Two cursors because there are two id spaces: `events.seq` and the legacy
 /// `messages.id` autoincrement. They are unrelated counters, both starting
 /// at 1, so a single high-water mark would skip rows in whichever table was
 /// behind.
-const MESSAGES_SINCE_SQL: &str = "\
-    SELECT id, team, from_agent, to_agent, body, at, src, ord FROM (
+///
+/// `linked` is spliced in because the column it reads, `events.legacy_id`, only
+/// exists from core 1.2.0: against an older store naming it fails the whole
+/// statement. See [`read_new_messages`] for what happens then.
+fn messages_since_sql(linked: &str) -> String {
+    format!(
+        "\
+    SELECT id, team, from_agent, to_agent, body, at, src, ord, linked FROM (
       SELECT id AS id, team, from_agent, to_agent, body, at AS at,
-             1 AS src, seq AS ord
+             1 AS src, seq AS ord, 0 AS linked
         FROM events
        WHERE type='message_sent' AND seq > ?1
       UNION ALL
       SELECT CAST(id AS TEXT) AS id, team, from_agent, to_agent, body,
-             created_at AS at, 0 AS src, id AS ord
+             created_at AS at, 0 AS src, id AS ord, {linked} AS linked
         FROM messages
        WHERE id > ?2
     )
-    ORDER BY at ASC, src ASC, ord ASC";
+    ORDER BY at ASC, src ASC, ord ASC"
+    )
+}
+
+/// The `linked` test for a store whose `events` has `legacy_id`.
+const LINKED_TO_A_LIVE_EVENT: &str = "\
+    EXISTS (SELECT 1 FROM events e2
+             WHERE e2.legacy_id = messages.id AND e2.seq > 0)";
 
 /// The same read against a store built before the event log, where `events`
 /// does not exist and the whole query above fails to prepare.
 const MESSAGES_SINCE_LEGACY_ONLY_SQL: &str = "\
     SELECT CAST(id AS TEXT) AS id, team, from_agent, to_agent, body,
-           created_at AS at, 0 AS src, id AS ord
+           created_at AS at, 0 AS src, id AS ord, 0 AS linked
       FROM messages
      WHERE id > ?2
      ORDER BY at ASC, ord ASC";
@@ -302,18 +329,27 @@ struct Cursors {
     legacy_id: i64,
 }
 
-/// Reads rows newer than `cursors` and advances it past them.
+/// Reads rows newer than `cursors`, advances both past them, and returns the
+/// messages among them -- a legacy copy of a message whose event is also
+/// there is advanced past but not returned (see [`messages_since_sql`]).
 ///
-/// A store that predates the event log has no `events` table, and one built
-/// by a current `storage_init` always has both — so the query is attempted
-/// whole and, if `events` is missing, retried against the legacy table
-/// alone. That is the released layout today: this machine's own store has
-/// `messages` with 6,285 rows and no `events` table at all.
+/// The statement is attempted at three levels, each for an older store than
+/// the last:
+///
+/// 1. both tables, with the legacy copies of live events recognised --
+///    needs `events.legacy_id` (core 1.2.0 and later);
+/// 2. both tables with 
```

---

### Incident Patch 11: `c163d9d8` (2026-10-01)
**Commit Message**: fix(site): bump Astro for GHSA-26w7-cxv4-gfx2 (#1458)

Bump the site's Astro to a release that includes the fix for
GHSA-26w7-cxv4-gfx2, and apply npm audit fixes for its build dependencies.
The site now builds on Node 22, and the gallery path is repaired after the
prerender step. Site content and layout are unchanged; this affects only the
static site build, not the CLI or the desktop app.

**File**: `.github/workflows/pages.yml` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ jobs:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with:
-          node-version: 20
+          node-version: 22
           cache: npm
           cache-dependency-path: site/package-lock.json
       - run: npm ci
```

**File**: `site/astro.config.mjs` (modified, +13/-1)
```diff
@@ -1,11 +1,23 @@
 import { defineConfig } from 'astro/config';
 import tailwindcss from '@tailwindcss/vite';
+import { fileURLToPath } from 'node:url';
 
 // Prototype site for agmsg.cc (#213). Source lives in site/; future CI builds
 // this to the Pages artifact. Does not touch the live docs/.
+
+// astro.config.mjs is loaded directly by Node (not bundled by Astro's prerender
+// step), so import.meta.url here reliably points at site/ regardless of the
+// process's invocation cwd. Injected as a build-time constant so components
+// (e.g. Home.astro's agent-types gallery) can resolve paths outside src/
+// without depending on process.cwd() or a bundler-relocated import.meta.url.
+const projectRoot = fileURLToPath(new URL('.', import.meta.url));
+
 export default defineConfig({
   site: 'https://agmsg.cc',
-  vite: { plugins: [tailwindcss()] },
+  vite: {
+    plugins: [tailwindcss()],
+    define: { __PROJECT_ROOT__: JSON.stringify(projectRoot) },
+  },
   // English stays unprefixed at "/" (existing URLs/SEO untouched); every other
   // locale is generated under its own "/xx/" prefix by src/pages/[lang]/*.astro.
   i18n: {
```

**File**: `site/package.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
     "preview": "astro preview"
   },
   "dependencies": {
-    "astro": "^5.6.0",
+    "astro": "^7.2.8",
     "tailwindcss": "^4.0.0",
     "@tailwindcss/vite": "^4.0.0"
   }
```

**File**: `site/src/layouts/Home.astro` (modified, +7/-2)
```diff
@@ -2,7 +2,6 @@
 import "../styles/global.css";
 import fs from "node:fs";
 import path from "node:path";
-import { fileURLToPath } from "node:url";
 import { defaultLang, languages, localizedPath, useTranslations } from "../i18n/utils.js";
 
 interface Props {
@@ -12,7 +11,13 @@ const { lang } = Astro.props;
 const t = useTranslations(lang);
 
 // --- Agent Types gallery: data-driven from scripts/drivers/types/*/type.conf ---
-const typesDir = fileURLToPath(new URL("../../../scripts/drivers/types", import.meta.url));
+// __PROJECT_ROOT__ (defined in astro.config.mjs) rather than import.meta.url:
+// Astro 7's prerender bundling relocates this file's on-disk position relative
+// to the source tree, breaking a fixed "../../../"-style walk. It also beats
+// process.cwd(), which is only site/ because CI/local scripts happen to invoke
+// astro from there — not guaranteed if invoked with an explicit --root elsewhere.
+declare const __PROJECT_ROOT__: string;
+const typesDir = path.join(__PROJECT_ROOT__, "..", "scripts", "drivers", "types");
 
 function parseConf(file) {
   const out = {};
```

---

### Incident Patch 12: `c867ca65` (2026-10-01)
**Commit Message**: fix(codex): pass the seat key to app-server tool commands under a restricted shell environment policy (#1541)

With Codex's `shell_environment_policy.inherit = "core"` (or "none"), tool
commands under `--remote` no longer saw AGMSG_CODEX_SEAT_KEY, so actas never
wrote the bridge request and the bridge did not start. codex-monitor now also
passes the seat key to the app-server as a `shell_environment_policy.set`
override. With the default inherit = "all" the same value is already there, so
nothing changes. A config that excludes the key through include_only still has
to list it.

Closes #1537.

**File**: `scripts/drivers/types/codex/codex-monitor.sh` (modified, +13/-1)
```diff
@@ -187,8 +187,20 @@ port_alive() {  # $1 = port; succeeds if something is accepting on 127.0.0.1:$1
 # under --remote) inherit THIS process's environment directly, which is the
 # whole point -- no ancestry walk is needed anywhere downstream to find a
 # seat's own server (design review, replacing an earlier ancestry-walk design).
+#
+# Also passed as a `shell_environment_policy.set` override: under a
+# `shell_environment_policy.inherit` other than the default "all" (e.g.
+# "core" or "none"), Codex 0.158+ no longer lets tool-command children see a
+# var the policy excludes, so the plain env var above stops reaching them.
+# `set` is applied after `inherit`/exclude, so this reaches the tool
+# environment regardless of `inherit`; a user's own `include_only` still
+# filters after `set` and must list the var themselves (#1537). The key is
+# generated internally as digits and dots only (_agmsg_codex_seat_key_new),
+# so it is always safe inside this double-quoted TOML string unescaped.
 AGMSG_CODEX_SEAT_KEY="$SEAT_KEY" \
-  "$REAL_CODEX" app-server --listen "ws://127.0.0.1:0" >>"$SEAT_LOG" 2>&1 3>&- 4>&- &
+  "$REAL_CODEX" app-server \
+    -c "shell_environment_policy.set.AGMSG_CODEX_SEAT_KEY=\"$SEAT_KEY\"" \
+    --listen "ws://127.0.0.1:0" >>"$SEAT_LOG" 2>&1 3>&- 4>&- &
 server_bg="$!"
 
 PORT=""
```

**File**: `tests/test_codex_monitor.bats` (modified, +30/-4)
```diff
@@ -6,13 +6,19 @@ setup() {
   setup_test_env
   export TEST_PROJECT="$(mktemp -d)"
   export CALL_LOG="$TEST_PROJECT/calls.log"
+  export APP_SERVER_ARGV_LOG="$TEST_PROJECT/app-server-argv.log"
 
   # Fake codex for codex-monitor tests.
   #   --version            -> prints "codex-cli $FAKE_CODEX_VERSION"
-  #   app-server --listen  -> FAKE_CODEX_MODE=broken: reject (emulate a release
-  #                           that can't bring the app-server up); otherwise bind
-  #                           a real loopback port, print the listening line, and
-  #                           stay alive so reuse health checks see a live server.
+  #   app-server --listen  -> logs this invocation's argv to
+  #                           APP_SERVER_ARGV_LOG (a separate file from
+  #                           CALL_LOG: some tests assert CALL_LOG does not
+  #                           exist at all, which app-server always being
+  #                           called first would break). FAKE_CODEX_MODE=broken:
+  #                           reject (emulate a release that can't bring the
+  #                           app-server up); otherwise bind a real loopback
+  #                           port, print the listening line, and stay alive
+  #                           so reuse health checks see a live server.
   #   anything else        -> log the invocation to CALL_LOG (the plain/--remote
   #                           handoff target) and exit.
   export FAKE_CODEX="$TEST_PROJECT/real-codex"
@@ -24,6 +30,8 @@ case "${1:-}" in
     exit 0
     ;;
   app-server)
+    for a in "$@"; do printf ' <%s>' "$a" >> "$APP_SERVER_ARGV_LOG"; done
+    printf '\n' >> "$APP_SERVER_ARGV_LOG"
     if [ "${FAKE_CODEX_MODE:-listen}" = "broken" ]; then
       echo "error: unexpected argument '--listen' found" >&2
       exit 2
@@ -100,6 +108,24 @@ teardown() {
   grep -qx 'plain-codex <resume>' "$CALL_LOG"
 }
 
+# --- #1537: the seat key must reach tool commands under any shell_environment_policy ---
+
+@test "codex-monitor: the app-server is launched with the seat key as a shell_environment_policy.set override (#1537)" {
+  skip_on_windows "spawns a python socket listener; flaky on the Windows runner"
+
+  # A restrictive shell_environment_policy.inherit (e.g. "core" or "none") on
+  # the model's shell commands excludes a plain env var not in the policy's
+  # keep-list (Codex 0.158+, openai/codex#48099). `set` is applied after
+  # `inherit`, so the key must also be passed as a `-c
+  # shell_environment_policy.set.AGMSG_CODEX_SEAT_KEY=...` override to reach
+  # those commands regardless of the user's own inherit setting.
+  run env FAKE_CODEX_VERSION=0.142.2 AGMSG_REAL_CODEX="$FAKE_CODEX" \
+    AGMSG_CODEX_BRIDGE_LAUNCHER_CMD=/bin/true \
+    bash "$TYPES/codex/codex-monitor.sh" --project "$TEST_PROJECT" --codex-command codex --
+  [ "$status" -eq 0 ]
+  grep -q -- '<-c> <shell_environment_policy\.set\.AGMSG_CODEX_SEAT_KEY="[0-9.]\{1,\}">' "$APP_SERVER_ARGV_LOG"
+}
+
 # --- #1254: one app-server per seat, never reused ---
 
 @test "codex-monitor: a second launch in the same project never reuses the first launch's server (#1254)" {
```

---

### Incident Patch 13: `8ca3f9a5` (2026-10-01)
**Commit Message**: fix(actas): reclaim a role held by the same live process after /clear (#1540)

After `/clear` in Claude Code the process keeps its pid but gets a new session
id, and the next actas was refused as held by `<old-session>.<same pid>`. The
held branch of actas-claim.sh now tries the existing same-process reclaim
first: it replaces the owner only when the embedded pid matches the current
holder's and that holder is positively alive. A different, dead or unreadable
owner is handled as before.

Closes #1489.

**File**: `scripts/actas-claim.sh` (modified, +10/-0)
```diff
@@ -88,6 +88,16 @@ while IFS= read -r team; do
   case "$result" in
     ok) : ;;
     held:*)
+      # A new session id on the SAME live pid (Claude Code /clear, #1468/#1489)
+      # is still the same seat, so it may reclaim atomically here before the
+      # refusal below -- actas_lock_reclaim_same_process already refuses
+      # anything else (a different pid, a dead one, or an unreadable lock), so
+      # this cannot hand the role to a different live process.
+      handoff=$(actas_lock_reclaim_same_process "$team" "$NAME" "$SESSION_ID" 2>/dev/null || true)
+      if [ "$handoff" = "ok" ]; then
+        claimed="${claimed:+$claimed$'\n'}$team"
+        continue
+      fi
       # Roll back any partial claims so the user can retry cleanly.
       while IFS= read -r c_team; do
         [ -z "$c_team" ] && continue
```

**File**: `tests/test_actas_integration.bats` (modified, +16/-0)
```diff
@@ -68,6 +68,22 @@ fake_session() {
   [ "$(_owner_only T alice)" = "sid-owner" ]   # not stolen
 }
 
+@test "actas-claim: same live pid with a new session id reclaims after clear (#1489)" {
+  # Claude Code's /clear keeps the OS process (and its pid) but mints a new
+  # session id. The lock still names the pre-/clear session id, but it is
+  # the same seat, so this reclaims instead of refusing it as held.
+  skip_on_windows "actas live-session liveness under Git Bash (#182)"
+  fake_register T alice
+  export AGMSG_AGENT_PID="$$"
+  local old_owner="sid-before-clear.$$"
+  echo "$old_owner" > "$(actas_lock_path T alice)"
+
+  run bash "$SKILL_DIR/scripts/actas-claim.sh" /tmp/p1 claude-code alice "sid-after-clear"
+  [ "$status" -eq 0 ]
+  printf '%s\n' "$output" | grep -qF "status=ok"
+  [ "$(_owner_only T alice)" = "sid-after-clear.$$" ]
+}
+
 @test "actas-claim: status=not_registered when name is unknown" {
   fake_register T alice
   fake_session "sid-me" >/dev/null
```

---

### Incident Patch 14: `5e2b42ca` (2026-10-01)
**Commit Message**: fix(remote): restart the sync engine when set-endpoint is refused by the adopt check (#1539)

When the adopt check refused `remote.sh set-endpoint`, the sync engine stopped
a few lines earlier was left stopped, silently. On that refusal path the engine
is now restarted if it was running, and the message says so; if it cannot be
restarted, the message says it is stopped and how to start it. The exit code,
the success path and the later failure paths are unchanged.

Closes #1512.

**File**: `scripts/remote.sh` (modified, +12/-1)
```diff
@@ -3901,7 +3901,18 @@ cmd_set_endpoint() {
   # and this write must refuse rather than overwrite that newer state -- the
   # adopt path rewrites the whole binding, disconnected_at:null included.
   _remote_adopt_registration "$team" "$cfg" "$endpoint" "$remote_team_id" \
-    "$binding_cipher" "$server_instance" "$binding_revision" || exit 1
+    "$binding_cipher" "$server_instance" "$binding_revision" || {
+    # A refusal writes nothing, so the binding is as it was: put the engine
+    # back rather than leave a refused move to stop sync silently (#1512).
+    if [ "$was_running" -eq 1 ]; then
+      if _remote_sync_engine_start "$team"; then
+        echo "agmsg: the binding was not changed; the sync engine was restarted." >&2
+      else
+        echo "agmsg: the binding was not changed, but the sync engine is stopped; start it with: remote.sh sync start $(agmsg_shq "$team")" >&2
+      fi
+    fi
+    exit 1
+  }
 
   # Two places pin the address: the binding (moved above) and the stored sync
   # config, whose server_url loadConfig requires to match the binding. The
```

**File**: `tests/test_remote.bats` (modified, +8/-5)
```diff
@@ -404,12 +404,12 @@ _binding_field() {  # $1 = team, $2 = json path under remote_binding
   anchored="$(_binding_field testteam server_instance_id)"
   [ -n "$anchored" ]
 
-  # Same address family, different server: registrations survive the rotation,
-  # so the recorded instance id is the only thing that can tell them apart.
-  run curl -sS "$ENDPOINT/_test/rotate-server-id"
-  [ "$status" -eq 0 ]
+  # A second, different server at the new address. The original server is left
+  # alone so the running engine keeps running up to the set-endpoint call.
+  start_second_mock_server
+  kill -0 "$(cat "$TEST_SKILL_DIR/run/remote-sync.testteam.pid")"
 
-  run bash "$SCRIPTS/remote.sh" set-endpoint --endpoint "http://localhost:$MOCK_PORT" testteam
+  run bash "$SCRIPTS/remote.sh" set-endpoint --endpoint "$ENDPOINT_B" testteam
   [ "$status" -ne 0 ]
   # What differed is SAID, both sides of it -- not a bare "refused".
   grep -Fq "is now server instance 018f3f7e-2222-7000-8000-0000000000ff" <<<"$output"
@@ -418,6 +418,9 @@ _binding_field() {  # $1 = team, $2 = json path under remote_binding
   # And nothing was written: the binding still names the verified address.
   [ "$(_binding_field testteam endpoint)" = "$ENDPOINT" ]
   [ "$(_binding_field testteam server_instance_id)" = "$anchored" ]
+  # A refused move leaves the engine running, as it found it (#1512).
+  grep -Fq "the sync engine was restarted" <<<"$output"
+  kill -0 "$(cat "$TEST_SKILL_DIR/run/remote-sync.testteam.pid")"
 }
 
 @test "set-endpoint: re-running from the partial state repairs the stored sync config (#739 P1-1)" {
```

---

### Incident Patch 15: `609796fe` (2026-10-01)
**Commit Message**: fix(codex): normalize the project path before hashing the Windows bridge lease (#1522)

On Windows the bridge hashed the project path in native form (C:\...) while the
launcher hashed the Git Bash form (/c/...), so the lease's project hash never
matched. The bridge now normalizes the path with the existing toPosixPath()
before hashing. POSIX paths are unchanged.

Closes #1521.

**File**: `scripts/drivers/types/codex/codex-bridge.js` (modified, +1/-1)
```diff
@@ -1196,7 +1196,7 @@ class CodexBridge {
     if (!token) throw new Error("cannot determine process start token for identity lease");
     const host = os.hostname();
     if (!host) throw new Error("cannot determine hostname for identity lease");
-    const projectHash = crypto.createHash("sha1").update(this.opts.project).digest("hex");
+    const projectHash = crypto.createHash("sha1").update(toPosixPath(this.opts.project)).digest("hex");
     // Canonicalize the pair SET before hashing: hash each "team\tname" pair, then
     // sort the hex hashes (pure ASCII, so a byte sort in the launcher and a JS
     // code-unit sort here agree even for non-ASCII names) and hash the joined
```

**File**: `tests/test_codex_bridge.bats` (modified, +42/-0)
```diff
@@ -2352,3 +2352,45 @@ EOF
   [ "$completion_line" -lt "$second_turn_line" ]
   [ "$completion_line" -lt "$gone_line" ]
 }
+
+
+@test "codex-bridge: lease project hash agrees across native Windows and Git Bash paths" {
+  run node - "$TYPES/codex/codex-bridge.js" "$TEST_SKILL_DIR" <<'NODE'
+const assert = require("node:assert/strict");
+const crypto = require("node:crypto");
+const fs = require("node:fs");
+const path = require("node:path");
+const vm = require("node:vm");
+const { createRequire } = require("node:module");
+const filename = path.resolve(process.argv[2]);
+const mod = { exports: {} };
+const context = {
+  require: createRequire(filename), module: mod, exports: mod.exports,
+  __filename: filename, __dirname: path.dirname(filename),
+  process, console, Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
+};
+// 実際の lease 書込みを検査し、ネットワーク接続やプロセス起動は行わない。
+vm.runInNewContext(fs.readFileSync(filename, "utf8") +
+  "\nmodule.exports.CodexBridge = CodexBridge;", context, { filename });
+const leasefile = path.join(process.argv[3], "project-hash-test.lease");
+const hash = (p) => crypto.createHash("sha1").update(p).digest("hex");
+function leaseHash(project) {
+  mod.exports.CodexBridge.prototype.writeLease.call({
+    opts: { project }, identities: [{ team: "team", name: "alice" }], leasefile,
+    startToken: () => ({ src: "pwsh", token: "123456" }),
+  });
+  return fs.readFileSync(leasefile, "utf8").match(/^project=(.*)$/m)[1];
+}
+const expected = hash("/c/TEMP/project with spaces");
+assert.equal(leaseHash(String.raw`C:\TEMP\project with spaces`), expected);
+assert.equal(leaseHash("C:/TEMP/project with spaces"), expected);
+assert.equal(leaseHash("/c/TEMP/project with spaces"), expected);
+assert.notEqual(leaseHash("C:/TEMP/other project"), expected);
+assert.notEqual(leaseHash("C:/TEMP/Project with spaces"), expected);
+assert.equal(leaseHash(String.raw`\\host\share\project`), hash("//host/share/project"));
+assert.equal(leaseHash("/home/me/project"), hash("/home/me/project"));
+assert.equal(leaseHash(String.raw`/home/me/project\literal`), hash(String.raw`/home/me/project\literal`));
+fs.unlinkSync(leasefile);
+NODE
+  [ "$status" -eq 0 ]
+}
```

#### Recent Merged Pull Requests:
- **PR #1579** (2026-10-05): release: 1.5.3 (@fujibee)
- **PR #1578** (2026-10-05): fix: skip shared launcher for custom command installations (@fujibee)
- **PR #1577** (2026-10-05): agmsgd: deliver to Claude Code seats over their own peer socket (@fujibee)
- **PR #1576** (2026-10-05): Merge main into integration/agmsgd-beta (6) (@fujibee)
- **PR #1575** (2026-10-05): clean up leaked storage sync driver outcome files (#1572) (@fujibee)
- **PR #1574** (2026-10-05): skill: ask before creating a team, point at delete and update (@fujibee)
- **PR #1573** (2026-10-05): Support Windows Codex queue from version 0.157.0 (@fujibee)
- **PR #1572** (2026-10-05): storage-sync-driver: remove the outcome file explicitly, not only via its EXIT trap (@fujibee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
