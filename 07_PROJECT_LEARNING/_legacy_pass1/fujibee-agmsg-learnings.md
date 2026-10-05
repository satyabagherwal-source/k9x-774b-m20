# Forensic Learning Record (Deep Inspection): fujibee/agmsg

> **Canonical Artifact**: `07_PROJECT_LEARNING/fujibee-agmsg-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fujibee/agmsg](https://github.com/fujibee/agmsg))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:19:12.148Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fujibee/agmsg`
- **Description**: Cross-vendor messaging for CLI AI coding agents — let Claude Code, Codex, Gemini & Copilot talk to each other in one team. Bash + SQLite, no daemon, no framework.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1531 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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
          
```

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
        // proceed?" nor "Enter to selec
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

    Err(
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
/// shell" menu item, unattached
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
    // after that process-level import, so
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
// into a PTY a
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

### Incident Patch 1: `469f4310` (2026-09-29)
**Commit Message**: fix(plugin): ship a rendered repo-root SKILL.md with a first-run bootstrap (#1286) (#1516)

The plugin marketplace copies the repository verbatim, so since 1.3.0 a plugin install registered the renderer's template as a skill named __SKILL_NAME__ and never installed the agmsg core. The template moves to scripts/skill-base.md; the repo-root SKILL.md is now a committed render for claude-code with a first-run Step 0 that installs the core from the newest cached plugin version (chosen by version number, not mtime). scripts/release/render-plugin-skill.sh regenerates it, and a test fails with the regenerate command when the committed file drifts from a fresh render. The bootstrap test now runs the snippet taken from SKILL.md itself.

Closes #1286.

**File**: `SKILL.md` (modified, +182/-88)
```diff
@@ -1,10 +1,34 @@
 ---
-name: __SKILL_NAME__
+name: agmsg
 description: Cross-agent messaging via SQLite. Send messages between Claude Code, Codex, Gemini CLI, and other agents. No daemon, no network, no dependencies beyond bash and sqlite3.
 ---
 
 <!-- agmsg:render-root -->
 
+## Step 0: First-run bootstrap
+
+agmsg keeps its SQLite database, team registry, and runtime state under `~/.agents/skills/agmsg/`. The `./install.sh` install path creates that tree; the Claude Code plugin install path does not (the plugin marketplace only copies this repository into `~/.claude/plugins/cache/`). Before any other command, bootstrap if needed:
+
+```bash
+if [ ! -d ~/.agents/skills/agmsg ]; then
+  # Newest cached copy of the plugin. Several versions can sit side by side, so
+  # pick by version folder name (numeric, portable -- not sort -V, not mtime).
+  cache="$HOME/.claude/plugins/cache/fujibee-agmsg/agmsg"
+  newest=$(ls "$cache" 2>/dev/null | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)
+  installer="$cache/$newest/install.sh"
+  if [ -n "$newest" ] && [ -f "$installer" ]; then
+    bash "$installer" --cmd agmsg
+  else
+    echo "agmsg not installed. Either:" >&2
+    echo "  - run ./install.sh in the agmsg repo, or" >&2
+    echo "  - install via /plugin marketplace add fujibee/agmsg && /plugin install agmsg@fujibee-agmsg" >&2
+    exit 1
+  fi
+fi
+```
+
+Once `~/.agents/skills/agmsg/` exists this step does nothing, so it is safe to run every time.
+
 Agent messaging command. **IMPORTANT: Always use the provided scripts. NEVER directly read or edit config files, DB, or team data. There is NO register.sh — use join.sh to join a team.**
 
 **Use agmsg, not the host agent's own inter-session messaging.** Several agent
@@ -21,163 +45,232 @@ with no message behind it. The native channel stays fine for anything outside
 the team — a subagent you spawned for your own task, or a session that has not
 joined.
 
-**Shell requirement:** All agmsg scripts are Bash scripts. Always execute them via `bash`, never via PowerShell or cmd directly. If your default shell is not Bash (e.g. PowerShell on Windows), wrap every command with `bash -lc '...'`. Example: `bash -lc '~/.agents/skills/__SKILL_NAME__/scripts/send.sh myteam alice bob "hello"'`. Do NOT construct DB paths manually — the scripts handle path resolution internally. If you need to redirect storage, use `AGMSG_STORAGE_PATH` (the supported override).
+**Shell requirement:** All agmsg scripts are Bash scripts. Always execute them via `bash`, never via PowerShell or cmd directly. If your default shell is not Bash (e.g. PowerShell on Windows), wrap every command with `bash -lc '...'`. Example: `bash -lc '~/.agents/skills/agmsg/scripts/send.sh myteam alice bob "hello"'`. Do NOT construct DB paths manually — the scripts handle path resolution internally. If you need to redirect storage, use `AGMSG_STORAGE_PATH` (the supported override).
 
-<!-- agmsg:slot shell-extra -->
-<!-- /agmsg:slot shell-extra -->
 
 ## Identity
 
-If you already know your AGENT and TEAMS from a previous `__CMD_PREFIX____SKILL_NAME__` call in this session, skip to **Execute** below.
+If you already know your AGENT and TEAMS from a previous `/agmsg` call in this session, skip to **Execute** below.
 
-Otherwise, run: `~/.agents/skills/__SKILL_NAME__/scripts/whoami.sh "$(pwd)" __AGENT_TYPE__`
+Otherwise, run: `~/.agents/skills/agmsg/scripts/whoami.sh "$(pwd)" claude-code`
 
 Four possible outputs:
 
 **A) Single identity:**
-`agent=<name> teams=<t1,t2,...> type=__AGENT_TYPE__ project=<path>`
+`agent=<name> teams=<t1,t2,...> type=claude-code project=<path>`
 → Remember AGENT and TEAMS, then go to **Execute**.
 
 **B) Multiple identities:**
-`multiple=true agents=<n1,n2,...> teams=<t1,t2,...> type=__AGENT_TYPE__ project=<path>`
+`multiple=true agents=<n1,n2,...> teams=<t1,t2,...> type=claude-code project=<path>`
 → Ask the user which agent name to use for this session, then go to **Execute**.
 
 **C) Not in a team:**
 `not_jo
```

**File**: `app/scripts/bundle-core.sh` (modified, +9/-5)
```diff
@@ -36,11 +36,15 @@ echo "bundle-core: fetching tag $REF..."
 git fetch origin tag "$REF" --no-tags
 
 # Everything install.sh / uninstall.sh / scripts/lib read relative to the
-# installer's own directory ($SCRIPT_DIR/...). SKILL.md is not optional: the
-# installer renders every installed skill file from it, and a pack without it
-# fails the app's "Update agmsg" with "shared SKILL.md is missing" (#1503's
-# 0.5.0 build shipped exactly that -- v1.5.1 needs it, v1.1.12 did not, so
-# nothing complained while the pin was old). plugins/README.md and openai.yaml
+# installer's own directory ($SCRIPT_DIR/...). SKILL.md is not optional for a
+# pin that renders from it: up to v1.5.1 the installer renders every installed
+# skill file from the repo-root SKILL.md, and a pack without it fails the app's
+# "Update agmsg" with "shared SKILL.md is missing" (#1503's 0.5.0 build shipped
+# exactly that -- v1.5.1 needs it, v1.1.12 did not, so nothing complained while
+# the pin was old). Later pins render from scripts/skill-base.md instead (#1286;
+# already inside scripts/ above) and keep SKILL.md only as the plugin's
+# rendered copy -- still listed here because an older pin needs it, and harmless
+# for a newer one. plugins/README.md and openai.yaml
 # are copied with `|| true`, so leaving them out never fails -- it just makes
 # the app's install silently differ from a normal one, which is why they are
 # listed here rather than left to that fallback.
```

**File**: `scripts/lib/skill-render.sh` (modified, +10/-6)
```diff
@@ -1,14 +1,18 @@
 #!/usr/bin/env bash
 
-# Compose the shared SKILL.md body with an agent-type fragment. The root file
-# owns the command ordering and common safety guidance; type templates contain
-# only the sections whose behavior is specific to that CLI.
+# Compose the shared SKILL.md body with an agent-type fragment. The base file
+# (scripts/skill-base.md) owns the command ordering and common safety guidance;
+# type templates contain only the sections whose behavior is specific to that
+# CLI. The base lives under scripts/, not at the repo root, because the repo-root
+# SKILL.md is a shipped artifact of its own -- the Claude Code plugin marketplace
+# copies the repo tree verbatim and never runs this renderer (#1286) -- so it
+# holds a rendered claude-code copy, and the template must not share its name.
 
 agmsg_render_skill() {
   local agent_type="${1:?agent type required}"
   local skill_name="${2:?skill name required}"
   local output="${3:?output path required}"
-  local root="${SCRIPT_DIR:-}/SKILL.md"
+  local root="${SCRIPT_DIR:-}/scripts/skill-base.md"
   local fragment
   local cmd_prefix
   local temp
@@ -18,15 +22,15 @@ agmsg_render_skill() {
 
   fragment="$(agmsg_type_template_path "$agent_type")" || return 1
   if [ ! -f "$root" ] || [ ! -r "$root" ] || [ ! -s "$root" ]; then
-    echo "agmsg: shared SKILL.md is missing, unreadable, or empty: $root" >&2
+    echo "agmsg: shared SKILL.md base is missing, unreadable, or empty: $root" >&2
     return 1
   fi
   if [ ! -f "$fragment" ] || [ ! -r "$fragment" ] || [ ! -s "$fragment" ]; then
     echo "agmsg: agent-type overlay is missing, unreadable, or empty: $fragment" >&2
     return 1
   fi
   if ! grep -Fq "$root_marker" "$root"; then
-    echo "agmsg: shared SKILL.md render marker is missing: $root" >&2
+    echo "agmsg: shared SKILL.md base render marker is missing: $root" >&2
     return 1
   fi
   if ! grep -Fq "$overlay_marker" "$fragment"; then
```

