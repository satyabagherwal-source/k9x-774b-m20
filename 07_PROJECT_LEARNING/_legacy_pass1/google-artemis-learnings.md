# Forensic Learning Record (Deep Inspection): google/artemis

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-artemis-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/artemis](https://github.com/google/artemis))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:31:51.570Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/artemis`
- **Description**: ARTEMIS turns natural-language instructions into reliable Android automation. It automates end-to-end workflows, captures logs, and integrates seamlessly with AI coding assistants such as Antigravity, Codex, and Claude Code.  It also achieves 99%+ success rate on AndroidWorld Benchmark.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 10718 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/__init__.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Artemis Applications Package."""

```

### Core Architecture Module: `apps/admin_console/__init__.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Artemis Admin & Trace Console Package."""

from apps.admin_console.server import app

__all__ = ["app"]

```

### Core Architecture Module: `apps/admin_console/core/__init__.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

```

### Core Architecture Module: `apps/admin_console/core/config.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Admin Console configuration facade.

All configuration and path management is centralized in `artemis.config`.
This module re-exports common constants for full backward compatibility.
"""

from artemis.config import (
    DB_PATH,
    IMAGES_DIR,
    PAUSE_FILE,
    REPLAY_BASE_DIR,
    TEST_DATA_DIR,
    TEST_OUTPUTS_DIR,
    TRACES_PATH,
    WORKSPACE_ROOT,
    init_ls_address,
)

__all__ = [
    "DB_PATH",
    "IMAGES_DIR",
    "PAUSE_FILE",
    "REPLAY_BASE_DIR",
    "TEST_DATA_DIR",
    "TEST_OUTPUTS_DIR",
    "TRACES_PATH",
    "WORKSPACE_ROOT",
    "init_ls_address",
]

```

### Core Architecture Module: `apps/admin_console/core/security.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Same-origin security boundary for the Artemis console.

Artemis runs without user accounts: whoever can reach the TCP port is the
operator. For that model to hold for a server that browsers also talk to,
two browser-borne attack vectors must be closed even on a loopback bind:

- DNS rebinding: a page at ``attacker.example`` re-points its DNS record at
  127.0.0.1 so the victim's browser reads API responses under the attacker's
  origin. Blocked by validating the ``Host`` header.
- Cross-site request forgery: any web page can fire side-effectful requests
  at ``http://127.0.0.1:8000`` from a visitor's browser. Blocked by requiring
  the ``Origin`` header, when a browser sends one, to match the request host.

Non-browser clients (the SDK, curl, the CLI, MCP) send no ``Origin`` header
and pass through untouched. Remote access is expected to arrive over a
network-level tunnel (Tailscale, SSH port forward); a tunnel hostname that is
not an IP literal can be admitted via ``ARTEMIS_ALLOWED_HOSTS``.
"""

from __future__ import annotations

import ipaddress
import json
import os
from urllib.parse import urlsplit

_SECURITY_HEADERS: tuple[tuple[bytes, bytes], ...] = (
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-frame-options", b"DENY"),
    (b"cross-origin-opener-policy", b"same-origin"),
)

# Paths whose responses may hold task data, media, or diagnostics and must not
# land in shared caches or survive on disk after the session.
_NO_STORE_PREFIXES = ("/api/",)


def _hostname(netloc: str) -> str:
    """Extract the lowercase hostname from a ``host[:port]`` netloc."""
    netloc = netloc.strip().lower()
    if netloc.startswith("["):  # IPv6 literal, e.g. [::1]:8000
        return netloc.partition("]")[0].lstrip("[")
    return netloc.rpartition(":")[0] if netloc.count(":") == 1 else netloc


def _is_ip_literal(host: str) -> bool:
    """An IP-literal Host cannot be forged through DNS rebinding: a browser
    only sends ``Host: 192.168.1.5`` when it actually connected to that IP."""
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def allowed_hostnames() -> frozenset[str]:
    """Hostnames (not IP literals) accepted in Host and Origin headers."""
    names = {"localhost"}
    extra = os.environ.get("ARTEMIS_ALLOWED_HOSTS", "")
    names.update(part.strip().lower() for part in extra.split(",") if part.strip())
    return frozenset(names)


def host_is_allowed(host_header: str) -> bool:
    host = _hostname(host_header)
    if not host:
        return False
    return _is_ip_literal(host) or host in allowed_hostnames()


def origin_is_allowed(origin_header: str, host_header: str) -> bool:
    """A browser request is acceptable when its page is same-origin with this
    server, or was served from an explicitly allowed tunnel hostname."""
    origin = origin_header.strip().lower()
    if not origin or origin == "null":
        return False
    origin_netloc = urlsplit(origin).netloc
    if not origin_netloc:
        return False
    if origin_netloc == host_header.strip().lower():
        return True
    return _hostname(origin_netloc) in allowed_hostnames()


class SameOriginBoundaryMiddleware:
    """Pure ASGI middleware enforcing the Host/Origin boundary and appending
    baseline security headers. Pure ASGI (not BaseHTTPMiddleware) so future
    WebSocket endpoints cannot slip past the Origin check."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        if os.environ.get("ARTEMIS_DISABLE_ORIGIN_GUARD", "").lower() in {"1", "true", "yes"}:
            await self._forward(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        host_header = headers.get("host", "")
        origin_header = headers.get("origin")

        if not host_is_allowed(host_header):
            await self._reject(
                scope,
                send,
                "Unrecognized Host header. Access Artemis via localhost or an IP address, "
                "or add your tunnel hostname to ARTEMIS_ALLOWED_HOSTS.",
            )
            return

        if origin_header is not None and not origin_is_allowed(origin_header, host_header):
            await self._reject(
                scope,
                send,
                "Cross-origin browser requests are not accepted by the Artemis console.",
            )
            return

        await self._forward(scope, receive, send)

    async def _forward(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                raw = list(message.get("headers", []))
                existing = {name.lower() for name, _ in raw}
                for name, value in _SECURITY_HEADERS:
                    if name not in existing:
                        raw.append((name, value))
                if b"cache-control" not in existing and path.startswith(_NO_STORE_PREFIXES):
                    raw.append((b"cache-control", b"no-store"))
                message = {**message, "headers": raw}
            await send(message)

        await self.app(scope, receive, send_with_headers)

    @staticmethod
    async def _reject(scope, send, detail: str):
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        body = json.dumps({"detail": detail}).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("latin-1")),
                    *_SECURITY_HEADERS,
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

```

### Core Architecture Module: `apps/admin_console/core/state.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import asyncio
from collections.abc import Callable
from typing import Any

from artemis.config import PAUSE_FILE
from artemis.runtime.process_probe import pid_is_alive


class ServerState:
    """Encapsulates all runtime states of the debug server."""

    def __init__(self):
        self.ipc_subscribers: list[Callable[[str, Any], None]] = []
        self.ipc_server: asyncio.Server | None = None
        self.ipc_serve_task: asyncio.Task | None = None
        self.ipc_port: int | None = None
        self.port: int = 8000
        self.host: str = "127.0.0.1"
        self.is_shutting_down: bool = False

        self.current_process: asyncio.subprocess.Process | None = None
        self.current_goal: str | None = None
        self.current_profile: str | None = None
        self.active_connections: dict[str, dict[str, Any]] = {}
        self.active_session_id: str | None = None
        # Run keys (session id, or the synthetic run key of session-less runs)
        # that were stopped manually. Tracked per run so a manual stop of one
        # device's task never pollutes the terminal-status resolution of a
        # concurrently running task on another device. Entries are discarded by
        # each run's finalizer.
        self.manually_stopped_run_ids: set[str] = set()
        self.cancelled_session_ids: set[str] = set()
        self.startup_progress: dict[str, list[dict[str, Any]]] = {}

        # Concurrent task executions keyed by session_id. Each value holds
        # {"process", "device_id", "goal", "profile"}. `current_process` /
        # `active_session_id` mirror the most recently launched run for
        # backward compatibility with single-task consumers.
        self.active_runs: dict[str, dict[str, Any]] = {}

        # Unified single source of truth for task queue
        self.queue_items: list[dict[str, Any]] = []
        self._wake_event: asyncio.Event | None = None
        self._shutdown_event: asyncio.Event | None = None
        self.worker_task: asyncio.Task | None = None

    @property
    def wake_event(self) -> asyncio.Event:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if self._wake_event is None or (
            loop
            and getattr(self._wake_event, "_loop", None) is not None
            and self._wake_event._loop != loop
        ):
            self._wake_event = asyncio.Event()
        return self._wake_event

    @property
    def shutdown_event(self) -> asyncio.Event:
        """Event set as soon as the HTTP server receives a shutdown signal."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if self._shutdown_event is None or (
            loop
            and getattr(self._shutdown_event, "_loop", None) is not None
            and self._shutdown_event._loop != loop
        ):
            self._shutdown_event = asyncio.Event()
        return self._shutdown_event

    @property
    def task_queue(self) -> list[dict[str, Any]]:
        """Backward compatibility alias for queue_items."""
        return self.queue_items

    @property
    def queue_tasks(self) -> list[dict[str, Any]]:
        """Returns all currently pending tasks in the queue."""
        return [t for t in self.queue_items if isinstance(t, dict) and t.get("status") == "pending"]

    @queue_tasks.setter
    def queue_tasks(self, val: list[dict[str, Any]]):
        # Compatibility setter
        self.queue_items = list(val)

    @property
    def queue_goals(self) -> list[str]:
        """Backward compatibility helper for queue goals."""
        return [t.get("goal", "") for t in self.queue_tasks]

    @queue_goals.setter
    def queue_goals(self, val: list[Any]):
        pass

    def prune_finished_runs(self) -> None:
        """Drop finished entries from active_runs.

        Besides reaped processes (returncode set), also drops entries whose pid no
        longer exists: if a run coroutine dies without reaping its child, the entry
        must not permanently block the scheduler.
        """
        for sid, run in list(self.active_runs.items()):
            proc = run.get("process")
            if proc is None or proc.returncode is not None:
                self.active_runs.pop(sid, None)
                continue
            pid = getattr(proc, "pid", None)
            if pid and not pid_is_alive(pid):
                self.active_runs.pop(sid, None)

    @property
    def busy_device_ids(self) -> set[str]:
        """Device serials currently owned by an in-flight run."""
        self.prune_finished_runs()
        return {
            str(run.get("lock_key") or run["device_id"])
            for run in self.active_runs.values()
            if run.get("device_id")
        }

    @property
    def is_running(self) -> bool:
        self.prune_finished_runs()
        if self.active_runs:
            return True
        has_proc = False
        if self.current_process is not None:
            if self.current_process.returncode is not None:
                has_proc = False
                self.current_process = None
            else:
                pid = getattr(self.current_process, "pid", None)
                if pid and pid_is_alive(pid):
                    has_proc = True
                else:
                    has_proc = False
                    self.current_process = None

        has_running_item = any(
            isinstance(t, dict) and t.get("status") == "running" for t in self.queue_items
        )

        has_live_connection = False
        for sid, conn in list(self.active_connections.items()):
            c_pid = conn.get("pid")
            if c_pid:
                if pid_is_alive(c_pid):
                    has_live_connection = True
                else:
                    self.active_connections.pop(sid, None)

        if not has_proc and not has_running_item and not has_live_connection:
            self.active_session_id = None
            self.current_process = None
            return False

        return True

    @property
    def is_paused(self) -> bool:
        return PAUSE_FILE.exists()

    @property
    def paused_error(self) -> str | None:
        """Return the persisted pause reason for clients that missed the SSE event."""
        if not PAUSE_FILE.exists():
            return None
        try:
            message = PAUSE_FILE.read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            return "AI model request failed. The task is paused."
        if message.startswith("LLM Error: "):
            message = message[len("LLM Error: ") :]
        return message or "AI model request failed. The task is paused."

    def add_subscriber(self, callback: Callable[[str, Any], None]):
        if callback not in self.ipc_subscribers:
            self.ipc_subscribers.append(callback)

    def remove_subscriber(self, callback: Callable[[str, Any], None]):
        if callback in self.ipc_subscribers:
            self.ipc_subscribers.remove(callback)

    def record_startup_progress(self, data: dict[str, Any]) -> None:
        """Retain the short pre-trace timeline so late SSE clients can catch up."""
        session_id = data.get("session_id")
        stage = data.get("stage")
        if not session_id or not stage:
            return

        key = str(session_id)
        events = self.startu
