# Forensic Learning Record (Deep Inspection): Human-Agent-Society/CORAL

> **Canonical Artifact**: `07_PROJECT_LEARNING/human-agent-society-coral-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Human-Agent-Society/CORAL](https://github.com/Human-Agent-Society/CORAL))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:41:32.264Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Human-Agent-Society/CORAL`
- **Description**: Open-source autoresearch powered by autonomous coding agents. Run Claude Code, OpenCode, and Codex with grading, shared knowledge, and multi-agent evolution. Accepted at COLM 2026.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1044 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `coral/agent/state.py`
```
"""Per-agent reliability state: crash history events and persisted PAUSED markers.

The manager records `RestartEvent`s in memory and persists a small JSON file at
`<coral_dir>/public/agent_state.json` whenever an agent transitions into or out
of PAUSED. The file is written atomically (tempfile + rename) so concurrent
readers (e.g. `coral status`) never see a partial document.

v1 covers the write side only; honoring persisted state across `coral resume`
is deferred to a follow-up patch.
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

# Schema version embedded in the persisted JSON so future readers can migrate.
AGENT_STATE_SCHEMA_VERSION = 1


@dataclass
class RestartEvent:
    """A single observed agent exit, used to populate the crash-burst sliding window.

    Only "no_result" / "session_error" exits should ever be appended; "clean" exits
    are excluded so legitimate `max_turns` completions do not trip the breaker.
    """

    timestamp: float  # seconds since epoch (monotonic against datetime.now().timestamp())
    exit_code: int | None
    log_path: str  # absolute path to the agent's stream-json log at the time of exit
    classification: str  # "no_result" | "session_error" (clean exits are not recorded)


@dataclass
class AgentRuntimeState:
    """Persisted reliability state for a single agent.

    `state` is one of "active", "paused".
    `paused_until` is the wall-clock epoch second the pause expires; it is None
    when the agent is not currently paused.
    `sandbox` is the sandbox provider name the agent runs under
    (`agents.sandbox.provider`, e.g. "srt"); None when unsandboxed.
    """

    state: str = "active"
    paused_until: float | None = None
    pause_count: int = 0
    last_fault_at: str | None = None  # ISO-8601 UTC timestamp of most recent fault dump
    sandbox: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentRuntimeState:
        return cls(
            state=str(data.get("state", "active")),
            paused_until=data.get("paused_until"),
            pause_count=int(data.get("pause_count", 0)),
            last_fault_at=data.get("last_fault_at"),
            sandbox=data.get("sandbox"),
        )


@dataclass
class AgentStateDocument:
    """The full document persisted at `<coral_dir>/public/agent_state.json`."""

    schema_version: int = AGENT_STATE_SCHEMA_VERSION
    updated_at: str = ""
    agents: dict[str, AgentRuntimeState] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "updated_at": self.updated_at,
            "agents": {agent_id: rs.to_dict() for agent_id, rs in self.agents.items()},
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentStateDocument:
        agents_raw = data.get("agents", {}) or {}
        return cls(
            schema_version=int(data.get("schema_version", AGENT_STATE_SCHEMA_VERSION)),
            updated_at=str(data.get("updated_at", "")),
            agents={
                agent_id: AgentRuntimeState.from_dict(payload)
                for agent_id, payload in agents_raw.items()
            },
        )


def state_file_path(coral_dir: str | Path) -> Path:
    """Return the canonical location of the per-run agent state document."""
    return Path(coral_dir) / "public" / "agent_state.json"


def write_agent_state(coral_dir: str | Path, document: AgentStateDocument) -> Path:
    """Atomically persist the agent state document.

    Uses tempfile + os.replace to ensure readers never observe a partial JSON
    document. Returns the path of the persisted file.
    """
    target = state_file_path(coral_dir)
    target.parent.mkdir(parents=True, exist_ok=True)

    document.updated_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    payload = json.dumps(document.to_dict(), indent=2, sort_keys=True)

    fd, tmp_path = tempfile.mkstemp(prefix=".agent_state.", suffix=".tmp", dir=str(target.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(payload)
        os.replace(tmp_path, target)
    except Exception:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
        raise

    return target


def read_agent_state(coral_dir: str | Path) -> AgentStateDocument:
    """Best-effort read of the persisted state.

    Missing or malformed files yield an empty document; callers fall back to
    log-inference behavior in that case (current pre-patch behavior).
    """
    target = state_file_path(coral_dir)
    if not target.exists():
        return AgentStateDocument()
    try:
        with open(target, encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError):
        return AgentStateDocument()
    if not isinstance(raw, dict):
        return AgentStateDocument()
    return AgentStateDocument.from_dict(raw)

```

### Core Architecture Module: `coral/hooks/__init__.py`
```
"""Git hooks for CORAL."""

```

### Core Architecture Module: `coral/hooks/post_commit.py`
```
"""Eval submission: git-add, git-commit, write pending attempt, optionally wait.

The grading itself happens asynchronously in the grader daemon
(coral/grader/daemon.py). `submit_eval` only stages+commits, writes a
pending attempt record, and optionally polls for the final score.
"""

from __future__ import annotations

import json
import logging
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

from coral.config import CoralConfig
from coral.hub.attempts import (
    agent_in_grader_queue,
    count_agent_pending,
    increment_eval_count,
    read_attempt,
    read_eval_count,
    write_attempt,
)
from coral.hub.checkpoint import checkpoint
from coral.types import BUDGET_CLASS_TUNE, Attempt
from coral.workspace.breadcrumbs import find_coral_breadcrumb, read_island_breadcrumb

# Legacy alias — external tests/hooks may still import the underscore-prefixed
# name. Prefer `coral.hub.attempts.increment_eval_count` directly.
_increment_eval_count = increment_eval_count

logger = logging.getLogger(__name__)

# How often submit_eval(wait=True) polls the attempt file for score updates.
_POLL_INTERVAL_SEC = 0.2


def _git_add_and_commit(message: str, workdir: str) -> str:
    """Stage all changes and commit. Returns the new commit hash."""
    # Stage all changes
    result = subprocess.run(
        ["git", "add", "-A"],
        capture_output=True,
        text=True,
        cwd=workdir,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git add failed: {result.stderr}")

    # Check if there's anything to commit
    status = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        capture_output=True,
        cwd=workdir,
    )
    if status.returncode == 0:
        raise RuntimeError("Nothing to commit — no changes detected.")

    # Commit
    result = subprocess.run(
        ["git", "commit", "-m", message],
        capture_output=True,
        text=True,
        cwd=workdir,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git commit failed: {result.stderr}")

    # Get the commit hash
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        cwd=workdir,
    )
    return result.stdout.strip()


def _get_parent_hash(commit_hash: str, cwd: str) -> str | None:
    """Get the parent commit hash."""
    result = subprocess.run(
        ["git", "log", "--format=%P", "-n", "1", commit_hash],
        capture_output=True,
        text=True,
        cwd=cwd,
    )
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip().split()[0]
    return None


def _find_coral_dir(workdir: Path) -> Path | None:
    """Find the shared .coral directory from the .coral_dir breadcrumb file."""
    found = find_coral_breadcrumb(workdir)
    if found is None:
        return None
    coral_dir, _breadcrumb_dir = found
    return coral_dir


def _poll_until_graded(
    coral_dir: Path,
    commit_hash: str,
    timeout: float,
    island_id: str | None = None,
) -> Attempt:
    """Poll the attempt file until status != 'pending' or timeout elapses.

    Raises TimeoutError if no grader finalizes the attempt within `timeout` seconds.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        attempt = read_attempt(coral_dir, commit_hash, island_id=island_id)
        if attempt is not None and attempt.status != "pending":
            return attempt
        time.sleep(_POLL_INTERVAL_SEC)
    raise TimeoutError(
        f"Grader did not finalize attempt {commit_hash[:12]} within {timeout:.0f}s "
        f"(is the grader daemon running?)"
    )


def submit_eval(
    message: str,
    agent_id: str,
    workdir: str = ".",
    wait: bool = True,
    poll_timeout: float | None = None,
    tune: bool = False,
) -> Attempt:
    """Stage changes, commit with message, write a pending attempt record.

    If ``wait`` is True (default), also polls the attempt file until the
    grader daemon finalizes it (score populated, status != "pending") and
    returns the final Attempt. If False, returns immediately with a pending
    Attempt — the caller (or a future `coral wait` invocation) is responsible
    for observing the final result.

    If ``tune`` is True, the attempt is marked as a tune-mode submission
    (``budget_class="tune"`` on its metadata). The grader still runs and the
    score is recorded, but the manager will not count it toward the agent's
    plateau / heartbeat budget — see issue #73.

    This is the core of `coral eval -m "description"` on the agent side.
    The grader itself runs asynchronously in `coral.grader.daemon`.
    """
    workdir_path = Path(workdir).resolve()

    breadcrumb = find_coral_breadcrumb(workdir_path)
    if breadcrumb is None:
        raise FileNotFoundError(f"No .coral directory found from {workdir_path}")
    coral_dir, breadcrumb_dir = breadcrumb

    config_path = coral_dir / "config.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"No config.yaml found at {config_path}")
    config = CoralConfig.from_yaml(config_path)

    # Determine the agent's island (if any) from the .coral_island breadcrumb
    # adjacent to the .coral_dir breadcrumb we discovered above.
    island_id = read_island_breadcrumb(coral_dir, breadcrumb_dir)

    # Producer-side queue cap: refuse to commit when this agent already has
    # `max_pending_per_agent` ungraded submissions in flight. The grader is
    # serial; without this cap, a slow grader plus a fast agent piles up
    # arbitrarily many pending JSONs (issue #80). 0 = unlimited (legacy).
    pending_limit = config.grader.max_pending_per_agent
    if pending_limit > 0:
        pending_count = count_agent_pending(coral_dir, agent_id, island_id=island_id)
        if pending_count >= pending_limit:
            oldest = agent_in_grader_queue(coral_dir, agent_id, island_id=island_id)
            wait_hint = (
                f"Run `coral wait {oldest.commit_hash[:12]}` to block on it "
                f"before submitting again."
                if oldest is not None
                else "Wait for the prior eval to finish before submitting again."
            )
            raise RuntimeError(
                f"You already have {pending_count} pending attempt(s) "
                f"(limit: {pending_limit}). {wait_hint}"
            )

    # Git add + commit
    commit_hash = _git_add_and_commit(message, str(workdir_path))
    parent_hash = _get_parent_hash(commit_hash, str(workdir_path))

    # Checkpoint shared state at submission time (captures agent's current notes/skills).
    shared_state_hash = checkpoint(str(coral_dir), agent_id, message, island_id=island_id)

    # Look up parent attempt's shared state hash for provenance chain.
    parent_shared_state_hash = None
    if parent_hash:
        from coral.hub._island import island_root

        parent_attempt_file = island_root(coral_dir, island_id) / "attempts" / f"{parent_hash}.json"
        if parent_attempt_file.exists():
            try:
                parent_data = json.loads(parent_attempt_file.read_text(encoding="utf-8"))
                parent_shared_state_hash = parent_data.get("shared_state_hash")
            except (json.JSONDecodeError, OSError):
                pass

    # Write pending record. The grader daemon will observe this and fill in
    # score/status/feedback asynchronously.
    metadata: dict = {}
    if tune:
        metadata["budget_class"] = BUDGET_CLASS_TUNE
    if island_id is not None:
        metadata["island_id"] = island_id
    attempt = Attempt(
        commit_hash=commit_hash,
        agent_id=agent_id,
        title=message,
        score=None,
        status="pending",
        parent_hash=parent_hash,
        timestamp=datetime.now(UTC).isoformat(),
        feedback="",
        shared_state_hash=shared_state_hash,
        parent_shared_state_hash=parent_shared_state_hash,
        metadata=metadata,
    )
    write_attempt(str(coral_dir), attempt, island_id=island_id)

    if not wait:
        return attempt

    # Block until grader daemon finalizes. We give it plenty of slack above the
    # grader's own per-eval timeout so the daemon has room to finish + write back.
    if poll_timeout is None:
        grader_timeout = config.grader.timeout if config.grader.timeout > 0 else 0
        # 2x the grader budget + 60s slack, with a floor of 300s for fast graders.
        poll_timeout = max(grader_timeout * 2 + 60, 300) if grader_timeout else 3600

    final = _poll_until_graded(coral_dir, commit_hash, poll_timeout, island_id=island_id)

    # Attach eval_count for display by cmd_eval (best-effort; daemon bumps this).
    try:
        final._eval_count = read_eval_count(coral_dir, island_id=island_id)  # type: ignore[attr-defined]
    except Exception:
        pass

    return final


# Backward-compat alias: older callers / hooks may still import `run_eval`.
# Same semantics as submit_eval(wait=True).
def run_eval(message: str, agent_id: str, workdir: str = ".") -> Attempt:
    """Deprecated. Prefer `submit_eval`. Synchronous (waits for grader)."""
    return submit_eval(message=message, agent_id=agent_id, workdir=workdir, wait=True)

```

### Core Architecture Module: `examples/ADRS/cloudcast/taskdata/utils.py`
```
import networkx as nx
from broadcast import *
import pandas as pd
import time
import functools
import os


GBIT_PER_GBYTE = 8


class Timer:
    def __init__(self, print_desc=None):
        self.print_desc = print_desc
        self.start = time.time()
        self.end = None

    def __enter__(self):
        return self

    def __exit__(self, exc_typ, exc_val, exc_tb):
        self.end = time.time()

    @property
    def elapsed(self):
        if self.end is None:
            end = time.time()
            return end - self.start
        else:
            return self.end - self.start


@functools.lru_cache(maxsize=None)
def get_path_cost(src, dst, src_tier="PREMIUM", dst_tier="PREMIUM"):
    from skyplane import compute

    assert src_tier == "PREMIUM" and dst_tier == "PREMIUM"
    return compute.CloudProvider.get_transfer_cost(src, dst)


def make_nx_graph(cost_path=None, throughput_path=None, num_vms=1):
    """
    Default graph with capacity constraints and cost info
    nodes: regions, edges: links
    per edge:
        throughput: max tput achievable (gbps)
        cost: $/GB
        flow: actual flow (gbps), must be < throughput, default = 0
    """
    if cost_path is None:
        # Use relative path from utils.py location
        utils_dir = os.path.dirname(os.path.abspath(__file__))
        cost = pd.read_csv(os.path.join(utils_dir, "profiles/cost.csv"))
    else:
        cost = pd.read_csv(cost_path)

    if throughput_path is None:
        # Use relative path from utils.py location
        utils_dir = os.path.dirname(os.path.abspath(__file__))
        throughput = pd.read_csv(os.path.join(utils_dir, "profiles/throughput.csv"))
    else:
        throughput = pd.read_csv(throughput_path)

    G = nx.DiGraph()
    for _, row in throughput.iterrows():
        if row["src_region"] == row["dst_region"]:
            continue
        G.add_edge(row["src_region"], row["dst_region"], cost=None, throughput=num_vms * row["throughput_sent"] / 1e9)

    for _, row in cost.iterrows():
        if row["src"] in G and row["dest"] in G[row["src"]]:
            G[row["src"]][row["dest"]]["cost"] = row["cost"]

    # some pairs not in the cost grid
    no_cost_pairs = []
    for edge in G.edges.data():
        src, dst = edge[0], edge[1]
        if edge[-1]["cost"] is None:
            no_cost_pairs.append((src, dst))
    print("Unable to get costs for: ", no_cost_pairs)

    return G


def push_flow_helper(src, g, ingress_limit=10 * 5, egress_limit=10 * 5):
    """
    Push positive flows in the constructed paths (g) under constraints
    """
    for child in list(g.successors(src)):
        dfs_edges = [edge for edge in nx.dfs_edges(g, source=child)]
        dfs_min = float("inf") if not dfs_edges else min([g[t[0]][t[1]]["throughput"] for t in dfs_edges])
        min_flow = min([dfs_min, g[src][child]["throughput"], ingress_limit, egress_limit])

        # assign flows
        g[src][child]["flow"] = min_flow
        for t in dfs_edges:
            g[t[0]][t[1]]["flow"] = min_flow
    return g


def append_src_dst_paths(src, dsts, G, bc_topology):
    # Append src dst paths for partitions (all partitions follow the same path)
    for dst in dsts:
        for path in list(nx.all_simple_paths(G, src, dst)):
            for i in range(0, len(path) - 1):
                s, t = path[i], path[i + 1]
                for j in range(bc_topology.num_partitions):
                    bc_topology.append_dst_partition_path(dst, j, [s, t, G[s][t]])
    return bc_topology
```

