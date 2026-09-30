# Forensic Learning Record (Deep Inspection): deepset-ai/haystack

> **Canonical Artifact**: `07_PROJECT_LEARNING/deepset-ai-haystack-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/deepset-ai/haystack](https://github.com/deepset-ai/haystack))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:22.958Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `deepset-ai/haystack`
- **Description**: Open-source AI orchestration framework for building context-engineered, production-ready LLM applications. Design modular pipelines and agent workflows with explicit control over retrieval, routing, memory, and generation. Built for scalable agents, RAG, multimodal applications, semantic search, and conversational systems.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 26632 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/__init__.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

```

### Core Architecture Module: `haystack/__init__.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

# We avoid lazy imports here because:
# - they create potential static type checking issues which are hard to debug
# - they make this module more complicated and hard to maintain
# - they offer minimal performance gains in this case.

import haystack.logging

# Imported so the `haystack.tracing` namespace is available after `import haystack`.
import haystack.tracing  # noqa: F401
from haystack.core.component import component
from haystack.core.errors import ComponentError, DeserializationError
from haystack.core.pipeline import Pipeline
from haystack.core.serialization import default_from_dict, default_to_dict
from haystack.core.super_component.super_component import SuperComponent, super_component
from haystack.dataclasses import Answer, Document, ExtractedAnswer, GeneratedAnswer
from haystack.version import __version__  # noqa: F401

# Initialize the logging configuration.
# This is a no-op unless `structlog` is installed. `configure_structlog=False` means we only install our own scoped
# logging handler (so Haystack's logs are formatted) without touching the process-global `structlog` configuration.
haystack.logging.configure_logging(configure_structlog=False)

__all__ = [
    "Answer",
    "ComponentError",
    "DeserializationError",
    "Document",
    "ExtractedAnswer",
    "GeneratedAnswer",
    "Pipeline",
    "SuperComponent",
    "super_component",
    "component",
    "default_from_dict",
    "default_to_dict",
]

```

### Core Architecture Module: `haystack/components/__init__.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

```

### Core Architecture Module: `haystack/components/agents/__init__.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

import sys
from typing import TYPE_CHECKING

from lazy_imports import LazyImporter

_import_structure = {"agent": ["Agent"], "state": ["State"]}

if TYPE_CHECKING:
    from .agent import Agent as Agent
    from .state import State as State

else:
    sys.modules[__name__] = LazyImporter(name=__name__, module_file=__file__, import_structure=_import_structure)

```

### Core Architecture Module: `haystack/components/agents/agent.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

import inspect
from dataclasses import dataclass
from typing import Any, Literal, cast

from haystack import component, logging, tracing
from haystack.components.agents.state.state import (
    State,
    _schema_from_dict,
    _schema_to_dict,
    _validate_schema,
    replace_values,
)
from haystack.components.agents.state.state_utils import merge_lists
from haystack.components.agents.tool_calling import _run_tool, _run_tool_async
from haystack.components.agents.utils import (
    _record_context_tokens,
    _record_llm_usage,
    _record_tool_calls,
    _render_prompt_messages,
    _select_tools_by_name,
    _spawn_tools,
    _template_for_role,
    _validate_prompt_message_blocks,
)
from haystack.components.builders import ChatPromptBuilder
from haystack.components.generators.chat.types import ChatGenerator
from haystack.core.serialization import component_to_dict, default_from_dict, default_to_dict
from haystack.dataclasses import ChatMessage, ChatRole, StreamingCallbackT, select_streaming_callback
from haystack.hooks.invocation import _run_hooks, _run_hooks_async
from haystack.hooks.protocol import (
    AFTER_RUN,
    AFTER_TOOL,
    BEFORE_LLM,
    BEFORE_RUN,
    BEFORE_TOOL,
    ON_EXIT,
    VALID_HOOK_POINTS,
    Hook,
    HookPoint,
)
from haystack.hooks.utils import (
    _deserialize_hooks_dictionary,
    _serialize_hooks_dictionary,
    close_hooks,
    close_hooks_async,
    warm_up_hooks,
    warm_up_hooks_async,
)
from haystack.tools import (
    Toolset,
    ToolsType,
    _check_duplicate_tool_names,
    deserialize_tools_or_toolset_inplace,
    flatten_tools_or_toolsets,
    serialize_tools_or_toolset,
    warm_up_tools,
)
from haystack.utils.async_utils import _execute_component_async
from haystack.utils.callable_serialization import deserialize_callable, serialize_callable
from haystack.utils.deserialization import deserialize_component_inplace

logger = logging.getLogger(__name__)

# `exit_reason` values the Agent sets when it stops without a tool exit condition: a tool-call-free reply, an
# incomplete model generation, or the `max_agent_steps` budget running out.
_EXIT_REASON_TEXT = "text"
_EXIT_REASON_LENGTH = "length"
_EXIT_REASON_CONTENT_FILTER = "content_filter"
_EXIT_REASON_MAX_STEPS = "max_agent_steps"

# Run-metadata state keys the Agent populates automatically during a run. Users may not define them in their own
# `state_schema`, and they are exposed as Agent outputs only (not inputs).
_RUN_METADATA_STATE_KEYS: dict[str, dict[str, Any]] = {
    "step_count": {"type": int, "handler": replace_values},
    "token_usage": {"type": dict[str, Any], "handler": replace_values},
    "tool_call_counts": {"type": dict[str, int], "handler": replace_values},
    "exit_reason": {"type": str, "handler": replace_values},
}

# Internal state keys the Agent manages for run control and hooks. Like run-metadata keys they are reserved and cannot
# be redefined by users, but unlike them they are NOT exposed as Agent inputs or outputs (purely internal state):
# - `continue_run`: set by an `on_exit` hook to keep the Agent running instead of stopping (re-read each exit attempt).
# - `stop_run`: set by a hook to stop the run, read before each LLM call and used as the `exit_reason`.
# - `tools`: the flattened tools available in the current step, so a hook can inspect them (e.g. HITL confirmation).
# - `hook_context`: per-run request-scoped resources passed to `run`/`run_async` for hooks to read.
# - `context_tokens`: approximate current context-window size, refreshed after each LLM call, for hooks to read
#   (e.g. a `before_llm` hook that triggers compaction once the context grows too large). Kept internal rather than
#   exposed as an output because it is a best-effort snapshot; see `_record_context_tokens`.
_INTERNAL_STATE_KEYS: dict[str, dict[str, Any]] = {
    "continue_run": {"type": bool, "handler": replace_values},
    "stop_run": {"type": str, "handler": replace_values},
    "tools": {"type": list, "handler": replace_values},
    "hook_context": {"type": dict[str, Any], "handler": replace_values},
    "context_tokens": {"type": int, "handler": replace_values},
}


def _get_run_method_params(instance: "Agent") -> set[str]:
    """Derive the parameter names of the Agent.run method via introspection."""
    sig = inspect.signature(instance.run)
    return {name for name, p in sig.parameters.items() if p.kind != inspect.Parameter.VAR_KEYWORD}


def _public_outputs(state: State) -> dict[str, Any]:
    """Return the State data excluding the internal state keys (i.e. the Agent's user-facing outputs)."""
    return {key: value for key, value in state.data.items() if key not in _INTERNAL_STATE_KEYS}


def _validate_hooks(hooks: dict[HookPoint, list[Hook]]) -> None:
    """
    Validate a hooks mapping: known hook points, real Hook objects, and hook-point restrictions.

    :param hooks: Mapping of hook point to the hooks registered under it.
    :raises ValueError: If a hook point is unknown, or a hook is registered under a hook point it does not support.
    :raises TypeError: If a registered hook has no callable `run(state)`.
    """
    for hook_point, hook_list in hooks.items():
        if hook_point not in VALID_HOOK_POINTS:
            raise ValueError(
                f"Invalid hook point '{hook_point}'. Valid hook points are: {', '.join(VALID_HOOK_POINTS)}."
            )
        for h in hook_list:
            if not callable(getattr(h, "run", None)):
                if callable(h):
                    raise TypeError(
                        f"Hook registered for hook point '{hook_point}' is callable but is not a Hook object. "
                        "If it is a function, wrap it with the @hook decorator."
                    )
                raise TypeError(
                    f"Hook registered for hook point '{hook_point}' must have a callable 'run(state)', "
                    f"got an object of type '{type(h).__name__}'."
                )
            # A hook may declare `allowed_hook_points` to restrict where it can run (e.g. ConfirmationHook only
            # makes sense at "before_tool"). Hooks without it can be registered under any hook point.
            allowed_points = getattr(h, "allowed_hook_points", None)
            if allowed_points is not None and hook_point not in allowed_points:
                raise ValueError(
                    f"Hook of type '{type(h).__name__}' is registered under hook point '{hook_point}' but only "
                    f"supports: {', '.join(allowed_points)}."
                )


def _consume_continue_run(state: State) -> bool:
    """Return the `continue_run` control flag and reset it so it does not carry over to the next exit attempt."""
    should_continue = state.data["continue_run"]
    state.set("continue_run", False)
    return should_continue


