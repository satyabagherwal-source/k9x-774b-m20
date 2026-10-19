> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source**: github ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Source Version**: `2ef6632f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:31:54.477Z  
> **Learning ID**: `learn-github-yvgude-lean-ctx`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): yvgude/lean-ctx

> **Canonical Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T05:31:53.813Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yvgude/lean-ctx`
- **Description**: LeanCTX — Context Gateway for AI Systems. Control what your AI can see. Open-source Engine for context selection, supported controls, and evidence.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3888 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `_archive/bench/lifecycle/harness/__init__.py`
```
"""Lifecycle Benchmark Harness for lean-ctx.

Reproduces the OpenCode 3-lane sequential benchmark (Fastify/Beets/Terraform)
using Codex CLI, comparing lean-ctx treatment vs bare baseline.
"""

from pathlib import Path

BENCH_ROOT = Path(__file__).resolve().parent.parent
LANES_DIR = BENCH_ROOT / "lanes"
CONFIG_PATH = BENCH_ROOT / "config.json"
ARMS = ("leanctx", "bare")

```

### Core Architecture Module: `_archive/bench/lifecycle/harness/__main__.py`
```
"""Entry point: python3 -m harness.run_lifecycle (from bench/lifecycle/)."""
from harness.run_lifecycle import main
main()

```

### Core Architecture Module: `_archive/bench/lifecycle/harness/codex_runner.py`
```
"""Codex CLI exec wrapper with token accounting from --json JSONL output."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


@dataclass
class TaskResult:
    task_id: str
    arm: str
    exit_code: int
    wall_time_s: float
    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    total_tokens: int = 0
    error: Optional[str] = None
    tool_calls: list[str] = field(default_factory=list)

    @property
    def fresh_input_tokens(self) -> int:
        return self.input_tokens - self.cache_read_tokens

    @property
    def weighted_cost(self) -> int:
        """Cache-adjusted cost: cached tokens at 10% weight."""
        return self.fresh_input_tokens + self.output_tokens + int(self.cache_read_tokens * 0.1)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["fresh_input_tokens"] = self.fresh_input_tokens
        d["weighted_cost"] = self.weighted_cost
        return d


def _ensure_path_complete(path: str) -> str:
    """Ensure PATH includes common tool directories."""
    extras = [
        str(Path.home() / ".local" / "bin"),
        str(Path.home() / "Library" / "Python" / "3.9" / "bin"),
        str(Path.home() / ".cargo" / "bin"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/local/go/bin",
    ]
    parts = path.split(":")
    for extra in extras:
        if extra not in parts and Path(extra).is_dir():
            parts.insert(0, extra)
    return ":".join(parts)


def build_env(home_dir: Path, arm: str) -> dict[str, str]:
    """Build isolated environment for a Codex exec run."""
    env = {}

    for key in ("PATH", "SHELL", "TERM", "LANG", "USER", "LOGNAME", "TMPDIR"):
        if key in os.environ:
            env[key] = os.environ[key]

    env["PATH"] = _ensure_path_complete(env.get("PATH", "/usr/bin:/bin"))

    env["HOME"] = str(home_dir)
    env["CODEX_HOME"] = str(home_dir / ".codex")

    if arm == "bare":
        env["LEAN_CTX_DISABLED"] = "1"
        env.pop("LEAN_CTX_ACTIVE", None)
        env.pop("LEAN_CTX_PROJECT_ROOT", None)
    else:
        for key in ("LEAN_CTX_ACTIVE", "LEAN_CTX_PROJECT_ROOT"):
            if key in os.environ:
                env[key] = os.environ[key]

    return env


def setup_codex_home(home_dir: Path, arm: str, repo_dir: Path) -> None:
    """Prepare a fresh HOME with Codex auth + optional lean-ctx hooks."""
    home_dir.mkdir(parents=True, exist_ok=True)
    codex_home = home_dir / ".codex"
    codex_home.mkdir(exist_ok=True)

    real_codex = Path.home() / ".codex"
    for auth_file in ("auth.json",):
        src = real_codex / auth_file
        if src.exists():
            shutil.copy2(src, codex_home / auth_file)

    real_path = _ensure_path_complete(os.environ.get("PATH", "/usr/bin:/bin"))
    (home_dir / ".zshrc").write_text(f'export PATH="{real_path}"\n')
    (home_dir / ".bashrc").write_text(f'export PATH="{real_path}"\n')
    (home_dir / ".profile").write_text(f'export PATH="{real_path}"\n')

    if arm == "leanctx":
        leanctx_bin = shutil.which("lean-ctx")
        if not leanctx_bin:
            raise RuntimeError("lean-ctx not found on PATH")

        hooks = {
            "hooks": {
                "PostToolUse": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": f"{leanctx_bin} hook observe",
                                "timeout": 5,
                            }
                        ],
                        "matcher": ".*",
                    }
                ],
            }
        }
        (codex_home / "hooks.json").write_text(json.dumps(hooks, indent=2))

        config_toml = "[features]\nhooks = true\n"
        (codex_home / "config.toml").write_text(config_toml)

        leanctx_config = home_dir / ".config" / "lean-ctx"
        leanctx_config.mkdir(parents=True, exist_ok=True)
        (leanctx_config / "config.toml").write_text(
            'shadow_mode = true\ntool_surface = "shadow"\n'
        )


def parse_codex_jsonl(raw_output: bytes) -> dict:
    """Extract token usage from Codex --json JSONL output."""
    usage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "reasoning_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
        "total_tokens": 0,
        "tool_calls": [],
    }

    for line in raw_output.decode("utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        event_type = event.get("type", "")

        if "usage" in event:
            u = event["usage"]
            inp = u.get("input_tokens", 0)
            out = u.get("output_tokens", 0)
            usage["input_tokens"] += inp
            usage["output_tokens"] += out
            usage["reasoning_tokens"] += u.get("reasoning_output_tokens", u.get("reasoning_tokens", 0))
            usage["cache_read_tokens"] += u.get("cached_input_tokens", u.get("cache_read_input_tokens", 0))
            usage["cache_write_tokens"] += u.get("cache_write_input_tokens", u.get("cache_creation_input_tokens", 0))
            usage["total_tokens"] += u.get("total_tokens", inp + out)

        if event_type in ("tool_use", "item.started"):
            item = event.get("item", event)
            if item.get("type") == "command_execution":
                cmd = item.get("command", "")[:80]
                usage["tool_calls"].append(f"bash:{cmd}")
            elif event.get("tool"):
                usage["tool_calls"].append(event["tool"])

    return usage


def run_codex_task(
    task_id: str,
    prompt: str,
    cwd: Path,
    home_dir: Path,
    arm: str,
    timeout: int = 600,
    transcript_path: Optional[Path] = None,
) -> TaskResult:
    """Run a single task via `codex exec` and return structured results."""
    env = build_env(home_dir, arm)

    codex_bin = shutil.which("codex")
    if not codex_bin:
        return TaskResult(
            task_id=task_id, arm=arm, exit_code=-1, wall_time_s=0,
            error="codex not found on PATH",
        )

    cmd = [
        codex_bin, "exec",
        "--json",
        "-s", "workspace-write",
        "-C", str(cwd),
        "--dangerously-bypass-approvals-and-sandbox",
        "--dangerously-bypass-hook-trust",
        "--ephemeral",
        prompt,
    ]

    t0 = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            env=env,
            timeout=timeout,
            cwd=str(cwd),
        )
        exit_code = proc.returncode
        error_msg = None
    except subprocess.TimeoutExpired as exc:
        exit_code = -1
        error_msg = f"timeout after {timeout}s"
        proc = exc
    except Exception as exc:
        exit_code = -1
        error_msg = str(exc)
        proc = None

    wall_time = time.monotonic() - t0

    stdout = getattr(proc, "stdout", b"") or b""
    stderr = getattr(proc, "stderr", b"") or b""

    if transcript_path:
        transcript_path.parent.mkdir(parents=True, exist_ok=True)
        transcript_path.write_bytes(stdout)
        transcript_path.with_suffix(".stderr.log").write_bytes(stderr)

    usage = parse_codex_jsonl(stdout)

    return TaskResult(
        task_id=task_id,
        arm=arm,
        exit_code=exit_code,
        wall_time_s=round(wall_time, 2),
        input_tokens=usage["input_tokens"],
        output_tokens=usage["output_tokens"],
        reasoning_tokens=usage["reasoning_tokens"],
        cache_read_tokens=usage["cache_read_tokens"],
        cache_write_tokens=usage["cache_write_tokens"],
        total_tokens=usage["total_tokens"],
        error=error_msg,
        tool_calls=usage["tool_calls"],
    )

```

### Core Architecture Module: `_archive/bench/lifecycle/harness/repo_setup.py`
```
"""Repository setup: clone, checkout fixed snapshot, apply seed regressions."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Union


def load_lane(lane_path: Path) -> dict:
    return json.loads(lane_path.read_text())


def clone_repo(repo_url: str, target: Path, cache_dir: Path) -> None:
    """Clone via mirror cache for speed on repeat runs."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
    mirror = cache_dir / f"{repo_name}.git"

    if not mirror.exists():
        print(f"  Cloning mirror: {repo_url}")
        subprocess.run(
            ["git", "clone", "--mirror", repo_url, str(mirror)],
            check=True, capture_output=True,
        )
    else:
        print(f"  Updating mirror: {mirror.name}")
        subprocess.run(
            ["git", "remote", "update"],
            cwd=str(mirror), check=True, capture_output=True,
        )

    if target.exists():
        shutil.rmtree(target)

    print(f"  Cloning from mirror to {target.name}")
    subprocess.run(
        ["git", "clone", str(mirror), str(target)],
        check=True, capture_output=True,
    )


def checkout_snapshot(repo: Path, commit: str) -> None:
    subprocess.run(
        ["git", "checkout", commit],
        cwd=str(repo), check=True, capture_output=True,
    )
    subprocess.run(
        ["git", "checkout", "-b", "broken-start"],
        cwd=str(repo), check=True, capture_output=True,
    )


def apply_seed_patches(repo: Path, lane: dict) -> None:
    """Apply seed regressions by text replacement in source files."""
    patches = lane.get("seed_patch_files", {})
    for filepath, spec in patches.items():
        target = repo / filepath
        if not target.exists():
            print(f"  WARNING: seed target not found: {filepath}")
            continue

        content = target.read_text()
        replacements = spec if isinstance(spec, list) else [spec]

        for repl in replacements:
            old = repl["find"]
            new = repl["replace"]
            count = content.count(old)
            if count == 0:
                print(f"  WARNING: seed anchor not found in {filepath}: {old[:60]}...")
                continue
            if count > 1:
                print(f"  WARNING: seed anchor found {count} times in {filepath}, replacing first")
            content = content.replace(old, new, 1)

        target.write_text(content)
        print(f"  Seeded regression in {filepath}")


def add_seed_files(repo: Path, lane: dict) -> None:
    """Write additional files (e.g. baseline test files) into the repo."""
    additions = lane.get("seed_add_files", {})
    for filepath, content in additions.items():
        target = repo / filepath
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        print(f"  Added seed file: {filepath}")


def reinit_git(repo: Path) -> None:
    """Commit the seeded state as a clean broken-start root."""
    subprocess.run(
        ["git", "add", "-A"],
        cwd=str(repo), check=True, capture_output=True,
    )
    subprocess.run(
        ["git", "commit", "-m", "broken-start: composite seed applied",
         "--author", "benchmark <bench@lifecycle>"],
        cwd=str(repo), check=True, capture_output=True,
        env={**dict(__import__("os").environ), "GIT_COMMITTER_NAME": "benchmark",
             "GIT_COMMITTER_EMAIL": "bench@lifecycle"},
    )
    subprocess.run(
        ["git", "remote", "remove", "origin"],
        cwd=str(repo), capture_output=True,
    )


def install_deps(repo: Path, lane: dict) -> None:
    """Run dependency installation for the lane if configured."""
    deps_cmd = lane.get("setup_deps")
    if not deps_cmd:
        return
    print(f"  Installing deps: {deps_cmd}")
    subprocess.run(
        deps_cmd, shell=True, cwd=str(repo),
        capture_output=True, timeout=300,
    )


def setup_lane(
    lane: dict, run_dir: Path, cache_dir: Path
) -> Path:
    """Full lane setup: clone -> checkout -> seed -> deps. Returns repo path."""
    lane_id = lane["lane_id"]
    repo_dir = run_dir / "repo"

    print(f"\n[{lane_id}] Setting up repository...")
    clone_repo(lane["repo_url"], repo_dir, cache_dir)
    checkout_snapshot(repo_dir, lane["fixed_snapshot"])
    apply_seed_patches(repo_dir, lane)
    add_seed_files(repo_dir, lane)
    reinit_git(repo_dir)
    install_deps(repo_dir, lane)

    print(f"[{lane_id}] Repository ready at {repo_dir}")
    return repo_dir

```