```

### Core Architecture Module: `apps/admin_console/database/__init__.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

```

### Core Architecture Module: `apps/admin_console/database/connection.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from contextlib import contextmanager
import logging
from pathlib import Path
import sqlite3

from artemis.config import DB_PATH

logger = logging.getLogger(__name__)

_initialized_dbs = set()


def get_db(db_path: Path | None = None) -> sqlite3.Connection:
    """Returns a SQLite connection with timeout and Row row_factory."""
    path = db_path or DB_PATH
    path_key = str(path)
    if path_key not in _initialized_dbs:
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            from artemis.data_engine.storage import StorageManager

            StorageManager(db_path=path, base_trace_dir=path.parent)
            _initialized_dbs.add(path_key)
        except (ImportError, OSError, sqlite3.Error) as exc:
            # Schema bootstrap is best-effort here; queries against a missing
            # schema will surface their own errors, but log the root cause.
            logger.warning("Schema bootstrap failed for %s: %s", path, exc)
    conn = sqlite3.connect(path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=10000")
    except sqlite3.Error:
        # Optional performance PRAGMAs; the connection works without them.
        pass
    return conn


@contextmanager
def db_session(db_path: Path | None = None):
    """Context manager for SQLite connections ensuring clean closure."""
    conn = get_db(db_path)
    try:
        yield conn
    finally:
        conn.close()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #162** (2026-09-29): **Third party cleanup**
  *Symptoms*: 

- **Issue #140** (2026-09-21): **fix(mcp): stop splicing notification text into AppleScript/PowerShell source**
  *Symptoms*: -
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/artemis/pull/140/checks?check_run_id=106240610074) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #133** (2026-09-18): **test(config): cover utils.* node reconciliation as match (CHE-656)**
  *Symptoms*: ## Summary  CHE-656 asked to decide + close a claimed Gate 1 manifest coverage gap: that `build_attempt_manifest` never tracks the four `LLMConfig.utils` nodes (`outputter`/`hopper`/`video_analyzer`/`object_detector`), causing every real run to reconcile as `unmapped_call`.  **Finding: the gap does not exist in current code.** `build_attempt_manifest` has tracked all four utils nodes with the same tier-matching treatment as the twelve required agent nodes since the mechanism's original commit (5eae089, CHE-491) — they live under a separate `manifest["utils"]` key (parallel to `manifest["nodes"]`), and `reconcile_attempt` already merges both dicts (`{**manifest.get("nodes", {}), **manifest.get("utils", {})}`) before matching usage events by node name — no separate handling, no gap.  The `unmapped_call` evidence quoted in the issue only showed `manifest["nodes"]` (the agent-node dict), which by design never contains utils entries — that's not the same as the manifest lacking them entirely.  ## Decision (CHE-656 AC1/AC2)  `utils.*` nodes are included in manifest node coverage, with the same tier/source verification as agent nodes. No production code change needed — `attempt_manifest.py` and `attempt_reconciliation.py` already implement this correctly.  ## Change  Regression coverage only (CHE-656 AC3), closing the gap that no test actually asserted this: - `test_attempt_manifest.py`: enabled `outputter`/`hopper` utils nodes get the same `enabled`/`resolved_tier`/`config` treatme
  **Post-Mortem & Fix Analysis**:
  > Opened against the wrong repo by mistake (automation default picked the upstream parent instead of the fork). Closing; correct PR opened at cheese-work/artemis.
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/artemis/pull/133/checks?check_run_id=105680684264) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #96** (2026-09-15): **Honor the configured LLM provider instead of hardcoding Google**
  *Symptoms*: ## Summary  - Several call sites (Flash step summarizer, memory chunking's `StepCapsuleLens`, the Flash operator's last-resort fallback, `lightweight_judge_default()`) bypassed the provider configured in `artemis.jsonc` and always built a Google/Gemini model, so a non-Google `default` provider was only partially honored. - Adds `get_llm_for_model()` (`artemis/services/llm.py`) and `get_default_node()` (`artemis/config/llm.py`) so these paths resolve the configured top-level `default` node's provider, falling back to Gemini only when no config can be loaded at all. - `StepSummarizerConfig` / `MemoryChunkingConfig` gain an optional `provider` override field, typed as the existing `LLMProvider` literal so typos fail at config load. Upstream defaults (Gemini) are unchanged; the shipped `artemis.jsonc` only gains comment lines documenting the new key. - For an unchanged Google config the new helper builds the exact same `ModelEndpoint` as the old `get_google_llm()` path (provider, model, temperature 0.0, timeout 60 s, `thinking_level="medium"`), covered by regression tests.  ## Behavior changes  1. Lenses (Flash step summarizer, memory chunking `StepCapsuleLens`) now inherit the top-level `default` node's provider when their own `provider` is omitted. If a deployment sets a non-Google default provider but leaves these blocks' Gemini-named models unchanged, the lens will fail at call time (lens failures are logged and degrade the lens; they are not fatal to the run). Set an explici
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/artemis/pull/96/checks?check_run_id=103899213344) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #93** (2026-09-14): **test(mcp): stop MCP dispatch tests from leaking real spawn watchdogs**
  *Symptoms*: Closes #43.  ## Problem  `mobile_run_task` arms `_start_spawn_watchdog` after `Popen` returns. Four tests in `test_mcp_tools.py` mock `Popen` but leave the watchdog live, so each starts a **real daemon thread** monitoring a pid that came from a `MagicMock`.  Those threads outlive `temp_trace_env`'s directory and its monkeypatches. Past the 60-second deadline they go on to terminate a process tree, cancel a reservation, write into the restored trace directory, and dispatch failure notifications — for tasks that never existed. The issue reports a real desktop *"Artemis Task Failed"* notification naming fake pid `54321`.  ## Reproduction  I reproduced it with the guard the issue describes — a temporary `conftest.py` that intercepts `threading.Thread.start` for `spawn-watchdog-*` names, records the attempt without starting a thread, and asserts none occurred:  ```console $ uv run pytest -q -p no:randomly tests/unit/mcp/test_mcp_tools.py ERROR test_mobile_run_task_reserves_and_passes_global_queue_ticket ERROR test_mobile_run_task_with_device_serial ERROR test_mobile_run_task_forwards_pro_tuning_to_background_runner ERROR test_mobile_run_task_omits_pro_tuning_flags_when_unset AssertionError: Test leaked 1 real spawn watchdog thread(s) 25 passed, 4 errors in 0.50s ```  Same four tests, same counts as the issue.  The run also surfaced something not in the original report — the leaked watchdog reached the notifier and made an **outbound HTTP request** from a unit test:  ``` urllib.err
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate. #42 by @wellorbetter already covers issue #43 and was opened first — that one should get the review, not this.  My mistake: I didn't check the open PR queue for an existing claim before sending this. Sorry for the noise.

- **Issue #92** (2026-09-14): **fix(video): pin the output frame rate on rendered analyzer clips**
  *Symptoms*: Closes #52.  ## Problem  `render_timeline_clip()` sets `fps={fps}` inside each input segment's filter chain, but the output stage never gets an explicit rate. ffmpeg therefore encodes the muxed result at its own default of 25fps and duplicates frames to preserve wall-clock duration:  ``` frame=   77 fps=0.0 q=28.0 Lsize=  4KiB time=00:00:03.00 bitrate=10.6kbits/s dup=31 drop=0 ```  A 3.0s window that should hold ~45 frames at the default 15fps holds 77 — about 40% duplicates. Duration stays correct, which is why nothing downstream noticed, but the guarantee in the function's own docstring — *"so `start_time + frame_offset` still names the true recording time"* — is broken on **every analyzer clip the agent renders**, since `UnifiedMobileController.render_timeline_clip` is on the production path.  ## Change  One argument on the output stage:  ```diff              "-map", "[outv]", +            "-r", str(fps),              "-c:v", "libx264", ```  with a comment recording why it cannot be dropped again.  ## Verification  This is covered by an existing test that fails on `main`, and my run reproduces the issue's numbers exactly:  | | `tests/unit/test_unified_controller_video.py::test_analyzer_clip_keeps_timeline_time_across_restart_gap` | |---|---| | `main` | `FAILED — assert 43 <= len(frames) <= 47` → `assert 77 <= 47` | | this branch | **passed** |  Worth noting these exercise **real ffmpeg**, not a mock — the bundled `imageio-ffmpeg` binary — so the frame counts above are meas
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate. #53 by @Abdullah-Builds already covers issue #52 and was opened first — that one should get the review, not this.  My mistake: I didn't check the open PR queue for an existing claim before sending this. Sorry for the noise.

- **Issue #91** (2026-09-14): **test(flash): build the turn-index runner without provider credentials**
  *Symptoms*: Closes #31.  ## Problem  `tests/unit/agents/flash/test_turn_index_snapshot.py` fails 4 of its 5 tests without `GOOGLE_API_KEY`, contrary to the deterministic-suite contract in `CONTRIBUTING.md`:  ```console $ uv run pytest -q tests/unit/agents/flash/test_turn_index_snapshot.py 4 failed, 1 passed E   pydantic_core._pydantic_core.ValidationError: 1 validation error for ChatGoogleGenerativeAI E     Value error, API key required for Gemini Developer API. ```  `FlashRunner.__init__` constructs a `VisualStepSummarizer`, whose constructor resolves a real model client. The `_runner` helper already intends to discard it:  ```python runner = FlashRunner(mock_context, goal="Open Wi-Fi and Display") runner.summarizer = None   # never reached -- the line above raised ```  but that assignment runs *after* construction, so it never takes effect.  ## Change  Patch `VisualStepSummarizer` for the construction itself, in the `with` block that already patches `get_driver`:  ```python with (     patch("artemis.controllers.unified_controller.get_driver"),     patch("artemis.agents.flash.runner.VisualStepSummarizer"), ):     runner = FlashRunner(mock_context, goal="Open Wi-Fi and Display") runner.summarizer = None ```  Patching the whole class is safe here precisely because the helper was already throwing the instance away: these tests assert index resolution across a turn and never summarize anything, so nothing under test is mocked out.  Test-only; no production code is touched.  ## Relationship 
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate. #32 by @Fire162 already covers issue #31 and was opened first — that one should get the review, not this.  My mistake: I didn't check the open PR queue for an existing claim before sending this. Sorry for the noise.

- **Issue #90** (2026-09-14): **fix(llm): type-check provider and model in _resolve_endpoint**
  *Symptoms*: Closes #33.  ## Problem  `_resolve_endpoint` reads eight fields off the agent config. Six go through a type-checking helper; two do not:  ```python def _get_val(obj, attr, expected_type):     val = getattr(obj, attr, None)     return val if isinstance(val, expected_type) else None  provider_val = getattr(cfg, "provider", "google")      # <-- no check model_val = getattr(cfg, "model", "gemini-2.5-flash")  # <-- no check ```  `getattr` with a default only falls back when the attribute is **missing**. A config object that *has* `provider` holding a non-string value passes it straight to `ModelProvider.from_string`, which raises:  ``` ValueError: Unknown LLM provider <MagicMock name='mock.llm_config.get_agent().provider' id='...'>. Valid providers: ['anthropic', 'claude', 'custom', 'gemini', 'google', ...] ```  ## Change  Route both through `_get_val`, matching the six fields below them.  ## What this deliberately does *not* change  Two properties were easy to break here, so I checked both:  **A real enum value must still work.** `ModelProvider` is a `StrEnum`, so `isinstance(ModelProvider.ANTHROPIC, str)` is `True` and the `str` check passes it through untouched. Covered by `test_a_provider_enum_value_is_still_honoured`.  **A misspelled provider string must still raise.** `from_string`'s docstring is explicit that "an unrecognized non-empty value raises instead of silently routing to Gemini with the wrong credentials". Type-checking must not turn a genuine misconfiguration into 
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate. #34 by @Fire162 already covers issue #33 and was opened first — that one should get the review, not this.  My mistake: I didn't check the open PR queue for an existing claim before sending this. Sorry for the noise.

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

