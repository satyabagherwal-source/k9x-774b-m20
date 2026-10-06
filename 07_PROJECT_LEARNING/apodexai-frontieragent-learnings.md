# Forensic Learning Record (Deep Inspection): ApodexAI/FrontierAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/apodexai-frontieragent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ApodexAI/FrontierAgent](https://github.com/ApodexAI/FrontierAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:00:36.316Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ApodexAI/FrontierAgent`
- **Description**: 🧩 FrontierAgent, our agent framework, open-sourced alongside it — native command-line TUI, ReAct and Agent Team modes, one command on macOS and Linux, no preinstall, no hard Docker dependency.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5124 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apodex/render.py`
```
"""Terminal rendering — Rich when available, graceful plain-text fallback.

Streaming text (assistant content + thinking) is written incrementally to
stdout so it appears token-by-token like apodex. Discrete blocks (tool
calls, diff previews, tool results, the todo plan, the final answer) are
rendered with Rich panels when ``rich`` is installed, else plain framed
text.

Colors come from a named **theme** (including dark/light variants and popular
editor palettes) or ``mono`` for color-free output, so look-and-feel is
configurable without touching call sites. The palettes live in
:mod:`apodex.tui.themes` and are shared with the full-screen TUI — this module
holds no colours of its own, because two copies of the same palette is exactly
how the line UI and the TUI drifted apart. The renderer never raises — a
rendering failure must not abort an agent run.
"""

from __future__ import annotations

import asyncio
import sys
import time
from typing import TYPE_CHECKING, Any

from apodex.tui.themes import GLYPHS, ansi_fg, rich_styles

if TYPE_CHECKING:
    # For the checker these names are always bound: ``rich`` is a mandatory
    # dependency (see [project] dependencies in pyproject.toml), and
    # ``markdown_it`` arrives with it. The runtime try/except below stays as a
    # defensive fallback for a broken install, but a checker cannot connect the
    # names it binds to the ``_HAVE_RICH`` guard that protects every use, and
    # so reports all 19 of them as possibly-unbound.
    from markdown_it import MarkdownIt
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel
    from rich.text import Text

try:  # Rich is optional; degrade gracefully.
    # markdown-it is Rich's own parser (and its dependency); ``preserve_line_breaks``
    # reuses it so "what counts as code" cannot drift from what Rich renders.
    from markdown_it import MarkdownIt
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel
    from rich.text import Text
    _HAVE_RICH = True
except Exception:  # pragma: no cover - exercised only without rich
    _HAVE_RICH = False


#: Block types Rich renders verbatim — their source lines must not be touched.
_VERBATIM_BLOCKS = frozenset({"fence", "code_block", "html_block"})


def _verbatim_lines(text: str) -> set[int]:
    """0-based indices of the lines Rich will render as literal content.

    Located with Rich's own parser rather than a fence regex. Hand-rolling the
    rule means re-implementing CommonMark: a fence closes only on the same
    character at the same-or-greater length (so ``~~~`` inside a ``` block, or
    ``` inside a ```` block, is content), and fences nest under container
    prefixes such as blockquotes. A boolean "am I in a fence" toggle gets all
    three wrong and silently edits code it promised to preserve.
    """
    parser = MarkdownIt().enable("strikethrough").enable("table")
    protected: set[int] = set()
    for token in parser.parse(text):
        if token.type in _VERBATIM_BLOCKS and token.map:
            protected.update(range(*token.map))
    return protected


def _ends_with_hard_break(line: str) -> bool:
    """True when *line* already ends in a CommonMark hard line break.

    Two trailing spaces, or an ODD number of trailing backslashes: an even
    number is escaped literal backslashes (``C:\\``), which leaves the newline
    soft, so those lines still need a marker.
    """
    if line.endswith("  "):
        return True
    return (len(line) - len(line.rstrip("\\"))) % 2 == 1


def preserve_line_breaks(text: str) -> str:
    """Make a model's line breaks survive CommonMark rendering.

    ``rich.markdown`` is CommonMark, where a single newline inside a block is a
    *soft* break: the renderer reflows those lines into one paragraph. Model
    output is line-oriented, so that silently destroys any structure carried by
    newlines alone — most visibly the references section, which the report
    prompt requires as "one reference per line, plain text — no bullets, no
    blank lines between entries". Rendered as CommonMark, that becomes::

        [1] https://…-6310711 [2]
        https://…-on-stronger-ai-boom [3] https://…-9497810 [4]

    Entries run together and the markers strand at line ends. Appending the
    two-space hard-break marker keeps each line its own line while leaving the
    text valid Markdown, so headings, lists, tables, emphasis and links go on
    working exactly as before.

    Skipped where a trailing space would change meaning rather than layout:
    verbatim blocks (see :func:`_verbatim_lines`), lines that already end in a
    hard break (so this is idempotent), and lines at the end of a block, which
    need no marker because the blank line already breaks them.

    Without Rich there is nothing to repair — the plain-text path prints the
    answer as-is and every newline already survives — so the text is returned
    untouched.
    """
    if not _HAVE_RICH:
        return text
    lines = text.split("\n")
    protected = _verbatim_lines(text)
    for i, line in enumerate(lines):
        if i in protected or i + 1 in protected:
            continue
        stripped = line.rstrip()
        if not stripped or _ends_with_hard_break(line):
            continue
        if i + 1 >= len(lines) or not lines[i + 1].strip():
            continue
        lines[i] = f"{stripped}  "
    return "\n".join(lines)


# Labels pair a shared monochrome glyph with the tool's short name. The glyphs
# are text-presentation characters so they inherit the active theme's colour —
# the colour emoji these replaced painted themselves and ignored the theme.
_TOOL_GLYPH = {
    # Shell / code execution.
    "bash": f"{GLYPHS['bash']} Bash",
    "run_python_code": f"{GLYPHS['code']} Python",
    # Reading.
    "read_file": f"{GLYPHS['read']} Read",
    "read_text": f"{GLYPHS['read']} Read",
    "file_editor_view": f"{GLYPHS['read']} View",
    "view_image": f"{GLYPHS['image']} Image",
    # Writing.
    "write_file": f"{GLYPHS['write']} Write",
    "create_file": f"{GLYPHS['write']} Create",
    "file_editor_create": f"{GLYPHS['write']} Create",
    "file_editor_str_replace": f"{GLYPHS['write']} Edit",
    "delete_file": f"{GLYPHS['delete']} Delete",
    # Local search.
    "grep_search": f"{GLYPHS['search']} Grep",
    "glob_search": f"{GLYPHS['search']} Glob",
    # Web. A research run spends most of its steps here, and these three shared
    # the generic fallback marker until now — which made a page of alternating
    # search / fetch / download steps read as one undifferentiated family, the
    # opposite of what the marker column is for.
    "web_search": f"{GLYPHS['web']} Search web",
    "web_fetch": f"{GLYPHS['fetch']} Fetch",
    "download_file": f"{GLYPHS['fetch']} Download",
    # Planning / task board.
    "todo_write": f"{GLYPHS['plan']} Plan",
    "add_task": f"{GLYPHS['plan']} Plan",
    "update_task": f"{GLYPHS['plan']} Plan",
    "finish_planning": f"{GLYPHS['plan']} Planning done",
    "exit_plan_mode": f"{GLYPHS['proposal']} Plan review",
    # Agent Team orchestration.
    "create_subagent": f"{GLYPHS['spawn']} Spawn",
    "assign_task": f"{GLYPHS['spawn']} Assign",
    "collect_reports": f"{GLYPHS['spawn']} Collect",
    "stop_subagent": f"{GLYPHS['stopped']} Stop agent",
    "submit_report": f"{GLYPHS['proposal']} Report",
}

def tool_label(name: str, *, marker: bool = True) -> str:
    """The display name for ``name``: family marker plus a short human label.

    ``marker=False`` drops the family marker for rows that already carry a
    marker of their own — a result heading leads with ✓/✗, and two glyphs in one
    column stop reading as a column. The *words* still have to match the call
    row above, which is why both surfaces resolve them here rather than falling
    back to the raw ``snake_case`` tool name in one place and the label in
    another.
    """
    label = _TOOL_GLYPH.get(name, f"{GLYPHS['tool']} {name}")
    return label if marker else label.split(" ", 1)[-1]


_MAX_RESULT_CHARS = 4000
_MAX_DIFF_LINES = 200

_DEFAULT_THEME = "catppuccin"


def diff_to_text(
    diff_text: str, *, max_lines: int = _MAX_DIFF_LINES,
    theme: str = _DEFAULT_THEME,
) -> Text:
    """Colorize a unified diff into a Rich ``Text``, truncating to ``max_lines``.

    Additions, deletions, hunk headers and context lines take the ``theme``'s
    own add / del / hunk / subtle colours rather than Rich's generic
    ``green`` / ``red`` / ``cyan`` / ``dim``, so a diff shown inside a themed
    panel cannot fight the panel it sits in.

    Shared by the TUI sink and the approval modal so both surfaces color diffs
    identically. Requires rich, which the TUI always has.
    """
    styles = rich_styles(theme)
    lines = diff_text.splitlines()
    truncated = ""
    if len(lines) > max_lines:
        truncated = f"… [+{len(lines) - max_lines} more diff lines]"
        lines = lines[:max_lines]
    body = Text()
    for ln in lines:
        if ln.startswith("+") and not ln.startswith("+++"):
            body.append(ln + "\n", style=styles["add"])
        elif ln.startswith("-") and not ln.startswith("---"):
            body.append(ln + "\n", style=styles["del"])
        elif ln.startswith("@@"):
            body.append(ln + "\n", style=styles["hunk"])
        else:
            body.append(ln + "\n", style=styles["subtle"])
    if truncated:
        body.append(truncated, style=styles["subtle"])
    return body


#: Row cap for the changed-files summary. A single build step can promote
#: thousands of paths into the journal; the panel is a summary, and a terminal
#: scrollback full of ``dist/`` entries buries the answer above it.
_MAX_CHANGE_ROWS = 50


class Renderer:
    """Stateful, theme-aware console renderer shared across a session."""

    def __init__(self, *, theme: str = _DEFAULT_THEME, color: bool = True,
                 verbose: bool = Tru
```

### Core Architecture Module: `apodex/session_state.py`
```
import os
import uuid
from pathlib import Path
from typing import Any


def new_session_id(mode: str) -> str:
    """Return a readable local-time run id with an explicit UTC offset."""
    from apodex.run_layout import new_run_timestamp

    timestamp, _utc, _zone = new_run_timestamp()
    return f"{timestamp}-{mode}-{uuid.uuid4().hex[:4]}"


def _session_state_path(session_id: str) -> str:
    from apodex.run_layout import run_dir

    return str(run_dir(session_id, create=False) / "session.json")


def _legacy_session_roots() -> list[Path]:
    roots = [Path(os.path.expanduser("~/.apodex/sessions"))]
    configured = os.environ.get("APODEX_LEGACY_SESSION_ROOTS", "")
    roots.extend(Path(value) for value in configured.split(os.pathsep) if value)
    return roots


def load_session_state(session_id: str) -> dict | None:
    """Load a persisted session checkpoint by id (for ``--resume``), or None."""
    import json
    try:
        candidates = [_session_state_path(session_id)]
        candidates.extend(str(root / f"{session_id}.json") for root in _legacy_session_roots())
        for candidate in candidates:
            try:
                with open(candidate, encoding="utf-8") as f:
                    return json.load(f)
            except OSError:
                continue
    except Exception:
        return None


def list_saved_sessions(
    extra_roots: list[str] | None = None,
    workspace: str | Path | None = None,
) -> list[dict[str, Any]]:
    """Return saved-session metadata, newest first, for ``--resume`` listings.

    ``workspace`` selects the run tree to read when the process has not entered
    it yet (``--resume`` is answered before the ``--cwd`` chdir).

    Checkpoints are user-local and may be interrupted or manually edited, so a
    malformed entry is skipped rather than making every other session hidden.
    """
    import json

    from apodex.run_layout import local_time_from_timestamp, runs_root

    legacy_roots = _legacy_session_roots()
    legacy_roots.extend(Path(root) for root in (extra_roots or []))
    try:
        paths = {
            path.resolve() for root in legacy_roots for path in root.glob("*.json")
        }
        paths.update(
            path.resolve() for path in runs_root(workspace).glob("*/session.json")
        )
        paths = sorted(
            paths,
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
    except OSError:
        return []

    sessions: list[dict[str, Any]] = []
    # A resumed legacy checkpoint is rewritten into the run tree without the
    # old file being removed, so the same id can be found twice. Newest first
    # means the first hit is the live one.
    seen: set[str] = set()
    for path in paths:
        try:
            state = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(state, dict):
                continue
            # In the run layout the id is the directory, not the file name.
            fallback = path.parent.name if path.name == "session.json" else path.stem
            session_id = str(state.get("session_id") or fallback)
            if session_id in seen:
                continue
            seen.add(session_id)
            sessions.append({
                "session_id": session_id,
                "name": str(state.get("name") or ""),
                "mode": str(state.get("mode") or "unknown"),
                "cwd": str(state.get("cwd") or "unknown directory"),
                "message_count": len(state.get("history") or []),
                "modified_at": local_time_from_timestamp(path.stat().st_mtime),
            })
        except (OSError, ValueError, TypeError):
            continue
    return sessions

```

### Core Architecture Module: `apodex/tui/state.py`
```
"""Pure presentation state for the Textual front end."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum


class PresentationPhase(StrEnum):
    IDLE = "idle"
    THINKING = "thinking"
    RESPONDING = "responding"
    RUNNING_TOOL = "running_tool"
    AWAITING_APPROVAL = "awaiting_approval"
    DONE = "done"
    INCOMPLETE = "incomplete"
    INTERRUPTED = "interrupted"
    ERROR = "error"


_TERMINAL_PHASES = frozenset({
    PresentationPhase.DONE,
    PresentationPhase.INCOMPLETE,
    PresentationPhase.INTERRUPTED,
    PresentationPhase.ERROR,
})


@dataclass
class TuiPresentationState:
    """Small, UI-only task lifecycle shared by the sink and status bar."""

    phase: PresentationPhase = PresentationPhase.IDLE
    task_started_at: float | None = None
    task_finished_at: float | None = None
    current_tool: str = ""
    queued_steers: int = 0
    idle_after: float | None = None
    terminal_hold_seconds: float = 2.0
    clock: Callable[[], float] = field(default=time.monotonic, repr=False, compare=False)

    @property
    def terminal(self) -> bool:
        return self.phase in _TERMINAL_PHASES

    def begin_task(self) -> None:
        now = self.clock()
        self.phase = PresentationPhase.THINKING
        self.task_started_at = now
        self.task_finished_at = None
        self.current_tool = ""
        self.queued_steers = 0
        self.idle_after = None

    def transition(self, phase: PresentationPhase, *, tool: str = "") -> None:
        if self.terminal:
            return
        if self.task_started_at is None and phase != PresentationPhase.IDLE:
            self.task_started_at = self.clock()
        self.phase = phase
        self.current_tool = tool if phase in {
            PresentationPhase.RUNNING_TOOL,
            PresentationPhase.AWAITING_APPROVAL,
        } else ""

    def finish(self, phase: PresentationPhase = PresentationPhase.DONE) -> None:
        if self.terminal:
            return
        if phase not in _TERMINAL_PHASES:
            raise ValueError(f"not a terminal presentation phase: {phase}")
        now = self.clock()
        if self.task_started_at is None:
            self.task_started_at = now
        self.phase = phase
        self.task_finished_at = now
        self.current_tool = ""
        self.idle_after = now + self.terminal_hold_seconds

    def interrupt(self) -> None:
        """Record user cancellation even if a final render raced just ahead of it."""
        now = self.clock()
        if self.task_started_at is None:
            self.task_started_at = now
        self.phase = PresentationPhase.INTERRUPTED
        self.task_finished_at = now
        self.current_tool = ""
        self.idle_after = now + self.terminal_hold_seconds

    def resume_after_error(self) -> None:
        """Continue the same task after a recoverable error was rendered."""
        if self.phase != PresentationPhase.ERROR:
            return
        self.phase = PresentationPhase.THINKING
        self.task_finished_at = None
        self.current_tool = ""
        self.idle_after = None

    def set_queued_steers(self, count: int) -> None:
        self.queued_steers = max(0, int(count))

    def elapsed_seconds(self) -> int | None:
        if self.task_started_at is None:
            return None
        end = self.task_finished_at if self.task_finished_at is not None else self.clock()
        return max(0, int(end - self.task_started_at))

    def settle(self) -> bool:
        """Return to idle after the terminal result has remained visible."""
        if self.idle_after is None or self.clock() < self.idle_after:
            return False
        self.reset()
        return True

    def reset(self) -> None:
        self.phase = PresentationPhase.IDLE
        self.task_started_at = None
        self.task_finished_at = None
        self.current_tool = ""
        self.queued_steers = 0
        self.idle_after = None


def format_elapsed(seconds: int | None) -> str:
    if seconds is None:
        return ""
    if seconds < 60:
        return f"{seconds}s"
    minutes, remainder = divmod(seconds, 60)
    if minutes < 60:
        return f"{minutes}m{remainder:02d}s"
    hours, minutes = divmod(minutes, 60)
    return f"{hours}h{minutes:02d}m"


__all__ = ["PresentationPhase", "TuiPresentationState", "format_elapsed"]

```

### Core Architecture Module: `benchmarks/frontier_search_bench/eval/verifiable/lint_scores_schemas.py`
```
#!/usr/bin/env python3
"""Lint scores.json schemas — catch silent schema drift in per-query scorers.

run_all.py 通过 ``extract_total_rates`` 读每题的 ``scorers/query_NN/auto_scores/
scores.json``。如果某 scorer 写出来的 schema 跟 reader 假设的不一致，那一题在
最终 ranking 里会**静默消失**——scorer 自身跑通、模型也答了，但聚合矩阵就是
读不出 rate。这就是过去 Q03/Q28/Q39 出现过的问题。

本脚本做两件事：

1. Synthetic reader tests — 用拼装数据覆盖所有 reader 接受的 schema 变体
   （dict-form / list-form / total_score / total / total_rate / score_rate）。
2. Real-output structural test — 扫每个真实存在的 scores.json，断言
   extract_total_rates 能读出非空 ``{model: rate}``。

Exit 0 全 PASS，否则 1。建议在 ``run_all.py`` 跑完后做一次，或作为 pre-merge
检查跑一次，保证新增 scorer 没把 schema 写歪。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS))

from run_all import extract_total_rates  # noqa: E402


def _close(
    actual: dict[str, float], expected: dict[str, float], label: str
) -> tuple[bool, str]:
    if set(actual) != set(expected):
        return False, (
            f"FAIL: {label} — keys differ. "
            f"expected {sorted(expected)}, got {sorted(actual)}"
        )
    for k in expected:
        if abs(actual[k] - expected[k]) > 1e-9:
            return False, (
                f"FAIL: {label} — {k}={actual[k]:.4f}, expected {expected[k]:.4f}"
            )
    return True, f"PASS: {label}"


SYNTHETIC_CASES: list[tuple[str, dict, dict[str, float]]] = [
    (
        "dict-form + total_score + per-entry max_score",
        {"results": {"m": {"total_score": 2, "max_score": 4}}},
        {"m": 0.5},
    ),
    (
        "dict-form + total_score + top-level max_score",
        {"max_score": 4, "results": {"m": {"total_score": 2}}},
        {"m": 0.5},
    ),
    (
        "dict-form + total_rate overrides total_score+max_score",
        {"max_score": 4, "results": {"m": {"total_score": 999, "total_rate": 0.5}}},
        {"m": 0.5},
    ),
    (
        "dict-form + score_rate alias",
        {"max_score": 4, "results": {"m": {"score_rate": 0.75}}},
        {"m": 0.75},
    ),
    (
        "dict-form + total alias (legacy Q03 shape pre-fix)",
        {"max_score": 4, "results": {"m": {"total": 1}}},
        {"m": 0.25},
    ),
    (
        "list-form + total_score (legacy Q28/Q39 shape pre-fix)",
        {"max_score": 3, "results": [{"model": "m", "total_score": 3}]},
        {"m": 1.0},
    ),
    (
        "list-form + total_rate",
        {
            "max_score": 3,
            "results": [{"model": "m", "total_score": 1, "total_rate": 0.9}],
        },
        {"m": 0.9},
    ),
    (
        "multi-model dict-form",
        {
            "max_score": 4,
            "results": {
                "a": {"total_score": 4},
                "b": {"total_score": 2},
                "c": {"total_score": 0},
            },
        },
        {"a": 1.0, "b": 0.5, "c": 0.0},
    ),
    (
        "non-dict / non-list results → empty",
        {"max_score": 4, "results": "garbage"},
        {},
    ),
    (
        "missing results → empty",
        {"max_score": 4},
        {},
    ),
]


def run_synthetic_tests() -> tuple[int, int]:
    print("─" * 64)
    print("[1/2] Synthetic reader tests")
    print("─" * 64)
    passed, failed = 0, 0
    for label, scores_in, expected in SYNTHETIC_CASES:
        rates, _ = extract_total_rates(scores_in)
        ok, msg = _close(rates, expected, label)
        print(("  ✓ " if ok else "  ✗ ") + msg)
        if ok:
            passed += 1
        else:
            failed += 1
    print(f"  → {passed}/{passed + failed} passed")
    return passed, failed


def run_real_output_tests() -> tuple[int, int, int]:
    print()
    print("─" * 64)
    print("[2/2] Real-output structural tests")
    print("─" * 64)
    scorers_root = THIS / "scorers"
    paths = sorted(scorers_root.glob("query_*/auto_scores/scores.json"))
    if not paths:
        print("  (no scorers/query_*/auto_scores/scores.json found; skipping)")
        print("  Hint: run `python run_all.py --models ...` first to populate.")
        return 0, 0, 0

    passed, failed = 0, 0
    for p in paths:
        qid = p.parent.parent.name  # "query_NN"
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"  ✗ {qid}: JSONDecodeError — {e}")
            failed += 1
            continue
        rates, _ = extract_total_rates(data)
        if not rates:
            print(
                f"  ✗ {qid}: extract_total_rates returned empty dict — "
                "schema drift. Writer should emit `results` as "
                "dict[model: entry] with `total_score` + `max_score` "
                "(per-entry `total_rate` preferred)."
            )
            failed += 1
        else:
            print(f"  ✓ {qid}: {len(rates)} model rate(s) extracted")
            passed += 1
    print(f"  → {passed}/{passed + failed} passed ({len(paths)} file(s) scanned)")
    return passed, failed, len(paths)


def main() -> int:
    syn_pass, syn_fail = run_synthetic_tests()
    real_pass, real_fail, real_n = run_real_output_tests()
    total_pass = syn_pass + real_pass
    total_fail = syn_fail + real_fail
    print()
    print("=" * 64)
    if total_fail:
        print(
            f"FAIL: {total_fail} test(s) failed, {total_pass} passed "
            f"(synthetic: {syn_pass}/{len(SYNTHETIC_CASES)}, "
            f"real outputs: {real_pass}/{real_n})."
        )
        return 1
    print(
        f"PASS: all {total_pass} test(s) passed "
        f"(synthetic: {syn_pass}/{len(SYNTHETIC_CASES)}, "
        f"real outputs: {real_pass}/{real_n})."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `benchmarks/frontier_search_bench/eval/verifiable/scorers/pipeline/__init__.py`
```
"""Shared extraction & alignment pipeline for verifiable evals."""

```

### Core Architecture Module: `benchmarks/frontier_search_bench/eval/verifiable/scorers/pipeline/alignment.py`
```
"""
Canonical-ID alignment layer for verifiable evals.

Purpose
-------
Given a per-model list of extracted claims (already structured by
`extraction_pipeline.py`), align each claim to an entry in a curated
baseline table (e.g. Q06 D1-D43, Q10 BASELINE/PARTIAL films) or to null
when no entry fits.

Design rationale
----------------
Replaces brittle keyword/exact matching done inside scorers with a
multi-model LLM vote + programmatic field cross-check + kw sanity, with
a judge LLM disambiguating ambiguous cases.

Public API
----------
- `align_claims(client, *, claims_by_model, baselines, query_text, cfg,
                output_dir)` — top-level; writes `{model}/alignment.json`
  and returns the same structure.
- `BASELINE_ENTRY_SCHEMA` — the shape expected in `baselines`.

Each aligned claim has the shape::

    {
      "canonical_id": "D5" | null,
      "alignment_confidence": "high" | "medium" | "low" | "needs_review",
      "alignment_reasoning": str,
      "votes": [{model, canonical_id, confidence, reasoning}, ...],
      "field_check": {hits, misses, unknowns, detail},
      "kw_match_id": "D5" | null,
      "judge_invoked": bool,
      "judge_verdict": {final_canonical_id, final_confidence, rationale} | None,
      "raw": {...original claim dict...},
    }
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS.parent))

from pipeline.extraction_pipeline import _extract_json, call_llm  # noqa: E402

# ═══════════════════════════════════════════════════════════════════════════
# Defaults (mirrors extraction_pipeline.DEFAULTS for model availability)
# ═══════════════════════════════════════════════════════════════════════════

ALIGN_DEFAULTS = {
    "aligner_models": [
        "anthropic/claude-sonnet-4",
        "openai/gpt-5",
        "google/gemini-2.5-pro",
    ],
    "judge_model": "anthropic/claude-opus-4.6",
    "temperature": 0.0,
    "max_tokens_align": 1024,
    "max_tokens_judge": 4096,
    "concurrency": 8,
    "retry_max": 3,
    "retry_backoff_s": 2.0,
}


# ═══════════════════════════════════════════════════════════════════════════
# Baseline entry schema (what callers must provide in `baselines`)
# ═══════════════════════════════════════════════════════════════════════════

BASELINE_ENTRY_SCHEMA = """\
Each baseline entry is a dict with keys:
  id (str)              : canonical id, e.g. "D5" or "相爱相亲"
  description (str)     : one-line human summary used in LLM prompts
  match_fields (dict)   : {field_name: str | list[str]} for programmatic
                          cross-check against the claim; each value is
                          substring-matched (case-insensitive, lists treated
                          as ANY-match)
  kw (list[str])        : optional keyword list for kw sanity check;
                          substring match (case-insensitive)
"""


# ═══════════════════════════════════════════════════════════════════════════
# Prompts
# ═══════════════════════════════════════════════════════════════════════════

ALIGN_SYSTEM = "你是对齐专家。只输出合法 JSON，不要任何解释文字。"

ALIGN_TEMPLATE = """## 用户原始查询
{query_text}

## 基准表（共 {n_baselines} 条）
{baseline_block}

## 任务
将下面这条"被评模型声明"对齐到基准表中的某一条。

## 待对齐的声明
```json
{claim_json}
```

## 判定规则
1. 按**实体身份（人物/作品名）+ 核心主题**综合判断，允许译名/表述差异
2. 若基准表**任何一条都不对应**（无论是基准外的新条目，还是模型编造/错误），canonical_id=null
3. 对齐要保守：宁愿 null 也不要硬配到看似相近但含义冲突的条目（例如基准 D40 明确要求"引力波论文，非获奖论文"，若声明说的是光电效应就应判 null）
4. reasoning 要直接引用或概括声明中的决定性字段（如人名、主题、期刊、年份），不要泛泛而谈

## 严格实体约束（**必须遵守**）
- **canonical_id 必须指向与 claim 核心实体（人名/片名/作品名）语义相同的基准条目**。允许语种、拼写、别名变体（繁简体、中英文、缩写、中间名）
- **禁止**用基准表里**不同实体**的 id "替模型纠错"。举例：
   - 如果 claim.film_name 是"叔·叔"，即使其他字段（导演=杨曜恺）与某基准片（也姓杨曜恺）匹配，也不能把 canonical_id 改成那个基准片。叔·叔如果在基准表就对齐叔·叔，不在就 null。
   - 如果 claim.name 是"Helmut Ernst"（不存在的人），即使姓 Ernst 的基准项是 "Richard Ernst"，也不能对齐——不同的人。
- 如果 claim 核心实体不在基准表（允许变体后），canonical_id=null

## Q06 专项规则（诺奖论文被拒查询）
若 claim.rejecting_journal 缺失/空，且 claim.note 或 rejection_reason 语义否认"期刊拒稿"（如国家审查、政治压制、出版商退稿、会议摘要、审稿人反对但发表等），无论 claim.name 是否匹配某 D 基准人物，canonical_id 必须为 null。任务限定**期刊**拒稿，非期刊场景不在评分范畴。

## 输出 JSON
```json
{{
  "canonical_id": "<Dxx 或基准 id>" 或 null,
  "confidence": "high|medium|low",
  "reasoning": "<80 字以内>"
}}
```
"""


JUDGE_SYSTEM = (
    "你是对齐仲裁者。综合 N 个对齐器的判断、客观字段对照、关键词匹配信号，"
    "给出最终 canonical_id。只输出合法 JSON。"
)

JUDGE_TEMPLATE = """## 用户原始查询
{query_text}

## 待对齐的声明
```json
{claim_json}
```

## 对齐器的判断
{votes_block}

## 客观字段对照（cross-check）
{cross_check_block}

## Keyword sanity match
{kw_block}

## 候选基准条目详情
{candidates_block}

## 任务
综合以上证据给出最终 canonical_id。决策优先级参考：
1. 对齐器多数意见 + 字段无冲突 + kw 一致 → 信多数
2. 多数一致但字段明显冲突（misses > 0）→ 认真核查，可能 null
3. 对齐器分歧 → 选 reasoning 更贴原文、字段更对得上的一方
4. kw 与多数对齐器矛盾 → 警惕 mode collapse，倾向 null 或重选
5. 证据不足 → null

## 严格实体约束（**必须遵守**）

1. **final_canonical_id 只能指向与 claim 核心实体（人名 / 片名 / 作品名）语义相同的基准条目**。允许语种、拼写、别名变体——例如：
   - "淪落人"（繁） ≡ "沦落人"（简）：允许对齐到基准 id "沦落人"
   - "Love Education" ≡ "相爱相亲"：允许对齐
   - "Richard R. Ernst" ≡ "Richard Ernst"（同一人，中间名差异）：允许
   - "Katalin Karikó" / "卡里科" / "考里科"：同一人，允许
2. **禁止**用基准表里**不同实体**的 id "帮模型纠错"，即使其他字段（导演、年份、合作者、主题）匹配也不允许。例如：
   - claim.film_name="叔·叔"（导演杨曜恺 2019）≠ 基准 id "从今以后"（也是杨曜恺，但是不同电影）→ 必须 null 或对齐到 "叔·叔"（如果在基准表里）
   - claim.name="赫尔穆特·恩斯特（Helmut Ernst）" ≠ 基准 D10 "Richard Ernst"（姓相同但名不同、是不同人）→ 必须 null
3. **如果 claim 的核心实体不在基准表的任何一条里（允许变体后），final_canonical_id=null**。不许"退而求其次"去选一个其他字段接近的基准条目。

## Q06 专项规则（诺奖论文被拒查询）
如果 claim.rejecting_journal 为 null/空 / "N/A" / 空字符串，且 claim.note 或 rejection_reason 的语义**否认期刊拒稿**（例如"国家审查"、"政治压制"、"被政府查禁"、"出版商退稿"、"会议摘要被拒"、"审稿人反对但编辑发表"、"state suppression"、"censored"、"not a journal rejection"等），则无论 claim.name 是否匹配某 D 基准的人物，final_canonical_id 都强制为 null。因为任务限定"**期刊**拒稿"，非期刊场景不在评分范畴。

**触发此规则时，rationale 必须以标签 `[Q06_FORCE_NULL:non_journal_rejection]` 开头**（例如："[Q06_FORCE_NULL:non_journal_rejection] claim 的 rejecting_journal 为 null，note 明确说'国家审查'，非期刊拒稿"）。下游 Stage C 验证层会识别此标签并禁止把这条 null 回填到 ✅ 基准。

## Q14 专项规则（任期内持双重国籍的国家元首查询）
**仅当 query 是关于"双重国籍国家元首"时（query_text 含'国家元首'+'国籍'/'双重国籍'）触发**。三条强制 null 规则按下列顺序逐项检查：

1. **任前已放弃外籍**（`[Q14_FORCE_NULL:renounced_before_term]`）：claim.self_caveat 字段或 claim.evidence_note 中明确表明该人在**就职/当选前**已放弃外国国籍（典型表述："任前放弃美籍"、"放弃外国国籍后才参选"、"renounced before taking office"、"在就职前两天放弃法国籍"等）。即便人物身份对、其他字段对，仍强制 null。典型案例：Valdas Adamkus（立陶宛任前放弃美籍）、Pedro Pablo Kuczynski（秘鲁 2015 年放弃美籍）、Benjamin Netanyahu（以色列任前放弃美籍）、Michaëlle Jean（加拿大总督任前放弃法籍）、Guy Scott（早期放弃英籍）。

2. **非国家元首**（`[Q14_FORCE_NULL:not_head_of_state]`）：claim.office 字段是**政府首脑/部长/州长/议长/议员/总督/地方首脑**等非 head of state 角色。严格定义：议会制国家的 PM 不是国家元首（如英国/加拿大/澳大利亚/日本/印度/德国的 PM）；总统制国家的总统是元首；议会制国家的礼仪性总统/君主/教宗/酋长是元首。若 claim.office 含 "总理"/"首相"/"prime minister"/"PM"/"州长"/"governor"/"minister"/"议长"/"speaker" 等关键词且不属总统制元首，强制 null。

3. **实际只持单一国籍**（`[Q14_FORCE_NULL:single_citizenship]`）：claim.citizenships 数组虽列出 ≥2 个国籍，但 claim.self_caveat 或 evidence_note 表明实际只持单一国籍（典型："实际上是单一国籍"、"co-prince 只是兼任职务非真国籍"、"已放弃所以只剩本国籍"）。注意：法国总统兼任安道尔大公属于"兼任他国职务"而非双重国籍，但若模型仍将其作为肯定例子列出，应**对齐到 D7（基准 ❌）**而不是触发 FORCE_NULL —— D7 的存在就是为了扣分这种错答；只有当 claim 自身明确说"co-prince 不是国籍"等自我否定语时才走 FORCE_NULL。

**触发时 rationale 必须以对应标签开头**，例如：
- `[Q14_FORCE_NULL:renounced_before_term] self_caveat='就职前已放弃美籍'`
- `[Q14_FORCE_NULL:not_head_of_state] office='加拿大总理'，PM 非 head of state`
- `[Q14_FORCE_NULL:single_citizenship] self_caveat='实际只持本国籍'`

下游 Stage C 验证层识别此类标签后，禁止把 null 回填到 ✅ 基准。

## Q39 专项规则（气候最宜居首都查询）
**仅当 query 是关于"全球首都气候最宜居筛选"时（query_text 含'首都'+'年均气温'+'年降水量'）触发**。三条强制 null 规则按下列顺序逐项检查（基于模型 claim 自身字段，无须外部知识）：

1. **非首都城市**（`[Q39_FORCE_NULL:non_capital]`）：claim.capital_name 字段是**非国家首都**的城市/地区。常见误列：'纽约'/'New York'、'香港'/'Hong Kong'、'墨尔本'/'Melbourne'、'上海'/'Shanghai'、'孟买'/'Mumbai'、'巴塞罗那'/'Barcelona'、'伊斯坦布尔'/'Istanbul'、'圣保罗'/'São Paulo'、'多伦多'/'Toronto'、'悉尼'/'Sydney'、'米兰'/'Milan'、'里约热内卢'/'Rio de Janeiro'、'广州'、'北京以外的中国城市' 等。注意：**Pretoria 是南非的行政首都**（Cape Town 是立法首都，Bloemfontein 是司法首都），均算合法首都；**伯尔尼/Bern 是瑞士首都**；**渥太华/Ottawa 是加拿大首都**等。**Washington D.C.**、**Bogotá** 等是首都不触发。

2. **气温超出 13-17°C 区间**（`[Q39_FORCE_NULL:temp_out_of_range]`）：claim.annual_temp_c 字段已填写且数值明显**不在 [13, 17] 区间内**（典型：23°C、19.5°C、10°C、6°C 等），但模型仍将其作为合规答案列出。即使温度名义边界值（如 12.9 / 17.1）在测量不确定性内可放过，明显超界（< 12.5 或 > 17.5）必须强制 null。注意：claim.annual_temp_c=null（模型未给数值）则**不触发**此规则，正常走对齐。

3. **降水超出 800-1200mm 区间**（`[Q39_FORCE_NULL:precip_out_of_range]`）：claim.annual_precip_mm 字段已填写且数值明显**不在 [800, 1200] 区间内**（典型：< 750 或 > 1300），但模型仍将其作为合规答案列出。同 Rule 2 处理边界容差（700-800 / 1200-1300 视具体情况）。claim.annual_precip_mm=null 不触发。

**触发时 rationale 必须以对应标签开头**，例如：
- `[Q39_FORCE_NULL:non_capital] capital_name='纽约'，纽约不是美国首都（Washington D.C. 才是）`
- `[Q39_FORCE_NULL:temp_out_of_range] annual_temp_c=22.5°C，超出 13-17°C 上限`
- `[Q39_FORCE_NULL:precip_out_of_range] annual_precip_mm=2300mm，超出 800-1200mm 上限`

下游 Stage C 验证层识别此类标签后，禁止把 null 回填到 ✅ 基准（但允许 baseline_add 到 ⚠️/❌——例如 Mexico City 模型基于 normals 误纳即可对齐到 ⚠️ D6）。

## 输出 JSON 与字符串转义规则（**必须严格遵守**）
- 输出**纯 JSON**，可选用 ```json``` 围栏包裹。
- `rationale` 字段是 JSON 字符串，**禁止包含未转义的双引号 `"`**。需引用术语/区域名/英文片名时：
  - 优先用中文角标「」或单引号 `'…'` 包裹（例：`region_name 「毁林弧」 与 D1 'Arc of Deforestation' 一致`）
  - 必须保留双引号字面量时**必须转义为 `\"`**（例：`region=\"Pará\"`）
- 因为下游 JSON 解析器对 `rationale` 中混入的未转义闭合括号 + 引号组合（如 `Rondônia)"语义`）无法可靠修复，违反此规则会让你的判定丢失。

```json
{{
  "final_canonical_id": "<id>" 或 null,
  "final_confidence": "high|medium|low",
  "rationale": "<100 字以内，指出你采信的关键证据；若触发 Q06/Q14/Q39 专项规则必须以对应 [QXX_FORCE_NULL:...] 标签开头；若触发实体约束必须明确说明。注意 rationale 内禁用未转义双引号——见上节规则。>"
}}
```
"""


# ═══════════════════════════════════════════════════════════════════════════
# Programmatic checks (no LLM)
# ═══════════════════════════════════════════════════════════════════════════


def _claim_text_for_matching(claim: dict) -> str:
    """Concat all string values in a claim into a single lowercase text blob,
    used as haystack for kw substring matching."""
    parts = [str(v) for v in claim.values() if isinstance(v, str)]
    return " ".join(parts).lower()


def k
```

### Core Architecture Module: `benchmarks/frontier_search_bench/eval/verifiable/scorers/pipeline/extraction_pipeline.py`
```
"""
Extraction Pipeline v2 — verifiable eval framework

Flow:
  Step 1-2: Primary (claude-sonnet-4) + Secondary (gpt-5) per entity (concurrent).
  Step 3:   Span grounding (pure string).
  Step 4:   If needs_review → parallel re-extract with 3 more models, then the
            analyzer (default: anthropic/claude-opus-4.6, configurable) judges
            from 5 extractions + raw response.

Top-level states: "confirmed" | "needs_review".
Sub-reasons on needs_review: disagreement / possibly_hallucinated /
possibly_missed / primary_ungrounded / secondary_ungrounded / analyzer_uncertain.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import UTC, datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

try:
    from openai import OpenAI
except ImportError:
    sys.exit("[ERROR] pip install openai")


# ═══════════════════════════════════════════════════════════════════════════
# Model configuration (override via run_pipeline kwargs)
# ═══════════════════════════════════════════════════════════════════════════

DEFAULTS = {
    # Default model slate (override via run_pipeline kwargs).
    "primary_model": "anthropic/claude-sonnet-4",
    "secondary_model": "openai/gpt-5",
    "parallel_models": [
        "google/gemini-2.5-pro",
        "x-ai/grok-3",
        "deepseek/deepseek-v3.2",
    ],
    "analyzer_model": "anthropic/claude-opus-4.6",
    "temperature": 0.0,
    # Reasoning models + list-type schemas need long outputs;
    # 16384 leaves headroom for ~20-item structured lists.
    "max_tokens_extract": 16384,
    "max_tokens_analyzer": 16384,
    "concurrency": 8,
    "retry_max": 3,
    "retry_backoff_s": 2.0,
}


# ═══════════════════════════════════════════════════════════════════════════
# LLM client
# ═══════════════════════════════════════════════════════════════════════════


def _load_env(start_dir: Path) -> None:
    for p in [
        start_dir / ".env",
        start_dir.parent / ".env",
        start_dir.parent.parent / ".env",
    ]:
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                s = line.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                k, v = s.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("'\""))
            return