def _get_model_exit_reason(messages: list[ChatMessage]) -> str | None:
    """
    Return the exit reason for a terminal assistant reply without tool calls.

    Incomplete generation reasons take precedence over text so callers can distinguish a partial response from a
    complete answer. An empty response without a recognized terminal reason does not trigger an exit, preserving the
    Agent's recovery behavior for malformed tool calls that a Chat Generator discarded.
    """
    # If the messages list is empty or the last message has tool calls, don't exit.
    if not messages or any(message.tool_call for message in messages):
        return None

    last = messages[-1]

    # If the last message is not from the assistant, don't exit.
    if not last.is_from(ChatRole.ASSISTANT):
        return None

    # If the finish reason on the last message is length or content_filter, exit with that reason.
    if last.meta.get("finish_reason") == _EXIT_REASON_LENGTH:
        return _EXIT_REASON_LENGTH
    if last.meta.get("finish_re
```

### Core Architecture Module: `haystack/components/agents/state/__init__.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

import sys
from typing import TYPE_CHECKING

from lazy_imports import LazyImporter

_import_structure = {"state": ["State", "merge_lists", "replace_values"]}

if TYPE_CHECKING:
    from .state import State as State
    from .state_utils import merge_lists as merge_lists
    from .state_utils import replace_values as replace_values

else:
    sys.modules[__name__] = LazyImporter(name=__name__, module_file=__file__, import_structure=_import_structure)

```

### Core Architecture Module: `haystack/components/agents/state/state.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

from collections.abc import Callable
from copy import deepcopy
from typing import Any, get_args

from haystack.dataclasses import ChatMessage
from haystack.utils import _deserialize_value_with_schema
from haystack.utils.base_serialization import _serialize_with_field_fallback
from haystack.utils.callable_serialization import deserialize_callable, serialize_callable
from haystack.utils.type_serialization import deserialize_type, serialize_type

from .state_utils import _is_list_type, _is_valid_type, merge_lists, replace_values


def _schema_to_dict(schema: dict[str, Any]) -> dict[str, Any]:
    """
    Convert a schema dictionary to a serializable format.

    Converts each parameter's type and optional handler function into a serializable
    format using type and callable serialization utilities.

    :param schema: Dictionary mapping parameter names to their type and handler configs
    :returns: Dictionary with serialized type and handler information
    """
    serialized_schema = {}
    for param, config in schema.items():
        serialized_schema[param] = {"type": serialize_type(config["type"])}
        if config.get("handler"):
            serialized_schema[param]["handler"] = serialize_callable(config["handler"])

    return serialized_schema


def _schema_from_dict(schema: dict[str, Any]) -> dict[str, Any]:
    """
    Convert a serialized schema dictionary back to its original format.

    Deserializes the type and optional handler function for each parameter from their
    serialized format back into Python types and callables.

    :param schema: Dictionary containing serialized schema information
    :returns: Dictionary with deserialized type and handler configurations
    """
    deserialized_schema = {}
    for param, config in schema.items():
        deserialized_schema[param] = {"type": deserialize_type(config["type"])}

        if config.get("handler"):
            deserialized_schema[param]["handler"] = deserialize_callable(config["handler"])

    return deserialized_schema


def _validate_schema(schema: dict[str, Any]) -> None:
    """
    Validate that a schema dictionary meets all required constraints.

    Checks that each parameter definition has a valid type field and that any handler
    specified is a callable function.

    :param schema: Dictionary mapping parameter names to their type and handler configs
    :raises ValueError: If schema validation fails due to missing or invalid fields
    """
    for param, definition in schema.items():
        if "type" not in definition:
            raise ValueError(f"StateSchema: Key '{param}' is missing a 'type' entry.")
        if not _is_valid_type(definition["type"]):
            raise ValueError(f"StateSchema: 'type' for key '{param}' must be a Python type, got {definition['type']}")
        if definition.get("handler") is not None and not callable(definition["handler"]):
            raise ValueError(f"StateSchema: 'handler' for key '{param}' must be callable or None")
        if param == "messages":  # definition["type"] != list[ChatMessage] but split to cover also List[ChatMessage]
            if not _is_list_type(definition["type"]):
                raise ValueError(f"StateSchema: 'messages' must be of type list[ChatMessage], got {definition['type']}")
            # Check if the list contains ChatMessage elements
            args = get_args(definition["type"])
            if not args or not issubclass(args[0], ChatMessage):
                raise ValueError(f"StateSchema: 'messages' must be of type list[ChatMessage], got {definition['type']}")


class State:
    """
    State is a container for storing shared information during the execution of an Agent and its tools.

    For instance, State can be used to store documents, context, and intermediate results.

    Internally it wraps a `_data` dictionary defined by a `schema`. Each schema entry has:
    ```json
      "parameter_name": {
        "type": SomeType,  # expected type
        "handler": Optional[Callable[[Any, Any], Any]]  # merge/update function
      }
      ```

    Handlers control how values are merged when using the `set()` method:
    - For list types: defaults to `merge_lists` (concatenates lists)
    - For other types: defaults to `replace_values` (overwrites existing value)

    A `messages` field with type `list[ChatMessage]` is automatically added to the schema.

    This makes it possible for the Agent to read from and write to the same context.

    ### Usage example
    ```python
    from haystack.components.agents.state import State

    my_state = State(
        schema={"gh_repo_name": {"type": str}, "user_name": {"type": str}},
        data={"gh_repo_name": "my_repo", "user_name": "my_user_name"}
    )
    ```
    """

    def __init__(self, schema: dict[str, Any], data: dict[str, Any] | None = None) -> None:
        """
        Initialize a State object with a schema and optional data.

        :param schema: Dictionary mapping parameter names to their type and handler configs.
            Type must be a valid Python type, and handler must be a callable function or None.
            If handler is None, the default handler for the type will be used. The default handlers are:
                - For list types: `haystack.agents.state.state_utils.merge_lists`
                - For all other types: `haystack.agents.state.state_utils.replace_values`
        :param data: Optional dictionary of initial data to populate the state
        """
        _validate_schema(schema)
        self.schema = deepcopy(schema)
        if self.schema.get("messages") is None:
            self.schema["messages"] = {"type": list[ChatMessage], "handler": merge_lists}
        self._data = data or {}

        # Set default handlers if not provided in schema
        for definition in self.schema.values():
            # Skip if handler is already defined and not None
            if definition.get("handler") is not None:
                continue
            # Set default handler based on type
            if _is_list_type(definition["type"]):
                definition["handler"] = merge_lists
            else:
                definition["handler"] = replace_values

    def get(self, key: str, default: Any = None) -> Any:
        """
        Retrieve a value from the state by key.

        :param key: Key to look up in the state
        :param default: Value to return if key is not found
        :returns: Value associated with key or default if not found
        """
        return deepcopy(self._data.get(key, default))

    def set(self, key: str, value: Any, handler_override: Callable[[Any, Any], Any] | None = None) -> None:
        """
        Set or merge a value in the state according to schema rules.

        Value is merged or overwritten according to these rules:
          - if handler_override is given, use that
          - else use the handler defined in the schema for 'key'

        :param key: Key to store the value under
        :param value: Value to store or merge
        :param handler_override: Optional function to override the default merge behavior
        """
        # If key not in schema, we throw an error
        definition = self.schema.get(key, None)
        if definition is None:
            raise ValueError(f"State: Key '{key}' not found in schema. Schema: {self.schema}")

        # Get current value from state and apply handler
        current_value = self._data.get(key, None)
        handler = handler_override or definition["handler"]
        self._data[key] = handler(current_value, value)

    @property
    def data(self) -> dict[str, Any]:
        """
        All current data of the state.
        """
        return self._data

    def has(self, key: str) -> bool:
        """
        Check if a key exists in the state.

        :param key: Key to check for existence
        :returns: True i
```

### Core Architecture Module: `haystack/components/agents/state/state_utils.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

import inspect
from typing import Any, TypeVar, Union, get_origin

from haystack.utils.type_serialization import _is_union_type

T = TypeVar("T")


def _is_valid_type(obj: Any) -> bool:
    """
    Check if an object is a valid type annotation.

    Valid types include:
    - Normal classes (str, dict, CustomClass)
    - Generic types (list[str], dict[str, int])
    - Union types (Union[str, int], Optional[str], str | int, str | None)

    :param obj: The object to check
    :return: True if the object is a valid type annotation, False otherwise

    Example usage:
        # >> _is_valid_type(str)
        # >> True
        # >> _is_valid_type(list[int])
        # >> True
        # >> _is_valid_type(Union[str, int])
        # >> True
        # >> _is_valid_type(str | int)
        # >> True
        # >> _is_valid_type(42)
        # >> False
    """
    # Handle Union types (including Optional)
    if (origin := get_origin(obj)) and _is_union_type(origin):
        return True

    # Bare Union type (without parameters) is not a valid type annotation
    # Previously handled by inspect.isclass(obj) but in python 3.14 this returns True for typing.Union
    if obj == Union:
        return False

    # Handle normal classes and generic types
    return inspect.isclass(obj) or type(obj).__name__ in {"_GenericAlias", "GenericAlias"}


def _is_list_type(type_hint: Any) -> bool:
    """
    Check if a type hint represents a list type.

    :param type_hint: The type hint to check
    :return: True if the type hint represents a list, False otherwise
    """
    return type_hint == list or (hasattr(type_hint, "__origin__") and get_origin(type_hint) == list)


def merge_lists(current: Union[list[T], T, None], new: Union[list[T], T]) -> list[T]:
    """
    Merges two values into a single list.

    If either `current` or `new` is not already a list, it is converted into one.
    The function ensures that both inputs are treated as lists and concatenates them.

    If `current` is None, it is treated as an empty list.

    :param current: The existing value(s), either a single item or a list.
    :param new: The new value(s) to merge, either a single item or a list.
    :return: A list containing elements from both `current` and `new`.
    """
    current_list = [] if current is None else current if isinstance(current, list) else [current]
    new_list = new if isinstance(new, list) else [new]
    return current_list + new_list


def replace_values(current: Any, new: Any) -> Any:  # noqa: ARG001
    """
    Replace the `current` value with the `new` value.

    :param current: The existing value
    :param new: The new value to replace
    :return: The new value
    """
    return new

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13034** (2026-09-30): **Bump unstable version and create unstable docs**
  *Symptoms*: This PR: - Bumps the unstable version to `3.4.0-rc0` - Creates the unstable docs for Haystack 3.3  You can inspect the docs preview (two unstable versions will be available) and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #xI+7nuneYeL7az1a3fYeqvwpCXW7dpuyCwnkg9GqezA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOiJkb2NzLXdlYnNpdGUiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vZGVlcHNldC1haS9oYXlzdGFjay1kb2NzLzNyaWU0ZVI0Q2JhQzk3M0RoSDVDY2ladVVNZVciLCJwcmV2aWV3VXJsIjoiaGF5c3RhY2stZG9jcy1naXQtYnVtcC12ZXJzaW9uLWRlZXBzZXQtYWkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJoYXlzdGFjay1kb2NzLWdpdC1idW1wLXZlcnNpb24tZGVlcHNldC1haS52ZXJjZWwuYXBwIn19XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9ZGVlcHNldC1haSZyZXBvPWhheXN0YWNrJnByPTEzMDM0In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :

- **Issue #13033** (2026-09-30): **docs: sync Core Integrations API reference (monty) on Docusaurus**
  *Symptoms*: This PR syncs the Core Integrations API reference (monty) on Docusaurus. Just approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #JcI+MeL6bVZDjOzT3APRlFjxwHa1H021NaR/8yQvl/U=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJyb290RGlyZWN0b3J5IjoiZG9jcy13ZWJzaXRlIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2RlZXBzZXQtYWkvaGF5c3RhY2stZG9jcy83YXhSYUxkaVpSVWJ4a1B4SjN5VzFyQWFKd3YzIiwicHJldmlld1VybCI6ImhheXN0YWNrLWRvY3MtZ2l0LXN5bmMtZG9jdXNhdXJ1cy1hcGktcmVmZXJlbi00MzkwZGMtZGVlcHNldC1haS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9ZGVlcHNldC1haSZyZXBvPWhheXN0YWNrJnByPTEzMDMzIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :-----

- **Issue #13028** (2026-09-30): **docs: sync Core Integrations API reference (perplexity) on Docusaurus**
  *Symptoms*: This PR syncs the Core Integrations API reference (perplexity) on Docusaurus. Just approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #v9Srmp/Y0LQ44KKvehYvBC9zBTFudd+aMecyN+LQIpk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJyb290RGlyZWN0b3J5IjoiZG9jcy13ZWJzaXRlIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2RlZXBzZXQtYWkvaGF5c3RhY2stZG9jcy85S1VMQWFHb3I1YWUzeDZ0ODFGRXRjdEU1QkpVIiwicHJldmlld1VybCI6ImhheXN0YWNrLWRvY3MtZ2l0LXN5bmMtZG9jdXNhdXJ1cy1hcGktcmVmZXJlbi05Yzk0OTItZGVlcHNldC1haS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9ZGVlcHNldC1haSZyZXBvPWhheXN0YWNrJnByPTEzMDI4In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :-----

- **Issue #13026** (2026-09-30): **fix: handle CR line endings in CSVToDocument row mode**
  *Symptoms*: ### Related Issues  - Fixes #13022.  ### Proposed Changes  `CSVToDocument` row mode raises `_csv.Error` when records use CR (`\r`) separators. Initialize its input stream with `newline=""` so the CSV reader handles LF, CRLF, and CR separators while retaining newline characters inside quoted fields.  Add a parameterized regression test checking document content, author metadata, and row numbers, plus a release note. The public API and file conversion mode are unchanged.  ### How did you test it?  - Before the source fix: the new regression test produced **1 failed / 2 passed**, with the CR case raising the reported error. - `hatch run test:unit test/components/converters/test_csv_to_document.py -q --tb=short --no-cov`: **20 passed**. - `hatch run test:types haystack/components/converters/csv.py test/components/converters/test_csv_to_document.py`: **no issues**. - Scoped `hatch run fmt` and the repository's pre-commit hooks passed on all three changed files. - Python 3.12.14 on macOS arm64, using the official Hatch environments. The full suite and other Python versions were not run locally.  ### Notes for the reviewer  This PR was fully generated with Codex. The assistant reviewed the patch and ran the checks listed above.  ### Checklist  - [x] Read the contribution guidelines and code of conduct. - [x] Included a reproducible issue with the root cause and proposed fix. - [x] Added unit tests; public signatures are unchanged. - [x] Used a conventional
  **Post-Mortem & Fix Analysis**:
  > @Marcuswang0824 is attempting to deploy a commit to the **deepset** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=deepset&slug=deepset-ai&teamId=team_hGnZRfk9LNGNCGLNPQ1EVuL5&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2235ad669ced5474b334a3fde548174d41b7d54572%22%7D%2C%22id%22%3A%22QmRfhMwp8MLuEKqarXLV9oxFGZJ8zNJdkCNojN2QJf5v4N%22%2C%22org%22%3A%22deepset-ai%22%2C%22prId%22%3A13026%2C%22repo%22%3A%22haystack%22%7D).  
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/deepset-ai/haystack?pullRequest=13026) <br/>All committers have signed the CLA.
  > <!-- pr-flood-guard --> Hi @Marcuswang0824, thanks for your interest in contributing to Haystack! :pray:  :warning: Issue #13022 is already being addressed by open pull request(s) #13025. Before opening a PR for an issue, please check whether a PR is already linked to it, and consider contributing to the existing PR instead. We may close duplicate PRs to keep the review queue manageable.  _This is an automated message to help us keep the review queue healthy._

- **Issue #13023** (2026-09-30): **build(deps): bump oss-fuzz-base/base-builder-python from `aac6099` to `ea2c867` in /.clusterfuzzlite**
  *Symptoms*: > [!WARNING] > Cooldown could not be applied because no publication date was available from the registry. >  Bumps oss-fuzz-base/base-builder-python from `aac6099` to `ea2c867`.   Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this dependency` will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)   </details>
  **Post-Mortem & Fix Analysis**:
  > [vc]: #a10bGDJlsLzIoyeZ5Wq8E5NPkLdao8ev7+IVM0Mf+Vc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vZGVlcHNldC1haS9oYXlzdGFjay1kb2NzL0dWN2Q4NnkxUmNnQkZVbjRSZ1pMdjI0ZzkxM3EiLCJwcmV2aWV3VXJsIjoiaGF5c3RhY2stZG9jcy1naXQtZGVwZW5kYWJvdC1kb2NrZXJkb3QtY2x1c3RlLTEyZDA0ZC1kZWVwc2V0LWFpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiSUdOT1JFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwicm9vdERpcmVjdG9yeSI6ImRvY3Mtd2Vic2l0ZSJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9ZGVlcHNldC1haSZyZXBvPWhheXN0YWNrJnByPTEzMDIzIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :-----

- **Issue #13021** (2026-09-29): **fix: store the response charset as encoding in LinkContentFetcher**
  *Symptoms*: ### Related Issues  - fixes #13018  ### Proposed Changes:  `LinkContentFetcher` keeps HTML and other binary responses as raw bytes but drops the charset from the `Content-Type` header, so `HTMLToDocument` decodes a page served as ISO-8859-1 as UTF-8, fails, and skips it.  The binary handler now stores `response.charset_encoding` in the `ByteStream` meta under `encoding`, the key `HTMLToDocument` and the other converters already read. Nothing is stored when the response declares no charset, and text responses are unchanged (httpx decodes them and they are re-encoded as UTF-8).  ### How did you test it?  Sync and async unit tests with a real `httpx.Response` carrying ISO-8859-1 bytes; both fail on main with `KeyError: 'encoding'` and pass with the change. I also ran the fetcher -> `HTMLToDocument` path by hand with a mocked Latin-1 page: it returned `{'documents': []}` before and the document after.  ### Notes for the reviewer  One visible side effect: `encoding` now also appears in the `Document.meta` that `HTMLToDocument` builds from these streams.  ### Checklist  - I have added unit tests and updated the docstrings. - I've used one of the conventional commit types for my PR title. - I have added a release note file.
  **Post-Mortem & Fix Analysis**:
  > @dfedoryshchev is attempting to deploy a commit to the **deepset** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=deepset&slug=deepset-ai&teamId=team_hGnZRfk9LNGNCGLNPQ1EVuL5&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%225d271cc37c39e93e9231e3f9d24dbf37550b52ab%22%7D%2C%22id%22%3A%22QmY7ir8iKUkLhBWNNryrmAeMJF5yu2kQuFRHnSpjgVrjaR%22%2C%22org%22%3A%22deepset-ai%22%2C%22prId%22%3A13021%2C%22repo%22%3A%22haystack%22%7D).  
  > <!-- handled-internally-pr-guard --> Hi @dfedoryshchev, thank you so much for taking the time to work on this! :pray:  Issue #13018 is one our team is handling internally, as noted at the end of its [description](https://github.com/deepset-ai/haystack/issues/13018), so it isn't open for external contributions. To avoid you spending more effort on work that we can't merge, we're closing this PR.

- **Issue #13020** (2026-09-29): **docs: sync Core Integrations API reference (pgvector) on Docusaurus**
  *Symptoms*: This PR syncs the Core Integrations API reference (pgvector) on Docusaurus. Just approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #Cmw2hPH2R0K/Dtdb8hxIIF1woGdDMceZkG+4oJKje+A=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJyb290RGlyZWN0b3J5IjoiZG9jcy13ZWJzaXRlIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2RlZXBzZXQtYWkvaGF5c3RhY2stZG9jcy8yQUhqbXBSUmNLUlkxTHd0TVZtVENIWTd5R0gyIiwicHJldmlld1VybCI6ImhheXN0YWNrLWRvY3MtZ2l0LXN5bmMtZG9jdXNhdXJ1cy1hcGktcmVmZXJlbi1hODE3MTctZGVlcHNldC1haS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9ZGVlcHNldC1haSZyZXBvPWhheXN0YWNrJnByPTEzMDIwIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :-----

- **Issue #13019** (2026-09-29): **docs: sync Core Integrations API reference (langfuse) on Docusaurus**
  *Symptoms*: This PR syncs the Core Integrations API reference (langfuse) on Docusaurus. Just approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #s0JsTBJB+7aq7N+Ad4eOIXAa6Mv55lX4DwK2Ym5karI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vZGVlcHNldC1haS9oYXlzdGFjay1kb2NzL0Z6M21yYVVWZ1Axd0RtYWZ4UlFNQnk3amFENGUiLCJwcmV2aWV3VXJsIjoiaGF5c3RhY2stZG9jcy1naXQtc3luYy1kb2N1c2F1cnVzLWFwaS1yZWZlcmVuLTkyY2U4NC1kZWVwc2V0LWFpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiSUdOT1JFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwicm9vdERpcmVjdG9yeSI6ImRvY3Mtd2Vic2l0ZSJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9ZGVlcHNldC1haSZyZXBvPWhheXN0YWNrJnByPTEzMDE5In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :-----

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

### Incident Patch 1: `2ae9acdf` (2026-09-30)
**Commit Message**: fix: render every content part of ChatPromptBuilder message templates (#12907)

Co-authored-by: anakin87 <stefanofiorucci@gmail.com>

**File**: `haystack/components/builders/chat_prompt_builder.py` (modified, +15/-11)
```diff
@@ -176,12 +176,13 @@ def __init__(
                         # infer variables from template
                         if message.text is None:
                             raise ValueError(NO_TEXT_ERROR_MESSAGE.format(role=message.role.value, message=message))
-                        if message.text and "templatize_part" in message.text:
-                            raise ValueError(FILTER_NOT_ALLOWED_ERROR_MESSAGE)
-                        assigned_variables, template_variables = _extract_template_variables_and_assignments(
-                            env=self._env, template=message.text
-                        )
-                        extracted_variables += list(template_variables - assigned_variables)
+                        for text in message.texts:
+                            if "templatize_part" in text:
+                                raise ValueError(FILTER_NOT_ALLOWED_ERROR_MESSAGE)
+                            assigned_variables, template_variables = _extract_template_variables_and_assignments(
+                                env=self._env, template=text
+                            )
+                            extracted_variables += list(template_variables - assigned_variables)
             elif isinstance(template, str):
                 assigned_variables, template_variables = _extract_template_variables_and_assignments(
                     env=self._env, template=template
@@ -263,12 +264,15 @@ def run(
                     self._validate_variables(set(template_variables_combined.keys()))
                     if message.text is None:
                         raise ValueError(NO_TEXT_ERROR_MESSAGE.format(role=message.role.value, message=message))
-                    if message.text and "templatize_part" in message.text:
-                        raise ValueError(FILTER_NOT_ALLOWED_ERROR_MESSAGE)
-                    compiled_template = self._env.from_string(message.text)
-                    rendered_text = compiled_template.render(template_variables_combined)
+                    rendered_content = list(message._content)
+                    for index, part in enumerate(rendered_content):
+                        if isinstance(part, TextContent):
+                            if "templatize_part" in part.text:
+                                raise ValueError(FILTER_NOT_ALLOWED_ERROR_MESSAGE)
+                            rendered_text = self._env.from_string(part.text).render(template_variables_combined)
+                            rendered_content[index] = TextContent(text=rendered_text)
                     # use dataclasses.replace to avoid in-place mutation of the original message
-                    rendered_message: ChatMessage = replace(message, _content=[TextContent(text=rendered_text)])
+                    rendered_message: ChatMessage = replace(message, _content=rendered_content)
                     processed_messages.append(rendered_message)
                 else:
                     processed_messages.append(message)
```

**File**: `releasenotes/notes/chat-prompt-builder-renders-all-content-parts-9c3f2a71d84b5e06.yaml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+fixes:
+  - |
+    Fixed ``ChatPromptBuilder`` dropping content parts when the template is a list of ``ChatMessage`` objects.
+    Only the first ``TextContent`` part was rendered, and every other part - additional texts, images, files -
+    was removed from the rendered prompt without a warning. Template variables used in those dropped parts
+    were not detected either, so they were not exposed as inputs. Now all ``TextContent`` parts are
+    rendered and the remaining content parts are passed through unchanged.
```

**File**: `test/components/builders/test_chat_prompt_builder.py` (modified, +45/-5)
```diff
@@ -15,7 +15,7 @@
 from haystack.components.builders.chat_prompt_builder import ChatPromptBuilder
 from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
 from haystack.core.pipeline.pipeline import Pipeline
-from haystack.dataclasses.chat_message import ChatMessage, FileContent, ImageContent, ReasoningContent
+from haystack.dataclasses.chat_message import ChatMessage, FileContent, ImageContent, ReasoningContent, TextContent
 from haystack.dataclasses.document import Document
 
 
@@ -119,6 +119,36 @@ def test_run(self):
         res = builder.run(variable="test")
         assert res == {"prompt": [ChatMessage.from_user("This is a test")]}
 
+    def test_run_with_multiple_text_parts(self):
+        template = [
+            ChatMessage.from_user(
+                content_parts=[TextContent(text="Hello, {{ name }}!"), TextContent(text="Goodbye, {{ other }}!")]
+            )
+        ]
+        builder = ChatPromptBuilder(template=template)
+
+        assert set(builder.variables) == {"name", "other"}
+        assert builder.run(name="John", other="Jane")["prompt"][0].texts == ["Hello, John!", "Goodbye, Jane!"]
+
+    @pytest.mark.parametrize(
+        "content_part",
+        [
+            ImageContent(base64_image="cHJldGVuZC1wbmctYnl0ZXM=", mime_type="image/png"),
+            FileContent(base64_data="dGVzdA==", mime_type="application/pdf", filename="document.pdf"),
+        ],
+        ids=["image", "file"],
+    )
+    def test_run_preserves_non_text_content_parts(self, content_part):
+        template = [ChatMessage.from_user(content_parts=["Describe {{ thing }}", content_part, "Also {{ other }}"])]
+        builder = ChatPromptBuilder(template=template)
+
+        assert builder.run(thing="this", other="that") == {
+            "prompt": [ChatMessage.from_user(content_parts=["Describe this", content_part, "Also that"])]
+        }
+        assert template == [
+            ChatMessage.from_user(content_parts=["Describe {{ thing }}", content_part, "Also {{ other }}"])
+        ]
+
     def test_run_template_variable(self):
         builder = ChatPromptBuilder(template=[ChatMessage.from_user("This is a {{ variable }}")])
         res = builder.run(template_variables={"variable": "test"})
@@ -720,14 +750,24 @@ def test_from_dict_template_none(self):
         assert comp._variables is None
         assert comp._required_variables == "*"
 
-    def test_chat_message_list_with_templatize_part_init_raises_error(self):
-        template = [ChatMessage.from_user("This is a {{ variable | templatize_part }}")]
+    @pytest.mark.parametrize(
+        "content_parts",
+        [["This is a {{ variable | templatize_part }}"], ["First text", "This is a {{ variable | templatize_part }}"]],
+        ids=["first_text", "second_text"],
+    )
+    def test_chat_message_list_with_templatize_part_init_raises_error(self, content_parts):
+        template = [ChatMessage.from_user(content_parts=content_parts)]
         with pytest.raises(ValueError, match="templatize_part filter cannot be used"):
             ChatPromptBuilder(template=template)
 
-    def test_chat_message_list_with_templatize_part_run_raises_error(self):
+    @pytest.mark.parametrize(
+        "content_parts",
+        [["This is a {{ variable | templatize_part }}"], ["First text", "This is a {{ variable | templatize_part }}"]],
+        ids=["first_text", "second_text"],
+    )
+    def test_chat_message_list_with_templatize_part_run_raises_error(self, content_parts):
         builder = ChatPromptBuilder()
-        template = [ChatMessage.from_user("This is a {{ variable | templatize_part }}")]
+        template = [ChatMessage.from_user(content_parts=content_parts)]
         with pytest.raises(ValueError, match="templatize_part filter cannot be used"):
             builder.run(template=template, variable="test")
 
```

---

### Incident Patch 2: `bb5b39f4` (2026-09-29)
**Commit Message**: fix: stop ConditionalRouter and BranchJoiner from_dict from mutating the caller's data (#12935)

Co-authored-by: David S. Batista <dsbatista@gmail.com>
Co-authored-by: Julian Risch <julian.risch@deepset.ai>
Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `haystack/components/joiners/branch.py` (modified, +4/-2)
```diff
@@ -113,8 +113,10 @@ def from_dict(cls, data: dict[str, Any]) -> "BranchJoiner":
         :returns:
             A deserialized `BranchJoiner` instance.
         """
-        data["init_parameters"]["type_"] = deserialize_type(data["init_parameters"]["type_"])
-        return default_from_dict(cls, data)
+        # Copy so the caller's data keeps the serialized type and can be deserialized again
+        init_parameters = dict(data["init_parameters"])
+        init_parameters["type_"] = deserialize_type(init_parameters["type_"])
+        return default_from_dict(cls, {**data, "init_parameters": init_parameters})
 
     def run(self, **kwargs: Any) -> dict[str, Any]:
         """
```

**File**: `haystack/components/routers/conditional_router.py` (modified, +18/-15)
```diff
@@ -364,7 +364,8 @@ def from_dict(cls, data: dict[str, Any]) -> "ConditionalRouter":
         :returns:
             The deserialized component.
         """
-        init_params = data.get("init_parameters", {})
+        # Copy so the caller's data stays serialized; nested routes and filters are copied below too
+        init_params = dict(data.get("init_parameters", {}))
 
         # `unsafe=True` swaps the Jinja sandbox for a NativeEnvironment that executes arbitrary code.
         # Honor it from serialized data only when the whole pipeline is being loaded in unsafe mode;
@@ -375,7 +376,7 @@ def from_dict(cls, data: dict[str, Any]) -> "ConditionalRouter":
                 "If you trust the source of this data, load it with Pipeline.load(..., unsafe=True)."
             )
 
