# Forensic Learning Record (Deep Inspection): langchain-ai/langgraph

> **Canonical Artifact**: `07_PROJECT_LEARNING/langchain-ai-langgraph-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langchain-ai/langgraph](https://github.com/langchain-ai/langgraph))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:13:19.623Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langchain-ai/langgraph`
- **Description**: Build resilient agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 42523 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/chatbot-simulation-evaluation/simulation_utils.py`
```
import functools
from typing import Annotated, Any, Callable, Dict, List, Optional, Union

from langchain_community.adapters.openai import convert_message_to_dict
from langchain_core.messages import AIMessage, AnyMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable, RunnableLambda
from langchain_core.runnables import chain as as_runnable
from langchain_openai import ChatOpenAI
from typing_extensions import TypedDict

from langgraph.graph import END, StateGraph, START


def langchain_to_openai_messages(messages: List[BaseMessage]):
    """
    Convert a list of langchain base messages to a list of openai messages.

    Parameters:
        messages (List[BaseMessage]): A list of langchain base messages.

    Returns:
        List[dict]: A list of openai messages.
    """

    return [
        convert_message_to_dict(m) if isinstance(m, BaseMessage) else m
        for m in messages
    ]


def create_simulated_user(
    system_prompt: str, llm: Runnable | None = None
) -> Runnable[Dict, AIMessage]:
    """
    Creates a simulated user for chatbot simulation.

    Args:
        system_prompt (str): The system prompt to be used by the simulated user.
        llm (Runnable | None, optional): The language model to be used for the simulation.
            Defaults to gpt-3.5-turbo.

    Returns:
        Runnable[Dict, AIMessage]: The simulated user for chatbot simulation.
    """
    return ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="messages"),
        ]
    ) | (llm or ChatOpenAI(model="gpt-3.5-turbo")).with_config(
        run_name="simulated_user"
    )


Messages = Union[list[AnyMessage], AnyMessage]


def add_messages(left: Messages, right: Messages) -> Messages:
    if not isinstance(left, list):
        left = [left]
    if not isinstance(right, list):
        right = [right]
    return left + right


class SimulationState(TypedDict):
    """
    Represents the state of a simulation.

    Attributes:
        messages (List[AnyMessage]): A list of messages in the simulation.
        inputs (Optional[dict[str, Any]]): Optional inputs for the simulation.
    """

    messages: Annotated[List[AnyMessage], add_messages]
    inputs: Optional[dict[str, Any]]


def create_chat_simulator(
    assistant: (
        Callable[[List[AnyMessage]], str | AIMessage]
        | Runnable[List[AnyMessage], str | AIMessage]
    ),
    simulated_user: Runnable[Dict, AIMessage],
    *,
    input_key: str,
    max_turns: int = 6,
    should_continue: Optional[Callable[[SimulationState], str]] = None,
):
    """Creates a chat simulator for evaluating a chatbot.

    Args:
        assistant: The chatbot assistant function or runnable object.
        simulated_user: The simulated user object.
        input_key: The key for the input to the chat simulation.
        max_turns: The maximum number of turns in the chat simulation. Default is 6.
        should_continue: Optional function to determine if the simulation should continue.
            If not provided, a default function will be used.

    Returns:
        The compiled chat simulation graph.

    """
    graph_builder = StateGraph(SimulationState)
    graph_builder.add_node(
        "user",
        _create_simulated_user_node(simulated_user),
    )
    graph_builder.add_node(
        "assistant", _fetch_messages | assistant | _coerce_to_message
    )
    graph_builder.add_edge("assistant", "user")
    graph_builder.add_conditional_edges(
        "user",
        should_continue or functools.partial(_should_continue, max_turns=max_turns),
    )
    # If your dataset has a 'leading question/input', then we route first to the assistant, otherwise, we let the user take the lead.
    graph_builder.add_edge(START, "assistant" if input_key is not None else "user")

    return (
        RunnableLambda(_prepare_example).bind(input_key=input_key)
        | graph_builder.compile()
    )


## Private methods


def _prepare_example(inputs: dict[str, Any], input_key: Optional[str] = None):
    if input_key is not None:
        if input_key not in inputs:
            raise ValueError(
                f"Dataset's example input must contain the provided input key: '{input_key}'.\nFound: {list(inputs.keys())}"
            )
        messages = [HumanMessage(content=inputs[input_key])]
        return {
            "inputs": {k: v for k, v in inputs.items() if k != input_key},
            "messages": messages,
        }
    return {"inputs": inputs, "messages": []}


def _invoke_simulated_user(state: SimulationState, simulated_user: Runnable):
    """Invoke the simulated user node."""
    runnable = (
        simulated_user
        if isinstance(simulated_user, Runnable)
        else RunnableLambda(simulated_user)
    )
    inputs = state.get("inputs", {})
    inputs["messages"] = state["messages"]
    return runnable.invoke(inputs)


def _swap_roles(state: SimulationState):
    new_messages = []
    for m in state["messages"]:
        if isinstance(m, AIMessage):
            new_messages.append(HumanMessage(content=m.content))
        else:
            new_messages.append(AIMessage(content=m.content))
    return {
        "inputs": state.get("inputs", {}),
        "messages": new_messages,
    }


@as_runnable
def _fetch_messages(state: SimulationState):
    """Invoke the simulated user node."""
    return state["messages"]


def _convert_to_human_message(message: BaseMessage):
    return {"messages": [HumanMessage(content=message.content)]}


def _create_simulated_user_node(simulated_user: Runnable):
    """Simulated user accepts a {"messages": [...]} argument and returns a single message."""
    return (
        _swap_roles
        | RunnableLambda(_invoke_simulated_user).bind(simulated_user=simulated_user)
        | _convert_to_human_message
    )


def _coerce_to_message(assistant_output: str | BaseMessage):
    if isinstance(assistant_output, str):
        return {"messages": [AIMessage(content=assistant_output)]}
    else:
        return {"messages": [assistant_output]}


def _should_continue(state: SimulationState, max_turns: int = 6):
    messages = state["messages"]
    # TODO support other stop criteria
    if len(messages) > max_turns:
        return END
    elif messages[-1].content.strip() == "FINISHED":
        return END
    else:
        return "assistant"

```

### Core Architecture Module: `examples/delta-channel-dump/dump.py`
```
#!/usr/bin/env python3
"""Recover delta-channel state from a Postgres-backed LangGraph thread.

Works with OSS ``PostgresSaver`` and LangGraph Server / langgraph-api on the
Postgres runtime (same checkpoint schema). Use after rolling back from
langgraph >= 1.2 / deepagents 0.6.x to an older runtime that does not
understand ``EXT_DELTA_SNAPSHOT`` msgpack blobs. The script walks the checkpoint
parent chain, decodes msgpack blobs, and emits a JSON dump of per-channel
``seed`` plus oldest-to-newest ``writes``. Apply the recovered values manually
via ``client.threads.update_state(...)`` (Server) or ``graph.update_state``
(OSS).

Install::

    pip install "psycopg[binary]" ormsgpack

Run::

    export DATABASE_URI=postgres://...
    python3 dump.py --thread-id <uuid> --channel messages --output recovery.json

Scope (v1): Postgres only; no AES/custom encryption; no reducer application.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import uuid
from typing import Any

import ormsgpack
import psycopg

# LangGraph msgpack EXT type codes (langgraph/checkpoint/serde/jsonplus.py).
EXT_CONSTRUCTOR_SINGLE_ARG = 0
EXT_CONSTRUCTOR_POS_ARGS = 1
EXT_CONSTRUCTOR_KW_ARGS = 2
EXT_METHOD_SINGLE_ARG = 3
EXT_PYDANTIC_V1 = 4
EXT_PYDANTIC_V2 = 5
EXT_NUMPY_ARRAY = 6
EXT_DELTA_SNAPSHOT = 7

_MSGPACK_OPTION = ormsgpack.OPT_NON_STR_KEYS


def ext_hook(code: int, data: bytes) -> Any:
    """Decode LangGraph msgpack EXT payloads to JSON-friendly Python values."""
    if code == EXT_DELTA_SNAPSHOT:
        inner = ormsgpack.unpackb(data, ext_hook=ext_hook, option=_MSGPACK_OPTION)
        return {"__delta_snapshot__": inner}
    if code == EXT_CONSTRUCTOR_SINGLE_ARG:
        try:
            tup = ormsgpack.unpackb(data, ext_hook=ext_hook, option=_MSGPACK_OPTION)
            if tup[0] == "uuid" and tup[1] == "UUID":
                hex_ = tup[2]
                return (
                    f"{hex_[:8]}-{hex_[8:12]}-{hex_[12:16]}-"
                    f"{hex_[16:20]}-{hex_[20:]}"
                )
            return tup[2]
        except Exception:
            return None
    if code == EXT_CONSTRUCTOR_POS_ARGS:
        try:
            tup = ormsgpack.unpackb(data, ext_hook=ext_hook, option=_MSGPACK_OPTION)
            if tup[0] == "langgraph.types" and tup[1] == "Send":
                args = tup[2]
                if len(args) == 2:
                    return {"__send__": {"node": args[0], "arg": args[1]}}
                return {
                    "__send__": {
                        "node": args[0],
                        "arg": args[1],
                        "timeout": args[2],
                    }
                }
            return tup[2]
        except Exception:
            return None
    if code in (EXT_CONSTRUCTOR_KW_ARGS, EXT_METHOD_SINGLE_ARG):
        try:
            tup = ormsgpack.unpackb(data, ext_hook=ext_hook, option=_MSGPACK_OPTION)
            return tup[2]
        except Exception:
            return None
    if code in (EXT_PYDANTIC_V1, EXT_PYDANTIC_V2):
        try:
            tup = ormsgpack.unpackb(data, ext_hook=ext_hook, option=_MSGPACK_OPTION)
            return tup[2]
        except Exception:
            return None
    if code == EXT_NUMPY_ARRAY:
        try:
            dtype_str, shape, order, buf = ormsgpack.unpackb(
                data, ext_hook=ext_hook, option=_MSGPACK_OPTION
            )
            return {
                "__numpy_array__": {
                    "dtype": dtype_str,
                    "shape": shape,
                    "order": order,
                    "data_b64": base64.b64encode(buf).decode("ascii"),
                }
            }
        except Exception:
            return None
    return None


def decode_blob(blob_type: str, blob_bytes: bytes | None) -> Any:
    if blob_type in ("empty", "null") or blob_bytes is None:
        return None
    if blob_type == "msgpack":
        return ormsgpack.unpackb(
            blob_bytes, ext_hook=ext_hook, option=_MSGPACK_OPTION
        )
    if blob_type in ("bytes", "bytearray"):
        return base64.b64encode(blob_bytes).decode("ascii")
    raise RuntimeError(
        f"Unknown blob type {blob_type!r}. "
        "AES/custom-encrypted deployments are out of scope for v1."
    )


def delta_unwrap(value: Any) -> Any:
    if isinstance(value, dict) and "__delta_snapshot__" in value:
        return value["__delta_snapshot__"]
    return value


def json_default(obj: Any) -> Any:
    if isinstance(obj, (bytes, bytearray)):
        return base64.b64encode(bytes(obj)).decode("ascii")
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def resolve_target_checkpoint_id(
    conn: psycopg.Connection[Any],
    thread_id: str,
    checkpoint_ns: str,
    checkpoint_id: str | None,
) -> str:
    if checkpoint_id is not None:
        return checkpoint_id
    row = conn.execute(
        """
        SELECT checkpoint_id::text
        FROM checkpoints
        WHERE thread_id = %s AND checkpoint_ns = %s
        ORDER BY checkpoint_id DESC
        LIMIT 1
        """,
        (thread_id, checkpoint_ns),
    ).fetchone()
    if row is None:
        raise SystemExit(
            f"No checkpoints found for thread_id={thread_id!r} "
            f"checkpoint_ns={checkpoint_ns!r}"
        )
    return row[0]


def _load_checkpoint(
    conn: psycopg.Connection[Any],
    thread_id: str,
    checkpoint_ns: str,
    checkpoint_id: str,
) -> tuple[dict[str, Any], str | None] | None:
    row = conn.execute(
        """
        SELECT checkpoint, parent_checkpoint_id::text
        FROM checkpoints
        WHERE thread_id = %s AND checkpoint_ns = %s AND checkpoint_id = %s
        """,
        (thread_id, checkpoint_ns, checkpoint_id),
    ).fetchone()
    if row is None:
        return None
    return row[0], row[1]


def _load_seed(
    conn: psycopg.Connection[Any],
    *,
    thread_id: str,
    checkpoint_ns: str,
    channel: str,
    checkpoint_id: str,
    channel_values: dict[str, Any],
    channel_versions: dict[str, str],
) -> dict[str, Any]:
    cv = channel_values[channel]
    version = channel_versions.get(channel)
    if cv is True:
        blob_row = conn.execute(
            """
            SELECT type, blob
            FROM checkpoint_blobs
            WHERE thread_id = %s AND checkpoint_ns = %s
              AND channel = %s AND version = %s
            """,
            (thread_id, checkpoint_ns, channel, version),
        ).fetchone()
        seed_value = None
        if blob_row is not None and blob_row[0] != "empty":
            seed_value = delta_unwrap(decode_blob(blob_row[0], blob_row[1]))
        return {
            "delta_kind": "snapshot",
            "seed_checkpoint_id": checkpoint_id,
            "seed_version": version,
            "seed": seed_value,
        }
    if isinstance(cv, (int, float, str, bool)) or cv is None:
        return {
            "delta_kind": "legacy_plain",
            "seed_checkpoint_id": checkpoint_id,
            "seed_version": version,
            "seed": cv,
        }
    blob_row = conn.execute(
        """
        SELECT type, blob
        FROM checkpoint_blobs
        WHERE thread_id = %s AND checkpoint_ns = %s
          AND channel = %s AND version = %s
        """,
        (thread_id, checkpoint_ns, channel, version),
    ).fetchone()
    seed_value = cv if blob_row is None else decode_blob(blob_row[0], blob_row[1])
    return {
        "delta_kind": "legacy_plain",
        "seed_checkpoint_id": checkpoint_id,
        "seed_version": version,
        "seed": seed_value,
    }


def _load_writes_for_checkpoint(
    conn: psycopg.Connection[Any],
    *,
    thread_id: str,
    checkpoint_ns: str,
    checkpoint_id: str,
    channel: str,
) -> list[dict[str, Any]]:
    """Load writes for one checkpoint, newest-first by ``(task_id, idx)``.

    ``walk_channel`` reverses the accumula
```

### Core Architecture Module: `libs/checkpoint-conformance/langgraph/checkpoint/conformance/__init__.py`
```
"""langgraph-checkpoint-conformance: conformance test suite for checkpointer implementations."""

from langgraph.checkpoint.conformance.initializer import checkpointer_test
from langgraph.checkpoint.conformance.validate import validate

__all__ = [
    "checkpointer_test",
    "validate",
]

