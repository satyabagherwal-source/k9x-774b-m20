# Forensic Learning Record (Deep Inspection): Ataraxy-Labs/sem

> **Canonical Artifact**: `07_PROJECT_LEARNING/ataraxy-labs-sem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ataraxy-Labs/sem](https://github.com/Ataraxy-Labs/sem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:40:08.154Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ataraxy-Labs/sem`
- **Description**: Semantic version control => entity-level diffs, blame, and impact analysis on top of git. 28 languages via tree-sitter. Built for coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3367 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent-skill/badge/sem-activity.py`
```
#!/usr/bin/env python3
"""PostToolUse hook: log sem usage (command + target entity) for the badge.

Fires on both paths sem is used:
  - the sem MCP tools (mcp__sem__sem_*)
  - the sem CLI run through Bash (e.g. `sem impact foo`, `.../release/sem diff`)

Appends {session, ts, tool, target, ms?} to ~/.claude/sem-activity.jsonl, which
the statusline reads to show a live badge of what sem is doing. Exits 0 and
prints nothing so it never interferes with the tool.
"""
import json
import os
import re
import sys
import time

ACT = os.path.expanduser("~/.claude/sem-activity.jsonl")
SUBCMDS = "diff|impact|context|entities|graph|blame|log|orient|xref|mcp|whoami"
# `sem` must be in command position (start of line, or right after a shell
# separator), not merely after whitespace — otherwise prose inside quoted
# commit messages ("... sem impact recall, ...") logs garbage events.
CLI_RE = re.compile(
    r"(?:^|[;&|(]\s*|&&\s*|\|\|\s*|\n\s*)(?:[\w./~-]*/)?sem\s+(" + SUBCMDS + r")\b([^\n;&|)]*)"
)
TARGET_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_.:-]*$")


def inside_quotes(text, idx):
    """Cheap heuristic: an odd number of quotes before idx means we're inside
    a quoted string (a commit message, a PR body), not a real invocation."""
    prefix = text[:idx]
    return prefix.count('"') % 2 == 1 or prefix.count("'") % 2 == 1


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    tool = data.get("tool_name") or data.get("toolName") or ""
    phase = "start" if (data.get("hook_event_name") or "").startswith("Pre") else "done"
    short = target = None
    ms = None

    file_hint = None

    if "mcp__sem__" in tool:
        short = tool.split("__")[-1].replace("sem_", "") or "sem"
        ti = data.get("tool_input") or data.get("toolInput") or {}
        if isinstance(ti, dict):
            for k in ("targetEntity", "entity_name", "entity", "query", "path"):
                if ti.get(k):
                    target = str(ti[k])
                    break
            if ti.get("file_path"):
                file_hint = str(ti["file_path"])
        resp = data.get("tool_response") or data.get("toolResponse") or {}
        if isinstance(resp, str):
            try:
                resp = json.loads(resp)
            except Exception:
                resp = {}
        if isinstance(resp, dict):
            for k in ("elapsed_ms", "elapsedMs", "ms"):
                if isinstance(resp.get(k), (int, float)):
                    ms = round(resp[k])
                    break
    elif tool == "Bash":
        cmd = (data.get("tool_input") or data.get("toolInput") or {}).get("command", "") or ""
        for m in CLI_RE.finditer(cmd):
            if inside_quotes(cmd, m.start()):
                continue
            short = m.group(1)
            rest = (m.group(2) or "").strip()
            tok = rest.split()[0] if rest else ""
            tok = tok.strip("'\"")
            if tok and not tok.startswith("-") and TARGET_RE.match(tok):
                target = tok
            fm = re.search(r"--file[= ]([^\s]+)", rest)
            if fm:
                file_hint = fm.group(1).strip("'\"")
            break

    if not short:
        return

    event = {
        "session": data.get("session_id") or data.get("sessionId") or "",
        "ts": int(time.time()),
        "tool": short,
        "phase": phase,
    }
    if target:
        event["target"] = target[:40]
    if file_hint:
        event["file"] = file_hint
    cwd = data.get("cwd") or data.get("cwd_path") or ""
    if cwd:
        event["cwd"] = cwd
    if ms is not None:
        event["ms"] = ms

    try:
        os.makedirs(os.path.dirname(ACT), exist_ok=True)
        with open(ACT, "a") as f:
            f.write(json.dumps(event) + "\n")
    except Exception:
        pass

    if phase == "start":
        return

    # Accumulate a persisted lifetime savings tally (single writer: this hook), so
    # the statusline and viewer can show a number that grows across every session.
    # Estimate is anchored to the measured 64-entity benchmark; ~10s and ~900
    # source tokens per avoided grep+read round-trip.
    try:
        save = os.path.expanduser("~/.claude/sem-savings.json")
        rt_per = {"impact": 8, "context": 4, "orient": 5, "diff": 3,
                  "blame": 3, "log": 3, "entities": 2, "xref": 4}
        rt = rt_per.get(short, 2)
        life = {"rt": 0, "sec": 0, "tok": 0, "calls": 0}
        try:
            life.update(json.load(open(save)))
        except Exception:
            pass
        life["rt"] += rt
        life["sec"] += rt * 10
        life["tok"] += rt * 900
        life["calls"] += 1
        json.dump(life, open(save, "w"))
    except Exception:
        pass


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agent-skill/badge/sem-live.py`
```
#!/usr/bin/env python3
"""sem-live — a live ASCII blast-radius graph that redraws whenever sem runs.

Run it in a spare terminal pane:

    python3 ~/.claude/sem-live.py

It tails ~/.claude/sem-activity.jsonl (written by the sem PostToolUse hook) and,
each time a new `impact`/`context` call lands, reconstructs that entity's
dependency graph and draws it as an ASCII tree. Other sem ops update the live
activity feed + sparkline at the bottom. Ctrl-C to quit.

Pass --once to render a single frame and exit (used for testing).
"""
import json
import os
import shutil
import subprocess
import sys
import time

ACT = os.path.expanduser("~/.claude/sem-activity.jsonl")

# ANSI
R = "\033[0m"
B = "\033[1m"
DIM = "\033[2m"
GRN = "\033[32m"
CYN = "\033[36m"
MAG = "\033[35m"
YEL = "\033[33m"
RED = "\033[31m"
CLEAR = "\033[2J\033[H"
HIDE = "\033[?25l"
SHOW = "\033[?25h"
SPARK = "▁▂▃▄▅▆▇█"


def sem_bin():
    for cand in (os.environ.get("SEM_BIN"),
                 os.path.expanduser("~/sem/crates/target/release/sem"),
                 shutil.which("sem")):
        if cand and os.path.exists(cand):
            return cand
    return "sem"


SEM = sem_bin()


def read_events():
    events = []
    cutoff = time.time() - 3 * 3600
    if os.path.exists(ACT):
        with open(ACT) as f:
            for line in f:
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                if e.get("ts", 0) >= cutoff:
                    events.append(e)
    return events[-60:]


def spark(vals):
    if not vals:
        return ""
    lo, hi = min(vals), max(vals)
    rng = (hi - lo) or 1
    return "".join(SPARK[min(len(SPARK) - 1, int((v - lo) / rng * (len(SPARK) - 1)))] for v in vals)


SAVE = os.path.expanduser("~/.claude/sem-savings.json")

# Savings model, anchored to the measured 64-entity closure benchmark:
# grep+read took 17 round-trips / 180s / 35.7k tokens; sem took 2 / 27s / 21.5k.
# So a big structural query saves ~15 round-trips; each round-trip is ~one LLM
# inference cycle (~10s) and ~900 tokens of source an agent would otherwise read.
# Everything is labelled "≈" — these are honest estimates, not precise counts.
RT_PER_TOOL = {"impact": 8, "context": 4, "orient": 5, "diff": 3,
               "blame": 3, "log": 3, "entities": 2, "xref": 4}
SEC_PER_RT = 10
TOK_PER_RT = 900


def rt_saved(tool, total=None):
    if tool == "impact" and total:
        return max(2, round(total * 15 / 64))  # scale to the measured benchmark
    return RT_PER_TOOL.get(tool, 2)


def fmt_time(sec):
    sec = int(sec)
    if sec < 90:
        return f"{sec}s"
    if sec < 3600:
        return f"{sec // 60}m"
    return f"{sec // 3600}h {(sec % 3600) // 60}m"


def fmt_num(n):
    n = int(n)
    if n >= 1000:
        return f"{n / 1000:.1f}k".replace(".0k", "k")
    return str(n)


def update_lifetime(events):
    """Read the persisted lifetime tally. The PostToolUse hook is the single writer
    (it bumps this on every sem call), so the viewer only reads — that keeps the
    lifetime counter growing from real usage even when the viewer isn't open, and
    avoids double-counting."""
    try:
        return json.load(open(SAVE))
    except Exception:
        return {"rt": 0, "sec": 0, "tok": 0, "calls": 0}


_graph_cache = {}


def fetch_graph(ev):
    """Run sem impact for the event's target and return (direct, total, entity, file)."""
    target = ev.get("target")
    if not target:
        return None
    key = (ev.get("cwd", ""), target, ev.get("file", ""))
    if key in _graph_cache:
        return _graph_cache[key]
    cmd = [SEM, "impact", target, "--depth", "0", "--json"]
    if ev.get("file"):
        cmd += ["--file", ev["file"]]
    cwd = ev.get("cwd") or None
    try:
        out = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=8).stdout
        d = json.loads(out)
    except Exception:
        _graph_cache[key] = None
        return None
    direct = [(x.get("name", "?"), x.get("file", "")) for x in d.get("dependents", [])]
    total = d.get("impact", {}).get("total", len(direct))
    ent = d.get("entity", target)
    if isinstance(ent, dict):
        ent = ent.get("name", target)
    file = d.get("file", ev.get("file", ""))
    if isinstance(file, dict):
        file = file.get("file", ev.get("file", ""))
    res = (direct, total, ent, file)
    _graph_cache[key] = res
    return res


def shorten(path, width=34):
    if len(path) <= width:
        return path
    parts = path.split("/")
    out = parts[-1]
    for p in reversed(parts[:-1]):
        if len(out) + len(p) + 1 > width:
            return "…/" + out
        out = p + "/" + out
    return out


def is_test(name, file):
    # Rust test fns are often long behaviour-describing snake_case names with no
    # `test_` prefix, so also treat a many-underscore name as a test for display
    # ranking — this keeps real callers (run_diff_pipeline, sem_diff) on top.
    return (name.startswith("test_") or name.startswith("test")
            or "/tests/" in file or file.endswith("_test.rs")
            or name.count("_") >= 4)