-        custom_filters = init_params.get("custom_filters", {})
+        custom_filters = init_params.get("custom_filters")
         if custom_filters and not _is_unsafe_deserialization():
             raise DeserializationError(
                 "Refusing to deserialize a ConditionalRouter with custom filters while loading in safe mode. "
@@ -384,19 +385,21 @@ def from_dict(cls, data: dict[str, Any]) -> "ConditionalRouter":
             )
 
         routes = init_params.get("routes")
-        for route in routes:
-            # output_type needs to be deserialized from a string to a type
-            if isinstance(route["output_type"], list):
-                route["output_type"] = [deserialize_type(t) for t in route["output_type"]]
-            else:
-                route["output_type"] = deserialize_type(route["output_type"])
-
-        # Since the custom_filters are typed as optional in the init signature, we catch the
-        # case where they are not present in the serialized data and set them to an empty dict.
-        if custom_filters is not None:
-            for name, filter_func in custom_filters.items():
-                init_params["custom_filters"][name] = deserialize_callable(filter_func) if filter_func else None
-        return default_from_dict(cls, data)
+        if routes is not None:
+            init_params["routes"] = routes = [dict(route) for route in routes]
+            for route in routes:
+                # output_type needs to be deserialized from a string to a type
+                if isinstance(route["output_type"], list):
+                    route["output_type"] = [deserialize_type(t) for t in route["output_type"]]
+                else:
+                    route["output_type"] = deserialize_type(route["output_type"])
+
+        if custom_filters:
+            init_params["custom_filters"] = {
+                name: deserialize_callable(filter_func) if filter_func else None
+                for name, filter_func in custom_filters.items()
+            }
+        return default_from_dict(cls, {**data, "init_parameters": init_params})
 
     def run(self, **kwargs: Any) -> dict[str, Any]:
         """
```

**File**: `releasenotes/notes/fix-conditional-router-from-dict-caller-mutation-da863fb2fd788ea9.yaml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+fixes:
+  - |
+    Fixed ``ConditionalRouter.from_dict`` mutating the caller's ``routes`` data in place: serialized
+    ``output_type`` strings were deserialized directly inside the caller's dictionaries, so reusing the same
+    serialized pipeline dict afterwards yielded already-deserialized type objects. ``from_dict`` now works on a
+    copy and the caller's data is left untouched. ``BranchJoiner.from_dict`` received the same treatment.
```

**File**: `test/components/joiners/test_branch_joiner.py` (modified, +14/-0)
```diff
@@ -7,6 +7,20 @@
 from haystack.components.joiners import BranchJoiner
 
 
+class TestBranchJoinerDeserialization:
+    def test_from_dict_does_not_mutate_caller_data(self):
+        joiner = BranchJoiner(list[str])
+        data = joiner.to_dict()
+        serialized_type = data["init_parameters"]["type_"]
+        assert isinstance(serialized_type, str)
+
+        BranchJoiner.from_dict(data)
+
+        assert data["init_parameters"]["type_"] == serialized_type
+        # a second deserialization of the same dict must behave like the first
+        BranchJoiner.from_dict(data)
+
+
 class TestBranchJoiner:
     def test_one_value(self):
         joiner = BranchJoiner(int)
```

**File**: `test/components/routers/test_conditional_router.py` (modified, +18/-0)
```diff
@@ -1021,3 +1021,21 @@ def test_conditional_router_passthrough_skips_output_template_validation(self):
         router = ConditionalRouter(routes)
         result = router.run(**{"{{unclosed": "value"})
         assert result == {"out": "value"}
+
+
+class TestConditionalRouterDeserialization:
+    def test_from_dict_does_not_mutate_caller_data(self):
+        routes: list[Route] = [
+            {"condition": "{{ x > 1 }}", "output": "{{ x }}", "output_name": "big", "output_type": int},
+            {"condition": "{{ x <= 1 }}", "output": "{{ x }}", "output_name": "small", "output_type": int},
+        ]
+        router = ConditionalRouter(routes)
+        data = router.to_dict()
+        serialized_types = [route["output_type"] for route in data["init_parameters"]["routes"]]
+        assert all(isinstance(t, str) for t in serialized_types)
+
+        ConditionalRouter.from_dict(data)
+
+        assert [route["output_type"] for route in data["init_parameters"]["routes"]] == serialized_types
+        # a second deserialization of the same dict must behave like the first
+        ConditionalRouter.from_dict(data)
```

---

### Incident Patch 3: `1ee5dc72` (2026-09-29)
**Commit Message**: fix: treat None group values as missing in MetaFieldGroupingRanker (#12892)

**File**: `haystack/components/rankers/meta_field_grouping_ranker.py` (modified, +4/-2)
```diff
@@ -97,7 +97,9 @@ def run(self, documents: list[Document]) -> dict[str, list[Document]]:
 
         deduplicated_documents = _deduplicate_documents(documents)
         for doc in deduplicated_documents:
-            group_value = str(doc.meta.get(self.group_by, ""))
+            # A value of None counts as missing, as it does for `sort_docs_by`
+            raw_group_value = doc.meta.get(self.group_by)
+            group_value = "" if raw_group_value is None else str(raw_group_value)
 
             # If no group value, add to no_group_docs and continue
             if not group_value:
@@ -106,7 +108,7 @@ def run(self, documents: list[Document]) -> dict[str, list[Document]]:
 
             # Get subgroup value or use a default if not specified
             subgroup_value = "no_subgroup"
-            if self.subgroup_by and self.subgroup_by in doc.meta:
+            if self.subgroup_by and doc.meta.get(self.subgroup_by) is not None:
                 subgroup_value = str(doc.meta[self.subgroup_by])
 
             document_groups[group_value][subgroup_value].append(doc)
```

**File**: `releasenotes/notes/grouping-ranker-none-group-3f1c2a9b7d5e4f60.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+fixes:
+  - |
+    ``MetaFieldGroupingRanker`` now treats a ``group_by`` or ``subgroup_by`` value of ``None`` as missing, the same way it
+    already treats ``sort_docs_by``. Documents with ``None`` go to the end with the other ungrouped documents, instead
+    of forming a group named ``"None"`` that also absorbed documents whose value was the string ``"None"``.
```

**File**: `test/components/rankers/test_meta_field_grouping_ranker.py` (modified, +26/-0)
```diff
@@ -168,6 +168,32 @@ def test_run_sort_docs_by_field_present_but_none(self) -> None:
         assert result["documents"][1].content == "none value"
         assert result["documents"][2].content == "missing"
 
+    def test_run_none_group_value_is_treated_as_missing(self) -> None:
+        docs = [
+            Document(content="group None", meta={"group": None}),
+            Document(content="group 42", meta={"group": "42"}),
+            Document(content="no group key", meta={}),
+            Document(content="group 'None'", meta={"group": "None"}),
+        ]
+        ranker = MetaFieldGroupingRanker(group_by="group")
+        result = ranker.run(documents=docs)
+        assert [doc.content for doc in result["documents"]] == [
+            "group 42",
+            "group 'None'",
+            "group None",
+            "no group key",
+        ]
+
+    def test_run_none_subgroup_value_is_treated_as_missing(self) -> None:
+        docs = [
+            Document(content="subgroup None", meta={"group": "g", "subgroup": None}),
+            Document(content="subgroup 'None'", meta={"group": "g", "subgroup": "None"}),
+            Document(content="no subgroup key", meta={"group": "g"}),
+        ]
+        ranker = MetaFieldGroupingRanker(group_by="group", subgroup_by="subgroup")
+        result = ranker.run(documents=docs)
+        assert [doc.content for doc in result["documents"]] == ["subgroup None", "no subgroup key", "subgroup 'None'"]
+
     def test_run_metadata_with_different_data_types(self) -> None:
         """
         Test the behavior of the MetaFieldGroupingRanker component when the metadata values have different data types.
