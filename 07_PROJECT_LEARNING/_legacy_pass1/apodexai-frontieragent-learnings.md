# Forensic Learning Record (Deep Inspection): ApodexAI/FrontierAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/apodexai-frontieragent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ApodexAI/FrontierAgent](https://github.com/ApodexAI/FrontierAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:16:03.897Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ApodexAI/FrontierAgent`
- **Description**: 🧩 FrontierAgent, our agent framework, open-sourced alongside it — native command-line TUI, ReAct and Agent Team modes, one command on macOS and Linux, no preinstall, no hard Docker dependency.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4728 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apodex/__init__.py`
```
"""apodex — a Claude-Code-style local coding-agent TUI.

A terminal-native coding agent that runs against your **local working
directory**, reusing FrontierAgent's generic ReAct engine
(:func:`frontier_agent.core.runtime.loop.agent_loop.run_agent_loop`), its
local file/shell tools (``plugins.tools``), and its observer streaming
contract (``frontier_agent.core.loop_types``).

Design note — why not reuse ``workflows/swe`` directly: that workflow is
built for *SWE-bench* — it spins up a Docker/E2B sandbox, exposes only
``bash`` + ``submit_solution``, and emits a git-diff patch for scoring.
A local interactive coding experience (à la apodex_terminal) needs the
full Claude-Code tool surface (Bash/Read/Write/Edit/Grep/Glob) operating
on the user's real repo, with live streaming + per-edit approval. So we
reuse the *engine* (run_agent_loop + tools + observers) — the genuinely
reusable core — rather than the SWE-bench sandbox pipeline.

Run it from the FrontierAgent repo root so ``frontier_agent`` / ``plugins`` /
``workflows`` are importable::

    python -m apodex                 # interactive TUI in $PWD
    python -m apodex --cwd /path/to/repo
    python -m apodex --print "explain src/foo.py"   # one-shot
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "0.1.0"

```

### Core Architecture Module: `apodex/__main__.py`
```
"""Enables ``python -m apodex``."""

from __future__ import annotations

from apodex.cli import main

if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `apodex/agent_tools.py`
```
"""The local coding tool surface (Claude-Code parity) + risk classification.

All tools are FrontierAgent's existing ``plugins.tools`` LangChain tools,
passed straight to ``run_agent_loop(tools=...)``. We deliberately pick the
*local* file/shell tools (no E2B/sandbox, no web) so the agent works on
the user's real repository:

    bash · read_file · grep_search · glob_search ·
    file_editor_view / file_editor_create / file_editor_str_replace · write_file
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any

# Imported at module load (not per-call) so a transient import failure can't
# silently downgrade a denied command at risk-assessment time. ``None`` only
# if the whole tool module is unavailable (a broken install — loud elsewhere).
try:
    from plugins.tools.bash import assess_bash_command as _assess_bash_command
except Exception:  # pragma: no cover
    _assess_bash_command = None


def coding_tools() -> list[Any]:
    """Return the LangChain tool objects for the local coding agent.

    ``bash`` is our **local-cwd** bash (apodex.local_tools), not
    the shared ``plugins.tools.bash`` — the latter runs in an E2B/tempdir
    sandbox, on a different filesystem than the local file-edit tools.
    """
    from apodex.local_tools import (
        bash,
        delete_file,
        glob_search,
        grep_search,
        read_file,
    )
    from apodex.plan import exit_plan_mode
    from apodex.todo import todo_write
    from plugins.tools.file_editor import (
        file_editor_create,
        file_editor_str_replace,
        file_editor_view,
    )
    from plugins.tools.write_file import write_file

    return [
        bash,
        read_file,
        grep_search,
        glob_search,
        file_editor_view,
        file_editor_create,
        file_editor_str_replace,
        write_file,
        delete_file,
        todo_write,
        exit_plan_mode,
    ]


def research_tools() -> list[Any]:
    """Tools for the deep-research agent: web search/fetch + local compute.

    Uses our local ``bash`` (for ``python3 -c`` computation) instead of the
    shared ``run_python_code`` so it stays off the slow E2B/sandbox path.
    """
    from apodex.local_tools import bash, read_file
    from apodex.todo import todo_write
    from plugins.tools.web_fetch import web_fetch
    from plugins.tools.web_search import web_search

    return [web_search, web_fetch, bash, read_file, todo_write]


def terminal_tool_registry() -> dict[str, Any]:
    """Authoritative ``name -> tool`` map for what YAML profiles may request.

    The union of :func:`coding_tools` and :func:`research_tools` (LOCAL
    bash/read_file/etc — not the sandboxed ``plugins.tools`` variants; see
    ``coding_tools``), plus ``read_text`` so a skills-enabled profile can load
    full ``SKILL.md`` bodies (which live outside the workspace the local,
    path-gated ``read_file`` would refuse). Profiles resolve their ``tools:``
    list through this; an unknown name is a hard error at load time.
    """
    reg: dict[str, Any] = {}
    for t in (*coding_tools(), *research_tools()):
        name = getattr(t, "name", "")
        if name:
            reg.setdefault(name, t)
    try:  # optional — only needed by skills-enabled profiles
        from plugins.tools.read_text import read_text
        reg.setdefault("read_text", read_text)
    except Exception:  # pragma: no cover - broken install
        pass
    try:
        # In-process: it reads this run's own trajectory off the host, so the same
        # implementation serves the TUI and the sandboxed workflows unchanged.
        from plugins.tools.recover_result import recover_result
        reg.setdefault("recover_result", recover_result)
    except Exception:  # pragma: no cover - broken install
        pass
    return reg


# Tools that only read state / fetch / update the plan / manage tasks — never need approval.
# web_search/web_fetch are network reads; safe to auto-run like a local read.
_READ_ONLY = frozenset({
    "read_file", "grep_search", "glob_search", "file_editor_view", "todo_write",
    "web_search", "web_fetch", "read_text", "view_image", "recover_result",
    # Task board & planning built-ins
    "add_task", "update_task", "finish_planning",
    # Subagent & report workflow built-ins
    "create_subagent", "assign_task", "collect_reports", "stop_subagent",
    "submit_report", "finalize_answer",
})
# Tools that mutate the working tree — always confirmed (unless auto-approve)
# AND journaled (snapshot-before, so the change is diffable + revertable).
_WRITE_TOOLS = frozenset({
    "write_file", "file_editor_create", "file_editor_str_replace", "delete_file",
})
# Tools that write through the SANDBOX rather than the host cwd — the shipped
# react / agent_team workflows produce every deliverable with ``create_file``.
# They mutate state, so they must be confirmed with a visible target and locked
# by plan mode; they are deliberately outside _WRITE_TOOLS because their paths
# (``/outputs/report.docx``) legitimately live outside cwd, and the cwd deny
# there would refuse every deliverable.
_SANDBOX_WRITE_TOOLS = frozenset({"create_file", "download_file"})
# Public alias for the journal/observer layer. Only host-cwd writes can be
# snapshotted, so sandbox writes stay out (see the /revert help text).
MUTATING_TOOLS = _WRITE_TOOLS

# Risk levels, lowest → highest. The TUI gates anything above "safe".
RISK_SAFE = "safe"
RISK_CONFIRM = "confirm"
RISK_DENY = "deny"


@dataclass
class ToolRisk:
    level: str
    reason: str
    # Best-effort human-readable target (file path / command) for the prompt.
    target: str = ""
    # Non-empty label when the call is *destructive* (delete / dep-install /
    # dangerous shell). Unlike kimi's cosmetic red banner, this is wired into
    # the decision: the gate demands a deliberate typed confirmation.
    danger: str = ""


# Destructive patterns that warrant a SECOND (typed) confirmation, even though
# they're not auto-denied. Covers what kimi's table misses: dependency installs
# and destructive git. Matched against the full bash command string.
_DANGER_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\brm\s+(-\w*[rf]\w*|--recursive|--force)", re.I), "recursive/forced delete"),
    (re.compile(r"\bsudo\b", re.I), "sudo (root)"),
    (re.compile(r"\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|python\d?)\b", re.I), "pipe-to-shell"),
    (re.compile(r"\bdd\b[^|]*\bof=", re.I), "dd raw write"),
    (re.compile(r"\bmkfs\b", re.I), "mkfs (format)"),
    (re.compile(r">\s*/dev/(sd|nvme|disk|hd)", re.I), "write to raw device"),
    (re.compile(r"\bchmod\s+-?R?\s*0?777\b", re.I), "chmod 777"),
    (re.compile(r":\(\)\s*\{\s*:\|:&\s*\}", 0), "fork bomb"),
    (re.compile(r"\bgit\s+push\b[^|;&]*(--force\b|(?<!-)-f\b)", re.I), "git force-push"),
    (re.compile(r"\bgit\s+reset\s+--hard\b", re.I), "git reset --hard"),
    (re.compile(r"\bgit\s+clean\s+-\w*f", re.I), "git clean -f"),
    (re.compile(
        r"\b(pip3?|uv|npm|pnpm|yarn|poetry|conda|gem|cargo|go|apt|apt-get|brew)\b"
        r"[^|;&]*\b(install|add|sync)\b", re.I,
    ), "installs dependencies"),
]


