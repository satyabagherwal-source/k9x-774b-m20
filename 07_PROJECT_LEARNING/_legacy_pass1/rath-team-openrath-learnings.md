# Forensic Learning Record (Deep Inspection): Rath-Team/OpenRath

> **Canonical Artifact**: `07_PROJECT_LEARNING/rath-team-openrath-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Rath-Team/OpenRath](https://github.com/Rath-Team/OpenRath))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:44:01.759Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Rath-Team/OpenRath`
- **Description**: An open-source, PyTorch-like runtime for dynamic multi-agent and multi-session workflows.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 960 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/rath/_async/aloop.py`
```
"""Async session loop with resource-keyed parallel tool dispatch.

:func:`_arun_session_loop` mirrors :func:`rath.session.loop.run_session_loop`
but does its LLM completions and tool dispatch on the runtime loop, so a
single round of ``tool_calls`` can fan out in parallel when the tools touch
*different* resources.

Tool ordering within a round:

- Each call's :meth:`FlowToolCall.resource_key` produces a key tuple.
- Calls sharing one key form a queue and are awaited serially in the
  original ``tool_calls`` order — this preserves "same path → same order".
- Across distinct keys we ``asyncio.gather`` the queues so independent
  tools overlap. Non-:attr:`parallel_safe` tools default to the
  ``("global",)`` key, falling back to serial behavior identical to the
  sync loop.
- Final transcript rows are written back in the original ``tool_calls``
  order, never in completion order — so a tool that finishes earlier
  doesn't reorder the JSONL.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

from rath._async.awriter import _AsyncSessionWriter
from rath._async.sync_to_async import (
    AsyncChatClientLike,
    ensure_async_chat_client,
)
from rath.flow.tool import (
    FlowToolCall,
    merge_tools_for_loop,
    tools_dict_to_schemas,
)
from rath.llm import (
    Provider,
    RathLLMChatRequest,
    RathLLMChatResponse,
    RathLLMFunctionTool,
    RathLLMMessage,
    RathLLMStreamDelta,
    chat_client_for,
)
from rath.session.chat_request_build import provider_into_chat_request
from rath.session.chunk import (
    ChunkRow,
    ChunkTable,
    assistant_turn_chunk,
    chunk_table_to_messages,
    tool_feedback_chunk,
)
from rath.session.graph import LineageKind, LineageRecorder, SessionLineage
from rath.session.loop import (
    _accumulate_stream_to_response,
    _accumulate_usage_and_check_budget,
    _loop_tool_error_payload,
    _summarize_dispatch_result,
)
from rath.session.manager import session_registry
from rath.session.session import (
    Session,
    _enter_tool_dispatch,
    _exit_tool_dispatch,
)


def _tool_body(tool: FlowToolCall, session: Session, args: Mapping[str, Any]) -> Any:
    """Run ``tool(session, args)`` with the runtime tool-dispatch flag set.

    The flag flips ``Session.chunk_table`` / ``cumulative_usage`` reads into
    "raw" mode, so a tool body inspecting its own session does not deadlock
    on the still-in-flight ``_pending`` future.
    """
    _enter_tool_dispatch()
    try:
        return tool(session, dict(args or {}))
    finally:
        _exit_tool_dispatch()


__all__ = [
    "AsyncSessionLoopExecutor",
    "_arun_session_loop",
]

logger = logging.getLogger(__name__)


@runtime_checkable
class AsyncSessionLoopExecutor(Protocol):
    """Runtime-internal counterpart of :class:`SessionLoopExecutor`."""

    async def acomplete(self, req: RathLLMChatRequest) -> RathLLMChatResponse: ...

    async def adispatch_tool(
        self,
        session: Session,
        tool: FlowToolCall,
        arguments: Mapping[str, Any],
    ) -> Any: ...

    def tool_schemas(self) -> tuple[RathLLMFunctionTool, ...]: ...


class _DefaultAsyncExecutor:
    """Wrap an :class:`AsyncChatClientLike`; dispatch sync tools via ``to_thread``."""

    __slots__ = ("_client", "_on_event")

    def __init__(
        self,
        client: AsyncChatClientLike,
        on_event: Callable[[RathLLMStreamDelta], None] | None = None,
    ) -> None:
        self._client = client
        self._on_event = on_event

    def tool_schemas(self) -> tuple[RathLLMFunctionTool, ...]:
        return ()

    async def acomplete(self, req: RathLLMChatRequest) -> RathLLMChatResponse:
        if self._on_event is None:
            return await self._client.acomplete(req)
        stream_fn = getattr(self._client, "acomplete_stream", None)
        if stream_fn is None:
            raise TypeError(
                "on_event requires an async streaming client; "
                f"{type(self._client).__name__} does not expose acomplete_stream"
            )
        # Drain the async-iter into the existing sync accumulator by buffering
        # — accumulation logic is pure and identical for sync/async deltas.
        deltas: list[RathLLMStreamDelta] = []
        on_event = self._on_event
        async for delta in stream_fn(req):
            on_event(delta)
            deltas.append(delta)
        model = getattr(getattr(self._client, "provider", None), "model", "") or ""
        return _accumulate_stream_to_response(
            iter(deltas),
            on_event=lambda _d: None,
            model=model,
        )

    async def adispatch_tool(
        self,
        session: Session,
        tool: FlowToolCall,
        arguments: Mapping[str, Any],
    ) -> Any:
        # Tools are synchronous (`FlowToolCall.__call__`); off-load to a
        # worker thread so a slow tool can't park the runtime loop.
        # ``_tool_body`` sets the re-entrancy flag so reads of
        # ``session.chunk_table`` from inside the tool see the in-flight
        # transcript without trying to synchronize() the producing future.
        return await asyncio.to_thread(_tool_body, tool, session, arguments)


class _SyncExecutorAsyncAdapter:
    """Wrap a sync :class:`SessionLoopExecutor` so the async loop can drive it.

    Sync ``complete()`` runs on the runtime loop's worker pool via
    :func:`asyncio.to_thread`; same for ``dispatch_tool``. Scripted test
    executors keep working without rewrites.
    """

    __slots__ = ("_sync",)

    def __init__(self, sync: Any) -> None:
        self._sync = sync

    def tool_schemas(self) -> tuple[RathLLMFunctionTool, ...]:
        schemas: tuple[RathLLMFunctionTool, ...] = self._sync.tool_schemas()
        return schemas

    async def acomplete(self, req: RathLLMChatRequest) -> RathLLMChatResponse:
        return await asyncio.to_thread(self._sync.complete, req)

    async def adispatch_tool(
        self,
        session: Session,
        tool: FlowToolCall,
        arguments: Mapping[str, Any],
    ) -> Any:
        sync = self._sync

        def _call() -> Any:
            _enter_tool_dispatch()
            try:
                return sync.dispatch_tool(session, tool, dict(arguments or {}))
            finally:
                _exit_tool_dispatch()

        return await asyncio.to_thread(_call)


def _resolve_async_executor(
    *,
    agent_provider: Provider,
    executor: AsyncSessionLoopExecutor | None,
    on_event: Callable[[RathLLMStreamDelta], None] | None,
) -> AsyncSessionLoopExecutor:
    if executor is not None and on_event is not None:
        raise ValueError(
            "on_event with a custom executor is not supported; "
            "wire streaming inside your executor's acomplete instead."
        )
    if executor is not None:
        # Either already an AsyncSessionLoopExecutor, or a sync one — wrap.
        if hasattr(executor, "acomplete"):
            return executor
        return _SyncExecutorAsyncAdapter(executor)
    client = ensure_async_chat_client(chat_client_for(agent_provider))
    return _DefaultAsyncExecutor(client, on_event)


async def _adispatch_round(
    out: Session,
    rows_list: list[Any],
    tool_calls: tuple[Any, ...],
    table: dict[str, FlowToolCall],
    executor: AsyncSessionLoopExecutor,
    writer: _AsyncSessionWriter | None,
) -> None:
    """Run one assistant round's ``tool_calls`` with resource-keyed parallelism.

    Bodies are awaited via ``asyncio.gather`` across distinct
    :meth:`FlowToolCall.resource_key` queues; within a queue calls run in
    the original transcript order. Results are stitched back into
    ``rows_list`` in the original ``tool_calls`` order so the persisted
    transcript stays deterministic.
    """
    n = len(tool_calls)
    bodies: list[str | None] = [None] * n
    queues: dict[tuple[str, ...], list[int]] = {}
    pre_errors: dict[int, str] = {}

    for idx, tc in enumerate(tool_calls):
        tool_name = tc.function.name
        if tc.function.arguments_parsed is None or tc.function.arguments_parse_error:
            raw_dump = tc.function.arguments or ""
            if len(raw_dump) > 2000:
                raw_dump = raw_dump[:2000] + "...(truncated)"
            pre_errors[idx] = _loop_tool_error_payload(
                "invalid_tool_arguments",
                f"tool {tool_name!r} returned non-JSON or unparseable arguments",
                detail=raw_dump,
            )
            continue
        flow_tool = table.get(tool_name)
        if flow_tool is None:
            pre_errors[idx] = _loop_tool_error_payload(
                "unknown_tool",
                f"unknown tool {tool_name!r}",
            )
            continue
        args = tc.function.arguments_parsed or {}
        try:
            key = flow_tool.resource_key(args)
        except Exception as exc:
            logger.exception(
                'resource_key() raised for tool=%s; serializing on ("global",)',
                tool_name,
            )
            pre_errors[idx] = _loop_tool_error_payload(
                "tool_execution_exception",
                f"{type(exc).__name__}: {exc}",
                detail=type(exc).__name__,
            )
            continue
        queues.setdefault(tuple(key), []).append(idx)

    for idx, body in pre_errors.items():
        bodies[idx] = body

    async def _run_queue(indices: list[int]) -> None:
        for idx in indices:
            tc = tool_calls[idx]
            tool_name = tc.function.name
            flow_tool = table[tool_name]
            try:
                raw = await executor.adispatch_tool(
                    out,
                    flow_tool,
                    tc.function.arguments_parsed or {},
                )
                bodies[idx] = _summarize_dispatch_result(flow_tool, raw)
            except Exception as
```

### Core Architecture Module: `src/rath/backend/dedicated_loop.py`
```
"""Deprecated thin shim around :class:`rath._async.runtime.OpenRathRuntime`.

The historical ``DedicatedEventLoopThread`` lived here so the OpenSandbox
backend had a private asyncio loop for its async-only SDK. As of the
async-runtime refactor, all OpenRath subsystems share a single process-wide
loop hosted by :class:`OpenRathRuntime`, which exposes the same blocking
``run(coro)`` semantics.

This module is kept for one release as a compatibility shim. New code MUST
import from :mod:`rath._async.runtime`.
"""

from __future__ import annotations

import warnings
from collections.abc import Coroutine
from typing import Any, TypeVar

from rath._async.runtime import OpenRathRuntime, runtime

T = TypeVar("T")


class DedicatedEventLoopThread:
    """Deprecated wrapper around the global :class:`OpenRathRuntime`.

    .. deprecated::
       Import :func:`rath._async.runtime.runtime` and call ``.run(coro)``
       directly. This class will be removed in a future release.
    """

    __slots__ = ("_rt",)

    def __init__(self) -> None:
        warnings.warn(
            "DedicatedEventLoopThread is deprecated; use "
            "rath._async.runtime.runtime() instead",
            DeprecationWarning,
            stacklevel=2,
        )
        self._rt: OpenRathRuntime = runtime()

    def run(self, coro: Coroutine[Any, Any, T]) -> T:
        return self._rt.run(coro)


def shared_opensandbox_loop() -> DedicatedEventLoopThread:
    """Deprecated accessor returning a wrapper over the process-wide runtime."""
    warnings.warn(
        "shared_opensandbox_loop() is deprecated; use "
        "rath._async.runtime.runtime() instead",
        DeprecationWarning,
        stacklevel=2,
    )
    return DedicatedEventLoopThread()

```

### Core Architecture Module: `src/rath/observability/core.py`
```
"""Dependency-light OpenTelemetry-compatible tracing and metric hooks."""

from __future__ import annotations

import threading
import time
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol, runtime_checkable

from rath._json import JSONValue, freeze_mapping
from rath.context import TraceContext

__all__ = [
    "InMemoryTelemetry",
    "NoOpTelemetry",
    "GuardedTelemetry",
    "SpanRecord",
    "Telemetry",
]


@dataclass(frozen=True, slots=True)
class SpanRecord:
    name: str
    trace_id: str
    span_id: str
    parent_span_id: str | None
    started_at: datetime
    ended_at: datetime
    duration_ms: float
    status: str
    attributes: Mapping[str, JSONValue] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "attributes",
            freeze_mapping(self.attributes, field="span.attributes"),
        )


@runtime_checkable
class Telemetry(Protocol):
    @contextmanager
    def span(
        self,
        name: str,
        *,
        context: TraceContext,
        attributes: Mapping[str, object] | None = None,
    ) -> Iterator[None]: ...

    def increment(
        self,
        name: str,
        value: int = 1,
        *,
        attributes: Mapping[str, str] | None = None,
    ) -> None: ...


class NoOpTelemetry:
    @contextmanager
    def span(
        self,
        name: str,
        *,
        context: TraceContext,
        attributes: Mapping[str, object] | None = None,
    ) -> Iterator[None]:
        yield

    def increment(
        self,
        name: str,
        value: int = 1,
        *,
        attributes: Mapping[str, str] | None = None,
    ) -> None:
        return None


class InMemoryTelemetry:
    """Reference exporter used by tests and embedded diagnostics."""

    def __init__(self) -> None:
        self._spans: list[SpanRecord] = []
        self._counters: dict[tuple[str, tuple[tuple[str, str], ...]], int] = {}
        self._lock = threading.Lock()

    @property
    def spans(self) -> tuple[SpanRecord, ...]:
        with self._lock:
            return tuple(self._spans)

    @property
    def counters(self) -> Mapping[tuple[str, tuple[tuple[str, str], ...]], int]:
        with self._lock:
            return dict(self._counters)

    @contextmanager
    def span(
        self,
        name: str,
        *,
        context: TraceContext,
        attributes: Mapping[str, object] | None = None,
    ) -> Iterator[None]:
        started_at = datetime.now(timezone.utc)
        started = time.perf_counter()
        status = "ok"
        try:
            yield
        except BaseException:
            status = "error"
            raise
        finally:
            ended_at = datetime.now(timezone.utc)
            record = SpanRecord(
                name=name,
                trace_id=context.trace_id,
                span_id=context.span_id,
                parent_span_id=None,
                started_at=started_at,
                ended_at=ended_at,
                duration_ms=(time.perf_counter() - started) * 1000.0,
                status=status,
                attributes=freeze_mapping(attributes, field="span.attributes"),
            )
            with self._lock:
                self._spans.append(record)

    def increment(
        self,
        name: str,
        value: int = 1,
        *,
        attributes: Mapping[str, str] | None = None,
    ) -> None:
        labels = tuple(sorted((attributes or {}).items()))
        with self._lock:
            key = (name, labels)
            self._counters[key] = self._counters.get(key, 0) + value


class GuardedTelemetry:
    """Failure-isolating wrapper: exporter faults never change application results."""

    def __init__(self, delegate: Telemetry) -> None:
        self.delegate = delegate

    @contextmanager
    def span(
        self,
        name: str,
        *,
        context: TraceContext,
        attributes: Mapping[str, object] | None = None,
    ) -> Iterator[None]:
        manager = None
        try:
            manager = self.delegate.span(
                name,
                context=context,
                attributes=attributes,
            )
            manager.__enter__()
        except Exception:
            manager = None
        try:
            yield
        except BaseException as exc:
            if manager is not None:
                try:
                    manager.__exit__(type(exc), exc, exc.__traceback__)
                except Exception:
                    pass
            raise
        else:
            if manager is not None:
                try:
                    manager.__exit__(None, None, None)
                except Exception:
                    pass

    def increment(
        self,
        name: str,
        value: int = 1,
        *,
        attributes: Mapping[str, str] | None = None,
    ) -> None:
        try:
            self.delegate.increment(name, value, attributes=attributes)
        except Exception:
            pass

```

### Core Architecture Module: `src/rath/session/loop.py`
```
"""Session loop: alternate LLM completions with sandbox tool execution.