```

---

### Incident Patch 4: `5909e70c` (2026-09-29)
**Commit Message**: fix: skip BM25L/BM25Plus lower bound for query terms missing from a document (#12895)

Co-authored-by: Julian Risch <julian.risch@deepset.ai>
Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `haystack/document_stores/in_memory/document_store.py` (modified, +16/-6)
```diff
@@ -276,6 +276,10 @@ def _compute_idf(tokens: list[str]) -> dict[str, float]:
         def _compute_tf(token: str, freq: dict[str, int], doc_len: int) -> float:
             """Per-token BM25L computation."""
             freq_term = freq.get(token, 0.0)
+            # The lower bound (delta) only applies to terms that occur in the document;
+            # a missing term contributes nothing.
+            if freq_term == 0:
+                return 0.0
             ctd = freq_term / (1 - b + b * doc_len / self._avg_doc_len)
             return (1.0 + k) * (ctd + delta) / (k + ctd + delta)
 
@@ -384,6 +388,10 @@ def _compute_idf(tokens: list[str]) -> dict[str, float]:
         def _compute_tf(token: str, freq: dict[str, int], doc_len: float) -> float:
             """Per-token normalized term frequency."""
             freq_term = freq.get(token, 0.0)
+            # The lower bound (delta) only applies to terms that occur in the document;
+            # a missing term contributes nothing.
+            if freq_term == 0:
+                return 0.0
             freq_damp = k * (1 - b + b * doc_len / self._avg_doc_len)
             return freq_term * (1.0 + k) / (freq_term + freq_damp) + delta
 
