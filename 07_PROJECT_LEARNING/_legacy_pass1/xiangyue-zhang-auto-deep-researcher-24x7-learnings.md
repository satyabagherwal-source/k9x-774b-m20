# Forensic Learning Record (Deep Inspection): Xiangyue-Zhang/auto-deep-researcher-24x7

> **Canonical Artifact**: `07_PROJECT_LEARNING/xiangyue-zhang-auto-deep-researcher-24x7-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Xiangyue-Zhang/auto-deep-researcher-24x7](https://github.com/Xiangyue-Zhang/auto-deep-researcher-24x7))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:27:14.211Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Xiangyue-Zhang/auto-deep-researcher-24x7`
- **Description**: 🔥 An autonomous AI agent that runs your deep learning experiments 24/7 while you sleep. Zero-cost monitoring, Leader-Worker architecture, constant-size memory.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1293 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/__init__.py`
```
"""AutoResearcher Core - Autonomous ML Experiment Agent Framework."""

from .execution import (
    ExecutionBackend,
    LocalExecutionBackend,
    SSHExecutionBackend,
    SlurmExecutionBackend,
    build_execution_backend,
)
from .loop import ResearchLoop
from .memory import MemoryManager
from .monitor import ExperimentMonitor
from .agents import AgentDispatcher
from .tools import ToolRegistry

__version__ = "0.1.1"
__all__ = [
    "AgentDispatcher",
    "ExecutionBackend",
    "ExperimentMonitor",
    "LocalExecutionBackend",
    "MemoryManager",
    "ResearchLoop",
    "SSHExecutionBackend",
    "SlurmExecutionBackend",
    "ToolRegistry",
    "build_execution_backend",
]

```

### Core Architecture Module: `core/agents.py`
```
"""
AutoResearcher Agent Dispatcher

Leader-Worker architecture for efficient token usage:
- Leader: Central decision-maker, persistent conversation within a cycle
- Workers: Specialized agents (idea/code/writing), spawned on demand

Only ONE worker runs at a time. Others idle at zero token cost.

Tool use is implemented via a provider-agnostic text protocol. The LLM
emits <tool_call>{...}</tool_call> blocks, the dispatcher executes each
call through the ToolRegistry, and results are fed back as
<tool_result name="...">...</tool_result> blocks in the next user turn.
The loop runs until the worker produces a response with no tool calls
(the final answer) or max_turns is exceeded. This works uniformly
across all four providers — the API SDKs don't use their native
tool-use protocol, and the CLI providers are simply text oracles.
"""

import json
import logging
import os
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger("autoresearcher.agents")


# Agent definitions directory
AGENTS_DIR = Path(__file__).parent.parent / "agents"


# Tool-use text protocol
_TOOL_CALL_RE = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL)
# Triple-backtick fenced blocks are stripped before parsing so that LLMs can
# illustrate the protocol inside code fences without triggering real tool
# execution. Matches ``` with an optional language tag through the next ```.
_FENCED_BLOCK_RE = re.compile(r"```[^\n]*\n.*?```", re.DOTALL)


class AgentDispatcher:
    """Dispatches tasks to specialized agents.

    The Leader agent decides what to do, then dispatches to workers:
    - idea_agent: Literature search, hypothesis formation
    - code_agent: Experiment implementation and execution
    - writing_agent: Report generation and paper writing

    Each worker has a minimal tool set (3-5 tools) to reduce token overhead.
    """

    WORKER_CONFIGS = {
        "idea": {
            "prompt_file": "idea_agent.md",
            "max_turns": 12,
            "tools": ["search_papers", "search_arxiv", "get_paper", "write_file", "read_file"],
        },
        "code": {
            "prompt_file": "code_agent.md",
            "max_turns": 40,
            "tools": [
                "run_shell", "launch_experiment", "write_file",
                "read_file", "list_files", "list_tree", "search_code",
            ],
        },
        "writing": {
            "prompt_file": "writing_agent.md",
            "max_turns": 30,
            "tools": ["write_file", "read_file", "list_files", "search_code"],
        },
    }

    # Model mapping between providers
    MODEL_MAP = {
        # Anthropic ↔ OpenAI equivalents
        "claude-sonnet-4-6": "codex-5.3",     # Fast tier
        "claude-opus-4-6": "gpt-5.4",          # Strongest tier
        "codex-5.3": "claude-sonnet-4-6",
        "gpt-5.4": "claude-opus-4-6",
    }

    # Supported providers:
    #   "anthropic"  — Anthropic-compatible SDK endpoint (default auth env: ANTHROPIC_API_KEY)
    #   "openai"     — OpenAI-compatible SDK endpoint (default auth env: OPENAI_API_KEY)
    #   "claude_cli" — `claude -p` subprocess, uses Claude Code / Pro / Max subscription
    #   "codex_cli"  — `codex exec` subprocess, uses ChatGPT Plus / Pro subscription
    SUPPORTED_PROVIDERS = ("anthropic", "openai", "claude_cli", "codex_cli")

    # Domestic / OpenAI-compatible API presets. Set `provider` to one of these
    # to run on a Chinese LLM API instead of a Claude/Codex subscription — the
    # preset just fills in the OpenAI-compatible base_url and default key env
    # (both still overridable in config) and routes via the "openai" path.
    #   name -> (base_url, default api-key env var)
    PROVIDER_PRESETS = {
        "deepseek":  ("https://api.deepseek.com/v1", "DEEPSEEK_API_KEY"),
        "dashscope": ("https://dashscope.aliyuncs.com/compatible-mode/v1", "DASHSCOPE_API_KEY"),
        "qwen":      ("https://dashscope.aliyuncs.com/compatible-mode/v1", "DASHSCOPE_API_KEY"),
        "moonshot":  ("https://api.moonshot.cn/v1", "MOONSHOT_API_KEY"),
        "kimi":      ("https://api.moonshot.cn/v1", "MOONSHOT_API_KEY"),
        "zhipu":     ("https://open.bigmodel.cn/api/paas/v4", "ZHIPUAI_API_KEY"),
        "glm":       ("https://open.bigmodel.cn/api/paas/v4", "ZHIPUAI_API_KEY"),
    }

    def __init__(
        self,
        model: str = "claude-sonnet-4-6",
        provider: str = "anthropic",
        max_steps: int = 3,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        api_key_env: str = "",
        auth_token: Optional[str] = None,
        auth_token_env: str = "",
    ):
        # Expand a domestic preset (deepseek / qwen / kimi / glm / ...) into the
        # OpenAI-compatible path. base_url / api_key_env stay overridable: an
        # explicit value in config wins over the preset default.
        self.provider_label = provider
        preset = self.PROVIDER_PRESETS.get(provider)
        if preset:
            preset_base_url, preset_key_env = preset
            base_url = (base_url or "").strip() or preset_base_url
            api_key_env = (api_key_env or "").strip() or preset_key_env
            provider = "openai"
        if provider not in self.SUPPORTED_PROVIDERS:
            raise ValueError(
                f"Unknown provider '{provider}'. Supported: {self.SUPPORTED_PROVIDERS} "
                f"or a domestic preset {tuple(self.PROVIDER_PRESETS)}"
            )
        self.model = model
        self.provider = provider
        self.max_steps = max_steps
        self.base_url = (base_url or "").strip() or None
        self.api_key = api_key or self._resolve_secret(api_key_env)
        self.auth_token = auth_token or self._resolve_secret(auth_token_env)
        self._leader_history = []

    @staticmethod
    def _resolve_secret(env_name: str) -> Optional[str]:
        env_name = (env_name or "").strip()
        if not env_name:
            return None
        return os.environ.get(env_name)

    def dispatch_leader(self, task: str, context: dict) -> dict:
        """Send a task to the Leader agent.

        The Leader maintains conversation history within a cycle for
        coherent multi-step reasoning. History is cleared between cycles.

        Args:
            task: "think" or "reflect"
            context: Current state (brief, memory, results, etc.)

        Returns:
            Leader's decision as a dict
        """
        system_prompt = self._load_prompt("leader.md")

        messages = list(self._leader_history)
        messages.append({
            "role": "user",
            "content": self._format_leader_input(task, context),
        })

        response = self._call_llm(system=system_prompt, messages=messages)

        # Persist conversation for within-cycle coherence
        self._leader_history = messages + [{"role": "assistant", "content": response}]

        return self._parse_leader_response(response)

    def dispatch_worker(self, agent_type: str, task: str, tool_registry) -> dict:
        """Dispatch a task to a worker agent and run its tool-use loop.

        Workers are stateless across dispatches — each call starts with a
        fresh conversation. Within a single dispatch the conversation is
        multi-turn: the worker may emit tool calls, receive results, and
        continue reasoning until it produces a final answer (a response
        containing no <tool_call> blocks).

        Args:
            agent_type: "idea", "code", or "writing".
            task: Task description from the Leader.
            tool_registry: ToolRegistry that provides `get_tools_for` and
                `execute_tool`. The registry itself is passed in so this
                module does not have a hard import dependency on tools.py.

        Returns:
            Dict with at minimum `agent` and `response`. If the worker
            called `launch_experiment`, the PID and log_file from that
            tool result are also surfaced at the to
```

### Core Architecture Module: `core/execution.py`
```
"""
Execution backends for Deep Researcher Agent.