```

### Core Architecture Module: `libs/checkpoint-conformance/langgraph/checkpoint/conformance/capabilities.py`
```
"""Capability detection for checkpointer implementations."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

from langgraph.checkpoint.base import BaseCheckpointSaver

if TYPE_CHECKING:
    pass


class Capability(str, Enum):
    """Capabilities that a checkpointer may support."""

    PUT = "put"
    PUT_WRITES = "put_writes"
    GET_TUPLE = "get_tuple"
    LIST = "list"
    DELETE_THREAD = "delete_thread"
    DELETE_FOR_RUNS = "delete_for_runs"
    COPY_THREAD = "copy_thread"
    PRUNE = "prune"
    DELTA_CHANNEL_HISTORY = "delta_channel_history"


# Capabilities that every checkpointer must support.
BASE_CAPABILITIES = frozenset(
    {
        Capability.PUT,
        Capability.PUT_WRITES,
        Capability.GET_TUPLE,
        Capability.LIST,
        Capability.DELETE_THREAD,
    }
)

# Capabilities that are optional extensions.
EXTENDED_CAPABILITIES = frozenset(
    {
        Capability.DELETE_FOR_RUNS,
        Capability.COPY_THREAD,
        Capability.PRUNE,
        Capability.DELTA_CHANNEL_HISTORY,
    }
)

ALL_CAPABILITIES = BASE_CAPABILITIES | EXTENDED_CAPABILITIES

# Maps capability to the async method name on BaseCheckpointSaver (or subclass).
_CAPABILITY_METHOD_MAP: dict[Capability, str] = {
    Capability.PUT: "aput",
    Capability.PUT_WRITES: "aput_writes",
    Capability.GET_TUPLE: "aget_tuple",
    Capability.LIST: "alist",
    Capability.DELETE_THREAD: "adelete_thread",
    Capability.DELETE_FOR_RUNS: "adelete_for_runs",
    Capability.COPY_THREAD: "acopy_thread",
    Capability.PRUNE: "aprune",
    Capability.DELTA_CHANNEL_HISTORY: "aget_delta_channel_history",
}


@dataclass(frozen=True)
class DetectedCapabilities:
    """Result of capability detection for a checkpointer type."""

    detected: frozenset[Capability]
    missing: frozenset[Capability]

    @classmethod
    def from_instance(cls, saver: BaseCheckpointSaver) -> DetectedCapabilities:
        """Detect capabilities from a checkpointer instance."""
        inner_type = type(saver)
        detected: set[Capability] = set()

        for cap, method_name in _CAPABILITY_METHOD_MAP.items():
            if _is_overridden(inner_type, method_name):
                detected.add(cap)

        detected_fs = frozenset(detected)
        return cls(
            detected=detected_fs,
            missing=ALL_CAPABILITIES - detected_fs,
        )


def _is_overridden(inner_type: type, method: str) -> bool:
    """Check if *method* on *inner_type* differs from the base class default."""
    base = getattr(BaseCheckpointSaver, method, None)
    impl = getattr(inner_type, method, None)
    if base is None or impl is None:
        return impl is not None
    return impl is not base

```

### Core Architecture Module: `libs/checkpoint-conformance/langgraph/checkpoint/conformance/initializer.py`
```
"""Checkpointer test registration and factory management."""

from __future__ import annotations

from collections.abc import AsyncGenerator, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver

# Type for the lifespan async context manager factory.
LifespanFactory = Callable[[], AsyncGenerator[None, None]]

# Module-level registry of decorated checkpointer factories.
_REGISTRY: dict[str, RegisteredCheckpointer] = {}


async def _noop_lifespan() -> AsyncGenerator[None, None]:
    yield


@dataclass
class RegisteredCheckpointer:
    """A registered checkpointer test factory."""

    name: str
    factory: Callable[[], AsyncGenerator[BaseCheckpointSaver, None]]
    skip_capabilities: set[str] = field(default_factory=set)
    lifespan: LifespanFactory = _noop_lifespan

    @asynccontextmanager
    async def create(self) -> AsyncGenerator[BaseCheckpointSaver, None]:
        """Create a fresh checkpointer instance via the async generator."""
        gen = self.factory()
        try:
            saver = await gen.__anext__()
            yield saver
        finally:
            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass

    @asynccontextmanager
    async def enter_lifespan(self) -> AsyncGenerator[None, None]:
        """Enter the lifespan context (once per validation run)."""
        gen = self.lifespan()
        try:
            await gen.__anext__()
            yield
        finally:
            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass


def checkpointer_test(
    name: str,
    *,
    skip_capabilities: set[str] | None = None,
    lifespan: LifespanFactory | None = None,
) -> Callable[[Any], RegisteredCheckpointer]:
    """Register an async generator as a checkpointer test factory.

    The factory is called once per capability suite to create a fresh
    checkpointer.  The optional `lifespan` is an async generator that
    runs once for the entire validation run (e.g. to create/destroy a
    database).

    Example::

        @checkpointer_test(name="InMemorySaver")
        async def memory_checkpointer():
            yield InMemorySaver()

    With lifespan::

        async def pg_lifespan():
            await create_database()
            yield
            await drop_database()

        @checkpointer_test(name="PostgresSaver", lifespan=pg_lifespan)
        async def pg_checkpointer():
            yield PostgresSaver(conn_string="...")
    """

    def decorator(fn: Any) -> RegisteredCheckpointer:
        registered = RegisteredCheckpointer(
            name=name,
            factory=fn,
            skip_capabilities=skip_capabilities or set(),
            lifespan=lifespan or _noop_lifespan,
        )
        _REGISTRY[name] = registered
        return registered

    return decorator

```

### Core Architecture Module: `libs/checkpoint-conformance/langgraph/checkpoint/conformance/report.py`
```
"""Capability report: results, progress callbacks, and pretty-printing."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from langgraph.checkpoint.conformance.capabilities import (
    BASE_CAPABILITIES,
    EXTENDED_CAPABILITIES,
    Capability,
)

# Callback type for per-test progress reporting.
# (capability_name, test_name, passed, error_msg_or_None) -> None
OnTestResult = Callable[[str, str, bool, str | None], None]

# Callback type for capability-level events.
# (capability_name, detected) -> None
OnCapabilityStart = Callable[[str, bool], None]


class ProgressCallbacks:
    """Grouped callbacks for progress reporting during validation."""

    def __init__(
        self,
        *,
        on_capability_start: Callable[[str, bool], None] | None = None,
        on_test_result: OnTestResult | None = None,
        on_capability_end: Callable[[str], None] | None = None,
    ) -> None:
        self.on_capability_start = on_capability_start
        self.on_test_result = on_test_result
        self.on_capability_end = on_capability_end

    @classmethod
    def default(cls) -> ProgressCallbacks:
        """Dot-style progress: ``.`` per pass, ``F`` per fail."""

        def _cap_start(capability: str, detected: bool) -> None:
            if detected:
                print(f"  {capability}: ", end="", flush=True)
            else:
                print(f"  ⊘ {capability} (not implemented)")

        def _test_result(
            capability: str, test_name: str, passed: bool, error: str | None
        ) -> None:
            print("." if passed else "F", end="", flush=True)

        def _cap_end(capability: str) -> None:
            print()  # newline after dots

        return cls(
            on_capability_start=_cap_start,
            on_test_result=_test_result,
            on_capability_end=_cap_end,
        )

    @classmethod
    def verbose(cls) -> ProgressCallbacks:
        """Per-test output with names and errors."""

        def _cap_start(capability: str, detected: bool) -> None:
            if detected:
                print(f"  {capability}:")
            else:
                print(f"  ⊘ {capability} (not implemented)")

        def _test_result(
            capability: str, test_name: str, passed: bool, error: str | None
        ) -> None:
            icon = "✓" if passed else "✗"
            print(f"    {icon} {test_name}")
            if error:
                for line in error.rstrip().splitlines():
                    print(f"      {line}")

        return cls(
            on_capability_start=_cap_start,
            on_test_result=_test_result,
        )

    @classmethod
    def quiet(cls) -> ProgressCallbacks:
        """No progress output."""
        return cls()


@dataclass
class CapabilityResult:
    """Result of running a single capability's test suite."""

    detected: bool = False
    passed: bool | None = None  # None = skipped
    tests_passed: int = 0
    tests_failed: int = 0
    tests_skipped: int = 0
    failures: list[str] = field(default_factory=list)


