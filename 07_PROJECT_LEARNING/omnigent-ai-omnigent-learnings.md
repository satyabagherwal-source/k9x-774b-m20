# Forensic Learning Record (Deep Inspection): omnigent-ai/omnigent

> **Canonical Artifact**: `07_PROJECT_LEARNING/omnigent-ai-omnigent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/omnigent-ai/omnigent](https://github.com/omnigent-ai/omnigent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:16:25.084Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `omnigent-ai/omnigent`
- **Description**: Omnigent is an open-source AI agent framework and meta-harness: orchestrate Claude Code, Codex, Cursor, Pi, and custom agents — swap harnesses without rewriting, enforce policies and sandboxing, and collaborate in real time from any device.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 10601 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `designs/prioritization/score_prototype.py`
```
#!/usr/bin/env python3
"""Dry-run prototype for issue-prioritization-v2 scoring.

Reads a snapshot of all open issues and produces a BEFORE (current priority
label ordering) vs AFTER (composite score ordering) comparison, so we can
eyeball which issues move and tune the weights against real test cases.

The severity heuristic here is a *stand-in* for the production design, where
severity is graded by the triage classifier LLM (which reads full issue
content). Regex is used only so the dry-run is reproducible and inspectable.

Usage:
    # refresh the snapshot (external org -> ghx from gh-profiles)
    GH_HOST=github.com ghx api --paginate \
      "repos/omnigent-ai/omnigent/issues?state=all&per_page=100" > /tmp/all_issues_raw.json
    python3 designs/prioritization/score_prototype.py /tmp/all_issues_raw.json
    # priority-LABEL backfill preview (current vs regraded bucket, no scores):
    python3 designs/prioritization/score_prototype.py /tmp/all_issues_raw.json --regrade
"""

from __future__ import annotations

import datetime
import json
import math
import os
import re
import sys

NOW = datetime.datetime.now(datetime.timezone.utc)

# ── Tunable weights ──────────────────────────────────────────────────────
# Severity tiers are checked most-severe first; first match wins. Kept narrow
# so a stray "credential" mention doesn't inflate everything to critical.
SEVERITY = {
    # NOTE: `severity()` lowercases the text before matching, so every pattern
    # here MUST be lowercase — an uppercase literal can never match.
    "critical": (
        100,
        [
            r"\bdata ?loss\b",
            r"\bvulnerab",
            r"\bcve-\d",
            r"\brce\b",
            r"\bexfiltrat",
            r"\bpolicy (?:gate|bypass)",
            r"\bsandbox (?:escape|bypass)",
            r"\bgates? (?:are )?bypass",
            r"\bcorrupt(?:s|ion|ed)\b",
            r"\bpat is offered",
            r"\bleak(?:s|ed) (?:the |a )?(?:secret|token|credential)",
        ],
    ),
    "high": (
        60,
        [
            r"\bcrash",
            r"\bdeadlock",
            r"\bhangs?\b",
            r"\bbricks?\b",
            r"\bpermanently\b",
            r"\bnever (?:recover|complete|exit|return)",
            r"\bcannot (?:install|start|log ?in|sign ?in|uninstall)",
            r"\bfails? to start\b",
            r"\bwedge",
            r"\binfinite\b",
            r"\bunbounded\b",
            r"\bstarv(?:e|ation)",
            r"\bevery (?:user|session|request)\b",
            r"\ball (?:users|sessions)\b",
        ],
    ),
    "medium": (
        30,
        [
            r"\berror",
            r"\bfails?\b",
            r"\btimeout|\btimes? out",
            r"\b(?:404|401|403|500)\b",
            r"\bwrong\b",
            r"\bignore[sd]?\b",
            r"\bmissing\b",
            r"\bincorrect",
            r"\bregression",
            r"\bswallow",
            r"\bsilent",
        ],
    ),
    "low": (
        10,
        [
            r"\bcosmetic",
            r"\bpolish",
            r"\btypo",
            r"\bnit\b",
            r"\bmisalign|\balignment\b",
            r"\btooltip",
            r"\brename\b",
            r"\bnice.to.have",
            r"\bminor\b",
            r"\brenders? und",
        ],
    ),
}

PRIOS = ("P0-critical", "P1-high", "P2-medium", "P3-low")

# Component importance is one unified axis: a per-area `weight` read from
# .github/areas.json (bands 1.4/1.2/1.1/1.0/0.9), applied to EVERY comp: label —
# not the old harness-only tier. Harness weights are telemetry-seeded (session
# usage); non-harness are editorial. See areas.json `weight` / `weight_source`.
_AREAS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", ".github", "areas.json")


def _load_area_weights():
    """Return (label_weight, harness_area_weights):
    - label_weight[comp:label] = max weight among areas sharing that label
      (the fallback when we can't pin the exact sub-area).
    - harness_area_weights = [(keyword, weight)] for harness-* areas, so a
      harness issue resolves to its specific harness by a title keyword."""
    try:
        with open(_AREAS_PATH) as f:
            areas = json.load(f)["areas"]
    except (OSError, KeyError):
        return {}, []
    label_weight = {}
    harness = []
    for a in areas:
        w = a.get("weight", 1.0)
        label_weight[a["label"]] = max(label_weight.get(a["label"], 0.0), w)
        if a["key"].startswith("harness-"):
            harness.append((a["key"][len("harness-") :], w))
    return label_weight, harness


_LABEL_WEIGHT, _HARNESS_WEIGHTS = _load_area_weights()


def labels(i):
    return {lab["name"] for lab in i["labels"]}


def parse(s):
    return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))


def severity(i):
    text = (i["title"] + " " + (i.get("body") or ""))[:2000].lower()
    for name, (w, pats) in SEVERITY.items():
        if any(re.search(p, text) for p in pats):
            return name, w
    # Fallbacks for issues that hit no keyword. An un-keyworded bug scores 25 —
    # just below an explicit "medium" (30) so known-medium bugs sort above
    # unknown ones; an un-keyworded FR scores 20 (see FR grading note in doc).
    return ("medium", 25) if "Bug" in labels(i) else ("feature", 20)


def area_weight(i):
    """Unified component-importance multiplier from areas.json `weight`.

    Applies to every comp: label (not harness-only). For a harness issue we
    resolve the specific harness by a title keyword → that harness area's
    weight; otherwise we use the max weight among areas sharing the comp: label.
    No comp: label → 1.0 (neutral)."""
    labs = labels(i)
    comps = [x for x in labs if x.startswith("comp:")]
    if not comps:
        return 1.0
    if "comp:harnesses" in comps:
        t = i["title"].lower()
        for keyword, w in _HARNESS_WEIGHTS:
            if keyword in t:
                return w
        # harness issue we can't pin to a specific harness: shared-infra weight
        # (inner/llms/tools) is captured by the label max below.
    # Most-important area wins among the issue's comp labels.
    return max((_LABEL_WEIGHT.get(c, 1.0) for c in comps), default=1.0)


# Demand handling is type-dependent, grounded in the reaction distribution:
# 93% of open issues have 0 reactions, and the reacted ones skew heavily to
# feature requests. So reactions are a *demand* signal (a wanted capability),
# not a *severity* signal — a bug's importance comes from content, not upvotes.
#   - Feature requests: demand is a bounded MULTIPLIER, so a well-liked FR
#     climbs above unwanted ones.
#   - Bugs: demand is a small additive TIEBREAK only, so a 0-reaction crash
#     still outranks a lightly-liked cosmetic FR.
# Comments are deliberately excluded: on this repo they're mostly repro
# back-and-forth (a bug with more comments is often harder, not more wanted).
DEMAND_CAP = 12  # log input cap so one popular FR can't swamp severity
FR_DEMAND_MAX = 0.6  # +60% at most for the most-wanted FR
BUG_DEMAND_MAX = 15  # small flat additive tiebreak for bugs

# Optional modules. Reviewer feedback is to ship the first implementation with
# readiness and age disabled, but keep them isolated so we can tune/re-enable by
# changing one constant rather than rewriting the formula.
ENABLE_READINESS = False
ENABLE_AGE_FACTOR = False


def _demand_signal(i):
    """0..1 normalized, log-scaled reaction intensity."""
    r = min(i.get("reactions", {}).get("total_count", 0), DEMAND_CAP)
    return math.log1p(r) / math.log1p(DEMAND_CAP)


def age_days(i):
    return (NOW - parse(i["created_at"])).total_seconds() / 86400


# Readiness: optional near-tie module for actionable tickets (repro steps, a
# real body). Disabled by default in this prototype per reviewer feedback.
_REPRO = re.compile(r"steps to reproduce|reproduc|to reproduce", re.I)
READINESS_MIN, READINESS_MAX = 0.85, 1.1


def readiness(i):
    if "needs-info" in labels(i):
        return READINESS_MIN  # explicitly blocked on the reporter
    body = i.get("body") or ""
    ready = len(body) >= 400 and (_REPRO.search(body) or "enhancement" in labels(i))
    return READINESS_MAX if ready else 1.0


# Duplicate blast-radius: N confirmed duplicates of an issue means N reporters
# hit it — a reach signal. Snapshot JSON doesn't carry dup links, so this reads
# an optional `duplicate_count` the production job would populate from the
# dedup labeler (see PR #4037). Defaults to no-op on the dry-run data.
def dup_reach(i):
    n = i.get("duplicate_count", 0)
    return 1.0 + min(0.5, 0.15 * n)  # +15% per dup, capped at +50%


# Age factor: optional visibility/decay module. Disabled by default in this
# prototype per reviewer feedback. Age is measured against the snapshot's newest
# issue when enabled, so a stale snapshot doesn't push every row into old-age.
def age_factor(i):
    a = age_days(i)
    if a <= 5:
        return 1.0
    if a <= 21:
        return 1.2
    return 0.8


def score(i):
    sname, sw = severity(i)
    # Reach (blast radius) is folded INTO the severity grade, not a separate
    # multiplier: in production the LLM grades a widespread failure higher. The
    # regex stand-in can't make that judgment, so broad-reach issues are
    # under-graded here — one more reason production severity must be LLM-graded.
    readiness_factor = readiness(i) if ENABLE_READINESS else 1.0
    s = sw * area_weight(i) * dup_reach(i) * readiness_factor
    d = _demand_signal(i)
    if "enhancement" in labels(i):
        s *= 1.0 + FR_DEMAND_MAX * d  # demand LEADS for feature requests
    else:
        s += BUG_DEMAND_MAX * d  # demand is only a tiebreak for bugs
    if ENABLE_AGE_FACTOR:
        s *= age_factor(i)
    return s, sname


def current_rank_key(i):
    """BEFORE ordering: priority label, then recency (how the queue reads today)."""
    lab = labels(i)
    p = next((n for n, name in enumerate(PRIOS) if name in lab), len(PRIOS))
    return (p, -parse(i["cr
```

### Core Architecture Module: `dev/omnidev/src/shellhook.rs`
```
//! Emit the shell snippet that runs the daily update check.

/// The snippet to append to `.zshrc`/`.bashrc`
/// (`omnidev shell-hook >> ~/.zshrc`). All throttling and prompting live inside
/// `omnidev check`, so this stays trivial and shell-agnostic: run once per
/// interactive shell, quietly, and never fail the shell if it errors.
///
/// It self-guards on `command -v omnidev`, so it's meant to be appended to the
/// rc (a static no-op when omnidev is absent) rather than run via
/// `eval "$(omnidev shell-hook)"`, which would invoke omnidev on every shell
/// startup and error when it isn't on PATH.
const HOOK: &str = r#"# omnidev: daily omnigent update check
if [ -n "${PS1:-}" ] && command -v omnidev >/dev/null 2>&1; then
  omnidev check --quiet || true
fi"#;

pub fn print() {
    println!("{HOOK}");
}

```

### Core Architecture Module: `dev/omnidev/src/state.rs`
```
//! Shared state between the supervisor and the TUI.

use std::sync::{Arc, Mutex};

use crate::logs::LogBuffer;
use crate::pod::Pod;

/// The three supervised processes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcId {
    Server,
    Host,
    Vite,
}

impl ProcId {
    pub const ALL: [ProcId; 3] = [ProcId::Server, ProcId::Host, ProcId::Vite];

    pub fn idx(self) -> usize {
        match self {
            ProcId::Server => 0,
            ProcId::Host => 1,
            ProcId::Vite => 2,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            ProcId::Server => "server",
            ProcId::Host => "host",
            ProcId::Vite => "vite",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcStatus {
    Idle,
    Starting,
    Running(u32),
    Restarting,
    Crashed,
    Stopped,
}

impl ProcStatus {
    pub fn short(&self) -> &'static str {
        match self {
            ProcStatus::Idle => "idle",
            ProcStatus::Starting => "starting",
            ProcStatus::Running(_) => "running",
            ProcStatus::Restarting => "restarting",
            ProcStatus::Crashed => "crashed",
            ProcStatus::Stopped => "stopped",
        }
    }
}

/// State the TUI renders and the supervisor mutates. Guarded by a std mutex;
/// locks are held only for the duration of a single push/read.
pub struct Shared {
    pub status: [ProcStatus; 3],
    pub server: LogBuffer,
    pub host: LogBuffer,
    pub vite: LogBuffer,
    /// Combined, source-tagged view — also receives supervisor events.
    pub all: LogBuffer,
}

impl Shared {
    pub fn new(pod: &Pod) -> Arc<Mutex<Shared>> {
        Arc::new(Mutex::new(Shared {
            status: [ProcStatus::Idle, ProcStatus::Idle, ProcStatus::Idle],
            server: LogBuffer::new(&pod.log_file("server")),
            host: LogBuffer::new(&pod.log_file("host")),
            vite: LogBuffer::new(&pod.log_file("vite")),
            all: LogBuffer::memory(),
        }))
    }

    fn buf_mut(&mut self, id: ProcId) -> &mut LogBuffer {
        match id {
            ProcId::Server => &mut self.server,
            ProcId::Host => &mut self.host,
            ProcId::Vite => &mut self.vite,
        }
    }

    pub fn buf(&self, id: ProcId) -> &LogBuffer {
        match id {
            ProcId::Server => &self.server,
            ProcId::Host => &self.host,
            ProcId::Vite => &self.vite,
        }
    }

    /// Append a line from a process: goes to its own pane and the combined view.
    pub fn log_proc(&mut self, id: ProcId, line: String) {
        self.all.push(format!("[{}] {}", id.label(), line));
        self.buf_mut(id).push(line);
    }

    /// Append a supervisor event (starts, restarts, crashes, reloads).
    pub fn event(&mut self, line: impl Into<String>) {
        self.all.push(format!("[omnidev] {}", line.into()));
    }

    pub fn set_status(&mut self, id: ProcId, status: ProcStatus) {
        self.status[id.idx()] = status;
    }
}

```

### Core Architecture Module: `dev/omnidev/src/tui/render.rs`
```
//! Frame rendering. Minimal chrome: no boxes — regions are separated by a
//! light neutral background bar instead. The header and footer share the
//! "chrome" bar; the log body sits on the terminal's default background so
//! ANSI log colors render naturally on either a light or dark theme.

use ansi_to_tui::IntoText;
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Paragraph, Tabs};
use ratatui::Frame;
use unicode_width::UnicodeWidthChar;

use super::{App, Dir, View};
use crate::state::{ProcId, ProcStatus};

// Palette calibrated (Solarized accents) to stay legible on both light and
// dark terminals. The chrome bars use a light neutral background with dark
// text; the log body keeps the terminal default background so ANSI log colors
// render naturally on either theme. Accent hues are mid-tone so they read on
// the light bar and on both a black and a white body background.
const CHROME_BG: Color = Color::Rgb(238, 232, 213); // light neutral bar
const CHROME_FG: Color = Color::Rgb(60, 70, 72); // dark text on the bar
const MUTED: Color = Color::Rgb(120, 132, 133); // de-emphasized labels

const SERVER: Color = Color::Rgb(38, 139, 210); // blue
const HOST: Color = Color::Rgb(42, 161, 152); // cyan
const VITE: Color = Color::Rgb(211, 54, 130); // magenta
const EVENT: Color = Color::Rgb(181, 137, 0); // amber (omnidev channel)
const LABEL_WIDTH: usize = 7;

const OK: Color = Color::Rgb(133, 153, 0); // green (running)
const WARN: Color = Color::Rgb(203, 75, 22); // orange (starting/restarting)
const ERR: Color = Color::Rgb(220, 50, 47); // red (crashed)

// Search-match highlight: amber background with near-black text, legible on
// either theme and distinct from the ANSI log colors underneath.
const MATCH_BG: Color = Color::Rgb(181, 137, 0);
const MATCH_FG: Color = Color::Rgb(20, 20, 20);

/// Style for the header/footer chrome bars.
fn chrome() -> Style {
    Style::default().bg(CHROME_BG).fg(CHROME_FG)
}

/// The search-match background, exposed for tests that assert highlighting.
#[cfg(test)]
pub fn match_bg() -> Color {
    MATCH_BG
}

pub fn draw(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1), // pod path
            Constraint::Length(1), // urls
            Constraint::Length(1), // status chips
            Constraint::Length(1), // tabs + scroll status
            Constraint::Min(1),    // body
            Constraint::Length(1), // footer
        ])
        .split(f.area());

    draw_pod(f, app, chunks[0]);
    draw_urls(f, app, chunks[1]);
    draw_chips(f, app, chunks[2]);
    draw_tabs_row(f, app, chunks[3]);
    draw_body(f, app, chunks[4]);
    draw_footer(f, app, chunks[5]);
}

fn draw_pod(f: &mut Frame, app: &App, area: Rect) {
    let line = Line::from(vec![
        Span::styled(" pod ", Style::default().fg(MUTED)),
        Span::raw(app.pod.dir.display().to_string()),
    ]);
    f.render_widget(Paragraph::new(line).style(chrome()), area);
}

fn draw_urls(f: &mut Frame, app: &App, area: Rect) {
    let line = Line::from(vec![
        Span::styled(" server ", Style::default().fg(MUTED)),
        Span::styled(
            app.pod.server_display_url(),
            Style::default().fg(proc_color(ProcId::Server)),
        ),
        Span::styled("   ui ", Style::default().fg(MUTED)),
        Span::styled(
            app.pod.vite_display_url(),
            Style::default().fg(proc_color(ProcId::Vite)),
        ),
    ]);
    f.render_widget(Paragraph::new(line).style(chrome()), area);
}

fn draw_chips(f: &mut Frame, app: &App, area: Rect) {
    let status = app.shared.lock().unwrap().status.clone();
    let mut chips: Vec<Span> = vec![Span::raw(" ")];
    for id in ProcId::ALL {
        let st = &status[id.idx()];
        chips.push(Span::styled(
            id.label(),
            Style::default()
                .fg(proc_color(id))
                .add_modifier(Modifier::BOLD),
        ));
        chips.push(Span::raw(" "));
        chips.push(Span::styled(
            st.short(),
            Style::default().fg(status_color(st)),
        ));
        chips.push(Span::raw("   "));
    }
    f.render_widget(Paragraph::new(Line::from(chips)).style(chrome()), area);
}

fn draw_tabs_row(f: &mut Frame, app: &App, area: Rect) {
    // Split the row: tabs on the left, scroll/follow status right-aligned.
    let cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Min(0), Constraint::Length(36)])
        .split(area);

    let entries = [
        ("server", View::Server, Some(ProcId::Server)),
        ("host", View::Host, Some(ProcId::Host)),
        ("vite", View::Vite, Some(ProcId::Vite)),
        ("all", View::All, None),
    ];
    let selected = entries
        .iter()
        .position(|(_, v, _)| *v == app.view)
        .unwrap_or(3);
    let titles: Vec<Line> = entries
        .iter()
        .map(|(name, _, id)| {
            let color = id.map(proc_color).unwrap_or(CHROME_FG);
            Line::from(Span::styled(*name, Style::default().fg(color)))
        })
        .collect();
    let tabs = Tabs::new(titles)
        .select(selected)
        .style(chrome())
        .divider(Span::styled("·", Style::default().fg(MUTED)))
        .highlight_style(Style::default().add_modifier(Modifier::REVERSED | Modifier::BOLD));
    f.render_widget(tabs, cols[0]);

    let total = app.line_count();
    let mut status = format!("{total} ln");
    if !app.wrap {
        status.push_str(" · nowrap");
    }
    if let Some((rank, count)) = app.match_stats() {
        status.push_str(&format!(" · {rank}/{count}"));
    }
    if app.follow {
        status.push_str(" · follow ");
    } else {
        status.push_str(&format!(" · ↑{} ", app.scroll_back));
    }
    f.render_widget(
        Paragraph::new(Line::from(Span::styled(status, Style::default().fg(MUTED))))
            .alignment(Alignment::Right)
            .style(chrome()),
        cols[1],
    );
}

fn draw_body(f: &mut Frame, app: &App, area: Rect) {
    let all_view = app.view == View::All;
    let width = area.width as usize;
    let height = area.height as usize;
    // Publish the body geometry so key handling can page and search can wrap.
    app.viewport_h.set(height);
    app.viewport_w.set(width);

    let shared = app.shared.lock().unwrap();
    let lines: Vec<String> = match app.view {
        View::Server => shared.buf(ProcId::Server).iter().cloned().collect(),
        View::Host => shared.buf(ProcId::Host).iter().cloned().collect(),
        View::Vite => shared.buf(ProcId::Vite).iter().cloned().collect(),
        View::All => shared.all.iter().cloned().collect(),
    };
    drop(shared);

    let query = app.search_query_lower();
    let visible = visible_rows(
        &lines,
        all_view,
        width,
        height,
        app.wrap,
        app.scroll_back,
        query.as_deref(),
    );
    f.render_widget(Paragraph::new(visible), area);
}

/// The window of display rows to show: the `height` rows sitting `scroll_back`
/// rows above the tail. Rows are built from the bottom up, wrapping only enough
/// logical lines to cover `scroll_back + height` so a full buffer isn't
/// re-parsed every frame. Equivalent to wrapping every line and slicing the
/// flat list, but without the wasted work.
fn visible_rows(
    lines: &[String],
    all_view: bool,
    width: usize,
    height: usize,
    wrap: bool,
    scroll_back: usize,
    query: Option<&str>,
) -> Vec<Line<'static>> {
    // `acc` holds rows bottom-to-top; each logical line yields one row (wrap
    // off) or several (wrap on), so `scroll_back` counts rendered rows.
    let needed = scroll_back.saturating_add(height);
    let mut acc: Vec<Line> = Vec::with_capacity(needed + 8);
    let mut exhausted = true;
    for raw in lines.iter().rev() {
        let spans = render_line(raw, all_view);
        let ranges = query.map(|q| match_ranges(raw, all_view, q));
        let mut line_rows: Vec<Line> = Vec::new();
        wrap_spans(spans, width, wrap, ranges.as_deref(), &mut line_rows);
        acc.extend(line_rows.into_iter().rev());
        if acc.len() >= needed {
            exhausted = false;
            break;
        }
    }

    // If we ran out of lines the buffer is shorter than the scroll offset, so
    // clamp to the top; otherwise `scroll_back` is within range as-is.
    let back = if exhausted {
        scroll_back.min(acc.len().saturating_sub(height))
    } else {
        scroll_back
    };
    let end = (back + height).min(acc.len());
    let mut visible: Vec<Line> = acc.drain(back..end).collect();
    visible.reverse();
    visible
}

fn draw_footer(f: &mut Frame, app: &App, area: Rect) {
    // While typing a query the footer becomes the search prompt with a cursor
    // block; otherwise it lists the key hints.
    let line = if let Some((dir, query)) = app.input_prompt() {
        let sigil = match dir {
            Dir::Fwd => '/',
            Dir::Back => '?',
        };
        Line::from(vec![
            Span::styled(
                format!(" {sigil}{query}"),
                Style::default().fg(CHROME_FG).add_modifier(Modifier::BOLD),
            ),
            Span::styled("█", Style::default().fg(CHROME_FG)),
        ])
    } else {
        let hint = " f/b page · d/u half · j/k line · g/G ends · F follow · w wrap · / ? search · n/N next · 1230/Tab view · r/R restart · c clear · q quit ";
        Line::from(Span::styled(hint, Style::default().fg(CHROME_FG)))
    };
    f.render_widget(Paragraph::new(line).style(chrome()), area);
}

/// Turn one stored log line into styled spans. In the combined view the leading
/// `[service]` tag is colored per service and the rest keeps its ANSI colors;
/// per-service panes just pass their ANSI through.
fn render_line(raw: &str, a
```

### Core Architecture Module: `integrations/slack/src/omnigent_slack/enrollment_state.py`
```
"""Signed enrollment state + identity matching for the Databricks OAuth flow.

Pure, I/O-free core of the enrollment flow — the aiohttp server that uses these
lives in :mod:`omnigent_slack.webauth`, and the whole design is in
``docs/DATABRICKS_APP_WEBAUTH_DESIGN.md``.

- :func:`sign_state` / :func:`verify_state` — the ``state`` round-tripped through
  the Databricks authorization-code redirect. It binds the browser session to
  the Slack ``(team, user, email)`` that requested it and carries a single-use
  ``nonce`` the callback uses to look up the PKCE ``code_verifier`` the bot
  generated (the verifier itself never travels in the state — only its lookup
  key). Signed (HMAC-SHA256) and TTL-bounded. The nonce is consumed on use, so
  a replayed redirect finds no verifier and is refused; the callback also
  requires the OAuth-authenticated email to equal the signed ``email``
  (:func:`emails_match`), closing the confused-deputy.
- :func:`emails_match` — constant-time email comparison for that identity check.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass

# How long a signed enrollment ``state`` stays valid. The user clicks the link
# and completes SSO within seconds; a tight window bounds how long a leaked link
# is usable (though the nonce makes replay a no-op and the email-match check
# makes it same-identity anyway).
_DEFAULT_STATE_TTL_SECONDS = 600


def new_nonce() -> str:
    """A random, single-use lookup key tying a ``state`` to its PKCE verifier."""
    return secrets.token_urlsafe(24)


class StateError(RuntimeError):
    """A ``state`` token was malformed, tampered with, or expired."""


@dataclass(frozen=True, slots=True)
class EnrollmentState:
    """The Slack identity a browser enrollment session is bound to.

    ``email`` is the Slack user's email (from Slack's ``users.info``), signed
    into the state so the callback can require the OAuth-authenticated browser's
    email to match it. Without that check the callback would store *whoever's*
    token under the Slack id in the state — a confused-deputy: a link bound to
    Slack user A, opened by victim V, would capture V's token under A. Binding
    the email closes it in both directions. ``nonce`` is the single-use key the
    callback uses to fetch the PKCE ``code_verifier`` the bot stored server-side.
    """

    team_id: str
    user_id: str
    email: str
    # Slack workspace display name, carried only so the enrollment page can show
    # the human which Slack workspace they linked. Not security-relevant.
    team_name: str
    # Single-use lookup key for the PKCE code_verifier held server-side.
    nonce: str
    issued_at: int


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def _sign(payload: bytes, secret: str) -> bytes:
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()


def sign_state(
    team_id: str,
    user_id: str,
    email: str,
    secret: str,
    *,
    nonce: str,
    team_name: str = "",
    issued_at: int | None = None,
) -> str:
    """Return a signed, URL-safe ``state`` binding a browser session to a Slack user.

    The payload carries the ``(team_id, user_id)``, the Slack user's ``email``,
    the workspace ``team_name`` (display only), the single-use ``nonce`` (PKCE
    verifier lookup key), and an issue time; the signature (HMAC-SHA256 over the
    payload) makes it unforgeable without the secret. :func:`verify_state`
    checks the signature and TTL, and the callback checks the OAuth-authenticated
    email against ``email``. ``issued_at`` is injectable for tests; production
    stamps ``time.time()``.
    """
    issued = int(issued_at if issued_at is not None else time.time())
    payload = json.dumps(
        {"t": team_id, "u": user_id, "e": email, "n": team_name, "c": nonce, "i": issued},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    signature = _sign(payload, secret)
    return f"{_b64url_encode(payload)}.{_b64url_encode(signature)}"


def verify_state(
    state: str,
    secret: str,
    *,
    ttl_seconds: int = _DEFAULT_STATE_TTL_SECONDS,
    now: int | None = None,
) -> EnrollmentState:
    """Validate a ``state`` from :func:`sign_state`, returning the bound identity.

    Raises :class:`StateError` if the token is malformed, the signature doesn't
    match (constant-time compare), or it is older than ``ttl_seconds``. ``now``
    is injectable for tests.
    """
    try:
        payload_b64, signature_b64 = state.split(".", 1)
        payload = _b64url_decode(payload_b64)
        signature = _b64url_decode(signature_b64)
    except (ValueError, TypeError) as exc:  # split / base64 decode failures
        raise StateError("Malformed enrollment token.") from exc

    expected = _sign(payload, secret)
    if not hmac.compare_digest(signature, expected):
        raise StateError("Enrollment token signature did not match.")

    try:
        data = json.loads(payload)
        team_id = str(data["t"])
        user_id = str(data["u"])
        email = str(data["e"])
        team_name = str(data.get("n", ""))
        nonce = str(data["c"])
        issued_at = int(data["i"])
    except (ValueError, KeyError, TypeError) as exc:
        raise StateError("Malformed enrollment token payload.") from exc

    current = int(now if now is not None else time.time())
    if current - issued_at > ttl_seconds:
        raise StateError("Enrollment link expired. Start again from Slack.")
    if issued_at - current > ttl_seconds:
        # Clock skew / future-dated token — reject rather than trust it.
        raise StateError("Enrollment token is not yet valid.")

    return EnrollmentState(
        team_id=team_id,
        user_id=user_id,
        email=email,
        team_name=team_name,
        nonce=nonce,
        issued_at=issued_at,
    )


def emails_match(a: str, b: str) -> bool:
    """Case-insensitive, whitespace-trimmed email equality (constant-time).

    Emails are case-insensitive in their domain (and, in practice, IdPs treat
    the local part that way too), so compare normalized. Constant-time to avoid
    leaking match progress, though these values aren't secret. The casefolded
    strings are UTF-8 encoded before comparison because ``hmac.compare_digest``
    rejects ``str`` inputs containing non-ASCII characters — an internationalized
    email would otherwise raise ``TypeError`` and 500 the callback.
    """
    return hmac.compare_digest(
        a.strip().casefold().encode("utf-8"), b.strip().casefold().encode("utf-8")
    )

```

### Core Architecture Module: `omnigent/db/migrations/versions/d7f1a2b3c4e5_add_conversation_metadata_live_state.py`
```
"""add live-state columns to omnigent_conversation_metadata

Revision ID: d7f1a2b3c4e5
Revises: a7b3c4d5e6f7
Create Date: 2026-07-14 00:00:00.000000

Adds three per-session live-state columns so any server replica can
serve the sidebar's live fields (they previously lived only in the
in-memory caches of the replica holding the session's runner tunnel):

- ``runner_last_seen``: nullable Integer — epoch seconds the bound
  runner's tunnel was last observed alive. ``runner_online`` is derived
  from freshness (like ``host_is_live``), so a replica/host that dies
  without a graceful disconnect self-corrects after the TTL.
- ``live_status``: nullable SmallInteger — last relay-observed turn
  status (idle/running/waiting/failed; see
  ``enum_codecs.SESSION_LIVE_STATUS``). NULL means no relay has ever
  reported on the session.
- ``pending_elicitation_count``: nullable Integer — outstanding
  elicitation (approval-prompt) count. NULL means never written.

All three are written by the pod holding the runner tunnel. They live on
``omnigent_conversation_metadata`` (Omnigent operational state, beside
``runner_id``/``host_id``), so writes cannot bump
``conversations.updated_at`` — which drives sidebar ordering.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d7f1a2b3c4e5"
down_revision: str | None = "a7b3c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("omnigent_conversation_metadata") as batch_op:
        batch_op.add_column(sa.Column("runner_last_seen", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("live_status", sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column("pending_elicitation_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("omnigent_conversation_metadata") as batch_op:
        batch_op.drop_column("pending_elicitation_count")
        batch_op.drop_column("live_status")
        batch_op.drop_column("runner_last_seen")

```

### Core Architecture Module: `omnigent/db/migrations/versions/e5c8b1f4a2d7_drop_unused_scheduled_tasks_state_index.py`
```
"""Drop the unused ix_scheduled_tasks_state index.

Revision ID: e5c8b1f4a2d7
Revises: f6d3b8a2c1e9
Create Date: 2026-07-20 00:00:00.000000

``ix_scheduled_tasks_state`` on ``scheduled_tasks``
(``workspace_id, state, created_at, id``) does not earn its keep. Its
per-workspace query shape (``WHERE workspace_id AND state ORDER BY created_at,
id``, i.e. ``list_active``) has no production caller; the scheduler reads active
tasks exactly once at boot via ``list_active_all_workspaces`` (``WHERE state
ORDER BY workspace_id, created_at, id``), which is a near-full scan regardless.

``ix_scheduled_tasks_created_at`` (``workspace_id, created_at, id``) already
serves that boot read: a scan of it yields the exact ``ORDER BY workspace_id,
created_at, id`` the query wants, with ``state`` applied as a residual filter.
The residual check is free here because the store selects whole rows, so
``state`` is already loaded; and ``scheduled_tasks`` is low-cardinality (a
handful of tasks per user, and ``delete`` is a hard delete so no ``deleted``
rows linger), leaving nothing meaningful to skip. So the index is pure
write/space overhead.

The ``state`` column and its ``ck_scheduled_tasks_state`` check constraint are
unchanged -- only the index is removed.

Index-only, no data change. ``DROP``/``CREATE INDEX`` is native on every
dialect (no table rebuild). Downgrade restores the index.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "e5c8b1f4a2d7"
down_revision: str | None = "f6d3b8a2c1e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "ix_scheduled_tasks_state"
_TABLE = "scheduled_tasks"


def upgrade() -> None:
    """Drop the unused (workspace_id, state, created_at, id) index."""
    op.drop_index(_INDEX, table_name=_TABLE)


def downgrade() -> None:
    """Restore the (workspace_id, state, created_at, id) index."""
    op.create_index(_INDEX, _TABLE, ["workspace_id", "state", "created_at", "id"])

```

### Core Architecture Module: `omnigent/db/migrations/versions/f2a3b4c5d6e7_add_session_state_to_conversations.py`
```
"""add session_state to conversations

Revision ID: f2a3b4c5d6e7
Revises: e1c4a7b2f309
Create Date: 2026-06-02 00:00:00.000000

Adds per-conversation session_state column for persisting
policy engine session state across turns. Stored as a JSON
string in a Text column for SQLite compatibility.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2a3b4c5d6e7"
down_revision: str | None = "e1c4a7b2f309"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("conversations") as batch_op:
        batch_op.add_column(
            sa.Column("session_state", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    with op.batch_alter_table("conversations") as batch_op:
        batch_op.drop_column("session_state")

```

### Core Architecture Module: `omnigent/db/utils.py`
```
"""Database utilities — engine caching, session management, helpers."""

from __future__ import annotations

import hashlib
import logging
import os
import random
import threading
import time
import uuid
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager, contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol, TypeVar

from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError, NoSuchModuleError

if TYPE_CHECKING:
    from alembic.config import Config
from sqlalchemy.orm import Session, sessionmaker

from omnigent.db.cockroachdb import (
    _crdb_server_version,
    _initialize_or_verify_crdb_schema,
    _prepare_crdb_schema_transaction,
    _verify_crdb_read_committed,
)
from omnigent.db.metrics import record_transaction_retry
from omnigent.db.query_context import query_name_scope
from omnigent.entities import NewConversationItem

_logger = logging.getLogger(__name__)

# A callable that returns a context manager yielding a Session.
ManagedSessionMaker = Callable[[], AbstractContextManager[Session]]


class NamedManagedSessionMaker(Protocol):
    """Managed session factory carrying its engine and semantic namespace."""

    engine: Engine
    query_name_prefix: str

    def __call__(self, query_name: str) -> AbstractContextManager[Session]: ...


# A zero-argument callable returning a fresh database password (e.g. a
# short-lived Lakebase OAuth token). Invoked once per *new* DBAPI connection.
LakebaseTokenProvider = Callable[[], str]
_T = TypeVar("_T")


# ── Lakebase token-aware connections ───────────────────
#
# Databricks Lakebase (managed Postgres) authenticates with a short-lived
# OAuth token (~1h TTL, rotated) used as the Postgres *password* — there is no
# static password to bake into the URL. To stay connected we must mint a fresh
# token for every new physical connection instead of pinning one at engine
# construction. This is OPT-IN: it activates only when a token provider is
# resolvable (``OMNIGENT_LAKEBASE_INSTANCE`` is set, or a provider was injected
# via :func:`set_lakebase_token_provider`). When it is not active, engine
# creation is byte-for-byte the legacy static-URI path (SQLite or
# static-password Postgres) — see :func:`_create_engine`.

# Env var naming the Lakebase database *instance* whose OAuth token should be
# minted per connection. Its presence is what flips a Postgres engine into
# token-refresh mode.
_LAKEBASE_INSTANCE_ENV = "OMNIGENT_LAKEBASE_INSTANCE"

# Recycle (close + reopen) pooled connections older than this many seconds.
# Static deployments use 30 min (stale-connection hygiene). Lakebase lowers it
# to 10 min so a connection is rebuilt — and its OAuth token re-minted via the
# ``do_connect`` hook — comfortably before the ~1h token lifetime lapses, even
# for connections that sit idle in the pool across a rotation.
_SERVER_POOL_RECYCLE_SECONDS = 1800
_LAKEBASE_POOL_RECYCLE_SECONDS = 600

# Process-wide override, primarily for tests and for callers that want to plug
# in their own token source (e.g. a non-default Databricks auth flow) without
# the env-var path. ``None`` means "not overridden".
_lakebase_token_provider_override: LakebaseTokenProvider | None = None


def set_lakebase_token_provider(provider: LakebaseTokenProvider | None) -> None:
    """
    Install (or clear) a process-wide Lakebase token provider.

    When set, every Postgres engine subsequently created by
    :func:`get_or_create_engine` mints its connection password by calling
    *provider* once per new DBAPI connection, and uses the shorter
    Lakebase pool-recycle window. Pass ``None`` to clear the override and
    fall back to the ``OMNIGENT_LAKEBASE_INSTANCE`` env-var path.

    This is the documented seam for swapping the token source: the default
    env-var path mints tokens via the Databricks SDK
    (:func:`_databricks_lakebase_token_provider`), but a deployment with a
    bespoke credential flow can inject its own zero-arg ``() -> str`` here.

    :param provider: A zero-arg callable returning a fresh password string,
        or ``None`` to clear a previously installed override.
    """
    global _lakebase_token_provider_override
    _lakebase_token_provider_override = provider


def _databricks_lakebase_token_provider(instance_name: str) -> str:
    """
    Mint a fresh short-lived Lakebase OAuth token via the Databricks SDK.

    Uses ambient Databricks authentication (the workspace's app identity /
    service principal when running inside a Databricks App, or a configured
    profile / env credentials elsewhere). The returned token is used as the
    Postgres password for a single connection; it expires in roughly an hour,
    which is why it is re-minted per connection rather than cached.

    :param instance_name: The Lakebase database instance name, e.g.
        ``"omnigent-db"`` (the value of ``OMNIGENT_LAKEBASE_INSTANCE``).
    :returns: A short-lived OAuth token string to use as the DB password.
    :raises ImportError: If the ``databricks-sdk`` (the ``databricks`` extra)
        is not installed.
    """
    from databricks.sdk import WorkspaceClient

    workspace_client = WorkspaceClient()
    credential = workspace_client.database.generate_database_credential(
        request_id=str(uuid.uuid4()),
        instance_names=[instance_name],
    )
    if not credential.token:
        raise RuntimeError(
            f"Databricks returned no Lakebase credential token for instance "
            f"{instance_name!r}. Verify the instance name and that this identity "
            f"has access to it."
        )
    return credential.token


def _resolve_lakebase_token_provider() -> LakebaseTokenProvider | None:
    """
    Return the active Lakebase token provider, or ``None`` if not configured.

    Resolution order:

    1. A provider installed via :func:`set_lakebase_token_provider` (override).
    2. The Databricks SDK provider, bound to the instance named by
       ``OMNIGENT_LAKEBASE_INSTANCE``.
    3. ``None`` — no token path; engines use the static-URI behavior.

    :returns: A zero-arg ``() -> str`` token provider, or ``None``.
    """
    if _lakebase_token_provider_override is not None:
        return _lakebase_token_provider_override
    instance_name = os.environ.get(_LAKEBASE_INSTANCE_ENV)
    if instance_name:
        return lambda: _databricks_lakebase_token_provider(instance_name)
    return None


def _install_lakebase_token_refresh(
    engine: Engine,
    token_provider: LakebaseTokenProvider,
) -> Callable[[object, object, list[object], dict[str, object]], None]:
    """
    Wire *engine* to refresh its connection password on every new connection.

    Registers a SQLAlchemy ``do_connect`` listener that overwrites the
    ``password`` connection parameter with a freshly minted token immediately
    before each physical DBAPI connection is opened. ``do_connect`` fires once
    per *new* connection (not per pool checkout), so pooled connections reuse
    their token until recycled — which is why :func:`_create_engine` pairs this
    with the shorter ``_LAKEBASE_POOL_RECYCLE_SECONDS`` window.

    :param engine: The SQLAlchemy engine to attach the listener to.
    :param token_provider: Zero-arg callable returning a fresh password.
    :returns: The registered listener (returned so callers/tests can assert it
        is wired and exercise it directly).
    """

    def _provide_fresh_token(
        _dialect: object,
        _conn_rec: object,
        _cargs: list[object],
        cparams: dict[str, object],
    ) -> None:
        # do_connect lets us mutate the connection params psycopg receives.
        # Overwriting ``password`` here means the token is read fresh for each
        # new connection — never baked into the cached engine's URL.
        cparams["password"] = token_provider()

    event.listen(engine, "do_connect", _provide_fresh_token)
    return _provide_fresh_token


# ── URL normalization ──────────────────────────────────


def normalize_database_url(url: str) -> str:
    """Rewrite a PaaS ``postgres://`` / ``postgresql://`` URL to the
    ``postgresql+psycopg://`` form SQLAlchemy needs; other URLs pass through.

    :param url: A SQLAlchemy-compatible database URL.
    :returns: The URL with the psycopg3 dialect specifier applied when needed.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    if url.startswith("cockroachdb://"):
        return "cockroachdb+psycopg://" + url[len("cockroachdb://") :]
    return url


def is_cockroachdb(dialect_name: str) -> bool:
    """Return whether *dialect_name* is the CockroachDB dialect."""
    return dialect_name == "cockroachdb"


def is_postgresql_family(dialect_name: str) -> bool:
    """Return whether a dialect accepts PostgreSQL-family DML."""
    return dialect_name in {"postgresql", "cockroachdb"}


def _env_int(name: str, default: int, *, minimum: int) -> int:
    """Read an integer environment setting, treating blank as unset."""
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer, got {raw!r}.") from exc
    if value < minimum:
        raise RuntimeError(f"{name} must be at least {minimum}, got {raw!r}.")
    return value


def _env_float(name: str, default: float, *, minimum: float) -> float:
    """Read a floating-point environment setting, treating blank as unset."""
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a number, got {raw!r}.") from exc

```

### Core Architecture Module: `omnigent/harnesses/claude_native/hook.py`
```
"""Claude Code hook recorder for the native Omnigent wrapper."""

from __future__ import annotations

import argparse
import contextlib
import json
import math
import os
import secrets
import sys
import time
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING

from omnigent.harnesses.claude_native.bridge import (
    BRIDGE_ID_LABEL_KEY,
    CLAUDE_FRAMEWORK_CONTEXT_FILE,
    approval_wait_marker_path,
    hold_approval_wait_marker,
    read_active_session_id,
    read_bridge_id,
    read_claude_session_id,
    read_claude_status_model,
    read_permission_hook_config,
    read_seen_claude_session_ids,
    record_hook_event,
    transcript_has_forked_from_marker,
    transcript_has_recent_local_command,
    url_component,
    write_active_session_id,
)

# The observer path (the default, most frequent invocation — Claude blocks
# on it per Stop/UserPromptSubmit/TaskCreated/...) must not pay the
# httpx/policy import cost; those are imported inside the subcommands and
# helpers that actually speak HTTP.
if TYPE_CHECKING:
    import httpx

# Client-side budget for the permission-request long-poll to AP. Held
# at one day so the hook subprocess waits ~indefinitely for a verdict
# from the web UI (or for Claude to close the connection when the user
# answers in the terminal). Kept in lockstep with the server-side
# ``_CLAUDE_NATIVE_PERMISSION_HOOK_TIMEOUT_S`` and Claude Code's own
# command-hook ``timeout`` so no single layer caps the wait early.
#
# NOTE: this bounds a SINGLE long-poll (a slow human), NOT the retry loop.
# Re-POST attempts after a *failure* are bounded separately by
# ``_PERMISSION_MAX_CONSECUTIVE_FAILURES`` — see :func:`_post_hook_with_reattach`.
# Before #1782 the retry deadline was also one day, so a persistently
# sick/unreachable server made the hook re-POST (each re-driving the turn and
# respawning harness/tool subprocesses) every ≤30s for 24h — the spin-loop half
# of the zombie pileup.
_PERMISSION_TIMEOUT_S = 86400.0
# Every retry after a held-poll sever must land inside the server's
# re-park grace (proxies sever idle long-polls); only hard failures
# back off.
_PERMISSION_RETRY_INITIAL_BACKOFF_S = 1.0
_PERMISSION_RETRY_MAX_BACKOFF_S = 30.0
# Fail unreachable-server connects fast into the backoff loop instead
# of inheriting the day-long read budget.
_PERMISSION_CONNECT_TIMEOUT_S = 30.0


def _env_int(name: str, default: int) -> int:
    """Read an int env override, ignoring a malformed value.

    A non-integer value must not crash the hook subprocess at import time —
    that would defeat the terminal-fallback design elsewhere in this file. Bad
    input logs a diagnostic and falls back to *default*.

    :param name: Environment variable name.
    :param default: Value used when unset or unparseable.
    :returns: The parsed int, or *default*.
    """
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        print(
            f"omnigent hook: ignoring non-integer {name}={raw!r}; using {default}",
            file=sys.stderr,
        )
        return default


def _env_float(name: str, default: float) -> float:
    """Read a float env override, ignoring a malformed value.

    Float sibling of :func:`_env_int`; a bad value logs and falls back to
    *default* rather than crashing the hook at import time.

    :param name: Environment variable name.
    :param default: Value used when unset or unparseable.
    :returns: The parsed float, or *default*.
    """
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        value = math.nan
    # Reject non-finite too: ``float("inf"/"nan")`` parses without ValueError,
    # but an ``inf`` floor would classify every sever as a held poll (disabling
    # flap detection) and ``nan`` makes every ``held_s < floor`` comparison
    # False — both silent footguns, so treat them as malformed.
    if not math.isfinite(value):
        print(
            f"omnigent hook: ignoring non-finite {name}={raw!r}; using {default}",
            file=sys.stderr,
        )
        return default
    return value


# Cap on CONSECUTIVE HARD failures before the reattach loop gives up and lets
# the caller fail-ask. A "hard failure" is the server being sick or unreachable
# (5xx, or a connection that never established) — i.e. the #1782 spin. It is
# distinguished from a proxy severing a *held* poll (a connection that WAS
# established and then dropped mid-wait), which is the re-park mechanism working
# as intended and does NOT count — see :func:`_post_hook_with_reattach`. So a
# legitimately-parked approval behind a severing proxy is never capped, while a
# down server can no longer re-POST for a day. Overridable for operators who
# want more slack against a flaky upstream.
_PERMISSION_MAX_CONSECUTIVE_FAILURES = max(1, _env_int("OMNIGENT_HOOK_MAX_RETRIES", 8))


def _never_connected_errors() -> tuple[type[Exception], ...]:
    """httpx errors meaning the request never reached a live server.

    No response was ever begun — unambiguous hard failures (the server is
    down / unreachable), not a held poll. Everything else under
    ``httpx.HTTPError`` that is not a 4xx/5xx status (RemoteProtocolError,
    ReadError, ReadTimeout, …) means the connection was established and
    then severed mid-poll. A function, not a module constant, so the
    hook's hot observer path never imports httpx.
    """
    import httpx

    return (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout, httpx.ProxyError)


# An established connection that drops in under this many seconds is treated as
# a flapping/crash-looping server (a hard failure), NOT a genuinely-parked poll
# a proxy severed. Comfortably below any real idle-proxy timeout (typically
# 30-60s+) but above an instant accept-then-reset crash drop, so it tells a
# legitimate long-poll sever from a tight establish-drop spin. Operators behind
# an unusually aggressive proxy/LB whose idle timeout is under 10s can lower
# this via OMNIGENT_HOOK_HELD_POLL_FLOOR_S so their legitimate slow-human severs
# stay classified as held polls (not flaps) and are never capped; the default
# suits typical proxies. Floored at 0 (a negative would make every sever a
# held poll, disabling flap detection).
_PERMISSION_HELD_POLL_FLOOR_S = max(0.0, _env_float("OMNIGENT_HOOK_HELD_POLL_FLOOR_S", 10.0))
# Fail-fast budget for the synchronous ``/clear`` and ``/fork`` session
# rotations that run inside the SessionStart hook to gate Claude's
# welcome banner. Unlike the permission long-poll these are quick
# request/reply calls, so they must NOT inherit the day-long permission
# budget — an unresponsive Omnigent server would otherwise hang the banner.
# On timeout the rotation returns ``None`` and the background forwarder
# performs it from the recorded hook event instead.
_SESSION_ROTATION_TIMEOUT_S = 70.0
# Evaluate-policy hooks normally return immediately, but a TOOL_CALL
# ASK now parks server-side (URL-based elicitation) until a human
# resolves it via the approve URL — so the client must wait as long as
# the permission long-poll. Held at one day; the server caps the real
# wait via the deciding policy's ``ask_timeout``.
_EVALUATE_POLICY_TIMEOUT_S = 86400.0
_FORK_COMMAND_NAMES = frozenset({"/branch", "/fork"})
_FORK_TRANSCRIPT_WAIT_S = 1.0
_FORK_TRANSCRIPT_POLL_S = 0.05


def main(argv: list[str] | None = None) -> int:
    """
    Record one Claude Code hook payload from stdin.

    :param argv: Optional argv override excluding program name.
        ``None`` reads :data:`sys.argv`.
    :returns: Process exit code. Returns ``0`` for malformed input
        after writing a diagnostic to stderr so Claude Code itself
        is not blocked by an observer failure.
    """
    raw_argv = sys.argv[1:] if argv is None else argv
    if raw_argv and raw_argv[0] == "observe-tool":
        from omnigent.native.tool_observer_hook import main as observe_main

        return observe_main(raw_argv[1:])
    if raw_argv and raw_argv[0] == "permission-request":
        return _main_permission_request(raw_argv[1:])
    if raw_argv and raw_argv[0] == "ask-user-question":
        # Retired PreToolUse forwarder: settings written before the upgrade
        # still name it until the terminal restarts. Exit 0 with no output so
        # Claude proceeds to the PermissionRequest hook. Remove in 0.16.0.
        sys.stdin.read()
        return 0
    if raw_argv and raw_argv[0] == "evaluate-policy":
        return _main_evaluate_policy(raw_argv[1:])
    if raw_argv and raw_argv[0] == "route-turn":
        return _main_route_turn(raw_argv[1:])
    if raw_argv and raw_argv[0] == "framework-context":
        return _main_framework_context(raw_argv[1:])
    # Backwards compat: older bridge dirs may still reference the
    # pre-tool-use subcommand before the terminal is restarted.
    if raw_argv and raw_argv[0] == "pre-tool-use":
        return _main_evaluate_policy(raw_argv[1:])
    args = _parse_args(raw_argv)
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        print(f"omnigent claude hook: malformed JSON: {exc}", file=sys.stderr)
        return 0
    if not isinstance(payload, dict):
        print("omnigent claude hook: expected JSON object", file=sys.stderr)
        return 0
    bridge_dir = Path(args.bridge_dir)
    from omnigent.harnesses.claude_native.lifecycle import record_hook_lifecycle

    record_hook_lifecycle(bridge_dir, payload, time.time())
    if payload.get("hook_event_name") == "SessionEnd":
        # SessionEnd is diagnostic evidence, not a status or transcript change.
        return 0
    _annotate_resume_session_context(bridge_dir, payload)
    if payload.get("hook_event_name") == "SessionStart" and payload.get("source") == "clear":
        rotated_session_id = _rotate_session_on
```

### Core Architecture Module: `omnigent/harnesses/claude_native/lifecycle.py`
```
"""Durable, allowlisted Claude hook evidence, independent of debug-log capture."""

from __future__ import annotations

import contextlib
import json
import math
import os
import re
import stat
import sys
import uuid
from pathlib import Path
from typing import cast

from filelock import FileLock

from omnigent.inner.terminal_lifecycle import (
    TERMINAL_INSTANCE_ID_ENV,
    TERMINAL_LAUNCH_ID_ENV,
    TERMINAL_LAUNCH_SESSION_ID_ENV,
)

_EVENTS = {"SessionStart", "SessionEnd", "UserPromptSubmit", "Stop", "StopFailure", "PreCompact"}
_REASONS = {
    "prompt_input_exit",
    "clear",
    "logout",
    "session_close",
    "signal",
    "bypass_permissions_disabled",
    "other",
    "unknown",
}
_SOURCES = {"startup", "resume", "clear", "compact"}
_SIGNALS = {"SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"}
_ID = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}\Z")
_LAUNCH_ID = re.compile(r"[0-9a-f]{32}\Z")
_MAX_EVENTS = 16
_MAX_BYTES = 32768
_MAX_OBSERVATIONS = 1_000_000


def _identifier(value: object) -> str | None:
    return value if isinstance(value, str) and _ID.fullmatch(value) else None


def _known(value: object, values: set[str]) -> str | None:
    return value if isinstance(value, str) and value in values else None


def _timestamp(value: object) -> float | None:
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        with contextlib.suppress(OverflowError):
            if math.isfinite(value) and value > 0:
                return float(value)
    return None


def _path(bridge_dir: Path, launch_id: str) -> Path:
    if not _LAUNCH_ID.fullmatch(launch_id):
        raise ValueError("Invalid terminal launch identity")
    return bridge_dir / f"lifecycle-{launch_id}.json"


def _read(path: Path) -> dict[str, object] | None:
    """Bound input and reject links/devices before reading any persisted evidence."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        return None
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1:
            raise ValueError("Lifecycle input is not an owned regular file")
        raw = os.read(fd, _MAX_BYTES + 1)
    finally:
        os.close(fd)
    if len(raw) > _MAX_BYTES:
        raise ValueError("Lifecycle input exceeds its size limit")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("Lifecycle input is not a record")
    return value


def _event(value: object) -> dict[str, object] | None:
    """Project persisted records too, so arbitrary file fields never become logs."""
    if not isinstance(value, dict):
        return None
    name = _known(value.get("event_name"), _EVENTS)
    recorded_at = _timestamp(value.get("recorded_at"))
    if name is None or recorded_at is None:
        return None
    event: dict[str, object] = {
        "event_id": _identifier(value.get("event_id")),
        "event_name": name,
        "recorded_at": recorded_at,
        "timestamp_source": "hook_received",
        "claude_session_id": _identifier(value.get("claude_session_id")),
        "bridge_session_id": _identifier(value.get("bridge_session_id")),
    }
    if name == "SessionStart":
        event["source"] = _known(value.get("source"), _SOURCES) or "unknown"
        event["identity_started_at"] = min(
            _timestamp(value.get("identity_started_at")) or recorded_at, recorded_at
        )
    if name == "SessionEnd":
        event["reason"] = _known(value.get("reason"), _REASONS) or "unknown"
        event["reason_status"] = (
            _known(value.get("reason_status"), {"reported", "missing", "unrecognized"})
            or "unrecognized"
        )
        event["signal"] = _known(value.get("signal"), _SIGNALS)
        event["last_recorded_at"] = _timestamp(value.get("last_recorded_at")) or recorded_at
        count = value.get("observation_count")
        event["observation_count"] = (
            count if type(count) is int and 1 <= count <= _MAX_OBSERVATIONS else 1
        )
    return event


def _events(value: object, omitted: object) -> tuple[list[dict[str, object]], int]:
    """Bound valid history and count malformed and overflow records once."""
    omitted_count = max(0, omitted) if type(omitted) is int else 0
    if not isinstance(value, list):
        return [], omitted_count
    events = [event for item in value if (event := _event(item)) is not None]
    events.sort(key=lambda item: cast(float, item["recorded_at"]))
    retained = events[-_MAX_EVENTS:]
    return retained, omitted_count + len(value) - len(retained)


def record_hook_lifecycle(
    bridge_dir: Path, payload: dict[str, object], recorded_at: float
) -> None:
    """Persist source evidence before rotations/forwarding; never affect the hook result."""
    try:
        name = _known(payload.get("hook_event_name"), _EVENTS)
        if name is None or payload.get("agent_id"):
            return
        instance_id = os.environ.get(TERMINAL_INSTANCE_ID_ENV, "")
        launch_id = os.environ.get(TERMINAL_LAUNCH_ID_ENV, "")
        if not _LAUNCH_ID.fullmatch(instance_id) or not _LAUNCH_ID.fullmatch(launch_id):
            return
        from omnigent.harnesses.claude_native.bridge import (
            _ensure_secure_dir,
            _write_json_file,
            read_active_session_id,
        )

        _ensure_secure_dir(bridge_dir)
        path = _path(bridge_dir, launch_id)
        event: dict[str, object] = {
            "event_id": uuid.uuid4().hex,
            "event_name": name,
            "recorded_at": recorded_at,
            "claude_session_id": _identifier(payload.get("session_id")),
            "bridge_session_id": _identifier(read_active_session_id(bridge_dir)),
            "source": _known(payload.get("source"), _SOURCES),
        }
        if name == "SessionEnd":
            reason = _known(payload.get("reason"), _REASONS)
            event.update(
                reason=reason or "unknown",
                reason_status=(
                    "reported"
                    if reason
                    else "missing"
                    if payload.get("reason") is None
                    else "unrecognized"
                ),
                signal=_known(payload.get("signal"), _SIGNALS),
            )
        projected = _event(event)
        if projected is None:
            return
        # A stuck peer must not hold up a SessionEnd hook indefinitely.
        with FileLock(str(path) + ".lock", mode=0o600, timeout=0.5):
            previous = _read(path)
            if previous is not None and (
                previous.get("schema_version") != 1
                or previous.get("terminal_instance_id") != instance_id
                or previous.get("launch_id") != launch_id
            ):
                return
            previous = previous or {}
            events, omitted = _events(previous.get("events"), previous.get("events_omitted"))
            session_start = _event(previous.get("session_start"))
            if session_start is not None and session_start["event_name"] != "SessionStart":
                session_start = None
            if name == "SessionStart" and (
                session_start is None or recorded_at >= cast(float, session_start["recorded_at"])
            ):
                if (
                    session_start is not None
                    and projected["source"] == "compact"
                    and projected["claude_session_id"] is not None
                    and projected["claude_session_id"] == session_start["claude_session_id"]
                ):
                    # Compaction continues this identity's existing turn history.
                    projected["identity_started_at"] = session_start["identity_started_at"]
                session_start = projected
            if (
                name == "SessionEnd"
                and events
                and all(
                    events[-1].get(key) == projected.get(key)
                    for key in (
                        "event_name",
                        "claude_session_id",
                        "bridge_session_id",
                        "reason",
                        "reason_status",
                        "signal",
                    )
                )
            ):
                last = events[-1]
                last["recorded_at"] = min(cast(float, last["recorded_at"]), recorded_at)
                last["last_recorded_at"] = max(cast(float, last["last_recorded_at"]), recorded_at)
                last["observation_count"] = min(
                    cast(int, last["observation_count"]) + 1, _MAX_OBSERVATIONS
                )
            else:
                events.append(projected)
            events.sort(key=lambda item: cast(float, item["recorded_at"]))
            _write_json_file(
                path,
                {
                    "schema_version": 1,
                    "terminal_instance_id": instance_id,
                    "launch_id": launch_id,
                    "launch_session_id": _identifier(
                        os.environ.get(TERMINAL_LAUNCH_SESSION_ID_ENV)
                    ),
                    "session_start": session_start,
                    "events": events[-_MAX_EVENTS:],
                    "events_omitted": omitted + max(0, len(events) - _MAX_EVENTS),
                },
            )
    except Exception:  # noqa: BLE001 - telemetry must never block Claude's shutdown.
        # The exception or payload can contain paths or user input.
        with contextlib.suppress(Exception):
            print("omnigent claude lifecycle: could not record hook evidence", file=sys.stderr)


def read_lifecycle_snapshot(
    bridge_dir: Path | None, instance_id: str, launch_id: str
) -> dict[str, object]:
    """Read only this launch's evidence; missing hooks do not imply a voluntary exit."""
    result: dict[str, object] = {
        "sessio
```

### Core Architecture Module: `omnigent/harnesses/claude_native/message_display_hook.py`
```
"""
Fast ``MessageDisplay`` hook for the native Omnigent Claude wrapper.

Claude Code fires the ``MessageDisplay`` hook once per streamed text
chunk while an assistant message is rendered in the TUI. Claude
**blocks** on command hooks, so this module is deliberately tiny: it
imports only the standard library (no ``httpx``/``claude_native_bridge``
import cost on the per-chunk hot path) and does nothing but append one
structured JSON line to ``<bridge_dir>/message_deltas.jsonl``.

The background transcript forwarder tails that file and turns each line
into a ``response.output_text.delta`` SSE event for the web UI, then
reconciles the live buffer against the authoritative final message item
from the transcript. Keeping HTTP out of this hook is what makes live
streaming smooth — see ``CLAUDE_NATIVE_LIVE_TEXT_STREAMING`` design notes
and :mod:`omnigent.harnesses.claude_native.forwarder`.

Observed ``MessageDisplay`` payload (this Claude build)::

    {
      "hook_event_name": "MessageDisplay",
      "session_id": "<claude-session-uuid>",
      "transcript_path": "/.../<session>.jsonl",
      "cwd": "/path/to/workspace",
      "turn_id": "<turn-uuid>",
      "message_id": "<stable-per-assistant-message-uuid>",
      "index": 7,            # 0-based chunk order within the message
      "final": false,        # true on the last chunk of the message
      "delta": "incremental text for this chunk"
    }

``message_id`` is stable per assistant message and ``delta`` is
incremental (consecutive ``index`` values carry disjoint text), so the
full message is the concatenation of chunks ordered by ``index`` for a
given ``message_id``. Note ``message_id``/``turn_id`` do **not** appear
in Claude's transcript JSONL, so the forwarder/frontend correlate the
live buffer to the final item positionally (FIFO), not by id value.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

# Append-only deltas file written in the bridge directory. The forwarder
# imports this constant so both sides agree on the path without the
# forwarder paying this module's (stdlib-only) import cost on its hot
# path. Kept here because this module is the writer.
MESSAGE_DELTAS_FILE = "message_deltas.jsonl"


def main(argv: list[str] | None = None) -> int:
    """
    Append one ``MessageDisplay`` chunk to the bridge deltas file.

    :param argv: Optional argv override excluding the program name.
        ``None`` reads :data:`sys.argv`.
    :returns: Process exit code. Always ``0`` — a hook failure must
        never block Claude Code, so malformed input or write errors
        are reported on stderr and swallowed.
    """
    raw_argv = sys.argv[1:] if argv is None else argv
    args = _parse_args(raw_argv)
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        print(f"omnigent message-display hook: malformed JSON: {exc}", file=sys.stderr)
        return 0
    if not isinstance(payload, dict):
        print("omnigent message-display hook: expected JSON object", file=sys.stderr)
        return 0

    record = _delta_record(payload)
    if record is None:
        # Nothing forwardable (e.g. missing message_id or non-string
        # delta). Stay silent on the common no-op rather than spamming
        # stderr for every benign payload shape.
        return 0

    line = json.dumps(record, separators=(",", ":")) + "\n"
    path = os.path.join(args.bridge_dir, MESSAGE_DELTAS_FILE)
    try:
        # O_APPEND makes a single short-line write atomic on POSIX, so
        # concurrent per-chunk hook subprocesses never interleave their
        # lines. ``encode`` once and write the whole buffer in one call.
        fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        try:
            os.write(fd, line.encode("utf-8"))
        finally:
            os.close(fd)
    except OSError as exc:
        print(f"omnigent message-display hook: write failed: {exc}", file=sys.stderr)
        return 0
    return 0


def _delta_record(payload: dict[str, object]) -> dict[str, object] | None:
    """
    Extract the forwardable fields from a ``MessageDisplay`` payload.

    :param payload: Hook JSON object read from Claude Code stdin, e.g.
        ``{"hook_event_name": "MessageDisplay", "message_id": "m1",
        "index": 0, "final": false, "delta": "Hello"}``.
    :returns: A compact record ``{"message_id", "index", "final",
        "delta"}`` suitable for the deltas file, or ``None`` when the
        payload lacks a usable ``message_id``/``delta`` pair.
    """
    message_id = payload.get("message_id")
    delta = payload.get("delta")
    if not isinstance(message_id, str) or not message_id:
        return None
    if not isinstance(delta, str):
        return None
    raw_index = payload.get("index")
    # ``index`` orders chunks within a message; treat a missing/invalid
    # value as 0 so a single-chunk message still forwards cleanly.
    index = raw_index if isinstance(raw_index, int) and not isinstance(raw_index, bool) else 0
    final = bool(payload.get("final"))
    return {
        "message_id": message_id,
        "index": index,
        "final": final,
        "delta": delta,
    }


def _parse_args(argv: list[str]) -> argparse.Namespace:
    """
    Parse ``MessageDisplay`` hook arguments.

    :param argv: CLI argv excluding the program name, e.g.
        ``["--bridge-dir", "/tmp/bridge"]``.
    :returns: Parsed argparse namespace with a ``bridge_dir`` attribute.
    """
    parser = argparse.ArgumentParser(
        prog="python -m omnigent.harnesses.claude_native.message_display_hook"
    )
    parser.add_argument("--bridge-dir", required=True)
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9199** (2026-10-06): **Incomplete tunnel responses leave header waiters and request slots unresolved**
  *Symptoms*: ## Problem  Runner tunnel request state can record response completion while leaving its HTTP-header future unresolved. The transport is still waiting on that future, so it cannot return a response or run its normal request-slot cleanup.  ## Expected Behavior  Response completion must settle every request waiter. When HTTP headers are absent, report a protocol error through the existing abort path and release the request slot. Preserve successful empty responses, responses whose headers already arrived, and existing error/cancellation behavior.  ## Verification  Use bounded, in-process request-state and transport tests to check completion without headers, normal empty responses, cancellation, and cleanup. No live-service or network fault injection is needed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":10.0,"content_hash":"e8b18173a881e2eb3ae44adfbfe1e593c13931b27c9819dff07bd7e67a2aefd3","information_status":"needs_info","needs_info_deadline":"2026-10-13"} --> 🤖 **Automated triage**  - **Bot assessment:** Low impact - **Priority:** `P3-low` - **Information status:** More information needed  Please add the following details so this bug can be investigated:   - [ ] what happened instead, including the exact error   - [ ] the Omnigent version and relevant environment details   - [ ] logs, screenshots, or session IDs that show the failure  Please update the issue by **2026-10-13** (within 7 days). A comment or body edit will trigger another review; if the report is still missing this information after the deadline, it may be closed automatically.  - **Why:** No type override: this reports allegedly incorrect existing transport behavior, so it remains a Bug. The report identifies a plausible internal trigger and expec
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #7941, #9198, #7352 may be related — could you take a look in case they already cover this?  If it turns out to be the same problem, please close this one and add your details there. Otherwise leave a note and we'll pick it up here. 

- **Issue #9139** (2026-10-05): **[Bug] Files e2e: test_file_autosave non-markdown cases fail on main**
  *Symptoms*: `tests/e2e_ui/files/test_file_autosave.py::test_non_markdown_edit_autosaves` fails on current `main` for 3 of its 4 cases (`short`, `past-agent-line-cap`, `50k-lines`). Only the markdown case passes.  Observed locally with the repo's e2e harness (`uv run --frozen python -m dev.repro_env --output <env> exec -- python -m pytest tests/e2e_ui/files/test_file_autosave.py`) at `3b913e8e`: - **`short`:** the typed sentinel line lands at the end of the file instead of the top, so the saved-content assertion fails (`'# autosaved_py_sentinel…'` expected first). - **`past-agent-line-cap` and `50k-lines`:** after `Control+End` the test never reveals `file_end_marker`.  The same 1-passed/3-failed result reproduces on a branch that doesn't touch the editor, which suggests a Monaco cursor/navigation problem in the test or the viewer. It doesn't look environmental. Found while running the Files e2e suite for #8925.  Suggested next step: check how the test positions the cursor before typing, and whether Monaco's `Control+End` handling changed with the full-preview change in #8933. 
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":10.0,"content_hash":"7fc36c9355be292459b11890a194a5ac7432beba096e9ca57cf6b1a78d9edac6","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Low impact - **Priority:** `P3-low` - **Evidence:** a controlled test - **Why:** The issue remains a Bug because it reports observed failures in an existing E2E test rather than requesting a new capability. The supplied command provides direct reproduction preconditions, identifies the failing parametrized cases, records the differing symptoms, and reports a comparison branch that isolates the editor/viewer path, so the evidence is sufficient for investigation. The affected user/CUJ is editing and autosaving files in the web UI; the reported failures do not establish that no  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.

- **Issue #9121** (2026-10-05): **[Bug] Cancelling native direct attach leaves the tmux client alive**
  *Symptoms*: ### Problem  The Claude and Codex direct-attach wrappers await a spawned tmux client without consistently owning its cleanup. Cancellation or a post-spawn profiler/event error can leave that client attached, and a failed Claude pane watcher can replace the caller's original cancellation with its own exception.  ### Reproduction  Start direct attach, wait for the client subprocess to launch, then cancel the wrapper. The baseline leaves the attach child alive. A profiler failure after spawn has the same leak; a failed pane watcher can mask cancellation during teardown.  ### Expected behavior  Terminate and reap only the disposable attach client on an abnormal exit, preserve the runner-owned server/pane/backend, and propagate the original cancellation or error. Normal detach and exit behavior must remain unchanged.  ### Environment  Reproduced with controlled local tests on Linux and Python 3.12.3, Omnigent 0.17.0.dev0 at commit `257fd25b5`. The reproduction does not require live model credentials. 
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":30.0,"content_hash":"ae72285ad84fb4f1682037d03586091cacd2bb339515bf8107f0aab09dbc5b9c","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Medium impact - **Priority:** `P2-medium` - **Evidence:** a controlled test - **Why:** This remains a Bug because it reports incorrect cleanup of an existing direct-attach workflow, not a new capability. The supplied reproduction is a controlled test on Linux/Python 3.12.3 that starts direct attach, waits for the tmux client, cancels the wrapper, and observes the attach child leak; profiler-error and pane-watcher teardown variants provide additional failure paths. Users attempting to create or cancel a native Claude or Codex session can be left with a live disposable tmux client,   This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #9070, #9117, #7406 may be related — could you take a look in case they already cover this?  If it turns out to be the same problem, please close this one and add your details there. Otherwise leave a note and we'll pick it up here. 

- **Issue #9119** (2026-10-05): **[Bug] Replacement harnesses inherit a retired process's active-turn marker**
  *Symptoms*: ### Problem  A crashed, released, or switched harness can leave its in-flight response ID behind after its process is retired. A replacement then reports busy despite having no active turn, receives stray interrupt requests, and remains protected from idle cleanup indefinitely.  ### Reproduction  Mark a response active, kill the harness, and request its replacement. The baseline still reports has_active_turn=True and forwards cancellation to the idle replacement. Explicit release and harness/config/model replacement can retain the same stale marker.  ### Expected behavior  Retire the old generation's active marker under the existing per-conversation serialization. Healthy cached processes and genuinely active turns must retain idle-reaper protection; later replacement turns must be able to mark themselves normally.  ### Environment  Reproduced with controlled local tests on Linux and Python 3.12.3, Omnigent 0.17.0.dev0 at commit `257fd25b5`. The reproduction does not require live model credentials. 
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":60.0,"content_hash":"0c6a06464289cf3dd2d700441c1dcf7d310489760be72ff7ce6a469bf8ec496a","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** High impact - **Priority:** `P1-high` - **Evidence:** a controlled test - **Why:** This is a Bug because it reports incorrect lifecycle behavior in existing harness replacement, not a request for new capability. The author reports controlled local tests showing that retiring a harness leaves an active-turn marker attached to its replacement generation, causing false busy status, stray cancellation, and indefinite idle-reaper protection. The affected CUJ is resuming or continuing a session after a harness crash, release, or configuration/model switch; that replacement path can   This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #2865, #1414, #5067 may be related, and have already been fixed — so the fixes may have shipped after the build you're on.  Could you check whether you're on a version that includes them? If you are and this still happens, say so here — that makes it a regression rather than a duplicate, and we'll keep this open. 

- **Issue #9113** (2026-10-05): **[Bug] Compaction can retain a tool result after summarizing away its call**
  *Symptoms*: ### Problem  The recent-history boundary can fall between parallel function calls and their results. Layer 2 then summarizes away an earlier call while retaining its output, producing an invalid next model request with an orphaned tool result.  ### Reproduction  Build valid history with two parallel calls followed by both results and compact with recent_window=1. The baseline retains only the last call but both results. Overlapping/interleaved exchanges can propagate the same split farther backward.  ### Expected behavior  Move the protected boundary before any tool exchange that it would split, including overlapping exchanges. Completely closed older pairs should remain eligible for summarization, and the persisted summary coverage cursor must match the adjusted boundary.  ### Environment  Reproduced with controlled local tests on Linux and Python 3.12.3, Omnigent 0.17.0.dev0 at commit `257fd25b5`. The reproduction does not require live model credentials. 
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":60.0,"content_hash":"78e9e6ce8309cf89594fe2ccf28667afb24146844ae847dd4cfb6986e30f1655","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** High impact - **Priority:** `P1-high` - **Evidence:** a controlled test - **Why:** This remains a Bug because it reports confirmed incorrect compaction behavior rather than requesting a new capability. Controlled local tests reproduce a valid parallel-call history becoming invalid after Layer 2 compaction, with Linux, Python 3.12.3, and a specific Omnigent commit supplied, so the report is sufficiently actionable. The affected CUJ is continuing a session and submitting the next request; the malformed history can block the next model turn for sessions that compact overlapping p  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #2448 may be related, and has already been fixed — so the fix may have shipped after the build you're on.  Could you check whether you're on a version that includes it? If you are and this still happens, say so here — that makes it a regression rather than a duplicate, and we'll keep this open. 

- **Issue #9107** (2026-10-05): **[Bug] Runner stream EOF silently stops relaying an active session**
  *Symptoms*: ### Problem  The runner session-stream protocol sends [DONE] when a stream intentionally finishes. The server relay currently also treats a bare HTTP EOF as successful completion. A connection closed without the sentinel can therefore remove the relay while the session remains running and later output stops reaching the client.  ### Reproduction  Have a runner stream emit a running status and end its HTTP body without [DONE]. A subsequent connection can supply idle/output, but the current supervisor never opens that connection because the first relay returned normally.  ### Expected behavior  An EOF without [DONE] should enter the existing transport-recovery path. Explicit [DONE], intentional Stop, and cancellation should preserve their existing behavior, and an unrecovered connection should still expire its grace period.  ### Environment  Reproduced with controlled local tests on Linux and Python 3.12.3, Omnigent 0.17.0.dev0 at commit `257fd25b5`. The reproduction does not require live model credentials. 
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":60.0,"content_hash":"7b12fc249656016bb8e8ef7c12bb561c129733646c6fa4625d4cf6d4d8d5204e","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** High impact - **Priority:** `P1-high` - **Evidence:** a controlled test - **Why:** The report is a Bug and remains classified as such because it describes incorrect existing relay behavior, not a request for new capability. Controlled local tests reportedly reproduced a runner stream that emits status and then ends without [DONE], after which the supervisor fails to reconnect and active-session output stops. This affects the submit/request-and-receive-progress CUJ for sessions experiencing the EOF: the session may continue running, but clients no longer receive progress or res  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #4458 may be related, and has already been fixed — so the fix may have shipped after the build you're on.  Could you check whether you're on a version that includes it? If you are and this still happens, say so here — that makes it a regression rather than a duplicate, and we'll keep this open. 

- **Issue #9095** (2026-10-05): **[Bug] Relay handoff discards idle status before a failed disconnect lookup**
  *Symptoms*: ## Description  A runner reconnect can adopt an idle subsession on a server with an empty live-status cache. The reconnect hook reads the saved idle state, but the new relay discards it. If the stream only emits heartbeats and the later disconnect-time conversation lookup fails or returns no row, the relay treats the status as unknown and emits `runner_disconnected`, despite having read idle during adoption.  The child is marked failed and a failed activity can be added to its parent's transcript. Expected: retain the known adoption status as a fallback and keep an idle child at warning severity. New live events and a fresh saved row must take precedence, and running/waiting children must still fail when interrupted.  ## Steps to reproduce  1. Save an idle parent and idle child bound to the same runner. 2. Reconnect the runner to a server with an empty session-status cache, allowing the real reconnect hook to create the relays. 3. Have the child's stream emit a ready heartbeat with no new status edge. 4. Make the disconnect-time conversation read return no row or raise an exception, then drop the stream past its reconnect grace. 5. Observe `runner_disconnect_decision` with `status_source=unknown`, followed by `session_turn_failed` and `runner_disconnected`.  A controlled regression using a real WebSocket reconnect hook, real relay, SQLite store, and a scripted heartbeat-only transport reproduces both lookup variants. The test is `test_on_runner_connect_retains_idle_child_stat
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":30.0,"content_hash":"dff2fd42d237061d8dc2a03a0a5faf7c0dbaa30a4b589482f98dc157dc5a1800","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Medium impact - **Priority:** `P2-medium` - **Evidence:** a controlled test - **Why:** This remains a Bug because it reports incorrect existing disconnect behavior, not a request for new capability. A controlled integration regression with a real reconnect hook, relay, SQLite store, and scripted heartbeat transport reproduces the failure under the stated preconditions. Users with idle child sessions during server handoff may see the child incorrectly marked failed and a failed activity added to the parent transcript; this can corrupt status presentation but does not block the core  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. This looks like the same problem as #9075, which has already been fixed — so the fix may have shipped after the build you're on.  Could you check whether you're on a version that includes it? If you are and this still happens, say so here — that makes it a regression rather than a duplicate, and we'll keep this open. 

- **Issue #9085** (2026-10-05): **[Bug] Executor import failure blocks independent runner credential recovery**
  *Symptoms*: ## Description  Runner credential recovery imports `omnigent.inner.databricks_executor` before trying delegated runner credentials or a stored/refreshed OIDC login. If that import fails, the exception escapes before the existing credential-probe handler and managed-mint fallback. A runner can therefore keep retrying a rejected bootstrap bearer even when another configured provider could supply a valid token.  The SDK/executor dependency should be loaded only when SDK authentication is actually needed. An unavailable SDK must not block a valid independent provider, and must not fabricate a credential when no provider works.  ## Reproduction evidence  A controlled regression on main `5b97bc3b9`:  1. Build the real runner auth factory with a synthetic host bootstrap bearer and a configured alternative provider. 2. Mark the executor module unavailable before the first renewal, using pytest's isolated `sys.modules` override. 3. Invalidate the bootstrap bearer, as the reconnect path does after rejection. 4. Call the real factory again.  Stored OIDC, refreshed OIDC, explicit delegation, and the existing managed-mint fallback all raise `ModuleNotFoundError` before they can return their usable credential. A fifth case with no alternative also raises outside the intended probe handler. All five cases fail on the unmodified base.  This reproduces the import/fallback ordering defect; it does not establish why any particular installation became inconsistent.  ## Environment and impact  - 
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":60.0,"content_hash":"d6a545169bd9e56de322876e1c95d7b2b16f6e2a189b166678af13009e149a38","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** High impact - **Priority:** `P1-high` - **Evidence:** a controlled test - **Why:** No type override is needed: the report describes incorrect existing behavior and supplies a controlled regression. The failure occurred under explicit preconditions—a synthetic bootstrap bearer, an alternative provider, executor-module unavailability, and an invalidated bootstrap token—and the real auth factory consistently raised ModuleNotFoundError before usable fallback credentials could be returned. This blocks the reconnect portion of the runner/session CUJ for users whose bootstrap credent  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #7199, #4332, #1953 may be related, and have already been fixed — so the fixes may have shipped after the build you're on.  Could you check whether you're on a version that includes them? If you are and this still happens, say so here — that makes it a regression rather than a duplicate, and we'll keep this open. 

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

### Incident Patch 1: `8c5b635a` (2026-10-06)
**Commit Message**: fix(tunnel): settle header waiters on incomplete response completion (#9200)

Signed-off-by: Harry Yao <[REDACTED_EMAIL]>
Co-authored-by: Harry Yao <[REDACTED_EMAIL]>

**File**: `omnigent/runner/transports/ws_tunnel/registry.py` (modified, +11/-0)
```diff
@@ -922,6 +922,17 @@ def _end_response_body(state: RequestState) -> None:
     :param state: Request state whose body iterator should stop.
     :returns: None.
     """
+    if not state.head_future.done():
+        # A response cannot complete before its head. Wake the head waiter so
+        # a malformed or truncated runner response cannot hold the request.
+        _abort_request_state(
+            state,
+            httpx.RemoteProtocolError(
+                "runner sent response.end before response.head",
+                request=None,  # type: ignore[arg-type]
+            ),
+        )
+        return
     state.end_event.set()
     # Push a sentinel so any pending body_queue.get() unblocks.
     state.body_queue.put_nowait(None)
```

**File**: `tests/runner/transports/ws_tunnel/test_transport.py` (modified, +23/-0)
```diff
@@ -153,6 +153,29 @@ async def test_handle_async_request_with_body() -> None:
     assert response.status_code == 201
 
 
+@pytest.mark.asyncio
+async def test_response_end_before_head_aborts_request_and_releases_slot() -> None:
+    """An end frame without a head must not leave the transport waiting forever."""
+    reg = TunnelRegistry()
+    session = reg.register("r1", _NoopWS(), _hello())
+    transport = WSTunnelTransport(reg, "r1")
+
+    task = asyncio.create_task(transport.handle_async_request(_make_request("GET", "/bad")))
+    for _ in range(100):
+        if session.in_flight:
+            break
+        await asyncio.sleep(0)
+    else:
+        pytest.fail("request did not open before the bounded test window")
+
+    req_id = next(iter(session.in_flight))
+    assert reg.route_response_frame("r1", ResponseEndFrame(id=req_id)) is True
+
+    with pytest.raises(httpx.RemoteProtocolError, match=r"before response\.head"):
+        await asyncio.wait_for(task, timeout=0.2)
+    assert req_id not in session.in_flight
+
+
 # ── _TunneledByteStream: abort propagation ─────────────
 
 
```

---

### Incident Patch 2: `d24856cb` (2026-10-06)
**Commit Message**: Polish mobile chat and settings UX (part 1) (#9191)

* Polish mobile settings and composer UX

Signed-off-by: Ajay Alfred <[REDACTED_EMAIL]>

* Polish responsive settings and chat UI

Signed-off-by: Ajay Alfred <[REDACTED_EMAIL]>

* Polish mobile sidebar and composer context bar

Signed-off-by: Ajay Alfred <[REDACTED_EMAIL]>

---------

Signed-off-by: Ajay Alfred <[REDACTED_EMAIL]>

**File**: `tests/browser_ui/chat/test_composer_geometry_contract.py` (modified, +3/-1)
```diff
@@ -236,7 +236,9 @@ def test_label_collapse_preserves_submit_geometry(
     _surface(page, chat, surface, DESKTOP)
     card_locator = page.locator("[data-composer-card]")
     expanded_inset = right_inset(box(card_locator), box(_submit(page, surface)))
-    page.set_viewport_size({"width": 280, "height": PHONE["height"]})
+    # Exercise the narrowest common phone width after the mobile composer
+    # adopted 24px outer gutters.
+    page.set_viewport_size({"width": 320, "height": PHONE["height"]})
     expect(_action_row(page, surface)).to_have_attribute("data-labels", "collapsed")
     collapsed_inset = right_inset(box(card_locator), box(_submit(page, surface)))
     assert collapsed_inset == pytest.approx(expanded_inset, abs=TOLERANCE)
```

**File**: `tests/browser_ui/test_sessions_appearance.py` (modified, +4/-4)
```diff
@@ -150,10 +150,10 @@ def test_reset_button_has_rendered_top_margin(page: Page, appearance_url: str) -
     _open_appearance(page, appearance_url)
     gap = page.get_by_test_id("reset-appearance-button").evaluate(
         """button => {
-            const wrapper = button.closest('div');
-            const controls = wrapper.previousElementSibling;
-            if (!controls) throw new Error('controls column sibling not found');
-            return wrapper.getBoundingClientRect().top - controls.getBoundingClientRect().bottom;
+            const group = button.closest('[data-testid="settings-group-data"]');
+            const controls = group?.previousElementSibling;
+            if (!group || !controls) throw new Error('appearance groups not found');
+            return group.getBoundingClientRect().top - controls.getBoundingClientRect().bottom;
         }"""
     )
     assert gap >= 24, f"Reset button margin is only {gap:.0f}px; expected at least 24px"
```

**File**: `tests/e2e_ui/chat/test_composer_acceptance.py` (modified, +4/-2)
```diff
@@ -195,8 +195,10 @@ def snapshot(route):
     page.screenshot(path=tmp_path / f"status-page-{theme}.png", animations="disabled")
     directory_icon = icon_bounds["composer-workspace-dir"][0]
     center_y = directory_icon["y"] + directory_icon["height"] / 2
-    assert bounds["height"] == pytest.approx(37, abs=0.5)
-    assert center_y == pytest.approx(bounds["y"] + 19, abs=0.5)
+    expected_bar_height = 28 if is_mobile else 37
+    expected_center_offset = 14 if is_mobile else 19
+    assert bounds["height"] == pytest.approx(expected_bar_height, abs=0.5)
+    assert center_y == pytest.approx(bounds["y"] + expected_center_offset, abs=0.5)
     trailing = control_bounds[status_ids[-1]]
     # The docked tray's content inset matches the card's shared inset
     # (1px border + 12px padding).
```

**File**: `tests/e2e_ui/github/test_github_tab.py` (modified, +5/-3)
```diff
@@ -350,14 +350,16 @@ def session_details(route: Route) -> None:
         expect(panel).to_have_attribute("data-state", "closed")
         expect(pr_link).to_be_in_viewport()
 
-    expected_font_size = font_size * 0.9 * (14 / 13 if is_mobile else 1)
+    expected_font_size = font_size * 0.9
     for test_id, actual_font_size in font_sizes.items():
         assert actual_font_size == pytest.approx(expected_font_size, abs=0.01), (
             f"{test_id} should use the caption size at {font_size}px preference: {font_sizes}"
         )
     reference_center = centers["composer-workspace-dir.icon"]
-    assert bar_bounds["height"] == pytest.approx(37, abs=0.1)
-    assert reference_center == pytest.approx(bar_bounds["y"] + 19, abs=0.5)
+    expected_bar_height = 28 if is_mobile else 37
+    expected_center_offset = 14 if is_mobile else 19
+    assert bar_bounds["height"] == pytest.approx(expected_bar_height, abs=0.1)
+    assert reference_center == pytest.approx(bar_bounds["y"] + expected_center_offset, abs=0.5)
     for name, center in centers.items():
         assert center == pytest.approx(reference_center, abs=0.5), (name, centers)
     for name, pair_gap in pair_gaps.items():
```

**File**: `tests/e2e_ui/mobile/test_composer_input_font_size.py` (modified, +6/-10)
```diff
@@ -1,7 +1,4 @@
-"""Composer inputs avoid Safari's small-text focus-zoom trigger without capping preferences.
-
-Desktop WebKit verifies CSS and focus, not the real iOS software keyboard's zoom.
-"""
+"""Composer inputs follow the interface font preference across app surfaces."""
 
 from __future__ import annotations
 
@@ -69,15 +66,15 @@ def _exercise_input(page: Page, element: Locator, *, mobile: bool) -> None:
         pytest.param(390, 18, True, marks=_TOUCH, id="ios-large"),
     ],
 )
-def test_composer_input_font_floor_and_alignment(
+def test_composer_input_font_setting_and_alignment(
     page: Page,
     seeded_session: tuple[str, str],
     tmp_path: Path,
     width: int,
     font_size: int,
     native: bool,
 ) -> None:
-    """Landing, command backdrops and interleaved replies share readable input typography."""
+    """Landing, command backdrops and interleaved replies share the chosen typography."""
     base_url, session_id = seeded_session
     mobile = width < 768
     page.set_viewport_size({"width": width, "height": 844})
@@ -159,16 +156,15 @@ def test_composer_input_font_floor_and_alignment(
 
     # Preserve every surface's baseline evidence before reporting typography failures.
     print(f"Composer typography ({width}px, preference={font_size}, native={native}): {observed}")
-    ui_size = font_size * (14 / 13) if mobile else font_size
-    expected_size = max(16, ui_size) if mobile else ui_size
+    expected_size = font_size
     for name, measured in observed.items():
         assert measured["fontSize"] == pytest.approx(expected_size, abs=0.01), (name, measured)
         assert measured["lineHeight"] == pytest.approx(expected_size * 1.6, abs=0.02), (
             name,
             measured,
         )
-    assert quote_metrics["fontSize"] == pytest.approx(ui_size * 0.9, abs=0.01)
-    assert skill_metrics["fontSize"] == pytest.approx(ui_size, abs=0.01)
+    assert quote_metrics["fontSize"] == pytest.approx(expected_size * 0.9, abs=0.01)
+    assert skill_metrics["fontSize"] == pytest.approx(expected_size, abs=0.01)
 
     textarea_metrics, overlay_metrics = observed["slash-input"], observed["slash-overlay"]
     for property_name in (
```

**File**: `tests/e2e_ui/mobile/test_mobile_ui_font_size_applies.py` (modified, +3/-3)
```diff
@@ -87,9 +87,9 @@ def test_mobile_ui_font_size_applies_not_just_saves(page: Page, live_server: str
     value = page.get_by_test_id("ui-font-size-input")
     increase = page.get_by_test_id("ui-font-size-inc")
 
-    # Fresh context: the default 13px choice; mobile renders text-ui at its
-    # own base size. Capture that rendered baseline before touching anything.
-    expect(value).to_have_value("13")
+    # Fresh context: mobile defaults to 14px. Capture that rendered baseline
+    # before touching anything.
+    expect(value).to_have_value("14")
     baseline_px = _rendered_ui_text_px(page)
 
     # Step to the 18px maximum — a "significant" increase per the report.
```

**File**: `web/src/components/SettingsGroup.tsx` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import type { ReactNode } from "react";
+
+import { cn } from "@/lib/utils";
+
+interface SettingsGroupProps {
+  title: string;
+  children: ReactNode;
+  className?: string;
+  contentClassName?: string;
+  testId?: string;
+}
+
+/** General-style Settings group: subsection title above one outlined card. */
+export function SettingsGroup({
+  title,
+  children,
+  className,
+  contentClassName,
+  testId,
+}: SettingsGroupProps) {
+  return (
+    <section className={cn("flex flex-col gap-3", className)} data-testid={testId}>
+      <h2 className="text-ui font-medium">{title}</h2>
+      <div className={cn("rounded-xl border border-border bg-card p-4", contentClassName)}>
+        {children}
+      </div>
+    </section>
+  );
+}
```

**File**: `web/src/components/SettingsLabel.test.tsx` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { cleanup, fireEvent, render, screen } from "@testing-library/react";
+import { afterEach, describe, expect, it } from "vitest";
+
+import { SettingsLabel } from "./SettingsLabel";
+
+afterEach(cleanup);
+
+describe("SettingsLabel", () => {
+  it("moves mobile help into an inline tooltip while retaining the desktop description", async () => {
+    render(
+      <SettingsLabel
+        label="Interface font size"
+        description="Set text across the interface."
+        descriptionId="font-size-description"
+      />,
+    );
+
+    const description = document.getElementById("font-size-description");
+    expect(description).toHaveClass("max-md:hidden");
+    expect(screen.getByText("Interface font size")).toHaveClass("font-normal", "md:font-medium");
+
+    const trigger = screen.getByRole("button", { name: "About Interface font size" });
+    expect(trigger).toHaveClass("md:hidden");
+
+    fireEvent.click(trigger);
+    expect(await screen.findByRole("tooltip")).toHaveTextContent("Set text across the interface.");
+  });
+});
```

---

### Incident Patch 3: `40b61d23` (2026-10-06)
**Commit Message**: fix(hosts): fast, actionable rejection when a host is too old for harness-setup frames (#6356)

* fix(hosts): fast, actionable rejection when a host is too old for harness-setup frames

POST /v1/hosts/{id}/harnesses/{harness}/credential forwarded
host.store_secret to any live host connection. A daemon predating the
frame (<= 0.6.x) can't decode it and silently drops it, so the route
burned the full 30s store-secret timeout and answered 504 "host ... did
not respond to store_secret within 30s" - blaming responsiveness on a
host that is online and healthy but will never answer. In the setup
dialog, Save spun for the full 30s with no feedback before the
misleading toast. The sibling proxies (detect_credentials,
install_harness, model_options - all first shipped in the 0.7.0 daemon)
shared the same gap.

Fix at both ends of the tunnel:

- host.hello now advertises `capabilities`: the request-frame kinds the
  daemon's dispatcher serves, so support is explicit going forward.
- The server gates the four harness-setup proxies before forwarding.
  Advertised capabilities are authoritative; hosts that predate the
  advertisement are judged against the 0.7.0 floor where those frames
  first 

**File**: `omnigent/server/routes/hosts.py` (modified, +69/-5)
```diff
@@ -24,6 +24,7 @@
 from typing import Any
 
 from fastapi import APIRouter, HTTPException, Query, Request
+from packaging.version import InvalidVersion, Version
 from pydantic import BaseModel
 
 from omnigent.db.utils import now_epoch
@@ -127,6 +128,59 @@ def _done(completed: asyncio.Task[None]) -> None:
 _host_absent_error = host_absent_error
 
 
+# The harness-setup frames (install_harness, store_secret, detect_credentials,
+# model_options) first shipped in the 0.7.0 host daemon; older daemons drop them
+# without replying. ``_require_harness_setup_support`` explains the version floor.
+_HARNESS_SETUP_MIN_HOST_VERSION = (0, 7, 0)
+
+
+def _release_tuple(version: str) -> tuple[int, int, int] | None:
+    """Parse the release component of a reported version, PEP 440 style.
+
+    Handles every shape omnigent has shipped — ``"0.6.0"``, ``"0.6.0rc1"``,
+    ``"0.13.0.dev0"`` — so a prerelease of an old daemon is still judged
+    against the floor rather than falling through as unparseable.
+
+    :param version: Hello-reported version.
+    :returns: The release tuple padded to ``(major, minor, patch)``, or
+        ``None`` when the version isn't PEP 440 at all.
+    """
+    try:
+        release = Version(version).release
+    except InvalidVersion:
+        return None
+    padded = (*release, 0, 0, 0)[:3]
+    return (padded[0], padded[1], padded[2])
+
+
+def _require_harness_setup_support(host_conn: HostConnection, action: str) -> None:
+    """Reject fast when the daemon predates the harness-setup frames.
+
+    Pre-0.7.0 daemons have no handler for these frames and drop them without
+    replying, so forwarding one can only end in a timeout misread as an
+    unresponsive host. The floor is a version check, not a capability token:
+    the frames predate ``HostHelloFrame.capabilities``, and released
+    0.15.x/0.16.x daemons advertise tokens without a harness-setup entry while
+    serving them. Unparseable versions stay permissive.
+
+    :param host_conn: Live host connection (carries the hello).
+    :param action: Human phrase for the rejected action, e.g.
+        ``"storing harness credentials"``; lands in the error detail.
+    :raises HTTPException: 409 with an update-the-host hint when too old.
+    """
+    hello = host_conn.hello
+    release = _release_tuple(hello.version)
+    if release is None or release >= _HARNESS_SETUP_MIN_HOST_VERSION:
+        return
+    raise HTTPException(
+        status_code=409,
+        detail=(
+            f"host '{hello.name}' runs omnigent {hello.version}, which does not "
+            f"support {action} — update omnigent on the host and retry"
+        ),
+    )
+
+
 async def _proxy_model_options(
     *,
     host_registry: HostRegistry,
@@ -724,6 +778,10 @@ async def get_host_model_options(
         A preview of the host's ambient default catalog, not a binding
         snapshot: launch re-resolves with the session's agent spec, and the
         in-session picker reflects that launch snapshot once the runner is up.
+
+        :raises HTTPException: 404 when the host is unknown, 403 when not the
+            owner, 409 when offline or the host daemon is too old to list model
+            options, 502 on host-side failure, 504 on timeout.
         """
         user_id = require_user(request, auth_provider)
         host = await asyncio.to_thread(host_store.get_host, host_id)
@@ -734,6 +792,7 @@ async def get_host_model_options(
         conn = host_registry.get(host.host_id)
         if conn is None:
             raise _host_absent_error(host)
+        _require_harness_setup_support(conn, "pre-launch model listing")
 
         result = await _proxy_model_options(
             host_registry=host_registry,
@@ -1407,8 +1466,9 @@ async def install_host_harness(
             (``None`` when the host didn't report one).
         :raises HTTPException: 404 when the feature is disabled or the host is
             unknown, 400 when the harness is not UI-installable, 403 when the
-            caller is not the host owner, 409 when the host is offline, 502 on
-            a host-side install failure, 504 on host timeout.
+            caller is not the host owner, 409 when the host is offline or its
+            daemon is too old to install harnesses, 502 on a host-side install
+            failure, 504 on host timeout.
         """
         # A disabled route is indistinguishable from a non-existent one, so
         # the feature is fully dark until the deployment opts in.
@@ -1437,6 +1497,7 @@ async def install_host_harness(
         conn = host_registry.get(host.host_id)
         if conn is None:
             raise _host_absent_error(host)
+        _require_harness_setup_support(conn, "UI-driven harness installs")
 
         # Coalesce concurrent installs of the same harness FAMILY onto one
         # in-flight request so a double-click (or `codex` + `codex-native`, which
@@ -1523,8 +1584,8 @@ async def store_host_harness_credential(
             the host di
```

**File**: `openapi.json` (modified, +4/-4)
```diff
@@ -9919,7 +9919,7 @@
     },
     "/v1/hosts/{host_id}/credentials/detected": {
       "get": {
-        "description": "List adoptable credentials already present on a connected host.\n\nBacks the setup dialog's \"adopt an existing credential\" affordance: the\nhost reports which UI-auth-family credentials it already has as\nNON-secret descriptors (family + source label + env var name), so the UI\ncan offer a one-click \"Use it\". Owner-scoped and flag-gated like the\ncredential-write route (404 when disabled). Never returns a secret value.\n\n**Returns:** `{\"object\": \"detected_credentials\", \"credentials\": [...]}`.\n\n**Raises**\n\n- `HTTPException` \u2014 404 when disabled or host unknown, 403 when not the owner, 409 when offline, 502/504 on host failure/timeout.",
+        "description": "List adoptable credentials already present on a connected host.\n\nBacks the setup dialog's \"adopt an existing credential\" affordance: the\nhost reports which UI-auth-family credentials it already has as\nNON-secret descriptors (family + source label + env var name), so the UI\ncan offer a one-click \"Use it\". Owner-scoped and flag-gated like the\ncredential-write route (404 when disabled). Never returns a secret value.\n\n**Returns:** `{\"object\": \"detected_credentials\", \"credentials\": [...]}`.\n\n**Raises**\n\n- `HTTPException` \u2014 404 when disabled or host unknown, 403 when not the owner, 409 when offline or the host daemon is too old to detect credentials, 502/504 on host failure/timeout.",
         "operationId": "detect_host_credentials_v1_hosts__host_id__credentials_detected_get",
         "parameters": [
           {
@@ -10287,7 +10287,7 @@
     },
     "/v1/hosts/{host_id}/harnesses/{harness}/credential": {
       "post": {
-        "description": "Write a harness provider credential onto a connected host.\n\nBacks the Web UI setup dialog's \"Add a credential\" action so a user can\nconfigure a Claude / Codex / Pi credential on a connected host without a\nterminal. Owner-scoped, allowlisted, and gated behind\n`harness_install` release feature exactly like the install route\n(404 when disabled). The host daemon does the write with the same\nnon-interactive core the `omnigent setup` wizard uses.\n\nSecurity: the server is an authz'd pass-through \u2014 it validates\nownership + the allowlist and forwards the secret over the (TLS) tunnel;\nit never persists the secret or logs it. The secret rides in the request\nbody (not the URL), and the frame field is redaction-named so it never\nlands on a telemetry span.\n\n**Parameters**\n\n- `body` \u2014 The credential payload (kind + secret / gateway / adopt).\n\n**Returns:** `{\"object\": \"harness_credential\", \"harness\": ..., \"configured_harnesses\": {...}, \"gateway_inference\": {...} | None}` \u2014 refreshed readiness so the UI can flip the badge without a reconnect, plus the refreshed gateway-inference map (`None` when the host didn't report one).\n\n**Raises**\n\n- `HTTPException` \u2014 404 when disabled or host unknown, 400 when the harness isn't UI-configurable or the body is invalid, 403 when not the owner, 409 when offline, 502 on host-side failure, 504 on timeout.",
+        "description": "Write a harness provider credential onto a connected host.\n\nBacks the Web UI setup dialog's \"Add a credential\" action so a user can\nconfigure a Claude / Codex / Pi credential on a connected host without a\nterminal. Owner-scoped, allowlisted, and gated behind\n`harness_install` release feature exactly like the install route\n(404 when disabled). The host daemon does the write with the same\nnon-interactive core the `omnigent setup` wizard uses.\n\nSecurity: the server is an authz'd pass-through \u2014 it validates\nownership + the allowlist and forwards the secret over the (TLS) tunnel;\nit never persists the secret or logs it. The secret rides in the request\nbody (not the URL), and the frame field is redaction-named so it never\nlands on a telemetry span.\n\n**Parameters**\n\n- `body` \u2014 The credential payload (kind + secret / gateway / adopt).\n\n**Returns:** `{\"object\": \"harness_credential\", \"harness\": ..., \"configured_harnesses\": {...}, \"gateway_inference\": {...} | None}` \u2014 refreshed readiness so the UI can flip the badge without a reconnect, plus the refreshed gateway-inference map (`None` when the host didn't report one).\n\n**Raises**\n\n- `HTTPException` \u2014 404 when disabled or host unknown, 400 when the harness isn't UI-configurable or the body is invalid, 403 when not the owner, 409 when offline or the host daemon is too old to store credentials, 502 on host-side failure, 504 on timeout.",
         "operationId": "store_host_harness_credential_v1_hosts__host_id__harnesses__harness__credential_post",
         "parameters": [
           {
@@ -10353,7 +10353,7 @@
     },
     "/v1/hosts/{host_id}/harnesses/{harness}/install": {
       "post": {
-        "description": "Install a missing, npm-installable harness CLI 
```

**File**: `tests/e2e_ui/start_session/test_harness_credential_old_host.py` (added, +323/-0)
```diff
@@ -0,0 +1,323 @@
+"""E2E: saving a harness credential to a host running omnigent v0.6.0.
+
+A 0.6.0 host daemon predates ``host.store_secret``: it cannot decode the frame
+and drops it without replying. The bug lived between the credential route and
+the tunnel, so ``test_harness_credential.py``'s ``page.route`` stub cannot reach
+it. Here a fake v0.6.0 host connects over the real host WebSocket tunnel, sends
+the 0.6.0 hello, answers only frame kinds that release knew and drops the rest,
+while the real SPA drives the real server. The shared ``live_server`` does not
+enable ``harness_install``, so a dedicated server is spawned with it on.
+
+Browser journeys run on a fresh thread and loop (``tests._helpers.async_thread``)
+because pytest-asyncio can't start a loop on the main thread once a sync
+pytest-playwright test has run in the session.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import contextlib
+import json
+import os
+import signal
+import subprocess
+import sys
+import time
+import uuid
+from collections.abc import AsyncIterator, Iterator
+from typing import Any
+
+import httpx
+import pytest
+from playwright.async_api import async_playwright, expect
+
+from omnigent.host.frames import (
+    HostCreateDirResultFrame,
+    HostHelloFrame,
+    HostListDirResultFrame,
+    HostListWorktreesResultFrame,
+    HostStatResultFrame,
+    encode_host_frame,
+)
+from omnigent.runner.transports.ws_tunnel.frames import (
+    PingFrame,
+    PongFrame,
+    decode_frame,
+    encode_frame,
+)
+from tests._helpers.async_thread import run_in_fresh_loop as _run_in_fresh_loop
+from tests.e2e_ui.conftest import _BUILD_OUTPUT, _REPO_ROOT, _find_free_port
+
+_HOST_NAME = "old-host-0-6-0-e2e"
+_HARNESS = "claude-native"
+
+# The dedicated server cold-boots alongside the suite's shared one; give it a
+# wider window than the shared fixture's 30s so CI can't flake on the spawn.
+_SERVER_BOOT_TIMEOUT_S = 180.0
+
+# Feedback must land well before the route's 30 s store_secret timeout; 20 s
+# leaves slack for CI scheduling.
+_PROMPT_FEEDBACK_S = 20.0
+
+
+# ── Fake v0.6.0 host ─────────────────────────────────────────────────────────
+
+
+async def _serve_old_host(ws: Any) -> None:
+    """Serve frames like a v0.6.0 host daemon.
+
+    Answers the filesystem probes the landing page may send and the tunnel
+    keepalive pings; every frame kind 0.6.0 did not know (``store_secret``,
+    ``detect_credentials``, ``model_options``, ...) is dropped without a reply,
+    exactly like the real old daemon.
+    """
+    async for raw in ws:
+        if not isinstance(raw, str):
+            continue
+        try:
+            payload = json.loads(raw)
+        except ValueError:
+            continue
+        if not isinstance(payload, dict):
+            continue
+        kind = payload.get("kind")
+        request_id = str(payload.get("request_id", ""))
+        reply: Any = None
+        if kind == "host.stat":
+            reply = HostStatResultFrame(
+                request_id=request_id,
+                status="ok",
+                exists=True,
+                type="directory",
+                canonical_path=payload.get("path", "~"),
+            )
+        elif kind == "host.list_dir":
+            reply = HostListDirResultFrame(request_id=request_id, status="ok", entries=[])
+        elif kind == "host.create_dir":
+            reply = HostCreateDirResultFrame(request_id=request_id, status="ok")
+        elif kind == "host.list_worktrees":
+            reply = HostListWorktreesResultFrame(
+                request_id=request_id, status="failed", error="not a git repository"
+            )
+        if reply is not None:
+            await ws.send(encode_host_frame(reply))
+            continue
+        if isinstance(kind, str) and kind.startswith("host."):
+            continue
+        try:
+            runner_frame = decode_frame(raw)
+        except ValueError:
+            continue
+        if isinstance(runner_frame, PingFrame):
+            await ws.send(encode_frame(PongFrame(ts=runner_frame.ts)))
+
+
+@contextlib.asynccontextmanager
+async def _old_host(base_url: str) -> AsyncIterator[str]:
+    """Connect a fake v0.6.0 host to the live server's host tunnel.
+
+    Sends the hello a 0.6.0 daemon sends: ``version="0.6.0"``, wire protocol 1,
+    and a readiness map marking claude-native installed-but-unauthenticated —
+    the state whose fix is exactly the credential write under test.
+
+    :param base_url: The dedicated server's base URL.
+    :returns: Async context manager yielding the REST-reported host id.
+    """
+    import websockets
+
+    host_id = uuid.uuid4().hex
+    ws_url = base_url.replace("http://", "ws://") + f"/v1/hosts/{host_id}/tunnel"
+    async with websockets.connect(ws_url) as ws:
+        await ws.send(
+            encode_host_frame(
+                HostHelloFrame(
+                    version="0.6.0",
+                    frame_protocol_version=1,
+        
```

**File**: `tests/server/integration/test_hosts_store_credential.py` (modified, +226/-4)
```diff
@@ -15,6 +15,8 @@
 from __future__ import annotations
 
 import asyncio
+import json
+import time
 from collections.abc import AsyncIterator
 from contextlib import suppress
 from typing import Any
@@ -27,6 +29,7 @@
 
 from omnigent.errors import OmnigentError
 from omnigent.host.frames import (
+    CAP_CODEX_SIDE_CHAT,
     HostDetectCredentialsFrame,
     HostDetectCredentialsResultFrame,
     HostHelloFrame,
@@ -43,6 +46,7 @@
     SqlAlchemyConversationStore,
 )
 from omnigent.stores.host_store import HostStore
+from omnigent.version import VERSION
 from tests.server.helpers import websocket_scope as _websocket_scope
 
 pytestmark = [
@@ -60,23 +64,63 @@ def _enable_flag(monkeypatch: pytest.MonkeyPatch) -> None:
     monkeypatch.setenv("OMNIGENT_FEATURES", "harness_install")
 
 
-def _hello_text(name: str = _HOST_NAME) -> str:
+def _hello_text(
+    name: str = _HOST_NAME,
+    version: str = VERSION,
+    capabilities: list[str] | None = None,
+) -> str:
+    """Hello from a current daemon; ``version`` is this tree's, well above the floor."""
     return encode_host_frame(
-        HostHelloFrame(version="0.1.0-test", frame_protocol_version=1, name=name)
+        HostHelloFrame(
+            version=version,
+            frame_protocol_version=1,
+            name=name,
+            capabilities=list(capabilities or []),
+        )
+    )
+
+
+# The hello fields a 0.6.0 host daemon sends; that release predates ``capabilities``.
+_OLD_HOST_HELLO_FIELDS = (
+    "kind",
+    "version",
+    "frame_protocol_version",
+    "name",
+    "runners",
+    "configured_harnesses",
+    "telemetry_opt_out",
+    "installation_id",
+)
+
+
+def _old_host_hello_text(version: str, name: str = _HOST_NAME) -> str:
+    """Hello as sent by a daemon that predates capability advertisement."""
+    full = json.loads(
+        encode_host_frame(HostHelloFrame(version=version, frame_protocol_version=1, name=name))
     )
+    return json.dumps({k: full[k] for k in _OLD_HOST_HELLO_FIELDS if k in full})
 
 
-async def _connect_mock_host(app: FastAPI, registry: HostRegistry) -> ApplicationCommunicator:
+async def _connect_mock_host(
+    app: FastAPI,
+    registry: HostRegistry,
+    hello: str | None = None,
+) -> ApplicationCommunicator:
     comm = ApplicationCommunicator(app, _websocket_scope(f"/v1/hosts/{_HOST_ID}/tunnel"))
     await comm.send_input({"type": "websocket.connect"})
     accepted = await comm.receive_output(timeout=1.0)
     assert accepted["type"] == "websocket.accept"
-    await comm.send_input({"type": "websocket.receive", "text": _hello_text()})
+    await comm.send_input({"type": "websocket.receive", "text": hello or _hello_text()})
     while registry.get(_HOST_ID) is None:
         await asyncio.sleep(0.01)
     return comm
 
 
+async def _disconnect_mock_host(comm: ApplicationCommunicator) -> None:
+    await comm.send_input({"type": "websocket.disconnect", "code": 1000})
+    await comm.wait(timeout=5.0)
+
+
 @pytest.fixture()
 def cred_app(
     db_uri: str,
@@ -499,6 +543,184 @@ async def test_offline_host_returns_409(
     assert resp.status_code == 409
 
 
+def _auto_reply_store_secret(
+    comm: ApplicationCommunicator,
+    received: list[HostStoreSecretFrame],
+) -> asyncio.Task[None]:
+    """Record + auto-ack every forwarded ``host.store_secret`` frame.
+
+    Keeps the old-host gate tests honest AND terminating: a gate regression
+    forwards the frame, which lands in ``received`` (failing the assertion)
+    instead of dead-waiting the route's 30s timeout. Cancel the task to stop.
+    """
+
+    async def _drain() -> None:
+        while True:
+            output = await comm.receive_output(timeout=None)
+            text = output.get("text")
+            if output.get("type") != "websocket.send" or not isinstance(text, str):
+                continue
+            try:
+                frame = decode_host_frame(text)
+            except ValueError:
+                # Non-host frames (e.g. keepalive pings) are not the drain's concern.
+                continue
+            if not isinstance(frame, HostStoreSecretFrame):
+                continue
+            received.append(frame)
+            await comm.send_input(
+                {
+                    "type": "websocket.receive",
+                    "text": encode_host_frame(
+                        HostStoreSecretResultFrame(
+                            request_id=frame.request_id,
+                            status="ok",
+                            configured_harnesses={frame.harness: True},
+                        )
+                    ),
+                }
+            )
+
+    return asyncio.create_task(_drain())
+
+
+def _record_forwarded_kinds(comm: ApplicationCommunicator, kinds: list[str]) -> asyncio.Task[None]:
+    """Record the ``kind`` of every frame the server forwards to the mock host."""
+
+    async def _drain() -> None:
+        while True:
+            output = await comm.receive_output(timeout=None)
+    
```

---

### Incident Patch 4: `740a5f6d` (2026-10-06)
**Commit Message**: fix(runner): give a slow launch-config read time to answer (#9160)

A native terminal's launch reads the session's launch config from the
server with GET /v1/sessions/<id>. Each attempt timed out after 10 s,
but the server's slow tail answers in 10-15 s, so all three attempts
timed out and the launch failed. In the 7 days to 2026-10-05 this
failed Codex and Pi launches and next turns in 8 sessions.

Raise the per-attempt timeout to 20 s. The retry count and backoff are
unchanged, so a server that really is down still fails within about a
minute.

Signed-off-by: harry-yao_data <[REDACTED_EMAIL]>
Co-authored-by: harry-yao_data <[REDACTED_EMAIL]>
Co-authored-by: Isaac <[REDACTED_EMAIL]>

**File**: `omnigent/runner/native/orchestration.py` (modified, +6/-4)
```diff
@@ -945,7 +945,9 @@ def _kiro_session_workspace(session_workspace: str | None) -> Path:
 # under load. Left un-retried it fails Codex terminal launch, ensure, and the
 # next turn from one blip; a bounded retry rides it out (the read is idempotent)
 # before surfacing a server-attributed hard error, so persistent cases fail loud.
-_LAUNCH_CONFIG_FETCH_TIMEOUT_S = 10.0
+# Slow reads take 10-15 s. A shorter timeout makes every retry time out, and makes
+# the single-attempt launch metadata reads below fall back to their defaults.
+_LAUNCH_CONFIG_FETCH_TIMEOUT_S = 20.0
 _LAUNCH_CONFIG_FETCH_ATTEMPTS = 3
 _LAUNCH_CONFIG_FETCH_BACKOFF_BASE_S = 0.5
 _LAUNCH_CONFIG_FETCH_BACKOFF_CAP_S = 4.0
@@ -6966,7 +6968,7 @@ async def _session_payload_for_host_spawn_check(
         resp = await server_client.get(
             f"/v1/sessions/{urllib.parse.quote(session_id, safe='')}",
             params=_SESSION_METADATA_PARAMS,
-            timeout=10.0,
+            timeout=_LAUNCH_CONFIG_FETCH_TIMEOUT_S,
         )
     except httpx.HTTPError:
         _logger.warning(
@@ -7938,7 +7940,7 @@ async def _load_legacy_claude_launch_metadata(
         response = await server_client.get(
             f"/v1/sessions/{urllib.parse.quote(session_id, safe='')}",
             params=_SESSION_METADATA_PARAMS,
-            timeout=10.0,
+            timeout=_LAUNCH_CONFIG_FETCH_TIMEOUT_S,
         )
     except httpx.HTTPError:
         _logger.debug(
@@ -9921,7 +9923,7 @@ async def _claude_native_session_wants_rebuild(
         resp = await server_client.get(
             f"/v1/sessions/{urllib.parse.quote(session_id, safe='')}",
             params=_SESSION_METADATA_PARAMS,
-            timeout=10.0,
+            timeout=_LAUNCH_CONFIG_FETCH_TIMEOUT_S,
         )
     except httpx.HTTPError:
         return False
```

**File**: `tests/runner/test_codex_native_launch_config.py` (modified, +1/-1)
```diff
@@ -246,7 +246,7 @@ def _handle(request: httpx.Request) -> httpx.Response:
         "include_liveness": "false",
         "include_usage": "false",
     }
-    assert requests[0].extensions["timeout"]["read"] == 10.0
+    assert requests[0].extensions["timeout"]["read"] == 20.0
 
 
 @pytest.mark.asyncio
```

---

### Incident Patch 5: `2587e801` (2026-10-06)
**Commit Message**: fix(pi-native): keep parallel tool results adjacent in resume rebuild (#6486)

* fix(pi-native): keep parallel tool results adjacent in resume rebuild

The Omnigent-items -> Pi session JSONL converter emitted every
function_call as its own single-toolCall assistant message and the
response text as another, so a fork/cold-resume of a session whose
response made parallel tool calls rebuilt a history that stranded the
toolResults behind an unrelated assistant message. Pi maps each rebuilt
message to its own Anthropic Messages entry, so the clone's first
provider request violated the tool_use/tool_result pairing contract
(HTTP 400 'unexpected tool_use_id found in tool_result blocks') and the
resumed session could never continue.

Merge consecutive assistant-side items that share a response_id into
one Pi assistant message (text plus all toolCall blocks) -- the shape
Pi itself persists -- so every toolResult stays adjacent to the
assistant message holding its call on replay.

* test(pi-native): update fork e2e references for the harness module regroup

The resume rebuild moved to omnigent/harnesses/pi_native/resume.py and the
pi-native entry points to omnigent/harnesses/pi_native/main.p

**File**: `omnigent/harnesses/pi_native/resume.py` (modified, +161/-107)
```diff
@@ -36,6 +36,7 @@
 import os
 import re
 import uuid
+from dataclasses import dataclass
 from datetime import datetime, timezone
 from pathlib import Path
 from typing import cast
@@ -215,10 +216,14 @@ def pi_session_records_from_session_items(
     items map as:
 
     - user ``message`` -> Pi ``message`` with ``role: "user"``.
-    - assistant ``message`` -> Pi ``message`` with ``role: "assistant"`` and a
-      text content block.
-    - ``function_call`` -> Pi ``message`` with ``role: "assistant"`` whose
-      content carries a ``toolCall`` block.
+    - assistant ``message`` / ``function_call`` -> ONE Pi assistant ``message``
+      per model response: consecutive items sharing a ``response_id`` merge
+      their text and ``toolCall`` blocks, the shape Pi itself persists for a
+      response with (parallel) tool calls. Keeping sibling calls and the
+      response text in a single assistant message keeps every ``toolResult``
+      adjacent to the message holding its call, which the Anthropic
+      tool_use/tool_result pairing contract requires when Pi replays the
+      rebuilt history.
     - ``function_call_output`` -> Pi ``message`` with ``role: "toolResult"``.
       Only the first output committed for a ``call_id`` is replayed: Anthropic
       rejects a history with two ``tool_result`` blocks for one ``tool_use``.
@@ -251,59 +256,149 @@ def pi_session_records_from_session_items(
     parent_id: str | None = None
     skip_response_ids = _interrupted_response_ids(items)
     replayed_call_ids: set[str] = set()
+    group: _AssistantResponseGroup | None = None
+
+    def append_entry(entry: _JsonObject) -> None:
+        nonlocal parent_id
+        entry["parentId"] = parent_id
+        records.append(entry)
+        parent_id = cast(str, entry["id"])
+
+    def flush_group() -> None:
+        nonlocal group
+        if group is None:
+            return
+        append_entry(
+            {
+                "type": "message",
+                "id": group.entry_id,
+                "timestamp": timestamp,
+                "message": _pi_assistant_message(
+                    group.blocks, provider=provider, model=group.model or model
+                ),
+            }
+        )
+        group = None
 
     for index, item in enumerate(items):
         response_id = item.get("response_id")
         if isinstance(response_id, str) and response_id in skip_response_ids:
             continue
-        if item.get("type") == "function_call_output":
-            call_id = item.get("call_id")
-            if isinstance(call_id, str) and call_id:
-                # Replay one result per call: a repeated output would make the
-                # next model turn fail with "each tool_use must have a single result".
-                if call_id in replayed_call_ids:
-                    continue
-                replayed_call_ids.add(call_id)
-        entries = _pi_entries_from_session_item(
-            item,
-            session_id=session_id,
-            external_session_id=external_session_id,
-            index=index,
-            timestamp=timestamp,
-            provider=provider,
-            model=model,
-        )
-        for entry in entries:
-            entry["parentId"] = parent_id
-            records.append(entry)
-            parent_id = cast(str, entry["id"])
+        blocks = _pi_assistant_blocks_from_item(item)
+        if blocks is None:
+            if item.get("type") == "function_call_output":
+                call_id = item.get("call_id")
+                if isinstance(call_id, str) and call_id:
+                    # Replay one result per call: a repeated output would make the
+                    # next model turn fail with "each tool_use must have a single result".
+                    if call_id in replayed_call_ids:
+                        continue
+                    replayed_call_ids.add(call_id)
+            entry = _pi_non_assistant_entry(
+                item,
+                session_id=session_id,
+                external_session_id=external_session_id,
+                index=index,
+                timestamp=timestamp,
+            )
+            if entry is not None:
+                # Only a replayable entry ends the open response. An item that maps
+                # to nothing (e.g. reasoning) must not split the response, or its
+                # parallel tool results would be orphaned from their calls again.
+                flush_group()
+                append_entry(entry)
+            continue
+        rid = response_id if isinstance(response_id, str) and response_id else None
+        item_model = item.get("model")
+        eff_model = item_model if isinstance(item_model, str) else ""
+        if group is not None and rid is not None and group.response_id == rid:
+            group.blocks.extend(blocks)
+            group.model = group.model or eff_model
+            continue
+        flush_group()
+        if blocks:
+            group = _AssistantResp
```

**File**: `tests/e2e/test_pi_native_fork_parallel_tool_results_e2e.py` (added, +239/-0)
```diff
@@ -0,0 +1,239 @@
+"""A real Pi fork must retain paired parallel tools and mixed assistant text."""
+
+from __future__ import annotations
+
+import json
+import os
+import secrets
+import shutil
+import subprocess
+import sys
+import tempfile
+import threading
+import time
+from collections.abc import Callable, Iterator
+from contextlib import suppress
+from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
+from pathlib import Path
+from typing import Any
+
+import httpx
+import pytest
+
+from omnigent.harnesses.pi_native.main import _SESSION_LABELS, _materialize_pi_agent_spec
+from omnigent.runner.identity import OMNIGENT_INTERNAL_WS_ORIGIN, token_bound_runner_id
+from tests._helpers.live_server import isolated_local_server, local_server_env, terminate_process
+from tests._helpers.session import bind_session_runner, bundle_files, post_session_bundle
+from tests.e2e._harness_probes import cli_unavailable_reason
+from tests.server.integration.mock_llm_server import (
+    anthropic_sse_text_response,
+    anthropic_sse_tool_call_response,
+)
+
+pytestmark = pytest.mark.timeout(900, method="signal")
+_MODEL = "pi-mock-sonnet"
+_CALL_IDS = ["toolu_par_a", "toolu_par_b"]
+_MIXED_TEXT = "Reading both seeded files."
+
+
+def _wait(predicate: Callable[[], Any]) -> Any:
+    deadline = time.monotonic() + 300
+    while time.monotonic() < deadline:
+        if result := predicate():
+            return result
+        time.sleep(0.5)
+    raise AssertionError("Timed out waiting for Pi; inspect server.log and runner.log")
+
+
+def _parallel_response(workspace: Path) -> str:
+    stream = anthropic_sse_tool_call_response(
+        [
+            {"call_id": call_id, "name": "read", "arguments": json.dumps({"path": str(path)})}
+            for call_id, path in zip(_CALL_IDS, sorted(workspace.glob("*.txt")), strict=True)
+        ],
+        model=_MODEL,
+    )
+    # Append a text block to the same assistant response as the two tool calls.
+    text_events = "\n\n".join(
+        event.replace('"index": 0', '"index": 2')
+        for event in anthropic_sse_text_response(_MIXED_TEXT).split("\n\n")
+        if event.startswith("event: content_block_")
+    )
+    return stream.replace("event: message_delta", f"{text_events}\n\nevent: message_delta")
+
+
+@pytest.fixture
+def pi_fork_rig(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> Iterator[tuple[httpx.Client, str, list[dict[str, Any]]]]:
+    pi_binary = os.environ.get("OMNIGENT_PI_PATH") or shutil.which("pi")
+    for binary in (pi_binary or "pi", "node"):
+        if reason := cli_unavailable_reason(binary):
+            pytest.skip(reason)
+    if shutil.which("tmux") is None:
+        pytest.skip("tmux is required for the real Pi terminal")
+    workspace, config, home = (tmp_path / name for name in ("workspace", "config", "home"))
+    for directory in (workspace, config, home):
+        directory.mkdir()
+    for name in ("alpha", "beta"):
+        (workspace / f"{name}.txt").write_text(f"{name}-contents\n")
+    replies = [
+        _parallel_response(workspace),
+        anthropic_sse_text_response("PARALLEL-TOOLS-DONE", model=_MODEL),
+        anthropic_sse_text_response("FORK-RESUME-OK", model=_MODEL),
+    ]
+    requests: list[dict[str, Any]] = []
+
+    class Handler(BaseHTTPRequestHandler):
+        def do_POST(self) -> None:
+            assert self.path.split("?", 1)[0] == "/v1/messages"
+            requests.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
+            payload = replies.pop(0).encode()
+            self.send_response(200)
+            self.send_header("Content-Type", "text/event-stream")
+            self.send_header("Content-Length", str(len(payload)))
+            self.end_headers()
+            self.wfile.write(payload)
+
+    sidecar = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
+    thread = threading.Thread(target=sidecar.serve_forever, daemon=True)
+    thread.start()
+    (config / "config.yaml").write_text(
+        "providers:\n  mock-pi:\n    kind: key\n    default: [anthropic]\n"
+        f"    anthropic:\n      base_url: http://127.0.0.1:{sidecar.server_port}\n"
+        f"      api_key: mock-key\n      models:\n        default: {_MODEL}\n"
+    )
+    for key in list(os.environ):
+        if key.startswith(("OMNIGENT_", "RUNNER_", "PI_", "OPENAI_", "ANTHROPIC_")):
+            monkeypatch.delenv(key)
+    monkeypatch.setenv("OMNIGENT_CONFIG_HOME", str(config))
+    monkeypatch.setenv("OMNIGENT_DATA_DIR", str(config))
+    token = secrets.token_urlsafe(32)
+    runner_id = token_bound_runner_id(token)
+    try:
+        with (
+            tempfile.TemporaryDirectory(prefix="pi-fork-", dir="/tmp") as short_tmp,
+            isolated_local_server(tmp_path) as base_url,
+            httpx.Client(
+                base_url=base_url,
+                trust_env=False,
+                timeout=30,
+                headers={"Origin": OMNIGENT_INTERNAL_WS_ORIGIN},
+          
```

**File**: `tests/harnesses/pi_native/test_pi_native_resume.py` (modified, +67/-0)
```diff
@@ -281,6 +281,73 @@ def test_full_tool_roundtrip_chains_correctly() -> None:
         assert cur["parentId"] == prev["id"]
 
 
+@pytest.mark.parametrize(
+    "call_count,text_index,reasoning",
+    [(2, 0, False), (2, 2, False), (2, 1, True), (1, 1, False)],
+    ids=["text-first", "text-last", "interleaved-reasoning", "single-call"],
+)
+def test_response_keeps_tool_calls_and_results_adjacent(
+    call_count: int, text_index: int, reasoning: bool
+) -> None:
+    call_ids = [f"c{i}" for i in range(call_count)]
+    response = [
+        _function_call_item(name="read", call_id=cid, arguments="{}", item_id=cid)
+        for cid in call_ids
+    ]
+    response.insert(text_index, _assistant_item("Reading files."))
+    if reasoning:
+        response.insert(1, {"type": "reasoning", "id": "thinking", "response_id": "r1"})
+    items = [
+        _user_item("read files"),
+        *response,
+        *[
+            _function_output_item(call_id=cid, output=cid, item_id=f"out-{cid}")
+            for cid in call_ids
+        ],
+        _assistant_item("Done.", item_id="final", response_id="r2"),
+    ]
+    records = pi_session_records_from_session_items(
+        items, session_id="conv_abc", external_session_id=_EXTERNAL_ID, cwd=Path("/repo")
+    )
+    entries = records[1:]
+    messages = [entry["message"] for entry in entries]
+    assert [msg["role"] for msg in messages] == [
+        "user",
+        "assistant",
+        *["toolResult"] * call_count,
+        "assistant",
+    ]
+    content = messages[1]["content"]
+    assert [b["type"] for b in content] == (
+        ["toolCall"] * text_index + ["text"] + ["toolCall"] * (call_count - text_index)
+    )
+    assert [b["id"] for b in content if b["type"] == "toolCall"] == call_ids
+    assert content[text_index] == {"type": "text", "text": "Reading files."}
+    assert messages[1]["model"] == "claude-opus-4-8"
+    assert [msg["toolCallId"] for msg in messages[2:-1]] == call_ids
+    assert entries[0]["parentId"] is None
+    for prev, cur in itertools.pairwise(entries):
+        assert cur["parentId"] == prev["id"]
+    again = pi_session_records_from_session_items(
+        items, session_id="conv_abc", external_session_id=_EXTERNAL_ID, cwd=Path("/repo")
+    )
+    assert [r["id"] for r in records] == [r["id"] for r in again]
+
+
+@pytest.mark.parametrize("response_ids", [("r1", "r2"), ("", ""), (None, None)])
+def test_distinct_or_missing_response_ids_stay_separate(response_ids: tuple) -> None:
+    items = [_assistant_item("first"), _assistant_item("second", item_id="a2")]
+    for item, response_id in zip(items, response_ids, strict=True):
+        item["response_id"] = response_id
+    records = pi_session_records_from_session_items(
+        items, session_id="conv_abc", external_session_id=_EXTERNAL_ID, cwd=Path("/repo")
+    )
+    assert [r["message"]["content"] for r in records[1:]] == [
+        [{"type": "text", "text": "first"}],
+        [{"type": "text", "text": "second"}],
+    ]
+
+
 def test_empty_text_items_are_dropped() -> None:
     items = [
         {"id": "u1", "type": "message", "role": "user", "content": []},
```

---

### Incident Patch 6: `839dac22` (2026-10-06)
**Commit Message**: fix(runner): keep deny-capable tool policies from vetoing session init via the sys_agent_start probe (#6609)

* fix(runner): keep deny-capable tool policies from vetoing session init via the sys_agent_start probe

Session init probes guardrails policies with a synthetic sys_agent_start
tool call so start-aware policies (enforce_sandbox) can transform the
sandbox config. A generic fail-closed policy (allowlist with a terminal
DENY) has never heard of that name and denied the probe, so the runner
returned 403 agent_start_denied. The server's init handshake is
best-effort and forwarded messages anyway, leaving the session
half-initialized without its inbox — every sys_session_send then failed
with 'Error: sys_session_send requires parent session inbox' even though
the policy ALLOWs that exact call.

The probe now applies config transforms only: DENY/ASK verdicts are
logged and dropped instead of aborting initialization. enforce_sandbox
overrides still apply unchanged.

Tests: tests/runner/test_agent_start_gate_deny_capable_policy.py failed
on the unfixed tree with the 403 and now passes; the live e2e
tests/e2e/test_deny_capable_policy_subagent_dispatch_e2e.py failed on
the unfixed tre

**File**: `docs/POLICIES.md` (modified, +14/-0)
```diff
@@ -277,6 +277,20 @@ An agent that fails during its `initialize` handshake for no obvious reason is
 worth checking against this first; the ACP executor logs a hint pointing back at
 this field.
 
+> **How the start probe is evaluated.** `enforce_sandbox` runs when the runner
+> replays your tool-call policies over a synthetic `sys_agent_start` probe at
+> launch. Only a transform takes effect there: a policy that ALLOWs the probe
+> and returns a replacement payload (preserving the `name` and `arguments`
+> fields) reshapes the launch, chaining through later policies. A plain `DENY`
+> or `ASK` verdict on this probe does **not** block agent start — it is logged
+> and ignored, so a general-purpose tool allowlist or cost gate that happens to
+> reject the `sys_agent_start` name will not stop the agent from launching. The
+> runner only refuses to start (fails closed) when a policy cannot be evaluated
+> at all — it raised, could not be resolved, or returned a transform that drops
+> the probe's `name`/`arguments` shape — because then its intended sandbox
+> transform is unknown. Do not rely on a tool-call `DENY` to gate which agents
+> may launch; there is no agent-start policy phase today.
+
 #### `deny_pii_in_llm_request`
 
 Scans user messages and LLM prompts for PII patterns (SSN, credit card, email, phone).
```

**File**: `omnigent/runner/app.py` (modified, +44/-45)
```diff
@@ -32,7 +32,6 @@
     from omnigent.harnesses.claude_native.main import ClaudeNativeUcodeConfig
     from omnigent.harnesses.codex_native.bridge import CodexNativeBridgeState
     from omnigent.runner.mcp_manager import RunnerMcpManager
-    from omnigent.runner.policy import PolicyVerdict
     from omnigent.terminals.registry import TerminalRegistry
 
 import httpx
@@ -2412,27 +2411,34 @@ async def _initialize_session(body: _JsonObject) -> JSONResponse:
             )
             harness_name = canonicalize_harness(raw_harness) or raw_harness
 
-            _start_verdict = await _evaluate_agent_start_gate(spec, harness_name)
-            if _start_verdict is not None:
-                if _start_verdict.action in ("deny", "ask"):
-                    _logger.error(
-                        "Runner session initialization failed",
-                        extra=debug_event(
-                            "runner_session_init_failed",
-                            stage="session_init",
-                            status_code=403,
-                            error_code="agent_start_denied",
-                        ),
-                    )
-                    return JSONResponse(
+            from omnigent.runner.policy import AgentStartPolicyError
+
+            try:
+                _start_data = await _evaluate_agent_start_gate(spec, harness_name)
+            except AgentStartPolicyError as exc:
+                # The gate raises without logging; this is the single record of
+                # the failure. exc_info keeps any underlying policy traceback.
+                _logger.error(
+                    "Runner session initialization failed",
+                    exc_info=True,
+                    extra=debug_event(
+                        "runner_session_init_failed",
+                        stage="session_init",
                         status_code=403,
-                        content={
-                            "error": "agent_start_denied",
-                            "detail": _start_verdict.deny_text or "Agent start denied by policy",
-                        },
-                    )
-                if _start_verdict.data is not None:
-                    _apply_sandbox_override_from_verdict(spec, _start_verdict.data)
+                        error_code="agent_start_policy_unevaluable",
+                        policy_name=exc.policy_name,
+                        reason=exc.reason,
+                    ),
+                )
+                return JSONResponse(
+                    status_code=403,
+                    content={
+                        "error": "agent_start_policy_unevaluable",
+                        "detail": str(exc),
+                    },
+                )
+            if _start_data is not None:
+                _apply_sandbox_override_from_start_data(spec, _start_data)
 
             await _ensure_session_subagent_router(
                 session_id,
@@ -7942,18 +7948,12 @@ def _build_spawn_env_from_spec(
 async def _evaluate_agent_start_gate(
     spec: AgentSpec,
     harness: str,
-) -> PolicyVerdict | None:
-    """Evaluate ``__agent_start`` through the spec's policy gate.
+) -> Mapping[str, object] | None:
+    """Collect the policies' launch transforms for the synthetic start probe.
 
-    Constructs a :class:`RunnerToolPolicyGate` from the spec and
-    evaluates a synthetic ``__agent_start`` tool call.  This reuses
-    the same gate that guards MCP tool calls — no round-trip to the
-    Omnigent server required.
-
-    :param spec: The resolved agent spec (``AgentSpec``).
-    :param harness: Canonical harness name, e.g. ``"claude-sdk"``.
-    :returns: A :class:`PolicyVerdict` if the spec has guardrails
-        policies, ``None`` if no policies apply.
+    Returns the composed replacement payload (``enforce_sandbox`` forcing a
+    sandbox) or ``None``. DENY/ASK verdicts never gate agent start; see
+    :meth:`RunnerToolPolicyGate.evaluate_agent_start`.
     """
     from omnigent.runner.policy import RunnerToolPolicyGate
 
@@ -7965,8 +7965,7 @@ async def _evaluate_agent_start_gate(
     if spec.os_env is not None and spec.os_env.sandbox is not None:
         sandbox_dict = cast(_JsonObject, dataclasses.asdict(spec.os_env.sandbox))
 
-    return await gate.evaluate_tool_call(
-        "sys_agent_start",
+    return await gate.evaluate_agent_start(
         {
             "agent_name": getattr(spec, "name", None) or "",
             "harness": harness,
@@ -7975,26 +7974,26 @@ async def _evaluate_agent_start_gate(
     )
 
 
-def _apply_sandbox_override_from_verdict(
+def _apply_sandbox_override_from_start_data(
     spec: AgentSpec,
-    verdict_data: object,
+    start_data: object,
 ) -> None:
-    """Apply sandbox override from a policy verdict's ``data`` field.
+    """Apply the start probe's composed sandbox transform to *spec*.
 
-    The ``enforce_sandbox`` policy returns replacement ``data`` shaped
-    as ``{"name": "sys_agent_start", "ar
```

**File**: `omnigent/runner/policy.py` (modified, +131/-1)
```diff
@@ -38,6 +38,7 @@
 
 import json
 import logging
+from collections.abc import Mapping
 from dataclasses import dataclass, replace
 from typing import Literal
 
@@ -61,6 +62,15 @@ class _GatedPolicy:
     name: str
     policy: FunctionPolicy
     phases: frozenset[Phase]
+    # True when ``policy`` is the fail-closed stand-in for a spec policy that
+    # could not be resolved. Its DENY is a load failure, not a real verdict, so
+    # the start probe refuses to launch instead of silently dropping a transform.
+    fail_closed: bool = False
+    # True when the policy declared TOOL_CALL (or self-selects via ``on=None``).
+    # Only such a policy can transform the start probe, so only its unresolved
+    # sentinel gates agent start; a tool_result-only policy still fails tool
+    # dispatch closed but must not block session init.
+    start_gated: bool = True
 
 
 @dataclass(frozen=True)
@@ -106,6 +116,26 @@ class PolicyVerdict:
 # once and share across every fast-path tool call.
 _ALLOW: PolicyVerdict = PolicyVerdict(action="allow")
 
+# Synthetic tool name the runner probes before spawning an agent; start-aware
+# policies such as ``enforce_sandbox`` key on it to transform the launch.
+AGENT_START_TOOL = "sys_agent_start"
+
+
+class AgentStartPolicyError(RuntimeError):
+    """A guardrails policy could not be evaluated for the start probe.
+
+    Raised when a tool-phase policy raised or failed to resolve while the
+    runner probed ``sys_agent_start``. Such a policy might have restricted the
+    launch (e.g. ``enforce_sandbox``), so the runner fails session init closed
+    rather than starting the agent with the un-transformed spec.
+    """
+
+    def __init__(self, policy_name: str, reason: str) -> None:
+        """Record the offending policy name and why it could not be evaluated."""
+        self.policy_name = policy_name
+        self.reason = reason
+        super().__init__(f"guardrails policy {policy_name!r} {reason}; refusing agent start")
+
 
 def _resolve_failure_diagnostic(ps: FunctionPolicySpec, exc: BaseException) -> str:
     """
@@ -170,6 +200,10 @@ def from_spec(cls, spec: AgentSpec) -> RunnerToolPolicyGate:
                 phases = frozenset(s.phase for s in ps.on if _selector_covers_tools(s.phase))
             if not phases:
                 continue
+            # Capture start-probe participation from the declared phases before a
+            # resolution failure broadens them: only a TOOL_CALL (or on=None)
+            # policy can transform the launch and gate agent start.
+            start_gated = Phase.TOOL_CALL in phases
             try:
                 policy = resolve_function_policy(ps)
             except Exception as exc:  # noqa: BLE001 - all resolution failures deny
@@ -179,7 +213,18 @@ def from_spec(cls, spec: AgentSpec) -> RunnerToolPolicyGate:
                 )
                 policy = _unresolved_policy_sentinel(ps, exc)
                 phases = frozenset([Phase.TOOL_CALL, Phase.TOOL_RESULT])
-            out.append(_GatedPolicy(name=ps.name, policy=policy, phases=phases))
+                fail_closed = True
+            else:
+                fail_closed = False
+            out.append(
+                _GatedPolicy(
+                    name=ps.name,
+                    policy=policy,
+                    phases=phases,
+                    fail_closed=fail_closed,
+                    start_gated=start_gated,
+                )
+            )
         return cls(out)
 
     def reset_turn(self) -> None:
@@ -217,6 +262,91 @@ async def evaluate_tool_call(
         )
         return await self._evaluate_policies(ctx, Phase.TOOL_CALL)
 
+    async def evaluate_agent_start(
+        self,
+        arguments: dict[str, object],
+    ) -> Mapping[str, object] | None:
+        """
+        Run TOOL_CALL policies over the synthetic ``sys_agent_start`` probe.
+
+        The probe lets start-aware policies such as ``enforce_sandbox``
+        transform the launch: an ALLOW result's ``data`` composes into the
+        next policy's input, as in :meth:`evaluate_tool_call`. It is not a real
+        tool call, so a clean DENY or ASK from a resolved policy does not gate
+        agent start -- the verdict is logged and skipped, and (unlike
+        :meth:`evaluate_tool_call`, which still composes ASK ``data``) any
+        transform it carries is dropped. A generic allowlist that rejects the
+        probe name therefore cannot block the launch, and the remaining
+        policies still contribute their ALLOW transforms.
+
+        A policy the runner could not evaluate is treated differently from a
+        clean verdict. If a start-capable policy (declared on ``tool_call`` or
+        self-selecting via ``on=None``) raised, failed to resolve and was
+        replaced by the fail-closed sentinel, or returned a transform that does
+        not preserve the probe's ``name``/``arguments`` shape, its intended
+        effect is unknown, so the probe fails closed rather 
```

**File**: `tests/e2e/test_deny_capable_policy_subagent_dispatch_e2e.py` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
+"""Verify deny-capable tool policies do not break sub-agent dispatch."""
+
+from __future__ import annotations
+
+import json
+import time
+import uuid
+
+import httpx
+import pytest
+
+from tests.e2e.conftest import (
+    configure_mock_llm,
+    create_runner_bound_session,
+    poll_session_until_terminal,
+    register_inline_agent,
+    send_user_message_to_session,
+)
+from tests.e2e.helpers import POLL_INTERVAL_S, final_assistant_text, get_output_items
+
+pytestmark = [
+    pytest.mark.min_server_version("0.3.0"),
+    pytest.mark.timeout(420, method="signal"),
+]
+
+
+@pytest.mark.parametrize("terminal_verdict", ["DENY", "ALLOW"])
+def test_policy_allows_subagent_dispatch(
+    http_client: httpx.Client,
+    live_runner_id: str,
+    mock_llm_server_url: str,
+    terminal_verdict: str,
+) -> None:
+    uid = uuid.uuid4().hex[:6]
+    parent_model, child_model = f"mock-parent-{uid}", f"mock-child-{uid}"
+    child_marker = f"PING_{uid}"
+    mock_base = f"{mock_llm_server_url}/v1"
+    expression = (
+        'event.type != "tool_call" ? {"result": "ALLOW"} : '
+        "has(event.data.name) && type(event.data.name) == string && "
+        'event.data.name.matches("^(ToolSearch|sys_session_send|sys_read_inbox)$") '
+        f'? {{"result": "ALLOW"}} : {{"result": "{terminal_verdict}"}}'
+    )
+    parent_name = register_inline_agent(
+        http_client,
+        name=f"policy-parent-{uid}",
+        harness="openai-agents",
+        model=parent_model,
+        profile="",
+        prompt="Dispatch the child and report its reply.",
+        mock_llm_base_url=mock_base,
+        extra_config={
+            "async": True,
+            "tools": {
+                "child": {
+                    "type": "agent",
+                    "description": "Dispatch regression child.",
+                    "executor": {
+                        "harness": "openai-agents",
+                        "model": child_model,
+                        "auth": {
+                            "type": "api_key",
+                            "api_key": "mock-key",
+                            "base_url": mock_base,
+                        },
+                    },
+                    "prompt": "Answer briefly and literally.",
+                }
+            },
+            "policies": {
+                "allowlist": {
+                    "type": "function",
+                    "on": ["tool_call"],
+                    "function": {
+                        "path": "omnigent.policies.builtins.cel.cel_policy",
+                        "arguments": {"expression": expression},
+                    },
+                }
+            },
+            "os_env": {"type": "caller_process", "cwd": ".", "sandbox": {"type": "none"}},
+        },
+    )
+    configure_mock_llm(
+        mock_llm_server_url,
+        [
+            {
+                "tool_calls": [
+                    {
+                        "call_id": "call_dispatch_child",
+                        "name": "sys_session_send",
+                        "arguments": json.dumps(
+                            {"agent": "child", "title": "ping", "args": "Reply with PING."}
+                        ),
+                    }
+                ]
+            },
+            {"text": "Dispatched child, waiting for result."},
+            {"text": "Child result received."},
+        ],
+        key=parent_model,
+    )
+    configure_mock_llm(mock_llm_server_url, [{"text": child_marker}], key=child_model)
+
+    session_id = create_runner_bound_session(
+        http_client, agent_name=parent_name, runner_id=live_runner_id
+    )
+    response_id = send_user_message_to_session(
+        http_client, session_id=session_id, content="Dispatch the child."
+    )
+    body = poll_session_until_terminal(
+        http_client, session_id=session_id, response_id=response_id, timeout=180
+    )
+    assert body["status"] == "completed", body
+    outputs = {
+        item["call_id"]: item["output"] for item in get_output_items(body, "function_call_output")
+    }
+    handle = json.loads(outputs["call_dispatch_child"])
+    assert handle["status"] == "launching", handle
+    assert handle["kind"] == "sub_agent", handle
+    assert isinstance(handle["task_id"], str) and handle["task_id"], handle
+
+    # The launching handle precedes the child's first turn completing.
+    deadline = time.monotonic() + 120
+    while time.monotonic() < deadline:
+        response = http_client.get(f"/v1/sessions/{handle['task_id']}/items")
+        response.raise_for_status()
+        if child_marker in final_assistant_text({"output": response.json()["data"]}):
+            break
+        time.sleep(POLL_INTERVAL_S)
+    else:
+        pytest.fail(f"Child never replied: {response.text}")
```

**File**: `tests/e2e_ui/agents/test_deny_capable_guardrail_dispatch.py` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+"""An allowlisted dispatch must spawn a worker despite a deny-capable guardrail."""
+
+from __future__ import annotations
+
+import json
+import re
+import uuid
+from collections.abc import Callable
+
+import httpx
+import pytest
+from playwright.sync_api import Page, expect
+
+from tests._helpers.session import bind_session_runner, bundle_files, post_session_bundle
+from tests.e2e_ui.conftest import (
+    configure_mock_llm,
+    open_right_rail,
+    set_fallback_mock_llm,
+)
+
+_PARENT_TURN_DONE = "PARENT_DISPATCH_TURN_DONE"
+_PARENT_YAML = """\
+spec_version: 1
+name: {parent_model}
+prompt: Dispatch the worker once with sys_session_send, then finish.
+executor:
+  model: {parent_model}
+  config:
+    harness: openai-agents
+tools:
+  agents:
+    - worker
+guardrails:
+  policies:
+    allowlist_then_deny:
+      type: function
+      "on": [tool_call]
+      function:
+        path: omnigent.policies.builtins.cel.cel_policy
+        arguments:
+          expression: >
+            event.type != "tool_call"
+              ? {{"result": "ALLOW"}}
+              : has(event.data.name)
+                && type(event.data.name) == string
+                && event.data.name.matches("^(ToolSearch|sys_session_send|sys_read_inbox)$")
+                ? {{"result": "ALLOW"}}
+                : {{"result": "DENY"}}
+os_env:
+  type: caller_process
+  cwd: .
+"""
+_WORKER_YAML = """\
+spec_version: 1
+name: worker
+prompt: Acknowledge the task and finish.
+executor:
+  model: {child_model}
+  config:
+    harness: openai-agents
+os_env:
+  type: caller_process
+  cwd: .
+"""
+
+
+@pytest.mark.timeout(600)
+def test_deny_capable_guardrail_allows_subagent_dispatch(
+    request: pytest.FixtureRequest,
+    live_server: str,
+    mock_llm_server_url: str,
+    runner_id: str,
+    _recover_shared_runner: Callable[[], None],
+) -> None:
+    uid = uuid.uuid4().hex[:8]
+    parent_model = f"denycap-parent-{uid}"
+    child_model = f"denycap-child-{uid}"
+    configure_mock_llm(
+        mock_llm_server_url,
+        [
+            {
+                "tool_calls": [
+                    {
+                        "call_id": "call_dispatch_worker",
+                        "name": "sys_session_send",
+                        "arguments": json.dumps(
+                            {
+                                "agent": "worker",
+                                "title": "deny-capable-dispatch",
+                                "args": "Acknowledge the task and finish.",
+                            }
+                        ),
+                    }
+                ]
+            },
+            {"text": _PARENT_TURN_DONE},
+        ],
+        key=parent_model,
+    )
+    # The child's reply can wake the parent after its scripted turn ends.
+    set_fallback_mock_llm(mock_llm_server_url, parent_model, "PARENT_WAKE_DONE")
+    set_fallback_mock_llm(mock_llm_server_url, child_model, "WORKER_ACK_DONE")
+    _recover_shared_runner()
+
+    # config.yaml selects the strict parser that honors guardrails.
+    bundle = bundle_files(
+        {
+            "config.yaml": _PARENT_YAML.format(parent_model=parent_model).encode(),
+            "agents/worker/config.yaml": _WORKER_YAML.format(child_model=child_model).encode(),
+        }
+    )
+    created = post_session_bundle(httpx.post, f"{live_server}/v1/sessions", bundle, timeout=30.0)
+    created.raise_for_status()
+    session_id = created.json()["session_id"]
+    request.addfinalizer(
+        lambda: httpx.delete(f"{live_server}/v1/sessions/{session_id}", timeout=10.0)
+    )
+    bind_session_runner(httpx.patch, live_server, session_id, runner_id, timeout=10.0)
+    # Start recording after setup so the video opens on the session.
+    page = request.getfixturevalue("page")
+    assert isinstance(page, Page)
+    page.goto(f"{live_server}/c/{session_id}")
+    composer = page.get_by_label("Message the agent")
+    expect(composer).to_be_visible(timeout=30_000)
+    composer.fill("Please dispatch the worker sub-agent now, then finish.")
+    page.get_by_role("button", name="Send", exact=True).click()
+    expect(
+        page.locator(
+            '[data-testid="message-bubble"][data-role="assistant"]',
+            has_text=_PARENT_TURN_DONE,
+        ).first
+    ).to_be_visible(timeout=180_000)
+
+    open_right_rail(page)
+    rail = page.get_by_role("complementary", name="Workspace")
+    rail.get_by_role("tab", name=re.compile("^Agents")).click()
+    # A denied synthetic start probe leaves no inbox, so dispatch creates no row.
+    expect(rail.get_by_test_id("subagent-row").first).to_be_visible(timeout=60_000)
```

**File**: `tests/harnesses/claude_native/test_claude_native_bridge.py` (modified, +1/-1)
```diff
@@ -401,7 +401,7 @@ def test_prepare_bridge_dir_persists_and_applies_resolved_sandbox(
 
     ``enforce_sandbox``/``force_sandbox`` resolves a real sandbox onto the
     session's ``os_env.sandbox`` upstream (``runner/app.py``'s
-    ``_apply_sandbox_override_from_verdict``), but that decision used to
+    ``_apply_sandbox_override_from_start_data``), but that decision used to
     have no path into the claude-native bridge: ``prepare_bridge_dir``
     never wrote it to the config file, and ``_build_tools`` unconditionally
     hardcoded ``OSEnvSandboxSpec(type="none")`` regardless of the policy.
```

**File**: `tests/runner/test_agent_start_gate_deny_capable_policy.py` (added, +189/-0)
```diff
@@ -0,0 +1,189 @@
+"""Tool denials must not block session init or discard sandbox transforms."""
+
+import json
+from contextlib import asynccontextmanager
+from unittest.mock import AsyncMock, Mock
+
+import httpx
+import pytest
+
+from omnigent.inner.datamodel import OSEnvSandboxSpec, OSEnvSpec
+from omnigent.policies import FunctionPolicy
+from omnigent.runner import app as runner_app_module
+from omnigent.runner import create_runner_app
+from omnigent.runner.policy import (
+    AGENT_START_TOOL,
+    AgentStartPolicyError,
+    RunnerToolPolicyGate,
+    _GatedPolicy,
+)
+from omnigent.runtime.harnesses.process_manager import HarnessProcessManager
+from omnigent.spec.types import (
+    AgentSpec,
+    ApiKeyAuth,
+    ExecutorSpec,
+    FunctionPolicySpec,
+    FunctionRef,
+    GuardrailsSpec,
+    Phase,
+    PhaseSelector,
+)
+from tests.runner.helpers import NullServerClient
+
+_START_ARGS = {"harness": "claude-sdk", "sandbox": {"type": "none"}}
+_SESSION_ID = "conv_start_policy"
+
+
+def _allowlist() -> FunctionPolicySpec:
+    return FunctionPolicySpec(
+        name="allowlist",
+        on=[PhaseSelector(phase=Phase.TOOL_CALL)],
+        function=FunctionRef(
+            path="omnigent.policies.builtins.cel.cel_policy",
+            arguments={
+                "expression": (
+                    'event.data.name in ["ToolSearch", "sys_session_send", "sys_read_inbox"]'
+                    ' ? {"result": "ALLOW"} : {"result": "DENY"}'
+                )
+            },
+        ),
+    )
+
+
+def _force_bwrap() -> FunctionPolicySpec:
+    return FunctionPolicySpec(
+        name="force_bwrap",
+        on=None,
+        function=FunctionRef(
+            path="omnigent.policies.builtins.safety.enforce_sandbox",
+            arguments={"sandbox_type": "linux_bwrap", "allow_network": False},
+        ),
+    )
+
+
+def _unresolvable(phase: Phase = Phase.TOOL_CALL) -> FunctionPolicySpec:
+    return FunctionPolicySpec(
+        name="unresolvable",
+        on=[PhaseSelector(phase=phase)],
+        function=FunctionRef(path="omnigent.policies.builtins.does_not_exist"),
+    )
+
+
+def _spec(*policies: FunctionPolicySpec) -> AgentSpec:
+    return AgentSpec(
+        spec_version=1,
+        name="start-policy-agent",
+        executor=ExecutorSpec(
+            config={"harness": "claude-sdk"},
+            model="test-model",
+            auth=ApiKeyAuth(api_key="test-key"),
+        ),
+        os_env=OSEnvSpec(type="caller_process", sandbox=OSEnvSandboxSpec(type="none")),
+        guardrails=GuardrailsSpec(policies=list(policies)),
+    )
+
+
+@asynccontextmanager
+async def _create_session(spec: AgentSpec):
+    pm = Mock(spec=HarnessProcessManager)
+    app = create_runner_app(
+        process_manager=pm,
+        spec_resolver=AsyncMock(return_value=spec),
+        server_client=NullServerClient(),  # type: ignore[arg-type]
+    )
+    try:
+        async with httpx.AsyncClient(
+            transport=httpx.ASGITransport(app=app), base_url="http://runner"
+        ) as client:
+            response = await client.post(
+                "/v1/sessions", json={"session_id": _SESSION_ID, "agent_id": "ag_test"}
+            )
+            yield response, pm
+    finally:
+        runner_app_module._session_inboxes_ref.pop(_SESSION_ID, None)
+
+
+@pytest.mark.parametrize(
+    "sandbox_position", [None, 0, 1], ids=["allowlist-only", "sandbox-first", "sandbox-last"]
+)
+async def test_session_init_preserves_inbox_and_sandbox(sandbox_position: int | None) -> None:
+    policies = [_allowlist()]
+    if sandbox_position is not None:
+        policies.insert(sandbox_position, _force_bwrap())
+
+    async with _create_session(_spec(*policies)) as (response, pm):
+        assert response.status_code == 201, response.text
+        pm.get_client.assert_awaited_once()
+        assert _SESSION_ID in runner_app_module._session_inboxes_ref
+        env = pm.get_client.call_args.kwargs["env"]
+        sandbox = json.loads(env["HARNESS_CLAUDE_SDK_OS_ENV"])["sandbox"]
+        if sandbox_position is None:
+            assert sandbox["type"] == "none"
+        else:
+            assert sandbox["type"] == "linux_bwrap"
+            assert sandbox["allow_network"] is False
+
+
+async def test_start_probe_keeps_real_tool_enforcement() -> None:
+    gate = RunnerToolPolicyGate.from_spec(_spec(_allowlist()))
+    assert await gate.evaluate_agent_start(_START_ARGS) is None
+    assert (
+        await gate.evaluate_tool_call("sys_session_send", {"agent": "child"})
+    ).action == "allow"
+    assert (await gate.evaluate_tool_call("shell", {"command": "ls"})).action == "deny"
+
+
+@pytest.mark.parametrize("action", ["DENY", "ASK"])
+async def test_start_probe_drops_non_allow_transform(action: str) -> None:
+    def policy(_event):
+        return {"result": action, "data": {"name": AGENT_START_TOOL, "arguments": _START_ARGS}}
+
+    gate = RunnerToolPolicyGate(
+        [
+            _GatedPolicy(
+               
```

---

### Incident Patch 7: `10dd0fef` (2026-10-05)
**Commit Message**: fix(codex-native): recover sessions whose app-server has stopped (#9161)

When a session's Codex forwarder ends (an exception, or the app-server
dropping its connection), its cleanup closes the session's app-server but
leaves the Codex pane and the bridge state behind. The server's per-message
terminal ensure still judged that pane reusable, so every later turn
connected to the dead port and failed with a raw ConnectionRefusedError:
the session stayed bricked until something relaunched the terminal.

Both forwarder tasks now record that the app-server stopped (a coded startup
record in the bridge dir) when they end on their own. A runner-owned pane
whose app-server is gone and whose bridge carries a startup record is already
treated as not reusable, so the next terminal ensure replaces the pane and
launches a fresh app-server. A cancel (teardown, re-create) records nothing,
and neither does a forwarder whose app-server a newer launch already
replaced: that forwarder only closes its own server and leaves the newer
registry entry alone.

A turn that still finds the app-server unreachable (its message raced the
stop) now fails with the coded, undelivered codex_app_server_stopped error

**File**: `omnigent/harnesses/codex_native/bridge.py` (modified, +33/-0)
```diff
@@ -152,6 +152,16 @@ class CodexStartupFailure:
     remediation: str | None = None
 
 
+#: What a turn reports when its session's app-server is gone, and the record
+#: :func:`record_app_server_stopped` leaves so the next terminal ensure replaces the pane.
+CODEX_APP_SERVER_STOPPED = CodexStartupFailure(
+    message="Codex's app-server for this session stopped, so this message was not delivered.",
+    code="codex_app_server_stopped",
+    title="Codex stopped unexpectedly",
+    remediation="Send your message again. If it keeps failing, start a new session.",
+)
+
+
 @dataclass(frozen=True)
 class CodexNativeBridgeState:
     """
@@ -1099,6 +1109,29 @@ def read_bridge_startup_error(bridge_dir: Path) -> str | None:
     return failure.message if failure is not None else None
 
 
+def record_app_server_stopped(bridge_dir: Path) -> None:
+    """
+    Record that a session's app-server is gone, unless a cause is already recorded.
+
+    A runner-owned Codex pane whose app-server is gone and whose bridge carries a
+    startup record is not reusable: the next terminal ensure replaces it with a
+    fresh app-server, instead of keeping a pane every turn would fail against.
+
+    :param bridge_dir: Native Codex bridge directory.
+    :returns: None.
+    """
+    if not bridge_dir.is_dir() or read_bridge_startup_error(bridge_dir) is not None:
+        return
+    failure = CODEX_APP_SERVER_STOPPED
+    write_bridge_startup_error(
+        bridge_dir,
+        failure.message,
+        code=failure.code,
+        title=failure.title,
+        remediation=failure.remediation,
+    )
+
+
 def read_mcp_startup(bridge_dir: Path) -> dict[str, dict[str, str | None]]:
     """
     Read the recorded per-MCP-server startup state.
```

**File**: `omnigent/inner/codex_native_executor.py` (modified, +47/-5)
```diff
@@ -5,13 +5,16 @@
 import asyncio
 import base64
 import binascii
+import contextlib
 import json
 import logging
 import os
 from collections.abc import AsyncIterator, Mapping
 from pathlib import Path
 from typing import cast
 
+from websockets.exceptions import WebSocketException
+
 from omnigent.debug_logging import debug_event
 from omnigent.harnesses.codex_native import side_chat
 from omnigent.harnesses.codex_native.app_server import (
@@ -21,6 +24,7 @@
     is_stale_active_turn_error,
 )
 from omnigent.harnesses.codex_native.bridge import (
+    CODEX_APP_SERVER_STOPPED,
     CODEX_NATIVE_BRIDGE_DIR_ENV_VAR,
     CODEX_NATIVE_REQUEST_SESSION_ID_ENV_VAR,
     CODEX_NATIVE_STARTUP_PUBLICATION_GRACE_SECONDS,
@@ -126,6 +130,44 @@ def _bridge_state_wait_seconds(bridge_dir: Path) -> float:
     )
 
 
+async def _connect_to_app_server(state: CodexNativeBridgeState) -> CodexAppServerClient | None:
+    """
+    Connect to the bridge's app-server, or return ``None`` when it is unreachable.
+
+    Only a failure to connect counts, a socket error or a websocket handshake
+    failure such as an accept-then-close: nothing has been sent, so the turn is
+    provably undelivered. An error once the connection is up is the caller's.
+    Any other exit, a cancel included, closes the half-open client first.
+
+    :param state: Bridge state naming the app-server transport.
+    :returns: A connected client, or ``None`` when the connection was refused or lost.
+    """
+    client = client_for_transport(
+        state.socket_path,
+        client_name="omnigent-codex-native",
+    )
+    connected = False
+    try:
+        await client.connect()
+        connected = True
+        return client
+    except (OSError, WebSocketException):
+        _logger.exception(
+            "Codex native app-server unreachable: socket=%s",
+            state.socket_path,
+            extra=debug_event(
+                "codex_app_server_unreachable",
+                session_id=state.session_id,
+                thread_id=state.thread_id,
+            ),
+        )
+        return None
+    finally:
+        if not connected:
+            with contextlib.suppress(Exception):
+                await client.close()
+
+
 async def _start_codex_turn(
     client: CodexAppServerClient,
     *,
@@ -547,12 +589,12 @@ async def run_turn(
                 elif not _session_is_active(state.session_id, self._request_session_id):
                     error_msg = "Codex native session is no longer active"
                     undelivered = True
+                elif (client := await _connect_to_app_server(state)) is None:
+                    # Nothing reached the app-server, so the sender's copy is the only record.
+                    startup_failure = CODEX_APP_SERVER_STOPPED
+                    error_msg = startup_failure.message
+                    undelivered = True
                 else:
-                    client = client_for_transport(
-                        state.socket_path,
-                        client_name="omnigent-codex-native",
-                    )
-                    await client.connect()
                     try:
                         side_question = side_chat.side_chat_question(input_items)
                         if side_question is not None:
```

**File**: `omnigent/runner/native/orchestration.py` (modified, +25/-1)
```diff
@@ -5505,6 +5505,7 @@ async def _auto_create_codex_terminal(
                 codex_ws_url=codex_ws_url,
                 thread_id=launch_config.external_session_id,
                 client=retained_resume_client,
+                app_server=app_server,
                 subagent_router=_codex_router,
                 turn_router=_codex_turn_router,
             )
@@ -5791,6 +5792,7 @@ async def _codex_discover_thread_and_forward(
         CODEX_NATIVE_DIRECT_THREAD_START_TIMEOUT_SECONDS,
         CodexNativeBridgeState,
         clear_bridge_startup_error,
+        record_app_server_stopped,
         write_bridge_startup_error,
         write_bridge_state,
     )
@@ -5830,6 +5832,7 @@ async def _codex_discover_thread_and_forward(
 
     discovery_started_at = time.monotonic()
     startup_pending_recorded = False
+    cancelled = False
     try:
         while True:
             try:
@@ -6095,6 +6098,9 @@ async def _codex_discover_thread_and_forward(
             client=event_client,
             auth=_RunnerDatabricksAuth(auth_factory),
         )
+    except asyncio.CancelledError:
+        cancelled = True
+        raise
     finally:
         # Tear down the listener and the per-session app-server whenever
         # forwarding ends — discovery failed, the app-server connection dropped
@@ -6115,6 +6121,9 @@ async def _codex_discover_thread_and_forward(
         leftover_app_server = app_server
         if app_server is None or _AUTO_CODEX_APP_SERVERS.get(session_id) is app_server:
             leftover_app_server = _AUTO_CODEX_APP_SERVERS.pop(session_id, None)
+            if not cancelled:
+                # The pane outlives its app-server; mark it so the next ensure replaces it.
+                record_app_server_stopped(bridge_dir)
         with contextlib.suppress(Exception):
             await event_client.close()
         if leftover_app_server is not None:
@@ -6131,6 +6140,7 @@ async def _codex_forward_known_thread(
     codex_ws_url: str,
     thread_id: str,
     client: CodexAppServerClient | None = None,
+    app_server: CodexNativeAppServer | None = None,
     subagent_router: SubagentRouter | None = None,
     turn_router: TurnRouter | None = None,
 ) -> None:
@@ -6144,6 +6154,10 @@ async def _codex_forward_known_thread(
     :param thread_id: Existing Codex app-server thread id, e.g.
         ``"thread_abc123"``.
     :param client: Retained preload subscription, owned and closed by this forwarder.
+    :param app_server: This launch's process. Only a registry entry that is still
+        this process is dropped on exit, so a late teardown cannot pop the entry a
+        re-created terminal has since installed. ``None`` drops whatever the
+        session has registered.
     :param subagent_router: Router this terminal launch started, torn down
         in the ``finally``. Passed so a late teardown cannot close the
         endpoint a re-created terminal has since installed.
@@ -6152,12 +6166,14 @@ async def _codex_forward_known_thread(
     :returns: None. Runs until cancelled or the app-server connection
         closes.
     """
+    from omnigent.harnesses.codex_native.bridge import record_app_server_stopped
     from omnigent.harnesses.codex_native.forwarder import supervise_forwarder
     from omnigent.runner._entry import (
         _make_auth_token_factory,
         _RunnerDatabricksAuth,
     )
 
+    cancelled = False
     try:
         server_url = _required_runner_env("RUNNER_SERVER_URL")
         auth_factory = _make_auth_token_factory()
@@ -6173,6 +6189,9 @@ async def _codex_forward_known_thread(
             client=client,
             auth=_RunnerDatabricksAuth(auth_factory),
         )
+    except asyncio.CancelledError:
+        cancelled = True
+        raise
     finally:
         if client is not None:
             with contextlib.suppress(Exception):
@@ -6186,7 +6205,12 @@ async def _codex_forward_known_thread(
                 stage="native_input",
             ),
         )
-        leftover_app_server = _AUTO_CODEX_APP_SERVERS.pop(session_id, None)
+        leftover_app_server = app_server
+        if app_server is None or _AUTO_CODEX_APP_SERVERS.get(session_id) is app_server:
+            leftover_app_server = _AUTO_CODEX_APP_SERVERS.pop(session_id, None)
+            if not cancelled:
+                # The pane outlives its app-server; mark it so the next ensure replaces it.
+                record_app_server_stopped(bridge_dir)
         if leftover_app_server is not None:
             with contextlib.suppress(Exception):
                 await leftover_app_server.close()
```

**File**: `tests/harnesses/codex_native/session/test_subscription.py` (modified, +4/-2)
```diff
@@ -889,11 +889,13 @@ def test_codex_discover_thread_login_required_clears_error_on_thread_start(
     bridge_dir = tmp_path / "bridge"
     bridge_dir.mkdir()
 
+    record_at_forwarding: list[str | None] = []
+
     async def _wait(_client: object, *, timeout: float | None = 30.0) -> str:
         return "thread_after_signin"
 
     async def _forward(**_kwargs: object) -> None:
-        return None
+        record_at_forwarding.append(read_bridge_startup_error(bridge_dir))
 
     monkeypatch.setattr(_fwd, "wait_for_thread_started", _wait)
     monkeypatch.setattr(_fwd, "supervise_forwarder", _forward)
@@ -916,7 +918,7 @@ async def close(self) -> None:
         )
     )
 
-    assert read_bridge_startup_error(bridge_dir) is None
+    assert record_at_forwarding == [None]
     state = read_bridge_state(bridge_dir)
     assert state is not None
     assert state.thread_id == "thread_after_signin"
```

**File**: `tests/harnesses/codex_native/test_codex_native.py` (modified, +4/-2)
```diff
@@ -13040,11 +13040,13 @@ def test_codex_discover_thread_login_required_clears_error_on_thread_start(
     bridge_dir = tmp_path / "bridge"
     bridge_dir.mkdir()
 
+    record_at_forwarding: list[str | None] = []
+
     async def _wait(_client: object, *, timeout: float | None = 30.0) -> str:
         return "thread_after_signin"
 
     async def _forward(**_kwargs: object) -> None:
-        return None
+        record_at_forwarding.append(read_bridge_startup_error(bridge_dir))
 
     monkeypatch.setattr(_fwd, "wait_for_thread_started", _wait)
     monkeypatch.setattr(_fwd, "supervise_forwarder", _forward)
@@ -13067,7 +13069,7 @@ async def close(self) -> None:
         )
     )
 
-    assert read_bridge_startup_error(bridge_dir) is None
+    assert record_at_forwarding == [None]
     state = read_bridge_state(bridge_dir)
     assert state is not None
     assert state.thread_id == "thread_after_signin"
```

**File**: `tests/harnesses/codex_native/test_codex_native_bridge.py` (modified, +35/-0)
```diff
@@ -11,6 +11,7 @@
 
 from omnigent.harnesses.codex_native import bridge as codex_native_bridge
 from omnigent.harnesses.codex_native.bridge import (
+    CODEX_APP_SERVER_STOPPED,
     CodexNativeBridgeState,
     cancel_pending_mcp_startup,
     clear_active_turn_id_if_matches,
@@ -31,6 +32,7 @@
     read_codex_home_config_model,
     read_mcp_startup,
     read_policy_hook_config,
+    record_app_server_stopped,
     settle_pending_mcp_startup,
     update_active_turn_id,
     update_mcp_server_startup,
@@ -605,6 +607,39 @@ def test_bridge_startup_failure_round_trips_structured_fields(bridge_dir: Path)
     assert (plain.code, plain.title, plain.remediation) == (None, None, None)
 
 
+def test_record_app_server_stopped_leaves_a_coded_record_until_the_next_launch(
+    bridge_dir: Path,
+) -> None:
+    """The stop is recorded with its code and cleared, like any launch failure, on relaunch."""
+    record_app_server_stopped(bridge_dir)
+
+    assert read_bridge_startup_failure(bridge_dir) == CODEX_APP_SERVER_STOPPED
+    assert CODEX_APP_SERVER_STOPPED.code == "codex_app_server_stopped"
+
+    clear_bridge_state(bridge_dir)
+    assert read_bridge_startup_failure(bridge_dir) is None
+
+
+def test_record_app_server_stopped_keeps_a_more_specific_cause(bridge_dir: Path) -> None:
+    """A launch failure already on record explains more than a bare "stopped"."""
+    write_bridge_startup_error(bridge_dir, "Codex stopped before it could start.", code="other")
+
+    record_app_server_stopped(bridge_dir)
+
+    failure = read_bridge_startup_failure(bridge_dir)
+    assert failure is not None
+    assert (failure.message, failure.code) == ("Codex stopped before it could start.", "other")
+
+
+def test_record_app_server_stopped_does_not_recreate_a_removed_bridge(tmp_path: Path) -> None:
+    """A session whose bridge was already deleted does not get a directory back."""
+    gone = tmp_path / "deleted-bridge"
+
+    record_app_server_stopped(gone)
+
+    assert not gone.exists()
+
+
 def test_bridge_startup_timeout_round_trips_and_is_cleared(bridge_dir: Path) -> None:
     """The configured-command marker is bounded and cleared before a new launch."""
     assert read_bridge_startup_timeout(bridge_dir) is None
```

**File**: `tests/inner/test_codex_native_executor.py` (modified, +254/-0)
```diff
@@ -10,10 +10,12 @@
 from typing import Any
 
 import pytest
+from websockets.exceptions import ConnectionClosedError, InvalidMessage
 
 import omnigent.inner.codex_native_executor as codex_native_executor
 from omnigent.harnesses.codex_native.app_server import CodexAppServerResponseError
 from omnigent.harnesses.codex_native.bridge import (
+    CODEX_APP_SERVER_STOPPED,
     CodexNativeBridgeState,
     read_bridge_state,
     read_codex_config_effort,
@@ -1623,6 +1625,258 @@ async def _no_sleep(_seconds: float) -> None:
     assert error.undelivered is True
 
 
+class _UnreachableClient(_FakeCodexNativeClient):
+    """Fail the connect the way a vanished app-server does; ``error`` says how."""
+
+    error: Exception = ConnectionRefusedError(111, "Connect call failed")
+    closes = 0
+
+    async def connect(self) -> None:
+        """
+        Raise ``error`` instead of connecting.
+
+        :returns: None.
+        """
+        raise type(self).error
+
+    async def close(self) -> None:
+        """
+        Count the release of the half-open client.
+
+        :returns: None.
+        """
+        type(self).closes += 1
+        await super().close()
+
+
+@pytest.mark.parametrize(
+    "error",
+    [
+        ConnectionRefusedError(111, "Connect call failed ('127.0.0.1', 9876)"),
+        FileNotFoundError(2, "No such file or directory"),
+        ConnectionError("Codex app-server disconnected before responding to initialize"),
+        InvalidMessage("did not receive a valid HTTP response"),
+        ConnectionClosedError(None, None),
+    ],
+    ids=[
+        "refused",
+        "socket-missing",
+        "dropped-in-handshake",
+        "accept-then-close",
+        "closed-in-initialize",
+    ],
+)
+def test_run_turn_reports_unreachable_app_server_as_undelivered(
+    monkeypatch: pytest.MonkeyPatch,
+    tmp_path: Path,
+    error: Exception,
+    caplog: pytest.LogCaptureFixture,
+) -> None:
+    """
+    A turn that cannot reach its app-server fails as a coded, undelivered error.
+
+    The forwarder's cleanup closes the session's app-server, so the recorded
+    port is dead. Connecting used to raise the raw socket error out of the
+    turn; it is now the same coded failure as a missing bridge, flagged
+    undelivered so the sender's queued message is kept, and nothing is sent.
+    A websocket handshake failure (accept-then-close, a close during the
+    initialize exchange) counts the same: no turn input was sent yet.
+    The failure still logs at ERROR, as every turn-delivery failure does.
+    """
+    _UnreachableClient.requests = []
+    _UnreachableClient.created = []
+    _UnreachableClient.error = error
+    _UnreachableClient.closes = 0
+    monkeypatch.setattr(
+        "omnigent.harnesses.codex_native.app_server.CodexAppServerClient",
+        _UnreachableClient,
+    )
+    _start_state(tmp_path)
+
+    events = _collect_turn_events(CodexNativeExecutor(bridge_dir=tmp_path), "hello")
+
+    assert len(events) == 1
+    failure = events[0]
+    assert isinstance(failure, ExecutorError)
+    assert failure.undelivered is True
+    assert failure.code == CODEX_APP_SERVER_STOPPED.code
+    assert failure.title == CODEX_APP_SERVER_STOPPED.title
+    assert failure.remediation == CODEX_APP_SERVER_STOPPED.remediation
+    assert str(error) not in failure.message
+    assert _UnreachableClient.requests == []
+    assert _UnreachableClient.closes == 1
+
+    from omnigent.debug_logging import record_to_row
+
+    record = next(
+        record
+        for record in caplog.records
+        if record.getMessage().startswith("Codex native app-server unreachable")
+    )
+    assert record.levelno == logging.ERROR
+    row = record_to_row(record, source="runner")
+    assert row["event_name"] == "codex_app_server_unreachable"
+    assert row["session_id"] == "conv_123"
+    assert row["attributes"]["thread_id"] == "thread_123"
+    assert "hello" not in json.dumps(row["attributes"])
+
+
+@pytest.mark.asyncio
+async def test_refused_connect_reaches_the_turn_error_as_an_undelivered_coded_failure(
+    monkeypatch: pytest.MonkeyPatch,
+    tmp_path: Path,
+) -> None:
+    """
+    Through the harness adapter, a dead app-server port fails the turn with the
+    coded, undelivered detail the server settles on, not a bare
+    ``ConnectionRefusedError`` that leaves the sender's message queued.
+    """
+    from omnigent.runtime.harnesses._executor_adapter import ExecutorAdapter, InnerExecutorError
+    from omnigent.runtime.harnesses._scaffold import TurnContext
+    from omnigent.server.schemas import CreateResponseRequest
+
+    _UnreachableClient.requests = []
+    _UnreachableClient.created = []
+    _UnreachableClient.error = ConnectionRefusedError(111, "Connect call failed ('127.0.0.1', 9)")
+    _UnreachableClient.closes = 0
+    monkeypatch.setattr(
+        "omnigent.harnesses.codex_native.app_server.CodexAppServerClient",
+        _UnreachableClient,
+    )
+    _start_state(tmp
```

**File**: `tests/runner/test_app_sessions_native_terminals_runtime.py` (modified, +180/-4)
```diff
@@ -834,6 +834,8 @@ async def _fake_forward_known_thread(**kwargs: Any) -> None:
             "codex_ws_url": app_server.listen_url,
             "thread_id": thread_id,
             "client": retained_client if retain_subscription else None,
+            # The forwarder tears down only the app-server this launch started.
+            "app_server": app_server,
         }
     ]
     bridge_state = codex_native_bridge.read_bridge_state(bridge_dir)
@@ -3438,6 +3440,178 @@ async def forward(**kwargs: Any) -> None:
     assert session_id not in orchestration._AUTO_CODEX_APP_SERVERS
 
 
+class _CodexPaneRegistry:
+    """Report the Codex pane as runner-owned, as the resource registry does."""
+
+    def terminal_resource_role(self, _session_id: str, _terminal_id: str) -> str:
+        return CODEX_NATIVE_TERMINAL_ROLE
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "outcome", ["success", "setup_error", "forward_error", "cancelled", "superseded"]
+)
+async def test_codex_known_thread_forwarder_marks_its_pane_for_replacement(
+    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, outcome: str
+) -> None:
+    """
+    A forwarder that ends on its own closes the session's app-server, so the pane
+    on it stops counting as reusable and the next ensure replaces it. A deliberate
+    cancel (teardown or re-create) records nothing. Neither does a forwarder whose
+    app-server a newer launch has already replaced: that launch keeps its registry
+    entry, and only the retiring forwarder's own server is closed.
+    """
+    from omnigent.harnesses.codex_native import forwarder as codex_forwarder
+    from omnigent.runner import _entry
+    from omnigent.runner.native import orchestration
+
+    closed: list[str] = []
+
+    class _AppServer:
+        def __init__(self, name: str) -> None:
+            self.name = name
+
+        async def close(self) -> None:
+            closed.append(self.name)
+
+    launched, successor = _AppServer("launched"), _AppServer("successor")
+
+    def server_url(_name: str) -> str:
+        if outcome == "setup_error":
+            raise RuntimeError("setup failed")
+        return "http://127.0.0.1:8000"
+
+    async def forward(**_kwargs: Any) -> None:
+        if outcome == "forward_error":
+            raise RuntimeError("forward failed")
+        if outcome == "cancelled":
+            raise asyncio.CancelledError
+
+    session_id = "6f2e1d0c9b8a47f6a5e4d3c2b1a09f8e"
+    monkeypatch.setattr(codex_native_bridge, "_BRIDGE_ROOT", tmp_path / "codex-bridge")
+    bridge_dir = codex_native_bridge.prepare_bridge_dir(session_id)
+    monkeypatch.setattr(orchestration, "_required_runner_env", server_url)
+    monkeypatch.setattr(_entry, "_make_auth_token_factory", lambda: None)
+    monkeypatch.setattr(codex_forwarder, "supervise_forwarder", forward)
+    registered = successor if outcome == "superseded" else launched
+    orchestration._AUTO_CODEX_APP_SERVERS[session_id] = registered  # type: ignore[assignment]
+    try:
+        operation = orchestration._codex_forward_known_thread(
+            session_id=session_id,
+            bridge_dir=bridge_dir,
+            codex_ws_url="ws://127.0.0.1:9876",
+            thread_id="thread_test",
+            app_server=launched,  # type: ignore[arg-type]
+        )
+        if outcome in ("success", "superseded"):
+            await operation
+        else:
+            error = asyncio.CancelledError if outcome == "cancelled" else RuntimeError
+            with pytest.raises(error):
+                await operation
+        slot_after = orchestration._AUTO_CODEX_APP_SERVERS.get(session_id)
+        view = SessionResourceView(
+            id="terminal_codex_main", type="terminal", session_id=session_id, name="Codex"
+        )
+        reusable = orchestration._is_runner_owned_codex_terminal(_CodexPaneRegistry(), view)  # type: ignore[arg-type]
+    finally:
+        orchestration._AUTO_CODEX_APP_SERVERS.pop(session_id, None)
+
+    # The retiring forwarder closes its own server, and only that one.
+    assert closed == ["launched"]
+    recorded = codex_native_bridge.read_bridge_startup_failure(bridge_dir)
+    if outcome == "superseded":
+        assert slot_after is successor
+        assert recorded is None
+        assert reusable is True
+    elif outcome == "cancelled":
+        assert slot_after is None
+        assert recorded is None
+        assert reusable is True
+    else:
+        assert slot_after is None
+        assert recorded == codex_native_bridge.CODEX_APP_SERVER_STOPPED
+        assert reusable is False
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("outcome", ["returns", "raises", "cancelled", "superseded"])
+async def test_codex_discover_thread_and_forward_marks_its_pane_for_replacement(
+    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, outcome: str
+) -> None:
+    """
+    A fresh-session forwarder that ends on its own records that its app-server is
+    gone. A cancel records nothing, and neither
```

---

### Incident Patch 8: `e6001d52` (2026-10-05)
**Commit Message**: fix(pi-native): make transcript event delivery durable (#9144)

* fix(pi-native): make transcript event delivery durable

Signed-off-by: Edwin He <[REDACTED_EMAIL]>

* fix(pi-native): classify durable event delivery failures

Signed-off-by: Edwin He <[REDACTED_EMAIL]>

* docs(pi-native): clarify event durability contract

Signed-off-by: Edwin He <[REDACTED_EMAIL]>

* fix(pi-native): narrow durable assistant persistence

Signed-off-by: Edwin He <[REDACTED_EMAIL]>

---------

Signed-off-by: Edwin He <[REDACTED_EMAIL]>

**File**: `omnigent/resources/pi_native/omnigent_pi_native_extension.js` (modified, +117/-10)
```diff
@@ -779,7 +779,29 @@ function headers(config) {
   };
 }
 
-async function postEvent(config, body) {
+const _ASSISTANT_ITEM_MAX_ATTEMPTS = 3;
+const _ASSISTANT_ITEM_INITIAL_BACKOFF_MS = 50;
+const _ASSISTANT_ITEM_MAX_BACKOFF_MS = 250;
+const _ASSISTANT_ITEM_POST_TIMEOUT_MS = 5_000;
+
+function boundedSourceId(sourceId) {
+  const value = typeof sourceId === "string" ? sourceId.trim() : "";
+  if (!value) throw new Error("assistant conversation item requires source_id");
+  if (value.length <= 256) return value;
+  return `pi:${crypto.createHash("sha256").update(value).digest("hex")}`;
+}
+
+function eventPostError(response) {
+  const status = response && response.status;
+  if (typeof status === "number" && Number.isFinite(status)) {
+    const error = new Error(`Omnigent event POST failed with HTTP ${status}`);
+    error.status = status;
+    return error;
+  }
+  return new Error("Omnigent event POST returned an invalid response");
+}
+
+async function postEventChecked(config, body, signal) {
   if (
     !config ||
     !config.serverUrl ||
@@ -788,17 +810,94 @@ async function postEvent(config, body) {
   )
     return;
   const url = `${config.serverUrl}/v1/sessions/${encodeURIComponent(config.sessionId)}/events`;
+  const request = {
+    method: "POST",
+    headers: headers(config),
+    body: JSON.stringify(body),
+  };
+  if (signal) request.signal = signal;
+  const response = await fetch(url, request);
+  const status = response && response.status;
+  if (
+    !response ||
+    (typeof status === "number" &&
+      (!Number.isFinite(status) || status < 200 || status >= 300)) ||
+    (typeof status !== "number" && response.ok !== true)
+  ) {
+    throw eventPostError(response);
+  }
+  return response;
+}
+
+async function postEvent(config, body) {
   try {
-    await fetch(url, {
-      method: "POST",
-      headers: headers(config),
-      body: JSON.stringify(body),
-    });
+    await postEventChecked(config, body);
   } catch (_err) {
     // Keep Pi responsive even if Omnigent is temporarily unavailable.
   }
 }
 
+function isRetryableAssistantError(error) {
+  const status = error && error.status;
+  if (typeof status !== "number") return true;
+  return status === 408 || status === 429 || (status >= 500 && status <= 599);
+}
+
+function assistantItemPostTimeoutMs(config) {
+  const configured = config && config.assistantItemPostTimeoutMs;
+  return typeof configured === "number" &&
+    Number.isFinite(configured) &&
+    configured > 0
+    ? configured
+    : _ASSISTANT_ITEM_POST_TIMEOUT_MS;
+}
+
+// Only the authoritative assistant message_end uses this checked, bounded
+// path; every other bridge event retains postEvent's best-effort behavior.
+async function postAssistantMessage(config, data, sourceId) {
+  const body = {
+    type: "external_conversation_item",
+    data: { ...data, source_id: boundedSourceId(sourceId) },
+  };
+  let backoff = _ASSISTANT_ITEM_INITIAL_BACKOFF_MS;
+  let lastError;
+  for (let attempt = 1; attempt <= _ASSISTANT_ITEM_MAX_ATTEMPTS; attempt += 1) {
+    const controller = new AbortController();
+    const timeout = setTimeout(
+      () => controller.abort(),
+      assistantItemPostTimeoutMs(config),
+    );
+    try {
+      return await postEventChecked(config, body, controller.signal);
+    } catch (err) {
+      lastError = err;
+    } finally {
+      clearTimeout(timeout);
+    }
+    if (
+      attempt === _ASSISTANT_ITEM_MAX_ATTEMPTS ||
+      !isRetryableAssistantError(lastError)
+    )
+      break;
+    await sleep(backoff);
+    backoff = Math.min(backoff * 2, _ASSISTANT_ITEM_MAX_BACKOFF_MS);
+  }
+  throw lastError || new Error("assistant conversation item POST failed");
+}
+
+function assistantMessageSourceId(message, responseId, text) {
+  const response =
+    message && typeof message.responseId === "string" && message.responseId
+      ? `response:${message.responseId}`
+      : "";
+  const timestamp =
+    message && typeof message.timestamp === "number"
+      ? `timestamp:${message.timestamp}`
+      : "";
+  const identity = response || timestamp || `turn:${responseId}:${fingerprint(text)}`;
+  return boundedSourceId(`pi:assistant:${identity}`);
+}
+
 async function patchExternalSessionId(config, nativeSessionId) {
   if (
     !nativeSessionId ||
@@ -1298,6 +1397,7 @@ module.exports = function (pi) {
   const postedToolCalls = new Set();
   const postedToolResults = new Set();
   const postedReasoning = new Set();
+  const postedAssistantMessages = new Set();
   const streamedReasoningBlocks = new Set();
   const toolCallsById = new Map();
   const pendingInterruptMs = 30_000;
@@ -1948,6 +2048,7 @@ module.exports = function (pi) {
     postedToolCalls.clear();
     postedToolResults.clear();
     postedReasoning.clear();
+    postedAssistantMessages.clear();
     streamedReasoningBlocks.clear();
     toolCallsById.clear();
     streamedTextIndex.clear();
@@ -2162,12 +2263,14 @@ module.exports = function (pi) {
     }
     
```

**File**: `tests/harnesses/pi_native/test_pi_native_extension.py` (modified, +166/-0)
```diff
@@ -803,6 +803,172 @@ def test_message_without_streamed_text_posts_no_delta(tmp_path: Path) -> None:
     assert result.returncode == 0, result.stdout + result.stderr
 
 
+_ASSISTANT_DURABILITY_HARNESS = r"""
+const assert = require("assert").strict;
+const fs = require("fs");
+const path = require("path");
+
+const extensionPath = process.argv[1];
+const tmpDir = process.argv[2];
+const configPath = path.join(tmpDir, "config.json");
+fs.writeFileSync(
+  configPath,
+  JSON.stringify({
+    serverUrl: "http://omnigent.test",
+    sessionId: "session-1",
+    // Keep retry-timeout coverage fast; production uses the default.
+    assistantItemPostTimeoutMs: 10,
+  }),
+);
+process.env.OMNIGENT_PI_NATIVE_CONFIG = configPath;
+
+const posted = [];
+let fetchCalls = 0;
+const responses = [];
+global.fetch = async (_url, request) => {
+  posted.push(JSON.parse(request.body));
+  fetchCalls += 1;
+  if (responses.length) return responses.shift();
+  return { ok: true, status: 204 };
+};
+global.setInterval = () => ({ fakeInterval: true });
+
+const handlers = {};
+const pi = {
+  registerCommand() {},
+  on(name, handler) { handlers[name] = handler; },
+};
+require(extensionPath)(pi);
+const ctx = { ui: { setTitle() {}, setStatus() {}, notify() {} } };
+function assistantItems() {
+  return posted.filter(
+    (event) =>
+      event.type === "external_conversation_item" &&
+      event.data.item_type === "message" &&
+      event.data.item_data.role === "assistant",
+  );
+}
+"""
+
+
+def test_assistant_message_retries_with_stable_source_and_exact_text(
+    tmp_path: Path,
+) -> None:
+    """Pi's real assistant identity survives one transient POST failure."""
+    script = (
+        _ASSISTANT_DURABILITY_HARNESS
+        + r"""
+(async () => {
+  responses.push({ ok: false, status: 503 }, { ok: true, status: 204 });
+  const message = {
+    role: "assistant",
+    timestamp: 1700000000123,
+    responseId: "pi-response-42",
+    content: [{ type: "text", text: "exact assistant answer" }],
+  };
+  await handlers.message_end({ message }, ctx);
+
+  const attempts = assistantItems();
+  assert.equal(fetchCalls, 2, JSON.stringify(posted));
+  assert.equal(attempts.length, 2, JSON.stringify(attempts));
+  assert.match(attempts[0].data.source_id, /response:pi-response-42/);
+  assert.equal(attempts[0].data.source_id, attempts[1].data.source_id);
+  assert.deepEqual(
+    attempts.map((item) => item.data.item_data.content),
+    [
+      [{ type: "output_text", text: "exact assistant answer" }],
+      [{ type: "output_text", text: "exact assistant answer" }],
+    ],
+  );
+
+  // A duplicate callback after acceptance is suppressed; a failed callback
+  // would remain eligible because the dedupe mark is added after success.
+  await handlers.message_end({ message }, ctx);
+  assert.equal(fetchCalls, 2, JSON.stringify(posted));
+})().catch((error) => {
+  console.error(error && error.stack ? error.stack : error);
+  process.exit(1);
+});
+"""
+    )
+    result = _run_node(script, str(_extension_path()), str(tmp_path))
+    assert result.returncode == 0, result.stdout + result.stderr
+
+
+def test_assistant_message_failure_propagates_and_400_is_not_retried(
+    tmp_path: Path,
+) -> None:
+    """Exhausted transient failures reject, while a permanent 400 is single-shot."""
+    script = (
+        _ASSISTANT_DURABILITY_HARNESS
+        + r"""
+(async () => {
+  global.fetch = async (_url, request) => {
+    posted.push(JSON.parse(request.body));
+    fetchCalls += 1;
+    return { ok: false, status: 503 };
+  };
+  const transientMessage = {
+    role: "assistant",
+    timestamp: 1700000000124,
+    responseId: "pi-response-transient",
+    content: [{ type: "text", text: "retry then surface" }],
+  };
+  let failure;
+  try {
+    await handlers.message_end({ message: transientMessage }, ctx);
+  } catch (error) {
+    failure = error;
+  }
+  assert.ok(failure, "exhausted assistant persistence must reject");
+  assert.match(String(failure && failure.message), /HTTP 503/);
+  assert.equal(fetchCalls, 3, JSON.stringify(posted));
+  assert.equal(assistantItems().length, 3, JSON.stringify(posted));
+  assert.equal(
+    new Set(assistantItems().map((item) => item.data.source_id)).size,
+    1,
+    JSON.stringify(posted),
+  );
+
+  // The failed callback remains eligible for a later delivery.
+  global.fetch = async (_url, request) => {
+    posted.push(JSON.parse(request.body));
+    fetchCalls += 1;
+    return { ok: true, status: 204 };
+  };
+  await handlers.message_end({ message: transientMessage }, ctx);
+  assert.equal(fetchCalls, 4, JSON.stringify(posted));
+
+  global.fetch = async (_url, request) => {
+    posted.push(JSON.parse(request.body));
+    fetchCalls += 1;
+    return { ok: false, status: 400 };
+  };
+  const permanentMessage = {
+    role: "assistant",
+    timestamp: 1700000000125,
+    responseId: "pi-response-permanent",
+    content: [{ type: "text", text: "bad request answer" }],
+  }
```

---

### Incident Patch 9: `93144447` (2026-10-05)
**Commit Message**: refactor(electron): share the loopback sign-in runner and token store, and parse manifest auth (#8896)

## Related issue

N/A (refactor). Prepares the desktop for OIDC system-browser sign-in (#4649), which comes next in this stack.

## Summary

- **Why:** OIDC sign-in in the desktop needs what Databricks OAuth already has: an RFC 8252 loopback listener and an encrypted per-origin credential file. Both lived inside `databricks-oauth.js`. Copying them would mean maintaining the state check, timeout, cancellation and keychain handling twice.
- **`src/loopback-oauth.js`:** the listener, state check, timeout, abort handling, browser hand-off and landing pages, moved out of `runInteractiveLogin` (PKCE helpers included). The Databricks flow passes its existing host, path, redirect URI and page text, so its behavior is unchanged. Error callbacks now also carry `errorCode` / `errorDescription` so a caller can show the server's reason.
- **`src/token_store.js`:** the safeStorage-encrypted `~/.omnigent/<file>` store, moved out of `databricks-oauth.js`. It still uses the same file, keying and on-disk format, and exposes its key function so the Databricks refresh dedupe can't drift from it. The

**File**: `web/electron/src/databricks-oauth.js` (modified, +39/-197)
```diff
@@ -24,12 +24,10 @@
 
 "use strict";
 
-const http = require("node:http");
 const crypto = require("node:crypto");
-const fs = require("node:fs");
-const path = require("node:path");
-const os = require("node:os");
-const { shell, safeStorage } = require("electron");
+const { shell } = require("electron");
+const { base64url, makePkce, runLoopbackAuthorization } = require("./loopback-oauth");
+const { createTokenStore } = require("./token_store");
 
 // The loopback redirect every published client registers. Not configurable: the
 // port is ephemeral per RFC 8252 (Databricks ignores it), and pinning a host,
@@ -81,79 +79,15 @@ function isTrustedDatabricksOrigin(url) {
   }
 }
 
-// ── PKCE (S256) ────────────────────────────────────────────────────────────
-
-function base64url(buf) {
-  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
-}
-
-function makePkce() {
-  const verifier = base64url(crypto.randomBytes(64));
-  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
-  return { verifier, challenge };
-}
-
 // ── Token store (~/.omnigent, encrypted at rest via safeStorage) ─────────────
-//
-// A dedicated file, NOT the CLI's auth_tokens.json: the shapes differ and mixing
-// them would confuse omnigent_cli.js's readers. Keyed by the trailing-slash-
-// stripped workspace origin, mirroring that store's keying.
-
-function tokenStorePath() {
-  return path.join(os.homedir(), ".omnigent", "databricks_oauth_tokens.json");
-}
-
-function storeKey(origin) {
-  return String(origin).replace(/\/+$/, "");
-}
-
-function readStore() {
-  try {
-    return JSON.parse(fs.readFileSync(tokenStorePath(), "utf8"));
-  } catch {
-    return {};
-  }
-}
-
-function writeStore(store) {
-  const p = tokenStorePath();
-  fs.mkdirSync(path.dirname(p), { recursive: true });
-  fs.writeFileSync(p, JSON.stringify(store, null, 2), { mode: 0o600 });
-  try {
-    fs.chmodSync(p, 0o600);
-  } catch {
-    // Non-POSIX filesystem — the write-time mode is best effort.
-  }
-}
-
-function saveTokens(origin, tokens) {
-  const store = readStore();
-  if (safeStorage.isEncryptionAvailable()) {
-    store[storeKey(origin)] = {
-      enc: safeStorage.encryptString(JSON.stringify(tokens)).toString("base64"),
-    };
-  } else {
-    console.warn(
-      "[omnigent] safeStorage unavailable; storing Databricks tokens unencrypted (0600)",
-    );
-    store[storeKey(origin)] = { plain: tokens };
-  }
-  writeStore(store);
-}
 
-function loadTokens(origin) {
-  const entry = readStore()[storeKey(origin)];
-  if (!entry || typeof entry !== "object") return null;
-  if (typeof entry.enc === "string") {
-    try {
-      return JSON.parse(safeStorage.decryptString(Buffer.from(entry.enc, "base64")));
-    } catch {
-      return null;
-    }
-  }
-  if (entry.plain && typeof entry.plain === "object") return entry.plain;
-  return null;
-}
+const tokenStore = createTokenStore({
+  fileName: "databricks_oauth_tokens.json",
+  label: "Databricks tokens",
+});
+const saveTokens = tokenStore.save;
+const loadTokens = tokenStore.load;
+const deleteStoredToken = tokenStore.remove;
 
 /** Mark only the cached access token expired, preserving its refresh grant. */
 function expireStoredAccessToken(origin) {
@@ -171,15 +105,6 @@ function removeStoredRefreshToken(origin) {
   return true;
 }
 
-function deleteStoredToken(origin) {
-  const key = storeKey(origin);
-  const store = readStore();
-  if (store[key]) {
-    Reflect.deleteProperty(store, key);
-    writeStore(store);
-  }
-}
-
 /**
  * Persist a token keyed by the WORKSPACE origin it is used against. For an
  * account-first (SPOG) login the token is account-scoped; ``account`` records
@@ -343,7 +268,7 @@ async function doRefresh(workspaceOrigin, entry) {
 }
 
 function refreshStoredToken(workspaceOrigin, entry) {
-  const key = storeKey(workspaceOrigin);
+  const key = tokenStore.key(workspaceOrigin);
   const existing = inflightRefresh.get(key);
   if (existing) return existing;
   const p = doRefresh(workspaceOrigin, entry).finally(() => inflightRefresh.delete(key));
@@ -471,110 +396,17 @@ async function runInteractiveLogin(origin, { signal } = {}) {
   }
   signal?.throwIfAborted();
   const { verifier, challenge } = makePkce();
-  const state = base64url(crypto.randomBytes(24));
   const base = new URL(REDIRECT_BASE);
-  let redirectUri;
-
-  const callback = await new Promise((resolve, reject) => {
-    const server = http.createServer((req, res) => {
-      let reqUrl;
-      try {
-        reqUrl = new URL(req.url, base.origin);
-      } catch {
-        reqUrl = null;
-      }
-      if (!reqUrl || reqUrl.pathname !== base.pathname) {
-        res.writeHead(404);
-        res.end();
-        return;
-      }
-      const params = reqUrl.searchParams;
-      // An old browser tab must not terminate a new login on a reused loopback port.
-      if (params.get("state") !== state) {
-        res.writeHead(400, { "Cont
```

**File**: `web/electron/src/loopback-oauth.js` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+// RFC 8252 loopback authorization in the system browser, shared by desktop
+// sign-ins. The caller builds the authorize URL; this module owns the one-shot
+// loopback listener, state check, timeout, cancellation, and the landing page.
+
+"use strict";
+
+const http = require("node:http");
+const crypto = require("node:crypto");
+
+/** Bound on how long we wait for the human to finish signing in in the browser. */
+const LOOPBACK_TIMEOUT_MS = 300_000;
+
+function base64url(buf) {
+  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
+}
+
+/** A PKCE (S256) verifier and its challenge. */
+function makePkce() {
+  const verifier = base64url(crypto.randomBytes(64));
+  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
+  return { verifier, challenge };
+}
+
+const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
+const page = ([heading, detail]) =>
+  '<html><body style="font-family:system-ui;text-align:center;padding:60px">' +
+  `<h2>${escapeHtml(heading)}</h2><p>${escapeHtml(detail)}</p></body></html>`;
+
+/**
+ * Open the system browser at an authorize URL and wait for its redirect back
+ * to a one-shot loopback listener.
+ *
+ * Resolves with the callback's query parameters once a request carrying the
+ * expected `state` and a `code` arrives. Rejects on an `error` callback (the
+ * error carries `errorCode` / `errorDescription`), a callback without a code,
+ * the timeout (`code: "LOOPBACK_TIMEOUT"`), a browser that can't be opened
+ * (`code: "BROWSER_UNAVAILABLE"`), or `signal` aborting.
+ *
+ * @param {{
+ *   hostname: string,
+ *   callbackPath: string,
+ *   redirectUri: (port: number) => string,
+ *   authorizeUrl: (redirectUri: string, state: string) => string,
+ *   openExternal: (url: string) => Promise<unknown>,
+ *   pages: { received: [string, string], failed: [string, string], incomplete: [string, string] },
+ *   signal?: AbortSignal,
+ *   timeoutMs?: number,
+ *   onOpened?: () => void,
+ * }} options
+ *   `hostname` is the interface to listen on (`localhost` or `127.0.0.1`);
+ *   `callbackPath` the only path the listener answers. `pages` are fixed
+ *   heading/detail pairs for the browser tab: `received` after a code, `failed`
+ *   after an `error` callback, `incomplete` after a callback without a code.
+ * @returns {Promise<{ params: URLSearchParams, redirectUri: string }>}
+ */
+async function runLoopbackAuthorization({
+  hostname,
+  callbackPath,
+  redirectUri: redirectUriFor,
+  authorizeUrl,
+  openExternal,
+  pages,
+  signal,
+  timeoutMs = LOOPBACK_TIMEOUT_MS,
+  onOpened,
+}) {
+  signal?.throwIfAborted();
+  const state = base64url(crypto.randomBytes(24));
+  let redirectUri;
+
+  return new Promise((resolve, reject) => {
+    const server = http.createServer((req, res) => {
+      let reqUrl;
+      try {
+        reqUrl = new URL(req.url, "http://localhost");
+      } catch {
+        reqUrl = null;
+      }
+      if (!reqUrl || reqUrl.pathname !== callbackPath) {
+        res.writeHead(404);
+        res.end();
+        return;
+      }
+      const params = reqUrl.searchParams;
+      // An old browser tab must not terminate a new login on a reused loopback port.
+      if (params.get("state") !== state) {
+        res.writeHead(400, { "Content-Type": "text/plain" });
+        res.end("This callback does not match the current sign-in.");
+        return;
+      }
+      // Validate before answering: the desktop still has to exchange the code and
+      // create the session, so this page must not claim sign-in succeeded.
+      const fail = (error, copy) => {
+        res.writeHead(400, { "Content-Type": "text/html" });
+        res.end(page(copy));
+        cleanup();
+        reject(error);
+      };
+      const err = params.get("error");
+      if (err) {
+        const desc = params.get("error_description");
+        fail(
+          Object.assign(new Error(`authorization error: ${err}${desc ? ` - ${desc}` : ""}`), {
+            errorCode: err,
+            errorDescription: desc ?? undefined,
+          }),
+          pages.failed,
+        );
+        return;
+      }
+      if (!params.get("code")) {
+        fail(new Error("no code in callback"), pages.incomplete);
+        return;
+      }
+      res.writeHead(200, { "Content-Type": "text/html" });
+      res.end(page(pages.received));
+      cleanup();
+      resolve({ params, redirectUri });
+    });
+
+    const timer = setTimeout(() => {
+      cleanup();
+      reject(
+        Object.assign(new Error("timed out waiting for browser login"), {
+          code: "LOOPBACK_TIMEOUT",
+        }),
+      );
+    }, timeoutMs);
+
+    function cleanup() {
+      clearTimeout(timer);
+      signal?.removeEventListener("abort", onAbort);
+      server.close();
+    }
+
+    function onAbort() {
+      cleanup();
+      reject(signal.reason);
+    }
+
+    server.on("error", 
```

**File**: `web/electron/src/token_store.js` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+// Per-origin credential files under ~/.omnigent, encrypted at rest via
+// safeStorage. Each sign-in kind gets its own file, NOT the CLI's
+// auth_tokens.json: the shapes differ and mixing them would confuse its readers.
+
+"use strict";
+
+const fs = require("node:fs");
+const path = require("node:path");
+const os = require("node:os");
+const { safeStorage } = require("electron");
+
+function storeKey(origin) {
+  return String(origin).replace(/\/+$/, "");
+}
+
+/**
+ * @param {{ fileName: string, label: string }} options `fileName` under
+ *   `~/.omnigent`; `label` names the credentials in the plaintext warning.
+ */
+function createTokenStore({ fileName, label }) {
+  // Resolved per call so tests (and a changed HOME) see the current home dir.
+  const storePath = () => path.join(os.homedir(), ".omnigent", fileName);
+
+  function readStore() {
+    try {
+      return JSON.parse(fs.readFileSync(storePath(), "utf8"));
+    } catch {
+      return {};
+    }
+  }
+
+  function writeStore(store) {
+    const p = storePath();
+    fs.mkdirSync(path.dirname(p), { recursive: true });
+    fs.writeFileSync(p, JSON.stringify(store, null, 2), { mode: 0o600 });
+    try {
+      fs.chmodSync(p, 0o600);
+    } catch {
+      // Non-POSIX filesystem — the write-time mode is best effort.
+    }
+  }
+
+  function save(origin, tokens) {
+    const store = readStore();
+    if (safeStorage.isEncryptionAvailable()) {
+      store[storeKey(origin)] = {
+        enc: safeStorage.encryptString(JSON.stringify(tokens)).toString("base64"),
+      };
+    } else {
+      console.warn(`[omnigent] safeStorage unavailable; storing ${label} unencrypted (0600)`);
+      store[storeKey(origin)] = { plain: tokens };
+    }
+    writeStore(store);
+  }
+
+  function load(origin) {
+    const entry = readStore()[storeKey(origin)];
+    if (!entry || typeof entry !== "object") return null;
+    if (typeof entry.enc === "string") {
+      try {
+        return JSON.parse(safeStorage.decryptString(Buffer.from(entry.enc, "base64")));
+      } catch {
+        return null;
+      }
+    }
+    if (entry.plain && typeof entry.plain === "object") return entry.plain;
+    return null;
+  }
+
+  function remove(origin) {
+    const key = storeKey(origin);
+    const store = readStore();
+    if (store[key]) {
+      Reflect.deleteProperty(store, key);
+      writeStore(store);
+    }
+  }
+
+  return { key: storeKey, save, load, remove };
+}
+
+module.exports = { createTokenStore };
```

**File**: `web/electron/src/url.js` (modified, +74/-1)
```diff
@@ -364,8 +364,74 @@
     serverVersion: null,
     minDesktopVersion: null,
     ui: Object.freeze({}),
+    auth: null,
+    serverName: null,
   });
 
+  /** Sign-in modes a server may name in its manifest's `auth.mode`. */
+  const MANIFEST_AUTH_MODES = new Set(["oidc", "accounts", "header", "custom", "none"]);
+  /** The only session cookies an Omnigent server sets. */
+  const SESSION_COOKIE_NAMES = new Set(["__Host-ap_session", "ap_session"]);
+  /** Longest server name the shell displays, in characters. */
+  const MAX_SERVER_NAME_LENGTH = 64;
+
+  /**
+   * The manifest's `auth` block, or null when absent or untrustworthy. The
+   * manifest is unauthenticated server input, so only known modes and the two
+   * real cookie names pass, and a `__Host-` cookie only for an https server
+   * (Chromium rejects it on http).
+   *
+   * @param {unknown} raw The manifest's `auth` value.
+   * @param {string} serverUrl The URL the manifest was fetched for.
+   * @returns {{ mode: string, sessionCookie: string | null } | null}
+   */
+  function parseManifestAuth(raw, serverUrl) {
+    if (raw === null || typeof raw !== "object" || !MANIFEST_AUTH_MODES.has(raw.mode)) {
+      return null;
+    }
+    let sessionCookie = null;
+    if (typeof raw.session_cookie === "string" && SESSION_COOKIE_NAMES.has(raw.session_cookie)) {
+      sessionCookie = raw.session_cookie;
+    }
+    let https = false;
+    try {
+      https = new URL(serverUrl).protocol === "https:";
+    } catch {
+      // Not a URL: treat as not https.
+    }
+    if (sessionCookie?.startsWith("__Host-") && !https) sessionCookie = null;
+    return { mode: raw.mode, sessionCookie };
+  }
+
+  /**
+   * A server-supplied display name made safe to show: control and invisible
+   * format characters (bidi marks and overrides, zero-width characters)
+   * removed, whitespace collapsed, at most {@link MAX_SERVER_NAME_LENGTH}
+   * user-perceived characters. Null when nothing is left.
+   *
+   * @param {unknown} raw
+   * @returns {string | null}
+   */
+  function sanitizeServerName(raw) {
+    if (typeof raw !== "string") return null;
+    const cleaned = raw
+      .replace(/[\p{Cc}\p{Cf}]/gu, "")
+      .replace(/\s+/g, " ")
+      .trim();
+    const graphemes =
+      typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
+        ? Array.from(
+            new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(cleaned),
+            (s) => s.segment,
+          )
+        : Array.from(cleaned);
+    const name =
+      graphemes.length > MAX_SERVER_NAME_LENGTH
+        ? graphemes.slice(0, MAX_SERVER_NAME_LENGTH).join("").trimEnd()
+        : cleaned;
+    return name || null;
+  }
+
   /**
    * Timeout for the manifest fetch. Short and non-fatal for the same reason as
    * the workspace probe: connecting must never stall behind it. On timeout we
@@ -391,7 +457,9 @@
    * @param {string} serverUrl A normalized absolute http(s) server URL.
    * @param {{ signal?: AbortSignal }} [options] Optional connection cancellation.
    * @returns {Promise<{manifestVersion: number, serverVersion: string | null,
-   *   minDesktopVersion: string | null, ui: Record<string, unknown>}>}
+   *   minDesktopVersion: string | null, ui: Record<string, unknown>,
+   *   auth: { mode: string, sessionCookie: string | null } | null,
+   *   serverName: string | null}>}
    */
   async function fetchServerManifest(serverUrl, { signal } = {}) {
     signal?.throwIfAborted();
@@ -443,6 +511,8 @@
       // Passed through as-is: unknown keys are the extension point, so the
       // shell must not filter to the ones this release happens to know.
       ui: body.ui !== null && typeof body.ui === "object" ? body.ui : {},
+      auth: parseManifestAuth(body.auth, serverUrl),
+      serverName: sanitizeServerName(body.server_name),
     };
   }
 
@@ -463,6 +533,9 @@
     WELL_KNOWN_MANIFEST_PATH,
     MANIFEST_FETCH_TIMEOUT_MS,
     PRE_MANIFEST_BASELINE,
+    MAX_SERVER_NAME_LENGTH,
+    parseManifestAuth,
+    sanitizeServerName,
     fetchServerManifest,
   };
 });
```

**File**: `web/electron/test/loopback-oauth.test.js` (added, +155/-0)
```diff
@@ -0,0 +1,155 @@
+// Unit tests for the shared RFC 8252 loopback runner (src/loopback-oauth.js),
+// run with `node --test`. A real listener answers real HTTP requests; only the
+// system browser is replaced by a callback that reports the authorize URL.
+
+"use strict";
+
+const { describe, it } = require("node:test");
+const assert = require("node:assert/strict");
+const crypto = require("node:crypto");
+const http = require("node:http");
+
+const { makePkce, runLoopbackAuthorization } = require("../src/loopback-oauth");
+
+const pages = {
+  received: ["Received", "Return to the app."],
+  failed: ["Failed", "Try again."],
+  incomplete: ["Incomplete", "Try again."],
+};
+
+/** Start a run; resolve once the "browser" was opened with the authorize URL. */
+function start(options = {}) {
+  let opened;
+  const browser = new Promise((resolve) => {
+    opened = resolve;
+  });
+  const run = runLoopbackAuthorization({
+    hostname: "127.0.0.1",
+    callbackPath: "/callback",
+    redirectUri: (port) => `http://127.0.0.1:${port}/callback`,
+    authorizeUrl: (redirectUri, state) =>
+      `https://idp.test/authorize?${new URLSearchParams({ redirect_uri: redirectUri, state })}`,
+    openExternal: async (url) => opened(new URL(url)),
+    pages,
+    ...options,
+  });
+  const settled = run.then(
+    (value) => ({ value }),
+    (error) => ({ error }),
+  );
+  return { browser, settled };
+}
+
+function get(url) {
+  return new Promise((resolve, reject) => {
+    http
+      .get(url, { agent: false }, (res) => {
+        let body = "";
+        res.setEncoding("utf8");
+        res.on("data", (chunk) => {
+          body += chunk;
+        });
+        res.on("end", () => resolve({ status: res.statusCode, body }));
+      })
+      .on("error", reject);
+  });
+}
+
+function callbackUrl(authorize, params) {
+  const url = new URL(authorize.searchParams.get("redirect_uri"));
+  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
+  return url;
+}
+
+describe("runLoopbackAuthorization", () => {
+  it("resolves with the callback params and the redirect URI", { timeout: 5000 }, async () => {
+    const { browser, settled } = start();
+    const authorize = await browser;
+    const state = authorize.searchParams.get("state");
+    const response = await get(callbackUrl(authorize, { state, code: "abc" }));
+    const { value } = await settled;
+    assert.equal(response.status, 200);
+    assert.match(response.body, /Received/);
+    assert.equal(value.params.get("code"), "abc");
+    assert.equal(value.redirectUri, authorize.searchParams.get("redirect_uri"));
+  });
+
+  it("ignores other paths and stale state, then still accepts the real callback", async () => {
+    const { browser, settled } = start();
+    const authorize = await browser;
+    const state = authorize.searchParams.get("state");
+    const other = new URL(authorize.searchParams.get("redirect_uri"));
+    other.pathname = "/favicon.ico";
+    assert.equal((await get(other)).status, 404);
+    assert.equal((await get(callbackUrl(authorize, { state: "old", code: "x" }))).status, 400);
+    await get(callbackUrl(authorize, { state, code: "real" }));
+    assert.equal((await settled).value.params.get("code"), "real");
+  });
+
+  it("rejects an error callback with its code and description", async () => {
+    const { browser, settled } = start();
+    const authorize = await browser;
+    const state = authorize.searchParams.get("state");
+    const response = await get(
+      callbackUrl(authorize, {
+        state,
+        error: "access_denied",
+        error_description: "Email domain 'x.test' is not permitted",
+      }),
+    );
+    const { error } = await settled;
+    assert.equal(response.status, 400);
+    assert.match(response.body, /Failed/);
+    assert.equal(error.errorCode, "access_denied");
+    assert.equal(error.errorDescription, "Email domain 'x.test' is not permitted");
+  });
+
+  it("rejects a callback without a code", async () => {
+    const { browser, settled } = start();
+    const authorize = await browser;
+    const state = authorize.searchParams.get("state");
+    const response = await get(callbackUrl(authorize, { state }));
+    assert.match(response.body, /Incomplete/);
+    assert.match((await settled).error.message, /no code in callback/);
+  });
+
+  it("stops listening when cancelled", async () => {
+    const controller = new AbortController();
+    const { browser, settled } = start({ signal: controller.signal });
+    const authorize = await browser;
+    controller.abort(Object.assign(new Error("cancelled"), { name: "AbortError" }));
+    assert.equal((await settled).error.name, "AbortError");
+    await assert.rejects(get(callbackUrl(authorize, { state: "s", code: "c" })));
+  });
+
+  it("fails fast when the browser cannot be opened", async () => {
+    const { settled } = start({
+      openExternal: async () => Promise.reject(new Error("no browser")),
+    });

```

**File**: `web/electron/test/token_store.test.js` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+// Unit tests for the encrypted per-origin credential store (src/token_store.js),
+// run with `node --test`. safeStorage is a reversible stub; HOME is a temp dir.
+
+"use strict";
+
+const { describe, it, beforeEach, afterEach, mock } = require("node:test");
+const assert = require("node:assert/strict");
+const fs = require("node:fs");
+const os = require("node:os");
+const path = require("node:path");
+const Module = require("node:module");
+
+const safeStorage = {
+  available: true,
+  isEncryptionAvailable: () => safeStorage.available,
+  encryptString: (text) => Buffer.from(`enc:${text}`),
+  decryptString: (buffer) => {
+    const text = buffer.toString();
+    if (!text.startsWith("enc:")) throw new Error("bad ciphertext");
+    return text.slice(4);
+  },
+};
+const origLoad = Module["_load"];
+Module["_load"] = function (request, ...rest) {
+  if (request === "electron") return { safeStorage };
+  return origLoad.call(this, request, ...rest);
+};
+
+const { createTokenStore } = require("../src/token_store");
+
+let home;
+beforeEach(() => {
+  home = fs.mkdtempSync(path.join(os.tmpdir(), "omni-token-store-"));
+  mock.method(os, "homedir", () => home);
+  mock.method(console, "warn", () => {});
+  safeStorage.available = true;
+});
+afterEach(() => {
+  mock.restoreAll();
+  fs.rmSync(home, { recursive: true, force: true });
+});
+
+const file = () => path.join(home, ".omnigent", "test_tokens.json");
+const store = () => createTokenStore({ fileName: "test_tokens.json", label: "test tokens" });
+
+describe("createTokenStore", () => {
+  it("encrypts at rest, keyed by the slash-stripped origin", () => {
+    store().save("https://a.test/", { refresh_token: "r" });
+    const raw = JSON.parse(fs.readFileSync(file(), "utf8"));
+    assert.deepEqual(Object.keys(raw), ["https://a.test"]);
+    assert.equal(typeof raw["https://a.test"].enc, "string");
+    assert.doesNotMatch(fs.readFileSync(file(), "utf8"), /"r"/);
+    assert.deepEqual(store().load("https://a.test"), { refresh_token: "r" });
+    assert.equal(fs.statSync(file()).mode & 0o777, 0o600);
+  });
+
+  it("reads entries written by earlier builds, encrypted or plain", () => {
+    fs.mkdirSync(path.dirname(file()), { recursive: true });
+    fs.writeFileSync(
+      file(),
+      JSON.stringify({
+        "https://a.test": { enc: Buffer.from('enc:{"x":1}').toString("base64") },
+        "https://b.test": { plain: { y: 2 } },
+      }),
+    );
+    assert.deepEqual(store().load("https://a.test"), { x: 1 });
+    assert.deepEqual(store().load("https://b.test"), { y: 2 });
+  });
+
+  it("falls back to plaintext without a keychain, and warns", () => {
+    safeStorage.available = false;
+    store().save("https://a.test", { r: 1 });
+    assert.deepEqual(JSON.parse(fs.readFileSync(file(), "utf8"))["https://a.test"], {
+      plain: { r: 1 },
+    });
+    assert.match(console.warn.mock.calls[0].arguments[0], /storing test tokens unencrypted/);
+  });
+
+  it("returns null for undecryptable, corrupt, or missing entries", () => {
+    fs.mkdirSync(path.dirname(file()), { recursive: true });
+    fs.writeFileSync(
+      file(),
+      JSON.stringify({ "https://a.test": { enc: Buffer.from("junk").toString("base64") } }),
+    );
+    assert.equal(store().load("https://a.test"), null);
+    assert.equal(store().load("https://missing.test"), null);
+    fs.writeFileSync(file(), "{ not json");
+    assert.equal(store().load("https://a.test"), null);
+  });
+
+  it("removes one origin and leaves the others", () => {
+    store().save("https://a.test", { a: 1 });
+    store().save("https://b.test", { b: 1 });
+    store().remove("https://a.test/");
+    assert.equal(store().load("https://a.test"), null);
+    assert.deepEqual(store().load("https://b.test"), { b: 1 });
+  });
+
+  it("exposes the key it stores under", () => {
+    assert.equal(store().key("https://a.test///"), "https://a.test");
+  });
+});
```

**File**: `web/electron/test/url.test.js` (modified, +86/-0)
```diff
@@ -19,6 +19,9 @@ const {
   WORKSPACE_UI_PATH,
   fetchServerManifest,
   PRE_MANIFEST_BASELINE,
+  MAX_SERVER_NAME_LENGTH,
+  parseManifestAuth,
+  sanitizeServerName,
 } = require("../src/url");
 
 describe("defaultSchemeFor", () => {
@@ -603,6 +606,33 @@ describe("fetchServerManifest", () => {
     );
   });
 
+  it("reads the auth block and server name", async () => {
+    await withFetch(
+      async () =>
+        fakeJsonResponse({
+          manifest_version: 1,
+          auth: { mode: "oidc", session_cookie: "__Host-ap_session" },
+          server_name: "Acme Engineering",
+        }),
+      async () => {
+        const m = await fetchServerManifest("https://omni.example/");
+        assert.deepEqual(m.auth, { mode: "oidc", sessionCookie: "__Host-ap_session" });
+        assert.equal(m.serverName, "Acme Engineering");
+      },
+    );
+  });
+
+  it("leaves auth and server name null on an older server", async () => {
+    await withFetch(
+      async () => fakeJsonResponse({ manifest_version: 1 }),
+      async () => {
+        const m = await fetchServerManifest("https://omni.example/");
+        assert.equal(m.auth, null);
+        assert.equal(m.serverName, null);
+      },
+    );
+  });
+
   it("returns the baseline for an unparseable server URL", async () => {
     assert.deepEqual(await fetchServerManifest("not a url"), PRE_MANIFEST_BASELINE);
   });
@@ -622,3 +652,59 @@ describe("fetchServerManifest", () => {
     );
   });
 });
+
+describe("parseManifestAuth", () => {
+  it("accepts each known mode", () => {
+    for (const mode of ["oidc", "accounts", "header", "custom", "none"]) {
+      assert.equal(parseManifestAuth({ mode, session_cookie: null }, "https://a.test")?.mode, mode);
+    }
+  });
+
+  it("rejects unknown modes and non-objects", () => {
+    assert.equal(parseManifestAuth({ mode: "saml" }, "https://a.test"), null);
+    assert.equal(parseManifestAuth("oidc", "https://a.test"), null);
+    assert.equal(parseManifestAuth(null, "https://a.test"), null);
+  });
+
+  it("keeps only the real session cookie names", () => {
+    const auth = (cookie, url = "https://a.test") =>
+      parseManifestAuth({ mode: "oidc", session_cookie: cookie }, url).sessionCookie;
+    assert.equal(auth("__Host-ap_session"), "__Host-ap_session");
+    assert.equal(auth("ap_session", "http://localhost:8000"), "ap_session");
+    assert.equal(auth("session_id"), null);
+    assert.equal(auth(7), null);
+    // Chromium refuses a __Host- cookie on plain http.
+    assert.equal(auth("__Host-ap_session", "http://localhost:8000"), null);
+    assert.equal(auth("__Host-ap_session", "HTTPS://A.TEST"), "__Host-ap_session");
+    assert.equal(auth("__Host-ap_session", "not a url"), null);
+  });
+});
+
+describe("sanitizeServerName", () => {
+  it("trims and collapses whitespace", () => {
+    assert.equal(sanitizeServerName("  Acme \n  Engineering\t"), "Acme Engineering");
+  });
+
+  it("strips control, bidi, and zero-width characters", () => {
+    assert.equal(sanitizeServerName("Acme\u0000\u202eevil\u2066"), "Acmeevil");
+    assert.equal(sanitizeServerName("\u200fAc\u200bme\u061c\ufeff"), "Acme");
+  });
+
+  it("never cuts a character in half when capping", () => {
+    const flag = "\u{1F3F3}\u{FE0F}";
+    const name = sanitizeServerName("a".repeat(MAX_SERVER_NAME_LENGTH - 1) + flag + "tail");
+    assert.ok(name.endsWith(flag), JSON.stringify(name));
+  });
+
+  it("caps the length by characters", () => {
+    const name = sanitizeServerName("😀".repeat(MAX_SERVER_NAME_LENGTH + 10));
+    assert.equal(Array.from(name).length, MAX_SERVER_NAME_LENGTH);
+  });
+
+  it("returns null for blanks and non-strings", () => {
+    assert.equal(sanitizeServerName("   "), null);
+    assert.equal(sanitizeServerName("\u202e"), null);
+    assert.equal(sanitizeServerName(42), null);
+    assert.equal(sanitizeServerName(undefined), null);
+  });
+});
```

---

### Incident Patch 10: `106e2260` (2026-10-05)
**Commit Message**: fix(server): propagate intentional runner stops to active subagents (#9025)

* fix(server): propagate intentional runner stops to active subagents

Mark active sessions bound to a host-launched runner before Stop or Archive terminates it. Roll back undelivered stop intent and settle sessions without a live relay when the runner leaves.

Add real Claude and Codex native parent/child E2E journeys covering Stop, Archive, and unexpected runner crashes.

Fixes #9024

Signed-off-by: Corey Zumar <[REDACTED_EMAIL]>

* test: wait for native MCP readiness before teardown regression

Keep scripted dispatch replies on the native MCP tool surface so Codex approval review receives its own model response. Probe tool discovery before dispatch to support the harness versions pinned in CI.

Signed-off-by: Corey Zumar <[REDACTED_EMAIL]>

* fix: scope runner stop intent and bound teardown lookup

Signed-off-by: Corey Zumar <[REDACTED_EMAIL]>

* fix: serialize intentional stops of the same runner

Signed-off-by: Corey Zumar <[REDACTED_EMAIL]>

* Preserve genuine failures and stop intent during teardown

Signed-off-by: Corey Zumar <[REDACTED_EMAIL]>

* Cover partial stop enumeration and concurrent child

**File**: `feature-map/sessions.md` (modified, +14/-0)
```diff
@@ -14,6 +14,8 @@ the header menu), and each place is a separate entry point.
   limited.
 - `archive`: archived sessions leave the main list and appear in the archived
   view, which can be filtered by project and paged.
+- `stop`: Stop session ends a host-launched parent and the sub-agents on its
+  runner without reporting their expected disconnect as a task failure.
 - `unarchive`: offered on archived rows, in bulk selection, and in the header
   menu of an archived session.
 - `delete`: confirmed, then removed from the list and the server.
@@ -69,6 +71,10 @@ and send a follow-up after its parent runner is replaced.
 **Mobile:** the header menu and the sidebar drawer offer the same actions; touch
 devices fold some row controls into the menu.
 
+**Stop session:** open the native parent's sidebar menu and choose Stop session
+while a sub-agent is working. This ends the runner; the current-turn interrupt
+control is a separate action that leaves the session connected.
+
 **Desktop browser:** choose **+ → Browser** in the Workspace panel or press
 ⌘/Ctrl+Alt+B. Agent browser requests and chat links with in-app opening enabled
 create or select a closable Browser soft tab automatically.
@@ -144,6 +150,14 @@ plain `uv run pytest`, which starts a private server for the test.
   `tests/e2e_ui/chat/test_reconnecting_spinner.py::test_reconnecting_state_shows_spinner`
 - **`reconnect`, stopped session (own environment):**
   `tests/e2e_ui/sessions/test_sidebar_stop.py::test_stopped_session_shows_reconnect_affordance`
+- **`stop`, `archive`, active sub-agents (own environment):**
+  `tests/e2e/test_parent_stop_subagents_e2e.py::test_native_parent_teardown_preserves_child_outcome`
+  drives real Claude and Codex parents, native children, a host daemon, and its
+  dedicated runner through the public Stop/Archive APIs. Only model replies are
+  scripted. It waits through the production disconnect grace and includes a
+  real runner crash that must still report a failure. Requires both native
+  CLIs and tmux; Claude's machine-managed credentials require an isolated
+  container for the local model endpoint.
 - **`reconnect`, desktop app (own environment):**
   `tests/e2e_ui/sessions/test_reconnect_local_host_from_app.py::test_desktop_reconnect_performs_local_host_reconnect`,
   `tests/e2e_ui/sessions/test_reconnect_local_host_from_app.py::test_desktop_reconnect_failure_offers_retry`
```

**File**: `omnigent/server/child_session_recovery.py` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ def _restorable(conv: Conversation) -> bool:
         conv.agent_id is not None
         and not conv.archived
         and not is_session_closed(conv.labels, conv.title)
-        and conv.id not in _intentional_stop_sessions
+        and (conv.runner_id is None or _intentional_stop_sessions.get(conv.id) != conv.runner_id)
         and conv.id not in _interrupt_fenced_sessions
     )
 
```

**File**: `omnigent/server/routes/_sessions/common.py` (modified, +22/-1)
```diff
@@ -9,7 +9,9 @@
 
 import asyncio
 import logging
+import math
 import re
+import time
 import weakref
 from dataclasses import dataclass
 from typing import Any
@@ -54,6 +56,7 @@
 from omnigent.spec.types import (
     StateUpdate,
 )
+from omnigent.stores.conversation_store import RUNNER_LIVENESS_TTL_S
 
 # Pinned to the historical module path so log records keep landing on the
 # ``omnigent.server.routes.sessions`` logger after the split into this package.
@@ -633,7 +636,18 @@ class _RunnerStatusProbeBackoff:
 _interrupt_fenced_sessions: WorkspaceScopedSet[str] = WorkspaceScopedSet()
 
 
-_intentional_stop_sessions: WorkspaceScopedSet[str] = WorkspaceScopedSet()
+# Markers belong to one runner and expire after teardown plus disconnect grace.
+# Do not evict live markers under load: each one suppresses an expected drop.
+_intentional_stop_sessions: WorkspaceScopedCache[str, str] = WorkspaceScopedCache(
+    lambda: cachetools.TTLCache(
+        maxsize=math.inf, ttl=2 * RUNNER_LIVENESS_TTL_S, timer=lambda: time.monotonic()
+    )
+)
+
+
+_intentional_runner_stop_locks: WorkspaceScopedCache[str, asyncio.Lock] = WorkspaceScopedCache(
+    weakref.WeakValueDictionary
+)
 
 
 _TERMINAL_RESPONSE_EVENT_TYPES: frozenset[str] = frozenset(
@@ -837,12 +851,18 @@ class _RelayHandle:
         no-replay subscription is registered.
     :param status_snapshot: Saved status read when adopting this binding,
         used only when live status and a fresh row are unavailable.
+    :param intentional_stop_turn_ended: A terminal response arrived while the
+        current stop marker was pending; reset by each Stop request.
+    :param running_event_count: Running notifications observed by this relay,
+        used to preserve intervening activity when a Stop is rejected.
     """
 
     runner_id: str
     task: asyncio.Task[None]
     ready: asyncio.Event
     status_snapshot: _RelayStatusSnapshot | None = None
+    intentional_stop_turn_ended: bool = False
+    running_event_count: int = 0
 
 
 _runner_relay_tasks: WorkspaceScopedCache[str, _RelayHandle] = WorkspaceScopedCache()
@@ -1187,6 +1207,7 @@ def get_server_host_registry() -> HostRegistry | None:
     "_browser_action_registry",
     "_catalog_prefetch_tasks",
     "_deferred_elicitation_clear_tasks",
+    "_intentional_runner_stop_locks",
     "_intentional_stop_sessions",
     "_interrupt_fenced_sessions",
     "_llm_response_denied_turns",
```

**File**: `omnigent/server/routes/_sessions/helpers.py` (modified, +44/-30)
```diff
@@ -6930,13 +6930,22 @@ async def _stop_session_via_runner_impl(
     return True
 
 
+@dataclass
+class _HostRunnerStopAttempt:
+    """Track frame handoff and explicit rejection across caller cancellation."""
+
+    dispatched: bool = False
+    rejected: bool = False
+
+
 async def _stop_session_host_runner(
     session_id: str,
     host_id: str,
     runner_id: str,
     host_registry: Any,
     *,
     expect_already_stopped: bool = False,
+    attempt: _HostRunnerStopAttempt | None = None,
 ) -> bool:
     """
     Terminate the host-launched runner backing a host-spawned session.
@@ -6978,11 +6987,11 @@ async def _stop_session_host_runner(
         instead of warning, for callers that race another reaper for the same
         runner (the relaunch belt: see
         :func:`_spawn_superseded_runner_stop`). Delivery failures still warn.
-    :returns: ``True`` when the stop was delivered and acknowledged (the
-        runner is exiting, so a tunnel drop is expected); ``False`` on any
-        best-effort early-out (no host registry, host offline/replaced,
-        ack timeout, or host-reported failure) where the runner may keep
-        running and no tunnel drop will follow.
+    :param attempt: Optional caller-owned progress record that survives cancellation.
+    :returns: ``True`` after a successful acknowledgement; ``False`` for an
+        unavailable host, rejected send, timeout, or host-reported failure.
+        A dispatched stop can still finish after a timeout or cancellation;
+        ``attempt`` distinguishes that uncertainty from definitive rejection.
     """
     if host_registry is None:
         return False
@@ -7007,33 +7016,38 @@ async def _stop_session_host_runner(
         HostStopRunnerFrame(request_id=request_id, runner_id=runner_id),
     )
     try:
-        host_registry.send_text(conn, stop_frame)
-    except ConnectionError:
-        conn.pending_stops.pop(request_id, None)
-        _logger.warning(
-            "Cannot stop runner %s for session %s: host %s connection was replaced",
-            runner_id,
-            session_id,
-            host_id,
-            extra={"session_id": session_id},
-        )
-        return False
-    try:
-        result = await asyncio.wait_for(
-            future,
-            timeout=_STOP_RUNNER_RESULT_TIMEOUT_S,
-        )
-    except asyncio.TimeoutError:
+        try:
+            host_registry.send_text(conn, stop_frame)
+        except ConnectionError:
+            _logger.warning(
+                "Cannot stop runner %s for session %s: host %s connection was replaced",
+                runner_id,
+                session_id,
+                host_id,
+                extra={"session_id": session_id},
+            )
+            return False
+        if attempt is not None:
+            attempt.dispatched = True
+        try:
+            result = await asyncio.wait_for(
+                future,
+                timeout=_STOP_RUNNER_RESULT_TIMEOUT_S,
+            )
+        except asyncio.TimeoutError:
+            _logger.warning(
+                "Host %s did not acknowledge stop of runner %s for session %s",
+                host_id,
+                runner_id,
+                session_id,
+                extra={"session_id": session_id},
+            )
+            return False
+    finally:
         conn.pending_stops.pop(request_id, None)
-        _logger.warning(
-            "Host %s did not acknowledge stop of runner %s for session %s",
-            host_id,
-            runner_id,
-            session_id,
-            extra={"session_id": session_id},
-        )
-        return False
     if result.get("status") == "failed":
+        if attempt is not None:
+            attempt.rejected = True
         # An unknown runner means someone already reaped it. Expected for the
         # relaunch belt, which the host's own supersession normally beats, so
         # a warning there would report a successful reap as a failure.
```

**File**: `omnigent/server/routes/_sessions/orchestration.py` (modified, +251/-70)
```diff
@@ -187,6 +187,7 @@
     _TERMINAL_RESPONSE_EVENT_TYPES,
     _TURN_ACTOR_LABEL,
     _deferred_elicitation_clear_tasks,
+    _intentional_runner_stop_locks,
     _intentional_stop_sessions,
     _interrupt_fenced_sessions,
     _llm_response_denied_turns,
@@ -257,6 +258,7 @@
     _forward_session_change_to_runner,
     _get_runner_client,
     _handle_advise_models_mcp,
+    _HostRunnerStopAttempt,
     _invalidate_runner_backed_snapshot_state,
     _is_codex_native_subagent,
     _is_kiro_native_session,
@@ -739,6 +741,96 @@ async def _stop(target_id: str) -> None:
 # failure, not a sustained outage.
 _ARCHIVE_STOP_LOOKUP_ATTEMPTS = 3
 _ARCHIVE_STOP_LOOKUP_RETRY_S = 0.2
+_RUNNER_STOP_STATUS_BATCH_SIZE = 200
+
+
+async def _stop_host_runner_intentionally(
+    session_id: str,
+    host_id: str,
+    runner_id: str,
+    host_registry: Any,
+    conversation_store: ConversationStore,
+) -> bool:
+    """Carry stop intent to the active sessions sharing the terminated runner.
+
+    Relays consume their own markers; the disconnect sweep settles sessions
+    without a relay. Definitive rejection removes newly added markers, while
+    an unacknowledged dispatch retains intent through timeout or cancellation.
+    """
+    from omnigent.server.routes import sessions as _facade
+
+    # An unsuccessful concurrent stop must not roll back a delivered stop's intent.
+    lock = _intentional_runner_stop_locks.setdefault(runner_id, asyncio.Lock())
+    async with lock:
+        statuses: dict[str, str | None] = {}
+        after: str | None = None
+        try:
+            while True:
+                batch = await asyncio.to_thread(
+                    conversation_store.list_runner_session_statuses,
+                    runner_id,
+                    after=after,
+                    limit=_RUNNER_STOP_STATUS_BATCH_SIZE,
+                )
+                statuses.update(batch)
+                if len(batch) < _RUNNER_STOP_STATUS_BATCH_SIZE:
+                    break
+                after = batch[-1][0]
+        except Exception:  # noqa: BLE001
+            # Keep Stop available during a store outage; only known sessions can
+            # inherit intent, so unseen cold sessions keep normal disconnect handling.
+            _logger.warning(
+                "Cannot load all sessions for intentionally stopped runner %s; "
+                "using partial results and live relays",
+                runner_id,
+                exc_info=True,
+                extra={"session_id": session_id},
+            )
+        for related_id, handle in _runner_relay_tasks.items():
+            if handle.runner_id == runner_id and not handle.task.done():
+                statuses.setdefault(related_id, None)
+        statuses.setdefault(session_id, None)
+        marked: set[str] = set()
+        completed_stop_relays: dict[str, tuple[_RelayHandle, int]] = {}
+        for related_id, persisted_status in statuses.items():
+            handle = _runner_relay_tasks.get(related_id)
+            if handle is not None and handle.runner_id != runner_id:
+                continue
+            live_status = _session_status_cache.get(related_id, persisted_status)
+            # Completed work and earlier task failures keep their existing outcome.
+            if related_id != session_id and live_status not in (*_MID_TURN_STATUSES, None):
+                continue
+            if _intentional_stop_sessions.get(related_id) != runner_id:
+                marked.add(related_id)
+            # Each Stop needs a fresh disconnect window, including repeated requests.
+            _intentional_stop_sessions[related_id] = runner_id
+            if handle is not None:
+                if handle.intentional_stop_turn_ended:
+                    completed_stop_relays[related_id] = (handle, handle.running_event_count)
+                handle.intentional_stop_turn_ended = False
+
+        acknowledged = False
+        attempt = _HostRunnerStopAttempt()
+        try:
+            acknowledged = await _facade._stop_session_host_runner(
+                session_id, host_id, runner_id, host_registry, attempt=attempt
+            )
+        finally:
+            if not acknowledged and (not attempt.dispatched or attempt.rejected):
+                for related_id in marked:
+                    if _intentional_stop_sessions.get(related_id) == runner_id:
+                        _intentional_stop_sessions.pop(related_id, None)
+                # Rejection must not revive stale intent from an earlier completed turn.
+                for related_id, (handle, running_event_count) in completed_stop_relays.items():
+                    if (
+                        _intentional_stop_sessions.get(related_id) == runner_id
+                        and _runner_relay_tasks.get(related_id) is handle
+                    ):
+                        if handle.running_event_count == running_event_count:
+                            handle.intentional_stop_turn_ended = 
```

**File**: `omnigent/server/routes/sessions/__init__.py` (modified, +1/-0)
```diff
@@ -604,6 +604,7 @@
     RUNNER_DISCONNECT_GRACE_S as RUNNER_DISCONNECT_GRACE_S,
     _accumulate_session_usage as _accumulate_session_usage,
     _best_effort_stop as _best_effort_stop,
+    _stop_host_runner_intentionally as _stop_host_runner_intentionally,
     _context_labels_from_turn_usage as _context_labels_from_turn_usage,
     _bind_and_launch_managed_runner as _bind_and_launch_managed_runner,
     _build_native_terminal_message_event as _build_native_terminal_message_event,
```

**File**: `omnigent/server/routes/sessions/routes_events.py` (modified, +4/-17)
```diff
@@ -208,7 +208,6 @@
     _response_agent_name_from_store,
     _session_status_from_cache,
     _signal_harness_elicitation_resolved_by_id,
-    _stop_session_host_runner,
     _stop_session_via_runner,
     _stream_live_events,
     _wait_for_runner_client,
@@ -241,6 +240,7 @@
     _persist_native_terminal_failure,
     _resolve_elicitation,
     _runner_live_on_another_replica_from_conversations,
+    _stop_host_runner_intentionally,
     _wait_for_host_bound_runner_client,
     _wait_for_host_reconnect,
     ensure_runner_connected,
@@ -1440,26 +1440,13 @@ async def _wake_bound_runner_for_control(
             # only ever stop the runner bound to this session.
             stop_conv = await asyncio.to_thread(conversation_store.get_conversation, session_id)
             if stop_conv is not None and stop_conv.host_id and stop_conv.runner_id:
-                # Mark the tunnel drop as intentional BEFORE tearing it down so
-                # the relay's disconnect handler renders a quiet stopped state
-                # rather than "Error · runner_disconnected". Only host-spawned
-                # sessions drop the tunnel on Stop; other harnesses leave the
-                # runner connected, so there is nothing to suppress for them.
-                _intentional_stop_sessions.add(session_id)
-                teardown_delivered = await _stop_session_host_runner(
+                await _stop_host_runner_intentionally(
                     session_id,
                     stop_conv.host_id,
                     stop_conv.runner_id,
                     getattr(request.app.state, "host_registry", None),
+                    conversation_store,
                 )
-                if not teardown_delivered:
-                    # Best-effort stop did not land (host offline / timeout /
-                    # failure): no tunnel drop will follow, so the relay won't
-                    # reach the disconnect handler that consumes the marker.
-                    # Discard it now so it can't outlive this turn on the
-                    # reused per-session relay task and later swallow a genuine
-                    # runner_disconnected as a quiet idle.
-                    _intentional_stop_sessions.discard(session_id)
             if not stop_delivered:
                 # False-success backstop. The stop reached NO live runner
                 # (``_stop_session_via_runner`` returned False, so there was
@@ -3088,7 +3075,7 @@ async def delete_session(
             for blob_key in orphaned_blob_keys:
                 await asyncio.to_thread(artifact_store.delete, blob_key)
         _interrupt_fenced_sessions.discard(session_id)
-        _intentional_stop_sessions.discard(session_id)
+        _intentional_stop_sessions.pop(session_id, None)
         deleted = await conversation_store.delete_conversation(session_id)
         if not deleted:
             raise _session_not_found()
```

**File**: `omnigent/server/session_live_state.py` (modified, +7/-6)
```diff
@@ -40,8 +40,8 @@
 import contextvars
 import logging
 import time
-from concurrent.futures import ThreadPoolExecutor
-from typing import TYPE_CHECKING
+from concurrent.futures import Future, ThreadPoolExecutor
+from typing import TYPE_CHECKING, Any
 
 from omnigent.db.enum_codecs import SESSION_LIVE_STATUS
 from omnigent.db.workspace_cache import WorkspaceScopedCache
@@ -110,7 +110,7 @@ def conversation_store() -> ConversationStore | None:
     return _store
 
 
-def submit(description: str, fn, *args, on_failure=None) -> None:  # type: ignore[no-untyped-def]
+def submit(description: str, fn, *args, on_failure=None) -> Future[Any]:  # type: ignore[no-untyped-def]
     """
     Run one store-backed task on the ordered background worker.
 
@@ -131,22 +131,23 @@ def submit(description: str, fn, *args, on_failure=None) -> None:  # type: ignor
         thread) when the write raises. Used to evict a dedupe entry so a
         dropped write's value can be re-attempted by the next identical
         publish instead of being swallowed.
+    :returns: Future containing the result, or ``None`` after a logged write failure.
     """
     global _executor
     if _executor is None:
         _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="session-live-state")
 
     ctx = contextvars.copy_context()
 
-    def _run() -> None:
+    def _run() -> Any:
         try:
-            fn(*args)
+            return fn(*args)
         except Exception:  # noqa: BLE001 — best-effort display state
             _logger.warning("session live-state write failed (%s)", description, exc_info=True)
             if on_failure is not None:
                 on_failure()
 
-    _executor.submit(ctx.run, _run)
+    return _executor.submit(ctx.run, _run)
 
 
 def persist_live_status(session_id: str, status: str) -> None:
```

---

### Incident Patch 11: `9feec492` (2026-10-05)
**Commit Message**: feat(server): add a native loopback OIDC sign-in and advertise auth mode in the manifest (#8894)

## Related issue

Part of #4649. This server half lets the desktop sign in through the system browser; the desktop PR later in this stack closes the issue.

## Summary

ELI5: a native app can now ask the server "sign me in through the user's real browser and hand the result back to me on this machine", and can learn up front whether a server signs in with OIDC.

- **Why:** the desktop renders OIDC identity-provider pages inside its own window, which breaks Google sign-in (embedded user agents are rejected) and passkeys (Electron has no WebAuthn UI). The CLI's ticket flow could move sign-in to the browser, but anyone holding a ticket ID can collect the session. An attacker can create a ticket and send someone the login link.
- **Loopback sign-in (RFC 8252 + PKCE):** `GET /auth/login` accepts `native_redirect_uri` (only `http://127.0.0.1:<port>` or `http://[::1]:<port>`), `native_state` and an S256 `code_challenge`, and keeps them in the existing signed state cookie. After the usual checks, `/auth/callback` redirects the browser to that loopback address with a one-time code that expires 

**File**: `omnigent/server/app.py` (modified, +20/-7)
```diff
@@ -76,7 +76,7 @@
 from omnigent.runtime.agent_cache import AgentCache
 from omnigent.runtime.harnesses.process_manager import HarnessProcessManager
 from omnigent.server import managed_host_keepalive, session_live_state, shutdown_state
-from omnigent.server.auth import AuthProvider, SharingMode
+from omnigent.server.auth import AuthProvider, SharingMode, auth_mode
 from omnigent.server.background_session_titles import (
     BackgroundSessionTitleCoordinator,
     RunnerBackgroundTitleGenerator,
@@ -2783,6 +2783,14 @@ async def well_known_manifest() -> dict[str, object]:
            version number: ``server_picker`` is ``"sidebar"`` on builds that
            dock the picker at the sidebar's bottom (it was ``"titlebar"``,
            centered in the macOS title-bar strip, before this).
+        5. ``auth`` tells a native client how this server signs users in,
+           before it loads anything. ``mode`` is ``"oidc"``, ``"accounts"``,
+           ``"header"``, ``"custom"`` (an embedding app's own provider), or
+           ``"none"``. ``"oidc"`` also promises the native loopback sign-in
+           (``/auth/login`` native parameters + ``POST /auth/native-token``).
+           ``session_cookie`` names the session cookie for ``oidc`` and
+           ``accounts`` and is ``null`` otherwise. A missing ``auth`` (older
+           servers) means "sign in as before".
 
         Unknown fields MUST be ignored, and a missing manifest (404 — every
         server older than this route) MUST be treated as the pre-manifest
@@ -2793,8 +2801,10 @@ async def well_known_manifest() -> dict[str, object]:
         Authentication: intentionally UNAUTHED, like ``/v1/info``. A client
         must be able to read this before it holds a session cookie — the whole
         point is to consult it before loading the app. It exposes only the
-        version already public via ``/api/version`` plus coarse UI-shape
-        strings, so there is nothing here to leak.
+        version already public via ``/api/version``, coarse UI-shape
+        strings, and the sign-in mode and cookie name any visitor already
+        learns from ``/v1/info`` and the login redirect, so there is
+        nothing here to leak.
 
         Served under ``/.well-known/`` (RFC 8615) so it sits at a fixed,
         guessable path that never collides with an SPA client route.
@@ -2809,6 +2819,10 @@ async def well_known_manifest() -> dict[str, object]:
             # key existing and exercise the "no floor" path from day one.
             "min_desktop_version": None,
             "ui": {"server_picker": "sidebar"},
+            "auth": {
+                "mode": auth_mode(auth_provider),
+                "session_cookie": getattr(auth_provider, "session_cookie_name", None),
+            },
         }
 
     @app.get("/v1/info", response_model=ServerInfoResponse)
@@ -2837,11 +2851,10 @@ async def info() -> ServerInfoResponse:
         sandbox option with, and the installed
         ``server_version`` (already public via ``/api/version``).
         """
-        from omnigent.server.auth import UnifiedAuthProvider, local_single_user_enabled
+        from omnigent.server.auth import local_single_user_enabled
 
-        accounts_enabled = (
-            isinstance(auth_provider, UnifiedAuthProvider) and auth_provider._source == "accounts"
-        )
+        # Same helper as the manifest's auth.mode, so the two never disagree.
+        accounts_enabled = auth_mode(auth_provider) == "accounts"
         login_url = getattr(auth_provider, "login_url", None)
         # single_user marks the explicit single-user local runtime
         # (OMNIGENT_LOCAL_SINGLE_USER=1, set by the managed local spawn paths).
```

**File**: `omnigent/server/auth.py` (modified, +32/-0)
```diff
@@ -547,6 +547,19 @@ def login_url(self) -> str | None:
             return "/login"
         return None
 
+    @property
+    def session_cookie_name(self) -> str | None:
+        """The session cookie this server sets, or ``None`` without one.
+
+        ``__Host-ap_session`` on HTTPS and ``ap_session`` on plain HTTP,
+        for the ``oidc`` and ``accounts`` sources; header mode has none.
+        """
+        if self._source == "oidc" and self._oidc_config is not None:
+            return self._oidc_config.session_cookie_name
+        if self._source == "accounts" and self._accounts_config is not None:
+            return self._accounts_config.session_cookie_name
+        return None
+
     def get_user_id(self, request: HTTPConnection) -> str | None:
         """Extract user identity from the active source.
 
@@ -759,6 +772,25 @@ def _check_header(self, request: HTTPConnection) -> str | None:
         return None
 
 
+def auth_mode(provider: AuthProvider | None) -> str:
+    """Name the sign-in mode a client should expect from an app's provider.
+
+    :param provider: The app's auth provider, or ``None`` when auth is off.
+    :returns: ``"oidc"``, ``"accounts"``, or ``"header"`` for the built-in
+        sources, ``"custom"`` for an embedding application's own provider,
+        and ``"none"`` when there is no provider.
+    """
+    if provider is None:
+        return "none"
+    if isinstance(provider, UnifiedAuthProvider) and provider._source in (
+        "oidc",
+        "accounts",
+        "header",
+    ):
+        return provider._source
+    return "custom"
+
+
 class AccountAuthorityMiddleware:
     """Select account checks from the app's provider for every ASGI scope.
 
```

**File**: `omnigent/server/routes/auth.py` (modified, +285/-36)
```diff
@@ -1,9 +1,18 @@
-"""OIDC authentication routes: login, callback, logout, CLI login.
+"""OIDC authentication routes: login, callback, logout, CLI and native login.
 
 Provides ``/auth/login``, ``/auth/callback``, ``/auth/logout``,
-``/auth/cli-login``, and ``/auth/cli-poll`` endpoints that implement
-the full OIDC authorization code flow with PKCE. The ``cli-login``
-/ ``cli-poll`` pair supports the ``omnigent login`` CLI command.
+``/auth/cli-login``, ``/auth/cli-poll``, and ``/auth/native-token``
+endpoints that implement the full OIDC authorization code flow with
+PKCE. The ``cli-login`` / ``cli-poll`` pair supports the ``omnigent
+login`` CLI command.
+
+Native apps (the desktop shell) sign in through the system browser with
+an RFC 8252 loopback redirect: ``/auth/login`` accepts a loopback
+``native_redirect_uri`` plus a PKCE ``code_challenge``, the callback
+redirects the browser to that loopback with a one-time code, and the
+app exchanges the code and its verifier at ``/auth/native-token``. The
+code only reaches the machine whose browser signed in, and is useless
+without the verifier held by the app that started the flow.
 
 See ``designs/OIDC_AUTH.md`` for the complete design.
 
@@ -12,17 +21,20 @@
 
 from __future__ import annotations
 
+import hmac
 import logging
+import re
 import secrets
 import time
+from collections.abc import Mapping
 from dataclasses import dataclass, field
 from typing import TYPE_CHECKING, cast
 from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
 
 import httpx
 import jwt
 from fastapi import APIRouter, Query, Request
-from starlette.responses import RedirectResponse, Response
+from starlette.responses import JSONResponse, RedirectResponse, Response
 
 from omnigent.server.accounts_store import SqlAlchemyAccountStore
 from omnigent.server.admin_list import AdminList, promote_if_listed
@@ -38,6 +50,7 @@
     mint_session_cookie,
 )
 from omnigent.server.oidc_access import OidcAdmissionPolicy, resolve_allowed_domains_path
+from omnigent.server.routes._oauth import NO_STORE_HEADERS, oauth_error
 from omnigent.server.routes.device_auth import issue_login_grant
 from omnigent.stores.permission_store import PermissionStore
 
@@ -48,6 +61,18 @@
 _AUTH_STATE_COOKIE_PLAIN = "ap_auth_state"
 _AUTH_STATE_TTL_SECONDS = 300  # 5 minutes
 _CLI_TICKET_TTL_SECONDS = 300  # 5 minutes
+# A native sign-in code is exchanged by the app right after the browser
+# hands it over, so it only needs to outlive one loopback round trip.
+_NATIVE_CODE_TTL_SECONDS = 60
+# RFC 8252 §7.3 loopback literals. ``localhost`` is excluded (§8.3): its
+# resolution can be redirected away from this machine.
+_NATIVE_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1"})
+_NATIVE_PARAMS = ("native_redirect_uri", "native_state", "code_challenge", "code_challenge_method")
+# RFC 7636: an S256 challenge is a 43-char base64url SHA-256 digest, and a
+# verifier is 43-128 unreserved characters.
+_S256_CHALLENGE_RE = re.compile(r"[A-Za-z0-9_-]{43}")
+_CODE_VERIFIER_RE = re.compile(r"[A-Za-z0-9._~-]{43,128}")
+_NATIVE_STATE_RE = re.compile(r"[A-Za-z0-9._~-]{1,256}")
 # How long an OIDC invite URL stays redeemable. Matches the accounts
 # provider's default invite window (72h) — long enough to share
 # out-of-band, short enough to bound exposure of an unused link.
@@ -81,6 +106,27 @@ class _CliTicket:
     refresh_token: str | None = None
 
 
+@dataclass
+class _NativeCode:
+    """A one-time code issued to a native app's loopback redirect.
+
+    Created by ``/auth/callback`` for a native sign-in and consumed by
+    ``POST /auth/native-token``.
+
+    :param user_id: The authenticated user's email.
+    :param code_challenge: The PKCE S256 challenge the app sent to
+        ``/auth/login``; the exchange must present its verifier.
+    :param redirect_uri: The loopback URI the code was delivered to; the
+        exchange must name the same URI.
+    :param created_at: Unix timestamp when the code was issued.
+    """
+
+    user_id: str
+    code_challenge: str
+    redirect_uri: str
+    created_at: float = field(default_factory=time.time)
+
+
 def create_auth_router(
     auth_provider: UnifiedAuthProvider,
     permission_store: PermissionStore | None,
@@ -115,7 +161,8 @@ def create_auth_router(
         ``omnigent login``. ``None`` keeps the legacy
         session-JWT-only response.
     :returns: A FastAPI router with ``/login``, ``/callback``,
-        ``/logout`` (and ``/invite`` when invites are enabled).
+        ``/logout``, ``/cli-login``, ``/cli-poll``, ``/native-token``,
+        ``/users`` (and ``/invite`` when invites are enabled).
     """
     router = APIRouter()
     config = auth_provider._oidc_config
@@ -148,6 +195,27 @@ def create_auth_router(
     # In-memory store for CLI login tickets. Tickets are short-lived
     # (5 min) and single-use. Keyed by ticket ID.
     _cli_tickets: dict[str, _CliTicket] = {}
+    # One-time codes for native (loopback) sign-ins. Single-use, 60 s.
+    _
```

**File**: `openapi.json` (modified, +1/-1)
```diff
@@ -9381,7 +9381,7 @@
   "paths": {
     "/.well-known/omnigent.json": {
       "get": {
-        "description": "Version manifest for NON-BROWSER clients \u2014 chiefly the desktop shell.\n\nThe desktop shell ships and updates on its own cadence, so any\ninstalled build can meet any server version. The shell is the side\nthat must adapt (the user may not update it for months), and to adapt\nit first has to know what it is talking to. This endpoint is that\nanswer, fetched BEFORE the SPA loads \u2014 unlike `/v1/info`, which the\nSPA reads after boot and which is therefore useless to the shell when\ndeciding how to open a window in the first place.\n\nContract, in the order a client should apply it:\n\n1. `manifest_version` (int) versions this ENVELOPE. Clients gate on\n   `>=`, never `==`, so a newer server keeps working with an older\n   shell. See `WELL_KNOWN_MANIFEST_VERSION` for when it bumps \u2014\n   adding a field never does.\n2. `server_version` (str) is the installed omnigent package version,\n   the same value as `/api/version` and `/v1/info.server_version`.\n   Informational: for display and bug reports, NOT for gating. Gate on\n   the fields below, which state capability directly rather than making\n   every client hardcode \"which release added X\".\n3. `min_desktop_version` (str | null) is the oldest desktop build this\n   server still supports. Null means no floor \u2014 the overwhelmingly\n   common case, and what every shipped shell must treat as \"fine\".\n   A server sets it only to signal a genuinely breaking change.\n4. Everything else is additive detail an older client may ignore\n   wholesale. `ui` describes where server-driven chrome lives, so a\n   shell can place its own window furniture without guessing from the\n   version number: `server_picker` is `\"sidebar\"` on builds that\n   dock the picker at the sidebar's bottom (it was `\"titlebar\"`,\n   centered in the macOS title-bar strip, before this).\n\nUnknown fields MUST be ignored, and a missing manifest (404 \u2014 every\nserver older than this route) MUST be treated as the pre-manifest\nbaseline, not an error: the shell falls back to its current behavior.\nThat is what makes an old shell + new server and a new shell + old\nserver both work.\n\nAuthentication: intentionally UNAUTHED, like `/v1/info`. A client\nmust be able to read this before it holds a session cookie \u2014 the whole\npoint is to consult it before loading the app. It exposes only the\nversion already public via `/api/version` plus coarse UI-shape\nstrings, so there is nothing here to leak.\n\nServed under `/.well-known/` (RFC 8615) so it sits at a fixed,\nguessable path that never collides with an SPA client route.\n\n**Returns:** The manifest described above.",
+        "description": "Version manifest for NON-BROWSER clients \u2014 chiefly the desktop shell.\n\nThe desktop shell ships and updates on its own cadence, so any\ninstalled build can meet any server version. The shell is the side\nthat must adapt (the user may not update it for months), and to adapt\nit first has to know what it is talking to. This endpoint is that\nanswer, fetched BEFORE the SPA loads \u2014 unlike `/v1/info`, which the\nSPA reads after boot and which is therefore useless to the shell when\ndeciding how to open a window in the first place.\n\nContract, in the order a client should apply it:\n\n1. `manifest_version` (int) versions this ENVELOPE. Clients gate on\n   `>=`, never `==`, so a newer server keeps working with an older\n   shell. See `WELL_KNOWN_MANIFEST_VERSION` for when it bumps \u2014\n   adding a field never does.\n2. `server_version` (str) is the installed omnigent package version,\n   the same value as `/api/version` and `/v1/info.server_version`.\n   Informational: for display and bug reports, NOT for gating. Gate on\n   the fields below, which state capability directly rather than making\n   every client hardcode \"which release added X\".\n3. `min_desktop_version` (str | null) is the oldest desktop build this\n   server still supports. Null means no floor \u2014 the overwhelmingly\n   common case, and what every shipped shell must treat as \"fine\".\n   A server sets it only to signal a genuinely breaking change.\n4. Everything else is additive detail an older client may ignore\n   wholesale. `ui` describes where server-driven chrome lives, so a\n   shell can place its own window furniture without guessing from the\n   version number: `server_picker` is `\"sidebar\"` on builds that\n   dock the picker at the sidebar's bottom (it was `\"titlebar\"`,\n   centered in the macOS title-bar strip, before this).\n5. `auth` tells a native client how this server signs users in,\n   before it loads anything. `mode` is `\"oidc\"`, `\"accounts\"`,\n   `\"header\"`, `\"custom\"` (an embedding app's own provider), or\n   `\"none\"`. `\"oidc\"` also promises the native loopback sign-in\n   (`/auth/login` native parameters + `POST /auth/native-token`).\n   `session_cookie` nam
```

**File**: `tests/server/integration/test_oidc_native_login.py` (added, +373/-0)
```diff
@@ -0,0 +1,373 @@
+"""Integration tests for the native (RFC 8252 loopback) OIDC sign-in.
+
+Drives the real ``/auth/login`` → ``/auth/callback`` → ``/auth/native-token``
+routes on a FastAPI app with OIDC auth enabled. Only the external IdP
+(token and email endpoints) is mocked.
+"""
+
+from __future__ import annotations
+
+import tempfile
+from pathlib import Path
+from unittest.mock import AsyncMock, MagicMock, patch
+from urllib.parse import parse_qs, urlencode, urlparse
+
+import httpx
+import jwt
+import pytest
+
+from omnigent.server.admin_list import AdminList
+from omnigent.server.auth import UnifiedAuthProvider
+from omnigent.server.oidc import OIDCConfig, derive_code_challenge
+from omnigent.server.routes import auth as auth_routes
+from omnigent.server.routes.auth import create_auth_router
+
+pytestmark = pytest.mark.asyncio
+
+_TEST_SECRET = b"n" * 32
+_REDIRECT = "http://127.0.0.1:53682/callback"
+_VERIFIER = "v" * 64
+_NATIVE_STATE = "desktop-state-123"
+
+
+def _config(allowed_domains: frozenset[str] | None = None) -> OIDCConfig:
+    """Build a GitHub-flavoured OIDC config whose IdP calls are mocked."""
+    return OIDCConfig(
+        issuer="https://github.com",
+        client_id="test-client-id",
+        client_secret="test-client-secret",
+        redirect_uri="http://localhost:8000/auth/callback",
+        cookie_secret=_TEST_SECRET,
+        scopes="read:user user:email",
+        session_ttl_hours=8,
+        logout_redirect_uri=None,
+        allowed_domains=allowed_domains,
+        provider_type="github",
+        authorization_endpoint="https://github.com/login/oauth/authorize",
+        token_endpoint="https://github.com/login/oauth/access_token",
+        jwks_uri=None,
+        userinfo_endpoint="https://api.github.com/user",
+        allow_invites=False,
+    )
+
+
+def _transport(
+    *,
+    allowed_domains: frozenset[str] | None = None,
+    device_grant_store: object | None = None,
+) -> httpx.ASGITransport:
+    """Mount only the OIDC auth router on a bare FastAPI app."""
+    from fastapi import FastAPI
+
+    config = _config(allowed_domains)
+    router = create_auth_router(
+        auth_provider=UnifiedAuthProvider(source="oidc", oidc_config=config),
+        permission_store=None,
+        # A fresh directory, so no admin list on the host can leak in.
+        admin_list=AdminList(Path(tempfile.mkdtemp()) / "no-admins.txt"),
+        device_grant_store=device_grant_store,  # type: ignore[arg-type]
+    )
+    app = FastAPI()
+    app.include_router(router, prefix="/auth")
+    return httpx.ASGITransport(app=app)
+
+
+def _idp_client(token_status: int = 200, email: str = "alice@example.com") -> AsyncMock:
+    """Mock ``httpx.AsyncClient`` for GitHub's token and email endpoints."""
+    token_resp = MagicMock(status_code=token_status, text="{}")
+    token_resp.json.return_value = {"access_token": "gho_test", "token_type": "bearer"}
+    emails_resp = MagicMock(status_code=200)
+    emails_resp.json.return_value = [{"email": email, "primary": True, "verified": True}]
+    client = AsyncMock()
+    client.post = AsyncMock(return_value=token_resp)
+    client.get = AsyncMock(return_value=emails_resp)
+    cm = AsyncMock()
+    cm.__aenter__ = AsyncMock(return_value=client)
+    cm.__aexit__ = AsyncMock(return_value=False)
+    return cm
+
+
+def _native_params(**overrides: str) -> dict[str, str]:
+    params = {
+        "native_redirect_uri": _REDIRECT,
+        "native_state": _NATIVE_STATE,
+        "code_challenge": derive_code_challenge(_VERIFIER),
+        "code_challenge_method": "S256",
+    }
+    params.update(overrides)
+    return params
+
+
+async def _start(client: httpx.AsyncClient) -> tuple[str, str]:
+    """Begin a native sign-in; return the IdP ``state`` and the state cookie."""
+    resp = await client.get("/auth/login", params=_native_params())
+    assert resp.status_code == 302
+    idp_state = parse_qs(urlparse(resp.headers["location"]).query)["state"][0]
+    return idp_state, resp.cookies["ap_auth_state"]
+
+
+async def _callback(
+    client: httpx.AsyncClient,
+    idp_state: str,
+    state_cookie: str,
+    idp: AsyncMock | None = None,
+    params: dict[str, str] | None = None,
+) -> httpx.Response:
+    client.cookies.clear()
+    client.cookies.set("ap_auth_state", state_cookie)
+    with patch("omnigent.server.routes.auth.httpx.AsyncClient", return_value=idp or _idp_client()):
+        return await client.get(
+            "/auth/callback",
+            params=params if params is not None else {"code": "idp-code", "state": idp_state},
+        )
+
+
+def _loopback_query(resp: httpx.Response) -> dict[str, str]:
+    """Assert ``resp`` redirects to the loopback and return its query."""
+    assert resp.status_code == 302
+    location = urlparse(resp.headers["location"])
+    assert f"{location.scheme}://{location.netloc}{location.path}" == _REDIRECT
+    return {k: v[0] for k, v in parse_qs(location.query).items()}
+
+
+async def _e
```

**File**: `tests/server/integration/test_well_known_auth.py` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+"""The manifest's ``auth`` block on a real OIDC ``create_app``.
+
+``auth.mode == "oidc"`` promises the native loopback sign-in, so the
+desktop can rely on ``POST /auth/native-token`` existing without a probe.
+"""
+
+from __future__ import annotations
+
+from pathlib import Path
+
+import httpx
+import pytest
+
+from omnigent.runtime.agent_cache import AgentCache
+from omnigent.server.app import create_app
+from omnigent.server.auth import UnifiedAuthProvider
+from omnigent.server.oidc import OIDCConfig
+from omnigent.stores.agent_store.sqlalchemy_store import SqlAlchemyAgentStore
+from omnigent.stores.artifact_store.local import LocalArtifactStore
+from omnigent.stores.conversation_store.sqlalchemy_store import SqlAlchemyConversationStore
+from omnigent.stores.file_store.sqlalchemy_store import SqlAlchemyFileStore
+from omnigent.stores.permission_store.sqlalchemy_store import SqlAlchemyPermissionStore
+
+pytestmark = pytest.mark.asyncio
+
+
+def _oidc_config(redirect_uri: str) -> OIDCConfig:
+    return OIDCConfig(
+        issuer="https://github.com",
+        client_id="cid",
+        client_secret="secret",
+        redirect_uri=redirect_uri,
+        cookie_secret=bytes.fromhex("bb" * 32),
+        scopes="read:user user:email",
+        session_ttl_hours=8,
+        logout_redirect_uri=None,
+        allowed_domains=None,
+        provider_type="github",
+        authorization_endpoint="https://github.com/login/oauth/authorize",
+        token_endpoint="https://github.com/login/oauth/access_token",
+        jwks_uri=None,
+        userinfo_endpoint="https://api.github.com/user",
+        allow_invites=False,
+    )
+
+
+@pytest.mark.parametrize(
+    ("redirect_uri", "cookie"),
+    [
+        ("https://omni.example/auth/callback", "__Host-ap_session"),
+        ("http://localhost:8000/auth/callback", "ap_session"),
+    ],
+)
+async def test_oidc_manifest_names_mode_and_cookie(
+    runtime_init: None, db_uri: str, tmp_path: Path, redirect_uri: str, cookie: str
+) -> None:
+    artifact_store = LocalArtifactStore(str(tmp_path / "artifacts"))
+    app = create_app(
+        agent_store=SqlAlchemyAgentStore(db_uri),
+        file_store=SqlAlchemyFileStore(db_uri),
+        conversation_store=SqlAlchemyConversationStore(db_uri),
+        artifact_store=artifact_store,
+        agent_cache=AgentCache(artifact_store=artifact_store, cache_dir=tmp_path / "cache"),
+        permission_store=SqlAlchemyPermissionStore(db_uri),
+        auth_provider=UnifiedAuthProvider(source="oidc", oidc_config=_oidc_config(redirect_uri)),
+    )
+    transport = httpx.ASGITransport(app=app)
+    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
+        manifest = await client.get("/.well-known/omnigent.json", headers={"Cookie": ""})
+        exchange = await client.post("/auth/native-token", data={})
+
+    assert manifest.status_code == 200
+    assert manifest.json()["auth"] == {"mode": "oidc", "session_cookie": cookie}
+    # The promised endpoint is mounted (a bad request, not a 404).
+    assert exchange.status_code == 400
+    assert exchange.json() == {"error": "invalid_request"}
```

**File**: `tests/server/test_app.py` (modified, +2/-0)
```diff
@@ -103,6 +103,8 @@ async def test_well_known_manifest_shape(client: httpx.AsyncClient) -> None:
     # Tells the shell where server-driven chrome lives, so it need not infer
     # placement from the version number.
     assert body["ui"]["server_picker"] == "sidebar"
+    # This fixture runs without an auth provider, so there is nothing to sign in to.
+    assert body["auth"] == {"mode": "none", "session_cookie": None}
 
 
 @pytest.mark.asyncio
```

**File**: `tests/server/test_auth_mode.py` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+"""Tests for :func:`omnigent.server.auth.auth_mode` and the session cookie name.
+
+Both feed the ``auth`` block of ``/.well-known/omnigent.json``, which native
+clients read before loading anything to decide how to sign in.
+"""
+
+from __future__ import annotations
+
+from starlette.requests import HTTPConnection
+
+from omnigent.server.accounts_config import AccountsConfig
+from omnigent.server.auth import AuthProvider, UnifiedAuthProvider, auth_mode
+from omnigent.server.oidc import OIDCConfig
+
+
+def _oidc_config(redirect_uri: str) -> OIDCConfig:
+    return OIDCConfig(
+        issuer="https://github.com",
+        client_id="cid",
+        client_secret="secret",
+        redirect_uri=redirect_uri,
+        cookie_secret=b"s" * 32,
+        scopes="read:user user:email",
+        session_ttl_hours=8,
+        logout_redirect_uri=None,
+        allowed_domains=None,
+        provider_type="github",
+        authorization_endpoint="https://github.com/login/oauth/authorize",
+        token_endpoint="https://github.com/login/oauth/access_token",
+        jwks_uri=None,
+        userinfo_endpoint="https://api.github.com/user",
+        allow_invites=False,
+    )
+
+
+class _CustomProvider(AuthProvider):
+    def get_user_id(self, request: HTTPConnection) -> str | None:
+        return "embedded-user"
+
+
+def test_auth_mode_names_each_source() -> None:
+    oidc = UnifiedAuthProvider(source="oidc", oidc_config=_oidc_config("https://a.test/cb"))
+    header = UnifiedAuthProvider(source="header", local_single_user=False)
+
+    assert auth_mode(oidc) == "oidc"
+    assert auth_mode(header) == "header"
+    assert auth_mode(_CustomProvider()) == "custom"
+    assert auth_mode(None) == "none"
+
+
+def test_auth_mode_names_accounts() -> None:
+    config = AccountsConfig(
+        cookie_secret=b"s" * 32,
+        session_ttl_hours=8,
+        base_url="https://a.test",
+        init_admin_password=None,
+        invite_ttl_seconds=3600,
+        magic_ttl_seconds=300,
+    )
+    provider = UnifiedAuthProvider(source="accounts", accounts_config=config)
+    assert auth_mode(provider) == "accounts"
+    assert provider.session_cookie_name == "__Host-ap_session"
+
+
+def test_session_cookie_name_follows_redirect_scheme() -> None:
+    https = UnifiedAuthProvider(source="oidc", oidc_config=_oidc_config("https://a.test/cb"))
+    http = UnifiedAuthProvider(source="oidc", oidc_config=_oidc_config("http://a.test/cb"))
+    header = UnifiedAuthProvider(source="header", local_single_user=False)
+
+    assert https.session_cookie_name == "__Host-ap_session"
+    assert http.session_cookie_name == "ap_session"
+    assert header.session_cookie_name is None
```

---

### Incident Patch 12: `fb2c3fb9` (2026-10-05)
**Commit Message**: fix(env): forward BROWSER through daemon, runner, and harness env allowlists (#9143)

The host daemon, runner, and harness spawn environments are allowlisted,
and BROWSER was not on any of them. A user who points BROWSER at a URL
forwarder (e.g. a remote-dev helper that routes OAuth callbacks back to
the laptop) lost it inside every agent, so CLI logins fell back to
xdg-open / x-www-browser instead of the configured opener.

Signed-off-by: Bryan Qiu <[REDACTED_EMAIL]>
Co-authored-by: Isaac <[REDACTED_EMAIL]>

**File**: `omnigent/host/connect.py` (modified, +4/-0)
```diff
@@ -656,6 +656,10 @@ def _connection_refused(exc: BaseException) -> bool:
         # ssh-agent auth, so git-over-SSH and SSH-cert-authenticated tooling
         # fail with "dial unix: missing address".
         "SSH_AUTH_SOCK",
+        # The user's URL-opener command (e.g. a remote-dev helper that forwards
+        # URLs and OAuth callbacks to the laptop). A command name, not a secret.
+        # Without it, CLI logins in the agent fall back to a local browser.
+        "BROWSER",
         # gcloud Application Default Credentials selectors, same class as
         # KUBECONFIG above: AGY_ADC_AUTH is the boolean the Antigravity CLI
         # (agy) reads to pick ADC auth, GOOGLE_APPLICATION_CREDENTIALS is a
```

**File**: `omnigent/inner/agent_env.py` (modified, +3/-0)
```diff
@@ -69,6 +69,9 @@
         # running and to hold the key. Shared here because every harness runs
         # git, not just the one whose bug surfaced it.
         "SSH_AUTH_SOCK",
+        # The user's URL-opener command, so an agent's CLI logins open URLs the
+        # way the user configured (e.g. forwarded to a laptop from a remote box).
+        "BROWSER",
         OMNIGENT_SESSION_ENV_VAR,
         # Windows system / profile constants (SYSTEMROOT is mandatory for
         # Winsock init, USERPROFILE for Path.home(), etc.); no-ops on POSIX
```

**File**: `tests/host/test_connect.py` (modified, +4/-0)
```diff
@@ -3777,6 +3777,7 @@ def test_build_runner_env_allowlists_host_env_and_strips_secrets(tmp_path: Path)
         "OMNIGENT_CLAUDE_SDK_NO_SANDBOX": "1",
         "KUBECONFIG": "/home/alice/.kube/config",
         "SSH_AUTH_SOCK": "/private/tmp/com.apple.launchd.7Qk/Listeners",
+        "BROWSER": "www-browser",
         "CLAUDE_CODE_SKIP_BEDROCK_AUTH": "1",
         "OMNIGENT_DATABRICKS_EXTRA_HEADERS": '{"x-databricks-route-hint": "instance-abc"}',
         "OMNIGENT_LOG_LEVEL": "DEBUG",
@@ -3834,6 +3835,9 @@ def test_build_runner_env_allowlists_host_env_and_strips_secrets(tmp_path: Path)
     # every runner-spawned context without ssh-agent auth, so git-over-SSH and
     # SSH-cert tooling fail with "dial unix: missing address".
     assert env["SSH_AUTH_SOCK"] == "/private/tmp/com.apple.launchd.7Qk/Listeners"
+    # BROWSER names the user's URL opener; dropping it sends CLI logins in the
+    # runner to a local browser instead of the one the user configured.
+    assert env["BROWSER"] == "www-browser"
     # CLAUDE_CODE_SKIP_BEDROCK_AUTH disables AWS SigV4 auth for LiteLLM
     # proxies — a non-secret boolean, same rationale as CLAUDE_CODE_USE_BEDROCK.
     assert env["CLAUDE_CODE_SKIP_BEDROCK_AUTH"] == "1"
```

**File**: `tests/test_agent_spawn_env_canary.py` (modified, +7/-0)
```diff
@@ -190,6 +190,13 @@ def test_real_builders_pass_ssh_auth_sock(monkeypatch):
         assert build().get("SSH_AUTH_SOCK") == sock, harness
 
 
+def test_real_builders_pass_browser(monkeypatch):
+    """The user's URL opener must survive filtering, or CLI logins open the wrong browser."""
+    monkeypatch.setattr("os.environ", {"BROWSER": "www-browser"})
+    for harness, build in sorted(SPAWN_ENV_BUILDERS.items()):
+        assert build().get("BROWSER") == "www-browser", harness
+
+
 def test_real_builders_strip_desktop_session(monkeypatch):
     session_env = {
         "DBUS_SESSION_BUS_ADDRESS": "unix:path=/run/user/1000/bus",
```

---

### Incident Patch 13: `021d1995` (2026-10-05)
**Commit Message**: fix(claude-native): preserve child transcripts through transient outages (#9048)

Signed-off-by: Harry Yao <[REDACTED_EMAIL]>
Co-authored-by: Harry Yao <[REDACTED_EMAIL]>

**File**: `omnigent/harnesses/claude_native/forwarder.py` (modified, +47/-96)
```diff
@@ -147,7 +147,10 @@ def _subagent_id_from_meta_path(meta_path: Path) -> str:
 _POST_TIMEOUT_S = 10.0
 _MAX_SEEN_SOURCE_IDS = 2000
 _SUBAGENT_FORWARD_CONCURRENCY = 8
-_SUBAGENT_ITEM_MAX_TRANSIENT_ATTEMPTS = 12
+# A batch gets a bounded number of attempts before it is split into
+# source-keyed individual posts. Individual transient failures stay pending
+# at the durable cursor so a temporary outage cannot lose child history.
+_SUBAGENT_BATCH_MAX_TRANSIENT_ATTEMPTS = 12
 _CURSOR_FINGERPRINT_BYTES = 256
 _FORK_COMMAND_NAMES = frozenset({"/branch", "/fork"})
 _HTTP_POST_MAX_PERMANENT_FAILURES = 3
@@ -948,7 +951,6 @@ def __init__(
         *,
         max_permanent_attempts: int = _HTTP_POST_MAX_PERMANENT_FAILURES,
         max_not_confirmed_attempts: int = _SUBAGENT_DELIVERY_NOT_CONFIRMED_MAX_ATTEMPTS,
-        max_transient_attempts: int | None = None,
         base_delay_s: float = _HTTP_POST_RETRY_BASE_DELAY_S,
         max_delay_s: float = _HTTP_POST_RETRY_MAX_DELAY_S,
     ) -> None:
@@ -959,17 +961,12 @@ def __init__(
             failure is exhausted.
         :param max_not_confirmed_attempts: Attempts before a
             ``subagent_delivery_not_confirmed`` 503 is exhausted.
-        :param max_transient_attempts: Optional attempt budget for transient
-            failures. ``None`` preserves indefinite retries.
         :param base_delay_s: Initial retry delay in seconds.
         :param max_delay_s: Maximum retry delay in seconds.
         :returns: None.
         """
         self._max_permanent_attempts = max(1, max_permanent_attempts)
         self._max_not_confirmed_attempts = max(1, max_not_confirmed_attempts)
-        self._max_transient_attempts = (
-            max(1, max_transient_attempts) if max_transient_attempts is not None else None
-        )
         self._base_delay_s = max(0.0, base_delay_s)
         self._max_delay_s = max(0.0, max_delay_s)
         self._entries: dict[str, _PostRetryEntry] = {}
@@ -994,6 +991,14 @@ def has_retry_state(self, key: str) -> bool:
         """Return whether ``key`` has a recorded failure awaiting retry."""
         return key in self._entries
 
+    def has_pending_retry_prefix(self, prefix: str) -> bool:
+        """Return whether a retry under ``prefix`` is waiting for backoff."""
+        now = time.monotonic()
+        return any(
+            key.startswith(prefix) and entry.next_attempt_at > now
+            for key, entry in self._entries.items()
+        )
+
     def clear(self, key: str) -> None:
         """
         Remove retry state for a successfully handled event.
@@ -1007,14 +1012,21 @@ def clear(self, key: str) -> None:
         _note_forward_success()
 
     def record_failure(
-        self, key: str, exc: httpx.HTTPError, *, session_id: str
+        self,
+        key: str,
+        exc: httpx.HTTPError,
+        *,
+        session_id: str,
+        max_transient_attempts: int | None = None,
     ) -> _PostRetryDecision:
         """
         Record one failed post and compute the next retry action.
 
         :param key: Stable retry key, e.g. ``"item:source-1"``.
         :param exc: HTTP exception raised while posting the event.
         :param session_id: Session targeted by the failed post.
+        :param max_transient_attempts: Optional batch budget before splitting
+            into individual requests. Individual transient failures have no limit.
         :returns: Retry decision for this failure.
         """
         # Count every failed post (transient or permanent) so a sustained
@@ -1033,8 +1045,8 @@ def record_failure(
             or (
                 not permanent
                 and not not_confirmed
-                and self._max_transient_attempts is not None
-                and entry.attempts >= self._max_transient_attempts
+                and max_transient_attempts is not None
+                and entry.attempts >= max(1, max_transient_attempts)
             )
         )
         if give_up:
@@ -1199,9 +1211,7 @@ async def forward_claude_transcript_to_session(
     item_retries = _PostRetryTracker()
     status_retries = _PostRetryTracker()
     subagent_start_retries = _PostRetryTracker()
-    subagent_item_retries = _PostRetryTracker(
-        max_transient_attempts=_SUBAGENT_ITEM_MAX_TRANSIENT_ATTEMPTS
-    )
+    subagent_item_retries = _PostRetryTracker()
     subagent_status_retries = _PostRetryTracker()
     session_event_batch_capability = _SessionEventBatchCapability()
     delta_batch_capability = _SessionEventBatchCapability()
@@ -1318,9 +1328,7 @@ async def forward_claude_transcript_to_session(
                         item_retries = _PostRetryTracker()
                         status_retries = _PostRetryTracker()
                         subagent_start_retries = _PostRetryTracker()
-                        subagent_item_retries = _PostRetryTracker(
-                            max_transient_attempts=_SUBAGENT_ITEM_MAX_TRANSIENT_ATTEMPTS
-                        )
+                        su
```

**File**: `tests/harnesses/claude_native/forwarder/test_subagent_delivery.py` (modified, +12/-13)
```diff
@@ -870,11 +870,14 @@ def transcript_item(source_id: str) -> ClaudeTranscriptItem:
         items=[first],
         record_items=(TranscriptRecordItems(next_byte_offset=10, items=(first,)),),
     )
-    monkeypatch.setattr(
-        forwarder,
-        "read_transcript_items_from_offset",
-        lambda *args, **kwargs: current_result,
-    )
+    read_calls = 0
+
+    def read_items(*args: object, **kwargs: object) -> TranscriptReadResult:
+        nonlocal read_calls
+        read_calls += 1
+        return current_result
+
+    monkeypatch.setattr(forwarder, "read_transcript_items_from_offset", read_items)
     entry = forwarder.SubagentEntry(
         subagent_id="backoff",
         child_conversation_id="conv_child_backoff",
@@ -932,6 +935,7 @@ def handler(request: httpx.Request) -> httpx.Response:
         )
 
     assert requests == 1
+    assert read_calls == 1
 
 
 @pytest.mark.asyncio
@@ -1079,10 +1083,7 @@ def handler(request: httpx.Request) -> httpx.Response:
             statuses.append((child_id, body))
         return httpx.Response(202, json={})
 
-    tracker = forwarder._PostRetryTracker(
-        base_delay_s=0.0,
-        max_transient_attempts=3,
-    )
+    tracker = forwarder._PostRetryTracker(base_delay_s=0.0)
     state = forwarder.SubagentForwardState(subagents=entries)
     async with httpx.AsyncClient(
         transport=httpx.MockTransport(handler), base_url="http://ap"
@@ -1340,10 +1341,8 @@ def handler(request: httpx.Request) -> httpx.Response:
             individual_source_ids.append(body["data"]["source_id"])
         return httpx.Response(204)
 
-    retry_tracker = forwarder._PostRetryTracker(
-        base_delay_s=0.0,
-        max_transient_attempts=2,
-    )
+    retry_tracker = forwarder._PostRetryTracker(base_delay_s=0.0)
+    monkeypatch.setattr(forwarder, "_SUBAGENT_BATCH_MAX_TRANSIENT_ATTEMPTS", 2)
     async with httpx.AsyncClient(
         transport=httpx.MockTransport(handler), base_url="http://ap"
     ) as client:
```

**File**: `tests/harnesses/claude_native/forwarder/test_subagent_status.py` (modified, +233/-42)
```diff
@@ -7,7 +7,6 @@
 import json
 import logging
 import time
-from dataclasses import replace
 from pathlib import Path
 from types import SimpleNamespace
 from typing import Any
@@ -24,10 +23,195 @@
     _get_recorded_request,
     _seed_subagent_on_disk,
     _start_recording_server,
-    _subagent_drop_row,
 )
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("failure", ["502", "request_error", "read_timeout"])
+async def test_production_loop_recovers_child_after_prolonged_transient_failures(
+    tmp_path: Path,
+    monkeypatch: pytest.MonkeyPatch,
+    caplog: pytest.LogCaptureFixture,
+    failure: str,
+) -> None:
+    """The live loop keeps a failed child item pending until AP recovers."""
+    caplog.set_level(logging.CRITICAL, logger=forwarder.__name__)
+    bridge_dir = tmp_path / "bridge"
+    bridge_dir.mkdir()
+    transcript_path = tmp_path / "session.jsonl"
+    transcript_path.write_text("", encoding="utf-8")
+    _seed_subagent_on_disk(
+        transcript_path=transcript_path,
+        subagent_id="main-loop-recovery",
+        agent_type="Explore",
+        description="main loop transient recovery",
+        tool_use_id="toolu_main_loop_recovery",
+        transcript_records=[
+            {
+                "isSidechain": True,
+                "type": "assistant",
+                "uuid": "main-loop-message",
+                "message": {
+                    "role": "assistant",
+                    "content": [{"type": "text", "text": "recover me"}],
+                },
+            }
+        ],
+    )
+    record_hook_event(
+        bridge_dir,
+        {
+            "hook_event_name": "SessionStart",
+            "session_id": "claude-main-loop",
+            "transcript_path": str(transcript_path),
+        },
+    )
+    child_attempts = 0
+    failed_attempts = 0
+    delivered_source_ids: list[str] = []
+    prolonged_outage = asyncio.Event()
+    recovery_gate = asyncio.Event()
+    delivered = asyncio.Event()
+    recovery_scan = asyncio.Event()
+    second_scan = asyncio.Event()
+    outage = True
+    restart_phase = False
+    retry_gate_calls = 0
+
+    async def handler(request: httpx.Request) -> httpx.Response:
+        nonlocal child_attempts, failed_attempts
+        body = json.loads(request.content.decode("utf-8")) if request.content else {}
+        is_batch = isinstance(body, list)
+        is_child_item = isinstance(body, dict) and body.get("type") == "external_conversation_item"
+        if is_batch or is_child_item:
+            child_attempts += 1
+            if outage:
+                failed_attempts += 1
+                if failed_attempts >= 30:
+                    prolonged_outage.set()
+                    await recovery_gate.wait()
+                if failure == "request_error":
+                    raise httpx.RequestError("AP unavailable", request=request)
+                if failure == "read_timeout":
+                    raise httpx.ReadTimeout("AP response lost", request=request)
+                return httpx.Response(502, text="bad gateway")
+            if is_batch:
+                delivered_source_ids.extend(row["data"]["source_id"] for row in body)
+            else:
+                delivered_source_ids.append(body["data"]["source_id"])
+            delivered.set()
+            if is_batch:
+                return httpx.Response(
+                    202,
+                    json=[{"queued": False, "item_id": row["data"]["source_id"]} for row in body],
+                )
+            return httpx.Response(202, json={"queued": False, "item_id": "recovered"})
+        if isinstance(body, dict) and body.get("type") == "external_subagent_start":
+            return httpx.Response(202, json={"child_session_id": "conv_main_loop_child"})
+        return httpx.Response(202, json={})
+
+    original_retry_delay = forwarder._PostRetryTracker.retry_delay_s
+    original_pending_prefix = forwarder._PostRetryTracker.has_pending_retry_prefix
+
+    def release_child_backoff(self: forwarder._PostRetryTracker, key: str) -> float | None:
+        nonlocal retry_gate_calls
+        retry_gate_calls += 1
+        if key.startswith(("subagent_batch:", "subagent_item:")):
+            return None
+        return original_retry_delay(self, key)
+
+    def release_child_pending_prefix(self: forwarder._PostRetryTracker, prefix: str) -> bool:
+        if prefix.startswith(("subagent_batch:", "subagent_item:")):
+            return False
+        return original_pending_prefix(self, prefix)
+
+    monkeypatch.setattr(forwarder._PostRetryTracker, "retry_delay_s", release_child_backoff)
+    monkeypatch.setattr(
+        forwarder._PostRetryTracker,
+        "has_pending_retry_prefix",
+        release_child_pending_prefix,
+    )
+
+    async def skip_pane_signals(*_args: Any, **_kwargs: Any) -> None:
+        return None
+
+    monkeypatch.setattr(forwarder, "_forward_pane_signals", skip_pane_signals)
+
+    async def passthrough_state(**kwargs: Any) -> Any:
+ 
```

---

### Incident Patch 14: `b2582833` (2026-10-05)
**Commit Message**: fix(side-chat): seal lost resume forks (#9063)

Signed-off-by: Harry Yao <[REDACTED_EMAIL]>
Co-authored-by: Harry Yao <[REDACTED_EMAIL]>

**File**: `omnigent/server/routes/sessions/routes_events.py` (modified, +17/-18)
```diff
@@ -1017,6 +1017,23 @@ async def _post_event_impl(
                 parse_client_side_tool_specs(body.tools)
             except ValueError as exc:
                 raise OmnigentError(str(exc), code=ErrorCode.INVALID_INPUT) from exc
+        if (
+            body.type == _RETRY_SESSION_TYPE
+            or (body.type == "message" and body.data.get("role") == "user")
+        ) and await _codex_side_chat_fork_lost(
+            conv,
+            conversation_store,
+            runner_router,
+            getattr(request.app.state, "host_registry", None),
+        ):
+            # The ephemeral fork died with its runner; keep the transcript read-only.
+            await asyncio.to_thread(
+                conversation_store.set_labels, conv.id, {CLOSED_LABEL_KEY: CLOSED_LABEL_VALUE}
+            )
+            raise OmnigentError(
+                "This side chat ended when its runner restarted and can't be continued.",
+                code=ErrorCode.CONFLICT,
+            )
         if body.type == _RETRY_SESSION_TYPE:
             return await _retry_session_single_flight(
                 request=cast("Request", request),
@@ -1050,24 +1067,6 @@ async def _post_event_impl(
                 "Session is closed. Start a new sub-agent session to continue.",
                 code=ErrorCode.CONFLICT,
             )
-        if (
-            body.type == "message"
-            and body.data.get("role") == "user"
-            and await _codex_side_chat_fork_lost(
-                conv,
-                conversation_store,
-                runner_router,
-                getattr(request.app.state, "host_registry", None),
-            )
-        ):
-            # The ephemeral fork died with its runner; keep the transcript read-only.
-            await asyncio.to_thread(
-                conversation_store.set_labels, conv.id, {CLOSED_LABEL_KEY: CLOSED_LABEL_VALUE}
-            )
-            raise OmnigentError(
-                "This side chat ended when its runner restarted and can't be continued.",
-                code=ErrorCode.CONFLICT,
-            )
         if (
             body.type == "message"
             and body.data.get("role") == "user"
```

**File**: `tests/browser_ui/chat/test_side_chat_resume.py` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+"""Browser-contract proof for a sealed side-chat Resume flow."""
+
+from __future__ import annotations
+
+import json
+import re
+from pathlib import Path
+from typing import Any
+
+from playwright.sync_api import Page, Route, expect
+
+from tests.browser_ui.chat.session_contract import ChatSessionContract, list_payload
+
+
+def test_side_chat_resume_conflict_refetches_metadata_and_seals_pane(
+    page: Page,
+    chat_session_contract: ChatSessionContract,
+    output_path: str,
+) -> None:
+    """A failed side-chat resume becomes read-only without reloading the app."""
+    chat = chat_session_contract
+    artifacts = Path(output_path)
+    child_id = "browser-side-child"
+    child_path = f"/v1/sessions/{child_id}"
+    child_gets: list[dict[str, Any]] = []
+    retry_posts: list[dict[str, Any]] = []
+    stop_posts: list[dict[str, Any]] = []
+    child_closed = False
+
+    chat.update_session(harness="openai-agents")
+    chat.set_items(
+        [
+            {
+                "id": "parent-history",
+                "response_id": "parent-response",
+                "type": "message",
+                "role": "user",
+                "status": "completed",
+                "content": [{"type": "input_text", "text": "Parent remains usable."}],
+            }
+        ]
+    )
+    child_session = dict(chat._session())
+    child_session.update(
+        {
+            "id": child_id,
+            "agent_id": chat.agent_id,
+            "agent_name": chat.agent_id,
+            "harness": "openai-agents",
+            "status": "failed",
+            "labels": {},
+        }
+    )
+    child_items = [
+        {
+            "id": "child-history",
+            "response_id": "child-response",
+            "type": "message",
+            "role": "user",
+            "status": "completed",
+            "content": [
+                {"type": "input_text", "text": "Side-chat history that must remain visible."}
+            ],
+        },
+        {
+            "id": "child-error",
+            "response_id": "child-response",
+            "type": "error",
+            "status": "completed",
+            "source": "execution",
+            "code": "required_terminal_exited",
+            "message": "The side-chat runner exited before it could resume.",
+        },
+    ]
+
+    contract = chat.contract
+    base = re.escape(chat.base_url)
+    child_session_pattern = re.compile(rf"^{base}{re.escape(child_path)}(?:\?.*)?$")
+
+    def get_child_session(route: Route) -> None:
+        if route.request.method != "GET":
+            route.fallback()
+            return
+        snapshot = dict(child_session)
+        snapshot["labels"] = {"omnigent.closed": "true"} if child_closed else {}
+        child_gets.append({"labels": dict(snapshot["labels"])})
+        route.fulfill(status=200, content_type="application/json", body=json.dumps(snapshot))
+
+    contract.route(child_session_pattern, get_child_session)
+    contract.json(f"{child_path}/items", lambda _request: list_payload(child_items))
+    contract.json(f"{child_path}/agent", lambda _request: chat._agent())
+    contract.json(f"{child_path}/child_sessions", list_payload([]))
+    contract.json(f"{child_path}/resources/terminals", list_payload([]))
+    contract.response(f"{child_path}/read-state", method="PUT")
+    contract.sse(f"{child_path}/stream")
+    contract.json(f"/v1/sessions/{chat.session_id}/policies", list_payload([]))
+    contract.json("/v1/policy-registry", list_payload([]))
+    contract.json(f"/v1/sessions/{chat.session_id}/owner", {"owner": None})
+
+    def retry_child(route: Route) -> None:
+        nonlocal child_closed
+        if route.request.method != "POST":
+            route.fallback()
+            return
+        body = json.loads(route.request.post_data or "{}")
+        if body == {"type": "stop_session", "data": {}}:
+            stop_posts.append(body)
+            route.fulfill(
+                status=200,
+                content_type="application/json",
+                body=json.dumps({"queued": False}),
+            )
+            return
+        retry_posts.append(body)
+        assert body == {"type": "retry_session", "data": {}}
+        child_closed = True
+        route.fulfill(
+            status=409,
+            content_type="application/json",
+            body=json.dumps(
+                {"error": {"code": "conflict", "message": "This side chat has ended."}}
+            ),
+        )
+
+    contract.route(re.compile(rf"^{base}{re.escape(child_path)}/events$"), retry_child)
+
+    page.goto(chat.url)
+    page.evaluate(
+        """state => {
+          localStorage.setItem("omnigent:session-workspace-state", JSON.stringify([state]));
+          localStorage.setItem("omnigent.sideChatInherited:browser-side-child", "[]");
+        }""",
+        {
+            "id": "browser-chat-session",
+            "state": {
+                "open": True,
+                "rightRailTab": "
```

**File**: `tests/server/integration/test_sessions_child_sessions.py` (modified, +52/-0)
```diff
@@ -2101,6 +2101,58 @@ async def _no_policy(*_args: Any, **_kwargs: Any) -> None:
         assert CLOSED_LABEL_KEY not in after.labels
 
 
+@pytest.mark.parametrize(
+    ("parent_runner", "host_reports_dead", "expected_status"),
+    [
+        ("runner_replacement", False, 409),
+        ("runner_side", True, 409),
+        ("runner_side", False, 503),
+    ],
+    ids=["parent-relaunched", "host-reports-runner-gone", "transient-outage"],
+)
+async def test_side_chat_retry_after_runner_loss(
+    client: httpx.AsyncClient,
+    db_uri: str,
+    monkeypatch: pytest.MonkeyPatch,
+    parent_runner: str,
+    host_reports_dead: bool,
+    expected_status: int,
+) -> None:
+    """Resume seals a lost fork, while a temporary outage remains recoverable."""
+    child = await _create_native_child(client, name="retry-side-chat")
+    conv_store = SqlAlchemyConversationStore(db_uri)
+    conv_store.set_labels(
+        child["id"],
+        {
+            "omnigent.wrapper": "codex-native-ui-subagent",
+            "omnigent.codex_native.agent_nickname": "Side chat",
+        },
+    )
+    conv_store.replace_runner_id(child["id"], "runner_side")
+    conv_store.replace_runner_id(child["parent_session_id"], parent_runner)
+
+    async def _none(*_args: Any, **_kwargs: Any) -> None:
+        return None
+
+    real_fork_lost = routes_events_module._codex_side_chat_fork_lost
+
+    async def _fork_lost(*args: Any, **kwargs: Any) -> bool:
+        return host_reports_dead or await real_fork_lost(*args, **kwargs)
+
+    monkeypatch.setattr(routes_events_module, "_get_runner_client", _none)
+    monkeypatch.setattr(routes_events_module, "_codex_side_chat_fork_lost", _fork_lost)
+    response = await client.post(
+        f"/v1/sessions/{child['id']}/events",
+        json={"type": "retry_session", "data": {}},
+    )
+
+    assert response.status_code == expected_status, response.text
+    after = conv_store.get_conversation(child["id"])
+    assert after is not None
+    assert (after.labels.get(CLOSED_LABEL_KEY) == CLOSED_LABEL_VALUE) == (expected_status == 409)
+    assert conv_store.list_items(child["id"]).data == []
+
+
 async def test_non_subagent_session_not_healed_via_parent(
     client: httpx.AsyncClient,
     monkeypatch: pytest.MonkeyPatch,
```

**File**: `web/src/components/chat/SideChatPane.tsx` (modified, +1/-0)
```diff
@@ -286,6 +286,7 @@ export function SideChatPane({
                   bubble={bubble}
                   isLastAssistant={index === lastAssistantIndex}
                   showsWorking={showsWorking}
+                  recoveryDisabled={readOnly}
                 />
               ))}
               {shouldShowWorkingIndicator(showsWorking, bubbles) && <WorkingIndicator />}
```

**File**: `web/src/components/chat/chatBubbleParts.test.tsx` (modified, +55/-0)
```diff
@@ -1,5 +1,6 @@
 import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
 import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
+import { ConversationScopeContext } from "@/components/chat/conversationScope";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import type { Bubble } from "@/lib/renderItems";
 import { useChatStore, type ChatState } from "@/store/chatStore";
@@ -393,6 +394,60 @@ describe("AssistantBubble error retry", () => {
   });
 });
 
+describe("AssistantBubble sealed side-chat recovery", () => {
+  it("removes recovery actions when the side chat is sealed but keeps the error", () => {
+    const view = render(
+      <BubbleView bubble={errorBubble("required_terminal_exited")} recoveryDisabled />,
+    );
+
+    expect(screen.queryByRole("button", { name: "Resume session" })).toBeNull();
+    expect(screen.getByTestId("error-pill")).toHaveTextContent("The agent's terminal exited");
+
+    view.rerender(<BubbleView bubble={errorBubble("required_terminal_exited")} />);
+
+    expect(screen.getByRole("button", { name: "Resume session" })).toBeInTheDocument();
+  });
+
+  it.each([null, "conv_child"])(
+    "refreshes the resumed session's labels (scope=%s)",
+    async (scope) => {
+      const client = new QueryClient();
+      const invalidate = vi.spyOn(client, "invalidateQueries");
+      fetchMock.mockResolvedValueOnce(
+        jsonResponse({ error: { code: "conflict", message: "This side chat has ended." } }, 409),
+      );
+      render(
+        <QueryClientProvider client={client}>
+          <ConversationScopeContext.Provider value={scope}>
+            <BubbleView bubble={errorBubble("required_terminal_exited")} />
+          </ConversationScopeContext.Provider>
+        </QueryClientProvider>,
+      );
+
+      fireEvent.click(screen.getByRole("button", { name: "Resume session" }));
+
+      await waitFor(() =>
+        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["session", scope ?? "conv_retry"] }),
+      );
+      expect(fetchMock.mock.calls[0]?.[0]).toBe(`/v1/sessions/${scope ?? "conv_retry"}/events`);
+      expect(screen.getByRole("status")).toHaveTextContent("This side chat has ended.");
+    },
+  );
+
+  it("preserves the error when rendered without a query provider", async () => {
+    fetchMock.mockResolvedValueOnce(
+      jsonResponse({ error: { code: "conflict", message: "This side chat has ended." } }, 409),
+    );
+    render(<BubbleView bubble={errorBubble("required_terminal_exited")} />);
+
+    fireEvent.click(screen.getByRole("button", { name: "Resume session" }));
+
+    await waitFor(() =>
+      expect(screen.getByRole("status")).toHaveTextContent("This side chat has ended."),
+    );
+  });
+});
+
 describe("UserBubble long-prompt collapse", () => {
   const COLLAPSE_THRESHOLD = 12000;
   const TAIL = "UNIQUE_TAIL";
```

**File**: `web/src/components/chat/chatBubbleParts.tsx` (modified, +23/-6)
```diff
@@ -64,7 +64,8 @@ import {
 } from "@/lib/blocks";
 import { type Bubble, type RenderItem, bubblesEqual } from "@/lib/renderItems";
 import { getCurrentAuthorId } from "@/lib/identity";
-import { continueFailedTurn, retrySession } from "@/lib/sessionsApi";
+import { QueryClientContext } from "@tanstack/react-query";
+import { ApiError, continueFailedTurn, retrySession } from "@/lib/sessionsApi";
 import { useChatStore, type PendingUserMessage } from "@/store/chatStore";
 import { conversationRegistry } from "@/store/conversationRegistry";
 import { useConversationEntryState } from "@/hooks/useConversationEntryState";
@@ -554,11 +555,14 @@ export const BubbleView = memo(
     isLastAssistant = false,
     showsWorking = false,
     actionsPersistent = false,
+    recoveryDisabled = false,
   }: {
     bubble: Bubble;
     isLastAssistant?: boolean;
     showsWorking?: boolean;
     actionsPersistent?: boolean;
+    /** Hide retry/recovery controls when the surrounding session is sealed. */
+    recoveryDisabled?: boolean;
   }) {
     if (bubble.kind === "user") return <UserBubble bubble={bubble} />;
     if (bubble.kind === "compaction_loading") {
@@ -585,13 +589,15 @@ export const BubbleView = memo(
         isLastAssistant={isLastAssistant}
         showsWorking={showsWorking}
         actionsPersistent={actionsPersistent}
+        recoveryDisabled={recoveryDisabled}
       />
     );
   },
   (prev, next) =>
     (prev.isLastAssistant ?? false) === (next.isLastAssistant ?? false) &&
     (prev.showsWorking ?? false) === (next.showsWorking ?? false) &&
     (prev.actionsPersistent ?? false) === (next.actionsPersistent ?? false) &&
+    (prev.recoveryDisabled ?? false) === (next.recoveryDisabled ?? false) &&
     bubblesEqual(prev.bubble, next.bubble),
 );
 
@@ -930,11 +936,13 @@ function AssistantBubble({
   isLastAssistant = false,
   showsWorking = false,
   actionsPersistent = false,
+  recoveryDisabled = false,
 }: {
   bubble: Extract<Bubble, { kind: "assistant" }>;
   isLastAssistant?: boolean;
   showsWorking?: boolean;
   actionsPersistent?: boolean;
+  recoveryDisabled?: boolean;
 }) {
   // The walker only emits an assistant bubble when at least one assistant-side
   // block exists. The "Working…" shimmer for the empty-items / streaming gap
@@ -964,6 +972,7 @@ function AssistantBubble({
   const flashing = useChatStore((s) => s.flashItemId === bubble.responseId);
   // null outside AppShell's provider (isolated tests) → hide the action.
   const forkDialog = useForkDialog();
+  const queryClient = useContext(QueryClientContext);
   const handleRetryError = useCallback(
     async (item: Extract<RenderItem, { kind: "error" }>) => {
       if (!conversationId) throw new Error("Session is not available");
@@ -993,12 +1002,20 @@ function AssistantBubble({
         await continueFailedTurn(conversationId);
         return;
       }
-      const result = await retrySession(conversationId);
-      if (!result.recovered) {
-        throw new Error("The session is already connected; no recovery was performed");
+      try {
+        const result = await retrySession(conversationId);
+        if (!result.recovered) {
+          throw new Error("The session is already connected; no recovery was performed");
+        }
+      } catch (error) {
+        // Resume can seal a lost side chat; refresh its read-only state immediately.
+        if (error instanceof ApiError && error.code === "conflict") {
+          void queryClient?.invalidateQueries({ queryKey: ["session", conversationId] });
+        }
+        throw error;
       }
     },
-    [conversationId, scopedConversationId, isLastAssistant],
+    [conversationId, scopedConversationId, isLastAssistant, queryClient],
   );
 
   if (bubble.items.length === 0) return null;
@@ -1064,7 +1081,7 @@ function AssistantBubble({
             lastActivityAtS={bubble.lastActivityAtS}
             showsWorking={showsWorking}
             defaultExpanded={bubble.defaultExpanded}
-            onRetryError={handleRetryError}
+            onRetryError={recoveryDisabled ? undefined : handleRetryError}
           />
         </MessageContent>
         {bubble.lifecycle === "cancelled" && (
```

---

### Incident Patch 15: `8cdefbe0` (2026-10-05)
**Commit Message**: fix(runtime): finish harness cleanup when release is cancelled (#9106)

* fix(runtime): finish harness cleanup when release is cancelled

Signed-off-by: Harry Yao <[REDACTED_EMAIL]>

* test(runtime): initialize complete teardown manager state

Signed-off-by: Harry Yao <[REDACTED_EMAIL]>

---------

Signed-off-by: Harry Yao <[REDACTED_EMAIL]>
Co-authored-by: Harry Yao <[REDACTED_EMAIL]>

**File**: `omnigent/runtime/harnesses/process_manager.py` (modified, +27/-4)
```diff
@@ -1426,34 +1426,57 @@ async def _close_entry(self, entry: _SubprocessEntry) -> None:
 
         :param entry: The bookkeeping record to tear down.
         """
+        cancellation: asyncio.CancelledError | None = None
         try:
             await entry.client.aclose()
+        except asyncio.CancelledError as exc:
+            cancellation = exc
         except Exception:
             # A broken transport must not skip the subprocess kill below.
             _logger.exception("error closing harness client during teardown; continuing")
-        finally:
+
+        async def _force_kill_and_wait() -> None:
+            _proc.kill_tree(entry.process)
+            await asyncio.wait_for(entry.process.wait(), timeout=_RELEASE_GRACE_S)
+
+        try:
             if entry.process.returncode is None:
                 try:
                     # Tree-aware backstop: this process parents the sandbox
                     # launcher, which forks the real agent. Signalling only the
                     # handle strands both when an executor close() never runs.
                     _proc.terminate_tree(entry.process)
                     await asyncio.wait_for(entry.process.wait(), timeout=_RELEASE_GRACE_S)
+                except asyncio.CancelledError as exc:
+                    # Cancellation during either wait must not abandon the child.
+                    cancellation = exc
+                    try:
+                        await _force_kill_and_wait()
+                    except asyncio.CancelledError as exc:
+                        cancellation = exc
+                    except Exception:
+                        pass
                 except Exception:
                     # Graceful SIGTERM didn't complete — it timed out, or
                     # send_signal/wait raised (e.g. the process vanished
                     # mid-teardown). Force-kill best-effort; a process that
                     # is already gone is already done.
-                    with contextlib.suppress(Exception):
-                        _proc.kill_tree(entry.process)
-                        await entry.process.wait()
+                    try:
+                        await _force_kill_and_wait()
+                    except asyncio.CancelledError as exc:
+                        cancellation = exc
+                    except Exception:
+                        pass
+        finally:
             with contextlib.suppress(Exception):
                 close_subprocess_transport(entry.process)
             # Best-effort socket cleanup. uvicorn's atexit usually
             # handles this when SIGTERM lands cleanly, but a
             # hard-killed runner won't. No-op for TCP endpoints.
             with contextlib.suppress(Exception):
                 entry.endpoint.cleanup()
+        if cancellation is not None:
+            raise cancellation
 
     async def _idle_reaper_loop(self) -> None:
         """
```

**File**: `tests/runtime/harnesses/test_process_manager.py` (modified, +186/-0)
```diff
@@ -470,6 +470,192 @@ async def _boom() -> None:
         await manager.shutdown()
 
 
+async def test_release_reaps_term_resistant_process_when_graceful_wait_is_cancelled(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """A cancelled graceful wait still force-kills and reaps a real child."""
+    from omnigent.runtime.harnesses import process_manager as process_manager_module
+
+    class _Client:
+        async def aclose(self) -> None:
+            return None
+
+    class _Endpoint:
+        def __init__(self) -> None:
+            self.cleaned = False
+
+        def cleanup(self) -> None:
+            self.cleaned = True
+
+    process = await asyncio.create_subprocess_exec(
+        sys.executable,
+        "-c",
+        (
+            "import signal, sys, time; "
+            "signal.signal(signal.SIGTERM, signal.SIG_IGN); "
+            "print('ready', flush=True); "
+            "time.sleep(60)"
+        ),
+        stdout=asyncio.subprocess.PIPE,
+    )
+    try:
+        assert process.stdout is not None
+        assert await asyncio.wait_for(process.stdout.readline(), timeout=10.0) == b"ready\n"
+    except BaseException:
+        if process.returncode is None:
+            process.kill()
+        await process.wait()
+        raise
+    endpoint = _Endpoint()
+    transport_closes: list[object] = []
+    terminate_started = asyncio.Event()
+    real_terminate_tree = process_manager_module._proc.terminate_tree
+    real_close_transport = process_manager_module.close_subprocess_transport
+
+    def terminate_tree(target: object) -> None:
+        real_terminate_tree(target)  # type: ignore[arg-type]
+        terminate_started.set()
+
+    def close_transport(target: object) -> None:
+        transport_closes.append(target)
+        real_close_transport(target)
+
+    monkeypatch.setattr(process_manager_module._proc, "terminate_tree", terminate_tree)
+    monkeypatch.setattr(process_manager_module, "close_subprocess_transport", close_transport)
+    manager = object.__new__(HarnessProcessManager)
+    manager._entries = {}
+    manager._spawn_locks = {"conv_real": asyncio.Lock()}
+    manager._registry_lock = asyncio.Lock()
+    manager._release_generations = {}
+    manager._in_flight_response_ids = {}
+    entry = process_manager_module._SubprocessEntry(
+        process,
+        _Client(),
+        endpoint,
+        "test",
+    )
+    manager._entries["conv_real"] = entry
+    closing = asyncio.create_task(manager.release("conv_real"))
+    try:
+        await asyncio.wait_for(terminate_started.wait(), timeout=10.0)
+        assert process.returncode is None, "fixture child unexpectedly honored SIGTERM"
+        closing.cancel()
+        with pytest.raises(asyncio.CancelledError):
+            await asyncio.wait_for(closing, timeout=10.0)
+
+        assert process.returncode is not None
+        assert await asyncio.wait_for(process.wait(), timeout=1.0) == process.returncode
+        assert "conv_real" not in manager._entries
+        assert transport_closes == [process]
+        assert endpoint.cleaned
+    finally:
+        if not closing.done():
+            closing.cancel()
+            await asyncio.gather(closing, return_exceptions=True)
+        if process.returncode is None:
+            process.kill()
+            await process.wait()
+
+
+@pytest.mark.parametrize("cancel_stage", ["force_wait", "client_close"])
+async def test_release_reaps_process_when_teardown_is_cancelled(
+    monkeypatch: pytest.MonkeyPatch,
+    cancel_stage: str,
+) -> None:
+    """Cancellation during force wait or client close still cleans up."""
+    from omnigent.runtime.harnesses import process_manager as process_manager_module
+
+    class _BlockingProcess:
+        pid = 424242
+        returncode: int | None = None
+
+        def __init__(self) -> None:
+            self.wait_started = asyncio.Event()
+            self.force_wait_started = asyncio.Event()
+            self.wait_calls = 0
+            self.dead = False
+
+        async def wait(self) -> None:
+            self.wait_calls += 1
+            if self.wait_calls == 1:
+                self.wait_started.set()
+                if self.returncode is None:
+                    await asyncio.Event().wait()
+            elif cancel_stage == "force_wait":
+                self.force_wait_started.set()
+                await asyncio.Event().wait()
+            return self.returncode
+
+    class _Client:
+        def __init__(self) -> None:
+            self.aclose_started = asyncio.Event()
+
+        async def aclose(self) -> None:
+            if cancel_stage == "client_close":
+                self.aclose_started.set()
+                await asyncio.Event().wait()
+
+    class _Endpoint:
+        def __init__(self) -> None:
+            self.cleaned = False
+
+        def cleanup(self) -> None:
+            self.cleaned = True
+
+    process = _BlockingProcess()
+    endpoint = _Endpoint()
+    client = _Client()
+    transport_closes: 
```

#### Recent Merged Pull Requests:
- **PR #9200** (2026-10-06): fix(tunnel): settle header waiters on incomplete response completion (@yaoharry)
- **PR #9191** (2026-10-06): Polish mobile chat and settings UX (part 1) (@ajayalfred)
- **PR #9188** (2026-10-06): chore(logging): attribute runner event ingestion failures to sessions (@yaoharry)
- **PR #9167** (2026-10-06): docs(changelog): record v0.17.0 (@omnigent-ci[bot])
- **PR #9166** (2026-10-06): Bump version to 0.18.0.dev0 (@omnigent-ci[bot])
- **PR #9161** (2026-10-05): fix(codex-native): recover sessions whose app-server has stopped (@yaoharry)
- **PR #9160** (2026-10-06): fix(runner): give a slow launch-config read time to answer (@yaoharry)
- **PR #9144** (2026-10-05): fix(pi-native): make transcript event delivery durable (@Edwinhe03)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