The single public entry point :func:`run_session_loop` drives a multi-turn
assistant pass. Two optional parameters extend it:

* ``on_event`` — receives one :class:`~rath.llm.RathLLMStreamDelta` per
  streamed chunk. Requires the resolved chat client to satisfy
  :class:`~rath.llm.StreamingChatClient`. When
  ``on_event`` is ``None`` (the default), the loop runs non-streaming.

* ``persist`` / ``persist_path`` — when truthy, the loop holds a
  :class:`~rath.session.persistence.SessionWriter` internally and appends each
  new chunk to ``.openrath/sessions/<out.id>.jsonl`` (or to ``persist_path``).
  The writer's trailer is written on graceful return; on exception the file
  is left without a trailer (``closed=False`` on reload — the crash signal).
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any, Mapping, Protocol, runtime_checkable

from pydantic import BaseModel

from rath.backend import (
    CodeResult,
    CommandResult,
    FileContent,
    FileEntries,
    FileWriteResult,
    ToolExecutionFailure,
    ToolResult,
)
from rath.flow.tool import (
    FlowToolCall,
)
from rath.llm import (
    Provider,
    RathLLMAssistantMessage,
    RathLLMChatChoice,
    RathLLMChatRequest,
    RathLLMChatResponse,
    RathLLMFinishReason,
    RathLLMFunctionTool,
    RathLLMStreamDelta,
    RathLLMTokenUsage,
    RathLLMToolCallFunction,
    RathLLMToolCallPart,
    StreamingChatClient,
    add_usage,
    chat_client_for,
)
from rath.llm.tool_args import parse_tool_arguments
from rath.session.chunk import (
    ChunkRow,
    ChunkTable,
)
from rath.session.graph import LineageKind, LineageRecorder, SessionLineage
from rath.session.manager import session_registry
from rath.session.persistence import SessionWriter
from rath.session.provider_builtin import DefaultSessionLoopExecutor
from rath.session.session import Session
from rath.utils.decoding import decode_subprocess_output

logger = logging.getLogger(__name__)

OnEventCb = Callable[[RathLLMStreamDelta], None]
"""Type alias for the streaming-delta callback consumed by :func:`run_session_loop`."""


@runtime_checkable
class SessionLoopExecutor(Protocol):
    """Runs completions and tool dispatch used by ``run_session_loop``."""

    def complete(self, req: RathLLMChatRequest) -> RathLLMChatResponse:
        """Run one chat completion."""

    def dispatch_tool(
        self,
        session: Session,
        tool: FlowToolCall,
        arguments: Mapping[str, Any],
    ) -> Any:
        """Run ``tool`` with JSON ``arguments`` (typically ``tool(session, arguments)``)."""

    def tool_schemas(self) -> tuple[RathLLMFunctionTool, ...]:
        """Tool specs for OpenAI-style ``tools``. Empty tuple defers to the loop-local merged registry."""


def _accumulate_stream_to_response(
    deltas: Any,
    *,
    on_event: Callable[[RathLLMStreamDelta], None],
    model: str = "",
) -> RathLLMChatResponse:
    """Fold an iterable of stream deltas into one :class:`RathLLMChatResponse`.

    Each delta is forwarded to ``on_event`` immediately so callers can drive a
    streaming UI; the final accumulated message is then returned for the
    session loop to append to its chunk_table as a single atomic chunk.
    """
    text_parts: list[str] = []
    tool_buckets: dict[int, dict[str, Any]] = {}
    finish: RathLLMFinishReason | None = None
    usage: RathLLMTokenUsage | None = None

    for d in deltas:
        on_event(d)
        if d.content_delta:
            text_parts.append(d.content_delta)
        if d.tool_call_index is not None or d.tool_call_id is not None:
            idx = d.tool_call_index if d.tool_call_index is not None else 0
            bucket = tool_buckets.setdefault(
                idx, {"id": "", "name": "", "arguments": ""}
            )
            if d.tool_call_id:
                bucket["id"] = d.tool_call_id
            if d.tool_call_name_delta:
                bucket["name"] = (bucket["name"] or "") + d.tool_call_name_delta
            if d.tool_call_args_delta:
                bucket["arguments"] = (
                    bucket["arguments"] or ""
                ) + d.tool_call_args_delta
        if d.finish_reason is not None:
            finish = d.finish_reason
        if d.usage is not None:
            usage = d.usage

    tool_calls: tuple[RathLLMToolCallPart, ...] | None = None
    if tool_buckets:
        parts: list[RathLLMToolCallPart] = []
        for _, bucket in sorted(tool_buckets.items()):
            arg_str = bucket.get("arguments") or ""
            parsed, parse_error = parse_tool_arguments(arg_str)
            parts.append(
                RathLLMToolCallPart(
                    id=str(bucket.get("id") or ""),
                    type="function",
                    function=RathLLMToolCallFunction(
                        name=str(bucket.get("name") or ""),
                        arguments=arg_str,
                        arguments_parsed=parsed,
                        arguments_parse_error=parse_error,
                    ),
                )
            )
        tool_calls = tuple(parts)

    content_text = "".join(text_parts) if text_parts else None
    if finish is None:
        finish = "tool_calls" if tool_calls else "stop"

    return RathLLMChatResponse(
        id="",
        choices=(
            RathLLMChatChoice(
                index=0,
                finish_reason=finish,
                message=RathLLMAssistantMessage(
                    role="assistant",
                    content=content_text,
                    tool_calls=tool_calls,
                ),
            ),
        ),
        created=0,
        model=model,
        usage=usage,
    )


class StreamingExecutor:
    """Adapt a :class:`StreamingChatClient` to the :class:`SessionLoopExecutor` protocol.

    ``complete()`` consumes the client's ``complete_stream(req)``, forwards
    each delta to ``on_event``, and returns the accumulated response. Tool
    dispatch and schema lookup are delegated to an inner executor (a fresh
    :class:`DefaultSessionLoopExecutor` wrapping the same client when one is
    not supplied).
    """

    __slots__ = ("client", "_on_event", "_inner")

    def __init__(
        self,
        client: StreamingChatClient,
        on_event: Callable[[RathLLMStreamDelta], None],
        inner: SessionLoopExecutor | None = None,
    ) -> None:
        self.client = client
        self._on_event = on_event
        self._inner = inner or DefaultSessionLoopExecutor(client)

    def complete(self, req: RathLLMChatRequest) -> RathLLMChatResponse:
        return _accumulate_stream_to_response(
            self.client.complete_stream(req),
            on_event=self._on_event,
            model=getattr(self.client.provider, "model", "") or "",
        )

    def dispatch_tool(
        self, session: Session, tool: FlowToolCall, arguments: Mapping[str, Any]
    ) -> Any:
        return self._inner.dispatch_tool(session, tool, arguments)

    def tool_schemas(self) -> tuple[RathLLMFunctionTool, ...]:
        return self._inner.tool_schemas()


def resolve_executor(
    *,
    agent_provider: Provider,
    executor: SessionLoopExecutor | None,
    on_event: OnEventCb | None,
) -> SessionLoopExecutor:
    """Pick the executor for ``run_session_loop`` / ``run_session_compress``.

    A caller-supplied ``executor`` is returned as-is (and is incompatible with
    ``on_event``). Otherwise a chat client is built from ``agent_provider`` —
    streaming when ``on_event`` is set, default otherwise.
    """
    if executor is not None and on_event is not None:
        raise ValueError(
            "on_event with a custom executor is not supported; "
            "wrap your client with StreamingExecutor and pass that as executor=."
        )
    if executor is not None:
        return executor
    client = chat_client_for(agent_provider)
    if on_event is not None:
        if not isinstance(client, StreamingChatClient):
            raise TypeError(
                "on_event requires a StreamingChatClient; "
                f"{type(client).__name__} (provider_kind="
                f"{agent_provider.provider_kind!r}) does not implement "
                "complete_stream(req). Drop on_event for non-streaming."
            )
        return StreamingExecutor(client, on_event)
    return DefaultSessionLoopExecutor(client)


def _sync_loop_out_rows(out: Session, rows_list: list[ChunkRow]) -> None:
    # Bypass the lazy property setter so this is callable from runtime
    # coroutines without poking the synchronize() lock.
    out._chunk_table = ChunkTable(rows=tuple(rows_list))


