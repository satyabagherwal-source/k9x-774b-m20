# Forensic Learning Record (Deep Inspection): wanshuiyin/Auto-claude-code-research-in-sleep

> **Canonical Artifact**: `07_PROJECT_LEARNING/wanshuiyin-auto-claude-code-research-in-sleep-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:15:56.405Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wanshuiyin/Auto-claude-code-research-in-sleep`
- **Description**: ARIS ⚔️ (Auto-Research-In-Sleep) — Lightweight Markdown-only skills for autonomous ML research: cross-model review loops, idea discovery, and experiment automation. No framework, no lock-in — works with Claude Code, Codex, OpenClaw, or any LLM agent.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17021 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/experiment-queue/scripts/queue_manager.py`
```
#!/usr/bin/env python3
"""queue_manager.py — ARIS experiment-queue scheduler.

Runs on the SSH remote host (or locally for Modal/Vast.ai future support).
Reads a manifest, launches jobs across free GPUs via `screen`, retries on OOM,
cleans stale screens, and writes state continuously to disk.

Usage (on remote):
    nohup python3 queue_manager.py \\
        --manifest manifest.json \\
        --state queue_state.json \\
        --log-dir ./logs \\
        > queue_mgr.log 2>&1 &

(Pass --log-dir, NOT --log: --log is declared but unused; per-job log
files in --log-dir drive OOM detection and stale-screen cleanup.)

The manifest.json is either produced manually or by `build_manifest.py`.

State file format (queue_state.json):
{
  "meta": {"project": "...", "started": "ISO8601", "host": "..."},
  "phases": [{"name": "...", "depends_on": [...], "status": "..."}],
  "jobs": [
    {
      "id": "s200_N64_n50K",
      "phase": "distill",
      "status": "running",  # pending|running|completed|failed_oom|failed_other|stuck
      "gpu": 3,
      "screen_name": "EQ_s200_N64_n50K",
      "pid": 12345,
      "attempts": 1,
      "started": "...",
      "completed": null,
      "expected_output": "figures/distill_sw_N64_n50K_...json",
      "error": null
    }, ...
  ]
}
"""

import argparse
import glob
import json
import os
import re
import shlex
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


OOM_RE = re.compile(r"(CUDA out of memory|torch\.OutOfMemoryError)")
DEFAULT_GPU_FREE_THRESHOLD_MIB = 500
POLL_INTERVAL_SEC = 60


def resolve_conda_hook(manifest_hook=None):
    """Resolve conda hook command via (1) manifest, (2) env var, (3) auto-detect, (4) PATH.

    manifest_hook: value of `conda_hook` field in manifest (full hook command, e.g.
        `eval "$(/custom/path/conda shell.bash hook)"`), or a bare conda binary path
        which will be wrapped automatically.
    """
    def wrap(path_or_cmd):
        if path_or_cmd.startswith("eval"):
            return path_or_cmd
        return f'eval "$({path_or_cmd} shell.bash hook)"'

    # 1. Manifest override
    if manifest_hook:
        return wrap(manifest_hook)
    # 2. Env var override
    env_hook = os.environ.get("ARIS_CONDA_HOOK")
    if env_hook:
        return wrap(env_hook)
    # 3. Auto-detect common install paths
    for p in (
        os.path.expanduser("~/anaconda3/bin/conda"),
        os.path.expanduser("~/miniconda3/bin/conda"),
        os.path.expanduser("~/miniforge3/bin/conda"),
        "/opt/anaconda3/bin/conda",
        "/opt/miniconda3/bin/conda",
        "/opt/miniforge3/bin/conda",
        "/usr/local/anaconda3/bin/conda",
        "/opt/homebrew/anaconda3/bin/conda",
    ):
        if os.path.exists(p):
            return wrap(p)
    # 4. Fall back to PATH
    out, rc = run("command -v conda 2>/dev/null")
    if rc == 0 and out.strip():
        return wrap(out.strip())
    # 5. Last resort
    return 'eval "$(conda shell.bash hook)"'


def now():
    return datetime.utcnow().isoformat() + "Z"


def run(cmd, check=False, capture=True):
    """Run shell command, return (stdout, returncode)."""
    r = subprocess.run(cmd, shell=True, capture_output=capture, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}\n{r.stderr}")
    return r.stdout, r.returncode


def gpu_memory_used():
    """Return list of used MiB per GPU index."""
    out, rc = run("nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits")
    if rc != 0:
        return []
    return [int(x.strip()) for x in out.strip().split("\n") if x.strip()]


def free_gpus(allowed, threshold_mib=DEFAULT_GPU_FREE_THRESHOLD_MIB):
    """Return list of GPU indices with memory.used < threshold."""
    used = gpu_memory_used()
    return [i for i in allowed if i < len(used) and used[i] < threshold_mib]


def screen_exists(name):
    out, _ = run("screen -ls")
    return re.search(rf"^\s*\d+\.{re.escape(name)}\s", out, re.MULTILINE) is not None


def kill_screen(name):
    run(f"screen -S {name} -X quit", check=False)


def detect_oom_in_log(log_path):
    if not log_path or not Path(log_path).exists():
        return False
    try:
        # Check tail of log for OOM marker
        out, _ = run(f"tail -c 10000 {shlex.quote(log_path)}")
        return bool(OOM_RE.search(out))
    except Exception:
        return False


def output_exists(path_pattern, cwd):
    """Check if output file exists (pattern supports shell glob)."""
    if not path_pattern:
        return False
    full = os.path.join(cwd, path_pattern) if not os.path.isabs(path_pattern) else path_pattern
    return bool(glob.glob(full))


def _normalize_depends_on(value):
    """A bare string was the shape our own docs showed until 2026-08; without this
    it would be iterated character by character and the phase never becomes ready."""
    return [value] if isinstance(value, str) else (value or [])


def load_state(state_file, manifest):
    """Load state from disk or initialize from manifest."""
    if Path(state_file).exists():
        with open(state_file) as f:
            state = json.load(f)
        # a state file written before the fix carries the un-normalized shape
        for phase in state.get("phases", []):
            phase["depends_on"] = _normalize_depends_on(phase.get("depends_on"))
        return state
    # Initialize from manifest
    state = {
        "meta": {
            "project": manifest.get("project", "unknown"),
            "started": now(),
            "manifest_path": str(manifest.get("_path", "")),
        },
        "phases": [
            {"name": p.get("name", f"phase_{i}"),
             "depends_on": _normalize_depends_on(p.get("depends_on")),
             "status": "pending"}
            for i, p in enumerate(manifest.get("phases", []))
        ],
        "jobs": [],
    }
    return state


def save_state(state, state_file):
    tmp = state_file + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=2)
    os.rename(tmp, state_file)


def phase_ready(phase_name, state):
    """Check if all depends_on phases are completed."""
    for p in state["phases"]:
        if p["name"] == phase_name:
            if not p["depends_on"]:
                return True
            for dep in p["depends_on"]:
                dep_phase = next((x for x in state["phases"] if x["name"] == dep), None)
                if not dep_phase or dep_phase["status"] != "completed":
                    return False
            return True
    return False


def phase_complete(phase_name, state):
    phase_jobs = [j for j in state["jobs"] if j.get("phase") == phase_name]
    if not phase_jobs:
        return False
    return all(j["status"] in ("completed", "stuck") for j in phase_jobs)


def assign_jobs_to_phases(manifest, state):
    """Ensure state.jobs contains all manifest jobs; idempotent."""
    for phase in manifest.get("phases", []):
        phase_name = phase.get("name")
        for job in phase.get("jobs", []):
            existing = next((j for j in state["jobs"] if j["id"] == job["id"]), None)
            if not existing:
                state["jobs"].append({
                    "id": job["id"],
                    "phase": phase_name,
                    "cmd": job["cmd"],
                    "expected_output": job.get("expected_output"),
                    "status": "pending",
                    "gpu": None,
                    "screen_name": None,
                    "pid": None,
                    "attempts": 0,
                    "started": None,
                    "completed": None,
                    "error": None,
                })


def launch_job(job, gpu, conda_env, cwd, log_dir, conda_hook):
    """Launch job in a detached screen, return (screen_name, pid)."""
    screen_name = f"EQ_{job['id']}"
    if screen_exists(screen_name):
        # Shouldn't happen; clean up
        kill_screen(screen_name)
        time.sleep(2)
    log_file = os.path.join(log_dir, f"{job['id']}.log")
    cmd = job["cmd"]
    # Substitute GPU placeholder if present
    cmd_with_gpu = cmd.replace("${GPU}", str(gpu))
    full = (
        f'cd {shlex.quote(cwd)} && '
        f'{conda_hook} && '
        f'conda activate {conda_env} && '
        f'CUDA_VISIBLE_DEVICES={gpu} {cmd_with_gpu} 2>&1 | tee {shlex.quote(log_file)}'
    )
    screen_cmd = f'screen -dmS {screen_name} bash -c {shlex.quote(full)}'
    run(screen_cmd)
    time.sleep(2)
    # Get pid (find python process for this CUDA_VISIBLE_DEVICES)
    pid_out, _ = run(
        f"ps -ef | grep 'CUDA_VISIBLE_DEVICES={gpu} ' | grep -v grep | "
        f"grep python | awk '{{print $2}}' | head -1")
    pid = pid_out.strip()
    return screen_name, (int(pid) if pid.isdigit() else None)


def job_status_check(job, log_dir, cwd):
    """Return new status for a running job."""
    screen_name = job["screen_name"]
    log_file = os.path.join(log_dir, f"{job['id']}.log")

    # 1. Output exists → completed
    if job.get("expected_output") and output_exists(job["expected_output"], cwd):
        return "completed", None

    # 2. OOM detected → failed_oom
    if detect_oom_in_log(log_file):
        return "failed_oom", "CUDA OOM detected"

    # 3. Screen alive + python alive → still running
    if screen_name and screen_exists(screen_name):
        if job.get("pid"):
            _, rc = run(f"kill -0 {job['pid']} 2>/dev/null")
            if rc == 0:
                return "running", None
            # Python died but the screen lingers → stale; step() kills the screen.
            return "failed_other", "Process exited without expected output (stale screen)"
        else:
            # No pid known; trust screen for now
            return "running", None

    # 4. Screen gone (or never recorded), no output → failed_other
    return "failed_other", "Screen exited without expected output"


def pending_jobs_in_active_phases(state, manifest):
    active_phases = []
    for p
```

### Core Architecture Module: `skills/paper-poster-html/scripts/_posterly/render.py`
```
"""Shared Playwright launch + page-settle helpers.

Used by ``measure``, ``polish``, and ``render_preview``. Centralises:

1. Print-emulated Chromium context at the correct viewport.
2. MathJax detection + bounded typeset wait (so a stuck CDN can't
   hang the script forever).
3. ``document.fonts.ready`` + two RAFs + a fixed settle ms — so
   the layout is locked before any geometry is read.
4. A sanity check that catches the "page has ``$…$`` TeX in body text
   but no rendered ``<mjx-container>``" case — MathJax never ran
   (CDN blocked, script error, …). Measurement / polish must NOT
   silently pass against a raw-TeX layout.

The ``settle_page`` helper returns a :class:`SettleResult` with the raw
status flags. ``measure``/``polish`` treat MathJax issues as hard fails;
``render_preview`` warns and continues (rendering raw-TeX is at least
visible to the user, whereas a silent measure PASS isn't).
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .textutil import ascii_safe


def _eprint(*args: Any, **kw: Any) -> None:
    print(*args, file=sys.stderr, **kw)


@dataclass
class SettleResult:
    mathjax_intended: bool
    """The page intended to load MathJax — either a ``<script src=…mathjax…>``
    tag is present or ``window.MathJax`` config was set. Used to gate the
    ``tex_without_mathjax`` failure: a poster that documents TeX syntax in
    prose without ever loading MathJax is a perfectly valid use case and
    must NOT trip the sanity check."""

    has_mathjax: bool
    """``window.MathJax.startup.promise`` was defined at settle time
    (MathJax actually initialized)."""

    mathjax_status: str
    """One of ``'ok'``, ``'timeout'``, ``'error'``, ``'not-needed'``."""

    mathjax_error: str | None
    """Exception message if ``mathjax_status == 'error'``, else None."""

    tex_without_mathjax: bool
    """Body innerText has TeX delimiters but no ``<mjx-container>`` rendered.
    Only counted as a failure when ``mathjax_intended`` is True (otherwise
    the ``$…$`` is most likely prose, not math)."""


def open_print_emulated_page(p, viewport_px: tuple[int, int]):
    """Launch headless Chromium, open a context+page at the viewport,
    emulate print media. Returns ``(browser, ctx, page)``.

    Print emulation is set BEFORE navigation by the caller (via
    ``page.emulate_media``), so MathJax typesets against ``@media print``
    layout from the start. Without that, the screen-mode ``--u`` value
    leaks in and measurement is unreliable.
    """
    w, h = viewport_px
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": w, "height": h})
    page = ctx.new_page()
    page.emulate_media(media="print")
    page.set_viewport_size({"width": w, "height": h})
    return browser, ctx, page


def settle_page(
    page,
    *,
    mathjax_timeout_ms: int = 15000,
    settle_ms: int = 500,
) -> SettleResult:
    """Wait for MathJax, fonts, two RAFs, and an extra fixed ms.

    Returns a :class:`SettleResult` rather than raising — the caller
    decides whether each flag is a hard fail or a soft warning.
    Idempotent on math-free pages: detection is synchronous and the
    typeset wait is skipped when MathJax wasn't loaded.
    """
    # 1a) Did the page INTEND to load MathJax? A <script src="…mathjax…">
    #     tag OR a window.MathJax config object counts. Used to decide
    #     whether stray `$…$` in body text is "math that failed to render"
    #     (intended) vs "prose that happens to mention TeX" (not intended).
    try:
        mathjax_intended = bool(page.evaluate(
            "() => !!(document.querySelector('script[src*=\"mathjax\" i]') "
            "|| (window.MathJax && Object.keys(window.MathJax).length > 0))"
        ))
    except Exception:
        mathjax_intended = False

    # 1b) Did MathJax actually initialise?
    try:
        has_mj = bool(page.evaluate(
            "() => !!(window.MathJax && window.MathJax.startup "
            "&& window.MathJax.startup.promise)"
        ))
    except Exception:
        has_mj = False

    mj_status = "not-needed"
    mj_error: str | None = None

    # 2) If present, bound the typeset wait with Promise.race so a
    #    stuck MathJax can't hang us.
    if has_mj:
        mj_js = (
            f"() => Promise.race(["
            f"  MathJax.startup.promise"
            f"    .then(() => (MathJax.typesetPromise"
            f"      ? MathJax.typesetPromise() : null))"
            f"    .then(() => 'ok'),"
            f"  new Promise(r => setTimeout("
            f"    () => r('timeout'), {mathjax_timeout_ms}))"
            f"])"
        )
        try:
            mj_status = page.evaluate(mj_js) or "timeout"
        except Exception as e:
            mj_status = "error"
            mj_error = str(e)

    # 3) Fonts (best-effort) + two RAFs + fixed settle ms.
    try:
        page.evaluate(
            "() => document.fonts && document.fonts.ready "
            "? document.fonts.ready : null"
        )
    except Exception:
        pass
    page.evaluate(
        "() => new Promise(r => "
        "requestAnimationFrame(() => requestAnimationFrame(r)))"
    )
    page.wait_for_timeout(settle_ms)

    # 4) Sanity check for the silent-fail case: page has TeX in body
    #    text but no rendered mjx-container. Covers all four delimiter
    #    pairs the templates configure (`$...$`, `$$...$$`, `\(...\)`,
    #    `\[...\]`). No length bound — earlier `{1,1500}` regex limits
    #    were Codex-flagged for letting long raw-TeX paste slip past.
    #    `[^$\n]+` (inline) and `[\s\S]+?` (display, non-greedy) avoid
    #    catastrophic backtracking even on multi-paragraph segments.
    try:
        sanity = page.evaluate(
            "() => {"
            "  const has_mjx = "
            "    document.querySelectorAll('mjx-container').length > 0;"
            "  const txt = document.body && document.body.innerText || '';"
            "  const has_dollar  = /\\$[^$\\n]+\\$/.test(txt);"
            "  const has_ddollar = /\\$\\$[\\s\\S]+?\\$\\$/.test(txt);"
            "  const has_paren   = /\\\\\\([\\s\\S]+?\\\\\\)/.test(txt);"
            "  const has_brack   = /\\\\\\[[\\s\\S]+?\\\\\\]/.test(txt);"
            "  return {has_mjx, has_tex: has_dollar || has_ddollar "
            "                          || has_paren  || has_brack};"
            "}"
        )
        tex_without_mathjax = bool(
            sanity.get("has_tex") and not sanity.get("has_mjx")
        )
    except Exception:
        tex_without_mathjax = False

    return SettleResult(
        mathjax_intended=mathjax_intended,
        has_mathjax=has_mj,
        mathjax_status=mj_status,
        mathjax_error=mj_error,
        tex_without_mathjax=tex_without_mathjax,
    )


def hard_fail_on_settle_problems(
    result: SettleResult,
    *,
    mathjax_timeout_ms: int,
) -> str | None:
    """Return a one-line failure message if ``measure`` / ``polish``
    must hard-fail given a settle result, else None.

    Centralised so the two strict gates agree on what counts as a fail.
    """
    if result.mathjax_status == "error":
        return (
            f"MathJax typeset error: {ascii_safe(result.mathjax_error)}. "
            f"Refusing to measure a broken-script page."
        )
    if result.mathjax_status == "timeout":
        return (
            f"MathJax typeset did not finish within "
            f"{mathjax_timeout_ms} ms. Refusing to measure a "
            f"partially typeset poster."
        )
    # Only fail when MathJax was INTENDED to load (script tag or config
    # present) but didn't render anything. A poster that documents TeX
    # syntax in prose without ever loading MathJax is a valid use case.
    if result.mathjax_intended and result.tex_without_mathjax:
        return (
            "page intended to load MathJax (script/config present) "
            "but no rendered <mjx-container> was found despite TeX "
            "delimiters in body text. MathJax likely failed to load "
            "(CDN block? script error?). Refusing to measure raw-TeX "
            "layout."
        )
    return None

```

### Core Architecture Module: `skills/paper-poster-html/scripts/_posterly/textutil.py`
```
"""Make a string safe to print to a terminal / CI log / pasted issue.

