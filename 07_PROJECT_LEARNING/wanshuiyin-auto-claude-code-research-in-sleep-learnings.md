# Forensic Learning Record (Deep Inspection): wanshuiyin/Auto-claude-code-research-in-sleep

> **Canonical Artifact**: `07_PROJECT_LEARNING/wanshuiyin-auto-claude-code-research-in-sleep-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:31:51.983Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wanshuiyin/Auto-claude-code-research-in-sleep`
- **Description**: ARIS ⚔️ (Auto-Research-In-Sleep) — Lightweight Markdown-only skills for autonomous ML research: cross-model review loops, idea discovery, and experiment automation. No framework, no lock-in — works with Claude Code, Codex, OpenClaw, or any LLM agent.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 16857 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `aris-monitor/focus.py`
```
#!/usr/bin/env python3
"""ARIS-Monitor: the ONE non-read action -- raise the terminal that owns a session.

Everything else in ARIS-Monitor is strictly read-only. This module is the single
exception, and it is deliberately tiny and tightly scoped:

  * It runs exactly TWO external commands and NOTHING else:
      1. `ps -o tty= -p <pid>`  -- READ a pid's controlling tty (no mutation)
      2. `focus-tty.sh <tty>`   -- RAISE the owning Terminal.app / iTerm2 / tmux
                                   tab via osascript (activate / select only)
  * It NEVER kills, signals, writes, or spawns anything else. It cannot end,
    pause, resume, or modify a session -- it can only bring a window to the front.
  * focus-tty.sh is the bundled hardened raise-only shim. ARIS-Monitor ALWAYS
    runs the bundled script -- it does NOT honor a ~/.claude/focus-tty.sh
    override -- so the action's command surface stays provably bounded to this
    reviewed shim. That surface is entirely non-destructive: osascript
    (activate / select / set index), read-only tmux discovery (list-panes /
    list-clients / display-message), standard text utils (awk / sort / cut /
    grep), and a private mktemp errfile for its own stderr (removed on exit).
    It contains NO kill / signal / send-keys / session mutation.

A focus attempt is ALWAYS user-initiated (a click) and best-effort: any failure
(no tty, no matching tab, Automation permission denied, timeout) returns a
structured result and changes nothing.
"""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Optional

# ALWAYS the bundled script -- ARIS-Monitor deliberately does NOT honor a
# ~/.claude/focus-tty.sh override, so the focus action's command surface is
# provably bounded to this reviewed, raise-only shim.
_FOCUS_SCRIPT = Path(__file__).resolve().parent / "focus-tty.sh"


def _pid_tty(pid: int) -> Optional[str]:
    """READ-ONLY: the controlling tty of <pid> via `ps`. None if unknown.

    `ps -o tty=` only reads the process table; it never mutates anything.
    """
    if not pid or pid <= 0:
        return None
    try:
        out = subprocess.check_output(
            ["ps", "-o", "tty=", "-p", str(pid)],
            stderr=subprocess.DEVNULL,
            timeout=2,
        ).decode().strip()
    except Exception:
        return None
    if not out or out == "??":
        return None
    return out if out.startswith("/dev/") else f"/dev/{out}"


def focus(pid: int) -> dict:
    """Raise the terminal tab that owns <pid>. Best-effort; never destructive.

    Returns {"ok": bool, "code": int|None, "error": str}. The ONLY effect is
    raising a window -- it never kills / signals / writes anything.
    """
    tty = _pid_tty(pid)
    if not tty:
        return {"ok": False, "code": None,
                "error": "no tty for pid (session may have no terminal)"}
    script = _FOCUS_SCRIPT
    try:
        if not script.exists():
            return {"ok": False, "code": None,
                    "error": f"bundled focus-tty.sh missing at {script}"}
    except Exception:
        return {"ok": False, "code": None, "error": "focus-tty.sh not accessible"}
    # Direct exec respects the script's own shebang; fall back to bash only if the
    # +x bit was lost on an odd checkout. A blocking macOS Automation prompt is
    # bounded by the timeout; nothing here can hang the caller indefinitely.
    try:
        try:
            proc = subprocess.run([str(script), tty],
                                  capture_output=True, text=True, timeout=10)
        except PermissionError:
            proc = subprocess.run(["bash", str(script), tty],
                                  capture_output=True, text=True, timeout=10)
    except subprocess.TimeoutExpired:
        return {"ok": False, "code": None, "error": "focus timed out after 10s"}
    except Exception as e:  # noqa: BLE001 -- best-effort, never raise to the UI
        return {"ok": False, "code": None, "error": str(e)}
    return {
        "ok": proc.returncode == 0,
        "code": proc.returncode,
        "error": (proc.stderr or "").strip(),
    }

```

### Core Architecture Module: `aris-monitor/scanner.py`
```
#!/usr/bin/env python3
"""ARIS-Monitor: STRICTLY READ-ONLY session scanner / triage classifier.

This module READS files under ~/.claude only. It NEVER writes, kills, signals,
spawns, runs subprocess/tmux/ps, polls processes, or touches the network.

Authoritative needs-approval signal
------------------------------------
The core MVP signal -- "this session is blocked waiting for you to approve
something" -- comes STRAIGHT FROM the live registry file:

    ~/.claude/sessions/<pid>.json   ->   status == "waiting"

The Claude Code app itself sets status=="waiting" (with an optional
`waitingFor` string like "Bash(npm test) needs approval") while a permission
prompt is on screen, and rewrites the file the instant the user answers. So:
  * needs_approval is detected with NO transcript parsing at all, and
  * it is inherently TRANSIENT -- you must poll (every ~1-2s) to catch it;
    on a quiescent machine you will only ever see busy/idle.

We deliberately do NOT use the "unmatched trailing tool_use" transcript
heuristic for needs_approval: a bare tool_use stop while status != "waiting"
means STALLED, not pending-approval, and keying off it false-positives on
every mid-tool pause.

Liveness
--------
Liveness is inferred purely from `updatedAt` freshness. We deliberately do NOT
call os.kill(pid, 0), ps, or anything that interacts with live OS state. A
registry file untouched within LIVE_WINDOW is treated as stale and hidden.

Codex
-----
Codex is OUT OF SCOPE for needs_approval: there is no on-disk live-status file
equivalent to ~/.claude/sessions/*.json, and Codex approval prompts are never
written to the rollout JSONL. This scanner does NOT scan Codex at all. (If a
future version shows Codex it must be display-only history and must NEVER claim
needs_approval.)

Public API
----------
    scan() -> list[Session]      # classified, sorted, stale folded to a count
    summary(sessions) -> dict    # header counts for the widget

Run as a script for a GUI-less smoke test:
    python3 scanner.py           # prints the classified session list to stdout
                                 # (names + triage only; no transcript content)
"""
from __future__ import annotations

import glob
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

# ---------------------------------------------------------------------------
# Tunables (top-of-file constants only -- no config UI by design).
# ---------------------------------------------------------------------------
IDLE_THRESHOLD = 300            # seconds; "busy & fresh" => working
LIVE_WINDOW = 1800            # seconds (30 min); updatedAt older than this => stale,
                              # folded into the dim "+N stale" line (click to expand)
TRANSCRIPT_TAIL_BYTES = 262144  # 256 KiB read-only tail of the transcript
TAIL_LINES = 40               # how many trailing JSONL lines we inspect

# ---------------------------------------------------------------------------
# Paths. CLAUDE_FLOAT_HOME lets tests/demos point at a fixture tree; defaults
# to the real ~. We ONLY ever read from here.
# ---------------------------------------------------------------------------
def _home_base() -> Path:
    env = os.environ.get("CLAUDE_FLOAT_HOME")
    return Path(env).expanduser() if env else Path.home()


HOME_BASE = _home_base()
CLAUDE_HOME = HOME_BASE / ".claude"
SESSIONS_DIR = CLAUDE_HOME / "sessions"
PROJECTS_DIR = CLAUDE_HOME / "projects"

# ---------------------------------------------------------------------------
# Triage buckets. The 5 fleet buckets collapse into the 3 visible MVP buckets
# (+ a low-priority amber for stalled and a hidden stale bucket).
# The ONLY bucket the MVP must get exactly right is needs_approval, and it
# comes straight from status == "waiting" -- no transcript parse required.
# ---------------------------------------------------------------------------
NEEDS_APPROVAL = "needs_approval"    # RED   -- blocked on the user to approve
NEEDS_ATTENTION = "needs_attention"  # amber -- stalled mid-tool, may need a nudge
WORKING = "working"                  # amber -- actively running
IDLE_DONE = "idle_done"              # green -- finished / awaiting your review
STALE_HIDDEN = "stale_hidden"        # folded into a dim "+N stale" count

# Sort priority (lower = more urgent / higher in the list).
SORT_PRIORITY = {
    NEEDS_APPROVAL: 0,
    NEEDS_ATTENTION: 1,
    IDLE_DONE: 2,
    WORKING: 3,
    STALE_HIDDEN: 9,
}


@dataclass
class Info:
    stop_reason: Optional[str] = None
    last_tool: str = ""
    has_pending_background: bool = False


@dataclass
class Session:
    pid: int
    name: str
    cwd: str
    status: str            # raw status from the live JSON (busy|idle|waiting|...)
    triage: str            # one of the bucket constants above
    reason: str            # human-readable detail
    idle_seconds: int
    updated_at: int        # ms epoch from the live JSON


# ---------------------------------------------------------------------------
# Read-only helpers.
# ---------------------------------------------------------------------------
def _as_int(value, default: int = 0) -> int:
    """Coerce a possibly-malformed registry value to int -- never raises.

    Concurrent partial writes can leave a field like updatedAt=="12.5" or
    pid=="abc" mid-flush. int() would raise ValueError on those; we swallow it
    so ONE half-written field can never blank the whole scan.
    """
    try:
        return int(value)
    except Exception:
        try:
            return int(float(value))
        except Exception:
            return default


def _cwd_to_project_slug(cwd: str) -> str:
    """Mirror Claude Code's project-dir naming: / _ . all become -."""
    return cwd.replace("/", "-").replace("_", "-").replace(".", "-")


def _load_session_file(path: Path) -> Optional[dict]:
    """Read one <pid>.json. Returns None on any failure -- never raises.

    ~/.claude/sessions is mode 0700; we run as the user so reads succeed, but
    we still wrap every open() for robustness against truncated/partial writes.
    """
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return None
    # Only require a dict. We deliberately do NOT require "pid": a half-written
    # file can have status=="waiting" before pid is flushed, and dropping it
    # here would be a costly miss of the one thing we exist to surface. pid is
    # recovered from the <pid>.json filename in scan() when absent.
    if not isinstance(data, dict):
        return None
    return data


def _transcript_path(session_id: str, cwd: str) -> Optional[Path]:
    """Derive the transcript path from the sessionId + cwd slug.

    The slug derivation can collide for two distinct cwds, so we guard with
    exists() before returning a usable path.
    """
    if not session_id or not cwd:
        return None
    slug = _cwd_to_project_slug(cwd)
    p = PROJECTS_DIR / slug / f"{session_id}.jsonl"
    try:
        if p.exists():
            return p
    except Exception:
        return None
    return None


def _last_assistant_info(path: Optional[Path]) -> Optional[Info]:
    """Read-only tail of the transcript -> stop_reason / last_tool / bg flag.

    Returns None if the transcript is missing, empty, or unparseable. Reads at
    most the last TRANSCRIPT_TAIL_BYTES so even a 35k-line transcript is cheap.
    Every json.loads is wrapped: the final line may be a half-written record.
    """
    if path is None:
        return None
    try:
        if not path.exists():
            return None
        size = path.stat().st_size
        seeked = size > TRANSCRIPT_TAIL_BYTES
        with path.open("rb") as fh:
            if seeked:
                fh.seek(size - TRANSCRIPT_TAIL_BYTES)
            tail = fh.read().decode("utf-8", "replace")
    except Exception:
        return None

    lines = [ln for ln in tai
```

### Core Architecture Module: `aris-monitor/ticker.py`
```
#!/usr/bin/env python3
"""ARIS-Monitor: headless terminal ticker (fallback UI).

If Tkinter is unavailable (a minimal custom Python lacking the Tk module),
this prints the SAME 3-bucket triage to stdout on the SAME ~2s loop, driven by
the IDENTICAL read-only scanner.py -- zero new dependencies, zero detection
changes.

STRICTLY READ-ONLY: it only reads files via scanner.scan(). It NEVER writes,
kills, signals, spawns, polls processes, runs subprocess, or touches the
network. It self-loops (no `watch`, no external sleep beyond time.sleep on its
own process) and re-clears the screen each tick.

Run:
    python3 ticker.py
Stop with Ctrl-C.
"""
from __future__ import annotations

import sys
import time

import scanner

REFRESH_S = 2.0

_DOT = {
    scanner.NEEDS_APPROVAL:  "\033[91m●\033[0m",  # red
    scanner.NEEDS_ATTENTION: "\033[93m◐\033[0m",  # amber
    scanner.WORKING:         "\033[93m◐\033[0m",  # amber
    scanner.IDLE_DONE:       "\033[92m○\033[0m",  # green
}
_LABEL = {
    scanner.NEEDS_APPROVAL:  "NEEDS YOU",
    scanner.NEEDS_ATTENTION: "stalled",
    scanner.WORKING:         "working",
    scanner.IDLE_DONE:       "done",
}


def _render_once() -> None:
    sessions = scanner.scan()
    s = scanner.summary(sessions)
    visible = [x for x in sessions if x.triage != scanner.STALE_HIDDEN]

    sys.stdout.write("\033[2J\033[H")  # clear + home
    if s["needs_approval"]:
        head = f"\033[91mARIS-Monitor — ATTENTION  {s['needs_approval']} ●\033[0m"
    else:
        head = f"\033[92mARIS-Monitor — all clear  ○ 0\033[0m"
    print(head)
    print("-" * 40)

    if not visible:
        print("  no active Claude sessions")
    for x in visible:
        dot = _DOT.get(x.triage, "?")
        label = _LABEL.get(x.triage, x.triage)
        reason = f"  {x.reason}" if (x.triage == scanner.NEEDS_APPROVAL and x.reason) else ""
        print(f"  {dot} {x.name[:24]:<24} {label:<10} {scanner.fmt_age(x.idle_seconds):>5}{reason}")
    if s["stale"]:
        print(f"  +{s['stale']} stale (hidden)")
    print()
    print("(read-only · refresh 2s · Ctrl-C to quit)")
    sys.stdout.flush()


def main() -> None:
    try:
        while True:
            try:
                _render_once()
            except Exception:
                pass  # a bad scan must never kill the ticker
            time.sleep(REFRESH_S)
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `aris-monitor/widget.py`
```
#!/usr/bin/env python3
"""ARIS-Monitor: a tiny, native, always-on-top FLOATING macOS widget.

Pure Python stdlib Tkinter -- zero pip installs. It shows, at a glance, which
of your running Claude Code sessions need your attention -- primarily
"needs approval / pending permission" -- plus a simple working / done status.

No browser. No Chrome extension. No Electron.

READ-ONLY MONITORING, with ONE explicit non-read action: clicking a session row
raises (focuses) that session's terminal window. That focus path -- and only that
path -- runs `ps` (to read the pid's tty) and the raise-only `focus-tty.sh`
(osascript activate/select), via the tightly-scoped focus.py module. It is
user-initiated, best-effort, and NEVER kills, signals, writes, or otherwise
modifies any session or process. Reading files via scanner.scan() and closing
this app's own window are the only other effects.

Run it yourself:
    python3 widget.py

Quit: click the × in the header, or press 'q' / Esc while it is focused.

Always-on-top floating behaviour (macOS):
  * root.overrideredirect(True)        -> borderless (no title bar)
  * root.attributes("-topmost", True)  -> floats above normal windows
  * root.attributes("-alpha", 0.96)    -> slight transparency (overlay feel)
  * the header strip is a manual drag handle (overrideredirect removes the OS
    title bar, so dragging is implemented here with <Button-1>/<B1-Motion>)

Known macOS caveats of overrideredirect windows (acceptable for an MVP glance):
  * absent from Mission Control, not Cmd-Tab-able;
  * can sit below a true-fullscreen app's Space;
  * utilitarian look (no native rounded corners / vibrancy).
"""
from __future__ import annotations

import sys
import threading
import tkinter as tk
import tkinter.font as tkfont

import focus
import scanner

# ---------------------------------------------------------------------------
# Tunables (top-of-file constants only -- no config UI by design).
# ---------------------------------------------------------------------------
REFRESH_MS = 2000          # re-scan files every 2s (pure stat()+tail read)
WIDTH = 320
MAX_VISIBLE = 5            # show at most this many rows; fold the rest behind "+N more"
                          # (needs-approval rows are NEVER folded -- the cap stretches)