### Core Architecture Module: `examples/ADRS/llm_sql/taskdata/utils.py`
```
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
from typing import List, Tuple

class TrieNode:
    def __init__(self):
        self.children = {}
        self.end_of_word = False


class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word):
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        node.end_of_word = True

    def longest_common_prefix(self, word):
        node = self.root
        common_prefix_length = 0
        for char in word:
            if char in node.children:
                common_prefix_length += len(char)
                node = node.children[char]
            else:
                break
        return common_prefix_length

def calculate_length(value):
    val = 0
    if isinstance(value, bool):
        val = 4  # length of 'True' or 'False'
    elif isinstance(value, (int, float)):
        val = len(str(value))
    elif isinstance(value, str):
        val = len(value)
    else:
        val = 0
    return val**2

def evaluate_df_prefix_hit_cnt(df: pd.DataFrame) -> Tuple[int, int]:
    """
    Function to evaluate the prefix hit count of a DataFrame
    """

    def max_overlap(trie, row_string):
        return min(len(row_string), trie.longest_common_prefix(row_string))


    trie = Trie()
    total_prefix_hit_count = 0
    total_string_length = 0

    def process_row(index, row):
        nonlocal total_string_length
        row_string = "".join(row.fillna("").astype(str).values)  # No spaces between columns
        total_string_length += len(row_string)
        row_prefix_hit_count = max_overlap(trie, row_string)
        trie.insert(row_string)
        return row_prefix_hit_count

    with ThreadPoolExecutor() as executor:
        results = executor.map(process_row, df.index, [row for _, row in df.iterrows()])

    total_prefix_hit_count = sum(results)
    total_prefix_hit_rate = total_prefix_hit_count / total_string_length
    assert total_prefix_hit_count <= total_string_length
    print(f"Total string length: {total_string_length}")
    no_cache_pricing = 2.5 / 5  # per 1M if not cached
    cache_pricing = 1.25 / 5  # per 1M if cached
    cached_tokens_pricing = total_prefix_hit_count * cache_pricing / 1e6
    non_cached_tokens_pricing = (total_string_length - total_prefix_hit_count) * no_cache_pricing / 1e6
    print(
        f"Cached tokens pricing = {round(cached_tokens_pricing,2)}, Non-cached tokens pricing = {round(non_cached_tokens_pricing,2)}, total pricing = {round(cached_tokens_pricing + non_cached_tokens_pricing,2)}"
    )
    return total_prefix_hit_count, total_prefix_hit_rate * 100
```

### Core Architecture Module: `examples/apex-eggshell-skull/grader/src/apex_judge/dynamic_rubric_state.py`
```
"""Rubric versioning and persistence for the agent-judge grader.

Stores versioned rubric snapshots in .coral/private/rubrics/ and tracks
which rubric version was used for each attempt.
"""

from __future__ import annotations

import json
import tempfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from apex_judge.rubric_item import RubricItem

_TEMPLATES_DIR = Path(__file__).parent / "templates"


@dataclass
class RubricVersion:
    """A versioned snapshot of the rubric criteria."""

    version: int
    rubrics: list[RubricItem]
    retired: list[RubricItem] = field(default_factory=list)
    created_at: str = ""
    trigger: str = "initial"  # "initial" | "periodic" | "plateau" | "judge"
    evolution_notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "rubrics": [
                {"name": r.name, "description": r.description, "weight": r.weight}
                for r in self.rubrics
            ],
            "retired": [
                {"name": r.name, "description": r.description, "weight": r.weight}
                for r in self.retired
            ],
            "created_at": self.created_at,
            "trigger": self.trigger,
            "evolution_notes": self.evolution_notes,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RubricVersion:
        return cls(
            version=data["version"],
            rubrics=[
                RubricItem(name=r["name"], description=r["description"], weight=r.get("weight", 1.0))
                for r in data.get("rubrics", [])
            ],
            retired=[
                RubricItem(name=r["name"], description=r["description"], weight=r.get("weight", 1.0))
                for r in data.get("retired", [])
            ],
            created_at=data.get("created_at", ""),
            trigger=data.get("trigger", "initial"),
            evolution_notes=data.get("evolution_notes", ""),
        )


class RubricStateManager:
    """Manages versioned rubric state in .coral/private/rubrics/."""

    def __init__(self, private_dir: str | Path) -> None:
        self._rubrics_dir = Path(private_dir) / "rubrics"
        self._rubrics_dir.mkdir(parents=True, exist_ok=True)

    def get_current_version(self) -> RubricVersion | None:
        """Load the current rubric version, or None if no rubrics exist yet."""
        current = self._rubrics_dir / "current.json"
        if not current.exists():
            return None
        try:
            data = json.loads(current.read_text())
            return RubricVersion.from_dict(data)
        except (json.JSONDecodeError, KeyError):
            return None

    def save_version(self, version: RubricVersion, task_name: str = "") -> Path:
        """Save a rubric version atomically. Writes v{N}.json and updates current.json."""
        if not version.created_at:
            version.created_at = datetime.now(UTC).isoformat()

        data = json.dumps(version.to_dict(), indent=2)

        versioned = self._rubrics_dir / f"v{version.version}.json"
        self._atomic_write(versioned, data)

        self._atomic_write(self._rubrics_dir / "current.json", data)

        self._append_changelog(version, task_name=task_name)

        return versioned

    def get_version(self, n: int) -> RubricVersion | None:
        """Load a specific rubric version by number."""
        path = self._rubrics_dir / f"v{n}.json"
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            return RubricVersion.from_dict(data)
        except (json.JSONDecodeError, KeyError):
            return None

    def list_versions(self) -> list[int]:
        """List all saved version numbers, sorted ascending."""
        versions = []
        for f in self._rubrics_dir.glob("v*.json"):
            try:
                versions.append(int(f.stem[1:]))
            except ValueError:
                continue
        return sorted(versions)

    def should_evolve(
        self,
        eval_count: int,
        recent_scores: list[float],
        evolve_every: int = 5,
        plateau_threshold: int = 3,
    ) -> tuple[bool, str]:
        """Check whether rubrics should evolve. Returns (should_evolve, trigger_reason)."""
        if evolve_every > 0 and eval_count > 0 and eval_count % evolve_every == 0:
            return True, "periodic"

        if plateau_threshold > 0 and len(recent_scores) >= plateau_threshold:
            last_n = recent_scores[-plateau_threshold:]
            if len(set(round(s, 6) for s in last_n)) == 1:
                return True, "plateau"
            if all(last_n[i] >= last_n[i + 1] for i in range(len(last_n) - 1)):
                best_before = (
                    max(recent_scores[:-plateau_threshold])
                    if len(recent_scores) > plateau_threshold
                    else 0.0
                )
                if last_n[-1] <= best_before:
                    return True, "plateau"

        return False, ""

    def was_last_eval_perfect(self) -> bool:
        """Check whether the most recent evaluation had all criteria PASS."""
        history_path = self._rubrics_dir / "criterion_history.jsonl"
        if not history_path.exists():
            return False

        last_line = ""
        for line in history_path.read_text().splitlines():
            line = line.strip()
            if line:
                last_line = line

        if not last_line:
            return False

        try:
            entry = json.loads(last_line)
        except json.JSONDecodeError:
            return False

        criteria = entry.get("criteria", {})
        if not criteria:
            return False

        return all(c.get("verdict") == "PASS" for c in criteria.values())

    def record_criterion_scores(
        self,
        attempt_hash: str,
        rubric_version: int,
        criteria_scores: dict[str, dict[str, Any]],
    ) -> None:
        """Append per-criterion results to criterion_history.jsonl."""
        history_path = self._rubrics_dir / "criterion_history.jsonl"
        entry = {
            "attempt": attempt_hash,
            "rubric_version": rubric_version,
            "timestamp": datetime.now(UTC).isoformat(),
            "criteria": criteria_scores,
        }
        with open(history_path, "a") as f:
            f.write(json.dumps(entry) + "\n")

    def get_criterion_summary(self, last_n: int = 10) -> str:
        """Compute per-criterion stats from recent evaluations."""
        history_path = self._rubrics_dir / "criterion_history.jsonl"
        if not history_path.exists():
            return "No evaluation history available yet."

        entries: list[dict[str, Any]] = []
        for line in history_path.read_text().splitlines():
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

        if not entries:
            return "No evaluation history available yet."

        entries = entries[-last_n:]

        criterion_data: dict[str, list[dict[str, Any]]] = {}
        for entry in entries:
            for name, data in entry.get("criteria", {}).items():
                criterion_data.setdefault(name, []).append(data)

        lines = []
        for name, records in sorted(criterion_data.items()):
            passes = sum(1 for r in records if r.get("verdict") == "PASS")
            total = len(records)
            pass_rate = passes / total if total > 0 else 0.0

            if total >= 4:
                mid = total // 2
                first_half = sum(1 for r in records[:mid] if r.get("verdict") == "PASS") / mid
                second_half = sum(
                    1 for r in records[mid:] if r.get("verdict") == "PASS"
                ) / (total - mid)
                if second_half > first_half + 0.15:
                    trend = "improving"
                elif second_half < first_half - 0.15:
                    trend = "declining"
                else:
                    trend = "stable"
            else:
                trend = "insufficient data"

            fail_rationale = ""
            for r in reversed(records):
                if r.get("verdict") == "FAIL" and r.get("rationale"):
                    fail_rationale = r["rationale"][:200]
                    break

            line = f'- "{name}": {passes}/{total} passed ({pass_rate:.0%}, {trend})'
            if fail_rationale:
                line += f' — last failure: "{fail_rationale}"'
            lines.append(line)

        return "\n".join(lines)

    def publish_rubric(self, public_dir: str | Path) -> Path:
        """Write a human-readable current.md to the public rubrics directory."""
        current = self.get_current_version()
        if current is None:
            raise RuntimeError("No rubric version to publish")

        rubrics_public = Path(public_dir) / "rubrics"
        rubrics_public.mkdir(parents=True, exist_ok=True)

        lines = [
            f"# Evaluation Rubric (v{current.version})",
            "",
            f"Last updated: {current.created_at}",
            "",
            "## Active Criteria",
            "",
        ]
        for i, r in enumerate(current.rubrics, 1):
            lines.append(f"{i}. **{r.name}** (weight: {r.weight})")
            lines.append(f"   {r.description}")
            lines.append("")

        if current.retired:
            lines.append("## Recently Retired")
            lines.append("")
            for r in current.retired:
                lines.append(f"- ~~{r.name}~~ (weight: {r.weight})")
            lines.append("")

        if current.evolution_notes:
            lines.append("## Evolution Notes")
            lines.append("")
            lines.append(current.evolution_notes)
          
```

### Core Architecture Module: `examples/dna_design/grader/src/dna_design_grader/scorers/enhancer.py`
```
"""Enformer-based DNA enhancer expression scorer (optional).

Predicts MPRA expression levels across cell types (HepG2, K562, SKNSH)
using a gReLU Enformer model. Extracted from the SAGA framework.

This scorer is optional. The grader falls back to GC content + diversity
scoring when Enformer is not available. To enable it:

    1. Install dependencies:
       pip install grelu torch pandas

    2. Place the Enformer checkpoint at:
       <this_dir>/model_data/epoch=13-step=34748.ckpt

       The checkpoint can be obtained from the SAGA project's DNA design
       scorer data.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import List, Optional, Tuple

CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CHECKPOINT = os.path.join(
    CURRENT_FILE_DIR, "model_data", "epoch=13-step=34748.ckpt"
)


def is_available() -> bool:
    """Check if the enhancer scorer is available (dependencies + model)."""
    try:
        import grelu  # noqa: F401
        import torch  # noqa: F401
    except ImportError:
        return False
    return os.path.isfile(DEFAULT_CHECKPOINT)


class EnhancerScorer:
    """Enformer-based scorer for DNA enhancer MPRA expression."""

    CELL_TYPES = ["hepg2", "k562", "sknsh"]

    def __init__(self, checkpoint_path: str | None = None):
        os.environ.setdefault("WANDB_DISABLED", "true")
        os.environ.setdefault("WANDB_MODE", "disabled")

        import grelu.lightning
        import torch  # noqa: F401

        path = checkpoint_path or DEFAULT_CHECKPOINT
        if not os.path.isfile(path):
            raise FileNotFoundError(
                f"Enformer checkpoint not found at {path}. "
                "See this module's docstring for setup instructions."
            )

        model_params = {
            "model_type": "EnformerModel",
            "n_tasks": 3,
            "crop_len": 0,
            "n_transformers": 1,
        }
        self.model = grelu.lightning.LightningModel.load_from_checkpoint(
            path, model_params=model_params
        )
        self.model.eval()

    @lru_cache(maxsize=1000)
    def _predict_expression(
        self, sequences: Tuple[str, ...]
    ) -> list[list[Optional[float]]]:
        import grelu.data.dataset
        import pandas as pd
        import torch

        valid_seqs = []
        result: list = []
        for seq in sequences:
            if self._is_valid(seq):
                result.append(0)  # placeholder
                valid_seqs.append(seq)
            else:
                result.append([None, None, None])

        if not valid_seqs:
            return result

        df = pd.DataFrame({"seq": valid_seqs})
        dataset = grelu.data.dataset.DFSeqDataset(df)

        if torch.cuda.is_available():
            pred = self.model.predict_on_dataset(dataset, devices=0)
        else:
            pred = self.model.predict_on_dataset(dataset, devices="cpu")

        pred = pred[:, :, 0]  # [n_sequences, n_cell_types]

        k = 0
        for i, val in enumerate(result):
            if val == 0:
                result[i] = list(pred[k, :])
                k += 1

        return result

    def score_expression(
        self, sequences: list[str], cell_index: int
    ) -> list[Optional[float]]:
        """Predict MPRA expression for a cell type (0=HepG2, 1=K562, 2=SKNSH)."""
        preds = self._predict_expression(tuple(sequences))
        return [p[cell_index] if isinstance(p, list) else None for p in preds]

    def score_hepg2(self, sequences: list[str]) -> list[Optional[float]]:
        return self.score_expression(sequences, 0)

    def score_k562(self, sequences: list[str]) -> list[Optional[float]]:
        return self.score_expression(sequences, 1)

    def score_sknsh(self, sequences: list[str]) -> list[Optional[float]]:
        return self.score_expression(sequences, 2)

    @staticmethod
    def _is_valid(sequence: str) -> bool:
        if not sequence or not isinstance(sequence, str):
            return False
        return all(b in "ATGCatgc" for b in sequence)

```

### Core Architecture Module: `examples/drug_design/grader/src/drug_design_grader/scorers/chemprop_scorer.py`
```
"""ChemProp-based toxicity safety scorer (optional).

Predicts primary cell toxicity using a ChemProp ensemble model.
Returns safety score = 1 - toxicity_probability. Extracted from SAGA.

This scorer is optional. The grader falls back to novelty+QED scoring
when ChemProp is not available. To enable it:

    1. Install dependencies:
       pip install chemprop==1.6.1 torch rdkit-pypi packaging

    2. Place model checkpoints at:
       <this_dir>/model_data/antibiotics/models/primary_cell_toxicity_model/train/
           checkpoints{1..20}/fold_0/model_0/model.pt

       These checkpoints can be obtained from the SAGA project's drug design
       scorer data.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, Tuple

CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODELS_DIR = os.path.join(
    CURRENT_FILE_DIR, "model_data", "antibiotics", "models"
)


def is_available() -> bool:
    """Check if the ChemProp scorer is available (dependencies + models)."""
    try:
        import chemprop  # noqa: F401
        import torch  # noqa: F401
    except ImportError:
        return False
    tox_root = Path(DEFAULT_MODELS_DIR) / "primary_cell_toxicity_model" / "train"
    return any(tox_root.glob("checkpoints*/fold_0/model_0/model.pt"))


class ChempropScorer:
    """ChemProp-based primary cell toxicity safety scorer."""

    def __init__(self, models_dir: str | None = None):
        import argparse
        import torch
        import chemprop
        from packaging import version

        try:
            from chemprop.data.scaler import StandardScaler, AtomBondScaler
        except (ImportError, ModuleNotFoundError):
            from chemprop.data import StandardScaler, AtomBondScaler

        self._safe_globals = [argparse.Namespace, StandardScaler, AtomBondScaler]
        if version.parse(torch.__version__) >= version.parse("2.6.0"):
            if hasattr(torch.serialization, "add_safe_globals"):
                torch.serialization.add_safe_globals(self._safe_globals)

        mdir = Path(models_dir or DEFAULT_MODELS_DIR)
        tox_root = mdir / "primary_cell_toxicity_model" / "train"

        paths = []
        for i in range(1, 21):
            ckpt = tox_root / f"checkpoints{i}" / "fold_0" / "model_0" / "model.pt"
            if ckpt.exists():
                paths.append(str(ckpt))
        if not paths:
            raise FileNotFoundError(
                f"No toxicity model checkpoints found under {tox_root}"
            )

        # Build ensemble predict args
        args_list = [
            "--test_path", "/dev/null",
            "--preds_path", "/dev/null",
            "--checkpoint_path", paths[0],
        ]
        predict_args = chemprop.args.PredictArgs().parse_args(args_list)

        if version.parse(torch.__version__) >= version.parse("2.6.0"):
            with torch.serialization.safe_globals(self._safe_globals):
                train_args = chemprop.utils.load_args(paths[0])
        else:
            train_args = chemprop.utils.load_args(paths[0])

        for attr in [
            "features_scaling", "atom_descriptors", "bond_descriptors",
            "features_generator", "features_path",
            "atom_features_path", "bond_features_path",
        ]:
            if hasattr(train_args, attr):
                setattr(predict_args, attr, getattr(train_args, attr))

        predict_args.checkpoint_paths = paths
        predict_args.checkpoint_path = None
        predict_args.use_gpu = torch.cuda.is_available()
        predict_args.batch_size = 1024 if torch.cuda.is_available() else 256

        if version.parse(torch.__version__) >= version.parse("2.6.0"):
            with torch.serialization.safe_globals(self._safe_globals):
                model_objects = chemprop.train.load_model(args=predict_args)
        else:
            model_objects = chemprop.train.load_model(args=predict_args)

        self._model_set = (predict_args, model_objects)

    def score_toxicity_safety(
        self, smiles_list: list[str]
    ) -> list[Optional[float]]:
        """Return safety score = 1 - toxicity_probability for each molecule."""
        import torch
        import chemprop
        from rdkit import Chem

        valid_smiles, valid_idx = [], []
        for i, s in enumerate(smiles_list):
            if Chem.MolFromSmiles(s) is not None:
                valid_smiles.append(s)
                valid_idx.append(i)

        results: list[Optional[float]] = [None] * len(smiles_list)
        if not valid_smiles:
            return results

        predict_args, model_objects = self._model_set
        rows = [[s] for s in valid_smiles]
        with torch.inference_mode():
            preds = chemprop.train.make_predictions(
                args=predict_args, smiles=rows, model_objects=model_objects
            )

        for idx, pred in zip(valid_idx, preds):
            results[idx] = 1.0 - float(pred[0])

        return results

```