@@ -806,28 +814,30 @@ def bm25_retrieval(
         # A tokenless corpus (every stored document has empty content) has no vocabulary and an
         # average document length of zero, which would make all three BM25 algorithms divide by
         # zero during scoring. Score every candidate as 0.0 instead; the non-positive-score
-        # handling below then keeps them for BM25Okapi (unscaled) and drops them otherwise.
+        # handling below then keeps them for BM25Okapi and drops them for BM25L and BM25Plus.
         if self._avg_doc_len == 0:
             scored_documents = [(doc, 0.0) for doc in all_documents]
         else:
             scored_documents = self.bm25_algorithm_inst(query, all_documents)
 
         results = sorted(scored_documents, key=lambda x: x[1], reverse=True)[:top_k]
 
-        # BM25Okapi can return meaningful negative values, so they should not be filtered out when scale_score is False.
+        # BM25Okapi can return meaningful negative values, so they should not be filtered out.
         # It's the only algorithm supported by rank_bm25 at the time of writing (2024) that can return negative scores.
         # see https://github.com/deepset-ai/haystack/pull/6889 for more context.
-        negatives_are_valid = self.bm25_algorithm == "BM25Okapi" and not scale_score
+        # BM25L and BM25Plus scores are 0 exactly when no query term occurs in the document. Filter on the raw score,
+        # because scaling maps 0 to 0.5.
+        drop_non_positive = self.bm25_algorithm != "BM25Okapi"
 
         # Create documents with the BM25 score to return them
         return_documents = []
         for doc, score in results:
+            if drop_non_positive and score <= 0.0:
+                continue
+
             if scale_score:
                 score = expit(score / BM25_SCALING_FACTOR)
 
-            if not negatives_are_valid and score <= 0.0:
-                continue
-
             doc_fields = doc.to_dict()
             doc_fields["score"] = score
 
```

**File**: `releasenotes/notes/bm25-lower-bound-missing-terms-3f9a1c7e2b6d4a85.yaml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+upgrade:
+  - |
+    ``InMemoryDocumentStore.bm25_retrieval`` and ``InMemoryBM25Retriever`` with ``BM25L`` (the default) or
+    ``BM25Plus`` now return only documents that contain at least one query term, with or without
+    ``scale_score``. Previously, documents without any query term were returned with a positive score and
+    filled up ``top_k``. As a result, retrieval can now return fewer than ``top_k`` documents, or none at all.
+
+    The ``delta`` lower bound now applies only to query terms that occur in the document, as in the original
+    BM25L/BM25+ definitions. So scores of matching documents are lower than before whenever the query has
+    terms that a document does not contain. If you filter results with a fixed score threshold, re-check the
+    threshold. ``BM25Okapi`` is not affected.
```

**File**: `test/components/retrievers/test_in_memory_bm25_retriever.py` (modified, +4/-4)
```diff
@@ -134,7 +134,7 @@ def test_retriever_valid_run(self, in_memory_doc_store, mock_docs):
         in_memory_doc_store.write_documents(mock_docs)
 
         retriever = InMemoryBM25Retriever(in_memory_doc_store, top_k=5)
-        result = retriever.run(query="PHP")
+        result = retriever.run(query="PHP popular")
 
         assert "documents" in result
         assert len(result["documents"]) == 5
@@ -262,9 +262,9 @@ def test_run_with_pipeline(
     @pytest.mark.parametrize(
         "query, query_result, top_k",
         [
-            ("Javascript", "Javascript is a popular programming language", 1),
-            ("Java", "Java is a popular programming language", 2),
-            ("Ruby", "Ruby is a popular programming language", 3),
+            ("Javascript popular", "Javascript is a popular programming language", 1),
+            ("Java popular", "Java is a popular programming language", 2),
+            ("Ruby popular", "Ruby is a popular programming language", 3),
         ],
     )
     def test_run_with_pipeline_and_top_k(
```

**File**: `test/core/pipeline/features/test_run.py` (modified, +5/-5)
```diff
@@ -872,7 +872,7 @@ def pipeline_that_has_a_component_with_only_default_inputs():
                                     Document(
                                         id="a4a874fc2ef75015da7924d709fbdd2430e46a8e94add6e0f26cd32c1c03435d",
                                         content="Rome is the capital of Italy",
-                                        score=1.3448247718197388,
+                                        score=0.9116077839697729,
                                         meta={"source_index": 2},
                                     ),
                                 ],
@@ -892,7 +892,7 @@ def pipeline_that_has_a_component_with_only_default_inputs():
                             Document(
                                 id="a4a874fc2ef75015da7924d709fbdd2430e46a8e94add6e0f26cd32c1c03435d",
                                 content="Rome is the capital of Italy",
-                                score=1.3448247718197388,
+                                score=0.9116077839697729,
                             ),
                         ],
                         "meta": None,
@@ -919,7 +919,7 @@ def pipeline_that_has_a_component_with_only_default_inputs():
                             Document(
                                 id="a4a874fc2ef75015da7924d709fbdd2430e46a8e94add6e0f26cd32c1c03435d",
                                 content="Rome is the capital of Italy",
-                                score=1.3448247718197388,
+                                score=0.9116077839697729,
                             ),
                         ],
                         "query": "What is the capital of France?",
