# Forensic Learning Record (Deep Inspection): ag2ai/ag2

> **Canonical Artifact**: `07_PROJECT_LEARNING/ag2ai-ag2-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ag2ai/ag2](https://github.com/ag2ai/ag2))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:15:56.681Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ag2ai/ag2`
- **Description**: AG2 (formerly AutoGen): The Open-Source AgentOS.Join us at: https://discord.gg/sNGSwQME3x
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4969 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ag2/__init__.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

from fast_depends import Depends

from .agent import Agent, AgentReply, AgentRun, KnowledgeConfig, TaskConfig
from .annotations import Context, Inject, Variable
from .events import (
    AudioInput,
    BinaryInput,
    DataInput,
    DocumentInput,
    ImageInput,
    TextInput,
    VideoInput,
)
from .files import FilesAPI
from .middleware import Middleware
from .observers import observer
from .plugin import Plugin
from .response import PromptedSchema, ResponseSchema, response_schema
from .spec import AgentSpec
from .stream import MemoryStream
from .task import Task, TaskInject, TaskSpec
from .tools import ToolResult, Toolkit, tool
from .version import __version__

__all__ = (
    "Agent",
    "AgentReply",
    "AgentRun",
    "AgentSpec",
    "AudioInput",
    "BinaryInput",
    "Context",
    "DataInput",
    "Depends",
    "DocumentInput",
    "FilesAPI",
    "ImageInput",
    "Inject",
    "KnowledgeConfig",
    "MemoryStream",
    "Middleware",
    "Plugin",
    "PromptedSchema",
    "ResponseSchema",
    "Task",
    "TaskConfig",
    "TaskInject",
    "TaskSpec",
    "TextInput",
    "ToolResult",
    "Toolkit",
    "Variable",
    "VideoInput",
    "__version__",
    "observer",
    "response_schema",
    "tool",
)

```

### Core Architecture Module: `ag2/_import_utils.py`
```
# Copyright (c) 2023 - 2025, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

import inspect
import re
import sys
from abc import ABC, abstractmethod
from collections.abc import Callable, Generator, Iterable
from contextlib import contextmanager, suppress
from dataclasses import dataclass
from functools import wraps
from logging import getLogger
from pathlib import Path
from typing import Any, Generic, Optional, TypeVar

from fast_depends.utils import is_coroutine_callable

__all__ = [
    "optional_import_block",
    "patch_object",
    "require_optional_import",
    "run_for_optional_imports",
    "skip_on_missing_imports",
]

logger = getLogger(__name__)


_MODULE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$")


@dataclass
class ModuleInfo:
    name: str

    def is_in_sys_modules(self) -> str | None:
        """Check if the module is installed.

        Returns:
            None if the module is installed, otherwise a message indicating the issue.

        """
        if self.name not in sys.modules:
            return f"'{self.name}' is not installed."

        if hasattr(sys.modules[self.name], "__file__") and sys.modules[self.name].__file__ is not None:
            ag2_path = (Path(__file__).parent).resolve()
            test_path = (Path(__file__).parent.parent / "test").resolve()
            module_path = Path(sys.modules[self.name].__file__).resolve()  # type: ignore[arg-type]

            if str(ag2_path) in str(module_path) or str(test_path) in str(module_path):
                # The module is in the ag2 or test directory
                # Aka similarly named module in the ag2 or test directory
                return f"'{self.name}' is not installed."

        return None

    @classmethod
    def from_str(cls, module_info: str) -> "ModuleInfo":
        """Parse a module name string to create a ModuleInfo object.

        Args:
            module_info (str): The importable module name.

        Returns:
            ModuleInfo: A ModuleInfo object with the parsed information

        Raises:
            ValueError: If the module information is invalid
        """
        # Importable names only — no version constraints. Nothing in the tree ever
        # passed one, and honouring them meant depending on `packaging` for a
        # PEP 440 parser. Reintroduce both together if a guard ever needs a bound.
        name = module_info.strip()
        if not _MODULE_NAME_RE.fullmatch(name):
            raise ValueError(f"Invalid package information: {module_info}")
        return cls(name=name)


class Result:
    def __init__(self) -> None:
        self._failed: bool | None = None

    @property
    def is_successful(self) -> bool:
        if self._failed is None:
            raise ValueError("Result not set")
        return not self._failed


@contextmanager
def optional_import_block() -> Generator[Result, None, None]:
    """Guard a block of code to suppress ImportErrors

    A context manager to temporarily suppress ImportErrors.
    Use this to attempt imports without failing immediately on missing modules.

    Example:
    ```python
    with optional_import_block():
        import some_module
        import some_other_module
    ```
    """
    result = Result()
    try:
        yield result
        result._failed = False
    except ImportError as e:
        # Ignore ImportErrors during this context
        logger.debug(f"Ignoring ImportError: {e}")
        result._failed = True


def get_missing_imports(modules: str | Iterable[str]) -> dict[str, str]:
    """Get missing modules from a list of module names

    Args:
        modules (Union[str, Iterable[str]]): Module name or list of module names

    Returns:
        List of missing module names
    """
    if isinstance(modules, str):
        modules = [modules]

    module_infos = [ModuleInfo.from_str(module) for module in modules]
    x = {m.name: m.is_in_sys_modules() for m in module_infos}
    return {k: v for k, v in x.items() if v}


T = TypeVar("T")
G = TypeVar("G", bound=Callable[..., Any] | type)
F = TypeVar("F", bound=Callable[..., Any])


class PatchObject(ABC, Generic[T]):
    def __init__(self, o: T, missing_modules: dict[str, str], dep_target: str):
        if not self.accept(o):
            raise ValueError(f"Cannot patch object of type {type(o)}")

        self.o = o
        self.missing_modules = missing_modules
        self.dep_target = dep_target

    @classmethod
    @abstractmethod
    def accept(cls, o: Any) -> bool: ...

    @abstractmethod
    def patch(self, except_for: Iterable[str]) -> T: ...

    def get_object_with_metadata(self) -> Any:
        return self.o

    @property
    def msg(self) -> str:
        o = self.get_object_with_metadata()
        plural = len(self.missing_modules) > 1
        fqn = f"{o.__module__}.{o.__name__}" if hasattr(o, "__module__") else o.__name__
        # modules_str = ", ".join([f"'{m}'" for m in self.missing_modules])
        msg = f"{'Modules' if plural else 'A module'} needed for {fqn} {'are' if plural else 'is'} missing:\n"
        for _, status in self.missing_modules.items():
            msg += f" - {status}\n"
        msg += f"Please install {'them' if plural else 'it'} using:\n'pip install ag2[{self.dep_target}]'"
        return msg

    def copy_metadata(self, retval: T) -> None:
        """Copy metadata from original object to patched object

        Args:
            retval: Patched object

        """
        o = self.o
        if hasattr(o, "__doc__"):
            retval.__doc__ = o.__doc__
        if hasattr(o, "__name__"):
            retval.__name__ = o.__name__  # type: ignore[attr-defined]
        if hasattr(o, "__module__"):
            retval.__module__ = o.__module__

    _registry: list[type["PatchObject[Any]"]] = []

    @classmethod
    def register(cls) -> Callable[[type["PatchObject[Any]"]], type["PatchObject[Any]"]]:
        def decorator(subclass: type["PatchObject[Any]"]) -> type["PatchObject[Any]"]:
            cls._registry.append(subclass)
            return subclass

        return decorator

    @classmethod
    def create(
        cls,
        o: T,
        *,
        missing_modules: dict[str, str],
        dep_target: str,
    ) -> Optional["PatchObject[T]"]:
        for subclass in cls._registry:
            if subclass.accept(o):
                return subclass(o, missing_modules, dep_target)
        return None


@PatchObject.register()
class PatchCallable(PatchObject[F]):
    @classmethod
    def accept(cls, o: Any) -> bool:
        return inspect.isfunction(o) or inspect.ismethod(o)

    def patch(self, except_for: Iterable[str]) -> F:
        if self.o.__name__ in except_for:
            return self.o

        f: Callable[..., Any] = self.o

        # @wraps(f.__call__)  # type: ignore[operator]
        @wraps(f)
        def _call(*args: Any, **kwargs: Any) -> Any:
            raise ImportError(self.msg)

        self.copy_metadata(_call)  # type: ignore[arg-type]

        return _call  # type: ignore[return-value]


@PatchObject.register()
class PatchStatic(PatchObject[F]):
    @classmethod
    def accept(cls, o: Any) -> bool:
        # return inspect.ismethoddescriptor(o)
        return isinstance(o, staticmethod)

    def patch(self, except_for: Iterable[str]) -> F:
        if hasattr(self.o, "__name__"):
            name = self.o.__name__
        elif hasattr(self.o, "__func__"):
            name = self.o.__func__.__name__
        else:
            raise ValueError(f"Cannot determine name for object {self.o}")
        if name in except_for:
            return self.o

        f: Callable[..., Any] = self.o.__func__  # type: ignore[attr-defined]

        @wraps(f)
        def _call(*args: Any, **kwargs: Any) -> Any:
            raise ImportError(self.msg)

        self.copy_metadata(_call)  # type: ignore[arg-type]

        return staticmethod(_call)  # type: ignore[return-value]

    de
```

### Core Architecture Module: `ag2/_replay.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Replay invariants for a trimmed span of history.

Every reducer of history — the assembly policies, the limiter middleware, and the
compaction strategies — cuts the event list at an index and replays
``events[cut:]`` to the provider. That tail has to stand on its own, and four
retained events cannot:

| retained event             | required companion             | if missing                      |
|----------------------------|--------------------------------|---------------------------------|
| tool result                | the **call** it answers        | orphan ``function_call_output`` |
| builtin (server-side) call | its **reasoning** item         | orphan ``web_search_call``      |
| local call event           | the **response** announcing it | maps to nothing at all          |
| response with tool calls   | its **provider turn item**     | tool calls vanish, silently     |

The remedy differs by caller because what they own differs: a policy or limiter
persists nothing, so it drops the offending event (:func:`replayable_span`);
compaction persists everything it drops, so it moves the cut (:func:`snap`) —
filtering there would leave an event neither retained nor persisted.

A hosted OpenAI ``shell_call`` needs the ``shell_call_output`` *after* it, which a
prefix cut cannot remove — only an unfinished turn can, so that one is enforced in
``ag2.config.openai.mappers`` instead.
"""

from collections.abc import Sequence

from ag2.events import (
    BaseEvent,
    BuiltinToolCallEvent,
    ModelRequest,
    ModelResponse,
    ProviderReplay,
    ToolCallEvent,
    ToolCallsEvent,
    ToolResultEvent,
    ToolResultsEvent,
)


def _answerable_ids(events: Sequence[BaseEvent]) -> set[str]:
    """Ids of calls a span can answer — local calls and builtin ones alike.

    A builtin call arrives as its own event and never appears in
    ``ModelResponse.tool_calls``, so a check that reads only the response misses
    it and concludes its result is orphaned no matter what is retained.
    """
    ids: set[str] = set()
    for event in events:
        if isinstance(event, ModelResponse) and event.tool_calls:
            ids.update(call.id for call in event.tool_calls.calls)
        elif isinstance(event, BuiltinToolCallEvent):
            ids.add(event.id)
    return ids


def _required_ids(event: BaseEvent) -> set[str]:
    """Call ids this event is a result for; empty for everything else."""
    if isinstance(event, ToolResultsEvent):
        return {result.parent_id for result in event.results if result.parent_id}
    if isinstance(event, ToolResultEvent) and event.parent_id:
        return {event.parent_id}
    return set()


def _is_anchor(event: BaseEvent) -> bool:
    """True for an item the builtin calls of its response are paired with.

    ``ProviderReplay`` marks the requirement and the event's own
    ``__replay_role__`` names which half of it applies, so neither durability nor
    the event's base classes decide this. Durability answers a different question
    (storage, not replay), and reading the role off ``ModelReasoning`` would
    misfile any provider whose turn carrier happened to subclass it.
    """
    return isinstance(event, ProviderReplay) and event.__replay_role__ == "anchor"


def _is_turn_item(event: BaseEvent) -> bool:
    """True for provider-native state standing in for a whole assistant turn.

    The other ``ProviderReplay`` role: some providers hand back an object that is
    the only way to reconstruct the turn they just produced. ``XAIAssistantEvent``
    carries the response proto, and xai-sdk offers no way to build an assistant
    message with ``tool_calls`` from primitives. Anchors are excluded — they cover
    a single builtin call, which is a narrower relationship than a whole turn.
    """
    return isinstance(event, ProviderReplay) and event.__replay_role__ == "turn"


def _prune(events: Sequence[BaseEvent], cut: int) -> list[BaseEvent]:
    """``events[cut:]`` with every event the cut orphaned removed.

    ``anchor`` is the nearest preceding durable reasoning item, tracked across the
    whole list rather than read off the events adjacent to the cut. That makes the
    answer independent of whatever else the provider interleaved into the response,
    and silent for models that emit no reasoning at all — a builtin call that
    never had an anchor cannot lose one.

    It is scoped to one response, though: a reasoning item anchors only the builtin
    calls of the response that emitted it, and ``ModelRequest`` / ``ModelResponse``
    close that response. Without the reset a stale anchor from an earlier response
    would condemn a later builtin call that never needed one — and a history can
    genuinely mix the two, since the same model emits a reasoning item only when
    asked for a summary (see ``ag2.config.openai.openai_responses_client``).
    """
    anchor: int | None = None
    turn_item: int | None = None
    kept: list[BaseEvent] = []
    for index, event in enumerate(events):
        orphaned_turn = False
        if _is_anchor(event):
            anchor = index
        elif _is_turn_item(event):
            turn_item = index
        elif isinstance(event, ModelRequest):
            anchor = None
            turn_item = None
        elif isinstance(event, ModelResponse):
            anchor = None
            # The response consumes the turn item emitted just before it. Only
            # tool calls are lost without it — the text is on the response
            # itself — so a plain answer survives the item being cut away.
            orphaned_turn = turn_item is not None and turn_item < cut and bool(event.tool_calls.calls)
            turn_item = None
        if index < cut:
            continue
        if isinstance(event, BuiltinToolCallEvent) and anchor is not None and anchor < cut:
            continue
        if orphaned_turn:
            continue
        kept.append(event)

    answerable = _answerable_ids(kept)
    return [event for event in kept if _required_ids(event) <= answerable and _announced_ids(event) <= answerable]


def _announced_ids(event: BaseEvent) -> set[str]:
    """Call ids this event merely announces, carrying no replayable content.

    A local call is announced twice: once inside the ``ModelResponse`` that
    requested it, which is what a provider replays, and once as a standalone
    event (or a container of them) for observers. Without the response those
    standalone events map to no input item at all, so a span reduced to them is
    as unsendable as an empty one — the mirror of a builtin call with no anchor.
    Builtin calls are excluded: they carry their own provider item.
    """
    if isinstance(event, ToolCallsEvent):
        return {call.id for call in event.calls}
    if isinstance(event, ToolCallEvent) and not isinstance(event, BuiltinToolCallEvent):
        return {event.id}
    return set()


def replayable_span(events: Sequence[BaseEvent], cut: int) -> list[BaseEvent]:
    """Return ``events[cut:]`` reduced to what a provider will accept on its own.

    Drops orphans rather than moving the cut, so a window loses only the events
    that cannot be replayed. Retreats the cut only to avoid the one outcome no
    provider accepts either — a request with nothing in it — which is what a
    window narrower than the turn it lands in reduces to once its orphans are
    gone. Overshooting a window to reach the turn is recoverable; sending
    nothing is not.
    """
    kept = _prune(events, cut)
    while not kept and cut > 0:
        cut -= 1
        kept = _prune(events, cut)
    return kept


def is_replayable(events: Sequence[BaseEvent], cut: int) -> bool:
    """True when ``events[cut:]`` needs nothing the cut dropped."""
    return len(_prune(events, cut)) == len(events) - cut


def snap(events: Sequence[BaseEvent], cut
```

### Core Architecture Module: `ag2/_telemetry_consts.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Shared OpenTelemetry string constants — the AG2 telemetry vocabulary.

Single source of truth for the telemetry strings that cross package
boundaries:

* the agent-side ``TelemetryMiddleware`` (``ag2.middleware.builtin``),
* the hub-side tracing (``ag2.network.hub._envelope_tracing`` and
  ``...hub.telemetry``),
* the network dispatch handler (``ag2.network.client.handlers``),
* the eval trace reconstructor (``ag2.eval.sources``), which reads
  these keys back to rebuild a ``Trace`` from OpenTelemetry spans.

This module imports **nothing** — importing it never pulls in OpenTelemetry.
That is the whole point: the OTel-free network handler can read
:data:`TRACEPARENT_DEP_KEY` without making OpenTelemetry a hard dependency,
so tracing stays opt-in. It also sits below both ``middleware`` and
``network`` in the import graph, so either can import it "downward" without
coupling the two packages to each other.

The convention here is "centralise the shared, leave the single-use inline":
strings referenced from more than one module (or that form a closed
vocabulary consumers must match against) live here; attribute keys used at a
single site stay as literals next to their use.
"""