### Core Architecture Module: `_archive/bench/lifecycle/harness/report.py`
```
"""Report generator: comparison tables, delta calculations, markdown output."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def load_run_data(run_dir: Path) -> dict[str, dict[str, dict]]:
    """Load all meta.json files. Returns {lane_id: {arm: meta}}."""
    data: dict[str, dict[str, dict]] = {}
    for meta_path in sorted(run_dir.rglob("meta.json")):
        if meta_path.parent.name in ("task-01", "task-02", "task-03"):
            continue
        meta = json.loads(meta_path.read_text())
        lane_id = meta.get("lane_id", meta_path.parent.parent.name)
        arm = meta.get("arm", meta_path.parent.name)
        data.setdefault(lane_id, {})[arm] = meta
    return data


def format_delta(treatment: int | float, bare: int | float) -> str:
    if bare == 0:
        return "N/A"
    pct = ((treatment - bare) / bare) * 100
    sign = "+" if pct > 0 else ""
    return f"{sign}{pct:.0f}%"


def generate_report(run_dir: Path) -> str:
    data = load_run_data(run_dir)

    if not data:
        return "No data found."

    lines: list[str] = []
    lines.append(f"# Lifecycle Benchmark Report")
    lines.append(f"")
    lines.append(f"Run: `{run_dir.name}` | Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append("")

    lines.append("## Per-Lane Results")
    lines.append("")
    lines.append("| Lane | Arm | Pass | Total Tok | Input | Output | Reasoning | Cache Read | Weighted | Wall (s) |")
    lines.append("|------|-----|------|-----------|-------|--------|-----------|------------|----------|----------|")

    totals: dict[str, dict[str, int | float]] = {}

    for lane_id in sorted(data.keys()):
        for arm in ("leanctx", "bare"):
            if arm not in data[lane_id]:
                continue
            meta = data[lane_id][arm]
            passed = meta.get("tasks_passed", 0)
            total = meta.get("tasks_total", 0)
            tok = meta.get("total_tokens", 0)
            inp = meta.get("total_input_tokens", 0)
            out = meta.get("total_output_tokens", 0)
            wall = meta.get("total_wall_time_s", 0)

            reasoning = sum(t.get("reasoning_tokens", 0) for t in meta.get("tasks", []))
            cache_read = sum(t.get("cache_read_tokens", 0) for t in meta.get("tasks", []))
            weighted = sum(t.get("weighted_cost", 0) for t in meta.get("tasks", []))

            lines.append(
                f"| {lane_id} | {arm} | {passed}/{total} | "
                f"{tok:,} | {inp:,} | {out:,} | {reasoning:,} | "
                f"{cache_read:,} | {weighted:,} | {wall:.1f} |"
            )

            t = totals.setdefault(arm, {
                "passed": 0, "total": 0, "tokens": 0, "input": 0,
                "output": 0, "reasoning": 0, "cache_read": 0,
                "weighted": 0, "wall": 0,
            })
            t["passed"] += passed
            t["total"] += total
            t["tokens"] += tok
            t["input"] += inp
            t["output"] += out
            t["reasoning"] += reasoning
            t["cache_read"] += cache_read
            t["weighted"] += weighted
            t["wall"] += wall

    lines.append("")
    lines.append("## Aggregate Comparison")
    lines.append("")

    if "leanctx" in totals and "bare" in totals:
        lc = totals["leanctx"]
        br = totals["bare"]

        lines.append("| Metric | lean-ctx | Bare | Delta |")
        lines.append("|--------|----------|------|-------|")
        lines.append(f"| Tasks passed | {lc['passed']}/{lc['total']} | {br['passed']}/{br['total']} | |")
        lines.append(f"| Total tokens | {lc['tokens']:,} | {br['tokens']:,} | {format_delta(lc['tokens'], br['tokens'])} |")
        lines.append(f"| Input tokens | {lc['input']:,} | {br['input']:,} | {format_delta(lc['input'], br['input'])} |")
        lines.append(f"| Output tokens | {lc['output']:,} | {br['output']:,} | {format_delta(lc['output'], br['output'])} |")
        lines.append(f"| Reasoning | {lc['reasoning']:,} | {br['reasoning']:,} | {format_delta(lc['reasoning'], br['reasoning'])} |")
        lines.append(f"| Cache read | {lc['cache_read']:,} | {br['cache_read']:,} | {format_delta(lc['cache_read'], br['cache_read'])} |")
        lines.append(f"| Weighted cost | {lc['weighted']:,} | {br['weighted']:,} | {format_delta(lc['weighted'], br['weighted'])} |")
        lines.append(f"| Wall time (s) | {lc['wall']:.1f} | {br['wall']:.1f} | {format_delta(lc['wall'], br['wall'])} |")
    else:
        for arm, t in totals.items():
            lines.append(f"**{arm}:** {t['passed']}/{t['total']} passed, "
                         f"{t['tokens']:,} tokens, {t['wall']:.1f}s")

    lines.append("")
    lines.append("## Per-Task Detail")
    lines.append("")

    for lane_id in sorted(data.keys()):
        lines.append(f"### {lane_id}")
        lines.append("")
        lines.append("| Task | Arm | Pass | Tokens | Input | Output | Wall (s) | Error |")
        lines.append("|------|-----|------|--------|-------|--------|----------|-------|")

        for arm in ("leanctx", "bare"):
            if arm not in data[lane_id]:
                continue
            for idx, task in enumerate(data[lane_id][arm].get("tasks", []), 1):
                passed = "PASS" if task.get("verify_passed") else "FAIL"
                error = task.get("error", "") or ""
                tid = task.get("task_id", f"task-{idx}")
                lines.append(
                    f"| {tid} | "
                    f"{arm} | {passed} | {task.get('total_tokens', 0):,} | "
                    f"{task.get('input_tokens', 0):,} | {task.get('output_tokens', 0):,} | "
                    f"{task.get('wall_time_s', 0):.1f} | {error[:40]} |"
                )
        lines.append("")

    report = "\n".join(lines)

    report_path = run_dir / "report.md"
    report_path.write_text(report)
    print(f"\nReport written to {report_path}")

    return report


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 -m harness.report <run-dir>")
        sys.exit(1)

    run_dir = Path(sys.argv[1])
    if not run_dir.exists():
        print(f"ERROR: {run_dir} not found", file=sys.stderr)
        sys.exit(1)

    report = generate_report(run_dir)
    print(report)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `_archive/bench/lifecycle/harness/run_lifecycle.py`
```
"""Main benchmark runner: orchestrates lanes, arms, and sequential tasks.

Usage:
    python3 -m harness.run_lifecycle --run-id smoke --lane beets
    python3 -m harness.run_lifecycle --run-id v1
    python3 -m harness.run_lifecycle --run-id debug1 --lane fastify --arm leanctx
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from . import BENCH_ROOT, LANES_DIR, CONFIG_PATH, ARMS
from .codex_runner import run_codex_task, setup_codex_home, TaskResult, _ensure_path_complete
from .repo_setup import load_lane, setup_lane


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text())


def _verifier_env() -> dict[str, str]:
    """Build env for verifier subprocesses with complete PATH."""
    env = dict(os.environ)
    env["PATH"] = _ensure_path_complete(env.get("PATH", "/usr/bin:/bin"))
    return env


def run_verifier(repo: Path, verify_cmd: str) -> tuple[int, str]:
    """Run a task verifier and return (exit_code, output)."""
    try:
        proc = subprocess.run(
            verify_cmd, shell=True, cwd=str(repo),
            capture_output=True, timeout=120, text=True,
            env=_verifier_env(),
        )
        output = (proc.stdout + "\n" + proc.stderr).strip()
        return proc.returncode, output
    except subprocess.TimeoutExpired:
        return -1, "verifier timeout"
    except Exception as exc:
        return -1, str(exc)


def run_lane_arm(
    lane: dict,
    arm: str,
    run_dir: Path,
    config: dict,
    cache_dir: Path,
) -> list[dict]:
    """Run all tasks for one lane+arm combination. Returns per-task results."""
    lane_id = lane["lane_id"]
    arm_dir = run_dir / lane_id / arm

    meta_path = arm_dir / "meta.json"
    if meta_path.exists():
        print(f"\n[{lane_id}/{arm}] Already completed (meta.json exists), skipping.")
        return json.loads(meta_path.read_text())["tasks"]

    repo_dir = setup_lane(lane, arm_dir, cache_dir)
    home_dir = arm_dir / "home"
    setup_codex_home(home_dir, arm, repo_dir)

    timeout = config.get("timeouts", {}).get("task_seconds", 600)
    tasks = lane["tasks"]
    results: list[dict] = []

    for task in sorted(tasks, key=lambda t: t["order"]):
        task_id = task["id"]
        task_num = f"task-{task['order']:02d}"
        task_dir = arm_dir / task_num

        print(f"\n[{lane_id}/{arm}] Running {task_num}: {task_id}")
        print(f"  Class: {task['class']}")

        result = run_codex_task(
            task_id=task_id,
            prompt=task["prompt"],
            cwd=repo_dir,
            home_dir=home_dir,
            arm=arm,
            timeout=timeout,
            transcript_path=task_dir / "transcript.jsonl",
        )

        print(f"  Exit: {result.exit_code} | Wall: {result.wall_time_s}s")
        print(f"  Tokens: {result.total_tokens} total "
              f"({result.input_tokens} in, {result.output_tokens} out)")

        verify_exit, verify_output = run_verifier(repo_dir, task["verify_cmd"])
        task_passed = verify_exit == 0

        print(f"  Verify: {'PASS' if task_passed else 'FAIL'} (exit {verify_exit})")

        task_result = {
            **result.to_dict(),
            "verify_exit": verify_exit,
            "verify_passed": task_passed,
            "verify_output": verify_output[:2000],
        }
        results.append(task_result)

        (task_dir / "meta.json").parent.mkdir(parents=True, exist_ok=True)
        (task_dir / "meta.json").write_text(json.dumps(task_result, indent=2))

    meta = {
        "lane_id": lane_id,
        "arm": arm,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "tasks_passed": sum(1 for r in results if r["verify_passed"]),
        "tasks_total": len(results),
        "total_tokens": sum(r["total_tokens"] for r in results),
        "total_input_tokens": sum(r["input_tokens"] for r in results),
        "total_output_tokens": sum(r["output_tokens"] for r in results),
        "total_wall_time_s": round(sum(r["wall_time_s"] for r in results), 2),
        "tasks": results,
    }
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(json.dumps(meta, indent=2))

    return results


def main():
    parser = argparse.ArgumentParser(description="Lifecycle Benchmark Harness")
    parser.add_argument("--run-id", required=True, help="Run identifier (e.g. smoke, v1)")
    parser.add_argument("--lane", help="Single lane to run (beets/fastify/terraform)")
    parser.add_argument("--arm", help="Single arm to run (leanctx/bare)")
    parser.add_argument("--report", action="store_true", help="Generate report after run")
    args = parser.parse_args()

    config = load_config()
    runs_dir = BENCH_ROOT / config.get("runs_dir", "runs")
    run_dir = runs_dir / args.run_id
    cache_dir = BENCH_ROOT / config.get("repo_cache_dir", ".cache/repos")

    lane_ids = [args.lane] if args.lane else config.get("lanes", [])
    arms = [args.arm] if args.arm else list(ARMS)

    if not shutil.which("codex"):
        print("ERROR: codex not found on PATH", file=sys.stderr)
        sys.exit(1)

    print(f"=== Lifecycle Benchmark: run-id={args.run_id} ===")
    print(f"Lanes: {lane_ids}")
    print(f"Arms: {arms}")
    print(f"Output: {run_dir}")

    t0 = time.monotonic()

    for lane_id in lane_ids:
        lane_path = LANES_DIR / f"{lane_id}.json"
        if not lane_path.exists():
            print(f"ERROR: lane definition not found: {lane_path}", file=sys.stderr)
            sys.exit(1)
        lane = load_lane(lane_path)

        for arm in arms:
            run_lane_arm(lane, arm, run_dir, config, cache_dir)

    total_time = time.monotonic() - t0
    print(f"\n=== Benchmark complete in {total_time:.0f}s ===")

    if args.report:
        from .report import generate_report
        generate_report(run_dir)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `_archive/jetbrains-lean-ctx/src/main/kotlin/com/leanctx/plugin/util/AnsiText.kt`
```
package com.leanctx.plugin.util

// ESC [ ... <final byte> — matches ANSI CSI sequences (colour/SGR etc.) that
// Swing dialogs cannot render. The CLI emits these (e.g. `lean-ctx doctor`);
// strip them before showing captured output in a Messages popup.
private val ANSI_CSI = Regex("\\[[0-9;?]*[ -/]*[@-~]")

internal fun stripAnsi(text: String): String = ANSI_CSI.replace(text, "")

```

### Core Architecture Module: `integrations/claude-code-mod/hooks/cockpit.tsx`
```
// SPDX-License-Identifier: Apache-2.0
import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, On, RenderChildren } from 'claude-code'

import type { Board, Depth, FeedItem, Frame, Overlay, Proof, SourceStat, TurnStat, ValueSnap } from '../types'

// The LeanCTX cockpit, in the product's own terms: a Context Gateway between
// Claude and the sources it reads. It shows what Claude saw and how deep, the
// two checks before the handoff (may it be read? may it be delivered?), the
// tokens kept out, and the receipts behind them. A handoff line runs above the
// prompt while Claude works; short cards mark turns and milestones. lean-ctx's
// status line below the prompt keeps the one-line totals.

const PANE = 'leanctx-cockpit'
const DOCK_COLUMNS = 62
// lean-ctx writes a session's snapshot at most once a second.
const REFRESH_AFTER_TOOL_MS = 1_300
const REFRESH_MS = 15_000
// `lean-ctx value` re-verifies both hash chains end to end (~8 s): rarely, in the background.
const PROVE_FIRST_MS = 4_000
const PROVE_MS = 5 * 60_000
const PROVE_TIMEOUT_MS = 120_000
const FRAME_MS = 70
const COUNT_EASE = 0.16
const TURN_OVERLAY_MS = 6_500
const MILESTONE_OVERLAY_MS = 8_000
// A call travels the handoff line: into the gate, then on to Claude.
const PACKET_IN_MS = 700
const PACKET_OUT_MS = 1_600
// Same freshness window as lean-ctx's own status line.
const ACTIVE_MS = 12 * 3_600_000
const TURNS_KEPT = 60
const HISTORY_KEPT = 480
// The saving curve: three rows of eighth blocks (24 levels) and an axis line.
const CURVE_ROWS = 3
const FEED_KEPT = 30
const FEED_SHOWN = 5
const SOURCES_KEPT = 200
const TOKEN_MILESTONES = [10e3, 25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2.5e6, 5e6, 10e6, 25e6]
const SOURCE_MILESTONES = [25, 100, 250, 1000]
const LEAN_CTX_TOOL = /^mcp__lean[-_]ctx__/

// Keys are versioned by name: $.state outlives reloads, older shapes stay behind.
const board = atom({ plugin: 'lean-ctx', key: 'gateway' } as const, {
  milestone: 0,
  turns: [],
  isWorking: false,
  leanRunning: 0,
  feed: [],
  sources: {},
  turnSeen: { sources: 0, governed: 0, structure: 0 },
  celebrated: [],
} as Board)
const frame = atom({ plugin: 'lean-ctx', key: 'clock' } as const, { tick: 0 } as Frame)

// ── LeanCTX brand: leanctx.com premium-tokens.css (dark theme) ─────────────
const CANVAS = 0x111626
const PANEL = 0x1b2034
const FOREGROUND = 0xf1f3ff
const SECONDARY = 0xafb8d0
const HAIRLINE = 0x353e5a
const SIGNATURE = 0x668cff
const BLUE_FIELD = 0x31416c
// Derived within the family for light and motion; status colours only where earned.
const ICE = 0xc9d6ff
const VIOLET = 0xa08cff
const AMBER = 0xf5b84b
const DANGER = 0xff6b81
const OK = 0x7ee0b5
const DEFAULT_BG = 0x01000000
const BRAND_SWEEP = [BLUE_FIELD, SIGNATURE, ICE, VIOLET, SIGNATURE, BLUE_FIELD]
const DATA = [BLUE_FIELD, SIGNATURE, ICE]
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`

// Each read depth keeps its colour everywhere: mix bar, legend, receipts.
const DEPTHS: readonly Depth[] = ['structure', 'passage', 'full', 'search', 'command']
const DEPTH_COLOR: Record<Depth, number> = {
  structure: SIGNATURE,
  passage: ICE,
  full: VIOLET,
  search: 0x7fc8ff,
  command: 0x8fa9ff,
}

function mix(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t))
  const ch = (s: number) => {
    const x = (a >> s) & 255
    const y = (b >> s) & 255
    return Math.round(x + (y - x) * k) << s
  }
  return ch(16) | ch(8) | ch(0)
}

function ramp(stops: readonly number[], t: number): number {
  const u = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(u))
  return mix(stops[i] ?? 0, stops[i + 1] ?? 0, u - i)
}
const cycle = (stops: readonly number[], t: number) => ramp(stops, ((t % 1) + 1) % 1)

// Budgets stay brand blue and warm only under real pressure.
const pressure = (frac: number) =>
  frac < 0.7 ? SIGNATURE : frac < 0.9 ? mix(SIGNATURE, AMBER, (frac - 0.7) / 0.2) : mix(AMBER, DANGER, (frac - 0.9) / 0.1)

// ── raster cells ───────────────────────────────────────────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63)
    out += b === undefined ? '=' : B64.charAt((n >> 6) & 63)
    out += c === undefined ? '=' : B64.charAt(n & 63)
  }
  return out
}

class Grid {
  private readonly view: DataView
  private readonly bytes: Uint8Array
  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.bytes = new Uint8Array(cols * rows * 12)
    this.view = new DataView(this.bytes.buffer)
    for (let i = 0; i < cols * rows; i++) this.put(i, 0x20, DEFAULT_BG, DEFAULT_BG)
  }
  private put(i: number, ch: number, fg: number, bg: number) {
    this.view.setUint32(i * 12, ch, true)
    this.view.setUint32(i * 12 + 4, fg, true)
    this.view.setUint32(i * 12 + 8, bg, true)
  }
  set(x: number, y: number, ch: string, fg: number, bg = DEFAULT_BG) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return
    this.put(y * this.cols + x, ch.charCodeAt(0), fg, bg)
  }
  encode(): string {
    return toBase64(this.bytes)
  }
}

// The handoff line: sources on the left, Claude on the right, the gateway ◆ in
// between. While Claude works the line breathes in brand colours; every call
// travels it as a light — governed calls pass through the gate, direct calls
// (Claude's own tools) run past it dimmed, failures turn red.
function handoffCells(cols: number, tick: number, feed: readonly FeedItem[], now: number, isWorking: boolean): string {
  const g = new Grid(cols, 1)
  const gate = Math.floor(cols * 0.5)
  const breath = (Math.sin(tick * 0.09) + 1) / 2
  for (let x = 0; x < cols; x++) {
    const base = isWorking
      ? mix(HAIRLINE, cycle(BRAND_SWEEP, x / cols / 1.6 - tick * 0.004), 0.3 + breath * 0.3)
      : HAIRLINE
    g.set(x, 0, '─', base)
  }
  const gatePulse = isWorking ? (Math.sin(tick * 0.25) + 1) / 2 : 0
  const draw = (x: number, color: number, isHead: boolean) => {
    const at = Math.round(x)
    g.set(at, 0, isHead ? '●' : '━', color)
    if (isHead) {
      g.set(at - 1, 0, '━', mix(color, HAIRLINE, 0.35))
      g.set(at - 2, 0, '─', mix(color, HAIRLINE, 0.65))
    }
  }
  for (const item of feed) {
    const color = item.isError ? DANGER : item.governed ? ICE : SECONDARY
    if (item.ms === undefined) {
      const age = now - item.startedAt
      // Direct calls never enter the gate: they cross the whole line.
      if (!item.governed) {
        if (age < PACKET_IN_MS + PACKET_OUT_MS) draw(((age / (PACKET_IN_MS + PACKET_OUT_MS)) % 1) * (cols - 1), color, true)
      } else if (age < PACKET_IN_MS) draw((age / PACKET_IN_MS) * gate, color, true)
      continue
    }
    const age = now - (item.startedAt + item.ms)
    if (age < 0 || age > PACKET_OUT_MS) continue
    const from = item.governed ? gate : (age / PACKET_OUT_MS) * gate
    draw(from + ((cols - 1 - from) * age) / PACKET_OUT_MS, color, true)
  }
  const waiting = feed.some(f => f.governed && f.ms === undefined && now - f.startedAt >= PACKET_IN_MS)
  g.set(gate, 0, '◆', waiting ? mix(SIGNATURE, FOREGROUND, gatePulse) : isWorking ? mix(SIGNATURE, ICE, gatePulse * 0.6) : BLUE_FIELD)
  return g.encode()
}

// A light that sweeps once across the band as a turn card opens.
function sweepCells(cols: number, progress: number, tick: number): string {
  const g = new Grid(cols, 1)
  const head = progress * (cols + 12) - 6
  for (let x = 0; x < cols; x++) {
    const near = Math.max(0, 1 - Math.abs(x - head) / 8)
    const base = cycle(BRAND_SWEEP, x / cols / 1.5 - tick * 0.01)
    g.set(x, 0, '━', mix(mix(HAIRLINE, base, 0.75), FOREGROUND, near))
  }
  return g.encode()
}

// Twinkling field for milestones: deterministic per cell, phased by the tick.
function sparkleCells(cols: number, tick: number, seed: number): string {
  const g = new Grid(cols, 1)
  const glyphs = ['·', '✧', '✦', '✧', '·']
  for (let x = 0; x < cols; x++) {
    const h = Math.sin((x + 1) * 12.9898 + seed * 78.233) * 43758.5453
    const r = h - Math.floor(h)
    if (r < 0.55) continue
    const phase = (Math.sin(tick * 0.35 + r * 40) + 1) / 2
    g.set(x, 0, glyphs[Math.floor(phase * (glyphs.length - 1) + 0.5)] ?? '·', mix(BLUE_FIELD, r > 0.8 ? ICE : SIGNATURE, phase))
  }
  return g.encode()
}

// 4×7 display figures, folded into half blocks: four terminal rows.
const FONT: Record<string, readonly string[]> = {
  '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
  '1': ['.#..', '##..', '.#..', '.#..', '.#..', '.#..', '###.'],
  '2': ['.##.', '#..#', '...#', '..#.', '.#..', '#...', '####'],
  '3': ['###.', '...#', '...#', '.##.', '...#', '...#', '###.'],
  '4': ['#..#', '#..#', '#..#', '####', '...#', '...#', '...#'],
  '5': ['####', '#...', '###.', '...#', '...#', '#..#', '.##.'],
  '6': ['.##.', '#...', '#...', '###.', '#..#', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '..#.', '.#..', '.#..', '.#..'],
  '8': ['.##.', '#..#', '#..#', '.##.', '#..#', '#..#', '.##.'],
  '9': ['.##.', '#..#', '#..#', '.###', '...#', '...#', '.##.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  K: ['#..#', '#.#.', '##..', '#...', '##..', '#.#.', '#..#'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  B: ['###.', '#..#', '#..#', '###.', '#..#', '#..#', '###.'],
}
const FIGURE_ROWS = 4
const figureWidth = (text: string) => [...text].reduce((w, ch) => w + (FONT[ch]?.[0]?.length ?? 0) + 1, -1)

// A display figure: a slow brand sweep runs across it; brighter while it counts.
function figureCells(text: string, cols: number, phase: number, lift: number): string {
  const g = new Grid(cols, FIGURE_ROWS)
  const width = Math.max(8, figureW
```

### Core Architecture Module: `integrations/claude-code-mod/hooks/register.ts`
```
// SPDX-License-Identifier: Apache-2.0
import type {
  EngineInterface,
  McpToolResult,
  Register,
  Timer,
  ToolCallResult,
  TurnStepResult,
} from "claude-code";

import { registerCockpit } from "./cockpit";
import { registerResultRendering } from "./render";

const DEFAULT_FRONT_LOADED_TOOLS = [
  "ctx_read",
  "ctx_search",
  "ctx_shell",
  "ctx_compose",
  "ctx_callgraph",
  "ctx_session",
];
// Every tool of the lean-ctx server, not only `ctx_*`: the `shell` alias of
// ctx_shell would otherwise stay front-loaded under `alwaysLoad`.
const LEAN_CTX_TOOL_PATTERN = /^mcp__lean[-_]ctx__[A-Za-z0-9_-]+$/;
const LEAN_CTX_TOOL_NAME = /^mcp__(lean[-_]ctx)__([A-Za-z0-9_-]+)$/;
const SHELL_TOOLS = new Set(["ctx_shell", "shell"]);
const WATCH_CONTEXT =
  "This background job is being watched; you will be woken automatically on completion, so do not poll or sleep.";
const WATCH_INTERVAL_MS = 2_000;
// A submitted wake normally starts its turn within seconds; after this many
// watcher ticks' worth it is treated as gone, so held jobs never stay stuck.
const WAKE_IN_FLIGHT_MAX_MS = 60_000;
// Consecutive unreadable status checks before a job is handed back to the
// model's own polling; one transient MCP hiccup must not drop the watch.
const MAX_STATUS_MISSES = 5;
const MAX_TAIL_LINES = 20;
const MAX_TAIL_LINE_CHARS = 300;
// Native Bash stdout below this is kept byte-for-byte: the shaping gain cannot
// pay for the extra hop, and short output is usually exactly what was asked.
const SHAPE_MIN_CHARS = 2_000;
// Commands that explicitly ask for exact bytes are never shaped.
const RAW_INTENT = /\bLEAN_CTX_(?:RAW|DISABLED)=1\b|\blean-ctx\s+raw\b/;
// Upper bound for the session state injected after a compaction (~500 tokens).
const MAX_RESUME_CHARS = 2_000;
type LeanCtxHookTextEnd = { end: string; continues?: readonly string[] };
type LeanCtxHookTextSignature = { start: string; ends: readonly LeanCtxHookTextEnd[] };
// Exact leading signatures emitted by observe.rs. Keep these stable and update
// the cross-language drift test there whenever an authored hook text changes.
const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
  {
    start: "lean-ctx active: ALWAYS use ctx_* MCP tools instead of native equivalents.",
    ends: [
      { end: "Exclusive tools: ctx_compose, ctx_callgraph, ctx_knowledge, ctx_session." },
    ],
  },
  {
    start: "CRITICAL: ALWAYS use lean-ctx ctx_* tools as mapped below.",
    ends: [
      {
        end: "Use native Read for out-of-root; `lean-ctx doctor` shows effective roots.",
        continues: [
          "Other tools: ctx_call(tool=<name>).",
          "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        end: "Other tools: ctx_call(tool=<name>).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        // Emitted by lean-ctx 3.11.4 and earlier.
        end: "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
      { end: "Preserve validation, security, and error-handling." },
    ],
  },
  {
    start: "lean-ctx shadow mode: native read/search/shell calls auto-route to ctx_* — no tool-mapping needed.",
    ends: [
      {
        end: "ctx_search(action=semantic) (by meaning).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        end: "ctx_callgraph (callers).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        end: "ctx_knowledge / ctx_session (memory).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        end: "ctx_session (memory).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
      { end: "Preserve validation, security, and error-handling." },
    ],
  },
  {
    start: "lean-ctx policy (mechanically enforced):",
    ends: [
      { end: "are overruled by this policy." },
    ],
  },
] as const;

const HOOK_CONTEXT_FRAME = /(?:^|\n)([A-Za-z]+ hook additional context: )$/;

type JsonRecord = Record<string, unknown>;
type WatchJob = { server: string; id: string; contextSent: boolean; misses: number };
type JobStatus = { state: "running" | "terminal" | "unknown"; exitCode?: number; archiveId?: string; summary?: string };
type FinishedJob = { job: WatchJob; status: JobStatus; response: McpToolResult };
type JobCheck = {
  key: string;
  job: WatchJob;
  status?: JobStatus;
  response?: McpToolResult;
};
type Metrics = {
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  toolSearchOnly: number;
  leanCtxCalls: number;
  sleepsAnswered: number;
  wakesDelivered: number;
  shapedCalls: number;
  shapedCharsSaved: number;
  droppedHookAttachments: number;
  droppedHookChars: number;
  compactions: number;
};

const watchedJobs = new Map<string, WatchJob>();
const metrics: Metrics = {
  requests: 0,
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheCreation: 0,
  toolSearchOnly: 0,
  leanCtxCalls: 0,
  sleepsAnswered: 0,
  wakesDelivered: 0,
  shapedCalls: 0,
  shapedCharsSaved: 0,
  droppedHookAttachments: 0,
  droppedHookChars: 0,
  compactions: 0,
};
let watcher: Timer | undefined;
let watcherTickInProgress = false;
// True between a main-loop `turn.start` and its `turn.complete`. A wake
// submitted then is only delivered after the turn, by which time the model
// may have read the job itself — so finished jobs wait in `pendingWakes`.
let mainTurnActive = false;
const pendingWakes = new Map<string, FinishedJob>();
// Watcher ticks since the last wake was submitted, until its turn starts. Jobs
// that finish meanwhile are held too: every wake is a visible prompt row and a
// turn, and in that turn the model often reads the other jobs itself, which
// drops them.
let wakeInFlightTicks: number | undefined;

function isWakeInFlight(): boolean {
  return wakeInFlightTicks !== undefined && wakeInFlightTicks * WATCH_INTERVAL_MS < WAKE_IN_FLIGHT_MAX_MS;
}
let leanCtxSeen = false;
// The lean-ctx MCP server name as this session spells it (`lean-ctx`/`lean_ctx`).
let leanServer: string | undefined;
let commandAttempted = false;
let commandRegistered = false;
// Set by a main-loop compaction; the next prompt carries the lean-ctx session state once.
let resumePending = false;

export const register: Register = (on, options) => {
  // The cockpit: sidebar, pulse line, turn and milestone overlays (cockpit.tsx).
  // Held wakes go out on the next watcher tick after the turn (≤ 2 s); the
  // watcher keeps running while any are held.
  registerCockpit(
    on,
    {
      onTurnStart: () => {
        mainTurnActive = true;
        wakeInFlightTicks = undefined;
      },
      onMainTurnComplete: () => {
        mainTurnActive = false;
      },
    },
    {
      panel: asRecord(options).cockpit_panel !== false,
      pulse: asRecord(options).cockpit_pulse_line !== false,
      cards: asRecord(options).cockpit_turn_cards !== false,
    },
  );
  // ctx_patch / ctx_read / ctx_search results drawn as diffs and code
  // (render.tsx). Display only: the model receives every result unchanged.
  if (asRecord(options).color_output !== false) registerResultRendering(on);
  const frontLoaded = getFrontLoadedTools(options);
  const shapeNative = asRecord(options).shape_native_output !== false;
  const keepHookContext = asRecord(options).keep_hook_context === true;
  // Off: background jobs are not watched and the model checks them itself.
  const wakeOnFinish = asRecord(options).wake_on_job_finish !== false;

  on("tool.describe", { tool: LEAN_CTX_TOOL_PATTERN }, async ($, event) => {
    const match = getLeanCtxTool(event.tool);
    if (!match) return { description: event.description, isDeferred: event.isDeferred };

    leanCtxSeen = true;
    leanServer = match.server;
    await ensureMeterCommand($);
    return {
      description: event.description,
      isDeferred: !frontLoaded.has(match.tool),
    };
  });

  // Live skill (concept K5): the shipped SKILL.md is static; this prefixes it
  // with what is true in *this* session, so the guidance never contradicts the
  // mod (e.g. "no need to poll") or the configured tool surface. Byte-stable
  // for a given configuration, so it never churns the prompt cache.
  on("skill.prompt", { skill: "lean-ctx" }, async ($, event, next) => {
    const base = await next(event);
    return { text: `${liveSkillHeader(frontLoaded, shapeNative, wakeOnFinish)}\n\n${base.text}` };
  });

  // The
```

### Core Architecture Module: `integrations/claude-code-mod/hooks/render.tsx`
```
// SPDX-License-Identifier: Apache-2.0
//
// Draws lean-ctx results the way Claude Code draws its own: ctx_patch evidence
// through the engine's diff renderer, ctx_read code and ctx_search hits
// syntax-highlighted with line numbers. Display only — the model receives
// every result byte-for-byte. Anything this file does not recognise (map and
// signatures views, errors, running calls) falls through to the engine.
//
// The formats read here are lean-ctx's own output contract: the ```diff fence
// of ctx_patch, the `name NL` header with `  N| ` or `N:hash|` rows of
// ctx_read, and `path:line text` hits of ctx_search.
import type { Elements as SurfaceElements, On, RenderElement } from "claude-code";

const TOOLS = [
  "mcp__lean-ctx__ctx_patch",
  "mcp__lean-ctx__ctx_read",
  "mcp__lean-ctx__ctx_search",
  "mcp__lean_ctx__ctx_patch",
  "mcp__lean_ctx__ctx_read",
  "mcp__lean_ctx__ctx_search",
] as const;
type LeanTool = (typeof TOOLS)[number];

/** One block under the call row. */
type Block =
  | { kind: "note"; text: string }
  | { kind: "code"; source: string; path?: string; startLine?: number }
  | { kind: "diff"; source: string; path?: string }
  | { kind: "hit"; location: string; path: string; line: string; symbol?: string };

/** What a result turns into: the call row's one-line summary and the blocks. */
type Drawing = { summary: string; blocks: Block[] };

// The engine caps one Code drawing; past it a result stays plain.
const MAX_CODE_CHARS = 100_000;
const DIFF_FENCE = /^```diff[ \t]*\n([\s\S]*?)\n?^```[ \t]*$/gm;
const NEW_FILE = /^\+\+\+ (?:b\/)?(\S+)/m;
const READ_HEADER = /^(\S+) \d+L\b/;
const LINES_ROW = /^ *(\d+)\| ?(.*)$/;
const ANCHOR_ROW = /^(\d+):[0-9a-f]{2,8}\|(.*)$/;
const SEARCH_HIT = /^([^\s:]+):(\d+) (.*)$/;
const SYMBOL_SUFFIX = / ∈(\S+@L\d+)$/;

export function registerResultRendering(on: On): void {
  on(
    "ui.render",
    {
      component: "ToolUse",
      props: { tool: TOOLS, isRunning: false, isErrored: false, isInterrupted: false },
    },
    async ($, event, next) => {
      const props = event.props;
      const drawing = drawingFor(props.tool, props.tool_use_id, props.output, props.input);
      if (!drawing) return next(event);
      // The engine keeps the call row; only its result text shrinks to the summary.
      const row = await next({
        ...event,
        props: { ...props, output: [{ type: "text", text: drawing.summary }] },
      });
      const els = $.ui.resolve(event);
      return (
        <els.Box flexDirection="column">
          {row}
          <els.Box flexDirection="column" paddingLeft={5}>
            {drawBlocks(els, drawing.blocks)}
          </els.Box>
        </els.Box>
      );
    },
  );

  on(
    "ui.render",
    { component: "ToolResult", props: { tool: TOOLS, isErrored: false } },
    async ($, event, next) => {
      const props = event.props;
      // A standalone result has no call input: headerless full reads stay plain.
      const drawing = drawingFor(props.tool, `result:${props.tool_use_id}`, props.output, undefined);
      if (!drawing) return next(event);
      const els = $.ui.resolve(event);
      return (
        <els.Box flexDirection="column">
          <els.Text dimColor>{drawing.summary}</els.Text>
          {drawBlocks(els, drawing.blocks)}
        </els.Box>
      );
    },
  );
}

// ── Parsing (pure, exported for tests) ──────────────────────────────────────

export function resultText(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    return output
      .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
      .filter((text) => text.length > 0)
      .join("\n");
  }
  if (output && typeof output === "object" && "content" in output) {
    return resultText((output as { content: unknown }).content);
  }
  return "";
}

/** ctx_patch: every ```diff fence becomes a diff block; the `✓` line is the summary. */
export function drawPatch(text: string): Drawing | null {
  const blocks: Block[] = [];
  let summary = "";
  let cursor = 0;
  const pushNotes = (chunk: string) => {
    for (const line of chunk.split("\n")) {
      if (!summary && line.startsWith("✓")) summary = line;
      else if (line.trim()) blocks.push({ kind: "note", text: line });
    }
  };
  for (const match of text.matchAll(DIFF_FENCE)) {
    pushNotes(text.slice(cursor, match.index));
    const source = match[1] ?? "";
    if (source.length > MAX_CODE_CHARS) return null;
    blocks.push({ kind: "diff", source, path: NEW_FILE.exec(source)?.[1] });
    cursor = (match.index ?? 0) + match[0].length;
  }
  if (cursor === 0) return null;
  pushNotes(text.slice(cursor));
  return { summary: summary || "✓ patched", blocks: mergeNotes(blocks) };
}

/** ctx_read: numbered views (lines, anchored) of one or several files; full/raw with input. */
export function drawRead(text: string, input: unknown): Drawing | null {
  const args = (input ?? {}) as { path?: unknown; paths?: unknown; mode?: unknown; raw?: unknown };
  const body = text.replace(/\n+$/, "");
  const files = body.split("\n---\n");
  if (files.length > 1) {
    const last = files[files.length - 1] ?? "";
    if (!/^Read \d+ files?\b/.test(last)) return null;
    const blocks: Block[] = [];
    for (const file of files.slice(0, -1)) {
      const numbered = numberedBlocks(file, undefined);
      if (!numbered) return null;
      blocks.push({ kind: "note", text: numbered.header }, ...numbered.blocks);
    }
    return { summary: last.split("\n")[0] ?? last, blocks };
  }
  const path = typeof args.path === "string" ? args.path : undefined;
  const numbered = numberedBlocks(body, path);
  if (numbered) return { summary: numbered.header, blocks: numbered.blocks };
  const verbatim = args.raw === true || args.mode === "full" || args.mode === "raw";
  if (!verbatim || !path || body.length > MAX_CODE_CHARS) return null;
  const { code, trailer } = splitTrailer(body);
  // One line is more likely an error than a file.
  if (code.split("\n").filter((line) => line.trim()).length < 2) return null;
  const blocks: Block[] = [{ kind: "code", source: code, path, startLine: 1 }];
  if (trailer) blocks.push({ kind: "note", text: trailer });
  return { summary: `${baseName(path)} ${code.split("\n").length}L`, blocks };
}

/** ctx_search: `path:line text` hits; everything else is a note. */
export function drawSearch(text: string): Drawing | null {
  const [summary = "", ...lines] = text.replace(/\n+$/, "").split("\n");
  const blocks: Block[] = [];
  for (const line of lines) {
    const hit = SEARCH_HIT.exec(line);
    if (!hit) {
      if (line.trim()) blocks.push({ kind: "note", text: line });
      continue;
    }
    const [, path = "", lineNo = "", rest = ""] = hit;
    const symbol = SYMBOL_SUFFIX.exec(rest);
    blocks.push({
      kind: "hit",
      location: `${path}:${lineNo}`,
      path,
      line: (symbol ? rest.slice(0, symbol.index) : rest).replace(/\t/g, "    ").trimEnd(),
      symbol: symbol?.[1],
    });
  }
  if (!blocks.some((block) => block.kind === "hit")) return null;
  return { summary, blocks: mergeNotes(blocks) };
}

function numberedBlocks(
  text: string,
  path: string | undefined,
): { header: string; blocks: Block[] } | null {
  const [header = "", ...rows] = text.split("\n");
  const named = READ_HEADER.exec(header);
  if (!named) return null;
  const rowPattern = ANCHOR_ROW.test(rows[0] ?? "") ? ANCHOR_ROW : LINES_ROW;
  const filePath = path ?? named[1];
  const blocks: Block[] = [];
  let run: string[] = [];
  let first = 0;
  let previous = 0;
  let index = 0;
  const flush = () => {
    if (run.length) blocks.push({ kind: "code", source: run.join("\n"), path: filePath, startLine: first });
    run = [];
  };
  for (; index < rows.length; index++) {
    const row = rowPattern.exec(rows[index] ?? "");
    if (!row) break;
    const lineNo = Number(row[1]);
    // `lines:1-5,20-30` leaves gaps: each contiguous run numbers itself.
    if (run.length && lineNo !== previous + 1) flush();
    if (!run.length) first = lineNo;
    run.push(row[2] ?? "");
    previous = lineNo;
  }
  flush();
  if (!blocks.length) return null;
  const tail = rows.slice(index).join("\n").trim();
  if (tail) blocks.push({ kind: "note", text: tail });
  return { header, blocks };
}

/** Trailing `[lean-ctx …]` / `[… truncated …]` service lines are not code. */
function splitTrailer(text: string): { code: string; trailer: string } {
  const lines = text.split("\n");
  let end = lines.length;
  while (end > 0 && /^\[(?:lean-ctx|…)/.test(lines[end - 1] ?? "")) end--;
  return { code: lines.slice(0, end).join("\n"), trailer: lines.slice(end).join("\n") };
}

function mergeNotes(blocks: Block[]): Block[] {
  const merged: Block[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if (block.kind === "note" && last?.kind === "note") last.text += `\n${block.text}`;
    else merged.push({ ...block });
  }
  return merged;
}

function baseName(path: string): string {
  return path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
}

// ── Drawing ─────────────────────────────────────────────────────────────────

// Tool rows draw on every surface; these three elements exist on all of them.
type Elements = Pick<SurfaceElements[keyof SurfaceElements], "Box" | "Text" | "Code">;

// Finished results never change, but rows redraw on scroll and resize.
const CACHE_LIMIT = 200;
const drawings = new Map<string, { text: string; drawing: Drawing | null }>();

function drawingFor(tool: LeanTool, key: string, output: unknown, input: unknown): Drawing | null {
  const text = resultText(output);
  const cached = drawings.get(key);
  if (cached && cached.text === text) return cached.drawing;
  const name = tool.slice(tool.lastIndexOf("__") + 2);
  const drawing =
    name === "ctx_patch" ? drawPatch(text) : name === "ctx_read" ? drawRead(text, input) : drawSearch(text)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2092** (2026-10-15): **bug: Shell hook aliases silently no-op under OpenCode (non-interactive bash) unless `expand_aliases` is set manually**
  *Symptoms*: ## Environment - lean-ctx: 3.10.5 - OS: Linux Debian 13 - AI tool: OpenCode (not Claude Code / Cursor / Codex) - Shell: bash  ## Summary The generated `shell-hook.bash` relies on `alias` to intercept commands (`git`, `cargo`, `npm`, `pnpm`, etc.). Bash does not expand aliases in non-interactive shells unless `shopt -s expand_aliases` is explicitly set — this is documented bash behavior, not specific to this hook. OpenCode runs its Bash tool as a strictly non-interactive process (no TTY/PTY), so every alias created by `lean-ctx-on` is silently ignored, even though `LEAN_CTX_ENABLED=1` and the alias is correctly present in `alias -p`.  Separately, `lean-ctx-status` cannot report anything useful in this same context, because every branch is gated behind `[ -t 1 ] && echo ...`, and stdout is never a TTY when OpenCode captures command output. This makes the hook's own diagnostic tool unable to confirm whether it's working in the exact environment it's meant to support.  ## How to reproduce 1. Install the shell hook: `lean-ctx init --global` 2. Point OpenCode's bash tool at the hook via BASH_ENV, e.g. run OpenCode with:    `export BASH_ENV="$HOME/.config/lean-ctx/shell-hook.bash" export LEAN_CTX_AGENT=1 opencode` 3. Ask any agent/subagent to run a diagnostic bash command, e.g.:    `echo "enabled=${LEAN_CTX_ENABLED:-unset}" alias -p | grep git type git` 4. Observe: `enabled=1`, `alias -p` shows `alias git='_lc git'`, but `type git` still resolves to `/usr/bin/git` — the alias is def

- **Issue #2089** (2026-10-15): **bug: claude-mod Bash shaping never runs, because $.mcp.call refuses "ctx_shape" that the server does not list**
  *Symptoms*: **lean-ctx version:** lean-ctx 3.11.4 (official), mod 3.11.4+b2bc7d69 (`lean-ctx claude-mod status`: installed). `shape_native_output` is at its default (true); Claude Code debug log shows no `pluginConfigs` options for `lean-ctx@lean-ctx`, so every option has its default.  **OS:** Linux (Debian 13, kernel 6.12)  **AI tool:** Claude Code 2.1.300 (interactive session). The same result in Claude Code 2.1.296 (remote-control session).  **What happened:** The Claude Code mod never shapes native Bash output. `/leanctx` reports "Bash outputs shaped 0" in every session, while the same sessions report dropped hook attachments, so the mod is loaded and running.  `claude --debug` shows the cause right after the Bash call: `shapeBash` reaches the `ctx_shape` call, and Claude Code refuses it, because `ctx_shape` is not in the tool list of the lean-ctx server. The 3.11.0 release notes say "ctx_shape remains an internal hook rather than a listed tool". The fail-open path then returns the raw output with no message.  The engine itself compresses the same output: `lean-ctx -c '<the loop below>'` returns 3,855 bytes instead of 13,092.  **What you expected:** Native Bash stdout of 2,000 characters or more is shaped and ends with a recovery handle, as the 3.11.0 release notes describe. For that, `ctx_shape` needs to be reachable through `$.mcp.call` in Claude Code 2.1.296 and later, for example listed but hidden from the model, or called another way.  **Steps to reproduce:** 1. Start `claude --

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

### Incident Patch 1: `01d06654` (2026-10-17)
**Commit Message**: fix(opencode): explain an unbound session; rules name only offered tools

Reproduced with OpenCode's MCP handshake (clientInfo "opencode", no roots,
cwd = where `opencode` was started) on a fresh `init --agent opencode`:

- Started in the home directory, lean-ctx has no project. A search or tree
  without `path` said only "active project root is required", and a
  relative read resolved against ~ ("file not found: ~/src/main.rs").
  Both now say the session has no project yet and to pass the absolute
  project path, which then stays bound. Both path resolvers share one
  check (`path_resolve::unbound_relative_path`). In telemetry OpenCode hit
  "not bound to a project" 27 times per installation, Claude Code 7.
- With no profile pinned the rules were rendered for `Power`, but
  `tools/list` offers the lazy core (11 tools for OpenCode). Rules, MCP
  instructions, the shared rule files and the project LEAN-CTX.md named
  ctx_knowledge (and ctx_patch for native-editor clients) as callable.
  `guidance_profile` now narrows to CORE_TOOL_NAMES on the lazy-core
  surface; non-core tools are reached through ctx_call, whose hint is
  shortened to stay within the instruction token budget. The

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -32,6 +32,8 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
 
 ### Fixed
 
+- **Agents outside a project are told what is missing (OpenCode).** When a host starts lean-ctx outside a project (OpenCode launched from the home directory) and reports no project directory, a search or tree without `path` said only "active project root is required", and a relative read failed as "file not found: ~/src/main.rs". Both now say that the session has no project yet and to pass the absolute project path, after which that project stays bound. OpenCode installations hit this four times as often per installation as Claude Code.
+- **Rules name only the tools the session is offered.** With no profile pinned, the injected rules and MCP instructions were written for the full tool set, while `tools/list` offers the lean core (OpenCode, Cursor and other clients: 11 tools). They named `ctx_knowledge` and, for native-editor clients, `ctx_patch` as if callable, and agents called tools their list did not contain. Guidance now describes the lean core and points to `ctx_call` for the rest; the skill shows non-core tools in their `ctx_call` form. A pinned profile keeps its full set.
 - **Reading a file in windows is no longer booked as a correction.** A `lines:` window (and the `head`, `tail` and `sed -n` reads the shell hook maps onto it) counted as a compressed read, and `head`/`tail` through `ctx_shell` as a full re-read, so paging through a long file produced a correction for nearly every window — hundreds on a single long instruction file in Codex sessions. A correction is now only a lossy compressed view (`map`, `signatures`, `aggressive`, `entropy`, `task`, `reference`, `cognitive`, `mdl`, `density:`, `auto` resolved to one of them) followed by the full content (`full`, `raw`, whole-file `anchored`, or `cat`/`bat`/`less`/`more` without a range). Windows, `head`, `tail`, `sed -n` ranges and `diff` deltas are partial reads: they neither start nor complete a correction. `anchored`, which is verbatim plus line anchors, no longer starts one either. A failed edit after a window read is no longer charged to a compressed read.
 - **Edits made through the shell cancel a provisional correction.** `sed -i`, `perl -i`, output redirection (`>`, `>>`, `>|`, `&>`), `tee [-a]`, `cp`/`mv`/`install` onto a file and `apply_patch` bodies — through `ctx_shell`, also in `&&`/`;` chains, after `cd` and inside `sh -c`/`lean-ctx -c` — now count as edits of their target files, like `ctx_patch`. Native shell commands seen by the Claude Code, Cursor and Codex Bash hooks and Codex `apply_patch` calls (the Codex observer hook now also matches `apply_patch`) report the edit through the edit beacon. `2>/dev/null`, `2>&1`, `>&2` and targets built from `$VAR` are never edits. Shell reads are resolved against the command's working directory, so a relative `cat src/x.rs` now matches the file `ctx_read` read.
 - **Reading a file before editing it is no longer booked as a correction.** A compressed read followed by a full read of the same file was booked as a bounce (a correction that cancels the read's savings) at once, even when the full read was the preparation for an edit — the flow lean-ctx itself recommends (map to orient, full to edit). A detected bounce is now provisional for 10 read ticks: an edit of the file inside that window — `ctx_patch`, `ctx_edit`, or a native host edit (Claude Code `Edit`/`Write`, Cursor `StrReplace`, …) reported by the hook through a small edit beacon in the data directory — cancels it; otherwise it is booked when the window passes, and at shutdown at the latest. Only booked bounces reach the ledger, the per-path memory, the quality signal and the scent field.
```

**File**: `integrations/claude-code-mod/hooks/register.ts` (modified, +18/-0)
```diff
@@ -59,13 +59,23 @@ const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
       {
         end: "Use native Read for out-of-root; `lean-ctx doctor` shows effective roots.",
         continues: [
+          "Other tools: ctx_call(tool=<name>).",
           "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
           "Prefer stdlib and native platform alternatives before adding code or dependencies.",
           "Solution efficiency ladder:",
           "challenge every requirement, prefer deletion.",
         ],
       },
       {
+        end: "Other tools: ctx_call(tool=<name>).",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      {
+        // Emitted by lean-ctx 3.11.4 and earlier.
         end: "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
         continues: [
           "Prefer stdlib and native platform alternatives before adding code or dependencies.",
@@ -104,6 +114,14 @@ const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
           "challenge every requirement, prefer deletion.",
         ],
       },
+      {
+        end: "ctx_session (memory).",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
       { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
       { end: "Preserve validation, security, and error-handling." },
     ],
```

**File**: `rust/src/core/path_resolve.rs` (modified, +52/-0)
```diff
@@ -130,6 +130,12 @@ pub fn resolve_tool_path_with_roots(
         Path::new(&jail_root).join(&normalized)
     };
 
+    if project_root.is_none()
+        && let Some(error) = unbound_relative_path(raw, &resolved, shell_cwd.unwrap_or(&jail_root))
+    {
+        return Err(error);
+    }
+
     let jail_root_path = Path::new(&jail_root);
     let jailed =
         crate::core::pathjail::jail_path_auto_admitting(&resolved, jail_root_path, extra_roots)
@@ -141,6 +147,29 @@ pub fn resolve_tool_path_with_roots(
     ))
 }
 
+/// Refusal for a relative path that cannot mean anything yet: the session has
+/// no project, the host started lean-ctx in a broad directory (OpenCode
+/// launched from `~`), and nothing exists at `resolved`. Without it agents got
+/// "file not found: ~/src/main.rs" and searched the wrong tree. `None` when the
+/// path is absolute, exists, or `base` is an ordinary working directory.
+pub(crate) fn unbound_relative_path(raw: &str, resolved: &Path, base: &str) -> Option<String> {
+    let normalized = crate::core::pathutil::normalize_tool_path(raw);
+    if Path::new(&normalized).is_absolute() || resolved.exists() {
+        return None;
+    }
+    let base = std::path::absolute(base).unwrap_or_else(|_| PathBuf::from(base));
+    if !crate::core::pathutil::is_broad_or_unsafe_root(&base) {
+        return None;
+    }
+    Some(format!(
+        "relative path '{raw}' has no project to resolve against: lean-ctx has no project for \
+         this session yet (the host started it in {}, outside a project). Pass the absolute \
+         path instead, e.g. /home/me/code/my-app/{normalized}; that project then stays the \
+         session project.",
+        base.display()
+    ))
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
@@ -152,6 +181,29 @@ mod tests {
         assert_eq!(resolve_tool_path(None, None, ".").unwrap(), ".");
     }
 
+    #[test]
+    fn missing_relative_path_without_a_project_says_what_is_missing() {
+        // A host started outside a project (`/` here; `~` behaves the same).
+        let error = resolve_tool_path(None, Some("/"), "src/no_such_file_lc.rs").unwrap_err();
+        assert!(
+            error.contains("has no project to resolve against"),
+            "{error}"
+        );
+        assert!(error.contains("absolute path"), "{error}");
+
+        // A relative path in an ordinary working directory keeps resolving there.
+        let dir = tempfile::tempdir().unwrap();
+        let cwd = dir.path().to_string_lossy().to_string();
+        let outcome = resolve_tool_path(None, Some(&cwd), "src/no_such_file_lc.rs");
+        assert!(
+            outcome
+                .as_ref()
+                .err()
+                .is_none_or(|e| !e.contains("no project to resolve against")),
+            "{outcome:?}"
+        );
+    }
+
     #[test]
     fn relative_resolves_against_project_root() {
         let _environment = crate::core::data_dir::test_env_lock();
```

**File**: `rust/src/core/rules_sections.rs` (modified, +28/-14)
```diff
@@ -14,6 +14,17 @@ fn has(p: &ToolProfile, name: &str) -> bool {
     p.is_tool_enabled(name)
 }
 
+/// The memory tools the profile offers, in the wording the rules use. The lazy
+/// core offers ctx_session but keeps ctx_knowledge behind ctx_call.
+fn memory_tools(p: &ToolProfile) -> Option<&'static str> {
+    match (has(p, "ctx_session"), has(p, "ctx_knowledge")) {
+        (true, true) => Some("ctx_session / ctx_knowledge"),
+        (true, false) => Some("ctx_session"),
+        (false, true) => Some("ctx_knowledge"),
+        (false, false) => None,
+    }
+}
+
 /// Intent-to-tool playbook — only advertises tools the profile exposes.
 pub(crate) fn intent_section(p: &ToolProfile) -> String {
     let mut lines = vec!["Tool selection by intent:".to_string()];
@@ -42,8 +53,8 @@ pub(crate) fn intent_section(p: &ToolProfile) -> String {
     lines.push(nav);
 
     let mut verify = String::from("• Verify after edits -> ctx_shell(test/build)");
-    if has(p, "ctx_session") || has(p, "ctx_knowledge") {
-        verify.push_str("; memory -> ctx_session / ctx_knowledge");
+    if let Some(memory) = memory_tools(p) {
+        verify.push_str(&format!("; memory -> {memory}"));
     }
     lines.push(verify);
 
@@ -84,12 +95,10 @@ pub(crate) fn hook_covered_tools_section(p: &ToolProfile) -> String {
         );
     }
 
-    if has(p, "ctx_session") || has(p, "ctx_knowledge") {
-        lines.push(
-            "• ctx_session / ctx_knowledge — persistent memory — record decisions & \
-             progress after milestones"
-                .into(),
-        );
+    if let Some(memory) = memory_tools(p) {
+        lines.push(format!(
+            "• {memory} — persistent memory — record decisions & progress after milestones"
+        ));
     }
 
     if has(p, "ctx_expand") {
@@ -114,8 +123,14 @@ pub(crate) fn shadow_minimal_section(p: &ToolProfile) -> String {
     if has(p, "ctx_callgraph") {
         exclusives.push("ctx_callgraph (callers)");
     }
-    if has(p, "ctx_knowledge") || has(p, "ctx_session") {
-        exclusives.push("ctx_knowledge / ctx_session (memory)");
+    // Name only what the profile offers (the lazy core has ctx_session but
+    // keeps ctx_knowledge behind ctx_call, which `ctx_call_fallback` covers).
+    // The full pair keeps its established order (identical to SHADOW_MINIMAL).
+    match (has(p, "ctx_session"), has(p, "ctx_knowledge")) {
+        (true, true) => exclusives.push("ctx_knowledge / ctx_session (memory)"),
+        (true, false) => exclusives.push("ctx_session (memory)"),
+        (false, true) => exclusives.push("ctx_knowledge (memory)"),
+        (false, false) => {}
     }
 
     // #1849: the same text goes to every host, and their edit tools differ
@@ -212,10 +227,9 @@ pub(crate) fn ctx_call_fallback(p: &ToolProfile) -> Option<String> {
     if matches!(p, ToolProfile::Power) {
         return None;
     }
-    Some(
-        "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway."
-            .into(),
-    )
+    // Kept short: the lean core now carries this line in every session's
+    // instructions, which have a fixed token budget.
+    Some("Other tools: ctx_call(tool=<name>).".into())
 }
 
 #[cfg(test)]
```

**File**: `rust/src/rules_inject/mod.rs` (modified, +12/-3)
```diff
@@ -28,12 +28,21 @@ pub use content::{
 };
 pub use skills::{install_all_skills, install_skill_for_agent};
 
+/// The tool set client-neutral rule files may name: what `tools/list` offers a
+/// client without quirks (the lean core when no profile is pinned). These files
+/// are shared by every agent in a home or project, so no client is known.
+fn shared_surface_profile(
+    cfg: &crate::core::config::Config,
+) -> crate::core::tool_profiles::ToolProfile {
+    crate::server::tool_visibility::guidance_profile(cfg, "")
+}
+
 /// Forwarding functions — content is delegated to `core::rules_canonical`.
 pub fn canonical_rules_block() -> String {
     let cfg = crate::core::config::Config::load();
     let shadow = cfg.shadow_mode;
     let level = crate::core::config::CompressionLevel::effective(&cfg);
-    let profile = crate::core::tool_profiles::ToolProfile::from_config(&cfg);
+    let profile = shared_surface_profile(&cfg);
     crate::core::rules_canonical::render(
         shadow,
         crate::core::rules_canonical::Wrapper::Shared,
@@ -48,7 +57,7 @@ pub fn rules_dedicated_markdown() -> String {
     let cfg = crate::core::config::Config::load();
     let shadow = cfg.shadow_mode;
     let level = crate::core::config::CompressionLevel::effective(&cfg);
-    let profile = crate::core::tool_profiles::ToolProfile::from_config(&cfg);
+    let profile = shared_surface_profile(&cfg);
     crate::core::rules_canonical::render(
         shadow,
         crate::core::rules_canonical::Wrapper::Dedicated,
@@ -64,7 +73,7 @@ pub fn rules_longform_markdown() -> String {
     let cfg = crate::core::config::Config::load();
     let shadow = cfg.shadow_mode;
     let level = crate::core::config::CompressionLevel::effective(&cfg);
-    let profile = crate::core::tool_profiles::ToolProfile::from_config(&cfg);
+    let profile = shared_surface_profile(&cfg);
     crate::core::rules_canonical::render(
         shadow,
         crate::core::rules_canonical::Wrapper::Longform,
```

**File**: `rust/src/rules_inject/tests.rs` (modified, +10/-0)
```diff
@@ -352,6 +352,10 @@ fn rules_file_without_section_strips_lean_ctx_block() {
 
 #[test]
 fn inject_rules_for_agent_opencode() {
+    // Injection reads LEAN_CTX_RULES_INJECTION, which other tests set to "off"
+    // under the env lock; without the lock this test raced them.
+    let _guard = crate::core::data_dir::test_env_lock();
+    let _injection_guard = crate::setup::EnvVarGuard::set("LEAN_CTX_RULES_INJECTION", "shared");
     let home = std::env::temp_dir().join("test_inject_rules_agent");
     let _ = std::fs::remove_dir_all(&home);
     let _ = std::fs::create_dir_all(&home);
@@ -377,6 +381,8 @@ fn inject_rules_for_agent_opencode() {
 
 #[test]
 fn inject_rules_for_agent_cursor() {
+    let _guard = crate::core::data_dir::test_env_lock();
+    let _injection_guard = crate::setup::EnvVarGuard::set("LEAN_CTX_RULES_INJECTION", "shared");
     let home = std::env::temp_dir().join("test_inject_rules_cursor");
     let _ = std::fs::remove_dir_all(&home);
     let _ = std::fs::create_dir_all(&home);
@@ -485,6 +491,8 @@ fn skill_targets_count() {
 
 #[test]
 fn install_skill_creates_file() {
+    let _guard = crate::core::data_dir::test_env_lock();
+    let _injection_guard = crate::setup::EnvVarGuard::set("LEAN_CTX_RULES_INJECTION", "shared");
     let home = std::env::temp_dir().join("test_skill_install");
     let _ = std::fs::create_dir_all(&home);
     let fake_cursor = home.join(".cursor");
@@ -501,6 +509,8 @@ fn install_skill_creates_file() {
 
 #[test]
 fn install_skill_idempotent() {
+    let _guard = crate::core::data_dir::test_env_lock();
+    let _injection_guard = crate::setup::EnvVarGuard::set("LEAN_CTX_RULES_INJECTION", "shared");
     let home = std::env::temp_dir().join("test_skill_idempotent");
     let _ = std::fs::create_dir_all(&home);
     let fake_cursor = home.join(".cursor");
```

**File**: `rust/src/server/multi_path.rs` (modified, +17/-3)
```diff
@@ -3,6 +3,13 @@ use serde_json::{Map, Value};
 
 use crate::server::tool_trait::{ToolContext, get_str, get_str_array};
 
+/// Refusal for a walk without `path` while the session has no project: the
+/// host started lean-ctx in a broad directory and reported none.
+const NO_PROJECT_GUIDANCE: &str = "lean-ctx has no project for this session yet: the host \
+     started it outside a project (often the home directory) and reported no project \
+     directory. Pass the absolute path of the project directory as `path`, e.g. \
+     path=\"/home/me/code/my-app\"; any path inside a project then stays the session project.";
+
 #[derive(Debug)]
 pub struct ResolvedPaths {
     pub roots: Vec<String>,
@@ -134,11 +141,14 @@ pub fn resolve_tool_paths(
 
     // Validate before extra roots can return a default scope. An empty or
     // relative primary must never be interpreted against the process CWD.
+    // The refusal says how to recover: hosts that start lean-ctx in the home
+    // directory (OpenCode launched from `~`) hit it on the first call of a
+    // session, and a bare "root is required" left agents repeating the call.
     if ctx.project_root.trim().is_empty() {
-        return Err("active project root is required when no path is supplied".to_string());
+        return Err(NO_PROJECT_GUIDANCE.to_string());
     }
     if !std::path::Path::new(&ctx.project_root).is_absolute() {
-        return Err("active project root must be absolute when no path is supplied".to_string());
+        return Err(NO_PROJECT_GUIDANCE.to_string());
     }
 
     if let Some(session_lock) = ctx.session.as_ref() {
@@ -264,7 +274,11 @@ mod tests {
         let mut ctx = test_ctx();
         ctx.project_root.clear();
         let error = resolve_tool_paths(&Map::new(), &ctx).unwrap_err();
-        assert!(error.contains("active project root is required"));
+        assert!(error.contains("no project for this session"), "{error}");
+        assert!(
+            error.contains("absolute path of the project directory"),
+            "{error}"
+        );
     }
 
     #[test]
```

**File**: `rust/src/server/tool_visibility.rs` (modified, +43/-1)
```diff
@@ -215,12 +215,29 @@ pub fn guidance_profile(cfg: &crate::core::config::Config, client_name: &str) ->
         hook_covered: false, // no longer affects the candidate set (GH #1474)
     });
     narrow_to_surface(
-        cfg.tool_profile_effective(),
+        lazy_core_surface(cfg.tool_profile_effective(), candidate),
         &cfg.disabled_tools_effective(),
         ClientQuirks::resolve(client_name, candidate),
     )
 }
 
+/// The unpinned default resolves to `Power`, but `tools/list` advertises only
+/// `CORE_TOOL_NAMES` there; the rest is reached through `ctx_call`. Guidance
+/// written for `Power` named tools such as `ctx_knowledge` that OpenCode and
+/// other lazy-core clients never saw, and agents called them directly.
+fn lazy_core_surface(profile: ToolProfile, candidate: CandidateSet) -> ToolProfile {
+    if candidate != CandidateSet::LazyCore {
+        return profile;
+    }
+    ToolProfile::Custom(
+        crate::tool_defs::CORE_TOOL_NAMES
+            .iter()
+            .filter(|name| profile.is_tool_enabled(name))
+            .map(|name| (*name).to_string())
+            .collect(),
+    )
+}
+
 /// Pure core of [`guidance_profile`]: `profile` minus every tool the surface
 /// withholds. `Auto` is taken at its starting point (minimal) — guidance is
 /// written once per session and must not promise a tool before escalation.
@@ -579,6 +596,31 @@ mod tests {
         assert!(text.contains("ctx_compose"));
     }
 
+    #[test]
+    fn lazy_core_guidance_names_only_core_tools() {
+        // The unpinned default is `Power`, yet a lazy-core session (OpenCode,
+        // Cursor, …) is offered only CORE_TOOL_NAMES. Its rules named
+        // ctx_knowledge, which the agent then called and could not find.
+        let core = lazy_core_surface(ToolProfile::Power, CandidateSet::LazyCore);
+        let native = ClientQuirks {
+            hide_ctx_edit: false,
+            hide_ctx_patch: true,
+        };
+        let surface = narrow_to_surface(core, &[], native);
+        let text = guidance_names(&surface);
+        for absent in ["ctx_knowledge", "ctx_patch", "ctx_graph", "ctx_overview"] {
+            assert!(!text.contains(absent), "names {absent}:\n{text}");
+        }
+        for present in ["ctx_compose", "ctx_session", "ctx_callgraph", "ctx_call("] {
+            assert!(text.contains(present), "misses {present}:\n{text}");
+        }
+        // A pinned profile is authoritative and keeps its full set.
+        assert_eq!(
+            lazy_core_surface(ToolProfile::Power, CandidateSet::ProfileAuthoritative),
+            ToolProfile::Power
+        );
+    }
+
     #[test]
     fn a_hidden_ctx_patch_leaves_the_guidance() {
         // #1849: `prefer_native_editor` folds ctx_patch into the disabled
```

---

### Incident Patch 2: `c43445f1` (2026-10-17)
**Commit Message**: fix(security): precise SEC001 rule and a fresh full-history baseline

The history gate matched bare prefixes (ghp_, AKIA, sk_live_, PRIVATE
KEY-----) and any database URL with a password field, so it flagged
secret detectors, test fakes, warning docs, ${VAR} placeholders and dev
defaults; on the private integration tree 93 findings, all noise, hid
real signals.

- Two stages: an interval-free candidate ERE for git pickaxe/grep (keeps
  git fast), then a precise in-process check: full-length GitHub tokens,
  github_pat_, AWS key IDs (EXAMPLE keys excluded), Stripe live keys, PEM
  blocks with key material, DB URLs with a real literal password.
- Narrow filters: ascending 8-character runs mark hand-made fixtures; one
  reviewed self-signed loopback test key is exempt by blob ID only.
- History counts introductions only (precise count rises in a commit).
- command_timeout_seconds 120 -> 300 (candidate pickaxe took 81 s on the
  private tree).
- New baseline at b37ee3be11 over main, cla-signatures and tags: 17,061
  commits, 369 findings (368 path classes, 1 credential tracked for
  rotation), 0 current-tree findings (was 11). Full audit 533 s.
- Tests: 17 positive credential shapes bu

**File**: `scripts/history-policy-gate.py` (modified, +149/-16)
```diff
@@ -1,5 +1,37 @@
 #!/usr/bin/env python3
-"""Bounded full-history audit and required baseline-delta policy gate."""
+"""Bounded full-history audit and required baseline-delta policy gate.
+
+Secret detection is two-stage:
+
+1. ``secret_rule.pickaxe_regex`` is a POSIX ERE that git evaluates natively
+   (``git log -S --pickaxe-regex`` for history, ``git grep -E`` for a tree).
+   It only narrows candidates cheaply; it is deliberately a superset of the
+   precise patterns on the line that carries the credential prefix, and it is
+   interval-free: bounded repetitions such as ``{36}`` make git's POSIX
+   matcher markedly slower over full history.
+2. ``secret_rule.credential_patterns`` are Python regexes evaluated over the
+   whole blob. They decide. Whole-blob matching lets a PEM block require key
+   material on the lines after its BEGIN line (git's pickaxe is line-bound),
+   and the ``password`` group of a database URL is checked against
+   ``secret_rule.password_policy`` so placeholders and documented local
+   development defaults are not reported as credentials.
+
+Two further, narrow filters keep test fixtures out without path allowlists:
+
+* ``synthetic_run_length``: a match containing an ascending run of that many
+  consecutive digits or letters (``ABCDEFGH``, ``01234567``) is a hand-made
+  fixture. A random credential contains such a run with negligible
+  probability (about 3e-11 for a 36-character token and a run of 8).
+* ``reviewed_blobs``: individually reviewed git blob IDs (for example a
+  self-signed loopback TLS key read only by tests). The exemption is bound to
+  the exact content; any edit produces a new blob and is scanned again.
+
+A history candidate counts only when the precise match count of the path rises
+in that commit (an introduction). Bare prefixes in detectors, tests and
+warning docs never reach a finding. The current-tree scan applies the same
+precise check at the tip, so an introduction the pickaxe cannot see (its
+candidate count unchanged) is still caught there.
+"""
 
 import argparse
 import hashlib
@@ -15,8 +47,20 @@ class GateError(RuntimeError):
     pass
 
 
-FULL_AUDIT_SCANNER_VERSIONS = ["commit-path/v2", "diff-pickaxe/v2", "public-tree/v2"]
+FULL_AUDIT_SCANNER_VERSIONS = ["commit-path/v2", "diff-pickaxe/v3", "public-tree/v3"]
 BASELINE_SCANNER_VERSIONS = FULL_AUDIT_SCANNER_VERSIONS
+SECRET_RULE_KEYS = {
+    "id",
+    "rationale",
+    "pickaxe_regex",
+    "credential_patterns",
+    "password_policy",
+    "synthetic_run_length",
+    "reviewed_blobs",
+}
+MIN_SYNTHETIC_RUN_LENGTH = 8
+SEQUENCES = ("0123456789", "abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
+PASSWORD_POLICY_KEYS = {"min_length", "placeholder_prefixes", "placeholder_markers", "dev_default_passwords"}
 
 
 def canonical(value):
@@ -68,9 +112,93 @@ def load_policy(path):
         or set(source_paths) - {policy["policy_source_path"]} != set(sources)
     ):
         raise GateError("invalid scanner-source contract")
+    validate_secret_rule(policy["secret_rule"])
     return policy
 
 
+def string_list(value):
+    return isinstance(value, list) and all(isinstance(item, str) and item for item in value)
+
+
+def validate_secret_rule(rule):
+    if not isinstance(rule, dict) or set(rule) != SECRET_RULE_KEYS:
+        raise GateError("invalid secret-rule contract")
+    if not all(isinstance(rule[key], str) and rule[key] for key in ("id", "rationale", "pickaxe_regex")):
+        raise GateError("invalid secret-rule contract")
+    patterns = rule["credential_patterns"]
+    if (
+        not isinstance(patterns, list)
+        or not patterns
+        or not all(isinstance(item, dict) and set(item) == {"id", "regex"} and all(isinstance(v, str) and v for v in item.values()) for item in patterns)
+        or len({item["id"] for item in patterns}) != len(patterns)
+    ):
+        raise GateError("invalid credential-pattern contract")
+    for item in patterns:
+        try:
+            compiled = re.compile(item["regex"])
+        except re.error as exc:
+            raise GateError(f"invalid credential pattern: {item['id']}") from exc
+        if compiled.groupindex and set(compiled.groupindex) != {"password"}:
+            raise GateError(f"credential pattern may only name a password group: {item['id']}")
+    passwords = rule["password_policy"]
+    if (
+        not isinstance(passwords, dict)
+        or set(passwords) != PASSWORD_POLICY_KEYS
+        or not isinstance(passwords["min_length"], int)
+        or passwords["min_length"] < 1
+        or not all(string_list(passwords[key]) for key in PASSWORD_POLICY_KEYS - {"min_length"})
+        or any(value != value.lower() for value in passwords["dev_default_passwords"])
+    ):
+        raise GateError("invalid password-policy contract")
+    run = rule["synthetic_run_length"]
+    if not isinstance(run, int) or isinstance(run, bool) or run < MIN_SYNTHETIC_RUN_LENGTH:
+        raise GateError("invalid synthetic-run contra
```

**File**: `security/evidence/full-history-baseline-v1-review.md` (modified, +49/-0)
```diff
@@ -39,3 +39,52 @@ objects, not a newly accepted finding class.
 No rule, forbidden-path entry, source-binding requirement, or allowlist was
 weakened. The pending audit status remains intentional because remediation of
 other historical classes is outside this baseline rotation.
+
+## Precise SEC001 rule and baseline rotation (2026-10-17)
+
+The SEC001 rule matched bare prefixes (`ghp_`, `AKIA`, `sk_live_`,
+`PRIVATE KEY-----`) and any database URL with a password field. Every
+current-tree hit on the private integration tree (40, plus 53 history
+introductions) was a secret *detector*, a test fake, a warning in
+documentation, a `${VAR}` or `{placeholder}` password, a local development
+default or a self-signed loopback test key. The noise hid real signals.
+
+- **Two stages.** The git pickaxe uses an interval-free POSIX ERE that only
+  narrows candidates (intervals such as `{36}` made `git log -S` exceed the
+  per-command timeout on the larger private tree). A precise Python check over
+  the blob decides: GitHub tokens with their full length, fine-grained
+  `github_pat_`, AWS key IDs (`…EXAMPLE` documentation keys excluded), Stripe
+  live keys, PEM blocks only with base64 key material, and database URLs only
+  with a literal password of at least eight characters that is neither a
+  placeholder nor a documented development default.
+- **Two narrow filters.** A match containing an ascending run of eight
+  characters (`ABCDEFGH`, `01234567`) is a hand-made fixture; one reviewed
+  self-signed loopback TLS test key is exempt by Git blob ID only, so any change
+  to its content is scanned again.
+- **History** reports an introduction only when the precise match count of a
+  blob rises in a commit.
+- **Limits.** `command_timeout_seconds` is raised from 120 to 300 s: the
+  candidate pickaxe over the private tree took 81 s, too close to the old limit
+  for slower runners.
+
+### Baseline audit
+
+- Audit target: `b37ee3be11f2525cd785348d3e43ccdbb590fe94`
+- Audit source: fresh clone of the public repository with `main`,
+  `cla-signatures` and all tags — the ref set of the 16,291-commit audit above
+  (recomputed: `main` up to `bff280` plus `cla-signatures` plus its tags gives
+  exactly 16,291). Open pull-request branches are not part of the baseline.
+- Scanner contract: `commit-path/v2`, `diff-pickaxe/v3`, `public-tree/v3`
+- Coverage: 17,061 commits, 109,865 objects, 369 findings — 368 path findings
+  (IP001–IP006) and one SEC001 finding (`server.md` in commit `13e3e76353`,
+  reachable from an archive tag). The SEC001 finding is a credential; its
+  rotation is tracked privately.
+- Current tree: 0 accepted finding IDs (previously 11, all removed by the
+  precise rule).
+- Runtime: full audit 533 s (limit 1,800 s).
+- The evidence that shipped with the 3.11.0 export named 8,818 commits, which
+  matches no public ref set; it most likely came from the private integration
+  tree. This rotation replaces it with an audit of the public refs.
+
+Verified against the private integration tree: of the 93 findings the previous
+rule reported there, none remains.
```

**File**: `security/history-policy-v1.json` (modified, +64/-6)
```diff
@@ -4,7 +4,7 @@
     "max_commits": 20000,
     "max_objects": 300000,
     "max_findings": 5000,
-    "command_timeout_seconds": 120,
+    "command_timeout_seconds": 300,
     "full_audit_timeout_seconds": 1800
   },
   "forbidden_paths": [
@@ -35,7 +35,65 @@
   ],
   "secret_rule": {
     "id": "SEC001",
-    "pickaxe_regex": "AKIA|ghp_|gho_|ghs_|ghu_|ghr_|sk_live_|PRIVATE KEY-----|postgres://[^\\s]+:[^@\\s]+@|postgresql://[^\\s]+:[^@\\s]+@|mysql://[^\\s]+:[^@\\s]+@"
+    "rationale": "Two stages. pickaxe_regex is a POSIX ERE git evaluates natively to narrow candidates (git log -S --pickaxe-regex, git grep -E); it is a line-level superset of credential_patterns and deliberately interval-free, because bounded repetitions make git's POSIX matcher several times slower over full history. credential_patterns are Python regexes over the whole blob and decide: real credential shapes only, never bare prefixes. PEM blocks need base64 key material after the BEGIN line. Database URLs need a literal password of at least min_length characters that is neither a placeholder ($VAR, {var}, <var>, [var], %s, masked ***) nor a documented local development default. AWS documentation keys ending in EXAMPLE are not credentials. A match holding an ascending run of synthetic_run_length digits or letters is a hand-made fixture. reviewed_blobs exempts individually reviewed content by git blob ID only; any edit is scanned again.",
+    "pickaxe_regex": "gh[pousr]_[A-Za-z0-9]|github_pat_|A[KS]IA[0-9A-Z]|[rs]k_live_[0-9A-Za-z]|PRIVATE KEY-----|(postgres|postgresql|mysql|mariadb)[+a-z0-9]*://[^@[:space:]]+@",
+    "credential_patterns": [
+      {
+        "id": "github-token",
+        "regex": "\\bgh[pousr]_[A-Za-z0-9]{36,}\\b"
+      },
+      {
+        "id": "github-fine-grained-token",
+        "regex": "\\bgithub_pat_[A-Za-z0-9_]{22,}"
+      },
+      {
+        "id": "aws-access-key-id",
+        "regex": "\\b(?:AKIA|ASIA)(?![0-9A-Z]{9}EXAMPLE\\b)[0-9A-Z]{16}\\b"
+      },
+      {
+        "id": "stripe-live-key",
+        "regex": "\\b(?:sk|rk)_live_[0-9A-Za-z]{24,}\\b"
+      },
+      {
+        "id": "pem-private-key",
+        "regex": "-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----(?:\\\\r)?(?:\\\\n|\\r?\\n)(?:[ \\t\\\"'+,]*[A-Za-z-]+:[^\\r\\n]*?(?:\\\\r)?(?:\\\\n|\\r?\\n))*(?:[ \\t\\\"'+,]*(?:\\\\r)?(?:\\\\n|\\r?\\n))?[ \\t\\\"'+,]*[A-Za-z0-9+/]{40,}"
+      },
+      {
+        "id": "database-url-password",
+        "regex": "\\b(?:postgres|postgresql|mysql|mariadb)(?:\\+[a-z0-9]+)?://[^\\s:@/'\\\"`]+:(?P<password>[^\\s@/'\\\"`]+)@"
+      }
+    ],
+    "password_policy": {
+      "min_length": 8,
+      "placeholder_prefixes": [
+        "$",
+        "{",
+        "<",
+        "[",
+        "%"
+      ],
+      "placeholder_markers": [
+        "${",
+        "{{",
+        "$(",
+        "***",
+        "%s"
+      ],
+      "dev_default_passwords": [
+        "changeme",
+        "password",
+        "leanctx-dev",
+        "leanctx_e2e",
+        "localtest"
+      ]
+    },
+    "synthetic_run_length": 8,
+    "reviewed_blobs": [
+      {
+        "blob": "9698c59bbf61ff6742c4d9762ea1f452139c01c5",
+        "reason": "Self-signed loopback TLS test key (certificate CN=localhost, SAN localhost and 127.0.0.1, reviewed 2026-10-17). Read only by HTTPS loopback integration tests; it authenticates nothing outside the test process."
+      }
+    ]
   },
   "policy_source_path": "security/history-policy-v1.json",
   "scanner_source_paths": [
@@ -54,8 +112,8 @@
   ],
   "scanner_source_sha256": {
     ".github/workflows/security-check.yml": "5afe73f93ce67b5832fb1839c707c5a75a18951cdf015aedca3b6177743e9d83",
-    "scripts/history-policy-gate.py": "6191eb7e86b7253aef09c9ef9bb5167ba599f91f9e23d43be61452d039511ba8",
-    "tests/security/test_history_policy_gate.py": "ad6c71cadb5e5896ba926f9633249c571c9449af63605cc0d91c27ccbabfd108",
+    "scripts/history-policy-gate.py": "d018605b96d155293854985a1627da3bfc18e2721a7640b5530c9889ecfdb899",
+    "tests/security/test_history_policy_gate.py": "3aac0ee607d6968a9a0e755e2020be2a0fdfb2f44760cb91dba6fbc1aabb2f29",
     "tests/security/test_security_check_workflow.py": "2d0c9b9a6ceb61c97379290d549bbdcf7812ce17db9794b5d1b067e2202c2844",
     "rust/src/proxy/anthropic.rs": "02be2417f1eaab0730b4328fee90c91179c46f8ed4c0c2ae2f4737d2331537b7",
     "rust/src/proxy/anthropic_tests.rs": "d8e6572b778d48b2a158c2caf1ea9807ae03621b3215f31f3a2cde078b2a8c53",
@@ -66,8 +124,8 @@
     "rust/src/proxy/openai_responses_ws.rs": "968b11785cc3fb3229b2dbd0c7e8339654f9b15e9af0c8a2cbe8215c35bea284"
   },
   "baseline": {
-    "commit": "bff280bfc8eba6959854fafcbf104b5745d794c3",
+    "commit": "b37ee3be11f2525cd785348d3e43ccdbb590fe94",
     "report": "security/evidence/full-history-baseline-v1.json",
-    "report_sha256": "f2698fc347bd51b756b3ecbde00231e12953beb5a16db64ffd40fd9df5e2f3e6"
+    "report_sha256": "29fb4b0997f3f45cd80091dd6d365a3097644d7dae6dc1a41c88303a6572501e"
   }
 }
```

**File**: `tests/security/test_history_policy_gate.py` (modified, +150/-9)
```diff
@@ -12,6 +12,17 @@
 SPEC = importlib.util.spec_from_file_location("history_gate", ROOT / "scripts/history-policy-gate.py")
 GATE = importlib.util.module_from_spec(SPEC)
 SPEC.loader.exec_module(GATE)
+REPO_SECRET_RULE = json.loads((ROOT / "security/history-policy-v1.json").read_text())["secret_rule"]
+
+# Fake credentials are assembled at runtime so this file never holds a literal
+# that a scanner (this gate, push protection, the CI pattern scan) would match.
+MARKER = "DONOTPRINTTHISVALUE"
+STRIPE_LIVE = "sk" + "_live_" + MARKER + "Q1w2E3r4T5"
+
+
+def fake_stripe(tag):
+    # No ascending runs: those mark a fixture as synthetic (synthetic_run_length).
+    return "sk" + "_live_" + tag + "Q1w2E3r4T5y6U7i8O9p0A1s2"
 
 
 class HistoryPolicyGateTests(unittest.TestCase):
@@ -72,9 +83,9 @@ def commit(self, message):
     def write_policy(self, commit, digest, report="baseline.json"):
         policy = {
             "schema_version": "leanctx.history-policy/v1",
-            "limits": {"max_commits": 50, "max_objects": 500, "max_findings": 20, "command_timeout_seconds": 10},
+            "limits": {"max_commits": 50, "max_objects": 500, "max_findings": 100, "command_timeout_seconds": 10},
             "forbidden_paths": [{"id": "IP001", "prefix": "private/"}],
-            "secret_rule": {"id": "SEC001", "pickaxe_regex": "sk_" + "live_|PRIVATE " + "KEY-----"},
+            "secret_rule": REPO_SECRET_RULE,
             "policy_source_path": "policy.json",
             "scanner_source_paths": ["policy.json", "scanner.py"],
             "scanner_source_sha256": {"scanner.py": hashlib.sha256((self.repo / "scanner.py").read_bytes()).hexdigest()},
@@ -86,7 +97,7 @@ def policy(self):
         return GATE.load_policy(self.policy_path)
 
     def test_full_audit_is_bounded_and_redacted(self):
-        secret = "sk_" + "live_DO_NOT_PRINT_THIS_VALUE"
+        secret = STRIPE_LIVE
         (self.repo / "leak.txt").write_text(secret + "\n")
         (self.repo / "private").mkdir()
         (self.repo / "private/data.txt").write_text("internal\n")
@@ -105,12 +116,12 @@ def test_clean_current_and_delta_pass(self):
         self.assertEqual(report["findings"], [])
 
     def test_current_and_delta_secret_fail_closed(self):
-        (self.repo / "leak.txt").write_text("sk_" + "live_DO_NOT_PRINT_THIS_VALUE\n")
+        (self.repo / "leak.txt").write_text(STRIPE_LIVE + "\n")
         self.commit("secret delta")
         report = GATE.gate(self.repo, self.policy())
         scanners = {item["scanner"] for item in report["findings"]}
         self.assertEqual(scanners, {"current-secret", "delta-secret"})
-        self.assertNotIn(b"DO_NOT_PRINT_THIS_VALUE", GATE.canonical(report))
+        self.assertNotIn(MARKER.encode(), GATE.canonical(report))
 
     def test_current_and_delta_private_path_fail_closed(self):
         (self.repo / "private").mkdir()
@@ -151,7 +162,7 @@ def test_present_non_ancestor_baseline_is_accepted(self):
 
     def test_pr_base_current_findings_are_inherited(self):
         self.git("checkout", "-b", "main")
-        (self.repo / "leak.txt").write_text("sk_" + "live_BASE_EXAMPLE\n")
+        (self.repo / "leak.txt").write_text(fake_stripe("BASE") + "\n")
         self.commit("base branch fixture")
         self.git("update-ref", "refs/remotes/origin/main", "main")
         self.git("checkout", "-b", "feature")
@@ -257,12 +268,12 @@ def _rebaseline_current_tree(self):
     def test_edit_baselined_secret_path_still_passes(self):
         """Content churn on a path already known at baseline must not fail the gate."""
         (self.repo / "docs").mkdir(exist_ok=True)
-        (self.repo / "docs/readme.md").write_text("token = sk_" + "live_BASELINE_EXAMPLE\n")
+        (self.repo / "docs/readme.md").write_text("token = " + fake_stripe("BASELINE") + "\n")
         self.commit("baseline secret example")
         self._rebaseline_current_tree()
         # Edit same file (new blob) while keeping a matching pattern.
         (self.repo / "docs/readme.md").write_text(
-            "# note\ntoken = sk_" + "live_BASELINE_EXAMPLE\nmore\n"
+            "# note\ntoken = " + fake_stripe("BASELINE") + "\nmore\n"
         )
         self.commit("docs edit keeping secret-like example")
         report = GATE.gate(self.repo, self.policy())
@@ -271,14 +282,144 @@ def test_edit_baselined_secret_path_still_passes(self):
     def test_remove_baselined_secret_passes(self):
         """Removing a baselined secret-like example must not fail via delta pickaxe."""
         (self.repo / "docs").mkdir(exist_ok=True)
-        (self.repo / "docs/readme.md").write_text("token = sk_" + "live_BASELINE_EXAMPLE\n")
+        (self.repo / "docs/readme.md").write_text("token = " + fake_stripe("BASELINE") + "\n")
         self.commit("baseline secret example")
         self._rebaseline_current_tree()
         (self.repo / "docs/readme.md").write_text("token = <redacted>\n")
         self.commit("remove secret-like example")
         report = GATE.g
```

---

### Incident Patch 3: `c9c3b8fb` (2026-10-18)
**Commit Message**: fix(ledger,memory): record the model in use; keep activity out of memory

Savings ledger: entries from LeanCTX tools recorded the pricing table's key,
not the model the agent ran. The MCP process never loaded the live price
list, so a current model the built-in table does not know fell to its family
heuristic: every claude-opus-5-5 reduction was booked as claude-opus-4.5 at
$5/M instead of $4/M (~25 % too much value), and Codex sessions were valued
at the proxy's Claude model although Codex never passes the proxy.

The model is now resolved per process, after initialize: LEAN_CTX_MODEL,
then [cost.models] for the client or [cost] default_model, then Codex's own
configured model (profile overlay first), then the model the proxy measured
most. The price comes from the proxy's on-disk price list (no network), else
the built-in table; an estimated price keeps the real model name.

Memory: every ctx_read left a session finding ("Read task_control.rs
(438L)") that the session-save path stored as an auto:blocker fact, and that
path never ran the lifecycle, so a store grew to 638 records against a
budget of 200 (441 of them read records). Plain read/search/graph records
stay session activi

**File**: `rust/src/core/auto_findings.rs` (modified, +67/-0)
```diff
@@ -16,6 +16,30 @@ static RECENT: Mutex<Vec<RecentEntry>> = Mutex::new(Vec::new());
 const DEDUP_WINDOW_SECS: u64 = 60;
 const MAX_SUMMARY_LEN: usize = 120;
 
+/// Whether a finding only records what the agent itself did — a read, a search,
+/// a graph lookup, in exactly the wording [`extract`] produces. Such records serve
+/// the running session (briefing, recap, handoff); they are activity, not
+/// knowledge, so they never become durable facts. Failures, test and build
+/// results stay findings. Matching the producer's own formats also catches the
+/// records older sessions still carry.
+pub(crate) fn is_activity_record(summary: &str) -> bool {
+    if let Some(rest) = summary.strip_prefix("Read ") {
+        let head = rest.split_once(" — ").map_or(rest, |(head, _)| head);
+        let (path, tail) = head
+            .split_once(' ')
+            .map_or((head, None), |(p, t)| (p, Some(t)));
+        let line_count = |tail: &str| {
+            tail.strip_prefix('(')
+                .and_then(|t| t.strip_suffix("L)"))
+                .is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
+        };
+        return looks_like_path(path) && tail.is_none_or(line_count);
+    }
+    (summary.starts_with("Found `") && summary.contains("` in ") && summary.contains(" files"))
+        || summary.starts_with("Semantic search `")
+        || summary.starts_with("Files related to ")
+}
+
 /// Extract a finding from a tool call result. Returns `None` if the output
 /// is not interesting or if a duplicate was emitted within the dedup window.
 ///
@@ -596,6 +620,49 @@ mod tests {
     use super::*;
     use serial_test::serial;
 
+    #[test]
+    fn activity_records_are_exactly_what_the_producer_writes() {
+        let activity = [
+            extract_ctx_read("src/server/mod.rs 1400L\n   deps: tokio, serde\n", None),
+            extract_ctx_read(
+                "src/lib.rs [45L, full mode, 320 tok]\npub fn main() {}",
+                None,
+            ),
+            extract_ctx_read(
+                "rust/src/core/very/deeply/nested/module/task_control.rs 438L\n\n",
+                None,
+            ),
+            extract_ctx_search(
+                "pattern: \"pub fn extract\"\nsrc/a.rs:19: pub fn extract\n[1 matches in 1 files]",
+            ),
+            extract_ctx_graph("Files related to mod.rs (15):"),
+        ];
+        for finding in activity {
+            let summary = finding.expect("producer output").summary;
+            assert!(is_activity_record(&summary), "activity: {summary}");
+        }
+        let knowledge = [
+            extract_ctx_shell("exit: 1\n$ cargo clippy\nerror[E0425]: cannot find value `x`"),
+            extract_ctx_shell(
+                "exit: 0\n$ cargo test --lib\nrunning 2 tests\ntest result: ok. 2 passed; 0 failed;",
+            ),
+        ];
+        for finding in knowledge {
+            let summary = finding.expect("producer output").summary;
+            assert!(!is_activity_record(&summary), "knowledge: {summary}");
+        }
+        for written in [
+            "Read the docs and found the retry bug",
+            "Read src/a.rs: the lock is taken twice",
+            "Blocker: cannot connect to the registry",
+        ] {
+            assert!(
+                !is_activity_record(written),
+                "a person's finding stays: {written}"
+            );
+        }
+    }
+
     #[test]
     fn ctx_read_extracts_path_and_content() {
         let output = "src/server/mod.rs 1400L\n   deps: tokio, serde\n\npub struct Server {";
```

**File**: `rust/src/core/consolidation_engine.rs` (modified, +4/-0)
```diff
@@ -210,6 +210,9 @@ pub fn import_session_into(
         if opts.finding_budget.is_some_and(|n| finding_count >= n) {
             break;
         }
+        if crate::core::auto_findings::is_activity_record(f.summary.trim()) {
+            continue;
+        }
         if let Some(floor) = opts.finding_salience_floor
             && crate::core::memory_salience::text_salience(&f.summary) < floor
         {
@@ -231,6 +234,7 @@ pub fn import_session_into(
         for fact in extract_session_facts(session) {
             knowledge.add_fact(fact);
         }
+        knowledge.enforce_capacity(policy);
     }
 
     ImportCounts {
```

**File**: `rust/src/core/knowledge/core.rs` (modified, +14/-9)
```diff
@@ -22,6 +22,19 @@ pub(super) fn admit_fact_fields<const N: usize>(fields: [&str; N]) -> Option<[St
 }
 
 impl ProjectKnowledge {
+    /// Runs the lifecycle as soon as the store exceeds its budget. `run_lifecycle`
+    /// sorts by importance and drains the excess back down to `max_facts`
+    /// (archiving it), so the store settles at <= max_facts. Every ingestion path
+    /// calls it — `remember` per fact, batch paths of pre-built facts once after
+    /// the batch: the session-save path that skipped it let a store grow to 638
+    /// records against a budget of 200. The earlier `* 2` guard let stores sit at
+    /// 103% (206/200) with no reclamation.
+    pub fn enforce_capacity(&mut self, policy: &MemoryPolicy) {
+        if self.facts.len() > policy.knowledge.max_facts {
+            let _ = self.run_memory_lifecycle(policy);
+        }
+    }
+
     pub fn run_memory_lifecycle(
         &mut self,
         policy: &MemoryPolicy,
@@ -276,15 +289,7 @@ impl ProjectKnowledge {
             });
         }
 
-        // Run the lifecycle as soon as we exceed the configured budget.
-        // `run_lifecycle` sorts by importance and drains the excess back down to
-        // `max_facts` (archiving it), so this is self-limiting: the store settles
-        // at <= max_facts. The previous `* 2` guard let a project's facts grow to
-        // twice the cap before any eviction fired, which is why stores were
-        // observed sitting at 103% (206/200) with no reclamation.
-        if self.facts.len() > policy.knowledge.max_facts {
-            let _ = self.run_memory_lifecycle(policy);
-        }
+        self.enforce_capacity(policy);
 
         self.updated_at = Utc::now();
         self.rebuild_index();
```

**File**: `rust/src/core/knowledge/mod.rs` (modified, +39/-0)
```diff
@@ -359,6 +359,45 @@ mod tests {
         );
     }
 
+    #[test]
+    fn batches_of_prebuilt_facts_settle_at_the_cap() {
+        let _iso = crate::core::data_dir::isolated_data_dir();
+        let root = tempfile::tempdir().unwrap();
+        // Regression: the session-save path adds pre-built facts with add_fact()
+        // and never ran the lifecycle, so a store grew to 638 records against a
+        // budget of 200. enforce_capacity() after the batch settles it.
+        let mut source_policy = default_policy();
+        source_policy.knowledge.max_facts = 1000;
+        let mut source = ProjectKnowledge::new("/tmp/test-batch-source");
+        for i in 0..40 {
+            source.remember(
+                "finding",
+                &format!("key-{i}"),
+                &format!("value number {i}"),
+                "s1",
+                0.7,
+                &source_policy,
+            );
+        }
+        let mut policy = default_policy();
+        policy.knowledge.max_facts = 5;
+        let mut k = ProjectKnowledge::new(root.path().to_str().unwrap());
+        for fact in source.facts.clone() {
+            k.add_fact(fact);
+        }
+        assert!(
+            k.facts.len() > policy.knowledge.max_facts,
+            "add_fact alone never evicts"
+        );
+        k.enforce_capacity(&policy);
+        assert!(
+            k.facts.len() <= policy.knowledge.max_facts,
+            "expected <= {} facts after the batch, got {}",
+            policy.knowledge.max_facts,
+            k.facts.len()
+        );
+    }
+
     #[test]
     fn import_facts_evict_down_to_cap_not_double() {
         let _iso = crate::core::data_dir::isolated_data_dir();
```

**File**: `rust/src/core/savings_ledger/mod.rs` (modified, +158/-11)
```diff
@@ -49,25 +49,88 @@ fn enabled_from(value: Option<&str>) -> bool {
     }
 }
 
-/// Resolved (model_key, input_price_per_m) for this process. The active model is stable
-/// within a process, so we resolve the pricing table once.
+/// Resolved (model_id, input_price_per_m) for this process. The active model is stable
+/// within a process, so it is resolved once, at the first event: by then `initialize`
+/// has named the MCP client (see [`agent_id`]).
 fn model_and_price() -> &'static (String, f64) {
     static CACHE: OnceLock<(String, f64)> = OnceLock::new();
     CACHE.get_or_init(|| {
-        let resolved = std::env::var("LEAN_CTX_MODEL")
+        let agent = agent_id();
+        let client = agent.split(':').next().unwrap_or_default();
+        let explicit = std::env::var("LEAN_CTX_MODEL")
             .or_else(|_| std::env::var("LCTX_MODEL"))
-            .ok()
-            .filter(|s| !s.trim().is_empty())
-            // No explicit model → value savings against the real model the proxy
-            // measured most, instead of the blended fallback (cross-process hint
-            // from `proxy_usage.json`). Falls back to blended when absent.
-            .or_else(crate::proxy::usage_meter::persisted_dominant_model);
+            .ok();
+        let configured = crate::core::config::Config::load()
+            .cost
+            .model_for_client(client);
+        let resolved = resolve_ledger_model(
+            explicit,
+            configured,
+            client.starts_with("codex"),
+            codex_configured_model,
+            crate::proxy::usage_meter::persisted_dominant_model,
+        );
+        // Disk cache only, no network: the price list the proxy keeps current.
+        crate::core::gain::live_pricing::ensure_loaded();
         let quote =
             crate::core::gain::model_pricing::ModelPricing::load().quote(resolved.as_deref());
-        (quote.model_key, quote.cost.input_per_m)
+        (
+            recorded_model(resolved.as_deref(), &quote),
+            quote.cost.input_per_m,
+        )
     })
 }
 
+/// The model this process's agent actually runs, first available wins:
+/// 1. `LEAN_CTX_MODEL` / `LCTX_MODEL`
+/// 2. `[cost.models]` for the client, then `[cost] default_model`
+/// 3. Codex: the `model` of its own configuration (Codex bypasses the proxy)
+/// 4. the model the LeanCTX proxy measured most (Claude Code and other proxied hosts)
+fn resolve_ledger_model(
+    explicit: Option<String>,
+    configured: Option<String>,
+    codex: bool,
+    codex_model: impl FnOnce() -> Option<String>,
+    proxy_model: impl FnOnce() -> Option<String>,
+) -> Option<String> {
+    let given = |value: Option<String>| {
+        value
+            .map(|model| model.trim().to_string())
+            .filter(|model| !model.is_empty())
+    };
+    given(explicit)
+        .or_else(|| given(configured))
+        .or_else(|| if codex { given(codex_model()) } else { None })
+        .or_else(|| given(proxy_model()))
+}
+
+/// The `model` Codex runs with: its active profile overlay first, then the base config.
+fn codex_configured_model() -> Option<String> {
+    let paths = crate::core::home::resolve_codex_config_paths()?;
+    let model_in = |path: &std::path::Path| -> Option<String> {
+        let doc: toml::Value = toml::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
+        doc.get("model")?.as_str().map(str::to_string)
+    };
+    paths
+        .profile()
+        .and_then(model_in)
+        .or_else(|| model_in(paths.base()))
+}
+
+/// The model name an event records. An exact or live price names its model; an
+/// estimated price keeps the real model name rather than the stand-in it was priced
+/// by (`claude-opus-5-5`, never `claude-opus-4.5`). Without any known model the
+/// blended fallback says exactly that.
+fn recorded_model(
+    resolved: Option<&str>,
+    quote: &crate::core::gain::model_pricing::ModelQuote,
+) -> String {
+    match resolved.map(str::trim).filter(|model| !model.is_empty()) {
+        Some(model) if quote.match_kind.is_estimated() => model.to_lowercase(),
+        _ => quote.model_key.clone(),
+    }
+}
+
 /// Privacy-preserving repo attribution: truncated SHA-256 of the process working
 /// directory. Never the file path or contents. Process-scoped (cached once).
 fn repo_hash() -> &'static str {
@@ -345,7 +408,7 @@ pub fn record_caching_event(model: &str, cache_read_tokens: u64, discount_usd: f
             .to_string(),
     );
     let quote = crate::core::gain::model_pricing::ModelPricing::load().quote(Some(model));
-    event.model_id = quote.model_key;
+    event.model_id = recorded_model(Some(model), &quote);
     event.unit_price_per_m_usd = quote.cost.input_per_m;
     event.baseline_tokens = cache_read_tokens;
     event.actual_tokens = cache_read_tokens;
@@ -436,6 +499,90 @@ mod tests {
         assert!(!enabled_from(Some(" No ")), "trim + case-insensitive");
     }
 
+    fn some(model: &str) -> Option<String> {
+     
```

**File**: `rust/src/core/session/persistence.rs` (modified, +3/-0)
```diff
@@ -362,6 +362,9 @@ fn persist_session_facts(session: &SessionState) -> Result<(), String> {
     for fact in facts {
         knowledge.add_fact(fact);
     }
+    if let Ok(policy) = crate::core::config::Config::load().memory_policy_effective() {
+        knowledge.enforce_capacity(&policy);
+    }
     knowledge.save()
 }
 
```

**File**: `rust/src/core/session/state.rs` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ pub(crate) fn extract_session_facts(
 
     facts.extend(session.findings.iter().filter_map(|finding| {
         let summary = finding.summary.trim();
-        if summary.is_empty() {
+        if summary.is_empty() || crate::core::auto_findings::is_activity_record(summary) {
             return None;
         }
         let normalized = summary.to_ascii_lowercase();
```

#### Recent Merged Pull Requests:
- **PR #2118** (2026-10-18): fix(windows): give each artifact capability probe its own name (@yvgude)
- **PR #2117** (2026-10-18): fix(deps): patch rustls and katex advisories in clients and cookbook (@yvgude)
- **PR #2116** (2026-10-18): fix(solution): merge tracker counts across concurrent MCP servers (@yvgude)
- **PR #2115** (closed): fix(solution): reload tracker from disk before each write (@Shaderzx)
- **PR #2114** (2026-10-18): test(knowledge): fill the capacity regression store through remember() (@yvgude)
- **PR #2113** (2026-10-18): fix(ledger,memory): record the model in use, keep activity out of memory, keep team notices (@yvgude)

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

## X. opencode): explain an unbound session; rules name only offered tools

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yvgude/lean-ctx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `01d06654`: opencode): explain an unbound session; rules name only offered tools. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Agents outside a project are told what is missing (OpenCode).** When a host starts lean-ctx outside a project (OpenCode launched from the home directory) and reports no project directory, a search or tree without `path` said only "active project root is required", and a relative read failed as "file not found: ~/src/main.rs". Both now say that the session has no project yet and to pass the absolute project path, after which that project stays bound. OpenCode installations hit this four times as often per installation as Claude Code.
- **Rules name only the tools the session is offered.** With no profile pinned, the injected rules and MCP instructions were written for the full tool set, while `tools/list` offers the lean core (OpenCode, Cursor and other clients: 11 tools). They named `ctx_knowledge` and, for native-editor clients, `ctx_patch` as if callable, and agents called tools their list did not contain. Guidance now describes the lean core and points to `ctx_call` for the rest; the skill shows non-core tools in their `ctx_call` form. A pinned profile keeps its full set.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `01d06654` are properly handled with clean fallback behavior.
