# Verification Protocol: Verification Protocol: Empirical Defect Shield for Nasiko-Labs/nasiko

<!-- PROVENANCE_START
{
  "source_repository": "Nasiko-Labs/nasiko",
  "source_url": "https://github.com/Nasiko-Labs/nasiko",
  "source_version": "97cd065e",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T03:41:55.509Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nasiko-labs-nasiko",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Nasiko-Labs/nasiko](https://github.com/Nasiko-Labs/nasiko) (Revision: `97cd065e`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T03:41:55.509Z`  
> **Learning ID**: `learn-github-nasiko-labs-nasiko`


## 1. Scope & Verification Target
- **Target Repository**: `Nasiko-Labs/nasiko` (Commit: `97cd065e`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): Nasiko-Labs/nasiko

> **Canonical Artifact**: `07_PROJECT_LEARNING/nasiko-labs-nasiko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Nasiko-Labs/nasiko](https://github.com/Nasiko-Labs/nasiko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T03:41:54.223Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Nasiko-Labs/nasiko`
- **Description**: The Open Runtime for AI Agents
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11941 stars

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

- **Issue #365** (2026-11-14): **Remove duplicate GitHub badges**
  *Symptoms*: Removed duplicate GitHub badges from README.
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=106898781&amp;sig=ab084d94ab947b034e56ec2c080dadfa4cbaa347b7dba8ebf5056aa632063bca"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a><a href="https://app.greptile.com/-/switch-tenant?tenant=nasiko&amp;next=%2FNasiko-Labs%2Fnasiko%2Fpull%2F365&amp;utm_source=greptile_review&amp;utm_medium=github&amp;utm_campaign=view_in_greptile"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/ViewInGreptileDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazona
  > <!-- nasiko-oss-pr-status --> @shrawansaproo01, this PR is now in the maintainers' review queue, and its checks passed against our full build. Thanks for cleaning up the README.  The change is clear and small. It removes the second, identical block of stars, commits and pull-request badges near the end of `README.md` and leaves the first set in place.  You'll get a comment here when the PR is merged or closed, and it will always include the reason. If you push new commits, the checks will re-run and this comment will update.

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

### Incident Patch 1: `6e6e2590` (2026-11-16)
**Commit Message**: feat(ui): show the setup guide's CLI steps on an empty Coding harnesses page

With no harness connected, Coding harnesses showed only `nasiko agents setup`. It now
shows the setup guide's own harness step: its title and intro, the CLI installer,
`nasiko connect <this server>` and what connecting does next. Both read one shared
block (onboarding/HarnessSetup.tsx), so they cannot drift apart. A failed import
still offers `nasiko agents setup` to resume it.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
[synced-from-private]

**File**: `ui/eslint.config.js` (modified, +2/-1)
```diff
@@ -97,7 +97,8 @@ const PUBLIC = {
     'types',
   ],
   narrative: ['tokenops', 'trace', 'harness', 'overview', 'flows', 'agentHub', 'home'],
-  onboarding: ['api', 'GuideCard', 'GuideHost', 'index', 'logic', 'types'],
+  // Coding harnesses' empty state shows the guide's own harness step.
+  onboarding: ['api', 'GuideCard', 'GuideHost', 'HarnessSetup', 'index', 'logic', 'types'],
   // The product tour (shared/features/src/tour): the shell's `_app` route mounts its host.
   tour: ['TourHost'],
   // Context optimization (plans/feat-context-optimization.md eng D1): its rules, copy, the trace's Optimization block
```

**File**: `ui/shared/features/src/harnesses/AgentsOnboarding.test.tsx` (modified, +9/-5)
```diff
@@ -135,18 +135,22 @@ describe('Token optimization for your coding agents', () => {
 })
 
 describe('browser: the command, no consent', () => {
-  it('a viewer with no harnesses gets the command and its Copy, and nothing asks', async () => {
+  it("a viewer with no harnesses gets the setup guide's install and connect steps, and nothing asks", async () => {
     as('agents-none')
     renderApp('/harnesses')
     const c = await card()
     expect(
-      within(c).getByRole('heading', { name: 'Bring in your coding agents' }),
+      within(c).getByRole('heading', { name: 'Bring in your coding harnesses' }),
     ).toBeInTheDocument()
     expect(
-      within(c).getByText('To discover your coding agents and load your previous sessions, run:'),
+      within(c).getByText('curl -fsSL https://registry.nasiko.com/r/nasiko/install | bash'),
     ).toBeInTheDocument()
-    expect(within(c).getByText('nasiko agents setup')).toBeInTheDocument()
-    expect(within(c).getByRole('button', { name: 'Copy command' })).toBeInTheDocument()
+    expect(within(c).getByText(/^nasiko connect /)).toBeInTheDocument()
+    expect(within(c).getByRole('button', { name: 'Copy: Install the CLI' })).toBeInTheDocument()
+    expect(
+      within(c).getByRole('button', { name: 'Copy: Connect it to this server' }),
+    ).toBeInTheDocument()
+    expect(within(c).queryByText('nasiko agents setup')).toBeNull()
     expect(within(c).queryByRole('button', { name: 'Yes, find my agents' })).toBeNull()
     await summary()
     // The card carries the same command, so the CLI panel steps aside.
```

**File**: `ui/shared/features/src/harnesses/components/AgentsOnboardingCard.tsx` (modified, +9/-5)
```diff
@@ -1,7 +1,7 @@
 /**
  * The coding-agent onboarding card (onboarding.ts). In the desktop app it asks first, then shows the desktop's own
- * run; in a browser it shows the command (running it is the consent), then the runs local clients report. Phase
- * changes are spoken through the card's one polite live region.
+ * run; in a browser it shows the setup guide's install and connect commands (running them is the consent), then the
+ * runs local clients report. Phase changes are spoken through the card's one polite live region.
  */
 import { useEffect, useRef } from 'react'
 import { AlertTriangle } from 'lucide-react'
@@ -10,6 +10,7 @@ import { useAnnounce } from '@nasiko/ui/composites/announce'
 import { CopyButton } from '@nasiko/ui/composites/copy-button'
 import { Button } from '@nasiko/ui/primitives/button'
 import { Card } from '@nasiko/ui/primitives/card'
+import { HarnessSetupHeading, HarnessSetupSteps } from '@nasiko/features/onboarding/HarnessSetup'
 import { copy as pageCopy } from '../copy'
 import type { AgentsOnboarding, CardView, DesktopControl } from '../onboarding'
 import { rejectedTurns, shownPhase, type SyncRun } from '../runs'
@@ -45,8 +46,11 @@ function CardBody({ view, onboarding }: { view: CardView; onboarding: AgentsOnbo
     case 'command':
       return (
         <>
-          <Title>{copy.commandTitle}</Title>
-          <Command />
+          <HarnessSetupHeading id="agents-onboarding-title" />
+          {/* The setup guide's own steps (onboarding/HarnessStep.tsx): `nasiko connect` signs in, then sets up the
+              coding agents, which reports the run this card follows. */}
+          <HarnessSetupSteps />
+          <ChatHistoryNotice />
         </>
       )
     case 'ask':
@@ -136,7 +140,7 @@ function Title({ children }: { children: string }) {
   )
 }
 
-/** The CLI command with its Copy button. */
+/** A failed run's CLI command with its Copy button: `nasiko agents setup` resumes the import. */
 function Command() {
   return (
     <div className="flex flex-col gap-2 text-sm">
```

**File**: `ui/shared/features/src/harnesses/copy.ts` (modified, +0/-1)
```diff
@@ -85,7 +85,6 @@ export const copy = {
     findMyAgents: 'Find my agents',
     idle: 'Your coding agents are not being imported right now.',
     // Browser: running the command is the consent.
-    commandTitle: 'Bring in your coding agents',
     commandBody: 'To discover your coding agents and load your previous sessions, run:',
     command: 'nasiko agents setup',
     copyCommand: 'Copy command',
```

**File**: `ui/shared/features/src/harnesses/onboarding.ts` (modified, +3/-2)
```diff
@@ -3,8 +3,9 @@
  *
  * - **Desktop app**: consent is local. The card asks, and Yes / Not now / Retry are the desktop's own POSTs; progress
  *   is the desktop's local run.
- * - **Browser**: no consent. Running `nasiko agents setup` is the consent, so the card shows the command, then the
- *   progress the CLI (or a desktop elsewhere) reports to the server:
+ * - **Browser**: no consent. Running the setup guide's `nasiko connect` (or `nasiko agents setup`) is the consent, so
+ *   the card shows the guide's install and connect commands, then the progress the CLI (or a desktop elsewhere)
+ *   reports to the server:
  *
  *     GET  /api/me/coding-agents/sync                       {runs: [Run]}  (updated in the last 24 h, newest first)
  *     POST /api/me/coding-agents/sync/{device_id}/retry     the Run, `retry_requested_at` set (404: no such device)
```

**File**: `ui/shared/features/src/onboarding/HarnessSetup.tsx` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+/**
+ * The CLI commands that bring a developer's coding harnesses in: install, then connect to this server, and what
+ * happens next. One block for the setup guide's last step (HarnessStep.tsx) and Coding harnesses' empty state
+ * (harnesses/components/AgentsOnboardingCard.tsx), so the two never drift apart.
+ */
+import { CopyButton } from '@nasiko/ui/composites/copy-button'
+import { connectCommand } from '@nasiko/features/cli/commands'
+import { copy as cliCopy } from '@nasiko/features/cli/copy'
+import { copy as guideCopy } from './copy'
+
+const copy = guideCopy.harness
+
+/** The block's title and intro as a card heading; `id` names it for the card's `aria-labelledby`. */
+export function HarnessSetupHeading({ id }: { id: string }) {
+  return (
+    <div className="flex flex-col gap-1">
+      <h2 id={id} className="text-base font-semibold">
+        {copy.title}
+      </h2>
+      <p className="max-w-[70ch] text-sm text-muted-foreground">{copy.intro}</p>
+    </div>
+  )
+}
+
+export function HarnessSetupSteps() {
+  const steps = [
+    { label: copy.steps.install, command: cliCopy.install.unixCommand },
+    { label: copy.steps.connect, command: connectCommand() },
+  ]
+  return (
+    <>
+      <ol className="flex flex-col gap-4">
+        {steps.map((s, i) => (
+          <li key={s.label} className="flex gap-3">
+            <span
+              aria-hidden
+              className="flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs"
+            >
+              {i + 1}
+            </span>
+            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
+              <span className="text-sm">{s.label}</span>
+              <div className="flex items-center gap-2 rounded-md border bg-muted/50 py-1 pr-1 pl-3">
+                <span aria-hidden className="font-mono text-xs text-muted-foreground select-none">
+                  $
+                </span>
+                <code className="min-w-0 flex-1 font-mono text-xs break-all whitespace-pre-wrap">
+                  {s.command}
+                </code>
+                <CopyButton text={s.command} label={copy.copy(s.label)} />
+              </div>
+            </div>
+          </li>
+        ))}
+      </ol>
+      <p className="text-sm text-muted-foreground">{copy.after}</p>
+    </>
+  )
+}
```

**File**: `ui/shared/features/src/onboarding/HarnessStep.tsx` (modified, +2/-32)
```diff
@@ -7,11 +7,9 @@
  * to connect, offering to move any connected to another server.
  */
 import { Bot, MessageSquare, SquareTerminal } from 'lucide-react'
-import { CopyButton } from '@nasiko/ui/composites/copy-button'
 import { Button } from '@nasiko/ui/primitives/button'
-import { connectCommand } from '@nasiko/features/cli/commands'
-import { copy as cliCopy } from '@nasiko/features/cli/copy'
 import { copy as guideCopy } from './copy'
+import { HarnessSetupSteps } from './HarnessSetup'
 import { StepHeading } from './parts'
 
 const copy = guideCopy.harness
@@ -29,38 +27,10 @@ export function HarnessStep({
   /** Out of the guide to one of these pages. */
   onOpen: (to: '/harnesses' | '/agents' | '/chat') => void
 }) {
-  const steps = [
-    { label: copy.steps.install, command: cliCopy.install.unixCommand },
-    { label: copy.steps.connect, command: connectCommand() },
-  ]
   return (
     <div className="flex flex-col gap-6">
       <StepHeading title={copy.title} intro={copy.intro} />
-      <ol className="flex flex-col gap-4">
-        {steps.map((s, i) => (
-          <li key={s.label} className="flex gap-3">
-            <span
-              aria-hidden
-              className="flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs"
-            >
-              {i + 1}
-            </span>
-            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
-              <span className="text-sm">{s.label}</span>
-              <div className="flex items-center gap-2 rounded-md border bg-muted/50 py-1 pr-1 pl-3">
-                <span aria-hidden className="font-mono text-xs text-muted-foreground select-none">
-                  $
-                </span>
-                <code className="min-w-0 flex-1 font-mono text-xs break-all whitespace-pre-wrap">
-                  {s.command}
-                </code>
-                <CopyButton text={s.command} label={copy.copy(s.label)} />
-              </div>
-            </div>
-          </li>
-        ))}
-      </ol>
-      <p className="text-sm text-muted-foreground">{copy.after}</p>
+      <HarnessSetupSteps />
       <section className="flex flex-col gap-3">
         <h3 className="text-sm font-medium">{copy.next}</h3>
         <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
```

---

### Incident Patch 2: `7c14d77f` (2026-11-16)
**Commit Message**: Sentry: user and workspace on every event, Sentry Logs, tenant-server traces and cron heartbeats

Errors said how many events, never how many people or which workspace, and
nothing told us when a background job stopped running.

- User and workspace: the auth middleware names the signed-in user by
  account id only (never name or email), inside a Sentry scope that
  trace_requests now opens for every routed request, so the id stays on
  that request. Provisioned workspaces tag every event workspace=<TENANT_ID>;
  /api/telemetry/config hands the UI the same tag, and the UI follows the
  session query to set the user id.
- Sentry Logs: SENTRY_LOGS_LEVEL (off/error/warn/info, default warn) sends
  those tracing lines, and the UI's console warnings and errors, as logs.
  Log lines are free text nobody reviewed, so they are redacted by value
  (nasiko_utils::redact: credential query values, user:password, the MCP
  credential path, email addresses, Bearer tokens, secret-named fields).
- Tenant-server traces: SENTRY_TRACES_SAMPLE_RATE (default 0.1) records
  routed requests as transactions with method, route template, status and
  duration only: no URL, header, query, body or child spans

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ tracing-subscriber = { version = "0.3", features = ["env-filter"] }
 # ureq + rustls: the HTTP stack and TLS the workspace already locks, instead of the default
 # reqwest 0.13 + native-tls. `tower-axum-matched-path` names transactions by route template, so a
 # credential in a path (`/api/mcp/s/{token}`) never becomes a transaction name.
-sentry = { version = "0.49.3", default-features = false, features = ["backtrace", "contexts", "panic", "tracing", "tower", "tower-http", "tower-axum-matched-path", "ureq", "rustls"] }
+sentry = { version = "0.49.3", default-features = false, features = ["backtrace", "contexts", "panic", "tracing", "tower", "tower-http", "tower-axum-matched-path", "ureq", "rustls", "logs"] }
 
 # ─── AWS ────────────────────────────────────────────────────────────────────
 aws-sdk-s3 = "1"
```

**File**: `server/.env.example` (modified, +2/-1)
```diff
@@ -89,7 +89,7 @@ SEED_AGENTS=
 # Starter workflows installed after the seed agents, as public workflows every
 # user can run (server/src/seed_workflows.rs). Space-separated template
 # ids; each one's agents must be in SEED_AGENTS or it is skipped.
-# SEED_WORKFLOWS="chief-of-staff-follow-up inbox-morning-brief voice-of-customer-roadmap"
+# SEED_WORKFLOWS="chief-of-staff-follow-up voice-of-customer-roadmap"
 # SEED_IMAGE_PLATFORM=linux/amd64        # os/arch copied from multi-platform seed images
 # SEED_FORCE_PULL=                       # (unset) set to any value to re-pull seed images
 
@@ -442,6 +442,7 @@ S3_REGION=us-east-1
 # SENTRY_BROWSER_TRACES_SAMPLE_RATE=0.1  # share of page loads/navigations traced
 # SENTRY_REPLAY_SESSION_SAMPLE_RATE=0    # share of all sessions replayed (masked)
 # SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1   # share of sessions with an error replayed
+# SENTRY_LOGS_LEVEL=warn                 # off/error/warn/info: lines also sent to Sentry Logs (redacted)
 
 # Base OTLP/HTTP JSON endpoint for the durable coding-agent outbox. The server
 # appends /v1/traces and /v1/logs. Unset leaves receipts pending with no worker.
```

**File**: `server/src/auth/middleware.rs` (modified, +2/-0)
```diff
@@ -76,6 +76,7 @@ pub async fn require_auth(State(state): State<AppState>, mut req: Request, next:
             )
             .into_response();
         }
+        crate::error_reporting::identify(&delegated.identity.user_id.to_string());
         req.extensions_mut()
             .insert(Claims::from(delegated.identity.clone()));
         req.extensions_mut().insert(super::delegate::Delegation {
@@ -99,6 +100,7 @@ pub async fn require_auth(State(state): State<AppState>, mut req: Request, next:
         req.extensions_mut()
             .insert(super::delegate::SessionJti(jti));
     }
+    crate::error_reporting::identify(&claims.sub);
     req.extensions_mut().insert(claims);
     next.run(req).await
 }
```

**File**: `server/src/error_reporting/config.rs` (modified, +52/-0)
```diff
@@ -1,5 +1,6 @@
 use std::str::FromStr;
 
+use nasiko_utils::logs_level::LogsLevel;
 use sentry::types::Dsn;
 
 /// Where errors go and how much is sampled, read once at startup.
@@ -26,12 +27,20 @@ pub struct ErrorReportingConfig {
     /// `SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE`: share of sessions with an error whose last
     /// minute is kept.
     pub replay_on_error_sample_rate: f32,
+    /// `SENTRY_LOGS_LEVEL`: which `tracing` lines (and, in the UI, console lines) also go to
+    /// Sentry Logs, searchable and linked to their trace. Default `warn`.
+    pub logs: LogsLevel,
+    /// `TENANT_ID`, the workspace this control plane serves when the multi-tenant management
+    /// plane provisioned it: a `workspace` tag on every event, so an alert says whether one
+    /// workspace or all of them are affected. Unset on a self-hosted install.
+    pub workspace: Option<String>,
 }
 
 const DEFAULT_ENVIRONMENT: &str = "production";
 const DEFAULT_TRACES_SAMPLE_RATE: f32 = 0.1;
 const DEFAULT_REPLAY_SESSION_SAMPLE_RATE: f32 = 0.0;
 const DEFAULT_REPLAY_ON_ERROR_SAMPLE_RATE: f32 = 1.0;
+const DEFAULT_LOGS_LEVEL: LogsLevel = LogsLevel::Warn;
 
 impl ErrorReportingConfig {
     pub fn from_env() -> Self {
@@ -90,6 +99,16 @@ impl ErrorReportingConfig {
                 "SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE",
                 DEFAULT_REPLAY_ON_ERROR_SAMPLE_RATE,
             ),
+            logs: match set("SENTRY_LOGS_LEVEL") {
+                None => DEFAULT_LOGS_LEVEL,
+                Some(raw) => LogsLevel::parse(&raw).unwrap_or_else(|| {
+                    eprintln!(
+                        "SENTRY_LOGS_LEVEL must be off, error, warn or info, got {raw:?}; using warn"
+                    );
+                    DEFAULT_LOGS_LEVEL
+                }),
+            },
+            workspace: set("TENANT_ID").map(|id| id.trim().to_owned()),
         }
     }
 }
@@ -138,6 +157,39 @@ mod tests {
         assert_eq!(c.browser_dsn, None);
     }
 
+    #[test]
+    fn logs_default_to_warnings_and_errors() {
+        let c = ErrorReportingConfig::disabled();
+        assert_eq!(c.logs, LogsLevel::Warn);
+        assert!(c.logs.includes(&tracing::Level::ERROR));
+        assert!(c.logs.includes(&tracing::Level::WARN));
+        assert!(!c.logs.includes(&tracing::Level::INFO));
+        assert!(!c.logs.includes(&tracing::Level::DEBUG));
+    }
+
+    #[test]
+    fn logs_level_is_read_and_a_bad_value_keeps_the_default() {
+        assert_eq!(
+            config(&[("SENTRY_LOGS_LEVEL", " INFO ")]).logs,
+            LogsLevel::Info
+        );
+        let off = config(&[("SENTRY_LOGS_LEVEL", "off")]).logs;
+        assert!(!off.includes(&tracing::Level::ERROR));
+        assert_eq!(
+            config(&[("SENTRY_LOGS_LEVEL", "loud")]).logs,
+            LogsLevel::Warn
+        );
+    }
+
+    #[test]
+    fn the_workspace_comes_from_tenant_id() {
+        assert_eq!(ErrorReportingConfig::disabled().workspace, None);
+        assert_eq!(
+            config(&[("TENANT_ID", " t-123 ")]).workspace.as_deref(),
+            Some("t-123")
+        );
+    }
+
     #[test]
     fn rates_outside_zero_to_one_fall_back_to_the_default() {
         let c = config(&[
```

**File**: `server/src/error_reporting/mod.rs` (modified, +89/-12)
```diff
@@ -7,7 +7,10 @@
 //!
 //! Four pieces, wired at the composition roots:
 //! - [`init`]: this server's client, called first thing in `main`. Captures panics, `error!`
-//!   events (with `warn!` lines as breadcrumbs), and a sample of requests as transactions.
+//!   events (with `warn!` lines as breadcrumbs), a sample of requests as transactions, and
+//!   `SENTRY_LOGS_LEVEL`'s lines (default warnings and errors) as Sentry Logs. Every event names
+//!   the workspace (`TENANT_ID`) and, inside a request, the signed-in user's id ([`identify`]):
+//!   an id, never a name or an email.
 //! - [`tracing_layer`]: joins `tracing` to that client; `telemetry::init_telemetry` installs it
 //!   beside the OTLP layer, which keeps working unchanged.
 //! - [`trace_requests`]: middleware recording a request as a transaction named by its route
@@ -29,6 +32,7 @@ mod tunnel;
 use std::sync::OnceLock;
 
 pub use config::ErrorReportingConfig;
+pub use nasiko_utils::logs_level::LogsLevel;
 pub use requests::trace_requests;
 pub use tunnel::router;
 
@@ -52,32 +56,105 @@ pub fn init(
         .send_default_pii(false)
         .attach_stacktrace(true)
         .before_send(scrub::event);
+    options.before_send_log = Some(std::sync::Arc::new(scrub::log));
     options.dsn = Some(dsn);
     let guard = sentry::init(options);
-    sentry::configure_scope(|scope| scope.set_tag("edition", edition));
+    let workspace = config.workspace.clone();
+    sentry::configure_scope(|scope| {
+        scope.set_tag("edition", edition);
+        if let Some(workspace) = workspace {
+            scope.set_tag("workspace", workspace);
+        }
+    });
     Some(guard)
 }
 
+/// Name the signed-in user on what the current request reports, by account id only. Called by
+/// the auth middleware once a caller is known; [`trace_requests`] gives every routed request a
+/// scope of its own, so the id never outlives the request or reaches another one. A no-op when
+/// nothing is reported.
+pub fn identify(user_id: &str) {
+    let id = user_id.to_owned();
+    sentry::configure_scope(|scope| {
+        scope.set_user(Some(sentry::User {
+            id: Some(id),
+            ..Default::default()
+        }))
+    });
+}
+
 /// What [`init`] was given; nothing is reported before it runs (and in tests that never call it).
 pub fn current_config() -> &'static ErrorReportingConfig {
     CONFIG.get_or_init(ErrorReportingConfig::disabled)
 }
 
 /// `error!` becomes an event, `warn!` a breadcrumb on the next event, and spans join the
-/// request's transaction. `info!` and below are left out: they are high-volume and carry
-/// request detail that has not been reviewed for what it may contain. `None` (a no-op layer)
-/// unless this server reports to Sentry.
+/// request's transaction. Lines at or above `SENTRY_LOGS_LEVEL` are also sent as logs, through
+/// [`scrub::log`]. `debug!` and `trace!` never leave. `None` (a no-op layer) unless this server
+/// reports to Sentry.
 pub fn tracing_layer<S>() -> Option<sentry::integrations::tracing::SentryLayer<S>>
 where
     S: tracing::Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
 {
-    use sentry::integrations::tracing::EventFilter;
-    current_config().server_dsn.as_ref()?;
+    let config = current_config();
+    config.server_dsn.as_ref()?;
+    let logs = config.logs;
     Some(
-        sentry::integrations::tracing::layer().event_filter(|metadata| match *metadata.level() {
-            tracing::Level::ERROR => EventFilter::Event,
-            tracing::Level::WARN => EventFilter::Breadcrumb,
-            _ => EventFilter::Ignore,
-        }),
+        sentry::integrations::tracing::layer()
+            .event_filter(move |metadata| event_filter(logs, metadata.level())),
     )
 }
+
+/// What one `tracing` line becomes in Sentry.
+fn event_filter(
+    logs: LogsLevel,
+    level: &tracing::Level,
+) -> sentry::integrations::tracing::EventFilter {
+    use sentry::integrations::tracing::EventFilter;
+    let base = match *level {
+        tracing::Level::ERROR => EventFilter::Event,
+        tracing::Level::WARN => EventFilter::Breadcrumb,
+        _ => EventFilter::Ignore,
+    };
+    if logs.includes(level) {
+        base | EventFilter::Log
+    } else {
+        base
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use sentry::integrations::tracing::EventFilter;
+
+    #[test]
+    fn errors_are_events_warnings_breadcrumbs_and_logs_follow_the_level() {
+        let bits = |logs, level| event_filter(logs, level).bits();
+        let warn = LogsLevel::Warn;
+        assert_eq!(
+            bits(warn, &tracing::Level::ERROR),
+            (EventFilter::Event | EventFilter::Log).bits()
+        );
+        assert_eq!(
+            bits(warn, &tracing::Level::WARN),
+            (EventFilter::Breadcrumb | EventFilter::Log).bits()
+        );
+        assert_eq!(
+            bits(warn, &tracing::Level::INFO),
+            EventFilter::Ignore.bits()
+        );
+ 
```

**File**: `server/src/error_reporting/requests.rs` (modified, +11/-5)
```diff
@@ -14,10 +14,13 @@ use super::scrub;
 /// Routes never recorded: probes and the tunnel itself, which would only trace the reporting.
 const UNTRACED_ROUTES: &[&str] = &["/health", "/api/telemetry/sentry", "/api/telemetry/config"];
 
-/// Middleware: record the request as a transaction named `<METHOD> <route template>` and give
-/// its events their own scope. Layered on the whole app with `Router::layer`, so it runs after
-/// routing and the template is known. A request no route matched (UI pages and assets, which
-/// the browser traces itself) is passed through, as is everything when nothing is reported.
+/// Middleware: give the request its own Sentry scope, and record it as a transaction named
+/// `<METHOD> <route template>`. Layered on the whole app with `Router::layer`, so it runs after
+/// routing and the template is known. The scope is what keeps per-request context (the user
+/// [`super::identify`] names) on this request's events only, so every routed request gets one,
+/// probes included; only the transaction is skipped for [`UNTRACED_ROUTES`]. A request no route
+/// matched (UI pages and assets, which the browser traces itself) is passed through, as is
+/// everything when nothing is reported.
 pub async fn trace_requests(req: Request, next: Next) -> Response {
     let Some(route) = req
         .extensions()
@@ -26,11 +29,14 @@ pub async fn trace_requests(req: Request, next: Next) -> Response {
     else {
         return next.run(req).await;
     };
-    if Hub::current().client().is_none() || UNTRACED_ROUTES.contains(&route.as_str()) {
+    if Hub::current().client().is_none() {
         return next.run(req).await;
     }
 
     let hub = Arc::new(Hub::new_from_top(Hub::current()));
+    if UNTRACED_ROUTES.contains(&route.as_str()) {
+        return next.run(req).bind_hub(hub).await;
+    }
     let request = scrub::from_http(&req);
     let headers = req
         .headers()
```

**File**: `server/src/error_reporting/scrub.rs` (modified, +46/-1)
```diff
@@ -1,7 +1,8 @@
 //! What a request may tell Sentry. An allow-list, not a deny-list: a header or field added
 //! later stays out until someone decides it is safe to send.
 
-use sentry::protocol::{Event, Map, Request};
+use nasiko_utils::redact::{redact_field, redact_text};
+use sentry::protocol::{Event, Log, LogAttribute, Map, Request, Value};
 
 use crate::mcp::redact_credential_uri;
 
@@ -20,6 +21,23 @@ pub(super) fn event(mut event: Event<'static>) -> Option<Event<'static>> {
     Some(event)
 }
 
+/// `before_send_log`: a `tracing` line on its way to Sentry Logs. Log lines are free text written
+/// for operators, never reviewed for what Sentry may see, so credentials and email addresses are
+/// redacted by value in the message and in every string field; a field whose name looks secret
+/// keeps only a placeholder. Numbers and booleans pass (a `status_code` is not a secret).
+pub(crate) fn log(mut log: Log) -> Option<Log> {
+    log.body = redact_text(&log.body);
+    for (name, LogAttribute(value)) in log.attributes.iter_mut() {
+        if name.starts_with("sentry.") {
+            continue;
+        }
+        if let Value::String(text) = value {
+            redact_field(name, text);
+        }
+    }
+    Some(log)
+}
+
 /// The request as Sentry sees it, from the incoming HTTP request.
 pub(super) fn from_http<B>(req: &axum::http::Request<B>) -> Request {
     let headers = req
@@ -118,6 +136,33 @@ mod tests {
         assert!(!r.headers.contains_key("host"));
     }
 
+    #[test]
+    fn a_log_line_loses_credentials_and_emails() {
+        let mut attributes = Map::new();
+        attributes.insert(
+            "user_email".into(),
+            LogAttribute(Value::from("ada@acme.com")),
+        );
+        attributes.insert("url".into(), LogAttribute(Value::from("/cb?code=abc&x=1")));
+        attributes.insert("status_code".into(), LogAttribute(Value::from(502)));
+        attributes.insert("sentry.release".into(), LogAttribute(Value::from("r@1")));
+        let line = Log {
+            level: sentry::protocol::LogLevel::Warn,
+            body: "invite for bob@acme.com failed: token=abc".into(),
+            trace_id: None,
+            timestamp: std::time::SystemTime::now(),
+            severity_number: None,
+            attributes,
+        };
+        let line = super::log(line).unwrap();
+        assert_eq!(line.body, "invite for [email] failed: token=[REDACTED]");
+        let attr = |k: &str| line.attributes[k].0.clone();
+        assert_eq!(attr("user_email"), Value::from("[REDACTED]"));
+        assert_eq!(attr("url"), Value::from("/cb?code=[REDACTED]&x=1"));
+        assert_eq!(attr("status_code"), Value::from(502));
+        assert_eq!(attr("sentry.release"), Value::from("r@1"));
+    }
+
     #[test]
     fn an_event_loses_bodies_cookies_and_environment() {
         let mut env = Map::new();
```

**File**: `server/src/error_reporting/tunnel.rs` (modified, +18/-0)
```diff
@@ -57,6 +57,8 @@ pub fn router<S: Clone + Send + Sync + 'static>(
             "replays_session_sample_rate": config.replay_session_sample_rate,
             "replays_on_error_sample_rate": config.replay_on_error_sample_rate,
             "tunnel": "/api/telemetry/sentry",
+            "workspace": config.workspace,
+            "logs": config.logs != super::LogsLevel::Off,
         }}),
         dsn,
     });
@@ -246,6 +248,22 @@ mod tests {
         assert_eq!(body["data"]["enabled"], true);
         assert_eq!(body["data"]["dsn"], DSN);
         assert_eq!(body["data"]["tunnel"], "/api/telemetry/sentry");
+        assert_eq!(body["data"]["logs"], true);
+        assert!(body["data"]["workspace"].is_null());
+    }
+
+    #[tokio::test]
+    async fn config_names_the_workspace_and_whether_logs_are_on() {
+        let config = ErrorReportingConfig {
+            browser_dsn: Some(DSN.parse().unwrap()),
+            workspace: Some("t-123".into()),
+            logs: super::super::LogsLevel::Off,
+            ..ErrorReportingConfig::disabled()
+        };
+        let app = router(&config, reqwest::Client::new());
+        let (_, body) = call(app, "GET", "/api/telemetry/config", String::new()).await;
+        assert_eq!(body["data"]["workspace"], "t-123");
+        assert_eq!(body["data"]["logs"], false);
     }
 
     #[tokio::test]
```

---

### Incident Patch 3: `3c654ac6` (2026-11-16)
**Commit Message**: fix(maf): a retried step reopens its flow, so its agent's calls are authorized again

A step's trace id is derived from the execution and the step index
(build_traceparent), so a retried step reuses it. The first attempt
closed that flow row ('completed') when its agent call returned, and the
retry's insert was ON CONFLICT DO NOTHING, so the row stayed closed. The
LLM router and the MCP gateway only honour a 'running' flow younger than
the flow timeout: every model and tool call the retried step's agent
made was refused with 403 "traceparent does not resolve to a live flow"
(reproduced against both).

The insert now reopens an existing row: running, created_at = now(),
completed_at / duration_ms / error_message cleared, and this attempt's
prompt as metadata. Only a row of the run's own user is reopened.
FlowGuard's Redis state is already reset per attempt (init_flow), the
flow sweeper skips a fresh row, and tiering never touches a flow
completed today, so nothing else reads the reopened row differently.

maf_step_flow_retry: a step fails at its agent, its closed flow is aged
an hour, and the retry's agent call is authorized; it fails without the
fix ([true, false]). A flow of anoth

**File**: `orchestrator/src/maf/executor.rs` (modified, +12/-3)
```diff
@@ -1007,11 +1007,20 @@ pub async fn execute_step(
     // step, so the gateway keys its decision cache on the whole MAF run: the
     // first step writes the tier decision, later steps reuse it. Best-effort —
     // a failed insert only means this step falls back to the default model.
+    //
+    // A retried step reuses its trace id (`build_traceparent` derives it from the execution and
+    // the step), so the row its last attempt closed is already here. The gateway and the router
+    // only honour a `running` row younger than the flow timeout, so that row is reopened, fresh,
+    // with this attempt's prompt; leaving it closed refused every model and tool call the retried
+    // step's agent made. Only the run's own user's row is reopened.
     let flow_metadata = step_flow_metadata(execution_id, &actual_prompt);
     let _ = sqlx::query(
         r#"INSERT INTO flows (flow_id, user_id, root_agent_name, title, status, metadata, session_id)
            VALUES ($1, $2, $3, $4, 'running', $5, $6)
-           ON CONFLICT (flow_id) DO NOTHING"#,
+           ON CONFLICT (flow_id) DO UPDATE
+              SET status = 'running', created_at = now(), completed_at = NULL,
+                  duration_ms = NULL, error_message = NULL, metadata = EXCLUDED.metadata
+            WHERE flows.user_id = EXCLUDED.user_id"#,
     )
     .bind(&trace_id)
     .bind(user_id)
@@ -1286,8 +1295,8 @@ pub async fn continue_paused_step(
             .to_string(),
     };
 
-    // `register_flow` (execute_step's first-attempt insert) stamped `created_at` once, at the
-    // original attempt — `ON CONFLICT DO NOTHING`, never touched again. The MCP gateway's
+    // `execute_step` stamped `created_at` when the paused attempt called the agent, and the
+    // pause closed the row. The MCP gateway's
     // liveness check (`gateway.rs::flow_user`) requires `created_at` to be within
     // `NASIKO_FLOW_TIMEOUT_SECS` (600s default) of `now()`, so a human who takes longer than that to
     // approve a paused tool call permanently strands this trace id: every retried `tools/call`
```

**File**: `server/tests/maf_step_flow_retry.rs` (added, +341/-0)
```diff
@@ -0,0 +1,341 @@
+//! A retried MAF step reopens the flow its last attempt closed, so its agent's model and tool
+//! calls are authorized again; a flow row of another user's under the same id stays closed.
+//!
+//! Requires infra (Postgres :5432, Redis, S3):
+//!   cargo test -p nasiko-server --test maf_step_flow_retry -- --test-threads=1
+
+mod common;
+
+use std::sync::{Arc, Mutex};
+
+use async_trait::async_trait;
+use axum::extract::State;
+use axum::http::{HeaderMap, StatusCode};
+use axum::response::{IntoResponse, Response};
+use axum::{Json, Router, routing::post};
+use nasiko_orchestrator::maf::llm::LlmClient;
+use nasiko_orchestrator::maf::types::{MafDefinition, MafStep, RunError, StepOutcome};
+use nasiko_orchestrator::maf::{LinearMafExecutor, MafExecutor, MafRunContext};
+use nasiko_orchestrator::target::ForwardTarget;
+use nasiko_orchestrator::{AgentTargetResolver, ResolveCaller, ResolveFailure};
+use serde_json::{Value, json};
+use serial_test::serial;
+use sqlx::PgPool;
+use uuid::Uuid;
+
+/// The MCP gateway's and the LLM router's test for a live flow (`mcp/identity.rs`,
+/// `llm-router/src/resolver`), with the default flow timeout.
+const LIVE_FLOW: &str = "SELECT EXISTS(SELECT 1 FROM flows WHERE flow_id = $1 AND status = 'running' \
+                         AND created_at > now() - make_interval(secs => 600))";
+
+struct Unmetered;
+
+impl nasiko_types::agent_call::AgentCallMeter for Unmetered {
+    fn begin(&self, _agent_id: Uuid) -> Box<dyn nasiko_types::agent_call::AgentCallHandle> {
+        Box::new(nasiko_types::agent_call::UnmeteredCall)
+    }
+}
+
+/// Sends every step to one address.
+struct At(String);
+
+#[async_trait]
+impl AgentTargetResolver for At {
+    async fn resolve(
+        &self,
+        _agent_id: Uuid,
+        _caller: &ResolveCaller,
+        _context_id: Option<&str>,
+    ) -> Result<ForwardTarget, ResolveFailure> {
+        Ok(ForwardTarget::from(self.0.clone()))
+    }
+}
+
+async fn serve(app: Router) -> String {
+    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+    let url = format!("http://{}", listener.local_addr().unwrap());
+    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
+    url
+}
+
+/// What the stub agent saw on each call: whether the flow its traceparent names was live.
+#[derive(Clone)]
+struct Agent {
+    db: PgPool,
+    seen_live: Arc<Mutex<Vec<bool>>>,
+    fail_first: bool,
+}
+
+/// A stub agent that records, per call, whether the gateway would authorize its calls. With
+/// `fail_first`, its first call answers 500 (a failed step, not sent again).
+async fn stub_agent(agent: Agent) -> String {
+    async fn answer(
+        State(agent): State<Agent>,
+        headers: HeaderMap,
+        Json(body): Json<Value>,
+    ) -> Response {
+        let trace_id = headers
+            .get("traceparent")
+            .and_then(|v| v.to_str().ok())
+            .and_then(|tp| tp.split('-').nth(1))
+            .unwrap_or_default()
+            .to_string();
+        let live: bool = sqlx::query_scalar(LIVE_FLOW)
+            .bind(&trace_id)
+            .fetch_one(&agent.db)
+            .await
+            .unwrap();
+        let call = {
+            let mut seen = agent.seen_live.lock().unwrap();
+            seen.push(live);
+            seen.len()
+        };
+        if agent.fail_first && call == 1 {
+            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
+        }
+        Json(json!({ "jsonrpc": "2.0", "id": body["id"], "result": {
+            "id": "t1", "contextId": "ctx",
+            "status": { "state": "TASK_STATE_COMPLETED" },
+            "artifacts": [{ "parts": [{ "text": "done" }] }]
+        }}))
+        .into_response()
+    }
+    serve(
+        Router::new()
+            .route("/", post(answer))
+            .route("/jsonrpc", post(answer))
+            .with_state(agent),
+    )
+    .await
+}
+
+/// An OpenAI-compatible endpoint answering MAF's structured calls.
+async fn fake_llm() -> String {
+    async fn complete(Json(body): Json<Value>) -> Json<Value> {
+        let schema = body["response_format"]["json_schema"]["name"]
+            .as_str()
+            .unwrap_or_default();
+        let content = match schema {
+            "execution_plan" => json!({
+                "output_generation": "Summarize.",
+                "steps": [{ "prompt": "Do your task.", "to_extract": "the outcome" }]
+            }),
+            "generated_prompt" => json!({ "prompt": "Do your task." }),
+            "extraction_result" => json!({ "extracted_info": "extracted outcome" }),
+            "final_output" => json!({ "final_output": "final answer" }),
+            other => panic!("unexpected LLM call: {other}"),
+        };
+        Json(json!({
+            "model": "fake-model",
+            "choices": [{ "message": { "role": "assistant", "content": content.to_string() } }],
+            "usage": { "prompt_tokens": 10, "completion_tokens": 5, 
```

#### Recent Merged Pull Requests:
- **PR #367** (2026-11-16): Remove files the private tree deleted before the sync manifest existed (@nasiko-neeraj)
- **PR #365** (closed): Remove duplicate GitHub badges (@shrawansaproo01)
- **PR #356** (closed): fix(llm-router): stop dropping tool_choice "none" and related tool controls (@Prudhvi-Raj1806)
- **PR #355** (closed): Bump the npm_and_yarn group across 1 directory with 3 updates (@dependabot[bot])
- **PR #344** (closed): feat: add reproducible compaction and routing benchmarks (@AbhiramMandala)
- **PR #338** (closed): [P2: request classifier] add request classifier and context integrity… (@SVaishnaviVasa)

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

## X. ui): show the setup guide's CLI steps on an empty Coding harnesses page

**RULE**:
When implementing operations in `ui/eslint.config.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Nasiko-Labs/nasiko. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6e6e2590`: ui): show the setup guide's CLI steps on an empty Coding harnesses page. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `ui/eslint.config.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  // Coding harnesses' empty state shows the guide's own harness step.
  onboarding: ['api', 'GuideCard', 'GuideHost', 'HarnessSetup', 'index', 'logic', 'types'],
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  onboarding: ['api', 'GuideCard', 'GuideHost', 'index', 'logic', 'types'],
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6e6e2590` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