### Core Architecture Module: `examples/drug_design/grader/src/drug_design_grader/scorers/minimol.py`
```
"""MiniMol-based antibacterial activity scorer (optional).

Predicts antibacterial activity against gram-negative bacteria using
a 9-fold ensemble of MLP classifiers on Minimol molecular features.
Extracted from the SAGA framework.

This scorer is optional. The grader falls back to novelty+QED scoring
when MiniMol is not available. To enable it:

    1. Install dependencies:
       pip install torch pytorch_lightning minimol rdkit-pypi

    2. Place model checkpoints at:
       <this_dir>/model_data/minimol_antibiotics/gram_negative_model_fold_{0..8}.pt
       <this_dir>/model_data/minimol_antibiotics/gonorrhea_model_fold_{0..8}.pt

       These checkpoints can be obtained from the SAGA project's drug design
       scorer data.
"""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import List, Optional, Tuple

CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODELS_DIR = os.path.join(
    CURRENT_FILE_DIR, "model_data", "minimol_antibiotics"
)


def is_available() -> bool:
    """Check if the MiniMol scorer is available (dependencies + models)."""
    try:
        import torch  # noqa: F401
        import pytorch_lightning  # noqa: F401
        from minimol import Minimol  # noqa: F401
    except ImportError:
        return False
    models_dir = Path(DEFAULT_MODELS_DIR)
    return (models_dir / "gram_negative_model_fold_0.pt").exists()


# ---------------------------------------------------------------------------
# MLP architecture (needed for checkpoint loading)
# ---------------------------------------------------------------------------

import torch
import torch.nn as nn
import torch.nn.functional as F
import pytorch_lightning as pl


def _make_activation(name: str) -> nn.Module:
    name = name.lower()
    if name == "relu":
        return nn.ReLU()
    if name == "tanh":
        return nn.Tanh()
    if name == "leaky_relu":
        return nn.LeakyReLU(0.01)
    if name == "gelu":
        return nn.GELU()
    raise ValueError(f"Unknown activation: {name}")


class MLPClassifier(pl.LightningModule):
    """MLP classifier for antibacterial activity prediction."""

    def __init__(
        self,
        input_dim: int = 512,
        num_tasks: int = 1,
        dim_size: int = 512,
        shrinking_scale: float = 1.0,
        num_layers: int = 2,
        dropout_rate: float = 0.2,
        activation_function: str = "relu",
        use_batch_norm: bool = False,
        learning_rate: float = 1e-3,
        L1_weight_norm: float = 0.0,
        L2_weight_norm: float = 0.0,
        scheduler_step_size: int = 10,
        scheduler_gamma: float = 0.5,
        threshold: float = 0.5,
        fold_index: int = 0,
        optimized_thresholds: Optional[List[float]] = None,
        task_indices: Optional[List[int]] = None,
    ) -> None:
        super().__init__()
        self.save_hyperparameters()
        self.input_dim = input_dim
        self.num_tasks = num_tasks
        self.fold_index = fold_index
        self.task_indices = task_indices or list(range(num_tasks))
        self.task_thresholds = optimized_thresholds or [threshold] * num_tasks

        layers: list[nn.Module] = []
        in_dim = input_dim
        hidden_dim = dim_size
        act = _make_activation(activation_function)
        for _ in range(num_layers):
            layers.append(nn.Linear(in_dim, hidden_dim))
            if use_batch_norm:
                layers.append(nn.BatchNorm1d(hidden_dim))
            layers.append(act)
            if dropout_rate > 0:
                layers.append(nn.Dropout(dropout_rate))
            in_dim = hidden_dim
            hidden_dim = max(1, int(hidden_dim * shrinking_scale))

        self.backbone = nn.Sequential(*layers) if layers else nn.Identity()
        self.head = nn.Linear(in_dim, num_tasks)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.backbone is not None:
            x = self.backbone(x)
        return self.head(x)

    def configure_optimizers(self):
        return torch.optim.AdamW(
            self.parameters(), lr=self.hparams.learning_rate
        )


# ---------------------------------------------------------------------------
# Scorer
# ---------------------------------------------------------------------------


class MinimolScorer:
    """MiniMol-based antibacterial activity scorer with 9-fold ensemble."""

    _lock = threading.Lock()
    _gram_neg_models: Optional[list] = None
    _gonorrhea_models: Optional[list] = None
    _featurizer = None

    def __init__(self, models_dir: str | None = None):
        from minimol import Minimol
        from rdkit import Chem  # noqa: F401

        mdir = Path(models_dir or DEFAULT_MODELS_DIR)
        self._ensure_loaded(mdir)
        self._gram = self.__class__._gram_neg_models
        self._gono = self.__class__._gonorrhea_models

    @classmethod
    def _ensure_loaded(cls, models_dir: Path) -> None:
        if cls._gram_neg_models is not None:
            return
        with cls._lock:
            if cls._gram_neg_models is not None:
                return
            gram_paths = [
                str(models_dir / f"gram_negative_model_fold_{i}.pt")
                for i in range(9)
                if (models_dir / f"gram_negative_model_fold_{i}.pt").exists()
            ]
            gono_paths = [
                str(models_dir / f"gonorrhea_model_fold_{i}.pt")
                for i in range(9)
                if (models_dir / f"gonorrhea_model_fold_{i}.pt").exists()
            ]
            if not gram_paths:
                raise FileNotFoundError("No gram_negative model checkpoints found.")
            if not gono_paths:
                raise FileNotFoundError("No gonorrhea model checkpoints found.")
            cls._gram_neg_models = [
                MLPClassifier.load_from_checkpoint(p, map_location="cpu").eval()
                for p in gram_paths
            ]
            cls._gonorrhea_models = [
                MLPClassifier.load_from_checkpoint(p, map_location="cpu").eval()
                for p in gono_paths
            ]
            from minimol import Minimol
            cls._featurizer = Minimol(batch_size=64)

    def _featurize(self, smiles_list: list[str]) -> Tuple[torch.Tensor, list[int]]:
        """Featurize SMILES with error handling, returns (features, kept_positions)."""
        def _recurse(slist, positions):
            try:
                feats = self.__class__._featurizer(slist)
                return feats, positions
            except Exception:
                if len(slist) == 1:
                    return [], []
                mid = len(slist) // 2
                lf, lp = _recurse(slist[:mid], positions[:mid])
                rf, rp = _recurse(slist[mid:], positions[mid:])
                return (lf or []) + (rf or []), lp + rp

        feats, kept = _recurse(smiles_list, list(range(len(smiles_list))))
        if feats:
            return torch.stack(feats), kept
        return torch.empty(0), []

    def _predict_ensemble(
        self, features: torch.Tensor, models: list
    ) -> torch.Tensor:
        preds = []
        with torch.inference_mode():
            for model in models:
                logits = model(features)
                preds.append(torch.sigmoid(logits).cpu())
        return torch.stack(preds).mean(dim=0)

    def _score(
        self, smiles_list: list[str], models: list, task_idx: int
    ) -> list[Optional[float]]:
        from rdkit import Chem

        valid_smiles, valid_idx = [], []
        for i, s in enumerate(smiles_list):
            if Chem.MolFromSmiles(s) is not None:
                valid_smiles.append(s)
                valid_idx.append(i)

        results: list[Optional[float]] = [None] * len(smiles_list)
        if not valid_smiles:
            return results

        features, kept = self._featurize(valid_smiles)
        if features.numel() == 0:
            return results

        ensemble = self._predict_ensemble(features, models)
        for pos, pred in zip(kept, ensemble):
            results[valid_idx[pos]] = float(pred[task_idx])
        return results

    def score_klebsiella_pneumoniae(self, smiles: list[str]) -> list[Optional[float]]:
        return self._score(smiles, self._gram, task_idx=2)

    def score_escherichia_coli(self, smiles: list[str]) -> list[Optional[float]]:
        return self._score(smiles, self._gram, task_idx=1)

    def score_acinetobacter_baumanii(self, smiles: list[str]) -> list[Optional[float]]:
        return self._score(smiles, self._gram, task_idx=0)

    def score_pseudomonas_aeruginosa(self, smiles: list[str]) -> list[Optional[float]]:
        return self._score(smiles, self._gram, task_idx=3)

    def score_neisseria_gonorrhoeae(self, smiles: list[str]) -> list[Optional[float]]:
        return self._score(smiles, self._gono, task_idx=0)

```

### Core Architecture Module: `examples/frontier_eng/CommunicationEngineering/LDPCErrorFloor/grader/src/frontier_eng_grader/__init__.py`
```
"""Frontier-Engineering grader (entrypoint: frontier_eng_grader.grader:Grader)."""

from .grader import Grader

__all__ = ["Grader"]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #238** (2026-08-15): **[Bug]: Worktree provisioning is marked complete when CORAL bootstrap fails**
  *Symptoms*: ## Summary  `setup_worktree_env()` treats installing CORAL into the worktree virtual environment as best-effort. When `uv pip install` exits non-zero, it only logs a warning and returns successfully. The manager can then persist `.coral_agent_id` as the provisioning readiness breadcrumb even though the agent may be unable to run `uv run coral eval`.  This affects current `dev` and remains present in PR #236. It also violates the successful-provisioning requirement in #211.  ## Reproduction  ```python import subprocess from coral.workspace import worktree  real_run = worktree.subprocess.run  def fail_coral_install(args, *rest, **kwargs):     if isinstance(args, list) and args[:2] == ["uv", "pip"]:         return subprocess.CompletedProcess(             args,             1,             stdout="",             stderr="forced install failure",         )     return real_run(args, *rest, **kwargs)  worktree.subprocess.run = fail_coral_install worktree.setup_worktree_env(worktree_path, ["uv venv .venv"]) print("returned successfully") ```  Observed log:  ```text Failed to install coral in worktree: forced install failure returned successfully ```  In PR #236, `_setup_and_start_agent()` subsequently calls `write_agent_id()`, so later launches treat this worktree as fully provisioned.  ## Expected behavior  A failure to install CORAL into a newly created worktree venv should raise `RuntimeError`. The provisioning readiness breadcrumb must only be written after every required bootstrap 
  **Post-Mortem & Fix Analysis**:
  > Hi @BobbyZhouZijian ! I'd like to work on this issue.
  > @shardool-patil No problem! 

- **Issue #228** (2026-08-11): **fix: resolve virtualenv executable paths cross-platform**
  *Symptoms*: ## Context  Follow-up to #226.  That PR correctly replaces the hardcoded PATH separator with `os.pathsep`, which preserves inherited PATH entries on Windows. However, CORAL still assumes the POSIX virtualenv layout in several places: `.venv/bin` and `bin/python`.  Python virtual environments use `bin/` on POSIX and `Scripts/` on Windows, with the Windows interpreter normally located at `Scripts/python.exe`.  This issue tracks virtualenv path correctness only; it does not claim or require complete native Windows support.  ## Affected call sites  - `coral/agent/builtin/claude_code.py` - `coral/agent/builtin/codex.py` - `coral/agent/builtin/cursor_agent.py` - `coral/agent/builtin/opencode.py` - `coral/agent/builtin/pi_agent.py`   - Each prepends `<worktree>/.venv/bin` to the agent PATH. - `coral/workspace/worktree.py::setup_worktree_env`   - Uses `.venv/bin/python` both to detect a populated environment and to install CORAL into it. - `coral/workspace/grader_env.py::grader_python_path`   - Returns `grader_venv/bin/python` unconditionally. - `coral/cli/start.py::_resolved_python`   - Searches local environments only at `.venv/bin/python` and `venv/bin/python`.  ## Impact  On native Windows, these paths do not exist. Depending on configuration:  - the worktree venv is not added to the agent PATH; - `setup_worktree_env` does not recognize a venv created under `Scripts/` and can skip installing CORAL into it; - the grader can be launched with a nonexistent interpreter path; - the CL

- **Issue #211** (2026-08-15): **[Bug]: workspace.setup reruns on agent restart**
  *Symptoms*: ## Problem  `workspace.setup` is documented to run once per worktree, but it currently lives in `_setup_and_start_agent()`, which is also used for heartbeat, crash, timeout, migration, and manual resumes. Non-Python setup such as `npm ci` therefore reruns on every restart unless CORAL adds artifact-specific caching.  ## Proposed solution  Separate the lifecycle into:  - one-time worktree provisioning: create the worktree, run `workspace.setup`, and bootstrap its environment; - repeatable agent launch: refresh runtime-managed state and start or resume the agent process.  Initial startup should perform both phases. Warmstart transitions, automatic restarts, migrations, and `coral resume` should only perform the launch phase for an already-prepared worktree. Persist only successful provisioning state, using the existing worktree readiness breadcrumb or manager-owned state under `.coral/private/`.  If setup must be rerun for an existing worktree, make that an explicit operation rather than inferring dependencies from a fixed manifest list.  ## Area  - `coral/agent` (manager lifecycle) - `coral/workspace` (worktree provisioning)  ## Alternatives considered  PR #195 fingerprints common dependency manifests and records whether setup created a Python venv. This handles some cases but cannot reliably model arbitrary shell-command inputs or non-Python artifacts.  ## Additional context  Related: #195 
  **Post-Mortem & Fix Analysis**:
  > Hi @BobbyZhouZijian ,  I'd like to work on this issue if it's still available.
  > @shardool-patil Welcome to submit a PR for it!

- **Issue #202** (2026-08-04): **fix(grader): prevent private score breakdowns from leaking into public attempts**
  *Symptoms*: ## Motivation  Follow-up to #199 and #201.  PR #201 persists serialized `ScoreBundle.scores` under `Attempt.metadata["scores"]`. The grader daemon currently does this unconditionally, even when `ScoreBundle.is_public` is `False`.  Attempt records live under `.coral/public/attempts/` (or the corresponding public per-island attempts directory) and are linked into agent worktrees. As a result, a private bundle can expose every per-dimension value and its `Score.metadata` to the running agents.  This conflicts with the documented `ScoreBundle.is_public` contract (`False` hides the score from the agent). The aggregate `Attempt.score` and score explanations already have pre-existing visibility behavior; this issue is specifically about preventing #201's newly persisted score breakdown from widening that exposure, while documenting any broader contract decision explicitly.  ## Current behavior  The daemon effectively performs:  ```python metadata["scores"] = {     name: score.to_dict()     for name, score in bundle.scores.items() } ```  without checking `bundle.is_public`. A bundle such as:  ```python ScoreBundle(     scores={         "hidden_metric": Score(             value=0.123,             name="hidden_metric",             metadata={"hidden_case": "answer-key-signal"},         )     },     aggregated=0.5,     is_public=False, ) ```  therefore writes both `0.123` and `answer-key-signal` into an agent-visible attempt JSON.  ## Scope  - Respect `ScoreBundle.is_public` when finaliz

- **Issue #171** (2026-07-11): **coral revert / coral checkout loses .gitignore entries, causing breadcrumb files to be committed**
  *Symptoms*: ## Motivation  When running over a large repo, its useful to define an allow list of files that can be changes. When doing that, unexpected changes to coral infra files may fail such a grader. The agent's eventually understands the issue and overcomes, but its wasteful.  ## Description  `coral revert` and `coral checkout` run `git reset --hard`, which reverts `.gitignore` to its committed state. Since `setup_gitignore()` only runs once during initial worktree setup (appending entries to the working tree), the CORAL infrastructure entries (`.coral_agent_id`, `.coral_dir`, `CLAUDE.md`, etc.) are lost after a reset.  The next `coral eval` calls `git add -A` (in `coral/hooks/post_commit.py:_git_add_and_commit()`), which now stages the breadcrumb files because `.gitignore` no longer excludes them. These files end up in the agent's commit and pollute the grader's diff.  ## Reproduction  ```bash coral start -c task.yaml # Agent makes a commit, then runs: coral revert # .gitignore now lacks CORAL entries git add -A git status  # shows .coral_agent_id, .coral_dir as staged new files ```  ## Root Cause  - `setup_gitignore()` (`coral/workspace/worktree.py:98`) appends entries to the working-tree `.gitignore` but they are never committed - `cmd_revert` / `cmd_checkout` (`coral/cli/eval.py`) do `git reset --hard` which restores `.gitignore` to its committed (pre-CORAL) state - `_git_add_and_commit()` (`coral/hooks/post_commit.py:44`) does `git add -A` which stages everything not in `.giti
  **Post-Mortem & Fix Analysis**:
  > @YihongT @YhYan FYI - the above comment is suspicious.. (suggest not to download / open the link .. )  update: i see the comment was deleted.
  > Thanks for the issue and the corresponding PR! I will look into it.
  > I have created a proposed fix using git exclude #175 , which seems to be a more thorough fix for the issue. Would love to hear your comment.