Local mode preserves the current behavior. SSH mode keeps the controller
state local while running file operations, shell commands, training, log
tailing, PID checks, and GPU inspection on one remote host.
"""

from __future__ import annotations

import json
import logging
import os
import base64
import shutil
import shlex
import subprocess
import textwrap
import time
from pathlib import Path, PurePosixPath
from typing import Optional

logger = logging.getLogger("autoresearcher.execution")


# Directories and files that repo-reading tools (list_tree / grep_files) skip,
# so the agent sees source code instead of VCS metadata and build caches.
WALK_SKIP_DIRS = {
    ".git",
    "__pycache__",
    "node_modules",
    ".venv",
    "venv",
    ".mypy_cache",
    ".pytest_cache",
    ".idea",
    ".ipynb_checkpoints",
}
# grep_files skips files larger than this (likely data/binaries, not source).
GREP_MAX_FILE_BYTES = 2_000_000


# --- Slurm liveness taxonomy (used by SlurmExecutionBackend) ---
# We map a job's `sacct` State to three buckets. Reference: `man sacct`
# JOB STATE CODES. PENDING/RUNNING/etc. occupy a slot ("running"); COMPLETED
# is "completed"; the rest are "failed". PREEMPTED is intentionally ABSENT:
# under a requeue policy a preempted job returns to PENDING, so we let it fall
# through to "unknown" (bounded grace) rather than reaping it early.
_SLURM_RUNNING_STATES = {
    "PENDING", "RUNNING", "REQUEUED", "RESIZING", "SUSPENDED",
    "CONFIGURING", "COMPLETING",
}
_SLURM_OK_STATES = {"COMPLETED"}
_SLURM_FAIL_STATES = {
    "FAILED", "TIMEOUT", "CANCELLED", "NODE_FAIL", "OUT_OF_MEMORY",
    "BOOT_FAIL", "DEADLINE", "REVOKED", "SPECIAL_EXIT",
}


def _parse_slurm_time_seconds(spec: str) -> int:
    """Parse a Slurm ``--time`` spec to seconds.

    Accepts the documented forms: ``minutes``, ``minutes:seconds``,
    ``hours:minutes:seconds``, ``days-hours``, ``days-hours:minutes``,
    ``days-hours:minutes:seconds``. Returns a large sentinel when unparseable
    so the wall-clock liveness cap never fires spuriously (the consecutive
    -unknown grace still bounds the loop).
    """
    s = str(spec or "").strip()
    if not s:
        return 10 ** 9
    try:
        days = 0
        if "-" in s:
            d, s = s.split("-", 1)
            days = int(d)
        parts = s.split(":") if s else []
        if days:
            # days-hours[:minutes[:seconds]]
            hours = int(parts[0]) if len(parts) >= 1 else 0
            minutes = int(parts[1]) if len(parts) >= 2 else 0
            seconds = int(parts[2]) if len(parts) >= 3 else 0
        elif len(parts) == 1:
            hours, minutes, seconds = 0, int(parts[0]), 0          # bare minutes
        elif len(parts) == 2:
            hours, minutes, seconds = 0, int(parts[0]), int(parts[1])  # minutes:seconds
        else:
            hours, minutes, seconds = int(parts[0]), int(parts[1]), int(parts[2])
        return days * 86400 + hours * 3600 + minutes * 60 + seconds
    except (ValueError, TypeError, IndexError):
        return 10 ** 9


REMOTE_HELPER = textwrap.dedent(
    """
    import json
    import os
    import pathlib
    import shlex
    import subprocess
    import sys


    def normalize_rel(raw):
        if raw is None or not str(raw).strip():
            raise ValueError("Path cannot be empty")
        rel = pathlib.PurePosixPath(str(raw))
        if rel.is_absolute():
            raise ValueError("Path must be relative to workspace")
        if any(part == ".." for part in rel.parts):
            raise ValueError(f"Path escapes workspace: {raw}")
        parts = [part for part in rel.parts if part not in ("", ".")]
        return pathlib.Path(*parts)


    def resolve_path(root, raw):
        rel = normalize_rel(raw)
        resolved = (root / rel).resolve(strict=False)
        try:
            resolved.relative_to(root)
        except ValueError as exc:
            raise ValueError(f"Path escapes workspace: {raw}") from exc
        return resolved


    WALK_SKIP_DIRS = {
        ".git", "__pycache__", "node_modules", ".venv", "venv",
        ".mypy_cache", ".pytest_cache", ".idea", ".ipynb_checkpoints",
    }
    GREP_MAX_FILE_BYTES = 2000000


    def walk_tree(root, max_depth, max_entries):
        max_depth = max(1, int(max_depth))
        max_entries = max(1, int(max_entries))
        entries = []

        def walk(current, depth):
            if depth > max_depth or len(entries) >= max_entries:
                return
            try:
                children = sorted(current.iterdir(), key=lambda p: (p.is_file(), p.name))
            except OSError:
                return
            for child in children:
                if len(entries) >= max_entries:
                    return
                if child.name in WALK_SKIP_DIRS:
                    continue
                if child.is_symlink():
                    continue
                rel = child.relative_to(root).as_posix()
                if child.is_dir():
                    entries.append(rel + "/")
                    walk(child, depth + 1)
                else:
                    entries.append(rel)

        walk(root, 1)
        return entries


    def grep_tree(root, base, pattern, max_results, ignore_case):
        import re
        if not pattern:
            raise ValueError("Search pattern cannot be empty")
        max_results = max(1, int(max_results))
        flags = re.IGNORECASE if ignore_case else 0
        try:
            regex = re.compile(pattern, flags)
        except re.error as exc:
            raise ValueError("Invalid search pattern: " + str(exc))
        targets = []
        if root.is_file():
            targets = [root]
        else:
            for dirpath, dirnames, filenames in os.walk(root):
                dirnames[:] = sorted(d for d in dirnames if d not in WALK_SKIP_DIRS)
                for name in sorted(filenames):
                    targets.append(pathlib.Path(dirpath) / name)
        hits = []
        for file_path in targets:
            if len(hits) >= max_results:
                break
            try:
                if file_path.is_symlink():
                    continue
                if file_path.stat().st_size > GREP_MAX_FILE_BYTES:
                    continue
                with open(file_path, "r", errors="strict") as handle:
                    for lineno, line in enumerate(handle, start=1):
                        if regex.search(line):
                            hits.append({
                                "file": file_path.relative_to(base).as_posix(),
                                "line": lineno,
                                "text": line.rstrip("\\n")[:300],
                            })
                            if len(hits) >= max_results:
                                break
            except (UnicodeDecodeError, OSError, ValueError):
                continue
        return hits


    def gpu_status():
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=utilization.gpu,memory.used,memory.total",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if result.returncode == 0:
                gpus = []
                for line in result.stdout.strip().splitlines():
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) >= 3:
                        gpus.append(
                            {
                                "utilization": f"{parts[0]}%",
                                "memory": f"{parts[1]}MB/{parts[2]}MB",
                            }
                        )
                return {"gpus": gpus, "utilization": gpus[0]["utilization"] if gpus else "N/A"}
        except Exception