@@ -2466,7 +2466,7 @@ def run(self, prompt: str) -> dict[str, dict[str, Any]]:
                                 content="some text about investigation and treatment of Alzheimer disease",
                                 meta={"year": 2023, "disease": "Alzheimer", "author": "John Bread"},
                                 id="doc2",
-                                score=4.148111588215998,
+                                score=2.2509916033301165,
                             )
                         ]
                     }
@@ -2480,7 +2480,7 @@ def run(self, prompt: str) -> dict[str, dict[str, Any]]:
                                     id="doc2",
                                     content="some text about investigation and treatment of Alzheimer disease",
                                     meta={"year": 2023, "disease": "Alzheimer", "author": "John Bread"},
-                                    score=4.148111588215998,
+                                    score=2.2509916033301165,
                                 )
                             ]
                         ],
```

**File**: `test/document_stores/test_in_memory.py` (modified, +39/-3)
```diff
@@ -289,12 +289,12 @@ def test_bm25_retrieval_with_different_top_k(self, document_store: InMemoryDocum
         ]
         document_store.write_documents(docs)
 
-        # top_k = 2
-        results = document_store.bm25_retrieval(query="language", top_k=2)
+        # top_k = 2 (three documents match the query)
+        results = document_store.bm25_retrieval(query="world languages Python", top_k=2)
         assert len(results) == 2
 
         # top_k = 3
-        results = document_store.bm25_retrieval(query="languages", top_k=3)
+        results = document_store.bm25_retrieval(query="world languages Python", top_k=3)
         assert len(results) == 3
 
     def test_bm25_plus_retrieval(self):
@@ -310,6 +310,42 @@ def test_bm25_plus_retrieval(self):
         assert len(results) == 1
         assert results[0].content == "Python is a popular programming language"
 
+    @pytest.mark.parametrize("bm25_algorithm", ["BM25L", "BM25Plus"])
+    @pytest.mark.parametrize("scale_score", [False, True])
+    def test_bm25_retrieval_skips_documents_without_query_terms(
+        self, bm25_algorithm: Literal["BM25L", "BM25Plus"], scale_score: bool
+    ) -> None:
+        doc_store = InMemoryDocumentStore(bm25_algorithm=bm25_algorithm)
+        doc_store.write_documents(
+            [
+                Document(id="apple", content="apple pie recipe"),
+                Document(id="banana", content="banana bread recipe"),
+                Document(id="cherry", content="cherry tart"),
+            ]
+        )
+
+        results = doc_store.bm25_retrieval(query="apple", top_k=3, scale_score=scale_score)
+
+        assert [doc.id for doc in results] == ["apple"]
+
+    @pytest.mark.parametrize("bm25_algorithm", ["BM25L", "BM25Plus"])
+    def test_bm25_missing_query_term_adds_no_score(self, bm25_algorithm: Literal["BM25L", "BM25Plus"]) -> None:
+        doc_store = InMemoryDocumentStore(bm25_algorithm=bm25_algorithm)
+        doc_store.write_documents(
+            [
+                Document(id="apple", content="apple pie recipe"),
+                Document(id="banana", content="banana bread recipe"),
+                Document(id="cherry", content="cherry tart"),
+            ]
+        )
+
+        single_term = {doc.id: doc.score for doc in doc_store.bm25_retrieval(query="apple", top_k=3)}
+        # "cherry" does not occur in the "apple" document, so it must not change that document's score
+        two_terms = {doc.id: doc.score for doc in doc_store.bm25_retrieval(query="apple cherry", top_k=3)}
+
+        assert two_terms["apple"] == pytest.approx(single_term["apple"])
+        assert "banana" not in two_terms
+
     def test_bm25_retrieval_with_two_queries(self, document_store: InMemoryDocumentStore) -> None:
         # Tests if the bm25_retrieval method returns different documents for different queries.
         docs = [
```

---

### Incident Patch 5: `11a0dd26` (2026-09-28)
**Commit Message**: fix: keep an XLSX cell from breaking the markdown table (#12972)

Co-authored-by: anakin87 <stefanofiorucci@gmail.com>

**File**: `haystack/components/converters/xlsx.py` (modified, +9/-0)
```diff
@@ -234,6 +234,15 @@ def _extract_tables(self, bytestream: ByteStream) -> tuple[list[str], list[dict]
                     "missingval": "",
                     **self.table_format_kwargs,
                 }
+                if resolved_kwargs["tablefmt"] == "pipe":
+                    value = value.replace(
+                        {
+                            r"\r\n|\r|\n": " ",  # keep in-cell line breaks from creating extra Markdown rows
+                            r"(\\*)\|": r"\1\1\\|",  # escape pipes but preserve any preceding literal backslashes
+                        },
+                        regex=True,
+                    )
+
                 # to_markdown uses tabulate, whose missingval only covers None: a NaN
                 # reaches the formatter as a number and is written out as "nan". Replace
                 # the empty cells with None so an empty cell reads as empty, the way
```

**File**: `releasenotes/notes/xlsx-markdown-escape-25b936b365fd48f1.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+fixes:
+  - |
+    ``XLSXToDocument`` now escapes pipe characters and replaces in-cell line breaks
+    with spaces in the default Markdown pipe table output. This keeps cell content
+    from being interpreted as additional table columns or rows.
```

**File**: `test/components/converters/test_xlsx_to_document.py` (modified, +25/-0)
```diff
@@ -108,6 +108,31 @@ def test_run_markdown_missing_value(self, test_files_path: Path) -> None:
             == "|    | A     | B     |\n|---:|:------|:------|\n|  1 | col_c | col_d |\n|  2 | True  | N/A   |"
         )
 