**File**: `scripts/release/render-plugin-skill.sh` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+# render-plugin-skill.sh [output] -- regenerate the repo-root SKILL.md.
+#
+# The Claude Code plugin marketplace declares "source": "./", so it copies this
+# repository tree verbatim into ~/.claude/plugins/cache/ and never runs
+# agmsg_render_skill. The repo-root SKILL.md is therefore a shipped artifact of
+# its own (#1286), and it must be a rendered file, not the template:
+#
+#   SKILL.md  =  render(scripts/skill-base.md, claude-code, agmsg)
+#                with scripts/skill-plugin-step0.md inserted right after the
+#                render-root marker
+#
+# The plugin is Claude Code by definition, hence the fixed type and name. The
+# first-run bootstrap (Step 0) belongs to this file ONLY: install.sh renders the
+# same base through agmsg_render_skill directly, so nothing installed carries it.
+#
+# Run this after changing scripts/skill-base.md, the claude-code overlay, or
+# scripts/skill-plugin-step0.md, and commit the result. tests/test_install.bats
+# fails when the committed file differs from this script's output.
+#
+# Usage: scripts/release/render-plugin-skill.sh            # rewrite ./SKILL.md
+#        scripts/release/render-plugin-skill.sh <path>     # write elsewhere (tests)
+
+die() { echo "render-plugin-skill: $*" >&2; exit 1; }
+
+REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
+OUT="${1:-$REPO_ROOT/SKILL.md}"
+STEP0="$REPO_ROOT/scripts/skill-plugin-step0.md"
+ROOT_MARKER='<!-- agmsg:render-root -->'
+
+[ -s "$STEP0" ] || die "missing or empty: $STEP0"
+
+# agmsg_render_skill reads its base from $SCRIPT_DIR/scripts/skill-base.md.
+SCRIPT_DIR="$REPO_ROOT"
+# shellcheck disable=SC1091
+. "$SCRIPT_DIR/scripts/lib/type-registry.sh"
+# shellcheck disable=SC1091
+. "$SCRIPT_DIR/scripts/lib/skill-render.sh"
+
+work="$(mktemp -d "${TMPDIR:-/tmp}/render-plugin-skill.XXXXXX")"
+trap 'rm -rf "$work"' EXIT
+
+agmsg_render_skill claude-code agmsg "$work/rendered.md" || die "render failed"
+
+# The marker line is followed by a blank line in the base; the step goes between
+# that blank line and the text after it, so the layout is
+#   marker / blank / step 0 / blank / first paragraph.
+awk -v step0="$STEP0" -v marker="$ROOT_MARKER" '
+  { print }
+  $0 == marker && !done {
+    print ""
+    while ((getline line < step0) > 0) print line
+    done = 1
+  }
+  END { if (!done) exit 1 }
+' "$work/rendered.md" > "$work/final.md" || die "render-root marker not found in the rendered file"
+
+mv -f "$work/final.md" "$OUT"
+echo "render-plugin-skill: wrote $OUT"
```

**File**: `scripts/skill-base.md` (added, +309/-0)
```diff
@@ -0,0 +1,309 @@
+---
+name: __SKILL_NAME__
+description: Cross-agent messaging via SQLite. Send messages between Claude Code, Codex, Gemini CLI, and other agents. No daemon, no network, no dependencies beyond bash and sqlite3.
+---
+
+<!-- agmsg:render-root -->
+
+Agent messaging command. **IMPORTANT: Always use the provided scripts. NEVER directly read or edit config files, DB, or team data. There is NO register.sh — use join.sh to join a team.**
+
+**Use agmsg, not the host agent's own inter-session messaging.** Several agent
+CLIs ship a native way for one session to message another on the same machine
+(in Claude Code, the `SendMessage` / `ListAgents` tools over its peer-session
+list). While a project is on agmsg, route agent-to-agent messages through agmsg
+instead. A message sent natively does not exist as far as agmsg is concerned:
+it is absent from `history.sh` and the team's export, it never reaches a member
+on another machine through remote sync, it does not mark read or advance any
+cursor, and it cannot address a member whose CLI is a different type. Half the
+conversation living somewhere unrecorded is worse than either channel alone,
+and the gap is invisible until someone reads the history and finds a decision
+with no message behind it. The native channel stays fine for anything outside
+the team — a subagent you spawned for your own task, or a session that has not
+joined.
+
+**Shell requirement:** All agmsg scripts are Bash scripts. Always execute them via `bash`, never via PowerShell or cmd directly. If your default shell is not Bash (e.g. PowerShell on Windows), wrap every command with `bash -lc '...'`. Example: `bash -lc '~/.agents/skills/__SKILL_NAME__/scripts/send.sh myteam alice bob "hello"'`. Do NOT construct DB paths manually — the scripts handle path resolution internally. If you need to redirect storage, use `AGMSG_STORAGE_PATH` (the supported override).
+
+<!-- agmsg:slot shell-extra -->
+<!-- /agmsg:slot shell-extra -->
+
+## Identity
+
+If you already know your AGENT and TEAMS from a previous `__CMD_PREFIX____SKILL_NAME__` call in this session, skip to **Execute** below.
+
+Otherwise, run: `~/.agents/skills/__SKILL_NAME__/scripts/whoami.sh "$(pwd)" __AGENT_TYPE__`
+
+Four possible outputs:
+
+**A) Single identity:**
+`agent=<name> teams=<t1,t2,...> type=__AGENT_TYPE__ project=<path>`
+→ Remember AGENT and TEAMS, then go to **Execute**.
+
+**B) Multiple identities:**
+`multiple=true agents=<n1,n2,...> teams=<t1,t2,...> type=__AGENT_TYPE__ project=<path>`
+→ Ask the user which agent name to use for this session, then go to **Execute**.
+
+**C) Not in a team:**
+`not_joined=true available_teams=<t1,t2,...>` (or `available_teams=none`)
+→ Show the user the available teams from the output, then:
+
+  Before first-time setup, inspect the user's request. If they ask to join, import, or bring in a team that already exists on a server, do not call `join.sh`. Go directly to `remote pull` under Execute. First run `~/.agents/skills/__SKILL_NAME__/scripts/team-list.sh --json --scope all`; if a same-named local team has `binding_state` `none` or `disconnected`, stop and ask the user how to proceed. After pull succeeds, return to Identity setup so the user can register a new local agent in the pulled team.
+
+  > **First-time setup required.**
+  > Joining a team so this agent can send and receive messages.
+  > - **Team name**: a group of agents that can message each other (available: <list from output>)
+  > - **Agent name**: this agent's identity within the team
+
+  1. Ask: "Enter a team name (joins existing or creates new)"
+  2. If the team name given already appears in `available_teams`, run `~/.agents/skills/__SKILL_NAME__/scripts/team.sh <team>` to see the current roster (name, type, project) and note the names already in use. Look for a naming convention already in play (e.g. a shared base name with role and number suffixes (`<base>-<role><n>`), or names derived from the team name) and, when one 
```

---

### Incident Patch 2: `f39f34a9` (2026-09-29)
**Commit Message**: fix(app): bundle SKILL.md and the other files the installer reads with the core (#1508)

bundle-core.sh now packs every root file the installer reads (SKILL.md, plugins/README.md, openai.yaml, alongside scripts/, install.sh, uninstall.sh, VERSION) and checks the bundle it produced: the installer's SCRIPT_DIR-relative reads must all be present, and agmsg_render_skill must render a non-empty SKILL.md for every renderable type into a temporary directory. Without SKILL.md, the v1.5.1 installer bundled in app 0.5.0 failed on "Update agmsg".

**File**: `app/scripts/bundle-core.sh` (modified, +79/-5)
```diff
@@ -1,8 +1,10 @@
 #!/usr/bin/env bash
-# Bundles a pinned snapshot of agmsg-core (scripts/, install.sh, uninstall.sh)
-# into src-tauri/resources/agmsg-core/ for the app's first-run auto-install
-# flow — see agmsg_install in src-tauri/src/agmsg.rs. At runtime the app runs
-# this bundled install.sh directly, with no network access.
+# Bundles a pinned snapshot of agmsg-core into src-tauri/resources/agmsg-core/
+# for the app's first-run auto-install flow — see agmsg_install in
+# src-tauri/src/agmsg.rs. At runtime the app runs this bundled install.sh
+# directly, with no network access. What goes in is exactly the set of files
+# the installer reads relative to its own directory (PACK_PATHS below); the
+# checks at the end prove that set is closed instead of trusting it.
 #
 # The ref is a committed pin (AGMSG_CORE_REF), not resolved dynamically at
 # build time — that's the point of bundling instead of curl|bash at runtime:
@@ -33,9 +35,31 @@ echo "bundle-core: fetching tag $REF..."
 # checkouts are disposable, so this is a non-issue there either way.
 git fetch origin tag "$REF" --no-tags
 
+# Everything install.sh / uninstall.sh / scripts/lib read relative to the
+# installer's own directory ($SCRIPT_DIR/...). SKILL.md is not optional: the
+# installer renders every installed skill file from it, and a pack without it
+# fails the app's "Update agmsg" with "shared SKILL.md is missing" (#1503's
+# 0.5.0 build shipped exactly that -- v1.5.1 needs it, v1.1.12 did not, so
+# nothing complained while the pin was old). plugins/README.md and openai.yaml
+# are copied with `|| true`, so leaving them out never fails -- it just makes
+# the app's install silently differ from a normal one, which is why they are
+# listed here rather than left to that fallback.
+#
+# The list is derived by grep, not by eye; the same grep runs again below
+# against the packed files and fails the build if a path it finds is absent.
+PACK_PATHS=(
+  scripts/
+  install.sh
+  uninstall.sh
+  VERSION
+  SKILL.md
+  plugins/README.md
+  openai.yaml
+)
+
 rm -rf "$DEST"
 mkdir -p "$DEST"
-git archive "$REF" -- scripts/ install.sh uninstall.sh VERSION | tar -x -C "$DEST"
+git archive "$REF" -- "${PACK_PATHS[@]}" | tar -x -C "$DEST"
 chmod +x "$DEST/install.sh" "$DEST/uninstall.sh"
 
 # Sanity check: the pin must actually satisfy what the app needs from
@@ -48,6 +72,9 @@ REQUIRED_PATHS=(
   "scripts/api.sh"
   "scripts/drivers/types/agmsg-app/type.conf"
   "VERSION"
+  "SKILL.md"
+  "plugins/README.md"
+  "openai.yaml"
 )
 for p in "${REQUIRED_PATHS[@]}"; do
   if [ ! -f "$DEST/$p" ]; then
@@ -56,4 +83,51 @@ for p in "${REQUIRED_PATHS[@]}"; do
   fi
 done
 
+# Closure check: every path the installer reads relative to its own directory
+# must be in the bundle. PACK_PATHS above was derived from this same scan on
+# v1.5.1; running it again on what was actually packed means a later pin that
+# starts reading one more file fails HERE, at build time, instead of in a
+# user's "Update agmsg". `scripts/.` (a trailing `/.` from `cp -R scripts/.`)
+# is folded to `scripts`.
+#
+# If this ever names a path that is relative to scripts/ at runtime rather
+# than to the installer (a `$SCRIPT_DIR/...` inside scripts/lib that means the
+# scripts directory), narrow the scan instead of adding the path to the pack.
+closure_missing=0
+while IFS= read -r rel; do
+  rel="${rel%/.}"
+  if [ ! -e "$DEST/$rel" ]; then
+    echo "bundle-core: the installer reads '$rel' relative to its own directory at $REF, but it is not in the bundle — add it to PACK_PATHS" >&2
+    closure_missing=1
+  fi
+done < <(grep -rhoE '\$\{?SCRIPT_DIR(:-)?\}?/[A-Za-z0-9_.][A-Za-z0-9_./-]*' \
+           "$DEST/install.sh" "$DEST/uninstall.sh" "$DEST/scripts/lib" \
+         | sed -E 's#^\$\{?SCRIPT_DIR(:-)?\}?/##' | sort -u)
+[ "$closure_missing" -eq 0 ] || exit 1
+
+# Render check: run the function that failed in the field, from the packed
+# code, once per agent type the installer can render. It reads o
```

---

### Incident Patch 3: `0aede97d` (2026-09-28)
**Commit Message**: fix(app): keep a renamed team's open tabs (#1500)

Renaming a team from the sidebar no longer hides its open tabs. After a successful rename, each open window's team and the team's last-active tab entry move to the new name immediately; the team-list refresh runs separately and reports its own failure. A rejected rename changes nothing, and renaming the selected team advances the previous-team ref first so the old name is not written back.

Follow-up to #1484.

**File**: `app/src/App.test.ts` (modified, +59/-0)
```diff
@@ -7,6 +7,8 @@ import {
   hasUnsafeDropPath,
   joinDroppedPaths,
   purgeMessagesToast,
+  renameTeamInWindows,
+  renameTeamKey,
   renameTeamToast,
   resolveFileDropTarget,
   shellPaneFrom,
@@ -361,3 +363,60 @@ describe("spawnTargetWindowId", () => {
     expect(spawnTargetWindowId(windows, "w-other-team", "alpha")).toBeUndefined();
   });
 });
+
+describe("renameTeamInWindows", () => {
+  // Regression: a tab spawned under a team stayed tagged with that team's
+  // OLD name after a rename, and the sidebar only ever renders
+  // `w.team === team` for the current (now-renamed) team — so the tab's
+  // PTY kept running but its tab vanished from the tab bar entirely.
+  const windows = [
+    { id: "w-1", team: "old-team" },
+    { id: "w-2", team: "old-team" },
+    { id: "w-3", team: "other-team" },
+  ];
+
+  it("repoints every window tagged with the old team name to the new one", () => {
+    const result = renameTeamInWindows(windows, "old-team", "new-team");
+    expect(result.filter((w) => w.team === "new-team").map((w) => w.id)).toEqual(["w-1", "w-2"]);
+  });
+
+  it("leaves windows belonging to a different team untouched", () => {
+    const result = renameTeamInWindows(windows, "old-team", "new-team");
+    expect(result.find((w) => w.id === "w-3")).toEqual({ id: "w-3", team: "other-team" });
+  });
+
+  it("is a no-op when no window belongs to the renamed team", () => {
+    expect(renameTeamInWindows(windows, "nonexistent-team", "new-team")).toEqual(windows);
+  });
+});
+
+describe("renameTeamKey", () => {
+  // lastActiveTabByTeam (the other team-keyed state a rename must follow,
+  // same regression) is a Record<string, string>, but this is generic —
+  // any future team-keyed state can reuse it.
+  it("moves the old team's entry to the new key", () => {
+    expect(renameTeamKey({ "old-team": "w-1", "other-team": "w-3" }, "old-team", "new-team")).toEqual({
+      "other-team": "w-3",
+      "new-team": "w-1",
+    });
+  });
+
+  it("is a no-op (same reference) when the old team has no entry", () => {
+    const byTeam = { "other-team": "w-3" };
+    expect(renameTeamKey(byTeam, "old-team", "new-team")).toBe(byTeam);
+  });
+
+  it("leaves only the new team's key once prevTeamRef is also updated (#1500 review, round 2)", () => {
+    // Renaming the CURRENTLY active team also triggers the team-change
+    // layout effect (setTeam(next) changes `team`), which writes
+    // lastActiveTabByTeam[prevTeamRef.current] = active on every team
+    // change — BEFORE updating prevTeamRef itself. onRenameTeam sets
+    // prevTeamRef.current = next in the same step as setTeam(next), so
+    // that write lands on the already-renamed key (idempotent) instead of
+    // resurrecting the old one this rekey just removed.
+    let byTeam = renameTeamKey({ "old-team": "w-1" }, "old-team", "new-team");
+    const prevTeamRefAfterFix = "new-team";
+    byTeam = { ...byTeam, [prevTeamRefAfterFix]: "w-1" };
+    expect(Object.keys(byTeam)).toEqual(["new-team"]);
+  });
+});
```

**File**: `app/src/App.tsx` (modified, +66/-2)
```diff
@@ -154,6 +154,36 @@ export function shellSplitStillValid(
   return windows.some((w) => w.id === windowId && w.team === requestedTeam);
 }
 