- **Issue #136** (2026-06-24): **Packaged grader taskdata is documented as hidden but remains readable by agents**
  *Symptoms*: # CORAL Issue Draft: packaged `taskdata/` is documented as hidden but remains readable by agents  作成日: 2026-06-24  Upstream repository:  `Human-Agent-Society/CORAL`  Observed CORAL version:  `coral 0.7.1.dev6+gca39d8644`  Installed from:  `https://github.com/Human-Agent-Society/CORAL.git`  Commit:  `ca39d86448464fb14b030ab791359faa0bf75b02`  ## Issue title  Packaged grader `taskdata/` is documented as hidden, but agents can read it when the grader is installed editable  ## Summary  The task-authoring documentation says answer keys, fixtures, and helper modules can go inside a packaged grader's `taskdata/` directory so agents cannot read them.  In the current implementation, the protected/private data path is different:  - only paths listed in `grader.private` are copied into `.coral/private/`; - Claude/OpenCode deny rules target `.coral/private/**`; - Codex task worktrees are configured with `sandbox_mode = "danger-full-access"` and no equivalent path deny; - packaged grader `taskdata/` is not copied into `.coral/private/`; - when a grader is installed with `python -m pip install -e ./grader`, the grader package remains an editable pointer to the task root's `grader/src/...` tree.  Therefore `grader/src/<package>/taskdata/...` remains readable from agent worktrees. In my run, an agent worktree could read both `expected.json` and hidden Java fixtures directly by absolute path.  This breaks the hidden-answer-key assumption for CORAL benchmarks.  ## Expected behavior  If docs re
  **Post-Mortem & Fix Analysis**:
  > Thanks for the issue. We will look into it!

- **Issue #80** (2026-05-07): **claude code keeps adding pending jobs**
  *Symptoms*: Hi,  First, thank you for your interesting work!  I have an issue when running a task. I'm using Claude code and the job usually has to run for ~2h before completion.  <img width="739" height="1070" alt="Image" src="https://github.com/user-attachments/assets/0f6dac82-deaa-4ff7-9554-f21407fafbc5" />   Is it an issue with my config that triggers this? ```yaml task:   name: "..."   description: |     ... grader:   timeout: 5000   direction: minimize  agents:   count: 1   runtime: claude_code   model: sonnet   max_turns: 100   research: true   timeout: 0  workspace:   repo_path: ".../CORAL/<task dir>"   setup:     - "uv pip install -e ... --quiet"  run:   verbose: false   ui: true   session: tmux  sharing:   attempts: true   notes: true   skills: true ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for the bug report! We will look into it.