def get_client() -> OpenAI:
    _load_env(Path(__file__).parent)
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    base_url = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    if not api_key:
        sys.exit("[ERROR] OPENROUTER_API_KEY not set.")
    return OpenAI(api_key=api_key, base_url=base_url)


def call_llm(
    client: OpenAI,
    model: str,
    system: str,
    user: str,
    max_tokens: int = 2048,
    temperature: float = 0.0,
    retry_max: int = 3,
    retry_backoff_s: float = 2.0,
) -> str:
    last_err = None
    for attempt in range(retry_max):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            last_err = e
            if attempt < retry_max - 1:
                time.sleep(retry_backoff_s * (attempt + 1))
    raise RuntimeError(f"LLM call failed after {retry_max} retries: {last_err}")


# ═══════════════════════════════════════════════════════════════════════════
# Data classes
# ═══════════════════════════════════════════════════════════════════════════


@dataclass
class Extraction:
    """One extraction attempt on one (model_answer, entity) pair."""

    extractor_model: str  # the LLM that did the extraction
    value: Any  # structured value, or None
    not_mentioned: bool
    supporting_span: str | None
    confidence: str  # "high" | "medium" | "low"
    grounding: str = "pending"  # grounded | grounded_fuzzy | hallucinated | n/a
    raw_llm_output: str = ""


@dataclass
class EntityResult:
    """Final result for one (target model, entity) pair."""

    entity_id: str
    entity_name: str
    primary: Extraction | None = None
    secondary: Extraction | None = None
    phase4: list[Extraction] = field(default_factory=list)
    analyzer_verdict: dict | None = None
    resolution: str = "pending"  # "confirmed" | "needs_review"
    reason: str | None = None  # sub-label if needs_review
    canonical_value: Any = None
    canonical_span: str | None = None


# ═══════════════════════════════════════════════════════════════════════════
# JSON extraction helpers
# ═══════════════════════════════════════════════════════════════════════════


_CJK_RE = r"一-鿿　-〿＀-￯—…·"
# "Inside-a-string" context: alphanumeric, underscore, or CJK / CJK punct.
_INSIDE_RE = rf"[\w{_CJK_RE}]"


def _repair_unescaped_quotes(text: str) -> str:
    """Escape straight `"` that appears between two word/CJK chars — common
    when LLMs embed quoted phrases like `"do"` inside JSON string values.
    Legitimate JSON delimiters are surrounded by whitespace / `:` / `,` / `{}`
    / `[]` / escapes, so won't match."""
    return re.sub(
        rf'(?<={_INSIDE_RE})"(?={_INSIDE_RE})',
        r'\\"',
        text,
    )


def _extract_json(text: str) -> dict | None:
    """Extract a JSON object from LLM text output.

    Robust to:
      - Code fences (```json ... ```)
      - LLM "self-correction" patterns where two JSON objects are written
        (e.g. an initial wrong answer followed by a corrected second JSON);
        in that case we prefer the **last** parseable object.
      - Trailing text after the final JSON.
    """
    if not text:
        return None
    t = text.strip()
    # strip leading code fence
    t = re.sub(r"^```(?:json)?\s*", "", t)
    # strip trailing code fence
    t = re.sub(r"\s*```$", "", t)

    # 1) Try direct full-text parse
    for candidate in (t, _repair_unescaped_quotes(t)):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # 2) Walk from RIGHT to LEFT to find the LAST balanced {...} block that
    #    parses successfully. This handles "first wrong, then corrected"
    #    LLM outputs where the final JSON is the one we want.
    open_positions: list[int] = [i for i, ch in enumerate(t) if ch == "{"]
    close_positions: list[int] = [i for i, ch in enumerate(t) if ch == "}"]
    # Try pairings of opens/closes from rightmost close downward
    for ci in reversed(close_positions):
        for oi in reversed([p for p in open_positions if p < ci]):
            snippet = t[oi : ci + 1]
            for candidate in (snippet, _repair_unescaped_quotes(snippet)):
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    pass
    return None


# ═══════════════════════════════════════════════════════════════════════════
# Prompt templates
# ═══════════════════════════════════════════════════════════════════════════

SYSTEM_EXTRACT = "你是事实提取专家。严格按照 JSON schema 输出，不要有任何其他文字。"

PRIMARY_PROMPT_TEMPLATE = """从下面给定模型的回答中，**只**抽取关于指定实体的声明。

## 输入
- 用户原始问题: {query_text}
- 目标实体: {entity_name}
- 实体说明: {entity_description}
- 被评模型名: {target_model_name}
- 被评模型回答全文:
---
{response}
---

## 任务
严格按以下 JSON schema 输出：

{schema}

## 字段规则
- `value`: 模型明确给出的值；未提及则 null
- `not_mentioned`: 若模型回答中完全没提到该实体，true；否则 false
- `supporting_span`: 从模型原文**逐字拷贝**30–200 字直接支撑 value。**不得改写**。value 为 null 时也为 null。
- `confidence`: "high" / "medium" / "low"

## 禁止
- 不从常识补全模型没说的内容
- 不在抽取时做单位换算
- 不改写 supporting_span 使其更通顺
"""

# 副 prompt 侧重"核实模型是否真谈到此实体"，避免与主 prompt 同构导致相关误差
SECONDARY_PROMPT_TEMPLATE = """核实任务：判断下面给定模型在回答里是否**真正**谈到了指定实体。

## 输入
- 用户原始问题: {query_text}
- 要核实的实体: {entity_name}
- 实体说明: {entity_description}
- 被核实模型名: {target_model_name}
- 被核实模型回答全文:
---
{response}
---

## 任务（严格按顺序判断）
1. 在回答里**通读一遍**是否真的提到了这个实体（注意不要把相邻/近似实体混为同一个）
2. 若提到，它声称的值是什么？
3. 把原文中最能支撑你判断的一段（30–200 字）作为证据

按下列 JSON schema 输出：

{schema}

## 特别注意
- 宁可 `not_mentioned=true` 也不要硬抽一个相似但非目标实体的值
- 如果模型用了隐喻 / 间接描述，confidence 设 low
- value 和 supporting_span 要对得上；value 有、span 却证不出来，视为 low 置信
"""

ANALYZER_SYSTEM = (
    "你是仲裁者。输入是同一个 (模型, 实体) 的 5 次独立抽取 + 原文。"
    "你的任务是：综合五次抽取的多数意见与原文证据，裁决这个模型的最终抽取值。"
    "只输出 JSON，不要多余文字。"
)

ANALYZER_PROMPT_TEMPLATE = """## 背景
- 用户原始问题: {query_text}
- 目标实体: {entity_name}
- 实体说明: {entity_description}
- 被评模型名: {target_model_name}

## 被评模型的原始回答
---
{response}
---

## 五次独立抽取
{extractions_block}

## 你的任务
1. 对比五次抽取，找出多数意见 / 分歧点
2. 回到原文，自己判断"被评模型到底说了什么"
3. 给出最终 canonical 值

输出 JSON：
{{
  "final_value": <与 schema 同结构，或 null>,
  "final_not_mentioned": true|false,
  "final_span": "<原文中最可靠的一段>",
  "rationale": "<80 字以内，为什么这样裁决>",
  "final_confidence": "high|medium|low"
}}

## 原则
- 优先多数意见，但若少数派有原文精确 span 支撑，可以采少数
- 原文完全未提及 → final_not_mentioned=true, final_value=null
- 不做单位换算，保留原文表述
"""


# ═══════════════════════════════════════════════════════════════════════════
# Span grounding
# ═══════════════════════════════════════════════════════════════════════════

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[\s　，,。.、；;：:！!？?\"'“”‘’`~]+")


def _normalize(s: str) -> str:
    s = s.lower().strip()
    s = _WS.sub(" ", s)
    return s


def _strip_punct(s: str) -> str:
    return _PUNCT.sub("", s)


def span_grounding(span: str | None, response: str) -> str:
    if not span:
        return "n/a"
    s = _normalize(span)
    r = _normalize(response)
    if s in r:
        return "grounded"
    # punctuation-insens
```

### Core Architecture Module: `benchmarks/frontier_search_bench/eval/verifiable/scorers/query_01/auto_scorer.py`
```
"""Query 01 — Singapore 2019-TOP condo top-3 resale-return auto-scorer.

Reference answer (URA public transactions, locked 2026-05-05):
  Top-3 (each +1 if mentioned as final answer):
    1. High Park Residences  — 6.10%
    2. Coco Palms            — 4.80%
    3. Botanique At Bartley  — 4.64%
  Rank 4-10 (no credit): Eon Shenton, Poiz, Commonwealth Towers, Panorama,
    Thomson Impressions, Principal Garden, Wisteria.
  Known-incorrect (-1 if mentioned as final answer):
    • Hundred Palms Residences  (TOP year is 2018, not 2019)

Scoring rule (max 3, min unbounded negative):
  +1 per top-3 GT project mentioned as final answer
  -1 per known-incorrect project mentioned as final answer
   0 for rank 4-10 GT projects (recognised but not top-3) or unknowns

Pipeline: Stage 1 extract → Stage 2 align → Stage 3 score (no null-review
since baseline list is small and scoring is per-canonical_id).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS.parent))

from extract import (  # noqa: E402
    ENTITIES,
    PROMPT_HINTS,
    QUERY_ID,
    QUERY_TEXT,
    VALUE_SCHEMA,
)
from pipeline.alignment import align_claims  # noqa: E402
from pipeline.extraction_pipeline import get_client, run_pipeline  # noqa: E402

# ═══════════════════════════════════════════════════════════════════════════
# Benchmark — 10 ranked GT + 1 known-incorrect
# ═══════════════════════════════════════════════════════════════════════════

SNAPSHOT_DATE = "2026-05-05"
TOP_K = 3

# (canonical_id, name, rank_or_None, score, kw)
DIMS = [
    ("D1",  "High Park Residences",   1,   1.0,
     ["high park", "high park residences"]),
    ("D2",  "Coco Palms",              2,   1.0,
     ["coco palms"]),
    ("D3",  "Botanique At Bartley",    3,   1.0,
     ["botanique", "botanique at bartley", "bartley"]),
    ("D4",  "Eon Shenton",             4,   0.0, ["eon shenton"]),
    ("D5",  "The Poiz Residences",     5,   0.0, ["poiz"]),
    ("D6",  "Commonwealth Towers",     6,   0.0, ["commonwealth towers"]),
    ("D7",  "The Panorama",            7,   0.0, ["panorama"]),
    ("D8",  "Thomson Impressions",     8,   0.0, ["thomson impressions"]),
    ("D9",  "Principal Garden",        9,   0.0, ["principal garden"]),
    ("D10", "The Wisteria",            10,  0.0, ["wisteria"]),
    ("BAD1", "Hundred Palms Residences (TOP=2018, wrong year)",
     None, -1.0, ["hundred palms"]),
]

DIM_MAP = {
    d[0]: {"id": d[0], "name": d[1], "rank": d[2], "score": d[3], "kw": d[4]}
    for d in DIMS
}
MAX_SCORE = TOP_K * 1.0


# ═══════════════════════════════════════════════════════════════════════════
# DIMS → alignment baseline spec
# ═══════════════════════════════════════════════════════════════════════════


def build_baselines() -> list[dict]:
    out = []
    for d_id, name, rank, score, kw in DIMS:
        rank_label = f"rank #{rank}" if rank else "known-incorrect (TOP=2018)"
        desc = f"{name} — {rank_label}"
        out.append(
            {
                "id": d_id,
                "description": desc,
                "match_fields": {"name": name},
                "kw": kw,
                "judgment": "✅" if score > 0 else ("❌" if score < 0 else "⚠️"),
                "score": score,
                "rank": rank,
            }
        )
    return out


# ═══════════════════════════════════════════════════════════════════════════
# Load raw claims
# ═══════════════════════════════════════════════════════════════════════════


def load_raw_claims(out_dir: Path) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for d in Path(out_dir).iterdir():
        if not d.is_dir():
            continue
        ext = d / "extraction.json"
        if not ext.exists():
            continue
        payload = json.loads(ext.read_text(encoding="utf-8"))
        entities = payload.get("entities", [])
        if not entities:
            out[d.name] = []
            continue
        canonical_value = (entities[0].get("canonical") or {}).get("value") or []
        if not isinstance(canonical_value, list):
            canonical_value = []
        out[d.name] = canonical_value
    return out


# ═══════════════════════════════════════════════════════════════════════════
# Score from aligned claims
# ═══════════════════════════════════════════════════════════════════════════


def score_aligned(aligned_by_model: dict[str, list[dict]]) -> dict[str, dict]:
    all_scores: dict[str, dict] = {}
    for model_name, claims in aligned_by_model.items():
        seen: set[str] = set()
        scored: list[dict] = []
        unverified: list[dict] = []
        total = 0.0
        for c in claims:
            raw = c.get("raw", {}) or {}
            cid = c.get("canonical_id")
            conf = c.get("alignment_confidence", "medium")
            reason = c.get("alignment_reasoning", "")

            if conf == "needs_review":
                unverified.append(
                    {
                        "name": raw.get("name", ""),
                        "canonical_id_tentative": cid,
                        "reason": f"needs_review: {reason}",
                    }
                )
                continue

            if cid and cid in DIM_MAP:
                if cid in seen:
                    continue
                seen.add(cid)
                d = DIM_MAP[cid]
                scored.append(
                    {
                        "id": cid,
                        "name": d["name"],
                        "rank": d["rank"],
                        "score": d["score"],
                        "model_answer_name": raw.get("name", ""),
                        "model_answer_rate": raw.get("return_rate", ""),
                        "confidence": conf,
                        "reason": reason or f"aligned to {cid}",
                    }
                )
                total += d["score"]
            else:
                unverified.append(
                    {
                        "name": raw.get("name", ""),
                        "canonical_id_tentative": cid,
                        "reason": reason or "not in baseline (unknown project)",
                    }
                )

        n_top3 = sum(1 for s in scored if s["score"] > 0)
        n_wrong = sum(1 for s in scored if s["score"] < 0)
        n_other_gt = sum(1 for s in scored if s["score"] == 0)
        all_scores[model_name] = {
            "total_score": total,
            "max_score": MAX_SCORE,
            "top_k": TOP_K,
            "n_top3_hit": n_top3,
            "n_known_incorrect_hit": n_wrong,
            "n_other_gt": n_other_gt,
            "per_dimension": sorted(
                scored,
                key=lambda x: (x["rank"] if x["rank"] is not None else 99),
            ),
            "unverified_claims": unverified,
        }
    return all_scores


# ═══════════════════════════════════════════════════════════════════════════
# Output writers
# ═══════════════════════════════════════════════════════════════════════════


def build_scores_json(all_scores: dict[str, dict]) -> dict:
    ranking = sorted(all_scores.items(), key=lambda x: -x[1]["total_score"])
    return {
        "query_id": QUERY_ID,
        "snapshot_date": SNAPSHOT_DATE,
        "max_score": MAX_SCORE,
        "scoring_rule": (
            f"+1 per top-{TOP_K} GT project mentioned as final answer; "
            "-1 per known-incorrect (e.g. Hundred Palms Residences); "
            "0 for rank 4-10 GT or unknowns"
        ),
        "results": all_scores,
        "ranking": [
            {
                "rank": i + 1,
                "model": m,
                "score": s["total_score"],
                "top3_hit": s["n_top3_hit"],
                "wrong": s["n_known_incorrect_hit"],
            }
            for i, (m, s) in enumerate(ranking)
        ],
    }


def build_ranking_md(all_scores: dict[str, dict]) -> str:
    ranked = sorted(all_scores.items(), key=lambda x: -x[1]["total_score"])
    lines = [
        f"# Query {QUERY_ID} 排名报告",
        "",
        f"> Snapshot: {SNAPSHOT_DATE}  Max: {MAX_SCORE} (top-{TOP_K})",
        f"> +1 per top-{TOP_K} hit · -1 per known-incorrect · 0 for rank 4-10 / unknown",
        "",
        "| Rank | Model | Score | Top-3 hit | Known-incorrect | Other-GT | Unverified |",
        "|---:|---|---:|---:|---:|---:|---:|",
    ]
    for i, (m, s) in enumerate(ranked, 1):
        lines.append(
            f"| {i} | {m} | {s['total_score']}/{s['max_score']} "
            f"| {s['n_top3_hit']} | {s['n_known_incorrect_hit']} "
            f"| {s['n_other_gt']} | {len(s['unverified_claims'])} |"
        )
    lines.append("")
    lines.append("## 各模型主张明细")
    lines.append("")
    for m, s in ranked:
        lines.append(f"### {m}  (total={s['total_score']}/{s['max_score']})")
        for d in s["per_dimension"]:
            mark = "✓" if d["score"] > 0 else ("✗" if d["score"] < 0 else "~")
            rate = d.get("model_answer_rate") or "—"
            rank_info = f"GT#{d['rank']}" if d["rank"] is not None else "incorrect"
            lines.append(
                f"- {mark} {d['model_answer_name']} → {d['name']} "
                f"({rank_info}, rate: {rate}) → {d['score']:+}"
            )
        for uv in s["unverified_claims"]:
            lines.append(f"- ? {uv['name']} → {uv['reason']}")
        lines.append("")
    return "\n".join(lines) + "\n"


def _load_alignment(out_dir: Path) -> dict[str, list[dict]]:
    aligned: dict[str, list[dict]] = {}
    for d in Path(out_dir).iterdir():
        if not d.is_dir():
            continue
        af = d / "alignment.json"
        if not af.exists():
            continue
        aligned[d.name] = json.loads(af.read_text(encoding="utf-8")).get(
            "aligned_claims", []
        )
    return aligned


# ═══════════════════════════════════════════════════════════════════════════
# Entry point
# 
```

### Core Architecture Module: `benchmarks/frontier_search_bench/eval/verifiable/scorers/query_01/extract.py`
```
"""Query 01 — Singapore condo top-3 resale return rate.

Question (Chinese): of the condos that received TOP (Temporary Occupation
Permit) in 2019, which 3 projects had the highest 2025 resale return rate?

Reference answer (URA public transactions, locked 2026-05-05):
  1. High Park Residences   — 6.10%
  2. Coco Palms             — 4.80%
  3. Botanique At Bartley   — 4.64%
  Known incorrect: Hundred Palms Residences (TOP year is 2018, not 2019).

T-list granularity — the answer is a list of projects with names and rates.
"""

from __future__ import annotations

QUERY_ID = 1

QUERY_TEXT = (
    "我想投资新加坡房产。请帮我找出在2019年获得TOP的condo中，"
    "在2025年转售回报率最高的三个项目，并给出具体回报率。"
)

ENTITIES = [
    {
        "id": "condo_top_list",
        "name": "模型作为最终答案给出的'2019 TOP condo 转售回报率最高'项目列表",
    }
]

PROMPT_HINTS = {
    "condo_top_list": (
        "请抽取模型作为该题最终答案给出的项目列表（按模型给出的排名顺序）。\n\n"
        "**抽取规则：**\n"
        "- **只**抽取模型作为最终答案/结论列出的项目；不要抽取仅在分析过程中"
        "提到但未被作为答案的项目。\n"
        "- 项目名优先用英文全名（如 'High Park Residences' 而非 'High Park'）；"
        "原文若用中文译名，按原文保留。\n"
        "- **return_rate** 字段保留模型给出的数值字符串（如 '6.1%'、'5.8%'、"
        "'每年 4.5%'），不做单位换算。模型未给具体数值则留 null。\n"
        "- 模型给的项目数 **不一定是 3 个**，按模型实际列出的全部抽出。\n"
        "- 若模型明确表示无法回答 / 没找到具体项目，返回空数组，"
        "  not_mentioned 设为 true。\n"
        "- 模型在'排除'、'不符合'、'不算'语境下提到的项目不抽。"
    ),
}

VALUE_SCHEMA = """{
  "value": [
    {
      "name": "<项目名（优先英文全名）>",
      "return_rate": "<回报率字符串，如 '6.1%' 或 null>",
      "rank_in_model_answer": <模型答案中的排名（1=最高）或 null>
    }
  ],
  "not_mentioned": <true 仅当模型完全未给出任何项目；否则 false>,
  "supporting_span": "<原文片段 30-200 字，证明列表来自模型回答>",
  "confidence": "<high|medium|low>"
}"""

```

### Core Architecture Module: `benchmarks/frontier_search_bench/eval/verifiable/scorers/query_02/auto_scorer.py`
```
"""
Query 02 — 中国国家级新区 GDP 增速差值 / 由正转负判断 auto-scorer.

Scoring (5×3 matrix + out-of-scope row, per-area conflict 取最低分)：

  Tier 1 ✅ 干净转负 (7 个：滨海/两江/南沙/湘江/哈尔滨/西咸/长春)
    flipped+年份对 +2 / 年份错 +1 / not_flipped -1 / indeterminate 0
  Tier 2 ⚠️ 边缘转负 (3 个：舟山/西海岸/金普)
    flipped+年份对 +1 / 年份错 +0.5 / not_flipped -0.5 / indeterminate 0
  Tier 3 ❌ 干净未转负 (2 个：天府/江北)
    flipped -1 / not_flipped +1 / indeterminate 0
  Tier 4 🟡 部分可答 (5 个：兰州/福州/滇中/赣江/贵安)
    flipped 0 / not_flipped 0 / indeterminate +0.5
  Tier 5 ⚫ 不可答 (1 个：雄安)
    flipped -1 / not_flipped -0.5 / indeterminate +0.5
  Out of scope (浦东 1992 时间窗外 / 编造名字)
    flipped/not_flipped -1 / indeterminate 0

  MAX_SCORE = 7×2 + 3×1 + 2×1 + 5×0.5 + 1×0.5 = 22.0
  v2 修订 (2026-05-21)：哈尔滨/西咸/长春 由 Tier 4 升至 Tier 1，truth = 2021；依据 2 个独立 web research agent 核证地方统计公报。详见 build/q02_tier4_agent1_report.md
  Conflict 处理：同一新区多条 claim 不一致 → 取最低分（鼓励清晰最终判断）
  Dedup：同一 (新区, claim_type) 重复出现，由 min 自动收敛为单条

Pipeline:
  Stage 1 — Extraction (v2 pipeline)
  Stage 2 — Alignment (3-aligner vote + judge)
  Stage 3 — Null verification → null_resolutions.json
  Stage 4 — Scoring deterministic from canonical_id
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS.parent))

from extract import (  # noqa: E402
    ENTITIES,
    PROMPT_HINTS,
    QUERY_ID,
    QUERY_TEXT,
    VALUE_SCHEMA,
)
from pipeline.alignment import (  # noqa: E402
    align_claims,
    apply_null_resolutions,
    export_null_claims_for_review,
    persist_new_baseline_entries,
)
from pipeline.extraction_pipeline import get_client, run_pipeline  # noqa: E402

# ═══════════════════════════════════════════════════════════════════════════
# Benchmark — 18 国家级新区 + 浦东（out of scope）
# Cross-verified 2026-05-01 against 国家统计局 / 各市统计公报 / 新区管委会官网
# 数据来源详见 baseline 调研附件 (3 轮 web research)
# ═══════════════════════════════════════════════════════════════════════════

SNAPSHOT_DATE = "2026-05-21"
SCORING_MODE = "Q02-tier-matrix-v2"