### Incident Patch 1: `351ca842` (2026-09-29)
**Commit Message**: fix: server status, CLI entrypoint, replay and test issues

**File**: `apps/admin_console/replay_manager.py` (modified, +3/-7)
```diff
@@ -1766,7 +1766,8 @@ def instantiate_state(
 
         initial_goal = self.load_session_goal(session_id, step_dir, str(self.db_path))
 
-        ui_hier, decisions, app_info, dev_date = self.extract_state_prepopulation_data(
+        # State has no fields for the app info or device date (extra="forbid").
+        ui_hier, decisions, _app_info, _dev_date = self.extract_state_prepopulation_data(
             step_dir, step_data, pre_image_meta
         )
 
@@ -1776,19 +1777,14 @@ def instantiate_state(
             raise ImportError(f"Failed to import State module: {import_err}")
 
         state = State(
-            messages=[],
             initial_goal=initial_goal,
             latest_screenshot=str(step_dir / "pre.jpg")
             if (step_dir / "pre.jpg").exists()
             else str(step_dir / "post.jpg"),
             operator_raw_data={"width": self.w, "height": self.h},
             current_step_id=step_data["step_id"],
-            complete_subgoals_by_ids=[],
-            validator_messages=[],
-            subagent_calls=step_data.get("subagent_calls", []),
+            subagent_calls=step_data.get("subagent_calls") or [],
             latest_ui_hierarchy=ui_hier,
-            focused_app_info=app_info,
-            device_date=dev_date,
             structured_decisions=decisions,
         )
         return state
```

**File**: `apps/admin_console/routers/system.py` (modified, +39/-11)
```diff
@@ -495,28 +495,56 @@ def mask_key(k: str | None) -> str | None:
 
 @router.get("/server-status")
 async def get_server_runtime_status():
-    """Retrieve runtime status, PID, port, and uptime of the Artemis server."""
+    """Retrieve runtime status, PID, port, and uptime of the Artemis server.
+
+    Answers from in-process state. ``server_lifecycle.get_server_status`` is
+    not used here: it runs ``lsof``/``fuser``, which can take over a second and
+    is too slow for the ``is_artemis_daemon`` probe.
+    """
     import os
-    from artemis.runtime.server_lifecycle import get_server_status
+    import time
+
+    from artemis.runtime.process_probe import pid_is_alive
+    from artemis.runtime.server_lifecycle import read_server_info
 
     try:
         from apps.admin_console.core.state import state
     except ImportError:
         from admin_console.core.state import state
 
     port = getattr(state, "port", 8000)
-    status = get_server_status(port=port)
+    current_pid = os.getpid()
+    pids = {current_pid}
+    started_at = None
+
+    info = read_server_info()
+    if info and info.get("port") == port:
+        saved_pid = info.get("pid")
+        if isinstance(saved_pid, int) and saved_pid != current_pid and pid_is_alive(saved_pid):
+            pids.add(saved_pid)
+        if isinstance(info.get("started_at"), (int, float)):
+            started_at = float(info["started_at"])
+    if started_at is None:
+        try:
+            import psutil
+
+            started_at = psutil.Process(current_pid).create_time()
+        except Exception:  # pylint: disable=broad-exception-caught
+            # psutil is optional; uptime is best-effort.
+            started_at = None
+
+    uptime_seconds = max(0.0, time.time() - started_at) if started_at is not None else None
     # Explicit DTO: the raw metadata file additionally holds the lifecycle
     # token, cmdline, and filesystem paths, none of which belong on the wire.
     return {
-        "running": status["running"],
-        "port": status["port"],
-        "pids": status["pids"],
-        "active_pid": status["active_pid"],
-        "uptime_seconds": status["uptime_seconds"],
-        "url": status["url"],
-        "admin_url": status["admin_url"],
-        "current_pid": os.getpid(),
+        "running": True,
+        "port": port,
+        "pids": sorted(pids),
+        "active_pid": current_pid,
+        "uptime_seconds": uptime_seconds,
+        "url": f"http://localhost:{port}",
+        "admin_url": f"http://localhost:{port}/admin",
+        "current_pid": current_pid,
     }
 
 
```

**File**: `artemis/main.py` (modified, +30/-13)
```diff
@@ -15,25 +15,42 @@
 """Backward compatibility entrypoint for artemis CLI."""
 
 import sys
+
+import typer
+
 from artemis.interfaces.cli.main import app
 
+# Tests replace `app`; command discovery still needs the real Typer app.
+from artemis.interfaces.cli.main import app as _typer_app
+
+
+def _root_tokens() -> frozenset[str]:
+    """Command names and root options registered on the Typer app."""
+    group = typer.main.get_command(_typer_app)
+    tokens: set[str] = {"-h"}
+    # Typer may vendor its own click, so use getattr instead of isinstance.
+    tokens.update(getattr(group, "commands", {}) or {})
+    tokens.update(group.get_help_option_names(group.context_class(group)))
+    for param in group.params:
+        tokens.update(getattr(param, "opts", ()))
+        tokens.update(getattr(param, "secondary_opts", ()))
+    return frozenset(tokens)
+
+
+def normalize_argv(argv: list[str]) -> list[str]:
+    """Insert ``run`` when the first argument is not a known root command/flag.
+
+    Keeps ``python -m artemis.main "some goal"`` working as ``run "some goal"``.
+    """
+    if len(argv) > 1 and argv[1] not in _root_tokens():
+        return [argv[0], "run", *argv[1:]]
+    return list(argv)
+
 
 def cli():
     # If invoked directly as python -m artemis.main without subcommand 'run',
     # check if first argument is a goal rather than a subcommand
-    if len(sys.argv) > 1 and sys.argv[1] not in (
-        "run",
-        "init",
-        "doctor",
-        "batch",
-        "bench",
-        "mcp",
-        "server",
-        "trace",
-        "--help",
-        "-h",
-    ):
-        sys.argv.insert(1, "run")
+    sys.argv[:] = normalize_argv(sys.argv)
     app()
 
 
```

**File**: `artemis/mcp/adb_server.py` (modified, +38/-13)
```diff
@@ -12,11 +12,13 @@
 # See the License for the specific language governing permissions and
 # limitations under the License.
 
+from collections.abc import Callable
 import json
 import logging
 import os
 from pathlib import Path
 import sys
+import textwrap
 from typing import Any
 
 # Ensure repository root is in sys.path when executed directly or via MCP runner
@@ -86,6 +88,29 @@ def configure_stdio_mode() -> None:
 # Create minimal MCP server
 mcp = FastMCP("Android_ADB_Controller")
 
+
+def _tool_description(fn: Callable[..., Any]) -> str:
+    """Returns ``fn``'s docstring normalized identically on every Python version.
+
+    FastMCP publishes ``__doc__`` verbatim as the tool description. Python 3.13+
+    strips the common indentation of docstring continuation lines at compile time,
+    while 3.12 keeps it, so the schema external MCP clients see would otherwise
+    depend on the interpreter. This reproduces the 3.13 form (first line as-is,
+    remaining lines dedented, whitespace-only lines emptied); it is a no-op there.
+    """
+    first, sep, rest = (fn.__doc__ or "").partition("\n")
+    return first + sep + textwrap.dedent(rest)
+
+
+def _tool() -> Callable[[Callable[..., Any]], Callable[..., Any]]:
+    """``mcp.tool()`` with a Python-version-independent description."""
+
+    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
+        return mcp.tool(description=_tool_description(fn))(fn)
+
+    return decorator
+
+
 _GLOBAL_CONTROLLER = None
 _CONTROLLERS: dict[str, Any] = {}
 
@@ -186,7 +211,7 @@ def _get_controller(device_serial: str | None = None):
 )
 
 
-@mcp.tool()
+@_tool()
 async def tap(
     ctx: Context,
     coordinates: list[int],
@@ -217,7 +242,7 @@ async def tap(
     return "Success"
 
 
-@mcp.tool()
+@_tool()
 async def long_press_on(
     ctx: Context,
     coordinates: list[int],
@@ -248,7 +273,7 @@ async def long_press_on(
     return "Success"
 
 
-@mcp.tool()
+@_tool()
 async def swipe(
     ctx: Context,
     coordinates: list[int],
@@ -282,7 +307,7 @@ async def swipe(
     return "Success"
 
 
-@mcp.tool()
+@_tool()
 async def back(ctx: Context) -> str:
     """Simulates pressing the system back button."""
     try:
@@ -294,7 +319,7 @@ async def back(ctx: Context) -> str:
     return "Success" if success else "Failed"
 
 
-@mcp.tool()
+@_tool()
 async def launch_app(ctx: Context, package_name: str) -> str:
     """Launches an application by its Android package name with retries and smart polling."""
     try:
@@ -306,7 +331,7 @@ async def launch_app(ctx: Context, package_name: str) -> str:
     return "Success" if success else f"Failed: {error_msg}"
 
 
-@mcp.tool()
+@_tool()
 async def stop_app(ctx: Context, package_name: str) -> str:
     """Force stops an application by its Android package name."""
     try:
@@ -318,7 +343,7 @@ async def stop_app(ctx: Context, package_name: str) -> str:
     return "Success" if success else "Failed"
 
 
-@mcp.tool()
+@_tool()
 async def open_link(ctx: Context, url: str) -> str:
     """Opens a URL or deep link on the device."""
     try:
@@ -330,7 +355,7 @@ async def open_link(ctx: Context, url: str) -> str:
     return "Success" if success else "Failed"
 
 
-@mcp.tool()
+@_tool()
 async def focus_and_input_text(
     ctx: Context,
     coordinates: list[int],
@@ -367,7 +392,7 @@ async def focus_and_input_text(
     return "Success" if success else "Failed"
 
 
-@mcp.tool()
+@_tool()
 async def focus_and_clear_text(
     ctx: Context,
     coordinates: list[int],
@@ -392,7 +417,7 @@ async def focus_and_clear_text(
     return "Success" if success else "Failed"
 
 
-@mcp.tool()
+@_tool()
 async def erase_one_char(ctx: Context) -> str:
     """Erases a single character (simulates Backspace)."""
     try:
@@ -404,7 +429,7 @@ async def erase_one_char(ctx: Context) -> str:
     return "Success" if success else "Failed"
 
 
-@mcp.tool()
+@_tool()
 async def press_key(ctx: Context, keycode: str) -> str:
     """Presses a specific Android key e
```