@dataclass
class CapabilityReport:
    """Aggregate report across all capabilities."""

    checkpointer_name: str
    results: dict[str, CapabilityResult] = field(default_factory=dict)

    def passed_all_base(self) -> bool:
        """Whether all base capability tests passed."""
        for cap in BASE_CAPABILITIES:
            result = self.results.get(cap.value)
            if result is None or result.passed is not True:
                return False
        return True

    def passed_all(self) -> bool:
        """Whether every detected capability's tests passed."""
        for result in self.results.values():
            if result.detected and result.passed is not True:
                return False
        return True

    def conformance_level(self) -> str:
        """Return a human-readable conformance level string."""
        if self.passed_all():
            return "FULL"
        if self.passed_all_base():
            return "BASE+PARTIAL"
        return "BASE" if self._any_base_passed() else "NONE"

    def _any_base_passed(self) -> bool:
        for cap in BASE_CAPABILITIES:
            result = self.results.get(cap.value)
            if result and result.passed is True:
                return True
        return False

    def print_report(self) -> None:
        """Pretty-print the report to stdout."""
        width = 52
        border = "=" * width
        print(f"\n{'':>2}{border}")
        print(f"{'':>2}  Checkpointer Validation: {self.checkpointer_name}")
        print(f"{'':>2}{border}")

        def _section(title: str, caps: frozenset[Capability]) -> None:
            print(f"{'':>2}  {title}")
            for cap in sorted(caps, key=lambda c: c.value):
                result = self.results.get(cap.value)
                if result is None:
                    icon = "  "
                    suffix = "(no tests)"
                elif not result.detected:
                    icon = "⊘ "
                    suffix = "(not implemented)"
                elif result.passed is True:
                    icon = "✅"
                    suffix = ""
                elif result.passed is False:
                    icon = "❌"
                    suffix = f"({result.tests_failed} failed)"
                else:
                    icon = "⏭ "
                    suffix = "(skipped)"
                print(f"{'':>2}    {icon} {cap.value:20s} {suffix}")
            print()

        _section("BASE CAPABILITIES", BASE_CAPABILITIES)
        _section("EXTENDED CAPABILITIES", EXTENDED_CAPABILITIES)

        total = sum(1 for r in self.results.values() if r.detected)
        passed = sum(
            1 for r in self.results.values() if r.detected and r.passed is True
        )
        level = self.conformance_level()
        print(f"{'':>2}  Result: {level} ({passed}/{total})")
        print(f"{'':>2}{border}\n")

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict."""
        return {
            "checkpointer_name": self.checkpointer_name,
            "conformance_level": self.conformance_level(),
            "results": {
                name: {
                    "detected": r.detected,
                    "passed": r.passed,
                    "tests_passed": r.tests_passed,
                    "tests_failed": r.tests_failed,
                    "tests_skipped": r.tests_skipped,
                    "failures": r.failures,
                }
                for name, r in self.results.items()
            },
        }

```

### Core Architecture Module: `libs/checkpoint-conformance/langgraph/checkpoint/conformance/validate.py`
```
"""Core conformance runner — detects capabilities, runs test suites, builds report."""

from __future__ import annotations

from langgraph.checkpoint.conformance.capabilities import (
    Capability,
    DetectedCapabilities,
)
from langgraph.checkpoint.conformance.initializer import RegisteredCheckpointer
from langgraph.checkpoint.conformance.report import (
    CapabilityReport,
    CapabilityResult,
    ProgressCallbacks,
)
from langgraph.checkpoint.conformance.spec.test_copy_thread import run_copy_thread_tests
from langgraph.checkpoint.conformance.spec.test_delete_for_runs import (
    run_delete_for_runs_tests,
)
from langgraph.checkpoint.conformance.spec.test_delete_thread import (
    run_delete_thread_tests,
)
from langgraph.checkpoint.conformance.spec.test_delta_channel_history import (
    run_delta_channel_history_tests,
)
from langgraph.checkpoint.conformance.spec.test_get_tuple import run_get_tuple_tests
from langgraph.checkpoint.conformance.spec.test_list import run_list_tests
from langgraph.checkpoint.conformance.spec.test_prune import run_prune_tests
from langgraph.checkpoint.conformance.spec.test_put import run_put_tests
from langgraph.checkpoint.conformance.spec.test_put_writes import run_put_writes_tests

# Maps capability to its runner function.
_RUNNERS = {
    Capability.PUT: run_put_tests,
    Capability.PUT_WRITES: run_put_writes_tests,
    Capability.GET_TUPLE: run_get_tuple_tests,
    Capability.LIST: run_list_tests,
    Capability.DELETE_THREAD: run_delete_thread_tests,
    Capability.DELETE_FOR_RUNS: run_delete_for_runs_tests,
    Capability.COPY_THREAD: run_copy_thread_tests,
    Capability.PRUNE: run_prune_tests,
    Capability.DELTA_CHANNEL_HISTORY: run_delta_channel_history_tests,
}


async def validate(
    registered: RegisteredCheckpointer,
    *,
    capabilities: set[str] | None = None,
    progress: ProgressCallbacks | None = None,
) -> CapabilityReport:
    """Run the validation suite against a registered checkpointer.

    Args:
        registered: A RegisteredCheckpointer (from @checkpointer_test decorator).
        capabilities: If given, only run tests for these capability names.
            Otherwise, auto-detect and run all applicable tests.
        progress: Optional progress callbacks for incremental output.
            Use ``ProgressCallbacks.default()`` for dot-style,
            ``ProgressCallbacks.verbose()`` for per-test output, or
            ``None`` / ``ProgressCallbacks.quiet()`` for silent mode.

    Returns:
        A CapabilityReport with per-capability results.
    """
    report = CapabilityReport(checkpointer_name=registered.name)

    # Determine which capabilities to test.
    caps_to_test: set[Capability]
    if capabilities is not None:
        caps_to_test = {Capability(c) for c in capabilities}
    else:
        caps_to_test = set(Capability)

    async with registered.enter_lifespan():
        for cap in Capability:
            if cap in caps_to_test and cap.value not in registered.skip_capabilities:
                # Create a fresh checkpointer for each capability suite.
                async with registered.create() as saver:
                    detected = DetectedCapabilities.from_instance(saver)
                    is_detected = cap in detected.detected

                    if not is_detected:
                        if progress and progress.on_capability_start:
                            progress.on_capability_start(cap.value, False)
                        report.results[cap.value] = CapabilityResult(
                            detected=False,
                            passed=None,
                            tests_skipped=1,
                        )
                        continue

                    runner = _RUNNERS.get(cap)
                    if runner is None:
                        report.results[cap.value] = CapabilityResult(
                            detected=True,
                            passed=None,
                            tests_skipped=1,
                        )
                        continue

                    if progress and progress.on_capability_start:
                        progress.on_capability_start(cap.value, True)

                    passed, failed, failures = await runner(
                        saver,
                        on_test_result=progress.on_test_result if progress else None,
                    )

                    if progress and progress.on_capability_end:
                        progress.on_capability_end(cap.value)

                    report.results[cap.value] = CapabilityResult(
                        detected=True,
                        passed=failed == 0,
                        tests_passed=passed,
                        tests_failed=failed,
                        failures=failures,
                    )
            else:
                if progress and progress.on_capability_start:
                    progress.on_capability_start(cap.value, False)
                report.results[cap.value] = CapabilityResult(
                    detected=False,
                    passed=None,
                    tests_skipped=1,
                )

    return report

```

### Core Architecture Module: `libs/checkpoint-postgres/langgraph/checkpoint/postgres/__init__.py`
```
from __future__ import annotations

import threading
from collections import defaultdict
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from typing import Any, cast

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    WRITES_IDX_MAP,
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    DeltaChannelHistory,
    get_checkpoint_id,
    get_serializable_checkpoint_metadata,
)
from langgraph.checkpoint.serde.base import SerializerProtocol
from langgraph.checkpoint.serde.types import _DeltaSnapshot
from psycopg import Capabilities, Connection, Cursor, Pipeline
from psycopg.rows import DictRow, dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from langgraph.checkpoint.postgres import _internal
from langgraph.checkpoint.postgres.base import (
    _DELTA_PAGE_SIZE,
    BasePostgresSaver,
    _build_delta_stage1_sql,
    _build_delta_stage2_sql,
    _DeltaStage2Row,
)
from langgraph.checkpoint.postgres.shallow import ShallowPostgresSaver

Conn = _internal.Conn  # For backward compatibility


class PostgresSaver(BasePostgresSaver):
    """Checkpointer that stores checkpoints in a Postgres database."""

    lock: threading.Lock

    def __init__(
        self,
        conn: _internal.Conn,
        pipe: Pipeline | None = None,
        serde: SerializerProtocol | None = None,
    ) -> None:
        super().__init__(serde=serde)
        if isinstance(conn, ConnectionPool) and pipe is not None:
            raise ValueError(
                "Pipeline should be used only with a single Connection, not ConnectionPool."
            )

        self.conn = conn
        self.pipe = pipe
        self.lock = threading.Lock()
        self.supports_pipeline = Capabilities().has_pipeline()

    @classmethod
    @contextmanager
    def from_conn_string(
        cls, conn_string: str, *, pipeline: bool = False
    ) -> Iterator[PostgresSaver]:
        """Create a new PostgresSaver instance from a connection string.

        Args:
            conn_string: The Postgres connection info string.
            pipeline: whether to use Pipeline

        Returns:
            PostgresSaver: A new PostgresSaver instance.
        """
        with Connection.connect(
            conn_string, autocommit=True, prepare_threshold=0, row_factory=dict_row
        ) as conn:
            if pipeline:
                with conn.pipeline() as pipe:
                    yield cls(conn, pipe)
            else:
                yield cls(conn)

    def setup(self) -> None:
        """Set up the checkpoint database asynchronously.

        This method creates the necessary tables in the Postgres database if they don't
        already exist and runs database migrations. It MUST be called directly by the user
        the first time checkpointer is used.
        """
        with self._cursor() as cur:
            cur.execute(self.MIGRATIONS[0])
            results = cur.execute(
                "SELECT v FROM checkpoint_migrations ORDER BY v DESC LIMIT 1"
            )
            row = results.fetchone()
            if row is None:
                version = -1
            else:
                version = row["v"]
            for v, migration in zip(
                range(version + 1, len(self.MIGRATIONS)),
                self.MIGRATIONS[version + 1 :],
                strict=False,
            ):
                cur.execute(migration)
                cur.execute("INSERT INTO checkpoint_migrations (v) VALUES (%s)", (v,))
        if self.pipe:
            self.pipe.sync()

    def list(
        self,
        config: RunnableConfig | None,
        *,
        filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> Iterator[CheckpointTuple]:
        """List checkpoints from the database.

        This method retrieves a list of checkpoint tuples from the Postgres database based
        on the provided config. The checkpoints are ordered by checkpoint ID in descending order (newest first).

        Args:
            config: The config to use for listing the checkpoints.
            filter: Additional filtering criteria for metadata.
            before: If provided, only checkpoints before the specified checkpoint ID are returned.
            limit: The maximum number of checkpoints to return.

        Yields:
            An iterator of checkpoint tuples.

        Examples:
            >>> from langgraph.checkpoint.postgres import PostgresSaver
            >>> DB_URI = "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"
            >>> with PostgresSaver.from_conn_string(DB_URI) as memory:
            ... # Run a graph, then list the checkpoints
            >>>     config = {"configurable": {"thread_id": "1"}}
            >>>     checkpoints = list(memory.list(config, limit=2))
            >>> print(checkpoints)
            [CheckpointTuple(...), CheckpointTuple(...)]

            >>> config = {"configurable": {"thread_id": "1"}}
            >>> before = {"configurable": {"checkpoint_id": "1ef4f797-8335-6428-8001-8a1503f9b875"}}
            >>> with PostgresSaver.from_conn_string(DB_URI) as memory:
            ... # Run a graph, then list the checkpoints
            >>>     checkpoints = list(memory.list(config, before=before))
            >>> print(checkpoints)
            [CheckpointTuple(...), ...]
        """
        where, args = self._search_where(config, filter, before)
        query = self.SELECT_SQL + where + " ORDER BY checkpoint_id DESC"
        params = list(args)
        if limit is not None:
            query += " LIMIT %s"
            params.append(int(limit))
        # if we change this to use .stream() we need to make sure to close the cursor
        with self._cursor() as cur:
            cur.execute(query, params)
            values = cur.fetchall()
            if not values:
                return
            # migrate pending sends if necessary
            if to_migrate := [
                v
                for v in values
                if v["checkpoint"]["v"] < 4 and v["parent_checkpoint_id"]
            ]:
                cur.execute(
                    self.SELECT_PENDING_SENDS_SQL,
                    (
                        values[0]["thread_id"],
                        [v["parent_checkpoint_id"] for v in to_migrate],
                    ),
                )
                grouped_by_parent = defaultdict(list)
                for value in to_migrate:
                    grouped_by_parent[value["parent_checkpoint_id"]].append(value)
                for sends in cur:
                    for value in grouped_by_parent[sends["checkpoint_id"]]:
                        if value["channel_values"] is None:
                            value["channel_values"] = []
                        self._migrate_pending_sends(
                            sends["sends"],
                            value["checkpoint"],
                            value["channel_values"],
                        )
            for value in values:
                yield self._load_checkpoint_tuple(value)

    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        """Get a checkpoint tuple from the database.

        This method retrieves a checkpoint tuple from the Postgres database based on the
        provided config. If the config contains a `checkpoint_id` key, the checkpoint with
        the matching thread ID and timestamp is retrieved. Otherwise, the latest checkpoint
        for the given thread ID is retrieved.

        Args:
            config: The config to use for retrieving the checkpoint.

        Returns:
            The retrieved checkpoint tuple, or None if no matching checkpoint was found.

        Examples:

            Basic:
            >>> config = {"configurable": {"thread_id": "1"}}
            >>> checkpoint_tuple = memory.get_tu
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8616** (2026-08-28): **TypedDict values are rejected by type checkers for Store.put()/aput() despite being valid at runtime**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python from typing import TypedDict from langgraph.store.memory import InMemoryStore  class Prefs(TypedDict):     theme: str  store = InMemoryStore() value: Prefs = {"theme": "dark"} store.put(("users", "123"), "prefs", value) ```  ### Error Message and Stack Trace (if applicable)  ```shell repro.py:9: error: Argument 3 to "put" of "BaseStore" has incompatible type "Prefs"; expected "dict[str, Any]"  [arg-type] Found 1 error in 1 file (checked 1 source file) ```  ### Description  * I'm trying to use the `langgraph` library's `Store.put()`/`aput()` to store a `TypedDict` value (a well-typed, string-keyed mapping matching the store's own requirements). * I expect the call to type-check cleanly with mypy, since a `TypedDict` is exactly the kind of typed, JSON-serializable payload the store expects. * Instead, mypy r
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to work on this one. I've already implemented and verified a fix -- widening `PutOp.value`/`BaseStore.put()`/`aput()` from `dict[str, Any]` to `Mapping[str, Any]`, with a `cast(dict, op.value)` added at the one internal construction site (`InMemoryStore._apply_put_ops`) that needed it to keep type-checking clean. Confirmed against mypy specifically that it reproduces the exact reported error pre-fix and resolves it post-fix, added a regression test, and the full `libs/checkpoint` suite plus `ty`/`ruff`/`codespell` all pass.  PR is up at #8631 but got auto-closed by the missing-issue-link bot since I'm not assigned here. Could a maintainer assign me so it reopens? Thanks!
  > Scratch my request above -- missed that @navarra-lisandro already has #8617 open for this. Withdrew my duplicate PR (#8631). No assignment needed.

- **Issue #8559** (2026-08-18): **Unecessary source parsing for subgraph detection dominates graph build time**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python # see also https://github.com/soarez/langgraph-build-bench  import time  from typing_extensions import TypedDict  import langgraph.pregel._read as _read from langgraph.graph import END, START, StateGraph   class State(TypedDict): n: int   def node(state):  # a plain node: no subgraph anywhere in sight return {"n": state["n"] + 1}   def build(): g = StateGraph(State) for i in range(300):     g.add_node(f"n{i}", node) g.add_edge(START, "n0") for i in range(299):     g.add_edge(f"n{i}", f"n{i + 1}") g.add_edge("n299", END) return g.compile()   def best_of(n=3): build() return min((lambda t=time.perf_counter(): (build(), time.perf_counter() - t)[-1])()            for _ in range(n)) * 1e3   full = best_of() original = _read.find_subgraph_pregel _read.find_subgraph_pregel = lambda bound: None   # skip detection 
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one if it's still open — happy to put up a PR.
  > Is this issue still open? 

- **Issue #8550** (2026-09-30): **SQLite delta history skips parent checkpoints with non-monotonic IDs**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  #6821 covers latest-checkpoint selection in InMemorySaver. #8448 covers a Postgres pagination bug. Neither covers the SQLite delta-history parent walk.  ### Reproduction Steps / Example Code (Python)  ```python import asyncio  from langgraph.checkpoint.base import empty_checkpoint from langgraph.checkpoint.sqlite import SqliteSaver from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver   def checkpoint(checkpoint_id, values):     value = empty_checkpoint()     value["id"] = checkpoint_id     value["channel_values"] = values     return value   def run_sync():     with SqliteSaver.from_conn_string(":memory:") as saver:         config = {"configurable": {"thread_id": "t", "checkpoint_ns": ""}}         root = saver.put(config, checkpoint("z-older", {"ch": "seed"}), {}, {})         saver.put_writes(root, [("ch", "write-root")], "task")         child = saver.put(root, checkpoin
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one if it's still open — happy to put up a PR.
  > This is a beautiful reminder that **checkpoint identity and checkpoint ordering are not the same contract**. A real parent can sort after its child, and an optimized range scan then silently drops the seed/write history.  AgentCI is recruiting lineage/identity breakers like this. A portable fixture could generate non-monotonic checkpoint IDs while preserving an explicit parent chain, then require the hydrated state to follow lineage rather than lexicographic order. If you or an external agent contribute the minimal sync/async corpus, we’ll preserve this issue as provenance and give permanent public credit/backlink in AgentCI’s Breaker/Verifier Hall of Fame + priority conversion help.  AgentCI: https://github.com/jinngimk-lang/agentci · recognition: https://github.com/jinngimk-lang/agentci/blob/main/COMMUNITY.md  Affiliation disclosed; no LangGraph/SQLite certification claim.
  > Hi maintainers, I have prepared a fix for this issue with regression tests. The PR was auto-closed by the need-assignment bot. Could a maintainer please assign me to issue 8550 so the PR can be reopened?  The fix: - DELTA_STAGE1_SQL now uses a recursive CTE to walk parent_checkpoint_id chain - Handles non-monotonic checkpoint IDs (e.g. parent='z-older', child='a-younger') - Covers both sync SqliteSaver and async AsyncSqliteSaver  PR: https://github.com/langchain-ai/langgraph/pull/8683

- **Issue #8408** (2026-09-16): **Studio trace node details fail because incorrect run_id is requested (404)**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  # Bug: Studio trace node details request incorrect run_id (404) with local `langgraph dev`  ## Environment  * OS: Windows 10 * Python:  3.13.2 * langgraph: **1.2.5** * langgraph-api: **0.11.1** * langgraph-runtime-inmem: **0.31.1** * langgraph-sdk: **0.4.2** * langgraph-cli: 0.4.31  Running locally using:  ```bash langgraph dev ```  Studio URL:  ``` https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024 ```  ## Problem  Studio successfully displays the execution trace.  However, clicking any node in the trace never opens the node details panel.  The browser console repeatedly shows:  ```text GET /threads/{thread_id}/runs/{run_id} 404 (Not Found) ```  Example:  ```text GET http://127.0.0.1:2024/threads/019f88bd-945c-72d1-a644-aac481fdb908/runs/019f88bd-98c1-7c01-b94c-8b7a9863b1e5 404 Not Found ```  ## Investigation I also verified the behavior using the Swagger/OpenAP
  **Post-Mortem & Fix Analysis**:
  > Good investigation — the run store and the endpoint are both doing the right thing; what's drifting is the *identifier* Studio resolves the node detail from. Those extra UUIDs aren't a stale cache, they're a different key.  The run record is `…94e5…`, but Studio requests `…98c1…` / `…98d8…`. All of these are UUIDv7 (version nibble `7`), so they're time-ordered — and the requested ones sort *after* the run record (`98xx` > `945c`). That's the signature of a per-node execution id (the span/step id minted as each node runs) being handed to an endpoint that's keyed on the run-level `run_id`. The node's data exists; it's just being looked up under the wrong id, so the store correctly 404s. It's a wrong-key read, not missing data.  What keeps it invisible is that the top-level trace resolves fine via the run record's id, so the breakage only surfaces the moment a human clicks a node. The trace write-path (span ids) and the detail read-path (run `run_id`) have landed on different keys, and th
  > Yes, I can reproduce the same behavior.  The returned run_id works correctly through the API (GET /threads/{thread_id}/runs/{run_id} returns 200), but Studio requests different UUIDs when opening node details. Those IDs appear to be node/span execution IDs rather than the actual run ID, causing the /runs/{id} endpoint to return 404.  This started after upgrading from langgraph-api 0.10.0 to 0.11.1.
  > **Reliability note (architecture only)**  Production agent/workflow failures usually reduce to a **contract** issue before a model/prompt issue:  1. **Success criteria** — durable artifact id (turn/run/session id), not only "green path" 2. **Side-effect before complete** — never blind-retry without an idempotency key on the business object 3. **Timeout must cancel or fence** — a log-only timeout leaves handlers running (double-speak / double-write) 4. **Tool vs path split** — external action can succeed while the agent path still errors (silent-green / false-red)  If you have one failing run + expected vs actual, reply with stack/version and I will send a free root-cause checklist.

- **Issue #8384** (2026-08-07): **InMemorySaver silently and permanently drops the first write after migrating a channel to DeltaChannel**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  None found. I searched open issues for `DeltaChannel`, `BinaryOperatorAggregate`, `snapshot_frequency`, `get_delta_channel_history`, and `migration` and didn't see this reported.  ### Reproduction Steps / Example Code (Python)  ```python from typing import Annotated from typing_extensions import TypedDict  from langgraph.channels.binop import BinaryOperatorAggregate from langgraph.channels.delta import DeltaChannel from langgraph.checkpoint.memory import InMemorySaver from langgraph.graph import END, START, StateGraph   def add(a, b):     return a + b   def noop(_state):     return {}   saver = InMemorySaver() config = {"configurable": {"thread_id": "t1"}}   # 1. Build up state under the "old" channel type (this is what a real #    conversation looks like before opting into DeltaChannel). class OldState(TypedDict):     items: Annotated[list, BinaryOperatorAggregate(list, add)] 
  **Post-Mortem & Fix Analysis**:
  > Hi! I've isolated the root cause and have a fix ready (branch: https://github.com/PiedPiper911/langgraph/tree/fix/inmemory-delta-channel-migration).  **The fix**: Remove the special case in `InMemorySaver.get_delta_channel_history` that skips pending writes when the stored blob is a plain value (not `_DeltaSnapshot`). A plain-value seed does not subsume its own checkpoint's pending writes — skipping them silently loses the first post-migration write.  This matches the reference `BaseCheckpointSaver` and `SqliteSaver` behavior. Verified against the repro in this issue and the existing delta-channel test suite (42 tests pass).  Could a maintainer assign me so I can reopen the PR? Happy to add regression tests as well.
  > Hi! I'd like to work on this issue. I've already prepared a fix (PR #8390 — InMemorySaver get_delta_channel_history fix) and can have it ready for review as soon as I'm assigned. Could a maintainer assign me? Thank you!
  > **Reliability note**  Production automation failures usually reduce to a **contract** issue before a model/prompt issue:  1. **Success criteria** — durable artifact id (message/booking/row), not only node green 2. **Side-effect before complete** — never blind-retry without an idempotency key on the business object 3. **Tool vs path split** — external action can succeed while the node/agent path still errors (silent-green / false-red)  If you have one failing execution + expected vs actual, reply with stack/version and I will send a free root-cause checklist.

- **Issue #8211** (2026-06-30): **with_structured_output is not supported when reasoning effort is used**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python import asyncio import os  from langchain_openai import ChatOpenAI from pydantic import BaseModel, Field   class SomeStructuredResp(BaseModel):     response: str = Field("default reasoning")   temperature = 0.7 open_ai_base_url = os.getenv("OPEN_AI_BASE_URL", "http://localhost:8080/v1") open_ai_reasoning_effort = os.getenv("REASONING_EFFORT", "disabled")  llm = ChatOpenAI(     model="HauhauCS/Gemma4-26B-A4B-QAT-Uncensored-HauhauCS-Balanced-MTP",     temperature=temperature,     base_url=open_ai_base_url,     api_key=os.getenv("OPENAI_API_KEY", "xyz"),     reasoning={"effort": "low"},     extra_body={         "chat_template_kwargs": {             "enable_thinking": open_ai_reasoning_effort != "disabled",         }     }, )  structured_llm = llm.with_structured_output(SomeStructuredResp)   async def main():  
  **Post-Mortem & Fix Analysis**:
  > Hi, I looked into this. The error occurs because with_structured_output uses tool calling / JSON mode under the hood, but when reasoning={"effort": "low"} is passed, the local inference server ignores the structured output instruction and returns plain conversational text instead. A potential workaround while a proper fix is investigated: use method="json_mode" explicitly when calling with_structured_output:  structured_llm = llm.with_structured_output(SomeStructuredResp, method="json_mode")  This may help depending on your local server's JSON mode support. I'd also note this seems to be a langchain-openai issue rather than LangGraph , the error trace points to langchain_openai/chat_models/base.py. Would it help to file this upstream at langchain-ai/langchain?
  > Thanks, I tried json_mode and it gives output parsing failure so not much progress. I've opened this issue in langchain for anyone with same issue https://github.com/langchain-ai/langchain/issues/38561. Closing this.

- **Issue #8089** (2026-06-17): **Langgraph dev fails with AttributeError**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python Invesitgated due to student query of why langgraph dev was failing.  Reproduced in my workspace.  Clone langgraph-academy repo and follow proper steps to prepare environment as per the README.md file.  Supplied a .env file with keys as instructed.  Cd to module-1/studio and copy the .env here as well. When running langgraph dev the error is produced. ```  ### Error Message and Stack Trace (if applicable)  ```shell AttributeError: module 'langgraph_api.config' has no attribute 'LSD_PROM_METRICS_ENABLED' ```  ### Description  List of installed langchain packages: pip list | grep lang langchain                                1.3.9 langchain-classic                        1.0.8 langchain-community                      0.4.2 langchain-core                           1.4.7 langchain-openai                        
  **Post-Mortem & Fix Analysis**:
  > What I ran verbatim:  git clone https://github.com/langchain-ai/langchain-academy.git cd langchain-academy python3 -m venv lc-academy-env source lc-academy-env/bin/activate pip install -r requirements.txt pip list | grep lang langchain                                1.3.9 langchain-classic                        1.0.8 langchain-community                      0.4.2 langchain-core                           1.4.7 langchain-openai                         1.3.2 langchain-protocol                       0.0.17 langchain-tavily                         0.2.18 langchain-text-splitters                 1.1.2 langgraph                                1.2.5 langgraph-api                            0.12.0.dev3 langgraph-checkpoint                     4.1.1 langgraph-checkpoint-sqlite              3.1.0 langgraph-cli                            0.4.29 langgraph-prebuilt                       1.1.0 langgraph-runtime-inmem                  0.31.0.dev9 langgraph-sdk                            0.4.2 langsmi
  > release(cli): 0.4.30 #8101 Has solved this problem - verified with langchain-academy course repo

- **Issue #8083** (2026-06-18): **Lang Graph did not save all data to the checkpoint**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python new StateGraph(new StateSchema({   messages: new ReducedValue(z.custom().default(() => []), { reducer: messagesStateReducer }),   stepCount: new ReducedValue(z.number().default(0), { reducer: (a,b) => a+b }), }))   .addNode('a', (s) => ({ messages: [new HumanMessage('hi')], stepCount: 1 }))   .addNode('b', (s) => ({ stepCount: 2 }))  // ← doesn't touch messages   .addEdge(START, 'a')   .addEdge('a', 'b')   .addEdge('b', END)   .compile({ checkpointer })  // After invoke, getState returns messages: [] when it should be [HumanMessage('hi')] ```  ### Error Message and Stack Trace (if applicable)  ```shell  ```  ### Description  - I use graph with custom Redis (fallback to Postgres) as checkpoint. The implement is good with many unit tests. - I update part of state in different node. - After call `invoke`, I c
  **Post-Mortem & Fix Analysis**:
  > @KafkaUnderCurrent This python project   javascript is https://github.com/langchain-ai/langgraphjs
  > Hi,  I've investigated this issue and spent some time tracing the checkpoint persistence and restoration flow in LangGraphJS.  Based on my current understanding, the issue may be related to how RedisSaver handles checkpoint storage in multi-node graphs.  My current hypothesis is:  A node writes to the messages channel and creates a checkpoint. A later node writes only to a different channel. The latest checkpoint contains only the channels written by that final node. Earlier channels remain referenced through channel_versions but may not be present in channel_values. During restoration, those missing channels may not be reconstructed correctly, resulting in incomplete state recovery.  To validate this, my plan is:  Create a dedicated multi-node reproduction test where different nodes write to different channels. Verify the exact contents of channel_values and channel_versions across checkpoints. Confirm whether the latest checkpoint can be restored with the complete state from all prio
  > I will move this issue to correct repo https://github.com/langchain-ai/langgraphjs/issues/2555

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

### Incident Patch 1: `eb69f67b` (2026-09-30)
**Commit Message**: fix(checkpoint-sqlite): walk delta ancestors by parent pointer (#8557)

## Summary

The sqlite delta history silently drops a parent checkpoint whose id sorts above its child's,
losing that parent's stored value and its pending writes. The channel hydrates short with no error.

Fixes #8550

## Problem

Stage 1 walked ancestors with:

```sql
WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id <= ?
ORDER BY checkpoint_id DESC
```

Ancestry is defined by the `parent_checkpoint_id` column. These two predicates add a second
requirement: that every child's id sorts above its parent's. The contract promises monotonic ids,
but that only holds within one process, so ids from processes with different clocks can break it.

When the requirement is violated the parent is excluded from the stream and its seed and writes go
with it. Dropping the range filter alone does not fix it: in `checkpoint_id DESC` order that parent
arrives *before* the target, so the walk streams past it before it has started.

## Fix

A recursive CTE anchored at the target, following `parent_checkpoint_id`:

```sql
WITH RECURSIVE ancestors(checkpoint_id, parent_checkpoint_id, type, checkpoint) AS (
    SELECT ... 

**File**: `libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/__init__.py` (modified, +11/-10)
```diff
@@ -507,13 +507,12 @@ def get_delta_channel_history(
 
         Two-stage query:
 
-        * Stage 1 (paged): newest-first slice of `checkpoints` returning
-          `(checkpoint_id, parent_checkpoint_id, type, checkpoint)` per
-          ancestor. Sqlite has no JSONB, so we ship the full serialized
-          checkpoint blob and inspect `channel_values` in Python. Pages
-          newest-first by `checkpoint_id` with a `< cursor` predicate;
-          page size is `DELTA_PAGE_SIZE`. Stops paging when every channel
-          has found its seed or the chain is exhausted.
+        * Stage 1 (streamed): recursive CTE over `checkpoints` following
+          `parent_checkpoint_id` from the target, returning
+          `(checkpoint_id, type, checkpoint)` per ancestor. Sqlite has no
+          JSONB, so we ship the full serialized checkpoint blob and inspect
+          `channel_values` in Python. Stops reading when every channel has
+          found its seed or the chain is exhausted.
 
         * Stage 2 (per-channel UNION ALL): one branch per channel reading
           `writes` filtered to that channel's specific `chain_cids`. No
@@ -538,12 +537,14 @@ def get_delta_channel_history(
         seeded: set[str] = set()
 
         with self.cursor(transaction=False) as cur:
-            cur.execute(DELTA_STAGE1_SQL, (thread_id, checkpoint_ns, checkpoint_id))
+            cur.execute(
+                DELTA_STAGE1_SQL,
+                (thread_id, checkpoint_ns, checkpoint_id, thread_id, checkpoint_ns),
+            )
             for row in cur:
-                cid, parent_cid, type_tag, blob = row
+                cid, type_tag, blob = row
                 if step_walk_with_row(
                     cid=cid,
-                    parent_cid=parent_cid,
                     type_tag=type_tag,
                     blob=blob,
                     target_id=checkpoint_id,
```

**File**: `libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/_delta.py` (modified, +36/-25)
```diff
@@ -26,16 +26,33 @@
 
 from langgraph.checkpoint.base import DeltaChannelHistory, PendingWrite
 
-# Stage 1 streams ancestors of `target_cid` newest-first. The `<=`
-# predicate keeps target itself in the stream so we can read its
-# `parent_checkpoint_id` from the first row without a separate lookup;
-# the caller skips target's own writes/seed (matches the
-# `BaseCheckpointSaver` contract).
+# Stage 1 streams target, then its ancestors nearest-first, by following
+# `parent_checkpoint_id` rather than id order: ids are only monotonic within
+# one process, so a range scan by id can miss a parent whose id sorts above
+# its child's. Target is the anchor row; its own writes/seed are skipped
+# (matches the `BaseCheckpointSaver` contract).
+#
+# `put` is `INSERT OR REPLACE`, so re-putting an existing id under a
+# descendant's config makes the chain a loop. `step_walk_with_row` stops on a
+# repeated id; sqlite yields recursive rows lazily, so abandoning the cursor
+# ends the recursion.
+#
+# `CROSS JOIN` pins `ancestors` as the outer loop, so each step is one primary
+# key lookup. With a plain `JOIN` and no `ANALYZE` stats, sqlite can put
+# `checkpoints` outside and scan the whole thread per step.
 DELTA_STAGE1_SQL = (
+    "WITH RECURSIVE ancestors(checkpoint_id, parent_checkpoint_id, type, "
+    "checkpoint) AS ("
     "SELECT checkpoint_id, parent_checkpoint_id, type, checkpoint "
     "FROM checkpoints "
-    "WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id <= ? "
-    "ORDER BY checkpoint_id DESC"
+    "WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ? "
+    "UNION ALL "
+    "SELECT c.checkpoint_id, c.parent_checkpoint_id, c.type, c.checkpoint "
+    "FROM ancestors a CROSS JOIN checkpoints c "
+    "ON c.checkpoint_id = a.parent_checkpoint_id "
+    "WHERE c.thread_id = ? AND c.checkpoint_ns = ?"
+    ") "
+    "SELECT checkpoint_id, type, checkpoint FROM ancestors"
 )
 
 
@@ -68,7 +85,6 @@ def build_delta_stage2_sql(*, chain_lens: Sequence[int]) -> str:
 def step_walk_with_row(
     *,
     cid: str,
-    parent_cid: str | None,
     type_tag: str,
     blob: bytes,
     target_id: str,
@@ -81,36 +97,32 @@ def step_walk_with_row(
 ) -> bool:
     """Process one streamed stage-1 row in the merged ancestor walk.
 
-    The cursor returns (cid, parent_cid, type, blob) rows in
-    `checkpoint_id` DESC order starting at target. The first row is
-    target itself; we read its parent_cid to seed the walk and otherwise
-    skip it (target's own writes/seed are not part of the contract).
+    The cursor returns (cid, type, blob) rows in walk order starting at
+    target. The first row is target itself and is skipped (target's own
+    writes/seed are not part of the contract).
 
-    For each subsequent row, if `cid` matches the walk's current
-    position, we deserialize the blob, append the cid to every
-    not-yet-seeded channel's chain, and check `channel_values` for
+    For each subsequent row we deserialize the blob, append the cid to
+    every not-yet-seeded channel's chain, and check `channel_values` for
     seeds. The deserialized checkpoint is dropped before advancing — no
     cross-row cache, so peak in-flight is one deserialized checkpoint.
 
-    Off-path rows (different branch on the same thread) advance the
-    cursor without doing any work.
-
-    Returns True when every requested channel is seeded — the caller
-    can stop iterating and close the cursor.
+    Returns True when the caller can stop iterating and close the cursor:
+    every requested channel is seeded, or the chain revisited a checkpoint.
     """
     if "started" not in walk_state:
         if cid == target_id:
             walk_state["started"] = True
-            walk_state["cur_cid"] = parent_cid
             walk_state["active"] = {ch for ch in channels if ch not in seeded}
+            walk_state["walked"] = {cid}
         # Not target yet (or target not present): keep streaming.
         return F
```

**File**: `libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/aio.py` (modified, +5/-5)
```diff
@@ -625,8 +625,8 @@ async def aget_delta_channel_history(
         """Fast-path override of `BaseCheckpointSaver.aget_delta_channel_history`.
 
         See `SqliteSaver.get_delta_channel_history` for design notes; this
-        is the async equivalent using `aiosqlite` cursors. Stage 1 pages
-        the parent chain newest-first and Python-deserializes each
+        is the async equivalent using `aiosqlite` cursors. Stage 1 streams
+        the parent chain from the target and Python-deserializes each
         checkpoint blob to find per-channel snapshots; stage 2 fetches
         only the relevant writes via per-channel UNION ALL.
         """
@@ -650,13 +650,13 @@ async def aget_delta_channel_history(
 
         async with self.lock, self.conn.cursor() as cur:
             await cur.execute(
-                DELTA_STAGE1_SQL, (thread_id, checkpoint_ns, checkpoint_id)
+                DELTA_STAGE1_SQL,
+                (thread_id, checkpoint_ns, checkpoint_id, thread_id, checkpoint_ns),
             )
             async for row in cur:
-                cid, parent_cid, type_tag, blob = row
+                cid, type_tag, blob = row
                 if step_walk_with_row(
                     cid=cid,
-                    parent_cid=parent_cid,
                     type_tag=type_tag,
                     blob=blob,
                     target_id=checkpoint_id,
```

**File**: `libs/checkpoint-sqlite/tests/test_delta_parent_walk.py` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+from __future__ import annotations
+
+from typing import Any
+
+import pytest
+from langgraph.checkpoint.base import (
+    BaseCheckpointSaver,
+    Checkpoint,
+    DeltaChannelHistory,
+    empty_checkpoint,
+)
+
+from langgraph.checkpoint.sqlite import SqliteSaver
+from langgraph.checkpoint.sqlite._delta import DELTA_STAGE1_SQL
+from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
+
+CHANNEL = "ch"
+CONFIG: dict[str, Any] = {"configurable": {"thread_id": "t", "checkpoint_ns": ""}}
+EXPECTED: DeltaChannelHistory = {
+    "writes": [("task", CHANNEL, "write-root")],
+    "seed": "seed",
+}
+
+
+def _checkpoint(checkpoint_id: str, values: dict[str, Any]) -> Checkpoint:
+    value = empty_checkpoint()
+    value["id"] = checkpoint_id
+    value["channel_values"] = values
+    return value
+
+
+PARENT_ID_ORDERS = [
+    pytest.param("z-older", "a-newer", id="parent_id_sorts_above_child"),
+    pytest.param("a-older", "z-newer", id="parent_id_sorts_below_child"),
+]
+
+
+@pytest.mark.parametrize(("root_id", "child_id"), PARENT_ID_ORDERS)
+def test_sync_walk_reaches_parent_whatever_the_id_order(
+    root_id: str, child_id: str
+) -> None:
+    with SqliteSaver.from_conn_string(":memory:") as saver:
+        root = saver.put(CONFIG, _checkpoint(root_id, {CHANNEL: "seed"}), {}, {})
+        saver.put_writes(root, [(CHANNEL, "write-root")], "task")
+        child = saver.put(root, _checkpoint(child_id, {}), {}, {})
+
+        got = saver.get_delta_channel_history(config=child, channels=[CHANNEL])
+        reference = BaseCheckpointSaver.get_delta_channel_history(
+            saver, config=child, channels=[CHANNEL]
+        )
+        assert got[CHANNEL] == EXPECTED
+        assert got[CHANNEL] == reference[CHANNEL], "fast path disagrees with base"
+
+
+@pytest.mark.parametrize(("root_id", "child_id"), PARENT_ID_ORDERS)
+async def test_async_walk_reaches_parent_whatever_the_id_order(
+    root_id: str, child_id: str
+) -> None:
+    async with AsyncSqliteSaver.from_conn_string(":memory:") as saver:
+        root = await saver.aput(CONFIG, _checkpoint(root_id, {CHANNEL: "seed"}), {}, {})
+        await saver.aput_writes(root, [(CHANNEL, "write-root")], "task")
+        child = await saver.aput(root, _checkpoint(child_id, {}), {}, {})
+
+        got = await saver.aget_delta_channel_history(config=child, channels=[CHANNEL])
+        assert got[CHANNEL] == EXPECTED
+
+
+def test_walk_reaches_root_of_long_chain_with_descending_ids() -> None:
+    steps = 40
+    with SqliteSaver.from_conn_string(":memory:") as saver:
+        parent = saver.put(
+            CONFIG, _checkpoint(f"id-{steps:03d}", {CHANNEL: "seed"}), {}, {}
+        )
+        saver.put_writes(parent, [(CHANNEL, "write-root")], "task")
+        for step in range(steps - 1, 0, -1):
+            parent = saver.put(parent, _checkpoint(f"id-{step:03d}", {}), {}, {})
+
+        got = saver.get_delta_channel_history(config=parent, channels=[CHANNEL])
+        assert got[CHANNEL] == EXPECTED
+
+
+def test_walk_terminates_when_put_makes_the_parent_chain_cycle() -> None:
+    with SqliteSaver.from_conn_string(":memory:") as saver:
+        a = saver.put(CONFIG, _checkpoint("cid-a", {}), {}, {})
+        b = saver.put(a, _checkpoint("cid-b", {}), {}, {})
+        repoint_a_under_b = _checkpoint("cid-a", {})
+        saver.put(b, repoint_a_under_b, {}, {})
+
+        got = saver.get_delta_channel_history(config=b, channels=[CHANNEL])
+        assert got[CHANNEL] == {"writes": []}
+
+
+def test_walk_step_looks_up_the_parent_by_primary_key() -> None:
+    with SqliteSaver.from_conn_string(":memory:") as saver:
+        saver.setup()
+        plan = [
+            row[3]
+            for row in saver.conn.execute(
+                f"EXPLAIN QUERY PLAN {DELTA_STAGE1_SQL}", ("t", "", "id", "t", "")
+            )
+        ]
+    assert any(
+        step.startswith("SEARCH c ") and "checkpoint_id=?" in step for step in plan
+    ), f"recursive step should look
```

---

### Incident Patch 2: `c0279f09` (2026-09-30)
**Commit Message**: fix(checkpoint-postgres): derive the delta walk cursor once the target loads (#8556)

## Summary

`get_delta_channel_history` on Postgres returns an empty history for any `DeltaChannel` on a
target checkpoint that is not within the first stage-1 pagination page (1024 rows) of the thread.
No exception, no warning: the channel just hydrates empty.

Fixes #8448

## Problem

Stage 1 pages `checkpoints` newest-first from the head of the thread, and after each page
`_try_advance_walks` tries to move every not-yet-seeded channel's walk along the partial
`parent_of` map accumulated so far. The walk starts at the target's parent:

```python
if ch not in walk_cursor_by_ch:
    walk_cursor_by_ch[ch] = parent_of.get(target_id)
```

The target can be any checkpoint in the thread, not just the head, so on the first page
`parent_of` frequently has no row for it yet. `.get` then returns `None`, which is also what a
target with no parent returns, and the two are stored identically. Because the initialisation is
guarded by `ch not in walk_cursor_by_ch`, it never runs again: once the walk is parked at `None`
it stays there even after the target's real row and real parent load on a later page.

The re

**File**: `libs/checkpoint-postgres/langgraph/checkpoint/postgres/__init__.py` (modified, +6/-5)
```diff
@@ -448,11 +448,12 @@ def get_delta_channel_history(
 
         Two-stage query, both stages cover ALL requested channels:
 
-        * Stage 1 (paged): dynamic SELECT over `checkpoints` with K parallel
-          JSONB key lookups (one column pair per channel) — no subquery, no
-          aggregation. Pages newest-first by `checkpoint_id` with a cursor;
-          page size is `_DELTA_PAGE_SIZE`. Stops paging when every channel
-          has found its seed or the chain is exhausted.
+        * Stage 1 (paged): dynamic SELECT over `checkpoints` with three
+          columns per channel: its version, an `EXISTS` probe for a stored
+          blob at that version, and its inline value. Pages newest-first by
+          `checkpoint_id` with a cursor; page size is `_DELTA_PAGE_SIZE`.
+          Stops paging when every channel has found its seed or a page comes
+          back short.
 
         * Stage 2 (per-channel UNION ALL): one branch per channel reading
           `checkpoint_writes` filtered to that channel's specific
```

**File**: `libs/checkpoint-postgres/langgraph/checkpoint/postgres/base.py` (modified, +13/-32)
```diff
@@ -172,30 +172,8 @@ class _DeltaStage2Row(TypedDict, total=False):
     version: str | None  # "b" rows only
 
 
-# Multi-channel two-stage DeltaChannel reconstruction.
-#
-# Stage 1 scans checkpoint metadata (no blob bytes) and emits one row per
-# checkpoint with K parallel JSONB key lookups (one column pair per
-# requested delta channel: ver_i / hs_i).  No subqueries, no aggregation.
-# Python walks the parent chain once across all channels.
-#
-# Stage 2 fetches all writes and the seed blobs for ALL channels in a
-# single roundtrip via `channel = ANY(%s)` and chain/seed-version
-# filtering.
-#
-# Empirical comparison vs an alternative "ship full channel_versions /
-# channel_values JSONB and let Python pick" form (1000 checkpoints,
-# 8 total channels in graph, 3 delta channels requested):
-#
-#   Postgres execution:    A=0.24ms vs B=0.38ms   (both negligible)
-#   End-to-end latency:    A=6.83ms vs B=2.28ms   (B is 3.0x faster)
-#   Wire payload:          A=836KB  vs B=330KB    (61% smaller)
-#   Buffer hits:           identical (167 blocks)
-#
-# B (this dynamic-columns design) wins because it avoids JSONB
-# serialization on the wire and JSONB-to-dict deserialization in
-# psycopg.  Even at K=8 (8 delta channels = 16 dynamic columns), B
-# still beats A end-to-end (4.2ms vs 6.8ms).
+# Delta history is rebuilt in two queries; `_build_delta_stage1_sql` and
+# `_build_delta_stage2_sql` document their shapes.
 
 
 def _build_delta_stage1_sql(channels: Sequence[str], *, paged: bool) -> str:
@@ -335,10 +313,8 @@ def _build_delta_stage2_sql(
     return " UNION ALL ".join(branches)
 
 
-# Stage 1 rows are dynamic-shape dicts: {checkpoint_id, parent_checkpoint_id,
-# ver_0, hs_0, ver_1, hs_1, ...}.  Walking is parameterized by the channel
-# list to map indices back to channel names — no static TypedDict here.
-# `dict[str, Any]` is the practical signature.
+# Stage 1 rows are dicts keyed by the per-channel aliases
+# `_build_delta_stage1_sql` emits, so there is no static TypedDict.
 
 
 class BasePostgresSaver(BaseCheckpointSaver[str]):
@@ -431,19 +407,24 @@ def _try_advance_walks(
           (a) it found a stored value for its channel — a blob or an inline
               primitive (channel becomes seeded),
           (b) it reached a real root (parent_of[cid] is None — fully
-              materialized at this point), or
+              materialized at this point),
           (c) the next ancestor cid isn't in `parent_of` yet (waiting for
-              a later page; the cursor stays put).
+              a later page; the cursor stays put), or
+          (d) the target's own row isn't in `parent_of` yet (the walk has
+              not started; no cursor is set, so a later page retries).
 
         Mutates `chain_by_ch`, `seed_ver_by_ch`, `seed_inline_by_ch`,
         `walk_cursor_by_ch`, and `seeded` in place.
         """
         for i, ch in enumerate(channels):
             if ch in seeded:
                 continue
-            # First-time entry: cursor starts at the target's parent.
+            # Pages start at the thread head, so the target may not have
+            # loaded yet; a `None` cursor would read as "target is a root".
             if ch not in walk_cursor_by_ch:
-                walk_cursor_by_ch[ch] = parent_of.get(target_id)
+                if target_id not in parent_of:
+                    continue
+                walk_cursor_by_ch[ch] = parent_of[target_id]
             cur_cid = walk_cursor_by_ch[ch]
             ch_chain = chain_by_ch[ch]
             hb_i = hb_by_i_by_cid[i]
```

**File**: `libs/checkpoint-postgres/tests/test_delta_pagination.py` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+from __future__ import annotations
+
+from typing import Any
+from uuid import uuid4
+
+import pytest
+from langgraph.checkpoint.base import (
+    Checkpoint,
+    DeltaChannelHistory,
+    empty_checkpoint,
+)
+from langgraph.checkpoint.base.id import uuid6
+from langgraph.checkpoint.serde.types import _DeltaSnapshot
+
+from langgraph.checkpoint.postgres import PostgresSaver
+from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
+from langgraph.checkpoint.postgres.base import _DELTA_PAGE_SIZE
+from tests.conftest import DEFAULT_URI
+
+CHANNEL = "items"
+STEPS = 8
+SEED_STEP = 1
+SEED_VALUE = [10, 20]
+TARGET_STEP = 4
+
+# The real page size is the control; the rest leave the target off the first
+# page (three checkpoints are newer than it).
+PAGE_SIZES = [_DELTA_PAGE_SIZE, 3, 2, 1]
+
+
+def _step_args(
+    thread_id: str, step: int, parent: dict | None
+) -> tuple[dict, Checkpoint, dict[str, Any]]:
+    config: dict = {"configurable": {"thread_id": thread_id, "checkpoint_ns": ""}}
+    if parent is not None:
+        config["configurable"]["checkpoint_id"] = parent["configurable"][
+            "checkpoint_id"
+        ]
+    checkpoint: Checkpoint = empty_checkpoint()
+    checkpoint["id"] = str(uuid6(clock_seq=step))
+    checkpoint["channel_versions"][CHANNEL] = f"v{step}"
+    if step == SEED_STEP:
+        checkpoint["channel_values"][CHANNEL] = _DeltaSnapshot(list(SEED_VALUE))
+        return config, checkpoint, {CHANNEL: f"v{step}"}
+    return config, checkpoint, {}
+
+
+async def _abuild_chain(saver: AsyncPostgresSaver) -> list[dict]:
+    thread_id = str(uuid4())
+    parent: dict | None = None
+    configs: list[dict] = []
+    for step in range(STEPS):
+        config, checkpoint, new_versions = _step_args(thread_id, step, parent)
+        parent = await saver.aput(
+            config,
+            checkpoint,
+            {"source": "loop", "step": step, "parents": {}},
+            new_versions,
+        )
+        await saver.aput_writes(parent, [(CHANNEL, f"w{step}")], str(uuid4()))
+        configs.append(parent)
+    return configs
+
+
+def _build_chain(saver: PostgresSaver) -> list[dict]:
+    thread_id = str(uuid4())
+    parent: dict | None = None
+    configs: list[dict] = []
+    for step in range(STEPS):
+        config, checkpoint, new_versions = _step_args(thread_id, step, parent)
+        parent = saver.put(
+            config,
+            checkpoint,
+            {"source": "loop", "step": step, "parents": {}},
+            new_versions,
+        )
+        saver.put_writes(parent, [(CHANNEL, f"w{step}")], str(uuid4()))
+        configs.append(parent)
+    return configs
+
+
+def _assert_history(entry: DeltaChannelHistory, page_size: int) -> None:
+    seed = entry.get("seed")
+    assert isinstance(seed, _DeltaSnapshot), (
+        f"page_size={page_size}: expected a snapshot seed, "
+        f"got {entry.get('seed', '<missing>')!r}"
+    )
+    assert seed.value == SEED_VALUE
+    assert [w[2] for w in entry["writes"]] == ["w1", "w2", "w3"], (
+        f"page_size={page_size}: got {[w[2] for w in entry['writes']]}"
+    )
+
+
+@pytest.mark.parametrize("page_size", PAGE_SIZES)
+async def test_async_target_older_than_the_first_page(
+    page_size: int, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    monkeypatch.setattr("langgraph.checkpoint.postgres.aio._DELTA_PAGE_SIZE", page_size)
+    async with AsyncPostgresSaver.from_conn_string(DEFAULT_URI) as saver:
+        await saver.setup()
+        configs = await _abuild_chain(saver)
+        result = await saver.aget_delta_channel_history(
+            config=configs[TARGET_STEP], channels=[CHANNEL]
+        )
+        _assert_history(result[CHANNEL], page_size)
+
+
+@pytest.mark.parametrize("page_size", PAGE_SIZES)
+def test_sync_target_older_than_the_first_page(
+    page_size: int, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    monkeypatch.setattr("langgraph.checkpoint.postgres._DELTA_PAGE_SIZE", page_size)
+
```

---

### Incident Patch 3: `f5804a5b` (2026-09-30)
**Commit Message**: fix(ci): test locally-built wheel and publish to test pypi after pre-release checks (#9124)

**File**: `.github/workflows/release.yml` (modified, +23/-36)
```diff
@@ -139,23 +139,10 @@ jobs:
             echo EOF
           } >> "$GITHUB_OUTPUT"
 
-  test-pypi-publish:
-    needs:
-      - build
-      - release-notes
-    permissions:
-      contents: read
-      id-token: write
-    uses: ./.github/workflows/_test_release.yml
-    with:
-      working-directory: ${{ inputs.working-directory }}
-    secrets: inherit
-
   pre-release-checks:
     needs:
       - build
       - release-notes
-      - test-pypi-publish
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -180,31 +167,20 @@ jobs:
           enable-cache: false
           working-directory: ${{ inputs.working-directory }}
 
-      - name: Import published package
+      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
+        with:
+          name: dist
+          path: ${{ inputs.working-directory }}/dist/
+
+      - name: Import dist package
         shell: bash
         working-directory: ${{ inputs.working-directory }}
         env:
           PKG_NAME: ${{ needs.build.outputs.pkg-name }}
           VERSION: ${{ needs.build.outputs.version }}
-        # Here we use:
-        # - The default regular PyPI index as the *primary* index, meaning
-        #   that it takes priority (https://pypi.org/simple)
-        # - The test PyPI index as an extra index, so that any dependencies that
-        #   are not found on test PyPI can be resolved and installed anyway.
-        #   (https://test.pypi.org/simple). This will include the PKG_NAME==VERSION
-        #   package because VERSION will not have been uploaded to regular PyPI yet.
-        # - attempt install again after 5 seconds if it fails because there is
-        #   sometimes a delay in availability on test pypi
+        # Install directly from the locally-built wheel (no index resolution needed).
         run: |
-          uv run pip install \
-            --extra-index-url https://test.pypi.org/simple/ \
-            "$PKG_NAME==$VERSION" || \
-          ( \
-            sleep 5 && \
-            uv run pip install \
-              --extra-index-url https://test.pypi.org/simple/ \
-              "$PKG_NAME==$VERSION" \
-          )
+          uv run pip install dist/*.whl
 
           if [[ "$PKG_NAME" == *prebuilt* ]]; then
             uv run pip install langgraph
@@ -226,22 +202,33 @@ jobs:
         run: uv sync --group test
         working-directory: ${{ inputs.working-directory }}
 
-      # Overwrite the local version of the package with the test PyPI version.
+      # Overwrite the local version of the package with the built version
       - name: Import published package (again)
         working-directory: ${{ inputs.working-directory }}
         shell: bash
         env:
           PKG_NAME: ${{ needs.build.outputs.pkg-name }}
           VERSION: ${{ needs.build.outputs.version }}
         run: |
-          uv run pip install \
-            --extra-index-url https://test.pypi.org/simple/ \
-            "$PKG_NAME==$VERSION"
+          uv run pip install dist/*.whl
 
       - name: Run unit tests
         run: make test
         working-directory: ${{ inputs.working-directory }}
 
+  test-pypi-publish:
+    needs:
+      - build
+      - release-notes
+      - pre-release-checks
+    permissions:
+      contents: read
+      id-token: write
+    uses: ./.github/workflows/_test_release.yml
+    with:
+      working-directory: ${{ inputs.working-directory }}
+    secrets: inherit
+
   publish:
     needs:
       - build
```

---

### Incident Patch 4: `07b33185` (2026-09-27)
**Commit Message**: fix: reject credential-bearing Git dependencies (#8542)

## Description
Reject Git HTTP dependency URLs containing userinfo before Docker
generation so credentials cannot persist in Dockerfiles or image layers.
Validation now covers local requirement/package metadata and uv
pyproject/lock inputs while keeping errors token-free.

## Test Plan
- [x] Validate credentialed raw, local-manifest, and uv-managed Git URLs
are rejected without echoing secrets
- [x] Validate credential-free HTTPS and SSH Git URLs remain supported

Made by [Open
SWE](https://openswe.vercel.app/agents/81b07455-ece4-3ddc-9955-d7a5bea78d2c)

---------

Co-authored-by: open-swe[bot] <open-swe@users.noreply.github.com>

**File**: `libs/cli/README.md` (modified, +2/-0)
```diff
@@ -103,6 +103,8 @@ The CLI uses a `langgraph.json` configuration file with these key settings:
 }
 ```
 
+Git dependencies should use credential-free URLs. The CLI conservatively scans direct `langgraph.json` dependencies, common Python package files, uv project and lock files, and common Node.js package and lock files for HTTP Git URLs with userinfo. This check is not exhaustive: generated Docker builds can copy other files, including nested requirement or constraint files, into image layers without scanning them. For private dependencies, provide short-lived credentials through your build environment's secret-backed Git credential helper. Do not store credentials in copied files such as `langgraph.json` or `pip_config_file`.
+
 See the [full documentation](https://reference.langchain.com/python/langgraph-cli) for detailed configuration options.
 
 ## Development
```

**File**: `libs/cli/langgraph_cli/config.py` (modified, +87/-3)
```diff
@@ -6,6 +6,7 @@
 import shlex
 import textwrap
 from collections import Counter
+from collections.abc import Iterable
 from typing import Literal, NamedTuple
 
 import click
@@ -36,6 +37,10 @@
 # This blocks background execution (cmd &) while allowing command
 # chaining (cmd1 && cmd2) which is common in build commands.
 _SINGLE_AMPERSAND_RE = re.compile(r"(?<!&)&(?:&&)*(?!&)")
+_GIT_HTTP_AUTHORITY_RES = (
+    re.compile(r"git\+https?://(?P<authority>[^/\s\"']+)", re.I),
+    re.compile(r"\bgit\s*=\s*[\"']https?://(?P<authority>[^/\s\"']+)", re.I),
+)
 _API_VERSION_PATTERN = re.compile(
     r"^(?P<major>\d+)"
     r"(?:\.(?P<minor>\d+))?"
@@ -78,6 +83,62 @@ def has_disallowed_build_command_content(command: str) -> bool:
     return False
 
 
+def _has_git_http_url_userinfo(dependency: str) -> bool:
+    """Check whether a Git HTTP URL contains userinfo."""
+    return any(
+        "@" in match.group("authority")
+        for pattern in _GIT_HTTP_AUTHORITY_RES
+        for match in pattern.finditer(dependency)
+    )
+
+
+def _validate_git_http_url_userinfo(
+    values: Iterable[str], *, source: pathlib.Path | None = None
+) -> None:
+    """Reject credential-bearing Git HTTP URLs without echoing their values."""
+    if not any(_has_git_http_url_userinfo(value) for value in values):
+        return
+    message = (
+        "Git dependency URLs must not contain credentials or other URL "
+        "userinfo because generated Dockerfiles and image layers can retain "
+        "them. Use a credential-free Git URL and provide short-lived "
+        "credentials through your build environment's secret-backed Git "
+        "credential helper."
+    )
+    if source is not None:
+        message += f" Found in: {source}"
+    raise click.UsageError(message)
+
+
+def _validate_git_http_url_userinfo_files(paths: Iterable[pathlib.Path]) -> None:
+    """Reject credential-bearing Git HTTP URLs in dependency files."""
+    for path in paths:
+        path = path.resolve()
+        if not path.is_file():
+            continue
+        try:
+            contents = path.read_text(encoding="utf-8", errors="replace")
+        except OSError:
+            raise click.UsageError(
+                f"Could not inspect dependency file for embedded credentials: {path}"
+            ) from None
+        _validate_git_http_url_userinfo([contents], source=path)
+
+
+def _validate_local_dependency_files(config_path: pathlib.Path, config: Config) -> None:
+    """Validate dependency files copied into a non-uv Python image."""
+    paths: list[pathlib.Path] = []
+    for dependency in config["dependencies"]:
+        if not isinstance(dependency, str) or not dependency.startswith("."):
+            continue
+        root = (config_path.parent / dependency).resolve()
+        paths.extend(
+            root / name
+            for name in ("requirements.txt", "pyproject.toml", "setup.py", "setup.cfg")
+        )
+    _validate_git_http_url_userinfo_files(paths)
+
+
 MIN_PYTHON_VERSION = "3.11"
 DEFAULT_PYTHON_VERSION = "3.11"
 
@@ -320,7 +381,9 @@ def _get_source_kind(config: Config) -> str | None:
     return kind if isinstance(kind, str) else None
 
 
-def validate_config(config: Config) -> Config:
+def validate_config(
+    config: Config, *, source_path: pathlib.Path | None = None
+) -> Config:
     """Validate a configuration dictionary."""
 
     graphs = config.get("graphs", {})
@@ -415,6 +478,15 @@ def validate_config(config: Config) -> Config:
                 '  "source": {"kind": "uv", "root": ".."}'
             )
 
+    _validate_git_http_url_userinfo(
+        (
+            dependency
+            for dependency in config["dependencies"]
+            if isinstance(dependency, str)
+        ),
+        source=source_path,
+    )
+
     source = config.get("source")
     source_kind = _get_source_kind(config)
     if source is not None and not isinstance(source, dict):
@@ -609,7 +681,7 @@ def validate_config_file(config_path: pathlib.Path
```

**File**: `libs/cli/langgraph_cli/schemas.py` (modified, +5/-1)
```diff
@@ -650,7 +650,8 @@ class Config(TypedDict, total=False):
 
     pip_config_file: str | None
     """Optional. Path to a pip config file (e.g., "/etc/pip.conf" or "pip.ini") for controlling
-    package installation (custom indices, credentials, etc.).
+    package installation (custom indices, timeouts, etc.). The file is copied into the
+    generated image, so it must not contain credentials or other secrets.
 
     Only relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.
     """
@@ -689,6 +690,9 @@ class Config(TypedDict, total=False):
       - "." or "./src" if you have a local Python package
       - str (aka "anthropic") for a PyPI package
       - "git+https://github.com/org/repo.git@main" for a Git-based package
+    Git HTTP URLs must not contain userinfo such as a username or token. For private
+    dependencies, provide short-lived credentials through the build environment's
+    secret-backed Git credential helper.
     Defaults to an empty list, meaning no additional packages installed beyond your base environment.
 
     This field is not supported when `source.kind` is `uv`.
```

**File**: `libs/cli/langgraph_cli/uv_lock.py` (modified, +10/-0)
```diff
@@ -880,6 +880,7 @@ def python_config_to_docker_uv_lock(
         _get_node_pm_install_cmd,
         _get_pip_cleanup_lines,
         _image_supports_uv,
+        _validate_git_http_url_userinfo_files,
         docker_tag,
     )
 
@@ -890,11 +891,20 @@ def python_config_to_docker_uv_lock(
         )
 
     config_root = config_path.parent.resolve()
+    source_root = config["source"].get("root", ".")
+    project_root = (config_root / source_root).resolve()
+    _validate_git_http_url_userinfo_files(
+        [project_root / "pyproject.toml", project_root / "uv.lock"]
+    )
+
     install_cmd = "uv pip install --system"
     _, global_reqs_pip_install, pip_config_file_str = _build_python_install_commands(
         config, install_cmd
     )
     plan = _plan_uv_lock_workspace(config_path, config)
+    _validate_git_http_url_userinfo_files(
+        package.pyproject_path for package in plan.install_order
+    )
 
     _update_uv_lock_graph_paths(config_path, config, plan)
     for section, key in [
```

**File**: `libs/cli/schemas/schema.json` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@
                   "type": "null"
                 }
               ],
-              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, credentials, etc.).\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
+              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, timeouts, etc.). The file is copied into the\ngenerated image, so it must not contain credentials or other secrets.\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
             },
             "_INTERNAL_docker_tag": {
               "anyOf": [
@@ -270,7 +270,7 @@
                   "type": "null"
                 }
               ],
-              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, credentials, etc.).\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
+              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, timeouts, etc.). The file is copied into the\ngenerated image, so it must not contain credentials or other secrets.\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
             },
             "_INTERNAL_docker_tag": {
               "anyOf": [
```

---

### Incident Patch 5: `ed384f3a` (2026-09-20)
**Commit Message**: fix(cli): remediate AnyIO vulnerabilities in example lockfiles (#9022)

- Upgrade AnyIO from 4.13.0 to 4.14.2 in both uv example lockfiles,
fixing GHSA-82r6-8w77-94w6 (TLS certificate spoofing) and
GHSA-5p39-cfhj-2xmp (process-pool hangs).
- Remove the orphaned examples Poetry lockfile left behind by the uv
migration; current example tooling does not consume it.
- Addresses all six currently open Dependabot alerts without changing
unrelated dependencies.

Made by [Open SWE](https://github.com/langchain-ai/open-swe) · [view
thread](https://openswe.vercel.app/agents/37d08f4f-9fe6-51be-adc9-d58aa9e6e010)
· openai:gpt-6-astra (medium)

Co-authored-by: open-swe[bot] <open-swe@users.noreply.github.com>

**File**: `libs/cli/examples/poetry.lock` (removed, +0/-285)
```diff
@@ -1,285 +0,0 @@
-# This file is automatically @generated by Poetry 2.0.0 and should not be changed by hand.
-
-[[package]]
-name = "anyio"
-version = "4.4.0"
-description = "High level compatibility layer for multiple asynchronous event loop implementations"
-optional = false
-python-versions = ">=3.8"
-groups = ["main"]
-files = [
-    {file = "anyio-4.4.0-py3-none-any.whl", hash = "sha256:c1b2d8f46a8a812513012e1107cb0e68c17159a7a594208005a57dc776e1bdc7"},
-    {file = "anyio-4.4.0.tar.gz", hash = "sha256:5aadc6a1bbb7cdb0bede386cac5e2940f5e2ff3aa20277e991cf028e0585ce94"},
-]
-
-[package.dependencies]
-exceptiongroup = {version = ">=1.0.2", markers = "python_version < \"3.11\""}
-idna = ">=2.8"
-sniffio = ">=1.1"
-typing-extensions = {version = ">=4.1", markers = "python_version < \"3.11\""}
-
-[package.extras]
-doc = ["Sphinx (>=7)", "packaging", "sphinx-autodoc-typehints (>=1.2.0)", "sphinx-rtd-theme"]
-test = ["anyio[trio]", "coverage[toml] (>=7)", "exceptiongroup (>=1.2.0)", "hypothesis (>=4.0)", "psutil (>=5.9)", "pytest (>=7.0)", "pytest-mock (>=3.6.1)", "trustme", "uvloop (>=0.17)"]
-trio = ["trio (>=0.23)"]
-
-[[package]]
-name = "certifi"
-version = "2024.7.4"
-description = "Python package for providing Mozilla's CA Bundle."
-optional = false
-python-versions = ">=3.6"
-groups = ["main"]
-files = [
-    {file = "certifi-2024.7.4-py3-none-any.whl", hash = "sha256:c198e21b1289c2ab85ee4e67bb4b4ef3ead0892059901a8d5b622f24a1101e90"},
-    {file = "certifi-2024.7.4.tar.gz", hash = "sha256:5a1e7645bc0ec61a09e26c36f6106dd4cf40c6db3a1fb6352b0244e7fb057c7b"},
-]
-
-[[package]]
-name = "click"
-version = "8.1.7"
-description = "Composable command line interface toolkit"
-optional = false
-python-versions = ">=3.7"
-groups = ["main"]
-files = [
-    {file = "click-8.1.7-py3-none-any.whl", hash = "sha256:ae74fb96c20a0277a1d615f1e4d73c8414f5a98db8b799a7931d1582f3390c28"},
-    {file = "click-8.1.7.tar.gz", hash = "sha256:ca9853ad459e787e2192211578cc907e7594e294c7ccc834310722b41b9ca6de"},
-]
-
-[package.dependencies]
-colorama = {version = "*", markers = "platform_system == \"Windows\""}
-
-[[package]]
-name = "colorama"
-version = "0.4.6"
-description = "Cross-platform colored terminal text."
-optional = false
-python-versions = "!=3.0.*,!=3.1.*,!=3.2.*,!=3.3.*,!=3.4.*,!=3.5.*,!=3.6.*,>=2.7"
-groups = ["main"]
-markers = "platform_system == \"Windows\""
-files = [
-    {file = "colorama-0.4.6-py2.py3-none-any.whl", hash = "sha256:4f1d9991f5acc0ca119f9d443620b77f9d6b33703e51011c16baf57afb285fc6"},
-    {file = "colorama-0.4.6.tar.gz", hash = "sha256:08695f5cb7ed6e0531a20572697297273c47b8cae5a63ffc6d6ed5c201be6e44"},
-]
-
-[[package]]
-name = "exceptiongroup"
-version = "1.2.1"
-description = "Backport of PEP 654 (exception groups)"
-optional = false
-python-versions = ">=3.7"
-groups = ["main"]
-markers = "python_version < \"3.11\""
-files = [
-    {file = "exceptiongroup-1.2.1-py3-none-any.whl", hash = "sha256:5258b9ed329c5bbdd31a309f53cbfb0b155341807f6ff7606a1e801a891b29ad"},
-    {file = "exceptiongroup-1.2.1.tar.gz", hash = "sha256:a4785e48b045528f5bfe627b6ad554ff32def154f42372786903b7abcfe1aa16"},
-]
-
-[package.extras]
-test = ["pytest (>=6)"]
-
-[[package]]
-name = "h11"
-version = "0.16.0"
-description = "A pure-Python, bring-your-own-I/O implementation of HTTP/1.1"
-optional = false
-python-versions = ">=3.8"
-groups = ["main"]
-files = [
-    {file = "h11-0.16.0-py3-none-any.whl", hash = "sha256:63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"},
-    {file = "h11-0.16.0.tar.gz", hash = "sha256:4e35b956cf45792e4caa5885e69fba00bdbc6ffafbfa020300e549b208ee5ff1"},
-]
-
-[[package]]
-name = "httpcore"
-version = "1.0.9"
-description = "A minimal low-level HTTP client."
-optional = false
-python-versions = ">=3.8"
-groups = ["main"]
-files = [
-    {file = "httpcore-1.0.9-py3-none-any.whl", hash = "sha256:2d400746a40668fc9dec9810239072b40b4484b640a8c38fd654a024c7a1bf55"},
-    {file = "httpcore-1.0.9.tar.gz",
```

**File**: `libs/cli/uv-examples/monorepo/uv.lock` (modified, +3/-3)
```diff
@@ -39,15 +39,15 @@ wheels = [
 
 [[package]]
 name = "anyio"
-version = "4.13.0"
+version = "4.14.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "idna" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/19/14/2c5dd9f512b66549ae92767a9c7b330ae88e1932ca57876909410251fe13/anyio-4.13.0.tar.gz", hash = "sha256:334b70e641fd2221c1505b3890c69882fe4a2df910cba14d97019b90b24439dc", size = 231622, upload-time = "2026-03-24T12:59:09.671Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/61/cc/a381afa6efea9f496eff839d4a6a1aed3bfafc7b3ab4b0d1b243a12573dd/anyio-4.14.2.tar.gz", hash = "sha256:cfa139f3ed1a23ee8f88a145ddb5ac7605b8bbfd8592baacd7ce3d8bb4313c7f", size = 260176, upload-time = "2026-07-12T20:29:07.082Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/da/42/e921fccf5015463e32a3cf6ee7f980a6ed0f395ceeaa45060b61d86486c2/anyio-4.13.0-py3-none-any.whl", hash = "sha256:08b310f9e24a9594186fd75b4f73f4a4152069e3853f1ed8bfbf58369f4ad708", size = 114353, upload-time = "2026-03-24T12:59:08.246Z" },
+    { url = "https://files.pythonhosted.org/packages/da/35/f2287558c17e29fafc8ef3daf819bb9834061cfa43bff8014f7df7f63bdc/anyio-4.14.2-py3-none-any.whl", hash = "sha256:9f505dda5ac9f0c8309b5e8bd445a8c2bf7246f3ce950121e45ea15bc41d1494", size = 125813, upload-time = "2026-07-12T20:29:05.763Z" },
 ]
 
 [[package]]
```

**File**: `libs/cli/uv-examples/simple/uv.lock` (modified, +3/-3)
```diff
@@ -13,15 +13,15 @@ wheels = [
 
 [[package]]
 name = "anyio"
-version = "4.13.0"
+version = "4.14.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "idna" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/19/14/2c5dd9f512b66549ae92767a9c7b330ae88e1932ca57876909410251fe13/anyio-4.13.0.tar.gz", hash = "sha256:334b70e641fd2221c1505b3890c69882fe4a2df910cba14d97019b90b24439dc", size = 231622, upload-time = "2026-03-24T12:59:09.671Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/61/cc/a381afa6efea9f496eff839d4a6a1aed3bfafc7b3ab4b0d1b243a12573dd/anyio-4.14.2.tar.gz", hash = "sha256:cfa139f3ed1a23ee8f88a145ddb5ac7605b8bbfd8592baacd7ce3d8bb4313c7f", size = 260176, upload-time = "2026-07-12T20:29:07.082Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/da/42/e921fccf5015463e32a3cf6ee7f980a6ed0f395ceeaa45060b61d86486c2/anyio-4.13.0-py3-none-any.whl", hash = "sha256:08b310f9e24a9594186fd75b4f73f4a4152069e3853f1ed8bfbf58369f4ad708", size = 114353, upload-time = "2026-03-24T12:59:08.246Z" },
+    { url = "https://files.pythonhosted.org/packages/da/35/f2287558c17e29fafc8ef3daf819bb9834061cfa43bff8014f7df7f63bdc/anyio-4.14.2-py3-none-any.whl", hash = "sha256:9f505dda5ac9f0c8309b5e8bd445a8c2bf7246f3ce950121e45ea15bc41d1494", size = 125813, upload-time = "2026-07-12T20:29:05.763Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 6: `e539ac12` (2026-09-09)
**Commit Message**: chore(deps): fix vulnerable dev dependencies (#8449)

## Summary
Patch both `js-yaml` release lines in `libs/cli/js-examples` for
GHSA-2883-xcg3-v3hh: Jest's transitive copy to 3.15.2 and ESLint's to
4.3.2. Updates the existing fix rather than opening a duplicate; no
runtime dependencies added and no major-version overrides.

Addresses Dependabot alerts
[#398](https://github.com/langchain-ai/langgraph/security/dependabot/398)
and
[#397](https://github.com/langchain-ai/langgraph/security/dependabot/397).
These are real vulnerable versions in example development tooling; patch
rather than dismiss. Alerts remain open until this reaches `main` and
GitHub rescans.

## Verification
- [x] Yarn 1.22.22 regenerated the lockfile with lifecycle scripts
disabled; diff limited to the two js-yaml entries and scoped
resolutions.
- [x] `yarn install --frozen-lockfile --ignore-scripts --force
--non-interactive` in `libs/cli/js-examples`.
- [x] `yarn why js-yaml`: ESLint 4.3.2 and Jest/Istanbul 3.15.2.
- [x] Resolved versions checked against freshly retrieved GitHub
advisory patched versions for both alerts.
- [x] `yarn format:check` and `git diff --check`.
- [ ] Build fails in unchanged `tests/grap

**File**: `libs/cli/js-examples/package.json` (modified, +3/-1)
```diff
@@ -25,7 +25,9 @@
     "@langchain/langgraph": "^1.4.13"
   },
   "resolutions": {
-    "@langchain/langgraph-checkpoint": "1.0.4"
+    "@langchain/langgraph-checkpoint": "1.0.4",
+    "jest/**/js-yaml": "3.15.2",
+    "@eslint/eslintrc/js-yaml": "4.3.2"
   },
   "devDependencies": {
     "@eslint/eslintrc": "^3.3.6",
```

**File**: `libs/cli/js-examples/yarn.lock` (modified, +8/-8)
```diff
@@ -3744,18 +3744,18 @@ js-tokens@^4.0.0:
   resolved "https://registry.yarnpkg.com/js-tokens/-/js-tokens-4.0.0.tgz#19203fb59991df98e3a287050d4647cdeaf32499"
   integrity sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==
 
-js-yaml@^3.13.1:
-  version "3.14.2"
-  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-3.14.2.tgz#77485ce1dd7f33c061fd1b16ecea23b55fcb04b0"
-  integrity sha512-PMSmkqxr106Xa156c2M265Z+FTrPl+oxd/rgOQy2tijQeK5TxQ43psO1ZCwhVOSdnn+RzkzlRz/eY4BgJBYVpg==
+js-yaml@3.15.2, js-yaml@^3.13.1:
+  version "3.15.2"
+  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-3.15.2.tgz#3f83823ac6be17f570f23b2ecdef3777ff5ea364"
+  integrity sha512-6EuL879VkRA+1Cz578mKMiKvjPNEuk6+r1JaFzoSWejZmtf7xWbIyw1e3KkxlkzTIt9Taw6JBhEppG7utc1P+w==
   dependencies:
     argparse "^1.0.7"
     esprima "^4.0.0"
 
-js-yaml@^4.3.0:
-  version "4.3.1"
-  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-4.3.1.tgz#01216c001d67f48e2cd560d708c7af21090a3848"
-  integrity sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==
+js-yaml@4.3.2, js-yaml@^4.3.0:
+  version "4.3.2"
+  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-4.3.2.tgz#8e44fb14a2643c59726bb15787b5f1512cb3d3fb"
+  integrity sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==
   dependencies:
     argparse "^2.0.1"
 
```

---

### Incident Patch 7: `0199b519` (2026-09-08)
**Commit Message**: fix(cli): clarify missing deploy config (#8854)

Shows an actionable, docs-linked error when `langgraph deploy` is run
without a `langgraph.json` instead of exposing a traceback.

**File**: `libs/cli/langgraph_cli/deploy.py` (modified, +10/-0)
```diff
@@ -1603,6 +1603,16 @@ def _deploy_cmd(
 
     # -- 1. Preflight --
     validate_deploy_commands(install_command, build_command)
+    if not config.exists():
+        message = (
+            "We couldn't find a langgraph.json file. Run `langgraph deploy` from "
+            "the root of a LangSmith Deployment project. To get started, visit "
+            "https://docs.langchain.com/langsmith/deployment-quickstart."
+        )
+        if json_output:
+            em.error(message)
+            raise click.exceptions.Exit(1)
+        raise click.ClickException(message)
     config_json = langgraph_cli.config.validate_config_file(config)
     warn_non_wolfi_distro(config_json, emit=em.note)
 
```

**File**: `libs/cli/tests/unit_tests/cli/test_cli.py` (modified, +25/-0)
```diff
@@ -320,6 +320,31 @@ def test_top_level_help_truncates_command_descriptions_to_single_line() -> None:
     assert "[Beta] List LangSmith Deployments." in deploy_list_line
 
 
+def test_deploy_missing_config_shows_actionable_error(tmp_path, monkeypatch) -> None:
+    runner = CliRunner()
+    monkeypatch.chdir(tmp_path)
+
+    result = runner.invoke(cli, ["deploy"])
+
+    assert result.exit_code == 1
+    assert "We couldn't find a langgraph.json file." in result.output
+    assert "Run `langgraph deploy` from the root" in result.output
+    assert "https://docs.langchain.com/langsmith/deployment-quickstart" in result.output
+    assert "Traceback" not in result.output
+
+
+def test_deploy_missing_config_emits_json_error(tmp_path, monkeypatch) -> None:
+    runner = CliRunner()
+    monkeypatch.chdir(tmp_path)
+
+    result = runner.invoke(cli, ["deploy", "--json"])
+
+    assert result.exit_code == 1
+    events = [json.loads(line) for line in result.output.splitlines()]
+    assert events[-1]["event"] == "error"
+    assert "We couldn't find a langgraph.json file." in events[-1]["message"]
+
+
 def test_dev_command_requires_ssl_certfile_and_keyfile_together(tmp_path) -> None:
     config_path = tmp_path / "langgraph.json"
     config_path.write_text(
```

---

### Incident Patch 8: `81bf17b2` (2026-09-03)
**Commit Message**: fix(langgraph): type undeclared v3 stream projections (#8596)

**File**: `libs/langgraph/langgraph/stream/run_stream.py` (modified, +57/-11)
```diff
@@ -3,7 +3,7 @@
 import asyncio
 from collections.abc import AsyncIterator, Awaitable, Callable, Iterator, Mapping
 from types import MappingProxyType, TracebackType
-from typing import TYPE_CHECKING, Any
+from typing import TYPE_CHECKING, Any, NoReturn
 
 from langchain_core._api import beta
 
@@ -33,6 +33,26 @@ async def _adrive_until_done(pump: Callable[[], Awaitable[bool]]) -> None:
         pass
 
 
+def _raise_missing_projection(run: object, name: str) -> NoReturn:
+    """Raise after normal attribute lookup fails for a projection.
+
+    Registered native projections are installed directly on the run instance
+    during `__init__`, so `__getattr__` is never called for them. At this point
+    the requested name is necessarily missing; the mux is inspected only to
+    include the valid registered projection names in the error message.
+
+    Read `_mux` directly from `__dict__` because it may not exist yet on a
+    partially initialized instance. Accessing `run._mux` in that case would
+    invoke `__getattr__` again and recurse indefinitely.
+    """
+    mux = run.__dict__.get("_mux")
+    registered = sorted(mux.native_keys) if mux is not None else []
+    raise AttributeError(
+        f"{type(run).__name__!r} object has no attribute {name!r} "
+        f"(registered projections: {', '.join(registered) or 'none'})"
+    )
+
+
 @beta(message="The v3 streaming protocol on Pregel is experimental.")
 class GraphRunStream:
     """Sync run stream with caller-driven pumping.
@@ -54,15 +74,32 @@ class GraphRunStream:
         experimental and may change.
     """
 
-    # Native projections always registered by `stream_events(version="v3")`.
-    # Attached dynamically by the `setattr` loop in `__init__`; declared here
-    # so type checkers see them. Opt-in native projections (`updates`,
-    # `custom`, `checkpoints`, `debug`, `tasks`) are only present when their
-    # transformer is registered, so they are reached via `extensions[...]`.
+    # Native projections, attached dynamically by the `setattr` loop in
+    # `__init__` and declared here so type checkers see them.
+    #
+    # Always registered by `stream_events(version="v3")`:
     values: StreamChannel[dict[str, Any]]
     messages: StreamChannel[ChatModelStream]
     lifecycle: StreamChannel[LifecyclePayload]
     subgraphs: StreamChannel[SubgraphRunStream]
+    # Registered on demand via `compile(transformers=...)` or
+    # `stream_events(transformers=...)`; reading one whose transformer was not
+    # registered raises AttributeError. Projections contributed by transformers
+    # outside this package are covered by `__getattr__` instead.
+    updates: StreamChannel[dict[str, Any]]
+    custom: StreamChannel[Any]
+    checkpoints: StreamChannel[dict[str, Any]]
+    debug: StreamChannel[dict[str, Any]]
+    tasks: StreamChannel[dict[str, Any]]
+
+    def __getattr__(self, name: str) -> StreamChannel[Any]:
+        """Type the projections of transformers declared outside this package.
+
+        Projection names come from a registry, so no annotation here can name
+        them all. The cost is that a misspelling type-checks too, and fails at
+        runtime instead.
+        """
+        _raise_missing_projection(self, name)
 
     def __init__(
         self,
@@ -345,15 +382,24 @@ class AsyncGraphRunStream:
         experimental and may change.
     """
 
-    # Native projections always registered by `astream_events(version="v3")`.
-    # Attached dynamically by the `setattr` loop in `__init__`; declared here
-    # so type checkers see them. Opt-in native projections (`updates`,
-    # `custom`, `checkpoints`, `debug`, `tasks`) are only present when their
-    # transformer is registered, so they are reached via `extensions[...]`.
+    # Native projections, attached dynamically by the `setattr` loop in
+    # `__init__` and declared here so type checkers see them.
+    #
+    # Always registered by `astream_events(version="v3")`:
     values: StreamC
```

**File**: `libs/langgraph/tests/test_stream_events_v3.py` (modified, +99/-0)
```diff
@@ -6,6 +6,7 @@
 
 from __future__ import annotations
 
+import copy
 import operator
 import sys
 from dataclasses import dataclass
@@ -34,8 +35,10 @@
     GraphRunStream,
     LifecyclePayload,
     StreamChannel,
+    StreamTransformer,
     SubgraphRunStream,
 )
+from langgraph.stream._types import ProtocolEvent
 from langgraph.types import (
     CheckpointPayload,
     CheckpointStreamPart,
@@ -1199,6 +1202,29 @@ def _check_type_narrowing(part: StreamPart[_StateT, _OutputT]) -> None:
 # type and the always-registered native projections.
 
 
+class _MarkerTransformer(StreamTransformer):
+    """Native transformer contributing a key this module doesn't declare.
+
+    Stands in for any transformer defined outside this package — projections
+    whose names `GraphRunStream` can't enumerate, so they resolve through
+    `__getattr__` instead of a class annotation.
+    """
+
+    _native = True
+
+    def __init__(self, scope: tuple[str, ...] = ()) -> None:
+        super().__init__(scope)
+        self._log: StreamChannel[str] = StreamChannel()
+
+    def init(self) -> dict[str, Any]:
+        return {"marker": self._log}
+
+    def process(self, event: ProtocolEvent) -> bool:
+        if event["method"] == "values":
+            self._log.push("saw_values")
+        return True
+
+
 def _check_stream_events_v3_typing() -> None:
     """Compile-time checks for sync v3 typing — never called at runtime."""
     graph = _make_simple_graph().compile()
@@ -1208,6 +1234,16 @@ def _check_stream_events_v3_typing() -> None:
     assert_type(run.messages, StreamChannel[ChatModelStream])
     assert_type(run.lifecycle, StreamChannel[LifecyclePayload])
     assert_type(run.subgraphs, StreamChannel[SubgraphRunStream])
+    # Opt-in projections from transformers this package ships carry their real
+    # item type even though they are only present once registered.
+    assert_type(run.updates, StreamChannel[dict[str, Any]])
+    assert_type(run.custom, StreamChannel[Any])
+    assert_type(run.checkpoints, StreamChannel[dict[str, Any]])
+    assert_type(run.debug, StreamChannel[dict[str, Any]])
+    assert_type(run.tasks, StreamChannel[dict[str, Any]])
+    # Projections this module can't enumerate resolve through `__getattr__`
+    # as `StreamChannel[Any]` rather than failing with attr-defined.
+    assert_type(run.marker, StreamChannel[Any])
 
 
 async def _check_astream_events_v3_typing() -> None:
@@ -1219,3 +1255,66 @@ async def _check_astream_events_v3_typing() -> None:
     assert_type(run.messages, StreamChannel[AsyncChatModelStream])
     assert_type(run.lifecycle, StreamChannel[LifecyclePayload])
     assert_type(run.subgraphs, StreamChannel[AsyncSubgraphRunStream])
+    assert_type(run.updates, StreamChannel[dict[str, Any]])
+    assert_type(run.custom, StreamChannel[Any])
+    assert_type(run.checkpoints, StreamChannel[dict[str, Any]])
+    assert_type(run.debug, StreamChannel[dict[str, Any]])
+    assert_type(run.tasks, StreamChannel[dict[str, Any]])
+    assert_type(run.marker, StreamChannel[Any])
+
+
+def test_undeclared_native_projection_is_attached() -> None:
+    """A native projection this module doesn't declare still works at runtime.
+
+    `__getattr__` is a type-checker fallback only — it must not shadow the
+    `setattr` loop that attaches registered native projections.
+    """
+    graph = _make_simple_graph().compile()
+    run = graph.stream_events(
+        _SIMPLE_INPUT, version="v3", transformers=[_MarkerTransformer]
+    )
+
+    marker_iter = iter(run.marker)
+    assert run.output is not None
+    assert run.marker is run.extensions["marker"]
+    assert "saw_values" in list(marker_iter)
+
+
+def test_unregistered_projection_raises_attribute_error() -> None:
+    """An unregistered projection name still fails at runtime.
+
+    The `__getattr__` fallback exists to satisfy type checkers; it must not
+    make unknown names resolve to anything. The message lists what *is*
+    registered so a typo is diagn
```

---

### Incident Patch 9: `11ee1859` (2026-08-28)
**Commit Message**: fix(checkpoint): widen `Store` `put` value type to `Mapping[str, Any]` (#8617)

TypedDict values don't structurally satisfy dict[str, Any] since dict
implies full mutability. Mapping[str, Any] accepts both plain dicts and
TypedDicts while still requiring string keys, matching what put()
actually needs from callers.

Fixes #8616

Verified by running lint/type/test locally across checkpoint,
checkpoint-sqlite, checkpoint-postgres, prebuilt, sdk-py, and a scoped
langgraph subset.

LinkedIn: https://linkedin.com/in/lisandro-navarra

---------

Co-authored-by: Mason Daugherty <github@mdrxy.com>

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@ __pypackages__/
 
 # Environments
 .env
+.env.*
 .envrc
 *.crt
 *.key
```

**File**: `libs/checkpoint-postgres/langgraph/store/postgres/base.py` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@
 import re
 import threading
 from collections import defaultdict
-from collections.abc import Callable, Iterable, Iterator, Sequence
+from collections.abc import Callable, Iterable, Iterator, Mapping, Sequence
 from contextlib import contextmanager
 from datetime import datetime
 from typing import (
@@ -354,7 +354,7 @@ def _prepare_batch_PUT_queries(
                     (
                         _namespace_to_text(op.namespace),
                         op.key,
-                        Jsonb(cast(dict, op.value)),
+                        Jsonb(dict(cast(Mapping[str, Any], op.value))),
                     )
                 )
                 if op.ttl is not None:
```

**File**: `libs/checkpoint-sqlite/langgraph/store/sqlite/base.py` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@
 import sqlite3
 import threading
 from collections import defaultdict
-from collections.abc import Callable, Iterable, Iterator, Sequence
+from collections.abc import Callable, Iterable, Iterator, Mapping, Sequence
 from contextlib import contextmanager
 from typing import Any, Literal, NamedTuple, cast
 
@@ -387,7 +387,7 @@ def _prepare_batch_PUT_queries(
                     [
                         _namespace_to_text(op.namespace),
                         op.key,
-                        orjson.dumps(cast(dict, op.value)),
+                        orjson.dumps(dict(cast(Mapping[str, Any], op.value))),
                         expires_at,
                         op.ttl,
                     ]
```

**File**: `libs/checkpoint/langgraph/store/base/__init__.py` (modified, +7/-7)
```diff
@@ -12,7 +12,7 @@
 from __future__ import annotations
 
 from abc import ABC, abstractmethod
-from collections.abc import Iterable
+from collections.abc import Iterable, Mapping
 from datetime import datetime
 from typing import (
     Any,
@@ -473,10 +473,10 @@ class PutOp(NamedTuple):
         the full path would effectively be `"documents/user123/report1"`
     """
 
-    value: dict[str, Any] | None
+    value: Mapping[str, Any] | None
     """The data to store, or `None` to mark the item for deletion.
 
-    The value must be a dictionary with string keys and JSON-serializable values.
+    The value must be a mapping with string keys and JSON-serializable values.
     Setting this to `None` signals that the item should be deleted.
 
     Example:
@@ -857,7 +857,7 @@ def put(
         self,
         namespace: tuple[str, ...],
         key: str,
-        value: dict[str, Any],
+        value: Mapping[str, Any],
         index: Literal[False] | list[str] | None = None,
         *,
         ttl: float | None | NotProvided = NOT_PROVIDED,
@@ -869,7 +869,7 @@ def put(
                 Example: `("documents", "user123")`
             key: Unique identifier within the namespace. Together with namespace forms
                 the complete path to the item.
-            value: Dictionary containing the item's data. Must contain string keys
+            value: Mapping containing the item's data. Must contain string keys
                 and JSON-serializable values.
             index: Controls how the item's fields are indexed for search:
 
@@ -1110,7 +1110,7 @@ async def aput(
         self,
         namespace: tuple[str, ...],
         key: str,
-        value: dict[str, Any],
+        value: Mapping[str, Any],
         index: Literal[False] | list[str] | None = None,
         *,
         ttl: float | None | NotProvided = NOT_PROVIDED,
@@ -1122,7 +1122,7 @@ async def aput(
                 Example: `("documents", "user123")`
             key: Unique identifier within the namespace. Together with namespace forms
                 the complete path to the item.
-            value: Dictionary containing the item's data. Must contain string keys
+            value: Mapping containing the item's data. Must contain string keys
                 and JSON-serializable values.
             index: Controls how the item's fields are indexed for search:
 
```

**File**: `libs/checkpoint/langgraph/store/base/batch.py` (modified, +3/-3)
```diff
@@ -5,7 +5,7 @@
 import asyncio
 import functools
 import weakref
-from collections.abc import Callable, Iterable
+from collections.abc import Callable, Iterable, Mapping
 from typing import Any, Literal, TypeVar
 
 from langgraph.store.base import (
@@ -132,7 +132,7 @@ async def aput(
         self,
         namespace: tuple[str, ...],
         key: str,
-        value: dict[str, Any],
+        value: Mapping[str, Any],
         index: Literal[False] | list[str] | None = None,
         *,
         ttl: float | None | NotProvided = NOT_PROVIDED,
@@ -231,7 +231,7 @@ def put(
         self,
         namespace: tuple[str, ...],
         key: str,
-        value: dict[str, Any],
+        value: Mapping[str, Any],
         index: Literal[False] | list[str] | None = None,
         *,
         ttl: float | None | NotProvided = NOT_PROVIDED,
```

---

### Incident Patch 10: `bdb8a9c7` (2026-08-26)
**Commit Message**: feat: route LangSmith traces from thread streams (#8723)

## Description
Expose the existing `langsmith_tracing` option on Python sync and async
thread-stream run starts and forward it through the protocol.

## Release Note
Python thread streams can route traces to an additional LangSmith
project per run.

## Test Plan
- [x] Verify sync and async run-start payloads include tracing settings

## Related PRs
- langchain-ai/agent-protocol#95
- langchain-ai/langgraphjs#2745
- langchain-ai/langgraph-api#4033

Made by [Open
SWE](https://openswe.vercel.app/agents/f9e34294-b9c3-52f0-815a-0102188e1181)

Co-authored-by: open-swe[bot] <open-swe@users.noreply.github.com>

**File**: `libs/sdk-py/langgraph_sdk/_async/stream.py` (modified, +4/-1)
```diff
@@ -24,7 +24,7 @@
 from langchain_protocol import Event, SubscribeParams
 
 from langgraph_sdk._async.http import HttpClient
-from langgraph_sdk.schema import QueryParamTypes
+from langgraph_sdk.schema import LangSmithTracing, QueryParamTypes
 from langgraph_sdk.stream.controller import _SeenEventIds
 from langgraph_sdk.stream.decoders import (
     DataDecoder,
@@ -172,6 +172,7 @@ async def start(
         input: Any = None,
         config: dict[str, Any] | None = None,
         metadata: dict[str, Any] | None = None,
+        langsmith_tracing: LangSmithTracing | None = None,
     ) -> dict[str, Any]:
         """Send `run.start` to the server. Returns the result (`{"run_id": ...}`)."""
         params: dict[str, Any] = {"assistant_id": self._owner.assistant_id}
@@ -181,6 +182,8 @@ async def start(
             params["config"] = config
         if metadata is not None:
             params["metadata"] = metadata
+        if langsmith_tracing is not None:
+            params["langsmith_tracer"] = langsmith_tracing
         loop = asyncio.get_running_loop()
         gate: asyncio.Future[None] = loop.create_future()
         self._owner._run_start_ready = gate
```

**File**: `libs/sdk-py/langgraph_sdk/_sync/stream.py` (modified, +4/-1)
```diff
@@ -23,7 +23,7 @@
 from langchain_protocol import Event, SubscribeParams
 
 from langgraph_sdk._sync.http import SyncHttpClient
-from langgraph_sdk.schema import QueryParamTypes
+from langgraph_sdk.schema import LangSmithTracing, QueryParamTypes
 from langgraph_sdk.stream.decoders import (
     DataDecoder,
     Decoder,
@@ -215,6 +215,7 @@ def start(
         input: Any = None,
         config: dict[str, Any] | None = None,
         metadata: dict[str, Any] | None = None,
+        langsmith_tracing: LangSmithTracing | None = None,
     ) -> dict[str, Any]:
         """Send `run.start` to the server. Returns the result (`{"run_id": ...}`)."""
         params: dict[str, Any] = {"assistant_id": self._owner.assistant_id}
@@ -224,6 +225,8 @@ def start(
             params["config"] = config
         if metadata is not None:
             params["metadata"] = metadata
+        if langsmith_tracing is not None:
+            params["langsmith_tracer"] = langsmith_tracing
         result = self._owner._send_command("run.start", params)
         self._owner._run_seen = True
         controller = self._owner._controller
```

**File**: `libs/sdk-py/tests/streaming/test_sync_thread_stream.py` (modified, +7/-1)
```diff
@@ -426,11 +426,17 @@ def test_sync_run_start_sends_command():
     with httpx.Client(transport=fake.transport, base_url="http://test") as raw:
         threads = SyncThreadsClient(SyncHttpClient(raw))
         with threads.stream(thread_id="t-1", assistant_id="agent") as thread:
-            result = thread.run.start(input={"x": 1})
+            result = thread.run.start(
+                input={"x": 1},
+                langsmith_tracing={"project_name": "replica-project"},
+            )
 
     assert result == {"run_id": "run-1"}
     assert fake.received_commands[0]["method"] == "run.start"
     assert fake.received_commands[0]["params"]["assistant_id"] == "agent"
+    assert fake.received_commands[0]["params"]["langsmith_tracer"] == {
+        "project_name": "replica-project"
+    }
 
 
 def test_sync_events_iterates_raw_events():
```

**File**: `libs/sdk-py/tests/streaming/test_thread_stream.py` (modified, +9/-1)
```diff
@@ -287,7 +287,7 @@ async def test_command_ids_are_monotonic():
     assert [c["id"] for c in fake.received_commands] == [1, 2]
 
 
-async def test_run_start_forwards_config_and_metadata():
+async def test_run_start_forwards_config_metadata_and_langsmith_tracing():
     fake = FakeServer()
     transport = httpx.ASGITransport(app=fake.app)
     async with httpx.AsyncClient(transport=transport, base_url="http://test") as raw:
@@ -297,10 +297,18 @@ async def test_run_start_forwards_config_and_metadata():
                 input={"x": 1},
                 config={"recursion_limit": 5},
                 metadata={"trace": "abc"},
+                langsmith_tracing={
+                    "project_name": "replica-project",
+                    "example_id": "example-1",
+                },
             )
     params = fake.received_commands[0]["params"]
     assert params["config"] == {"recursion_limit": 5}
     assert params["metadata"] == {"trace": "abc"}
+    assert params["langsmith_tracer"] == {
+        "project_name": "replica-project",
+        "example_id": "example-1",
+    }
 
 
 async def test_run_start_raises_outside_context_manager():
```

#### Recent Merged Pull Requests:
- **PR #9127** (closed): fix(checkpoint): serialize nested class names with __qualname__ so they survive a round-trip (@nanhe17)
- **PR #9126** (2026-09-30): chore(deps): bump pyjwt from 2.13.0 to 2.14.0 in /libs/langgraph (@dependabot[bot])
- **PR #9125** (closed): chore(deps): bump pyjwt from 2.13.0 to 2.14.0 in /libs/cli (@dependabot[bot])
- **PR #9124** (2026-09-30): fix(ci): test locally-built wheel and publish to test pypi after pre-release checks (@ccurme)
- **PR #9123** (closed): fix(cli): correct local requirements.txt lines in generated Dockerfile (@HelmiDev03)
- **PR #9121** (closed): docs(examples): add tool-boundary invariant hardening guide for customer support (@zariffromlatif)
- **PR #9119** (closed): fix(checkpoint-sqlite): encode namespaces with JSON, not comma-join (@KaiyiQuan)
- **PR #9117** (closed): fix(checkpoint-postgres): preserve newer state after cancelled runs (@1fanwang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
