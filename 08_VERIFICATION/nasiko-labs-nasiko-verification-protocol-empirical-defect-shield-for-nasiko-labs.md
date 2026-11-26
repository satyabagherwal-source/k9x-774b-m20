# Verification Protocol: Verification Protocol: Empirical Defect Shield for Nasiko-Labs/nasiko

<!-- PROVENANCE_START
{
  "source_repository": "Nasiko-Labs/nasiko",
  "source_url": "https://github.com/Nasiko-Labs/nasiko",
  "source_version": "93091516",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T20:04:20.247Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nasiko-labs-nasiko",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Nasiko-Labs/nasiko](https://github.com/Nasiko-Labs/nasiko) (Revision: `93091516`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T20:04:20.247Z`  
> **Learning ID**: `learn-github-nasiko-labs-nasiko`


## 1. Scope & Verification Target
- **Target Repository**: `Nasiko-Labs/nasiko` (Commit: `93091516`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): Nasiko-Labs/nasiko

> **Canonical Artifact**: `07_PROJECT_LEARNING/nasiko-labs-nasiko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Nasiko-Labs/nasiko](https://github.com/Nasiko-Labs/nasiko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T20:04:18.315Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Nasiko-Labs/nasiko`
- **Description**: The Open Runtime for AI Agents
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11924 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agents/assistant-agent/nasiko_state.py`
```
"""Durable agent state over the platform's state API.

An A2A agent normally keeps its tasks in process memory, so a restart loses paused work
and the agent cannot run as more than one replica. This module is a drop-in replacement
that keeps that state in the platform instead.

    from nasiko_state import make_task_store

    handler = DefaultRequestHandler(
        agent_executor=MyExecutor(),
        task_store=make_task_store(),   # was: InMemoryTaskStore()
        agent_card=card,
    )
    app = Starlette(routes=...)
    install_shutdown_hooks(app)         # flush pending writes when the server stops

Configuration comes from the environment the platform injects into the container:

    NASIKO_STATE_URL     base URL of the state API (ends in /api/agent-state). Unset means the
                         platform provides no store, and every factory here returns the
                         in-memory implementation the SDK ships, so the same code runs locally.
    NASIKO_AGENT_TOKEN   this agent's state credential. It is the only one accepted: the MCP
                         gateway token is a different credential and is never used here.

Write guarantee (see NasikoTaskStore): a save that changes ``task.status.state`` is on the
server before ``save()`` returns. Other saves are coalesced to at most one write per
COALESCE_WINDOW_SECONDS per task and written on the next state change, by a background timer,
and by ``aclose()``. Nothing calls ``aclose()`` on its own: ``install_shutdown_hooks(app)`` runs
it when the server shuts down (uvicorn does that on SIGTERM and Ctrl-C), and an atexit hook
covers a normal interpreter exit. A hard crash (SIGKILL, power loss), or a SIGTERM in a process
without those hooks, can lose that window of non-status updates; so can an update the platform
could not take for PENDING_MAX_AGE_SECONDS, which is discarded rather than written late.

Both a2a-sdk majors are supported (0.3.x pydantic tasks and 1.x protobuf tasks). The langgraph
checkpointer needs the optional langgraph-checkpoint package; nothing else does.

This file is vendored: agent images are built from the agent's own directory only, so each
agent keeps a committed copy next to its main module. oss/agents/common is canonical and
oss/agents/common/check_vendored.py fails when a copy drifts.
"""

from __future__ import annotations

import asyncio
import atexit
import base64
import contextlib
import functools
import json
import logging
import os
import random
import signal
import threading
import time
from collections import OrderedDict
from collections.abc import AsyncIterator, Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, fields
from typing import Any, Generic, TypeVar
from urllib.parse import quote, urlsplit

import httpx
from a2a.server.tasks import InMemoryTaskStore, TaskStore
from a2a.types import Task

try:
    from a2a.types import a2a_pb2 as _a2a_pb2  # a2a-sdk 1.x: tasks are protobuf messages
except ImportError:
    _a2a_pb2 = None  # a2a-sdk 0.3.x: tasks are pydantic models

try:
    from langgraph.checkpoint.base import (
        WRITES_IDX_MAP,
        BaseCheckpointSaver,
        CheckpointTuple,
        get_checkpoint_metadata,
    )

    _LANGGRAPH_AVAILABLE = True
except ImportError:
    # langgraph is optional: only agents that checkpoint with it need the package.
    BaseCheckpointSaver = object  # type: ignore[assignment,misc]
    _LANGGRAPH_AVAILABLE = False

logger = logging.getLogger("nasiko_state")

STATE_URL_ENV = "NASIKO_STATE_URL"
AGENT_TOKEN_ENV = "NASIKO_AGENT_TOKEN"

CLIENT_NAME = "nasiko_state.py/1"

CONNECT_TIMEOUT_SECONDS = 2.0
READ_TIMEOUT_SECONDS = 10.0
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 0.2
# A rate-limited (429) request is retried after the Retry-After the server names, waiting at most
# MAX_RETRY_AFTER_SECONDS per attempt and RATE_LIMIT_BUDGET_SECONDS in all before the 429 surfaces.
# The platform's limit is a per-minute window shared by every replica of the agent, so a wait of a
# few seconds is usually enough, and a turn that keeps failing for half a minute should fail.
MAX_RETRY_AFTER_SECONDS = 5.0
RATE_LIMIT_BUDGET_SECONDS = 30.0
# The wait when a 429 names none (or names an HTTP date), and the shortest wait ever taken, so a
# server answering "Retry-After: 0" cannot turn the budget into a busy loop.
RATE_LIMIT_DEFAULT_WAIT_SECONDS = 1.0
RATE_LIMIT_MIN_WAIT_SECONDS = 0.5
# Relative spread of each 429 wait, so replicas limited at the same moment do not retry in step.
RATE_LIMIT_JITTER = 0.2
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50

# Saves that do not change a task's state are written at most once per window per task.
COALESCE_WINDOW_SECONDS = 0.5
# A deferred write that failed is retried after a delay that doubles per failure, up to this.
DEFERRED_RETRY_MAX_SECONDS = 10.0
# An unwritten update this old is presumed superseded (the task has most likely moved on to
# another replica), so it is discarded instead of being written over whatever is there now.
PENDING_MAX_AGE_SECONDS = 60.0
# Exiting with the platform unreachable must not hang for every pending task.
EXIT_FLUSH_BUDGET_SECONDS = 10.0
# A task id just looked up and not found reads as missing for this long without asking again.
# a2a-sdk 1.x looks a new task's id up several times before the task's first save, and that id is
# one the SDK generated for the request, so no other replica can have created the task meanwhile.
# A task that exists is always read from the server: another replica may have changed it.
ABSENT_CACHE_SECONDS = 2.0
# Bound on tasks whose write state is remembered. Forgetting an idle one costs its next write the
# version check: having no version to match, that write is unconditional.
MAX_TRACKED_TASKS = 4096
# The status a shell reports for a process ended by SIGTERM; kept when SIGTERM becomes an exit.
SIGTERM_EXIT_STATUS = 128 + signal.SIGTERM

# The order the registration contract spells its capability lists in.
CAPABILITY_ORDER = ("tasks", "kv")
# A startup registration that failed for a reason that may pass (no answer, 5xx, 429) is retried
# in the background after a delay that doubles from the first of these up to the second.
REGISTER_RETRY_FIRST_SECONDS = 1.0
REGISTER_RETRY_MAX_SECONDS = 60.0
REGISTER_THREAD_NAME = "nasiko-state-register"

T = TypeVar("T")


class NasikoStateError(Exception):
    """The state API refused a request or could not be reached.

    ``status`` and ``body`` carry the HTTP answer. Both are None for transport and
    configuration failures, where there was no answer.
    """

    def __init__(self, message: str, *, status: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status = status
        self.body = body


class NasikoStateMalformedRow(NasikoStateError):
    """A stored row cannot be read back as what it claims to be.

    Raised for a task written by the other a2a-sdk major (or not by this module at all), and for a
    damaged record. Never answered with a half-decoded object.
    """


class NasikoStateTooLarge(NasikoStateError):
    """The state API refused a value above its size limit (HTTP 413). Retrying cannot help."""


class NasikoStateConflict(NasikoStateError):
    """An ``If-Match`` precondition failed: another writer changed the row first.

    ``current_version`` is the version the server holds, or None if the body did not say.
    """

    def __init__(self, message: str, *, current_version: int | None, body: str | None = None):
        super().__init__(message, status=412, body=body)
        self.current_version = current_version


@dataclass(frozen=True)
class WriteReceipt:
    """What the server answers to a PUT. Task and KV writes share the three fields."""

    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class TaskRecord:
    """One stored task. ``body`` is the SDK's serialized Task, opaque to the server."""

    task_id: str
    context_id: str | None
    state: str
    body: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class KVRecord:
    """One stored key. ``value`` is opaque JSON."""

    key: str
    value: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class Page(Generic[T]):
    """One page of a listing. ``next_cursor`` is None on the last page."""

    items: list[T]
    next_cursor: str | None


# --- Operations ---------------------------------------------------------------------------------
#
# Each state API call is described once, as data, and executed by the sync or the async client
# method. That keeps request building, status handling and parsing in a single place.

_UNSET: Any = object()


@dataclass(frozen=True)
class _Operation:
    """One state API call: how to send it and how to read the answer."""

    method: str
    path: str
    parse: Callable[[httpx.Response], Any]
    ok_status: int = 200
    params: Mapping[str, str | int | None] | None = None
    json: Any = _UNSET
    if_match: int | None = None
    # A write names the capability it needs registered; reads leave it None.
    capability: str | None = None
    # What a 404 means. Left unset, a 404 is an error like any other status.
    when_missing: Any = _UNSET
    # time.monotonic() by which the call, retries included, must be over. None means no deadline.
    deadline: float | None = None

    def request_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"method": self.method, "url": self.path}
        if self.params:
            kwargs["params"] = {key: value for key, value in self.params.items() if value is not None}
        if self.json is not _UNSET:
            kwargs["json"] = self.json
        if self.if_match is not None:
            kwargs["headers"] = {"If-Match": str(self.if_match)}
        if self.deadline is not None:
            kwargs["timeout"] = min(self.seconds_left(), READ_TIMEOUT_SECONDS)
        return kwargs

    def seconds_left(self) -> 
```

### Core Architecture Module: `agents/claude-sdk/src/nasiko_state.py`
```
"""Durable agent state over the platform's state API.

An A2A agent normally keeps its tasks in process memory, so a restart loses paused work
and the agent cannot run as more than one replica. This module is a drop-in replacement
that keeps that state in the platform instead.

    from nasiko_state import make_task_store

    handler = DefaultRequestHandler(
        agent_executor=MyExecutor(),
        task_store=make_task_store(),   # was: InMemoryTaskStore()
        agent_card=card,
    )
    app = Starlette(routes=...)
    install_shutdown_hooks(app)         # flush pending writes when the server stops

Configuration comes from the environment the platform injects into the container:

    NASIKO_STATE_URL     base URL of the state API (ends in /api/agent-state). Unset means the
                         platform provides no store, and every factory here returns the
                         in-memory implementation the SDK ships, so the same code runs locally.
    NASIKO_AGENT_TOKEN   this agent's state credential. It is the only one accepted: the MCP
                         gateway token is a different credential and is never used here.

Write guarantee (see NasikoTaskStore): a save that changes ``task.status.state`` is on the
server before ``save()`` returns. Other saves are coalesced to at most one write per
COALESCE_WINDOW_SECONDS per task and written on the next state change, by a background timer,
and by ``aclose()``. Nothing calls ``aclose()`` on its own: ``install_shutdown_hooks(app)`` runs
it when the server shuts down (uvicorn does that on SIGTERM and Ctrl-C), and an atexit hook
covers a normal interpreter exit. A hard crash (SIGKILL, power loss), or a SIGTERM in a process
without those hooks, can lose that window of non-status updates; so can an update the platform
could not take for PENDING_MAX_AGE_SECONDS, which is discarded rather than written late.

Both a2a-sdk majors are supported (0.3.x pydantic tasks and 1.x protobuf tasks). The langgraph
checkpointer needs the optional langgraph-checkpoint package; nothing else does.

This file is vendored: agent images are built from the agent's own directory only, so each
agent keeps a committed copy next to its main module. oss/agents/common is canonical and
oss/agents/common/check_vendored.py fails when a copy drifts.
"""

from __future__ import annotations

import asyncio
import atexit
import base64
import contextlib
import functools
import json
import logging
import os
import random
import signal
import threading
import time
from collections import OrderedDict
from collections.abc import AsyncIterator, Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, fields
from typing import Any, Generic, TypeVar
from urllib.parse import quote, urlsplit

import httpx
from a2a.server.tasks import InMemoryTaskStore, TaskStore
from a2a.types import Task

try:
    from a2a.types import a2a_pb2 as _a2a_pb2  # a2a-sdk 1.x: tasks are protobuf messages
except ImportError:
    _a2a_pb2 = None  # a2a-sdk 0.3.x: tasks are pydantic models

try:
    from langgraph.checkpoint.base import (
        WRITES_IDX_MAP,
        BaseCheckpointSaver,
        CheckpointTuple,
        get_checkpoint_metadata,
    )

    _LANGGRAPH_AVAILABLE = True
except ImportError:
    # langgraph is optional: only agents that checkpoint with it need the package.
    BaseCheckpointSaver = object  # type: ignore[assignment,misc]
    _LANGGRAPH_AVAILABLE = False

logger = logging.getLogger("nasiko_state")

STATE_URL_ENV = "NASIKO_STATE_URL"
AGENT_TOKEN_ENV = "NASIKO_AGENT_TOKEN"

CLIENT_NAME = "nasiko_state.py/1"

CONNECT_TIMEOUT_SECONDS = 2.0
READ_TIMEOUT_SECONDS = 10.0
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 0.2
# A rate-limited (429) request is retried after the Retry-After the server names, waiting at most
# MAX_RETRY_AFTER_SECONDS per attempt and RATE_LIMIT_BUDGET_SECONDS in all before the 429 surfaces.
# The platform's limit is a per-minute window shared by every replica of the agent, so a wait of a
# few seconds is usually enough, and a turn that keeps failing for half a minute should fail.
MAX_RETRY_AFTER_SECONDS = 5.0
RATE_LIMIT_BUDGET_SECONDS = 30.0
# The wait when a 429 names none (or names an HTTP date), and the shortest wait ever taken, so a
# server answering "Retry-After: 0" cannot turn the budget into a busy loop.
RATE_LIMIT_DEFAULT_WAIT_SECONDS = 1.0
RATE_LIMIT_MIN_WAIT_SECONDS = 0.5
# Relative spread of each 429 wait, so replicas limited at the same moment do not retry in step.
RATE_LIMIT_JITTER = 0.2
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50

# Saves that do not change a task's state are written at most once per window per task.
COALESCE_WINDOW_SECONDS = 0.5
# A deferred write that failed is retried after a delay that doubles per failure, up to this.
DEFERRED_RETRY_MAX_SECONDS = 10.0
# An unwritten update this old is presumed superseded (the task has most likely moved on to
# another replica), so it is discarded instead of being written over whatever is there now.
PENDING_MAX_AGE_SECONDS = 60.0
# Exiting with the platform unreachable must not hang for every pending task.
EXIT_FLUSH_BUDGET_SECONDS = 10.0
# A task id just looked up and not found reads as missing for this long without asking again.
# a2a-sdk 1.x looks a new task's id up several times before the task's first save, and that id is
# one the SDK generated for the request, so no other replica can have created the task meanwhile.
# A task that exists is always read from the server: another replica may have changed it.
ABSENT_CACHE_SECONDS = 2.0
# Bound on tasks whose write state is remembered. Forgetting an idle one costs its next write the
# version check: having no version to match, that write is unconditional.
MAX_TRACKED_TASKS = 4096
# The status a shell reports for a process ended by SIGTERM; kept when SIGTERM becomes an exit.
SIGTERM_EXIT_STATUS = 128 + signal.SIGTERM

# The order the registration contract spells its capability lists in.
CAPABILITY_ORDER = ("tasks", "kv")
# A startup registration that failed for a reason that may pass (no answer, 5xx, 429) is retried
# in the background after a delay that doubles from the first of these up to the second.
REGISTER_RETRY_FIRST_SECONDS = 1.0
REGISTER_RETRY_MAX_SECONDS = 60.0
REGISTER_THREAD_NAME = "nasiko-state-register"

T = TypeVar("T")


class NasikoStateError(Exception):
    """The state API refused a request or could not be reached.

    ``status`` and ``body`` carry the HTTP answer. Both are None for transport and
    configuration failures, where there was no answer.
    """

    def __init__(self, message: str, *, status: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status = status
        self.body = body


class NasikoStateMalformedRow(NasikoStateError):
    """A stored row cannot be read back as what it claims to be.

    Raised for a task written by the other a2a-sdk major (or not by this module at all), and for a
    damaged record. Never answered with a half-decoded object.
    """


class NasikoStateTooLarge(NasikoStateError):
    """The state API refused a value above its size limit (HTTP 413). Retrying cannot help."""


class NasikoStateConflict(NasikoStateError):
    """An ``If-Match`` precondition failed: another writer changed the row first.

    ``current_version`` is the version the server holds, or None if the body did not say.
    """

    def __init__(self, message: str, *, current_version: int | None, body: str | None = None):
        super().__init__(message, status=412, body=body)
        self.current_version = current_version


@dataclass(frozen=True)
class WriteReceipt:
    """What the server answers to a PUT. Task and KV writes share the three fields."""

    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class TaskRecord:
    """One stored task. ``body`` is the SDK's serialized Task, opaque to the server."""

    task_id: str
    context_id: str | None
    state: str
    body: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class KVRecord:
    """One stored key. ``value`` is opaque JSON."""

    key: str
    value: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class Page(Generic[T]):
    """One page of a listing. ``next_cursor`` is None on the last page."""

    items: list[T]
    next_cursor: str | None


# --- Operations ---------------------------------------------------------------------------------
#
# Each state API call is described once, as data, and executed by the sync or the async client
# method. That keeps request building, status handling and parsing in a single place.

_UNSET: Any = object()


@dataclass(frozen=True)
class _Operation:
    """One state API call: how to send it and how to read the answer."""

    method: str
    path: str
    parse: Callable[[httpx.Response], Any]
    ok_status: int = 200
    params: Mapping[str, str | int | None] | None = None
    json: Any = _UNSET
    if_match: int | None = None
    # A write names the capability it needs registered; reads leave it None.
    capability: str | None = None
    # What a 404 means. Left unset, a 404 is an error like any other status.
    when_missing: Any = _UNSET
    # time.monotonic() by which the call, retries included, must be over. None means no deadline.
    deadline: float | None = None

    def request_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"method": self.method, "url": self.path}
        if self.params:
            kwargs["params"] = {key: value for key, value in self.params.items() if value is not None}
        if self.json is not _UNSET:
            kwargs["json"] = self.json
        if self.if_match is not None:
            kwargs["headers"] = {"If-Match": str(self.if_match)}
        if self.deadline is not None:
            kwargs["timeout"] = min(self.seconds_left(), READ_TIMEOUT_SECONDS)
        return kwargs

    def seconds_left(self) -> 
```

### Core Architecture Module: `agents/common/js/nasiko-state/src/client.js`
```
/**
 * Typed client for the platform's state API (see oss/agents/common/nasiko_state.py for the
 * Python twin). One method per endpoint; failures raise the typed errors from errors.js.
 *
 * Connection errors and 5xx answers are retried (RETRY_ATTEMPTS attempts in total, exponential
 * backoff) because every call is idempotent; so is a 429, after the Retry-After it names when
 * that is at most MAX_RETRY_AFTER_SECONDS. Other 4xx answers never are. A conditional write whose
 * outcome is unknown (the request went out and no answer came back) is not repeated: it would
 * conflict with its own first attempt.
 *
 * The first write of each kind (tasks, kv) registers the agent with the platform, once.
 */

import {
  NasikoStateConflict,
  NasikoStateError,
  NasikoStateNotFound,
  NasikoStateRateLimited,
  NasikoStateTooLarge,
  NasikoStateUnauthorized,
} from "./errors.js";

export const STATE_URL_ENV = "NASIKO_STATE_URL";
export const AGENT_TOKEN_ENV = "NASIKO_AGENT_TOKEN";
export const CLIENT_NAME = "nasiko-state.js/1";

export const RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = 200;
export const REQUEST_TIMEOUT_MS = 10_000;
// The longest Retry-After a rate-limited request waits out; a longer one surfaces the 429.
export const MAX_RETRY_AFTER_SECONDS = 5;
export const MAX_PAGE_SIZE = 100;

// The order the registration contract spells its capability lists in.
const CAPABILITY_ORDER = ["tasks", "kv"];

// Failures that happen before the request is sent, so repeating a conditional write is safe.
const BEFORE_SEND_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"]);

/**
 * Escape everything but unreserved characters, so '/', ':' and '%' in an id stay inert. Matches
 * the Python store's encoding, which both use for URL segments and composite keys.
 * @param {string} value
 */
export function percentEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * @typedef {{version: number, updatedAt: string, expiresAt: string}} WriteReceipt
 * @typedef {{taskId: string, contextId: string | null, state: string, body: any, version: number,
 *   updatedAt: string, expiresAt: string}} TaskRecord
 * @typedef {{key: string, value: any, version: number, updatedAt: string, expiresAt: string}} KVRecord
 * @template T
 * @typedef {{items: T[], nextCursor: string | null}} Page
 */

export class NasikoStateClient {
  #baseUrl;
  #headers;
  #clientName;
  #fetch;
  #retryBackoffMs;
  #requestTimeoutMs;
  #registered = new Set();
  #registering = Promise.resolve();

  /**
   * @param {string} baseUrl base URL of the state API (ends in /api/agent-state)
   * @param {string} token this agent's state credential
   * @param {{clientName?: string, fetch?: typeof fetch, retryBackoffMs?: number,
   *   requestTimeoutMs?: number}} [options]
   */
  constructor(baseUrl, token, options = {}) {
    if (!/^https?:\/\/[^/]/.test(baseUrl)) {
      throw new NasikoStateError(`${STATE_URL_ENV} must be an http(s) URL, got ${JSON.stringify(baseUrl)}`);
    }
    if (!token) throw new NasikoStateError("the state API needs an agent token and none was given");
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#clientName = options.clientName ?? CLIENT_NAME;
    this.#headers = { Authorization: `Bearer ${token}`, "User-Agent": this.#clientName };
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#retryBackoffMs = options.retryBackoffMs ?? RETRY_BACKOFF_MS;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  /**
   * Build a client from the platform's environment, or null when it provides no state API.
   * @param {Record<string, string | undefined>} [env]
   * @returns {NasikoStateClient | null}
   */
  static fromEnv(env = process.env) {
    const url = (env[STATE_URL_ENV] ?? "").trim();
    if (!url) return null;
    const token = (env[AGENT_TOKEN_ENV] ?? "").trim();
    if (!token) {
      throw new NasikoStateError(
        `${STATE_URL_ENV} is set but ${AGENT_TOKEN_ENV} is empty or missing: the state API needs ` +
          `this agent's state credential, which the platform injects as ${AGENT_TOKEN_ENV}`,
      );
    }
    return new NasikoStateClient(url, token);
  }

  toString() {
    return `NasikoStateClient(${this.#baseUrl})`;
  }

  // --- registration -------------------------------------------------------------------------

  /**
   * Tell the platform which kinds of state this agent keeps. Writes do this on their own.
   * @param {string[]} capabilities
   * @param {string} [clientName]
   */
  async register(capabilities, clientName) {
    await this.#request("POST", "/register", {
      json: { capabilities: [...capabilities], client: clientName ?? this.#clientName },
      okStatus: 204,
    });
    for (const capability of capabilities) this.#registered.add(capability);
  }

  // --- tasks --------------------------------------------------------------------------------

  /**
   * Create or replace a task.
   * @param {string} taskId
   * @param {{contextId: string | null, state: string, body: any, ifMatch?: number | null}} fields
   * @returns {Promise<WriteReceipt>}
   */
  async putTask(taskId, { contextId, state, body, ifMatch = null }) {
    await this.#ensureRegistered("tasks");
    const data = await this.#request("PUT", `/tasks/${percentEncode(taskId)}`, {
      json: { context_id: contextId, state, body },
      ifMatch,
    });
    return receiptFrom(data);
  }

  /** @returns {Promise<TaskRecord | null>} */
  async getTask(taskId) {
    const data = await this.#request("GET", `/tasks/${percentEncode(taskId)}`, { whenMissing: null });
    return data === null ? null : taskRecordFrom(data);
  }

  /** Delete a task. False means there was no such task. */
  async deleteTask(taskId, { ifMatch = null } = {}) {
    await this.#ensureRegistered("tasks");
    return this.#delete(`/tasks/${percentEncode(taskId)}`, ifMatch);
  }

  /**
   * @param {{contextId?: string | null, state?: string | null, limit?: number, cursor?: string | null}} [filters]
   * @returns {Promise<Page<TaskRecord>>}
   */
  async listTasks({ contextId, state, limit, cursor } = {}) {
    const data = await this.#request("GET", "/tasks", {
      query: { context_id: contextId, state, limit, cursor },
    });
    return pageFrom(data, taskRecordFrom);
  }

  // --- key-value ----------------------------------------------------------------------------

  /**
   * @param {string} key
   * @param {any} value opaque JSON
   * @param {{ifMatch?: number | null}} [options]
   * @returns {Promise<WriteReceipt>}
   */
  async putKv(key, value, { ifMatch = null } = {}) {
    await this.#ensureRegistered("kv");
    const data = await this.#request("PUT", `/kv/${percentEncode(key)}`, { json: { value }, ifMatch });
    return receiptFrom(data);
  }

  /** @returns {Promise<KVRecord | null>} */
  async getKv(key) {
    const data = await this.#request("GET", `/kv/${percentEncode(key)}`, { whenMissing: null });
    return data === null ? null : kvRecordFrom(data);
  }

  /** Delete a key. False means there was no such key. */
  async deleteKv(key, { ifMatch = null } = {}) {
    await this.#ensureRegistered("kv");
    return this.#delete(`/kv/${percentEncode(key)}`, ifMatch);
  }

  /**
   * @param {{prefix?: string | null, limit?: number, cursor?: string | null}} [filters]
   * @returns {Promise<Page<KVRecord>>}
   */
  async listKv({ prefix, limit, cursor } = {}) {
    const data = await this.#request("GET", "/kv", { query: { prefix, limit, cursor } });
    return pageFrom(data, kvRecordFrom);
  }

  // --- execution ----------------------------------------------------------------------------

  async #delete(path, ifMatch) {
    const answer = await this.#request("DELETE", path, { ifMatch, okStatus: 204, whenMissing: false });
    return answer !== false;
  }

  /** Registers on the first write of a kind; concurrent first writes share one registration. */
  async #ensureRegistered(capability) {
    if (this.#registered.has(capability)) return;
    const registration = this.#registering.then(async () => {
      if (this.#registered.has(capability)) return;
      await this.register(this.#capabilitiesWith(capability));
    });
    // The chain must survive a failed registration, or every later write would reject with it.
    this.#registering = registration.catch(() => {});
    await registration;
  }

  #capabilitiesWith(capability) {
    const wanted = new Set([...this.#registered, capability]);
    const known = CAPABILITY_ORDER.filter((name) => wanted.has(name));
    return [...known, ...[...wanted].filter((name) => !CAPABILITY_ORDER.includes(name)).sort()];
  }

  /**
   * Send one request with retries and interpret the answer.
   * @returns {Promise<any>} the parsed JSON body, null for a 204, or `whenMissing` on a 404
   */
  async #request(method, path, { json, query, ifMatch = null, okStatus = 200, whenMissing } = {}) {
    const url = this.#baseUrl + path + queryString(query);
    const init = { method, headers: this.#requestHeaders(json !== undefined, ifMatch) };
    if (json !== undefined) init.body = JSON.stringify(json);
    const description = `state API ${method} ${path}`;

    for (let attempt = 1; ; attempt++) {
      const outcome = await this.#attempt(url, init);
      const delayMs = this.#retryDelayMs(attempt, outcome, ifMatch !== null);
      if (delayMs !== null) {
        if (delayMs > 0) await sleep(delayMs);
        continue;
      }
      if (outcome.error) {
        throw new NasikoStateError(`${description} request failed: ${outcome.error.message}`, {
          cause: outcome.error,
        });
      }
      return await interpret(outcome.response, description, okStatus, whenMissing);
    }
  }

  #requestHeaders(hasBody, ifMatch) {
    const headers = { ...this.#headers };
    if (hasBody) headers["Content-Type"] = "application/json";
    if (ifMatch !== null) headers["If-Mat
```

### Core Architecture Module: `agents/common/js/nasiko-state/src/errors.js`
```
/**
 * Errors raised by the state client and stores. Every failure is a NasikoStateError; the
 * subclasses name the answers a caller can act on. Nothing falls back silently.
 */

export class NasikoStateError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number | null, body?: string | null, cause?: unknown}} [details]
   *   `status` and `body` carry the HTTP answer; both are null for transport and configuration
   *   failures, where there was no answer.
   */
  constructor(message, { status = null, body = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.status = status;
    this.body = body;
  }
}

/** 401: the agent token is missing, unknown, or not a state-scoped credential. */
export class NasikoStateUnauthorized extends NasikoStateError {}

/** 404 on an operation that has no "missing" result (reads and deletes return null / false). */
export class NasikoStateNotFound extends NasikoStateError {}

/** 412: an If-Match precondition failed because another writer changed the row first. */
export class NasikoStateConflict extends NasikoStateError {
  /**
   * @param {string} message
   * @param {{currentVersion: number | null, body?: string | null}} details
   */
  constructor(message, { currentVersion, body = null }) {
    super(message, { status: 412, body });
    /** The version the server holds, or null if its answer did not say. */
    this.currentVersion = currentVersion;
  }
}

/** 413: a value above the platform's size limit. Retrying cannot help. */
export class NasikoStateTooLarge extends NasikoStateError {}

/** 429: over the per-agent request rate and not worth waiting out. */
export class NasikoStateRateLimited extends NasikoStateError {
  /**
   * @param {string} message
   * @param {{retryAfterSeconds: number | null, body?: string | null}} details
   */
  constructor(message, { retryAfterSeconds, body = null }) {
    super(message, { status: 429, body });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * A stored row cannot be read back as what it claims to be: written by the other a2a SDK major,
 * not by a Nasiko store at all, or damaged. Never answered with a half-decoded object.
 */
export class NasikoStateMalformedRow extends NasikoStateError {}

/** Whether the same request could succeed later: no answer at all, or a server-side failure. */
export function isTransient(error) {
  return error instanceof NasikoStateError && (error.status === null || error.status >= 500);
}

```

### Core Architecture Module: `agents/common/js/nasiko-state/src/index.js`
```
/**
 * Durable agent state over the Nasiko platform's state API.
 *
 *   import { taskStoreFromEnv, installShutdownHooks } from "nasiko-state";
 *
 *   const handler = new DefaultRequestHandler(card, taskStoreFromEnv(), executor);
 *   installShutdownHooks(); // flush pending writes on SIGTERM / SIGINT
 *
 * Configuration comes from the environment the platform injects: NASIKO_STATE_URL (base URL of
 * the state API) and NASIKO_AGENT_TOKEN (this agent's state credential, the only one accepted).
 * With NASIKO_STATE_URL unset every factory returns the SDK's in-memory implementation.
 */

export * from "./errors.js";
export {
  AGENT_TOKEN_ENV,
  CLIENT_NAME,
  MAX_PAGE_SIZE,
  NasikoStateClient,
  STATE_URL_ENV,
  percentEncode,
} from "./client.js";
export {
  COALESCE_WINDOW_MS,
  PENDING_MAX_AGE_MS,
  NasikoTaskStore,
  TASK_FORMAT,
  closeOpenTaskStores,
  decodeStoredTask,
  encodeStoredTask,
  installShutdownHooks,
  stateName,
  taskStoreFromEnv,
} from "./task-store.js";

```

### Core Architecture Module: `agents/common/js/nasiko-state/src/task-store.js`
```
/**
 * An a2a-js TaskStore that keeps tasks in the platform's state API. Port of NasikoTaskStore in
 * oss/agents/common/nasiko_state.py; the two read each other's rows.
 *
 * Written against @a2a-js/sdk 1.3.0, whose TaskStore is `save(task, context)`,
 * `load(taskId, context)` and `list(params, context)`. Tasks are protobuf-shaped there, and are
 * stored as their proto3 JSON, tagged with the format that wrote them:
 * `{"format": "a2a-1", "task": ...}`. The 0.3.x SDK is not supported: a row of another format is
 * refused with NasikoStateMalformedRow rather than half-decoded.
 *
 * Write guarantee: a save that changes `task.status.state` is on the server before `save()`
 * resolves. Other saves are coalesced to at most one write per COALESCE_WINDOW_MS per task and
 * written on the next state change, by a timer, and by `close()`. A hard crash can lose that
 * window of non-status updates; an update the platform could not take for PENDING_MAX_AGE_MS is
 * discarded rather than written late. Errors reject; nothing is swallowed.
 *
 * Replicas: every write is conditional on the version this process last saw of the task
 * (If-Match). A state change that loses raises NasikoStateConflict; a coalesced update that loses
 * is dropped (logged). Either way the store re-reads, and `load()` returns the other writer's row.
 *
 * Tasks are scoped to the agent, not to an end user: the SDK's per-user owner resolution (the
 * `context` argument) does not apply.
 */

import { Task, TaskState, taskStateToJSON } from "@a2a-js/sdk";
import { InMemoryTaskStore } from "@a2a-js/sdk/server";

import { NasikoStateClient } from "./client.js";
import {
  NasikoStateConflict,
  NasikoStateError,
  NasikoStateMalformedRow,
  isTransient,
} from "./errors.js";

export const TASK_FORMAT = "a2a-1";
export const COALESCE_WINDOW_MS = 500;
// A deferred write that failed is retried after a delay that doubles per failure, up to this.
export const DEFERRED_RETRY_MAX_MS = 10_000;
// An unwritten update this old is presumed superseded (the task has most likely moved to another
// replica), so it is discarded instead of being written over whatever is there now.
export const PENDING_MAX_AGE_MS = 60_000;
// Bound on tasks whose write state is remembered. Forgetting an idle one costs its next write the
// version check: having no version to match, that write is unconditional.
export const MAX_TRACKED_TASKS = 4096;
export const DEFAULT_PAGE_SIZE = 50;

/** Durable stores this process opened and has not closed: what closeOpenTaskStores closes. */
const openStores = new Set();

// --- format ---------------------------------------------------------------------------------------

/** 'TASK_STATE_INPUT_REQUIRED' -> 'input-required', the vocabulary the state column uses. */
export function stateName(state) {
  const name = taskStateToJSON(state).replace(/^TASK_STATE_/, "").toLowerCase().replaceAll("_", "-");
  return name === "unspecified" || name === "unrecognized" ? "unknown" : name;
}

/** The body written to the state API: the task as proto3 JSON, tagged with its format. */
export function encodeStoredTask(task) {
  // Through JSON, so the snapshot is plain data that shares nothing with the SDK's live object.
  return JSON.parse(JSON.stringify({ format: TASK_FORMAT, task: Task.toJSON(task) }));
}

export function decodeStoredTask(body, taskId) {
  const storedFormat = body !== null && typeof body === "object" ? body.format : undefined;
  if (storedFormat !== TASK_FORMAT || !("task" in body)) {
    throw new NasikoStateMalformedRow(
      `stored task ${JSON.stringify(taskId)} is in format ${JSON.stringify(storedFormat)}, and this ` +
        `store reads ${JSON.stringify(TASK_FORMAT)} only`,
    );
  }
  let task;
  try {
    task = Task.fromJSON(body.task);
  } catch (cause) {
    throw new NasikoStateMalformedRow(`stored task ${JSON.stringify(taskId)} cannot be decoded: ${cause.message}`, {
      cause,
    });
  }
  // fromJSON turns {} into an empty task rather than failing, so check the identity too.
  if (task.id !== taskId) {
    throw new NasikoStateMalformedRow(
      `stored task ${JSON.stringify(taskId)} holds a body for task ${JSON.stringify(task.id)}`,
    );
  }
  return task;
}

function snapshotOf(task) {
  return {
    taskId: task.id,
    contextId: task.contextId || null,
    state: task.status ? stateName(task.status.state) : "unknown",
    body: encodeStoredTask(task),
    savedAt: Date.now(),
  };
}

const isStale = (snapshot) => Date.now() - snapshot.savedAt > PENDING_MAX_AGE_MS;

// --- per-task bookkeeping -------------------------------------------------------------------------

/** Runs one async function at a time, in call order. */
class Mutex {
  #tail = Promise.resolve();

  isLocked = false;

  runExclusive(fn) {
    const result = this.#tail.then(async () => {
      this.isLocked = true;
      try {
        return await fn();
      } finally {
        this.isLocked = false;
      }
    });
    this.#tail = result.catch(() => {});
    return result;
  }
}

/** Write-coalescing and concurrency bookkeeping for one task. */
class TaskSlot {
  constructor(taskId) {
    this.taskId = taskId;
    /** The newest snapshot the server has not confirmed yet. */
    this.pending = null;
    /** The row's version as this process last saw it. Every write is conditional on it. */
    this.version = null;
    /** State of the newest snapshot sent or read; a save in any other state is written through. */
    this.state = null;
    this.lastWriteStarted = Number.NEGATIVE_INFINITY;
    /** Consecutive failed writes; spaces out the background retries. */
    this.failedWrites = 0;
    this.timer = null;
    /** One write per task at a time, so an older snapshot cannot land after a newer one. */
    this.lock = new Mutex();
  }

  isIdle() {
    return this.pending === null && this.timer === null && !this.lock.isLocked;
  }
}

// --- the store ------------------------------------------------------------------------------------

export class NasikoTaskStore {
  #client;
  #windowMs;
  #logger;
  /** @type {Map<string, TaskSlot>} insertion order is recency order */
  #slots = new Map();

  /**
   * @param {NasikoStateClient} client
   * @param {{coalesceWindowMs?: number, logger?: Pick<Console, "warn" | "error">}} [options]
   */
  constructor(client, { coalesceWindowMs = COALESCE_WINDOW_MS, logger = console } = {}) {
    this.#client = client;
    this.#windowMs = coalesceWindowMs;
    this.#logger = logger;
    openStores.add(this);
  }

  /** @param {import("@a2a-js/sdk").Task} task */
  async save(task, _context) {
    const snapshot = snapshotOf(task);
    const slot = this.#slot(snapshot.taskId);
    slot.pending = snapshot;
    if (snapshot.state === slot.state) {
      this.#scheduleFlush(slot);
      return;
    }
    slot.state = snapshot.state;
    try {
      await this.#writePending(slot);
    } catch (error) {
      // The state change is still owed; retry it rather than wait for a save that may never come.
      if (isTransient(error)) this.#scheduleFlush(slot);
      throw error;
    }
  }

  async load(taskId, _context) {
    const slot = this.#slot(taskId);
    // Under the slot's lock, so a write in flight cannot be mistaken for another writer's.
    return slot.lock.runExclusive(async () => {
      const record = await this.#client.getTask(taskId);
      return this.#newestOf(slot, record);
    });
  }

  async delete(taskId, _context) {
    const slot = this.#slot(taskId);
    await slot.lock.runExclusive(async () => {
      slot.pending = null; // an unwritten snapshot must not bring the task back
      await this.#client.deleteTask(taskId);
    });
    if (this.#slots.get(taskId) === slot) this.#slots.delete(taskId);
  }

  /**
   * tasks/list, served by the server; it can lag by one coalescing window. totalSize is unknown
   * and reported as 0 (the state API gives no totals). statusTimestampAfter is inclusive (>=),
   * like the Python store and unlike the SDK's in-memory store.
   */
  async list(params, _context) {
    const limit = params.pageSize || DEFAULT_PAGE_SIZE;
    const page = await this.#client.listTasks({
      contextId: params.contextId || null,
      state: params.status ? stateName(params.status) : null,
      limit,
      cursor: params.pageToken || null,
    });
    const tasks = page.items
      .map((record) => decodeStoredTask(record.body, record.taskId))
      .filter((task) => statusChangedSince(task, params.statusTimestampAfter))
      .map((task) => shaped(task, params));
    // totalSize stays 0: the state API reports no totals, and this page's size would be a wrong one.
    return { tasks, nextPageToken: page.nextCursor ?? "", pageSize: tasks.length, totalSize: 0 };
  }

  /** Write everything pending, stop the timers. Rejects with the first failure, after trying all. */
  async close() {
    openStores.delete(this);
    for (const slot of this.#slots.values()) this.#clearTimer(slot);
    const owed = [...this.#slots.values()].filter((slot) => this.#owesAWrite(slot));
    const outcomes = await Promise.allSettled(owed.map((slot) => this.#writePending(slot)));
    const failures = [];
    outcomes.forEach((outcome, i) => {
      if (outcome.status === "fulfilled") return;
      if (outcome.reason instanceof NasikoStateConflict) this.#logSuperseded(owed[i], outcome.reason);
      else failures.push(outcome.reason);
    });
    for (const failure of failures.slice(1)) {
      this.#logger.error(`a pending task write could not be flushed on close: ${failure.message}`);
    }
    if (failures.length > 0) throw failures[0];
  }

  // --- writing ----------------------------------------------------------------------------------

  #writePending(slot) {
    return slot.lock.runExclusive(async () => {
      const snapshot = slot.pending;
      if (snapshot === null) return; // a newer write already carried it
      slot.lastWriteStarted = Date.now();
      let receipt;
      try {
        receipt 
```

### Core Architecture Module: `agents/common/nasiko_state.py`
```
"""Durable agent state over the platform's state API.

An A2A agent normally keeps its tasks in process memory, so a restart loses paused work
and the agent cannot run as more than one replica. This module is a drop-in replacement
that keeps that state in the platform instead.

    from nasiko_state import make_task_store

    handler = DefaultRequestHandler(
        agent_executor=MyExecutor(),
        task_store=make_task_store(),   # was: InMemoryTaskStore()
        agent_card=card,
    )
    app = Starlette(routes=...)
    install_shutdown_hooks(app)         # flush pending writes when the server stops

Configuration comes from the environment the platform injects into the container:

    NASIKO_STATE_URL     base URL of the state API (ends in /api/agent-state). Unset means the
                         platform provides no store, and every factory here returns the
                         in-memory implementation the SDK ships, so the same code runs locally.
    NASIKO_AGENT_TOKEN   this agent's state credential. It is the only one accepted: the MCP
                         gateway token is a different credential and is never used here.

Write guarantee (see NasikoTaskStore): a save that changes ``task.status.state`` is on the
server before ``save()`` returns. Other saves are coalesced to at most one write per
COALESCE_WINDOW_SECONDS per task and written on the next state change, by a background timer,
and by ``aclose()``. Nothing calls ``aclose()`` on its own: ``install_shutdown_hooks(app)`` runs
it when the server shuts down (uvicorn does that on SIGTERM and Ctrl-C), and an atexit hook
covers a normal interpreter exit. A hard crash (SIGKILL, power loss), or a SIGTERM in a process
without those hooks, can lose that window of non-status updates; so can an update the platform
could not take for PENDING_MAX_AGE_SECONDS, which is discarded rather than written late.

Both a2a-sdk majors are supported (0.3.x pydantic tasks and 1.x protobuf tasks). The langgraph
checkpointer needs the optional langgraph-checkpoint package; nothing else does.

This file is vendored: agent images are built from the agent's own directory only, so each
agent keeps a committed copy next to its main module. oss/agents/common is canonical and
oss/agents/common/check_vendored.py fails when a copy drifts.
"""

from __future__ import annotations

import asyncio
import atexit
import base64
import contextlib
import functools
import json
import logging
import os
import random
import signal
import threading
import time
from collections import OrderedDict
from collections.abc import AsyncIterator, Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, fields
from typing import Any, Generic, TypeVar
from urllib.parse import quote, urlsplit

import httpx
from a2a.server.tasks import InMemoryTaskStore, TaskStore
from a2a.types import Task

try:
    from a2a.types import a2a_pb2 as _a2a_pb2  # a2a-sdk 1.x: tasks are protobuf messages
except ImportError:
    _a2a_pb2 = None  # a2a-sdk 0.3.x: tasks are pydantic models

try:
    from langgraph.checkpoint.base import (
        WRITES_IDX_MAP,
        BaseCheckpointSaver,
        CheckpointTuple,
        get_checkpoint_metadata,
    )

    _LANGGRAPH_AVAILABLE = True
except ImportError:
    # langgraph is optional: only agents that checkpoint with it need the package.
    BaseCheckpointSaver = object  # type: ignore[assignment,misc]
    _LANGGRAPH_AVAILABLE = False

logger = logging.getLogger("nasiko_state")

STATE_URL_ENV = "NASIKO_STATE_URL"
AGENT_TOKEN_ENV = "NASIKO_AGENT_TOKEN"

CLIENT_NAME = "nasiko_state.py/1"

CONNECT_TIMEOUT_SECONDS = 2.0
READ_TIMEOUT_SECONDS = 10.0
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 0.2
# A rate-limited (429) request is retried after the Retry-After the server names, waiting at most
# MAX_RETRY_AFTER_SECONDS per attempt and RATE_LIMIT_BUDGET_SECONDS in all before the 429 surfaces.
# The platform's limit is a per-minute window shared by every replica of the agent, so a wait of a
# few seconds is usually enough, and a turn that keeps failing for half a minute should fail.
MAX_RETRY_AFTER_SECONDS = 5.0
RATE_LIMIT_BUDGET_SECONDS = 30.0
# The wait when a 429 names none (or names an HTTP date), and the shortest wait ever taken, so a
# server answering "Retry-After: 0" cannot turn the budget into a busy loop.
RATE_LIMIT_DEFAULT_WAIT_SECONDS = 1.0
RATE_LIMIT_MIN_WAIT_SECONDS = 0.5
# Relative spread of each 429 wait, so replicas limited at the same moment do not retry in step.
RATE_LIMIT_JITTER = 0.2
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50

# Saves that do not change a task's state are written at most once per window per task.
COALESCE_WINDOW_SECONDS = 0.5
# A deferred write that failed is retried after a delay that doubles per failure, up to this.
DEFERRED_RETRY_MAX_SECONDS = 10.0
# An unwritten update this old is presumed superseded (the task has most likely moved on to
# another replica), so it is discarded instead of being written over whatever is there now.
PENDING_MAX_AGE_SECONDS = 60.0
# Exiting with the platform unreachable must not hang for every pending task.
EXIT_FLUSH_BUDGET_SECONDS = 10.0
# A task id just looked up and not found reads as missing for this long without asking again.
# a2a-sdk 1.x looks a new task's id up several times before the task's first save, and that id is
# one the SDK generated for the request, so no other replica can have created the task meanwhile.
# A task that exists is always read from the server: another replica may have changed it.
ABSENT_CACHE_SECONDS = 2.0
# Bound on tasks whose write state is remembered. Forgetting an idle one costs its next write the
# version check: having no version to match, that write is unconditional.
MAX_TRACKED_TASKS = 4096
# The status a shell reports for a process ended by SIGTERM; kept when SIGTERM becomes an exit.
SIGTERM_EXIT_STATUS = 128 + signal.SIGTERM

# The order the registration contract spells its capability lists in.
CAPABILITY_ORDER = ("tasks", "kv")
# A startup registration that failed for a reason that may pass (no answer, 5xx, 429) is retried
# in the background after a delay that doubles from the first of these up to the second.
REGISTER_RETRY_FIRST_SECONDS = 1.0
REGISTER_RETRY_MAX_SECONDS = 60.0
REGISTER_THREAD_NAME = "nasiko-state-register"

T = TypeVar("T")


class NasikoStateError(Exception):
    """The state API refused a request or could not be reached.

    ``status`` and ``body`` carry the HTTP answer. Both are None for transport and
    configuration failures, where there was no answer.
    """

    def __init__(self, message: str, *, status: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status = status
        self.body = body


class NasikoStateMalformedRow(NasikoStateError):
    """A stored row cannot be read back as what it claims to be.

    Raised for a task written by the other a2a-sdk major (or not by this module at all), and for a
    damaged record. Never answered with a half-decoded object.
    """


class NasikoStateTooLarge(NasikoStateError):
    """The state API refused a value above its size limit (HTTP 413). Retrying cannot help."""


class NasikoStateConflict(NasikoStateError):
    """An ``If-Match`` precondition failed: another writer changed the row first.

    ``current_version`` is the version the server holds, or None if the body did not say.
    """

    def __init__(self, message: str, *, current_version: int | None, body: str | None = None):
        super().__init__(message, status=412, body=body)
        self.current_version = current_version


@dataclass(frozen=True)
class WriteReceipt:
    """What the server answers to a PUT. Task and KV writes share the three fields."""

    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class TaskRecord:
    """One stored task. ``body`` is the SDK's serialized Task, opaque to the server."""

    task_id: str
    context_id: str | None
    state: str
    body: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class KVRecord:
    """One stored key. ``value`` is opaque JSON."""

    key: str
    value: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class Page(Generic[T]):
    """One page of a listing. ``next_cursor`` is None on the last page."""

    items: list[T]
    next_cursor: str | None


# --- Operations ---------------------------------------------------------------------------------
#
# Each state API call is described once, as data, and executed by the sync or the async client
# method. That keeps request building, status handling and parsing in a single place.

_UNSET: Any = object()


@dataclass(frozen=True)
class _Operation:
    """One state API call: how to send it and how to read the answer."""

    method: str
    path: str
    parse: Callable[[httpx.Response], Any]
    ok_status: int = 200
    params: Mapping[str, str | int | None] | None = None
    json: Any = _UNSET
    if_match: int | None = None
    # A write names the capability it needs registered; reads leave it None.
    capability: str | None = None
    # What a 404 means. Left unset, a 404 is an error like any other status.
    when_missing: Any = _UNSET
    # time.monotonic() by which the call, retries included, must be over. None means no deadline.
    deadline: float | None = None

    def request_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"method": self.method, "url": self.path}
        if self.params:
            kwargs["params"] = {key: value for key, value in self.params.items() if value is not None}
        if self.json is not _UNSET:
            kwargs["json"] = self.json
        if self.if_match is not None:
            kwargs["headers"] = {"If-Match": str(self.if_match)}
        if self.deadline is not None:
            kwargs["timeout"] = min(self.seconds_left(), READ_TIMEOUT_SECONDS)
        return kwargs

    def seconds_left(self) -> 
```

### Core Architecture Module: `agents/crewai/src/nasiko_state.py`
```
"""Durable agent state over the platform's state API.

An A2A agent normally keeps its tasks in process memory, so a restart loses paused work
and the agent cannot run as more than one replica. This module is a drop-in replacement
that keeps that state in the platform instead.

    from nasiko_state import make_task_store

    handler = DefaultRequestHandler(
        agent_executor=MyExecutor(),
        task_store=make_task_store(),   # was: InMemoryTaskStore()
        agent_card=card,
    )
    app = Starlette(routes=...)
    install_shutdown_hooks(app)         # flush pending writes when the server stops

Configuration comes from the environment the platform injects into the container:

    NASIKO_STATE_URL     base URL of the state API (ends in /api/agent-state). Unset means the
                         platform provides no store, and every factory here returns the
                         in-memory implementation the SDK ships, so the same code runs locally.
    NASIKO_AGENT_TOKEN   this agent's state credential. It is the only one accepted: the MCP
                         gateway token is a different credential and is never used here.

Write guarantee (see NasikoTaskStore): a save that changes ``task.status.state`` is on the
server before ``save()`` returns. Other saves are coalesced to at most one write per
COALESCE_WINDOW_SECONDS per task and written on the next state change, by a background timer,
and by ``aclose()``. Nothing calls ``aclose()`` on its own: ``install_shutdown_hooks(app)`` runs
it when the server shuts down (uvicorn does that on SIGTERM and Ctrl-C), and an atexit hook
covers a normal interpreter exit. A hard crash (SIGKILL, power loss), or a SIGTERM in a process
without those hooks, can lose that window of non-status updates; so can an update the platform
could not take for PENDING_MAX_AGE_SECONDS, which is discarded rather than written late.

Both a2a-sdk majors are supported (0.3.x pydantic tasks and 1.x protobuf tasks). The langgraph
checkpointer needs the optional langgraph-checkpoint package; nothing else does.

This file is vendored: agent images are built from the agent's own directory only, so each
agent keeps a committed copy next to its main module. oss/agents/common is canonical and
oss/agents/common/check_vendored.py fails when a copy drifts.
"""

from __future__ import annotations

import asyncio
import atexit
import base64
import contextlib
import functools
import json
import logging
import os
import random
import signal
import threading
import time
from collections import OrderedDict
from collections.abc import AsyncIterator, Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, fields
from typing import Any, Generic, TypeVar
from urllib.parse import quote, urlsplit

import httpx
from a2a.server.tasks import InMemoryTaskStore, TaskStore
from a2a.types import Task

try:
    from a2a.types import a2a_pb2 as _a2a_pb2  # a2a-sdk 1.x: tasks are protobuf messages
except ImportError:
    _a2a_pb2 = None  # a2a-sdk 0.3.x: tasks are pydantic models

try:
    from langgraph.checkpoint.base import (
        WRITES_IDX_MAP,
        BaseCheckpointSaver,
        CheckpointTuple,
        get_checkpoint_metadata,
    )

    _LANGGRAPH_AVAILABLE = True
except ImportError:
    # langgraph is optional: only agents that checkpoint with it need the package.
    BaseCheckpointSaver = object  # type: ignore[assignment,misc]
    _LANGGRAPH_AVAILABLE = False

logger = logging.getLogger("nasiko_state")

STATE_URL_ENV = "NASIKO_STATE_URL"
AGENT_TOKEN_ENV = "NASIKO_AGENT_TOKEN"

CLIENT_NAME = "nasiko_state.py/1"

CONNECT_TIMEOUT_SECONDS = 2.0
READ_TIMEOUT_SECONDS = 10.0
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 0.2
# A rate-limited (429) request is retried after the Retry-After the server names, waiting at most
# MAX_RETRY_AFTER_SECONDS per attempt and RATE_LIMIT_BUDGET_SECONDS in all before the 429 surfaces.
# The platform's limit is a per-minute window shared by every replica of the agent, so a wait of a
# few seconds is usually enough, and a turn that keeps failing for half a minute should fail.
MAX_RETRY_AFTER_SECONDS = 5.0
RATE_LIMIT_BUDGET_SECONDS = 30.0
# The wait when a 429 names none (or names an HTTP date), and the shortest wait ever taken, so a
# server answering "Retry-After: 0" cannot turn the budget into a busy loop.
RATE_LIMIT_DEFAULT_WAIT_SECONDS = 1.0
RATE_LIMIT_MIN_WAIT_SECONDS = 0.5
# Relative spread of each 429 wait, so replicas limited at the same moment do not retry in step.
RATE_LIMIT_JITTER = 0.2
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50

# Saves that do not change a task's state are written at most once per window per task.
COALESCE_WINDOW_SECONDS = 0.5
# A deferred write that failed is retried after a delay that doubles per failure, up to this.
DEFERRED_RETRY_MAX_SECONDS = 10.0
# An unwritten update this old is presumed superseded (the task has most likely moved on to
# another replica), so it is discarded instead of being written over whatever is there now.
PENDING_MAX_AGE_SECONDS = 60.0
# Exiting with the platform unreachable must not hang for every pending task.
EXIT_FLUSH_BUDGET_SECONDS = 10.0
# A task id just looked up and not found reads as missing for this long without asking again.
# a2a-sdk 1.x looks a new task's id up several times before the task's first save, and that id is
# one the SDK generated for the request, so no other replica can have created the task meanwhile.
# A task that exists is always read from the server: another replica may have changed it.
ABSENT_CACHE_SECONDS = 2.0
# Bound on tasks whose write state is remembered. Forgetting an idle one costs its next write the
# version check: having no version to match, that write is unconditional.
MAX_TRACKED_TASKS = 4096
# The status a shell reports for a process ended by SIGTERM; kept when SIGTERM becomes an exit.
SIGTERM_EXIT_STATUS = 128 + signal.SIGTERM

# The order the registration contract spells its capability lists in.
CAPABILITY_ORDER = ("tasks", "kv")
# A startup registration that failed for a reason that may pass (no answer, 5xx, 429) is retried
# in the background after a delay that doubles from the first of these up to the second.
REGISTER_RETRY_FIRST_SECONDS = 1.0
REGISTER_RETRY_MAX_SECONDS = 60.0
REGISTER_THREAD_NAME = "nasiko-state-register"

T = TypeVar("T")


class NasikoStateError(Exception):
    """The state API refused a request or could not be reached.

    ``status`` and ``body`` carry the HTTP answer. Both are None for transport and
    configuration failures, where there was no answer.
    """

    def __init__(self, message: str, *, status: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status = status
        self.body = body


class NasikoStateMalformedRow(NasikoStateError):
    """A stored row cannot be read back as what it claims to be.

    Raised for a task written by the other a2a-sdk major (or not by this module at all), and for a
    damaged record. Never answered with a half-decoded object.
    """


class NasikoStateTooLarge(NasikoStateError):
    """The state API refused a value above its size limit (HTTP 413). Retrying cannot help."""


class NasikoStateConflict(NasikoStateError):
    """An ``If-Match`` precondition failed: another writer changed the row first.

    ``current_version`` is the version the server holds, or None if the body did not say.
    """

    def __init__(self, message: str, *, current_version: int | None, body: str | None = None):
        super().__init__(message, status=412, body=body)
        self.current_version = current_version


@dataclass(frozen=True)
class WriteReceipt:
    """What the server answers to a PUT. Task and KV writes share the three fields."""

    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class TaskRecord:
    """One stored task. ``body`` is the SDK's serialized Task, opaque to the server."""

    task_id: str
    context_id: str | None
    state: str
    body: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class KVRecord:
    """One stored key. ``value`` is opaque JSON."""

    key: str
    value: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class Page(Generic[T]):
    """One page of a listing. ``next_cursor`` is None on the last page."""

    items: list[T]
    next_cursor: str | None


# --- Operations ---------------------------------------------------------------------------------
#
# Each state API call is described once, as data, and executed by the sync or the async client
# method. That keeps request building, status handling and parsing in a single place.

_UNSET: Any = object()


@dataclass(frozen=True)
class _Operation:
    """One state API call: how to send it and how to read the answer."""

    method: str
    path: str
    parse: Callable[[httpx.Response], Any]
    ok_status: int = 200
    params: Mapping[str, str | int | None] | None = None
    json: Any = _UNSET
    if_match: int | None = None
    # A write names the capability it needs registered; reads leave it None.
    capability: str | None = None
    # What a 404 means. Left unset, a 404 is an error like any other status.
    when_missing: Any = _UNSET
    # time.monotonic() by which the call, retries included, must be over. None means no deadline.
    deadline: float | None = None

    def request_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"method": self.method, "url": self.path}
        if self.params:
            kwargs["params"] = {key: value for key, value in self.params.items() if value is not None}
        if self.json is not _UNSET:
            kwargs["json"] = self.json
        if self.if_match is not None:
            kwargs["headers"] = {"If-Match": str(self.if_match)}
        if self.deadline is not None:
            kwargs["timeout"] = min(self.seconds_left(), READ_TIMEOUT_SECONDS)
        return kwargs

    def seconds_left(self) -> 
```

### Core Architecture Module: `agents/currency-agent/nasiko_state.py`
```
"""Durable agent state over the platform's state API.

An A2A agent normally keeps its tasks in process memory, so a restart loses paused work
and the agent cannot run as more than one replica. This module is a drop-in replacement
that keeps that state in the platform instead.

    from nasiko_state import make_task_store

    handler = DefaultRequestHandler(
        agent_executor=MyExecutor(),
        task_store=make_task_store(),   # was: InMemoryTaskStore()
        agent_card=card,
    )
    app = Starlette(routes=...)
    install_shutdown_hooks(app)         # flush pending writes when the server stops

Configuration comes from the environment the platform injects into the container:

    NASIKO_STATE_URL     base URL of the state API (ends in /api/agent-state). Unset means the
                         platform provides no store, and every factory here returns the
                         in-memory implementation the SDK ships, so the same code runs locally.
    NASIKO_AGENT_TOKEN   this agent's state credential. It is the only one accepted: the MCP
                         gateway token is a different credential and is never used here.

Write guarantee (see NasikoTaskStore): a save that changes ``task.status.state`` is on the
server before ``save()`` returns. Other saves are coalesced to at most one write per
COALESCE_WINDOW_SECONDS per task and written on the next state change, by a background timer,
and by ``aclose()``. Nothing calls ``aclose()`` on its own: ``install_shutdown_hooks(app)`` runs
it when the server shuts down (uvicorn does that on SIGTERM and Ctrl-C), and an atexit hook
covers a normal interpreter exit. A hard crash (SIGKILL, power loss), or a SIGTERM in a process
without those hooks, can lose that window of non-status updates; so can an update the platform
could not take for PENDING_MAX_AGE_SECONDS, which is discarded rather than written late.

Both a2a-sdk majors are supported (0.3.x pydantic tasks and 1.x protobuf tasks). The langgraph
checkpointer needs the optional langgraph-checkpoint package; nothing else does.

This file is vendored: agent images are built from the agent's own directory only, so each
agent keeps a committed copy next to its main module. oss/agents/common is canonical and
oss/agents/common/check_vendored.py fails when a copy drifts.
"""

from __future__ import annotations

import asyncio
import atexit
import base64
import contextlib
import functools
import json
import logging
import os
import random
import signal
import threading
import time
from collections import OrderedDict
from collections.abc import AsyncIterator, Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, fields
from typing import Any, Generic, TypeVar
from urllib.parse import quote, urlsplit

import httpx
from a2a.server.tasks import InMemoryTaskStore, TaskStore
from a2a.types import Task

try:
    from a2a.types import a2a_pb2 as _a2a_pb2  # a2a-sdk 1.x: tasks are protobuf messages
except ImportError:
    _a2a_pb2 = None  # a2a-sdk 0.3.x: tasks are pydantic models

try:
    from langgraph.checkpoint.base import (
        WRITES_IDX_MAP,
        BaseCheckpointSaver,
        CheckpointTuple,
        get_checkpoint_metadata,
    )

    _LANGGRAPH_AVAILABLE = True
except ImportError:
    # langgraph is optional: only agents that checkpoint with it need the package.
    BaseCheckpointSaver = object  # type: ignore[assignment,misc]
    _LANGGRAPH_AVAILABLE = False

logger = logging.getLogger("nasiko_state")

STATE_URL_ENV = "NASIKO_STATE_URL"
AGENT_TOKEN_ENV = "NASIKO_AGENT_TOKEN"

CLIENT_NAME = "nasiko_state.py/1"

CONNECT_TIMEOUT_SECONDS = 2.0
READ_TIMEOUT_SECONDS = 10.0
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 0.2
# A rate-limited (429) request is retried after the Retry-After the server names, waiting at most
# MAX_RETRY_AFTER_SECONDS per attempt and RATE_LIMIT_BUDGET_SECONDS in all before the 429 surfaces.
# The platform's limit is a per-minute window shared by every replica of the agent, so a wait of a
# few seconds is usually enough, and a turn that keeps failing for half a minute should fail.
MAX_RETRY_AFTER_SECONDS = 5.0
RATE_LIMIT_BUDGET_SECONDS = 30.0
# The wait when a 429 names none (or names an HTTP date), and the shortest wait ever taken, so a
# server answering "Retry-After: 0" cannot turn the budget into a busy loop.
RATE_LIMIT_DEFAULT_WAIT_SECONDS = 1.0
RATE_LIMIT_MIN_WAIT_SECONDS = 0.5
# Relative spread of each 429 wait, so replicas limited at the same moment do not retry in step.
RATE_LIMIT_JITTER = 0.2
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50

# Saves that do not change a task's state are written at most once per window per task.
COALESCE_WINDOW_SECONDS = 0.5
# A deferred write that failed is retried after a delay that doubles per failure, up to this.
DEFERRED_RETRY_MAX_SECONDS = 10.0
# An unwritten update this old is presumed superseded (the task has most likely moved on to
# another replica), so it is discarded instead of being written over whatever is there now.
PENDING_MAX_AGE_SECONDS = 60.0
# Exiting with the platform unreachable must not hang for every pending task.
EXIT_FLUSH_BUDGET_SECONDS = 10.0
# A task id just looked up and not found reads as missing for this long without asking again.
# a2a-sdk 1.x looks a new task's id up several times before the task's first save, and that id is
# one the SDK generated for the request, so no other replica can have created the task meanwhile.
# A task that exists is always read from the server: another replica may have changed it.
ABSENT_CACHE_SECONDS = 2.0
# Bound on tasks whose write state is remembered. Forgetting an idle one costs its next write the
# version check: having no version to match, that write is unconditional.
MAX_TRACKED_TASKS = 4096
# The status a shell reports for a process ended by SIGTERM; kept when SIGTERM becomes an exit.
SIGTERM_EXIT_STATUS = 128 + signal.SIGTERM

# The order the registration contract spells its capability lists in.
CAPABILITY_ORDER = ("tasks", "kv")
# A startup registration that failed for a reason that may pass (no answer, 5xx, 429) is retried
# in the background after a delay that doubles from the first of these up to the second.
REGISTER_RETRY_FIRST_SECONDS = 1.0
REGISTER_RETRY_MAX_SECONDS = 60.0
REGISTER_THREAD_NAME = "nasiko-state-register"

T = TypeVar("T")


class NasikoStateError(Exception):
    """The state API refused a request or could not be reached.

    ``status`` and ``body`` carry the HTTP answer. Both are None for transport and
    configuration failures, where there was no answer.
    """

    def __init__(self, message: str, *, status: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status = status
        self.body = body


class NasikoStateMalformedRow(NasikoStateError):
    """A stored row cannot be read back as what it claims to be.

    Raised for a task written by the other a2a-sdk major (or not by this module at all), and for a
    damaged record. Never answered with a half-decoded object.
    """


class NasikoStateTooLarge(NasikoStateError):
    """The state API refused a value above its size limit (HTTP 413). Retrying cannot help."""


class NasikoStateConflict(NasikoStateError):
    """An ``If-Match`` precondition failed: another writer changed the row first.

    ``current_version`` is the version the server holds, or None if the body did not say.
    """

    def __init__(self, message: str, *, current_version: int | None, body: str | None = None):
        super().__init__(message, status=412, body=body)
        self.current_version = current_version


@dataclass(frozen=True)
class WriteReceipt:
    """What the server answers to a PUT. Task and KV writes share the three fields."""

    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class TaskRecord:
    """One stored task. ``body`` is the SDK's serialized Task, opaque to the server."""

    task_id: str
    context_id: str | None
    state: str
    body: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class KVRecord:
    """One stored key. ``value`` is opaque JSON."""

    key: str
    value: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class Page(Generic[T]):
    """One page of a listing. ``next_cursor`` is None on the last page."""

    items: list[T]
    next_cursor: str | None


# --- Operations ---------------------------------------------------------------------------------
#
# Each state API call is described once, as data, and executed by the sync or the async client
# method. That keeps request building, status handling and parsing in a single place.

_UNSET: Any = object()


@dataclass(frozen=True)
class _Operation:
    """One state API call: how to send it and how to read the answer."""

    method: str
    path: str
    parse: Callable[[httpx.Response], Any]
    ok_status: int = 200
    params: Mapping[str, str | int | None] | None = None
    json: Any = _UNSET
    if_match: int | None = None
    # A write names the capability it needs registered; reads leave it None.
    capability: str | None = None
    # What a 404 means. Left unset, a 404 is an error like any other status.
    when_missing: Any = _UNSET
    # time.monotonic() by which the call, retries included, must be over. None means no deadline.
    deadline: float | None = None

    def request_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"method": self.method, "url": self.path}
        if self.params:
            kwargs["params"] = {key: value for key, value in self.params.items() if value is not None}
        if self.json is not _UNSET:
            kwargs["json"] = self.json
        if self.if_match is not None:
            kwargs["headers"] = {"If-Match": str(self.if_match)}
        if self.deadline is not None:
            kwargs["timeout"] = min(self.seconds_left(), READ_TIMEOUT_SECONDS)
        return kwargs

    def seconds_left(self) -> 
```

### Core Architecture Module: `agents/google-adk/src/nasiko_state.py`
```
"""Durable agent state over the platform's state API.

An A2A agent normally keeps its tasks in process memory, so a restart loses paused work
and the agent cannot run as more than one replica. This module is a drop-in replacement
that keeps that state in the platform instead.

    from nasiko_state import make_task_store

    handler = DefaultRequestHandler(
        agent_executor=MyExecutor(),
        task_store=make_task_store(),   # was: InMemoryTaskStore()
        agent_card=card,
    )
    app = Starlette(routes=...)
    install_shutdown_hooks(app)         # flush pending writes when the server stops

Configuration comes from the environment the platform injects into the container:

    NASIKO_STATE_URL     base URL of the state API (ends in /api/agent-state). Unset means the
                         platform provides no store, and every factory here returns the
                         in-memory implementation the SDK ships, so the same code runs locally.
    NASIKO_AGENT_TOKEN   this agent's state credential. It is the only one accepted: the MCP
                         gateway token is a different credential and is never used here.

Write guarantee (see NasikoTaskStore): a save that changes ``task.status.state`` is on the
server before ``save()`` returns. Other saves are coalesced to at most one write per
COALESCE_WINDOW_SECONDS per task and written on the next state change, by a background timer,
and by ``aclose()``. Nothing calls ``aclose()`` on its own: ``install_shutdown_hooks(app)`` runs
it when the server shuts down (uvicorn does that on SIGTERM and Ctrl-C), and an atexit hook
covers a normal interpreter exit. A hard crash (SIGKILL, power loss), or a SIGTERM in a process
without those hooks, can lose that window of non-status updates; so can an update the platform
could not take for PENDING_MAX_AGE_SECONDS, which is discarded rather than written late.

Both a2a-sdk majors are supported (0.3.x pydantic tasks and 1.x protobuf tasks). The langgraph
checkpointer needs the optional langgraph-checkpoint package; nothing else does.

This file is vendored: agent images are built from the agent's own directory only, so each
agent keeps a committed copy next to its main module. oss/agents/common is canonical and
oss/agents/common/check_vendored.py fails when a copy drifts.
"""

from __future__ import annotations

import asyncio
import atexit
import base64
import contextlib
import functools
import json
import logging
import os
import random
import signal
import threading
import time
from collections import OrderedDict
from collections.abc import AsyncIterator, Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, fields
from typing import Any, Generic, TypeVar
from urllib.parse import quote, urlsplit

import httpx
from a2a.server.tasks import InMemoryTaskStore, TaskStore
from a2a.types import Task

try:
    from a2a.types import a2a_pb2 as _a2a_pb2  # a2a-sdk 1.x: tasks are protobuf messages
except ImportError:
    _a2a_pb2 = None  # a2a-sdk 0.3.x: tasks are pydantic models

try:
    from langgraph.checkpoint.base import (
        WRITES_IDX_MAP,
        BaseCheckpointSaver,
        CheckpointTuple,
        get_checkpoint_metadata,
    )

    _LANGGRAPH_AVAILABLE = True
except ImportError:
    # langgraph is optional: only agents that checkpoint with it need the package.
    BaseCheckpointSaver = object  # type: ignore[assignment,misc]
    _LANGGRAPH_AVAILABLE = False

logger = logging.getLogger("nasiko_state")

STATE_URL_ENV = "NASIKO_STATE_URL"
AGENT_TOKEN_ENV = "NASIKO_AGENT_TOKEN"

CLIENT_NAME = "nasiko_state.py/1"

CONNECT_TIMEOUT_SECONDS = 2.0
READ_TIMEOUT_SECONDS = 10.0
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 0.2
# A rate-limited (429) request is retried after the Retry-After the server names, waiting at most
# MAX_RETRY_AFTER_SECONDS per attempt and RATE_LIMIT_BUDGET_SECONDS in all before the 429 surfaces.
# The platform's limit is a per-minute window shared by every replica of the agent, so a wait of a
# few seconds is usually enough, and a turn that keeps failing for half a minute should fail.
MAX_RETRY_AFTER_SECONDS = 5.0
RATE_LIMIT_BUDGET_SECONDS = 30.0
# The wait when a 429 names none (or names an HTTP date), and the shortest wait ever taken, so a
# server answering "Retry-After: 0" cannot turn the budget into a busy loop.
RATE_LIMIT_DEFAULT_WAIT_SECONDS = 1.0
RATE_LIMIT_MIN_WAIT_SECONDS = 0.5
# Relative spread of each 429 wait, so replicas limited at the same moment do not retry in step.
RATE_LIMIT_JITTER = 0.2
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50

# Saves that do not change a task's state are written at most once per window per task.
COALESCE_WINDOW_SECONDS = 0.5
# A deferred write that failed is retried after a delay that doubles per failure, up to this.
DEFERRED_RETRY_MAX_SECONDS = 10.0
# An unwritten update this old is presumed superseded (the task has most likely moved on to
# another replica), so it is discarded instead of being written over whatever is there now.
PENDING_MAX_AGE_SECONDS = 60.0
# Exiting with the platform unreachable must not hang for every pending task.
EXIT_FLUSH_BUDGET_SECONDS = 10.0
# A task id just looked up and not found reads as missing for this long without asking again.
# a2a-sdk 1.x looks a new task's id up several times before the task's first save, and that id is
# one the SDK generated for the request, so no other replica can have created the task meanwhile.
# A task that exists is always read from the server: another replica may have changed it.
ABSENT_CACHE_SECONDS = 2.0
# Bound on tasks whose write state is remembered. Forgetting an idle one costs its next write the
# version check: having no version to match, that write is unconditional.
MAX_TRACKED_TASKS = 4096
# The status a shell reports for a process ended by SIGTERM; kept when SIGTERM becomes an exit.
SIGTERM_EXIT_STATUS = 128 + signal.SIGTERM

# The order the registration contract spells its capability lists in.
CAPABILITY_ORDER = ("tasks", "kv")
# A startup registration that failed for a reason that may pass (no answer, 5xx, 429) is retried
# in the background after a delay that doubles from the first of these up to the second.
REGISTER_RETRY_FIRST_SECONDS = 1.0
REGISTER_RETRY_MAX_SECONDS = 60.0
REGISTER_THREAD_NAME = "nasiko-state-register"

T = TypeVar("T")


class NasikoStateError(Exception):
    """The state API refused a request or could not be reached.

    ``status`` and ``body`` carry the HTTP answer. Both are None for transport and
    configuration failures, where there was no answer.
    """

    def __init__(self, message: str, *, status: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status = status
        self.body = body


class NasikoStateMalformedRow(NasikoStateError):
    """A stored row cannot be read back as what it claims to be.

    Raised for a task written by the other a2a-sdk major (or not by this module at all), and for a
    damaged record. Never answered with a half-decoded object.
    """


class NasikoStateTooLarge(NasikoStateError):
    """The state API refused a value above its size limit (HTTP 413). Retrying cannot help."""


class NasikoStateConflict(NasikoStateError):
    """An ``If-Match`` precondition failed: another writer changed the row first.

    ``current_version`` is the version the server holds, or None if the body did not say.
    """

    def __init__(self, message: str, *, current_version: int | None, body: str | None = None):
        super().__init__(message, status=412, body=body)
        self.current_version = current_version


@dataclass(frozen=True)
class WriteReceipt:
    """What the server answers to a PUT. Task and KV writes share the three fields."""

    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class TaskRecord:
    """One stored task. ``body`` is the SDK's serialized Task, opaque to the server."""

    task_id: str
    context_id: str | None
    state: str
    body: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class KVRecord:
    """One stored key. ``value`` is opaque JSON."""

    key: str
    value: Any
    version: int
    updated_at: str
    expires_at: str


@dataclass(frozen=True)
class Page(Generic[T]):
    """One page of a listing. ``next_cursor`` is None on the last page."""

    items: list[T]
    next_cursor: str | None


# --- Operations ---------------------------------------------------------------------------------
#
# Each state API call is described once, as data, and executed by the sync or the async client
# method. That keeps request building, status handling and parsing in a single place.

_UNSET: Any = object()


@dataclass(frozen=True)
class _Operation:
    """One state API call: how to send it and how to read the answer."""

    method: str
    path: str
    parse: Callable[[httpx.Response], Any]
    ok_status: int = 200
    params: Mapping[str, str | int | None] | None = None
    json: Any = _UNSET
    if_match: int | None = None
    # A write names the capability it needs registered; reads leave it None.
    capability: str | None = None
    # What a 404 means. Left unset, a 404 is an error like any other status.
    when_missing: Any = _UNSET
    # time.monotonic() by which the call, retries included, must be over. None means no deadline.
    deadline: float | None = None

    def request_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"method": self.method, "url": self.path}
        if self.params:
            kwargs["params"] = {key: value for key, value in self.params.items() if value is not None}
        if self.json is not _UNSET:
            kwargs["json"] = self.json
        if self.if_match is not None:
            kwargs["headers"] = {"If-Match": str(self.if_match)}
        if self.deadline is not None:
            kwargs["timeout"] = min(self.seconds_left(), READ_TIMEOUT_SECONDS)
        return kwargs

    def seconds_left(self) -> 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #367** (2026-11-16): **Remove files the private tree deleted before the sync manifest existed**
  *Symptoms*: ## Problem  `docker compose up -d` fails on a fresh clone of this repo:  ``` ERR_PNPM_PACKAGE_MANAGER_NO_IMPORTER Cannot install with "frozen-lockfile" because pnpm-lock.yaml has no `importers["shared/config"]` entry. ```  `ui/shared/config` and `ui/shared/contracts` were deleted upstream, along with 400+ other UI files, but they are still here. The published `ui/pnpm-lock.yaml` is generated from the upstream tree, so it has no entry for these packages, and pnpm refuses to install.  ## Why they were never removed  The sync's reconcile pass deletes only paths recorded in `.sync-manifest`. These files were published before the manifest existed, so their upstream deletions never reached this repo. Files deleted from now on are in the manifest and are removed automatically, so this is a one-time cleanup.  ## What this deletes (426 files)  - `ui/` (416): leftovers from the React UI refactor, including the two orphaned packages. `ui/shared/ui/src/styles/SHADCN-LICENSE.md` is kept: shadcn code is still vendored and its MIT notice must stay with it - `gateway/src/` (2): the removed gateway; not a workspace member - `server/tests/fixtures/spa/` (8): moved to `spa/tests/fixtures/spa/`, which is what `spa/src/lib.rs` embeds  `LICENSE`, `.sync-marker` and `.sync-manifest` exist only in this repo on purpose and are kept.  Every deleted file was first added by a replayed upstream commit. None came from a public PR.  ## Verification  With these files removed, the `ui` stage of `server/Docke

- **Issue #366** (2026-11-23): **chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates**
  *Symptoms*: Bumps the npm_and_yarn group with 2 updates in the /ui directory: [storybook](https://github.com/storybookjs/storybook/tree/HEAD/code/core) and [vite](https://github.com/vitejs/vite/tree/HEAD/packages/vite).  Updates `storybook` from 10.6.0 to 10.6.2 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/storybookjs/storybook/releases">storybook's releases</a>.</em></p> <blockquote> <h2>v10.6.2</h2> <h2>10.6.2</h2> <ul> <li>Angular-Vite: Require <code>@​analogjs/vite-plugin-angular</code> 2.7.3 or later - <a href="https://redirect.github.com/storybookjs/storybook/pull/36525">#36525</a>, thanks <a href="https://github.com/valentinpalkovic"><code>@​valentinpalkovic</code></a>!</li> <li>CLI: Fix hidden output of CLI commands on Yarn 1 - <a href="https://redirect.github.com/storybookjs/storybook/pull/36419">#36419</a>, thanks <a href="https://github.com/kasperpeulen"><code>@​kasperpeulen</code></a>!</li> <li>Preact: Support Preact 11 - <a href="https://redirect.github.com/storybookjs/storybook/pull/36526">#36526</a>, thanks <a href="https://github.com/ghengeveld"><code>@​ghengeveld</code></a>!</li> <li>Security: Patch GHSA-f2ph-cmg5-wxc8 and GHSA-px85-f4q5-jh77 - <a href="https://redirect.github.com/storybookjs/storybook/pull/36726">#36726</a>, thanks <a href="https://github.com/Sidnioulz"><code>@​Sidnioulz</code></a>!</li> <li>Typescript: Explicitly type enhanceArgTypes - <a href="https://redirect.github.com/storybookjs/storybook/pull/35664">#

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

### Incident Patch 1: `f42d5f18` (2026-11-26)
**Commit Message**: A declined deploy never leaves an agent deploying or overwrites a status changed during the build
[synced-from-private]

**File**: `server/src/agents/update.rs` (modified, +28/-9)
```diff
@@ -121,13 +121,14 @@ pub(crate) async fn update_agent(
         name: String,
         version: String,
         image: Option<String>,
+        status: String,
         owner_id: Uuid,
         writable: bool,
         writable_path: Option<String>,
     }
 
     let agent: Option<UpdateAgentRow> = match sqlx::query_as(
-        "SELECT name, version, image, owner_id, writable, writable_path FROM agents WHERE id = $1",
+        "SELECT name, version, image, status, owner_id, writable, writable_path FROM agents WHERE id = $1",
     )
     .bind(agent_id)
     .fetch_optional(&state.db)
@@ -144,6 +145,7 @@ pub(crate) async fn update_agent(
         name: agent_name,
         version: current_version,
         image: prev_image,
+        status: prev_status,
         owner_id: agent_owner_id,
         writable,
         writable_path,
@@ -385,6 +387,7 @@ pub(crate) async fn update_agent(
         new_version: new_version.clone(),
         prev_version: current_version.clone(),
         prev_image,
+        prev_status: Some(prev_status),
         changelog,
         writable,
         writable_path,
@@ -514,6 +517,7 @@ pub async fn execute_agent_update(
     new_version: String,
     prev_version: String,
     prev_image: Option<String>,
+    prev_status: Option<String>,
     changelog: Option<String>,
     writable: bool,
     writable_path: Option<String>,
@@ -530,6 +534,8 @@ pub async fn execute_agent_update(
 
     // The image build's captured output, filled once the build runs so the Builds tab can show it.
     let mut build_logs = String::new();
+    // Set when the runtime declines the deploy, so the user is told why instead of a generic reason.
+    let mut declined = None;
 
     let result: Result<(DeploymentStatus, Vec<i32>), String> = async {
         // Resolve the source directory — either from a zip or a GitHub re-deploy.
@@ -642,10 +648,10 @@ pub async fn execute_agent_update(
         // Capture the ports build_agent_spec actually resolved (defaults empty -> 8000)
         // so they can be persisted below (RUN-3b) — restart reads this back.
         let spec_ports: Vec<i32> = spec.ports.iter().map(|&p| p as i32).collect();
-        let deploy_status = scaling
-            .deploy(&spec)
-            .await
-            .map_err(|e| format!("deploy: {e}"))?;
+        let deploy_status = scaling.deploy(&spec).await.map_err(|e| {
+            declined = super::utils::declined_message(&e);
+            format!("deploy: {e}")
+        })?;
 
         set_upload_status(
             db,
@@ -741,21 +747,34 @@ pub async fn execute_agent_update(
             // Roll back both version and image so the row stays consistent with
             // what is actually running. prev_image is None only for the very first
             // deploy, in which case NULL is the correct fallback anyway.
+            // A deploy the runtime declined is no failure of the agent, which keeps the status it
+            // had (a stopped or parked agent stays so); a job queued before the status was carried
+            // has none to restore and ends `failed`, as does one that read another update's
+            // `deploying` placeholder.
+            let status = match (&declined, &prev_status) {
+                (Some(_), Some(prev)) if prev != "deploying" => prev.as_str(),
+                _ => "failed",
+            };
+            // The status moves only while the row still says `deploying`: one someone set during
+            // the build (a stop) is not overwritten.
             let _ = sqlx::query(
-                "UPDATE agents SET status = 'failed', version = $2, image = $3, updated_at = now() \
-                 WHERE id = $1",
+                "UPDATE agents SET \
+                 status = CASE WHEN status = 'deploying' THEN $4 ELSE status END, \
+                 version = $2, image = $3, updated_at = now() WHERE id = $1",
             )
             .bind(agent_id)
             .bind(&prev_version)
             .bind(&prev_image)
+            .bind(status)
             .execute(db)
             .await;
 
             set_build_status(db, build_id, BuildStatus::Failed).await;
             // Persist what explains the failure on the build row: the build output when the image
             // built, otherwise the error text, which carries the builder's own log for a build
             // failure. The `upload_status.error_message` column stays a generic reason because
-            // clients read it via GET /agents/uploads; the detail lives in the build logs.
+            // clients read it via GET /agents/uploads; the detail lives in the build logs. A deploy
+            // the runtime declined is the exception: its message is the reason, worded for the user.
             store_build_logs(
                 db,
                 state.oci_storage.as_ref(),
@@ -774,7 +793,7 @@ pub async fn execute_agent_update(
                 owner_id,
                 "failed",
                 None,
-                Some("agen
```

**File**: `server/src/agents/upload.rs` (modified, +88/-12)
```diff
@@ -165,6 +165,16 @@ pub enum BuildJobPayload {
         /// `agent` (an HTTP agent), preserving their behavior.
         #[serde(default)]
         workload_kind: String,
+        /// The agent's `version`/`image`/`status` before this upload overwrote them with the
+        /// placeholder, `None` for a new agent: put back if the runtime declines the deploy.
+        /// `#[serde(default)]` so job rows queued before these fields existed still
+        /// deserialize (a declined deploy then ends as it always did).
+        #[serde(default)]
+        prior_version: Option<String>,
+        #[serde(default)]
+        prior_image: Option<String>,
+        #[serde(default)]
+        prior_status: Option<String>,
     },
     /// In-place agent update (PUT /api/agents/{id}/update).
     Update {
@@ -186,6 +196,10 @@ pub enum BuildJobPayload {
         new_version: String,
         prev_version: String,
         prev_image: Option<String>,
+        /// The agent's `status` before the update marked it deploying: put back if the runtime
+        /// declines the deploy. `#[serde(default)]` for job rows queued before this field existed.
+        #[serde(default)]
+        prev_status: Option<String>,
         changelog: Option<String>,
         /// Carried forward from `agents.writable` — this endpoint has no flag of
         /// its own to set it (see `update_agent`'s fetch of the agent row).
@@ -644,6 +658,27 @@ pub(crate) async fn upload_and_deploy(
         return refusal.into_response();
     }
 
+    // What an existing agent is before the upsert below overwrites it, so a deploy the runtime
+    // declines can put it back.
+    let (prior_version, prior_image, prior_status) =
+        match sqlx::query_as::<_, (String, Option<String>, String)>(
+            "SELECT version, image, status FROM agents \
+         WHERE name = $1 AND owner_id = $2 AND deleted_at IS NULL",
+        )
+        .bind(&name)
+        .bind(owner_id)
+        .fetch_optional(&mut *tx)
+        .await
+        {
+            Ok(Some((version, image, status))) => (Some(version), image, Some(status)),
+            Ok(None) => (None, None, None),
+            Err(e) => {
+                tracing::error!(%e, agent_name = %name, "upload: read prior agent state db error");
+                let _ = tokio::fs::remove_dir_all(zip_path.parent().unwrap_or(&zip_path)).await;
+                return (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response();
+            }
+        };
+
     // Atomic INSERT ... ON CONFLICT against the (owner_id, name) partial unique
     // index (migration 015) — closes the SELECT-then-INSERT TOCTOU that let two
     // concurrent same-name uploads create duplicate rows (SRV-2).
@@ -788,6 +823,9 @@ pub(crate) async fn upload_and_deploy(
         writable,
         writable_path: writable_path.clone(),
         workload_kind: workload_kind.clone(),
+        prior_version,
+        prior_image,
+        prior_status,
     };
 
     let payload_value = match serde_json::to_value(&payload) {
@@ -1079,6 +1117,10 @@ pub async fn execute_upload_and_deploy(
     writable: bool,
     writable_path: Option<String>,
     workload_kind: nasiko_runtime::WorkloadKind,
+    // What an existing agent was before this upload overwrote it, `None` for a new one.
+    prior_version: Option<String>,
+    prior_image: Option<String>,
+    prior_status: Option<String>,
 ) {
     let db = &state.db;
     let runtime = &state.runtime;
@@ -1091,6 +1133,8 @@ pub async fn execute_upload_and_deploy(
 
     // The image build's captured output, filled once the build runs so the Builds tab can show it.
     let mut build_logs = String::new();
+    // Set when the runtime declines the deploy, so the user is told why instead of a generic reason.
+    let mut declined = None;
     let result: Result<DeploymentStatus, String> = async {
         // Extract zip (with guards — re-run here so the worker is self-contained).
         let zp = zip_path.clone();
@@ -1184,10 +1228,10 @@ pub async fn execute_upload_and_deploy(
             agent_id,
         )
         .await;
-        let deploy_status = scaling
-            .deploy(&spec)
-            .await
-            .map_err(|e| format!("deploy: {e}"))?;
+        let deploy_status = scaling.deploy(&spec).await.map_err(|e| {
+            declined = super::utils::declined_message(&e);
+            format!("deploy: {e}")
+        })?;
 
         set_upload_status(
             db,
@@ -1274,6 +1318,8 @@ pub async fn execute_upload_and_deploy(
             // built (a later step failed), otherwise the error text, which carries the builder's
             // own log for a build failure. `upload_status.error_message` stays a generic reason
             // because clients read it via GET /agents/uploads; the detail lives in the build logs.
+            // A deploy the runtime declined is the exception: its message is the reason, worded
+            // for the user.
             store_build_logs(
 
```

**File**: `server/tests/agent_update_rollback.rs` (modified, +98/-0)
```diff
@@ -1049,6 +1049,104 @@ async fn a_declined_deploy_of_an_update_puts_the_agent_back_as_it_was_and_tells_
     server.cleanup().await;
 }
 
+/// An update submitted while another is still queued reads that one's `deploying` placeholder as
+/// the agent's status. Putting that back when the runtime declines would leave the row `deploying`
+/// with no job left to move it: the agent ends `failed`, its version and image rolled back.
+#[tokio::test]
+#[serial]
+async fn a_declined_deploy_of_an_update_that_read_a_deploying_placeholder_ends_failed() {
+    let server = common::TestServer::start().await;
+    let admin = init_admin(&server).await;
+    let uid = admin["user_id"].as_str().unwrap();
+    let agent_id = seed_stopped_agent(&server, uid, "declined-behind-another-update").await;
+    sqlx::query("UPDATE agents SET status = 'deploying' WHERE id = $1")
+        .bind(agent_id.parse::<Uuid>().unwrap())
+        .execute(&server.db)
+        .await
+        .unwrap();
+    server
+        .runtime
+        .set_decline_deploy(Some((DECLINED_CODE, DECLINED_MESSAGE)));
+
+    let queued: Value = do_update(&server, uid, &agent_id, None, Some(buildable_zip()))
+        .await
+        .json()
+        .await
+        .unwrap();
+    let build_id = queued["build_id"].as_str().unwrap();
+    assert_eq!(
+        wait_for_terminal_build(&server, uid, build_id).await,
+        "failed"
+    );
+
+    assert_eq!(
+        agent_version_image_status(&server, &agent_id).await,
+        (
+            "1.0.0".to_owned(),
+            Some("nasiko/stopped:1.0.0".to_owned()),
+            "failed".to_owned()
+        )
+    );
+    server.cleanup().await;
+}
+
+/// A stop issued while the update builds is the agent's status now: a declined deploy rolls the
+/// version and image back but does not overwrite the status with the one the update read.
+#[tokio::test]
+#[serial]
+async fn a_declined_deploy_of_an_update_does_not_overwrite_a_status_changed_during_the_build() {
+    let server = common::TestServer::start().await;
+    let admin = init_admin(&server).await;
+    let uid = admin["user_id"].as_str().unwrap();
+    let agent_id = seed_stopped_agent(&server, uid, "stopped-during-update").await;
+    let agent_uuid = agent_id.parse::<Uuid>().unwrap();
+    sqlx::query("UPDATE agents SET status = 'running' WHERE id = $1")
+        .bind(agent_uuid)
+        .execute(&server.db)
+        .await
+        .unwrap();
+    server
+        .runtime
+        .set_decline_deploy(Some((DECLINED_CODE, DECLINED_MESSAGE)));
+    let build_gate = server.runtime.hold_builds();
+
+    let queued: Value = do_update(&server, uid, &agent_id, None, Some(buildable_zip()))
+        .await
+        .json()
+        .await
+        .unwrap();
+    let build_id = queued["build_id"].as_str().unwrap();
+    for _ in 0..40 {
+        if server.runtime.builds_started() > 0 {
+            break;
+        }
+        tokio::time::sleep(Duration::from_millis(200)).await;
+    }
+    assert_eq!(server.runtime.builds_started(), 1, "the build is running");
+
+    sqlx::query("UPDATE agents SET status = 'stopped' WHERE id = $1")
+        .bind(agent_uuid)
+        .execute(&server.db)
+        .await
+        .unwrap();
+    build_gate.notify_one();
+    assert_eq!(
+        wait_for_terminal_build(&server, uid, build_id).await,
+        "failed"
+    );
+
+    assert_eq!(
+        agent_version_image_status(&server, &agent_id).await,
+        (
+            "1.0.0".to_owned(),
+            Some("nasiko/stopped:1.0.0".to_owned()),
+            "stopped".to_owned()
+        ),
+        "the stop stays, the version and image are rolled back"
+    );
+    server.cleanup().await;
+}
+
 /// The contrast: a deploy that fails for any other reason still marks the agent `failed`, with the
 /// generic reason.
 #[tokio::test]
```

**File**: `server/tests/agent_upload.rs` (modified, +129/-0)
```diff
@@ -833,6 +833,135 @@ async fn a_declined_deploy_of_a_reupload_puts_the_existing_agent_back_and_tells_
     server.cleanup().await;
 }
 
+/// Polls the agent until `reached` holds of its version, image and status: the restore that ends a
+/// failed build runs after the build's own status is written.
+async fn wait_for_agent_state(
+    server: &common::TestServer,
+    agent_id: uuid::Uuid,
+    reached: impl Fn(&(String, Option<String>, String)) -> bool,
+) -> (String, Option<String>, String) {
+    let mut state = None;
+    for _ in 0..40 {
+        state = agent_state(server, agent_id).await;
+        if let Some(state) = state.as_ref().filter(|state| reached(state)) {
+            return state.clone();
+        }
+        tokio::time::sleep(Duration::from_millis(250)).await;
+    }
+    panic!("agent {agent_id} did not reach the expected state, last read {state:?}");
+}
+
+/// A second upload of a not-running agent, submitted while the first is still queued, reads the
+/// first one's `deploying` placeholder as the agent's state. Putting that back when the runtime
+/// declines would leave the row `deploying` with no job left to move it: it ends `failed`, with
+/// the row kept.
+#[tokio::test]
+#[serial]
+async fn a_declined_deploy_that_read_a_deploying_placeholder_ends_failed_not_deploying() {
+    let server = common::TestServer::start().await;
+    let admin = init_admin(&server).await;
+    let uid = admin["user_id"].as_str().unwrap();
+    let agent_id = seed_stopped_cli_agent(&server, uid, "declined-behind-another").await;
+    sqlx::query("UPDATE agents SET status = 'deploying' WHERE id = $1")
+        .bind(agent_id)
+        .execute(&server.db)
+        .await
+        .unwrap();
+    server
+        .runtime
+        .set_decline_deploy(Some((DECLINED_CODE, DECLINED_MESSAGE)));
+
+    let queued: Value = upload(
+        &server,
+        uid,
+        vec![
+            ("name", "declined-behind-another".into()),
+            ("version_tag", "1.1.0".into()),
+        ],
+        Some(make_valid_structure_zip()),
+    )
+    .await
+    .json()
+    .await
+    .unwrap();
+    let build_id = queued["data"]["build_id"].as_str().unwrap();
+    assert_eq!(
+        wait_for_terminal_status(&server, uid, build_id).await,
+        "failed"
+    );
+
+    let (_, _, status) =
+        wait_for_agent_state(&server, agent_id, |(_, _, status)| status != "deploying").await;
+    assert_eq!(status, "failed");
+    server.cleanup().await;
+}
+
+/// A stop issued while the build runs is the agent's status now: a declined deploy puts the
+/// version and image back but does not overwrite the status with the one the upload read.
+#[tokio::test]
+#[serial]
+async fn a_declined_deploy_does_not_overwrite_a_status_changed_during_the_build() {
+    let server = common::TestServer::start().await;
+    let admin = init_admin(&server).await;
+    let uid = admin["user_id"].as_str().unwrap();
+    let agent_id = seed_stopped_cli_agent(&server, uid, "stopped-during-build").await;
+    sqlx::query("UPDATE agents SET status = 'running' WHERE id = $1")
+        .bind(agent_id)
+        .execute(&server.db)
+        .await
+        .unwrap();
+    server
+        .runtime
+        .set_decline_deploy(Some((DECLINED_CODE, DECLINED_MESSAGE)));
+    let build_gate = server.runtime.hold_builds();
+
+    let queued: Value = upload(
+        &server,
+        uid,
+        vec![
+            ("name", "stopped-during-build".into()),
+            ("version_tag", "1.1.0".into()),
+        ],
+        Some(make_valid_structure_zip()),
+    )
+    .await
+    .json()
+    .await
+    .unwrap();
+    let build_id = queued["data"]["build_id"].as_str().unwrap();
+    for _ in 0..40 {
+        if server.runtime.builds_started() > 0 {
+            break;
+        }
+        tokio::time::sleep(Duration::from_millis(250)).await;
+    }
+    assert_eq!(server.runtime.builds_started(), 1, "the build is running");
+
+    sqlx::query("UPDATE agents SET status = 'stopped' WHERE id = $1")
+        .bind(agent_id)
+        .execute(&server.db)
+        .await
+        .unwrap();
+    build_gate.notify_one();
+    assert_eq!(
+        wait_for_terminal_status(&server, uid, build_id).await,
+        "failed"
+    );
+
+    let restored =
+        wait_for_agent_state(&server, agent_id, |(version, _, _)| version == "1.0.0").await;
+    assert_eq!(
+        restored,
+        (
+            "1.0.0".to_owned(),
+            Some("nasiko/existing:1.0.0".to_owned()),
+            "stopped".to_owned()
+        ),
+        "the stop stays, the version and image are put back"
+    );
+    server.cleanup().await;
+}
+
 /// The contrast: a deploy that fails for any other reason keeps the generic reason.
 #[tokio::test]
 #[serial]
```

---

### Incident Patch 2: `c155e09d` (2026-11-26)
**Commit Message**: Merge pull request #1232 from Nasiko-Labs/feat/agent-months-edge-fixes

Agent-months edge cases: lifecycle, money and enforcement fixes
[synced-from-private]

**File**: `server/src/agent_wake/parked.rs` (modified, +29/-13)
```diff
@@ -30,7 +30,7 @@ use tokio::sync::{Semaphore, SemaphorePermit};
 use tracing::{info, warn};
 use uuid::Uuid;
 
-use super::{AgentWake, lock_agent};
+use super::{AgentWake, WakeRefusal, lock_agent};
 use crate::agents::deployments::record_newest_deployment_status;
 use crate::agents::utils::answers_http;
 
@@ -49,8 +49,9 @@ const NOT_STARTED_IN_TIME: &str = "the agent did not start in time, try again sh
 #[async_trait]
 pub trait WorkloadDeployer: Send + Sync {
     /// Returns once the runtime has accepted the deploy, not once the agent answers. An `Err`
-    /// carries the message the caller is refused with; the cause is logged where it happened.
-    async fn deploy(&self, agent_id: Uuid) -> Result<(), String>;
+    /// carries the message the caller is refused with, and whether the runtime declined the
+    /// deploy; the cause is logged where it happened.
+    async fn deploy(&self, agent_id: Uuid) -> Result<(), WakeRefusal>;
 }
 
 /// What a wake works with, all received from the composition root.
@@ -121,7 +122,7 @@ impl ParkedAgentWake {
 
     /// Wakes the agent, or waits for the wake another caller in this process already started and
     /// then sees what it left.
-    async fn wake_once(&self, agent_id: Uuid, flow_id: Option<&str>) -> Result<(), String> {
+    async fn wake_once(&self, agent_id: Uuid, flow_id: Option<&str>) -> Result<(), WakeRefusal> {
         let deadline = Instant::now() + self.budget;
         let gate = self.gate_of(agent_id);
         let _turn = match gate.try_lock() {
@@ -147,7 +148,7 @@ impl ParkedAgentWake {
         agent_id: Uuid,
         flow_id: Option<&str>,
         deadline: Instant,
-    ) -> Result<(), String> {
+    ) -> Result<(), WakeRefusal> {
         let started = Instant::now();
         let _slot = self.wake_slot(agent_id, deadline).await?;
         let mut tx = self
@@ -179,16 +180,21 @@ impl ParkedAgentWake {
                 info!(%agent_id, "agent wake: scaled a parked agent up; waiting until it answers");
             }
             Ok(ScaleUp::NoWorkload) => self.deploy_workload(agent_id, deadline).await?,
-            // The refusing layer worded this for the caller; the rest is internal detail.
+            // The refusing layer worded this for the caller; the rest is internal detail. It
+            // declined before anything started, so there is nothing to scale back down.
             Err(RuntimeError::Declined { code, message }) => {
                 warn!(%agent_id, %code, "agent wake: the runtime declined to start the agent");
-                return Err(message);
+                undo.disarm();
+                return Err(WakeRefusal {
+                    message,
+                    declined: true,
+                });
             }
-            Err(e) => return Err(unavailable(agent_id, "scale", e)),
+            Err(e) => return Err(unavailable(agent_id, "scale", e).into()),
         }
         announce_waking(&self.deps.flow_events, agent_id, flow_id).await;
         let Some(address) = self.wait_answering(&container_id, deadline).await else {
-            return Err(not_in_time(agent_id));
+            return Err(not_in_time(agent_id).into());
         };
         mark_running(&mut tx, agent_id, &address)
             .await
@@ -216,12 +222,12 @@ impl ParkedAgentWake {
 
     /// Deploys the workload a parked agent does not have, within the wake's budget. A deploy that
     /// outlasts the budget still finishes, and the next call scales up what it left.
-    async fn deploy_workload(&self, agent_id: Uuid, deadline: Instant) -> Result<(), String> {
+    async fn deploy_workload(&self, agent_id: Uuid, deadline: Instant) -> Result<(), WakeRefusal> {
         info!(%agent_id, "agent wake: a parked agent has no workload; deploying it");
         let deployed = self.deps.deployer.deploy(agent_id);
         match tokio::time::timeout_at(deadline.into(), deployed).await {
             Ok(outcome) => outcome,
-            Err(_) => Err(not_in_time(agent_id)),
+            Err(_) => Err(not_in_time(agent_id).into()),
         }
     }
 
@@ -342,6 +348,16 @@ async fn park_again(
 #[async_trait]
 impl AgentWake for ParkedAgentWake {
     async fn before_forward(&self, agent_id: Uuid, flow_id: Option<&str>) -> Result<(), String> {
+        self.before_forward_or_decline(agent_id, flow_id)
+            .await
+            .map_err(|refusal| refusal.message)
+    }
+
+    async fn before_forward_or_decline(
+        &self,
+        agent_id: Uuid,
+        flow_id: Option<&str>,
+    ) -> Result<(), WakeRefusal> {
         if self.is_parked(agent_id).await? {
             return self.wake_once(agent_id, flow_id).await;
         }
@@ -534,7 +550,7 @@ mod tests {
 
     #[async_trait]
     impl WorkloadDeployer for RecordingDeployer {
-        async fn deploy(&self, agent_id: Uuid) -> Result<(), String> {
+        async fn deploy(&self, agent_id: Uuid) -> Result<(), WakeRefusal> {
             tokio::time::sleep(self.delay).await;
        
```

**File**: `server/src/agents/build_worker.rs` (modified, +8/-0)
```diff
@@ -394,6 +394,9 @@ async fn execute_claimed_job(state: AppState, job: BuildJob) {
             writable,
             writable_path,
             workload_kind,
+            prior_version,
+            prior_image,
+            prior_status,
         } => {
             let job_env = match open_job_env(owner_id, env, env_encrypted) {
                 Ok(env) => env,
@@ -428,6 +431,9 @@ async fn execute_claimed_job(state: AppState, job: BuildJob) {
                 writable,
                 writable_path,
                 workload_kind,
+                prior_version,
+                prior_image,
+                prior_status,
             )
             .await;
         }
@@ -443,6 +449,7 @@ async fn execute_claimed_job(state: AppState, job: BuildJob) {
             new_version,
             prev_version,
             prev_image,
+            prev_status,
             changelog,
             writable,
             writable_path,
@@ -476,6 +483,7 @@ async fn execute_claimed_job(state: AppState, job: BuildJob) {
                 new_version,
                 prev_version,
                 prev_image,
+                prev_status,
                 changelog,
                 writable,
                 writable_path,
```

**File**: `server/src/agents/catalog_deploy.rs` (modified, +23/-11)
```diff
@@ -22,6 +22,7 @@ use nasiko_runtime::RuntimeError;
 use tokio::sync::{mpsc, oneshot};
 use uuid::Uuid;
 
+use crate::agent_wake::WakeRefusal;
 use crate::agent_wake::parked::WorkloadDeployer;
 use crate::state::AppState;
 
@@ -133,8 +134,9 @@ pub async fn deploy(
     Ok(Deployed { url, image })
 }
 
-/// How a deploy for the wake went: `Err` carries the message its caller is refused with.
-type DeployOutcome = Result<(), String>;
+/// How a deploy for the wake went: `Err` carries the message its caller is refused with, and
+/// whether the runtime declined the deploy.
+type DeployOutcome = Result<(), WakeRefusal>;
 
 /// What a caller is told when its agent's workload could not be deployed; the cause is logged.
 const COULD_NOT_DEPLOY: &str = "the agent's workload could not be deployed";
@@ -161,7 +163,7 @@ pub fn deployer() -> (CatalogDeployer, DeployRequests) {
 
 #[async_trait]
 impl WorkloadDeployer for CatalogDeployer {
-    async fn deploy(&self, agent_id: Uuid) -> Result<(), String> {
+    async fn deploy(&self, agent_id: Uuid) -> Result<(), WakeRefusal> {
         let (reply, answer) = oneshot::channel();
         self.requests
             .send(DeployRequest { agent_id, reply })
@@ -206,7 +208,7 @@ where
         tokio::spawn(async move {
             let outcome = deploying.await.unwrap_or_else(|e| {
                 tracing::error!(%agent_id, error = %e, "agent wake: the deploy of a parked agent's missing workload panicked");
-                Err(COULD_NOT_DEPLOY.to_owned())
+                Err(COULD_NOT_DEPLOY.to_owned().into())
             });
             let waiting = in_flight
                 .lock()
@@ -257,7 +259,7 @@ async fn deploy_missing_workload(state: &AppState, agent_id: Uuid) -> DeployOutc
     }
     let agent = match load(&state.db, agent_id).await {
         Ok(Some(agent)) => agent,
-        Ok(None) => return Err("the agent no longer exists".to_owned()),
+        Ok(None) => return Err("the agent no longer exists".to_owned().into()),
         Err(e) => return Err(db_error(e)),
     };
     let deployed = deploy(state, &agent)
@@ -292,12 +294,15 @@ async fn deploy_lock(state: &AppState, agent_id: Uuid) -> sqlx::Result<sqlx::PgC
     Ok(conn)
 }
 
-fn logged(agent_id: Uuid, e: &CatalogDeployError) -> String {
+fn logged(agent_id: Uuid, e: &CatalogDeployError) -> WakeRefusal {
     tracing::warn!(%agent_id, error = %e, "agent wake: could not deploy a parked agent's missing workload");
     match e {
         // The refusing layer worded this for the caller.
-        CatalogDeployError::Runtime(RuntimeError::Declined { message, .. }) => message.clone(),
-        _ => COULD_NOT_DEPLOY.to_owned(),
+        CatalogDeployError::Runtime(RuntimeError::Declined { message, .. }) => WakeRefusal {
+            message: message.clone(),
+            declined: true,
+        },
+        _ => COULD_NOT_DEPLOY.to_owned().into(),
     }
 }
 
@@ -325,14 +330,21 @@ mod tests {
         });
         assert_eq!(
             logged(Uuid::nil(), &declined),
-            "This workspace cannot start more agents."
+            WakeRefusal {
+                message: "This workspace cannot start more agents.".into(),
+                declined: true,
+            }
         );
         for other in [
             CatalogDeployError::NoImage,
             CatalogDeployError::Db(sqlx::Error::PoolClosed),
             CatalogDeployError::Runtime(RuntimeError::Internal("boom".into())),
         ] {
-            assert_eq!(logged(Uuid::nil(), &other), COULD_NOT_DEPLOY, "{other}");
+            assert_eq!(
+                logged(Uuid::nil(), &other),
+                COULD_NOT_DEPLOY.to_owned().into(),
+                "{other}"
+            );
         }
     }
 
@@ -432,7 +444,7 @@ mod tests {
 
         assert_eq!(
             WorkloadDeployer::deploy(&deployer, agent).await,
-            Err(COULD_NOT_DEPLOY.to_owned())
+            Err(COULD_NOT_DEPLOY.to_owned().into())
         );
         assert_eq!(WorkloadDeployer::deploy(&deployer, agent).await, Ok(()));
 
```

**File**: `server/src/hitl/mod.rs` (modified, +14/-4)
```diff
@@ -408,16 +408,26 @@ async fn deliver(state: AppState, row: HitlRequest) {
 
     // Woken, then resolved by kind, so resuming a pause on a parked agent wakes it first. After
     // the flow guard, so a resume it rejects never wakes anything.
-    if let Err(msg) = state
+    if let Err(refusal) = state
         .agent_wake
-        .before_forward(row.agent_id, Some(&flow_ctx.flow_id))
+        .before_forward_or_decline(row.agent_id, Some(&flow_ctx.flow_id))
         .await
     {
+        // A declined start is not a failed delivery: the human's answer waits for it to pass
+        // instead of running down the attempts.
+        let failure = if refusal.declined {
+            FailureKind::Declined
+        } else {
+            RETRYABLE
+        };
         fail_resume(
             &state,
             &row,
-            &format!("agent '{agent_name}' cannot be reached: {msg}"),
-            RETRYABLE,
+            &format!(
+                "agent '{agent_name}' cannot be reached: {}",
+                refusal.message
+            ),
+            failure,
         )
         .await;
         return;
```

**File**: `server/src/mcp/build.rs` (modified, +4/-7)
```diff
@@ -575,13 +575,10 @@ pub async fn deploy_and_verify_uploaded_connector(
 
     if let Err(e) = settings.runtime.deploy(&spec).await {
         tracing::error!(build_id = %build_id, connector_id = %connector_id, %e, "mcp server build failed");
-        fail_mcp_connector(
-            &settings.db,
-            build_id,
-            connector_id,
-            &format!("deploy: {e}"),
-        )
-        .await;
+        // A deploy the runtime declined is reported in the words of the layer that declined it.
+        let reason =
+            crate::agents::utils::declined_message(&e).unwrap_or_else(|| format!("deploy: {e}"));
+        fail_mcp_connector(&settings.db, build_id, connector_id, &reason).await;
         return false;
     }
 
```

**File**: `server/tests/common/mod.rs` (modified, +14/-0)
```diff
@@ -67,6 +67,9 @@ pub struct FakeRuntime {
     /// When set, `deploy` fails instead of succeeding — lets a test exercise
     /// a genuine (post-build) deploy failure without a real runtime.
     fail_deploy: std::sync::atomic::AtomicBool,
+    /// The `(code, message)` every `deploy` is refused with, as a layer that declines to run
+    /// workloads answers: not a failure of the deploy, so callers keep what they had.
+    decline_deploy: std::sync::Mutex<Option<(String, String)>>,
     /// When set, `build` fails instead of succeeding - a failed image build, which must leave
     /// the running agent untouched.
     fail_build: std::sync::atomic::AtomicBool,
@@ -165,6 +168,14 @@ impl FakeRuntime {
             .store(fail, std::sync::atomic::Ordering::SeqCst);
     }
 
+    /// Make every `deploy` answer `RuntimeError::Declined` with `code` and `message` until
+    /// cleared with `None`.
+    #[allow(dead_code)]
+    pub fn set_decline_deploy(&self, declined: Option<(&str, &str)>) {
+        *self.decline_deploy.lock().unwrap() =
+            declined.map(|(code, message)| (code.to_owned(), message.to_owned()));
+    }
+
     /// Make `build` calls fail instead of succeeding.
     #[allow(dead_code)]
     pub fn set_fail_build(&self, fail: bool) {
@@ -261,6 +272,9 @@ impl ContainerRuntime for FakeRuntime {
                 "fake deploy failure (scripted by test)".into(),
             ));
         }
+        if let Some((code, message)) = self.decline_deploy.lock().unwrap().clone() {
+            return Err(nasiko_runtime::RuntimeError::Declined { code, message });
+        }
         let status = fake_status(&spec.container_id);
         self.deployed.lock().unwrap().push(spec.clone());
         self.deployed_bounds.lock().unwrap().push((
```

**File**: `server/tests/parked_agent_wake.rs` (modified, +310/-3)
```diff
@@ -23,7 +23,7 @@ use nasiko_runtime::{
 };
 use nasiko_server::agent_resolver::{Caller, ResolveError, resolve_target};
 use nasiko_server::agent_wake::parked::{ParkedAgentWake, WakeDeps, WorkloadDeployer};
-use nasiko_server::agent_wake::{AGENT_LOCK_KEY_SQL, AgentWake};
+use nasiko_server::agent_wake::{AGENT_LOCK_KEY_SQL, AgentWake, WakeRefusal};
 use nasiko_server::agents::catalog_deploy;
 use serde_json::json;
 use serial_test::serial;
@@ -48,6 +48,8 @@ struct WakeableRuntime {
     /// Scales that reached the hold.
     scales_held: AtomicUsize,
     scale_ups: AtomicUsize,
+    /// Scales to zero: what a failed wake's undo does to the workload it started.
+    scale_downs: AtomicUsize,
     /// Every `scale`, `status` and `endpoint` call.
     runtime_calls: AtomicUsize,
     /// Every spec `deploy` was given.
@@ -79,6 +81,11 @@ impl WakeableRuntime {
         self
     }
 
+    /// The layer that declined stops declining.
+    fn allow_starts(&self) {
+        *self.declined.lock().unwrap() = None;
+    }
+
     fn decline(&self) -> RuntimeResult<()> {
         match self.declined.lock().unwrap().clone() {
             Some((code, message)) => Err(RuntimeError::Declined { code, message }),
@@ -122,6 +129,10 @@ impl WakeableRuntime {
         self.scale_ups.load(Ordering::SeqCst)
     }
 
+    fn scale_downs(&self) -> usize {
+        self.scale_downs.load(Ordering::SeqCst)
+    }
+
     fn runtime_calls(&self) -> usize {
         self.runtime_calls.load(Ordering::SeqCst)
     }
@@ -175,6 +186,8 @@ impl ContainerRuntime for WakeableRuntime {
         self.runtime_calls.fetch_add(1, Ordering::SeqCst);
         if replicas > 0 {
             self.scale_ups.fetch_add(1, Ordering::SeqCst);
+        } else {
+            self.scale_downs.fetch_add(1, Ordering::SeqCst);
         }
         tokio::time::sleep(self.scale_delay).await;
         let hold = self.scale_hold.lock().unwrap().clone();
@@ -242,8 +255,10 @@ struct NoDeploy;
 
 #[async_trait]
 impl WorkloadDeployer for NoDeploy {
-    async fn deploy(&self, _agent_id: Uuid) -> Result<(), String> {
-        Err("the agent's workload could not be deployed".to_owned())
+    async fn deploy(&self, _agent_id: Uuid) -> Result<(), WakeRefusal> {
+        Err("the agent's workload could not be deployed"
+            .to_owned()
+            .into())
     }
 }
 
@@ -648,6 +663,110 @@ async fn a_missing_workloads_deploy_the_runtime_declines_is_refused_in_the_decli
     server.cleanup().await;
 }
 
+/// A caller that retries (the HITL resume) must tell a decline from a failure, on both ways a wake
+/// can start an agent: scaling the workload it has, and deploying the one it lacks.
+#[tokio::test]
+#[serial]
+async fn a_wake_refusal_says_the_runtime_declined_with_a_workload_and_without_one() {
+    let runtime =
+        Arc::new(WakeableRuntime::default().declining_starts(DECLINED_CODE, DECLINED_MESSAGE));
+    let server = common::TestServer::start_with_runtime(|_| {}, runtime.clone()).await;
+    let with_workload = seed_agent(&server, "parked", None).await;
+    runtime
+        .replicas
+        .lock()
+        .unwrap()
+        .insert(ContainerId::from_uuid(with_workload), 0);
+    let without_workload = seed_agent(&server, "parked", None).await;
+    seed_parked_deployments(&server, without_workload).await;
+    let wake = wake_with(&server, runtime.clone(), catalog_deployer(&server)).await;
+    let declined = Err(WakeRefusal {
+        message: DECLINED_MESSAGE.to_owned(),
+        declined: true,
+    });
+
+    assert_eq!(
+        wake.before_forward_or_decline(with_workload, None).await,
+        declined
+    );
+    assert_eq!(
+        wake.before_forward_or_decline(without_workload, None).await,
+        declined
+    );
+    server.cleanup().await;
+}
+
+/// The contrast: a deploy that fails for any other reason is a failure, not a decline.
+#[tokio::test]
+#[serial]
+async fn a_wake_refusal_that_is_not_a_decline_says_so() {
+    let server = common::TestServer::start().await;
+    let agent = seed_agent(&server, "parked", None).await;
+    let wake = wake_over(&server, Arc::new(WakeableRuntime::default())).await;
+
+    let refused = wake.before_forward_or_decline(agent, None).await;
+
+    assert_eq!(
+        refused,
+        Err(WakeRefusal {
+            message: "the agent's workload could not be deployed".to_owned(),
+            declined: false,
+        })
+    );
+    server.cleanup().await;
+}
+
+/// A decline comes before anything started, so there is nothing to scale back down: the failed
+/// wake's undo is disarmed, and no scale to zero is scheduled behind the refusal.
+#[tokio::test]
+#[serial]
+async fn a_wake_the_runtime_declines_schedules_no_scale_to_zero() {
+    let server = common::TestServer::start().await;
+    let agent = seed_agent(&server, "parked", None).await;
+    let runtime = Arc::new(
+        WakeableRuntime::default()
+            .with_parked_workload(agent)
+            .declining_starts(DECLINED_CODE, DE
```

---

### Incident Patch 3: `bc6042b0` (2026-11-26)
**Commit Message**: fix(llm-router): keep a custom provider its creator's, checked on every call

A custom provider is now usable only by the user who registered it, in the
API and, new here, in the router on every call: a config that names someone
else's provider is refused instead of running on their endpoint and key.
Superusers share theirs among themselves, so seed agents (a superuser's
config) work whichever superuser registered the provider. The platform's own
defaults and the org embedding default reach superusers' providers only.

- An agent runs only on its owner's configs: an attached config someone else
  created (left by an ownership transfer) reads as none.
- A config may no longer name an unregistered label. The router finds a
  provider by label, so the label would later route through whoever
  registered it.
- A member's endpoint is reached through a client whose DNS resolver refuses
  private addresses and which follows no redirects, at dispatch, catalog sync
  and test time. The server installs it; with none installed the router
  refuses member endpoints.
- vertex and openrouter are reserved labels, so a provider cannot replace
  their shared model lists.
- A provider id is matched 

**File**: `llm-router/src/handlers/chat.rs` (modified, +61/-14)
```diff
@@ -12,8 +12,8 @@ use std::time::Instant;
 use axum::body::Body;
 use axum::extract::rejection::JsonRejection;
 use axum::extract::{Path, State};
-use axum::http::HeaderMap;
-use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
+use axum::http::header::{AUTHORIZATION, CACHE_CONTROL, CONTENT_TYPE};
+use axum::http::{HeaderMap, HeaderName};
 use axum::response::{IntoResponse, Response};
 use axum::{Extension, Json};
 use futures::StreamExt;
@@ -22,11 +22,13 @@ use tracing::Instrument;
 
 use futures::stream::BoxStream;
 
-use nasiko_session_token::SessionClaims;
+use nasiko_session_token::{
+    SessionClaims, SessionTokenError, parse_algorithm, verify_session_token,
+};
 
 use super::auth_layer::rejected_body;
 use crate::LlmRouterCtx;
-use crate::auth::{caller_credential, verify_agent_token, verify_session_credential};
+use crate::auth::verify_agent_token;
 use crate::error::GatewayError;
 use crate::inbound::{ChatStreamRenderer, InboundFormat, inbound_for};
 use crate::ir::{ChatChunk, Usage};
@@ -130,6 +132,12 @@ pub enum AuthedCaller {
     Session(SessionClaims),
 }
 
+const CREDENTIAL_HEADERS: [HeaderName; 3] = [
+    AUTHORIZATION,
+    HeaderName::from_static("x-api-key"),
+    HeaderName::from_static("x-goog-api-key"),
+];
+
 /// Authenticate the caller, preferring a coding-agent session token and falling
 /// back to the agent-identity token.
 ///
@@ -141,9 +149,28 @@ pub(crate) async fn authenticate_caller(
     store: &dyn RegistryStore,
     headers: &HeaderMap,
 ) -> Result<AuthedCaller, GatewayError> {
-    let authz = caller_credential(headers);
-    if let Some(claims) = verify_session_credential(authz, &ctx.cfg, &ctx.db).await? {
-        return Ok(AuthedCaller::Session(claims));
+    let authz = CREDENTIAL_HEADERS
+        .into_iter()
+        .find_map(|name| headers.get(name).and_then(|value| value.to_str().ok()));
+
+    if !ctx.cfg.agent_jwt_secret.is_empty()
+        && let Some(raw) = authz
+    {
+        let algorithm = parse_algorithm(&ctx.cfg.agent_jwt_algorithm);
+        match verify_session_token(raw, &ctx.cfg.agent_jwt_secret, algorithm) {
+            Ok(claims) => {
+                if is_session_token_revoked(&ctx.db, &claims.jti).await? {
+                    return Err(GatewayError::Forbidden("session token revoked".into()));
+                }
+                return Ok(AuthedCaller::Session(claims));
+            }
+            // Not one of ours → fall through to the agent-identity token.
+            Err(SessionTokenError::NotSessionToken) => {}
+            Err(SessionTokenError::Expired) => return Err(GatewayError::TokenExpired),
+            // SecretNotConfigured / MissingToken can't occur here (secret set,
+            // token present); fall back rather than hard-fail on anything else.
+            Err(_) => {}
+        }
     }
 
     let (agent_id, owner_id) = verify_agent_identity(ctx, store, authz).await?;
@@ -204,6 +231,21 @@ fn is_revoked(issued_at: Option<i64>, revoked_at: Option<chrono::DateTime<chrono
     issued_at.is_none_or(|issued| issued < revoked_at.timestamp())
 }
 
+/// True if this session token's `jti` has been revoked. Fails closed (a store
+/// error denies the request) rather than letting a possibly-revoked token through.
+async fn is_session_token_revoked(db: &sqlx::PgPool, jti: &str) -> Result<bool, GatewayError> {
+    let found: Option<i32> =
+        sqlx::query_scalar("SELECT 1 FROM revoked_session_tokens WHERE jti = $1")
+            .bind(jti)
+            .fetch_optional(db)
+            .await
+            .map_err(|e| {
+                tracing::error!(error = %e, "llm-router: revocation check failed — failing closed");
+                GatewayError::Forbidden("identity store unavailable".into())
+            })?;
+    Ok(found.is_some())
+}
+
 /// The owner of the agent a session token names — needed for config/secret
 /// resolution, which is keyed on the agent owner, not the (possibly different)
 /// session user the token bills.
@@ -937,10 +979,9 @@ pub(crate) async fn resolve_routed_request(
                 s.user_id.clone(),
                 Some(attributed.source.into()),
                 signals.query,
-                // A session token's agent is the user's own: their coding-agent integration or
-                // their harness agent (a session opened before users had one names the platform's
-                // harness agent). None is shared through access settings, so it keeps resolving
-                // on the agent owner, which for the user's own agent is the user.
+                // A session token's agent is the user's own coding-agent integration or a
+                // platform harness; neither is an agent shared through access settings, so it
+                // keeps resolving on the agent owner.
                 None,
             )
         } else if runs_outside_flows(store, &agent_id).await? {
@@ -1423,7 +1464,6 @@ mod tests {
     use crate::resolver::{AgentConfigResult, ConfigCache, LLMConfig};

```

**File**: `llm-router/src/handlers/embeddings.rs` (modified, +1/-0)
```diff
@@ -261,6 +261,7 @@ mod tests {
         async fn fetch_custom_provider(
             &self,
             _: &str,
+            _: Option<Uuid>,
         ) -> Result<Option<crate::resolver::CustomProvider>, sqlx::Error> {
             Ok(None)
         }
```

**File**: `llm-router/src/handlers/responses.rs` (modified, +1/-0)
```diff
@@ -1277,6 +1277,7 @@ mod tests {
         async fn fetch_custom_provider(
             &self,
             _: &str,
+            _: Option<Uuid>,
         ) -> Result<Option<crate::resolver::CustomProvider>, sqlx::Error> {
             Ok(None)
         }
```

**File**: `llm-router/src/lib.rs` (modified, +59/-0)
```diff
@@ -217,6 +217,51 @@ pub fn provider_client(read_timeout: Duration) -> reqwest::Client {
         .expect("failed to build provider http client")
 }
 
+/// The client for custom providers a member registered (`CustomEndpoint::public_only`).
+/// Their base URL is user input, so every call, catalog sync included, must reach public
+/// addresses only. The host installs a client whose DNS resolver refuses private ones,
+/// with redirects off (a redirect to an IP literal skips the resolver); this crate cannot
+/// build one itself, because the guard lives in a crate that depends on this one.
+static PUBLIC_ONLY_CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
+
+/// Install [`provider_client`]'s settings over `guarded`, a builder whose DNS resolver
+/// refuses private addresses, with redirects off, as the client [`public_only_client`]
+/// returns. First call wins.
+pub fn install_public_only_client(guarded: reqwest::ClientBuilder, read_timeout: Duration) {
+    let client = guarded
+        .pool_max_idle_per_host(20)
+        .connect_timeout(Duration::from_secs(10))
+        .read_timeout(read_timeout)
+        .redirect(reqwest::redirect::Policy::none())
+        .build()
+        .expect("failed to build public-only provider http client");
+    let _ = PUBLIC_ONLY_CLIENT.set(client);
+}
+
+/// The installed public-only client, or, when the host installed none, one that refuses
+/// every host: a member's endpoint fails closed rather than going out unguarded.
+pub fn public_only_client() -> reqwest::Client {
+    PUBLIC_ONLY_CLIENT.get().cloned().unwrap_or_else(|| {
+        reqwest::Client::builder()
+            .dns_resolver(Arc::new(RefuseAll))
+            .redirect(reqwest::redirect::Policy::none())
+            .build()
+            .expect("failed to build refusing http client")
+    })
+}
+
+/// A resolver that resolves nothing, behind [`public_only_client`]'s default.
+struct RefuseAll;
+
+impl reqwest::dns::Resolve for RefuseAll {
+    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
+        let host = name.as_str().to_owned();
+        Box::pin(async move {
+            Err(format!("no public-only http client installed; refusing '{host}'").into())
+        })
+    }
+}
+
 /// Build the request classifier from config. The only place backend selection happens, shared by
 /// the router and the `classifier_eval` example so both exercise the same path.
 ///
@@ -541,6 +586,20 @@ mod provider_client_tests {
             .unwrap();
         assert_eq!(body, "x".repeat(8));
     }
+
+    #[tokio::test]
+    async fn a_member_endpoint_fails_closed_when_the_host_installed_no_guarded_client() {
+        // Nothing in this crate's tests installs one, so the default answers.
+        let url = serve_once(|s| reply_after(Duration::ZERO, s))
+            .await
+            .replace("127.0.0.1", "localhost");
+        let err = super::public_only_client()
+            .get(url)
+            .send()
+            .await
+            .unwrap_err();
+        assert!(err.is_connect(), "expected a refused lookup, got {err}");
+    }
 }
 
 #[cfg(test)]
```

**File**: `llm-router/src/providers/bedrock_converse.rs` (modified, +1/-0)
```diff
@@ -2938,6 +2938,7 @@ mod tests {
         let endpoint = crate::resolver::CustomEndpoint {
             base_url: server.url(),
             dialect: crate::providers::dialect::ProviderDialect::BedrockConverse,
+            public_only: false,
         };
         let provider = crate::providers::provider_for(
             "aws-bedrock",
```

**File**: `llm-router/src/providers/fallback.rs` (modified, +3/-0)
```diff
@@ -905,6 +905,7 @@ mod tests {
         p.custom_endpoint = Some(crate::resolver::CustomEndpoint {
             base_url: "https://acme.openai.azure.com".into(),
             dialect: dialect.clone(),
+            public_only: false,
         });
         let attempts = build_attempts(&p, &cfg("sk-platform"));
         assert_eq!(attempts.len(), 2);
@@ -1289,6 +1290,7 @@ mod tests {
         p.custom_endpoint = Some(crate::resolver::CustomEndpoint {
             base_url: base,
             dialect: crate::providers::dialect::ProviderDialect::BedrockConverse,
+            public_only: false,
         });
         p
     }
@@ -1948,6 +1950,7 @@ mod tests {
         primary.custom_endpoint = Some(crate::resolver::CustomEndpoint {
             base_url: stalled,
             dialect: crate::providers::ProviderDialect::OpenAi,
+            public_only: false,
         });
         let req: ChatRequest =
             serde_json::from_value(json!({ "messages": [{ "role": "user", "content": "hi" }] }))
```

**File**: `llm-router/src/providers/mod.rs` (modified, +34/-14)
```diff
@@ -82,27 +82,46 @@ pub fn provider_for(
             .with_cache_markers(cfg.cache_markers_enabled),
         )),
         other => match custom_endpoint {
-            Some(endpoint) => match &endpoint.dialect {
-                // Bedrock Converse has its own wire format; use the dedicated provider.
-                ProviderDialect::BedrockConverse => Ok(Box::new(
-                    BedrockConverseProvider::new(http.clone(), endpoint.base_url.clone())
-                        .with_cache_markers(cfg.cache_markers_enabled),
-                )),
-                // Other custom providers carry OpenAI-shaped bodies; the dialect
-                // supplies the envelope (URL layout + credential header).
-                _ => Ok(Box::new(OpenAiProvider::with_dialect(
-                    http.clone(),
-                    endpoint.base_url.clone(),
-                    endpoint.dialect.clone(),
-                ))),
-            },
+            Some(endpoint) => {
+                // A member's endpoint goes out only through the public-only client.
+                let guarded;
+                let http = if endpoint.public_only {
+                    guarded = crate::public_only_client();
+                    &guarded
+                } else {
+                    http
+                };
+                custom_provider_client(endpoint, http, cfg)
+            }
             None => Err(GatewayError::Internal(format!(
                 "provider '{other}' has no endpoint (unregistered custom provider?)"
             ))),
         },
     }
 }
 
+/// The client for a custom provider's endpoint, over `http`.
+fn custom_provider_client(
+    endpoint: &CustomEndpoint,
+    http: &reqwest::Client,
+    cfg: &GatewayConfig,
+) -> Result<Box<dyn ProviderClient>, GatewayError> {
+    match &endpoint.dialect {
+        // Bedrock Converse has its own wire format; use the dedicated provider.
+        ProviderDialect::BedrockConverse => Ok(Box::new(
+            BedrockConverseProvider::new(http.clone(), endpoint.base_url.clone())
+                .with_cache_markers(cfg.cache_markers_enabled),
+        )),
+        // Other custom providers carry OpenAI-shaped bodies; the dialect
+        // supplies the envelope (URL layout + credential header).
+        _ => Ok(Box::new(OpenAiProvider::with_dialect(
+            http.clone(),
+            endpoint.base_url.clone(),
+            endpoint.dialect.clone(),
+        ))),
+    }
+}
+
 /// Run **one** embeddings call against the resolved destination and return the response.
 ///
 /// Deliberately not in [`fallback`] and deliberately not a loop. Falling back to a
@@ -612,6 +631,7 @@ mod tests {
             custom_endpoint: base_url.map(|base_url| crate::resolver::CustomEndpoint {
                 base_url: base_url.to_string(),
                 dialect,
+                public_only: false,
             }),
             is_coding_agent: false,
             is_discovered_agent: false,
```

**File**: `llm-router/src/providers/openai.rs` (modified, +1/-0)
```diff
@@ -2054,6 +2054,7 @@ mod tests {
         let endpoint = crate::resolver::CustomEndpoint {
             base_url: server.url(),
             dialect: ProviderDialect::OpenAi,
+            public_only: false,
         };
         let (name, endpoint) = if custom {
             ("self-hosted", Some(&endpoint))
```

#### Recent Merged Pull Requests:
- **PR #367** (2026-11-16): Remove files the private tree deleted before the sync manifest existed (@nasiko-neeraj)
- **PR #366** (closed): chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates (@dependabot[bot])
- **PR #365** (closed): Remove duplicate GitHub badges (@shrawansaproo01)
- **PR #356** (closed): fix(llm-router): stop dropping tool_choice "none" and related tool controls (@Prudhvi-Raj1806)
- **PR #355** (closed): Bump the npm_and_yarn group across 1 directory with 3 updates (@dependabot[bot])
- **PR #344** (closed): feat: add reproducible compaction and routing benchmarks (@AbhiramMandala)

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

## X. A declined deploy never leaves an agent deploying or overwrites a status changed

**RULE**:
When implementing operations in `server/src/agents/update.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Nasiko-Labs/nasiko. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f42d5f18`: A declined deploy never leaves an agent deploying or overwrites a status changed during the build. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/src/agents/update.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        status: String,
        "SELECT name, version, image, status, owner_id, writable, writable_path FROM agents WHERE id = $1",
        status: prev_status,
        prev_status: Some(prev_status),
    prev_status: Option<String>,
    // Set when the runtime declines the deploy, so the user is told why instead of a generic reason.
    let mut declined = None;
        let deploy_status = scaling.deploy(&spec).await.map_err(|e| {
            declined = super::utils::declined_message(&e);
            format!("deploy: {e}")
        })?;
            // A deploy the runtime declined is no failure of the agent, which keeps the status it
            // had (a stopped or parked agent stays so); a job queued before the status was carried
            // has none to restore and ends `failed`, as does one that read another update's
            // `deploying` placeholder.
            let status = match (&declined, &prev_status) {
                (Some(_), Some(prev)) if prev != "deploying" => prev.as_str(),
                _ => "failed",
            };
            // The status moves only while the row still says `deploying`: one someone set during
            // the build (a stop) is not ove
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        "SELECT name, version, image, owner_id, writable, writable_path FROM agents WHERE id = $1",
        let deploy_status = scaling
            .deploy(&spec)
            .await
            .map_err(|e| format!("deploy: {e}"))?;
                "UPDATE agents SET status = 'failed', version = $2, image = $3, updated_at = now() \
                 WHERE id = $1",
            // clients read it via GET /agents/uploads; the detail lives in the build logs.
                Some("agen
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f42d5f18` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