# ── Propagation contract ────────────────────────────────────────────────────
# Key under which the network handler relays an inbound envelope's W3C
# traceparent to the agent-side ``TelemetryMiddleware`` via
# ``context.dependencies`` (the ``Envelope`` itself never reaches middleware).
# Producer: ag2/network/client/handlers.py
# Consumer: ag2/middleware/builtin/telemetry.py
TRACEPARENT_DEP_KEY = "ag2.otel.traceparent"

# ── Tracer identity ─────────────────────────────────────────────────────────
# Shared so every AG2 tracer (agent middleware + hub) reports the same
# instrumentation scope and schema URL on the spans it emits.
OTEL_SCHEMA_URL = "https://opentelemetry.io/schemas/1.11.0"
OTEL_INSTRUMENTING_MODULE = "opentelemetry.instrumentation.ag2"

# ── Span-type discriminator ─────────────────────────────────────────────────
# Attribute key + its closed value vocabulary. This is the field that
# consumers (the disk-JSONL reader, eval / query code) filter on, so the
# values are centralised even though each is set at a single producer site.
ATTR_SPAN_TYPE = "ag2.span.type"
SPAN_TYPE_AGENT = "agent"  # invoke_agent — middleware
SPAN_TYPE_LLM = "llm"  # chat — middleware
SPAN_TYPE_TOOL = "tool"  # execute_tool — middleware
SPAN_TYPE_HUMAN_INPUT = "human_input"  # await_human_input — middleware
SPAN_TYPE_USAGE = "usage"  # record_usage — middleware
SPAN_TYPE_ENVELOPE = "envelope"  # network.envelope — hub
SPAN_TYPE_CHANNEL = "channel"  # network.channel — hub
SPAN_TYPE_TASK = "task"  # network.task — hub
SPAN_TYPE_AGENT_LIFETIME = "agent_lifetime"  # agent.lifetime — hub
SPAN_TYPE_AGENT_EVENT = "agent_event"  # agent.resume_set / skill_set / rule_set — hub

# ── SpanLink kinds ──────────────────────────────────────────────────────────
# ``ag2.link.kind`` attribute on cross-trace ``Link``s. ``in_channel`` is
# emitted by both the envelope tracer and the listener, hence shared.
ATTR_LINK_KIND = "ag2.link.kind"
LINK_IN_CHANNEL = "in_channel"  # span happened in this channel
LINK_TRIGGERED_BY = "triggered_by"  # span was triggered by the caller's current span

# ── Network attribute keys (``ag2.network.*``) ──────────────────────────────
# Emitted by the envelope tracer and/or the HubTelemetryListener. The first
# four are emitted by both; the rest by a single site — but every key lives
# here so consumers (eval scorecards, the JSONL reader, TraceQL queries) have
# one importable source and producer code carries no ``ag2.*`` literals. This
# mirrors how ``hub/audit.py`` centralises its ``AUDIT_KIND_*`` vocabulary.
ATTR_NET_CHANNEL_ID = "ag2.network.channel_id"
ATTR_NET_SENDER_ID = "ag2.network.sender_id"
ATTR_NET_EVENT_TYPE = "ag2.network.event_type"
ATTR_NET_ENVELOPE_ID = "ag2.network.envelope_id"
ATTR_NET_CAPABILITY = "ag2.network.capability"
ATTR_NET_OUTCOME = "ag2.network.outcome"
ATTR_NET_TASK_ID = "ag2.network.task_id"
ATTR_NET_OWNER_ID = "ag2.network.owner_id"
ATTR_NET_RECIPIENT_ID = "ag2.network.recipient_id"
ATTR_NET_DISPATCH_FAILURES = "ag2.network.dispatch_failures"
ATTR_NET_MANIFEST_TYPE = "ag2.network.manifest_type"
ATTR_NET_CREATOR_ID = "ag2.network.creator_id"
ATTR_NET_CAUSATION_ID = "ag2.network.causation_id"
ATTR_NET_AUDIENCE = "ag2.network.audience"

# ── Agent attribute keys (``ag2.agent.*``) ──────────────────────────────────
# The ``resume_source`` *values* are not defined here — they reuse
# ``RESUME_SOURCE_TENANT`` / ``RESUME_SOURCE_OBSERVED`` from
# ``ag2.network.hub.audit`` so the span value matches the audit record.
ATTR_AGENT_ID = "ag2.agent.id"
ATTR_AGENT_CAPABILITY = "ag2.agent.capability"
ATTR_AGENT_OUTCOME = "ag2.agent.outcome"
ATTR_AGENT_RESUME_SOURCE = "ag2.agent.resume_source"
ATTR_AGENT_SKILL_REMOVED = "ag2.agent.skill_removed"

# ── Diagnostic span-event attribute keys ────────────────────────────────────
# Failure-path breadcrumbs read in a trace viewer (error / expectation /
# inbox-pressure events) and human-input prompt/response capture.
ATTR_ERROR_TYPE = "ag2.error.type"
ATTR_ERROR_MESSAGE = "ag2.error.message"
ATTR_EXPECTATION_NAME = "ag2.expectation.name"
ATTR_EXPECTATION_ON_VIOLATION = "ag2.expectation.on_violation"
ATTR_EXPECTATION_VIOLATORS = "ag2.expectation.violators"
ATTR_INBOX_PENDING = "ag2.inbox.pending"
ATTR_INBOX_CAP = "ag2.inbox.cap"

# ── Usage capture (``ag2.usage.*``) ──────────────────────────────────────────
# ``UsageEvent`` — the framework's accounting record — carried onto its own
# span by ``TelemetryMiddleware`` and read back by the eval reconstructor. The
# token counts themselves reuse the OTel ``gen_ai.usage.*`` keys; only the
# attribution that has no gen_ai equivalent lives under ``ag2.usage.*``.
#
# This span is the only route by which spend that never becomes an LLM span —
# a sub-task rollup, history compaction, memory aggregation, a live session —
# reaches a trace.
ATTR_USAGE_KIND = "ag2.usage.kind"  # "model_call" / "subtask" / "compaction" / "aggregation"
ATTR_USAGE_LABEL = "ag2.usage.label"  # attribution, e.g. the worker's name on a subtask rollup
ATTR_USAGE_TOTAL = "ag2.usage.total_tokens"  # provider-reported total; gen_ai semconv has no key for it

# ── Human-input capture ─────────────────────────────────────────────────────
# Prompt/response text captured on ``human_input`` spans, read back by the
# eval trace reconstructor to rebuild HITL turns.
ATTR_HUMAN_INPUT_PROMPT = "ag2.human_input.prompt"
ATTR_HUMAN_INPUT_RESPONSE = "ag2.human_input.response"

# ── Tool-result capture ──────────────────────────────────────────────────────
# Set when ``gen_ai.tool.call.result`` was cut at ``max_tool_result_chars``;
# the eval trace reconstructor copies it onto the result part's metadata.
ATTR_TOOL_RESULT_TRUNCATED = "ag2.tool.call.result.truncated"

# ── Checkpoint capture (span-events on the active span) ──────────────────────
# Emitted by ``HubBackedCheckpointStore`` write/read so task checkpoint
# save/restore surface as markers on the active task/turn span — checkpoints
# bypass the envelope path, so this is the only place they show up in a trace.
ATTR_CHECKPOINT_TASK_ID = "ag2.checkpoint.task_id"
ATTR_CHECKPOINT_BYTES = "ag2.checkpoint.bytes"
ATTR_CHECKPOINT_HIT = "ag2.checkpoint.hit"

```

### Core Architecture Module: `ag2/a2a/__init__.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

from ag2.exceptions import missing_additional_dependency, missing_optional_dependency

try:
    from .card import build_card
    from .config import A2AConfig
except ImportError as e:
    build_card = missing_optional_dependency("build_card", "a2a", e)  # type: ignore[misc]
    A2AConfig = missing_optional_dependency("A2AConfig", "a2a", e)  # type: ignore[misc]

try:
    from .server import A2AServer
except ImportError as e:
    A2AServer = missing_optional_dependency("A2AServer", "a2a", e)  # type: ignore[misc]

try:
    from .transports.grpc import secure_grpc_channel_factory
except ImportError as e:
    secure_grpc_channel_factory = missing_additional_dependency(  # type: ignore[misc]
        "secure_grpc_channel_factory", "a2a-sdk[grpc]", e
    )

__all__ = (
    "A2AConfig",
    "A2AServer",
    "build_card",
    "secure_grpc_channel_factory",
)

```

### Core Architecture Module: `ag2/a2a/_session.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from a2a.client import A2ACardResolver, Client, ClientCallContext

from .config import A2AConfig
from .extension import extension_call_context, validate_extension_activation
from .transports._http import make_a2a_client, make_httpx_client, select_interface, validate_protocol_version


def with_tenant(config: A2AConfig, override: str | None, **kwargs: Any) -> dict[str, Any]:
    """Inject ``tenant`` into request kwargs from per-call override or config.

    Single source of truth for the tenant-resolution rule used by
    ``tasks``, ``push``, and (with a wrapping context-variables lookup)
    the ``A2AClient``. ``override`` wins over ``config.tenant``; both
    empty means no ``tenant`` key is injected.
    """
    tenant = override if override is not None else config.tenant
    if tenant:
        kwargs["tenant"] = tenant
    return kwargs


@asynccontextmanager
async def open_session(config: A2AConfig) -> AsyncGenerator[tuple[Client, ClientCallContext | None]]:
    """Open a short-lived A2A SDK client for one-shot RPCs.

    Combines the httpx client, card resolution, and SDK factory into a
    single ``async with`` block. The httpx client is closed on exit so
    callers don't have to track it.

    Yields the call context alongside the client. Activation is
    per-request, so every RPC inside the block must pass it as
    ``context=`` or a server requiring an extension rejects the call.
    """
    httpx_client = make_httpx_client(
        headers=dict(config.headers) if config.headers else None,
        timeout=config.timeout,
        factory=config.httpx_client_factory,
    )
    try:
        card = (
            config.preset_card
            or await A2ACardResolver(httpx_client=httpx_client, base_url=config.card_url).get_agent_card()
        )
        iface, transport = select_interface(card, url=config.card_url, prefer=config.prefer)
        validate_protocol_version(iface, url=config.card_url, transport=transport)
        validate_extension_activation(card, config.extensions, url=config.card_url)
        sdk = make_a2a_client(
            card=card,
            httpx_client=httpx_client,
            streaming=False,
            transport=transport,
            interceptors=tuple(config.interceptors),
            grpc_channel_factory=config.grpc_channel_factory,
        )
        yield sdk, extension_call_context(config.extensions)
    finally:
        await httpx_client.aclose()

```

### Core Architecture Module: `ag2/a2a/card.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

from collections.abc import Mapping, Sequence
from typing import Any

from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentExtension,
    AgentInterface,
    AgentProvider,
    AgentSkill,
)
from a2a.utils.constants import PROTOCOL_VERSION_CURRENT, TransportProtocol

from ag2.agent import Agent
from ag2.tools.skills.toolkit import SkillsToolkit

from .extension import EXTENSION_URI
from .security import Requirement, Scheme
from .transports import TransportName

_DEFAULT_VERSION = "1.0.0"
_DEFAULT_INPUT_MODES = ("text/plain", "application/json")
_DEFAULT_OUTPUT_MODES = ("text/plain", "application/json")