- **Issue #55** (2026-04-18): **There is no supported evaluation like swebench as mentioned in the official docs**
  *Symptoms*: ## Bug Report  ### Description  The [official documentation / website](https://docs.coralxyz.com/getting-started/installation#optional-dependencies) mentions support for several evaluation benchmarks, specifically **SWE-bench**. However, when attempting to install the required dependencies or use the benchmark, it appears to be completely missing from the current repository.  Specifically, trying to sync the `swebench` extra via `uv` fails because it is not defined in [pyproject.toml](cci:7://file:///private/tmp/CORAL/pyproject.toml:0:0-0:0).  ### Steps to Reproduce  ```bash # SWE-bench uv sync --extra swebench # Terminal-Bench uv sync --extra terminalbench # Erdős Problems uv sync --extra erdos ```  ### Expected Behavior  Dependencies for the documented benchmarks (like SWE-bench, Terminal-bench) are available and can be installed via the package manager.  ### Actual Behavior  ``` Resolved 119 packages in 4ms error: Extra `swebench` is not defined in the project's `optional-dependencies` table ```  ### Environment  - CORAL version: [9ccabab](https://github.com/Human-Agent-Society/CORAL/tree/9ccabab42853715c8d1bd97598302b473a374d26) - Python version: `Python 3.12.3` - Astral UV: `uv 0.9.15`  ### Additional Context  A search of the repository shows that while the `swebench` grader type is referenced in [coral/template/coral_md.py](cci:7://CORAL/coral/template/coral_md.py:0:0-0:0) (for agent instructions), the actual grader implementation and its associated Python dependency ex
  **Post-Mortem & Fix Analysis**:
  > Hi @ZoneTwelve, thanks for the feedback! We removed the old implementation due to some dependency issues but forgot to update the docs. We have just created a PR adding back swebench and terminal-bench support using Harbor. We are still testing it but feel free to try it out and let us know if there are any problem.  The examples are under examples/swebench-verified/ and examples/terminal-bench. Remember to set your model APIs in the seed/solve.py first.
  > > Hi [@ZoneTwelve](https://github.com/ZoneTwelve), thanks for the feedback! We removed the old implementation due to some dependency issues but forgot to update the docs. We have just created a PR adding back swebench and terminal-bench support using Harbor. We are still testing it but feel free to try it out and let us know if there are any problem. >  > The examples are under examples/swebench-verified/ and examples/terminal-bench. Remember to set your model APIs in the seed/solve.py first.  Thanks for the update! I'll definitely give the new implementation a try when I have a moment.  In the meantime, I have one suggestion: while you're working on fixes like this, it would be great if you could post brief "status updates" in the issue thread. It helps users who are following the project stay in the loop, and I'm excited of what you guys building, I'd love to hear more about it.
  > Thanks for the suggestion, that's fair feedback! I've linked PR #61 to this issue so you should see updates there as we iterate. Will try to be better about dropping quick status notes in threads going forward.

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

### Incident Patch 1: `896655d5` (2026-09-06)
**Commit Message**: fix(task): report validation baseline target consistently for empty seed (#265)

When seed/ exists but contributes nothing to the validation workspace
(empty, or containing only __pycache__, which the copy loop skips),
run_validation emitted the 'No seed/ directory — grader will run
against an empty workspace' warning and then announced 'Running grader
against seed code...'. The baseline-target message keyed off
seed_dir.is_dir() instead of whether anything was actually copied.

Base both messages on the same has_seed decision, and treat a
__pycache__-only seed/ as empty so the 'Seed: copied' message is never
emitted when the workspace stays empty.

**File**: `coral/task/validation.py` (modified, +7/-2)
```diff
@@ -299,7 +299,12 @@ def stop(stage: ValidationStage, code: str, message: str) -> ValidationRunResult
         try:
             workspace.mkdir()
             seed_dir = task_dir / "seed"
-            has_seed = seed_dir.is_dir() and any(seed_dir.iterdir())
+            # Mirror the copy loop below: a seed/ that exists but contributes
+            # nothing to the workspace (empty, or only __pycache__) is treated
+            # as absent so the progress messages describe what actually runs.
+            has_seed = seed_dir.is_dir() and any(
+                item.name != "__pycache__" for item in seed_dir.iterdir()
+            )
             if has_seed:
                 for item in seed_dir.iterdir():
                     if item.name == "__pycache__":
@@ -369,7 +374,7 @@ def stop(stage: ValidationStage, code: str, message: str) -> ValidationRunResult
             name=config.task.name,
             description=config.task.description,
         )
-        target = "seed code" if seed_dir.is_dir() else "empty workspace"
+        target = "seed code" if has_seed else "empty workspace"
         emit("baseline", "started", f"Running grader against {target}...")
         try:
             baseline = await grader.grade(str(workspace), [task])
```

**File**: `tests/test_validation.py` (modified, +45/-0)
```diff
@@ -196,6 +196,51 @@ async def grade(self, codebase_path, tasks):
     ]
 
 
+@pytest.mark.parametrize(
+    "seed_contents",
+    [
+        pytest.param(None, id="no-seed-dir"),
+        pytest.param([], id="empty-seed-dir"),
+        pytest.param(["__pycache__"], id="pycache-only-seed-dir"),
+    ],
+)
+def test_run_validation_reports_empty_workspace_consistently(tmp_path, monkeypatch, seed_contents):
+    """When nothing lands in the workspace, both the workspace warning and the
+    baseline-target message must say so — previously a seed/ dir that existed
+    but contributed nothing produced the 'No seed/' warning and then claimed
+    to run the grader 'against seed code'."""
+    task_dir = _make_task(tmp_path, '  entrypoint: "p.g:G"')
+    if seed_contents is not None:
+        seed_dir = task_dir / "seed"
+        seed_dir.mkdir()
+        for name in seed_contents:
+            (seed_dir / name).mkdir()
+
+    class FakeGrader:
+        async def grade(self, codebase_path, tasks):
+            assert list(Path(codebase_path).iterdir()) == []
+            return ScoreBundle(
+                scores={"eval": Score(value=0.0, name="eval", explanation="empty")},
+                aggregated=0.0,
+            )
+
+    monkeypatch.setattr(
+        "coral.workspace.grader_env.setup_grader_env",
+        lambda coral_dir, grader_config, config_dir: None,
+    )
+    monkeypatch.setattr(
+        "coral.grader.loader.load_grader",
+        lambda config, coral_dir: FakeGrader(),
+    )
+
+    result = task_validation.run_validation(task_dir)
+
+    assert result.successful
+    events = {(event.stage, event.status): event.message for event in result.events}
+    assert "No seed/ directory" in events[("workspace", "completed")]
+    assert events[("baseline", "started")] == "Running grader against empty workspace..."
+
+
 async def test_run_validation_async_runs_inside_existing_event_loop(tmp_path, monkeypatch):
     task_dir = _make_task(tmp_path, '  entrypoint: "p.g:G"')
 
```

---

### Incident Patch 2: `73870a62` (2026-09-06)
**Commit Message**: fix(gateway): assemble Anthropic Messages SSE streams in request log (#261)

The gateway middleware intercepts /v1/messages but _assemble_response
only understood OpenAI Chat Completions and Responses API streaming
formats. Anthropic Messages streams were mishandled twice over:

- The SSE sniff checked for a leading "data:" line, but the Anthropic
  SDK emits "event: <type>" lines first, so the whole stream fell
  through to _safe_parse_json and was logged as one raw SSE text blob.
- Even past the sniff, content_block_delta / message_start /
  message_delta events were ignored, so no content, stop reason, or
  usage would have been assembled.

Recognize "event:"-prefixed bodies as SSE and assemble the Anthropic
event types: text from content_block_delta (text_delta), id/model and
input usage from message_start, stop_reason and output usage from
message_delta (merged, so input_tokens is preserved). The generic
top-level usage capture moves into the Chat Completions branch so it
no longer clobbers the merged Anthropic usage.

Adds tests for the Anthropic assembly plus regression coverage for the
existing Chat Completions, Responses API, and non-SSE paths.

**File**: `coral/gateway/middleware.py` (modified, +30/-4)
```diff
@@ -306,8 +306,11 @@ def _assemble_response(data: bytes) -> Any:
 
     raw = data.decode("utf-8", errors="replace")
 
-    # Check if this is an SSE stream (starts with "data: ")
-    if not raw.lstrip().startswith("data:"):
+    # Check if this is an SSE stream. OpenAI-style streams start with a
+    # "data:" field; Anthropic Messages streams start with an "event:" field
+    # (e.g. "event: message_start").
+    stripped = raw.lstrip()
+    if not (stripped.startswith("data:") or stripped.startswith("event:")):
         return _safe_parse_json(data)
 
     # Parse SSE chunks and assemble content
@@ -351,6 +354,29 @@ def _assemble_response(data: bytes) -> Any:
             status = response_obj.get("status")
             if response_obj.get("usage"):
                 usage = response_obj["usage"]
+        # Anthropic Messages API streaming format
+        elif chunk_type == "message_start":
+            message = chunk.get("message", {})
+            if not response_id and message.get("id"):
+                response_id = message["id"]
+            if not model and message.get("model"):
+                model = message["model"]
+            if isinstance(message.get("usage"), dict):
+                usage = {**(usage or {}), **message["usage"]}
+        elif chunk_type == "content_block_delta":
+            delta = chunk.get("delta", {})
+            if delta.get("type") == "text_delta":
+                text = delta.get("text", "")
+                if text:
+                    content_parts.append(text)
+        elif chunk_type == "message_delta":
+            delta = chunk.get("delta", {})
+            if delta.get("stop_reason"):
+                finish_reason = delta["stop_reason"]
+            # message_delta carries cumulative output token usage at the top
+            # level; merge it so input_tokens from message_start is kept.
+            if isinstance(chunk.get("usage"), dict):
+                usage = {**(usage or {}), **chunk["usage"]}
         # Chat Completions streaming format
         else:
             for choice in chunk.get("choices", []):
@@ -361,8 +387,8 @@ def _assemble_response(data: bytes) -> Any:
                 if choice.get("finish_reason"):
                     finish_reason = choice["finish_reason"]
 
-        if chunk.get("usage"):
-            usage = chunk["usage"]
+            if chunk.get("usage"):
+                usage = chunk["usage"]
 
     assembled: dict[str, Any] = {}
     if response_id:
```

**File**: `tests/test_gateway_middleware.py` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+"""Tests for SSE response assembly in the gateway middleware."""
+
+import json
+
+from coral.gateway.middleware import _assemble_response
+
+
+def _sse(events: list[dict], with_event_lines: bool = False) -> bytes:
+    """Render events as an SSE stream body."""
+    lines = []
+    for event in events:
+        if with_event_lines:
+            lines.append(f"event: {event.get('type', 'message')}")
+        lines.append(f"data: {json.dumps(event)}")
+        lines.append("")
+    return "\n".join(lines).encode("utf-8")
+
+
+def test_non_sse_json_body_is_parsed() -> None:
+    body = json.dumps({"id": "resp_1", "object": "chat.completion"}).encode()
+    assert _assemble_response(body) == {"id": "resp_1", "object": "chat.completion"}
+
+
+def test_empty_body_returns_none() -> None:
+    assert _assemble_response(b"") is None
+
+
+def test_chat_completions_stream_assembly() -> None:
+    events = [
+        {
+            "id": "chatcmpl-1",
+            "model": "gpt-x",
+            "choices": [{"delta": {"content": "Hello"}, "finish_reason": None}],
+        },
+        {
+            "id": "chatcmpl-1",
+            "choices": [{"delta": {"content": " world"}, "finish_reason": "stop"}],
+        },
+        {"id": "chatcmpl-1", "choices": [], "usage": {"total_tokens": 7}},
+    ]
+    raw = _sse(events) + b"data: [DONE]\n"
+
+    assembled = _assemble_response(raw)
+
+    assert assembled == {
+        "id": "chatcmpl-1",
+        "model": "gpt-x",
+        "content": "Hello world",
+        "finish_reason": "stop",
+        "usage": {"total_tokens": 7},
+    }
+
+
+def test_responses_api_stream_assembly() -> None:
+    events = [
+        {"type": "response.output_text.delta", "delta": "Hi"},
+        {"type": "response.output_text.delta", "delta": " there"},
+        {
+            "type": "response.completed",
+            "response": {
+                "id": "resp_9",
+                "model": "gpt-x",
+                "status": "completed",
+                "usage": {"total_tokens": 11},
+            },
+        },
+    ]
+
+    assembled = _assemble_response(_sse(events))
+
+    assert assembled == {
+        "id": "resp_9",
+        "model": "gpt-x",
+        "content": "Hi there",
+        "status": "completed",
+        "usage": {"total_tokens": 11},
+    }
+
+
+def test_anthropic_messages_stream_assembly() -> None:
+    events = [
+        {
+            "type": "message_start",
+            "message": {
+                "id": "msg_1",
+                "model": "claude-x",
+                "usage": {"input_tokens": 25, "output_tokens": 1},
+            },
+        },
+        {
+            "type": "content_block_start",
+            "index": 0,
+            "content_block": {"type": "text", "text": ""},
+        },
+        {
+            "type": "content_block_delta",
+            "index": 0,
+            "delta": {"type": "text_delta", "text": "Hello"},
+        },
+        {
+            "type": "content_block_delta",
+            "index": 0,
+            "delta": {"type": "text_delta", "text": " world"},
+        },
+        {"type": "content_block_stop", "index": 0},
+        {
+            "type": "message_delta",
+            "delta": {"stop_reason": "end_turn", "stop_sequence": None},
+            "usage": {"output_tokens": 6},
+        },
+        {"type": "message_stop"},
+    ]
+
+    # The Anthropic SDK emits "event: <type>" lines before each data line,
+    # so the stream starts with "event: message_start", not "data:".
+    assembled = _assemble_response(_sse(events, with_event_lines=True))
+
+    assert assembled == {
+        "id": "msg_1",
+        "model": "claude-x",
+        "content": "Hello world",
+        "finish_reason": "end_turn",
+        "usage": {"input_tokens": 25, "output_tokens": 6},
+    }
+
+
+def test_anthropic_non_text_deltas_are_ignored() -> None:
+    events = [
+        {
+            "type": "message_start",
+            "message": {"id": "msg_2", "model": "claude-x", "usage": {"input_tokens": 3}},
+        },
+        {
+            "type": "content_block_delta",
+            "index": 0,
+            "delta": {"type": "input_json_delta", "partial_json": '{"city": "SF"}'},
+        },
+        {"type": "ping"},
+        {"type": "message_delta", "delta": {"stop_reason": "tool_use"}, "usage": {}},
+    ]
+
+    assembled = _assemble_response(_sse(events, with_event_lines=True))
+
+    assert "content" not in assembled
+    assert assembled["finish_reason"] == "tool_use"
+
+
+def test_invalid_json_frames_are_skipped() -> None:
+    raw = (
+        b"data: not-json\n\n"
+        b'data: {"id": "chatcmpl-2", "choices": '
+        b'[{"delta": {"content": "ok"}, "finish_reason": "stop"}]}\n\n'
+        b"data: [DONE]\n"
+    )
+
+    assembled = _assemble_response(raw)
+
+    assert assembled["content"] == "ok"
+    assert assembled["finish_reason"] == "stop"
```

---

### Incident Patch 3: `04b82fe6` (2026-09-06)
**Commit Message**: fix(gateway): warn when an unrecognized proxy key is attributed to the sole agent (#262)

_get_agent_info falls back to the sole registered agent when the bearer
key does not match any registered proxy key. That fallback is
intentional (OpenCode sends a static apiKey from opencode.json), but it
also silently swallows genuinely wrong keys — e.g. a stale proxy key
from a previous run — misattributing the traffic without any signal.

Keep the fallback, but distinguish the two cases: a missing key still
falls back silently, while a present-but-mismatched key now logs a
warning naming the agent the traffic is attributed to. The warning is
emitted once per distinct unknown key to avoid flooding the log, and
never includes the key material itself.

Adds tests covering matching, missing, and mismatched keys for both the
single-agent and multi-agent cases.

**File**: `coral/gateway/middleware.py` (modified, +15/-2)
```diff
@@ -51,6 +51,7 @@ def __init__(
         self.header_provider = header_provider
         self._agent_map: dict[str, AgentInfo] = {}  # proxy_key -> agent info
         self._hash_cache: dict[str, tuple[str, float]] = {}  # worktree -> (hash, timestamp)
+        self._warned_unknown_keys: set[str] = set()  # keys already warned about
 
         # Ensure log directory exists
         self.log_dir.mkdir(parents=True, exist_ok=True)
@@ -83,9 +84,21 @@ def _get_agent_info(self, auth_header: str) -> AgentInfo | None:
         info = self._agent_map.get(token)
         if info:
             return info
-        # Key not recognized — fall back to sole agent if only one registered
+        # Key present but not recognized — fall back to sole agent if only one
+        # is registered, but warn: unlike a missing key, a mismatched key
+        # usually means a stale or misconfigured proxy key, and silently
+        # attributing the traffic would mask that.
         if len(self._agent_map) == 1:
-            return next(iter(self._agent_map.values()))
+            fallback = next(iter(self._agent_map.values()))
+            if token not in self._warned_unknown_keys:
+                self._warned_unknown_keys.add(token)
+                logger.warning(
+                    "Gateway received a bearer key that does not match any "
+                    f"registered proxy key; attributing traffic to the sole "
+                    f"registered agent '{fallback.agent_id}'. This may "
+                    "indicate a stale or misconfigured key."
+                )
+            return fallback
         return None
 
     def _get_commit_hash(self, worktree_path: Path) -> str:
```

**File**: `tests/test_gateway_agent_auth.py` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+"""Tests for agent identification from auth headers in the gateway middleware."""
+
+import logging
+from pathlib import Path
+
+import pytest
+
+from coral.gateway.middleware import CoralGatewayMiddleware
+
+
+@pytest.fixture
+def middleware(tmp_path: Path) -> CoralGatewayMiddleware:
+    async def dummy_app(scope, receive, send):  # pragma: no cover - never called
+        raise AssertionError("app should not be called in these tests")
+
+    return CoralGatewayMiddleware(dummy_app, log_dir=tmp_path, master_key="master")
+
+
+def test_matching_key_returns_agent(middleware: CoralGatewayMiddleware, tmp_path: Path) -> None:
+    middleware.register_agent("agent-1", tmp_path, "key-1")
+    middleware.register_agent("agent-2", tmp_path, "key-2")
+
+    info = middleware._get_agent_info("Bearer key-2")
+
+    assert info is not None
+    assert info.agent_id == "agent-2"
+
+
+def test_missing_header_falls_back_to_sole_agent_without_warning(
+    middleware: CoralGatewayMiddleware,
+    tmp_path: Path,
+    caplog: pytest.LogCaptureFixture,
+) -> None:
+    middleware.register_agent("agent-1", tmp_path, "key-1")
+
+    with caplog.at_level(logging.WARNING, logger="coral.gateway.middleware"):
+        info = middleware._get_agent_info("")
+
+    assert info is not None
+    assert info.agent_id == "agent-1"
+    assert not caplog.records
+
+
+def test_mismatched_key_falls_back_to_sole_agent_with_warning(
+    middleware: CoralGatewayMiddleware,
+    tmp_path: Path,
+    caplog: pytest.LogCaptureFixture,
+) -> None:
+    middleware.register_agent("agent-1", tmp_path, "key-1")
+
+    with caplog.at_level(logging.WARNING, logger="coral.gateway.middleware"):
+        info = middleware._get_agent_info("Bearer stale-key")
+
+    assert info is not None
+    assert info.agent_id == "agent-1"
+    assert len(caplog.records) == 1
+    assert "does not match any registered proxy key" in caplog.records[0].message
+    # The unrecognized key itself must not leak into the log
+    assert "stale-key" not in caplog.records[0].message
+
+
+def test_mismatched_key_warns_only_once_per_key(
+    middleware: CoralGatewayMiddleware,
+    tmp_path: Path,
+    caplog: pytest.LogCaptureFixture,
+) -> None:
+    middleware.register_agent("agent-1", tmp_path, "key-1")
+
+    with caplog.at_level(logging.WARNING, logger="coral.gateway.middleware"):
+        middleware._get_agent_info("Bearer stale-key")
+        middleware._get_agent_info("Bearer stale-key")
+        middleware._get_agent_info("Bearer other-stale-key")
+
+    assert len(caplog.records) == 2
+
+
+def test_mismatched_key_with_multiple_agents_returns_none(
+    middleware: CoralGatewayMiddleware, tmp_path: Path
+) -> None:
+    middleware.register_agent("agent-1", tmp_path, "key-1")
+    middleware.register_agent("agent-2", tmp_path, "key-2")
+
+    assert middleware._get_agent_info("Bearer stale-key") is None
+    assert middleware._get_agent_info("") is None
```

---

### Incident Patch 4: `8072072a` (2026-09-06)
**Commit Message**: fix(agent): use cross-platform venv paths and utf-8 log in dsh runtime (#264)

The DeepSeek Harness runtime hardcoded the POSIX venv layout
(.venv/bin with a ':' PATH separator) instead of the venv_bin_dir
helper + os.pathsep used by every other builtin runtime since the
cross-platform centralization in #231. On Windows the agent PATH
pointed at a nonexistent directory with the wrong separator.

It also opened the agent log without encoding='utf-8',
errors='replace' (unlike the six sibling runtimes), so the verbose
tee thread, which writes UTF-8-decoded agent output through that
handle, raises UnicodeEncodeError under a non-UTF-8 locale.

Align both with the sibling runtimes and pin them with tests.

**File**: `coral/agent/builtin/deepseek_harness.py` (modified, +7/-2)
```diff
@@ -4,6 +4,7 @@
 
 import json
 import logging
+import os
 import subprocess
 import sys
 import threading
@@ -20,6 +21,7 @@
     write_coral_log_entry,
 )
 from coral.sandbox.protocol import AgentSandboxSpec
+from coral.venv_paths import venv_bin_dir
 from coral.workspace.repo import _clean_env
 
 logger = logging.getLogger(__name__)
@@ -139,7 +141,10 @@ def start(
         worktree_venv = str(worktree_path / ".venv")
         agent_env["UV_PROJECT_ENVIRONMENT"] = worktree_venv
         agent_env["VIRTUAL_ENV"] = worktree_venv
-        agent_env["PATH"] = str(worktree_path / ".venv" / "bin") + ":" + agent_env.get("PATH", "")
+        # Prepend the venv executable dir (bin or Scripts) to PATH, matching
+        # the platform-aware resolution used by the other builtin runtimes.
+        venv_bin = str(venv_bin_dir(worktree_path / ".venv"))
+        agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
         agent_env["DSH_HOME"] = str(dsh_home)
 
         permission_mode = opts.get("permission_mode")
@@ -156,7 +161,7 @@ def start(
         apply_sandbox_env(agent_env, sandbox)
         user_kwargs = apply_run_as_user(agent_env, run_as_user)
 
-        log_file = open(log_path, "w", buffering=1)
+        log_file = open(log_path, "w", buffering=1, encoding="utf-8", errors="replace")
         err_path: Path | None = None
         err_file: Any = None
         stderr_target: Any = subprocess.STDOUT
```

**File**: `tests/test_deepseek_harness.py` (modified, +51/-0)
```diff
@@ -2,7 +2,9 @@
 
 from __future__ import annotations
 
+import os
 import subprocess
+import sys
 from pathlib import Path
 from typing import Any
 
@@ -151,3 +153,52 @@ def test_restart_does_not_invent_unsupported_resume_flag(
     assert cmd[:3] == ["dsh", "--profile", "headless"]
     assert cmd[-1] == "continue"
     assert "--resume" not in cmd
+
+
+def test_start_prepends_platform_aware_venv_bin_to_path(
+    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
+) -> None:
+    """PATH must use the platform's venv executable dir (bin/ vs Scripts/).
+
+    Guards the cross-platform venv path contract (#231): a hardcoded
+    ``.venv/bin`` would point at a nonexistent directory on Windows.
+    """
+    monkeypatch.setattr(subprocess, "Popen", _FakePopen)
+    worktree = _make_worktree(tmp_path)
+
+    monkeypatch.setattr(sys, "platform", "win32")
+    DeepSeekHarnessRuntime().start(
+        worktree_path=worktree,
+        coral_md_path=worktree / "AGENTS.md",
+        log_dir=tmp_path / "logs",
+        prompt="task",
+    )
+
+    path_value = _FakePopen.captured[0]["kwargs"]["env"]["PATH"]
+    first_entry = path_value.split(os.pathsep)[0]
+    assert first_entry == str(worktree / ".venv" / "Scripts")
+
+
+def test_start_opens_log_file_utf8_with_replacement(
+    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
+) -> None:
+    """The agent log must be UTF-8 with errors='replace' like all runtimes.
+
+    Without an explicit encoding, the log file inherits the locale encoding,
+    and the verbose tee (which writes UTF-8-decoded agent output through this
+    handle) raises UnicodeEncodeError under a non-UTF-8 locale.
+    """
+    monkeypatch.setattr(subprocess, "Popen", _FakePopen)
+    worktree = _make_worktree(tmp_path)
+
+    handle = DeepSeekHarnessRuntime().start(
+        worktree_path=worktree,
+        coral_md_path=worktree / "AGENTS.md",
+        log_dir=tmp_path / "logs",
+        prompt="task",
+    )
+
+    log_file = handle._log_file
+    assert log_file is not None
+    assert log_file.encoding.lower().replace("-", "") == "utf8"
+    assert log_file.errors == "replace"
```

---

### Incident Patch 5: `fdb337f9` (2026-09-06)
**Commit Message**: fix(cli): give the hidden test-eval alias the arguments validate expects (#267)

The backward-compatibility alias test-eval dispatches to cmd_validate,
but its subparser declares no arguments. As a result the alias cannot
be used at all:

- coral test-eval my-task  -> argparse usage error
  ("unrecognized arguments: my-task")
- coral test-eval          -> AttributeError traceback in cmd_validate
  (Namespace has no attribute 'path')

Mirror validate's arguments (path positional and --json) on the alias
parser, suppressed from help, so the alias parses and dispatches like
validate. A bare 'coral test-eval' now exits with a normal argparse
usage error instead of a traceback.

Adds three tests: path forwarding, --json forwarding, and the
missing-positional usage error; all three fail on dev.

Signed-off-by: Xuan Jiang <[REDACTED_EMAIL]>

**File**: `coral/cli/__init__.py` (modified, +5/-2)
```diff
@@ -176,8 +176,11 @@ def main() -> None:
         action="store_true",
         help="Output one machine-readable validation result",
     )
-    # Hidden alias: test-eval -> validate
-    sub.add_parser("test-eval", help=argparse.SUPPRESS)
+    # Hidden alias: test-eval -> validate (mirror validate's arguments so the
+    # alias can actually dispatch; cmd_validate reads args.path)
+    p_test_eval = sub.add_parser("test-eval", help=argparse.SUPPRESS)
+    p_test_eval.add_argument("path", help=argparse.SUPPRESS)
+    p_test_eval.add_argument("--json", action="store_true", help=argparse.SUPPRESS)
 
     # --- Running Agents ---
 
```

**File**: `tests/test_cli_test_eval_alias.py` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+"""Tests for the hidden ``coral test-eval`` -> ``coral validate`` alias.
+
+The alias parser must accept the same arguments as ``validate``; otherwise it
+cannot dispatch (``cmd_validate`` reads ``args.path``).
+"""
+
+import sys
+
+import pytest
+
+import coral.cli as cli_module
+import coral.cli.author as author_module
+
+
+def _capture_cmd_validate(monkeypatch, captured: dict) -> None:
+    def fake_cmd_validate(args):
+        captured["path"] = args.path
+        captured["json"] = getattr(args, "json", False)
+
+    monkeypatch.setattr(author_module, "cmd_validate", fake_cmd_validate)
+
+
+def test_test_eval_alias_forwards_path(monkeypatch):
+    captured: dict = {}
+    _capture_cmd_validate(monkeypatch, captured)
+    monkeypatch.setattr(sys, "argv", ["coral", "test-eval", "my-task"])
+
+    cli_module.main()
+
+    assert captured == {"path": "my-task", "json": False}
+
+
+def test_test_eval_alias_accepts_json_flag(monkeypatch):
+    captured: dict = {}
+    _capture_cmd_validate(monkeypatch, captured)
+    monkeypatch.setattr(sys, "argv", ["coral", "test-eval", "my-task", "--json"])
+
+    cli_module.main()
+
+    assert captured == {"path": "my-task", "json": True}
+
+
+def test_test_eval_alias_without_path_exits_with_usage_error(monkeypatch, capsys):
+    """A missing positional must be an argparse usage error, not a traceback."""
+    captured: dict = {}
+    _capture_cmd_validate(monkeypatch, captured)
+    monkeypatch.setattr(sys, "argv", ["coral", "test-eval"])
+
+    with pytest.raises(SystemExit) as excinfo:
+        cli_module.main()
+
+    assert excinfo.value.code == 2
+    assert captured == {}
```

---

### Incident Patch 6: `15c5a7bc` (2026-08-31)
**Commit Message**: fix(ci): restrict Vercel builds to main (#257)

* fix(ci): restrict Vercel builds to main

* fix(ci): restrict web Vercel builds to main

**File**: `docs/vercel.json` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+{
+  "$schema": "https://openapi.vercel.sh/vercel.json",
+  "git": {
+    "deploymentEnabled": {
+      "*": false,
+      "main": true
+    }
+  }
+}
```

**File**: `web/vercel.json` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+{
+  "$schema": "https://openapi.vercel.sh/vercel.json",
+  "git": {
+    "deploymentEnabled": {
+      "*": false,
+      "main": true
+    }
+  }
+}
```

---

### Incident Patch 7: `36946a2a` (2026-08-15)
**Commit Message**: docs: add shared memory multi-agent tutorial (#243)

**File**: `docs/content/docs/tutorials/meta.json` (modified, +3/-2)
```diff
@@ -1,6 +1,7 @@
 {
   "title": "Tutorials",
   "pages": [
-    "build-autonomous-agent-grader"
+    "build-autonomous-agent-grader",
+    "shared-memory-multi-agent-search"
   ]
-}
\ No newline at end of file
+}
```

**File**: `docs/content/docs/tutorials/shared-memory-multi-agent-search.mdx` (added, +310/-0)
```diff
@@ -0,0 +1,310 @@
+---
+title: How Shared Memory Improves Multi-Agent Search
+description: "Run two CORAL agents on one optimization task, then inspect the attempts, notes, skills, and leaderboard they share without sharing a writable workspace."
+---
+
+Multi-agent search is useful only when parallel workers can explore different
+ideas without losing what the others learn. CORAL separates those concerns:
+each agent edits its own Git worktree, while evaluated attempts and reusable
+knowledge live in shared state.
+
+In this tutorial, you will launch two Codex agents on CORAL's bundled
+[DNA enhancer design example](https://github.com/Human-Agent-Society/CORAL/tree/dev/examples/dna_design),
+inspect the information they share, and compare a single shared island with
+multi-island isolation.
+
+<Callout type="info">
+This tutorial demonstrates the shared-memory workflow. It does not claim that
+two agents will beat one agent in a particular budget. Scores depend on the
+model, prompts, runtime, evaluation count, and stochastic search trajectory.
+</Callout>
+
+## What you will run
+
+The example asks agents to generate valid 200-base DNA sequences while
+optimizing GC-content stability and population diversity. Its checked-in
+[task configuration](https://github.com/Human-Agent-Society/CORAL/blob/dev/examples/dna_design/task.yaml)
+includes a fallback grader that works without the optional Enformer model, so
+you can exercise the complete eval loop with a small local setup.
+
+The run has this shape:
+
+```text
+agent-1 worktree ─┐
+                  ├── shared attempts, notes, skills, and leaderboard
+agent-2 worktree ─┘
+```
+
+Both agents pursue the same scored objective. They can inspect each other's
+results and knowledge, but they cannot edit the same working copy.
+
+## Prerequisites
+
+Start from a clone of the current `dev` branch and install the development
+environment:
+
+```bash
+git clone --branch dev https://github.com/Human-Agent-Society/CORAL.git
+cd CORAL
+uv sync --extra dev
+```
+
+You also need:
+
+- Python 3.11 or newer, Git, and `uv`.
+- `tmux`, because the example launches the run in a background tmux session.
+- The Codex CLI installed and authenticated. See the official
+  [Codex authentication documentation](https://developers.openai.com/codex/auth).
+
+Confirm the local tools and login before continuing:
+
+```bash
+tmux -V
+codex --version
+codex login status
+```
+
+This tutorial uses `gpt-5.4`, the
+[current default for CORAL's Codex runtime](https://github.com/Human-Agent-Society/CORAL/blob/dev/coral/agent/registry.py).
+If that model is unavailable to your account, replace it with a Codex model
+you can use.
+
+## Validate the local grader
+
+Validate the task before starting any agents:
+
+```bash
+uv run coral validate examples/dna_design
+```
+
+`coral validate` checks the task structure, creates an isolated grader
+environment, and scores the seed solution. The command should finish with
+`Validation: OK` and a numeric score. At this point, CORAL has not launched a
+Codex agent.
+
+<Callout type="warn">
+The next command starts two autonomous Codex processes. From that point, the
+run can consume usage included in your ChatGPT plan or billable API usage,
+depending on how your Codex CLI is authenticated. Stop the run when you have
+collected enough evidence.
+</Callout>
+
+## Launch two agents in one shared island
+
+From the repository root, run:
+
+```bash
+uv run coral start -c examples/dna_design/task.yaml \
+  agents.runtime=codex \
+  agents.model=gpt-5.4 \
+  agents.count=2
+```
+
+The command-line overrides leave the checked-in `task.yaml` unchanged. Both
+the runtime and model are overridden because the example's default
+configuration uses Claude Code.
+
+CORAL creates a timestamped run under:
+
+```text
+results/dna-enhancer-design/<timestamp>/
+├── .coral/
+│   ├── public/
+│   └── private/
+├── agents/
+│   ├── agent-1/
+│   └── agent-2/
+└── repo/
+```
+
+`results/dna-enhancer-design/latest` points to the newest run. Each directory
+under `agents/` is a separate Git worktree and branch. An agent can write to
+its own worktree and read sibling worktrees, but the workspace guard prevents
+it from writing to a sibling.
+
+For Codex agents, CORAL creates `.codex/` in each worktree. Its `attempts/`,
+`notes/`, `skills/`, and other agent-facing entries are symlinks into the
+central `.coral/public/` directory. The `.coral_dir` breadcrumb lets CORAL CLI
+commands find that central directory from inside a worktree. See the
+[shared-state wiring source](https://github.com/Human-Agent-Society/CORAL/blob/dev/coral/workspace/worktree.py)
+for the exact list of shared entries.
+
+You can inspect the wiring without changing the run:
+
+```bash
+ls -la results/dna-enhancer-design/latest/agents/agent-1/.codex
+find results/dna-enhancer-design/latest/.coral/public -maxdepth 2 -type f
+```
+
+The grader environment and temporary grading checkouts live under
+`.coral/private/
```

---

### Incident Patch 8: `e4262352` (2026-08-12)
**Commit Message**: fix(workspace): propagate uv pip install failure as RuntimeError (#241)

* fix(workspace): propagate uv pip install failure as RuntimeError

* fix(workspace): propagate uv pip install failure as RuntimeError

* fix(workspace): propagate uv pip install failure as RuntimeError

**File**: `.claude/skills/coral-new-task/SKILL.md` (modified, +1/-0)
```diff
@@ -123,6 +123,7 @@ If the grader needs reference files (model weights, ground-truth answers, scorin
 
 ```python
 import importlib.resources
+
 scorer_dir = str(importlib.resources.files("<task>_grader.scorers"))
 ```
 
```

**File**: `coral/workspace/worktree.py` (modified, +3/-1)
```diff
@@ -747,4 +747,6 @@ def setup_worktree_env(worktree_path: Path, setup_commands: list[str]) -> None:
                 env=env,
             )
             if result.returncode != 0:
-                logger.warning(f"Failed to install coral in worktree: {result.stderr.strip()}")
+                raise RuntimeError(
+                    f"Failed to install coral into worktree venv at {worktree_path}: {result.stderr.strip()}"
+                )
```

**File**: `plugin/skills/creating-a-coral-task/SKILL.md` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ coral validate .          # bootstraps the grader venv, runs the grader on seed/
 ```python
 from coral.grader import TaskGrader
 
+
 class Grader(TaskGrader):
     def evaluate(self) -> float:
         result = self.run_program(self.args.get("program_file", "solution.py"))
```

**File**: `plugin/skills/creating-a-coral-task/references/cookbook.md` (modified, +12/-6)
```diff
@@ -41,10 +41,11 @@ Ship the tests under `grader.private` (so agents can't read them — list a dir
 import json, shutil
 from pathlib import Path
 
+
 def evaluate(self) -> float | ScoreBundle:
     tests = Path(self.private_dir) / "taskdata" / "test_hidden.py"
     dest = Path(self.codebase_path) / "test_hidden.py"
-    shutil.copy(tests, dest)   # codebase_path is force-removed after, so this is safe + temporary
+    shutil.copy(tests, dest)  # codebase_path is force-removed after, so this is safe + temporary
 
     # A tiny in-process pytest plugin counts pass/fail and prints JSON we parse back.
     out = self.run_script_json(
@@ -84,7 +85,9 @@ def evaluate(self) -> float | ScoreBundle:
         return self.fail("output incorrect — speed doesn't count until it's correct")
     baseline = float(self.args.get("baseline_seconds", 1.0))
     ratio = baseline / out["dt"]
-    return self.score(ratio, explanation=f"{ratio:.2f}× baseline ({out['dt']:.3f}s vs {baseline:.3f}s)")
+    return self.score(
+        ratio, explanation=f"{ratio:.2f}× baseline ({out['dt']:.3f}s vs {baseline:.3f}s)"
+    )
 ```
 
 The correctness gate is the important part: gate on correctness, *then* score the thing you're optimizing. Otherwise agents discover that `return 0` is very fast.
@@ -96,12 +99,13 @@ Return several named `Score`s plus one `aggregated` number. Each metric shows in
 ```python
 from coral.types import Score, ScoreBundle
 
+
 def evaluate(self) -> ScoreBundle:
     m = self.run_script_json("...emit {'acc':..,'latency_ms':..,'size_kb':..} ...")
     scores = {
-        "accuracy":   Score(value=m["acc"],            name="accuracy"),
-        "latency":    Score(value=1000.0 / m["latency_ms"], name="latency", explanation="1/sec"),
-        "compactness":Score(value=1.0 / m["size_kb"],   name="compactness"),
+        "accuracy": Score(value=m["acc"], name="accuracy"),
+        "latency": Score(value=1000.0 / m["latency_ms"], name="latency", explanation="1/sec"),
+        "compactness": Score(value=1.0 / m["size_kb"], name="compactness"),
     }
     weights = {"accuracy": 0.7, "latency": 0.2, "compactness": 0.1}
     aggregated = sum(scores[k].value * w for k, w in weights.items())
@@ -123,8 +127,9 @@ When the agent runs `coral eval --tune`, `self.tune` is `True` and the attempt *
 def describe_tune(self) -> str:
     return "Tune mode scores on a 500-example dev slice (≈10× faster); real evals use the full test set."
 
+
 def evaluate(self) -> float | ScoreBundle:
-    n = 500 if self.tune else None        # None = full set
+    n = 500 if self.tune else None  # None = full set
     acc = self._score_on(n_examples=n)
     label = "dev slice" if self.tune else "full test set"
     return self.score(acc, explanation=f"accuracy on {label}")
@@ -146,6 +151,7 @@ grader:
 
 ```python
 from pathlib import Path
+
 _TASKDATA = Path(self.private_dir) / "taskdata"
 ```
 
```

**File**: `plugin/skills/creating-a-coral-task/references/grader-api.md` (modified, +9/-6)
```diff
@@ -50,17 +50,20 @@ Always run the agent's program through these — they pick the right interpreter
 ```python
 @dataclass
 class Score:
-    value: float | int | None      # None when ungradeable (timeout, crash). Convert pass/fail to a float yourself.
-    name: str                       # "correctness", "efficiency", ...
+    value: (
+        float | int | None
+    )  # None when ungradeable (timeout, crash). Convert pass/fail to a float yourself.
+    name: str  # "correctness", "efficiency", ...
     explanation: str | None = None
     metadata: dict = field(default_factory=dict)
 
+
 @dataclass
 class ScoreBundle:
-    scores: dict[str, Score]        # name -> Score
-    aggregated: float | None = None # the single number used for ranking + plateau detection
-    is_public: bool = True          # False omits the per-score breakdown from public attempts
-    feedback: str | None = None     # message the agent reads
+    scores: dict[str, Score]  # name -> Score
+    aggregated: float | None = None  # the single number used for ranking + plateau detection
+    is_public: bool = True  # False omits the per-score breakdown from public attempts
+    feedback: str | None = None  # message the agent reads
     metadata: dict = field(default_factory=dict)
 ```
 
```

**File**: `tests/test_workspace.py` (modified, +38/-1)
```diff
@@ -305,7 +305,7 @@ def test_create_project_setup_runs_sequentially():
         assert result_file.read_text().strip() == "done"
 
 
-def test_setup_worktree_env_runs_even_when_venv_exists():
+def test_setup_worktree_env_runs_even_when_venv_exists(monkeypatch):
     """Verify setup commands run even if .venv/bin/python already exists."""
     with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
         worktree = Path(d) / "worktree"
@@ -316,6 +316,8 @@ def test_setup_worktree_env_runs_even_when_venv_exists():
         (venv_bin / "python").write_text("#!/bin/sh\nexit 0\n")
         (venv_bin / "python").chmod(0o755)
 
+        monkeypatch.setattr("shutil.which", lambda cmd: None)
+
         marker = worktree / "setup_ran.marker"
         setup_worktree_env(worktree, [f"touch {marker}"])
 
@@ -860,3 +862,38 @@ def test_create_project_user_skills_override_builtin():
         seeded = paths.coral_dir / "public" / "skills" / skill_name / "run.sh"
         assert seeded.is_file()
         assert "echo custom" in seeded.read_text()
+
+
+def test_setup_worktree_env_uv_pip_install_failure(monkeypatch):
+    """Verify that a non-zero exit code from uv pip install raises a RuntimeError."""
+    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
+        worktree = Path(d) / "worktree"
+        worktree.mkdir()
+
+        # Mock resolve_venv_python and shutil.which to pass presence checks
+        fake_python = worktree / ".venv" / "bin" / "python"
+        fake_python.parent.mkdir(parents=True)
+        fake_python.touch()
+
+        monkeypatch.setattr(
+            "coral.workspace.worktree.resolve_venv_python", lambda venv: fake_python
+        )
+        monkeypatch.setattr("shutil.which", lambda cmd: "/usr/bin/uv" if cmd == "uv" else None)
+
+        # Mock subprocess.run to simulate a failed 'uv pip install' call
+        real_run = subprocess.run
+
+        def mock_subprocess_run(cmd, *args, **kwargs):
+            if isinstance(cmd, list) and len(cmd) >= 3 and cmd[:3] == ["uv", "pip", "install"]:
+                return subprocess.CompletedProcess(
+                    args=cmd,
+                    returncode=1,
+                    stdout="",
+                    stderr="forced install failure",
+                )
+            return real_run(cmd, *args, **kwargs)
+
+        monkeypatch.setattr("subprocess.run", mock_subprocess_run)
+
+        with pytest.raises(RuntimeError, match="Failed to install coral into worktree venv"):
+            setup_worktree_env(worktree, ["echo setup"])
```

---

### Incident Patch 9: `35477c39` (2026-08-11)
**Commit Message**: fix: proper heartbeat config options parsing (#237)

* Fix heartbeat config options parsing

* Fix formatting

---------

Co-authored-by: danielezer <[REDACTED_EMAIL]>

**File**: `coral/config.py` (modified, +1/-0)
```diff
@@ -690,6 +690,7 @@ def _preprocess(data: dict[str, Any]) -> dict[str, Any]:
                 "is_global": h.get("global", False),
                 "trigger": h.get("trigger", "interval"),
                 "prompt": h.get("prompt", ""),
+                "options": h.get("options", {}),
             }
             for h in heartbeat_raw
         ]
```

**File**: `tests/test_config.py` (modified, +25/-0)
```diff
@@ -192,6 +192,31 @@ def test_heartbeat_global_flag_roundtrip():
     assert d["agents"]["heartbeat"][0]["global"] is True
 
 
+def test_heartbeat_plateau_options_survive_preprocess():
+    """Per-action `options` from task.yaml must reach HeartbeatAction.options."""
+    from coral.agent.heartbeat import parse_options
+
+    data = {
+        "task": {"name": "t", "description": "d"},
+        "agents": {
+            "heartbeat": [
+                {
+                    "name": "pivot",
+                    "every": 3,
+                    "trigger": "plateau",
+                    "options": {"epsilon": 0.005},
+                },
+            ]
+        },
+    }
+    config = CoralConfig.from_dict(data)
+    action = next(h for h in config.agents.heartbeat if h.name == "pivot")
+    assert action.options == {"epsilon": 0.005}
+
+    # And it must survive the validation/parse step the runner actually uses.
+    assert parse_options(action.trigger, action.options).epsilon == 0.005
+
+
 def test_run_config_defaults():
     config = CoralConfig(
         task=TaskConfig(name="t", description="d"),
```

---

### Incident Patch 10: `2cabff4c` (2026-08-11)
**Commit Message**: fix(workspace): optimize worktree setup and add cross-platform venv support (#236)

* fix: separate worktree provisioning from agent launch

* fix(agent): separate worktree setup from manager restart lifecycle

* fix(workspace): ensure worktree setup re-runs on failed provisioning

**File**: `coral/agent/manager.py` (modified, +36/-17)
```diff
@@ -101,6 +101,7 @@ def __init__(
         verbose: bool = False,
         config_dir: Path | None = None,
     ) -> None:
+        """Initialize the AgentManager with configuration and state tracking structures."""
         self.config = config
         self.config_dir = config_dir
         # Resolve concrete per-agent specs, then (when multi-island) partition them
@@ -443,6 +444,7 @@ def _start_sandbox_if_enabled(self) -> None:
             print(f"[coral] Sandbox provider {sb.provider!r} active")
 
     def _stop_sandbox(self) -> None:
+        """Stop the active sandbox provider if instantiated."""
         if self._sandbox is not None:
             self._sandbox.stop()
             self._sandbox = None
@@ -560,24 +562,36 @@ def _setup_and_start_agent(
         if island_id is not None:
             self._agent_island[agent_id] = island_id
 
-        # Create worktree (idempotent)
-        logger.info(f"Setting up {agent_id}...")
-        worktree_path = create_agent_worktree(
-            self.paths.repo_dir,
-            agent_id,
-            self.paths.agents_dir,
-        )
-        logger.info(f"  Worktree: {worktree_path}")
+        # Phase 1: One-time worktree provisioning.
+        # Create worktree and run workspace setup commands (uv sync, etc.)
+        # only if the readiness marker (.coral_agent_id) is not yet present.
+        worktree_path = self.paths.agents_dir / agent_id
+        already_provisioned = (worktree_path / ".coral_agent_id").exists()
 
-        # Ignore CORAL files via the repo's shared info/exclude (reset-proof)
-        setup_git_exclude(worktree_path)
+        if not already_provisioned:
+            logger.info(f"Setting up {agent_id}...")
+            worktree_path = create_agent_worktree(
+                self.paths.repo_dir,
+                agent_id,
+                self.paths.agents_dir,
+            )
+            logger.info(f"  Worktree: {worktree_path}")
 
-        # Run setup commands (uv sync, etc.) and install coral in the worktree
-        setup_worktree_env(worktree_path, self.config.workspace.setup)
+            # Ignore CORAL files via the repo's shared info/exclude (reset-proof)
+            setup_git_exclude(worktree_path)
 
-        # Write .coral_dir breadcrumb (used by workspace guard hook)
-        write_coral_dir(worktree_path, self.paths.coral_dir)
+            # Run workspace.setup (uv sync, npm ci, etc.) ONCE during initial provisioning
+            setup_worktree_env(worktree_path, self.config.workspace.setup)
 
+            # Write .coral_dir breadcrumb (used by workspace guard hook)
+            write_coral_dir(worktree_path, self.paths.coral_dir)
+
+            # Write agent ID readiness breadcrumb to mark successful provisioning
+            write_agent_id(worktree_path, agent_id)
+        else:
+            logger.info(f"Re-using existing provisioned worktree for {agent_id}: {worktree_path}")
+
+        # Phase 2: Repeatable agent launch & runtime environment setup.
         # Set up shared state directory (notes, skills, attempts symlinks, plus
         # a symlink to the grader source so the agent can read how it's scored).
         shared_dir_name = runtime.shared_dir_name
@@ -662,9 +676,6 @@ def _setup_and_start_agent(
             )
             logger.info(f"  Seeded heartbeat config for {agent_id}")
 
-        # Write agent ID
-        write_agent_id(worktree_path, agent_id)
-
         # Seed the agent's role description (idempotent — preserves the
         # evolved role on resume). When ``runtime_options.role_file``
         # is set, the user-provided .md is copied as the gen-0 seed; otherwise
@@ -1270,6 +1281,7 @@ def _latest_finalized_real_attempt(self) -> Attempt | None:
     def _attempt_dict_for_auto_stop(
         self, attempt: Attempt | dict[str, Any] | None
     ) -> dict[str, Any]:
+        """Convert an attempt object or dictionary into a normalized auto-stop info map."""
         if attempt is None:
             return {
                 "attempt_id": None,
@@ -1292,6 +1304,7 @@ def _attempt_dict_for_auto_stop(
         }
 
     def _score_meets_auto_stop_threshold(self, score: float | int | None, threshold: float) -> bool:
+        """Check whether a score satisfies the auto-stop threshold given the optimization direction."""
         if score is None:
             return False
         value = float(score)
@@ -1368,6 +1381,7 @@ def _build_auto_stop_reason(
         attempt_info: dict[str, Any],
         real_attempt_count: int,
     ) -> dict[str, Any]:
+        """Construct a standardized dictionary detailing the auto-stop trigger reason."""
         stop_config = self.config.run.stop
         return {
             "reason": reason,
@@ -2009,10 +2023,12 @@ def _migration_block_reason(self, candidate: MigrationCandidate) -> str | None:
 
     @staticmethod
     def _migration_block_is_retriable(reason: str) -> bool:
+        """Return True if a migration block reason can be safely retried in subsequent cycles."""
```

**File**: `coral/workspace/worktree.py` (modified, +0/-12)
```diff
@@ -721,23 +721,11 @@ def setup_worktree_env(worktree_path: Path, setup_commands: list[str]) -> None:
 
     Each worktree gets its own isolated ``.venv`` via UV_PROJECT_ENVIRONMENT
     to prevent concurrent agents from corrupting a shared venv.
-
-    Idempotent: if the worktree's ``.venv`` is already populated (the python
-    binary exists), skip both the setup commands and the coral reinstall.
-    Deps don't change mid-run, so re-running ``uv sync`` on every
-    interrupt-and-resume cycle is wasted work. To force a re-sync, delete the
-    ``.venv`` directory before resuming.
     """
     if not setup_commands:
         return
 
-    # Force uv to create/use a venv inside this worktree, even if
-    # pyproject.toml is resolved from a parent directory.
     worktree_venv = worktree_path / ".venv"
-    venv_python = resolve_venv_python(worktree_venv)
-    if venv_python.exists():
-        logger.debug(f"Worktree venv already populated at {worktree_venv}, skipping setup commands")
-        return
 
     env_override = {"UV_PROJECT_ENVIRONMENT": str(worktree_venv)}
     run_setup_commands(setup_commands, worktree_path, extra_env=env_override)
```

**File**: `tests/test_workspace.py` (modified, +8/-12)
```diff
@@ -305,12 +305,8 @@ def test_create_project_setup_runs_sequentially():
         assert result_file.read_text().strip() == "done"
 
 
-def test_setup_worktree_env_skips_when_venv_exists():
-    """Idempotent: if .venv/bin/python already exists, setup is skipped.
-
-    Avoids re-running uv sync on every interrupt-and-resume cycle, which
-    can otherwise dominate restart latency.
-    """
+def test_setup_worktree_env_runs_even_when_venv_exists():
+    """Verify setup commands run even if .venv/bin/python already exists."""
     with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
         worktree = Path(d) / "worktree"
         worktree.mkdir()
@@ -320,11 +316,10 @@ def test_setup_worktree_env_skips_when_venv_exists():
         (venv_bin / "python").write_text("#!/bin/sh\nexit 0\n")
         (venv_bin / "python").chmod(0o755)
 
-        # If setup ran, this would create the marker file
         marker = worktree / "setup_ran.marker"
         setup_worktree_env(worktree, [f"touch {marker}"])
 
-        assert not marker.exists(), "Setup should have been skipped"
+        assert marker.exists(), "Setup commands should run even when .venv exists"
 
 
 def test_setup_worktree_env_runs_when_venv_missing():
@@ -849,10 +844,10 @@ def test_create_project_user_skills_override_builtin():
         _git_init(d)
         root = Path(d)
 
-        skill_name = "coral-workflow"
+        skill_name = "test-skill"
         skill_dir = root / "skills" / skill_name
         skill_dir.mkdir(parents=True)
-        (skill_dir / "custom.txt").write_text("user version")
+        (skill_dir / "run.sh").write_text("#!/bin/bash\necho custom")
 
         config = CoralConfig(
             task=TaskConfig(name="Test Task", description="Test task"),
@@ -862,5 +857,6 @@ def test_create_project_user_skills_override_builtin():
         )
         paths = create_project(config, config_dir=root)
 
-        dst = paths.coral_dir / "public" / "skills" / skill_name
-        assert (dst / "custom.txt").read_text() == "user version"
+        seeded = paths.coral_dir / "public" / "skills" / skill_name / "run.sh"
+        assert seeded.is_file()
+        assert "echo custom" in seeded.read_text()
```

---

### Incident Patch 11: `8d8b120f` (2026-08-09)
**Commit Message**: fix: resolve virtualenv executable paths cross-platform (#231)

* fix: resolve virtualenv executable paths cross-platform

Closes #228

Centralize bin/ vs Scripts/ and python vs python.exe resolution and use
it for agent PATH, worktree setup, grader interpreter, and CLI discovery.
POSIX paths unchanged; Windows uses Scripts/python.exe.

* fix: address review feedback for cross-platform venv paths

Sort coral.venv_paths imports with other first-party imports for ruff,
use platform-neutral PATH comments, and resolve grader venv python via
venv_python in tests.

---------

Co-authored-by: Zijian Zhou <[REDACTED_EMAIL]>
Co-authored-by: AshSgDe29071999 <[REDACTED_EMAIL]>

**File**: `coral/agent/builtin/claude_code.py` (modified, +3/-2)
```diff
@@ -24,6 +24,7 @@
     write_coral_log_entry,
 )
 from coral.sandbox.protocol import AgentSandboxSpec
+from coral.venv_paths import venv_bin_dir
 from coral.workspace.repo import _clean_env
 
 logger = logging.getLogger(__name__)
@@ -213,8 +214,8 @@ def start(
         # Set VIRTUAL_ENV so login shells (which reset PATH) can restore it
         # via /etc/profile.d/coral-venv.sh in Docker containers.
         agent_env["VIRTUAL_ENV"] = worktree_venv
-        # Prepend .venv/bin to PATH for non-login shells
-        venv_bin = str(worktree_path / ".venv" / "bin")
+        # Prepend the venv executable dir (bin or Scripts) to PATH for non-login shells
+        venv_bin = str(venv_bin_dir(worktree_path / ".venv"))
         agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         # Route through gateway if configured
```

**File**: `coral/agent/builtin/codex.py` (modified, +3/-2)
```diff
@@ -21,6 +21,7 @@
     write_coral_log_entry,
 )
 from coral.sandbox.protocol import AgentSandboxSpec
+from coral.venv_paths import venv_bin_dir
 from coral.workspace.repo import _clean_env
 
 logger = logging.getLogger(__name__)
@@ -177,8 +178,8 @@ def start(
         # Set VIRTUAL_ENV so login shells (which reset PATH) can restore it
         # via /etc/profile.d/coral-venv.sh in Docker containers.
         agent_env["VIRTUAL_ENV"] = worktree_venv
-        # Prepend .venv/bin to PATH for non-login shells
-        venv_bin = str(worktree_path / ".venv" / "bin")
+        # Prepend the venv executable dir (bin or Scripts) to PATH for non-login shells
+        venv_bin = str(venv_bin_dir(worktree_path / ".venv"))
         agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         # Route through gateway if configured
```

**File**: `coral/agent/builtin/cursor_agent.py` (modified, +2/-1)
```diff
@@ -33,6 +33,7 @@
     write_coral_log_entry,
 )
 from coral.sandbox.protocol import AgentSandboxSpec
+from coral.venv_paths import venv_bin_dir
 from coral.workspace.repo import _clean_env
 
 logger = logging.getLogger(__name__)
@@ -207,7 +208,7 @@ def start(
         worktree_venv = str(worktree_path / ".venv")
         agent_env["UV_PROJECT_ENVIRONMENT"] = worktree_venv
         agent_env["VIRTUAL_ENV"] = worktree_venv
-        venv_bin = str(worktree_path / ".venv" / "bin")
+        venv_bin = str(venv_bin_dir(worktree_path / ".venv"))
         agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         apply_sandbox_env(agent_env, sandbox)
```

**File**: `coral/agent/builtin/opencode.py` (modified, +3/-2)
```diff
@@ -21,6 +21,7 @@
     write_coral_log_entry,
 )
 from coral.sandbox.protocol import AgentSandboxSpec
+from coral.venv_paths import venv_bin_dir
 from coral.workspace.repo import _clean_env
 
 logger = logging.getLogger(__name__)
@@ -155,8 +156,8 @@ def start(
         # Set VIRTUAL_ENV so login shells (which reset PATH) can restore it
         # via /etc/profile.d/coral-venv.sh in Docker containers.
         agent_env["VIRTUAL_ENV"] = worktree_venv
-        # Prepend .venv/bin to PATH for non-login shells
-        venv_bin = str(worktree_path / ".venv" / "bin")
+        # Prepend the venv executable dir (bin or Scripts) to PATH for non-login shells
+        venv_bin = str(venv_bin_dir(worktree_path / ".venv"))
         agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         # Route through gateway if configured
```

**File**: `coral/agent/builtin/pi_agent.py` (modified, +2/-1)
```diff
@@ -16,6 +16,7 @@
 from coral.agent.exit_classifier import classify_by_uptime
 from coral.agent.process import open_agent_stderr_for_log_dir
 from coral.agent.runtime import AgentHandle, apply_run_as_user, write_coral_log_entry
+from coral.venv_paths import venv_bin_dir
 from coral.workspace.repo import _clean_env
 
 logger = logging.getLogger(__name__)
@@ -171,7 +172,7 @@ def start(
         worktree_venv = str(worktree_path / ".venv")
         agent_env["UV_PROJECT_ENVIRONMENT"] = worktree_venv
         agent_env["VIRTUAL_ENV"] = worktree_venv
-        venv_bin = str(worktree_path / ".venv" / "bin")
+        venv_bin = str(venv_bin_dir(worktree_path / ".venv"))
         agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         if gateway_url:
```

**File**: `coral/cli/start.py` (modified, +4/-3)
```diff
@@ -39,6 +39,7 @@
 )
 from coral.config import CoralConfig
 from coral.hub.auto_stop import read_auto_stop
+from coral.venv_paths import venv_python as resolve_venv_python
 from coral.workspace.project import slugify
 
 
@@ -57,9 +58,9 @@ def _resolved_python() -> str:
     # Look for a local .venv relative to the coral package
     coral_pkg = Path(__file__).resolve().parent.parent.parent
     for venv_name in (".venv", "venv"):
-        venv_python = coral_pkg / venv_name / "bin" / "python"
-        if venv_python.exists():
-            return str(venv_python)
+        candidate = resolve_venv_python(coral_pkg / venv_name)
+        if candidate.exists():
+            return str(candidate)
 
     # Fallback: current interpreter (absolute, but don't resolve symlinks)
     return os.path.abspath(sys.executable)
```

**File**: `coral/venv_paths.py` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+"""Platform-aware virtualenv path helpers (POSIX bin/ vs Windows Scripts/)."""
+
+from __future__ import annotations
+
+import sys
+from pathlib import Path
+
+
+def venv_bin_dir_name(*, windows: bool | None = None) -> str:
+    """Directory under a venv root that holds executables."""
+    if windows is None:
+        windows = sys.platform == "win32"
+    return "Scripts" if windows else "bin"
+
+
+def venv_python_name(*, windows: bool | None = None) -> str:
+    """Interpreter filename inside the venv bin directory."""
+    if windows is None:
+        windows = sys.platform == "win32"
+    return "python.exe" if windows else "python"
+
+
+def venv_bin_dir(venv_root: Path | str, *, windows: bool | None = None) -> Path:
+    return Path(venv_root) / venv_bin_dir_name(windows=windows)
+
+
+def venv_python(venv_root: Path | str, *, windows: bool | None = None) -> Path:
+    return venv_bin_dir(venv_root, windows=windows) / venv_python_name(windows=windows)
```

**File**: `coral/workspace/grader_env.py` (modified, +2/-1)
```diff
@@ -34,6 +34,7 @@
 from urllib.parse import urlparse
 
 from coral.config import GraderConfig
+from coral.venv_paths import venv_python
 from coral.workspace.repo import _clean_env, run_setup_commands
 
 logger = logging.getLogger(__name__)
@@ -104,7 +105,7 @@ def grader_venv_path(coral_dir: Path) -> Path:
 
 def grader_python_path(coral_dir: Path) -> Path:
     """Path to the Python interpreter inside the grader venv."""
-    return grader_venv_path(coral_dir) / "bin" / "python"
+    return venv_python(grader_venv_path(coral_dir))
 
 
 def setup_grader_env(
```

---

### Incident Patch 12: `0b6a8e7a` (2026-08-05)
**Commit Message**: fix: three cross-platform defects (process liveness, PATH separator, text encoding) (#226)

* fix: probe process liveness without os.kill(pid, 0)

`os.kill(pid, 0)` is a POSIX-only liveness probe. On Windows there is no
signal 0, so the call raises `OSError: [WinError 87] The parameter is
incorrect` for every PID, alive or not. Call sites only caught
`ProcessLookupError`/`PermissionError`, so `coral status`, `coral runs`,
`coral start`, `coral ui` and the dashboard `/api/status` endpoint all
crashed with a traceback instead of reporting a run as stopped.

Add `is_process_alive()` to `coral.cli._helpers`, next to the existing
`is_docker_run_alive()` liveness helper, and route every probe through it:

- POSIX keeps `os.kill(pid, 0)`, mapping `ProcessLookupError` to dead and
  `PermissionError` (process owned by another user) to alive.
- Windows opens a SYNCHRONIZE handle and waits on it with a zero timeout.
  The handle outlives the process, so the wait result — not the handle —
  decides liveness; `ERROR_ACCESS_DENIED` means alive.
- Non-positive PIDs are rejected, since `os.kill` reads 0 and negatives as
  process groups and a truncated `manager.pid` would otherwise report the
  ca

**File**: `coral/agent/builtin/claude_code.py` (modified, +11/-4)
```diff
@@ -4,6 +4,7 @@
 
 import json
 import logging
+import os
 import subprocess
 import sys
 import threading
@@ -35,7 +36,7 @@ def _extract_claude_code_session_id(log_path: Path) -> str | None:
     (system init, assistant messages, etc.) — scanning from the end.
     """
     try:
-        lines = log_path.read_text().strip().splitlines()
+        lines = log_path.read_text(encoding="utf-8").strip().splitlines()
         # First pass: look for a "result" line (most authoritative)
         for line in reversed(lines):
             line = line.strip()
@@ -148,7 +149,11 @@ def start(
     ) -> AgentHandle:
         """Start a Claude Code agent in the given worktree."""
         agent_id_file = worktree_path / ".coral_agent_id"
-        agent_id = agent_id_file.read_text().strip() if agent_id_file.exists() else "unknown"
+        agent_id = (
+            agent_id_file.read_text(encoding="utf-8").strip()
+            if agent_id_file.exists()
+            else "unknown"
+        )
 
         if log_dir is None:
             log_dir = worktree_path / ".claude" / "logs"
@@ -210,7 +215,7 @@ def start(
         agent_env["VIRTUAL_ENV"] = worktree_venv
         # Prepend .venv/bin to PATH for non-login shells
         venv_bin = str(worktree_path / ".venv" / "bin")
-        agent_env["PATH"] = venv_bin + ":" + agent_env.get("PATH", "")
+        agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         # Route through gateway if configured
         if gateway_url:
@@ -232,7 +237,9 @@ def start(
         # creds/session in the agent's home; returns Popen user=/group= kwargs.
         user_kwargs = apply_run_as_user(agent_env, run_as_user)
 
-        log_file = open(log_path, "w", buffering=1)  # line-buffered
+        log_file = open(
+            log_path, "w", buffering=1, encoding="utf-8", errors="replace"
+        )  # line-buffered
 
         # Open per-agent stderr capture under public/diagnostics/<agent_id>/agent.err
         # so stderr does not pollute the stream-json log. Falls back to STDOUT
```

**File**: `coral/agent/builtin/codex.py` (modified, +9/-4)
```diff
@@ -4,6 +4,7 @@
 
 import json
 import logging
+import os
 import subprocess
 import sys
 import threading
@@ -41,7 +42,7 @@ def _extract_codex_session_id(log_path: Path) -> str | None:
     silently starting a fresh one.
     """
     try:
-        lines = log_path.read_text().strip().splitlines()
+        lines = log_path.read_text(encoding="utf-8").strip().splitlines()
         for line in reversed(lines):
             line = line.strip()
             if not line:
@@ -116,7 +117,11 @@ def start(
         Resume uses `codex exec resume <session_id> "prompt"`.
         """
         agent_id_file = worktree_path / ".coral_agent_id"
-        agent_id = agent_id_file.read_text().strip() if agent_id_file.exists() else "unknown"
+        agent_id = (
+            agent_id_file.read_text(encoding="utf-8").strip()
+            if agent_id_file.exists()
+            else "unknown"
+        )
 
         if log_dir is None:
             log_dir = worktree_path / ".codex" / "logs"
@@ -174,7 +179,7 @@ def start(
         agent_env["VIRTUAL_ENV"] = worktree_venv
         # Prepend .venv/bin to PATH for non-login shells
         venv_bin = str(worktree_path / ".venv" / "bin")
-        agent_env["PATH"] = venv_bin + ":" + agent_env.get("PATH", "")
+        agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         # Route through gateway if configured
         if gateway_url:
@@ -190,7 +195,7 @@ def start(
         # in the agent's home; returns Popen user=/group= kwargs.
         user_kwargs = apply_run_as_user(agent_env, run_as_user)
 
-        log_file = open(log_path, "w", buffering=1)
+        log_file = open(log_path, "w", buffering=1, encoding="utf-8", errors="replace")
 
         # Per-agent stderr capture under public/diagnostics/<agent_id>/agent.err.
         err_path: Path | None = None
```

**File**: `coral/agent/builtin/cursor_agent.py` (modified, +9/-4)
```diff
@@ -16,6 +16,7 @@
 
 import json
 import logging
+import os
 import subprocess
 import sys
 import threading
@@ -55,7 +56,7 @@ def _extract_cursor_session_id(log_path: Path) -> str | None:
     re-emit init), falling back to any line carrying a `session_id`.
     """
     try:
-        lines = log_path.read_text().strip().splitlines()
+        lines = log_path.read_text(encoding="utf-8").strip().splitlines()
         for line in reversed(lines):
             line = line.strip()
             if not line:
@@ -143,7 +144,11 @@ def start(
         sandbox: AgentSandboxSpec | None = None,
     ) -> AgentHandle:
         agent_id_file = worktree_path / ".coral_agent_id"
-        agent_id = agent_id_file.read_text().strip() if agent_id_file.exists() else "unknown"
+        agent_id = (
+            agent_id_file.read_text(encoding="utf-8").strip()
+            if agent_id_file.exists()
+            else "unknown"
+        )
 
         if log_dir is None:
             log_dir = worktree_path / ".cursor" / "logs"
@@ -203,7 +208,7 @@ def start(
         agent_env["UV_PROJECT_ENVIRONMENT"] = worktree_venv
         agent_env["VIRTUAL_ENV"] = worktree_venv
         venv_bin = str(worktree_path / ".venv" / "bin")
-        agent_env["PATH"] = venv_bin + ":" + agent_env.get("PATH", "")
+        agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         apply_sandbox_env(agent_env, sandbox)
 
@@ -212,7 +217,7 @@ def start(
         # its creds in the agent's home; returns Popen user=/group= kwargs.
         user_kwargs = apply_run_as_user(agent_env, run_as_user)
 
-        log_file = open(log_path, "w", buffering=1)
+        log_file = open(log_path, "w", buffering=1, encoding="utf-8", errors="replace")
 
         err_path: Path | None = None
         err_file: Any = None
```

**File**: `coral/agent/builtin/kiro.py` (modified, +6/-2)
```diff
@@ -76,7 +76,11 @@ def start(
         sandbox: AgentSandboxSpec | None = None,
     ) -> AgentHandle:
         agent_id_file = worktree_path / ".coral_agent_id"
-        agent_id = agent_id_file.read_text().strip() if agent_id_file.exists() else "unknown"
+        agent_id = (
+            agent_id_file.read_text(encoding="utf-8").strip()
+            if agent_id_file.exists()
+            else "unknown"
+        )
 
         if log_dir is None:
             log_dir = worktree_path / ".kiro" / "logs"
@@ -113,7 +117,7 @@ def start(
         # its creds in the agent's home; returns Popen user=/group= kwargs.
         user_kwargs = apply_run_as_user(agent_env, run_as_user)
 
-        log_file = open(log_path, "w", buffering=1)
+        log_file = open(log_path, "w", buffering=1, encoding="utf-8", errors="replace")
 
         # Per-agent stderr capture under public/diagnostics/<agent_id>/agent.err.
         err_path: Path | None = None
```

**File**: `coral/agent/builtin/opencode.py` (modified, +9/-4)
```diff
@@ -4,6 +4,7 @@
 
 import json
 import logging
+import os
 import subprocess
 import sys
 import threading
@@ -32,7 +33,7 @@ def _extract_opencode_session_id(log_path: Path) -> str | None:
     in events with a "session_id" or "sessionId" field.
     """
     try:
-        lines = log_path.read_text().strip().splitlines()
+        lines = log_path.read_text(encoding="utf-8").strip().splitlines()
         for line in reversed(lines):
             line = line.strip()
             if not line:
@@ -103,7 +104,11 @@ def start(
     ) -> AgentHandle:
         """Start an OpenCode agent in the given worktree."""
         agent_id_file = worktree_path / ".coral_agent_id"
-        agent_id = agent_id_file.read_text().strip() if agent_id_file.exists() else "unknown"
+        agent_id = (
+            agent_id_file.read_text(encoding="utf-8").strip()
+            if agent_id_file.exists()
+            else "unknown"
+        )
 
         if log_dir is None:
             log_dir = worktree_path / ".opencode" / "logs"
@@ -152,7 +157,7 @@ def start(
         agent_env["VIRTUAL_ENV"] = worktree_venv
         # Prepend .venv/bin to PATH for non-login shells
         venv_bin = str(worktree_path / ".venv" / "bin")
-        agent_env["PATH"] = venv_bin + ":" + agent_env.get("PATH", "")
+        agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         # Route through gateway if configured
         if gateway_url:
@@ -168,7 +173,7 @@ def start(
         # its creds in the agent's home; returns Popen user=/group= kwargs.
         user_kwargs = apply_run_as_user(agent_env, run_as_user)
 
-        log_file = open(log_path, "w", buffering=1)
+        log_file = open(log_path, "w", buffering=1, encoding="utf-8", errors="replace")
 
         # Per-agent stderr capture under public/diagnostics/<agent_id>/agent.err.
         err_path: Path | None = None
```

**File**: `coral/agent/builtin/pi_agent.py` (modified, +9/-4)
```diff
@@ -6,6 +6,7 @@
 
 import json
 import logging
+import os
 import subprocess
 import sys
 import threading
@@ -25,7 +26,7 @@
 def _extract_pi_session_id(log_path: Path) -> str | None:
     """Extract a Pi session ID from JSON output."""
     try:
-        lines = log_path.read_text().strip().splitlines()
+        lines = log_path.read_text(encoding="utf-8").strip().splitlines()
         for line in lines:
             line = line.strip()
             if not line:
@@ -117,7 +118,11 @@ def start(
     ) -> AgentHandle:
         """Start a Pi agent in the given worktree."""
         agent_id_file = worktree_path / ".coral_agent_id"
-        agent_id = agent_id_file.read_text().strip() if agent_id_file.exists() else "unknown"
+        agent_id = (
+            agent_id_file.read_text(encoding="utf-8").strip()
+            if agent_id_file.exists()
+            else "unknown"
+        )
 
         if log_dir is None:
             log_dir = worktree_path / ".pi" / "logs"
@@ -167,7 +172,7 @@ def start(
         agent_env["UV_PROJECT_ENVIRONMENT"] = worktree_venv
         agent_env["VIRTUAL_ENV"] = worktree_venv
         venv_bin = str(worktree_path / ".venv" / "bin")
-        agent_env["PATH"] = venv_bin + ":" + agent_env.get("PATH", "")
+        agent_env["PATH"] = venv_bin + os.pathsep + agent_env.get("PATH", "")
 
         if gateway_url:
             agent_env["OPENAI_BASE_URL"] = gateway_url
@@ -180,7 +185,7 @@ def start(
         # its creds in the agent's home; returns Popen user=/group= kwargs.
         user_kwargs = apply_run_as_user(agent_env, run_as_user)
 
-        log_file = open(log_path, "w", buffering=1)
+        log_file = open(log_path, "w", buffering=1, encoding="utf-8", errors="replace")
 
         err_path: Path | None = None
         err_file: Any = None
```

**File**: `coral/agent/exit_classifier.py` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ def claude_code_log_has_session_error(log_path: Path) -> bool:
     the runtime classifier does not have to reach back into `manager.py`.
     """
     try:
-        content = log_path.read_text()
+        content = log_path.read_text(encoding="utf-8")
         return "No conversation found" in content
     except (OSError, UnicodeDecodeError):
         return False
```

**File**: `coral/agent/manager.py` (modified, +24/-22)
```diff
@@ -312,7 +312,7 @@ def _start_grader_daemon(self) -> None:
         pid_file = self.paths.coral_dir / "public" / "grader_daemon.pid"
         if pid_file.exists():
             try:
-                stale_pid = int(pid_file.read_text().strip())
+                stale_pid = int(pid_file.read_text(encoding="utf-8").strip())
                 os.kill(stale_pid, signal.SIGTERM)
                 logger.info(f"Killed stale grader daemon PID {stale_pid}")
             except (ValueError, ProcessLookupError, PermissionError, OSError):
@@ -336,7 +336,7 @@ def _start_grader_daemon(self) -> None:
         self._grader_proc = proc
         self._grader_stop_event = stop_event
         try:
-            pid_file.write_text(str(proc.pid))
+            pid_file.write_text(str(proc.pid), encoding="utf-8")
         except OSError:
             pass
         logger.info(f"Grader daemon started (PID {proc.pid})")
@@ -690,7 +690,7 @@ def _setup_and_start_agent(
             shared_dir=shared_dir_name,
             island_id=island_id,
         )
-        (worktree_path / instruction_file).write_text(coral_md)
+        (worktree_path / instruction_file).write_text(coral_md, encoding="utf-8")
 
         # OS-user isolation: chown agent-facing paths to the unprivileged user
         # and lock .coral/private/ to root, then run the agent subprocess as
@@ -962,7 +962,7 @@ def resume_all(
             island_id: str | None = None
             if island_bc.exists():
                 try:
-                    island_id = island_bc.read_text().strip() or None
+                    island_id = island_bc.read_text(encoding="utf-8").strip() or None
                 except OSError:
                     island_id = None
             # Track it so subsequent restarts can use it
@@ -1023,7 +1023,7 @@ def _save_sessions(self) -> None:
             if sid:
                 sessions[handle.agent_id] = sid
         sessions_file = self.paths.coral_dir / "public" / "sessions.json"
-        sessions_file.write_text(json.dumps(sessions, indent=2))
+        sessions_file.write_text(json.dumps(sessions, indent=2), encoding="utf-8")
         logger.info(f"Saved {len(sessions)} session ID(s) to sessions.json")
 
     def _load_saved_sessions(self) -> dict[str, str]:
@@ -1033,7 +1033,7 @@ def _load_saved_sessions(self) -> dict[str, str]:
         sessions_file = self.paths.coral_dir / "public" / "sessions.json"
         if sessions_file.exists():
             try:
-                return json.loads(sessions_file.read_text())
+                return json.loads(sessions_file.read_text(encoding="utf-8"))
             except (json.JSONDecodeError, OSError) as e:
                 logger.warning(f"Failed to read sessions.json: {e}")
         return {}
@@ -1155,7 +1155,7 @@ def _filter_scored(self, new_files: set[str]) -> set[str]:
             if path is None:
                 continue
             try:
-                data = json.loads(path.read_text())
+                data = json.loads(path.read_text(encoding="utf-8"))
             except (json.JSONDecodeError, OSError):
                 # Transient read (e.g. mid-rename on some filesystems) — retry next tick.
                 continue
@@ -1187,7 +1187,7 @@ def _read_latest_attempt(
                 # When filtering, we have to read each candidate to inspect
                 # its agent_id field; cache the parse so we do not re-read.
                 try:
-                    data = json.loads(path.read_text())
+                    data = json.loads(path.read_text(encoding="utf-8"))
                 except (json.JSONDecodeError, OSError) as e:
                     logger.warning(f"Failed to read attempt {path}: {e}")
                     continue
@@ -1204,7 +1204,7 @@ def _read_latest_attempt(
             return newest_data
         if newest_path is not None:
             try:
-                return json.loads(newest_path.read_text())
+                return json.loads(newest_path.read_text(encoding="utf-8"))
             except (json.JSONDecodeError, OSError) as e:
                 logger.warning(f"Failed to read attempt {newest_path}: {e}")
         return None
@@ -1220,7 +1220,7 @@ def _get_eval_count(self) -> int:
             counter_file = coral_dir / "public" / "eval_count"
         if counter_file.exists():
             try:
-                return int(counter_file.read_text().strip())
+                return int(counter_file.read_text(encoding="utf-8").strip())
             except ValueError:
                 pass
         return 0
@@ -2620,7 +2620,7 @@ def _kill_old_agent_processes(self) -> None:
             return
 
         pids = []
-        for line in agent_pids_file.read_text().strip().splitlines():
+        for line in agent_pids_file.read_text(encoding="utf-8").strip().splitlines():
             line = line.strip()
             if line:
                 pids.append(int(line))
@@ -2650,7 +2650,7 @@ def _kill_old_agent_processes(self) -> None:
     def _write_pid_file(self) -> None:
    
```

---

### Incident Patch 13: `0caace88` (2026-08-05)
**Commit Message**: fix: remove TYPE_CHECKING guards from sandbox modules (#221)

* ci: require dev as source for main PRs

* fix: remove TYPE_CHECKING guards from sandbox modules

Fixes #214

---------

Co-authored-by: Zijian Zhou <[REDACTED_EMAIL]>
Co-authored-by: Zijian Zhou <[REDACTED_EMAIL]>

**File**: `coral/sandbox/protocol.py` (modified, +2/-3)
```diff
@@ -28,10 +28,9 @@
 
 from dataclasses import dataclass, field
 from pathlib import Path
-from typing import TYPE_CHECKING, Protocol, runtime_checkable
+from typing import Protocol, runtime_checkable
 
-if TYPE_CHECKING:
-    from coral.config import AgentConfig
+from coral.config import AgentConfig
 
 
 @dataclass
```

**File**: `coral/sandbox/registry.py` (modified, +2/-4)
```diff
@@ -9,11 +9,9 @@
 from __future__ import annotations
 
 import importlib
-from typing import TYPE_CHECKING
 
-if TYPE_CHECKING:
-    from coral.config import SandboxConfig
-    from coral.sandbox.protocol import SandboxProvider
+from coral.config import SandboxConfig
+from coral.sandbox.protocol import SandboxProvider
 
 _BUILTIN: dict[str, str] = {
     "srt": "coral.sandbox.srt:SrtSandbox",
```

**File**: `coral/sandbox/srt.py` (modified, +2/-4)
```diff
@@ -44,13 +44,11 @@
 import sys
 import threading
 from pathlib import Path
-from typing import TYPE_CHECKING, Any
+from typing import Any
 
+from coral.config import AgentConfig, SandboxConfig
 from coral.sandbox.protocol import AgentSandboxContext, AgentSandboxSpec
 
-if TYPE_CHECKING:
-    from coral.config import AgentConfig, SandboxConfig
-
 logger = logging.getLogger(__name__)
 
 # srt overrides TMPDIR to this path inside the sandbox (unless
```

---

### Incident Patch 14: `10178459` (2026-08-04)
**Commit Message**: ci: require dev as source for main PRs (#213)

**File**: `.github/workflows/main-pr-source.yml` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+name: Main PR source guard
+
+on:
+  pull_request_target:
+    branches: [main]
+    types: [opened, synchronize, reopened, ready_for_review]
+
+permissions:
+  contents: read
+
+jobs:
+  require-dev-source:
+    name: Require dev source for main
+    runs-on: ubuntu-latest
+    steps:
+      - name: Verify pull request source
+        env:
+          BASE_REPOSITORY: ${{ github.event.pull_request.base.repo.full_name }}
+          HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}
+          HEAD_BRANCH: ${{ github.event.pull_request.head.ref }}
+        run: |
+          if [[ "$HEAD_REPOSITORY" != "$BASE_REPOSITORY" || "$HEAD_BRANCH" != "dev" ]]; then
+            echo "::error::Pull requests to main must come from this repository's dev branch."
+            echo "Received source: $HEAD_REPOSITORY:$HEAD_BRANCH"
+            exit 1
+          fi
+
+          echo "Accepted source: $HEAD_REPOSITORY:$HEAD_BRANCH"
```

---

### Incident Patch 15: `0e6cec4b` (2026-08-04)
**Commit Message**: Merge pull request #210 from Human-Agent-Society/policy/require-dev-source-for-main

ci: require dev as source for main PRs

**File**: `.github/workflows/main-pr-source.yml` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+name: Main PR source guard
+
+on:
+  pull_request_target:
+    branches: [main]
+    types: [opened, synchronize, reopened, ready_for_review]
+
+permissions:
+  contents: read
+
+jobs:
+  require-dev-source:
+    name: Require dev source for main
+    runs-on: ubuntu-latest
+    steps:
+      - name: Verify pull request source
+        env:
+          BASE_REPOSITORY: ${{ github.event.pull_request.base.repo.full_name }}
+          HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}
+          HEAD_BRANCH: ${{ github.event.pull_request.head.ref }}
+        run: |
+          if [[ "$HEAD_REPOSITORY" != "$BASE_REPOSITORY" || "$HEAD_BRANCH" != "dev" ]]; then
+            echo "::error::Pull requests to main must come from this repository's dev branch."
+            echo "Received source: $HEAD_REPOSITORY:$HEAD_BRANCH"
+            exit 1
+          fi
+
+          echo "Accepted source: $HEAD_REPOSITORY:$HEAD_BRANCH"
```

#### Recent Merged Pull Requests:
- **PR #275** (2026-09-08): feat(examples): port 35 public RSI-Exam research tasks (@BobbyZhouZijian)
- **PR #274** (2026-09-08): feat(notes): add evidence audits and unify agent guidance (@BobbyZhouZijian)
- **PR #273** (2026-09-08): fix(workspace): raise actionable error when uv is missing from PATH (@Xuan-1998)
- **PR #272** (2026-09-08): test(agent): make fake processes report an exited process (@Xuan-1998)
- **PR #271** (2026-09-08): fix(cli): probe the tmux session name through a patchable seam (@Xuan-1998)
- **PR #270** (2026-09-08): fix(agent): replace deprecated datetime.utcnow() in agent-state stamping (@Xuan-1998)
- **PR #269** (2026-09-06): chore: promote dev to main (@BobbyZhouZijian)
- **PR #268** (closed): ci: deploy Vercel previews on /ci run comment (@Xuan-1998)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
