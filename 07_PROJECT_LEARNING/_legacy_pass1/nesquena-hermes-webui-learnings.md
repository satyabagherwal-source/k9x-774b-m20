# Forensic Learning Record (Deep Inspection): nesquena/hermes-webui

> **Canonical Artifact**: `07_PROJECT_LEARNING/nesquena-hermes-webui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nesquena/hermes-webui](https://github.com/nesquena/hermes-webui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:45:34.046Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nesquena/hermes-webui`
- **Description**: Hermes WebUI: The best way to use Hermes Agent from the web or from your phone!
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 18694 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/__init__.py`
```
"""Hermes Web UI -- API modules."""

```

### Core Architecture Module: `api/agent_compat.py`
```
"""Resolve Hermes Agent names that moved to a sibling module.

Hermes Agent's September 2026 decomposition moved many names out of their
original modules (``tools.approval``, ``tools.mcp_tool``,
``hermes_cli.kanban_db``, ...) into ``<stem>_<topic>`` siblings. The old paths
kept resolving for a while only through PEP 562 ``__getattr__`` pointers that
emit ``HermesPluginCompatWarning`` and are removed on schedule, so WebUI code
must not rely on them. Importing only the new module would instead break Agent
installs that predate the split.

``agent_attr`` is compatibility-only and resolves a moved name in this order:

1. the original module's own namespace -- pre-split Agents, and tests that stub
   the original module in ``sys.modules`` or patch the name onto it;
2. the new home module -- split Agents, with or without the old-path pointers;
3. plain attribute access on the original object -- non-module test doubles,
   or an Agent whose new home is not importable.
"""

from __future__ import annotations

import importlib
from types import ModuleType
from typing import Any

_MISSING = object()


def agent_attr(owner: Any, name: str, home: str, default: Any = _MISSING) -> Any:
    """Return ``owner.name`` without going through a removed/deprecated pointer.

    ``owner`` is the original module (or its dotted name); ``home`` is the
    dotted name of the module the Agent moved ``name`` to. Raises
    ``ImportError``/``AttributeError`` like the plain import it replaces, unless
    ``default`` is given.
    """
    if isinstance(owner, str):
        try:
            owner = importlib.import_module(owner)
        except ImportError:
            if default is _MISSING:
                return getattr(importlib.import_module(home), name)
            try:
                return getattr(importlib.import_module(home), name, default)
            except ImportError:
                return default
    if isinstance(owner, ModuleType) and name not in vars(owner):
        try:
            return getattr(importlib.import_module(home), name)
        except (ImportError, AttributeError):
            pass
    if default is _MISSING:
        return getattr(owner, name)
    return getattr(owner, name, default)

```

### Core Architecture Module: `api/agent_health.py`
```
"""Hermes agent/gateway heartbeat payload helpers (#716, #1879).

The WebUI process is not always paired with a long-running Hermes gateway. Some
setups use WebUI only, while self-hosted messaging deployments run a separate
Hermes gateway daemon that records runtime metadata in the Hermes Agent home.
This module turns those existing safe runtime signals into a small UI-facing
heartbeat without shelling out or adding psutil as a hard dependency.

Cross-container note (#1879): ``gateway.status.get_running_pid()`` uses
``fcntl.flock`` and ``os.kill(pid, 0)``, both of which require the caller to
share a PID namespace with the gateway process. In multi-container deployments
where the WebUI runs separately from ``hermes-agent`` and only a Hermes data
volume is shared, those checks always return ``None`` and the dashboard
incorrectly shows "Gateway not running". To stay accurate without forcing a
``pid: "service:hermes-agent"`` compose workaround, we accept a recent
``updated_at`` timestamp on ``gateway_state.json`` (combined with
``gateway_state == "running"``) as an equivalent live-process signal.  Older
gateway builds do not refresh that file periodically, so a stale
``gateway_state == "running"`` record is treated as inconclusive rather than a
confirmed outage.
"""

from __future__ import annotations

import importlib
import inspect
import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

_GATEWAY_PID_FILE = "gateway.pid"
_GATEWAY_RUNTIME_STATUS_FILE = "gateway_state.json"


# Two cron ticks (~60s each). Chosen to avoid false negatives during brief
# gateway restarts while still surfacing a true outage within a couple of
# minutes. Override is intentionally not exposed: keep the check deterministic
# and identical across deployments so support diagnostics are reproducible.
GATEWAY_FRESHNESS_THRESHOLD_S: float = 120.0


def _checked_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def _runtime_status_is_fresh(
    runtime_status: dict[str, Any] | None,
    *,
    now: datetime | None = None,
    threshold_s: float = GATEWAY_FRESHNESS_THRESHOLD_S,
) -> bool:
    """Return ``True`` when ``gateway_state.json`` looks freshly written.

    "Fresh" means the gateway self-reported ``running`` and the ``updated_at``
    ISO-8601 timestamp is no older than ``threshold_s`` seconds. This is the
    cross-container liveness signal used when ``get_running_pid()`` returns
    ``None`` purely because of PID-namespace isolation (#1879).

    Any unparseable input is treated as "not fresh" — a stale or missing
    timestamp must never report alive.
    """
    if not isinstance(runtime_status, dict):
        return False
    if runtime_status.get("gateway_state") != "running":
        return False

    raw_updated_at = runtime_status.get("updated_at")
    if not isinstance(raw_updated_at, str) or not raw_updated_at:
        return False

    # ``datetime.fromisoformat`` accepts the exact format gateway/status.py
    # writes (``datetime.now(timezone.utc).isoformat()``). We deliberately
    # don't pull in dateutil — keeping this stdlib-only matches the rest of
    # this module.
    try:
        updated_at = datetime.fromisoformat(raw_updated_at)
    except (TypeError, ValueError):
        return False

    if updated_at.tzinfo is None:
        # A naive timestamp could mean anything across containers / hosts.
        # Refuse to interpret it rather than assume UTC.
        return False

    reference = now if now is not None else datetime.now(timezone.utc)
    age_s = (reference - updated_at).total_seconds()
    if age_s < 0:
        # Clock skew between containers can produce small negatives. A future
        # timestamp is still a "fresh" signal — the gateway clearly wrote it
        # very recently — so accept it. A wildly-future timestamp (> threshold
        # in the future) is rejected to avoid trusting a broken clock.
        return -age_s <= threshold_s
    return age_s <= threshold_s


def _runtime_status_is_stale_stopped(
    runtime_status: dict[str, Any] | None,
    *,
    now: datetime | None = None,
    threshold_s: float = GATEWAY_FRESHNESS_THRESHOLD_S,
) -> bool:
    """Return ``True`` for an old clean-stop root gateway state.

    A user may run only profile-scoped gateways while a root
    ``gateway_state.json`` from an older, intentionally stopped gateway remains
    on disk (#1944). Treat that stale stopped file like "no root gateway
    configured" so the heartbeat banner does not keep warning about a service
    the user is not running. Fresh stopped state still reports down.
    """
    if not isinstance(runtime_status, dict):
        return False
    if runtime_status.get("gateway_state") != "stopped":
        return False

    raw_updated_at = runtime_status.get("updated_at")
    if not isinstance(raw_updated_at, str) or not raw_updated_at:
        return False

    try:
        updated_at = datetime.fromisoformat(raw_updated_at)
    except (TypeError, ValueError):
        return False
    if updated_at.tzinfo is None:
        return False

    reference = now if now is not None else datetime.now(timezone.utc)
    age_s = (reference - updated_at).total_seconds()
    return age_s > threshold_s


def _runtime_status_is_stale_running(
    runtime_status: dict[str, Any] | None,
    *,
    now: datetime | None = None,
    threshold_s: float = GATEWAY_FRESHNESS_THRESHOLD_S,
) -> bool:
    """Return ``True`` when the gateway last self-reported running, but stale.

    WebUI often runs in a separate container from the gateway. In that shape PID
    checks can be impossible, and older gateway versions only update
    ``gateway_state.json`` on lifecycle/platform changes. A stale ``running``
    file therefore means "not enough information from WebUI" rather than
    "gateway is down".
    """
    if not isinstance(runtime_status, dict):
        return False
    if runtime_status.get("gateway_state") != "running":
        return False

    raw_updated_at = runtime_status.get("updated_at")
    if not isinstance(raw_updated_at, str) or not raw_updated_at:
        return False

    try:
        updated_at = datetime.fromisoformat(raw_updated_at)
    except (TypeError, ValueError):
        return False
    if updated_at.tzinfo is None:
        return False

    reference = now if now is not None else datetime.now(timezone.utc)
    age_s = (reference - updated_at).total_seconds()
    return age_s > threshold_s


def _gateway_status_module():
    """Load gateway.status lazily so tests and WebUI-only installs stay isolated."""
    return importlib.import_module("gateway.status")


def _gateway_root_pid_path() -> Path | None:
    """Return the root Hermes gateway PID path.

    Gateway runtime files are root-level singletons.  A profile-scoped WebUI
    process may have HERMES_HOME=<root>/profiles/<name>, but gateway.pid,
    gateway.lock, and gateway_state.json still live under <root>.

    When the root-level gateway.pid is absent (profile-scoped gateway
    deployments write it under <root>/profiles/<name>/), fall back to the
    active profile's directory so the gateway is detected correctly.
    """
    try:
        from hermes_constants import get_default_hermes_root
        root_pid = get_default_hermes_root() / _GATEWAY_PID_FILE
        if root_pid.exists():
            return root_pid
        try:
            from api.profiles import get_active_hermes_home
            profile_pid = Path(get_active_hermes_home()) / _GATEWAY_PID_FILE
            if profile_pid.exists():
                return profile_pid
        except Exception:
            pass
        return root_pid
    except Exception:
        return None


def _read_runtime_status_path(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, Un
```

### Core Architecture Module: `api/agent_runtime.py`
```
"""Fail-closed guard for in-process Hermes Agent source revisions.

Hermes WebUI currently imports ``run_agent.AIAgent`` into its long-lived server
process. If the Agent checkout changes while that process is alive, Python may
combine already-cached modules with newly-read source. Refuse to reuse that
mixed runtime and require a clean WebUI restart instead.
"""

from __future__ import annotations

import errno
import math
import os
from pathlib import Path
import stat
import sys
import subprocess
import threading
import time

# Retain the discovered path as a diagnostic/test-visible compatibility value;
# runtime identity is deliberately captured from the loaded module below.
from api.config import (
    PYTHON_EXE,
    _AGENT_DIR,  # noqa: F401
    _DEFAULT_STATE_HOME,
)
from api.subprocess_utils import windows_hide_flags

_RESTART_REQUIRED_MESSAGE = (
    "Hermes Agent was updated while Hermes WebUI was running. "
    "WebUI cannot verify that the Agent update completed safely. "
    "Check the Agent update outcome and environment first. "
    "Restart Hermes WebUI manually before retrying this action."
)
_AGENT_UPDATE_MARKER = ".hermes-update-in-progress"
_AGENT_RECOVERY_MARKERS = (".update-incomplete", ".lazy-refresh-incomplete")
_AGENT_UPDATE_MAX_AGE_SECONDS = 20 * 60
# The update marker holds a PID and a start timestamp (two short numeric lines).
# Anything larger is not a legitimate marker; cap the read so a huge or growing
# regular file can never exhaust memory on the stale-runtime request path.
_AGENT_UPDATE_MARKER_MAX_BYTES = 64 * 1024
# O_NOFOLLOW is POSIX; on platforms that lack it the fast os.open() path is not
# taken at all (see _MARKER_SAFE_OPEN_AVAILABLE below).
# The marker read hardening relies on two POSIX-only open flags to stay both
# non-blocking (never hang on a FIFO/device) and symlink-safe. O_NONBLOCK is
# Unix-only and O_NOFOLLOW is absent on some platforms; accessing them
# unconditionally raises AttributeError on native Windows. Resolve them safely
# and only take the os.open() fast path when BOTH are genuinely available —
# otherwise the read cannot prove non-blocking + no-follow and must fall back to
# an lstat-only classification (see _read_live_agent_update).
_O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)
_O_NONBLOCK = getattr(os, "O_NONBLOCK", 0)
_MARKER_SAFE_OPEN_AVAILABLE = bool(getattr(os, "O_NOFOLLOW", 0)) and bool(
    getattr(os, "O_NONBLOCK", 0)
)
_HERMES_HOME = Path(_DEFAULT_STATE_HOME)
_AGENT_PYTHON = Path(PYTHON_EXE).expanduser() if PYTHON_EXE else None