```

### Core Architecture Module: `core/journal.py`
```
"""
Research journals — append-only DEAD_ENDS.md and INSIGHTS.md.

Unlike the two-tier MEMORY_LOG (which auto-compacts and silently drops old
detail), these journals are append-only. They are never compacted; when a file
exceeds its size cap it is rotated to a dated ``.bak`` archive and a fresh file
is started, so no history is lost — it is just moved aside.

- DEAD_ENDS.md: approaches that failed and must not be retried.
- INSIGHTS.md: durable observations worth carrying across cycles.

The loop injects the tail of each into the THINK context so the agent stops
repeating known dead ends and keeps its hard-won insights in view.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

logger = logging.getLogger("autoresearcher.journal")


class _AppendOnlyDoc:
    def __init__(self, path: Path, title: str, max_chars: int):
        self.path = Path(path)
        self.title = title
        self.max_chars = max_chars
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._init()

    def _init(self):
        self.path.write_text(f"# {self.title}\n\n", encoding="utf-8")

    def append(self, entry: str, ts: str = None) -> None:
        """Append a timestamped entry. Never raises."""
        entry = (entry or "").strip()
        if not entry:
            return
        stamp = ts if ts is not None else time.strftime("%Y-%m-%d %H:%M")
        try:
            if not self.path.exists():
                self._init()
            with open(self.path, "a", encoding="utf-8") as handle:
                handle.write(f"- [{stamp}] {entry}\n")
            if self.path.stat().st_size > self.max_chars:
                self._rotate(stamp)
        except OSError as exc:  # pragma: no cover - disk failure path
            logger.warning(f"Failed to append to {self.path.name}: {exc}")

    def _rotate(self, stamp: str) -> None:
        """Archive the full file to a dated backup, then keep only the tail."""
        try:
            content = self.path.read_text(encoding="utf-8")
            safe_stamp = stamp.replace(" ", "_").replace(":", "")
            backup = self.path.with_name(f"{self.path.stem}.{safe_stamp}.bak")
            n = 0
            while backup.exists():
                n += 1
                backup = self.path.with_name(f"{self.path.stem}.{safe_stamp}.{n}.bak")
            backup.write_text(content, encoding="utf-8")
            # Restart with the header plus the most recent half of the entries.
            tail = content[-(self.max_chars // 2):]
            self.path.write_text(
                f"# {self.title}\n\n_(rotated; full history in {backup.name})_\n{tail}",
                encoding="utf-8",
            )
        except OSError as exc:  # pragma: no cover - disk failure path
            logger.warning(f"Failed to rotate {self.path.name}: {exc}")

    def tail(self, max_chars: int) -> str:
        """Return the last ``max_chars`` of the file. Never raises."""
        try:
            max_chars = int(max_chars)
        except (TypeError, ValueError):
            max_chars = self.max_chars
        try:
            if not self.path.exists():
                return ""
            content = self.path.read_text(encoding="utf-8")
        except OSError as exc:  # pragma: no cover - disk failure path
            logger.warning(f"Failed to read {self.path.name}: {exc}")
            return ""
        return content[-max_chars:] if len(content) > max_chars else content


class ResearchJournal:
    """Manages the DEAD_ENDS and INSIGHTS append-only journals."""

    def __init__(self, workspace: Path, max_chars: int = 4000):
        workspace = Path(workspace)
        self.dead_ends = _AppendOnlyDoc(workspace / "DEAD_ENDS.md", "Dead Ends", max_chars)
        self.insights = _AppendOnlyDoc(workspace / "INSIGHTS.md", "Insights", max_chars)

    def append_dead_end(self, entry: str, ts: str = None) -> None:
        self.dead_ends.append(entry, ts=ts)

    def append_insight(self, entry: str, ts: str = None) -> None:
        self.insights.append(entry, ts=ts)

    def dead_ends_tail(self, max_chars: int = 1500) -> str:
        return self.dead_ends.tail(max_chars)

    def insights_tail(self, max_chars: int = 1500) -> str:
        return self.insights.tail(max_chars)

```

### Core Architecture Module: `core/ledger.py`
```
"""
Experiment ledger — append-only record of every research cycle.

Stored as ``workspace/experiments.jsonl`` (one JSON object per line). The
append-only design means it survives controller crashes, never needs a
parse-and-rewrite, and stays human- and tool-readable at zero LLM cost. Thin
pure-Python readers (``recent`` / ``summary`` / ``best_metric`` /
``detect_stagnation`` / ``check_phase_gate``) turn the raw trajectory into
compact signals that the loop injects into the THINK context.

This is the spine of v2: persistent memory of *what was tried and what
happened*, which the agent previously lacked (the two-tier MEMORY_LOG is
auto-compacted, so detail was silently dropped).
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger("autoresearcher.ledger")


