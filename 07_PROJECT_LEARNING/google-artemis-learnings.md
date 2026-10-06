# Forensic Learning Record (Deep Inspection): google/artemis

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-artemis-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/artemis](https://github.com/google/artemis))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:14:14.784Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/artemis`
- **Description**: ARTEMIS turns natural-language instructions into reliable Android automation. It automates end-to-end workflows, captures logs, and integrates seamlessly with AI coding assistants such as Antigravity, Codex, and Claude Code.  It also achieves 99%+ success rate on AndroidWorld Benchmark.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 11019 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
        events = self.startup_progress.setdefault(key, [])
        replacement_index = next(
            (index for index, item in enumerate(events) if item.get("stage") == stage),
            None,
        )
        snapshot = dict(data)
        if replacement_index is None:
            events.append(snapshot)
        else:
            events[replacement_index] = snapshot
        self.startup_progress[key] = events[-16:]

    def get_startup_progress(self, session_id: str) -> list[dict[str, Any]]:
        return [dict(item) for item in self.startup_progress.get(str(session_id), [])]

    def clear_queue(self):
        """Clears all pending items from the task queue."""
        self.queue_items = [t for t in self.queue_items if t.get("status") == "running"]
        if self._wake_event:
            self._wake_event.set()


# Global shared instance
state = ServerState()

import sys

if __name__ == "admin_console.core.state":
    sys.modules["apps.admin_console.core.state"] = sys.modules[__name__]
elif __name__ == "apps.admin_console.core.state":
    sys.modules["admin_console.core.state"] = sys.modules[__name__]

```

### Core Architecture Module: `apps/admin_console/services/task_queue_service.py`
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
from datetime import datetime
import logging
import os
from pathlib import Path
import shutil
import sys
import threading
import time
from typing import Any
import uuid

try:
    from admin_console.core.state import state
    from admin_console.database.repositories.session_repository import session_repo
    from admin_console.services import worker_process_io
    from admin_console.services.media_service import media_service
except ImportError:
    from apps.admin_console.core.state import state
    from apps.admin_console.database.repositories.session_repository import session_repo
    from apps.admin_console.services import worker_process_io
    from apps.admin_console.services.media_service import media_service

from artemis.config import (
    PAUSE_FILE,
    TEST_DATA_DIR,
    TEST_OUTPUTS_DIR,
    WORKSPACE_ROOT,
)
from artemis.runtime import (
    AdbEndpoint,
    AdbTarget,
    DeviceExecutionLock,
    clear_cancel_request,
    current_adb_endpoint,
    pid_is_alive,
    process_supervisor,
    request_cancel,
    trace_store,
)

logger = logging.getLogger(__name__)


class TaskQueueService:
    """Service managing FIFO task execution, background worker, subprocess lifecycle,
    and startup tasks.
    """

    # Strong references to in-flight _execute_task_item tasks (asyncio itself only
    # keeps weak references to running tasks).
    _run_tasks: set[asyncio.Task] = set()
    # Deadline enforcers for graceful stops (see _stop_worker_gracefully).
    _forced_stop_tasks: set[asyncio.Task] = set()

    DEFAULT_CANCEL_GRACE_SECONDS = 45.0

    @classmethod
    def _cancel_grace_seconds(cls) -> float:
        """How long a worker may finalize itself before it is killed.

        ``ARTEMIS_CANCEL_GRACE_SECONDS=0`` restores the legacy immediate kill.
        """
        raw = os.getenv("ARTEMIS_CANCEL_GRACE_SECONDS")
        if raw is None or not raw.strip():
            return cls.DEFAULT_CANCEL_GRACE_SECONDS
        try:
            return max(0.0, float(raw))
        except ValueError:
            return cls.DEFAULT_CANCEL_GRACE_SECONDS

    @staticmethod
    def _hard_kill(pid: int, process_created_at: float = 0.0) -> bool:
        if not pid:
            return False
        if process_created_at and process_created_at > 0:
            return process_supervisor.terminate_tree_verified(pid, process_created_at)
        try:
            return process_supervisor.terminate_tree(pid)
        except Exception:
            return False

    @classmethod
    def _stop_worker_gracefully(
        cls,
        pid: Any,
        process_created_at: float = 0.0,
        session_id: str | None = None,
        reason: str = "Task stopped from the Artemis frontend.",
    ) -> tuple[bool, bool]:
        """Ask a worker to cancel itself; hard-kill it once the grace period lapses.

        Workers are isolated from the daemon's console (and may belong to
        another ingress process), so instead of a signal the daemon drops a
        cancel marker the worker polls for. Honouring it runs the worker's
        normal cancellation path: the screen recording is stopped and remuxed,
        the trace folder is compiled, and the device lease is released. A
        worker that never picks the marker up is killed after the grace period.

        Returns ``(stopped, deferred)``: ``stopped`` mirrors the legacy kill
        result, ``deferred`` is True when the kill was handed to the deadline
        enforcer instead of happening now.
        """
        try:
            pid_int = int(pid) if pid else 0
        except (TypeError, ValueError):
            pid_int = 0
        grace = cls._cancel_grace_seconds()
        if not pid_int or grace <= 0:
            return cls._hard_kill(pid_int, process_created_at), False

        created_at = float(process_created_at or 0.0)
        if created_at <= 0:
            # PID markers carry the creation time so a leftover marker can never
            # cancel a future process that reuses this PID.
            try:
                import psutil

                created_at = float(psutil.Process(pid_int).create_time())
            except Exception:
                created_at = 0.0
        if not pid_is_alive(pid_int, created_at or None):
            return True, False

        written = request_cancel(
            session_id=str(session_id) if session_id else None,
            pid=pid_int,
            process_created_at=created_at,
            reason=reason,
        )
        if not written:
            return cls._hard_kill(pid_int, created_at), False

        print(
            f"[stop_tasks] Cancel requested for worker {pid_int}"
            f" (session {session_id or 'n/a'}); forcing termination after {grace:.0f}s"
        )
        cls._schedule_forced_stop(pid_int, created_at, grace, session_id)
        return True, True

    @classmethod
    def _stop_proc_gracefully(cls, proc: Any, session_id: Any) -> bool:
        """Graceful variant for a locally spawned process; True when deferred."""
        pid = getattr(proc, "pid", None)
        if not pid or cls._cancel_grace_seconds() <= 0:
            return False
        try:
            _stopped, deferred = cls._stop_worker_gracefully(
                pid, session_id=str(session_id) if session_id else None
            )
        except Exception:
            return False
        return deferred

    @classmethod
    def _schedule_forced_stop(
        cls, pid: int, process_created_at: float, grace: float, session_id: Any
    ) -> None:
        """Kill ``pid`` if it is still alive once ``grace`` seconds have passed."""

        def _still_alive() -> bool:
            return pid_is_alive(pid, process_created_at or None)

        def _force() -> None:
            print(
                f"[stop_tasks] Worker {pid} (session {session_id or 'n/a'}) did not exit"
                f" within {grace:.0f}s of the cancel request; forcing termination."
            )
            cls._hard_kill(pid, process_created_at)

        async def _enforce_async() -> None:
            deadline = time.monotonic() + grace
            while time.monotonic() < deadline:
                if not _still_alive():
                    break
                await asyncio.sleep(0.5)
            else:
                _force()
            clear_cancel_request(session_id=str(session_id) if session_id else None, pid=pid)

        def _enforce_sync() -> None:
            deadline = time.monotonic() + grace
            while time.monotonic() < deadline:
                if not _still_alive():
                    break
                time.sleep(0.5)
            else:
                _force()
            clear_cancel_request(session_id=str(session_id) if session_id else None, pid=pid)

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop is not None:
            task = loop.create_task(_enforce_async())
            cls._forced_stop_tasks.add(task)
            task.add_done_callback(cls._forced_stop_tasks.discard)
            return
        threading.Thread(
            target=_enforce_sync, name=f"artemis-forced-stop-{pid}", daemon=True
        ).start()

    @staticmethod
    def _task_target(task_item: dict[str, Any]) -> AdbTarget:
        endpoint_data = task_item.get("adb_endpoint")
        endpoint = (
            AdbEndpoint.from_mapping(endpoint_data)
            if isinstance(endpoint_data, dict)
            else current_adb_endpoint()
        )
        serial = task_item.get("device_serial")
        return AdbTarget(endpoint=endpoint, serial=str(serial) if serial else None)

    @classmethod
    def _broadcast_event(cls, event_type: str, data: Any):
        """Broadcasts an event safely to all registered subscribers."""
        for cb in list(state.ipc_subscribers):
            try:
                cb(event_type, data)
            except Exception:
                # One broken subscriber must not block the others, but a
                # silent drop hides it entirely.
                logger.warning(
                    "Event subscriber %r failed for event %s",
                    cb,
                    event_type,
                    exc_info=True,
                )

    @classmethod
    def _broadcast_startup_progress(cls, session_id: str | None, stage: str, message: str) -> None:
        if not session_id:
            return
        data = {
            "session_id": str(session_id),
            "stage": stage,
            "message": message,
            "timestamp": time.time(),
        }
        state.record_startup_progress(data)
        cls._broadcast_event("startup_progress", data)

    @classmethod
    def _get_next_pending_task(cls) -> dict[str, Any] | None:
        """Finds and returns the first pending task from queue_items."""
        for item in state.queue_items:
            if isinstance(item, dict) and item.get("status") == "pending":
                return item
        return None

    @classmethod
    def _remove_task(cls, session_id: str | None):
        """Removes a task from queue_items by session_id."""
        if not session_id:
            return
        removed_items = [
            t
            for t in state.queue_items
            if isinstance(t, dict) and t.get("session_id") == session_id
        ]
        for item in removed_items:
            DeviceExecutionLock.cancel_reservation(item.get(
```

### Core Architecture Module: `apps/admin_console/services/worker_process_io.py`
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

"""Low-level worker subprocess I/O plumbing for the task queue.

These helpers are deliberately free of admin-console state: they deal only
with spawning options, output forwarding, and process-exit observation for a
single worker subprocess. TaskQueueService exposes them as its private
static methods so existing callers and tests keep working unchanged.
"""

import asyncio
import codecs
import os
import psutil
import subprocess
import sys
from typing import Any


def subprocess_creation_kwargs() -> dict[str, Any]:
    """Isolate task workers from the UI server's Windows console.

    A new process group alone is insufficient on Windows: the worker still
    shares the parent's console, so a CTRL_C_EVENT generated anywhere in
    that console can reach the UI server. CREATE_NO_WINDOW removes that
    shared console boundary.

    Output is captured on every platform so it can be forwarded to the
    server terminal and teed into the trace's stdout.log (the daemon itself
    is often spawned with its stdio discarded, so inheriting would lose the
    worker's logs entirely).
    """
    kwargs: dict[str, Any] = {
        "stdout": asyncio.subprocess.PIPE,
        "stderr": asyncio.subprocess.STDOUT,
    }
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    return kwargs


async def forward_worker_output(
    stream: asyncio.StreamReader | None, log_path: str | None = None
) -> None:
    """Forward a worker's combined output without corrupting UTF-8.

    When ``log_path`` is given, the output is also teed into that file so
    the trace's advertised stdout.log actually exists for diagnostics.
    """
    if stream is None:
        return

    log_file = None
    if log_path:
        try:
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
            log_file = open(log_path, "w", buffering=1, encoding="utf-8", errors="replace")
        except Exception as exc:
            print(f"[QueueWorker] Could not open worker log file '{log_path}': {exc}")

    def _emit(text: str) -> None:
        sys.stdout.write(text)
        sys.stdout.flush()
        if log_file is not None:
            try:
                log_file.write(text)
            except (OSError, ValueError):
                # Best-effort tee into stdout.log; console output above
                # already carried the text.
                pass

    try:
        decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        while True:
            chunk = await stream.read(4096)
            if not chunk:
                break
            text = decoder.decode(chunk)
            if text:
                _emit(text)

        tail = decoder.decode(b"", final=True)
        if tail:
            _emit(tail)
    finally:
        if log_file is not None:
            try:
                log_file.close()
            except OSError:
                # Flush-on-close of the best-effort tee failed; nothing to do.
                pass


async def finish_output_forwarder(output_task: asyncio.Task[None] | None) -> None:
    """Drain final worker output without allowing inherited handles to stall the queue."""
    if output_task is None:
        return
    try:
        await asyncio.wait_for(asyncio.shield(output_task), timeout=2.0)
    except asyncio.CancelledError:
        if output_task.cancelled():
            return
        raise
    except TimeoutError:
        output_task.cancel()
        try:
            await output_task
        except asyncio.CancelledError:
            pass
    except Exception as exc:
        print(f"[QueueWorker] Failed to forward detached worker output: {exc}")


async def wait_for_worker_process(proc: asyncio.subprocess.Process) -> int:
    """Wait for worker process to exit, with watchdog fallback if PID was reaped externally."""
    while True:
        try:
            return await asyncio.wait_for(proc.wait(), timeout=1.0)
        except TimeoutError:
            pid = getattr(proc, "pid", None)
            if pid:
                try:
                    p = psutil.Process(pid)
                    if not p.is_running() or p.status() == psutil.STATUS_ZOMBIE:
                        return proc.returncode if proc.returncode is not None else -15
                except (psutil.NoSuchProcess, ProcessLookupError):
                    return proc.returncode if proc.returncode is not None else -15
                except psutil.Error:
                    # Transient probe failure (e.g. AccessDenied): keep waiting.
                    pass
            else:
                return proc.returncode if proc.returncode is not None else -15

```

### Core Architecture Module: `apps/showcase_ui/src/app/core/data/smart-tasks.data.ts`
```
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface AppReference {
  name: string;
  icon: string;
  pkg?: string;
  category?: string;
}

export type SuggestionCategory =
  | 'all'
  | 'flash'
  | 'pro'
  | 'cross_app'
  | 'monitor';

export interface SmartSuggestion {
  id: string;
  title: string;
  description: string;
  goal: string;
  profile: 'flash' | 'pro';
  category: 'flash' | 'pro' | 'cross_app' | 'monitor';
  tag: string;
  apps: AppReference[];
  requiredPackages?: string[];
  matchMode?: 'any' | 'all';
  priority?: number;
}

/**
 * Recognized Android App Package Registry
 */
export const APP_REGISTRY: Record<string, AppReference> = {
  // Google Suite & System
  'com.google.android.apps.maps': { name: 'Maps', icon: 'explore', pkg: 'com.google.android.apps.maps', category: 'navigation' },
  'com.google.android.gm': { name: 'Gmail', icon: 'mail', pkg: 'com.google.android.gm', category: 'productivity' },
  'com.android.chrome': { name: 'Chrome', icon: 'public', pkg: 'com.android.chrome', category: 'browser' },
  'com.google.android.youtube': { name: 'YouTube', icon: 'smart_display', pkg: 'com.google.android.youtube', category: 'entertainment' },
  'com.android.settings': { name: 'Settings', icon: 'settings', pkg: 'com.android.settings', category: 'system' },
  'com.google.android.deskclock': { name: 'Clock', icon: 'timer', pkg: 'com.google.android.deskclock', category: 'utility' },
  'com.android.deskclock': { name: 'Clock', icon: 'timer', pkg: 'com.android.deskclock', category: 'utility' },
  'com.google.android.calculator': { name: 'Calculator', icon: 'calculate', pkg: 'com.google.android.calculator', category: 'utility' },
  'com.android.calculator2': { name: 'Calculator', icon: 'calculate', pkg: 'com.android.calculator2', category: 'utility' },
  'com.google.android.apps.photos': { name: 'Photos', icon: 'photo_library', pkg: 'com.google.android.apps.photos', category: 'media' },
  'com.google.android.calendar': { name: 'Calendar', icon: 'calendar_month', pkg: 'com.google.android.calendar', category: 'productivity' },
  'com.google.android.keep': { name: 'Keep Notes', icon: 'note_alt', pkg: 'com.google.android.keep', category: 'productivity' },
  'com.android.vending': { name: 'Play Store', icon: 'storefront', pkg: 'com.android.vending', category: 'tools' },
  'com.google.android.apps.messaging': { name: 'Messages', icon: 'chat', pkg: 'com.google.android.apps.messaging', category: 'communication' },

  // Popular Ecosystem Apps
  'com.tencent.mm': { name: 'WeChat', icon: 'forum', pkg: 'com.tencent.mm', category: 'social' },
  'com.xingin.xhs': { name: 'Xiaohongshu', icon: 'auto_stories', pkg: 'com.xingin.xhs', category: 'social' },
  'com.sankuai.meituan': { name: 'Meituan', icon: 'restaurant', pkg: 'com.sankuai.meituan', category: 'lifestyle' },
  'com.dianping.v1': { name: 'Dianping', icon: 'star', pkg: 'com.dianping.v1', category: 'lifestyle' },
  'tv.danmaku.bili': { name: 'Bilibili', icon: 'video_library', pkg: 'tv.danmaku.bili', category: 'entertainment' },
  'com.eg.android.AlipayGphone': { name: 'Alipay', icon: 'account_balance_wallet', pkg: 'com.eg.android.AlipayGphone', category: 'finance' },
  'com.netease.cloudmusic': { name: 'NetEase Music', icon: 'headphones', pkg: 'com.netease.cloudmusic', category: 'entertainment' },
  'com.spotify.music': { name: 'Spotify', icon: 'music_note', pkg: 'com.spotify.music', category: 'entertainment' }
};

/**
 * Curated, clean task preset library (1~2 representative tasks per common app)
 */
export const SMART_TASK_LIBRARY: SmartSuggestion[] = [
  // 1. Google Maps
  {
    id: 'maps_coffee',
    title: 'Find Specialty Coffee',
    description: 'Search nearby top-rated cafes in Google Maps',
    goal: 'Open Google Maps, search for top-rated specialty coffee shops nearby, and view the top result details.',
    profile: 'flash',
    category: 'flash',
    tag: 'Maps',
    apps: [{ name: 'Maps', icon: 'explore', pkg: 'com.google.android.apps.maps' }],
    requiredPackages: ['com.google.android.apps.maps'],
    priority: 95
  },
  {
    id: 'pro_commute_share',
    title: 'Commute ETA & Message Draft',
    description: 'Check transit time on Maps and draft arrival ETA in Messages',
    goal: 'Open Google Maps to check commute time to the International Airport, calculate arrival time, then open Messages and draft an ETA text message.',
    profile: 'pro',
    category: 'cross_app',
    tag: 'Maps + Messages',
    apps: [
      { name: 'Maps', icon: 'explore', pkg: 'com.google.android.apps.maps' },
      { name: 'Messages', icon: 'chat', pkg: 'com.google.android.apps.messaging' }
    ],
    requiredPackages: ['com.google.android.apps.maps', 'com.google.android.apps.messaging'],
    matchMode: 'all',
    priority: 92
  },

  // 2. Gmail
  {
    id: 'gmail_receipts',
    title: 'Search Order Receipts',
    description: 'Find recent flight or delivery confirmation emails in Gmail',
    goal: 'Open Gmail and search for recent flight or package delivery confirmation emails.',
    profile: 'flash',
    category: 'flash',
    tag: 'Gmail',
    apps: [{ name: 'Gmail', icon: 'mail', pkg: 'com.google.android.gm' }],
    requiredPackages: ['com.google.android.gm'],
    priority: 90
  },
  {
    id: 'pro_email_to_calendar',
    title: 'Email Itinerary to Calendar',
    description: 'Extract flight or event dates from Gmail and schedule in Calendar',
    goal: 'Open Gmail to find the latest event invitation or itinerary, extract dates and location, then open Google Calendar and create a corresponding calendar event.',
    profile: 'pro',
    category: 'cross_app',
    tag: 'Gmail + Calendar',
    apps: [
      { name: 'Gmail', icon: 'mail', pkg: 'com.google.android.gm' },
      { name: 'Calendar', icon: 'calendar_month', pkg: 'com.google.android.calendar' }
    ],
    requiredPackages: ['com.google.android.gm'],
    priority: 94
  },

  // 3. Chrome
  {
    id: 'chrome_research',
    title: 'Search AI News Breakthroughs',
    description: 'Search latest multimodal AI developments in Chrome browser',
    goal: 'Open Chrome browser and search for latest breakthroughs in multimodal mobile AI agents.',
    profile: 'flash',
    category: 'flash',
    tag: 'Chrome',
    apps: [{ name: 'Chrome', icon: 'public', pkg: 'com.android.chrome' }],
    requiredPackages: ['com.android.chrome'],
    priority: 88
  },
  {
    id: 'pro_research_keep',
    title: 'Product Research & Notes Note',
    description: 'Compare top 3 headphones on Chrome and record comparison in Keep',
    goal: 'Open Chrome, research top 3 noise-cancelling headphones comparing price and battery life, then write a structured comparison summary note in Keep Notes.',
    profile: 'pro',
    category: 'pro',
    tag: 'Chrome + Keep',
    apps: [
      { name: 'Chrome', icon: 'public', pkg: 'com.android.chrome' },
      { name: 'Keep Notes', icon: 'note_alt', pkg: 'com.google.android.keep' }
    ],
    requiredPackages: ['com.android.chrome'],
    priority: 91
  },

  // 4. YouTube
  {
    id: 'youtube_lofi',
    title: 'Play Lo-Fi Music Radio',
    description: 'Search and play a Lo-Fi hip hop live stream on YouTube',
    goal: 'Open YouTube, search for "Lofi hip hop beats relaxing radio" and tap on the live stream.',
    profile: 'flash',
    category: 'flash',
    tag: 'YouTube',
    apps: [{ name: 'YouTube', icon: 'smart_display', pkg: 'com.google.android.youtube' }],
    requiredPackages: ['com.google.android.youtube'],
    priority: 85
  },

  // 5. Settings
  {
    id: 'settings_display_wifi',
    title: 'Dark Mode & Wi-Fi Check',
    description: 'Toggle dark theme and verify network connection in Settings',
    goal: 'Open Settings app, navigate to Display settings, ensure Dark theme is enabled, and check Wi-Fi connection status.',
    profile: 'flash',
    category: 'flash',
    tag: 'Settings',
    apps: [{ name: 'Settings', icon: 'settings', pkg: 'com.android.settings' }],
    requiredPackages: ['com.android.settings'],
    priority: 87
  },
  {
    id: 'pro_settings_qa',
    title: 'Subsystem Health & Crash Probe',
    description: 'Traverse Settings submenus to verify screens and check for crash dialogs',
    goal: 'Explore Settings submenus (Network, Connected devices, Apps, Battery, Storage), verify each screen loads properly without ANR or crash dialogs, and summarize results.',
    profile: 'pro',
    category: 'monitor',
    tag: 'Settings QA',
    apps: [{ name: 'Settings', icon: 'settings', pkg: 'com.android.settings' }],
    requiredPackages: ['com.android.settings'],
    priority: 93
  },

  // 6. Clock
  {
    id: 'clock_timer',
    title: '25-Min Pomodoro Timer',
    description: 'Start a 25-minute focus countdown timer in Clock app',
    goal: 'Open Clock app, switch to Timer tab, set 25 minutes and start the countdown timer.',
    profile: 'flash',
    category: 'flash',
    tag: 'Clock',
    apps: [{ name: 'Clock', icon: 'timer', pkg: 'com.google.android.deskclock' }],
    requiredPackages: ['com.google.android.deskclock', 'com.android.deskclock'],
    priority: 86
  },

  // 7. Calculator
  {
    id: 'calc_gratuity',
    title: 'Split Bill & Calculate Tip',
    description: 'Calculate 18% gratuity on $186.40 for 3 people in Calculator',
    goal: 'Open Calculator and calculate 18% tip on a bill of $186.40, then divide by 3 people.',
    profile: 'flash',
    category: 'flash',
    tag: 'Calculator',
    apps: [{ name: 'Calculator', ico
```

### Core Architecture Module: `apps/showcase_ui/src/app/core/models/markdown.model.ts`
```
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface MarkdownSegment {
  text: string;
  bold: boolean;
  code?: boolean;
}

export interface MarkdownLine {
  type: 'h1' | 'h2' | 'h3' | 'checked' | 'progress' | 'unchecked' | 'list-item' | 'verify' | 'assert' | 'finding' | 'text' | 'empty';
  segments: MarkdownSegment[];
  indent: number;
  checkKind?: 'verify' | 'assert' | 'finding';
  atEnd?: boolean;
}

export interface NoteMilestone {
  index: number;
  type: 'checked' | 'progress' | 'unchecked';
  segments: MarkdownSegment[];
  subSteps: MarkdownLine[];
  checks: MarkdownLine[];
}

export interface ParsedNote {
  title: string | null;
  milestones: NoteMilestone[];
  otherLines: MarkdownLine[];
}

```

### Core Architecture Module: `apps/showcase_ui/src/app/core/models/pro-tuning.model.ts`
```
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Launcher options for `/api/run` (`verification_level`, `explorer_mode`).
 * Keep ids in sync with `VERIFICATION_LEVEL_PRESETS` in `artemis/config/agent.py`
 * and `EXPLORER_TIERS` in `artemis/agents/explorer/tiers.py`.
 */

export type VerificationLevelId = 'off' | 'final' | 'checkpoints' | 'strict';
export type ExplorerModeId = 'flash' | 'pro' | 'ultra';

/** One notch on a tuning slider. */
export interface TuningLevel<TId extends string = string> {
  /** Wire value sent to the backend. */
  id: TId;
  /** Short name shown next to the slider title and as the hover card heading. */
  label: string;
  /** One-sentence summary shown in the hover card. */
  tagline: string;
  /** Plain-language time cost, e.g. "no extra time". */
  latency: string;
  /** Checks or searches performed at this level. */
  runs: string[];
  /** Checks or searches omitted at this level. */
  skips?: string[];
  /** When to pick this level. */
  bestFor: string;
}

export const VERIFICATION_LEVELS: readonly TuningLevel<VerificationLevelId>[] = [
  {
    id: 'off',
    label: 'Off',
    tagline: 'No checking. The run ends as soon as the task looks done.',
    latency: 'no extra time',
    runs: [
      'Each step is treated as finished the moment it is carried out.',
      'You get the full action trace, but no pass / fail verdict.'
    ],
    skips: ['Nothing is double-checked and nothing is retried.'],
    bestFor: 'Quick tries and demos, when you only want to watch what happens.'
  },
  {
    id: 'final',
    label: 'At the end',
    tagline: 'One check of the finished result against your goal. This is the default.',
    latency: 'adds about 20–60 s at the end',
    runs: [
      'When the task finishes, the final screen, the step history and the device state are compared with what you asked for.',
      'If the result does not match, the task goes back and tries to fix it, up to 3 times.'
    ],
    skips: ['Nothing is checked while the task is still running.'],
    bestFor: 'Everyday tasks: an honest pass / fail without slowing the run down.'
  },
  {
    id: 'checkpoints',
    label: 'Every step',
    tagline: 'Each step is checked as soon as it is done, plus the final check.',
    latency: 'a short check after each step, done in the background',
    runs: [
      'Every step is checked right after it completes, using the screenshots from that moment.',
      'If a step went wrong, it gets fixed before moving on (up to 2 tries per step).',
      'A failed test condition is written down and the task keeps going.',
      'The final check still runs at the end.'
    ],
    bestFor: 'Long tasks where one early mistake would spoil everything after it.'
  },
  {
    id: 'strict',
    label: 'Strict',
    tagline: 'Every step is checked, with more retries. The first failed test stops the run.',
    latency: 'slowest: more checks and more retries',
    runs: [
      'Each check takes longer and gets more attempts: 4 fixes per step and 5 at the end.',
      'The first failed test condition stops the run immediately, with the evidence attached.'
    ],
    bestFor: 'Release checks and regression runs, where a wrong pass is never acceptable.'
  }
];

export const EXPLORER_MODES: readonly TuningLevel<ExplorerModeId>[] = [
  {
    id: 'flash',
    label: 'Quick glance',
    tagline: 'Finds buttons and text on the screen in a single look.',
    latency: '1 look per search',
    runs: [
      'Something on screen is asked for by name, icon or colour and its position comes back straight away.',
      'Several things can be looked up at once.'
    ],
    skips: ['No zooming in and no second try.'],
    bestFor: 'Ordinary apps with clearly labelled buttons, icons and text.'
  },
  {
    id: 'pro',
    label: 'Second look',
    tagline: 'Takes up to 3 looks, thinking in between, before answering.',
    latency: 'up to 3 looks per search',
    runs: [
      'The screen layout is read first, then the picture is searched.',
      'If the first try misses, a different approach is tried within the 3 looks.'
    ],
    skips: ['Still no zooming into small areas, to keep searches short.'],
    bestFor: 'Things described by where they are ("the switch next to Wi-Fi") or with unclear labels.'
  },
  {
    id: 'ultra',
    label: 'Close-up',
    tagline: 'Zooms into parts of the screen and takes up to 8 looks.',
    latency: 'up to 8 looks per search (slowest)',
    runs: [
      'Parts of the screen can be cropped and magnified to read tiny text and crowded layouts piece by piece.',
      'Later looks reuse the earlier ones, so they cost less time than they sound.'
    ],
    bestFor: 'Crowded screens, tiny targets, charts and drawings, and checks where exact placement matters.'
  }
];

/** Per-run tuning sent with `/api/run` for the Pro profile. */
export interface ProTuningOptions {
  verificationLevel?: VerificationLevelId | string;
  explorerMode?: ExplorerModeId | string;
}

/** Effective defaults reported by `GET /api/run/defaults`. */
export interface ProTuningDefaults {
  verification_level?: string | null;
  explorer_mode?: string | null;
}

export const DEFAULT_VERIFICATION_LEVEL: VerificationLevelId = 'final';
export const DEFAULT_EXPLORER_MODE: ExplorerModeId = 'flash';

/** Index of a level id within its ladder; falls back to the default when unknown. */
export function levelIndex<TId extends string>(
  ladder: readonly TuningLevel<TId>[],
  id: string | null | undefined,
  fallback: TId
): number {
  const wanted = String(id ?? '').trim().toLowerCase();
  const idx = ladder.findIndex((l) => l.id === wanted);
  if (idx >= 0) return idx;
  return Math.max(0, ladder.findIndex((l) => l.id === fallback));
}

/** Slider fill percentage for a notch index on a ladder of `count` notches. */
export function notchPercent(index: number, count: number): number {
  if (count <= 1) return 0;
  const clamped = Math.min(Math.max(index, 0), count - 1);
  return (clamped / (count - 1)) * 100;
}

```

### Core Architecture Module: `apps/showcase_ui/src/app/core/models/session.model.ts`
```
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface ModelInfo {
  name: string;
  id: string;
  provider: string;
  architecture?: string;
}

export interface TaskQueueItem {
  session_id: string;
  goal: string;
  profile?: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  created_at?: number;
  start_time?: number;
  device_serial?: string | null;
  device_id?: string | null;
}

export interface Session {
  session_id: string;
  initial_goal: string;
  start_time: number;
  end_time?: number;
  status?: string;
  video_url?: string;
  recording_status?: 'recording' | 'finalizing' | 'processing' | 'ready' | 'failed' | 'unavailable';
  model_info?: ModelInfo;
  device_serial?: string | null;
  device_id?: string | null;
  device_info?: any;
}

export interface AgentStatusResponse {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'offline';
  session_id?: string | null;
  goal?: string | null;
  pid?: number | null;
  queue?: (TaskQueueItem | string)[];
  background_tasks?: any[];
  model_info?: ModelInfo | null;
  paused_error?: string | null;
}

/** Per-run Pro tuning persisted with the session (`device_info.run_tuning`). */
export interface SessionRunTuning {
  verification_level?: string | null;
  explorer_mode?: string | null;
}

/** `GET /api/sessions/{id}/usage`: session-wide LLM usage and the live executor context. */
export interface SessionUsage {
  session_id: string;
  llm_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens: number;
  /** Prompt size of the latest Operator / Flash runner call; null before the first call. */
  operator_context_tokens: number | null;
  operator_context_window_tokens: number;
  operator_context_updated_at?: number | null;
  profile?: string | null;
  run_tuning?: SessionRunTuning | null;
}

export type AgentStatus = 'idle' | 'running' | 'completed' | 'offline' | string;

export type TaskStatus = 'running' | 'paused' | 'completed' | 'pending' | 'failed' | 'cancelled';


```

### Core Architecture Module: `apps/showcase_ui/src/app/core/models/stream.model.ts`
```
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface ActionParam {
  key: string;
  value: string;
}

export interface ActionExecution {
  id?: string;
  trace_id?: string;
  agent?: string;
  agent_name?: string;
  action: string;
  name?: string;
  args?: Record<string, any>;
  params?: Record<string, any>;
  payload?: any;
  pre_image_name?: string | null;
  post_image_name?: string | null;
  status?: 'success' | 'failed' | 'error' | 'running' | string;
  duration?: number;
  duration_ms?: number;
  error?: string | null;
  timestamp?: number;
}

export interface StepEvent {
  type: 'thinking' | 'text' | 'action' | 'tool';
  data: any;
  timestamp?: number;
}

export interface LLMStreamEventData {
  execution_id: string;
  step_id?: string;
  session_id?: string;
  text?: string;
  chunk?: string;
  stream_type?: 'thinking' | 'text' | string;
  isCompleted?: boolean;
  isReset?: boolean;
  resetMessage?: string;
}

export const DEFAULT_STREAM_RESET_MESSAGE =
  'A request error occurred during output generation, typically caused by lower API priority. Retrying automatically...';

export interface StreamResetNotice {
  id: string;
  message: string;
  isWaiting: boolean;
  streamType: string;
}

export interface LLMStreamResetEventData {
  stream_exec_id?: string;
  stream_execution_id?: string;
  step_id?: string;
  session_id?: string;
  action?: 'discard' | string;
  reason?: string;
  category?: string;
  error?: string;
  message?: string;
  retry_attempt?: number;
  timestamp?: number;
}

export interface StepItemData {
  step_id: string;
  step_type?: string;
  step_number: number;
  session_id: string;
  timestamp: number;
  operator_native_thinking?: string;
  operator_raw_thinking?: string;
  action_taken?: any;
  generic_tools?: any[];
  last_execution_result?: any;
  pre_image_name?: string;
  post_image_name?: string;
  extra_metadata?: any;
  token_usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  total_tokens?: number;
  duration?: number;
}

export interface StepBlock {
  id: string;
  type: 'llm_stream' | 'step' | 'checker';
  timestamp: string;
  data: any;
}

export interface PhaseBlock {
  id: string;
  durationSeconds: number;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  blocks: StepBlock[];
}

/** One check item's verdict as booked by the Checker (ledger record shape). */
export interface CheckerVerdict {
  item_text: string;
  kind: 'verify' | 'assert' | string;
  status: 'passed' | 'failed' | 'inconclusive' | 'superseded' | 'unchecked' | string;
  evidence: string;
  suggestion?: string;
}

export interface CheckerCheckItem {
  kind: string;
  text: string;
  when?: string;
}

/**
 * One streamed LLM turn of a multi-turn agent (the Checker's tool loop):
 * the text of one execution id with the time its first chunk arrived, so the
 * timeline can interleave it with the tool calls that followed. Live sessions
 * build these from `llm_stream` chunks; historical sessions rebuild them from
 * the persisted transcript (`PersistedCheckerStream`).
 */
export interface StreamSegment {
  execution_id: string;
  stream_type: 'thinking' | 'text';
  text: string;
  timestamp: string;
  isCompleted?: boolean;
  isReset?: boolean;
  resetMessage?: string;
}

/** One persisted segment of a Checker attempt's streamed reasoning (backend `check_streams.jsonl`). */
export interface PersistedStreamSegment {
  execution_id: string;
  /** `thought` is the model's reasoning stream, `answer` its visible text. */
  role: 'thought' | 'answer' | string;
  /** Unix seconds of the segment's first chunk. */
  when: number;
  text: string;
}

/**
 * One Checker attempt's persisted transcript as served by
 * `GET /api/sessions/{id}/checks` (`streams[]`). Text is bounded server-side;
 * `truncated` says the middle was cut out.
 */
export interface PersistedCheckerStream {
  attempt_id: string;
  checkpoint_id?: string;
  phase?: string;
  trace_id?: string | null;
  ts?: number;
  truncated?: boolean;
  dropped_chars?: number;
  segments: PersistedStreamSegment[];
}

/**
 * Data of a `checker` timeline block: one Checker attempt (a midway checkpoint
 * of a completed subgoal or the exit final review), or the run outcome
 * (`phase: 'outcome'`). Streamed reasoning and tool traces land in the same
 * `operator_*_thinking` / `generic_tools` fields as an Operator step so the
 * timeline renders them with one code path.
 */
export interface CheckerBlockData {
  event?: string;
  attempt_id?: string;
  checkpoint_id?: string;
  phase: 'checkpoint' | 'final' | 'outcome' | string;
  subgoal_text?: string;
  status?: 'running' | 'done' | 'superseded' | 'unchecked' | 'error' | string;
  trace_id?: string | null;
  anchor_step_id?: string | null;
  items?: CheckerCheckItem[];
  verdicts?: CheckerVerdict[];
  findings?: string[];
  unmet_subgoals?: string[];
  reverted?: boolean;
  applicable?: boolean;
  repairs_used?: number;
  route?: string;
  error?: string;
  task_status?: 'completed' | 'partial' | 'blocked' | string;
  tests?: { passed: number; failed: number; inconclusive: number; unchecked: number };
  last_findings?: string[];
  started_at?: number;
  finished_at?: number;
  duration?: number;
  isCompleted?: boolean;
  generic_tools?: any[];
  /** Per-turn stream segments (live chunks or the persisted transcript); the flat fields below hold the joined text. */
  stream_segments?: StreamSegment[];
  operator_native_thinking?: string;
  operator_raw_thinking?: string;
  [key: string]: any;
}

/** @deprecated legacy JSON-in-stream checker verdict (pre-ledger); kept for the parser. */
export interface CheckerResult {
  success: boolean;
  reason: string;
}

export interface StepReplayFrame {
  index: number;
  stepNumber: number;
  rawStepNumber?: number;
  stepId?: string;
  title: string;
  imageUrl: string;
  preImageUrl?: string | null;
  postImageUrl?: string | null;
  action?: any;
  actionType?: string;
  actionText?: string;
  targetText?: string;
  coords?: string;
  status?: 'dispatched' | 'failed' | string;
  isPost?: boolean;
  timestamp?: number;
  phaseId?: string;
  summary?: string;
}


```

### Core Architecture Module: `apps/showcase_ui/src/app/core/models/system.model.ts`
```
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type ProbeStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export type ProbeCategory = 'device' | 'auth' | 'toolchain' | 'runtime';

export interface ProbeAction {
  action_type: 'command' | 'hint' | 'link';
  label: string;
  payload: string;
}

export interface DeviceInfo {
  serial: string;
  state: string;
  model: string | null;
  product: string | null;
  android_version: string | null;
  screen_resolution: string | null;
  is_locked: boolean | null;
  is_emulator: boolean;
  installed_packages?: string[];
}

export interface AdbServerEndpoint {
  host: string;
  port: number;
  socket: string;
  identity: string;
  mode: 'local' | 'remote';
  is_local_default: boolean;
}

export interface AdbServerDevice {
  serial: string;
  state: string;
  model: string | null;
  product: string | null;
}

export interface AdbServerStatus {
  endpoint: AdbServerEndpoint;
}

export interface AdbServerConnectionResult {
  success: boolean;
  message: string;
  endpoint: AdbServerEndpoint;
  devices: AdbServerDevice[];
  persisted?: boolean;
  persistence_error?: string | null;
  error_code?: string;
  output?: string;
}

export interface AdbServerConnectionResponse {
  connection_result: AdbServerConnectionResult;
  report?: SystemReadinessReport;
}

export interface ProbeResult {
  id: string;
  category: ProbeCategory;
  title: string;
  status: ProbeStatus;
  is_blocker: boolean;
  summary: string;
  description: string;
  metadata: Record<string, any>;
  actions: ProbeAction[];
}

export interface SystemReadinessReport {
  overall_ready: boolean;
  blocker_count: number;
  passed_blocker_count: number;
  probes: ProbeResult[];
  active_device: DeviceInfo | null;
  os_type?: 'linux' | 'darwin' | 'windows' | string;
  timestamp: number;
}

export type EmulatorLaunchStage =
  | 'idle'
  | 'starting'
  | 'waiting_for_adb'
  | 'booting'
  | 'ready'
  | 'failed'
  | 'stopped';

export interface EmulatorLaunchState {
  avd_name: string | null;
  status: EmulatorLaunchStage;
  pid: number | null;
  serial: string | null;
  stage_message: string;
  progress_percent: number;
  started_at: number | null;
  elapsed_seconds: number;
  error: string | null;
  logs: string[];
  can_retry: boolean;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #162** (2026-09-29): **Third party cleanup**
  *Symptoms*: 

- **Issue #150** (2026-10-02): **Add the NOTICE file Apache 2.0 section 4(d) requires**
  *Symptoms*: Closes #113  ## Why  ARTEMIS is Apache-2.0 and includes source developed by Minitap, Inc. from [mobile-use](https://github.com/minitap-ai/mobile-use), which is also Apache-2.0 and ships a `NOTICE` file. Section 4(d) says that where the original work includes a `NOTICE`, a redistribution must carry a readable copy of the attribution notices it contains. This repository has a `LICENSE` and no `NOTICE`, so those notices are not being carried forward.  Verified rather than assumed, since the whole obligation hinges on the upstream file existing:  ``` $ gh api repos/minitap-ai/mobile-use/contents/NOTICE --jq '.size' 556 $ gh api repos/google/artemis/contents/NOTICE {"message":"Not Found","status":"404"} $ gh api repos/google/artemis --jq .license.spdx_id Apache-2.0 ```  The README already credits Minitap, and the source headers already carry `Copyright 2025-2026 Minitap, Inc.`. Both are good, and neither is the thing 4(d) asks for: it wants the contents of the upstream `NOTICE`, which includes an attribution request that appears nowhere in this repository today.  ## What  A root `NOTICE` carrying ARTEMIS's own copyright line, a statement of the inclusion, and the upstream notices reproduced verbatim below a separator. Reproduced without edits, because 4(d) asks for a readable copy of what the file says, not a summary of it. The upstream attribution request travels with it, which also satisfies the thing Minitap actually asked for.  One line added to the README's License section po
  **Post-Mortem & Fix Analysis**:
  > Closing this: `4209818` ("refactor: organize third-party code", 28 Sep) covers it, and covers it better than this PR did.  The premise here was that Apache 2.0 section 4(d) needs the Minitap attribution notices reproduced in the distribution. They now are, at `third_party/mobile_use/NOTICE`, verbatim rather than quoted, next to that code's own `LICENSE` and `METADATA`, with the README section pointing at the directory. 4(d) accepts the notices "within the Source form or documentation, if provided along with the Derivative Works", so that satisfies it without a top-level file.  A root `NOTICE` would only add discoverability at this point, and doing it my way would also mean maintaining a second copy of text that already lives beside the code it belongs to. Not worth the duplication. If you ever do want a root-level pointer, it is a one-line addition and I am happy to open it.  Thanks for organising it properly.

- **Issue #140** (2026-09-21): **fix(mcp): stop splicing notification text into AppleScript/PowerShell source**
  *Symptoms*: -
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/artemis/pull/140/checks?check_run_id=106240610074) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #133** (2026-09-18): **test(config): cover utils.* node reconciliation as match (CHE-656)**
  *Symptoms*: ## Summary  CHE-656 asked to decide + close a claimed Gate 1 manifest coverage gap: that `build_attempt_manifest` never tracks the four `LLMConfig.utils` nodes (`outputter`/`hopper`/`video_analyzer`/`object_detector`), causing every real run to reconcile as `unmapped_call`.  **Finding: the gap does not exist in current code.** `build_attempt_manifest` has tracked all four utils nodes with the same tier-matching treatment as the twelve required agent nodes since the mechanism's original commit (5eae089, CHE-491) — they live under a separate `manifest["utils"]` key (parallel to `manifest["nodes"]`), and `reconcile_attempt` already merges both dicts (`{**manifest.get("nodes", {}), **manifest.get("utils", {})}`) before matching usage events by node name — no separate handling, no gap.  The `unmapped_call` evidence quoted in the issue only showed `manifest["nodes"]` (the agent-node dict), which by design never contains utils entries — that's not the same as the manifest lacking them entirely.  ## Decision (CHE-656 AC1/AC2)  `utils.*` nodes are included in manifest node coverage, with the same tier/source verification as agent nodes. No production code change needed — `attempt_manifest.py` and `attempt_reconciliation.py` already implement this correctly.  ## Change  Regression coverage only (CHE-656 AC3), closing the gap that no test actually asserted this: - `test_attempt_manifest.py`: enabled `outputter`/`hopper` utils nodes get the same `enabled`/`resolved_tier`/`config` treatme
  **Post-Mortem & Fix Analysis**:
  > Opened against the wrong repo by mistake (automation default picked the upstream parent instead of the fork). Closing; correct PR opened at cheese-work/artemis.
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/artemis/pull/133/checks?check_run_id=105680684264) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #98** (2026-10-02): **test(mcp): let the emulator win32 branch be exercised from any host**
  *Symptoms*: Closes #97.  ## Problem  `test_ensure_emulator_uses_windows_creation_flags` fails on every non-Windows host, including CI's own `ubuntu-latest` runner.  The test patches `sys.platform` so the Windows spawn path can be checked from anywhere. That path builds:  ```python creationflags=(subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS), ```  and neither attribute exists in `subprocess` off Windows:  ```console $ python -c "import subprocess; print(hasattr(subprocess,'CREATE_NEW_PROCESS_GROUP'))" False ```  So the expression raises `AttributeError` before `Popen` is reached, `ensure_emulator`'s `except Exception: return False` swallows it, and the test fails its first assertion with nothing to explain why:  ```console $ uv run pytest -q tests/unit/mcp/test_device_utils.py E   AssertionError: assert False 1 failed, 1 passed ```  The sibling POSIX test passes, because `start_new_session` is portable.  ## Change  Stub the two Windows-only constants with their documented values, so the `win32` branch is reachable from any host:  ```python monkeypatch.setattr(     device_utils.subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200, raising=False ) monkeypatch.setattr(device_utils.subprocess, "DETACHED_PROCESS", 0x00000008, raising=False) ```  `raising=False` lets monkeypatch add the attributes and remove them again at teardown, so nothing leaks into other tests.  ## The assertion still has teeth  The obvious worry with stubbing constants that the assertion also reads is t
  **Post-Mortem & Fix Analysis**:
  > Closing this: `351ca84` ("fix: server status, CLI entrypoint, replay and test issues", 28 Sep) already does it, and does it better.  Same diagnosis — `CREATE_NEW_PROCESS_GROUP` and `DETACHED_PROCESS` exist only in the Windows build of `subprocess`, so faking `sys.platform` raises `AttributeError` inside the branch, `ensure_emulator`'s `except Exception: return False` swallows it, and the test could only really pass on a Windows runner.  The difference is in the stub. Mine set the documented constants unconditionally; yours is  ```python getattr(device_utils.subprocess, name, value) ```  which keeps the real values when the test does run on Windows, so the assertion stays honest there instead of checking a constant the test supplied itself. That is the better version and I would not want to rebase mine over it.  Nothing needed here.

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
     """Presses a specific Android key event (e.g., KEYCODE_ENTER, KEYCODE_HOME)."""
     try:
@@ -419,7 +444,7 @@ async def press_key(ctx: Context, keycode: str) -> str:
         return f"Error: {e}"
 
 
-@mcp.tool()
+@_tool()
 async def take_screenshot(ctx: Context) -> str:
     """Takes a screenshot of the device screen.
 
@@ -437,7 +462,7 @@ async def take_screenshot(ctx: Context) -> str:
         return f"Error: {e}"
 
 
-@mcp.tool()
+@_tool()
 async def get_ui_hierarchy(ctx: Context) -> str:
     """Retrieves the current UI elements hierarchy from the device."""
     try:
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

**File**: `artemis/utils/video.py` (modified, +5/-2)
```diff
@@ -513,10 +513,13 @@ async def render_timeline_clip(
                 f"setsar=1,fps={fps},format=yuv420p[{label}]"
             )
         labels.append(f"[{label}]")
+    # ``concat`` does not advertise a frame rate on its output link, so without an
+    # explicit rate ffmpeg falls back to 25 fps CFR and duplicates frames, breaking
+    # the ``start_time + frame_index / fps`` mapping the analyzer relies on.
     if len(labels) == 1:
-        filter_parts.append(f"{labels[0]}null[outv]")
+        filter_parts.append(f"{labels[0]}fps={fps}[outv]")
     else:
-        filter_parts.append(f"{''.join(labels)}concat=n={len(labels)}:v=1:a=0[outv]")
+        filter_parts.append(f"{''.join(labels)}concat=n={len(labels)}:v=1:a=0,fps={fps}[outv]")
 
     command.extend(
         [
```

**File**: `playground/backend_manager/app/auth/jwt_handler.py` (modified, +3/-5)
```diff
@@ -12,7 +12,7 @@
 # See the License for the specific language governing permissions and
 # limitations under the License.
 
-from datetime import datetime, timedelta, timezone
+from datetime import UTC, datetime, timedelta
 from fastapi import Depends, HTTPException, Security, status
 from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
 from jose import JWTError, jwt
@@ -23,13 +23,11 @@
 
 def create_access_token(user_id: str, extra_claims: dict | None = None) -> str:
     """Generate a signed JWT access token."""
-    expire = datetime.now(timezone.utc) + timedelta(
-        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
-    )
+    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
     to_encode = {
         "sub": user_id,
         "exp": expire,
-        "iat": datetime.now(timezone.utc),
+        "iat": datetime.now(UTC),
         "iss": "artemis-backend-manager",
     }
     if extra_claims:
```

**File**: `playground/backend_manager/app/auth/otp_service.py` (modified, +3/-3)
```diff
@@ -12,7 +12,7 @@
 # See the License for the specific language governing permissions and
 # limitations under the License.
 
-from datetime import datetime, timedelta, timezone
+from datetime import UTC, datetime, timedelta
 import logging
 import secrets
 from app.config import settings
@@ -38,7 +38,7 @@ def generate_otp(self, identifier: str) -> str:
         else:
             code = f"{secrets.randbelow(900000) + 100000}"
 
-        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.OTP_EXPIRE_SECONDS)
+        expires_at = datetime.now(UTC) + timedelta(seconds=settings.OTP_EXPIRE_SECONDS)
         self._store[ident] = {
             "code": code,
             "expires_at": expires_at,
@@ -65,7 +65,7 @@ def verify_otp(self, identifier: str, code: str) -> bool:
             logger.warning(f"[OTP Service] No active OTP found for {ident}")
             return False
 
-        if datetime.now(timezone.utc) > record["expires_at"]:
+        if datetime.now(UTC) > record["expires_at"]:
             logger.warning(f"[OTP Service] OTP for {ident} has expired")
             self._store.pop(ident, None)
             return False
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

**File**: `artemis/clients/adb_tunnel.py` (modified, +3/-0)
```diff
@@ -11,6 +11,9 @@
 # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 # See the License for the specific language governing permissions and
 # limitations under the License.
+#
+# Portions of this file are derived from mobile-use (https://github.com/minitap-ai/mobile-use)
+# Copyright 2025-2026 Minitap, Inc. Licensed under the Apache License 2.0.
 
 """ADB WebSocket tunnel implementation.
 
```

**File**: `artemis/clients/ui_automator_client.py` (modified, +3/-0)
```diff
@@ -11,6 +11,9 @@
 # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 # See the License for the specific language governing permissions and
 # limitations under the License.
+#
+# Portions of this file are derived from mobile-use (https://github.com/minitap-ai/mobile-use)
+# Copyright 2025-2026 Minitap, Inc. Licensed under the Apache License 2.0.
 
 """UIAutomator2 client for Android device screen data retrieval.
 
```

**File**: `artemis/context.py` (modified, +3/-0)
```diff
@@ -11,6 +11,9 @@
 # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 # See the License for the specific language governing permissions and
 # limitations under the License.
+#
+# Portions of this file are derived from mobile-use (https://github.com/minitap-ai/mobile-use)
+# Copyright 2025-2026 Minitap, Inc. Licensed under the Apache License 2.0.
 
 """Context variables for global state management.
 
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

**File**: `artemis/agents/entity_extractor/entity_extractor.py` (removed, +0/-90)
```diff
@@ -1,90 +0,0 @@
-# Copyright 2026 Google LLC
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-
-"""Lightweight entity extraction and package resolver for ARTEMIS.
-
-Dispatches bounded LLM extraction turns to identify application package identifiers
-and configuration attributes from raw device listings without manual parsing heuristics.
-"""
-
-from __future__ import annotations
-
-from pathlib import Path
-from typing import cast
-
-from jinja2 import Template
-from langchain_core.messages import HumanMessage, SystemMessage
-from pydantic import BaseModel, Field
-
-from artemis.context import ArtemisContext
-from artemis.data_engine.trace import trace
-from artemis.services.llm import get_llm, invoke_llm_with_timeout_message, with_fallback
-from artemis.utils.logger import get_logger
-
-logger = get_logger(__name__)
-
-
-class ExtractionResult(BaseModel):
-    """Structured extraction outcome for entity resolution."""
-
-    found: bool = Field(description="True if the requested entity was definitively identified.")
-    output: str | None = Field(default=None, description="Exact extracted identifier or string value.")
-    reason: str = Field(description="Brief justification of the match criteria applied.")
-
-
-@trace(type="agent", name="entity_extractor")
-async def extract_entity(
-    ctx: ArtemisContext,
-    request: str,
-    data: str,
-    use_fallback: bool = True,
-) -> ExtractionResult:
-    """Extract a specific identifier or entity from raw batch device data."""
-    logger.info(f"Invoking Artemis Entity Extractor (fallback={use_fallback})")
-    template_path = Path(__file__).parent / "entity_extractor.md"
-    system_prompt = Template(template_path.read_text(encoding="utf-8")).render()
-
-    messages = [
-        SystemMessage(content=system_prompt),
-        HumanMessage(content=f"Target Query:\n{request}\n\nCandidate Raw Dataset:\n{data}"),
-    ]
-
-    primary_llm = get_llm(ctx=ctx, name="entity_extractor", is_utils=True).with_structured_output(
-        ExtractionResult
-    )
-
-    try:
-        if use_fallback:
-            fallback_llm = get_llm(
-                ctx=ctx, name="entity_extractor", is_utils=True, use_fallback=True
-            ).with_structured_output(ExtractionResult)
-            raw = await with_fallback(
-                main_call=lambda: invoke_llm_with_timeout_message(primary_llm.ainvoke(messages)),
-                fallback_call=lambda: invoke_llm_with_timeout_message(fallback_llm.ainvoke(messages)),
-            )
-        else:
-            raw = await invoke_llm_with_timeout_message(primary_llm.ainvoke(messages))
-
-        if isinstance(raw, ExtractionResult):
-            return raw
-        if isinstance(raw, dict):
-            return ExtractionResult.model_validate(raw)
-        return cast(ExtractionResult, raw)
-    except Exception as exc:
-        logger.error(f"Entity extraction turn failed: {exc}")
-        return ExtractionResult(
-            found=False,
-            output=None,
-            reason=f"LLM extraction error: {str(exc)[:400]}",
-        )
```

**File**: `artemis/agents/hopper/hopper.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+## Hopper
+
+Extract relevant information from batch data. **Keep extracted data exactly as-is** - no reformatting.
+
+## Output
+- **found**: `true` if data was found, `false` otherwise
+- **output**: Extracted information if found, `null` otherwise
+- **reason**: Brief explanation of search logic
+
+## Rules
+1. **Search entire input** - may contain hundreds of entries
+2. **For app package lookup**: Match app name (or variations) in package identifier
+   - Common patterns: lowercase app name, company+app, brand name, codenames
+3. **Prefer direct matches** over partial matches
+4. **Return `null`** if not found or if multiple ambiguous matches exist - don't guess
```

**File**: `artemis/agents/hopper/hopper.py` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
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
+from pathlib import Path
+
+from jinja2 import Template
+from langchain_core.messages import HumanMessage, SystemMessage
+from artemis.context import ArtemisContext
+from artemis.data_engine.trace import trace
+from artemis.services.llm import get_llm, invoke_llm_with_timeout_message, with_fallback
+from artemis.utils.logger import get_logger
+from pydantic import BaseModel, Field
+
+logger = get_logger(__name__)
+
+
+class _CyFunctionDetectorMeta(type):
+    def __instancecheck__(self, instance):
+        name = type(instance).__name__
+        return (
+            name
+            in (
+                "cyfunction",
+                "cython_function_or_method",
+                "builtin_function_or_method",
+            )
+            or "cyfunction" in name.lower()
+        )
+
+
+class CyFunctionDetector(metaclass=_CyFunctionDetectorMeta):
+    pass
+
+
+class HopperOutput(BaseModel):
+    model_config = {"ignored_types": (CyFunctionDetector,)}
+    found: bool = Field(description="True if the requested data was found, False otherwise.")
+    output: str | None = Field(description="The extracted data if found, null otherwise.")
+    reason: str = Field(
+        description="A short explanation of what you looked for"
+        + " and how you decided what to extract."
+    )
+
+
+@trace(type="agent", name="hopper")
+async def hopper(
+    ctx: ArtemisContext,
+    request: str,
+    data: str,
+    use_fallback: bool = True,
+) -> HopperOutput:
+    logger.info(f"Starting Hopper Agent (use_fallback={use_fallback})")
+    system_message = Template(
+        Path(__file__).parent.joinpath("hopper.md").read_text(encoding="utf-8")
+    ).render()
+    messages = [
+        SystemMessage(content=system_message),
+        HumanMessage(content=f"{request}\nHere is the data you must dig:\n{data}"),
+    ]
+
+    llm = get_llm(ctx=ctx, name="hopper", is_utils=True).with_structured_output(HopperOutput)
+    try:
+        if use_fallback:
+            llm_fallback = get_llm(
+                ctx=ctx, name="hopper", is_utils=True, use_fallback=True
+            ).with_structured_output(HopperOutput)
+            response: HopperOutput = await with_fallback(
+                main_call=lambda: invoke_llm_with_timeout_message(llm.ainvoke(messages)),
+                fallback_call=lambda: invoke_llm_with_timeout_message(
+                    llm_fallback.ainvoke(messages)
+                ),
+            )  # type: ignore
+        else:
+            response: HopperOutput = await invoke_llm_with_timeout_message(llm.ainvoke(messages))
+        return response
+    except Exception as e:
+        logger.error(f"Hopper LLM invocation failed: {e}")
+        return HopperOutput(
+            found=False,
+            output=None,
+            reason=f"Failed due to LLM error: {str(e)[:500]}",
+        )
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

### Incident Patch 5: `52749c7f` (2026-09-11)
**Commit Message**: feat: add managed accessibility helper with UIAutomator fallback

**File**: `.env.example` (modified, +5/-0)
```diff
@@ -22,6 +22,11 @@ ADB_PORT=5037
 # Keep the display awake, falling back to a wake lock or safe heartbeat when needed.
 # Set to false if Artemis is used with a personal device whose screen should time out.
 ARTEMIS_KEEP_DEVICE_AWAKE=true
+# UI hierarchy backend: auto (Accessibility Helper, UIAutomator2 fallback) | helper | uiautomator
+ARTEMIS_HIERARCHY_BACKEND=auto
+# Let tasks install / upgrade the Accessibility Helper APK on a device they hold.
+# Set to false on shared or personal phones: then only `artemis helper install` installs it.
+ARTEMIS_HELPER_AUTO_INSTALL=true
 
 # Artemis Execution Defaults (flash or pro)
 ARTEMIS_DEFAULT_PROFILE=flash
```

**File**: `README.md` (modified, +20/-0)
```diff
@@ -251,6 +251,26 @@ if __name__ == "__main__":
 * **Developer CLI (`uv run artemis run`)**: Direct terminal execution for automated test cases, exploratory stability inspection, or AndroidWorld benchmarks with high-fidelity structured terminal output;
 * **Python SDK**: Integrates as a standard Python library into existing automated testing frameworks (e.g., pytest) or CI/CD pipelines with strongly typed Pydantic structured outputs and assertion support.
 
+<a id="on-device-helper"></a>
+## What ARTEMIS Installs on Your Phone
+
+The first task on a device installs the **Artemis Accessibility Helper**, a small
+accessibility service that reads the screen layout without taking the
+UiAutomation connection. Tools using UiAutomation can suppress the helper unless
+they enable `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`. You will see
+a collapsed "Artemis test helper is running" notification and a new entry under
+Settings > Accessibility; both are that helper. It listens only on the phone
+itself and sends nothing elsewhere.
+
+* Pre-install it (avoids the ~3 s delay on the first task): `uv run artemis helper install`
+* Inspect it: `uv run artemis helper status` / `uv run artemis doctor`
+* Remove it any time: `uv run artemis helper uninstall`
+* Use UIAutomator2 instead: `ARTEMIS_HIERARCHY_BACKEND=uiautomator` in `.env`
+* Prevent automatic installation: `ARTEMIS_HELPER_AUTO_INSTALL=false` in `.env`
+
+If the helper ever fails mid-task, ARTEMIS falls back to UIAutomator2 and says
+so in the task timeline, in `mobile_manage_task` status, and in the final report.
+
 <a id="benchmarks"></a>
 ## Benchmarks: AndroidWorld (SOTA 99%+)
 
```

**File**: `README_CN.md` (modified, +16/-0)
```diff
@@ -252,6 +252,22 @@ if __name__ == "__main__":
 * **开发者命令行 CLI (`uv run artemis run`)**：支持通过终端直接执行自动化测试用例、探索性稳定性巡检或 AndroidWorld 基准评测，提供高保真结构化终端输出；
 * **Python SDK**：作为标准 Python 库集成至现有自动化测试框架（如 pytest）或 CI/CD 流水线，提供基于 Pydantic 的强类型结构化结果与断言支持。
 
+<a id="on-device-helper"></a>
+## ARTEMIS 会在手机上安装什么
+
+首次在某台设备上执行任务时，ARTEMIS 会安装 **Artemis Accessibility Helper**：一个用于读取屏幕布局的小型无障碍服务，
+不占用 UiAutomation 连接。使用 UiAutomation 的工具需要启用 `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`，否则可能使该服务暂停运行。
+手机上会出现一条折叠的"Artemis test helper is running"通知，以及"设置 > 无障碍"里的一个新条目，都是它。
+它只监听手机本机回环地址，不向外发送任何数据。
+
+* 预先安装（避免首个任务多等约 3 秒）：`uv run artemis helper install`
+* 查看状态：`uv run artemis helper status` / `uv run artemis doctor`
+* 随时移除：`uv run artemis helper uninstall`
+* 改用 UIAutomator2：在 `.env` 中设置 `ARTEMIS_HIERARCHY_BACKEND=uiautomator`
+* 禁止自动安装：在 `.env` 中设置 `ARTEMIS_HELPER_AUTO_INSTALL=false`
+
+任务中途 helper 失效时，ARTEMIS 会回退到 UIAutomator2，并在任务时间线、`mobile_manage_task` 状态和最终报告里明确说明。
+
 <a id="benchmarks"></a>
 <a id="基准评测"></a>
 ## 基准评测：AndroidWorld (SOTA 99%+)
```

**File**: `apps/showcase_ui/src/app/components/agent-stream/agent-stream-startup.spec.ts` (modified, +53/-0)
```diff
@@ -40,6 +40,59 @@ describe('startup Work block', () => {
     expect(item.isActive).toBeTrue();
   });
 
+  it('shows the helper install sub-step while the hierarchy service is connecting', () => {
+    const events: StartupProgressEvent[] = [
+      { stage: 'uiautomator', message: 'Connecting to the UI hierarchy service', timestamp: 10 },
+      {
+        stage: 'helper_install',
+        message: 'Installing the Artemis accessibility helper on this device for the first time (v1.1.3, about 3 seconds)',
+        timestamp: 10.2
+      }
+    ];
+
+    const [item] = buildStartupWorkItems(events, 12, false, true);
+
+    expect(item.isActive).toBeTrue();
+    expect(item.message).toContain('Installing the Artemis accessibility helper');
+    expect(item.elapsed).toBe('2.0s');
+  });
+
+  it('uses the hierarchy source line as the completion message of the second step', () => {
+    const events: StartupProgressEvent[] = [
+      { stage: 'uiautomator', message: 'Connecting to the UI hierarchy service', timestamp: 10 },
+      { stage: 'helper_install', message: 'Installing ...', timestamp: 10.2 },
+      { stage: 'uiautomator_ready', message: 'UI hierarchy service is ready (helper)', timestamp: 13 },
+      {
+        stage: 'hierarchy_backend',
+        message: 'UI hierarchy source: Artemis accessibility helper v1.1.3',
+        timestamp: 13.1
+      },
+      // A later mid-run switch must not rewrite the startup line.
+      {
+        stage: 'hierarchy_backend_changed',
+        message: 'UI hierarchy source switched from Artemis accessibility helper to UIAutomator2 because ...',
+        timestamp: 90
+      }
+    ];
+
+    const [item] = buildStartupWorkItems(events, 100, true, true);
+
+    expect(item.isActive).toBeFalse();
+    expect(item.message).toBe('UI hierarchy source: Artemis accessibility helper v1.1.3');
+    expect(item.elapsed).toBe('3.0s');
+  });
+
+  it('falls back to the generic completion line for runs without a source event', () => {
+    const events: StartupProgressEvent[] = [
+      { stage: 'uiautomator', message: 'Connecting to the UI hierarchy service', timestamp: 10 },
+      { stage: 'environment', message: 'Preparing the device environment', timestamp: 14 }
+    ];
+
+    const [item] = buildStartupWorkItems(events, 20, false, true);
+
+    expect(item.message).toBe('UI hierarchy service is ready');
+  });
+
   it('uses old first_response events only as a hidden completion boundary', () => {
     const events: StartupProgressEvent[] = [
       { stage: 'environment', message: 'Preparing the device environment', timestamp: 20 },
```

**File**: `apps/showcase_ui/src/app/components/agent-stream/agent-stream.component.html` (modified, +11/-0)
```diff
@@ -962,6 +962,17 @@ <h3>No Stream Activity Selected</h3>
                               }
                               <!-- Generic Tools & LLM Calls (when item is a tool) -->
                               @if (item.type === 'tool') {
+                                <!-- UI-hierarchy source changed mid-run (helper <-> UIAutomator2). -->
+                                @if (isBackendSwitchNote(item.data)) {
+                                  <div class="llm-retry-notes">
+                                    <div class="llm-retry-note">
+                                      <span class="stream-status-dot"></span>
+                                      <div class="llm-retry-note-text">
+                                        <span class="llm-retry-status-line">{{ getBackendSwitchMessage(item.data) }}</span>
+                                      </div>
+                                    </div>
+                                  </div>
+                                }
                                 <!-- Only SDK-observed Gemini retries are shown as quiet stream notes. -->
                                 @if (isLLMRetry(item.data)) {
                                   <div class="llm-retry-notes">
```

**File**: `apps/showcase_ui/src/app/components/agent-stream/agent-stream.component.ts` (modified, +34/-3)
```diff
@@ -61,6 +61,10 @@ interface StartupWorkStage {
   started: string;
   completed: string;
   completedMessage: string;
+  /** Sub-steps that replace the live message while the stage is still running. */
+  liveDetailStages?: string[];
+  /** A later event whose message is a better completion line than the stage's own. */
+  completedDetailStage?: string;
 }
 
 const STARTUP_WORK_STAGES: StartupWorkStage[] = [
@@ -72,7 +76,12 @@ const STARTUP_WORK_STAGES: StartupWorkStage[] = [
   {
     started: 'uiautomator',
     completed: 'uiautomator_ready',
-    completedMessage: 'UI Automator is ready'
+    completedMessage: 'UI hierarchy service is ready',
+    // First task on a device installs / upgrades the accessibility helper
+    // (a few seconds): say so instead of a generic "connecting".
+    liveDetailStages: ['helper_install', 'helper_upgrade'],
+    // "UI hierarchy source: Artemis accessibility helper v1.1.3" (or UIAutomator2).
+    completedDetailStage: 'hierarchy_backend'
   },
   {
     started: 'environment',
@@ -119,10 +128,21 @@ export function buildStartupWorkItems(
     const endTimestamp = completed?.timestamp
       || (isActive ? nowSeconds : events[events.length - 1]?.timestamp || startTimestamp);
 
+    const liveDetail = (stage.liveDetailStages || [])
+      .map((detailStage) => byStage.get(detailStage))
+      .filter((event): event is StartupProgressEvent => Boolean(event))
+      .filter((event) => event.timestamp >= startTimestamp)
+      .sort((a, b) => b.timestamp - a.timestamp)[0];
+    const completedDetail = stage.completedDetailStage
+      ? byStage.get(stage.completedDetailStage)
+      : undefined;
+    const message = completed
+      ? (completedDetail?.message || explicitlyCompleted?.message || stage.completedMessage)
+      : (liveDetail?.message || started!.message);
+
     return [{
       ...(explicitlyCompleted || started!),
-      message: explicitlyCompleted?.message
-        || (completed ? stage.completedMessage : started!.message),
+      message,
       isActive,
       elapsed: formatStartupElapsed(endTimestamp - startTimestamp)
     }];
@@ -198,6 +218,7 @@ import { drawActionCoordinatesOnOverlay } from '../../utils/image-overlay.util';
 
 import {
   consolidateLogsToBlocks,
+  isBackendSwitchNote,
   groupBlocksToPhases,
   extractBlockTokens,
   formatTokenCount,
@@ -1795,6 +1816,7 @@ export class AgentStreamComponent implements AfterViewInit {
       || this.isDisplayableLLMFailure(t)
       || this.isLLMRetry(t)
       || this.isReportStatusAction(t)
+      || this.isBackendSwitchNote(t)
     );
     const hasAndroidActions = Boolean(block.data?.action_taken) && (this.isAndroidAction(block.data.action_taken) || this.isReportStatusAction(block.data.action_taken));
     return hasNative || hasRaw || hasReset || hasVisibleTools || hasAndroidActions;
@@ -1826,6 +1848,15 @@ export class AgentStreamComponent implements AfterViewInit {
       && (tool?.name === 'llm_pause' || tool?.payload?.pause === true);
   }
 
+  /** Mid-run change of the UI-hierarchy source (helper <-> UIAutomator2). */
+  public isBackendSwitchNote(tool: any): boolean {
+    return isBackendSwitchNote(tool);
+  }
+
+  public getBackendSwitchMessage(tool: any): string {
+    return String(tool?.payload?.message || 'UI hierarchy source changed');
+  }
+
   public resumePausedTask(event: Event): void {
     event.stopPropagation();
     this.agentService.resumeTask();
```

**File**: `apps/showcase_ui/src/app/utils/stream-aggregator.util.spec.ts` (modified, +46/-1)
```diff
@@ -1,4 +1,4 @@
-import { consolidateLogsToBlocks, getSortedStepEvents, persistedStreamToSegments } from './stream-aggregator.util';
+import { consolidateLogsToBlocks, getSortedStepEvents, isBackendSwitchNote, persistedStreamToSegments } from './stream-aggregator.util';
 
 describe('stream aggregator timeline ordering', () => {
   it('interleaves text, tools, and actions by timestamp', () => {
@@ -413,6 +413,51 @@ describe('stream aggregator step ownership', () => {
     expect(blocks.length).toBe(1);
     expect(blocks[0].data.generic_tools.map((t: any) => t.trace_id)).toEqual(['trace-note']);
   });
+
+  it('keeps a mid-run hierarchy source switch in the step where it happened, as a note', () => {
+    const initial = {
+      type: 'trace_recorded',
+      timestamp: '2026-09-02T03:57:20.000Z',
+      data: {
+        trace_id: 'trace-backend-initial',
+        type: 'log',
+        name: 'hierarchy_backend',
+        payload: { backend: 'helper', previous_backend: null, message: 'UI hierarchy source: Artemis accessibility helper v1.1.3' }
+      }
+    };
+    const switched = {
+      type: 'trace_recorded',
+      timestamp: '2026-09-02T03:57:26.000Z',
+      data: {
+        trace_id: 'trace-backend-switch',
+        type: 'log',
+        name: 'hierarchy_backend',
+        timestamp: '2026-09-02T03:57:26.000Z',
+        payload: {
+          backend: 'uiautomator',
+          previous_backend: 'helper',
+          reason: 'HelperUnavailable: tunnel gone',
+          message: 'UI hierarchy source switched from Artemis accessibility helper to UIAutomator2 because HelperUnavailable: tunnel gone'
+        }
+      }
+    };
+    const ordinaryLog = {
+      type: 'trace_recorded',
+      timestamp: '2026-09-02T03:57:27.000Z',
+      data: { trace_id: 'trace-log', type: 'log', name: 'artemis.runtime', payload: { message: 'noise' } }
+    };
+
+    const blocks = consolidateLogsToBlocks([initial, plannerStream, switched, ordinaryLog]);
+
+    // The initial line belongs to the startup block; ordinary logs stay out.
+    expect(blocks.length).toBe(1);
+    expect(blocks[0].data.generic_tools.map((t: any) => t.trace_id)).toEqual(['trace-backend-switch']);
+    expect(isBackendSwitchNote(blocks[0].data.generic_tools[0])).toBeTrue();
+    expect(isBackendSwitchNote(initial.data)).toBeFalse();
+
+    const events = getSortedStepEvents(blocks[0].data);
+    expect(events.map((e) => e.type)).toEqual(['text', 'tool']);
+  });
 });
 
 describe('stream aggregator checker history relocation', () => {
```

**File**: `apps/showcase_ui/src/app/utils/stream-aggregator.util.ts` (modified, +11/-2)
```diff
@@ -247,8 +247,17 @@ function relocateCheckerTools(blocks: StepBlock[]): void {
 }
 
 /**
- * Consolidate raw SSE logs into deduplicated and ordered StepBlocks
+ * A `hierarchy_backend` log trace that records a *switch* (helper -> UIAutomator2
+ * or back). The initial "source: ..." line belongs to the startup block; only
+ * the mid-run change is worth a row in the timeline.
  */
+export function isBackendSwitchNote(tool: any): boolean {
+  return tool?.type === 'log'
+    && tool?.name === 'hierarchy_backend'
+    && Boolean(tool?.payload?.previous_backend);
+}
+
+/** Consolidate raw SSE logs into deduplicated and ordered StepBlocks. */
 export function consolidateLogsToBlocks(rawLogs: any[]): StepBlock[] {
   if (!rawLogs || rawLogs.length === 0) return [];
 
@@ -487,7 +496,7 @@ export function consolidateLogsToBlocks(rawLogs: any[]): StepBlock[] {
       const isTool = log.data.type === 'tool' || isAction;
       const isVisibleLLMEvent = log.data.type === 'llm_call'
         && (log.data.status === 'failed' || log.data.status === 'retrying');
-      if (!isTool && !isVisibleLLMEvent) return;
+      if (!isTool && !isVisibleLLMEvent && !isBackendSwitchNote(log.data)) return;
 
       let stepId = log.data.step_id;
       let existingIndex = -1;
```

---

### Incident Patch 6: `3047c9c2` (2026-09-11)
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

**File**: `playground/backend_manager/app/main.py` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@ async def serve_spa_root():
 
 if __name__ == "__main__":
     import uvicorn
+
     uvicorn.run(
         "app.main:app",
         host=settings.HOST,
```

**File**: `playground/backend_manager/app/routers/session_router.py` (modified, +3/-1)
```diff
@@ -83,7 +83,9 @@ async def terminate_session(
     user_id: str = Depends(get_current_user),
 ):
     """Terminate the session, destroy Artemis container and Cuttlefish AVD."""
-    success = await session_manager.terminate_session(session_id, user_id=user_id, reason="User terminated")
+    success = await session_manager.terminate_session(
+        session_id, user_id=user_id, reason="User terminated"
+    )
     if not success:
         raise HTTPException(
             status_code=status.HTTP_404_NOT_FOUND,
```

**File**: `playground/backend_manager/app/schemas/auth_schema.py` (modified, +6/-2)
```diff
@@ -16,7 +16,9 @@
 
 
 class OTPRequest(BaseModel):
-    identifier: str = Field(..., description="User phone number or email address", example="user@example.com")
+    identifier: str = Field(
+        ..., description="User phone number or email address", example="user@example.com"
+    )
 
 
 class OTPRequestResponse(BaseModel):
@@ -26,7 +28,9 @@ class OTPRequestResponse(BaseModel):
 
 
 class OTPVerify(BaseModel):
-    identifier: str = Field(..., description="User phone number or email address", example="user@example.com")
+    identifier: str = Field(
+        ..., description="User phone number or email address", example="user@example.com"
+    )
     code: str = Field(..., description="6-digit verification code", example="123456")
 
 
```

---

### Incident Patch 7: `bac31b44` (2026-09-10)
**Commit Message**: feat(accessibility): implement Artemis Accessibility Helper for robust UI hierarchy capture

- Introduce ArtemisAccessibilityHelper APK (API 24 to 37+) as a conflict-free, high-performance replacement for UiAutomator:
  * Eliminates native UiAutomator waitForIdle() timeouts, reducing DOM dump latency from ~3s to ~15ms and maintaining resilience against infinite animations.
  * Implements a multi-tier fallback hierarchy discovery strategy (multi-window layer enumeration -> active window fallback -> input/accessibility focus backtracking) with adaptive progressive backoff for seamless page transition capture.
  * Resolves node drop defect caused by 32-bit hash collisions on recurring virtual view IDs in long lists and WebViews by utilizing bounded recursion (MAX_DEPTH=75, MAX_NODES=8000).
  * Strict W3C XML 1.0 character sanitization filtering invalid ASCII control codes and escaping attribute whitespace (&#10;, &#13;, &#9;) to preserve multiline text formatting.
  * Enriches semantic parsing with stateDescription (API 30+ Jetpack Compose), screenReaderFocusable, paneTitle, heading, error, and tooltip attributes.
  * Multi-window metadata propagation tagging each node with window-id,

**File**: `artemis/clients/accessibility_client.py` (added, +247/-0)
```diff
@@ -0,0 +1,247 @@
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
+"""Artemis Accessibility Helper client for Android device automation.
+
+Provides a lightweight, conflict-free alternative to UIAutomator2.
+Runs concurrently with Mobly, Appium, and Espresso without monopolizing
+the singleton UiAutomationConnection.
+"""
+
+from io import BytesIO
+import json
+import os
+import subprocess
+import time
+import urllib.error
+import urllib.request
+
+from PIL import Image
+
+from artemis.clients.ui_automator_client import UIAutomatorScreenData, _pil_to_base64
+from artemis.runtime.adb_endpoint import adb_command
+from artemis.utils.logger import get_logger
+
+logger = get_logger(__name__)
+
+PACKAGE_NAME = "com.artemis.helper"
+SERVICE_NAME = f"{PACKAGE_NAME}/.ArtemisAccessibilityService"
+DEFAULT_PORT = 18888
+
+
+class AccessibilityClient:
+    """Non-exclusive accessibility client for Artemis UI automation."""
+
+    def __init__(self, device_id: str, local_port: int = DEFAULT_PORT):
+        self._device_id = device_id
+        self._local_port = local_port
+        self._base_url = f"http://127.0.0.1:{local_port}"
+
+    def ensure_service_ready(self, apk_path: str | None = None) -> bool:
+        """Ensure ArtemisAccessibilityHelper is installed, enabled, and port-forwarded."""
+        # 1. Check if package is installed
+        if not self._is_installed():
+            if apk_path is None:
+                default_apk = os.path.abspath(
+                    os.path.join(
+                        os.path.dirname(__file__),
+                        "../../packages/artemis-accessibility-helper/ArtemisAccessibilityHelper.apk",
+                    )
+                )
+                if os.path.exists(default_apk):
+                    apk_path = default_apk
+
+            if apk_path and os.path.exists(apk_path):
+                logger.info(f"Installing ArtemisAccessibilityHelper on {self._device_id}...")
+                self._run_adb(["install", "-r", "-g", apk_path])
+            else:
+                logger.warning(
+                    f"ArtemisAccessibilityHelper not installed on {self._device_id} and no APK provided."
+                )
+
+        # 2. Ensure accessibility service is enabled via secure settings
+        self._enable_accessibility_service()
+
+        # 3. Setup port forward
+        self._setup_port_forward()
+
+        # 4. Verify connection
+        for attempt in range(5):
+            if self.ping():
+                logger.info(f"ArtemisAccessibilityHelper connected successfully on {self._device_id}")
+                return True
+            time.sleep(0.5)
+
+        logger.warning(f"Failed to connect to ArtemisAccessibilityHelper on port {self._local_port}")
+        return False
+
+    def ping(self) -> bool:
+        """Health check probe."""
+        try:
+            req = urllib.request.Request(f"{self._base_url}/ping")
+            with urllib.request.urlopen(req, timeout=2.0) as resp:
+                data = json.loads(resp.read().decode())
+                return data.get("success", False)
+        except Exception:
+            return False
+
+    def get_screenshot(self) -> Image.Image | None:
+        """Capture screenshot via high-speed ADB exec-out."""
+        try:
+            result = subprocess.run(
+                adb_command(["-s", self._device_id, "exec-out", "screencap", "-p"]),
+                stdin=subprocess.DEVNULL,
+                capture_output=True,
+                timeout=10,
+                check=True,
+            )
+            return Image.open(BytesIO(result.stdout))
+        except Exception as e:
+            logger.error(f"Failed to capture screenshot via adb: {e}")
+            return None
+
+    def get_hierarchy(self) -> dict:
+        """Fetch hierarchy JSON directly from ArtemisAccessibilityHelper."""
+        req = urllib.request.Request(f"{self._base_url}/dump")
+        with urllib.request.urlopen(req, timeout=5.0) as resp:
+            return json.loads(resp.read().decode())
+
+    def get_hierarchy_xml(self) -> str:
+        """Fetch raw standard UIAutomator XML string directly from helper."""
+        req = urllib.request.Request(f"{self._base_url}/dump_xml")
+        with urllib.request.urlopen(req, timeout=5.0) as resp:
+            return resp.read().decode("utf-8")
+
+    def get_atomic_snapshot(self) -> dict | None:
+        """Fetch atomic snapshot (screenshot Base64 + hierarchy) d
```

**File**: `packages/artemis-accessibility-helper/.gitignore` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+build/
+*.idsig
+.gradle/
+*.class
+.DS_Store
```

**File**: `packages/artemis-accessibility-helper/app/build.gradle.kts` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+plugins {
+    id("com.android.application")
+}
+
+android {
+    namespace = "com.artemis.helper"
+    compileSdk = 35
+
+    defaultConfig {
+        applicationId = "com.artemis.helper"
+        minSdk = 24
+        targetSdk = 35
+        versionCode = 1
+        versionName = "1.0.0"
+    }
+
+    buildTypes {
+        release {
+            isMinifyEnabled = false
+            proguardFiles(
+                getDefaultProguardFile("proguard-android-optimize.txt"),
+                "proguard-rules.pro"
+            )
+        }
+    }
+    compileOptions {
+        sourceCompatibility = JavaVersion.VERSION_1_8
+        targetCompatibility = JavaVersion.VERSION_1_8
+    }
+}
+
+dependencies {
+    // Pure standard Android SDK APIs (android.accessibilityservice, android.view.accessibility, org.json)
+    // Zero external dependencies to maximize stability, guarantee compatibility, and keep APK under 30KB.
+}
```

**File**: `packages/artemis-accessibility-helper/app/src/main/AndroidManifest.xml` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+<?xml version="1.0" encoding="utf-8"?>
+<manifest xmlns:android="http://schemas.android.com/apk/res/android"
+    package="com.artemis.helper">
+
+    <uses-sdk
+        android:minSdkVersion="24"
+        android:targetSdkVersion="35" />
+
+    <uses-permission android:name="android.permission.INTERNET" />
+    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
+    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
+    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
+
+    <application
+        android:allowBackup="false"
+        android:label="@string/app_name"
+        android:supportsRtl="true">
+
+        <service
+            android:name=".ArtemisAccessibilityService"
+            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
+            android:exported="true"
+            android:foregroundServiceType="specialUse">
+            <intent-filter>
+                <action android:name="android.accessibilityservice.AccessibilityService" />
+            </intent-filter>
+            <meta-data
+                android:name="android.accessibilityservice"
+                android:resource="@xml/accessibility_service_config" />
+            <property
+                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
+                android:value="Artemis mobile automation test bridge" />
+        </service>
+
+    </application>
+
+</manifest>
```

**File**: `packages/artemis-accessibility-helper/app/src/main/java/com/artemis/helper/A11yNode.java` (added, +264/-0)
```diff
@@ -0,0 +1,264 @@
+package com.artemis.helper;
+
+import android.graphics.Rect;
+import org.json.JSONArray;
+import org.json.JSONObject;
+
+import java.util.ArrayList;
+import java.util.List;
+
+/**
+ * In-memory snapshot of an Accessibility UI element node.
+ * Decoupled from live Android AccessibilityNodeInfo objects to prevent
+ * Binder proxy memory leaks, avoid stale node crashes, and ensure
+ * instant thread-safe serialization to both XML and JSON.
+ */
+public final class A11yNode {
+
+    public int index = 0;
+    public String text = "";
+    public String resourceId = "";
+    public String className = "";
+    public String packageName = "";
+    public String contentDesc = "";
+
+    public boolean checkable = false;
+    public boolean checked = false;
+    public boolean clickable = false;
+    public boolean enabled = true;
+    public boolean focusable = false;
+    public boolean focused = false;
+    public boolean scrollable = false;
+    public boolean longClickable = false;
+    public boolean password = false;
+    public boolean selected = false;
+
+    // Window metadata for multi-window awareness
+    public int windowId = -1;
+    public String windowType = "";
+    public int windowLayer = 0;
+    public boolean windowActive = false;
+    public boolean windowFocused = false;
+
+    // Advanced semantics for Agent perception & verification
+    public boolean editable = false;
+    public boolean isHeading = false;
+    public boolean screenReaderFocusable = false;
+    public String stateDescription = "";
+    public String errorText = "";
+    public String paneTitle = "";
+    public String tooltip = "";
+
+    public int left = 0;
+    public int top = 0;
+    public int right = 0;
+    public int bottom = 0;
+
+    public int drawingOrder = 0;
+    public String hint = "";
+
+    public final List<A11yNode> children = new ArrayList<>(4);
+
+    public A11yNode() {}
+
+    public int getWidth() {
+        return right - left;
+    }
+
+    public int getHeight() {
+        return bottom - top;
+    }
+
+    public String getBoundsString() {
+        return "[" + left + "," + top + "][" + right + "," + bottom + "]";
+    }
+
+    /**
+     * Serializes this node and all of its descendants into standard UIAutomator XML.
+     */
+    public void writeXml(StringBuilder sb) {
+        sb.append("<node");
+        XmlUtils.appendIntAttribute(sb, "index", index);
+        XmlUtils.appendAttribute(sb, "text", text);
+        XmlUtils.appendAttribute(sb, "resource-id", resourceId);
+        XmlUtils.appendAttribute(sb, "class", className);
+        XmlUtils.appendAttribute(sb, "package", packageName);
+        XmlUtils.appendAttribute(sb, "content-desc", contentDesc);
+        XmlUtils.appendBooleanAttribute(sb, "checkable", checkable);
+        XmlUtils.appendBooleanAttribute(sb, "checked", checked);
+        XmlUtils.appendBooleanAttribute(sb, "clickable", clickable);
+        XmlUtils.appendBooleanAttribute(sb, "enabled", enabled);
+        XmlUtils.appendBooleanAttribute(sb, "focusable", focusable);
+        XmlUtils.appendBooleanAttribute(sb, "focused", focused);
+        XmlUtils.appendBooleanAttribute(sb, "scrollable", scrollable);
+        XmlUtils.appendBooleanAttribute(sb, "long-clickable", longClickable);
+        XmlUtils.appendBooleanAttribute(sb, "password", password);
+        XmlUtils.appendBooleanAttribute(sb, "selected", selected);
+        XmlUtils.appendAttribute(sb, "bounds", getBoundsString());
+        XmlUtils.appendIntAttribute(sb, "drawing-order", drawingOrder);
+        XmlUtils.appendAttribute(sb, "hint", hint);
+
+        // Window metadata (emitted on window root nodes)
+        if (windowId >= 0) {
+            XmlUtils.appendIntAttribute(sb, "window-id", windowId);
+            if (!windowType.isEmpty()) {
+                XmlUtils.appendAttribute(sb, "window-type", windowType);
+            }
+            XmlUtils.appendIntAttribute(sb, "window-layer", windowLayer);
+            if (windowActive) {
+                XmlUtils.appendBooleanAttribute(sb, "window-active", true);
+            }
+            if (windowFocused) {
+                XmlUtils.appendBooleanAttribute(sb, "window-focused", true);
+            }
+        }
+
+        // Extended semantic attributes
+        if (editable) {
+            XmlUtils.appendBooleanAttribute(sb, "editable", true);
+        }
+        if (isHeading) {
+            XmlUtils.appendBooleanAttribute(sb, "heading", true);
+        }
+        if (screenReaderFocusable) {
+            XmlUtils.appendBooleanAttribute(sb, "screen-reader-focusable", true);
+        }
+        if (!stateDescription.isEmpty()) {
+            XmlUtils.appendAttribute(sb, "state-description", stateDescription);
+        }
+        if (!errorText.isEmpty()) {
+            XmlUtils.appendAttribute(sb, "error", errorText);
+        }
+        if (!paneTitle.isEmpty()) {
+            XmlUtils.appendAttribute(sb, "pane-title", paneTitle);
+   
```

**File**: `packages/artemis-accessibility-helper/app/src/main/java/com/artemis/helper/ArtemisAccessibilityService.java` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+package com.artemis.helper;
+
+import android.accessibilityservice.AccessibilityService;
+import android.accessibilityservice.AccessibilityServiceInfo;
+import android.app.Notification;
+import android.app.NotificationChannel;
+import android.app.NotificationManager;
+import android.content.Context;
+import android.content.Intent;
+import android.content.pm.ServiceInfo;
+import android.os.Build;
+import android.util.Log;
+import android.view.accessibility.AccessibilityEvent;
+
+/**
+ * Artemis non-exclusive Accessibility Service with foreground keep-alive support.
+ *
+ * Runs concurrently with any Android UI testing framework (Mobly, Appium, Espresso)
+ * without monopolizing Android's singleton UiAutomationService connection.
+ */
+public class ArtemisAccessibilityService extends AccessibilityService {
+
+    private static final String TAG = "ArtemisA11yService";
+    public static final int DEFAULT_PORT = 18888;
+    private static final String CHANNEL_ID = "artemis_helper_channel";
+    private static final int NOTIFICATION_ID = 18888;
+
+    private static volatile ArtemisAccessibilityService instance;
+
+    private volatile String currentPackageName = "";
+    private volatile String currentActivityName = "";
+    private CommandServer server;
+
+    public static ArtemisAccessibilityService getInstance() {
+        return instance;
+    }
+
+    public String getCurrentPackageName() {
+        return currentPackageName;
+    }
+
+    public String getCurrentActivityName() {
+        return currentActivityName;
+    }
+
+    @Override
+    public void onServiceConnected() {
+        super.onServiceConnected();
+        instance = this;
+        Log.i(TAG, "ArtemisAccessibilityService connected");
+
+        // 1. Start foreground service to resist low-memory killer on aggressive custom ROMs
+        startForegroundNotification();
+
+        // 2. Dynamically enforce flags to guarantee compatibility across custom OEM ROMs
+        try {
+            AccessibilityServiceInfo info = getServiceInfo();
+            if (info == null) {
+                info = new AccessibilityServiceInfo();
+            }
+            info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
+            info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
+            info.notificationTimeout = 50;
+            info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
+                    | AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
+                    | AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
+            setServiceInfo(info);
+            Log.i(TAG, "AccessibilityServiceInfo flags dynamically enforced");
+        } catch (Throwable t) {
+            Log.w(TAG, "Failed to dynamically configure AccessibilityServiceInfo", t);
+        }
+
+        // 3. Start local loopback command server
+        if (server != null) {
+            server.shutdown();
+            server = null;
+        }
+
+        server = new CommandServer(this, DEFAULT_PORT);
+        server.setDaemon(true);
+        server.start();
+        Log.i(TAG, "CommandServer started on port " + DEFAULT_PORT);
+    }
+
+    @Override
+    public int onStartCommand(Intent intent, int flags, int startId) {
+        return START_STICKY;
+    }
+
+    @SuppressWarnings("deprecation")
+    private void startForegroundNotification() {
+        try {
+            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
+            if (nm == null) return;
+
+            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
+                NotificationChannel channel = new NotificationChannel(
+                        CHANNEL_ID,
+                        "Artemis Helper Service",
+                        NotificationManager.IMPORTANCE_LOW
+                );
+                channel.setDescription("Keeps Artemis Accessibility Helper active for automation testing");
+                channel.setShowBadge(false);
+                nm.createNotificationChannel(channel);
+            }
+
+            Notification.Builder builder;
+            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
+                builder = new Notification.Builder(this, CHANNEL_ID);
+            } else {
+                builder = new Notification.Builder(this);
+            }
+
+            builder.setContentTitle("Artemis Accessibility Helper")
+                    .setContentText("Active on 127.0.0.1:" + DEFAULT_PORT)
+                    .setSmallIcon(android.R.drawable.stat_notify_sync)
+                    .setOngoing(true);
+
+            if (Build.VERSION.SDK_INT >= 34) {
+                startForeground(NOTIFICATION_ID, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
+            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
+                startForeground(NOTIFICATION_ID, builder.build(), 0);
+            } else {
+                startForeground(N
```

**File**: `packages/artemis-accessibility-helper/app/src/main/java/com/artemis/helper/CommandServer.java` (added, +302/-0)
```diff
@@ -0,0 +1,302 @@
+package com.artemis.helper;
+
+import android.util.Log;
+import org.json.JSONObject;
+
+import java.io.BufferedReader;
+import java.io.Closeable;
+import java.io.InputStreamReader;
+import java.io.OutputStream;
+import java.net.InetAddress;
+import java.net.InetSocketAddress;
+import java.net.ServerSocket;
+import java.net.Socket;
+import java.nio.charset.StandardCharsets;
+import java.util.concurrent.ExecutorService;
+import java.util.concurrent.Executors;
+
+/**
+ * High-performance, multi-threaded command server bound strictly to loopback (127.0.0.1:18888).
+ * Supports:
+ * - HTTP REST API (/dump, /dump_xml, /hierarchy.xml, /ping, /action)
+ * - Line-delimited JSON-RPC over TCP socket
+ */
+public class CommandServer extends Thread {
+
+    private static final String TAG = "ArtemisCommandServer";
+    private final ArtemisAccessibilityService service;
+    private final int port;
+    private volatile boolean isRunning = true;
+    private ServerSocket serverSocket;
+    private final ExecutorService clientExecutor = Executors.newCachedThreadPool();
+
+    public CommandServer(ArtemisAccessibilityService service, int port) {
+        super("ArtemisCommandServer");
+        this.service = service;
+        this.port = port;
+    }
+
+    @Override
+    public void run() {
+        try {
+            serverSocket = new ServerSocket();
+            serverSocket.setReuseAddress(true);
+            serverSocket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), port), 50);
+            Log.i(TAG, "CommandServer listening on 127.0.0.1:" + port);
+
+            while (isRunning) {
+                final Socket socket;
+                try {
+                    socket = serverSocket.accept();
+                } catch (Exception e) {
+                    if (!isRunning) break;
+                    continue;
+                }
+
+                clientExecutor.execute(new Runnable() {
+                    @Override
+                    public void run() {
+                        handleClient(socket);
+                    }
+                });
+            }
+        } catch (Exception e) {
+            Log.e(TAG, "Server error", e);
+        } finally {
+            closeQuietly(serverSocket);
+        }
+    }
+
+    private void handleClient(Socket socket) {
+        try {
+            socket.setSoTimeout(10000);
+            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
+            OutputStream output = socket.getOutputStream();
+
+            String firstLine = reader.readLine();
+            if (firstLine == null) return;
+            String trimmed = firstLine.trim();
+
+            if (trimmed.startsWith("GET ") || trimmed.startsWith("POST ")) {
+                handleHttp(trimmed, reader, output);
+            } else if (trimmed.startsWith("{")) {
+                handleJsonRpc(trimmed, output);
+            } else {
+                JSONObject err = new JSONObject();
+                err.put("success", false);
+                err.put("error", "Unsupported protocol");
+                sendJsonResponse(output, err.toString());
+            }
+        } catch (Exception e) {
+            Log.w(TAG, "Client handling error: " + e.getMessage());
+        } finally {
+            closeQuietly(socket);
+        }
+    }
+
+    private void handleHttp(String requestLine, BufferedReader reader, OutputStream output) {
+        try {
+            String[] parts = requestLine.split(" ");
+            String path = parts.length > 1 ? parts[1] : "/";
+
+            int contentLength = 0;
+            String line;
+            while ((line = reader.readLine()) != null) {
+                if (line.isEmpty()) break;
+                String lower = line.toLowerCase();
+                if (lower.startsWith("content-length:")) {
+                    try {
+                        contentLength = Integer.parseInt(lower.substring("content-length:".length()).trim());
+                    } catch (Exception ignored) {}
+                }
+            }
+
+            String body = "";
+            if (contentLength > 0) {
+                char[] buf = new char[contentLength];
+                int total = 0;
+                while (total < contentLength) {
+                    int r = reader.read(buf, total, contentLength - total);
+                    if (r < 0) break;
+                    total += r;
+                }
+                body = new String(buf, 0, total);
+            }
+
+            // Route endpoints
+            if (path.startsWith("/snapshot")) {
+                JSONObject json = HierarchyDumper.dumpAtomicSnapshot(service);
+                sendJsonResponse(output, json.toString());
+            } else if (path.equals("/dump_xml") || path.equals("/hierarchy.xml") || path.startsWith("/dump?format=xml")) {
+                String xml = HierarchyDumper.dumpXml(service);
+                sendXmlResponse(out
```

**File**: `packages/artemis-accessibility-helper/app/src/main/java/com/artemis/helper/DisplayUtils.java` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+package com.artemis.helper;
+
+import android.accessibilityservice.AccessibilityService;
+import android.content.Context;
+import android.graphics.Point;
+import android.os.Build;
+import android.util.DisplayMetrics;
+import android.view.Display;
+import android.view.Surface;
+import android.view.WindowManager;
+
+/**
+ * Universal display and orientation utilities compatible across all Android versions (API 24 - 37+).
+ */
+public final class DisplayUtils {
+
+    private DisplayUtils() {}
+
+    public static class DisplayInfo {
+        public final int rotation;
+        public final int width;
+        public final int height;
+
+        public DisplayInfo(int rotation, int width, int height) {
+            this.rotation = rotation;
+            this.width = width;
+            this.height = height;
+        }
+    }
+
+    /**
+     * Obtains the display orientation (0, 1, 2, 3) and screen dimensions (width, height)
+     * using the most reliable API for the current Android runtime.
+     */
+    @SuppressWarnings("deprecation")
+    public static DisplayInfo getDisplayInfo(AccessibilityService service) {
+        int rotation = 0;
+        int width = 1080;
+        int height = 2400;
+
+        // Baseline initialization from resources metrics (handles tablets, TVs, emulators dynamically)
+        try {
+            DisplayMetrics resDm = service.getResources().getDisplayMetrics();
+            if (resDm != null && resDm.widthPixels > 0 && resDm.heightPixels > 0) {
+                width = resDm.widthPixels;
+                height = resDm.heightPixels;
+            }
+        } catch (Throwable ignored) {}
+
+        try {
+            // Modern API 30+ window metrics for full physical screen dimensions
+            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
+                try {
+                    WindowManager wm = (WindowManager) service.getSystemService(Context.WINDOW_SERVICE);
+                    if (wm != null) {
+                        android.graphics.Rect bounds = wm.getMaximumWindowMetrics().getBounds();
+                        if (bounds.width() > 0 && bounds.height() > 0) {
+                            width = bounds.width();
+                            height = bounds.height();
+                        }
+                    }
+                } catch (Throwable ignored) {}
+            }
+
+            // Resolve Display instance for rotation and legacy metrics
+            Display display = null;
+            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
+                try {
+                    display = service.getDisplay();
+                } catch (Throwable ignored) {}
+            }
+
+            if (display == null) {
+                WindowManager wm = (WindowManager) service.getSystemService(Context.WINDOW_SERVICE);
+                if (wm != null) {
+                    display = wm.getDefaultDisplay();
+                }
+            }
+
+            if (display != null) {
+                int r = display.getRotation();
+                switch (r) {
+                    case Surface.ROTATION_0:
+                        rotation = 0;
+                        break;
+                    case Surface.ROTATION_90:
+                        rotation = 1;
+                        break;
+                    case Surface.ROTATION_180:
+                        rotation = 2;
+                        break;
+                    case Surface.ROTATION_270:
+                        rotation = 3;
+                        break;
+                    default:
+                        rotation = 0;
+                        break;
+                }
+
+                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
+                    DisplayMetrics dm = new DisplayMetrics();
+                    display.getRealMetrics(dm);
+                    width = dm.widthPixels;
+                    height = dm.heightPixels;
+                }
+            }
+        } catch (Throwable ignored) {}
+
+        return new DisplayInfo(rotation, width, height);
+    }
+}
```

---

### Incident Patch 8: `38a2de6a` (2026-09-10)
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
             winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements --silent 2>$null | Out-Null
         }
         if ($missingTools -contains "scrcpy") {
-            Write-Host "   📦 Installing Genymobile.scrcpy..." -ForegroundColor Cyan
+            Write-Host "   [INFO] Installing Genymobile.scrcpy..." -ForegroundColor Cyan
             winget install --id Genymobile.scrcpy -e --accept-source-agreements --accept-package-agreements --silent 2>$null | Out-Null
         }
         Update-EnvironmentPath
@@ -368,30 +368,30 @@ if (-not (Test-CommandExists "uv")) {
 
 if (Test-CommandExists "uv") {
     $uvVer = uv --version
-    Write-Host "   ✔ uv is ready ($uvVer)" -ForegroundColor Green
+    Write-Host "   [OK] uv is ready ($uvVer)" -ForegroundColor Green
 } else {
-    Write-Host "   ✗ Failed to detect uv in PATH." -ForegroundColor Red
+    Write-Host "   [FAIL] Failed to detect uv in PATH." -ForegroundColor Red
     Exit 1
 }
 
 # 3. Setup Python Runtime & Sync Dependencies
 Write-Host "`n3. Co
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

### Incident Patch 9: `611d1a09` (2026-09-05)
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
+        [Parameter(Mandatory=$true)][string]$Uri,
+        [Parameter(Mandatory=$true)][string]$OutFile,
+        [int]$TimeoutSec = 45
+    )
+    if (Test-Path $OutFile) {
+        Remove-Item -Path $OutFile -Force -ErrorAction SilentlyContinue
+    }
+
+    # 1. Try Windows built-in curl.exe first (available in Win 10 1803+ and Win 11)
+    if (Test-CommandExists "curl.exe") {
+        try {
+            & curl.exe -f -sSL --connect-timeout 5 --max-time $TimeoutSec "$Uri" -o "$OutFile" 2>$null
+            if ($LASTEXITCODE -eq 0 -and (Test-Path $OutFile) -and ((Get-Item $OutFile).Length -gt 0)) {
+                return $true
+            }
+        } catch {}
+        if (Test-Path $OutFile) {
+            Remove-Item -Path $OutFile -Force -ErrorAction SilentlyContinue
+        }
+    }
+
+    # 2. Fallback to Invoke-WebRequest (suppressing progress bar to eliminate PowerShell buffer hangs)
+    try {
+        $prevProgress = $ProgressPreference
+        $ProgressPreference = 'SilentlyContinue'
+    
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
+    if (Test-Path $OutFile) {
+        Remove-Item -Path $OutFile -Force -ErrorAction SilentlyContinue
+    }
+
+    # 1. Try Windows built-in curl.exe first (available in Win 10 1803+ and Win 11)
+    if (Test-CommandExists "curl.exe") {
+        try {
+            & curl.exe -f -sSL --connect-timeout 5 --max-time $TimeoutSec "$Uri" -o "$OutFile" 2>$null
+            if ($LASTEXITCODE -eq 0 -and (Test-Path $OutFile) -and ((Get-Item $OutFile).Length -gt 0)) {
+                return $true
+            }
+        } catch {}
+        if (Test-Path $OutFile) {
+            Remove-Item -Path $OutFile -Force -ErrorAction SilentlyContinue
+        }
+    }
+
+    # 2. Fallback to Invoke-WebRequest (suppressing progress bar to eliminate PowerShell buffer hangs)
+    try {
+        $prevProgress = $ProgressPreference
+        $ProgressPreference = 'SilentlyContinue'
+        Invoke-WebRequest -Uri $Uri -OutFile $OutFile -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
+        $ProgressPreference = $prevPro
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

### Incident Patch 10: `739c1c29` (2026-09-05)
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

### Incident Patch 11: `2e66ac5b` (2026-09-05)
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

### Incident Patch 12: `afbc4022` (2026-09-05)
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

---

### Incident Patch 13: `29622bae` (2026-09-05)
**Commit Message**: fix: auto-detect and upgrade Node.js to >= 22.22.0 across Linux, macOS and Windows

- Add smart Node.js compatibility checking (>= 22.22.0) required by Angular CLI 22
- Upgrade portable Node.js fallback download to v22.23.2 LTS across Linux, macOS and Windows
- Add automatic upgrade paths using nvm, NodeSource 22.x (with sudo/root), and winget
- Display detected Node.js version in toolchain readiness summary

**File**: `scripts/install_deps.ps1` (modified, +75/-23)
```diff
@@ -107,17 +107,44 @@ function Install-PortablePlatformTools {
     return $false
 }
 
+function Test-NodeCompatible {
+    if (-not (Test-CommandExists "node") -or -not (Test-CommandExists "npm")) { return $false }
+    try {
+        $verRaw = (& node -v 2>$null)
+        if (-not $verRaw) { return $false }
+        $verStr = $verRaw.ToString().Trim().TrimStart('v')
+        $parts = $verStr.Split('.')
+        if ($parts.Count -ge 2) {
+            $major = [int]$parts[0]
+            $minor = [int]$parts[1]
+            if ($major -ge 26) { return $true }
+            if ($major -ge 24 -and $minor -ge 15) { return $true }
+            if ($major -ge 22 -and $minor -ge 22) { return $true }
+        }
+    } catch {
+        return $false
+    }
+    return $false
+}
+
 function Install-PortableNode {
     $nodeDir = "$env:LOCALAPPDATA\Programs\node"
     if (Test-Path "$nodeDir\node.exe") {
         $env:PATH = "$nodeDir;$env:PATH"
-        return $true
+        if (Test-NodeCompatible) {
+            return $true
+        }
     }
-    Write-Host "   [INFO] Installing portable Node.js LTS in user space..." -ForegroundColor Cyan
+    Write-Host "   [INFO] Installing portable Node.js LTS (v22.23.2) in user space..." -ForegroundColor Cyan
     try {
-        $zipPath = "$env:TEMP\node-v20-win-x64.zip"
-        Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.3/node-v20.18.3-win-x64.zip" -OutFile $zipPath -UseBasicParsing
+        $nodeVer = "v22.23.2"
+        $arch = if ([System.Environment]::Is64BitOperatingSystem) {
+            if ($env:PROCESSOR_ARCHITECTURE -match "ARM64") { "arm64" } else { "x64" }
+        } else { "x64" }
+        $zipPath = "$env:TEMP\node-$nodeVer-win-$arch.zip"
+        Invoke-WebRequest -Uri "https://nodejs.org/dist/$nodeVer/node-$nodeVer-win-$arch.zip" -OutFile $zipPath -UseBasicParsing
         $extractDir = "$env:TEMP\node_extract"
+        if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
         New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
         Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
         $extractedFolder = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
@@ -130,7 +157,7 @@ function Install-PortableNode {
         Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
         if (Test-Path "$nodeDir\node.exe") {
             $env:PATH = "$nodeDir;$env:PATH"
-            Write-Host "   ✔ Portable Node.js installed in user space." -ForegroundColor Green
+            Write-Host "   ✔ Portable Node.js $nodeVer installed in user space." -ForegroundColor Green
             return $true
         }
     } catch {
@@ -243,32 +270,52 @@ $ShowcaseIndex = "$RootDir\apps\showcase_ui\dist\frontend\browser\index.html"
 $ShowcaseIndexAlt1 = "$RootDir\apps\showcase_ui\dist\browser\index.html"
 $ShowcaseIndexAlt2 = "$RootDir\apps\showcase_ui\dist\index.html"
 if ((-not (Test-Path $ShowcaseIndex)) -and (-not (Test-Path $ShowcaseIndexAlt1)) -and (-not (Test-Path $ShowcaseIndexAlt2))) {
-    if (-not (Test-CommandExists "npm")) {
-        $useWinGetNode = $false
-        if (Test-CommandExists "winget") {
-            if ([Console]::IsInputRedirected -eq $false) {
-                $ans = Read-Host "   Install Node.js via WinGet (may require Administrator)? [Y/n]"
-                if ($ans -eq "" -or $ans -match "^[Yy]") {
+    if (-not (Test-NodeCompatible)) {
+        if (Test-CommandExists "node") {
+            $curVer = (& node -v 2>$null)
+            Write-Host "   ⚡ Detected Node.js $curVer, but Angular CLI requires Node.js >= v22.22.0." -ForegroundColor Yellow
+        } else {
+            Write-Host "   ⚡ Node.js/npm not found (required for Showcase UI)." -ForegroundColor Cyan
+        }
+
+        # 1. Try nvm if available on Windows
+        if (Test-CommandExists "nvm") {
+            Write-Host "   📦 Installing Node.js 22 LTS via nvm..." -ForegroundColor Cyan
+            & nvm install 22.23.2 | Out-Null
+            & nvm use 22.23.2 | Out-Null
+            Update-EnvironmentPath
+        }
+
+        # 2. Try WinGet
+        if (-not (Test-NodeCompatible)) {
+            $useWinGetNode = $false
+            if (Test-CommandExists "winget") {
+                if ([Console]::IsInputRedirected -eq $false) {
+                    $ans = Read-Host "   Install/Upgrade Node.js via WinGet (may require Administrator)? [Y/n]"
+                    if ($ans -eq "" -or $ans -match "^[Yy]") {
+                        $useWinGetNode = $true
+                    }
+                } else {
                     $useWinGetNode = $true
                 }
-            } else {
-                $useWinGetNode = $true
             }
-        }
 
-        if ($useWinGetNode) {
-            Write-Host "   ⚡ Node.js/npm not found. Installing Node.js LTS via WinGet..." -ForegroundColor Cyan
-            winget install --id OpenJS.NodeJS.LTS -e --accept-sour
```

**File**: `scripts/install_deps.sh` (modified, +87/-30)
```diff
@@ -115,6 +115,27 @@ request_sudo() {
     return 1
 }
 
+# Helper to check if Node.js & npm meet Angular CLI 22 requirement (>= 22.22.0, >= 24.15.0, or >= 26.0.0)
+is_node_compatible() {
+    if ! has_cmd node || ! has_cmd npm; then
+        return 1
+    fi
+    local node_ver
+    node_ver="$(node -v 2>/dev/null | tr -d 'v')"
+    [ -z "${node_ver}" ] && return 1
+    local major minor
+    major="$(echo "${node_ver}" | cut -d. -f1)"
+    minor="$(echo "${node_ver}" | cut -d. -f2)"
+    if [ "${major}" -ge 26 ] 2>/dev/null; then
+        return 0
+    elif [ "${major}" -ge 24 ] 2>/dev/null; then
+        [ "${minor}" -ge 15 ] 2>/dev/null && return 0
+    elif [ "${major}" -ge 22 ] 2>/dev/null; then
+        [ "${minor}" -ge 22 ] 2>/dev/null && return 0
+    fi
+    return 1
+}
+
 echo -e "${BOLD}1. Detecting Operating System & Environment...${NC}"
 echo -e "   Platform: ${BLUE}${OS_TYPE}${NC} (${ARCH_TYPE})"
 echo -e "   Root Dir: ${DIM}${ROOT_DIR}${NC}"
@@ -346,48 +367,78 @@ setup_showcase_ui() {
             export PATH="${HOME}/.local/share/node/bin:${PATH}"
         fi
 
-        if ! has_cmd npm; then
-            echo -e "   ${YELLOW}⚡ npm/Node.js not found. Auto-installing Node.js...${NC}"
-            if [ "${OS_TYPE}" = "Darwin" ] && has_cmd brew; then
-                brew install node >/dev/null 2>&1 || true
-            elif [ "${OS_TYPE}" = "Linux" ]; then
-                if request_sudo "install Node.js and npm"; then
+        # Check if nvm already has a compatible Node version installed
+        if ! is_node_compatible && (command -v nvm >/dev/null 2>&1 || type nvm >/dev/null 2>&1); then
+            nvm use 22 >/dev/null 2>&1 || true
+        fi
+
+        if ! is_node_compatible; then
+            if has_cmd node; then
+                local current_node="$(node -v 2>/dev/null)"
+                echo -e "   ${YELLOW}⚡ Detected Node.js ${current_node}, but Angular CLI requires Node.js >= v22.22.0. Upgrading Node.js...${NC}"
+            else
+                echo -e "   ${YELLOW}⚡ Node.js/npm not found. Auto-installing Node.js 22 LTS for Showcase UI compilation...${NC}"
+            fi
+
+            # 1. Try installing Node 22 via nvm if available
+            if command -v nvm >/dev/null 2>&1 || type nvm >/dev/null 2>&1; then
+                echo -e "   ${CYAN}📦 Installing Node.js 22 LTS via nvm...${NC}"
+                nvm install 22 >/dev/null 2>&1 || true
+                nvm use 22 >/dev/null 2>&1 || true
+            fi
+
+            # 2. Try brew on macOS
+            if ! is_node_compatible && [ "${OS_TYPE}" = "Darwin" ] && has_cmd brew; then
+                brew install node >/dev/null 2>&1 || brew upgrade node >/dev/null 2>&1 || true
+            fi
+
+            # 3. Try Linux package managers with sudo / root
+            if ! is_node_compatible && [ "${OS_TYPE}" = "Linux" ]; then
+                if request_sudo "install or upgrade Node.js to >= 22.22.0"; then
                     local SUDO_PREFIX=""
                     if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
                     if has_cmd apt-get; then
-                        ${SUDO_PREFIX} apt-get update -qq && ${SUDO_PREFIX} apt-get install -y -qq nodejs npm || true
+                        echo -e "   ${CYAN}📦 Configuring NodeSource Node.js 22 LTS repository...${NC}"
+                        curl -fsSL https://deb.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
+                        ${SUDO_PREFIX} apt-get install -y -qq nodejs || true
                     elif has_cmd dnf; then
-                        ${SUDO_PREFIX} dnf install -y nodejs npm || true
+                        curl -fsSL https://rpm.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
+                        ${SUDO_PREFIX} dnf install -y nodejs || true
                     elif has_cmd pacman; then
                         ${SUDO_PREFIX} pacman -S --noconfirm nodejs npm || true
                     fi
                 fi
+            fi
 
-                # If still not found, download portable Node.js into user space
-                if ! has_cmd npm; then
-                    local ARCH="$(uname -m)"
-                    local NODE_ARCH=""
-                    case "${ARCH}" in
-                        x86_64|amd64) NODE_ARCH="x64" ;;
-                        aarch64|arm64) NODE_ARCH="arm64" ;;
-                    esac
-                    if [ -n "${NODE_ARCH}" ]; then
-                        local NODE_VER="v20.18.3"
-                        local NODE_DIR="${HOME}/.local/share/node"
-                        echo -e "   ${CYAN}📦 Installing portable Node.js ${NODE_VER} in user space (~/.local)...${NC}"
-                        mkdir -p "${NODE_DIR}" "${HOME}/.local/bin"
-                        if curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-linux-${NODE_ARCH}.tar.gz" | tar -xz -C "${NODE_DIR}" --strip-components=1 2>/dev/null; then
-                     
```

**File**: `scripts/start.ps1` (modified, +70/-23)
```diff
@@ -102,17 +102,44 @@ function Install-PortablePlatformTools {
     return $false
 }
 
+function Test-NodeCompatible {
+    if (-not (Test-CommandExists "node") -or -not (Test-CommandExists "npm")) { return $false }
+    try {
+        $verRaw = (& node -v 2>$null)
+        if (-not $verRaw) { return $false }
+        $verStr = $verRaw.ToString().Trim().TrimStart('v')
+        $parts = $verStr.Split('.')
+        if ($parts.Count -ge 2) {
+            $major = [int]$parts[0]
+            $minor = [int]$parts[1]
+            if ($major -ge 26) { return $true }
+            if ($major -ge 24 -and $minor -ge 15) { return $true }
+            if ($major -ge 22 -and $minor -ge 22) { return $true }
+        }
+    } catch {
+        return $false
+    }
+    return $false
+}
+
 function Install-PortableNode {
     $nodeDir = "$env:LOCALAPPDATA\Programs\node"
     if (Test-Path "$nodeDir\node.exe") {
         $env:PATH = "$nodeDir;$env:PATH"
-        return $true
+        if (Test-NodeCompatible) {
+            return $true
+        }
     }
-    Write-Host "   [INFO] Installing portable Node.js LTS in user space..." -ForegroundColor Cyan
+    Write-Host "   [INFO] Installing portable Node.js LTS (v22.23.2) in user space..." -ForegroundColor Cyan
     try {
-        $zipPath = "$env:TEMP\node-v20-win-x64.zip"
-        Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.3/node-v20.18.3-win-x64.zip" -OutFile $zipPath -UseBasicParsing
+        $nodeVer = "v22.23.2"
+        $arch = if ([System.Environment]::Is64BitOperatingSystem) {
+            if ($env:PROCESSOR_ARCHITECTURE -match "ARM64") { "arm64" } else { "x64" }
+        } else { "x64" }
+        $zipPath = "$env:TEMP\node-$nodeVer-win-$arch.zip"
+        Invoke-WebRequest -Uri "https://nodejs.org/dist/$nodeVer/node-$nodeVer-win-$arch.zip" -OutFile $zipPath -UseBasicParsing
         $extractDir = "$env:TEMP\node_extract"
+        if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
         New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
         Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
         $extractedFolder = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
@@ -125,7 +152,7 @@ function Install-PortableNode {
         Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
         if (Test-Path "$nodeDir\node.exe") {
             $env:PATH = "$nodeDir;$env:PATH"
-            Write-Host "   [OK] Portable Node.js installed in user space." -ForegroundColor Green
+            Write-Host "   [OK] Portable Node.js $nodeVer installed in user space." -ForegroundColor Green
             return $true
         }
     } catch {
@@ -206,33 +233,53 @@ $ShowcaseIndex = "$RootDir\apps\showcase_ui\dist\frontend\browser\index.html"
 $ShowcaseIndexAlt1 = "$RootDir\apps\showcase_ui\dist\browser\index.html"
 $ShowcaseIndexAlt2 = "$RootDir\apps\showcase_ui\dist\index.html"
 if ((-not (Test-Path $ShowcaseIndex)) -and (-not (Test-Path $ShowcaseIndexAlt1)) -and (-not (Test-Path $ShowcaseIndexAlt2))) {
-    if (-not (Test-CommandExists "npm")) {
-        $useWinGetNode = $false
-        if (Test-CommandExists "winget") {
-            if ([Console]::IsInputRedirected -eq $false) {
-                Write-Host "   [INFO] Node.js/npm not found (required for Showcase UI)." -ForegroundColor Cyan
-                $ans = Read-Host "      Install Node.js via WinGet (may require Administrator)? [Y/n]"
-                if ($ans -eq "" -or $ans -match "^[Yy]") {
+    if (-not (Test-NodeCompatible)) {
+        if (Test-CommandExists "node") {
+            $curVer = (& node -v 2>$null)
+            Write-Host "   [INFO] Detected Node.js $curVer, but Angular CLI requires Node.js >= v22.22.0." -ForegroundColor Yellow
+        } else {
+            Write-Host "   [INFO] Node.js/npm not found (required for Showcase UI)." -ForegroundColor Cyan
+        }
+
+        # 1. Try nvm if available on Windows
+        if (Test-CommandExists "nvm") {
+            Write-Host "   [INFO] Installing Node.js 22 LTS via nvm..." -ForegroundColor Cyan
+            & nvm install 22.23.2 | Out-Null
+            & nvm use 22.23.2 | Out-Null
+            Update-EnvironmentPath
+        }
+
+        # 2. Try WinGet
+        if (-not (Test-NodeCompatible)) {
+            $useWinGetNode = $false
+            if (Test-CommandExists "winget") {
+                if ([Console]::IsInputRedirected -eq $false) {
+                    Write-Host "   [INFO] Node.js >= v22.22.0 required for Showcase UI." -ForegroundColor Cyan
+                    $ans = Read-Host "      Install/Upgrade Node.js via WinGet (may require Administrator)? [Y/n]"
+                    if ($ans -eq "" -or $ans -match "^[Yy]") {
+                        $useWinGetNode = $true
+                    }
+                } else {
                     $useWinGetNode = $true
                 }
-            } else {
-                $useWinGetNo
```

**File**: `start.sh` (modified, +79/-30)
```diff
@@ -94,6 +94,27 @@ request_sudo() {
     return 1
 }
 
+# Helper to check if Node.js & npm meet Angular CLI 22 requirement (>= 22.22.0, >= 24.15.0, or >= 26.0.0)
+is_node_compatible() {
+    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
+        return 1
+    fi
+    local node_ver
+    node_ver="$(node -v 2>/dev/null | tr -d 'v')"
+    [ -z "${node_ver}" ] && return 1
+    local major minor
+    major="$(echo "${node_ver}" | cut -d. -f1)"
+    minor="$(echo "${node_ver}" | cut -d. -f2)"
+    if [ "${major}" -ge 26 ] 2>/dev/null; then
+        return 0
+    elif [ "${major}" -ge 24 ] 2>/dev/null; then
+        [ "${minor}" -ge 15 ] 2>/dev/null && return 0
+    elif [ "${major}" -ge 22 ] 2>/dev/null; then
+        [ "${minor}" -ge 22 ] 2>/dev/null && return 0
+    fi
+    return 1
+}
+
 # 2. Check or install uv (Fast Python package manager)
 if ! command -v uv >/dev/null 2>&1; then
     echo -e "${YELLOW}⚡ uv not found. Installing Astral uv...${NC}"
@@ -226,50 +247,78 @@ if [ ! -f "${SHOWCASE_INDEX}" ] && [ ! -f "${SHOWCASE_INDEX_ALT1}" ] && [ ! -f "
         export PATH="${HOME}/.local/share/node/bin:${PATH}"
     fi
 
-    if ! command -v npm >/dev/null 2>&1; then
+    # Check if nvm already has a compatible Node version installed
+    if ! is_node_compatible && (command -v nvm >/dev/null 2>&1 || type nvm >/dev/null 2>&1); then
+        nvm use 22 >/dev/null 2>&1 || true
+    fi
+
+    if ! is_node_compatible; then
         OS_NAME="$(uname -s)"
-        echo -e "   ${YELLOW}⚡ npm/Node.js not found. Auto-installing Node.js for Showcase UI compilation...${NC}"
-        if [ "${OS_NAME}" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
-            brew install node >/dev/null 2>&1 || true
-        elif [ "${OS_NAME}" = "Linux" ]; then
-            if request_sudo "install Node.js and npm"; then
+        if command -v node >/dev/null 2>&1; then
+            echo -e "   ${YELLOW}⚡ Detected Node.js $(node -v 2>/dev/null), but Angular CLI requires Node.js >= v22.22.0. Upgrading Node.js...${NC}"
+        else
+            echo -e "   ${YELLOW}⚡ Node.js/npm not found. Auto-installing Node.js 22 LTS for Showcase UI compilation...${NC}"
+        fi
+
+        # 1. Try installing Node 22 via nvm if available
+        if command -v nvm >/dev/null 2>&1 || type nvm >/dev/null 2>&1; then
+            echo -e "   ${CYAN}📦 Installing Node.js 22 LTS via nvm...${NC}"
+            nvm install 22 >/dev/null 2>&1 || true
+            nvm use 22 >/dev/null 2>&1 || true
+        fi
+
+        # 2. Try brew on macOS
+        if ! is_node_compatible && [ "${OS_NAME}" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
+            brew install node >/dev/null 2>&1 || brew upgrade node >/dev/null 2>&1 || true
+        fi
+
+        # 3. Try Linux package managers with sudo / root
+        if ! is_node_compatible && [ "${OS_NAME}" = "Linux" ]; then
+            if request_sudo "install or upgrade Node.js to >= 22.22.0"; then
                 SUDO_PREFIX=""
                 if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
                 if command -v apt-get >/dev/null 2>&1; then
-                    ${SUDO_PREFIX} apt-get update -qq && ${SUDO_PREFIX} apt-get install -y -qq nodejs npm || true
+                    echo -e "   ${CYAN}📦 Configuring NodeSource Node.js 22 LTS repository...${NC}"
+                    curl -fsSL https://deb.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
+                    ${SUDO_PREFIX} apt-get install -y -qq nodejs || true
                 elif command -v dnf >/dev/null 2>&1; then
-                    ${SUDO_PREFIX} dnf install -y nodejs npm || true
+                    curl -fsSL https://rpm.nodesource.com/setup_22.x | ${SUDO_PREFIX} bash - >/dev/null 2>&1 || true
+                    ${SUDO_PREFIX} dnf install -y nodejs || true
                 elif command -v pacman >/dev/null 2>&1; then
                     ${SUDO_PREFIX} pacman -S --noconfirm nodejs npm || true
                 fi
             fi
+        fi
 
-            # If npm still not found (e.g. no root/sudo privileges on cloud workstation):
-            if ! command -v npm >/dev/null 2>&1; then
-                ARCH="$(uname -m)"
-                NODE_ARCH=""
-                case "${ARCH}" in
-                    x86_64|amd64) NODE_ARCH="x64" ;;
-                    aarch64|arm64) NODE_ARCH="arm64" ;;
-                esac
-                if [ -n "${NODE_ARCH}" ]; then
-                    NODE_VER="v20.18.3"
-                    NODE_DIR="${HOME}/.local/share/node"
-                    echo -e "   ${CYAN}📦 Installing portable Node.js ${NODE_VER} in user space (~/.local)...${NC}"
-                    mkdir -p "${NODE_DIR}" "${HOME}/.local/bin"
-                    if curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-linux-${NODE_ARCH}.tar.gz" | tar -xz -C "${NODE_DIR}" --strip-components=1 2>/dev/null; then
-                        ln -sf "${NODE_DI
```

---

### Incident Patch 14: `41b1b947` (2026-09-04)
**Commit Message**: fix: auto-start local adb daemon and optimize path discovery across Linux, macOS and Windows

**File**: `artemis/core/diagnostics/adb_keys.py` (modified, +5/-0)
```diff
@@ -211,24 +211,29 @@ def heal_adb_keys(adb_path: str | None = None, force: bool = False) -> dict[str,
 
     # Restart ADB server to trigger key generation
     try:
+        clean_env = os.environ.copy()
+        clean_env.pop("ADB_SERVER_SOCKET", None)
         subprocess.run(
             [resolved_adb, "kill-server"],
             stdout=subprocess.DEVNULL,
             stderr=subprocess.DEVNULL,
             timeout=5,
+            env=clean_env,
         )
         subprocess.run(
             [resolved_adb, "start-server"],
             stdout=subprocess.DEVNULL,
             stderr=subprocess.DEVNULL,
             timeout=5,
+            env=clean_env,
         )
         # Execute adb devices to trigger initial handshake & key material generation if needed
         subprocess.run(
             [resolved_adb, "devices"],
             stdout=subprocess.DEVNULL,
             stderr=subprocess.DEVNULL,
             timeout=5,
+            env=clean_env,
         )
     except Exception as e:
         logger.error(f"Error restarting ADB server during key healing: {e}")
```

**File**: `artemis/core/diagnostics/engine.py` (modified, +4/-0)
```diff
@@ -246,17 +246,21 @@ def _restart_sync():
                 return heal_adb_keys(adb_path=adb_path)
 
             try:
+                clean_env = os.environ.copy()
+                clean_env.pop("ADB_SERVER_SOCKET", None)
                 subprocess.run(
                     [adb_path, "kill-server"],
                     stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL,
                     timeout=5,
+                    env=clean_env,
                 )
                 res = subprocess.run(
                     [adb_path, "start-server"],
                     stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL,
                     timeout=5,
+                    env=clean_env,
                 )
                 success = res.returncode == 0
                 return {
```

**File**: `artemis/runtime/device_pool.py` (modified, +3/-0)
```diff
@@ -247,11 +247,14 @@ async def _start_adb_server(self, timeout: float) -> None:
             return
         proc = None
         try:
+            clean_env = os.environ.copy()
+            clean_env.pop("ADB_SERVER_SOCKET", None)
             proc = await asyncio.create_subprocess_exec(
                 adb,
                 "start-server",
                 stdout=subprocess.PIPE,
                 stderr=subprocess.PIPE,
+                env=clean_env,
             )
             await asyncio.wait_for(proc.communicate(), timeout=timeout)
         except Exception as exc:
```

**File**: `scripts/install_deps.ps1` (modified, +25/-0)
```diff
@@ -39,24 +39,44 @@ function Update-EnvironmentPath {
     $standardDirs = @(
         "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
         "$env:LOCALAPPDATA\Android\Sdk\platform-tools",
+        "$env:LOCALAPPDATA\Android\android-sdk\platform-tools",
         "$env:ProgramFiles\Android\platform-tools",
+        "${env:ProgramFiles(x86)}\Android\android-sdk\platform-tools",
         "$env:ProgramFiles\nodejs",
         "${env:ProgramFiles(x86)}\nodejs",
         "$env:APPDATA\npm",
         "$env:LOCALAPPDATA\Programs\platform-tools",
         "$env:LOCALAPPDATA\Programs\node",
         "$env:USERPROFILE\.local\share\platform-tools",
         "$env:USERPROFILE\.local\share\node",
+        "$env:LOCALAPPDATA\nvm",
+        "$env:ProgramData\nvm",
         "C:\ProgramData\chocolatey\bin",
         "$env:USERPROFILE\scoop\shims",
         "$env:USERPROFILE\.local\bin",
         "$env:USERPROFILE\.cargo\bin"
     )
+    if ($env:ANDROID_HOME) { $standardDirs += "$env:ANDROID_HOME\platform-tools" }
+    if ($env:ANDROID_SDK_ROOT) { $standardDirs += "$env:ANDROID_SDK_ROOT\platform-tools" }
+    if ($env:NVM_HOME) { $standardDirs += $env:NVM_HOME }
+    if ($env:NVM_SYMLINK) { $standardDirs += $env:NVM_SYMLINK }
+
     $regPath = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine")
     $currentPaths = ($env:PATH -split ";") + ($regPath -split ";") + $standardDirs | Where-Object { [string]::IsNullOrWhiteSpace($_) -eq $false -and (Test-Path $_) } | Select-Object -Unique
     $env:PATH = $currentPaths -join ";"
 }
 
+function Start-LocalAdbServer {
+    if (Test-CommandExists "adb") {
+        try {
+            $origSocket = $env:ADB_SERVER_SOCKET
+            Remove-Item Env:\ADB_SERVER_SOCKET -ErrorAction SilentlyContinue
+            & adb start-server 2>$null | Out-Null
+            if ($origSocket) { $env:ADB_SERVER_SOCKET = $origSocket }
+        } catch {}
+    }
+}
+
 function Test-CommandExists {
     param([string]$Command)
     $res = Get-Command $Command -ErrorAction SilentlyContinue
@@ -132,6 +152,7 @@ if (-not (Test-CommandExists "scrcpy")) { $missingTools += "scrcpy" }
 
 if ($missingTools.Count -eq 0) {
     Write-Host "   ✔ All system toolchains are already installed (ADB, FFmpeg, scrcpy)." -ForegroundColor Green
+    Start-LocalAdbServer
 } else {
     Write-Host "   ! Missing toolchains: $($missingTools -join ', ')" -ForegroundColor DarkYellow
     $useWinGet = $false
@@ -175,6 +196,9 @@ if ($missingTools.Count -eq 0) {
     if (-not (Test-CommandExists "adb")) {
         Install-PortablePlatformTools
     }
+
+    # Ensure local ADB daemon is warm & listening
+    Start-LocalAdbServer
 }
 
 # 2. Check and Install uv (Fast Python Package Manager)
@@ -285,6 +309,7 @@ Write-Host "   ✨ Artemis Environment Ready!                      " -Foreground
 Write-Host "======================================================" -ForegroundColor Cyan
 
 if ($Launch -or $Open) {
+    Start-LocalAdbServer
     Write-Host "🚀 Launching Showcase UI..." -ForegroundColor Green
     uv run artemis ui --open
 } else {
```

**File**: `scripts/install_deps.sh` (modified, +24/-0)
```diff
@@ -127,12 +127,31 @@ install_system_packages() {
     local need_ffmpeg=false
     local need_scrcpy=false
 
+    if ! has_cmd adb; then
+        for candidate in \
+            "${ANDROID_HOME:-}/platform-tools" \
+            "${ANDROID_SDK_ROOT:-}/platform-tools" \
+            "${HOME}/Library/Android/sdk/platform-tools" \
+            "${HOME}/Android/Sdk/platform-tools" \
+            "${HOME}/.local/share/platform-tools" \
+            "/opt/homebrew/bin" \
+            "/usr/local/bin"; do
+            if [ -n "${candidate}" ] && [ -x "${candidate}/adb" ]; then
+                export PATH="${candidate}:${PATH}"
+                break
+            fi
+        done
+    fi
+
     if ! has_cmd adb; then need_adb=true; fi
     if ! has_cmd ffmpeg; then need_ffmpeg=true; fi
     if ! has_cmd scrcpy; then need_scrcpy=true; fi
 
     if [ "${need_adb}" = false ] && [ "${need_ffmpeg}" = false ] && [ "${need_scrcpy}" = false ]; then
         echo -e "   ${GREEN}✓ All core system tools are already installed.${NC}"
+        if has_cmd adb; then
+            (unset ADB_SERVER_SOCKET; adb start-server >/dev/null 2>&1 || true)
+        fi
         return 0
     fi
 
@@ -234,6 +253,11 @@ install_system_packages() {
             fi
         fi
     fi
+
+    # Ensure local ADB daemon is warm & listening
+    if has_cmd adb; then
+        (unset ADB_SERVER_SOCKET; adb start-server >/dev/null 2>&1 || true)
+    fi
 }
 
 # Function to ensure uv is installed and ready
```

**File**: `scripts/start.ps1` (modified, +26/-0)
```diff
@@ -34,24 +34,44 @@ function Update-EnvironmentPath {
     $standardDirs = @(
         "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
         "$env:LOCALAPPDATA\Android\Sdk\platform-tools",
+        "$env:LOCALAPPDATA\Android\android-sdk\platform-tools",
         "$env:ProgramFiles\Android\platform-tools",
+        "${env:ProgramFiles(x86)}\Android\android-sdk\platform-tools",
         "$env:ProgramFiles\nodejs",
         "${env:ProgramFiles(x86)}\nodejs",
         "$env:APPDATA\npm",
         "$env:LOCALAPPDATA\Programs\platform-tools",
         "$env:LOCALAPPDATA\Programs\node",
         "$env:USERPROFILE\.local\share\platform-tools",
         "$env:USERPROFILE\.local\share\node",
+        "$env:LOCALAPPDATA\nvm",
+        "$env:ProgramData\nvm",
         "C:\ProgramData\chocolatey\bin",
         "$env:USERPROFILE\scoop\shims",
         "$env:USERPROFILE\.local\bin",
         "$env:USERPROFILE\.cargo\bin"
     )
+    if ($env:ANDROID_HOME) { $standardDirs += "$env:ANDROID_HOME\platform-tools" }
+    if ($env:ANDROID_SDK_ROOT) { $standardDirs += "$env:ANDROID_SDK_ROOT\platform-tools" }
+    if ($env:NVM_HOME) { $standardDirs += $env:NVM_HOME }
+    if ($env:NVM_SYMLINK) { $standardDirs += $env:NVM_SYMLINK }
+
     $regPath = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine")
     $currentPaths = ($env:PATH -split ";") + ($regPath -split ";") + $standardDirs | Where-Object { [string]::IsNullOrWhiteSpace($_) -eq $false -and (Test-Path $_) } | Select-Object -Unique
     $env:PATH = $currentPaths -join ";"
 }
 
+function Start-LocalAdbServer {
+    if (Test-CommandExists "adb") {
+        try {
+            $origSocket = $env:ADB_SERVER_SOCKET
+            Remove-Item Env:\ADB_SERVER_SOCKET -ErrorAction SilentlyContinue
+            & adb start-server 2>$null | Out-Null
+            if ($origSocket) { $env:ADB_SERVER_SOCKET = $origSocket }
+        } catch {}
+    }
+}
+
 function Test-CommandExists {
     param([string]$Command)
     $res = Get-Command $Command -ErrorAction SilentlyContinue
@@ -164,6 +184,9 @@ if ($missingCore.Count -gt 0) {
     }
 }
 
+# Ensure local ADB daemon is warm & listening so probes do not hit 'Connection refused'
+Start-LocalAdbServer
+
 # 4. Check or initialize .env
 if (-not (Test-Path ".env")) {
     if (Test-Path ".env.example") {
@@ -259,6 +282,9 @@ if ($installMcp -match "^[Yy]") {
 Write-Host ""
 
 # 8. Launch unified Showcase UI & open browser
+# Ensure local ADB daemon is warm & listening
+Start-LocalAdbServer
+
 # Launch via `python -m artemis` (not the `artemis.exe` console-script shim) so the
 # long-running server never locks .venv\Scripts\artemis.exe against `uv sync` reinstalls.
 Write-Host "   [INFO] Launching Artemis Showcase UI & Admin Console..." -ForegroundColor Green
```

**File**: `start.sh` (modified, +27/-0)
```diff
@@ -102,6 +102,23 @@ if ! command -v uv >/dev/null 2>&1; then
 fi
 
 # 3. Check and auto-install missing system toolchains (ADB, FFmpeg, scrcpy)
+# Discover standard Android SDK / user-space locations if adb not in PATH
+if ! command -v adb >/dev/null 2>&1; then
+    for candidate in \
+        "${ANDROID_HOME:-}/platform-tools" \
+        "${ANDROID_SDK_ROOT:-}/platform-tools" \
+        "${HOME}/Library/Android/sdk/platform-tools" \
+        "${HOME}/Android/Sdk/platform-tools" \
+        "${HOME}/.local/share/platform-tools" \
+        "/opt/homebrew/bin" \
+        "/usr/local/bin"; do
+        if [ -n "${candidate}" ] && [ -x "${candidate}/adb" ]; then
+            export PATH="${candidate}:${PATH}"
+            break
+        fi
+    done
+fi
+
 MISSING_CORE=()
 if ! command -v adb >/dev/null 2>&1; then MISSING_CORE+=("adb"); fi
 if ! command -v ffmpeg >/dev/null 2>&1; then MISSING_CORE+=("ffmpeg"); fi
@@ -175,6 +192,11 @@ if [ ${#MISSING_CORE[@]} -gt 0 ]; then
     fi
 fi
 
+# Ensure local ADB daemon is warm & listening so probes do not hit 'Connection refused'
+if command -v adb >/dev/null 2>&1; then
+    (unset ADB_SERVER_SOCKET; adb start-server >/dev/null 2>&1 || true)
+fi
+
 # 4. Check or initialize .env configuration file
 if [ ! -f ".env" ]; then
     if [ -f ".env.example" ]; then
@@ -314,6 +336,11 @@ if [ "${IS_REMOTE}" = true ]; then
     echo ""
 fi
 
+# Ensure local ADB daemon is active and listening before launching UI
+if command -v adb >/dev/null 2>&1; then
+    (unset ADB_SERVER_SOCKET; adb start-server >/dev/null 2>&1 || true)
+fi
+
 # Launch via `python -m artemis` (not the `artemis` console-script shim) so the
 # long-running server never pins .venv/Scripts/artemis[.exe] against reinstalls.
 exec uv run python -m artemis ui "${OPEN_FLAG}" "$@"
```

---

### Incident Patch 15: `8b3cfe9b` (2026-09-04)
**Commit Message**: fix(start.sh): remove invalid local keyword outside functions

**File**: `start.sh` (modified, +2/-2)
```diff
@@ -136,7 +136,7 @@ if [ ${#MISSING_CORE[@]} -gt 0 ]; then
         fi
     elif [ "${OS_NAME}" = "Linux" ]; then
         if request_sudo "install missing system components (${MISSING_CORE[*]})"; then
-            local SUDO_PREFIX=""
+            SUDO_PREFIX=""
             if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
             if command -v apt-get >/dev/null 2>&1; then
                 ${SUDO_PREFIX} apt-get update -qq && ${SUDO_PREFIX} apt-get install -y -qq "${MISSING_CORE[@]}" || true
@@ -211,7 +211,7 @@ if [ ! -f "${SHOWCASE_INDEX}" ] && [ ! -f "${SHOWCASE_INDEX_ALT1}" ] && [ ! -f "
             brew install node >/dev/null 2>&1 || true
         elif [ "${OS_NAME}" = "Linux" ]; then
             if request_sudo "install Node.js and npm"; then
-                local SUDO_PREFIX=""
+                SUDO_PREFIX=""
                 if [ "$(id -u)" -ne 0 ]; then SUDO_PREFIX="sudo"; fi
                 if command -v apt-get >/dev/null 2>&1; then
                     ${SUDO_PREFIX} apt-get update -qq && ${SUDO_PREFIX} apt-get install -y -qq nodejs npm || true
```

#### Recent Merged Pull Requests:
- **PR #162** (2026-09-29): Third party cleanup (@somew1nd)
- **PR #150** (closed): Add the NOTICE file Apache 2.0 section 4(d) requires (@basil-k-aji-dev)
- **PR #140** (closed): fix(mcp): stop splicing notification text into AppleScript/PowerShell source (@carfeii)
- **PR #133** (closed): test(config): cover utils.* node reconciliation as match (CHE-656) (@congvc-dev)
- **PR #98** (closed): test(mcp): let the emulator win32 branch be exercised from any host (@basil-k-aji-dev)
- **PR #96** (closed): Honor the configured LLM provider instead of hardcoding Google (@jovinus302)
- **PR #93** (closed): test(mcp): stop MCP dispatch tests from leaking real spawn watchdogs (@basil-k-aji-dev)
- **PR #92** (closed): fix(video): pin the output frame rate on rendered analyzer clips (@basil-k-aji-dev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
