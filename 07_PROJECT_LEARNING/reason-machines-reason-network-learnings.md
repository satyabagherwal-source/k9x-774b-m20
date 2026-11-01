> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/reason-machines-reason-network-learnings.md`  
> **Source**: github ([https://github.com/reason-machines/reason-network](https://github.com/reason-machines/reason-network))  
> **Source Version**: `58727119`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T05:39:11.646Z  
> **Learning ID**: `learn-github-reason-machines-reason-network`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): reason-machines/reason-network

> **Canonical Artifact**: `07_PROJECT_LEARNING/reason-machines-reason-network-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/reason-machines/reason-network](https://github.com/reason-machines/reason-network))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-30T05:39:09.508Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `reason-machines/reason-network`
- **Description**: Reason Network: your team's coding agents, talking to each other. The engine behind `reason network`.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 1324 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/hook.rs`
```
//! `reason-network hook <agent> <event>`: run by an agent's hook system. Tells the daemon the session is alive (and busy
//! or idle), and prints whatever makes the agent show incoming mail. It never fails loudly: a broken Reason Network must
//! not break the agent.

use crate::{agent, client::Link, proto::*};
use serde_json::{Value, json};
use std::{
    io::{Read, Write},
    time::Duration,
};

pub async fn run(agent_name: &str, event: &str, session: Option<String>, state: Option<String>, doing: Option<String>) {
    let input = if session.is_none() { read_stdin(Duration::from_secs(3)) } else { String::new() };
    let link = Link::new(None);
    let Ok(Some((out, key, ids))) =
        tokio::time::timeout(Duration::from_secs(8), handle(&link, agent_name, event, &input, session, state, doing))
            .await
    else {
        return;
    };
    let mut stdout = std::io::stdout();
    if writeln!(stdout, "{out}").and_then(|_| stdout.flush()).is_ok() && !ids.is_empty() {
        // Printed, so the agent has it: now it counts as read.
        let _ = tokio::time::timeout(Duration::from_secs(3), link.call::<Value>(Request::Delivered { key, ids })).await;
    }
}

/// The hook payload, without hanging if the agent never closes our stdin.
fn read_stdin(limit: Duration) -> String {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut s = String::new();
        let _ = std::io::stdin().read_to_string(&mut s);
        let _ = tx.send(s);
    });
    rx.recv_timeout(limit).unwrap_or_default()
}

/// Returns what to print, the session key, and the ids of the messages in it.
async fn handle(
    link: &std::sync::Arc<Link>,
    agent_name: &str,
    event: &str,
    input: &str,
    session: Option<String>,
    state: Option<String>,
    doing: Option<String>,
) -> Option<(String, String, Vec<String>)> {
    // Windows PowerShell pipes it in after a byte-order mark.
    let v: Value = serde_json::from_str(input.trim_start_matches('\u{feff}')).unwrap_or(Value::Null);
    let agent = agent::from_client_name(agent_name).unwrap_or(agent_name);
    let str_at = |k: &str| v.get(k).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string);
    if agent == "grok" && grok_ignores(event, &v) {
        return None;
    }

    let session_id = session
        .or_else(|| str_at("session_id"))
        .or_else(|| str_at("conversation_id"))
        .or_else(|| str_at("conversationId"))
        .or_else(|| str_at("sessionId"))?;
    // Every folder the agent names for the session, the one it works in first.
    let mut dirs: Vec<String> = str_at("cwd").into_iter().collect();
    dirs.extend(v["workspace_roots"].as_array().into_iter().flatten().filter_map(Value::as_str).map(str::to_string));
    dirs.extend(v["workspacePaths"].as_array().into_iter().flatten().filter_map(Value::as_str).map(str::to_string));
    dirs.extend(
        ["CURSOR_PROJECT_DIR", "GEMINI_CWD", "CLAUDE_PROJECT_DIR"]
            .iter()
            .filter_map(|k| std::env::var(k).ok())
            .filter(|s| !s.is_empty()),
    );
    let cwd = dirs.first().cloned().or_else(|| std::env::current_dir().ok().map(|p| p.display().to_string()));
    // In a folder that is off, the agent hears nothing; the daemon only that this session is off.
    let cfg = crate::config::Config::load_strict().unwrap_or_default();
    let off = cwd.iter().chain(&dirs).any(|d| cfg.off_in(d));
    let ev = match (event, state.as_deref()) {
        ("session-start", _) => "start",
        ("user-prompt-submit", _) => "prompt",
        ("post-tool-use", _) => "tool",
        ("stop" | "poll", _) => "stop",
        ("session-end", _) => "end",
        ("status", Some("busy" | "retry")) => "prompt",
        ("status", _) => "stop",
        ("doing", _) => "doing",
        _ => return None,
    };
    let mail = !off
        && takes_mail(agent, event)
        && !(agent == "antigravity" && event == "stop" && v["terminationReason"] != "model_stop");

    let key = format!("{agent}:{session_id}");
    let native_app =
        agent == "antigravity" && str_at("transcriptPath").as_deref().is_some_and(crate::antigravity::app_transcript);
    let req = Request::Hook(HookCall {
        through_reason: Some(false),
        agent: agent.to_string(),
        event: ev.to_string(),
        session_id,
        cwd,
        pid: if native_app { None } else { agent::hook_agent_pid() },
        mail,
        transcript: str_at("transcript_path").or_else(|| str_at("transcriptPath")),
        doing,
        name: None,
        dirs: dirs.into_iter().skip(1).collect(),
        keep: false,
    });
    let reply: HookReply = link.call(req).await.ok()?;
    if off {
        return None;
    }
    let ids = reply.ids;
    let text = match (reply.text, ev, reply.address) {
        (Some(t), ..) => t,
        // Say who it is on Reason Network once, at session start.
        (None, "start" | "prompt", Some(addr)) if ev == "start" || agent == "antigravity" => {
            format!(
                "Reason Network: you are {addr}. Teammates' agents can message you; list_team and send_message reach them."
            )
        }
        _ => return None,
    };
    let text = if agent == "antigravity" {
        format!(
            "{text}\nFor Reason Network tools, pass session_id: {}. This identifies this conversation even when other chats use the same project.",
            key.strip_prefix("antigravity:").unwrap_or(&key)
        )
    } else {
        text
    };
    Some((format_for(agent, event, ev, &text), key, ids))
}

/// Prompt-submit hooks in Cursor, Copilot and grok can't add context, grok drops what SessionStart prints, and
/// opencode's status call shows nothing.
fn takes_mail(agent: &str, event: &str) -> bool {
    // Antigravity consumes injectSteps before invocation, and a continue reason at a natural Stop.
    if agent == "antigravity" {
        return matches!(event, "session-start" | "user-prompt-submit" | "stop");
    }
    !matches!(
        (agent, event),
        ("cursor" | "copilot" | "grok", "user-prompt-submit") | ("grok", "session-start") | (_, "status" | "doing")
    )
}

/// grok runs a subagent's hooks under the subagent's own session id, and after SessionEnd fires one more Stop
/// (reason "shutdown" or "channel_closed") whose block it ignores.
fn grok_ignores(event: &str, v: &Value) -> bool {
    !v["subagentType"].is_null() || (event == "stop" && v["reason"] != "end_turn")
}

/// The JSON (or text) each agent expects from this hook to put `text` in front of the model.
fn format_for(agent: &str, event: &str, ev: &str, text: &str) -> String {
    let specific = |name: &str| json!({ "hookSpecificOutput": { "hookEventName": name, "additionalContext": text } });
    let block = || json!({ "decision": "block", "reason": text });
    let out = match (agent, ev) {
        ("antigravity", "start" | "prompt") => json!({"injectSteps": [{"userMessage": text}]}),
        ("antigravity", "stop") => json!({"decision":"continue","reason":text}),
        ("opencode", _) if event == "poll" => return text.to_string(),
        ("codex" | "cmd", "start") => specific("SessionStart"),
        ("cmd", "tool") => specific("PostToolUse"),
        ("cmd", "stop") => block(),
        ("codex", "prompt") => specific("UserPromptSubmit"),
        ("codex", "tool") => specific("PostToolUse"),
        ("grok", "tool") => specific("PostToolUse"),
        ("gemini", "start") => specific("SessionStart"),
        ("gemini", "prompt") => specific("BeforeAgent"),
        ("gemini", "tool") => specific("AfterTool"),
        ("gemini", "stop") => json!({"decision": "deny", "reason": text}),
        ("codex" | "copilot" | "grok", "stop") => block(),
        ("cursor", "stop") => json!({ "followup_message": text }),
        ("cursor", _) => json!({ "additional_context": text }),
        ("copilot", _) => json!({ "additionalContext": text }),
        _ => return text.to_string(),
    }
    .to_string();
    // On Windows agents run hooks through PowerShell, which can re-encode what passes through it: JSON in ASCII is
    // safe from that.
    if !cfg!(windows) {
        return out;
    }
    out.chars()
        .map(|c| {
            if c.is_ascii() {
                c.to_string()
            } else {
                c.encode_utf16(&mut [0; 2]).iter().map(|u| format!("\\u{u:04x}")).collect()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{format_for, grok_ignores, takes_mail};
    use serde_json::json;

    #[test]
    fn formats() {
        assert!(format_for("codex", "post-tool-use", "tool", "hi").contains("\"PostToolUse\""));
        assert!(format_for("cmd", "session-start", "start", "hi").contains("\"SessionStart\""));
        assert!(format_for("cmd", "post-tool-use", "tool", "hi").contains("\"PostToolUse\""));
        assert_eq!(format_for("cmd", "stop", "stop", "hi"), r#"{"decision":"block","reason":"hi"}"#);
        assert_eq!(format_for("codex", "stop", "stop", "hi"), r#"{"decision":"block","reason":"hi"}"#);
        assert_eq!(format_for("cursor", "stop", "stop", "hi"), r#"{"followup_message":"hi"}"#);
        assert_eq!(format_for("cursor", "post-tool-use", "tool", "hi"), r#"{"additional_context":"hi"}"#);
        assert_eq!(format_for("copilot", "session-start", "start", "hi"), r#"{"additionalContext":"hi"}"#);
        assert!(format_for("gemini", "user-prompt-submit", "prompt", "hi").contains("BeforeAgent"));
        assert!(format_for("grok", "post-tool-use", "tool", "hi").contains("\"PostToolUse\""));
        assert_eq!(format_for("grok", "stop", "stop", "hi"), r#"{"decision":"block","reason":"hi"}"#);
        assert_eq!(format_for("opencode", "poll", "stop", "hi"), "hi");
    }

    #[test]
    fn grok_payloads() {
        assert!(!takes_mail("grok", "session-start"));
        assert!(!takes_mail("grok", "user-prompt-submit"));
        assert!(takes_mail("grok", "post-tool-use"));
        assert!(takes_ma
```

### Core Architecture Module: `src/render.rs`
```
//! Text shown to agents (tool results, injected messages) and in the CLI.

use crate::{ENGINE, proto::*, util};
use std::fmt::Write;

/// Terminal colours for people reading the CLI; agents, pipes and `NO_COLOR` get plain text.
#[derive(Clone, Copy)]
pub struct Paint(bool);

impl Paint {
    pub const PLAIN: Paint = Paint(false);

    #[cfg(unix)]
    pub fn terminal() -> Paint {
        use std::io::IsTerminal;
        Paint(std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none())
    }

    /// The same, after asking the console to take colour codes (Windows 10's doesn't until asked).
    #[cfg(windows)]
    pub fn terminal() -> Paint {
        Paint(console::colors_enabled())
    }

    fn on(self, style: &str, text: &str) -> String {
        if self.0 && !text.trim().is_empty() { format!("\x1b[{style}m{text}\x1b[0m") } else { text.to_string() }
    }
}

const BOLD: &str = "1";
const DIM: &str = "2";
const GREEN: &str = "32";
const YELLOW: &str = "33";
const CYAN: &str = "36";

/// The team directory. For an agent (`agent`) it is compact, and sessions without Reason Network are only counted (it
/// can't message them); people get more room, a dot for whether each machine is online, and colour.
pub fn directory(d: &Directory, agent: bool, paint: Paint) -> String {
    let now = util::now_ms();
    let mut out = String::new();
    let team = d.team.as_deref().map_or_else(
        || paint.on(DIM, "no team yet (this machine only)"),
        |t| format!("{} {}", paint.on(DIM, "team"), paint.on(BOLD, t)),
    );
    let _ = writeln!(out, "{team} {}", paint.on(DIM, &format!("· you are {} on {}", d.person, d.machine)));

    let cells: Vec<[String; 4]> = d
        .sessions
        .iter()
        .map(|s| {
            let age = s.since.map(|t| util::ago(t, now));
            let status = match (s.status.as_str(), age) {
                ("live", Some(a)) => format!("up {a}"),
                (st, Some(a)) => format!("{st} {a}"),
                (st, None) => st.to_string(),
            };
            [s.name.clone(), s.agent.clone(), status, place(s)]
        })
        .collect();
    let mut width = [0; 4];
    for (_, row) in cells.iter().enumerate().filter(|(i, _)| !agent || d.sessions[*i].tier != Tier::None) {
        for (w, c) in width.iter_mut().zip(row) {
            *w = (*w).max(c.chars().count());
        }
    }
    let layout = Layout { width, gap: if agent { 2 } else { 3 }, agent, paint };

    let mut quiet = Vec::new();
    let mut shown = vec![false; d.sessions.len()];
    for m in &d.machines {
        let rows: Vec<usize> = (0..d.sessions.len())
            .filter(|&i| d.sessions[i].person == m.person && d.sessions[i].machine == m.machine)
            .collect();
        rows.iter().for_each(|&i| shown[i] = true);
        let (unreachable, rows): (Vec<usize>, Vec<usize>) =
            rows.into_iter().partition(|&i| agent && d.sessions[i].tier == Tier::None);
        if rows.is_empty() && unreachable.is_empty() {
            if agent {
                quiet.push(format!("{} · {} ({})", person(m), m.machine, link(m, now)));
                continue;
            }
            let _ = writeln!(out, "\n{}  {}", header(m, now, paint), paint.on(DIM, "no sessions"));
            continue;
        }
        if agent {
            let _ = writeln!(out, "{} · {} · {}", person(m), m.machine, link(m, now));
        } else {
            let _ = writeln!(out, "\n{}", header(m, now, paint));
        }
        for i in rows {
            layout.session(&mut out, &d.sessions[i], &cells[i]);
        }
        if !unreachable.is_empty() {
            let n = unreachable.len();
            let _ = writeln!(
                out,
                "  + {n} session{} without Reason Network (can't be messaged)",
                if n == 1 { "" } else { "s" }
            );
        }
    }
    for (i, s) in d.sessions.iter().enumerate().filter(|(i, _)| !shown[*i]) {
        let _ = writeln!(
            out,
            "{}{}",
            if agent { "" } else { "\n" },
            paint.on(BOLD, &format!("{} · {}", s.person, s.machine))
        );
        layout.session(&mut out, s, &cells[i]);
    }
    if !quiet.is_empty() {
        let _ = writeln!(out, "no sessions: {}", quiet.join(", "));
    }
    // Never the team link itself: it is a standing way into the team, and an agent's context ends up in its provider's
    // logs.
    if agent && d.team.is_some() {
        let _ = writeln!(out, "To invite people, your user runs `{} invite` on one of their computers.", crate::CLI);
    }
    if !d.sessions.is_empty() {
        if agent {
            out.push_str(
                "push = sees messages right away, even when idle · turn = at its next step · pull = when it checks\n",
            );
        } else {
            let _ = writeln!(
                out,
                "\n{}",
                paint.on(DIM, "push: sees it right away · turn: at its next step · pull: when it checks")
            );
        }
    }
    out
}

/// The directory as `list_team` gives it, defanged whole: a teammate's fields side by side (`repo@branch`) could open
/// a frame that none of them opens alone.
pub fn directory_for_agent(d: &Directory) -> String {
    defang(&directory(d, true, Paint::PLAIN))
}

/// `● alice · xps · direct 4ms`: a green dot while the machine is online.
fn header(m: &MachineInfo, now: i64, paint: Paint) -> String {
    let dot = if m.is_me || m.online { paint.on(GREEN, "●") } else { paint.on(DIM, "○") };
    format!("{dot} {} {}", paint.on(BOLD, &format!("{} · {} ·", person(m), m.machine)), link_painted(m, now, paint))
}

/// The person's name, marked when Reason verified it.
fn person(m: &MachineInfo) -> String {
    if m.verified { format!("{} (verified)", m.person) } else { m.person.clone() }
}

struct Layout {
    width: [usize; 4],
    gap: usize,
    agent: bool,
    paint: Paint,
}

impl Layout {
    fn session(&self, out: &mut String, s: &SessionInfo, row: &[String; 4]) {
        let (paint, gap) = (self.paint, " ".repeat(self.gap));
        let pad = |i: usize| format!("{:w$}", row[i], w = self.width[i]);
        let status = match s.status.as_str() {
            "busy" => YELLOW,
            "idle" | "offline" => DIM,
            _ => "",
        };
        let tier = match s.tier {
            Tier::None => paint.on(DIM, "not on Reason Network"),
            Tier::Push => paint.on(GREEN, "push"),
            Tier::Turn => paint.on(CYAN, "turn"),
            t => paint.on(DIM, t.as_str()),
        };
        let cols = [paint.on(BOLD, &pad(0)), paint.on(DIM, &pad(1)), paint.on(status, &pad(2)), pad(3), tier];
        let mut line = format!("  {}", cols.join(&gap));
        if s.unread > 0 {
            let _ = write!(line, " · {}", paint.on(YELLOW, &format!("{} unread", s.unread)));
        }
        if s.is_me {
            let _ = write!(line, " · {}", paint.on(BOLD, "← you"));
        }
        let _ = writeln!(out, "{}", line.trim_end());
        if let Some(doing) = &s.doing {
            let label = if self.agent { format!("doing: {doing}") } else { format!("↳ {doing}") };
            let _ = writeln!(out, "  {:w$}{gap}{}", "", paint.on(DIM, &label), w = self.width[0]);
        }
    }
}

fn link_painted(m: &MachineInfo, now: i64, paint: Paint) -> String {
    let text = link(m, now);
    let style = match (m.is_me, m.online, m.link.as_deref()) {
        (true, ..) | (false, false, _) => DIM,
        (_, true, Some("relay")) => YELLOW,
        _ => GREEN,
    };
    paint.on(style, &text)
}

/// How a machine is reached: `this machine`, `direct 4ms`, `relay 80ms`, `offline 2h`.
fn link(m: &MachineInfo, now: i64) -> String {
    if m.is_me {
        return "this machine".into();
    }
    if m.online {
        let how = m.link.as_deref().unwrap_or("connected");
        return m.rtt_ms.map_or_else(|| how.to_string(), |r| format!("{how} {r}ms"));
    }
    m.last_seen.map_or_else(|| "not seen yet".to_string(), |t| format!("offline {}", util::ago(t, now)))
}

/// What a team that doesn't run its own relay uses: the nearest of Reason's (see `relays`).
pub fn default_relays() -> String {
    "Reason's (the default)".into()
}

pub fn team(t: &TeamInfo) -> String {
    let now = util::now_ms();
    let mut out = String::new();
    let relay = t.relay.clone().unwrap_or_else(default_relays);
    let _ = writeln!(out, "team {} · relay: {relay}", crate::team::shown_name(&t.name));
    let pw = t.machines.iter().map(|m| person(m).chars().count()).max().unwrap_or(0);
    let mw = t.machines.iter().map(|m| m.machine.chars().count()).max().unwrap_or(0);
    for m in &t.machines {
        let _ = writeln!(out, "  {:pw$}  {:mw$}  {}", person(m), m.machine, link(m, now));
    }
    out
}

/// The UDP port the network is on, and whether it is the one `port` in the config asked for.
pub fn udp_port(u: &crate::proto::UdpPort) -> String {
    match u.fixed {
        Some(f) if u.fell_back => format!("UDP port {} (random; fixed {f} couldn't be bound)", u.port),
        Some(_) => format!("UDP port {} (fixed)", u.port),
        None => format!("UDP port {} (random)", u.port),
    }
}

pub fn send_result(r: &SendResult) -> String {
    let mut out = String::new();
    for rc in &r.recipients {
        let _ = writeln!(out, "→ {}: {}", rc.address, util::one_line(&rc.note, 300));
    }
    if let [id] = r.ids.as_slice() {
        let _ = writeln!(out, "message id {id}");
    }
    out
}

/// Messages framed for an agent's context: clearly peer input, with what it needs to reply. `agent` is the
/// recipient's agent kind, if known; `cli` when it has no Reason Network tools and replies with the CLI.
/// Whether a message comes from a person's terminal (`<person>/terminal`, or `…@<machine>` once it is here).
pub fn from_terminal(from: &str) -> bool {
    without_machine(from).ends_with("/terminal")
}

/// How a message from `address`, from machine `machine`, shows on another machine: a person's terminal wi
```

### Core Architecture Module: `src/util.rs`
```
use std::{fs::File, path::Path};

pub fn now_ms() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_millis() as i64)
}

/// Short machine name: `Sams-MacBook-Pro.local` -> `sams-macbook-pro`. `REASON_NETWORK_MACHINE` overrides it.
pub fn hostname() -> String {
    if let Some(name) = crate::paths::env_var("MACHINE").ok().map(|n| slug(&n)).filter(|n| !n.is_empty()) {
        return name;
    }
    let raw = system_hostname();
    let short = raw.split('.').next().unwrap_or_default();
    let s = slug(short);
    if s.is_empty() { "machine".into() } else { s }
}

#[cfg(unix)]
fn system_hostname() -> String {
    let mut buf = [0u8; 256];
    let rc = unsafe { libc::gethostname(buf.as_mut_ptr().cast(), buf.len()) };
    if rc == 0 {
        let end = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
        String::from_utf8_lossy(&buf[..end]).into_owned()
    } else {
        String::new()
    }
}

#[cfg(windows)]
fn system_hostname() -> String {
    std::env::var("COMPUTERNAME").unwrap_or_default()
}

#[cfg(unix)]
pub fn pid_alive(pid: u32) -> bool {
    let rc = unsafe { libc::kill(pid as libc::pid_t, 0) };
    rc == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

#[cfg(windows)]
pub fn pid_alive(pid: u32) -> bool {
    use windows_sys::Win32::{Foundation::*, System::Threading::*};
    // SAFETY: a handle we open, look at without waiting, and close.
    unsafe {
        let h = OpenProcess(PROCESS_SYNCHRONIZE, 0, pid);
        if h.is_null() {
            return GetLastError() == ERROR_ACCESS_DENIED;
        }
        let alive = WaitForSingleObject(h, 0) == WAIT_TIMEOUT;
        CloseHandle(h);
        alive
    }
}

#[cfg(unix)]
pub fn parent_pid() -> u32 {
    unsafe { libc::getppid() as u32 }
}

#[cfg(windows)]
pub fn parent_pid() -> u32 {
    process(std::process::id()).map_or(0, |(ppid, _)| ppid)
}

/// A running process's parent and program name (`zsh`, `cmd`).
#[cfg(unix)]
pub fn process(pid: u32) -> Option<(u32, String)> {
    let out = std::process::Command::new("ps").args(["-o", "ppid=,comm=", "-p", &pid.to_string()]).output().ok()?;
    let line = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let (ppid, comm) = line.split_once(' ')?;
    let name = comm.trim().rsplit('/').next().unwrap_or_default().trim_start_matches('-');
    Some((ppid.trim().parse().ok()?, name.to_string()))
}

#[cfg(windows)]
pub fn process(pid: u32) -> Option<(u32, String)> {
    use windows_sys::Win32::{Foundation::*, System::Diagnostics::ToolHelp::*};
    // SAFETY: walks a snapshot we take and close; the entry is sized as the API asks.
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == INVALID_HANDLE_VALUE {
            return None;
        }
        let mut e: PROCESSENTRY32W = std::mem::zeroed();
        e.dwSize = size_of::<PROCESSENTRY32W>() as u32;
        let mut found = None;
        let mut more = Process32FirstW(snap, &mut e) != 0;
        while more && found.is_none() {
            if e.th32ProcessID == pid {
                let exe = &e.szExeFile[..e.szExeFile.iter().position(|&c| c == 0).unwrap_or(e.szExeFile.len())];
                let name = String::from_utf16_lossy(exe).to_lowercase();
                found = Some((e.th32ParentProcessID, name.strip_suffix(".exe").unwrap_or(&name).to_string()));
            }
            more = Process32NextW(snap, &mut e) != 0;
        }
        CloseHandle(snap);
        found
    }
}

/// Lowercase letters, digits and single dashes: a name that is safe in an address. Letters of other scripts are
/// transliterated first (`José` -> `jose`, `代码` -> `dai-ma`), so the address stays plain ASCII, which every version
/// accepts. A character it can't transliterate (unassigned, private use) is a separator, like punctuation and control
/// characters, so only a name without a letter or digit in any script it knows comes out empty.
pub fn slug(s: &str) -> String {
    let mut out = String::new();
    // One character at a time, so a long name (teammates' names arrive up to megabytes long) costs no more than what is
    // kept: one character can become up to 41. (deunicode maps control characters to nothing, which would run the
    // words on either side together, so they are told apart first.)
    for c in
        s.chars().flat_map(|c| if c.is_control() { " " } else { deunicode::deunicode_char(c).unwrap_or(" ") }.chars())
    {
        if out.len() > 40 {
            break;
        }
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if !out.is_empty() && !out.ends_with('-') {
            out.push('-');
        }
    }
    // `out` is ASCII, so this cuts between characters; a dash left at the cut goes too.
    out.truncate(40);
    out.trim_end_matches('-').to_string()
}

/// `<base>-<suffix>` as a slug of at most 40 characters: both are slugged and the base is cut to make room, so the name
/// is whole as written and teammates, who slug every name they receive, see the same one.
pub fn joined(base: &str, suffix: &str) -> String {
    let (base, suffix) = (slug(base), slug(suffix));
    // A slug is ASCII, so this cuts between characters.
    let base = base[..base.len().min(39usize.saturating_sub(suffix.len()))].trim_end_matches('-');
    match (base.is_empty(), suffix.is_empty()) {
        (true, _) => suffix,
        (_, true) => base.to_string(),
        _ => format!("{base}-{suffix}"),
    }
}

/// Compact age: `45s`, `12m`, `3h`, `2d`.
pub fn ago(then_ms: i64, now_ms: i64) -> String {
    let s = ((now_ms - then_ms) / 1000).max(0);
    match s {
        0..60 => format!("{s}s"),
        60..3600 => format!("{}m", s / 60),
        3600..86400 => format!("{}h", s / 3600),
        _ => format!("{}d", s / 86400),
    }
}

pub fn tilde(path: &str) -> String {
    let home = crate::paths::user_home();
    match Path::new(path).strip_prefix(&home) {
        Ok(rest) if rest.as_os_str().is_empty() => "~".into(),
        Ok(rest) => format!("~{}{}", std::path::MAIN_SEPARATOR, rest.display()),
        Err(_) => path.into(),
    }
}

/// Takes an exclusive lock on `path` (waiting for it if `wait`) and writes our pid into it. `None` means
/// someone else holds it.
pub fn lock(path: &Path, wait: bool) -> std::io::Result<Option<Lock>> {
    use std::io::Write;
    let Some(file) = acquire(path, wait)? else { return Ok(None) };
    let mut lock = Lock { file };
    lock.file.set_len(0)?;
    write!(lock.file, "{}", std::process::id())?;
    Ok(Some(lock))
}

/// A lock from `lock`, held until dropped.
pub struct Lock {
    file: File,
}

/// Let go of on drop, not when the file closes: a process another thread is starting shares the file until it runs
/// its program, and the lock with it.
#[cfg(unix)]
impl Drop for Lock {
    fn drop(&mut self) {
        use std::os::fd::AsRawFd;
        unsafe { libc::flock(self.file.as_raw_fd(), libc::LOCK_UN) };
    }
}

#[cfg(unix)]
fn acquire(path: &Path, wait: bool) -> std::io::Result<Option<File>> {
    use std::os::fd::AsRawFd;
    let f = File::options().create(true).truncate(false).write(true).open(path)?;
    let flags = if wait { libc::LOCK_EX } else { libc::LOCK_EX | libc::LOCK_NB };
    // A client checking whether a daemon runs holds the lock for an instant: try again before giving up.
    let mut tries = 0;
    while unsafe { libc::flock(f.as_raw_fd(), flags) } != 0 {
        tries += 1;
        if tries == 3 {
            return Ok(None);
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    Ok(Some(f))
}

/// On Windows the lock is the open file itself, shared only for reading: until we exit, nobody else can open it to
/// write (another daemon, or `locked`), and anyone can read our pid. `wait` waits for the daemon that has it now,
/// then gives up if another got there first, so daemons waiting to take over can't pile up.
#[cfg(windows)]
fn acquire(path: &Path, wait: bool) -> std::io::Result<Option<File>> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::{Foundation::ERROR_SHARING_VIOLATION, Storage::FileSystem::FILE_SHARE_READ};
    if wait && locked(path) {
        let pid = std::fs::read_to_string(path).ok().and_then(|s| s.trim().parse().ok());
        while pid.is_some_and(pid_alive) {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }
    // As above, a client's check holds it for an instant.
    let mut tries = 0;
    loop {
        match File::options().create(true).truncate(false).write(true).share_mode(FILE_SHARE_READ).open(path) {
            Err(e) if e.raw_os_error() == Some(ERROR_SHARING_VIOLATION as i32) => {}
            r => return r.map(Some),
        }
        tries += 1;
        if tries == 3 {
            return Ok(None);
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
}

/// Whether someone holds the lock at `path`.
#[cfg(unix)]
pub fn locked(path: &Path) -> bool {
    use std::os::fd::AsRawFd;
    let Ok(file) = File::open(path) else { return false };
    // As a `Lock`, so the shared lock we may take here lasts only this instant.
    let f = Lock { file };
    unsafe { libc::flock(f.file.as_raw_fd(), libc::LOCK_SH | libc::LOCK_NB) != 0 }
}

#[cfg(windows)]
pub fn locked(path: &Path) -> bool {
    let held = windows_sys::Win32::Foundation::ERROR_SHARING_VIOLATION as i32;
    File::options().write(true).open(path).is_err_and(|e| e.raw_os_error() == Some(held))
}

#[cfg(unix)]
pub fn chmod(path: &Path, mode: u32) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode))
}

/// Text from a teammate as one printable line: no control characters (escape sequences, newlines), at most `max`
/// characters.
pub fn one_line(s: &str, max: usize) -> String {
    let t: String = s.chars().map(|c| if c.is_control() { ' ' } els
```

### Core Architecture Module: `integrations/hermes/__init__.py`
```
"""Native Hermes integration. The installed Reason engine owns networking and policy."""
from __future__ import annotations

import json
import hashlib
import logging
import os
import queue
import shutil
import subprocess
import threading
import time
from concurrent.futures import Future
from pathlib import Path

from agent.memory_provider import spawn_context_thread

log = logging.getLogger(__name__)


class Bridge:
    """One conversation, one local connection; no shared process-wide identity."""

    def __init__(self, executable, receive):
        options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
        self.process = subprocess.Popen(
            [executable, "bridge"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, encoding="utf-8", **options,
        )
        self._lock = threading.Lock()
        self._pending = {}
        self._next = 0
        self._events = queue.Queue()
        self._closed = False
        self._receive = receive
        self._reader = spawn_context_thread(self._read, name="reason-network-reader")
        self._delivery = spawn_context_thread(self._deliver, name="reason-network-delivery")
        self._reader.start()
        self._delivery.start()

    @property
    def alive(self):
        return not self._closed and self.process.poll() is None

    def request(self, op, *, timeout=125, interrupted=None, **arguments):
        with self._lock:
            if not self.alive:
                raise RuntimeError("Reason adapter stopped; retry after the next Hermes turn")
            self._next += 1
            ident = self._next
            future = Future()
            self._pending[ident] = future
            try:
                self.process.stdin.write(json.dumps({"id": ident, "op": op, **arguments}) + "\n")
                self.process.stdin.flush()
            except (OSError, ValueError):
                self._pending.pop(ident, None)
                raise RuntimeError("Reason adapter connection closed") from None
        try:
            deadline = time.monotonic() + timeout
            while True:
                if interrupted is not None and interrupted():
                    self.request("stop_waiting", key=arguments["key"], timeout=3)
                    raise InterruptedError("Reason wait cancelled; messages remain unread")
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    if op in {"inbox", "ask"}:
                        self.request("stop_waiting", key=arguments["key"], timeout=3)
                    raise TimeoutError("Reason request timed out")
                try:
                    return future.result(timeout=min(remaining, 0.1))
                except TimeoutError:
                    if future.done():
                        raise
        finally:
            with self._lock:
                self._pending.pop(ident, None)

    def _read(self):
        try:
            for line in self.process.stdout:
                reply = json.loads(line)
                if reply.get("event") == "deliver":
                    self._events.put(reply)
                    continue
                with self._lock:
                    future = self._pending.pop(reply.get("id"), None)
                if future is not None:
                    if reply.get("ok"):
                        future.set_result(reply.get("result"))
                    else:
                        future.set_exception(RuntimeError(reply.get("error", "Reason request failed")))
        except (OSError, ValueError):
            log.warning("Reason adapter output closed or malformed")
        finally:
            with self._lock:
                self._closed = True
                waiting = list(self._pending.values())
                self._pending.clear()
            for future in waiting:
                future.set_exception(RuntimeError("Reason adapter connection closed"))
            self._events.put(None)

    def _deliver(self):
        while (event := self._events.get()) is not None:
            try:
                self._receive(event)
            except Exception:
                log.exception("Reason delivery failed; message remains unread")

    def close(self):
        # Closing stdin ends only this adapter, never the shared network daemon.
        with self._lock:
            self._closed = True
            try:
                self.process.stdin.close()
            except (OSError, ValueError):
                pass
        try:
            self.process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=3)
        self._events.put(None)
        for worker in (self._reader, self._delivery):
            if worker is not threading.current_thread():
                worker.join(timeout=3)
        self.process.stdout.close()


class Network:
    def __init__(self, ctx):
        self.ctx = ctx
        # Guards the two maps only, never held across adapter or Hermes calls, so a
        # slow answer for one conversation cannot stall the others in a gateway.
        self._lock = threading.Lock()
        self._sessions = {}
        # One lock per conversation: its turn refresh, deliveries and replacement
        # run one at a time, so an old refusal cannot undo a newer registration.
        self._turns = {}
        self.profile_id = None

    def turn_lock(self, session_id):
        with self._lock:
            return self._turns.setdefault(session_id, threading.RLock())

    def current(self, session_id):
        with self._lock:
            return self._sessions.get(session_id)

    def interrupted(self):
        return self.ctx.is_interrupted()

    def executable(self):
        configured = self.ctx.get_config("executable", "")
        if configured:
            return str(configured)
        found = shutil.which("reason-network")
        if found:
            return found
        # Where install.sh/install.ps1 put it, then where the Reason app keeps its copy;
        # a gateway started by a service manager may not have either on PATH.
        name = "reason-network.exe" if os.name == "nt" else "reason-network"
        candidates = [Path.home() / ".local" / "bin" / name, Path.home() / ".reason" / "bin" / name]
        return str(next((path for path in candidates if path.is_file()), candidates[0]))

    def session(self, session_id, platform=None):
        if not session_id:
            raise ValueError("Reason tools require an active Hermes conversation")
        lock = self.turn_lock(session_id)
        with lock:
            previous = self.current(session_id)
            if previous and previous["bridge"].alive:
                if platform is not None:
                    route, interactive, wake = self.delivery_mode(platform)
                    if interactive and route:
                        previous["route"] = route
                    if previous["wake"] and not wake:
                        previous["bridge"].request("push_failed", key=previous["key"], ids=[])
                    previous["wake"] = wake
                    # Retry registration every bound turn, including after a transient
                    # failure or a daemon-side fallback to pull.
                    self.register_session(previous)
                return previous
            if previous:
                previous["bridge"].close()
            cwd = self.ctx.session_cwd()
            if not cwd:
                raise ValueError("Reason needs the conversation's working directory")
            route, interactive, wake = self.delivery_mode(platform)
            if self.profile_id is None:
                self.profile_id = hashlib.sha256(str(self.ctx.state.data_dir).encode("utf-8")).hexdigest()[:32]
            ident = f"{self.ctx.profile_name}:{self.profile_id}:{route if interactive and route else session_id}"
            session = {"key": f"hermes:{ident}", "id": ident, "route": route, "cwd": cwd, "wake": wake, "lock": lock}
            session["bridge"] = Bridge(self.executable(), lambda event: self.receive(session, event))
            try:
                self.register_session(session)
            except Exception:
                session["bridge"].close()
                raise
            with self._lock:
                self._sessions[session_id] = session
            return session

    def delivery_mode(self, platform):
        route = self.ctx.session_key()
        surface = self.ctx.session_surface()
        interactive = platform is not None and platform not in {"subagent", "cron", "api", "api_server"}
        interactive = interactive and surface in {"cli", "tui", "desktop", "telegram", "discord", "slack", "whatsapp", "signal", "matrix"}
        asynchronous = self.ctx.session_supports_async_delivery()
        wake = interactive and asynchronous and self.ctx.get_config("wake", False) is True and bool(route or surface == "cli")
        return route, interactive, wake

    def register_session(self, session):
        session["registration"] = session["bridge"].request("register", session={
            "key": session["key"], "agent": "hermes", "agent_session_id": session["id"],
            # The adapter's lifetime is the conversation's lifetime, including in a
            # gateway process that hosts other conversations after this one closes.
            "cwd": session["cwd"], "pid": session["bridge"].process.pid,
            "tier": "push" if session["wake"] else "pull",
        })

    def receive(self, session, event):
        # Serialize refusal and mode changes with this conversation's next bound turn,
        # so an old failed delivery cannot demote a newly restored queue registration.
        with session["lock"]:
            if event.get("key") != session["key"]:
                return
            # A queued callback may outlive finalization, unload or replacement
            # of a failed
```

### Core Architecture Module: `src/agent.rs`
```
//! Which agent are we running under, what is its session, and how do we reach it.

use crate::{git::GitInfo, paths, util};
use serde_json::{Value, json};
use std::{
    io::Write,
    path::{Path, PathBuf},
};

pub const CLAUDE_CODE: &str = "claude-code";

/// Best guess from the environment the agent gives its children. `REASON_NETWORK_AGENT` (set by `reason network setup` in the
/// MCP config) wins.
pub fn detect_env() -> Option<&'static str> {
    let has = |k: &str| std::env::var_os(k).is_some();
    if let Ok(a) = crate::paths::env_var("AGENT") {
        return from_client_name(&a);
    }
    if has("CLAUDECODE") || has("CLAUDE_CODE_SESSION_ID") {
        Some(CLAUDE_CODE)
    } else if has("CODEX_THREAD_ID") || has("CODEX_SESSION_ID") {
        Some("codex")
    } else if has("GROK_SESSION_ID") || has("GROK_WORKSPACE_ROOT") {
        Some("grok")
    } else if has("GEMINI_CLI") {
        Some("gemini")
    } else if has("CURSOR_AGENT") {
        Some("cursor")
    } else if has("OPENCODE") {
        Some("opencode")
    } else if has("COPILOT_CLI") || has("COPILOT_AGENT_SESSION_ID") {
        Some("copilot")
    } else {
        None
    }
}

/// From the MCP client's `clientInfo.name`, which beats the environment (agents get launched from each
/// other's terminals and inherit their variables).
pub fn from_client_name(name: &str) -> Option<&'static str> {
    let n = name.to_ascii_lowercase();
    let has = |s: &str| n.contains(s);
    Some(if has("claude-code") || has("claude code") {
        CLAUDE_CODE
    } else if n == "cmd"
        || n == "cmdc"
        || n.starts_with("cmdc-")
        || n.starts_with("cmdc ")
        || has("command-code")
        || has("command code")
        || has("commandcode")
    {
        "cmd"
    } else if has("codex") {
        "codex"
    } else if has("cursor") {
        "cursor"
    } else if has("antigravity") {
        "antigravity"
    } else if has("gemini") {
        "gemini"
    } else if has("grok") {
        "grok"
    } else if has("opencode") {
        "opencode"
    } else if has("copilot") {
        "copilot"
    } else if n == "pi" || n.starts_with("pi-") || n.starts_with("pi ") {
        "pi"
    } else if n == "dsh" || n.starts_with("dsh-") {
        // DeepSeek Harness: its MCP client says `dsh-mcp-client`.
        "dsh"
    } else if n == "zcode" || n.starts_with("zcode-") || n.starts_with("zcode ") {
        "zcode"
    } else if has("reason") {
        "reason"
    } else if n == "amp" || n.starts_with("amp-") || n.starts_with("amp ") {
        "amp"
    } else if has("zed") {
        "zed"
    } else if has("devin") || has("windsurf") {
        "devin"
    } else if has("claude") {
        "claude-desktop"
    } else {
        return None;
    })
}

/// Agents that run one MCP server process for many sessions, so the session must come from each call.
pub fn multiplexed(agent: &str) -> bool {
    matches!(agent, "codex" | "opencode" | "cursor" | "antigravity")
}

/// The session id an agent exports to its MCP servers, if any. `REASON_NETWORK_SESSION` is set by our own pi extension.
/// Claude Code's is read from its session registry first: `/clear` starts a new conversation in the same process, and
/// the variable it gave us at start still names the old one.
pub fn env_session_id(agent: &str) -> Option<String> {
    if let Some(id) = crate::paths::env_var("SESSION").ok().filter(|s| !s.is_empty()) {
        return Some(id);
    }
    if agent == CLAUDE_CODE
        && let Some(id) = claude_pid().and_then(|pid| registry_session_id(&paths::claude_sessions(), pid))
    {
        return Some(id);
    }
    let var = match agent {
        CLAUDE_CODE => "CLAUDE_CODE_SESSION_ID",
        "copilot" => "COPILOT_AGENT_SESSION_ID",
        "gemini" => "GEMINI_SESSION_ID",
        "codex" => "CODEX_THREAD_ID",
        "grok" => "GROK_SESSION_ID",
        "opencode" => "OPENCODE_SESSION_ID",
        _ => return None,
    };
    std::env::var(var).ok().filter(|s| !s.is_empty())
}

/// The session id carried in a tool call's `_meta`. Codex sends `sessionId` (the root thread, the same id its
/// hooks see) and `threadId` (which differs inside subagents); opencode V2 sends `ai.opencode/sessionID`.
pub fn meta_session_id(meta: &serde_json::Map<String, Value>) -> Option<String> {
    ["conversationId", "sessionId", "ai.opencode/sessionID", "threadId"]
        .iter()
        .find_map(|k| meta.get(*k).and_then(Value::as_str))
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Finds an executable on `PATH` or in the usual install places (a launchd/systemd daemon has a bare `PATH`). On
/// Windows that is `<name>.exe`, or the `<name>.cmd` npm installs.
pub fn find_bin(name: &str) -> Option<PathBuf> {
    if let Some(p) = crate::paths::env_var_os(&format!("{}_BIN", name.to_uppercase())) {
        let p = PathBuf::from(p);
        return p.is_file().then_some(p);
    }
    let home = paths::user_home();
    #[cfg(unix)]
    let extra = [
        home.join(".local/bin"),
        home.join(".bun/bin"),
        home.join(".npm-global/bin"),
        home.join(".cargo/bin"),
        home.join(".opencode/bin"),
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
    ];
    #[cfg(windows)]
    let extra = [home.join(r".local\bin"), home.join(r"AppData\Roaming\npm"), home.join(r".bun\bin")];
    let exts: &[&str] = if cfg!(windows) { &[".exe", ".cmd"] } else { &[""] };
    let path = std::env::var_os("PATH").unwrap_or_default();
    std::env::split_paths(&path)
        .chain(extra)
        .flat_map(|d| exts.iter().map(move |ext| d.join(format!("{name}{ext}"))))
        .find(|p| executable(p))
}

/// How to run `name`, for the caller to add its arguments to. On Windows the `<name>.cmd` npm (or pnpm) installs runs
/// through cmd.exe, which can't be handed an argument with a line break (Rust refuses one rather than let cmd.exe cut it
/// short), and a message has them: its Node script is run with node instead, when the shim names one.
pub fn command_for(name: &str) -> Option<std::process::Command> {
    find_bin(name).map(|bin| command_at(&bin))
}

/// [`command_for`] for the program at `bin`.
fn command_at(bin: &Path) -> std::process::Command {
    #[cfg(windows)]
    if bin.extension().is_some_and(|e| e.eq_ignore_ascii_case("cmd"))
        && let Some(dir) = bin.parent()
        && let Some((node, script)) = std::fs::read_to_string(bin).ok().and_then(|shim| node_shim(&shim, dir))
    {
        let mut command = std::process::Command::new(node);
        command.args(script);
        return command;
    }
    std::process::Command::new(bin)
}

/// Node and the script an npm or pnpm `.cmd` shim in `dir` runs (`"%dp0%\\node_modules\\…\\codex.js" %*`): the node
/// beside the shim if there is one, as the shim itself prefers, else the one on `PATH`. Only when the shim runs that
/// script with node and nothing else in between (no flags, not bun), and sets nothing in the environment but its own
/// bookkeeping (`dp0`, `_prog`, `PATHEXT`, `NODE_PATH`): any other shim is left to run as it is.
#[cfg(any(windows, test))]
fn node_shim(shim: &str, dir: &Path) -> Option<(PathBuf, Vec<PathBuf>)> {
    let lower = shim.to_ascii_lowercase();
    // Running node directly would skip whatever else the shim sets for it.
    let sets_more = lower.split(['\n', '&', '(']).any(|part| {
        let part = part.trim().trim_start_matches('@');
        let Some(set) = part.strip_prefix("set ").or_else(|| part.strip_prefix("set\t")) else { return false };
        let name = set.trim_start().trim_start_matches('"').split('=').next().unwrap_or_default().trim();
        !["dp0", "_prog", "pathext", "node_path"].contains(&name)
    });
    if sets_more {
        return None;
    }
    let script = shim.match_indices('"').find_map(|(at, _)| {
        let part = shim[at + 1..].split('"').next()?;
        let rest = part.strip_prefix("%dp0%\\").or_else(|| part.strip_prefix("%~dp0\\"))?;
        let ext = rest.to_ascii_lowercase();
        if ![".js", ".cjs", ".mjs"].iter().any(|e| ext.ends_with(e)) {
            return None;
        }
        // What runs it: npm's `"%_prog%"` (node beside the shim, else `node`), node.exe, or plain `node`.
        let before = lower[..at].rsplit(['\n', '&', '(']).next()?.trim();
        let by_node = (before.ends_with("\"%_prog%\"") && lower.contains("_prog=node\""))
            || before.ends_with("\\node.exe\"")
            || before.trim_start_matches('@') == "node";
        by_node.then(|| rest.split(['\\', '/']).fold(dir.to_path_buf(), |p, c| p.join(c)))
    })?;
    if !script.is_file() {
        return None;
    }
    let beside = dir.join("node.exe");
    let node = if beside.is_file() { beside } else { find_bin("node")? };
    Some((node, vec![script]))
}

#[cfg(unix)]
fn executable(p: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    p.metadata().is_ok_and(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
}

#[cfg(windows)]
fn executable(p: &Path) -> bool {
    p.is_file()
}

pub fn session_from_hooks(agent: &str) -> bool {
    matches!(agent, "gemini" | "cmd")
}

/// The agent process we serve, as [`hook_agent_pid`] finds it for a hook: found once (each step up can run `ps`).
pub fn agent_process() -> Option<u32> {
    static PID: std::sync::OnceLock<Option<u32>> = std::sync::OnceLock::new();
    *PID.get_or_init(hook_agent_pid)
}

/// The agent process behind a hook: our parent, skipping the shell some agents run hooks through.
pub fn hook_agent_pid() -> Option<u32> {
    let mut pid = util::parent_pid();
    for _ in 0..3 {
        let (ppid, name) = util::process(pid)?;
        if !matches!(name.as_str(), "sh" | "bash" | "zsh" | "fish" | "dash" | "ksh" | "cmd" | "powershell" | "pwsh") {
            return Some(pid);
        }
        pid = ppid;
    }
    Some(pid)
}

pub fn short(agent: &str) -> &str {
    match agent {
        CLAUDE_CODE | "claude-
```

### Core Architecture Module: `src/antigravity.rs`
```
//! The App launches this sidecar with agentapi on PATH. Mail arrives over the existing daemon event stream.
use crate::{agent, client::Link, proto::*, util};
use anyhow::{Context, Result};
use serde_json::Value;
use std::{process::Stdio, time::Duration};
use tokio::{sync::mpsc, task::JoinSet};

pub fn app_transcript(path: &str) -> bool {
    path.replace('\\', "/").contains("/.gemini/antigravity/brain/")
}

pub async fn run() -> Result<()> {
    agent::command_for("agentapi").context("Antigravity must launch this sidecar with agentapi on PATH")?;
    let (tx, mut events) = mpsc::unbounded_channel();
    let link = Link::new(Some(tx));
    let mut heartbeat = tokio::time::interval(Duration::from_secs(5));
    let mut deliveries = JoinSet::new();
    loop {
        tokio::select! {
            _ = heartbeat.tick() => {
                // Reattaches after daemon restart, discovers newly opened conversations, and retries failed handoffs.
                if link.call::<Value>(Request::AntigravityAttach).await.is_err() {
                    eprintln!("Reason Network: waiting for the local delivery service");
                }
            }
            Some(Event::Deliver { key, ids, text }) = events.recv() => {
                let link = link.clone();
                deliveries.spawn(async move {
                    let Some(id) = key.strip_prefix("antigravity:") else { return };
                    let Some(command) = agent::command_for("agentapi") else {
                        let _ = link.call::<Value>(Request::PushFailed {key,ids}).await;
                        return;
                    };
                    let result = tokio::time::timeout(Duration::from_secs(30),
                        util::no_window(tokio::process::Command::from(command))
                            .args(["send-message", id, &text]).stdin(Stdio::null())
                            .stdout(Stdio::null()).stderr(Stdio::null()).kill_on_drop(true).status()).await;
                    let request = if matches!(result, Ok(Ok(status)) if status.success()) {
                        Request::Delivered { key, ids }
                    } else {
                        eprintln!("Reason Network: Antigravity handoff failed; the same messages remain queued");
                        Request::PushFailed { key, ids }
                    };
                    let _ = link.call::<Value>(request).await;
                });
            }
            Some(_) = deliveries.join_next(), if !deliveries.is_empty() => {}
        }
    }
}

```

### Core Architecture Module: `src/bridge.rs`
```
//! JSON-lines local adapter transport. The daemon owns identity, delivery and policy.
use crate::{client::Link, mcp, proto::*, render};
use anyhow::{Result, bail};
use serde::Deserialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
    sync::{Mutex, mpsc},
    task::JoinSet,
};

#[derive(Deserialize)]
struct Call {
    id: u64,
    #[serde(default)]
    paths: Vec<String>,
    #[serde(flatten)]
    request: Request,
}
#[derive(Default)]
struct Session {
    cwd: String,
    received: HashSet<String>,
}
type Sessions = Mutex<HashMap<String, Session>>;

fn parse(line: &str) -> (u64, Result<Call>) {
    let value = match serde_json::from_str::<Value>(line) {
        Ok(value) => value,
        Err(error) => return (0, Err(error.into())),
    };
    let id = value.get("id").and_then(Value::as_u64).unwrap_or(0);
    (id, serde_json::from_value(value).map_err(Into::into))
}

pub async fn run() -> Result<()> {
    let (events, mut incoming) = mpsc::unbounded_channel();
    let link = Link::new(Some(events));
    let sessions = Arc::new(Sessions::default());
    let (output, mut lines) = mpsc::unbounded_channel::<Value>();
    let writer = tokio::spawn(async move {
        let mut stdout = tokio::io::stdout();
        while let Some(value) = lines.recv().await {
            stdout.write_all(format!("{value}\n").as_bytes()).await?;
            stdout.flush().await?;
        }
        anyhow::Ok(())
    });
    let event_output = output.clone();
    let event_sessions = sessions.clone();
    let event_task = tokio::spawn(async move {
        while let Some(event) = incoming.recv().await {
            let Event::Deliver { key, ids, .. } = &event;
            let mut sessions = event_sessions.lock().await;
            let Some(session) = sessions.get_mut(key) else { continue };
            session.received.extend(ids.iter().cloned());
            drop(sessions);
            if event_output.send(serde_json::to_value(event)?).is_err() {
                break;
            }
        }
        anyhow::Ok(())
    });
    let mut input = BufReader::new(tokio::io::stdin());
    let mut calls = JoinSet::new();
    loop {
        // Messages are limited to 64 KiB; a generous frame cap also accommodates JSON escaping.
        let mut line = String::new();
        let read = (&mut input).take(1024 * 1024 + 1).read_line(&mut line).await?;
        if read == 0 {
            break;
        }
        if read > 1024 * 1024 {
            bail!("adapter frame exceeds 1 MiB");
        }
        let (parsed_id, parsed) = parse(&line);
        let (link, sessions, output) = (link.clone(), sessions.clone(), output.clone());
        calls.spawn(async move {
            let (id, result) = match parsed {
                Ok(call) => (call.id, dispatch(&link, &sessions, call).await),
                Err(error) => (parsed_id, Err(error)),
            };
            let reply = match result {
                Ok(value) => Reply::ok(id, value),
                Err(error) => Reply::err(id, failure(error)),
            };
            let _ = output.send(serde_json::to_value(reply).unwrap());
        });
        while calls.try_join_next().is_some() {}
    }
    calls.abort_all();
    while calls.join_next().await.is_some() {}
    event_task.abort();
    let _ = event_task.await;
    drop(output);
    writer.await??;
    Ok(())
}

/// An error as the agent reads it: a teammate's name in it can't open or close a message frame, as with `mcp`'s.
fn failure(e: anyhow::Error) -> anyhow::Error {
    anyhow::anyhow!(render::defang(&plugin_tools(&format!("{e:#}"))))
}

/// The MCP tool names in an engine error, as the plugin's tools (`list_team` is `reason_network_list_agents`). Not
/// where one is part of a name or path the error quotes (`'send_message-claude'`, `notes/check_inbox.md`).
fn plugin_tools(text: &str) -> String {
    const TOOLS: [(&str, &str); 4] = [
        ("list_team", "reason_network_list_agents"),
        ("send_message", "reason_network_send_message"),
        ("check_inbox", "reason_network_check_inbox"),
        ("ask_user", "reason_network_ask_user"),
    ];
    let part = |c: char| c.is_alphanumeric() || c == '_';
    let joins = |c: Option<char>| c.is_some_and(|c| matches!(c, '/' | '\\' | '\'' | '"' | '-' | '.'));
    let mut out = String::with_capacity(text.len());
    let (mut done, mut at) = (0, 0);
    while let Some(start) = text[at..].find(part).map(|n| at + n) {
        let end = text[start..].find(|c| !part(c)).map_or(text.len(), |n| start + n);
        let mut after = text[end..].chars();
        let next = after.next();
        // A full stop ends a sentence; one followed by more of a word starts an extension.
        let joined = joins(text[..start].chars().next_back())
            || (next != Some('.') && joins(next))
            || (next == Some('.') && after.next().is_some_and(part));
        if !joined && let Some((_, plugin)) = TOOLS.iter().find(|(tool, _)| *tool == &text[start..end]) {
            out.push_str(&text[done..start]);
            out.push_str(plugin);
            done = end;
        }
        at = end;
    }
    out.push_str(&text[done..]);
    out
}

/// The agents with a native adapter on this transport; the rest use the MCP server.
const AGENTS: [&str; 1] = ["hermes"];

async fn dispatch(link: &Arc<Link>, sessions: &Sessions, call: Call) -> Result<Value> {
    let mut request = call.request;
    if let Request::Register { session } = request {
        if !call.paths.is_empty() {
            bail!("paths are only accepted when sending a message");
        }
        // The key is how the daemon tells sessions apart; one under another agent's name would pass for that agent.
        if !AGENTS.contains(&session.agent.as_str()) || !session.key.starts_with(&format!("{}:", session.agent)) {
            bail!("the adapter bridge registers only {} sessions, keyed by their agent", AGENTS.join(", "));
        }
        sessions.lock().await.entry(session.key.clone()).or_default().cwd = session.cwd.clone();
        let registered = match link.register(session.clone()).await {
            Ok(registered) => registered,
            Err(error) => {
                sessions.lock().await.remove(&session.key);
                return Err(error);
            }
        };
        return Ok(serde_json::to_value(registered)?);
    }
    let key = match &request {
        Request::Who { me: Some(key), .. }
        | Request::SetStatus { key, .. }
        | Request::Inbox { key, .. }
        | Request::Unread { key }
        | Request::Ask { key, .. }
        | Request::StopWaiting { key }
        | Request::Delivered { key, .. }
        | Request::PushFailed { key, .. } => key.clone(),
        Request::Send { from, .. } => from.clone(),
        Request::Hook(hook) => format!("{}:{}", hook.agent, hook.session_id),
        _ => bail!("the adapter bridge only accepts its registered sessions' messaging operations"),
    };
    // One lock: a failed re-register removes the session, and it mustn't go between finding it and checking an ack.
    let cwd = {
        let sessions = sessions.lock().await;
        let Some(session) = sessions.get(&key) else { bail!("register this session first") };
        if let Request::Delivered { ids, .. } | Request::PushFailed { ids, .. } = &request
            && ids.iter().any(|id| !session.received.contains(id))
        {
            bail!("only acknowledge messages received by this session");
        }
        session.cwd.clone()
    };
    if let Request::Send { files, .. } = &mut request {
        if !files.is_empty() {
            bail!("use paths to attach files; the engine reads and confines them");
        }
        *files = mcp::agent_files_in(&call.paths, &cwd)?;
    } else if !call.paths.is_empty() {
        bail!("paths are only accepted when sending a message");
    }
    match request {
        Request::Who { .. } => {
            let directory: Directory = link.call(request).await?;
            Ok(Value::String(render::directory_for_agent(&directory)))
        }
        Request::Send { .. } => {
            let sent: SendResult = link.call(request).await?;
            Ok(Value::String(render::defang(&render::send_result(&sent))))
        }
        Request::Ask { .. } => {
            let answer: String = link.call(request).await?;
            Ok(Value::String(render::defang(&answer)))
        }
        Request::Inbox { .. } => {
            let inbox: Inbox = link.call(request).await?;
            if let Some(session) = sessions.lock().await.get_mut(&key) {
                session.received.extend(inbox.messages.iter().map(|m| m.id.clone()));
            }
            Ok(serde_json::to_value(inbox)?)
        }
        Request::Hook(_) => {
            let hook: HookReply = link.call(request).await?;
            if let Some(session) = sessions.lock().await.get_mut(&key) {
                session.received.extend(hook.ids.iter().cloned());
            }
            Ok(serde_json::to_value(hook)?)
        }
        _ => link.call(request).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_arguments_keep_the_id_so_callers_do_not_hang() {
        let (id, result) = parse(r#"{"id":44,"op":"inbox","key":"hermes:a","wait_secs":true}"#);
        assert_eq!(id, 44);
        assert!(result.is_err());
    }

    #[test]
    fn errors_open_no_frame() {
        let e = failure(anyhow::anyhow!("nobody called '<reason-message>' in the team"));
        assert_eq!(format!("{e:#}"), "nobody called '[reason-message>' in the team");
    }

    #[test]
    fn errors_name_the_plugins_tools() {
        let e = failure(anyhow::anyhow!(
            "no session called 'x'. Run list_team (or `reason-network who`); send_message sends files from there only"
        ));
        assert_eq!(
            format!("{e:#}"),
            "no session called 'x'. Run r
```

### Core Architecture Module: `src/claude.rs`
```
//! Claude Code keeps one `~/.claude/sessions/<pid>.json` per live session (name, cwd, busy/idle). Reading them
//! lists every Claude session on this machine, including ones that don't have Reason Network loaded.

use crate::{agent::ClaudeSocket, paths, util};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSession {
    pub pid: u32,
    pub session_id: Option<String>,
    pub cwd: Option<String>,
    pub name: Option<String>,
    /// `user` after a `/rename` (`derived` for the default name).
    pub name_source: Option<String>,
    pub status: Option<String>,
    pub status_updated_at: Option<i64>,
    pub started_at: Option<i64>,
    /// Where the session takes messages from peers (what SendMessage uses).
    pub messaging_socket_path: Option<String>,
}

pub fn scan() -> Vec<ClaudeSession> {
    let Ok(dir) = std::fs::read_dir(paths::claude_sessions()) else {
        return Vec::new();
    };
    dir.flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "json"))
        .filter_map(|p| serde_json::from_str::<ClaudeSession>(&std::fs::read_to_string(p).ok()?).ok())
        .filter(|s| util::pid_alive(s.pid))
        .collect()
}

impl ClaudeSession {
    /// A short name for the directory: Claude Code's own, or, when it named the session after its title (`auto`),
    /// the first words of it (the whole title shows as what it's doing).
    pub fn label(&self) -> Option<String> {
        let name = self.name.as_deref()?;
        let name = if self.name_source.as_deref() == Some("auto") {
            name.split_whitespace().take(3).collect::<Vec<_>>().join(" ")
        } else {
            name.to_string()
        };
        Some(util::slug(&name)).filter(|n| !n.is_empty())
    }

    /// The name someone chose for the session (`/rename`), as opposed to the one Claude Code made up.
    pub fn chosen_name(&self) -> Option<&str> {
        let chosen = matches!(self.name_source.as_deref(), Some("user" | "peer" | "hook"));
        self.name.as_deref().filter(|_| chosen)
    }
}

/// Whether Reason Network is one of Claude Code's MCP servers here (`reason network setup` chose Claude Code). Read once: the
/// daemon restarts after setup.
pub fn wired() -> bool {
    static WIRED: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *WIRED.get_or_init(|| {
        let file = match std::env::var_os("CLAUDE_CONFIG_DIR") {
            Some(dir) => std::path::PathBuf::from(dir).join(".claude.json"),
            None => paths::user_home().join(".claude.json"),
        };
        std::fs::read(file)
            .ok()
            .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
            .is_some_and(|v| v["mcpServers"][crate::AGENT_NAME].is_object())
    })
}

const HELD: &str = "held by Claude Code for its user's approval: the session skips permission prompts and has no \
                    `reason-network mcp` of its own (restart it, or turn the server on in /mcp, and it takes messages \
                    straight away)";

/// What to tell the sender of a message posted straight into a Claude Code session, when Claude Code will hold it. A
/// session without a `reason-network mcp` of its own (open before setup, or its server turned off or crashed) can't
/// post with its own token, so the post reaches it as a stranger's, and a session that skips permission prompts holds
/// those for its user unless `crossSessionInbound` is `accept`. `None`: not known to be held (the mode is not in its
/// transcript).
pub fn held_note(session: Option<&str>) -> Option<&'static str> {
    let mode = permission_mode(&crate::doing::claude_transcript(session?)?)?;
    held_by(&mode, inbound_setting().as_deref()).then_some(HELD)
}

fn held_by(mode: &str, setting: Option<&str>) -> bool {
    mode == "bypassPermissions" && setting != Some("accept")
}

/// `crossSessionInbound` in the user's own `settings.json`, if set. Managed settings and a session's `--settings`
/// take precedence over it and are not read, so a session can differ.
fn inbound_setting() -> Option<String> {
    let text = std::fs::read_to_string(paths::claude_dir().join("settings.json")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    v["crossSessionInbound"].as_str().map(str::to_string)
}

/// The permission mode a session's transcript last records (Claude Code writes it with the session's entries).
fn permission_mode(transcript: &std::path::Path) -> Option<String> {
    use std::io::{Read, Seek, SeekFrom};
    let mut file = std::fs::File::open(transcript).ok()?;
    let len = file.metadata().ok()?.len();
    file.seek(SeekFrom::Start(len.saturating_sub(2 << 20))).ok()?;
    let mut tail = Vec::new();
    file.read_to_end(&mut tail).ok()?;
    // The first line may be cut by the seek; it just doesn't parse.
    tail.split(|&b| b == b'\n').rev().find_map(|line| {
        let v: serde_json::Value = serde_json::from_slice(line).ok()?;
        v.get("permissionMode")?.as_str().map(str::to_string)
    })
}

/// The messaging socket of a live session, by its id or process.
pub fn socket_for(session_id: Option<&str>, pid: Option<u32>) -> Option<ClaudeSocket> {
    let c = scan().into_iter().find(|c| {
        (session_id.is_some() && c.session_id.as_deref() == session_id) || (pid.is_some() && Some(c.pid) == pid)
    })?;
    Some(ClaudeSocket { path: c.messaging_socket_path?.into(), token: peer_token(c.pid) })
}

/// The token a session's messaging socket wants from its peers, which Claude Code asks for on Windows only. It
/// leaves it for them in `~/.claude/sessions/<pid>.<hash>.key`.
pub fn peer_token(pid: u32) -> Option<String> {
    if !cfg!(windows) {
        return None;
    }
    let prefix = format!("{pid}.");
    std::fs::read_dir(paths::claude_sessions()).ok()?.flatten().find_map(|e| {
        let name = e.file_name().into_string().ok()?;
        if !name.starts_with(&prefix) || !name.ends_with(".key") {
            return None;
        }
        let v: serde_json::Value = serde_json::from_slice(&std::fs::read(e.path()).ok()?).ok()?;
        v["peerToken"].as_str().map(str::to_string)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn held_only_when_the_session_skips_prompts_and_the_setting_doesnt_accept() {
        assert!(held_by("bypassPermissions", None));
        assert!(held_by("bypassPermissions", Some("hold")));
        assert!(!held_by("bypassPermissions", Some("accept")));
        assert!(!held_by("auto", None));
        assert!(!held_by("default", Some("hold")));
    }

    #[test]
    fn the_last_permission_mode_in_the_transcript_counts() {
        let dir = std::env::temp_dir().join(format!("reason-network-mode-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("session.jsonl");
        let lines = [
            r#"{"type":"user","permissionMode":"bypassPermissions","message":"a"}"#,
            r#"{"type":"assistant","message":"no mode here"}"#,
            r#"{"type":"permission-mode","permissionMode":"auto"}"#,
            r#"{"type":"assistant","message":"still no mode"}"#,
        ];
        std::fs::write(&path, lines.join("\n") + "\n").unwrap();
        assert_eq!(permission_mode(&path).as_deref(), Some("auto"));
        std::fs::write(&path, "not json\n{\"type\":\"user\"}\n").unwrap();
        assert_eq!(permission_mode(&path), None, "no mode recorded");
        assert_eq!(permission_mode(&dir.join("missing.jsonl")), None);
        let _ = std::fs::remove_dir_all(&dir);
    }
}

```

### Core Architecture Module: `src/client.rs`
```
//! Connection to the local daemon, starting it if needed. Long-lived clients (`reason-network mcp`) reconnect on their
//! own and re-register their sessions, so a daemon restart is invisible to the agent.

use crate::{ipc, paths, proto::*};
use anyhow::{Result, anyhow, bail};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::{
    collections::HashMap,
    process::{Command, Stdio},
    sync::{
        Arc, Mutex, Weak,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::Duration,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    sync::{mpsc, oneshot},
};

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Reply>>>>;

#[derive(Clone)]
struct Conn {
    tx: mpsc::UnboundedSender<String>,
    pending: Pending,
    alive: Arc<AtomicBool>,
    /// The last failure the daemon answered with no request's id: an older daemon can't read a request it doesn't
    /// know, and says so this way. Told to a call that then gets no answer.
    unmatched: Arc<Mutex<Option<String>>>,
}

/// How long a call waits for the daemon's answer, at most: an older daemon never answers a request it doesn't know
/// (it fails it under no id), and the caller mustn't wait for good. Calls that wait on purpose get that long, and more.
fn patience(req: &Request) -> Duration {
    match req {
        // Up to 10 minutes each, for a message or the person's answer.
        Request::Inbox { .. } | Request::Ask { .. } => Duration::from_secs(660),
        // Over the network.
        Request::CreateTeam { .. }
        | Request::Join { .. }
        | Request::Invite { .. }
        | Request::Link { .. }
        | Request::Remove { .. }
        | Request::Leave { .. }
        | Request::SetRelay { .. }
        | Request::Proof { .. } => Duration::from_secs(600),
        _ => Duration::from_secs(120),
    }
}

pub struct Link {
    conn: tokio::sync::Mutex<Option<Conn>>,
    regs: Mutex<HashMap<String, SessionReg>>,
    /// Where pushed events go. `None` for one-shot clients, which also don't reconnect.
    events: Option<mpsc::UnboundedSender<Event>>,
    next_id: AtomicU64,
    /// Start the daemon when it isn't running.
    start: bool,
}

impl Link {
    pub fn new(events: Option<mpsc::UnboundedSender<Event>>) -> Arc<Self> {
        Self::with(events, true)
    }

    /// A one-shot client that never starts the daemon: it fails while none is running.
    pub fn existing() -> Arc<Self> {
        Self::with(None, false)
    }

    fn with(events: Option<mpsc::UnboundedSender<Event>>, start: bool) -> Arc<Self> {
        Arc::new(Link { conn: Default::default(), regs: Default::default(), events, next_id: AtomicU64::new(1), start })
    }

    pub async fn call<T: DeserializeOwned>(self: &Arc<Self>, req: Request) -> Result<T> {
        let conn = self.connect().await?;
        let v = self.raw(&conn, &req).await?;
        Ok(serde_json::from_value(v)?)
    }

    pub async fn register(self: &Arc<Self>, reg: SessionReg) -> Result<Registered> {
        let r = self.call(Request::Register { session: reg.clone() }).await?;
        remember(&mut self.regs.lock().unwrap(), reg);
        Ok(r)
    }

    /// How a registered session was said to be reached.
    pub fn registered_tier(&self, key: &str) -> Option<Tier> {
        self.regs.lock().unwrap().get(key).map(|r| r.tier)
    }

    async fn raw(&self, conn: &Conn, req: &Request) -> Result<Value> {
        self.raw_within(conn, req, patience(req)).await
    }

    async fn raw_within(&self, conn: &Conn, req: &Request, patience: Duration) -> Result<Value> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        conn.pending.lock().unwrap().insert(id, tx);
        let line = serde_json::to_string(&Frame { id, body: req })?;
        conn.tx.send(line).map_err(|_| anyhow!("network daemon connection closed"))?;
        let reply = match tokio::time::timeout(patience, rx).await {
            Ok(reply) => reply.map_err(|_| anyhow!("network daemon connection closed"))?,
            Err(_) => {
                conn.pending.lock().unwrap().remove(&id);
                let said =
                    conn.unmatched.lock().unwrap().take().map(|e| format!(" (it said: {e})")).unwrap_or_default();
                bail!("no answer from the network daemon in {}s{said}; is it an older version?", patience.as_secs())
            }
        };
        if reply.ok {
            Ok(reply.result.unwrap_or(Value::Null))
        } else {
            bail!(reply.error.unwrap_or_else(|| "unknown error".into()))
        }
    }

    async fn connect(self: &Arc<Self>) -> Result<Conn> {
        let mut slot = self.conn.lock().await;
        if let Some(c) = slot.as_ref()
            && c.alive.load(Ordering::Relaxed)
        {
            return Ok(c.clone());
        }
        let c = self.spawn_io(connect_or_start(self.start).await?);
        let regs: Vec<SessionReg> = self.regs.lock().unwrap().values().cloned().collect();
        for reg in regs {
            if let Err(e) = self.raw(&c, &Request::Register { session: reg.clone() }).await {
                // Its folder was turned off meanwhile: it stays off, and the rest reconnect.
                if e.to_string() != crate::config::OFF_HERE {
                    return Err(e);
                }
                self.regs.lock().unwrap().remove(&reg.key);
            }
        }
        *slot = Some(c.clone());
        Ok(c)
    }

    fn spawn_io(self: &Arc<Self>, stream: ipc::Stream) -> Conn {
        let (rd, mut wr) = tokio::io::split(stream);
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        let conn = Conn {
            tx,
            pending: Pending::default(),
            alive: Arc::new(AtomicBool::new(true)),
            unmatched: Default::default(),
        };
        tokio::spawn(async move {
            while let Some(mut line) = rx.recv().await {
                line.push('\n');
                if wr.write_all(line.as_bytes()).await.is_err() {
                    break;
                }
            }
        });
        let (reader, alive, events, link) =
            (conn.clone(), conn.alive.clone(), self.events.clone(), Arc::downgrade(self));
        let pending = conn.pending.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(rd).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                reader.dispatch(&line, events.as_ref());
            }
            alive.store(false, Ordering::Relaxed);
            pending.lock().unwrap().clear();
            if events.is_some() {
                tokio::spawn(reconnect(link));
            }
        });
        conn
    }
}

impl Conn {
    /// A line from the daemon: an event, or the reply to a call, which it hands over.
    fn dispatch(&self, line: &str, events: Option<&mpsc::UnboundedSender<Event>>) {
        let Ok(v) = serde_json::from_str::<Value>(line) else { return };
        if v.get("event").is_some() {
            if let (Some(events), Ok(ev)) = (events, serde_json::from_value::<Event>(v)) {
                let _ = events.send(ev);
            }
            return;
        }
        let Ok(reply) = serde_json::from_value::<Reply>(v) else { return };
        match self.pending.lock().unwrap().remove(&reply.id) {
            Some(tx) => {
                let _ = tx.send(reply);
            }
            None if !reply.ok => *self.unmatched.lock().unwrap() = reply.error,
            None => {}
        }
    }
}

async fn reconnect(link: Weak<Link>) {
    // Backs off: every agent session runs one of these, and they must not storm a daemon that can't start.
    let mut wait = Duration::from_secs(1);
    loop {
        tokio::time::sleep(wait).await;
        let Some(link) = link.upgrade() else { return };
        match link.connect().await {
            Ok(_) => return,
            Err(e) => eprintln!("reason-network: reconnecting to daemon: {e:#}"),
        }
        wait = (wait * 2).min(Duration::from_secs(30));
    }
}

/// The daemon that holds the lock, if it is alive (it may still be starting).
pub fn running_daemon() -> Option<u32> {
    holder(&paths::lock())
}

/// Who holds the lock at `path`. Asked of the lock, not the pid: a daemon that exited holds none, even when a
/// parent that never reaps (a container's `sleep` as PID 1) leaves it a zombie whose pid still "exists".
fn holder(path: &std::path::Path) -> Option<u32> {
    if !crate::util::locked(path) {
        return None;
    }
    std::fs::read_to_string(path).ok()?.trim().parse().ok()
}

async fn connect_or_start(start: bool) -> Result<ipc::Stream> {
    if let Ok(s) = ipc::connect().await {
        return Ok(s);
    }
    if !start {
        bail!("the network daemon isn't running");
    }
    // One is running (it may be starting or restarting): wait for it rather than start another.
    let mut child = None;
    if running_daemon().is_none() {
        // With the background service installed, the service starts it, so there is only ever its daemon.
        let by_service = crate::setup::service_installed()
            && crate::paths::env_var_os("NO_SERVICE").is_none()
            && crate::setup::start_service();
        if !by_service {
            child = Some(start_daemon(false)?);
        }
    }
    let failed = || anyhow!("could not start the network daemon; see {}", paths::log().display());
    let mut connected = None;
    for _ in 0..100 {
        tokio::time::sleep(Duration::from_millis(50)).await;
        if let Ok(s) = ipc::connect().await {
            connected = Some(s);
            break;
        }
        // It exited: either another daemon got there first (keep waiting for it) or it can't start (give up now).
        if let Some(c) = child.as_mut()
            && c.try_wait().ok().flatten().is_some()
        {
            child = None;
            if running_daemon().is_none() {
                return Err(failed());
           
```

### Core Architecture Module: `src/codex.rs`
```
//! What a Codex thread's rollout (the transcript its hooks name) says about its turn.
//!
//! Codex records each turn's start (`task_started`) and its end: `task_complete` when it finishes or fails,
//! `turn_aborted` when it is interrupted. The last two run no Stop hook, and a single tool call can run for hours
//! without any hook, so only the rollout tells a running turn from one that is over.

use std::{
    collections::HashMap,
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

/// How much is read at a time, from the end back, to find the last turn event.
const CHUNK: u64 = 256 << 10;

/// Whether the turn the rollout at `path` records last is still running. A rollout without a turn yet is idle.
/// `None` when it can't be read. Remembers how far it read, so later calls read only what was appended.
pub fn turn_running(path: &Path) -> Option<bool> {
    static SEEN: OnceLock<Mutex<HashMap<PathBuf, (u64, bool)>>> = OnceLock::new();
    // Only a regular file: opening a pipe a hook named would wait for a writer.
    if !std::fs::metadata(path).ok()?.is_file() {
        return None;
    }
    let mut seen = SEEN.get_or_init(Default::default).lock().unwrap();
    let mut file = File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    // Rollouts only grow: a shorter one was rewritten, and is read again.
    let (from, before) = match seen.get(path) {
        Some(&(at, running)) if at <= len => (at, running),
        _ => (0, false),
    };
    let (end, last) = last_turn_event(&mut file, from, len).ok()?;
    let running = last.unwrap_or(before);
    seen.insert(path.to_path_buf(), (end, running));
    Some(running)
}

/// The last turn event in `from..to` (whole lines from `from`, which starts one), and where the last whole line in it
/// ends: a line still being written is read next time.
fn last_turn_event(file: &mut File, from: u64, to: u64) -> std::io::Result<(u64, Option<bool>)> {
    // `rest`: the pieces of a line that begins in a chunk before, last piece first.
    let (mut end, mut whole_to, mut rest) = (to, None, Vec::<Vec<u8>>::new());
    while end > from {
        let start = end.saturating_sub(CHUNK).max(from);
        let mut buf = vec![0; (end - start) as usize];
        file.seek(SeekFrom::Start(start))?;
        file.read_exact(&mut buf)?;
        if whole_to.is_none() {
            // Up to the last newline: what follows it isn't a whole line yet.
            let Some(i) = buf.iter().rposition(|&b| b == b'\n') else {
                end = start;
                continue;
            };
            whole_to = Some(start + i as u64 + 1);
            buf.truncate(i + 1);
        } else if start > from && !buf.contains(&b'\n') {
            // All of it is inside that line: put the line together once its start is read, not every chunk.
            rest.push(buf);
            end = start;
            continue;
        } else {
            for piece in rest.drain(..).rev() {
                buf.extend_from_slice(&piece);
            }
        }
        // The first line here may begin in the chunk before: keep it for then.
        let first = if start > from { buf.iter().position(|&b| b == b'\n').map_or(buf.len(), |i| i + 1) } else { 0 };
        if let Some(running) = buf[first..].split(|&b| b == b'\n').rev().find_map(turn_event) {
            return Ok((whole_to.unwrap_or(from), Some(running)));
        }
        rest.push(buf[..first].to_vec());
        end = start;
    }
    Ok((whole_to.unwrap_or(from), None))
}

/// Some(true) for a line recording a turn's start, Some(false) for one recording its end.
fn turn_event(line: &[u8]) -> Option<bool> {
    // Most lines are something else: parse only those that may be one.
    let text = std::str::from_utf8(line).ok()?;
    if !text.contains("event_msg") || !["task_", "turn_"].iter().any(|k| text.contains(k)) {
        return None;
    }
    let v: serde_json::Value = serde_json::from_str(text).ok()?;
    if v["type"] != "event_msg" {
        return None;
    }
    match v["payload"]["type"].as_str()? {
        "task_started" | "turn_started" => Some(true),
        "task_complete" | "turn_complete" | "turn_aborted" => Some(false),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn event(kind: &str) -> String {
        format!(r#"{{"timestamp":"t","type":"event_msg","payload":{{"type":"{kind}","turn_id":"1"}}}}"#) + "\n"
    }

    fn append(path: &Path, s: &str) {
        std::fs::OpenOptions::new().create(true).append(true).open(path).unwrap().write_all(s.as_bytes()).unwrap();
    }

    #[test]
    fn the_last_turn_event_says_whether_a_turn_runs() {
        let dir = std::env::temp_dir().join(format!("reason-network-codex-turn-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("rollout.jsonl");
        assert_eq!(turn_running(&path), None, "no rollout");

        append(&path, "{\"type\":\"session_meta\",\"payload\":{}}\n");
        assert_eq!(turn_running(&path), Some(false), "no turn yet");
        append(&path, &event("task_started"));
        assert_eq!(turn_running(&path), Some(true));
        // A message that mentions turn events is not one.
        let quoted = r#"{"type":"response_item","payload":{"text":"\"type\":\"event_msg\" task_complete"}}"#;
        append(&path, &format!("{quoted}\n"));
        append(&path, "{\"type\":\"turn_context\",\"payload\":{\"type\":\"task_complete\",\"note\":\"event_msg\"}}\n");
        append(&path, r#"{"type":"event_msg","payload":{"type":"token_count"}}"#);
        append(&path, "\n");
        assert_eq!(turn_running(&path), Some(true), "only turn events count");
        append(&path, &event("turn_aborted"));
        assert_eq!(turn_running(&path), Some(false), "interrupted");
        append(&path, &event("turn_started"));
        assert_eq!(turn_running(&path), Some(true), "the v2 name");
        append(&path, &event("task_complete"));
        assert_eq!(turn_running(&path), Some(false), "finished or failed");

        // A line still being written counts once it is whole.
        append(&path, &event("task_started"));
        let end = event("task_complete");
        append(&path, &end[..20]);
        assert_eq!(turn_running(&path), Some(true));
        append(&path, &end[20..]);
        assert_eq!(turn_running(&path), Some(false), "the rest of the line was read");

        // Read fresh (a restarted daemon), from far back: the turn started long before the last chunk.
        let fresh = dir.join("long.jsonl");
        append(&fresh, &event("task_complete"));
        append(&fresh, &event("task_started"));
        let output = format!(r#"{{"type":"response_item","payload":{{"output":"{}"}}}}"#, "x".repeat(100_000)) + "\n";
        for _ in 0..12 {
            append(&fresh, &output);
        }
        assert_eq!(turn_running(&fresh), Some(true), "found {} KB back", 12 * 100);
        // One line longer than a chunk, right after the start.
        let fresh2 = dir.join("longline.jsonl");
        append(&fresh2, &event("task_started"));
        append(&fresh2, &(format!(r#"{{"x":"{}"}}"#, "y".repeat(3 * CHUNK as usize)) + "\n"));
        assert_eq!(turn_running(&fresh2), Some(true));

        // A turn event cut by a chunk boundary, read fresh.
        let cut = dir.join("cut.jsonl");
        append(&cut, &event("task_complete"));
        append(&cut, &(format!(r#"{{"x":"{}"}}"#, "z".repeat(CHUNK as usize)) + "\n"));
        append(&cut, &event("task_started"));
        let tail = CHUNK as usize - 10;
        append(&cut, &(format!(r#"{{"x":"{}"}}"#, "w".repeat(tail - 9)) + "\n"));
        assert_eq!(turn_running(&cut), Some(true), "the line across the boundary was put back together");
        // A turn event across four chunks, its type in the middle one, read fresh: its pieces go back in order.
        let spread = dir.join("spread.jsonl");
        append(&spread, &event("task_started"));
        let half = "m".repeat(3 * CHUNK as usize / 2);
        let end = format!(r#"{{"type":"event_msg","payload":{{"a":"{half}","type":"task_complete","b":"{half}"}}}}"#);
        append(&spread, &(end + "\n"));
        assert_eq!(turn_running(&spread), Some(false), "the end, put back together");

        // A pipe is not a rollout, and is not waited on.
        #[cfg(unix)]
        {
            let pipe = dir.join("pipe");
            assert!(std::process::Command::new("mkfifo").arg(&pipe).status().unwrap().success());
            assert_eq!(turn_running(&pipe), None);
        }

        // Rewritten shorter: read again.
        std::fs::write(&path, event("task_started")).unwrap();
        assert_eq!(turn_running(&path), Some(true));
        let _ = std::fs::remove_dir_all(&dir);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #178** (2026-10-30): **fix: distinguish pre-dispatch refusal from uncertain delivery**
  *Symptoms*: A SQLite receipt-write failure can occur after a Network message has been pushed or durably queued. That ordinary error reply was indistinguishable from a refusal before sending, so a relay could retry on another computer and deliver twice.  Add an optional send_not_dispatched error code only when the engine proves a send has no delivery effect. A successful insertion identifies a fresh idempotency key; existing unfinished keys and failed receipt lookups remain uncertain. The marker stops before the first durable-write attempt or notification. Error text and existing team error codes remain compatible. The Reason CLI companion treats unclassified send errors as uncertain.  Bumps the patch release to 0.12.17. No peer wire identifiers, schema migrations, or governance changes.  Verification: 266 tests passed; cargo fmt --check; cargo clippy --all-targets --locked -- -D warnings; git diff --check. Deterministic SQLite triggers prove actual push followed by either receipt-write failure never gets a safe-retry marker, and retrying locally does not push twice. Coverage also distinguishes fresh/pending keys, failed receipt reads, and failures at the first durable write. Independent review found no blockers at 5ca7c298210906344909fc4d4c0bf8841c2be9a1 together with the marker-aware CLI companion. The original post-delivery duplicate-send failure is closed by that combination. 
  **Post-Mortem & Fix Analysis**:
  > <h3>Bugbot needs on-demand usage enabled</h3>  Bugbot uses usage-based billing for this team and requires on-demand usage to be enabled.  A team admin can enable on-demand usage in the [Cursor dashboard](https://www.cursor.com/dashboard/bugbot).  

- **Issue #177** (2026-10-29): **feat: deliver Antigravity messages natively with durable receipts**
  *Symptoms*: Reason Network currently leaves Antigravity conversations on a pull-only integration, and a successful transport send does not tell an agent whether the recipient consumed it. This adds native conversation hooks and an App-managed sidecar using `agentapi send-message`, explicit conversation binding for concurrent chats, durable idempotency and delivery receipts, and Gemini hook/runtime diagnostics. The release version is 0.12.16.  The sidecar uses the existing daemon delivery stream and acknowledges only after the native command accepts the handoff. Failures retain the original message IDs and back off. Explicitly disabled native integrations remain disabled. Bounded health reports contain agent families, capabilities and queue/hook ages, with no message content, project paths or conversation IDs. Peer wire identifiers and encryption are unchanged; remote acceptance is never presented as confirmed agent handoff.  Validation: cargo fmt, clippy with warnings denied, 257 existing Rust tests, the new isolated native-hook/sidecar contract probe (including failed handoff and same-ID retry), and all 9 existing Gemini session-identity checks. Google's App is not installed on the verification machine: native integration was checked against the current vendor hook/MCP/sidecar documentation and an agentapi fixture, not a live Google model conversation. 

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

### Incident Patch 1: `27252c24` (2026-10-25)
**Commit Message**: Hermes bridge: no panic on a racing ack, setup gives up on a hung hermes --version (#147)

Signed-off-by: Lars Talian <[REDACTED_EMAIL]>

**File**: `src/bridge.rs` (modified, +58/-10)
```diff
@@ -103,7 +103,27 @@ pub async fn run() -> Result<()> {
 
 /// An error as the agent reads it: a teammate's name in it can't open or close a message frame, as with `mcp`'s.
 fn failure(e: anyhow::Error) -> anyhow::Error {
-    anyhow::anyhow!(render::defang(&format!("{e:#}")))
+    anyhow::anyhow!(render::defang(&plugin_tools(&format!("{e:#}"))))
+}
+
+/// The MCP tool names in an engine error, as the plugin's tools (`list_team` is `reason_network_list_agents`).
+fn plugin_tools(text: &str) -> String {
+    const TOOLS: [(&str, &str); 4] = [
+        ("list_team", "reason_network_list_agents"),
+        ("send_message", "reason_network_send_message"),
+        ("check_inbox", "reason_network_check_inbox"),
+        ("ask_user", "reason_network_ask_user"),
+    ];
+    let between = |c: char| !(c.is_alphanumeric() || c == '_');
+    text.split_inclusive(between)
+        .map(|piece| {
+            let word = piece.trim_end_matches(between);
+            match TOOLS.iter().find(|(tool, _)| *tool == word) {
+                Some((_, plugin)) => format!("{plugin}{}", &piece[word.len()..]),
+                None => piece.to_string(),
+            }
+        })
+        .collect()
 }
 
 /// The agents with a native adapter on this transport; the rest use the MCP server.
@@ -142,18 +162,17 @@ async fn dispatch(link: &Arc<Link>, sessions: &Sessions, call: Call) -> Result<V
         Request::Hook(hook) => format!("{}:{}", hook.agent, hook.session_id),
         _ => bail!("the adapter bridge only accepts its registered sessions' messaging operations"),
     };
-    let cwd = sessions
-        .lock()
-        .await
-        .get(&key)
-        .map(|s| s.cwd.clone())
-        .ok_or_else(|| anyhow::anyhow!("register this session first"))?;
-    if let Request::Delivered { ids, .. } | Request::PushFailed { ids, .. } = &request {
+    // One lock: a failed re-register removes the session, and it mustn't go between finding it and checking an ack.
+    let cwd = {
         let sessions = sessions.lock().await;
-        if ids.iter().any(|id| !sessions[&key].received.contains(id)) {
+        let Some(session) = sessions.get(&key) else { bail!("register this session first") };
+        if let Request::Delivered { ids, .. } | Request::PushFailed { ids, .. } = &request
+            && ids.iter().any(|id| !session.received.contains(id))
+        {
             bail!("only acknowledge messages received by this session");
         }
-    }
+        session.cwd.clone()
+    };
     if let Request::Send { files, .. } = &mut request {
         if !files.is_empty() {
             bail!("use paths to attach files; the engine reads and confines them");
@@ -209,6 +228,35 @@ mod tests {
         assert_eq!(format!("{e:#}"), "nobody called '[reason-message>' in the team");
     }
 
+    #[test]
+    fn errors_name_the_plugins_tools() {
+        let e = failure(anyhow::anyhow!(
+            "no session called 'x'. Run list_team (or `reason-network who`); send_message sends files from there only"
+        ));
+        assert_eq!(
+            format!("{e:#}"),
+            "no session called 'x'. Run reason_network_list_agents (or `reason-network who`); \
+             reason_network_send_message sends files from there only"
+        );
+        let other = "my_list_team list_teams reason_network_send_message check_inbox: ask_user.";
+        assert_eq!(
+            plugin_tools(other),
+            "my_list_team list_teams reason_network_send_message reason_network_check_inbox: reason_network_ask_user."
+        );
+    }
+
+    #[tokio::test]
+    async fn acks_only_for_a_registered_session_and_its_own_mail() {
+        let link = Arc::new(Link::new(None));
+        let sessions = Sessions::default();
+        let ack = |key: &str| parse(&format!(r#"{{"id":1,"op":"delivered","key":"{key}","ids":["m1"]}}"#)).1.unwrap();
+        let error = dispatch(&link, &sessions, ack("hermes:a")).await.unwrap_err();
+        assert!(error.to_string().contains("register this session first"), "{error:#}");
+        sessions.lock().await.insert("hermes:a".into(), Session::default());
+        let error = dispatch(&link, &sessions, ack("hermes:a")).await.unwrap_err();
+        assert!(error.to_string().contains("only acknowledge messages received"), "{error:#}");
+    }
+
     #[tokio::test]
     async fn only_hermes_sessions_under_their_own_key_register() {
         let link = Arc::new(Link::new(None));
```

**File**: `src/setup.rs` (modified, +8/-8)
```diff
@@ -1206,14 +1206,6 @@ fn me(exe: &Path) -> String {
 }
 
 const AGENTS: [Agent; 12] = [
-    Agent {
-        id: "hermes",
-        name: "Hermes",
-        hint: "native plugin; enable it in each Hermes profile",
-        installed: hermes::installed,
-        wired: hermes::wired,
-        apply: hermes::apply,
-    },
     Agent {
         id: "claude",
         name: "Claude Code",
@@ -1317,6 +1309,14 @@ const AGENTS: [Agent; 12] = [
         wired: |_| Config::load().reason,
         apply: reason,
     },
+    Agent {
+        id: "hermes",
+        name: "Hermes",
+        hint: "native plugin; enable it in each Hermes profile",
+        installed: hermes::installed,
+        wired: hermes::wired,
+        apply: hermes::apply,
+    },
 ];
 
 /// The agents wired to the tincan binary beside `exe`, which move over to it.
```

**File**: `src/setup/hermes.rs` (modified, +40/-3)
```diff
@@ -43,9 +43,31 @@ fn source() -> Option<PathBuf> {
     if bundled.join("hermes_cli").is_dir() {
         return Some(bundled);
     }
-    let out =
-        Command::new(agent::find_bin("hermes")?).arg("--version").stdin(std::process::Stdio::null()).output().ok()?;
-    String::from_utf8_lossy(&out.stdout)
+    let mut version = Command::new(agent::find_bin("hermes")?);
+    version.arg("--version");
+    install_dir(version)
+}
+
+/// The `Install directory:` a Hermes command reports, waiting at most a few seconds for it.
+fn install_dir(mut command: Command) -> Option<PathBuf> {
+    let mut child = command
+        .stdin(std::process::Stdio::null())
+        .stdout(std::process::Stdio::piped())
+        .stderr(std::process::Stdio::null())
+        .spawn()
+        .ok()?;
+    let mut stdout = child.stdout.take()?;
+    let (tx, rx) = std::sync::mpsc::channel();
+    std::thread::spawn(move || {
+        let mut out = Vec::new();
+        let _ = std::io::Read::read_to_end(&mut stdout, &mut out);
+        let _ = tx.send(out);
+    });
+    // A Hermes that hangs on `--version` (or leaves something holding its output) mustn't hang setup, init and join.
+    let out = rx.recv_timeout(std::time::Duration::from_secs(5));
+    let _ = child.kill();
+    let _ = child.wait();
+    String::from_utf8_lossy(&out.ok()?)
         .lines()
         .find_map(|l| l.trim().strip_prefix("Install directory:"))
         .map(|p| PathBuf::from(p.trim()))
@@ -178,6 +200,21 @@ mod tests {
         std::env::temp_dir().join(format!("reason-hermes-{}", ulid::Ulid::generate()))
     }
 
+    #[cfg(unix)]
+    #[test]
+    fn a_hermes_that_hangs_on_version_does_not_hang_setup() {
+        let sh = |script: &str| {
+            let mut c = Command::new("sh");
+            c.args(["-c", script]);
+            c
+        };
+        assert_eq!(install_dir(sh("echo 'Install directory: /opt/hermes'")), Some(PathBuf::from("/opt/hermes")));
+        let started = std::time::Instant::now();
+        // The shell's `sleep` keeps the output open after the shell itself is killed.
+        assert_eq!(install_dir(sh("echo 'Install directory: /opt/hermes'; sleep 30")), None);
+        assert!(started.elapsed() < std::time::Duration::from_secs(15), "{:?}", started.elapsed());
+    }
+
     #[test]
     fn install_and_remove_are_idempotent_and_never_rewrite_config() {
         let root = temp();
```

---

### Incident Patch 2: `690f0718` (2026-10-23)
**Commit Message**: A fixed UDP port for direct connections, set per machine (#127)

Optional per-machine config key `port` (e.g. `port = 41641`), bound on IPv4 and IPv6, so a router can forward one UDP port for direct connections. If it can't be bound, the daemon logs it and uses a random port; `reason-network doctor` shows the port in use. The daemon logs direct/relay path changes. The default stays random and the relay is unchanged. Closes #124.

Signed-off-by: Lars Talian <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +13/-0)
```diff
@@ -96,6 +96,19 @@ Teammates see your name, your computers, and what your agent sessions are workin
 Signed in with Reason, your name shows as verified: Reason signs that the computer is yours, every teammate's computer
 checks that itself, and nobody else can take the name. State lives in `~/.reason/network`. Details: [DESIGN.md](DESIGN.md).
 
+Direct connections use a random UDP port each time the daemon starts. To open or forward one port in a firewall or
+router instead, set it in `~/.reason/network/config.toml` (per computer; the daemon reads it when it starts):
+
+```toml
+port = 41641
+```
+
+Put `port` at the top of the file, above any `[table]` section such as `[inbound]`. The daemon ignores it under a table.
+
+It is bound on IPv4 and IPv6 (IPv4 alone on a computer without IPv6). If another program holds it on either, the
+daemon logs that and uses a random port, as without it; `port = 0` is the same as leaving it out.
+`reason-network doctor` shows the port in use. Relays work the same either way.
+
 ## Uninstall
 
 ```sh
```

**File**: `src/config.rs` (modified, +26/-0)
```diff
@@ -20,6 +20,10 @@ pub struct Config {
     pub reason: bool,
     /// Install new releases when they come out (the daemon checks every few hours).
     pub auto_update: bool,
+    /// The UDP port teammates reach this machine on directly, e.g. `41641` for a firewall or router rule. None: a
+    /// random one each start. Taken by something else, a random one is used.
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub port: Option<u16>,
     pub inbound: Inbound,
     /// Folders whose sessions stay off the network, e.g. `"~/personal" = "off"` (`reason-network folder`). The deepest
     /// entry that holds a session's folder decides; `off` is the only value so far.
@@ -63,6 +67,7 @@ impl Default for Config {
             tray: true,
             reason: false,
             auto_update: true,
+            port: None,
             inbound: Inbound::default(),
             folders: BTreeMap::new(),
         }
@@ -115,6 +120,11 @@ impl Config {
         self.lan && crate::paths::env_var_os("NO_MDNS").is_none()
     }
 
+    /// The fixed UDP port, if one is set; `0` (any port) is the same as none.
+    pub fn port(&self) -> Option<u16> {
+        self.port.filter(|&p| p != 0)
+    }
+
     pub fn tray(&self) -> bool {
         cfg!(target_os = "macos") && self.tray && crate::paths::env_var_os("NO_TRAY").is_none()
     }
@@ -315,6 +325,22 @@ mod tests {
         assert!(parsed.off_in(&format!("{}/personal/x", home())));
     }
 
+    #[test]
+    fn a_fixed_port_is_optional() {
+        let parsed: Config = toml::from_str("lan = true\n").unwrap();
+        assert_eq!(parsed.port, None);
+        assert!(!toml::to_string_pretty(&parsed).unwrap().contains("port"), "unset: not written");
+        let parsed: Config = toml::from_str("port = 41641\n").unwrap();
+        assert_eq!(parsed.port, Some(41641));
+        assert!(toml::to_string_pretty(&parsed).unwrap().contains("port = 41641"));
+        assert_eq!(parsed.port(), Some(41641));
+        let parsed: Config = toml::from_str("port = 0\n").unwrap();
+        assert_eq!(parsed.port(), None, "0: random, as unset");
+        for bad in ["port = 70000", "port = -1", "port = \"41641\""] {
+            assert!(toml::from_str::<Config>(bad).is_err(), "{bad}");
+        }
+    }
+
     fn temp() -> std::path::PathBuf {
         let d = std::env::temp_dir().join(format!("reason-network-folders-{}", ulid::Ulid::generate()));
         std::fs::create_dir_all(d.join("real").join("personal").join("sub")).unwrap();
```

**File**: `src/daemon/teamops.rs` (modified, +4/-1)
```diff
@@ -80,7 +80,7 @@ impl Daemon {
         let team = self.team_state().ok_or_else(|| anyhow!("not in a team"))?;
         self.stop_net_now().await;
         let relay = team.meta.body.relay.as_deref();
-        let endpoint = net::bind(self.key.clone(), relay, self.cfg.lan()).await?;
+        let endpoint = net::bind(self.key.clone(), relay, self.cfg.lan(), self.cfg.port()).await?;
         // Last known presence of each machine, so `who --all` shows offline teammates after a restart.
         let mut remote = HashMap::new();
         {
@@ -251,6 +251,7 @@ impl Daemon {
             machines: Vec::new(),
             features: vec![crate::files::FEATURE.into()],
             messages: Vec::new(),
+            udp: None,
         })
     }
 
@@ -368,6 +369,7 @@ impl Daemon {
             machines: Vec::new(),
             features: vec![crate::files::FEATURE.into()],
             messages: Vec::new(),
+            udp: None,
         };
         {
             let mut g = self.inner.lock().unwrap();
@@ -510,6 +512,7 @@ impl Daemon {
             machines: self.machines(),
             features: vec![crate::files::FEATURE.into()],
             messages: self.inner.lock().unwrap().store.counts(util::now_ms()).unwrap_or_default(),
+            udp: self.net().map(|n| n.udp()),
         })
     }
 
```

**File**: `src/main.rs` (modified, +1/-0)
```diff
@@ -917,6 +917,7 @@ mod tests {
             machines: vec![me],
             features: vec![],
             messages: vec![],
+            udp: None,
         };
         let l = LinkInfo { team: "vibes".into(), url: join_url("rn1-AAAA"), ticket: "rn1-AAAA".into() };
         assert!(team_value(&t, &l, None).unwrap_err().to_string().contains("restart the Reason Network daemon"));
```

**File**: `src/net.rs` (modified, +166/-27)
```diff
@@ -4,7 +4,7 @@
 
 use crate::{
     daemon::Daemon,
-    proto::{Message, SessionInfo},
+    proto::{Message, SessionInfo, UdpPort},
     team::TeamState,
     util,
 };
@@ -13,13 +13,14 @@ use futures_lite::{StreamExt, stream::Boxed};
 use iroh::{
     Endpoint, EndpointAddr, EndpointId, RelayMode, RelayUrl, SecretKey, Watcher,
     address_lookup::{self, AddressLookup, EndpointData, EndpointInfo, Item},
-    endpoint::{ConnectError, ConnectWithOptsError, Connection, RecvStream, SendStream, presets},
+    endpoint::{Builder, ConnectError, ConnectWithOptsError, Connection, RecvStream, SendStream, presets},
     protocol::{AcceptError, ProtocolHandler, Router},
 };
 use iroh_mdns_address_lookup::MdnsAddressLookup;
 use serde::{Deserialize, Serialize, de::DeserializeOwned};
 use std::{
     collections::{HashMap, HashSet},
+    net::{Ipv4Addr, Ipv6Addr},
     sync::{
         Arc, Mutex, Weak,
         atomic::{AtomicU64, Ordering},
@@ -130,6 +131,7 @@ pub struct Net {
     proxy: Option<RelayUrl>,
     /// The proxy's address as looked up for the endpoint.
     at: Option<RelayUrl>,
+    udp: UdpPort,
     router: Mutex<Option<Router>>,
     /// Endpoints listening for joins on behalf of invite codes, by their (code-derived) id.
     invites: Mutex<HashMap<EndpointId, Router>>,
@@ -208,13 +210,15 @@ pub struct Bound {
     pub endpoint: Endpoint,
     proxy: Option<RelayUrl>,
     at: Option<RelayUrl>,
+    udp: UdpPort,
 }
 
 /// An endpoint on the team's own relay (`relay`) or the default ones, the way that last got through, at once. A
-/// running network that stays off its relays tries the other way itself (see `route_loop`).
-pub async fn bind(key: SecretKey, relay: Option<&str>, lan: bool) -> Result<Bound> {
+/// running network that stays off its relays tries the other way itself (see `route_loop`). On UDP `port` if one is
+/// set and free (the network's own endpoint; anything else would take it from that one).
+pub async fn bind(key: SecretKey, relay: Option<&str>, lan: bool, port: Option<u16>) -> Result<Bound> {
     let relays = relays_for(relay).await?;
-    endpoint(&key, &relays, relay.is_some(), lan, route(&relays)).await
+    endpoint(&key, &relays, relay.is_some(), lan, route(&relays), port).await
 }
 
 /// The same, for something a person waits on anyway (a join, checking a relay): if no relay answers the usual way
@@ -223,7 +227,7 @@ pub async fn bind_settled(key: SecretKey, relay: Option<&str>, lan: bool) -> Res
     let relays = relays_for(relay).await?;
     let own = relay.is_some();
     let first = route(&relays);
-    let endpoint = self::endpoint(&key, &relays, own, lan, first.clone()).await?.endpoint;
+    let endpoint = self::endpoint(&key, &relays, own, lan, first.clone(), None).await?.endpoint;
     let Some(proxy) = proxy_for(&relays) else { return Ok((endpoint, relays)) };
     if tokio::time::timeout(FIRST_WAY, endpoint.online()).await.is_ok() {
         return Ok((endpoint, relays));
@@ -237,13 +241,14 @@ pub async fn bind_settled(key: SecretKey, relay: Option<&str>, lan: bool) -> Res
     endpoint.close().await;
     keep_route(&other, &relays);
     log(&format!("on a relay {}", way(&other)));
-    Ok((self::endpoint(&key, &relays, own, lan, other).await?.endpoint, relays))
+    Ok((self::endpoint(&key, &relays, own, lan, other, None).await?.endpoint, relays))
 }
 
 /// Whether a relay answers the `proxy` way, asked by a throwaway endpoint that publishes nothing (this machine's own
 /// stays as it is).
 async fn reaches(relays: &[RelayUrl], proxy: &Option<RelayUrl>) -> bool {
-    let Ok(Bound { endpoint: probe, .. }) = endpoint(&SecretKey::generate(), relays, true, false, proxy.clone()).await
+    let Ok(Bound { endpoint: probe, .. }) =
+        endpoint(&SecretKey::generate(), relays, true, false, proxy.clone(), None).await
     else {
         return false;
     };
@@ -258,27 +263,71 @@ async fn endpoint(
     own: bool,
     lan: bool,
     proxy: Option<RelayUrl>,
+    port: Option<u16>,
 ) -> Result<Bound> {
+    let at = match &proxy {
+        Some(p) => Some(looked_up(p.clone()).await),
+        None => None,
+    };
     // The default relays, with n0's address lookup still: that is how a teammate on an older Reason Network (on n0's
     // relays) and this machine find each other, and what four-word codes need. The team's own relay and nothing of
     // n0's: none of its relays, no publishing or looking up addresses in its DNS; teammates are dialed through it.
-    let relay_mode = RelayMode::custom(relays.to_vec());
-    let mut b = if own { Endpoint::builder(presets::Minimal) } else { Endpoint::builder(presets::N0) }
-        .secret_key(key.clone())
-        .relay_mode(relay_mode);
-    let at = match &proxy {
-        Some(p) => Some(looked_up(p.clone()).await),
+    let builder = || -> Result<Builder> {
+        let relay_mode = RelayMode::custom(relays.to_vec());
+        let mut b = if own { Endpoint::builder(presets::Minimal) } else { Endpoint::buil
```

**File**: `src/proto.rs` (modified, +17/-0)
```diff
@@ -407,6 +407,20 @@ pub struct TeamInfo {
     /// (UTC) from six before today to tomorrow that had any. Older engines leave it out.
     #[serde(default)]
     pub messages: Vec<DayCount>,
+    /// The UDP port the network is on (`None` while it isn't up). Older engines leave it out.
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub udp: Option<UdpPort>,
+}
+
+/// The UDP port direct paths come in on, and the one `port` in the config asked for, if any.
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
+pub struct UdpPort {
+    pub port: u16,
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub fixed: Option<u16>,
+    /// `fixed` couldn't be bound, so `port` is a random one.
+    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
+    pub fell_back: bool,
 }
 
 #[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
@@ -509,6 +523,7 @@ mod tests {
             machines: vec![],
             features: vec![],
             messages: vec![DayCount { day: "2026-10-20".into(), sent: 3, received: 1 }],
+            udp: Some(UdpPort { port: 41641, fixed: Some(41641), fell_back: false }),
         };
         let v = serde_json::to_value(&t).unwrap();
         assert_eq!(v["team_id"], "00112233445566778899aabbccddeeff");
@@ -521,6 +536,8 @@ mod tests {
             .unwrap();
         assert_eq!((old.id.as_str(), old.name.as_str()), ("", "vibes"));
         assert!(old.messages.is_empty());
+        assert_eq!(v["udp"], serde_json::json!({"port": 41641, "fixed": 41641}));
+        assert!(old.udp.is_none());
     }
 
     #[test]
```

**File**: `src/render.rs` (modified, +22/-0)
```diff
@@ -225,6 +225,15 @@ pub fn team(t: &TeamInfo) -> String {
     out
 }
 
+/// The UDP port the network is on, and whether it is the one `port` in the config asked for.
+pub fn udp_port(u: &crate::proto::UdpPort) -> String {
+    match u.fixed {
+        Some(f) if u.fell_back => format!("UDP port {} (random; fixed {f} couldn't be bound)", u.port),
+        Some(_) => format!("UDP port {} (fixed)", u.port),
+        None => format!("UDP port {} (random)", u.port),
+    }
+}
+
 pub fn send_result(r: &SendResult) -> String {
     let mut out = String::new();
     for rc in &r.recipients {
@@ -433,12 +442,25 @@ mod tests {
             machines: Vec::new(),
             features: Vec::new(),
             messages: Vec::new(),
+            udp: None,
         };
         assert_eq!(team(&t), "team vibes · relay: Reason's (the default)\n");
         t.relay = Some("https://relay.example.com".into());
         assert_eq!(team(&t), "team vibes · relay: https://relay.example.com\n");
     }
 
+    #[test]
+    fn doctor_says_which_udp_port_and_why() {
+        use crate::proto::UdpPort;
+        let u = |port, fixed, fell_back| udp_port(&UdpPort { port, fixed, fell_back });
+        assert_eq!(u(41641, Some(41641), false), "UDP port 41641 (fixed)");
+        assert_eq!(u(53211, None, false), "UDP port 53211 (random)");
+        assert_eq!(u(53211, Some(41641), true), "UDP port 53211 (random; fixed 41641 couldn't be bound)");
+        // `port = 0` reaches the daemon as no port: random, not a missed fixed one.
+        let zero: crate::config::Config = toml::from_str("port = 0\n").unwrap();
+        assert_eq!(u(53211, zero.port(), false), "UDP port 53211 (random)");
+    }
+
     /// A directory of one teammate's session, with these fields as its machine and presence gave them.
     fn bobs(team: &str, person: &str, repo: &str, branch: &str, doing: &str) -> Directory {
         let machine = MachineInfo {
```

**File**: `src/setup.rs` (modified, +3/-0)
```diff
@@ -1451,6 +1451,9 @@ pub async fn doctor() -> Result<()> {
             let team = crate::shown(&t.name);
             println!("✓ daemon running; team {team} with {others} other machine(s), {online} connected");
             print!("{}", crate::shown(&render::team(&t)).lines().skip(1).map(|l| format!("{l}\n")).collect::<String>());
+            if let Some(u) = &t.udp {
+                println!("  {}", render::udp_port(u));
+            }
             if t.relay_connected == Some(false) {
                 let relay = crate::shown(&t.relay.clone().unwrap_or_else(render::default_relays));
                 println!(
```

---

### Incident Patch 3: `58727119` (2026-10-30)
**Commit Message**: fix: distinguish pre-dispatch refusal from uncertain delivery (#178)

fix(network): classify only proven pre-dispatch send failures

Co-authored-by: Sven Myhre <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -2757,7 +2757,7 @@ dependencies = [
 
 [[package]]
 name = "reason-network"
-version = "0.12.16"
+version = "0.12.17"
 dependencies = [
  "anyhow",
  "blake3",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "reason-network"
-version = "0.12.16"
+version = "0.12.17"
 edition = "2024"
 description = "Reason Network: the team directory and message bus behind reason network, for coding agents across machines"
 license = "MIT OR Apache-2.0"
```

**File**: `src/daemon/mail.rs` (modified, +204/-1)
```diff
@@ -135,6 +135,40 @@ impl Daemon {
         approval: Option<Box<Signed<Approval>>>,
         files: Vec<Attachment>,
         idempotency_key: Option<String>,
+    ) -> Result<SendResult> {
+        // A key may name an earlier send, even if this attempt fails before looking up its receipt.
+        // Only a successful begin_send that inserted a fresh key can prove otherwise: neither a
+        // missing receipt for an existing key nor a failed lookup proves that it never reached a recipient.
+        let mut may_have_dispatched = idempotency_key.is_some();
+        self.send_inner(
+            from,
+            to,
+            body,
+            reply_to,
+            wake,
+            notify,
+            approval,
+            files,
+            idempotency_key,
+            &mut may_have_dispatched,
+        )
+        .await
+        .map_err(|cause| SendError { cause, not_dispatched: !may_have_dispatched }.into())
+    }
+
+    #[allow(clippy::too_many_arguments)]
+    async fn send_inner(
+        self: &Arc<Self>,
+        from: String,
+        to: &str,
+        body: &str,
+        reply_to: Option<String>,
+        wake: bool,
+        notify: bool,
+        approval: Option<Box<Signed<Approval>>>,
+        files: Vec<Attachment>,
+        idempotency_key: Option<String>,
+        may_have_dispatched: &mut bool,
     ) -> Result<SendResult> {
         if idempotency_key.as_ref().is_some_and(|key| key.is_empty() || key.len() > 200) {
             bail!("idempotency key must be 1 to 200 bytes");
@@ -186,10 +220,11 @@ impl Daemon {
                     blake3::hash(serde_json::to_string(&(to, body, &reply_to, wake, notify, &files))?.as_bytes())
                         .to_hex()
                         .to_string();
-                let (nonce, receipt) = g.store.begin_send(&key, &fingerprint, now)?;
+                let (nonce, receipt, fresh) = g.store.begin_send(&key, &fingerprint, now)?;
                 if let Some(receipt) = receipt {
                     return Ok(receipt);
                 }
+                *may_have_dispatched = !fresh;
                 send_nonce = nonce;
                 send_key = Some(key);
             }
@@ -221,6 +256,7 @@ impl Daemon {
                     approval: None,
                     files: Vec::new(),
                 };
+                *may_have_dispatched = true;
                 let (sent, note) = self.notify(&msg);
                 let state = if sent { "notified" } else { "not notified" };
                 res.recipients.push(Recipient { address: format!("{to}@{}", self.machine), state: state.into(), note });
@@ -250,6 +286,7 @@ impl Daemon {
                     Ulid::generate().to_string()
                 };
                 if let Some(old) = g.store.message(&id)? {
+                    *may_have_dispatched = true;
                     res.ids.push(id);
                     res.recipients.push(Recipient {
                         address: t.shown_address(),
@@ -326,6 +363,8 @@ impl Daemon {
                 let mut attachment_size = dims.clone();
                 attachment_size.bucket = crate::usage::size(files.iter().map(|f| f.content.len()).sum()).into();
                 self.usage.count("attachment_bytes", attachment_size, 1);
+                // Set before the first durable write: any later failure must not authorize a reroute.
+                *may_have_dispatched = true;
                 g.store.record_sent(&exclude, &msg, &shown, "queued")?;
                 let (state, mut note): (String, String) = match t {
                     _ if !matches!(t, Target::Remote { .. }) && !g.loop_ok(&msg.from, &msg.to) => {
@@ -1056,6 +1095,170 @@ mod tests {
         }
     }
 
+    fn disk_daemon() -> (Arc<Daemon>, rusqlite::Connection, std::path::PathBuf) {
+        let home = std::env::temp_dir().join(format!("reason-network-send-{}", Ulid::generate()));
+        std::fs::create_dir_all(&home).unwrap();
+        let path = home.join("network.db");
+        let store = crate::store::Store::open(&path, home.join("inbox")).unwrap();
+        let d = Arc::new(Daemon::with(crate::config::Config::default(), store, SecretKey::generate()).unwrap());
+        (d, rusqlite::Connection::open(path).unwrap(), home)
+    }
+
+    #[tokio::test]
+    async fn a_fresh_send_refused_before_dispatch_has_a_typed_code() {
+        let d = Arc::new(super::super::test_daemon(crate::config::Config::default()));
+        let error = d.send("missing".into(), "alex/api", "hello", None, true, false, None, vec![]).await.unwrap_err();
+        let reply = serde_json::to_value(Reply::err(7, error)).unwrap();
+        assert_eq!(reply["error"], unregistered().to_string());
+        assert_eq!(reply["code"], "send_not_dispatched");
+        let error = d.send("missing".into(), "alex/api", "", None, true, false, None, vec![]).await.unwrap_err();
+        let reply = serde_json::to_value(Reply::err(8, error)).unwrap();
+        assert_eq!(reply["error"], "empty message");
+
```

**File**: `src/proto.rs` (modified, +47/-2)
```diff
@@ -281,7 +281,7 @@ pub struct Reply {
     pub result: Option<Value>,
     #[serde(default, skip_serializing_if = "Option::is_none")]
     pub error: Option<String>,
-    /// For a failure the Reason CLI handles: `name_taken` or `same_account_needs_owner` (see [`error_code`]).
+    /// A proven pre-dispatch send refusal, or a team failure (see [error_code]).
     #[serde(default, skip_serializing_if = "Option::is_none")]
     pub code: Option<String>,
 }
@@ -293,7 +293,31 @@ impl Reply {
 
     pub fn err(id: u64, e: anyhow::Error) -> Self {
         let error = format!("{e:#}");
-        Reply { id, ok: false, result: None, code: error_code(&error).map(String::from), error: Some(error) }
+        let code = match e.downcast_ref::<SendError>() {
+            Some(send) => send.not_dispatched.then_some("send_not_dispatched"),
+            None => error_code(&error),
+        };
+        Reply { id, ok: false, result: None, code: code.map(String::from), error: Some(error) }
+    }
+}
+
+/// A send's failure phase comes from its side effects, never from its error text.
+#[derive(Debug)]
+pub struct SendError {
+    pub cause: anyhow::Error,
+    pub not_dispatched: bool,
+}
+
+impl std::fmt::Display for SendError {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        write!(f, "{}", self.cause)
+    }
+}
+
+impl std::error::Error for SendError {
+    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
+        // Display already carries the cause's first message; keep the remaining chain without repeating it.
+        self.cause.source()
     }
 }
 
@@ -580,4 +604,25 @@ mod tests {
         assert_eq!(reply("this sign-in proof expired; sign in again").get("code"), None);
         assert_eq!(serde_json::to_value(Reply::ok(7, serde_json::json!(1))).unwrap().get("code"), None);
     }
+
+    #[test]
+    fn send_codes_follow_the_typed_phase_and_preserve_the_error_chain() {
+        for not_dispatched in [true, false] {
+            let cause = anyhow::anyhow!("disk full").context("saving receipt");
+            let text = format!("{cause:#}");
+            let error: anyhow::Error = SendError { cause, not_dispatched }.into();
+            assert_eq!(format!("{error:#}"), text);
+            let reply = serde_json::to_value(Reply::err(7, error)).unwrap();
+            assert_eq!(reply["error"], text);
+            assert_eq!(reply.get("code").and_then(Value::as_str), not_dispatched.then_some("send_not_dispatched"));
+        }
+        // A send failure cannot acquire a team or retry code from text in an underlying error.
+        for text in ["send_not_dispatched", "alex is already in this team", crate::team::SAME_ACCOUNT] {
+            let error = SendError { cause: anyhow::anyhow!(text), not_dispatched: false };
+            let reply = serde_json::to_value(Reply::err(7, error.into())).unwrap();
+            assert_eq!(reply["error"], text);
+            assert_eq!(reply.get("code"), None);
+        }
+        assert_eq!(Reply::err(7, anyhow::anyhow!("send_not_dispatched")).code, None);
+    }
 }
```

**File**: `src/store.rs` (modified, +20/-6)
```diff
@@ -190,14 +190,16 @@ impl Store {
         }
         Ok(out)
     }
+    /// Returns the nonce, saved receipt, and whether this call inserted the key.
+    /// No freshness claim escapes a failed fingerprint check or receipt lookup.
     pub fn begin_send(
         &self,
         key: &str,
         fingerprint: &str,
         now: i64,
-    ) -> Result<(String, Option<crate::proto::SendResult>)> {
+    ) -> Result<(String, Option<crate::proto::SendResult>, bool)> {
         self.prune_receipts(now)?;
-        self.db.execute(
+        let inserted = self.db.execute(
             "INSERT OR IGNORE INTO send_keys(key,fingerprint,created_at,nonce) VALUES(?1,?2,?3,?4)",
             params![key, fingerprint, now, ulid::Ulid::generate().to_string()],
         )?;
@@ -209,7 +211,7 @@ impl Store {
             old == fingerprint,
             "idempotency key already used for a different message; use a new key for a corrected or different message"
         );
-        Ok((nonce, receipt.map(|v| serde_json::from_str(&v)).transpose()?))
+        Ok((nonce, receipt.map(|v| serde_json::from_str(&v)).transpose()?, inserted == 1))
     }
 
     pub fn finish_send(&self, key: &str, receipt: &crate::proto::SendResult) -> Result<()> {
@@ -1080,12 +1082,24 @@ mod tests {
     fn an_expired_idempotency_key_gets_a_new_generation() {
         let store = Store::open(Path::new(":memory:"), temp_inbox()).unwrap();
         let now = crate::util::now_ms();
-        let (first, _) = store.begin_send("key", "original", now).unwrap();
+        let (first, receipt, fresh) = store.begin_send("key", "original", now).unwrap();
         assert!(!first.is_empty());
-        assert_eq!(store.begin_send("key", "original", now + 1000).unwrap().0, first);
+        assert!(fresh);
+        assert!(receipt.is_none());
+        let (pending, receipt, fresh) = store.begin_send("key", "original", now + 1000).unwrap();
+        assert_eq!(pending, first);
+        assert!(!fresh);
+        assert!(receipt.is_none());
+        let saved = crate::proto::SendResult { ids: vec!["message-id".into()], recipients: vec![] };
+        store.finish_send("key", &saved).unwrap();
+        let (cached, receipt, fresh) = store.begin_send("key", "original", now + 2000).unwrap();
+        assert_eq!(cached, first);
+        assert!(!fresh);
+        assert_eq!(serde_json::to_value(receipt.unwrap()).unwrap(), serde_json::to_value(saved).unwrap());
         assert!(store.begin_send("key", "different", now + 1000).is_err());
-        let (next, receipt) = store.begin_send("key", "different", now + 8 * 86_400_000).unwrap();
+        let (next, receipt, fresh) = store.begin_send("key", "different", now + 8 * 86_400_000).unwrap();
         assert_ne!(next, first);
+        assert!(fresh);
         assert!(receipt.is_none());
     }
 
```

#### Recent Merged Pull Requests:
- **PR #178** (2026-10-30): fix: distinguish pre-dispatch refusal from uncertain delivery (@reason-machines-staging[bot])
- **PR #177** (2026-10-29): feat: deliver Antigravity messages natively with durable receipts (@reason-machines-staging[bot])
- **PR #175** (2026-10-29): fix: count held approvals in detailed network usage (@reason-machines-staging[bot])
- **PR #174** (2026-10-29): feat: measure network usage without changing encrypted peer delivery (@reason-machines-staging[bot])
- **PR #166** (closed): Reason Network 0.12.14 (@reason-machines[bot])
- **PR #157** (2026-10-27): Daemon: start every program without a console window on Windows (@reason-machines[bot])

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

## X. Hermes bridge: no panic on a racing ack, setup gives up on a hung hermes --versi

**RULE**:
When implementing operations in `src/bridge.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in reason-machines/reason-network. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `27252c24`: Hermes bridge: no panic on a racing ack, setup gives up on a hung hermes --version (#147). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/bridge.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    anyhow::anyhow!(render::defang(&plugin_tools(&format!("{e:#}"))))
}

/// The MCP tool names in an engine error, as the plugin's tools (`list_team` is `reason_network_list_agents`).
fn plugin_tools(text: &str) -> String {
    const TOOLS: [(&str, &str); 4] = [
        ("list_team", "reason_network_list_agents"),
        ("send_message", "reason_network_send_message"),
        ("check_inbox", "reason_network_check_inbox"),
        ("ask_user", "reason_network_ask_user"),
    ];
    let between = |c: char| !(c.is_alphanumeric() || c == '_');
    text.split_inclusive(between)
        .map(|piece| {
            let word = piece.trim_end_matches(between);
            match TOOLS.iter().find(|(tool, _)| *tool == word) {
                Some((_, plugin)) => format!("{plugin}{}", &piece[word.len()..]),
                None => piece.to_string(),
            }
        })
        .collect()
    // One lock: a failed re-register removes the session, and it mustn't go between finding it and checking an ack.
    let cwd = {
        let Some(session) = sessions.get(&key) else { bail!("register this session first") };
        if let Request::Delivered { ids, .. } | Request::PushFailed { ids, ..
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    anyhow::anyhow!(render::defang(&format!("{e:#}")))
    let cwd = sessions
        .lock()
        .await
        .get(&key)
        .map(|s| s.cwd.clone())
        .ok_or_else(|| anyhow::anyhow!("register this session first"))?;
    if let Request::Delivered { ids, .. } | Request::PushFailed { ids, .. } = &request {
        if ids.iter().any(|id| !sessions[&key].received.contains(id)) {
    }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `27252c24` are properly handled with clean fallback behavior.