# Appearance.
BG = "#11151c"             # panel background (dark)
HEADER_BG = "#0a0d12"
HEADER_RED = "#2a0f12"     # header background when something needs you
FG = "#c9d4e0"
DIM = "#5b6675"
RED = "#ff5c5c"
AMBER = "#f5c451"
GREEN = "#56d364"

# triage bucket -> (dot color, text color, glyph, short label)
STYLE = {
    scanner.NEEDS_APPROVAL:  (RED,   "#ffd7d7", "●", "NEEDS YOU"),   # ● filled
    scanner.NEEDS_ATTENTION: (AMBER, "#f1e3bf", "◐", "stalled"),     # ◐ half
    scanner.WORKING:         (AMBER, "#f1e3bf", "◐", "working"),     # ◐ half
    scanner.IDLE_DONE:       (GREEN, "#bfe6c4", "○", "done"),        # ○ hollow
    scanner.STALE_HIDDEN:    (DIM,   DIM,       "·", "stale"),       # · dim (expanded)
}


class FloatWidget:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("ARIS-Monitor")
        self.root.configure(bg=BG)

        # --- borderless + always-on-top floating panel ---
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        # macOS: a plain overrideredirect window is NOT a floating-class window,
        # so the WindowServer hides it the moment this app loses focus (you click
        # another app and the panel vanishes). The "floating" + "noActivates"
        # MacWindowStyle makes it a true HUD/utility panel that stays visible when
        # the app is in the background and never steals focus on click. Best-effort
        # (Tk-internal API; wrapped so a future Tk that drops it can't break us).
        try:
            self.root.tk.call("::tk::unsupported::MacWindowStyle", "style",
                              self.root._w, "floating", "noActivates")
        except tk.TclError:
            pass
        try:
            self.root.attributes("-alpha", 0.96)
        except tk.TclError:
            pass

        # position: top-right corner by default.
        # Tk geometry must be "WxH+X+Y" or position-only "+X+Y". The earlier
        # "{WIDTH}+X+Y" form omitted the "xHEIGHT" and was rejected by Tk
        # ("bad geometry specifier"), crashing the launch. We position only and
        # let the panel auto-size to its content; minsize keeps a sensible floor.
        sw = self.root.winfo_screenwidth()
        x = max(0, sw - WIDTH - 24)
        self.root.geometry(f"+{x}+48")
        try:
            self.root.minsize(WIDTH, 1)
        except tk.TclError:
            pass

        self._mono = tkfont.Font(family="Menlo", size=11)
        self._mono_b = tkfont.Font(family="Menlo", size=11, weight="bold")
        self._small = tkfont.Font(family="Menlo", size=9)

        # Shutdown bookkeeping: track the pending after() id and a stopped flag
        # so a tick already scheduled can be cancelled on quit and never fires
        # its re-arm against a torn-down interpreter.
        self._stopped = False
        self._after_id = None
        self._scanning = False   # True while a worker-thread scan is in flight
        self._show_more = False   # toggled by clicking the "+N more" overflow line
        self._last_sessions = []  # last scan, so the toggle re-renders w/o a re-scan

        self._build_header()
        self.body = tk.Frame(self.root, bg=BG)
        self.body.pack(fill="both", expand=True, padx=8, pady=(2, 8))

        # keyboard quit (only inert state change in the whole app)
        self.root.bind("<q>", lambda e: self._quit())
        self.root.bind("<Escape>", lambda e: self._quit())

        self._rows = []
        self.tick()

    def _quit(self):
        """Clean shutdown: cancel any pending tick, then destroy our window.

        The ONLY state change is closing this app's own window -- it never
        signals/kills/spawns anything else.
        """
        self._stopped = True
        if self._after_id is not None:
            try:
                self.root.after_cancel(self._after_id)
            except Exception:
                pass
            self._after_id = None
        try:
            self.root.destroy()
        except Exception:
            pass

    # ----- header (drag handle + title + count + close) ----------------------
    def _build_header(self):
        self.header = tk.Frame(self.root, bg=HEADER_BG)
        self.header.pack(fill="x")

        self.title_lbl = tk.Label(self.header, text="  ARIS-Monitor", bg=HEADER_BG,
                                  fg=FG, font=self._mono_b, anchor="w")
        self.title_lbl.pack(side="left", pady=4)

        close = tk.Label(self.header, text="× ", bg=HEADER_BG, fg=DIM,
                         font=self._mono_b, cursor="hand2")
        close.pack(side="right")
        close.bind("<Button-1>", lambda e: self._quit())

        self.count_lbl = tk.Label(self.header, text="", bg=HEADER_BG, fg=RED,
                                  font=self._mono_b)
        self.count_lbl.pack(side="right", padx=(0, 6))

        # whole header is a drag handle (overrideredirect removes the OS bar)
        for w in (self.header, self.title_lbl):
            w.bind("<Button-1>", self._start_drag)
            w.bind("<B1-Motion>", self._on_drag)

    def _start_drag(self, e):
        self._dx, self._dy = e.x, e.y

    def _on_drag(self, e):
        x = self.root.winfo_pointerx() - self._dx
        y = self.root.winfo_pointery() - self._dy
        self.root.geometry(f"+{x}+{y}")

    # ----- render ------------------------------------------------------------
    def _clear_body(self):
        for w in self._rows:
            try:
                w.destroy()
            except Exception:
                pass
        self._rows = []

    def tick(self):
        """The ~2s read-only poll loop, driven by Tk's own after() timer.

        The actual scan runs on a short-l
```

### Core Architecture Module: `mcp-servers/claude-review/server.py`
```
#!/usr/bin/env python3
"""Claude review MCP server for Codex-first ARIS workflows.

This server exposes a narrow review-only interface over Claude Code CLI so
Codex can remain the executor while Claude acts as the external reviewer.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _configure_stdio_for_mcp() -> None:
    """Re-bind sys.stdout/sys.stdin as raw binary streams for the MCP protocol.

    Called from main() rather than module import so that unit tests can
    safely `importlib.exec_module(server.py)` without globally clobbering
    the test process's text-mode stdio (which breaks subsequent print()
    calls with TypeError).
    """
    sys.stdout = os.fdopen(sys.stdout.fileno(), "wb", buffering=0)
    sys.stdin = os.fdopen(sys.stdin.fileno(), "rb", buffering=0)


SERVER_NAME = os.environ.get("CLAUDE_REVIEW_SERVER_NAME", "claude-review")
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
DEFAULT_MODEL = os.environ.get("CLAUDE_REVIEW_MODEL", "")
DEFAULT_SYSTEM = os.environ.get("CLAUDE_REVIEW_SYSTEM", "")
DEFAULT_TOOLS = os.environ.get("CLAUDE_REVIEW_TOOLS", "")
DEFAULT_TIMEOUT_SEC = int(os.environ.get("CLAUDE_REVIEW_TIMEOUT_SEC", "600"))
_default_debug_dir = os.environ.get("TEMP", "/tmp") if sys.platform == "win32" else "/tmp"
DEBUG_LOG = Path(os.environ.get("CLAUDE_REVIEW_DEBUG_LOG", f"{_default_debug_dir}/{SERVER_NAME}-mcp-debug.log"))
STATE_DIR = Path(
    os.environ.get(
        "CLAUDE_REVIEW_STATE_DIR",
        str(Path.home() / ".codex" / "state" / SERVER_NAME),
    )
)
JOBS_DIR = STATE_DIR / "jobs"

_use_ndjson = False
TERMINAL_JOB_STATES = {"completed", "failed"}


def debug_log(message: str) -> None:
    try:
        DEBUG_LOG.parent.mkdir(parents=True, exist_ok=True)
        with DEBUG_LOG.open("a", encoding="utf-8") as fh:
            fh.write(f"{message}\n")
    except OSError:
        pass