+// A window's `team` never changes after creation (see Window's own doc) —
+// EXCEPT that renaming the team itself must repoint every one of its
+// existing tabs at the new name, or the sidebar (which only ever renders
+// `w.team === team` for the CURRENT, now-renamed team) hides them: the PTYs
+// stay alive, but their tabs vanish from the tab bar with no way back to
+// them short of a restart. Pure so onRenameTeam's rekeying is
+// unit-testable without mounting the app or a real Tauri backend.
+export function renameTeamInWindows<T extends Pick<Window, "team">>(
+  windows: readonly T[],
+  oldTeam: string,
+  newTeam: string,
+): T[] {
+  return windows.map((w) => (w.team === oldTeam ? { ...w, team: newTeam } : w));
+}
+
+// Moves one team-keyed entry to its new key, leaving every other entry
+// untouched — used for lastActiveTabByTeam (below) and any other bit of
+// state keyed by team name a rename needs to follow. A no-op (same
+// reference back) when oldTeam never had an entry, so callers can apply it
+// unconditionally without a guard of their own.
+export function renameTeamKey<T>(
+  byTeam: Readonly<Record<string, T>>,
+  oldTeam: string,
+  newTeam: string,
+): Record<string, T> {
+  if (!(oldTeam in byTeam)) return byTeam;
+  const { [oldTeam]: value, ...rest } = byTeam;
+  return { ...rest, [newTeam]: value as T };
+}
+
 // C0 control characters (\u0000-\u001f) and DEL (\u007f) — legal in a
 // macOS/Linux filename, but this string is about to be written straight
 // into a PTY as literal input. A newline in a filename would submit
@@ -1851,14 +1881,48 @@ export default function App() {
     async (current: string, next: string) => {
       const { command, args } = teamActionInvocation("renameTeam", current, { nextName: next });
       await invoke(command, args);
-      await loadTeams();
-      if (team === current) setTeam(next);
+
+      // Everything from here on assumes the rename itself already
+      // succeeded — never move this above the invoke, or into a
+      // try/finally that would also run when the core refused it (#1500
+      // review, round 2). A window's `team` and lastActiveTabByTeam's keys
+      // are otherwise untouched by rename-team.sh (it only repoints the
+      // core's own records) — without this, every tab spawned under the
+      // old name stays tagged with it, and the sidebar (which only ever
+      // renders `w.team === team` for the current, now-renamed team) hides
+      // them: PTYs stay alive, tabs just vanish (found in live testing).
+      // Done before loadTeams(), not after: if that read then fails, the
+      // app must not still be pointing at a name that no longer exists on
+      // disk (a retry with the old name would fail confusingly).
+      setWindows((prev) => renameTeamInWindows(prev, current, next));
+      lastActiveTabByTeam.current = renameTeamKey(lastActiveTabByTeam.current, current, next);
+      if (team === current) {
+        // The team-change layout effect below writes
+        // lastActiveTabByTeam[prevTeamRef.current] = active on every
+        // `team` change, BEFORE updating prevTeamRef itself — if it still
+        // held the old name when setTeam(next) triggers that effect, its
+        // own write would resurrect the very key just removed above.
+        // Setting it here, in the same step as setTeam, means that write
+        // lands on the new key instead (an idempotent no-op).
+        prevTeamRef.current = next;
+        setTeam(next);
+      }
       // Guarded the same way as deleteTeam's onClose: closing the modal
       // early (while this is still in flight, #1484 review round 2) and
       // opening a different one before this resolves must not have this
       // stale completion clobber it back to null.
       setModal((cur) => (shouldClearModalOnClose(cur, "rena
```

---

### Incident Patch 4: `2e792442` (2026-09-28)
**Commit Message**: fix(app): open a clicked agent in the tab being viewed, and dim placeholder text (#1498) (#1499)

Clicking an agent in the sidebar, or "Add & spawn", now opens it in the tab being viewed (as a new rightmost column) when that tab is one of the current team's pane tabs; from the team room, a chat or another team's tab it still opens a new tab. Placeholder text is dimmed to the muted colour and the name/team-name examples carry an "e.g." prefix in all nine locales, so an example no longer reads as typed input.

Closes #1498.

**File**: `app/src/App.css` (modified, +16/-0)
```diff
@@ -18,6 +18,22 @@
   box-sizing: border-box;
 }
 
+/* Every `input`/`textarea` here sets `color: var(--fg)` explicitly (the
+   normal, readable text color), which some engines then also apply to the
+   placeholder unless it's overridden separately — a real value and the
+   example text end up the same color, so a still-empty field (e.g. the "add
+   agent" name field, its placeholder "alice") reads as already filled in.
+   `opacity: 1` is deliberate too: without it a browser's own default
+   placeholder dimming stacks with this color, landing somewhere between
+   --muted and --fg rather than reliably at --muted everywhere the app runs.
+   One rule for every input in the app, not per-field, so every placeholder
+   stays visually distinct from typed text the same way. */
+input::placeholder,
+textarea::placeholder {
+  color: var(--muted);
+  opacity: 1;
+}
+
 html,
 body,
 #root {
```

**File**: `app/src/App.test.ts` (modified, +20/-0)
```diff
@@ -15,6 +15,7 @@ import {
   shouldShowOutdatedBanner,
   shouldSuppressClickAfterDrag,
   shouldClearModalOnClose,
+  spawnTargetWindowId,
   teamActionInvocation,
   type LoginShellInfo,
 } from "./App";
@@ -341,3 +342,22 @@ describe("completion toast builders", () => {
     });
   });
 });
+
+describe("spawnTargetWindowId", () => {
+  const windows = [
+    { id: "w-mine", team: "alpha" },
+    { id: "w-other-team", team: "beta" },
+  ];
+
+  it("viewing a pane tab of the current team -> that tab", () => {
+    expect(spawnTargetWindowId(windows, "w-mine", "alpha")).toBe("w-mine");
+  });
+
+  it("viewing the team room -> a new tab (undefined)", () => {
+    expect(spawnTargetWindowId(windows, "room", "alpha")).toBeUndefined();
+  });
+
+  it("viewing a pane tab that belongs to another team -> a new tab (undefined)", () => {
+    expect(spawnTargetWindowId(windows, "w-other-team", "alpha")).toBeUndefined();
+  });
+});
```

**File**: `app/src/App.tsx` (modified, +26/-15)
```diff
@@ -211,6 +211,24 @@ export function resolveFileDropTarget(
   return activeLeaves[0] ?? null;
 }
 
+// Which tab a sidebar agent click should spawn into: the tab being viewed
+// right now, as an extra column added to its right edge (same
+// insertAsNewLeaf a spawnMember targetWindowId already does, same as the
+// right-click "Open in existing tab" path) — but ONLY when that tab is a
+// pane tab belonging to the CURRENT team. Anything else — the team room
+// (`active === "room"`, the one non-window sentinel `active` holds), a chat
+// view, or a pane tab left open under another team — opens a new tab
+// instead, same as before. Returns the targetWindowId to pass straight to
+// spawnMember (undefined = new tab).
+export function spawnTargetWindowId(
+  windows: ReadonlyArray<Pick<Window, "id" | "team">>,
+  activeWindowId: string,
+  currentTeam: string,
+): string | undefined {
+  const activeWindow = windows.find((w) => w.id === activeWindowId);
+  return activeWindow && activeWindow.team === currentTeam ? activeWindowId : undefined;
+}
+
 // The pane cell (if any) at a given viewport point — shared by the internal
 // pointer-drag hit-test and the external file-drop handler. Not unit-
 // testable in isolation (elementFromPoint needs real layout, which jsdom
@@ -1398,8 +1416,8 @@ export default function App() {
   }, [buildShellPane, team]);
 
   // A tab's "Open shell" context-menu item — splits a shell pane in beside
-  // whatever's already in that tab. The symmetric counterpart of spawning an
-  // agent beside an open shell pane (see windowHasShellPane/spawnMember
+  // whatever's already in that tab, the same way a sidebar click splits an
+  // agent into the tab being viewed (see spawnTargetWindowId/spawnMember
   // below): either direction, shell and agent end up split in the same tab.
   // Same stale-context concern as openShellTab, in two shapes: the target
   // tab can be closed while getLoginShell's await is in flight (orphaned
@@ -1421,17 +1439,6 @@ export default function App() {
     [buildShellPane, team],
   );
 