def build_card(
    agent: Agent,
    *,
    url: str,
    transports: Sequence[TransportName] = ("jsonrpc",),
    rest_url: str | None = None,
    rest_path_prefix: str = "",
    grpc_url: str | None = None,
    version: str = _DEFAULT_VERSION,
    description: str | None = None,
    push_notifications: bool = False,
    skills: Sequence[AgentSkill] | None = None,
    security: Sequence[Requirement] = (),
    provider: AgentProvider | None = None,
    documentation_url: str | None = None,
    icon_url: str | None = None,
    tenants: Mapping[TransportName, str] | None = None,
    extensions: Sequence[AgentExtension] = (),
) -> AgentCard:
    """Construct an ``AgentCard`` describing an AG2 agent for A2A discovery.

    Always declares the ``urn:ag2:client-tools:v1`` extension as
    ``required=False`` — the server can transparently fall back to a
    plain text exchange when the client doesn't speak the extension.
    User extensions passed via ``extensions`` are declared after it;
    duplicate URIs raise ``ValueError``.

    ``supported_interfaces`` is built from ``transports`` — one
    ``AgentInterface`` per enabled binding. JSON-RPC URL is ``url``;
    REST URL defaults to ``url + rest_path_prefix`` (same host:port,
    different path) but can be overridden via ``rest_url`` when REST
    lives on a different host:port; gRPC lives on its own ``grpc_url``.

    When ``skills`` is supplied, it replaces all auto-detection. When it
    is ``None``, ``build_card`` walks ``agent.tools`` for any
    :class:`SkillsToolkit` and publishes its ``agentskills.io``-style
    local skills as ``AgentSkill`` entries; if none are found, falls
    back to a single skill derived from ``agent.name`` /
    ``agent._system_prompt`` so the card stays spec-compliant.

    ``security`` is a sequence of :class:`Requirement` objects built via
    ``require(scheme, ...)``. Each entry is an AND-set of schemes; the
    list itself is OR-ed (any one requirement suffices). Underlying
    ``security_schemes`` on the card are auto-derived from the schemes
    referenced in ``security`` — no duplicate declarations needed.
    ``tenants`` maps a transport name to a tenant string surfaced on the
    corresponding ``AgentInterface.tenant``.
    """
    if "grpc" in transports and grpc_url is None:
        raise ValueError("grpc_url is required when 'grpc' is in transports")

    description_text = description or _agent_description(agent)
    resolved_skills = _resolve_skills(agent, skills, description_text)
    declared: list[AgentExtension] = [
        AgentExtension(
            uri=EXTENSION_URI,
            description="AG2 client-side tool execution",
            required=False,
        ),
    ]
    seen_uris = {EXTENSION_URI}
    for ext in extensions:
        if ext.uri in seen_uris:
            reason = (
                "declared automatically by build_card" if ext.uri == EXTENSION_URI else "already present in extensions="
            )
            raise ValueError(f"Duplicate extension URI on AgentCard: {ext.uri!r} is {reason}")
        seen_uris.add(ext.uri)
        declared.append(ext)
    capabilities = AgentCapabilities(
        streaming=True,
        push_notifications=push_notifications,
        extensions=declared,
    )
    card_kwargs: dict[str, Any] = {
        "name": agent.name,
        "description": description_text,
        "version": version,
        "default_input_modes": list(_DEFAULT_INPUT_MODES),
        "default_output_modes": list(_DEFAULT_OUTPUT_MODES),
        "capabilities": capabilities,
        "skills": resolved_skills,
        "supported_interfaces": _build_interfaces(
            transports=transports,
            url=url,
            rest_url=rest_url,
            rest_path_prefix=rest_path_prefix,
            grpc_url=grpc_url,
            tenants=tenants,
        ),
    }
    if security:
        seen: dict[str, Scheme] = {}
        for req in security:
            for scheme in req.schemes:
                seen[scheme.name] = scheme
        card_kwargs["security_schemes"] = {name: s.scheme for name, s in seen.items()}
        card_kwargs["security_requirements"] = [r.to_proto() for r in security]
    if provider is not None:
        card_kwargs["provider"] = provider
    if documentation_url is not None:
        card_kwargs["documentation_url"] = documentation_url
    if icon_url is not None:
        card_kwargs["icon_url"] = icon_url
    return AgentCard(**card_kwargs)


def _build_interfaces(
    *,
    transports: Sequence[TransportName],
    url: str,
    rest_url: str | None,
    rest_path_prefix: str,
    grpc_url: str | None,
    tenants: Mapping[TransportName, str] | None = None,
) -> list[AgentInterface]:
    tenant_map = tenants or {}
    interfaces: list[AgentInterface] = []
    for name in transports:
        if name == "jsonrpc":
            iface_url, protocol = url, TransportProtocol.JSONRPC.value
        elif name == "rest":
            iface_url = rest_url if rest_url is not None else url + rest_path_prefix
            protocol = TransportProtocol.HTTP_JSON.value
        else:
            assert name == "grpc" and grpc_url is not None  # validated above
            iface_url, protocol = grpc_url, TransportProtocol.GRPC.value
        interfaces.append(
            AgentInterface(
                url=iface_url,
                protocol_binding=protocol,
                protocol_version=PROTOCOL_VERSION_CURRENT,
                tenant=tenant_map.get(name, ""),
            ),
        )
    return interfaces


def _agent_description(agent: Agent) -> str:
    prompt = agent._system_prompt if agent._system_prompt else None
    if prompt:
        return prompt[0]
    return ""


def _resolve_skills(
    agent: Agent,
    explicit: Sequence[AgentSkill] | None,
    description: str,
) -> list[AgentSkill]:
    """Pick skills in priority order: explicit → auto-detected → default.

    Auto-detection walks ``agent.tools`` for any :class:`SkillsToolkit`
    and publishes its ``agentskills.io``-style local skills. The
    toolkit's own three tools (``list_skills`` / ``load_skill`` /
    ``run_skill_script``) are implementation detail and do not appear.
    """
    if explicit is not None:
        return list(explicit)

    auto = [
        AgentSkill(id=skill.name, name=skill.name, description=skill.metadata.description or skill.name)
        for tool in agent.tools
        if isinstance(tool, SkillsToolkit)
        for skill in tool.merged_skills()
    ]
    if auto:
        return auto

    return [
        AgentSkill(
            id=agent.name,
            name=agent.name,
            description=description or agent.name,
            tags=[],
        ),
    ]

```

### Core Architecture Module: `ag2/a2a/client.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

import asyncio
from collections.abc import AsyncIterator, Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, TypeAlias

import httpx
from a2a.client import A2ACardResolver, Client, ClientCallContext, ClientCallInterceptor
from a2a.client.errors import A2AClientError
from a2a.types import (
    AgentCard,
    GetExtendedAgentCardRequest,
    GetTaskRequest,
    Message,
    Part,
    SendMessageConfiguration,
    SendMessageRequest,
    StreamResponse,
    SubscribeToTaskRequest,
    Task,
    TaskState,
    TaskStatus,
    TaskStatusUpdateEvent,
)
from fast_depends.library.serializer import SerializerProto

from ag2.config.client import LLMClient
from ag2.context import ConversationContext, strip_reserved_variables
from ag2.events import (
    BaseEvent,
    Input,
    ModelMessage,
    ModelMessageChunk,
    ModelRequest,
    ModelResponse,
    TextInput,
    ToolCallEvent,
    ToolCallsEvent,
    ToolResultsEvent,
    Usage,
)
from ag2.response import ResponseProto
from ag2.tools.final.function_tool import FunctionToolSchema
from ag2.tools.schemas import ToolSchema

from .errors import (
    A2ACardSignatureError,
    A2AClientToolsNotSupportedError,
    A2AReconnectError,
    A2ATaskAuthRequiredError,
    A2ATaskFailedError,
    A2ATaskRejectedError,
)
from .events import (
    A2AMessage,
    A2ATaskArtifactUpdate,
    A2ATaskSnapshot,
    A2ATaskStatusUpdate,
    A2ATextArtifact,
    A2AToolCallArtifact,
)
from .extension import (
    EXTENSION_URI,
    EXTRA_PARTS_DEPENDENCY_KEY,
    MIME_TOOL_CALL,
    TENANT_VARIABLE_KEY,
    extension_call_context,
    validate_extension_activation,
)
from .mappers import (
    build_input_response_message,
    build_tool_result_message,
    build_user_message,
    extract_context_update,
    is_data_part_with_mime,
    parse_stream_response,
    parse_task_artifact,
    part_data_to_python,
    payload_to_call,
)
from .transports import TransportName
from .transports._http import make_a2a_client, make_httpx_client, select_interface, validate_protocol_version

# ``a2a.utils.signing`` imports PyJWT at module scope and raises if it is absent,
# so importing it unguarded would make ``ag2.a2a`` unimportable on a plain
# ``ag2[a2a]`` install — the SDK ships PyJWT behind its own ``signing`` extra.
# Without that extra no verifier can be constructed either, so the stand-in below
# is never matched in practice; it only keeps the branch in ``_verify_card`` typed.
try:
    from a2a.utils.signing import SignatureVerificationError
except ImportError:  # pragma: no cover — needs an env without a2a-sdk[signing]

    class SignatureVerificationError(Exception):  # type: ignore[no-redef]
        """Stand-in for the SDK error when ``a2a-sdk[signing]`` is not installed."""


if TYPE_CHECKING:
    import grpc.aio

CardVerifier: TypeAlias = Callable[[AgentCard], None]
"""JWS verifier for consumed AgentCards (from :func:`a2a.utils.signing.create_signature_verifier`)."""

_PROVIDER = "a2a"
_CONTEXT_ID_VAR_TEMPLATE = "a2a:context_id:{card_url}"

_TERMINAL_STATES = frozenset({
    TaskState.TASK_STATE_COMPLETED,
    TaskState.TASK_STATE_CANCELED,
    TaskState.TASK_STATE_FAILED,
    TaskState.TASK_STATE_REJECTED,
    TaskState.TASK_STATE_INPUT_REQUIRED,
    TaskState.TASK_STATE_AUTH_REQUIRED,
})

# Maps a task-failure terminal state to the ``finish_reason`` we surface
# in the resulting ``ModelResponse``. Driven from one table so the
# streaming and polling paths can never disagree on the mapping.
_FAILURE_REASONS: dict[TaskState, str] = {
    TaskState.TASK_STATE_FAILED: "failed",
    TaskState.TASK_STATE_REJECTED: "rejected",
    TaskState.TASK_STATE_AUTH_REQUIRED: "auth_required",
}

# Mirror of ``_FAILURE_REASONS`` keyed by the surfaced ``finish_reason`` —
# turns the terminal-state cascade in ``__call__`` into a one-line lookup
# and keeps the wire→exception mapping in one place.
_FAILURE_ERRORS: dict[str, type[Exception]] = {
    "failed": A2ATaskFailedError,
    "rejected": A2ATaskRejectedError,
    "auth_required": A2ATaskAuthRequiredError,
}


@dataclass(slots=True)
class A2ADriveState:
    """State accumulated across one ``ask`` to its terminal task; survives ``input_required`` continuations."""

    accumulated_text: str = ""
    pending_calls: list[ToolCallEvent] = field(default_factory=list)
    finish_reason: str = "completed"
    terminal_task: Task | None = None
    # Dedup keys: SDK may replay artifacts/messages on ``SubscribeToTask`` reconnect
    # (spec §3.5.2), and polling re-reads cumulative ``task.artifacts`` on every poll.
    seen_artifact_ids: set[str] = field(default_factory=set)
    seen_message_ids: set[str] = field(default_factory=set)


@dataclass(slots=True)
class A2ATurnOutcome:
    """Per-turn result from a streaming/polling drain; ``input_required`` triggers HITL or tool-call surface."""

    input_required: bool = False
    input_prompt: str | None = None


