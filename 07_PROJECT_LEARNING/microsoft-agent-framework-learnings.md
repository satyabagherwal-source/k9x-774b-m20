# Forensic Learning Record (Deep Inspection): microsoft/agent-framework

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-agent-framework-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/agent-framework](https://github.com/microsoft/agent-framework))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:51:44.742Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-framework`
- **Description**: A framework for building, orchestrating and deploying AI agents and multi-agent workflows with support for Python and .NET.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13955 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/packages/a2a/agent_framework_a2a/_utils.py`
```
# Copyright (c) Microsoft. All rights reserved.

import re

URI_PATTERN = re.compile(r"^data:(?P<media_type>[^;,]+(?:;[^;,=]+=[^;,]+)*);base64,(?P<base64_data>[A-Za-z0-9+/=]+)\Z")


def get_uri_data(uri: str) -> str:
    """Extracts the base64-encoded data from a data URI.

    Args:
        uri: The data URI to parse.

    Returns:
        The base64-encoded data part of the URI.

    Raises:
        ValueError: If the URI format is invalid.
    """
    match = URI_PATTERN.match(uri)
    if not match:
        raise ValueError(f"Invalid data URI format: {uri}")

    return match.group("base64_data")

```

### Core Architecture Module: `python/packages/ag-ui/agent_framework_ag_ui/_a2ui/_state.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""AG-UI context plumbing for A2UI.

The AG-UI A2UI middleware injects the component catalog and usage guidelines as
``RunAgentInput.context`` entries, and the ``injectA2UITool`` flag via
``forwardedProps``. MAF's AG-UI hosting (``run_agent_stream``) does not forward
``context`` to the agent by default, so this module builds the ``ag-ui`` state slice
the toolkit expects (:func:`build_ag_ui_context_slice`) and reads the enablement flag
(:func:`read_inject_a2ui_flag`).

The slice is handed to the A2UI runner (``A2UIAgent``) directly per run — NOT stamped
onto run-option
``additional_properties``. The wrappers feed it to the toolkit's
``build_context_prompt`` / ``prepare_a2ui_request``. (The old ``ChatOptions``
``additional_properties`` channel leaked the slice to the provider SDK on any run that
carried AG-UI context; passing it in directly keeps it off the wire.)
"""

from __future__ import annotations

import json
from typing import Any

# MUST stay byte-identical to the A2UI middleware's exported
# A2UI_SCHEMA_CONTEXT_DESCRIPTION (middlewares/a2ui-middleware/src/index.ts) and to
# the langgraph-python adapter's copy. The match below is exact-equality; any drift
# silently routes the schema into the generic context section instead of
# ``a2ui_schema``, defeating the catalog-aware validation path.
A2UI_SCHEMA_CONTEXT_DESCRIPTION = (
    "A2UI Component Schema — available components for generating UI surfaces. "
    "Use these component names and properties when creating A2UI operations."
)


def _entry_desc_value(entry: Any) -> tuple[str, Any]:
    """Read (description, value) from a context entry that may be a dict or object."""
    if isinstance(entry, dict):
        return entry.get("description", "") or "", entry.get("value")
    return getattr(entry, "description", "") or "", getattr(entry, "value", None)


def build_ag_ui_context_slice(context: list[Any] | None) -> dict[str, Any]:
    """Build the ``ag-ui`` context slice from AG-UI ``context`` entries.

    Splits the A2UI schema context entry (matched by exact description) into
    ``a2ui_schema`` and routes the remaining entries to ``context``, mirroring the
    langgraph-python adapter. This slice is catalog/guidelines ONLY — it is what the
    toolkit's ``build_context_prompt`` consumes.

    The auto-inject ENABLEMENT flag is deliberately NOT part of this slice: enablement
    is sourced from ``forwardedProps`` (see :func:`read_inject_a2ui_flag`), a separate
    concern from the catalog context. Returns an empty dict when there is no A2UI
    context, so callers can skip stamping for non-A2UI runs.
    """
    schema_value: Any = None
    regular_context: list[Any] = []
    for entry in context or []:
        desc, value = _entry_desc_value(entry)
        if desc == A2UI_SCHEMA_CONTEXT_DESCRIPTION:
            schema_value = value
        else:
            regular_context.append(entry)

    slice_: dict[str, Any] = {}
    if regular_context:
        slice_["context"] = regular_context
    if schema_value is not None:
        slice_["a2ui_schema"] = schema_value
    return slice_


def read_inject_a2ui_flag(forwarded_props: dict[str, Any] | None) -> Any:
    """Read the A2UI auto-inject enablement flag from ``forwardedProps``.

    Enablement comes from ``forwardedProps.injectA2UITool`` (set by the AG-UI
    a2ui-middleware), NOT from ``context``. Returns the RAW value — ``True``/``False``,
    or a string naming the injected render tool to drop (Strands-parity) — or ``None``
    when unset so a backend opt-in can take over with nullish fallback. Callers gate on
    truthiness; auto-injection preserves a string value as the render-tool name. MAF
    does not snake-mangle ``forwardedProps`` keys (unlike langgraph), so the camelCase
    form is canonical; the snake form is accepted for safety.
    """
    forwarded = forwarded_props if isinstance(forwarded_props, dict) else {}
    if "injectA2UITool" in forwarded:
        return forwarded["injectA2UITool"]
    if "inject_a2ui_tool" in forwarded:
        return forwarded["inject_a2ui_tool"]
    return None


def _role_value(msg: Any) -> str | None:
    role = getattr(msg, "role", None)
    return getattr(role, "value", role) if role is not None else None


def to_history_messages(messages: list[Any]) -> list[dict[str, Any]]:
    """Map MAF ``Message`` objects onto the toolkit's history shape.

    The toolkit's ``find_prior_surface`` / ``prepare_a2ui_request`` walk a list of
    ``{"role", "content"}`` entries, where a tool message's content is the JSON
    string of its function-result payload (the A2UI operations envelope for prior
    renders). Duck-typed (no agent_framework import) so this module stays
    dependency-light.
    """
    out: list[dict[str, Any]] = []
    for msg in messages:
        role = _role_value(msg)
        content: Any = getattr(msg, "text", None)
        if not content and role == "tool":
            # A tool message carries its payload as function_result content; the
            # prior-surface walker needs the raw JSON string.
            for c in getattr(msg, "contents", None) or []:
                if getattr(c, "type", None) == "function_result":
                    result = getattr(c, "result", None)
                    content = result if isinstance(result, str) else _safe_json(result)
                    if content:
                        break
        out.append({"role": role, "content": content})
    return out


def _safe_json(value: Any) -> str:
    try:
        return json.dumps(value, default=str)
    except (TypeError, ValueError):
        return str(value)

```

### Core Architecture Module: `python/packages/ag-ui/agent_framework_ag_ui/_approval_lifecycle.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""Server-owned lifecycle for AG-UI approval-gated tool calls."""

from __future__ import annotations

import logging
from asyncio import CancelledError
from collections.abc import Awaitable, Callable, Iterator
from contextlib import ExitStack
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from threading import RLock
from time import monotonic
from typing import Any, TypeVar
from uuid import uuid4

from agent_framework import Content

logger = logging.getLogger(__name__)
_ReturnT = TypeVar("_ReturnT")


def _serialized_registration(method: Callable[..., _ReturnT]) -> Callable[..., _ReturnT]:
    @wraps(method)
    def wrapper(self: ApprovalLifecycle, *args: Any, **kwargs: Any) -> _ReturnT:
        with self._index_lock:
            return method(self, *args, **kwargs)

    return wrapper


def _serialized_by_batch(method: Callable[..., _ReturnT]) -> Callable[..., _ReturnT]:
    @wraps(method)
    def wrapper(self: ApprovalLifecycle, *args: Any, **kwargs: Any) -> _ReturnT:
        thread_id = kwargs.get("thread_id")
        if not isinstance(thread_id, str):
            raise TypeError("Serialized approval transitions require a thread_id.")
        decisions = kwargs.get("decisions")
        decision_interrupt_ids = (
            [decision.interrupt_id for decision in decisions]
            if isinstance(decisions, list) and all(isinstance(decision, ResumeDecision) for decision in decisions)
            else []
        )
        cancellation_interrupt_ids = kwargs.get("cancelled_interrupt_ids", kwargs.get("interrupt_ids", []))
        interrupt_ids = [*decision_interrupt_ids, *cancellation_interrupt_ids]
        if not isinstance(interrupt_ids, list) or not all(
            isinstance(interrupt_id, str) for interrupt_id in interrupt_ids
        ):
            raise TypeError("Serialized approval transitions require interrupt identities.")
        locks = self._locks_for_batch(thread_id=thread_id, interrupt_ids=interrupt_ids)
        with ExitStack() as stack:
            for lock in locks:
                stack.enter_context(lock)
            try:
                return method(self, *args, **kwargs)
            except (KeyError, ValueError) as exc:
                self._emit_event("authority_failure", failure_type=type(exc).__name__)
                raise

    return wrapper


def _serialized_by_occurrence(method: Callable[..., _ReturnT]) -> Callable[..., _ReturnT]:
    @wraps(method)
    def wrapper(self: ApprovalLifecycle, *args: Any, **kwargs: Any) -> _ReturnT:
        intent = args[0] if args else kwargs.get("intent")
        if not isinstance(intent, AuthorizedExecution):
            raise TypeError("Serialized approval transitions require an authorized execution.")
        with self._lock_for_identity(intent.identity):
            return method(self, *args, **kwargs)

    return wrapper


class ApprovalIndeterminateError(ValueError):
    """An approval may have executed but has no retained terminal outcome."""


class ApprovalCapacityError(RuntimeError):
    """Approval state capacity is exhausted by protected occurrences."""


class ApprovalClaimConflictError(ValueError):
    """Approval authority cannot be claimed in its current state."""


class ApprovalSettlementConflictError(ValueError):
    """An approval outcome cannot settle in its current state."""


class ApprovalStatus(str, Enum):
    """Lifecycle state of one server-owned approval occurrence."""

    PENDING = "pending"
    CLAIMED = "claimed"
    EXECUTING = "executing"
    SETTLED = "settled"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    INDETERMINATE = "indeterminate"

    @property
    def is_terminal(self) -> bool:
        """Whether this state has ended its approval authority."""
        return self in {
            ApprovalStatus.SETTLED,
            ApprovalStatus.REJECTED,
            ApprovalStatus.CANCELLED,
            ApprovalStatus.EXPIRED,
            ApprovalStatus.INDETERMINATE,
        }

    @property
    def is_purgeable(self) -> bool:
        """Whether this terminal state may expire after the retention window."""
        return self.is_terminal and self is not ApprovalStatus.INDETERMINATE


class ApprovalExecutionOwner(str, Enum):
    """Runtime owner authorized to continue an approved occurrence."""

    LOCAL = "local"
    HOSTED = "hosted"
    DEFERRED = "deferred"
    UNAVAILABLE = "unavailable"


class ClaimRecoveryPolicy(str, Enum):
    """Proof required to release authority before execution begins."""

    SAFE_TO_RETRY = "safe_to_retry"
    PRESERVE_PENDING_RETENTION = "preserve_pending_retention"


@dataclass(frozen=True)
class ApprovalOccurrenceIdentity:
    """Identity of one occurrence within a scoped server-owned thread."""

    thread_id: str
    occurrence_id: str
    interrupt_id: str
    call_id: str


@dataclass(frozen=True)
class ApprovalSnapshotReconciliation:
    """Semantic lifecycle result used to retire or retain one snapshot control."""

    interrupt_id: str
    identity: ApprovalOccurrenceIdentity | None
    status: ApprovalStatus | None
    retire_interrupt: bool

    @property
    def is_missing(self) -> bool:
        """Whether no lifecycle occurrence exists for the snapshot interrupt."""
        return self.status is None


@dataclass(frozen=True)
class ResumeDecision:
    """Canonical client decision presented to the approval lifecycle."""

    interrupt_id: str
    accepted: bool
    arguments: str | None
    name: str | None = None
    original_arguments: str | None = None


@dataclass
class ApprovalOccurrence:
    """Server-owned state for one approval-gated call occurrence."""

    identity: ApprovalOccurrenceIdentity
    thread_ids: tuple[str, ...]
    name: str
    arguments: str
    owner: ApprovalExecutionOwner
    function_call_id: str
    active_interrupt_id: str
    scope: str | None = None
    aliases: tuple[str, ...] = ()
    response_id: str | None = None
    already_approved_requests: tuple[dict[str, Any], ...] = ()
    server_label: str | None = None
    idempotency_key: str | None = None
    requires_client_resume: bool = True
    status: ApprovalStatus = ApprovalStatus.PENDING
    pending_since: float = 0
    replayable_results: list[ReplayableToolResult] = field(default_factory=list)
    decision: ResumeDecision | None = None
    outcome: ApprovalOutcome | None = None
    terminal_at: float | None = None


@dataclass(frozen=True)
class AuthorizedExecution:
    """Authority for one Pending Tool Transition Owner to continue a call."""

    identity: ApprovalOccurrenceIdentity
    name: str
    arguments: str
    owner: ApprovalExecutionOwner
    idempotency_key: str | None = None


@dataclass(frozen=True)
class ReplayableToolResult:
    """A settled tool result retained under its original call identity."""

    content: Content


@dataclass(frozen=True)
class ApprovalOutcome:
    """Terminal outcome retained for one approval occurrence."""

    identity: ApprovalOccurrenceIdentity
    replayable_results: tuple[ReplayableToolResult, ...]
    result_group: tuple[Content, ...]
    snapshot_reconciliation: ApprovalSnapshotReconciliation


@dataclass(frozen=True)
class ApprovalBatchDecision:
    """Validated batch result containing new authority and retained outcomes."""

    authorized_executions: tuple[AuthorizedExecution, ...]
    retained_outcomes: tuple[ApprovalOutcome, ...] = ()
    snapshot_reconciliations: tuple[ApprovalSnapshotReconciliation, ...] = ()

    def __iter__(self) -> Iterator[AuthorizedExecution]:
        """Iterate newly authorized executions for compatibility with existing callers."""
        return iter(self.authorized_executions)


class ApprovalLifecycle:
    """Own process-local registration, authority transitions, and settlement for approvals."""

    def __init__(
        self,
        *,
        max_entries: int = 10_000,
        pending_retention_seconds: float = 86_400,
        indeterminate_retention_seconds: float = 604_800,
        terminal_retention_seconds: float = 900,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be greater than 0.")
        if pending_retention_seconds <= 0:
            raise ValueError("pending_retention_seconds must be greater than 0.")
        if indeterminate_retention_seconds <= 0:
            raise ValueError("indeterminate_retention_seconds must be greater than 0.")
        if terminal_retention_seconds <= 0:
            raise ValueError("terminal_retention_seconds must be greater than 0.")
        self._max_entries = max_entries
        self._pending_retention_seconds = pending_retention_seconds
        self._indeterminate_retention_seconds = indeterminate_retention_seconds
        self._terminal_retention_seconds = terminal_retention_seconds
        self._clock = clock
        self._index_lock = RLock()
        self._locks_by_identity: dict[ApprovalOccurrenceIdentity, RLock] = {}
        self._occurrences: dict[ApprovalOccurrenceIdentity, ApprovalOccurrence] = {}
        self._pending_by_interrupt: dict[tuple[str, str], ApprovalOccurrenceIdentity] = {}
        self._terminal_by_interrupt: dict[tuple[str, str], ApprovalOccurrenceIdentity] = {}

    def register(
        self,
        *,
        owner: ApprovalExecutionOwner,
        scope: str | None = None,
        thread_ids: list[str] | None = None,
        thread_id: str | None = None,
        interrupt_id: str,
        call_id: str,
        name: str,
        arguments: str,
        function_call_id: str | None = None,
        aliases: list[str] | None = None,
        response_id: str | None = None,
        already_approved_requests: list[dict[str, Any]] | None = None,
        server_label: str | None = None,
        idempotency_key: str | None = None,
        requires_client_resume: bool = True,
    ) -> ApprovalOccurrence:
        """Regist
```

### Core Architecture Module: `python/packages/ag-ui/agent_framework_ag_ui/_approval_state.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""Server-side AG-UI approval state storage."""

from __future__ import annotations

import copy
from threading import RLock
from typing import Any

from ._approval_lifecycle import ApprovalCapacityError, ApprovalExecutionOwner, ApprovalLifecycle

ApprovalScope = str
"""Application-defined scope for server-side AG-UI Approval State."""

DEFAULT_MAX_APPROVAL_STATES = 10_000
DEFAULT_PENDING_RETENTION_SECONDS = 86_400
DEFAULT_INDETERMINATE_RETENTION_SECONDS = 604_800
DEFAULT_TERMINAL_RETENTION_SECONDS = 900
_APPROVAL_SCOPE_INPUT_KEY = "__ag_ui_approval_scope"
_APPROVAL_THREAD_SEPARATOR = "\x1f"


def approval_state_thread_id(*, scope: object | None, thread_id: str) -> str:
    """Return the storage thread key for Approval State.

    ``None`` is the only unscoped value. A provided scope must be a non-empty
    string so accidental empty or malformed scopes cannot collapse into the
    unscoped namespace.
    """
    if scope is None:
        return thread_id
    if not isinstance(scope, str) or not scope:
        raise ValueError("scope must be a non-empty string when provided.")
    return f"{scope}{_APPROVAL_THREAD_SEPARATOR}{thread_id}"


class InMemoryAGUIApprovalStateStore:
    """Bounded process-local server-side store for AG-UI Approval State.

    State is local to one process and is not durable across restarts or replicas.
    Active and indeterminate occurrences are protected from eviction. Terminal
    outcomes guarantee duplicate-execution protection for the configured
    retention interval.
    """

    def __init__(
        self,
        *,
        max_entries: int = DEFAULT_MAX_APPROVAL_STATES,
        pending_retention_seconds: float = DEFAULT_PENDING_RETENTION_SECONDS,
        indeterminate_retention_seconds: float = DEFAULT_INDETERMINATE_RETENTION_SECONDS,
        terminal_retention_seconds: float = DEFAULT_TERMINAL_RETENTION_SECONDS,
    ) -> None:
        """Initialize the process-local Approval State store.

        Keyword Args:
            max_entries: Maximum approval occurrences or middleware state entries to retain.
            pending_retention_seconds: Maximum time to retain abandoned pending approval authority.
            indeterminate_retention_seconds: Safety window for uncertain execution records before reclamation.
            terminal_retention_seconds: Process-local duplicate-execution protection window.

        Raises:
            ValueError: If ``max_entries`` is less than 1.
        """
        if max_entries < 1:
            raise ValueError("max_entries must be greater than 0.")
        self.max_entries = max_entries
        self._lock = RLock()
        self._tool_approval_states: dict[str, dict[str, Any]] = {}
        self.lifecycle = ApprovalLifecycle(
            max_entries=max_entries,
            pending_retention_seconds=pending_retention_seconds,
            indeterminate_retention_seconds=indeterminate_retention_seconds,
            terminal_retention_seconds=terminal_retention_seconds,
        )

    def register(
        self,
        *,
        thread_ids: list[str],
        name: str,
        arguments: str,
        request_id: str,
        interrupt_id: str,
        owner: ApprovalExecutionOwner,
        call_id: str | None = None,
        function_call_id: str | None = None,
        scope: ApprovalScope | None = None,
        already_approved_requests: list[dict[str, Any]] | None = None,
        server_label: str | None = None,
    ) -> None:
        """Register one occurrence with its pending transition owner."""
        unique_thread_ids = list(dict.fromkeys(thread_ids))
        self.lifecycle.register(
            owner=owner,
            scope=scope,
            thread_ids=unique_thread_ids,
            interrupt_id=interrupt_id,
            call_id=call_id or interrupt_id,
            name=name,
            arguments=arguments,
            function_call_id=function_call_id,
            aliases=[request_id],
            response_id=request_id,
            already_approved_requests=already_approved_requests,
            server_label=server_label,
        )

    def set_tool_approval_state(self, thread_id: str, state: dict[str, Any]) -> None:
        """Store approval middleware state without evicting another active thread."""
        with self._lock:
            if thread_id not in self._tool_approval_states and len(self._tool_approval_states) >= self.max_entries:
                raise ApprovalCapacityError("Approval state capacity is exhausted by protected occurrences.")
            self._tool_approval_states[thread_id] = copy.deepcopy(state)

    def get_tool_approval_state(self, thread_id: str) -> dict[str, Any] | None:
        """Return an isolated copy of server-owned middleware approval state."""
        with self._lock:
            state = self._tool_approval_states.get(thread_id)
            return copy.deepcopy(state) if state is not None else None

    def delete_tool_approval_state(self, thread_id: str) -> None:
        """Delete server-owned middleware approval state for one scoped thread."""
        with self._lock:
            self._tool_approval_states.pop(thread_id, None)

    def has_tool_approval_state(self, thread_id: str) -> bool:
        """Return whether middleware approval state exists for one scoped thread."""
        with self._lock:
            return thread_id in self._tool_approval_states

```

### Core Architecture Module: `python/packages/ag-ui/agent_framework_ag_ui/_predictive_state.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""Predictive state handling utilities."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from ag_ui.core import StateDeltaEvent

from ._utils import safe_json_parse

logger = logging.getLogger(__name__)


class PredictiveStateHandler:
    """Handles predictive state updates from streaming tool calls."""

    def __init__(
        self,
        predict_state_config: dict[str, dict[str, str]] | None = None,
        current_state: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the handler.

        Args:
            predict_state_config: Configuration mapping state keys to tool/argument pairs
            current_state: Reference to current state dict
        """
        self.predict_state_config = predict_state_config or {}
        self.current_state = current_state or {}
        self.streaming_tool_args: str = ""
        self.last_emitted_state: dict[str, Any] = {}
        self.state_delta_count: int = 0
        self.pending_state_updates: dict[str, Any] = {}

    def reset_streaming(self) -> None:
        """Reset streaming state for a new tool call."""
        self.streaming_tool_args = ""
        self.state_delta_count = 0

    def extract_state_value(
        self,
        tool_name: str,
        args: dict[str, Any] | str | None,
    ) -> tuple[str, Any] | None:
        """Extract state value from tool arguments based on config.

        Args:
            tool_name: Name of the tool being called
            args: Tool arguments (dict or JSON string)

        Returns:
            Tuple of (state_key, state_value) or None if no match
        """
        if not self.predict_state_config:
            return None

        parsed_args = safe_json_parse(args) if isinstance(args, str) else args
        if not parsed_args:
            return None

        for state_key, config in self.predict_state_config.items():
            if config["tool"] != tool_name:
                continue
            tool_arg_name = config["tool_argument"]
            if tool_arg_name == "*":
                return (state_key, parsed_args)
            if tool_arg_name in parsed_args:
                return (state_key, parsed_args[tool_arg_name])

        return None

    def is_predictive_tool(self, tool_name: str | None) -> bool:
        """Check if a tool is configured for predictive state.

        Args:
            tool_name: Name of the tool to check

        Returns:
            True if tool is in predictive state config
        """
        if not tool_name or not self.predict_state_config:
            return False
        for config in self.predict_state_config.values():
            if config["tool"] == tool_name:
                return True
        return False

    def emit_streaming_deltas(
        self,
        tool_name: str | None,
        argument_chunk: str,
    ) -> list[StateDeltaEvent]:
        """Process streaming argument chunk and emit state deltas.

        Args:
            tool_name: Name of the current tool
            argument_chunk: New chunk of JSON arguments

        Returns:
            List of state delta events to emit
        """
        events: list[StateDeltaEvent] = []
        if not tool_name or not self.predict_state_config:
            return events

        self.streaming_tool_args += argument_chunk
        logger.debug(
            "Predictive state: accumulated %s chars for tool '%s'",
            len(self.streaming_tool_args),
            tool_name,
        )

        # Try to parse complete JSON first
        parsed_args = None
        try:
            parsed_args = json.loads(self.streaming_tool_args)
        except json.JSONDecodeError:
            # Fall back to regex matching for partial JSON
            events.extend(self._emit_partial_deltas(tool_name))

        if parsed_args:
            events.extend(self._emit_complete_deltas(tool_name, parsed_args))

        return events

    def _emit_partial_deltas(self, tool_name: str) -> list[StateDeltaEvent]:
        """Emit deltas from partial JSON using regex matching.

        Args:
            tool_name: Name of the current tool

        Returns:
            List of state delta events
        """
        events: list[StateDeltaEvent] = []

        for state_key, config in self.predict_state_config.items():
            if config["tool"] != tool_name:
                continue
            tool_arg_name = config["tool_argument"]
            pattern = rf'"{re.escape(tool_arg_name)}":\s*"([^"]*)'
            match = re.search(pattern, self.streaming_tool_args)

            if match:
                partial_value = match.group(1).replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")

                if state_key not in self.last_emitted_state or self.last_emitted_state[state_key] != partial_value:
                    event = self._create_delta_event(state_key, partial_value)
                    events.append(event)
                    self.last_emitted_state[state_key] = partial_value
                    self.pending_state_updates[state_key] = partial_value

        return events

    def _emit_complete_deltas(
        self,
        tool_name: str,
        parsed_args: dict[str, Any],
    ) -> list[StateDeltaEvent]:
        """Emit deltas from complete parsed JSON.

        Args:
            tool_name: Name of the current tool
            parsed_args: Fully parsed arguments dict

        Returns:
            List of state delta events
        """
        events: list[StateDeltaEvent] = []

        for state_key, config in self.predict_state_config.items():
            if config["tool"] != tool_name:
                continue
            tool_arg_name = config["tool_argument"]

            if tool_arg_name == "*":
                state_value = parsed_args
            elif tool_arg_name in parsed_args:
                state_value = parsed_args[tool_arg_name]
            else:
                continue

            if state_key not in self.last_emitted_state or self.last_emitted_state[state_key] != state_value:
                event = self._create_delta_event(state_key, state_value)
                events.append(event)
                self.last_emitted_state[state_key] = state_value
                self.pending_state_updates[state_key] = state_value

        return events

    def _create_delta_event(self, state_key: str, value: Any) -> StateDeltaEvent:
        """Create a state delta event with logging.

        Args:
            state_key: The state key being updated
            value: The new value

        Returns:
            StateDeltaEvent instance
        """
        self.state_delta_count += 1
        if self.state_delta_count % 10 == 1:
            logger.info(
                "StateDeltaEvent #%s for '%s': op=replace, path=/%s, value_length=%s",
                self.state_delta_count,
                state_key,
                state_key,
                len(str(value)),
            )
        elif self.state_delta_count % 100 == 0:
            logger.info(f"StateDeltaEvent #{self.state_delta_count} emitted")

        return StateDeltaEvent(
            delta=[
                {
                    "op": "replace",
                    "path": f"/{state_key}",
                    "value": value,
                }
            ],
        )

    def apply_pending_updates(self) -> None:
        """Apply pending updates to current state and clear them."""
        for key, value in self.pending_state_updates.items():
            self.current_state[key] = value
        self.pending_state_updates.clear()

```

### Core Architecture Module: `python/packages/ag-ui/agent_framework_ag_ui/_state.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""AG-UI state carrier and deterministic tool-result state helpers.

Tools wired into the :mod:`agent_framework_ag_ui` endpoint can push a
deterministic state update or a per-call tool result display payload by
returning :func:`state_update`. Unlike ``predict_state_config`` — which emits
``StateDeltaEvent``s optimistically from LLM-predicted tool call arguments —
``state_update`` runs *after* the tool executes, so AG-UI state and display
content always reflect the tool's actual return value.

See issue https://github.com/microsoft/agent-framework/issues/3167 for the
motivating discussion.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from agent_framework import Content

from ._utils import make_json_safe

__all__ = ["STATE_CARRIER_KEY", "TOOL_RESULT_DISPLAY_KEY", "TOOL_RESULT_STATE_KEY", "state_carrier", "state_update"]


STATE_CARRIER_KEY = "__ag_ui_state_carrier__"
"""Reserved ``Content.additional_properties`` key marking an AG-UI request state carrier."""

TOOL_RESULT_STATE_KEY = "__ag_ui_tool_result_state__"
"""Reserved ``Content.additional_properties`` key used to carry a tool-driven
state snapshot from a tool return value through to the AG-UI emitter."""

TOOL_RESULT_DISPLAY_KEY = "__ag_ui_tool_result_display__"
"""Reserved ``Content.additional_properties`` key used to carry UI-only tool result display content from a tool return value through to the AG-UI emitter."""

_UNSET = object()


def _serialize_tool_result(value: Any) -> str:  # noqa: ANN401
    return value if isinstance(value, str) else json.dumps(make_json_safe(value))


def state_carrier(state: Mapping[str, Any]) -> Content:
    """Build a dedicated message carrier for ``AGUIChatClient`` request state.

    Add the returned content as the only content in a user message. The client
    recognizes its explicit marker anywhere in client-controlled history, moves
    the most recent carrier's JSON object into the AG-UI request's ``state``
    field, and does not send carriers as chat messages. Ordinary
    ``application/json`` content without this marker remains a document input.

    Example:
        .. code-block:: python

            from agent_framework import Message
            from agent_framework_ag_ui import state_carrier

            messages = [
                Message(role="user", contents=["Update the dashboard"]),
                Message(role="user", contents=[state_carrier({"selected_tab": "sales"})]),
            ]

    Args:
        state: JSON-compatible mapping to send as AG-UI shared state.

    Returns:
        A JSON ``Content`` marked as an AG-UI request state carrier.

    Raises:
        TypeError: If ``state`` is not a mapping.
    """
    if not isinstance(state, Mapping):
        raise TypeError(f"state_carrier() 'state' must be a Mapping, got {type(state).__name__}")
    return Content.from_data(
        json.dumps(make_json_safe(dict(state))).encode("utf-8"),
        media_type="application/json",
        additional_properties={STATE_CARRIER_KEY: True},
    )


def state_update(
    text: str = "",
    *,
    state: Mapping[str, Any] | None = None,
    tool_result: Any = _UNSET,  # noqa: ANN401
) -> Content:
    """Build a tool return value that updates AG-UI shared state or display content.

    Return the result of this helper from an agent tool to push a state update
    or UI-only display payload to AG-UI clients using the actual tool output,
    rather than LLM-predicted tool arguments.

    When the AG-UI endpoint emits the tool result, it will:

    * Forward ``text`` to the LLM as the normal ``function_result`` content.
    * Use ``tool_result`` as the ``ToolCallResultEvent.content`` payload shown
      to AG-UI clients, falling back to ``text`` when no display payload is set.
    * Merge ``state`` into ``FlowState.current_state``.
    * Emit a deterministic ``StateSnapshotEvent`` after the ``ToolCallResult``
      event so frontends observe the updated state deterministically. If
      predictive state is enabled, a predictive snapshot may be emitted first.

    Example:
        .. code-block:: python

            from agent_framework import Content, tool
            from agent_framework_ag_ui import state_update


            @tool
            async def get_weather(city: str) -> Content:
                data = await _fetch_weather(city)
                return state_update(
                    text=f"Weather in {city}: {data['temp']}°C {data['conditions']}",
                    state={"weather": {"city": city, **data}},
                )

    Example:
        .. code-block:: python

            from agent_framework import Content, tool
            from agent_framework_ag_ui import state_update


            @tool
            async def get_weather(city: str) -> Content:
                data = await _fetch_weather(city)
                return state_update(
                    text=f"{city}: {data['temp']}°C and {data['conditions']}",
                    tool_result={
                        "component": "weather-card",
                        "city": city,
                        "temperature": data["temp"],
                        "conditions": data["conditions"],
                        "humidity": data["humidity"],
                    },
                    state={"weather": {"city": city, **data}},
                )

    Args:
        text: Text passed back to the LLM as the ``function_result`` content.
            Defaults to an empty string for tools whose only output is a state
            update.
        state: A mapping merged into the AG-UI shared state via JSON-compatible
            ``dict.update`` semantics. Nested dicts are replaced, not deep-merged.
        tool_result: JSON-safe payload emitted to AG-UI clients as
            ``ToolCallResultEvent.content`` for frontend rendering. The LLM
            still receives ``text``. If ``text`` is empty, the serialized
            display payload is also used as the LLM-bound text fallback.

    Returns:
        A ``Content`` object with ``type="text"``. The state payload rides in
        ``additional_properties`` under :data:`TOOL_RESULT_STATE_KEY`
        (``"__ag_ui_tool_result_state__"``), and the display payload rides
        under :data:`TOOL_RESULT_DISPLAY_KEY`
        (``"__ag_ui_tool_result_display__"``). Both reserved keys are extracted
        by the AG-UI emitter.

    Raises:
        TypeError: If ``state`` is not a ``Mapping``.
    """
    if state is not None and not isinstance(state, Mapping):
        raise TypeError(f"state_update() 'state' must be a Mapping, got {type(state).__name__}")
    additional_properties: dict[str, Any] = {}
    if state is not None:
        additional_properties[TOOL_RESULT_STATE_KEY] = dict(state)
    if tool_result is not _UNSET:
        display_content = _serialize_tool_result(tool_result)
        additional_properties[TOOL_RESULT_DISPLAY_KEY] = display_content
        if not text:
            text = display_content
    return Content.from_text(
        text,
        additional_properties=additional_properties,
    )

```

### Core Architecture Module: `python/packages/ag-ui/agent_framework_ag_ui/_utils.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""Utility functions for AG-UI integration."""

from __future__ import annotations

import copy
import json
import uuid
from collections.abc import Callable, MutableMapping, Sequence
from typing import Any

from agent_framework import AgentResponseUpdate, ChatResponseUpdate, Content, FunctionTool
from agent_framework import _mcp as _core_mcp  # pyright: ignore[reportPrivateUsage]
from agent_framework._serialization import make_json_safe  # pyright: ignore[reportPrivateUsage]


def _mcp_tool_result_host_payload_key(core_mcp: Any) -> str:
    """Resolve the private core marker while supporting older core packages."""
    return getattr(core_mcp, "_MCP_TOOL_RESULT_HOST_PAYLOAD_KEY", "_mcp_tool_result_host_payload")


_MCP_TOOL_RESULT_HOST_PAYLOAD_KEY = _mcp_tool_result_host_payload_key(_core_mcp)
_AGUI_TOOL_RESULT_MODEL_CONTENT_KEY = "_agentFrameworkModelContent"
_AGUI_MCP_TOOL_RESULT_KEY = "_agentFrameworkMcpResult"
_AGUI_TOOL_RESULT_HOST_PAYLOAD_KEY = "_agentFrameworkHostPayload"
_AGUI_HOST_PAYLOAD_OMITTED_KEY = "_agentFrameworkHostPayloadOmitted"
_MAX_MCP_HOST_PAYLOAD_HISTORY_SIZE_BYTES = 8 * 1024 * 1024
_HOST_ONLY_REPLAY_ITEM_KEYS = frozenset(
    {
        "_meta",
        _MCP_TOOL_RESULT_HOST_PAYLOAD_KEY,
        _AGUI_MCP_TOOL_RESULT_KEY,
        _AGUI_TOOL_RESULT_HOST_PAYLOAD_KEY,
        _AGUI_TOOL_RESULT_MODEL_CONTENT_KEY,
        _AGUI_HOST_PAYLOAD_OMITTED_KEY,
    }
)

# Role mapping constants
AGUI_TO_FRAMEWORK_ROLE: dict[str, str] = {
    "user": "user",
    "assistant": "assistant",
    "system": "system",
}

FRAMEWORK_TO_AGUI_ROLE: dict[str, str] = {
    "user": "user",
    "assistant": "assistant",
    "system": "system",
}

ALLOWED_AGUI_ROLES: set[str] = {"user", "assistant", "system", "tool", "reasoning"}


def generate_event_id() -> str:
    """Generate a unique event ID."""
    return str(uuid.uuid4())


def safe_json_parse(value: Any) -> dict[str, Any] | None:
    """Safely parse a value as JSON dict.

    Args:
        value: String or dict to parse

    Returns:
        Parsed dict or None if parsing fails
    """
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    return None


def _extract_tool_result_marker_values(content: Any, key: str) -> list[Any]:
    """Extract marker values from outer and inner tool-result content."""
    values: list[Any] = []

    outer_properties = getattr(content, "additional_properties", None) or {}
    if key in outer_properties:
        values.append(outer_properties[key])

    for item in getattr(content, "items", None) or ():
        item_properties = getattr(item, "additional_properties", None) or {}
        if key in item_properties:
            values.append(item_properties[key])

    return values


def _extract_mcp_tool_result_host_payload(content: Any) -> tuple[bool, Any]:
    """Return whether a core-preserved MCP Host payload exists and its value."""
    outer_properties = getattr(content, "additional_properties", None) or {}
    if _MCP_TOOL_RESULT_HOST_PAYLOAD_KEY in outer_properties:
        return True, outer_properties[_MCP_TOOL_RESULT_HOST_PAYLOAD_KEY]

    values: list[Any] = []
    for item in getattr(content, "items", None) or ():
        item_properties = getattr(item, "additional_properties", None) or {}
        if _MCP_TOOL_RESULT_HOST_PAYLOAD_KEY in item_properties:
            values.append(item_properties[_MCP_TOOL_RESULT_HOST_PAYLOAD_KEY])
    return (True, values[-1]) if values else (False, None)


def _model_content_from_mcp_host_payload(payload: Any) -> str:
    """Recover safe content-only text when marked history lacks a valid sidecar."""
    if not isinstance(payload, dict):
        return "Tool result unavailable."
    if payload.get("isError") is True:
        return "Error: Function failed."
    content = payload.get("content")
    if not isinstance(content, list):
        return "Tool result unavailable."

    text_parts: list[str] = []
    for item in content:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "text" and isinstance(item.get("text"), str):
            text_parts.append(item["text"])
            continue
        resource = item.get("resource")
        if item.get("type") == "resource" and isinstance(resource, dict) and isinstance(resource.get("text"), str):
            text_parts.append(resource["text"])
    return "\n".join(text_parts) if text_parts else "null"


def _model_items_for_agui_replay(content: Any, model_result: str) -> list[dict[str, Any]]:
    """Serialize model-facing items without Host-only MCP metadata."""
    items = getattr(content, "items", None)
    if items is None:
        output = getattr(content, "output", None)
        if isinstance(output, list) and all(isinstance(item, Content) for item in output):
            items = output
    if items is None:
        return [{"type": "text", "text": model_result}]

    try:
        serialized_items: list[dict[str, Any]] = []
        for item in items:
            serialized_item = make_json_safe(_sanitize_model_replay_item(item.to_dict()))
            if not isinstance(serialized_item, dict):
                raise TypeError("Serialized model replay item must be a dictionary")
            serialized_items.append(serialized_item)
        return serialized_items
    except (RecursionError, TypeError, ValueError):
        return [{"type": "text", "text": model_result}]


def _sanitize_model_replay_item(item: dict[str, Any]) -> dict[str, Any]:
    """Remove Host-only item metadata without mutating caller-owned replay data."""
    sanitized_item = item.copy()
    additional_properties = item.get("additional_properties")
    if not isinstance(additional_properties, dict):
        return sanitized_item
    sanitized_properties = {
        key: value for key, value in additional_properties.items() if key not in _HOST_ONLY_REPLAY_ITEM_KEYS
    }
    if sanitized_properties:
        sanitized_item["additional_properties"] = sanitized_properties
    else:
        sanitized_item.pop("additional_properties", None)
    return sanitized_item


def _model_text_from_replay_items(message: dict[str, Any]) -> str:
    """Return the text projection used when a Host payload is omitted."""
    serialized_items = message.get(_AGUI_TOOL_RESULT_MODEL_CONTENT_KEY)
    if not isinstance(serialized_items, list):
        return "Tool result unavailable."
    if not serialized_items:
        return ""
    model_text = "\n".join(
        item["text"]
        for item in serialized_items
        if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str)
    )
    return model_text or "Tool result unavailable."


def _host_payload_history_size(message: dict[str, Any]) -> int:
    """Return aggregate bytes retained for one Host projection and replay sidecar."""
    content = message.get(_AGUI_TOOL_RESULT_HOST_PAYLOAD_KEY, message.get("content"))
    serialized_items = message.get(_AGUI_TOOL_RESULT_MODEL_CONTENT_KEY)
    try:
        content_size = len(json.dumps(make_json_safe(content), separators=(",", ":")).encode("utf-8"))
    except (RecursionError, TypeError, ValueError):
        content_size = _MAX_MCP_HOST_PAYLOAD_HISTORY_SIZE_BYTES + 1
    try:
        sidecar_size = (
            len(json.dumps(make_json_safe(serialized_items), separators=(",", ":")).encode("utf-8"))
            if isinstance(serialized_items, list)
            else 0
        )
    except (RecursionError, TypeError, ValueError):
        sidecar_size = _MAX_MCP_HOST_PAYLOAD_HISTORY_SIZE_BYTES + 1
    return content_size + sidecar_size


def _mcp_host_history_fields(host_payload: Any, model_items: list[dict[str, Any]]) -> dict[str, Any]:
    """Build the private fields that preserve one MCP Host result for safe replay."""
    return {
        _AGUI_MCP_TOOL_RESULT_KEY: True,
        _AGUI_TOOL_RESULT_HOST_PAYLOAD_KEY: _stringify_tool_result(host_payload),
        _AGUI_TOOL_RESULT_MODEL_CONTENT_KEY: model_items,
    }


def _persistable_host_payload_history(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep canonical persisted content safe for readers that ignore private replay fields."""
    persisted: list[dict[str, Any]] = []
    for message in messages:
        if message.get(_AGUI_MCP_TOOL_RESULT_KEY) is not True:
            persisted.append(message)
            continue
        persisted_message = message.copy()
        host_payload = message.get(_AGUI_TOOL_RESULT_HOST_PAYLOAD_KEY, message.get("content"))
        persisted_message["content"] = _model_text_from_replay_items(message)
        persisted_message[_AGUI_TOOL_RESULT_HOST_PAYLOAD_KEY] = _stringify_tool_result(host_payload)
        persisted.append(persisted_message)
    return persisted


def _project_host_payload_history(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Project private complete MCP results into AG-UI Host-visible tool content."""
    projected: list[dict[str, Any]] = []
    for message in messages:
        host_payload = message.get(_AGUI_TOOL_RESULT_HOST_PAYLOAD_KEY)
        if message.get(_AGUI_MCP_TOOL_RESULT_KEY) is not True or host_payload is None:
            projected.append(message)
            continue
        projected_message = message.copy()
        projected_message["content"] = _stringify_tool_result(host_payload)
        projected_message.pop(_AGUI_TOOL_RESULT_HOST_PAYLOAD_KEY, None)
        projected.append(projected_message)
    return projected


def _bound_host_payload_history(
    messages: list[dict[str, Any]],
    *,
    max_size_bytes: int | None = None,
) -> list[dict[str, Any]]:
    """Retain the newest Host projections and sidecars within one fixed budget."""
    if max_size_bytes is None:
        max_size_bytes = _MAX_MCP_HOST_PAY
```

### Core Architecture Module: `python/packages/ag-ui/agent_framework_ag_ui_examples/agents/human_in_the_loop_agent.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""Human-in-the-loop agent demonstrating step customization (Feature 5)."""

from enum import Enum
from typing import Any

from agent_framework import Agent, SupportsChatGetResponse, tool
from pydantic import BaseModel, Field


class StepStatus(str, Enum):
    """Status of a task step."""

    ENABLED = "enabled"
    DISABLED = "disabled"


class TaskStep(BaseModel):
    """A single step in a task execution plan."""

    description: str = Field(..., description="The text of the step in imperative form (e.g., 'Dig hole', 'Open door')")
    status: StepStatus = Field(default=StepStatus.ENABLED, description="Whether the step is enabled or disabled")


@tool(
    name="generate_task_steps",
    description="Generate execution steps for a task",
    approval_mode="always_require",
)
def generate_task_steps(steps: list[TaskStep]) -> str:
    """Make up 10 steps (only a couple of words per step) that are required for a task.

    The step should be in imperative form (i.e. Dig hole, Open door, ...).
    Each step will have status='enabled' by default.

    Args:
        steps: An array of 10 step objects, each containing description and status

    Returns:
        Confirmation message
    """
    return f"Generated {len(steps)} execution steps for the task."


def human_in_the_loop_agent(client: SupportsChatGetResponse[Any]) -> Agent[Any]:
    """Create a human-in-the-loop agent using tool-based approach for predictive state.

    Args:
        client: The chat client to use for the agent

    Returns:
        A configured Agent instance with human-in-the-loop capabilities
    """
    return Agent(
        name="human_in_the_loop_agent",
        instructions="""You are a helpful assistant that can perform any task by breaking it down into steps.

    When asked to perform a task, you MUST call the `generate_task_steps` function with the proper
    number of steps per the request.

    Rules for steps:
    - Each step description should be in imperative form (e.g., "Dig hole", "Open door", "Prepare ingredients")
    - Each step should be brief (only a couple of words)
    - All steps must have status='enabled' initially

    Example steps for "Build a robot":
    1. "Design blueprint"
    2. "Gather components"
    3. "Assemble frame"
    4. "Install motors"
    5. "Wire electronics"
    6. "Program controller"
    7. "Test movements"
    8. "Add sensors"
    9. "Calibrate systems"
    10. "Final testing"

    IMPORTANT: When you call generate_task_steps, the user will be shown the steps and asked to approve.
    Do NOT output any text along with the function call - just call the function.
    After the user approves and the function executes, THEN provide a brief acknowledgment like:
    "The plan has been created with X steps selected."
    """,
        client=client,
        tools=[generate_task_steps],
    )

```

### Core Architecture Module: `python/packages/ag-ui/agent_framework_ag_ui_examples/agents/weather_state_agent.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""Deterministic tool-driven AG-UI state example.

This sample demonstrates how a tool can push a *deterministic* state update
to the AG-UI frontend based on its actual return value — in contrast to
``predict_state_config`` which fires optimistically from LLM-predicted tool
call arguments. See issue https://github.com/microsoft/agent-framework/issues/3167.

The :func:`agent_framework_ag_ui.state_update` helper wraps a text result
together with a state snapshot. When a tool returns one of these, the AG-UI
endpoint merges the snapshot into the shared state and emits a
``StateSnapshotEvent`` after the tool result.
"""

from __future__ import annotations

from typing import Any

from agent_framework import Agent, Content, SupportsChatGetResponse, tool
from agent_framework.ag_ui import AgentFrameworkAgent

from agent_framework_ag_ui import state_update

# Simulated weather database — in the issue's motivating example the tool
# would instead call a real weather API.
_WEATHER_DB: dict[str, dict[str, Any]] = {
    "seattle": {"temperature": 11, "conditions": "rainy", "humidity": 75},
    "san francisco": {"temperature": 14, "conditions": "foggy", "humidity": 85},
    "new york city": {"temperature": 18, "conditions": "sunny", "humidity": 60},
    "miami": {"temperature": 29, "conditions": "hot and humid", "humidity": 90},
    "chicago": {"temperature": 9, "conditions": "windy", "humidity": 65},
}


@tool
async def get_weather(location: str) -> Content:
    """Fetch current weather for a location and push it into AG-UI shared state.

    Unlike ``predict_state_config`` — which derives state optimistically from
    LLM-predicted tool call arguments — this tool uses ``state_update`` to
    forward the *actual* fetched weather to the frontend. The ``text`` goes
    back to the LLM as the normal tool result, and the ``state`` dict is merged
    into the AG-UI shared state.

    Args:
        location: City name to look up.

    Returns:
        A :class:`Content` carrying both the LLM-visible text result and a
        deterministic state snapshot.
    """
    key = location.lower()
    data = _WEATHER_DB.get(
        key,
        {"temperature": 21, "conditions": "partly cloudy", "humidity": 50},
    )
    weather_record = {"location": location, **data}
    return state_update(
        text=(
            f"The weather in {location} is {data['conditions']} at "
            f"{data['temperature']}°C with {data['humidity']}% humidity."
        ),
        state={"weather": weather_record},
    )


def weather_state_agent(client: SupportsChatGetResponse[Any]) -> AgentFrameworkAgent:
    """Create an AG-UI agent with a deterministic tool-driven state tool."""
    agent = Agent[Any](
        name="weather_state_agent",
        instructions=(
            "You are a weather assistant. When a user asks about the weather "
            "in a city, call the get_weather tool and use its output to give a "
            "friendly, concise reply. The tool also updates the shared UI state "
            "so the frontend can render a weather card from the `weather` key."
        ),
        client=client,
        tools=[get_weather],
    )

    return AgentFrameworkAgent(
        agent=agent,
        name="WeatherStateAgent",
        description="Weather agent that deterministically updates shared state from tool results.",
        state_schema={
            "weather": {
                "type": "object",
                "description": "Last fetched weather record",
            },
        },
    )

```

### Core Architecture Module: `python/packages/ag-ui/agent_framework_ag_ui_examples/server/api/backend_tool_rendering.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""Backend tool rendering endpoint."""

from typing import Any, cast

from agent_framework._clients import SupportsChatGetResponse
from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint
from agent_framework.openai import OpenAIChatCompletionClient
from fastapi import FastAPI

from ...agents.weather_agent import weather_agent


def register_backend_tool_rendering(app: FastAPI) -> None:
    """Register the backend tool rendering endpoint.

    Args:
        app: The FastAPI application.
    """
    # Create a chat client and call the factory function
    client = cast(SupportsChatGetResponse[Any], OpenAIChatCompletionClient())

    add_agent_framework_fastapi_endpoint(
        app,
        weather_agent(client),
        "/backend_tool_rendering",
    )

```

### Core Architecture Module: `python/packages/core/agent_framework/__init__.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""Public API surface for Agent Framework core.

This module exposes the primary abstractions for agents, chat clients, tools, sessions,
middleware, observability, and workflows. Most public exports are resolved lazily to keep
``import agent_framework`` lightweight; importing a specific symbol still loads the module
that owns that symbol.
"""

from __future__ import annotations

# pyright: reportUnsupportedDunderAll=false
# ruff:file-ignore[undefined-export]
import importlib
import importlib.metadata
from collections.abc import Mapping
from typing import Any, Final

try:
    _version = importlib.metadata.version("agent-framework-core")
except importlib.metadata.PackageNotFoundError:
    _version = "0.0.0"  # Fallback for development mode
__version__: Final[str] = _version

from ._telemetry import (
    AGENT_FRAMEWORK_USER_AGENT,
    APP_INFO,
    USER_AGENT_KEY,
    USER_AGENT_TELEMETRY_DISABLED_ENV_VAR,
    prepend_agent_framework_to_user_agent,
)
from .exceptions import (
    AgentFrameworkException,
    MiddlewareException,
    ResponseInvalidatedException,
    UserInputRequiredException,
    WorkflowCheckpointException,
    WorkflowConvergenceException,
    WorkflowException,
    WorkflowRunnerException,
)

_LAZY_MODULE_EXPORTS: Final[Mapping[str, tuple[str, ...]]] = {
    "._agent_hooks": ("create_agent_hooks_middleware", "create_agent_hooks_middleware_from_emitter"),
    "._agents": ("Agent", "BaseAgent", "RawAgent", "SupportsAgentRun"),
    "._clients": (
        "BaseChatClient",
        "BaseEmbeddingClient",
        "SupportsChatGetResponse",
        "SupportsCodeInterpreterTool",
        "SupportsFileSearchTool",
        "SupportsGetEmbeddings",
        "SupportsImageGenerationTool",
        "SupportsMCPTool",
        "SupportsShellTool",
        "SupportsWebSearchTool",
    ),
    "._compaction": (
        "COMPACTION_STATE_KEY",
        "EXCLUDE_REASON_KEY",
        "EXCLUDED_KEY",
        "GROUP_ANNOTATION_KEY",
        "GROUP_HAS_REASONING_KEY",
        "GROUP_ID_KEY",
        "GROUP_INDEX_KEY",
        "GROUP_KIND_KEY",
        "GROUP_TOKEN_COUNT_KEY",
        "SUMMARIZED_BY_SUMMARY_ID_KEY",
        "SUMMARY_OF_GROUP_IDS_KEY",
        "SUMMARY_OF_MESSAGE_IDS_KEY",
        "CharacterEstimatorTokenizer",
        "CompactionProvider",
        "CompactionStrategy",
        "ContextWindowCompactionStrategy",
        "SelectiveToolCallCompactionStrategy",
        "SlidingWindowStrategy",
        "SummarizationStrategy",
        "TokenBudgetComposedStrategy",
        "TokenizerProtocol",
        "ToolResultCompactionStrategy",
        "TruncationStrategy",
        "annotate_message_groups",
        "apply_compaction",
        "included_messages",
        "included_token_count",
    ),
    "._evaluation": (
        "AgentEvalConverter",
        "CheckResult",
        "ConversationSplit",
        "ConversationSplitter",
        "EvalItem",
        "EvalItemResult",
        "EvalNotPassedError",
        "EvalResults",
        "EvalScoreResult",
        "Evaluator",
        "ExpectedToolCall",
        "LocalEvaluator",
        "RubricScore",
        "evaluate_agent",
        "evaluate_workflow",
        "evaluator",
        "keyword_check",
        "tool_call_args_match",
        "tool_called_check",
        "tool_calls_present",
    ),
    "._feature_stage": ("ExperimentalFeature", "ReleaseCandidateFeature"),
    "._harness._agent": ("DEFAULT_HARNESS_INSTRUCTIONS", "create_harness_agent"),
    "._harness._background_agents": (
        "DEFAULT_BACKGROUND_AGENTS_SOURCE_ID",
        "BackgroundAgentsProvider",
        "BackgroundTaskInfo",
        "BackgroundTaskStatus",
    ),
    "._harness._file_access": (
        "DEFAULT_FILE_ACCESS_INSTRUCTIONS",
        "DEFAULT_FILE_ACCESS_SOURCE_ID",
        "AgentFileStore",
        "FileAccessProvider",
        "FileSearchMatch",
        "FileSearchResult",
        "FileStoreEntry",
        "FileSystemAgentFileStore",
        "InMemoryAgentFileStore",
    ),
    "._harness._file_memory": (
        "DEFAULT_FILE_MEMORY_INSTRUCTIONS",
        "DEFAULT_FILE_MEMORY_SOURCE_ID",
        "FileMemoryProvider",
    ),
    "._harness._loop": (
        "AgentLoopMiddleware",
        "JudgeVerdict",
        "background_tasks_running",
        "background_tasks_running_message",
        "todos_remaining",
        "todos_remaining_message",
    ),
    "._harness._memory": (
        "DEFAULT_MEMORY_SOURCE_ID",
        "MemoryContextProvider",
        "MemoryFileStore",
        "MemoryIndexEntry",
        "MemoryStore",
        "MemoryTopicRecord",
    ),
    "._harness._mode": ("DEFAULT_MODE_SOURCE_ID", "AgentModeProvider", "get_agent_mode", "set_agent_mode"),
    "._harness._todo": (
        "DEFAULT_TODO_SOURCE_ID",
        "TodoFileStore",
        "TodoItem",
        "TodoProvider",
        "TodoSessionStore",
        "TodoStore",
    ),
    "._harness._tool_approval": (
        "DEFAULT_TOOL_APPROVAL_SOURCE_ID",
        "ToolApprovalMiddleware",
        "ToolApprovalRule",
        "ToolApprovalRuleCallback",
        "ToolApprovalState",
        "create_always_approve_tool_response",
        "create_always_approve_tool_with_arguments_response",
    ),
    "._mcp": (
        "MCPStdioTool",
        "MCPStreamableHTTPTool",
        "MCPTaskOptions",
        "MCPWebsocketTool",
        "SamplingApprovalCallback",
    ),
    "._middleware": (
        "AgentContext",
        "AgentMiddleware",
        "AgentMiddlewareLayer",
        "AgentMiddlewareTypes",
        "ChatAndFunctionMiddlewareTypes",
        "ChatContext",
        "ChatMiddleware",
        "ChatMiddlewareLayer",
        "ChatMiddlewareTypes",
        "FunctionInvocationContext",
        "FunctionMiddleware",
        "FunctionMiddlewareTypes",
        "MiddlewareBundle",
        "MiddlewareFailure",
        "MiddlewareTermination",
        "MiddlewareType",
        "MiddlewareTypes",
        "agent_middleware",
        "chat_middleware",
        "function_middleware",
    ),
    "._sessions": (
        "AgentSession",
        "ContextProvider",
        "FileHistoryProvider",
        "FileSessionStore",
        "HistoryProvider",
        "InMemoryHistoryProvider",
        "MESSAGE_INJECTION_PENDING_MESSAGES_STATE_KEY",
        "MessageInjectionMiddleware",
        "ServiceSessionId",
        "SessionStore",
        "SessionContext",
        "enqueue_messages",
        "register_state_type",
    ),
    "._settings": ("SecretString", "load_settings"),
    "._skills": (
        "AggregatingSkillsSource",
        "CachingSkillsSource",
        "ClassSkill",
        "DeduplicatingSkillsSource",
        "DelegatingSkillsSource",
        "FileSkill",
        "FileSkillScript",
        "FileSkillsSource",
        "FilteringSkillsSource",
        "InlineSkill",
        "InlineSkillResource",
        "InlineSkillScript",
        "InMemorySkillsSource",
        "MCPSkill",
        "MCPSkillResource",
        "MCPSkillsSource",
        "Skill",
        "SkillFrontmatter",
        "SkillResource",
        "SkillScript",
        "SkillScriptArgumentParser",
        "SkillScriptRunner",
        "SkillsProvider",
        "SkillsSource",
        "SkillsSourceContext",
    ),
    "._tools": (
        "SKIP_PARSING",
        "FunctionInvocationConfiguration",
        "FunctionInvocationLayer",
        "FunctionTool",
        "ToolTypes",
        "normalize_function_invocation_configuration",
        "tool",
    ),
    "._types": (
        "AgentResponse",
        "AgentResponseUpdate",
        "AgentRunInputs",
        "Annotation",
        "ChatOptions",
        "ChatResponse",
        "ChatResponseUpdate",
        "ComputerSafetyCheck",
        "Content",
        "ContinuationToken",
        "Embedding",
        "EmbeddingGenerationOptions",
        "EmbeddingInputT",
        "EmbeddingT",
        "FinalT",
        "FinishReason",
        "FinishReasonLiteral",
        "GeneratedEmbeddings",
        "Message",
        "OuterFinalT",
        "OuterUpdateT",
        "ResponseStream",
        "Role",
        "RoleLiteral",
        "TextSpanRegion",
        "ToolMode",
        "UpdateT",
        "UsageDetails",
        "add_usage_details",
        "detect_media_type_from_base64",
        "map_chat_to_agent_update",
        "merge_chat_options",
        "normalize_messages",
        "normalize_tools",
        "prepend_instructions_to_messages",
        "validate_chat_options",
        "validate_tool_mode",
        "validate_tools",
    ),
    "._in_memory": (
        "InMemoryCollection",
        "InMemoryStore",
    ),
    "._vector_filters": (
        "Filter",
        "FilterGroup",
        "FilterGroupOperator",
        "FilterOperator",
        "Param",
    ),
    "._vectors": (
        "DISTANCE_FUNCTION_DIRECTION_HELPER",
        "BaseVectorCollection",
        "BaseVectorSearch",
        "BaseVectorStore",
        "DistanceFunction",
        "FieldTypes",
        "GenerateVectors",
        "IndexKind",
        "SearchResponse",
        "SearchResults",
        "SearchType",
        "SupportsVectorSearch",
        "SupportsVectorUpsert",
        "VectorCollectionContextProvider",
        "VectorStoreCollectionDefinition",
        "VectorStoreField",
        "VectorStoreHistoryProvider",
        "create_delete_tool",
        "create_get_tool",
        "create_upsert_tool",
        "create_vector_search_tool",
        "register_vectorstoremodel",
        "vectorstoremodel",
    ),
    "._workflows._agent": ("WorkflowAgent",),
    "._workflows._agent_executor": (
        "AgentExecutor",
        "AgentExecutorCheckpointState",
        "AgentExecutorRequest",
        "AgentExecutorResponse",
    ),
    "._workflows._agent_utils": ("resolve_agent_id",),
    "._workflows._checkpoint": (
        "CheckpointID",
        "CheckpointStorage",
        "FileCheckpointStorage",
        "InMemoryCheckpointStorage",
        "WorkflowCheckpoint",
    ),
    "._workflows._checkpoint_encoding": ("re
```

### Core Architecture Module: `python/packages/core/agent_framework/_agent_hooks.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""AGENT-HOOKS-0.1 enforcement middleware for Agent Framework (experimental).

This module implements the `agent-hooks <https://github.com/responsibleai/agent-hooks>`_
control contract as one coherent feature on the framework's native middleware seams:

- ``agent_startup`` / ``input`` / ``output`` / ``agent_shutdown`` ride the agent seam,
- ``pre_model_call`` / ``post_model_call`` ride the chat seam,
- ``pre_tool_call`` / ``post_tool_call`` ride the function seam.

The public entry points are :func:`create_agent_hooks_middleware` (one agent-hooks
session per run) and :func:`create_agent_hooks_middleware_from_emitter` (host-owned
session). Both return a :class:`~agent_framework.MiddlewareBundle`: the three middleware
implementations are deliberately private and travel as one indivisible unit, because
installing only part of them would enforce only part of the control contract. Install
exactly one bundle per agent, placed first in the middleware list: middleware listed
before the bundle runs outside the enforcement boundary (outer position is outer trust)
— e.g. a function middleware placed before the bundle can substitute a tool result that
the tool seam never brackets; the final ``output`` point still guards whatever egresses.

Enforcement semantics (``mode="enforce"``):

- Every interception point is emitted **before** the guarded action runs (pre points) or
  before its result is incorporated (post points). Emission failures inside the SDK
  (interceptor crash/timeout, invalid context) synthesize ``host_error:*`` denies and are
  treated as blocks — the feature never fails open.
- ``transform`` verdicts are written back into the native middleware contexts
  (``messages`` / ``arguments`` / ``results``) through per-point codecs, so the framework
  executes exactly the value the interceptors approved. Content objects are preserved:
  rich (non-text) message content is projected as content dictionaries, never flattened
  to text.
- A ``deny`` at ``input``, ``pre_model_call``, ``post_model_call``, or ``output``
  terminates the run: :class:`agent_hooks.InterceptionBlocked` propagates to the caller
  of :meth:`Agent.run` (for streaming runs, it is raised when the stream is consumed).
- A ``deny`` at ``pre_tool_call`` / ``post_tool_call`` blocks the tool call: the tool is
  not executed (or its result is discarded) and a tool-error payload is surfaced to the
  model so the agent loop can continue, per the spec's block-propagation rules. A
  ``host_error:*`` deny at the tool seam additionally halts the run (the enforcement
  layer itself failed, so continuing would be unreliable): the run is aborted through
  the function-invocation loop's fail-closed escape
  (:class:`~agent_framework.MiddlewareFailure`) and the
  :class:`agent_hooks.InterceptionBlocked` propagates to the caller, exactly like a
  run-level deny. Other unexpected failures inside the enforcement layer (projection
  bug, emitter fault) abort the run the same way and surface as
  :class:`~agent_framework.MiddlewareFailure`.
- Framework middleware short-circuits (``MiddlewareTermination``) are guarded: a result
  substituted by another middleware still passes ``output`` / ``post_model_call`` /
  ``post_tool_call`` before it egresses or enters the transcript.
- Durable history persistence is gated behind the verdicts: run-end context-provider
  persistence and per-service-call history persistence are deferred (via the run
  persistence gate in ``_sessions.py``) until the ``output`` / ``post_model_call``
  emission permits the content, so denied content never becomes durable and transformed
  content is persisted post-transform. Each persist is gated by its own covering
  verdict: per-service-call history persisted under a permitted ``post_model_call``
  verdict remains durable even if the run's ``output`` is later denied. A mid-run deny
  is conservative in the other direction: the dropped per-service-call persist carries
  that service call's request messages too, so the denied turn's input is not
  persisted either. Only the gated run's own persistence defers: nested and
  middleware-initiated agent runs (sub-agents invoked as tools, agents run by other
  middleware or context providers, even on a shared session) persist inline at their
  own run boundaries — the gate is bound to its run's identity (see the run
  persistence gate in ``_sessions.py``), and the function-invocation layer
  additionally suspends the gate around tool invocations to cover nested agents with
  fully custom run loops. An outer deny therefore never discards fully-permitted
  inner history, and a second sub-agent call within one outer run reads fresh
  history. Residual limitation: an agent whose run loop never stamps a run identity
  (a fully custom ``run()`` implementation) that itself nests another such agent
  outside the tool seam falls back to deferring both — fail-closed, matching the
  pre-ownership behavior.

Streaming is supported **fail-closed by buffering**: the model/agent stream is fully
consumed internally, middleware stream hooks are applied to the buffered content, the
``post_model_call`` / ``output`` verdict is applied to the finalized result, and only
then are the (possibly transformed) updates released to the consumer. No partial content
ever egresses ahead of a verdict (spec §12.1/§12.1a ``buffered_output: true``
behaviour), and nothing can rewrite content past the gate.

Known limitation — service-side (hosted) tool execution: tools executed by the model
provider itself (surfaced as informational-only function calls, e.g. hosted MCP or
web-search tools) never pass through the framework's function-invocation seam, so
``pre_tool_call`` / ``post_tool_call`` cannot intercept them. Their calls and outputs
are surfaced faithfully in the ``post_model_call`` content projection (they are part of
the model response), where interceptors can observe and deny/transform the response
that carries them.

Session scoping: by default each agent run is one agent-hooks session (fresh emitter and
sequence, ``agent_startup``/``agent_shutdown`` bracket the run). A host that owns a
longer-lived session constructs its own emitter and builder and installs them via
:func:`create_agent_hooks_middleware_from_emitter`; the middleware then emits only the
per-run points and the host owns the session boundaries.

The ``agent-hooks-sdk`` dependency is optional: importing this module (and the lazy root
exports) works without it, and the factories raise a descriptive ``ModuleNotFoundError``
when the SDK is missing. Install it via ``pip install agent-hooks-sdk``.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import uuid
from collections.abc import AsyncGenerator, Awaitable, Callable, Mapping, Sequence
from contextvars import ContextVar
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, NoReturn, cast

from pydantic import BaseModel

from ._feature_stage import ExperimentalFeature, experimental
from ._middleware import (
    AgentContext,
    AgentMiddleware,
    ChatContext,
    ChatMiddleware,
    FunctionInvocationContext,
    FunctionMiddleware,
    MiddlewareBundle,
    MiddlewareFailure,
    MiddlewareTermination,
)
from ._serialization import make_json_safe
from ._sessions import (
    _current_run_identity,  # pyright: ignore[reportPrivateUsage]
    _RunPersistenceGate,  # pyright: ignore[reportPrivateUsage]
)
from ._telemetry import FeatureIndex, mark_feature_used
from ._types import (
    AgentResponse,
    AgentResponseUpdate,
    ChatResponse,
    ChatResponseUpdate,
    Content,
    Message,
    ResponseStream,
)
from .exceptions import MiddlewareException

if TYPE_CHECKING:
    from agent_hooks import (
        AgentContextBuilder,
        ApprovalResolver,
        CompositionConfig,
        EmitOutcome,
        EnforcementMode,
        IdentityProvider,
        InterceptionBlocked,
        InterceptionEmitter,
        InterceptionRecord,
        Interceptor,
    )

logger = logging.getLogger(__name__)

_FRAMEWORK_NAME = "agent-framework"
_HOST_ERROR_PREFIX = "host_error:"
_JCS_SHA256 = "jcs-sha256"
_DEFAULT_TIMEOUT = 5.0

_SDK_MISSING_MESSAGE = (
    "The agent-hooks middleware requires the optional `agent-hooks-sdk` package. "
    "Please install it with `pip install agent-hooks-sdk`."
)

_TRIO_REQUIRED_MESSAGE = (
    "agent-hooks {seam} middleware was invoked without an active agent-hooks run. "
    "The middleware bundle returned by create_agent_hooks_middleware() must be installed "
    "as one unit on an Agent, e.g. Agent(client=..., middleware=[create_agent_hooks_middleware([...])])."
)

_FOREIGN_TRIO_MESSAGE = (
    "agent-hooks {seam} middleware found an active agent-hooks run owned by a different "
    "agent-hooks middleware bundle. Stacking multiple bundles on one agent (or splitting "
    "bundles across agent- and client-level middleware) is not supported: emissions would "
    "silently bind to the wrong emitter. Install exactly one bundle per agent."
)


class _AgentHooksWriteBackError(MiddlewareException):
    """A transform verdict could not be converted back into the native context.

    Raised (and deliberately never caught by this module) so an unappliable transform
    fails the run closed instead of silently proceeding with the untransformed value.
    """


def _require_sdk() -> None:
    """Import the SDK surface this module uses at runtime, with a helpful install hint.

    Only a genuinely missing ``agent_hooks`` package is translated into the
    SDK installation message; anything else (a broken installation, an incompatible
    SDK version missing symbols, a failing transitive import) propagates unchanged so
    real breakage is not masked as a missing extra.
    """
    try:
        from agent_hooks import (
            AgentContextBuilder,
            EnforcementMode,
            InterceptionBlocked,
            Interception
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8386** (2026-09-16): **Python: Fix ambiguous MCP configuration name matching**
  *Symptoms*: ### Motivation & Context  <!-- Thank you for your contribution to the Agent Framework repo! Please help reviewers and future users, providing the following information:   1. Why is this change required?   2. What problem does it solve?   3. What scenario does it contribute to?   4. If it fixes an open issue, please link to the issue below. -->  Fix MCP allowlist and approval name matching so each configured name identifies at most one raw remote tool. Preserve existing support for unambiguous prefixed names and keep discovery updates consistent across pagination and refresh.  ### Description & Review Guide  <!-- Describe your changes, the overall approach, the underlying design.      Highlight what you want the reviewers to focus on.      These notes will help understanding how your code works. Thanks! -->  - **What are the major changes?** Add shared validation for configured allowlist and approval names. Stage tool and prompt discovery across all pages before publishing new functions. Revalidate configuration when exposing functions, including progressive discovery. Add regression coverage for ordering, pagination, refresh, approval modes, and compatibility. - **What is the impact of these changes?** Configuration names that match multiple raw remote names now raise `ToolExecutionException`. Applications using those names must select an unambiguous name or a different `tool_name_prefix`. Raw names, unambiguous prefixed aliases, normalized-only approval nonmatching, and empt

- **Issue #8057** (2026-09-07): **Python: [Bug]: lab lightning tests hard-fail on fastapi 0.141 (litellm proxy imports removed get_flat_dependant)**
  *Symptoms*: ### Description  `Python - Lab Tests` fails on every PR since fastapi was raised to 0.141. The failing step is `Run resource-intensive lab tests`:  ``` cd packages/lab && uv run pytest -m "resource_intensive and not integration" ```  ``` FAILED lightning/tests/test_lightning.py::test_observability - ImportError: cannot import name 'get_flat_dependant' from 'fastapi.dependencies.utils' ```  This is not specific to any one PR — it reproduces on the merge-queue run for an unrelated ag-ui change and on other open PRs.  **Two things combine to produce the failure.**  **1. fastapi 0.141 no longer exposes `get_flat_dependant`, and litellm's proxy imports it.** The import chain from the test is:  ``` pytest.importorskip("agentlightning")   -> agentlightning/__init__.py:13   from .llm_proxy import *   -> agentlightning/llm_proxy.py:41  from litellm.proxy.proxy_server import app, save_worker_config   -> litellm/proxy/proxy_server.py:397   -> litellm/proxy/management_endpoints/management_v1/common.py:6        from fastapi.dependencies.utils import get_flat_dependant   # ImportError ```  Resolved versions in `python/uv.lock`: fastapi `0.141.1`, litellm `1.95.0`, agentlightning `0.3.0`.  #8052 raised the bound to `fastapi>=0.121.0,<0.142.0`, which allows 0.141. That was the right fix for #8042 (the previous `<0.140.0` cap excluded every current release); the lab package's transitive `litellm[proxy]` just is not compatible with 0.141 yet.  **2. The `importorskip` guard no longer skips, so 
  **Post-Mortem & Fix Analysis**:
  > I checked the current `lightning` observability test and confirmed that its optional `agentlightning` import can propagate nested `ImportError` exceptions from the LiteLLM/FastAPI proxy dependency chain. I’m going to make the guard skip on `ImportError` (not only `ModuleNotFoundError`), preserving the test’s optional nature while keeping the existing observability assertions unchanged, and will add focused verification for the guard behavior.

- **Issue #7403** (2026-08-11): **Python: ClaudeAgent reuses one SDK client across distinct fresh sessions, leaking conversation state**
  *Symptoms*: ## Summary  `RawClaudeAgent` keeps a single mutable `ClaudeSDKClient` on the agent instance and reuses it across distinct `AgentSession` objects when both sessions have not yet been bound to a provider conversation. As a result, two independent fresh sessions run against the same shared agent instance end up sharing one provider conversation, so the second session continues the first session's conversation instead of starting its own.  This is a session-continuity/isolation bug in the client lifecycle logic. It shows up whenever one long-lived `ClaudeAgent` instance is shared across multiple logical sessions (for example, a single hosted agent serving multiple sessions).  ## Affected component  - Package: `agent-framework-claude` - File: `python/packages/claude/agent_framework_claude/_agent.py` - Method: `RawClaudeAgent._ensure_session()`  ## Root cause  `_get_stream()` resolves the provider continuation id from the session and passes it to `_ensure_session()`:  ```python # python/packages/claude/agent_framework_claude/_agent.py session = session or self.create_session() await self._ensure_session(self._get_chat_conversation_id(session)) ```  For a fresh session, `service_session_id` is `None`, so `_get_chat_conversation_id()` returns `None`.  The reuse decision in `_ensure_session()` is:  ```python needs_new_client = (     not self._started or self._client is None or (session_id and session_id != self._current_session_id) ) ```  Walking two in

- **Issue #6683** (2026-06-24): **.NET: AgentFileSkillsSource.SearchDirectoriesForSkills should stop recursing after finding SKILL.md**
  *Symptoms*: When `SearchDirectoriesForSkills` finds a `SKILL.md` in a directory, it adds the directory as a skill but continues recursing into subdirectories. This incorrectly treats subdirectories beneath a skill boundary as independent skill roots.  **Fix:** After adding a directory that contains `SKILL.md`, `return` instead of continuing to recurse into children. One-line fix, no impact on the standard flat layout.

- **Issue #6682** (2026-07-01): **Python: Skill directory search should stop recursing after finding SKILL.md**
  *Symptoms*: The skill directory search logic should treat everything beneath a skill boundary (a directory containing `SKILL.md`) as that skill's content rather than independent skill roots.  **Fix:** When the search finds a `SKILL.md` in a directory, stop recursing into that directory's subdirectories. One-line fix, no impact on the standard flat layout.  Community PR to address this issue: https://github.com/microsoft/agent-framework/pull/6685
  **Post-Mortem & Fix Analysis**:
  > I will work on this and add a regression test covering nested skill boundaries.

- **Issue #6568** (2026-06-19): **.NET: [Bug]: unable properly reuse workflow which inludes Groupchat as an executor**
  *Symptoms*: ### Description  in the purpose of reusing workflow in pool of workflows rather then creating new one per each request I added to all executors implementations and marking with IResettableExecutor interface.  My workflow design as an executor includes Group Chat, which I created using [corresponded builder](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/group-chat?pivots=programming-language-csharp)  Testing this approach in concurrent environment showed signs that threads received previously used workflows stumbling on group chat executor and not going after that.  This behavior is not reproducible in the same code and test: 1) When workflow used first time 2) When I'm switching from re-usability of the workflows from the pool to building workflow for each request  I didn't finds any option to turn on "resettable" behavior for the group chat workflow, turned into executor, so considering that behavior as a bug.  Group chat consist with two members  ### Code Sample  ```markdown  ```  ### Error Messages / Stack Traces  ```markdown stucked execution of the workflows in case of reuse with group chat in it ```  ### Package Versions  Microsoft.Agents.AI.Workflows, Microsoft.Extensions.AI, Microsoft.Agents.AI  ### .NET Version  .Net 10.0  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > 👋 Hi @dsslight — thanks for the report!  Your issue describes 'stuck execution' when reusing a workflow with a GroupChat executor from a pool, but you haven't provided a code sample, specific package version numbers, or a stack trace. We wrote tests covering the exact pattern you describe (GroupChat as subworkflow executor in a parent workflow with IResettableExecutor-marked shared executors, reused sequentially) and they pass on the current v1.10.0 codebase. To investigate further we would need: (1) a minimal reproduction snippet showing how you build and pool the workflow, (2) the exact NuGet package versions from your project, and (3) whether you are properly disposing Run/StreamingRun objects (via 'await using') before returning workflows to the pool.  Once you can share the details above, we'll take another look. 🙏  <!-- devflow-triage --> 
  > seems like issue reproducible on lib version 1.7 and not visible on latest 1.10. Closing as of now.

- **Issue #6495** (2026-06-12): **Python: [Bug]: ChatMessage NOT available in agent_framework v1.8.1**
  *Symptoms*: ### Description  **Title:** Missing `ChatMessage` type makes `BaseChatClient` integration with `Agent` unclear  **Description:**  I’m implementing a custom LLM client by subclassing `BaseChatClient` in `agent_framework`, with the goal of integrating it cleanly with the `Agent` abstraction.  I’ve successfully implemented both required methods:  * `_inner_get_response` * `_inner_get_streaming_response`  However, I’ve run into an integration issue when attempting to use the client through `Agent`.  ### Problem  The framework appears to rely on a structured message type (commonly referred to as `ChatMessage` in examples or inferred from internal usage). However:  * `ChatMessage` is not exposed or importable from `agent_framework` * The `Agent` seems to expect a structured message object rather than plain dictionaries or strings * As a result, there is ambiguity in how `BaseChatClient` implementations should represent and return messages in a way that is fully compatible with `Agent`  ### Impact  Without a clearly defined or exported `ChatMessage` type (or equivalent interface/schema):  * Custom client implementations require guesswork or reverse engineering of expected message formats * Integration with `Agent` becomes fragile and inconsistent across providers * It is unclear what the canonical message contract between `Agent` and `BaseChatClient` should be  ### Expected behavior  Ideally, the framework should provide the following:  * A public `ChatMessage` type (or equivalent s
  **Post-Mortem & Fix Analysis**:
  > Can you please let us know where you're seeing the `ChatMessage` import coming from? It was renamed from `ChatMessage` -> `Message` on February 11, 2026: https://learn.microsoft.com/en-us/agent-framework/support/upgrade/python-2026-significant-changes#-chatagent-renamed-to-agent-chatmessage-renamed-to-message
  > This is a non-issue, please import the proper types, per our samples and docs. If you find any references in **current** docs/samples that point to `ChatMessage` please let us know, and we'll fix them.

- **Issue #6440** (2026-06-10): **[spam-gate-test:20260610T023335Z:benign-low-context-control] Question about generated repro test**
  *Symptoms*: ### Description  I am not sure whether the generated repro test should include the workflow transition or only object construction.  CANARY_BENIGN_LOW_CONTEXT_CONTROL  --- Test metadata: - spam_gate_run_id: `20260610T023335Z` - spam_gate_variant: `benign-low-context-control` - expected_gate_decision: `hold_or_allow` - requested_labels: `bug` 

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

### Incident Patch 1: `b9d24c8f` (2026-10-05)
**Commit Message**: .NET: test: add loopback destination regression coverage (#9064)

* test: add loopback destination regression coverage

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: 54f4d58e-e4a4-47fc-8f99-e3f0dc6c9bf9

* chore: Enhance exception handling in unit test

Capture exception and verify message for loopback.

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

* test: centralize raw HTTP server timeout

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: df5fef53-8835-4885-8d2c-3aeb115bf1c5

* test: validate rejected request destinations

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: df5fef53-8835-4885-8d2c-3aeb115bf1c5

---------

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>
Copilot-Session: 54f4d58e-e4a4-47fc-8f99-e3f0dc6c9bf9
Copilot-Session: df5fef53-8835-4885-8d2c-3aeb115bf1c5

**File**: `dotnet/tests/Microsoft.Agents.AI.Workflows.Declarative.UnitTests/DefaultHttpRequestHandlerTests.cs` (modified, +28/-1)
```diff
@@ -139,6 +139,30 @@ public async Task SendAsyncWithEmptyMethodThrowsAsync()
         await Assert.ThrowsAsync<ArgumentException>(actAsync);
     }
 
+    [Fact]
+    public async Task SendAsyncWithRejectedLoopbackDestinationDoesNotSendAsync()
+    {
+        // Arrange
+        CancellationToken cancellationToken = TestContext.Current.CancellationToken;
+        await using RawHttpServer server = new();
+        await using DefaultHttpRequestHandler handler = new((requestInfo, _) =>
+        {
+            Assert.Equal(server.Url, requestInfo.Url);
+            return Task.FromException<HttpClient?>(
+                new ArgumentException("Loopback destinations are not allowed.", nameof(requestInfo)));
+        });
+        HttpRequestInfo request = new() { Method = "GET", Url = server.Url };
+
+        // Act
+        async Task actAsync() => await handler.SendAsync(request, cancellationToken);
+
+        // Assert
+        ArgumentException exception = await Assert.ThrowsAsync<ArgumentException>(actAsync);
+        Assert.Equal("requestInfo", exception.ParamName);
+        Assert.Contains("loopback", exception.Message, StringComparison.OrdinalIgnoreCase);
+        Assert.Null(await server.TryReadRequestAsync());
+    }
+
     #endregion
 
     #region Send Behavior Tests
@@ -279,7 +303,7 @@ public async Task SendAsyncRejectsHeaderValuesContainingCrlfBeforeSendingAsync()
 
         // Act
         Exception? exception = await Record.ExceptionAsync(() => handler.SendAsync(request, cancellationToken));
-        string? rawRequest = await server.TryReadRequestAsync(TimeSpan.FromMilliseconds(500));
+        string? rawRequest = await server.TryReadRequestAsync();
 
         // Assert
         Assert.Null(rawRequest);
@@ -1370,6 +1394,9 @@ public RawHttpServer()
 
         public string Url { get; }
 
+        public Task<string?> TryReadRequestAsync() =>
+            this.TryReadRequestAsync(TimeSpan.FromMilliseconds(500));
+
         public async Task<string?> TryReadRequestAsync(TimeSpan timeout)
         {
             Task completedTask = await Task.WhenAny(this._rawRequestTask, Task.Delay(timeout)).ConfigureAwait(false);
```

---

### Incident Patch 2: `ccf44d95` (2026-10-05)
**Commit Message**: build(deps): bump the codeql-actions group across 1 directory with 3 updates (#9037)

Bumps the codeql-actions group with 3 updates in the / directory: [github/codeql-action/init](https://github.com/github/codeql-action), [github/codeql-action/autobuild](https://github.com/github/codeql-action) and [github/codeql-action/analyze](https://github.com/github/codeql-action).


Updates `github/codeql-action/init` from 4.38.1 to 4.38.2
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/1c5b675653bb5c22dbe9b12b556ec555138e09fd...2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2)

Updates `github/codeql-action/autobuild` from 4.38.1 to 4.38.2
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/1c5b675653bb5c22dbe9b12b556ec555138e09fd...2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2)

Updates `github/codeql-action/analyze` from 4.38.1 to 4.38.2
- [Release notes](https://github.com/github/codeql-action/r

**File**: `.github/workflows/codeql-analysis.yml` (modified, +3/-3)
```diff
@@ -38,7 +38,7 @@ jobs:
 
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/init@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           languages: ${{ matrix.language }}
           # If you wish to specify custom queries, you can do so here or in a config file.
@@ -51,7 +51,7 @@ jobs:
       # Autobuild attempts to build any compiled languages  (C/C++, C#, Go, or Java).
       # If this step fails, then you should remove it and run the build manually (see below)
       - name: Autobuild
-        uses: github/codeql-action/autobuild@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/autobuild@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
 
       # ℹ️ Command-line programs to run using the OS shell.
       # 📚 See https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsrun
@@ -64,6 +64,6 @@ jobs:
       #     ./location_of_script_within_repo/buildscript.sh
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/analyze@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           category: "/language:${{matrix.language}}"
```

---

### Incident Patch 3: `5bba4cec` (2026-10-05)
**Commit Message**: build(deps): bump astral-sh/setup-uv in /.github/actions/python-setup (#9039)

Bumps [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv) from 10.1.0 to 10.2.0.
- [Release notes](https://github.com/astral-sh/setup-uv/releases)
- [Commits](https://github.com/astral-sh/setup-uv/compare/bec219d24cd3e171d82865faccec33120bb574f4...c18668ad3cf93ea998bef934396af7bb5c839dc7)

---
updated-dependencies:
- dependency-name: astral-sh/setup-uv
  dependency-version: 10.2.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/actions/python-setup/action.yml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ runs:
     using: "composite"
     steps:
       - name: Set up uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
             version-file: "python/pyproject.toml"
             enable-cache: true
```

---

### Incident Patch 4: `2606b1a0` (2026-10-05)
**Commit Message**: build(deps): bump astral-sh/setup-uv from 10.1.0 to 10.2.0 (#9038)

Bumps [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv) from 10.1.0 to 10.2.0.
- [Release notes](https://github.com/astral-sh/setup-uv/releases)
- [Commits](https://github.com/astral-sh/setup-uv/compare/bec219d24cd3e171d82865faccec33120bb574f4...c18668ad3cf93ea998bef934396af7bb5c839dc7)

---
updated-dependencies:
- dependency-name: astral-sh/setup-uv
  dependency-version: 10.2.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/devflow-fix-ci.yml` (modified, +3/-3)
```diff
@@ -146,7 +146,7 @@ jobs:
         with:
           python-version: '3.13'
       - if: ${{ steps.team.outputs.permitted == 'true' }}
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           version: '0.11.x'
           enable-cache: false
@@ -229,7 +229,7 @@ jobs:
       - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
         with:
           python-version: '3.13'
-      - uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+      - uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           version: '0.11.x'
           enable-cache: false
@@ -405,7 +405,7 @@ jobs:
       - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
         with:
           python-version: '3.13'
-      - uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+      - uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           version: '0.11.x'
           enable-cache: false
```

**File**: `.github/workflows/devflow-pr-review.yml` (modified, +1/-1)
```diff
@@ -246,7 +246,7 @@ jobs:
           python-version: "3.13"
 
       - name: Set up uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           version: "0.11.x"
           enable-cache: auto
```

**File**: `.github/workflows/github-automation-tests.yml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ jobs:
         with:
           python-version: "3.11"
 
-      - uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+      - uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           version: "0.12.9"
 
```

**File**: `.github/workflows/issue-triage.yml` (modified, +1/-1)
```diff
@@ -190,7 +190,7 @@ jobs:
           python-version: "3.13"
 
       - name: Set up uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           version: "0.11.x"
           enable-cache: true
```

**File**: `.github/workflows/python-api-compatibility.yml` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ jobs:
           persist-credentials: false
 
       - name: Set up uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           enable-cache: false
           version: "0.12.9"
```

**File**: `.github/workflows/python-docs.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       - name: Set up uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           version-file: "python/pyproject.toml"
           enable-cache: auto
```

**File**: `.github/workflows/python-lab-tests.yml` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
       - name: Set up uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           version-file: "python/packages/lab/pyproject.toml"
           python-version: ${{ matrix.python-version }}
```

**File**: `.github/workflows/python-tests.yml` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ jobs:
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       - name: Set up uv
-        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7 # v10.2.0
         with:
           version-file: "python/pyproject.toml"
           enable-cache: true
```

---

### Incident Patch 5: `d7ef9e24` (2026-10-05)
**Commit Message**: Python: [Feature] Allow tools to declare standing guidance appended to results (#8784)

* feat(security): allow tools to declare standing guidance appended to result

* fix copilot comments

* freeze standing_guidance at first access, remove per-invocation deepcopy

* fix: prevent standing_guidance cache leak across tool lifetimes

* fix failed ci pyupgrade hook

**File**: `python/packages/core/agent_framework/security.py` (modified, +125/-5)
```diff
@@ -30,6 +30,7 @@
 from datetime import datetime, timedelta
 from enum import Enum
 from typing import TYPE_CHECKING, Annotated, Any, NoReturn, cast
+from weakref import WeakKeyDictionary
 
 from pydantic import BaseModel, Field
 
@@ -1314,6 +1315,12 @@ class LabelTrackingFunctionMiddleware(FunctionMiddleware, _SecurityScopeBinding)
     - (not set): Inherits integrity from resolved, owned variable references, or uses
       default_integrity (UNTRUSTED by default). Argument labels may only restrict this baseline.
 
+    Tools may also declare additional_properties["standing_guidance"]: list[str] —
+    sentences the middleware appends to the result as trusted Content, explaining
+    what a hidden or labeled result means. Declared at the tool level, so it cannot
+    vary with arguments or runtime data; the tool body never sees or returns it.
+
+
     This middleware:
     1. Extracts labels from tool input arguments (tier 3 input)
     2. Checks tool's source_integrity declaration (tier 2)
@@ -1323,6 +1330,9 @@ class LabelTrackingFunctionMiddleware(FunctionMiddleware, _SecurityScopeBinding)
     6. Accepts complete labels only from identity-stamped framework producers
     7. Maintains confidentiality labels based on tool declarations
     8. Automatically hides untrusted content using variable indirection
+    9. Appends a tool's declared standing_guidance as framework-stamped, trusted
+       Content — fixed at declaration time, never produced by the tool body.
+
 
     Attributes:
         default_integrity: Default integrity for tools without source_integrity declaration.
@@ -1368,6 +1378,7 @@ def __init__(
         self.default_confidentiality = default_confidentiality
         self.auto_hide_untrusted = auto_hide_untrusted
         self.hide_threshold = hide_threshold
+        self._standing_guidance_cache: WeakKeyDictionary[Any, tuple[str, ...]] = WeakKeyDictionary()
         self._initialize_security_scope(security_scope, session_state_key=session_state_key)
 
     def _clone_for_scope(self, scope: _SecurityScope) -> LabelTrackingFunctionMiddleware:
@@ -1898,6 +1909,7 @@ async def process(
             input_labels = self._get_input_labels(context)
             declared_source_integrity = self._get_source_integrity(context)
             confidentiality = self._get_function_confidentiality(context)
+            standing_guidance_snapshot = self._get_standing_guidance(context.function)
 
             # Expand hidden references before execution and retain their stored labels.
             resolved_labels = self._expand_variable_references_in_context(context)
@@ -1967,7 +1979,7 @@ async def process(
             await call_next()
             if isinstance(context.result, Content) and context.result.type == "function_approval_request":
                 return
-            self._label_result(context, function_name, fallback_label)
+            self._label_result(context, function_name, fallback_label, standing_guidance_snapshot)
         finally:
             _current_context.reset(context_token)
             _current_middleware.reset(middleware_token)
@@ -1978,6 +1990,7 @@ def _label_result(
         context: FunctionInvocationContext,
         function_name: str,
         fallback_label: ContentLabel,
+        standing_guidance: tuple[str, ...] = (),
     ) -> None:
         """Label, optionally hide, and update context label for a tool result.
 
@@ -1994,12 +2007,19 @@ def _label_result(
             context: The function invocation context (result is read/written).
             function_name: Name of the function that produced the result.
             fallback_label: Tiered fallback label (tier 2 or tier 3).
+            standing_guidance: Snapshot of the tool's declared standing_guidance,
+                captured before call_next() so a tool body cannot inject or alter
+                it at runtime. None if the tool declared none.
         """
-        if context.result is None:
-            context.metadata["result_label"] = fallback_label
-            return
+        standing_guidance_items = self._standing_guidance_items(standing_guidance, fallback_label)
 
-        original_items = self._ensure_content_list(context.result)
+        if context.result is None:
+            if not standing_guidance_items:
+                context.metadata["result_label"] = fallback_label
+                return
+            original_items = standing_guidance_items
+        else:
+            original_items = [*self._ensure_content_list(context.result), *standing_guidance_items]
 
         # Process items — apply per-item labels + hide untrusted items
         processed, result_label, visible_result_label = self._process_result_with_embedded_labels(
@@ -2153,6 +2173,106 @@ def _process_result_with_embedded_labels(
         visible_combined = combine_labels(*visible_item_labels) if visible_item_labels else None
         return processed, combined, visible_combined
 
+    def _get_standing_guidance(self, function:
```

**File**: `python/packages/core/tests/test_security.py` (modified, +261/-0)
```diff
@@ -478,6 +478,267 @@ async def next_fn():
         # Should default to UNTRUSTED (safe default)
         assert label.integrity == IntegrityLabel.UNTRUSTED
 
+    @pytest.mark.asyncio
+    async def test_standing_guidance_appended_as_trusted_content(self, middleware):
+        """A tool's declared standing_guidance is appended as its own trusted Content item."""
+
+        class ValidateArgs(BaseModel):
+            files: list[str]
+
+        async def validate(files: list[str]) -> str:
+            return "compiler output the model must not act on"
+
+        guidance_text = "A result you cannot read is not a clean validation."
+        validate_function = FunctionTool(
+            fn=validate,
+            name="validate",
+            description="Validate files",
+            args_schema=ValidateArgs,
+            additional_properties={
+                "source_integrity": "untrusted",
+                "standing_guidance": [guidance_text],
+            },
+        )
+
+        args = validate_function.args_schema(files=["main.bicep"])  # type: ignore[attr-defined]  # ty: ignore[unresolved-attribute]
+        context = FunctionInvocationContext(function=validate_function, arguments=args)
+
+        async def next_fn():
+            context.result = [Content.from_text("compiler output the model must not act on")]
+
+        await middleware.process(context, next_fn)
+
+        assert isinstance(context.result, list)
+        assert len(context.result) == 2
+        guidance_item = context.result[1]
+        assert guidance_item.text == guidance_text
+
+        guidance_label = guidance_item.additional_properties["security_label"]
+        assert guidance_label["integrity"] == IntegrityLabel.TRUSTED.value
+
+        original_item = context.result[0]
+        assert (original_item.additional_properties or {}).get("_variable_reference") is not None
+
+    @pytest.mark.asyncio
+    async def test_standing_guidance_absent_by_default(self, middleware, mock_function):
+        """A tool with no standing_guidance declared gets no extra Content item."""
+        args = mock_function.args_schema(arg="test")
+        context = FunctionInvocationContext(function=mock_function, arguments=args)
+
+        async def next_fn():
+            context.result = [Content.from_text("mock result")]
+
+        await middleware.process(context, next_fn)
+
+        assert isinstance(context.result, list)
+        assert len(context.result) == 1
+
+    @pytest.mark.asyncio
+    async def test_standing_guidance_ignores_non_string_entries(self, middleware):
+        """Non-string or empty entries in standing_guidance are dropped, not raised."""
+
+        class NoiseArgs(BaseModel):
+            pass
+
+        async def noisy() -> str:
+            return "ok"
+
+        noisy_function = FunctionTool(
+            fn=noisy,
+            name="noisy",
+            description="Tool with malformed guidance",
+            args_schema=NoiseArgs,
+            additional_properties={
+                "source_integrity": "trusted",
+                "standing_guidance": ["Valid sentence.", "", 42, None],
+            },
+        )
+        context = FunctionInvocationContext(function=noisy_function, arguments={})
+
+        async def next_fn():
+            context.result = [Content.from_text("ok")]
+
+        await middleware.process(context, next_fn)
+
+        assert isinstance(context.result, list)
+        assert len(context.result) == 2
+        assert context.result[1].text == "Valid sentence."
+
+    @pytest.mark.asyncio
+    async def test_standing_guidance_appended_when_result_is_none(self, middleware):
+        """standing_guidance still surfaces even if the tool body returns nothing."""
+
+        class EmptyArgs(BaseModel):
+            pass
+
+        async def empty() -> None:
+            return None
+
+        empty_function = FunctionTool(
+            fn=empty,
+            name="empty_fn",
+            description="Returns nothing",
+            args_schema=EmptyArgs,
+            additional_properties={
+                "source_integrity": "trusted",
+                "standing_guidance": ["Nothing was returned, which is expected."],
+            },
+        )
+        context = FunctionInvocationContext(function=empty_function, arguments={})
+
+        async def next_fn():
+            context.result = None
+
+        await middleware.process(context, next_fn)
+
+        assert isinstance(context.result, list)
+        assert len(context.result) == 1
+        assert context.result[0].text == "Nothing was returned, which is expected."
+
+    @pytest.mark.asyncio
+    async def test_standing_guidance_preserves_user_identity_principal(self, middleware) -> None:
+        """standing_guidance on a USER_IDENTITY-confidentiality tool keeps its principal set."""
+
+        class IdentityArgs(BaseModel):
+            pass
+
+        async def identity_source() -> str:
+            return "identity data"
+
+        function =
```

---

### Incident Patch 6: `73505055` (2026-10-05)
**Commit Message**: Python: Fix persistent PowerShell sessions dropping table-formatted output (#9043)

ShellSession._build_script left formatting of the command's output to
the host, which only flushes table/list formatting after the wrapping
script block returns. By then the finally block has already written the
sentinel, so output such as Get-Location, Select-Object or custom
objects landed after it and was discarded. Pipe the command through
Out-Default inside the try so it is written before the sentinel.

The regression test is gated on PowerShell being installed rather than
on Windows, so it also runs with pwsh on Linux.

**File**: `python/packages/tools/agent_framework_tools/shell/_session.py` (modified, +6/-1)
```diff
@@ -360,7 +360,12 @@ def _build_script(self, command: str, sentinel: str) -> str:
                 " $__af_last = $LASTEXITCODE;"
                 " try {"
                 f"   $__af_cmd = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{encoded}'));"
-                "   Invoke-Expression $__af_cmd;"
+                # Format the output inside the try. Left to the host, pwsh
+                # formats a script block's output only after the block has
+                # returned, so the sentinel written in finally would overtake
+                # anything rendered as a table or list (Get-Location,
+                # Select-Object, custom objects) and that output would be lost.
+                "   Invoke-Expression $__af_cmd | Out-Default;"
                 # $? has to be read on the very next statement: anything else
                 # in between overwrites it.
                 "   $__af_ok = $?;"
```

**File**: `python/packages/tools/tests/test_local_shell_tool.py` (modified, +29/-0)
```diff
@@ -3,6 +3,7 @@
 import asyncio
 import json
 import os
+import shutil
 import sys
 from collections.abc import Awaitable, Mapping, Sequence
 from typing import Any
@@ -24,6 +25,7 @@
 _TEST_SHELL = "agent-framework-test-shell"
 _APPROVED_COMMAND = "printf '%s' approved-value"
 _ALTERNATE_COMMAND = "printf '%s' alternate-value"
+_POWERSHELL = shutil.which("pwsh") or (shutil.which("powershell") if sys.platform == "win32" else None)
 
 
 class _FakeExecProcess:
@@ -356,6 +358,33 @@ async def test_persistent_powershell_utf8_roundtrip() -> None:
         assert "café" in result.stdout
 
 
+@pytest.mark.skipif(_POWERSHELL is None, reason="PowerShell is not installed")
+async def test_persistent_powershell_returns_formatted_object_output(tmp_path: os.PathLike[str]) -> None:
+    """Output that pwsh renders as a table must arrive before the sentinel.
+
+    The host formats a script block's output only after the block returns,
+    which is after the sentinel has been written, so this output used to be
+    dropped, along with any plain string written after the first object.
+    Runs wherever PowerShell is installed, not just on Windows.
+    """
+    assert _POWERSHELL is not None
+    async with LocalShellTool(
+        mode="persistent",
+        shell=[_POWERSHELL, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "-"],
+        approval_mode="never_require",
+        acknowledge_unsafe=True,
+        workdir=str(tmp_path),
+    ) as tool:
+        result = await tool.run("[pscustomobject]@{ Marker = 'af-object' }; Write-Output 'af-trailing'")
+        assert result.exit_code == 0
+        assert "af-object" in result.stdout
+        assert "af-trailing" in result.stdout
+
+        selected = await tool.run(f"Get-Item -LiteralPath '{tmp_path}' | Select-Object Name")
+        assert selected.exit_code == 0
+        assert os.path.basename(str(tmp_path)) in selected.stdout
+
+
 async def test_concurrent_first_calls_do_not_spawn_two_sessions() -> None:
     """Regression: startup must be serialised so two concurrent first callers
     don't each spawn their own subprocess."""
```

---

### Incident Patch 7: `84d13537` (2026-10-02)
**Commit Message**: Python: Apply MCP security labels to dynamically loaded tools (#8972)

* Fix MCP security labels for dynamically loaded tools

* Add MCP security label fix to 1.20.0 changelog

* Preserve MCP security binding on setup failures

* Fix MCP proxy failure test typing

* Roll back newly acquired MCP security bindings

**File**: `python/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **docs**, **samples**: Cross-reference security patterns, clarify file-search retrieval scope, improve local-shell filtering guidance, and correct README instructions ([#8726](https://github.com/microsoft/agent-framework/pull/8726), [#8591](https://github.com/microsoft/agent-framework/pull/8591), [#8766](https://github.com/microsoft/agent-framework/pull/8766), [#8822](https://github.com/microsoft/agent-framework/pull/8822))
 
 ### Fixed
+- **agent-framework-core**: Apply MCP security labels before dynamically discovered and progressively disclosed tools become callable ([#8972](https://github.com/microsoft/agent-framework/pull/8972))
 - **agent-framework-core**: Reduce response-stream hot-path overhead and avoid loading tool-approval middleware for agent runs without middleware ([#8971](https://github.com/microsoft/agent-framework/pull/8971))
 - **agent-framework-core**: Preserve functional-workflow replay identity, scope invocation arguments and activity IDs to workflow runs, deduplicate fan-out targets, propagate nested cancellation arguments, and support orchestration checkpoint deserialization ([#8887](https://github.com/microsoft/agent-framework/pull/8887), [#8596](https://github.com/microsoft/agent-framework/pull/8596), [#8549](https://github.com/microsoft/agent-framework/pull/8549), [#8739](https://github.com/microsoft/agent-framework/pull/8739), [#8602](https://github.com/microsoft/agent-framework/pull/8602), [#8723](https://github.com/microsoft/agent-framework/pull/8723))
 - **agent-framework-core**: Preserve repeated history turns, compaction through middleware rewrites, checkpoint dictionary subclasses, response metadata, annotations, native vector keys, integer precision, and boolean set values ([#8800](https://github.com/microsoft/agent-framework/pull/8800), [#8671](https://github.com/microsoft/agent-framework/pull/8671), [#8519](https://github.com/microsoft/agent-framework/pull/8519), [#8464](https://github.com/microsoft/agent-framework/pull/8464), [#8701](https://github.com/microsoft/agent-framework/pull/8701), [#8535](https://github.com/microsoft/agent-framework/pull/8535), [#8637](https://github.com/microsoft/agent-framework/pull/8637), [#8681](https://github.com/microsoft/agent-framework/pull/8681))
```

**File**: `python/packages/core/agent_framework/_mcp.py` (modified, +18/-0)
```diff
@@ -499,6 +499,7 @@ async def delete(self, *args: Any, **kwargs: Any) -> Any:
 # and returns (or awaits to) a truthy value to approve the request or a falsy
 # value to deny it. Both synchronous and asynchronous callables are supported.
 SamplingApprovalCallback = Callable[["types.CreateMessageRequestParams"], "bool | Coroutine[Any, Any, bool]"]
+_MCPFunctionLoadCallback = Callable[[FunctionTool, Any], None]
 
 # region: Helpers
 
@@ -1048,6 +1049,7 @@ def __init__(
             self._warn_sampling_deprecated(stacklevel=4)
         self._sampling_request_count = 0
         self._functions: list[FunctionTool] = []
+        self._function_load_callback: _MCPFunctionLoadCallback | None = None
         self.use_progressive_disclosure = use_progressive_disclosure
         self.always_load = always_load
         self._always_load_names = set(always_load or ())
@@ -2514,6 +2516,9 @@ async def _load_prompts_locked(self) -> None:
             params = types.PaginatedRequestParams(cursor=prompt_list.nextCursor)
 
         self._validate_config_names([*self._functions, *new_functions])
+        if self._function_load_callback is not None:
+            for function in new_functions:
+                self._function_load_callback(function, None)
         self._functions.extend(new_functions)
 
     async def load_tools(self) -> None:
@@ -2553,6 +2558,7 @@ async def _load_tools_locked(self) -> None:
         tool_call_meta_by_name: dict[str, dict[str, Any]] = {}
         tool_task_support_by_name: dict[str, str] = {}
         tool_param_names_by_name: dict[str, set[str]] = {}
+        tool_annotations_by_name: dict[str, Any] = {}
 
         params: types.PaginatedRequestParams | None = None
         while True:
@@ -2588,6 +2594,7 @@ async def _load_tools_locked(self) -> None:
                 raise ToolExecutionException("Failed to load tools.")
 
             for tool in tool_list.tools:
+                tool_annotations_by_name[tool.name] = tool.annotations
                 if tool.meta is not None:
                     tool_call_meta_by_name[tool.name] = _validate_mcp_meta(tool.meta) or {}
 
@@ -2671,6 +2678,17 @@ async def _load_tools_locked(self) -> None:
         ]
         current_functions.extend(new_functions)
         self._validate_config_names(current_functions)
+        for function in current_functions:
+            properties = function.additional_properties or {}
+            if not properties.get(_MCP_IS_TOOL_KEY):
+                continue
+            remote_name = properties.get(_MCP_REMOTE_NAME_KEY)
+            if (
+                isinstance(remote_name, str)
+                and remote_name in tool_annotations_by_name
+                and self._function_load_callback is not None
+            ):
+                self._function_load_callback(function, tool_annotations_by_name[remote_name])
         self._functions[:] = current_functions
         self._tool_call_meta_by_name = tool_call_meta_by_name
         self._tool_task_support_by_name = tool_task_support_by_name
```

**File**: `python/packages/core/agent_framework/security.py` (modified, +144/-68)
```diff
@@ -4055,6 +4055,52 @@ def _map_mcp_annotations_to_labels(
     return (integrity, ConfidentialityLabel.PUBLIC, False)
 
 
+def _apply_mcp_security_label_to_function(
+    function: FunctionTool,
+    annotations: Any,
+    *,
+    default_integrity: IntegrityLabel,
+    annotation_overrides: Mapping[str, tuple[IntegrityLabel, ConfidentialityLabel | None]] | None,
+    mark_write_tools_as_sinks: bool,
+    trust_server_ifc: bool,
+) -> None:
+    """Apply one local MCP security policy to a remote function."""
+    properties = function.additional_properties
+    if properties is None:
+        properties = {}
+        function.additional_properties = properties
+    remote_name = properties.get("_mcp_remote_name")
+    if not isinstance(remote_name, str):
+        return
+
+    overrides = annotation_overrides or {}
+    if remote_name in overrides:
+        integrity, max_confidentiality = overrides[remote_name]
+        accepts_untrusted = False
+    else:
+        integrity, max_confidentiality, accepts_untrusted = _map_mcp_annotations_to_labels(
+            annotations,
+            default_integrity=default_integrity,
+        )
+
+    properties["source_integrity"] = integrity.value
+    if mark_write_tools_as_sinks and max_confidentiality is not None:
+        properties["max_allowed_confidentiality"] = max_confidentiality.value
+    else:
+        properties.pop("max_allowed_confidentiality", None)
+    properties["accepts_untrusted"] = accepts_untrusted
+    properties[_MCP_TRUST_SERVER_IFC_KEY] = trust_server_ifc
+    _wrap_mcp_function_for_ifc(function, default_integrity)
+
+    logger.info(
+        "MCP auto-label: tool=%s integrity=%s max_confidentiality=%s accepts_untrusted=%s",
+        remote_name,
+        integrity.value,
+        max_confidentiality.value if max_confidentiality else "none",
+        accepts_untrusted,
+    )
+
+
 @experimental(feature_id=ExperimentalFeature.FIDES)
 async def apply_mcp_security_labels(
     mcp_tool: Any,
@@ -4072,6 +4118,7 @@ async def apply_mcp_security_labels(
     ``additional_properties``.  The existing
     :class:`LabelTrackingFunctionMiddleware` picks these up automatically
     (Tier 2 label propagation), so **no middleware changes are needed**.
+    Currently hidden progressive-disclosure tools are included.
 
     Server annotations cannot relax local policy. Use ``annotation_overrides``
     for explicit local per-tool static policy. Server result ``_meta.ifc`` is
@@ -4080,6 +4127,8 @@ async def apply_mcp_security_labels(
     that result. ToolAnnotations remain non-authoritative in both modes.
 
     Call this **after** the ``MCPTool`` is connected (tools already loaded).
+    Use :class:`SecureMCPToolProxy` to keep the same policy bound to functions
+    discovered later in the connection lifecycle.
 
     Args:
         mcp_tool: A connected ``MCPTool`` instance (``MCPStdioTool``,
@@ -4123,70 +4172,31 @@ async def apply_mcp_security_labels(
     if session is None:
         raise RuntimeError("MCPTool has no active session.")
 
-    # ------------------------------------------------------------------
-    # 1. Fetch tool list (with annotations) from the server
-    # ------------------------------------------------------------------
     from mcp import types as mcp_types
 
-    annotation_map: dict[str, Any] = {}  # remote_name → ToolAnnotations | None
+    annotation_map: dict[str, Any] = {}
     params: mcp_types.PaginatedRequestParams | None = None
     while True:
         tool_list = await session.list_tools(params=params)
-        for t in tool_list.tools:
-            annotation_map[t.name] = t.annotations
-        if not tool_list or not tool_list.nextCursor:
+        for remote_tool in tool_list.tools:
+            annotation_map[remote_tool.name] = remote_tool.annotations
+        if not tool_list.nextCursor:
             break
         params = mcp_types.PaginatedRequestParams(cursor=tool_list.nextCursor)
 
-    # ------------------------------------------------------------------
-    # 2. Patch each FunctionTool's additional_properties
-    # ------------------------------------------------------------------
-    overrides = annotation_overrides or {}
-    functions: list[FunctionTool] = getattr(mcp_tool, "functions", [])
-
-    for func in functions:
-        props = func.additional_properties
-        if props is None:
-            props = {}
-            func.additional_properties = props
-
-        remote_name: str | None = props.get("_mcp_remote_name")
-        if remote_name is None:
-            continue
-
-        # Check for explicit per-tool override first
-        if remote_name in overrides:
-            integrity, max_conf = overrides[remote_name]
-            accepts_untrusted = False  # overrides must opt-in explicitly
-        else:
-            annotations = annotation_map.get(remote_name)
-            integrity, max_conf, accepts_untrusted = _map_mcp_annotations_to_labels(
-                annotations, defaul
```

**File**: `python/packages/core/tests/test_security.py` (modified, +300/-1)
```diff
@@ -6,10 +6,11 @@
 import json
 import logging
 import math
+import warnings
 from datetime import timedelta
 from types import MappingProxyType, SimpleNamespace
 from typing import Any, cast
-from unittest.mock import AsyncMock
+from unittest.mock import AsyncMock, Mock
 
 import pytest
 from pydantic import BaseModel, field_validator
@@ -6090,6 +6091,63 @@ async def fake_call(**kwargs: Any) -> list[Content]:
     return mcp_tool, function
 
 
+def _make_mcp_tool_definition(name: str, *, open_world: bool = False) -> Any:
+    from mcp import types as mcp_types
+
+    return mcp_types.Tool(
+        name=name,
+        description=f"{name} description",
+        inputSchema={"type": "object", "properties": {}},
+        annotations=mcp_types.ToolAnnotations(readOnlyHint=False, openWorldHint=open_world),
+    )
+
+
+def _make_connected_mcp_discovery_tool(
+    *,
+    progressive: bool = False,
+    always_load: list[str] | None = None,
+    result_meta: dict[str, Any] | None = None,
+) -> Any:
+    from mcp import types as mcp_types
+
+    from agent_framework._mcp import MCPTool
+
+    class _ConcreteMCPTool(MCPTool):
+        def get_mcp_client(self):
+            raise NotImplementedError
+
+    with warnings.catch_warnings():
+        warnings.simplefilter("ignore")
+        mcp_tool = _ConcreteMCPTool(
+            name="helper",
+            load_prompts=False,
+            use_progressive_disclosure=progressive,
+            always_load=always_load,
+        )
+    mcp_tool.is_connected = True
+    mcp_tool.session = AsyncMock()
+    mcp_tool.session.call_tool = AsyncMock(
+        return_value=mcp_types.CallToolResult(
+            content=[mcp_types.TextContent(type="text", text="payload")],
+            _meta=result_meta or {"ifc": {"integrity": "trusted", "confidentiality": "private"}},
+        )
+    )
+    return mcp_tool
+
+
+def _find_mcp_function(mcp_tool: Any, remote_name: str) -> FunctionTool:
+    return next(
+        function
+        for function in mcp_tool._functions
+        if (function.additional_properties or {}).get("_mcp_remote_name") == remote_name
+    )
+
+
+async def _invoke_mcp_function(function: FunctionTool) -> Any:
+    context = FunctionInvocationContext(function=function, arguments={})
+    return await function.invoke(arguments={}, context=context, skip_parsing=True)
+
+
 # ---------------------------------------------------------------------------
 # IFC labels from MCP _meta payload
 # ---------------------------------------------------------------------------
@@ -6668,6 +6726,247 @@ async def test_secure_mcp_proxy_configures_result_authority(self, trust_server_i
         )
         assert result[0].additional_properties["security_label"] == expected_label
 
+    async def test_secure_mcp_proxy_labels_notification_reload_before_publication(self):
+        from mcp import types as mcp_types
+
+        from agent_framework.security import SecureMCPToolProxy
+
+        initial_tool = _make_mcp_tool_definition("initial_sink", open_world=False)
+        late_tool = _make_mcp_tool_definition("late_sink", open_world=True)
+        mcp_tool = _make_connected_mcp_discovery_tool()
+        mcp_tool.session.list_tools = AsyncMock(return_value=mcp_types.ListToolsResult(tools=[initial_tool]))
+        await mcp_tool.load_tools()
+
+        proxy = SecureMCPToolProxy(mcp_tool, default_integrity=IntegrityLabel.TRUSTED)
+        await proxy.refresh_labels()
+        initial_function = _find_mcp_function(mcp_tool, "initial_sink")
+        assert initial_function.additional_properties is not None
+        assert initial_function.additional_properties["source_integrity"] == "trusted"
+
+        reloaded_initial_tool = _make_mcp_tool_definition("initial_sink", open_world=True)
+        mcp_tool.session.list_tools.return_value = mcp_types.ListToolsResult(tools=[reloaded_initial_tool, late_tool])
+        notification = Mock(spec=mcp_types.ServerNotification)
+        notification.root = Mock()
+        notification.root.method = "notifications/tools/list_changed"
+
+        await mcp_tool.message_handler(notification)
+        pending_reloads = list(mcp_tool._pending_reload_tasks)
+        assert pending_reloads
+        await asyncio.gather(*pending_reloads)
+
+        assert _find_mcp_function(mcp_tool, "initial_sink") is initial_function
+        assert initial_function.additional_properties is not None
+        assert initial_function.additional_properties["source_integrity"] == "untrusted"
+        late_function = _find_mcp_function(mcp_tool, "late_sink")
+        assert late_function.additional_properties is not None
+        assert late_function.additional_properties["source_integrity"] == "untrusted"
+        assert late_function.additional_properties["max_allowed_confidentiality"] == "public"
+        assert late_function.additional_properties["accepts_untrusted"] is False
+        assert late_function.additional_properties["_mcp_trust_server_ifc"] is False
+        assert ge
```

---

### Incident Patch 8: `a2f4506c` (2026-10-02)
**Commit Message**: .NET: Skip empty Foundry memory context messages (#8932)

* .NET: Skip empty Foundry memory context messages

* .NET: Check for null or empty Foundry memory text

* .NET: Align Foundry memory mock routes with SDK requests

**File**: `dotnet/src/Microsoft.Agents.AI.Foundry/Memory/FoundryMemoryProvider.cs` (modified, +5/-0)
```diff
@@ -156,6 +156,11 @@ protected override async ValueTask<AIContext> ProvideAIContextAsync(InvokingCont
                 }
             }
 
+            if (string.IsNullOrEmpty(outputMessageText))
+            {
+                return new AIContext();
+            }
+
             return new AIContext
             {
                 Messages = [new ChatMessage(ChatRole.User, outputMessageText)]
```

**File**: `dotnet/tests/Microsoft.Agents.AI.Foundry.UnitTests/Memory/FoundryMemoryProviderTests.cs` (modified, +95/-3)
```diff
@@ -1,20 +1,95 @@
 ﻿// Copyright (c) Microsoft. All rights reserved.
 
 using System;
+using System.Linq;
+using System.Threading.Tasks;
+using Microsoft.Extensions.AI;
+using Microsoft.Extensions.Logging;
+using Moq;
 
 namespace Microsoft.Agents.AI.Foundry.UnitTests.Memory;
 
 /// <summary>
-/// Tests for <see cref="FoundryMemoryProvider"/> constructor validation.
+/// Tests for <see cref="FoundryMemoryProvider"/>.
 /// </summary>
 /// <remarks>
-/// Since <see cref="FoundryMemoryProvider"/> directly uses <see cref="Azure.AI.Projects.AIProjectClient"/>,
-/// integration tests are used to verify the memory operations. These unit tests focus on:
+/// A mocked HTTP transport lets these tests exercise the public provider invocation without a live Foundry project.
+/// These unit tests cover:
 /// - Constructor parameter validation
 /// - State initializer validation
+/// - Memory search result handling
 /// </remarks>
 public sealed class FoundryMemoryProviderTests
 {
+    [Theory]
+    [InlineData("""{"memories":[]}""")]
+    [InlineData("""{"memories":[{"memory_item":{"content":""}},{"memory_item":{"content":"   "}}]}""")]
+    public async Task InvokingAsync_WhenSearchReturnsNoUsableMemories_ReturnsOnlyInputMessagesAsync(string searchResponse)
+    {
+        // Arrange
+        using TestableAIProjectClient testClient = new(searchMemoriesResponse: searchResponse);
+        Mock<ILoggerFactory> loggerFactory = CreateErrorFailingLoggerFactory();
+        FoundryMemoryProvider sut = new(
+            testClient.Client,
+            "store",
+            stateInitializer: _ => new(new FoundryMemoryProviderScope("test")),
+            loggerFactory: loggerFactory.Object);
+        AIContextProvider.InvokingContext invocation = CreateInvokingContext();
+
+        // Act
+        AIContext result = await sut.InvokingAsync(invocation);
+
+        // Assert
+        Assert.Contains(
+            "/memory_stores/store:search_memories",
+            testClient.Handler.LastRequestUri!,
+            StringComparison.Ordinal);
+        ChatMessage message = Assert.Single(result.Messages!);
+        Assert.Equal(ChatRole.User, message.Role);
+        Assert.Equal("What do I prefer?", message.Text);
+    }
+
+    [Fact]
+    public async Task InvokingAsync_WhenSearchReturnsMemories_InjectsMemoryMessageAsync()
+    {
+        // Arrange
+        using TestableAIProjectClient testClient = new(
+            searchMemoriesResponse:
+                """
+                {
+                  "search_id": "search-1",
+                  "memories": [
+                    {
+                      "memory_item": {
+                        "memory_id": "memory-1",
+                        "updated_at": 0,
+                        "scope": "test",
+                        "content": "The user prefers concise answers.",
+                        "kind": "user_profile"
+                      }
+                    }
+                  ]
+                }
+                """);
+        FoundryMemoryProvider sut = new(
+            testClient.Client,
+            "store",
+            stateInitializer: _ => new(new FoundryMemoryProviderScope("test")));
+        AIContextProvider.InvokingContext invocation = CreateInvokingContext();
+
+        // Act
+        AIContext result = await sut.InvokingAsync(invocation);
+
+        // Assert
+        ChatMessage[] messages = result.Messages!.ToArray();
+        Assert.Equal(2, messages.Length);
+        Assert.Equal("What do I prefer?", messages[0].Text);
+        Assert.Equal(ChatRole.User, messages[1].Role);
+        Assert.Equal(
+            "## Memories\nConsider the following memories when answering user questions:\nThe user prefers concise answers.",
+            messages[1].Text);
+    }
+
     [Fact]
     public void Constructor_Throws_WhenClientIsNull()
     {
@@ -127,4 +202,21 @@ public void Constructor_Succeeds_WithValidParameters()
         // Assert
         Assert.NotNull(sut);
     }
+
+    private static AIContextProvider.InvokingContext CreateInvokingContext() => new(
+        new Mock<AIAgent>().Object,
+        new Mock<AgentSession>().Object,
+        new AIContext { Messages = [new ChatMessage(ChatRole.User, "What do I prefer?")] });
+
+    private static Mock<ILoggerFactory> CreateErrorFailingLoggerFactory()
+    {
+        Mock<ILogger> mockLogger = new(MockBehavior.Strict);
+        mockLogger.Setup(logger => logger.IsEnabled(LogLevel.Information)).Returns(false);
+        mockLogger.Setup(logger => logger.IsEnabled(LogLevel.Error)).Returns(true);
+
+        Mock<ILoggerFactory> loggerFactory = new(MockBehavior.Strict);
+        loggerFactory.Setup(factory => factory.CreateLogger(It.IsAny<string>())).Returns(mockLogger.Object);
+
+        return loggerFactory;
+    }
 }
```

**File**: `dotnet/tests/Microsoft.Agents.AI.Foundry.UnitTests/Memory/TestableAIProjectClient.cs` (modified, +9/-9)
```diff
@@ -88,9 +88,9 @@ public MockHttpMessageHandler(
         this._searchMemoriesResponse = searchMemoriesResponse ?? """{"memories":[]}""";
         this._updateMemoriesResponse = updateMemoriesResponse ?? """{"update_id":"test-update-id","status":"queued"}""";
         this._searchStatusCode = searchStatusCode ?? HttpStatusCode.OK;
-        this._updateStatusCode = updateStatusCode ?? HttpStatusCode.OK;
-        this._deleteStatusCode = deleteStatusCode ?? HttpStatusCode.NoContent;
-        this._createStoreStatusCode = createStoreStatusCode ?? HttpStatusCode.Created;
+        this._updateStatusCode = updateStatusCode ?? HttpStatusCode.Accepted;
+        this._deleteStatusCode = deleteStatusCode ?? HttpStatusCode.OK;
+        this._createStoreStatusCode = createStoreStatusCode ?? HttpStatusCode.OK;
         this._getStoreStatusCode = getStoreStatusCode ?? HttpStatusCode.NotFound;
     }
 
@@ -115,27 +115,27 @@ protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage
         string path = request.RequestUri?.AbsolutePath ?? "";
 
         // Route based on path and method
-        if (path.Contains("/memory-stores/") && path.Contains("/search") && request.Method == HttpMethod.Post)
+        if (path.Contains("/memory_stores/") && path.Contains(":search_memories") && request.Method == HttpMethod.Post)
         {
             return CreateResponse(this._searchStatusCode, this._searchMemoriesResponse);
         }
 
-        if (path.Contains("/memory-stores/") && path.Contains("/memories") && request.Method == HttpMethod.Post)
+        if (path.Contains("/memory_stores/") && path.EndsWith(":update_memories", StringComparison.Ordinal) && request.Method == HttpMethod.Post)
         {
             return CreateResponse(this._updateStatusCode, this._updateMemoriesResponse);
         }
 
-        if (path.Contains("/memory-stores/") && path.Contains("/scopes") && request.Method == HttpMethod.Delete)
+        if (path.Contains("/memory_stores/") && path.EndsWith(":delete_scope", StringComparison.Ordinal) && request.Method == HttpMethod.Post)
         {
-            return CreateResponse(this._deleteStatusCode, "");
+            return CreateResponse(this._deleteStatusCode, """{"object":"memory_store.scope.deleted","name":"test-store","scope":"test-scope","deleted":true}""");
         }
 
-        if (path.Contains("/memory-stores") && request.Method == HttpMethod.Post)
+        if (path.EndsWith("/memory_stores", StringComparison.Ordinal) && request.Method == HttpMethod.Post)
         {
             return CreateResponse(this._createStoreStatusCode, """{"name":"test-store","status":"active"}""");
         }
 
-        if (path.Contains("/memory-stores/") && request.Method == HttpMethod.Get)
+        if (path.Contains("/memory_stores/") && request.Method == HttpMethod.Get)
         {
             return CreateResponse(this._getStoreStatusCode, """{"name":"test-store","status":"active"}""");
         }
```

**File**: `dotnet/tests/Microsoft.Agents.AI.Foundry.UnitTests/Memory/TestableAIProjectClientTests.cs` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+﻿// Copyright (c) Microsoft. All rights reserved.
+
+using System;
+using System.Net;
+using System.Net.Http;
+using System.Threading.Tasks;
+using Azure.AI.Projects.Memory;
+using OpenAI.Responses;
+
+namespace Microsoft.Agents.AI.Foundry.UnitTests.Memory;
+
+/// <summary>Verifies that the mock transport handles requests generated by the memory SDK.</summary>
+public sealed class TestableAIProjectClientTests
+{
+    /// <summary>Verifies the update action route and its accepted response.</summary>
+    [Fact]
+    public async Task UpdateMemoriesAsync_MatchesSdkRequestAsync()
+    {
+        // Arrange
+        using TestableAIProjectClient testClient = new();
+        MemoryUpdateOptions options = new("test-scope");
+        options.Items.Add(ResponseItem.CreateUserMessageItem("I prefer concise answers."));
+
+        // Act
+        var result = await testClient.Client.MemoryStores.UpdateMemoriesAsync("test-store", options);
+
+        // Assert
+        Assert.Equal("test-update-id", result.Value.UpdateId);
+        Assert.Equal((int)HttpStatusCode.Accepted, result.GetRawResponse().Status);
+        Assert.Equal(HttpMethod.Post, testClient.Handler.LastRequestMethod);
+        Assert.Equal("/api/projects/test-project/memory_stores/test-store:update_memories", new Uri(testClient.Handler.LastRequestUri!).AbsolutePath);
+    }
+
+    /// <summary>Verifies that deleting a scope uses POST and returns its result.</summary>
+    [Fact]
+    public async Task DeleteScopeAsync_MatchesSdkRequestAsync()
+    {
+        // Arrange
+        using TestableAIProjectClient testClient = new();
+
+        // Act
+        var result = await testClient.Client.MemoryStores.DeleteScopeAsync("test-store", "test-scope");
+
+        // Assert
+        Assert.True(result.Value.IsDeleted);
+        Assert.Equal("test-scope", result.Value.Scope);
+        Assert.Equal((int)HttpStatusCode.OK, result.GetRawResponse().Status);
+        Assert.Equal(HttpMethod.Post, testClient.Handler.LastRequestMethod);
+        Assert.Equal("/api/projects/test-project/memory_stores/test-store:delete_scope", new Uri(testClient.Handler.LastRequestUri!).AbsolutePath);
+    }
+
+    /// <summary>Verifies the collection route used to create a memory store.</summary>
+    [Fact]
+    public async Task CreateMemoryStoreAsync_MatchesSdkRequestAsync()
+    {
+        // Arrange
+        using TestableAIProjectClient testClient = new();
+        MemoryStoreDefaultDefinition definition = new("chat-model", "embedding-model");
+
+        // Act
+        var result = await testClient.Client.MemoryStores.CreateMemoryStoreAsync("test-store", definition);
+
+        // Assert
+        Assert.Equal("test-store", result.Value.Name);
+        Assert.Equal((int)HttpStatusCode.OK, result.GetRawResponse().Status);
+        Assert.Equal(HttpMethod.Post, testClient.Handler.LastRequestMethod);
+        Assert.Equal("/api/projects/test-project/memory_stores", new Uri(testClient.Handler.LastRequestUri!).AbsolutePath);
+    }
+
+    /// <summary>Verifies that retrieving a memory store uses the configured mock result.</summary>
+    [Fact]
+    public async Task GetMemoryStoreAsync_MatchesSdkRequestAsync()
+    {
+        // Arrange
+        using TestableAIProjectClient testClient = new(getStoreStatusCode: HttpStatusCode.OK);
+
+        // Act
+        var result = await testClient.Client.MemoryStores.GetMemoryStoreAsync("test-store");
+
+        // Assert
+        Assert.Equal("test-store", result.Value.Name);
+        Assert.Equal((int)HttpStatusCode.OK, result.GetRawResponse().Status);
+        Assert.Equal(HttpMethod.Get, testClient.Handler.LastRequestMethod);
+        Assert.Equal("/api/projects/test-project/memory_stores/test-store", new Uri(testClient.Handler.LastRequestUri!).AbsolutePath);
+    }
+}
```

---

### Incident Patch 9: `30055e4d` (2026-10-02)
**Commit Message**: Python: fix(openai): close the chat-completions SDK stream when the consumer stops early (#8773)

* Python: fix(openai): close the chat-completions SDK stream when the consumer stops early

Signed-off-by: Yufeng He <[REDACTED_EMAIL]>

* Python: fix(core): close ResponseStream iterators on abort and hook errors

The Copilot review on #8773 was right: binding the SDK stream with
`async with` only unwinds when the wrapping generator is closed, and
nothing closed it when a consumer broke out of the loop or a transform
hook raised after a yielded update. ResponseStream is now an async
context manager whose __aexit__ closes the stream, and __anext__ closes
the active iterator when a map/flat_map transform or a transform hook
raises, so the provider stream is released on both paths instead of
waiting for GC.

Signed-off-by: Yufeng He <[REDACTED_EMAIL]>

* Python: fix(core): record the stream error before closing on failure paths

The reorder in d8b7a39f closed the stream before _handle_stream_error ran.
close() consumes the one-shot cleanup hook run with no _stream_error set,
so observability hooks recorded the failure without error.type and any
retry/persistence hook saw an already-final

**File**: `python/packages/core/agent_framework/_types.py` (modified, +19/-2)
```diff
@@ -3722,6 +3722,13 @@ async def _get_stream(self) -> AsyncIterable[UpdateT]:
     def __aiter__(self) -> ResponseStream[UpdateT, FinalT]:
         return self
 
+    async def __aenter__(self) -> ResponseStream[UpdateT, FinalT]:
+        return self
+
+    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
+        """Close the stream on block exit, including an early consumer break."""
+        await self.close()
+
     def _start_content_pipeline(self) -> None:
         if self._content_pipeline_started:
             return
@@ -4004,8 +4011,18 @@ async def __anext__(self) -> UpdateT:
         except StopAsyncIteration:
             await self._finish_consumption()
             raise
-        except Exception as exc:
-            await self._handle_stream_error(exc)
+        except BaseException as exc:
+            # CancelledError must reach close() too: a cancel landing in an
+            # async map/flat_map transform, hook, or gate otherwise leaves the
+            # provider stream suspended until GC. Hooks run first because they
+            # read self._stream_error, and close() would consume the one-shot
+            # cleanup run without it. close() stays in finally so the provider
+            # stream is released even when a hook raises; the original
+            # exception always re-raises.
+            try:
+                await self._handle_stream_error(exc)
+            finally:
+                await self.close()
             raise
 
     async def close(self) -> None:
```

**File**: `python/packages/core/tests/core/test_types.py` (modified, +126/-0)
```diff
@@ -4493,6 +4493,132 @@ async def updates() -> AsyncIterable[ChatResponseUpdate]:
 
         assert events == ["iterator", "inner", "outer"]
 
+    async def test_async_with_break_closes_iterator(self) -> None:
+        """Breaking out of `async with stream:` releases the iterator without a manual close."""
+        events: list[str] = []
+
+        async def updates() -> AsyncIterable[ChatResponseUpdate]:
+            try:
+                yield ChatResponseUpdate(contents=[Content.from_text("first")], role="assistant")
+                yield ChatResponseUpdate(contents=[Content.from_text("second")], role="assistant")
+            finally:
+                events.append("iterator")
+
+        stream: ResponseStream[ChatResponseUpdate, Sequence[ChatResponseUpdate]] = ResponseStream(
+            updates(), cleanup_hooks=[lambda: events.append("cleanup")]
+        )
+
+        async with stream:
+            async for _ in stream:
+                break
+
+        assert events == ["iterator", "cleanup"]
+
+    async def test_transform_hook_error_closes_iterator(self) -> None:
+        """A hook that fails after a yielded update releases the suspended iterator."""
+        events: list[str] = []
+
+        async def updates() -> AsyncIterable[ChatResponseUpdate]:
+            try:
+                yield ChatResponseUpdate(contents=[Content.from_text("first")], role="assistant")
+                yield ChatResponseUpdate(contents=[Content.from_text("second")], role="assistant")
+            finally:
+                events.append("iterator")
+
+        def failing_hook(update: ChatResponseUpdate) -> ChatResponseUpdate:
+            raise RuntimeError("hook blew up")
+
+        stream: ResponseStream[ChatResponseUpdate, Sequence[ChatResponseUpdate]] = ResponseStream(
+            updates(),
+            transform_hooks=[failing_hook],  # ty: ignore[invalid-argument-type]
+        )
+
+        with pytest.raises(RuntimeError, match="hook blew up"):
+            async for _ in stream:
+                pass
+
+        assert events == ["iterator"]
+
+    async def test_cancellation_closes_iterator(self) -> None:
+        """Cancelling the consumer mid-iteration releases the suspended iterator."""
+        events: list[str] = []
+        provider_suspended = asyncio.Event()
+
+        async def updates() -> AsyncIterable[ChatResponseUpdate]:
+            try:
+                yield ChatResponseUpdate(contents=[Content.from_text("first")], role="assistant")
+                provider_suspended.set()
+                await asyncio.sleep(60)
+                yield ChatResponseUpdate(contents=[Content.from_text("second")], role="assistant")
+            finally:
+                events.append("iterator")
+
+        stream: ResponseStream[ChatResponseUpdate, Sequence[ChatResponseUpdate]] = ResponseStream(
+            updates(), cleanup_hooks=[lambda: events.append("cleanup")]
+        )
+
+        async def consume() -> None:
+            async for _ in stream:
+                pass
+
+        task = asyncio.create_task(consume())
+        await provider_suspended.wait()
+        task.cancel()
+        with pytest.raises(asyncio.CancelledError):
+            await task
+
+        assert events == ["iterator", "cleanup"]
+
+    async def test_cancelled_error_from_hook_closes_iterator(self) -> None:
+        """A hook raising CancelledError after a yielded update still closes the iterator."""
+        events: list[str] = []
+
+        async def updates() -> AsyncIterable[ChatResponseUpdate]:
+            try:
+                yield ChatResponseUpdate(contents=[Content.from_text("first")], role="assistant")
+                yield ChatResponseUpdate(contents=[Content.from_text("second")], role="assistant")
+            finally:
+                events.append("iterator")
+
+        async def cancelling_hook(update: ChatResponseUpdate) -> ChatResponseUpdate:
+            raise asyncio.CancelledError
+
+        stream: ResponseStream[ChatResponseUpdate, Sequence[ChatResponseUpdate]] = ResponseStream(
+            updates(),
+            transform_hooks=[cancelling_hook],  # ty: ignore[invalid-argument-type]
+            cleanup_hooks=[lambda: events.append("cleanup")],
+        )
+
+        with pytest.raises(asyncio.CancelledError):
+            async for _ in stream:
+                pass
+
+        # Error path runs cleanup before close() releases the iterator.
+        assert events == ["cleanup", "iterator"]
+
+    async def test_cancelled_error_from_map_transform_closes_inner_stream(self) -> None:
+        """A cancelled async map transform releases the wrapped provider iterator."""
+        events: list[str] = []
+
+        async def updates() -> AsyncIterable[ChatResponseUpdate]:
+            try:
+                yield ChatResponseUpdate(contents=[Content.from_text("first")], role="assistant")
+                yield ChatResponseUpdate(contents=[Content.from_text("second")], role="assistant")
+            finally:
+   
```

**File**: `python/packages/openai/agent_framework_openai/_chat_completion_client.py` (modified, +28/-21)
```diff
@@ -637,28 +637,35 @@ async def _stream() -> AsyncIterable[ChatResponseUpdate]:
                 if extra_headers is not None:
                     request_options["extra_headers"] = dict(extra_headers)
                 try:
-                    async for chunk in await client.chat.completions.create(stream=True, **request_options):
-                        if len(chunk.choices) == 0 and chunk.usage is None:
-                            continue
-                        update = self._parse_response_update_from_openai(chunk)
-                        for content in update.contents:
-                            if content.type != "function_call":
+                    # The SDK stream owns the HTTP response; a bare `async for`
+                    # leaves it suspended (and the response open until GC) when
+                    # the consumer stops early, so bind it with `async with`
+                    # like the Responses path does.
+                    async with await client.chat.completions.create(
+                        stream=True, **request_options
+                    ) as completion_stream:
+                        async for chunk in completion_stream:
+                            if len(chunk.choices) == 0 and chunk.usage is None:
                                 continue
-                            choice_index = content.additional_properties.get("tool_call_choice_index")
-                            tool_index = content.additional_properties.get("tool_call_index")
-                            if not isinstance(choice_index, int) or not isinstance(tool_index, int):
-                                continue
-                            index_key = (choice_index, tool_index)
-                            identity = tool_call_identities.get(index_key)
-                            if identity is None:
-                                identity = (f"af-call-{uuid4().hex}", content.call_id or "")
-                            occurrence_id, provider_call_id = identity
-                            if content.call_id:
-                                provider_call_id = content.call_id
-                            tool_call_identities[index_key] = (occurrence_id, provider_call_id)
-                            content.id = occurrence_id
-                            content.call_id = provider_call_id
-                        yield update
+                            update = self._parse_response_update_from_openai(chunk)
+                            for content in update.contents:
+                                if content.type != "function_call":
+                                    continue
+                                choice_index = content.additional_properties.get("tool_call_choice_index")
+                                tool_index = content.additional_properties.get("tool_call_index")
+                                if not isinstance(choice_index, int) or not isinstance(tool_index, int):
+                                    continue
+                                index_key = (choice_index, tool_index)
+                                identity = tool_call_identities.get(index_key)
+                                if identity is None:
+                                    identity = (f"af-call-{uuid4().hex}", content.call_id or "")
+                                occurrence_id, provider_call_id = identity
+                                if content.call_id:
+                                    provider_call_id = content.call_id
+                                tool_call_identities[index_key] = (occurrence_id, provider_call_id)
+                                content.id = occurrence_id
+                                content.call_id = provider_call_id
+                            yield update
                 except BadRequestError as ex:
                     if ex.code == "content_filter":
                         raise OpenAIContentFilterException(
```

**File**: `python/packages/openai/tests/openai/test_openai_chat_completion_client.py` (modified, +132/-15)
```diff
@@ -1,5 +1,6 @@
 # Copyright (c) Microsoft. All rights reserved.
 
+import asyncio
 import inspect
 import json
 import os
@@ -45,6 +46,27 @@
 )
 
 
+class _FakeAsyncStream:
+    """Test double for the SDK's AsyncStream: an async context manager over chunks."""
+
+    def __init__(self, chunks: Any) -> None:
+        self._chunks = chunks
+        self.closed = False
+
+    async def __aenter__(self) -> "_FakeAsyncStream":
+        return self
+
+    async def __aexit__(self, *exc_info: Any) -> None:
+        self.closed = True
+
+    def __aiter__(self) -> Any:
+        async def generate() -> Any:
+            for chunk in self._chunks:
+                yield chunk
+
+        return generate()
+
+
 def test_init(openai_unit_test_env: dict[str, str]) -> None:
     # Test successful initialization
     open_ai_chat_completion = OpenAIChatCompletionClient()
@@ -2196,6 +2218,113 @@ async def test_streaming_exception_handling(
             pass
 
 
+def _make_content_chunk(text: str) -> Any:
+    from openai.types.chat.chat_completion_chunk import ChatCompletionChunk
+
+    return ChatCompletionChunk.model_validate({
+        "object": "chat.completion.chunk",
+        "created": 1234567890,
+        "model": "test-model",
+        "id": "stream-close",
+        "choices": [
+            {
+                "index": 0,
+                "delta": {"role": "assistant", "content": text},
+                "finish_reason": None,
+            }
+        ],
+    })
+
+
+async def test_streaming_closes_provider_stream_when_consumer_stops_early(
+    openai_unit_test_env: dict[str, str],
+) -> None:
+    """An early consumer exit must close the SDK stream, not leave it to GC (#8762)."""
+    client = OpenAIChatCompletionClient()
+    sdk_stream = _FakeAsyncStream([_make_content_chunk("hello"), _make_content_chunk("world")])
+
+    async def create(**kwargs: Any) -> Any:
+        return sdk_stream
+
+    with patch.object(client.client.chat.completions, "create", side_effect=create):
+        stream = client._inner_get_response(messages=[Message(role="user", contents=["test"])], stream=True, options={})
+        assert isinstance(stream, ResponseStream)
+        # No manual close(): the async-with protocol is what an early break
+        # relies on to release the provider stream.
+        async with stream:
+            async for _ in stream:
+                break
+
+    assert sdk_stream.closed
+
+
+async def test_streaming_closes_provider_stream_when_transform_hook_raises(
+    openai_unit_test_env: dict[str, str],
+) -> None:
+    """A hook failing after a yielded update must also close the SDK stream (#8762)."""
+    client = OpenAIChatCompletionClient()
+    sdk_stream = _FakeAsyncStream([_make_content_chunk("hello"), _make_content_chunk("world")])
+
+    async def create(**kwargs: Any) -> Any:
+        return sdk_stream
+
+    def failing_hook(update: Any) -> Any:
+        raise RuntimeError("hook blew up")
+
+    with patch.object(client.client.chat.completions, "create", side_effect=create):
+        stream = client._inner_get_response(messages=[Message(role="user", contents=["test"])], stream=True, options={})
+        assert isinstance(stream, ResponseStream)
+        stream._transform_hooks.append(failing_hook)
+        with pytest.raises(RuntimeError, match="hook blew up"):
+            async for _ in stream:
+                pass
+
+    assert sdk_stream.closed
+
+
+async def test_streaming_closes_provider_stream_on_cancellation(
+    openai_unit_test_env: dict[str, str],
+) -> None:
+    """Cancellation after a yielded update must close the SDK stream too (#8762)."""
+    client = OpenAIChatCompletionClient()
+    sdk_stream = _FakeAsyncStream([_make_content_chunk("hello"), _make_content_chunk("world")])
+
+    async def create(**kwargs: Any) -> Any:
+        return sdk_stream
+
+    async def cancelling_hook(update: Any) -> Any:
+        raise asyncio.CancelledError
+
+    with patch.object(client.client.chat.completions, "create", side_effect=create):
+        stream = client._inner_get_response(messages=[Message(role="user", contents=["test"])], stream=True, options={})
+        assert isinstance(stream, ResponseStream)
+        stream._transform_hooks.append(cancelling_hook)
+        with pytest.raises(asyncio.CancelledError):
+            async for _ in stream:
+                pass
+
+    assert sdk_stream.closed
+
+
+async def test_streaming_closes_provider_stream_on_completion(
+    openai_unit_test_env: dict[str, str],
+) -> None:
+    """Full consumption closes the SDK stream too, not just early exits."""
+    client = OpenAIChatCompletionClient()
+    sdk_stream = _FakeAsyncStream([_make_content_chunk("done")])
+
+    async def create(**kwargs: Any) -> Any:
+        return sdk_stream
+
+    with patch.object(client.client.chat.completions, "create", side_effect=create):
+        stream = client._inner_get_response(messages=[Message(role="user", contents=["test"])], stream=True, options={})
+    
```

---

### Incident Patch 10: `098fca4d` (2026-10-02)
**Commit Message**: Python: Fix functional workflow replay identity (#8887)

* Python: fix functional workflow replay identity

* Python: address replay concurrency feedback

* Python: harden replay identity edge cases

* Python: fix replay test typing

* Python: finalize replay durability checks

* Python: close replay durability gaps

* Python: scope replay compatibility to workflows

**File**: `python/packages/core/agent_framework/_workflows/_functional.py` (modified, +739/-87)
```diff
@@ -39,14 +39,19 @@
 # pyright: reportPrivateUsage=false
 # Classes in this module (RunContext, StepWrapper, FunctionalWorkflow) form a
 # cohesive unit and intentionally access each other's underscore-prefixed members.
+import asyncio
+import dis
 import functools
 import hashlib
 import inspect
+import json
 import logging
+import math
 import typing
-from collections.abc import AsyncIterable, Awaitable, Callable, Sequence
-from contextvars import ContextVar
+from collections.abc import AsyncIterable, Awaitable, Callable, Iterable, Mapping, Sequence
+from contextvars import Context, ContextVar
 from copy import deepcopy
+from types import CodeType
 from typing import Any, Generic, Literal, TypeVar, overload
 
 from .._agents import BaseAgent
@@ -72,9 +77,337 @@
 
 R = TypeVar("R")
 
+_STEP_CACHE_KEY_V2_PREFIX = "v2::"
+_UNSUPPORTED_STEP_IDENTITY = object()
+
 # ContextVar holding the active RunContext during workflow execution.
 # ContextVar is per-asyncio-Task, so concurrent workflows each get their own context.
 _active_run_ctx: ContextVar[RunContext | None] = ContextVar("_active_run_ctx", default=None)
+_workflow_task_factory_states: dict[asyncio.AbstractEventLoop, _WorkflowTaskFactoryState] = {}
+
+
+class _WorkflowTaskFactoryState:
+    """Delegate a loop task factory while recording tasks created by active workflows."""
+
+    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
+        self.loop = loop
+        self.original_factory = loop.get_task_factory()
+        self.active_runs = 0
+        self.factory = self._create_task
+
+    def _create_task(
+        self,
+        loop: asyncio.AbstractEventLoop,
+        coro: Any,
+        **kwargs: Any,
+    ) -> asyncio.Future[Any]:
+        if self.original_factory is None:
+            task = asyncio.Task(coro, loop=loop, **kwargs)
+        else:
+            task = self.original_factory(loop, coro, **kwargs)
+
+        task_context = kwargs.get("context")
+        ctx = task_context.get(_active_run_ctx) if isinstance(task_context, Context) else _active_run_ctx.get()
+        if ctx is not None:
+            ctx._workflow_tasks.add(task)
+        return task
+
+
+def _track_workflow_tasks() -> Callable[[], None]:
+    loop = asyncio.get_running_loop()
+    state = _workflow_task_factory_states.get(loop)
+    if state is None or loop.get_task_factory() is not state.factory:
+        state = _WorkflowTaskFactoryState(loop)
+        _workflow_task_factory_states[loop] = state
+        loop.set_task_factory(state.factory)
+    state.active_runs += 1
+    released = False
+
+    def _release() -> None:
+        nonlocal released
+        if released:
+            return
+        released = True
+        state.active_runs -= 1
+        if state.active_runs == 0:
+            if loop.get_task_factory() is state.factory:
+                loop.set_task_factory(state.original_factory)
+            if _workflow_task_factory_states.get(loop) is state:
+                del _workflow_task_factory_states[loop]
+
+    return _release
+
+
+def _canonicalize_step_identity_value(value: Any, seen: set[int] | None = None) -> Any:
+    """Return a type-preserving JSON value, or a sentinel for unsupported input."""
+    if seen is None:
+        seen = set()
+    if value is None:
+        return ["none"]
+    if type(value) is bool:
+        return ["bool", value]
+    if type(value) is int:
+        return ["int", value]
+    if type(value) is float:
+        if not math.isfinite(value):
+            return _UNSUPPORTED_STEP_IDENTITY
+        return ["float", value.hex()]
+    if type(value) is complex:
+        if not math.isfinite(value.real) or not math.isfinite(value.imag):
+            return _UNSUPPORTED_STEP_IDENTITY
+        return ["complex", value.real.hex(), value.imag.hex()]
+    if type(value) is str:
+        return ["str", value]
+    if type(value) is bytes:
+        return ["bytes", value.hex()]
+    if type(value) is list:
+        list_value = typing.cast(list[Any], value)
+        value_id = id(list_value)
+        if value_id in seen:
+            return _UNSUPPORTED_STEP_IDENTITY
+        seen.add(value_id)
+        list_items: list[Any] = []
+        try:
+            for item in list_value:
+                canonical = _canonicalize_step_identity_value(item, seen)
+                if canonical is _UNSUPPORTED_STEP_IDENTITY:
+                    return _UNSUPPORTED_STEP_IDENTITY
+                list_items.append(canonical)
+            return ["list", list_items]
+        finally:
+            seen.remove(value_id)
+    if type(value) is tuple:
+        tuple_value = typing.cast(tuple[Any, ...], value)
+        value_id = id(tuple_value)
+        if value_id in seen:
+            return _UNSUPPORTED_STEP_IDENTITY
+        seen.add(value_id)
+        tuple_items: list[Any] = []
+        try:
+            for item in tuple_value:
+                canonical = _canonicalize_step_identity_value(item, seen)
+                if canonical is 
```

**File**: `python/packages/core/tests/workflow/test_functional_workflow.py` (modified, +1107/-13)
```diff
@@ -11,7 +11,8 @@
 from collections.abc import Awaitable, Callable, Iterator
 from contextlib import contextmanager
 from dataclasses import dataclass
-from typing import Any, overload
+from types import FunctionType
+from typing import Any, cast, overload
 
 import pytest
 
@@ -35,9 +36,10 @@
     step,
     workflow,
 )
-from agent_framework._workflows._functional import (
-    RunContext as _RunContext,
-)
+from agent_framework._workflows._functional import RunContext as _RunContext
+from agent_framework._workflows._functional import _get_step_wrapper_identity
+
+_factory_step_calls: list[str] = []
 
 # ---------------------------------------------------------------------------
 # Helpers
@@ -757,7 +759,7 @@ async def test_checkpoint_restore_replays_cached_tasks(self):
         storage = InMemoryCheckpointStorage()
         call_count = 0
 
-        @step
+        @step(replay_key=lambda x: str(x))
         async def counting_task(x: int) -> int:
             nonlocal call_count
             call_count += 1
@@ -838,13 +840,13 @@ async def test_per_step_checkpoint_enables_crash_recovery(self):
         step1_calls = 0
         step2_calls = 0
 
-        @step
+        @step(replay_key=lambda x: str(x))
         async def slow_step1(x: int) -> int:
             nonlocal step1_calls
             step1_calls += 1
             return x + 10
 
-        @step
+        @step(replay_key=lambda x: str(x))
         async def crashing_step2(x: int) -> int:
             nonlocal step2_calls
             step2_calls += 1
@@ -929,6 +931,987 @@ async def wf(x: int) -> int:
         assert len(checkpoints) == 3  # 2 from first run + 1 final from restore
 
 
+# ---------------------------------------------------------------------------
+# Step replay identity
+# ---------------------------------------------------------------------------
+
+
+class TestStepReplayIdentity:
+    async def test_checkpoint_restore_preserves_concurrent_step_invocations(self):
+        storage = InMemoryCheckpointStorage()
+        predecessor_started = asyncio.Event()
+        release_predecessor = asyncio.Event()
+        branch_a_shared_completed = asyncio.Event()
+        calls: list[str] = []
+
+        @step(replay_key=lambda value: f"predecessor:{value}")
+        async def predecessor(value: str) -> str:
+            predecessor_started.set()
+            await release_predecessor.wait()
+            return value
+
+        @step(replay_key=lambda value: value)
+        async def shared_step(value: str) -> str:
+            calls.append(value)
+            if value == "B":
+                release_predecessor.set()
+                await branch_a_shared_completed.wait()
+            else:
+                branch_a_shared_completed.set()
+            return f"result:{value}"
+
+        async def branch_a() -> str:
+            await predecessor("A")
+            return await shared_step("A")
+
+        async def branch_b() -> str:
+            await predecessor_started.wait()
+            return await shared_step("B")
+
+        @built_workflow(checkpoint_storage=storage)
+        async def parallel_workflow(_: str) -> list[str]:
+            return list(await asyncio.gather(branch_a(), branch_b()))
+
+        initial = await parallel_workflow.run("input")
+        checkpoints = await storage.list_checkpoints(workflow_name="parallel_workflow")
+        checkpoint = checkpoints[-1]
+
+        replayed = await parallel_workflow.run(checkpoint_id=checkpoint.checkpoint_id)
+
+        assert initial.get_outputs() == [["result:A", "result:B"]]
+        assert replayed.get_outputs() == initial.get_outputs()
+        assert calls == ["B", "A"]
+
+    async def test_same_named_wrappers_keep_distinct_concurrent_identities(self):
+        storage = InMemoryCheckpointStorage()
+        predecessor_started = asyncio.Event()
+        release_predecessor = asyncio.Event()
+        read_completed = asyncio.Event()
+        calls: list[str] = []
+
+        @step(replay_key=lambda value: f"predecessor:{value}")
+        async def predecessor(value: str) -> str:
+            predecessor_started.set()
+            await release_predecessor.wait()
+            return value
+
+        @step(name="authorization", replay_key=lambda value: f"read:{value}")
+        async def read_check(value: str) -> str:
+            calls.append("read")
+            read_completed.set()
+            return f"read:{value}"
+
+        @step(name="authorization", replay_key=lambda value: f"delete:{value}")
+        async def delete_check(value: str) -> str:
+            calls.append("delete")
+            release_predecessor.set()
+            await read_completed.wait()
+            return f"delete:{value}"
+
+        async def branch_a() -> str:
+            await predecessor("same")
+            return await read_check("same")
+
+        async def branch_b() -> str:
+            await predecessor_started.wait()
+            return await delete_check("same")
+
+        @built_wo
```

**File**: `python/samples/03-workflows/functional/parallel_pipeline.py` (modified, +3/-1)
```diff
@@ -47,7 +47,9 @@ async def research_pipeline(topic: str) -> str:
     #
     # Tip: if any of these were wrapped with @step (e.g. an expensive agent call),
     # the pattern is identical — @step composes with asyncio.gather, so each
-    # branch is independently cached on HITL resume or checkpoint restore.
+    # branch is independently cached by its arguments on HITL resume or checkpoint
+    # restore. Use replay_key when arguments are opaque or do not uniquely identify
+    # non-interchangeable concurrent calls to the same step.
     web, papers, news = await asyncio.gather(
         research_web(topic),
         research_papers(topic),
```

---

### Incident Patch 11: `ef9084c8` (2026-10-02)
**Commit Message**: Python: preserve Responses API citations through AG-UI (#8948)

* Python: preserve Responses citations in AG-UI

* Python: address AG-UI citation review feedback

**File**: `python/packages/ag-ui/AGENTS.md` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ AG-UI protocol integration for building agent UIs with the AG-UI standard.
 
 - Outbound custom events are emitted as AG-UI `CUSTOM`.
 - Usage metadata from `Content(type="usage")` is surfaced as `CUSTOM` events with `name="usage"`.
+- Text annotations are surfaced as `CUSTOM` events with `name="annotations"` and
+  `value={"messageId": ..., "annotations": [...]}`. Annotation-only updates announce a text message if needed
+  without emitting empty text deltas. Provider `raw_representation` is omitted; `AGUIChatClient` restores the
+  annotations on text content. These live custom events are not replayed by `MESSAGES_SNAPSHOT`.
 - Inbound custom event aliases are accepted: `CUSTOM`, `CUSTOM_EVENT`, and `custom_event`.
 - Multimodal user inputs support both legacy (`text`, `binary`) and draft-style (`image`, `audio`, `video`, `document`) shapes.
 - Interrupted runs complete with `RUN_FINISHED.outcome.type == "interrupt"` and canonical `outcome.interrupts`; do not document or add new flows that depend on the legacy top-level `RUN_FINISHED.interrupt` field.
```

**File**: `python/packages/ag-ui/README.md` (modified, +36/-0)
```diff
@@ -119,6 +119,42 @@ and response-cookie handling, and must be closed by the caller. Scope a cookie-b
 client to a single authenticated principal; do not share it across users. AG-UI thread IDs
 are correlation identifiers, not authentication boundaries.
 
+## Citations and annotations
+
+Text content carrying `Content.annotations` emits a message-linked `CUSTOM` event named `annotations`.
+This includes annotation-only updates received after the response text, such as SharePoint grounding
+citations from the Responses API. The event arrives before `RUN_FINISHED` and does not repeat response text:
+
+```json
+{
+  "type": "CUSTOM",
+  "name": "annotations",
+  "value": {
+    "messageId": "assistant-message-id",
+    "annotations": [
+      {
+        "type": "citation",
+        "title": "Document",
+        "url": "https://example.sharepoint.com/document.pdf",
+        "annotated_regions": [
+          {"type": "text_span", "start_index": 0, "end_index": 6}
+        ]
+      }
+    ]
+  }
+}
+```
+
+Each event contains a batch of newly emitted annotations for the indicated text message. Frontends can
+append those annotations to that message and use the citation URL, title, or file ID to render sources.
+Framework annotation fields and additional properties are retained, but provider `raw_representation`
+objects are omitted.
+
+`AGUIChatClient` restores these batches as `Content.annotations` in streaming updates and aggregated
+responses, while retaining the custom-event payload in `update.additional_properties["ag_ui_custom_event"]`.
+Custom events are live run metadata: citation rendering and persistence alongside frontend message history
+remain application responsibilities; `MESSAGES_SNAPSHOT` does not restore these custom events.
+
 ## Tool Return Helpers
 
 Use `state_update` when a backend tool needs to send different payloads to the model, the UI, and shared state. The `text` value remains the LLM-bound tool result, `tool_result` becomes the AG-UI `ToolCallResultEvent.content` for frontend rendering, and `state` is merged into durable shared state.
```

**File**: `python/packages/ag-ui/agent_framework_ag_ui/_client.py` (modified, +7/-5)
```diff
@@ -30,7 +30,7 @@
 from agent_framework._tools import FunctionInvocationConfiguration, FunctionInvocationLayer
 from agent_framework.observability import ChatTelemetryLayer
 
-from ._event_converters import AGUIEventConverter
+from ._event_converters import AGUIEventConverter, _finalize_agui_response
 from ._feature_usage import FeatureIndex
 from ._http_service import AGUIHttpService, _serialize_available_interrupts, _serialize_resume
 from ._message_adapters import agent_framework_messages_to_agui
@@ -430,17 +430,19 @@ def _inner_get_response(
                     options=options,
                     **kwargs,
                 ),
-                finalizer=ChatResponse.from_updates,
+                finalizer=_finalize_agui_response,
             )
 
         async def _get_response() -> ChatResponse:
-            return await ChatResponse.from_update_generator(
-                self._streaming_impl(
+            updates = [
+                update
+                async for update in self._streaming_impl(
                     messages=messages,
                     options=options,
                     **kwargs,
                 )
-            )
+            ]
+            return _finalize_agui_response(updates)
 
         return _get_response()
 
```

**File**: `python/packages/ag-ui/agent_framework_ag_ui/_event_converters.py` (modified, +79/-3)
```diff
@@ -5,16 +5,76 @@
 from __future__ import annotations
 
 import logging
-from typing import Any
+from collections.abc import Sequence
+from typing import Any, cast
 
 from agent_framework import (
+    Annotation,
+    ChatResponse,
     ChatResponseUpdate,
     Content,
+    Message,
 )
 
 logger = logging.getLogger(__name__)
 
 
+def _annotation_batch_from_update(update: ChatResponseUpdate) -> tuple[str, list[Annotation]] | None:
+    """Extract a message-linked annotation batch produced by this converter."""
+    custom_event = (update.additional_properties or {}).get("ag_ui_custom_event")
+    if not isinstance(custom_event, dict) or custom_event.get("name") != "annotations" or not update.message_id:
+        return None
+    annotations = [
+        annotation for content in update.contents if content.type == "text" for annotation in content.annotations or []
+    ]
+    return update.message_id, annotations
+
+
+def _finalize_agui_response(updates: Sequence[ChatResponseUpdate]) -> ChatResponse:
+    """Aggregate AG-UI updates while attaching annotation events by message ID."""
+    annotation_batches: list[tuple[str, list[Annotation]]] = []
+    aggregatable_updates: list[ChatResponseUpdate] = []
+    for update in updates:
+        annotation_batch = _annotation_batch_from_update(update)
+        if annotation_batch is None:
+            aggregatable_updates.append(update)
+        else:
+            annotation_batches.append(annotation_batch)
+
+    response = ChatResponse.from_updates(aggregatable_updates)
+
+    # Annotation events are excluded from message aggregation, but their response metadata
+    # and raw representations retain their original stream ordering.
+    response.additional_properties.clear()
+    for update in updates:
+        if update.additional_properties:
+            response.additional_properties.update(update.additional_properties)
+    if updates:
+        response.raw_representation = [update.raw_representation for update in updates]
+        response.continuation_token = updates[-1].continuation_token
+
+    for message_id, batch_annotations in annotation_batches:
+        if not batch_annotations:
+            continue
+        message = next((message for message in response.messages if message.message_id == message_id), None)
+        if message is None:
+            response.messages.append(
+                Message(
+                    role="assistant",
+                    contents=[Content.from_text(text="", annotations=batch_annotations)],
+                    message_id=message_id,
+                )
+            )
+            continue
+        text_content = next((content for content in message.contents if content.type == "text"), None)
+        if text_content is None:
+            message.contents.append(Content.from_text(text="", annotations=batch_annotations))
+        else:
+            text_content.annotations = [*(text_content.annotations or []), *batch_annotations]
+
+    return response
+
+
 class AGUIEventConverter:
     """Converter for AG-UI events to Agent Framework types.
 
@@ -261,9 +321,9 @@ def _handle_run_error(self, event: dict[str, Any]) -> ChatResponseUpdate:
     def _handle_custom_event(self, event: dict[str, Any], raw_event_type: str) -> ChatResponseUpdate:
         """Handle CUSTOM/CUSTOM_EVENT events.
 
-        Custom events are surfaced as metadata so callers can inspect protocol-specific payloads.
+        Custom events remain inspectable as metadata; annotation batches also restore text annotations.
         """
-        return ChatResponseUpdate(
+        update = ChatResponseUpdate(
             role="assistant",
             contents=[],
             additional_properties={
@@ -276,3 +336,19 @@ def _handle_custom_event(self, event: dict[str, Any], raw_event_type: str) -> Ch
                 },
             },
         )
+        if event.get("name") == "annotations":
+            value = event.get("value")
+            message_id = value.get("messageId") if isinstance(value, dict) else None
+            annotations = value.get("annotations") if isinstance(value, dict) else None
+            if (
+                not isinstance(message_id, str)
+                or not message_id
+                or not isinstance(annotations, list)
+                or not all(isinstance(annotation, dict) for annotation in annotations)
+            ):
+                logger.warning("Invalid annotations custom event: expected messageId and an annotations array")
+            else:
+                update.message_id = message_id
+                if annotations:
+                    update.contents = [Content.from_text(text="", annotations=cast("list[Annotation]", annotations))]
+        return update
```

**File**: `python/packages/ag-ui/agent_framework_ag_ui/_run_common.py` (modified, +59/-5)
```diff
@@ -609,15 +609,35 @@ def _track_reasoning_segment(flow: FlowState, message_id: str) -> None:
     flow.snapshot_segments.append({"kind": "reasoning", "id": message_id})
 
 
+def _offset_annotation_text_spans(annotations: list[dict[str, Any]], offset: int) -> None:
+    """Rebase text spans from a delta to the accumulated message."""
+    if offset == 0:
+        return
+    for annotation in annotations:
+        regions = annotation.get("annotated_regions")
+        if not isinstance(regions, list):
+            continue
+        for region in regions:
+            if not isinstance(region, dict) or region.get("type") != "text_span":
+                continue
+            start_index = region.get("start_index")
+            end_index = region.get("end_index")
+            if isinstance(start_index, int):
+                region["start_index"] = start_index + offset
+            if isinstance(end_index, int):
+                region["end_index"] = end_index + offset
+
+
 def _emit_text(content: Content, flow: FlowState, skip_text: bool = False) -> list[BaseEvent]:
-    """Emit TextMessage events for TextContent."""
-    if not content.text:
+    """Emit text deltas and message-linked annotation batches."""
+    if not content.text and not content.annotations:
         return []
 
     if skip_text or flow.waiting_for_approval:
         return []
 
     events: list[BaseEvent] = []
+    duplicate_text = False
     if not flow.message_id:
         flow.message_id = generate_event_id()
         flow.accumulated_text = ""
@@ -626,7 +646,9 @@ def _emit_text(content: Content, flow: FlowState, skip_text: bool = False) -> li
     elif flow.accumulated_text and content.text == flow.accumulated_text:
         # Guard against full-message replay chunks that can appear after streaming deltas.
         logger.debug("Skipping duplicate full-text delta for message_id=%s", flow.message_id)
-        return []
+        if not content.annotations:
+            return []
+        duplicate_text = True
 
     # A tool-only response may pre-open a message before its tool-call segment
     # is tracked. If that segment claims the pre-opened ID, rotate to a fresh
@@ -648,9 +670,41 @@ def _emit_text(content: Content, flow: FlowState, skip_text: bool = False) -> li
     if segment is None:
         segment = _open_text_segment(flow, flow.message_id)
 
-    events.append(TextMessageContentEvent(message_id=flow.message_id, delta=content.text))
-    flow.accumulated_text += content.text
+    annotation_offset = len(flow.accumulated_text)
+    if content.text and not duplicate_text:
+        events.append(TextMessageContentEvent(message_id=flow.message_id, delta=content.text))
+        flow.accumulated_text += content.text
     segment["text"] = flow.accumulated_text
+    if content.annotations:
+        annotations = cast(
+            "list[dict[str, Any]]",
+            make_json_safe(
+                [
+                    {key: value for key, value in annotation.items() if key != "raw_representation"}
+                    for annotation in content.annotations
+                ]
+            ),
+        )
+        if content.text and not duplicate_text:
+            _offset_annotation_text_spans(annotations, annotation_offset)
+        new_annotations = annotations
+        if duplicate_text:
+            # Reconcile replay by occurrence count, not source URL or dictionary uniqueness.
+            remaining_annotations = list(segment.get("annotations", []))
+            new_annotations = []
+            for annotation in annotations:
+                if annotation in remaining_annotations:
+                    remaining_annotations.remove(annotation)
+                else:
+                    new_annotations.append(annotation)
+        if new_annotations:
+            segment.setdefault("annotations", []).extend(new_annotations)
+            events.append(
+                CustomEvent(
+                    name="annotations",
+                    value={"messageId": flow.message_id, "annotations": new_annotations},
+                )
+            )
     return events
 
 
```

**File**: `python/packages/ag-ui/tests/ag_ui/test_event_converters.py` (modified, +90/-1)
```diff
@@ -8,7 +8,7 @@
 import pytest
 from agent_framework import ChatResponse
 
-from agent_framework_ag_ui._event_converters import AGUIEventConverter
+from agent_framework_ag_ui._event_converters import AGUIEventConverter, _finalize_agui_response
 
 
 class TestAGUIEventConverter:
@@ -391,6 +391,95 @@ def test_custom_event_alias_conversion(self) -> None:
         assert updates[0].additional_properties["ag_ui_custom_event"]["raw_type"] == "CUSTOM_EVENT"
         assert updates[1].additional_properties["ag_ui_custom_event"]["raw_type"] == "custom_event"
 
+    @pytest.mark.parametrize("event_type", ["CUSTOM", "CUSTOM_EVENT", "custom_event"])
+    def test_annotations_custom_event_restores_content(self, event_type: str) -> None:
+        """Annotation custom events preserve their explicit message correlation and metadata."""
+        converter = AGUIEventConverter()
+        converter.current_message_id = "another-message"
+        annotations = [
+            {
+                "type": "citation",
+                "title": "Document",
+                "url": "https://example.sharepoint.com/document.pdf",
+                "annotated_regions": [{"type": "text_span", "start_index": 0, "end_index": 6}],
+            }
+        ]
+        event = {
+            "type": event_type,
+            "name": "annotations",
+            "value": {"messageId": "msg_citations", "annotations": annotations},
+        }
+
+        update = converter.convert_event(event)
+
+        assert update is not None
+        assert update.message_id == "msg_citations"
+        assert len(update.contents) == 1
+        assert update.contents[0].type == "text"
+        assert update.contents[0].text == ""
+        assert update.contents[0].annotations == annotations
+        assert update.additional_properties is not None
+        assert update.additional_properties["ag_ui_custom_event"]["value"] == event["value"]
+
+    def test_annotation_finalizer_targets_an_existing_message_after_later_events(self) -> None:
+        """Late annotations attach by message ID without creating a duplicate message."""
+        converter = AGUIEventConverter()
+        annotations = [
+            {
+                "type": "citation",
+                "url": "https://example.com/first",
+                "annotated_regions": [{"type": "text_span", "start_index": 0, "end_index": 5}],
+            }
+        ]
+        events: list[dict[str, Any]] = [
+            {"type": "TEXT_MESSAGE_START", "messageId": "m1"},
+            {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "First"},
+            {"type": "TEXT_MESSAGE_START", "messageId": "m2"},
+            {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m2", "delta": "Second"},
+            {"type": "TOOL_CALL_RESULT", "toolCallId": "call-1", "result": "done"},
+            {
+                "type": "CUSTOM",
+                "name": "annotations",
+                "value": {"messageId": "m1", "annotations": annotations},
+            },
+        ]
+        updates = [update for event in events if (update := converter.convert_event(event)) is not None]
+
+        response = _finalize_agui_response(updates)
+
+        assert [message.message_id for message in response.messages].count("m1") == 1
+        first_message = next(message for message in response.messages if message.message_id == "m1")
+        first_text = next(content for content in first_message.contents if content.type == "text")
+        assert first_text.text == "First"
+        assert first_text.annotations == annotations
+        assert [message.message_id for message in response.messages].count(None) == 1
+
+    @pytest.mark.parametrize(
+        "value",
+        [
+            None,
+            {"annotations": []},
+            {"messageId": 123, "annotations": []},
+            {"messageId": "msg_citations", "annotations": "invalid"},
+            {"messageId": "msg_citations", "annotations": ["invalid"]},
+        ],
+    )
+    def test_malformed_annotations_custom_event_preserves_metadata(
+        self, value: Any, caplog: pytest.LogCaptureFixture
+    ) -> None:
+        """Malformed known custom events remain observable and log an explicit warning."""
+        converter = AGUIEventConverter()
+        event = {"type": "CUSTOM", "name": "annotations", "value": value}
+
+        with caplog.at_level(logging.WARNING):
+            update = converter.convert_event(event)
+
+        assert update is not None
+        assert update.contents == []
+        assert update.additional_properties is not None
+        assert update.additional_properties["ag_ui_custom_event"]["value"] == value
+        assert "annotations" in caplog.text
+
     def test_full_conversation_flow(self) -> None:
         """Test complete conversation flow with multiple event types."""
         converter = AGUIEventConverter()
```

**File**: `python/packages/ag-ui/tests/ag_ui/test_run.py` (modified, +200/-1)
```diff
@@ -21,7 +21,15 @@
     ToolCallArgsEvent,
     ToolCallStartEvent,
 )
-from agent_framework import AgentResponse, AgentResponseUpdate, Content, Message, ResponseStream
+from agent_framework import (
+    AgentResponse,
+    AgentResponseUpdate,
+    Annotation,
+    ChatResponse,
+    Content,
+    Message,
+    ResponseStream,
+)
 from agent_framework.exceptions import AgentInvalidResponseException, ResponseInvalidatedException
 from conftest import StubAgent  # pyrefly: ignore[missing-import] # pyright: ignore[reportMissingImports]
 
@@ -45,6 +53,7 @@
     ResumeDecision,
 )
 from agent_framework_ag_ui._approval_state import InMemoryAGUIApprovalStateStore, approval_state_thread_id
+from agent_framework_ag_ui._event_converters import AGUIEventConverter
 from agent_framework_ag_ui._run_common import (
     FlowState,
     _build_run_finished_event,
@@ -631,6 +640,196 @@ def test_emit_text_skips_when_waiting_for_approval():
     assert len(events) == 0
 
 
+def test_emit_text_annotations_are_json_safe_and_message_linked() -> None:
+    """Portable citations reach AG-UI without serializing provider raw objects."""
+    flow = FlowState()
+    annotation = Annotation(
+        type="citation",
+        title="Document",
+        url="https://example.sharepoint.com/document.pdf",
+        annotated_regions=[{"type": "text_span", "start_index": 0, "end_index": 6}],
+        raw_representation=object(),
+    )
+    content = Content.from_text("Answer", annotations=[annotation])
+
+    events = _emit_content(content, flow)
+
+    assert len(events) == 3
+    start, text, citations = events
+    assert isinstance(start, TextMessageStartEvent)
+    assert isinstance(text, TextMessageContentEvent)
+    assert isinstance(citations, CustomEvent)
+    assert citations.name == "annotations"
+    assert citations.value == {
+        "messageId": start.message_id,
+        "annotations": [{key: value for key, value in annotation.items() if key != "raw_representation"}],
+    }
+    assert text.message_id == start.message_id
+    assert "raw_representation" not in citations.model_dump_json(by_alias=True)
+    assert content.annotations is not None
+    assert annotation["raw_representation"] is content.annotations[0]["raw_representation"]
+
+
+def test_emit_text_rebases_delta_annotation_spans_and_deduplicates_full_replay() -> None:
+    """Chunk-relative spans become message-relative and match completed replay spans."""
+    flow = FlowState()
+    annotation = Annotation(
+        type="citation",
+        url="https://example.com/target",
+        annotated_regions=[{"type": "text_span", "start_index": 0, "end_index": 6}],
+    )
+    _emit_text(Content.from_text("Prefix "), flow)
+
+    events = _emit_text(Content.from_text("target", annotations=[annotation]), flow)
+    replay_events = _emit_text(
+        Content.from_text(
+            "Prefix target",
+            annotations=[
+                Annotation(
+                    type="citation",
+                    url="https://example.com/target",
+                    annotated_regions=[{"type": "text_span", "start_index": 7, "end_index": 13}],
+                )
+            ],
+        ),
+        flow,
+    )
+
+    citation_event = next(event for event in events if isinstance(event, CustomEvent))
+    assert citation_event.value["annotations"][0]["annotated_regions"] == [
+        {"type": "text_span", "start_index": 7, "end_index": 13}
+    ]
+    assert annotation["annotated_regions"] == [{"type": "text_span", "start_index": 0, "end_index": 6}]
+    assert replay_events == []
+
+
+def test_emit_text_preserves_annotation_only_spans() -> None:
+    """Annotation-only updates already use complete-message span indices."""
+    flow = FlowState()
+    annotation = Annotation(
+        type="citation",
+        url="https://example.com/target",
+        annotated_regions=[{"type": "text_span", "start_index": 7, "end_index": 13}],
+    )
+    _emit_text(Content.from_text("Prefix target"), flow)
+
+    events = _emit_text(Content.from_text("", annotations=[annotation]), flow)
+
+    citation_event = next(event for event in events if isinstance(event, CustomEvent))
+    assert citation_event.value["annotations"][0]["annotated_regions"] == annotation["annotated_regions"]
+
+
+def test_emit_text_annotation_only_update_starts_a_message_without_an_empty_delta() -> None:
+    """Citations received before text still reference an announced message."""
+    flow = FlowState()
+    annotation = Annotation(type="citation", url="https://example.com/document")
+
+    events = _emit_text(Content.from_text("", annotations=[annotation]), flow)
+    text_events = _emit_text(Content.from_text("Answer"), flow)
+
+    assert len(events) == 2
+    assert isinstance(events[0], TextMessageStartEvent)
+    assert isinstance(events[1], CustomEvent)
+    assert events[1].value == {"messageId": events[0].message_id, "annotations": [annotation]}
+    assert len(text_events) == 1
+    assert isin
```

**File**: `python/packages/openai/AGENTS.md` (modified, +5/-0)
```diff
@@ -66,6 +66,11 @@ Native Responses and Chat Completions refusals remain ordinary text content with
 the provider's native refusal field without splitting mixed text/refusal turns; non-assistant
 marked text is sent as ordinary input text.
 
+Responses citations remain `Content.annotations`, including annotation-only updates parsed from completed
+text parts and output messages. Streaming deduplication is request-local and keyed by item ID, content index,
+and annotation index, so separate references to the same URL remain distinct. `_parse_chunk_from_openai` retains
+the signature overridden by released Foundry clients.
+
 ## Dependencies
 
 - `agent-framework-core` — core abstractions
```

---

### Incident Patch 12: `68e58bf8` (2026-10-02)
**Commit Message**: build(deps-dev): bump uv in /python/packages/lab in the basics group (#8942)

Bumps the basics group in /python/packages/lab with 1 update: [uv](https://github.com/astral-sh/uv).


Updates `uv` from 0.12.15 to 0.12.18
- [Release notes](https://github.com/astral-sh/uv/releases)
- [Changelog](https://github.com/astral-sh/uv/blob/main/CHANGELOG.md)
- [Commits](https://github.com/astral-sh/uv/compare/0.12.15...0.12.18)

---
updated-dependencies:
- dependency-name: uv
  dependency-version: 0.12.18
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: basics
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `python/packages/lab/pyproject.toml` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ math = [
 [dependency-groups]
 dev = [
     "agent-framework-openai>=1.14.2,<2",
-    "uv==0.12.15",
+    "uv==0.12.18",
     "ruff==0.16.8",
     "pytest==9.1.1",
     "pytest-asyncio==1.4.0",
```

**File**: `python/packages/lab/uv.lock` (modified, +23/-23)
```diff
@@ -150,7 +150,7 @@ dev = [
     { name = "ruff", specifier = "==0.16.8" },
     { name = "tomli", specifier = "==2.4.1" },
     { name = "tomli-w", specifier = "==1.2.0" },
-    { name = "uv", specifier = "==0.12.15" },
+    { name = "uv", specifier = "==0.12.18" },
 ]
 tau2 = [{ name = "tau2", git = "https://github.com/sierra-research/tau2-bench?rev=5ba9e3e56db57c5e4114bf7f901291f09b2c5619" }]
 
@@ -6416,28 +6416,28 @@ wheels = [
 
 [[package]]
 name = "uv"
-version = "0.12.15"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/db/02/15fddc6cae927d0e44dfc107fcd81682ea3864d87a78c168bbdd440fd805/uv-0.12.15.tar.gz", hash = "sha256:5eef1c0d2e0ae26cbe1daa49de855b09dfb63a45eaf1fe63dea2827249eadc05", size = 7016185, upload-time = "2026-09-15T12:07:45.915Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/fa/d6/222dcbce2419cf4c198b83e35cd215b796a9cb38cbc0f54dd16bb25f9f98/uv-0.12.15-py3-none-linux_armv6l.whl", hash = "sha256:7a1c9edcd333e7c78f635f000fe50e5aa3b3b8774004f5c66bb034110ce8755c", size = 22189974, upload-time = "2026-09-15T12:07:02.367Z" },
-    { url = "https://files.pythonhosted.org/packages/18/73/b01ea8bbab093efb573fad02bed6d5c00a4ea0edccc4d2faa5303854dbda/uv-0.12.15-py3-none-macosx_10_12_x86_64.whl", hash = "sha256:a1499a507461774f222114732f145d50579e75a3fab0d91ee680c0ed04322552", size = 20490659, upload-time = "2026-09-15T12:07:05.346Z" },
-    { url = "https://files.pythonhosted.org/packages/84/62/82e86e03e111463ab224c132c0f0e6b649d98d22710b177fbc000d379103/uv-0.12.15-py3-none-macosx_11_0_arm64.whl", hash = "sha256:03b2c763f8b3c5595fa103221bc667e3af0146f8cb327aa06630ebcf5cfe16e9", size = 16801224, upload-time = "2026-09-15T12:07:07.611Z" },
-    { url = "https://files.pythonhosted.org/packages/49/1a/eb1f5f38b09f9aa6d31cfc8d29ca919ee3d8368dd6ba01883a1f9dda7259/uv-0.12.15-py3-none-manylinux_2_17_aarch64.manylinux2014_aarch64.musllinux_1_1_aarch64.whl", hash = "sha256:a673bc39e677eaa012f618cab2e6e99fb82919f37ea45043fca530e9ca94c082", size = 21641142, upload-time = "2026-09-15T12:07:10.051Z" },
-    { url = "https://files.pythonhosted.org/packages/51/b5/bc60ba5684abbc823d9e1234f9d51c39fc91f97bd3e84568d4e928e29a1f/uv-0.12.15-py3-none-manylinux_2_17_armv7l.manylinux2014_armv7l.musllinux_1_1_armv7l.whl", hash = "sha256:e6bce690fbfdc443f25f49017fd64f802dea1b93681c27a0c4f6269df00f672a", size = 21690645, upload-time = "2026-09-15T12:07:12.574Z" },
-    { url = "https://files.pythonhosted.org/packages/ba/32/eabcba8202668559fe267cbba5b8fc756edb9fc4a103b559e8bd3f066849/uv-0.12.15-py3-none-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:176533b084f9b5875e7bfa8d4e47ef800683a717d788c584f7ca919c7659383d", size = 21725003, upload-time = "2026-09-15T12:07:14.902Z" },
-    { url = "https://files.pythonhosted.org/packages/1e/6f/6d7b8a04b9e3de3a311a4076407601b3e524998aeba1a1619c81531ba0e4/uv-0.12.15-py3-none-manylinux_2_17_i686.manylinux2014_i686.whl", hash = "sha256:f85bf3f58ad624b3427c6e5d9bf47112016c2366b327c7381e3e9a9485bcae92", size = 22430464, upload-time = "2026-09-15T12:07:17.136Z" },
-    { url = "https://files.pythonhosted.org/packages/1d/10/18bd9f1821c325bd8c8838b1cf9469d7217263c5f818d9ffc4947867d983/uv-0.12.15-py3-none-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:45342637678531fe514c8aa0bda19fd98cc3be4c6d589c7bee99f99b74a89979", size = 23810037, upload-time = "2026-09-15T12:07:19.434Z" },
-    { url = "https://files.pythonhosted.org/packages/8a/8d/6a24d10442dac28718bcabadccd6d5377a17b033615604f202f48b48f278/uv-0.12.15-py3-none-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:f21620417724c3252922e150e9bcc06aeb7288cc8ab1e103b60f01e7d5160cfc", size = 23413401, upload-time = "2026-09-15T12:07:22.029Z" },
-    { url = "https://files.pythonhosted.org/packages/1e/fd/432451d732917c49152a291de3ef171aa6b0f1a22d39780fb2c1f085ca4c/uv-0.12.15-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:aee9802f46bae436bd91751bb33ddeb379ef1596b5c19df193219d545d244b60", size = 20081404, upload-time = "2026-09-15T12:07:24.324Z" },
-    { url = "https://files.pythonhosted.org/packages/e9/3a/52e6f0c159d133b03890b5c54823bdc10163ce6f010515f649e5804b5bba/uv-0.12.15-py3-none-manylinux_2_28_aarch64.whl", hash = "sha256:013e3a5774fb2cc036a9422edc51c8c5273cca011ec04c2817249b8a4a0b0f02", size = 19510133, upload-time = "2026-09-15T12:07:26.737Z" },
-    { url = "https://files.pythonhosted.org/packages/f4/09/cdb9dace249645cdc4a7a33d364df7326faca369132b8ee87da0cf2659f7/uv-0.12.15-py3-none-manylinux_2_31_riscv64.musllinux_1_1_riscv64.whl", hash = "sha256:0e5abf7c998da413823d08fe5c5d40fa9c4c7ae3c65291c360b61eb5ae53ed19", size = 22506249, upload-time = "2026-09-15T12:07:29.24Z" },
-    { url = "https://files.pythonhosted.org/packages/6c/17/c14d402af704d28d86ebc16ba405a52e1d632537d1839170e979f100f8c6/uv-0.12.15-py3-none-manylinux_2_31_riscv64.whl", hash = "sha256:9a3c6540880a8016952a66817e4773c33900a2b8f
```

---

### Incident Patch 13: `f8df81a2` (2026-10-02)
**Commit Message**: build(deps-dev): bump agent-framework-openai in /python/packages/lab (#8945)

Bumps [agent-framework-openai](https://github.com/microsoft/agent-framework) from 1.14.3 to 1.14.4.
- [Release notes](https://github.com/microsoft/agent-framework/releases)
- [Commits](https://github.com/microsoft/agent-framework/commits)

---
updated-dependencies:
- dependency-name: agent-framework-openai
  dependency-version: 1.14.4
  dependency-type: direct:development
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `python/packages/lab/uv.lock` (modified, +7/-6)
```diff
@@ -49,18 +49,19 @@ wheels = [
 
 [[package]]
 name = "agent-framework-core"
-version = "1.18.0"
+version = "1.19.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "msgspec" },
     { name = "opentelemetry-api" },
     { name = "pydantic" },
     { name = "python-dotenv" },
+    { name = "pyyaml" },
     { name = "typing-extensions" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/2e/6e/e0d661f1770bf3a6d70248c5964e684d2bb648b253d53f3dca315f393535/agent_framework_core-1.18.0.tar.gz", hash = "sha256:ef84e1ec570036b81a93a9e924bc4281380f6240ab9bddb8a2db7669282032b0", size = 652594, upload-time = "2026-09-10T09:29:19.938Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/de/4a/7aa2feee4c17864e49d83b368b4740940e00551a035ba12d3bc2678d4c87/agent_framework_core-1.19.0.tar.gz", hash = "sha256:b483482551f56ff465d2633cadbe344791390f03c5f715ec0939e55b865bc86f", size = 703611, upload-time = "2026-09-18T11:00:03.137Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/98/a6/10b844bf70bd174d32635e84a5cffa2ada1df1555266e00fc5c3a402d744/agent_framework_core-1.18.0-py3-none-any.whl", hash = "sha256:75f2fac5eed229c62f0665630cf1478eb45204bde41200a4c94dab57d441cc84", size = 712930, upload-time = "2026-09-10T09:28:54.632Z" },
+    { url = "https://files.pythonhosted.org/packages/22/af/6ed9435277f39373eee1b88f1aff42ea7809d0b520f1932ff59dbf49fd5b/agent_framework_core-1.19.0-py3-none-any.whl", hash = "sha256:c887e6d5380b5ab21731b981f4c3e6b342f211bda20526ab82fa20c34a9bddbd", size = 764283, upload-time = "2026-09-18T10:57:40.824Z" },
 ]
 
 [[package]]
@@ -155,15 +156,15 @@ tau2 = [{ name = "tau2", git = "https://github.com/sierra-research/tau2-bench?re
 
 [[package]]
 name = "agent-framework-openai"
-version = "1.14.3"
+version = "1.14.4"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "agent-framework-core" },
     { name = "openai" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/6d/7c/6ef5b4b2e5fd8ab4750c41edaca6755694a7574e4b884c3cbdffa0a1846a/agent_framework_openai-1.14.3.tar.gz", hash = "sha256:187587bb1026f0989bbfcbb1f94e058103cbfc5066006d4b82d4c00f94469a53", size = 63541, upload-time = "2026-09-10T09:29:28.72Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/76/ac/beca64311d266d356098db8f61c9d1fc424f0be75c51ab4f45c073a409b3/agent_framework_openai-1.14.4.tar.gz", hash = "sha256:b7aebfba75eb1a8bab9b82044eabd404d4fb34c512cb49c7c7d24f213d413fe2", size = 70447, upload-time = "2026-09-18T11:00:15.176Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a2/d0/79a299476fb1584c04c135b0ce9f4a643d3633fd36a40effc8fbdad42da6/agent_framework_openai-1.14.3-py3-none-any.whl", hash = "sha256:b24b19b641531ef09e5cf52d5e5d20ba1be7299477d721e3516fc2da55e7f1ef", size = 68840, upload-time = "2026-09-10T09:29:06.319Z" },
+    { url = "https://files.pythonhosted.org/packages/d2/d8/5d8956a57c3a08f56fc1401cb49de0ce3d289c264eb1033b6f5a9547ac20/agent_framework_openai-1.14.4-py3-none-any.whl", hash = "sha256:a5ee2c0e8c8342bd48a5e99cb92f3133f4472f24adaf896ac0ca9942a16f65f6", size = 75218, upload-time = "2026-09-18T10:57:55.315Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 14: `cb63c2ab` (2026-10-01)
**Commit Message**: Python: fix(openai): route unmarked shell call to registered local executor (#8720)

* Python: fix(openai): route unmarked shell call to registered local executor

When self hosted Foundry agents emit shell call output items, the environment property is omitted rather than explicitly marked local. Because the local environment check required an explicit local type marker, unmarked calls were misclassified as hosted shell items and skipped by the registered executor.

Allow unmarked shell calls to execute via the registered local shell tool when an environment is omitted. Keep explicit non local container environments routed to hosted shell content.

Signed-off-by: Manohar Paturi <[REDACTED_EMAIL]>

* Fix pyright type annotations for local shell environment resolution

Signed-off-by: Manohar Paturi <[REDACTED_EMAIL]>

---------

Signed-off-by: Manohar Paturi <[REDACTED_EMAIL]>
Co-authored-by: Manohar Paturi <[REDACTED_EMAIL]>

**File**: `python/packages/openai/agent_framework_openai/_chat_client.py` (modified, +9/-1)
```diff
@@ -2483,7 +2483,15 @@ def _shell_item_to_contents(self, item: Any, local_shell_tool_name: str | None)
             )
             shell_timeout_ms = getattr(action, "timeout_ms", None)
             shell_max_output = getattr(action, "max_output_length", None)
-            is_local_environment = getattr(getattr(item, "environment", None), "type", None) == "local"
+            item_environment: object = getattr(item, "environment", None)
+            env_type: object = (
+                cast("Mapping[str, object]", item_environment).get("type")
+                if isinstance(item_environment, Mapping)
+                else getattr(item_environment, "type", None)
+            )
+            is_local_environment: bool = bool(
+                env_type == "local" or (item_environment is None and local_shell_tool_name is not None)
+            )
             if (
                 local_shell_tool_name
                 and is_local_environment
```

**File**: `python/packages/openai/tests/openai/test_openai_chat_client.py` (modified, +126/-1)
```diff
@@ -2828,11 +2828,14 @@ def local_exec(command: str) -> str:
     mock_action.timeout_ms = 60000
     mock_action.max_output_length = 4096
 
+    mock_environment = MagicMock()
+    mock_environment.type = "container_reference"
+
     mock_shell_call = MagicMock()
     mock_shell_call.type = "shell_call"
     mock_shell_call.call_id = "shell-call-1"
     mock_shell_call.action = mock_action
-    mock_shell_call.environment = None
+    mock_shell_call.environment = mock_environment
     mock_shell_call.status = "completed"
 
     mock_response.output = [mock_shell_call]
@@ -2849,6 +2852,89 @@ def local_exec(command: str) -> str:
     assert call_content.status == "completed"
 
 
+def test_foundry_shell_call_without_environment_uses_registered_local_executor() -> None:
+    """An unmarked shell call executes locally when a local shell executor is registered."""
+    client = OpenAIChatClient(model="test-model", api_key="test-key")
+
+    def local_exec(command: str) -> str:
+        return command
+
+    local_shell_tool = OpenAIChatClient.get_shell_tool(func=local_exec)
+
+    mock_response = MagicMock()
+    mock_response.output_parsed = None
+    mock_response.metadata = {}
+    mock_response.usage = None
+    mock_response.id = "test-id"
+    mock_response.model = "test-model"
+    mock_response.created_at = 1000000000
+    mock_response.status = "completed"
+    mock_response.incomplete = None
+
+    mock_action = MagicMock()
+    mock_action.commands = ["ls -la", "pwd"]
+    mock_action.timeout_ms = 60000
+    mock_action.max_output_length = 4096
+
+    mock_shell_call = MagicMock()
+    mock_shell_call.type = "shell_call"
+    mock_shell_call.id = "shell-item-1"
+    mock_shell_call.call_id = "shell-call-1"
+    mock_shell_call.action = mock_action
+    mock_shell_call.environment = None
+    mock_shell_call.status = "completed"
+
+    mock_response.output = [mock_shell_call]
+
+    response = client._parse_response_from_openai(mock_response, options={"tools": [local_shell_tool]})  # type: ignore[arg-type]
+
+    assert len(response.messages[0].contents) == 1
+    call_content = response.messages[0].contents[0]
+    assert call_content.type == "function_call"
+    assert call_content.call_id == "shell-call-1"
+    assert call_content.name == local_shell_tool.name
+    assert call_content.parse_arguments() == {"command": "ls -la\npwd"}
+    assert call_content.informational_only is False
+
+
+def test_foundry_shell_call_without_environment_without_local_executor_remains_hosted() -> None:
+    """An unmarked shell call remains hosted informational content when no local executor is registered."""
+    client = OpenAIChatClient(model="test-model", api_key="test-key")
+
+    mock_response = MagicMock()
+    mock_response.output_parsed = None
+    mock_response.metadata = {}
+    mock_response.usage = None
+    mock_response.id = "test-id"
+    mock_response.model = "test-model"
+    mock_response.created_at = 1000000000
+    mock_response.status = "completed"
+    mock_response.incomplete = None
+
+    mock_action = MagicMock()
+    mock_action.commands = ["ls -la", "pwd"]
+    mock_action.timeout_ms = 60000
+    mock_action.max_output_length = 4096
+
+    mock_shell_call = MagicMock()
+    mock_shell_call.type = "shell_call"
+    mock_shell_call.id = "shell-item-1"
+    mock_shell_call.call_id = "shell-call-1"
+    mock_shell_call.action = mock_action
+    mock_shell_call.environment = None
+    mock_shell_call.status = "completed"
+
+    mock_response.output = [mock_shell_call]
+
+    response = client._parse_response_from_openai(mock_response, options={})  # type: ignore[arg-type]
+
+    assert len(response.messages[0].contents) == 1
+    call_content = response.messages[0].contents[0]
+    assert call_content.type == "shell_tool_call"
+    assert call_content.call_id == "shell-call-1"
+    assert call_content.commands == ["ls -la", "pwd"]
+
+
 def test_response_content_creation_with_shell_call_output() -> None:
     """Test _parse_response_from_openai with shell_call_output output."""
     client = OpenAIChatClient(model="test-model", api_key="test-key")
@@ -4243,6 +4329,45 @@ def local_exec(command: str) -> str:
     assert call_content.additional_properties["openai.responses.shell.output_type"] == "shell_call_output"
 
 
+def test_parse_chunk_from_openai_shell_call_without_environment_emits_command() -> None:
+    """An unmarked completed shell call emits an executable function call when local executor is registered."""
+    client = OpenAIChatClient(model="test-model", api_key="test-key")
+
+    def local_exec(command: str) -> str:
+        return command
+
+    local_shell_tool = OpenAIChatClient.get_shell_tool(func=local_exec, approval_mode="never_require")
+    function_call_ids: dict[int, tuple[str, str]] = {}
+
+    mock_action = MagicMock()
+    mock_action.commands = ["python --version"]
+    mock_action.timeout_ms = 30000
+
+    mock_item = MagicMock()
+    mock_item.type = "shell_call"
+    
```

---

### Incident Patch 15: `2f84b141` (2026-10-01)
**Commit Message**: Python: fix(ollama): reject non-image data content instead of sending it as an image (#8917)

**File**: `python/packages/ollama/agent_framework_ollama/_chat_client.py` (modified, +2/-1)
```diff
@@ -500,7 +500,8 @@ def _format_user_message(self, message: Message) -> list[OllamaMessage]:
         user_message = OllamaMessage(role="user", content=message.text)
         data_contents = [c for c in message.contents if c.type == "data"]
         if data_contents:
-            if not any(c.has_top_level_media_type("image") for c in data_contents):
+            # Every data item is sent in `images`, so reject the message if any of them is not an image.
+            if not all(c.has_top_level_media_type("image") for c in data_contents):
                 raise ChatClientInvalidRequestException(
                     "Only image data content is supported for user messages in Ollama."
                 )
```

**File**: `python/packages/ollama/tests/test_ollama_chat_client.py` (modified, +26/-0)
```diff
@@ -655,6 +655,32 @@ async def test_cmc_with_invalid_data_content_media_type(
         await ollama_client.get_response(messages=chat_history)
 
 
+@patch.object(AsyncClient, "chat", new_callable=AsyncMock)
+async def test_cmc_with_image_and_non_image_data_content(
+    mock_chat: AsyncMock,
+    ollama_unit_test_env: dict[str, str],
+    chat_history: list[Message],
+    mock_chat_completion_response: OllamaChatResponse,
+) -> None:
+    mock_chat.return_value = mock_chat_completion_response
+    # An image must not let other data content (here a PDF) be sent to Ollama as an image
+    chat_history.append(
+        Message(
+            contents=[
+                Content.from_uri(uri="data:image/png;base64,xyz", media_type="image/png"),
+                Content.from_uri(uri="data:application/pdf;base64,abc", media_type="application/pdf"),
+            ],
+            role="user",
+        )
+    )
+
+    ollama_client = OllamaChatClient()
+
+    with pytest.raises(ChatClientInvalidRequestException):
+        await ollama_client.get_response(messages=chat_history)
+    mock_chat.assert_not_called()
+
+
 @patch.object(AsyncClient, "chat", new_callable=AsyncMock)
 async def test_cmc_with_invalid_content_type(
     mock_chat: AsyncMock,
```

#### Recent Merged Pull Requests:
- **PR #9065** (closed): .NET: Reject sensitive declarative identifiers (@baywet)
- **PR #9064** (2026-10-05): .NET: test: add loopback destination regression coverage (@baywet)
- **PR #9055** (2026-10-05): Python: Preserve Foundry Toolbox container file citations (@eavanvalkenburg)
- **PR #9043** (2026-10-05): Python: Fix persistent PowerShell sessions dropping table-formatted output (@Aditya-XR)
- **PR #9039** (2026-10-05): build(deps): bump astral-sh/setup-uv from 10.1.0 to 10.2.0 in /.github/actions/python-setup (@dependabot[bot])
- **PR #9038** (2026-10-05): build(deps): bump astral-sh/setup-uv from 10.1.0 to 10.2.0 (@dependabot[bot])
- **PR #9037** (2026-10-05): build(deps): bump the codeql-actions group across 1 directory with 3 updates (@dependabot[bot])
- **PR #9026** (2026-10-05): Python: Reject unknown participants picked by the group chat orchestrator agent (@Shizoqua)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