+    @pytest.mark.parametrize(
+        ("cell_value", "expected_row"),
+        [
+            pytest.param("a|b", "|  1 | a\\|b |", id="pipe"),
+            pytest.param(r"a\|b", r"|  1 | a\\\|b |", id="backslash-before-pipe"),
+            pytest.param("first\r\nsecond", "|  1 | first second |", id="windows-line-break"),
+            pytest.param("first line\nsecond line", "|  1 | first line second line |", id="line-break"),
+        ],
+    )
+    def test_run_markdown_escapes_cell_content(self, tmp_path: Path, cell_value: str, expected_row: str) -> None:
+        """A pipe would be read as a column separator, and a line break would end the row in the middle."""
+        workbook = Workbook()
+        sheet = workbook.active
+        assert sheet is not None
+        sheet["A1"] = cell_value
+        path = tmp_path / "cell.xlsx"
+        workbook.save(path)
+
+        content = XLSXToDocument(table_format="markdown").run(sources=[path])["documents"][0].content
+        assert content is not None
+        rows = content.split("\n")
+
+        assert len(rows) == 3
+        assert rows[2] == expected_row
+
     @pytest.mark.parametrize(
         "sheet_name, expected_sheet_name, expected_content",
         [
```

---

### Incident Patch 6: `c2e809e1` (2026-09-28)
**Commit Message**: fix(MetaFieldRanker): apply missing_meta when no document has the field (#12963)

Co-authored-by: anakin87 <stefanofiorucci@gmail.com>

**File**: `haystack/components/rankers/meta_field.py` (modified, +3/-2)
```diff
@@ -258,16 +258,17 @@ def run(
         docs_with_meta_field = [doc for doc in deduplicated_documents if doc.meta.get(self.meta_field) is not None]
         docs_missing_meta_field = [doc for doc in deduplicated_documents if doc.meta.get(self.meta_field) is None]
 
-        # If all docs are missing self.meta_field return original documents
         if len(docs_with_meta_field) == 0:
             logger.warning(
                 "The parameter <meta_field> is currently set to '{meta_field}', but none of the provided "
                 "Documents with IDs {document_ids} have this meta key.\n"
                 "Set <meta_field> to the name of a field that is present within the provided Documents.\n"
-                "Returning the <top_k> of the original Documents since there are no values to rank.",
+                "Applying the configured <missing_meta> policy instead of ranking.",
                 meta_field=self.meta_field,
                 document_ids=",".join([doc.id for doc in deduplicated_documents]),
             )
+            if missing_meta == "drop":
+                return {"documents": []}
             return {"documents": deduplicated_documents[:top_k]}
 
         if len(docs_missing_meta_field) > 0:
```

**File**: `releasenotes/notes/fix-metafield-ranker-missing-meta-99197f6d6faaf8e3.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+fixes:
+  - |
+    Fix ``MetaFieldRanker`` to return no documents when ``missing_meta="drop"``
+    and all documents lack the ranking field or have a ``None`` value.
```

**File**: `test/components/rankers/test_metafield.py` (modified, +19/-0)
```diff
@@ -338,3 +338,22 @@ def test_none_meta_value_is_handled_as_missing_meta(self, missing_meta, expected
         ]
         output = ranker.run(documents=docs_before)
         assert [doc.id for doc in output["documents"]] == expected_ids
+
+    @pytest.mark.parametrize(
+        ("meta", "init_missing_meta", "run_missing_meta", "expected_ids"),
+        [
+            ({}, "drop", None, []),
+            ({}, "top", None, ["a", "b"]),
+            ({}, "bottom", None, ["a", "b"]),
+            ({}, "bottom", "drop", []),
+            ({}, "drop", "top", ["a", "b"]),
+            ({"rating": None}, "drop", None, []),
+        ],
+    )
+    def test_missing_meta_when_all_values_are_missing(self, meta, init_missing_meta, run_missing_meta, expected_ids):
+        ranker = MetaFieldRanker(meta_field="rating", missing_meta=init_missing_meta)
+        docs = [Document(id="a", content="a", meta=meta), Document(id="b", content="b", meta=meta)]
+
+        output = ranker.run(documents=docs, missing_meta=run_missing_meta)
+
+        assert [doc.id for doc in output["documents"]] == expected_ids
```

---

### Incident Patch 7: `436fc1c7` (2026-09-28)
**Commit Message**: fix: handle scalar content values in JSONConverter (#12983)

**File**: `haystack/components/converters/json.py` (modified, +3/-0)
```diff
@@ -238,6 +238,9 @@ def _get_content_and_meta(self, source: ByteStream) -> list[tuple[str, dict[str,
                     logger.warning("Expected a scalar value but got {obj}. Skipping it.", obj=obj)
                     continue
 
+                if text is not None and not isinstance(text, str):
+                    text = str(text)
+
                 meta = {}
                 if meta_fields == "*":
                     meta = {k: v for k, v in obj.items() if k != self._content_key}
```

**File**: `releasenotes/notes/json-converter-scalar-content-163133a47060a2e7.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+fixes:
+  - |
+    Fixed ``JSONConverter`` failing with ``ValueError`` when ``content_key`` contains numeric or boolean scalar values.
+    These values are now converted to strings before creating the ``Document``, while ``null`` values remain unchanged.
```

**File**: `test/components/converters/test_json.py` (modified, +10/-0)
```diff
@@ -511,6 +511,16 @@ def test_run_with_content_key(tmpdir):
     assert result["documents"][2].meta == {}
 
 
+@pytest.mark.parametrize("value, expected", [(123, "123"), (1.5, "1.5"), (True, "True"), (None, None)])
+def test_run_with_content_key_with_scalar_values(value, expected):
+    source = ByteStream.from_string(json.dumps({"body": value}))
+
+    converter = JSONConverter(content_key="body")
+    result = converter.run(sources=[source])
+
+    assert result["documents"][0].content == expected
+
+
 def test_run_with_content_key_and_extra_meta_fields(tmpdir):
     first_test_file = Path(tmpdir / "first_test_file.json")
     second_test_file = Path(tmpdir / "second_test_file.json")
```

---

### Incident Patch 8: `693ec059` (2026-09-28)
**Commit Message**: fix: release the token counter when CompactionHook is closed (#12985)

Co-authored-by: anakin87 <stefanofiorucci@gmail.com>

**File**: `haystack/hooks/compaction/hooks.py` (modified, +12/-12)
```diff
@@ -290,24 +290,24 @@ async def warm_up_async(self) -> None:
         """Warm up the token counter and the compactor on the serving event loop."""
         if hasattr(self.token_counter, "warm_up"):
             self.token_counter.warm_up()
-        warm_up_async = getattr(self.compactor, "warm_up_async", None)
-        if warm_up_async is not None:
-            await warm_up_async()
+        if hasattr(self.compactor, "warm_up_async"):
+            await self.compactor.warm_up_async()
         elif hasattr(self.compactor, "warm_up"):
             self.compactor.warm_up()
 
     def close(self) -> None:
-        """Release the compactor's resources."""
-        if hasattr(self.compactor, "close"):
-            self.compactor.close()
+        """Release the token counter's and the compactor's resources."""
+        for resource in (self.token_counter, self.compactor):
+            if hasattr(resource, "close"):
+                resource.close()
 
     async def close_async(self) -> None:
-        """Release the compactor's async resources."""
-        close_async = getattr(self.compactor, "close_async", None)
-        if close_async is not None:
-            await close_async()
-        elif hasattr(self.compactor, "close"):
-            self.compactor.close()
+        """Release the token counter's and the compactor's async resources."""
+        for resource in (self.token_counter, self.compactor):
+            if hasattr(resource, "close_async"):
+                await resource.close_async()
+            elif hasattr(resource, "close"):
+                resource.close()
 
     def to_dict(self) -> dict[str, Any]:
         """
```

**File**: `releasenotes/notes/compaction-hook-close-token-counter-0495043806039056.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+fixes:
+  - |
+    Fixed ``CompactionHook.close()`` and ``close_async()`` to release the token counter's
+    resources as well as the compactor's. Previously, resources such as
+    ``OpenAITokenCounter``'s HTTP client remained open after the hook or Agent was closed.
```

**File**: `test/hooks/compaction/test_hooks.py` (modified, +11/-4)
```diff
@@ -4,6 +4,7 @@
 
 import logging
 from typing import Annotated, Any
+from unittest.mock import Mock
 
 import pytest
 
@@ -387,11 +388,14 @@ def test_chains_tool_result_pruning_before_sliding_window(self):
         )
         assert compacted[-2:] == messages[-2:]
 
-    def test_lifecycle_delegates_to_the_compactor(self):
+    def test_lifecycle_delegates_to_the_counter_and_compactor(self):
+        counter = Mock(spec=["warm_up", "close"])
         compactor = _RecordingCompactor()
-        hook = _hook(compactor)
+        hook = _hook(compactor=compactor, token_counter=counter)
         hook.warm_up()
         hook.close()
+        counter.warm_up.assert_called_once_with()
+        counter.close.assert_called_once_with()
         assert compactor.calls == ["warm_up", "close"]
 
 
@@ -422,11 +426,14 @@ async def test_run_async_uses_the_async_compaction_path(self):
         assert compactor.calls == ["compact_async"]
 
     @pytest.mark.asyncio
-    async def test_lifecycle_prefers_the_async_methods(self):
+    async def test_lifecycle_prefers_async_methods_with_sync_fallback(self):
+        counter = Mock(spec=["warm_up", "close"])
         compactor = _RecordingCompactor()
-        hook = _hook(compactor)
+        hook = _hook(compactor=compactor, token_counter=counter)
         await hook.warm_up_async()
         await hook.close_async()
+        counter.warm_up.assert_called_once_with()
+        counter.close.assert_called_once_with()
         assert compactor.calls == ["warm_up_async", "close_async"]
 
     @pytest.mark.asyncio
```

---

### Incident Patch 9: `0edc59c2` (2026-09-28)
**Commit Message**: fix: ignore dimension for custom mock embeddings (#12980)

Co-authored-by: carey-bk <180496115+carey-bk@users.noreply.github.com>
Co-authored-by: anakin87 <stefanofiorucci@gmail.com>

**File**: `haystack/components/embedders/mock_document_embedder.py` (modified, +3/-3)
```diff
@@ -81,13 +81,13 @@ def __init__(
         :param meta_fields_to_embed: List of metadata fields to embed along with the document text.
         :param embedding_separator: Separator used to concatenate the metadata fields to the document text.
         :param progress_bar: Accepted for interface compatibility with real Document Embedders and ignored.
-        :raises ValueError: If both `embedding` and `embedding_fn` are provided, if `dimension` is not positive, or
-            if `embedding` is an empty list.
+        :raises ValueError: If both `embedding` and `embedding_fn` are provided, if `embedding` is an empty list,
+            or if neither is provided and `dimension` is not positive.
         :raises TypeError: If `embedding` is not a sequence of numbers.
         """
         if embedding is not None and embedding_fn is not None:
             raise ValueError("Pass either 'embedding' or 'embedding_fn', not both.")
-        if dimension <= 0:
+        if embedding is None and embedding_fn is None and dimension <= 0:
             raise ValueError("'dimension' must be a positive integer.")
 
         self.embedding = _coerce_embedding(embedding, name="'embedding'") if embedding is not None else None
```

**File**: `haystack/components/embedders/mock_text_embedder.py` (modified, +3/-3)
```diff
@@ -70,13 +70,13 @@ def __init__(
         :param meta: Additional metadata merged into the output `meta`.
         :param prefix: A string to add at the beginning of the text before embedding.
         :param suffix: A string to add at the end of the text before embedding.
-        :raises ValueError: If both `embedding` and `embedding_fn` are provided, if `dimension` is not positive, or
-            if `embedding` is an empty list.
+        :raises ValueError: If both `embedding` and `embedding_fn` are provided, if `embedding` is an empty list,
+            or if neither is provided and `dimension` is not positive.
         :raises TypeError: If `embedding` is not a sequence of numbers.
         """
         if embedding is not None and embedding_fn is not None:
             raise ValueError("Pass either 'embedding' or 'embedding_fn', not both.")
-        if dimension <= 0:
+        if embedding is None and embedding_fn is None and dimension <= 0:
             raise ValueError("'dimension' must be a positive integer.")
 
         self.embedding = _coerce_embedding(embedding, name="'embedding'") if embedding is not None else None
```

**File**: `releasenotes/notes/fix-mock-embedder-dimension-f58b01fc4f125811.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+fixes:
+  - |
+    ``MockTextEmbedder`` and ``MockDocumentEmbedder`` now accept non-positive
+    ``dimension`` values when ``embedding`` or ``embedding_fn`` is provided,
+    matching the documented behavior. The default deterministic embedding mode
+    still requires a positive ``dimension``.
```

**File**: `test/components/embedders/test_mock_document_embedder.py` (modified, +9/-4)
```diff
@@ -18,6 +18,7 @@ class TestMockDocumentEmbedder:
         ("args", "kwargs", "match"),
         [
             (([0.1],), {"embedding_fn": _ones}, "either 'embedding' or 'embedding_fn'"),
+            ((), {"dimension": 0}, "must be a positive integer"),
             ((), {"dimension": -1}, "must be a positive integer"),
         ],
     )
@@ -38,12 +39,16 @@ def test_consistent_with_text_embedder(self):
         doc_embedding = MockDocumentEmbedder(dimension=8).run([Document(content="pizza")])["documents"][0].embedding
         assert text_embedding == doc_embedding
 
-    def test_fixed_embedding(self):
-        result = MockDocumentEmbedder([0.5, 0.5]).run([Document(content="a"), Document(content="b")])
+    @pytest.mark.parametrize("dimension", [768, 0, -1])
+    def test_fixed_embedding(self, dimension):
+        embedder = MockDocumentEmbedder([0.5, 0.5], dimension=dimension)
+        result = embedder.run([Document(content="a"), Document(content="b")])
         assert all(doc.embedding == [0.5, 0.5] for doc in result["documents"])
 
-    def test_embedding_fn(self):
-        result = MockDocumentEmbedder(embedding_fn=_ones).run([Document(content="a")])
+    @pytest.mark.parametrize("dimension", [768, 0, -1])
+    def test_embedding_fn(self, dimension):
+        embedder = MockDocumentEmbedder(embedding_fn=_ones, dimension=dimension)
+        result = embedder.run([Document(content="a")])
         assert result["documents"][0].embedding == [1.0, 1.0, 1.0]
 
     def test_meta_fields_to_embed_affect_embedding(self):
```

**File**: `test/components/embedders/test_mock_text_embedder.py` (modified, +8/-4)
```diff
@@ -27,6 +27,7 @@ class TestMockTextEmbedder:
         [
             (([0.1, 0.2],), {"embedding_fn": _ones}, ValueError, "either 'embedding' or 'embedding_fn'"),
             ((), {"dimension": 0}, ValueError, "must be a positive integer"),
+            ((), {"dimension": -1}, ValueError, "must be a positive integer"),
             (([],), {}, ValueError, "must not be empty"),
             ((["not", "numbers"],), {}, TypeError, "must be a sequence of numbers"),
         ],
@@ -51,13 +52,16 @@ def test_deterministic_distinguishes_texts(self):
             MockTextEmbedder(dimension=8).run("x")["embedding"] == MockTextEmbedder(dimension=8).run("x")["embedding"]
         )
 
-    def test_fixed_embedding(self):
-        embedder = MockTextEmbedder([0.1, 0.2, 0.3])
+    @pytest.mark.parametrize("dimension", [768, 0, -1])
+    def test_fixed_embedding(self, dimension):
+        embedder = MockTextEmbedder([0.1, 0.2, 0.3], dimension=dimension)
         assert embedder.run("anything")["embedding"] == [0.1, 0.2, 0.3]
         assert embedder.run("something else")["embedding"] == [0.1, 0.2, 0.3]
 
-    def test_embedding_fn(self):
-        assert MockTextEmbedder(embedding_fn=_ones).run("hello")["embedding"] == [1.0, 1.0, 1.0]
+    @pytest.mark.parametrize("dimension", [768, 0, -1])
+    def test_embedding_fn(self, dimension):
+        embedder = MockTextEmbedder(embedding_fn=_ones, dimension=dimension)
+        assert embedder.run("hello")["embedding"] == [1.0, 1.0, 1.0]
 
     def test_embedding_fn_invalid_return_raises(self):
         # embedding_fn deliberately returns a non-vector to exercise the runtime type check
```

---

### Incident Patch 10: `c08d7727` (2026-09-28)
**Commit Message**: build: require anyio>=4.14.2 to fix CVE-2026-63374 (#12995)

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ dependencies = [
   "networkx",               # Pipeline graphs
   "typing_extensions>=4.7", # Extended typing features (NotRequired, etc.)
   "httpx",
+  "anyio>=4.14.2",          # transitive via httpx and openai; floor for CVE-2026-63374 (GHSA-82r6-8w77-94w6)
   "numpy",
   "python-dateutil",
   "jsonschema",             # JsonSchemaValidator, Tool
```

**File**: `releasenotes/notes/bump-anyio-cve-2026-63374-eb59f9fed1c33085.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+security:
+  - |
+    Haystack now requires ``anyio>=4.14.2``. ``anyio`` is installed transitively through ``httpx`` and ``openai``;
+    versions before 4.14.2 are affected by CVE-2026-63374 (GHSA-82r6-8w77-94w6).
```

#### Recent Merged Pull Requests:
- **PR #13034** (2026-09-30): Bump unstable version and create unstable docs (@HaystackBot)
- **PR #13033** (2026-09-30): docs: sync Core Integrations API reference (monty) on Docusaurus (@HaystackBot)
- **PR #13028** (2026-09-30): docs: sync Core Integrations API reference (perplexity) on Docusaurus (@HaystackBot)
- **PR #13026** (closed): fix: handle CR line endings in CSVToDocument row mode (@Marcuswang0824)
- **PR #13023** (2026-09-30): build(deps): bump oss-fuzz-base/base-builder-python from `aac6099` to `ea2c867` in /.clusterfuzzlite (@dependabot[bot])
- **PR #13021** (closed): fix: store the response charset as encoding in LinkContentFetcher (@dfedoryshchev)
- **PR #13020** (2026-09-29): docs: sync Core Integrations API reference (pgvector) on Docusaurus (@HaystackBot)
- **PR #13019** (2026-09-29): docs: sync Core Integrations API reference (langfuse) on Docusaurus (@HaystackBot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