Runtime output is otherwise all-ASCII (rounds 7-9), but USER-derived
fragments -- orphan text, an image src, a MathJax error, raw pdfinfo
output -- can re-inject Unicode that source-level grep can't catch.
Escape it at the output boundary so terminal output never mojibakes.
"""
from __future__ import annotations


def ascii_safe(s: object) -> str:
    r"""Backslash-escape any non-ASCII char.

    ``ascii_safe("1.18-1.30× ↑")`` -> ``"1.18-1.30\\xd7 \\u2191"``.
    """
    return str(s).encode("ascii", "backslashreplace").decode("ascii")

```

### Core Architecture Module: `skills/paper-poster-html/scripts/render_preview.py`
```
#!/usr/bin/env python3
"""render_preview - render a poster HTML to print-ready PDF + thumbnail.

Canvas-agnostic: reads ``@page { size: <W> <H> }`` from the input HTML
or accepts ``--canvas '<W>x<H>in'`` / ``--canvas 'A0 portrait'`` as
override. Print-emulates Chromium so MathJax typesets against the
``@media print`` layout from the start.

This is the SOFT path (vs the HARD ``measure`` gate): a MathJax
typeset timeout or a missing ``<mjx-container>`` warns and continues
— users would rather see raw ``$…$`` on the rendered PDF than a
silent abort.

Outputs:
    <stem>_preview.pdf   exact-size PDF
    <stem>_preview.png   scaled thumbnail (default 0.35×)
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Make `_posterly` importable when run directly.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

from _posterly import canvas as _canvas  # noqa: E402
from _posterly import render as _render  # noqa: E402
from _posterly.textutil import ascii_safe  # noqa: E402


def _eprint(*args: object, **kw: object) -> None:
    print(*args, file=sys.stderr, **kw)  # type: ignore[arg-type]


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description=(__doc__ or "").splitlines()[0]
    )
    p.add_argument("html", help="poster HTML file")
    p.add_argument(
        "--pdf", default=None,
        help="output PDF path (default: <stem>_preview.pdf)",
    )
    p.add_argument(
        "--png", default=None,
        help="output PNG thumbnail path (default: <stem>_preview.png)",
    )
    p.add_argument(
        "--thumb-scale", type=float, default=0.35,
        help="thumbnail scale factor (default 0.35)",
    )
    p.add_argument(
        "--mathjax-timeout-ms", type=int, default=15000,
        help="timeout for MathJax typesetting (default 15000); "
             "render is the SOFT path; timeout warns, not fails",
    )
    p.add_argument(
        "--canvas", type=_canvas.parse_canvas_arg, default=None,
        help="override canvas (e.g. '60x36in' / 'A0 portrait'); "
             "by default we parse @page from the HTML",
    )
    return p