def render(events, width):
    lines = []
    clock = time.strftime("%H:%M:%S")
    head = f"{GRN}{B}⊕ sem live{R}  {DIM}watching {os.path.basename(ACT)}{R}"
    lines.append(head + " " * max(1, width - 26 - len(clock)) + f"{DIM}{clock}{R}")
    lines.append(DIM + "═" * width + R)

    if not events:
        lines.append("")
        lines.append(f"  {DIM}idle — run sem in the other pane and this lights up{R}")
        return "\n".join(lines)

    last = events[-1]
    tool = last.get("tool", "sem")
    target = last.get("target", "")
    ms = last.get("ms")
    ms_s = f"  {YEL}{ms}ms{R}" if isinstance(ms, (int, float)) else ""
    op = f"{CYN}{B}{tool}{R} {CYN}{target}{R}" if target else f"{CYN}{B}{tool}{R}"
    lines.append("")
    lines.append(f"  {op}{ms_s}")

    # Draw the blast radius of the most recent ANALYZABLE event (impact or
    # context with a real target), even when later diffs/logs came after it —
    # otherwise the graph flickers out every time an unrelated command runs.
    def analyzable(e):
        return e.get("tool") in ("impact", "context") and e.get("target")

    graph_ev = next((e for e in reversed(events) if analyzable(e)), None)
    graph = fetch_graph(graph_ev) if graph_ev else None
    if graph and graph_ev is not last:
        t = graph_ev.get("tool", "")
        lines.append(f"  {DIM}last analyzed · {t} {graph_ev.get('target','')}{R}")
    if graph:
        direct, total, entity, file = graph
        lines.append(f"  {DIM}{'─' * (width - 4)}{R}")
        lines.append(f"  {GRN}{B}◉ {entity}{R}   {DIM}{shorten(file)}{R}")
        if not direct:
            lines.append(f"  {DIM}╰── no callers — nothing in this repo depends on it{R}")
        else:
            lines.append(f"  {DIM}│{R}  {YEL}{len(direct)} direct{R} {DIM}→{R} {YEL}{total} transitive{R}")
        # non-test first, so the meaningful callers are on top
        ordered = sorted(direct, key=lambda x: (is_test(x[0], x[1]), x[0]))
        shown = ordered[:9]
        tests = sum(1 for n, f in ordered if is_test(n, f))
        for i, (name, f) in enumerate(shown):
            elbow = "╰─▶" if i == len(shown) - 1 and len(ordered) <= 9 else "├─▶"
            col = DIM if is_test(name, f) else CYN
            lines.append(f"  {DIM}{elbow}{R} {col}{name}{R}"
                         + " " * max(1, 30 - len(name)) + f"{DIM}{shorten(f, 30)}{R}")
        if len(ordered) > 9:
            extra = len(ordered) - 9
            note = f"+{extra} more" + (f" ({tests} tests)" if tests else "")
            lines.append(f"  {DIM}╰─▶ … {note}{R}")
    elif graph_ev:
        lines.append(f"  {DIM}(no graph — could not resolve {graph_ev.get('target','?')} from {graph_ev.get('cwd','?')}){R}")

    # savings meter — the "you're saving so much" panel
    sess_rt = sum(rt_saved(e.get("tool")) for e in events)
    life = update_lifetime(events
```

### Core Architecture Module: `agent-skill/badge/statusline-sem.py`
```
#!/usr/bin/env python3
"""Claude Code statusline with a live sem activity badge.

Reads the session JSON on stdin (Claude Code passes it), plus the sem activity
log written by the PostToolUse hook, and renders a one-line status showing what
sem has been doing this session: how many structural queries, the last one, its
latency, and a sparkline of recent latencies. The point is to make the leverage
visible in real time, right on the frontend.
"""
import json
import os
import sys
import time

ACT = os.path.expanduser("~/.claude/sem-activity.jsonl")
SPARK = "▁▂▃▄▅▆▇█"

# ANSI
def c(code):
    return f"\033[{code}m"
RESET, GREEN, DIM, BOLD, CYAN, MAGENTA = c("0"), c("32"), c("2"), c("1"), c("36"), c("35")
YELLOW = c("33")

SAVE = os.path.expanduser("~/.claude/sem-savings.json")
# Savings model, anchored to the measured 64-entity closure benchmark (grep+read
# 17 round-trips / 180s / 35.7k tokens vs sem 2 / 27s / 21.5k). Each avoided
# round-trip is ~one LLM inference cycle (~10s) and ~900 tokens of source read.
RT_PER_TOOL = {"impact": 8, "context": 4, "orient": 5, "diff": 3,
               "blame": 3, "log": 3, "entities": 2, "xref": 4}

def rt_saved(tool):
    return RT_PER_TOOL.get(tool, 2)

def fmt_time(sec):
    sec = int(sec)
    if sec < 90:
        return f"{sec}s"
    if sec < 3600:
        return f"{sec // 60}m"
    return f"{sec // 3600}h{(sec % 3600) // 60}m"

def fmt_num(n):
    n = int(n)
    return f"{n / 1000:.1f}k".replace(".0k", "k") if n >= 1000 else str(n)

def read_lifetime():
    try:
        return json.load(open(SAVE))
    except Exception:
        return {}


TAGLINES = [
    "structural, not textual",
    "the graph, not the grep",
    "entities, not lines",
    "deterministic, not guessed",
]

def spark(latencies):
    if not latencies:
        return ""
    lo, hi = min(latencies), max(latencies)
    span = max(hi - lo, 1)
    return "".join(SPARK[min(int((v - lo) / span * (len(SPARK) - 1)), len(SPARK) - 1)] for v in latencies)

def main():
    try:
        sess = json.load(sys.stdin)
    except Exception:
        sess = {}
    session_id = sess.get("session_id") or sess.get("sessionId") or ""
    cwd = sess.get("workspace", {}).get("current_dir") or sess.get("cwd") or os.getcwd()
    model = (sess.get("model") or {}).get("display_name") or sess.get("model", "")
    dirname = os.path.basename(cwd.rstrip("/")) or "/"

    events = []
    session_events, recent_events = [], []
    cutoff = time.time() - 3 * 3600  # "recent" = last few hours
    if os.path.exists(ACT):
        with open(ACT) as f:
            for line in f:
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                if session_id and e.get("session") == session_id:
                    session_events.append(e)
                if e.get("ts", 0) >= cutoff:
                    recent_events.append(e)
    # prefer this session's activity; fall back to recent so a session-id
    # mismatch between the hook and the statusline can never strand it on "idle"
    events = (session_events or recent_events)[-40:]

    left = f"{DIM}📁 {dirname}{RESET}"
    if model:
        left += f" {DIM}· {model}{RESET}"

    if not events:
        life = read_lifetime()
        if life.get("sec"):
            badge = (f"{DIM}⊕ sem idle{RESET} {DIM}·{RESET} "
                     f"{YELLOW}≈ {fmt_time(life['sec'])} · ≈ {fmt_num(life['tok'])} tokens saved{RESET}")
        else:
            badge = f"{DIM}⊕ sem idle{RESET}"
    else:
        done = [e for e in events if e.get("phase") != "start"]
        n = len(done)
        last = events[-1]
        # In-flight: the newest event is a fresh start with no completion yet —
        # show it the moment the agent triggers sem, with a live spinner.
        in_flight = last.get("phase") == "start" and time.time() - last.get("ts", 0) < 120
        SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
        show = last if (in_flight or not done) else done[-1]
        tool_name = show.get("tool", "sem")
        tgt = show.get("target", "")
        op = f"{tool_name} {tgt}".strip() if tgt else tool_name
        ms = show.get("ms")
        ms_str = f" {ms}ms" if isinstance(ms, (int, float)) else ""
        sess_rt = sum(rt_saved(e.get("tool")) for e in done)
        saved = f"≈ {fmt_time(sess_rt * 10)} · ≈ {fmt_num(sess_rt * 900)} tokens saved"
        if in_flight:
            spin = SPIN[int(time.time() * 8) % len(SPIN)]
            badge = (
                f"{GREEN}{BOLD}⊕ sem{RESET} {YELLOW}{BOLD}{spin} {op}…{RESET}"
                + (f" {DIM}·{RESET} {YELLOW}{saved}{RESET}" if n else "")
            )
        else:
            badge = (
                f"{GREEN}{BOLD}⊕ sem{RESET} {GREEN}×{n}{RESET}"
                f" {CYAN}{op}{ms_str}{RESET}"
                f" {DIM}·{RESET} {YELLOW}{saved}{RESET}"
            )

    print(f"{left}  {badge}")

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agent-skill/guard/sem-guard.py`
```
#!/usr/bin/env python3
"""PreToolUse hard gate: the agent always uses sem for code, never grep/read/sed.

Denied (with a redirect reason the model acts on):
  - Grep on code files            -> sem_entities text=/query=, sem_impact, sem_context
  - Read of a code file           -> sem_context / sem_entities; retry lane stays open
                                     for the mechanical Read-before-Edit requirement:
                                     the SECOND Read of the same path is allowed.
  - Bash grep/rg/ag/ack on code   -> sem_entities (piped filters like `cargo test | grep` pass)
  - Bash sed/awk touching code    -> Edit tool (after sem_context)
  - Bash cat/head/tail on code    -> sem_context / sem_entities

Always allowed: non-code files (md/toml/json/yaml/...), files outside a git repo
(sem needs git), pipe filtering, and anything when SEM_GUARD=0 is set.
"""
import sys, json, re, os, time

CODE_EXTS = {
    "rs", "py", "ts", "tsx", "js", "jsx", "mjs", "cjs", "go", "java", "kt",
    "kts", "c", "h", "cpp", "hpp", "cc", "hh", "cxx", "rb", "php", "swift",
    "scala", "cs", "lua", "zig", "ex", "exs", "hs", "ml", "mli", "vue",
    "svelte", "dart", "m", "mm",
}
STATE = os.path.expanduser("~/.claude/hooks/.sem-guard-state.json")
RETRY_WINDOW = 900  # seconds a Read-deny stays retryable


def ext_of(path):
    base = os.path.basename(path or "")
    return base.rsplit(".", 1)[1].lower() if "." in base else ""


def is_code(path):
    return ext_of(path) in CODE_EXTS


def in_git_repo(path, cwd="."):
    p = os.path.expanduser(path or ".")
    if not os.path.isabs(p):
        p = os.path.join(os.path.expanduser(cwd), p)
    d = os.path.abspath(p)
    if not os.path.isdir(d):
        d = os.path.dirname(d)
    while d and d != "/":
        if os.path.exists(os.path.join(d, ".git")):
            return True
        d = os.path.dirname(d)
    return False


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def load_state():
    try:
        with open(STATE) as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(s):
    try:
        now = time.time()
        s = {k: v for k, v in s.items() if now - v < RETRY_WINDOW}
        with open(STATE, "w") as f:
            json.dump(s, f)
    except Exception:
        pass


def grep_redirect(pattern):
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{2,}", pattern or ""):
        return (
            f'"{pattern}" is a code symbol; grep on code is disabled. Use:\n'
            f"  - mcp__sem__sem_context entity_name=\"{pattern}\" (body + callers/callees, one call)\n"
            f"  - mcp__sem__sem_impact (blast radius)\n"
            f"  - mcp__sem__sem_entities query=\"...\" (find by intent)"
        )
    return (
        "grep on code files is disabled. Use mcp__sem__sem_entities with "
        f"text=\"{pattern}\" (exact substring, entity-addressed hits) or query=\"...\" "
        "(intent search). For regex, pass a distinctive literal chunk as text=. "
        "If you are genuinely searching non-code files, re-run scoped to them "
        "(e.g. glob *.md)."
    )


def handle_grep(inp, cwd):
    glob = inp.get("glob") or ""
    path = inp.get("path") or ""
    if glob and not is_code(glob):
        return  # explicitly scoped to non-code
    if path and os.path.isfile(os.path.expanduser(path)) and not is_code(path):
        return
    ftype = inp.get("type") or ""
    if ftype and ftype not in CODE_EXTS:
        return
    if not in_git_repo(path or ".", cwd):
        return
    deny(grep_redirect(inp.get("pattern") or ""))


def handle_read(inp):
    fp = inp.get("file_path") or ""
    if not is_code(fp) or not in_git_repo(fp):
        return
    state = load_state()
    key = os.path.abspath(os.path.expanduser(fp))
    if key in state and time.time() - state[key] < RETRY_WINDOW:
        # Active editing window: the retry proved edit intent, so keep this
        # path readable (refreshed on each read) instead of re-denying every
        # Read while the file is being worked on.
        state[key] = time.time()
        save_state(state)
        return
    state[key] = time.time()
    save_state(state)
    deny(
        f"Reading {os.path.basename(fp)} directly is disabled. To understand code use "
        f"mcp__sem__sem_context (entity_name, one call, body + callers) or "
        f"mcp__sem__sem_entities (path=\"{fp}\") to list what's inside. "
        f"ONLY if you are about to Edit this exact file (Edit requires a prior Read): "
        f"call Read again with the same path and it will be allowed."
    )


SEARCHERS = {"grep", "egrep", "fgrep", "rg", "ag", "ack"}
READERS = {"cat", "head", "tail", "less", "more"}


SEPARATORS = {"|", "||", "&&", ";", ";;", "&"}


def split_segments(tokens):
    """Returns (separator_before, tokens) pairs; first segment has sep None."""
    segs, cur, sep = [], [], None
    for t in tokens:
        if t in SEPARATORS:
            if cur:
                segs.append((sep, cur))
            cur, sep = [], t
        else:
            cur.append(t)
    if cur:
        segs.append((sep, cur))
    return segs


def seg_cmd(seg):
    for t in seg:
        if "=" in t and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", t):
            continue  # env assignment prefix
        if t in {"sudo", "command", "nice", "time"}:
            continue
        return t
    return ""


def code_file_args(seg, cwd):
    return [t for t in seg[1:] if not t.startswith("-") and is_code(t)
            and in_git_repo(t, cwd)]


def handle_bash(inp, cwd):
    cmd = inp.get("command") or ""
    if "SEM_GUARD=0" in cmd:
        return
    import shlex
    # Analyze line by line: a newline is a command separator, and gluing
    # lines together would misattribute one line's file args to another
    # line's command.
    segs = []
    for line in cmd.splitlines():
        try:
            lex = shlex.shlex(line, posix=True, punctuation_chars=True)
            lex.whitespace_split = True
            tokens = list(lex)
        except Exception:
            continue  # unlexable line (e.g. heredoc fragment): skip it
        segs.extend(split_segments(tokens))
    for sep, seg in segs:
        c = os.path.basename(seg_cmd(seg))
        if c in SEARCHERS:
            if sep == "|":
                continue  # filtering piped output is fine
            REDIR = {">", "<", ">>", "<<", "&>", ">&"}
            args = [
                t for t in seg[1:]
                if not t.startswith("-") and t not in REDIR
                and not t.isdigit() and not t.startswith("/dev/")
            ]
            file_args = args[1:] if args else []
            if file_args and all(not is_code(a) and ext_of(a) for a in file_args):
                continue  # explicitly non-code targets
            target = file_args[0] if file_args else "."
            if not in_git_repo(target, cwd):
                continue
            deny(grep_redirect(args[0] if args else ""))
        elif c in {"sed", "awk"} and code_file_args(seg, cwd):
            deny(
                "sed/awk on code files is disabled. To modify code use the Edit tool "
                "(after mcp__sem__sem_context to understand it); to extract code use "
                "mcp__sem__sem_context or mcp__sem__sem_entities."
            )
        elif c in READERS and code_file_args(seg, cwd):
            deny(
                "Dumping code files via cat/head/tail is disabled. Use "
                "mcp__sem__sem_context (entity body + callers in one call) or "
                "mcp__sem__sem_entities (path=...) instead."
            )


def main():
    data = json.load(sys.stdin)
    if os.environ.get("SEM_GUARD") == "0":
        return
    # Session-wide kill switch: hooks inherit the parent process env, so a
    # mid-session `export SEM_GUARD=0
```

### Core Architecture Module: `agent-skill/install.mjs`
```
#!/usr/bin/env node
// One-command setup of sem for coding agents: installs the sem skill and
// registers the sem MCP server so the agent uses sem for code intelligence.
//
//   npx @ataraxy-labs/sem-skill
//
// Idempotent: safe to re-run (it overwrites the skill and skips an already
// registered MCP server).

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const log = (m) => process.stdout.write(`${m}\n`);
const wantBadge = process.argv.slice(2).includes('--badge');
const wantGuard = process.argv.slice(2).includes('--guard');

function loadSettings(settingsPath) {
  let settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    } catch {
      settings = {};
    }
    try {
      copyFileSync(settingsPath, `${settingsPath}.bak-${Date.now()}`);
    } catch {}
  }
  return settings;
}