**File**: `artemis/runtime/daemon_client.py` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ def is_daemon_running(
 def is_artemis_daemon(
     host: str = DEFAULT_DAEMON_HOST,
     port: int = DEFAULT_DAEMON_PORT,
-    timeout: float = 0.5,
+    timeout: float = 2.0,
 ) -> bool:
     """Identity probe: is the process on ``host:port`` the Artemis daemon?
 
```

---

### Incident Patch 2: `371aa6df` (2026-09-12)
**Commit Message**: fix: complete README and relevant file headers per Apache 2.0 requirements

**File**: `README.md` (modified, +2/-0)
```diff
@@ -314,3 +314,5 @@ Contributions are warmly welcomed!
 ## License
 
 This project is licensed under the [Apache License 2.0](LICENSE).
+
+This project includes source code developed by [Minitap, Inc.](https://github.com/minitap-ai/mobile-use).
\ No newline at end of file
```

**File**: `README_CN.md` (modified, +2/-0)
```diff
@@ -312,3 +312,5 @@ ARTEMIS 提供两种运行模式以适应不同的自动化需求：
 ## 开源许可证
 
 本项目基于 [Apache License 2.0](LICENSE) 协议开源。
+
+本项目包含由 [Minitap, Inc.](https://github.com/minitap-ai/mobile-use) 开发的源代码。
```

**File**: `artemis/agents/hopper/hopper.md` (modified, +5/-0)
```diff
@@ -1,3 +1,8 @@
+<!--
+Portions of this file are derived from mobile-use (https://github.com/minitap-ai/mobile-use)
+Copyright 2025-2026 Minitap, Inc. Licensed under the Apache License 2.0.
+-->
+
 ## Hopper
 
 Extract relevant information from batch data. **Keep extracted data exactly as-is** - no reformatting.
```

**File**: `artemis/agents/hopper/hopper.py` (modified, +3/-0)
```diff
@@ -11,6 +11,9 @@
 # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 # See the License for the specific language governing permissions and
 # limitations under the License.
+#
+# Portions of this file are derived from mobile-use (https://github.com/minitap-ai/mobile-use)
+# Copyright 2025-2026 Minitap, Inc. Licensed under the Apache License 2.0.
 
 from pathlib import Path
 
```

**File**: `artemis/agents/outputter/outputter.py` (modified, +3/-0)
```diff
@@ -11,6 +11,9 @@
 # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 # See the License for the specific language governing permissions and
 # limitations under the License.
+#
+# Portions of this file are derived from mobile-use (https://github.com/minitap-ai/mobile-use)
+# Copyright 2025-2026 Minitap, Inc. Licensed under the Apache License 2.0.
 
 import json
 from pathlib import Path
```

---

### Incident Patch 3: `1d82d59e` (2026-09-12)
**Commit Message**: Revert "refactor: clean up legacy code, rename hopper to entity_extractor, and add third-party notices"

This reverts commit 54fcef9887fbea193911acddca33e3b0d822862c.

Please do not submit unrelated docs and codes in the same commit. I am reverting this commit so that the related files can be submitted in better-organized future commits.

**File**: `.env.example` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ GEMINI_API_KEY=
 GOOGLE_API_KEY=
 OPENAI_API_KEY=
 ANTHROPIC_API_KEY=
-OPENROUTER_API_KEY=
+OPEN_ROUTER_API_KEY=
 XAI_API_KEY=
 
 # Google Cloud Vision OCR (Optional - for advanced OCR processing)
```

**File**: `NOTICE` (removed, +0/-27)
```diff
@@ -1,27 +0,0 @@
-ARTEMIS Android Agent & Automation Platform
-Copyright 2026 Google LLC
-
-This product includes software developed by Google LLC.
-
-================================================================================
-Third-Party Software Attribution
-================================================================================
-
-Portions of this software are derived from and incorporate code originally
-developed by the following open-source projects under the Apache License, Version 2.0:
-
-1. mobile-use
-   Repository: https://github.com/minitap-ai/mobile-use
-   Copyright 2025-2026 Minitap, Inc.
-   Original authors & contributors:
-     Pierre-Louis Favreau, Jean-Pierre Lo, Nicolas Dehandschoewercker,
-     Clément Guiguet, Karun Agarwal, and the mobile-use open-source community.
-   License: Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)
-
-2. finalrun-agent
-   Repository: https://github.com/final-run/finalrun-agent
-   Copyright 2025 FinalRun Inc.
-   Original authors & contributors:
-     Ashish Yadav, Arnold Laishram, Srinidhi G S,
-     and the finalrun-agent open-source community.
-   License: Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)
```

**File**: `README.md` (modified, +0/-4)
```diff
@@ -314,7 +314,3 @@ Contributions are warmly welcomed!
 ## License
 
 This project is licensed under the [Apache License 2.0](LICENSE).
-
-This project includes source code developed by [Minitap, Inc.](https://github.com/minitap-ai/mobile-use).
-
-
```

**File**: `README_CN.md` (modified, +0/-11)
```diff
@@ -312,14 +312,3 @@ ARTEMIS 提供两种运行模式以适应不同的自动化需求：
 ## 开源许可证
 
 本项目基于 [Apache License 2.0](LICENSE) 协议开源。
-
-## 致谢
-
-本项目包含由 [Minitap, Inc.](https://github.com/minitap-ai/mobile-use)（`mobile-use`）团队开发的部分源代码与工具组件，遵循 Apache License 2.0 开源许可。我们感谢其团队及开源社区在移动端自动化领域的贡献。
-
-同时感谢 [Finalrun](https://github.com/final-run/finalrun-agent) 在智能滑动与自适应手势机制理念上的启发。
-
-关于完整的第三方开源软件版权与归属声明，请参阅根目录的 [NOTICE](NOTICE) 文件。
-
-
-
```

**File**: `artemis/agents/entity_extractor/entity_extractor.md` (removed, +0/-30)
```diff
@@ -1,30 +0,0 @@
-# Artemis Entity Extractor & Package Resolver
-
-You are an autonomous, high-precision structured data extractor in the ARTEMIS mobile testing runtime.
-Your responsibility is to extract the exact requested identifier, package name, or configuration token from raw device dump outputs (such as `pm list packages`, `dumpsys`, logcat records, or accessibility tree dumps).
-
-## Operating Directives
-
-1. **Verbatim Extraction**:
-   - Return the extracted entity exactly as it appears in the source data.
-   - Do NOT modify capitalization, strip domain segments, translate, or normalize the matched identifier.
-
-2. **Package Resolution Rules**:
-   - Match target application titles, codenames, or brand identifiers against standard Android package formats (`com.<vendor>.<app>`, `org.<project>.<module>`, etc.).
-   - Prioritize exact matches over partial or prefix matches.
-
-3. **Strict Disambiguation & Null-Safety**:
-   - If the requested entity is absent from the input dataset, return `found: false` with `output: null`.
-   - If multiple candidates conflict and cannot be deterministically verified from the query, do NOT guess. Set `found: false` and `output: null`.
-
-## Structured Deliverable Schema
-
-You must produce your final answer conforming to the following JSON structure:
-
-```json
-{
-  "found": true,
-  "output": "<exact_matched_string_or_null>",
-  "reason": "<one_sentence_rationale_confirming_criteria>"
-}
-```
```

---

### Incident Patch 4: `08607881` (2026-09-11)
**Commit Message**: fix: use public dependency sources in lockfiles

Regenerate uv.lock against PyPI without changing dependency versions or hashes. Check Python and npm dependency sources before CI installation and enforce a current lockfile.

Fixes #28

**File**: `.github/workflows/ci.yml` (modified, +4/-1)
```diff
@@ -37,14 +37,17 @@ jobs:
         with:
           python-version: "3.12"
 
+      - name: Check public dependency sources before installation
+        run: python scripts/check_dependency_sources.py
+
       - name: Set up uv
         uses: astral-sh/setup-uv@v6
         with:
           enable-cache: true
           cache-dependency-glob: uv.lock
 
       - name: Install locked development environment
-        run: uv sync --dev --frozen
+        run: uv sync --dev --locked
 
       - name: Check Python formatting
         run: uv run ruff format --check .
```

**File**: `scripts/check_dependency_sources.py` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+#!/usr/bin/env python3
+# Copyright 2026 Google LLC
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Reject private dependency sources before installing project dependencies.
+
+Uses only the Python 3.12+ standard library so CI can run it before uv sync.
+"""
+
+import json
+import sys
+import tomllib
+from pathlib import Path
+from urllib.parse import urlsplit
+
+ROOT = Path(__file__).resolve().parents[1]
+
+
+def main() -> int:
+    errors: list[str] = []
+
+    def check_url(label: str, url: str, host: str) -> None:
+        parsed = urlsplit(url)
+        if parsed.scheme != "https" or parsed.netloc != host:
+            errors.append(f"{label}: expected an HTTPS URL on {host}")
+
+    lock = tomllib.loads((ROOT / "uv.lock").read_text(encoding="utf-8"))
+    workspace_sources = {
+        "artemis": {"editable": "."},
+        "artemis-client": {"editable": "packages/artemis-client"},
+    }
+    for package in lock["package"]:
+        label = f"uv.lock: {package['name']}=={package['version']}"
+        source = package["source"]
+        if source != workspace_sources.get(package["name"]):
+            if source != {"registry": "https://pypi.org/simple"}:
+                errors.append(f"{label}: expected the public PyPI registry")
+        artifacts = list(package.get("wheels", []))
+        if "sdist" in package:
+            artifacts.append(package["sdist"])
+        for artifact in artifacts:
+            check_url(f"{label}: artifact", artifact.get("url", ""), "files.pythonhosted.org")
+
+    npm_lock = json.loads((ROOT / "apps/showcase_ui/package-lock.json").read_text(encoding="utf-8"))
+    for name, package in npm_lock["packages"].items():
+        if "resolved" in package:
+            check_url(f"package-lock.json: {name}", package["resolved"], "registry.npmjs.org")
+
+    if errors:
+        print("Dependency source check failed:\n" + "\n".join(errors), file=sys.stderr)
+        return 1
+    print("Dependency sources use public PyPI and npm registries.")
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
```

---

### Incident Patch 5: `3047c9c2` (2026-09-11)
**Commit Message**: Fix Python code format check issues

**File**: `artemis/clients/accessibility_client.py` (modified, +29/-6)
```diff
@@ -79,11 +79,15 @@ def ensure_service_ready(self, apk_path: str | None = None) -> bool:
         # 4. Verify connection
         for attempt in range(5):
             if self.ping():
-                logger.info(f"ArtemisAccessibilityHelper connected successfully on {self._device_id}")
+                logger.info(
+                    f"ArtemisAccessibilityHelper connected successfully on {self._device_id}"
+                )
                 return True
             time.sleep(0.5)
 
-        logger.warning(f"Failed to connect to ArtemisAccessibilityHelper on port {self._local_port}")
+        logger.warning(
+            f"Failed to connect to ArtemisAccessibilityHelper on port {self._local_port}"
+        )
         return False
 
     def ping(self) -> bool:
@@ -129,7 +133,11 @@ def get_atomic_snapshot(self) -> dict | None:
             req = urllib.request.Request(f"{self._base_url}/snapshot")
             with urllib.request.urlopen(req, timeout=6.0) as resp:
                 data = json.loads(resp.read().decode())
-                if data.get("success") and data.get("has_screenshot") and data.get("screenshot_base64"):
+                if (
+                    data.get("success")
+                    and data.get("has_screenshot")
+                    and data.get("screenshot_base64")
+                ):
                     return data
         except Exception as e:
             logger.debug(f"Atomic snapshot request failed (falling back to dual path): {e}")
@@ -226,11 +234,26 @@ def _is_installed(self) -> bool:
 
     def _enable_accessibility_service(self) -> None:
         """Silently enable the accessibility service via adb settings without UI prompts."""
-        res = self._run_adb(["shell", "settings", "get", "secure", "enabled_accessibility_services"])
+        res = self._run_adb(
+            ["shell", "settings", "get", "secure", "enabled_accessibility_services"]
+        )
         current_services = res.stdout.strip()
         if SERVICE_NAME not in current_services:
-            new_services = f"{current_services}:{SERVICE_NAME}" if current_services and current_services != "null" else SERVICE_NAME
-            self._run_adb(["shell", "settings", "put", "secure", "enabled_accessibility_services", new_services])
+            new_services = (
+                f"{current_services}:{SERVICE_NAME}"
+                if current_services and current_services != "null"
+                else SERVICE_NAME
+            )
+            self._run_adb(
+                [
+                    "shell",
+                    "settings",
+                    "put",
+                    "secure",
+                    "enabled_accessibility_services",
+                    new_services,
+                ]
+            )
         self._run_adb(["shell", "settings", "put", "secure", "accessibility_enabled", "1"])
 
     def _setup_port_forward(self) -> None:
```

**File**: `docs/assets/generate_banner.py` (modified, +15/-4)
```diff
@@ -163,16 +163,27 @@ def generate_banner(
     center_x = px + iw / 2.0
     center_y = py + ih / 2.0
     print(f"Banner successfully generated: {output_path} ({cw}x{ch})")
-    print(f"Ink dimensions: {iw}x{ih}px, Exact center: ({center_x:.1f}, {center_y:.1f}) [Canvas center: ({cw/2:.1f}, {ch/2:.1f}), Offset X: {offset_x:+d}px]")
+    print(
+        f"Ink dimensions: {iw}x{ih}px, Exact center: ({center_x:.1f}, {center_y:.1f}) [Canvas center: ({cw / 2:.1f}, {ch / 2:.1f}), Offset X: {offset_x:+d}px]"
+    )
 
 
 if __name__ == "__main__":
     import argparse
 
     parser = argparse.ArgumentParser(description="ARTEMIS Official Banner Generator")
-    parser.add_argument("--offset-x", type=int, default=160, help="Horizontal pixel offset to the right from mathematical center (default: 160)")
-    parser.add_argument("--tracking", type=int, default=64, help="Character tracking spacing (default: 64)")
-    parser.add_argument("--font-size", type=int, default=98, help="Font size in pixels (default: 98)")
+    parser.add_argument(
+        "--offset-x",
+        type=int,
+        default=160,
+        help="Horizontal pixel offset to the right from mathematical center (default: 160)",
+    )
+    parser.add_argument(
+        "--tracking", type=int, default=64, help="Character tracking spacing (default: 64)"
+    )
+    parser.add_argument(
+        "--font-size", type=int, default=98, help="Font size in pixels (default: 98)"
+    )
     args = parser.parse_args()
 
     assets_dir = os.path.dirname(os.path.abspath(__file__))
```

**File**: `playground/backend_manager/app/auth/jwt_handler.py` (modified, +6/-2)
```diff
@@ -23,7 +23,9 @@
 
 def create_access_token(user_id: str, extra_claims: dict | None = None) -> str:
     """Generate a signed JWT access token."""
-    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
+    expire = datetime.now(timezone.utc) + timedelta(
+        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
+    )
     to_encode = {
         "sub": user_id,
         "exp": expire,
@@ -48,7 +50,9 @@ def decode_access_token(token: str) -> dict:
         )
 
 
-async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Security(security)) -> str:
+async def get_current_user(
+    credentials: HTTPAuthorizationCredentials | None = Security(security),
+) -> str:
     """FastAPI dependency to extract and verify the current user_id."""
     if not credentials:
         raise HTTPException(
```

**File**: `playground/backend_manager/app/auth/otp_service.py` (modified, +3/-1)
```diff
@@ -45,7 +45,9 @@ def generate_otp(self, identifier: str) -> str:
         }
 
         # Dispatch via SMS / Email provider (mocked logger in template)
-        logger.info(f"[OTP Service] Generated OTP for {ident}: [{code}] (Expires at: {expires_at.isoformat()})")
+        logger.info(
+            f"[OTP Service] Generated OTP for {ident}: [{code}] (Expires at: {expires_at.isoformat()})"
+        )
         return code
 
     def verify_otp(self, identifier: str, code: str) -> bool:
```

**File**: `playground/backend_manager/app/config.py` (modified, +3/-1)
```diff
@@ -43,7 +43,9 @@ class Settings(BaseSettings):
     ARTEMIS_MEMORY_LIMIT: str = "2g"
 
     # Cloud Orchestrator & Cuttlefish Host Settings
-    CLOUD_ORCHESTRATOR_URL: str = os.getenv("CLOUD_ORCHESTRATOR_URL", "http://cloud-orchestrator:2081")
+    CLOUD_ORCHESTRATOR_URL: str = os.getenv(
+        "CLOUD_ORCHESTRATOR_URL", "http://cloud-orchestrator:2081"
+    )
     CUTTLEFISH_HOST_GATEWAY: str = os.getenv("CUTTLEFISH_HOST_GATEWAY", "cloud-orchestrator")
     CUTTLEFISH_START_ADB_PORT: int = 6520
     CUTTLEFISH_START_WEBRTC_PORT: int = 8443
```

---

### Incident Patch 6: `38a2de6a` (2026-09-10)
**Commit Message**: fix: keep Windows bootstrap scripts ASCII-compatible

**File**: `scripts/install_deps.ps1` (modified, +39/-39)
```diff
@@ -32,7 +32,7 @@ try {
 } catch {}
 
 Write-Host "======================================================" -ForegroundColor Cyan
-Write-Host "   🚀 Artemis - Windows Smart Installer               " -ForegroundColor Cyan
+Write-Host "   Artemis - Windows Smart Installer                  " -ForegroundColor Cyan
 Write-Host "======================================================" -ForegroundColor Cyan
 Write-Host ""
 
@@ -163,12 +163,12 @@ function Install-PortablePlatformTools {
             Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
             if (Test-Path "$ptDir\adb.exe") {
                 $env:PATH = "$ptDir;$env:PATH"
-                Write-Host "   ✔ adb installed in user space." -ForegroundColor Green
+                Write-Host "   [OK] adb installed in user space." -ForegroundColor Green
                 return $true
             }
         }
     } catch {
-        Write-Host "   ⚠ Failed to install portable platform-tools: $_" -ForegroundColor DarkYellow
+        Write-Host "   [WARN] Failed to install portable platform-tools: $_" -ForegroundColor DarkYellow
     }
     return $false
 }