def _read_agent_revision(
    agent_dir: Path | None,
    *,
    module_path: Path | None = None,
) -> str | None:
    """Return the loaded Agent checkout HEAD, or ``None`` if it is not tracked."""
    if agent_dir is None:
        return None

    if module_path is None:
        module = sys.modules.get("run_agent")
        module_file = getattr(module, "__file__", None)
        if not module_file:
            return None
        try:
            module_path = Path(module_file).resolve()
        except (OSError, RuntimeError, TypeError):
            return None

    try:
        worktree_result = subprocess.run(
            ["git", "-C", str(agent_dir), "rev-parse", "--show-toplevel"],
            check=False,
            capture_output=True,
            text=True,
            timeout=2,
            creationflags=windows_hide_flags(),
        )
        if worktree_result.returncode != 0:
            return None
        worktree = Path(worktree_result.stdout.strip()).resolve()
        relative_module = module_path.relative_to(worktree).as_posix()
        tracked_result = subprocess.run(
            [
                "git",
                "--literal-pathspecs",
                "-C",
                str(worktree),
                "ls-files",
                "--error-unmatch",
                "--",
                relative_module,
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=2,
            creationflags=windows_hide_flags(),
        )
        if tracked_result.returncode != 0:
            return None
        revision_result = subprocess.run(
            ["git", "-C", str(worktree), "rev-parse", "--verify", "HEAD"],
            check=False,
            capture_output=True,
            text=True,
            timeout=2,
            creationflags=windows_hide_flags(),
        )
    except (OSError, subprocess.TimeoutExpired, RuntimeError, ValueError):
        return None

    revision = revision_result.stdout.strip()
    return revision if revision_result.returncode == 0 and revision else None


_AGENT_SOURCE_DIR: Path | None = None
_AGENT_MODULE_PATH: Path | None = None
_AGENT_REVISION: str | None = None
_AIAgent = None
_RUNTIME_LOCK = threading.Lock()


class AgentRuntimeChangedError(RuntimeError):
    """Raised when the loaded Agent runtime no longer matches its source tree."""

    def __init__(
        self,
        message: str,
        *,
        agent_update_state: str | None = None,
    ) -> None:
        super().__init__(message)
        self.agent_update_state = agent_update_state


def agent_runtime_stale_payload(exc: AgentRuntimeChangedError) -> dict:
    """Return the shared retry response for every stale-runtime entry point."""
    payload = {
        "error": str(exc),
        "type": "agent_runtime_stale",
        "retryable": True,
        "restart_scheduled": False,
    }
    if exc.agent_update_state is not None:
        payload["agent_update_state"] = exc.agent_update_state
    return payload


def _pid_is_alive(pid: int) -> bool | None:
    """Return PID liveness, or ``None`` when the platform cannot confirm it."""
    if pid <= 0:
        return False
    if pid.bit_length() > 32:
        return None
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel32.OpenProcess.argtypes = (
                wintypes.DWORD,
                wintypes.BOOL,
                wintypes.DWORD,
            )
            kernel32.OpenProcess.restype = wintypes.HANDLE
            kernel32.GetExitCodeProcess.argtypes = (
                wintypes.HANDLE,
                ctypes.POINTER(wintypes.DWORD),
            )
            kernel32.GetExitCodeProcess.restype = wintypes.BOOL
            kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
            kernel32.CloseHandle.restype = wintypes.BOOL
            handle = kernel32.OpenProcess(0x1000, False, pid)
            if not handle:
                error = ctypes.get_last_error()
                if error == 5:  # ERROR_ACCESS_DENIED still proves the PID exists.
                    return True
                if error == 87:  # ERROR_INVALID_PARAMETER for a missing PID.
                    return False
                return None
            try:
                exit_code = wintypes.DWORD()
                if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
                    return None
                return exit_code.value == 259  # STILL_ACTIVE
            finally:
                kernel32.CloseHandle(handle)
        except (AttributeError, OSError, TypeError, ValueError):
            return None

    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except (OverflowError, ValueError):
        return None
    except OSError as exc:
        if exc.errno == errno.ESRCH:
            return False
        if exc.errno == errno.EPERM:
            return True
        return None
    return True


def _read_live_agent_update(marker: Path) -> str:
    """Classify the shared Agent update marker without changing Agent state.

    The marker is attacker-adjacent shared state (any process that can write the
    Agent home can create it), so the read is hardened: never follow a symlink,
    never block on a FIFO/d
```

### Core Architecture Module: `api/agent_sessions.py`
```
"""Shared helpers for reading Hermes Agent sessions from state.db."""
import json
import logging
import os
import sqlite3
import sys
from contextlib import closing
from pathlib import Path, PurePosixPath, PureWindowsPath
from urllib.parse import quote, quote_from_bytes

logger = logging.getLogger(__name__)

# state.db paths that already produced the "no 'source' column" warning below.
# ``get_cli_sessions(all_profiles=True)`` re-reads every profile DB on every
# sidebar poll (behind a 5 s cache), so a single pre-``source`` profile DB would
# otherwise re-emit the identical WARNING line every ~15 s for the life of the
# process. The condition is a property of the DB file, not of the poll, so it
# is reported once per path. Process-lifetime only: a restart warns again,
# which is the desired behaviour (the log line is the operator's cue that the
# agent still needs upgrading). Plain ``set`` mutation under the GIL is
# sufficient here; a duplicate line from two racing first calls is harmless.
_SOURCE_COLUMN_WARNED_DB_PATHS: set[str] = set()


def state_db_file_uri(db_path, platform: str | None = None) -> str:
    """Build the ``file:`` URI (no query string) for an absolute ``state.db`` path.

    ``Path.as_uri()`` is not usable here: for a UNC share it emits
    ``file://server/share/state.db`` and SQLite rejects any non-local URI
    authority unless compiled with ``SQLITE_ALLOW_URI_AUTHORITY`` (the
    CPython 3.11-3.13 Windows builds are not). SQLite instead accepts the
    *empty*-authority spelling ``file:////server/share/state.db``, whose path
    ``//server/share/...`` the Windows VFS opens as the UNC name. Drive-letter
    paths keep the documented ``file:///C:/...`` form and POSIX paths are
    unchanged. Only ``/`` survives unescaped, so ``?`` and ``#`` in path
    components cannot leak into the query string.

    ``platform`` defaults to the running interpreter; tests pass it explicitly
    so the Windows shapes are checked from any host.
    """
    platform = platform or sys.platform
    if platform == "win32":
        win = PureWindowsPath(str(db_path))
        drive = win.drive
        if drive.startswith("\\\\?\\"):
            # Extended-length prefix: "\\?\C:" or "\\?\UNC\server\share".
            drive = drive[4:]
            if drive.upper().startswith("UNC\\"):
                drive = "\\\\" + drive[4:]
        parts = win.parts[1:]  # drop the anchor, keep the path components
        if drive.startswith("\\\\"):
            host_share = drive[2:].replace("\\", "/")
            posix_path = "//" + "/".join((host_share, *parts))
        else:
            posix_path = "/" + "/".join((drive, *parts))
        # ``:`` stays literal so the drive letter keeps SQLite's documented
        # ``file:///C:/...`` shape (``Path.as_uri()`` leaves it unescaped too).
        return "file://" + quote(posix_path, safe="/:")
    posix_path = PurePosixPath(str(db_path)).as_posix()
    # Quote the filesystem BYTES, not the str: a POSIX path component that is
    # not valid UTF-8 is carried in the str as ``surrogateescape`` code points,
    # which ``quote(str)`` rejects with UnicodeEncodeError (the caller then
    # treats the db as unreadable and every agent-backed session vanishes).
    # ``Path.as_uri()`` — what master used — percent-encodes os.fsencode()
    # bytes; this keeps that behavior.
    return "file://" + quote_from_bytes(os.fsencode(posix_path), safe="/")


def state_db_readonly_uri(db_path, platform: str | None = None) -> str:
    """Strict read-only (``mode=ro``) form of :func:`state_db_file_uri`."""
    return state_db_file_uri(db_path, platform=platform) + "?mode=ro"


def open_state_db_readonly(db_path: Path, log: logging.Logger | None = None) -> sqlite3.Connection:
    """Open the live agent ``state.db`` read-only for a pure-read projection.

    Same rationale as the session-listing path (#5455): a write-capable handle
    on the multi-GB, WAL ``state.db`` while the agent streams into it adds
    needless checkpoint/lock surface. The read-only ``file:...?mode=ro`` URI
    avoids that. Read failures propagate; a reader never upgrades to a writer.

    The caller must ensure ``db_path`` exists — this raises ``FileNotFoundError``
    for a missing path rather than creating a ghost database.

    Callers own the returned connection (wrap it in ``contextlib.closing``).
    """
    if not db_path.exists():
        raise FileNotFoundError(f"agent state.db not found: {db_path}")
    return sqlite3.connect(state_db_readonly_uri(db_path.resolve()), uri=True)


MESSAGING_SOURCES = {
    'discord',
    'email',
    'wecom',
    'wecom_callback',
    'slack',
    'telegram',
    'weixin',
    'matrix',
    'signal',
}

CLI_MIN_UNTITLED_MESSAGE_COUNT = 6
CLI_MIN_UNTITLED_USER_MESSAGE_COUNT = 2

# Sub-second scheduling/write-order races during a compression/cli_close
# handoff can persist the continuation row with ``started_at`` a few
# milliseconds BEFORE the parent's ``ended_at`` lands (#6931). The tolerance
# below lets those rows still classify as the next segment; the fork /
# model_config branch-marker / cross-source / end_reason guards in
# ``_is_continuation_session`` already rule out unrelated rows, so a small
# window cannot collapse genuinely concurrently started children.
CONTINUATION_STARTED_AT_TOLERANCE_SECONDS = 2.0

# Accepted ``project_assignment`` values for read_importable_agent_session_rows.
PROJECT_ASSIGNMENT_FILTERS = frozenset({'assigned', 'unassigned'})

# Raw-row oversample factors for the bounded candidate window. ``limit`` counts
# LOGICAL conversations, but compression segments and the post-projection
# visibility filters are spent from the raw window first, so a single 8x pass can
# come up short on a lineage-heavy profile. The second factor is only paid when
# the first window was fully consumed AND still under-delivered.
CANDIDATE_WINDOW_MULTIPLIERS = (8, 32)

SOURCE_LABELS = {
    'acp': 'ACP',
    'api_server': 'API',
    'cli': 'CLI',
    'cron': 'Cron',
    'discord': 'Discord',
    'email': 'Email',
    'kanban': 'Kanban',
    'wecom': 'WeCom',
    'wecom_callback': 'WeCom Callback',
    'slack': 'Slack',
    'telegram': 'Telegram',
    'tool': 'Tool',
    'tui': 'TUI',
    'webhook': 'Webhook',
    'webui': 'WebUI',
    'weixin': 'Weixin',
    'matrix': 'Matrix',
    'signal': 'Signal',
}


def normalize_agent_session_source(raw_source: str | None) -> dict:
    """Return stable source metadata for Hermes Agent session rows.

    ``sessions.source`` is an Agent-level raw value. WebUI needs a smaller,
    durable contract so routes, SSE snapshots, and future sidebar policies do
    not each reimplement raw-source checks.
    """
    raw = str(raw_source or '').strip().lower() or 'unknown'

    if raw == 'webui':
        session_source = 'webui'
    elif raw in {'acp', 'cli', 'tui'}:
        # 'acp' (Agent Client Protocol adapter — Zed, external device bridges)
        # is a local interactive agent client like the CLI/TUI: its sessions
        # live only in state.db, so classifying it 'other' would leave them
        # invisible in both sidebar buckets (webui skips the state.db
        # projection; cli keeps only CLI-classified rows).
        session_source = 'cli'
    elif raw in MESSAGING_SOURCES:
        session_source = 'messaging'
    elif raw == 'cron':
        session_source = 'cron'
    elif raw == 'webhook':
        session_source = 'webhook'
    elif raw == 'kanban':
        session_source = 'kanban'
    elif raw == 'tool':
        session_source = 'tool'
    elif raw == 'api_server':
        session_source = 'api'
    else:
        session_source = 'other'

    label = SOURCE_LABELS.get(raw)
    if not label:
        label = raw.replace('_', ' ').title() if raw != 'unknown' else 'Agent'

    return {
        'raw_source': None if raw == 'unknown' else raw,
        'session_source': session_source,
        'source_label': label,
    }


def _with_normalized_source(row: dict) -> dict:
    normaliz
```

### Core Architecture Module: `api/auth.py`
```
"""
Hermes Web UI -- optional authentication.
Off by default. Enable by setting HERMES_WEBUI_PASSWORD, configuring a
password in Settings, registering passkeys, or configuring native OIDC SSO.
"""
import hashlib
import hmac
import http.cookies
import json
import logging
import os
import re
import secrets
import tempfile
import threading
import time
from pathlib import Path

from api.config import STATE_DIR, get_config, load_settings
from api.helpers import request_declares_body

logger = logging.getLogger(__name__)


# Default session TTL — 30 days. Kept as a module-level constant for backwards
# compatibility with downstream code and regression tests that import it.
# At runtime, prefer ``_resolve_session_ttl()`` which honours the env var and
# settings.json overrides; this constant is the floor / fallback.
SESSION_TTL = 86400 * 30  # 30 days


def _resolve_session_ttl() -> int:
    """Resolve session TTL from env > settings > default.

    Priority mirrors get_password_hash(): HERMES_WEBUI_SESSION_TTL env var
    first, then settings.json, falling back to ``SESSION_TTL`` (30 days).
    Clamped to [60s, 1 year] to prevent runaway cookies or self-lockout.
    """
    env_v = os.getenv('HERMES_WEBUI_SESSION_TTL', '').strip()
    if env_v.isdigit():
        val = int(env_v)
        if 60 <= val <= 86400 * 365:
            return val
    s = load_settings()
    v = s.get('session_ttl_seconds')
    if isinstance(v, int) and 60 <= v <= 86400 * 365:
        return v
    return SESSION_TTL


# ── Public paths (no auth required) ─────────────────────────────────────────
PUBLIC_PATHS = frozenset({
    '/login', '/health', '/favicon.ico', '/sw.js',
    '/api/auth/login', '/api/auth/status',
    '/api/auth/oidc/start', '/api/auth/oidc/callback',
    '/api/auth/passkey/options', '/api/auth/passkey/login',
    '/share',
    '/manifest.json', '/manifest.webmanifest',
    '/session/manifest.json', '/session/manifest.webmanifest',
})

COOKIE_NAME = 'hermes_session'
CSRF_HEADER_NAME = 'X-Hermes-CSRF-Token'


# RFC 6265 cookie-name token: a non-empty run of token chars
# (no controls, whitespace, or separators such as ';', '=', ',').
_COOKIE_NAME_RE = re.compile(r"^[-!#$%&'*+.^_`|~0-9A-Za-z]+$")


def _resolve_cookie_name() -> str:
    """Resolve the auth session cookie name from env > default.

    Honours ``HERMES_WEBUI_COOKIE_NAME`` so multiple WebUI instances sharing a
    hostname (different ports) can use distinct cookie names instead of
    trampling each other's session — browsers scope cookies by host, not
    host+port (RFC 6265). Falls back to ``COOKIE_NAME`` when the env var is
    unset, empty, or not a valid RFC 6265 token.
    """
    name = os.getenv('HERMES_WEBUI_COOKIE_NAME', '').strip()
    if not name:
        return COOKIE_NAME
    if _COOKIE_NAME_RE.match(name):
        return name
    logger.warning(
        'Ignoring invalid HERMES_WEBUI_COOKIE_NAME=%r; falling back to %r '
        '(name must be a valid RFC 6265 token)', name, COOKIE_NAME,
    )
    return COOKIE_NAME


def _warn_auth_persistence_failure(prefix: str, artifact: Path, exc: Exception, consequence: str) -> None:
    logger.warning(
        '%s at %s (STATE_DIR=%s): %s: %s; %s',
        prefix,
        artifact,
        STATE_DIR,
        exc.__class__.__name__,
        exc,
        consequence,
    )


_SESSIONS_FILE = STATE_DIR / '.sessions.json'
_TRUSTED_AUTH_HEADER_ENV = 'HERMES_WEBUI_TRUSTED_AUTH_HEADER'
_TRUSTED_GROUPS_HEADER_ENV = 'HERMES_WEBUI_TRUSTED_GROUPS_HEADER'
_TRUSTED_GROUP_PROFILE_MAP_ENV = 'HERMES_WEBUI_GROUP_PROFILE_MAP'
_TRUSTED_AUTH_LOGOUT_URL_ENV = 'HERMES_WEBUI_TRUSTED_AUTH_LOGOUT_URL'
# Opt-in: also treat '|' as a group separator in the trusted-groups header.
# Off by default so an existing deployment whose group NAME legitimately
# contains a literal '|' is never silently re-split into two groups (which
# could change its profile binding). Set to 1/true/yes/on for identity
# providers (some Authentik outpost configs) that emit "admins|developpeur".
_TRUSTED_GROUPS_PIPE_SEPARATOR_ENV = 'HERMES_WEBUI_TRUSTED_GROUPS_PIPE_SEPARATOR'
_TRUSTED_AUTH_WARNINGS_EMITTED: set[str] = set()


def _warn_trusted_auth_once(key: str, message: str, *args) -> None:
    if key in _TRUSTED_AUTH_WARNINGS_EMITTED:
        return
    _TRUSTED_AUTH_WARNINGS_EMITTED.add(key)
    logger.warning(message, *args)


def _session_expiry(record) -> float | None:
    if isinstance(record, dict):
        expiry = record.get('expiry', record.get('expires_at'))
    else:
        expiry = record
    try:
        expiry_f = float(expiry)
    except (TypeError, ValueError):
        return None
    return expiry_f


def _load_sessions() -> dict[str, float | dict]:
    """Load persisted sessions from STATE_DIR, pruning expired entries.

    Returns an empty dict on any read or parse error so startup is never
    blocked by a corrupt or missing sessions file.
    """
    try:
        if not _SESSIONS_FILE.exists():
            return {}
        raw = _SESSIONS_FILE.read_text(encoding='utf-8')
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError('malformed sessions file: expected dict')
    except OSError as e:
        _warn_auth_persistence_failure(
            'Auth session store read failed',
            _SESSIONS_FILE,
            e,
            'starting fresh with an empty session table',
        )
        return {}
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        _warn_auth_persistence_failure(
            'Ignoring malformed auth session store',
            _SESSIONS_FILE,
            e,
            'starting fresh with an empty session table',
        )
        return {}
    except Exception as e:
        _warn_auth_persistence_failure(
            'Ignoring malformed auth session store',
            _SESSIONS_FILE,
            e,
            'starting fresh with an empty session table',
        )
        return {}
    now = time.time()
    sessions: dict[str, float | dict] = {}
    for token, record in data.items():
        if not isinstance(token, str) or not token:
            continue
        expiry = _session_expiry(record)
        if expiry is None or expiry <= now:
            continue
        if isinstance(record, dict):
            normalized = dict(record)
            normalized['expiry'] = expiry
            sessions[token] = normalized
        else:
            sessions[token] = expiry
    return sessions


def _save_sessions(sessions: dict[str, float | dict]) -> None:
    """Atomically persist sessions to STATE_DIR/.sessions.json (0600).

    Uses a temp file + os.replace() so a crash mid-write never leaves a
    truncated file.  Mirrors the same pattern as .signing_key persistence.
    """
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=STATE_DIR, suffix='.sessions.tmp')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(sessions, f)
            os.chmod(tmp, 0o600)
            os.replace(tmp, _SESSIONS_FILE)
        except Exception:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise
    except Exception as e:
        _warn_auth_persistence_failure(
            'Auth session persistence failed',
            _SESSIONS_FILE,
            e,
            'keeping the in-process session table available',
        )


# Active sessions: token -> expiry timestamp (persisted across restarts via STATE_DIR)
_sessions = _load_sessions()
_SESSIONS_LOCK = threading.Lock()

# ── Login rate limiter ──────────────────────────────────────────────────────
_LOGIN_ATTEMPTS_FILE = STATE_DIR / '.login_attempts.json'
_LOGIN_MAX_ATTEMPTS = 5
_LOGIN_WINDOW = 60  # seconds


def _load_login_attempts() -> dict[str, list[float]]:
    """Load persisted login attempts from STATE_DIR, pruning expired entries."""
    try:
        if _LOGIN_ATTEMPTS_FILE.exists():
            data = js
```

### Core Architecture Module: `api/auth_oidc.py`
```
import copy
import base64
import hashlib
import ipaddress
import json
import logging
import math
import os
import secrets
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa, utils

from api.config import get_config

logger = logging.getLogger(__name__)

_DEFAULT_SCOPES = ("openid", "profile", "email")
_PENDING_TTL_SECONDS = 600
_MAX_PENDING_FLOWS = 128
_CLOCK_SKEW_SECONDS = 60
_CACHE_TTL_SECONDS = 300

_pending_lock = threading.Lock()
_pending_flows: dict[str, dict[str, Any]] = {}

_discovery_lock = threading.Lock()
_discovery_cache: dict[str, tuple[float, dict[str, Any]]] = {}

_jwks_lock = threading.Lock()
_jwks_cache: dict[str, tuple[float, dict[str, Any]]] = {}

_warned_allow_values: set[str] = set()

_ALLOW_VALUES_WHITESPACE_WARNING = (
    "webui_oidc.allow_values (HERMES_WEBUI_OIDC_ALLOW_VALUES) has one or more entries "
    "with internal whitespace; whitespace is not a value separator, so a value like "
    '"alice@example.com bob@example.com" is treated as a single entry. '
    'Use a comma-delimited scalar (e.g. "value1,value2") or a YAML array. '
    "If this is one intentional multi-word group, it is already correct and no action is needed."
)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class OIDCConfigError(Exception):
    pass


class OIDCAuthError(Exception):
    def __init__(self, message: str, *, status_code: int = 401):
        super().__init__(message)
        self.status_code = status_code


def is_oidc_enabled() -> bool:
    cfg = _resolve_oidc_config()
    return bool(
        cfg.get("issuer")
        and cfg.get("client_id")
        and cfg.get("allow_claim")
        and cfg.get("allow_values")
    )


def build_authorization_redirect(
    request_base_url: str,
    next_path: str | None = None,
) -> str:
    cfg = _require_oidc_config()
    discovery = _get_discovery_document(cfg["issuer"])
    authorization_endpoint = str(discovery.get("authorization_endpoint") or "").strip()
    if not authorization_endpoint:
        raise OIDCConfigError("OIDC discovery document is missing authorization_endpoint")
    redirect_uri = _resolve_redirect_uri(cfg, request_base_url)
    state = secrets.token_urlsafe(24)
    nonce = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(48)
    challenge = _b64u(hashlib.sha256(verifier.encode("ascii")).digest())
    _store_pending_flow(
        state,
        {
            "created_at": time.time(),
            "nonce": nonce,
            "code_verifier": verifier,
            "next_path": _safe_next_path(next_path),
        },
    )
    params = {
        "response_type": "code",
        "client_id": cfg["client_id"],
        "redirect_uri": redirect_uri,
        "scope": " ".join(cfg["scopes"]),
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return authorization_endpoint + "?" + urllib.parse.urlencode(params)


def complete_authorization_code_flow(
    request_base_url: str,
    state: str,
    code: str,
) -> dict[str, Any]:
    cfg = _require_oidc_config()
    pending = _consume_pending_flow(state)
    if pending is None:
        raise OIDCAuthError("Invalid OIDC state", status_code=401)
    discovery = _get_discovery_document(cfg["issuer"])
    discovery_issuer = str(discovery.get("issuer") or "").strip()
    if discovery_issuer and discovery_issuer != cfg["issuer"]:
        raise OIDCAuthError("OIDC discovery issuer did not match the configured issuer", status_code=502)
    token_endpoint = str(discovery.get("token_endpoint") or "").strip()
    if not token_endpoint:
        raise OIDCConfigError("OIDC discovery document is missing token_endpoint")
    redirect_uri = _resolve_redirect_uri(cfg, request_base_url)
    token_response = _post_form_json(
        token_endpoint,
        {
            "grant_type": "authorization_code",
            "client_id": cfg["client_id"],
            "code": code,
            "code_verifier": pending["code_verifier"],
            "redirect_uri": redirect_uri,
            **({"client_secret": cfg["client_secret"]} if cfg.get("client_secret") else {}),
        },
    )
    id_token = str(token_response.get("id_token") or "").strip()
    if not id_token:
        raise OIDCAuthError("OIDC token response did not include an id_token", status_code=502)
    claims = _validate_id_token(
        id_token,
        client_id=cfg["client_id"],
        issuer=cfg["issuer"],
        nonce=pending["nonce"],
        jwks_uri=str(discovery.get("jwks_uri") or "").strip(),
    )
    _enforce_allowlist(
        claims,
        allow_claim=cfg.get("allow_claim"),
        allow_values=cfg.get("allow_values") or [],
    )
    return {
        "next_path": pending["next_path"],
        "subject": str(claims.get("sub") or ""),
        "email": str(claims.get("email") or ""),
        "claims": claims,
    }


def _resolve_oidc_config() -> dict[str, Any]:
    raw = {}
    try:
        cfg = get_config()
        value = cfg.get("webui_oidc") if isinstance(cfg, dict) else None
        if isinstance(value, dict):
            raw.update(value)
    except Exception:
        logger.debug("Failed to read webui_oidc config", exc_info=True)

    def pick(name: str, env_name: str) -> Any:
        env_value = os.getenv(env_name)
        return env_value if env_value is not None else raw.get(name)

    scopes = _normalize_scopes(pick("scopes", "HERMES_WEBUI_OIDC_SCOPES"))
    raw_allow = pick("allow_values", "HERMES_WEBUI_OIDC_ALLOW_VALUES")
    allow_values = _normalize_allow_values(raw_allow)
    if (
        raw_allow is not None
        and not isinstance(raw_allow, (list, tuple, set))
        and any(any(ch.isspace() for ch in v) for v in allow_values)
    ):
        key = str(raw_allow)
        if key not in _warned_allow_values:
            _warned_allow_values.add(key)
            logger.warning(_ALLOW_VALUES_WHITESPACE_WARNING)
    return {
        "issuer": str(pick("issuer", "HERMES_WEBUI_OIDC_ISSUER") or "").strip(),
        "client_id": str(pick("client_id", "HERMES_WEBUI_OIDC_CLIENT_ID") or "").strip(),
        "client_secret": str(pick("client_secret", "HERMES_WEBUI_OIDC_CLIENT_SECRET") or "").strip(),
        "redirect_uri": str(pick("redirect_uri", "HERMES_WEBUI_OIDC_REDIRECT_URI") or "").strip(),
        "scopes": scopes,
        "allow_claim": str(pick("allow_claim", "HERMES_WEBUI_OIDC_ALLOW_CLAIM") or "").strip(),
        "allow_values": allow_values,
    }


def _require_oidc_config() -> dict[str, Any]:
    cfg = _resolve_oidc_config()
    if not cfg.get("issuer") or not cfg.get("client_id"):
        raise OIDCConfigError("Native OIDC login is not configured")
    if not cfg.get("allow_claim") or not cfg.get("allow_values"):
        raise OIDCConfigError(
            "Native OIDC login requires webui_oidc.allow_claim and allow_values"
        )
    return cfg


def _normalize_scopes(raw: Any) -> list[str]:
    items = _normalize_text_list(raw)
    if not items:
        return list(_DEFAULT_SCOPES)
    if "openid" not in items:
        items.insert(0, "openid")
    deduped = []
    seen = set()
    for item in items:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped


def _normalize_allow_values(raw: Any) -> list[str]:
    """Normalize allowlist values, splitting only on commas/newlines.

    Unlike ``_normalize_text_list`` (which also splits on whitespace), this
    preserves multi-word values such as OIDC group names containing spaces
    (e.g. ``"Hermes Users"`` stays as one entry).

    RFC 6749 §3.3 requires space-delimited scope strings, so
    ``_normalize_scopes`` must keep using ``_no
```

### Core Architecture Module: `api/background.py`
```
"""Background and ephemeral task tracking for /background and /btw commands."""
from __future__ import annotations

import logging
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

_lock = threading.Lock()

# parent_session_id -> list of task dicts
_BACKGROUND_TASKS: dict[str, list[dict[str, Any]]] = {}

# btw ephemeral session tracking: parent_sid -> {ephemeral_sid, stream_id, question}
_BTW_TRACKING: dict[str, dict[str, Any]] = {}


def track_background(parent_sid: str, bg_sid: str, stream_id: str,
                     task_id: str, prompt: str) -> None:
    with _lock:
        _BACKGROUND_TASKS.setdefault(parent_sid, []).append({
            "task_id": task_id,
            "bg_session_id": bg_sid,
            "stream_id": stream_id,
            "prompt": prompt,
            "status": "running",
            "started_at": time.time(),
            "answer": None,
            "completed_at": None,
        })


def track_btw(parent_sid: str, ephemeral_sid: str, stream_id: str,
              question: str) -> None:
    with _lock:
        _BTW_TRACKING[parent_sid] = {
            "ephemeral_session_id": ephemeral_sid,
            "stream_id": stream_id,
            "question": question,
        }


def complete_background(parent_sid: str, task_id: str, answer: str) -> None:
    with _lock:
        for t in _BACKGROUND_TASKS.get(parent_sid, []):
            if t["task_id"] == task_id and t["status"] == "running":
                t["status"] = "done"
                t["answer"] = answer
                t["completed_at"] = time.time()
                break


def get_results(parent_sid: str) -> list[dict[str, Any]]:
    """Return completed background task results and remove only the done ones
    from tracking.  Tasks still in ``status="running"`` MUST stay in the list
    so that ``complete_background()`` can still find them when the worker
    thread finishes — otherwise the first poll during a long-running task
    silently drops it and the result is lost forever.
    """
    with _lock:
        tasks = _BACKGROUND_TASKS.get(parent_sid, [])
        done = [t for t in tasks if t["status"] == "done"]
        still_running = [t for t in tasks if t["status"] != "done"]
        if still_running:
            _BACKGROUND_TASKS[parent_sid] = still_running
        else:
            _BACKGROUND_TASKS.pop(parent_sid, None)
        return [{
            "task_id": t["task_id"],
            "prompt": t["prompt"],
            "answer": t["answer"],
            "completed_at": t["completed_at"],
        } for t in done]


def get_background_tasks(parent_sid: str) -> list[dict[str, Any]]:
    """Return all background tasks (running and done) for a parent session."""
    with _lock:
        return list(_BACKGROUND_TASKS.get(parent_sid, []))


def cleanup_btw(parent_sid: str) -> dict[str, Any] | None:
    """Remove and return btw tracking for a parent session."""
    with _lock:
        return _BTW_TRACKING.pop(parent_sid, None)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7848** (2026-09-29): **bootstrap: probe imports PyYAML before the agent, so the WebUI never starts on PM-managed installs**
  *Symptoms*: # WebUI never starts after an agent update on PM-managed Hermes installs (probe imports PyYAML before the agent)  **Reporter:** Karl (self-hosted Hermes Agent + hermes-webui, Linux VM) **Versions:** hermes-webui `ff26335b`, hermes-agent `fae9e5677a` (`abandoned-rc.12-v0.21.5-23-gfae9e5677a`) **Severity:** service down, no user-visible cause — systemd restart loop  ## Summary  After `hermes update` on the agent, the WebUI no longer starts. `bootstrap.py` decides that *no* interpreter can run both the WebUI dependencies and the agent, aborts, and systemd restarts the unit forever. The check is wrong: the same interpreter passes when the two imports in the probe are swapped. **One-line fix below.**  ## What the user sees  ``` [bootstrap] ERROR: Python environment cannot import both WebUI dependencies and Hermes Agent. Set HERMES_WEBUI_PYTHON to the Hermes Agent venv Python or install the WebUI requirements into that environment. ```  followed by endless `Scheduled restart job, restart counter is at N`. In our case the counter reached **6459** before we intervened; the service was down for ~12 hours on one host and ~12 hours on a second host we run the same way — nobody was notified, because nothing watches the unit.  ## Root cause  `bootstrap.py:253` builds the probe as:  ```python script = "import yaml\nfrom run_agent import AIAgent\n" ```  and `_python_can_run_webui_and_agent()` runs it with `PYTHONPATH=<agent_dir>` — but it does not control the environment its statements end 
  **Post-Mortem & Fix Analysis**:
  > Unfortunately the proposed solution didn't work in my case. I see the problem involve more aspects, basically we have to: - detect precise location of python interpreter in the hermes pm-managed environment (it's python 3.14.x now) and put it into HERMES_WEBUI_PYTHON variable - install any our dependencies into that environment, and do it every time hermes update itself, e.g. uv pip install --python $HERMES_WEBUI_PYTHON pyyaml - set HERMES_DISABLE_LAZY_INSTALLS=1 
  > > Unfortunately the proposed solution didn't work in my case. I see the problem involve more aspects, basically we have to: > - detect precise location of python interpreter in the hermes pm-managed environment (it's python 3.14.x now) and put it into HERMES_WEBUI_PYTHON variable > - install any our dependencies into that environment, and do it every time hermes update itself, e.g. uv pip install --python $HERMES_WEBUI_PYTHON pyyaml > - set HERMES_DISABLE_LAZY_INSTALLS=1 >   Confirming the same breakage and non-successful workaround result on my system.
  > Thanks both — two independent reports of "the workaround didn't help" deserve to be kept separate from the import-order bug, because they point at a different gap: PyYAML not being reachable in the managed runtime at all. No import order can fix that.  **What we measured** on our installs (PM-managed, store python 3.14.7):  | probe | result | |---|---| | raw store interpreter, `import yaml` | `ModuleNotFoundError: No module named 'yaml'` | | agent venv, probe as shipped (`import yaml` first) | reproduces this issue — the `-I` relaunch re-runs the snippet and `yaml` is gone | | agent venv, agent imported first | passes | | `HERMES_WEBUI_PYTHON` → wrapper (reads the managed interpreter out of `hermes-agent/.hermes/bin/hermes`, adds the selected generation's `site-packages`), **old** probe order | passes — `yaml 6.0.3`, interpreter = store python |  Where `yaml` comes from in our case: the selected generation's venv, `<store>/installs/<id>/environments/<id>/venv/lib/python3.14/site-packag

- **Issue #7843** (2026-09-26): **Documented `venv/bin/python server.py` launch fails against current hermes-agent (managed runtime)**
  *Symptoms*: ### Environment - hermes-webui: commit `<git rev-parse --short HEAD>` - hermes-agent: 0.21.3 (`~/.hermes/hermes-agent`, editable install), updated via `hermes update` - Managed runtime: `~/.hermes/tools/python-3.14.7+20260901-linux-x64` - Legacy venv: `~/.hermes/hermes-agent/venv` (CPython 3.11.16, uv) - OS: `<distro/version>` in an LXC container; webui run as a systemd system unit  ### Summary After updating hermes-agent, `hermes-agent/venv/bin/python server.py` crashes at startup with `ModuleNotFoundError: No module named 'api'`. hermes-agent has moved to a managed runtime (`~/.hermes/tools/python-3.14…`) with PM-managed dependencies, and the venv is now treated as stale. Two things break the documented launch:  1. **Relaunch drops the script directory.** When `api/` imports a hermes-agent module,    `hermes_bootstrap` runs `prepare_launch()`, decides the 3.11 venv is stale, and `execv`s the    process as `python3.14 -I -c "…runpy.run_path('server.py')…"`. Neither `-I` nor    `runpy.run_path()` on a file adds the script's directory to `sys.path`, so the re-executed    process can't import the webui's own `api` package. 2. **Dependencies aren't visible until bootstrap runs.** Running the managed interpreter directly    (`python3.14 server.py`) avoids the relaunch, but then fails with `No module named 'yaml'`:  PyYAML and the rest of the agent's deps live in the PM environment that only gets activated by `import hermes_bootstrap`, which `server.py` never imports before its ow
  **Post-Mortem & Fix Analysis**:
  > Thanks @darrendavid for the exact direct-launch reproduction. The `yaml` dependency not activated in the managed interpreter and the WebUI `api` package lost after the isolated `runpy` relaunch are the same two failure signatures already tracked across platforms in #7831. Its current implementation lane is PR #7832; it is still open, not shipped or CI-clean.  I carried your distinct documentation acceptance into #7831: the `README.md` systemd example must either work across the PM runtime switch or be changed to a stable supported launcher, without pinning a versioned PM interpreter. Closing this report **as a duplicate, not as fixed** so the shared bootstrap defect and documentation check stay in one review lane. Thanks for the workaround and for identifying the stale published command.
  > I've been trying a couple of suggested fixes - https://github.com/nesquena/hermes-webui/issues/7843#issue-5590608909 is the only one that seems to work for me (on Linux)

- **Issue #7837** (2026-09-26): **WebUI crash-loops after a Hermes Agent interpreter bump: bootstrap.py compat check has an import-order bug, server.py loses its own sys.path on relaunch**
  *Symptoms*: ## Summary  After a Hermes Agent update that switched to a bundled/managed Python 3.14 interpreter, `ai.hermes.webui` crash-loops forever. `bootstrap.py` logs, on every restart:  ``` [bootstrap] Installing WebUI dependencies into local virtualenv [bootstrap] ERROR: Python environment cannot import both WebUI dependencies and Hermes Agent. Set HERMES_WEBUI_PYTHON to the Hermes Agent venv Python or install the WebUI requirements into that environment. ```  Reinstalling the local venv (as the message suggests) never helps, no matter how many times it retries. The message is also actively misleading — the two dependency sets *can* coexist in the same interpreter; the check that decides otherwise has an import-order bug. There's a second, related bug in `server.py` once that first check is worked around.  Reproduced against `v0.52.113` (current stable) and confirmed still present on `master` @ `ff26335b`.  ## Environment  - hermes-webui: `v0.52.113` (stable channel) / commit `5c161588` - hermes-agent: recently updated to require a bundled `python-3.14.7+...` runtime (a change from a prior Python 3.11 requirement) - macOS, launchd-managed `ai.hermes.webui` service  ## Root cause 1 — `bootstrap.py`'s compatibility check has an import-order bug  `bootstrap.py::_python_can_run_webui_and_agent()` probes an interpreter with:  ```python script = "import yaml\nfrom run_agent import AIAgent\n" ```  But importing `run_agent` triggers `hermes_bootstrap`, which (via `hermes_cli.venv_sync.prep
  **Post-Mortem & Fix Analysis**:
  > Thanks @psanger for the reproduction and PR #7838. Closing this report as a duplicate of #7831, not as fixed: both reports identify the same PM-managed interpreter relaunch, the `yaml`-before-Agent probe failure, and the lost WebUI `api` import root on the relaunched server. #7831 also carries independent macOS, Windows and Linux confirmations and the dependency-environment follow-up, so it is the best single issue for acceptance and cross-platform retesting.  Both #7832 (@AndreaB321, with managed-relaunch regression tests) and your #7838 are open implementation attempts; neither has shipped. The PR reviewers should reconcile them against the same two-path contract, preserve attribution, and verify the managed Python environment after relaunch. Thank you for the live startup evidence and the narrower alternative.

- **Issue #7831** (2026-09-29): **Bootstrap restart loop on PM-managed agent installs: probe imports yaml before run_agent (interpreter switch), server.py loses sys.path after relaunch**
  *Symptoms*: ## Summary  On a **PM-managed hermes-agent install** (agent v0.21.5, managed Python 3.14), the WebUI bootstrap enters an infinite launchd restart loop and the site serves **502** through its reverse tunnel, because the bootstrap capability probe and `server.py` module-level imports are both written for a **single** interpreter world. On PM-managed agent installs, importing the agent can **switch interpreters mid-process** (`hermes_bootstrap.prepare_launch` → `os.execv` into the PM store Python), and PM's `activate_dependencies` **rewrites `sys.path`** after the switch. Both assumptions break:  - the probe runs `import yaml` **before** `from run_agent import AIAgent` → passes on the checkout venv, but the relaunched world (isolated mode, own stdlib) has no `yaml` until PM activation runs → `ModuleNotFoundError: No module named 'yaml'` → probe False - bootstrap then tries "install WebUI dependencies into local virtualenv" → re-probe → same interpreter switch → same failure → `RuntimeError`, exit 1 → KeepAlive spawn/throttle loop (restart storm) - even in configurations where the probe passes, the spawned `server.py` dies at `from api.auth import ...` with `ModuleNotFoundError: No module named 'api'`: after the relaunch the file is executed via `runpy.run_path`, which does not guarantee the **script's own directory** on `sys.path`, and `activate_dependencies()` reorders/truncates `sys.path`  ## Environment  - macOS (Apple Silicon), WebUI supervised by launchd (`com.hermes.webui`
  **Post-Mortem & Fix Analysis**:
  > Confirming this on **native Windows 10** (no launchd), same PM-managed layout, same two signatures.  **Environment here** - Windows 10, hermes-agent 0.21.5 (git), PM store Python `tools\python-3.14.7+...` - stale checkout venv `hermes-agent\venv` = Python 3.11 (`pyvenv.cfg` -> `.hermes-runtime\...cpython-3.11`) - PM dependency env `installs\<id>\environments\<id>\venv` = 3.14 site-packages (`_pydantic_core.cp314-win_amd64.pyd`) - WebUI exp-v0.52.276 (head 5efc6354) on the failing box; the probe line is unchanged in exp-v0.52.339 (30b40743, 2026-09-22), so I expect it there too — I did not run 339 on this machine.  **Isolated measurements (plain shell, no supervisor)**  1. Store interpreter directly, `PYTHONPATH = <PM env>\Lib\site-packages;<repo>;<agent dir>`:    - `python -c "import yaml; from run_agent import AIAgent"` → OK    - the exact probe body as a two-line `-c` → OK 2. The same probe through `hermes-agent\venv\Scripts\python.exe` → **fails**, `ModuleNotFoundError: No module na
  >  Confirming this on **Linux** — Ubuntu 24.04 (x86_64), supervised by a **systemd** unit — so a third platform after macOS and Windows, with the same two signatures.  Two storms on the same day here, and they wore different faces:  | 2026-09-25 | unit starts | signature | |---|---|---| | morning, 10:14:57–15:58:01 | 924 | 883 × `[bootstrap] ERROR: Python environment cannot import both WebUI dependencies and Hermes Agent` | | evening, 19:24:00–20:26:03 | 305 | 304 × `ModuleNotFoundError: No module named 'yaml'` — zero RuntimeErrors |  That is 1,233 restarts in a single day, with the reverse proxy answering 502 for every profile while it lasted. The `No module named 'api'` signature shows up here too, at the tail of the morning storm (14:00 hour, 34×).  The trigger was visible in the filesystem: the agent venv (`/usr/local/lib/hermes-agent/venv`, Python 3.14.4) has an mtime of 19:23:19, about 40 seconds before the evening storm's first start. The launcher venv stayed on its own generation
  > Thanks for the three-platform confirmations and for offering to retest. I checked current `bootstrap.py:252-272`: the probe still imports `yaml` before `run_agent`; current `server.py` imports `api` at module scope without restoring the WebUI import root after a managed-runtime relaunch. This is a confirmed high-priority startup failure on affected PM-managed installs, not a general outage of all installs.  There are now two open, overlapping fixes: #7832 includes a controlled PM-style re-exec and isolated `runpy` regression test; #7838 brings an independently live-tested smaller change. Please don't race a third implementation. Review the two against the macOS/Windows/Linux reports here, including both the probe and server import paths and the final interpreter's dependency availability. #7837 is the duplicate report, now linked back here; neither PR is shipped yet.

- **Issue #7792** (2026-09-29): **Flaky: conversation-lifecycle terminal-error gate compares rendered clock time across settle/reload**
  *Symptoms*: ## Summary  `tests/browser_conversation_lifecycle.py` (the `live-to-final (terminal-error)` CI job) compares the settled and reloaded terminal rows' full visible `text`, which includes a locale-formatted clock time. When settlement and the post-reload snapshot fall on either side of a minute boundary, the assertion fails even though nothing regressed.  ## Evidence  Release PR #7791 (for #7578, which touches only `api/models.py`, `api/session_recovery.py` and its tests, none of them on this path) failed exactly one of 25 checks:  ``` CONVERSATION LIFECYCLE GATE FAILED:   settled_terminal.text  = 'Lifecycle gate encountered a terminal-side error.\n9:14 PM'   reloaded_terminal.text = 'Lifecycle gate encountered a terminal-side error.\n9:15 PM' ```  Every other field (role, rowId, source, classes) is identical. The five most recent master runs of the same job are all green.  ## Root cause  `tests/browser_conversation_lifecycle.py:1207`:  ```python assert settled_terminal[0]["text"] == reloaded_terminal[0]["text"], {...} ```  `_terminal_rows()` captures the row's rendered `innerText`, which ends with the relative/clock timestamp, so the equality depends on wall-clock time between two snapshots taken seconds apart.  ## Fix shape  Compare the terminal row without the rendered time: strip the trailing timestamp line (or read the row's message element rather than the whole row), or assert on `rowId` + `source` + a stable message selector. The semantic check at `_semantic_activity()` a
  **Post-Mortem & Fix Analysis**:
  > **Root cause confirmed on current `master`:** `tests/browser_conversation_lifecycle.py:1207` compares the terminal row's entire rendered `text` across settlement and reload. That text includes the locale-formatted clock, so a minute rollover can fail the gate despite identical terminal content and identity.  **Contributor pickup:** Please compare a stable terminal message payload (or strip only the separately rendered time), while continuing to assert `rowId`, source, error class and the settled/reloaded semantic activity. Add a regression that holds message identity/content fixed and advances the displayed clock across a minute boundary; include a negative control where the terminal message itself changes. The fix belongs in `tests/browser_conversation_lifecycle.py`, not in the product's terminal rendering. Open a focused PR referencing #7792. Marked `help wanted` and `sprint-candidate`.
  > 🤖 **Automated closure**: Merged PR #7602 to main branch on 2026-09-16 - 'fix(i18n): route sidebar source-tab labels through t() (#7580)'  *This issue was automatically closed by the GitHub issue state verifier based on strong evidence of completion.*

- **Issue #7735** (2026-09-23): **Flaky: test_get_available_models_ignores_legacy_disk_cache_and_rebuilds races the 4s live-rebuild budget**
  *Symptoms*: ## Flaky test: `test_get_available_models_ignores_legacy_disk_cache_and_rebuilds` races the 4 s live-rebuild budget  **Where:** `tests/test_model_cache_metadata.py::test_get_available_models_ignores_legacy_disk_cache_and_rebuilds`, reproduced on clean `master` at `30b407439`.  ### What happens  The test writes a legacy groups-only disk cache, then calls `config.get_available_models()` and expects the **rebuilt** result (with `active_provider` / `default_model`). That result is produced by the bounded live rebuild in `get_available_models()`. When the rebuild runs past `_LIVE_REBUILD_BUDGET_SECONDS` (default **4.0 s**, from `HERMES_WEBUI_MODELS_REBUILD_BUDGET`), the foreground caller logs  ``` live provider-catalog rebuild exceeded 4.0s budget — serving fallback, refreshing catalog out-of-band ```  and returns the shape-valid **stale disk groups** (`stale_disk_groups`, api/config.py `get_available_models` over-budget branch). So the assertion sees the legacy payload:  ``` AssertionError: assert 'active_provider' in {'groups': [{'provider': 'Legacy', ...}]} tests/test_model_cache_metadata.py:231 ```  On a loaded host the test's own rebuild takes ~4.3 s (`--durations` on the failing run: `4.29s call`), so the result depends on timing:  | run (clean master, isolated test) | result | |---|---| | default budget (4 s) | **fails** | | `HERMES_WEBUI_MODELS_REBUILD_BUDGET=0` (synchronous) | passes | | `HERMES_WEBUI_MODELS_REBUILD_BUDGET=60` | passes |  It also turns up in sharded full-

- **Issue #7726** (2026-09-23): **Flaky: test_delete_cli_session_still_opens_writable_connection fails only in single-process full-suite runs**
  *Symptoms*: ## Summary  `tests/test_state_db_readonly_reads_models.py::test_delete_cli_session_still_opens_writable_connection` fails **only** in a single-process full-suite run (`pytest tests/`). It passes on clean master, passes in isolation, and passes in the CI shard that owns it.  This is a pre-existing test-isolation defect, not a product bug. Filing so the noise does not keep getting attributed to unrelated PRs during release gating.  ## Evidence  | Run | Result | |---|---| | Clean master, file alone | 14/14 pass | | Feature branch, file alone | 14/14 pass | | **CI shard 2 of 3** (the shard that owns this test) | **5,456 passed, 0 failed** | | Single-process `pytest tests/` | **FAILS** at line 269 |  Failure text:  ``` tests/test_state_db_readonly_reads_models.py:269: AssertionError: delete_cli_session must keep its writable connection ```  ## Why it is order-dependent  The test is a **source-text oracle**. It does not call `delete_cli_session`; it reads the function's source and asserts on the characters in it:  ```python src = "\n".join((     inspect.getsource(models.delete_cli_session),     inspect.getsource(models._delete_cli_session_locked), )) assert "sqlite3.connect(str(db_path))" in src assert "open_state_db_readonly" not in src ```  `inspect.getsource()` resolves through whatever object is currently bound to that attribute. Any earlier test in the same process that wraps, decorates, reloads, or reassigns `models.delete_cli_session` and does not fully restore it makes `get
  **Post-Mortem & Fix Analysis**:
  > ## Summary  Reading `tests/test_state_db_readonly_reads_models.py:258-275`, `tests/test_issue1494_state_db_fd_leak.py:206-239`, and the live implementation in `api/models.py:11352-11405`, I agree this is test-isolation noise rather than evidence that the delete path became read-only. The failing test inspects whichever function objects are bound on the shared `api.models` module at that moment. More importantly, its intended contract is already covered by a stronger behavioral test that performs a real delete and verifies the committed rows are gone.  ## Code reference  The flaky assertion is purely textual (`tests/test_state_db_readonly_reads_models.py:263-274`):  ```python src = "\n".join((     inspect.getsource(models.delete_cli_session),     inspect.getsource(models._delete_cli_session_locked), )) assert "sqlite3.connect(str(db_path))" in src assert "open_state_db_readonly" not in src ```  Current `api/models.py:11391-11405` still opens the mutation transaction with a writable conn

- **Issue #7721** (2026-09-24): **MCP: same-named servers in different profiles share one connection; settings show another profile's status ("Active · N tools" with empty inventory); /reload-mcp resets every profile**
  *Symptoms*: ## Problem  Two profiles each configure an MCP server with the **same name**, for example `atlassian`. Profile `A` has `READ_ONLY_MODE=false` and profile `B` has `READ_ONLY_MODE=true`. The two profiles then share **one** MCP connection:  1. `A`'s chats only get the read-only tools: the MCP child process runs with `READ_ONLY_MODE=true`, although `A`'s `config.yaml` says `false`. 2. On `A`'s **Settings → MCP**, the server shows `Active · 58 tools`, while **MCP Tools** says *"No MCP tools are available from the active runtime inventory"*. 3. `/reload-mcp` does not fix it. It stops **every** profile's MCP servers, then rediscovers from the process-default profile's config. With hermes-agent v2026.9.21 it can also fail with `TypeError: sequence item 0: expected str instance, tuple found`.  Restarting the WebUI does not fix it either: whichever profile connects `atlassian` first owns the connection again.  Reported on a real deployment (`uvx mcp-atlassian==0.23.1`, Jira/Confluence Cloud). Reproduced locally without any account.  ## Reproduction (local, no credentials)  - `HERMES_HOME` with an empty `config.yaml`, plus `profiles/profile-read` and `profiles/profile-write`. - Each profile runs a local stdio FastMCP server named `atlassian`. It exposes `jira_get_issue`, and adds `jira_create_issue` only when `READ_ONLY_MODE=false`.  | Step | Observed | |---|---| | Chat on `profile-read`, then on `profile-write` | `profile-write` gets no `jira_create_issue`; the ledger holds a single ba
  **Post-Mortem & Fix Analysis**:
  > ## Summary  I confirmed this is a real cross-layer profile-isolation bug on current `master`, not a settings-only display defect. Three WebUI paths currently consume one process-global MCP view: a streaming turn rewrites `HERMES_HOME` before discovery, the settings endpoints read `get_mcp_status()` without a request-profile scope, and `/reload-mcp` performs a wildcard shutdown. Open PR #7720 targets all three WebUI seams. The chat-turn half still depends on the linked Hermes Agent change because the Agent decides whether to use scoped connection keys by comparing the task override with its process-home anchor.  ## Code reference  Reading `api/streaming.py:9854-9911`, the turn mirrors the selected profile into the process environment and then discovers MCP tools. The existing comment at `api/streaming.py:9899-9906` already documents the resulting bare-name collision for same-named servers.  The status projection at `api/routes.py:29038-29057` is also unscoped: `_mcp_runtime_status_by_na
  > Agent-side tracking issue with a two-temp-home reproduction: NousResearch/hermes-agent#119242 (fix: NousResearch/hermes-agent#119129).

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

### Incident Patch 1: `2c7dcf6d` (2026-09-29)
**Commit Message**: fix(test): use narrow regex substitution to strip trailing timestamp while preserving internal whitespace

**File**: `tests/browser_conversation_lifecycle.py` (modified, +8/-7)
```diff
@@ -630,14 +630,15 @@ def _expand_settled_worklog(page) -> None:
     )
 
 
+_RENDERED_TIMESTAMP_RE = re.compile(
+    r"(?:\r?\n)[ \t]*\d{1,2}:\d{2}(?::\d{2})?[ \t]*(?:AM|PM)?[ \t]*$",
+    re.IGNORECASE,
+)
+
+
 def _strip_rendered_timestamp(text: str) -> str:
-    """Strip trailing rendered clock timestamp from a row's innerText."""
-    lines = [line.strip() for line in (text or "").strip().splitlines() if line.strip()]
-    if not lines:
-        return ""
-    if len(lines) > 1 and re.match(r"^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?$", lines[-1]):
-        return "\n".join(lines[:-1])
-    return "\n".join(lines)
+    """Strip trailing rendered clock timestamp from a row's innerText, preserving all internal whitespace."""
+    return _RENDERED_TIMESTAMP_RE.sub("", text or "")
 
 
 def _terminal_rows(snapshot: dict) -> list[dict]:
```

**File**: `tests/test_strip_rendered_timestamp.py` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+"""Unit tests for _strip_rendered_timestamp in tests/browser_conversation_lifecycle.py (#7792)."""
+from tests.browser_conversation_lifecycle import _strip_rendered_timestamp
+
+
+def test_strip_rendered_timestamp_12hr():
+    assert _strip_rendered_timestamp("Alpha\n  12:34 PM") == "Alpha"
+    assert _strip_rendered_timestamp("Alpha\n1:23 am") == "Alpha"
+    assert _strip_rendered_timestamp("Alpha\n\t9:45 PM\t") == "Alpha"
+
+
+def test_strip_rendered_timestamp_24hr():
+    assert _strip_rendered_timestamp("Line 1\nLine 2\n14:05") == "Line 1\nLine 2"
+    assert _strip_rendered_timestamp("Process output\n23:59:59") == "Process output"
+
+
+def test_strip_rendered_timestamp_preserves_blank_lines():
+    text = "alpha\n\nbeta\n10:00 AM"
+    assert _strip_rendered_timestamp(text) == "alpha\n\nbeta"
+
+
+def test_strip_rendered_timestamp_preserves_indentation():
+    text = "  leading space\ntrailing space  \n\n11:22"
+    assert _strip_rendered_timestamp(text) == "  leading space\ntrailing space  \n"
+
+
+def test_strip_rendered_timestamp_no_timestamp():
+    text = "Just normal text\nwith multiple lines"
+    assert _strip_rendered_timestamp(text) == text
+    assert _strip_rendered_timestamp("") == ""
+    assert _strip_rendered_timestamp("Single line without newline") == "Single line without newline"
```

---

### Incident Patch 2: `708bcdbe` (2026-09-29)
**Commit Message**: fix(test): strip rendered clock timestamp in lifecycle gate assertions (#7792)

**File**: `tests/browser_conversation_lifecycle.py` (modified, +13/-2)
```diff
@@ -13,6 +13,7 @@
 
 import json
 import os
+import re
 import shutil
 import socket
 import subprocess
@@ -629,6 +630,16 @@ def _expand_settled_worklog(page) -> None:
     )
 
 