-  // True when `windowId`'s tab currently has a free-shell pane in it — the
-  // signal spawnMember's sidebar-click site uses to decide "spawn this agent
-  // beside the shell in the same tab" (design B) instead of the
-  // default "open a new tab".
-  const windowHasShellPane = useCallback((windowId: string) => {
-    const w = windowsRef.current.find((w) => w.id === windowId);
-    if (!w) return false;
-    const ids = leaves(w.root);
-    return panesRef.current.some((p) => ids.includes(p.id) && p.shell);
-  }, []);
-
   // Swap two panes' positions within the same window (tree shape unchanged
   // — no DOM remount, same as every other pane move in this file).
   const swapPanesInWindow = useCallback((windowId: string, paneA: string, paneB: string) => {
@@ -1788,7 +1795,11 @@ export default function App() {
       await invoke("agmsg_join", { team, name, agentType: type, project });
       const m = await loadMembers(team);
       const added = m.find((x) => x.name === name);
-      if (added) spawnMember(added);
+      // Same tab-choice as a sidebar click (spawnTargetWindowId): split
+      // into the tab being viewed when it's this team's, a new tab
+      // otherwise. Refs (not `windows`/`active` state) so this callback
+      // doesn't need to be recreated on every tab switch.
+      if (added) spawnMember(added, spawnTargetWindowId(windowsRef.current, activeRef.current, team));
       setModal(null);
     },
     [team, loadMembers, spawnMember],
@@ -2374,7 +2385,7 @@ export default function App() {
                       )}
                       <button
                         className="member"
-                        onClick={() => spawnMember(m, windowHasShellPane(active) ? active : undefined)}
+                        onClick={() => spawnMember(m, spawnTargetWindowId(windows, active, team))}
                         title={
                           pane
        
```

**File**: `app/src/i18n/locales/de.json` (modified, +2/-2)
```diff
@@ -116,7 +116,7 @@
       "title": "Neues Team",
       "note": "Erstellt das Team und fügt dich als App-User hinzu (Besitzer der unteren Chatbox).",
       "teamNameLabel": "Teamname",
-      "teamNamePlaceholder": "mein-team",
+      "teamNamePlaceholder": "z. B. mein-team",
       "appUserLabel": "Dein Name (App-User)",
       "create": "Erstellen"
     },
@@ -128,7 +128,7 @@
     "agent": {
       "title": "Agent hinzufügen",
       "typeLabel": "Typ",
-      "namePlaceholder": "alice",
+      "namePlaceholder": "z. B. alice",
       "addAndSpawn": "Hinzufügen & starten"
     },
     "rename": {
```

**File**: `app/src/i18n/locales/en.json` (modified, +2/-2)
```diff
@@ -126,7 +126,7 @@
       "title": "New team",
       "note": "Creates the team and adds you as its app-user (the bottom chat box owner).",
       "teamNameLabel": "Team name",
-      "teamNamePlaceholder": "my-team",
+      "teamNamePlaceholder": "e.g. my-team",
       "appUserLabel": "Your name (app-user)",
       "create": "Create"
     },
@@ -138,7 +138,7 @@
     "agent": {
       "title": "Add agent",
       "typeLabel": "Type",
-      "namePlaceholder": "alice",
+      "namePlaceholder": "e.g. alice",
       "addAndSpawn": "Add & spawn"
     },
     "rename": {
```

---

### Incident Patch 5: `7d81f43a` (2026-09-28)
**Commit Message**: fix(app): build the spawn prompt from each type's own cmd_prefix/prompt_arg (#1497)

The app now builds each agent's launch prompt from its type.conf cmd_prefix and prompt_arg, the same way the core's lib/boot-command.sh does, instead of always appending /<cmd> actas <name>. opencode and antigravity get --prompt '$agmsg actas <name>', copilot gets -i. A type that declares neither keeps the previous form.

Closes #1007. Closes #346.

**File**: `app/src-tauri/src/agmsg.rs` (modified, +15/-1)
```diff
@@ -474,6 +474,18 @@ pub struct AgentType {
     /// position `agmsg spawn` uses, so a pane spawned from the app gets the
     /// same extra flags a CLI-driven spawn would.
     pub options: Vec<String>,
+    /// This type's actas-prompt prefix (manifest `cmd_prefix=`), e.g. "$" for
+    /// opencode/codex/gemini/antigravity. None when the manifest omits it,
+    /// which means "/" — the same default scripts/lib/boot-command.sh's
+    /// agmsg_actas_prompt applies (#1007/#346: the frontend used to hardcode
+    /// "/" for every type instead of reading this).
+    pub cmd_prefix: Option<String>,
+    /// A flag whose VALUE must carry the actas prompt, for a CLI that
+    /// rejects it as a bare positional (manifest `prompt_arg=`), e.g.
+    /// opencode's `--prompt` or copilot's `--interactive`. None when the
+    /// prompt is passed positionally (claude-code). Mirrors the prompt half
+    /// of scripts/lib/boot-command.sh's agmsg_role_cli_args.
+    pub prompt_arg: Option<String>,
 }
 
 /// Read one key from a type.conf manifest (read-only key=value data, never
@@ -573,7 +585,9 @@ pub fn agmsg_spawnable_types() -> Result<Vec<AgentType>, String> {
             .unwrap_or_default();
         if !name.is_empty() {
             let options = spawn_options_tokens(&name);
-            types.push(AgentType { name, cli, options });
+            let cmd_prefix = manifest_get(&conf, "cmd_prefix");
+            let prompt_arg = manifest_get(&conf, "prompt_arg");
+            types.push(AgentType { name, cli, options, cmd_prefix, prompt_arg });
         }
     }
     types.sort_by(|a, b| a.name.cmp(&b.name));
```

**File**: `app/src/App.test.ts` (modified, +15/-0)
```diff
@@ -1,5 +1,6 @@
 import { describe, expect, it } from "vitest";
 import {
+  actasSpawnArgs,
   hasUnsafeDropPath,
   joinDroppedPaths,
   resolveFileDropTarget,
@@ -11,6 +12,20 @@ import {
   type LoginShellInfo,
 } from "./App";
 
+describe("actasSpawnArgs", () => {
+  it("claude-code: no cmd_prefix/prompt_arg -> bare '/<cmd> actas <name>' (unchanged)", () => {
+    expect(actasSpawnArgs("agmsg", "alice", null, null)).toEqual(["/agmsg actas alice"]);
+  });
+
+  it("opencode: cmd_prefix '$' and prompt_arg '--prompt' -> ['--prompt', '$<cmd> actas <name>']", () => {
+    expect(actasSpawnArgs("agmsg", "OC", "$", "--prompt")).toEqual(["--prompt", "$agmsg actas OC"]);
+  });
+
+  it("copilot: no cmd_prefix (defaults to '/') with prompt_arg '--interactive'", () => {
+    expect(actasSpawnArgs("agmsg", "X", null, "--interactive")).toEqual(["--interactive", "/agmsg actas X"]);
+  });
+});
+
 describe("shouldShowOutdatedBanner", () => {
   it("shows when outdated, not updating, and not dismissed", () => {
     expect(shouldShowOutdatedBanner({ installed: "1.1.0", pinned: "1.1.8" }, false, false)).toBe(true);
```

**File**: `app/src/App.tsx` (modified, +38/-6)
```diff
@@ -292,7 +292,34 @@ export function shouldSuppressClickAfterDrag(dragFinish: DragFinishInfo, paneId:
   return dragFinish !== null && dragFinish.paneId === paneId && now - dragFinish.finishedAt < CLICK_SUPPRESS_WINDOW_MS;
 }
 // A spawnable agent type discovered from agmsg's type registry.
-export type AgentType = { name: string; cli: string; options: string[] };
+export type AgentType = {
+  name: string;
+  cli: string;
+  options: string[];
+  cmd_prefix: string | null;
+  prompt_arg: string | null;
+};
+
+// The trailing spawn args that hand a freshly launched CLI its identity:
+// the actas prompt (`<cmd_prefix><cmdName> actas <name>`, cmd_prefix
+// defaulting to "/"), wrapped for a type that requires it as a named flag's
+// VALUE rather than a bare positional (`prompt_arg`) — e.g. opencode needs
+// `--prompt '$agmsg actas NAME'`, copilot needs `--interactive "/agmsg actas
+// NAME"`. Mirrors scripts/lib/boot-command.sh's agmsg_actas_prompt plus the
+// prompt half of agmsg_role_cli_args exactly, which spawn.sh already uses —
+// this used to hardcode "/<cmdName> actas <name>" for every type regardless
+// of its manifest, so opencode/antigravity/codex/gemini (cmd_prefix "$") and
+// copilot/opencode/antigravity (prompt_arg) all launched with the wrong
+// shape (#1007, #346).
+export function actasSpawnArgs(
+  cmdName: string,
+  name: string,
+  cmdPrefix?: string | null,
+  promptArg?: string | null,
+): string[] {
+  const prompt = `${cmdPrefix || "/"}${cmdName} actas ${name}`;
+  return promptArg ? [promptArg, prompt] : [prompt];
+}
 
 // Whether the outdated-CLI banner should render. A pure function (rather
 // than an inline JSX condition) purely so it's unit-testable — pinning down
@@ -1018,11 +1045,15 @@ export default function App() {
       const types = await invoke<AgentType[]>("agmsg_spawnable_types").catch(() => spawnTypes);
       const freshCliFor = new Map(types.map((t) => [t.name, t.cli]));
       const freshOptionsFor = new Map(types.map((t) => [t.name, t.options]));
+      const freshCmdPrefixFor = new Map(types.map((t) => [t.name, t.cmd_prefix]));
+      const freshPromptArgFor = new Map(types.map((t) => [t.name, t.prompt_arg]));
       setSpawnTypes(types);
 
       const type = m.types.find((t) => freshCliFor.has(t));
       const cli = type ? freshCliFor.get(type)! : undefined;
       const options = type ? (freshOptionsFor.get(type) ?? []) : [];
+      const cmdPrefix = type ? freshCmdPrefixFor.get(type) : undefined;
+      const promptArg = type ? freshPromptArgFor.get(type) : undefined;
       // `native` = "this (type, project) actually self-delivers agmsg
       // messages" — asked from agmsg's own delivery.sh status (mode derived
       // from the project's real hooks file), NOT a static type.conf flag.
@@ -1042,16 +1073,17 @@ export default function App() {
       }
       const id = `${m.name}-${seq.current++}`;
       // Mirror agmsg spawn.sh: launch the CLI with any per-type spawn-options
-      // flags, then `/<cmd> actas <name>` as the final arg — same relative
-      // order spawn.sh splices them in — so the agent comes up as the real
-      // member (can send as itself, and self-delivers if its type monitors).
-      // Types with no spawnable CLI fall back to a shell.
+      // flags, then the actas prompt (shaped for this type — see
+      // actasSpawnArgs) as the final arg(s) — same relative order spawn.sh
+      // splices them in — so the agent comes up as the real member (can send
+      // as itself, and self-delivers if its type monitors). Types with no
+      // spawnable CLI fall back to a shell.
       const pane: Pane = cli
         ? {
             id,
             label: m.name,
             cmd: cli,
-            args: [...options, `/${cmdName} actas ${m.name}`],
+            args: [...options, ...actasSpawnArgs(cmdName, m.name, cmdPrefix, promptArg)],
             cwd: m.project || undefined,
             native: monitors,
           }
```

---

### Incident Patch 6: `98eebb3b` (2026-09-28)
**Commit Message**: fix(app): About shows the core actually running, not the bundled ref (#1496)

About now shows the version of the installed core the app actually runs (VERSION under the agmsg base, honoring AGMSG_APP_BASE), falling back to the bundled AGMSG_CORE_REF when it cannot be read.

Closes #976.

**File**: `app/src-tauri/src/agmsg.rs` (modified, +45/-5)
```diff
@@ -698,6 +698,27 @@ pub struct CoreVersionStatus {
     outdated: bool,
 }
 
+/// The installed agmsg's own VERSION file, trimmed — None if it can't be
+/// read (not installed yet, or the file is empty). Shared by
+/// `agmsg_core_version_status` and `running_core_version` below so there is
+/// exactly one place that reads it.
+fn read_installed_core_version() -> Option<String> {
+    std::fs::read_to_string(agmsg_base().join("VERSION"))
+        .ok()
+        .map(|s| s.trim().to_string())
+        .filter(|s| !s.is_empty())
+}
+
+/// The core this app is actually driving right now (installed at
+/// `agmsg_base()`), for display -- as opposed to `pinned_core_version`, the
+/// ref this build happened to bundle at compile time. Falls back to the
+/// pinned version when the installed one can't be read, so the About line
+/// (see `make_menu` in lib.rs) always has something reasonable to show
+/// rather than going blank (#976).
+pub(crate) fn running_core_version() -> String {
+    read_installed_core_version().unwrap_or_else(pinned_core_version)
+}
+
 /// Compares the installed agmsg's VERSION file against the version bundled
 /// into this app build. An existing install doesn't go through agmsg_install
 /// (that only fires when nothing is installed at all), so an installed
@@ -708,10 +729,7 @@ pub struct CoreVersionStatus {
 #[tauri::command]
 pub fn agmsg_core_version_status() -> CoreVersionStatus {
     let pinned = pinned_core_version();
-    let installed = std::fs::read_to_string(agmsg_base().join("VERSION"))
-        .ok()
-        .map(|s| s.trim().to_string())
-        .filter(|s| !s.is_empty());
+    let installed = read_installed_core_version();
 
     let outdated = match (&installed, parse_semver(&pinned)) {
         (Some(v), Some(pinned_v)) => match parse_semver(v) {
@@ -1003,7 +1021,10 @@ pub fn start_watcher(app: AppHandle) {
 
 #[cfg(test)]
 mod tests {
-    use super::{agmsg_base, msys_to_native, parse_semver, run_script, to_bash_slashes};
+    use super::{
+        agmsg_base, msys_to_native, parse_semver, pinned_core_version, run_script,
+        running_core_version, to_bash_slashes,
+    };
     use serial_test::serial;
     use std::io::Write;
 
@@ -1181,6 +1202,25 @@ mod tests {
         assert!(agmsg_base().ends_with(".agents/skills/agmsg"));
     }
 
+    #[test]
+    #[serial]
+    fn running_core_version_reads_installed_or_falls_back_to_pinned() {
+        // Before #976, the About line always read the bundled AGMSG_CORE_REF
+        // (pinned_core_version) — the version this build happened to bundle,
+        // not the one actually driving every agmsg operation.
+        let dir = tempfile::tempdir().unwrap();
+        let _env = EnvGuard::set("AGMSG_APP_BASE", &dir.path().to_string_lossy());
+
+        // No VERSION file yet: falls back to the bundled ref rather than
+        // going blank.
+        assert_eq!(running_core_version(), pinned_core_version());
+
+        // An installed VERSION file wins over the bundled ref — the number a
+        // user would actually act on.
+        std::fs::write(dir.path().join("VERSION"), "9.9.9\n").unwrap();
+        assert_eq!(running_core_version(), "9.9.9");
+    }
+
     #[test]
     #[serial]
     #[cfg(not(target_os = "windows"))]
```

**File**: `app/src-tauri/src/lib.rs` (modified, +21/-5)
```diff
@@ -263,11 +263,27 @@ fn make_menu(app: &AppHandle, lang: &str) -> tauri::Result<(Menu<Wry>, CheckMenu
     // About-panel slots on macOS vs. a parenthetical suffix on Windows) so
     // both platforms show the exact same text verbatim: "0.1.4 (core
     // 1.1.6)". CARGO_PKG_VERSION is Cargo.toml's own version, always kept
-    // in sync with tauri.conf.json/package.json at release time; the core
-    // version is whatever AGMSG_CORE_REF this build bundled (agmsg::
-    // pinned_core_version — the same source agmsg_core_version_status's
-    // "pinned" field reads, so the two can never disagree).
-    let version = format!("{} (core {})", env!("CARGO_PKG_VERSION"), agmsg::pinned_core_version());
+    // in sync with tauri.conf.json/package.json at release time.
+    //
+    // The core number is the one actually running (agmsg::
+    // running_core_version, reading the installed VERSION under
+    // agmsg_base()) rather than AGMSG_CORE_REF, the ref this build happened
+    // to bundle -- every agmsg operation goes through the INSTALLED core, so
+    // that is the number a user would act on. Once the installed core has
+    // moved past what this build bundled, agmsg_core_version_status's
+    // outdated banner has already stopped explaining the gap (installed <
+    // pinned goes false), so the bundled ref is appended in parens instead
+    // of dropped outright -- silently identical numbers stay a single
+    // reading, and a real mismatch is still visible rather than replaced by
+    // a number the app isn't using (#976).
+    let running_core = agmsg::running_core_version();
+    let pinned_core = agmsg::pinned_core_version();
+    let core_label = if running_core == pinned_core {
+        running_core
+    } else {
+        format!("{running_core} (bundled {pinned_core})")
+    };
+    let version = format!("{} (core {})", env!("CARGO_PKG_VERSION"), core_label);
     let about = PredefinedMenuItem::about(
         app,
         Some(&m_name("about")),
```

---

### Incident Patch 7: `64ae13f0` (2026-09-27)
**Commit Message**: fix(remote-sync): name a missing age binary, and surface the last fatal on status (#1487) (#1488)

A missing age binary is now reported as that, naming AGMSG_AGE_BIN or PATH, and the seal-failure line carries the reason next to the status. The helper rows use a \x1f separator so an empty field no longer shifts the reason. remote.sh status adds the last fatal message logged since the most recent engine.start marker, folded to one line. Every engine start writes that marker, and a start that cannot write it is refused.

Closes #1487.

**File**: `scripts/drivers/storage/sqlite-sync.sh` (modified, +20/-3)
```diff
@@ -761,11 +761,23 @@ storage_sync_prepare_push() {
     # arrive in COMPLETION order (each carries its request index) and are
     # committed in groups as they land, so an interrupted run keeps every group
     # it had already committed and the next prepare re-seals only what is left.
-    while IFS=$'\t' read -r idx status blob; do
+    # \x1f (unit separator), not a tab: IFS whitespace characters (space, tab,
+    # newline) collapse RUNS of themselves into one delimiter, so a tab-joined
+    # row with an empty field next to a non-empty one -- exactly the failure
+    # row below, where blob is empty and reason is not -- loses the empty
+    # field and reads its neighbor's content into the wrong variable instead
+    # (review, #1487). \x1f collapses nothing; the reason column is sanitized
+    # of control characters below for the same reason (a literal \x1f or
+    # newline inside it would misalign or truncate this read).
+    while IFS=$'\x1f' read -r idx status blob reason; do
       case "$idx" in ''|*[!0-9]*) continue ;; esac
       [ "$idx" -lt "$prepared" ] || continue
       if [ "$status" != ok ] || [ -z "$blob" ]; then
-        printf 'agmsg: cipher helper did not seal message %s (%s)\n' "$idx" "$status" >&2
+        if [ -n "$reason" ]; then
+          printf 'agmsg: cipher helper did not seal message %s (%s: %s)\n' "$idx" "$status" "$reason" >&2
+        else
+          printf 'agmsg: cipher helper did not seal message %s (%s)\n' "$idx" "$status" >&2
+        fi
         continue
       fi
       if [ "${AGMSG_SYNC_TEST_ABORT_AFTER_SEAL:-}" = 1 ]; then
@@ -824,7 +836,12 @@ storage_sync_prepare_push() {
                  and .envelope.key_id==$key and (.envelope.blob|type)=="string"
                  and (.envelope.blob|length)>0
                then "ok" else (.state // .status // "invalid") end),
-             (.envelope.blob // "")] | @tsv')
+             (.envelope.blob // ""),
+             # Folded to one line and stripped of anything that could be
+             # mistaken for the \x1f join below: a multi-line or control-
+             # character-bearing message would otherwise truncate or misalign
+             # the bash read on the other end (#1487 review).
+             (.message // "" | gsub("[\u0000-\u001f\u007f]"; " "))] | join("\u001f")')
     # The loop body runs in THIS shell (process substitution, not a pipeline),
     # so the trailing partial chunk is still here to commit.
     if [ "$chunk_count" -gt 0 ]; then
```

**File**: `scripts/internal/sync-cipher.mjs` (modified, +2/-1)
```diff
@@ -486,7 +486,8 @@ function runAge(args, input) {
   const age = process.env.AGMSG_AGE_BIN || "age";
   const result = spawnSync(age, args, { input, maxBuffer: 4 * 1024 * 1024 });
   if (result.error?.code === "ENOENT") {
-    throw new CipherStateError("unsupported_cipher", "age executable is unavailable");
+    throw new CipherStateError("unsupported_cipher",
+      `age executable "${age}" was not found on PATH (set AGMSG_AGE_BIN to its path)`);
   }
   if (result.error) throw result.error;
   return result;
```

**File**: `scripts/remote.sh` (modified, +76/-0)
```diff
@@ -1832,6 +1832,54 @@ _remote_sync_engine_refusal_current() {
   cat "$file" 2>/dev/null || true
 }
 
+# The team's run log -- a mix of JSON `event()` lines and the plain stderr
+# text scripts like sqlite-sync.sh write to the same fd (see the engine
+# start's `>> "$logfile" 2>&1` redirection). Same directory, same derivation
+# as the pidfile/cycle-stamp/refusal files above.
+_remote_sync_engine_log() { printf '%s' "$CONNECTION_ROOT/run/remote-sync.$1.log"; }
+
+# The `message` of the LAST `fatal` event since the CURRENT run started, or
+# nothing. `event()` writes one `fatal` line whenever the engine's main loop
+# throws uncaught (remote-sync.mjs's top-level catch) -- a LOCAL failure (e.g.
+# a missing `age` binary) as much as a server-side one, unlike
+# `_remote_sync_engine_refusal` above, which only ever holds a 4xx the server
+# sent. `status` never surfaced this: an engine that died at its first push
+# read as merely "stale", with the reason sitting unread in the log (#1487).
+#
+# Scoped to the current run, not the whole log: the log is append-only across
+# restarts (`>> "$logfile"` at every start), so a run that failed once, was
+# restarted, and has since stopped normally must not have that old fatal
+# reported as why it is stopped NOW (review). `_remote_sync_engine_start_locked`
+# writes an `engine.start` line as the very first thing every start does,
+# before the engine process even exists -- NOT `capabilities`, which only
+# appears once a run has reached the server and so never appears at all for a
+# run killed before that (a SIGTERM during startup; review round 2). A
+# `fatal` only counts while no LATER `engine.start` line has appeared since
+# it; awk resets the captured fatal every time it passes one.
+#
+# Matching on the literal `"event":"fatal"`/`"event":"engine.start"`
+# substrings is enough to tell these apart from the plain-text stderr lines
+# also written to this fd (see `_remote_sync_engine_log` above) -- none of
+# those ever contain either exact substring.
+_remote_last_fatal_message() {
+  local team="$1" log line escaped
+  log="$(_remote_sync_engine_log "$team")"
+  [ -f "$log" ] || return 0
+  line="$(awk '
+    /"event":"engine\.start"/ { fatal = "" }
+    /"event":"fatal"/ { fatal = $0 }
+    END { print fatal }
+  ' "$log" 2>/dev/null)"
+  [ -n "$line" ] || return 0
+  escaped=$(printf '%s' "$line" | sed "s/'/''/g")
+  # Folded to one line: the caller prints this as a single status row, and an
+  # error message carrying a literal newline or other control character (a
+  # stack-trace-shaped message, say) would otherwise break that (review,
+  # #1487).
+  agmsg_sqlite_mem "SELECT json_extract('$escaped', '\$.message');" 2>/dev/null \
+    | tr '\n\r\t\v\f' '     '
+}
+
 # _remote_holds_current_key <team> -> 0 when this machine holds the identity
 # for the team's CURRENT epoch, 1 otherwise.
 #
@@ -2070,6 +2118,25 @@ _remote_sync_engine_start_locked() {
       "its pidfile could not be written"
     return 1
   fi
+  # An unconditional start marker, written by THIS process before the engine
+  # exists at all -- unlike `capabilities`, which only appears once the engine
+  # has reached the server, and so never appears at all for a run killed
+  # before that (a SIGTERM during startup, review round on #1487).
+  # `_remote_last_fatal_message` scopes a fatal to the run that logged it by
+  # this line, not by `capabilities`, precisely so every run has a boundary to
+  # scope to, whatever happens to it after this line is written.
+  #
+  # Checked, not fired-and-forgotten: the caller is `_remote_sync_engine_start`
+  # via `_remote_sync_engine_start_locked "$@" || rc=$?`, which suspends `set
+  # -e` for this whole function, so a failed write here would otherwise go
+  # unnoticed and this proceeds to spawn the engine with no marker at all --
+  # exactly the unguarded gap this line exists to close (review round 3).
+  if ! printf '{"at":"%s","event":"engine.start","startup_nonce":"%
```

**File**: `tests/sync_cipher.test.mjs` (modified, +25/-0)
```diff
@@ -107,6 +107,31 @@ test("none and age-v1 profiles share one seal/open registry", async () => {
   }
 });
 
+test("a missing age binary is reported as missing, not as an unsupported cipher", () => {
+  // Before #1487 this threw "age executable is unavailable" -- true, but
+  // reading as "this cipher is not supported", and silent about where `age`
+  // was even looked for.
+  const base = {
+    type: "sync_seal", envelope_v: 1, cipher: "age-v1", key_id: manifest.binding.key_id,
+    max_blob_bytes: 1_048_576, wire_id: manifest.binding.wire_id,
+    team_id: manifest.binding.team_id, protocol_version: 1,
+    projection: manifest.canonical_message,
+    recipients: [manifest.recipient_sets.team_a.recipient],
+  };
+  const originalAgeBin = process.env.AGMSG_AGE_BIN;
+  const missing = "/nonexistent/agmsg-test-age-binary";
+  try {
+    process.env.AGMSG_AGE_BIN = missing;
+    assert.throws(() => sealEnvelope(base), (error) =>
+      error.state === "unsupported_cipher" &&
+      error.message.includes(missing) &&
+      /PATH|AGMSG_AGE_BIN/u.test(error.message));
+  } finally {
+    if (originalAgeBin === undefined) delete process.env.AGMSG_AGE_BIN;
+    else process.env.AGMSG_AGE_BIN = originalAgeBin;
+  }
+});
+
 test("legacy messages remain discriminator-free while roster mutations use kind", async () => {
   const base = {
     type: "sync_seal",
```

**File**: `tests/test_remote_refusal.bats` (modified, +48/-0)
```diff
@@ -168,3 +168,51 @@ write_cycle_stamp() {
   run bash "$SCRIPTS/remote.sh" status testteam
   printf '%s' "$output" | grep -q 'refused: the server answered 402'
 }
+
+# What the engine writes to the run log when its main loop throws uncaught
+# (remote-sync.mjs's `event("fatal", ...)`) -- a LOCAL failure (a missing
+# `age` binary, say) as much as a server-side one, unlike write_refusal above
+# which only ever models a 4xx the server sent. Written here rather than by
+# running the engine, for the same reason write_refusal is: this is about what
+# READS it (#1487).
+write_fatal() {
+  printf '{"at":"2026-08-14T00:00:00Z","event":"fatal","message":"%s"}\n' "$1" \
+    >> "$TEST_SKILL_DIR/run/remote-sync.testteam.log"
+}
+
+@test "status names the engine's own last fatal reason while it is not running" {
+  # Before #1487, an engine that died at its first push (e.g. a missing `age`)
+  # read as merely "engine stopped" -- true, but silent about why, with the
+  # reason sitting unread in this same log.
+  write_fatal 'age executable not found on PATH'
+  run bash "$SCRIPTS/remote.sh" status testteam
+  [ "$status" -eq 0 ]
+  printf '%s' "$output" | grep -q 'engine stopped'
+  printf '%s' "$output" | grep -q 'last fatal: age executable not found on PATH'
+}
+
+# What `_remote_sync_engine_start_locked` writes as the very first thing
+# every start does, before the engine process even exists -- unlike
+# `capabilities`, which only appears once a run has reached the server, and
+# so never appears at all for a run killed before that (review round 2).
+write_engine_start() {
+  printf '{"at":"2026-08-14T00:05:00Z","event":"engine.start","startup_nonce":"test-nonce"}\n' \
+    >> "$TEST_SKILL_DIR/run/remote-sync.testteam.log"
+}
+
+@test "an old fatal from before the engine restarted is not reported as current" {
+  # This team failed once (write_fatal), was restarted (write_engine_start --
+  # the log is append-only across restarts, `>> "$logfile"` at every start),
+  # and that later run stopped normally -- WITHOUT ever writing `capabilities`
+  # or a `fatal` of its own (e.g. a plain SIGTERM during startup, before it
+  # reached the server). The FIRST run's fatal must not be attributed to why
+  # the team is stopped now, and `engine.start` is the boundary this survives
+  # on even though this later run logged nothing else at all (#1487 review
+  # round 2 -- `capabilities` alone left exactly this case unguarded).
+  write_fatal 'age executable not found on PATH'
+  write_engine_start
+  run bash "$SCRIPTS/remote.sh" status testteam
+  [ "$status" -eq 0 ]
+  printf '%s' "$output" | grep -q 'engine stopped'
+  refute grep -q 'last fatal' <<<"$output"
+}
```

---

### Incident Patch 8: `85800597` (2026-09-27)
**Commit Message**: fix(terminal-registry): let a live seat take a pane a dead session's record still claims (#1485) (#1486)

The #1114 placement guard no longer lets a dead session's record hold a pane forever. When the claiming member's last session is not in the pane and the calling seat's session is, the caller takes the pane, and only the old record's named_ref is dropped. When this cannot be decided, including a legacy suffix that is ambiguous under #1023, the guard refuses as before.

Closes #1485. Closes #1457.

**File**: `scripts/drivers/terminals/herdr/ops.sh` (modified, +21/-0)
```diff
@@ -228,6 +228,27 @@ _herdr_pane_for_session() {
   return 2   # no candidate array path (unknown schema) -> could not answer
 }
 
+# terminal_session_live <sid> -- is <sid> among the LIVE agents right now, and
+# where (#1485)? Unlike terminal_detect, this never reads this process's OWN
+# environment: a caller asking about an ARBITRARY session (a stale placement
+# record's claimant, not itself) must not get this process's own pane back
+# just because it happens to be running under herdr too. It is the direct,
+# unconditional round trip _herdr_pane_for_session already makes; terminal_detect
+# only reaches that round trip when the environment has no pane id of its own.
+#
+# Prints "live\t<bare-pane-id>" (rc 0) when <sid> is a live agent right now,
+# "dead" (rc 0) when herdr answered and <sid> is not among them, or "unknown"
+# (rc 1) when it could not be asked at all (no sid, herdr absent/errored) --
+# the caller's existing fail-closed answer for everything it cannot decide.
+terminal_session_live() {   # <sid>
+  local sid="$1" pane hrc=0
+  [ -n "$sid" ] || { echo unknown; return 1; }
+  pane="$(_herdr_pane_for_session "$sid")" || hrc=$?
+  [ "$hrc" -eq 0 ] || { echo unknown; return 1; }
+  if [ -n "$pane" ]; then printf 'live\t%s\n' "$pane"; else echo dead; fi
+  return 0
+}
+
 # record op: we are under herdr iff HERDR_ENV=1. Resolve THIS pane from the
 # environment first: herdr sets HERDR_PANE_ID in every pane's process tree, and
 # it is the pane the process is actually in -- MEASURED 2026-09-08 on the live
```

**File**: `scripts/lib/role-session.sh` (modified, +25/-0)
```diff
@@ -225,6 +225,31 @@ agmsg_role_session_mark_named() {
   return 0
 }
 
+# Drop the naming mark without touching any other field (#1485): a pane taken
+# over from a dead session's record must stop asserting that OLD (team, agent)
+# still holds it, while the role itself (every other line in the file) stays
+# registered exactly as it was. No-op, successfully, when there is no record or
+# no mark -- this is cleanup, never something a caller needs to react to.
+#
+# BY PATH, unlike every other public function here: the one caller (the
+# placement guard's dead-claimant takeover) finds the record from a spawn
+# record's file NAME, and #1114's own comment already covers why team/agent
+# cannot be decoded back out of that name ("__" is legal inside a name). This
+# takes the same role-session PATH the guard already computed by substituting
+# "spawn." for "role-session." in that file name, rather than asking every
+# caller to re-derive team/agent just to hand them back in for re-encoding.
+agmsg_role_session_clear_named_at() {   # <role-session-record-path>
+  local path="$1" dir tmp line
+  [ -n "$path" ] && [ -f "$path" ] || return 0
+  dir="$(_actas_lock_dir)"
+  tmp="$(mktemp "$dir/.role-session.XXXXXX" 2>/dev/null)" || return 0
+  while IFS= read -r line || [ -n "$line" ]; do
+    case "$line" in named_ref=*|named_epoch=*|named_at=*) ;; *) printf '%s\n' "$line" ;; esac
+  done < "$path" > "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null; return 0; }
+  mv -f "$tmp" "$path" 2>/dev/null || rm -f "$tmp" 2>/dev/null
+  return 0
+}
+
 # The mark as "<ref>\t<epoch>", or empty when there is none. Two reads of one
 # small file, no process; this is the common-case cost of "am I named?"
 # (measured 0.22 ms), which is what lets a seat ask on every action.
```

**File**: `scripts/lib/terminal-registry.sh` (modified, +159/-10)
```diff
@@ -941,6 +941,106 @@ _agmsg_placement_claimed_by() {
   return 0
 }
 
+# <ref> -> the BARE pane id (no socket/instance prefix), via
+# _agmsg_placement_split followed by the driver's own id splitter. Not just
+# _AGMSG_PS_ID: for a driver that folds the socket INTO the id rather than
+# carrying it separately in _AGMSG_PS_SOCK (herdr does, so two panes on
+# different servers are not confused by a bare pane id alone -- #1051), that
+# field IS the qualified form, and terminal_session_live answers with the
+# driver's bare pane_id -- comparing the two directly always mismatches.
+# Empty (rc 1) when the ref cannot be parsed at either layer.
+_agmsg_placement_bare_pane_id() {   # <ref>
+  local ref="$1" halves
+  _agmsg_placement_split "$ref" || return 1
+  halves="$(_agmsg_terminal_id_split "$_AGMSG_PS_TERM" "$_AGMSG_PS_ID" 2>/dev/null)" || return 1
+  printf '%s' "${halves#*$'\t'}"
+}
+
+# <rival-spawn-record-path> <this-seat's-own-claim-ref>
+#   Is the session that record's role-session file names as its `session=`
+#   the one actually sitting in the CLAIMED pane right now (#1485)? The pane
+#   is the caller's own resolved ref (agmsg_terminal_ref's output, e.g.
+#   "herdr:<socket>:<pane>") -- both sides of the comparison are normalized to
+#   the same BARE pane id via _agmsg_placement_bare_pane_id, rather than
+#   comparing a socket-qualified ref against terminal_session_live's bare
+#   answer directly (which never matches for herdr -- see that function).
+#
+#   Prints "here" (still genuinely claimed -- refuse as before), "not_here"
+#   (confirmed dead, or confirmed alive somewhere else -- the claim is stale),
+#   or "unknown" (cannot tell). "unknown" is the answer every caller already
+#   treated as a claim before this function existed, so nothing here may ever
+#   turn "unknown" into anything but "still refuse".
+#
+# The record's session id comes from role-session.sh's file for the SAME
+# (team, agent) -- found by substituting "spawn." for "role-session." in the
+# spawn path, never by decoding team/agent out of it. _agmsg_placement_claimed_by's
+# own comment above already covers why: "__" is legal inside a name, so a name
+# cannot be split out of the encoded file name. Both families are written by
+# the same encoder into the same directory (role-session.sh's own header
+# comment), so the substitution lands on the record for every claim this can
+# still help with: a legacy/name-keyed one whose suffix is also PROVABLY one
+# pair's alone (see the "__" collision check below, #1023/#1482) -- a
+# colliding suffix reads as "unknown" too, exactly as an id-keyed one does. An
+# id-keyed spawn record (#1240) has no same-named role-session file --
+# role-session.sh only ever encodes names, never ids -- so this reads empty
+# there and answers "unknown", exactly today's behavior for that case;
+# teaching role-session.sh to read id-keyed pairs is #1457 item 1, a separate,
+# larger change.
+#
+# Liveness itself is asked of the terminal driver already loaded for THIS
+# seat's own pane (terminal_session_live, herdr only for now -- #1485's own
+# reproduction is herdr-specific, and so is every existing mechanism this
+# reuses rather than inventing a new one; a driver without the op answers
+# "unknown" via the declare -F check below, so a non-herdr pane refuses
+# exactly as it always has). Single-server only:
+# like the rest of this file's herdr ops, it asks whichever socket this
+# process's own herdr CLI resolves to, and does not attempt to prove the
+# claim's socket is the same server (#1051's cross-server pane-id collision
+# risk, not newly introduced here, just not newly closed either).
+_agmsg_placement_claimant_here_now() {   # <rival-spawn-record-path> <claim-ref>
+  local spawn_path="$1" claim_ref="$2" want_id dir suffix role_path claimant_sid
+  local live_out live_pane
+  want_id="$(_agmsg_placement_bare_pane_id "$claim_ref")" || { echo unknown; return 0; }
+  dir="${spawn_path%/*}"; suffix="${spaw
```

**File**: `tests/test_terminal_registry.bats` (modified, +80/-0)
```diff
@@ -203,6 +203,23 @@ _fake_herdr_list_scalar_session() {
   printf '#!/usr/bin/env bash\n[ "$1" = agent ] && [ "$2" = list ] && { echo '\''{"id":"1","result":{"type":"list","agents":[{"agent_session":"%s","pane_id":"wC:p4"}]}}'\''; exit 0; }\nexit 0\n' "$sid" > "$FAKEBIN/herdr"
   chmod +x "$FAKEBIN/herdr"; export PATH="$FAKEBIN:$PATH"
 }
+# A herdr whose `agent list` has TWO well-formed entries (#1485): lets a test
+# put two DIFFERENT sessions on the map at once, each at its own pane, so a
+# claimant's session can be shown live at ONE specific pane while a different
+# seat's own session is live at another (or the same). Pass "" as a sid to
+# omit that entry entirely (session not among the live agents at all).
+_fake_herdr_list_two_sessions() {   # <sid1> <pane1> <sid2> <pane2>
+  local sid1="$1" pane1="$2" sid2="$3" pane2="$4" entries="" sep=""
+  if [ -n "$sid1" ]; then
+    entries="{\"agent\":\"a\",\"agent_session\":{\"agent\":\"a\",\"kind\":\"id\",\"source\":\"herdr:a\",\"value\":\"$sid1\"},\"pane_id\":\"$pane1\"}"
+    sep=","
+  fi
+  if [ -n "$sid2" ]; then
+    entries="$entries$sep{\"agent\":\"b\",\"agent_session\":{\"agent\":\"b\",\"kind\":\"id\",\"source\":\"herdr:b\",\"value\":\"$sid2\"},\"pane_id\":\"$pane2\"}"
+  fi
+  printf '#!/usr/bin/env bash\n[ "$1" = agent ] && [ "$2" = list ] && { echo '\''{"id":"1","result":{"type":"list","agents":[%s]}}'\''; exit 0; }\nexit 0\n' "$entries" > "$FAKEBIN/herdr"
+  chmod +x "$FAKEBIN/herdr"; export PATH="$FAKEBIN:$PATH"
+}
 
 # A fake `orca` that logs argv and returns canned JSON for `terminal show` and
 # `terminal read`, shaped like the real 1.4.206 responses measured directly
@@ -3712,6 +3729,69 @@ _tmux_op_args() {
   refute grep -q 'remove run/spawn' <<<"$output"
 }
 
+@test "placement guard: a claimant whose session is confirmed gone lets a live seat take the pane; a claimant still there still refuses (#1485)" {
+  # elder's Codex session ended; resumer's fresh session now sits in the same
+  # herdr pane. elder's spawn record still claims it (first-writer-wins,
+  # #1114), but elder's own role-session record names the session that used
+  # to hold it.
+  export HERDR_ENV=1 HERDR_PANE_ID='wC:p4'
+  unset TMUX TMUX_PANE
+  export AGMSG_TERMINAL_DRIVER=herdr
+  source "$SKILL_DIR/scripts/lib/actas-lock.sh"
+  source "$SKILL_DIR/scripts/lib/role-session.sh"
+
+  local rival; rival="$(agmsg_spawn_path seatteam elder)"
+  mkdir -p "$(dirname "$rival")"
+  printf 'herdr:%s:wC:p4\t/proj/OLD\tcodex\n' "$HERDR_SOCKET_PATH" > "$rival"
+  agmsg_role_session_record seatteam elder old-sid /proj/OLD codex
+  agmsg_role_session_mark_named seatteam elder "herdr:$HERDR_SOCKET_PATH:wC:p4" 1
+
+  local mine; mine="$(agmsg_spawn_path seatteam resumer)"
+
+  # CONTROL: elder's session is confirmed STILL live in this exact pane ->
+  # refuse, exactly as before this existed. named_ref is untouched.
+  _fake_herdr_list_two_sessions old-sid wC:p4 my-sid wC:p4
+  run agmsg_terminal_name_self "my-sid" seatteam resumer /proj/MINE codex record
+  [ "$status" -eq 0 ]
+  grep -q "recorded as seatteam__elder's" <<<"$output"
+  refute test -e "$mine"
+  [ "$(agmsg_role_session_named seatteam elder)" = "$(printf 'herdr:%s:wC:p4\t1' "$HERDR_SOCKET_PATH")" ]
+
+  # TAKEOVER: elder's session is gone (not among the live agents at all); this
+  # seat's OWN session is confirmed live in the disputed pane -> take it over,
+  # and drop elder's now-unbacked naming mark. elder's OTHER fields (its own
+  # registration) are untouched.
+  _fake_herdr_list_two_sessions "" "" my-sid wC:p4
+  run agmsg_terminal_name_self "my-sid" seatteam resumer /proj/MINE codex record
+  [ "$status" -eq 0 ]
+  refute grep -q 'did not name or record' <<<"$output"
+  grep -q "^herdr:$HERDR_SOCKET_PATH:wC:p4	/proj/MINE	codex" "$mine"
+  [ -z "$(agmsg_role_session_named seatteam elder)" ]
+  [ "$(agmsg_role_session_get seatteam elder session)" = old-sid ]
+
+  # COLLIDING PAIR (#1023/#1482 review): team "a__b" agent "c" and te
```

---

### Incident Patch 9: `f5a72deb` (2026-09-26)
**Commit Message**: fix(app): bound the sidebar's team list so it scrolls instead of overflowing (#1478) (#1481)

The team list gets a bounded height (35vh) with its own vertical scroll, so a long list no longer pushes the AGENTS section out of the window or turns the sidebar into a page-level scroll. The sidebar keeps min-height: 0 and does not clip, so the collapsed rail popups still render outside it. The active team is scrolled into view when the team changes or the sidebar is collapsed or expanded.

Closes #1478.

**File**: `app/src/App.css` (modified, +21/-0)
```diff
@@ -491,6 +491,18 @@ body.resizing-row {
   background: var(--panel);
   display: flex;
   flex-direction: column;
+  /* Without this, a flex column child (like .team-status-rail before its own
+     bound) that wants more height than available makes THIS refuse to
+     shrink below its content, growing past .body's height and turning into
+     a page-level scroll instead of staying inside the window (#1478).
+     Deliberately NOT overflow:hidden here (tried, reverted): the collapsed
+     rail's popups (.new-menu.rail-popup, .ctx-menu.rail-popup) are
+     position:absolute; left:100% children that escape this box on purpose,
+     and clipping at this level cuts them off. The overflow that actually
+     needed containing is .team-status-rail's own (bounded below) and
+     .members' (already flex:1 + overflow-y:auto) — .sidebar itself no
+     longer has anything unbounded left to clip once those two are capped. */
+  min-height: 0;
 }
 /* Collapsed to an icon-only rail (issue #317 backlog) so panes get
    more width; a fixed width overrides the draggable one from full size.
@@ -635,12 +647,21 @@ body.resizing-row {
 .sidebar-head select {
   width: 100%;
 }
+/* Bounded so a long team list scrolls within itself instead of pushing the
+   AGENTS section (and everything below it) out of the window — the same
+   rule covers the collapsed rail's icon-only list too, since it reuses this
+   class (see .collapsed-team-status below, applied together on one
+   element). overflow other than visible also drops the flex item's implicit
+   min-height:auto floor, so this can shrink below its own content height in
+   a short window instead of refusing to and forcing a page-level scroll. */
 .team-status-rail {
   display: flex;
   flex-direction: column;
   gap: 3px;
   border-bottom: 1px solid var(--border);
   padding: 3px 6px;
+  max-height: 35vh;
+  overflow-y: auto;
 }
 .team-status-row {
   display: flex;
```

**File**: `app/src/App.tsx` (modified, +15/-0)
```diff
@@ -854,6 +854,21 @@ export default function App() {
     if (team) localStorage.setItem(LAST_TEAM_KEY, team);
   }, [team]);
 
+  // Keep the active team visible in the (now internally-scrolling, #1478)
+  // team list — switching via the rail popup or a restored last-team can
+  // land on a row currently scrolled out of view. Only one .team-status-row
+  // is ever active at a time (collapsed and expanded rails aren't both in
+  // the DOM together), so a single querySelector is unambiguous.
+  // sidebarCollapsed is also a dep: toggling collapsed/expanded swaps in a
+  // DIFFERENT .team-status-rail (a fresh, unscrolled one) without `team`
+  // changing at all, and that one needs the same treatment.
+  useEffect(() => {
+    if (!team) return;
+    document
+      .querySelector(".team-status-rail .team-status-row.active")
+      ?.scrollIntoView({ block: "nearest" });
+  }, [team, sidebarCollapsed]);
+
   // On team change: load members + the most recent history page. Prompt to
   // add an app-user if missing.
   useEffect(() => {
```

---

### Incident Patch 10: `3cfc72e7` (2026-09-25)
**Commit Message**: fix(self-fix): re-bind a codex seat stranded on its pre-/clear thread (#1470)

After /clear a Codex seat runs in a new thread (CODEX_THREAD_ID), but
its role-session record and its bridge stayed on the old thread, so
messages were handled off screen, and fix.sh reported
no_seat_for_this_session because the actas lock still belonged to the
pre-/clear session.

fix.sh now re-binds such a seat when it can prove it: CODEX_THREAD_ID
is set, exactly one registered codex seat of this project is proved in
the current pane, and its record is for this project but a different
thread. It hands the actas lock over only from the same live process,
by writing the new owner beside the lock and renaming it into place
(the path is never empty), then runs codex-record-session.sh and
session-start.sh as a hand repair would. Success is judged from the
result, not exit codes: the role record, and the thread file of every
live bridge key this seat can have (the launcher's per-role key and the
direct path's safe-set key, now computed by one shared
agmsg_codex_bridge_key), must name the current thread. Anything short
of that reports state=partial with what is stale, and running fix again
continues from the

**File**: `scripts/drivers/types/codex/_bridge-key.sh` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+#!/usr/bin/env bash
+# _bridge-key.sh — the one place bridge_key is derived (#1470 review round 5).
+#
+# Both the direct session-start.sh path and the out-of-sandbox launcher
+# independently filtered PAIRS down to the "safe" set (every registered
+# codex pair for the project whose OWN role-session record names this same
+# project and thread -- a role with no matching record has no live TUI to
+# receive turns, so it is excluded) and then derived bridge_key from it:
+# team.agent for exactly one safe pair, a sha1 of the whole set otherwise.
+# Two copies of that derivation is how a reader (self-fix.sh's own state
+# check) ends up looking at a DIFFERENT key than the one a writer used the
+# moment a project has more than one registered codex seat -- the writer's
+# safe set can collapse to one pair while the reader, counting every
+# registered pair instead of filtering them, hashes a different set
+# entirely. This file is the single function every caller uses instead.
+#
+# Required caller-set variable: SKILL_DIR.
+# Requires role-session.sh, resolve-project.sh and hash.sh already sourced
+# (agmsg_role_session_uuid/_get, agmsg_canonical_path, agmsg_sha1).
+
+[ -n "${_AGMSG_CODEX_BRIDGE_KEY_SH:-}" ] && return 0
+_AGMSG_CODEX_BRIDGE_KEY_SH=1
+
+: "${SKILL_DIR:?_bridge-key.sh requires SKILL_DIR}"
+
+# Prints the bridge_key this (project, thread) combination uses; empty
+# (rc 0, no output) when no registered codex pair is safe for it -- that is
+# "no bridge_key to check", never a key of its own.
+agmsg_codex_bridge_key() {   # <project> <thread_id>
+  local project="$1" thread_id="$2" project_phys pairs
+  local candidate_team candidate_name candidate_thread candidate_project candidate_project_phys
+  local safe_pairs="" pair_n key_team key_name
+  [ -n "$thread_id" ] || return 0
+  project_phys="$(agmsg_canonical_path "$project" 2>/dev/null || printf '%s' "$project")"
+  pairs="$("$SKILL_DIR/scripts/identities.sh" "$project" codex 2>/dev/null || true)"
+  while IFS=$'\t' read -r candidate_team candidate_name; do
+    [ -n "$candidate_team" ] || continue
+    candidate_thread="$(agmsg_role_session_uuid "$candidate_team" "$candidate_name" 2>/dev/null || true)"
+    [ -n "$candidate_thread" ] || continue
+    candidate_project="$(agmsg_role_session_get "$candidate_team" "$candidate_name" project 2>/dev/null || true)"
+    candidate_project_phys="$(agmsg_canonical_path "$candidate_project" 2>/dev/null || printf '%s' "$candidate_project")"
+    { [ "$candidate_project_phys" = "$project_phys" ] && [ "$candidate_thread" = "$thread_id" ]; } || continue
+    safe_pairs="${safe_pairs:+$safe_pairs$'\n'}${candidate_team}"$'\t'"${candidate_name}"
+  done <<< "$pairs"
+  [ -n "$safe_pairs" ] || return 0
+  pair_n="$(printf '%s\n' "$safe_pairs" | grep -c . || true)"
+  if [ "${pair_n:-0}" -eq 1 ]; then
+    IFS=$'\t' read -r key_team key_name <<<"$safe_pairs"
+    printf '%s.%s' "$key_team" "$key_name"
+  else
+    printf '%s' "$(printf '%s' "$safe_pairs" | agmsg_sha1)"
+  fi
+}
```

**File**: `scripts/drivers/types/codex/_session-start.sh` (modified, +30/-7)
```diff
@@ -206,25 +206,47 @@ EOF
   [ -n "$app_server" ] || exit 0
 
   mkdir -p "$RUN_DIR" 2>/dev/null || true
-  if [ "$pair_count" = "1" ]; then
-    IFS=$'\t' read -r key_team key_name <<EOF
-$PAIRS
-EOF
-    bridge_key="$key_team.$key_name"
-  else
-    bridge_key=$(printf '%s' "$PAIRS" | agmsg_sha1)
+  # #1470 review round 5: derived through the one shared function
+  # (agmsg_codex_bridge_key), not recomputed here from $PAIRS/$pair_count --
+  # self-fix.sh's own state check calls the SAME function for the SAME
+  # (project, thread_id), so the two can never land on different keys the
+  # way two independent re-derivations of "the safe set" eventually would.
+  if ! declare -F agmsg_codex_bridge_key >/dev/null 2>&1; then
+    # shellcheck disable=SC1091
+    . "$SKILL_DIR/scripts/drivers/types/codex/_bridge-key.sh"
   fi
+  bridge_key="$(agmsg_codex_bridge_key "$PROJECT" "$thread_id")"
+  [ -n "$bridge_key" ] || exit 0
   bridge_pairs=()
   while IFS=$'\t' read -r candidate_team candidate_name; do
     bridge_pairs+=(--pair "$candidate_team"$'\t'"$candidate_name")
   done <<< "$PAIRS"
   pidfile="$RUN_DIR/codex-bridge.$bridge_key.pid"
+  # Same name the out-of-sandbox launcher uses for its own per-bridge thread
+  # record (codex-bridge-launcher.sh's thread_file) -- not shared machinery,
+  # just the same convention, so a reader who knows one knows the other, and
+  # so self-fix.sh's own state check (#1470 review) can read the truth for
+  # either architecture from one place.
+  #
+  # A live pidfile here is left ALONE even when its bound thread is stale
+  # (#1470 review round 4): "alive" only proves a pid is running, never that
+  # it is THIS bridge -- a reused pid could belong to something else
+  # entirely -- and this path, unlike the launcher, has no lease/start-token
+  # reaper to prove the old writer is actually gone before a replacement is
+  # spawned beside it (#935's hazard). Production arms the launcher
+  # (codex-monitor.sh sets AGMSG_CODEX_BRIDGE_LAUNCHER=1), which DOES have
+  # that reaper and already self-heals a thread change on its own polling
+  # cadence; this direct path's job is only to stand down safely, not to
+  # retry. self-fix.sh reads the stale thread_file it leaves behind and
+  # reports the seat as needing another pass, rather than this hook
+  # guessing at a repair it cannot safely make.
   if [ -f "$pidfile" ]; then
     bridge_pid=$(cat "$pidfile" 2>/dev/null || true)
     if [ -n "$bridge_pid" ] && _agmsg_pid_alive "$bridge_pid"; then
       exit 0
     fi
   fi
+  thread_file="$RUN_DIR/codex-bridge.$bridge_key.thread"
 
   log="$RUN_DIR/codex-bridge.$bridge_key.log"
   # An explicit AGMSG_CODEX_BRIDGE_CMD is a complete runnable (tests, custom
@@ -266,5 +288,6 @@ EOF
       --inline-inbox \
       >>"$log" 2>&1 3>&- 4>&- &
   )
+  printf '%s' "$thread_id" > "$thread_file" 2>/dev/null || true
   exit 0
 }
```

**File**: `scripts/lib/actas-lock.sh` (modified, +95/-0)
```diff
@@ -686,6 +686,101 @@ agmsg_lock_claim_at() {   # <lock-path> <owner>
   return 1
 }
 
+# A narrow same-process handoff (#1468). codex's `/clear` mints a new thread
+# id inside the SAME os process, so the current holder's embedded pid stays
+# genuinely alive -- the ordinary reclaim path above (positively-dead only)
+# correctly refuses to touch it, and that refusal must not be weakened. This
+# is the one case that IS still safe to move a lock without the owner ever
+# having died: a NEW owner token whose embedded pid -- derived the identical
+# way every owner token is, via agmsg_instance_id's ancestor walk -- equals
+# the CURRENT holder's embedded pid. Nothing else may pass this check: a
+# different live pid holding the role legitimately keeps it, and an
+# unreadable or empty lock is left for the normal claim path to name.
+#
+# Same vocabulary and exit codes as actas_lock_claim: "ok" (0, moved or
+# already ours), "held:<owner>" / "unknown:<reason>" (1, untouched).
+actas_lock_reclaim_same_process() {   # <team> <agent> <new-owner>
+  local team="$1" agent="$2" new_owner="$3" lock_path new_pid
+  lock_path="$(actas_lock_path "$team" "$agent")" || { echo "unknown:lock_ambiguous"; return 1; }
+  new_pid="${new_owner##*.}"
+  [ "$new_pid" != "$new_owner" ] || { echo "unknown:owner_not_composite"; return 1; }
+  case "$new_pid" in ''|*[!0-9]*) echo "unknown:owner_pid_invalid"; return 1 ;; esac
+
+  local mutex mres
+  mutex="$(_agmsg_lock_mutex_path "$lock_path")"
+  mres="$(_agmsg_lock_mutex_take "$mutex" "$new_owner")"
+  case "$mres" in
+    ok) ;;
+    held:*)    printf 'unknown:reclaim_contended\n'; return 1 ;;
+    unknown:*) printf 'unknown:reclaim_mutex:%s\n' "${mres#unknown:}"; return 1 ;;
+    *)         printf 'unknown:reclaim_mutex_unclassified\n'; return 1 ;;
+  esac
+
+  # REPLACES, so it needs the same three facts the ordinary stale-reclaim
+  # above requires before it deletes -- the read SUCCEEDED, an owner is
+  # actually there, and this time the positive fact is "same pid, positively
+  # alive" rather than "positively dead". Anything short of that
+  # (unreadable, empty, a different pid, dead, or undecidable) leaves the
+  # lock exactly as found.
+  #
+  # NEVER delete-then-claim (#1470 review, the #1445/#994 race again in a
+  # new spot): a plain claim elsewhere takes no mutex at all, so a lock path
+  # left empty even briefly -- released here, filled by an ordinary `ln`
+  # later -- is a window an unrelated claimant can win, and this reclaim
+  # would then either silently lose its own race or, worse, report success
+  # about a lock it no longer owns. So the move is ONE filesystem op:
+  # write the new owner to a fresh name beside the lock, verify the write
+  # landed, and `mv` it directly over the existing (still-occupied) path --
+  # same directory, so the rename is atomic and there is no instant where
+  # the path reads as absent.
+  local result="unknown:not_same_process" rc=1
+  local rd owner_now old_pid alive_rc
+  rd="$(_actas_lock_read_path "$lock_path")"
+  if [ "${rd%%$'\t'*}" = "ok" ] && [ -n "${rd#*$'\t'}" ]; then
+    owner_now="${rd#*$'\t'}"
+    old_pid="${owner_now##*.}"
+    alive_rc=0
+    agmsg_instance_alive "$owner_now" || alive_rc=$?
+    if [ "$old_pid" = "$new_pid" ] && [ "$alive_rc" -eq 0 ]; then
+      local dir tmp w
+      dir="${lock_path%/*}"
+      if tmp="$(mktemp "$dir/.actas-reclaim.XXXXXX" 2>/dev/null)"; then
+        if printf '%s\n' "$new_owner" > "$tmp" 2>/dev/null; then
+          w="$(_actas_lock_read_path "$tmp")"
+          if [ "${w%%$'\t'*}" = "ok" ] && [ "${w#*$'\t'}" = "$new_owner" ]; then
+            if mv "$tmp" "$lock_path" 2>/dev/null; then
+              result="ok"; rc=0
+            else
+              result="unknown:reclaim_rename_failed"
+            fi
+          else
+            result="unknown:reclaim_write_unverified"
+          fi
+        else
+          result="unknown:reclaim_write_failed"
+        fi
+        rm -f "$tmp" 2
```

**File**: `scripts/lib/self-fix.sh` (modified, +268/-1)
```diff
@@ -50,6 +50,15 @@
 # this file sources it.
 # shellcheck disable=SC1091
 . "${SKILL_DIR:?}/scripts/lib/token-locate.sh"
+# agmsg_canonical_path, for _fix_codex_thread_reassign's project comparison
+# (#1468) -- actas-lock.sh/self-write.sh pull in role-session.sh and
+# instance-id.sh already, but nothing before this reached resolve-project.sh.
+# shellcheck disable=SC1091
+. "${SKILL_DIR:?}/scripts/lib/resolve-project.sh"
+# agmsg_sha1, needed by _bridge-key.sh's agmsg_codex_bridge_key (sourced
+# lazily from _fix_codex_thread_synced) for its own multi-pair hash.
+# shellcheck disable=SC1091
+. "${SKILL_DIR:?}/scripts/lib/hash.sh"
 
 # The seats whose actas lock this session OWNS, one line per seat:
 #   ok\t<team>\t<agent>\t<owner>            resolved -- safe to use
@@ -231,17 +240,255 @@ _fix_locate() {   # <team> <agent> <owner>
   return "$rc"
 }
 
+# The bridge state at ONE candidate bridge_key: nothing wrong there (rc 0,
+# no output) when there is no LIVE pidfile at this key at all -- a thread
+# file is only ever consulted when its own pidfile's pid is alive (#1470
+# review round 7). A thread file does not disappear when its bridge dies,
+# and a role's safe set can move it from the single-pair key to the
+# multi-pair key (or back) without either key's old file being cleaned up
+# -- so a stale, ownerless thread file must never be read as "still on the
+# old thread": that reads a leftover as a live fact and can never clear
+# (session-start.sh has nothing to make it go away, and deleting a file
+# this function does not own would need an ownership check beyond this
+# round's scope). Only once the pidfile at this SAME key proves something
+# is actually running here does its thread file get to speak: matches
+# CODEX_THREAD_ID (rc 0), names a different thread (rc 1,
+# bridge_thread_still_old), or is simply absent while the pid is alive (rc
+# 1, bridge_thread_unknown -- round 5 finding 1, an install/upgrade
+# boundary or a bridge still starting; "no file" is not "nothing to
+# compare" when something is plainly running).
+_fix_codex_bridge_key_state() {   # <bridge_key>
+  local key="$1" pidfile bridge_pid thread_file thread_now
+  [ -n "$key" ] || return 0
+  pidfile="$(_actas_lock_dir)/codex-bridge.$key.pid"
+  [ -f "$pidfile" ] || return 0
+  bridge_pid="$(cat "$pidfile" 2>/dev/null || true)"
+  [ -n "$bridge_pid" ] && _agmsg_pid_alive "$bridge_pid" || return 0
+
+  thread_file="$(_actas_lock_dir)/codex-bridge.$key.thread"
+  if [ -f "$thread_file" ]; then
+    thread_now="$(cat "$thread_file" 2>/dev/null || true)"
+    [ "$thread_now" = "${CODEX_THREAD_ID:-}" ] || { printf 'bridge_thread_still_old\n'; return 1; }
+    return 0
+  fi
+  printf 'bridge_thread_unknown\n'
+  return 1
+}
+
+# Whether (team, agent)'s codex thread state matches CODEX_THREAD_ID, by
+# READING THE RESULT rather than trusting an exit code (#1470 review round
+# 4 finding 3): codex-record-session.sh routinely exits 0 having recorded
+# nothing (its own "poison-record guard" -- a thread it cannot resolve is a
+# no-op, not a failure), and session-start.sh exits 0 on every early return
+# (no app-server yet, no seat key, an already-live bridge) -- none of those
+# are evidence the state this function cares about actually changed.
+#
+# Checks the role-session record first, then the bridge's own recorded
+# thread -- at BOTH candidate bridge_keys (#1470 review round 6), because
+# the two writer architectures do not agree on which one a role actually
+# uses. The out-of-sandbox launcher's dispatcher spawns one CHILD PER ROLE
+# PAIR, so its bridge_key is always the single-pair "team.agent" form, even
+# when two roles share the same thread. The direct session-start.sh path
+# instead bundles every "safe" pair (every registered pair whose OWN record
+# already names this project+thread) into ONE bridge process, so its key
+# can be the multi-pair hash form -- agmsg_codex_bridge_key(project,
+# CODEX_THREAD_ID), the exact derivation that pat
```

**File**: `scripts/session-start.sh` (modified, +24/-20)
```diff
@@ -59,12 +59,34 @@ source "$SCRIPT_DIR/lib/terminal-context-line.sh"
 PAIRS=$("$SCRIPT_DIR/identities.sh" "$PROJECT" "$TYPE" 2>/dev/null || true)
 [ -n "$PAIRS" ] || exit 0
 
+# Read hook input JSON from stdin BEFORE the type plug below runs (#1468):
+# stdin can only be read once, and a plug that needs a hook input field (e.g.
+# codex reading `source` to tell startup/resume/clear apart) has to see it
+# while it is still there. No plug reads it yet, so this move is order-only —
+# nothing downstream changes behavior. The session id field name differs by
+# vendor: Claude Code emits snake_case "session_id"; Grok Build (and Cursor)
+# emit camelCase "sessionId". Try snake first (claude-code unaffected), then
+# camel, then the GROK_SESSION_ID env Grok injects into every hook.
+INPUT=$(cat 2>/dev/null || true)
+SESSION_ID=""
+if [ -n "$INPUT" ]; then
+  SESSION_ID=$(printf '%s' "$INPUT" \
+    | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
+    | head -1)
+  [ -z "$SESSION_ID" ] && SESSION_ID=$(printf '%s' "$INPUT" \
+    | sed -n 's/.*"sessionId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
+    | head -1)
+fi
+[ -z "$SESSION_ID" ] && SESSION_ID="${GROK_SESSION_ID:-}"
+# Fallback so the instruction is still actionable even outside a hook flow.
+[ -z "$SESSION_ID" ] && SESSION_ID="unknown-$$"
+
 # Type-specific SessionStart behaviour (Template Method). A type may ship
 # scripts/drivers/types/<type>/_session-start.sh defining agmsg_session_start to override the
 # default no-op — codex uses it to hand the session off to the bridge. The plug
 # is sourced in this script's context so it sees PROJECT / RUN_DIR / SKILL_DIR /
-# PAIRS and the helpers sourced above; it may exit 0 (codex does, having no
-# Monitor tool) to skip the Monitor-directive path below.
+# PAIRS / INPUT / SESSION_ID and the helpers sourced above; it may exit 0
+# (codex does, having no Monitor tool) to skip the Monitor-directive path below.
 agmsg_session_start_default() { :; }
 
 _tdir="$(agmsg_type_dir "$TYPE" 2>/dev/null || true)"
@@ -76,24 +98,6 @@ else
   agmsg_session_start_default
 fi
 
-# Read hook input JSON from stdin. The session id field name differs by vendor:
-# Claude Code emits snake_case "session_id"; Grok Build (and Cursor) emit
-# camelCase "sessionId". Try snake first (claude-code unaffected), then camel,
-# then the GROK_SESSION_ID env Grok injects into every hook.
-INPUT=$(cat 2>/dev/null || true)
-SESSION_ID=""
-if [ -n "$INPUT" ]; then
-  SESSION_ID=$(printf '%s' "$INPUT" \
-    | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
-    | head -1)
-  [ -z "$SESSION_ID" ] && SESSION_ID=$(printf '%s' "$INPUT" \
-    | sed -n 's/.*"sessionId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
-    | head -1)
-fi
-[ -z "$SESSION_ID" ] && SESSION_ID="${GROK_SESSION_ID:-}"
-# Fallback so the instruction is still actionable even outside a hook flow.
-[ -z "$SESSION_ID" ] && SESSION_ID="unknown-$$"
-
 # One where.sh call, rendered once, reused by every text-emitting exit below —
 # so a session always learns its own terminal driver and capabilities as the
 # FIRST thing in its context, before any Monitor-tool instruction, rather than
```

#### Recent Merged Pull Requests:
- **PR #1530** (2026-09-30): fix: handle database readers and immediate stops during daemon startup (@fujibee)
- **PR #1528** (2026-09-30): Merge main into integration/agmsgd-beta (@fujibee)
- **PR #1527** (2026-09-30): ci(tests): refresh bats-file-seconds.tsv from a current full macOS run (@fujibee)
- **PR #1523** (2026-09-30): Add daemon beta switching and recovery guidance (@fujibee)
- **PR #1520** (2026-09-29): Add Codex queue delivery and seat status (@fujibee)
- **PR #1519** (2026-09-29): test(codex): synchronize the replacement-dispatcher check (#1518) (@fujibee)
- **PR #1517** (2026-09-29): tests: keep install cancellation children from holding Bats pipes (@fujibee)
- **PR #1516** (2026-09-29): fix(plugin): ship a rendered repo-root SKILL.md with a first-run bootstrap (#1286) (@fujibee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