@@ -209,12 +209,12 @@ function Install-PortableScrcpy {
             Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
             if (Test-Path "$scrcpyDir\scrcpy.exe") {
                 $env:PATH = "$scrcpyDir;$env:PATH"
-                Write-Host "   ✔ Portable scrcpy installed in user space." -ForegroundColor Green
+                Write-Host "   [OK] Portable scrcpy installed in user space." -ForegroundColor Green
                 return $true
             }
         }
     } catch {
-        Write-Host "   ⚠ Failed to install portable scrcpy: $_" -ForegroundColor DarkYellow
+        Write-Host "   [WARN] Failed to install portable scrcpy: $_" -ForegroundColor DarkYellow
     }
     return $false
 }
@@ -283,12 +283,12 @@ function Install-PortableNode {
             Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
             if (Test-Path "$nodeDir\node.exe") {
                 $env:PATH = "$nodeDir;$env:PATH"
-                Write-Host "   ✔ Portable Node.js $nodeVer installed in user space." -ForegroundColor Green
+                Write-Host "   [OK] Portable Node.js $nodeVer installed in user space." -ForegroundColor Green
                 return $true
             }
         }
     } catch {
-        Write-Host "   ⚠ Failed to install portable Node.js: $_" -ForegroundColor DarkYellow
+        Write-Host "   [WARN] Failed to install portable Node.js: $_" -ForegroundColor DarkYellow
     }
     return $false
 }