BASELINE_AREAS: dict[str, dict] = {
    # ─────────── Tier 1 ✅ 干净转负（7 个）───────────
    "滨海新区": {
        "approval_year": 2006,
        "tier": 1,
        "first_flip_year": "2017",
        "judgment": "✅",
        "description": (
            "天津滨海新区（2006-09 国务院批复）。差值首次由正转负年份：2017。"
            "[Tier 1 ✅ 干净转负 — 注：2017 起改在地核算口径，与 2016 不可比；"
            "按字面定义首次新口径年即转负]"
        ),
        "kw": [
            "滨海新区",
            "天津滨海",
            "binhai",
            "tianjin binhai",
            "滨海",
        ],
    },
    "两江新区": {
        "approval_year": 2010,
        "tier": 1,
        "first_flip_year": "2021",
        "judgment": "✅",
        "description": (
            "重庆两江新区（2010-06 国务院批复）。差值首次由正转负年份：2021"
            "（差值 -0.9）。[Tier 1 ✅ 干净转负]"
        ),
        "kw": [
            "两江新区",
            "重庆两江",
            "liangjiang",
            "chongqing liangjiang",
        ],
    },
    "南沙新区": {
        "approval_year": 2012,
        "tier": 1,
        "first_flip_year": "2023",
        "judgment": "✅",
        "description": (
            "广州南沙新区（2012-09 国务院批复）。差值首次由正转负年份：2023"
            "（差值 -1.1）。[Tier 1 ✅ 干净转负]"
        ),
        "kw": [
            "南沙新区",
            "广州南沙",
            "nansha",
            "guangzhou nansha",
        ],
    },
    "湘江新区": {
        "approval_year": 2015,
        "tier": 1,
        "first_flip_year": "2021",
        "judgment": "✅",
        "description": (
            "湖南湘江新区（2015-04 国务院批复）。差值首次由正转负年份：2021"
            "（差值 -0.8）。[Tier 1 ✅ 干净转负]"
        ),
        "kw": [
            "湘江新区",
            "湖南湘江",
            "长沙湘江",
            "xiangjiang",
        ],
    },
    # ─── v2 promotions (2026-05-21): 3 个原 Tier 4 升至 Tier 1，truth = 2021 ───
    "哈尔滨新区": {
        "approval_year": 2015,
        "tier": 1,
        "first_flip_year": "2021",
        "judgment": "✅",
        "description": (
            "哈尔滨新区（2015-12 国务院批复，松北区/江北一体发展区口径）。"
            "差值首次由正转负年份：2021（新区 +7.6% vs 全国 +8.1% = 差值 -0.5）。"
            "[Tier 1 ✅ 干净转负 — v2 升级自 Tier 4，依据松北区 2020-2023 统计公报]"
        ),
        "kw": [
            "哈尔滨新区",
            "黑龙江哈尔滨",
            "harbin",
        ],
    },
    "西咸新区": {
        "approval_year": 2014,
        "tier": 1,
        "first_flip_year": "2021",
        "judgment": "✅",
        "description": (
            "西咸新区（2014-01 国务院批复，2017 起西安代管）。"
            "差值首次由正转负年份：2021（新区 +3.7% vs 全国 +8.1% = 差值 -4.4）。"
            "[Tier 1 ✅ 干净转负 — v2 升级自 Tier 4，依据 gotohui GDP index + 西安统计公报]"
        ),
        "kw": [
            "西咸新区",
            "陕西西咸",
            "xixian",
            "xi'an xianyang",
        ],
    },
    "长春新区": {
        "approval_year": 2016,
        "tier": 1,
        "first_flip_year": "2021",
        "judgment": "✅",
        "description": (
            "长春新区（2016-02 国务院批复）。"
            "差值首次由正转负年份：2021（新区 +6.5% vs 全国 +8.1% = 差值 -1.6）。"
            "[Tier 1 ✅ 干净转负 — v2 升级自 Tier 4，依据中国日报/吉林日报 2021 公报 + 长春市 2022 −4.5% 公报推算]"
        ),
        "kw": [
            "长春新区",
            "吉林长春",
            "changchun",
        ],
    },
    # ─────────── Tier 2 ⚠️ 边缘转负（3 个）───────────
    "舟山群岛新区": {
        "approval_year": 2011,
        "tier": 2,
        "first_flip_year": "2018",
        "judgment": "⚠️",
        "description": (
            "浙江舟山群岛新区（2011-06 国务院批复，舟山市口径）。"
            "差值首次由正转负年份：2018（差值仅 -0.1，边缘事件，次年立即反弹）。"
            "[Tier 2 ⚠️ 边缘转负]"
        ),
        "kw": [
            "舟山群岛新区",
            "舟山群岛",
            "舟山新区",
            "舟山",
            "zhoushan archipelago",
            "zhoushan",
        ],
    },
    "西海岸新区": {
        "approval_year": 2014,
        "tier": 2,
        "first_flip_year": "2021",
        "judgment": "⚠️",
        "description": (
            "青岛西海岸新区（2014-06 国务院批复）。差值首次由正转负年份：2021"
            "（差值约 -0.1，边缘）。[Tier 2 ⚠️ 边缘转负]"
        ),
        "kw": [
            "西海岸新区",
            "青岛西海岸",
            "qingdao xihaian",
            "xihaian",
        ],
    },
    "金普新区": {
        "approval_year": 2014,
        "tier": 2,
        "first_flip_year": "2015",
        "judgment": "⚠️",
        "description": (
            "大连金普新区（2014-06 国务院批复）。差值首次由正转负年份：2015"
            "（辽宁省 2014-2016 集中挤水分，非真实下滑）。"
            "[Tier 2 ⚠️ 边缘转负 — 受省级数据调整干扰]"
        ),
        "kw": [
            "金普新区",
            "大连金普",
            "jinpu",
            "dalian jinpu",
        ],
    },
    # ─────────── Tier 3 ❌ 干净未转负（2 个）───────────
    "天府新区": {
        "approval_year": 2014,
        "tier": 3,
        "first_flip_year": None,
        "judgment": "❌",
        "description": (
            "四川天府新区（2014-10 国务院批复，成都直管区为主口径）。"
            "观察期内年年正差值，未发生由正转负。"
            "[Tier 3 ❌ 干净未转负 — 模型若主张转负属错误]"
        ),
        "kw": [
            "天府新区",
            "四川天府",
            "成都天府",
            "tianfu",
            "sichuan tianfu",
        ],
    },
    "江北新区": {
        "approval_year": 2015,
        "tier": 3,
        "first_flip_year": None,
        "judgment": "❌",
        "description": (
            "南京江北新区（2015-06 国务院批复，江北直管区口径）。"
            "观察期内年年正差值，未发生由正转负。"
            "[Tier 3 ❌ 干净未转负 — 模型若主张转负属错误]"
        ),
        "kw": [
            "江北新区",
            "南京江北",
            "jiangbei",
            "nanjing jiangbei",
        ],
    },
    # ─────────── Tier 4 🟡 部分可答（5 个）───────────
    "兰州新区": {
        "approval_year": 2012,
        "tier": 4,
        "first_flip_year": None,
        "judgment": "⚠️",
        "description": (
            "兰州新区（2012-08 国务院批复）。逐年增速点值多以'连续 X 年超 15%'"
            "聚合表述，公开数据无法严谨判断首次转负。"
            "[Tier 4 🟡 部分可答 — indeterminate]"
        ),
        "kw": [
            "兰州新区",
            "甘肃兰州",
            "lanzhou",
        ],
    },
    "福州新区": {
        "approval_year": 2015,
        "tier": 4,
        "first_flip_year": None,
        "judgment": "⚠️",
        "description": (
            "福州新区（2015-08 国务院批复）。2024 年起统计口径改为单一长乐区，"
            "前后不可比；逐年增速大量缺失。"
            "[Tier 4 🟡 部分可答 — indeterminate]"
        ),
        "kw": [
            "福州新区",
            "福建福州",
            "fuzhou",
        ],
    },
    "滇中新区": {
        "approval_year": 2015,
        "tier": 4,
        "first_flip_year": None,
        "judgment": "⚠️",
        "description": (
            "云南滇中新区（2015-09 国务院批复）。2016-2020 有 5 年逐年增速，"
            "可推算 2020 年首次转负，但 2021-2022 数据缺失影响最终判断。"
            "[Tier 4 🟡 部分可答 — indeterminate]"
        ),
        "kw": [
            "滇中新区",
            "云南滇中",
            "dianzhong",
            "yunnan dianzhong",
        ],
    },
    "赣江新区": {
        "approval_year": 2016,
        "tier": 4,
        "first_flip_year": None,
        "judgment": "⚠️",
        "description": (
            "赣江新区（2016-06 国务院批复）。2018-2021 中间四年逐年增速完全缺失。"
            "[Tier 4 🟡 部分可答 — indeterminate]"
        ),
        "kw": [
            "赣江新区",
            "江西赣江",
            "ganjiang",
            "jiangxi ganjiang",
        ],
    },
    "贵安新区": {
        "approval_year": 2014,
        "tier": 4,
        "first_flip_year": None,
        "judgment": "⚠️",
        "description": (
            "贵安新区（2014-01 国务院批复）。2017 增速 32.8% 后续疑似挤水分；"
            "2021 起贵阳贵安融合，连续可比序列断裂。"
            "[Tier 4 🟡 部分可答 — indeterminate]"
        ),
        "kw": [
            "贵安新区",
            "贵州贵安",
            "guian",
            "guizhou guian",
        ],
    },
    # ─────────── Tier 5 ⚫ 不可答（1 个）───────────
    "雄安新区": {
        "approval_year": 2017,
        "tier": 5,
        "first_flip_year": None,
        "judgment": "⚫",
        "description": (
            "河北雄安新区（2017-04 设立）。至今未单独公布年度 GDP 增速，"
            "公开数据多为投资额或'十四五年均增长 17.1%'汇总口径。"
            "[Tier 5 ⚫ 不可答 — 主张转负即虚构]"
        ),
        "kw": [
            "雄安新区",
            "河北雄安",
            "xiongan",
        ],
    },
    # ─────────── Out of scope（时间窗外）───────────
    "浦东新区": {
        "approval_year": 1992,
 
```

### Core Architecture Module: `benchmarks/frontier_search_bench/eval/verifiable/scorers/query_02/extract.py`
```
"""
Query 02 — 中国国家级新区 GDP 增速差值 / 由正转负判断

Task: 对 2005-01-01 ~ 2026-01-01 间获批的 18 个国家级新区，模型应给出
  (1) 历年 GDP 增速 vs 全国增速差值；
  (2) 哪些新区差值曾由正转负；
  (3) 首次转负年份。

抽取层 spec：每个模型回答中按"新区为单位"抽出三种判断之一：
  - flipped         : 主张该新区差值"曾由正转负"（可附年份）
  - not_flipped     : 主张该新区"从未转负"（即始终保持正差值）
  - indeterminate   : 主张"无法严谨判断"或"数据不完整"

This module exports constants only. The runner is auto_scorer.py.
"""

from __future__ import annotations

QUERY_ID = 2

QUERY_TEXT = (
    "中国在2005年1月1日到2026年1月1日之间获批的所有国家级新区，"
    "各自历年GDP增速与同期全国GDP增速的差值是多少？"
    "其中，哪些新区的差值曾由正转负？首次转负分别发生在哪一年？"
)


ENTITIES = [
    {
        "id": "area_judgments",
        "name": (
            "模型对各国家级新区'GDP 增速差值是否曾由正转负'的判断清单。"
            "每个新区一条记录，含 area_name / claim_type / first_flip_year(可选) / reason(可选)"
        ),
    }
]


PROMPT_HINTS = {
    "area_judgments": (
        "请抽出模型回答里**针对每个国家级新区的明确判断**。每个新区一条 JSON 记录。\n\n"
        "**三种 claim_type：**\n\n"
        "1. `flipped` — 模型主张该新区差值'曾由正转负'\n"
        "   - 例：'湘江新区在 2021 年首次由正转负' → flipped + first_flip_year='2021'\n"
        "   - 例：'南沙新区差值历史上转过负'（无具体年份） → flipped + first_flip_year=null\n"
        "   - 模型若给出'差值序列'里某年从正变负，按 flipped 抽取；first_flip_year 填**模型主张的首次转负年**\n\n"
        "2. `not_flipped` — 模型主张该新区'从未发生由正转负'\n"
        "   - 例：'天府新区始终保持正差值' → not_flipped\n"
        "   - 例：'江北新区在观察期内未发生转负' → not_flipped\n"
        "   - 例：'X 新区差值持续为正' → not_flipped\n"
        "   - **注意**：模型只是没把某新区列入'转负名单'，**不算** not_flipped 主张；必须有明确文字否定才算\n\n"
        "3. `indeterminate` — 模型主张'无法严谨判断 / 数据不完整 / 口径多变'\n"
        "   - 例：'雄安新区由于无独立 GDP 数据，无法判断' → indeterminate\n"
        "   - 例：'西咸新区因口径多变，难以严谨给出转负年份' → indeterminate\n"
        "   - 例：'兰州新区缺乏逐年增速点值，无法判定首次转负' → indeterminate\n\n"
        "**抽取范围约束（重要）：**\n"
        "- 只抽取模型对**国家级新区**的判断；省级新区/经开区/自贸试验区/高新区**不抽**\n"
        "- 浦东新区（1992 获批）**虽不在 query 时间窗内**，但若模型把它列出仍要抽出"
        "（下游会判越界扣分）\n"
        "- 同一新区被模型多次描述（先 flipped 后又说 indeterminate 等）→ **每个独立判断抽一条**\n"
        "- 模型若仅列了 GDP 数据表但**没作'转负与否'判断**的新区，不抽（无主张）\n"
        "- 不要从外部知识补全：模型没说的事实不要填\n\n"
        "**字段说明：**\n"
        "- `area_name`: 新区中文名（保留模型原文，如'湘江新区'/'湖南湘江新区'/'长沙湘江新区'）\n"
        "- `claim_type`: flipped / not_flipped / indeterminate（三选一）\n"
        "- `first_flip_year`: 仅 claim_type=flipped 且模型给出年份时填字符串（如'2021'）；否则 null\n"
        "- `reason`: 模型给出的简短理由 / 关键论据（可选，<= 80 字）\n\n"
        "**抽取范围（语气）：**\n"
        "- 只抽取模型以**肯定或接近肯定**口吻的判断\n"
        "- 模型在'不可考'、'存疑'、'不确定但倾向于'等半肯定语境下：\n"
        "    - 若是关于'是否转负'的犹豫 → 按 indeterminate 抽\n"
        "    - 若是关于'年份'的犹豫但确认转负 → 按 flipped + first_flip_year=null（或最可能年）\n"
    ),
}


VALUE_SCHEMA = """{
  "value": [
    {
      "area_name": "<新区中文名（保留模型原文，如'湘江新区'/'湖南湘江新区'）>",
      "claim_type": "<flipped|not_flipped|indeterminate>",
      "first_flip_year": "<年份字符串如 '2021'；仅 claim_type=flipped 且模型给出年份时填，否则 null>",
      "reason": "<模型给出的简短理由 / 关键论据，<=80 字 / null>"
    }
  ],
  "not_mentioned": <true 仅当模型完全未对任何新区作判断时为 true；否则 false>,
  "supporting_span": "<原文片段 30-200 字，能证明你抽出的列表来自回答>",
  "confidence": "<high|medium|low>"
}"""

```

### Core Architecture Module: `benchmarks/frontier_search_bench/eval/verifiable/scorers/query_03/auto_scorer.py`
```
"""Query 03 — SpaceX Starship IFT auto-scorer (v3, locked 2026-04-29).

Scoring:
  A_flight_count       ±1   (accept ∈ {10, 11}; missing → -1)
  Per IFT-N (N=1..11):
    progress sub-dim  ±1   (any wrong claim → -1; else any correct → +1; missing IFT → -1; mentioned but no kw match → 0)
    failures sub-dim  ±1   (same rule)
  Total ranges from -23 to +23.

GT is hard-coded in the PER_IFT_GT dict below.
Each fact has a `kw` array of 3-5 short matchers; any kw substring
(case-insensitive) appearing in a model claim counts as a hit.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS.parent))

from extract import (  # noqa: E402
    ENTITIES,
    PROMPT_HINTS,
    QUERY_ID,
    QUERY_TEXT,
    VALUE_SCHEMA,
)
from pipeline.extraction_pipeline import run_pipeline  # noqa: E402

# ═══════════════════════════════════════════════════════════════════════════
# Benchmark
# ═══════════════════════════════════════════════════════════════════════════

BENCHMARK = {
    "version": "3.0",
    "locked_at": "2026-04-29",
    "cutoff_date": "2026-01-01",
    "A_flight_count_accept": {10, 11},
}


# Per-IFT structured GT.
# Each fact: {"canonical": str, "kw": [str, ...]}
# kw matching: any kw substring (case-insensitive) appearing in a model
# claim string counts as a hit on that fact.
PER_IFT_GT: dict[str, dict] = {
    "IFT_1": {
        "date": "2023-04-20",
        "block": "Block 1",
        "progress": [
            # Mostly catastrophic; still a milestone — first integrated stack liftoff
            {
                "canonical": "首次完整栈 Super Heavy + Starship 发射并穿越 Max Q",
                "kw": [
                    "首次完整栈",
                    "完整栈发射",
                    "first integrated",
                    "first full stack",
                    "穿越max q",
                    "max-q",
                    "max q",
                ],
            },
            {
                "canonical": "推力 ~16M lbf (Block 1)",
                "kw": ["16m lbf", "16百万磅", "约16m", "16 million lbf"],
            },
        ],
        "failures": [
            {
                "canonical": "3 台 Raptor 未点火（仅 30/33 工作）",
                "kw": [
                    "3台raptor未点火",
                    "30/33",
                    "3 engines fail",
                    "3台未点火",
                    "30 of 33",
                ],
            },
            {
                "canonical": "TVC T+85s 失效翻滚 ~39km",
                "kw": ["tvc", "t+85", "翻滚", "39km", "tumble", "失控翻滚"],
            },
            # NOTE: dropped "t+4:01" kw because it conflicts with confirmed_wrong
            # IFT_1 "AFSS 在 T+4:01 触发" (model误把解体时间当触发时间).
            {
                "canonical": "FTS/AFTS 触发较晚 T+3:59 解体 ~29km",
                "kw": [
                    "fts",
                    "afts",
                    "解体",
                    "t+3:59",
                    "29km",
                    "flight termination",
                    "解体~29km",
                ],
            },
            {
                "canonical": "发射台被毁 385 英亩碎片",
                "kw": [
                    "385英亩",
                    "385 acres",
                    "发射台被毁",
                    "发射台毁",
                    "pad destroyed",
                    "concrete crater",
                ],
            },
        ],
        "confirmed_wrong": [
            {
                "canonical": "AFSS 在 T+4:01 触发（实际 T+3:20 触发，T+4:01 是解体时间）",
                "kw": ["afss在t+4:01触发", "afss t+4:01"],
            },
            {
                "canonical": "促使加装导流系统（实际 IFT-1 前已开始建造，IFT-1 加速完工）",
                "kw": ["ift-1后加装", "ift-1后开始建造导流", "ift-1 后才有导流"],
            },
        ],
    },
    "IFT_2": {
        "date": "2023-11-18",
        "block": "Block 1",
        "progress": [
            {
                "canonical": "33 台 Raptor 全部点火",
                "kw": [
                    "33台全部点火",
                    "33台正常",
                    "33 raptor",
                    "33 engines",
                    "33-engine",
                    "33台raptor",
                    "全部点火",
                    "all 33",
                ],
            },
            {
                "canonical": "首次成功完成热分离 (hot-staging)",
                "kw": ["热分离", "hot-stag", "hot stag"],
            },
            {
                "canonical": "首次入太空 ~148km / ~24000km/h",
                "kw": [
                    "148km",
                    "首次入太空",
                    "24000km",
                    "24,000km",
                    "150km高度",
                    "进入太空",
                ],
            },
        ],
        "failures": [
            {
                "canonical": "LOX 滤网堵塞 → 涡轮泵故障 → 助推器 ~90km 解体",
                "kw": [
                    "lox滤网",
                    "lox filter",
                    "涡轮泵",
                    "助推器爆炸",
                    "助推器解体",
                    "booster explod",
                ],
            },
            {
                "canonical": "飞船排气泄漏起火 AFSS 触发",
                "kw": ["飞船泄漏", "排气泄漏", "起火", "afss触发", "ship leak"],
            },
        ],
        "confirmed_wrong": [],
    },
    "IFT_3": {
        "date": "2024-03-14",
        "block": "Block 1",
        "progress": [
            {
                "canonical": "首次达近轨道速度 ~7.5km/s（亚轨道）",
                "kw": ["7.5km/s", "近轨道速度", "亚轨道速度", "轨道速度"],
            },
            {
                "canonical": "推进剂转移 demo (NASA Tipping Point LOX 转移)",
                "kw": ["推进剂转移", "tipping point", "lox转移", "propellant transfer"],
            },
            {"canonical": "Pez 舱门测试", "kw": ["pez", "pez舱门", "payload door"]},
        ],
        "failures": [
            {
                "canonical": "助推器 13 台中 6 台关机, 7 台中 2 台达主级 ~462m 失控",
                "kw": [
                    "6台关机",
                    "462m",
                    "助推器失控",
                    "boost-back failure",
                    "6 engines out",
                ],
            },
            {
                "canonical": "飞船滚转阀堵塞 ~65km 失联",
                "kw": [
                    "滚转阀",
                    "姿态阀",
                    "65km",
                    "失联",
                    "ship lost contact",
                    "roll control",
                ],
            },
        ],
        "confirmed_wrong": [],
    },
    "IFT_4": {
        "date": "2024-06-06",
        "block": "Block 1",
        "progress": [
            {
                "canonical": "双级首次受控溅落 (FAA 无需调查)",
                "kw": [
                    "首次受控溅落",
                    "受控溅落",
                    "soft splashdown",
                    "双级溅落",
                    "controlled splashdown",
                ],
            },
        ],
        "failures": [
            {
                "canonical": "1 台 Raptor 早期关机（1/33，不影响任务）",
                "kw": ["1台raptor", "1 engine out", "1台早期关机", "1/33关机"],
            },
            {
                "canonical": "热防护瓦/前襟翼严重受损",
                "kw": [
                    "热防护瓦",
                    "前襟翼",
                    "前鳍",
                    "瓦脱落",
                    "tile loss",
                    "flap damage",
                ],
            },
            {
                "canonical": "溅落偏差 ~6km (3.7 mi)",
                "kw": ["6km", "3.7mi", "splash偏差", "溅落偏差"],
            },
        ],
        "confirmed_wrong": [],
    },
    "IFT_5": {
        "date": "2024-10-13",
        "block": "Block 1",
        "progress": [
            {
                "canonical": "首次 Mechazilla 捕获 B12（航天史首次）",
                "kw": [
                    "mechazilla",
                    "捕获b12",
                    "捕获助推器",
                    "首次捕获",
                    "chopstick",
                    "航天史首次",
                    "mechazilla catch",
                ],
            },
            {"canonical": "飞船 212km 亚轨道", "kw": ["212km", "212 km亚轨道"]},
        ],
        "failures": [
            {
                "canonical": "飞船溅落后爆炸（计划内/属预期）",
                "kw": ["溅落后爆炸", "落水后侧翻", "splash然后爆炸", "ship explod"],
            },
        ],
        "confirmed_wrong": [],
    },
    "IFT_6": {
        "date": "2024-11-19",
        "block": "Block 1",
        "progress": [
            {
                "canonical": "Block 1 最后一飞 (S31/B13)",
                "kw": ["block 1最后", "s31", "b13", "block-1最后"],
            },
            {
                "canonical": "首次正近地点轨道 8×190km",
                "kw": ["8×190", "190km", "正近地点", "positive perigee"],
            },
            {
                "canonical": "首次在轨 Raptor 再点火 50×228km",
                "kw": [
                    "在轨重点火",
                    "在轨再点火",
                    "raptor restart",
                    "in-orbit reignition",
                    "228km",
                ],
            },
            {
                "canonical": "首次日照条件再入溅落",
                "kw": ["日照", "daylight reentry", "白天再入"],
            },
        ],
        "failures": [
            {
                "canonical": "天线受损 → 通信丢失 → B13 捕获中止",
                "kw": [
                    "天线受损",
                    "通信丢失",
                    "b13捕获中止",
                    "捕获中止",
                    "catch waved off",
                    "通信失败",
                ],
            },
        ],
        "confirmed_wrong": [
            {
                "canonical": "助推器未满足安全判定（实际是塔通信设施失败非助推器问题）",
                "kw": ["助推器未满足安全判定", "助推器未达安全"],
            },
        ],
    },
    "IFT_7": {
        "date": "2025-01-16",
        "block": "Block 2 / V2 (首飞)",
        "progress": [
            {
                "canonical": "Block 2 / V2 首飞 (B14 + S33)",
                "kw": [
                    "block 2首飞",
                    "v2首飞",
                    "b14+s33",
  
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #26** (2026-09-02): **`--no-web`/`--web` are inverted by the public benchmark runner**
  *Symptoms*: ## Summary `benchmarks/public/runner/run_subprocess.py` passes the parsed open-book flag directly into `resolve_closed_book()`, whose `override` parameter means *closed_book*. The two CLI flags therefore do the opposite of what their help text says.  ## Repro ```bash uv run python -m benchmarks.public.runner.run_subprocess \   --benchmark frontier_science_olympiad --limit 1 --no-web --out ./results/x ``` Log output: ``` Book policy: open-book (--web/--no-web) — web tools available ``` Passing `--web` instead yields `closed-book … web tools unbound`.  ## Cause ```python closed = resolve_closed_book(args.benchmark, getattr(args, "web", None)) ``` `args.web` is True for `--web` / False for `--no-web` (an *open-book* flag), while `resolve_closed_book(benchmark, override)` returns `override` as the closed-book decision.  ## Suggested fix ```python _web = getattr(args, "web", None) closed = resolve_closed_book(args.benchmark, None if _web is None else (not _web)) ``` Found while running FrontierScience-Olympiad locally; happy to send a PR.
  **Post-Mortem & Fix Analysis**:
  > @wayfind Thanks for reporting this!   We validated the issue and confirmed that it is reproducible: the explicit --web and --no-web flags are currently inverted, while the default benchmark policy is unaffected.  Your suggested fix looks right. If you wish to raise a PR, we'd be happy to review and accept it.
  > @dq-ai-dev I’ve implemented the fix and opened PR #29, which corrects the inversion of --web/--no-web in the public runner while preserving the default benchmark behavior.
  > @Samurai007AK @wayfind Thank you both for your contributions.

- **Issue #16** (2026-08-28): **TUI 在 iTerm2 上静默吞掉中文输入法提交（ime.py 的阈值修复覆盖不到这种失效）**
  *Symptoms*: ## 概述  在 iTerm2 上，用中文输入法向 TUI 输入框提交文字，**什么都不会出现** —— 没有字符， 没有乱码，也没有报错。同一个会话里敲英文一切正常。设置 `TEXTUAL_DISABLE_KITTY_KEY=1` 之后完全恢复。  这跟 `apodex/tui/ime.py` 已经处理的那个问题**不是同一回事**。那个模块修的是 「超长提交被还原成可见乱码」（`^[32;;26377:24456:...u`）。而这里是一个字节都没有 产出，所以现有的修复根本没有机会介入。  ## 环境  | | | |---|---| | 终端 | iTerm2 3.6.11（build 3.6.11） | | 系统 | macOS，Darwin 25.2.0（Apple Silicon） | | textual | 8.2.8 | | 模式 | `--mode react`，全屏 TUI | | `TERM` / `COLORTERM` | `xterm-256color` / `truecolor` | | 输入法 | macOS 自带拼音 |  ## 复现步骤  1. 在 iTerm2 里启动 TUI：`uv run frontier-agent --mode react` 2. 焦点放到输入框，切到中文输入法，打拼音，从候选窗口按空格/回车提交 3. 输入框里什么都没有。同一个输入框里敲英文正常 4. 加上 `TEXTUAL_DISABLE_KITTY_KEY=1` 重启 —— 中文输入恢复正常  ## 提交前我先验证过的事  `widen_escape_sequence_limit()` **确实被调用了**（`apodex/tui/app.py:449`），而且在 textual 8.2.8 上**确实生效** —— `_MAX_SEQUENCE_SEARCH_THRESHOLD` 仍然存在，默认值 仍然是 32。把 `ime_commit_sequence()` 直接喂给 `XTermParser`，行为跟 `ime.py` 里写的 分析完全一致：  ```python from textual._xterm_parser import XTermParser from apodex.tui.ime import ime_commit_sequence, widen_escape_sequence_limit ```  | 提交内容 | 序列长度 | 阈值 32（上游默认） | 阈值 512（修复后） | |---|---|---|---| | `你好世界`（4 字） | 29 | 4 个正确的 `Key` 事件 | 4 个正确的 `Key` 事件 | | `有很大差别`（5 字） | 36 | **36 个乱码 `Key` 事件**（`^`、`[`、`3`、`2`…） | 5 个正确的 `Key` 事件 | | `我需要中文打字啊`（8 字） | 54 | **54 个乱码 `Key` 事件** | 8 个正确的 `Key` 事件 |  也就是说，解析器层面的这个修复是可靠的。既然「加宽阈值能正确解析这些序列」是可证明的， 而我们在 iTerm2 上观察到的是**零个事件、而不是错误的事件**，那么结论只能是： **提交的文本压根没有以 Kitty 关联文本序列的形式抵达解析器** —— 丢失发生在 `_xterm_parser` 的上游。  我还没有抓到 iTerm2 在 `CSI > 25 u` 模式下实际发出的原始字节
  **Post-Mortem & Fix Analysis**:
  > Thank you for the detailed report. We confirmed that iTerm2 drops IME commits when Textual enables Kitty keyboard reporting.  [PR #20](https://github.com/ApodexAI/FrontierAgent/pull/20) adds an iTerm2 compatibility fallback and ensures it works for both native and Docker launches. Please verify it in your original environment and close the issue if it resolves the problem.  We also reviewed the concern about `widen_escape_sequence_limit()`. The workaround remains effective with Textual 8.2.8, and the existing regression tests will fail if the private Textual constant disappears or changes incompatibly. We therefore prefer CI as the compatibility guard rather than emitting a runtime warning that could become a false alarm if Textual fixes the limitation upstream.

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

### Incident Patch 1: `179709fe` (2026-10-02)
**Commit Message**: Merge pull request #37 from wisdom-pan/fix/preflight-workflow-resolution

fix(preflight): resolve registered workflow profile APIs

**File**: `tests/test_preflight_tool.py` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+"""Regression tests for the benchmark preflight helper."""
+
+from __future__ import annotations
+
+from typing import Any
+
+import pytest
+
+from tools.preflight import check_kernel_llm, check_workflow_llm
+
+
+class _RecordingLLM:
+    def __init__(self) -> None:
+        self.calls: list[tuple[list[dict[str, str]], dict[str, Any]]] = []
+
+    async def chat(self, messages: list[dict[str, str]], **kwargs: Any) -> None:
+        self.calls.append((messages, kwargs))
+
+
+@pytest.mark.parametrize(
+    ("pipeline", "module_name", "loader_name", "builder_name"),
+    [
+        (
+            "stateful-react-agent",
+            "workflows.stateful_react_agent.profile",
+            "load_react_profile",
+            "create_react_llm",
+        ),
+        (
+            "agent_team",
+            "workflows.agent_team.profile",
+            "load_swarm_profile",
+            "create_swarm_llm",
+        ),
+    ],
+)
+async def test_workflow_check_uses_current_profile_api(
+    monkeypatch: pytest.MonkeyPatch,
+    pipeline: str,
+    module_name: str,
+    loader_name: str,
+    builder_name: str,
+) -> None:
+    module = __import__(module_name, fromlist=[loader_name, builder_name])
+    llm = _RecordingLLM()
+    loaded: list[str] = []
+
+    def load_profile(name: str) -> dict[str, str]:
+        loaded.append(name)
+        return {"profile": name}
+
+    def create_llm(profile: dict[str, str]) -> _RecordingLLM:
+        assert profile == {"profile": "benchmark"}
+        return llm
+
+    monkeypatch.setattr(module, loader_name, load_profile)
+    monkeypatch.setattr(module, builder_name, create_llm)
+
+    assert await check_workflow_llm(pipeline, "benchmark") is None
+    assert loaded == ["benchmark"]
+    assert llm.calls == [([{"role": "user", "content": "hi"}], {"max_tokens": 1})]
+
+
+async def test_workflow_check_rejects_unknown_pipeline() -> None:
+    error = await check_workflow_llm("unknown-workflow", "default")
+
+    assert error is not None
+    assert "unknown pipeline 'unknown-workflow'" in error
+    assert "stateful-react-agent" in error
+    assert "agent_team" in error
+
+
+async def test_kernel_check_returns_client_construction_errors(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    from frontier_agent.infra import llm_adapter
+
+    def fail_to_create(_config: Any) -> None:
+        raise RuntimeError("cannot build client")
+
+    monkeypatch.setattr(llm_adapter, "create_llm", fail_to_create)
+
+    assert await check_kernel_llm() == "RuntimeError: cannot build client"
```

**File**: `tools/preflight.py` (modified, +44/-8)
```diff
@@ -11,16 +11,38 @@
 Exits non-zero with the fix, not just the error. Secrets are never printed —
 only whether each key is set.
 """
+
 from __future__ import annotations
 
 import argparse
 import asyncio
+import importlib
 import os
 import sys
 from pathlib import Path
 
 AH = Path(__file__).resolve().parents[1]
 
+_REACT_PROFILE_API = (
+    "workflows.stateful_react_agent.profile",
+    "load_react_profile",
+    "create_react_llm",
+)
+_AGENT_TEAM_PROFILE_API = (
+    "workflows.agent_team.profile",
+    "load_swarm_profile",
+    "create_swarm_llm",
+)
+# Public pipeline IDs are registry keys, not importable package names. Keep the
+# compatibility rows in sync with the aliases registered by each workflow.
+_WORKFLOW_PROFILE_APIS: dict[str, tuple[str, str, str]] = {
+    "stateful-react-agent": _REACT_PROFILE_API,
+    "agent_team": _AGENT_TEAM_PROFILE_API,
+    "agent-team": _AGENT_TEAM_PROFILE_API,
+    "agent_team_report": _AGENT_TEAM_PROFILE_API,
+    "agent-team-report": _AGENT_TEAM_PROFILE_API,
+}
+
 
 def report_env() -> None:
     """Report the resolved config, not raw os.environ.
@@ -30,6 +52,7 @@ def report_env() -> None:
     what the run will actually use.
     """
     from frontier_agent.infra.config import get_config
+
     c = get_config()
     print(f"  {'llm_provider':22} = {c.llm_provider or '<unset>'}")
     print(f"  {'openai_model':22} = {c.openai_model or '<unset>'}")
@@ -51,10 +74,11 @@ async def check_kernel_llm() -> str | None:
     """The LLM BenchmarkSession._bootstrap() builds from LLM_PROVIDER."""
     from frontier_agent.infra.config import get_config
     from frontier_agent.infra.llm_adapter import create_llm
+
     try:
         create_llm(get_config())
-    except ValueError as e:
-        if "Unknown LLM provider" in str(e):
+    except Exception as e:
+        if isinstance(e, ValueError) and "Unknown LLM provider" in str(e):
             return (
                 f"{e}\n"
                 f"      BenchmarkSession._bootstrap() builds a default LLM from\n"
@@ -63,20 +87,32 @@ async def check_kernel_llm() -> str | None:
                 f"      point OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL at the\n"
                 f"      endpoint you want (any OpenAI-compatible /v1 works)."
             )
-        return str(e)
+        return f"{type(e).__name__}: {e}"
     return None
 
 
 async def check_workflow_llm(pipeline: str, profile: str) -> str | None:
     """The LLM the workflow actually runs on, with the profile's sampling args."""
-    mod = f"workflows.{pipeline}.profile"
+    profile_api = _WORKFLOW_PROFILE_APIS.get(pipeline)
+    if profile_api is None:
+        return f"unknown pipeline {pipeline!r}; expected 'stateful-react-agent' or 'agent_team'"
+
+    module_name, loader_name, builder_name = profile_api
     try:
-        p = __import__(mod, fromlist=["load_profile", "create_llm"])
+        module = importlib.import_module(module_name)
     except ImportError as e:
-        return f"cannot import {mod}: {e}"
+        return f"cannot import {module_name}: {e}"
+
+    try:
+        load_profile = getattr(module, loader_name)
+        create_llm = getattr(module, builder_name)
+    except AttributeError as e:
+        return f"profile API mismatch in {module_name}: {e}"
+
     try:
-        # create_llm takes the whole profile dict and reads profile["llm"] itself
-        llm = p.create_llm(p.load_profile(profile))
+        # The workflow builders take the whole profile dict and read
+        # profile["llm"] themselves.
+        llm = create_llm(load_profile(profile))
     except Exception as e:
         return f"building the profile LLM failed: {type(e).__name__}: {e}"
 
```

---

### Incident Patch 2: `3f8375e5` (2026-10-02)
**Commit Message**: Merge pull request #42 from Samurai007AK/fix/39-saved-bash-allow-rule-bypass-via-command

fix(apodex): prevent saved Bash allow from bypassing typed confirm via substitution

**File**: `apodex/agent_tools.py` (modified, +8/-1)
```diff
@@ -419,7 +419,9 @@ def assess_with_rules(
     3. If ``auto_for_me`` is enabled (Docker / trusted env mode), any non-denied call
        is treated as safe.
     4. If the user saved an explicit ``allow`` rule for this command/tool, downgrade
-       ``RISK_CONFIRM`` to ``RISK_SAFE``.
+       ``RISK_CONFIRM`` to ``RISK_SAFE`` — unless the call carries a ``danger``
+       label (dep-install, force-push, delete, ...). A dangerous call never
+       downgrades: the typed-confirmation gate must still fire.
     """
     base = assess_tool_risk(name, args, cwd)
     if rules is not None and rules.denies(name, args):
@@ -428,6 +430,11 @@ def assess_with_rules(
         return base
     if auto_for_me:
         return ToolRisk(RISK_SAFE, "auto for me (docker/trusted env)", base.target)
+    if base.level == RISK_CONFIRM and base.danger:
+        # Saved allows only downgrade *plain* confirms. ``observers`` skips
+        # ``confirm()`` entirely when level is SAFE, so preserving ``danger``
+        # on a SAFE result would still bypass the typed-yes gate.
+        return base
     if base.level == RISK_CONFIRM and rules is not None and rules.allows(name, args):
         return ToolRisk(RISK_SAFE, "allowed by a saved rule", base.target)
     return base
```

**File**: `apodex/permissions.py` (modified, +268/-28)
```diff
@@ -5,14 +5,20 @@
 ``npm test``", "never allow ``git push``" — matched by command prefix, so the
 gate stays livable without being all-or-nothing.
 
-Rules are strings: ``Bash(npm test)`` / ``Bash(git push)`` for shell (matched by
-prefix across every ``&&``/``|``/``;`` segment, fail-safe), or a bare tool name
-(``write_file``) for everything else.
+Rules are strings: ``Bash(npm test)`` / ``Bash(git push)`` for shell, or a bare
+tool name (``write_file``) for everything else. Shell rules match by prefix per
+segment, where segments are split on ``&&``, ``||``, ``|``, ``;``, ``&`` and
+newlines. An allow must cover every segment and a deny fires on any one
+segment, so both fail safe.
 
 Safety contract: this store only ever *downgrades a plain confirm to safe*, or
 *forces a deny*. It is consulted in :func:`agent_tools.assess_tool_risk` AFTER
 danger detection and the hard denylist — so a saved ``Bash(git)`` allow can
-never green-light a dangerous ``git push --force``.
+never green-light a dangerous ``git push --force``. Every command the shell
+would run from a ``$(...)``, backtick or ``<(...)``/``>(...)`` substitution
+needs its own match against the saved allow prefixes. A deny prefix also fires
+on a command nested inside one. A command carrying a ``danger`` label never
+downgrades, so the typed-confirmation gate still fires.
 """
 
 from __future__ import annotations
@@ -30,12 +36,230 @@
     "git", "npm", "pnpm", "yarn", "uv", "pip", "pip3", "cargo", "go", "docker",
     "poetry", "conda", "make", "apt", "apt-get", "brew", "kubectl", "gh",
 })
-_SEGMENT_SPLIT = re.compile(r"&&|\|\||\||;")
+# Command separators: ``&&`` ``||`` ``|`` ``;``, a newline, and a single ``&``
+# (background). The ``&`` inside a redirection (``2>&1``, ``>&2``, ``&>log``)
+# is not a separator, and the lookarounds skip it.
+_SEGMENT_SPLIT = re.compile(r"&&|\|\||\||;|\n|(?<![<>])&(?![>&])")
+# How many levels of nested ``$(...)`` the matcher follows. Real commands use
+# one or two. Past this, allow fails closed and deny fires, instead of
+# recursing until Python raises RecursionError.
+_MAX_NEST_DEPTH = 16
 _HELPER_CMDS = frozenset({
     "cd", "pwd", "export", "set", "env", "echo", "mkdir", "clear", "true", "source", ".",
 })
 
 
+def _nested_shell_snippets(cmd: str) -> list[str]:
+    """Shell-code strings nested in ``$(...)``, backticks, ``<(...)`` and
+    ``>(...)``, which the shell runs as separate commands.
+
+    Reuses :func:`plugins.tools._bash_policy._extract_nested_shell` (stdlib-only,
+    no import cycle). It reads quotes the way bash does. A single-quoted span is
+    skipped, so ``echo '$(rm -rf /)'`` is a harmless literal. A ``'`` inside
+    double quotes is an ordinary character, so ``echo "'$(rm -rf /)'"`` still
+    yields ``rm -rf /``. If the import fails it uses
+    :func:`_fallback_nested_shell`, so matching never throws and never silently
+    allows. ``test_nested_shell_extractors_agree`` checks the two give the same
+    results.
+    """
+    try:
+        from plugins.tools._bash_policy import (  # type: ignore
+            _extract_nested_shell as _extract,
+        )
+
+        return list(_extract(cmd or ""))
+    except Exception:
+        return _fallback_nested_shell(cmd or "")
+
+
+def _fallback_backtick_body(command: str, i: int) -> tuple[str, int]:
+    """Read a backtick body and apply bash's first-pass escape removal.
+
+    Inside backticks, backslashes before $, `, a backslash or a newline are removed
+    before the body is parsed as shell code. Other backslashes are retained.
+    Return the decoded body and the closing backtick's index (len if absent).
+    """
+    body: list[str] = []
+    n = len(command)
+    while i < n:
+        c = command[i]
+        if c == "`":
+            break
+        if c == "\\" and i + 1 < n and command[i + 1] in "$`\\\n":
+            i += 1
+            if command[i] != "\n":
+                body.append(command[i])
+        else:
+            body.append(c)
+        i += 1
+    return "".join(body), i
+
+
+def _fallback_substitution_end(s: str, i: int) -> int:
+    """Index of the ``)`` closing a ``$(`` whose body starts at ``i`` (``len``
+    when unterminated). Quoted or escaped parens don't count, and every nested
+    ``$(`` starts with its own quote state, as in bash."""
+    n = len(s)
+    quotes: list[str | None] = [None]  # quote state of each open $( level
+    depths = [1]  # unquoted "(" nesting inside each open $( level
+    while i < n:
+        c = s[i]
+        quote = quotes[-1]
+        if quote == "'":
+            if c == "'":
+                quotes[-1] = None
+        elif c == "\\":
+            i += 1
+        elif s.startswith("(", i + 1) and (c == "$" or (c in "<>" and quote is None)):
+            quotes.append(None)
+            depths.append(1)
+            i += 1
+        elif c == "`":
+            i += 1
+            while i < n and s[i] != "`":
+                i += 2 if s[i] == "\\" else 1
+        elif c == '"'
```

**File**: `apodex/tests/test_features.py` (modified, +175/-0)
```diff
@@ -1352,6 +1352,181 @@ def test_assess_with_rules_layering(tmp_path):
     assert r2.level == RISK_SAFE
 
 
+def test_saved_allow_does_not_cover_substitution(tmp_path):
+    """Issue #39: ``Bash(echo)`` must not authorize ``echo $(pip install x)``."""
+    from apodex.agent_tools import RISK_CONFIRM, assess_with_rules
+    from apodex.permissions import PermissionStore
+
+    cwd = str(tmp_path)
+    rules = PermissionStore(allow={"Bash(echo)"})
+    assert not rules.allows("bash", {"command": "echo $(pip install evil-pkg)"})
+    assert not rules.allows("bash", {"command": "echo `pip install evil-pkg`"})
+    r = assess_with_rules(
+        "bash", {"command": "echo $(pip install evil-pkg)"}, cwd, rules
+    )
+    assert r.level == RISK_CONFIRM
+    assert r.danger == "installs dependencies"
+
+
+def test_saved_allow_does_not_cover_force_push(tmp_path):
+    """Issue #39: ``Bash(git push)`` must not downgrade a force-push confirm."""
+    from apodex.agent_tools import RISK_CONFIRM, assess_with_rules
+    from apodex.permissions import PermissionStore
+
+    cwd = str(tmp_path)
+    rules = PermissionStore(allow={"Bash(git push)"})
+    r = assess_with_rules(
+        "bash", {"command": "git push --force origin main"}, cwd, rules
+    )
+    assert r.level == RISK_CONFIRM
+    assert r.danger == "git force-push"
+
+
+def test_single_quoted_substitution_is_literal(tmp_path):
+    """Single-quoted ``$(...)`` is not expanded by the shell — still allowed."""
+    from apodex.permissions import PermissionStore
+
+    rules = PermissionStore(allow={"Bash(echo)"})
+    assert rules.allows("bash", {"command": "echo '$(pip install x)'"})
+    assert rules.allows("bash", {"command": r"echo \$(pip install x)"})  # escaped, so literal
+
+
+def test_deny_rule_still_matches_parent_of_substitution(tmp_path):
+    """A nested command that matches no rule must not cancel a deny (PR #42 review)."""
+    from apodex.agent_tools import RISK_DENY, assess_with_rules
+    from apodex.permissions import PermissionStore
+
+    cwd = str(tmp_path)
+    rules = PermissionStore(allow={"Bash(*)"}, deny={"Bash(echo)"})
+    cmd = {"command": "echo $(touch /tmp/marker)"}
+    assert rules.denies("bash", cmd)
+    assert assess_with_rules("bash", cmd, cwd, rules).level == RISK_DENY
+    # A deny prefix also fires on a command nested inside a substitution.
+    nested = PermissionStore(allow={"Bash(*)"}, deny={"Bash(touch)"})
+    assert assess_with_rules("bash", cmd, cwd, nested).level == RISK_DENY
+    # It also fires on any one top-level segment, not only when all of them match.
+    assert PermissionStore(deny={"Bash(git push)"}).denies(
+        "bash", {"command": "git status && git push origin main"}
+    )
+
+
+def test_helper_segment_substitution_needs_authorization(tmp_path):
+    """The helper filter must not hide a payload inside an echo segment (PR #42 review)."""
+    from apodex.agent_tools import RISK_CONFIRM, assess_with_rules
+    from apodex.permissions import PermissionStore
+
+    rules = PermissionStore(allow={"Bash(python)"})
+    cmd = {"command": "echo $(touch /tmp/marker) && python -V"}
+    assert not rules.allows("bash", cmd)
+    assert assess_with_rules("bash", cmd, str(tmp_path), rules).level == RISK_CONFIRM
+    assert rules.allows("bash", {"command": "echo hi && python -V"})  # a plain helper is still skipped
+    assert not rules.allows("bash", {"command": '"" && python -V'})  # empty word returns False, no IndexError
+
+
+def test_double_quoted_substitution_is_not_literal(tmp_path):
+    """A ``'`` inside ``"..."`` is an ordinary character, so ``$(...)`` still runs (PR #42 review)."""
+    from apodex.agent_tools import RISK_CONFIRM, assess_with_rules
+    from apodex.permissions import PermissionStore
+    from plugins.tools._bash_policy import assess_bash_command
+
+    rules = PermissionStore(allow={"Bash(echo)"})
+    for cmd in (
+        "echo \"'$(touch /tmp/marker)'\"",
+        r"echo \' $(touch /tmp/marker) \'",  # an escaped ' does not start a quoted span
+        r'''echo "a\"'$(touch /tmp/marker)'"''',  # an escaped " does not end the string
+        'echo $(echo ")"; touch /tmp/marker)',  # a quoted ")" does not end the substitution
+    ):
+        assert not rules.allows("bash", {"command": cmd}), cmd
+        assert assess_with_rules("bash", {"command": cmd}, str(tmp_path), rules).level == RISK_CONFIRM
+    # The sandbox bash policy uses the same extractor.
+    assert assess_bash_command("echo \"'$(foobarcmd)'\"", mode="enforce").level == "deny"
+
+
+def test_nested_shell_extractors_agree():
+    """The fallback scanner in permissions.py must match the shared extractor."""
+    from apodex.permissions import _fallback_nested_shell
+    from plugins.tools._bash_policy import _extract_nested_shell
+
+    corpus = {
+        "echo $(a)": ["a"],
+        "echo `b`": ["b"],
+        "echo '$(c)'": [],
+        "echo \"'$(d)'\"": ["d"],
+        r"echo \$(e)": [],
+        r"echo \' $(f) \
```

**File**: `plugins/tools/_bash_policy.py` (modified, +139/-26)
```diff
@@ -798,44 +798,157 @@ def _split_top_level(command: str) -> list[str]:
     return [s.strip() for s in segs if s.strip()]
 
 
+def _backtick_body(command: str, i: int) -> tuple[str, int]:
+    """Read a backtick body and apply bash's first-pass escape removal.
+
+    Inside backticks, backslashes before $, `, a backslash or a newline are removed
+    before the body is parsed as shell code. Other backslashes are retained.
+    Return the decoded body and the closing backtick's index (len if absent).
+    """
+    body: list[str] = []
+    n = len(command)
+    while i < n:
+        c = command[i]
+        if c == "`":
+            break
+        if c == "\\" and i + 1 < n and command[i + 1] in "$`\\\n":
+            i += 1
+            if command[i] != "\n":
+                body.append(command[i])
+        else:
+            body.append(c)
+        i += 1
+    return "".join(body), i
+
+
+def _substitution_end(command: str, i: int) -> int:
+    """Index of the ``)`` closing a ``$(`` whose body starts at ``i``, or
+    ``len(command)`` when unterminated. Quoted or escaped parens don't count,
+    so ``$(echo ")"; rm x)`` closes at the last ``)``, not inside the quotes.
+
+    Like bash, every nested ``$(`` starts with its own quote state, so the
+    quotes in ``$(echo "$(echo ")'")" $(rm x))`` pair up inside the inner
+    substitution and the scan still reaches ``rm x``. The scan keeps the levels
+    on a list instead of the call stack, so deep nesting can't hit the
+    recursion limit. It skips a backtick span whole.
+    """
+    n = len(command)
+    quotes: list[str | None] = [None]  # quote state of each open $( level
+    depths = [1]  # unquoted "(" nesting inside each open $( level
+    while i < n:
+        c = command[i]
+        quote = quotes[-1]
+        if quote == "'":
+            if c == "'":
+                quotes[-1] = None
+        elif c == "\\":
+            i += 1
+        elif command.startswith("(", i + 1) and (c == "$" or (c in "<>" and quote is None)):
+            quotes.append(None)
+            depths.append(1)
+            i += 1
+        elif c == "`":
+            i += 1
+            while i < n and command[i] != "`":
+                i += 2 if command[i] == "\\" else 1
+        elif c == '"':
+            quotes[-1] = None if quote else '"'
+        elif quote is None:
+            if c == "'":
+                quotes[-1] = "'"
+            elif c == "(":
+                depths[-1] += 1
+            elif c == ")":
+                depths[-1] -= 1
+                if depths[-1] == 0:
+                    if len(depths) == 1:
+                        return i
+                    depths.pop()
+                    quotes.pop()
+        i += 1
+    return n
+
+
+def _dup_redirect_word(command: str, i: int) -> str:
+    """The target word of a ``>&`` redirect that starts at ``i``, with its
+    quotes and backslashes removed.
+
+    bash expands that word a second time after quote removal, so
+    ``echo x >&'$(id)'`` runs ``id``. The stripped text is roughly what the
+    second pass sees. Dropping every backslash can only expose more ``$(``,
+    never hide one.
+    """
+    n = len(command)
+    while i < n and command[i] in " \t":
+        i += 1
+    start = i
+    quote: str | None = None
+    while i < n:
+        c = command[i]
+        if quote == "'":
+            if c == "'":
+                quote = None
+        elif c == "\\":
+            i += 1
+        elif command.startswith("$(", i):
+            i = _substitution_end(command, i + 2)
+        elif c == "`":
+            i += 1
+            while i < n and command[i] != "`":
+                i += 2 if command[i] == "\\" else 1
+        elif c == '"':
+            quote = None if quote else '"'
+        elif quote is None:
+            if c == "'":
+                quote = "'"
+            elif c.isspace() or c in ";&|<>()":
+                break
+        i += 1
+    return re.sub(r"[\\'\"]", "", command[start:i])
+
+
 def _extract_nested_shell(command: str) -> list[str]:
-    """Return shell-code strings nested in ``$(...)`` and backticks (which the
-    shell expands+executes). Single-quoted spans are skipped — the shell does
-    not expand them, so ``echo '$(rm -rf /)'`` is a harmless literal."""
+    """Return shell-code strings nested in ``$(...)``, backticks and unquoted
+    process substitution ``<(...)``/``>(...)`` (which the shell executes).
+
+    It reads quotes the way bash does. A single-quoted span is skipped, so
+    ``echo '$(rm -rf /)'`` is a harmless literal. Inside double quotes a ``'``
+    is an ordinary character and substitution still runs, so
+    ``echo "'$(rm -rf /)'"`` yields ``rm -rf /``. A backslash outside single
+    quotes escapes the next character (``\\$(...)``, ``\\'``, ``\\"``). An
+    unterminated substitution yields the rest of the string, which fails closed.
+    The one exception to quoting is the target of ``>&``, which bash expands
+    twice (see :func:`_dup
```

**File**: `tests/test_permissions_shell_expansion.py` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+"""Compare saved shell permissions with actual bash expansion semantics."""
+
+from __future__ import annotations
+
+import itertools
+import shlex
+import shutil
+import subprocess
+
+import pytest
+
+from apodex.agent_tools import RISK_CONFIRM, RISK_DENY, assess_with_rules
+from apodex.permissions import PermissionStore, _fallback_nested_shell
+from plugins.tools._bash_policy import _extract_nested_shell, assess_bash_command
+
+
+def _backtick(code: str) -> str:
+    """Encode a shell body for one legacy command-substitution level."""
+    escaped = "".join("\\" + c if c in "\\$`" else c for c in code)
+    return "`" + escaped + "`"
+
+
+@pytest.mark.parametrize("body,expected", [
+    (r"echo \$(touch marker)", "echo $(touch marker)"),
+    (r"echo \`touch marker\`", "echo `touch marker`"),
+    (r"echo \\$(touch marker)", r"echo \$(touch marker)"),
+    (r"echo \q", r"echo \q"),
+    ("echo to\\\nuch", "echo touch"),
+])
+def test_backtick_scanners_apply_bash_escape_removal(body, expected):
+    command = "echo `" + body + "`"
+    assert _extract_nested_shell(command) == [expected]
+    assert _fallback_nested_shell(command) == [expected]
+
+
+@pytest.mark.parametrize("command", [
+    r"echo `echo \$(foobarcmd)`",
+    r"echo `echo \`foobarcmd\``",
+    'echo "`echo \\$(foobarcmd)`"',
+])
+def test_backtick_escape_removal_reaches_enforced_policy(command):
+    assert assess_bash_command(command, mode="enforce").level == "deny"
+
+
+def test_saved_permissions_match_real_bash_nested_expansions(tmp_path):
+    """Every generated command actually runs touch; none may inherit echo's allow.
+
+    Mix both substitution syntaxes and double-quoted variants at each level.
+    Execute only harmless commands that write one marker in this test's folder.
+    """
+    bash = shutil.which("bash")
+    if bash is None:
+        pytest.skip("bash is needed for the shell-semantics comparison")
+    marker = tmp_path / "marker"
+    marker_word = shlex.quote(marker.as_posix())
+    allow = PermissionStore(allow={"Bash(echo)"})
+    deny = PermissionStore(allow={"Bash(*)"}, deny={"Bash(touch)"})
+    wrappers = (
+        lambda code: "echo $(" + code + ")",
+        lambda code: 'echo "$(' + code + ')"',
+        lambda code: "echo " + _backtick(code),
+        lambda code: 'echo "' + _backtick(code) + '"',
+    )
+    commands = []
+    for depth in range(1, 4):
+        for sequence in itertools.product(wrappers, repeat=depth):
+            command = "touch " + marker_word
+            for wrap in sequence:
+                command = wrap(command)
+            commands.append(command)
+    # The concrete review examples also include a second evaluation level.
+    commands.extend([
+        r"echo `echo \$(touch " + marker_word + r")`",
+        r"echo `echo \`touch " + marker_word + r"\``",
+        'echo $(echo "$(echo ")\'")" $(touch ' + marker_word + '))',
+    ])
+    for command in commands:
+        result = subprocess.run(
+            [bash, "--noprofile", "--norc", "-c", command],
+            cwd=tmp_path, capture_output=True, text=True, timeout=5,
+        )
+        assert result.returncode == 0, (command, result.stderr)
+        assert marker.exists(), command
+        marker.unlink()
+        args = {"command": command}
+        assert assess_with_rules("bash", args, str(tmp_path), allow).level == RISK_CONFIRM, command
+        assert assess_with_rules("bash", args, str(tmp_path), deny).level == RISK_DENY, command
+        assert _extract_nested_shell(command) == _fallback_nested_shell(command), command
+
+
+@pytest.mark.parametrize("command", [
+    "echo '$(touch marker)'",
+    "echo '`touch marker`'",
+    r"echo \`touch marker\`",
+    r"echo `echo '\$(touch marker)'`",
+    "echo $(echo literal)",
+    "echo `echo literal`",
+])
+def test_literal_and_authorized_backtick_payloads_stay_allowed(command):
+    assert PermissionStore(allow={"Bash(echo)"}).allows("bash", {"command": command})
```

---

### Incident Patch 3: `eac35181` (2026-10-02)
**Commit Message**: fix(apodex): decode backtick escapes before permission checks

**File**: `apodex/permissions.py` (modified, +25/-4)
```diff
@@ -72,6 +72,29 @@ def _nested_shell_snippets(cmd: str) -> list[str]:
         return _fallback_nested_shell(cmd or "")
 
 
+def _fallback_backtick_body(command: str, i: int) -> tuple[str, int]:
+    """Read a backtick body and apply bash's first-pass escape removal.
+
+    Inside backticks, backslashes before $, `, a backslash or a newline are removed
+    before the body is parsed as shell code. Other backslashes are retained.
+    Return the decoded body and the closing backtick's index (len if absent).
+    """
+    body: list[str] = []
+    n = len(command)
+    while i < n:
+        c = command[i]
+        if c == "`":
+            break
+        if c == "\\" and i + 1 < n and command[i + 1] in "$`\\\n":
+            i += 1
+            if command[i] != "\n":
+                body.append(command[i])
+        else:
+            body.append(c)
+        i += 1
+    return "".join(body), i
+
+
 def _fallback_substitution_end(s: str, i: int) -> int:
     """Index of the ``)`` closing a ``$(`` whose body starts at ``i`` (``len``
     when unterminated). Quoted or escaped parens don't count, and every nested
@@ -176,10 +199,8 @@ def _fallback_nested_shell(s: str) -> list[str]:
             i = end + 1
             continue
         elif c == "`":
-            j = i + 1
-            while j < n and s[j] != "`":
-                j += 2 if s[j] == "\\" else 1
-            out.append(s[i + 1 : j])
+            body, j = _fallback_backtick_body(s, i + 1)
+            out.append(body)
             i = j + 1
             continue
         elif c == ">" and quote is None and s.startswith("&", i + 1):
```

**File**: `plugins/tools/_bash_policy.py` (modified, +25/-4)
```diff
@@ -798,6 +798,29 @@ def _split_top_level(command: str) -> list[str]:
     return [s.strip() for s in segs if s.strip()]
 
 
+def _backtick_body(command: str, i: int) -> tuple[str, int]:
+    """Read a backtick body and apply bash's first-pass escape removal.
+
+    Inside backticks, backslashes before $, `, a backslash or a newline are removed
+    before the body is parsed as shell code. Other backslashes are retained.
+    Return the decoded body and the closing backtick's index (len if absent).
+    """
+    body: list[str] = []
+    n = len(command)
+    while i < n:
+        c = command[i]
+        if c == "`":
+            break
+        if c == "\\" and i + 1 < n and command[i + 1] in "$`\\\n":
+            i += 1
+            if command[i] != "\n":
+                body.append(command[i])
+        else:
+            body.append(c)
+        i += 1
+    return "".join(body), i
+
+
 def _substitution_end(command: str, i: int) -> int:
     """Index of the ``)`` closing a ``$(`` whose body starts at ``i``, or
     ``len(command)`` when unterminated. Quoted or escaped parens don't count,
@@ -920,10 +943,8 @@ def _extract_nested_shell(command: str) -> list[str]:
             i = end + 1
             continue
         elif c == "`":
-            j = i + 1
-            while j < n and command[j] != "`":
-                j += 2 if command[j] == "\\" else 1
-            out.append(command[i + 1:j])
+            body, j = _backtick_body(command, i + 1)
+            out.append(body)
             i = j + 1
             continue
         elif c == ">" and quote is None and command.startswith("&", i + 1):
```

**File**: `tests/test_permissions_shell_expansion.py` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+"""Compare saved shell permissions with actual bash expansion semantics."""
+
+from __future__ import annotations
+
+import itertools
+import shlex
+import shutil
+import subprocess
+
+import pytest
+
+from apodex.agent_tools import RISK_CONFIRM, RISK_DENY, assess_with_rules
+from apodex.permissions import PermissionStore, _fallback_nested_shell
+from plugins.tools._bash_policy import _extract_nested_shell, assess_bash_command
+
+
+def _backtick(code: str) -> str:
+    """Encode a shell body for one legacy command-substitution level."""
+    escaped = "".join("\\" + c if c in "\\$`" else c for c in code)
+    return "`" + escaped + "`"
+
+
+@pytest.mark.parametrize("body,expected", [
+    (r"echo \$(touch marker)", "echo $(touch marker)"),
+    (r"echo \`touch marker\`", "echo `touch marker`"),
+    (r"echo \\$(touch marker)", r"echo \$(touch marker)"),
+    (r"echo \q", r"echo \q"),
+    ("echo to\\\nuch", "echo touch"),
+])
+def test_backtick_scanners_apply_bash_escape_removal(body, expected):
+    command = "echo `" + body + "`"
+    assert _extract_nested_shell(command) == [expected]
+    assert _fallback_nested_shell(command) == [expected]
+
+
+@pytest.mark.parametrize("command", [
+    r"echo `echo \$(foobarcmd)`",
+    r"echo `echo \`foobarcmd\``",
+    'echo "`echo \\$(foobarcmd)`"',
+])
+def test_backtick_escape_removal_reaches_enforced_policy(command):
+    assert assess_bash_command(command, mode="enforce").level == "deny"
+
+
+def test_saved_permissions_match_real_bash_nested_expansions(tmp_path):
+    """Every generated command actually runs touch; none may inherit echo's allow.
+
+    Mix both substitution syntaxes and double-quoted variants at each level.
+    Execute only harmless commands that write one marker in this test's folder.
+    """
+    bash = shutil.which("bash")
+    if bash is None:
+        pytest.skip("bash is needed for the shell-semantics comparison")
+    marker = tmp_path / "marker"
+    marker_word = shlex.quote(marker.as_posix())
+    allow = PermissionStore(allow={"Bash(echo)"})
+    deny = PermissionStore(allow={"Bash(*)"}, deny={"Bash(touch)"})
+    wrappers = (
+        lambda code: "echo $(" + code + ")",
+        lambda code: 'echo "$(' + code + ')"',
+        lambda code: "echo " + _backtick(code),
+        lambda code: 'echo "' + _backtick(code) + '"',
+    )
+    commands = []
+    for depth in range(1, 4):
+        for sequence in itertools.product(wrappers, repeat=depth):
+            command = "touch " + marker_word
+            for wrap in sequence:
+                command = wrap(command)
+            commands.append(command)
+    # The concrete review examples also include a second evaluation level.
+    commands.extend([
+        r"echo `echo \$(touch " + marker_word + r")`",
+        r"echo `echo \`touch " + marker_word + r"\``",
+        'echo $(echo "$(echo ")\'")" $(touch ' + marker_word + '))',
+    ])
+    for command in commands:
+        result = subprocess.run(
+            [bash, "--noprofile", "--norc", "-c", command],
+            cwd=tmp_path, capture_output=True, text=True, timeout=5,
+        )
+        assert result.returncode == 0, (command, result.stderr)
+        assert marker.exists(), command
+        marker.unlink()
+        args = {"command": command}
+        assert assess_with_rules("bash", args, str(tmp_path), allow).level == RISK_CONFIRM, command
+        assert assess_with_rules("bash", args, str(tmp_path), deny).level == RISK_DENY, command
+        assert _extract_nested_shell(command) == _fallback_nested_shell(command), command
+
+
+@pytest.mark.parametrize("command", [
+    "echo '$(touch marker)'",
+    "echo '`touch marker`'",
+    r"echo \`touch marker\`",
+    r"echo `echo '\$(touch marker)'`",
+    "echo $(echo literal)",
+    "echo `echo literal`",
+])
+def test_literal_and_authorized_backtick_payloads_stay_allowed(command):
+    assert PermissionStore(allow={"Bash(echo)"}).allows("bash", {"command": command})
```

---

### Incident Patch 4: `ffcb816b` (2026-10-02)
**Commit Message**: Merge pull request #57 from Yi-111-a/docs-private-image-quickstart

docs(docker): correct the container quick start for the private image

**File**: `README.md` (modified, +5/-2)
```diff
@@ -236,11 +236,14 @@ Chinese-speaking macOS users can use the
 ## Containers and local models
 
 Pre-built `linux/amd64` and `linux/arm64` images are published to the GitHub
-Container Registry, so no local Python environment is needed:
+Container Registry, so no local Python environment is needed. That package is
+private, so `docker login ghcr.io` (with an account authorized for it) is
+required — otherwise build the checkout:
 
 ```bash
 cp .env.example .env
-docker compose run --rm agent
+docker compose -f compose.yaml -f compose.dev.yaml build
+docker compose -f compose.yaml -f compose.dev.yaml run --rm agent
 ```
 
 - [Run FrontierAgent in Docker](docs/install/docker.md) — Compose, image
```

**File**: `docs/install/README.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ without keeping a checkout around, use
 | macOS laptop or desktop | native, optionally Docker | hosted/remote endpoint | [macOS](macos.md) |
 | macOS or Linux, the CLI as a globally installed tool | `uv tool install`, native or Docker | hosted/remote endpoint | [Global install](global-install.md) |
 | Linux laptop, server, or CI without a local model | `scripts/run-linux.sh` (native, bubblewrap, or Docker) | hosted/remote endpoint | [Linux](linux.md) |
-| Any host with Docker and no local Python environment | published agent container | hosted/remote endpoint | [Docker and Compose](docker.md) |
+| Any host with Docker and no local Python environment | agent container built from this checkout (or the private published image) | hosted/remote endpoint | [Docker and Compose](docker.md) |
 | Linux bare metal or VM with an NVIDIA GPU and Docker daemon | native or agent container | SGLang container | [Linux NVIDIA + Docker](linux-nvidia.md) |
 | RunPod-style service that accepts your image at instance creation | inside the provider container | prebuilt FrontierAgent GPU image | [GPU cloud images](gpu-platforms.md) |
 | Existing x86_64 Linux GPU environment without nested Docker | `scripts/run-linux-gpu.sh` | isolated native SGLang process | [Linux NVIDIA native](linux-nvidia-native.md) |
```

**File**: `docs/install/docker.md` (modified, +76/-13)
```diff
@@ -2,8 +2,20 @@
 
 FrontierAgent publishes pre-built `linux/amd64` and `linux/arm64` images to the
 GitHub Container Registry. Using them requires no local Python environment and
-no system dependencies beyond Docker itself. The default `compose.yaml` pulls
-that published image; it does not build the repository locally.
+no system dependencies beyond Docker itself. The default `compose.yaml` uses
+that published image.
+
+That package is **private**, so an anonymous pull fails with `unauthorized`.
+You need one of:
+
+- a GitHub account or token already authorized for the package, in which case
+  run `docker login ghcr.io` first; or
+- a local build of this checkout, which is what the commands below do and
+  needs no registry access.
+
+Because `compose.yaml` sets `pull_policy: always`, the build path keeps the
+`compose.dev.yaml` override on every command — its `pull_policy: build` keeps
+the local image in use instead of retrying the registry.
 
 This page covers the CPU agent container. For a **local NVIDIA model server**,
 the GPU belongs to a separate SGLang container or process — use
@@ -20,14 +32,27 @@ git clone https://github.com/ApodexAI/FrontierAgent.git
 cd FrontierAgent
 cp .env.example .env
 
-# Interactive CLI
+# With registry access, the published image needs no build:
 docker compose run --rm agent
+```
+
+Without it, build from this checkout and keep the override on every command:
+
+```bash
+git clone https://github.com/ApodexAI/FrontierAgent.git
+cd FrontierAgent
+cp .env.example .env
+docker compose -f compose.yaml -f compose.dev.yaml build
+
+# Interactive CLI
+docker compose -f compose.yaml -f compose.dev.yaml run --rm agent
 
 # One-shot agent command
-docker compose run --rm agent -p "explain pyproject.toml"
+docker compose -f compose.yaml -f compose.dev.yaml run --rm agent \
+  -p "explain pyproject.toml"
 
 # Default benchmark evaluation (BrowseComp, one task)
-docker compose run --rm eval
+docker compose -f compose.yaml -f compose.dev.yaml run --rm eval
 ```
 
 Compose writes session records and deliverables to `.apodex/runs/<session-id>/`.
@@ -47,6 +72,10 @@ The convenience helper wraps the same thing:
 ./docker/run.sh eval --limit 5
 ```
 
+`run.sh` uses `compose.yaml` on its own, so it needs registry access to the
+private package. Keep the `compose.dev.yaml` override instead when building
+locally.
+
 ## Pin a release or another image
 
 Set `FRONTIER_AGENT_IMAGE` before running Compose:
@@ -56,13 +85,35 @@ FRONTIER_AGENT_IMAGE=ghcr.io/apodexai/frontieragent:latest \
   docker compose run --rm agent -p "explain pyproject.toml"
 ```
 
+Any image name works here, including one you built and tagged yourself, or one
+mirrored to a registry you can reach.
+
+A tag that exists only on this machine is the exception. `compose.yaml` sets
+`pull_policy: always`, so Compose would still try to resolve it from a registry.
+Pass `--pull never` so it uses the local image:
+
+```bash
+FRONTIER_AGENT_IMAGE=frontier-agent:local \
+  docker compose run --pull never --rm agent
+```
+
 ## Direct `docker run`
 
 Compose is the supported path; this is the equivalent for environments that
 cannot use it. The environment variables and mounts are not optional — they are
 what tells the runtime it is inside a container and where the three sandbox
 roots live.
 
+The command below runs `frontier-agent:local`, which you build from this
+checkout first, so it needs no registry access:
+
+```bash
+docker build -t frontier-agent:local .
+```
+
+To use the private published image instead, replace that tag with
+`ghcr.io/apodexai/frontieragent:latest` and `docker login ghcr.io` first.
+
 ```bash
 docker run --rm -it \
   --env-file .env \
@@ -84,7 +135,7 @@ docker run --rm -it \
   -v frontier-agent-state:/root/.apodex \
   -v frontier-agent-config:/root/.config/apodex \
   -w /workspace \
-  ghcr.io/apodexai/frontieragent:latest \
+  frontier-agent:local \
   -p "explain main workflow"
 ```
 
@@ -94,26 +145,33 @@ For a terminal deployment accessed over SSH:
 
 1. Provision an EC2 or ECS Linux instance with Docker and the Compose plugin.
 2. Clone this repository and create `.env` from `.env.example`.
-3. Pull and launch the pre-built container:
+3. Launch the container:
 
 ```bash
 git clone https://github.com/ApodexAI/FrontierAgent.git
 cd FrontierAgent
 cp .env.example .env
-# Edit .env, then:
+# Edit .env, then — one of:
+
+# With registry access, use the published image:
+docker login ghcr.io
 docker compose pull agent
 docker compose run --rm agent
+
+# Or build this checkout on the instance, no registry access needed:
+docker compose -f compose.yaml -f compose.dev.yaml build
+docker compose -f compose.yaml -f compose.dev.yaml run --rm agent
 ```
 
 The container itself is disposable; Compose persists sessions, configuration,
-attachments, and deliverables in volumes or the checked-out workspace. Pull the
-image again to upgrade. This is an interactive SSH/TUI deployment, not a
-long-running HTTP ser
```

**File**: `tests/test_container_image_docs.py` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+"""The documented container quick start must work without registry credentials.
+
+`ghcr.io/apodexai/frontieragent` is private by org policy — see the comment in
+`.github/workflows/docker-publish.yml` and the note in
+`docs/install/global-install.md`. An anonymous pull of it fails, so the
+user-facing quick start cannot promise a build-free `docker compose run`.
+
+`README.md`, `docs/install/docker.md` and the chooser table in
+`docs/install/README.md` all did promise exactly that, which sent anyone
+outside the org to an `unauthorized` error on their first command.
+
+These assertions fail on the pre-fix tree and pass after it.
+"""
+
+from __future__ import annotations
+
+import re
+from pathlib import Path
+
+import pytest
+
+_REPO_ROOT = Path(__file__).resolve().parents[1]
+
+# Every file that walks a reader through starting the container.
+_QUICKSTART_DOCS = (
+    "README.md",
+    "docs/install/docker.md",
+    "docs/install/README.md",
+)
+
+# Claims that cannot hold while the published image is private.
+_UNREACHABLE_CLAIMS = (
+    "no local build needed",
+    "does not build the repository locally",
+    "Pull and launch the pre-built container",
+)
+
+
+@pytest.mark.parametrize("rel_path", _QUICKSTART_DOCS)
+def test_quickstart_docs_say_the_image_is_private(rel_path: str) -> None:
+    """Each quick start has to acknowledge the private package."""
+    text = (_REPO_ROOT / rel_path).read_text(encoding="utf-8")
+    assert re.search(r"private", text, re.IGNORECASE), (
+        f"{rel_path} documents a container quick start but never says the "
+        "ghcr.io/apodexai/frontieragent package is private, so a reader "
+        "outside the org hits `unauthorized` on the first command"
+    )
+
+
+@pytest.mark.parametrize("rel_path", _QUICKSTART_DOCS)
+def test_quickstart_docs_drop_unreachable_claims(rel_path: str) -> None:
+    """The pre-fix wording promised a pull that cannot succeed anonymously."""
+    lowered = (_REPO_ROOT / rel_path).read_text(encoding="utf-8").lower()
+    for claim in _UNREACHABLE_CLAIMS:
+        assert claim not in lowered, (
+            f"{rel_path} still claims {claim!r}, which is false while the "
+            "published image is private"
+        )
+
+
+def _run_commands(text: str) -> list[str]:
+    """Every `docker compose ... run ...` invocation, joined across line wraps.
+
+    Two things make a naive per-line scan miss these: the compose file flags
+    sit between `compose` and `run`, and long invocations wrap onto the next
+    line with a trailing backslash.
+    """
+    joined = text.replace("\\\n", " ")
+    return [
+        line.strip()
+        for line in joined.splitlines()
+        if re.match(r"\s*docker compose\b.*\brun\b", line)
+    ]
+
+
+def test_docker_quickstart_offers_a_path_that_needs_no_registry() -> None:
+    """The local-build escape hatch has to be spelled out.
+
+    `compose.yaml` sets `pull_policy: always`, so the documented build path is
+    only usable if the commands keep the `compose.dev.yaml` override — its
+    `pull_policy: build` is what keeps the local image instead of retrying the
+    private registry.
+    """
+    text = (_REPO_ROOT / "docs/install/docker.md").read_text(encoding="utf-8")
+    assert "compose.dev.yaml" in text, (
+        "docs/install/docker.md offers no local-build path, but the published "
+        "image cannot be pulled anonymously"
+    )
+
+    build_blocks = re.findall(r"```bash\n(.*?)```", text, re.DOTALL)
+    offenders = [
+        command
+        for block in build_blocks
+        if "compose.dev.yaml build" in block
+        for command in _run_commands(block)
+        if "compose.dev.yaml" not in command and "docker login" not in block
+    ]
+    assert not offenders, (
+        "a block that builds locally then runs without compose.dev.yaml, so "
+        "compose.yaml's pull_policy: always re-fetches the private image: " + "; ".join(offenders)
+    )
+
+
+def test_documented_local_tag_opts_out_of_the_registry() -> None:
+    """A locally built tag has to say `--pull never` to be usable.
+
+    `compose.yaml` sets `pull_policy: always`, so `FRONTIER_AGENT_IMAGE` pointed at a
+    tag that exists only on this machine still makes Compose resolve it against a
+    registry and fail.
+    """
+    text = (_REPO_ROOT / "docs/install/docker.md").read_text(encoding="utf-8")
+    # The local-tag example is prefixed with FRONTIER_AGENT_IMAGE=..., which `_run_commands`
+    # only matches when `docker compose` starts the line.
+    joined = text.replace("\\\n", " ")
+    local_runs = [
+        line.strip()
+        for line in joined.splitlines()
+        if re.match(r"\s*(?:[A-Z_][A-Z0-9_]*=\S+\s+)?docker compose\b.*\brun\b", line)
+        and "frontier-agent:local" in line
+    ]
+    assert local_runs, (
+        "docs/install/docker.md documents a locally built tag but never runs it "
+        "through Compose, so there is no local-only example to check"
+    )
+    of
```

---

### Incident Patch 5: `d308d23f` (2026-10-02)
**Commit Message**: docs(docker): document --pull never for locally built tags

Two follow-ups to the review on #57.

"Pin a release or another image" says any image name works, including one you
built and tagged yourself, but the command above it still runs against
compose.yaml, which sets pull_policy: always. A tag that exists only on the
machine would still be resolved against a registry. That section now has its
own example that opts out:

FRONTIER_AGENT_IMAGE=frontier-agent:local \
  docker compose run --pull never --rm agent

The "Direct docker run" section called the reference below the private
published image while the command had been changed to frontier-agent:local. It
now says which tag the command runs, and points at the published image for the
registry case instead.

Adds test_documented_local_tag_opts_out_of_the_registry, which fails if a
compose run of a local tag loses --pull never. Confirmed by removing the flag
and watching that one test fail.

python -m pytest tests/test_container_image_docs.py — 9 passed.

**File**: `docs/install/docker.md` (modified, +14/-2)
```diff
@@ -88,20 +88,32 @@ FRONTIER_AGENT_IMAGE=ghcr.io/apodexai/frontieragent:latest \
 Any image name works here, including one you built and tagged yourself, or one
 mirrored to a registry you can reach.
 
+A tag that exists only on this machine is the exception. `compose.yaml` sets
+`pull_policy: always`, so Compose would still try to resolve it from a registry.
+Pass `--pull never` so it uses the local image:
+
+```bash
+FRONTIER_AGENT_IMAGE=frontier-agent:local \
+  docker compose run --pull never --rm agent
+```
+
 ## Direct `docker run`
 
 Compose is the supported path; this is the equivalent for environments that
 cannot use it. The environment variables and mounts are not optional — they are
 what tells the runtime it is inside a container and where the three sandbox
 roots live.
 
-The image reference below is the private published image, so it needs registry
-access. To run without it, build the checkout and use that tag instead:
+The command below runs `frontier-agent:local`, which you build from this
+checkout first, so it needs no registry access:
 
 ```bash
 docker build -t frontier-agent:local .
 ```
 
+To use the private published image instead, replace that tag with
+`ghcr.io/apodexai/frontieragent:latest` and `docker login ghcr.io` first.
+
 ```bash
 docker run --rm -it \
   --env-file .env \
```

**File**: `tests/test_container_image_docs.py` (modified, +28/-0)
```diff
@@ -101,6 +101,34 @@ def test_docker_quickstart_offers_a_path_that_needs_no_registry() -> None:
     )
 
 
+def test_documented_local_tag_opts_out_of_the_registry() -> None:
+    """A locally built tag has to say `--pull never` to be usable.
+
+    `compose.yaml` sets `pull_policy: always`, so `FRONTIER_AGENT_IMAGE` pointed at a
+    tag that exists only on this machine still makes Compose resolve it against a
+    registry and fail.
+    """
+    text = (_REPO_ROOT / "docs/install/docker.md").read_text(encoding="utf-8")
+    # The local-tag example is prefixed with FRONTIER_AGENT_IMAGE=..., which `_run_commands`
+    # only matches when `docker compose` starts the line.
+    joined = text.replace("\\\n", " ")
+    local_runs = [
+        line.strip()
+        for line in joined.splitlines()
+        if re.match(r"\s*(?:[A-Z_][A-Z0-9_]*=\S+\s+)?docker compose\b.*\brun\b", line)
+        and "frontier-agent:local" in line
+    ]
+    assert local_runs, (
+        "docs/install/docker.md documents a locally built tag but never runs it "
+        "through Compose, so there is no local-only example to check"
+    )
+    offenders = [command for command in local_runs if "--pull never" not in command]
+    assert not offenders, (
+        "a locally built tag without --pull never is re-fetched from the registry "
+        "by compose.yaml's pull_policy: always: " + "; ".join(offenders)
+    )
+
+
 def test_readme_quickstart_offers_a_path_that_needs_no_registry() -> None:
     """The README snippet is the most-read entry point for the container path."""
     text = (_REPO_ROOT / "README.md").read_text(encoding="utf-8")
```

---

### Incident Patch 6: `c2fd303f` (2026-10-02)
**Commit Message**: fix(apodex): give each nested substitution its own quote state

Follow-up to the second review.

- _substitution_end shared one quote state across nested $(...), so the
  quotes in `echo $(echo "$(echo ")'")" $(touch x))` paired across levels and
  the scan stopped before `touch x`. Each nested $( now starts with its own
  quote state, kept on a list instead of the call stack. The fallback scanner
  in permissions.py has the same change.
- The allow check split a nested snippet on ;/&&/| before reading its inner
  payloads. The split ignores quotes, so a quoted ";" could cut a string in
  half and hide $(...) in what then looked like a single-quoted span. Inner
  payloads now come from the whole snippet.
- Allow and deny stop after 16 levels of nesting. Past that, allow returns
  False and deny returns True. Before, very deep nesting raised RecursionError.
- Segments are also split on a single & and on newlines, without touching the
  & inside 2>&1, >&2 or &>file. `echo hi & touch x` no longer passes
  Bash(echo).
- <(...) and >(...) count as nested commands, like $(...).
- bash expands the target of >&word a second time after quote removal, so
  `echo x >&'$(touch m)'` runs touch.

**File**: `apodex/permissions.py` (modified, +99/-31)
```diff
@@ -7,14 +7,15 @@
 
 Rules are strings: ``Bash(npm test)`` / ``Bash(git push)`` for shell, or a bare
 tool name (``write_file``) for everything else. Shell rules match by prefix per
-``&&``/``|``/``;`` segment. An allow must cover every segment and a deny fires
-on any one segment, so both fail safe.
+segment, where segments are split on ``&&``, ``||``, ``|``, ``;``, ``&`` and
+newlines. An allow must cover every segment and a deny fires on any one
+segment, so both fail safe.
 
 Safety contract: this store only ever *downgrades a plain confirm to safe*, or
 *forces a deny*. It is consulted in :func:`agent_tools.assess_tool_risk` AFTER
 danger detection and the hard denylist — so a saved ``Bash(git)`` allow can
-never green-light a dangerous ``git push --force``. Every ``$(...)`` or
-backtick substitution the shell would run, unquoted or inside double quotes,
+never green-light a dangerous ``git push --force``. Every command the shell
+would run from a ``$(...)``, backtick or ``<(...)``/``>(...)`` substitution
 needs its own match against the saved allow prefixes. A deny prefix also fires
 on a command nested inside one. A command carrying a ``danger`` label never
 downgrades, so the typed-confirmation gate still fires.
@@ -35,14 +36,22 @@
     "git", "npm", "pnpm", "yarn", "uv", "pip", "pip3", "cargo", "go", "docker",
     "poetry", "conda", "make", "apt", "apt-get", "brew", "kubectl", "gh",
 })
-_SEGMENT_SPLIT = re.compile(r"&&|\|\||\||;")
+# Command separators: ``&&`` ``||`` ``|`` ``;``, a newline, and a single ``&``
+# (background). The ``&`` inside a redirection (``2>&1``, ``>&2``, ``&>log``)
+# is not a separator, and the lookarounds skip it.
+_SEGMENT_SPLIT = re.compile(r"&&|\|\||\||;|\n|(?<![<>])&(?![>&])")
+# How many levels of nested ``$(...)`` the matcher follows. Real commands use
+# one or two. Past this, allow fails closed and deny fires, instead of
+# recursing until Python raises RecursionError.
+_MAX_NEST_DEPTH = 16
 _HELPER_CMDS = frozenset({
     "cd", "pwd", "export", "set", "env", "echo", "mkdir", "clear", "true", "source", ".",
 })
 
 
 def _nested_shell_snippets(cmd: str) -> list[str]:
-    """Shell-code strings nested in ``$(...)``/backticks the shell would run.
+    """Shell-code strings nested in ``$(...)``, backticks, ``<(...)`` and
+    ``>(...)``, which the shell runs as separate commands.
 
     Reuses :func:`plugins.tools._bash_policy._extract_nested_shell` (stdlib-only,
     no import cycle). It reads quotes the way bash does. A single-quoted span is
@@ -65,8 +74,52 @@ def _nested_shell_snippets(cmd: str) -> list[str]:
 
 def _fallback_substitution_end(s: str, i: int) -> int:
     """Index of the ``)`` closing a ``$(`` whose body starts at ``i`` (``len``
-    when unterminated); quoted or escaped parens don't count."""
-    depth, n = 1, len(s)
+    when unterminated). Quoted or escaped parens don't count, and every nested
+    ``$(`` starts with its own quote state, as in bash."""
+    n = len(s)
+    quotes: list[str | None] = [None]  # quote state of each open $( level
+    depths = [1]  # unquoted "(" nesting inside each open $( level
+    while i < n:
+        c = s[i]
+        quote = quotes[-1]
+        if quote == "'":
+            if c == "'":
+                quotes[-1] = None
+        elif c == "\\":
+            i += 1
+        elif s.startswith("(", i + 1) and (c == "$" or (c in "<>" and quote is None)):
+            quotes.append(None)
+            depths.append(1)
+            i += 1
+        elif c == "`":
+            i += 1
+            while i < n and s[i] != "`":
+                i += 2 if s[i] == "\\" else 1
+        elif c == '"':
+            quotes[-1] = None if quote else '"'
+        elif quote is None:
+            if c == "'":
+                quotes[-1] = "'"
+            elif c == "(":
+                depths[-1] += 1
+            elif c == ")":
+                depths[-1] -= 1
+                if depths[-1] == 0:
+                    if len(depths) == 1:
+                        return i
+                    depths.pop()
+                    quotes.pop()
+        i += 1
+    return n
+
+
+def _fallback_dup_redirect_word(s: str, i: int) -> str:
+    """Target word of a ``>&`` redirect starting at ``i``, quotes and
+    backslashes removed. bash expands it a second time after quote removal."""
+    n = len(s)
+    while i < n and s[i] in " \t":
+        i += 1
+    start = i
     quote: str | None = None
     while i < n:
         c = s[i]
@@ -75,26 +128,30 @@ def _fallback_substitution_end(s: str, i: int) -> int:
                 quote = None
         elif c == "\\":
             i += 1
+        elif s.startswith("$(", i):
+            i = _fallback_substitution_end(s, i + 2)
+        elif c == "`":
+            i += 1
+            while i < n and s[i] != "`":
+                i += 2 if s[i] == "\\" else 1
         elif c == '"':
             quote = None if quote else '"'
         elif quote is None:
             if c == "'":
                 qu
```

**File**: `apodex/tests/test_features.py` (modified, +62/-0)
```diff
@@ -1397,12 +1397,74 @@ def test_nested_shell_extractors_agree():
         "echo $(i $(j))": ["i $(j)"],
         "echo $(unterminated": ["unterminated"],
         r"echo \`k\`": [],
+        """echo $(echo "$(echo ")'")" $(l))""": ["""echo "$(echo ")'")" $(l)"""],
+        "cat <(m) >(n)": ["m", "n"],
+        'echo "<(o)"': [],
+        "echo x >&'$(p)'": ["p"],
+        "echo x > '$(q)'": [],
+        "python x.py 2>&1": [],
     }
     for cmd, want in corpus.items():
         assert _extract_nested_shell(cmd) == want, cmd
         assert _fallback_nested_shell(cmd) == want, cmd
 
 
+def test_nested_quotes_do_not_end_the_outer_substitution(tmp_path):
+    """Each nested ``$(`` has its own quote state (PR #42 second review)."""
+    from apodex.agent_tools import RISK_CONFIRM, assess_with_rules
+    from apodex.permissions import PermissionStore
+
+    rules = PermissionStore(allow={"Bash(echo)"})
+    for cmd in (
+        """echo $(echo "$(echo ")'")" $(touch /tmp/marker))""",
+        # A quoted ";" must not split the snippet before its payloads are read.
+        """echo $(echo "a;echo '" $(touch /tmp/marker) "'")""",
+    ):
+        assert not rules.allows("bash", {"command": cmd}), cmd
+        assert assess_with_rules("bash", {"command": cmd}, str(tmp_path), rules).level == RISK_CONFIRM
+    assert rules.allows("bash", {"command": """echo $(echo "$(echo ")'")")"""})
+
+
+def test_separators_and_process_substitution_need_authorization():
+    """``&``, newlines and ``<(...)``/``>(...)`` all run another command."""
+    from apodex.permissions import PermissionStore
+
+    rules = PermissionStore(allow={"Bash(echo)", "Bash(python)", "Bash(cat)"})
+    for cmd in ("echo hi & touch /tmp/marker", "echo hi\ntouch /tmp/marker",
+                "cat <(touch /tmp/marker)", "echo >(touch /tmp/marker)"):
+        assert not rules.allows("bash", {"command": cmd}), cmd
+    # The "&" in a redirection is not a separator.
+    for cmd in ("python x.py 2>&1", "python x.py >&2", "python x.py &> out.log",
+                "python x.py &", "cat <(echo a)", 'echo "<(touch /tmp/marker)"'):
+        assert rules.allows("bash", {"command": cmd}), cmd
+    assert PermissionStore(deny={"Bash(touch)"}).denies(
+        "bash", {"command": "echo hi & touch /tmp/marker"}
+    )
+
+
+def test_dup_redirect_target_is_expanded_twice(tmp_path):
+    """bash expands a ``>&word`` target again after quote removal, so
+    ``echo x >&'$(touch m)'`` runs ``touch`` despite the single quotes."""
+    from apodex.agent_tools import RISK_CONFIRM, assess_with_rules
+    from apodex.permissions import PermissionStore
+    from plugins.tools._bash_policy import assess_bash_command
+
+    rules = PermissionStore(allow={"Bash(echo)"})
+    cmd = {"command": "echo x >&'$(touch /tmp/marker)'"}
+    assert not rules.allows("bash", cmd)
+    assert assess_with_rules("bash", cmd, str(tmp_path), rules).level == RISK_CONFIRM
+    assert rules.allows("bash", {"command": "echo x > '$(touch /tmp/marker)'"})  # plain > is literal
+    assert assess_bash_command("echo x >&'$(foobarcmd)'", mode="enforce").level == "deny"
+
+
+def test_deep_nesting_fails_closed_without_recursion_error():
+    from apodex.permissions import PermissionStore
+
+    cmd = {"command": "echo " + "$(echo " * 2000 + "x" + ")" * 2000}
+    assert not PermissionStore(allow={"Bash(echo)"}).allows("bash", cmd)
+    assert PermissionStore(allow={"Bash(*)"}, deny={"Bash(rm)"}).denies("bash", cmd)
+
+
 def test_user_settings_save_and_load(tmp_path):
     from apodex.config import UserSettings
     p = str(tmp_path / "settings.json")
```

**File**: `plugins/tools/_bash_policy.py` (modified, +74/-12)
```diff
@@ -801,8 +801,64 @@ def _split_top_level(command: str) -> list[str]:
 def _substitution_end(command: str, i: int) -> int:
     """Index of the ``)`` closing a ``$(`` whose body starts at ``i``, or
     ``len(command)`` when unterminated. Quoted or escaped parens don't count,
-    so ``$(echo ")"; rm x)`` closes at the last ``)``, not inside the quotes."""
-    depth, n = 1, len(command)
+    so ``$(echo ")"; rm x)`` closes at the last ``)``, not inside the quotes.
+
+    Like bash, every nested ``$(`` starts with its own quote state, so the
+    quotes in ``$(echo "$(echo ")'")" $(rm x))`` pair up inside the inner
+    substitution and the scan still reaches ``rm x``. The scan keeps the levels
+    on a list instead of the call stack, so deep nesting can't hit the
+    recursion limit. It skips a backtick span whole.
+    """
+    n = len(command)
+    quotes: list[str | None] = [None]  # quote state of each open $( level
+    depths = [1]  # unquoted "(" nesting inside each open $( level
+    while i < n:
+        c = command[i]
+        quote = quotes[-1]
+        if quote == "'":
+            if c == "'":
+                quotes[-1] = None
+        elif c == "\\":
+            i += 1
+        elif command.startswith("(", i + 1) and (c == "$" or (c in "<>" and quote is None)):
+            quotes.append(None)
+            depths.append(1)
+            i += 1
+        elif c == "`":
+            i += 1
+            while i < n and command[i] != "`":
+                i += 2 if command[i] == "\\" else 1
+        elif c == '"':
+            quotes[-1] = None if quote else '"'
+        elif quote is None:
+            if c == "'":
+                quotes[-1] = "'"
+            elif c == "(":
+                depths[-1] += 1
+            elif c == ")":
+                depths[-1] -= 1
+                if depths[-1] == 0:
+                    if len(depths) == 1:
+                        return i
+                    depths.pop()
+                    quotes.pop()
+        i += 1
+    return n
+
+
+def _dup_redirect_word(command: str, i: int) -> str:
+    """The target word of a ``>&`` redirect that starts at ``i``, with its
+    quotes and backslashes removed.
+
+    bash expands that word a second time after quote removal, so
+    ``echo x >&'$(id)'`` runs ``id``. The stripped text is roughly what the
+    second pass sees. Dropping every backslash can only expose more ``$(``,
+    never hide one.
+    """
+    n = len(command)
+    while i < n and command[i] in " \t":
+        i += 1
+    start = i
     quote: str | None = None
     while i < n:
         c = command[i]
@@ -811,31 +867,35 @@ def _substitution_end(command: str, i: int) -> int:
                 quote = None
         elif c == "\\":
             i += 1
+        elif command.startswith("$(", i):
+            i = _substitution_end(command, i + 2)
+        elif c == "`":
+            i += 1
+            while i < n and command[i] != "`":
+                i += 2 if command[i] == "\\" else 1
         elif c == '"':
             quote = None if quote else '"'
         elif quote is None:
             if c == "'":
                 quote = "'"
-            elif c == "(":
-                depth += 1
-            elif c == ")":
-                depth -= 1
-                if depth == 0:
-                    return i
+            elif c.isspace() or c in ";&|<>()":
+                break
         i += 1
-    return n
+    return re.sub(r"[\\'\"]", "", command[start:i])
 
 
 def _extract_nested_shell(command: str) -> list[str]:
-    """Return shell-code strings nested in ``$(...)`` and backticks (which the
-    shell expands+executes).
+    """Return shell-code strings nested in ``$(...)``, backticks and unquoted
+    process substitution ``<(...)``/``>(...)`` (which the shell executes).
 
     It reads quotes the way bash does. A single-quoted span is skipped, so
     ``echo '$(rm -rf /)'`` is a harmless literal. Inside double quotes a ``'``
     is an ordinary character and substitution still runs, so
     ``echo "'$(rm -rf /)'"`` yields ``rm -rf /``. A backslash outside single
     quotes escapes the next character (``\\$(...)``, ``\\'``, ``\\"``). An
     unterminated substitution yields the rest of the string, which fails closed.
+    The one exception to quoting is the target of ``>&``, which bash expands
+    twice (see :func:`_dup_redirect_word`).
     """
     out: list[str] = []
     i, n = 0, len(command)
@@ -854,7 +914,7 @@ def _extract_nested_shell(command: str) -> list[str]:
             quote = "'"
         elif c == '"':
             quote = None if quote else '"'
-        elif c == "$" and command.startswith("(", i + 1):
+        elif command.startswith("(", i + 1) and (c == "$" or (c in "<>" and quote is None)):
             end = _substitution_end(command, i + 2)
             out.append(command[i + 2:end])
             i = end + 1
@@ -866,6 +926,8 @@ def _extract_nested_shell(command: str) -> list[str]:
             out.append(command[i + 
```

---

### Incident Patch 7: `743c26ac` (2026-10-02)
**Commit Message**: fix(apodex): check nested substitutions in deny rules, helper segments and double quotes

Follow-up to the review on #42.

- Allow and deny are now separate checks. An allow still needs every segment
  and every nested payload to match. A deny now fires when any segment
  matches, top-level or nested. With allow Bash(*) and deny Bash(echo),
  `echo $(touch x)` is denied again.
- The allow check collects $(...) and backtick payloads from the whole command
  before the helper filter runs. With only Bash(python) allowed,
  `echo $(touch x) && python -V` now goes to confirm.
- _extract_nested_shell and the fallback scanner in permissions.py track
  double quotes and backslash escapes. `echo "'$(touch x)'"` now yields
  `touch x`, while `echo '$(x)'` and `echo \$(x)` stay literal. A quoted ")"
  no longer ends a substitution early. The bash policy uses the same
  extractor, so enforce mode now denies `echo "'$(foobarcmd)'"` too.
- A segment that is an empty word (`"" && python -V`) no longer raises
  IndexError.

Tests: one regression test per case, plus a test that the two scanners return
the same results. The new tests fail on the previous commit and pass on this
one. The full pytest 

**File**: `apodex/permissions.py` (modified, +131/-71)
```diff
@@ -5,17 +5,19 @@
 ``npm test``", "never allow ``git push``" — matched by command prefix, so the
 gate stays livable without being all-or-nothing.
 
-Rules are strings: ``Bash(npm test)`` / ``Bash(git push)`` for shell (matched by
-prefix across every ``&&``/``|``/``;`` segment, fail-safe), or a bare tool name
-(``write_file``) for everything else.
+Rules are strings: ``Bash(npm test)`` / ``Bash(git push)`` for shell, or a bare
+tool name (``write_file``) for everything else. Shell rules match by prefix per
+``&&``/``|``/``;`` segment. An allow must cover every segment and a deny fires
+on any one segment, so both fail safe.
 
 Safety contract: this store only ever *downgrades a plain confirm to safe*, or
 *forces a deny*. It is consulted in :func:`agent_tools.assess_tool_risk` AFTER
 danger detection and the hard denylist — so a saved ``Bash(git)`` allow can
-never green-light a dangerous ``git push --force``. Unquoted ``$(...)`` and
-backtick substitutions must be separately authorized against the same saved
-prefixes, and a command carrying a ``danger`` label never downgrades (the
-typed-confirmation gate still fires).
+never green-light a dangerous ``git push --force``. Every ``$(...)`` or
+backtick substitution the shell would run, unquoted or inside double quotes,
+needs its own match against the saved allow prefixes. A deny prefix also fires
+on a command nested inside one. A command carrying a ``danger`` label never
+downgrades, so the typed-confirmation gate still fires.
 """
 
 from __future__ import annotations
@@ -40,13 +42,16 @@
 
 
 def _nested_shell_snippets(cmd: str) -> list[str]:
-    """Shell-code strings nested in unquoted ``$(...)``/backticks.
+    """Shell-code strings nested in ``$(...)``/backticks the shell would run.
 
     Reuses :func:`plugins.tools._bash_policy._extract_nested_shell` (stdlib-only,
-    no import cycle). Single-quoted spans are skipped — the shell does not expand
-    them, so ``echo '$(rm -rf /)'`` is a harmless literal. Falls back to a small
-    self-contained scanner when the import fails so matching never throws and
-    never silently allows.
+    no import cycle). It reads quotes the way bash does. A single-quoted span is
+    skipped, so ``echo '$(rm -rf /)'`` is a harmless literal. A ``'`` inside
+    double quotes is an ordinary character, so ``echo "'$(rm -rf /)'"`` still
+    yields ``rm -rf /``. If the import fails it uses
+    :func:`_fallback_nested_shell`, so matching never throws and never silently
+    allows. ``test_nested_shell_extractors_agree`` checks the two give the same
+    results.
     """
     try:
         from plugins.tools._bash_policy import (  # type: ignore
@@ -55,40 +60,68 @@ def _nested_shell_snippets(cmd: str) -> list[str]:
 
         return list(_extract(cmd or ""))
     except Exception:
-        pass
+        return _fallback_nested_shell(cmd or "")
+
+
+def _fallback_substitution_end(s: str, i: int) -> int:
+    """Index of the ``)`` closing a ``$(`` whose body starts at ``i`` (``len``
+    when unterminated); quoted or escaped parens don't count."""
+    depth, n = 1, len(s)
+    quote: str | None = None
+    while i < n:
+        c = s[i]
+        if quote == "'":
+            if c == "'":
+                quote = None
+        elif c == "\\":
+            i += 1
+        elif c == '"':
+            quote = None if quote else '"'
+        elif quote is None:
+            if c == "'":
+                quote = "'"
+            elif c == "(":
+                depth += 1
+            elif c == ")":
+                depth -= 1
+                if depth == 0:
+                    return i
+        i += 1
+    return n
+
+
+def _fallback_nested_shell(s: str) -> list[str]:
+    """Standalone copy of ``_extract_nested_shell`` for when its import fails.
+
+    It tracks single quotes, double quotes and backslash escapes. An
+    unterminated substitution yields the rest of the string, which fails closed.
+    """
     out: list[str] = []
-    s = cmd or ""
-    n = len(s)
-    i = 0
-    sq = False
+    i, n = 0, len(s)
+    quote: str | None = None
     while i < n:
         c = s[i]
-        if sq:
+        if quote == "'":
             if c == "'":
-                sq = False
+                quote = None
             i += 1
             continue
-        if c == "'":
-            sq = True
-            i += 1
+        if c == "\\":
+            i += 2
             continue
-        if c == "$" and i + 1 < n and s[i + 1] == "(":
-            depth, j = 1, i + 2
-            start = j
-            while j < n and depth:
-                if s[j] == "(":
-                    depth += 1
-                elif s[j] == ")":
-                    depth -= 1
-                j += 1
-            if depth == 0:
-                out.append(s[start : j - 1])
-            i = j
+        if c == "'" and quote is None:
+            quote = "'"
+        elif c == '"':
+            quote = None if quote else '"'
+        elif c == "$" and s.starts
```

**File**: `apodex/tests/test_features.py` (modified, +75/-0)
```diff
@@ -1326,6 +1326,81 @@ def test_single_quoted_substitution_is_literal(tmp_path):
 
     rules = PermissionStore(allow={"Bash(echo)"})
     assert rules.allows("bash", {"command": "echo '$(pip install x)'"})
+    assert rules.allows("bash", {"command": r"echo \$(pip install x)"})  # escaped, so literal
+
+
+def test_deny_rule_still_matches_parent_of_substitution(tmp_path):
+    """A nested command that matches no rule must not cancel a deny (PR #42 review)."""
+    from apodex.agent_tools import RISK_DENY, assess_with_rules
+    from apodex.permissions import PermissionStore
+
+    cwd = str(tmp_path)
+    rules = PermissionStore(allow={"Bash(*)"}, deny={"Bash(echo)"})
+    cmd = {"command": "echo $(touch /tmp/marker)"}
+    assert rules.denies("bash", cmd)
+    assert assess_with_rules("bash", cmd, cwd, rules).level == RISK_DENY
+    # A deny prefix also fires on a command nested inside a substitution.
+    nested = PermissionStore(allow={"Bash(*)"}, deny={"Bash(touch)"})
+    assert assess_with_rules("bash", cmd, cwd, nested).level == RISK_DENY
+    # It also fires on any one top-level segment, not only when all of them match.
+    assert PermissionStore(deny={"Bash(git push)"}).denies(
+        "bash", {"command": "git status && git push origin main"}
+    )
+
+
+def test_helper_segment_substitution_needs_authorization(tmp_path):
+    """The helper filter must not hide a payload inside an echo segment (PR #42 review)."""
+    from apodex.agent_tools import RISK_CONFIRM, assess_with_rules
+    from apodex.permissions import PermissionStore
+
+    rules = PermissionStore(allow={"Bash(python)"})
+    cmd = {"command": "echo $(touch /tmp/marker) && python -V"}
+    assert not rules.allows("bash", cmd)
+    assert assess_with_rules("bash", cmd, str(tmp_path), rules).level == RISK_CONFIRM
+    assert rules.allows("bash", {"command": "echo hi && python -V"})  # a plain helper is still skipped
+    assert not rules.allows("bash", {"command": '"" && python -V'})  # empty word returns False, no IndexError
+
+
+def test_double_quoted_substitution_is_not_literal(tmp_path):
+    """A ``'`` inside ``"..."`` is an ordinary character, so ``$(...)`` still runs (PR #42 review)."""
+    from apodex.agent_tools import RISK_CONFIRM, assess_with_rules
+    from apodex.permissions import PermissionStore
+    from plugins.tools._bash_policy import assess_bash_command
+
+    rules = PermissionStore(allow={"Bash(echo)"})
+    for cmd in (
+        "echo \"'$(touch /tmp/marker)'\"",
+        r"echo \' $(touch /tmp/marker) \'",  # an escaped ' does not start a quoted span
+        r'''echo "a\"'$(touch /tmp/marker)'"''',  # an escaped " does not end the string
+        'echo $(echo ")"; touch /tmp/marker)',  # a quoted ")" does not end the substitution
+    ):
+        assert not rules.allows("bash", {"command": cmd}), cmd
+        assert assess_with_rules("bash", {"command": cmd}, str(tmp_path), rules).level == RISK_CONFIRM
+    # The sandbox bash policy uses the same extractor.
+    assert assess_bash_command("echo \"'$(foobarcmd)'\"", mode="enforce").level == "deny"
+
+
+def test_nested_shell_extractors_agree():
+    """The fallback scanner in permissions.py must match the shared extractor."""
+    from apodex.permissions import _fallback_nested_shell
+    from plugins.tools._bash_policy import _extract_nested_shell
+
+    corpus = {
+        "echo $(a)": ["a"],
+        "echo `b`": ["b"],
+        "echo '$(c)'": [],
+        "echo \"'$(d)'\"": ["d"],
+        r"echo \$(e)": [],
+        r"echo \' $(f) \'": ["f"],
+        r'''echo "a\"'$(g)'"''': ["g"],
+        'echo $(echo ")"; h)': ['echo ")"; h'],
+        "echo $(i $(j))": ["i $(j)"],
+        "echo $(unterminated": ["unterminated"],
+        r"echo \`k\`": [],
+    }
+    for cmd, want in corpus.items():
+        assert _extract_nested_shell(cmd) == want, cmd
+        assert _fallback_nested_shell(cmd) == want, cmd
 
 
 def test_user_settings_save_and_load(tmp_path):
```

**File**: `plugins/tools/_bash_policy.py` (modified, +52/-22)
```diff
@@ -798,41 +798,71 @@ def _split_top_level(command: str) -> list[str]:
     return [s.strip() for s in segs if s.strip()]
 
 
+def _substitution_end(command: str, i: int) -> int:
+    """Index of the ``)`` closing a ``$(`` whose body starts at ``i``, or
+    ``len(command)`` when unterminated. Quoted or escaped parens don't count,
+    so ``$(echo ")"; rm x)`` closes at the last ``)``, not inside the quotes."""
+    depth, n = 1, len(command)
+    quote: str | None = None
+    while i < n:
+        c = command[i]
+        if quote == "'":
+            if c == "'":
+                quote = None
+        elif c == "\\":
+            i += 1
+        elif c == '"':
+            quote = None if quote else '"'
+        elif quote is None:
+            if c == "'":
+                quote = "'"
+            elif c == "(":
+                depth += 1
+            elif c == ")":
+                depth -= 1
+                if depth == 0:
+                    return i
+        i += 1
+    return n
+
+
 def _extract_nested_shell(command: str) -> list[str]:
     """Return shell-code strings nested in ``$(...)`` and backticks (which the
-    shell expands+executes). Single-quoted spans are skipped — the shell does
-    not expand them, so ``echo '$(rm -rf /)'`` is a harmless literal."""
+    shell expands+executes).
+
+    It reads quotes the way bash does. A single-quoted span is skipped, so
+    ``echo '$(rm -rf /)'`` is a harmless literal. Inside double quotes a ``'``
+    is an ordinary character and substitution still runs, so
+    ``echo "'$(rm -rf /)'"`` yields ``rm -rf /``. A backslash outside single
+    quotes escapes the next character (``\\$(...)``, ``\\'``, ``\\"``). An
+    unterminated substitution yields the rest of the string, which fails closed.
+    """
     out: list[str] = []
     i, n = 0, len(command)
-    sq = False
+    quote: str | None = None
     while i < n:
         c = command[i]
-        if sq:
+        if quote == "'":
             if c == "'":
-                sq = False
+                quote = None
             i += 1
             continue
-        if c == "'":
-            sq = True
-            i += 1
+        if c == "\\":
+            i += 2
             continue
-        if c == "$" and i + 1 < n and command[i + 1] == "(":
-            depth, j = 1, i + 2
-            start = j
-            while j < n and depth:
-                if command[j] == "(":
-                    depth += 1
-                elif command[j] == ")":
-                    depth -= 1
-                j += 1
-            if depth == 0:
-                out.append(command[start:j - 1])
-            i = j
+        if c == "'" and quote is None:
+            quote = "'"
+        elif c == '"':
+            quote = None if quote else '"'
+        elif c == "$" and command.startswith("(", i + 1):
+            end = _substitution_end(command, i + 2)
+            out.append(command[i + 2:end])
+            i = end + 1
             continue
-        if c == "`":
+        elif c == "`":
             j = i + 1
             while j < n and command[j] != "`":
-                j += 1
+                j += 2 if command[j] == "\\" else 1
             out.append(command[i + 1:j])
             i = j + 1
             continue
```

---

### Incident Patch 8: `49479c04` (2026-10-02)
**Commit Message**: docs(docker): correct the container quick start for the private image

The published `ghcr.io/apodexai/frontieragent` package is private by org
policy, so an anonymous pull fails with `unauthorized`. README.md,
docs/install/docker.md and the chooser table all promised a build-free
`docker compose run --rm agent`, which sends anyone outside the org to
that error on their first command.

docs/install/global-install.md and the comment in the publish workflow
already state the privacy, so this only aligns the pages a new user lands
on first.

Because compose.yaml sets `pull_policy: always`, the local-build path has
to keep the `compose.dev.yaml` override on every command — its
`pull_policy: build` is what keeps the built image in use instead of
retrying the registry. That is now spelled out in each quick start.

Closes #47

tests/test_container_image_docs.py pins this: 5 of its 8 cases fail on
the pre-fix tree. The other 3 are guard rails (a dev override exists, and
no block builds locally then runs without the override).

**File**: `README.md` (modified, +5/-2)
```diff
@@ -236,11 +236,14 @@ Chinese-speaking macOS users can use the
 ## Containers and local models
 
 Pre-built `linux/amd64` and `linux/arm64` images are published to the GitHub
-Container Registry, so no local Python environment is needed:
+Container Registry, so no local Python environment is needed. That package is
+private, so `docker login ghcr.io` (with an account authorized for it) is
+required — otherwise build the checkout:
 
 ```bash
 cp .env.example .env
-docker compose run --rm agent
+docker compose -f compose.yaml -f compose.dev.yaml build
+docker compose -f compose.yaml -f compose.dev.yaml run --rm agent
 ```
 
 - [Run FrontierAgent in Docker](docs/install/docker.md) — Compose, image
```

**File**: `docs/install/README.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ without keeping a checkout around, use
 | macOS laptop or desktop | native, optionally Docker | hosted/remote endpoint | [macOS](macos.md) |
 | macOS or Linux, the CLI as a globally installed tool | `uv tool install`, native or Docker | hosted/remote endpoint | [Global install](global-install.md) |
 | Linux laptop, server, or CI without a local model | `scripts/run-linux.sh` (native, bubblewrap, or Docker) | hosted/remote endpoint | [Linux](linux.md) |
-| Any host with Docker and no local Python environment | published agent container | hosted/remote endpoint | [Docker and Compose](docker.md) |
+| Any host with Docker and no local Python environment | agent container built from this checkout (or the private published image) | hosted/remote endpoint | [Docker and Compose](docker.md) |
 | Linux bare metal or VM with an NVIDIA GPU and Docker daemon | native or agent container | SGLang container | [Linux NVIDIA + Docker](linux-nvidia.md) |
 | RunPod-style service that accepts your image at instance creation | inside the provider container | prebuilt FrontierAgent GPU image | [GPU cloud images](gpu-platforms.md) |
 | Existing x86_64 Linux GPU environment without nested Docker | `scripts/run-linux-gpu.sh` | isolated native SGLang process | [Linux NVIDIA native](linux-nvidia-native.md) |
```

**File**: `docs/install/docker.md` (modified, +64/-13)
```diff
@@ -2,8 +2,20 @@
 
 FrontierAgent publishes pre-built `linux/amd64` and `linux/arm64` images to the
 GitHub Container Registry. Using them requires no local Python environment and
-no system dependencies beyond Docker itself. The default `compose.yaml` pulls
-that published image; it does not build the repository locally.
+no system dependencies beyond Docker itself. The default `compose.yaml` uses
+that published image.
+
+That package is **private**, so an anonymous pull fails with `unauthorized`.
+You need one of:
+
+- a GitHub account or token already authorized for the package, in which case
+  run `docker login ghcr.io` first; or
+- a local build of this checkout, which is what the commands below do and
+  needs no registry access.
+
+Because `compose.yaml` sets `pull_policy: always`, the build path keeps the
+`compose.dev.yaml` override on every command — its `pull_policy: build` keeps
+the local image in use instead of retrying the registry.
 
 This page covers the CPU agent container. For a **local NVIDIA model server**,
 the GPU belongs to a separate SGLang container or process — use
@@ -20,14 +32,27 @@ git clone https://github.com/ApodexAI/FrontierAgent.git
 cd FrontierAgent
 cp .env.example .env
 
-# Interactive CLI
+# With registry access, the published image needs no build:
 docker compose run --rm agent
+```
+
+Without it, build from this checkout and keep the override on every command:
+
+```bash
+git clone https://github.com/ApodexAI/FrontierAgent.git
+cd FrontierAgent
+cp .env.example .env
+docker compose -f compose.yaml -f compose.dev.yaml build
+
+# Interactive CLI
+docker compose -f compose.yaml -f compose.dev.yaml run --rm agent
 
 # One-shot agent command
-docker compose run --rm agent -p "explain pyproject.toml"
+docker compose -f compose.yaml -f compose.dev.yaml run --rm agent \
+  -p "explain pyproject.toml"
 
 # Default benchmark evaluation (BrowseComp, one task)
-docker compose run --rm eval
+docker compose -f compose.yaml -f compose.dev.yaml run --rm eval
 ```
 
 Compose writes session records and deliverables to `.apodex/runs/<session-id>/`.
@@ -47,6 +72,10 @@ The convenience helper wraps the same thing:
 ./docker/run.sh eval --limit 5
 ```
 
+`run.sh` uses `compose.yaml` on its own, so it needs registry access to the
+private package. Keep the `compose.dev.yaml` override instead when building
+locally.
+
 ## Pin a release or another image
 
 Set `FRONTIER_AGENT_IMAGE` before running Compose:
@@ -56,13 +85,23 @@ FRONTIER_AGENT_IMAGE=ghcr.io/apodexai/frontieragent:latest \
   docker compose run --rm agent -p "explain pyproject.toml"
 ```
 
+Any image name works here, including one you built and tagged yourself, or one
+mirrored to a registry you can reach.
+
 ## Direct `docker run`
 
 Compose is the supported path; this is the equivalent for environments that
 cannot use it. The environment variables and mounts are not optional — they are
 what tells the runtime it is inside a container and where the three sandbox
 roots live.
 
+The image reference below is the private published image, so it needs registry
+access. To run without it, build the checkout and use that tag instead:
+
+```bash
+docker build -t frontier-agent:local .
+```
+
 ```bash
 docker run --rm -it \
   --env-file .env \
@@ -84,7 +123,7 @@ docker run --rm -it \
   -v frontier-agent-state:/root/.apodex \
   -v frontier-agent-config:/root/.config/apodex \
   -w /workspace \
-  ghcr.io/apodexai/frontieragent:latest \
+  frontier-agent:local \
   -p "explain main workflow"
 ```
 
@@ -94,26 +133,33 @@ For a terminal deployment accessed over SSH:
 
 1. Provision an EC2 or ECS Linux instance with Docker and the Compose plugin.
 2. Clone this repository and create `.env` from `.env.example`.
-3. Pull and launch the pre-built container:
+3. Launch the container:
 
 ```bash
 git clone https://github.com/ApodexAI/FrontierAgent.git
 cd FrontierAgent
 cp .env.example .env
-# Edit .env, then:
+# Edit .env, then — one of:
+
+# With registry access, use the published image:
+docker login ghcr.io
 docker compose pull agent
 docker compose run --rm agent
+
+# Or build this checkout on the instance, no registry access needed:
+docker compose -f compose.yaml -f compose.dev.yaml build
+docker compose -f compose.yaml -f compose.dev.yaml run --rm agent
 ```
 
 The container itself is disposable; Compose persists sessions, configuration,
-attachments, and deliverables in volumes or the checked-out workspace. Pull the
-image again to upgrade. This is an interactive SSH/TUI deployment, not a
-long-running HTTP service.
+attachments, and deliverables in volumes or the checked-out workspace. Rebuild
+(or `docker compose pull agent`) to upgrade. This is an interactive SSH/TUI
+deployment, not a long-running HTTP service.
 
 ## Build from the current checkout
 
-To run your own changes instead of the published image, add the development
-override:
+The development override builds this checkout instead of using the published
+image, which is 
```

**File**: `tests/test_container_image_docs.py` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+"""The documented container quick start must work without registry credentials.
+
+`ghcr.io/apodexai/frontieragent` is private by org policy — see the comment in
+`.github/workflows/docker-publish.yml` and the note in
+`docs/install/global-install.md`. An anonymous pull of it fails, so the
+user-facing quick start cannot promise a build-free `docker compose run`.
+
+`README.md`, `docs/install/docker.md` and the chooser table in
+`docs/install/README.md` all did promise exactly that, which sent anyone
+outside the org to an `unauthorized` error on their first command.
+
+These assertions fail on the pre-fix tree and pass after it.
+"""
+
+from __future__ import annotations
+
+import re
+from pathlib import Path
+
+import pytest
+
+_REPO_ROOT = Path(__file__).resolve().parents[1]
+
+# Every file that walks a reader through starting the container.
+_QUICKSTART_DOCS = (
+    "README.md",
+    "docs/install/docker.md",
+    "docs/install/README.md",
+)
+
+# Claims that cannot hold while the published image is private.
+_UNREACHABLE_CLAIMS = (
+    "no local build needed",
+    "does not build the repository locally",
+    "Pull and launch the pre-built container",
+)
+
+
+@pytest.mark.parametrize("rel_path", _QUICKSTART_DOCS)
+def test_quickstart_docs_say_the_image_is_private(rel_path: str) -> None:
+    """Each quick start has to acknowledge the private package."""
+    text = (_REPO_ROOT / rel_path).read_text(encoding="utf-8")
+    assert re.search(r"private", text, re.IGNORECASE), (
+        f"{rel_path} documents a container quick start but never says the "
+        "ghcr.io/apodexai/frontieragent package is private, so a reader "
+        "outside the org hits `unauthorized` on the first command"
+    )
+
+
+@pytest.mark.parametrize("rel_path", _QUICKSTART_DOCS)
+def test_quickstart_docs_drop_unreachable_claims(rel_path: str) -> None:
+    """The pre-fix wording promised a pull that cannot succeed anonymously."""
+    lowered = (_REPO_ROOT / rel_path).read_text(encoding="utf-8").lower()
+    for claim in _UNREACHABLE_CLAIMS:
+        assert claim not in lowered, (
+            f"{rel_path} still claims {claim!r}, which is false while the "
+            "published image is private"
+        )
+
+
+def _run_commands(text: str) -> list[str]:
+    """Every `docker compose ... run ...` invocation, joined across line wraps.
+
+    Two things make a naive per-line scan miss these: the compose file flags
+    sit between `compose` and `run`, and long invocations wrap onto the next
+    line with a trailing backslash.
+    """
+    joined = text.replace("\\\n", " ")
+    return [
+        line.strip()
+        for line in joined.splitlines()
+        if re.match(r"\s*docker compose\b.*\brun\b", line)
+    ]
+
+
+def test_docker_quickstart_offers_a_path_that_needs_no_registry() -> None:
+    """The local-build escape hatch has to be spelled out.
+
+    `compose.yaml` sets `pull_policy: always`, so the documented build path is
+    only usable if the commands keep the `compose.dev.yaml` override — its
+    `pull_policy: build` is what keeps the local image instead of retrying the
+    private registry.
+    """
+    text = (_REPO_ROOT / "docs/install/docker.md").read_text(encoding="utf-8")
+    assert "compose.dev.yaml" in text, (
+        "docs/install/docker.md offers no local-build path, but the published "
+        "image cannot be pulled anonymously"
+    )
+
+    build_blocks = re.findall(r"```bash\n(.*?)```", text, re.DOTALL)
+    offenders = [
+        command
+        for block in build_blocks
+        if "compose.dev.yaml build" in block
+        for command in _run_commands(block)
+        if "compose.dev.yaml" not in command and "docker login" not in block
+    ]
+    assert not offenders, (
+        "a block that builds locally then runs without compose.dev.yaml, so "
+        "compose.yaml's pull_policy: always re-fetches the private image: " + "; ".join(offenders)
+    )
+
+
+def test_readme_quickstart_offers_a_path_that_needs_no_registry() -> None:
+    """The README snippet is the most-read entry point for the container path."""
+    text = (_REPO_ROOT / "README.md").read_text(encoding="utf-8")
+    section = text.split("## Containers and local models", 1)[1].split("\n## ", 1)[0]
+    runs = _run_commands(section)
+    assert runs, "README no longer shows a container run command"
+    assert all("compose.dev.yaml" in command for command in runs), (
+        "README runs the container without the compose.dev.yaml override, so "
+        "the private image is pulled: " + "; ".join(runs)
+    )
```

---

### Incident Patch 9: `06ff689f` (2026-10-02)
**Commit Message**: Merge pull request #45 from Ray0907/fix/session-persist-blocking-io

fix(apodex): offload per-turn session persist off the event loop

**File**: `apodex/session.py` (modified, +33/-11)
```diff
@@ -11,6 +11,7 @@
 import asyncio
 import json
 import os
+import threading
 from pathlib import Path
 from typing import Any
 
@@ -189,6 +190,10 @@ def __init__(
         # plugins.tools._path_auth._authorized_local_path). Without this they
         # only allow a few default dirs and deny the user's repo.
         self._authorize_workspace(cwd)
+        # _persist() now runs both on the main thread (start_new_session,
+        # rename_session) and off-thread (_on_turn's asyncio.to_thread), so
+        # concurrent writers must serialize on the same checkpoint file.
+        self._persist_lock = threading.Lock()
 
     @staticmethod
     def _active_spill_workspace() -> Path | None:
@@ -476,7 +481,11 @@ async def _on_turn(self, turn: int, messages: list, metadata: dict) -> None:
         after each completed turn — keep history current and persist."""
         self.history = list(messages)
         self.display_history = list(messages)
-        self._persist()
+        # _persist() does synchronous file I/O over the full history; run it
+        # off the event loop so long sessions don't stall on every turn.
+        # Awaited between turns; _persist_lock also serializes snapshots and
+        # writes if cancellation leaves this worker running in the background.
+        await asyncio.to_thread(self._persist)
 
     # ── persistence (interrupt-safe resume) ───────────────────────────────
     def _enrich_task(self, task: str) -> str:
@@ -591,21 +600,29 @@ def replay_history(self) -> list[Message]:
 
     def _persist(self) -> None:
         """Checkpoint session state so ``--resume <id>`` can continue it.
-        Best-effort; a failed write never disrupts the session."""
+        Best-effort; a failed write never disrupts the session.
+
+        Serialized via ``_persist_lock`` and written atomically (tmp file +
+        ``os.replace``) because this runs from both the main thread
+        (``start_new_session`` / ``rename_session``) and a worker thread
+        (``_on_turn``'s ``asyncio.to_thread``) — without both, concurrent
+        writers can interleave and corrupt the checkpoint file."""
         try:
             import json
 
             from apodex.todo import get_todos
 
-            snapshot = getattr(self.r, "snapshot_state", None)
-            if callable(snapshot):
-                raw_tui_state = snapshot()
-                self.tui_state = raw_tui_state if isinstance(raw_tui_state, dict) else {}
+            # Snapshot under the same lock as the write: a cancelled
+            # to_thread worker can otherwise overwrite a newer checkpoint
+            # with a payload it captured before waiting for this lock.
+            with self._persist_lock:
+                snapshot = getattr(self.r, "snapshot_state", None)
+                if callable(snapshot):
+                    raw_tui_state = snapshot()
+                    self.tui_state = raw_tui_state if isinstance(raw_tui_state, dict) else {}
 
-            path = _session_state_path(self.session_id)
-            os.makedirs(os.path.dirname(path), exist_ok=True)
-            with open(path, "w", encoding="utf-8") as f:
-                json.dump({
+                path = _session_state_path(self.session_id)
+                payload = {
                     "session_id": self.session_id,
                     "created_at": self.created_at,
                     "local_timezone": self.local_timezone,
@@ -633,7 +650,12 @@ def _persist(self) -> None:
                         {"content": item.content, "status": item.status}
                         for item in get_todos()
                     ],
-                }, f, ensure_ascii=False)
+                }
+                os.makedirs(os.path.dirname(path), exist_ok=True)
+                tmp_path = f"{path}.{os.getpid()}.{threading.get_ident()}.tmp"
+                with open(tmp_path, "w", encoding="utf-8") as f:
+                    json.dump(payload, f, ensure_ascii=False)
+                os.replace(tmp_path, path)
         except Exception:
             pass
 
```

**File**: `apodex/tests/test_changes.py` (modified, +83/-0)
```diff
@@ -748,6 +748,89 @@ def test_session_persist_and_resume(tmp_path, monkeypatch):
     assert "edited.py" in s2.journal.to_dict() or True  # journal restored shape
 
 
+
+@pytest.mark.asyncio
+async def test_cancelled_checkpoint_cannot_overwrite_newer_save(tmp_path, monkeypatch):
+    import threading
+    from types import SimpleNamespace
+
+    from apodex import session as session_module
+    from apodex.session import TerminalSession
+
+    checkpoint = tmp_path / "state.json"
+    monkeypatch.setattr(session_module, "_session_state_path", lambda _: str(checkpoint))
+    snapshot_started = threading.Event()
+    release_snapshot = threading.Event()
+    old_save_finished = threading.Event()
+    old_thread_id = None
+
+    class CheckpointLock:
+        def __init__(self):
+            self.lock = threading.Lock()
+
+        def __enter__(self):
+            # Let the old snapshot finish once a newer save is waiting for
+            # its lock. Before the fix the old snapshot owns no lock, so the
+            # newer save completes first and releases it in the test below.
+            if threading.get_ident() != old_thread_id and self.lock.locked():
+                release_snapshot.set()
+            self.lock.acquire()
+
+        def __exit__(self, *_):
+            self.lock.release()
+
+    def journal_snapshot():
+        if threading.get_ident() == old_thread_id:
+            snapshot_started.set()
+            if not release_snapshot.wait(5):
+                raise TimeoutError("old checkpoint was never released")
+        return {}
+
+    session = TerminalSession.__new__(TerminalSession)
+    session.__dict__.update(
+        r=SimpleNamespace(), session_id="test", created_at="", local_timezone="",
+        session_name="old name", mode="coding", cwd=str(tmp_path),
+        cfg=SimpleNamespace(model="fake"), history=[], display_history=[],
+        workflow_turns=[], usage=SimpleNamespace(to_dict=lambda: {}), tui_state={},
+        journal=SimpleNamespace(to_dict=journal_snapshot,
+                                observed_paths=lambda: [], revert_bases=lambda: {}),
+        plan_state=SimpleNamespace(active=False), _persist_lock=CheckpointLock(),
+    )
+    persist = session._persist
+
+    def tracked_persist():
+        nonlocal old_thread_id
+        is_old = old_thread_id is None
+        if is_old:
+            old_thread_id = threading.get_ident()
+        try:
+            persist()
+        finally:
+            if is_old:
+                old_save_finished.set()
+
+    monkeypatch.setattr(session, "_persist", tracked_persist)
+    turn = asyncio.create_task(session._on_turn(1, [{"role": "user", "content": "old"}], {}))
+    try:
+        assert await asyncio.to_thread(snapshot_started.wait, 5)
+        turn.cancel()
+        with pytest.raises(asyncio.CancelledError):
+            await turn
+        session.history = [{"role": "user", "content": "new"}]
+        session.display_history = list(session.history)
+        await asyncio.to_thread(session.rename_session, "new name")
+    finally:
+        release_snapshot.set()
+        assert await asyncio.to_thread(old_save_finished.wait, 5)
+        if not turn.done():
+            await turn
+
+    state = json.loads(checkpoint.read_text())
+    assert state["name"] == "new name"
+    assert state["history"] == session.history
+    assert state["display_history"] == session.display_history
+
+
 def test_follow_up_receives_exact_agent_and_host_deliverable_paths(tmp_path, monkeypatch):
     from apodex.config import ModelConfig
     from apodex.render import Renderer
```

---

### Incident Patch 10: `1d9acba9` (2026-09-30)
**Commit Message**: Merge pull request #49 from ApodexAI/codex/pr-36-ci-fix

Fix native workflow behavior and isolate path localization tests

**File**: `apodex/agent_tools.py` (modified, +15/-0)
```diff
@@ -284,6 +284,21 @@ def localize_path_args(name: str, args: dict, cwd: str) -> dict | None:
         except Exception:
             continue
         if not (rel == ".." or rel.startswith(".." + os.sep)):
+            # Native workflow mode deliberately separates the user's project
+            # (cwd) from its run-private execution workspace. The workflow
+            # read_file resolves relative paths in that private workspace, so
+            # converting a correct absolute project path to "README.md" would
+            # make it read the wrong filesystem location.
+            runtime_workspace = os.environ.get(
+                "FRONTIER_AGENT_WORKSPACE_DIR", ""
+            ).strip()
+            if name == "read_file" and runtime_workspace:
+                try:
+                    workspace_real = os.path.realpath(runtime_workspace)
+                except Exception:
+                    workspace_real = ""
+                if workspace_real and workspace_real != cwd_real:
+                    return None
             new = dict(args)
             new[key] = rel or "."
             return new
```

**File**: `apodex/task_runner.py` (modified, +25/-4)
```diff
@@ -93,6 +93,17 @@ def _is_complete_run(
     # phase hit its soft deadline. Its explicit complete status is authoritative.
     if answer_status == "complete" and answer_source == "reporter_llm":
         return True
+    # Main-agent workflows may finish with a plain-text assistant turn, which
+    # the loop records as ``no_tool``. Once the workflow has explicitly marked
+    # that agent-produced answer complete, treat that terminal as successful.
+    # Keep this narrower than accepting workflow ``no_tool`` in general: an
+    # exhausted no-tool nudge budget can also use the same stop reason.
+    if (
+        stopped_by == _NO_TOOL_STOP
+        and answer_status == "complete"
+        and answer_source == "agent"
+    ):
+        return True
     if no_tool_is_complete and stopped_by == _NO_TOOL_STOP:
         return True
     return stopped_by in _COMPLETE_TOP_LEVEL_STOPS
@@ -565,18 +576,28 @@ async def _run_native_workflow(self, task: str, profile: Any) -> None:
             answer_status=str(state.get("answer_status") or ""),
             answer_source=str(state.get("final_answer_source") or ""),
         )
+        turns_used = (
+            int(state.get("turns_used") or 0)
+            if "turns_used" in state
+            else len(state.get("react_steps") or [])
+        )
+        tool_calls_count = (
+            int(state.get("tool_calls_count") or 0)
+            if "tool_calls_count" in state
+            else 0
+        )
         if complete:
             self.r.final(
                 final,
-                turns=len(state.get("react_steps") or []),
-                tool_calls=0,
+                turns=turns_used,
+                tool_calls=tool_calls_count,
                 stopped_by=stopped_by,
             )
         else:
             self._show_incomplete_run(
                 final,
-                turns=len(state.get("react_steps") or []),
-                tool_calls=0,
+                turns=turns_used,
+                tool_calls=tool_calls_count,
                 stopped_by=stopped_by,
             )
         await self._render_changed_files()
```

**File**: `apodex/tests/test_features.py` (modified, +80/-1)
```diff
@@ -276,14 +276,47 @@ def test_gitignore_path_anchored_not_overpruned(tmp_path):
 
 
 # ── path localization (abs→rel avoids the ~50s sandbox slow path) ─────────
-def test_localize_absolute_path_inside_cwd(tmp_path):
+@pytest.mark.parametrize("workspace_mode", ["unset", "same", "symlink"])
+def test_localize_absolute_path_inside_cwd(tmp_path, monkeypatch, workspace_mode):
     cwd = str(tmp_path)
+    # Localization is valid only when the runtime resolves paths in cwd.
+    # Do not inherit a workspace configured by another test or the caller.
+    monkeypatch.delenv("FRONTIER_AGENT_INPUTS_DIR", raising=False)
+    monkeypatch.delenv("FRONTIER_AGENT_WORKSPACE_DIR", raising=False)
+    if workspace_mode == "same":
+        monkeypatch.setenv("FRONTIER_AGENT_WORKSPACE_DIR", cwd)
+    elif workspace_mode == "symlink":
+        workspace = tmp_path / "workspace-link"
+        workspace.symlink_to(tmp_path, target_is_directory=True)
+        monkeypatch.setenv("FRONTIER_AGENT_WORKSPACE_DIR", str(workspace))
     (tmp_path / "sub").mkdir()
     abspath = str(tmp_path / "sub" / "f.py")
     out = localize_path_args("read_file", {"path": abspath}, cwd)
     assert out is not None and out["path"] == "sub/f.py"
 
 
+def test_read_file_keeps_project_absolute_path_with_split_runtime_workspace(
+    tmp_path, monkeypatch,
+):
+    project = tmp_path / "project"
+    runtime_workspace = tmp_path / "private-workspace"
+    project.mkdir()
+    runtime_workspace.mkdir()
+    target = project / "README.md"
+    target.write_text("# project\n")
+
+    monkeypatch.delenv("FRONTIER_AGENT_INPUTS_DIR", raising=False)
+    monkeypatch.setenv(
+        "FRONTIER_AGENT_WORKSPACE_DIR", str(runtime_workspace),
+    )
+
+    out = localize_path_args(
+        "read_file", {"path": str(target)}, str(project),
+    )
+
+    assert out is None
+
+
 def test_localize_preserves_absolute_task_input_path(tmp_path, monkeypatch):
     inputs = tmp_path / ".apodex" / "inputs" / "run"
     inputs.mkdir(parents=True)
@@ -931,6 +964,8 @@ def test_native_workflow_no_tool_stop_is_not_reported_as_delivery(
     assert "no_tool" in out
     assert "partial output was not saved as a final report" in out
     assert "Final report" not in out
+    assert "turns=12" in out
+    assert "tools=0" in out
 
 
 def test_generic_loop_no_tool_stop_is_a_normal_finish():
@@ -942,6 +977,33 @@ def test_generic_loop_no_tool_stop_is_a_normal_finish():
     assert _is_complete_run("max_turns", no_tool_is_complete=True) is False
 
 
+def test_workflow_complete_agent_no_tool_is_a_normal_finish():
+    """A workflow-certified agent answer may terminate via a tool-free turn."""
+    from apodex.task_runner import _is_complete_run
+
+    assert _is_complete_run(
+        "no_tool",
+        answer_status="complete",
+        answer_source="agent",
+    ) is True
+
+    # Do not broaden workflow no_tool into an unconditional success signal.
+    assert _is_complete_run(
+        "no_tool",
+        answer_status="best_effort",
+        answer_source="agent",
+    ) is False
+    assert _is_complete_run(
+        "no_tool",
+        answer_source="agent",
+    ) is False
+    assert _is_complete_run(
+        "max_turns",
+        answer_status="complete",
+        answer_source="agent",
+    ) is False
+
+
 async def _drive_workflow(session, profile, follow_up):
     """Run one native workflow with ``run_task`` stubbed to record follow-ups."""
     session.run_task = follow_up  # type: ignore[method-assign]
@@ -1528,3 +1590,20 @@ def test_download_file_target_is_the_resolved_destination(monkeypatch, tmp_path)
     assert named.startswith(str(tmp_path / "downloads" / "p.pdf"))
     assert "/elsewhere/" not in named           # the requested directory is ignored
     assert "renamed" in named                   # collisions rename it
+
+
+def test_native_workflow_uses_authoritative_loop_telemetry(
+    tmp_path, monkeypatch, capsys,
+):
+    _run_workflow_returning({
+        "final_answer": "done",
+        "answer_status": "complete",
+        "final_answer_source": "agent",
+        "stopped_by": "no_tool",
+        "react_steps": [{}] * 7,
+        "turns_used": 8,
+        "tool_calls_count": 7,
+    }, tmp_path, monkeypatch)
+
+    out = capsys.readouterr().out
+    assert "turns=8 · tools=7 · no_tool" in out
```

**File**: `apodex/tests/test_native.py` (modified, +60/-0)
```diff
@@ -133,6 +133,66 @@ def test_native_strategy_is_explicitly_not_os_isolated() -> None:
     assert "not an OS sandbox" in strategy.describe()
 
 
+def test_nonroot_native_current_sandbox_skips_tool_user_warning(
+    tmp_path, monkeypatch, caplog,
+) -> None:
+    from plugins.tools import _sandbox as tool_sandbox
+
+    monkeypatch.setenv("APODEX_IN_NATIVE", "1")
+    monkeypatch.delenv("FRONTIER_AGENT_REQUIRE_TOOL_USER", raising=False)
+    monkeypatch.setattr(tool_sandbox.os, "geteuid", lambda: 1000)
+    monkeypatch.setattr(
+        tool_sandbox, "container_uses_inner_bwrap", lambda: False,
+    )
+
+    def unexpected_identity_lookup():
+        raise AssertionError(
+            "ordinary non-root native mode must not request a tool-user identity"
+        )
+
+    monkeypatch.setattr(
+        tool_sandbox, "tool_identity", unexpected_identity_lookup,
+    )
+
+    current = tool_sandbox.CurrentSandbox(tmp_path)
+
+    assert current.commands._identity is None
+    assert "Tool-user isolation inactive" not in caplog.text
+    assert "own uid" not in caplog.text
+
+
+def test_strict_nonroot_native_still_requires_tool_identity(
+    tmp_path, monkeypatch,
+) -> None:
+    from plugins.tools import _sandbox as tool_sandbox
+
+    monkeypatch.setenv("APODEX_IN_NATIVE", "1")
+    monkeypatch.setenv("FRONTIER_AGENT_REQUIRE_TOOL_USER", "1")
+    monkeypatch.setattr(tool_sandbox.os, "geteuid", lambda: 1000)
+    monkeypatch.setattr(
+        tool_sandbox, "container_uses_inner_bwrap", lambda: False,
+    )
+
+    calls = []
+
+    def required_identity():
+        calls.append(True)
+        raise tool_sandbox.SandboxUnavailableError(
+            "strict tool-user requirement exercised"
+        )
+
+    monkeypatch.setattr(tool_sandbox, "tool_identity", required_identity)
+
+    try:
+        tool_sandbox.CurrentSandbox(tmp_path)
+    except tool_sandbox.SandboxUnavailableError as exc:
+        assert "strict tool-user requirement exercised" in str(exc)
+    else:
+        raise AssertionError("strict native mode unexpectedly bypassed tool_identity")
+
+    assert calls == [True]
+
+
 def test_native_runtime_resolves_canonical_mount_aliases(
     tmp_path, monkeypatch,
 ) -> None:
```

**File**: `plugins/tools/_sandbox.py` (modified, +28/-7)
```diff
@@ -1428,6 +1428,23 @@ def _check_ulimit_below_cgroup(mem_mb: int) -> None:
         )
 
 
+def _native_same_uid_is_expected() -> bool:
+    """True when local native execution intentionally uses the harness uid.
+
+    Native mode is explicitly not an OS sandbox: a normal non-root invocation
+    runs approved model commands with the current user's permissions.  Do not
+    route that expected case through the container/service tool-user warning
+    path.  Root-native and explicitly strict runs still attempt the dedicated
+    tool identity.
+    """
+    return (
+        os.environ.get("APODEX_IN_NATIVE", "").strip() == "1"
+        and os.name == "posix"
+        and os.geteuid() != 0
+        and not _require_tool_user()
+    )
+
+
 class _CurrentCommands:
     """Command executor for an existing checkout in the current process.
 
@@ -1438,8 +1455,10 @@ class _CurrentCommands:
 
     def __init__(self, workdir: str, *, private_tmp: bool = False) -> None:
         self._workdir = workdir
-        self._identity = tool_identity()
         native = os.environ.get("APODEX_IN_NATIVE", "").strip() == "1"
+        self._identity = (
+            None if _native_same_uid_is_expected() else tool_identity()
+        )
         self._runtime_home = (
             os.environ.get("HOME", "").strip() or workdir
             if native else workdir
@@ -2023,13 +2042,15 @@ def __init__(self, workdir: str | Path, *, private_tmp: bool = False) -> None:
             self.commands = self._inner.commands
             self.files = self._inner.files
         else:
-            identity = tool_identity()
+            same_uid_expected = _native_same_uid_is_expected()
+            identity = None if same_uid_expected else tool_identity()
             if identity is None:
-                logger.warning(
-                    "CurrentSandbox running model commands with the harness's "
-                    "own uid: the child environment is scrubbed, but "
-                    "/proc/<harness-pid>/environ remains readable"
-                )
+                if not same_uid_expected:
+                    logger.warning(
+                        "CurrentSandbox running model commands with the harness's "
+                        "own uid: the child environment is scrubbed, but "
+                        "/proc/<harness-pid>/environ remains readable"
+                    )
             else:
                 _, outputs_dir, inputs_dir = resolve_mount_dirs()
                 _prepare_tool_writable(self._workdir, outputs_dir)
```

**File**: `workflows/stateful_react_agent/nodes/main_agent.py` (modified, +4/-0)
```diff
@@ -1162,6 +1162,10 @@ async def react_agent_node(state: dict[str, Any], ctx: NodeContext) -> dict[str,
             steps=result.metadata.get("react_steps", []),
         ),
         "react_steps": result.metadata.get("react_steps", []),
+        # Authoritative loop telemetry. ``react_steps`` counts tool results,
+        # not LLM turns, so it cannot substitute for either counter.
+        "turns_used": result.turns_used,
+        "tool_calls_count": result.tool_calls_count,
         "language": answer_language,
         # Keep the user-facing answer non-empty while preserving the old
         # machine-readable infra/eval failure signal out of band.
```

---

### Incident Patch 11: `4fcba4d3` (2026-09-29)
**Commit Message**: Merge pull request #48 from KaiOnCode/fix/finalize-gate-bypass-visibility

fix(agent-team): mark finalize-gate bypass on the final turn instead of delivering silently

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -62,6 +62,9 @@ Initial open-source release of FrontierAgent.
 
 ### Fixed
 
+- Surface finalize-gate bypasses on the final turn: an answer delivered despite
+  open task-board items now carries an unfinished-work note and a
+  `finalize_gate_bypassed` marker instead of reading as a clean success.
 - Native mode puts the CLI's own Python environment ahead of the inherited
   `PATH`, so `read_file`, `download_file`, and `python3` inside `bash` use the
   interpreter the CLI was installed with rather than a system Python.
```

**File**: `tests/test_bare_text_finalize_gate.py` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+from __future__ import annotations
+
+import asyncio
+from collections.abc import Mapping
+from typing import Any
+
+import pytest
+
+from frontier_agent.core.loop_types import TurnContext, notify_observers
+from plugins.tools import task_board as tb
+from workflows._shared.citation_contract import (
+    finalize_report_with_canonical_references,
+)
+from workflows.agent_team.nodes import fast_reporter_v1
+from workflows.agent_team.nodes.reporter import agent_team_reporter
+from workflows.agent_team.observers import bare_text_finalize as btf
+from workflows.agent_team.observers.bare_text_finalize import (
+    BareTextFinalizeObserver,
+)
+from workflows.agent_team.spec import SWARM_SPEC
+from workflows.agent_team.spec_report import AGENT_TEAM_REPORT_SPEC
+
+_TASK = "task"
+_ANSWER = "Deployment complete; 100% of attacks blocked [1]."
+_REFERENCES = [{"url": "https://example.com/a", "title": "Example"}]
+_BYPASS_ERR = (
+    "Cannot finish: task board has unresolved item(s) ['t1']. "
+    "For each, call update_task(...)"
+)
+
+
+def _seed_board(resolutions: dict[str, str]) -> None:
+    tb._BOARDS[_TASK] = {
+        "seq": len(resolutions),
+        "tasks": {
+            tid: {
+                "description": f"work {tid}",
+                "resolution": resolution,
+                "owners": [],
+            }
+            for tid, resolution in resolutions.items()
+        },
+    }
+
+
+def _context(turn: int, max_turns: int = 20) -> TurnContext:
+    return TurnContext(
+        turn=turn,
+        max_turns=max_turns,
+        task_id=_TASK,
+        role_id="coordinator",
+        ai_text=_ANSWER,
+        thinking="",
+        tool_calls=[],
+        messages=[],
+        usage=None,
+        metadata={},
+    )
+
+
+def _dispatch(ctx: TurnContext) -> list:
+    try:
+        return asyncio.run(
+            notify_observers(
+                [BareTextFinalizeObserver()],
+                "on_llm_response",
+                ctx,
+            ),
+        )
+    finally:
+        tb._BOARDS.pop(_TASK, None)
+
+
+def test_mid_run_unfinished_board_still_blocks() -> None:
+    """Away from the last turn the gate wins: rejected, never latched."""
+    _seed_board({"t1": "open"})
+    ctx = _context(turn=5)
+
+    interventions = _dispatch(ctx)
+
+    (intervention,) = interventions
+    assert intervention.continue_to_next_turn is True
+    assert intervention.stop_reason is None
+    assert "final_answer" not in ctx.metadata
+
+
+def test_final_turn_bypass_stores_marker_and_warning() -> None:
+    """The bypass must leave machine- and human-readable traces in metadata.
+
+    ``finalize_gate`` blocks while board items are open, but the final turn
+    accepts the answer anyway (never lose it to max_turns). The observer
+    stores the gate message (``finalize_gate_bypassed``) and a ready-to-append
+    warning built while the board is still live
+    (``finalize_gate_warning``); delivery nodes append the warning after any
+    finalization that would otherwise strip it (issue #19, review on #48).
+    The latched answer itself stays clean — appending here would be defeated
+    by the reporter's References cleanup.
+    """
+    _seed_board({"t1": "open", "t2": "open"})
+    ctx = _context(turn=19)
+
+    interventions = _dispatch(ctx)
+
+    (intervention,) = interventions
+    assert intervention.stop_reason == "final_answer"
+    assert ctx.metadata.get("finalize_gate_bypassed")
+    warning = str(ctx.metadata.get("finalize_gate_warning") or "")
+    assert "unfinished" in warning.casefold()
+    assert "t1" in warning and "t2" in warning
+    # The answer is latched verbatim; the warning travels separately.
+    assert ctx.metadata["final_answer"] == _ANSWER
+
+
+def test_final_turn_clean_board_latches_untouched() -> None:
+    """Gate passes → the answer is latched verbatim, no marker, no warning."""
+    _seed_board({"t1": "resolved", "t2": "cancelled"})
+    ctx = _context(turn=19)
+
+    interventions = _dispatch(ctx)
+
+    (intervention,) = interventions
+    assert intervention.stop_reason == "final_answer"
+    assert ctx.metadata["final_answer"] == _ANSWER
+    assert "finalize_gate_bypassed" not in ctx.metadata
+    assert "finalize_gate_warning" not in ctx.metadata
+
+
+def test_references_finalizer_strips_a_trailing_warning() -> None:
+    """Documents WHY the warning must be re-attached after finalization.
+
+    ``finalize_report_with_canonical_references`` drops everything from the
+    ``References`` heading to the end of the body — a warning appended after
+    that section does not survive the reporter's citation cleanup.
+
+    ``strip_trailing_references`` refuses to cut when the heading starts
+    before 30% of the body (mid-body sections are legitimate), so the body
+    must be realistically long — as in a real report, where the reviewer's
+    reproduction showed the warning being stripped.
+    """
+    body = (
+        "Attackers probed hidden paths,
```

**File**: `workflows/agent_team/nodes/main_agent.py` (modified, +14/-0)
```diff
@@ -104,6 +104,7 @@
 from workflows.agent_team.observers.auto_fan_in import AutoFanInObserver
 from workflows.agent_team.observers.bare_text_finalize import (
     BareTextFinalizeObserver,
+    append_bypass_warning,
 )
 from workflows.agent_team.observers.console import RichConsoleObserver
 from workflows.agent_team.observers.no_progress_guard import NoProgressGuard
@@ -1667,6 +1668,13 @@ async def _run_main_loop(
             url_repair_stats["unmatched"], url_repair_stats["checked"],
         )
 
+    # Re-attach the finalize-gate bypass warning (if any) only now: the
+    # observer stores it while the board is live, and this is the delivery
+    # boundary for the coordinator's own answer. When the reporter runs it
+    # re-appends on its own freshly finalized text (References cleanup would
+    # strip an earlier append) — see review on #48.
+    final_text = append_bypass_warning(final_text, result.metadata)
+
     if reporter_enabled and result.metadata.get("report_handoff"):
         logger.info(
             "agent_team: research stopped by %s; advancing to downstream reporter",
@@ -1708,6 +1716,12 @@ async def _run_main_loop(
             result.metadata.get("final_answer_rescue_mode") or "",
         ),
         "final_answer_source": answer_source,
+        "finalize_gate_bypassed": str(
+            result.metadata.get("finalize_gate_bypassed") or "",
+        ),
+        "finalize_gate_warning": str(
+            result.metadata.get("finalize_gate_warning") or "",
+        ),
         # Conditional edge in both agent-team specs consumes this resolved
         # per-request value. False routes directly to END, preserving the
         # coordinator's answer as the protocol final.
```

**File**: `workflows/agent_team/nodes/reporter.py` (modified, +12/-0)
```diff
@@ -337,6 +337,16 @@ async def agent_team_reporter(
     if not report_md.strip():
         return {}
 
+    # Re-attach the finalize-gate bypass warning now: References cleanup
+    # inside the chain has already run, so this append survives it — the
+    # observer's stored warning is the same one main_agent would have
+    # appended had the reporter not replaced the answer (review on #48).
+    from workflows.agent_team.observers.bare_text_finalize import (
+        append_bypass_warning,
+    )
+
+    report_md = append_bypass_warning(report_md, state)
+
     try:
         _refresh_trace_terminal(state.get("metadata") or {}, report_md)
     except Exception as exc:
@@ -355,4 +365,6 @@ async def agent_team_reporter(
         "final_answer_source": "reporter_llm",
         "final_answer_rescued": False,
         "final_answer_rescue_mode": "",
+        "finalize_gate_bypassed": str(state.get("finalize_gate_bypassed") or ""),
+        "finalize_gate_warning": str(state.get("finalize_gate_warning") or ""),
     }
```

**File**: `workflows/agent_team/observers/bare_text_finalize.py` (modified, +50/-0)
```diff
@@ -2,15 +2,54 @@
 from __future__ import annotations
 
 import logging
+from collections.abc import Mapping
+from typing import Any
 
 from frontier_agent.core.execution_context import get_current_execution_scope
 from frontier_agent.core.loop_types import BaseObserver, Intervention, TurnContext
 from plugins.tools._bus_scope import resolve_bus_task_id
 from plugins.tools.finalize_answer import finalize_gate
+from plugins.tools.task_board import unresolved_task_ids
 
 logger = logging.getLogger(__name__)
 
 
+def _build_bypass_warning(task_id: str) -> str:
+    """Build the standalone warning for an answer delivered past a blocked gate.
+
+    Built once while the task board is still live — the board is cleared
+    before the workflow output is assembled — and stored in
+    ``finalize_gate_warning`` for the delivery nodes to append after any
+    finalization that would otherwise strip it (the reporter's References
+    cleanup drops everything after that heading).
+    """
+    pending = unresolved_task_ids(task_id)
+    if pending:
+        what = f"task-board item(s) still unfinished: {', '.join(pending)}"
+    else:
+        what = "the finalize gate was still rejecting this submission"
+    return (
+        "\n\n---\n\n"
+        f"> ⚠ Unfinished work at submission: {what}. This answer was "
+        "delivered on the final turn despite the gate — conclusions that "
+        "depend on that work are unverified."
+    )
+
+
+def append_bypass_warning(text: str, source: Mapping[str, Any] | None) -> str:
+    """Re-attach the stored bypass warning at a delivery boundary, once.
+
+    The observer stores the ready-made warning; the delivery nodes append
+    it *after* finalization (reporter References cleanup would strip an
+    earlier append). Idempotent: text already carrying the warning is
+    returned unchanged.
+    """
+    warning = str((source or {}).get("finalize_gate_warning") or "")
+    if not warning or not text or warning in text:
+        return text
+    return f"{text.rstrip()}{warning}"
+
+
 class BareTextFinalizeObserver(BaseObserver):
     critical = True
 
@@ -36,6 +75,17 @@ async def on_llm_response(self, ctx: TurnContext) -> Intervention | None:
             return Intervention(continue_to_next_turn=True, inject_messages=[err])
 
         if isinstance(ctx.metadata, dict):
+            if err:
+                # Last-turn bypass: the gate says BLOCK, but the answer is
+                # delivered anyway rather than lost to max_turns. Keep that
+                # fallback — and make it visible: store the gate message and
+                # a ready-to-append warning (built while the board is live).
+                # The visible text is appended by the delivery nodes AFTER
+                # reporter finalization, which would strip it otherwise.
+                ctx.metadata["finalize_gate_bypassed"] = err
+                ctx.metadata["finalize_gate_warning"] = _build_bypass_warning(
+                    ctx.task_id,
+                )
             ctx.metadata["final_answer"] = text
             ctx.metadata["final_answer_confidence"] = 1.0
         logger.info(
```

**File**: `workflows/agent_team/spec.py` (modified, +4/-0)
```diff
@@ -47,6 +47,7 @@
                 "answer_status", "answer_sentinel",
                 "final_answer_rescued", "final_answer_rescue_mode",
                 "final_answer_source", "stopped_by",
+                "finalize_gate_bypassed", "finalize_gate_warning",
             ],
         ),
         NodeDefinition(
@@ -64,6 +65,7 @@
                     "live_followups", "effective_question",
                     "reporter_backend", "reporter_wall_time_s",
                     "reporter_deadline_monotonic_s",
+                    "finalize_gate_bypassed", "finalize_gate_warning",
                 ],
             ),
             compression=CompressionConfig(enabled=False),
@@ -76,6 +78,8 @@
                 "final_answer_source",
                 "final_answer_rescued",
                 "final_answer_rescue_mode",
+                "finalize_gate_bypassed",
+                "finalize_gate_warning",
             ],
         ),
     ],
```

**File**: `workflows/agent_team/spec_report.py` (modified, +4/-0)
```diff
@@ -49,6 +49,7 @@
                 "answer_status", "answer_sentinel",
                 "final_answer_rescued", "final_answer_rescue_mode",
                 "final_answer_source", "stopped_by",
+                "finalize_gate_bypassed", "finalize_gate_warning",
             ],
         ),
         NodeDefinition(
@@ -66,6 +67,7 @@
                     "live_followups", "effective_question",
                     "reporter_backend", "reporter_wall_time_s",
                     "reporter_deadline_monotonic_s",
+                    "finalize_gate_bypassed", "finalize_gate_warning",
                 ],
             ),
             compression=CompressionConfig(enabled=False),
@@ -78,6 +80,8 @@
                 "final_answer_source",
                 "final_answer_rescued",
                 "final_answer_rescue_mode",
+                "finalize_gate_bypassed",
+                "finalize_gate_warning",
             ],
         ),
     ],
```

---

### Incident Patch 12: `68b92008` (2026-09-29)
**Commit Message**: fix: mask credential files from Compose agent tools

**File**: `apodex/tests/test_deployment_config.py` (modified, +11/-0)
```diff
@@ -42,6 +42,9 @@ def test_default_compose_pulls_release_image_and_preserves_cli_state() -> None:
     assert agent["environment"]["FRONTIER_AGENT_REQUIRE_TOOL_USER"] == "1"
     assert "security_opt" not in agent
     assert ".:/project" in agent["volumes"]
+    # Compose injects these files into the harness environment, but the
+    # project bind must not expose their on-disk contents to tool commands.
+    assert "/dev/null:/project/.env:ro" in agent["volumes"]
     assert agent["working_dir"] == "/project"
     assert "./.apodex/runs:/apodex-runs" in agent["volumes"]
     assert "frontier-agent-inputs:/inputs:ro" in agent["volumes"]
@@ -63,6 +66,14 @@ def test_default_compose_pulls_release_image_and_preserves_cli_state() -> None:
     assert evaluator["environment"]["SANDBOX_BACKEND"] == "bwrap"
     assert evaluator["environment"]["SANDBOX_PROFILE"] == "service"
 
+    for overlay, filename in (
+        ("compose.sglang.yaml", ".env.sglang"),
+        ("compose.transformers.yaml", ".env.transformers"),
+    ):
+        assert f"/dev/null:/project/{filename}:ro" in (
+            _yaml(overlay)["services"]["agent"]["volumes"]
+        )
+
 
 def test_development_compose_is_the_only_compose_file_that_builds() -> None:
     compose = _yaml("compose.yaml")
```

**File**: `compose.sglang.yaml` (modified, +2/-0)
```diff
@@ -65,6 +65,8 @@ services:
         max-file: "3"
 
   agent:
+    volumes:
+      - /dev/null:/project/.env.sglang:ro
     depends_on:
       model:
         condition: service_healthy
```

**File**: `compose.transformers.yaml` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ services:
     restart: unless-stopped
 
   agent:
+    volumes:
+      - /dev/null:/project/.env.transformers:ro
     depends_on:
       model:
         condition: service_healthy
```

**File**: `compose.yaml` (modified, +3/-0)
```diff
@@ -35,6 +35,9 @@ services:
       APODEX_HOST_GID: ${APODEX_HOST_GID:-}
     volumes:
       - .:/project
+      # The harness receives .env through env_file above. Hide the on-disk
+      # copy from model commands, whose host-mapped UID can read /project.
+      - /dev/null:/project/.env:ro
       - ./.apodex/runs:/apodex-runs
       - frontier-agent-inputs:/apodex-inputs
       - frontier-agent-inputs:/inputs:ro
```

**File**: `docs/install/docker.md` (modified, +7/-0)
```diff
@@ -34,6 +34,11 @@ Compose writes session records and deliverables to `.apodex/runs/<session-id>/`.
 Its named state volume is retained for legacy sessions. Attached inputs are
 copied into a separate volume that tools can only read. See
 [run artifacts and timestamps](../run-artifacts.md) for the on-disk layout.
+The agent receives `.env` through its process environment; Compose masks the
+on-disk file inside `/project` so model commands cannot read it. The SGLang and
+Transformers overrides also mask their respective env files. Keep any custom
+credential file outside the mounted project, since project files are available
+to the agent by design.
 
 The convenience helper wraps the same thing:
 
@@ -63,6 +68,7 @@ docker run --rm -it \
   --env-file .env \
   -e APODEX_IN_CONTAINER=1 \
   -e SANDBOX_BACKEND=container \
+  -e FRONTIER_AGENT_REQUIRE_TOOL_USER=1 \
   -e FRONTIER_AGENT_WORKSPACE_DIR=/workspace \
   -e APODEX_RUNS_ROOT=/apodex-runs \
   -e APODEX_RUNS_ROOT_PINNED=1 \
@@ -71,6 +77,7 @@ docker run --rm -it \
   -e APODEX_INPUT_STAGING_ROOT=/apodex-inputs \
   -e FRONTIER_AGENT_INPUTS_ROOT=/inputs \
   -v "$(pwd):/workspace" \
+  -v /dev/null:/workspace/.env:ro \
   -v "$(pwd)/.apodex/runs:/apodex-runs" \
   -v frontier-agent-inputs:/apodex-inputs \
   -v frontier-agent-inputs:/inputs:ro \
```

---

### Incident Patch 13: `f227f926` (2026-09-25)
**Commit Message**: fix: fail closed for service sandbox isolation

**File**: `apodex/tests/test_deployment_config.py` (modified, +5/-0)
```diff
@@ -39,6 +39,7 @@ def test_default_compose_pulls_release_image_and_preserves_cli_state() -> None:
     assert agent["pull_policy"] == "always"
     assert agent["environment"]["APODEX_IN_CONTAINER"] == "1"
     assert agent["environment"]["SANDBOX_BACKEND"] == "container"
+    assert agent["environment"]["FRONTIER_AGENT_REQUIRE_TOOL_USER"] == "1"
     assert "security_opt" not in agent
     assert ".:/project" in agent["volumes"]
     assert agent["working_dir"] == "/project"
@@ -58,6 +59,10 @@ def test_default_compose_pulls_release_image_and_preserves_cli_state() -> None:
     )
     assert agent["environment"]["APODEX_WORKSPACE_LINK"] == "/workspace"
 
+    evaluator = compose["services"]["eval"]
+    assert evaluator["environment"]["SANDBOX_BACKEND"] == "bwrap"
+    assert evaluator["environment"]["SANDBOX_PROFILE"] == "service"
+
 
 def test_development_compose_is_the_only_compose_file_that_builds() -> None:
     compose = _yaml("compose.yaml")
```

**File**: `compose.yaml` (modified, +7/-0)
```diff
@@ -9,6 +9,10 @@ services:
       APODEX_IN_CONTAINER: "1"
       HOME: /root
       SANDBOX_BACKEND: container
+      # A missing agent-tool account would expose the harness environment to
+      # model-authored commands through /proc.  Service deployments must stop
+      # instead of accepting the documented env-only degradation.
+      FRONTIER_AGENT_REQUIRE_TOOL_USER: "1"
       APODEX_LOCAL_UTC_OFFSET: ${APODEX_LOCAL_UTC_OFFSET:-+0000}
       FRONTIER_AGENT_WORKSPACE_DIR: /workspace
       APODEX_SESSION_WORKSPACES_ROOT: /apodex-runs
@@ -51,6 +55,9 @@ services:
       # The eval runner can execute multiple isolated benchmark tasks in one
       # harness container, so it retains the nested bubblewrap backend.
       SANDBOX_BACKEND: bwrap
+      # Multi-task workers need a private PID namespace and fresh procfs.  The
+      # service profile fails closed when the runtime cannot provide them.
+      SANDBOX_PROFILE: service
       APODEX_HOST_UID: ${APODEX_HOST_UID:-}
       APODEX_HOST_GID: ${APODEX_HOST_GID:-}
     volumes:
```

---

### Incident Patch 14: `6ab6b12c` (2026-09-25)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/finalize-gate-bypass-visibility

# Conflicts:
#	CHANGELOG.md

**File**: `.env.example` (modified, +2/-0)
```diff
@@ -21,6 +21,8 @@ OFFICEQA_DOC_MODE=parsed
 FRONTIER_AGENT_DATASETS_DIR=
 
 # Optional: web search and page fetching.
+# Support any Serper.dev-compatible endpoint (like litescrape.com, serpbase.dev,
+# and others): set SERPER_BASE_URL and a provider-issued SERPER_API_KEY.
 SERPER_API_KEY=
 SERPER_BASE_URL=https://google.serper.dev
 JINA_API_KEY=
```

**File**: `CHANGELOG.md` (modified, +33/-0)
```diff
@@ -9,6 +9,21 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 Initial open-source release of FrontierAgent.
 
+### Changed
+
+- **Runtime engine moved to [`apodex-agent-core`](https://pypi.org/project/apodex-agent-core/)
+  (pinned `==0.12.0`).** The agent loop, loop contracts, tool execution,
+  compaction, observers, AgentBus, DAG and providers now come from `agent_core`;
+  `frontier_agent.*` keeps its import paths as `sys.modules` aliases or thin
+  adapters, so workflows, apodex and benchmarks are unchanged. Product policy is
+  injected through `AgentLoopHooks` / `ToolExecutionHooks` and the `configure_*`
+  resolvers (`core/runtime/loop/{agent_loop,tool_exec}.py`,
+  `components/agent_bus/bus.py`, `infra/openai_client.py`). Behaviour now
+  follows AgentCore where the fork had diverged, notably: compaction pins the
+  first user message verbatim and replaces legacy prose spill indexes, and
+  `Any`-typed tool parameters generate `{"type": "string"}` (`create_file`
+  now annotates its `rows` / `data` shorthand shapes explicitly).
+
 ### Added
 
 - **ReAct workflow**: single stateful agent with tool use, sandboxed execution,
@@ -34,10 +49,28 @@ Initial open-source release of FrontierAgent.
 - Clean-machine Linux + NVIDIA installation and release-certification guide,
   distinguishing deployment health from production agent correctness.
 
+- Standalone installation with `uv tool install`: the wheel now ships the
+  provider registry, and `frontier-agent` runs from any directory without a
+  checkout. An optional user env file (`$XDG_CONFIG_HOME/apodex/env`, default
+  `~/.config/apodex/env`, override with `APODEX_ENV_FILE`) holds the endpoint
+  below exported variables and the launch directory's `.env`; a key defined
+  next to a base URL is only applied together with that base URL.
+- `APODEX_BUILD_CONTEXT` names a checkout to build `apodex:local` from when the
+  installed CLI is not one. Without an image, a checkout, or an explicit
+  `APODEX_IMAGE`, the Docker path stops with the options instead of silently
+  running natively.
+
 ### Fixed
 
 - Surface finalize-gate bypasses on the final turn: an answer delivered despite
   open task-board items now carries an unfinished-work note and a
   `finalize_gate_bypassed` marker instead of reading as a clean success.
+- Native mode puts the CLI's own Python environment ahead of the inherited
+  `PATH`, so `read_file`, `download_file`, and `python3` inside `bash` use the
+  interpreter the CLI was installed with rather than a system Python.
+- The Docker launcher forwards the resolved runtime variables (exported
+  environment, launch directory `.env`, user env file) into the container by
+  name with `docker run -e NAME`, so an exported value now takes precedence over
+  the checkout's `.env` inside the container as it already did natively.
 - Apply benchmark question limits after seeded shuffling so repeated runs can
   sample different questions while `--no-shuffle` keeps canonical ordering.
```

**File**: `README.md` (modified, +24/-0)
```diff
@@ -147,9 +147,13 @@ OPENAI_MODEL=your-model-name
 
 # Optional web research tools
 SERPER_API_KEY=
+SERPER_BASE_URL=https://google.serper.dev
 JINA_API_KEY=
 ```
 
+Support any Serper.dev-compatible endpoint (like litescrape.com, serpbase.dev,
+and others) by setting `SERPER_BASE_URL` and a provider-issued `SERPER_API_KEY`.
+
 Start the TUI:
 
 ```bash
@@ -165,6 +169,26 @@ document packages are intentionally optional in native mode; the agent installs
 only what a task actually needs into `<project>/.apodex/runtime/native`. The
 `apodex` command is retained as a compatibility alias.
 
+### Install once, launch from any project
+
+To run `frontier-agent` like any other command-line tool, install it from this
+repository with `uv` and keep the endpoint in one user file:
+
+```bash
+uv tool install --python 3.12 git+https://github.com/ApodexAI/FrontierAgent.git
+
+# Put OPENAI_API_KEY, OPENAI_BASE_URL and OPENAI_MODEL into
+# ${XDG_CONFIG_HOME:-$HOME/.config}/apodex/env and chmod 600 it.
+
+cd /path/to/project
+frontier-agent
+```
+
+Exported variables and a project `.env` still take precedence over the user
+file. On macOS with Docker running, the container image has to be built once
+from a clone. [Install once and launch from any project](docs/install/global-install.md)
+covers the PATH setup, the precedence rules, the Docker step, and updating.
+
 Prefer a script that does all of the above? `./scripts/run-macos.sh` and
 `./scripts/run-linux.sh` set up a hosted-endpoint install, and
 `./scripts/run-linux-gpu.sh --install-system-deps --setup-only` prepares a native,
```

**File**: `apodex/README.md` (modified, +25/-5)
```diff
@@ -67,8 +67,18 @@ is enough.
 
 ## Install and run
 
-Run from the repository root, so `frontier_agent`, `plugins` and `workflows`
-import:
+Two ways to install. As a standalone tool, so the command works from any
+directory:
+
+```bash
+uv tool install --python 3.12 git+https://github.com/ApodexAI/FrontierAgent.git
+# credentials in ${XDG_CONFIG_HOME:-$HOME/.config}/apodex/env, or exported;
+# see docs/install/global-install.md
+cd /path/to/your/repo && frontier-agent
+```
+
+Or from a checkout, run from the repository root so `frontier_agent`,
+`plugins` and `workflows` import from the source tree:
 
 ```bash
 uv sync
@@ -119,14 +129,24 @@ attached through the same session input manager; ordinary text is inserted into
 the prompt. `Cmd+V` remains the terminal's normal text paste shortcut.
 
 This is a local, open-source BYOK tool: there is no account or `login` command.
-Keys stay in your environment or local `.env`; the TUI never asks for or displays
-them. Startup validates the local configuration before opening the TUI, and
+Keys stay in your environment, a local `.env`, or the optional user file
+`$XDG_CONFIG_HOME/apodex/env` (default `~/.config/apodex/env`, override with
+`APODEX_ENV_FILE`); the TUI never asks for or displays them. Precedence is CLI
+options, then exported variables, then the launch directory's `.env`, then the
+user file. The user file is read literally, without `${VAR}` expansion, and a
+key it defines next to a base URL is only applied together with that base URL.
+Startup validates the local configuration before opening the TUI, and
 `/config` shows only safe diagnostics such as provider, model, endpoint host and
 whether the required key is configured.
 
 The first `--docker` run builds the image, which takes a few minutes
 (LibreOffice and the document readers are large); later runs reuse it.
-`APODEX_IMAGE` overrides the tag.
+`APODEX_IMAGE` overrides the tag. Building needs a source checkout. A tool
+installed with `uv tool install` has none, so it uses an image that is already
+present, builds from the clone named by `APODEX_BUILD_CONTEXT`, or pulls an
+explicit `APODEX_IMAGE`; with none of those it stops and lists the options
+instead of running natively unannounced. Configured variables cross into the
+container by name (`docker run -e NAME`), never as values on the command line.
 
 On Linux, native mode is the default. On macOS, Docker remains preferred when
 its daemon is reachable, with automatic fallback to native mode. Native mode
```

**File**: `apodex/cli.py` (modified, +24/-15)
```diff
@@ -25,25 +25,22 @@
 from apodex.session import TerminalSession
 from apodex.terminal import resolve_terminal_ui
 from apodex.tui.themes import CLI_THEME_NAMES
+from apodex.userenv import EnvResolution, load_environment
 
 if TYPE_CHECKING:
     from apodex.config import ModelConfig
 
 
-def _load_env() -> None:
+def _load_env() -> EnvResolution:
     """Load a ``.env`` (keys/base-url/model) from the launch directory or an
-    ancestor, the way FrontierAgent's own entry points do. ``override=False`` so
-    real environment variables and CLI flags always win. Must run **before**
-    any ``chdir`` so it finds the repo's ``.env`` rather than the target repo.
+    ancestor, the way FrontierAgent's own entry points do, then the optional
+    user env file underneath it. ``override=False`` so real environment
+    variables and CLI flags always win. Must run **before** any ``chdir`` so it
+    finds the repo's ``.env`` rather than the target repo, and before native
+    mode rewrites ``HOME``/``XDG_CONFIG_HOME``, so the user file is read from
+    the user's real config directory. See :mod:`apodex.userenv`.
     """
-    try:
-        from dotenv import find_dotenv, load_dotenv
-    except Exception:
-        return
-    load_dotenv(".env", override=False)
-    found = find_dotenv(usecwd=True)
-    if found:
-        load_dotenv(found, override=False)
+    return load_environment()
 
 
 # (substring in an engine log message) -> clean one-line note to surface
@@ -301,7 +298,13 @@ async def _amain(argv: list[str] | None = None) -> int:
     # keys are available (the standalone CLI isn't bootstrapped by the app).
     # (The fully-local toolchain guarantee — incl. dropping E2B_API_KEY — is
     # owned by TerminalSession._authorize_workspace.)
-    _load_env()
+    env_resolution = _load_env()
+    # Secret-free by construction (names and paths only). Printed now so the
+    # explanation precedes whatever the note is about — a preflight failure
+    # over a withheld key, say — and only once: the TUI path alone repeats
+    # them in its transcript, since its alternate screen covers stderr.
+    for note in env_resolution.notes:
+        print(f"apodex: {note}", file=sys.stderr)
 
     # Textual's Kitty keyboard negotiation drops IME commits in iTerm2.  Set
     # the compatibility fallback before either starting the native TUI or
@@ -377,7 +380,10 @@ async def _amain(argv: list[str] | None = None) -> int:
                        if a != "--docker"]
         docker_ok, docker_reason = docker_available()
         if args.docker or docker_ok:
-            return run_in_container(passthrough, cwd=cwd)
+            return run_in_container(
+                passthrough, cwd=cwd,
+                forward_env=env_resolution.forwarded_names(),
+            )
         print(
             f"apodex: Docker is unavailable ({docker_reason}); using native mode.",
             file=sys.stderr,
@@ -517,7 +523,10 @@ async def _amain(argv: list[str] | None = None) -> int:
     # stderr is written moments before Textual takes the alternate screen, so a
     # warning printed here is gone by the time the TUI is up. The TUI path
     # carries them into the transcript instead; line mode prints as before.
-    startup_warnings = [warning.message for warning in runtime_config.warnings]
+    startup_warnings = [
+        *(env_resolution.notes if use_tui else ()),
+        *(warning.message for warning in runtime_config.warnings),
+    ]
     if not use_tui:
         for message in startup_warnings:
             print(f"warning: {message}", file=sys.stderr)
```

**File**: `apodex/docker.py` (modified, +104/-9)
```diff
@@ -11,10 +11,20 @@
 - a dedicated ``.apodex/runs/<session-id>/outputs`` directory, read-write at
   ``/outputs``;
 - ``~/.apodex`` (session history, traces), so ``--resume`` works across runs;
-- ``.env`` from the repo, for model and search credentials.
+- ``.env`` from the repo, for model and search credentials, plus the resolved
+  runtime variables the host CLI loaded (exported environment, the launch
+  directory's ``.env``, the user env file) — forwarded by *name* with
+  ``-e NAME`` so Docker reads each value from the process environment and no
+  secret ever lands on a command line.
 
 The image is built on first use and reused after that. It is the same
 ``Dockerfile`` the benchmark runner uses, so there is one image to maintain.
+Building needs a source checkout: a wheel installed with ``uv tool install``
+carries no Dockerfile. Outside a checkout the launcher uses an image that is
+already present, pulls an explicitly requested ``APODEX_IMAGE``, or builds
+from the checkout named by ``APODEX_BUILD_CONTEXT`` — and otherwise stops
+with the options spelled out rather than quietly running without the
+boundary the platform default promised.
 """
 from __future__ import annotations
 
@@ -24,12 +34,34 @@
 import shutil
 import subprocess
 import sys
-from collections.abc import Mapping
+from collections.abc import Mapping, Sequence
 from pathlib import Path
 
 _DEFAULT_IMAGE = "apodex:local"
 IMAGE = os.environ.get("APODEX_IMAGE", _DEFAULT_IMAGE)
 _REPO_ROOT = Path(__file__).resolve().parents[1]
+BUILD_CONTEXT_VAR = "APODEX_BUILD_CONTEXT"
+
+
+class BuildContextUnavailable(RuntimeError):
+    """No directory with a Dockerfile to build the default image from."""
+
+
+def build_context(environ: Mapping[str, str] | None = None) -> Path | None:
+    """The directory whose ``Dockerfile`` builds :data:`_DEFAULT_IMAGE`.
+
+    ``APODEX_BUILD_CONTEXT`` names it explicitly (a FrontierAgent checkout, for
+    an installation that lives elsewhere). Otherwise it is this package's own
+    repository root when that is a checkout. ``None`` for a wheel installed
+    outside any checkout: ``site-packages`` has no Dockerfile.
+    """
+    env = os.environ if environ is None else environ
+    override = (env.get(BUILD_CONTEXT_VAR) or "").strip()
+    if override:
+        return Path(override).expanduser()
+    if (_REPO_ROOT / "Dockerfile").is_file():
+        return _REPO_ROOT
+    return None
 
 
 def terminal_env(environ: Mapping[str, str]) -> list[str]:
@@ -122,21 +154,49 @@ def image_exists(image: str = IMAGE) -> bool:
     return probe.returncode == 0
 
 
-def build_image(image: str = IMAGE, *, quiet: bool = False) -> None:
+def build_image(
+    image: str = IMAGE, *, quiet: bool = False, context: Path | None = None,
+) -> None:
     """Build the image from the repo Dockerfile.
 
     Streams the build output: it takes minutes the first time (LibreOffice and
     the document readers are large), and a silent multi-minute wait reads as a
-    hang.
+    hang. Raises :class:`BuildContextUnavailable` when there is no checkout
+    to build from; the caller turns that into user-facing guidance.
     """
-    print(f"apodex: building {image} (first run only, this takes a few minutes)…",
-          file=sys.stderr)
-    cmd = ["docker", "build", "-t", image, str(_REPO_ROOT)]
+    root = context if context is not None else build_context()
+    if root is None:
+        raise BuildContextUnavailable(
+            f"{image} is not present locally, and this installation is not a "
+            "source checkout, so it cannot be built here"
+        )
+    if not (root / "Dockerfile").is_file():
+        raise BuildContextUnavailable(
+            f"{BUILD_CONTEXT_VAR}={root} does not contain a Dockerfile"
+        )
+    print(f"apodex: building {image} from {root} (first run only, this takes a "
+          "few minutes)…", file=sys.stderr)
+    cmd = ["docker", "build", "-t", image, str(root)]
     if quiet:
         cmd.insert(2, "--quiet")
     subprocess.run(cmd, check=True)
 
 
+def _build_unavailable_message(reason: str) -> str:
+    return (
+        f"apodex: cannot use the Docker path — {reason}.\n"
+        "        Choose one:\n"
+        "          docker build -t apodex:local /path/to/FrontierAgent   "
+        "(build once from a checkout)\n"
+        f"          export {BUILD_CONTEXT_VAR}=/path/to/FrontierAgent      "
+        "(let this command build from it)\n"
+        "          export APODEX_IMAGE=<image you can pull>            "
+        "(use a registry image)\n"
+        "          frontier-agent --native …                            "
+        "(workspace-local host runtime, not an OS sandbox)"
+    )
+
+
 def pull_image(image: str) -> bool:
     """Fetch *image* from its registry, returning whether it arrived.
 
@@ -148,9 +208,19 @@ def pull_image(image: str) -> bool:
 
 
 def run_in_container(
-    argv: list[str], *, cwd: str | None = None, image: str = IMAGE,
+    argv: list[str],
+    *,
+ 
```

**File**: `apodex/native.py` (modified, +35/-0)
```diff
@@ -7,10 +7,42 @@
 from __future__ import annotations
 
 import os
+import sys
 from collections.abc import MutableMapping
 from pathlib import Path
 
 
+def _interpreter_bin_dir(inherited_path: str) -> Path | None:
+    """The CLI interpreter's ``bin`` directory, to lead the inherited PATH.
+
+    Native mode promises that the CLI's own Python environment is what
+    ``python3`` means to the tools (``read_file`` and ``download_file`` pipe
+    their helpers to ``python3 -``; the model's ``bash`` heredocs do the same).
+    From a checkout, ``uv run`` puts the venv first on PATH and the promise
+    holds by accident. An installation made with ``uv tool install`` exposes
+    only ``frontier-agent``/``apodex`` on PATH, so ``python3`` fell through to
+    whatever the system ships — on macOS a 3.9 that cannot even parse the
+    readers.
+
+    ``sys.executable`` is used *unresolved* on purpose: a venv's ``bin/python``
+    is a symlink to the base interpreter, and following it would name the base
+    installation's ``bin`` — the wrong environment, without the CLI's
+    dependencies. Only the directory itself is normalised. ``None`` when the
+    directory already leads the inherited PATH, so the ``uv run`` case keeps
+    its PATH byte-for-byte.
+    """
+    executable = sys.executable
+    if not executable:
+        return None
+    bin_dir = Path(os.path.abspath(os.path.dirname(executable)))
+    if not bin_dir.is_dir():
+        return None
+    first = inherited_path.split(os.pathsep, 1)[0].strip() if inherited_path else ""
+    if first and os.path.abspath(first) == str(bin_dir):
+        return None
+    return bin_dir
+
+
 def prepare_native_runtime(
     workspace: str,
     session_id: str,
@@ -69,6 +101,9 @@ def prepare_native_runtime(
         dependencies / "cargo" / "bin",
     ]
     native_path = os.pathsep.join(str(path) for path in native_bins)
+    interpreter_bin = _interpreter_bin_dir(inherited_path)
+    if interpreter_bin is not None:
+        native_path = f"{native_path}{os.pathsep}{interpreter_bin}"
     if inherited_path:
         native_path = f"{native_path}{os.pathsep}{inherited_path}"
 
```

**File**: `apodex/tests/test_cli_runtime_selection.py` (modified, +60/-0)
```diff
@@ -46,3 +46,63 @@ def _refuse(requested: str | None = None) -> sandbox.Strategy:
     assert cli.main(["--bwrap"]) == 2
     assert macos == []
     assert "no bubblewrap here" in capsys.readouterr().err
+
+
+def test_macos_global_install_with_docker_but_no_image_fails_closed(
+    monkeypatch, tmp_path, capsys,
+) -> None:
+    """A wheel on a Mac with Docker running must not quietly go native.
+
+    The platform default promised a container. With no image and no checkout
+    to build one from, the honest outcome is a stop that names the options,
+    not a native run the user never asked for.
+    """
+    from apodex import docker
+
+    monkeypatch.chdir(tmp_path)
+    monkeypatch.setattr(cli.sys, "platform", "darwin")
+    monkeypatch.setattr("apodex.docker.docker_available", lambda: (True, "available"))
+    monkeypatch.setattr(docker, "image_exists", lambda image: False)
+    monkeypatch.setattr(docker, "_REPO_ROOT", tmp_path / "site-packages")
+    monkeypatch.delenv(docker.BUILD_CONTEXT_VAR, raising=False)
+    monkeypatch.setattr(
+        docker.subprocess, "run",
+        lambda *a, **k: pytest.fail("no docker command may run without an image"),
+    )
+    monkeypatch.setattr(
+        "apodex.native.prepare_native_runtime",
+        lambda *a, **k: pytest.fail("must not fall back to the native runtime"),
+    )
+
+    assert cli.main([]) == 1
+
+    err = capsys.readouterr().err
+    assert "cannot use the Docker path" in err
+    assert docker.BUILD_CONTEXT_VAR in err
+    assert "--native" in err
+
+
+def test_macos_container_launch_forwards_the_resolved_environment(
+    monkeypatch, tmp_path,
+) -> None:
+    monkeypatch.chdir(tmp_path)
+    monkeypatch.setattr(cli.sys, "platform", "darwin")
+    monkeypatch.setattr("apodex.docker.docker_available", lambda: (True, "available"))
+    seen: dict[str, object] = {}
+
+    def _record(argv, **kwargs):
+        seen["argv"] = list(argv)
+        seen["forward_env"] = tuple(kwargs.get("forward_env", ()))
+        return 0
+
+    monkeypatch.setattr("apodex.docker.run_in_container", _record)
+    (tmp_path / ".env").write_text("OPENAI_MODEL=project-model\n", encoding="utf-8")
+    monkeypatch.setenv("OPENAI_API_KEY", "sk-exported")
+    monkeypatch.delenv("OPENAI_MODEL", raising=False)
+
+    assert cli.main(["--docker", "-p", "hi"]) == 0
+
+    assert seen["argv"] == ["-p", "hi"]
+    assert "OPENAI_MODEL" in seen["forward_env"]     # from the launch .env
+    assert "OPENAI_API_KEY" in seen["forward_env"]   # exported
+    assert all("sk-exported" not in name for name in seen["forward_env"])
```

---

### Incident Patch 15: `4f4eb5fa` (2026-09-25)
**Commit Message**: fix(agent-team): carry the bypass marker through workflow output and reporter finalization

Review on #48: the marker died in loop-local metadata (consumers only
saw answer_status="complete"), and the warning appended after a trailing
References section was stripped by the reporter's citation cleanup.

- publish finalize_gate_bypassed + finalize_gate_warning from
  main_agent_node and list them in both specs (main output_fields,
  reporter include_fields/output_fields)
- the observer now stores a ready-to-append warning built while the
  task board is still live instead of mutating the latched answer
- delivery nodes append the warning after finalization: main_agent for
  the coordinator's own answer, agent_team_reporter after
  _run_fast_reporter returns (References cleanup has already run)
- append_bypass_warning is idempotent
- five new tests cover both delivery boundaries and document the strip
  hazard, including strip_trailing_references' 30% heading guard

**File**: `tests/test_bare_text_finalize_gate.py` (modified, +135/-13)
```diff
@@ -1,15 +1,32 @@
 from __future__ import annotations
 
 import asyncio
+from collections.abc import Mapping
+from typing import Any
+
+import pytest
 
 from frontier_agent.core.loop_types import TurnContext, notify_observers
 from plugins.tools import task_board as tb
+from workflows._shared.citation_contract import (
+    finalize_report_with_canonical_references,
+)
+from workflows.agent_team.nodes import fast_reporter_v1
+from workflows.agent_team.nodes.reporter import agent_team_reporter
+from workflows.agent_team.observers import bare_text_finalize as btf
 from workflows.agent_team.observers.bare_text_finalize import (
     BareTextFinalizeObserver,
 )
+from workflows.agent_team.spec import SWARM_SPEC
+from workflows.agent_team.spec_report import AGENT_TEAM_REPORT_SPEC
 
 _TASK = "task"
-_ANSWER = "Deployment complete; 100% of attacks blocked."
+_ANSWER = "Deployment complete; 100% of attacks blocked [1]."
+_REFERENCES = [{"url": "https://example.com/a", "title": "Example"}]
+_BYPASS_ERR = (
+    "Cannot finish: task board has unresolved item(s) ['t1']. "
+    "For each, call update_task(...)"
+)
 
 
 def _seed_board(resolutions: dict[str, str]) -> None:
@@ -67,31 +84,35 @@ def test_mid_run_unfinished_board_still_blocks() -> None:
     assert "final_answer" not in ctx.metadata
 
 
-def test_final_turn_bypass_marks_unfinished_work() -> None:
-    """The last-turn bypass must deliver WITH a visible unfinished-work note.
+def test_final_turn_bypass_stores_marker_and_warning() -> None:
+    """The bypass must leave machine- and human-readable traces in metadata.
 
     ``finalize_gate`` blocks while board items are open, but the final turn
-    accepts the answer anyway (never lose it to max_turns). That bypass used
-    to be silent — an unfinished run looked like a clean success. It must
-    latch the answer, flag ``finalize_gate_bypassed``, and append a note
-    naming the still-open items (issue #19).
+    accepts the answer anyway (never lose it to max_turns). The observer
+    stores the gate message (``finalize_gate_bypassed``) and a ready-to-append
+    warning built while the board is still live
+    (``finalize_gate_warning``); delivery nodes append the warning after any
+    finalization that would otherwise strip it (issue #19, review on #48).
+    The latched answer itself stays clean — appending here would be defeated
+    by the reporter's References cleanup.
     """
-    _seed_board({"t1": "open", "t2": "open", "t3": "open"})
+    _seed_board({"t1": "open", "t2": "open"})
     ctx = _context(turn=19)
 
     interventions = _dispatch(ctx)
 
     (intervention,) = interventions
     assert intervention.stop_reason == "final_answer"
-    latched = ctx.metadata["final_answer"]
-    assert "unfinished" in str(latched).casefold()
-    for task_id in ("t1", "t2", "t3"):
-        assert task_id in str(latched)
     assert ctx.metadata.get("finalize_gate_bypassed")
+    warning = str(ctx.metadata.get("finalize_gate_warning") or "")
+    assert "unfinished" in warning.casefold()
+    assert "t1" in warning and "t2" in warning
+    # The answer is latched verbatim; the warning travels separately.
+    assert ctx.metadata["final_answer"] == _ANSWER
 
 
 def test_final_turn_clean_board_latches_untouched() -> None:
-    """Gate passes → the answer is latched verbatim, no note, no marker."""
+    """Gate passes → the answer is latched verbatim, no marker, no warning."""
     _seed_board({"t1": "resolved", "t2": "cancelled"})
     ctx = _context(turn=19)
 
@@ -101,3 +122,104 @@ def test_final_turn_clean_board_latches_untouched() -> None:
     assert intervention.stop_reason == "final_answer"
     assert ctx.metadata["final_answer"] == _ANSWER
     assert "finalize_gate_bypassed" not in ctx.metadata
+    assert "finalize_gate_warning" not in ctx.metadata
+
+
+def test_references_finalizer_strips_a_trailing_warning() -> None:
+    """Documents WHY the warning must be re-attached after finalization.
+
+    ``finalize_report_with_canonical_references`` drops everything from the
+    ``References`` heading to the end of the body — a warning appended after
+    that section does not survive the reporter's citation cleanup.
+
+    ``strip_trailing_references`` refuses to cut when the heading starts
+    before 30% of the body (mid-body sections are legitimate), so the body
+    must be realistically long — as in a real report, where the reviewer's
+    reproduction showed the warning being stripped.
+    """
+    body = (
+        "Attackers probed hidden paths, enumerated backup archives, and "
+        "fuzzed administrative endpoints across several weeks of access "
+        "logs before the intrusion was detected. " * 3
+        + "[1]\n\n"
+        "## References\n\n"
+        "[1] https://example.com/a\n"
+    )
+    warning = "\n\n---\n\n> ⚠ Unfinished work at submission: task t1."
+    finalized = finalize_report_with_canonical_references(
+        body + warning,
+        references=_REFERENCES,
+   
```

**File**: `workflows/agent_team/nodes/main_agent.py` (modified, +14/-0)
```diff
@@ -104,6 +104,7 @@
 from workflows.agent_team.observers.auto_fan_in import AutoFanInObserver
 from workflows.agent_team.observers.bare_text_finalize import (
     BareTextFinalizeObserver,
+    append_bypass_warning,
 )
 from workflows.agent_team.observers.console import RichConsoleObserver
 from workflows.agent_team.observers.no_progress_guard import NoProgressGuard
@@ -1667,6 +1668,13 @@ async def _run_main_loop(
             url_repair_stats["unmatched"], url_repair_stats["checked"],
         )
 
+    # Re-attach the finalize-gate bypass warning (if any) only now: the
+    # observer stores it while the board is live, and this is the delivery
+    # boundary for the coordinator's own answer. When the reporter runs it
+    # re-appends on its own freshly finalized text (References cleanup would
+    # strip an earlier append) — see review on #48.
+    final_text = append_bypass_warning(final_text, result.metadata)
+
     if reporter_enabled and result.metadata.get("report_handoff"):
         logger.info(
             "agent_team: research stopped by %s; advancing to downstream reporter",
@@ -1708,6 +1716,12 @@ async def _run_main_loop(
             result.metadata.get("final_answer_rescue_mode") or "",
         ),
         "final_answer_source": answer_source,
+        "finalize_gate_bypassed": str(
+            result.metadata.get("finalize_gate_bypassed") or "",
+        ),
+        "finalize_gate_warning": str(
+            result.metadata.get("finalize_gate_warning") or "",
+        ),
         # Conditional edge in both agent-team specs consumes this resolved
         # per-request value. False routes directly to END, preserving the
         # coordinator's answer as the protocol final.
```

**File**: `workflows/agent_team/nodes/reporter.py` (modified, +12/-0)
```diff
@@ -337,6 +337,16 @@ async def agent_team_reporter(
     if not report_md.strip():
         return {}
 
+    # Re-attach the finalize-gate bypass warning now: References cleanup
+    # inside the chain has already run, so this append survives it — the
+    # observer's stored warning is the same one main_agent would have
+    # appended had the reporter not replaced the answer (review on #48).
+    from workflows.agent_team.observers.bare_text_finalize import (
+        append_bypass_warning,
+    )
+
+    report_md = append_bypass_warning(report_md, state)
+
     try:
         _refresh_trace_terminal(state.get("metadata") or {}, report_md)
     except Exception as exc:
@@ -355,4 +365,6 @@ async def agent_team_reporter(
         "final_answer_source": "reporter_llm",
         "final_answer_rescued": False,
         "final_answer_rescue_mode": "",
+        "finalize_gate_bypassed": str(state.get("finalize_gate_bypassed") or ""),
+        "finalize_gate_warning": str(state.get("finalize_gate_warning") or ""),
     }
```

**File**: `workflows/agent_team/observers/bare_text_finalize.py` (modified, +31/-11)
```diff
@@ -2,6 +2,8 @@
 from __future__ import annotations
 
 import logging
+from collections.abc import Mapping
+from typing import Any
 
 from frontier_agent.core.execution_context import get_current_execution_scope
 from frontier_agent.core.loop_types import BaseObserver, Intervention, TurnContext
@@ -12,27 +14,42 @@
 logger = logging.getLogger(__name__)
 
 
-def _unfinished_note(task_id: str, text: str) -> str:
-    """Footnote an answer that is being delivered despite a blocked gate.
+def _build_bypass_warning(task_id: str) -> str:
+    """Build the standalone warning for an answer delivered past a blocked gate.
 
-    The last turn must not lose the answer to ``max_turns`` (see the bypass
-    below), but an unfinished run must never read as a clean success: name the
-    board items that are still unresolved so the reader can tell which parts
-    of the answer were never corroborated.
+    Built once while the task board is still live — the board is cleared
+    before the workflow output is assembled — and stored in
+    ``finalize_gate_warning`` for the delivery nodes to append after any
+    finalization that would otherwise strip it (the reporter's References
+    cleanup drops everything after that heading).
     """
     pending = unresolved_task_ids(task_id)
     if pending:
         what = f"task-board item(s) still unfinished: {', '.join(pending)}"
     else:
         what = "the finalize gate was still rejecting this submission"
     return (
-        f"{text}\n\n---\n\n"
+        "\n\n---\n\n"
         f"> ⚠ Unfinished work at submission: {what}. This answer was "
         "delivered on the final turn despite the gate — conclusions that "
         "depend on that work are unverified."
     )
 
 
+def append_bypass_warning(text: str, source: Mapping[str, Any] | None) -> str:
+    """Re-attach the stored bypass warning at a delivery boundary, once.
+
+    The observer stores the ready-made warning; the delivery nodes append
+    it *after* finalization (reporter References cleanup would strip an
+    earlier append). Idempotent: text already carrying the warning is
+    returned unchanged.
+    """
+    warning = str((source or {}).get("finalize_gate_warning") or "")
+    if not warning or not text or warning in text:
+        return text
+    return f"{text.rstrip()}{warning}"
+
+
 class BareTextFinalizeObserver(BaseObserver):
     critical = True
 
@@ -61,11 +78,14 @@ async def on_llm_response(self, ctx: TurnContext) -> Intervention | None:
             if err:
                 # Last-turn bypass: the gate says BLOCK, but the answer is
                 # delivered anyway rather than lost to max_turns. Keep that
-                # fallback — and make it visible (machine-readable marker
-                # plus a user-visible note), so an unfinished run is never
-                # presented as a clean success.
+                # fallback — and make it visible: store the gate message and
+                # a ready-to-append warning (built while the board is live).
+                # The visible text is appended by the delivery nodes AFTER
+                # reporter finalization, which would strip it otherwise.
                 ctx.metadata["finalize_gate_bypassed"] = err
-                text = _unfinished_note(ctx.task_id, text)
+                ctx.metadata["finalize_gate_warning"] = _build_bypass_warning(
+                    ctx.task_id,
+                )
             ctx.metadata["final_answer"] = text
             ctx.metadata["final_answer_confidence"] = 1.0
         logger.info(
```

**File**: `workflows/agent_team/spec.py` (modified, +4/-0)
```diff
@@ -47,6 +47,7 @@
                 "answer_status", "answer_sentinel",
                 "final_answer_rescued", "final_answer_rescue_mode",
                 "final_answer_source", "stopped_by",
+                "finalize_gate_bypassed", "finalize_gate_warning",
             ],
         ),
         NodeDefinition(
@@ -64,6 +65,7 @@
                     "live_followups", "effective_question",
                     "reporter_backend", "reporter_wall_time_s",
                     "reporter_deadline_monotonic_s",
+                    "finalize_gate_bypassed", "finalize_gate_warning",
                 ],
             ),
             compression=CompressionConfig(enabled=False),
@@ -76,6 +78,8 @@
                 "final_answer_source",
                 "final_answer_rescued",
                 "final_answer_rescue_mode",
+                "finalize_gate_bypassed",
+                "finalize_gate_warning",
             ],
         ),
     ],
```

**File**: `workflows/agent_team/spec_report.py` (modified, +4/-0)
```diff
@@ -49,6 +49,7 @@
                 "answer_status", "answer_sentinel",
                 "final_answer_rescued", "final_answer_rescue_mode",
                 "final_answer_source", "stopped_by",
+                "finalize_gate_bypassed", "finalize_gate_warning",
             ],
         ),
         NodeDefinition(
@@ -66,6 +67,7 @@
                     "live_followups", "effective_question",
                     "reporter_backend", "reporter_wall_time_s",
                     "reporter_deadline_monotonic_s",
+                    "finalize_gate_bypassed", "finalize_gate_warning",
                 ],
             ),
             compression=CompressionConfig(enabled=False),
@@ -78,6 +80,8 @@
                 "final_answer_source",
                 "final_answer_rescued",
                 "final_answer_rescue_mode",
+                "finalize_gate_bypassed",
+                "finalize_gate_warning",
             ],
         ),
     ],
```

#### Recent Merged Pull Requests:
- **PR #57** (2026-10-02): docs(docker): correct the container quick start for the private image (@Yi-111-a)
- **PR #56** (2026-09-30): docs: add Trendshift popularity badge (@zhanghanduo)
- **PR #55** (2026-10-02): Add an opt-in Parallel Search MCP provider (@georgeatparallel)
- **PR #54** (closed): fix(agent_team): tool_choice crash, Unknown-agent recovery guard + planning-mode/schema fixes (@dkcbr)
- **PR #52** (2026-09-30): chore(deps): bump apodex-agent-core to 0.12.2 (@zhanghanduo)
- **PR #51** (2026-09-30): fix: fail closed for service sandbox isolation (@jack-yang-apodex)
- **PR #50** (2026-09-25): refactor(runtime): run the agent loop on apodex-agent-core 0.12.0 (@zhanghanduo)
- **PR #49** (2026-09-30): Fix native workflow behavior and isolate path localization tests (@zhanghanduo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
