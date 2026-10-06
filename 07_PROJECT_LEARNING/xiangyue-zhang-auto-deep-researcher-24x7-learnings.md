# Forensic Learning Record (Deep Inspection): Xiangyue-Zhang/auto-deep-researcher-24x7

> **Canonical Artifact**: `07_PROJECT_LEARNING/xiangyue-zhang-auto-deep-researcher-24x7-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Xiangyue-Zhang/auto-deep-researcher-24x7](https://github.com/Xiangyue-Zhang/auto-deep-researcher-24x7))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:34:00.119Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Xiangyue-Zhang/auto-deep-researcher-24x7`
- **Description**: 🔥 An autonomous AI agent that runs your deep learning experiments 24/7 while you sleep. Zero-cost monitoring, Leader-Worker architecture, constant-size memory.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1294 stars

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
            tool result are also surfaced at the top level so the loop's
            EXECUTE → MONITOR handoff keeps working.
        """
        if agent_type not in self.WORKER_CONFIGS:
            raise ValueError(f"Unknown agent type: {agent_type}")
        if tool_registry is None:
            raise TypeError(
                "dispatch_worker requires a tool_registry with "
                "`get_tools_for(agent_type)` and `execute_tool(name, args)` "
                "methods. Pass a ToolRegistry configured with an empty tool "
                "list if you want a tool-less worker."
            )

        config = self.WORKER_CONFIGS[agent_type]
        base_prompt = self._load_prompt(config["prompt_file"])
        tool_defs = tool_registry.get_tools_for(agent_type)
        system_prompt = base_prompt + "\n\n" + self._render_tools_section(tool_defs)
        max_turns = config["max_turns"]

        # codex_cli hard-codes its own agentic tool loop; it will ignore the
        # <tool_call> protocol and silently act on its own. That breaks the
        # EXECUTE → MONITOR handoff (no PID, no log_file from ToolRegistry).
        # Leader/think dispatches are fine (they do not use tools) but worker
        # dispatches will likely return a non-authoritative summary. Warn once
        # per dispatch so users see it in the log without it becoming noise.
        if self.provider == "codex_cli" and tool_defs:
            logger.warning(
                "codex_cli is being used as a worker provider; its CLI does "
                "not support disabling built-in tools, so it may bypass the "
                "ToolRegistry and the resulting PID/log_file cannot be "
                "recovered. For worker dispatches prefer claude_cli, "
                "anthropic, or openai."
            )

        logger.info(f"Dispatching {agent_type} agent: {task[:100]}...")

        messages = [{"role": "user", "content": task}]
        last_response = ""
        tool_results_log: list[dict] = []

        for turn in range(1, max_turns + 1):

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
        except Exception:
            pass
        return {"utilization": "N/A"}


    def main():
        payload = json.load(sys.stdin)
        root = pathlib.Path(payload["remote_workspace"]).expanduser().resolve(strict=False)
        action = payload["action"]
        result = None

        if action == "validate":
            root.mkdir(parents=True, exist_ok=True)
            result = {"status": "ok"}
        elif action == "read_file":
            path = resolve_path(root, payload["path"])
            if not path.exists():
                raise FileNotFoundError(f"File not found: {payload['path']}")
            result = {"content": path.read_text()}
        elif action == "read_file_range":
            path = resolve_path(root, payload["path"])
            if not path.exists():
                raise FileNotFoundError(f"File not found: {payload['path']}")
            lines = path.read_text().splitlines()
            start = max(1, int(payload.get("start_line", 1)))
            end_raw = payload.get("end_line")
            end = len(lines) if end_raw is None else min(len(lines), int(end_raw))
            if end < start:
                result = {"content": ""}
            else:
                selected = lines[start - 1:end]
                result = {"content": "\\n".join(str(start + i) + "\\t" + t for i, t in enumerate(selected))}
        elif action == "list_tree":
            raw = payload.get("path", ".")
            base = root if raw in ("", ".") else resolve_path(root, raw)
            if not base.is_dir():
                raise NotADirectoryError("Not a directory: " + str(raw))
            result = {"entries": walk_tree(base, payload.get("max_depth", 3), payload.get("max_entries", 300))}
        elif action == "grep_files":
            raw = payload.get("path", ".")
            base = root if raw in ("", ".") else resolve_path(root, raw)
            result = {"hits": grep_tree(base, root, payload["pattern"], payload.get("max_results", 50), payload.get("ignore_case", False))}
 
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
                            "terminal_state": monitor_result.get("terminal_state", ""),
                            "last_training_logs": monitor_result.get("log_tail", ""),
                            "last_metrics": monitor_result.get("metrics", {}),
                            "elapsed_hours": monitor_result.get("elapsed_hours"),
                        }
                    )

                # REFLECT: Evaluate and update
                reflect_result = self._reflect(execute_result)
                self._update_state(
                    {
                        "cycle": self.cycle_count,
                        "updated_at": time.time(),
                        "last_milestone": reflect_result.get("milestone", ""),
                        "last_decision": reflect_result.get("decision", ""),
                        "suggested_next_step": reflect_result.get("decision")
                        or reflect_result.get("reason")
                        or reflect_result.get("task", ""),
                        "last_error": "",
                    }
                )
                self._record_cycle_outcome(think_result, execute_result, reflect_result)
                self._record_to_ledger(think_result, execute_result, reflect_result)
                self._refresh_obsidian(reflect_result=reflect_result, directive=directive)

            except Exception as e:
                logger.error(f"Cycle {self.cycle_count} failed: {e}", exc_info=True)
                self.memory.log_decision(f"Cycle {self.cycle_count} error: {str(e)[:200]}")
                self._update_state(
                    {
                        "cycle": self.cycle_count,
                        "status": "error",
                        "updated_at": time.time(),
                        "last_error": str(e)[:500],
                    }
                )
                self._cooldown_after_error()

        logger.info("AutoResearcher stopped.")

    def _think(self, directive: Optional[str] = None) -> dict:
        """THINK phase
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