def send_response(response: dict[str, Any]) -> None:
    global _use_ndjson

    payload = json.dumps(response, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    debug_log(f"SEND {payload.decode('utf-8', errors='replace')}")
    if _use_ndjson:
        sys.stdout.write(payload + b"\n")
    else:
        header = f"Content-Length: {len(payload)}\r\n\r\n".encode("utf-8")
        sys.stdout.write(header + payload)
    sys.stdout.flush()


def read_message() -> dict[str, Any] | None:
    global _use_ndjson

    line = sys.stdin.readline()
    if not line:
        return None

    line_text = line.decode("utf-8").rstrip("\r\n")
    if line_text.lower().startswith("content-length:"):
        try:
            content_length = int(line_text.split(":", 1)[1].strip())
        except ValueError:
            return None

        while True:
            header_line = sys.stdin.readline()
            if not header_line:
                return None
            if header_line in {b"\r\n", b"\n"}:
                break

        body = sys.stdin.read(content_length)
        try:
            return json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            return None

    if line_text.startswith("{") or line_text.startswith("["):
        _use_ndjson = True
        try:
            return json.loads(line_text)
        except json.JSONDecodeError:
            return None

    return None


def find_claude_bin() -> str | None:
    if Path(CLAUDE_BIN).is_file():
        return CLAUDE_BIN
    return shutil.which(CLAUDE_BIN)


def parse_claude_json(raw_stdout: str) -> tuple[dict[str, Any] | None, str | None]:
    stripped = raw_stdout.strip()
    if not stripped:
        return None, "Claude CLI returned empty output"

    # CLI 2.x: try whole stdout as a single JSON value first.
    # Handles both compact one-line arrays and pretty-printed multi-line arrays.
    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError:
        payload = None

    if isinstance(payload, dict):
        return payload, None
    if isinstance(payload, list):
        # claude CLI 2.x emits a JSON array of event objects under --output-format json
        # (system init -> assistant -> rate_limit_event -> result). Only the terminal
        # "result" event carries the fields run_claude_review consumes downstream
        # (result text, session_id, duration_ms, stop_reason). Falling back to any
        # other dict (e.g. rate_limit_event) would surface as a "successful parse"
        # producing an empty review — strictly worse than a clear error.
        for item in reversed(payload):
            if isinstance(item, dict) and item.get("type") == "result":
                return item, None
        return None, "Claude CLI returned a JSON array without a 'result' event"

    # Legacy CLI 1.x: NDJSON stream of dicts, walk lines in reverse for the
    # last useful payload. Same array-vs-dict policy as above so a CLI 2.x
    # JSON-array line surrounded by non-JSON noise (wrapper warnings, nvm/asdf
    # banners, future CLI debug prints) still surfaces the result event
    # instead of being silently dropped.
    saw_array_without_result = False
    for candidate in reversed(stripped.splitlines()):
        candidate = candidate.strip()
        if not candidate:
            continue
        try:
            line_payload = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(line_payload, dict):
            if saw_array_without_result and line_payload.get("type") != "result":
                continue
            return line_payload, None
        if isinstance(line_payload, list):
            for item in reversed(line_payload):
                if isinstance(item, dict) and item.get("type") == "result":
                    return item, None
            # fall through: this line was an array without a result event,
            # but earlier lines might still carry one — keep scanning.
            saw_array_without_result = True

    if saw_array_without_result:
        return None, "Claude CLI returned a JSON array without a 'result' event"
    return None, "Claude CLI did not return JSON output"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(path)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def job_state_path(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def is_pid_alive(pid: int | None) -> bool:
    if not pid or pid <= 0:
        return False
    if sys.platform == "win32":
        import ctypes
        kernel32 = ctypes.windll.kernel32
        SYNCHRONIZE = 0x00100000
        handle = kernel32.OpenProcess(SYNCHRONIZE, False, pid)
        if handle:
            kernel32.CloseHandle(handle)
            return True
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def serialize_job(job: dict[str, Any]) -> dict[str, Any]:
    result = job.get("result") or {}
    return {
        "jobId": job.get("jobId"),
        "status": job.get("status"),
        "done": job.get("status") in TERMINAL_JOB_STATES,
        "threadId": result.get("threadId"),
        "response": result.get("response"),
        "model": result.get("model"),
        "duration_ms": result.get("duration_ms"),
        "stop_reason": result.get("stop_reason"),
        "error": job.get("error"),
        "createdAt": job.get("createdAt"),
        "startedAt": job.get("startedAt"),
        "completedAt": job.get("completedAt"),
        "updatedAt": job.ge
```

### Core Architecture Module: `mcp-servers/codex-exec/server.py`
```
#!/usr/bin/env python3
"""codex-exec — the `codex` MCP server, implemented over `codex exec`.

codex-cli 0.154.0 removed the `codex mcp-server` entry point that every ARIS
reviewer call was registered against. This server speaks the same MCP
contract that entry point spoke — tools named `codex` and `codex-reply`,
results shaped `{threadId, content}` — and runs each call as a `codex exec`
subprocess, so the skills that invoke `mcp__codex__codex` do not change.

Register it under the same server key the skills expect:

    claude mcp add codex --scope user -- python3 /path/to/aris/mcp-servers/codex-exec/server.py

Differences from the removed entry point, all deliberate:
  * `codex` accepts prompt, model, config, sandbox, cwd. The old
    approval-policy / base-instructions / developer-instructions /
    compact-prompt arguments are not offered because `codex exec` has no
    way to honor them (ARIS never passed them).
  * `codex-reply` re-applies the model, config, sandbox and working
    directory the thread was created with — `codex exec resume` alone
    falls back to config.toml defaults and the caller's cwd, and ARIS's
    routing contract relies on a continued thread keeping its reviewer
    model and effort.
"""
from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import sys
import threading
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

SERVER_NAME = "codex-exec"
SERVER_VERSION = "1.0.0"
CODEX_BIN = os.environ.get("CODEX_BIN", "codex")
STATE_DIR = Path(os.environ.get("CODEX_EXEC_STATE_DIR", str(Path.home() / ".codex" / "state" / SERVER_NAME)))
THREADS_DIR = STATE_DIR / "threads"
PROGRESS_INTERVAL_SEC = float(os.environ.get("CODEX_EXEC_PROGRESS_INTERVAL_SEC", "15"))
DEBUG_LOG = os.environ.get("CODEX_EXEC_DEBUG_LOG", "")

SANDBOX_MODES = ["read-only", "workspace-write", "danger-full-access"]

_stdout_lock = threading.Lock()


# ─── stdio framing (same as mcp-servers/claude-review) ───────────────────────

def _configure_stdio_for_mcp() -> None:
    sys.stdout = os.fdopen(sys.stdout.fileno(), "wb", buffering=0)
    sys.stdin = os.fdopen(sys.stdin.fileno(), "rb", buffering=0)


def debug_log(message: str) -> None:
    if not DEBUG_LOG:
        return
    try:
        with open(DEBUG_LOG, "a", encoding="utf-8") as fh:
            fh.write(message + "\n")
    except OSError:
        pass


def send_message(message: Dict[str, Any]) -> None:
    payload = json.dumps(message, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    debug_log("SEND " + payload.decode("utf-8", errors="replace")[:2000])
    with _stdout_lock:
        sys.stdout.write(payload + b"\n")
        sys.stdout.flush()


def read_message() -> Optional[Dict[str, Any]]:
    """One JSON-RPC message per line (MCP stdio transport). None on EOF, {} on a blank/garbled line."""
    line = sys.stdin.readline()
    if not line:
        return None
    text = line.decode("utf-8", errors="replace").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


# ─── thread memory: what each thread was created with ────────────────────────

def thread_file(thread_id: str) -> Path:
    return THREADS_DIR / (thread_id + ".json")


def recall_thread(thread_id: str) -> Dict[str, Any]:
    try:
        with thread_file(thread_id).open(encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def remember_thread(thread_id: str, opts: Dict[str, Any]) -> None:
    # one file per thread, written once by the server that created it — two
    # host sessions running their own bridge never touch the same file
    try:
        THREADS_DIR.mkdir(parents=True, exist_ok=True)
        tmp = thread_file(thread_id + ".tmp")
        with tmp.open("w", encoding="utf-8") as fh:
            json.dump(opts, fh)
        tmp.replace(thread_file(thread_id))
    except OSError:
        pass


# ─── argv construction ───────────────────────────────────────────────────────

def toml_value(value: Any) -> str:
    """Render a JSON value as the TOML literal `codex -c key=value` expects."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ", ".join(toml_value(v) for v in value) + "]"
    raise ValueError(f"unsupported config value: {value!r}")


def config_flags(config: Optional[Dict[str, Any]], prefix: str = "") -> List[str]:
    """Flatten a config object into `-c dotted.key=value` pairs."""
    flags: List[str] = []
    for key, value in (config or {}).items():
        dotted = f"{prefix}{key}"
        if isinstance(value, dict):
            flags.extend(config_flags(value, dotted + "."))
        else:
            flags.extend(["-c", f"{dotted}={toml_value(value)}"])
    return flags


def build_argv(args: Dict[str, Any], resume_thread: Optional[str] = None) -> List[str]:
    argv = [CODEX_BIN, "exec"]
    if resume_thread:
        argv += ["resume", resume_thread]
    argv += ["--skip-git-repo-check", "--json"]
    if resume_thread:
        # `resume` has no --sandbox/--cd; the sandbox comes back through config
        # and the working directory through the subprocess cwd (see run_codex)
        if args.get("sandbox"):
            argv += ["-c", f"sandbox_mode={toml_value(str(args['sandbox']))}"]
    else:
        if args.get("cwd"):
            argv += ["--cd", str(args["cwd"])]
        if args.get("sandbox"):
            argv += ["--sandbox", str(args["sandbox"])]
    if args.get("model"):
        argv += ["-m", str(args["model"])]
    argv += config_flags(args.get("config"))
    argv.append("-")  # prompt comes on stdin: no argv length limit, no shell quoting
    return argv


# ─── running one call ────────────────────────────────────────────────────────

class CallOutcome:
    def __init__(self) -> None:
        self.thread_id: Optional[str] = None
        self.last_message: Optional[str] = None
        self.error: Optional[str] = None
        self.completed = False   # turn.completed seen
        self.failed = False      # turn.failed seen — terminal, never cleared
        self.cancelled = False


def run_codex(argv: List[str], prompt: str, request_id: Any, progress_token: Any,
              inbox: "queue.Queue[Dict[str, Any]]", deferred: List[Dict[str, Any]],
              cwd: Optional[str] = None) -> CallOutcome:
    """Run codex exec, streaming events as notifications and answering pings meanwhile."""
    outcome = CallOutcome()
    debug_log("EXEC " + " ".join(argv))
    try:
        proc = subprocess.Popen(
            argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd or None,
        )
    except OSError as exc:
        outcome.error = f"could not start {argv[0]}: {exc}"
        return outcome

    stderr_chunks: List[bytes] = []

    def drain_stderr() -> None:
        assert proc.stderr is not None
        for chunk in iter(proc.stderr.readline, b""):
            stderr_chunks.append(chunk)

    def feed_stdin() -> None:
        assert proc.stdin is not None
        try:
            proc.stdin.write(prompt.encode("utf-8"))
        except (BrokenPipeError, OSError):
            pass
        finally:
            try:
                proc.stdin.close()
            except OSError:
                pass

    stderr_thread = threading.Thread(target=drain_stderr, daemon=True)
    stderr_thread.start()
    threading.Thread(target=feed_stdin, daemon=True).start()

    started = time.monotonic()
    progress_count = 0

    def progress(kind: str) -> None:
        nonlocal progress_count
        if progress_token is None:
            return
        progress_count += 1
   
```

### Core Architecture Module: `mcp-servers/codex-image2/server.py`
```
#!/usr/bin/env python3
"""Codex app-server image bridge for Claude-first ARIS workflows.

This server exposes a narrow MCP interface that asks the local Codex desktop
app to generate an image through the app-server path. It is intentionally kept
small and dependency-free so users can copy it into `~/.claude/mcp-servers/`
and register it with Claude Code.
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import sys
import time
import traceback
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


_stdio_initialized = False


def _init_stdio() -> None:
    """Rebind stdio to raw unbuffered binary streams for MCP framing.

    Deferred into a function (called at the top of main()) so that merely
    IMPORTING this module has no stdio side effects. os.fdopen(fileno) defaults
    to closefd=True and thus seizes ownership of the fd; doing that at import
    time under a test harness that captures stdio (pytest fd-capture) closes the
    harness's capture fd and corrupts capture for every subsequent test. Real
    server launch (python server.py) still calls this first via main(), so
    runtime behavior is unchanged. Idempotent."""
    global _stdio_initialized
    if _stdio_initialized:
        return
    sys.stdout = os.fdopen(sys.stdout.fileno(), "wb", buffering=0)
    sys.stdin = os.fdopen(sys.stdin.fileno(), "rb", buffering=0)
    _stdio_initialized = True


SERVER_NAME = os.environ.get("CODEX_IMAGE2_SERVER_NAME", "codex-image2")
CODEX_BIN = os.environ.get("CODEX_IMAGE2_CODEX_BIN", "codex")
DEFAULT_TIMEOUT_SEC = int(os.environ.get("CODEX_IMAGE2_TIMEOUT_SEC", "600"))
DEFAULT_JOB_EXPIRY_GRACE_SEC = int(
    os.environ.get("CODEX_IMAGE2_JOB_EXPIRY_GRACE_SEC", "60")
)
MAX_STATUS_WAIT_SEC = int(os.environ.get("CODEX_IMAGE2_MAX_STATUS_WAIT_SEC", "30"))
DEFAULT_MODEL = os.environ.get("CODEX_IMAGE2_MODEL", "")
DEBUG_LOG_RAW = os.environ.get("CODEX_IMAGE2_DEBUG_LOG", "").strip()
DEBUG_LOG = Path(DEBUG_LOG_RAW).expanduser() if DEBUG_LOG_RAW else None
SAVE_RUN_LOGS = os.environ.get("CODEX_IMAGE2_SAVE_RUN_LOGS", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
STATE_DIR = Path(
    os.environ.get(
        "CODEX_IMAGE2_STATE_DIR",
        str(Path.home() / ".claude" / "state" / SERVER_NAME),
    )
)
JOBS_DIR = STATE_DIR / "jobs"
RUNS_DIR = STATE_DIR / "runs"

TERMINAL_JOB_STATES = {"completed", "failed"}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_use_ndjson = False


def debug_log(message: str) -> None:
    if DEBUG_LOG is None:
        return
    try:
        DEBUG_LOG.parent.mkdir(parents=True, exist_ok=True)
        with DEBUG_LOG.open("a", encoding="utf-8") as fh:
            fh.write(f"{message}\n")
    except OSError:
        pass


def send_response(response: dict[str, Any]) -> None:
    global _use_ndjson

    payload = json.dumps(response, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    debug_log(f"SEND {payload.decode('utf-8', errors='replace')}")
    if _use_ndjson:
        sys.stdout.write(payload + b"\n")
    else:
        header = f"Content-Length: {len(payload)}\r\n\r\n".encode("utf-8")
        sys.stdout.write(header + payload)
    sys.stdout.flush()


def read_message() -> dict[str, Any] | None:
    global _use_ndjson

    line = sys.stdin.readline()
    if not line:
        return None

    line_text = line.decode("utf-8").rstrip("\r\n")
    if line_text.lower().startswith("content-length:"):
        try:
            content_length = int(line_text.split(":", 1)[1].strip())
        except ValueError:
            return None

        while True:
            header_line = sys.stdin.readline()
            if not header_line:
                return None
            if header_line in {b"\r\n", b"\n"}:
                break

        body = sys.stdin.read(content_length)
        try:
            return json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            return None

    if line_text.startswith("{") or line_text.startswith("["):
        _use_ndjson = True
        try:
            return json.loads(line_text)
        except json.JSONDecodeError:
            return None

    return None


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_utc_timestamp(raw_value: Any) -> datetime | None:
    if not isinstance(raw_value, str) or not raw_value:
        return None
    try:
        return datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError:
        return None


def utc_after_seconds(seconds: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).replace(
        microsecond=0
    ).isoformat().replace("+00:00", "Z")


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(path)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def job_state_path(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def classify_worker_state(pid: int | None) -> str:
    if not pid or pid <= 0:
        return "missing"
    try:
        waited_pid, _ = os.waitpid(pid, os.WNOHANG)
    except ChildProcessError:
        try:
            os.kill(pid, 0)
        except OSError:
            return "exited"
        return "running"
    except OSError:
        return "exited"
    if waited_pid == 0:
        return "running"
    return "exited"


def find_codex_bin() -> str | None:
    if Path(CODEX_BIN).is_file():
        return CODEX_BIN
    return shutil.which(CODEX_BIN)


def normalize_string_list(raw_value: Any) -> tuple[list[str], str | None]:
    if raw_value is None:
        return [], None
    if isinstance(raw_value, str):
        candidate = raw_value.strip()
        return ([candidate] if candidate else []), None
    if not isinstance(raw_value, list):
        return [], "referenceImagePaths must be a string or an array of strings"

    values: list[str] = []
    for item in raw_value:
        if not isinstance(item, str):
            return [], "referenceImagePaths entries must be strings"
        candidate = item.strip()
        if candidate:
            values.append(candidate)
    return values, None


def resolve_cwd(raw_cwd: str | None) -> tuple[Path, str | None]:
    if raw_cwd:
        cwd = Path(raw_cwd).expanduser()
    else:
        cwd = Path.cwd()
    try:
        cwd = cwd.resolve()
    except OSError as exc:
        return cwd, f"failed to resolve cwd {raw_cwd!r}: {exc}"
    if not cwd.exists():
        return cwd, f"working directory does not exist: {cwd}"
    if not cwd.is_dir():
        return cwd, f"working directory is not a directory: {cwd}"
    return cwd, None


def resolve_output_path(raw_output_path: str | None, *, cwd: Path, job_id: str) -> Path:
    if raw_output_path:
        path = Path(raw_output_path).expanduser()
        if not path.is_absolute():
            path = cwd / path
    else:
        path = cwd / "figures" / "ai_generated" / f"codex-image2-{job_id}.png"
    return path.resolve()


def allowed_output_root(*, cwd: Path) -> Path:
    return (cwd / "figures" / "ai_generated").resolve()


def validate_output_path(output_path: Path, *, cwd: Path) -> str | None:
    root = allowed_output_root(cwd=cwd)
    try:
        output_path.relative_to(root)
    except ValueError:
        return f"outputPath must stay under {root}"
    if output_path == root:
        return f"outputPath must be a file under {root}, not the directory itself"
    return None


def parse_timeout_seconds(raw_value: Any) -> tuple[int | None, str | None]:
    if raw_value is None:
        return DEFAULT_TIMEOUT_SEC, None
    try:
        timeout_sec = int(raw_value)
    except (T
```

### Core Architecture Module: `mcp-servers/feishu-bridge/server.py`
```
#!/usr/bin/env python3
"""
Feishu Bridge Server — provides HTTP API for ARIS skills to send messages
to Feishu and poll for user replies.

Endpoints:
  POST /send   — send a card message to Feishu user, return message_id
  GET  /poll    — wait for user reply (long-poll with timeout)
  GET  /health  — health check

Requires:
  pip install lark-oapi

Environment variables:
  FEISHU_APP_ID      — Feishu app ID
  FEISHU_APP_SECRET  — Feishu app secret
  FEISHU_USER_ID     — Target user's open_id (who receives notifications)
  BRIDGE_PORT        — HTTP port (default: 5000)
"""

import os
import sys
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

try:
    import lark_oapi as lark
    from lark_oapi.api.im.v1 import (
        CreateMessageRequest, CreateMessageRequestBody,
    )
except ImportError:
    print("Error: lark-oapi not installed. Run: pip install lark-oapi", file=sys.stderr)
    sys.exit(1)

# --- Configuration ---
APP_ID = os.environ.get("FEISHU_APP_ID", "")
APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")
USER_ID = os.environ.get("FEISHU_USER_ID", "")
PORT = int(os.environ.get("BRIDGE_PORT", "5000"))

if not APP_ID or not APP_SECRET:
    print("Error: FEISHU_APP_ID and FEISHU_APP_SECRET are required", file=sys.stderr)
    sys.exit(1)

if not USER_ID:
    print("Warning: FEISHU_USER_ID not set — /send will require user_id in request body", file=sys.stderr)

# --- Lark Client ---
client = lark.Client.builder().app_id(APP_ID).app_secret(APP_SECRET).build()

# --- Reply Store (thread-safe) ---
reply_store = {}
reply_lock = threading.Lock()
reply_events = {}


def send_card(user_id: str, title: str, body: str, color: str = "blue") -> dict:
    """Send an interactive card to a Feishu user."""
    card = json.dumps({
        "header": {
            "title": {"tag": "plain_text", "content": title},
            "template": color,
        },
        "elements": [
            {"tag": "markdown", "content": body}
        ]
    })

    request = CreateMessageRequest.builder() \
        .receive_id_type("open_id") \
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(user_id)
            .msg_type("interactive")
            .content(card)
            .build()
        ).build()

    response = client.im.v1.message.create(request)

    if not response.success():
        return {"error": response.msg, "code": response.code}

    msg_id = response.data.message_id
    # Prepare reply event for this message
    with reply_lock:
        reply_events[msg_id] = threading.Event()
        reply_store[msg_id] = None

    return {"ok": True, "message_id": msg_id}


def send_text(user_id: str, text: str) -> dict:
    """Send a plain text message to a Feishu user."""
    request = CreateMessageRequest.builder() \
        .receive_id_type("open_id") \
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(user_id)
            .msg_type("text")
            .content(json.dumps({"text": text}))
            .build()
        ).build()

    response = client.im.v1.message.create(request)

    if not response.success():
        return {"error": response.msg, "code": response.code}

    return {"ok": True, "message_id": response.data.message_id}


def poll_reply(message_id: str, timeout: int = 300) -> dict:
    """Wait for a user reply to a specific message."""
    with reply_lock:
        event = reply_events.get(message_id)

    if not event:
        return {"error": "unknown message_id"}

    # Wait for reply or timeout
    got_reply = event.wait(timeout=timeout)

    with reply_lock:
        reply = reply_store.pop(message_id, None)
        reply_events.pop(message_id, None)

    if got_reply and reply:
        return {"reply": reply}
    else:
        return {"timeout": True}


def receive_reply(message_id: str, text: str):
    """Called when a user replies (webhook or external trigger)."""
    with reply_lock:
        if message_id in reply_store:
            reply_store[message_id] = text
            reply_events[message_id].set()


# --- HTTP Handler ---
class BridgeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._json_response({"status": "ok", "port": PORT})
            return

        if self.path.startswith("/poll"):
            # Parse query params
            params = {}
            if "?" in self.path:
                query = self.path.split("?", 1)[1]
                for pair in query.split("&"):
                    if "=" in pair:
                        k, v = pair.split("=", 1)
                        params[k] = v

            message_id = params.get("message_id", "")
            timeout = int(params.get("timeout", "300"))

            if not message_id:
                self._json_response({"error": "message_id required"}, 400)
                return

            result = poll_reply(message_id, timeout)
            self._json_response(result)
            return

        self._json_response({"error": "not found"}, 404)

    def do_POST(self):
        if self.path == "/send":
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            user_id = body.get("user_id", USER_ID)
            if not user_id:
                self._json_response({"error": "user_id required (set FEISHU_USER_ID or pass in body)"}, 400)
                return

            msg_type = body.get("type", "card")
            title = body.get("title", "ARIS Notification")
            content = body.get("body", body.get("content", ""))
            color = body.get("color", "blue")

            if msg_type == "text":
                result = send_text(user_id, content)
            else:
                result = send_card(user_id, title, content, color)

            self._json_response(result)
            return

        if self.path == "/reply":
            # External hook: when user replies, call this endpoint
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            message_id = body.get("message_id", "")
            text = body.get("text", "")

            if message_id:
                receive_reply(message_id, text)
                self._json_response({"ok": True})
            else:
                self._json_response({"error": "message_id required"}, 400)
            return

        self._json_response({"error": "not found"}, 404)

    def _json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        # Quiet logging
        pass


def main():
    server = HTTPServer(("0.0.0.0", PORT), BridgeHandler)
    print(f"Feishu Bridge Server running on http://0.0.0.0:{PORT}")
    print(f"  POST /send   — send card/text to Feishu")
    print(f"  GET  /poll   — wait for user reply")
    print(f"  POST /reply  — receive user reply (webhook)")
    print(f"  GET  /health — health check")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #452** (2026-09-29): **fix: use alphaXiv's canonical www host**
  *Symptoms*: ## Summary  - Point `/alphaxiv` and `/wiki-enrich` Markdown requests at `www.alphaxiv.org`, the final destination of the current bare-host redirect. - Keep both bare and `www` alphaXiv paper URLs in `/alphaxiv` input examples. - Align the Codex mirrors and the related skill catalog/source descriptions.  ## Verification  - `GET` smoke checks for the overview and full-paper Markdown of arXiv `1706.03762`: both hosts return HTTP 200 and identical byte counts; the bare host redirects to `www`. - `python3 tools/check_skills_inventory.py` — passed. - `uv run --with pytest pytest tests/test_codex_skill_mirror.py -q` — 21 passed. - `git diff --check` — passed. - An isolated Claude Code `/alphaxiv 1706.03762` invocation did not complete within 70 seconds. Even a one-turn `Reply only OK` prompt timed out; Claude Code debug logs showed repeated first-party API connection errors. The end-to-end skill invocation remains unverified for an environment reason unrelated to the alphaXiv URL.  ## Scope  This removes an unnecessary redirect and makes the documented request host match alphaXiv's canonical destination. The bare host is still working; this change does not claim to fix a reproduced fetch failure.
  **Post-Mortem & Fix Analysis**:
  > Merged, thank you — and the careful scope note is appreciated.  One thing worth knowing: this fixes more than a redirect. `/alphaxiv` uses `curl -L`, so it always followed the 301. `/wiki-enrich` uses WebFetch, which does not follow a cross-host redirect — and bare → `www` is cross-host. Its own rule says a redirect counts as a miss and falls through to the next source, so the alphaXiv tier there was most likely being skipped every time. I inferred that from the skill text rather than reproducing it, but with the canonical host the question no longer arises.

- **Issue #450** (2026-09-28): **fix(verify-papers): send SEMANTIC_SCHOLAR_API_KEY and pace S2 calls**
  *Symptoms*: ## Summary  `tools/verify_papers.py` never reads `SEMANTIC_SCHOLAR_API_KEY`. Its title layer calls S2 with no headers:  ```python url = f"{S2_API}?query={q}&limit=3&fields=title,year,externalIds" for attempt in range(2):     status, body = http_get(url, timeout=15)   # no headers ```  `tools/semantic_scholar_fetch.py` does read the env var and sends `x-api-key`, so a user who has been issued a key reasonably assumes verification uses it. It does not.  The consequence is not cosmetic. Unauthenticated callers share one S2 pool, so a keyless request gets `429` under any load; `verify_title_s2` maps that to `verify_pending`. A citation given only as a title therefore comes back "cannot tell" even when the caller holds a key — and `novelty-check`'s anti-hallucination gate (Policy D1) can then neither confirm nor refute it, which is precisely the case the gate exists for.  ## Evidence  Same query, same host, seconds apart:  ``` no key    -> HTTP 429 with key  -> 200 ```  And with the key exported, `semantic_scholar_fetch.py` returns results normally while `verify_papers.py --titles-file` still lands on `verify_pending` — the key is simply not in the request.  ## Changes  - `_s2_headers()` sends `x-api-key` when `SEMANTIC_SCHOLAR_API_KEY` is set, and stays anonymous when it is not, so keyless behaviour is unchanged. - `_s2_throttle()` keeps successive S2 calls `S2_MIN_INTERVAL_SEC = 1.05` apart. The documented limit for an issued key is **1 request per second, cumulative across all 

- **Issue #449** (2026-09-28): **Test suite rewrites the real $HOME/.aris/repo, breaking an existing install**
  *Symptoms*: Running the test suite rewrites the **real** `$HOME/.aris/repo`, repointing an existing ARIS install at whatever clone the tests ran from — or, in one case, at a pytest temp directory that is deleted on exit. After that, every skill that resolves a helper through the canonical chain in `shared-references/integration-contract.md` §2 silently loads helpers from the wrong tree, or fails once the temp directory is gone.  I hit this for real: I keep the canonical install outside the clone, ran `pytest tests/` once on a throwaway clone under `/tmp`, and a later `save_trace.sh` resolution picked up the `/tmp` clone. Nothing warned me; the skills just started resolving elsewhere.  ## Cause  `tools/install_aris.sh` writes the global pointer, by design:  ```sh GLOBAL_POINTER="$HOME/.aris/repo" ```  `tests/test_install_aris_selective.py` invokes the installer with an overridden `$HOME` and asserts on the pointer inside that sandbox — the correct pattern. Four other test modules run the same installer with **no** `HOME` override, so the write lands in the developer's real home directory.  ## Reproduce  With a sentinel in the pointer before each module, run each one alone:  ``` $ for f in test_install_aris_replace_link test_install_aris_tools_symlink \            test_codex_install_update test_copilot_install; do     echo "SENTINEL-$f" > ~/.aris/repo     python3 -m pytest tests/$f.py -q >/dev/null 2>&1     echo "$f -> $(cat ~/.aris/repo)"   done  test_install_aris_replace_link  -> /tmp/<c
  **Post-Mortem & Fix Analysis**:
  > Confirmed, and one of the six unsandboxed modules was mine. Fixed in e64c347: `tests/conftest.py` runs the whole suite under a throwaway `$HOME`, so every installer test — current and future — writes its pointer there. Checked with a sentinel in the real `~/.aris/repo` across a full run. It applies to pytest; running a module directly with `python -m unittest` does not load it. If your pointer is still wrong, `bash tools/install_aris.sh` from your canonical clone rewrites it.

- **Issue #448** (2026-09-28): **Retry budget for transient arXiv failures may be shorter than the failure window**
  *Symptoms*: Splitting this out of #447, which fixes the classification of arXiv 406 (transient, not permanent). This issue is about the retry *budget* for that class of response — a judgement call I do not think a drive-by PR should make.  ## Current behaviour  `tools/verify_papers.py`:  ```python def backoff(attempt: int) -> float:     return min(2 ** attempt + random.uniform(0, 1), 30) ```  `_verify_arxiv_batch_with_retry()` runs 3 attempts, so the worst case before a batch is split is roughly `1 + 2 + 4` seconds plus jitter — under 10 seconds of waiting. `tools/arxiv_fetch.py::_fetch_atom()` is separate and coarser: `5 * attempt` over 3 attempts, so about 15 seconds.  ## Why it may be too short  While debugging #447 I saw `export.arxiv.org` return 406 to `urllib` **consistently over several minutes** — repeated single-ID and search calls all failed in that window, while `curl` on the same URL succeeded. A ~10 second budget does not outlast a window like that, so the batch still ends up split and re-attempted, and `arxiv_fetch.py` still raises.  I have no evidence about what sets the window length, and no reproducer on demand (later the same day, 30 rapid calls all returned 200), so I cannot say what budget would be *enough*. That is exactly why this is a question rather than a patch.  ## Options, roughly in order of cost  1. Leave it. `verify_pending` is an honest answer, and callers can re-run. 2. Honour `Retry-After` when present — I never captured 406 response headers, so whether a
  **Post-Mortem & Fix Analysis**:
  > A data point on the budget question, from running the patched helper (#447) against a live throttling window today.  Verifying one nonexistent arXiv ID (`2609.99123`) three times, ~6 s apart:  ``` try: verify_pending | arxiv_verify_pending try: verify_pending | arxiv_verify_pending try: verify_pending | arxiv_verify_pending ```  Minutes later, the same call — and the same ID paired with a real one — resolved correctly:  ``` verdict: WARN  hallucination_rate: 0.5  pending_rate: 0.0   arxiv-0  unverified  arxiv_unverified      # 2609.99123, does not exist   arxiv-1  verified    -                     # 1706.03762 ```  So with 406 now classified as transient, the outcome inside a throttling window is `verify_pending` — honest, but three consecutive runs over ~20 s all failed to get an answer. The current budget (3 attempts, `2 ** attempt` plus jitter, so under ~10 s of waiting) does not outlast the window; retrying by hand minutes later does.  During the same window, a direct `http_get` to
  > Resolved a different way in e64c347, so the budget no longer has to outlast the window: when urllib gets a 406 the request is re-issued through curl, which gets 200 in exactly the windows you observed. If curl is missing or also fails, the result is `verify_pending` — and a persistent 406 no longer splits the batch, and a cached `verify_pending` is asked again instead of being reused for 30 days. Thanks for splitting this out rather than guessing a number.

- **Issue #447** (2026-09-28): **fix(tools): treat arXiv 406 as a transient rate-limit response**
  *Symptoms*: ## Summary  `tools/verify_papers.py` classifies HTTP 406 as a permanent client error, but `export.arxiv.org` returns 406 intermittently. When it does, the whole arXiv ID batch — including papers that really exist — is reported as `unverified`, which reads as a fabricated-citation signal. `novelty-check` and `research-lit` build their verdicts on that output.  `tools/arxiv_fetch.py` has the same root cause: `_fetch_atom()` retries on 429 only, so a sporadic 406 aborts the search with `RuntimeError: arXiv API fetch failed: HTTP Error 406: Not Acceptable`.  ## Reproduce (before this PR)  Run a handful of arXiv calls in quick succession, then:  ``` $ python3 tools/verify_papers.py --arxiv-ids "1706.03762,2609.99999" --cache-scope none {"verdict": "WARN", "hallucination_rate": 0.0, ...    {"id": "arxiv-0", "status": "unverified", "reason": "arxiv_unverified", ...    {"id": "arxiv-1", "status": "unverified", "reason": "arxiv_unverified", ...  $ python3 tools/arxiv_fetch.py search "provenance gate agent" --max 2 RuntimeError: arXiv API fetch failed: HTTP Error 406: Not Acceptable ```  `1706.03762` is *Attention Is All You Need*; `2609.99999` does not exist. Both come back `unverified`. Observed on Python 3.10.12 (Linux/WSL2), 2026-09-26, against `export.arxiv.org`.  ## What is established, and what is not  Established:  - A **missing** arXiv ID is not an error: the API answers `200` with `<opensearch:totalResults>0</opensearch:totalResults>`, which the existing substring check alrea

- **Issue #445** (2026-09-28): **fix(arxiv, verify-papers): handle arXiv HTTP 406; never count refusals as hallucinations**
  *Symptoms*: ## Problem  From some networks, `export.arxiv.org` answers **HTTP 406 with an empty body** to Python's `urllib`, while `requests` and `curl` succeed on the very same URL. Interleaved A/B on uncached queries (same host, same minute):  | client | 200 | 406 | |---|---|---| | urllib | 0/10 | 10/10 | | requests | 10/10 | 0/10 | | curl | 10/10 | 0/10 |  Headers, header casing, User-Agent and proxies made no difference (likely TLS-fingerprint filtering at the frontend). CDN-cached queries (`X-Cache: HIT`) succeed for any client, which makes the failure look intermittent. All ARIS arXiv helpers (`arxiv_fetch.py`, `research_wiki.py`, `verify_papers.py`) use urllib and treat 406 as fatal.  A second, more serious effect: `verify_papers.py` maps every non-transient 4xx to `unverified`. A **refusal** (arXiv 406, or Semantic Scholar 403 without an API key) is therefore reported as a *hallucinated reference*. On a real 38-paper literature set this produced `hallucination_rate = 0.47` and `high_hallucination_rate` although every paper exists. This contradicts the documented semantics (`unverified — all applicable layers ran cleanly and found no match`).  ## Changes  - **`arxiv_fetch.py`, `research_wiki.py`**: on HTTP 406, re-issue the request via `requests` (optional import) or `curl`; other 4xx behave exactly as before. `arxiv_fetcs://` (avoids a 301). - **`verify_papers.py`**   - `http_get`: same 406 fallback transport.   - Refusals (401/403/406) never become `unverified
  **Post-Mortem & Fix Analysis**:
  > Thank you — your A/B (urllib 0/10, requests 10/10, curl 10/10) is what settled this: it showed that retrying urllib cannot recover, so a second transport was the fix. It landed in e64c347 with you as co-author.  What I took: the 406 rescue through a second transport in all three tools, https for arxiv_fetch, and the rule that a refusal is never `unverified` — extended to CrossRef, which had the same problem. I kept curl only, to avoid an optional Python dependency.  What I left out, and why: the DataCite and OpenAlex layers. A miss in either is not evidence that a paper does not exist (DataCite's public API omits non-findable records), so a 404 there would put real papers back into `unverified` — the outcome this PR set out to remove. The S2 key came in through #450.  Two things found along the way that your report led to: a persistent 406 used to split the batch recursively (237 requests for 40 ids), and `verify_pending` results were cached and reused for 30 days. Both fixed in the sa

- **Issue #443** (2026-09-28): **fix(watchdog): serialize the tasks.json read-modify-write to stop losing registrations**
  *Symptoms*: Two arms registering at the same time lose one of the two tasks.  `register_task()` / `unregister_task()` read `tasks.json`, filter, and rewrite the whole file. Nothing serializes the read-modify-write, so the later writer overwrites the earlier one's entry while still printing `registered: ...`. A torn read makes it worse: the `except (json.JSONDecodeError, OSError): tasks = []` fallback rewrites the file with only the current task, unregistering every other arm on the machine.  Both paths now take an exclusive `flock` on `<base>/tasks.lock` before the read and hold it until the process exits, so writers are serialized and no writer can persist a half-written registry. The daemon stays lock-free: it only reads, and an unparseable read is already tolerated by skipping the cycle.  The lock is released when the function returns, so repeated in-process calls (`register_task` from a test or a driver script) behave exactly as before. `fcntl` is POSIX-only; where it is unavailable the previous best-effort behaviour is kept, as in `tools/run_state.py` / `tools/iteration_log.py`. The lock handle is deliberately not closed explicitly (closing would drop the flock); under `-W always` that surfaces as a ResourceWarning, say the word if you prefer an explicit `try/finally` close.  Verified on Linux (WSL, Python 3.14), 12 concurrent `--register` processes per round against one `--base-dir`:  - before: 1/12, 3/12, 4/12, 4/12, 6/12, 3/12 tasks survived (all 12 printed `registered:`) - after

- **Issue #442** (2026-09-28): **fix(auto-review-loop): xhigh is the regular tier, not "maximum reasoning depth"**
  *Symptoms*: ## What  Two wording fixes in the Codex MCP reasoning-effort policy surface. **No tier, default, or behaviour is changed.**  1. `skills/auto-review-loop/SKILL.md` — the Key Rules line described the pinned `xhigh` effort as *"for maximum reasoning depth"*. `max` and `ultra` both sit **above** `xhigh`, so the sentence is factually wrong, and it invites a future session to read the loop's tier as already maxed out (or, read the other way, to treat `max` as this loop's tier) and raise it — which `reviewer-routing.md` explicitly forbids: `ultra` adds automatic task delegation and is wrong for multi-round loops and per-item fan-outs. 2. `skills/skills-codex/auto-review-loop/SKILL.md` — mirror of the same sentence (backend here is `spawn_agent`, so it pins `reasoning_effort:` rather than `config:`). 3. `skills/shared-references/reviewer-routing.md` — the policy line listed `max` in the accepted enum and in the codex-cli version requirement without ever saying where it sits relative to the two tiers, while the tier table named only `ultra`. Now stated plainly.  The replacement text states the tier, cites the routing doc, names the deep-audit skills that own `ultra`, and records two facts a reader needs: pin both fields explicitly (never rely on `~/.codex/config.toml`), and a thread's tier cannot be changed after creation — replies inherit it.  ## Why it matters in practice  The tier is written into the thread state on the first call and `codex-reply` cannot change it, so a call-site 

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

### Incident Patch 1: `e64c3472` (2026-09-28)
**Commit Message**: fix(verify-papers): a refusal is never 'unverified'; 406 goes through curl; tests leave $HOME alone

Taken from #445: when urllib is answered HTTP 406, arxiv_fetch.py,
research_wiki.py and verify_papers.py re-issue the request through curl,
and arxiv_fetch.py talks https. export.arxiv.org refuses urllib from some
networks for minutes at a time while curl gets 200, so retrying urllib
cannot recover. The DataCite and OpenAlex layers of #445 are not taken:
a miss in either is not evidence that a paper does not exist.

verify_papers.py:
- persistent 406 returns verify_pending for the batch instead of splitting
  it recursively (237 requests for the default 40 ids)
- 401 / 403 are verify_pending in the arXiv, CrossRef and S2 layers
- a cached verify_pending is asked again rather than reused for 30 days

The helper is duplicated in the three tools on purpose: ARIS tools are
standalone scripts resolved one by one, and the ARIS-Code binary bundles
them from a whitelist.

tests/conftest.py runs the suite under a throwaway $HOME: six installer
test modules were rewriting the developer's real ~/.aris/repo (#449).

Closes #449

Co-Authored-By: ilya-pershin <35902904+ilya-pershin@users.noreply.

**File**: `README.md` (modified, +1/-0)
```diff
@@ -231,6 +231,7 @@ Two outputs: `PASTE_READY.txt` (exact char count, paste to venue) + `REBUTTAL_DR
 
 > ⚠️ Any entry that touches skills: `bash tools/smart_update.sh --apply` pulls it.
 
+- **2026-09-28** — ![FIX](https://img.shields.io/badge/FIX-2ea44f?style=flat-square) 📚 **Real papers stop being reported as hallucinated citations** ([#445](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/445), [#447](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/447), [#450](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/450); thanks [@ilya-pershin](https://github.com/ilya-pershin) and [@AfonsoZhang](https://github.com/AfonsoZhang)). arXiv sometimes refuses Python's HTTP client with a 406 for minutes while `curl` gets through; `verify_papers.py` read that refusal as "paper not found" and one user saw a 47% hallucination rate on 38 real papers. A 406 now goes through `curl`, and a refusal (406 / 401 / 403) is `verify_pending`, never `unverified`. Set `SEMANTIC_SCHOLAR_API_KEY` and title checks use it. Seen a suspicious hallucination rate recently? Re-run with `--no-cache` once. Also in this round: five skills can now actually invoke the sub-skills their text tells them to ([#440](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/440), [@Jeremy-xuan](https://github.com/Jeremy-xuan)); concurrent watchdog registrations no longer overwrite each other ([#443](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/443), [@hiro-nikaitou](https://github.com/hiro-nikaitou)); `xhigh` is described as the regular reviewer tier it is ([#442](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/442), [@dreamworld2023](https://github.com/dreamworld2023)).
 - **2026-09-16** — ![NEW](https://img.shields.io/badge/NEW-red?style=flat-square) 🧩 **ARIS is a Claude Code plugin now** ([#437](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/437), thanks [@white-drizzle](https://github.com/white-drizzle)). `claude plugin marketplace add wanshuiyin/Auto-claude-code-research-in-sleep` → `claude plugin install aris@aris` → `/aris:setup` once → restart. Setup registers the Codex reviewer bridge that ships inside the plugin, so the reviewer works on codex-cli 0.154+ out of the box. Plugin skills are typed with the prefix (`/aris:idea-discovery`); they call each other by short name internally. Codex CLI reads the same repo as a plugin too (`codex plugin marketplace add …` → `codex plugin add aris@aris`) and gets the Codex-native mirror. Cursor, Trae and DeepSeek Harness keep their own routes.
 - **2026-09-10** — ![FIX](https://img.shields.io/badge/FIX-2ea44f?style=flat-square) 🔌 **codex-cli 0.154 removed `codex mcp-server` — re-register the `codex` MCP server.** Every ARIS reviewer call went through that entry point; on 0.154+ it now opens the interactive TUI and the MCP handshake fails. ARIS ships its own stand-in, `mcp-servers/codex-exec/server.py`, same tool names and result shape, driving `codex exec` underneath — skills unchanged. Run once: `git pull` in your ARIS clone (older clones do not have the file), then `claude mcp remove codex -s user && claude mcp add codex -s user -- python3 "$HOME/aris_repo/mcp-servers/codex-exec/server.py"` (absolute path of your clone), then restart Claude Code. Step-by-step for new and existing installs in [Quick Start](#quick-start). Works on 0.153 too, so do it before you update. OpenAI's own replacement, the Claude Code plugin, has no `ultra` effort and no per-thread resume, which the deep-audit skills need. Cursor / Trae / Antigravity / Copilot CLI configs: same key, `python3` + that path — see the adaptation docs.
 <details>
```

**File**: `README_CN.md` (modified, +1/-0)
```diff
@@ -203,6 +203,7 @@ ARIS 读论文 → 找弱点 → 克隆代码 → 针对*那些*弱点用*那套
 
 > ⚠️ 凡涉及 skill 变更的条目:跑 `bash tools/smart_update.sh --apply` 拉取。
 
+- **2026-09-28** — ![FIX](https://img.shields.io/badge/FIX-2ea44f?style=flat-square) 📚 **真论文不再被报成幻觉引用**（[#445](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/445)、[#447](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/447)、[#450](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/450)；感谢 [@ilya-pershin](https://github.com/ilya-pershin) 和 [@AfonsoZhang](https://github.com/AfonsoZhang)）。arXiv 有时会连续几分钟用 406 拒绝 Python 的 HTTP 客户端，而 `curl` 能通；`verify_papers.py` 把这个拒绝当成"查无此文"，有用户在 38 篇真实论文上跑出 47% 的幻觉率。现在 406 会改走 `curl`，被拒绝（406 / 401 / 403）一律标 `verify_pending`，不再标 `unverified`。设了 `SEMANTIC_SCHOLAR_API_KEY` 的话标题核对会用上它。最近见过可疑的幻觉率？带 `--no-cache` 重跑一次。同一轮还有：五个 skill 现在真的能调用正文让它调的子 skill（[#440](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/440)，[@Jeremy-xuan](https://github.com/Jeremy-xuan)）；watchdog 并发注册不再互相覆盖（[#443](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/443)，[@hiro-nikaitou](https://github.com/hiro-nikaitou)）；`xhigh` 按实际写成审稿常规档（[#442](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/442)，[@dreamworld2023](https://github.com/dreamworld2023)）。
 - **2026-09-16** — ![NEW](https://img.shields.io/badge/NEW-red?style=flat-square) 🧩 **ARIS 现在是一个 Claude Code 插件**（[#437](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/pull/437)，感谢 [@white-drizzle](https://github.com/white-drizzle)）。`claude plugin marketplace add wanshuiyin/Auto-claude-code-research-in-sleep` → `claude plugin install aris@aris` → 跑一次 `/aris:setup` → 重启。setup 会把插件里自带的 Codex 审稿桥接注册好，codex-cli 0.154+ 上开箱即用。插件 skill 输入时带前缀（`/aris:idea-discovery`），内部互相调用不受影响。Codex CLI 也能把同一个仓库当插件装（`codex plugin marketplace add …` → `codex plugin add aris@aris`），拿到的是 Codex 原生镜像。Cursor、Trae、DeepSeek Harness 各走各的路线。
 - **2026-09-10** — ![FIX](https://img.shields.io/badge/FIX-2ea44f?style=flat-square) 🔌 **codex-cli 0.154 删掉了 `codex mcp-server`,`codex` MCP 要重新注册。** ARIS 所有审阅调用都走这个入口;0.154 起它会打开交互界面,MCP 握手直接失败。ARIS 自带了替身 `mcp-servers/codex-exec/server.py`:工具名、返回形状一模一样,底下跑 `codex exec`,skill 一行不改。跑一次:先在你的 ARIS clone 里 `git pull`(老 clone 里没有这个文件),再 `claude mcp remove codex -s user && claude mcp add codex -s user -- python3 "$HOME/aris_repo/mcp-servers/codex-exec/server.py"`(写你 clone 的绝对路径),然后重启 Claude Code。新装和已装的分步指引见 [快速开始](#quick-start)。0.153 上同样能用,升级前就可以换。OpenAI 官方给的替代是 Claude Code 插件,没有 `ultra` 档、不能按线程续聊,深审 skill 用不了。Cursor / Trae / Antigravity / Copilot CLI 的配置同一个 key,改成 `python3` + 这个路径,见各自适配文档。
 <details>
```

**File**: `tests/conftest.py` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+"""Run the whole suite under a throwaway $HOME.
+
+Several tests run the real installers, which write the global pointer
+`$HOME/.aris/repo` by design. Without this, a test run repoints a developer's
+existing ARIS install at the clone under test, or at a temp directory that is
+gone a moment later (#449). Set at import time so subprocesses inherit it.
+"""
+import atexit
+import os
+import shutil
+import tempfile
+
+_home = tempfile.mkdtemp(prefix="aris-test-home-")
+os.environ["HOME"] = _home
+os.environ["USERPROFILE"] = _home
+atexit.register(shutil.rmtree, _home, ignore_errors=True)
```

**File**: `tests/test_arxiv_fetch.py` (modified, +17/-0)
```diff
@@ -174,13 +174,30 @@ def test_search_retries_on_http_406_then_succeeds(monkeypatch):
         hdrs=None, fp=BytesIO(b""),
     )
     calls = _patch_urlopen(monkeypatch, mod, [err_406, VALID_XML])
+    monkeypatch.setattr(mod, "_curl_get", lambda url, headers, timeout: None)  # curl unavailable
 
     results = mod.search("2509.14933", max_results=1)
 
     assert calls["n"] == 2
     assert results[0]["title"] == "Test Paper"
 
 
+def test_search_406_is_rescued_through_curl(monkeypatch):
+    """urllib refused with 406, curl gets the feed: one urllib call, no retry wait."""
+    mod = load_module()
+    err_406 = urllib.error.HTTPError(
+        url="http://example/", code=406, msg="Not Acceptable",
+        hdrs=None, fp=BytesIO(b""),
+    )
+    calls = _patch_urlopen(monkeypatch, mod, [err_406])
+    monkeypatch.setattr(mod, "_curl_get", lambda url, headers, timeout: VALID_XML)
+
+    results = mod.search("2509.14933", max_results=1)
+
+    assert calls["n"] == 1
+    assert results[0]["title"] == "Test Paper"
+
+
 def test_search_non_429_http_error_does_not_retry(monkeypatch):
     mod = load_module()
     err_500 = urllib.error.HTTPError(
```

**File**: `tests/test_verify_papers.py` (modified, +67/-0)
```diff
@@ -111,3 +111,70 @@ def test_non_transient_4xx_still_short_circuits(monkeypatch):
 
     assert calls["n"] == 1
     assert result == {REAL_ID: "unverified"}
+
+
+# ── refusals, the curl transport, and the pending cache ─────────────────────
+
+def _counting_http_get(monkeypatch, mod, status, body=None):
+    calls = {"n": 0}
+
+    def fake_http_get(url, headers=None, timeout=30):
+        calls["n"] += 1
+        return status, body
+
+    monkeypatch.setattr(mod, "http_get", fake_http_get)
+    monkeypatch.setattr(mod.time, "sleep", lambda _s: None)
+    return calls
+
+
+def test_persistent_406_does_not_split_the_batch(monkeypatch):
+    """arXiv refusing the client answers every sub-batch the same way."""
+    mod = load_module()
+    calls = _counting_http_get(monkeypatch, mod, 406)
+    batch = [f"2401.{i:05d}" for i in range(40)]
+
+    out = mod._verify_arxiv_batch_with_retry(batch)
+
+    assert calls["n"] == 3
+    assert set(out.values()) == {"verify_pending"}
+
+
+def test_refusals_are_pending_in_every_layer(monkeypatch):
+    mod = load_module()
+    for status in (401, 403):
+        _counting_http_get(monkeypatch, mod, status)
+        assert set(mod._verify_arxiv_batch_with_retry(["1706.03762"]).values()) == {"verify_pending"}
+        assert mod.verify_doi("10.1000/x", "a@b.c") == "verify_pending"
+        assert mod.verify_title_s2("Attention Is All You Need", 0.7) == ("verify_pending", None)
+
+
+def test_http_get_rescues_406_through_curl(monkeypatch):
+    import urllib.error
+    from io import BytesIO
+    mod = load_module()
+
+    def refuse(req, timeout=30):
+        raise urllib.error.HTTPError(url="http://x/", code=406, msg="Not Acceptable", hdrs=None, fp=BytesIO(b""))
+
+    monkeypatch.setattr(mod.urllib.request, "urlopen", refuse)
+    monkeypatch.setattr(mod, "_curl_get", lambda url, headers, timeout: b"<feed/>")
+    assert mod.http_get("https://export.arxiv.org/api/query?id_list=1") == (200, "<feed/>")
+
+    monkeypatch.setattr(mod, "_curl_get", lambda url, headers, timeout: None)
+    assert mod.http_get("https://export.arxiv.org/api/query?id_list=1") == (406, None)
+
+
+def test_cached_pending_is_asked_again(monkeypatch):
+    """A verify_pending written during an outage must not answer for the next 30 days."""
+    mod = load_module()
+    feed = "<feed><entry><id>http://arxiv.org/abs/1706.03762v7</id></entry></feed>"
+    calls = _counting_http_get(monkeypatch, mod, 200, feed)
+    cache = {"arxiv:1706.03762": {"status": "verify_pending", "reason": "arxiv_verify_pending", "ts": 0}}
+    paper = mod.PaperInput(id="p1", arxiv_id="1706.03762")
+
+    (result,) = mod.verify_papers([paper], arxiv_batch_size=40, fuzzy_threshold=0.6,
+                                  user_email="a@b.c", cache=cache)
+
+    assert calls["n"] == 1
+    assert result.status == "verified"
+    assert cache["arxiv:1706.03762"]["status"] == "verified"
```

---

### Incident Patch 2: `7554932c` (2026-09-28)
**Commit Message**: fix(verify-papers): send SEMANTIC_SCHOLAR_API_KEY and pace S2 calls (#450)

* fix(verify-papers): send SEMANTIC_SCHOLAR_API_KEY and pace S2 calls

The title layer called S2 with no headers, so an issued key never reached
it -- verify_papers.py does not read SEMANTIC_SCHOLAR_API_KEY at all, while
semantic_scholar_fetch.py does. Unauthenticated callers share one pool and
get 429 under any load, which the helper reports as verify_pending, so the
anti-hallucination gate cannot confirm or refute a title-only citation even
when the user holds a key.

Send x-api-key when the env var is set, stay anonymous when it is not, and
keep successive S2 calls 1.05 s apart -- the documented limit for an issued
key is 1 request/second, cumulative across all endpoints.

* test(verify-papers): cover S2 key header and pacing

Four cases: the key is sent when the env var is set, no x-api-key when it is
not, successive calls are paced to the documented 1 req/s, and a 429 reports
verify_pending rather than unverified.

* fix(verify-papers): retry S2 429 instead of reporting verify_pending

The 1 req/s ceiling is cumulative across all endpoints, so a 429 is the
expected answer whenever another call was near

**File**: `tests/test_verify_papers_s2.py` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+"""Tests for tools/verify_papers.py Semantic Scholar access.
+
+The title layer never sent SEMANTIC_SCHOLAR_API_KEY, so an issued key did not
+reach it: unauthenticated callers share one pool and get 429 under any load,
+which the helper reports as verify_pending. The key's documented limit is
+1 request/second cumulative across all endpoints, so calls are also paced.
+"""
+
+import importlib.util
+import sys
+from pathlib import Path
+
+
+ROOT = Path(__file__).resolve().parents[1]
+MODULE_PATH = ROOT / "tools" / "verify_papers.py"
+
+REAL_ID = "1706.03762"
+
+
+def load_module():
+    spec = importlib.util.spec_from_file_location("verify_papers", MODULE_PATH)
+    module = importlib.util.module_from_spec(spec)
+    assert spec.loader is not None
+    # Register before exec: the module's dataclasses resolve their annotations
+    # through sys.modules (same pattern as test_review_gate.py).
+    sys.modules[spec.name] = module
+    spec.loader.exec_module(module)
+    return module
+
+
+def _patch_http_get(monkeypatch, mod, responses):
+    """Each call to http_get pops one (status, body) pair from `responses`."""
+    queue = list(responses)
+
+    def fake_http_get(url, headers=None, timeout=30):
+        return queue.pop(0)
+
+    monkeypatch.setattr(mod, "http_get", fake_http_get)
+    monkeypatch.setattr(mod.time, "sleep", lambda _s: None)
+
+S2_HIT = '{"data": [{"title": "Attention Is All You Need", "year": 2017, "externalIds": {"ArXiv": "1706.03762"}}]}'
+
+
+def _capture_http_get(monkeypatch, mod, responses):
+    """Like _patch_http_get but records the headers each call was given."""
+    queue = list(responses)
+    seen = {"headers": []}
+
+    def fake_http_get(url, headers=None, timeout=30):
+        seen["headers"].append(headers)
+        return queue.pop(0)
+
+    monkeypatch.setattr(mod, "http_get", fake_http_get)
+    monkeypatch.setattr(mod.time, "sleep", lambda _s: None)
+    return seen
+
+
+def test_s2_sends_api_key_when_env_set(monkeypatch):
+    mod = load_module()
+    monkeypatch.setenv("SEMANTIC_SCHOLAR_API_KEY", "s2k-test")
+    seen = _capture_http_get(monkeypatch, mod, [(200, S2_HIT)])
+
+    status, ids = mod.verify_title_s2("Attention Is All You Need", 0.7)
+
+    assert status == "verified"
+    assert ids["arxiv_id"] == REAL_ID
+    assert seen["headers"][0]["x-api-key"] == "s2k-test"
+
+
+def test_s2_stays_anonymous_without_env(monkeypatch):
+    mod = load_module()
+    monkeypatch.delenv("SEMANTIC_SCHOLAR_API_KEY", raising=False)
+    seen = _capture_http_get(monkeypatch, mod, [(200, S2_HIT)])
+
+    mod.verify_title_s2("Attention Is All You Need", 0.7)
+
+    assert "x-api-key" not in (seen["headers"][0] or {})
+
+
+def test_s2_paces_successive_calls(monkeypatch):
+    """The documented key limit is 1 request/second across all endpoints."""
+    mod = load_module()
+    slept = []
+    monkeypatch.setattr(mod.time, "sleep", slept.append)
+    ticks = iter([0.0, 0.0, 0.1, 0.1])  # second call arrives 0.1 s after the first
+    monkeypatch.setattr(mod.time, "monotonic", lambda: next(ticks))
+
+    mod._s2_throttle()
+    mod._s2_throttle()
+
+    assert slept and slept[-1] >= mod.S2_MIN_INTERVAL_SEC - 0.1 - 1e-9
+
+
+def test_s2_retries_a_429_then_verifies(monkeypatch):
+    """A 429 is the expected answer under a 1 req/s ceiling, not a verdict."""
+    mod = load_module()
+    _patch_http_get(monkeypatch, mod, [(429, None), (200, S2_HIT)])
+
+    status, ids = mod.verify_title_s2("Attention Is All You Need", 0.7)
+
+    assert status == "verified"
+    assert ids["arxiv_id"] == REAL_ID
+
+
+def test_s2_persistent_429_is_pending_not_unverified(monkeypatch):
+    """Rate limiting must never be reported as "this paper does not exist"."""
+    mod = load_module()
+    _patch_http_get(monkeypatch, mod, [(429, None)] * 3)
+
+    status, ids = mod.verify_title_s2("Attention Is All You Need", 0.7)
+
+    assert status == "verify_pending"
+    assert ids is None
```

**File**: `tools/verify_papers.py` (modified, +32/-6)
```diff
@@ -106,6 +106,13 @@
 ARXIV_API = "https://export.arxiv.org/api/query"
 CROSSREF_API = "https://api.crossref.org/works"
 S2_API = "https://api.semanticscholar.org/graph/v1/paper/search"
+# Semantic Scholar's documented limit for an issued key is 1 request/second,
+# cumulative across all endpoints; unauthenticated callers share one pool and get
+# 429 under any load. Pace ourselves and send the key when the env var is set.
+S2_MIN_INTERVAL_SEC = 1.05
+# 429 is the expected answer under that ceiling, not a terminal failure.
+S2_ATTEMPTS = 3
+_s2_last_call = 0.0
 
 DEFAULT_BATCH_SIZE = 40
 DEFAULT_FUZZY_THRESHOLD = 0.6
@@ -317,15 +324,31 @@ def verify_doi(doi: str, user_email: str) -> str:
 # Layer 3: Semantic Scholar fuzzy title match
 # ──────────────────────────────────────────────────────────────────────────
 
+def _s2_headers() -> dict[str, str]:
+    """Send the API key when SEMANTIC_SCHOLAR_API_KEY is set; anonymous otherwise."""
+    key = os.environ.get("SEMANTIC_SCHOLAR_API_KEY", "").strip()
+    return {"x-api-key": key} if key else {}
+
+
+def _s2_throttle() -> None:
+    """Keep successive S2 calls at least S2_MIN_INTERVAL_SEC apart."""
+    global _s2_last_call
+    wait = S2_MIN_INTERVAL_SEC - (time.monotonic() - _s2_last_call)
+    if wait > 0:
+        time.sleep(wait)
+    _s2_last_call = time.monotonic()
+
+
 def verify_title_s2(title: str, fuzzy_threshold: float) -> tuple[str, dict[str, str] | None]:
     """Return (status, identifiers_dict_or_None)."""
     normalized = normalize_title(title)
     if not normalized:
         return "unverified", None
     q = urllib.parse.quote(normalized[:200])
     url = f"{S2_API}?query={q}&limit=3&fields=title,year,externalIds"
-    for attempt in range(2):
-        status, body = http_get(url, timeout=15)
+    for attempt in range(S2_ATTEMPTS):
+        _s2_throttle()
+        status, body = http_get(url, headers=_s2_headers(), timeout=15)
         if status == 200 and body is not None:
             try:
                 data = json.loads(body)
@@ -348,11 +371,14 @@ def verify_title_s2(title: str, fuzzy_threshold: float) -> tuple[str, dict[str,
                         "doi": ext.get("DOI", ""),
                     }
             return "unverified", None
-        if status == 429:
-            return "verify_pending", None
-        if not is_transient(status):
+        if status != 429 and not is_transient(status):
             return "unverified", None
-        time.sleep(backoff(attempt))
+        # 429 included: the 1 req/s ceiling is shared across every endpoint, so a
+        # single nearby call earns one. Observed empirically: 429, then 200 on the
+        # next try. Giving up on the first 429 turns "rate limited" into "cannot
+        # tell" for a paper S2 knows, so retry within the attempt budget.
+        if attempt < S2_ATTEMPTS - 1:
+            time.sleep(max(backoff(attempt), S2_MIN_INTERVAL_SEC))
     return "verify_pending", None
 
 
```

---

### Incident Patch 3: `1075e21c` (2026-09-28)
**Commit Message**: fix(tools): treat arXiv 406 as a transient rate-limit response (#447)

* fix(tools): retry arXiv 406 instead of treating it as permanent

export.arxiv.org returns 406 Not Acceptable intermittently: the same URL
alternates between 200 and 406 seconds apart, for IDs that exist and IDs
that do not alike (a missing ID is 200 with zero results, never 406). The
cause is undetermined -- curl succeeded on the same URL while urllib got
406 at the same moment -- but it is not a permanent client error.

is_transient() covered -1/429/5xx only, so a 406 fell into the
non-transient 4xx branch of _verify_arxiv_batch_with_retry() and the whole
batch -- real papers included -- was reported unverified, i.e. a false
fabrication signal. arxiv_fetch's _fetch_atom() retried on 429 only and
aborted the search outright.

* test(tools): cover the arXiv 406 retry paths

New tests/test_verify_papers.py pins the batch behaviour: 406 retries and
then verifies, a missing ID is unverified on a clean 200, exhausted retries
report verify_pending rather than unverified, and a 400 still short-circuits.
test_arxiv_fetch gains the matching 406-then-success case.

---------

Co-authored-by: AfonsoZhang <caochangjingjin

**File**: `tests/test_arxiv_fetch.py` (modified, +15/-0)
```diff
@@ -166,6 +166,21 @@ def test_search_raises_after_three_rate_exceeded_bodies(monkeypatch):
     assert calls["n"] == 3
 
 
+def test_search_retries_on_http_406_then_succeeds(monkeypatch):
+    """export.arxiv.org returns 406 intermittently; it must not be permanent."""
+    mod = load_module()
+    err_406 = urllib.error.HTTPError(
+        url="http://example/", code=406, msg="Not Acceptable",
+        hdrs=None, fp=BytesIO(b""),
+    )
+    calls = _patch_urlopen(monkeypatch, mod, [err_406, VALID_XML])
+
+    results = mod.search("2509.14933", max_results=1)
+
+    assert calls["n"] == 2
+    assert results[0]["title"] == "Test Paper"
+
+
 def test_search_non_429_http_error_does_not_retry(monkeypatch):
     mod = load_module()
     err_500 = urllib.error.HTTPError(
```

**File**: `tests/test_verify_papers.py` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+"""Tests for tools/verify_papers.py transient-failure handling.
+
+export.arxiv.org returns 406 Not Acceptable intermittently, while a missing ID
+is a plain 200 with zero results. Classifying 406 as a permanent 4xx made
+`_verify_arxiv_batch_with_retry` mark every ID in the batch — including papers
+that really exist — as "unverified", i.e. a false fabrication signal.
+"""
+
+import importlib.util
+import sys
+from pathlib import Path
+
+
+ROOT = Path(__file__).resolve().parents[1]
+MODULE_PATH = ROOT / "tools" / "verify_papers.py"
+
+REAL_ID = "1706.03762"
+MISSING_ID = "2609.99999"
+
+FOUND_FEED = (
+    "<feed><entry><id>http://arxiv.org/abs/1706.03762v7</id></entry></feed>"
+)
+EMPTY_FEED = "<feed><opensearch:totalResults>0</opensearch:totalResults></feed>"
+
+
+def load_module():
+    spec = importlib.util.spec_from_file_location("verify_papers", MODULE_PATH)
+    module = importlib.util.module_from_spec(spec)
+    assert spec.loader is not None
+    # Register before exec: the module's dataclasses resolve their annotations
+    # through sys.modules (same pattern as test_review_gate.py).
+    sys.modules[spec.name] = module
+    spec.loader.exec_module(module)
+    return module
+
+
+def _patch_http_get(monkeypatch, mod, responses):
+    """Each call to http_get pops one (status, body) pair from `responses`."""
+    queue = list(responses)
+    calls = {"n": 0}
+
+    def fake_http_get(url, headers=None, timeout=30):
+        calls["n"] += 1
+        return queue.pop(0)
+
+    monkeypatch.setattr(mod, "http_get", fake_http_get)
+    monkeypatch.setattr(mod.time, "sleep", lambda _s: None)
+    return calls
+
+
+# ---- is_transient ---------------------------------------------------------
+
+def test_is_transient_covers_arxiv_rate_limit_codes():
+    mod = load_module()
+
+    assert mod.is_transient(406)  # intermittent on export.arxiv.org
+    assert mod.is_transient(408)
+    assert mod.is_transient(429)
+    assert mod.is_transient(503)
+    assert mod.is_transient(-1)  # network failure
+
+
+def test_is_transient_excludes_real_client_errors():
+    mod = load_module()
+
+    assert not mod.is_transient(200)
+    assert not mod.is_transient(400)
+    assert not mod.is_transient(404)
+
+
+# ---- batch verification --------------------------------------------------
+
+def test_batch_retries_on_406_then_verifies(monkeypatch):
+    mod = load_module()
+    calls = _patch_http_get(
+        monkeypatch, mod, [(406, None), (406, None), (200, FOUND_FEED)]
+    )
+
+    result = mod._verify_arxiv_batch_with_retry([REAL_ID, MISSING_ID])
+
+    assert calls["n"] == 3
+    assert result == {REAL_ID: "verified", MISSING_ID: "unverified"}
+
+
+def test_missing_id_is_unverified_on_a_clean_200(monkeypatch):
+    """A nonexistent ID is 200 + zero results, not an HTTP error."""
+    mod = load_module()
+    _patch_http_get(monkeypatch, mod, [(200, EMPTY_FEED)])
+
+    result = mod._verify_arxiv_batch_with_retry([MISSING_ID])
+
+    assert result == {MISSING_ID: "unverified"}
+
+
+def test_persistent_406_reports_pending_not_unverified(monkeypatch):
+    """Exhausted retries must not claim a real paper does not exist."""
+    mod = load_module()
+    _patch_http_get(monkeypatch, mod, [(406, None)] * 3)
+
+    result = mod._verify_arxiv_batch_with_retry([REAL_ID])
+
+    assert result == {REAL_ID: "verify_pending"}
+
+
+def test_non_transient_4xx_still_short_circuits(monkeypatch):
+    """A malformed query (400) is permanent — no retries."""
+    mod = load_module()
+    calls = _patch_http_get(monkeypatch, mod, [(400, None)])
+
+    result = mod._verify_arxiv_batch_with_retry([REAL_ID])
+
+    assert calls["n"] == 1
+    assert result == {REAL_ID: "unverified"}
```

**File**: `tools/arxiv_fetch.py` (modified, +2/-1)
```diff
@@ -114,7 +114,8 @@ def _fetch_atom(url: str) -> ET.Element:
             with urllib.request.urlopen(req, timeout=30) as resp:
                 body = resp.read()
         except urllib.error.HTTPError as e:
-            if e.code == 429 and attempt < 3:
+            # export.arxiv.org returns 406 intermittently; it is not permanent.
+            if e.code in (406, 408, 429) and attempt < 3:
                 time.sleep(5 * attempt)
                 continue
             raise RuntimeError(f"arXiv API fetch failed: {e}")
```

**File**: `tools/verify_papers.py` (modified, +6/-1)
```diff
@@ -237,7 +237,12 @@ def http_get(url: str, headers: dict[str, str] | None = None, timeout: int = 30)
 
 
 def is_transient(status: int) -> bool:
-    return status == -1 or status == 429 or 500 <= status < 600
+    # export.arxiv.org returns 406 Not Acceptable intermittently: the same URL
+    # alternates between 200 and 406 seconds apart, for IDs that exist and IDs
+    # that do not alike (a missing ID is 200 + 0 results, never 406). Whatever
+    # the cause, it is not a permanent client error — treating it as one marks a
+    # whole batch of real papers "unverified", a false fabrication signal.
+    return status == -1 or status in (406, 408, 429) or 500 <= status < 600
 
 
 def backoff(attempt: int) -> float:
```

---

### Incident Patch 4: `ced1951f` (2026-09-28)
**Commit Message**: fix(auto-review-loop): tier bullet scoped to the Codex backend; converters follow the new wording

Follow-up to #442, whose rewording broke two converters that matched the
old sentence literally: the claude-review overlay generator and the
llm-chat converter both let the Codex tier pin through. Both now rewrite
the new bullet.

The mainline bullet is scoped to the Codex backend (native Copilot never
pins a reviewer model), shortened, and no longer claims ultra would not
improve the verdict. reviewer-routing.md says in one sentence where max
sits.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CuKuD8gF4REMCKqgX6Mj7D

**File**: `skills/auto-review-loop/SKILL.md` (modified, +1/-1)
```diff
@@ -961,7 +961,7 @@ When loop ends (positive assessment or max rounds):
 
 - **Large file handling**: If the Write tool fails due to file size, immediately retry using Bash (`cat << 'EOF' > file`) to write in chunks. Do NOT ask the user for permission — just do it silently.
 
-- ALWAYS pin `model: gpt-6-astra` + `config: {"model_reasoning_effort": "xhigh"}` on the **first call of every thread** — that is this skill's declared **regular tier** per [`reviewer-routing.md`](../shared-references/reviewer-routing.md). `xhigh` is NOT the maximum tier: it is the deliberate ceiling for multi-round loops and per-item fan-outs, because `ultra` adds automatic task delegation and would be slower and costlier per call without improving the verdict. The `ultra` / `max` tiers belong to the one-shot deep-audit skills (`/proof-checker`, `/kill-argument`, `/research-review`, `/experiment-audit`, `/paper-claim-audit`, `/result-to-claim`, `/meta-apply`) — do not raise this loop's tier, and note that changing a thread's tier requires a new thread. Pin both fields explicitly; never rely on `~/.codex/config.toml`. Replies inherit the thread's pair — pass only the saved `threadId` plus the message.
+- **Codex backend:** pin `model: gpt-6-astra` + `config: {"model_reasoning_effort": "xhigh"}` on the first call of every thread. `xhigh` is this loop's **regular tier** per [`reviewer-routing.md`](../shared-references/reviewer-routing.md), not the maximum — `ultra` belongs to the one-shot deep-audit skills and is slower and costlier per round. Do not raise this loop's tier; replies inherit the thread's pair, so changing it means a new thread. Follow the capability-fallback chain only for explicit capability errors.
 - **Native Copilot is an evidence-gated acceptance backend.** It never pins a
   reviewer model: Copilot selects the complementary rubber-duck model, and the
   helper verifies the actual cross-family pair from host events. A native
```

**File**: `skills/shared-references/reviewer-routing.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ When Codex MCP is the active backend (default for all non-auto-review-loop skill
 
 **Always pin BOTH `model` and `config.model_reasoning_effort` explicitly in the first call of every thread.** Do not rely on the user's `~/.codex/config.toml`: the catalog default effort for gpt-6-astra is `low`, far below the review floor.
 
-`ultra` = deepest reasoning + automatic task delegation — right for one-shot verdict-bearing audits, wrong for per-item loops (slower, pricier). Effort enums accepted by codex-cli ≥ 0.144.1: `none / minimal / low / medium / high / xhigh / max / ultra`. Both `max` and `ultra` sit above the regular tier; ARIS drives the deep-audit tier with `ultra` alone and treats plain `max` as an available-but-unused enum value — if you ever pin it, pin it for a one-shot verdict-bearing audit, never for a multi-round loop or a per-item fan-out.
+`ultra` = deepest reasoning + automatic task delegation — right for one-shot verdict-bearing audits, wrong for per-item loops (slower, pricier). Effort enums accepted by codex-cli ≥ 0.144.1: `none / minimal / low / medium / high / xhigh / max / ultra`. `max` and `ultra` both sit above `xhigh`; ARIS uses `ultra` for the deep-audit tier and does not use `max`.
 
 > **Do not confuse the two "max"es.** ARIS's `— effort: lite|balanced|max|beast` ([effort-contract.md](effort-contract.md)) sets how much WORK the pipeline does; Codex's `model_reasoning_effort: …|max|ultra` sets how hard the REVIEWER thinks. `— effort: max` does NOT imply `model_reasoning_effort: max`.
 
```

**File**: `skills/skills-codex/auto-review-loop/SKILL.md` (modified, +1/-1)
```diff
@@ -413,7 +413,7 @@ When loop ends (positive assessment or max rounds):
 
 - **Large file handling**: If the Write tool fails due to file size, immediately retry using Bash (`cat << 'EOF' > file`) to write in chunks. Do NOT ask the user for permission — just do it silently.
 
-- ALWAYS pin `model: gpt-6-astra` + `reasoning_effort: xhigh` on the **first call of every thread** — that is this skill's declared **regular tier** per [`reviewer-routing.md`](../shared-references/reviewer-routing.md). `xhigh` is NOT the maximum tier: it is the deliberate ceiling for multi-round loops and per-item fan-outs, because `ultra` adds automatic task delegation and would be slower and costlier per call without improving the verdict. The `ultra` / `max` tiers belong to the one-shot deep-audit skills (`/proof-checker`, `/kill-argument`, `/research-review`, `/experiment-audit`, `/paper-claim-audit`, `/result-to-claim`, `/meta-apply`) — do not raise this loop's tier, and note that changing a thread's tier requires a new thread. Follow the capability-fallback chain in `reviewer-routing.md` only for explicit capability errors. Subsequent rounds reuse the resolved pair through `send_input`.
+- ALWAYS pin `model: gpt-6-astra` + `reasoning_effort: xhigh` on the first spawn of every reviewer. `xhigh` is this loop's **regular tier** per [`reviewer-routing.md`](../shared-references/reviewer-routing.md), not the maximum — `ultra` belongs to the one-shot deep-audit skills and is slower and costlier per round. Do not raise this loop's tier; follow-ups through `send_input` inherit the pair. Follow the capability-fallback chain only for explicit capability errors.
 - Save agent id from first call, use `send_input` for subsequent rounds
 - Be honest — include negative results and failed experiments
 - Do NOT hide weaknesses to game a positive score
```

**File**: `tools/convert_skills_to_llm_chat.py` (modified, +3/-0)
```diff
@@ -156,6 +156,9 @@ def convert_content(text: str) -> str:
                 text = text[:fm_end + 1] + note + text[fm_end + 1:]
 
     # 5. Clean up multiple blank lines from removed lines
+    # the Codex tier-pinning bullet (auto-review-loop) has no meaning for an HTTP reviewer
+    text = re.sub(r"^- \*\*Codex backend:\*\* pin `model: [^`]+` \+ `config: .*$",
+                  "- ALWAYS ask the LLM reviewer for strict, high-rigor feedback", text, flags=re.MULTILINE)
     text = re.sub(r'\n{3,}', '\n\n', text)
 
     return text
```

**File**: `tools/generate_codex_claude_review_overrides.py` (modified, +3/-0)
```diff
@@ -262,6 +262,9 @@ def transform_body(text: str) -> str:
     text = text.replace('"agent_id"', '"thread_id"')
     text = text.replace("ALWAYS use `reasoning_effort: xhigh` for reviews", "Always ask the Claude reviewer for strict, high-rigor feedback.")
     text = text.replace("ALWAYS use `reasoning_effort: xhigh` for maximum reasoning depth", "Always ask the Claude reviewer for strict, high-rigor feedback.")
+    # the Codex tier-pinning bullet has no meaning for a Claude reviewer
+    text = re.sub(r"^- ALWAYS pin `model: [^`]+` \+ `reasoning_effort: xhigh`.*$",
+                  "- Always ask the Claude reviewer for strict, high-rigor feedback.", text, flags=re.MULTILINE)
     text = text.replace("mcp__codex__codex-reply", "mcp__claude-review__review_reply_start")
     text = text.replace("mcp__codex__codex", "mcp__claude-review__review_start")
     text = re.sub(r"^-\s+\*{0,2}REVIEWER_MODEL.*$", REVIEWER_LINE, text, flags=re.MULTILINE)
```

---

### Incident Patch 5: `5a8c4e37` (2026-09-28)
**Commit Message**: fix(auto-review-loop): xhigh is the regular tier, not "maximum reasoning depth" (#442)

The Key Rules line described the pinned xhigh effort as "maximum reasoning depth",
but max and ultra both sit above xhigh. The wording invites a future session to
treat the loop's tier as already maxed out and to raise it, which the routing
policy explicitly forbids: ultra adds automatic task delegation and is wrong for
multi-round loops and per-item fan-outs.

State the tier, cite the routing doc, name the deep-audit skills that own
ultra/max, and record that a thread's tier cannot change after creation.

Also spell out in reviewer-routing.md where plain max sits relative to the two
tiers: the policy line listed it in the accepted enum and in the codex-cli
version requirement without saying where it sits, while the tier table named
only ultra.

Co-authored-by: dreamworld2023 <dreamworld2023@users.noreply.github.com>

**File**: `skills/auto-review-loop/SKILL.md` (modified, +1/-1)
```diff
@@ -961,7 +961,7 @@ When loop ends (positive assessment or max rounds):
 
 - **Large file handling**: If the Write tool fails due to file size, immediately retry using Bash (`cat << 'EOF' > file`) to write in chunks. Do NOT ask the user for permission — just do it silently.
 
-- ALWAYS use `config: {"model_reasoning_effort": "xhigh"}` for maximum reasoning depth
+- ALWAYS pin `model: gpt-6-astra` + `config: {"model_reasoning_effort": "xhigh"}` on the **first call of every thread** — that is this skill's declared **regular tier** per [`reviewer-routing.md`](../shared-references/reviewer-routing.md). `xhigh` is NOT the maximum tier: it is the deliberate ceiling for multi-round loops and per-item fan-outs, because `ultra` adds automatic task delegation and would be slower and costlier per call without improving the verdict. The `ultra` / `max` tiers belong to the one-shot deep-audit skills (`/proof-checker`, `/kill-argument`, `/research-review`, `/experiment-audit`, `/paper-claim-audit`, `/result-to-claim`, `/meta-apply`) — do not raise this loop's tier, and note that changing a thread's tier requires a new thread. Pin both fields explicitly; never rely on `~/.codex/config.toml`. Replies inherit the thread's pair — pass only the saved `threadId` plus the message.
 - **Native Copilot is an evidence-gated acceptance backend.** It never pins a
   reviewer model: Copilot selects the complementary rubber-duck model, and the
   helper verifies the actual cross-family pair from host events. A native
```

**File**: `skills/shared-references/reviewer-routing.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ When Codex MCP is the active backend (default for all non-auto-review-loop skill
 
 **Always pin BOTH `model` and `config.model_reasoning_effort` explicitly in the first call of every thread.** Do not rely on the user's `~/.codex/config.toml`: the catalog default effort for gpt-6-astra is `low`, far below the review floor.
 
-`ultra` = deepest reasoning + automatic task delegation — right for one-shot verdict-bearing audits, wrong for per-item loops (slower, pricier). Effort enums accepted by codex-cli ≥ 0.144.1: `none / minimal / low / medium / high / xhigh / max / ultra`.
+`ultra` = deepest reasoning + automatic task delegation — right for one-shot verdict-bearing audits, wrong for per-item loops (slower, pricier). Effort enums accepted by codex-cli ≥ 0.144.1: `none / minimal / low / medium / high / xhigh / max / ultra`. Both `max` and `ultra` sit above the regular tier; ARIS drives the deep-audit tier with `ultra` alone and treats plain `max` as an available-but-unused enum value — if you ever pin it, pin it for a one-shot verdict-bearing audit, never for a multi-round loop or a per-item fan-out.
 
 > **Do not confuse the two "max"es.** ARIS's `— effort: lite|balanced|max|beast` ([effort-contract.md](effort-contract.md)) sets how much WORK the pipeline does; Codex's `model_reasoning_effort: …|max|ultra` sets how hard the REVIEWER thinks. `— effort: max` does NOT imply `model_reasoning_effort: max`.
 
```

**File**: `skills/skills-codex/auto-review-loop/SKILL.md` (modified, +1/-1)
```diff
@@ -413,7 +413,7 @@ When loop ends (positive assessment or max rounds):
 
 - **Large file handling**: If the Write tool fails due to file size, immediately retry using Bash (`cat << 'EOF' > file`) to write in chunks. Do NOT ask the user for permission — just do it silently.
 
-- ALWAYS use `reasoning_effort: xhigh` for maximum reasoning depth
+- ALWAYS pin `model: gpt-6-astra` + `reasoning_effort: xhigh` on the **first call of every thread** — that is this skill's declared **regular tier** per [`reviewer-routing.md`](../shared-references/reviewer-routing.md). `xhigh` is NOT the maximum tier: it is the deliberate ceiling for multi-round loops and per-item fan-outs, because `ultra` adds automatic task delegation and would be slower and costlier per call without improving the verdict. The `ultra` / `max` tiers belong to the one-shot deep-audit skills (`/proof-checker`, `/kill-argument`, `/research-review`, `/experiment-audit`, `/paper-claim-audit`, `/result-to-claim`, `/meta-apply`) — do not raise this loop's tier, and note that changing a thread's tier requires a new thread. Follow the capability-fallback chain in `reviewer-routing.md` only for explicit capability errors. Subsequent rounds reuse the resolved pair through `send_input`.
 - Save agent id from first call, use `send_input` for subsequent rounds
 - Be honest — include negative results and failed experiments
 - Do NOT hide weaknesses to game a positive score
```

---

### Incident Patch 6: `e3cd5c36` (2026-09-28)
**Commit Message**: fix(watchdog): serialize the tasks.json read-modify-write with a lock (#443)

Signed-off-by: hiro-nikaitou <vieteviete@proton.me>

**File**: `tools/watchdog.py` (modified, +5/-0)
```diff
@@ -32,6 +32,9 @@
 """
 
 import argparse
+try:
+    import fcntl
+except ImportError: fcntl = None
 import json
 import os
 import signal
@@ -97,6 +100,7 @@ def register_task(base_dir, task_json):
         # Default session_type for session-backed tasks: fallback to screen
         task["session_type"] = "screen"
 
+    if fcntl: fcntl.flock(_lock := open(paths["base"] / ".tasks.lock", "w"), fcntl.LOCK_EX)
     tasks = []
     if paths["tasks"].exists():
         try:
@@ -120,6 +124,7 @@ def unregister_task(base_dir, name):
     if not paths["tasks"].exists():
         print(f"no tasks file found")
         return
+    if fcntl: fcntl.flock(_lock := open(paths["base"] / ".tasks.lock", "w"), fcntl.LOCK_EX)
     try:
         tasks = json.loads(paths["tasks"].read_text())
     except (json.JSONDecodeError, OSError):
```

---

### Incident Patch 7: `3e7691bb` (2026-09-28)
**Commit Message**: fix(skills): grant Skill to skills whose body instructs sub-skill invocation (#440)

**File**: `skills/auto-paper-improvement-loop/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: auto-paper-improvement-loop
 description: "Autonomously improve a generated paper via GPT-6-Astra xhigh review → implement fixes → recompile, for 2 rounds. Use when user says \"改论文\", \"improve paper\", \"论文润色循环\", \"auto improve\", or wants to iteratively polish a generated paper."
 argument-hint: "[paper-directory] [— style-ref: <source>] [— edit-whitelist <path>]"
-allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, mcp__codex__codex, mcp__codex__codex-reply
+allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, Skill, mcp__codex__codex, mcp__codex__codex-reply
 ---
 
 # Auto Paper Improvement Loop: Review → Fix → Recompile
```

**File**: `skills/overleaf-sync/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: overleaf-sync
 description: "Two-way sync between a local paper directory and an Overleaf project, so ARIS audit/edit workflows stay on the local copy while collaborators edit in the Overleaf web UI. Use when user says \"同步 overleaf\", \"overleaf sync\", \"推送到 overleaf\", \"connect overleaf\", \"Overleaf 桥接\", \"pull overleaf\", \"push overleaf\", or wants to bridge their ARIS paper directory with an Overleaf project."
 argument-hint: "[setup <project-id> | pull | push | status]"
-allowed-tools: Bash(*), Read, Grep, Glob, Edit, Write
+allowed-tools: Bash(*), Read, Grep, Glob, Edit, Write, Skill
 ---
 
 # Overleaf Sync
```

**File**: `skills/paper-claim-audit/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: paper-claim-audit
 description: "Zero-context verification that every number, comparison, and scope claim in the paper matches raw result files. Uses a fresh cross-model reviewer with NO prior context to prevent confirmation bias. Use when user says \"审查论文数据\", \"check paper claims\", \"verify numbers\", \"论文数字核对\", or before submission to ensure paper-to-evidence fidelity."
 argument-hint: "[paper-directory]"
-allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, mcp__codex__codex
+allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, Skill, mcp__codex__codex
 ---
 
 # Paper Claim Audit: Zero-Context Evidence Verification
```

**File**: `skills/paper-plan/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: paper-plan
 description: "Generate a structured paper outline from review conclusions and experiment results. Use when user says \"写大纲\", \"paper outline\", \"plan the paper\", \"论文规划\", or wants to create a paper plan before writing."
 argument-hint: "[topic-or-narrative-doc] [— style-ref: <source>]"
-allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, WebSearch, WebFetch, mcp__codex__codex, mcp__codex__codex-reply
+allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, WebSearch, WebFetch, Skill, mcp__codex__codex, mcp__codex__codex-reply
 ---
 
 # Paper Plan: From Review Conclusions to Paper Outline
```

**File**: `skills/resubmit-pipeline/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: resubmit-pipeline
 description: "Workflow 5: orchestrate a text-only resubmit of a polished paper to a different venue under hard constraints (no new experiments, no bib edits, no framework changes, never overwrite prior submissions). Use when user says \"resubmit pipeline\", \"重投流程\", \"port paper to <new venue>\", \"resubmit to <venue>\", \"tighten paper for resubmission\", or has a rejected/withdrawn paper to move to a different top venue under tight time budget."
 argument-hint: "[paper-base-dir] [— target-venue: <name>] [— review-corpus: <path>]"
-allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, mcp__codex__codex, mcp__codex__codex-reply
+allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, Skill, mcp__codex__codex, mcp__codex__codex-reply
 ---
 
 # Resubmit Pipeline: Text-Only Microedit Mode
```

---

### Incident Patch 8: `e8fe09a2` (2026-09-16)
**Commit Message**: docs: /research-implement-feature on the front page; report says when post-sweep fixes were not re-swept

Third entry next to the two /research-pipeline forms — a separate command,
not a pipeline mode. Smoke-tested end to end on a toy CLI: autonomous,
one codex call, the cross-model sweep caught a real ragged-row bug the
executor's ledger had misdescribed. At lite the sweep budget is one
round, so the report now states that fixes after the last sweep were
verified by the executor only.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CuKuD8gF4REMCKqgX6Mj7D

**File**: `README.md` (modified, +8/-0)
```diff
@@ -249,6 +249,14 @@ ARIS reads the paper → finds its weaknesses → clones the codebase → genera
 
 > Mix and match: `ref paper` only = "what can be improved?", `base repo` only = "what can I build with this code?", both = "improve *this* paper using *this* code."
 
+**🛠️ Build a feature** — already know what to build?
+
+```
+/research-implement-feature "add KV-cache reuse to the decoder" — base repo: https://github.com/org/project
+```
+
+A minimal end-to-end path first, stubs labeled, then one feature at a time with a runnable check each. Choices the request left open that affect interfaces or what a result means go into an assumption ledger *before* the code that depends on them; at the end a different model family reads the raw diff for the ones that went undeclared (and says so if that review was unavailable). The report lists passed, blocked and deferred steps — passing checks does not mean the method works, and it never claims it does.
+
 **🔥 Rebuttal mode** — reviews just dropped? Don't panic. ARIS reads every concern, builds a strategy, and drafts a rebuttal that's grounded, structured, and under the character limit:
 
 ```
```

**File**: `README_CN.md` (modified, +8/-0)
```diff
@@ -222,6 +222,14 @@ ARIS 读论文 → 找弱点 → 克隆代码 → 针对*那些*弱点用*那套
 
 > 自由组合：`ref paper` 单独 = "这篇论文哪里能改进？"，`base repo` 单独 = "这个代码能做什么？"，两个都给 = "用*这个*代码改进*这篇*论文。"
 
+**🛠️ 直接实现一个功能** —— 已经知道要做什么？
+
+```
+/research-implement-feature "给 decoder 加 KV-cache 复用" — base repo: https://github.com/org/project
+```
+
+先跑通一条最小的端到端路径（占位处标明），再一次加一个功能、每个都带一条可执行的检查。需求没说清、又会影响接口或结果含义的决定，先写进假设台账再写依赖它的代码；最后换一个模型家族读原始 diff，专找没申报的假设（审阅不可用时会明说）。报告列出通过、卡住、推迟的步骤——检查通过不等于方法有效，它也从不这么说。
+
 **🔥 Rebuttal 模式** — 审稿意见来了？别慌。ARIS 读每条意见、制定策略、起草安全的 rebuttal：
 
 ```
```

**File**: `skills/research-implement-feature/SKILL.md` (modified, +3/-1)
```diff
@@ -479,7 +479,9 @@ Print, in this order:
    that would retire it.
 5. **Sweep outcome** — verdict, how many undeclared assumptions the cross-model
    pass found, and how many were `semantic`. Report this number even when it is
-   embarrassing; it is the single most useful line in the report.
+   embarrassing; it is the single most useful line in the report. If the sweep
+   budget ran out before a re-sweep, say so here: fixes made after the last
+   sweep were verified by the executor only, not by the reviewer.
 6. **Interface assumptions** — named, with the mode and the split
    (*"`ask: semantic` — 6 rows, 3 `user`, 3 `default`"*). Under `ask: semantic`,
    name every plain `default` row in the `semantic` class individually: those are
```

**File**: `skills/skills-codex/research-implement-feature/SKILL.md` (modified, +3/-1)
```diff
@@ -365,7 +365,9 @@ substitute a second same-model pass.
 3. **Ladder status** — green / blocked / deferred, deferred ones named.
 4. **Live stubs** — each with the rung that would retire it.
 5. **Sweep outcome** — verdict, counts, and its `same-family / provisional`
-   status. Report the undeclared count even when it is embarrassing.
+   status. Report the undeclared count even when it is embarrassing. If the
+   sweep budget ran out before a re-sweep, say so: fixes made after the last
+   sweep were verified by the executor only.
 6. **Interface assumptions** — named, with the mode and the split (*"`ask:
    semantic` — 6 rows, 3 `user`, 3 `default`"*). Under `ask: semantic`, name
    every plain `default` row in the `semantic` class individually — those are the
```

---

### Incident Patch 9: `15b9b27d` (2026-09-15)
**Commit Message**: docs: OrcaReplay row to house length, note what the trace records, CN row and counts (#434)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CuKuD8gF4REMCKqgX6Mj7D

**File**: `README.md` (modified, +3/-3)
```diff
@@ -726,7 +726,7 @@ Domain-specific skills and external projects contributed by the community. PRs w
 
 🎉 **Community Skills (15):** [research-refine](skills/research-refine/SKILL.md) · [experiment-plan](skills/experiment-plan/SKILL.md) · [research-refine-pipeline](skills/research-refine-pipeline/SKILL.md) · [grant-proposal](skills/grant-proposal/SKILL.md) · [paper-poster](skills/paper-poster/SKILL.md) (deprecated → [paper-poster-html](skills/paper-poster-html/SKILL.md)) · [paper-slides](skills/paper-slides/SKILL.md) · [mermaid-diagram](skills/mermaid-diagram/SKILL.md) · [proof-writer](skills/proof-writer/SKILL.md) · [comm-lit-review](skills/comm-lit-review/SKILL.md) · [dse-loop](skills/dse-loop/SKILL.md) · [idea-discovery-robot](skills/idea-discovery-robot/SKILL.md) · [formula-derivation](skills/formula-derivation/SKILL.md) · [paper-illustration](skills/paper-illustration/SKILL.md) · [writing-systems-papers](skills/writing-systems-papers/SKILL.md) · [skills-codex](skills/skills-codex/)
 
-🌐 **External Projects & Docs (15):** [rosetta](https://github.com/SyntaxSmith/rosetta) · [open-source-hardening-skills](https://github.com/zeyuzhangzyz/open-source-hardening-skills) · [CitationClaw](https://github.com/VisionXLab/CitationClaw) · [auto-hparam-tuning](https://github.com/zxh0916/auto-hparam-tuning) · [paper-to-course](https://github.com/KaguraTart/paper-to-course) · [deep-research-skills](https://github.com/Weizhena/deep-research-skills) · [Antigravity Adaptation Guide](docs/ANTIGRAVITY_ADAPTATION.md) · [OpenClaw Adaptation Guide](docs/OPENCLAW_ADAPTATION.md) · [Cursor Adaptation Guide](docs/CURSOR_ADAPTATION.md) · [Codex+Claude Review Bridge](docs/CODEX_CLAUDE_REVIEW_GUIDE.md) · [Trae Adaptation Guide](docs/TRAE_ARIS_RUNBOOK_EN.md) · [MiniMax-AI/cli](https://github.com/MiniMax-AI/cli) · [posterly](https://github.com/Chenruishuo/posterly) · [Claude Fleet](https://github.com/tianyilt/claude-fleet) · [anti-defensive-writing-Skill](https://github.com/Adkid-Zephyr/anti-defensive-writing-Skill)
+🌐 **External Projects & Docs (16):** [rosetta](https://github.com/SyntaxSmith/rosetta) · [open-source-hardening-skills](https://github.com/zeyuzhangzyz/open-source-hardening-skills) · [CitationClaw](https://github.com/VisionXLab/CitationClaw) · [auto-hparam-tuning](https://github.com/zxh0916/auto-hparam-tuning) · [paper-to-course](https://github.com/KaguraTart/paper-to-course) · [deep-research-skills](https://github.com/Weizhena/deep-research-skills) · [Antigravity Adaptation Guide](docs/ANTIGRAVITY_ADAPTATION.md) · [OpenClaw Adaptation Guide](docs/OPENCLAW_ADAPTATION.md) · [Cursor Adaptation Guide](docs/CURSOR_ADAPTATION.md) · [Codex+Claude Review Bridge](docs/CODEX_CLAUDE_REVIEW_GUIDE.md) · [Trae Adaptation Guide](docs/TRAE_ARIS_RUNBOOK_EN.md) · [MiniMax-AI/cli](https://github.com/MiniMax-AI/cli) · [posterly](https://github.com/Chenruishuo/posterly) · [Claude Fleet](https://github.com/tianyilt/claude-fleet) · [anti-defensive-writing-Skill](https://github.com/Adkid-Zephyr/anti-defensive-writing-Skill) · [OrcaReplay](https://github.com/Continuum-AI-Corp/OrcaReplay)
 
 > 🙌 Thanks to every contributor! We fold the tables below to keep the README readable — but every skill and project here is equally valued. PRs always welcome!
 
@@ -754,7 +754,7 @@ Domain-specific skills and external projects contributed by the community. PRs w
 </details>
 
 <details>
-<summary><b>🌐 External Projects & Docs (15)</b> — click to expand</summary>
+<summary><b>🌐 External Projects & Docs (16)</b> — click to expand</summary>
 
 | Name | Domain | Description |
 |------|--------|-------------|
@@ -767,7 +767,7 @@ Domain-specific skills and external projects contributed by the community. PRs w
 | 🖱️ [Cursor Adaptation Guide](docs/CURSOR_ADAPTATION.md) | General | Use ARIS skills in [Cursor](https://www.cursor.com/) — `@`-reference skills, MCP setup, workflow mapping, state file recovery across sessions |
 | 🖥️ [Trae Adaptation Guide](docs/TRAE_ARIS_RUNBOOK_EN.m
```

**File**: `README_CN.md` (modified, +3/-2)
```diff
@@ -682,7 +682,7 @@ ARIS 全流程完成并进入投稿/审稿阶段的真实项目。**所列分数
 
 🎉 **社区 Skills（13 个）：** [research-refine](skills/research-refine/SKILL.md) · [experiment-plan](skills/experiment-plan/SKILL.md) · [research-refine-pipeline](skills/research-refine-pipeline/SKILL.md) · [grant-proposal](skills/grant-proposal/SKILL.md) · [paper-poster](skills/paper-poster/SKILL.md) (deprecated → [paper-poster-html](skills/paper-poster-html/SKILL.md)) · [paper-slides](skills/paper-slides/SKILL.md) · [mermaid-diagram](skills/mermaid-diagram/SKILL.md) · [proof-writer](skills/proof-writer/SKILL.md) · [comm-lit-review](skills/comm-lit-review/SKILL.md) · [dse-loop](skills/dse-loop/SKILL.md) · [idea-discovery-robot](skills/idea-discovery-robot/SKILL.md) · [paper-illustration](skills/paper-illustration/SKILL.md) · [skills-codex](skills/skills-codex/)
 
-🌐 **外部项目 & 文档（13 个）：** [rosetta](https://github.com/SyntaxSmith/rosetta) · [open-source-hardening-skills](https://github.com/zeyuzhangzyz/open-source-hardening-skills) · [CitationClaw](https://github.com/VisionXLab/CitationClaw) · [auto-hparam-tuning](https://github.com/zxh0916/auto-hparam-tuning) · [paper-to-course](https://github.com/KaguraTart/paper-to-course) · [deep-research-skills](https://github.com/Weizhena/deep-research-skills) · [Antigravity 适配指南](docs/ANTIGRAVITY_ADAPTATION_CN.md) · [OpenClaw 适配指南](docs/OPENCLAW_ADAPTATION.md) · [Cursor 适配指南](docs/CURSOR_ADAPTATION.md) · [Trae 适配指南](docs/TRAE_ARIS_RUNBOOK_CN.md) · [posterly](https://github.com/Chenruishuo/posterly) · [Claude Fleet](https://github.com/tianyilt/claude-fleet) · [anti-defensive-writing-Skill](https://github.com/Adkid-Zephyr/anti-defensive-writing-Skill)
+🌐 **外部项目 & 文档（14 个）：** [rosetta](https://github.com/SyntaxSmith/rosetta) · [open-source-hardening-skills](https://github.com/zeyuzhangzyz/open-source-hardening-skills) · [CitationClaw](https://github.com/VisionXLab/CitationClaw) · [auto-hparam-tuning](https://github.com/zxh0916/auto-hparam-tuning) · [paper-to-course](https://github.com/KaguraTart/paper-to-course) · [deep-research-skills](https://github.com/Weizhena/deep-research-skills) · [Antigravity 适配指南](docs/ANTIGRAVITY_ADAPTATION_CN.md) · [OpenClaw 适配指南](docs/OPENCLAW_ADAPTATION.md) · [Cursor 适配指南](docs/CURSOR_ADAPTATION.md) · [Trae 适配指南](docs/TRAE_ARIS_RUNBOOK_CN.md) · [posterly](https://github.com/Chenruishuo/posterly) · [Claude Fleet](https://github.com/tianyilt/claude-fleet) · [anti-defensive-writing-Skill](https://github.com/Adkid-Zephyr/anti-defensive-writing-Skill) · [OrcaReplay](https://github.com/Continuum-AI-Corp/OrcaReplay)
 
 > 🙌 感谢每一位贡献者！为了 README 的可读性，下方表格折叠展示——但每个 skill 和项目都同样珍贵。欢迎 PR！
 
@@ -708,12 +708,13 @@ ARIS 全流程完成并进入投稿/审稿阶段的真实项目。**所列分数
 </details>
 
 <details>
-<summary><b>🌐 外部项目 & 文档（13 个）</b> — 点击展开</summary>
+<summary><b>🌐 外部项目 & 文档（14 个）</b> — 点击展开</summary>
 
 | 名称 | 领域 | 描述 |
 |------|------|------|
 | 🪨 [rosetta](https://github.com/SyntaxSmith/rosetta) | Pro 级 ChatGPT MCP | Node 程序化访问 **ChatGPT Pro / `gpt-5.5-pro` / DeepResearch**——通过 Chrome CDP Fetch 拦截 + WebSocket second-leg streaming 实现。自带 MCP server（Claude Code / Codex / Cline），是 Oracle MCP 在 `— reviewer: oracle-pro` 高 tier review 上的另一种实现路径。支持多轮对话、并发、live token deltas、15 分钟 idle-timeout watchdog（长 Pro thinking 不会被误杀）。MIT，by [@SyntaxSmith](https://github.com/SyntaxSmith) |
 | 📣 [anti-defensive-writing-Skill](https://github.com/Adkid-Zephyr/anti-defensive-writing-Skill) | 发布会写作原则 | 「论文是发布会,不是工作汇报」:十二条反防御性写作规则——围绕最强优势组织、只打赢得了的比赛、每个实验都有论证职责、禁用自我削弱表达。Skill(中/英)+ 复制即用提示词。其中四条已并入 ARIS 写作契约。MIT,by [@Adkid-Zephyr](https://github.com/Adkid-Zephyr) |
+| 🔁 [OrcaReplay](https://github.com/Continuum-AI-Corp/OrcaReplay) | 可复现 | 录下一次 agent 运行（Claude Code、Codex、OpenClaw、goose），离线原样回放，或从任意一步换个模型分叉——过夜跑坏了不用再跑一夜去查。注意：录像里是完整的请求/响应字节，prompt 和 key 都在，未发表的东西放哪儿自己掂量。Apache-2.0。 |
 | 🛡️ [open-source-hardening-skills](https://github.com/zeyuzhangzyz/open-source-hardening-skills) | DevOps / 开源 | 10 个 skill 流水线，将研究代码加固为生产级开源项目 |
 | 📊 [CitationClaw](https://github.com/VisionXL
```

---

### Incident Patch 10: `d5efb012` (2026-09-15)
**Commit Message**: fix(openalex): preserve open access status in results (#436)

**File**: `tests/test_openalex_fetch.py` (modified, +61/-0)
```diff
@@ -1,4 +1,6 @@
 import importlib.util
+import json
+import sys
 from pathlib import Path
 from types import SimpleNamespace
 
@@ -134,3 +136,62 @@ def fake_get(url, params, timeout):
         client.search_works("rate limited")
 
     assert "Rate limit exceeded" in capsys.readouterr().err
+
+
+@pytest.mark.parametrize(
+    ("metadata", "expected"),
+    [
+        ({"open_access": {"is_oa": True, "oa_status": "gold"}}, True),
+        ({"open_access": {"is_oa": False, "oa_status": "closed"}}, False),
+        ({"open_access": {}}, False),
+        ({"open_access": None}, False),
+        ({}, False),
+    ],
+)
+def test_parse_work_preserves_open_access_flag(metadata, expected):
+    openalex_fetch = load_module()
+    work = {"id": "https://openalex.org/W123", **metadata}
+
+    assert openalex_fetch.OpenAlexClient()._parse_work(work)["is_oa"] is expected
+
+
+@pytest.mark.parametrize("command", ["search", "work"])
+@pytest.mark.parametrize("json_output", [False, True])
+def test_cli_reports_open_access_from_work_metadata(
+    monkeypatch, capsys, command, json_output
+):
+    openalex_fetch = load_module()
+    work = {
+        "id": "https://openalex.org/W123",
+        "display_name": "An open access paper",
+        "open_access": {
+            "is_oa": True,
+            "oa_status": "gold",
+            "oa_url": "https://example.test/paper.pdf",
+        },
+    }
+
+    def fake_get(self, url, params, timeout):
+        payload = {"results": [work]} if command == "search" else work
+        return FakeResponse(openalex_fetch, payload)
+
+    monkeypatch.setattr(openalex_fetch.requests.Session, "get", fake_get)
+    argv = [str(MODULE_PATH), command, "W123"]
+    if command == "search":
+        argv.append("--open-access")
+    if json_output:
+        argv.append("--json")
+    monkeypatch.setattr(sys, "argv", argv)
+
+    openalex_fetch.main()
+
+    output = capsys.readouterr().out
+    if json_output:
+        result = json.loads(output)
+        parsed = result[0] if command == "search" else result
+        assert parsed["is_oa"] is True
+        assert parsed["oa_status"] == "gold"
+        assert parsed["oa_url"] == work["open_access"]["oa_url"]
+    else:
+        assert "OA: Yes" in output
+        assert "OA: No" not in output
```

**File**: `tools/openalex_fetch.py` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ def _parse_work(self, work: Dict) -> Dict:
             "venue": venue,
             "venue_type": source.get("type"),
             "cited_by_count": work.get("cited_by_count", 0),
-            "is_oa": work.get("is_oa", False),
+            "is_oa": oa_info.get("is_oa", False),
             "oa_status": oa_status,
             "oa_url": oa_url,
             "abstract": abstract,
```

#### Recent Merged Pull Requests:
- **PR #452** (2026-09-29): fix: use alphaXiv's canonical www host (@alias09inc)
- **PR #450** (2026-09-28): fix(verify-papers): send SEMANTIC_SCHOLAR_API_KEY and pace S2 calls (@AfonsoZhang)
- **PR #447** (2026-09-28): fix(tools): treat arXiv 406 as a transient rate-limit response (@AfonsoZhang)
- **PR #445** (closed): fix(arxiv, verify-papers): handle arXiv HTTP 406; never count refusals as hallucinations (@ilya-pershin)
- **PR #443** (2026-09-28): fix(watchdog): serialize the tasks.json read-modify-write to stop losing registrations (@hiro-nikaitou)
- **PR #442** (2026-09-28): fix(auto-review-loop): xhigh is the regular tier, not "maximum reasoning depth" (@dreamworld2023)
- **PR #441** (closed): test: guard sub-skill invocation against a missing Skill grant (#284) (@Jeremy-xuan)
- **PR #440** (2026-09-28): fix(skills): grant Skill to skills whose body instructs sub-skill invocation (@Jeremy-xuan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