def main() -> int:
    args = build_parser().parse_args()

    html_path = Path(args.html).resolve()
    if not html_path.exists():
        _eprint(f"ERROR: HTML not found: {ascii_safe(html_path)}")
        return 2

    pdf_path = (
        Path(args.pdf) if args.pdf
        else html_path.with_name(html_path.stem + "_preview.pdf")
    )
    png_path = (
        Path(args.png) if args.png
        else html_path.with_name(html_path.stem + "_preview.png")
    )

    resolved = _canvas.resolve_canvas(
        html_path, args.canvas, label="[render_preview]"
    )
    if resolved is None:
        _eprint(
            "ERROR: could not find `@page { size: <W> <H> }` in HTML. "
            "Add an @page rule (units: in/mm/cm/pt) or pass "
            "`--canvas <W>x<H>in` / `--canvas 'A0 portrait'`. "
            "Refusing to silently fall back."
        )
        return 2
    canvas, viewport = resolved
    w_in, h_in = canvas

    try:
        from playwright.sync_api import sync_playwright
        from playwright.sync_api import TimeoutError as PWTimeoutError
    except ImportError:
        _eprint("ERROR: playwright not installed. Run:")
        _eprint("  python -m pip install playwright")
        _eprint("  python -m playwright install chromium")
        return 2

    with sync_playwright() as p_:
        browser, _ctx, page = _render.open_print_emulated_page(
            p_, viewport
        )
        # Soft path: a hung CDN (blocked MathJax fetch, unreachable
        # web font) must not hard-crash render. Playwright's default
        # `page.goto` waits for `load` (all subresources), which can
        # block ~30s on a single blocked CDN. settle_page below has
        # its own bounded waits; let it surface MathJax issues as
        # warnings, not tracebacks.
        try:
            page.goto(html_path.as_uri(), timeout=args.mathjax_timeout_ms)
        except PWTimeoutError:
            _eprint(
                f"[render_preview] WARN: page.goto did not reach `load` "
                f"within {args.mathjax_timeout_ms} ms; continuing with "
                f"whatever has loaded (a CDN or external resource is "
                f"likely blocked)."
            )
        try:
            page.wait_for_load_state(
                "networkidle", timeout=args.mathjax_timeout_ms,
            )
        except PWTimeoutError:
            _eprint(
                f"[render_preview] WARN: network never went idle within "
                f"{args.mathjax_timeout_ms} ms; continuing with whatever "
                f"loaded (likely a slow/blocked external resource)."
            )

        settle = _render.settle_page(
            page,
            mathjax_timeout_ms=args.mathjax_timeout_ms,
            settle_ms=1500,
        )
        # Render is soft path: warn but continue, even on MathJax
        # problems — the user can SEE raw $...$ on the resulting PDF.
        if settle.mathjax_status == "timeout":
            _eprint(
                f"[render_preview] WARN: MathJax typeset timed out "
                f"after {args.mathjax_timeout_ms} ms."
            )
        elif settle.mathjax_status == "error":
            _eprint(
                f"[render_preview] WARN: MathJax error: "
                f"{ascii_safe(settle.mathjax_error)}"
            )
        if settle.mathjax_intended and settle.tex_without_mathjax:
            _eprint(
                "[render_preview] WARN: page intended to load MathJax "
                "but no <mjx-container> rendered -- MathJax may have "
                "failed to load. PDF will show raw $...$ text."
            )

        # ---- PDF: exact poster size, print-emulated ----
        page.pdf(
            path=str(pdf_path),
            width=f"{w_in}in",
            height=f"{h_in}in",
            print_background=True,
            margin={"top": "0", "bottom": "0",
                    "left": "0", "right": "0"},
        )

        # ---- PNG: scaled thumbnail of `.poster` (or document body) ----
        s = args.thumb_scale
        page.evaluate(
            f"""() => {{
                const el = document.querySelector(
                       '[data-measure-role="poster"]')
                       || document.querySelector('.poster')
                       || document.body;
                el.style.transformOrigin = 'top left';
                el.style.transform = 'scale({s})';
                document.body.style.width  =
                    (el.offsetWidth  * {s}) + 'px';
                document.body.style.height =
                    (el.offsetHeight * {s}) + 'px';
                document.body.style.overflow = 'hidden';
                document.body.style.margin = '0';
            }}"""
        )
        thumb_w = int(round(w_in * 96 * s))
        thumb_h = int(round(h_in * 96 * s))
        page.set_viewport_size(
            {"width": thumb_w, "height": thumb_h}
        )
        page.screenshot(
            path=str(png_path),
            full_page=False,
            clip={"x": 0, "y": 0,
                  "width": thumb_w, "height": thumb_h},
        )

        browser.close()

    print(
        f"[render_preview] PDF -> {ascii_safe(pdf_path)}  "
        f"({pdf_path.stat().st_size / 1024:.1f} KB)"
    )
    print(
        f"[render_preview] PNG -> {ascii_safe(png_path)}  "
        f"({png_path.stat().st_size / 1024:.1f} KB)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `skills/render-html/scripts/render_html.py`
```
#!/usr/bin/env python3
"""render_html.py — convert ARIS Markdown / JSON artifacts to single-file HTML.

Pure-stdlib Python. No external pip deps.

Usage:
    render_html.py <input.md> [--template academic|dashboard]
                              [--out <output.html>]
                              [--title "..."] [--subtitle "..."]
                              [--eyebrow "..."]
                              [--state <state.json>]
                              [--json <sidecar.json>]
                              [--offline]
                              [--no-toc]

See skills/render-html/SKILL.md for the full contract.

Design invariants (see codex review consultation in commit message):
  - Markdown / JSON is canonical source, HTML is generated view.
  - HTML embeds source path + SHA256 + generated timestamp (drift detection).
  - Single-file output. MathJax + highlight.js loaded from CDN unless --offline.
  - Pure stdlib: re, html, hashlib, json, datetime, pathlib, argparse, sys.
  - Conservative Markdown subset matching what ARIS artifacts actually emit.
"""
from __future__ import annotations

import argparse
import hashlib
import html as html_lib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

# ---------------------------------------------------------------------------
# Inline parsing
# ---------------------------------------------------------------------------

# Placeholders used to protect inline content during multi-pass rewriting.
# Two non-printable PUA chars + index to avoid collisions with real content.
_PH_OPEN = ""
_PH_CLOSE = ""


def _ph(idx: int) -> str:
    return f"{_PH_OPEN}{idx}{_PH_CLOSE}"


_RE_CODE_INLINE = re.compile(r"`([^`\n]+)`")
_RE_MATH_DISPLAY = re.compile(r"\$\$([^\n][\s\S]*?)\$\$")
_RE_MATH_INLINE = re.compile(r"(?<!\\)\$([^\$\n]+?)\$")
_RE_IMG = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)")
_RE_LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)")
_RE_BOLD = re.compile(r"\*\*([^\*\n]+)\*\*")
_RE_ITALIC = re.compile(r"(?<!\*)\*([^\*\n]+)\*(?!\*)")
_RE_ITALIC_UNDERSCORE = re.compile(r"(?<!\w)_([^_\n]+)_(?!\w)")
_RE_STRIKE = re.compile(r"~~([^~\n]+)~~")
# Wikilink paper reference: [[key]] or [[key|display]]. Backslash-escaped form
# `\[[...]]` is left alone so authors can opt out.
_RE_PAPER_REF = re.compile(
    r"(?<!\\)\[\[([A-Za-z0-9][A-Za-z0-9_.:-]*)(?:\|([^\]\n]+))?\]\]"
)

# Inline HTML tags that should pass through inline (commonly used in ARIS docs).
_INLINE_HTML_TAGS = ("br", "img", "a", "span", "sub", "sup", "code", "kbd", "b", "i", "u", "strong", "em")

# URL schemes considered safe for href/src. javascript:, data:, vbscript: blocked.
_SAFE_URL_SCHEMES = ("http:", "https:", "mailto:", "ftp:", "tel:", "#", "/", "./", "../")


def _safe_url(url: str) -> str:
    """Return url if scheme is safe, else '#'. Defensive against javascript: links."""
    s = url.strip().lower()
    # Relative paths and fragments are fine
    if s.startswith(("#", "/", "./", "../")) or s == "":
        return url
    if s.startswith(_SAFE_URL_SCHEMES):
        return url
    # Bare path like "foo/bar.md" or "page.html" — no scheme prefix, safe.
    if ":" not in s.split("/", 1)[0]:
        return url
    # Block javascript:, data:, vbscript:, file:, etc.
    return "#blocked-unsafe-url"


# Tags stripped wholesale from HTML passthrough (block and inline).
# Even if the workflow LLM hallucinates these, they never reach output.
_RE_STRIP_TAG = re.compile(
    r"<\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)\b[^>]*>.*?</\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)
_RE_STRIP_TAG_SELF = re.compile(
    r"<\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)\b[^>]*/?\s*>",
    re.IGNORECASE,
)
# Event-handler attributes like onclick=, onload=, etc. — strip these.
_RE_STRIP_EVENT_ATTR = re.compile(
    r"\s+on[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)",
    re.IGNORECASE,
)
# javascript:/vbscript:/data: in href/src — replace with #blocked.
_RE_STRIP_DANGEROUS_URL_ATTR = re.compile(
    r"""(\b(?:href|src|action|formaction|poster)\s*=\s*["']?)\s*(?:javascript|vbscript|data)\s*:""",
    re.IGNORECASE,
)


def sanitize_html(s: str) -> str:
    """Strip dangerous tags / event handlers / javascript: URLs from raw HTML.

    Applied to: (a) inline-HTML spans we pass through, (b) block-HTML
    passthrough content. Markdown text content is HTML-escaped separately
    and never reaches this function. ARIS workflow artifacts should not
    contain these tags; this is defense-in-depth in case an LLM hallucinates
    one.
    """
    s = _RE_STRIP_TAG.sub("", s)
    s = _RE_STRIP_TAG_SELF.sub("", s)
    s = _RE_STRIP_EVENT_ATTR.sub("", s)
    s = _RE_STRIP_DANGEROUS_URL_ATTR.sub(r"\1#blocked-unsafe-url:", s)
    return s


def render_inline(text: str) -> str:
    """Convert Markdown inline syntax to HTML. Escape everything else.

    Order matters:
      1. Stash inline code, math (display+inline), and raw HTML tag-shaped
         spans into placeholders (so we don't expand markdown inside them).
      2. HTML-escape the remaining text.
      3. Apply images, links, bold, italic, strike.
      4. Restore placeholders.
    """
    stash: list[str] = []

    def store(replacement: str) -> str:
        idx = len(stash)
        stash.append(replacement)
        return _ph(idx)

    # 1a. Inline code -- escape inner content fully.
    def _code_sub(m: re.Match[str]) -> str:
        return store(f"<code>{html_lib.escape(m.group(1))}</code>")

    text = _RE_CODE_INLINE.sub(_code_sub, text)

    # HTML-escape <, >, & inside math bodies: a bare "<t" (e.g. y_{<t}) is
    # otherwise parsed as an HTML start tag and eats the rest of the formula
    # before MathJax runs. MathJax v3 reads the decoded DOM text, so the escape
    # is transparent to the TeX it sees (and & for cases/align stays intact).
    # 1b. Display math (passthrough; MathJax will render).
    def _md_sub(m: re.Match[str]) -> str:
        body = html_lib.escape(m.group(1), quote=False)
        return store(f"$${body}$$")

    text = _RE_MATH_DISPLAY.sub(_md_sub, text)

    # 1c. Inline math (passthrough).
    def _mi_sub(m: re.Match[str]) -> str:
        body = html_lib.escape(m.group(1), quote=False)
        return store(f"${body}$")

    text = _RE_MATH_INLINE.sub(_mi_sub, text)

    # 1d. Wikilink paper refs [[key]] or [[key|display]] — stash as a clickable
    # span with data-ref="key". The template JS wires up the popover from
    # window.PAPER_REGISTRY (sidecar JSON loaded via --papers). Default display
    # is the key uppercased; explicit display via |label form.
    def _ref_sub(m: re.Match[str]) -> str:
        key = m.group(1)
        display = m.group(2) if m.group(2) is not None else key.upper()
        return store(
            f'<span data-ref="{html_lib.escape(key, quote=True)}">{html_lib.escape(display)}</span>'
        )

    text = _RE_PAPER_REF.sub(_ref_sub, text)

    # 1e. Inline HTML spans (very limited allowlist + sanitize before stash).
    _re_tag = re.compile(
        r"<(/?)(" + "|".join(_INLINE_HTML_TAGS) + r")(\s[^<>]*)?>",
        re.IGNORECASE,
    )

    def _tag_sub(m: re.Match[str]) -> str:
        return store(sanitize_html(m.group(0)))

    text = _re_tag.sub(_tag_sub, text)

    # 2. HTML-escape remainder.
    text = html_lib.escape(text, quote=False)

    # 3. Apply markdown emphasis & links.
    def _img_sub(m: re.Match[str]) -> str:
        alt = html_lib.escape(m.group(1), quote=True)
        src = html_lib.escape(_safe_url(m.group(2)), quote=True)
        title = m.group(3)
        title_attr = f' title="{html_lib.escape(title, quote=True)}"' if title else ""
        return f'<img src="{src}" alt="{alt}"{title_attr} />'

    text = _RE_IMG.sub(_img_sub, text)

    def _link_sub(m: re.Match[str]) -> str:
        label = m.group(1)  # inner label can still contain code placeholders; ok.
        href = html_lib.escape(_safe_url(m.group(2)), quote=True)
        title = m.group(3)
        title_attr = f' title="{html_lib.escape(title, quote=True)}"' if title else ""
        return f'<a href="{href}"{title_attr}>{label}</a>'

    text = _RE_LINK.sub(_link_sub, text)
    text = _RE_BOLD.sub(r"<strong>\1</strong>", text)
    text = _RE_ITALIC.sub(r"<em>\1</em>", text)
    text = _RE_ITALIC_UNDERSCORE.sub(r"<em>\1</em>", text)
    text = _RE_STRIKE.sub(r"<del>\1</del>", text)

    # 4. Restore placeholders.
    def _restore(m: re.Match[str]) -> str:
        idx = int(m.group(1))
        return stash[idx]

    text = re.sub(rf"{_PH_OPEN}(\d+){_PH_CLOSE}", _restore, text)
    return text


# ---------------------------------------------------------------------------
# Block parsing
# ---------------------------------------------------------------------------

_RE_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
_RE_HR = re.compile(r"^\s*(?:-{3,}|\*{3,}|_{3,})\s*$")
_RE_CODE_FENCE = re.compile(
    r"^```\s*(?:(?P<lang>[A-Za-z0-9_+.#-]+)\s*)?(?:\{(?P<flags>[^}\n]+)\}\s*)?$"
)
_RE_TABLE_DIVIDER = re.compile(r"^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$")
_RE_ORDERED = re.compile(r"^(\s*)(\d+)[.)]\s+(.*)$")
_RE_UNORDERED = re.compile(r"^(\s*)[-*+]\s+(.*)$")
_RE_BLOCKQUOTE = re.compile(r"^>\s?(.*)$")
_RE_HTML_BLOCK_OPEN = re.compile(
    r"^\s*<(details|div|figure|table|p|ul|ol|nav|section|aside|header|footer|main|article|blockquote)(\s|>|/>)",
    re.IGNORECASE,
)

_CALLOUT_PREFIX_MAP = [
    # (regex on first content, css class, default title)
    (re.compile(r"^[⚠️⚠]️?\s*"), "callout-warn", "Warning"),
    (re.compile(r"^💡\s*"), "callout-info", "Tip"),
    (re.compile(r"^✅\s*"), "callout-good", "OK"),
    (re.compile(r"^✓\s*"), "callout-good", "OK"),
    (re.compile(r"^❌\s*"), "callout-bad", "Blocked"),
    (re.compile(r"^🔒\s*"), "callout-good", "Guarantee"),
    (re.compile(r"^📝\s*"), "callout-info", "Note"),
    (re.compile(r"^�
```

### Core Architecture Module: `skills/skills-codex/render-html/scripts/render_html.py`
```
#!/usr/bin/env python3
"""render_html.py — convert ARIS Markdown / JSON artifacts to single-file HTML.

Pure-stdlib Python. No external pip deps.

Usage:
    render_html.py <input.md> [--template academic|dashboard]
                              [--out <output.html>]
                              [--title "..."] [--subtitle "..."]
                              [--eyebrow "..."]
                              [--state <state.json>]
                              [--json <sidecar.json>]
                              [--offline]
                              [--no-toc]

See skills/render-html/SKILL.md for the full contract.

Design invariants (see codex review consultation in commit message):
  - Markdown / JSON is canonical source, HTML is generated view.
  - HTML embeds source path + SHA256 + generated timestamp (drift detection).
  - Single-file output. MathJax + highlight.js loaded from CDN unless --offline.
  - Pure stdlib: re, html, hashlib, json, datetime, pathlib, argparse, sys.
  - Conservative Markdown subset matching what ARIS artifacts actually emit.
"""
from __future__ import annotations

import argparse
import hashlib
import html as html_lib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

# ---------------------------------------------------------------------------
# Inline parsing
# ---------------------------------------------------------------------------

# Placeholders used to protect inline content during multi-pass rewriting.
# Two non-printable PUA chars + index to avoid collisions with real content.
_PH_OPEN = ""
_PH_CLOSE = ""


def _ph(idx: int) -> str:
    return f"{_PH_OPEN}{idx}{_PH_CLOSE}"


_RE_CODE_INLINE = re.compile(r"`([^`\n]+)`")
_RE_MATH_DISPLAY = re.compile(r"\$\$([^\n][\s\S]*?)\$\$")
_RE_MATH_INLINE = re.compile(r"(?<!\\)\$([^\$\n]+?)\$")
_RE_IMG = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)")
_RE_LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)")
_RE_BOLD = re.compile(r"\*\*([^\*\n]+)\*\*")
_RE_ITALIC = re.compile(r"(?<!\*)\*([^\*\n]+)\*(?!\*)")
_RE_ITALIC_UNDERSCORE = re.compile(r"(?<!\w)_([^_\n]+)_(?!\w)")
_RE_STRIKE = re.compile(r"~~([^~\n]+)~~")

# Inline HTML tags that should pass through inline (commonly used in ARIS docs).
_INLINE_HTML_TAGS = ("br", "img", "a", "span", "sub", "sup", "code", "kbd", "b", "i", "u", "strong", "em")

# URL schemes considered safe for href/src. javascript:, data:, vbscript: blocked.
_SAFE_URL_SCHEMES = ("http:", "https:", "mailto:", "ftp:", "tel:", "#", "/", "./", "../")


def _safe_url(url: str) -> str:
    """Return url if scheme is safe, else '#'. Defensive against javascript: links."""
    s = url.strip().lower()
    # Relative paths and fragments are fine
    if s.startswith(("#", "/", "./", "../")) or s == "":
        return url
    if s.startswith(_SAFE_URL_SCHEMES):
        return url
    # Bare path like "foo/bar.md" or "page.html" — no scheme prefix, safe.
    if ":" not in s.split("/", 1)[0]:
        return url
    # Block javascript:, data:, vbscript:, file:, etc.
    return "#blocked-unsafe-url"


# Tags stripped wholesale from HTML passthrough (block and inline).
# Even if the workflow LLM hallucinates these, they never reach output.
_RE_STRIP_TAG = re.compile(
    r"<\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)\b[^>]*>.*?</\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)
_RE_STRIP_TAG_SELF = re.compile(
    r"<\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)\b[^>]*/?\s*>",
    re.IGNORECASE,
)
# Event-handler attributes like onclick=, onload=, etc. — strip these.
_RE_STRIP_EVENT_ATTR = re.compile(
    r"\s+on[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)",
    re.IGNORECASE,
)
# javascript:/vbscript:/data: in href/src — replace with #blocked.
_RE_STRIP_DANGEROUS_URL_ATTR = re.compile(
    r"""(\b(?:href|src|action|formaction|poster)\s*=\s*["']?)\s*(?:javascript|vbscript|data)\s*:""",
    re.IGNORECASE,
)


def sanitize_html(s: str) -> str:
    """Strip dangerous tags / event handlers / javascript: URLs from raw HTML.

    Applied to: (a) inline-HTML spans we pass through, (b) block-HTML
    passthrough content. Markdown text content is HTML-escaped separately
    and never reaches this function. ARIS workflow artifacts should not
    contain these tags; this is defense-in-depth in case an LLM hallucinates
    one.
    """
    s = _RE_STRIP_TAG.sub("", s)
    s = _RE_STRIP_TAG_SELF.sub("", s)
    s = _RE_STRIP_EVENT_ATTR.sub("", s)
    s = _RE_STRIP_DANGEROUS_URL_ATTR.sub(r"\1#blocked-unsafe-url:", s)
    return s


def render_inline(text: str) -> str:
    """Convert Markdown inline syntax to HTML. Escape everything else.

    Order matters:
      1. Stash inline code, math (display+inline), and raw HTML tag-shaped
         spans into placeholders (so we don't expand markdown inside them).
      2. HTML-escape the remaining text.
      3. Apply images, links, bold, italic, strike.
      4. Restore placeholders.
    """
    stash: list[str] = []

    def store(replacement: str) -> str:
        idx = len(stash)
        stash.append(replacement)
        return _ph(idx)

    # 1a. Inline code -- escape inner content fully.
    def _code_sub(m: re.Match[str]) -> str:
        return store(f"<code>{html_lib.escape(m.group(1))}</code>")

    text = _RE_CODE_INLINE.sub(_code_sub, text)

    # HTML-escape <, >, & inside math bodies: a bare "<t" (e.g. y_{<t}) is
    # otherwise parsed as an HTML start tag and eats the rest of the formula
    # before MathJax runs. MathJax v3 reads the decoded DOM text, so the escape
    # is transparent to the TeX it sees (and & for cases/align stays intact).
    # 1b. Display math (passthrough; MathJax will render).
    def _md_sub(m: re.Match[str]) -> str:
        body = html_lib.escape(m.group(1), quote=False)
        return store(f"$${body}$$")

    text = _RE_MATH_DISPLAY.sub(_md_sub, text)

    # 1c. Inline math (passthrough).
    def _mi_sub(m: re.Match[str]) -> str:
        body = html_lib.escape(m.group(1), quote=False)
        return store(f"${body}$")

    text = _RE_MATH_INLINE.sub(_mi_sub, text)

    # 1d. Inline HTML spans (very limited allowlist + sanitize before stash).
    _re_tag = re.compile(
        r"<(/?)(" + "|".join(_INLINE_HTML_TAGS) + r")(\s[^<>]*)?>",
        re.IGNORECASE,
    )

    def _tag_sub(m: re.Match[str]) -> str:
        return store(sanitize_html(m.group(0)))

    text = _re_tag.sub(_tag_sub, text)

    # 2. HTML-escape remainder.
    text = html_lib.escape(text, quote=False)

    # 3. Apply markdown emphasis & links.
    def _img_sub(m: re.Match[str]) -> str:
        alt = html_lib.escape(m.group(1), quote=True)
        src = html_lib.escape(_safe_url(m.group(2)), quote=True)
        title = m.group(3)
        title_attr = f' title="{html_lib.escape(title, quote=True)}"' if title else ""
        return f'<img src="{src}" alt="{alt}"{title_attr} />'

    text = _RE_IMG.sub(_img_sub, text)

    def _link_sub(m: re.Match[str]) -> str:
        label = m.group(1)  # inner label can still contain code placeholders; ok.
        href = html_lib.escape(_safe_url(m.group(2)), quote=True)
        title = m.group(3)
        title_attr = f' title="{html_lib.escape(title, quote=True)}"' if title else ""
        return f'<a href="{href}"{title_attr}>{label}</a>'

    text = _RE_LINK.sub(_link_sub, text)
    text = _RE_BOLD.sub(r"<strong>\1</strong>", text)
    text = _RE_ITALIC.sub(r"<em>\1</em>", text)
    text = _RE_ITALIC_UNDERSCORE.sub(r"<em>\1</em>", text)
    text = _RE_STRIKE.sub(r"<del>\1</del>", text)

    # 4. Restore placeholders.
    def _restore(m: re.Match[str]) -> str:
        idx = int(m.group(1))
        return stash[idx]

    text = re.sub(rf"{_PH_OPEN}(\d+){_PH_CLOSE}", _restore, text)
    return text


# ---------------------------------------------------------------------------
# Block parsing
# ---------------------------------------------------------------------------

_RE_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
_RE_HR = re.compile(r"^\s*(?:-{3,}|\*{3,}|_{3,})\s*$")
_RE_CODE_FENCE = re.compile(r"^```(\w+)?\s*$")
_RE_TABLE_DIVIDER = re.compile(r"^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$")
_RE_ORDERED = re.compile(r"^(\s*)(\d+)[.)]\s+(.*)$")
_RE_UNORDERED = re.compile(r"^(\s*)[-*+]\s+(.*)$")
_RE_BLOCKQUOTE = re.compile(r"^>\s?(.*)$")
_RE_HTML_BLOCK_OPEN = re.compile(
    r"^\s*<(details|div|figure|table|p|ul|ol|nav|section|aside|header|footer|main|article|blockquote)(\s|>|/>)",
    re.IGNORECASE,
)

_CALLOUT_PREFIX_MAP = [
    # (regex on first content, css class, default title)
    (re.compile(r"^[⚠️⚠]️?\s*"), "callout-warn", "Warning"),
    (re.compile(r"^💡\s*"), "callout-info", "Tip"),
    (re.compile(r"^✅\s*"), "callout-good", "OK"),
    (re.compile(r"^✓\s*"), "callout-good", "OK"),
    (re.compile(r"^❌\s*"), "callout-bad", "Blocked"),
    (re.compile(r"^🔒\s*"), "callout-good", "Guarantee"),
    (re.compile(r"^📝\s*"), "callout-info", "Note"),
    (re.compile(r"^🚨\s*"), "callout-bad", "Critical"),
    (re.compile(r"^🛠\s*"), "callout-info", "Note"),
    (re.compile(r"^🆕\s*"), "callout-info", "New"),
    (re.compile(r"^⚙️⚡?\s*"), "callout-info", "Config"),
    (re.compile(r"^🔁\s*"), "callout-info", "Loop"),
    (re.compile(r"^🌱\s*"), "callout-info", "Note"),
    (re.compile(r"^📚\s*"), "callout-info", "Reference"),
    (re.compile(r"^🧬\s*"), "callout-info", "Meta"),
]


def _slugify(text: str) -> str:
    text = re.sub(r"[`*_~$]", "", text)
    text = re.sub(r"\s+", "-", text.strip().lower())
    text = re.sub(r"[^a-z0-9一-鿿\-]", "", text)
    return text.strip("-") or "section"


def parse_blocks(lines: list[str]) -> list[dict]:
    blocks: list[dict] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.rstrip()

        # Blank line — skip.
        if not stripped.strip():
            i += 1
            con
```

### Core Architecture Module: `templates/claude-hooks/corpus_write_guard.py`
```
#!/usr/bin/env python3
"""PreToolUse guard: deny Bash writes to the ARIS skill corpus.

Why: a read-only PRODUCER skill (meta-optimize, corpus-audit) is given no `Write`/
`Edit` tool so it cannot mutate the corpus with the frictionless mutators. But a skill
that retains *any* `Bash` access can still write a corpus file via shell redirection
(`cat > skills/x`, `sed -i ... skills/x`, `tee skills/x`, `cp/mv ... skills/x`) — which
no `allowed-tools` allowlist can block, because redirection is appended after the matched
command prefix. The only place to enforce "Bash may not write the corpus" is the harness:
this PreToolUse hook inspects the actual command and DENIES corpus-write shell ops.

Invariant this establishes (with the producer holding Bash-but-no-Write/Edit):
    corpus mutation MUST go through the Write/Edit tools (reviewable, attributable) —
    never an opaque Bash redirection. So a producer with no Write/Edit + this hook
    active is STRUCTURALLY unable to mutate the corpus by any path.

Scope: this guard is GLOBAL (not skill-scoped — hooks have no reliable skill context).
It blocks Bash *corpus writes* for every skill; legitimate corpus edits (yours, and
/meta-apply's landing) use the Write/Edit tools and are unaffected. Blocking opaque
shell writes to the corpus is good hygiene regardless of who runs.

Threat model: closes the ACCIDENTAL/casual self-acquittal path (an honest producer
slipping into `cat > skills/...`). A determined adversary can still obfuscate a write
(`p=skills/x; printf ... >"$p"`); defense-in-depth against that is the provenance
integrity check (an un-stamped / stale-hash corpus change is detectable before push),
not this regex. This hook is the cheap, harness-level prevention layer, not a sandbox.

Install: add to .claude/settings.json hooks.PreToolUse (matcher "Bash"); see
templates/claude-hooks/corpus_write_guard.json. Exit 2 = block + reason to the model.
"""

from __future__ import annotations

import json
import re
import sys

# Corpus = the parts of the repo a self-modification producer must never write via Bash.
_CORPUS = r"(?:\./)?(?:skills|shared-references|tools|templates|plugins)/"

# Shell ops that WRITE a path. Each pattern is "write-operator ... targeting a corpus path".
_WRITE_OPS = [
    re.compile(r">>?\s*\"?'?" + _CORPUS),                      # > corpus / >> corpus
    re.compile(r"\btee\s+(?:-a\s+)?\"?'?" + _CORPUS),           # tee [-a] corpus
    re.compile(r"\bsed\s+(?:-[a-zA-Z]*\s+)*-i\b[^|;&]*" + _CORPUS),  # sed -i ... corpus
    re.compile(r"\bdd\b[^|;&]*\bof=\"?'?" + _CORPUS),           # dd of=corpus
    re.compile(r"\b(?:cp|mv|install|rsync|ln)\b[^|;&]*\s\"?'?" + _CORPUS),  # cp/mv/... corpus (as dest)
    re.compile(r"\btruncate\b[^|;&]*" + _CORPUS),
    re.compile(r"\btouch\s+[^|;&]*" + _CORPUS),                  # touch corpus (create)
    re.compile(r"\.write_(?:text|bytes)\b[^|;&]*" + _CORPUS),    # Path(...).write_text into corpus
    re.compile(_CORPUS + r"[^'\"]*['\"]\s*\)\s*\.write_(?:text|bytes)"),  # Path('corpus..').write_text
    re.compile(r"\b(?:python3?|perl|ruby|node)\b[^|;&]*open\([^)]*" + _CORPUS),  # open('skills/..','w')
]


def violates(command: str) -> str | None:
    for rx in _WRITE_OPS:
        m = rx.search(command)
        if m:
            return command[m.start():m.start() + 80]
    return None


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0  # malformed input → don't block (fail open on parse, not on match)
    if data.get("tool_name") != "Bash":
        return 0
    command = (data.get("tool_input") or {}).get("command", "") or ""
    hit = violates(command)
    if hit:
        sys.stderr.write(
            "BLOCKED by corpus_write_guard: Bash may not WRITE the skill corpus "
            f"(matched: {hit!r}). Corpus mutation must go through the Write/Edit tools "
            "(reviewable, attributable). A read-only producer (meta-optimize / corpus-"
            "audit) stages patches to .aris/meta/ and hands off to /meta-apply, which "
            "lands them with the Write/Edit tools after the cross-model jury + human gate.\n")
        return 2  # PreToolUse: block the call, show stderr to the model
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `tools/experiment_queue/queue_manager.py`
```
#!/usr/bin/env python3
"""Legacy entry point — forwards to canonical queue_manager.

Phase 3.3 (Arch C) moved the implementation to
    skills/experiment-queue/scripts/queue_manager.py

This shim keeps the directory-level resolver chain working
(.aris/tools/experiment_queue/ → tools/experiment_queue/ →
$ARIS_REPO/tools/experiment_queue/ → same, via the global pointer
file ~/.aris/repo, #366). Once a SKILL has resolved
the directory, it runs `python3 $QUEUE_TOOLS/queue_manager.py`,
which lands here, which os.execv's into the canonical script.

See `skills/experiment-queue/SKILL.md` for the resolver block.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
REAL = REPO_ROOT / "skills" / "experiment-queue" / "scripts" / "queue_manager.py"


def main() -> int:
    if not REAL.is_file():
        sys.stderr.write(
            f"ERROR: canonical queue_manager.py not found at {REAL}.\n"
            "       Phase 3.3 moved this helper into the\n"
            "       /experiment-queue SKILL ('skills/experiment-queue/scripts/').\n"
            "       Your local checkout may be incomplete — try `git pull`\n"
            "       or rerun `bash tools/install_aris.sh` to refresh the\n"
            "       project-local symlink chain.\n"
        )
        return 1
    os.execv(sys.executable, [sys.executable, str(REAL), *sys.argv[1:]])
    return 0  # unreachable; os.execv does not return on success


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `tools/figure_renderer.py`
```
#!/usr/bin/env python3
"""Legacy entry point — forwards to the canonical figure_renderer.

The canonical implementation now lives at
    skills/figure-spec/scripts/figure_renderer.py
(Phase 3.1 — Arch C — self-contained single-owner helper).

This shim exists so existing users keep working without re-running
install_aris.sh. The four legacy resolver layers all still hit a
valid Python module:

  layer 1  <project>/.aris/tools/figure_renderer.py
           → symlink to $ARIS_REPO/tools/figure_renderer.py
           → this file (shim)
           → $ARIS_REPO/skills/figure-spec/scripts/figure_renderer.py

  layer 2  <project>/tools/figure_renderer.py
           → this file (when running from inside the ARIS repo)

  layer 3  $ARIS_REPO/tools/figure_renderer.py
           → this file (when ARIS_REPO env var or manifest sets it)

  layer 4  $ARIS_REPO/tools/figure_renderer.py
           → this file (when ARIS_REPO is resolved from the global
             pointer file ~/.aris/repo, #366 — no project manifest needed)

Shim semantics: `os.execv` replaces the current Python process with
the real helper, so the helper sees its own `__file__`, `sys.path[0]`,
and argv exactly as if it had been invoked directly. No extra
process layer, no environment pollution.

The shim itself is kept minimal so a Python 3.6+ interpreter on any
platform (including older macOS system python) can run it.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
REAL = REPO_ROOT / "skills" / "figure-spec" / "scripts" / "figure_renderer.py"


def _fail(msg: str) -> int:
    sys.stderr.write(msg + "\n")
    return 1


def main() -> int:
    if not REAL.is_file():
        return _fail(
            f"ERROR: canonical figure_renderer.py not found at {REAL}.\n"
            "       The Phase 3.1 migration moved this helper into the\n"
            "       /figure-spec SKILL ('skills/figure-spec/scripts/'). Your\n"
            "       local checkout may be incomplete — try `git pull` from the\n"
            "       ARIS repo, or rerun `bash tools/install_aris.sh` to refresh\n"
            "       the project-local symlink chain."
        )
    # os.execv replaces this Python process; argv[0] is the real path so
    # the helper sees its own __file__ and computes paths correctly.
    os.execv(sys.executable, [sys.executable, str(REAL), *sys.argv[1:]])
    return 0  # unreachable; os.execv does not return on success


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `tools/run_state.py`
```
#!/usr/bin/env python3
"""Resumable run-state for ARIS multi-phase workflows.

A long ARIS workflow (research-pipeline, paper-writing, idea-discovery) can fail
mid-run, and today there is no record of *which phase* already finished — a
resume restarts from scratch. This helper models a run as an ordered list of
phases with status, so resume can pick up where it left off.

The ARIS increment over a naive "resume = reopen" (which is all Hermes does):
the phase status enum SPLITS execution from acceptance —

    done      executor (Claude) finished writing the artifact.
              EXECUTION-COMPLETENESS — a safe SAME-MODEL self-report.
    accepted  a CROSS-MODEL reviewer (codex/gemini) OR a deterministic verifier
              returned a positive verdict, recorded with a verdict id + reviewer.
    provisional a fresh SAME-FAMILY reviewer returned a positive verdict. This
              is terminal for resume so a Codex-only workflow can advance, but
              remains explicitly distinct from accepted.
    skipped   the phase does not apply to this run (e.g. paper-writing when
              AUTO_WRITE=false) — a deterministic config decision, terminal.

Resume resolves FORWARD to the first phase that is NOT terminal ({accepted,
provisional, skipped}) — never the first non-`done`. So a phase the executor self-considered
"done" but that crashed before its cross-model audit is RE-VALIDATED on resume,
never silently skipped. Acceptance-gate rule made operational: a loop can DRIVE
resume, it cannot ACQUIT a phase past itself.

Structurally enforced: `set` may only write pending/running/done/failed/skipped;
only `accept` writes `accepted`; `mark-provisional` writes `provisional`. Both
REQUIRE a verdict id + reviewer AND that
the phase already be `done` (use --force to override) — you cannot acquit a phase
that never ran, nor mark one accepted without recording who acquitted it.

State at ``<root>/.aris/runs/<run_id>.json`` (file-based, no DB). Single-writer
contract (one orchestrator per run); a best-effort flock guards against a
concurrent resumer. See shared-references/resumable-runs.md.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

try:
    from provenance import model_family
except ImportError:  # package import: ``from tools import run_state``
    from tools.provenance import model_family

try:
    import fcntl  # POSIX
except ImportError:  # pragma: no cover - Windows
    fcntl = None  # type: ignore

EXECUTOR_STATUSES = {"pending", "running", "done", "failed", "skipped"}
GATE_VERDICTS = {"PASS", "BLOCKED"}
# Statuses resume ALWAYS skips. `provisional` is deliberately NOT here: whether a
# same-family provisional verdict may advance a run is a PER-RUN POLICY
# (`policy.provisional_advances`, default False). The Codex-native mirror sets it
# true at start_run; mainline runs keep the historical guarantee that only a
# cross-family acceptance (or an explicit skip) closes a phase.
TERMINAL_STATUSES = {"accepted", "skipped"}
ALL_STATUSES = EXECUTOR_STATUSES | {"accepted", "provisional"}


def _terminal_statuses(state: dict) -> set:
    base = set(TERMINAL_STATUSES)
    if (state.get("policy") or {}).get("provisional_advances") is True:
        base.add("provisional")
    return base


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _run_path(root: str, run_id: str) -> Path:
    safe = "".join(c for c in run_id if c.isalnum() or c in "-_.")
    if not safe or safe != run_id or run_id in (".", ".."):
        raise ValueError(f"invalid run_id {run_id!r} (use [A-Za-z0-9-_.])")
    return Path(root) / ".aris" / "runs" / f"{run_id}.json"


@contextmanager
def _lock(root: str, run_id: str) -> Iterator[None]:
    """Best-effort advisory lock for the load-modify-save of one run.

    Single-writer is the contract; this only guards against a stray concurrent
    resumer. No-op where fcntl is unavailable.
    """
    p = _run_path(root, run_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    if fcntl is None:
        yield
        return
    lock_path = p.with_suffix(".lock")
    fh = open(lock_path, "w")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX)
        yield
    finally:
        try:
            fcntl.flock(fh, fcntl.LOCK_UN)
        finally:
            fh.close()


def _load(root: str, run_id: str) -> dict:
    p = _run_path(root, run_id)
    if not p.exists():
        raise FileNotFoundError(f"no run state at {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def _save(root: str, run_id: str, state: dict) -> None:
    p = _run_path(root, run_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    state["updated"] = _now()
    # Unique temp in the same dir → atomic replace, no shared-tmp clobber.
    fd, tmp = tempfile.mkstemp(dir=str(p.parent), prefix=f".{run_id}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        os.replace(tmp, p)
    except BaseException:
        try:
            os.unlink(tmp)
        finally:
            raise


def start_run(root: str, run_id: str, phases: list[str], executor: Optional[str] = "claude",
              provisional_advances: bool = False) -> dict:
    """Create a run with ordered phases, all `pending` (idempotent: won't clobber).

    ``claude`` is the historical mainline executor default. Codex-native callers
    must record ``--executor codex-gpt-6-astra`` (or their actual executor) so a
    same-family review cannot be misclassified as independent acceptance.
    ``provisional_advances`` is the per-run policy that lets a same-family
    provisional verdict close a phase for RESUME purposes (Codex-native mirror:
    true; mainline default: false — only cross-family acceptance advances).
    """
    with _lock(root, run_id):
        if _run_path(root, run_id).exists():
            return _load(root, run_id)
        state = {
            "run_id": run_id,
            "executor_model": executor,
            "executor_family": model_family(executor) if executor else None,
            "policy": {"provisional_advances": bool(provisional_advances)},
            "created": _now(),
            "updated": _now(),
            "gates": {},
            "phases": [{"phase": ph, "status": "pending", "artifact": None,
                        "verdict_id": None, "reviewer": None,
                        "reviewer_family": None, "review_independence": None,
                        "acceptance_status": None, "executor_model": executor,
                        "executor_family": model_family(executor) if executor else None,
                        "updated": _now()} for ph in phases],
        }
        _save(root, run_id, state)
        return state


def record_gate_result(
    root: str,
    run_id: str,
    gate: str,
    verdict: str,
    reasons: list[str],
) -> dict:
    """Persist a deterministic gate result alongside phase state.

    Gates do not replace per-phase acceptance. They make workflow-level checks
    auditable, including a visible BLOCKED result when required evidence is
    missing.
    """
    if not gate:
        raise ValueError("gate name must be non-empty")
    if verdict not in GATE_VERDICTS:
        raise ValueError(f"gate verdict must be one of {sorted(GATE_VERDICTS)}")
    with _lock(root, run_id):
        state = _load(root, run_id)
        gates = state.setdefault("gates", {})
        gates[gate] = {
            "verdict": verdict,
            "reasons": list(reasons),
            "updated": _now(),
        }
        _save(root, run_id, state)
        return state


def load_run(root: str, run_id: str) -> dict:
    """Return the persisted state for a run without mutating it."""
    return _load(root, run_id)


def _find_phase(state: dict, phase: str) -> dict:
    for ph in state["phases"]:
        if ph["phase"] == phase:
            return ph
    raise KeyError(f"phase {phase!r} not in run (have: {[p['phase'] for p in state['phases']]})")


def set_status(root: str, run_id: str, phase: str, status: str, artifact: Optional[str] = None) -> dict:
    """Executor-side status; acceptance statuses use their dedicated APIs."""
    if status not in EXECUTOR_STATUSES:
        raise ValueError(
            f"set_status may only write {sorted(EXECUTOR_STATUSES)}; "
            "'accepted' and 'provisional' require recorded review provenance.")
    with _lock(root, run_id):
        state = _load(root, run_id)
        ph = _find_phase(state, phase)
        ph["status"] = status
        if artifact is not None:
            ph["artifact"] = artifact
        ph["updated"] = _now()
        _save(root, run_id, state)
        return state


def accept(root: str, run_id: str, phase: str, verdict_id: str, reviewer: str, force: bool = False) -> dict:
    """Mark a phase `accepted` — REQUIRES a recorded verdict id + reviewer, and
    (unless force) that the phase already be `done`.

    Call ONLY from a cross-model reviewer verdict (codex/gemini) or a deterministic
    verifier (verify_papers.py, verify_paper_audits.sh, a passing test, exit 0).
    The executor (Claude) must never call this on its own self-report.

    `verdict_id` should be a durable handle: the reviewer thread/trace id, or the
    path/sha of the verifier's report — not just a label.
    """
    if not verdict_id or not reviewer:
        raise ValueError("accept requires a non-empty verdict_id AND reviewer — "
                         "a phase cannot be accepted without recording who acquitted it.")
    with _lock(root, run_id):
        state = _load(root, run_id)
        ph = _find_phase(state, phase)
        if not force and ph["status"] not in ("done", "accepted", "provisional"):
            raise ValueError(
                f"phase {phase!r} is {ph['statu
```

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

    lines = [ln for ln in tail.splitlines() if ln.strip()]
    if not lines:
        return None
    # Only when we actually seeked into the middle of the file is the leading
    # line possibly a half record. On a complete (un-seeked) read every line is
    # whole -- dropping the first there would discard real data and could
    # misreport a short transcript as empty.
    if seeked and len(lines) > 1:
        lines = lines[1:]

    window = lines[-TAIL_LINES:]

    # Background-task heuristic: a queue-operation line AFTER the most recent
    # assistant end_turn means there is still unresolved background work.
    has_pending_bg = False
    last_end_turn_idx = -1
    for i, raw in enumerate(window):
        try:
            d = json.loads(raw)
        except Exception:
            continue
        if not isinstance(d, dict):
            continue
        t = d.get("type", "")
        if t == "assistant" and (d.get("message") or {}).get("stop_reason") == "end_turn":
            last_end_turn_idx = i
            has_pending_bg = False
        elif t == "queue-operation" and i > last_end_turn_idx:
            has_pending_bg = True

    # Find the last assistant message for stop_reason / last tool name.
    last_asst = None
    for raw in reversed(window):
        try:
            d = json.loads(raw)
        except Exception:
            continue
        if isinstance(d, dict) and d.get("type") == "assistant":
            last_asst = d
            break
    if last_asst is None:
        return None

    msg = last_asst.get("message", {})
    if not isinstance(msg, dict):
        msg = {}
    content = msg.get("content", []) or []
    last_tool = ""
    if isinstance(content, list) and content:
        last_block = content[-1]
        if isinstance(last_block, dict) and last_block.get("type") == "tool_use":
            last_tool = last_block.get("name", "") or ""

    return Info(
        stop_reason=msg.get("stop_reason"),
        last_tool=last_tool,
        has_pending_background=has_pending_bg
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #455** (2026-10-05): **docs(readme): announce Grok and Gemini MCP bridges**
  *Symptoms*: 在中英文 README 的 News 顶部各加一句 Grok / Gemini（Antigravity）MCP 更新，链接到安装说明及 #454。仅新增两行文档，`git diff --check` 通过。 

- **Issue #454** (2026-10-05): **feat(mcp): add optional Grok and Antigravity CLI bridges**
  *Symptoms*: ## Summary  Add optional Grok and Antigravity CLI MCP bridges so Claude Code and Codex can consult these models using an existing CLI login, read local files, and continue the same native conversation after a bridge restart.  - `grok` / `grok-reply`: default `grok-4.7` with `xhigh`; preserve the returned `grok-4.7-build` model identity and session effort separately from requested values. - `antigravity` / `antigravity-reply`: default `gemini-3.8-flash-high` with `high`; use native `stream-json` and conversation resume, with the included review-agent profile. - Both bridges provide progress, cancellation, bounded process cleanup and explicit failure results, without automatically resubmitting model calls. - Document installation and direct usage in the EN/CN README, agent guide and Claude/Codex shared routing references. These are optional consultation tools; existing skill calls, reviewer defaults and acceptance rules stay intact. The existing `gemini-review` API/CLI/agy backends and Gemini overlay keep their current contracts.  ## Validation  - Grok protocol tests: 7 passed; Antigravity protocol tests: 8 passed, covering first calls, restart/resume, fixed settings, malformed/incomplete results, cancellation and timeout cleanup. - Codex skill mirror checks: 21 passed; skill inventory consistent. - Ruff lint/format and ty checks passed for both bridges and tests. - Live macOS checks: Grok CLI 1.0.46 first call, file read and native resume succeeded with `grok-4.7-build` / `xhi

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

Co-Authored-By: ilya-pershin <[REDACTED_EMAIL]>
Co-Authored-By: Cl

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

**File**: `tools/arxiv_fetch.py` (modified, +28/-5)
```diff
@@ -21,6 +21,8 @@
 import json
 import os
 import re
+import shutil
+import subprocess
 import sys
 import time
 import urllib.error
@@ -30,7 +32,7 @@
 from pathlib import Path
 
 _ATOM_NS = "http://www.w3.org/2005/Atom"
-_API_BASE = "http://export.arxiv.org/api/query"
+_API_BASE = "https://export.arxiv.org/api/query"
 _MIN_PDF_BYTES = 10_240
 
 
@@ -100,6 +102,23 @@ def _api_url(query: str, max_results: int, start: int) -> str:
     return f"{_API_BASE}?{urllib.parse.urlencode(params)}"
 
 
+def _curl_get(url: str, headers: dict, timeout: float) -> bytes | None:
+    """Re-issue a GET through ``curl`` after urllib was answered HTTP 406.
+
+    export.arxiv.org refuses urllib from some networks for minutes at a time
+    while curl gets 200 on the same URL, so retrying urllib cannot recover.
+    Returns the body, or None when curl is missing or the request fails.
+    """
+    curl = shutil.which("curl")
+    if curl is None:
+        return None
+    cmd = [curl, "-sf", "--max-time", str(int(timeout))]
+    for key, value in headers.items():
+        cmd += ["-H", f"{key}: {value}"]
+    proc = subprocess.run(cmd + [url], capture_output=True)
+    return proc.stdout if proc.returncode == 0 else None
+
+
 def _fetch_atom(url: str) -> ET.Element:
     """Fetch an arXiv Atom feed and return the parsed XML root.
 
@@ -108,17 +127,21 @@ def _fetch_atom(url: str) -> ET.Element:
     plain-text ``Rate exceeded.`` body the API sometimes returns with 200 OK.
     Raises RuntimeError when all retries are exhausted.
     """
-    req = urllib.request.Request(url, headers={"User-Agent": _arxiv_user_agent()})
+    headers = {"User-Agent": _arxiv_user_agent()}
+    req = urllib.request.Request(url, headers=headers)
     for attempt in (1, 2, 3):
         try:
             with urllib.request.urlopen(req, timeout=30) as resp:
                 body = resp.read()
         except urllib.error.HTTPError as e:
-            # export.arxiv.org returns 406 intermittently; it is not permanent.
-            if e.code in (406, 408, 429) and attempt < 3:
+            rescued = _curl_get(url, headers, 30) if e.code == 406 else None
+            if rescued is not None:
+                body = rescued
+            elif e.code in (406, 408, 429) and attempt < 3:
                 time.sleep(5 * attempt)
                 continue
-            raise RuntimeError(f"arXiv API fetch failed: {e}")
+            else:
+                raise RuntimeError(f"arXiv API fetch failed: {e}")
         except (urllib.error.URLError, TimeoutError, OSError) as e:
             if attempt < 3:
                 time.sleep(2 * attempt)
```

**File**: `tools/research_wiki.py` (modified, +27/-3)
```diff
@@ -48,6 +48,8 @@
 import json
 import os
 import re
+import shutil
+import subprocess
 import sys
 import time
 import unicodedata
@@ -481,6 +483,23 @@ def _yaml_quote(s: str) -> str:
     return f'"{s}"'
 
 
+def _curl_get(url: str, headers: dict, timeout: float) -> bytes | None:
+    """Re-issue a GET through ``curl`` after urllib was answered HTTP 406.
+
+    export.arxiv.org refuses urllib from some networks for minutes at a time
+    while curl gets 200 on the same URL, so retrying urllib cannot recover.
+    Returns the body, or None when curl is missing or the request fails.
+    """
+    curl = shutil.which("curl")
+    if curl is None:
+        return None
+    cmd = [curl, "-sf", "--max-time", str(int(timeout))]
+    for key, value in headers.items():
+        cmd += ["-H", f"{key}: {value}"]
+    proc = subprocess.run(cmd + [url], capture_output=True)
+    return proc.stdout if proc.returncode == 0 else None
+
+
 def _arxiv_api_get(url: str, what: str, timeout: float = 15.0) -> bytes:
     """GET an arXiv API URL with a descriptive User-Agent + retry/backoff.
 
@@ -490,16 +509,21 @@ def _arxiv_api_get(url: str, what: str, timeout: float = 15.0) -> bytes:
     plain-text "Rate exceeded." body the API sometimes returns with 200 OK.
     ``what`` is a label for error messages (e.g. the id or id-list).
     """
-    req = urllib.request.Request(url, headers={"User-Agent": _arxiv_user_agent()})
+    headers = {"User-Agent": _arxiv_user_agent()}
+    req = urllib.request.Request(url, headers=headers)
     for attempt in (1, 2, 3):
         try:
             with urllib.request.urlopen(req, timeout=timeout) as resp:
                 body = resp.read()
         except urllib.error.HTTPError as e:
-            if e.code == 429 and attempt < 3:
+            rescued = _curl_get(url, headers, timeout) if e.code == 406 else None
+            if rescued is not None:
+                body = rescued
+            elif e.code in (406, 429) and attempt < 3:
                 time.sleep(5 * attempt)
                 continue
-            raise RuntimeError(f"arXiv API fetch failed for {what}: {e}")
+            else:
+                raise RuntimeError(f"arXiv API fetch failed for {what}: {e}")
         except (urllib.error.URLError, TimeoutError, OSError) as e:
             if attempt < 3:
                 time.sleep(2 * attempt)
```

**File**: `tools/verify_papers.py` (modified, +48/-2)
```diff
@@ -89,6 +89,8 @@
 import os
 import random
 import re
+import shutil
+import subprocess
 import sys
 import time
 import unicodedata
@@ -231,13 +233,37 @@ def save_cache(path: Path, cache: dict[str, dict[str, Any]]) -> None:
 # Retry helpers
 # ──────────────────────────────────────────────────────────────────────────
 
+def _curl_get(url: str, headers: dict, timeout: float) -> bytes | None:
+    """Re-issue a GET through ``curl`` after urllib was answered HTTP 406.
+
+    export.arxiv.org refuses urllib from some networks for minutes at a time
+    while curl gets 200 on the same URL, so retrying urllib cannot recover.
+    Returns the body, or None when curl is missing or the request fails.
+    """
+    curl = shutil.which("curl")
+    if curl is None:
+        return None
+    cmd = [curl, "-sf", "--max-time", str(int(timeout))]
+    for key, value in headers.items():
+        cmd += ["-H", f"{key}: {value}"]
+    proc = subprocess.run(cmd + [url], capture_output=True)
+    return proc.stdout if proc.returncode == 0 else None
+
+
 def http_get(url: str, headers: dict[str, str] | None = None, timeout: int = 30) -> tuple[int, str | None]:
-    """Return (status_code, body) or (status_code, None) on error. Status -1 = network error."""
+    """Return (status_code, body) or (status_code, None) on error. Status -1 = network error.
+
+    An HTTP 406 is re-issued once through curl before it is reported.
+    """
     req = urllib.request.Request(url, headers=headers or {})
     try:
         with urllib.request.urlopen(req, timeout=timeout) as resp:
             return resp.status, resp.read().decode("utf-8", errors="replace")
     except urllib.error.HTTPError as e:
+        if e.code == 406:
+            rescued = _curl_get(url, headers or {}, timeout)
+            if rescued is not None:
+                return 200, rescued.decode("utf-8", errors="replace")
         return e.code, None
     except (urllib.error.URLError, TimeoutError, ConnectionError):
         return -1, None
@@ -252,6 +278,15 @@ def is_transient(status: int) -> bool:
     return status == -1 or status in (406, 408, 429) or 500 <= status < 600
 
 
+def is_refusal(status: int) -> bool:
+    """The service declined to answer (bad or missing key, access denied).
+
+    That says nothing about whether the paper exists, so it is never
+    ``unverified`` — only ``verify_pending``.
+    """
+    return status in (401, 403)
+
+
 def backoff(attempt: int) -> float:
     return min(2 ** attempt + random.uniform(0, 1), 30)
 
@@ -286,10 +321,16 @@ def _verify_arxiv_batch_with_retry(batch: list[str]) -> dict[str, str]:
                 orig: "verified" if normalize_arxiv_id(orig)[0] in found else "unverified"
                 for orig in batch
             }
+        if is_refusal(status):
+            return {orig: "verify_pending" for orig in batch}
         if not is_transient(status):
             # 4xx (non-transient) — likely malformed query; mark whole batch unverified
             return {orig: "unverified" for orig in batch}
         time.sleep(backoff(attempt))
+    if status == 406:
+        # arXiv is refusing this client, not this batch: smaller batches get the
+        # same answer, so splitting only multiplies the requests.
+        return {orig: "verify_pending" for orig in batch}
     # Persistent failure — split & retry
     if len(batch) > 1:
         mid = len(batch) // 2
@@ -314,6 +355,8 @@ def verify_doi(doi: str, user_email: str) -> str:
             return "verified"
         if status == 404:
             return "unverified"
+        if is_refusal(status):
+            return "verify_pending"
         if not is_transient(status):
             return "unverified"
         time.sleep(backoff(attempt))
@@ -371,6 +414,8 @@ def verify_title_s2(title: str, fuzzy_threshold: float) -> tuple[str, dict[str,
                         "doi": ext.get("DOI", ""),
                     }
             return "unverified", None
+        if is_refusal(status):
+            return "verify_pending", None
         if status != 429 and not is_transient(status):
             return "unverified", None
         # 429 included: the 1 req/s ceiling is shared across every endpoint, so a
@@ -405,7 +450,8 @@ def verify_papers(
 
     for p in papers:
         key = cache_key_for(p)
-        if cache is not None and key and key in cache:
+        # a cached verify_pending is a past outage, not an answer — ask again
+        if cache is not None and key and key in cache and cache[key].get("status") != "verify_pending":
             cached = cache[key]
             results[p.id] = PaperResult(
                 id=p.id,
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

Co-authored-by: AfonsoZhang <[REDACTED_EMAIL

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

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
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

Co-authored-by: dreamworld2023 <[REDACTED_EMAIL]>

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

Signed-off-by: hiro-nikaitou <[REDACTED_EMAIL]>

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

### Incident Patch 8: `c9deedda` (2026-09-16)
**Commit Message**: docs: Quick Start and How-to-run badges in the header row

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01CuKuD8gF4REMCKqgX6Mj7D

**File**: `README.md` (modified, +3/-1)
```diff
@@ -6,7 +6,7 @@
   </a>
 </p>
 
-[![Technical Report](https://img.shields.io/badge/Technical%20Report-arXiv%3A2605.03042-b31b1b?style=flat&logo=arxiv)](https://huggingface.co/papers/2605.03042) · [![ARIS Intro (HTML)](https://img.shields.io/badge/ARIS%20Intro-HTML%20%C2%B7%20by%20%2Frender--html-1a4a8c?style=flat&logo=html5&logoColor=white)](https://wanshuiyin.github.io/Auto-claude-code-research-in-sleep/ARIS_INTRO.html) · [![ARIS Intro Slides — VALSE 2026](https://img.shields.io/badge/Slides%20%40%20VALSE%202026-PDF%20%C2%B7%20by%20%2Fpaper--talk-EC1C24?style=flat&logo=adobeacrobatreader&logoColor=white)](docs/aris_intro_slides.pdf) · [![AI Agents](https://img.shields.io/badge/AI%20Agents-AGENT__GUIDE.md-4B2E83?style=flat&logo=readthedocs&logoColor=white)](AGENT_GUIDE.md) · [![Featured on PaperWeekly](https://img.shields.io/badge/Featured%20on-PaperWeekly-red?style=flat)](https://mp.weixin.qq.com/s/tDniVryVGjDkkkWl-5sTkQ) · [![Featured in awesome-agent-skills](https://img.shields.io/badge/Featured%20in-awesome--agent--skills-blue?style=flat&logo=github)](https://github.com/VoltAgent/awesome-agent-skills) · [![AI Digital Crew - Project of the Day](https://img.shields.io/badge/AI%20Digital%20Crew-Project%20of%20the%20Day%20(2026.03.14)-orange?style=flat)](https://aidigitalcrew.com) · [![GitHub stars](https://img.shields.io/github/stars/wanshuiyin/Auto-claude-code-research-in-sleep?style=flat&logo=github&logoColor=white&color=gold&label=Stars)](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/stargazers) · [💬 Join Community](#community) · [![Cite](https://img.shields.io/badge/📖_Cite_Us-BibTeX-green?style=flat)](#citation)
+[![Quick Start](https://img.shields.io/badge/🚀_Quick_Start-3_commands-2E7D32?style=flat)](#quick-start) · [![How to run](https://img.shields.io/badge/🎯_How_to_run-direction_·_paper+code_·_build-orange?style=flat)](#how-to-run) · [![Technical Report](https://img.shields.io/badge/Technical%20Report-arXiv%3A2605.03042-b31b1b?style=flat&logo=arxiv)](https://huggingface.co/papers/2605.03042) · [![ARIS Intro (HTML)](https://img.shields.io/badge/ARIS%20Intro-HTML%20%C2%B7%20by%20%2Frender--html-1a4a8c?style=flat&logo=html5&logoColor=white)](https://wanshuiyin.github.io/Auto-claude-code-research-in-sleep/ARIS_INTRO.html) · [![ARIS Intro Slides — VALSE 2026](https://img.shields.io/badge/Slides%20%40%20VALSE%202026-PDF%20%C2%B7%20by%20%2Fpaper--talk-EC1C24?style=flat&logo=adobeacrobatreader&logoColor=white)](docs/aris_intro_slides.pdf) · [![AI Agents](https://img.shields.io/badge/AI%20Agents-AGENT__GUIDE.md-4B2E83?style=flat&logo=readthedocs&logoColor=white)](AGENT_GUIDE.md) · [![Featured on PaperWeekly](https://img.shields.io/badge/Featured%20on-PaperWeekly-red?style=flat)](https://mp.weixin.qq.com/s/tDniVryVGjDkkkWl-5sTkQ) · [![Featured in awesome-agent-skills](https://img.shields.io/badge/Featured%20in-awesome--agent--skills-blue?style=flat&logo=github)](https://github.com/VoltAgent/awesome-agent-skills) · [![AI Digital Crew - Project of the Day](https://img.shields.io/badge/AI%20Digital%20Crew-Project%20of%20the%20Day%20(2026.03.14)-orange?style=flat)](https://aidigitalcrew.com) · [![GitHub stars](https://img.shields.io/github/stars/wanshuiyin/Auto-claude-code-research-in-sleep?style=flat&logo=github&logoColor=white&color=gold&label=Stars)](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/stargazers) · [💬 Join Community](#community) · [![Cite](https://img.shields.io/badge/📖_Cite_Us-BibTeX-green?style=flat)](#citation)
 
 💡 *Use ARIS as a skill-based workflow in [Claude Code](https://docs.anthropic.com/en/docs/claude-code) / [Codex CLI](skills/skills-codex/) / [Cursor](docs/CURSOR_ADAPTATION.md) / [Trae](docs/TRAE_ARIS_RUNBOOK_EN.md) / [Antigravity](docs/ANTIGRAVITY_ADAPTATION.md) / [GitHub Copilot CLI](docs/COPILOT_CLI_ADAPTATION.md) / [OpenClaw](docs/OPENCLAW_ADAPTATION.md) / [DeepSeek Harness](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/tree/dsh-aris#readme), or get the full experience with the standalone **[ARIS-Code](docs/ARIS-Code-README_EN.md)** CLI — enjoy any way you like!*
 
@@ -233,6 +233,8 @@ Custom [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills for
 
 > These are full pipelines — you can also use each workflow independently. Already have an idea? Skip to Workflow 1.5. Have results? Jump to Workflow 3. Got reviews? Jump to Workflow 4. Want persistent memory? Enable [Research Wiki](#-research-wiki--persistent-research-memory). See [Quick Start](#quick-start) for all commands and [Workflows](#workflows) for the full breakdown.
 
+<a id="how-to-run"></a>
+
 **Basic mode** — give ARIS a research direction, it handles everything:
 
 ```
```

**File**: `README_CN.md` (modified, +3/-1)
```diff
@@ -6,7 +6,7 @@
   </a>
 </p>
 
-[![技术报告](https://img.shields.io/badge/技术报告-arXiv%3A2605.03042-b31b1b?style=flat&logo=arxiv)](https://huggingface.co/papers/2605.03042) · [![ARIS 介绍 (HTML)](https://img.shields.io/badge/ARIS%20介绍-HTML%20%C2%B7%20由%20%2Frender--html%20生成-1a4a8c?style=flat&logo=html5&logoColor=white)](https://wanshuiyin.github.io/Auto-claude-code-research-in-sleep/ARIS_INTRO.html) · [![ARIS 介绍幻灯 — VALSE 2026](https://img.shields.io/badge/VALSE%202026%20幻灯-PDF%20%C2%B7%20由%20%2Fpaper--talk%20生成-EC1C24?style=flat&logo=adobeacrobatreader&logoColor=white)](docs/aris_intro_slides.pdf) · [![AI Agents 指南](https://img.shields.io/badge/AI%20Agents-AGENT__GUIDE.md-4B2E83?style=flat&logo=readthedocs&logoColor=white)](AGENT_GUIDE.md) · [![PaperWeekly 收录](https://img.shields.io/badge/PaperWeekly-收录-red?style=flat)](https://mp.weixin.qq.com/s/tDniVryVGjDkkkWl-5sTkQ) · [![Featured in awesome-agent-skills](https://img.shields.io/badge/Featured%20in-awesome--agent--skills-blue?style=flat&logo=github)](https://github.com/VoltAgent/awesome-agent-skills) · [![AI Digital Crew - Project of the Day](https://img.shields.io/badge/AI%20Digital%20Crew-Project%20of%20the%20Day%20(2026.03.14)-orange?style=flat)](https://aidigitalcrew.com) · [![GitHub 星标](https://img.shields.io/github/stars/wanshuiyin/Auto-claude-code-research-in-sleep?style=flat&logo=github&logoColor=white&color=gold&label=Stars)](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/stargazers) · [💬 加入交流群](#community) · [![引用](https://img.shields.io/badge/📖_引用-BibTeX-green?style=flat)](#citation)
+[![快速开始](https://img.shields.io/badge/🚀_快速开始-3_条命令-2E7D32?style=flat)](#quick-start) · [![三种用法](https://img.shields.io/badge/🎯_三种用法-方向_·_论文+代码_·_实现功能-orange?style=flat)](#how-to-run) · [![技术报告](https://img.shields.io/badge/技术报告-arXiv%3A2605.03042-b31b1b?style=flat&logo=arxiv)](https://huggingface.co/papers/2605.03042) · [![ARIS 介绍 (HTML)](https://img.shields.io/badge/ARIS%20介绍-HTML%20%C2%B7%20由%20%2Frender--html%20生成-1a4a8c?style=flat&logo=html5&logoColor=white)](https://wanshuiyin.github.io/Auto-claude-code-research-in-sleep/ARIS_INTRO.html) · [![ARIS 介绍幻灯 — VALSE 2026](https://img.shields.io/badge/VALSE%202026%20幻灯-PDF%20%C2%B7%20由%20%2Fpaper--talk%20生成-EC1C24?style=flat&logo=adobeacrobatreader&logoColor=white)](docs/aris_intro_slides.pdf) · [![AI Agents 指南](https://img.shields.io/badge/AI%20Agents-AGENT__GUIDE.md-4B2E83?style=flat&logo=readthedocs&logoColor=white)](AGENT_GUIDE.md) · [![PaperWeekly 收录](https://img.shields.io/badge/PaperWeekly-收录-red?style=flat)](https://mp.weixin.qq.com/s/tDniVryVGjDkkkWl-5sTkQ) · [![Featured in awesome-agent-skills](https://img.shields.io/badge/Featured%20in-awesome--agent--skills-blue?style=flat&logo=github)](https://github.com/VoltAgent/awesome-agent-skills) · [![AI Digital Crew - Project of the Day](https://img.shields.io/badge/AI%20Digital%20Crew-Project%20of%20the%20Day%20(2026.03.14)-orange?style=flat)](https://aidigitalcrew.com) · [![GitHub 星标](https://img.shields.io/github/stars/wanshuiyin/Auto-claude-code-research-in-sleep?style=flat&logo=github&logoColor=white&color=gold&label=Stars)](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/stargazers) · [💬 加入交流群](#community) · [![引用](https://img.shields.io/badge/📖_引用-BibTeX-green?style=flat)](#citation)
 
 💡 *在 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) / [Codex CLI](skills/skills-codex/) / [Cursor](docs/CURSOR_ADAPTATION.md) / [Trae](docs/TRAE_ARIS_RUNBOOK_CN.md) / [Antigravity](docs/ANTIGRAVITY_ADAPTATION_CN.md) / [GitHub Copilot CLI](docs/COPILOT_CLI_ADAPTATION.md) / [OpenClaw](docs/OPENCLAW_ADAPTATION.md) / [DeepSeek Harness](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/dsh-aris/README_CN.md) 里以 skill-based workflow 用 ARIS，或用独立的 **[ARIS-Code](docs/ARIS-Code-README_CN.md)** CLI 完整版体验——任你选！*
 
@@ -206,6 +206,8 @@ cd claude-fleet && bash run.sh
 
 ## 1. 🎯 不止一句 Prompt
 
+<a id="how-to-run"></a>
+
 **基础模式** — 给 ARIS 一个研究方向，全自动：
 
 ```
```

---

### Incident Patch 9: `3ceb00ba` (2026-09-16)
**Commit Message**: docs: shorter Build-a-feature blurb, credit the contributor

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01CuKuD8gF4REMCKqgX6Mj7D

**File**: `README.md` (modified, +1/-1)
```diff
@@ -255,7 +255,7 @@ ARIS reads the paper → finds its weaknesses → clones the codebase → genera
 /research-implement-feature "add KV-cache reuse to the decoder" — base repo: https://github.com/org/project
 ```
 
-A minimal end-to-end path first, stubs labeled, then one feature at a time with a runnable check each. Choices the request left open that affect interfaces or what a result means go into an assumption ledger *before* the code that depends on them; at the end a different model family reads the raw diff for the ones that went undeclared (and says so if that review was unavailable). The report lists passed, blocked and deferred steps — passing checks does not mean the method works, and it never claims it does.
+Spine first, then one feature at a time, each with a runnable check. Every choice the request left open is written to an assumption ledger before the code that depends on it, and a different model family then reads the raw diff for the ones that went undeclared. It reports "the checks passed", never "the method works". Contributed by [@heroarmor](https://github.com/heroarmor).
 
 **🔥 Rebuttal mode** — reviews just dropped? Don't panic. ARIS reads every concern, builds a strategy, and drafts a rebuttal that's grounded, structured, and under the character limit:
 
```

**File**: `README_CN.md` (modified, +1/-1)
```diff
@@ -228,7 +228,7 @@ ARIS 读论文 → 找弱点 → 克隆代码 → 针对*那些*弱点用*那套
 /research-implement-feature "给 decoder 加 KV-cache 复用" — base repo: https://github.com/org/project
 ```
 
-先跑通一条最小的端到端路径（占位处标明），再一次加一个功能、每个都带一条可执行的检查。需求没说清、又会影响接口或结果含义的决定，先写进假设台账再写依赖它的代码；最后换一个模型家族读原始 diff，专找没申报的假设（审阅不可用时会明说）。报告列出通过、卡住、推迟的步骤——检查通过不等于方法有效，它也从不这么说。
+先跑通脊柱，再一次加一个功能，每个带一条可执行检查。需求没说清的决定先写进假设台账再写代码，最后换一个模型家族读原始 diff，专找没申报的假设。它只说"检查过了"，不说"方法有效"。由 [@heroarmor](https://github.com/heroarmor) 贡献。
 
 **🔥 Rebuttal 模式** — 审稿意见来了？别慌。ARIS 读每条意见、制定策略、起草安全的 rebuttal：
 
```

---

### Incident Patch 10: `e8fe09a2` (2026-09-16)
**Commit Message**: docs: /research-implement-feature on the front page; report says when post-sweep fixes were not re-swept

Third entry next to the two /research-pipeline forms — a separate command,
not a pipeline mode. Smoke-tested end to end on a toy CLI: autonomous,
one codex call, the cross-model sweep caught a real ragged-row bug the
executor's ledger had misdescribed. At lite the sweep budget is one
round, so the report now states that fixes after the last sweep were
verified by the executor only.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
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

### Incident Patch 11: `151bc19a` (2026-09-15)
**Commit Message**: feat(skill): /research-implement-feature — build from "implement X" with a declared assumption ledger (#438)

* feat(skill): /research-implement-feature — build from "implement X", with a declared assumption ledger

A build skill for the plain "just implement X for me" request, where the
author has a capability in mind rather than an experiment plan.

Two invariants:

- Spine before features. F0 is a walking skeleton that must run end-to-end
  before any feature rung is added; each rung carries ONE acceptance command
  and must leave every earlier rung green. A rung that exhausts its fix
  budget halts the ladder instead of being reordered to the end.
- Declare before you act. Every decision the request left under-determined
  gets a ledger row before the code that depends on it, class-tagged
  cosmetic / local / interface / semantic, with a reversal cost and an
  override. Code sites carry ASSUMPTION[A-nnn] markers, and a deterministic
  grep+comm bijection check halts a rung on any marker without a row.

Interaction modes (— ask: never | semantic | all), one axis: the ledger row
is the unit of ambiguity, so ASK just chooses which classes are put to the
author instead of decided f

**File**: `AGENT_GUIDE.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ complete workflows but records `review_independence: same-family` and
 verifiers may record accepted; never describe base Codex self-review as
 cross-model acceptance.
 
-**Full catalog**: [`docs/SKILLS_CATALOG.md`](docs/SKILLS_CATALOG.md) — **82 skills**, grouped by role.
+**Full catalog**: [`docs/SKILLS_CATALOG.md`](docs/SKILLS_CATALOG.md) — **83 skills**, grouped by role.
 
 Invocation syntax is identical across hosts:
 ```
```

**File**: `README.md` (modified, +6/-6)
```diff
@@ -416,7 +416,7 @@ Two outputs: `PASTE_READY.txt` (exact char count, paste to venue) + `REBUTTAL_DR
 git clone https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep.git
 bash Auto-claude-code-research-in-sleep/tools/install_aris.sh ~/your-project   # symlinks ARIS skills into <project>/.claude/skills/
 # (prefer a global install instead? cp -r Auto-claude-code-research-in-sleep/skills/* ~/.claude/skills/)
-# (don't need all 82? --list-groups / --groups X,Y / --skills X — see "Selective install" below)
+# (don't need all 83? --list-groups / --groups X,Y / --skills X — see "Selective install" below)
 
 # 1b. Update later (when upstream changes)
 cd Auto-claude-code-research-in-sleep && git pull
@@ -461,7 +461,7 @@ claude
 > /meta-optimize                                # Meta: analyze usage logs → propose skill improvements
 ```
 
-> Don't need all 82 skills? See [Selective install](#install-skills) below for group/skill-level picks.
+> Don't need all 83 skills? See [Selective install](#install-skills) below for group/skill-level picks.
 
 <details>
 <summary><b>📚 Research Wiki (optional)</b> — one-line init for persistent memory across sessions; see <a href="#-research-wiki--persistent-research-memory">full Research Wiki section</a></summary>
@@ -609,14 +609,14 @@ See [full setup guide](#setup) for details and [alternative model combinations](
 
 ## 4. ✨ Features
 
-ARIS chains **82 composable skills** across the whole research lifecycle — literature & novelty → idea discovery → GPU experiments → autonomous review loop → paper writing → peer review — with **cross-model adversarial review** (Claude executes · GPT-6-Astra xhigh reviews · optional **GPT-5.5 Pro** via Oracle), anti-hallucination DBLP/CrossRef citations, a persistent **Research Wiki**, flexible model backends, human-in-the-loop checkpoints, and optional Feishu / Zotero / Obsidian / GPU integrations.
+ARIS chains **83 composable skills** across the whole research lifecycle — literature & novelty → idea discovery → GPU experiments → autonomous review loop → paper writing → peer review — with **cross-model adversarial review** (Claude executes · GPT-6-Astra xhigh reviews · optional **GPT-5.5 Pro** via Oracle), anti-hallucination DBLP/CrossRef citations, a persistent **Research Wiki**, flexible model backends, human-in-the-loop checkpoints, and optional Feishu / Zotero / Obsidian / GPU integrations.
 
 🔥 *And it scales to any agent's **ultracode-style deep mode** — the breadth/firepower pass adapts to the runtime (Claude Code ultracode + workflows on Opus 4.8, Codex `spawn_agent`, or plain sequential), feeding three roles: **breadth · cross-model review → accuracy · research wiki → memory**. However a loop is driven, it reports to the same cross-model jury + research wiki — **it can drive, never acquit**.*
 
 <details>
 <summary><b>Full feature list</b></summary>
 
-- 📊 **82 composable skills** — mix and match, or chain into full pipelines (`/idea-discovery`, `/auto-review-loop`, `/paper-writing`, `/research-pipeline`). See [full catalog →](docs/SKILLS_CATALOG.md)
+- 📊 **83 composable skills** — mix and match, or chain into full pipelines (`/idea-discovery`, `/auto-review-loop`, `/paper-writing`, `/research-pipeline`). See [full catalog →](docs/SKILLS_CATALOG.md)
 - 🔍 **Literature & novelty** — multi-source paper search (**[Zotero](docs/integrations/ZOTERO.md)** + **[Obsidian](docs/integrations/OBSIDIAN.md)** + **local PDFs** + arXiv/Scholar) + cross-model novelty verification
 - 💡 **Idea discovery** — literature survey → brainstorm 8-12 ideas → novelty check → GPU pilot experiments → ranked report
 - 🔄 **Auto review loop** — 4-round autonomous review, 5/10 → 7.5/10 overnight with 20+ GPU experiments
@@ -649,7 +649,7 @@ ARIS chains **82 composable skills** across the whole research lifecycle — lit
 <a id="skills-catalog"></a>
 <a id="-skills-catalog"></a>
 
-ARIS ships **82+ skills** across literature, ideation, experiments, audit, writing, talks, patents, and meta-utilities — the full catalog (role / category / requirements per skill) lives in **[`docs/SKILLS_CATALOG.md`](docs/SKILLS_CATALOG.md)** to keep this README scannable.
+ARIS ships **83+ skills** across literature, ideation, experiments, audit, writing, talks, patents, and meta-utilities — the full catalog (role / category / requirements per skill) lives in **[`docs/SKILLS_CATALOG.md`](docs/SKILLS_CATALOG.md)** to keep this README scannable.
 
 <details>
 <summary><b>Start here</b> — common entry points (use case → skill)</summary>
@@ -670,7 +670,7 @@ ARIS ships **82+ skills** across literature, ideation, experiments, audit, writi
 
 </details>
 
-→ **[Browse all 82 skills by category in the full catalog →](docs/SKILLS_CATALOG.md)**
+→ **[Browse all 83 skills by category in the full catalog →](docs/SKILLS_CATALOG.md)**
 
 ---
 
```

**File**: `README_CN.md` (modified, +6/-6)
```diff
@@ -383,7 +383,7 @@ ARIS 读论文 → 找弱点 → 克隆代码 → 针对*那些*弱点用*那套
 git clone https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep.git
 bash Auto-claude-code-research-in-sleep/tools/install_aris.sh ~/your-project   # 把 ARIS skill symlink 进 <project>/.claude/skills/
 # （想全局安装？cp -r Auto-claude-code-research-in-sleep/skills/* ~/.claude/skills/）
-# （不需要全部 82 个？--list-groups / --groups X,Y / --skills X —— 见下方"选择性安装"）
+# （不需要全部 83 个？--list-groups / --groups X,Y / --skills X —— 见下方"选择性安装"）
 
 # 可选：Codex mirror 项目级受管安装
 bash Auto-claude-code-research-in-sleep/tools/install_aris_codex.sh ~/your-codex-project
@@ -423,7 +423,7 @@ claude
 > /meta-optimize                               # 元优化：分析使用记录 → 提出技能改进方案
 ```
 
-> 不需要全部 82 个 skill？见下方[选择性安装](#install-skills)按组/按 skill 挑选。
+> 不需要全部 83 个 skill？见下方[选择性安装](#install-skills)按组/按 skill 挑选。
 
 <details>
 <summary><b>📚 Research Wiki（可选）</b> —— 一行 init 启用跨 session 持久记忆；完整说明见 <a href="#-research-wiki--persistent-research-memory">§ Research Wiki</a></summary>
@@ -565,14 +565,14 @@ Codex 基础镜像默认由新的 Codex `spawn_agent` 自审：流程可以继
 
 ## 4. ✨ 功能亮点
 
-ARIS 用 **82 个可组合 skill** 覆盖科研全生命周期——文献查新 → idea 发现 → GPU 实验 → 自动 review 循环 → 论文写作 → peer review——配合**跨模型对抗审**（Claude 执行 · GPT-6-Astra xhigh 审 · 可选 **GPT-5.5 Pro** via Oracle）、DBLP/CrossRef 反幻觉引用、持久化 **Research Wiki**、灵活模型后端、human-in-the-loop 检查点，以及可选的飞书 / Zotero / Obsidian / GPU 集成。
+ARIS 用 **83 个可组合 skill** 覆盖科研全生命周期——文献查新 → idea 发现 → GPU 实验 → 自动 review 循环 → 论文写作 → peer review——配合**跨模型对抗审**（Claude 执行 · GPT-6-Astra xhigh 审 · 可选 **GPT-5.5 Pro** via Oracle）、DBLP/CrossRef 反幻觉引用、持久化 **Research Wiki**、灵活模型后端、human-in-the-loop 检查点，以及可选的飞书 / Zotero / Obsidian / GPU 集成。
 
 🔥 *而且这套"广度 / 审 / 记忆"三角能适配任何 agent 的 **ultracode 式深度模式**：广度 pass 适配运行时暴露的能力（Claude Code 原生 ultracode / workflows + Opus 4.8、Codex `spawn_agent`，或纯顺序执行），并按层级干净降级（fan-out → agent spawn → 顺序）。三件事分得很清楚：**广度 · 跨模型对抗审 → 准确性 · research wiki → 记忆性**。无论循环由谁推进，最后都回到同一套跨模型对抗审 + research wiki：**能推进，不能定案**。*
 
 <details>
 <summary><b>完整功能清单</b></summary>
 
-- 📊 **82 个可组合 skill** — 自由混搭，或串联为完整流水线（`/idea-discovery`、`/auto-review-loop`、`/paper-writing`、`/research-pipeline`）。[完整目录 →](docs/SKILLS_CATALOG.md)
+- 📊 **83 个可组合 skill** — 自由混搭，或串联为完整流水线（`/idea-discovery`、`/auto-review-loop`、`/paper-writing`、`/research-pipeline`）。[完整目录 →](docs/SKILLS_CATALOG.md)
 - 🔍 **文献 & 查新** — 多源论文搜索（**[Zotero](docs/integrations/ZOTERO_CN.md)** + **[Obsidian](docs/integrations/OBSIDIAN_CN.md)** + **本地 PDF** + arXiv/Scholar）+ 跨模型查新验证
 - 💡 **Idea 发现** — 文献调研 → 头脑风暴 8-12 个 idea → 查新 → GPU pilot 实验 → 排名报告
 - 🔄 **自动 review 循环** — 4 轮自主审稿，一夜从 5/10 提升到 7.5/10，自动跑 20+ 组 GPU 实验
@@ -605,7 +605,7 @@ ARIS 用 **82 个可组合 skill** 覆盖科研全生命周期——文献查新
 <a id="skills-catalog"></a>
 <a id="-skills-catalog"></a>
 
-ARIS 现有 **82+ 个 skill**，覆盖文献调研、idea 生成、实验、审计、论文写作、演讲、专利、meta 工具等——完整目录（每个 skill 含 role / category / 依赖）在 **[`docs/SKILLS_CATALOG.md`](docs/SKILLS_CATALOG.md)**，独立成文以保持 README 可扫读。
+ARIS 现有 **83+ 个 skill**，覆盖文献调研、idea 生成、实验、审计、论文写作、演讲、专利、meta 工具等——完整目录（每个 skill 含 role / category / 依赖）在 **[`docs/SKILLS_CATALOG.md`](docs/SKILLS_CATALOG.md)**，独立成文以保持 README 可扫读。
 
 <details>
 <summary><b>常用入口</b> —— 场景 → 入口 skill</summary>
@@ -626,7 +626,7 @@ ARIS 现有 **82+ 个 skill**，覆盖文献调研、idea 生成、实验、审
 
 </details>
 
-→ **[按 category 浏览全部 82 个 skill →](docs/SKILLS_CATALOG.md)**
+→ **[按 category 浏览全部 83 个 skill →](docs/SKILLS_CATALOG.md)**
 
 ---
 
```

**File**: `docs/ARIS_INTRO.html` (modified, +5/-5)
```diff
@@ -499,7 +499,7 @@ <h3>Contents</h3>
 </li>
 <li><a href="#real-results">Real Results</a>
 </li>
-<li><a href="#the-82-skills">The 82 Skills</a>
+<li><a href="#the-83-skills">The 83 Skills</a>
 <ul>
 <li><a href="#the-3-layer-audit-chain">The 3-layer audit chain</a></li>
 </ul>
@@ -534,7 +534,7 @@ <h1>ARIS — Autonomous Research via Adversarial Multi-Agent Collaboration</h1>
 <h1 id="aris--autonomous-research-via-adversarial-multi-agent-collaboration">ARIS — Autonomous Research via Adversarial Multi-Agent Collaboration</h1>
 <blockquote><p><strong>Let Claude Code do research while you sleep.</strong> Wake up to find your paper scored, weaknesses identified, experiments run, and narrative rewritten — autonomously. Repo: <a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep">github.com/wanshuiyin/Auto-claude-code-research-in-sleep</a>.</p></blockquote>
 <h2 id="tldr">TL;DR</h2>
-<p>ARIS is a collection of <strong>82 composable Claude Code skills</strong> that orchestrate <strong>cross-model collaboration</strong>: Claude Code drives the research (reads files, writes code, deploys experiments) while an external LLM (GPT-6-Astra via <a href="https://github.com/openai/codex">Codex MCP</a>) acts as a critical reviewer. The two models disagree, debate, and force each other to do better — adversarial, not self-play.</p>
+<p>ARIS is a collection of <strong>83 composable Claude Code skills</strong> that orchestrate <strong>cross-model collaboration</strong>: Claude Code drives the research (reads files, writes code, deploys experiments) while an external LLM (GPT-6-Astra via <a href="https://github.com/openai/codex">Codex MCP</a>) acts as a critical reviewer. The two models disagree, debate, and force each other to do better — adversarial, not self-play.</p>
 <p>Seven workflows (W1 / W1.5 / W2 / W3 / W4 / W5 / W6) compose into a full research lifecycle: idea discovery → experiment bridge → auto-review → paper writing → rebuttal → resubmit → conference talk. Tested end-to-end on real ICLR/NeurIPS submissions. Score progression on a real overnight run: <strong>5/10 → 7.5/10 with 20+ GPU experiments</strong>.</p>
 <div class="callout callout-info"><div class="callout-title">The ARIS bet.</div><p>Markdown is for writers. HTML is for readers. Every workflow artifact stays in Markdown (auditable, machine-parseable, future-proof). When a human needs to actually <em>read</em> one, <a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/render-html/SKILL.md"><code>/render-html</code></a> produces this view — gated by a fresh cross-model Codex review (the same ARIS invariant every other audit-class skill follows).</p></div>
 <hr />
@@ -636,9 +636,9 @@ <h2 id="real-results">Real Results</h2>
 <p><strong>Final</strong>: 8 pages main body (ICLR limit: 9), 0 overfull <code>\hbox</code>, ICLR-compliant. <strong>+2.5 points across 4 rounds.</strong></p>
 <div class="callout callout-good"><div class="callout-title">Reproducibility caveat.</div><p>Score values from GPT-6-Astra are <em>signals</em>, not ground truth. ARIS iterates against them, so high AI-review scores are an expected outcome of the loop, not independent proof of acceptance. Human reviewers still bring updated literature knowledge and venue taste an AI reviewer doesn't model.</p></div>
 <hr />
-<h2 id="the-82-skills">The 82 Skills</h2>
+<h2 id="the-83-skills">The 83 Skills</h2>
 <p>Grouped by role (full catalog: <a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/docs/SKILLS_CATALOG.md"><code>docs/SKILLS_CATALOG.md</code></a>).</p>
-<table><thead><tr><th>Category</th><th style="text-align:center">Count</th><th>Headliners</th></tr></thead><tbody><tr><td>Literature &amp; ideation</td><td style="text-align:center">9</td><td><a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/research-lit/SKILL.md"><code>/research-lit</code></a>, <a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/idea-creator/SKILL.md"><code>/idea-creator</code></a>, <a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/novelty-check/SKILL.md"><code>/novelty-check</code></a>, <a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/deepxiv/SKILL.md"><code>/deepxiv</code></a>, <a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/arxiv/SKILL.md"><code>/arxiv</code></a></td></tr><tr><td>Experiments</td><td style="text-align:center">7</td><td><a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/experiment-bridge/SKILL.md"><code>/experiment-bridge</code></a>, <a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/run-experiment/SKILL.md"><code>/run-experiment</code></a>, <a href="https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/monitor-
```

**File**: `docs/ARIS_INTRO.md` (modified, +4/-4)
```diff
@@ -4,7 +4,7 @@
 
 ## TL;DR
 
-ARIS is a collection of **82 composable Claude Code skills** that orchestrate **cross-model collaboration**: Claude Code drives the research (reads files, writes code, deploys experiments) while an external LLM (GPT-6-Astra via [Codex MCP](https://github.com/openai/codex)) acts as a critical reviewer. The two models disagree, debate, and force each other to do better — adversarial, not self-play.
+ARIS is a collection of **83 composable Claude Code skills** that orchestrate **cross-model collaboration**: Claude Code drives the research (reads files, writes code, deploys experiments) while an external LLM (GPT-6-Astra via [Codex MCP](https://github.com/openai/codex)) acts as a critical reviewer. The two models disagree, debate, and force each other to do better — adversarial, not self-play.
 
 Seven workflows (W1 / W1.5 / W2 / W3 / W4 / W5 / W6) compose into a full research lifecycle: idea discovery → experiment bridge → auto-review → paper writing → rebuttal → resubmit → conference talk. Tested end-to-end on real ICLR/NeurIPS submissions. Score progression on a real overnight run: **5/10 → 7.5/10 with 20+ GPU experiments**.
 
@@ -263,14 +263,14 @@ A real overnight 4-round run on an ML research project, from borderline reject t
 
 ---
 
-## The 82 Skills
+## The 83 Skills
 
 Grouped by role (full catalog: [`docs/SKILLS_CATALOG.md`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/docs/SKILLS_CATALOG.md)).
 
 | Category | Count | Headliners |
 |----------|:----:|-----------|
 | Literature & ideation | 9 | [`/research-lit`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/research-lit/SKILL.md), [`/idea-creator`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/idea-creator/SKILL.md), [`/novelty-check`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/novelty-check/SKILL.md), [`/deepxiv`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/deepxiv/SKILL.md), [`/arxiv`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/arxiv/SKILL.md) |
-| Experiments | 7 | [`/experiment-bridge`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/experiment-bridge/SKILL.md), [`/run-experiment`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/run-experiment/SKILL.md), [`/monitor-experiment`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/monitor-experiment/SKILL.md), [`/experiment-audit`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/experiment-audit/SKILL.md) |
+| Experiments | 8 | [`/experiment-bridge`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/experiment-bridge/SKILL.md), [`/run-experiment`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/run-experiment/SKILL.md), [`/monitor-experiment`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/monitor-experiment/SKILL.md), [`/experiment-audit`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/experiment-audit/SKILL.md) |
 | Paper writing | 12 | [`/paper-plan`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/paper-plan/SKILL.md), [`/paper-figure`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/paper-figure/SKILL.md), [`/paper-write`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/paper-write/SKILL.md), [`/paper-compile`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/paper-compile/SKILL.md), [`/auto-paper-improvement-loop`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/auto-paper-improvement-loop/SKILL.md) |
 | Audits | 5 | [`/proof-checker`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/proof-checker/SKILL.md), [`/paper-claim-audit`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/paper-claim-audit/SKILL.md), [`/citation-audit`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/citation-audit/SKILL.md), [`/result-to-claim`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/result-to-claim/SKILL.md), [`/kill-argument`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/kill-argument/SKILL.md) |
 | Talks & posters | 5 | [`/paper-talk`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/paper-talk/SKILL.md), [`/paper-slides`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/paper-slides/SKILL.md), [`/paper-poster-html`](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/paper
```

**File**: `docs/SKILLS_CATALOG.md` (modified, +2/-1)
```diff
@@ -1,6 +1,6 @@
 # ARIS Skills Catalog
 
-Every skill that ships with ARIS, grouped by role. **82 skills** as of the
+Every skill that ships with ARIS, grouped by role. **83 skills** as of the
 latest update; new skills land via PR and get added to the table below.
 
 - Each `Skill` link goes to the canonical `SKILL.md` (the LLM-readable spec).
@@ -85,6 +85,7 @@ GPU job submission, scheduling, monitoring, profiling.
 
 | Skill | Role | Requires |
 |---|---|---|
+| [`/research-implement-feature`](../skills/research-implement-feature/SKILL.md) | Build from a plain "implement X" request — runnable spine first, then one feature per rung; every under-determined decision declared in an assumption ledger before the code depends on it, plus a cross-model sweep for the ones that slipped through undeclared | Codex MCP |
 | [`/run-experiment`](../skills/run-experiment/SKILL.md) | Deploy experiments to local / remote / Vast.ai / Modal GPU | GPU (configurable) |
 | [`/monitor-experiment`](../skills/monitor-experiment/SKILL.md) | Monitor running experiments, check progress, collect results | None |
 | [`/analyze-results`](../skills/analyze-results/SKILL.md) | Compute statistics, generate comparison tables, surface insights from experiment results | None |
```

**File**: `skills/research-implement-feature/SKILL.md` (added, +582/-0)
```diff
@@ -0,0 +1,582 @@
+---
+name: research-implement-feature
+description: "Build a working artifact from a plain \"implement X for me\" request: a running end-to-end spine first, then one feature per rung, with every under-determined decision written to an assumption ledger BEFORE the code that depends on it and a cross-model sweep for the ones that slipped through undeclared. Use when user says \"给我实现\", \"implement X\", \"帮我做一个能跑的\", \"先搭个原型再加功能\", \"build this feature\", \"prototype then extend\", or hands over a capability description rather than an experiment plan."
+argument-hint: "[what-to-build] [— effort: lite|balanced|max|beast] [— ask: never|semantic] [— base repo: <url>]"
+allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, Skill, AskUserQuestion, mcp__codex__codex, mcp__codex__codex-reply
+---
+
+# Research Implement: Feature
+
+Build: **$ARGUMENTS**
+
+This skill exists for one request shape — *"just implement X for me"* — where the
+user has a capability in mind, not an experiment plan, and does not want to be
+interviewed about it first.
+
+It resolves that request the only honest way: **stay autonomous, stop being
+silent.** The skill never blocks to ask permission; it *declares* every decision
+the request left open, in a ledger, at the moment it makes it, and then a
+different model family goes looking for the ones it forgot to declare.
+
+## Two invariants
+
+1. **Declare before you act.** The instant a decision is under-determined by the
+   request *and* changes an interface or a meaning, it gets a ledger row —
+   *before* the code that depends on it exists. A ledger reconstructed at the end
+   of the run is not a ledger, it is a changelog, and it systematically omits
+   exactly the assumptions the author stopped noticing.
+
+   Under `ASK=semantic`, this invariant strengthens to **ask before you act** for
+   the `semantic` class: the ledger row is the unit of ambiguity, so a row that
+   would have been written silently is a question that gets asked first.
+2. **Spine before features.** Rung F0 is a walking skeleton: the thinnest path
+   from real entry point to real artifact, with stubs inside. It must run before
+   any feature is added. Features are then added one rung at a time, each with
+   its own acceptance check, each leaving every earlier rung green.
+
+## Scope boundary
+
+| The ask | Route |
+|---|---|
+| "implement X" / "build me something that does X" / "prototype then extend" | **this skill** |
+| "find me a research direction and take it to a paper" | `/research-pipeline` |
+| "I have `EXPERIMENT_PLAN.md` — run the campaign, deploy to GPU" | `/experiment-bridge` |
+| "sweep these parameters / find the best config" | `/dse-loop` |
+| "launch what is already written" | `/run-experiment` |
+| "do these results support the claim?" | `/result-to-claim` |
+
+### Relationship to `/research-pipeline`
+
+`/research-pipeline` answers *"what should we research?"* and decides the
+question for you. This skill answers *"build the thing I already decided on"*
+and decides **nothing** of consequence without writing it down. Different input
+contracts, so they are different entry points rather than a mode flag — but they
+compose: a pipeline run may delegate its build stage here instead of inlining
+implementation, and inherits the ledger as a result.
+
+If the target decomposes into more than the rung budget below, the scope is too
+large for one run. Cut to the MUST rungs and record the rest under *Deferred* in
+the build note — do not quietly grow this skill into a system build.
+
+## Constants
+
+- **EFFORT = `balanced`** — Work intensity per [`shared-references/effort-contract.md`](../shared-references/effort-contract.md). Override: `— effort: max`.
+
+  | | lite | balanced | max | beast |
+  |---|---|---|---|---|
+  | Rung budget (Phase 1) | 3 | 5 | 8 | 12 |
+  | Fix attempts per rung (Phase 3) | 3 | 5 | 8 | 12 |
+  | Silent-assumption sweep rounds (Phase 4) | 1 | 2 | 2 | 3 |
+  | Reuse survey depth (Phase 0) | local grep | local + ecosystem | + reference impl | + fetch & diff reference impl |
+
+  `EFFORT` never lowers the reviewer tier — a hard invariant of the effort contract.
+
+- **ASK = `never`** — Interaction mode: which ambiguities are put to the author
+  *before* they are acted on.
+
+  | `— ask:` | Asks about | Blocking? | For |
+  |---|---|---|---|
+  | `never` *(default)* | nothing — declare and proceed | no | unattended runs, overnight, `/loop`, a request you want executed not discussed |
+  | `semantic` | `semantic` rows only | at batch points | you trust the small calls, you want a say in what the results will mean |
+
+  `ASK` never changes what lands in the ledger — only who decided each row. Every
+  row records its `Source`, so the record is complete in both modes.
+- **ASSURANCE** — derived from `EFFORT` per the effort contract (`lite`/`balanced` → `draft`, `max`/`beast` → `submission`). Governs whether Phase 4 blocks. Override: `— assurance: submission
```

**File**: `skills/skills-codex/README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ Codex-native mirror and adaptation layer for the main ARIS `skills/` package.
 
 ## Scope
 
-- Base mirror coverage: all `82` mainline skills under `skills/`
+- Base mirror coverage: all `83` mainline skills under `skills/`
 - Support directory: `shared-references/`, with all `30/30` mainline reference names mirrored
 - Default reviewer contract for reviewer-heavy skills:
   - round 1: `spawn_agent`
```

---

### Incident Patch 12: `15b9b27d` (2026-09-15)
**Commit Message**: docs: OrcaReplay row to house length, note what the trace records, CN row and counts (#434)

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
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
 | 🖥️ [Trae Adaptation Guide](docs/TRAE_ARIS_RUNBOOK_EN.md) | General | Use ARIS skills in [Trae](https://www.trae.ai/) (ByteDance AI IDE) — EN + CN guides |
 | 🎛️ [auto-hparam-tuning](https://github.com/zxh0916/auto-hparam-tuning) | General | Automatic hyperparameter tuning — AI agent reads project, plans strategy, runs experiments, analyzes TensorBoard, learns from results. Hydra-based |
-| 🔁 [OrcaReplay](https://github.com/Continuum-AI-Corp/OrcaReplay) | Reproducibility / DevOps | Record an ARIS run below the harness — Claude Code, Codex, OpenClaw or goose — then replay it offline with the network off, or fork it from any step onto a different model with a `--verify` exit code as the verdict. No SDK or plugin; the trace keeps the verbatim wire bytes, so a research loop that went wrong at 2am can be re-examined without paying for the tokens again. Apache-2.0. |
+| 🔁 [OrcaReplay](https://github.com/Continuum-AI-Corp/OrcaReplay) | Reproducibility | Records an agent run (Claude Code, Codex, OpenClaw, goose) and replays it offline, or forks
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
 | 📊 [CitationClaw](https://github.com/VisionXLab/CitationClaw) | 通用 | 引用影响力分析——论文标题 → 引用爬取、学者识别、HTML 报告 |
 | 🚀 [Antigravity 适配指南](docs/ANTIGRAVITY_ADAPTATION_CN.md) | 通用 | 在 [Google Antigravity](https://antigravity.google/) 中使用 ARIS skills——原生 SKILL.md 支持，双模型（Claude Opus 4.6 / Gemini 3.1 Pro），MCP 配置，中[英](docs/ANTIGRAVITY_ADAPTATION.md)文指南 |
```

---

### Incident Patch 13: `d5efb012` (2026-09-15)
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

---

### Incident Patch 14: `f1bd907b` (2026-09-11)
**Commit Message**: docs: ARIS-in-AI-Offer line — 34 sheets, the one-page hub, fixed English README link

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01CuKuD8gF4REMCKqgX6Mj7D

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 
 ❗ ![IMPORTANT](https://img.shields.io/badge/IMPORTANT-red?style=flat-square) **codex-cli 0.154.0 removed `codex mcp-server` — the entry point every ARIS reviewer call used. No impact on ARIS:** the `codex` MCP server is now ARIS's own bridge over `codex exec` (`mcp-servers/codex-exec/`), same tools, same results, all 82 skills unchanged, `ultra` and per-thread resume intact. One re-registration is all it takes — **[already installed? → Quick Start step 2b](#quick-start)** · **[new install → step 2](#quick-start)** · [what changed](#whats-new).
 
-🎯 **准备 2026 AI 秋招？** → [**🌐 ARIS-in-AI-Offer**](https://wanshuiyin.github.io/ARIS-in-AI-Offer/) · [GitHub repo](https://github.com/wanshuiyin/ARIS-in-AI-Offer) · [中文 README](https://github.com/wanshuiyin/ARIS-in-AI-Offer/blob/main/README_CN.md) —— 23 篇双语 ML / LLM / 多模态 / 生成式 / Agent 面试 cheat sheet，每篇 = 公式推导 + 从零 PyTorch + 25 高频面试题（L1 / L2 / L3），全部由 ARIS 的 `/render-html` 自动生成。**希望大家秋招轻松一点 🌱**
+🎯 **准备 2026 AI 秋招？** → [**🌐 ARIS-in-AI-Offer**](https://wanshuiyin.github.io/ARIS-in-AI-Offer/) — **34 bilingual ML / LLM / multimodal / generative / agent interview cheat sheets on one page**: searchable, 中/EN switch, dark mode, per-reader 已读 tracker — save it on your phone. Each sheet = formula derivations + from-scratch PyTorch + 25 interview questions (L1 / L2 / L3), all generated by ARIS's `/render-html`. [GitHub repo](https://github.com/wanshuiyin/ARIS-in-AI-Offer) · [中文 README](https://github.com/wanshuiyin/ARIS-in-AI-Offer/blob/main/README_CN.md). **希望大家秋招轻松一点 🌱**
 
 🐋 **On DeepSeek Harness it installs as one plugin:** `dsh plugin --profile web add dsh-aris` (fetches from npm by itself — no separate install step, but `pnpm` must be on `PATH`) — all 82 skills unchanged, Codex still the independent reviewer. Setup and limits on the [`dsh-aris` branch](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/tree/dsh-aris#readme).
 
```

**File**: `README_CN.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 
 ❗ ![IMPORTANT](https://img.shields.io/badge/IMPORTANT-red?style=flat-square) **codex-cli 0.154.0 删掉了 `codex mcp-server`——ARIS 所有审稿调用原来都走这个入口。对 ARIS 没有任何影响：** `codex` MCP 现在是 ARIS 自己用 `codex exec` 复写的桥接（`mcp-servers/codex-exec/`），工具名、返回形状一模一样，82 个 skill 零改动，`ultra` 档和按线程续聊都在。只需重新注册一次——**[已经装了？→ 快速开始 2b 步](#quick-start)** · **[新装 → 第 2 步](#quick-start)** · [更新说明](#whats-new)。
 
-🎯 **准备 2026 AI 秋招？** → [**🌐 ARIS-in-AI-Offer 网页版**](https://wanshuiyin.github.io/ARIS-in-AI-Offer/) · [GitHub repo](https://github.com/wanshuiyin/ARIS-in-AI-Offer) · [English](https://github.com/wanshuiyin/ARIS-in-AI-Offer/blob/main/README_EN.md) —— 长文中文 ML / LLM / 多模态 / 生成式 / Agent 面试 cheat sheet，每篇 = 公式推导 + 从零 PyTorch + 25 高频面试题（L1 / L2 / L3），全部由 ARIS 的 `/render-html` 自动生成。**希望大家秋招的时候轻松一点 🌱**
+🎯 **准备 2026 AI 秋招？** → [**🌐 ARIS-in-AI-Offer**](https://wanshuiyin.github.io/ARIS-in-AI-Offer/) —— **34 篇双语 ML / LLM / 多模态 / 生成式 / Agent 面试 cheat sheet，一页收齐**：可搜索、中/EN 切换、深色模式、本机记「已读」，存到手机里刷。每篇 = 公式推导 + 从零 PyTorch + 25 高频面试题（L1 / L2 / L3），全部由 ARIS 的 `/render-html` 自动生成。[GitHub repo](https://github.com/wanshuiyin/ARIS-in-AI-Offer) · [English](https://github.com/wanshuiyin/ARIS-in-AI-Offer/blob/main/README.md)。**希望大家秋招的时候轻松一点 🌱**
 
 🐋 **在 DeepSeek Harness 上，ARIS 是一个插件：** `dsh plugin --profile web add dsh-aris`（命令自己从 npm 拉包，无需先装什么——但 `pnpm` 必须在 `PATH` 里）—— 82 个技能零改动，审稿人仍是 Codex。安装与限制见 [`dsh-aris` 分支](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/dsh-aris/README_CN.md)。
 
```

---

### Incident Patch 15: `b8a50974` (2026-09-10)
**Commit Message**: docs(agent-guide): codex-exec bridge, DeepSeek Harness, thread rule, fallback chain, more shared references

- the codex MCP server is ARIS's own bridge over codex exec; never register
  codex mcp-server; codex-reply inherits the thread's model/effort/sandbox/cwd
- DeepSeek Harness row in the platforms table
- thread-freshness rule now states the /auto-review-loop exception instead of
  contradicting its SKILL.md; scope-limits block called out as mandatory in
  reviewer prompts
- capability fallback is gpt-5.6-sol then gpt-5.5; venue has no silent default
- seven shared references agents were not being pointed at

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01CuKuD8gF4REMCKqgX6Mj7D

**File**: `AGENT_GUIDE.md` (modified, +15/-4)
```diff
@@ -17,6 +17,7 @@ ARIS is a research harness: composable Markdown skills that orchestrate the ML r
 | Codex CLI | `skills/skills-codex/<name>/SKILL.md` | Codex mirror; uses `spawn_agent` instead of `mcp__codex__codex` |
 | Codex + Claude-review | `skills/skills-codex-claude-review/` | Overlay on top of `skills-codex/` |
 | Codex + Gemini-review | `skills/skills-codex-gemini-review/` | Same pattern, Gemini reviewer |
+| DeepSeek Harness | `dsh plugin --profile web add dsh-aris` | One plugin, mainline skills unchanged; see the [`dsh-aris` branch](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/tree/dsh-aris#readme) |
 
 Codex base review is a fresh same-family `spawn_agent` review. It may drive and
 complete workflows but records `review_independence: same-family` and
@@ -31,6 +32,8 @@ Invocation syntax is identical across hosts:
 /skill-name "arguments" — key: value, key2: value2
 ```
 
+**The `codex` MCP server is ARIS's own.** codex-cli 0.154.0 removed `codex mcp-server`; `mcp__codex__codex` / `mcp__codex__codex-reply` are served by [`mcp-servers/codex-exec/server.py`](mcp-servers/codex-exec/README.md), a zero-dependency bridge over `codex exec` with the identical tool contract. Registration: `claude mcp add codex -s user -- python3 <aris-repo>/mcp-servers/codex-exec/server.py` (other MCP hosts: same `codex` key, command `python3` + that path). Never register `codex mcp-server`. A `codex-reply` keeps the model, effort, sandbox and cwd its thread was created with — do not re-send them.
+
 ## Common Parameters
 
 ARIS has **two independent control axes** plus scoped flags.
@@ -57,7 +60,7 @@ Controls whether mandatory audits gate the final report. `lite` / `balanced` def
 — human checkpoint: true | false             # pause for approval (default: false)
 — AUTO_PROCEED: true | false                 # auto-continue at gates (default: true)
 — difficulty: medium | hard | nightmare      # reviewer adversarial level
-— venue: ICLR | NeurIPS | ICML | ...         # target venue
+— venue: ICLR | NeurIPS | ICML | ...         # target venue (no silent default; /research-pipeline binds it at the paper stage)
 — sources: web, zotero, deepxiv, exa, ...    # literature sources
 — gpu: local | remote | vast | modal         # GPU backend
 — reviewer: auto | codex | oracle-pro | manual # reviewer routing; auto is native only for Copilot /auto-review-loop
@@ -175,10 +178,11 @@ Advisory CI lint at `.github/workflows/lint-skills-helpers.yml` flags hardcoded
 - **Reviewer** (GPT-6-Astra via Codex MCP, default; or Claude / Gemini via `*-review` MCP overlays): critiques, scores, demands revisions
 - **Rule**: executor and reviewer **must** be different model families. Same-family review is a non-feature.
 - **Reviewer independence**: pass file paths only, never summaries or interpretations
-- **Thread freshness**: every reviewer call uses `mcp__codex__codex` (or equivalent), **never** `codex-reply` — narrative accumulation inflates scores
+- **Thread freshness**: audit-class skills open a fresh `mcp__codex__codex` thread per review round — narrative accumulation inflates scores. `/auto-review-loop` is the documented exception: it keeps one thread across rounds via `codex-reply` (its SKILL.md governs)
+- **Scope limits in every reviewer prompt**: the [`review-scope-limits.md`](skills/shared-references/review-scope-limits.md) block bounds what a reviewer may *propose* (no hashes, no over-defense, no corner-case obsession, not a security product), never what it looks for
 - **Experiment integrity**: executor must NOT judge its own eval code — reviewer audits directly per [`shared-references/experiment-integrity.md`](skills/shared-references/experiment-integrity.md)
 
-The external Codex default is `gpt-6-astra` with two-tier reasoning (deep-audit `ultra` / regular `xhigh`, since 2026-07-10; needs codex-cli ≥ 0.144.1). `gpt-5.5` is the capability fallback; legacy `gpt-5.4` is available as `--- reviewer-model: gpt-5.4`. In a bound Copilot CLI session, `/auto-review-loop` instead defaults to the built-in `rubber-duck` subagent and accepts it only when host events prove the dynamically selected model is from a different family. Oracle Pro tier (`gpt-5.5-pro`) via `--- reviewer: oracle-pro` is a separate routing path.
+The external Codex default is `gpt-6-astra` with two-tier reasoning (deep-audit `ultra` / regular `xhigh`, since 2026-07-10; needs codex-cli ≥ 0.144.1). Capability fallback runs `gpt-5.6-sol` then `gpt-5.5`, both at xhigh; legacy `gpt-5.4` is available as `--- reviewer-model: gpt-5.4`. In a bound Copilot CLI session, `/auto-review-loop` instead defaults to the built-in `rubber-duck` subagent and accepts it only when host events prove the dynamically selected model is from a different family. Oracle Pro tier (`gpt-5.5-pro`) via `--- reviewer: oracle-pro` is a separate routing path.
 
 ## Shared References
 
@@ -194,7 +198,14 @@ Read these before invoking review-related or audit-class skills:
 | [`assurance-c
```

#### Recent Merged Pull Requests:
- **PR #455** (2026-10-05): docs(readme): announce Grok and Gemini MCP bridges (@wanshuiyin)
- **PR #454** (2026-10-05): feat(mcp): add optional Grok and Antigravity CLI bridges (@wanshuiyin)
- **PR #452** (2026-09-29): fix: use alphaXiv's canonical www host (@alias09inc)
- **PR #450** (2026-09-28): fix(verify-papers): send SEMANTIC_SCHOLAR_API_KEY and pace S2 calls (@AfonsoZhang)
- **PR #447** (2026-09-28): fix(tools): treat arXiv 406 as a transient rate-limit response (@AfonsoZhang)
- **PR #445** (closed): fix(arxiv, verify-papers): handle arXiv HTTP 406; never count refusals as hallucinations (@ilya-pershin)
- **PR #443** (2026-09-28): fix(watchdog): serialize the tasks.json read-modify-write to stop losing registrations (@hiro-nikaitou)
- **PR #442** (2026-09-28): fix(auto-review-loop): xhigh is the regular tier, not "maximum reasoning depth" (@dreamworld2023)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