### Core Architecture Module: `core/obsidian.py`
```
"""
Obsidian export helpers for Deep Researcher Agent.

Turns current project state into Obsidian-friendly Markdown:
- Dashboard.md: current snapshot, overwritten on refresh
- Daily/YYYY-MM-DD.md: append-only daily cycle notes
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Optional

import yaml

from .execution import ExecutionBackend, LocalExecutionBackend, build_execution_backend
from .memory import MemoryManager


class ObsidianExporter:
    """Project-level Obsidian Markdown exporter."""

    def __init__(
        self,
        config: dict,
        project_dir: str | Path,
        backend: Optional[ExecutionBackend] = None,
    ):
        self.config = config or {}
        self.project_dir = Path(project_dir).resolve()
        self.project_name = self.project_dir.name
        self.workspace = self.project_dir / self.config.get("project", {}).get("workspace", "workspace")
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.state_path = self.workspace / "state.json"
        self.backend = backend or LocalExecutionBackend(self.workspace)

        self.obsidian_config = self.config.get("obsidian", {})
        self.enabled = bool(self.obsidian_config.get("enabled", False))
        self.vault_path = self.obsidian_config.get("vault_path", "")
        self.project_subdir = self.obsidian_config.get("project_subdir", "DeepResearcher/{project_name}")
        self.dashboard_note = self.obsidian_config.get("dashboard_note", "Dashboard.md")
        self.daily_dir = self.obsidian_config.get("daily_dir", "Daily")
        self.auto_append_daily = bool(self.obsidian_config.get("auto_append_daily", True))
        self.local_fallback_dir = self.obsidian_config.get("local_fallback_dir", "progress_tracking")

    def is_enabled(self) -> bool:
        return self.enabled

    def refresh_all(self, memory: MemoryManager, cycle_count: int) -> dict:
        if not self.is_enabled():
            return {"status": "disabled"}

        dashboard = self.refresh_dashboard(memory=memory, cycle_count=cycle_count)
        daily = self.append_daily_entry(memory=memory, cycle_count=cycle_count, event_type="manual_refresh")
        return {"status": "ok", "dashboard": dashboard, "daily": daily}

    def refresh_dashboard(self, memory: MemoryManager, cycle_count: int) -> dict:
        if not self.is_enabled():
            return {"status": "disabled"}

        base_dir = self._base_dir()
        base_dir.mkdir(parents=True, exist_ok=True)
        dashboard_path = base_dir / self._dashboard_filename()
        state = self._load_state()
        dashboard_path.write_text(self._render_dashboard(memory=memory, state=state, cycle_count=cycle_count))
        return {"status": "written", "path": str(dashboard_path)}

    def append_daily_entry(
        self,
        memory: MemoryManager,
        cycle_count: int,
        event_type: str = "cycle_complete",
        reflection: Optional[dict] = None,
        directive: Optional[str] = None,
    ) -> dict:
        if not self.is_enabled() or (event_type == "cycle_complete" and not self.auto_append_daily):
            return {"status": "disabled"}

        base_dir = self._base_dir()
        daily_path = base_dir / self.daily_dir / self._daily_filename()
        daily_path.parent.mkdir(parents=True, exist_ok=True)

        state = self._load_state()
        entry = self._render_daily_entry(
            memory=memory,
            state=state,
            cycle_count=cycle_count,
            event_type=event_type,
            reflection=reflection or {},
            directive=directive,
        )

        if daily_path.exists():
            existing = daily_path.read_text().rstrip()
            daily_path.write_text(f"{existing}\n\n{entry}\n")
        else:
            header = f"# {self.project_name} — Daily Log — {time.strftime('%Y-%m-%d')}\n\n"
            daily_path.write_text(f"{header}{entry}\n")

        return {"status": "written", "path": str(daily_path)}

    def _base_dir(self) -> Path:
        if self.vault_path:
            subdir = self.project_subdir.format(project_name=self.project_name)
            return Path(self.vault_path).expanduser() / subdir
        return self.workspace / self.local_fallback_dir

    def _dashboard_filename(self) -> str:
        return self.dashboard_note if self.vault_path else "Dashboard.txt"

    def _daily_filename(self) -> str:
        return f"{time.strftime('%Y-%m-%d')}.md" if self.vault_path else f"{time.strftime('%Y-%m-%d')}.txt"

    def _load_state(self) -> dict:
        if self.state_path.exists():
            try:
                return json.loads(self.state_path.read_text())
            except json.JSONDecodeError:
                return {}
        return {}

    def _parse_log_sections(self, memory: MemoryManager) -> tuple[list[str], list[str]]:
        milestones: list[str] = []
        decisions: list[str] = []
        current = None
        for line in memory.get_log().splitlines():
            stripped = line.strip()
            if stripped == "## Key Results":
                current = "milestones"
            elif stripped == "## Recent Decisions":
                current = "decisions"
            elif stripped.startswith("["):
                if current == "milestones":
                    milestones.append(stripped)
                elif current == "decisions":
                    decisions.append(stripped)
        return milestones, decisions

    def _read_pending_directive(self) -> str:
        directive_path = self.workspace / "HUMAN_DIRECTIVE.md"
        if directive_path.exists():
            return directive_path.read_text().strip()
        return ""

    def _read_log_tail(self, log_file: str, lines: int = 8) -> str:
        if not log_file:
            return ""
        try:
            return "\n".join(self.backend.tail_file(log_file, lines=lines))
        except Exception:
            path = Path(log_file)
            if path.is_absolute() and path.exists():
                return "\n".join(path.read_text().splitlines()[-lines:])
        return ""

    def _pid_alive(self, pid: Optional[int]) -> bool:
        if not pid:
            return False
        try:
            return self.backend.is_process_alive(int(pid))
        except Exception:
            return False

    def _format_status(self, state: dict) -> str:
        status = state.get("status", "idle")
        pid = state.get("pid")
        if status == "running" and self._pid_alive(pid):
            started_at = state.get("started_at")
            elapsed = ""
            if started_at:
                elapsed = f", {((time.time() - float(started_at)) / 3600):.1f}h"
            return f"TRAINING (PID {pid}{elapsed})"
        if status == "completed":
            return "COMPLETED"
        if status == "error":
            return "ERROR"
        if status == "failed":
            terminal_state = state.get("terminal_state")
            if terminal_state and terminal_state != "unknown":
                return f"FAILED ({terminal_state})"
            return "FAILED"
        if status == "no_pid":
            return "FAILED (no PID)"
        return "IDLE"

    def _render_dashboard(self, memory: MemoryManager, state: dict, cycle_count: int) -> str:
        milestones, decisions = self._parse_log_sections(memory)
        pending_directive = self._read_pending_directive()
        best_result = milestones[-1] if milestones else "None yet"
        latest_decisions = decisions[-3:] if decisions else []
        log_tail = state.get("last_training_logs") or self._read_log_tail(state.get("log_file", ""))
        latest_snapshot = log_tail or "No active or recent training log."
        suggested_next = state.get("suggested_next_step") or (latest_decisions[-1] if latest_decisions else "Continue with current research direction.")

        lines = [
            f"# {self.project_name} Dashboard",
            "",
            f"_Last refreshed: {time.strftime('%Y-%m-%d %H:%M:%S')}_",
            "",
            f"- Output target: {'Obsidian vault' if self.vault_path else 'project-local text fallback'}",
            "",
            "## Project",
            f"- Name: {self.project_name}",
            f"- Path: `{self.project_dir}`",
            "",
            "## Goal",
            memory.get_brief().strip() or "PROJECT_BRIEF.md is empty.",
            "",
            "## Current Status",
            f"- Status: {self._format_status(state)}",
            f"- Cycles completed: {cycle_count}",
            "",
            "## Best Result",
            f"- {best_result}",
            "",
            "## Latest Training Snapshot",
            "```text",
            latest_snapshot,
            "```",
            "",
            "## Recent Decisions",
        ]

        if latest_decisions:
            lines.extend([f"- {entry}" for entry in latest_decisions])
        else:
            lines.append("- None yet")

        lines.extend(
            [
                "",
                "## Pending Directive",
                pending_directive if pending_directive else "None",
                "",
                "## Suggested Next Step",
                suggested_next,
                "",
            ]
        )
        return "\n".join(lines)

    def _render_daily_entry(
        self,
        memory: MemoryManager,
        state: dict,
        cycle_count: int,
        event_type: str,
        reflection: dict,
        directive: Optional[str],
    ) -> str:
        milestones, decisions = self._parse_log_sections(memory)
        latest_metric = state.get("last_metrics", {})
        latest_metric_text = ", ".join(f"{k}={v}" for k, v in latest_metric.items()) if latest_metric else "none"
        last_milestone = reflection.get("milestone") or state.get("last_milestone") or (milestones[-1] if milestones else "none")
        last_decision = reflection.get("decision") or state.get("last_decision") or (dec
```

### Core Architecture Module: `core/safety.py`
```
"""
Zero-cost safety helpers — pure functions over state + ledger, no GPU/network.

These keep a long-running agent honest without spending tokens:

- ``scan_violations`` surfaces bad states (repeated no-progress, stale
  "running" state) as advisory strings the loop injects into the THINK context.
- ``seconds_until_allowed`` is the proactive anti-burn rate limiter: given the
  recent cycle-start timestamps, it returns how long to wait so the agent never
  exceeds ``max_per_hour`` cycles (protecting budget when stuck in a loop).

Everything here is deliberately pure and side-effect-free so it is unit-testable
with crafted inputs — no nvidia-smi, no subprocess, no clock.
"""

from __future__ import annotations


def scan_violations(
    state: dict,
    fail_count: int,
    now: float,
    fail_threshold: int = 3,
    stale_state_hours: int = 6,
) -> list[str]:
    """Return advisory violation messages for the current state."""
    violations: list[str] = []
    state = state if isinstance(state, dict) else {}

    if fail_threshold and fail_count >= fail_threshold:
        violations.append(
            f"{fail_count} consecutive no-progress cycles on the same plan — "
            "try a materially different approach or wait for new signal."
        )

    updated = state.get("updated_at")
    status = state.get("status")
    if updated is not None and status == "running" and stale_state_hours:
        try:
            age_hours = (float(now) - float(updated)) / 3600.0
        except (TypeError, ValueError):
            age_hours = 0.0
        if age_hours > stale_state_hours:
            violations.append(
                f"State has been 'running' for {age_hours:.1f}h without an update "
                f"(> {stale_state_hours}h) — training may be stuck or the process died."
            )

    return violations


def seconds_until_allowed(
    timestamps: list[float],
    now: float,
    max_per_hour: int,
    window: int = 3600,
) -> float:
    """How long to wait before starting another cycle, given recent starts.

    Returns 0.0 when rate limiting is disabled (``max_per_hour`` <= 0) or the
    recent count is under budget. Otherwise returns the seconds until the
    oldest in-window timestamp rolls past ``window``.
    """
    if not max_per_hour or max_per_hour <= 0:
        return 0.0
    recent = [t for t in (timestamps or []) if (now - t) < window]
    if len(recent) < max_per_hour:
        return 0.0
    # Wait until enough of the oldest in-window starts roll off to bring the
    # count back under max_per_hour — not just the single oldest one.
    recent_sorted = sorted(recent)
    target = recent_sorted[len(recent) - max_per_hour]
    return max(0.0, float(window) - (float(now) - float(target)))


def prune_timestamps(timestamps: list[float], now: float, window: int = 3600) -> list[float]:
    """Drop timestamps older than ``window`` seconds."""
    return [t for t in (timestamps or []) if (now - t) < window]

```

### Core Architecture Module: `core/tools.py`
```
"""
AutoResearcher Tool Registry

Each agent gets a minimal tool set (3-5 tools) instead of all tools.
This reduces token overhead per API call significantly.
"""

import json
import logging
import shlex
from pathlib import Path

from .execution import ExecutionBackend, normalize_relative_path

logger = logging.getLogger("autoresearcher.tools")


class ToolRegistry:
    """Manages tools available to agents.

    Design principle: minimal tool sets per agent.
    - Leader: log_memory, write_file, read_file
    - Idea Agent: search_papers, search_arxiv, get_paper, write_file, read_file
    - Code Agent: run_shell, launch_experiment, write_file, read_file, list_files,
      list_tree, search_code
    - Writing Agent: write_file, read_file, list_files, search_code

    Fewer tools = fewer tokens in each API call = lower cost.
    """

    def __init__(self, backend: ExecutionBackend):
        self.backend = backend
        self._protected_files = {"state.json", "MEMORY_LOG.md", "PROJECT_BRIEF.md", ".lock"}

    def get_tools_for(self, agent_type: str) -> list[dict]:
        """Get tool definitions for a specific agent type."""
        tool_map = {
            "leader": [self._tool_log_memory, self._tool_write_file, self._tool_read_file],
            "idea": [
                self._tool_search_papers,
                self._tool_search_arxiv,
                self._tool_get_paper,
                self._tool_write_file,
                self._tool_read_file,
            ],
            "code": [
                self._tool_run_shell,
                self._tool_launch_experiment,
                self._tool_write_file,
                self._tool_read_file,
                self._tool_list_files,
                self._tool_list_tree,
                self._tool_search_code,
            ],
            "writing": [
                self._tool_write_file,
                self._tool_read_file,
                self._tool_list_files,
                self._tool_search_code,
            ],
        }
        return tool_map.get(agent_type, [])

    def execute_tool(self, name: str, args: dict) -> str:
        """Execute a tool by name and return the result."""
        handlers = {
            "run_shell": self._exec_run_shell,
            "launch_experiment": self._exec_launch_experiment,
            "write_file": self._exec_write_file,
            "read_file": self._exec_read_file,
            "list_files": self._exec_list_files,
            "list_tree": self._exec_list_tree,
            "search_code": self._exec_search_code,
            "search_papers": self._exec_search_papers,
            "search_arxiv": self._exec_search_arxiv,
            "get_paper": self._exec_get_paper,
            "log_memory": self._exec_log_memory,
        }

        handler = handlers.get(name)
        if not handler:
            return json.dumps({"error": f"Unknown tool: {name}"})

        try:
            return handler(**args)
        except Exception as e:
            logger.error(f"Tool {name} failed: {e}")
            return json.dumps({"error": str(e)})

    # --- Tool Definitions (for API schema) ---

    @property
    def _tool_run_shell(self) -> dict:
        return {
            "name": "run_shell",
            "description": "Run a shell command and return output. Use for quick checks, file ops, git commands. For long-running training, use launch_experiment instead.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to execute"},
                    "timeout": {"type": "integer", "description": "Timeout in seconds (default: 120)", "default": 120},
                },
                "required": ["command"],
            },
        }

    @property
    def _tool_launch_experiment(self) -> dict:
        return {
            "name": "launch_experiment",
            "description": "Launch a long-running experiment via nohup. Returns PID for monitoring. Use this for training runs, not run_shell.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Training command to run"},
                    "log_file": {"type": "string", "description": "Path for stdout/stderr log"},
                    "gpu": {"type": "string", "description": "CUDA_VISIBLE_DEVICES value"},
                },
                "required": ["command", "log_file"],
            },
        }

    @property
    def _tool_write_file(self) -> dict:
        return {
            "name": "write_file",
            "description": "Write content to a file. Cannot overwrite protected files (state.json, MEMORY_LOG.md, PROJECT_BRIEF.md).",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to workspace"},
                    "content": {"type": "string", "description": "Content to write"},
                },
                "required": ["path", "content"],
            },
        }

    @property
    def _tool_read_file(self) -> dict:
        return {
            "name": "read_file",
            "description": (
                "Read a file's contents. For large files, pass start_line/end_line "
                "to read just a slice (1-indexed, inclusive) with line numbers, "
                "instead of being truncated at 10K chars."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to workspace"},
                    "start_line": {"type": "integer", "description": "First line to read (1-indexed). Optional."},
                    "end_line": {"type": "integer", "description": "Last line to read (1-indexed, inclusive). Optional."},
                },
                "required": ["path"],
            },
        }

    @property
    def _tool_list_files(self) -> dict:
        return {
            "name": "list_files",
            "description": "List files in a single directory (non-recursive). Use list_tree for a recursive overview.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path relative to workspace", "default": "."},
                },
            },
        }

    @property
    def _tool_list_tree(self) -> dict:
        return {
            "name": "list_tree",
            "description": (
                "Recursively list the directory tree (depth-limited) to understand repo "
                "structure in one call. Skips .git, __pycache__, node_modules and similar. "
                "Directories end with '/'."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Root directory relative to workspace", "default": "."},
                    "max_depth": {"type": "integer", "description": "Max recursion depth (default: 3)", "default": 3},
                    "max_entries": {"type": "integer", "description": "Max entries to return (default: 300)", "default": 300},
                },
            },
        }

    @property
    def _tool_search_code(self) -> dict:
        return {
            "name": "search_code",
            "description": (
                "Search file contents for a regular expression across the workspace "
                "(grep-style). Returns matching file path, line number, and line text. "
                "Use this to locate where something is defined or used before reading files."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Regular expression to search for"},
                    "path": {"type": "string", "description": "Directory/file to search under (default: whole workspace)", "default": "."},
                    "max_results": {"type": "integer", "description": "Max matches to return (default: 50)", "default": 50},
                    "ignore_case": {"type": "boolean", "description": "Case-insensitive search (default: false)", "default": False},
                },
                "required": ["pattern"],
            },
        }

    @property
    def _tool_search_papers(self) -> dict:
        return {
            "name": "search_papers",
            "description": "Search for academic papers via Semantic Scholar API.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "description": "Max results (default: 10)", "default": 10},
                    "year": {"type": "string", "description": "Year filter, e.g. '2024-2026'"},
                },
                "required": ["query"],
            },
        }

    @property
    def _tool_search_arxiv(self) -> dict:
        return {
            "name": "search_arxiv",
            "description": (
                "Search arXiv directly for the most recent preprints (Semantic Scholar "
                "indexing lags by days). Returns title, arXiv id, authors, published date, "
                "and abstract. Prefer this for very recent work; use search_papers for "
                "citation counts and venue coverage."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "description": "Max results (default: 10)", "default": 10},
                    "category": {"type": "string", "description": "Optional 
```

### Core Architecture Module: `gpu/__init__.py`
```
"""GPU detection and management utilities."""

from .detect import detect_gpus, gpu_status, is_gpu_available, get_usable_gpus, get_free_gpus

__all__ = ["detect_gpus", "gpu_status", "is_gpu_available", "get_usable_gpus", "get_free_gpus"]

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

### Incident Patch 1: `d1f357b0` (2026-04-19)
**Commit Message**: Implement real tool-use loop for worker dispatches (closes #13)

Rewrite dispatch_worker from a single-shot text call into a true
iterative tool-use loop. The worker's tool schemas are rendered as
plain text and injected into the system prompt; worker responses are
scanned for <tool_call>{...}</tool_call> blocks which are executed
through ToolRegistry.execute_tool, and results are fed back as
<tool_result> blocks in the next user turn. The loop runs until the
worker produces a final answer with no tool calls, or max_turns is
hit. This works identically across all four `provider` values —
the two SDK paths and the two `*_cli` subprocess paths.

Before this change, the `tools` argument threaded through
dispatch_worker was silently dropped by the backend implementations,
ToolRegistry.execute_tool was only reachable from tests, and PIDs
were recovered by regex-scraping the worker's prose rather than by
reading the launch_experiment tool result. All three gaps are now
closed:

- dispatch_worker is a multi-turn loop; each turn sends the growing
  conversation through _call_llm and acts on emitted tool_call blocks.
- launch_experiment's structured JSON result is the authoritative
  source

**File**: `AI_GUIDE.md` (modified, +27/-0)
```diff
@@ -348,6 +348,33 @@ During training (90%+ of time), the agent does NOT call the LLM. It only does:
 - **Writing Agent**: generates reports (3 tools)
 - Only 1 worker active at a time, others cost $0
 
+### Tool-Use Protocol (provider-agnostic)
+
+Workers do not use each provider's native SDK tool-use protocol. Instead the
+framework injects a plain-text schema into the system prompt and the worker
+emits tool calls as `<tool_call>{...}</tool_call>` blocks. The dispatcher
+parses the blocks, runs each through `ToolRegistry.execute_tool`, and feeds
+results back as `<tool_result name="...">...</tool_result>` in the next user
+turn. The loop runs until the worker produces a response with no tool calls
+(the final answer) or `max_turns` is reached.
+
+Why this design:
+
+- **One protocol, four providers** — the Anthropic and OpenAI SDK paths use
+  the same text protocol as `claude_cli` and `codex_cli`. No per-provider
+  branching in the execution loop.
+- **Authoritative PID / log_file** — the EXECUTE → MONITOR handoff reads
+  `pid` and `log_file` directly from the `launch_experiment` tool's JSON
+  result, not from regex-scraping the model's prose.
+- **Provider-lock-down** — for `claude_cli` the framework passes
+  `--tools ""` so the CLI cannot bypass the protocol with its own built-in
+  tools. `codex_cli` has no equivalent flag and will silently ignore the
+  protocol; a runtime warning is emitted when it is used as a worker, and
+  users should pick one of the other three providers for worker dispatches.
+- **Fence stripping** — tool-call blocks inside triple-backtick code fences
+  are ignored, so a model's illustrative example in its prose is never
+  accidentally executed.
+
 ### Safety
 - Mandatory dry-run before every real training
 - Protected files can't be overwritten
```

**File**: `CLAUDE.md` (modified, +24/-0)
```diff
@@ -396,6 +396,30 @@ During training (90%+ of time), the agent does NOT call the LLM. It only does:
 - **Writing Agent**: generates reports (3 tools)
 - Only 1 worker active at a time, others cost $0
 
+### Tool-Use Protocol (provider-agnostic)
+
+Workers do not use each provider's native SDK tool-use protocol. Instead the
+framework injects a plain-text schema into the system prompt and the worker
+emits tool calls as `<tool_call>{...}</tool_call>` blocks. The dispatcher
+parses the blocks, runs each through `ToolRegistry.execute_tool`, and feeds
+results back as `<tool_result name="...">...</tool_result>` in the next user
+turn. The loop runs until the worker produces a response with no tool calls
+(the final answer) or `max_turns` is reached.
+
+Key properties:
+
+- One text protocol works identically across all four providers — no
+  per-provider branching in the execution loop.
+- `launch_experiment` PID and log_file come authoritatively from the tool
+  result's JSON, not from regex-scraping the model's prose.
+- For `claude_cli` the framework passes `--tools ""` so the CLI cannot
+  bypass the protocol with its own built-in tools. `codex_cli` has no
+  equivalent flag and may silently ignore the protocol; a runtime warning
+  is emitted when it is used as a worker, and users should pick one of the
+  other three providers for worker dispatches.
+- Tool-call blocks inside triple-backtick code fences are ignored, so a
+  model's illustrative example in prose is never accidentally executed.
+
 ### Safety
 - Mandatory dry-run before every real training
 - Protected files can't be overwritten
```

**File**: `README.md` (modified, +23/-12)
```diff
@@ -37,6 +37,14 @@
 
 ## Recent Updates
 
+**2026-04-19**
+- Workers now execute tools through a real multi-turn tool-use loop. The dispatcher injects the tool schema into the system prompt, parses `<tool_call>` blocks from the LLM response, runs each through `ToolRegistry.execute_tool`, feeds results back as `<tool_result>` in the next turn, and iterates until the worker produces a response with no tool calls or `max_turns` is hit. Previously the `tools` argument was accepted and silently dropped, and worker output was regex-scraped for PIDs — closes the gap raised in issue #13.
+- `launch_experiment` PIDs and log file paths are now surfaced directly from the tool result (authoritative), with the old free-text regex retained only as a fallback for pre-protocol responses.
+- `claude_cli` is forced into pure-text mode via `claude -p --tools ""`, so its responses reliably go through the framework's protocol.
+- `codex_cli` cannot be forced into pure-text mode by any current flag; when used as a worker provider the framework now emits a clear warning (see the updated compatibility table in *Supported LLM Providers*).
+- Tool-call blocks inside triple-backtick code fences are stripped before parsing, so illustrative examples in the LLM's prose are no longer accidentally executed.
+- Dead parameters (`tools`, `max_turns`) removed from `_call_llm`. They were never forwarded to the SDK; this aligns the code with what it actually does.
+
 **2026-04-18**
 - Added two new `provider` modes that reuse existing flat-rate subscriptions instead of per-token API billing: `claude_cli` (via the local `claude -p` CLI) and `codex_cli` (via the local `codex exec` CLI). Much cheaper when running multiple 24/7 agents in parallel. See the updated *Supported LLM Providers* section for the full API-vs-subscription trade-off table.
 - Provider validation added at dispatcher construction; unknown provider values now fail fast with a clear error instead of silently falling through.
@@ -863,18 +871,21 @@ Works with **both Anthropic and OpenAI** out of the box, and can run on a
 
 ### Authentication mode: API key vs. subscription
 
-| Mode | `provider` value | Billing | Requires |
-|------|------------------|---------|----------|
-| API — Anthropic | `anthropic` | Per-token, via `ANTHROPIC_API_KEY` | `pip install anthropic` |
-| API — OpenAI | `openai` | Per-token, via `OPENAI_API_KEY` | `pip install openai` |
-| **Subscription — Claude** | `claude_cli` | Flat-rate, uses your Claude Code / Pro / Max plan | `claude` CLI installed and logged in |
-| **Subscription — ChatGPT** | `codex_cli` | Flat-rate, uses your ChatGPT Plus / Pro plan | `codex` CLI installed and logged in |
-
-The `*_cli` modes shell out to the headless CLI (`claude -p` / `codex exec`) and
-share your existing subscription quota. This is much cheaper than per-token
-billing when you run multiple agents in parallel or do heavy Think/Reflect
-cycles. Trade-off: no native prompt caching or tool-use protocol — the CLI is
-used as a plain text-in / text-out oracle.
+| Mode | `provider` value | Billing | Requires | Tool-use support |
+|------|------------------|---------|----------|------------------|
+| API — Anthropic | `anthropic` | Per-token, via `ANTHROPIC_API_KEY` | `pip install anthropic` | ✅ Full |
+| API — OpenAI | `openai` | Per-token, via `OPENAI_API_KEY` | `pip install openai` | ✅ Full |
+| **Subscription — Claude** | `claude_cli` | Flat-rate, uses your Claude Code / Pro / Max plan | `claude` CLI installed and logged in | ✅ Full |
+| **Subscription — ChatGPT** | `codex_cli` | Flat-rate, uses your ChatGPT Plus / Pro plan | `codex` CLI installed and logged in | ⚠️ Leader only |
+
+Tool execution is driven by a text-based `<tool_call>` protocol injected
+into the worker's system prompt. All three "Full" providers can be forced
+into pure text-oracle mode so they honor the protocol (for `claude_cli`
+the framework passes `--tools ""` to disable built-in CLI tools). The
+`codex` CLI currently offers no equivalent flag — its internal agentic
+loop will bypass the protocol and the framework cannot recover PIDs from
+experiments it launches. Use `codex_cli` only for the leader/think path
+where no tools are needed.
 
 Switch provider in `config.yaml`:
 ```yaml
```

**File**: `config.yaml` (modified, +16/-7)
```diff
@@ -8,14 +8,23 @@ project:
 
 agent:
   # Provider:
-  #   "anthropic"  — Anthropic SDK, per-token API billing (ANTHROPIC_API_KEY)
-  #   "openai"     — OpenAI SDK, per-token API billing (OPENAI_API_KEY)
-  #   "claude_cli" — `claude -p` subprocess, reuses Claude Code / Pro / Max subscription
-  #   "codex_cli"  — `codex exec` subprocess, reuses ChatGPT Plus / Pro subscription
+  #   "anthropic"  — SDK, per-token API billing (ANTHROPIC_API_KEY)
+  #   "openai"     — SDK, per-token API billing (OPENAI_API_KEY)
+  #   "claude_cli" — subprocess, reuses Claude Code / Pro / Max subscription
+  #   "codex_cli"  — subprocess, reuses ChatGPT Plus / Pro subscription
   #
-  # The *_cli options are much cheaper when running many agents in parallel,
-  # because they share your existing subscription quota instead of per-token billing.
-  # They require the corresponding CLI to be installed and logged in once on this host.
+  # The *_cli options are much cheaper when running many agents in parallel
+  # because they share your existing subscription quota instead of per-token
+  # billing. They require the corresponding CLI to be installed and logged
+  # in once on this host.
+  #
+  # Tool-use compatibility: the worker path drives tools through a text-based
+  # <tool_call> protocol. Compatible providers: "anthropic", "openai",
+  # "claude_cli" (we force `--tools ""` so the CLI cannot bypass it).
+  # "codex_cli" cannot be forced into pure-text mode by any current CLI flag,
+  # so it will silently bypass the ToolRegistry and lose PID tracking. Use it
+  # for the leader/think path only; keep one of the three other providers for
+  # worker dispatches.
   provider: "anthropic"
 
   # Model selection per provider:
```

**File**: `core/agents.py` (modified, +297/-42)
```diff
@@ -6,10 +6,20 @@
 - Workers: Specialized agents (idea/code/writing), spawned on demand
 
 Only ONE worker runs at a time. Others idle at zero token cost.
+
+Tool use is implemented via a provider-agnostic text protocol. The LLM
+emits <tool_call>{...}</tool_call> blocks, the dispatcher executes each
+call through the ToolRegistry, and results are fed back as
+<tool_result name="...">...</tool_result> blocks in the next user turn.
+The loop runs until the worker produces a response with no tool calls
+(the final answer) or max_turns is exceeded. This works uniformly
+across all four providers — the API SDKs don't use their native
+tool-use protocol, and the CLI providers are simply text oracles.
 """
 
 import json
 import logging
+import re
 from pathlib import Path
 from typing import Optional
 
@@ -20,6 +30,14 @@
 AGENTS_DIR = Path(__file__).parent.parent / "agents"
 
 
+# Tool-use text protocol
+_TOOL_CALL_RE = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL)
+# Triple-backtick fenced blocks are stripped before parsing so that LLMs can
+# illustrate the protocol inside code fences without triggering real tool
+# execution. Matches ``` with an optional language tag through the next ```.
+_FENCED_BLOCK_RE = re.compile(r"```[^\n]*\n.*?```", re.DOTALL)
+
+
 class AgentDispatcher:
     """Dispatches tasks to specialized agents.
 
@@ -96,55 +114,198 @@ def dispatch_leader(self, task: str, context: dict) -> dict:
             "content": self._format_leader_input(task, context),
         })
 
-        response = self._call_llm(
-            system=system_prompt,
-            messages=messages,
-            max_turns=10,
-        )
+        response = self._call_llm(system=system_prompt, messages=messages)
 
         # Persist conversation for within-cycle coherence
         self._leader_history = messages + [{"role": "assistant", "content": response}]
 
         return self._parse_leader_response(response)
 
-    def dispatch_worker(self, agent_type: str, task: str, tools: list) -> dict:
-        """Dispatch a task to a worker agent.
+    def dispatch_worker(self, agent_type: str, task: str, tool_registry) -> dict:
+        """Dispatch a task to a worker agent and run its tool-use loop.
 
-        Workers are stateless — each dispatch is independent.
-        This keeps token costs predictable.
+        Workers are stateless across dispatches — each call starts with a
+        fresh conversation. Within a single dispatch the conversation is
+        multi-turn: the worker may emit tool calls, receive results, and
+        continue reasoning until it produces a final answer (a response
+        containing no <tool_call> blocks).
 
         Args:
-            agent_type: "idea", "code", or "writing"
-            task: Task description from the Leader
-            tools: Tool definitions to provide
+            agent_type: "idea", "code", or "writing".
+            task: Task description from the Leader.
+            tool_registry: ToolRegistry that provides `get_tools_for` and
+                `execute_tool`. The registry itself is passed in so this
+                module does not have a hard import dependency on tools.py.
 
         Returns:
-            Worker's result as a dict
+            Dict with at minimum `agent` and `response`. If the worker
+            called `launch_experiment`, the PID and log_file from that
+            tool result are also surfaced at the top level so the loop's
+            EXECUTE → MONITOR handoff keeps working.
         """
         if agent_type not in self.WORKER_CONFIGS:
             raise ValueError(f"Unknown agent type: {agent_type}")
+        if tool_registry is None:
+            raise TypeError(
+                "dispatch_worker requires a tool_registry with "
+                "`get_tools_for(agent_type)` and `execute_tool(name, args)` "
+                "methods. Pass a ToolRegistry configured with an empty tool "
+                "list if you want a tool-less worker."
+            )
 
         config = self.WORKER_CONFIGS[agent_type]
-        system_prompt = self._load_prompt(config["prompt_file"])
+        base_prompt = self._load_prompt(config["prompt_file"])
+        tool_defs = tool_registry.get_tools_for(agent_type)
+        system_prompt = base_prompt + "\n\n" + self._render_tools_section(tool_defs)
+        max_turns = config["max_turns"]
+
+        # codex_cli hard-codes its own agentic tool loop; it will ignore the
+        # <tool_call> protocol and silently act on its own. That breaks the
+        # EXECUTE → MONITOR handoff (no PID, no log_file from ToolRegistry).
+        # Leader/think dispatches are fine (they do not use tools) but worker
+        # dispatches will likely return a non-authoritative summary. Warn once
+        # per dispatch so users see it in the log without it becoming noise.
+        if self.provider == "codex_cli" and tool_defs:
+            logger.warning(
+                "codex_cli is being used as a worker provi
```

**File**: `core/loop.py` (modified, +1/-1)
```diff
@@ -208,7 +208,7 @@ def _execute(self, plan: dict) -> dict:
         result = self.dispatcher.dispatch_worker(
             agent_type=agent_type,
             task=task_description,
-            tools=self.tools.get_tools_for(agent_type),
+            tool_registry=self.tools,
         )
 
         return result
```

**File**: `docs/architecture.md` (modified, +39/-1)
```diff
@@ -96,7 +96,45 @@ No LLM API calls until training completes.
 - 4 tools = 800 extra tokens per call
 - Over 100 API calls/day, that's 220K tokens saved
 
-### 6. GPU Utilities (`gpu/`)
+### 6. Tool-Use Protocol (`core/agents.py::dispatch_worker`)
+
+Workers drive tool calls through a provider-agnostic text protocol rather
+than each SDK's native tool-use API:
+
+1. The dispatcher renders the worker's tool schemas as a plain-text
+   `## Tool-Use Protocol` section and appends it to the system prompt.
+2. The worker emits zero or more `<tool_call>{"name": "...", "args": {...}}</tool_call>`
+   blocks in its response.
+3. For each block, the dispatcher calls `ToolRegistry.execute_tool` and
+   packages the JSON result into a `<tool_result name="...">...</tool_result>`
+   block appended to the next user turn.
+4. The loop iterates until the worker returns a message with no tool calls
+   (the final answer) or `max_turns` is reached.
+
+Design rationale:
+
+- **Uniform behaviour across four providers.** The same protocol works
+  whether the LLM is reached via the Anthropic SDK, the OpenAI SDK, the
+  `claude` CLI, or the `codex` CLI. The execution loop contains no
+  per-provider branching.
+- **Authoritative experiment hand-off.** `pid` and `log_file` flow from
+  the `launch_experiment` tool result (structured JSON) to
+  `_parse_worker_response`, which promotes them onto the top-level result
+  dict read by `loop._monitor_experiment`. Regex-on-prose remains as a
+  fallback only.
+- **CLI lock-down.** `claude_cli` is invoked with `--tools ""` so the
+  Claude Code CLI cannot bypass the protocol using its built-in tools.
+  `codex_cli` has no equivalent flag, so it may silently act on its own;
+  `dispatch_worker` logs a warning when `codex_cli` is used as a worker
+  provider, and the README compatibility table flags it accordingly.
+- **Fence stripping.** Tool-call blocks inside triple-backtick code fences
+  are removed before parsing so that models illustrating the protocol in
+  their prose do not trigger real side-effectful tool execution.
+- **Bounded execution.** `max_turns` is configured per-worker
+  (`idea=12`, `code=40`, `writing=30`); on overflow the loop exits cleanly
+  and the last response is returned with a warning.
+
+### 7. GPU Utilities (`gpu/`)
 
 - **detect.py**: Auto-detect GPUs, check availability, reserve last GPU
 - **keeper.py**: Keep cloud instances alive with minimal GPU activity
```

**File**: `tests/integration_cli_tool_use.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+"""Live integration check: drive a real CLI-provider worker end-to-end.
+
+Run manually:  python -m tests.integration_cli_tool_use
+
+Burns one subscription round-trip per provider. Skipped automatically
+if the CLI is not on PATH. Not wired into the normal unittest suite.
+"""
+
+import shutil
+import tempfile
+from pathlib import Path
+
+from core.agents import AgentDispatcher
+from core.tools import ToolRegistry
+
+
+TASK = (
+    "Your one job: create a file named hello.txt in the workspace "
+    "containing exactly the three-word sentence 'integration test ok', "
+    "then confirm by listing the files. Once done, reply with a short "
+    "success message and no further tool calls."
+)
+
+
+def _run(provider: str) -> dict:
+    binary = {"claude_cli": "claude", "codex_cli": "codex"}[provider]
+    if shutil.which(binary) is None:
+        return {"provider": provider, "skipped": f"{binary} not on PATH"}
+
+    dispatcher = AgentDispatcher(provider=provider)
+    with tempfile.TemporaryDirectory() as tmp:
+        workspace = Path(tmp)
+        registry = ToolRegistry(workspace)
+        try:
+            result = dispatcher.dispatch_worker("writing", TASK, registry)
+        except Exception as exc:
+            return {"provider": provider, "error": repr(exc)}
+
+        hello = workspace / "hello.txt"
+        return {
+            "provider": provider,
+            "tool_calls": result.get("tool_calls", 0),
+            "file_created": hello.exists(),
+            "file_content": hello.read_text() if hello.exists() else None,
+            "response_tail": (result.get("response", "") or "")[-200:],
+        }
+
+
+def main():
+    for provider in ("claude_cli", "codex_cli"):
+        print(f"\n=== {provider} ===")
+        outcome = _run(provider)
+        for k, v in outcome.items():
+            print(f"  {k}: {v}")
+
+
+if __name__ == "__main__":
+    main()
```

---

### Incident Patch 2: `2a29d718` (2026-04-09)
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

**File**: `config.yaml` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ agent:
   max_cycles: -1                  # -1 = run forever
   max_steps_per_cycle: 3          # Max worker dispatches per cycle
   cooldown_interval: 300          # Smart cooldown polling interval (seconds)
+  no_progress_fallback_threshold: 3  # Back off after repeated no-progress cycles on the same plan
 
 memory:
   brief_max_chars: 3000           # Tier 1: PROJECT_BRIEF cap
```

**File**: `core/__init__.py` (modified, +1/-1)
```diff
@@ -6,5 +6,5 @@
 from .agents import AgentDispatcher
 from .tools import ToolRegistry
 
-__version__ = "0.1.0"
+__version__ = "0.1.1"
 __all__ = ["ResearchLoop", "MemoryManager", "ExperimentMonitor", "AgentDispatcher", "ToolRegistry"]
```

**File**: `core/loop.py` (modified, +79/-0)
```diff
@@ -63,7 +63,10 @@ def __init__(self, config: dict, project_dir: str):
         self.cycle_count = self._load_cycle_counter()
         self.max_cycles = config.get("agent", {}).get("max_cycles", -1)
         self.cooldown = config.get("agent", {}).get("cooldown_interval", 300)
+        self.no_progress_fallback_threshold = config.get("agent", {}).get("no_progress_fallback_threshold", 3)
         self._running = True
+        self._no_progress_streak = 0
+        self._last_no_progress_signature = ""
 
         # Graceful shutdown
         signal.signal(signal.SIGTERM, self._handle_signal)
@@ -83,6 +86,9 @@ def run(self):
             logger.info(f"=== Cycle {self.cycle_count} ===")
 
             try:
+                # Keep leader context bounded to one cycle.
+                self.dispatcher.reset_leader_history()
+
                 # Check for human directive
                 directive = self._consume_directive()
                 self._update_state(
@@ -96,9 +102,18 @@ def run(self):
 
                 # THINK: Analyze and plan
                 think_result = self._think(directive)
+                think_result = self._apply_no_progress_fallback(think_result, directive)
 
                 if think_result.get("action") == "wait":
                     logger.info("THINK decided to wait. Entering cooldown.")
+                    self._update_state(
+                        {
+                            "cycle": self.cycle_count,
+                            "status": "waiting",
+                            "updated_at": time.time(),
+                            "suggested_next_step": think_result.get("reason", ""),
+                        }
+                    )
                     self._smart_cooldown()
                     continue
 
@@ -146,6 +161,7 @@ def run(self):
                         "last_error": "",
                     }
                 )
+                self._record_cycle_outcome(think_result, execute_result, reflect_result)
                 self._refresh_obsidian(reflect_result=reflect_result, directive=directive)
 
             except Exception as e:
@@ -248,6 +264,69 @@ def _refresh_obsidian(self, reflect_result: dict, directive: Optional[str]):
             directive=directive,
         )
 
+    def _plan_signature(self, plan: dict) -> str:
+        """Build a stable signature for repeated-plan detection."""
+        normalized = {
+            "action": plan.get("action", ""),
+            "agent": plan.get("agent", ""),
+            "task": " ".join(plan.get("task", "").split())[:300],
+            "hypothesis": " ".join(plan.get("hypothesis", "").split())[:200],
+        }
+        return json.dumps(normalized, sort_keys=True, ensure_ascii=True)
+
+    def _apply_no_progress_fallback(self, think_result: dict, directive: Optional[str]) -> dict:
+        """Back off if the same experiment plan keeps repeating without progress."""
+        if directive or self.no_progress_fallback_threshold <= 0:
+            return think_result
+
+        if think_result.get("action") != "experiment":
+            return think_result
+
+        signature = self._plan_signature(think_result)
+        if (
+            self._no_progress_streak >= self.no_progress_fallback_threshold
+            and signature == self._last_no_progress_signature
+        ):
+            reason = (
+                f"Fallback triggered after {self._no_progress_streak} no-progress cycles on the same plan. "
+                "Backing off to avoid empty loops until new signal arrives."
+            )
+            logger.warning(reason)
+            self.memory.log_decision(reason)
+            return {
+                "action": "wait",
+                "reason": reason,
+                "decision": reason,
+            }
+
+        return think_result
+
+    def _record_cycle_outcome(self, think_result: dict, execute_result: dict, reflect_result: dict):
+        """Track whether repeated cycles are producing real progress."""
+        if think_result.get("action") != "experiment":
+            if think_result.get("action") != "wait":
+                self._no_progress_streak = 0
+                self._last_no_progress_signature = ""
+            return
+
+        signature = self._plan_signature(think_result)
+        made_progress = bool(
+            execute_result.get("experiment_launched")
+            or execute_result.get("final_metrics")
+            or reflect_result.get("milestone")
+        )
+
+        if made_progress:
+            self._no_progress_streak = 0
+            self._last_no_progress_signature = ""
+            return
+
+        if signature == self._last_no_progress_signature:
+            self._no_progress_streak += 1
+        else:
+            self._last_no_progress_signature = signature
+            self._no_progress_streak = 1
+
     def _smart_cooldown(self):
         """Poll at short intervals instead of fixed long wait."""
         logger.info(f"Smart cooldown: polling every {self.cooldown
```

---

### Incident Patch 3: `6c6ba1a3` (2026-04-08)
**Commit Message**: docs: add human-in-the-loop README guidance

**File**: `README.md` (modified, +56/-0)
```diff
@@ -380,6 +380,62 @@ You'll see something like:
 # Experiment Status — my-first-experiment
 
 ## Goal
+
+## Human-in-the-Loop Playbook
+
+Use the agent as an operator, not a replacement researcher.
+
+```text
+Human decides:
+- goal
+- constraints
+- forbidden directions
+- when to pivot
+
+Agent executes:
+- code edits
+- runs
+- monitoring
+- summaries
+```
+
+Write stable rules in `PROJECT_BRIEF.md`, and temporary steering in `HUMAN_DIRECTIVE.md`.
+
+```md
+# HUMAN_DIRECTIVE.md
+- Do not change the dataset.
+- Try label smoothing 0.1 before changing the backbone.
+- Stop this direction if gain stays below 0.3 for 3 runs.
+- Compare against the last trusted baseline, not just the latest run.
+```
+
+Case 1: Safer ablation
+
+```md
+- Only change augmentation.
+- Keep model, optimizer, and training budget fixed.
+- Report a clean comparison table after each run.
+```
+
+Case 2: Deliberate pivot
+
+```md
+- Current ResNet line is saturated.
+- Switch to ViT-B/16 only if the last 3 runs plateau.
+- Before switching, write a short rationale.
+```
+
+Case 3: Suspicious result
+
+```md
+- Accuracy jumped unexpectedly.
+- Re-run with the same seed and one new seed.
+- Do not claim improvement until both runs reproduce.
+```
+
+Rule of thumb: let the agent handle repetition, but keep direction, interpretation, and responsibility human.
+
+---
 ResNet-50 on CIFAR-100 → 80%+ accuracy
 
 ## Progress
```

**File**: `docs/README_CN.md` (modified, +56/-0)
```diff
@@ -342,6 +342,62 @@ Agent 跑着的时候，你可以随时看：
 # 实验状态 — my-first-experiment
 
 ## 目标
+
+## Human-in-the-Loop 实操指南
+
+不要把 Agent 当成替代研究者的按钮，而要把它当成你来掌舵的实验操作员。
+
+```text
+人来决定：
+- 目标
+- 约束
+- 禁止方向
+- 什么时候转向
+
+Agent 来执行：
+- 改代码
+- 跑实验
+- 做监控
+- 写总结
+```
+
+把稳定规则写进 `PROJECT_BRIEF.md`，把临时指令写进 `HUMAN_DIRECTIVE.md`。
+
+```md
+# HUMAN_DIRECTIVE.md
+- 不要改数据集。
+- 先试 label smoothing 0.1，再考虑换 backbone。
+- 如果连续 3 次增益低于 0.3 个点，就停止这个方向。
+- 和上一个可信 baseline 对比，不要只和最近一次结果对比。
+```
+
+Case 1：做干净 ablation
+
+```md
+- 只允许改 augmentation。
+- 模型、优化器、训练预算保持不变。
+- 每轮结束后输出一张干净的对比表。
+```
+
+Case 2：有意识地转方向
+
+```md
+- 当前 ResNet 路线已经接近平台期。
+- 只有最近 3 次都没有明显提升，才切到 ViT-B/16。
+- 切换前先写一段简短理由。
+```
+
+Case 3：结果可疑时
+
+```md
+- 这次准确率提升异常大。
+- 用相同 seed 重跑一次，再换一个新 seed 再跑一次。
+- 两次都复现之前，不要宣称改进成立。
+```
+
+一句话：重复劳动交给 Agent，方向、解释和责任留给人。
+
+---
 ResNet-50 on CIFAR-100 → 80%+
 
 ## 进度
```

**File**: `docs/README_JP.md` (modified, +56/-0)
```diff
@@ -303,6 +303,62 @@ happy
 
 ## ワンクリックインストール（Claude Code Skills）
 
+## Human-in-the-Loop 実践ガイド
+
+Agent は研究者の代わりではなく、あなたが舵を取る実験オペレーターとして使ってください。
+
+```text
+人が決めること:
+- 目標
+- 制約
+- 禁止事項
+- 方向転換のタイミング
+
+Agent が実行すること:
+- コード修正
+- 実験実行
+- 監視
+- 要約
+```
+
+固定ルールは `PROJECT_BRIEF.md` に、一時的な指示は `HUMAN_DIRECTIVE.md` に書きます。
+
+```md
+# HUMAN_DIRECTIVE.md
+- データセットは変更しない。
+- backbone を変える前に label smoothing 0.1 を試す。
+- 3回連続で改善が 0.3 ポイント未満ならこの方向は止める。
+- 直近の run ではなく、最後に信頼できる baseline と比較する。
+```
+
+Case 1: きれいな ablation
+
+```md
+- augmentation だけ変更する。
+- モデル、optimizer、計算予算は固定する。
+- 各 run 後に比較表を出す。
+```
+
+Case 2: 意図的な方向転換
+
+```md
+- 現在の ResNet 系は頭打ち。
+- 直近3 run が停滞した時だけ ViT-B/16 に切り替える。
+- 切り替え前に短い根拠を書く。
+```
+
+Case 3: 怪しい結果
+
+```md
+- 精度が急に上がった。
+- 同じ seed で再実行し、さらに別 seed でも1回試す。
+- 両方再現するまで改善と見なさない。
+```
+
+要点は1つです。反復作業は Agent に任せても、方向、解釈、責任は人が持つことです。
+
+---
+
 すべての機能をClaude Codeスラッシュコマンドとして提供。**一行でインストール：**
 
 ```bash
```

**File**: `docs/README_KR.md` (modified, +56/-0)
```diff
@@ -305,6 +305,62 @@ happy
 
 ## 원클릭 설치 (Claude Code Skills)
 
+## Human-in-the-Loop 운영 가이드
+
+에이전트는 연구자를 대체하는 버튼이 아니라, 당신이 방향을 잡아 주는 실험 운영자입니다.
+
+```text
+사람이 결정:
+- 목표
+- 제약
+- 금지 방향
+- 언제 전환할지
+
+에이전트가 실행:
+- 코드 수정
+- 실험 실행
+- 모니터링
+- 요약
+```
+
+고정 규칙은 `PROJECT_BRIEF.md` 에, 임시 지시는 `HUMAN_DIRECTIVE.md` 에 적으세요.
+
+```md
+# HUMAN_DIRECTIVE.md
+- 데이터셋은 바꾸지 마라.
+- backbone 을 바꾸기 전에 label smoothing 0.1부터 시도하라.
+- 3번 연속 향상이 0.3포인트 미만이면 이 방향은 중단하라.
+- 가장 최근 결과가 아니라 마지막으로 신뢰한 baseline 과 비교하라.
+```
+
+Case 1: 깔끔한 ablation
+
+```md
+- augmentation 만 바꿔라.
+- 모델, optimizer, 계산 예산은 고정하라.
+- 매 run 뒤 비교표를 출력하라.
+```
+
+Case 2: 의도적인 방향 전환
+
+```md
+- 현재 ResNet 라인은 포화 상태다.
+- 최근 3번이 정체일 때만 ViT-B/16으로 전환하라.
+- 전환 전 짧은 근거를 먼저 써라.
+```
+
+Case 3: 수상한 결과
+
+```md
+- 정확도가 비정상적으로 많이 올랐다.
+- 같은 seed 로 한 번, 새 seed 로 한 번 더 재실행하라.
+- 둘 다 재현되기 전에는 개선으로 결론 내리지 마라.
+```
+
+핵심은 하나입니다. 반복 작업은 에이전트에게 맡겨도, 방향과 해석과 책임은 사람에게 남겨 두는 것입니다.
+
+---
+
 모든 기능을 Claude Code 슬래시 커맨드로 제공합니다. **한 줄로 설치:**
 
 ```bash
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