@@ -305,7 +305,7 @@ if (-not (Test-CommandExists "ffmpeg")) { $missingTools += "ffmpeg" }
 if (-not (Test-CommandExists "scrcpy")) { $missingTools += "scrcpy" }
 
 if ($missingTools.Count -eq 0) {
-    Write-Host "   ✔ All system toolchains are already installed (ADB, FFmpeg, scrcpy)." -ForegroundColor Green
+    Write-Host "   [OK] All system toolchains are already installed (ADB, FFmpeg, scrcpy)." -ForegroundColor Green
     Start-LocalAdbServer
 } else {
     Write-Host "   ! Missing toolchains: $($missingTools -join ', ')" -ForegroundColor DarkYellow
@@ -324,15 +324,15 @@ if ($missingTools.Count -eq 0) {
     if ($useWinGet) {
         Write-Host "   Detected WinGet. Installing packages..." -ForegroundColor Cyan
         if ($missingTools -contains "adb") {
-            Write-Host "   📦 Installing Google.PlatformTools (ADB)..." -ForegroundColor Cyan
+            Write-Host "   [INFO] Installing Google.PlatformTools (ADB)..." -ForegroundColor Cyan
             winget install --id Google.PlatformTools -e --accept-source-agreements --accept-package-agreements --silent 2>$null | Out-Null
         }
         if ($missingTools -contains "ffmpeg") {
-            Write-Host "   📦 Installing Gyan.FFmpeg..." -ForegroundColor Cyan
+            Write-Host "   [INFO] Installing Gyan.FFmpeg..." -ForegroundColor Cyan
             winget install --id Gyan.FFmpeg -e --
```

**File**: `scripts/start.ps1` (modified, +2/-2)
```diff
@@ -204,12 +204,12 @@ function Install-PortableScrcpy {
             Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
             if (Test-Path "$scrcpyDir\scrcpy.exe") {
                 $env:PATH = "$scrcpyDir;$env:PATH"
-                Write-Host "   ✔ Portable scrcpy installed in user space." -ForegroundColor Green
+                Write-Host "   [OK] Portable scrcpy installed in user space." -ForegroundColor Green
                 return $true
             }
         }
     } catch {
-        Write-Host "   ⚠ Failed to install portable scrcpy: $_" -ForegroundColor DarkYellow
+        Write-Host "   [WARN] Failed to install portable scrcpy: $_" -ForegroundColor DarkYellow
     }
     return $false
 }
```

**File**: `tests/unit/test_bootstrap_scripts_encoding.py` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+# Copyright 2026 Google LLC
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Keep bootstrap scripts ASCII for Windows PowerShell 5.1 compatibility.
+
+BOM-less scripts are decoded using the system ANSI code page. UTF-8 symbols
+can become quote delimiters under cp1252 and cause parse errors.
+"""
+
+from pathlib import Path
+
+import pytest
+
+SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"
+POWERSHELL_SCRIPTS = sorted(SCRIPTS_DIR.glob("*.ps1"))
+
+
+def test_powershell_scripts_are_discovered():
+    assert POWERSHELL_SCRIPTS, f"no .ps1 scripts found under {SCRIPTS_DIR}"
+
+
+@pytest.mark.parametrize("script", POWERSHELL_SCRIPTS, ids=lambda p: p.name)
+def test_powershell_script_is_pure_ascii(script):
+    raw = script.read_bytes()
+    offending = []
+    line_no = 1
+    for index, byte in enumerate(raw):
+        if byte == 0x0A:
+            line_no += 1
+        elif byte > 0x7F:
+            offending.append((line_no, index, hex(byte)))
+
+    assert not offending, (
+        f"{script.name} contains non-ASCII bytes at (line, offset, byte) "
+        f"{offending[:10]}; Windows PowerShell 5.1 decodes BOM-less .ps1 files "
+        "with the system ANSI code page. Use ASCII status labels."
+    )
```

---

### Incident Patch 7: `611d1a09` (2026-09-05)
**Commit Message**: fix(bootstrap): harden Windows PowerShell & shell scripts against download hangs and version conflicts

**File**: `scripts/install_deps.ps1` (modified, +177/-67)
```diff
@@ -26,6 +26,11 @@ param(
 $ErrorActionPreference = "Continue"
 [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
 
+# Ensure modern TLS protocols are enabled for downloads (GitHub releases, nodejs.org, Google repositories)
+try {
+    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12
+} catch {}
+
 Write-Host "======================================================" -ForegroundColor Cyan
 Write-Host "   🚀 Artemis - Windows Smart Installer               " -ForegroundColor Cyan
 Write-Host "======================================================" -ForegroundColor Cyan
@@ -38,34 +43,50 @@ Set-Location $RootDir
 function Update-EnvironmentPath {
     $standardDirs = @(
         "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
+        "$env:LOCALAPPDATA\Programs\node",
+        "$env:USERPROFILE\.local\share\node",
+        "$env:LOCALAPPDATA\Programs\scrcpy",
+        "$env:USERPROFILE\.local\share\scrcpy",
+        "$env:LOCALAPPDATA\Programs\platform-tools",
+        "$env:USERPROFILE\.local\share\platform-tools",
+        "$env:LOCALAPPDATA\Programs\uv",
+        "$env:LOCALAPPDATA\uv",
+        "$env:APPDATA\uv",
+        "$env:USERPROFILE\.cargo\bin",
+        "$env:USERPROFILE\.local\bin",
+        "$env:USERPROFILE\scoop\shims",
+        "C:\ProgramData\chocolatey\bin",
         "$env:LOCALAPPDATA\Android\Sdk\platform-tools",
         "$env:LOCALAPPDATA\Android\android-sdk\platform-tools",
         "$env:ProgramFiles\Android\platform-tools",
         "${env:ProgramFiles(x86)}\Android\android-sdk\platform-tools",
         "$env:ProgramFiles\nodejs",
         "${env:ProgramFiles(x86)}\nodejs",
-        "$env:APPDATA\npm",
-        "$env:LOCALAPPDATA\Programs\platform-tools",
-        "$env:LOCALAPPDATA\Programs\scrcpy",
-        "$env:LOCALAPPDATA\Programs\node",
-        "$env:USERPROFILE\.local\share\platform-tools",
-        "$env:USERPROFILE\.local\share\scrcpy",
-        "$env:USERPROFILE\.local\share\node",
-        "$env:LOCALAPPDATA\nvm",
-        "$env:ProgramData\nvm",
-        "C:\ProgramData\chocolatey\bin",
-        "$env:USERPROFILE\scoop\shims",
-        "$env:USERPROFILE\.local\bin",
-        "$env:USERPROFILE\.cargo\bin"
+        "$env:APPDATA\npm"
     )
+    if ($env:CARGO_HOME) { $standardDirs = @("$env:CARGO_HOME\bin") + $standardDirs }
     if ($env:ANDROID_HOME) { $standardDirs += "$env:ANDROID_HOME\platform-tools" }
     if ($env:ANDROID_SDK_ROOT) { $standardDirs += "$env:ANDROID_SDK_ROOT\platform-tools" }
-    if ($env:NVM_HOME) { $standardDirs += $env:NVM_HOME }
-    if ($env:NVM_SYMLINK) { $standardDirs += $env:NVM_SYMLINK }
+    if ($env:NVM_SYMLINK) { $standardDirs = @($env:NVM_SYMLINK) + $standardDirs }
+    if ($env:NVM_HOME) { $standardDirs = @($env:NVM_HOME) + $standardDirs }
 
     $regPath = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine")
     $currentPaths = ($env:PATH -split ";") + ($regPath -split ";") + $standardDirs | Where-Object { [string]::IsNullOrWhiteSpace($_) -eq $false -and (Test-Path $_) } | Select-Object -Unique
     $env:PATH = $currentPaths -join ";"
+
+    # Ensure user-space portable tools take absolute priority over system-level outdated versions
+    $portableNode = "$env:LOCALAPPDATA\Programs\node"
+    if (Test-Path "$portableNode\node.exe") {
+        $env:PATH = "$portableNode;$env:PATH"
+    }
+    $portableScrcpy = "$env:LOCALAPPDATA\Programs\scrcpy"
+    if (Test-Path "$portableScrcpy\scrcpy.exe") {
+        $env:PATH = "$portableScrcpy;$env:PATH"
+    }
+    $portablePt = "$env:LOCALAPPDATA\Programs\platform-tools"
+    if (Test-Path "$portablePt\adb.exe") {
+        $env:PATH = "$portablePt;$env:PATH"
+    }
 }
 
 function Start-LocalAdbServer {
@@ -85,6 +106,48 @@ function Test-CommandExists {
     return ($null -ne $res)
 }
 
+function Invoke-DownloadFile {
+    param(
+        [Parameter(M
```

**File**: `scripts/install_deps.sh` (modified, +4/-4)
```diff
@@ -282,7 +282,7 @@ install_system_packages() {
                 if [ ! -x "${PT_DIR}/adb" ]; then
                     echo -e "   ${CYAN}📦 Installing Android platform-tools (adb) in user space...${NC}"
                     local TEMP_ZIP="/tmp/platform-tools-$$.zip"
-                    if curl -fsSL "https://dl.google.com/android/repository/platform-tools-latest-linux.zip" -o "${TEMP_ZIP}" 2>/dev/null; then
+                    if curl -fsSL --connect-timeout 5 --max-time 30 "https://dl.google.com/android/repository/platform-tools-latest-linux.zip" -o "${TEMP_ZIP}" 2>/dev/null; then
                         mkdir -p "${HOME}/.local/share" "${HOME}/.local/bin"
                         if has_cmd unzip; then
                             unzip -q -o "${TEMP_ZIP}" -d "${HOME}/.local/share" 2>/dev/null || true
@@ -425,10 +425,10 @@ setup_showcase_ui() {
                     if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
                     if has_cmd apt-get; then
                         echo -e "   ${CYAN}📦 Configuring NodeSource Node.js 22 LTS repository...${NC}"
-                        curl -fsSL https://deb.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
+                        curl -fsSL --connect-timeout 5 --max-time 30 https://deb.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
                         ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 install -y -qq nodejs 2>/dev/null || true
                     elif has_cmd dnf; then
-                        curl -fsSL https://rpm.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
+                        curl -fsSL --connect-timeout 5 --max-time 30 https://rpm.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
                         ${SUDO_PREFIX} dnf install -y nodejs || true
                     elif has_cmd pacman; then
                         ${SUDO_PREFIX} pacman -S --noconfirm nodejs npm || true
@@ -451,7 +451,7 @@ setup_showcase_ui() {
                     echo -e "   ${CYAN}📦 Installing portable Node.js ${NODE_VER} in user space (~/.local)...${NC}"
                     rm -rf "${NODE_DIR}"
                     mkdir -p "${NODE_DIR}" "${HOME}/.local/bin"
-                    if curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-${OS_SYS}-${NODE_ARCH}.tar.gz" | tar -xz -C "${NODE_DIR}" --strip-components=1 2>/dev/null; then
+                    if curl -fsSL --connect-timeout 5 --max-time 60 "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-${OS_SYS}-${NODE_ARCH}.tar.gz" | tar -xz -C "${NODE_DIR}" --strip-components=1 2>/dev/null; then
                         ln -sf "${NODE_DIR}/bin/node" "${HOME}/.local/bin/node"
                         ln -sf "${NODE_DIR}/bin/npm" "${HOME}/.local/bin/npm"
                         ln -sf "${NODE_DIR}/bin/npx" "${HOME}/.local/bin/npx"
```

**File**: `scripts/start.ps1` (modified, +186/-66)
```diff
@@ -21,6 +21,11 @@ param(
 $ErrorActionPreference = "Continue"
 [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
 
+# Ensure modern TLS protocols are enabled for downloads (GitHub releases, nodejs.org, Google repositories)
+try {
+    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12
+} catch {}
+
 $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
 $RootDir = Split-Path -Parent $ScriptDir
 Set-Location $RootDir
@@ -33,34 +38,50 @@ Write-Host ""
 function Update-EnvironmentPath {
     $standardDirs = @(
         "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
+        "$env:LOCALAPPDATA\Programs\node",
+        "$env:USERPROFILE\.local\share\node",
+        "$env:LOCALAPPDATA\Programs\scrcpy",
+        "$env:USERPROFILE\.local\share\scrcpy",
+        "$env:LOCALAPPDATA\Programs\platform-tools",
+        "$env:USERPROFILE\.local\share\platform-tools",
+        "$env:LOCALAPPDATA\Programs\uv",
+        "$env:LOCALAPPDATA\uv",
+        "$env:APPDATA\uv",
+        "$env:USERPROFILE\.cargo\bin",
+        "$env:USERPROFILE\.local\bin",
+        "$env:USERPROFILE\scoop\shims",
+        "C:\ProgramData\chocolatey\bin",
         "$env:LOCALAPPDATA\Android\Sdk\platform-tools",
         "$env:LOCALAPPDATA\Android\android-sdk\platform-tools",
         "$env:ProgramFiles\Android\platform-tools",
         "${env:ProgramFiles(x86)}\Android\android-sdk\platform-tools",
         "$env:ProgramFiles\nodejs",
         "${env:ProgramFiles(x86)}\nodejs",
-        "$env:APPDATA\npm",
-        "$env:LOCALAPPDATA\Programs\platform-tools",
-        "$env:LOCALAPPDATA\Programs\scrcpy",
-        "$env:LOCALAPPDATA\Programs\node",
-        "$env:USERPROFILE\.local\share\platform-tools",
-        "$env:USERPROFILE\.local\share\scrcpy",
-        "$env:USERPROFILE\.local\share\node",
-        "$env:LOCALAPPDATA\nvm",
-        "$env:ProgramData\nvm",
-        "C:\ProgramData\chocolatey\bin",
-        "$env:USERPROFILE\scoop\shims",
-        "$env:USERPROFILE\.local\bin",
-        "$env:USERPROFILE\.cargo\bin"
+        "$env:APPDATA\npm"
     )
+    if ($env:CARGO_HOME) { $standardDirs = @("$env:CARGO_HOME\bin") + $standardDirs }
     if ($env:ANDROID_HOME) { $standardDirs += "$env:ANDROID_HOME\platform-tools" }
     if ($env:ANDROID_SDK_ROOT) { $standardDirs += "$env:ANDROID_SDK_ROOT\platform-tools" }
-    if ($env:NVM_HOME) { $standardDirs += $env:NVM_HOME }
-    if ($env:NVM_SYMLINK) { $standardDirs += $env:NVM_SYMLINK }
+    if ($env:NVM_SYMLINK) { $standardDirs = @($env:NVM_SYMLINK) + $standardDirs }
+    if ($env:NVM_HOME) { $standardDirs = @($env:NVM_HOME) + $standardDirs }
 
     $regPath = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine")
     $currentPaths = ($env:PATH -split ";") + ($regPath -split ";") + $standardDirs | Where-Object { [string]::IsNullOrWhiteSpace($_) -eq $false -and (Test-Path $_) } | Select-Object -Unique
     $env:PATH = $currentPaths -join ";"
+
+    # Ensure user-space portable tools take absolute priority over system-level outdated versions
+    $portableNode = "$env:LOCALAPPDATA\Programs\node"
+    if (Test-Path "$portableNode\node.exe") {
+        $env:PATH = "$portableNode;$env:PATH"
+    }
+    $portableScrcpy = "$env:LOCALAPPDATA\Programs\scrcpy"
+    if (Test-Path "$portableScrcpy\scrcpy.exe") {
+        $env:PATH = "$portableScrcpy;$env:PATH"
+    }
+    $portablePt = "$env:LOCALAPPDATA\Programs\platform-tools"
+    if (Test-Path "$portablePt\adb.exe") {
+        $env:PATH = "$portablePt;$env:PATH"
+    }
 }
 
 function Start-LocalAdbServer {
@@ -80,6 +101,48 @@ function Test-CommandExists {
     return ($null -ne $res)
 }
 
+function Invoke-DownloadFile {
+    param(
+        [Parameter(Mandatory=$true)][string]$Uri,
+        [Parameter(Mandatory=$true)][string]$OutFile,
+        [int]$TimeoutSec = 45
+    )
+    if (Test-Path $OutFi
```

**File**: `start.sh` (modified, +2/-2)
```diff
@@ -221,7 +221,7 @@ if [ ${#MISSING_CORE[@]} -gt 0 ]; then
                 if [ ! -x "${PT_DIR}/adb" ]; then
                     echo -e "   ${CYAN}📦 Installing Android platform-tools (adb) in user space...${NC}"
                     TEMP_ZIP="/tmp/platform-tools-$$.zip"
-                    if curl -fsSL "https://dl.google.com/android/repository/platform-tools-latest-linux.zip" -o "${TEMP_ZIP}" 2>/dev/null; then
+                    if curl -fsSL --connect-timeout 5 --max-time 30 "https://dl.google.com/android/repository/platform-tools-latest-linux.zip" -o "${TEMP_ZIP}" 2>/dev/null; then
                         mkdir -p "${HOME}/.local/share" "${HOME}/.local/bin"
                         if command -v unzip >/dev/null 2>&1; then
                             unzip -q -o "${TEMP_ZIP}" -d "${HOME}/.local/share" 2>/dev/null || true
@@ -333,7 +333,7 @@ if [ ! -f "${SHOWCASE_INDEX}" ] && [ ! -f "${SHOWCASE_INDEX_ALT1}" ] && [ ! -f "
                 echo -e "   ${CYAN}📦 Installing portable Node.js ${NODE_VER} in user space (~/.local)...${NC}"
                 rm -rf "${NODE_DIR}"
                 mkdir -p "${NODE_DIR}" "${HOME}/.local/bin"
-                if curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-${OS_SYS}-${NODE_ARCH}.tar.gz" | tar -xz -C "${NODE_DIR}" --strip-components=1 2>/dev/null; then
+                if curl -fsSL --connect-timeout 5 --max-time 60 "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-${OS_SYS}-${NODE_ARCH}.tar.gz" | tar -xz -C "${NODE_DIR}" --strip-components=1 2>/dev/null; then
                     ln -sf "${NODE_DIR}/bin/node" "${HOME}/.local/bin/node"
                     ln -sf "${NODE_DIR}/bin/npm" "${HOME}/.local/bin/npm"
                     ln -sf "${NODE_DIR}/bin/npx" "${HOME}/.local/bin/npx"
```

---

### Incident Patch 8: `739c1c29` (2026-09-05)
**Commit Message**: fix(start.sh): remove snap and rogue local keyword, streamline fast portable scrcpy fallback

**File**: `scripts/install_deps.sh` (modified, +6/-14)
```diff
@@ -231,34 +231,26 @@ install_system_packages() {
             fi
 
             if has_cmd apt-get; then
-                echo -e "   ${CYAN}Detected Debian/Ubuntu (apt-get). Synchronizing and installing...${NC}"
-                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 update -qq 2>/dev/null || true
-                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 install -y "${PKGS[@]}" 2>/dev/null || true
+                echo -e "   ${CYAN}Detected Debian/Ubuntu (apt-get). Installing missing packages...${NC}"
+                DEBIAN_FRONTEND=noninteractive ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=3 -o Acquire::http::Timeout=3 -o Acquire::https::Timeout=3 install -y "${PKGS[@]}" 2>/dev/null || true
             elif has_cmd dnf; then
                 echo -e "   ${CYAN}Detected Fedora/RHEL (dnf). Installing packages...${NC}"
                 local DNF_PKGS=()
                 [ "${need_adb}" = true ] && DNF_PKGS+=("android-tools")
                 [ "${need_ffmpeg}" = true ] && DNF_PKGS+=("ffmpeg")
                 [ "${need_scrcpy}" = true ] && DNF_PKGS+=("scrcpy")
-                ${SUDO_PREFIX} dnf install -y "${DNF_PKGS[@]}" || true
+                ${SUDO_PREFIX} dnf install -y "${DNF_PKGS[@]}" 2>/dev/null || true
             elif has_cmd pacman; then
                 echo -e "   ${CYAN}Detected Arch Linux (pacman). Installing packages...${NC}"
                 local PAC_PKGS=()
                 [ "${need_adb}" = true ] && PAC_PKGS+=("android-tools")
                 [ "${need_ffmpeg}" = true ] && PAC_PKGS+=("ffmpeg")
                 [ "${need_scrcpy}" = true ] && PAC_PKGS+=("scrcpy")
-                ${SUDO_PREFIX} pacman -S --noconfirm "${PAC_PKGS[@]}" || true
+                ${SUDO_PREFIX} pacman -S --noconfirm "${PAC_PKGS[@]}" 2>/dev/null || true
             fi
         fi
 
-        # Fallback: if scrcpy is still missing, try snap or install portable scrcpy in user space
-        if ! has_cmd scrcpy; then
-            if has_cmd snap && request_sudo "install scrcpy via snap"; then
-                local SUDO_PREFIX=""
-                if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
-                ${SUDO_PREFIX} snap install scrcpy 2>/dev/null || true
-            fi
-        fi
+        # Fallback: if scrcpy is still missing, install official precompiled portable scrcpy in user space
         if ! has_cmd scrcpy; then
             local SCRCPY_ARCH=""
             case "${ARCH_TYPE}" in
@@ -271,7 +263,7 @@ install_system_packages() {
                     echo -e "   ${CYAN}📦 Installing portable scrcpy in user space (~/.local)...${NC}"
                     mkdir -p "${SCRCPY_DIR}" "${HOME}/.local/bin"
                     local SCRCPY_URL="https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-linux-${SCRCPY_ARCH}-v4.1.tar.gz"
-                    if curl -fsSL "${SCRCPY_URL}" | tar -xz -C "${SCRCPY_DIR}" --strip-components=1 2>/dev/null; then
+                    if curl -fsSL --connect-timeout 5 --max-time 30 "${SCRCPY_URL}" | tar -xz -C "${SCRCPY_DIR}" --strip-components=1 2>/dev/null; then
                         ln -sf "${SCRCPY_DIR}/scrcpy" "${HOME}/.local/bin/scrcpy"
                         export PATH="${SCRCPY_DIR}:${PATH}"
                         echo -e "   ${GREEN}✓ scrcpy installed in user space.${NC}"
```

**File**: `start.sh` (modified, +6/-13)
```diff
@@ -178,23 +178,16 @@ if [ ${#MISSING_CORE[@]} -gt 0 ]; then
             SUDO_PREFIX=""
             if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
             if command -v apt-get >/dev/null 2>&1; then
-                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 update -qq 2>/dev/null || true
-                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 install -y -qq "${MISSING_CORE[@]}" 2>/dev/null || true
+                echo -e "   ${CYAN}📦 Installing missing packages (${MISSING_CORE[*]}) via apt-get...${NC}"
+                DEBIAN_FRONTEND=noninteractive ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=3 -o Acquire::http::Timeout=3 -o Acquire::https::Timeout=3 install -y -qq "${MISSING_CORE[@]}" 2>/dev/null || true
             elif command -v dnf >/dev/null 2>&1; then
-                ${SUDO_PREFIX} dnf install -y "${MISSING_CORE[@]}" || true
+                ${SUDO_PREFIX} dnf install -y "${MISSING_CORE[@]}" 2>/dev/null || true
             elif command -v pacman >/dev/null 2>&1; then
-                ${SUDO_PREFIX} pacman -S --noconfirm "${MISSING_CORE[@]}" || true
+                ${SUDO_PREFIX} pacman -S --noconfirm "${MISSING_CORE[@]}" 2>/dev/null || true
             fi
         fi
 
-        # Fallback: if scrcpy is still missing, try snap or install portable scrcpy in user space
-        if ! command -v scrcpy >/dev/null 2>&1; then
-            if command -v snap >/dev/null 2>&1 && request_sudo "install scrcpy via snap"; then
-                local SUDO_PREFIX=""
-                if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
-                ${SUDO_PREFIX} snap install scrcpy 2>/dev/null || true
-            fi
-        fi
+        # Fallback: if scrcpy is still missing, install official precompiled portable scrcpy in user space
         if ! command -v scrcpy >/dev/null 2>&1; then
             ARCH="$(uname -m)"
             SCRCPY_ARCH=""
@@ -208,7 +201,7 @@ if [ ${#MISSING_CORE[@]} -gt 0 ]; then
                     echo -e "   ${CYAN}📦 Installing portable scrcpy in user space (~/.local)...${NC}"
                     mkdir -p "${SCRCPY_DIR}" "${HOME}/.local/bin"
                     SCRCPY_URL="https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-linux-${SCRCPY_ARCH}-v4.1.tar.gz"
-                    if curl -fsSL "${SCRCPY_URL}" | tar -xz -C "${SCRCPY_DIR}" --strip-components=1 2>/dev/null; then
+                    if curl -fsSL --connect-timeout 5 --max-time 30 "${SCRCPY_URL}" | tar -xz -C "${SCRCPY_DIR}" --strip-components=1 2>/dev/null; then
                         ln -sf "${SCRCPY_DIR}/scrcpy" "${HOME}/.local/bin/scrcpy"
                         export PATH="${SCRCPY_DIR}:${PATH}"
                         echo -e "   ${GREEN}✓ scrcpy installed in user space.${NC}"
```

---

### Incident Patch 9: `2e66ac5b` (2026-09-05)
**Commit Message**: fix(scripts): set apt lock timeout to 5s for fast fallback

**File**: `scripts/install_deps.sh` (modified, +3/-3)
```diff
@@ -232,8 +232,8 @@ install_system_packages() {
 
             if has_cmd apt-get; then
                 echo -e "   ${CYAN}Detected Debian/Ubuntu (apt-get). Synchronizing and installing...${NC}"
-                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=60 update -qq 2>/dev/null || true
-                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=60 install -y "${PKGS[@]}" 2>/dev/null || true
+                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 update -qq 2>/dev/null || true
+                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 install -y "${PKGS[@]}" 2>/dev/null || true
             elif has_cmd dnf; then
                 echo -e "   ${CYAN}Detected Fedora/RHEL (dnf). Installing packages...${NC}"
                 local DNF_PKGS=()
@@ -434,7 +434,7 @@ setup_showcase_ui() {
                     if has_cmd apt-get; then
                         echo -e "   ${CYAN}📦 Configuring NodeSource Node.js 22 LTS repository...${NC}"
                         curl -fsSL https://deb.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
-                        ${SUDO_PREFIX} apt-get install -y -qq nodejs || true
+                        ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 install -y -qq nodejs 2>/dev/null || true
                     elif has_cmd dnf; then
                         curl -fsSL https://rpm.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
                         ${SUDO_PREFIX} dnf install -y nodejs || true
```

**File**: `start.sh` (modified, +3/-3)
```diff
@@ -178,8 +178,8 @@ if [ ${#MISSING_CORE[@]} -gt 0 ]; then
             SUDO_PREFIX=""
             if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
             if command -v apt-get >/dev/null 2>&1; then
-                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=60 update -qq 2>/dev/null || true
-                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=60 install -y -qq "${MISSING_CORE[@]}" 2>/dev/null || true
+                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 update -qq 2>/dev/null || true
+                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 install -y -qq "${MISSING_CORE[@]}" 2>/dev/null || true
             elif command -v dnf >/dev/null 2>&1; then
                 ${SUDO_PREFIX} dnf install -y "${MISSING_CORE[@]}" || true
             elif command -v pacman >/dev/null 2>&1; then
@@ -315,7 +315,7 @@ if [ ! -f "${SHOWCASE_INDEX}" ] && [ ! -f "${SHOWCASE_INDEX_ALT1}" ] && [ ! -f "
                 if command -v apt-get >/dev/null 2>&1; then
                     echo -e "   ${CYAN}📦 Configuring NodeSource Node.js 22 LTS repository...${NC}"
                     curl -fsSL https://deb.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
-                    ${SUDO_PREFIX} apt-get install -y -qq nodejs || true
+                    ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=5 install -y -qq nodejs 2>/dev/null || true
                 elif command -v dnf >/dev/null 2>&1; then
                     curl -fsSL https://rpm.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
                     ${SUDO_PREFIX} dnf install -y nodejs || true
```

---

### Incident Patch 10: `afbc4022` (2026-09-05)
**Commit Message**: fix: add apt lock timeout and official portable scrcpy fallback across Linux and Windows

- Handle Debian/Ubuntu apt-get lock contention with DPkg::Lock::Timeout
- Decouple apt update from apt install so locks on update do not block installation
- Add official portable scrcpy v4.1 fallback download for Linux (x64/arm64) and Windows (win64)
- Add scrcpy user directories to standard PATH discovery

**File**: `scripts/install_deps.ps1` (modified, +39/-1)
```diff
@@ -46,8 +46,10 @@ function Update-EnvironmentPath {
         "${env:ProgramFiles(x86)}\nodejs",
         "$env:APPDATA\npm",
         "$env:LOCALAPPDATA\Programs\platform-tools",
+        "$env:LOCALAPPDATA\Programs\scrcpy",
         "$env:LOCALAPPDATA\Programs\node",
         "$env:USERPROFILE\.local\share\platform-tools",
+        "$env:USERPROFILE\.local\share\scrcpy",
         "$env:USERPROFILE\.local\share\node",
         "$env:LOCALAPPDATA\nvm",
         "$env:ProgramData\nvm",
@@ -107,6 +109,39 @@ function Install-PortablePlatformTools {
     return $false
 }
 
+function Install-PortableScrcpy {
+    $scrcpyDir = "$env:LOCALAPPDATA\Programs\scrcpy"
+    if (Test-Path "$scrcpyDir\scrcpy.exe") {
+        $env:PATH = "$scrcpyDir;$env:PATH"
+        return $true
+    }
+    Write-Host "   [INFO] Installing portable scrcpy in user space..." -ForegroundColor Cyan
+    try {
+        $zipPath = "$env:TEMP\scrcpy-win64.zip"
+        Invoke-WebRequest -Uri "https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-win64-v4.1.zip" -OutFile $zipPath -UseBasicParsing
+        $extractDir = "$env:TEMP\scrcpy_extract"
+        if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
+        New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
+        Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
+        $extractedFolder = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
+        if ($extractedFolder) {
+            New-Item -ItemType Directory -Path "$env:LOCALAPPDATA\Programs" -Force | Out-Null
+            if (Test-Path $scrcpyDir) { Remove-Item $scrcpyDir -Recurse -Force -ErrorAction SilentlyContinue }
+            Move-Item -Path $extractedFolder.FullName -Destination $scrcpyDir -Force
+        }
+        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
+        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
+        if (Test-Path "$scrcpyDir\scrcpy.exe") {
+            $env:PATH = "$scrcpyDir;$env:PATH"
+            Write-Host "   ✔ Portable scrcpy installed in user space." -ForegroundColor Green
+            return $true
+        }
+    } catch {
+        Write-Host "   ⚠ Failed to install portable scrcpy: $_" -ForegroundColor DarkYellow
+    }
+    return $false
+}
+
 function Test-NodeCompatible {
     if (-not (Test-CommandExists "node") -or -not (Test-CommandExists "npm")) { return $false }
     try {
@@ -219,10 +254,13 @@ if ($missingTools.Count -eq 0) {
         Update-EnvironmentPath
     }
 
-    # Zero-admin user-space fallback for adb if still missing
+    # Zero-admin user-space fallback for adb and scrcpy if still missing
     if (-not (Test-CommandExists "adb")) {
         Install-PortablePlatformTools
     }
+    if (-not (Test-CommandExists "scrcpy")) {
+        Install-PortableScrcpy
+    }
 
     # Ensure local ADB daemon is warm & listening
     Start-LocalAdbServer
```

**File**: `scripts/install_deps.sh` (modified, +35/-1)
```diff
@@ -52,6 +52,7 @@ STANDARD_PATHS=(
     "${HOME}/.local/bin"
     "${HOME}/.local/share/node/bin"
     "${HOME}/.local/share/platform-tools"
+    "${HOME}/.local/share/scrcpy"
     "${HOME}/.cargo/bin"
     "${HOME}/Library/Android/sdk/platform-tools"
     "${HOME}/Android/Sdk/platform-tools"
@@ -231,7 +232,8 @@ install_system_packages() {
 
             if has_cmd apt-get; then
                 echo -e "   ${CYAN}Detected Debian/Ubuntu (apt-get). Synchronizing and installing...${NC}"
-                ${SUDO_PREFIX} apt-get update -qq && ${SUDO_PREFIX} apt-get install -y "${PKGS[@]}" || true
+                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=60 update -qq 2>/dev/null || true
+                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=60 install -y "${PKGS[@]}" 2>/dev/null || true
             elif has_cmd dnf; then
                 echo -e "   ${CYAN}Detected Fedora/RHEL (dnf). Installing packages...${NC}"
                 local DNF_PKGS=()
@@ -249,6 +251,38 @@ install_system_packages() {
             fi
         fi
 
+        # Fallback: if scrcpy is still missing, try snap or install portable scrcpy in user space
+        if ! has_cmd scrcpy; then
+            if has_cmd snap && request_sudo "install scrcpy via snap"; then
+                local SUDO_PREFIX=""
+                if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
+                ${SUDO_PREFIX} snap install scrcpy 2>/dev/null || true
+            fi
+        fi
+        if ! has_cmd scrcpy; then
+            local SCRCPY_ARCH=""
+            case "${ARCH_TYPE}" in
+                x86_64|amd64) SCRCPY_ARCH="x86_64" ;;
+                aarch64|arm64) SCRCPY_ARCH="aarch64" ;;
+            esac
+            if [ -n "${SCRCPY_ARCH}" ]; then
+                local SCRCPY_DIR="${HOME}/.local/share/scrcpy"
+                if [ ! -x "${SCRCPY_DIR}/scrcpy" ]; then
+                    echo -e "   ${CYAN}📦 Installing portable scrcpy in user space (~/.local)...${NC}"
+                    mkdir -p "${SCRCPY_DIR}" "${HOME}/.local/bin"
+                    local SCRCPY_URL="https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-linux-${SCRCPY_ARCH}-v4.1.tar.gz"
+                    if curl -fsSL "${SCRCPY_URL}" | tar -xz -C "${SCRCPY_DIR}" --strip-components=1 2>/dev/null; then
+                        ln -sf "${SCRCPY_DIR}/scrcpy" "${HOME}/.local/bin/scrcpy"
+                        export PATH="${SCRCPY_DIR}:${PATH}"
+                        echo -e "   ${GREEN}✓ scrcpy installed in user space.${NC}"
+                    fi
+                else
+                    ln -sf "${SCRCPY_DIR}/scrcpy" "${HOME}/.local/bin/scrcpy"
+                    export PATH="${SCRCPY_DIR}:${PATH}"
+                fi
+            fi
+        fi
+
         # User-space fallback for adb if missing and no root privileges
         if ! has_cmd adb; then
             if [[ "${ARCH_TYPE}" = "x86_64" || "${ARCH_TYPE}" = "amd64" ]]; then
```

**File**: `scripts/start.ps1` (modified, +39/-1)
```diff
@@ -41,8 +41,10 @@ function Update-EnvironmentPath {
         "${env:ProgramFiles(x86)}\nodejs",
         "$env:APPDATA\npm",
         "$env:LOCALAPPDATA\Programs\platform-tools",
+        "$env:LOCALAPPDATA\Programs\scrcpy",
         "$env:LOCALAPPDATA\Programs\node",
         "$env:USERPROFILE\.local\share\platform-tools",
+        "$env:USERPROFILE\.local\share\scrcpy",
         "$env:USERPROFILE\.local\share\node",
         "$env:LOCALAPPDATA\nvm",
         "$env:ProgramData\nvm",
@@ -102,6 +104,39 @@ function Install-PortablePlatformTools {
     return $false
 }
 
+function Install-PortableScrcpy {
+    $scrcpyDir = "$env:LOCALAPPDATA\Programs\scrcpy"
+    if (Test-Path "$scrcpyDir\scrcpy.exe") {
+        $env:PATH = "$scrcpyDir;$env:PATH"
+        return $true
+    }
+    Write-Host "   [INFO] Installing portable scrcpy in user space..." -ForegroundColor Cyan
+    try {
+        $zipPath = "$env:TEMP\scrcpy-win64.zip"
+        Invoke-WebRequest -Uri "https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-win64-v4.1.zip" -OutFile $zipPath -UseBasicParsing
+        $extractDir = "$env:TEMP\scrcpy_extract"
+        if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
+        New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
+        Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
+        $extractedFolder = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
+        if ($extractedFolder) {
+            New-Item -ItemType Directory -Path "$env:LOCALAPPDATA\Programs" -Force | Out-Null
+            if (Test-Path $scrcpyDir) { Remove-Item $scrcpyDir -Recurse -Force -ErrorAction SilentlyContinue }
+            Move-Item -Path $extractedFolder.FullName -Destination $scrcpyDir -Force
+        }
+        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
+        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
+        if (Test-Path "$scrcpyDir\scrcpy.exe") {
+            $env:PATH = "$scrcpyDir;$env:PATH"
+            Write-Host "   ✔ Portable scrcpy installed in user space." -ForegroundColor Green
+            return $true
+        }
+    } catch {
+        Write-Host "   ⚠ Failed to install portable scrcpy: $_" -ForegroundColor DarkYellow
+    }
+    return $false
+}
+
 function Test-NodeCompatible {
     if (-not (Test-CommandExists "node") -or -not (Test-CommandExists "npm")) { return $false }
     try {
@@ -205,10 +240,13 @@ if ($missingCore.Count -gt 0) {
         Update-EnvironmentPath
     }
 
-    # Zero-admin user-space fallback for adb if still missing
+    # Zero-admin user-space fallback for adb and scrcpy if still missing
     if (-not (Test-CommandExists "adb")) {
         Install-PortablePlatformTools
     }
+    if (-not (Test-CommandExists "scrcpy")) {
+        Install-PortableScrcpy
+    }
 }
 
 # Ensure local ADB daemon is warm & listening so probes do not hit 'Connection refused'
```

**File**: `start.sh` (modified, +36/-1)
```diff
@@ -39,6 +39,7 @@ STANDARD_PATHS=(
     "${HOME}/.local/bin"
     "${HOME}/.local/share/node/bin"
     "${HOME}/.local/share/platform-tools"
+    "${HOME}/.local/share/scrcpy"
     "${HOME}/.cargo/bin"
     "${HOME}/Library/Android/sdk/platform-tools"
     "${HOME}/Android/Sdk/platform-tools"
@@ -177,14 +178,48 @@ if [ ${#MISSING_CORE[@]} -gt 0 ]; then
             SUDO_PREFIX=""
             if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
             if command -v apt-get >/dev/null 2>&1; then
-                ${SUDO_PREFIX} apt-get update -qq && ${SUDO_PREFIX} apt-get install -y -qq "${MISSING_CORE[@]}" || true
+                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=60 update -qq 2>/dev/null || true
+                ${SUDO_PREFIX} apt-get -o DPkg::Lock::Timeout=60 install -y -qq "${MISSING_CORE[@]}" 2>/dev/null || true
             elif command -v dnf >/dev/null 2>&1; then
                 ${SUDO_PREFIX} dnf install -y "${MISSING_CORE[@]}" || true
             elif command -v pacman >/dev/null 2>&1; then
                 ${SUDO_PREFIX} pacman -S --noconfirm "${MISSING_CORE[@]}" || true
             fi
         fi
 
+        # Fallback: if scrcpy is still missing, try snap or install portable scrcpy in user space
+        if ! command -v scrcpy >/dev/null 2>&1; then
+            if command -v snap >/dev/null 2>&1 && request_sudo "install scrcpy via snap"; then
+                local SUDO_PREFIX=""
+                if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
+                ${SUDO_PREFIX} snap install scrcpy 2>/dev/null || true
+            fi
+        fi
+        if ! command -v scrcpy >/dev/null 2>&1; then
+            ARCH="$(uname -m)"
+            SCRCPY_ARCH=""
+            case "${ARCH}" in
+                x86_64|amd64) SCRCPY_ARCH="x86_64" ;;
+                aarch64|arm64) SCRCPY_ARCH="aarch64" ;;
+            esac
+            if [ -n "${SCRCPY_ARCH}" ]; then
+                SCRCPY_DIR="${HOME}/.local/share/scrcpy"
+                if [ ! -x "${SCRCPY_DIR}/scrcpy" ]; then
+                    echo -e "   ${CYAN}📦 Installing portable scrcpy in user space (~/.local)...${NC}"
+                    mkdir -p "${SCRCPY_DIR}" "${HOME}/.local/bin"
+                    SCRCPY_URL="https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-linux-${SCRCPY_ARCH}-v4.1.tar.gz"
+                    if curl -fsSL "${SCRCPY_URL}" | tar -xz -C "${SCRCPY_DIR}" --strip-components=1 2>/dev/null; then
+                        ln -sf "${SCRCPY_DIR}/scrcpy" "${HOME}/.local/bin/scrcpy"
+                        export PATH="${SCRCPY_DIR}:${PATH}"
+                        echo -e "   ${GREEN}✓ scrcpy installed in user space.${NC}"
+                    fi
+                else
+                    ln -sf "${SCRCPY_DIR}/scrcpy" "${HOME}/.local/bin/scrcpy"
+                    export PATH="${SCRCPY_DIR}:${PATH}"
+                fi
+            fi
+        fi
+
         # Fallback: if adb is missing on Linux without root/sudo, install platform-tools in user space
         if ! command -v adb >/dev/null 2>&1; then
             ARCH="$(uname -m)"
```

#### Recent Merged Pull Requests:
- **PR #162** (2026-09-29): Third party cleanup (@somew1nd)
- **PR #140** (closed): fix(mcp): stop splicing notification text into AppleScript/PowerShell source (@carfeii)
- **PR #133** (closed): test(config): cover utils.* node reconciliation as match (CHE-656) (@congvc-dev)
- **PR #96** (closed): Honor the configured LLM provider instead of hardcoding Google (@jovinus302)
- **PR #93** (closed): test(mcp): stop MCP dispatch tests from leaking real spawn watchdogs (@basil-k-aji-dev)
- **PR #92** (closed): fix(video): pin the output frame rate on rendered analyzer clips (@basil-k-aji-dev)
- **PR #91** (closed): test(flash): build the turn-index runner without provider credentials (@basil-k-aji-dev)
- **PR #90** (closed): fix(llm): type-check provider and model in _resolve_endpoint (@basil-k-aji-dev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