// Opt-in: the sem guard. A PreToolUse hook that hard-denies grep/read/sed on
// code files and redirects the agent to the sem MCP tools instead, so sem is
// the code path, not a suggestion. Read stays available for edits (the second
// Read of the same file passes) and non-code files are never touched.
// Escape hatch: SEM_GUARD=0.
function installGuard() {
  const claudeDir = join(homedir(), '.claude');
  const hooksDir = join(claudeDir, 'hooks');
  const guardDest = join(hooksDir, 'sem-guard.py');
  try {
    mkdirSync(hooksDir, { recursive: true });
    copyFileSync(join(here, 'guard', 'sem-guard.py'), guardDest);
    log(`  [ok] installed sem guard -> ${guardDest}`);
  } catch (e) {
    log(`  [!]  could not install guard script: ${e.message}`);
    return;
  }

  const settingsPath = join(claudeDir, 'settings.json');
  const settings = loadSettings(settingsPath);
  settings.hooks = settings.hooks || {};
  const pre = (settings.hooks.PreToolUse = settings.hooks.PreToolUse || []);
  const hasGuard = pre.some((e) =>
    (e.hooks || []).some((h) => (h.command || '').includes('sem-guard.py')),
  );
  if (!hasGuard) {
    for (const matcher of ['Grep|Read', 'Bash']) {
      pre.push({
        matcher,
        hooks: [{ type: 'command', command: `python3 ${guardDest}` }],
      });
    }
  }
  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    log('  [ok] guard registered: grep/read/sed on code now redirect to sem');
    log('       (pre-edit Reads still pass; disable anytime with SEM_GUARD=0)');
  } catch (e) {
    log(`  [!]  could not write settings.json: ${e.message}`);
  }
}

// Opt-in: a live sem activity badge in the Claude Code statusline, fed by a
// PostToolUse hook that logs each sem MCP call. Only runs with --badge, backs
// up settings, and never overwrites a statusline you already have.
function installBadge() {
  const claudeDir = join(homedir(), '.claude');
  const hooksDir = join(claudeDir, 'hooks');
  const slDest = join(claudeDir, 'statusline-sem.py');
  const hookDest = join(hooksDir, 'sem-activity.py');
  const liveDest = join(claudeDir, 'sem-live.py');
  try {
    mkdirSync(hooksDir, { recursive: true });
    copyFileSync(join(here, 'badge', 'statusline-sem.py'), slDest);
    copyFileSync(join(here, 'badge', 'sem-activity.py'), hookDest);
    copyFileSync(join(here, 'badge', 'sem-live.py'), liveDest);
    log(`  [ok] installed sem badge + live viewer -> ${claudeDir}`);
  } catch (e) {
    log(`  [!]  could not install badge scripts: ${e.message}`);
    return;
  }

  const settingsPath = join(claudeDir, 'settings.json');
  const settings = loadSettings(settingsPath);

  // PostToolUse hook: non-destructive, append only if not already present.
  settings.hooks = settings.hooks || {};
  const post = (settings.hooks.PostToolUse = settings.hooks.PostToolUse || []);
  const hasHook = post.some((e) =>
    (e.hooks || []).some((h) => (h.command || '').includes('sem-activity.py')),
  );
  if (!hasHook) {
    // sem is used two ways: the MCP tools and the CLI through Bash. Register
    // both so the badge lights up whichever path the agent takes.
    for (const matcher of ['mcp__sem__.*', 'Bash']) {
      post.push({
        matcher,
        hooks: [{ type: 'command', command: `python3 ${hookDest}` }],
      });
    }
  }

  // PreToolUse: fires the moment the agent TRIGGERS sem, so the statusline
  // flips to a live spinner before the call even completes.
  const pre = (settings.hooks.PreToolUse = settings.hooks.PreToolUse || []);
  const hasPre = pre.some((e) =>
    (e.hooks || []).some((h) => (h.command || '').includes('sem-activity.py')),
  );
  if (!hasPre) {
    for (const matcher of ['mcp__sem__.*', 'Bash']) {
      pre.push({
        matcher,
        hooks: [{ type: 'command', command: `python3 ${hookDest}` }],
      });
    }
  }

  // statusLine: destructive slot, so only set it if you have none (or it is
  // already ours). Otherwise leave yours alone and print how to add the badge.
  const slCmd = `python3 ${slDest}`;
  const existingSl = settings.statusLine && settings.statusLine.command;
  if (!existingSl || existingSl.includes('statusline-sem.py')) {
    settings.statusLine = { type: 'command', command: slCmd };
    log('  [ok] enabled the live sem statusline badge');
  } else {
    log('  [i]  you already have a statusline; leaving it untouched.');
    log(`       to add the sem badge, set your statusline to: ${slCmd}`);
  }

  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    log('  [ok] updated ~/.claude/settings.json (backup saved)');
  } catch (e) {
    log(`  [!]  could not write settings.json: ${e.message}`);
  }

  log('');
  log('  live blast-radius graph + savings meter — run in a spare terminal pane:');
  log(`    python3 ${liveDest}`);
}

function has(cmd) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

log('\nSetting up sem for your coding agent...\n');

// 1. sem binary check (the skill + MCP both need it).
if (has('sem')) {
  log('  [ok] sem CLI found on PATH');
} else {
  log('  [!]  sem CLI not found on PATH.');
  log('       Install it first:  npm i -g @ataraxy-labs/sem   (or see');
  log('       https://github.com/Ataraxy-Labs/sem#install). Continuing setup;');
  log('       the skill and MCP server will work once sem is installed.');
}

// 2. Install the skill so the agent knows when and how to use sem.
const skillDir = join(homedir(), '.claude', 'skills', 'sem');
try {
  mkdirSync(skillDir, { recursive: true });
  copyFileSync(join(here, 'SKILL.md'), join(skillDir, 'SKILL.md'));
  log(`  [ok] installed sem skill -> ${join(skillDir, 'SKILL.md')}`);
} catch (e) {
  log(`  [!]  could not install skill: ${e.message}`);
}

// 3. Register the sem MCP server (user scope, available in every project).
if (has('claude')) {
  try {
    const existing = execFileSync('claude', ['mcp', 'list'], {
      encoding: 'utf8',
    });
    if (/^sem[:\s]/m.test(existing)) {
      log('  [ok] sem MCP server already registered');
    } else {
      execFileSync('claude', ['mcp', 'add', '-s', 'user', 'sem', '--', 'sem', 'mcp'], {
        stdio: 'ignore',
      });
      log('  [ok] registered sem MCP server (user scope)');
    }
  } catch (e) {
    log(`  [!]  could not register MCP server automatically: ${e.message}`);
    log('       Run manually:  claude mcp add -s user sem -- sem mcp');
  }
} else {
  log('  [i]  claude CLI not found; to enable the MCP tools run:');
  log('       claude mcp add -s user sem -- sem mcp');
}