class A2AClient(LLMClient):
    """``LLMClient`` that delegates to a remote A2A agent.

    Reused across ``reply.ask(...)`` follow-ups on the same ``AgentReply``.
    Within one ``__call__``, ``self._task_id`` carries the server-issued
    id across drives (client-tool round-trips, HITL continuations); it
    resets on each new top-level user turn since the prior task is
    terminal. ``contextId`` persists in ``context.variables`` across asks.

    The client ships the full AG2 history on every turn — the server is
    stateless on AG2 history (see ``mappers/history.py``).
    """

    def __init__(  # type: ignore[no-any-unimported]
        self,
        *,
        card_url: str,
        prefer: TransportName | None = None,
        streaming: bool = True,
        headers: Mapping[str, str] | None = None,
        timeout: float | None = 60.0,
        max_reconnects: int = 3,
        reconnect_backoff: float = 0.5,
        polling_interval: float = 0.5,
        input_required_timeout: float | None = None,
        httpx_client_factory: Callable[[], httpx.AsyncClient] | None = None,
        interceptors: Sequence[ClientCallInterceptor] = (),
        grpc_channel_factory: Callable[[str], "grpc.aio.Channel"] | None = None,
        preset_card: AgentCard | None = None,
        card_signature_verifier: CardVerifier | None = None,
        tenant: str | None = None,
        history_length: int | None = None,
        extensions: Sequence[str] = (),
    ) -> None:
        self._card_url = card_url
        self._prefer = prefer
        self._streaming = streaming
        self._headers = dict(headers) if headers else None
        self._timeout = timeout
        self._max_reconnects = max_reconnects
        self._reconnect_backoff = reconnect_backoff
        self._polling_interval = polling_interval
        self._input_required_timeout = input_required_timeout
        self._httpx_client_factory = httpx_client_factory
        self._interceptors = list(interceptors)
        self._grpc_channel_factory = grpc_channel_factory
        self._preset_card = preset_card
        self._card_signature_verifier = card_signature_verifier
        self._tenant = tenant
        self._history_length = history_length
        # Dedup, preserving the user's order — the URIs travel as a list on
        # ``Message.extensions``.
        self._extensions = tuple(dict.fromkeys(extensions))

        self._httpx_client: httpx.AsyncClient | None = None
        self._sdk_client: Client | None = None
        self._agent_card: AgentCard | None = preset_card
        self._task_id: str | None = None
        self._call_context: ClientCallContext | None = None

    async def __call__(
        self,
        messages: Sequence[BaseEvent],
        context: ConversationContext,
        *,
        tools: Iterable[ToolSchema],
        response_schema: ResponseProto | None,
        serializer: S
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2053** (2026-05-28): **[Issue]: Incompatibility; LlamaIndexConversable doesn't work with the new LlamaIndex ReAct agent.**
  *Symptoms*: ### Describe the issue  You need to update the LlamaIndexConversable agent in AG2 to be compatible with the new ReAct agent introduced in LlamaIndex version 0.13. The current version of LlamaIndexConversable is not working because it's looking for a chat() method that no longer exists in the updated ReAct agent.  ### Steps to reproduce  _No response_  ### Screenshots and logs  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @afshinebtia thanks for reporting! Will take a look!

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

### Incident Patch 1: `f8dc76be` (2026-09-29)
**Commit Message**: fix(mcp): keep a conversation alive while any turn runs on it (#3311)

* fix(mcp): never evict a session store entry with a turn in flight

* fix(mcp): keep a conversation alive while any turn runs on it

Builds on the previous commit, which stopped idle expiry and LRU overflow
from dropping a conversation whose turn lock is held. Three gaps remained:

- Overflow counted the conversation being handed out as idle, since its
  turn lock is taken only after the registry returns it. With every other
  conversation mid-turn, a new caller was given a handle that was already
  evicted.
- `last` was refreshed only when a turn started, so a turn slower than the
  ttl survived but was expired by the very next request. The end of a turn
  now counts as use, refreshed synchronously so a cancelled turn cannot
  lose it.
- A resumed modern-era run continues without the turn lock it released
  when it paused, so it could still have its history dropped mid-run.
  `SessionStore.resumed()` replaces `touch()` and marks the conversation as
  in a turn for the length of the round. A conversation evicted while its
  run was paused is refused as an expired requestState instead of resumed
  onto an empty 

**File**: `ag2/mcp/executor.py` (modified, +33/-17)
```diff
@@ -4,7 +4,13 @@
 
 import asyncio
 from collections.abc import AsyncGenerator, Awaitable, Callable
-from contextlib import AbstractAsyncContextManager, AbstractContextManager, ExitStack, asynccontextmanager
+from contextlib import (
+    AbstractAsyncContextManager,
+    AbstractContextManager,
+    AsyncExitStack,
+    ExitStack,
+    asynccontextmanager,
+)
 from dataclasses import dataclass
 from typing import TYPE_CHECKING, Any
 
@@ -245,23 +251,25 @@ async def _resume(
         if state is None or turn is None:
             # A protocol error, not a tool error: the remedy is to start the call
             # again, which the model cannot reach by rewording.
-            raise MCPError(
-                code=INVALID_PARAMS,
-                message="Invalid or expired requestState",
-                data={"reason": "invalid_request_state"},
-            )
-        # Without this a turn that pauses for longer than the idle TTL is
-        # evicted mid-question, and the eviction reclaims the run being resumed.
-        if self._session_store is not None and turn.conversation is not None:
-            await self._session_store.touch(turn.conversation)
-        answer = (input_responses or {}).get(state.request_key)
-        if answer is not None:
-            # A refused answer consumes nothing and the current question is asked
-            # again below. Whether it is the right *kind* of answer is the
-            # asker's to judge, not this frame's.
-            turn.answer(state.request_key, answer)
+            raise _invalid_request_state()
         try:
-            return await self._advance(turn, turn.stream, request_context)
+            async with AsyncExitStack() as stack:
+                if self._session_store is not None and turn.conversation is not None:
+                    # The run continues without the turn lock it released when it
+                    # paused, so without this a round slower than the idle TTL is
+                    # evicted as it works.
+                    try:
+                        await stack.enter_async_context(self._session_store.resumed(turn.conversation))
+                    except UnknownConversationError:
+                        # Evicted since ``take``: the history the run would continue is gone.
+                        raise _invalid_request_state() from None
+                answer = (input_responses or {}).get(state.request_key)
+                if answer is not None:
+                    # A refused answer consumes nothing and the current question is asked
+                    # again below. Whether it is the right *kind* of answer is the
+                    # asker's to judge, not this frame's.
+                    turn.answer(state.request_key, answer)
+                return await self._advance(turn, turn.stream, request_context)
         except asyncio.CancelledError:
             # The round went away — a disconnect, a cancellation notification —
             # but the run did not, and the client's state still names it. Put it
@@ -488,6 +496,14 @@ def next(self) -> float:
         return self._value
 
 
+def _invalid_request_state() -> MCPError:
+    return MCPError(
+        code=INVALID_PARAMS,
+        message="Invalid or expired requestState",
+        data={"reason": "invalid_request_state"},
+    )
+
+
 @asynccontextmanager
 async def _stateless_conversation() -> AsyncGenerator[Conversation]:
     """A fresh per-call stream — no shared history, no cross-call lock, no handle."""
```

**File**: `ag2/mcp/sessions.py` (modified, +53/-31)
```diff
@@ -34,8 +34,10 @@ class SessionConfig:
     Attributes:
         max_sessions: LRU cap on conversations held at once. Every call naming
             none, with no MCP session to fall back on, mints one — so size for
-            the call rate and set a ``ttl``.
-        ttl: Idle expiry in seconds; ``None`` means no expiry.
+            the call rate and set a ``ttl``. A conversation mid-turn is never
+            evicted, so the cap gives way while all of them are.
+        ttl: Idle expiry in seconds since last use — a call, or the end of a
+            turn or of a resumed round; ``None`` means no expiry.
         storage: History backend shared across conversations. The handle-to-
             history registry is per-process either way, so a shared backend does
             not make a handle portable.
@@ -70,7 +72,7 @@ class Conversation:
 
 
 class _Entry:
-    __slots__ = ("stream_id", "handle", "principal", "last", "turn_lock")
+    __slots__ = ("stream_id", "handle", "principal", "last", "turn_lock", "resumed")
 
     def __init__(self, stream_id: UUID, handle: str, principal: str | None, last: float) -> None:
         self.stream_id = stream_id
@@ -90,6 +92,14 @@ def __init__(self, stream_id: UUID, handle: str, principal: str | None, last: fl
         # caller that releases it while a run is still inside ``ask`` (the
         # modern-era pause) must keep the next call away by other means.
         self.turn_lock = asyncio.Lock()
+        # Paused runs continuing right now, each without the turn lock it
+        # released when it paused.
+        self.resumed = 0
+
+    @property
+    def in_turn(self) -> bool:
+        """Whether a turn is running on this conversation, which makes it ineligible for eviction."""
+        return self.turn_lock.locked() or self.resumed > 0
 
 
 class SessionStore:
@@ -165,20 +175,26 @@ async def by_handle(self, handle: str, *, principal: str | None = None) -> Async
         async with self._held(entry) as conversation:
             yield conversation
 
-    async def touch(self, handle: str) -> None:
-        """Mark ``handle``'s conversation as used just now, without holding it.
+    @asynccontextmanager
+    async def resumed(self, handle: str) -> AsyncGenerator[None]:
+        """Keep ``handle``'s conversation from eviction while a paused run continues on it.
 
-        For work that keeps a conversation alive without going through the
-        serving methods, such as resuming a paused run. Silent for an unknown
-        handle: the callers that must refuse one raise where it is resolved.
+        Raises:
+            UnknownConversationError: The conversation was evicted while the run
+                was paused, so there is no history left to continue.
         """
         async with self._lock:
             key = self._by_handle.get(handle)
             entry = self._entries.get(key) if key is not None else None
-            if key is None or entry is None:
-                return
-            entry.last = self._clock()
-            self._entries.move_to_end(key)
+            if entry is None:
+                raise UnknownConversationError()
+            self._refresh(entry)
+            entry.resumed += 1
+        try:
+            yield
+        finally:
+            entry.resumed -= 1
+            self._refresh(entry)
 
     async def acquire(self, session_id: str, *, principal: str | None = None) -> MemoryStream:
         """Return a stream carrying ``session_id``'s accumulated conversation.
@@ -191,9 +207,25 @@ async def acquire(self, session_id: str, *, principal: str | None = None) -> Mem
 
     @asynccontextmanager
     async def _held(self, entry: _Entry) -> AsyncGenerator[Conversation]:
-        """Yield ``entry``'s conversation while holding its turn lock."""
+        """Yield ``entry``'s conversation while holding its turn lock.
+
+        The turn counts as use, so its end restarts the idle window — before the
+        lock is released, or maintenance could expir
```

**File**: `test/mcp/test_sessions.py` (modified, +107/-34)
```diff
@@ -10,6 +10,8 @@
 from mcp_types.version import LATEST_HANDSHAKE_VERSION
 
 from ag2 import Agent
+from ag2.context import ConversationContext
+from ag2.events import ModelRequest, TextInput
 from ag2.mcp.errors import UnknownConversationError
 from ag2.mcp.executor import AgentExecutor, _session_id
 from ag2.mcp.sessions import STDIO_SESSION, SessionConfig, SessionStore
@@ -258,48 +260,119 @@ def test_session_config_defaults() -> None:
     assert cfg.storage is None
 
 
-class TestEvictionSkipsActiveTurns:
-    @pytest.mark.asyncio
-    async def test_ttl_eviction_skips_session_with_turn_in_flight(self) -> None:
-        from ag2.context import ConversationContext
-        from ag2.events import ModelRequest, TextInput
-
-        t = {"now": 1000.0}
-        store = SessionStore(max_sessions=1024, ttl=100.0, clock=lambda: t["now"])
-        evicted: list[str] = []
-        store.on_evict = evicted.append
+@pytest.mark.asyncio
+class TestEvictionSparesTurnsInFlight:
+    """A turn holds its conversation for its whole scope, so neither bound may drop it midway."""
 
-        async with store.session("sess-A") as convo:
-            ctx = ConversationContext(stream=convo.stream)
-            await convo.stream.send(ModelRequest(TextInput("hello")), ctx)
-            t["now"] += 100.01  # the turn is slower than the idle TTL
+    async def test_idle_expiry_keeps_the_history_of_a_turn_slower_than_the_ttl(self) -> None:
+        clock = Clock()
+        store = SessionStore(ttl=10.0, clock=clock)
+        request = ModelRequest(TextInput("hello"))
 
-            # another client's request runs store maintenance
-            async with store.fresh():
+        async with store.session("a") as held:
+            await held.stream.send(request, ConversationContext(stream=held.stream))
+            clock.advance(20.0)
+            async with store.fresh():  # another caller's request runs maintenance
                 pass
 
-            events = list(await convo.stream.history.get_events())
-            assert len(events) == 1, "mid-turn history was dropped while the turn lock was held"
-            assert evicted == []
+            assert list(await held.stream.history.get_events()) == [request]
+
+    async def test_a_turn_that_outlived_the_ttl_can_be_continued(self) -> None:
+        clock = Clock()
+        store = SessionStore(ttl=10.0, clock=clock)
+
+        async with store.session("a") as held:
+            handle, stream_id = held.handle, held.stream.id
+            clock.advance(20.0)
+        assert handle is not None
+        clock.advance(1.0)
+
+        # The turn is what used the conversation, so its end restarts the idle window.
+        async with store.by_handle(handle) as continued:
+            assert continued.stream.id == stream_id
+
+    async def test_overflow_drops_the_oldest_idle_conversation(self) -> None:
+        store = SessionStore(max_sessions=2)
 
-    @pytest.mark.asyncio
-    async def test_overflow_eviction_skips_session_with_turn_in_flight(self) -> None:
-        from ag2.context import ConversationContext
-        from ag2.events import ModelRequest, TextInput
+        async with store.session("a") as held:
+            handle, stream_id = held.handle, held.stream.id
+            async with store.fresh() as idle:
+                idle_handle = idle.handle
+            async with store.fresh():  # over the bound: "a" is older, but mid-turn
+                pass
+        assert handle is not None
+        assert idle_handle is not None
+
+        async with store.by_handle(handle) as continued:
+            assert continued.stream.id == stream_id
+        with pytest.raises(UnknownConversationError):
+            async with store.by_handle(idle_handle):
+                pass
 
+    async def test_overflow_never_drops_the_conversation_it_is_serving(self) -> None:
         store = SessionStore(max_sessions=1)
-        evicted: list[str] = []
-        store.on_evict = evicted.append
 
-        async w
```

**File**: `website/docs/user-guide/tools/serving_mcp.mdx` (modified, +3/-3)
```diff
@@ -367,8 +367,8 @@ app = MCPServer(
 )
 ```
 
-- `max_sessions` — LRU cap; the least-recently-used conversation's history is dropped once the cap is exceeded.
-- `ttl` — idle expiry in seconds; a conversation untouched for longer has its history dropped (`None`, the default, means no expiry).
+- `max_sessions` — LRU cap; the least-recently-used conversation's history is dropped once the cap is exceeded. A conversation with a turn running on it is never dropped, so while every other one is mid-turn the cap gives way until a turn ends.
+- `ttl` — idle expiry in seconds; a conversation untouched for longer has its history dropped (`None`, the default, means no expiry). Idle time counts from the last call or the end of the last turn, so a turn that runs longer than the `ttl` is neither cut off nor expired the moment it finishes.
 - `storage` — the history backend.
 
 Both bounds are quoted in the `conversation` argument's own description, so a client can judge whether an old handle is still worth presenting.
@@ -438,7 +438,7 @@ Leave `security_settings` alone and AG2 puts the protection up itself — provid
 
 `SessionConfig(max_sessions=...)` and `TransportConfig(max_mcp_sessions=...)` sit side by side and bound different things:
 
-- `max_sessions` caps **conversation** sessions — how much history the server remembers. Overflowing it drops the least-recently-used conversation; nothing is refused.
+- `max_sessions` caps **conversation** sessions — how much history the server remembers. Overflowing it drops the least-recently-used conversation that has no turn running; nothing is refused.
 - `max_mcp_sessions` caps concurrent **MCP** sessions — the transport's own handshake-era sessions. A request that would open one beyond the cap is answered `503`.
 
 ### Stateless transports and the idle timeout
```

---

### Incident Patch 2: `a467af6f` (2026-09-28)
**Commit Message**: fix(mcp): never evict a session store entry with a turn in flight (#3288)

**File**: `ag2/mcp/sessions.py` (modified, +17/-2)
```diff
@@ -228,13 +228,28 @@ async def _handle_entry(self, handle: str, principal: str | None) -> _Entry:
     async def _evict_expired(self, now: float) -> None:
         if self._ttl is None:
             return
-        expired = [sid for sid, e in self._entries.items() if now - e.last > self._ttl]
+        expired = [
+            sid
+            for sid, e in self._entries.items()
+            # Skip sessions with a turn in flight: `last` is only refreshed at
+            # turn start, so a turn slower than the TTL would otherwise have
+            # its history dropped while it is still running.
+            if now - e.last > self._ttl and not e.turn_lock.locked()
+        ]
         for sid in expired:
             await self._drop(sid)
 
     async def _evict_overflow(self) -> None:
         while len(self._entries) > self._max:
-            await self._drop(next(iter(self._entries)))
+            # Never evict a session with a turn in flight; drop the oldest idle
+            # entry instead.
+            victim = next(
+                (sid for sid, e in self._entries.items() if not e.turn_lock.locked()),
+                None,
+            )
+            if victim is None:
+                break
+            await self._drop(victim)
 
     async def _drop(self, key: str) -> None:
         entry = self._entries.pop(key)
```

**File**: `test/mcp/test_sessions.py` (modified, +47/-0)
```diff
@@ -256,3 +256,50 @@ def test_session_config_defaults() -> None:
     assert cfg.max_sessions == 1024
     assert cfg.ttl is None
     assert cfg.storage is None
+
+
+class TestEvictionSkipsActiveTurns:
+    @pytest.mark.asyncio
+    async def test_ttl_eviction_skips_session_with_turn_in_flight(self) -> None:
+        from ag2.context import ConversationContext
+        from ag2.events import ModelRequest, TextInput
+
+        t = {"now": 1000.0}
+        store = SessionStore(max_sessions=1024, ttl=100.0, clock=lambda: t["now"])
+        evicted: list[str] = []
+        store.on_evict = evicted.append
+
+        async with store.session("sess-A") as convo:
+            ctx = ConversationContext(stream=convo.stream)
+            await convo.stream.send(ModelRequest(TextInput("hello")), ctx)
+            t["now"] += 100.01  # the turn is slower than the idle TTL
+
+            # another client's request runs store maintenance
+            async with store.fresh():
+                pass
+
+            events = list(await convo.stream.history.get_events())
+            assert len(events) == 1, "mid-turn history was dropped while the turn lock was held"
+            assert evicted == []
+
+    @pytest.mark.asyncio
+    async def test_overflow_eviction_skips_session_with_turn_in_flight(self) -> None:
+        from ag2.context import ConversationContext
+        from ag2.events import ModelRequest, TextInput
+
+        store = SessionStore(max_sessions=1)
+        evicted: list[str] = []
+        store.on_evict = evicted.append
+
+        async with store.session("sess-A") as convo:
+            ctx = ConversationContext(stream=convo.stream)
+            await convo.stream.send(ModelRequest(TextInput("hello")), ctx)
+            # force LRU overflow while sess-A's turn is still in flight
+            async with store.fresh():
+                pass
+
+            events = list(await convo.stream.history.get_events())
+            assert len(events) == 1, "active conversation was evicted by LRU overflow"
+            # the idle filler session is the one that had to go
+            assert len(evicted) == 1
+            assert evicted != [convo.handle]
```

---

### Incident Patch 3: `30bac326` (2026-09-28)
**Commit Message**: fix(tools): key approval grants by tool implementation, rank client tools below code

The "always" answer of approval_required was keyed by tool name, so a grant
for one implementation approved another tool of the same name on a later
turn (e.g. a local deploy, then an MCP server's deploy), including through a
hook shared by both. A tool now stamps ToolCallEvent.source on its copy of
the call before its middleware runs (function module:qualname:name, or the
MCP endpoint and remote tool name), and the grant is keyed by it. The key is
deterministic, so it survives rebuilding the agent from stored variables.

ClientTool (tools a client sends over AG-UI, A2A or NLIP) now ranks below
tools declared in code, so a client can no longer replace a server tool of
the same name. Overriding a tool declared in code logs a warning instead of
a debug line, since the replaced tool may have carried an approval gate.

Tests for tool-name collisions now go through the public API only: a real
served MCPServer instead of patching _mcp_session, CascadeConfig instead of
a MagicMock live config, AG-UI RunAgentInput.tools for client tools.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com

**File**: `ag2/events/tool_events.py` (modified, +14/-0)
```diff
@@ -5,6 +5,7 @@
 import json
 import traceback
 from collections.abc import Iterable
+from copy import copy
 from dataclasses import dataclass, field
 from itertools import chain
 from typing import Any
@@ -72,6 +73,13 @@ class ToolCallEvent(ToolEvent):
     # back verbatim (Anthropic's ``caller`` / ``toolset_name``). Same role as
     # ``BinaryInput.vendor_metadata``.
     vendor_metadata: dict[str, Any] = Field(default_factory=dict)
+    source: str | None = Field(default=None, compare=False)
+    """The tool implementation handling this call, e.g. ``function:app.ops:deploy:deploy``.
+
+    Set by the tool on its own copy of the call (:meth:`handled_by`) before its
+    middleware runs, so a value the model or a peer put here never reaches them.
+    ``None`` on the call the model emitted.
+    """
 
     _serialized_arguments: dict[str, Any] | None = Field(default=None, init=False, compare=False)
 
@@ -85,6 +93,12 @@ def serialized_arguments(self) -> dict[str, Any]:
     def serialized_arguments(self, value: dict[str, Any]) -> None:
         self._serialized_arguments = value
 
+    def handled_by(self, source: str) -> "ToolCallEvent":
+        """A copy of this call whose :attr:`source` is ``source``."""
+        call = copy(self)
+        call.source = source
+        return call
+
     def __repr__(self) -> str:
         text = f"id={self.id}, name='{self.name}'"
         if c := self.arguments:
```

**File**: `ag2/middleware/builtin/tools/approval.py` (modified, +10/-6)
```diff
@@ -19,6 +19,10 @@ class ApprovalRequired:
 
     Callable, so it satisfies :data:`~ag2.middleware.ToolMiddleware` wherever a
     hook is accepted. Approval state lives in ``context.variables``, not here.
+
+    An "always" answer is granted to the tool implementation handling the call
+    (:attr:`ToolCallEvent.source`), so another tool of the same name is still
+    asked about. A call with no ``source`` is granted by name.
     """
 
     def __init__(
@@ -53,10 +57,9 @@ async def __call__(
         event: ToolCallEvent,
         context: Context,
     ) -> ToolResultType:
-        if self._allow_always:
-            bypass_dict = context.variables.get(BYPASS_KEY, {})
-            if bypass_dict.get(event.name):
-                return await call_next(event, context)
+        grant = event.source or event.name
+        if self._allow_always and context.variables.get(BYPASS_KEY, {}).get(grant):
+            return await call_next(event, context)
 
         # Asked as a request that names the call, so a transport putting the
         # question to a remote human can render it as the approval it is. To
@@ -69,7 +72,7 @@ async def __call__(
         user_result = (await context.ask(request)).lower()
 
         if self._allow_always and user_result == "always":
-            context.variables[BYPASS_KEY] = {**context.variables.get(BYPASS_KEY, {}), event.name: True}
+            context.variables[BYPASS_KEY] = {**context.variables.get(BYPASS_KEY, {}), grant: True}
             return await call_next(event, context)
 
         elif user_result in ("y", "yes", "1"):
@@ -101,7 +104,8 @@ def approval_required(
             does not run.
         allow_always: When ``True``, the user can respond with ``always`` to
             approve the current and all subsequent calls of the same tool in the
-            same context.
+            same context. The answer covers only the tool implementation that was
+            asked about: a different tool with the same name is still asked.
 
     Returns:
         An :class:`ApprovalRequired` hook that can be passed to the
```

**File**: `ag2/tools/final/client_tool.py` (modified, +4/-0)
```diff
@@ -16,11 +16,15 @@
 
 
 class ClientTool(Tool):
+    """A tool a remote client declares on the wire and executes itself."""
+
     __slots__ = (
         "schema",
         "name",
     )
 
+    declared_in_code = False
+
     def __init__(self, schema: dict[str, Any]) -> None:
         self.schema = FunctionToolSchema.from_dict(schema)
         self.name = self.schema.function.name
```

**File**: `ag2/tools/final/function_tool.py` (modified, +9/-1)
```diff
@@ -80,6 +80,14 @@ def __init__(
 
         self.name = name
 
+    @property
+    def source(self) -> str:
+        """The implementation behind this tool: its function and the name it is called by."""
+        call = self.model.call
+        module = getattr(call, "__module__", None) or type(call).__module__
+        qualname = getattr(call, "__qualname__", None) or type(call).__qualname__
+        return f"function:{module}:{qualname}:{self.name}"
+
     @property
     def middleware(self) -> tuple[DescribedMiddleware, ...]:
         """Tool-scoped middleware, in execution order.
@@ -125,7 +133,7 @@ def register(
             execution = _wrap_middleware(mw.on_tool_execution, execution)
 
         async def execute(event: "ToolCallEvent", context: "Context") -> None:
-            result = await execution(event, context)
+            result = await execution(event.handled_by(self.source), context)
             await context.send(result)
 
         stack.enter_context(context.stream.where(ToolCallEvent.name == self.schema.function.name).sub_scope(execute))
```

**File**: `ag2/tools/precedence.py` (modified, +12/-11)
```diff
@@ -44,10 +44,11 @@ async def resolve_tools(tools: Iterable[Tool], context: Context) -> ResolvedTool
     Precedence, when two tools share a name:
 
     * Tools declared in code override each other in order: the later one wins,
-      like a dict update. Built-in tools count as declared in code.
-    * A tool an MCP server reports at runtime never overrides one declared in
-      code, wherever its toolkit sits; it is dropped with a warning.
-    * Between two MCP servers, the first server's tool wins; the other is
+      like a dict update, with a warning. Built-in tools count as declared in code.
+    * A tool a remote peer provides at runtime (an MCP server's tool, a tool a
+      client sends) never overrides one declared in code, wherever it sits; it
+      is dropped with a warning.
+    * Between two remote peers, the first one's tool wins; the other is
       dropped with a warning.
 
     Built-in schemas of one type may repeat (e.g. several ``MCPServerTool``
@@ -94,8 +95,8 @@ def _select(leaves: list[_Leaf]) -> list[bool]:
                 if (is_function or rival_is_function) and rival not in rivals:
                     rivals.append(rival)
 
-        # A tool declared in code wins over every rival; a tool an MCP server
-        # reports loses to any rival already in place.
+        # A tool declared in code wins over every rival; a tool a remote peer
+        # provides loses to any rival already in place.
         if rivals and not leaf.tool.declared_in_code:
             _report(rivals[0], leaf)
             continue
@@ -116,19 +117,19 @@ def _select(leaves: list[_Leaf]) -> list[bool]:
 def _report(winner: _Leaf, loser: _Leaf) -> None:
     name = next(n for n, _ in loser.keys if any(n == w for w, _ in winner.keys))
     if loser.tool.declared_in_code:
-        logger.debug("Tool `%s` from %s is overridden by %s.", name, loser.source, winner.source)
+        logger.warning("Tool `%s` from %s is overridden by %s.", name, loser.source, winner.source)
     elif winner.tool.declared_in_code:
         logger.warning(
-            "Tool `%s` reported by %s is ignored: %s declares a tool with that name, "
-            "and tools declared in code take precedence over tools an MCP server reports.",
+            "Tool `%s` provided by %s is ignored: %s declares a tool with that name, "
+            "and tools declared in code take precedence over tools a remote peer provides.",
             name,
             loser.source,
             winner.source,
         )
     else:
         logger.warning(
-            "Tool `%s` reported by %s is ignored: %s already provides it. "
-            "Set `tool_name_prefix` on the MCP server config to keep both.",
+            "Tool `%s` provided by %s is ignored: %s already provides it. "
+            "If the tools come from MCP servers, set `tool_name_prefix` on a server config to keep both.",
             name,
             loser.source,
             winner.source,
```

---

### Incident Patch 4: `3cf08799` (2026-09-28)
**Commit Message**: fix(network): close delegate channel when prompt send fails (#3304)

**File**: `ag2/network/client/tools/delegate.py` (modified, +3/-0)
```diff
@@ -14,6 +14,7 @@
 """
 
 import asyncio
+import contextlib
 from typing import TYPE_CHECKING
 
 from ag2.tools import tool
@@ -166,6 +167,8 @@ async def delegate(
                     depth=actual_client.current_handling_depth + 1,
                 )
             except Exception as exc:
+                with contextlib.suppress(Exception):
+                    await channel.close(reason="prompt_send_failed")
                 return f"Error: prompt send failed: {exc}"
 
             # Wait for the respondent's reply OR a terminal channel
```

**File**: `test/network/test_hub_invariants.py` (modified, +62/-0)
```diff
@@ -39,8 +39,11 @@
 from ag2.network import (
     EV_CHANNEL_INVITE,
     EV_CHANNEL_INVITE_ACK,
+    EV_CHANNEL_OPENED,
     EV_TEXT,
     AccessDeniedError,
+    Decision,
+    Deny,
     Envelope,
     Hub,
     HubClient,
@@ -50,6 +53,7 @@
     ProtocolError,
     Resume,
     Rule,
+    RuleBasedArbiter,
 )
 from ag2.network.adapters.conversation import (
     CONVERSATION_TYPE,
@@ -395,6 +399,64 @@ async def test_delegate_returns_target_reply_without_dropping_fast_reply() -> No
     await hub.close()
 
 
+class _RejectTextArbiter(RuleBasedArbiter):
+    async def authorize_send(
+        self,
+        envelope: Envelope,
+        sender: Passport,
+        sender_rule: Rule,
+        recipients: list[Passport],
+    ) -> Decision:
+        if envelope.event_type == EV_TEXT:
+            return Deny(reason="prompt rejected")
+        return await super().authorize_send(envelope, sender, sender_rule, recipients)
+
+
+class _CloseFailingHub(Hub):
+    async def close_channel(self, channel_id: str, *, reason: str = "") -> ChannelMetadata:
+        raise RuntimeError("channel cleanup failed")
+
+
+@pytest.mark.asyncio
+async def test_delegate_closes_channel_when_prompt_send_fails() -> None:
+    store = MemoryKnowledgeStore()
+    hub = await Hub.open(store, ttl_sweep_interval=0, expectation_sweep_interval=0)
+    try:
+        alice = await hub.register(_agent("alice"))
+        await hub.register(_agent("bob"))
+        hub.register_arbiter(_RejectTextArbiter())
+
+        result = await _invoke(make_delegate_tool(alice), {"target": "bob", "prompt": "hi"})
+
+        assert result == "Error: prompt send failed: prompt rejected"
+        [channel] = await hub.list_channels(agent_id=alice.agent_id)
+        assert channel.manifest.type == "consulting"
+        events = await hub.read_wal(channel.channel_id)
+        assert EV_CHANNEL_OPENED in [event.event_type for event in events]
+        assert all(event.event_type != EV_TEXT for event in events)
+        assert await hub.list_channels(state=ChannelState.ACTIVE) == []
+        assert channel.state == ChannelState.CLOSED
+        assert channel.close_reason == "prompt_send_failed"
+    finally:
+        await hub.close()
+
+
+@pytest.mark.asyncio
+async def test_delegate_preserves_prompt_send_error_when_channel_close_fails() -> None:
+    store = MemoryKnowledgeStore()
+    hub = await _CloseFailingHub.open(store, ttl_sweep_interval=0, expectation_sweep_interval=0)
+    try:
+        alice = await hub.register(_agent("alice"))
+        await hub.register(_agent("bob"))
+        hub.register_arbiter(_RejectTextArbiter())
+
+        result = await _invoke(make_delegate_tool(alice), {"target": "bob", "prompt": "hi"})
+
+        assert result == "Error: prompt send failed: prompt rejected"
+    finally:
+        await hub.close()
+
+
 @pytest.mark.asyncio
 async def test_delegate_resolves_functions_namespaced_target() -> None:
     """A ``functions.``-prefixed target still resolves to the real peer.
```

---

### Incident Patch 5: `bfae1f0e` (2026-09-28)
**Commit Message**: fix(network): validate context result counts (#3305)

**File**: `ag2/network/client/tools/context.py` (modified, +4/-2)
```diff
@@ -18,6 +18,8 @@
 
 from typing import TYPE_CHECKING, Literal
 
+from pydantic import Field
+
 from ag2.tools import tool
 
 from ...envelope import EV_TEXT, Envelope, visible_to
@@ -49,8 +51,8 @@ async def context(
         query: str | None = None,
         scope: Literal["channel", "knowledge"] = "channel",
         speaker: str | None = None,
-        recent_n: int = 1,
-        limit: int = 10,
+        recent_n: int = Field(default=1, ge=1),
+        limit: int = Field(default=10, ge=1),
         channel_id: str | None = None,
         client: AgentClientInject = None,
         channel: ChannelInject = None,
```

**File**: `test/network/test_tools.py` (modified, +21/-2)
```diff
@@ -24,7 +24,10 @@
 from ag2.events import ToolCallEvent
 from ag2.knowledge import MemoryKnowledgeStore
 from ag2.network import (
+    EV_CHANNEL_INVITE,
+    EV_CHANNEL_INVITE_ACK,
     EV_TASK_CANCEL_REQUEST,
+    Envelope,
     Hub,
     Resume,
 )
@@ -211,6 +214,15 @@ async def test_context_search_finds_substring_in_channel_wal() -> None:
     assert len(results) == 1
     assert "framework" in results[0]["excerpt"]
 
+    for limit in (0, -1):
+        result = await _invoke(
+            tool,
+            {"action": "search", "query": "framework", "limit": limit},
+            dependencies=deps,
+        )
+        assert isinstance(result, str)
+        assert "greater than or equal to 1" in result
+
     await hub.close()
 
 
@@ -223,8 +235,6 @@ async def test_context_quote_returns_recent_n_from_speaker() -> None:
     bob = await hub.register(_agent("bob"), attach_plugin=False)
 
     # Auto-ack on bob so the conversation activates.
-    from ag2.network import EV_CHANNEL_INVITE, EV_CHANNEL_INVITE_ACK, Envelope
-
     async def _ack(envelope: Envelope) -> None:
         if envelope.event_type != EV_CHANNEL_INVITE:
             return
@@ -251,6 +261,15 @@ async def _ack(envelope: Envelope) -> None:
     quotes = await _invoke(tool, {"action": "quote", "speaker": "alice", "recent_n": 2}, dependencies=deps)
     assert [q["text"] for q in quotes] == ["alice 2", "alice 3"]
 
+    for recent_n in (0, -1):
+        result = await _invoke(
+            tool,
+            {"action": "quote", "speaker": "alice", "recent_n": recent_n},
+            dependencies=deps,
+        )
+        assert isinstance(result, str)
+        assert "greater than or equal to 1" in result
+
     await hub.close()
 
 
```

---

### Incident Patch 6: `3dc58b0a` (2026-09-28)
**Commit Message**: fix(tools): resolve tools sharing a name by precedence

Replace the duplicate-name error with precedence, so a turn still
exposes one schema and registers one tool per name while overriding a
tool stays possible:

- tools declared in code override each other by order (later wins,
  debug log only); built-in tools count as declared in code;
- tools an MCP server reports rank below tools declared in code,
  wherever the toolkit sits, and are dropped with a warning;
- between MCP servers the first server's tool wins, the rest are
  dropped with a warning suggesting tool_name_prefix.

resolve_tools (ag2/tools/precedence.py) resolves toolkits member by
member after discovery and registers pruned copies, so a dropped tool
is never subscribed and never receives a call. Agent and LiveAgent use
it. ToolConflictError keeps its original signature.

ADR 0020 and the tools/MCP docs pages describe the precedence.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `ag2/agent.py` (modified, +5/-5)
```diff
@@ -83,8 +83,8 @@
 from .stream import MemoryStream, Stream, StreamId
 from .task import CheckpointStore, Task, TaskSpec
 from .tools.builtin.tool_search import ToolSearchToolSchema
-from .tools.executor import resolve_tool_schemas
 from .tools.final import FunctionTool, Toolkit, tool
+from .tools.precedence import resolve_tools
 from .tools.schemas import ToolSchema
 from .tools.subagents.run_task import run_task as _run_task
 from .tools.subagents.subagent_tool import StreamOrFactory, subagent_tool
@@ -1349,8 +1349,8 @@ async def _turn_scope(
 
             all_schemas: list[ToolSchema] = []
             tool_search_schema: ToolSearchToolSchema | None = None
-            schemas, known_tools = await resolve_tool_schemas(all_tools, context)
-            for schema in schemas:
+            resolved_tools = await resolve_tools(all_tools, context)
+            for schema in resolved_tools.schemas:
                 if isinstance(schema, ToolSearchToolSchema):
                     tool_search_schema = schema
                 else:
@@ -1436,8 +1436,8 @@ async def _call_client(event: BaseEvent, context: Context) -> None:
                 self._tool_executor.register(
                     stack,
                     context,
-                    tools=all_tools,
-                    known_tools=known_tools,
+                    tools=resolved_tools.tools,
+                    known_tools=resolved_tools.known_tools,
                     middleware=middleware_instances,
                 )
 
```

**File**: `ag2/exceptions.py` (modified, +3/-13)
```diff
@@ -2,7 +2,7 @@
 #
 # SPDX-License-Identifier: Apache-2.0
 
-from collections.abc import Iterable, Sequence
+from collections.abc import Iterable
 from unittest.mock import Mock
 
 
@@ -11,18 +11,8 @@ class AG2Error(Exception):
 
 
 class ToolConflictError(AG2Error):
-    """Raised when two tools answer to the same name.
-
-    ``sources`` names the tools that expose it, when they are known.
-    """
-
-    def __init__(self, tool_name: str, *, sources: Sequence[str] = ()) -> None:
-        self.tool_name = tool_name
-        self.sources = tuple(sources)
-        message = f"Could not add tool: `{tool_name}`. Tool with such name already registered."
-        if self.sources:
-            message += f" Exposed by: {', '.join(self.sources)}. Give each tool a unique name."
-        super().__init__(message)
+    def __init__(self, tool_name: str) -> None:
+        super().__init__(f"Could not add tool: `{tool_name}`. Tool with such name already registered.")
 
 
 class ToolResolutionError(AG2Error):
```

**File**: `ag2/live/realtime.py` (modified, +5/-5)
```diff
@@ -14,8 +14,8 @@
 from ag2.middleware.base import BaseMiddleware, MiddlewareFactory
 from ag2.observers import Observer
 from ag2.stream import MemoryStream
-from ag2.tools.executor import resolve_tool_schemas
 from ag2.tools.final import FunctionTool
+from ag2.tools.precedence import resolve_tools
 from ag2.tools.schemas import ToolSchema
 from ag2.tools.tool import Tool
 from ag2.usage import UsageReport
@@ -144,14 +144,14 @@ async def run(
                     ),
                 )
 
-            all_schemas, known_tools = await resolve_tool_schemas(all_tools, context)
+            resolved_tools = await resolve_tools(all_tools, context)
 
             if all_tools:
                 self._tool_executor.register(
                     s,
                     context,
-                    tools=all_tools,
-                    known_tools=known_tools,
+                    tools=resolved_tools.tools,
+                    known_tools=resolved_tools.known_tools,
                     middleware=middleware_instances,
                 )
 
@@ -162,7 +162,7 @@ async def run(
                 active_config.session(
                     context,
                     instructions=instructions,
-                    tools=all_schemas,
+                    tools=resolved_tools.schemas,
                     serializer=self._serializer,
                 )
             )
```

**File**: `ag2/tools/executor.py` (modified, +1/-43)
```diff
@@ -23,54 +23,12 @@
     ToolResultEvent,
     ToolResultsEvent,
 )
-from ag2.exceptions import HumanInputError, ToolConflictError, ToolNotFoundError
+from ag2.exceptions import HumanInputError, ToolNotFoundError
 from ag2.middleware import BaseMiddleware
 
-from .final import FunctionToolSchema
-from .schemas import ToolSchema
 from .tool import Tool
 
 
-async def resolve_tool_schemas(
-    tools: Iterable["Tool"],
-    context: "Context",
-) -> tuple[list["ToolSchema"], set[str]]:
-    """Resolve the schemas ``tools`` expose for a turn and the names calls reach them by.
-
-    A ``ToolCallEvent`` is dispatched by name to every tool subscribed to it,
-    and the model tells tools apart only by name, so each callable name must
-    belong to exactly one tool. A function name exposed twice, or equal to a
-    built-in tool's name, raises :class:`~ag2.exceptions.ToolConflictError`
-    naming both sources. Built-in schemas of one type may repeat (e.g. several
-    ``MCPServerTool`` servers).
-
-    Runs on the tools resolved for the turn, so names a toolkit discovers at
-    runtime (e.g. from an MCP server) are checked too.
-    """
-    schemas: list[ToolSchema] = []
-    functions: dict[str, Tool] = {}
-    builtins: dict[str, Tool] = {}
-    for tool in tools:
-        for schema in await tool.schemas(context):
-            schemas.append(schema)
-            if isinstance(schema, FunctionToolSchema):
-                name = schema.function.name
-                owner = functions.get(name, builtins.get(name))
-                if owner is not None:
-                    raise ToolConflictError(name, sources=(_describe_tool(owner), _describe_tool(tool)))
-                functions[name] = tool
-            else:
-                owner = functions.get(schema.type)
-                if owner is not None:
-                    raise ToolConflictError(schema.type, sources=(_describe_tool(owner), _describe_tool(tool)))
-                builtins.setdefault(schema.type, tool)
-    return schemas, functions.keys() | builtins.keys()
-
-
-def _describe_tool(tool: "Tool") -> str:
-    return f"{type(tool).__name__}({tool.name!r})"
-
-
 class ToolExecutor:
     def __init__(self, serializer: SerializerProto) -> None:
         self.__serializer = serializer
```

**File**: `ag2/tools/precedence.py` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
+#
+# SPDX-License-Identifier: Apache-2.0
+
+import logging
+from collections.abc import Iterable, Iterator
+from copy import copy
+from dataclasses import dataclass
+
+from ag2.annotations import Context
+
+from .builtin.tool_search import ToolSearchTool
+from .final import FunctionToolSchema, Toolkit
+from .schemas import ToolSchema
+from .tool import Tool
+
+logger = logging.getLogger(__name__)
+
+
+@dataclass(slots=True)
+class ResolvedTools:
+    """The tools a turn registers and the schemas it exposes, one tool per callable name."""
+
+    tools: list[Tool]
+    schemas: list[ToolSchema]
+    known_tools: set[str]
+
+
+@dataclass(slots=True, eq=False)
+class _Leaf:
+    tool: Tool
+    keys: list[tuple[str, bool]]
+    """``(name, is_function)`` for each schema: function name, or built-in type."""
+    source: str
+
+
+async def resolve_tools(tools: Iterable[Tool], context: Context) -> ResolvedTools:
+    """Resolve ``tools`` so that every name the model can call belongs to one tool.
+
+    The model calls a tool by name and a ``ToolCallEvent`` reaches every tool
+    subscribed to that name, so a turn keeps exactly one tool per name. Toolkits
+    are resolved member by member, after they discover their tools.
+
+    Precedence, when two tools share a name:
+
+    * Tools declared in code override each other in order: the later one wins,
+      like a dict update. Built-in tools count as declared in code.
+    * A tool an MCP server reports at runtime never overrides one declared in
+      code, wherever its toolkit sits; it is dropped with a warning.
+    * Between two MCP servers, the first server's tool wins; the other is
+      dropped with a warning.
+
+    Built-in schemas of one type may repeat (e.g. several ``MCPServerTool``
+    servers); only a function name clashes with them. A dropped tool is not
+    registered, so it never receives a call.
+    """
+    declared = list(tools)
+    leaves: list[_Leaf] = []
+    for tool in declared:
+        await _collect_leaves(tool, context, "", leaves)
+
+    keep = iter(_select(leaves))
+    resolved = [pruned for tool in declared if (pruned := _prune(tool, keep)) is not None]
+
+    schemas = [schema for tool in resolved for schema in await tool.schemas(context)]
+    known_tools = {s.function.name if isinstance(s, FunctionToolSchema) else s.type for s in schemas}
+    return ResolvedTools(resolved, schemas, known_tools)
+
+
+async def _collect_leaves(tool: Tool, context: Context, parent: str, out: list[_Leaf]) -> None:
+    source = f"{parent}{type(tool).__name__}({tool.name!r})"
+    if isinstance(tool, Toolkit | ToolSearchTool):
+        # A toolkit may discover its members here (e.g. ``MCPToolkit``).
+        await tool.schemas(context)
+        for child in tool.tools:
+            await _collect_leaves(child, context, f"{source} > ", out)
+        return
+
+    keys = [
+        (s.function.name, True) if isinstance(s, FunctionToolSchema) else (s.type, False)
+        for s in await tool.schemas(context)
+    ]
+    out.append(_Leaf(tool, keys, source))
+
+
+def _select(leaves: list[_Leaf]) -> list[bool]:
+    """Whether each leaf, in order, keeps its place in the turn."""
+    owners: dict[str, list[tuple[_Leaf, bool]]] = {}
+    kept: list[_Leaf] = []
+    for leaf in leaves:
+        rivals: list[_Leaf] = []
+        for name, is_function in leaf.keys:
+            for rival, rival_is_function in owners.get(name, ()):
+                if (is_function or rival_is_function) and rival not in rivals:
+                    rivals.append(rival)
+
+        # A tool declared in code wins over every rival; a tool an MCP server
+        # reports loses to any rival already in place.
+        if rivals and not leaf.tool.declared_in_code:
+            _report(rivals[0], leaf)
+            continue
+
+        for rival in rivals:
+            _report(leaf, riv
```

---

### Incident Patch 7: `11a250f4` (2026-09-28)
**Commit Message**: fix(tools): reject tools that share a name within a turn

The model calls a tool by name and a ToolCallEvent reaches every tool
subscribed to that name, so two tools named alike both ran on one call,
and an approval decision (including a denial) on one did not bind the
other.

Resolve each turn's tool schemas through resolve_tool_schemas, which
raises ToolConflictError naming both sources when a function name is
exposed twice or equals a built-in tool's name. Agent and LiveAgent both
use it, after toolkits such as MCPToolkit discover their tools, so names
from every source (agent tools, ask(tools=...), toolkits, plugins,
sub-task, knowledge and deferred tools) are checked. Repeated built-in
schema types (several MCPServerTool servers) stay allowed.

Records the decision in ADR 0020 and documents it on the tools and MCP
pages.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `ag2/agent.py` (modified, +8/-15)
```diff
@@ -83,7 +83,8 @@
 from .stream import MemoryStream, Stream, StreamId
 from .task import CheckpointStore, Task, TaskSpec
 from .tools.builtin.tool_search import ToolSearchToolSchema
-from .tools.final import FunctionTool, FunctionToolSchema, Toolkit, tool
+from .tools.executor import resolve_tool_schemas
+from .tools.final import FunctionTool, Toolkit, tool
 from .tools.schemas import ToolSchema
 from .tools.subagents.run_task import run_task as _run_task
 from .tools.subagents.subagent_tool import StreamOrFactory, subagent_tool
@@ -1347,21 +1348,13 @@ async def _turn_scope(
             all_tools: tuple[Tool, ...] = tuple(chain(self.tools, self._additional_tools, additional_tools))
 
             all_schemas: list[ToolSchema] = []
-            known_tools: set[str] = set()
             tool_search_schema: ToolSearchToolSchema | None = None
-            for t in all_tools:
-                schemas = await t.schemas(context)
-
-                for schema in schemas:
-                    if isinstance(schema, FunctionToolSchema):
-                        known_tools.add(schema.function.name)
-                    else:
-                        known_tools.add(schema.type)
-
-                    if isinstance(schema, ToolSearchToolSchema):
-                        tool_search_schema = schema
-                    else:
-                        all_schemas.append(schema)
+            schemas, known_tools = await resolve_tool_schemas(all_tools, context)
+            for schema in schemas:
+                if isinstance(schema, ToolSearchToolSchema):
+                    tool_search_schema = schema
+                else:
+                    all_schemas.append(schema)
 
             if tool_search_schema is not None:
                 all_schemas.append(tool_search_schema)
```

**File**: `ag2/exceptions.py` (modified, +13/-3)
```diff
@@ -2,7 +2,7 @@
 #
 # SPDX-License-Identifier: Apache-2.0
 
-from collections.abc import Iterable
+from collections.abc import Iterable, Sequence
 from unittest.mock import Mock
 
 
@@ -11,8 +11,18 @@ class AG2Error(Exception):
 
 
 class ToolConflictError(AG2Error):
-    def __init__(self, tool_name: str) -> None:
-        super().__init__(f"Could not add tool: `{tool_name}`. Tool with such name already registered.")
+    """Raised when two tools answer to the same name.
+
+    ``sources`` names the tools that expose it, when they are known.
+    """
+
+    def __init__(self, tool_name: str, *, sources: Sequence[str] = ()) -> None:
+        self.tool_name = tool_name
+        self.sources = tuple(sources)
+        message = f"Could not add tool: `{tool_name}`. Tool with such name already registered."
+        if self.sources:
+            message += f" Exposed by: {', '.join(self.sources)}. Give each tool a unique name."
+        super().__init__(message)
 
 
 class ToolResolutionError(AG2Error):
```

**File**: `ag2/live/realtime.py` (modified, +3/-11)
```diff
@@ -14,7 +14,8 @@
 from ag2.middleware.base import BaseMiddleware, MiddlewareFactory
 from ag2.observers import Observer
 from ag2.stream import MemoryStream
-from ag2.tools.final import FunctionTool, FunctionToolSchema
+from ag2.tools.executor import resolve_tool_schemas
+from ag2.tools.final import FunctionTool
 from ag2.tools.schemas import ToolSchema
 from ag2.tools.tool import Tool
 from ag2.usage import UsageReport
@@ -143,16 +144,7 @@ async def run(
                     ),
                 )
 
-            all_schemas: list[ToolSchema] = []
-            known_tools: set[str] = set()
-            for t in all_tools:
-                schemas = await t.schemas(context)
-                all_schemas.extend(schemas)
-                for schema in schemas:
-                    if isinstance(schema, FunctionToolSchema):
-                        known_tools.add(schema.function.name)
-                    else:
-                        known_tools.add(schema.type)
+            all_schemas, known_tools = await resolve_tool_schemas(all_tools, context)
 
             if all_tools:
                 self._tool_executor.register(
```

**File**: `ag2/tools/executor.py` (modified, +43/-1)
```diff
@@ -23,12 +23,54 @@
     ToolResultEvent,
     ToolResultsEvent,
 )
-from ag2.exceptions import HumanInputError, ToolNotFoundError
+from ag2.exceptions import HumanInputError, ToolConflictError, ToolNotFoundError
 from ag2.middleware import BaseMiddleware
 
+from .final import FunctionToolSchema
+from .schemas import ToolSchema
 from .tool import Tool
 
 
+async def resolve_tool_schemas(
+    tools: Iterable["Tool"],
+    context: "Context",
+) -> tuple[list["ToolSchema"], set[str]]:
+    """Resolve the schemas ``tools`` expose for a turn and the names calls reach them by.
+
+    A ``ToolCallEvent`` is dispatched by name to every tool subscribed to it,
+    and the model tells tools apart only by name, so each callable name must
+    belong to exactly one tool. A function name exposed twice, or equal to a
+    built-in tool's name, raises :class:`~ag2.exceptions.ToolConflictError`
+    naming both sources. Built-in schemas of one type may repeat (e.g. several
+    ``MCPServerTool`` servers).
+
+    Runs on the tools resolved for the turn, so names a toolkit discovers at
+    runtime (e.g. from an MCP server) are checked too.
+    """
+    schemas: list[ToolSchema] = []
+    functions: dict[str, Tool] = {}
+    builtins: dict[str, Tool] = {}
+    for tool in tools:
+        for schema in await tool.schemas(context):
+            schemas.append(schema)
+            if isinstance(schema, FunctionToolSchema):
+                name = schema.function.name
+                owner = functions.get(name, builtins.get(name))
+                if owner is not None:
+                    raise ToolConflictError(name, sources=(_describe_tool(owner), _describe_tool(tool)))
+                functions[name] = tool
+            else:
+                owner = functions.get(schema.type)
+                if owner is not None:
+                    raise ToolConflictError(schema.type, sources=(_describe_tool(owner), _describe_tool(tool)))
+                builtins.setdefault(schema.type, tool)
+    return schemas, functions.keys() | builtins.keys()
+
+
+def _describe_tool(tool: "Tool") -> str:
+    return f"{type(tool).__name__}({tool.name!r})"
+
+
 class ToolExecutor:
     def __init__(self, serializer: SerializerProto) -> None:
         self.__serializer = serializer
```

**File**: `docs/adr/0020-tool-names-are-unique-per-turn.md` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+---
+status: accepted
+date: 2026-09-28
+---
+
+# 0020. A tool name is unique among the tools exposed in a turn
+
+## Context
+
+The model calls a tool by name, and a `ToolCallEvent` reaches every tool subscribed to
+that name on the stream. Per-tool state keyed by name, such as `approval_required`'s
+"always" answer, assumes one tool behind each name. Tools reach a turn from several
+sources — `Agent(tools=...)`, `ask(tools=...)`, toolkits, plugins, sub-task and knowledge
+tools, and names an `MCPToolkit` discovers at runtime — and nothing tied them together, so
+two tools with one name both ran on a single call, and a human's decision about one of
+them did not bind the other.
+
+The options were: dispatch by a per-registration id instead of by name, disambiguate
+duplicates automatically (e.g. a forced source prefix), or require unique names.
+
+## Decision
+
+The names a turn exposes to the model must be unique. `resolve_tool_schemas`
+(`ag2/tools/executor.py`) resolves the schemas of every tool for the turn — after dynamic
+discovery — and raises `ToolConflictError` naming both sources when a function name is
+exposed twice or equals a built-in tool's name. `Agent` and `LiveAgent` both assemble
+their tools through it. Built-in schemas of one type may repeat (several `MCPServerTool`
+servers), since the provider, not ag2, tells those apart.
+
+Dispatch by id was rejected: the model still sees only names, so two same-name schemas
+stay indistinguishable to it and to the human asked to approve a call. Automatic prefixes
+were rejected because they silently rename tools the prompt or the user refers to;
+`MCPToolkit`'s explicit `tool_name_prefix` already covers the legitimate need.
+
+## Consequences
+
+- A turn with a duplicate name fails before any model call, rather than running several
+  implementations for one call.
+- Name-keyed state (the approval bypass, `known_tools`) can rely on a
+  name identifying one tool within a turn.
+- An MCP server that starts exposing a name already in use fails the next turn; the fix is
+  a `tool_name_prefix` or renaming the local tool.
```

---

### Incident Patch 8: `26154fa8` (2026-09-27)
**Commit Message**: fix(mcp): send one Authorization header from MCPServerTool on every provider (#3299)

* fix(mcp): send one Authorization header from MCPServerTool on every provider

MCPServerToolSchema.http_headers() merges authorization_token into headers
unless an Authorization header is already present (case-insensitive), matching
MCPToolkit. The OpenAI, xAI and ACP mappers use it, so:

- ACP no longer appends a second Authorization next to an explicit one;
- xAI recognises any casing and no longer leaks it into extra_headers;
- OpenAI no longer drops the token when unrelated headers are set.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* docs(tools): update MCP server tool provider support matrix

---------

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Co-authored-by: Semen Frolov <vvlrff@gmail.com>

**File**: `ag2/acp/tool_gateway.py` (modified, +1/-3)
```diff
@@ -211,9 +211,7 @@ def partition_tools(tools: "Iterable[ToolSchema]") -> tuple[list[FunctionToolSch
                     f"(server {tool.server_label!r}); remove the filter or connect the server "
                     "as an MCP toolkit so AG2 executes its tools."
                 )
-            headers = [schema.HttpHeader(name=k, value=v) for k, v in (tool.headers or {}).items()]
-            if tool.authorization_token:
-                headers.append(schema.HttpHeader(name="Authorization", value=f"Bearer {tool.authorization_token}"))
+            headers = [schema.HttpHeader(name=k, value=v) for k, v in tool.http_headers().items()]
             external.append(
                 schema.HttpMcpServer(type="http", name=tool.server_label, url=tool.server_url, headers=headers)
             )
```

**File**: `ag2/config/openai/mappers.py` (modified, +2/-4)
```diff
@@ -685,10 +685,8 @@ def tool_to_responses_api(t: ToolSchema) -> dict[str, Any]:
 
         if t.allowed_tools is not None:
             mcp["allowed_tools"] = t.allowed_tools
-        if t.headers is not None:
-            mcp["headers"] = t.headers
-        elif t.authorization_token is not None:
-            mcp["headers"] = {"Authorization": f"Bearer {t.authorization_token}"}
+        if headers := t.http_headers():
+            mcp["headers"] = headers
         return dict(mcp)
 
     elif isinstance(t, SkillsToolSchema):
```

**File**: `ag2/config/xai/mappers.py` (modified, +8/-8)
```diff
@@ -177,14 +177,14 @@ def tool_to_api(t: ToolSchema) -> chat_pb2.Tool:
             kwargs["server_description"] = t.description
         if t.allowed_tools is not None:
             kwargs["allowed_tool_names"] = t.allowed_tools
-        if t.authorization_token is not None:
-            kwargs["authorization"] = f"Bearer {t.authorization_token}"
-        elif t.headers is not None and "Authorization" in t.headers:
-            kwargs["authorization"] = t.headers["Authorization"]
-        if t.headers is not None:
-            extra = {k: v for k, v in t.headers.items() if k != "Authorization"}
-            if extra:
-                kwargs["extra_headers"] = extra
+        extra: dict[str, str] = {}
+        for key, value in t.http_headers().items():
+            if key.lower() == "authorization":
+                kwargs["authorization"] = value
+            else:
+                extra[key] = value
+        if extra:
+            kwargs["extra_headers"] = extra
         return xai_tools.mcp(**kwargs)
 
     raise UnsupportedToolError(t.type, PROVIDER)
```

**File**: `ag2/tools/builtin/mcp_server.py` (modified, +11/-0)
```diff
@@ -28,6 +28,17 @@ class MCPServerToolSchema(ToolSchema):
     blocked_tools: list[str] | None = None
     headers: dict[str, str] | None = None
 
+    def http_headers(self) -> dict[str, str]:
+        """Headers to send to the server, with ``authorization_token`` as a bearer ``Authorization`` header.
+
+        An ``Authorization`` entry already in ``headers`` (matched case-insensitively) takes precedence
+        over ``authorization_token``, so a request never carries two credentials.
+        """
+        headers = dict(self.headers or {})
+        if self.authorization_token and not any(key.lower() == "authorization" for key in headers):
+            headers["Authorization"] = f"Bearer {self.authorization_token}"
+        return headers
+
 
 class MCPServerTool(Tool):
     __slots__ = (
```

**File**: `test/acp/test_tool_gateway.py` (modified, +11/-0)
```diff
@@ -67,6 +67,17 @@ def test_partition_translates_mcp_server_tool() -> None:
     assert header_map["Authorization"] == "Bearer tok123"
 
 
+def test_partition_sends_one_authorization_header() -> None:
+    tool = MCPServerToolSchema(
+        server_url="https://mcp.example.com/mcp",
+        server_label="ext",
+        authorization_token="fallback",
+        headers={"authorization": "Bearer explicit"},
+    )
+    _, (server,) = partition_tools([tool])
+    assert [(h.name, h.value) for h in server.headers] == [("authorization", "Bearer explicit")]
+
+
 @pytest.mark.parametrize(
     "filters",
     [
```

---

### Incident Patch 9: `8acf467f` (2026-09-27)
**Commit Message**: fix(mcp): preserve explicit authorization headers regardless of casing (#3297)

Co-authored-by: Semen Frolov <148821259+vvlrff@users.noreply.github.com>

**File**: `ag2/tools/toolkits/mcp_server/toolkit.py` (modified, +1/-1)
```diff
@@ -510,7 +510,7 @@ def _resolve_config(config: AnyMCPConfig, context: "Context") -> AnyMCPConfig:
 
     headers = dict(_resolve_value(config.headers, context) or {})
     auth = _resolve_value(config.authorization_token, context)
-    if auth and "Authorization" not in headers:
+    if auth and not any(key.lower() == "authorization" for key in headers):
         headers["Authorization"] = f"Bearer {auth}"
 
     return replace(
```

**File**: `ag2/tools/toolkits/mcp_server/types.py` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ class MCPServerConfig:
     """Where the server listens, as a full URL including the MCP endpoint path."""
 
     authorization_token: str | Variable | None = None
-    """Bearer token sent on every request to the server."""
+    """Bearer token sent unless ``headers`` already contains ``Authorization`` (case-insensitive)."""
 
     headers: dict[str, str] | Variable | None = None
     """Extra HTTP headers sent on every request, for anything a bearer token cannot carry."""
```

**File**: `test/tools/test_mcp_live_transport.py` (modified, +38/-6)
```diff
@@ -31,7 +31,9 @@
 
 pytest.importorskip("mcp")
 
-from ag2 import Agent, Context
+from starlette.datastructures import Headers
+
+from ag2 import Agent, Context, Variable
 from ag2.events import (
     HumanInputRequest,
     HumanMessage,
@@ -55,7 +57,7 @@ def echo(message: str) -> str:
 
 @asynccontextmanager
 async def _live_mcp_server(
-    headers_seen: list[dict[str, str]] | None = None,
+    headers_seen: list[Headers] | None = None,
 ) -> AsyncGenerator[str]:
     """Serve an AG2 ``MCPServer`` on a loopback port, yielding the MCP endpoint URL.
 
@@ -82,12 +84,12 @@ async def _serving_mcp(app: Any) -> AsyncGenerator[str]:
         yield f"{base_url}/mcp/"
 
 
-def _recording(app: Any, headers_seen: list[dict[str, str]]) -> Any:
+def _recording(app: Any, headers_seen: list[Headers]) -> Any:
     """Wrap an ASGI app, recording each HTTP request's headers."""
 
     async def recording(scope: dict[str, Any], receive: Callable[..., Any], send: Callable[..., Any]) -> None:
         if scope["type"] == "http":
-            headers_seen.append({k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]})
+            headers_seen.append(Headers(scope=scope))
         await app(scope, receive, send)
 
     return recording
@@ -150,15 +152,45 @@ async def test_a_tool_call_round_trips_over_the_real_transport(context: Context)
 @pytest.mark.asyncio
 async def test_configured_headers_reach_the_server(context: Context) -> None:
     """A bearer-token MCP server is reached this way, so no request may skip them."""
-    headers_seen: list[dict[str, str]] = []
+    headers_seen: list[Headers] = []
 
     async with _live_mcp_server(headers_seen) as url:
         toolkit = MCPToolkit(MCPServerConfig(server_url=url, headers={"X-Tenant": "acme"}, authorization_token="t0ken"))
         await toolkit.schemas(context)
 
     assert headers_seen, "no HTTP request reached the server"
     assert all(h.get("x-tenant") == "acme" for h in headers_seen)
-    assert all(h.get("authorization") == "Bearer t0ken" for h in headers_seen)
+    assert all(h.getlist("authorization") == ["Bearer t0ken"] for h in headers_seen)
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("header_name", ["Authorization", "authorization", "aUtHoRiZaTiOn"])
+@pytest.mark.parametrize("use_variables", [False, True], ids=["static", "variables"])
+async def test_explicit_authorization_header_takes_precedence(
+    context: Context, header_name: str, use_variables: bool
+) -> None:
+    headers = {header_name: "Bearer explicit-token", "X-Tenant": "acme"}
+    headers_seen: list[Headers] = []
+    context.variables.update({"mcp_headers": headers, "mcp_token": "fallback-token"})
+
+    async with _live_mcp_server(headers_seen) as url:
+        toolkit = MCPToolkit(
+            MCPServerConfig(
+                server_url=url,
+                headers=Variable("mcp_headers") if use_variables else headers,
+                authorization_token=Variable("mcp_token") if use_variables else "fallback-token",
+            )
+        )
+        await toolkit.schemas(context)
+        proxy = next(t for t in toolkit.tools if t.name == "echo")
+        result = await proxy(ToolCallEvent(name="echo", arguments='{"message": "hi"}'), context)
+
+    assert isinstance(result, ToolResultEvent)
+    assert result.result.parts == [TextInput(content="echo: hi")]
+    assert headers_seen, "no HTTP request reached the server"
+    assert all(h.getlist("authorization") == ["Bearer explicit-token"] for h in headers_seen)
+    assert all(h.get("x-tenant") == "acme" for h in headers_seen)
+    assert headers == {header_name: "Bearer explicit-token", "X-Tenant": "acme"}
 
 
 @pytest.mark.asyncio
```

**File**: `website/docs/user-guide/tools/mcp_servers.mdx` (modified, +1/-1)
```diff
@@ -306,7 +306,7 @@ That is also why the callbacks your `answering` policy implies are supplied per
 | field | default | what it is for |
 |---|---|---|
 | `server_url` | — | where the server listens, including the MCP endpoint path |
-| `authorization_token` | `None` | bearer token sent on every request |
+| `authorization_token` | `None` | bearer token sent unless `headers` already contains `Authorization` (case-insensitive) |
 | `headers` | `None` | extra HTTP headers |
 | `connection_timeout` | `30.0` | seconds to wait on the server |
 | `proxy` | `None` | HTTP proxy to route through |
```

---

### Incident Patch 10: `d0f031e3` (2026-09-24)
**Commit Message**: fix(context): strip reserved variables on every wire-originated sync (#3286)

`ConversationContext.variables` carries both user data and the framework's
own control-plane state: the `approval_required` allow-always bypass
(`ag:approval_required:always`), the A2A context-id bookkeeping and the
`a2a:tenant` override. Four transports sync that dict with a remote peer,
so a caller able to write a reserved key pre-approves a gated tool and the
human is never asked.

Moves the reserved-prefix filter into `ag2.context` as
`strip_reserved_variables` and applies it on both legs of all four
transports (a2a, a2ui, ag_ui, nlip), rather than leaving each transport to
decide for itself. Inbound merges warn on what they drop; outbound payloads
strip quietly, since the peer has no business reading this side's
control-plane state either.

Reported by @AUTHENSOR in #3255; refs #3256.

Co-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `ag2/a2a/client.py` (modified, +13/-4)
```diff
@@ -28,7 +28,7 @@
 from fast_depends.library.serializer import SerializerProto
 
 from ag2.config.client import LLMClient
-from ag2.context import ConversationContext
+from ag2.context import ConversationContext, strip_reserved_variables
 from ag2.events import (
     BaseEvent,
     Input,
@@ -384,7 +384,7 @@ def _build_outgoing(
                 tool_schemas=function_schemas,
                 task_id=self._task_id,
                 context_id=context_id,
-                context_update=dict(context.variables) or None,
+                context_update=_outgoing_variables(context),
                 extra_extensions=self._extensions,
             )
 
@@ -400,7 +400,7 @@ def _build_outgoing(
             task_id=self._task_id,
             context_id=context_id,
             advertise_extension=bool(function_schemas) or self._task_id is not None,
-            context_update=dict(context.variables) or None,
+            context_update=_outgoing_variables(context),
             extra_parts=extra_parts,
             extra_extensions=self._extensions,
         )
@@ -686,7 +686,7 @@ def _maybe_tenant(self, context: ConversationContext, **kwargs: Any) -> dict[str
     def _merge_context_update(context: ConversationContext, payload: Mapping[str, Any]) -> None:
         if not payload:
             return
-        context.variables.update(payload)
+        context.variables.update(strip_reserved_variables(payload, source="an A2A peer response"))
 
 
 def _ensure_stream_response(event: StreamResponse | Task | Message) -> StreamResponse:
@@ -716,3 +716,12 @@ def _read_extra_parts(context: ConversationContext) -> list[Part]:
     if not raw:
         return []
     return [p for p in raw if isinstance(p, Part)]
+
+
+def _outgoing_variables(context: ConversationContext) -> dict[str, Any] | None:
+    """The variables sync this request carries, or ``None`` when nothing is left to send.
+
+    The peer has no business reading this side's control-plane state — including
+    the context ids, which ride their own protocol field — so reserved keys stay home.
+    """
+    return strip_reserved_variables(context.variables, source="an outgoing A2A request", warn=False) or None
```

**File**: `ag2/a2a/executor.py` (modified, +9/-5)
```diff
@@ -14,7 +14,7 @@
 from a2a.types import Part, Task, TaskState, TaskStatus
 
 from ag2.agent import Agent
-from ag2.context import ConversationContext
+from ag2.context import ConversationContext, strip_reserved_variables
 from ag2.events import (
     BaseEvent,
     ClientToolCallEvent,
@@ -290,11 +290,12 @@ def _build_final_message(
         final_text: str,
         final_variables: dict[str, Any],
     ) -> "Any | None":
-        if not final_text and not final_variables:
+        outgoing = strip_reserved_variables(final_variables, source="an outgoing A2A response", warn=False)
+        if not final_text and not outgoing:
             return None
         metadata: dict[str, Any] | None = None
-        if final_variables:
-            metadata = {CONTEXT_UPDATE_METADATA_KEY: final_variables}
+        if outgoing:
+            metadata = {CONTEXT_UPDATE_METADATA_KEY: outgoing}
         parts = [Part(text=final_text)] if final_text else []
         return updater.new_agent_message(parts=parts, metadata=metadata)
 
@@ -335,7 +336,10 @@ async def _dispatch_to_agent(
             raise RuntimeError("Agent.config is not set; cannot serve via A2A")
         client = agent.config.create()
 
-        merged_variables = {**dict(agent._agent_variables), **incoming_variables}
+        merged_variables = {
+            **dict(agent._agent_variables),
+            **strip_reserved_variables(incoming_variables, source="an inbound A2A request"),
+        }
         ctx = ConversationContext(
             stream,
             prompt=[*agent._system_prompt, *extra_prompt],
```

**File**: `ag2/a2ui/a2a/executor.py` (modified, +5/-4)
```diff
@@ -20,7 +20,7 @@
 from ag2.a2a.extension import CONTEXT_UPDATE_METADATA_KEY
 from ag2.a2a.mappers import ParsedMessage, struct_to_dict, task_state_to_status_update
 from ag2.agent import Agent
-from ag2.context import ConversationContext
+from ag2.context import ConversationContext, strip_reserved_variables
 from ag2.events import BaseEvent, ClientToolCallEvent
 from ag2.stream import MemoryStream
 
@@ -365,12 +365,13 @@ def _build_a2ui_message(
         if a2ui_messages:
             parts.extend(create_a2ui_parts(a2ui_messages))
 
-        if not parts and not final_variables:
+        outgoing = strip_reserved_variables(final_variables, source="an outgoing A2UI response", warn=False)
+        if not parts and not outgoing:
             return None
 
         metadata: dict[str, Any] | None = None
-        if final_variables:
-            metadata = {CONTEXT_UPDATE_METADATA_KEY: final_variables}
+        if outgoing:
+            metadata = {CONTEXT_UPDATE_METADATA_KEY: outgoing}
 
         return updater.new_agent_message(parts=parts, metadata=metadata)
 
```

**File**: `ag2/a2ui/dispatch.py` (modified, +5/-2)
```diff
@@ -13,7 +13,7 @@
 from types import MappingProxyType
 
 from ag2.agent import Agent
-from ag2.context import ConversationContext
+from ag2.context import ConversationContext, strip_reserved_variables
 from ag2.events import BaseEvent, ModelRequest, TextInput, UsageEvent
 from ag2.stream import MemoryStream
 from ag2.usage import collect_usage_events
@@ -145,7 +145,10 @@ async def _collect_a2ui_messages(event: BaseEvent) -> None:
     caps_prompt = runtime.capabilities_prompt(request.client_capabilities)
     extra_prompt = [runtime.system_prompt_section, *([caps_prompt] if caps_prompt else [])]
 
-    merged_variables = {**dict(agent._agent_variables), **request.variables}
+    merged_variables = {
+        **dict(agent._agent_variables),
+        **strip_reserved_variables(request.variables, source="an inbound A2UI request"),
+    }
     ctx = ConversationContext(
         stream,
         prompt=[*agent._system_prompt, *extra_prompt, *request.prompt],
```

**File**: `ag2/a2ui/server_action.py` (modified, +7/-2)
```diff
@@ -28,7 +28,7 @@
 
 from pydantic_core import to_jsonable_python
 
-from ag2.context import ConversationContext
+from ag2.context import ConversationContext, strip_reserved_variables
 from ag2.stream import MemoryStream
 
 from ._types import A2UIVersion, JsonObject, JsonValue, ServerToClientMessage
@@ -95,11 +95,16 @@ def build_server_action_context(
     ``dependency_provider`` (for ``Depends`` resolution and
     ``dependency_provider.override(...)``) — over a throwaway stream, so a
     handler's ``Depends``/``Inject`` parameters resolve exactly like a tool's.
+
+    *variables* come from the clicking client, so reserved keys are dropped.
     """
     return ConversationContext(
         MemoryStream(),
         dependencies=dict(agent._agent_dependencies),
-        variables={**dict(agent._agent_variables), **(variables or {})},
+        variables={
+            **dict(agent._agent_variables),
+            **strip_reserved_variables(variables or {}, source="an inbound A2UI click"),
+        },
         dependency_provider=agent.dependency_provider,
     )
 
```

#### Recent Merged Pull Requests:
- **PR #3319** (2026-09-29): chore(deps): bump pyjwt from 2.13.0 to 2.14.0 (@dependabot[bot])
- **PR #3318** (2026-09-29): chore: bump version to 1.1.1 (@Lancetnik)
- **PR #3312** (2026-09-28): ci: report license/cla on merge-group commits (@Lancetnik)
- **PR #3311** (2026-09-29): fix(mcp): keep a conversation alive while any turn runs on it (@vvlrff)
- **PR #3307** (2026-09-28): chore(deps): bump the uv group across 1 directory with 12 updates (@dependabot[bot])
- **PR #3305** (2026-09-28): fix(network): validate context result counts (@elCaptnCode)
- **PR #3304** (2026-09-28): fix(network): close delegate channel when prompt send fails (@elCaptnCode)
- **PR #3302** (closed): chore(deps): bump the uv group with 13 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