def _accumulate_usage_and_check_budget(
    out: Session,
    resp: RathLLMChatResponse,
    provider: Provider,
) -> None:
    """Fold ``resp.usage`` into ``out.cumulative_usage`` and trip the budget guard.

    The guard fires **only on the completion that first pushes the running
    total past ``provider.budget_total_tokens``**, never again for the same
    ``out`` session. That keeps a multi-round tool-calling loop from
    re-invoking the callback (or re-logging the warning) every round once the
    cap has already been crossed; callers that want to abort the loop are
    expected to raise :class:`~rath.llm.BudgetExceededError` from the
    callback on that first call.

    The latch is implicit in the prev/new transition (``prev <= cap`` and
    ``new > cap``); no new session state is introduced.
    """
    if resp.usage is None:
        return
    # Access the private slot directly so this helper is safe to call from
    # the runtime coroutine, where reading ``out.cumulative_usage`` (the
    # lazy property) would deadlock on the still-pending future.
    current = out._cumulative_usage
    prev_total = current.total_tokens if current is not None else 0
    out._cumulative_usage = add_usage(curren
```

### Core Architecture Module: `src/rath/utils/__init__.py`
```
"""Small shared helpers (paths + test env accessors)."""

from __future__ import annotations

from typing import Any

from rath.utils.decoding import decode_subprocess_output
from rath.utils.env import project_root_with_pyproject

__all__ = [
    "decode_subprocess_output",
    "project_root_with_pyproject",
    "TEST_BASE_URL",
    "TEST_API_KEY",
    "TEST_MODEL",
]


def __getattr__(name: str) -> Any:
    if name in ("TEST_BASE_URL", "TEST_API_KEY", "TEST_MODEL"):
        import rath.utils.env as _env

        return getattr(_env, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(__all__)

```

### Core Architecture Module: `src/rath/utils/decoding.py`
```
"""Decode raw bytes from host shells and subprocesses (encoding-safe)."""

from __future__ import annotations

import locale
import sys


def decode_subprocess_output(data: bytes) -> str:
    """Turn captured ``stdout``/``stderr`` bytes into text.

    Tries UTF-8 first (strict). On failure, uses the process locale and on Windows
    ``mbcs`` (ANSI/OEM code page) so ``cmd.exe`` / PowerShell output matches the
    console (e.g. GBK/cp936) instead of mojibake from forcing ``utf-8`` with
    ``errors="replace"``.
    """

    if not data:
        return ""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        pass
    pref = locale.getpreferredencoding(False)
    if pref:
        try:
            return data.decode(pref, errors="replace")
        except LookupError:
            pass
    if sys.platform == "win32":
        try:
            return data.decode("mbcs", errors="replace")
        except LookupError:
            pass
    return data.decode("latin-1", errors="replace")


__all__ = ["decode_subprocess_output"]

```

### Core Architecture Module: `src/rath/utils/env.py`
```
"""Repository path helpers and test-only environment accessors.

The attributes ``TEST_BASE_URL``, ``TEST_API_KEY``, and ``TEST_MODEL`` are
resolved lazily from environment variables of the same names (empty or
whitespace-only values become ``None``). Intended for pytest and harnesses —
production code should use :class:`~rath.llm.provider.Provider` explicitly.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING, Any

__all__ = [
    "project_root_with_pyproject",
    "TEST_BASE_URL",
    "TEST_API_KEY",
    "TEST_MODEL",
]


def project_root_with_pyproject() -> Path:
    """Repository root: parent of ``src`` that contains ``pyproject.toml``."""
    return Path(__file__).resolve().parents[3]


def _test_env_value(key: str) -> str | None:
    raw = os.environ.get(key, "").strip()
    return raw if raw else None


def __getattr__(name: str) -> Any:
    if name == "TEST_BASE_URL":
        return _test_env_value("TEST_BASE_URL")
    if name == "TEST_API_KEY":
        return _test_env_value("TEST_API_KEY")
    if name == "TEST_MODEL":
        return _test_env_value("TEST_MODEL")
    raise AttributeError(
        f"module {__name__!r} has no attribute {name!r}",
    )


def __dir__() -> list[str]:
    return sorted(__all__)


if TYPE_CHECKING:
    TEST_BASE_URL: str | None
    TEST_API_KEY: str | None
    TEST_MODEL: str | None

```

### Core Architecture Module: `src/rath/utils/ids.py`
```
"""Identifier normalization helpers for filesystem-backed persistence."""

from __future__ import annotations

from uuid import UUID

__all__ = ["coerce_uuid_str"]


def coerce_uuid_str(value: UUID | str, *, field: str = "id") -> str:
    """Return ``value`` as a canonical UUID string or raise ``ValueError``.

    Persistence identifiers are used as path components. Accepting arbitrary
    strings here would make path traversal possible, so string inputs must be
    parseable UUIDs before they can reach filesystem helpers.
    """

    if isinstance(value, UUID):
        return str(value)
    try:
        return str(UUID(str(value)))
    except ValueError as exc:
        raise ValueError(f"{field} must be a UUID") from exc

```

### Core Architecture Module: `deploy/reference_app.py`
```
"""Minimal deployable OpenRath v2 reference application."""

from __future__ import annotations

import asyncio
import os
from uuid import UUID

from rath.definition import EffectClass, step
from rath.flow import Workflow
from rath.runtime import LocalRuntime, PostgresEffectLedger, PostgresRunStore
from rath.security import (
    Principal,
    PrincipalKind,
    SecurityContext,
    StructuredAuditSink,
)
from rath.server import AgentServer, StaticTokenAuth
from rath.session import Session


class EchoWorkflow(Workflow):
    @step(entry=True, effects=EffectClass.READ_ONLY)
    def echo(self, state, context):  # type: ignore[no-untyped-def]
        return {**state, "completed": True}

    def forward(self, session: Session) -> Session:
        return session


class SlowWorkflow(Workflow):
    @step(entry=True, effects=EffectClass.READ_ONLY, timeout_seconds=60)
    async def wait(self, state, context):  # type: ignore[no-untyped-def]
        delay = min(max(float(state.get("delay", 1)), 0), 30)
        await asyncio.sleep(delay)
        return {**state, "completed": True}

    def forward(self, session: Session) -> Session:
        return session


dsn = os.environ["OPENRATH_POSTGRES_DSN"]
token = os.environ["OPENRATH_TOKEN"]
tenant_id = os.getenv("OPENRATH_TENANT_ID", "default")
grants = frozenset(
    grant.strip()
    for grant in os.environ["OPENRATH_GRANTS"].split(",")
    if grant.strip()
)
if not grants or "*" in grants:
    raise RuntimeError(
        "OPENRATH_GRANTS must contain explicit action grants and must not use '*'"
    )
store = PostgresRunStore(
    dsn,
    schema=os.getenv("OPENRATH_DB_SCHEMA", "openrath"),
    auto_migrate=False,
    pool_max_size=int(os.getenv("OPENRATH_DB_POOL_MAX_SIZE", "20")),
)
effect_ledger = PostgresEffectLedger(
    dsn,
    schema=os.getenv("OPENRATH_DB_SCHEMA", "openrath"),
)
runtime = LocalRuntime(store, effect_ledger=effect_ledger, production_mode=True)
server = AgentServer(
    store,
    runtime,
    auth=StaticTokenAuth(
        {
            token: SecurityContext(
                principal=Principal(id="reference-user", kind=PrincipalKind.SERVICE),
                tenant_id=tenant_id,
                grants=grants,
            )
        }
    ),
    audit_sink=StructuredAuditSink(),
    embedded_worker=os.getenv("OPENRATH_EMBEDDED_WORKER", "true").lower() == "true",
    worker_id=os.getenv("HOSTNAME", "standalone-worker"),
    worker_lease_seconds=float(os.getenv("OPENRATH_WORKER_LEASE_SECONDS", "30")),
)
server.register_assistant(
    "echo",
    EchoWorkflow(),
    revision_id=UUID(
        os.getenv("OPENRATH_REVISION_ID", "00000000-0000-4000-8000-000000000001")
    ),
)
server.register_assistant(
    "slow",
    SlowWorkflow(),
    revision_id=UUID(
        os.getenv(
            "OPENRATH_SLOW_REVISION_ID",
            "00000000-0000-4000-8000-000000000002",
        )
    ),
)
app = server.app

```

### Core Architecture Module: `example/01_hello_agent.py`
```
"""01 · Hello, Agent — the smallest OpenRath program.

`flow.Agent` is OpenRath's `nn.Module`: build it once with a system prompt and
a provider, then *call* it on a `Session` (the "tensor") to get an updated
session back. This is the canonical entry point — most examples build on it.

Run:
    python example/01_hello_agent.py

Needs an OpenAI-compatible key: export ``OPENAI_API_KEY`` (and optionally
``OPENAI_BASE_URL`` / ``OPENAI_DEFAULT_MODEL``), or configure
``llm.default_provider`` in ``~/.openrath/config.json``.
"""

from __future__ import annotations

from _shared import provider_from_env, stream_to_stdout

from rath import flow
from rath.session import Session


def main() -> None:
    agent = flow.Agent(
        "You are a concise assistant.",
        provider_from_env(),
        on_event=stream_to_stdout(),
    )

    user = Session.from_user_message("In one sentence, what is OpenRath?").to("local")
    out = agent(user)
    print()  # newline after the streamed answer

    if out.cumulative_usage is not None:
        print(f"--- tokens: total={out.cumulative_usage.total_tokens}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `example/02_session_lineage.py`
```
"""02 · Session lineage — fork, detach, and the session graph (no LLM key).

A `Session` is OpenRath's tensor; `fork()` / `detach()` mirror torch's
`clone()` / `detach()`. A fork records its parent; a detach starts a fresh
lineage root. With many sessions, those parent links form a graph you can
traverse and export. This script needs **no API key**.

Run:
    python example/02_session_lineage.py
"""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from rath.session import Session
from rath.session.graph import (
    ancestors_bfs,
    edge_pairs,
    export_journal_jsonl,
    lineage_journal_tracking,
)
from rath.session.manager import session_registry


def show_fork_vs_detach() -> None:
    root = Session.from_user_message("Plan a small project.")
    forked = root.fork()  # clone() analogue — keeps the parent link
    detached = root.detach()  # detach() analogue — new lineage root

    print(f"root.id          = {root.id}")
    print(
        f"forked.parents   = {forked.parent_session_ids}  "
        f"kind={forked.lineage_kind.name}"
    )
    print(
        f"detached.parents = {detached.parent_session_ids}  "
        f"kind={detached.lineage_kind.name}"
    )


def build_and_export_graph() -> None:
    """Fork/detach a handful of sessions, then traverse and export the graph.

    ``run_session_loop`` registers sessions automatically; outside the loop we
    register them by hand so the journal exporter can resolve every id.
    """
    reg = session_registry()
    with lineage_journal_tracking() as journal:
        root = Session.from_user_message("Initial user message.")
        reg.register(root)
        plan = root.fork()
        reg.register(plan)
        critique = root.fork()
        reg.register(critique)
        reg.register(plan.detach())
        leaf = critique.fork()
        reg.register(leaf)

    by_id: dict[UUID, Session] = {s.id: s for s in (root, plan, critique, leaf)}
    print("\nedges (parent -> child):")
    for parent, child in edge_pairs(by_id):
        print(f"  {parent} -> {child}")
    print(f"\nancestors of leaf (nearest first): {ancestors_bfs(by_id, leaf.id)}")

    out_path = Path("lineage_demo.jsonl")
    export_journal_jsonl(journal, out_path)
    print(f"\nwrote {len(journal.visit_order)} session rows to {out_path.resolve()}")


def main() -> None:
    show_fork_vs_detach()
    build_and_export_graph()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `example/03_sandbox_backend.py`
```
"""03 · Sandbox backend — `.to(...)` is OpenRath's `tensor.to(device)`.

A session declares *where* its tools run by binding a sandbox backend. The
``spec`` controls the working directory:

- ``spec=None`` — an ephemeral workspace with no host directory.
- ``spec="."`` — bind a host path as the sandbox working directory.

The same agent code runs unchanged on either backend; only the string passed
to ``.to(...)`` changes. Pass a backend name as the first argument to switch:

    python example/03_sandbox_backend.py             # local (default)
    python example/03_sandbox_backend.py opensandbox  # needs an OpenSandbox stack

Needs an OpenAI-compatible key (see ``_shared/provider.py``).
"""

from __future__ import annotations

import sys

from _shared import provider_from_env, stream_to_stdout

import rath.backend as backend
from rath import flow
from rath.session import Session


def run_on(backend_name: str) -> None:
    agent = flow.Agent(
        "You are a helpful assistant. Built-in filesystem tools are available.",
        provider_from_env(),
        on_event=stream_to_stdout(),
    )

    print(f"=== {backend_name}: ephemeral workspace (spec=None) ===")
    ephemeral = Session.from_user_message(
        "List the files in the current directory, then summarize what you found."
    ).to(backend_name, spec=None)
    agent(ephemeral)
    print()

    print(f"\n=== {backend_name}: host directory bound (spec='.') ===")
    bound = Session.from_user_message(
        "List the files in the current directory, then summarize what you found."
    ).to(backend_name, spec=".")
    agent(bound)
    print()


def main() -> None:
    backend_name = sys.argv[1] if len(sys.argv) > 1 else "local"
    if not backend.get(backend_name).is_available():
        print(f"Sandbox backend {backend_name!r} is not available.")
        return
    run_on(backend_name)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #68** (2026-09-28): **docs: redraw the README diagrams as SVG**
  *Symptoms*: The four overview diagrams in the README were 1536x1024 PNGs that blur when zoomed. This redraws them as SVG with the same layout, colours, icons and wording, and points README.md and README_zh.md at the SVGs.  - `pytorch-lens`, `v2-durable-runtime`, `paradigm-map`, `multi-agent-multi-session` - Text is outlined from Comic Neue (SIL OFL 1.1), so it renders the same everywhere; icons are Lucide (ISC) or drawn to match the originals - 35-74 KB per file, against 2.2-2.4 MB for the PNGs - The PNGs stay in `assets/readme/diagrams/` for pages that still link to them  Checked by rendering each SVG against its original PNG region by region.

- **Issue #53** (2026-07-31): **docs: add OpenRath v2 runtime overview**
  *Symptoms*: ## Summary  - add a hand-drawn OpenRath v2.0.0 durable runtime overview matching the existing README diagram series - place the diagram in the v2.0.0 production section of both English and Chinese READMEs - add concise explanatory copy and remove the redundant ASCII architecture block  ## Why  The v2.0.0 production architecture is easier to understand as a visual path from definition and compilation through durable execution to the production data plane. Matching the existing illustration style keeps the README cohesive.  ## User impact  Readers can now understand the relationship between `@step` / `@router`, immutable execution plans, durable Runs, runtime controls, and PostgreSQL/Redis/S3 infrastructure at a glance.  ## Validation  - confirmed the image is a 1536×1024 PNG and renders at the README's standard 860px width - updated both `README.md` and `README_zh.md` - ran `git diff --check` successfully - verified the branch contains only the two README changes and the new diagram asset 

- **Issue #52** (2026-07-31): **Align OpenRath v2.0.0 README and deployment reference**
  *Symptoms*: ## Summary  - preserve the original OpenRath README structure, PyTorch framing, component documentation, workflow example, installation guide, and 12-step learning ladder - expand the existing v2.0.0 section around OpenRath's move into production environments: durable Runs, Events, Checkpoints, worker recovery, Effect Ledger, Interrupts, tenant boundaries, PostgreSQL, Redis, artifacts, and operations - provide matching English and Simplified Chinese documentation while consistently treating OpenRath as the product name and v2.0.0 as the release version - remove the plural `examples/` directory by moving the deployable Agent Server application to `deploy/reference_app.py` - update Docker, Compose, Kubernetes, CI, release workflows, and deployment contract tests to use the new reference application path - keep the singular `example/` directory as the core API learning ladder and link complete scenarios from OpenRath-Example  ## Why  OpenRath v2.0.0 is primarily the release where OpenRath becomes deployable as a durable production runtime. The README should communicate that change without replacing the project's existing concepts and learning material. The deployable server application also belongs with deployment assets rather than tutorial examples.  ## Impact  Users retain the familiar README and API introduction while gaining a focused production overview and direct paths to deployment guidance. Deployment manifests and release checks continue to reference the same applicati
  **Post-Mortem & Fix Analysis**:
  > Merged: OpenRath v2.0.0 documentation now highlights durable production deployment, while the relocated reference application and deployment assets remain fully validated.

- **Issue #51** (2026-07-30): **feat(v2): harden durable runtime and release gates**
  *Symptoms*: ## Summary  This draft PR delivers the unreleased OpenRath v2 runtime line, closes the actionable repository-wide review findings, records the published `v2.0.0rc1` evidence, and adds fail-closed GA evidence and publication gates.  The RC is published from `feedcaadb79a349aa60c034618610231d83fb131`. The current PR head is not a GA authorization and must remain draft until the target-environment and owner gates below are complete.  ## What changed  - Added the governed durable runtime, adapter, authorization, migration, bounded I/O, observability, and deployment hardening described in the review evidence. - Published and recorded the SHA-bound `v2.0.0rc1` GitHub prerelease and public GHCR image, including anonymous digest access and provenance verification. - Added separate RC/GA evidence contracts, exact same-SHA Gate C reports, protected-environment approval records, and verifier tests. - Added the protected `Collect v2.0.0 Gate C evidence` workflow on a fixed `self-hosted, linux, openrath-ga` target runner. GA preparation now accepts only that workflow identity, `workflow_dispatch`, `main`, the exact source SHA, and a successful conclusion. - Added hash-bound target evidence recording, credential-pattern scanning, traversal/symlink rejection, target-like HTTPS lifecycle load, single/split 1/2/4-worker scaling calculation, eight-hour soak acceptance, and full fault/backup/restore/rollout/rollback report builders. - Split GA publication into three fail-closed stages: protecte
  **Post-Mortem & Fix Analysis**:
  > CI supervision complete for `cbba110630cb4954b4d5bad405d88f7d5e4bc9c1`.  - 9 substantive checks: **SUCCESS** - 1 generated matrix placeholder: **SKIPPED** (not a required or failing check) - Merge state: **CLEAN / MERGEABLE**  CI fixes made during supervision:  1. Replaced the runtime-installed Trivy Action with the verified `aquasec/trivy:0.67.2` image pinned by digest, preserving image vulnerability, CycloneDX SBOM, and repository secret gates. 2. Replaced two runner-speed microbenchmarks with deterministic concurrency/integrity assertions. 3. Replaced a wall-clock parallel-tool threshold with direct `max_in_flight` overlap observation.  The PR intentionally remains Draft because `release/evidence/v2.0.0-review/manifest.json` still records external Gate D blockers and `release_approved=false`. 

- **Issue #47** (2026-07-08): **docs: add workflow compile visual**
  *Symptoms*: ## Summary  - Add a README section explaining the benefit of `workflow.compile()` for large agent systems. - Add a hand-drawn workflow compile visual matching the existing README diagram style.  ## Validation  - `git diff --cached --check` - Verified `assets/readme/workflow-compile-static-pass.png` is a valid PNG image. 

- **Issue #46** (2026-07-08): **v1.3.0: config/env/persistence hardening, provider .to(), Workflow.compile()**
  *Symptoms*: ## Summary  v1.3.0 — foundation-first hardening plus the new **Workflow compile** feature. Resource *pooling* was deliberately scoped out (sandboxes are stateful; cross-session reuse is a correctness/safety hazard) — only the stateless provider-client cache was kept.  Version bumped 1.2.2 → 1.3.0. Every change landed TDD (RED → GREEN → REFACTOR), no mocks.  ### Persistence - `rath.persistence.atomic` — `atomic_write_text`/`atomic_write_json` (temp + `os.replace`, path-keyed lock, Windows sharing-violation retry). Fixes a pre-existing Windows concurrent-config-save `PermissionError`. - Backend remote-sandbox registry + local memory adapter now write atomically (were bare `write_text`). - `rath.persistence.manifest` — root `.openrath/manifest.json` (layout + per-plane schema versions); refuses a newer layout on load. - `rath.persistence.gc(older_than=..., dry_run=True)` — unified retention across sessions, sandboxes, memory stores, and the previously-unbounded memory commits archive.  ### Config & environment - Secrets split: `config.json` (routing) + 0600 `credentials.json`; inline keys still load and migrate on save. - New `backend` config section with a real consumer (opensandbox domain: env → config → `~/.sandbox.toml`). - `rath.config.env` — central `EnvSpec` registry; sync/async LLM clients, embedding, VLM, and opensandbox all resolve through it (kills scattered `os.environ.get`). Embedding/VLM gained the config fallback. - opensandbox `code-interpreter` default bumped v1

- **Issue #43** (2026-07-05): **fix(memory): guard MemoryStore refcount updates**
  *Symptoms*: ﻿## Summary  This PR guards `MemoryStore` refcount reads and writes with a lock, matching the lifecycle pattern already used by `BackendSandbox`.  `MemoryStore` is documented as mirroring `BackendSandbox` lifecycle semantics, but its `_refcount` was previously updated without synchronization. This could lose updates when the same store is acquired or released concurrently.  ## Why  `MemoryStore` can be shared across holders:  - an already-open store can be passed into `Agent(memory=store)` - `Agent` acquires the store during initialization - `Agent.close()` releases the store - callers may also use explicit `store.acquire()` / `store.release()` or `with store:`  `BackendSandbox`, the parallel refcounted handle, already protects `_refcount` with `threading.Lock` and has a concurrency test for acquire/release behavior. This PR aligns `MemoryStore` with that existing pattern without changing close-on-zero semantics.  ## Behavior  Before:  - concurrent `MemoryStore.acquire()` / `release()` could race on `_refcount` - read/modify/write updates were not serialized  After:  - `refcount`, `acquire()`, and `release()` use `_refcount_lock` - close still happens outside the lock, following the `BackendSandbox` pattern - public lifecycle behavior remains unchanged  ## Tests  Added memory refcount coverage for:  - concurrent acquire/release stress behavior - deterministic lost-update reproduction using a yielding refcount test double  Verification run:  - `uv run pytest tests/memory/unit/
  **Post-Mortem & Fix Analysis**:
  > CI checks are green merging.

- **Issue #42** (2026-07-05): **fix(flow): warn on best-effort Agent memory failures**
  *Symptoms*: ## Summary  This PR makes best-effort `Agent` memory failures observable without changing `Agent.forward()` execution behavior.  Previously, `Agent` silently swallowed exceptions from:  - memory injection - `commit_on_forward` memory commit  Both paths still continue as before, but now emit warnings with traceback so users can diagnose skipped memory recall or persistence failures.  ## Why  Other recoverable/degraded paths in OpenRath already log warnings when work is skipped or downgraded, for example:  - memory injection skips closed stores or failed dispatches - session loop warns when token budget is exceeded without a callback - config warns on unsafe secret-file permissions - backend persistence skips malformed records with warnings - OpenSandbox logs workspace-bind fallback before retrying  This change keeps `Agent` memory handling aligned with that existing local convention. It does not introduce a new logging policy or change logging configuration.  ## Behavior  Before:  - memory injection failure: swallowed silently - `commit_on_forward` failure: swallowed silently  After:  - memory injection failure: warning logged, forward continues - `commit_on_forward` failure: warning logged, forward continues  ## Follow-up consideration  This repository may benefit from a future, maintainer-led logging policy that defines logging levels and context conventions across modules, such as:  - when to use `debug`, `info`, `warning`, or `exception` - which recoverable failures should
  **Post-Mortem & Fix Analysis**:
  > CI checks are green merging.

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

### Incident Patch 1: `2c4ddb45` (2026-07-08)
**Commit Message**: fix(opensandbox): recreate CodeInterpreter on busy code.run retries

Session-busy errors persisted when retrying on the same interpreter. Use up to 3 attempts with fresh CodeInterpreter.create() and backoff between tries.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `src/rath/backend/opensandbox.py` (modified, +33/-14)
```diff
@@ -75,7 +75,7 @@
     SandboxException = Exception  # type: ignore[assignment, misc]
 
 try:
-    from code_interpreter import CodeInterpreter
+    import code_interpreter  # noqa: F401
 
     _CI_AVAILABLE = True
 except ImportError:  # pragma: no cover -- optional extra
@@ -142,6 +142,8 @@ async def _await_maybe_timeout(awaitable, timeout: float | None):
 _CREATE_READY_TIMEOUT = timedelta(seconds=120)
 # code.run with no explicit timeout must not block until pytest's 300s marker fires.
 _DEFAULT_TOOL_TIMEOUT_S = 90.0
+_CODE_RUN_ATTEMPTS = 3
+_CODE_RUN_BACKOFF_S = (0.5, 1.0)
 
 
 def _execution_stdout_bytes(execution: Any) -> bytes:
@@ -283,32 +285,50 @@ def _is_transient_code_run_result(execution: Any) -> bool:
 
 
 async def _run_code_with_retry(
-    ci: Any,
+    native: Any,
     source: str,
     language: str,
     call_timeout: float | None,
 ) -> Any:
+    """Run ``code.run`` with timeout and transient busy-session retries.
+
+    Each attempt uses a fresh :class:`CodeInterpreter` because the server
+    rejects back-to-back runs on a busy code session.
+    """
+    if not _CI_AVAILABLE:  # pragma: no cover
+        raise RuntimeError("code-interpreter SDK is not installed")
+    from code_interpreter import CodeInterpreter  # noqa: PLC0415
+
     effective = call_timeout if call_timeout is not None else _DEFAULT_TOOL_TIMEOUT_S
-    for attempt in range(2):
+    last_execution: Any = None
+    for attempt in range(_CODE_RUN_ATTEMPTS):
+        ci = await CodeInterpreter.create(native)
         try:
             execution = await _await_maybe_timeout(
                 ci.codes.run(source, language=language),
                 effective,
             )
         except TimeoutError:
-            if attempt == 0:
-                logger.debug("OpenSandbox code.run timed out; retrying once")
-                await asyncio.sleep(0.5)
-                continue
-            raise
-        if attempt == 0 and _is_transient_code_run_result(execution):
+            if attempt + 1 >= _CODE_RUN_ATTEMPTS:
+                raise
+            logger.debug("OpenSandbox code.run timed out; retrying once")
+            delay = _CODE_RUN_BACKOFF_S[min(attempt, len(_CODE_RUN_BACKOFF_S) - 1)]
+            await asyncio.sleep(delay)
+            continue
+        last_execution = execution
+        if _is_transient_code_run_result(execution):
+            if attempt + 1 >= _CODE_RUN_ATTEMPTS:
+                break
             logger.debug(
-                "OpenSandbox code.run returned transient busy state; retrying once"
+                "OpenSandbox code.run returned transient busy state; "
+                "retrying with a fresh interpreter"
             )
-            await asyncio.sleep(0.5)
+            delay = _CODE_RUN_BACKOFF_S[min(attempt, len(_CODE_RUN_BACKOFF_S) - 1)]
+            await asyncio.sleep(delay)
             continue
         return execution
-    raise RuntimeError("unreachable code path in _run_code_with_retry")
+    assert last_execution is not None
+    return last_execution
 
 
 def bind_workspace_volumes_from_spec(
@@ -801,9 +821,8 @@ async def _code_run(self, native: Any, call: BackendToolCodeRun) -> CodeResult:
             if call.language == "python"
             else call.code
         )
-        ci = await CodeInterpreter.create(native)
         execution = await _run_code_with_retry(
-            ci,
+            native,
             source,
             call.language,
             call.timeout,
```

---

### Incident Patch 2: `9483340e` (2026-07-08)
**Commit Message**: fix(opensandbox): retry code.run on transient session-busy errors

Merge CI failed test_python_basic_print with error running codes session is busy. Extend _run_code_with_retry to retry once on that server-side contention (not only TimeoutError) and warm up the code.run path in CI prep.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `scripts/ci_opensandbox_prepare.sh` (modified, +4/-3)
```diff
@@ -8,14 +8,15 @@ cd "${ROOT_DIR}"
 
 export OPENSANDBOX_INSECURE_SERVER="${OPENSANDBOX_INSECURE_SERVER:-YES}"
 
-echo "Warming up OpenSandbox (create + close one sandbox)..."
+echo "Warming up OpenSandbox (create, code.run probe, close one sandbox)..."
 uv run python -c "
-from rath.backend import get
+from rath.backend import BackendToolCodeRun, get
 
 backend = get('opensandbox')
 sandbox = backend.open()
 try:
-    print(f'warm-up ok: {sandbox.handle}')
+    result = sandbox.dispatch(BackendToolCodeRun(code=\"print('warm')\"))
+    print(f'warm-up ok: {sandbox.handle} code_error={result.error!r}')
 finally:
     backend.close(sandbox)
 "
```

**File**: `src/rath/backend/opensandbox.py` (modified, +17/-1)
```diff
@@ -274,6 +274,14 @@ async def _run_command_with_stdout_retry(
     return execution
 
 
+def _is_transient_code_run_result(execution: Any) -> bool:
+    """Detect server-side code-session contention that often clears on retry."""
+    if execution.error is None:
+        return False
+    msg = (execution.error.value or "").lower()
+    return "session is busy" in msg
+
+
 async def _run_code_with_retry(
     ci: Any,
     source: str,
@@ -283,15 +291,23 @@ async def _run_code_with_retry(
     effective = call_timeout if call_timeout is not None else _DEFAULT_TOOL_TIMEOUT_S
     for attempt in range(2):
         try:
-            return await _await_maybe_timeout(
+            execution = await _await_maybe_timeout(
                 ci.codes.run(source, language=language),
                 effective,
             )
         except TimeoutError:
             if attempt == 0:
                 logger.debug("OpenSandbox code.run timed out; retrying once")
+                await asyncio.sleep(0.5)
                 continue
             raise
+        if attempt == 0 and _is_transient_code_run_result(execution):
+            logger.debug(
+                "OpenSandbox code.run returned transient busy state; retrying once"
+            )
+            await asyncio.sleep(0.5)
+            continue
+        return execution
     raise RuntimeError("unreachable code path in _run_code_with_retry")
 
 
```

**File**: `tests/backends/test_opensandbox_ci_stability.py` (modified, +19/-0)
```diff
@@ -8,6 +8,7 @@
 
 from rath.backend.opensandbox import (
     _command_stdout_rerun_allowed,
+    _is_transient_code_run_result,
     _is_transient_sandbox_create_error,
     _should_retry_command_for_empty_stdout,
 )
@@ -71,6 +72,24 @@ def test_command_stdout_rerun_limited_to_print_probes() -> None:
     )
 
 
+def test_transient_code_run_detects_busy_session() -> None:
+    from types import SimpleNamespace
+
+    execution = SimpleNamespace(
+        error=SimpleNamespace(value="error running codes session is busy")
+    )
+    assert _is_transient_code_run_result(execution)
+
+
+def test_transient_code_run_ignores_real_failures() -> None:
+    from types import SimpleNamespace
+
+    execution = SimpleNamespace(
+        error=SimpleNamespace(value="SyntaxError: invalid syntax"),
+    )
+    assert not _is_transient_code_run_result(execution)
+
+
 def test_transient_create_error_rejects_bind_rejection() -> None:
     exc = ValueError("host path not under any allowed prefix")
     assert not _is_transient_sandbox_create_error(exc)
```

---

### Incident Patch 3: `293556e6` (2026-07-08)
**Commit Message**: fix(opensandbox): limit stdout-race rerun to print probes only

Re-running mutating shell commands on empty stdout duplicated side
effects (stream FIFO conformance saw abb instead of ab). Keep the rerun
guard for print-based probes that motivated fe5ecd6.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `src/rath/backend/opensandbox.py` (modified, +11/-1)
```diff
@@ -243,6 +243,11 @@ async def _sandbox_create_with_transient_retry(
     raise last_exc
 
 
+def _command_stdout_rerun_allowed(cmd_str: str) -> bool:
+    """Only ``print(...)`` probes are safe to re-run on the stdout/exit_code race."""
+    return "print(" in cmd_str
+
+
 async def _run_command_with_stdout_retry(
     native: Any,
     cmd_str: str,
@@ -253,7 +258,12 @@ async def _run_command_with_stdout_retry(
         native.commands.run(cmd_str, opts=opts),
         call_timeout,
     )
-    if _should_retry_command_for_empty_stdout(execution):
+    # Only re-run read-only probes (``print(...)``). Mutating commands such as
+    # ``write_text`` must never execute twice — that race caused 'abb' != 'ab'
+    # in stream FIFO conformance when a retry fired on empty stdout.
+    if _command_stdout_rerun_allowed(
+        cmd_str
+    ) and _should_retry_command_for_empty_stdout(execution):
         logger.debug(
             "OpenSandbox command returned success with empty stdout; retrying once"
         )
```

**File**: `tests/backends/test_opensandbox_ci_stability.py` (modified, +8/-0)
```diff
@@ -7,6 +7,7 @@
 import pytest
 
 from rath.backend.opensandbox import (
+    _command_stdout_rerun_allowed,
     _is_transient_sandbox_create_error,
     _should_retry_command_for_empty_stdout,
 )
@@ -63,6 +64,13 @@ def test_transient_create_error_detects_network_timeout() -> None:
     assert _is_transient_sandbox_create_error(exc)
 
 
+def test_command_stdout_rerun_limited_to_print_probes() -> None:
+    assert _command_stdout_rerun_allowed("python3 -c \"print('hello')\"")
+    assert not _command_stdout_rerun_allowed(
+        "python3 -c \"pathlib.Path('x').write_text('y')\""
+    )
+
+
 def test_transient_create_error_rejects_bind_rejection() -> None:
     exc = ValueError("host path not under any allowed prefix")
     assert not _is_transient_sandbox_create_error(exc)
```

---

### Incident Patch 4: `1856976a` (2026-07-08)
**Commit Message**: fix(opensandbox): bound code.run with default timeout and one retry

Prevent conformance code-run tests from hanging until the 300s pytest
marker when the interpreter stalls; retry once after a 90s deadline.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `src/rath/backend/opensandbox.py` (modified, +27/-2)
```diff
@@ -140,6 +140,8 @@ async def _await_maybe_timeout(awaitable, timeout: float | None):
 _SANDBOX_CREATE_BACKOFF_S = (1.0, 2.0)
 _CREATE_REQUEST_TIMEOUT = timedelta(seconds=120)
 _CREATE_READY_TIMEOUT = timedelta(seconds=120)
+# code.run with no explicit timeout must not block until pytest's 300s marker fires.
+_DEFAULT_TOOL_TIMEOUT_S = 90.0
 
 
 def _execution_stdout_bytes(execution: Any) -> bytes:
@@ -262,6 +264,27 @@ async def _run_command_with_stdout_retry(
     return execution
 
 
+async def _run_code_with_retry(
+    ci: Any,
+    source: str,
+    language: str,
+    call_timeout: float | None,
+) -> Any:
+    effective = call_timeout if call_timeout is not None else _DEFAULT_TOOL_TIMEOUT_S
+    for attempt in range(2):
+        try:
+            return await _await_maybe_timeout(
+                ci.codes.run(source, language=language),
+                effective,
+            )
+        except TimeoutError:
+            if attempt == 0:
+                logger.debug("OpenSandbox code.run timed out; retrying once")
+                continue
+            raise
+    raise RuntimeError("unreachable code path in _run_code_with_retry")
+
+
 def bind_workspace_volumes_from_spec(
     spec: BackendSandboxSpec | None,
     sandbox_root: str,
@@ -753,8 +776,10 @@ async def _code_run(self, native: Any, call: BackendToolCodeRun) -> CodeResult:
             else call.code
         )
         ci = await CodeInterpreter.create(native)
-        execution = await _await_maybe_timeout(
-            ci.codes.run(source, language=call.language),
+        execution = await _run_code_with_retry(
+            ci,
+            source,
+            call.language,
             call.timeout,
         )
         stdout = "".join(m.text for m in execution.logs.stdout).encode("utf-8")
```

---

### Incident Patch 5: `ea6284a6` (2026-07-08)
**Commit Message**: fix(opensandbox): eliminate CI flakes without pytest reruns

Retry transient sandbox-create timeouts with a longer management API
budget, retry once when the server reports success with empty stdout,
and warm up one sandbox in CI after the image is pre-pulled from
_DEFAULT_IMAGE so tests never pay cold-start costs.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-test-opensandbox.yml` (modified, +9/-9)
```diff
@@ -10,6 +10,7 @@ on:
       - 'tests/backends/**'
       - 'tests/conformance/**'
       - 'tests/session/**'
+      - 'scripts/ci_opensandbox_prepare.sh'
       - 'pyproject.toml'
       - 'uv.lock'
   pull_request:
@@ -20,6 +21,7 @@ on:
       - 'tests/backends/**'
       - 'tests/conformance/**'
       - 'tests/session/**'
+      - 'scripts/ci_opensandbox_prepare.sh'
       - 'pyproject.toml'
       - 'uv.lock'
 
@@ -30,9 +32,6 @@ jobs:
   test-opensandbox:
     name: pytest (opensandbox)
     runs-on: ubuntu-latest
-    # OpenSandbox tests require a running server; allow failure in PRs
-    # until the CI environment is verified stable.
-    continue-on-error: ${{ github.event_name == 'pull_request' }}
     steps:
       - uses: actions/checkout@v4
       - uses: astral-sh/setup-uv@v5
@@ -50,7 +49,10 @@ jobs:
           export OPENSANDBOX_INSECURE_SERVER=YES
           uv run opensandbox-server init-config --example docker .sandbox.toml
       - name: Pre-pull sandbox image
-        run: docker pull opensandbox/code-interpreter:v1.1.0
+        run: |
+          IMAGE="$(uv run python -c 'from rath.backend.opensandbox import OpenSandboxBackend; print(OpenSandboxBackend._DEFAULT_IMAGE)')"
+          echo "Pre-pulling ${IMAGE}"
+          docker pull "${IMAGE}"
       - name: Start OpenSandbox server
         run: |
           export OPENSANDBOX_INSECURE_SERVER=YES
@@ -65,9 +67,7 @@ jobs:
           done
           echo "OpenSandbox server failed to start" >&2
           exit 1
+      - name: Warm up OpenSandbox
+        run: bash scripts/ci_opensandbox_prepare.sh
       - name: Run OpenSandbox tests
-        # Backend tests hit a real Docker daemon; the server can race
-        # stdout capture against exit_code on small jobs. Allow each
-        # test up to 2 reruns to ride out transient infra flakes
-        # (pytest-rerunfailures is a dev dep).
-        run: uv run pytest -m opensandbox --reruns 2 --reruns-delay 2
+        run: uv run pytest -m opensandbox
```

**File**: `scripts/ci_opensandbox_prepare.sh` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+#!/usr/bin/env bash
+# CI-only: create and close one sandbox so pytest never hits cold-start create.
+set -euo pipefail
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
+cd "${ROOT_DIR}"
+
+export OPENSANDBOX_INSECURE_SERVER="${OPENSANDBOX_INSECURE_SERVER:-YES}"
+
+echo "Warming up OpenSandbox (create + close one sandbox)..."
+uv run python -c "
+from rath.backend import get
+
+backend = get('opensandbox')
+sandbox = backend.open()
+try:
+    print(f'warm-up ok: {sandbox.handle}')
+finally:
+    backend.close(sandbox)
+"
```

**File**: `src/rath/backend/opensandbox.py` (modified, +142/-13)
```diff
@@ -134,6 +134,133 @@ async def _await_maybe_timeout(awaitable, timeout: float | None):
         raise TimeoutError from exc
 
 
+# Management API default is 30s — too tight for first sandbox create on a cold
+# runner (image pull + container start). ready_timeout covers health polling.
+_SANDBOX_CREATE_ATTEMPTS = 3
+_SANDBOX_CREATE_BACKOFF_S = (1.0, 2.0)
+_CREATE_REQUEST_TIMEOUT = timedelta(seconds=120)
+_CREATE_READY_TIMEOUT = timedelta(seconds=120)
+
+
+def _execution_stdout_bytes(execution: Any) -> bytes:
+    return "".join(m.text for m in execution.logs.stdout).encode("utf-8")
+
+
+def _should_retry_command_for_empty_stdout(execution: Any) -> bool:
+    """Detect opensandbox-server stdout/exit_code capture race on small runners."""
+    if execution.error is not None or execution.complete is None:
+        return False
+    if _execution_stdout_bytes(execution) or execution.logs.stderr:
+        return False
+    exit_code = execution.exit_code
+    if exit_code is not None and exit_code != 0:
+        return False
+    return True
+
+
+def _is_transient_sandbox_create_error(exc: BaseException) -> bool:
+    """Classify create-time network/timeout failures that are safe to retry."""
+    seen: set[int] = set()
+    cur: BaseException | None = exc
+    while cur is not None and id(cur) not in seen:
+        seen.add(id(cur))
+        if _SDK_AVAILABLE:
+            from opensandbox.exceptions import (
+                SandboxInternalException,
+                SandboxReadyTimeoutException,
+            )
+
+            if isinstance(cur, (SandboxInternalException, SandboxReadyTimeoutException)):
+                msg = str(cur).lower()
+                if any(
+                    token in msg
+                    for token in ("timeout", "connectivity", "network", "readtimeout")
+                ):
+                    return True
+        name = type(cur).__name__.lower()
+        if "timeout" in name or "connect" in name:
+            return True
+        cur = cur.__cause__ or cur.__context__
+    return False
+
+
+async def _sandbox_create_once(
+    image: str,
+    timeout: timedelta,
+    env: dict[str, str] | None,
+    entrypoint: list[str],
+    volumes: list | None,
+) -> Any:
+    from opensandbox.config import ConnectionConfig
+
+    connection_config = ConnectionConfig(request_timeout=_CREATE_REQUEST_TIMEOUT)
+    return await _OSBSandbox.create(
+        image,
+        timeout=timeout,
+        env=env,
+        entrypoint=entrypoint,
+        volumes=volumes,
+        connection_config=connection_config,
+        ready_timeout=_CREATE_READY_TIMEOUT,
+    )
+
+
+async def _sandbox_create_with_transient_retry(
+    image: str,
+    timeout: timedelta,
+    env: dict[str, str] | None,
+    entrypoint: list[str],
+    volumes: list | None,
+) -> Any:
+    last_exc: BaseException | None = None
+    for attempt in range(_SANDBOX_CREATE_ATTEMPTS):
+        try:
+            return await _sandbox_create_once(
+                image, timeout, env, entrypoint, volumes
+            )
+        except BaseException as exc:
+            last_exc = exc
+            if attempt + 1 >= _SANDBOX_CREATE_ATTEMPTS or not _is_transient_sandbox_create_error(
+                exc
+            ):
+                raise
+            delay = _SANDBOX_CREATE_BACKOFF_S[
+                min(attempt, len(_SANDBOX_CREATE_BACKOFF_S) - 1)
+            ]
+            logger.warning(
+                "OpenSandbox create transient failure (attempt %s/%s); "
+                "retrying in %.1fs: %s",
+                attempt + 1,
+                _SANDBOX_CREATE_ATTEMPTS,
+                delay,
+                exc,
+            )
+            await asyncio.sleep(delay)
+    assert last_exc is not None
+    raise last_exc
+
+
+async def _run_command_with_stdout_retry(
+    native: Any,
+    cmd_str: str,
+    opts: Any,
+    call_timeout: float | None,
+) -> Any:
+    execution = await _await_maybe_timeout(
+        native.commands.run(cmd_str, opts=opts),
+        call_timeout,
+    )
+    if _should_retry_command_for_empty_stdout(execution):
+        logger.debug(
+            "OpenSandbox command returned success with empty stdout; retrying once"
+        )
+        execution = await _await_maybe_timeout(
+            native.commands.run(cmd_str, opts=opts),
+            call_timeout,
+        )
+    return execution
+
+
 def bind_workspace_volumes_from_spec(
     spec: BackendSandboxSpec | None,
     sandbox_root: str,
@@ -208,12 +335,12 @@ async def _create_sandbox_with_optional_bind_fallback(
     """Create sandbox; on bind rejection, retry once with ``volumes=None``."""
 
     try:
-        native = await _OSBSandbox.create(
+        native = await _sandbox_create_with_transient_retry(
             image,
-            timeout=timeout,
-            env=env,
-            entrypoint=entrypoint,
-            volumes=volumes,
+            timeout,
+            env,
+            entrypoint,
+            volumes,
         
```

**File**: `tests/backends/test_opensandbox_ci_stability.py` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+"""Offline guards for OpenSandbox CI stability (no live server required)."""
+
+from __future__ import annotations
+
+from pathlib import Path
+
+import pytest
+
+from rath.backend.opensandbox import (
+    _is_transient_sandbox_create_error,
+    _should_retry_command_for_empty_stdout,
+)
+
+pytest.importorskip("opensandbox")
+from opensandbox.exceptions import SandboxInternalException  # noqa: E402
+from opensandbox.models.execd import (  # noqa: E402
+    Execution,
+    ExecutionComplete,
+    ExecutionLogs,
+    OutputMessage,
+)
+
+
+def test_ci_prepull_image_matches_backend_default() -> None:
+    workflow = Path(".github/workflows/ci-test-opensandbox.yml").read_text(
+        encoding="utf-8"
+    )
+    assert "OpenSandboxBackend._DEFAULT_IMAGE" in workflow
+    assert "opensandbox/code-interpreter:v1.0.2" not in workflow
+    assert "--reruns" not in workflow
+
+
+def test_should_retry_empty_stdout_race() -> None:
+    execution = Execution(
+        complete=ExecutionComplete(timestamp=1, execution_time_in_millis=5),
+        exit_code=0,
+    )
+    assert _should_retry_command_for_empty_stdout(execution)
+
+
+def test_should_not_retry_when_stdout_present() -> None:
+    execution = Execution(
+        complete=ExecutionComplete(timestamp=1, execution_time_in_millis=5),
+        exit_code=0,
+        logs=ExecutionLogs(stdout=[OutputMessage(text="hello\n", timestamp=1)]),
+    )
+    assert not _should_retry_command_for_empty_stdout(execution)
+
+
+def test_should_not_retry_nonzero_exit() -> None:
+    execution = Execution(
+        complete=ExecutionComplete(timestamp=1, execution_time_in_millis=5),
+        exit_code=7,
+    )
+    assert not _should_retry_command_for_empty_stdout(execution)
+
+
+def test_transient_create_error_detects_network_timeout() -> None:
+    exc = SandboxInternalException(
+        "Network connectivity error:",
+        cause=TimeoutError("read timed out"),
+    )
+    assert _is_transient_sandbox_create_error(exc)
+
+
+def test_transient_create_error_rejects_bind_rejection() -> None:
+    exc = ValueError("host path not under any allowed prefix")
+    assert not _is_transient_sandbox_create_error(exc)
```

---

### Incident Patch 6: `96961a0a` (2026-07-08)
**Commit Message**: fix(ci): gate litellm resolver test and align integration workflows

Skip litellm credential characterization when the optional extra is absent,
pre-pull code-interpreter v1.1.0 in OpenSandbox CI, and harden OpenViking
setup-uv so cache prune does not fail when secrets are missing.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-test-opensandbox.yml` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ jobs:
           export OPENSANDBOX_INSECURE_SERVER=YES
           uv run opensandbox-server init-config --example docker .sandbox.toml
       - name: Pre-pull sandbox image
-        run: docker pull opensandbox/code-interpreter:v1.0.2
+        run: docker pull opensandbox/code-interpreter:v1.1.0
       - name: Start OpenSandbox server
         run: |
           export OPENSANDBOX_INSECURE_SERVER=YES
```

**File**: `.github/workflows/ci-test-openviking.yml` (modified, +6/-1)
```diff
@@ -42,6 +42,11 @@ jobs:
       - uses: astral-sh/setup-uv@v5
         with:
           python-version: '3.12'
+          # When repository secrets are absent we skip uv sync; without this
+          # the post-job cache prune fails because no cache dir was created.
+          prune-cache: false
+      - name: Install dev dependencies
+        run: uv sync --dev --frozen
       - name: Check OpenViking credentials
         id: creds
         env:
@@ -57,7 +62,7 @@ jobs:
           fi
       - name: Install OpenViking SDK
         if: steps.creds.outputs.available == 'true'
-        run: uv sync --extra openviking --frozen
+        run: uv sync --dev --extra openviking --frozen
       - name: Start OpenViking server
         if: steps.creds.outputs.available == 'true'
         env:
```

**File**: `tests/llm/test_credentials_via_env_registry.py` (modified, +1/-0)
```diff
@@ -65,6 +65,7 @@ def test_anthropic_key_precedence(monkeypatch: pytest.MonkeyPatch) -> None:
 
 
 def test_litellm_key_precedence(monkeypatch: pytest.MonkeyPatch) -> None:
+    pytest.importorskip("litellm")
     from rath.llm.litellm.client import _resolve_litellm_key
 
     monkeypatch.setenv("LITELLM_API_KEY", "lk-env")
```

---

### Incident Patch 7: `29c0132d` (2026-07-07)
**Commit Message**: fix(backend): track current code-interpreter image v1.1.0 (P2.6)

code-interpreter v1.1.0 relocated the launcher from
/opt/opensandbox/code-interpreter.sh (v1.0.2) to
/opt/code-interpreter/code-interpreter.sh, and v1.0.2 is no longer pullable.
The hardcoded v1.0.2 default made a fresh install fail at container start with
exit 127. Bump _DEFAULT_IMAGE to v1.1.0 and _DEFAULT_ENTRYPOINT to the new path
(both still overridable via BackendSandboxSpec). Offline guards pin the defaults
so the drift is caught without a live backend; verified end-to-end against a
real v1.1.0 sandbox (echo exit 0, no shim).

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `src/rath/backend/opensandbox.py` (modified, +11/-5)
```diff
@@ -252,10 +252,15 @@ class OpenSandboxBackend(Backend):
 
     name: ClassVar[str] = "opensandbox"
 
-    _DEFAULT_IMAGE: ClassVar[str] = "opensandbox/code-interpreter:v1.0.2"
+    # code-interpreter v1.1.0 relocated the launcher from
+    # /opt/opensandbox/code-interpreter.sh (v1.0.2) to
+    # /opt/code-interpreter/code-interpreter.sh. v1.0.2 is no longer pullable,
+    # so track the current image + path (a stale default fails at container
+    # start with exit 127). Callers can still override both via BackendSandboxSpec.
+    _DEFAULT_IMAGE: ClassVar[str] = "opensandbox/code-interpreter:v1.1.0"
     _DEFAULT_TIMEOUT: ClassVar[timedelta] = timedelta(minutes=10)
     _DEFAULT_ENTRYPOINT: ClassVar[tuple[str, ...]] = (
-        "/opt/opensandbox/code-interpreter.sh",
+        "/opt/code-interpreter/code-interpreter.sh",
     )
     _SANDBOX_ROOT: ClassVar[str] = "/workspace"
 
@@ -637,9 +642,10 @@ def _join_cmd(cmd: Sequence[str]) -> str:
 def _wrap_python_for_traceback(code: str) -> str:
     """Wrap user Python so an uncaught exception always writes a traceback to stderr.
 
-    The OpenSandbox v1.0.2 code-interpreter image does not consistently
-    populate ``Execution.error`` for top-level Python raises. We guarantee
-    stderr-side surfacing by exec'ing the user source inside a try/except.
+    The OpenSandbox code-interpreter image does not consistently populate
+    ``Execution.error`` for top-level Python raises (observed on v1.0.2, still
+    prudent on v1.1.0). We guarantee stderr-side surfacing by exec'ing the user
+    source inside a try/except.
     The original ``raise`` is re-raised so the runtime still observes the
     failure (exit_code, ``Execution.error``) if it cares to. Source is
     passed as a base64 blob to avoid quoting edge cases.
```

**File**: `tests/backends/test_opensandbox_image_defaults.py` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+"""P2.6 — opensandbox default image/entrypoint track the current image.
+
+The code-interpreter image moved its entrypoint from
+``/opt/opensandbox/code-interpreter.sh`` (v1.0.2) to
+``/opt/code-interpreter/code-interpreter.sh`` (v1.1.0+). A fresh install
+pulling today's image with the old hardcoded entrypoint fails at container
+start with exit 127. These offline guards pin the defaults to the current
+image so that regression is caught without needing a live backend.
+"""
+
+from __future__ import annotations
+
+from rath.backend.opensandbox import OpenSandboxBackend
+
+
+def test_default_image_is_current() -> None:
+    # Must target a pullable, current tag (not the retired v1.0.2).
+    assert OpenSandboxBackend._DEFAULT_IMAGE == "opensandbox/code-interpreter:v1.1.0"
+
+
+def test_default_entrypoint_matches_current_image_layout() -> None:
+    # v1.1.0 relocated the launcher under /opt/code-interpreter/.
+    assert OpenSandboxBackend._DEFAULT_ENTRYPOINT == (
+        "/opt/code-interpreter/code-interpreter.sh",
+    )
```

---

### Incident Patch 8: `f993fc8d` (2026-07-05)
**Commit Message**: Merge pull request #42 from skyswordx/codex/log-agent-memory-failures

fix(flow): warn on best-effort Agent memory failures

**File**: `src/rath/flow/agent.py` (modified, +15/-3)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import logging
 from collections.abc import Callable
 from dataclasses import replace
 from typing import Union
@@ -17,6 +18,8 @@
 
 MemoryArg = Union[MemoryStore, MemoryStoreSpec, str, None]
 
+logger = logging.getLogger(__name__)
+
 
 def _resolve_memory(memory: MemoryArg) -> MemoryStore | None:
     """Resolve any of the accepted ``memory=`` forms to an open store.
@@ -132,7 +135,12 @@ def _inject_memory_into(self, session: Session) -> Session:
         assert self.memory is not None  # caller-checked
         try:
             extras = self._memory_inject.inject(session, self.memory)
-        except Exception:  # noqa: BLE001 -- recall must not break the loop
+        except Exception as exc:  # noqa: BLE001 -- recall must not break the loop
+            logger.warning(
+                "memory injection failed; continuing without recalled memory: %s",
+                exc,
+                exc_info=True,
+            )
             extras = ()
         if not extras:
             return session
@@ -175,8 +183,12 @@ def _commit_session(self, session: Session, *, wait: bool) -> None:
                     wait=wait,
                 )
             )
-        except Exception:  # noqa: BLE001 -- commit must not break forward
-            pass
+        except Exception as exc:  # noqa: BLE001 -- commit must not break forward
+            logger.warning(
+                "memory commit failed; continuing without persisted memory: %s",
+                exc,
+                exc_info=True,
+            )
 
     # ---------------------------------------------------------------- public memory API
 
```

**File**: `tests/flow/test_agent_forward_memory.py` (modified, +60/-1)
```diff
@@ -8,6 +8,7 @@
 
 from __future__ import annotations
 
+import logging
 from dataclasses import dataclass, field
 
 import pytest
@@ -25,7 +26,7 @@
     MemoryResult,
 )
 from rath.session import Session, session_registry
-from rath.session.chunk import ChunkKind
+from rath.session.chunk import ChunkKind, ChunkRow
 from tests.session.scripted_loop_executor import ScriptedSessionLoopExecutor
 
 
@@ -38,6 +39,7 @@ def _clear_active_session_registry() -> None:
 @dataclass
 class _FakeBackend(MemoryBackend):
     find_hits: tuple[MemoryHit, ...] = ()
+    commit_error: Exception | None = None
     ops_seen: list[MemoryOp] = field(default_factory=list)
 
     @classmethod
@@ -77,12 +79,19 @@ def dispatch(self, store: MemoryStore, op: MemoryOp) -> MemoryResult:
         if isinstance(op, MemoryOpFind):
             return MemoryFindResult(hits=self.find_hits)
         if isinstance(op, MemoryOpCommit):
+            if self.commit_error is not None:
+                raise self.commit_error
             return MemoryCommitResult(
                 task_id="task-x", archived_uri="memory://session/s/", extracted_count=-1
             )
         raise NotImplementedError(f"fake: no handler for {type(op).__name__}")
 
 
+class _FailingInjection:
+    def inject(self, session: Session, store: object) -> tuple[ChunkRow, ...]:
+        raise RuntimeError("recall exploded")
+
+
 def _scripted_response(text: str) -> RathLLMChatResponse:
     return RathLLMChatResponse(
         id="chatcmpl-test",
@@ -178,3 +187,53 @@ def test_forward_without_commit_does_not_dispatch_commit() -> None:
     sess = Session.from_user_message("nothing important")
     agent.forward(sess)
     assert not any(isinstance(op, MemoryOpCommit) for op in backend.ops_seen)
+
+
+def test_forward_logs_warning_when_memory_injection_fails(
+    caplog: pytest.LogCaptureFixture,
+) -> None:
+    backend = _FakeBackend(find_hits=())
+    store = backend.open()
+    exec_ = ScriptedSessionLoopExecutor([_scripted_response("ack")])
+    agent = Agent(
+        "system",
+        model="gpt-5.5",
+        memory=store,
+        memory_inject=_FailingInjection(),
+    )
+    agent._executor_override = exec_
+    sess = Session.from_user_message("remember me")
+
+    with caplog.at_level(logging.WARNING, logger="rath.flow.agent"):
+        out = agent.forward(sess)
+
+    assert out.text() == "ack"
+    assert any(
+        "memory injection failed" in rec.getMessage() and rec.exc_info
+        for rec in caplog.records
+    )
+
+
+def test_forward_logs_warning_when_auto_commit_fails(
+    caplog: pytest.LogCaptureFixture,
+) -> None:
+    backend = _FakeBackend(find_hits=(), commit_error=RuntimeError("commit exploded"))
+    store = backend.open()
+    exec_ = ScriptedSessionLoopExecutor([_scripted_response("ack")])
+    agent = Agent(
+        "system",
+        model="gpt-5.5",
+        memory=store,
+        commit_on_forward=True,
+    )
+    agent._executor_override = exec_
+    sess = Session.from_user_message("remember me")
+
+    with caplog.at_level(logging.WARNING, logger="rath.flow.agent"):
+        out = agent.forward(sess)
+
+    assert out.text() == "ack"
+    assert any(
+        "memory commit failed" in rec.getMessage() and rec.exc_info
+        for rec in caplog.records
+    )
```

---

### Incident Patch 9: `29bdde81` (2026-07-05)
**Commit Message**: Merge pull request #43 from skyswordx/codex/memory-store-refcount

fix(memory): guard MemoryStore refcount updates

**File**: `src/rath/memory/abc.py` (modified, +18/-8)
```diff
@@ -9,6 +9,7 @@
 
 from __future__ import annotations
 
+import threading
 from abc import ABC, abstractmethod
 from collections.abc import Mapping
 from dataclasses import dataclass, field, replace
@@ -101,25 +102,34 @@ class MemoryStore:
     spec: MemoryStoreSpec | None = None
     closed: bool = field(default=False)
     _refcount: int = field(default=0, repr=False)
+    # Match ``BackendSandbox`` lifecycle locking: serialize refcount updates,
+    # then let ``release`` call ``backend.close`` outside the lock.
+    _refcount_lock: threading.Lock = field(
+        default_factory=threading.Lock, repr=False, compare=False
+    )
 
     @property
     def refcount(self) -> int:
         """Current number of live references; read-only mirror of internal state."""
-        return self._refcount
+        with self._refcount_lock:
+            return self._refcount
 
     def acquire(self) -> "MemoryStore":
         """Add one reference; return ``self`` for chaining."""
-        if self.closed:
-            raise MemoryStoreClosed(self.handle)
-        self._refcount += 1
+        with self._refcount_lock:
+            if self.closed:
+                raise MemoryStoreClosed(self.handle)
+            self._refcount += 1
         return self
 
     def release(self) -> None:
         """Drop one reference; close via the backend when the count hits zero."""
-        if self.closed:
-            return
-        self._refcount -= 1
-        if self._refcount <= 0:
+        with self._refcount_lock:
+            if self.closed:
+                return
+            self._refcount -= 1
+            should_close = self._refcount <= 0
+        if should_close:
             self.backend.close(self)
 
     def __enter__(self) -> "MemoryStore":
```

**File**: `tests/memory/unit/test_store_refcount.py` (modified, +82/-0)
```diff
@@ -2,6 +2,9 @@
 
 from __future__ import annotations
 
+import threading
+import time
+
 import pytest
 
 from rath.memory.abc import MemoryStore, MemoryStoreSpec
@@ -22,6 +25,38 @@ def close(self, store: MemoryStore) -> None:
         store.closed = True
 
 
+class _YieldingRefcount:
+    """Refcount test double that makes read/modify/write races deterministic."""
+
+    def __init__(self, value: int) -> None:
+        self.value = value
+
+    def __iadd__(self, amount: int) -> "_YieldingRefcount":
+        current = self.value
+        time.sleep(0.01)
+        self.value = current + amount
+        return self
+
+    def __isub__(self, amount: int) -> "_YieldingRefcount":
+        current = self.value
+        time.sleep(0.01)
+        self.value = current - amount
+        return self
+
+    def __le__(self, other: object) -> bool:
+        if not isinstance(other, int):
+            return NotImplemented
+        return self.value <= other
+
+    def __eq__(self, other: object) -> bool:
+        if not isinstance(other, int):
+            return NotImplemented
+        return self.value == other
+
+    def __repr__(self) -> str:
+        return repr(self.value)
+
+
 def _make_store(backend: _FakeBackend | None = None) -> MemoryStore:
     be = backend if backend is not None else _FakeBackend()
     # ``backend`` is typed as ``MemoryBackend`` but the dataclass accepts any
@@ -85,6 +120,53 @@ def test_nested_context_manager_tracks_refcount():
     assert fake.close_calls == [store]
 
 
+def test_concurrent_acquire_release_is_safe():
+    """Hammer acquire/release from many threads; refcount must stay coherent."""
+    fake = _FakeBackend()
+    store = _make_store(fake)
+    store.acquire()  # baseline ref so the count cannot drain to zero mid-test
+
+    threads = 8
+    iters = 1000
+
+    def worker() -> None:
+        for _ in range(iters):
+            store.acquire()
+            store.release()
+
+    workers = [threading.Thread(target=worker) for _ in range(threads)]
+    for t in workers:
+        t.start()
+    for t in workers:
+        t.join()
+
+    assert store.refcount == 1
+    assert store.closed is False
+    assert fake.close_calls == []
+    store.release()
+    assert store.closed is True
+    assert fake.close_calls == [store]
+
+
+def test_concurrent_acquire_serializes_refcount_mutation():
+    store = _make_store()
+    store._refcount = _YieldingRefcount(1)  # type: ignore[assignment]
+    ready = threading.Barrier(3)
+
+    def worker() -> None:
+        ready.wait()
+        store.acquire()
+
+    workers = [threading.Thread(target=worker) for _ in range(2)]
+    for t in workers:
+        t.start()
+    ready.wait()
+    for t in workers:
+        t.join()
+
+    assert store.refcount == 3
+
+
 def test_acquire_after_close_raises_memory_store_closed():
     fake = _FakeBackend()
     store = _make_store(fake)
```

---

### Incident Patch 10: `6cc532a4` (2026-07-05)
**Commit Message**: feat(session): loop falls back to session-bound provider (P4.4)

run_session_loop / run_session_compress / select_session now accept
agent_provider=None and resolve the effective provider as:
explicit agent_provider (Agent/AgentParam) > user_session.provider
(session.to(Provider(...))). Missing both raises a clear ValueError before
any model call. Every existing Agent call passes agent_provider explicitly,
so behavior is unchanged there; the fallback only enables raw/CLI use that
placed the provider on the session in P4.3.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `src/rath/session/compress.py` (modified, +11/-1)
```diff
@@ -33,7 +33,7 @@ def run_session_compress(
     user_session: Session,
     agent_session: Session,
     *,
-    agent_provider: Provider,
+    agent_provider: Provider | None = None,
     executor: SessionLoopExecutor | None = None,
     compress_instruction: str | None = None,
     register_sessions: bool = True,
@@ -67,6 +67,16 @@ def run_session_compress(
     ``persist_path``) with a trailer.
     """
 
+    # Explicit provider wins; otherwise fall back to the user session's bound
+    # provider (session.to(Provider(...))). Mirrors run_session_loop (P4.4).
+    if agent_provider is None:
+        agent_provider = user_session.provider
+    if agent_provider is None:
+        raise ValueError(
+            "no provider for run_session_compress: pass agent_provider=Provider(...) "
+            "or bind one on the session via session.to(Provider(...))"
+        )
+
     # Join lazy input sessions before reading their chunk_table.
     if user_session._pending is not None:
         user_session.synchronize()
```

**File**: `src/rath/session/loop.py` (modified, +16/-1)
```diff
@@ -405,7 +405,7 @@ def run_session_loop(
     user_session: Session,
     agent_session: Session,
     *,
-    agent_provider: Provider,
+    agent_provider: Provider | None = None,
     tools: list[FlowToolCall] | None = None,
     executor: SessionLoopExecutor | None = None,
     max_tool_rounds: int = 64,
@@ -449,6 +449,21 @@ def run_session_loop(
     executes the loop on a background asyncio loop so multiple
     ``run_session_loop`` calls can overlap.
     """
+    # Resolve the effective provider. An explicit ``agent_provider`` (as passed
+    # by Agent/AgentParam) always wins; otherwise fall back to a provider bound
+    # on the user session via ``session.to(Provider(...))`` (P4.3). This keeps
+    # every existing Agent call unchanged while enabling raw/CLI use that placed
+    # the provider on the session.
+    effective_provider = (
+        agent_provider if agent_provider is not None else user_session.provider
+    )
+    if effective_provider is None:
+        raise ValueError(
+            "no provider for run_session_loop: pass agent_provider=Provider(...) "
+            "or bind one on the session via session.to(Provider(...))"
+        )
+    agent_provider = effective_provider
+
     # Join lazy input sessions before submitting the loop coroutine.
     if user_session._pending is not None:
         user_session.synchronize()
```

**File**: `src/rath/session/select.py` (modified, +11/-1)
```diff
@@ -51,7 +51,7 @@ def select_session(
     user_session: Session,
     agent_session: Session,
     *workflow_descriptions: str,
-    agent_provider: Provider,
+    agent_provider: Provider | None = None,
     executor: SessionLoopExecutor | None = None,
 ) -> tuple[int, str]:
     """LLM picks the best-matching description for the current user session.
@@ -69,6 +69,16 @@ def select_session(
     if not workflow_descriptions:
         return (-1, "")
 
+    # Explicit provider wins; otherwise fall back to the user session's bound
+    # provider (session.to(Provider(...))). Mirrors run_session_loop (P4.4).
+    if agent_provider is None:
+        agent_provider = user_session.provider
+    if agent_provider is None:
+        raise ValueError(
+            "no provider for select_session: pass agent_provider=Provider(...) "
+            "or bind one on the session via session.to(Provider(...))"
+        )
+
     # Join lazy input sessions before reading their chunk_table.
     if user_session._pending is not None:
         user_session.synchronize()
```

**File**: `tests/session/test_loop_provider_precedence.py` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+"""P4.4 — run_session_loop provider precedence.
+
+- explicit agent_provider= wins (Agent path unchanged);
+- when omitted, the loop falls back to the session-bound provider
+  (session.to(Provider(...)));
+- omitting both raises a clear ValueError before any model call.
+
+Uses a fake executor so no network/key is needed (this tests provider
+*resolution*, not a live completion).
+"""
+
+from __future__ import annotations
+
+import pytest
+
+from rath.llm.chat_response import (
+    RathLLMAssistantMessage,
+    RathLLMChatChoice,
+    RathLLMChatResponse,
+    RathLLMTokenUsage,
+)
+from rath.llm.provider import Provider
+from rath.session.loop import run_session_loop
+from rath.session.session import Session
+
+
+class _RecordingExecutor:
+    """Minimal SessionLoopExecutor that records the request's resolved model.
+
+    The effective provider is folded into the chat request (model etc.) before
+    ``complete`` runs, so ``req.model`` reflects which provider won.
+    """
+
+    def __init__(self) -> None:
+        self.seen_model: str | None = None
+
+    def complete(self, req):  # type: ignore[no-untyped-def]
+        self.seen_model = req.model
+        return RathLLMChatResponse(
+            id="resp-1",
+            choices=(
+                RathLLMChatChoice(
+                    index=0,
+                    finish_reason="stop",
+                    message=RathLLMAssistantMessage(content="done"),
+                ),
+            ),
+            created=0,
+            model=req.model or "",
+            usage=RathLLMTokenUsage(
+                prompt_tokens=1, completion_tokens=1, total_tokens=2
+            ),
+        )
+
+    def tool_schemas(self):  # type: ignore[no-untyped-def]
+        return ()
+
+    def dispatch_tool(self, session, tool, arguments):  # type: ignore[no-untyped-def]
+        raise AssertionError("no tools in this test")
+
+
+def _run(user: Session, agent: Session, **kw):  # type: ignore[no-untyped-def]
+    ex = _RecordingExecutor()
+    out = run_session_loop(user, agent, executor=ex, lazy=False, **kw)
+    out.synchronize()
+    return out, ex
+
+
+def test_explicit_agent_provider_wins() -> None:
+    user = Session.from_user_message("hi").to(Provider(model="SESSION", api_key="s"))
+    agent = Session.from_agent_prompt("sys")
+    _out, ex = _run(user, agent, agent_provider=Provider(model="AGENT", api_key="a"))
+    assert ex.seen_model == "AGENT"
+
+
+def test_session_provider_fallback() -> None:
+    user = Session.from_user_message("hi").to(Provider(model="SESSION", api_key="s"))
+    agent = Session.from_agent_prompt("sys")
+    _out, ex = _run(user, agent)  # no agent_provider
+    assert ex.seen_model == "SESSION"
+
+
+def test_missing_both_raises() -> None:
+    user = Session.from_user_message("hi")  # no provider bound
+    agent = Session.from_agent_prompt("sys")
+    with pytest.raises(ValueError, match="no provider"):
+        run_session_loop(user, agent, executor=_RecordingExecutor(), lazy=False)
```

---

### Incident Patch 11: `ea13b867` (2026-07-05)
**Commit Message**: refactor(persistence): backend+memory registries use atomic writes (P3.2)

Replace bare path.write_text/json.dumps in the opensandbox remote-sandbox
registry (record_remote/touch_remote) and the local memory adapter (md
content, resource meta, commit archive, extracted memos, store meta.json,
and .vec sidecars) with rath.persistence.atomic writes. These were the
non-atomic write sites that could leave a truncated file on a crash; they now
match the session-plane's crash-safety and gain the Windows concurrent-replace
retry. Behavior is unchanged (files parse, no debris), pinned by real-fs tests
plus a source guard that the registry no longer uses bare write_text.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `src/rath/backend/persistence/registry.py` (modified, +3/-8)
```diff
@@ -37,6 +37,7 @@
 )
 from rath.backend.registry import get as backend_get
 from rath.config.secrets import chmod_user_only
+from rath.persistence.atomic import atomic_write_json
 
 __all__ = [
     "PersistentSandboxRegistry",
@@ -181,10 +182,7 @@ def record_remote(
             "created_at": now.isoformat(),
             "last_used_at": now.isoformat(),
         }
-        path.write_text(
-            json.dumps(record, indent=2, ensure_ascii=False) + "\n",
-            encoding="utf-8",
-        )
+        atomic_write_json(path, record)
         chmod_user_only(path)
         return sid
 
@@ -203,10 +201,7 @@ def touch_remote(self, sandbox_id: UUID | str) -> None:
             logger.warning("touch_remote: %s is unreadable", path, exc_info=True)
             return
         data["last_used_at"] = datetime.now(timezone.utc).isoformat()
-        path.write_text(
-            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
-            encoding="utf-8",
-        )
+        atomic_write_json(path, data)
 
     def load_remote(self, sandbox_id: UUID | str) -> RemoteSandboxRecord | None:
         """Read one remote-sandbox index file. Returns ``None`` when missing."""
```

**File**: `src/rath/memory/adapters/local.py` (modified, +7/-15)
```diff
@@ -63,6 +63,7 @@
     memory_uri_prefix,
     to_public_uri,
 )
+from rath.persistence.atomic import atomic_write_json, atomic_write_text
 
 logger = logging.getLogger(__name__)
 
@@ -228,7 +229,7 @@ def _dispatch_write(self, bound: "_LocalHandle", op: MemoryOpWrite) -> MemoryRes
         target = resolved.with_suffix(_MD_SUFFIX)
         target.parent.mkdir(parents=True, exist_ok=True)
         data = op.content
-        target.write_text(data, encoding="utf-8")
+        atomic_write_text(target, data)
         # Stale embedding/meta sidecars must not persist past a content rewrite.
         for suffix in _HIDDEN_SUFFIXES:
             sidecar = resolved.with_suffix(suffix)
@@ -345,7 +346,7 @@ def _dispatch_resource(
             meta_lines.extend(["", "## Reason", op.reason])
         if op.instruction:
             meta_lines.extend(["", "## Instruction", op.instruction])
-        meta_path.write_text("\n".join(meta_lines) + "\n", encoding="utf-8")
+        atomic_write_text(meta_path, "\n".join(meta_lines), newline=True)
 
         return MemoryWriteResult(
             uri=f"{target_uri.rstrip('/')}/{sha}",
@@ -368,10 +369,7 @@ def _dispatch_commit(
         commit_root.mkdir(parents=True, exist_ok=True)
         archive_path = commit_root / "messages.json"
         normalized = [_normalize_message(m) for m in op.messages]
-        archive_path.write_text(
-            json.dumps(normalized, ensure_ascii=False, indent=2),
-            encoding="utf-8",
-        )
+        atomic_write_json(archive_path, normalized)
         archived_uri = (
             f"{MEMORY_URI_PREFIX}session/{op.session_id}/commits/{stamp}/messages.json"
         )
@@ -398,7 +396,7 @@ def _dispatch_commit(
                 continue
             target = sub.with_suffix(_MD_SUFFIX)
             target.parent.mkdir(parents=True, exist_ok=True)
-            target.write_text(content, encoding="utf-8")
+            atomic_write_text(target, content)
         return MemoryCommitResult(
             task_id=None,
             archived_uri=archived_uri,
@@ -429,10 +427,7 @@ def _touch_meta(
         if not update_only:
             meta["embedding_provider"] = options.get("embedding_provider")
             meta["vlm_provider"] = options.get("vlm_provider")
-        meta_path.write_text(
-            json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
-            encoding="utf-8",
-        )
+        atomic_write_json(meta_path, meta)
 
 
 def _resolve_uri(
@@ -765,10 +760,7 @@ def _load_vec(sidecar: Path, *, expected_model: str) -> list[float] | None:
 def _store_vec(sidecar: Path, model: str, vec: Any) -> None:
     payload = {"model": model, "vector": [float(x) for x in vec]}
     sidecar.parent.mkdir(parents=True, exist_ok=True)
-    sidecar.write_text(
-        json.dumps(payload, ensure_ascii=False),
-        encoding="utf-8",
-    )
+    atomic_write_json(sidecar, payload, indent=None)
 
 
 def _cosine(u: Any, v: list[float]) -> float:
```

**File**: `tests/backends/persistence/test_atomic_registry.py` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+"""P3.2 — backend remote-sandbox registry writes are atomic (no bare write_text).
+
+Real filesystem. Verifies record_remote / touch_remote leave a complete,
+parseable file and no ``.atomic_*.tmp`` debris, and that concurrent record
+calls to the same id do not raise on Windows (the atomic primitive serializes
++ retries the replace).
+"""
+
+from __future__ import annotations
+
+import json
+import threading
+from pathlib import Path
+from uuid import uuid4
+
+from rath.backend.persistence.registry import PersistentSandboxRegistry
+
+
+def test_record_remote_is_atomic_and_clean(_isolate_openrath_home: Path) -> None:
+    reg = PersistentSandboxRegistry()
+    sid = reg.record_remote("opensandbox", "native-123")
+    rec = reg.load_remote(sid)
+    assert rec is not None and rec.remote_id == "native-123"
+
+    # File is complete JSON, no temp debris in the opensandbox dir.
+    from rath.backend.persistence.paths import opensandbox_index_path
+
+    path = opensandbox_index_path(sid)
+    json.loads(path.read_text(encoding="utf-8"))  # parses
+    debris = [p.name for p in path.parent.glob(".atomic_*")]
+    assert debris == []
+
+
+def test_touch_remote_is_atomic(_isolate_openrath_home: Path) -> None:
+    reg = PersistentSandboxRegistry()
+    sid = reg.record_remote("opensandbox", "native-xyz")
+    before = reg.load_remote(sid)
+    assert before is not None
+    reg.touch_remote(sid)
+    after = reg.load_remote(sid)
+    assert after is not None
+    assert after.remote_id == "native-xyz"
+    # last_used advanced (or at least stayed a valid ISO timestamp).
+    assert after.last_used_at is not None
+
+
+def test_registry_uses_atomic_primitive_not_bare_write_text() -> None:
+    """Guard: the registry persists JSON via the atomic primitive, not the
+    non-atomic path.write_text (which leaves a truncated file on a crash)."""
+    import rath.backend.persistence.registry as reg_mod
+
+    src = Path(reg_mod.__file__).read_text(encoding="utf-8")
+    assert "atomic_write_json" in src, "registry should use atomic_write_json"
+    assert ".write_text(" not in src, "registry should not use bare write_text"
+
+
+def test_concurrent_record_same_id_no_error(_isolate_openrath_home: Path) -> None:
+    reg = PersistentSandboxRegistry()
+    fixed = uuid4()
+    barrier = threading.Barrier(5)
+    errors: list[BaseException] = []
+
+    def _w(tag: int) -> None:
+        try:
+            barrier.wait(timeout=5.0)
+            reg.record_remote("opensandbox", f"native-{tag}", sandbox_id=fixed)
+        except BaseException as exc:  # noqa: BLE001
+            errors.append(exc)
+
+    threads = [threading.Thread(target=_w, args=(i,)) for i in range(5)]
+    for t in threads:
+        t.start()
+    for t in threads:
+        t.join(timeout=10.0)
+    assert not errors, f"concurrent record_remote raised: {errors!r}"
+    rec = reg.load_remote(fixed)
+    assert rec is not None and rec.remote_id.startswith("native-")
```

---

### Incident Patch 12: `4ad56266` (2026-07-05)
**Commit Message**: fix(flow): warn on best-effort Agent memory failures

Agent memory recall and commit-on-forward are best-effort paths, so failures should remain non-fatal while still being diagnosable. This records warnings at the Agent boundary without defining a broader logging policy.

Constraint: Keep the PR scoped to existing recoverable-failure logging conventions.

Rejected: Introduce a global logging abstraction | too broad for a focused third-party PR.

Confidence: high

Scope-risk: narrow

Directive: Keep future logging-system policy changes separate from this local observability fix.

Tested: uv run pytest tests/flow/test_agent_forward_memory.py tests/flow/test_memory_inject.py -q -p no:cacheprovider; uv run ruff check src/rath/flow/agent.py tests/flow/test_agent_forward_memory.py; uv run ruff format --check src/rath/flow/agent.py tests/flow/test_agent_forward_memory.py; uv run mypy --no-incremental

Not-tested: full pytest suite

**File**: `src/rath/flow/agent.py` (modified, +15/-3)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import logging
 from collections.abc import Callable
 from dataclasses import replace
 from typing import Union
@@ -17,6 +18,8 @@
 
 MemoryArg = Union[MemoryStore, MemoryStoreSpec, str, None]
 
+logger = logging.getLogger(__name__)
+
 
 def _resolve_memory(memory: MemoryArg) -> MemoryStore | None:
     """Resolve any of the accepted ``memory=`` forms to an open store.
@@ -132,7 +135,12 @@ def _inject_memory_into(self, session: Session) -> Session:
         assert self.memory is not None  # caller-checked
         try:
             extras = self._memory_inject.inject(session, self.memory)
-        except Exception:  # noqa: BLE001 -- recall must not break the loop
+        except Exception as exc:  # noqa: BLE001 -- recall must not break the loop
+            logger.warning(
+                "memory injection failed; continuing without recalled memory: %s",
+                exc,
+                exc_info=True,
+            )
             extras = ()
         if not extras:
             return session
@@ -175,8 +183,12 @@ def _commit_session(self, session: Session, *, wait: bool) -> None:
                     wait=wait,
                 )
             )
-        except Exception:  # noqa: BLE001 -- commit must not break forward
-            pass
+        except Exception as exc:  # noqa: BLE001 -- commit must not break forward
+            logger.warning(
+                "memory commit failed; continuing without persisted memory: %s",
+                exc,
+                exc_info=True,
+            )
 
     # ---------------------------------------------------------------- public memory API
 
```

**File**: `tests/flow/test_agent_forward_memory.py` (modified, +60/-1)
```diff
@@ -8,6 +8,7 @@
 
 from __future__ import annotations
 
+import logging
 from dataclasses import dataclass, field
 
 import pytest
@@ -25,7 +26,7 @@
     MemoryResult,
 )
 from rath.session import Session, session_registry
-from rath.session.chunk import ChunkKind
+from rath.session.chunk import ChunkKind, ChunkRow
 from tests.session.scripted_loop_executor import ScriptedSessionLoopExecutor
 
 
@@ -38,6 +39,7 @@ def _clear_active_session_registry() -> None:
 @dataclass
 class _FakeBackend(MemoryBackend):
     find_hits: tuple[MemoryHit, ...] = ()
+    commit_error: Exception | None = None
     ops_seen: list[MemoryOp] = field(default_factory=list)
 
     @classmethod
@@ -77,12 +79,19 @@ def dispatch(self, store: MemoryStore, op: MemoryOp) -> MemoryResult:
         if isinstance(op, MemoryOpFind):
             return MemoryFindResult(hits=self.find_hits)
         if isinstance(op, MemoryOpCommit):
+            if self.commit_error is not None:
+                raise self.commit_error
             return MemoryCommitResult(
                 task_id="task-x", archived_uri="memory://session/s/", extracted_count=-1
             )
         raise NotImplementedError(f"fake: no handler for {type(op).__name__}")
 
 
+class _FailingInjection:
+    def inject(self, session: Session, store: object) -> tuple[ChunkRow, ...]:
+        raise RuntimeError("recall exploded")
+
+
 def _scripted_response(text: str) -> RathLLMChatResponse:
     return RathLLMChatResponse(
         id="chatcmpl-test",
@@ -178,3 +187,53 @@ def test_forward_without_commit_does_not_dispatch_commit() -> None:
     sess = Session.from_user_message("nothing important")
     agent.forward(sess)
     assert not any(isinstance(op, MemoryOpCommit) for op in backend.ops_seen)
+
+
+def test_forward_logs_warning_when_memory_injection_fails(
+    caplog: pytest.LogCaptureFixture,
+) -> None:
+    backend = _FakeBackend(find_hits=())
+    store = backend.open()
+    exec_ = ScriptedSessionLoopExecutor([_scripted_response("ack")])
+    agent = Agent(
+        "system",
+        model="gpt-5.5",
+        memory=store,
+        memory_inject=_FailingInjection(),
+    )
+    agent._executor_override = exec_
+    sess = Session.from_user_message("remember me")
+
+    with caplog.at_level(logging.WARNING, logger="rath.flow.agent"):
+        out = agent.forward(sess)
+
+    assert out.text() == "ack"
+    assert any(
+        "memory injection failed" in rec.getMessage() and rec.exc_info
+        for rec in caplog.records
+    )
+
+
+def test_forward_logs_warning_when_auto_commit_fails(
+    caplog: pytest.LogCaptureFixture,
+) -> None:
+    backend = _FakeBackend(find_hits=(), commit_error=RuntimeError("commit exploded"))
+    store = backend.open()
+    exec_ = ScriptedSessionLoopExecutor([_scripted_response("ack")])
+    agent = Agent(
+        "system",
+        model="gpt-5.5",
+        memory=store,
+        commit_on_forward=True,
+    )
+    agent._executor_override = exec_
+    sess = Session.from_user_message("remember me")
+
+    with caplog.at_level(logging.WARNING, logger="rath.flow.agent"):
+        out = agent.forward(sess)
+
+    assert out.text() == "ack"
+    assert any(
+        "memory commit failed" in rec.getMessage() and rec.exc_info
+        for rec in caplog.records
+    )
```

---

### Incident Patch 13: `ed346df7` (2026-07-05)
**Commit Message**: fix(memory): guard MemoryStore refcount updates

MemoryStore mirrors BackendSandbox lifecycle semantics, but its refcount reads and writes were not protected against cross-thread acquire/release calls. Guard the counter with the same lock pattern used by BackendSandbox and cover the race with deterministic and stress-style tests.

Constraint: Keep the change scoped to MemoryStore refcount lifecycle behavior.

Rejected: Redesign close-on-zero semantics | BackendSandbox currently defines the local pattern this PR aligns with.

Confidence: high

Scope-risk: narrow

Directive: Keep broader memory lifecycle changes separate from this compatibility fix.

Tested: uv run pytest tests/memory/unit/test_store_refcount.py tests/flow/test_agent_memory_lifecycle.py tests/flow/test_agent_memory_init.py -q -p no:cacheprovider; uv run pytest tests/memory/unit -q -p no:cacheprovider; uv run ruff check src/rath/memory/abc.py tests/memory/unit/test_store_refcount.py; uv run ruff format --check src/rath/memory/abc.py tests/memory/unit/test_store_refcount.py; uv run mypy --no-incremental

Not-tested: full pytest suite

**File**: `src/rath/memory/abc.py` (modified, +18/-8)
```diff
@@ -9,6 +9,7 @@
 
 from __future__ import annotations
 
+import threading
 from abc import ABC, abstractmethod
 from collections.abc import Mapping
 from dataclasses import dataclass, field, replace
@@ -101,25 +102,34 @@ class MemoryStore:
     spec: MemoryStoreSpec | None = None
     closed: bool = field(default=False)
     _refcount: int = field(default=0, repr=False)
+    # Match ``BackendSandbox`` lifecycle locking: serialize refcount updates,
+    # then let ``release`` call ``backend.close`` outside the lock.
+    _refcount_lock: threading.Lock = field(
+        default_factory=threading.Lock, repr=False, compare=False
+    )
 
     @property
     def refcount(self) -> int:
         """Current number of live references; read-only mirror of internal state."""
-        return self._refcount
+        with self._refcount_lock:
+            return self._refcount
 
     def acquire(self) -> "MemoryStore":
         """Add one reference; return ``self`` for chaining."""
-        if self.closed:
-            raise MemoryStoreClosed(self.handle)
-        self._refcount += 1
+        with self._refcount_lock:
+            if self.closed:
+                raise MemoryStoreClosed(self.handle)
+            self._refcount += 1
         return self
 
     def release(self) -> None:
         """Drop one reference; close via the backend when the count hits zero."""
-        if self.closed:
-            return
-        self._refcount -= 1
-        if self._refcount <= 0:
+        with self._refcount_lock:
+            if self.closed:
+                return
+            self._refcount -= 1
+            should_close = self._refcount <= 0
+        if should_close:
             self.backend.close(self)
 
     def __enter__(self) -> "MemoryStore":
```

**File**: `tests/memory/unit/test_store_refcount.py` (modified, +82/-0)
```diff
@@ -2,6 +2,9 @@
 
 from __future__ import annotations
 
+import threading
+import time
+
 import pytest
 
 from rath.memory.abc import MemoryStore, MemoryStoreSpec
@@ -22,6 +25,38 @@ def close(self, store: MemoryStore) -> None:
         store.closed = True
 
 
+class _YieldingRefcount:
+    """Refcount test double that makes read/modify/write races deterministic."""
+
+    def __init__(self, value: int) -> None:
+        self.value = value
+
+    def __iadd__(self, amount: int) -> "_YieldingRefcount":
+        current = self.value
+        time.sleep(0.01)
+        self.value = current + amount
+        return self
+
+    def __isub__(self, amount: int) -> "_YieldingRefcount":
+        current = self.value
+        time.sleep(0.01)
+        self.value = current - amount
+        return self
+
+    def __le__(self, other: object) -> bool:
+        if not isinstance(other, int):
+            return NotImplemented
+        return self.value <= other
+
+    def __eq__(self, other: object) -> bool:
+        if not isinstance(other, int):
+            return NotImplemented
+        return self.value == other
+
+    def __repr__(self) -> str:
+        return repr(self.value)
+
+
 def _make_store(backend: _FakeBackend | None = None) -> MemoryStore:
     be = backend if backend is not None else _FakeBackend()
     # ``backend`` is typed as ``MemoryBackend`` but the dataclass accepts any
@@ -85,6 +120,53 @@ def test_nested_context_manager_tracks_refcount():
     assert fake.close_calls == [store]
 
 
+def test_concurrent_acquire_release_is_safe():
+    """Hammer acquire/release from many threads; refcount must stay coherent."""
+    fake = _FakeBackend()
+    store = _make_store(fake)
+    store.acquire()  # baseline ref so the count cannot drain to zero mid-test
+
+    threads = 8
+    iters = 1000
+
+    def worker() -> None:
+        for _ in range(iters):
+            store.acquire()
+            store.release()
+
+    workers = [threading.Thread(target=worker) for _ in range(threads)]
+    for t in workers:
+        t.start()
+    for t in workers:
+        t.join()
+
+    assert store.refcount == 1
+    assert store.closed is False
+    assert fake.close_calls == []
+    store.release()
+    assert store.closed is True
+    assert fake.close_calls == [store]
+
+
+def test_concurrent_acquire_serializes_refcount_mutation():
+    store = _make_store()
+    store._refcount = _YieldingRefcount(1)  # type: ignore[assignment]
+    ready = threading.Barrier(3)
+
+    def worker() -> None:
+        ready.wait()
+        store.acquire()
+
+    workers = [threading.Thread(target=worker) for _ in range(2)]
+    for t in workers:
+        t.start()
+    ready.wait()
+    for t in workers:
+        t.join()
+
+    assert store.refcount == 3
+
+
 def test_acquire_after_close_raises_memory_store_closed():
     fake = _FakeBackend()
     store = _make_store(fake)
```

---

### Incident Patch 14: `807b642f` (2026-07-04)
**Commit Message**: fix(backend/persistence): round-trip empty entrypoint/env in spec_json (#40)

spec_to_jsonable preserves the None-vs-empty distinction (entrypoint=()
serializes to [], env={} to {}), but spec_from_jsonable rebuilt those
fields with truthiness checks, so an empty [] / {} decayed back to None
on load. This lost fidelity for both the on-disk backend registry and
session JSONL persistence.

Rebuild with `is not None` so empty collections survive the round trip,
matching the serializer. Add offline round-trip tests (the module had no
dedicated coverage).

**File**: `src/rath/backend/persistence/spec_json.py` (modified, +4/-2)
```diff
@@ -42,10 +42,12 @@ def spec_from_jsonable(raw: dict[str, Any] | None) -> BackendSandboxSpec | None:
     if raw is None:
         return None
     timeout_s = raw.get("timeout_seconds")
+    entrypoint = raw.get("entrypoint")
+    env = raw.get("env")
     return BackendSandboxSpec(
         image=raw.get("image"),
-        entrypoint=tuple(raw["entrypoint"]) if raw.get("entrypoint") else None,
-        env=dict(raw["env"]) if raw.get("env") else None,
+        entrypoint=tuple(entrypoint) if entrypoint is not None else None,
+        env=dict(env) if env is not None else None,
         timeout=timedelta(seconds=float(timeout_s)) if timeout_s is not None else None,
         working_dir=raw.get("working_dir"),
     )
```

**File**: `tests/backends/persistence/test_spec_json.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+"""Round-trip fidelity for :mod:`rath.backend.persistence.spec_json`.
+
+``spec_to_jsonable`` preserves the ``None``-vs-empty distinction, so
+``spec_from_jsonable`` must too: an empty ``entrypoint`` / ``env`` should
+survive the round trip as an empty collection rather than collapsing to
+``None``.
+"""
+
+from __future__ import annotations
+
+from datetime import timedelta
+
+from rath.backend.abc import BackendSandboxSpec
+from rath.backend.persistence.spec_json import spec_from_jsonable, spec_to_jsonable
+
+
+def test_none_spec_round_trips() -> None:
+    assert spec_to_jsonable(None) is None
+    assert spec_from_jsonable(None) is None
+
+
+def test_full_spec_round_trips() -> None:
+    spec = BackendSandboxSpec(
+        image="python:3.12",
+        entrypoint=("bash", "-lc"),
+        env={"K": "V", "N": "1"},
+        timeout=timedelta(seconds=30),
+        working_dir="/ws",
+    )
+    back = spec_from_jsonable(spec_to_jsonable(spec))
+    assert back == spec
+
+
+def test_empty_entrypoint_and_env_survive_round_trip() -> None:
+    """Empty collections must stay empty, not decay to ``None``."""
+    spec = BackendSandboxSpec(entrypoint=(), env={})
+    back = spec_from_jsonable(spec_to_jsonable(spec))
+    assert back is not None
+    assert back.entrypoint == ()
+    assert back.env == {}
+
+
+def test_unset_fields_stay_none() -> None:
+    spec = BackendSandboxSpec()
+    back = spec_from_jsonable(spec_to_jsonable(spec))
+    assert back == spec
+    assert back is not None
+    assert back.entrypoint is None
+    assert back.env is None
+    assert back.timeout is None
+
+
+def test_zero_timeout_round_trips() -> None:
+    """A zero timedelta is distinct from an unset timeout and must be kept."""
+    spec = BackendSandboxSpec(timeout=timedelta(0))
+    back = spec_from_jsonable(spec_to_jsonable(spec))
+    assert back is not None
+    assert back.timeout == timedelta(0)
```

---

### Incident Patch 15: `e38f1b64` (2026-07-04)
**Commit Message**: Merge pull request #39 from Rath-Team/codex/opensandbox-code-run-timeout

test(opensandbox): extend code-run timeout

**File**: `tests/backends/test_opensandbox.py` (modified, +1/-0)
```diff
@@ -106,6 +106,7 @@ def test_unsupported_language_returns_failure() -> None:
         assert r.kind == "unsupported_tool"
 
 
+@pytest.mark.timeout(600)
 def test_code_run_python_round_trip() -> None:
     """Smoke that ``codes.run`` produces both stdout and a result text."""
     backend = get("opensandbox")
```

#### Recent Merged Pull Requests:
- **PR #68** (2026-09-28): docs: redraw the README diagrams as SVG (@kangkangzi2025)
- **PR #53** (2026-07-31): docs: add OpenRath v2 runtime overview (@kangkangzi2025)
- **PR #52** (2026-07-31): Align OpenRath v2.0.0 README and deployment reference (@Tokisakix)
- **PR #51** (2026-07-30): feat(v2): harden durable runtime and release gates (@Tokisakix)
- **PR #47** (2026-07-08): docs: add workflow compile visual (@kangkangzi2025)
- **PR #46** (2026-07-08): v1.3.0: config/env/persistence hardening, provider .to(), Workflow.compile() (@Tokisakix)
- **PR #43** (2026-07-05): fix(memory): guard MemoryStore refcount updates (@skyswordx)
- **PR #42** (2026-07-05): fix(flow): warn on best-effort Agent memory failures (@skyswordx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