def detect_danger(cmd: str) -> str:
    """Return a danger label if ``cmd`` matches a destructive pattern, else ''."""
    for pat, label in _DANGER_PATTERNS:
        if pat.search(cmd or ""):
            return label
    return ""


# Programs that only read/inspect — safe to auto-approve. Conservative
# allowlist (not a denylist): anything not here falls through to confirm.
_READONLY_CMDS = frozenset({
    "ls", "cat", "head", "tail", "wc", "find", "grep", "egrep", "fgrep", "rg",
    "tree", "pwd", "echo", "printf", "which", "type", "file", "stat", "du",
    "df", "printenv", "date", "whoami", "uname", "hostname", "id",
    "basename", "dirname", "realpath", "readlink", "uniq", "cut",
    "column", "tr", "nl", "tac", "diff", "cmp", "sha256sum", "md5sum",
    "ps", "
```

### Core Architecture Module: `apodex/attachments.py`
```
"""Session-scoped user attachments for the terminal client.

The harness writes copies through ``staging_dir`` while agents only receive
``agent_dir``.  Docker mounts the same host directory at those two locations:
read-write for the trusted TUI and read-only at ``/inputs`` for tools.
"""

from __future__ import annotations

import filecmp
import json
import os
import shutil
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Attachment:
    relative_path: str
    agent_path: str
    size: int


class AttachmentError(ValueError):
    """A user-facing attachment validation or copy error."""


class AttachmentManager:
    def __init__(self, cwd: str, session_id: str) -> None:
        # Relative /attach paths are user-facing workspace paths.  Resolve them
        # against the session's explicit --cwd instead of the process cwd,
        # which can differ in Docker, the TUI, and after an in-app /resume.
        self.set_source_root(cwd)
        # Keep copies outside the writable workspace. Otherwise Docker would
        # expose the same inode read-only at /inputs and read-write through
        # /workspace/.apodex/inputs, defeating the attachment boundary.
        configured_staging = os.environ.get("APODEX_INPUT_STAGING_DIR", "").strip()
        staging_root = os.environ.get("APODEX_INPUT_STAGING_ROOT", "").strip()
        configured_agent = os.environ.get("FRONTIER_AGENT_INPUTS_DIR", "").strip()
        agent_root = os.environ.get("FRONTIER_AGENT_INPUTS_ROOT", "").strip()

        from apodex.run_layout import pinned_mounts

        mounts_are_pinned = pinned_mounts()
        if mounts_are_pinned:
            # A jail bound the task's files at ``/inputs`` before this process
            # started, so the inherited alias IS the truth. Checked ahead of
            # every branch below because those all derive a session-scoped
            # directory instead, and ``Session`` then copies whatever we pick
            # back into ``FRONTIER_AGENT_INPUTS_DIR`` — pointing the read tools
            # at an empty directory while the real corpus sits on the mount.
            #
            # Both paths are kept exactly as the launcher declared them, not
            # ``resolve()``d: the mount point is the name every tool works in
            # (``resolve_runtime_path`` rewrites prefixes, it does not follow
            # links), so canonicalising it here would rename the namespace.
            self.agent_dir = Path(configured_agent or "/inputs").expanduser()
            self.staging_dir = Path(
                configured_staging or self.agent_dir
            ).expanduser()
        elif configured_staging:
            # The native Docker launcher mounts one already session-scoped host
            # directory at both paths, so its exact directory overrides win.
            self.staging_dir = Path(configured_staging).expanduser().resolve()
            self.agent_dir = Path(configured_agent or self.staging_dir)
        elif staging_root:
            # Compose cannot know the generated session id before the process
            # starts. Give it mount roots and scope both aliases here instead.
            self.staging_dir = (
                Path(staging_root).expanduser().resolve() / session_id
            )
            self.agent_dir = Path(agent_root or staging_root) / session_id
        else:
            # A local terminal session owns its private copies. Do not inherit
            # FRONTIER_AGENT_INPUTS_DIR: TerminalSession updates that variable
            # as sessions change in the same process.
            self.staging_dir = (
                Path.home() / ".apodex-inputs" / session_id
            ).expanduser().resolve()
            self.agent_dir = self.staging_dir
        if mounts_are_pinned:
            # Pinned paths are launcher-owned mount points, not directories for
            # the session to provision. Creating a missing path here masks a
            # broken mount with an empty local directory. Validate both aliases
            # because staging and agent paths may be configured separately.
            for label, path in (
                ("staging", self.staging_dir),
                ("agent", self.agent_dir),
            ):
                if not path.is_dir():
                    raise AttachmentError(
                        f"pinned input {label} directory does not exist: {path}"
                    )
        else:
            # Preserve the old fail-fast behavior for session-owned paths. Any
            # mkdir error here matters even when a later is_dir() probe happens
            # to succeed (for example an I/O or permission failure).
            self.staging_dir.mkdir(parents=True, exist_ok=True)

    def set_source_root(self, cwd: str) -> None:
        """Update the workspace used to resolve relative source paths."""
        self.source_root = Path(cwd).expanduser().resolve()

    def list(self) -> list[Attachment]:
        items: list[Attachment] = []
        try:
            paths = sorted(self.staging_dir.rglob("*"))
        except OSError as exc:
            raise AttachmentError(f"cannot list attachments: {exc}") from exc
        for path in paths:
            try:
                if not path.is_file() or path.is_symlink():
                    continue
                relative = path.relative_to(self.staging_dir).as_posix()
                items.append(Attachment(
                    relative_path=relative,
                    agent_path=(self.agent_dir / relative).as_posix(),
                    size=path.stat().st_size,
                ))
            except OSError:
                continue
        return items

    def attach_many(self, paths: Iterable[str]) -> list[Attachment]:
        added: list[Attachment] = []
        for raw in paths:
            added.extend(self.attach(raw))
        return added

    def attach(self, raw_path: str) -> list[Attachment]:
        source = Path(raw_path).expanduser()
        relative_source = not source.is_absolute()
        if relative_source:
            source = self.source_root / source
        if source.is_symlink():
            raise AttachmentError(f"symbolic links cannot be attached: {raw_path}")
        try:
            source = source.resolve(strict=True)
        except (OSError, RuntimeError) as exc:
            location = (
                f" (looked under {self.source_root})" if relative_source else ""
            )
            raise AttachmentError(f"file not found: {raw_path}{location}") from exc
        if relative_source and source != self.source_root and self.source_root not in source.parents:
            raise AttachmentError(
                f"relative attachment path escapes workspace {self.source_root}: {raw_path}"
            )
        if source == self.staging_dir or self.staging_dir in source.parents:
            return self.list()
        if source.is_file():
            existing = self.staging_dir / source.name
            try:
                if existing.is_file() and filecmp.cmp(source, existing, shallow=False):
                    return [self._attachment_for(existing)]
            except OSError:
                pass
            target = self._available_target(source.name)
            self._copy_file(source, target)
            return [self._attachment_for(target)]
        if source.is_dir():
            try:
                linked = next((path for path in source.rglob("*") if path.is_symlink()), None)
            except OSError as exc:
                raise AttachmentError(f"cannot inspect directory {raw_path}: {exc}") from exc
            if linked is not None:
                raise AttachmentError(
                    f"directories containing symbolic links cannot be attached: {linked}"
                )
            target = self._available_target(source.name)
            try:
                shutil.copytree(source, target, symlinks=False)
                self._normalize_tree_pe
```

### Core Architecture Module: `apodex/changes.py`
```
"""WorkspaceJournal — track file mutations so they are diffable and revertable.

A single session-lived object that snapshots a file's content the **first**
time a mutating tool touches it. From those originals it can, at any point,
report what changed (changed-files + diffstat), show a per-file diff, and
revert every change back to the session's starting state.

This is the one place that knows "what did the agent change", so it powers
three acceptance items at once: revert, the deterministic changed-files
summary, and treating ``delete_file`` as a first-class (revertable) op.
"""

from __future__ import annotations

import difflib
import os
import stat as stat_module
from dataclasses import dataclass, field

_SCAN_MAX_BYTES = 5 * 1024 * 1024
#: Ceiling on the text a single ``begin_tree_scan`` keeps in memory. The
#: baseline has to be captured *before* the command runs — once bash has
#: written, the old bytes are gone — so it cannot be made lazy. Past the
#: budget a file is snapshotted as opaque, which under-reports rather than
#: mis-attributing, and keeps a big monorepo from pinning gigabytes per call.
_SCAN_MAX_TOTAL_BYTES = 64 * 1024 * 1024
#: Ceiling on the baseline text a session state file carries. The scan budget
#: above is per tool phase and phases accumulate, so without this the state
#: file grows without limit and every save rewrites all of it.
_PERSIST_MAX_TOTAL_BYTES = 8 * 1024 * 1024
_SCAN_EXCLUDED_DIRS = frozenset({
    ".apodex", ".git", ".hg", ".mypy_cache", ".pytest_cache", ".ruff_cache",
    ".tox", ".venv", "__pycache__", "node_modules",
})
type _Fingerprint = tuple[int, int]
#: Stand-in fingerprint for "this path does not exist right now". Real files
#: always have a non-negative size, so it can never collide with one.
_ABSENT: _Fingerprint = (-1, -1)
#: ``path -> (fingerprint, text)``. The text is ``None`` when the file exists
#: but has no usable baseline (binary, oversized, unreadable, over budget).
#: Such files are still *listed*, so that "absent from the baseline" keeps its
#: one meaning: the path did not exist before the call.
type _TreeSnapshot = dict[str, tuple[_Fingerprint, str | None]]


def _read_or_none(path: str) -> str | None:
    """Current text content of ``path``, or ``None`` if it doesn't exist /
    can't be read as text (treated as 'absent' for snapshot purposes)."""
    try:
        if not os.path.isfile(path):
            return None
        with open(path, "rb") as fb:
            if b"\x00" in fb.read(8192):
                return None
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return None


def _read_small_text(path: str) -> str | None:
    """Read a scan candidate without retaining large or binary files."""
    try:
        if os.path.islink(path) or os.path.getsize(path) > _SCAN_MAX_BYTES:
            return None
        with open(path, "rb") as f:
            raw = f.read(_SCAN_MAX_BYTES + 1)
        if len(raw) > _SCAN_MAX_BYTES or b"\x00" in raw:
            return None
        return raw.decode("utf-8", errors="replace")
    except OSError:
        return None


def _fingerprint(path: str) -> _Fingerprint:
    """``(size, mtime_ns)`` for ``path``, or :data:`_ABSENT` if it is gone.

    Cheap enough to run over the whole journal on every UI tick, which is what
    lets :meth:`WorkspaceJournal.report` skip re-reading untouched files.
    """
    try:
        st = os.stat(path)
    except OSError:
        return _ABSENT
    return (st.st_size, st.st_mtime_ns)


def _walk_files(roots: list[str]) -> dict[str, _Fingerprint]:
    """Return every regular file below ``roots``, without following symlinks.

    Deliberately unfiltered by size: the *only* thing a missing entry may mean
    is "this path is gone". Dropping oversized files here would make a file
    that bash grew past the cap look deleted, and ``/revert`` would then
    truncate it back to the pre-command text.

    Paths are canonical without a per-file ``realpath``: each root is resolved
    once and symlinked directories are never descended into, so nothing below
    a root can reach it by a second name.
    """
    files: dict[str, _Fingerprint] = {}
    seen_roots: set[str] = set()
    for raw_root in roots:
        if not raw_root:
            continue
        root = os.path.realpath(raw_root)
        if root in seen_roots or not os.path.isdir(root):
            continue
        seen_roots.add(root)
        for directory, dirs, names in os.walk(root, followlinks=False):
            dirs[:] = [
                name for name in dirs
                if name not in _SCAN_EXCLUDED_DIRS
                and not os.path.islink(os.path.join(directory, name))
            ]
            for name in names:
                path = os.path.join(directory, name)
                try:
                    st = os.stat(path, follow_symlinks=False)
                except OSError:
                    continue
                # One lstat decides everything: symlinks, fifos and sockets are
                # not regular files and never carry a diffable baseline.
                if not stat_module.S_ISREG(st.st_mode):
                    continue
                files.setdefault(path, (st.st_size, st.st_mtime_ns))
    return files


@dataclass
class WorkspaceJournal:
    """Records pre-change snapshots of files the agent mutates under ``cwd``."""

    cwd: str
    # abspath -> content before the FIRST change this session (None = absent).
    _original: dict[str, str | None] = field(default_factory=dict)
    # Paths whose baseline came from a tree scan rather than from a tool that
    # named them. Shown in the diff, never written back by ``revert_all``:
    # a before/after scan cannot tell the shell's writes apart from anything
    # else that touched the tree in the same window — the user's own editor,
    # a watcher, a dev server — and reverting those would destroy work the
    # session never did.
    _observed: set[str] = field(default_factory=set)
    # abspath -> the content ``revert_all`` writes back, when that differs from
    # the diff baseline. Only scan-discovered paths that a later tool named get
    # an entry: the diff still starts from the scan baseline, but the revert
    # rewinds no further than the moment attribution began.
    _revert_base: dict[str, str | None] = field(default_factory=dict)
    # abspath -> (fingerprint, diffstat-or-None, chunk). Memoises ``report()``
    # so a 1 Hz poll re-reads only the files that actually moved.
    _diff_cache: dict[
        str, tuple[_Fingerprint, tuple[str, int, int] | None, str]
    ] = field(default_factory=dict, repr=False, compare=False)

    def _abs(self, path: str) -> str:
        p = path if os.path.isabs(path) else os.path.join(self.cwd, path)
        return os.path.realpath(p)

    def _rel(self, abspath: str) -> str:
        try:
            return os.path.relpath(abspath, os.path.realpath(self.cwd))
        except Exception:
            return abspath

    def record_before(self, path: str) -> None:
        """Snapshot ``path``'s current content the first time it's touched."""
        ap = self._abs(path)
        current = _read_or_none(ap)
        if current is None and os.path.lexists(ap):
            # Something is there, but it leaves no text baseline: a binary, an
            # unreadable file, a directory, a broken symlink. ``None`` means
            # "absent" everywhere else here, so journaling it would render a
            # pre-existing file as a create and have ``/revert`` delete it.
            # :meth:`finish_tree_scan` skips the same case for the same reason.
            return
        if ap not in self._original:
            self._original[ap] = current
            return
        if ap in self._observed:
            # A tool naming this path supplies the attribution ``_observed``
            # lacks — but only from *now* on. The scan baseline still describes
            # a window that
```

### Core Architecture Module: `apodex/cli.py`
```
"""``apodex`` command-line entry point.

Examples::

    python -m apodex                       # interactive TUI in $PWD
    python -m apodex --cwd /path/to/repo   # interactive in a repo
    python -m apodex -p "explain src/foo.py"   # one-shot, prints, exits
    python -m apodex --model qwen/qwen3.7-max --yes "add a CLI flag"
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import os
import sys
from collections.abc import MutableMapping
from typing import TYPE_CHECKING

from apodex import __version__
from apodex.profiles import get_profile, terminal_mode_names
from apodex.render import Renderer
from apodex.session import TerminalSession
from apodex.terminal import resolve_terminal_ui
from apodex.tui.themes import CLI_THEME_NAMES
from apodex.userenv import EnvResolution, load_environment

if TYPE_CHECKING:
    from apodex.config import ModelConfig


def _load_env() -> EnvResolution:
    """Load a ``.env`` (keys/base-url/model) from the launch directory or an
    ancestor, the way FrontierAgent's own entry points do, then the optional
    user env file underneath it. ``override=False`` so real environment
    variables and CLI flags always win. Must run **before** any ``chdir`` so it
    finds the repo's ``.env`` rather than the target repo, and before native
    mode rewrites ``HOME``/``XDG_CONFIG_HOME``, so the user file is read from
    the user's real config directory. See :mod:`apodex.userenv`.
    """
    return load_environment()


# (substring in an engine log message) -> clean one-line note to surface
_LOG_NOTES = (
    ("LeakedToolCallRetry", "⟳ the model wrote a tool call as text — retrying in the proper format"),
    ("leaked into <think>", "⟳ recovered a tool call from the model's thinking"),
    ("LLM reasoning runaway", "⟳ the model's reasoning ran long — recovering"),
)


class _EngineLogRouter(logging.Handler):
    """Keep the terminal UI clean. Engine code logs freely (e.g. the
    ``[LeakedToolCallRetry]`` warning); without this, Python's last-resort
    handler dumps those raw to stderr mid-UI. We write every record to a
    per-session file and surface only *recovery-class* warnings as a tidy note.
    """

    def __init__(
        self,
        renderer: object,
        file_handler: logging.Handler | None = None,
    ) -> None:
        super().__init__(level=logging.WARNING)
        self._r = renderer
        self._file = file_handler
        self.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s: %(message)s",
        ))

    def emit(self, record: logging.LogRecord) -> None:
        try:
            if self._file is not None:
                self._file.emit(record)
            else:
                from apodex.run_layout import run_dir

                path = run_dir(os.environ["APODEX_SESSION_ID"]) / "engine.log"
                with path.open("a", encoding="utf-8") as stream:
                    stream.write(self.format(record) + "\n")
        except Exception:
            pass
        try:
            msg = record.getMessage()
        except Exception:
            return
        for needle, note in _LOG_NOTES:
            if needle in msg:
                with contextlib.suppress(Exception):
                    self._r.note(note)  # pyright: ignore[reportAttributeAccessIssue]
                return


def _route_engine_logs(renderer: object, session_id: str) -> None:
    """Send engine logs (WARNING+) to the active run's ``engine.log`` and keep
    the console clean. Best-effort — logging setup must never break a run."""
    try:
        os.environ["APODEX_SESSION_ID"] = session_id
        root = logging.getLogger()
        root.setLevel(logging.WARNING)
        # Drop any console StreamHandlers (FileHandler is a subclass, but ours
        # lives inside the router, not on root) so engine logs don't also hit
        # stderr; our router owns WARNING+ from here on.
        root.handlers = [h for h in root.handlers
                         if not isinstance(h, logging.StreamHandler)]
        root.addHandler(_EngineLogRouter(renderer))
    except Exception:
        pass


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="frontier-agent",
        description="A terminal-native FrontierAgent workflow client.",
    )
    p.add_argument("task", nargs="?", default=None, help="task to run (optional)")
    p.add_argument(
        "--mode", default="react",
        help="workflow: react | agent_team (default: react)",
    )
    p.add_argument(
        "--resume", nargs="?", const="", default=None, metavar="SESSION_ID",
        help="resume a session by id; without an id, list saved sessions",
    )
    p.add_argument("--model", default=None, help="model id (defaults to $OPENAI_MODEL / $APODEX_MODEL)")
    p.add_argument("--cwd", default=None, help="working directory the agent operates in (default: current)")
    p.add_argument(
        "--input", action="append", default=[], metavar="PATH",
        help=(
            "attach a file or directory as a read-only task input; relative "
            "paths start at --cwd (repeatable)"
        ),
    )
    p.add_argument("--max-turns", type=int, default=None, help="max agent turns per task (default: profile's, else 50)")
    p.add_argument(
        "--max-tokens", type=int, default=None,
        help="max output tokens per LLM call (default: the profile's value)",
    )
    p.add_argument("-y", "--yes", action="store_true", help="auto-approve all tool calls (no confirmation prompts)")
    p.add_argument("-p", "--print", dest="one_shot", action="store_true", help="run TASK once, print the result, exit")
    p.add_argument("--plan", action="store_true", help="start in plan mode: investigate + propose a plan; edits locked until you approve it")
    p.add_argument(
        "--theme", default="catppuccin", choices=CLI_THEME_NAMES,
        help="color theme; mono uses line mode (default: catppuccin)",
    )
    p.add_argument("--no-color", action="store_true", help="disable colored output (same as --theme mono)")
    p.add_argument("--no-tui", action="store_true", help="use the plain line-mode UI instead of the full-screen TUI")
    p.add_argument("--docker", action="store_true", help="require the whole CLI to run inside a container")
    p.add_argument(
        "--native", action="store_true",
        help="use the workspace-local native runtime (the default on Linux)",
    )
    p.add_argument(
        "--bwrap", action="store_true",
        help="require a bubblewrap filesystem jail (Linux, explicit opt-in)",
    )
    p.add_argument("--no-sandbox", action="store_true", help="run commands directly on this machine, with no namespace (approval gate only)")
    p.add_argument("--version", action="version", version=f"FrontierAgent {__version__}")
    return p


def apply_model_overrides(
    cfg: ModelConfig,
    *,
    model: str | None = None,
    max_tokens: int | None = None,
    resumed_model: str | None = None,
) -> ModelConfig:
    """Layer CLI flags and a resumed session over the profile's LLM config.

    Mutates and returns *cfg* — the caller already owns a copy of the profile's
    config, because a session rewrites the model on ``/model``.

    ``--max-tokens`` is applied here rather than at the call site because it was
    previously parsed and then never read: a user who capped output tokens
    silently got the profile's value instead (32768 for the shipped profiles).
    An explicit ``--model`` outranks a resumed session's model, so a flag can
    still redirect ``--resume`` at a different endpoint.
    """
    if model:
        cfg.model = model
    elif resumed_model and resumed_model.strip():
        cfg.model = resumed_model.strip()
    if max_tokens is not None:
        cfg.max_tokens = max_tokens
    return cfg


def publish_model_overrides(
    cfg: ModelConfig, *, environ: MutableMapping[str, str] | None = None,
) -> None:
    """Republish the
```

### Core Architecture Module: `apodex/clipboard.py`
```
"""macOS clipboard capture and the Docker host bridge.

Terminal paste protocols carry text only.  On macOS the outer launcher reads
NSPasteboard on behalf of the containerized TUI, then feeds the existing
session attachment manager.  The HTTP bridge accepts no commands or output
paths and is protected by a per-process bearer token.
"""

from __future__ import annotations

import filecmp
import json
import os
import secrets
import subprocess
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from apodex.attachments import AttachmentManager

_BROKER_URL_ENV = "APODEX_CLIPBOARD_BROKER_URL"
_BROKER_TOKEN_ENV = "APODEX_CLIPBOARD_BROKER_TOKEN"
_MAX_REQUEST_BYTES = 256_000


class ClipboardError(RuntimeError):
    """A user-facing clipboard or bridge failure."""


@dataclass(frozen=True)
class ClipboardPaste:
    kind: str
    attachments: tuple[str, ...] = ()
    text: str = ""
    message: str = ""


_JXA_READ_PASTEBOARD = r"""
ObjC.import('AppKit');
ObjC.import('Foundation');

function unwrap(value) {
    if (!value) return '';
    return ObjC.unwrap(value);
}

function run(argv) {
    const pb = $.NSPasteboard.generalPasteboard;
    const items = pb.pasteboardItems;
    const paths = [];
    if (items) {
        for (let i = 0; i < items.count; i++) {
            const raw = items.objectAtIndex(i).stringForType('public.file-url');
            if (!raw) continue;
            const url = $.NSURL.URLWithString(raw);
            if (url && url.isFileURL) paths.push(unwrap(url.path));
        }
    }
    if (paths.length) return JSON.stringify({kind: 'paths', paths: paths});

    const imageTypes = [
        ['public.png', 'png'],
        ['public.jpeg', 'jpg'],
        ['public.tiff', 'tiff']
    ];
    for (const pair of imageTypes) {
        const data = pb.dataForType(pair[0]);
        if (!data || data.length === 0) continue;
        const name = 'clipboard-' + Date.now() + '.' + pair[1];
        const path = $(argv[0]).stringByAppendingPathComponent(name);
        const written = $.NSFileManager.defaultManager
            .createFileAtPathContentsAttributes(path, data, $.NSDictionary.dictionary);
        if (!written) {
            return JSON.stringify({kind: 'error', message: 'could not save clipboard image'});
        }
        return JSON.stringify({kind: 'image', path: unwrap(path)});
    }

    let text = unwrap(pb.stringForType('public.utf8-plain-text'));
    if (!text) text = unwrap(pb.stringForType('public.plain-text'));
    return JSON.stringify(text ? {kind: 'text', text: text} : {kind: 'empty'});
}
"""


def _read_macos_pasteboard(temp_dir: str) -> dict[str, Any]:
    if sys.platform != "darwin":
        raise ClipboardError("clipboard attachments are currently supported on macOS only")
    try:
        result = subprocess.run(
            [
                "/usr/bin/osascript", "-l", "JavaScript",
                "-e", _JXA_READ_PASTEBOARD, temp_dir,
            ],
            capture_output=True, text=True, timeout=15,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ClipboardError(f"could not read the macOS clipboard: {exc}") from exc
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "osascript failed").strip()
        raise ClipboardError(f"could not read the macOS clipboard: {detail}")
    try:
        payload = json.loads(result.stdout.strip())
    except (json.JSONDecodeError, TypeError) as exc:
        raise ClipboardError("macOS clipboard returned an invalid response") from exc
    if not isinstance(payload, dict):
        raise ClipboardError("macOS clipboard returned an invalid response")
    return payload


def _looks_like_file_urls(text: str) -> bool:
    """Report whether every non-blank line is a ``file://`` URL, without touching disk.

    Used where the text is untrusted and must not be resolved: a purely textual
    check leaks nothing about which host paths exist.
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return bool(lines) and all(line.startswith("file://") for line in lines)


def _path_text(text: str) -> list[str] | None:
    """Return local paths represented by explicit ``file://`` URLs.

    Plain absolute-path text is deliberately not promoted to an attachment:
    copied webpage or chat content must not be able to make the client stage a
    readable host file merely because its text happens to name one.

    Only ever called on input the local user produced — a real pasteboard read,
    or a paste into a TUI running natively on the host. Text arriving over the
    broker is container-controlled and must not reach this function; see
    ``_broker_text_paste``.
    """
    raw = text.strip()
    if not raw:
        return None
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if not lines or not all(line.startswith("file://") for line in lines):
        return None
    candidates: list[str] = []
    for line in lines:
        parsed = urlparse(line)
        if parsed.scheme != "file" or parsed.netloc not in {"", "localhost"}:
            return None
        candidates.append(unquote(parsed.path))
    resolved: list[str] = []
    for candidate in candidates:
        path = Path(candidate).expanduser()
        if not path.is_absolute() or not path.exists():
            return None
        resolved.append(str(path.resolve()))
    return resolved


def capture_macos_clipboard(
    manager: AttachmentManager, *, pasted_text: str | None = None,
) -> ClipboardPaste:
    """Capture Finder files, an image, a path string, or ordinary text.

    ``pasted_text`` is trusted here: the only callers are the local user's own
    paste, either natively or via the broker's pasteboard read. The broker's
    request path deliberately does not route request text through this function.
    """
    if pasted_text is not None:
        paths = _path_text(pasted_text)
        if paths is None:
            return ClipboardPaste("text", text=pasted_text)
        added = manager.attach_many(paths)
        return ClipboardPaste("attachments", tuple(item.relative_path for item in added))

    with tempfile.TemporaryDirectory(prefix="apodex-clipboard-") as temp_dir:
        payload = _read_macos_pasteboard(temp_dir)
        kind = str(payload.get("kind") or "")
        if kind == "paths":
            raw_paths = payload.get("paths")
            if not isinstance(raw_paths, list) or not all(isinstance(p, str) for p in raw_paths):
                raise ClipboardError("macOS clipboard returned invalid file paths")
            added = manager.attach_many(raw_paths)
            return ClipboardPaste("attachments", tuple(item.relative_path for item in added))
        if kind == "image":
            raw_path = str(payload.get("path") or "")
            image = Path(raw_path).resolve()
            temp_root = Path(temp_dir).resolve()
            if temp_root not in image.parents or not image.is_file():
                raise ClipboardError("macOS clipboard returned an invalid image")
            for item in manager.list():
                name = Path(item.relative_path).name
                staged = manager.staging_dir / item.relative_path
                try:
                    if name.startswith("clipboard-") and filecmp.cmp(
                        image, staged, shallow=False,
                    ):
                        return ClipboardPaste("attachments", (item.relative_path,))
                except OSError:
                    continue
            added = manager.attach(str(image))
            return ClipboardPaste("attachments", tuple(item.relative_path for item in added))
        if kind == "text":
            text = str(payload.get("text") or "")
            paths = _path_text
```

### Core Architecture Module: `apodex/config.py`
```
"""LLM connection + sampling settings for the terminal agent.

``ModelConfig`` is the resolved LLM config a session runs with. It is built
by the YAML profile loader (:mod:`apodex.profiles`), which pulls
model/base_url/limits from a profile and secrets (``${OPENAI_API_KEY}`` …)
from ``.env`` — either via ``config/providers.yaml`` (``llm.provider:``) or
explicit ``${VAR}`` refs. Secrets live only in ``.env``; everything else
lives in the profile YAML.
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

if TYPE_CHECKING:
    from apodex.profiles import AgentProfile


@dataclass
class ModelConfig:
    """LLM connection + sampling settings for the coding agent."""

    model: str
    api_key: str
    base_url: str | None
    temperature: float = 0.0
    # Nucleus / top-k sampling. ``None`` leaves the server's own default, which
    # is what every profile got before these existed. Neither is a
    # Chat-Completions parameter on ``OpenAIClient``, so ``build_llm`` sends both
    # through ``extra_body`` (vLLM / SGLang read them there).
    #
    # They only mean anything once ``temperature`` is off 0: at 0 SGLang takes
    # the argmax path and does no probabilistic sampling, so both are inert.
    top_p: float | None = None
    top_k: int | None = None
    max_tokens: int = 8192
    # Model context window (tokens) — drives the context-fill indicator and the
    # compaction limit. Override with $OPENAI_CONTEXT_WINDOW for big/small models.
    context_window: int = 128_000

    @property
    def redacted_key(self) -> str:
        k = self.api_key or ""
        if len(k) <= 8:
            return "***" if k else "(none)"
        return f"{k[:4]}…{k[-4:]}"


@dataclass(frozen=True)
class RuntimeConfigIssue:
    """One secret-free runtime configuration finding."""

    code: str
    message: str
    env_var: str | None = None
    blocking: bool = True


@dataclass(frozen=True)
class RuntimeConfigStatus:
    """A safe, immutable view of resolved runtime configuration.

    It intentionally has no API-key or raw-URL field. This makes the object
    safe to pass to line-mode renderers, the TUI, logs, and screenshots.
    """

    mode: str
    profile_name: str
    profile_path: str
    provider: str
    model: str
    endpoint_host: str | None
    api_key_env: str | None
    api_key_configured: bool
    issues: tuple[RuntimeConfigIssue, ...] = ()

    @property
    def errors(self) -> tuple[RuntimeConfigIssue, ...]:
        return tuple(issue for issue in self.issues if issue.blocking)

    @property
    def warnings(self) -> tuple[RuntimeConfigIssue, ...]:
        return tuple(issue for issue in self.issues if not issue.blocking)

    @property
    def ok(self) -> bool:
        return not self.errors


_UNRESOLVED_ENV_RE = re.compile(r"\$(?:\{|[A-Z_])")


# Tools a closed-book run never binds. Named once here so the preflight cannot
# disagree with the runtime lists in ``workflows/stateful_react_agent/__init__.py``
# and ``workflows/agent_team/__init__.py`` (both define the same frozenset as
# ``WEB_TOOL_NAMES``) or with the profile-override filtering in
# ``workflows/*/nodes/main_agent.py``.
CLOSED_BOOK_WEB_TOOLS = frozenset({"web_search", "web_fetch", "download_file"})

# Native workflow → the env flag that puts it in closed-book mode at runtime.
_WORKFLOW_CLOSED_BOOK_ENV = {
    "stateful-react-agent": "REACT_NO_WEB",
    "agent_team": "SWARM_NO_WEB",
}
# Terminal mode → same flag (``inspect_runtime_config`` knows both the profile's
# ``workflow`` and the active ``mode``; either one identifies the workflow).
_MODE_CLOSED_BOOK_ENV = {
    "react": "REACT_NO_WEB",
    "agent_team": "SWARM_NO_WEB",
}

_CLOSED_BOOK_TRUTHY = ("1", "true", "yes", "on")


def _is_closed_book(
    *,
    workflow: str | None = None,
    mode: str | None = None,
    env: Mapping[str, str],
) -> bool:
    """Whether the run drops web tools before they are bound.

    Mirrors the runtime checks (``REACT_NO_WEB`` / ``SWARM_NO_WEB``); the
    ``.strip().lower()`` normalization matches ``nodes/main_agent.py``.
    Unknown workflows/modes never count as closed-book: the generic loop has
    no such gate, so its web tools still run.
    """
    candidates = set()
    if workflow in _WORKFLOW_CLOSED_BOOK_ENV:
        candidates.add(_WORKFLOW_CLOSED_BOOK_ENV[workflow])  # type: ignore[index]
    if mode in _MODE_CLOSED_BOOK_ENV:
        candidates.add(_MODE_CLOSED_BOOK_ENV[mode])  # type: ignore[index]
    return any(
        str(env.get(var, "")).strip().lower() in _CLOSED_BOOK_TRUTHY
        for var in candidates
    )


def apply_closed_book_filter(
    tool_names: Iterable[str],
    *,
    workflow: str | None = None,
    mode: str | None = None,
    env: Mapping[str, str],
) -> frozenset[str]:
    """Drop closed-book web tools from ``tool_names`` when the env requests it."""
    if _is_closed_book(workflow=workflow, mode=mode, env=env):
        return frozenset(t for t in tool_names if t not in CLOSED_BOOK_WEB_TOOLS)
    return frozenset(tool_names)


def _configured(value: str | None) -> bool:
    stripped = (value or "").strip()
    return bool(stripped) and not _UNRESOLVED_ENV_RE.search(stripped)


def inspect_runtime_config(
    cfg: ModelConfig,
    *,
    profile: AgentProfile,
    mode: str | None = None,
    environ: Mapping[str, str] | None = None,
) -> RuntimeConfigStatus:
    """Perform a local, structural runtime preflight with no network calls."""
    env = os.environ if environ is None else environ
    active_mode = mode or profile.name
    provider = profile.provider or "custom"
    api_key_env = profile.api_key_env
    key_configured = _configured(cfg.api_key)
    if provider != "local" and (cfg.api_key or "").strip() == "EMPTY":
        key_configured = False

    issues: list[RuntimeConfigIssue] = []
    if not key_configured:
        source = f" ({api_key_env})" if api_key_env else ""
        issues.append(RuntimeConfigIssue(
            code="missing_api_key",
            message=f"API key{source} is missing for provider {provider}.",
            env_var=api_key_env,
        ))

    model = (cfg.model or "").strip()
    if not model:
        issues.append(RuntimeConfigIssue(
            code="missing_model",
            message="The active model is empty.",
            env_var=profile.model_env,
        ))

    endpoint_host: str | None = None
    if cfg.base_url:
        try:
            parsed = urlsplit(cfg.base_url)
            if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
                raise ValueError
            endpoint_host = parsed.hostname
        except (TypeError, ValueError):
            issues.append(RuntimeConfigIssue(
                code="invalid_base_url",
                message="The provider base URL must be a valid HTTP(S) URL.",
                env_var=profile.base_url_env,
            ))

    # Gate the search credentials on the tools the profile actually binds, not
    # on the mode name. Keying this on ``research`` meant it never fired: the
    # terminal only exposes ``react`` and ``agent_team``, and both bind
    # web_search and web_fetch, so a missing key first surfaced as an error
    # string inside a tool result.
    #
    # Closed-book runs (REACT_NO_WEB / SWARM_NO_WEB) drop the web tools before
    # they are bound, so filter them here too: warning about credentials for
    # tools that will not run is a false positive. ``env`` is the same mapping
    # used for the SERPER/JINA reads, so tests can drive this via ``environ=``.
    tool_names = apply_closed_book_filter(
        getattr(profile, "tool_names", ()) or (),
        workflow=getattr(profile, "workflow", None),
        mode=active_mode,
        env=env,
    )
    if "web_search" in tool_names and not _configured(env.get("SERPER_API_KEY")):
        issues.append(RuntimeConfigIssue(
        
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

### Incident Patch 1: `1d9acba9` (2026-09-30)
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
+        "final_answer": "don
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

---

### Incident Patch 2: `4fcba4d3` (2026-09-29)
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
+    inter
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

---

### Incident Patch 3: `68b92008` (2026-09-29)
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

### Incident Patch 4: `f227f926` (2026-09-25)
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

### Incident Patch 5: `6ab6b12c` (2026-09-25)
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

---

### Incident Patch 6: `4f4eb5fa` (2026-09-25)
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
+    ``finalize_report_
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

---

### Incident Patch 7: `b456dd7c` (2026-09-25)
**Commit Message**: chore(deps): move to apodex-agent-core 0.12.0 and drop 0.11.1 workarounds

- Pin apodex-agent-core==0.12.0.
- infra/openai_client.py is a plain alias again (AgentCore treats an empty
  api_key as unset); only the session-affinity resolvers are configured.
- TaskBoardObserver aliases the shared class (now critical upstream).
- loop_types no longer hand re-exports wall_deadline_remaining_s (in
  __all__ upstream).
- create_file annotates its rows/data shorthand shapes explicitly instead of
  patching items to {}, so every schema node keeps a concrete type for
  strict validators.
- create_subagent uses the public bind_max_tokens instead of _ensure_bound.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@ Initial open-source release of FrontierAgent.
 ### Changed
 
 - **Runtime engine moved to [`apodex-agent-core`](https://pypi.org/project/apodex-agent-core/)
-  (pinned `==0.11.1`).** The agent loop, loop contracts, tool execution,
+  (pinned `==0.12.0`).** The agent loop, loop contracts, tool execution,
   compaction, observers, AgentBus, DAG and providers now come from `agent_core`;
   `frontier_agent.*` keeps its import paths as `sys.modules` aliases or thin
   adapters, so workflows, apodex and benchmarks are unchanged. Product policy is
@@ -22,7 +22,7 @@ Initial open-source release of FrontierAgent.
   follows AgentCore where the fork had diverged, notably: compaction pins the
   first user message verbatim and replaces legacy prose spill indexes, and
   `Any`-typed tool parameters generate `{"type": "string"}` (`create_file`
-  restores open `items` for its shorthand arrays).
+  now annotates its `rows` / `data` shorthand shapes explicitly).
 
 ### Added
 
```

**File**: `frontier_agent/components/observers/task_board.py` (modified, +6/-13)
```diff
@@ -1,16 +1,9 @@
-"""Task-board reminders (shared ``TaskBoardObserver`` with product policy)."""
+# pyright: reportWildcardImportFromLibrary=false
+"""Task-board reminders (implemented by ``agent_core.components.observers.task_board``)."""
 
-from agent_core.components.observers.task_board import TaskBoardObserver as _TaskBoardObserver
+import sys
 
+import agent_core.components.observers.task_board as _implementation
+from agent_core.components.observers.task_board import *  # noqa: F403
 
-class TaskBoardObserver(_TaskBoardObserver):
-    """Critical, so the board reminder is collected into the next turn.
-
-    AgentCore defaults this observer to non-critical, where return values are
-    dropped and the reminder would never reach the model.
-    """
-
-    critical: bool = True
-
-
-__all__ = ["TaskBoardObserver"]
+sys.modules[__name__] = _implementation
```

**File**: `frontier_agent/core/loop_types.py` (modified, +0/-3)
```diff
@@ -5,8 +5,5 @@
 
 import agent_core.loop_types as _implementation
 from agent_core.loop_types import *  # noqa: F403
-from agent_core.loop_types import (  # not in __all__; named for static checkers
-    wall_deadline_remaining_s as wall_deadline_remaining_s,
-)
 
 sys.modules[__name__] = _implementation
```

**File**: `frontier_agent/core/runtime/loop/_bind.py` (modified, +0/-4)
```diff
@@ -7,9 +7,6 @@
 from agent_core.runtime.loop._bind import (
     _BoundLLM as _BoundLLM,
 )
-from agent_core.runtime.loop._bind import (
-    _ensure_bound as _ensure_bound,
-)
 from agent_core.runtime.loop._bind import (
     bind_max_tokens,
     bind_temperature,
@@ -34,7 +31,6 @@ def bind_session_id(llm: Any, task_id: str) -> Any:
 
 __all__ = [
     "_BoundLLM",
-    "_ensure_bound",
     "bind_max_tokens",
     "bind_session_id",
     "bind_temperature",
```

**File**: `frontier_agent/core/runtime/loop/llm_client.py` (modified, +0/-2)
```diff
@@ -21,7 +21,6 @@
 from agent_core.tokens import estimate_message_tokens, estimate_text_tokens
 
 from frontier_agent.core.runtime.loop._bind import (
-    _ensure_bound,
     bind_max_tokens,
     bind_session_id,
     bind_temperature,
@@ -37,7 +36,6 @@
     "LLMReasoningRunaway",
     "LLMStreamStalled",
     "ThinkTagSplitter",
-    "_ensure_bound",
     "bind_max_tokens",
     "bind_session_id",
     "bind_temperature",
```

---

### Incident Patch 8: `41152e7f` (2026-09-25)
**Commit Message**: Merge pull request #38 from Anai-Guo/fix/reader-xlsx-missing-subprocess-import

fix(reader_xlsx): add missing `import subprocess` (recalc silently disabled)

**File**: `plugins/tools/_reader_xlsx.py` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@
 import os
 import re
 import shutil
+import subprocess
 import tempfile
 import xml.etree.ElementTree as _ET
 import zipfile
```

---

### Incident Patch 9: `c2ecd111` (2026-09-25)
**Commit Message**: Fix Docker environment forwarding and user config reload

**File**: `apodex/docker.py` (modified, +16/-1)
```diff
@@ -347,6 +347,9 @@ def run_in_container(
         "-v", f"{home_state}:/root/.apodex",
         "-v", f"{home_config}:/root/.config/apodex",
         "-e", "APODEX_IN_CONTAINER=1",
+        # The host already selected and resolved the user env file. The
+        # mounted default config directory must not supply a second one.
+        "-e", "APODEX_USER_ENV_RESOLVED=1",
         "-e", "HOME=/root",
         # Same contract as the Compose launchers: files written by the dropped-
         # privilege tool process keep useful host ownership. The entrypoint
@@ -389,8 +392,20 @@ def run_in_container(
     # environment, so the resolved key is never an argv token. Ordering after
     # --env-file is what lets the host-resolved value win over the checkout's
     # file, matching the exported-environment precedence native runs have.
+    # Host files may also configure native execution. Preserve every explicit
+    # container setting above, and keep host interpreter/config paths and the
+    # higher-priority sandbox alias out of the container environment.
+    reserved_names = {
+        docker_cmd[index + 1].partition("=")[0]
+        for index, arg in enumerate(docker_cmd[:-1]) if arg == "-e"
+    }
+    reserved_names.update({
+        "APODEX_SANDBOX", "APODEX_ENV_FILE", "PATH", "PYTHONPATH",
+        "PYTHONHOME", "VIRTUAL_ENV", "XDG_CONFIG_HOME", "XDG_CACHE_HOME",
+        "XDG_STATE_HOME", "XDG_DATA_HOME", "XDG_RUNTIME_DIR", "TMPDIR",
+    })
     for name in dict.fromkeys(forward_env):
-        if name in os.environ:
+        if name in os.environ and name not in reserved_names:
             docker_cmd += ["-e", name]
     docker_cmd += [image, "apodex", *_without_cwd_arg(argv)]
 
```

**File**: `apodex/tests/test_docker.py` (modified, +39/-0)
```diff
@@ -483,3 +483,42 @@ def test_forwarded_names_follow_the_checkout_env_file(monkeypatch, tmp_path) ->
     command = calls[0]
     assert command.index("--env-file") < command.index("OPENAI_MODEL")
     assert command[command.index("--env-file") + 1] == str(checkout / ".env")
+
+
+def test_forwarded_host_settings_cannot_replace_container_runtime(monkeypatch, tmp_path) -> None:
+    workspace = tmp_path / "project"
+    workspace.mkdir()
+    calls = _stub_container(monkeypatch, tmp_path)
+    host_settings = {
+        "SANDBOX_BACKEND": "bwrap",
+        "APODEX_SANDBOX": "bwrap",
+        "HOME": "/host/home",
+        "PATH": "/host/venv/bin:/usr/bin",
+        "PYTHONPATH": "/host/packages",
+        "XDG_CONFIG_HOME": "/host/config",
+        "FRONTIER_AGENT_WORKSPACE_DIR": "/host/workspace",
+        "APODEX_IN_CONTAINER": "0",
+        "APODEX_USER_ENV_RESOLVED": "0",
+        "CUSTOM_PROVIDER_TOKEN": "synthetic-token",
+    }
+    for name, value in host_settings.items():
+        monkeypatch.setenv(name, value)
+
+    assert docker.run_in_container(
+        [], cwd=str(workspace), image="test-image", forward_env=tuple(host_settings),
+    ) == 0
+
+    command = calls[0]
+    settings = {}
+    for index, arg in enumerate(command[:-1]):
+        if arg == "-e":
+            name, separator, value = command[index + 1].partition("=")
+            settings[name] = value if separator else os.environ[name]
+    assert settings["SANDBOX_BACKEND"] == "container"
+    assert settings["HOME"] == "/root"
+    assert settings["FRONTIER_AGENT_WORKSPACE_DIR"] == "/workspace"
+    assert settings["APODEX_IN_CONTAINER"] == "1"
+    assert settings["APODEX_USER_ENV_RESOLVED"] == "1"
+    for name in ("APODEX_SANDBOX", "PATH", "PYTHONPATH", "XDG_CONFIG_HOME"):
+        assert name not in settings
+    assert settings["CUSTOM_PROVIDER_TOKEN"] == "synthetic-token"
```

**File**: `apodex/tests/test_userenv.py` (modified, +61/-0)
```diff
@@ -490,3 +490,64 @@ def test_withheld_key_explains_the_preflight_failure_once(
     assert err.index("was not applied") < err.index("preflight failed")
     assert _SECRET not in err
     assert cli_harness.constructed == []
+
+
+@pytest.mark.parametrize("selection", ["disabled", "custom", "withheld"])
+def test_container_does_not_reload_default_user_file(
+    launch, user_file, monkeypatch, tmp_path, selection,
+) -> None:
+    from types import SimpleNamespace
+
+    from apodex import docker
+
+    _write(user_file, (
+        f"OPENAI_API_KEY={_SECRET}\n"
+        "OPENAI_BASE_URL=https://default.example/v1\nOPENAI_MODEL=default-model\n"
+    ))
+    if selection == "disabled":
+        monkeypatch.setenv(USER_ENV_FILE_VAR, os.devnull)
+    else:
+        selected = _write(tmp_path / "selected.env", (
+            "OPENAI_MODEL=selected-model\n" if selection == "custom" else
+            f"OPENAI_API_KEY={_OTHER_SECRET}\nOPENAI_BASE_URL=https://selected.example/v1\n"
+        ))
+        monkeypatch.setenv(USER_ENV_FILE_VAR, str(selected))
+    if selection == "withheld":
+        monkeypatch.setenv("OPENAI_BASE_URL", "https://override.example/v1")
+
+    host = load_environment()
+    assert "OPENAI_API_KEY" not in os.environ
+    monkeypatch.setattr(docker, "docker_available", lambda: (True, "available"))
+    monkeypatch.setattr(docker, "image_exists", lambda image: True)
+    monkeypatch.setattr(docker, "_REPO_ROOT", tmp_path / "site-packages")
+    calls = []
+    monkeypatch.setattr(docker.subprocess, "run", lambda command: (
+        calls.append(command) or SimpleNamespace(returncode=0)
+    ))
+    assert docker.run_in_container(
+        [], cwd=str(launch), image="test-image", forward_env=host.forwarded_names(),
+    ) == 0
+
+    # Replay the actual launcher's environment, with the mounted config
+    # directory represented by its temporary host path. No Docker needed.
+    container_env = {}
+    for index, arg in enumerate(calls[0][:-1]):
+        if arg == "-e":
+            name, separator, value = calls[0][index + 1].partition("=")
+            container_env[name] = value if separator else os.environ[name]
+    container_env["HOME"] = str(user_file.parents[2])
+    with monkeypatch.context() as inner:
+        for name in tuple(os.environ):
+            inner.delenv(name)
+        for name, value in container_env.items():
+            inner.setenv(name, value)
+        result = load_environment()
+        assert result.user_env_path is None
+        assert result.applied == ()
+        assert "OPENAI_API_KEY" not in os.environ
+        assert os.environ.get("OPENAI_MODEL") == (
+            "selected-model" if selection == "custom" else None
+        )
+        assert os.environ.get("OPENAI_BASE_URL") == (
+            "https://override.example/v1" if selection == "withheld" else None
+        )
```

**File**: `apodex/userenv.py` (modified, +6/-0)
```diff
@@ -293,6 +293,12 @@ def load_environment() -> EnvResolution:
             with contextlib.suppress(OSError, UnicodeDecodeError):
                 file_names.update(dict.fromkeys(_read_env_file(candidate)))
 
+    # Our Docker launcher forwards the host's resolved values. Its mounted
+    # default config directory may contain a different file from the one the
+    # host selected (or intentionally skipped with APODEX_ENV_FILE=/dev/null).
+    if os.environ.get("APODEX_USER_ENV_RESOLVED") == "1":
+        return EnvResolution(None, tuple(dotenv_paths), (), (), (), tuple(file_names))
+
     path, applied, withheld, notes, defined = apply_user_env(os.environ)
     file_names.update(dict.fromkeys(defined))
     return EnvResolution(
```

---

### Incident Patch 10: `ec167719` (2026-09-25)
**Commit Message**: Merge pull request #30 from fzp0424/fix/frontierchallenge-open-track

fix(frontierchallenge): unify scoring and repair task-cache upgrades

**File**: `benchmarks/frontierchallenge/README.md` (modified, +18/-8)
```diff
@@ -29,7 +29,7 @@ simulation, electrochemistry, quantitative imaging, and molecular biology.
   <tbody>
     <tr><td>Tasks</td><td>97 (74 hard, 23 medium)</td></tr>
     <tr><td>Taxonomy</td><td>6 domains, 21 subdomains</td></tr>
-    <tr><td>Runtime</td><td>81 open-image tasks, 16 user-supplied ORCA tasks</td></tr>
+    <tr><td>Runtime</td><td>81 open-image tasks, 16 tasks executing user-supplied ORCA</td></tr>
     <tr><td>Grading</td><td>deterministic checks; 77 tasks also judge the report</td></tr>
     <tr><td>Harness</td><td>Harbor 0.20.0</td></tr>
     <tr><td>Output</td><td>named files under <code>/app/output</code></td></tr>
@@ -38,13 +38,15 @@ simulation, electrochemistry, quantitative imaging, and molecular biology.
 
 ## End-to-end workflow
 
-Requirements: Linux x86-64, Python 3.11+, Docker with Compose, model
+Requirements: Linux x86-64, Python 3.12+ (Harbor 0.20.0), Docker with Compose, model
 and judge credentials, and a Hugging Face token while either dataset is private
 or gated.
 
 ```bash
 git clone https://github.com/ApodexAI/FrontierAgent.git
 cd FrontierAgent/benchmarks/frontierchallenge
+python3.12 -m venv .venv
+source .venv/bin/activate
 python -m pip install -e .
 cp .env.example .env
 ```
@@ -59,10 +61,10 @@ its SHA-256, and load it into Docker:
 HF_TOKEN=hf_... ./scripts/setup.sh --track open
 ```
 
-The full track adds 16 normally released ORCA tasks. FrontierChallenge does
-not distribute ORCA or an image containing it. After obtaining ORCA 6.0.1 from
-its official provider, build and smoke-test the private local runtime, then
-validate the full track:
+The full track adds 16 normally released tasks that execute ORCA.
+FrontierChallenge does not distribute ORCA or an image containing it. After
+obtaining ORCA 6.0.1 from its official provider, build and smoke-test the
+private local runtime, then validate the full track:
 
 ```bash
 ./scripts/build_orca_runtime.sh \
@@ -74,6 +76,10 @@ HF_TOKEN=hf_... ./scripts/setup.sh --track full
 Do not push, export, publish, or share the resulting ORCA image. See the
 [ORCA setup tutorial](docs/providers/orca.md).
 
+Track membership describes what a task executes, not where its input files
+came from. For example, `task_098_orca_claisen_thermochemistry` reads supplied
+ORCA output but does not run ORCA, so it belongs to the open track.
+
 ### 2. Run a real task
 
 Fill `.env`, then run Harbor with the Claude Code agent:
@@ -101,8 +107,12 @@ cat results/harbor/<job>/<trial>/verifier/reward.json
 cat results/harbor/<job>/summary.json
 ```
 
-`passed` is the task's own pass decision; do not derive it from a global score
-threshold. `task_score` is in `[0, 1]`, and `evaluation_complete = 1` confirms
+Official **Pass Rate** counts completed evaluations with **`task_score > 0.999`**
+over all 97 tasks. **Score** is the mean `task_score` over 97, multiplied by 100.
+Missing or failed evaluations contribute zero. `passed` has this single meaning
+in both `reward.json` and summaries; no alternate pass field is emitted.
+The comparison is strict and uses unrounded scores: exactly `0.999` does not pass.
+`task_score` is in `[0, 1]`, and `evaluation_complete = 1` confirms
 that grading finished. See [Quickstart](docs/quickstart.md) for credentials and
 expected output, and [Scoring](docs/scoring.md) for aggregate reporting.
 
```

**File**: `benchmarks/frontierchallenge/TASKS.md` (modified, +4/-1)
```diff
@@ -14,7 +14,10 @@ HF_TOKEN=hf_... ./scripts/setup.sh --track open
 ```
 
 The table below previews benchmark coverage without exposing evaluator data.
-Keywords come from each task and describe technique rather than answers.
+Keywords come from each task and describe technique rather than answers. The
+`Image` column records what the task executes, not software named in supplied
+files: `task_098_orca_claisen_thermochemistry`, for example, reads precomputed
+ORCA output and therefore uses the open image.
 
 | Task | Difficulty | Image | Judge | Agent budget | Techniques |
 |---|---|---|---|---|---|
```

**File**: `benchmarks/frontierchallenge/docs/huggingface-release.md` (modified, +17/-3)
```diff
@@ -19,9 +19,12 @@ workspace.
 HF_TOKEN=hf_... ./scripts/setup.sh --track open
 ```
 
-Setup downloads the current `main` branches, runs the verification tool bundled
-with each dataset, and requires both `source_registry.json` files to equal this
-checkout's `registry.json`. A mixed or incomplete dataset is refused.
+Setup downloads the exact solve and reference commits declared in
+`release/datasets.json`, runs the verification tool bundled with each dataset,
+and requires both `source_registry.json` files to equal this checkout's
+`registry.json`. A mixed or incomplete dataset is refused. Release maintainers
+may test newer snapshots with `--revision` and `--reference-revision`; published
+runtime changes should update both pins together.
 
 Use local directories instead of HF repository IDs for an offline handoff:
 
@@ -44,3 +47,14 @@ the encrypted verifier hash. GitHub contains neither payload. The solve dataset
 must contain no `tests/`, verifier archive, rubric, fixture, or reference
 output; the reference dataset must contain no instruction, input, or runtime
 environment.
+
+The top-level Hugging Face `README.md` is intentionally outside
+`checksums.sha256`: it is a mutable dataset card whose citation and links may be
+edited without changing the benchmark payload. Task files, task-level READMEs,
+registries, manifests, image artifacts, and verifier archives remain covered by
+the checksum manifests and registry commitments.
+
+After payload edits, regenerate the affected checksum entries and run both
+bundled verification tools before publishing. Dataset-card-only edits require
+no payload checksum change. Update the runtime's pinned HF revisions after
+publishing; see [Scoring](scoring.md) for the metric contract shared by both cards.
```

**File**: `benchmarks/frontierchallenge/docs/providers/docker.md` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ path.
 ## Two things that bite
 
 **ORCA is user-supplied and writes beside its input.** Before selecting one of
-the 16 ORCA tasks, create the licensed local runtime described in
+the 16 tasks that execute ORCA, create the licensed local runtime described in
 [orca.md](orca.md). Copy ORCA inputs into a writable directory (`/app/data`,
 `/tmp`) before running; invoking ORCA directly on a read-only bind-mounted file
 fails.
```

**File**: `benchmarks/frontierchallenge/docs/quickstart.md` (modified, +37/-11)
```diff
@@ -6,7 +6,9 @@ Hugging Face datasets, a real Harbor + Claude Code run, and the final score.
 ## Requirements
 
 - Linux x86-64 with Docker and Compose v2;
-- Python 3.11+ and about 20 GB for the open image;
+- Python 3.12+ on the evaluator host (required by Harbor 0.20.0);
+  allow at least 40 GB of free disk for the downloaded archive,
+  Docker image, and working data (more for concurrent runs and results);
 - a model API key and a judge API key;
 - `HF_TOKEN` while either dataset is private or gated;
 - for the full track only, an official ORCA 6.0.1 download and permission to
@@ -24,6 +26,8 @@ docker compose version
 ```bash
 git clone https://github.com/ApodexAI/FrontierAgent.git
 cd FrontierAgent/benchmarks/frontierchallenge
+python3.12 -m venv .venv
+source .venv/bin/activate
 python -m pip install -e .
 cp .env.example .env
 ```
@@ -61,19 +65,32 @@ This is the shortest path for most evaluators:
 HF_TOKEN=hf_... ./scripts/setup.sh --track open
 ```
 
-Setup downloads the solve and reference datasets from their current `main` branches,
-verifies both packages, binds them to this checkout's `registry.json`, then
+Setup downloads the solve and reference revisions pinned by this Git checkout in
+`release/datasets.json`, verifies both packages, binds them to this checkout's
+`registry.json`, then
 downloads `images/frontierchallenge-cpu-open-2026.08.docker.tar.zst` from the
-solve dataset. It checks the declared size, SHA-256 and image ID before loading
-the `linux/amd64` image into Docker. No container registry is used. Evaluator-
+solve dataset. It checks the archive's declared size and SHA-256 before loading
+the `linux/amd64` image into Docker, then verifies the loaded image identity.
+No container registry is used. Evaluator-
 local paths are written to `.frontierchallenge/config.env`.
 
+Docker's classic and containerd image stores expose different image IDs. Setup
+accepts the published config digest directly, or verifies that the loaded OCI
+manifest digest links to that exact config inside the SHA-256-verified archive.
+Keep runtime dependencies current with `python -m pip install -e .`; do not
+disable identity checks or change Docker's storage backend to work around this.
+
+For release development only, `--revision main` overrides both pins;
+`--reference-revision` can override the reference revision independently. Normal
+evaluation should keep the checkout's pins so later dataset changes cannot alter
+an otherwise identical run.
+
 ### Full track: build the private ORCA runtime
 
-All 16 ORCA task statements and inputs are released normally. Only ORCA and a
-configured ORCA image are absent. Obtain ORCA 6.0.1 from its official provider,
-install it outside this checkout, and keep the complete directory together.
-Then run:
+All statements and inputs for the 16 tasks that execute ORCA are released
+normally. Only ORCA and a configured ORCA image are absent. Obtain ORCA 6.0.1
+from its official provider, install it outside this checkout, and keep the
+complete directory together. Then run:
 
 ```bash
 ./scripts/build_orca_runtime.sh \
@@ -118,6 +135,11 @@ tasks into evaluator staging, decrypts the matching verifier there, starts the
 agent, and invokes Harbor's verifier after the agent exits. By default Claude
 Code's `WebSearch` and `WebFetch` tools are disabled.
 
+Selection comes from each task's declared `task.json.environment`, validated
+against the registry. Include/exclude filters are applied before image preflight,
+staging, verifier decryption, resume, and Harbor invocation; stale directories
+from an older run cannot add tasks to the effective run.
+
 A healthy run reaches messages like:
 
 ```text
@@ -146,10 +168,14 @@ cat results/harbor/<job>/<trial>/verifier/reward.json
 ```
 
 - `evaluation_complete = 1` means the verifier finished;
-- `passed` is the task's own pass decision and must not be recomputed from a
-  global threshold;
+- official Pass Rate counts completed `task_score > 0.999` evaluati
```

#### Recent Merged Pull Requests:
- **PR #56** (2026-09-30): docs: add Trendshift popularity badge (@zhanghanduo)
- **PR #54** (closed): fix(agent_team): tool_choice crash, Unknown-agent recovery guard + planning-mode/schema fixes (@dkcbr)
- **PR #52** (2026-09-30): chore(deps): bump apodex-agent-core to 0.12.2 (@zhanghanduo)
- **PR #51** (2026-09-30): fix: fail closed for service sandbox isolation (@jack-yang-apodex)
- **PR #50** (2026-09-25): refactor(runtime): run the agent loop on apodex-agent-core 0.12.0 (@zhanghanduo)
- **PR #49** (2026-09-30): Fix native workflow behavior and isolate path localization tests (@zhanghanduo)
- **PR #48** (2026-09-29): fix(agent-team): mark finalize-gate bypass on the final turn instead of delivering silently (@KaiOnCode)
- **PR #46** (2026-09-25): docs: document support for any Serper.dev-compatible endpoint (@litescraper)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