+def _strip_rendered_timestamp(text: str) -> str:
+    """Strip trailing rendered clock timestamp from a row's innerText."""
+    lines = [line.strip() for line in (text or "").strip().splitlines() if line.strip()]
+    if not lines:
+        return ""
+    if len(lines) > 1 and re.match(r"^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?$", lines[-1]):
+        return "\n".join(lines[:-1])
+    return "\n".join(lines)
+
+
 def _terminal_rows(snapshot: dict) -> list[dict]:
     return [row for row in snapshot["rows"] if row["role"] == "terminal"]
 
@@ -1196,15 +1207,15 @@ def _route_anchor_scene(route):
                 "settled_process": settled_process,
                 "reloaded_process": reloaded_process,
             }
-            assert settled_process[0]["text"] == reloaded_process[0]["text"], {
+            assert _strip_rendered_timestamp(settled_process[0]["text"]) == _strip_rendered_timestamp(reloaded_process[0]["text"]), {
                 "settled_process": settled_process,
                 "reloaded_process": reloaded_process,
             }
             assert len(settled_terminal) == len(reloaded_terminal) == 1, {
                 "settled_terminal": settled_terminal,
                 "reloaded_terminal": reloaded_terminal,
             }
-            assert settled_terminal[0]["text"] == reloaded_terminal[0]["text"], {
+            assert _strip_rendered_timestamp(settled_terminal[0]["text"]) == _strip_rendered_timestamp(reloaded_terminal[0]["text"]), {
                 "settled_terminal": settled_terminal[0],
                 "reloaded_terminal": reloaded_terminal[0],
             }
```

---

### Incident Patch 3: `4c133a46` (2026-09-29)
**Commit Message**: Merge branch 'master' into fix/subagent-title-prefix

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -44,6 +44,21 @@
 
 ### Fixed
 
+- **WebUI starts again after `hermes update` moves the Agent onto its managed runtime.** Current
+  Hermes Agent source installs relaunch any process that isn't on the Agent's managed interpreter,
+  and that managed environment ships `ruamel.yaml` but not necessarily PyYAML. WebUI then never
+  served: the bootstrap probe imported PyYAML before the Agent and rejected every interpreter (and
+  on some hosts tried to build a local venv and failed), and a direct `python server.py` launch died
+  on `No module named 'api'` or `'yaml'` after the relaunch. Startup now activates the Agent's
+  dependency layer (`hermes_bootstrap`) before any WebUI import that needs a third-party package,
+  without importing the Agent application before the active profile is selected (#7886), and keeps
+  its own directory importable through the relaunch. WebUI reads and writes YAML through a small
+  compatibility module that uses PyYAML when present and falls back to `ruamel.yaml` with the same
+  YAML 1.1 rules, so values like `tool_progress: off` keep their meaning, and the bootstrap probe
+  accepts either library. A broken Agent bootstrap now logs a warning instead of stopping WebUI.
+  The interim workaround `HERMES_DISABLE_LAZY_INSTALLS=1` is no longer needed. Thanks @snoyberg
+  (#7876) and @carlotestor (#7875); closes #7831, #7848.
+
 - **Gateway-backend turns survive a WebUI restart.** With the Gateway runs API enabled
   (`HERMES_WEBUI_CHAT_BACKEND=gateway` + `HERMES_WEBUI_GATEWAY_USE_RUNS_API=true`), the Gateway
   runs the turn, but restarting the WebUI still marked it interrupted, because the Gateway `run_id`
```

**File**: `api/config.py` (modified, +3/-3)
```diff
@@ -678,7 +678,7 @@ def _load_yaml_config_file_raw(config_path: Path, *, _copy: bool = True) -> dict
     mutates its input) pass _copy=False to skip the redundant copy on the hot path.
     """
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError:
         return {}
 
@@ -814,7 +814,7 @@ def _config_for_yaml_save(config_data: dict) -> dict:
 
 def _save_yaml_config_file(config_path: Path, config_data: dict) -> None:
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError as exc:
         raise RuntimeError("PyYAML is required to write Hermes config.yaml") from exc
 
@@ -7962,7 +7962,7 @@ def _declares_model_provider_kind(plugin_dir: Path) -> bool:
         except Exception:
             return False
         try:
-            import yaml as _yaml
+            from api import yaml_compat as _yaml
 
             data = _yaml.safe_load(text)
             if isinstance(data, dict):
```

**File**: `api/onboarding.py` (modified, +2/-2)
```diff
@@ -263,7 +263,7 @@ def _load_env_file(env_path: Path) -> dict[str, str]:
 
 def _load_yaml_config(config_path: Path) -> dict:
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError:
         return {}
 
@@ -278,7 +278,7 @@ def _load_yaml_config(config_path: Path) -> dict:
 
 def _save_yaml_config(config_path: Path, config: dict) -> None:
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError as exc:
         raise RuntimeError("PyYAML is required to write Hermes config.yaml") from exc
 
```

**File**: `api/profiles.py` (modified, +6/-6)
```diff
@@ -19,7 +19,7 @@
 from pathlib import Path
 from typing import Optional
 
-import yaml
+from api import yaml_compat as yaml
 
 from api.paths import _atomic_write_text
 from api.session_events import publish_session_list_changed
@@ -894,7 +894,7 @@ def get_profile_runtime_env(home: Path) -> dict[str, str]:
     env: dict[str, str] = {}
 
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
 
         cfg_path = home / 'config.yaml'
         cfg = _yaml.safe_load(cfg_path.read_text(encoding='utf-8')) if cfg_path.exists() else {}
@@ -1754,7 +1754,7 @@ def switch_profile(name: str, *, process_wide: bool = True) -> dict:
     else:
         # Direct disk read — does not touch _cfg_cache
         try:
-            import yaml as _yaml
+            from api import yaml_compat as _yaml
             cfg_path = home / 'config.yaml'
             cfg = _yaml.safe_load(cfg_path.read_text(encoding='utf-8')) if cfg_path.exists() else {}
             if not isinstance(cfg, dict):
@@ -1920,7 +1920,7 @@ def _compute_profile_skills_stats(profile_dir: Path) -> tuple[int, int]:
     config_path = profile_dir / "config.yaml"
     if config_path.exists():
         try:
-            import yaml as _yaml
+            from api import yaml_compat as _yaml
             cfg = _yaml.safe_load(config_path.read_text(encoding="utf-8"))
             if isinstance(cfg, dict):
                 skills_cfg = cfg.get("skills")
@@ -2447,7 +2447,7 @@ def _write_endpoint_to_config(profile_dir: Path, base_url: str = None, api_key:
         return
     config_path = profile_dir / 'config.yaml'
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError:
         return
     cfg = {}
@@ -2605,7 +2605,7 @@ def _write_model_defaults_to_config(
         return
     config_path = profile_dir / 'config.yaml'
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError:
         return
     cfg = {}
```

**File**: `api/providers.py` (modified, +1/-1)
```diff
@@ -3010,7 +3010,7 @@ def _clean_provider_key_from_config(provider_id: str) -> None:
         return
 
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
 
         changed = False
 
```

---

### Incident Patch 4: `43546c25` (2026-09-29)
**Commit Message**: fix(mcp): read the raw MCP config through api.yaml_compat

Master (exp-v0.52.380) routes all WebUI YAML through api.yaml_compat so WebUI runs in
a Hermes Agent managed environment without PyYAML. The new raw-config loader imported
yaml directly, so every MCP add/toggle/delete would 500 there, and
test_no_bare_pyyaml_imports_in_server_code fails. Found by the release gate.

Co-authored-by: franksong2702 <franksong2702@users.noreply.github.com>

**File**: `api/routes.py` (modified, +1/-1)
```diff
@@ -30396,7 +30396,7 @@ def _load_mcp_config_for_write(config_path: Path) -> dict:
     A config edit must do neither: preserve placeholders and let read/parse errors
     abort before the atomic save. Caller owns _cfg_lock for the whole transaction.
     """
-    import yaml
+    from api import yaml_compat as yaml
 
     try:
         raw = config_path.read_text(encoding="utf-8")
```

---

### Incident Patch 5: `0edf0a5e` (2026-09-29)
**Commit Message**: Merge master (exp-v0.52.380) into fix-mcp-config-write-transaction

**File**: `CHANGELOG.md` (modified, +23/-0)
```diff
@@ -44,6 +44,21 @@
 
 ### Fixed
 
+- **WebUI starts again after `hermes update` moves the Agent onto its managed runtime.** Current
+  Hermes Agent source installs relaunch any process that isn't on the Agent's managed interpreter,
+  and that managed environment ships `ruamel.yaml` but not necessarily PyYAML. WebUI then never
+  served: the bootstrap probe imported PyYAML before the Agent and rejected every interpreter (and
+  on some hosts tried to build a local venv and failed), and a direct `python server.py` launch died
+  on `No module named 'api'` or `'yaml'` after the relaunch. Startup now activates the Agent's
+  dependency layer (`hermes_bootstrap`) before any WebUI import that needs a third-party package,
+  without importing the Agent application before the active profile is selected (#7886), and keeps
+  its own directory importable through the relaunch. WebUI reads and writes YAML through a small
+  compatibility module that uses PyYAML when present and falls back to `ruamel.yaml` with the same
+  YAML 1.1 rules, so values like `tool_progress: off` keep their meaning, and the bootstrap probe
+  accepts either library. A broken Agent bootstrap now logs a warning instead of stopping WebUI.
+  The interim workaround `HERMES_DISABLE_LAZY_INSTALLS=1` is no longer needed. Thanks @snoyberg
+  (#7876) and @carlotestor (#7875); closes #7831, #7848.
+
 - **Gateway-backend turns survive a WebUI restart.** With the Gateway runs API enabled
   (`HERMES_WEBUI_CHAT_BACKEND=gateway` + `HERMES_WEBUI_GATEWAY_USE_RUNS_API=true`), the Gateway
   runs the turn, but restarting the WebUI still marked it interrupted, because the Gateway `run_id`
@@ -447,6 +462,14 @@
 
 ### Documentation
 
+- **The README's remote-access paragraph now leads with Tailscale Serve.** It sent users straight to a
+  `HERMES_WEBUI_HOST=0.0.0.0` bind, which contradicted the guide it links to. It now recommends Serve, which
+  keeps WebUI on loopback behind tailnet-only HTTPS, and keeps the authenticated direct-IP bind as the
+  fallback when Serve is unavailable. (#7420 by @taljeon)
+- **A Chinese remote-access guide.** `docs/remote-access-zh.md` covers Tailscale Serve, the direct tailnet-IP
+  fallback, SSH tunnels, a native-Windows setup with `start.ps1` (dependencies installed into the agent venv
+  that `start.ps1` actually uses, plus a Tailscale-only firewall rule), WSL-only login autostart, and the
+  security boundaries of each exposure level. The README links it. (#7814 by @happy5318)
 - **`AGENTS.md` now routes contributors to the references that match their change.** The old "read first" list asked for four files up front regardless of what was being changed, and carried a compressed copy of the ten change guidelines that `docs/GUIDELINES.md` owns. It now maps each reference to the kind of work it applies to and states explicit completion/verification criteria instead. No information is lost — the ten rules remain in `docs/GUIDELINES.md`, which the new version still points to. Thanks @steveafrost. (#7593)
 - **The `/api/models` cache invalidation contract is documented.** `#7556` shipped a change to the catalog cache's source fingerprint, and its review flagged the surrounding contract as undocumented runtime behavior. `docs/architecture/models-cache-invalidation.md` now records what is cached (in-memory snapshot, per-profile `models_cache.json`, cold vs hot path), the three source axes (`config_yaml` stat identity, `auth_json` content hash with a volatile-key deny-list, baked-in plus Codex catalog hashes) and why each is fingerprinted the way it is, and the invariant that both volatile-key sets are deny-lists that may only remove fields which provably do not gate the provider/model set. Changes no runtime behavior. Thanks @webtecnica. (#7560, #7556)
 
```

**File**: `README.md` (modified, +9/-1)
```diff
@@ -448,7 +448,14 @@ Set `environmentFiles` for secrets like API keys. Protected WebUI runtime keys f
 
 ### Remote access (SSH tunnel, Tailscale, phone)
 
-The server binds to `127.0.0.1` by default. To reach it from another machine use an SSH tunnel (`ssh -N -L 8787:127.0.0.1:8787 user@host`, which `start.sh` prints for you over SSH), or join your server and phone to a [Tailscale](https://tailscale.com) network and browse to `http://<server-tailscale-ip>:8787` with `HERMES_WEBUI_HOST=0.0.0.0` + `HERMES_WEBUI_PASSWORD` set. Full walkthrough (incl. a community ARM64-Android field report): [`docs/remote-access.md`](docs/remote-access.md).
+The server binds to `127.0.0.1` by default. To reach it from another machine,
+use an SSH tunnel (`ssh -N -L 8787:127.0.0.1:8787 user@host`, which `start.sh`
+prints for you over SSH) or, on a single-operator or access-restricted tailnet,
+use the preferred [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
+flow, which keeps WebUI on loopback behind tailnet-only HTTPS. Direct access to
+`http://<server-tailscale-ip>:8787` with `HERMES_WEBUI_HOST=0.0.0.0` and
+`HERMES_WEBUI_PASSWORD` is a fallback when Serve is unavailable. Full setup and
+the community ARM64-Android field report: [`docs/remote-access.md`](docs/remote-access.md).
 
 ### Manual launch (without start.sh)
 
@@ -684,6 +691,7 @@ The WebUI is still coupled to Hermes Agent internals for runtime execution, prov
 
 **Deploying & operating**
 - [`docs/remote-access.md`](docs/remote-access.md) — SSH tunnel, Tailscale, and phone access (incl. a community ARM64-Android field report)
+- [`docs/remote-access-zh.md`](docs/remote-access-zh.md) — 中文远程访问指南：Tailscale、SSH 隧道、Windows 原生部署（自启仅适用 WSL 用户）
 - [`docs/advanced-chat-setup.md`](docs/advanced-chat-setup.md) — optional dynamic recall-prefill and Gateway-backed browser chat for self-hosted deployments
 - [`docs/docker.md`](docs/docker.md) — Docker compose setup, common failures, and bind-mount migration
 - [`docs/supervisor.md`](docs/supervisor.md) — launchd, systemd, supervisord, runit, and s6 process-supervisor setup
```

**File**: `api/config.py` (modified, +3/-3)
```diff
@@ -678,7 +678,7 @@ def _load_yaml_config_file_raw(config_path: Path, *, _copy: bool = True) -> dict
     mutates its input) pass _copy=False to skip the redundant copy on the hot path.
     """
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError:
         return {}
 
@@ -814,7 +814,7 @@ def _config_for_yaml_save(config_data: dict) -> dict:
 
 def _save_yaml_config_file(config_path: Path, config_data: dict) -> None:
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError as exc:
         raise RuntimeError("PyYAML is required to write Hermes config.yaml") from exc
 
@@ -7962,7 +7962,7 @@ def _declares_model_provider_kind(plugin_dir: Path) -> bool:
         except Exception:
             return False
         try:
-            import yaml as _yaml
+            from api import yaml_compat as _yaml
 
             data = _yaml.safe_load(text)
             if isinstance(data, dict):
```

**File**: `api/onboarding.py` (modified, +2/-2)
```diff
@@ -263,7 +263,7 @@ def _load_env_file(env_path: Path) -> dict[str, str]:
 
 def _load_yaml_config(config_path: Path) -> dict:
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError:
         return {}
 
@@ -278,7 +278,7 @@ def _load_yaml_config(config_path: Path) -> dict:
 
 def _save_yaml_config(config_path: Path, config: dict) -> None:
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError as exc:
         raise RuntimeError("PyYAML is required to write Hermes config.yaml") from exc
 
```

**File**: `api/profiles.py` (modified, +6/-6)
```diff
@@ -19,7 +19,7 @@
 from pathlib import Path
 from typing import Optional
 
-import yaml
+from api import yaml_compat as yaml
 
 from api.paths import _atomic_write_text
 from api.session_events import publish_session_list_changed
@@ -894,7 +894,7 @@ def get_profile_runtime_env(home: Path) -> dict[str, str]:
     env: dict[str, str] = {}
 
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
 
         cfg_path = home / 'config.yaml'
         cfg = _yaml.safe_load(cfg_path.read_text(encoding='utf-8')) if cfg_path.exists() else {}
@@ -1754,7 +1754,7 @@ def switch_profile(name: str, *, process_wide: bool = True) -> dict:
     else:
         # Direct disk read — does not touch _cfg_cache
         try:
-            import yaml as _yaml
+            from api import yaml_compat as _yaml
             cfg_path = home / 'config.yaml'
             cfg = _yaml.safe_load(cfg_path.read_text(encoding='utf-8')) if cfg_path.exists() else {}
             if not isinstance(cfg, dict):
@@ -1920,7 +1920,7 @@ def _compute_profile_skills_stats(profile_dir: Path) -> tuple[int, int]:
     config_path = profile_dir / "config.yaml"
     if config_path.exists():
         try:
-            import yaml as _yaml
+            from api import yaml_compat as _yaml
             cfg = _yaml.safe_load(config_path.read_text(encoding="utf-8"))
             if isinstance(cfg, dict):
                 skills_cfg = cfg.get("skills")
@@ -2447,7 +2447,7 @@ def _write_endpoint_to_config(profile_dir: Path, base_url: str = None, api_key:
         return
     config_path = profile_dir / 'config.yaml'
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError:
         return
     cfg = {}
@@ -2605,7 +2605,7 @@ def _write_model_defaults_to_config(
         return
     config_path = profile_dir / 'config.yaml'
     try:
-        import yaml as _yaml
+        from api import yaml_compat as _yaml
     except ImportError:
         return
     cfg = {}
```

---

### Incident Patch 6: `bb5f43a1` (2026-09-29)
**Commit Message**: fix(yaml): load with PyYAML's exact rules on the ruamel fallback

Codex round 3 found two remaining load differences from PyYAML:
- ruamel's YAML 1.1 table makes bare y/n booleans; PyYAML keeps them strings, so
  model.default: n became False.
- ruamel refuses repeated '<<' merge keys that PyYAML merges in order; the load
  sites then saw {} and a save could erase the file.

safe_load now uses a resolver carrying PyYAML's own implicit-typing table and a
SafeConstructor with PyYAML's flatten_mapping and last-value-wins duplicate keys.
Dumping still uses ruamel's YAML 1.1 resolver, which quotes every ambiguous string.
A differential corpus (bools, y/n, octal, sexagesimal, floats, dates, nulls, merges,
duplicates, tags, block scalars, unicode) shows zero differences from PyYAML on
ruamel 0.18.16 and 0.18.17, and dump output reads back unchanged by both.

Also import importlib.util in the real-Agent profile test's child script.

Co-authored-by: carlotestor <carlotestor@users.noreply.github.com>

**File**: `api/yaml_compat.py` (modified, +134/-52)
```diff
@@ -3,17 +3,23 @@
 Hermes Agent's managed dependency environment ships ruamel.yaml only, so WebUI code
 imports YAML through this module instead of assuming PyYAML is installed.
 
-The ruamel fallback keeps PyYAML's YAML 1.1 semantics. ruamel defaults to YAML 1.2,
-where only ``true``/``false`` are booleans: it would load ``on``/``off``/``yes``/``no``
-as strings, and dump the strings ``"off"``/``"no"`` unquoted, which PyYAML and the
-Agent's own reader (``hermes_yaml``, also pinned to 1.1) then read back as booleans.
-``tool_progress: off`` is a real Hermes setting, so a save through a 1.2 dumper would
-silently change it.
+The ruamel fallback reproduces PyYAML's behaviour, because the files it reads were
+written by PyYAML (and by the Agent's ``hermes_yaml``, which is also YAML 1.1):
+
+* Loading uses PyYAML's own implicit-typing rules (``on``/``off``/``yes``/``no`` are
+  booleans, bare ``y``/``n`` stay strings, ``010`` is octal, dates are dates), a
+  repeated key keeps its last value, and repeated ``<<`` merge keys merge in order.
+  ruamel's defaults differ on each point, and every WebUI load site treats a parse
+  error as an empty config, so a later save would overwrite the user's file.
+* Dumping uses ruamel's YAML 1.1 resolver (as ``hermes_yaml`` does), which quotes
+  every string PyYAML or the Agent could read back as a non-string, so saving
+  ``tool_progress: 'off'`` keeps it a string. No ``%YAML`` directive is written.
 """
 
 from __future__ import annotations
 
 import io
+import re
 
 try:
     import yaml as _pyyaml
@@ -24,35 +30,133 @@
 BACKEND = "pyyaml" if _pyyaml is not None else "ruamel"
 
 _YAML11 = (1, 1)
-_resolver_cls = None
 
-
-def _yaml11_resolver():
-    """A resolver that applies YAML 1.1 implicit typing without writing a %YAML directive."""
-    global _resolver_cls
-    if _resolver_cls is None:
+# PyYAML's implicit resolvers (yaml/resolver.py), verbatim, in PyYAML's order.
+_PYYAML_IMPLICIT = (
+    ("tag:yaml.org,2002:bool",
+     r"""^(?:yes|Yes|YES|no|No|NO
+        |true|True|TRUE|false|False|FALSE
+        |on|On|ON|off|Off|OFF)$""",
+     "yYnNtTfFoO"),
+    ("tag:yaml.org,2002:float",
+     r"""^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?
+        |\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?
+        |[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*
+        |[-+]?\.(?:inf|Inf|INF)
+        |\.(?:nan|NaN|NAN))$""",
+     "-+0123456789."),
+    ("tag:yaml.org,2002:int",
+     r"""^(?:[-+]?0b[0-1_]+
+        |[-+]?0[0-7_]+
+        |[-+]?(?:0|[1-9][0-9_]*)
+        |[-+]?0x[0-9a-fA-F_]+
+        |[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$""",
+     "-+0123456789"),
+    ("tag:yaml.org,2002:merge", r"^(?:<<)$", "<"),
+    ("tag:yaml.org,2002:null",
+     r"""^(?: ~
+        |null|Null|NULL
+        | )$""",
+     ("~", "n", "N", "")),
+    ("tag:yaml.org,2002:timestamp",
+     r"""^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]
+        |[0-9][0-9][0-9][0-9] -[0-9][0-9]? -[0-9][0-9]?
+         (?:[Tt]|[ \t]+)[0-9][0-9]?
+         :[0-9][0-9] :[0-9][0-9] (?:\.[0-9]*)?
+         (?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$""",
+     "0123456789"),
+    ("tag:yaml.org,2002:value", r"^(?:=)$", "="),
+)
+
+_classes: dict = {}
+
+
+def _ruamel_classes():
+    """Build (once) the ruamel resolver/constructor subclasses; None parts if unavailable."""
+    if _classes:
+        return _classes
+    try:
+        from ruamel.yaml.constructor import ConstructorError, SafeConstructor
+        from ruamel.yaml.nodes import MappingNode, SequenceNode
         from ruamel.yaml.resolver import VersionedResolver
-
-        class _Yaml11Resolver(VersionedResolver):
-            @property
-            def processing_version(self):
-                return _YAML11
-
-        _resolver_cls = _Yaml11Resolver
-    return _resolver_cls
+    except ImportError:  # minimal/stub ruamel without these modules
+        _classes.update(dump_resolver=None, load_resolver=None, constructor=None)
+        return _classes
+
+    cla
```

**File**: `tests/test_managed_profile_startup.py` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ def test_real_managed_bootstrap_preserves_named_profile_concurrency(tmp_path):
         env["TMPDIR"] = os.environ["TMPDIR"]
     result = subprocess.run(
         [python, "-c", textwrap.dedent('''
-            import importlib, json, os, sys, sysconfig, threading, types
+            import importlib, importlib.util, json, os, sys, sysconfig, threading, types
             from pathlib import Path
 
             def deny_external_effects(event, args):
```

**File**: `tests/test_yaml_ruamel_fallback.py` (modified, +29/-0)
```diff
@@ -97,6 +97,35 @@ def test_ruamel_load_duplicate_keys_last_wins_like_pyyaml(ruamel_compat):
     assert ruamel_compat.safe_load(doc) == {"model": "b", "display": {"tool_progress": False}}
 
 
+def test_ruamel_load_bare_y_n_stay_strings_like_pyyaml(ruamel_compat):
+    # ruamel's YAML 1.1 table makes bare y/n booleans; PyYAML (and every file it wrote) keeps them strings.
+    assert ruamel_compat.safe_load("model:\n  default: n\nflag: y\n") == {"model": {"default": "n"}, "flag": "y"}
+
+
+def test_ruamel_load_repeated_merge_keys_like_pyyaml(ruamel_compat):
+    doc = "b: &b {x: 1, y: 2}\no: &o {y: 3, z: 4}\nm:\n  <<: *b\n  <<: *o\n  w: 5\n"
+    loaded = ruamel_compat.safe_load(doc)
+    assert loaded["m"] == {"x": 1, "y": 3, "z": 4, "w": 5}
+
+
+def test_ruamel_load_matches_pyyaml_on_corpus(ruamel_compat):
+    corpus = (
+        "o: 010\np: 0x1F\nq: 1:30\nr: 1_000\ns: 1e3\nt: 1.5\nu: .inf\n",
+        "d: 2026-01-01\ne: ~\nf: null\ng:\nh: Null\n",
+        "base: &b {x: 1}\nm:\n  <<: [*b, {x: 9, q: 1}]\n  x: 7\n",
+        "=: value\n",
+    )
+    for doc in corpus:
+        out = subprocess.run(
+            [sys.executable, "-c",
+             "import sys, yaml; print(repr(yaml.safe_load(sys.argv[1])), end='')", doc],
+            capture_output=True, text=True,
+        )
+        if out.returncode != 0:
+            pytest.skip("PyYAML not installed in test interpreter")
+        assert repr(ruamel_compat.safe_load(doc)) == out.stdout, doc
+
+
 @pytest.mark.parametrize("fn", ["safe_dump", "dump"])
 def test_ruamel_dump_quotes_yaml11_ambiguous_strings(ruamel_compat, fn):
     text = getattr(ruamel_compat, fn)(YAML11_STRINGS, sort_keys=False, allow_unicode=True)
```

---

### Incident Patch 7: `71a2efd2` (2026-09-29)
**Commit Message**: fix(startup,yaml): keep legacy Agent sys.path order; PyYAML duplicate-key semantics on ruamel

Opus review follow-ups on the combined stage:
- Only move the Agent dir to the front of sys.path when it has hermes_bootstrap.
  Older Agents keep api.config's append-at-END placement, which exists so
  pip install -t . packages in a checkout do not shadow site-packages.
- ruamel raises DuplicateKeyError where PyYAML keeps the last value. Every WebUI
  load site swallows parse errors to {}, and a later save would overwrite the
  user's file with that view. Use a SafeConstructor whose duplicate-key check keeps
  the last value, matching PyYAML.
- tests/test_managed_profile_startup.py skips when the test interpreter cannot
  import ruamel.yaml (the installed Agent's hermes_yaml needs it); add ruamel.yaml
  to requirements-dev.txt so the fallback tests run under scripts/test.sh.

Co-authored-by: carlotestor <carlotestor@users.noreply.github.com>
Co-authored-by: snoyberg <snoyberg@users.noreply.github.com>

**File**: `api/yaml_compat.py` (modified, +26/-0)
```diff
@@ -65,9 +65,35 @@ def safe_load(stream):
 
     y = YAML(typ="safe", pure=True)
     y.version = _YAML11
+    # PyYAML keeps the LAST value of a duplicated key; ruamel raises by default and
+    # keeps the FIRST with allow_duplicate_keys. A config that loaded on PyYAML must
+    # not turn into {} here (a later WebUI save would then overwrite the file).
+    constructor_cls = _last_value_wins_constructor()
+    if constructor_cls is not None:
+        y.Constructor = constructor_cls
     return y.load(stream)
 
 
+_constructor_cls = None
+
+
+def _last_value_wins_constructor():
+    """A SafeConstructor whose duplicate-key check keeps the last value, as PyYAML does."""
+    global _constructor_cls
+    if _constructor_cls is None:
+        try:
+            from ruamel.yaml.constructor import SafeConstructor
+        except ImportError:  # minimal/stub ruamel without the constructor module
+            return None
+
+        class _LastValueWinsConstructor(SafeConstructor):
+            def check_mapping_key(self, node, key_node, mapping, key, value):
+                return True
+
+        _constructor_cls = _LastValueWinsConstructor
+    return _constructor_cls
+
+
 def _ruamel_dump(data, stream, **options):
     y = _ruamel(**options)
     if stream is not None:
```

**File**: `managed_agent_startup.py` (modified, +7/-4)
```diff
@@ -17,13 +17,16 @@ def activate_managed_agent() -> None:
     webui_root = str(Path(__file__).resolve().parent)
     if webui_root not in sys.path:
         sys.path.insert(0, webui_root)
-    # Bootstrap's probe adds the checkout to its own PYTHONPATH, not ours.
-    if agent_dir not in sys.path:
-        sys.path.insert(1, agent_dir)
     # Activate dependencies without importing the application: api.config must
     # select the active profile before Agent modules cache profile-sensitive paths.
-    # Older Agents and browser-only shims have no bootstrap layer to activate.
+    # Older Agents and browser-only shims have no bootstrap layer to activate; for
+    # them leave sys.path alone so api.config appends the Agent dir at the END as
+    # before (a front position lets `pip install -t .` packages in the checkout
+    # shadow site-packages).
     if (Path(agent_dir) / "hermes_bootstrap.py").is_file():
+        # Bootstrap's probe adds the checkout to its own PYTHONPATH, not ours.
+        if agent_dir not in sys.path:
+            sys.path.insert(1, agent_dir)
         try:
             importlib.import_module("hermes_bootstrap")
         except Exception as exc:  # noqa: BLE001 - SystemExit (relaunch/repair exit) still propagates
```

**File**: `requirements-dev.txt` (modified, +3/-0)
```diff
@@ -16,3 +16,6 @@ mcp>=1.28,<2
 python-docx
 openpyxl
 python-pptx
+# ruamel.yaml: the YAML fallback used when WebUI runs inside a Hermes Agent managed
+# environment that has no PyYAML (api/yaml_compat.py). Installed here so its tests run.
+ruamel.yaml>=0.18
```

**File**: `tests/test_managed_profile_startup.py` (modified, +8/-1)
```diff
@@ -28,6 +28,13 @@ def test_real_managed_bootstrap_preserves_named_profile_concurrency(tmp_path):
         agent_dir = str(Path(spec.origin).parent)
     if not (Path(agent_dir) / "pm" / "environments.py").is_file():
         pytest.skip("requires a package-managed Hermes Agent")
+    python = os.environ.get("HERMES_WEBUI_PYTHON", sys.executable)
+    # The installed Agent's first-party YAML (hermes_yaml) needs ruamel.yaml; an
+    # interpreter without it cannot import run_agent at all, so the scenario this
+    # test models (a working managed runtime) does not exist there.
+    probe = subprocess.run([python, "-c", "import ruamel.yaml"], capture_output=True)
+    if probe.returncode != 0:
+        pytest.skip("test interpreter cannot import ruamel.yaml (required by the installed Agent)")
     base = tmp_path / "base"
     home = base / "profiles" / "rocky"
     skill = home / "skills" / "named-only"
@@ -55,7 +62,7 @@ def test_real_managed_bootstrap_preserves_named_profile_concurrency(tmp_path):
     if "TMPDIR" in os.environ:
         env["TMPDIR"] = os.environ["TMPDIR"]
     result = subprocess.run(
-        [os.environ.get("HERMES_WEBUI_PYTHON", sys.executable), "-c", textwrap.dedent('''
+        [python, "-c", textwrap.dedent('''
             import importlib, json, os, sys, sysconfig, threading, types
             from pathlib import Path
 
```

**File**: `tests/test_managed_runtime_startup.py` (modified, +22/-0)
```diff
@@ -97,6 +97,28 @@ def test_server_warns_and_continues_on_bootstrap_internal_import_failure(tmp_pat
     assert "deliberately_missing_agent_dependency" in result.stderr
 
 
+def test_legacy_agent_without_bootstrap_is_not_put_at_front_of_sys_path(tmp_path):
+    """Older Agents keep api.config's append-at-END placement (pip -t . shadowing guard)."""
+    agent_dir = tmp_path / "legacy-agent"
+    agent_dir.mkdir()
+    (agent_dir / "run_agent.py").write_text("class AIAgent: pass\n", encoding="utf-8")
+    env = os.environ.copy()
+    env.pop("PYTHONPATH", None)
+    env["HERMES_WEBUI_AGENT_DIR"] = str(agent_dir)
+    script = (
+        "import sys, managed_agent_startup as m\n"
+        "m.activate_managed_agent()\n"
+        "print('INDEX', sys.path.index(sys.argv[1]) if sys.argv[1] in sys.path else -1)\n"
+    )
+    result = subprocess.run(
+        [sys.executable, "-c", script, str(agent_dir)],
+        cwd=os.path.dirname(os.path.dirname(__file__)), env=env,
+        capture_output=True, text=True, timeout=30,
+    )
+    assert result.returncode == 0, result.stderr
+    assert "INDEX -1" in result.stdout
+
+
 def test_server_propagates_bootstrap_system_exit(tmp_path):
     """The Agent's own relaunch/repair exit (SystemExit) is not swallowed."""
     agent_dir = tmp_path / "exiting-agent"
```

---

### Incident Patch 8: `119f9af7` (2026-09-29)
**Commit Message**: docs(changelog): managed-runtime startup fix (#7876, #7875)

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -44,6 +44,21 @@
 
 ### Fixed
 
+- **WebUI starts again after `hermes update` moves the Agent onto its managed runtime.** Current
+  Hermes Agent source installs relaunch any process that isn't on the Agent's managed interpreter,
+  and that managed environment ships `ruamel.yaml` but not necessarily PyYAML. WebUI then never
+  served: the bootstrap probe imported PyYAML before the Agent and rejected every interpreter (and
+  on some hosts tried to build a local venv and failed), and a direct `python server.py` launch died
+  on `No module named 'api'` or `'yaml'` after the relaunch. Startup now activates the Agent's
+  dependency layer (`hermes_bootstrap`) before any WebUI import that needs a third-party package,
+  without importing the Agent application before the active profile is selected (#7886), and keeps
+  its own directory importable through the relaunch. WebUI reads and writes YAML through a small
+  compatibility module that uses PyYAML when present and falls back to `ruamel.yaml` with the same
+  YAML 1.1 rules, so values like `tool_progress: off` keep their meaning, and the bootstrap probe
+  accepts either library. A broken Agent bootstrap now logs a warning instead of stopping WebUI.
+  The interim workaround `HERMES_DISABLE_LAZY_INSTALLS=1` is no longer needed. Thanks @snoyberg
+  (#7876) and @carlotestor (#7875); closes #7831, #7848.
+
 - **Gateway-backend turns survive a WebUI restart.** With the Gateway runs API enabled
   (`HERMES_WEBUI_CHAT_BACKEND=gateway` + `HERMES_WEBUI_GATEWAY_USE_RUNS_API=true`), the Gateway
   runs the turn, but restarting the WebUI still marked it interrupted, because the Gateway `run_id`
```

---

### Incident Patch 9: `ea523f3b` (2026-09-29)
**Commit Message**: fix(startup): warn and continue when early Agent bootstrap activation fails

The early hermes_bootstrap import let any ImportError inside a present Agent abort
WebUI startup. Before this hook the Agent import was lazy (get_ai_agent_class
returns None on ImportError), so a broken Agent only disabled chat while the UI,
diagnostics and updater stayed reachable. Log a warning and continue; the Agent's
own relaunch/repair SystemExit still propagates. Found by the Codex regression gate.

Co-authored-by: snoyberg <snoyberg@users.noreply.github.com>

**File**: `docs/troubleshooting.md` (modified, +4/-2)
```diff
@@ -119,8 +119,10 @@ and force turns and model-catalog scopes into the legacy whole-turn lock.
 The dependency layer retains Agent-owned activation and re-exec behavior; WebUI
 does not choose generation directories or install into an obsolete Agent venv.
 Legacy Agents and browser-only fixtures without `hermes_bootstrap.py` skip this
-early activation. Failures inside a present bootstrap are surfaced, not treated
-as an absent Agent. The interpreter compatibility probe may still import
+early activation. A failure inside a present bootstrap is logged as a warning
+and startup continues, as it did when the Agent import was lazy, so the UI,
+diagnostics and updater stay reachable; the Agent's own relaunch or repair exit
+still stops the process. The interpreter compatibility probe may still import
 `run_agent` in its disposable subprocess; that import must not leak into server
 startup. If a restart fails, inspect the current service journal and selected
 interpreter. This ordering repair does not remove the static fallback lock or
```

**File**: `managed_agent_startup.py` (modified, +13/-1)
```diff
@@ -24,4 +24,16 @@ def activate_managed_agent() -> None:
     # select the active profile before Agent modules cache profile-sensitive paths.
     # Older Agents and browser-only shims have no bootstrap layer to activate.
     if (Path(agent_dir) / "hermes_bootstrap.py").is_file():
-        importlib.import_module("hermes_bootstrap")
+        try:
+            importlib.import_module("hermes_bootstrap")
+        except Exception as exc:  # noqa: BLE001 - SystemExit (relaunch/repair exit) still propagates
+            # A broken Agent must not stop WebUI from starting: before this hook the
+            # Agent import was lazy and an ImportError only disabled chat, leaving the
+            # UI, diagnostics and updater reachable. Keep that behavior.
+            print(
+                f"[!!] Hermes Agent dependency activation failed: {type(exc).__name__}: {exc}; "
+                "continuing startup. If WebUI then fails to import a dependency, run "
+                "`hermes pm repair` or set HERMES_WEBUI_PYTHON.",
+                file=sys.stderr,
+                flush=True,
+            )
```

**File**: `tests/test_managed_runtime_startup.py` (modified, +25/-4)
```diff
@@ -74,7 +74,8 @@ def test_server_starts_without_agent_class(tmp_path, agent_source):
     assert result.returncode == 0, result.stderr
 
 
-def test_server_does_not_hide_bootstrap_internal_import_failure(tmp_path):
+def test_server_warns_and_continues_on_bootstrap_internal_import_failure(tmp_path):
+    """A broken Agent bootstrap must not abort WebUI startup (master's lazy import tolerated it)."""
     agent_dir = tmp_path / "broken-agent"
     agent_dir.mkdir()
     (agent_dir / "run_agent.py").write_text("class AIAgent: pass\n", encoding="utf-8")
@@ -86,12 +87,32 @@ def test_server_does_not_hide_bootstrap_internal_import_failure(tmp_path):
     env.pop("PYTHONPATH", None)
     env["HERMES_WEBUI_AGENT_DIR"] = str(agent_dir)
     result = subprocess.run(
-        [sys.executable, "-c", "import server"],
+        [sys.executable, "-c", "import server; print('SERVER_IMPORTED')"],
         cwd=os.path.dirname(os.path.dirname(__file__)), env=env,
         capture_output=True, text=True, timeout=30,
     )
-    assert result.returncode != 0
-    assert "No module named 'deliberately_missing_agent_dependency'" in result.stderr
+    assert result.returncode == 0, result.stderr
+    assert "SERVER_IMPORTED" in result.stdout
+    assert "Hermes Agent dependency activation failed" in result.stderr
+    assert "deliberately_missing_agent_dependency" in result.stderr
+
+
+def test_server_propagates_bootstrap_system_exit(tmp_path):
+    """The Agent's own relaunch/repair exit (SystemExit) is not swallowed."""
+    agent_dir = tmp_path / "exiting-agent"
+    agent_dir.mkdir()
+    (agent_dir / "run_agent.py").write_text("class AIAgent: pass\n", encoding="utf-8")
+    (agent_dir / "hermes_bootstrap.py").write_text("raise SystemExit(7)\n", encoding="utf-8")
+    env = os.environ.copy()
+    env.pop("PYTHONPATH", None)
+    env["HERMES_WEBUI_AGENT_DIR"] = str(agent_dir)
+    result = subprocess.run(
+        [sys.executable, "-c", "import server; print('SERVER_IMPORTED')"],
+        cwd=os.path.dirname(os.path.dirname(__file__)), env=env,
+        capture_output=True, text=True, timeout=30,
+    )
+    assert result.returncode == 7
+    assert "SERVER_IMPORTED" not in result.stdout
 
 
 @pytest.mark.parametrize("with_bootstrap", [False, True])
```

---

### Incident Patch 10: `2e5432f4` (2026-09-29)
**Commit Message**: fix(yaml): keep YAML 1.1 semantics on the ruamel fallback; align startup test with #7876

ruamel defaults to YAML 1.2, so the fallback loaded on/off/yes/no as strings and
dumped the strings 'off'/'no' unquoted. PyYAML and the Agent's hermes_yaml reader
(both YAML 1.1) then read them back as booleans, so saving tool_progress: 'off'
through a ruamel-only runtime silently turned it into false. Load with version
(1, 1) and dump with a YAML 1.1 resolver (no %YAML directive), matching
hermes_yaml. yaml_compat.dump now delegates to PyYAML's dump on that backend so
existing call sites stay byte-identical.

The #7875 server-startup test assumed run_agent-first activation. The combined
stage keeps #7876's hermes_bootstrap-first activation (#7886), so the test now
gates ruamel on hermes_bootstrap and asserts run_agent was not imported before the
YAML backend was chosen, with a negative control.

Co-authored-by: carlotestor <carlotestor@users.noreply.github.com>
Co-authored-by: snoyberg <snoyberg@users.noreply.github.com>

**File**: `api/yaml_compat.py` (modified, +58/-12)
```diff
@@ -2,6 +2,13 @@
 
 Hermes Agent's managed dependency environment ships ruamel.yaml only, so WebUI code
 imports YAML through this module instead of assuming PyYAML is installed.
+
+The ruamel fallback keeps PyYAML's YAML 1.1 semantics. ruamel defaults to YAML 1.2,
+where only ``true``/``false`` are booleans: it would load ``on``/``off``/``yes``/``no``
+as strings, and dump the strings ``"off"``/``"no"`` unquoted, which PyYAML and the
+Agent's own reader (``hermes_yaml``, also pinned to 1.1) then read back as booleans.
+``tool_progress: off`` is a real Hermes setting, so a save through a 1.2 dumper would
+silently change it.
 """
 
 from __future__ import annotations
@@ -16,11 +23,31 @@
 
 BACKEND = "pyyaml" if _pyyaml is not None else "ruamel"
 
+_YAML11 = (1, 1)
+_resolver_cls = None
+
+
+def _yaml11_resolver():
+    """A resolver that applies YAML 1.1 implicit typing without writing a %YAML directive."""
+    global _resolver_cls
+    if _resolver_cls is None:
+        from ruamel.yaml.resolver import VersionedResolver
+
+        class _Yaml11Resolver(VersionedResolver):
+            @property
+            def processing_version(self):
+                return _YAML11
+
+        _resolver_cls = _Yaml11Resolver
+    return _resolver_cls
+
 
 def _ruamel(*, default_flow_style=False, allow_unicode=True, sort_keys=True, indent=None, width=None):
     from ruamel.yaml import YAML
 
+    # A fresh instance per call: ruamel YAML objects are not thread-safe.
     y = YAML(typ="safe", pure=True)
+    y.Resolver = _yaml11_resolver()
     y.default_flow_style = default_flow_style
     y.allow_unicode = allow_unicode
     y.representer.sort_base_mapping_type_on_output = sort_keys
@@ -34,7 +61,21 @@ def _ruamel(*, default_flow_style=False, allow_unicode=True, sort_keys=True, ind
 def safe_load(stream):
     if _pyyaml is not None:
         return _pyyaml.safe_load(stream)
-    return _ruamel().load(stream)
+    from ruamel.yaml import YAML
+
+    y = YAML(typ="safe", pure=True)
+    y.version = _YAML11
+    return y.load(stream)
+
+
+def _ruamel_dump(data, stream, **options):
+    y = _ruamel(**options)
+    if stream is not None:
+        y.dump(data, stream)
+        return None
+    buf = io.StringIO()
+    y.dump(data, buf)
+    return buf.getvalue()
 
 
 def safe_dump(data, stream=None, *, default_flow_style=False, allow_unicode=False,
@@ -44,16 +85,21 @@ def safe_dump(data, stream=None, *, default_flow_style=False, allow_unicode=Fals
             data, stream, default_flow_style=default_flow_style, allow_unicode=allow_unicode,
             sort_keys=sort_keys, indent=indent, width=width,
         )
-    y = _ruamel(default_flow_style=default_flow_style, allow_unicode=allow_unicode,
-                sort_keys=sort_keys, indent=indent, width=width)
-    if stream is not None:
-        y.dump(data, stream)
-        return None
-    buf = io.StringIO()
-    y.dump(data, buf)
-    return buf.getvalue()
+    return _ruamel_dump(data, stream, default_flow_style=default_flow_style,
+                        allow_unicode=allow_unicode, sort_keys=sort_keys, indent=indent, width=width)
 
 
-# WebUI only dumps plain dict/list/scalar config trees, which PyYAML's dump and
-# safe_dump render identically.
-dump = safe_dump
+def dump(data, stream=None, *, default_flow_style=False, allow_unicode=False,
+         sort_keys=True, indent=None, width=None):
+    """``yaml.dump`` on the PyYAML backend, so existing call sites are byte-identical.
+
+    WebUI only dumps plain dict/list/scalar config trees, so the ruamel fallback uses
+    the same safe representer as ``safe_dump``.
+    """
+    if _pyyaml is not None:
+        return _pyyaml.dump(
+            data, stream, default_flow_style=default_flow_style, allow_unicode=allow_unicode,
+            sort_keys=sort_keys, indent=indent, width=width,
+        )
+    return _ruamel_dump(data, stream, default_flow_style=default_flow_style,
+                        allow_unicode=allow_unicode, sort_keys=so
```

**File**: `tests/test_yaml_ruamel_fallback.py` (modified, +41/-0)
```diff
@@ -79,6 +79,47 @@ def test_config_loader_reads_yaml_without_pyyaml(ruamel_compat, tmp_path, monkey
     assert onboarding._load_yaml_config(cfg) == CFG
 
 
+# YAML 1.1 words that PyYAML (and the Agent's hermes_yaml reader) treat as booleans.
+YAML11_DOC = "tool_progress: off\nshow_reasoning: no\nstreaming: on\nauto: yes\nquoted: 'off'\n"
+YAML11_STRINGS = {"tool_progress": "off", "reasoning": "no", "mode": "on", "flag": "yes", "n": "n"}
+
+
+def test_ruamel_load_keeps_yaml11_booleans(ruamel_compat):
+    assert ruamel_compat.safe_load(YAML11_DOC) == {
+        "tool_progress": False, "show_reasoning": False, "streaming": True, "auto": True,
+        "quoted": "off",
+    }
+
+
+@pytest.mark.parametrize("fn", ["safe_dump", "dump"])
+def test_ruamel_dump_quotes_yaml11_ambiguous_strings(ruamel_compat, fn):
+    text = getattr(ruamel_compat, fn)(YAML11_STRINGS, sort_keys=False, allow_unicode=True)
+    # Own loader round-trips the strings as strings.
+    assert ruamel_compat.safe_load(text) == YAML11_STRINGS
+    # A YAML 1.1 reader (PyYAML semantics) must also see strings, not booleans.
+    from ruamel.yaml import YAML
+
+    y11 = YAML(typ="safe", pure=True)
+    y11.version = (1, 1)
+    assert y11.load(text) == YAML11_STRINGS
+    assert "%YAML" not in text
+
+
+def test_ruamel_dump_matches_pyyaml_for_yaml11_strings(ruamel_compat):
+    # Bare y/n are excluded: ruamel's YAML 1.1 resolver (like the Agent's hermes_yaml)
+    # quotes them and PyYAML does not; both forms load back as the same strings.
+    words = {k: v for k, v in YAML11_STRINGS.items() if v not in ("y", "n")}
+    out = subprocess.run(
+        [sys.executable, "-c",
+         "import sys, json, yaml; print(yaml.safe_dump(json.loads(sys.argv[1]), sort_keys=False), end='')",
+         __import__("json").dumps(words)],
+        capture_output=True, text=True,
+    )
+    if out.returncode != 0:
+        pytest.skip("PyYAML not installed in test interpreter")
+    assert ruamel_compat.safe_dump(words, sort_keys=False) == out.stdout
+
+
 def test_no_bare_pyyaml_imports_in_server_code():
     offenders = []
     for path in [REPO / "server.py", *sorted((REPO / "api").glob("*.py"))]:
```

**File**: `tests/test_yaml_ruamel_server_startup.py` (modified, +46/-12)
```diff
@@ -1,4 +1,10 @@
-"""server.py must activate the Agent before api.yaml_compat picks a YAML backend."""
+"""server.py must activate the Agent before api.yaml_compat picks a YAML backend.
+
+Combined contract (#7875 YAML fallback + #7876 activation order): the server imports
+the Agent's ``hermes_bootstrap`` dependency layer before any WebUI module needs YAML,
+and must NOT import ``run_agent`` at that point (#7886: importing Agent application
+modules before the named profile is selected disables context-local skill homes).
+"""
 
 import os
 from pathlib import Path
@@ -8,31 +14,34 @@
 
 ROOT = Path(__file__).resolve().parent.parent
 
-# PyYAML is always blocked; ruamel.yaml stays invisible until run_agent is imported,
-# mirroring a managed runtime that exposes its dependencies on Agent import.
+# PyYAML is always blocked; ruamel.yaml stays invisible until the Agent's bootstrap layer
+# is imported, mirroring a managed runtime that exposes its dependencies on activation.
 _GATE = (
     "import builtins, sys\n"
     "_orig = builtins.__import__\n"
+    "_seen = {}\n"
     "def _gate(name, *a, **k):\n"
     "    top = name.split('.')[0]\n"
-    "    if top == 'yaml' or (top == 'ruamel' and 'run_agent' not in sys.modules):\n"
+    "    if top == 'yaml' or (top == 'ruamel' and 'hermes_bootstrap' not in sys.modules):\n"
     "        raise ImportError(f'{name} not activated')\n"
+    "    if top == 'ruamel' and 'first' not in _seen:\n"
+    "        _seen['first'] = 'run_agent' in sys.modules\n"
     "    return _orig(name, *a, **k)\n"
     "builtins.__import__ = _gate\n"
 )
 
 
-def test_server_import_activates_agent_before_ruamel_only_yaml(tmp_path):
+def _fixture_agent(tmp_path):
     agent_dir = tmp_path / "agent"
     ruamel_dir = agent_dir / "managed" / "ruamel"
     ruamel_dir.mkdir(parents=True)
-    # Importing the fixture Agent exposes its managed dir, which ships a ruamel stub.
-    (agent_dir / "run_agent.py").write_text(
+    # Importing the fixture bootstrap layer exposes its managed dir, which ships a ruamel stub.
+    (agent_dir / "hermes_bootstrap.py").write_text(
         "import sys\nfrom pathlib import Path\n"
-        "sys.path.insert(0, str(Path(__file__).parent / 'managed'))\n"
-        "class AIAgent: pass\n",
+        "sys.path.insert(0, str(Path(__file__).parent / 'managed'))\n",
         encoding="utf-8",
     )
+    (agent_dir / "run_agent.py").write_text("class AIAgent: pass\n", encoding="utf-8")
     (ruamel_dir / "__init__.py").write_text("", encoding="utf-8")
     (ruamel_dir / "yaml.py").write_text(
         "from types import SimpleNamespace\n"
@@ -41,6 +50,12 @@ def test_server_import_activates_agent_before_ruamel_only_yaml(tmp_path):
         "    def load(self, stream): return {'backend': 'managed-ruamel'}\n",
         encoding="utf-8",
     )
+    ruamel_resolver = ruamel_dir / "resolver.py"
+    ruamel_resolver.write_text("class VersionedResolver: pass\n", encoding="utf-8")
+    return agent_dir
+
+
+def _env(tmp_path, agent_dir):
     env = {k: v for k, v in os.environ.items()
            if not k.startswith("HERMES_WEBUI_") and k != "PYTHONPATH"}
     env.update(
@@ -49,15 +64,34 @@ def test_server_import_activates_agent_before_ruamel_only_yaml(tmp_path):
         HERMES_BASE_HOME=str(tmp_path / "home"),
         HERMES_WEBUI_STATE_DIR=str(tmp_path / "state"),
     )
+    return env
+
+
+def test_server_import_activates_agent_before_ruamel_only_yaml(tmp_path):
+    agent_dir = _fixture_agent(tmp_path)
     script = _GATE + (
         "import server\n"
         "from api import yaml_compat\n"
-        "assert sys.modules['run_agent'].__file__ == sys.argv[1], sys.modules['run_agent'].__file__\n"
+        "assert sys.modules['hermes_bootstrap'].__file__ == sys.argv[1], sys.modules['hermes_bootstrap'].__file__\n"
+        "assert _seen.get('first') is False, 'run_agent was imported before the YAML backend (#7886)'\n"
         "assert yaml_compat.BACKEND == 'ruamel'\n"
         "assert yaml_com
```

#### Recent Merged Pull Requests:
- **PR #7917** (2026-09-29): Release exp-v0.52.385: a vanished peer is a disconnect, not a 500 (#7857) (@nesquena-hermes)
- **PR #7916** (2026-09-29): Release exp-v0.52.384: nested subagent labels (#7884) + closed mobile drawer out of the tab order (#7866) (@nesquena-hermes)
- **PR #7915** (2026-09-29): Release exp-v0.52.383: lifecycle-gate minute-boundary flake (#7911) (@nesquena-hermes)
- **PR #7914** (2026-09-29): Release exp-v0.52.382: Codex fallback catalog cleanup (#6817) (@nesquena-hermes)
- **PR #7913** (closed): perf(redaction): probe large strings before the full redactor (@happy5318)
- **PR #7911** (2026-09-29): fix(test): strip rendered clock timestamp in lifecycle gate assertions (#7792) (@webtecnica)
- **PR #7897** (2026-09-29): Release: MCP config write transaction (#7822) + keep session on transient reload errors (#7071) (@nesquena-hermes)
- **PR #7895** (2026-09-29): Release: managed-runtime startup fix (#7876 + #7875) — WebUI starts after hermes update (@nesquena-hermes)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
