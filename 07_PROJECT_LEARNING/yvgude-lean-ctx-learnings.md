# Forensic Learning Record (Deep Inspection): yvgude/lean-ctx

> **Canonical Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:11:45.870Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yvgude/lean-ctx`
- **Description**: LeanCTX — Context Gateway for AI Systems. Control what your AI can see. Open-source Engine for context selection, supported controls, and evidence.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3863 stars

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

### Core Architecture Module: `integrations/claude-code-mod/hooks/register.ts`
```
import type {
  EngineInterface,
  McpToolResult,
  Register,
  Timer,
  ToolCallResult,
  TurnStepResult,
} from "claude-code";

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
          "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
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
let leanCtxSeen = false;
// The lean-ctx MCP server name as this session spells it (`lean-ctx`/`lean_ctx`).
let leanServer: string | undefined;
let commandAttempted = false;
let commandRegistered = false;
// Set by a main-loop compaction; the next prompt carries the lean-ctx session state once.
let resumePending = false;

export const register: Register = (on, options) => {
  const frontLoaded = getFrontLoadedTools(options);
  const shapeNative = asRecord(options).shape_native_output !== false;
  const keepHookContext = asRecord(options).keep_hook_context === true;

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
    return { text: `${liveSkillHeader(frontLoaded, shapeNative)}\n\n${base.text}` };
  });

  // The MCP instructions and live skill carry the durable guidance. Drop only
  // exact lean-ctx SessionStart/UserPromptSubmit hook blocks; other authors and
  // other hook events pass through unchanged. No agentId check keeps this
  // channel diet active in both the main loop and subagents.
  on("prompt.attachment", async ($, event, next) => {
    if (
      keepHookContext ||
      event.origin.kind !== "hook" ||
      (event.origin.event !== "SessionStart" && event.origin.event !== "UserPromptSubmit")
    ) {
      return next(event);
    }
    const stripped = stripLeanCtxHookText(event.text);
    if (stripped.removedChars === 0) return next(event);
    metrics.droppedHookAttachments += 1;
    metrics.droppedHookChars += stripped.removedChars;
    return { text: stripped.text || null };
  });

  on("session.start", async ($, event, next) => {
    resetSessionState();
    // Detect lean-ctx up front so `/leanctx` exists before the first model
    // request (tool.describe only fires once a request renders the tools).
    // A server still connecting is picked up later by the tool hooks.
    if (!leanCtxSeen) {
      try {
        const match = (await $.tool.list())
          .map((tool) => getLeanCtxTool(tool.name))
          .find((found) => found !== undefined);
        if (match) {
          leanCtxSeen = true;
          leanServer = match.server;
        }
      } catch {
        // Listing is best-effort; the tool hooks still detect lean-ctx.
      }
    }
    if (leanCtxSeen) await ensureMeterCommand($);
    return next(event);
  });

  on("tool.call", async ($, event, next) => {
    const fields = event as unknown as JsonRecord;
    const tool = typeof fields.tool === "string" ? fields.tool : "";
    const leanCtxTool = getLeanCtxTool(tool);

    if (!leanCtxTool) {
      if (tool === "Bash" && watchedJobs.size > 0 && isSleepWait(readString(fields, "command"))) {
        metrics.sleepsAnswered += 1;
        return { result: sleepAnswer() };
      }
      if (tool === "Bash" && shapeNative) {
        return shapeBash($, readString(fields, "command"), await next(event));
      }
      return next(event);
    }

    leanCtxSeen = true;
    leanServer = leanCtxTool.server;
    metrics.leanCtxCalls += 1;
    await ensureMeterCommand($);

    if (
      SHELL_TOOLS.has(leanCtxTool.tool) &&
      watchedJobs.size > 0 &&
      isSleepWait(readString(fields, "command"))
    ) {
      metrics.sleepsAnswered += 1;
      return { result: sleepAnswer() };
    }

    if (SHELL_TOOLS.has(leanCtxTool.tool) && fields.run_in_background) {
      const result = await next(event);
      const jobId = extractJobId(result);
      if (!jobId) return result;

      const key = watchKey(leanCtxTool.server, jobId);
      const job = wa
```

### Core Architecture Module: `integrations/hermes-lean-ctx/benchmarks/engines.py`
```
"""Engine adapters for the benchmark.

The lean-ctx adapter always runs (it falls back to local compaction when the
daemon is offline). Competitor engines are **import-guarded**: if the package is
not installed, or its API does not match, the adapter is returned with
``available=False`` and a reason — it is skipped, never faked.
"""

from __future__ import annotations

import importlib
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

Message = Dict[str, Any]
CompressFn = Callable[[List[Message], Optional[int]], List[Message]]


def _unavailable(*_args: Any, **_kwargs: Any) -> List[Message]:
    raise RuntimeError("engine adapter is unavailable and must not be invoked")


@dataclass
class Adapter:
    name: str
    compress: CompressFn
    available: bool
    note: str = ""


def lean_ctx_adapter(
    *,
    context_length: int,
    base_url: Optional[str] = None,
    token: Optional[str] = None,
) -> Adapter:
    from hermes_lean_ctx.config import LeanCtxConfig
    from hermes_lean_ctx.engine import LeanCtxEngine

    cfg = LeanCtxConfig(
        base_url=base_url or "http://127.0.0.1:8080",
        token=token,
        context_length=context_length,
    )
    engine = LeanCtxEngine(config=cfg)
    note = "daemon" if engine._gateway.is_available() else "local-fallback"
    return Adapter("lean-ctx", lambda msgs, ct=None: engine.compress(msgs, ct), True, note)


def _wrap_context_engine(name: str, candidates, context_length: int) -> Adapter:
    """Build an adapter from the first importable Hermes ContextEngine class."""
    last_reason = "not installed"
    for module_path, class_names in candidates:
        try:
            mod = importlib.import_module(module_path)
        except Exception as exc:  # noqa: BLE001 - any import failure → skip
            last_reason = f"{module_path}: {exc.__class__.__name__}"
            continue
        for class_name in class_names:
            cls = getattr(mod, class_name, None)
            if not isinstance(cls, type):
                continue
            engine = None
            for ctor in (lambda: cls(context_length=context_length), cls):
                try:
                    engine = ctor()
                    break
                except Exception:  # noqa: BLE001 - try the next constructor shape
                    engine = None
            if engine is None:
                last_reason = f"{module_path}.{class_name}: construct failed"
                continue
            compress = getattr(engine, "compress", None)
            if not callable(compress):
                last_reason = f"{module_path}.{class_name}: no compress()"
                continue
            return Adapter(name, lambda msgs, ct=None: compress(msgs, ct), True, f"{module_path}.{class_name}")
    return Adapter(name, _unavailable, False, last_reason)


def builtin_compressor_adapter(*, context_length: int) -> Adapter:
    """Hermes' built-in ContextCompressor (if a Hermes checkout is importable)."""
    return _wrap_context_engine(
        "builtin-compressor",
        [
            ("agent.context_compressor", ("ContextCompressor",)),
            ("agent.compression", ("ContextCompressor",)),
            ("hermes.context_compressor", ("ContextCompressor",)),
        ],
        context_length,
    )


def hermes_lcm_adapter(*, context_length: int) -> Adapter:
    """The hermes-lcm engine (if ``hermes_lcm`` is installed)."""
    return _wrap_context_engine(
        "hermes-lcm",
        [
            ("hermes_lcm", ("LCMEngine", "LosslessContextEngine", "ContextEngine", "Engine")),
            ("hermes_lcm.engine", ("LCMEngine", "LosslessContextEngine", "ContextEngine", "Engine")),
        ],
        context_length,
    )


def discover_adapters(
    *,
    context_length: int,
    base_url: Optional[str] = None,
    token: Optional[str] = None,
) -> List[Adapter]:
    """All adapters; competitors that fail to import are included as unavailable."""
    return [
        lean_ctx_adapter(context_length=context_length, base_url=base_url, token=token),
        builtin_compressor_adapter(context_length=context_length),
        hermes_lcm_adapter(context_length=context_length),
    ]

```

### Core Architecture Module: `integrations/hermes-lean-ctx/engine.py`
```
"""``LeanCtxEngine`` — lean-ctx as a Hermes context engine.

Replaces the built-in ``ContextCompressor``: deterministic, prompt-cache
friendly compaction of the message window plus native lean-ctx recall tools.
All engine logic that *can* live in the daemon does (Single Source of Truth);
this class is a thin, fault-tolerant adapter over the ``/v1`` API.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

try:  # Real host contract wins whenever a Hermes checkout is importable.
    from agent.context_engine import ContextEngine  # type: ignore
except Exception:  # pragma: no cover - exercised outside Hermes
    from ._hermes_compat import ContextEngine  # type: ignore

from . import compaction, presets
from . import tokens as _tokens
from . import tools as _tools
from .config import LeanCtxConfig
from .schemas import recall_hint
from .transport import ToolGateway

logger = logging.getLogger(__name__)

_ENGINE_NAME = "lean-ctx"
_OFFLOAD_MAX_CHARS = 8_000


def _first_int(d: Dict[str, Any], *keys: str) -> Optional[int]:
    for key in keys:
        val = d.get(key)
        if isinstance(val, bool):
            continue
        if isinstance(val, int):
            return val
        if isinstance(val, float):
            return int(val)
    return None


class LeanCtxEngine(ContextEngine):
    """Context engine backed by the lean-ctx daemon."""

    def __init__(
        self,
        context_length: Optional[int] = None,
        *,
        config: Optional[LeanCtxConfig] = None,
        hermes_home: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        cfg = config or LeanCtxConfig.from_env()
        resolved_ctx = int(context_length or cfg.context_length)
        if resolved_ctx != cfg.context_length:
            cfg = cfg.with_context_length(resolved_ctx)
        self._config = cfg
        self._hermes_home = hermes_home
        self._session_id: Optional[str] = None
        self._gateway = ToolGateway(cfg)

        # Initialise the host base in whatever shape it expects, then assert our
        # own attribute invariants so they exist regardless of the base.
        try:
            super().__init__(context_length=resolved_ctx)  # type: ignore[misc]
        except TypeError:
            try:
                super().__init__()  # type: ignore[misc]
            except Exception:  # pragma: no cover - exotic host base
                pass
        self.last_prompt_tokens = 0
        self.last_completion_tokens = 0
        self.last_total_tokens = 0
        self.context_length = resolved_ctx
        self.threshold_tokens = cfg.threshold_tokens()
        self.compression_count = 0

    # --- identity -----------------------------------------------------------

    @property
    def name(self) -> str:
        return _ENGINE_NAME

    @property
    def config(self) -> LeanCtxConfig:
        return self._config

    # --- token accounting ---------------------------------------------------

    def update_from_response(self, usage: Dict[str, Any]) -> None:
        if not isinstance(usage, dict):
            return
        pt = _first_int(usage, "prompt_tokens", "input_tokens")
        ct = _first_int(usage, "completion_tokens", "output_tokens")
        tt = _first_int(usage, "total_tokens")
        if pt is not None:
            self.last_prompt_tokens = pt
        if ct is not None:
            self.last_completion_tokens = ct
        if tt is not None:
            self.last_total_tokens = tt
        elif pt is not None or ct is not None:
            self.last_total_tokens = self.last_prompt_tokens + self.last_completion_tokens

    def should_compress(self, prompt_tokens: Optional[int] = None) -> bool:
        if self.threshold_tokens <= 0:
            return False
        tokens = prompt_tokens
        if tokens is None:
            tokens = self.last_prompt_tokens or self.last_total_tokens
        return int(tokens or 0) >= self.threshold_tokens

    def should_compress_preflight(self, messages: List[Dict[str, Any]]) -> bool:
        if self.threshold_tokens <= 0:
            return False
        return _tokens.count_messages_tokens(messages) >= self.threshold_tokens

    # --- compaction ---------------------------------------------------------

    def compress(
        self,
        messages: List[Dict[str, Any]],
        current_tokens: Optional[int] = None,
        focus_topic: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not isinstance(messages, list) or not messages:
            return messages
        try:
            input_tokens = _tokens.count_messages_tokens(messages)
            result: Optional[List[Dict[str, Any]]] = None
            if self._config.use_core_compaction:
                # Preferred: the daemon's deterministic core tool owns compaction
                # (Single Source of Truth) and offloads raw turns server-side.
                result = self._compress_via_daemon(messages, focus_topic)
            if result is None:
                # Fallback: daemon unreachable / tool missing — compact locally.
                result = self._compress_local(messages, focus_topic)
            if result is None:
                return messages  # nothing to compact
            if _tokens.count_messages_tokens(result) < input_tokens:
                self.compression_count += 1
            return result
        except Exception as exc:  # never break the agent loop
            logger.warning("lean-ctx engine: compress() failed, returning input unchanged: %s", exc)
            return messages

    def _compress_via_daemon(
        self,
        messages: List[Dict[str, Any]],
        focus_topic: Optional[str],
    ) -> Optional[List[Dict[str, Any]]]:
        """Compact through the daemon's ``ctx_transcript_compact`` core tool.

        Returns the validated message list when the daemon handled the request,
        or ``None`` (→ local fallback) when it is unreachable, the tool is
        missing, or the response fails our hard OpenAI-sequence invariants.
        """
        if not self._gateway.is_available():
            return None
        args: Dict[str, Any] = {
            "messages": messages,
            "fresh_tail_tokens": self._config.protect_tokens(),
            "protect_min_messages": self._config.protect_min_messages,
        }
        if focus_topic:
            args["focus_topic"] = focus_topic
        raw = self._gateway.call_text("ctx_transcript_compact", args)
        if not raw:
            return None
        try:
            payload = json.loads(raw)
        except (ValueError, TypeError):
            return None
        if not isinstance(payload, dict):
            return None
        new_messages = payload.get("messages")
        if not isinstance(new_messages, list) or not new_messages:
            return None
        if not all(isinstance(m, dict) for m in new_messages):
            return None
        # Hard invariant: a tool_call/tool_result pair must never be split.
        if compaction.tool_pairing_errors(new_messages):
            logger.warning(
                "lean-ctx engine: daemon compaction broke tool pairing; using local fallback"
            )
            return None
        # Safety: compaction must never grow the window.
        if _tokens.count_messages_tokens(new_messages) > _tokens.count_messages_tokens(messages):
            return None
        return new_messages

    def _compress_local(
        self,
        messages: List[Dict[str, Any]],
        focus_topic: Optional[str],
    ) -> Optional[List[Dict[str, Any]]]:
        """Pure-Python compaction used when the daemon path is unavailable."""
        plan = compaction.plan_compaction(
            messages,
            protect_tokens=self._config.protect_tokens(),
            protect_min_messages=self._config.protect_min_messages,
            token_counter=_tokens.count_messages_tokens,
        )
        if plan.nothing_to_do:
            return None
        self._offload(plan.to_summarize)
        summary = compaction.build_summary_message(
            plan.to_summarize,
            focus_topic=focus_topic,
            recall_hint=recall_hint() if self._config.enable_tools else "",
        )
        return compaction.assemble(plan, summary)

    def _offload(self, to_summarize: List[Dict[str, Any]]) -> None:
        """Persist offloaded turns to lean-ctx so they remain recoverable.

        Only used by the local fallback path; the daemon core tool offloads
        server-side, so this avoids double-writing the same turns.
        """
        if not to_summarize or not self._gateway.is_available():
            return
        digest = compaction.serialize_transcript(to_summarize, max_chars=_OFFLOAD_MAX_CHARS)
        if not digest:
            return
        self._gateway.call_text("ctx_session", {"action": "finding", "value": digest})

    # --- model / lifecycle --------------------------------------------------

    def update_model(
        self,
        model: str,
        context_length: Optional[int] = None,
        **kwargs: Any,
    ) -> None:
        new_ctx = context_length or presets.context_length_for(model)
        if new_ctx:
            self._config = self._config.with_context_length(int(new_ctx))
            self.context_length = self._config.context_length
            self.threshold_tokens = self._config.threshold_tokens()

    def on_session_start(self, session_id: str, **kwargs: Any) -> None:
        self._session_id = session_id
        # Restore prior cross-session state (task / findings / decisions) so that
        # recall and subsequent compaction summaries reflect earlier sessions.
        # Best-effort: a fresh project with no history simply no-ops.
        if self._gateway.is_available():
            self._gateway.call_text("ctx_session", {"action": "resume"})

    def on_session_end(self, session_id: str, messages: List[Dict[str, Any]]) -> None:
        # Durable cross-session persiste
```

### Core Architecture Module: `rust/crates/lean-ctx-embed/src/engine.rs`
```
//! The embedding [`Engine`] — a safe, ergonomic handle over the lean-ctx
//! context engine, built via [`EngineBuilder`].
//!
//! ## What it is
//!
//! `Engine` owns a **shared** [`SessionCache`] and dispatches the *real*
//! registered tools (`ctx_read`, `ctx_search`, …) the same way the MCP server
//! does. Because the cache is shared across calls, a read followed by a re-read
//! of the same file collapses to a delta in-process — the property Lean-md
//! needs and the headline acceptance test for this SDK.
//!
//! ```no_run
//! let engine = lean_ctx_embed::Engine::builder(".").build().unwrap();
//! let first = engine.read("src/main.rs", lean_ctx_embed::ReadMode::Full).unwrap();
//! let again = engine.read("src/main.rs", lean_ctx_embed::ReadMode::Full).unwrap();
//! assert!(again.saved_tokens >= first.saved_tokens); // re-read is cheaper
//! ```
//!
//! ## Safe by default
//!
//! [`EngineBuilder::build`] is read-mostly and scoped:
//! - **`PathJail` on** — every path argument is resolved against the project root;
//!   escapes and secret paths are rejected.
//! - **Scoped data dir** — unless you call [`EngineBuilder::data_dir`], engine
//!   state goes to a dedicated temp dir, never your real `~/.lean-ctx`.
//! - **Auto-update off** for the embedded process.
//! - **Write/exec gated** — `ctx_edit`/`ctx_fill` need [`EngineBuilder::allow_write`];
//!   `ctx_shell`/`ctx_execute` need [`EngineBuilder::allow_exec`].
//!
//! ## Runtime constraint
//!
//! Engine methods are synchronous and drive their own multi-threaded Tokio
//! runtime, so they must **not** be called from inside another Tokio runtime
//! worker. From async code, wrap calls in `tokio::task::spawn_blocking`.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde_json::{Map, Value};
use tokio::sync::RwLock;

use lean_ctx::core::cache::SessionCache;
use lean_ctx::core::session::SessionState;
use lean_ctx::server::registry::{ToolRegistry, build_registry};
use lean_ctx::server::tool_trait::{ToolContext, ToolOutput};
use lean_ctx::tools::{CrpMode, SharedCache};

use crate::error::Error;
use crate::output::Output;
use crate::read::ReadMode;

/// File-mutating tools, gated behind [`EngineBuilder::allow_write`].
const WRITE_TOOLS: &[&str] = &["ctx_edit", "ctx_fill"];
/// Command-executing tools, gated behind [`EngineBuilder::allow_exec`].
const EXEC_TOOLS: &[&str] = &["ctx_shell", "ctx_execute", "shell"];

/// Builds an [`Engine`] with explicit, safe-by-default configuration.
#[derive(Debug, Clone)]
pub struct EngineBuilder {
    project_root: PathBuf,
    data_dir: Option<PathBuf>,
    allow_write: bool,
    allow_exec: bool,
    worker_threads: usize,
}

impl EngineBuilder {
    fn new(project_root: impl Into<PathBuf>) -> Self {
        Self {
            project_root: project_root.into(),
            data_dir: None,
            allow_write: false,
            allow_exec: false,
            worker_threads: 2,
        }
    }

    /// Scope engine state (sessions, caches, indexes) to `dir` instead of the
    /// default throwaway temp dir. Pass your real lean-ctx data dir to share
    /// session memory with the CLI/MCP server.
    #[must_use]
    pub fn data_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.data_dir = Some(dir.into());
        self
    }

    /// Permit file-mutating tools (`ctx_edit`, `ctx_fill`) via [`Engine::call`].
    #[must_use]
    pub fn allow_write(mut self, yes: bool) -> Self {
        self.allow_write = yes;
        self
    }

    /// Permit command-executing tools (`ctx_shell`, `ctx_execute`) via
    /// [`Engine::call`]. The OS sandbox still applies when distributed as an addon.
    #[must_use]
    pub fn allow_exec(mut self, yes: bool) -> Self {
        self.allow_exec = yes;
        self
    }

    /// Number of Tokio worker threads backing the engine (default 2, min 1).
    #[must_use]
    pub fn worker_threads(mut self, n: usize) -> Self {
        self.worker_threads = n.max(1);
        self
    }

    /// Finalize configuration and construct the [`Engine`].
    ///
    /// # Errors
    /// Returns [`Error::Init`] if the project root does not exist / is not a
    /// directory, or the runtime cannot be built.
    pub fn build(self) -> Result<Engine, Error> {
        let project_root = std::fs::canonicalize(&self.project_root).map_err(|e| {
            Error::Init(format!("project root {}: {e}", self.project_root.display()))
        })?;
        if !project_root.is_dir() {
            return Err(Error::Init(format!(
                "project root {} is not a directory",
                project_root.display()
            )));
        }
        let project_root = project_root.to_string_lossy().into_owned();

        configure_process_env(self.data_dir.as_deref());

        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(self.worker_threads)
            .enable_all()
            .thread_name("lean-ctx-embed")
            .build()
            .map_err(|e| Error::Init(format!("tokio runtime: {e}")))?;

        Ok(Engine {
            project_root,
            cache: Arc::new(RwLock::new(SessionCache::new())),
            session: Arc::new(RwLock::new(SessionState::new())),
            registry: build_registry(),
            crp_mode: CrpMode::Off,
            allow_write: self.allow_write,
            allow_exec: self.allow_exec,
            rt,
        })
    }
}

/// An embedded lean-ctx engine. Construct via [`Engine::builder`].
pub struct Engine {
    project_root: String,
    cache: SharedCache,
    session: Arc<RwLock<SessionState>>,
    registry: ToolRegistry,
    crp_mode: CrpMode,
    allow_write: bool,
    allow_exec: bool,
    rt: tokio::runtime::Runtime,
}

impl Engine {
    /// Start configuring an engine rooted at `project_root` (the `PathJail` root).
    #[must_use]
    pub fn builder(project_root: impl Into<PathBuf>) -> EngineBuilder {
        EngineBuilder::new(project_root)
    }

    /// The resolved, absolute project root this engine is jailed to.
    #[must_use]
    pub fn project_root(&self) -> &str {
        &self.project_root
    }

    /// Read a file through the engine, with compression + cache-delta applied.
    ///
    /// `path` may be relative to the project root or absolute inside it; it is
    /// `PathJail`-checked. A re-read of an unchanged file collapses to a delta.
    ///
    /// # Errors
    /// [`Error::Path`] for jail violations, [`Error::Tool`] if the read fails.
    pub fn read(&self, path: impl AsRef<str>, mode: ReadMode) -> Result<Output, Error> {
        let resolved = self.resolve(path.as_ref())?;
        let mut args = Map::new();
        args.insert("path".into(), Value::String(resolved.clone()));
        args.insert("mode".into(), Value::String(mode.to_string()));

        let mut ctx = self.base_ctx();
        ctx.resolved_paths.insert("path".into(), resolved);

        self.dispatch("ctx_read", args, ctx).map(Output::from)
    }

    /// Regex/literal code search. `subdir` (optional) narrows the search to a
    /// directory under the project root; `None` searches the whole root.
    ///
    /// # Errors
    /// [`Error::Path`] for jail violations, [`Error::Tool`] on failure.
    pub fn search(&self, pattern: &str, subdir: Option<&str>) -> Result<String, Error> {
        let mut args = Map::new();
        args.insert("pattern".into(), Value::String(pattern.to_string()));
        let mut ctx = self.base_ctx();
        if let Some(dir) = subdir {
            let resolved = self.resolve(dir)?;
            args.insert("path".into(), Value::String(resolved.clone()));
            ctx.resolved_paths.insert("path".into(), resolved);
        }
        self.dispatch("ctx_search", args, ctx).map(|o| o.text)
    }

    /// Locate a symbol definition by exact name across the project.
    ///
    /// # Errors
    /// [`Error::Tool`] on failure.
    pub fn symbol(&self, name: &str) -> Result<String, Error> {
        let mut args = Map::new();
        args.insert("name".into(), Value::String(name.to_string()));
        self.dispatch("ctx_symbol", args, self.base_ctx())
            .map(|o| o.text)
    }

    /// Structural outline (symbols/headings) of a single file.
    ///
    /// # Errors
    /// [`Error::Path`] for jail violations, [`Error::Tool`] on failure.
    pub fn outline(&self, path: &str) -> Result<String, Error> {
        let resolved = self.resolve(path)?;
        let mut args = Map::new();
        args.insert("path".into(), Value::String(resolved.clone()));
        let mut ctx = self.base_ctx();
        ctx.resolved_paths.insert("path".into(), resolved);
        self.dispatch("ctx_outline", args, ctx).map(|o| o.text)
    }

    /// Directory tree / repo map rooted at `subdir` (or the project root).
    ///
    /// # Errors
    /// [`Error::Path`] for jail violations, [`Error::Tool`] on failure.
    pub fn tree(&self, subdir: Option<&str>) -> Result<String, Error> {
        let mut args = Map::new();
        let mut ctx = self.base_ctx();
        if let Some(dir) = subdir {
            let resolved = self.resolve(dir)?;
            args.insert("path".into(), Value::String(resolved.clone()));
            ctx.resolved_paths.insert("path".into(), resolved);
        }
        self.dispatch("ctx_tree", args, ctx).map(|o| o.text)
    }

    /// Escape hatch: call any registered tool by name with raw JSON arguments.
    ///
    /// A string `path` argument is `PathJail`-resolved before dispatch. Write and
    /// exec tools require the matching builder opt-in.
    ///
    /// # Errors
    /// [`Error::NotPermitted`] when a gated tool is not enabled,
    /// [`Error::UnknownTool`] for an unregistered name, [`Error::Path`] for jail
    /// violations, [`Error::Tool`] on handler failure.
    pub fn call(&self, tool: &str, mut args: Map<String, Value>) -> Result<Output, Error> {
        if EXEC_TOOLS.contains(&tool) && !self.allow_exec {
            return Err(Error::NotPermitted(tool.to_string()));
        }
        if WRITE_TOOLS.co
```

### Core Architecture Module: `rust/crates/lean-ctx-protocol/src/engine_interface.rs`
```
//! Narrow, local-only Engine interface records.
//!
//! These records describe one deterministic Engine operation. They deliberately
//! exclude agent sessions, Profiles, Kits, planning, tenancy, Cloud transport,
//! and retry orchestration: a host or future SDK owns those concerns.

use crate::{
    CapabilityId, ProtocolReference, ReceiptId, SemanticVersion, Sha256Digest, ValidationError,
    deserialize_schema_version, validate_bounded_opaque_identifier, validate_schema_version,
};
use serde::{Deserialize, Deserializer, Serialize, de::Error as DeError};

const MAX_SOURCE_REFS: usize = 32;
const MAX_MEASUREMENTS: usize = 32;
const MAX_SUPPORTED_OPERATIONS: usize = 32;
const MAX_MEASUREMENT_NAME_LENGTH: usize = 64;

/// Opaque identity for one Engine invocation, scoped to the local Engine.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[serde(transparent)]
pub struct EngineInvocationIdV1(String);

impl EngineInvocationIdV1 {
    /// Construct a bounded opaque invocation identifier.
    pub fn new(value: impl Into<String>) -> Result<Self, ValidationError> {
        let value = value.into();
        validate_bounded_opaque_identifier(&value, "EngineInvocationIdV1")?;
        Ok(Self(value))
    }

    /// Borrow the wire representation.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for EngineInvocationIdV1 {
    type Error = ValidationError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::new(value)
    }
}

impl TryFrom<&str> for EngineInvocationIdV1 {
    type Error = ValidationError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        Self::new(value)
    }
}

impl<'de> Deserialize<'de> for EngineInvocationIdV1 {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        Self::new(String::deserialize(deserializer)?).map_err(DeError::custom)
    }
}

/// Resolved local Engine identity; it is not a tenant, user, or agent identity.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResolvedLocalEngineIdentityV1 {
    pub engine_id: String,
    pub engine_version: SemanticVersion,
}

impl ResolvedLocalEngineIdentityV1 {
    /// Validate local Engine identity fields.
    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_bounded_opaque_identifier(
            &self.engine_id,
            "ResolvedLocalEngineIdentityV1 engine_id",
        )
    }
}

/// One named, versioned Engine capability selected by the caller.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineOperationV1 {
    pub capability_id: CapabilityId,
    pub capability_version: SemanticVersion,
}

/// The result of local policy admission before an Engine operation runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnginePolicyDecisionV1 {
    Admitted,
    Rejected,
}

/// Policy reference and admission decision for a single invocation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnginePolicyAdmissionV1 {
    pub policy_ref: ProtocolReference,
    pub decision: EnginePolicyDecisionV1,
}

/// A deterministic local Engine request after identity and policy resolution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineInvocationV1 {
    #[serde(deserialize_with = "deserialize_schema_version")]
    pub schema_version: u32,
    pub invocation_id: EngineInvocationIdV1,
    pub engine: ResolvedLocalEngineIdentityV1,
    pub operation: EngineOperationV1,
    /// Addressable input retained by the host; raw input is intentionally absent.
    pub input_ref: ProtocolReference,
    /// Digest of the exact bounded input consumed by the Engine.
    pub input_digest: Sha256Digest,
    /// Source lineage available to recovery; includes `input_ref` exactly once.
    pub source_refs: Vec<ProtocolReference>,
    pub policy_admission: EnginePolicyAdmissionV1,
}

impl EngineInvocationV1 {
    /// Validate schema, source lineage, and deterministic input invariants.
    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_schema_version(self.schema_version)?;
        self.engine.validate()?;
        validate_nonempty_unique_refs(&self.source_refs, "EngineInvocationV1 source_refs")?;
        if !self
            .source_refs
            .iter()
            .any(|reference| reference == &self.input_ref)
        {
            return Err(ValidationError::new(
                "EngineInvocationV1 source_refs must contain input_ref",
            ));
        }
        Ok(())
    }
}

/// Whether an observation value was directly measured, derived as an estimate,
/// or unavailable for the invocation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineValueClassificationV1 {
    Measured,
    Estimated,
    Unavailable,
}

/// One bounded, named numerical Engine observation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineMeasurementV1 {
    pub name: String,
    pub unit: String,
    pub classification: EngineValueClassificationV1,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<u64>,
}

impl EngineMeasurementV1 {
    /// Validate named-measurement and classification invariants.
    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_measurement_name(&self.name, "EngineMeasurementV1 name")?;
        validate_measurement_name(&self.unit, "EngineMeasurementV1 unit")?;
        match (self.classification, self.value) {
            (EngineValueClassificationV1::Unavailable, None)
            | (
                EngineValueClassificationV1::Measured | EngineValueClassificationV1::Estimated,
                Some(_),
            ) => Ok(()),
            (EngineValueClassificationV1::Unavailable, Some(_)) => Err(ValidationError::new(
                "EngineMeasurementV1 unavailable values must be omitted",
            )),
            (
                EngineValueClassificationV1::Measured | EngineValueClassificationV1::Estimated,
                None,
            ) => Err(ValidationError::new(
                "EngineMeasurementV1 measured and estimated values require a number",
            )),
        }
    }
}

/// Stable failure taxonomy for a local Engine operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineFailureCodeV1 {
    PolicyRejected,
    SourceUnavailable,
    SourceIntegrityMismatch,
    ResourceLimit,
    UnsupportedOperation,
    Internal,
}

/// Structured, non-secret failure information with an optional recovery route.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineFailureV1 {
    pub code: EngineFailureCodeV1,
    pub retryable_by_host: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_ref: Option<ProtocolReference>,
}

impl EngineFailureV1 {
    /// Validate recovery semantics without prescribing host retries.
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.code == EngineFailureCodeV1::PolicyRejected
            && (self.retryable_by_host || self.recovery_ref.is_some())
        {
            return Err(ValidationError::new(
                "EngineFailureV1 policy_rejected must not request a host retry or recovery route",
            ));
        }
        if matches!(
            self.code,
            EngineFailureCodeV1::SourceUnavailable | EngineFailureCodeV1::SourceIntegrityMismatch
        ) && self.recovery_ref.is_none()
        {
            return Err(ValidationError::new(
                "EngineFailureV1 source failures require a recovery_ref",
            ));
        }
        Ok(())
    }
}

/// Terminal status of one Engine operation; it never controls the host loop.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineObservationStatusV1 {
    Succeeded,
    Degraded,
    Rejected,
    Failed,
}

/// Immutable link from an Engine observation to an integrity-addressed receipt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineReceiptLinkV1 {
    #[serde(deserialize_with = "deserialize_schema_version")]
    pub schema_version: u32,
    pub receipt_id: ReceiptId,
    pub receipt_ref: ProtocolReference,
    pub receipt_digest: Sha256Digest,
    pub invocation_id: EngineInvocationIdV1,
}

impl EngineReceiptLinkV1 {
    /// Validate a receipt link and bind it to the supplied invocation.
    pub fn validate_for(&self, invocation: &EngineInvocationV1) -> Result<(), ValidationError> {
        validate_schema_version(self.schema_version)?;
        if self.invocation_id != invocation.invocation_id {
            return Err(ValidationError::new(
                "EngineReceiptLinkV1 invocation_id must match EngineInvocationV1",
            ));
        }
        Ok(())
    }
}

/// Structured output, measurements, failure state, and optional receipt lineage.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineObservationV1 {
    #[serde(deserialize_with = "deserialize_schema_version")]
    pub schema_version: u32,
    pub invocation_id: EngineInvocationIdV1,
    pub status: EngineObservationStatusV1,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_ref: Option<ProtocolReference>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_digest: Option<Sha256Digest>,
    pub source_lineage: Vec<ProtocolReference>,
    pub measurements: Vec<E
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1984** (2026-10-03): **ctx_search/ctx_tree/ctx_glob refuse wide source dirs inside a project (>50 subdirs, marker only in an ancestor)**
  *Symptoms*: ## Symptom  ``` ctx_search(pattern=…, path="rust/src/core") ERROR: refusing to scan '…/lean-ctx/rust/src/core' — it resolves to a broad or privacy-protected directory (…/lean-ctx/rust/src/core). Pass a specific project directory as `path`. ```  `path="rust/src"` and `path="rust/src/core/graph_index"` work; only `rust/src/core` is refused. Same guard for `ctx_tree` / `ctx_glob` (`tools/walk_guard.rs` → `graph_index::is_safe_scan_root`).  ## Cause  `is_safe_scan_root` (`rust/src/core/graph_index/mod.rs`) ends with a breadth heuristic: a directory with no project marker **of its own** and more than 50 subdirectories is treated as a broad directory and refused. `rust/src/core` has 84 module directories and no `Cargo.toml`/`.git` itself — the markers live in its ancestors (`rust/Cargo.toml`, repo `.git`).  The home-subdirectory branch of the same function already accepts subdirectories of a real project via `has_marker_in_ancestry` (GL#438); the breadth heuristic does not, so large source trees inside a project are refused.  ## Fix  Skip the breadth refusal when the directory lies inside a project (marker in an ancestor below `$HOME`, or anywhere above it for paths outside `$HOME`). Directories without any marker in their ancestry keep the protection. 
  **Post-Mortem & Fix Analysis**:
  > Fixed in #1985 (6652172873): a project marker in an ancestor now counts for the breadth check, so wide source dirs such as rust/src/core are searchable again. Marker-less wide directories keep the protection.

- **Issue #1980** (2026-10-02): **Stale or missing tool output: ctx_shell result cache and proxy tool-result dedup**
  *Symptoms*: ## Report  User report on 3.10.5 (Discord, 2026-10-02):  > While checking the build, ctx_shell reported the binary as still dated Oct 1 after a rebuild that had written it. The same ls through native Bash showed it fresh, and strings confirmed the new code was in it.  Not reproducible with the default config (`ls -lT` via `ctx_shell` before/after a write shows the new mtime). Code review found several paths that can show the model stale or missing tool output; all are fixed together.  ## Defects  ### 1. Opt-in shell result cache serves stale output (`[cache] shell_cache_enabled = true`)  `rust/src/core/ocla/shell_cache_allowlist.rs`, `ShellCommandKey` (`rust/src/core/ocla/cache_types.rs`), `rust/src/tools/registered/ctx_shell.rs`  - `ls`, `find`, `du`, `wc`, `rg`, `grep`, `git status/diff/log` and `cargo test` are cached with `CacheValidator::Immutable`. Their output depends on workspace state that is not part of the key, so a hit after any file change replays the old output verbatim — exactly the reported symptom. - `normalize_path_token` maps **every** absolute path outside the project root to `$PROJECT_ROOT`: `rg x /tmp/a` and `rg x /etc` share one entry. - `shell_cache_key` maps **every** absolute cwd to `$PROJECT_ROOT`: the same command in `rust/` and in the repo root collide. - The L1 map has no TTL and no size cap; the daemon-delivery lookup ignores `shell_cache_enabled`.  No allowlisted command has output that is a function of its key. A sound validator would need a f
  **Post-Mortem & Fix Analysis**:
  > Fixed in #1982 (40e8673b61). ctx_shell no longer replays results from a result cache, and the proxy only replaces a tool output with text the model can reconstruct it from within the same request. Ships with the next release.

- **Issue #1972** (2026-10-02): **bug: lean-ctx systematically deletes ANTHROPIC_BASE_URL from claude config even if its not its own proxy**
  *Symptoms*: **lean-ctx version:** (run `lean-ctx --version`) 3.10.5  **OS:** (macOS / Linux / Windows) linux  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other)  **What happened:**  lean-ctx uninstall  -> then my claude config is broken because I use the Omniroute proxy (ANTHROPIC_BASE_URL=http://localhost:20128) and on uninstall, lean-ctx deletes the line  **What you expected:** Don't touch it  **Steps to reproduce:** 1.  2.  3.   **Relevant output:** ``` (paste terminal output here) ``` 
  **Post-Mortem & Fix Analysis**:
  > on it

- **Issue #1971** (2026-10-02): **bug: lean-ctx-off doesn't work**
  *Symptoms*: **lean-ctx version:** (run `lean-ctx --version`) 3.10.5  **OS:** (macOS / Linux / Windows) linux  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other)  **What happened:**  <img width="832" height="141" alt="Image" src="https://github.com/user-attachments/assets/6a538f5a-3fab-474e-a30d-4291c4e39573" />  **What you expected:**   **Steps to reproduce:** 1.  2.  3.   **Relevant output:** ``` (paste terminal output here) ``` 
  **Post-Mortem & Fix Analysis**:
  > on it

- **Issue #1959** (2026-10-01): **bug:  /usr/local/bin/bash: line 1: _lc: command not found**
  *Symptoms*: **lean-ctx version:** lean-ctx 3.10.5 (rev.802f9731c)  **OS:** FreeBSD 15.1  **AI tool:** kimi-2.5  **What happened:** ```  Bash(lean-ctx grep "GH_TAGNAME\|WRKSRC.*GH_PROJECT" /usr/ports/Mk/Uses/github.mk | head -40)   ⎿  Error: Exit code 127      /usr/local/bin/bash: line 1: _lc: command not found ```  **What you expected:** n/a   **Steps to reproduce:** 1. arbitrary AI workflow  **Relevant output:** see above
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. Root cause: your binary (rev 802f9731c) already contains the #1898 fix, but the shell hook file it sources was written by an older build. Only `lean-ctx init` / `setup` / `update` / `doctor --fix` rewrite `shell-hook.bash`, and a ports/pkg upgrade runs none of them. So your aliases still call `_lc`, which the agent's non-interactive bash cannot resolve.  **Workaround now:** run `lean-ctx doctor --fix` (or `lean-ctx init --global`) once, then open a new shell or agent session. That regenerates the hook, so aliases call `lean_ctx_track`, and it installs the `_lc` PATH fallback shims.  **Fix:** the MCP server now refreshes installed shell hooks on start whenever they are stale, so package-manager upgrades no longer leave an old hook behind. The PR follows shortly. For the port: no post-install step is needed once that lands.

- **Issue #1947** (2026-09-30): **bug:**
  *Symptoms*: **lean-ctx version:** lean-ctx 3.10.2  **OS:** FreeBSD 15.1  **AI tool:** Claude CLI/kimi-2.7  **What happened:**  Claude said:  ```  I’m blocked by the lean-ctx MCP server — every ctx_* call returns agent bus registration is required before tool execution: cannot establish immutable process identity for PID       51568. Per the session instructions, exploration reads and searches must use those tools, so I can’t safely inspect the port right now.                                            ```  **What you expected:** n/a  **Steps to reproduce:** 1. arbitrary AI workflow  
  **Post-Mortem & Fix Analysis**:
  > will check.
  > Thanks for the report, @yurivict. That was a real gap: lean-ctx only knew how to identify a process on macOS, Linux and Windows. On FreeBSD it fell into the fail-closed branch, so agent-bus registration refused every tool call.  Fixed in #1956: FreeBSD now uses the process start time (`kern.proc.pid` → `ki_start`) and the executable path (`kern.proc.pathname`), the same PID-reuse-safe identity the other platforms use. It will be in the next release.  We have no FreeBSD CI runner, so a quick confirmation from your FreeBSD 15.1 box once you're on the new version would be much appreciated. If ctx_* calls still fail, please reopen with the exact error.
  > Thanks for fixing it.  I will update to a new release as soon as it would come out and would let you know.

- **Issue #1899** (2026-09-29): **bug: lean-ctx prints: <jemalloc>: option background_thread currently supports pthread only**
  *Symptoms*: On FreeBSD 15.1 lean-ctx prints: ``` $ lean-ctx --version <jemalloc>: option background_thread currently supports pthread only lean-ctx 3.10.2 (official, https://github.com/yvgude/lean-ctx) ```  

- **Issue #1898** (2026-09-29): **bug:**
  *Symptoms*: **lean-ctx version:** lean-ctx 3.10.2 (official, https://github.com/yvgude/lean-ctx)   **OS:** FreeBSD 15.1  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other) Claude CLI, kimi-2.7 model  **What happened:**  Claude CLI prints this: ```  Bash(cd /usr/ports/distfiles/pdfium && ls -lb | grep -a df65 | head -5; echo '---'; find . -maxdepth 1 -name 'df65*' -print0 | xxd | head -5)                   ⎿  Error: Exit code 127                                                                      /usr/local/bin/bash: line 1: _lc: command not found                                                                                                             /usr/local/bin/bash: line 1: _lc: command not found                                                                                                             /usr/local/bin/bash: line 1: _lc: command not found                                                                                                             ---                                                                                                                                                             /usr/local/bin/bash: line 1: _lc: command not found                                                                                                             /usr/local/bin/bash: line 1: _lc: command not found                                                                                                        ```  **What you expected:** n/a  **Steps to 

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

### Incident Patch 1: `e5a3b4a7` (2026-10-04)
**Commit Message**: Merge pull request #1999 from yvgude/fix/bg-shell-test-flake

test(shell): wait up to a minute for background jobs and name the observed state

**File**: `rust/src/server/call_tool/tests.rs` (modified, +44/-51)
```diff
@@ -226,6 +226,46 @@ mod shell_outcome_tests {
         }
     }
 
+    /// Wait until a background job has completed, and say why when it has not.
+    ///
+    /// The callers used to poll for a bare 6–10 s and then assert
+    /// `matches!(status, Some(Completed))`. On a loaded ubuntu runner three
+    /// trivial `printf | yes | head` jobs missed that window one after the
+    /// other (PR #1995), and the assertion could not tell a slow job from one
+    /// that was cancelled or pruned away. The ceiling only costs time when the
+    /// job really is stuck; the panic names the state that was observed.
+    #[cfg(not(windows))]
+    fn wait_for_completed(job_id: &str) {
+        use crate::server::background_shell::JobState;
+        const CEILING: std::time::Duration = std::time::Duration::from_mins(1);
+        let deadline = std::time::Instant::now() + CEILING;
+        loop {
+            let state = crate::server::background_shell::status(job_id);
+            match &state {
+                Some(JobState::Completed { .. }) => return,
+                Some(JobState::Cancelled { output }) => {
+                    panic!("job {job_id} was cancelled instead of completing: {output:?}")
+                }
+                _ if std::time::Instant::now() >= deadline => {
+                    let observed = match state {
+                        None => "gone from the job table (removed or pruned)".to_string(),
+                        Some(JobState::Running { output }) => {
+                            let tail: String = output.chars().rev().take(200).collect();
+                            let tail: String = tail.chars().rev().collect();
+                            format!(
+                                "still running, {} bytes captured, tail {tail:?}",
+                                output.len()
+                            )
+                        }
+                        Some(other) => format!("{other:?}"),
+                    };
+                    panic!("job {job_id} did not complete within {CEILING:?}: {observed}");
+                }
+                _ => std::thread::sleep(std::time::Duration::from_millis(25)),
+            }
+        }
+    }
+
     fn text_of(result: &CallToolResult) -> String {
         result
             .content
@@ -363,19 +403,7 @@ mod shell_outcome_tests {
         };
         let job = BackgroundJobGuard::new(job_id.clone());
         std::fs::write(release_path, b"release").expect("release auto-detached child");
-        for _ in 0..400 {
-            if matches!(
-                crate::server::background_shell::status(&job_id),
-                Some(crate::server::background_shell::JobState::Completed { .. })
-            ) {
-                break;
-            }
-            std::thread::sleep(std::time::Duration::from_millis(25));
-        }
-        assert!(matches!(
-            crate::server::background_shell::status(&job_id),
-            Some(crate::server::background_shell::JobState::Completed { .. })
-        ));
+        wait_for_completed(&job_id);
         (
             pipeline_background_status(&job_id, false, false, false).await,
             job,
@@ -451,22 +479,7 @@ mod shell_outcome_tests {
             Some(30_000),
         );
         let job = BackgroundJobGuard::new(job_id.clone());
-        for _ in 0..400 {
-            if matches!(
-                crate::server::background_shell::status(&job_id),
-                Some(
-                    crate::server::background_shell::JobState::Completed { .. }
-                        | crate::server::background_shell::JobState::Cancelled { .. }
-                )
-            ) {
-                break;
-            }
-            std::thread::sleep(std::time::Duration::from_millis(25));
-        }
-        assert!(matches!(
-            crate::server::background_shell::status(&job_id),
-            Some(crate::server::background_shell::JobState::Completed { .. })
-        ));
+        wait_for_completed(&job_id);
         (job_id, job)
     }
 
@@ -756,15 +769,7 @@ mod shell_outcome_tests {
         assert!(structured["jobId"].as_str().is_some());
         assert!(structured.get("exitCode").is_none());
 
-        for _ in 0..240 {
-            if matches!(
-                crate::server::background_shell::status(&job.job_id),
-                Some(crate::server::background_shell::JobState::Completed { .. })
-            ) {
-                break;
-            }
-            std::thread::sleep(std::time::Duration::from_millis(25));
-        }
+        wait_for_completed(&job.job_id);
         let terminal = pipeline_background_status(&job.job_id, false, false, false).await;
         let archive_id = structured_of(&terminal)["archiveId"]
             .as_str()
@@ -996,19 +1001,7 @@ mod shell_outcome_tests {
             Some(10_000),
         );
         let _job = BackgroundJobGuard::new(job_id.clone());
-        for _ in 0..240 {
-            if matches!(
-                crate::ser
```

---

### Incident Patch 2: `fd7d2802` (2026-10-03)
**Commit Message**: Merge pull request #1998 from yvgude/fix/claude-mod-hook-prefix

claude-mod: match hook context behind Claude Code's same-line frame

**File**: `integrations/claude-code-mod/hooks/register.ts` (modified, +7/-2)
```diff
@@ -109,6 +109,8 @@ const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
   },
 ] as const;
 
+const HOOK_CONTEXT_FRAME = /(?:^|\n)([A-Za-z]+ hook additional context: )$/;
+
 type JsonRecord = Record<string, unknown>;
 type WatchJob = { server: string; id: string; contextSent: boolean; misses: number };
 type JobStatus = { state: "running" | "terminal" | "unknown"; exitCode?: number; archiveId?: string; summary?: string };
@@ -648,9 +650,12 @@ function findLeanCtxHookTextBlock(
 ): LeanCtxHookTextBlock | undefined {
   let start = text.indexOf(signature.start);
   while (start !== -1) {
-    if (start === 0 || text[start - 1] === "\n") {
+    // Claude Code frames hook context as "<Event> hook additional context: "
+    // on the same line; the frame goes with the block it introduces.
+    const frame = start === 0 || text[start - 1] === "\n" ? "" : HOOK_CONTEXT_FRAME.exec(text.slice(0, start))?.[1];
+    if (frame !== undefined) {
       const end = findLeanCtxHookTextEnd(text, start, signature);
-      if (end !== undefined) return { start, end };
+      if (end !== undefined) return { start: start - frame.length, end };
     }
     start = text.indexOf(signature.start, start + 1);
   }
```

**File**: `integrations/claude-code-mod/tests/claude-code-mod.test.ts` (modified, +15/-0)
```diff
@@ -51,6 +51,21 @@ test("hook attachments drop only lean-ctx blocks on the main loop and subagents"
   });
   expect(mainLoop).toEqual({ text: null });
 
+  // As captured from Claude Code 2.1.287: the engine prefixes the hook's
+  // context with "<Event> hook additional context: " on the same line.
+  const framed = await $.prompt.attachment({
+    type: "hook_additional_context",
+    text: `SessionStart hook additional context: ${SHARED_HOOK_CONTEXT}`,
+    origin: { kind: "hook", event: "SessionStart" },
+  });
+  expect(framed).toEqual({ text: null });
+  const framedJoined = await $.prompt.attachment({
+    type: "hook_additional_context",
+    text: `Other hook before\nUserPromptSubmit hook additional context: ${SHARED_HOOK_CONTEXT}`,
+    origin: { kind: "hook", event: "UserPromptSubmit" },
+  });
+  expect(framedJoined).toEqual({ text: "Other hook before" });
+
   for (const origin of [
     { kind: "engine" as const },
     { kind: "plugin" as const, event: "prompt.submit" },
```

**File**: `rust/src/templates/claude_mod/register.ts` (modified, +7/-2)
```diff
@@ -109,6 +109,8 @@ const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
   },
 ] as const;
 
+const HOOK_CONTEXT_FRAME = /(?:^|\n)([A-Za-z]+ hook additional context: )$/;
+
 type JsonRecord = Record<string, unknown>;
 type WatchJob = { server: string; id: string; contextSent: boolean; misses: number };
 type JobStatus = { state: "running" | "terminal" | "unknown"; exitCode?: number; archiveId?: string; summary?: string };
@@ -648,9 +650,12 @@ function findLeanCtxHookTextBlock(
 ): LeanCtxHookTextBlock | undefined {
   let start = text.indexOf(signature.start);
   while (start !== -1) {
-    if (start === 0 || text[start - 1] === "\n") {
+    // Claude Code frames hook context as "<Event> hook additional context: "
+    // on the same line; the frame goes with the block it introduces.
+    const frame = start === 0 || text[start - 1] === "\n" ? "" : HOOK_CONTEXT_FRAME.exec(text.slice(0, start))?.[1];
+    if (frame !== undefined) {
       const end = findLeanCtxHookTextEnd(text, start, signature);
-      if (end !== undefined) return { start, end };
+      if (end !== undefined) return { start: start - frame.length, end };
     }
     start = text.indexOf(signature.start, start + 1);
   }
```

---

### Incident Patch 3: `2bb5cc27` (2026-10-03)
**Commit Message**: fix(claude-mod): match hook context behind Claude Code's same-line frame

The K4 channel diet passed CI but dropped nothing live: Claude Code 2.1.287
hands `prompt.attachment` the hook context as
"SessionStart hook additional context: <text>" on one line, and the block
matcher only accepted a lean-ctx signature at the start of a line. A captured
/v1/messages request still carried both the SessionStart nudge and the
per-turn UserPromptSubmit note.

The matcher now accepts the "<Event> hook additional context: " frame in
front of a signature and removes it with the block. Verified against the
real engine: with the patched mod the captured request carries neither text
nor an empty frame. Plugin tests cover the framed and framed-joined cases.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `integrations/claude-code-mod/hooks/register.ts` (modified, +7/-2)
```diff
@@ -109,6 +109,8 @@ const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
   },
 ] as const;
 
+const HOOK_CONTEXT_FRAME = /(?:^|\n)([A-Za-z]+ hook additional context: )$/;
+
 type JsonRecord = Record<string, unknown>;
 type WatchJob = { server: string; id: string; contextSent: boolean; misses: number };
 type JobStatus = { state: "running" | "terminal" | "unknown"; exitCode?: number; archiveId?: string; summary?: string };
@@ -648,9 +650,12 @@ function findLeanCtxHookTextBlock(
 ): LeanCtxHookTextBlock | undefined {
   let start = text.indexOf(signature.start);
   while (start !== -1) {
-    if (start === 0 || text[start - 1] === "\n") {
+    // Claude Code frames hook context as "<Event> hook additional context: "
+    // on the same line; the frame goes with the block it introduces.
+    const frame = start === 0 || text[start - 1] === "\n" ? "" : HOOK_CONTEXT_FRAME.exec(text.slice(0, start))?.[1];
+    if (frame !== undefined) {
       const end = findLeanCtxHookTextEnd(text, start, signature);
-      if (end !== undefined) return { start, end };
+      if (end !== undefined) return { start: start - frame.length, end };
     }
     start = text.indexOf(signature.start, start + 1);
   }
```

**File**: `integrations/claude-code-mod/tests/claude-code-mod.test.ts` (modified, +15/-0)
```diff
@@ -51,6 +51,21 @@ test("hook attachments drop only lean-ctx blocks on the main loop and subagents"
   });
   expect(mainLoop).toEqual({ text: null });
 
+  // As captured from Claude Code 2.1.287: the engine prefixes the hook's
+  // context with "<Event> hook additional context: " on the same line.
+  const framed = await $.prompt.attachment({
+    type: "hook_additional_context",
+    text: `SessionStart hook additional context: ${SHARED_HOOK_CONTEXT}`,
+    origin: { kind: "hook", event: "SessionStart" },
+  });
+  expect(framed).toEqual({ text: null });
+  const framedJoined = await $.prompt.attachment({
+    type: "hook_additional_context",
+    text: `Other hook before\nUserPromptSubmit hook additional context: ${SHARED_HOOK_CONTEXT}`,
+    origin: { kind: "hook", event: "UserPromptSubmit" },
+  });
+  expect(framedJoined).toEqual({ text: "Other hook before" });
+
   for (const origin of [
     { kind: "engine" as const },
     { kind: "plugin" as const, event: "prompt.submit" },
```

**File**: `rust/src/templates/claude_mod/register.ts` (modified, +7/-2)
```diff
@@ -109,6 +109,8 @@ const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
   },
 ] as const;
 
+const HOOK_CONTEXT_FRAME = /(?:^|\n)([A-Za-z]+ hook additional context: )$/;
+
 type JsonRecord = Record<string, unknown>;
 type WatchJob = { server: string; id: string; contextSent: boolean; misses: number };
 type JobStatus = { state: "running" | "terminal" | "unknown"; exitCode?: number; archiveId?: string; summary?: string };
@@ -648,9 +650,12 @@ function findLeanCtxHookTextBlock(
 ): LeanCtxHookTextBlock | undefined {
   let start = text.indexOf(signature.start);
   while (start !== -1) {
-    if (start === 0 || text[start - 1] === "\n") {
+    // Claude Code frames hook context as "<Event> hook additional context: "
+    // on the same line; the frame goes with the block it introduces.
+    const frame = start === 0 || text[start - 1] === "\n" ? "" : HOOK_CONTEXT_FRAME.exec(text.slice(0, start))?.[1];
+    if (frame !== undefined) {
       const end = findLeanCtxHookTextEnd(text, start, signature);
-      if (end !== undefined) return { start, end };
+      if (end !== undefined) return { start: start - frame.length, end };
     }
     start = text.indexOf(signature.start, start + 1);
   }
```

---

### Incident Patch 4: `6d325b05` (2026-10-03)
**Commit Message**: feat(claude-mod): one guidance channel per session (concept K4)

With the mod active, Claude Code still fed the model lean-ctx's steering
through redundant channels: the settings-hook SessionStart context and a
per-turn UserPromptSubmit reminder, on top of the MCP server instructions
and the live skill. The mod now drops exactly those lean-ctx-authored hook
blocks through `prompt.attachment`; other hooks' text, engine and plugin
attachments pass through byte-for-byte. Files stay untouched, so sessions
without the mod (--bare, safe mode, other hosts) keep every channel.

- Block boundaries live in one TS constant (starts, ends, solution tails).
- Drift guard: a Rust test renders every SessionStart/UserPromptSubmit text
  observe.rs can emit (all tool profiles, shadow on/off, every solution
  intensity) and asserts the mod cuts each one whole.
- `keep_hook_context` option (default false); `/leanctx` reports dropped
  attachments and characters.
- rules_canonical: `render_with_solution` seam for the drift test; behaviour
  unchanged (`ladder_text()` is empty when solution is disabled).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `integrations/claude-code-mod/.claude-plugin/plugin.json` (modified, +7/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "lean-ctx",
   "version": "0.2.0",
-  "description": "Wake on background job completion, shape native Bash output, keep lean-ctx's core tools in front, and show per-session request usage.",
+  "description": "Wake on background job completion, remove redundant lean-ctx hook context, shape native Bash output, keep core tools in front, and show per-session usage.",
   "author": {
     "name": "Thinkery / Yves Gugger"
   },
@@ -26,6 +26,12 @@
       "title": "Shape native Bash output",
       "description": "Compress large native Bash stdout through lean-ctx (recoverable); off keeps it byte-for-byte.",
       "default": true
+    },
+    "keep_hook_context": {
+      "type": "boolean",
+      "title": "Keep lean-ctx hook context",
+      "description": "Keep lean-ctx SessionStart and UserPromptSubmit context from settings hooks.",
+      "default": false
     }
   }
 }
```

**File**: `integrations/claude-code-mod/README.md` (modified, +11/-2)
```diff
@@ -46,6 +46,14 @@ were waiting** — 7,551 status polls for 1,030 background jobs plus 1,770
   and defers every other lean-ctx tool — including the `shell` alias — behind
   ToolSearch, with descriptions byte-identical. Verified by capturing the real
   `/v1/messages` request: exactly the configured six keep their schema.
+- **One channel for session guidance.** By default, removes lean-ctx-authored
+  settings-hook context from `SessionStart` and `UserPromptSubmit` attachments,
+  including matching lean-ctx blocks when Claude joins several hooks' text.
+  Exact leading signatures keep engine and plugin attachments, other hooks'
+  output, and unrelated security or policy reminders intact. The MCP server
+  instructions and live `lean-ctx` skill remain the guidance channel. Set
+  `keep_hook_context` to `true` to keep the hook context; its default is `false`.
+  `/leanctx` reports how many attachments and characters the mod removed.
 - **Live skill.** Prefixes the `lean-ctx` skill with what is true in this
   session (wake, front-loaded tools, shaping), so it never contradicts the mod.
 - **Compaction that keeps lean-ctx usable.** Before Claude Code compacts the
@@ -56,7 +64,8 @@ were waiting** — 7,551 status polls for 1,030 background jobs plus 1,770
   findings) once, capped at ~500 tokens. Subagent compactions are untouched.
 - **`/leanctx`.** This session's requests, input/output/cache tokens,
   ToolSearch-only requests, lean-ctx calls, answered sleeps, wakes and shaped
-  Bash outputs — from Claude Code's own `turn.step` usage, not estimates.
+  Bash outputs, and dropped hook attachments/characters — from Claude Code's
+  own `turn.step` usage and hook text, not estimates.
 
 It keeps nothing after the session, sends no telemetry, sets no gateway policy
 and stays inert when no lean-ctx MCP server is connected.
@@ -88,6 +97,6 @@ tsc -p integrations/claude-code-mod/tsconfig.json
 `--plugin-dir`. The validator reports:
 
 ```text
-  ❯ ./register.ts hooks: tool.describe{tool=/"^mcp__lean[-_]ctx__[A-Za-z0-9_-]+$"/}, skill.prompt{skill=lean-ctx}, session.start, tool.call, session.compact, prompt.submit, turn.step, command.run{command=leanctx}
+  ❯ ./register.ts hooks: tool.describe{tool=/"^mcp__lean[-_]ctx__[A-Za-z0-9_-]+$"/}, skill.prompt{skill=lean-ctx}, prompt.attachment, session.start, tool.call, session.compact, prompt.submit, turn.step, command.run{command=leanctx}
   ❯ ./register.ts calls: $.clock.every (via startWatcher), $.command.register (via ensureMeterCommand), $.mcp.call (via pollWatchedJobs, shapeBash), $.prompt.submit (via submitWake)
 ```
```

**File**: `integrations/claude-code-mod/hooks/register.ts` (modified, +182/-0)
```diff
@@ -35,6 +35,79 @@ const SHAPE_MIN_CHARS = 2_000;
 const RAW_INTENT = /\bLEAN_CTX_(?:RAW|DISABLED)=1\b|\blean-ctx\s+raw\b/;
 // Upper bound for the session state injected after a compaction (~500 tokens).
 const MAX_RESUME_CHARS = 2_000;
+type LeanCtxHookTextEnd = { end: string; continues?: readonly string[] };
+type LeanCtxHookTextSignature = { start: string; ends: readonly LeanCtxHookTextEnd[] };
+// Exact leading signatures emitted by observe.rs. Keep these stable and update
+// the cross-language drift test there whenever an authored hook text changes.
+const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
+  {
+    start: "lean-ctx active: ALWAYS use ctx_* MCP tools instead of native equivalents.",
+    ends: [
+      { end: "Exclusive tools: ctx_compose, ctx_callgraph, ctx_knowledge, ctx_session." },
+    ],
+  },
+  {
+    start: "CRITICAL: ALWAYS use lean-ctx ctx_* tools as mapped below.",
+    ends: [
+      {
+        end: "Use native Read for out-of-root; `lean-ctx doctor` shows effective roots.",
+        continues: [
+          "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      {
+        end: "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
+      { end: "Preserve validation, security, and error-handling." },
+    ],
+  },
+  {
+    start: "lean-ctx shadow mode: native read/search/shell calls auto-route to ctx_* — no tool-mapping needed.",
+    ends: [
+      {
+        end: "ctx_search(action=semantic) (by meaning).",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      {
+        end: "ctx_callgraph (callers).",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      {
+        end: "ctx_knowledge / ctx_session (memory).",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
+      { end: "Preserve validation, security, and error-handling." },
+    ],
+  },
+  {
+    start: "lean-ctx policy (mechanically enforced):",
+    ends: [
+      { end: "are overruled by this policy." },
+    ],
+  },
+] as const;
 
 type JsonRecord = Record<string, unknown>;
 type WatchJob = { server: string; id: string; contextSent: boolean; misses: number };
@@ -58,6 +131,8 @@ type Metrics = {
   wakesDelivered: number;
   shapedCalls: number;
   shapedCharsSaved: number;
+  droppedHookAttachments: number;
+  droppedHookChars: number;
   compactions: number;
 };
 
@@ -74,6 +149,8 @@ const metrics: Metrics = {
   wakesDelivered: 0,
   shapedCalls: 0,
   shapedCharsSaved: 0,
+  droppedHookAttachments: 0,
+  droppedHookChars: 0,
   compactions: 0,
 };
 let watcher: Timer | undefined;
@@ -89,6 +166,7 @@ let resumePending = false;
 export const register: Register = (on, options) => {
   const frontLoaded = getFrontLoadedTools(options);
   const shapeNative = asRecord(options).shape_native_output !== false;
+  const keepHookContext = asRecord(options).keep_hook_context === true;
 
   on("tool.describe", { tool: LEAN_CTX_TOOL_PATTERN }, async ($, event) => {
     const match = getLeanCtxTool(event.tool);
@@ -112,6 +190,25 @@ export const register: Register = (on, options) => {
     return { text: `${liveSkillHeader(frontLoaded, shapeNative)}\n\n${base.text}` };
   });
 
+  // The MCP instructions and live skill carry the durable guidance. Drop only
+  // exact lean-ctx SessionStart/UserPromptSubmit hook blocks; other authors and
+  // other hook events pass through unchanged. No agentId check keeps this
+  // channel diet active in both the main loop and subagents.
+  on("prompt.attachment", async ($, event, next) => {
+    if (
+      keepHookContext ||
+      event.origin.kind !== "hook" ||
+      (event.origin.event !== "SessionStart" && event.origin.event !== "UserPromptSubmit")
+    ) {
+  
```

**File**: `integrations/claude-code-mod/tests/claude-code-mod.test.ts` (modified, +49/-1)
```diff
@@ -3,6 +3,9 @@ import { expect, mock, test } from "claude-code/testing";
 const SHELL = "mcp__lean-ctx__ctx_shell";
 const WATCH_CONTEXT =
   "This background job is being watched; you will be woken automatically on completion, so do not poll or sleep.";
+const SHARED_HOOK_CONTEXT =
+  "lean-ctx active: ALWAYS use ctx_* MCP tools instead of native equivalents.\n" +
+  "Exclusive tools: ctx_compose, ctx_callgraph, ctx_knowledge, ctx_session.";
 
 function toolResult(text: string) {
   return {
@@ -25,6 +28,45 @@ function bashResult(stdout: string, extra: Record<string, unknown> = {}) {
   return { result: { stdout, stderr: "warning: kept", interrupted: false, ...extra }, text: stdout };
 }
 
+test("hook attachments drop only lean-ctx blocks on the main loop and subagents", async ($, on) => {
+  const forwarded: string[] = [];
+  on("prompt.attachment", ($, event) => {
+    forwarded.push(event.text);
+    return { text: event.text };
+  });
+
+  const joined = `Other hook before\n${SHARED_HOOK_CONTEXT}\nSecurity reminder: keep secrets out.`;
+  const subagent = await $.prompt.attachment({
+    type: "hook_context",
+    text: joined,
+    origin: { kind: "hook", event: "SessionStart" },
+    agentId: "sub-1",
+  });
+  expect(subagent).toEqual({ text: "Other hook before\nSecurity reminder: keep secrets out." });
+
+  const mainLoop = await $.prompt.attachment({
+    type: "hook_context",
+    text: SHARED_HOOK_CONTEXT,
+    origin: { kind: "hook", event: "UserPromptSubmit" },
+  });
+  expect(mainLoop).toEqual({ text: null });
+
+  for (const origin of [
+    { kind: "engine" as const },
+    { kind: "plugin" as const, event: "prompt.submit" },
+    { kind: "hook" as const, event: "PostToolUse" },
+  ]) {
+    const untouched = await $.prompt.attachment({ type: "hook_context", text: SHARED_HOOK_CONTEXT, origin });
+    expect(untouched).toEqual({ text: SHARED_HOOK_CONTEXT });
+  }
+
+  expect(forwarded).toEqual([
+    SHARED_HOOK_CONTEXT,
+    SHARED_HOOK_CONTEXT,
+    SHARED_HOOK_CONTEXT,
+  ]);
+});
+
 // Shape, don't redirect: large native Bash stdout is replaced by ctx_shape's
 // shorter answer; everything else (stderr, small output, raw intent, errors,
 // a failing or non-shrinking shaper) leaves the native result untouched.
@@ -401,6 +443,12 @@ test("/leanctx reports per-session request, token, tool, sleep, and wake counts"
   });
 
   await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/work" });
+  const droppedAttachment = await $.prompt.attachment({
+    type: "hook_context",
+    text: SHARED_HOOK_CONTEXT,
+    origin: { kind: "hook", event: "SessionStart" },
+  });
+  expect(droppedAttachment).toEqual({ text: null });
   await $.tool.call({ tool: SHELL, command: "echo work", run_in_background: true });
   await $.tool.call({ tool: "Bash", command: "sleep 1" });
 
@@ -418,6 +466,6 @@ test("/leanctx reports per-session request, token, tool, sleep, and wake counts"
     presentation: { isFullscreen: false, columns: 80 },
   });
   expect(answer.text).toBe(
-    "Requests 1 · input 12 · output 3 · cache read 4 · cache creation 2 · ToolSearch-only 1 · lean-ctx calls 1 · sleeps answered 1 · wakes delivered 1 · Bash outputs shaped 0 (−0 chars) · compactions 0",
+    `Requests 1 · input 12 · output 3 · cache read 4 · cache creation 2 · ToolSearch-only 1 · lean-ctx calls 1 · sleeps answered 1 · wakes delivered 1 · Bash outputs shaped 0 (−0 chars) · hook attachments dropped 1 (−${SHARED_HOOK_CONTEXT.length} chars) · compactions 0`,
   );
 });
```

**File**: `rust/src/core/rules_canonical.rs` (modified, +28/-18)
```diff
@@ -494,6 +494,21 @@ pub fn render(
     wrapper: Wrapper,
     level: CompressionLevel,
     tool_profile: &super::tool_profiles::ToolProfile,
+) -> String {
+    let cfg = crate::core::config::Config::load();
+    render_with_solution(shadow, wrapper, level, tool_profile, &cfg.solution)
+}
+
+/// Render with an explicit solution-efficiency configuration.
+///
+/// The dedicated hook context uses this seam to exercise every rendered
+/// solution variant in its cross-language boundary drift test.
+pub(crate) fn render_with_solution(
+    shadow: bool,
+    wrapper: Wrapper,
+    level: CompressionLevel,
+    tool_profile: &super::tool_profiles::ToolProfile,
+    solution: &super::config::solution::SolutionConfig,
 ) -> String {
     use super::rules_sections as rs;
 
@@ -535,24 +550,19 @@ pub fn render(
         }
     }
 
-    // Solution Intelligence block: inject efficiency ladder when enabled
-    {
-        let cfg = crate::core::config::Config::load();
-        if cfg.solution.enabled {
-            let ladder = cfg.solution.ladder_text();
-            if !ladder.is_empty() {
-                body.push('\n');
-                if matches!(wrapper, Wrapper::Bare) {
-                    body.push_str(ladder);
-                } else {
-                    body.push_str(SOLUTION_BLOCK_START);
-                    body.push('\n');
-                    body.push_str("SOLUTION EFFICIENCY: stop at first level that applies:\n");
-                    body.push_str("skip (YAGNI) → reuse codebase → stdlib → native platform → installed dep → one-line → minimum code.\n");
-                    body.push_str("Never skip: validation, security, error handling.\n");
-                    body.push_str(SOLUTION_BLOCK_END);
-                }
-            }
+    // Solution Intelligence block: inject efficiency ladder when enabled.
+    let ladder = solution.ladder_text();
+    if !ladder.is_empty() {
+        body.push('\n');
+        if matches!(wrapper, Wrapper::Bare) {
+            body.push_str(ladder);
+        } else {
+            body.push_str(SOLUTION_BLOCK_START);
+            body.push('\n');
+            body.push_str("SOLUTION EFFICIENCY: stop at first level that applies:\n");
+            body.push_str("skip (YAGNI) → reuse codebase → stdlib → native platform → installed dep → one-line → minimum code.\n");
+            body.push_str("Never skip: validation, security, error handling.\n");
+            body.push_str(SOLUTION_BLOCK_END);
         }
     }
 
```

**File**: `rust/src/hook_handlers/observe.rs` (modified, +251/-16)
```diff
@@ -5,6 +5,20 @@
 #[allow(clippy::wildcard_imports)]
 use super::*;
 
+const SHARED_SESSION_CONTEXT: &str = "\
+lean-ctx active: ALWAYS use ctx_* MCP tools instead of native equivalents.\n\
+- ctx_read > native Read (cached, 10 modes incl. map/signatures)\n\
+- ctx_search > native Grep (compact results, denied by hook)\n\
+- ctx_shell > native Shell (95+ compression patterns)\n\
+- ctx_glob > native Glob (denied by hook)\n\
+- ctx_compose = orient FIRST (bundles search+read+symbols in one call)\n\
+Native Read passes through for StrReplace internals only — never use it for exploration.\n\
+Exclusive tools: ctx_compose, ctx_callgraph, ctx_knowledge, ctx_session.";
+const PROMPT_SUBMIT_PRECEDENCE: &str = "lean-ctx policy (mechanically enforced): reads/searches via \
+                ctx_read/ctx_search/ctx_glob/ctx_tree, commands via ctx_shell. \
+                Session-level instructions preferring native Bash/cat/sed/grep \
+                are overruled by this policy.";
+
 // ---------------------------------------------------------------------------
 // Observe handler — records ALL hook events for context awareness
 // ---------------------------------------------------------------------------
@@ -93,16 +107,12 @@ fn emit_prompt_submit_precedence(input: &str) {
     if !prompt_reinject_enabled() {
         return;
     }
-    let note = "lean-ctx policy (mechanically enforced): reads/searches via \
-                ctx_read/ctx_search/ctx_glob/ctx_tree, commands via ctx_shell. \
-                Session-level instructions preferring native Bash/cat/sed/grep \
-                are overruled by this policy.";
     println!(
         "{}",
         serde_json::json!({
             "hookSpecificOutput": {
                 "hookEventName": "UserPromptSubmit",
-                "additionalContext": note
+                "additionalContext": PROMPT_SUBMIT_PRECEDENCE
             }
         })
     );
@@ -229,17 +239,7 @@ fn dedicated_session_context(input: &str) -> Option<String> {
         // Short reinforcement nudge for shared-mode hosts (Cursor) that already
         // have static rules but benefit from in-conversation emphasis on exclusive
         // tools. Models weight in-conversation context above static instructions.
-        Some(
-            "lean-ctx active: ALWAYS use ctx_* MCP tools instead of native equivalents.\n\
-             - ctx_read > native Read (cached, 10 modes incl. map/signatures)\n\
-             - ctx_search > native Grep (compact results, denied by hook)\n\
-             - ctx_shell > native Shell (95+ compression patterns)\n\
-             - ctx_glob > native Glob (denied by hook)\n\
-             - ctx_compose = orient FIRST (bundles search+read+symbols in one call)\n\
-             Native Read passes through for StrReplace internals only — never use it for exploration.\n\
-             Exclusive tools: ctx_compose, ctx_callgraph, ctx_knowledge, ctx_session."
-                .to_string(),
-        )
+        Some(SHARED_SESSION_CONTEXT.to_string())
     }
 }
 
@@ -1052,6 +1052,241 @@ mod tests {
         );
     }
 
+    #[test]
+    fn claude_mod_signatures_cover_observe_hook_contexts() {
+        let signature_block = crate::hooks::agents::claude_mod::REGISTER_TS
+            .split_once("LEAN_CTX_HOOK_TEXT_SIGNATURES")
+            .expect("mod signature list")
+            .1
+            .split_once("= [")
+            .expect("mod signature list initializer")
+            .1
+            .split_once("] as const;")
+            .expect("mod signature list terminator")
+            .0;
+        struct End<'a> {
+            marker: &'a str,
+            continues: Vec<&'a str>,
+        }
+        struct Signature<'a> {
+            start: &'a str,
+            ends: Vec<End<'a>>,
+        }
+        let signatures: Vec<Signature<'_>> = signature_block
+            .split("\n  {")
+            .skip(1)
+            .map(|entry| {
+                let entry = entry
+                    .split("\n  },")
+                    .next()
+                    .expect("signature entry terminator");
+                let start = entry
+                    .lines()
+                    .find_map(|line| {
+                        line.trim()
+                            .strip_prefix("start: \"")
+                            .and_then(|value| value.split_once('\"').map(|(start, _)| start))
+                    })
+                    .expect("signature start");
+                let mut ends = Vec::new();
+                let mut marker = None;
+                let mut continues = Vec::new();
+                let mut reading_continues = false;
+                for line in entry.lines().map(str::trim) {
+                    if let Some(value) = line.strip_prefix("{ end: \"") {
+                        let (end, rest) = value.split_once('\"').expect("inline end marker");
+                        if let Some((_, values)) = rest.split_once("continues: [") {
+                            let
```

**File**: `rust/src/templates/claude_mod/plugin.json` (modified, +7/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "lean-ctx",
   "version": "0.2.0",
-  "description": "Wake on background job completion, shape native Bash output, keep lean-ctx's core tools in front, and show per-session request usage.",
+  "description": "Wake on background job completion, remove redundant lean-ctx hook context, shape native Bash output, keep core tools in front, and show per-session usage.",
   "author": {
     "name": "Thinkery / Yves Gugger"
   },
@@ -26,6 +26,12 @@
       "title": "Shape native Bash output",
       "description": "Compress large native Bash stdout through lean-ctx (recoverable); off keeps it byte-for-byte.",
       "default": true
+    },
+    "keep_hook_context": {
+      "type": "boolean",
+      "title": "Keep lean-ctx hook context",
+      "description": "Keep lean-ctx SessionStart and UserPromptSubmit context from settings hooks.",
+      "default": false
     }
   }
 }
```

**File**: `rust/src/templates/claude_mod/register.ts` (modified, +182/-0)
```diff
@@ -35,6 +35,79 @@ const SHAPE_MIN_CHARS = 2_000;
 const RAW_INTENT = /\bLEAN_CTX_(?:RAW|DISABLED)=1\b|\blean-ctx\s+raw\b/;
 // Upper bound for the session state injected after a compaction (~500 tokens).
 const MAX_RESUME_CHARS = 2_000;
+type LeanCtxHookTextEnd = { end: string; continues?: readonly string[] };
+type LeanCtxHookTextSignature = { start: string; ends: readonly LeanCtxHookTextEnd[] };
+// Exact leading signatures emitted by observe.rs. Keep these stable and update
+// the cross-language drift test there whenever an authored hook text changes.
+const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
+  {
+    start: "lean-ctx active: ALWAYS use ctx_* MCP tools instead of native equivalents.",
+    ends: [
+      { end: "Exclusive tools: ctx_compose, ctx_callgraph, ctx_knowledge, ctx_session." },
+    ],
+  },
+  {
+    start: "CRITICAL: ALWAYS use lean-ctx ctx_* tools as mapped below.",
+    ends: [
+      {
+        end: "Use native Read for out-of-root; `lean-ctx doctor` shows effective roots.",
+        continues: [
+          "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      {
+        end: "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
+      { end: "Preserve validation, security, and error-handling." },
+    ],
+  },
+  {
+    start: "lean-ctx shadow mode: native read/search/shell calls auto-route to ctx_* — no tool-mapping needed.",
+    ends: [
+      {
+        end: "ctx_search(action=semantic) (by meaning).",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      {
+        end: "ctx_callgraph (callers).",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      {
+        end: "ctx_knowledge / ctx_session (memory).",
+        continues: [
+          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
+          "Solution efficiency ladder:",
+          "challenge every requirement, prefer deletion.",
+        ],
+      },
+      { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
+      { end: "Preserve validation, security, and error-handling." },
+    ],
+  },
+  {
+    start: "lean-ctx policy (mechanically enforced):",
+    ends: [
+      { end: "are overruled by this policy." },
+    ],
+  },
+] as const;
 
 type JsonRecord = Record<string, unknown>;
 type WatchJob = { server: string; id: string; contextSent: boolean; misses: number };
@@ -58,6 +131,8 @@ type Metrics = {
   wakesDelivered: number;
   shapedCalls: number;
   shapedCharsSaved: number;
+  droppedHookAttachments: number;
+  droppedHookChars: number;
   compactions: number;
 };
 
@@ -74,6 +149,8 @@ const metrics: Metrics = {
   wakesDelivered: 0,
   shapedCalls: 0,
   shapedCharsSaved: 0,
+  droppedHookAttachments: 0,
+  droppedHookChars: 0,
   compactions: 0,
 };
 let watcher: Timer | undefined;
@@ -89,6 +166,7 @@ let resumePending = false;
 export const register: Register = (on, options) => {
   const frontLoaded = getFrontLoadedTools(options);
   const shapeNative = asRecord(options).shape_native_output !== false;
+  const keepHookContext = asRecord(options).keep_hook_context === true;
 
   on("tool.describe", { tool: LEAN_CTX_TOOL_PATTERN }, async ($, event) => {
     const match = getLeanCtxTool(event.tool);
@@ -112,6 +190,25 @@ export const register: Register = (on, options) => {
     return { text: `${liveSkillHeader(frontLoaded, shapeNative)}\n\n${base.text}` };
   });
 
+  // The MCP instructions and live skill carry the durable guidance. Drop only
+  // exact lean-ctx SessionStart/UserPromptSubmit hook blocks; other authors and
+  // other hook events pass through unchanged. No agentId check keeps this
+  // channel diet active in both the main loop and subagents.
+  on("prompt.attachment", async ($, event, next) => {
+    if (
+      keepHookContext ||
+      event.origin.kind !== "hook" ||
+      (event.origin.event !== "SessionStart" && event.origin.event !== "UserPromptSubmit")
+    ) {
+  
```

---

### Incident Patch 5: `7f20d089` (2026-10-03)
**Commit Message**: Merge pull request #1995 from yvgude/fix/1992-1994-tool-output

fix(tools): truthful write refusals, file-only batch reads, scoped zero-hit search (#1992 #1993 #1994)

**File**: `rust/src/cli/read_cmd.rs` (modified, +4/-4)
```diff
@@ -1228,15 +1228,15 @@ mod grep_exit_status_tests {
 
     #[test]
     fn complete_miss_exits_one() {
-        assert_eq!(grep_exit_status("0 matches for 'x' in 12 files"), 1);
+        assert_eq!(grep_exit_status("0 matches for 'x' (scanned 12 files)"), 1);
     }
 
     #[test]
     fn incomplete_miss_exits_two() {
         for out in [
-            "0 matches for 'x' in 1 files (1 large files skipped: big.log)",
-            "0 matches for 'x' in 4 files\n(2 files skipped: binary/encoding)",
-            "0 matches for 'x' in 9 files (search stopped at the time budget)",
+            "0 matches for 'x' (scanned 1 files) (1 large files skipped: big.log)",
+            "0 matches for 'x' (scanned 4 files)\n(2 files skipped: binary/encoding)",
+            "0 matches for 'x' (scanned 9 files) (search stopped at the time budget)",
         ] {
             assert_eq!(grep_exit_status(out), 2, "{out}");
         }
```

**File**: `rust/src/core/context_kernel/bridge.rs` (modified, +14/-1)
```diff
@@ -132,6 +132,9 @@ fn truncate_to_token_budget(mut text: String, budget: usize) -> String {
         }
     }
     text.truncate(text.floor_char_boundary(low));
+    // #1993: whole entries only. A byte cut left a bullet ending mid-path
+    // (`files:[/Users/<me>`), a record that no longer described itself.
+    text.truncate(text.rfind('\n').map_or(0, |end| end + 1));
     text
 }
 
@@ -234,7 +237,7 @@ pub mod tests {
     use super::super::types::PlanBudget;
     use super::{
         ContextPlanV1, PlanEntry, enforce_plan_for_mode, enrichment_from_plan,
-        format_enrichment_blocks, kernel_gate, verdict_from_blocks,
+        format_enrichment_blocks, kernel_gate, truncate_to_token_budget, verdict_from_blocks,
     };
 
     fn plan(selected: Vec<PlanEntry>) -> ContextPlanV1 {
@@ -272,6 +275,16 @@ pub mod tests {
             .expect("long enrichment should be truncated, not removed");
         assert!(enrichment.verdict.budget_used <= 150);
     }
+    #[test]
+    fn truncation_keeps_whole_entries_only() {
+        let line = "- [success] files:[/Users/me/htdocs/evcc/docs/agents/a.md] (phi=0.25)\n";
+        let text = format!("\n## Relevant Episodes\n{}", line.repeat(40));
+        let cut = truncate_to_token_budget(text, 150);
+        assert!(!cut.is_empty());
+        assert!(cut.ends_with('\n'), "a partial entry survived: {cut:?}");
+        assert!(cut.lines().skip(2).all(|l| l == line.trim_end()));
+    }
+
     #[test]
     fn empty_supplement_when_no_candidates() {
         let verdict = verdict_from_blocks(String::new(), 150);
```

**File**: `rust/src/core/context_kernel/providers.rs` (modified, +52/-0)
```diff
@@ -238,6 +238,7 @@ impl CandidateProvider for EpisodicProvider {
         store
             .search(&ctx.query)
             .into_iter()
+            .filter(|episode| episode_belongs_to(episode, &self.project_root))
             .take(ctx.max_candidates)
             .map(|episode| {
                 let mut metadata = HashMap::new();
@@ -266,6 +267,21 @@ impl CandidateProvider for EpisodicProvider {
     }
 }
 
+/// #1993: a store is keyed by project, but an agent session can touch files in
+/// several projects, so an episode recorded under one root may be about
+/// another entirely. Such an episode is history from a different codebase;
+/// it is kept only when it names no files or at least one under `root`.
+fn episode_belongs_to(episode: &crate::core::episodic_memory::Episode, root: &str) -> bool {
+    let root = std::path::Path::new(root);
+    episode.affected_files.is_empty()
+        || episode.affected_files.iter().any(|file| {
+            let file = std::path::Path::new(file);
+            // `has_root`, not `is_absolute`: on Windows `/home/u/x` has no
+            // drive and is not absolute, yet it is no project-relative path.
+            !file.has_root() || file.starts_with(root)
+        })
+}
+
 /// Supplies task-matched procedures from persistent procedural memory.
 pub(crate) struct ProceduralProvider {
     project_root: String,
@@ -546,4 +562,40 @@ mod tests {
         let provider = KnowledgeProvider::new("/__context_kernel_missing_project__");
         assert!(provider.candidates(&retrieval_context()).is_empty());
     }
+
+    /// #1993: reading files under one project surfaced an episode whose files
+    /// all lay in another project.
+    #[test]
+    fn episodes_about_another_project_are_not_candidates() {
+        use crate::core::episodic_memory::{Episode, Outcome};
+        let episode = |files: &[&str]| Episode {
+            id: "e".to_string(),
+            session_id: "s".to_string(),
+            timestamp: chrono::Utc::now(),
+            task_description: String::new(),
+            actions: Vec::new(),
+            outcome: Outcome::Unknown,
+            affected_files: files.iter().map(ToString::to_string).collect(),
+            summary: String::new(),
+            duration_secs: 0,
+            tokens_used: 0,
+            agent_id: None,
+        };
+        let root = "/home/u/htdocs/evcc";
+        assert!(!episode_belongs_to(
+            &episode(&["/home/u/htdocs/edifact/a.go", "/home/u/htdocs/edifact/b.go"]),
+            root
+        ));
+        // A sibling whose name merely starts with the root's is still foreign.
+        assert!(!episode_belongs_to(
+            &episode(&["/home/u/htdocs/evcc-old/a.go"]),
+            root
+        ));
+        assert!(episode_belongs_to(
+            &episode(&["/home/u/htdocs/edifact/a.go", "/home/u/htdocs/evcc/c.go"]),
+            root
+        ));
+        assert!(episode_belongs_to(&episode(&["src/main.rs"]), root));
+        assert!(episode_belongs_to(&episode(&[]), root));
+    }
 }
```

**File**: `rust/src/core/search_index.rs` (modified, +12/-0)
```diff
@@ -283,6 +283,18 @@ impl SearchIndex {
         }
     }
 
+    /// How many indexed files the `include`/`exclude` filters admit — the
+    /// search's scope before trigram narrowing. #1994: a narrowed miss scans
+    /// no file at all, so without this a genuine miss and a filter that
+    /// matched nothing both reported zero files.
+    pub fn scope_count(&self, includes: &[Pattern], excludes: &[Pattern], root: &Path) -> usize {
+        self.files
+            .iter()
+            .filter(|p| glob_matches(p, includes, root))
+            .filter(|p| excludes.is_empty() || !glob_matches(p, excludes, root))
+            .count()
+    }
+
     /// Returns candidate file ids for a pure-literal query, or `None` if the
     /// query is not a trigram-narrowable pure `[A-Za-z0-9_]` literal. Both tiers
     /// return a *superset* of true matches (zero false negatives).
```

**File**: `rust/src/tools/ctx_multi_read.rs` (modified, +13/-1)
```diff
@@ -180,8 +180,20 @@ pub fn handle_with_task_fresh_result(
     } else {
         format!("Read {n} files")
     };
+    // #1993: kernel context is task-scoped, so it follows the summary as one
+    // delimited trailer — never inside a file's section, where a caller
+    // splitting on `---` took it for the tail of file 1. `raw` promises exact
+    // bytes and gets none.
+    let trailer = if mode == "raw" {
+        None
+    } else {
+        ctx_read::kernel_trailer(task)
+    };
     MultiReadResult {
-        text: format!("{body}\n---\n{summary}"),
+        text: match trailer {
+            Some(trailer) => format!("{body}\n---\n{summary}\n\n{trailer}"),
+            None => format!("{body}\n---\n{summary}"),
+        },
         original_tokens: total_original,
     }
 }
```

**File**: `rust/src/tools/ctx_read/dispatch.rs` (modified, +4/-2)
```diff
@@ -1,6 +1,6 @@
 use super::{
     CrpMode, ReadMode, ReadOutput, ReadTuning, SessionCache, count_tokens, dedup_hook,
-    handle_with_options_inner, kernel, protocol,
+    handle_with_options_inner, protocol,
 };
 const MAX_RELAY_CONTENT_BYTES: usize = 8192;
 
@@ -70,7 +70,9 @@ pub fn handle_with_task_result(
         task,
         ReadTuning::resolve(None, &[]),
     );
-    kernel::enrich_with_kernel(&mut result.content, task);
+    // #1993: a file's section carries the file and nothing else. Kernel
+    // context is task-scoped, not file-scoped, so a batch appends it once as
+    // its own trailer (see `kernel_trailer`) instead of inside file 1.
     result.output_tokens = count_tokens(&result.content);
     result
 }
```

**File**: `rust/src/tools/ctx_read/kernel.rs` (modified, +21/-30)
```diff
@@ -10,58 +10,49 @@ thread_local! {
     static SEEN_KERNEL_BLOCKS: RefCell<HashSet<String>> = RefCell::new(HashSet::new());
 }
 
-fn append_kernel_blocks(result: &mut String, blocks: &str, seen_hashes: &mut HashSet<String>) {
+fn frame_kernel_blocks(blocks: &str, seen_hashes: &mut HashSet<String>) -> String {
     let framed = format!("--- kernel context ---\n{blocks}");
-    result.push('\n');
-    result.push_str(&dedup_kernel_blocks(&framed, seen_hashes));
+    dedup_kernel_blocks(&framed, seen_hashes)
 }
 
-/// Enrich a read result with cross-store context from the Context Kernel.
+/// Cross-store context from the Context Kernel for the active task, framed as
+/// one self-delimiting block for a batch read to append after its summary.
 ///
-/// Returns `true` if enrichment was appended to `result`.
-pub(super) fn enrich_with_kernel(result: &mut String, task: Option<&str>) -> bool {
+/// #1993: this used to be appended to every file's section, so it landed
+/// between file 1 and its `---` separator — in `raw` mode too. It depends on
+/// the task, not the file, so a batch carries it at most once.
+pub(crate) fn kernel_trailer(task: Option<&str>) -> Option<String> {
     let (Some(task_str), Some(project_root)) =
         (task, crate::core::config::Config::find_project_root())
     else {
-        return false;
+        return None;
     };
 
     let config = load_config(&project_root);
     let budget = supplement_budget(&config);
-    if let Some(enrichment) =
-        crate::core::context_kernel::bridge::kernel_enrich(task_str, &project_root, budget)
-        && !enrichment.blocks.is_empty()
-    {
-        SEEN_KERNEL_BLOCKS.with(|seen_hashes| {
-            append_kernel_blocks(result, &enrichment.blocks, &mut seen_hashes.borrow_mut());
-        });
-        return true;
+    let enrichment =
+        crate::core::context_kernel::bridge::kernel_enrich(task_str, &project_root, budget)?;
+    if enrichment.blocks.is_empty() {
+        return None;
     }
-    false
+    Some(
+        SEEN_KERNEL_BLOCKS.with(|seen_hashes| {
+            frame_kernel_blocks(&enrichment.blocks, &mut seen_hashes.borrow_mut())
+        }),
+    )
 }
 
 #[cfg(test)]
 mod tests {
     use std::collections::HashSet;
 
-    use super::append_kernel_blocks;
+    use super::frame_kernel_blocks;
 
     #[test]
     fn duplicate_kernel_blocks_become_stubs() {
         let mut seen_hashes = HashSet::new();
-        let mut first = String::new();
-        let mut second = String::new();
-
-        append_kernel_blocks(
-            &mut first,
-            "\n## Relevant Knowledge\n- shared\n",
-            &mut seen_hashes,
-        );
-        append_kernel_blocks(
-            &mut second,
-            "\n## Relevant Knowledge\n- shared\n",
-            &mut seen_hashes,
-        );
+        let first = frame_kernel_blocks("\n## Relevant Knowledge\n- shared\n", &mut seen_hashes);
+        let second = frame_kernel_blocks("\n## Relevant Knowledge\n- shared\n", &mut seen_hashes);
 
         assert!(first.contains("- shared"));
         assert!(!second.contains("- shared"));
```

**File**: `rust/src/tools/ctx_read/mod.rs` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ use helpers::{detect_project_root, find_similar_and_update_semantic_index};
 pub use helpers::{graph_related_hint, is_instruction_file};
 mod fallback_banner;
 mod kernel;
+pub(crate) use kernel::kernel_trailer;
 pub(crate) mod render;
 pub(crate) use render::*;
 /// Type-safe read-mode vocabulary (#528): single source of truth for which
```

---

### Incident Patch 6: `a85f1dc0` (2026-10-03)
**Commit Message**: fix(kernel): judge rooted episode paths as foreign on Windows too (#1993)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `rust/src/core/context_kernel/providers.rs` (modified, +3/-1)
```diff
@@ -276,7 +276,9 @@ fn episode_belongs_to(episode: &crate::core::episodic_memory::Episode, root: &st
     episode.affected_files.is_empty()
         || episode.affected_files.iter().any(|file| {
             let file = std::path::Path::new(file);
-            file.is_relative() || file.starts_with(root)
+            // `has_root`, not `is_absolute`: on Windows `/home/u/x` has no
+            // drive and is not absolute, yet it is no project-relative path.
+            !file.has_root() || file.starts_with(root)
         })
 }
 
```

---

### Incident Patch 7: `590094a5` (2026-10-03)
**Commit Message**: fix(tools): truthful write refusals, file-only batch reads, scoped zero-hit search (#1992 #1993 #1994)

#1992 ctx_shell: the redirect/tee/heredoc/download refusals justified
themselves with compression markers landing in the file. That stopped being
true with #1303 (the child shell performs the redirect). They now state the
real reason once (WRITE_REASON): files you keep go through ctx_patch or the
native Write tool so the read-before-write gate applies, and the verdict does
not depend on output size or raw=true.

#1993 ctx_read batch: kernel enrichment was appended to every file section,
so it landed between file 1 and its `---` separator, in raw mode too. It is
task-scoped, so a batch now appends it once as a trailer after the summary,
and never in raw mode; `raw=true` is honoured for batch reads like single
reads. Episodes whose files all lie outside the project root are no longer
candidates, and the supplement budget cuts at line boundaries instead of
mid-entry.

#1994 ctx_search: with a warm trigram index a genuine miss scanned 0 files,
so it printed the same line as an include that matched nothing. "scanned"
now counts the filter scope (index-pruned files are covered), zero-h

**File**: `rust/src/cli/read_cmd.rs` (modified, +4/-4)
```diff
@@ -1228,15 +1228,15 @@ mod grep_exit_status_tests {
 
     #[test]
     fn complete_miss_exits_one() {
-        assert_eq!(grep_exit_status("0 matches for 'x' in 12 files"), 1);
+        assert_eq!(grep_exit_status("0 matches for 'x' (scanned 12 files)"), 1);
     }
 
     #[test]
     fn incomplete_miss_exits_two() {
         for out in [
-            "0 matches for 'x' in 1 files (1 large files skipped: big.log)",
-            "0 matches for 'x' in 4 files\n(2 files skipped: binary/encoding)",
-            "0 matches for 'x' in 9 files (search stopped at the time budget)",
+            "0 matches for 'x' (scanned 1 files) (1 large files skipped: big.log)",
+            "0 matches for 'x' (scanned 4 files)\n(2 files skipped: binary/encoding)",
+            "0 matches for 'x' (scanned 9 files) (search stopped at the time budget)",
         ] {
             assert_eq!(grep_exit_status(out), 2, "{out}");
         }
```

**File**: `rust/src/core/context_kernel/bridge.rs` (modified, +14/-1)
```diff
@@ -132,6 +132,9 @@ fn truncate_to_token_budget(mut text: String, budget: usize) -> String {
         }
     }
     text.truncate(text.floor_char_boundary(low));
+    // #1993: whole entries only. A byte cut left a bullet ending mid-path
+    // (`files:[/Users/<me>`), a record that no longer described itself.
+    text.truncate(text.rfind('\n').map_or(0, |end| end + 1));
     text
 }
 
@@ -234,7 +237,7 @@ pub mod tests {
     use super::super::types::PlanBudget;
     use super::{
         ContextPlanV1, PlanEntry, enforce_plan_for_mode, enrichment_from_plan,
-        format_enrichment_blocks, kernel_gate, verdict_from_blocks,
+        format_enrichment_blocks, kernel_gate, truncate_to_token_budget, verdict_from_blocks,
     };
 
     fn plan(selected: Vec<PlanEntry>) -> ContextPlanV1 {
@@ -272,6 +275,16 @@ pub mod tests {
             .expect("long enrichment should be truncated, not removed");
         assert!(enrichment.verdict.budget_used <= 150);
     }
+    #[test]
+    fn truncation_keeps_whole_entries_only() {
+        let line = "- [success] files:[/Users/me/htdocs/evcc/docs/agents/a.md] (phi=0.25)\n";
+        let text = format!("\n## Relevant Episodes\n{}", line.repeat(40));
+        let cut = truncate_to_token_budget(text, 150);
+        assert!(!cut.is_empty());
+        assert!(cut.ends_with('\n'), "a partial entry survived: {cut:?}");
+        assert!(cut.lines().skip(2).all(|l| l == line.trim_end()));
+    }
+
     #[test]
     fn empty_supplement_when_no_candidates() {
         let verdict = verdict_from_blocks(String::new(), 150);
```

**File**: `rust/src/core/context_kernel/providers.rs` (modified, +50/-0)
```diff
@@ -238,6 +238,7 @@ impl CandidateProvider for EpisodicProvider {
         store
             .search(&ctx.query)
             .into_iter()
+            .filter(|episode| episode_belongs_to(episode, &self.project_root))
             .take(ctx.max_candidates)
             .map(|episode| {
                 let mut metadata = HashMap::new();
@@ -266,6 +267,19 @@ impl CandidateProvider for EpisodicProvider {
     }
 }
 
+/// #1993: a store is keyed by project, but an agent session can touch files in
+/// several projects, so an episode recorded under one root may be about
+/// another entirely. Such an episode is history from a different codebase;
+/// it is kept only when it names no files or at least one under `root`.
+fn episode_belongs_to(episode: &crate::core::episodic_memory::Episode, root: &str) -> bool {
+    let root = std::path::Path::new(root);
+    episode.affected_files.is_empty()
+        || episode.affected_files.iter().any(|file| {
+            let file = std::path::Path::new(file);
+            file.is_relative() || file.starts_with(root)
+        })
+}
+
 /// Supplies task-matched procedures from persistent procedural memory.
 pub(crate) struct ProceduralProvider {
     project_root: String,
@@ -546,4 +560,40 @@ mod tests {
         let provider = KnowledgeProvider::new("/__context_kernel_missing_project__");
         assert!(provider.candidates(&retrieval_context()).is_empty());
     }
+
+    /// #1993: reading files under one project surfaced an episode whose files
+    /// all lay in another project.
+    #[test]
+    fn episodes_about_another_project_are_not_candidates() {
+        use crate::core::episodic_memory::{Episode, Outcome};
+        let episode = |files: &[&str]| Episode {
+            id: "e".to_string(),
+            session_id: "s".to_string(),
+            timestamp: chrono::Utc::now(),
+            task_description: String::new(),
+            actions: Vec::new(),
+            outcome: Outcome::Unknown,
+            affected_files: files.iter().map(ToString::to_string).collect(),
+            summary: String::new(),
+            duration_secs: 0,
+            tokens_used: 0,
+            agent_id: None,
+        };
+        let root = "/home/u/htdocs/evcc";
+        assert!(!episode_belongs_to(
+            &episode(&["/home/u/htdocs/edifact/a.go", "/home/u/htdocs/edifact/b.go"]),
+            root
+        ));
+        // A sibling whose name merely starts with the root's is still foreign.
+        assert!(!episode_belongs_to(
+            &episode(&["/home/u/htdocs/evcc-old/a.go"]),
+            root
+        ));
+        assert!(episode_belongs_to(
+            &episode(&["/home/u/htdocs/edifact/a.go", "/home/u/htdocs/evcc/c.go"]),
+            root
+        ));
+        assert!(episode_belongs_to(&episode(&["src/main.rs"]), root));
+        assert!(episode_belongs_to(&episode(&[]), root));
+    }
 }
```

**File**: `rust/src/core/search_index.rs` (modified, +12/-0)
```diff
@@ -283,6 +283,18 @@ impl SearchIndex {
         }
     }
 
+    /// How many indexed files the `include`/`exclude` filters admit — the
+    /// search's scope before trigram narrowing. #1994: a narrowed miss scans
+    /// no file at all, so without this a genuine miss and a filter that
+    /// matched nothing both reported zero files.
+    pub fn scope_count(&self, includes: &[Pattern], excludes: &[Pattern], root: &Path) -> usize {
+        self.files
+            .iter()
+            .filter(|p| glob_matches(p, includes, root))
+            .filter(|p| excludes.is_empty() || !glob_matches(p, excludes, root))
+            .count()
+    }
+
     /// Returns candidate file ids for a pure-literal query, or `None` if the
     /// query is not a trigram-narrowable pure `[A-Za-z0-9_]` literal. Both tiers
     /// return a *superset* of true matches (zero false negatives).
```

**File**: `rust/src/tools/ctx_multi_read.rs` (modified, +13/-1)
```diff
@@ -180,8 +180,20 @@ pub fn handle_with_task_fresh_result(
     } else {
         format!("Read {n} files")
     };
+    // #1993: kernel context is task-scoped, so it follows the summary as one
+    // delimited trailer — never inside a file's section, where a caller
+    // splitting on `---` took it for the tail of file 1. `raw` promises exact
+    // bytes and gets none.
+    let trailer = if mode == "raw" {
+        None
+    } else {
+        ctx_read::kernel_trailer(task)
+    };
     MultiReadResult {
-        text: format!("{body}\n---\n{summary}"),
+        text: match trailer {
+            Some(trailer) => format!("{body}\n---\n{summary}\n\n{trailer}"),
+            None => format!("{body}\n---\n{summary}"),
+        },
         original_tokens: total_original,
     }
 }
```

**File**: `rust/src/tools/ctx_read/dispatch.rs` (modified, +4/-2)
```diff
@@ -1,6 +1,6 @@
 use super::{
     CrpMode, ReadMode, ReadOutput, ReadTuning, SessionCache, count_tokens, dedup_hook,
-    handle_with_options_inner, kernel, protocol,
+    handle_with_options_inner, protocol,
 };
 const MAX_RELAY_CONTENT_BYTES: usize = 8192;
 
@@ -70,7 +70,9 @@ pub fn handle_with_task_result(
         task,
         ReadTuning::resolve(None, &[]),
     );
-    kernel::enrich_with_kernel(&mut result.content, task);
+    // #1993: a file's section carries the file and nothing else. Kernel
+    // context is task-scoped, not file-scoped, so a batch appends it once as
+    // its own trailer (see `kernel_trailer`) instead of inside file 1.
     result.output_tokens = count_tokens(&result.content);
     result
 }
```

**File**: `rust/src/tools/ctx_read/kernel.rs` (modified, +21/-30)
```diff
@@ -10,58 +10,49 @@ thread_local! {
     static SEEN_KERNEL_BLOCKS: RefCell<HashSet<String>> = RefCell::new(HashSet::new());
 }
 
-fn append_kernel_blocks(result: &mut String, blocks: &str, seen_hashes: &mut HashSet<String>) {
+fn frame_kernel_blocks(blocks: &str, seen_hashes: &mut HashSet<String>) -> String {
     let framed = format!("--- kernel context ---\n{blocks}");
-    result.push('\n');
-    result.push_str(&dedup_kernel_blocks(&framed, seen_hashes));
+    dedup_kernel_blocks(&framed, seen_hashes)
 }
 
-/// Enrich a read result with cross-store context from the Context Kernel.
+/// Cross-store context from the Context Kernel for the active task, framed as
+/// one self-delimiting block for a batch read to append after its summary.
 ///
-/// Returns `true` if enrichment was appended to `result`.
-pub(super) fn enrich_with_kernel(result: &mut String, task: Option<&str>) -> bool {
+/// #1993: this used to be appended to every file's section, so it landed
+/// between file 1 and its `---` separator — in `raw` mode too. It depends on
+/// the task, not the file, so a batch carries it at most once.
+pub(crate) fn kernel_trailer(task: Option<&str>) -> Option<String> {
     let (Some(task_str), Some(project_root)) =
         (task, crate::core::config::Config::find_project_root())
     else {
-        return false;
+        return None;
     };
 
     let config = load_config(&project_root);
     let budget = supplement_budget(&config);
-    if let Some(enrichment) =
-        crate::core::context_kernel::bridge::kernel_enrich(task_str, &project_root, budget)
-        && !enrichment.blocks.is_empty()
-    {
-        SEEN_KERNEL_BLOCKS.with(|seen_hashes| {
-            append_kernel_blocks(result, &enrichment.blocks, &mut seen_hashes.borrow_mut());
-        });
-        return true;
+    let enrichment =
+        crate::core::context_kernel::bridge::kernel_enrich(task_str, &project_root, budget)?;
+    if enrichment.blocks.is_empty() {
+        return None;
     }
-    false
+    Some(
+        SEEN_KERNEL_BLOCKS.with(|seen_hashes| {
+            frame_kernel_blocks(&enrichment.blocks, &mut seen_hashes.borrow_mut())
+        }),
+    )
 }
 
 #[cfg(test)]
 mod tests {
     use std::collections::HashSet;
 
-    use super::append_kernel_blocks;
+    use super::frame_kernel_blocks;
 
     #[test]
     fn duplicate_kernel_blocks_become_stubs() {
         let mut seen_hashes = HashSet::new();
-        let mut first = String::new();
-        let mut second = String::new();
-
-        append_kernel_blocks(
-            &mut first,
-            "\n## Relevant Knowledge\n- shared\n",
-            &mut seen_hashes,
-        );
-        append_kernel_blocks(
-            &mut second,
-            "\n## Relevant Knowledge\n- shared\n",
-            &mut seen_hashes,
-        );
+        let first = frame_kernel_blocks("\n## Relevant Knowledge\n- shared\n", &mut seen_hashes);
+        let second = frame_kernel_blocks("\n## Relevant Knowledge\n- shared\n", &mut seen_hashes);
 
         assert!(first.contains("- shared"));
         assert!(!second.contains("- shared"));
```

**File**: `rust/src/tools/ctx_read/mod.rs` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ use helpers::{detect_project_root, find_similar_and_update_semantic_index};
 pub use helpers::{graph_related_hint, is_instruction_file};
 mod fallback_banner;
 mod kernel;
+pub(crate) use kernel::kernel_trailer;
 pub(crate) mod render;
 pub(crate) use render::*;
 /// Type-safe read-mode vocabulary (#528): single source of truth for which
```

---

### Incident Patch 8: `53958e3e` (2026-10-03)
**Commit Message**: Merge pull request #1991 from yvgude/fix/claude-mod-doctor-version

doctor: match the Claude Code mod by its cache dir name

**File**: `rust/src/doctor/checks/environment.rs` (modified, +1/-1)
```diff
@@ -542,7 +542,7 @@ pub(crate) fn claude_mod_outcome() -> Option<Outcome> {
     }
     let versions = claude_mod::cached_versions(&claude_dir);
     let want = claude_mod::mod_version();
-    let line = if versions.contains(&want) {
+    let line = if versions.contains(&claude_mod::cache_dir_name(&want)) {
         format!("{BOLD}Claude Code mod{RST}  {GREEN}installed ({want}){RST}")
     } else if let Some(old) = versions.last() {
         format!(
```

**File**: `rust/src/hooks/agents/claude_mod.rs` (modified, +25/-1)
```diff
@@ -213,7 +213,9 @@ pub fn install() -> Result<String, String> {
 
 /// Installed plugin versions read from Claude Code's plugin cache
 /// (`<claude dir>/plugins/cache/lean-ctx/lean-ctx/<version>/`) — a file-only
-/// probe for `doctor`, which must not spawn `claude`.
+/// probe for `doctor`, which must not spawn `claude`. Directory names are as
+/// Claude Code writes them: it replaces the `+` of build metadata with `-`
+/// (`3.10.5+5ed30c51` is cached as `3.10.5-5ed30c51`), see [`cache_dir_name`].
 #[must_use]
 pub fn cached_versions(claude_dir: &Path) -> Vec<String> {
     let mut versions: Vec<String> = std::fs::read_dir(
@@ -234,6 +236,13 @@ pub fn cached_versions(claude_dir: &Path) -> Vec<String> {
     versions
 }
 
+/// The cache directory Claude Code (2.1.287) creates for a plugin version:
+/// `+` is not kept in the path, so build metadata appears as `-…`.
+#[must_use]
+pub fn cache_dir_name(version: &str) -> String {
+    version.replace('+', "-")
+}
+
 /// Remove the plugin, the marketplace, and the materialized files.
 ///
 /// Success is verified, not assumed: the local files are only deleted once
@@ -338,6 +347,21 @@ fn run_claude(args: &[&str]) -> Result<String, String> {
 mod tests {
     use super::*;
 
+    /// Observed on a real install (2.1.287): Claude Code caches
+    /// `3.10.5+5ed30c51` as `…/3.10.5-5ed30c51/` next to the older `3.10.5/`;
+    /// doctor compared against the `+` form and reported a current mod stale.
+    #[test]
+    fn cache_dir_matches_the_installed_version() {
+        let dir = tempfile::tempdir().unwrap();
+        let cache = dir.path().join("plugins/cache/lean-ctx/lean-ctx");
+        let current = cache_dir_name(&mod_version());
+        for v in ["3.10.5", current.as_str()] {
+            std::fs::create_dir_all(cache.join(v)).unwrap();
+        }
+        assert!(cached_versions(dir.path()).contains(&current));
+        assert!(!current.contains('+'), "{current}");
+    }
+
     #[test]
     fn version_gate_parses_claude_output() {
         assert_eq!(
```

---

### Incident Patch 9: `f25a913d` (2026-10-03)
**Commit Message**: fix(vscode-bridge): dispatch fixed routes with a switch (CodeQL js/unvalidated-dynamic-method-call)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/vscode-lean-ctx/src/bridge/protocol.ts` (modified, +38/-27)
```diff
@@ -126,39 +126,50 @@ export async function handle(
   if (method === "GET" && route === "/health") {
     return { status: 200, body: { status: "ok", ...info } };
   }
-  // A Map, not an object: a client-chosen route must never reach a
-  // prototype property.
-  const ops = new Map<string, (file: string, pos: Position) => Promise<Location[]>>([
-    ["/definition", (f, p) => nav.definition(f, p)],
-    ["/declaration", (f, p) => nav.declaration(f, p)],
-    ["/references", (f, p) => nav.references(f, p)],
-    ["/implementations", (f, p) => nav.implementations(f, p)],
-  ]);
-  const op = ops.get(route);
-  if (method !== "POST" || (!op && route !== "/type_hierarchy")) {
+  // Fixed routes only: a client-chosen string never selects what is called.
+  const known = ["/definition", "/declaration", "/references", "/implementations", "/type_hierarchy"];
+  if (method !== "POST" || !known.includes(route)) {
     return error("NOT_FOUND", `no route ${method} ${route}`, 404);
   }
   const file = typeof body.path === "string" ? requestFile(root, body.path) : null;
   if (!file) return error("FILE_NOT_FOUND", "path is missing or outside the workspace folder");
   const pos = position(body);
   if (!pos) return error("POSITION_OUT_OF_RANGE", "line/character must be non-negative integers");
 
-  if (!op) {
-    const direction: Direction = body.direction === "subtypes" ? "subtypes" : "supertypes";
-    const tree = await nav.typeHierarchy(file, pos, direction);
-    // No `tree` key at all for "nothing here": lean-ctx reads that as "not
-    // answered yet", whereas a tree without children is a definitive answer.
-    if (!tree) return { status: 200, body: { truncated: false } };
-    const node = (n: TypeNode, children: unknown[]) => ({
-      name: n.name,
-      path: wirePath(root, n.file),
-      line: n.line + 1,
-      children,
-    });
-    return {
-      status: 200,
-      body: { tree: node(tree.root, tree.related.map((r) => node(r, []))), truncated: false },
-    };
+  switch (route) {
+    case "/definition":
+      return locationsReply(root, await nav.definition(file, pos));
+    case "/declaration":
+      return locationsReply(root, await nav.declaration(file, pos));
+    case "/references":
+      return locationsReply(root, await nav.references(file, pos));
+    case "/implementations":
+      return locationsReply(root, await nav.implementations(file, pos));
+    default:
+      return typeHierarchyReply(nav, root, file, pos, body);
   }
-  return locationsReply(root, await op(file, pos));
+}
+
+async function typeHierarchyReply(
+  nav: Navigator,
+  root: string,
+  file: string,
+  pos: Position,
+  body: Record<string, unknown>,
+): Promise<Reply> {
+  const direction: Direction = body.direction === "subtypes" ? "subtypes" : "supertypes";
+  const tree = await nav.typeHierarchy(file, pos, direction);
+  // No `tree` key at all for "nothing here": lean-ctx reads that as "not
+  // answered yet", whereas a tree without children is a definitive answer.
+  if (!tree) return { status: 200, body: { truncated: false } };
+  const node = (n: TypeNode, children: unknown[]) => ({
+    name: n.name,
+    path: wirePath(root, n.file),
+    line: n.line + 1,
+    children,
+  });
+  return {
+    status: 200,
+    body: { tree: node(tree.root, tree.related.map((r) => node(r, []))), truncated: false },
+  };
 }
```

---

### Incident Patch 10: `9dfbc961` (2026-10-03)
**Commit Message**: fix(doctor): match the Claude Code mod by its cache dir name

Claude Code 2.1.287 caches a plugin version with build metadata under a
directory that replaces `+` with `-` (`3.10.5+5ed30c51` -> `3.10.5-5ed30c51`).
doctor compared the cache dirs against the `+` form, so a freshly rolled-
forward mod was reported as stale (seen on a real install right after
`lean-ctx claude-mod install`).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `rust/src/doctor/checks/environment.rs` (modified, +1/-1)
```diff
@@ -542,7 +542,7 @@ pub(crate) fn claude_mod_outcome() -> Option<Outcome> {
     }
     let versions = claude_mod::cached_versions(&claude_dir);
     let want = claude_mod::mod_version();
-    let line = if versions.contains(&want) {
+    let line = if versions.contains(&claude_mod::cache_dir_name(&want)) {
         format!("{BOLD}Claude Code mod{RST}  {GREEN}installed ({want}){RST}")
     } else if let Some(old) = versions.last() {
         format!(
```

**File**: `rust/src/hooks/agents/claude_mod.rs` (modified, +25/-1)
```diff
@@ -213,7 +213,9 @@ pub fn install() -> Result<String, String> {
 
 /// Installed plugin versions read from Claude Code's plugin cache
 /// (`<claude dir>/plugins/cache/lean-ctx/lean-ctx/<version>/`) — a file-only
-/// probe for `doctor`, which must not spawn `claude`.
+/// probe for `doctor`, which must not spawn `claude`. Directory names are as
+/// Claude Code writes them: it replaces the `+` of build metadata with `-`
+/// (`3.10.5+5ed30c51` is cached as `3.10.5-5ed30c51`), see [`cache_dir_name`].
 #[must_use]
 pub fn cached_versions(claude_dir: &Path) -> Vec<String> {
     let mut versions: Vec<String> = std::fs::read_dir(
@@ -234,6 +236,13 @@ pub fn cached_versions(claude_dir: &Path) -> Vec<String> {
     versions
 }
 
+/// The cache directory Claude Code (2.1.287) creates for a plugin version:
+/// `+` is not kept in the path, so build metadata appears as `-…`.
+#[must_use]
+pub fn cache_dir_name(version: &str) -> String {
+    version.replace('+', "-")
+}
+
 /// Remove the plugin, the marketplace, and the materialized files.
 ///
 /// Success is verified, not assumed: the local files are only deleted once
@@ -338,6 +347,21 @@ fn run_claude(args: &[&str]) -> Result<String, String> {
 mod tests {
     use super::*;
 
+    /// Observed on a real install (2.1.287): Claude Code caches
+    /// `3.10.5+5ed30c51` as `…/3.10.5-5ed30c51/` next to the older `3.10.5/`;
+    /// doctor compared against the `+` form and reported a current mod stale.
+    #[test]
+    fn cache_dir_matches_the_installed_version() {
+        let dir = tempfile::tempdir().unwrap();
+        let cache = dir.path().join("plugins/cache/lean-ctx/lean-ctx");
+        let current = cache_dir_name(&mod_version());
+        for v in ["3.10.5", current.as_str()] {
+            std::fs::create_dir_all(cache.join(v)).unwrap();
+        }
+        assert!(cached_versions(dir.path()).contains(&current));
+        assert!(!current.contains('+'), "{current}");
+    }
+
     #[test]
     fn version_gate_parses_claude_output() {
         assert_eq!(
```

---

### Incident Patch 11: `23e7a1b0` (2026-10-03)
**Commit Message**: fix(hooks): stop re-parsing every saved session in projects without one (#1988)

In a project with no saved session, every `hook rewrite` / `hook redirect`
loaded the config, which resolves the project root through the latest
session, and found the project index empty. An empty index was treated as
unknown, so each hook process re-parsed the whole session store.

Measured (median, real store of 7,361 sessions / 283 MB, same project dir):
  hook rewrite   2.7 s -> 24 ms
  hook redirect  2.7 s -> 25 ms

- A full-store scan that finds no session records `verified_empty` in the
  project index; the next save for the project clears it. An empty index
  without the mark (older versions, a damaged file) is still repaired.
- The repair merges with the index under its lock instead of overwriting it,
  so a session saved while the scan ran keeps its entry; ids whose file is
  gone are dropped.

Also:
- `benchmark dual-arm` is labelled a synthetic upper bound (its baseline
  never uses the provider's prompt cache); JSON gains
  `"comparison": "synthetic_upper_bound"`. The README no longer quotes its
  percentage as a saving or links the archived methodology.
- New docs/concepts/measurement-sc

**File**: `CHANGELOG.md` (modified, +28/-2)
```diff
@@ -5,6 +5,32 @@ Format follows [Keep a Changelog](https://keepachangelog.com/).
 
 ## [Unreleased]
 
+### Fixed — hooks no longer re-parse every saved session in projects without one
+
+- In a project with no saved session, every `hook rewrite` / `hook redirect`
+  (each agent Bash and Read call) loaded the config, which resolves the project
+  root through the latest session, and found the project index empty. An empty
+  index was treated as "unknown", so each hook process re-parsed the whole
+  session store. Measured on a store with 7,361 sessions (283 MB): a Bash
+  rewrite hook took 2.7 s and a Read redirect 2.7 s (median); with this fix
+  both take ~25 ms.
+- A full-store scan that finds no session now records that in the project
+  index (`verified_empty`). The next save for the project clears it. An empty
+  index without that mark (older versions, a damaged file) is still repaired.
+- The repair merges with the index under its lock instead of overwriting it, so
+  a session saved while the scan ran keeps its index entry.
+
+### Changed — `benchmark dual-arm` is labelled a synthetic upper bound
+
+- Its baseline never uses the provider's prompt cache, while agent hosts cache
+  the prefix with or without lean-ctx. The report now says it is an upper bound,
+  not lean-ctx on vs. off, and the JSON carries
+  `"comparison": "synthetic_upper_bound"`. The README no longer quotes its
+  percentage as a saving.
+- New [measurement scope](docs/concepts/measurement-scope.md) page: what each
+  data path (tool path, proxy, embedded) can observe and which evidence level a
+  savings, reach or quality figure can reach.
+
 ### Added — lean-ctx inside Claude Code (turn economy)
 
 - `lean-ctx claude-mod install|status|uninstall`: installs the lean-ctx Claude
@@ -427,8 +453,8 @@ Format follows [Keep a Changelog](https://keepachangelog.com/).
 - README: the CI testbench and A/B replays are described as mechanism gates,
   and Shadow Mode as a simulated baseline. The archived E-Bench v2 report now
   names the model its result files record (gpt-5.6-terra, not GPT-4.1).
-- Still open in #1905: a powered with/without study and a real holdout arm
-  for compression.
+- Still open from #1905: a powered with/without study. The real holdout arm
+  for compression is listed above.
 
 ### Added — `lean-ctx pack --limit`: one bundle that fits a chat box (#1885)
 
```

**File**: `README.md` (modified, +11/-6)
```diff
@@ -627,11 +627,13 @@ true by construction: an unchanged cached re-read costs ~13 tokens.
 
 lean-ctx's **own cost is measured too**: the CI-measured fixed per-session
 footprint (advertised tool schemas + MCP instructions + wakeup briefing) is
-~3.0K tokens and gated via `lean-ctx doctor overhead --gate`. And the
-long-lived proxy rail has a deterministic self-verify —
-`lean-ctx benchmark dual-arm --json` replays a 72-turn session and prices it per
-model (digest `f5ed145e61ce3689`, 99.4% input-side saving on cache-priced rails;
-methodology: [bench/agent-task/r2](bench/agent-task/r2/README.md)).
+~3.0K tokens and gated via `lean-ctx doctor overhead --gate`. The long-lived
+proxy rail has a deterministic self-verify, `lean-ctx benchmark dual-arm --json`,
+which replays a 72-turn session and prices it per model. Its baseline never uses
+the provider's prompt cache, so the result is a **synthetic upper bound**, not
+lean-ctx on vs. off: agent hosts cache the prefix with or without lean-ctx. For
+on/off evidence use `lean-ctx eval ab`, `lean-ctx eval footprint --compare` or the
+proxy's compression holdout (`[proxy] compression_holdout`, opt-in).
 
 Accuracy is gated, within stated limits. A model-free A/B gate checks that the JSON
 crusher keeps every gold answer in its fixtures while cutting tokens, and proxy
@@ -646,7 +648,10 @@ that compression preserves answer quality. Every eval report states its evidence
 tier (A mechanism … E production); a run below 30 paired tasks is
 `UNDERPOWERED` and fails `--gate` unless run as an explicit `--mechanism` check — see
 [context-quality-v1](docs/contracts/context-quality-v1.md).
-A powered quality study is still open ([#1905](https://github.com/yvgude/lean-ctx/issues/1905)).
+A powered with/without quality study has not been run yet; the proxy's
+compression holdout measures prompt size on real traffic and reports answer
+quality as `unknown`. What each number can and cannot show, per data path:
+[measurement scope](docs/concepts/measurement-scope.md).
 
 - **Latest snapshot**: [BENCHMARKS.md](BENCHMARKS.md)
 - **Reproduce**: `lean-ctx benchmark report .`
```

**File**: `docs/concepts/measurement-scope.md` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+# Measurement scope — what lean-ctx can see, and what its numbers mean
+
+lean-ctx reports token savings, reach and quality evidence. Each number is only
+as strong as what lean-ctx observed. This page states, per data path, what is
+visible, which evidence level a figure can reach, and what stays unknown.
+
+## Data paths
+
+| Path | How it is wired | What lean-ctx sees | What it cannot see |
+|---|---|---|---|
+| **Tool path** (Hybrid / MCP mode) | MCP tools (`ctx_read`, `ctx_search`, `ctx_shell`, …) and shell hooks | The tool output it transformed, before and after; native shell calls a hook let pass (counted, not tokenized) | Provider requests, turns, prompt caching, the model's answers, native tool calls no hook intercepts |
+| **Request path** (proxy) | `lean-ctx proxy enable` points the agent's API base URL at the local proxy (API-key mode) | Every provider request and the provider's usage report (input, cache reads/writes, output) | Turns of clients that bypass the proxy, e.g. subscription logins |
+| **Embedded** | The library or SDK inside another program | What the host passes in | Everything the host does not pass in |
+
+The two paths combine: with the proxy enabled, the tool path still transforms
+tool output, and the proxy additionally sees what reaches the provider.
+
+## Economic evidence levels
+
+`lean-ctx gain` and `ctx_gain` carry an `economic_evidence` field. Levels, from
+weakest to strongest:
+
+| Level | Where it comes from | Supports |
+|---|---|---|
+| `local_estimate` | Nothing observed yet | Token counts of local transformations |
+| `observed_tool_traffic` | Tool path only | Tool-output reduction; **provider bill impact and ROI are `unknown`** |
+| `provider_counted_input` | Proxy with `proxy.counterfactual_metering` (Anthropic); shown in `lean-ctx proxy status` | Input saving of each rewritten request, counted by the provider |
+| `provider_measured_usage` | Proxy carried provider requests | A net figure (savings minus the injected per-turn context), still against an estimated baseline |
+| `paired_control` | Paired with/without provider cost for whole conversations | An end-to-end bill claim |
+
+`lean-ctx gain` reports one of `local_estimate`, `observed_tool_traffic` or
+`provider_measured_usage`; the provider-counted pair stays in
+`lean-ctx proxy status`. No current surface reaches `paired_control` for whole
+conversations.
+The proxy's opt-in compression holdout (`[proxy] compression_holdout`) forwards
+a deterministic share of conversations uncompressed and reports the per-turn
+prompt-size difference with a confidence interval (`lean-ctx output-savings`);
+answer quality is reported as `unknown`.
+
+A figure the path cannot observe is shown as `unknown` — never as the gross
+saving and never as zero.
+
+## Recorded savings
+
+The savings ledger (`lean-ctx savings`, `lean-ctx roi`) is hash-chained and
+signed, so a record cannot be altered unnoticed. Its numbers are local token
+counts (before vs. after lean-ctx), not provider-billed usage.
+
+## Reach
+
+Reach is the share of *observed* tool calls routed through lean-ctx:
+
+```
+observed = routed through lean-ctx + native shell calls a hook let pass
+reach    = routed / observed
+```
+
+Native tool calls that bypass every hook are not observable and are reported as
+`unknown`, so reach is never a share of all agent activity. It is exposed as
+`compression_session.reach` in `/api/session`.
+
+## Quality
+
+Token savings say nothing about answer quality. Quality results carry an
+evidence tier — A mechanism, B deterministic, C recorded replay, D live run,
+E production — and a verdict (`improved`, `non-inferior`, `regressed`,
+`underpowered`). Only a powered run of tier C or higher supports a task-quality
+claim. Details: [context-quality-v1](../contracts/context-quality-v1.md).
+
+`lean-ctx benchmark dual-arm` is a synthetic upper bound: its baseline never uses
+the provider's prompt cache. For on/off evidence use `lean-ctx eval ab`,
+`lean-ctx eval footprint --compare` or the compression holdout.
```

**File**: `docs/contracts/context-quality-v1.md` (modified, +3/-0)
```diff
@@ -146,3 +146,6 @@ task quality — and states `Task Quality: UNMEASURED`. v1 JSON (including
 Documentation and release notes may state a quality claim only with its tier,
 suite, model population and verdict. Tier A/B results support statements about
 mechanisms and invariants only.
+
+Economic figures follow the same rule; their evidence levels per data path are
+described in [measurement scope](../concepts/measurement-scope.md).
```

**File**: `docs/reference/05-advanced.md` (modified, +3/-0)
```diff
@@ -393,6 +393,9 @@ response's billed usage. `/status` then carries a `verified_savings` block
 next to the estimate. Same-request pairing means no traffic-mix confounds; a
 net-negative result (stub overhead exceeding the squeeze) is reported honestly,
 never clamped. Anthropic only — OpenAI/Gemini have no free counting endpoint.
+Scope: this verifies the input saving of each rewritten request. It does not
+measure a conversation run without lean-ctx, which may take a different number
+of turns; see [measurement scope](../concepts/measurement-scope.md).
 
 ```bash
 lean-ctx config set proxy.counterfactual_metering true
```

**File**: `docs/reference/appendix-cli-map.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ Every CLI command lean-ctx exposes, grouped by purpose. Source of truth:
 | `gain` | Token-savings dashboard; `--live`, `--graph`, `--daily`, `--json`, `--wrapped`, `--svg`, `--share`, `--copy`, `--open`, `--publish`, `--leaderboard`, `--unpublish`, `--cost`, `--tasks`, `--agents`, `--heatmap` |
 | `savings [--period day\|week\|month\|all] [--format table\|json\|markdown]` | Cost-intelligence report: token reduction, estimated versus actual cost, CPAO, and top savings sources; example: `lean-ctx savings --period month --format markdown` |
 | `value-report [--format table\|markdown\|json] [--last N]` | Outcome report for recent assessed tasks, including acceptance and CPAO; example: `lean-ctx value-report --format markdown --last 20` |
-| `value [--session <id>\|--all] [--json]` | What lean-ctx did in a session (tokens kept out of context, security events), recomputed from the verified savings ledger and audit trail; exits 1 when a chain is broken |
+| `value [--session <id>\|--all] [--json]` | What lean-ctx did in a session (tokens kept out of context, security events), recomputed from the signed savings ledger and audit trail (chain integrity checked; token counts are local, not provider-billed); exits 1 when a chain is broken |
 | `statusline [--wrap "<cmd>"]` | Claude Code status line (`statusLine.command`), set by `init --agent claude` when none exists; `--wrap` chains your own status line and appends lean-ctx's segment to its first line |
 | `prompt-segment [--shell zsh\|bash\|fish\|plain]` | One dim shell-prompt segment for the current project, or nothing; wired by `init --prompt` (zsh/bash/fish, `off` removes it), `plain` for Starship and other prompt engines — see [value display](../guides/value-display.md) |
 | `prove speed --suite <file> [--runs N] [--budget N] [--json] [--out FILE]` | Signed A/B measurement: the same live model answers each task with a raw context dump and with lean-ctx's context; `--verify [FILE]` re-checks a proof (exit 1 if tampered) — see [value display](../guides/value-display.md#speed) |
```

**File**: `rust/src/core/eval_ab/footprint.rs` (modified, +1/-1)
```diff
@@ -588,7 +588,7 @@ mod tests {
             provider: crate::core::eval_ab::model::PROVIDER_OPENAI.into(),
             endpoint: "http://localhost:11434/v1".into(),
             params: ModelParams {
-                model: "gemma4:e4b".into(),
+                model: "local-model".into(),
                 ..ModelParams::default()
             },
         }
```

**File**: `rust/src/core/mod.rs` (modified, +1/-1)
```diff
@@ -437,7 +437,7 @@ pub mod provider_cache;
 pub mod providers;
 pub(crate) mod read_stub_index;
 pub(crate) mod recovery;
-#[allow(dead_code)] // CQ-03 consumes the receipt API from this module.
+#[allow(dead_code)] // The quality receipt consumes this API; not every function has a caller yet.
 pub(crate) mod recovery_verify;
 pub(crate) mod redaction;
 pub mod reference_docs;
```

---

### Incident Patch 12: `e385fda8` (2026-10-03)
**Commit Message**: test: isolate shared dedup and graph import fixtures

**File**: `rust/src/core/context_kernel/dedup_wiring.rs` (modified, +5/-3)
```diff
@@ -178,19 +178,21 @@ fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
 
 #[cfg(test)]
 pub mod tests {
-    use std::sync::{Mutex, MutexGuard};
+    use std::sync::MutexGuard;
 
     use super::{
         DedupAction, apply_dedup_enabled, check_content_enabled, dedup_stats, invalidate,
         reset_dedup,
     };
 
-    static TEST_LOCK: Mutex<()> = Mutex::new(());
+    use crate::core::context_kernel::kernel_config::{KERNEL_TEST_LOCK, reset_features};
 
     fn isolated() -> MutexGuard<'static, ()> {
-        let guard = TEST_LOCK
+        // Other kernel suites reset this same process-global ledger.
+        let guard = KERNEL_TEST_LOCK
             .lock()
             .unwrap_or_else(std::sync::PoisonError::into_inner);
+        reset_features();
         reset_dedup();
         guard
     }
```

**File**: `rust/src/core/context_package/loader.rs` (modified, +4/-0)
```diff
@@ -750,6 +750,8 @@ mod tests {
     fn v2_graph_import_merges_with_existing() {
         use crate::core::context_package::graph_model::{ContextGraph, ContextNode};
 
+        // Both imports must resolve the same data directory while other tests mutate env.
+        let _env = crate::core::data_dir::test_env_lock();
         let mut first_graph = ContextGraph::new();
         first_graph.add_node(ContextNode::fact("shared", "original", "cat"));
 
@@ -763,6 +765,7 @@ mod tests {
 
         let dir = tempfile::tempdir().unwrap();
         let r1 = load_package(&manifest, &first_content, dir.path().to_str().unwrap()).unwrap();
+        assert!(r1.warnings.is_empty(), "{:?}", r1.warnings);
         assert_eq!(r1.v2_nodes_added, 1);
 
         let mut second_graph = ContextGraph::new();
@@ -777,6 +780,7 @@ mod tests {
         };
 
         let r2 = load_package(&manifest, &second_content, dir.path().to_str().unwrap()).unwrap();
+        assert!(r2.warnings.is_empty(), "{:?}", r2.warnings);
         assert_eq!(r2.v2_nodes_added, 1);
         assert_eq!(r2.v2_nodes_updated, 1);
     }
```

---

### Incident Patch 13: `bcc04218` (2026-10-03)
**Commit Message**: test: refresh signed delivery fixture bindings

**File**: `docs/contracts/delivery-evidence-v1.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"checklist":[{"evidence":{"evidence_class":"rust-integration-test","harness_command":"cargo test --manifest-path rust/Cargo.toml --test main suite::setup_ci_smoke::setup_bootstrap_doctor_status_json_smoke -- --exact --test-threads=1","path":"rust/tests/suite/setup_ci_smoke.rs","selector":"fn setup_bootstrap_doctor_status_json_smoke()","sha256":"0fa39acca141416ad8d975f1908e460b712587d84cd668fbcfc1f22a16d327fe"},"external_acceptance_required":true,"local_status":"component-evidence","stage":"setup"},{"evidence":{"evidence_class":"rust-integration-test","harness_command":"cargo test --manifest-path rust/Cargo.toml --test main suite::onboard_doctor_clean::onboard_yes_leaves_doctor_fully_green -- --exact","path":"rust/tests/suite/onboard_doctor_clean.rs","selector":"fn onboard_yes_leaves_doctor_fully_green()","sha256":"9588dce8106902b393b40081580a85bb110205d0e73db4aa62a3445e8bd7b98c"},"external_acceptance_required":true,"local_status":"component-evidence","stage":"doctor"},{"evidence":{"evidence_class":"rust-unit-test","harness_command":"cargo test --manifest-path rust/Cargo.toml --lib doctor::migrate::tests::contract_outcome_reports_frozen_set -- --exact","path":"rust/src/doctor/migrate.rs","selector":"fn contract_outcome_reports_frozen_set()","sha256":"68c7a247dcd45de6bf4324c703df58bfeca4699dcf4ee51044d748ba2486210b"},"external_acceptance_required":true,"local_status":"component-evidence","stage":"upgrade"},{"evidence":{"evidence_class":"python-unittest","harness_command":"python3 tests/delivery/test_rehearse_delivery.py DeliveryRehearsalTests.test_rehearses_verified_candidate_and_rollback_without_deployment","path":"tests/delivery/test_rehearse_delivery.py","selector":"def test_rehearses_verified_candidate_and_rollback_without_deployment(self):","sha256":"9c8841eea94ae560ca549e5d514c003eb4e1349c748e6b85dc0725e6bee9363a"},"external_acceptance_required":true,"local_status":"offline-rehearsal","stage":"rollback"},{"evidence":{"evidence_class":"rust-integration-test","harness_command":"cargo test --manifest-path rust/Cargo.toml --test main suite::cli_characterization::uninstall_dry_run_exits_zero -- --exact","path":"rust/tests/suite/cli_characterization.rs","selector":"fn uninstall_dry_run_exits_zero()","sha256":"4dcfdd349a66cb5c310ec86ae7192119a10ec810375a1401f38712e1151afe03"},"external_acceptance_required":true,"local_status":"component-evidence","stage":"uninstall"}],"delivery_manifest":{"fixture":{"path":"tests/delivery/valid/delivery-manifest.json","selector":"\"schema_version\":\"leanctx.delivery/v1\"","sha256":"41a28f47b5321aed3fbf52c91815797af124d7165cca76af5b576c4cb9a1ea39"},"schema":{"path":"docs/contracts/delivery-manifest-v1.schema.json","selector":"https://leanctx.dev/contracts/delivery-manifest-v1.schema.json","sha256":"80ac91c631969a9ce305d8701d3eb0ca92b69b6defcd3a2ef6f9b4a80c7ae291"},"trust_root":{"path":"tests/delivery/valid/release-trust-root.json","selector":"\"algorithm\":\"Ed25519\"","sha256":"660fbf46674b8a16166026551e50b032a1ccf58a4d260c4bb4e4218235066083"},"verifier":{"path":"scripts/verify-delivery-manifest.py","selector":"def verify(manifest_path, root, trust_root=None, rotation_plan=None):","sha256":"636e85f32ce7cd7bfb7a6257b6abf78e4a5d3719c063537ccaa04be9163f21cc"}},"owner":{"handle":"@yvgude","source":{"path":".github/CODEOWNERS","selector":"* @yvgude","sha256":"9c52bffaef2f21976aac61d2ce42311a0ae6e393a95006a36f54e1d1edc72656"}},"release":{"publish_channels":[{"id":"engine-release","source_path":".github/workflows/release.yml","source_sha256":"da471bf52ec35dc7e27a58560df4da173d1b75020b69ef7ad215b1b4c720fca6","trigger_pattern":"v[0-9]*"},{"id":"client-release","source_path":".github/workflows/publish-clients.yml","source_sha256":"8461c66a7206618aec27007f0e0589c4b04adf9de090c4a072c4c545fd341096","trigger_pattern":"client-v[0-9]*"}],"targets":[{"artifact":"x86_64-unknown-linux-gnu","certification":"not-asserted","runner":"ubuntu-22.04","target":"x86_64-unknown-linux-gnu"},{"artifact":"x86_64-unknown-linux-gnu-cuda","certification":"not-asserted","runner":"ubuntu-22.04","target":"x86_64-unknown-linux-gnu"},{"artifact":"aarch64-unknown-linux-gnu","certification":"not-asserted","runner":"ubuntu-22.04-arm","target":"aarch64-unknown-linux-gnu"},{"artifact":"x86_64-unknown-linux-musl","certification":"not-asserted","runner":"ubuntu-22.04","target":"x86_64-unknown-linux-musl"},{"artifact":"aarch64-unknown-linux-musl","certification":"not-asserted","runner":"ubuntu-22.04-arm","target":"aarch64-unknown-linux-musl"},{"artifact":"x86_64-apple-darwin","certification":"not-asserted","runner":"macos-15-intel","target":"x86_64-apple-darwin"},{"artifact":"aarch64-apple-darwin","certification":"not-asserted","runner":"macos-15","target":"aarch64-apple-darwin"},{"artifact":"x86_64-pc-windows-msvc","certification":"not-asserted","runner":"windows-2025","target":"x86_64-pc-windows-msvc"},{"artifact":"x86_64-pc-windows-msvc-cuda","certification":"not-asserted","runner":"windows-2025","target":
```

**File**: `tests/delivery/valid/delivery-manifest.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"component":{"name":"lean-ctx","version":"3.9.11"},"configuration":{"migration":"docs/releases/migration-1.0.md","schema_version":"1"},"contracts":{"pack_digest":"sha256:5739c1cb96ff259504bd026982d35081da6ba658f82ba1416e6e8e823187aea4","pack_version":"3.0.0"},"evidence":{"provenance":{"path":"tests/delivery/valid/provenance.slsa.json","sha256":"ecb751e4c5883eaaa7fb0f3e318c01cbf1df54870d3149199650addd4ddb4c6a"},"sbom":{"path":"tests/delivery/valid/sbom.cdx.json","sha256":"feb33f30087a3f75f6fff95b013769a5886141d73aed077a842dcf1aa945dc8c"},"signature":{"path":"tests/delivery/valid/signature.bundle.json","sha256":"5220c89e673e4709d54c21d75b5d21b5003fa4cc870a32147c8478f550f5e1b1"},"vulnerability_report":{"path":"tests/delivery/valid/vulnerability-report.json","sha256":"101212bef7d44062b7bac0c7bb30911200913c344ee21ea5f9e9e907355161a1"}},"image":{"digest":"sha256:66a473ef83fdd7052dd00b0fdde3a8d8a17b7c898f857a91db25aa7ae625165c","reference":"ghcr.io/yvgude/lean-ctx"},"schema_version":"leanctx.delivery/v1","source":{"commit":"39214d08cbf519210a86533da7efe4487b9520f6","repository":"https://github.com/yvgude/lean-ctx"}}
+{"component":{"name":"lean-ctx","version":"3.9.11"},"configuration":{"migration":"docs/releases/migration-1.0.md","schema_version":"1"},"contracts":{"pack_digest":"sha256:6491a58aa2537cc8ab51aca4fecebd0b32793496d6c5f3d77887f40b249afa38","pack_version":"3.0.0"},"evidence":{"provenance":{"path":"tests/delivery/valid/provenance.slsa.json","sha256":"ecb751e4c5883eaaa7fb0f3e318c01cbf1df54870d3149199650addd4ddb4c6a"},"sbom":{"path":"tests/delivery/valid/sbom.cdx.json","sha256":"feb33f30087a3f75f6fff95b013769a5886141d73aed077a842dcf1aa945dc8c"},"signature":{"path":"tests/delivery/valid/signature.bundle.json","sha256":"e46200e02bc46acdb8efcb91606fe2d18f1ebd72af19f20caaa44d692a646ce7"},"vulnerability_report":{"path":"tests/delivery/valid/vulnerability-report.json","sha256":"101212bef7d44062b7bac0c7bb30911200913c344ee21ea5f9e9e907355161a1"}},"image":{"digest":"sha256:66a473ef83fdd7052dd00b0fdde3a8d8a17b7c898f857a91db25aa7ae625165c","reference":"ghcr.io/yvgude/lean-ctx"},"schema_version":"leanctx.delivery/v1","source":{"commit":"39214d08cbf519210a86533da7efe4487b9520f6","repository":"https://github.com/yvgude/lean-ctx"}}
```

**File**: `tests/delivery/valid/signature.bundle.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"algorithm":"Ed25519","key_id":"sha256:21fe31dfa154a261626bf854046fd2271b7bed4b6abe45aa58877ef47f9721b9","payload_sha256":"1f64d4558ab7c3ad6d055a09b4aad75045b9def6a11faca3e6c3412527968524","schema_version":"leanctx.release-signature/v1","signature":"EdnOo2Kaxw7+Jw+TYZr1mboXklyOOFDxyA2Bny66+Cn/YW05p8Ys3o3z9zhtwbjgQgqbkGrW853pBNviPxd1Bg=="}
+{"algorithm":"Ed25519","key_id":"sha256:21fe31dfa154a261626bf854046fd2271b7bed4b6abe45aa58877ef47f9721b9","payload_sha256":"8af678acd58aa085707d160c0b89b28dad0dd7ca94f6ef7beaf6c139ccb7f417","schema_version":"leanctx.release-signature/v1","signature":"V6Zb/rNr/69YrUKV855hs4OpnRxgRbaJmYy0MBwZhiqT1AXdPUDrm9rv1zUrTd40i4DocsCtdUFviY+P0f9NCA=="}
```

---

### Incident Patch 14: `cf979626` (2026-10-03)
**Commit Message**: test: scope Unix probe fixture helper to Unix test builds

**File**: `rust/src/core/ocla/reference_adapters/rtk_shell.rs` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ impl RtkConfig {
     }
 
     /// Extend the version-probe deadline only for process-level test fixtures.
-    #[cfg(test)]
+    #[cfg(all(test, unix))]
     #[must_use]
     pub(crate) fn with_test_version_probe_timeout_ms(mut self, timeout_ms: u64) -> Self {
         assert!(timeout_ms > 0, "test version-probe timeout must be bounded");
```

---

### Incident Patch 15: `13403b3f` (2026-10-03)
**Commit Message**: fix(claude): review hardening — anchored trust, verified uninstall, host-only ctx_shape

Independent review (GPT-6 Luna) of the mod distribution commit:
- `claude` trust is matched by path components under the real home dir or
  fixed system prefixes (a substring test accepted /tmp/x/.local/share/
  claude/...), checked on Windows too (`cmd /C claude` ran any PATH hit),
  the override needs exactly LEAN_CTX_TRUST_CLAUDE_PATH=1, and a
  project-local node_modules/.bin/claude is no longer trusted.
- run_claude drains stdout/stderr on threads and kills + reaps the child on
  every failure path; uninstall only deletes local files once Claude Code
  no longer lists the plugin or marketplace.
- Setup treats --yes and a missing TTY as unattended: a first install
  needs an interactive yes.
- ctx_shape is refused through ctx_call (host-only), bounded to 8 MiB, and
  counts its floor in bytes to match the mod's UTF-16 length; it takes an
  optional exit_code, which the mod sends as 0 for non-error results.
- Machine-readable calls skip the auto-checkpoint early return and the
  once-per-session nudges (also via ctx_call).
- Engine: a *clean* build now has its progress lines folded like a fa

**File**: `integrations/claude-code-mod/hooks/register.ts` (modified, +31/-6)
```diff
@@ -202,7 +202,16 @@ async function shapeBash(
     return result;
   }
   try {
-    const shaped = await $.mcp.call(leanServer, "ctx_shape", { tool: "Bash", command, output: stdout });
+    // A non-error result without a special-exit interpretation exited 0, so the
+    // engine takes its success path (folds build/test noise); otherwise it gets
+    // no exit code and keeps the unknown-outcome guard.
+    const exitCode = record.returnCodeInterpretation ? {} : { exit_code: 0 };
+    const shaped = await $.mcp.call(leanServer, "ctx_shape", {
+      tool: "Bash",
+      command,
+      output: stdout,
+      ...exitCode,
+    });
     if (shaped.isError) return result;
     const text = mcpText(shaped);
     if (!text || text.length >= stdout.length) return result;
@@ -372,6 +381,7 @@ async function pollWatchedJobs($: EngineInterface): Promise<void> {
     );
 
     const finished: FinishedJob[] = [];
+    const lost: WatchJob[] = [];
     for (const check of checks) {
       if (watchedJobs.get(check.key) !== check.job) continue;
       if (!check.status || check.status.state === "running") {
@@ -380,23 +390,39 @@ async function pollWatchedJobs($: EngineInterface): Promise<void> {
       }
       if (check.status.state === "unknown") {
         check.job.misses += 1;
-        if (check.job.misses >= MAX_STATUS_MISSES) watchedJobs.delete(check.key);
+        if (check.job.misses >= MAX_STATUS_MISSES) {
+          watchedJobs.delete(check.key);
+          lost.push(check.job);
+        }
         continue;
       }
       watchedJobs.delete(check.key);
       if (check.response) finished.push({ job: check.job, status: check.status, response: check.response });
     }
     stopWatcherWhenIdle();
-    if (finished.length > 0) submitWake($, finished);
+    const text = [
+      finished.length > 0 ? formatWakeSummary(finished) : "",
+      lost.length > 0 ? formatLostNotice(lost) : "",
+    ].filter(Boolean).join("\n\n");
+    if (text) submitWake($, text);
   } catch {
+    // The watcher can no longer read job state: hand every watched job back
+    // to the model explicitly — it was told it would be woken, so a silent
+    // drop would leave it waiting forever.
+    const lost = [...watchedJobs.values()];
     watchedJobs.clear();
     stopWatcherWhenIdle();
-    // Restore native status polling when the watcher cannot safely read a job.
+    if (lost.length > 0) submitWake($, formatLostNotice(lost));
   } finally {
     watcherTickInProgress = false;
   }
 }
 
+function formatLostNotice(lost: WatchJob[]): string {
+  const ids = lost.map((job) => job.id).sort();
+  return `lean-ctx can no longer watch background job(s) ${ids.join(", ")}: check each once with ctx_shell(background_action="status", job_id=…) when you need its result.`;
+}
+
 function inspectJobStatus(response: McpToolResult, jobId: string): JobStatus {
   const fields = readShellFields(response);
   if (fields.jobId !== undefined && fields.jobId !== jobId) return { state: "unknown" };
@@ -420,8 +446,7 @@ function mcpText(response: McpToolResult): string {
     .join("\n");
 }
 
-function submitWake($: EngineInterface, finished: FinishedJob[]): void {
-  const text = formatWakeSummary(finished);
+function submitWake($: EngineInterface, text: string): void {
   try {
     void $.prompt
       .submit({ text })
```

**File**: `integrations/claude-code-mod/tests/claude-code-mod.test.ts` (modified, +4/-2)
```diff
@@ -56,7 +56,7 @@ test("native Bash stdout is shaped through ctx_shape and fails open", async ($,
   const shapedRecord = shaped.result as Record<string, unknown>;
   expect(String(shapedRecord.stdout)).toContain("Compiling 200 crates");
   expect(shapedRecord.stderr).toBe("warning: kept");
-  expect(shapeCalls[0]).toEqual({ tool: "Bash", command: "cargo build", output: big });
+  expect(shapeCalls[0]).toEqual({ tool: "Bash", command: "cargo build", output: big, exit_code: 0 });
 
   const small = await $.tool.call({ tool: "Bash", command: "small" });
   expect((small.result as Record<string, unknown>).stdout).toBe("ok\n");
@@ -293,7 +293,9 @@ test("sleep waits are answered only while watched and MCP errors fail open", asy
     await clock.advance(2_000);
     await flushMicrotasks();
   }
-  expect(wakes).toEqual([]);
+  // The model was told it would be woken: handing the job back is explicit.
+  expect(wakes.length).toBe(1);
+  expect(wakes[0]).toContain("can no longer watch background job(s) shell_error");
 
   const sleepAfterError = await $.tool.call({ tool: "Bash", command: "sleep 1" });
   expect(sleepAfterError.result).toBe("executed");
```

**File**: `rust/src/core/editor_registry/writers/install/claude.rs` (modified, +59/-53)
```diff
@@ -97,52 +97,59 @@ pub(crate) fn find_in_path(binary: &str) -> Option<std::path::PathBuf> {
     None
 }
 
+/// The trusted `claude` executable, resolved to its real file on every platform
+/// (Windows: `claude.exe`; an npm `claude.cmd` shim cannot be spawned directly
+/// and is not trusted). `LEAN_CTX_TRUST_CLAUDE_PATH=1` overrides the location
+/// check for unusual installs — only the exact value `1`.
 pub(crate) fn validate_claude_binary() -> Result<std::path::PathBuf, String> {
-    let path = find_in_path("claude").ok_or("claude binary not found in PATH")?;
+    let name = if cfg!(windows) {
+        "claude.exe"
+    } else {
+        "claude"
+    };
+    let path = find_in_path(name).ok_or_else(|| format!("{name} not found in PATH"))?;
 
     let canonical =
         std::fs::canonicalize(&path).map_err(|e| format!("cannot resolve claude path: {e}"))?;
+    let home = crate::core::home::resolve_home_dir().and_then(|h| std::fs::canonicalize(h).ok());
 
-    let canonical_str = canonical.to_string_lossy();
-    if !is_trusted_claude_path(&canonical_str)
-        && std::env::var("LEAN_CTX_TRUST_CLAUDE_PATH").is_err()
+    if !is_trusted_claude_path(&canonical, home.as_deref())
+        && std::env::var("LEAN_CTX_TRUST_CLAUDE_PATH").as_deref() != Ok("1")
     {
         return Err(format!(
-            "claude binary resolved to untrusted path: {canonical_str} — set LEAN_CTX_TRUST_CLAUDE_PATH=1 to override"
+            "claude binary resolved to untrusted path: {} — set LEAN_CTX_TRUST_CLAUDE_PATH=1 to override",
+            canonical.display()
         ));
     }
     Ok(canonical)
 }
 
-/// Install locations of genuine Claude Code builds. The official native
-/// installer links `~/.local/bin/claude` to `~/.local/share/claude/versions/<v>`;
-/// without that entry every `claude mcp add-json` on a native install silently
-/// fell back to editing `~/.claude.json` by hand.
-fn is_trusted_claude_path(canonical: &str) -> bool {
-    [
-        "/.claude/",
-        "/.local/share/claude/",
-        "\\AppData\\",
-        "/usr/local/bin/",
-        "/opt/homebrew/",
-        "/nix/store/",
-        "/.npm/",
-        "/.nvm/",
-        "/node_modules/.bin/",
-    ]
-    .iter()
-    .any(|marker| canonical.contains(marker))
-}
-
-/// The trusted `claude` executable for running Claude Code's own CLI
-/// (`claude plugin …`). Windows ships `claude.exe`; an npm `claude.cmd` shim
-/// cannot be spawned directly, so it is reported as unsupported.
-pub(crate) fn claude_binary_for_exec() -> Result<std::path::PathBuf, String> {
-    if cfg!(windows) {
-        return find_in_path("claude.exe")
-            .ok_or_else(|| "claude.exe not found in PATH".to_string());
-    }
-    validate_claude_binary()
+/// Install locations of genuine Claude Code builds, matched by path
+/// *components* (a substring test accepted look-alikes such as
+/// `/tmp/x/.local/share/claude/…`). User-level installs must sit under the real
+/// home directory; system installs under their fixed prefixes. The official
+/// native installer links `~/.local/bin/claude` to
+/// `~/.local/share/claude/versions/<v>`. A project-local `node_modules/.bin`
+/// is deliberately not trusted: it would let any checked-out repo supply the
+/// `claude` lean-ctx executes.
+fn is_trusted_claude_path(canonical: &std::path::Path, home: Option<&std::path::Path>) -> bool {
+    const HOME_ROOTS: &[&str] = &[
+        ".claude",
+        ".local/share/claude",
+        ".npm",
+        ".npm-global",
+        ".nvm",
+        ".bun",
+        "AppData",
+    ];
+    const SYSTEM_ROOTS: &[&str] = &[
+        "/usr/local/bin",
+        "/usr/local/lib/node_modules",
+        "/opt/homebrew",
+        "/nix/store",
+    ];
+    home.is_some_and(|h| HOME_ROOTS.iter().any(|r| canonical.starts_with(h.join(r))))
+        || SYSTEM_ROOTS.iter().any(|r| canonical.starts_with(r))
 }
 
 pub(crate) fn try_claude_mcp_add(desired: &Value) -> Result<WriteResult, String> {
@@ -152,18 +159,10 @@ pub(crate) fn try_claude_mcp_add(desired: &Value) -> Result<WriteResult, String>
 
     let server_json = serde_json::to_string(desired).map_err(|e| e.to_string())?;
 
-    let mut cmd = if cfg!(windows) {
-        let mut c = Command::new("cmd");
-        c.args([
-            "/C", "claude", "mcp", "add-json", "--scope", "user", "lean-ctx",
-        ]);
-        c
-    } else {
-        let claude_path = validate_claude_binary()?;
-        let mut c = Command::new(claude_path);
-        c.args(["mcp", "add-json", "--scope", "user", "lean-ctx"]);
-        c
-    };
+    // Same trusted, canonical executable on every platform — `cmd /C claude`
+    // used to run whatever `claude` PATH resolved to on Windows.
+    let mut cmd = Command::new(validate_claude_binary()?);
+    cmd.args(["mcp", "add-json", "--scope", "user", "lean-ctx"]);
 
     let mut child = cmd
         .stdin(Stdio::piped())
@@ -225,13 +224,20 @@ pub(crate) fn write_mcp_json_fresh(
 
 #[cfg(test)]
 mod trust_test
```

**File**: `rust/src/core/editor_registry/writers/mod.rs` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ mod install;
 mod shared;
 mod uninstall;
 
-pub(crate) use install::claude_binary_for_exec;
+pub(crate) use install::validate_claude_binary;
 pub use shared::auto_approve_tools;
 pub use uninstall::remove_lean_ctx_mcp_server;
 // Routers below dispatch to every install/uninstall writer; a glob keeps the
```

**File**: `rust/src/hooks/agents/claude_mod.rs` (modified, +70/-22)
```diff
@@ -220,14 +220,27 @@ pub fn cached_versions(claude_dir: &Path) -> Vec<String> {
 }
 
 /// Remove the plugin, the marketplace, and the materialized files.
+///
+/// Success is verified, not assumed: the local files are only deleted once
+/// Claude Code no longer lists the plugin — deleting them first would leave a
+/// registered plugin pointing at a missing directory.
 pub fn uninstall() -> Result<String, String> {
     if matches!(status(), ModStatus::ClaudeMissing) {
         return Err(ModStatus::ClaudeMissing.describe());
     }
-    // Removing the marketplace also uninstalls what came from it; the explicit
-    // uninstall first keeps the message accurate when the marketplace is gone.
-    let _ = run_claude(&["plugin", "uninstall", PLUGIN_ID, "--scope", "user"]);
-    let _ = run_claude(&["plugin", "marketplace", "remove", MARKETPLACE]);
+    let uninstall = run_claude(&["plugin", "uninstall", PLUGIN_ID, "--scope", "user"]);
+    let remove = run_claude(&["plugin", "marketplace", "remove", MARKETPLACE]);
+    let still_installed =
+        run_claude(&["plugin", "list", "--json"]).map(|out| installed_version(&out).is_some())?;
+    let marketplace_listed = run_claude(&["plugin", "marketplace", "list", "--json"])
+        .map(|out| marketplace_listed(&out))?;
+    if still_installed || marketplace_listed {
+        let cause = uninstall.err().or(remove.err()).unwrap_or_default();
+        return Err(format!(
+            "{PLUGIN_ID} is still registered with Claude Code{}{cause} — local files kept",
+            if cause.is_empty() { "" } else { ": " }
+        ));
+    }
     if let Ok(root) = marketplace_dir()
         && root.exists()
     {
@@ -236,44 +249,73 @@ pub fn uninstall() -> Result<String, String> {
     Ok(format!("removed {PLUGIN_ID}"))
 }
 
-/// Run `claude <args>` with a hard timeout; stdout on success.
+/// Whether `claude plugin marketplace list --json` names our marketplace.
+#[must_use]
+pub fn marketplace_listed(list_json: &str) -> bool {
+    serde_json::from_str::<Vec<serde_json::Value>>(list_json).is_ok_and(|entries| {
+        entries
+            .iter()
+            .any(|e| e.get("name").and_then(serde_json::Value::as_str) == Some(MARKETPLACE))
+    })
+}
+
+/// Run `claude <args>` with a hard timeout; stdout on success. stdout/stderr
+/// are drained on their own threads (a full pipe would otherwise stall the
+/// child until the timeout), and the child is killed and reaped on every
+/// failure path so no zombie outlives the call.
 fn run_claude(args: &[&str]) -> Result<String, String> {
-    let binary = crate::core::editor_registry::claude_binary_for_exec()?;
+    use std::io::Read as _;
+    let label = || format!("claude {}", args.join(" "));
+    let binary = crate::core::editor_registry::validate_claude_binary()?;
     let mut child = Command::new(&binary)
         .args(args)
         .stdin(std::process::Stdio::null())
         .stdout(std::process::Stdio::piped())
         .stderr(std::process::Stdio::piped())
         .spawn()
-        .map_err(|e| format!("claude {}: {e}", args.join(" ")))?;
+        .map_err(|e| format!("{}: {e}", label()))?;
+    let drain = |pipe: Option<Box<dyn std::io::Read + Send>>| {
+        std::thread::spawn(move || {
+            let mut buf = Vec::new();
+            if let Some(mut p) = pipe {
+                let _ = p.read_to_end(&mut buf);
+            }
+            String::from_utf8_lossy(&buf).into_owned()
+        })
+    };
+    let stdout = drain(child.stdout.take().map(|p| Box::new(p) as Box<_>));
+    let stderr = drain(child.stderr.take().map(|p| Box::new(p) as Box<_>));
     let start = Instant::now();
-    loop {
+    let status = loop {
         match child.try_wait() {
-            Ok(Some(_)) => break,
+            Ok(Some(status)) => break Ok(status),
             Ok(None) if start.elapsed() > CLAUDE_TIMEOUT => {
-                let _ = child.kill();
-                let _ = child.wait();
-                return Err(format!("claude {} timed out", args.join(" ")));
+                break Err(format!("{} timed out", label()));
             }
             Ok(None) => std::thread::sleep(Duration::from_millis(50)),
-            Err(e) => return Err(e.to_string()),
+            Err(e) => break Err(format!("{}: {e}", label())),
         }
-    }
-    let out = child
-        .wait_with_output()
-        .map_err(|e| format!("claude {}: {e}", args.join(" ")))?;
-    if out.status.success() {
-        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
+    };
+    let status = match status {
+        Ok(status) => status,
+        Err(e) => {
+            let _ = child.kill();
+            let _ = child.wait();
+            return Err(e);
+        }
+    };
+    let stdout = stdout.join().unwrap_or_default();
+    let stderr = stderr.join().unwrap_or_default();
+    if status.success() {
+        Ok(stdout)
     } else {
-        let stderr = String::from_utf8_lossy(&out.stderr);
-        let stdout = String::from
```

**File**: `rust/src/proxy/compress.rs` (modified, +9/-4)
```diff
@@ -88,13 +88,18 @@ pub fn compress_tool_result_for(
 /// known (`ctx_shape`, fed by a host mod after the native tool ran). Unlike the
 /// wire funnel, the real command reaches the engine, so its command-gated
 /// policies (protected/verbatim commands, build/test guards, per-tool patterns)
-/// apply exactly as for `ctx_shell`. Lossy results carry the same deterministic
-/// CCR recovery handle (#482, #498).
-pub fn shape_command_output(command: &str, output: &str) -> String {
+/// apply exactly as for `ctx_shell`. With a known `exit_code` the outcome-aware
+/// path runs (success compresses, failure keeps its diagnostics); without one
+/// the engine's unknown-outcome guard applies. Lossy results carry the same
+/// deterministic CCR recovery handle (#482, #498).
+pub fn shape_command_output(command: &str, output: &str, exit_code: Option<i32>) -> String {
     if output.trim().is_empty() || output.len() < 200 {
         return output.to_string();
     }
-    let compressed = crate::shell::compress::engine::compress_if_beneficial_pub(command, output);
+    let compressed = match exit_code {
+        Some(code) => crate::shell::compress::engine::compress_for_outcome(command, output, code),
+        None => crate::shell::compress::engine::compress_if_beneficial_pub(command, output),
+    };
     attach_ccr(output, compressed, CcrAudience::Local)
 }
 
```

**File**: `rust/src/server/call_tool/pipeline.rs` (modified, +5/-1)
```diff
@@ -1021,7 +1021,12 @@ pub(in crate::server) async fn dispatch_and_post_process(
         result_text = rendered;
     }
 
+    // Machine-readable bodies are restored byte-exact further down, but the
+    // auto-checkpoint returns before that restore — so it (and the once-per-
+    // session nudges, which would be thrown away) must not run for them. The
+    // flag is computed from the inner tool, so this also covers `ctx_call`.
     let skip_checkpoint = minimal
+        || machine_readable
         || matches!(
             name,
             "ctx_compress"
@@ -1046,7 +1051,6 @@ pub(in crate::server) async fn dispatch_and_post_process(
                 | "ctx_smells"
                 | "ctx_quality"
                 | "ctx_workflow"
-                | "ctx_shape"
         );
 
     // Output-echo nudge (#501): when the agent keeps re-quoting delivered
```

**File**: `rust/src/server/dispatch/mod.rs` (modified, +10/-0)
```diff
@@ -93,6 +93,16 @@ impl LeanCtxServer {
                         None,
                     ));
                 }
+                // Host hooks are for host extensions (a Claude Code mod's
+                // direct MCP call), not agents: refuse them on the agent path.
+                if crate::server::dynamic_tools::INTERNAL_HOST_TOOLS.contains(&inner.as_str()) {
+                    return Err(ErrorData::invalid_params(
+                        format!(
+                            "{inner} is an internal host hook and cannot be called via ctx_call"
+                        ),
+                        None,
+                    ));
+                }
 
                 let arg_map = match args.and_then(|m| m.get("arguments")) {
                     None | Some(Value::Null) => {
```

#### Recent Merged Pull Requests:
- **PR #1999** (2026-10-04): test(shell): wait up to a minute for background jobs and name the observed state (@yvgude)
- **PR #1998** (2026-10-03): claude-mod: match hook context behind Claude Code's same-line frame (@yvgude)
- **PR #1997** (2026-10-03): claude-mod: one guidance channel per session (K4) (@yvgude)
- **PR #1996** (2026-10-03): feat(semantic): close the plan — repo map on graph calls, negotiated features, no cross-language calls (@yvgude)
- **PR #1995** (2026-10-03): fix(tools): truthful write refusals, file-only batch reads, scoped zero-hit search (#1992 #1993 #1994) (@yvgude)
- **PR #1991** (2026-10-03): doctor: match the Claude Code mod by its cache dir name (@yvgude)
- **PR #1990** (2026-10-03): feat(semantic): references/extends relations, editor bridge (VS Code/Cursor/Windsurf), real-world hardening (@yvgude)
- **PR #1989** (2026-10-03): Claude Code mod: compaction coordination, /leanctx from session start, content-hashed version (@yvgude)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