class ExperimentLedger:
    """Append-only JSONL ledger of experiment cycles."""

    def __init__(self, workspace: Path, filename: str = "experiments.jsonl"):
        self.path = Path(workspace) / filename
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def record(
        self,
        *,
        cycle: int,
        hypothesis: str = "",
        action: str = "",
        status: str = "",
        metrics: Optional[dict] = None,
        pid: Optional[int] = None,
        log_file: str = "",
        conclusion: str = "",
        ts: Optional[float] = None,
    ) -> Optional[dict]:
        """Append one cycle's outcome. Never raises — a logging failure must
        not crash the research loop."""
        entry = {
            "ts": time.time() if ts is None else float(ts),
            "cycle": int(cycle),
            "action": str(action or ""),
            "status": str(status or ""),
            "hypothesis": str(hypothesis or "")[:500],
            "metrics": {k: v for k, v in (metrics or {}).items()},
            "pid": pid,
            "log_file": str(log_file or ""),
            "conclusion": str(conclusion or "")[:500],
        }
        try:
            with open(self.path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError as exc:  # pragma: no cover - disk failure path
            logger.warning(f"Failed to append to experiment ledger: {exc}")
            return None
        return entry

    def all(self) -> list[dict]:
        """Return every well-formed entry; malformed lines are skipped."""
        if not self.path.exists():
            return []
        entries: list[dict] = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                entries.append(parsed)
        return entries

    def recent(self, n: int = 5) -> list[dict]:
        n = int(n)
        return self.all()[-n:] if n > 0 else []

    def summary(self, n: int = 5) -> str:
        """Render the last ``n`` experiments as a compact context block."""
        entries = self.recent(n)
        if not entries:
            return ""
        lines = []
        for e in entries:
            metrics = e.get("metrics")
            metrics = metrics if isinstance(metrics, dict) else {}
            metric_str = ", ".join(f"{k}={v}" for k, v in metrics.items()) or "no metrics"
            hypo = (e.get("hypothesis") or "").strip()
            if len(hypo) > 160:
                hypo = hypo[:157] + "..."
            status = e.get("status") or e.get("action") or "?"
            line = f"- cycle {e.get('cycle', '?')} [{status}] {hypo} ({metric_str})"
            conclusion = (e.get("conclusion") or "").strip()
            if conclusion:
                conclusion = conclusion[:160]
                line += f" -> {conclusion}"
            lines.append(line)
        return "\n".join(lines)

    def best_metric(self, metric_key: str, direction: str = "higher_better") -> Optional[float]:
        return best_metric(self.all(), metric_key, direction)


def _metric_values(entries: list[dict], metric_key: str) -> list[tuple[int, float]]:
    """Extract (index, value) pairs for entries that carry a numeric metric."""
    out: list[tuple[int, float]] = []
    for i, e in enumerate(entries):
        metrics = e.get("metrics")
        if not isinstance(metrics, dict):
            continue
        if metric_key in metrics:
            try:
                out.append((i, float(metrics[metric_key])))
            except (TypeError, ValueError):
                continue
    return out


def best_metric(entries: list[dict], metric_key: str, direction: str = "higher_better") -> Optional[float]:
    values = [v for _, v in _metric_values(entries, metric_key)]
    if not values:
        return None
    return max(values) if direction == "higher_better" else min(values)


def detect_stagnation(
    entries: list[dict],
    metric_key: str,
    direction: str = "higher_better",
    threshold_cycles: int = 3,
    min_delta: float = 0.0,
) -> dict:
    """Data-driven stagnation signal over the metric trajectory.

    Returns a verdict dict; ``stagnating`` is True when the best metric has
    not improved by more than ``min_delta`` for at least ``threshold_cycles``
    metric-bearing cycles. Advisory only — the caller decides what to do.
    """
    verdict = {
        "stagnating": False,
        "metric_key": metric_key,
        "best": None,
        "recent_best": None,
        "cycles_since_improvement": 0,
        "n_points": 0,
    }
    if not metric_key:
        verdict["reason"] = "no metric_key configured"
        return verdict

    points = _metric_values(entries, metric_key)
    verdict["n_points"] = len(points)
    if len(points) <= threshold_cycles:
        verdict["reason"] = "not enough metric points yet"
        if points:
            verdict["best"] = best_metric(entries, metric_key, direction)
        return verdict

    higher = direction == "higher_better"
    best_val = points[0][1]
    cycles_since_improvement = 0
    for _, val in points[1:]:
        improved = (val > best_val + min_delta) if higher else (val < best_val - min_delta)
        if improved:
            best_val = val
            cycles_since_improvement = 0
        else:
            cycles_since_improvement += 1

    recent_vals = [v for _, v in points[-threshold_cycles:]]
    verdict["best"] = best_val
    verdict["recent_best"] = max(recent_vals) if higher else min(recent_vals)
    verdict["cycles_since_improvement"] = cycles_since_improvement
    verdict["stagnating"] = cycles_since_improvement >= threshold_cycles
    return verdict


def check_phase_gate(
    entries: list[dict],
    metric_key: str,
    threshold: float,
    direction: str = "higher_better",
) -> dict:
    """Advisory promotion gate: is the best metric good enough to proceed?"""
    best = best_metric(entries, metric_key, direction)
    if best is None:
        return {"gate_met": False, "best_metric": None, "blocker_reason": "no metric recorded yet"}
    met = best >= threshold if direction == "higher_better" else best <= threshold
    reason = "" if met else (
        f"best {metric_key}={best} has not cleared the gate threshold {threshold} ({direction})"
    )
    return {"gate_met": met, "best_metric": best, "blocker_reason": reason}

```

### Core Architecture Module: `core/loop.py`
```
"""
AutoResearcher Core Loop

The autonomous THINK → EXECUTE → REFLECT cycle that drives experiments 24/7.
"""

import os
import sys
import time
import json
import signal
import argparse
import logging
from pathlib import Path
from typing import Optional

from .memory import MemoryManager
from .monitor import ExperimentMonitor
from .agents import AgentDispatcher
from .execution import build_execution_backend
from .obsidian import ObsidianExporter
from .tools import ToolRegistry
from .ledger import ExperimentLedger, detect_stagnation, check_phase_gate
from .journal import ResearchJournal
from . import safety

logger = logging.getLogger("autoresearcher")


class ResearchLoop:
    """Main autonomous research loop.

    Implements the THINK → EXECUTE → REFLECT cycle:
    - THINK: Analyze state, form hypothesis, plan experiment
    - EXECUTE: Dispatch code agent to implement and run experiment
    - REFLECT: Evaluate results, update memory, decide next action
    """

    def __init__(self, config: dict, project_dir: str):
        self.config = config
        self.project_dir = Path(project_dir).resolve()
        self.workspace = self.project_dir / config.get("project", {}).get("workspace", "workspace")
        self.workspace.mkdir(exist_ok=True)
        self.state_path = self.workspace / "state.json"
        self.execution_backend = build_execution_backend(config=config, controller_workspace=self.workspace)
        self.execution_backend.validate()

        # Core components
        self.memory = MemoryManager(
            project_dir=self.project_dir,
            brief_max=config.get("memory", {}).get("brief_max_chars", 3000),
            log_max=config.get("memory", {}).get("log_max_chars", 2000),
            milestone_max=config.get("memory", {}).get("milestone_max_chars", 1200),
            max_recent=config.get("memory", {}).get("max_recent_entries", 15),
        )
        self.monitor = ExperimentMonitor(
            poll_interval=config.get("monitor", {}).get("poll_interval", 900),
            zero_llm=config.get("monitor", {}).get("zero_llm", True),
            backend=self.execution_backend,
        )
        agent_config = config.get("agent", {}) or {}
        self.dispatcher = AgentDispatcher(
            model=agent_config.get("model", "claude-sonnet-4-6"),
            provider=agent_config.get("provider", "anthropic"),
            max_steps=agent_config.get("max_steps_per_cycle", 3),
            base_url=agent_config.get("base_url", ""),
            api_key_env=agent_config.get("api_key_env", ""),
            auth_token_env=agent_config.get("auth_token_env", ""),
        )
        self.tools = ToolRegistry(self.execution_backend)
        self.obsidian = ObsidianExporter(
            config=config,
            project_dir=self.project_dir,
            backend=self.execution_backend,
        )

        # v2 autonomy modules: persistent experiment ledger + research journals.
        # All are additive and advisory — they enrich the THINK context but do
        # not change control flow unless explicitly enabled in config.
        self._ledger_cfg = config.get("ledger", {}) or {}
        self._stagnation_cfg = config.get("stagnation", {}) or {}
        self._journal_cfg = config.get("journal", {}) or {}
        self._safety_cfg = config.get("safety", {}) or {}
        self._gates_cfg = config.get("gates", {}) or {}
        self.ledger = (
            ExperimentLedger(self.workspace)
            if self._ledger_cfg.get("enabled", True)
            else None
        )
        self.journal = (
            ResearchJournal(self.workspace, max_chars=self._journal_cfg.get("max_chars", 4000))
            if self._journal_cfg.get("enabled", True)
            else None
        )

        # State
        self.cycle_count = self._load_cycle_counter()
        self.max_cycles = agent_config.get("max_cycles", -1)
        self.cooldown = agent_config.get("cooldown_interval", 300)
        self.no_progress_fallback_threshold = agent_config.get("no_progress_fallback_threshold", 3)
        # Proactive anti-burn: cap cycles started per rolling hour (0 = disabled).
        self.max_cycles_per_hour = agent_config.get("max_cycles_per_hour", 0)
        self._cycle_times_path = self.workspace / ".cycle_times"
        self._running = True
        self._no_progress_streak = 0
        self._last_no_progress_signature = ""

        # Graceful shutdown
        signal.signal(signal.SIGTERM, self._handle_signal)
        signal.signal(signal.SIGINT, self._handle_signal)

    def run(self):
        """Main entry point. Runs the THINK → EXECUTE → REFLECT loop."""
        logger.info(f"AutoResearcher starting | project={self.project_dir} | cycle={self.cycle_count}")

        while self._running:
            if self.max_cycles > 0 and self.cycle_count >= self.max_cycles:
                logger.info(f"Reached max cycles ({self.max_cycles}). Stopping.")
                break

            self._throttle_if_needed()
            if not self._running:
                break

            self.cycle_count += 1
            self._save_cycle_counter()
            logger.info(f"=== Cycle {self.cycle_count} ===")

            try:
                # Keep leader context bounded to one cycle.
                self.dispatcher.reset_leader_history()

                # Check for human directive
                directive = self._consume_directive()
                self._update_state(
                    {
                        "cycle": self.cycle_count,
                        "status": "planning",
                        "updated_at": time.time(),
                        "last_directive": directive or "",
                    }
                )

                # THINK: Analyze and plan
                think_result = self._think(directive)
                think_result = self._apply_no_progress_fallback(think_result, directive)

                if think_result.get("action") == "wait":
                    logger.info("THINK decided to wait. Entering cooldown.")
                    self._update_state(
                        {
                            "cycle": self.cycle_count,
                            "status": "waiting",
                            "updated_at": time.time(),
                            "suggested_next_step": think_result.get("reason", ""),
                        }
                    )
                    self._smart_cooldown()
                    continue

                # EXECUTE: Run the plan
                execute_result = self._execute(think_result)

                if execute_result.get("experiment_launched"):
                    self._update_state(
                        {
                            "cycle": self.cycle_count,
                            "status": "running",
                            "pid": execute_result.get("pid"),
                            "log_file": execute_result.get("log_file", ""),
                            "started_at": time.time(),
                            "updated_at": time.time(),
                        }
                    )
                    # Monitor experiment (zero LLM cost)
                    monitor_result = self._monitor_experiment(execute_result)
                    experiment_status = monitor_result.get("status", "completed")
                    execute_result["training_logs"] = monitor_result.get("log_tail", "")
                    execute_result["final_metrics"] = monitor_result.get("metrics", {})
                    execute_result["experiment_status"] = experiment_status
                    execute_result["terminal_state"] = monitor_result.get("terminal_state", "")
                    self._update_state(
                        {
                            "status": experiment_status,
                            "pid": execute_result.get("pid"),
                            "log_file": execute_result.get("log_file", ""),
                            "updated_at": time.time(),
                            "terminal
```

### Core Architecture Module: `core/memory.py`
```
"""
AutoResearcher Two-Tier Memory System

Maintains a constant-size memory regardless of how long the agent runs:
- Tier 1 (PROJECT_BRIEF.md): Frozen reference, never modified by the agent
- Tier 2 (MEMORY_LOG.md): Rolling log with auto-compaction

Total memory budget: ~5000 chars (~1500 tokens) — always.
"""

import time
from pathlib import Path
from typing import Optional


class MemoryManager:
    """Two-tier memory with automatic compaction.

    The key insight: long-running agents accumulate context that grows
    without bound, leading to degraded performance and ballooning costs.
    This system caps memory at a fixed budget by:
    - Keeping milestones (key results) in a priority queue, oldest dropped first
    - Keeping only the N most recent decisions
    - Never modifying the frozen project brief
    """

    def __init__(
        self,
        project_dir: Path,
        brief_max: int = 3000,
        log_max: int = 2000,
        milestone_max: int = 1200,
        max_recent: int = 15,
    ):
        self.project_dir = Path(project_dir)
        self.brief_path = self.project_dir / "PROJECT_BRIEF.md"
        self.log_path = self.project_dir / "workspace" / "MEMORY_LOG.md"
        self.brief_max = brief_max
        self.log_max = log_max
        self.milestone_max = milestone_max
        self.max_recent = max_recent

        # Ensure log file exists
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.log_path.exists():
            self._init_log()

    def get_brief(self) -> str:
        """Return the frozen project brief (Tier 1)."""
        if self.brief_path.exists():
            content = self.brief_path.read_text()
            return content[: self.brief_max]
        return ""

    def get_log(self) -> str:
        """Return the rolling memory log (Tier 2)."""
        if self.log_path.exists():
            return self.log_path.read_text()
        return ""

    def get_full_context(self) -> str:
        """Return combined memory for agent consumption."""
        brief = self.get_brief()
        log = self.get_log()
        return f"## Project Brief\n{brief}\n\n## Memory Log\n{log}"

    def log_milestone(self, entry: str):
        """Add a key result milestone. Auto-compacts if over budget."""
        sections = self._parse_log()
        timestamp = time.strftime("%m-%d %H:%M")
        sections["milestones"].append(f"[{timestamp}] {entry}")

        # Compact: drop oldest milestones if over char budget
        while self._section_size(sections["milestones"]) > self.milestone_max and len(sections["milestones"]) > 1:
            sections["milestones"].pop(0)

        self._write_log(sections)

    def log_decision(self, entry: str):
        """Add a recent decision. Auto-compacts to keep only last N."""
        sections = self._parse_log()
        timestamp = time.strftime("%m-%d %H:%M")
        sections["decisions"].append(f"[{timestamp}] {entry}")

        # Compact: keep only last N entries
        if len(sections["decisions"]) > self.max_recent:
            sections["decisions"] = sections["decisions"][-self.max_recent :]

        self._write_log(sections)

    def _init_log(self):
        """Create initial empty memory log."""
        content = "# Memory Log\n\n## Key Results\n\n## Recent Decisions\n"
        self.log_path.write_text(content)

    def _parse_log(self) -> dict:
        """Parse MEMORY_LOG.md into sections."""
        content = self.get_log()
        sections = {"milestones": [], "decisions": []}

        current_section = None
        for line in content.split("\n"):
            line_stripped = line.strip()
            if line_stripped == "## Key Results":
                current_section = "milestones"
            elif line_stripped == "## Recent Decisions":
                current_section = "decisions"
            elif line_stripped.startswith("[") and current_section:
                sections[current_section].append(line_stripped)

        return sections

    def _write_log(self, sections: dict):
        """Write sections back to MEMORY_LOG.md."""
        lines = ["# Memory Log", "", "## Key Results"]
        for entry in sections["milestones"]:
            lines.append(entry)
        lines.append("")
        lines.append("## Recent Decisions")
        for entry in sections["decisions"]:
            lines.append(entry)
        lines.append("")

        content = "\n".join(lines)

        # Final safety check: total log must fit budget
        if len(content) > self.log_max:
            # Aggressive compaction: trim milestones first, then decisions
            while len(content) > self.log_max and len(sections["milestones"]) > 1:
                sections["milestones"].pop(0)
                content = self._build_content(sections)
            while len(content) > self.log_max and len(sections["decisions"]) > 1:
                sections["decisions"].pop(0)
                content = self._build_content(sections)

        self.log_path.write_text(content)

    def _build_content(self, sections: dict) -> str:
        lines = ["# Memory Log", "", "## Key Results"]
        lines.extend(sections["milestones"])
        lines.append("")
        lines.append("## Recent Decisions")
        lines.extend(sections["decisions"])
        lines.append("")
        return "\n".join(lines)

    def _section_size(self, entries: list) -> int:
        return sum(len(e) for e in entries)

```

### Core Architecture Module: `core/monitor.py`
```
"""
AutoResearcher Experiment Monitor

The key innovation: ZERO LLM calls during experiment training.

While your model trains (hours/days), the monitor only does:
- Process alive check
- Log file tail read
- GPU utilization check

This means running AutoResearcher 24/7 costs the same as running it
only during the THINK and REFLECT phases.
"""

import logging
import shlex
import time
from typing import Optional

from .execution import ExecutionBackend, LocalExecutionBackend

logger = logging.getLogger("autoresearcher.monitor")


class ExperimentMonitor:
    """Zero-LLM experiment monitoring.

    Design principle: During training, the agent is effectively "sleeping"
    at zero cost. It only wakes up (calls LLM) when training completes
    and results need analysis.
    """

    def __init__(
        self,
        poll_interval: int = 900,
        zero_llm: bool = True,
        backend: Optional[ExecutionBackend] = None,
    ):
        self.poll_interval = poll_interval  # seconds between checks
        self.zero_llm = zero_llm
        self.backend = backend or LocalExecutionBackend(".")
        self._active_experiments: dict[int, dict] = {}

    def launch_experiment(self, command: str, log_file: str, gpu: Optional[str] = None) -> dict:
        """Launch an experiment via nohup and track its PID.

        Args:
            command: The training command to run
            log_file: Path to redirect stdout/stderr
            gpu: CUDA_VISIBLE_DEVICES value

        Returns:
            dict with pid, log_file, start_time
        """
        env = {}
        if gpu is not None:
            env["CUDA_VISIBLE_DEVICES"] = str(gpu)

        experiment = self.backend.launch_command(
            argv=shlex.split(command),
            log_file=log_file,
            env=env,
        )
        experiment.update({
            "start_time": time.time(),
            "command": command,
            "status": "running",
        })
        self._active_experiments[experiment["pid"]] = experiment

        logger.info(f"Launched experiment: PID={experiment['pid']}, cmd={command[:80]}...")
        return experiment

    def wait_for_completion(self, pid: int, log_file: str, notify: bool = True) -> dict:
        """Wait for experiment to complete. ZERO LLM calls during wait.

        This is the core cost-saving mechanism. Instead of asking the LLM
        "is training done?", we just check if the process is alive.
        """
        logger.info(f"Monitoring PID={pid}, polling every {self.poll_interval}s")

        while self._is_process_alive(pid):
            time.sleep(self.poll_interval)

            # Log current status (no LLM involved)
            gpu_info = self._safe_gpu_status()
            log_tail = self._safe_tail_file(log_file, lines=5)
            elapsed = time.time() - self._active_experiments.get(pid, {}).get("start_time", time.time())

            logger.info(
                f"PID={pid} alive | elapsed={elapsed/3600:.1f}h | "
                f"GPU={gpu_info.get('utilization', 'N/A')} | "
                f"last_log: {log_tail[-1] if log_tail else 'N/A'}"
            )

        # Experiment finished — ask the backend for the real outcome. Slurm
        # reports the sacct terminal state (so FAILED/TIMEOUT are not mislabelled
        # as success); pid-only backends return unknown and we keep "completed".
        elapsed = time.time() - self._active_experiments.get(pid, {}).get("start_time", time.time())
        log_tail = self._safe_tail_file(log_file, lines=50)

        final = self._safe_final_status(pid)
        success = final.get("success")
        status = "failed" if success is False else "completed"

        if pid in self._active_experiments:
            self._active_experiments[pid]["status"] = status

        result = {
            "pid": pid,
            "status": status,
            "success": success,
            "terminal_state": final.get("state", "unknown"),
            "elapsed_hours": elapsed / 3600,
            "log_tail": "\n".join(log_tail),
            "metrics": self._extract_metrics(log_tail),
        }

        logger.info(
            f"Experiment PID={pid} {status} after {result['elapsed_hours']:.1f}h "
            f"(state={result['terminal_state']})"
        )

        if notify:
            self._notify_completion(result)

        return result

    def has_completed_experiments(self) -> bool:
        """Check if any tracked experiment has finished."""
        for pid, exp in list(self._active_experiments.items()):
            if exp["status"] == "running" and not self._is_process_alive(pid):
                exp["status"] = "completed"
                return True
        return False

    def _is_process_alive(self, pid: int) -> bool:
        """Check if process is still running (zero cost)."""
        return self.backend.is_process_alive(pid)

    def _safe_gpu_status(self) -> dict:
        try:
            return self.backend.get_gpu_status()
        except Exception:
            return {"utilization": "N/A"}

    def _safe_final_status(self, pid: int) -> dict:
        try:
            return self.backend.final_status(pid) or {}
        except Exception:
            # Backend without final_status support -> treat as indeterminate.
            return {"state": "unknown", "success": None}

    def _safe_tail_file(self, filepath: str, lines: int = 50) -> list[str]:
        try:
            return self.backend.tail_file(filepath, lines=lines)
        except Exception:
            return []

    def _extract_metrics(self, log_lines: list[str]) -> dict:
        """Try to extract common metrics from training logs.

        Looks for patterns like:
        - loss: 0.123
        - accuracy: 95.2%
        - FGD: 0.582
        - epoch 100/200
        """
        import re
        metrics = {}
        for line in reversed(log_lines):
            # Common metric patterns
            for pattern, key in [
                (r"loss[:\s]+([0-9.]+)", "loss"),
                (r"acc(?:uracy)?[:\s]+([0-9.]+)", "accuracy"),
                (r"FGD[:\s]+([0-9.]+)", "FGD"),
                (r"FID[:\s]+([0-9.]+)", "FID"),
                (r"epoch[:\s]+(\d+)", "epoch"),
                (r"step[:\s]+(\d+)", "step"),
            ]:
                if key not in metrics:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        metrics[key] = match.group(1)
        return metrics

    def _notify_completion(self, result: dict):
        """Send notification when experiment finishes (success or failure)."""
        outcome = result.get("status", "completed").upper()
        logger.info(
            f"EXPERIMENT {outcome} | PID={result['pid']} | "
            f"Time={result['elapsed_hours']:.1f}h | "
            f"State={result.get('terminal_state', '?')} | "
            f"Metrics={result.get('metrics', {})}"
        )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #31** (2026-06-03): **Add domestic LLM API provider presets**
  *Symptoms*: Adds one-word presets to `agent.provider` so users can run the agent on a domestic (Chinese) LLM API instead of a subscription-CLI provider:  - `deepseek` / `qwen` (`dashscope`) / `kimi` (`moonshot`) / `glm` (`zhipu`) - Each preset auto-fills the compatible chat-completions `base_url` + default key env (`DEEPSEEK_API_KEY` / `DASHSCOPE_API_KEY` / `MOONSHOT_API_KEY` / `ZHIPUAI_API_KEY`); the model id passes through verbatim; `base_url` / `api_key_env` stay overridable. Thin alias over the existing compatible-endpoint path — no new dependency.  ```yaml agent:   provider: "deepseek"   model: "deepseek-chat" ```  Also updates `config.yaml`, `README` (Recent Updates), and `AI_GUIDE.md` — the guide additionally **syncs the Slurm backend and truthful-outcome updates** that were missing from it.  Tests: +5 unit tests (full suite 127 passing). Verified; reviewed (0 findings). 

- **Issue #30** (2026-06-02): **Add Slurm execution backend + truthful experiment outcomes**
  *Symptoms*: Two related commits.  ## 1. Slurm execution backend  Adds `execution.mode: "slurm"` so the agent can run experiments on a Slurm cluster while the controller stays local. Ported and adapted from the research-agent-v7 "submit-and-exit" strategy.  `SlurmExecutionBackend` subclasses `SSHExecutionBackend` — all file / repo-reading / `run_command` ops run on the **login node** (shared NFS workspace), so only job handling changes:  - **launch** — `sbatch --parsable` over one transient SSH call that exits immediately. **No process is left running on the login node.** The Slurm job id rides in the `pid` field, so the existing PID-keyed monitor / `state.json` / Obsidian plumbing is unchanged. - **liveness** — `sacct` is the sole authority. Two bounds inside `is_process_alive` (consecutive-unknown grace + a `--time`-derived wall-clock backstop) keep the monitor loop finite if the cluster goes unreachable, **without ever reaping a job `sacct` still reports as queued/running** (queue wait is not bounded by `--time`). - **gpu status** — partition `squeue` occupancy (login nodes have no usable `nvidia-smi`).  Safety: the sbatch script is built in the remote helper with `shell=False` and quoted directives — no caller value is interpolated into a remote shell string; liveness commands interpolate only validated integer job ids. `CUDA_VISIBLE_DEVICES` is stripped from jobs (Slurm assigns GPUs via `--gres`).  ## 2. Truthful experiment outcomes (failed vs completed)  The monitor previously marke

- **Issue #29** (2026-06-01): **Sync CN/JP/KR READMEs to v2.0**
  *Symptoms*: Updates the localized docs to match the English README for the v2.0 release: corrected per-agent tool counts (Idea 5 / Code 7 / Writing 4) and a short v2.0 section covering the new repo-reading tools (`search_code`, `list_tree`, `read_file` line ranges), literature tools (`get_paper`, `search_arxiv`), and the autonomy layer (experiment ledger, journals, stagnation, violation scan, phase gate, anti-burn limit). Docs-only; no code change.

- **Issue #28** (2026-06-01): **v2 autonomy layer + stronger repo-reading & literature tools**
  *Symptoms*: ## Summary  A major (v2) upgrade in two parts, both additive and fully unit-tested without a GPU or network (test count 60 → 99).  ### 1. Stronger agent tooling - **Repo comprehension**: `search_code` (regex grep across the workspace), `list_tree` (recursive depth-limited map), and `read_file` line ranges so large files aren't blindly truncated. Tree/grep are symlink-safe (never follow links outside the workspace). - **Literature discovery**: implemented `get_paper` (paper details + reference/citation snowballing — it was advertised in prompts but never existed) and added `search_arxiv` for the freshest preprints. Defensive `limit` coercion. - Full **local ↔ SSH** execution parity for every new tool.  ### 2. v2 autonomy layer (default-preserving) - **ExperimentLedger** — append-only `workspace/experiments.jsonl`, one record per cycle (hypothesis / metrics / outcome). Crash-safe, queryable, zero LLM cost. This is the spine: persistent memory of what was tried. - **Data-driven stagnation signal** and an **advisory phase gate** computed over the ledger's metric trajectory. - **Append-only journals** `DEAD_ENDS.md` / `INSIGHTS.md` — never compacted (rotated to dated backups), so history isn't silently dropped like the two-tier MEMORY_LOG. - **Zero-cost violation scanner** and **proactive anti-burn rate limiting** (`max_cycles_per_hour`). - All signals are injected into the planning (THINK/REFLECT) context. The phase gate and rate limit are opt-in; everything else defaults to beha

- **Issue #21** (2026-04-29): **Add json_repair fallback and fix ANTHROPIC_API_KEY interference with …**
  *Symptoms*: …Bearer auth  json_repair provides lenient JSON parsing when model returns malformed tool_call blocks, reducing skipped dispatches.  Clear ANTHROPIC_API_KEY env var before constructing client when using Bearer token auth without an API key, preventing empty x-api-key header from interfering with Bearer authentication.

- **Issue #19** (2026-04-22): **Simplify recent updates summary**
  *Symptoms*: ## Summary - compress each Recent Updates entry to a single sentence - keep the latest release note as a one-line update  ## Verification - docs-only change; no code tests run

- **Issue #18** (2026-04-22): **Add dual skill installation and endpoint config**
  *Symptoms*: ## Summary - add compatible endpoint configuration for SDK providers - install built-in skills into both Claude Code and Codex - make source skills Codex-compatible and add skill metadata - add installer and skill validation tests  ## Verification - python3 -m unittest discover -s tests -p 'test*.py' - python3 -m compileall core tests install.py skills

- **Issue #17** (2026-04-21): **Add optional SSH execution backend**
  *Symptoms*: ## Summary  - add an optional local/ssh execution backend for tool execution and experiment monitoring - keep controller state local while allowing code, logs, PID checks, and GPU queries to run on one remote host - update README, AI_GUIDE, architecture docs, and slash-command guidance for the new execution mode  ## Validation  - python3 -m unittest discover -s tests -p "test*.py" - python3 -m compileall core tests 

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

### Incident Patch 1: `2a29d718` (2026-04-09)
**Commit Message**: fix: tighten loop safeguards and contributor guard

**File**: `.githooks/commit-msg` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+#!/bin/sh
+set -eu
+
+MSG_FILE="$1"
+
+if grep -qiE '^Co-Authored-By:' "$MSG_FILE"; then
+  echo "ERROR: Co-Authored-By trailers are forbidden in this repository." >&2
+  exit 1
+fi
+
+if grep -qiE '\b(claude|anthropic|openai|gpt-[0-9]|copilot|cursor|codex)\b' "$MSG_FILE"; then
+  echo "ERROR: AI assistant names are forbidden in commit messages for this repository." >&2
+  exit 1
+fi
```

**File**: `.githooks/pre-commit` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+#!/bin/sh
+set -eu
+
+ALLOWED_NAME="Xiangyue-Zhang"
+ALLOWED_EMAIL="85532891+Xiangyue-Zhang@users.noreply.github.com"
+
+AUTHOR_IDENT="$(git var GIT_AUTHOR_IDENT)"
+AUTHOR_NAME="$(printf '%s' "$AUTHOR_IDENT" | sed -E 's/^(.*) <.*$/\1/')"
+AUTHOR_EMAIL="$(printf '%s' "$AUTHOR_IDENT" | sed -E 's/^.* <([^>]*)>.*$/\1/')"
+
+if [ "$AUTHOR_NAME" != "$ALLOWED_NAME" ]; then
+  echo "ERROR: author name must be '$ALLOWED_NAME' but is '$AUTHOR_NAME'" >&2
+  exit 1
+fi
+
+if [ "$AUTHOR_EMAIL" != "$ALLOWED_EMAIL" ]; then
+  echo "ERROR: author email must be '$ALLOWED_EMAIL' but is '$AUTHOR_EMAIL'" >&2
+  exit 1
+fi
```

**File**: `.githooks/pre-push` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+#!/bin/sh
+set -eu
+
+ALLOWED_NAME="Xiangyue-Zhang"
+ALLOWED_EMAIL="85532891+Xiangyue-Zhang@users.noreply.github.com"
+
+check_commit() {
+  sha="$1"
+  author_name="$(git show -s --format='%an' "$sha")"
+  author_email="$(git show -s --format='%ae' "$sha")"
+  message="$(git show -s --format='%B' "$sha")"
+
+  if [ "$author_name" != "$ALLOWED_NAME" ]; then
+    echo "ERROR: commit $sha has author '$author_name', expected '$ALLOWED_NAME'" >&2
+    exit 1
+  fi
+
+  if [ "$author_email" != "$ALLOWED_EMAIL" ]; then
+    echo "ERROR: commit $sha has email '$author_email', expected '$ALLOWED_EMAIL'" >&2
+    exit 1
+  fi
+
+  if printf '%s\n' "$message" | grep -qiE '^Co-Authored-By:'; then
+    echo "ERROR: commit $sha contains forbidden Co-Authored-By trailer" >&2
+    exit 1
+  fi
+
+  if printf '%s\n' "$message" | grep -qiE '\b(claude|anthropic|openai|gpt-[0-9]|copilot|cursor|codex)\b'; then
+    echo "ERROR: commit $sha contains forbidden AI assistant name in message" >&2
+    exit 1
+  fi
+}
+
+while read -r local_ref local_sha remote_ref remote_sha
+do
+  if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
+    continue
+  fi
+
+  if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
+    range="$local_sha"
+  else
+    range="$remote_sha..$local_sha"
+  fi
+
+  for sha in $(git rev-list "$range"); do
+    check_commit "$sha"
+  done
+done
```

**File**: `.github/workflows/contributor-guard.yml` (modified, +5/-5)
```diff
@@ -46,7 +46,7 @@ jobs:
 
           FAIL=0
           ALLOWED_NAME="Xiangyue-Zhang"
-          ALLOWED_EMAILS="85532891\\+Xiangyue-Zhang@users\\.noreply\\.github\\.com|Xiangyue-Zhang@users\\.noreply\\.github\\.com"
+          ALLOWED_EMAIL="85532891+Xiangyue-Zhang@users.noreply.github.com"
 
           for sha in $(git log --format='%H' "$RANGE" 2>/dev/null || git log --format='%H' HEAD); do
             AN=$(git show -s --format='%an' "$sha")
@@ -63,8 +63,8 @@ jobs:
             fi
 
             # Check author email
-            if ! echo "$AE" | grep -qE "^($ALLOWED_EMAILS)$"; then
-              echo "  ❌ author email '$AE' is not in allow-list"
+            if [ "$AE" != "$ALLOWED_EMAIL" ]; then
+              echo "  ❌ author email '$AE' is not '$ALLOWED_EMAIL'"
               FAIL=1
             fi
 
@@ -76,8 +76,8 @@ jobs:
 
             # Check for AI assistant names in commit message
             if echo "$MSG" | grep -qiE '\b(claude|anthropic|openai|gpt-[0-9]|copilot|cursor|codex)\b'; then
-              echo "  ⚠️  commit message mentions AI assistant name (allowed if intentional, but flagged)"
-              # warn only — do not fail, since legitimate features may mention these
+              echo "  ❌ commit message mentions forbidden AI assistant name"
+              FAIL=1
             fi
 
             echo ""
```

**File**: `README.md` (modified, +5/-0)
```diff
@@ -37,6 +37,11 @@
 
 ## Recent Updates
 
+**2026-04-09**
+- Reduced token growth by resetting leader context between cycles.
+- Added a lightweight fallback to avoid repeated no-progress loops.
+- Hardened tool execution against path traversal and shell injection.
+
 **2026-04-08**
 - Added progress tracking exports for experiment monitoring.
 - Supports optional Obsidian sync for a live dashboard plus daily notes.
```

#### Recent Merged Pull Requests:
- **PR #31** (2026-06-03): Add domestic LLM API provider presets (@Xiangyue-Zhang)
- **PR #30** (2026-06-02): Add Slurm execution backend + truthful experiment outcomes (@Xiangyue-Zhang)
- **PR #29** (2026-06-01): Sync CN/JP/KR READMEs to v2.0 (@Xiangyue-Zhang)
- **PR #28** (2026-06-01): v2 autonomy layer + stronger repo-reading & literature tools (@Xiangyue-Zhang)
- **PR #21** (closed): Add json_repair fallback and fix ANTHROPIC_API_KEY interference with … (@bigfeetsmalltone)
- **PR #19** (2026-04-22): Simplify recent updates summary (@Xiangyue-Zhang)
- **PR #18** (2026-04-22): Add dual skill installation and endpoint config (@Xiangyue-Zhang)
- **PR #17** (2026-04-21): Add optional SSH execution backend (@Xiangyue-Zhang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