// 4. Optional: the live sem statusline badge.
if (wantBadge) {
  log('');
  installBadge();
} else {
  log('');
  log('  [i]  optional: a live sem activity badge for your statusline');
  log('      
```

### Core Architecture Module: `bench/agent-accuracy.py`
```
#!/usr/bin/env python3
"""Agent accuracy benchmark: sem diff (structured JSON) vs git diff (raw line diff).

Sends identical questions to Claude about code changes, using sem diff output vs
git diff output as context. Scores responses against ground truth extracted from
sem diff JSON.

Usage:
    export ANTHROPIC_API_KEY=...
    python bench/agent-accuracy.py

Dependencies: anthropic
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("Install the Anthropic SDK: pip install anthropic")
    sys.exit(1)

# ── Config ──────────────────────────────────────────────────────────────────

MODEL = "claude-sonnet-4-5-20250929"
TEMPERATURE = 0
MAX_GIT_DIFF_BYTES = 100_000
SEM_BINARY = str(Path(__file__).resolve().parent.parent / "crates" / "target" / "release" / "sem")
REPO_DIR = str(Path(__file__).resolve().parent.parent)

COMMITS = [
    {"sha": "9f7f1c7", "label": "7 new commands (11 files)"},
    {"sha": "fffb38f", "label": "Speed optimization (mixed ops)"},
    {"sha": "ae576ab", "label": "Rust rewrite (large)"},
]

QUESTIONS = [
    {
        "id": "q1_added_functions",
        "text": "List all functions that were ADDED (not modified) in this diff. Return a JSON object: {\"functions\": [\"name1\", \"name2\", ...]}. Only include function names, not methods or other entity types. Return ONLY the JSON, no explanation.",
        "type": "set_f1",
    },
    {
        "id": "q2_files_with_modified",
        "text": "List all files that contain at least one MODIFIED (not added or deleted) entity. Return a JSON object: {\"files\": [\"path/to/file1\", ...]}. Return ONLY the JSON, no explanation.",
        "type": "set_f1",
    },
    {
        "id": "q3_entity_type_counts",
        "text": "Count the number of changed entities grouped by entity type (e.g. function, class, interface, etc). Return a JSON object: {\"counts\": {\"function\": 5, \"class\": 2, ...}}. Return ONLY the JSON, no explanation.",
        "type": "dict_accuracy",
    },
    {
        "id": "q4_change_type_counts",
        "text": "Count the total number of added, modified, and deleted entities in this diff. Return a JSON object: {\"added\": N, \"modified\": N, \"deleted\": N}. Return ONLY the JSON, no explanation.",
        "type": "exact_match",
    },
]

# ── Helpers ──────────────────────────────────────────────────────────────────


def run(cmd: list[str], cwd: str = REPO_DIR) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    if result.returncode != 0:
        print(f"  Command failed: {' '.join(cmd)}", file=sys.stderr)
        print(f"  stderr: {result.stderr[:500]}", file=sys.stderr)
    return result.stdout


def get_sem_diff_json(sha: str) -> dict:
    raw = run([SEM_BINARY, "diff", "--commit", sha, "--format", "json"])
    return json.loads(raw)


def get_git_diff(sha: str) -> str:
    diff = run(["git", "diff", f"{sha}~1", sha])
    if len(diff) > MAX_GIT_DIFF_BYTES:
        diff = diff[:MAX_GIT_DIFF_BYTES] + f"\n\n... [truncated at {MAX_GIT_DIFF_BYTES // 1000}KB] ..."
    return diff


def strip_content(sem_json: dict) -> dict:
    """Remove beforeContent/afterContent for a fairer comparison — tests structure, not passthrough."""
    stripped = {"changes": [], "summary": sem_json.get("summary", {})}
    for change in sem_json["changes"]:
        c = {k: v for k, v in change.items() if k not in ("beforeContent", "afterContent")}
        stripped["changes"].append(c)
    return stripped


def extract_ground_truth(sem_json: dict, question_id: str):
    changes = sem_json["changes"]

    if question_id == "q1_added_functions":
        return sorted(set(
            c["entityName"] for c in changes
            if c["changeType"] == "added" and c["entityType"] == "function"
        ))

    if question_id == "q2_files_with_modified":
        return sorted(set(
            c["filePath"] for c in changes
            if c["changeType"] == "modified"
        ))

    if question_id == "q3_entity_type_counts":
        counts: dict[str, int] = {}
        for c in changes:
            t = c["entityType"]
            counts[t] = counts.get(t, 0) + 1
        return counts

    if question_id == "q4_change_type_counts":
        result = {"added": 0, "modified": 0, "deleted": 0}
        for c in changes:
            ct = c["changeType"]
            if ct in result:
                result[ct] += 1
        return result

    return None


# ── Scoring ──────────────────────────────────────────────────────────────────


def score_set_f1(predicted: list, truth: list) -> dict:
    pred_set = set(predicted)
    truth_set = set(truth)
    if not truth_set:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0} if not pred_set else {"precision": 0.0, "recall": 1.0, "f1": 0.0}
    tp = len(pred_set & truth_set)
    precision = tp / len(pred_set) if pred_set else 0.0
    recall = tp / len(truth_set) if truth_set else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}


def score_dict_accuracy(predicted: dict, truth: dict) -> dict:
    all_keys = set(list(predicted.keys()) + list(truth.keys()))
    if not all_keys:
        return {"accuracy": 1.0, "per_type": {}}
    per_type = {}
    total_acc = 0.0
    for k in all_keys:
        p = predicted.get(k, 0)
        t = truth.get(k, 0)
        max_val = max(abs(p), abs(t), 1)
        acc = 1.0 - abs(p - t) / max_val
        per_type[k] = round(acc, 4)
        total_acc += acc
    avg = total_acc / len(all_keys)
    return {"accuracy": round(avg, 4), "per_type": per_type}


def score_exact_match(predicted: dict, truth: dict) -> dict:
    fields = ["added", "modified", "deleted"]
    matches = sum(1 for f in fields if predicted.get(f) == truth.get(f))
    return {
        "score": round(matches / len(fields), 4),
        "fields": {f: predicted.get(f) == truth.get(f) for f in fields},
        "predicted": {f: predicted.get(f) for f in fields},
        "truth": {f: truth.get(f) for f in fields},
    }


def score(question_type: str, predicted, truth) -> dict:
    if question_type == "set_f1":
        return score_set_f1(predicted, truth)
    if question_type == "dict_accuracy":
        return score_dict_accuracy(predicted, truth)
    if question_type == "exact_match":
        return score_exact_match(predicted, truth)
    return {}


# ── API ──────────────────────────────────────────────────────────────────────


def ask_claude(client: anthropic.Anthropic, context: str, question: str) -> str:
    resp = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        temperature=TEMPERATURE,
        messages=[
            {
                "role": "user",
                "content": f"Here is a diff of code changes:\n\n{context}\n\n{question}",
            }
        ],
    )
    return resp.content[0].text


def parse_response(raw: str, question_id: str):
    """Extract the JSON from Claude's response."""
    # Try to find JSON in the response
    text = raw.strip()
    # Strip markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                data = json.loads(text[start:end])
            except json.JSONDecodeError:
                return None
        else:
            return None

    if question_id == "q1_added_functions":
        return data.get("functions", [])
    if question_id == "q2_files_with_modified":
        return data.get("files", [])
    if question_id == "q3_entity_type_counts":
        r
```

### Core Architecture Module: `benchmarks/dependency-accuracy/project/api.py`
```
"""Name collisions and aliased imports."""

from project.core import validate as core_validate
from project.core import transform


def validate(request):
    """Local validate that shadows the import name."""
    return request is not None


def handle_request(request):
    """Uses the aliased import (core_validate) and local validate."""
    if validate(request):
        return core_validate(request["data"])
    return None


def handle_transform(data):
    """Uses cross-file import directly."""
    return transform(data)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #498** (2026-09-30): **fix(pi): preserve valid read results in partial query batches**
  *Symptoms*: Preserve valid siblings in read-only query batches when a path is rejected, and return malformed selectors as per-item errors. Partial snapshots expose file errors and remain distinct from complete snapshots. Strict capture and edit checks remain unchanged.  Validation: 8 focused tests pass, including the real Sem parser, partial batches, snapshot identity, and strict-capture regression checks. Server syntax check passes. No end-to-end speedup is claimed; the Ant Design development replay is separate.

- **Issue #497** (2026-09-27): **Copilot CLI: Failed to connect to MCP server "sem"**
  *Symptoms*: With recent versions of Copilot CLI I'm now getting this:  > Failed to connect to MCP server "sem": MCP server process exited before completing the MCP initialize handshake (exit code 1); last stderr: error: expect initialized request, but received: Some(Requ…. Execute '/mcp show sem' to inspect or check the logs.  ---  Upgrading RMCP seems to resolve the issue.  
  **Post-Mortem & Fix Analysis**:
  > Fixed on main in 59cf209a6b5c429991f51b06294f2cf228dad47b.  Reproduced with Copilot CLI 1.0.88 and SEM 0.25.0: Copilot sends server/discover before initialize, and RMCP 1.6.0 exits when that request reaches its initialization gate. SEM now returns JSON-RPC Method not found (-32601) for unsupported extension requests without closing the connection, allowing Copilot to fall back to initialize. This is a targeted transport compatibility fix; no RMCP major-version upgrade is required.  Verified Copilot connects directly to the fixed binary in standalone and strict shared modes (no wrapper). Standalone Copilot lists all 13 tools. All 97 MCP unit tests and 11 protocol integration tests pass, including discovery fallback followed by a real tool call. Shared lifecycle checks also pass, including discovery fallback in both modes, 8 concurrent clients, and restart recovery.  This is fixed in source on main, not yet a published release. Please try a build from main and reconnect Copilot; ensure a

- **Issue #496** (2026-09-25): **pi: keep only the simple structural session policy**
  *Symptoms*: Removes `pi/config/transaction.mjs` and `pi/config/adaptive-transaction.mjs`, leaving `config/simple-transaction.mjs` as the single structural session policy.  - No code or tests referenced the removed configs. - The pi README now documents the simple policy as the transaction-mode setup, including its tools (`sem_plan`, `sem_exact`, `weave_transaction`, `weave_program`). - Changelog entry under Unreleased.

- **Issue #495** (2026-09-25): **feat(pi): add opt-in simple structural session policy**
  *Symptoms*: ## Summary - Package the tested simple session adapter as an opt-in policy; leave the default protocol unchanged. - Include batched exact reads, acknowledged context reuse, scoped edit composition and stale-snapshot guards. - Document setup, validation limits and the single-pair PlantUML result without claiming universal speedups.  ## Validation - 52 policy tests passed with SEM 0.25.0. - 13 Python validation-helper tests passed. - 11 existing Weave and transaction integration tests passed. - Typecheck passed.  The new policy remains experimental and opt-in.

- **Issue #494** (2026-09-24): **docs: record lazy indexed name freshness fix**
  *Symptoms*: Adds the required Unreleased changelog entry for #493. No code changes.

- **Issue #493** (2026-09-24): **fix: resolve renamed definitions without eager graph refresh**
  *Symptoms*: Fix indexed name lookup missing renamed or newly added definitions in existing files. Check indexed file freshness and re-extract only changed files for definition queries; do not rebuild dependency topology. Adds repeated-edit, duplicate-name, TypeScript, Python and Rust coverage. Validation: 25 CLI integration tests passed across index_membership, callers_cli, graph_json and multi_query_cli. This is a targeted correctness fix enabling lazy lookup, not a claim of full incremental graph maintenance or end-to-end session speedup.

- **Issue #492** (2026-09-22): **fix: Dart dependency graphs and cross-language caller isolation**
  *Symptoms*: ## Summary Fixes #491.  - Resolve real Dart call expressions, declaration scopes, constructor-bound locals and typed parameters, including new/const construction. - Filter typed/static member candidates by language family; prefer imported/local class owners. Preserve JS/TS interoperability. - Invalidate persisted graph/query caches so upgrades do not retain the old edges. - Add eight core regression tests and cold/warm CLI callers/refs coverage. Replace the old test that expected zero Dart call edges.  ## Validation - Local core/CLI unit and integration suites: 1,115 passing tests across 44 suites. - Final Dart fixture rerun: all eight tests pass. - Core doc-test target passes (zero doctests). - Tests ran with GIT_CONFIG_GLOBAL=/dev/null and GIT_CONFIG_NOSYSTEM=1 to prevent the locally configured external Git diff wrapper from corrupting patch-input fixtures. No machine settings changed. - CI is pending; merge is gated on the latest head and passing checks.  ## Boundaries This fixes the reported extraction and mixed-language collision bugs, not complete Dart semantic resolution. Dart import aliases, package URIs, dynamic dispatch and incremental resolution reuse require separate work. Dart remains conservatively ineligible for incremental edge reuse.
  **Post-Mortem & Fix Analysis**:
  > Temporarily reopening to refresh a stale PR head: the branch points to 1a9686ad4c64de49e3b9cd809fdea302bdc67e0f, while the PR ref is still f5da7edb8f999921f85af5fb0d284cd7db37d7cd. The latest commits include the required changelog entry and a fixture correction. No merge until checks cover the current head.
  > Refreshing the stale PR head after the final explicit-this regression fix. Final local validation: 1,115 core/CLI tests pass, including eight focused core regressions and cold/warm CLI coverage. The branch is now 2c427f2; CI must evaluate that head.

- **Issue #491** (2026-09-22): **Dart: entities parse but the dependency graph has zero edges (impact/callers/refs silently empty)**
  *Symptoms*: ## Summary  Dart entity extraction works, but Dart produces **zero dependency-graph edges**. `sem entities` and `sem diff`/`blame`/`log` are correct; `sem graph`, `impact`, `callers` and `refs` all behave as though the file had no references in it. Because `sem impact` answers `✓ No other entities are affected by changes to this entity`, the failure is silent and reads as a positive result — an agent or a human takes it as clearance to refactor.  ## Repro  One repo, the same two-file shape in Dart and TypeScript:  ``` dart/greeter.dart   class Greeter { String hello(String name) => 'hello $name'; } dart/app.dart       import 'greeter.dart';  void run() { final g = Greeter(); print(g.hello('world')); } ts/greeter.ts       export class Greeter { hello(name: string): string { return `hello ${name}`; } } ts/app.ts           import { Greeter } from './greeter';  export function run(): void { const g = new Greeter(); console.log(g.hello('world')); } ```  `sem entities .` is symmetric — all four files parse, same entity kinds:  ```   dart/app.dart        function run (L3:6)   dart/greeter.dart    class Greeter (L1:3) / method hello (L2:2)   ts/app.ts            function run (L3:6)   ts/greeter.ts        class Greeter (L1:3) / method hello (L2:2) ```  `sem graph` is not:  ``` ⊕ 6 entities, 2 edges ```  Both edges come from the TypeScript pair. Dart contributes none:  ``` $ sem impact --entity-id 'dart/greeter.dart::class::Greeter' ⊕ class Greeter (dart/greeter.dart:1–3)   ✓ No other 

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

### Incident Patch 1: `e830de88` (2026-09-30)
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
+         Object.values(selector)
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

### Incident Patch 2: `59cf209a` (2026-09-27)
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

### Incident Patch 3: `a260f75a` (2026-09-27)
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

---

### Incident Patch 4: `5dd2afec` (2026-09-24)
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

### Incident Patch 5: `c5d253a2` (2026-09-24)
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

---

### Incident Patch 6: `d0883209` (2026-09-22)
**Commit Message**: fix: Dart dependency graphs and cross-language caller isolation (#492)

## Summary
Fixes #491.

- Resolve real Dart call expressions, declaration scopes,
constructor-bound locals and typed parameters, including new/const
construction.
- Filter typed/static member candidates by language family; prefer
imported/local class owners. Preserve JS/TS interoperability.
- Invalidate persisted graph/query caches so upgrades do not retain the
old edges.
- Add eight core regression tests and cold/warm CLI callers/refs
coverage. Replace the old test that expected zero Dart call edges.

## Validation
- Local core/CLI unit and integration suites: 1,115 passing tests across
44 suites.
- Final Dart fixture rerun: all eight tests pass.
- Core doc-test target passes (zero doctests).
- Tests ran with GIT_CONFIG_GLOBAL=/dev/null and GIT_CONFIG_NOSYSTEM=1
to prevent the locally configured external Git diff wrapper from
corrupting patch-input fixtures. No machine settings changed.
- CI is pending; merge is gated on the latest head and passing checks.

## Boundaries
This fixes the reported extraction and mixed-language collision bugs,
not complete Dart semantic resolution. Dart import aliases, package
URI

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ All notable changes to sem are documented in this file.
 
 ### Fixed
 
+- **Dart dependency graphs now resolve ordinary calls, constructor-bound receivers and typed parameters.** Callers and refs no longer select a same-named Dart method for a TypeScript receiver (or vice versa); imported class owners take precedence. Persisted graph/query caches are invalidated so upgrades rebuild the affected edges. Fixes #491.
 - **Shared MCP clients keep independent context history and stay bound to their repository.** Concurrent daemon startup is serialized with an OS lock, stale sockets recover after crashes, and handshakes are bounded. Adds `sem mcp --status` for health checks and reproducible lifecycle coverage on macOS and Linux.
 - **Telemetry uploads are no longer rejected by the server.** 0.21.0 removed the install id from the upload payload while the ingest endpoint still required one, so every batch uploaded since then was refused and active-install counts only ever reflected 0.20.0 and older. Uploads now carry `hash(local seed + day number)`, where the seed is generated once, stays on the machine and is never sent, so a batch groups with the rest of that machine's day and with nothing before or after it. Telemetry is still local-by-default and opt-in, so this only changes the contents of an upload that someone enabled with `sem telemetry on`.
 - **`sem setup` no longer reports success when part of it failed.** It writes the global `diff.external` config first, then installs the Claude Code hook and the pre-commit hook, and those two steps used to treat a permissions or JSON failure as a warning before falling through to a closing message that listed all three features as live and returned success. An unparseable `~/.claude/settings.json` therefore left changed git config, no hook, and a final line reading "sem is wired in". The closing summary is now built from the steps that actually ran, and a failed step reports what did and did not apply before exiting 2. The successful path is unchanged. Thanks to kantorcodes1 on Reddit for the report.
```

**File**: `crates/sem-cli/tests/dart_graph_cli.rs` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+use serde_json::Value;
+use std::{fs, process::Command};
+
+#[test]
+fn dart_callers_and_refs_stay_language_local_on_cold_and_warm_index() {
+    let repo = tempfile::tempdir().unwrap();
+    for (path, content) in [
+        ("dart/greeter.dart", "class Greeter {\n String hello(String name) => name;\n}\n"),
+        ("dart/app.dart", "import 'greeter.dart';\nvoid run() {\n final g = Greeter();\n print(g.hello('world'));\n}\n"),
+        ("ts/greeter.ts", "export class Greeter { hello(name: string) { return name; } }"),
+        ("ts/app.ts", "import { Greeter } from './greeter';\nexport function run() { const g = new Greeter(); g.hello('world'); }"),
+    ] {
+        let dest = repo.path().join(path);
+        fs::create_dir_all(dest.parent().unwrap()).unwrap();
+        fs::write(dest, content).unwrap();
+    }
+    let run = |args: &[&str]| {
+        let output = Command::new(env!("CARGO_BIN_EXE_sem"))
+            .current_dir(repo.path())
+            .env("SEM_LOCAL", "1")
+            .env("DO_NOT_TRACK", "1")
+            .args(args)
+            .output()
+            .unwrap();
+        assert!(
+            output.status.success(),
+            "{}",
+            String::from_utf8_lossy(&output.stderr)
+        );
+        serde_json::from_slice::<Value>(&output.stdout).unwrap()
+    };
+    // First invocation builds the graph; subsequent queries reuse its index.
+    for _ in 0..2 {
+        for (target, caller) in [
+            ("dart/greeter.dart", "dart/app.dart"),
+            ("ts/greeter.ts", "ts/app.ts"),
+        ] {
+            let rows = run(&["callers", "hello", "--file", target, "--json"]);
+            let related = rows[0]["related"].as_array().unwrap();
+            assert_eq!(related.len(), 1, "{rows}");
+            assert_eq!(related[0]["file"], caller, "{rows}");
+        }
+        let rows = run(&["refs", "run", "--file", "dart/app.dart", "--json"]);
+        let related = rows[0]["related"].as_array().unwrap();
+        assert!(related.iter().any(|e| e["name"] == "Greeter"), "{rows}");
+        assert!(related.iter().any(|e| e["name"] == "hello"), "{rows}");
+        assert!(
+            related.iter().all(|e| e["file"] == "dart/greeter.dart"),
+            "{rows}"
+        );
+    }
+}
```

**File**: `crates/sem-core/src/parser/facts_store.rs` (modified, +4/-1)
```diff
@@ -205,7 +205,10 @@ macro_rules! maybe_par_iter {
 /// the coarse-but-correct fix: it clean-misses the whole corpus (code-plugin
 /// entries included, even though their producer didn't change) rather than
 /// inventing a new per-non-code-plugin salt table for a one-time fix.
-pub const FACTS_SCHEMA_VERSION: u32 = 4;
+/// 4 -> 5: Dart call/scope extraction and language/owner-aware member
+/// resolution changed. Invalidate persisted edges and query indexes even
+/// when source bytes and the development package version are unchanged.
+pub const FACTS_SCHEMA_VERSION: u32 = 5;
 
 const MAGIC: &[u8; 8] = b"SEMFACT1";
 
```

**File**: `crates/sem-core/src/parser/import_resolution.rs` (modified, +4/-14)
```diff
@@ -113,20 +113,10 @@ pub(crate) fn is_js_ts_file(file_path: &str) -> bool {
 ///   fixture containing a real `import` statement, not just by grep.
 /// * `.zig` (Zig) — whitelisted, not attributed: no node-kind collision;
 ///   resolves through `Table::SymbolTable` like Kotlin.
-/// * `.dart` (Dart) — **left RED, not whitelisted**: `DART_SCOPE_CONFIG` is
-///   one of the "Tier 2 (Minimal)" configs and its `call_nodes` is `&
-///   ["function_expression_body"]`, not an actual call-expression node kind
-///   — ordinary statement-body function calls (`helper();` inside a `{ }`
-///   block) are never even reached by `collect_all_file_refs`'s call-node
-///   branch, only expression-bodied arrow functions (`() => helper()`) are.
-///   The oracle fixture below (ordinary block-bodied functions, the normal
-///   Dart style) confirms this empirically: zero `Calls` edges appear
-/// between its hub and its callers even after, so there is
-///   nothing here for GREEN eligibility to be unsound *about* — but nothing
-///   to gain either. This is a real, narrower entity/ref-extraction gap in
-/// Dart (not scope-resolution eligibility), out of this change's scope to
-///   fix, surfaced here rather than silently routed around by writing
-///   arrow-bodied Dart just to make eligibility look proven.
+/// * `.dart` (Dart) — left RED, not whitelisted. Issue #491 added real
+///   call-expression and local type-binding extraction. Incremental reuse
+///   eligibility still requires a dedicated attribution/oracle audit;
+///   fixing extraction alone is not permission to reuse cached edges.
 ///
 /// for the
 /// full per-language verdict table and why every other language stays
```

**File**: `crates/sem-core/src/parser/plugins/code/languages.rs` (modified, +14/-7)
```diff
@@ -2443,11 +2443,14 @@ static SCALA_SCOPE_CONFIG: ScopeResolveConfig = ScopeResolveConfig {
 static DART_SCOPE_CONFIG: ScopeResolveConfig = ScopeResolveConfig {
     class_scope_nodes: &["class_declaration", "mixin_declaration", "enum_declaration"],
     impl_scope_nodes: &[],
-    function_scope_nodes: &["function_signature", "method_signature"],
+    function_scope_nodes: &["function_declaration", "method_declaration"],
     class_name_field: ClassNameField::Simple("name"),
 
-    assignment_rules: &[],
-    assignment_recurse_into: &[],
+    assignment_rules: &[AssignmentRule {
+        node_kind: "local_variable_declaration",
+        strategy: AssignmentStrategy::Declarators,
+    }],
+    assignment_recurse_into: &["function_body", "block"],
 
     param_rules: &[ParamRule {
         node_kind: "formal_parameter",
@@ -2458,12 +2461,16 @@ static DART_SCOPE_CONFIG: ScopeResolveConfig = ScopeResolveConfig {
 
     return_type_field: None,
 
-    call_nodes: &["function_expression_body"],
+    call_nodes: &["call_expression"],
     call_style: CallNodeStyle::FunctionField("function"),
-    new_expr_nodes: &[],
-    new_expr_type_field: "constructor",
+    new_expr_nodes: &["new_expression", "const_object_expression"],
+    new_expr_type_field: "type",
     composite_literal_nodes: &[],
-    member_access: &[],
+    member_access: &[MemberAccess {
+        node_kind: "member_expression",
+        object_field: "object",
+        property_field: "property",
+    }],
     scoped_call_nodes: &[],
 
     self_keywords: &["this"],
```

---

### Incident Patch 7: `6b2e47e5` (2026-09-21)
**Commit Message**: Fix shared MCP session isolation and daemon startup races (#489)

Concurrent MCP clients now keep independent context history while
sharing repository caches. An OS lock serializes daemon startup and
stale socket recovery; shared connections cannot switch repositories.
Adds a real MCP health check, bounded handshakes, graceful termination,
and reproducible lifecycle tests with macOS/Linux CI. Local validation:
106 Rust tests, 12 transaction tests, and TypeScript typechecking
passed. A synthetic 41-file context benchmark measured median startup
plus retrieval of 37.2 ms standalone versus 16.4 ms shared across ten
paired samples. This is not an end-to-end agent benchmark or evidence of
token savings. Windows sharing remains unimplemented; Windows retains
standalone stdio.

**File**: `.github/workflows/shared-mcp.yml` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+name: Shared MCP lifecycle
+on:
+  pull_request:
+    paths: ['crates/sem-mcp/**', 'benchmarks/shared-mcp/**', '.github/workflows/shared-mcp.yml']
+  push:
+    branches: [main]
+    paths: ['crates/sem-mcp/**', 'benchmarks/shared-mcp/**', '.github/workflows/shared-mcp.yml']
+jobs:
+  lifecycle:
+    strategy:
+      matrix:
+        os: [ubuntu-latest, macos-latest]
+    runs-on: ${{ matrix.os }}
+    steps:
+      - uses: actions/checkout@v4
+      - uses: dtolnay/rust-toolchain@stable
+      - uses: Swatinem/rust-cache@v2
+        with:
+          workspaces: crates
+      - run: cargo build --manifest-path crates/Cargo.toml -p sem-mcp -p sem-cli
+      - run: cargo test --manifest-path crates/Cargo.toml -p sem-mcp --lib --tests
+      - run: python3 benchmarks/shared-mcp/run.py --binary crates/target/debug/sem-mcp
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ All notable changes to sem are documented in this file.
 
 ### Fixed
 
+- **Shared MCP clients keep independent context history and stay bound to their repository.** Concurrent daemon startup is serialized with an OS lock, stale sockets recover after crashes, and handshakes are bounded. Adds `sem mcp --status` for health checks and reproducible lifecycle coverage on macOS and Linux.
 - **Telemetry uploads are no longer rejected by the server.** 0.21.0 removed the install id from the upload payload while the ingest endpoint still required one, so every batch uploaded since then was refused and active-install counts only ever reflected 0.20.0 and older. Uploads now carry `hash(local seed + day number)`, where the seed is generated once, stays on the machine and is never sent, so a batch groups with the rest of that machine's day and with nothing before or after it. Telemetry is still local-by-default and opt-in, so this only changes the contents of an upload that someone enabled with `sem telemetry on`.
 - **`sem setup` no longer reports success when part of it failed.** It writes the global `diff.external` config first, then installs the Claude Code hook and the pre-commit hook, and those two steps used to treat a permissions or JSON failure as a warning before falling through to a closing message that listed all three features as live and returned success. An unparseable `~/.claude/settings.json` therefore left changed git config, no hook, and a final line reading "sem is wired in". The closing summary is now built from the steps that actually ran, and a failed step reports what did and did not apply before exiting 2. The successful path is unchanged. Thanks to kantorcodes1 on Reddit for the report.
 
```

**File**: `README.md` (modified, +4/-0)
```diff
@@ -472,6 +472,10 @@ This means sem detects renames and moves, not just additions and deletions. Stru
 
 ## Use with AI agents (MCP)
 
+On macOS and Linux, clients in the same checkout share a warm repository daemon.
+Run `sem mcp --status` to check it. See the [shared runtime contract and reproducible benchmark](docs/shared-mcp.md)
+for session isolation, fallback behavior, and current platform limits.
+
 `sem mcp` starts a [Model Context Protocol](https://modelcontextprotocol.io) server over stdin/stdout. It's not a command you run and read yourself: it's a server your coding agent launches in the background so it can ask sem questions while it works. That's the reason `mcp` lives alongside the normal commands. The agent gets 8 entity-level tools mirroring the CLI: `sem_entities`, `sem_diff`, `sem_blame`, `sem_impact`, `sem_log`, `sem_context`, `sem_find`, `sem_grep`. (If you're also using sem cloud for code review, four more tools let an agent attach to a review and answer reviewer questions in a loop: `join_review`, `wait_for_branch`, `reply_to_branch`, `list_open_branches`.)
 
 Why an agent wants these: instead of reading whole files and burning tokens, it can ask "what breaks if I change `submitOrder`" (`sem_impact`) or "give me just the context to refactor this function" (`sem_context`, which returns the function's source plus its callers and callees) and get a precise, deterministic answer from the dependency graph instead of a grep result that might miss a caller.
```

**File**: `benchmarks/shared-mcp/run.py` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+#!/usr/bin/env python3
+"""Real MCP lifecycle and transport benchmark; no model/token-speed claims.
+
+Usage: python3 benchmarks/shared-mcp/run.py --binary crates/target/debug/sem-mcp
+"""
+import argparse
+import concurrent.futures
+import json
+import os
+from pathlib import Path
+import select
+import signal
+import socket
+import statistics
+import subprocess
+import tempfile
+import time
+
+
+def read_reply(process, request_id):
+    deadline = time.monotonic() + 30
+    while time.monotonic() < deadline:
+        ready, _, _ = select.select([process.stdout], [], [], max(0, deadline - time.monotonic()))
+        if not ready:
+            break
+        line = process.stdout.readline()
+        if not line:
+            raise RuntimeError("MCP exited before response")
+        reply = json.loads(line)
+        if reply.get("id") == request_id:
+            if "error" in reply:
+                raise RuntimeError(reply)
+            return reply["result"]
+    raise TimeoutError("MCP response timed out")
+
+
+def session(binary, repo, shared):
+    env = dict(os.environ)
+    env.pop("SEM_MCP_SHARED_DAEMON", None)
+    if shared:
+        env.pop("SEM_MCP_NO_SHARED", None)
+        env["SEM_MCP_REQUIRE_SHARED"] = "1"
+    else:
+        env["SEM_MCP_NO_SHARED"] = "1"
+    env["SEM_REPO"] = str(repo)
+    start = time.perf_counter()
+    process = subprocess.Popen([str(binary)], cwd=repo, env=env,
+                               stdin=subprocess.PIPE, stdout=subprocess.PIPE,
+                               stderr=subprocess.DEVNULL)
+    def send(method, params, ident=None):
+        message = dict(jsonrpc="2.0", method=method, params=params)
+        if ident is not None:
+            message["id"] = ident
+        process.stdin.write((json.dumps(message) + "\n").encode())
+        process.stdin.flush()
+    try:
+        send("initialize", {"protocolVersion": "2025-03-26", "capabilities": {},
+                            "clientInfo": {"name": "shared-benchmark", "version": "1"}}, 1)
+        read_reply(process, 1)
+        send("notifications/initialized", {})
+        send("tools/call", {"name": "sem_context", "arguments": {
+            "entity_name": "target_fn", "token_budget": 2000}}, 2)
+        result = read_reply(process, 2)
+        content = "\n".join(item.get("text", "") for item in result["content"])
+        assert not result.get("isError"), content
+        assert "def target_fn" in content, "Another client's history suppressed context: " + content
+        return {"ms": (time.perf_counter() - start) * 1000,
+                "response_bytes": len(content.encode())}
+    finally:
+        process.stdin.close()
+        try:
+            process.wait(timeout=3)
+        except subprocess.TimeoutExpired:
+            process.kill()
+            process.wait()
+        process.stdout.close()
+
+
+def stop_daemon(repo, crash=False):
+    metadata = repo / ".git/sem/mcp-v2.json"
+    if not metadata.exists():
+        return
+    info = json.loads(metadata.read_text())
+    assert info["socket"] == str(repo / ".git/sem/mcp-v2.sock")
+    try:
+        os.kill(info["pid"], signal.SIGKILL if crash else signal.SIGTERM)
+    except ProcessLookupError:
+        pass
+    # Wait for the kernel to release the daemon's file lock.
+    time.sleep(0.1)
+
+
+def main():
+    parser = argparse.ArgumentParser()
+    parser.add_argument("--binary", type=Path, required=True)
+    parser.add_argument("--repeats", type=int, default=10)
+    args = parser.parse_args()
+    binary = args.binary.resolve()
+    with tempfile.TemporaryDirectory(prefix="sem-mcp-", dir="/tmp") as directory:
+        repo = Path(directory).resolve()
+        subprocess.run(["git", "init", "-q", str(repo)], check=True)
+        for i in range(40):
+            (repo / f"module_{i}.py").write_text("\n".join(
+                f"def function_{i}_{j}(value):\n    return value + {j}\n" for j in range(25)))
+        (repo / "target.py").write
```

**File**: `crates/sem-cli/src/main.rs` (modified, +8/-1)
```diff
@@ -435,6 +435,9 @@ enum Commands {
     Stats,
     /// Start the MCP server (stdin/stdout transport)
     Mcp {
+        /// Check shared MCP daemon health without starting it (JSON).
+        #[arg(long, conflicts_with = "resident")]
+        status: bool,
         /// Removed: used to spawn the
         /// per-repo sidecar socket. The mmap query index answers cold in
         /// 6-7ms, deleting the sidecar's reason to exist. Kept as a
@@ -949,7 +952,11 @@ fn main() {
         Some(Commands::Stats) => {
             commands::stats::run();
         }
-        Some(Commands::Mcp { resident }) => {
+        Some(Commands::Mcp { resident, status }) => {
+            if status {
+                println!("{}", sem_mcp::shared_status());
+                return;
+            }
             if resident {
                 // No-op: see the `resident` field's doc comment above.
                 return;
```

---

### Incident Patch 8: `c8f2e82b` (2026-09-21)
**Commit Message**: Fix rejected telemetry uploads and report partial `sem setup` failures (#488)

Two independent fixes in the CLI.

## Telemetry uploads have been rejected since 0.21.0

0.21.0 removed the install id from the upload payload, but the ingest
endpoint still requires one, so every batch uploaded since then comes
back rejected. The effect is that active-install counts only ever
reflected 0.20.0 and older, and they shrink as people upgrade rather
than as usage changes.

Uploads now carry `hash(local seed + day number)`. The seed is generated
once, stays on the machine and is never sent, so a batch groups with the
rest of that machine's day and with nothing before or after it.
Telemetry stays local-by-default and opt-in, so this only changes the
contents of an upload someone already enabled with `sem telemetry on`.

The server side needs the matching change to stop requiring the field,
which is in sem-cloud.

## `sem setup` claimed success while leaving a machine half configured

Setup writes the global `diff.external` config first, then installs the
Claude Code hook and the pre-commit hook. Those two steps treated a
permissions or JSON failure as a warning and fell through to the same
clos

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -4,6 +4,11 @@ All notable changes to sem are documented in this file.
 
 ## [Unreleased]
 
+### Fixed
+
+- **Telemetry uploads are no longer rejected by the server.** 0.21.0 removed the install id from the upload payload while the ingest endpoint still required one, so every batch uploaded since then was refused and active-install counts only ever reflected 0.20.0 and older. Uploads now carry `hash(local seed + day number)`, where the seed is generated once, stays on the machine and is never sent, so a batch groups with the rest of that machine's day and with nothing before or after it. Telemetry is still local-by-default and opt-in, so this only changes the contents of an upload that someone enabled with `sem telemetry on`.
+- **`sem setup` no longer reports success when part of it failed.** It writes the global `diff.external` config first, then installs the Claude Code hook and the pre-commit hook, and those two steps used to treat a permissions or JSON failure as a warning before falling through to a closing message that listed all three features as live and returned success. An unparseable `~/.claude/settings.json` therefore left changed git config, no hook, and a final line reading "sem is wired in". The closing summary is now built from the steps that actually ran, and a failed step reports what did and did not apply before exiting 2. The successful path is unchanged. Thanks to kantorcodes1 on Reddit for the report.
+
 ## [0.25.0] - 2026-09-13
 
 ### Added
```

**File**: `crates/sem-cli/src/commands/setup.rs` (modified, +71/-10)
```diff
@@ -17,6 +17,24 @@ enum Outcome {
     Warn(String),
 }
 
+impl Outcome {
+    /// The step ran into something it could not do. `Skipped` is not a failure
+    /// (the step simply did not apply here); `Warn` is.
+    fn is_warn(&self) -> bool {
+        matches!(self, Outcome::Warn(_))
+    }
+
+    fn is_done(&self) -> bool {
+        matches!(self, Outcome::Done(_))
+    }
+
+    fn note(&self) -> &str {
+        match self {
+            Outcome::Done(n) | Outcome::Skipped(n) | Outcome::Warn(n) => n,
+        }
+    }
+}
+
 /// A live braille spinner for a setup step, indented into the tree.
 fn step_spinner(label: &str) -> ProgressBar {
     let pb = ProgressBar::new_spinner();
@@ -190,18 +208,58 @@ pub fn run() -> Result<(), Box<dyn std::error::Error>> {
     finish_step(pb, "pre-commit hook", &precommit);
 
     println!();
+
+    // Step 1 already changed global git config by the time we get here, so a
+    // later failure leaves a half-configured machine. Report what is actually
+    // live rather than claiming everything is, and exit non-zero so a script
+    // can tell the difference.
+    let mut active = vec!["entity-level git diff"];
+    if hooks.is_done() {
+        active.push("Claude Code hooks");
+    }
+    if precommit.is_done() {
+        active.push("blast-radius pre-commit");
+    }
+
+    let failed: Vec<(&str, &Outcome)> = [
+        ("Claude Code hooks", &hooks),
+        ("pre-commit hook", &precommit),
+    ]
+    .into_iter()
+    .filter(|(_, outcome)| outcome.is_warn())
+    .collect();
+
+    if failed.is_empty() {
+        println!(
+            "  {} sem is wired in — {} to load it",
+            "✓".green().bold(),
+            "restart your Claude Code session".bold()
+        );
+        println!("     {} {}", "·".dimmed(), active.join(" · ").dimmed());
+        println!("     revert anytime:  {}\n", "sem unsetup".cyan());
+        return Ok(());
+    }
+
     println!(
-        "  {} sem is wired in — {} to load it",
-        "✓".green().bold(),
-        "restart your Claude Code session".bold()
-    );
-    println!(
-        "     {} Claude Code hooks · entity-level git diff · blast-radius pre-commit",
-        "·".dimmed()
+        "  {} setup incomplete — {} of 3 steps did not apply",
+        "⚠".yellow().bold(),
+        failed.len()
     );
-    println!("     revert anytime:  {}\n", "sem unsetup".cyan());
+    println!("     {} {}", "active:".dimmed(), active.join(" · "));
+    for (label, outcome) in &failed {
+        println!(
+            "     {} {label} — {}",
+            "not applied:".dimmed(),
+            outcome.note().yellow()
+        );
+    }
+    println!("\n     fix the cause and re-run  {}", "sem setup".cyan());
+    println!("     revert everything         {}\n", "sem unsetup".cyan());
 
-    Ok(())
+    // println! is block-buffered when stdout is a pipe, and process::exit runs
+    // no destructors, so flush before leaving or the report is lost.
+    let _ = std::io::Write::flush(&mut std::io::stdout());
+    std::process::exit(2);
 }
 
 /// Path to Claude Code's user settings file, where session hooks live.
@@ -417,7 +475,10 @@ mod session_hook_tests {
         let n = add_session_hooks(&mut root, "sem hook prompt-submit");
         assert_eq!(n, 1, "the prompt hook is added on a fresh config");
         assert_eq!(root["model"], "opus", "unrelated keys preserved");
-        assert_eq!(root["hooks"]["PreToolUse"][0]["hooks"][0]["command"], "echo hi");
+        assert_eq!(
+            root["hooks"]["PreToolUse"][0]["hooks"][0]["command"],
+            "echo hi"
+        );
         assert!(
             root["hooks"].get("SessionStart").is_none(),
             "no SessionStart hook is installed (mcp --resident is a dead no-op)"
```

**File**: `crates/sem-cli/src/telemetry.rs` (modified, +121/-5)
```diff
@@ -7,12 +7,15 @@
 //!   • `off` — nothing is recorded.
 //!
 //! Records only the command name, CLI version, and OS — never repo names,
-//! paths, file contents, or any identifier (there is no install ID). Switch
+//! paths, or file contents. Uploads carry an install id that is rederived every
+//! day (`hash(local seed + day number)`), so a batch can be grouped with the
+//! rest of that machine's day and with nothing before or after it. The seed
+//! never leaves the machine and the id cannot be linked across days. Switch
 //! modes with `sem telemetry on|local|off`. `SEM_NO_TELEMETRY=1`,
 //! `DO_NOT_TRACK=1`, or `SEM_NO_NETWORK=1` force the safe behavior regardless.
 
 use std::fs;
-use std::io::Write;
+use std::io::{Read, Write};
 use std::path::PathBuf;
 
 use serde::{Deserialize, Serialize};
@@ -67,6 +70,10 @@ struct TelemetryState {
     last_flush: u64,
     #[serde(default)]
     last_flush_attempt: u64,
+    /// Random, machine-local seed for the rotating install id. Never uploaded
+    /// itself — only `hash(seed + day)` is, and only in `on` mode.
+    #[serde(default)]
+    install_seed: Option<String>,
 }
 
 /// `SEM_NO_TELEMETRY` / `DO_NOT_TRACK` hard-disable recording. Dev builds never
@@ -131,6 +138,63 @@ fn now_secs() -> u64 {
         .unwrap_or(0)
 }
 
+/// Seconds in a day — the rotation period for the install id.
+const DAY_SECS: u64 = 86_400;
+
+/// A random, machine-local seed. Prefers the OS entropy source; falls back to
+/// process-specific values that differ between machines and runs.
+fn generate_seed() -> String {
+    // Exactly 16 bytes — `/dev/urandom` never reaches EOF, so reading the whole
+    // "file" would never return.
+    if let Ok(mut f) = fs::File::open("/dev/urandom") {
+        let mut buf = [0u8; 16];
+        if f.read_exact(&mut buf).is_ok() {
+            return buf.iter().map(|b| format!("{b:02x}")).collect();
+        }
+    }
+    let mut h = std::collections::hash_map::DefaultHasher::new();
+    std::hash::Hash::hash(&std::process::id(), &mut h);
+    std::hash::Hash::hash(
+        &std::time::SystemTime::now()
+            .duration_since(std::time::UNIX_EPOCH)
+            .map(|d| d.as_nanos())
+            .unwrap_or(0),
+        &mut h,
+    );
+    std::hash::Hash::hash(&std::env::current_exe().ok(), &mut h);
+    let a = std::hash::Hasher::finish(&h);
+    std::hash::Hash::hash(&a, &mut h);
+    format!("{a:016x}{:016x}", std::hash::Hasher::finish(&h))
+}
+
+/// 128 bits of `hash(seed + day)`, as 32 hex chars. `DefaultHasher::new()` is
+/// keyed with zeros (unlike `RandomState`), so the same seed and day give the
+/// same id in every process — and a different one tomorrow.
+fn install_id_for_day(seed: &str, day: u64) -> String {
+    let half = |salt: u8| -> u64 {
+        let mut h = std::collections::hash_map::DefaultHasher::new();
+        std::hash::Hash::hash(&salt, &mut h);
+        std::hash::Hash::hash(seed, &mut h);
+        std::hash::Hash::hash(&day, &mut h);
+        std::hash::Hasher::finish(&h)
+    };
+    format!("{:016x}{:016x}", half(0), half(1))
+}
+
+/// Today's install id, creating and persisting the seed on first use.
+fn current_install_id(state: &mut TelemetryState) -> String {
+    let seed = match state.install_seed.as_deref() {
+        Some(s) if !s.is_empty() => s.to_string(),
+        _ => {
+            let s = generate_seed();
+            state.install_seed = Some(s.clone());
+            save_state(state);
+            s
+        }
+    };
+    install_id_for_day(&seed, now_secs() / DAY_SECS)
+}
+
 fn load_state() -> TelemetryState {
     state_path()
         .and_then(|p| fs::read_to_string(p).ok())
@@ -262,8 +326,11 @@ pub fn flush() {
     let agent = ureq::AgentBuilder::new()
         .timeout(std::time::Duration::from_secs(FLUSH_TIMEOUT_SECS))
         .build();
-    // No install ID — just the anonymous event batch.
-    let body = serde_json::json!({ "events": events });
+    // Rotating daily install id: lets the serve
```

**File**: `crates/sem-cli/tests/setup_regressions.rs` (modified, +32/-0)
```diff
@@ -307,3 +307,35 @@ fn setup_and_unsetup_use_git_path_for_linked_worktree_hooks() {
         "unsetup from linked worktree should remove the real hook"
     );
 }
+
+/// `sem setup` changes global git config first, then installs hooks. If a hook
+/// step fails, the machine is half-configured — so setup must say so and exit
+/// non-zero instead of printing "sem is wired in".
+#[test]
+fn setup_reports_incomplete_when_claude_settings_cannot_be_parsed() {
+    let env = IsolatedEnv::new("setup-incomplete");
+    let repo = env.home.join("repo");
+    init_repo(&repo, &env);
+
+    let claude = env.home.join(".claude");
+    fs::create_dir_all(&claude).unwrap();
+    fs::write(claude.join("settings.json"), "{ not json").unwrap();
+
+    let mut command = Command::new(sem_bin());
+    command.arg("setup").current_dir(&repo);
+    env.apply(&mut command);
+    let output = assert_failure(
+        command.output().unwrap(),
+        "sem setup with an unparseable settings.json",
+    );
+
+    let text = output_text(&output);
+    assert!(text.contains("setup incomplete"), "{text}");
+    assert!(!text.contains("sem is wired in"), "{text}");
+    // What did apply is still reported, so nobody has to guess what changed.
+    assert!(text.contains("entity-level git diff"), "{text}");
+    assert!(
+        env.wrapper_path().exists(),
+        "the git diff wrapper should still be installed\n{text}"
+    );
+}
```

---

### Incident Patch 9: `7b43045a` (2026-09-13)
**Commit Message**: test(core): isolate parallel disk-cache fixtures

**File**: `crates/sem-core/src/persist/disk_cache.rs` (modified, +18/-9)
```diff
@@ -2303,11 +2303,20 @@ mod tests {
     use super::*;
 
     fn temp_repo_root(test_name: &str) -> PathBuf {
-        let root = env::temp_dir().join(format!("sem-disk-cache-test-{test_name}-{}", std::process::id()));
-        let _ = std::fs::remove_dir_all(&root);
-        std::fs::create_dir_all(&root).unwrap();
-        env::set_var("SEM_CACHE_DIR", root.join(".cache"));
-        root
+        tempfile::Builder::new()
+            .prefix(&format!("sem-disk-cache-test-{test_name}-"))
+            .tempdir()
+            .unwrap()
+            .keep()
+    }
+
+    fn open_test_cache(root: &Path) -> DiskCache {
+        // These save/load tests need isolated databases, not process-global
+        // cache discovery. Mutating SEM_CACHE_DIR let parallel tests open a
+        // database below another test's root just before it was cleaned up.
+        let conn = Connection::open(root.join("cache.db")).unwrap();
+        initialize_schema(&conn).unwrap();
+        DiskCache { conn }
     }
 
     fn write_file(path: &Path, content: &str) {
@@ -2358,7 +2367,7 @@ mod tests {
         let files = vec!["src/a.rs".to_string()];
         write_file(&root.join("src/a.rs"), "fn f() {}\n");
 
-        let cache = DiskCache::open(&root).unwrap();
+        let cache = open_test_cache(&root);
         cache
             .save(&root, &files, &empty_graph(), &[entity("a", "src/a.rs", "f")], CacheSourceScope::Default)
             .unwrap();
@@ -2394,7 +2403,7 @@ mod tests {
             entity("b-id", "src/b.ts", "b"),
         ];
 
-        let cache_a = DiskCache::open(&root_a).unwrap();
+        let cache_a = open_test_cache(&root_a);
         cache_a
             .save_with_test_dirs_precomputed(
                 &root_a,
@@ -2408,7 +2417,7 @@ mod tests {
             .unwrap();
 
         let precomputed = read_file_cache_columns(&root_b, &files);
-        let cache_b = DiskCache::open(&root_b).unwrap();
+        let cache_b = open_test_cache(&root_b);
         cache_b
             .save_with_test_dirs_precomputed(
                 &root_b,
@@ -2453,7 +2462,7 @@ mod tests {
         let root = temp_repo_root("repo-root-best-effort");
         let files = vec!["src/a.rs".to_string()];
         write_file(&root.join("src/a.rs"), "fn f() {}\n");
-        let cache = DiskCache::open(&root).unwrap();
+        let cache = open_test_cache(&root);
         cache
             .save(&root, &files, &empty_graph(), &[entity("a", "src/a.rs", "f")], CacheSourceScope::Default)
             .unwrap();
```

---

### Incident Patch 10: `ff780867` (2026-09-13)
**Commit Message**: fix(core): intern runtime graph entity identifiers (#320)

**File**: `crates/sem-cli/src/build_cache.rs` (modified, +4/-4)
```diff
@@ -478,7 +478,7 @@ mod tests {
 
     fn entity_info(id: &str, file_path: &str, name: &str) -> EntityInfo {
         EntityInfo {
-            id: id.to_string(),
+            id: (id.to_string()).into(),
             file_path: file_path.to_string(),
             entity_type: "function".to_string(),
             name: name.to_string(),
@@ -493,7 +493,7 @@ mod tests {
             .iter()
             .map(|entity| {
                 (
-                    entity.id.clone(),
+                    entity.id.clone().into(),
                     entity_info(&entity.id, &entity.file_path, &entity.name),
                 )
             })
@@ -503,8 +503,8 @@ mod tests {
 
     fn edge(from_entity: &str, to_entity: &str) -> EntityRef {
         EntityRef {
-            from_entity: from_entity.to_string(),
-            to_entity: to_entity.to_string(),
+            from_entity: (from_entity.to_string()).into(),
+            to_entity: (to_entity.to_string()).into(),
             ref_type: RefType::Calls,
         }
     }
```

**File**: `crates/sem-cli/src/commands/context.rs` (modified, +4/-4)
```diff
@@ -469,8 +469,8 @@ fn collect_subgraph(idx: &QueryIndex, at: usize) -> Option<(Vec<usize>, Vec<Enti
                 };
                 if seen_edges.insert((from_id.clone(), to_id.clone(), ref_type_key(&ref_type))) {
                     edges.push(EntityRef {
-                        from_entity: from_id,
-                        to_entity: to_id,
+                        from_entity: (from_id).into(),
+                        to_entity: (to_id).into(),
                         ref_type,
                     });
                 }
@@ -520,11 +520,11 @@ fn hydrate_contents(
             let content = std::str::from_utf8(slice).ok()?.to_string();
             let info = e.to_entity_info();
             out.push(SemanticEntity {
-                id: info.id,
+                id: info.id.into(),
                 file_path: info.file_path,
                 entity_type: info.entity_type,
                 name: info.name,
-                parent_id: info.parent_id,
+                parent_id: info.parent_id.map(Into::into),
                 content,
                 content_hash: String::new(),
                 structural_hash: None,
```

**File**: `crates/sem-cli/src/commands/entities.rs` (modified, +4/-4)
```diff
@@ -429,11 +429,11 @@ fn try_index_entities_for_dir(
                     .into_iter()
                     .map(|e| {
                         entity_info_to_entity(EntityInfo {
-                            id: e.id,
+                            id: (e.id).into(),
                             name: e.name,
                             entity_type: e.entity_type,
                             file_path: e.file_path,
-                            parent_id: e.parent_id,
+                            parent_id: e.parent_id.map(Into::into),
                             start_line: e.start_line,
                             end_line: e.end_line,
                         })
@@ -452,11 +452,11 @@ fn try_index_entities_for_dir(
 
 fn entity_info_to_entity(entity: EntityInfo) -> SemanticEntity {
     SemanticEntity {
-        id: entity.id,
+        id: entity.id.into(),
         file_path: entity.file_path,
         entity_type: entity.entity_type,
         name: entity.name,
-        parent_id: entity.parent_id,
+        parent_id: entity.parent_id.map(Into::into),
         content: String::new(),
         content_hash: String::new(),
         structural_hash: None,
```

**File**: `crates/sem-cli/src/commands/graph.rs` (modified, +2/-2)
```diff
@@ -241,8 +241,8 @@ fn write_graph_json_index(idx: &sem_core::index::QueryIndex) -> std::io::Result<
                 writer.write_all(b",")?;
             }
             let edge = EntityRef {
-                from_entity: id.clone(),
-                to_entity: target.id(),
+                from_entity: (id.clone()).into(),
+                to_entity: (target.id()).into(),
                 ref_type,
             };
             serde_json::to_writer(&mut writer, &edge).map_err(std::io::Error::other)?;
```

**File**: `crates/sem-cli/src/commands/impact.rs` (modified, +6/-6)
```diff
@@ -1274,11 +1274,11 @@ fn print_tests(
         .iter()
         .filter(|e| test_ids.contains(e.id.as_str()) && word_hit(&e.content, &entity.name))
         .map(|e| EntityInfo {
-            id: e.id.clone(),
+            id: (e.id.clone()).into(),
             name: e.name.clone(),
             entity_type: e.entity_type.clone(),
             file_path: e.file_path.clone(),
-            parent_id: e.parent_id.clone(),
+            parent_id: e.parent_id.as_ref().map(Into::into),
             start_line: e.start_line,
             end_line: e.end_line,
         })
@@ -1403,7 +1403,7 @@ fn test_impact_from_ids<'a>(
     graph
         .impact_analysis(entity_id)
         .into_iter()
-        .filter(|info| test_entity_ids.contains(&info.id))
+        .filter(|info| test_entity_ids.contains(info.id.as_str()))
         .collect()
 }
 
@@ -1555,7 +1555,7 @@ mod tests {
 
     fn entity(id: &str, file: &str, name: &str) -> EntityInfo {
         EntityInfo {
-            id: id.to_string(),
+            id: (id.to_string()).into(),
             name: name.to_string(),
             entity_type: "function".to_string(),
             file_path: file.to_string(),
@@ -1567,8 +1567,8 @@ mod tests {
 
     fn edge(from: &str, to: &str) -> EntityRef {
         EntityRef {
-            from_entity: from.to_string(),
-            to_entity: to.to_string(),
+            from_entity: (from.to_string()).into(),
+            to_entity: (to.to_string()).into(),
             ref_type: RefType::Calls,
         }
     }
```

#### Recent Merged Pull Requests:
- **PR #498** (2026-09-30): fix(pi): preserve valid read results in partial query batches (@rs545837)
- **PR #496** (2026-09-25): pi: keep only the simple structural session policy (@rs545837)
- **PR #495** (2026-09-25): feat(pi): add opt-in simple structural session policy (@rs545837)
- **PR #494** (2026-09-24): docs: record lazy indexed name freshness fix (@rs545837)
- **PR #493** (2026-09-24): fix: resolve renamed definitions without eager graph refresh (@rs545837)
- **PR #492** (2026-09-22): fix: Dart dependency graphs and cross-language caller isolation (@rs545837)
- **PR #490** (closed): feat(integrations): add Deep Agents and OCR support (@rs545837)
- **PR #489** (2026-09-21): Fix shared MCP session isolation and daemon startup races (@rs545837)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
