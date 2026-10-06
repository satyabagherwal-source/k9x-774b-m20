# Forensic Learning Record (Deep Inspection): deepset-ai/haystack

> **Canonical Artifact**: `07_PROJECT_LEARNING/deepset-ai-haystack-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/deepset-ai/haystack](https://github.com/deepset-ai/haystack))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:39:39.701Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `deepset-ai/haystack`
- **Description**: Open-source AI orchestration framework for building context-engineered, production-ready LLM applications. Design modular pipelines and agent workflows with explicit control over retrieval, routing, memory, and generation. Built for scalable agents, RAG, multimodal applications, semantic search, and conversational systems.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 26672 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
        :returns: True if key exists in state, False otherwise
        """
        return key in self._data

    def to_dict(self, skip_keys: list[str] | None = None) -> dict[str, Any]:
        """
        Convert the State object to a dictionary.

        :param skip_keys: List of keys to skip during serialization
        :returns: Dictionary representation of the State object
        """
        skip_keys = skip_keys or []
        schema = {key: definition for key, definition in self.schema.items() if key not in skip_keys}
        data = {key: value for key, value in self._data.items() if key not in skip_keys}

        serialized = {}
        serialized["schema"] = _schema_to_dict(schema=schema)
        # Field-level fallback so a single non-serializable value omits only that field instead of
        # failing the whole State serialization.
        serialized["data"] = _serialize_with_field_fallback(payload=data, description="the agent's State data")

        return serialized

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "State":
        """
        Convert a dictionary back to a State object.
        """
        schema = _schema_from_dict(data.get("schema", {}))
        deserialized_data = _deserialize_value_with_schema(data.get("data", {}))
        return State(schema, deserialized_data)

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

### Core Architecture Module: `haystack/components/agents/utils.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

import re
from copy import deepcopy
from typing import Any

from haystack.components.agents.state.state import State
from haystack.components.builders.chat_prompt_builder import ChatPromptBuilder
from haystack.dataclasses import ChatMessage, ChatRole
from haystack.tools import Tool, Toolset, ToolsType

# Input/output token key conventions across chat generators: most report OpenAI-style
# `prompt_tokens`/`completion_tokens`; OpenAIResponsesChatGenerator reports `input_tokens`/`output_tokens`.
_INPUT_TOKEN_KEYS = ("prompt_tokens", "input_tokens")
_OUTPUT_TOKEN_KEYS = ("completion_tokens", "output_tokens")


# ---------------------------
# Run metadata helpers
# ---------------------------


def _accumulate_usage(current: Any, new: Any) -> Any:
    """
    Recursively sum numeric leaf values across two usage-like dicts.

    Used to aggregate `ChatMessage.meta["usage"]` payloads across LLM calls in a run. Nested dicts (e.g. OpenAI's
    `completion_tokens_details`) are merged recursively; numeric leaves are summed; other types fall back to the new
    value.

    :param current: The current accumulated usage data.
    :param new: The new usage data to merge in.
    """
    if isinstance(current, dict) and isinstance(new, dict):
        result = dict(current)
        for k, v in new.items():
            result[k] = _accumulate_usage(result[k], v) if k in result else deepcopy(v)
        return result
    if isinstance(current, (int, float)) and isinstance(new, (int, float)):
        return current + new
    return new


def _record_llm_usage(state: State, llm_messages: list[ChatMessage]) -> None:
    """
    Aggregate token usage from the latest LLM messages into the State.

    Only writes when at least one message reports `meta["usage"]`, so generators that don't surface usage data
    leave `token_usage` at its default empty dict rather than overwriting it.

    :param state: The Agent's State, used to read the running `token_usage` total and write back the new total.
    :param llm_messages: The ChatMessage objects returned from the latest LLM call. Token usage is read from each
        message's `meta["usage"]` field, if present.
    """
    current = state.data.get("token_usage")
    updated = False
    for msg in llm_messages:
        usage = msg.meta.get("usage")
        if isinstance(usage, dict):
            current = _accumulate_usage(current or {}, usage)
            updated = True
    if updated:
        state.set("token_usage", current)


def _record_tool_calls(state: State, tool_messages: list[ChatMessage]) -> None:
    """
    Increment per-tool call counts in the State for every successfully dispatched tool.

    :param state: The Agent's State, used to read the running `tool_call_counts` map and write back the new totals.
    :param tool_messages: The ChatMessage objects returned from the latest tool execution. Per-tool counts are
        incremented based on each message's `tool_call_result.origin.tool_name`.
    """
    counts = state.data.get("tool_call_counts") or {}
    updated = False
    for tm in tool_messages:
        if tm.tool_call_result is None:
            continue
        name = tm.tool_call_result.origin.tool_name
        counts[name] = counts.get(name, 0) + 1
        updated = True
    if updated:
        state.set("tool_call_counts", counts)


# ---------------------------
# Tool helpers
# ---------------------------


def _spawn_selection_copy(item: Tool | Toolset, selected_tool_names: set[str]) -> Toolset | None:
    """
    Return the per-run copy carrying the selection, or None if the item does not provide one.

    A Toolset with run-scoped state (e.g. SearchableToolset) overrides `spawn()` to return a copy that
    applies `selected_tool_names` itself. A plain Toolset returns itself from `spawn()` (it has nothing
    to isolate), and a standalone Tool has no `spawn()`: in both cases the caller applies the selection.

    :param item: A configured Tool or Toolset.
    :param selected_tool_names: The tool names selected for this run.
    :returns: The selection-carrying per-run copy, or None.
    """
    if not isinstance(item, Toolset):
        return None
    spawned = item.spawn(selected_tool_names=selected_tool_names)
    return spawned if spawned is not item else None


def _select_tools_by_name(configured_tools: ToolsType, names: list[str]) -> list[Tool | Toolset]:
    """
    Select configured tools by name for a single run.

    Standalone Tools are kept when their name is requested. A Toolset with run-scoped state (one overriding
    `spawn()`, such as SearchableToolset) is replaced by a per-run copy carrying the requested names, so its
    dynamic behavior (search/lazy-loading) is preserved without mutating the shared, configured Toolset. Any
    other Toolset is reduced to the matching Tools. The caller must warm up the tools before selection.

    :param configured_tools: The tools configured on the Agent.
    :param names: The requested tool names.
    :returns: The selected Tools and/or selection-scoped Toolset copies.
    :raises ValueError: If no tools were configured, or if any requested name is not a valid tool name.
    """
    if configured_tools is None:
        raise ValueError("No tools were configured for the Agent at initialization.")

    requested_names = set(names)
    items: list[Tool | Toolset] = (
        [configured_tools] if isinstance(configured_tools, Toolset) else list(configured_tools)
    )

    # Resolve the tools each item offers for selection
    selectable_per_item: list[tuple[Tool | Toolset, list[Tool]]] = []
    for item in items:
        selectable = item.get_selectable_tools() if isinstance(item, Toolset) else [item]
        selectable_per_item.append((item, selectable))

    valid_tool_names = {tool.name for _, selectable in selectable_per_item for tool in selectable}
    # A dynamic Toolset may look empty before its catalog is resolved, so emptiness is checked here.
    if not valid_tool_names:
        raise ValueError("No tools were configured for the Agent at initialization.")

    invalid_tool_names = requested_names - valid_tool_names
    if invalid_tool_names:
        raise ValueError(
            f"The following tool names are not valid: {invalid_tool_names}. Valid tool names are: {valid_tool_names}."
        )

    selected: list[Tool | Toolset] = []
    for item, selectable in selectable_per_item:
        matched = requested_names & {tool.name for tool in selectable}
        if not matched:
            continue
        run_copy = _spawn_selection_copy(item, matched)
        if run_copy is not None:
            selected.append(run_copy)
        else:
            # Select from `selectable`, the list the names were validated against: iterating a dynamic
            # Toolset could silently miss tools.
            selected.extend(tool for tool in selectable if tool.name in matched)
    return selected


def _spawn_tools(tools: ToolsType) -> ToolsType:
    """
    Return per-run copies of `tools`, replacing each Toolset with its `spawn()` (Tools are passed through).

    This isolates run-scoped Toolset state (e.g. a SearchableToolset's discovered tools and any active name
    selection) so that concurrent runs sharing the same configured Toolset — such as parallel sub-agent tool calls
    or concurrent requests against one Agent — don't corrupt each other. A plain Toolset has no run-scoped state
    and its `spawn()` returns itself unchanged.
    """
    if isinstance(tools, Toolset):
        return tools.spawn()
    return [item.spawn() if isinstance(item, Toolset) else item for item in tools]


# ---------------------------
# Context token helpers
# ---------------------------


def _first_numeric(usage: dict[str, Any], keys: tuple[str, ...]) -> int:
    """
    Return the first numeric value found under `keys` in `usage`, or 0 if none is present.

    :param usage: A ChatMessage `meta["usage"]` payload.
    :param keys: Candidate keys to check, in priority order.
    :returns: The first `int`/`float` value (as an `int`), or 0. bool values are skipped (not token counts).
    """
    for key in keys:
        value = usage.get(key)
        # bool is an int subclass, so exclude it explicitly: True/False is not a token count.
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            return int(value)
    return 0


def _context_tokens_from_usage(usage: dict[str, Any]) -> int:
    """
    Sum the input and output tokens reported in a single `meta["usage"]` dict.

    :param usage: A ChatMessage `meta["usage"]` payload.
    :returns: Input plus output tokens, or 0 if neither key convention is present.
    """
    return _first_numeric(usage, _INPUT_TOKEN_KEYS) + _first_numeric(usage, _OUTPUT_TOKEN_KEYS)


def _record_context_tokens(state: State, llm_messages: list[ChatMessage]) -> None:
    """
    Store the approximate current context-window token count from the latest LLM call.

    A chat-generator call returns a single reply, so only the last message is inspected. Unlike
    `token_usage`, which accumulates across the run, this value is replaced each call with that reply's
    prompt-plus-completion tokens. Only writes when usage is reported, so generators that don't surface
    usage leave the previous value untouched.

    :param state: The Agent's State, used to write the latest `context_tokens` count.
    :param llm_messages: The ChatMessage objects returned from the latest LLM call.
    """
    if not llm_messages:
        return
    usage = llm_messages[-1].meta.get("usage")
    if isinstance(usage, dict):
        tokens = _context_tokens_from_usage(usage)
        if tokens:
            state.set("context_tokens", tokens)


# ---------------------------
# Prompt helpers
# ---------------------------

# Regex to detect the Jinja2 chat template syntax
_JIN
```

### Core Architecture Module: `haystack/components/converters/image/image_utils.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

import base64
import mimetypes
from collections import defaultdict
from io import BytesIO
from pathlib import Path
from typing import TypedDict, Union

from typing_extensions import NotRequired

from haystack import logging
from haystack.dataclasses import ByteStream, Document
from haystack.dataclasses.image_content import IMAGE_MIME_TYPES, MIME_TO_FORMAT
from haystack.lazy_imports import LazyImport

with LazyImport("Run 'pip install pypdfium2'") as pypdfium2_import:
    from pypdfium2 import PdfDocument

with LazyImport("Run 'pip install pillow'") as pillow_import:
    from PIL import Image as PILImage
    from PIL.Image import Image
    from PIL.ImageFile import ImageFile


logger = logging.getLogger(__name__)


def _encode_image_to_base64(bytestream: ByteStream, size: tuple[int, int] | None = None) -> tuple[str | None, str]:
    """
    Encode an image from a ByteStream into a base64-encoded string.

    Optionally resize the image before encoding to improve performance for downstream processing.

    :param bytestream: ByteStream containing the image data.
    :param size: If provided, resizes the image to fit within the specified dimensions (width, height) while
        maintaining aspect ratio. This reduces file size, memory usage, and processing time, which is beneficial
        when working with models that have resolution constraints or when transmitting images to remote services.

    :returns:
        A tuple (mime_type, base64_str), where:
        - mime_type (Optional[str]): The mime type of the encoded image, determined from the original data or image
          content. Can be None if the mime type cannot be reliably identified.
        - base64_str (str): The base64-encoded string representation of the (optionally resized) image.
    """
    if size is None:
        if bytestream.mime_type is None:
            logger.warning(
                "No mime type provided for the image. "
                "This may cause compatibility issues with downstream systems requiring a specific mime type. "
                "Please provide a mime type for the image."
            )
        return bytestream.mime_type, base64.b64encode(bytestream.data).decode("utf-8")

    # Check the import
    pillow_import.check()

    # Load the image
    if bytestream.mime_type and bytestream.mime_type in MIME_TO_FORMAT:
        formats = [MIME_TO_FORMAT[bytestream.mime_type]]
    else:
        formats = None
    image: "ImageFile" = PILImage.open(BytesIO(bytestream.data), formats=formats)

    # NOTE: We prefer the format returned by PIL
    inferred_mime_type = image.get_format_mimetype() or bytestream.mime_type

    # Downsize the image in place
    if size is not None:
        # Set reducing_gap=None to disable multi-step shrink; better quality.
        # https://pillow.readthedocs.io/en/latest/reference/Image.html#PIL.Image.Image.thumbnail
        image.thumbnail(size=size, reducing_gap=None)

    # Convert the image to base64 string
    if not inferred_mime_type:
        logger.warning(
            "Could not determine mime type for image. Defaulting to 'image/jpeg'. "
            "Consider providing a mime_type parameter."
        )
        inferred_mime_type = "image/jpeg"
    return inferred_mime_type, _encode_pil_image_to_base64(image=image, mime_type=inferred_mime_type)


def _encode_pil_image_to_base64(image: Union["Image", "ImageFile"], mime_type: str = "image/jpeg") -> str:
    """
    Convert a PIL Image object to a base64-encoded string.

    Automatically converts images with transparency to RGB if saving as JPEG.

    :param image: A PIL Image or ImageFile object to encode.
    :param mime_type: The MIME type to use when encoding the image. Defaults to "image/jpeg".
    :returns:
        Base64-encoded string representing the image.
    """
    # Check the import
    pillow_import.check()

    # Convert image to RGB if it has an alpha channel and we are saving as JPEG
    if (mime_type == "image/jpeg" or mime_type == "image/jpg") and (
        image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)
    ):
        image = image.convert("RGB")

    buffered = BytesIO()
    form = MIME_TO_FORMAT.get(mime_type)
    if form is None:
        logger.warning("Could not determine format for mime type {mime_type}. Defaulting to JPEG.", mime_type=mime_type)
        form = "JPEG"
    image.save(buffered, format=form)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def _convert_pdf_to_images(
    *,
    bytestream: ByteStream,
    return_base64: bool = False,
    page_range: list[int] | None = None,
    size: tuple[int, int] | None = None,
) -> list[tuple[int, "Image"]] | list[tuple[int, str]]:
    """
    Convert a PDF file into a list of PIL Image objects or base64-encoded images.

    Checks PDF dimensions and adjusts size constraints based on aspect ratio.

    :param bytestream: ByteStream object containing the PDF data
    :param return_base64: If True, return base64-encoded images instead of PIL images.
    :param page_range: List of page numbers and/or page ranges to convert to images. Page numbers start at 1.
        If None, all pages in the PDF will be converted. Pages outside the valid range (1 to number of pages)
        will be skipped with a warning. For example, page_range=[1, 3] will convert only the first and third
        pages of the document. It also accepts printable range strings, e.g.:  ['1-3', '5', '8', '10-12']
        will convert pages 1, 2, 3, 5, 8, 10, 11, 12.
    :param size: If provided, resizes the image to fit within the specified dimensions (width, height) while
        maintaining aspect ratio. This reduces file size, memory usage, and processing time, which is beneficial
        when working with models that have resolution constraints or when transmitting images to remote services.

    :returns:
        A list of tuples, each tuple containing the page number and the PIL Image object or base64-encoded image string.
    """

    pypdfium2_import.check()
    pillow_import.check()

    try:
        pdf = PdfDocument(BytesIO(bytestream.data))
    except Exception as e:
        logger.warning(
            "Could not read PDF file {file_path}. Skipping it. Error: {error}",
            file_path=bytestream.meta.get("file_path"),
            error=e,
        )
        return []

    num_pages = len(pdf)
    if num_pages == 0:
        logger.warning("PDF file is empty: {file_path}", file_path=bytestream.meta.get("file_path"))
        pdf.close()
        return []

    all_pdf_images = []

    resolved_page_range = page_range or range(1, num_pages + 1)

    for page_number in resolved_page_range:
        if page_number < 1 or page_number > num_pages:
            logger.warning(
                "Page {page_number} is out of range for the PDF file {file_path}. Skipping it.",
                page_number=page_number,
                file_path=bytestream.meta.get("file_path"),
            )
            continue

        # Get dimensions of the page
        page = pdf[max(page_number - 1, 0)]  # Adjust for 0-based indexing
        _, _, width, height = page.get_mediabox()

        target_resolution_dpi = 300.0

        # From pypdfium2 docs: scale (float) – A factor scaling the number of pixels per PDF canvas unit. This defines
        # the resolution of the image. To convert a DPI value to a scale factor, multiply it by the size of 1 canvas
        # unit in inches (usually 1/72in).
        # https://pypdfium2.readthedocs.io/en/stable/python_api.html#pypdfium2._helpers.page.PdfPage.render
        target_scale = target_resolution_dpi / 72.0

        # Calculate potential pixels for target_dpi
        pixels_for_target_scale = width * height * target_scale**2

        pil_max_pixels = PILImage.MAX_IMAGE_PIXELS or int(1024 * 1024 * 1024 // 4 // 3)
        # 90% of PIL's default limit to prevent borderline cases
        pixel_limit = pil_max_pixels * 0.9

        scale = target_scale
        if pixels_for_target_scale > pixel_limit:
            logger.info(
                "Large PDF detected ({pixels:.2f} pixels). Resizing the image to fit the pixel limit.",
                pixels=pixels_for_target_scale,
            )
            scale = (pixel_limit / (width * height)) ** 0.5

        pdf_bitmap = page.render(scale=scale)

        image: "Image" = pdf_bitmap.to_pil()
        pdf_bitmap.close()
        if size is not None:
            # Set reducing_gap=None to disable multi-step shrink; better quality.
            # https://pillow.readthedocs.io/en/latest/reference/Image.html#PIL.Image.Image.thumbnail
            image.thumbnail(size=size, reducing_gap=None)

        all_pdf_images.append((page_number, image))

    pdf.close()

    if return_base64:
        return [
            (page_number, _encode_pil_image_to_base64(image, mime_type="image/jpeg"))
            for page_number, image in all_pdf_images
        ]

    return all_pdf_images


class _ImageSourceInfo(TypedDict):
    path: Path
    mime_type: str | None
    page_number: NotRequired[int]  # Only present for PDF documents


def _extract_image_sources_info(
    documents: list[Document], file_path_meta_field: str, root_path: str
) -> list[_ImageSourceInfo]:
    """
    Extracts the image source information from the documents.

    :param documents: List of documents to extract image source information from.
    :param file_path_meta_field: The metadata field in the Document that contains the file path to the image or PDF.
    :param root_path: The root directory path where document files are located.

    :returns:
        A list of _ImageSourceInfo dictionaries, each containing the path and type of the image.
        If the image is a PDF, the dictionary also contains the page number.
    :raises ValueError: If the document is missing the file_path_meta_field key in its metadata, the
```

### Core Architecture Module: `haystack/components/converters/utils.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

from copy import deepcopy
from enum import Enum
from pathlib import Path
from typing import Any

from haystack.dataclasses import ByteStream


class LinkFormat(Enum):
    """
    Supported formats for storing link information in a Document.
    """

    MARKDOWN = "markdown"
    PLAIN = "plain"
    NONE = "none"

    def __str__(self) -> str:
        return self.value

    @staticmethod
    def from_str(string: str) -> "LinkFormat":
        """
        Convert a string to a LinkFormat enum.
        """
        enum_map = {e.value: e for e in LinkFormat}
        link_format = enum_map.get(string.lower())
        if link_format is None:
            msg = f"Unknown link format '{string}'. Supported formats are: {list(enum_map.keys())}"
            raise ValueError(msg)
        return link_format


def get_bytestream_from_source(source: str | Path | ByteStream, guess_mime_type: bool = False) -> ByteStream:
    """
    Creates a ByteStream object from a source.

    :param source:
        A source to convert to a ByteStream. Can be a string (path to a file), a Path object, or a ByteStream.
    :param guess_mime_type:
        Whether to guess the mime type from the file.
    :return:
        A ByteStream object.
    """

    if isinstance(source, ByteStream):
        return source
    if isinstance(source, (str, Path)):
        bs = ByteStream.from_file_path(Path(source), guess_mime_type=guess_mime_type)
        bs.meta["file_path"] = str(source)
        return bs
    raise ValueError(f"Unsupported source type {type(source)}")


def normalize_metadata(meta: dict[str, Any] | list[dict[str, Any]] | None, sources_count: int) -> list[dict[str, Any]]:
    """
    Normalize the metadata input for a converter.

    Given all the possible value of the meta input for a converter (None, dictionary or list of dicts),
    makes sure to return a list of dictionaries of the correct length for the converter to use.

    :param meta: the meta input of the converter, as-is
    :param sources_count: the number of sources the converter received
    :returns: a list of dictionaries of the make length as the sources list

    Each source always gets its own independent dictionary. When ``meta`` is ``None`` or a single
    dictionary, a separate copy is returned for every source so that mutating one source's metadata
    downstream does not leak into the others.
    """
    if meta is None:
        return [{} for _ in range(sources_count)]
    if isinstance(meta, dict):
        return [deepcopy(meta) for _ in range(sources_count)]
    if isinstance(meta, list):
        if sources_count != len(meta):
            raise ValueError("The length of the metadata list must match the number of sources.")
        return meta
    raise ValueError("meta must be either None, a dictionary or a list of dictionaries.")

```

### Core Architecture Module: `haystack/components/embedders/mock_utils.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

import hashlib
import math
import random
from collections.abc import Callable

# A callable that derives an embedding from the (prepared) text to embed. It receives the text and returns the
# embedding as a list of floats.
EmbeddingFn = Callable[[str], list[float]]


def _l2_normalize(vector: list[float]) -> list[float]:
    """Return the L2-normalized vector, so that mock embeddings behave like real (unit-length) ones."""
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0.0:
        return vector
    return [value / norm for value in vector]


def _deterministic_embedding(text: str, dimension: int) -> list[float]:
    """
    Generate a deterministic, unit-length embedding from the given text.

    The same text always yields the same embedding, and different texts yield different embeddings, which makes mock
    embeddings usable in retrieval pipelines and reproducible across runs and processes. The seed is derived from a
    SHA-256 digest of the text (not the process-salted built-in `hash`) to guarantee cross-process stability.

    :param text: The text to embed.
    :param dimension: The number of dimensions of the resulting embedding.
    :returns: A deterministic, L2-normalized embedding of length `dimension`.
    """
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    seed = int.from_bytes(digest[:8], "big")
    rng = random.Random(seed)
    vector = [rng.uniform(-1.0, 1.0) for _ in range(dimension)]
    return _l2_normalize(vector)


def _coerce_embedding(value: object, *, name: str) -> list[float]:
    """
    Validate that `value` is a non-empty sequence of numbers and coerce it into a list of floats.

    :param value: The value to validate, e.g. a user-provided fixed embedding or the output of an `embedding_fn`.
    :param name: How to refer to `value` in error messages, e.g. ``"'embedding'"``.
    """
    if not isinstance(value, (list, tuple)) or not all(isinstance(item, (int, float)) for item in value):
        raise TypeError(f"{name} must be a sequence of numbers, got {type(value)}.")
    if len(value) == 0:
        raise ValueError(f"{name} must not be empty.")
    return [float(item) for item in value]


def _estimate_usage(texts: list[str]) -> dict[str, int]:
    """
    Roughly estimate token usage as whitespace-separated word counts.

    This is an approximation (not real tokenization) intended to give downstream code realistic-looking metadata.
    """
    prompt_tokens = sum(len(text.split()) for text in texts)
    return {"prompt_tokens": prompt_tokens, "total_tokens": prompt_tokens}

```

### Core Architecture Module: `haystack/components/generators/utils.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

import contextlib
import json
from collections.abc import Iterator
from typing import Any

from haystack import logging, tracing
from haystack.dataclasses import ChatMessage, ReasoningContent, StreamingChunk, ToolCall

logger = logging.getLogger(__name__)


@contextlib.contextmanager
def _trace_chat_generator_run(
    chat_generator: Any, generator_inputs: dict[str, Any], parent_span: tracing.Span | None = None
) -> Iterator[tracing.Span]:
    """
    Open a tracing span around a ChatGenerator call made internally by another component.

    Components that embed a ChatGenerator but do not return its `ChatMessage` replies (for example rankers,
    extractors or evaluators) would otherwise discard the LLM token usage carried in `reply.meta["usage"]`.
    Wrapping the internal call in this span re-exposes that usage to tracers via the `haystack.component.output`
    content tag, mirroring how the `Pipeline` traces its top-level components.

    The caller is responsible for setting the output tag inside the context, so it is skipped when the call fails:

    ```python
    with _trace_chat_generator_run(self._chat_generator, {"messages": messages}) as span:
        result = self._chat_generator.run(messages=messages)
        span.set_content_tag("haystack.component.output", result)
    ```

    :param chat_generator: The ChatGenerator being invoked.
    :param generator_inputs: The inputs passed to the generator, recorded as the span input content tag.
    :param parent_span: Explicit parent span. Defaults to the current span. Pass it explicitly when the generator
        runs in a worker thread, where the ambient span context does not propagate.
    """
    # Fall back to the active span so same-thread callers get correct nesting without passing a parent explicitly.
    parent_span = parent_span or tracing.tracer.current_span()
    with tracing.tracer.trace(
        "haystack.chat_generator.run",
        tags={"haystack.component.name": "chat_generator", "haystack.component.type": type(chat_generator).__name__},
        parent_span=parent_span,
    ) as span:
        span.set_content_tag("haystack.component.input", generator_inputs)
        yield span


def print_streaming_chunk(chunk: StreamingChunk) -> None:
    """
    Callback function to handle and display streaming output chunks.

    This function processes a `StreamingChunk` object by:
    - Printing tool call metadata (if any), including function names and arguments, as they arrive.
    - Printing tool call results when available.
    - Printing the main content (e.g., text tokens) of the chunk as it is received.

    The function outputs data directly to stdout and flushes output buffers to ensure immediate display during
    streaming.

    :param chunk: A chunk of streaming data containing content and optional metadata, such as tool calls and
        tool results.
    """
    if chunk.start and chunk.index and chunk.index > 0:
        # If this is the start of a new content block but not the first content block, print two new lines
        print("\n\n", flush=True, end="")

    ## Tool Call streaming
    if chunk.tool_calls:
        # Typically, if there are multiple tool calls in the chunk this means that the tool calls are fully formed and
        # not just a delta.
        for tool_call in chunk.tool_calls:
            # If chunk.start is True indicates beginning of a tool call
            # Also presence of tool_call.tool_name indicates the start of a tool call too
            if chunk.start:
                # If there is more than one tool call in the chunk, we print two new lines to separate them
                # We know there is more than one tool call if the index of the tool call is greater than the index of
                # the chunk.
                if chunk.index and tool_call.index > chunk.index:
                    print("\n\n", flush=True, end="")

                print(f"[TOOL CALL]\nTool: {tool_call.tool_name} \nArguments: ", flush=True, end="")

            # print the tool arguments
            if tool_call.arguments:
                print(tool_call.arguments, flush=True, end="")

    ## Tool Call Result streaming
    # Print tool call results if available.
    if chunk.tool_call_result:
        # Tool Call Result is fully formed so delta accumulation is not needed
        print(f"[TOOL RESULT]\n{chunk.tool_call_result.result}", flush=True, end="")

    ## Normal content streaming
    # Print the main content of the chunk (from ChatGenerator)
    if chunk.content:
        if chunk.start:
            print("[ASSISTANT]\n", flush=True, end="")
        print(chunk.content, flush=True, end="")

    ## Reasoning content streaming
    # Print the reasoning content of the chunk (from ChatGenerator)
    if chunk.reasoning:
        if chunk.start:
            print("[REASONING]\n", flush=True, end="")
        print(chunk.reasoning.reasoning_text, flush=True, end="")

    # End of LLM assistant message so we add two new lines
    # This ensures spacing between multiple LLM messages (e.g. Agent) or multiple Tool Call Results
    if chunk.finish_reason is not None:
        print("\n\n", flush=True, end="")


def _convert_streaming_chunks_to_chat_message(chunks: list[StreamingChunk]) -> ChatMessage:
    """
    Connects the streaming chunks into a single ChatMessage.

    :param chunks: The list of all `StreamingChunk` objects.

    :returns: The ChatMessage.
    """
    text = "".join([chunk.content for chunk in chunks])
    logprobs = []
    for chunk in chunks:
        if chunk.meta.get("logprobs"):
            logprobs.append(chunk.meta.get("logprobs"))
    tool_calls = []

    # Accumulate reasoning content from chunks
    reasoning_parts = [chunk.reasoning.reasoning_text for chunk in chunks if chunk.reasoning]
    reasoning = ReasoningContent(reasoning_text="".join(reasoning_parts)) if reasoning_parts else None

    # Process tool calls if present in any chunk
    tool_call_data: dict[int, dict[str, str]] = {}  # Track tool calls by index
    for chunk in chunks:
        if chunk.tool_calls:
            for tool_call in chunk.tool_calls:
                # We use the index of the tool_call to track the tool call across chunks since the ID is not always
                # provided
                if tool_call.index not in tool_call_data:
                    tool_call_data[tool_call.index] = {"id": "", "name": "", "arguments": ""}

                # Save the ID if present
                if tool_call.id is not None:
                    tool_call_data[tool_call.index]["id"] = tool_call.id

                if tool_call.tool_name is not None:
                    tool_call_data[tool_call.index]["name"] += tool_call.tool_name
                if tool_call.arguments is not None:
                    tool_call_data[tool_call.index]["arguments"] += tool_call.arguments

    # Convert accumulated tool call data into ToolCall objects
    sorted_keys = sorted(tool_call_data.keys())
    for key in sorted_keys:
        tool_call_dict = tool_call_data[key]
        try:
            arguments = json.loads(tool_call_dict.get("arguments", "{}")) if tool_call_dict.get("arguments") else {}
            tool_calls.append(ToolCall(id=tool_call_dict["id"], tool_name=tool_call_dict["name"], arguments=arguments))
        except json.JSONDecodeError:
            logger.warning(
                "The LLM provider returned a malformed JSON string for tool call arguments. This tool call "
                "will be skipped. To always generate a valid JSON, set `tools_strict` to `True`. "
                "Tool call ID: {_id}, Tool name: {_name}, Arguments: {_arguments}",
                _id=tool_call_dict["id"],
                _name=tool_call_dict["name"],
                _arguments=tool_call_dict["arguments"],
            )

    # finish_reason can appear in different places so we look for the last one
    finish_reasons = [chunk.finish_reason for chunk in chunks if chunk.finish_reason]
    finish_reason = finish_reasons[-1] if finish_reasons else None

    # usage info can appear in different chunks depending on the API provider
    # (e.g., OpenAI returns it in the last chunk with empty choices, but Qwen3 may return it differently)
    # so we look for the last non-None usage value across all chunks
    usage = None
    for chunk in reversed(chunks):
        chunk_usage = chunk.meta.get("usage")
        if chunk_usage is not None:
            usage = chunk_usage
            break

    first_chunk_meta = chunks[0].meta if chunks else {}
    last_chunk_meta = chunks[-1].meta if chunks else {}

    meta = {
        "model": last_chunk_meta.get("model"),
        "index": 0,
        "finish_reason": finish_reason,
        "completion_start_time": first_chunk_meta.get("received_at"),  # first chunk received
        "usage": usage,
    }

    if logprobs:
        meta["logprobs"] = logprobs

    return ChatMessage.from_assistant(text=text or None, tool_calls=tool_calls, reasoning=reasoning, meta=meta)


def _serialize_object(obj: Any) -> Any:
    """
    Convert an object to a serializable dict recursively.

    Used to serialize `logprobs` and `usage` from OpenAI SDK response objects, so it skips any
    attribute starting with "_" (SDK-internal fields). `base_serialization._serialize_value_with_schema`
    doesn't skip those, so don't swap this out for it.
    """
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "__dict__"):
        return {k: _serialize_object(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
    if isinstance(obj, dict):
        return {k: _serialize_object(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_object(item) for item in obj]
    return obj


def _normalize_messages(messages: list[ChatMessage] | str) -> list[ChatMessage]:
    """Normalize messages to a lis
```

### Core Architecture Module: `haystack/core/__init__.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

from .super_component import SuperComponent

__all__ = ["SuperComponent"]

```

### Core Architecture Module: `haystack/core/component/__init__.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

from haystack.core.component.component import Component, component
from haystack.core.component.types import InputSocket, OutputSocket

__all__ = ["component", "Component", "InputSocket", "OutputSocket"]

```

### Core Architecture Module: `haystack/core/component/component.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

"""
Attributes:

    component: Marks a class as a component. Any class decorated with `@component` can be used by a Pipeline.

All components must follow the contract below. This docstring is the source of truth for components contract.

<hr>

`@component` decorator

All component classes must be decorated with the `@component` decorator. This allows Haystack to discover them.

<hr>

`__init__(self, **kwargs)`

Optional method.

Components may have an `__init__` method where they define:

- `self.init_parameters = {same parameters that the __init__ method received}`:
    In this dictionary you can store any state the components wish to be persisted when they are saved.
    These values will be given to the `__init__` method of a new instance when the pipeline is loaded.
    Note that by default the `@component` decorator saves the arguments automatically.
    However, if a component sets their own `init_parameters` manually in `__init__()`, that will be used instead.
    Note: all of the values contained here **must be JSON serializable**. Serialize them manually if needed.

Components should take only "basic" Python types as parameters of their `__init__` function, or iterables and
dictionaries containing only such values. Anything else (objects, functions, etc) will raise an exception at init
time. If there's the need for such values, consider serializing them to a string.

If you need to accept classes or callables, accept either a string import path or the callable itself. Resolve strings
to objects in `__init__`, and serialize objects back to importable strings in `to_dict()` so that `from_dict()` can load
them (for example, store `"module_path.symbol_name"` and load it via `importlib`). This keeps init parameters JSON
serializable for pipeline save/load. See `haystack.testing.sample_components.accumulate.Accumulate` for a reference
implementation.

The `__init__` must be extremely lightweight, because it's a frequent operation during the construction and
validation of the pipeline. If a component has some heavy state to initialize (models, backends, etc...) refer to
the `warm_up()` method.

<hr>

`warm_up(self)`

Optional method.

This method is called by Pipeline before the graph execution. Make sure to avoid double-initializations,
because Pipeline will not keep track of which components it called `warm_up()` on.

<hr>

`run(self, data)`

Mandatory method.

This is the method where the main functionality of the component should be carried out. It's called by
`Pipeline.run()`.

When the component should run, Pipeline will call this method with an instance of the dataclass returned by the
method decorated with `@component.input`. This dataclass contains:

- all the input values coming from other components connected to it,
- if any is missing, the corresponding value defined in `self.defaults`, if it exists.

`run()` must return a single instance of the dataclass declared through the method decorated with
`@component.output`.

"""

import inspect
from collections.abc import Callable, Coroutine, Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from copy import deepcopy
from dataclasses import dataclass
from types import new_class
from typing import Any, ParamSpec, Protocol, TypeVar, overload, runtime_checkable

from haystack import logging
from haystack.core.errors import ComponentError
from haystack.core.type_utils import _resolve_parameter_types

from .sockets import Sockets
from .types import InputSocket, OutputSocket, _empty

logger = logging.getLogger(__name__)

RunParamsT = ParamSpec("RunParamsT")
RunReturnT = TypeVar("RunReturnT", bound=Mapping[str, Any] | Coroutine[Any, Any, Mapping[str, Any]])


@dataclass
class PreInitHookPayload:
    """
    Payload for the hook called before a component instance is initialized.

    :param callback:
        Receives the following inputs: component class and init parameter keyword args.
    :param in_progress:
        Flag to indicate if the hook is currently being executed.
        Used to prevent it from being called recursively (if the component's constructor
        instantiates another component).
    """

    callback: Callable
    in_progress: bool = False


_COMPONENT_PRE_INIT_HOOK: ContextVar[PreInitHookPayload | None] = ContextVar("component_pre_init_hook", default=None)


@contextmanager
def _hook_component_init(callback: Callable) -> Iterator[None]:
    """
    Context manager to set a callback that will be invoked before a component's constructor is called.

    The callback receives the component class and the init parameters (as keyword arguments) and can modify the init
    parameters in place.

    :param callback:
        Callback function to invoke.
    """
    token = _COMPONENT_PRE_INIT_HOOK.set(PreInitHookPayload(callback))
    try:
        yield
    finally:
        _COMPONENT_PRE_INIT_HOOK.reset(token)


@runtime_checkable
class Component(Protocol):
    """
    Note this is only used by type checking tools.

    In order to implement the `Component` protocol, custom components need to
    have a `run` method. The signature of the method and its return value
    won't be checked, i.e. classes with the following methods:

        def run(self, param: str) -> dict[str, Any]:
            ...

    and

        def run(self, **kwargs):
            ...

    will be both considered as respecting the protocol. This makes the type
    checking much weaker, but we have other places where we ensure code is
    dealing with actual Components.

    The protocol is runtime checkable so it'll be possible to assert:

        isinstance(MyComponent, Component)
    """

    # The following expression defines a run method compatible with any input signature.
    # Its type is equivalent to Callable[..., dict[str, Any]].
    # See https://typing.python.org/en/latest/spec/callables.html#meaning-of-in-callable.
    #
    # Using `run: Callable[..., dict[str, Any]]` directly leads to type errors: the protocol would expect a settable
    # attribute `run`, while the actual implementation is a read-only method.
    # For example:
    # from haystack import Pipeline, component
    # @component
    # class MyComponent:
    #     @component.output_types(out=str)
    #     def run(self):
    #         return {"out": "Hello, world!"}
    # pipeline = Pipeline()
    # pipeline.add_component("my_component", MyComponent())
    #
    # mypy raises:
    # error: Argument 2 to "add_component" of "PipelineBase" has incompatible type "MyComponent"; expected "Component"
    # [arg-type]
    # note: Protocol member Component.run expected settable variable, got read-only attribute

    def run(self, *args: Any, **kwargs: Any) -> Mapping[str, Any]:  # noqa: D102
        ...


class ComponentMeta(type):
    @staticmethod
    def _positional_to_kwargs(cls_type: type, args: tuple[Any, ...]) -> dict[str, Any]:
        """
        Convert positional arguments to keyword arguments based on the signature of the `__init__` method.
        """
        init_signature = inspect.signature(cls_type.__init__)  # type:ignore[misc]
        init_params = {name: info for name, info in init_signature.parameters.items() if name != "self"}

        out = {}
        for arg, (name, info) in zip(args, init_params.items(), strict=False):
            if info.kind == inspect.Parameter.VAR_POSITIONAL:
                raise ComponentError(
                    "Pre-init hooks do not support components with variadic positional args in their init method"
                )

            assert info.kind in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.POSITIONAL_ONLY)
            out[name] = arg
        return out

    @staticmethod
    def _parse_and_set_output_sockets(instance: Any) -> None:
        has_async_run = hasattr(instance, "run_async")

        # If `component.set_output_types()` was called in the component constructor,
        # `__haystack_output__` is already populated, no need to do anything.
        if not hasattr(instance, "__haystack_output__"):
            # If that's not the case, we need to populate `__haystack_output__`
            #
            # If either of the run methods were decorated, they'll have a field assigned that
            # stores the output specification. If both run methods were decorated, we ensure that
            # outputs are the same. We deepcopy the content of the cache to transfer ownership from
            # the class method to the actual instance, so that different instances of the same class
            # won't share this data.

            run_output_types = getattr(instance.run, "_output_types_cache", {})
            async_run_output_types = getattr(instance.run_async, "_output_types_cache", {}) if has_async_run else {}

            if has_async_run and run_output_types != async_run_output_types:
                raise ComponentError("Output type specifications of 'run' and 'run_async' methods must be the same")
            output_types_cache = run_output_types

            instance.__haystack_output__ = Sockets(instance, deepcopy(output_types_cache), OutputSocket)

    @staticmethod
    def _parse_and_set_input_sockets(component_cls: type, instance: Any) -> None:
        def inner(method: Callable[..., Any], sockets: Sockets) -> inspect.Signature:
            from inspect import Parameter

            run_signature = inspect.signature(method)
            # Resolves the annotations of components using postponed evaluation of annotations, where they are stored
            # as strings.
            param_types = _resolve_parameter_types(method)

            for param_name, param_info in run_signature.parameters.items():
                if param_name == "self" or param_info.kind in (Parameter.VAR_POSITIONAL, Parameter.VAR_KEYWORD):
                    continue

                socket_kwargs = {"nam
```

### Core Architecture Module: `haystack/core/component/sockets.py`
```
# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
#
# SPDX-License-Identifier: Apache-2.0

from typing import Any

from haystack.core.type_utils import _type_name

from .types import InputSocket, OutputSocket

SocketsDict = dict[str, InputSocket | OutputSocket]
SocketsIOType = type[InputSocket] | type[OutputSocket]


class Sockets:  # noqa: PLW1641
    """
    Represents the inputs or outputs of a `Component`.

    Depending on the type passed to the constructor, it will represent either the inputs or the outputs of
    the `Component`.

    Usage:
    ```python
    from typing import Any
    from haystack.components.builders.prompt_builder import PromptBuilder
    from haystack.core.component.sockets import Sockets
    from haystack.core.component.types import InputSocket, OutputSocket


    prompt_template = \"""
    Given these documents, answer the question.\nDocuments:
    {% for doc in documents %}
        {{ doc.content }}
    {% endfor %}

    \nQuestion: {{question}}
    \nAnswer:
    \"""

    prompt_builder = PromptBuilder(template=prompt_template)
    sockets = {"question": InputSocket("question", Any), "documents": InputSocket("documents", Any)}
    inputs = Sockets(component=prompt_builder, sockets_dict=sockets, sockets_io_type=InputSocket)
    inputs
    # >> Inputs:
    # >>   - question: Any
    # >>   - documents: Any

    inputs.question
    # >> InputSocket(name='question', type=typing.Any, default_value=<class 'haystack.core.component.types._empty'>, ...
    ```
    """

    # We're using a forward declaration here to avoid a circular import.
    def __init__(
        self,
        component: "Component",  # type: ignore[name-defined] # noqa: F821
        sockets_dict: SocketsDict,
        sockets_io_type: SocketsIOType,
    ) -> None:
        """
        Create a new Sockets object.

        We don't do any enforcement on the types of the sockets here, the `sockets_type` is only used for
        the `__repr__` method.
        We could do without it and use the type of a random value in the `sockets` dict, but that wouldn't
        work for components that have no sockets at all. Either input or output.

        :param component:
            The component that these sockets belong to.
        :param sockets_dict:
            A dictionary of sockets.
        :param sockets_io_type:
            The type of the sockets.
        """
        self._sockets_io_type = sockets_io_type
        self._component = component
        self._sockets_dict = sockets_dict
        self.__dict__.update(sockets_dict)

    def __eq__(self, value: object) -> bool:
        if not isinstance(value, Sockets):
            return False

        return (
            self._sockets_io_type == value._sockets_io_type
            and self._component == value._component
            and self._sockets_dict == value._sockets_dict
        )

    def __setitem__(self, key: str, socket: InputSocket | OutputSocket) -> None:
        """
        Adds a new socket to this Sockets object.

        This eases a bit updating the list of sockets after Sockets has been created.
        That should happen only in the `component` decorator.
        """
        self._sockets_dict[key] = socket
        self.__dict__[key] = socket

    def __contains__(self, key: str) -> bool:
        return key in self._sockets_dict

    def get(self, key: str, default: InputSocket | OutputSocket | None = None) -> InputSocket | OutputSocket | None:
        """
        Get a socket from the Sockets object.

        :param key:
            The name of the socket to get.
        :param default:
            The value to return if the key is not found.
        :returns:
            The socket with the given key or `default` if the key is not found.
        """
        return self._sockets_dict.get(key, default)

    def _component_name(self) -> str:
        if pipeline := self._component.__haystack_added_to_pipeline__:
            # This Component has been added in a Pipeline, let's get the name from there.
            return pipeline.get_component_name(self._component)

        # This Component has not been added to a Pipeline yet, so we can't know its name.
        # Let's use default __repr__. We don't call repr() directly as Components have a custom
        # __repr__ method and that would lead to infinite recursion since we call Sockets.__repr__ in it.
        return object.__repr__(self._component)

    def __getattribute__(self, name: Any) -> Any:
        try:
            sockets = object.__getattribute__(self, "_sockets")
            if name in sockets:
                return sockets[name]
        except AttributeError:
            pass

        return object.__getattribute__(self, name)

    def __repr__(self) -> str:
        result = ""
        if self._sockets_io_type == InputSocket:
            result = "Inputs:\n"
        elif self._sockets_io_type == OutputSocket:
            result = "Outputs:\n"

        return result + "\n".join([f"  - {n}: {_type_name(s.type)}" for n, s in self._sockets_dict.items()])

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13121** (2026-10-05): **build(deps): bump oss-fuzz-base/base-builder-python from `1de9e4a` to `b02a06f` in /.clusterfuzzlite**
  *Symptoms*: > [!WARNING] > Cooldown could not be applied because no publication date was available from the registry. >  Bumps oss-fuzz-base/base-builder-python from `1de9e4a` to `b02a06f`.   Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself) - `@dependabot ignore this dependency` will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)   </details>
  **Post-Mortem & Fix Analysis**:
  > [vc]: #i8jhIul1V4yvwBan2/2WRADVW2ayvHt2PZRQ31J5OsQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vZGVlcHNldC1haS9oYXlzdGFjay1kb2NzLzliODczSDNpUlpiQ3llczZBY1FTcTlGTUpaRGQiLCJwcmV2aWV3VXJsIjoiaGF5c3RhY2stZG9jcy1naXQtZGVwZW5kYWJvdC1kb2NrZXJkb3QtY2x1c3RlLTFjNDE0OS1kZWVwc2V0LWFpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiSUdOT1JFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwidjAiOmZhbHNlfV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWRlZXBzZXQtYWkmcmVwbz1oYXlzdGFjayZwcj0xMzEyMSJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="htt

- **Issue #13120** (2026-10-05): **docs: sync Core Integrations API reference (falkordb) on Docusaurus**
  *Symptoms*: This PR syncs the Core Integrations API reference (falkordb) on Docusaurus. Just approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #Z8CAeDaIT3QAEiKOKEwNWRcgri3IjbN9/c6YEKz36lA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vZGVlcHNldC1haS9oYXlzdGFjay1kb2NzL0Y2VGJCS0dOS0Vvdnk3TG1oYUxZUEQzWmdoUHgiLCJwcmV2aWV3VXJsIjoiaGF5c3RhY2stZG9jcy1naXQtc3luYy1kb2N1c2F1cnVzLWFwaS1yZWZlcmVuLTczZDJmNS1kZWVwc2V0LWFpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiSUdOT1JFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwicm9vdERpcmVjdG9yeSI6ImRvY3Mtd2Vic2l0ZSJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9ZGVlcHNldC1haSZyZXBvPWhheXN0YWNrJnByPTEzMTIwIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :-----

- **Issue #13118** (2026-10-05): **docs: sync Haystack API reference on Docusaurus**
  *Symptoms*: This PR syncs the Haystack API reference on Docusaurus. Just approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #cFXq1FBdCsz6AGs9gVxBxwi/4rNAx3L87ygNFvDlj3Q=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vZGVlcHNldC1haS9oYXlzdGFjay1kb2NzL0Z5Nk1DRnZRSmJQS1N5d1N2UDJ0aUNuUEd6cm8iLCJwcmV2aWV3VXJsIjoiaGF5c3RhY2stZG9jcy1naXQtc3luYy1kb2N1c2F1cnVzLWFwaS1yZWZlcmVuY2UtZGVlcHNldC1haS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzLXdlYnNpdGUifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWRlZXBzZXQtYWkmcmVwbz1oYXlzdGFjayZwcj0xMzExOCJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :---

- **Issue #13117** (2026-10-05): **docs: sync Haystack API reference on Docusaurus**
  *Symptoms*: This PR syncs the Haystack API reference on Docusaurus. Just approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #uf7+80mVB7Om6x6W/IHTWVnY7HxMMPVVy+dgxrmvl9s=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJyb290RGlyZWN0b3J5IjoiZG9jcy13ZWJzaXRlIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2RlZXBzZXQtYWkvaGF5c3RhY2stZG9jcy9BUjhVdVQ4a2N3ZmQxcnpGWXRGM2hxajRqWUNUIiwicHJldmlld1VybCI6ImhheXN0YWNrLWRvY3MtZ2l0LXN5bmMtZG9jdXNhdXJ1cy1hcGktcmVmZXJlbmNlLWRlZXBzZXQtYWkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9fV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWRlZXBzZXQtYWkmcmVwbz1oYXlzdGFjayZwcj0xMzExNyJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :---

- **Issue #13116** (2026-10-05): **docs: sync Haystack API reference on Docusaurus**
  *Symptoms*: This PR syncs the Haystack API reference on Docusaurus. Just approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #NNccAOFFZuJ8Hs/q03SLRHvF0FOtXHol6eOs5xexL/M=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vZGVlcHNldC1haS9oYXlzdGFjay1kb2NzL0NBRVJMMXhIaXBOTkNtbmVjbnNNclhoNjZnam0iLCJwcmV2aWV3VXJsIjoiaGF5c3RhY2stZG9jcy1naXQtc3luYy1kb2N1c2F1cnVzLWFwaS1yZWZlcmVuY2UtZGVlcHNldC1haS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzLXdlYnNpdGUifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWRlZXBzZXQtYWkmcmVwbz1oYXlzdGFjayZwcj0xMzExNiJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :---

- **Issue #13115** (2026-10-05): **docs: sync Haystack API reference on Docusaurus**
  *Symptoms*: This PR syncs the Haystack API reference on Docusaurus. Just approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #N+Z/jB+PiR6p52jK55vRcFGbaEjrRU2qsWwfWyMJt78=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJyb290RGlyZWN0b3J5IjoiZG9jcy13ZWJzaXRlIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2RlZXBzZXQtYWkvaGF5c3RhY2stZG9jcy80U05TSmV3TjNtQTIyTFQ0eXQ0c3pjdXNxbmh6IiwicHJldmlld1VybCI6ImhheXN0YWNrLWRvY3MtZ2l0LXN5bmMtZG9jdXNhdXJ1cy1hcGktcmVmZXJlbmNlLWRlZXBzZXQtYWkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9fV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWRlZXBzZXQtYWkmcmVwbz1oYXlzdGFjayZwcj0xMzExNSJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :---

- **Issue #13114** (2026-10-05): **docs: clarify `LLMRanker` behavior for empty queries, fallbacks, and `top_k` handling**
  *Symptoms*: ### Related Issues  - related to #13045 and #13051  ### Proposed Changes:   <!--- In case of a bug: Describe what caused the issue and how you solved it -->  <!--- In case of a feature: Describe what did you add and how it works --> This PR makes it explicit in the `LLMRanker` docstrings and docs page that `top_k` is not applied to the fallback documents. That's on purpose (see https://github.com/deepset-ai/haystack/pull/10794#discussion_r2923724272): the input documents aren't necessarily sorted by relevance, for example when they come from several retrievers joined together, so cutting them at `top_k` would drop documents more or less arbitrarily. #13045 and #13051 show the docs didn't make this clear enough.  Changes: - class docstring: the output can have fewer than `top_k` documents (or none), and on fallback the ranker returns all deduplicated input documents in their original order - `__init__`, `run` and `run_async`: `top_k`, `raise_on_failure`, `query` and `:returns:` now describe the fallback behavior, and the missing `:raises ValueError:` entries are added - `llmranker.mdx` (`docs/` and `version-3.3`): split the paragraph on `top_k` and fallback, and extended the `top_k` note. On fallback, the Retriever's `top_k` is what limits the number of documents passed on  ### How did you test it?  <!-- unit tests, integration tests, manual verification, instructions for manual tests --> Docs-only change, `hatch run fmt` passes.  ### Notes for the reviewer
  **Post-Mortem & Fix Analysis**:
  > [vc]: #weVZ2O15Tx3Qbzt1uEjSsQg7m6Ke1v7cHnRsKNvqITA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9kZWVwc2V0LWFpL2hheXN0YWNrLWRvY3MvOFllQUtkMm9RTk1HRG9VdUpuOFo1OHZVRWJRYSIsInByZXZpZXdVcmwiOiJoYXlzdGFjay1kb2NzLWdpdC1kb2NzLWxsbS1yYW5rZXItZmFsbGJhY2stdG9wLWstZGVlcHNldC1haS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImhheXN0YWNrLWRvY3MtZ2l0LWRvY3MtbGxtLXJhbmtlci1mYWxsYmFjay10b3Atay1kZWVwc2V0LWFpLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6ImRvY3Mtd2Vic2l0ZSJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9ZGVlcHNldC1haSZyZXBvPWhheXN0YWNrJnByPTEzMTE0In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Depl
  > ## Coverage report   <img title="Coverage for the whole project went from 95.8% to 95.8%" src="https://img.shields.io/badge/Coverage%20evolution-95%25%20%E2%86%92%2095%25-blue.svg"> <img title="100% of the statement lines added by this PR are covered" src="https://img.shields.io/badge/PR%20Coverage-100%25-brightgreen.svg"><details><summary>Click to see where and how coverage changed</summary><table><thead>   <tr><th>File</th><th>Statements</th><th>Missing</th><th>Coverage</th><th>Coverage<br>(new stmts)</th><th>Lines missing</th></tr> </thead> <tbody><tr> <td colspan="6">&nbsp;&nbsp;<b>haystack/components/rankers</b></td><tr> <td>&nbsp;&nbsp;<a href="https://github.com/deepset-ai/haystack/pull/13114/files#diff-c2f240859fcd7c8416ec4772759c49bd322755f381167770de654ee10ab67588">llm_ranker.py</a></td>  <td align="center"><a href="https://github.com/deepset-ai/haystack/pull/13114/files#diff-c2f240859fcd7c8416ec4772759c49bd322755f381167770de654ee10ab67588"><img title="This PR doesn't change 

- **Issue #13112** (2026-10-05): **docs: use OpenAIResponsesChatGenerator in docstring examples**
  *Symptoms*: ### Related Issues  - follow up to https://github.com/deepset-ai/haystack/pull/13111  While working on the optimization agent I realized its beneficial to keep api docstrings up to date on using latest models and really be concrete on recommended usage so the optimization agent makes better initial choices.   ### Proposed Changes:  Many docstring examples built `OpenAIChatGenerator()`, which runs GPT-5 models through Chat Completions. OpenAI [recommends the Responses API for all new projects](https://developers.openai.com/api/docs/guides/migrate-to-responses), and notes that reasoning models like GPT-5 perform better through it. Starting with GPT-5.4, Chat Completions also does not support tool calling with `reasoning_effort` values other than `none`.  - Examples in `Agent`, `LLM`, `ComponentTool`, `Toolset`, `SearchableToolset`, `SkillToolset`, the `from_function`, human-in-the-loop and budget hooks, `Pipeline`, `SuperComponent`, `ListJoiner`, `AnswerJoiner` and `PromptBuilder` now use `OpenAIResponsesChatGenerator()`. - Structured output and JSON mode examples use the Responses `text.format` form:   - `JsonSchemaValidator` uses `text: {"format": {"type": "json_object"}}`.   - `LLMMetadataExtractor` passes its schema with `"strict": True` and drops `max_completion_tokens`, `temperature` and `seed`.   - `LLMDocumentContentExtractor` passes its schema with `"strict": False`, since the schema keeps its keys optional and the Responses API otherwise rejects it. - T
  **Post-Mortem & Fix Analysis**:
  > [vc]: #X2Gf6PGCVbKk+QUD76TL3PQYM/xcNT6StluylcdvV6s=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoYXlzdGFjay1kb2NzIiwicHJvamVjdElkIjoicHJqXzV2VmdSTlQ1emZHRVNXdXlMSGdoZkxwdk15ek0iLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJoYXlzdGFjay1kb2NzLWdpdC1kb2NzLXJlc3BvbnNlcy1nZW5lcmF0b3ItaW4tNTMzZTUyLWRlZXBzZXQtYWkudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vZGVlcHNldC1haS9oYXlzdGFjay1kb2NzL0VjNkhuVWR0TE0xdzlCQkJtZ2RxOXpaOUg1OHoiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJyb290RGlyZWN0b3J5IjoiZG9jcy13ZWJzaXRlIiwicHJldmlld1VybCI6ImhheXN0YWNrLWRvY3MtZ2l0LWRvY3MtcmVzcG9uc2VzLWdlbmVyYXRvci1pbi01MzNlNTItZGVlcHNldC1haS52ZXJjZWwuYXBwIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1kZWVwc2V0LWFpJnJlcG89aGF5c3RhY2smcHI9MTMxMTIifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Pr
  > ## Coverage report   <img title="Coverage for the whole project went from 95.81% to 95.81%" src="https://img.shields.io/badge/Coverage%20evolution-95%25%20%E2%86%92%2095%25-blue.svg"> <img title="100% of the statement lines added by this PR are covered" src="https://img.shields.io/badge/PR%20Coverage-100%25-brightgreen.svg">  _This PR does not seem to contain any modification to coverable code._  <!-- This comment was produced by python-coverage-comment-action -->

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

### Incident Patch 1: `25f2523f` (2026-10-05)
**Commit Message**: docs: fix top 404s (legacy URL scheme + renamed reference API pages) (#12703)

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `docs-website/docusaurus.config.js` (modified, +16/-0)
```diff
@@ -260,6 +260,22 @@ j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
             from: '/docs/function-calling',
             to: '/docs/tool',
           },
+          {
+            from: '/docs/fastembedcolbertranker',
+            to: '/docs/fastembedlateinteractionranker',
+          },
+          {
+            from: '/docs/sentencewindowretrieval',
+            to: '/docs/sentencewindowretriever',
+          },
+          {
+            from: '/docs/pipeline-templates',
+            to: '/docs/pipelines',
+          },
+          {
+            from: '/docs/external-integrations-converters',
+            to: '/docs/converters',
+          },
         ],
         // Non-chat Generators removed from core integrations: redirect the old pages of every built docs
         // version (unprefixed, /docs/<version>/ and /docs/next/) to the corresponding ChatGenerator page.
```

**File**: `docs-website/vercel.json` (modified, +144/-4)
```diff
@@ -11,6 +11,146 @@
       "destination": "/docs/intro",
       "permanent": true
     },
+    {
+      "source": "/docs/api/:path*",
+      "destination": "/reference/",
+      "permanent": true
+    },
+    {
+      "source": "/v:ver/docs/:slug*",
+      "destination": "/docs/:slug*",
+      "permanent": true
+    },
+    {
+      "source": "/v:ver/reference/:slug*",
+      "destination": "/reference/:slug*",
+      "permanent": true
+    },
+    {
+      "source": "/v:ver/edit/:slug*",
+      "destination": "/docs/:slug*",
+      "permanent": true
+    },
+    {
+      "source": "/edit/:slug*",
+      "destination": "/docs/:slug*",
+      "permanent": true
+    },
+    {
+      "source": "/docs/:ver-unstable/:slug*",
+      "destination": "/docs/:slug*",
+      "permanent": true
+    },
+    {
+      "source": "/reference/:ver-unstable/:slug*",
+      "destination": "/reference/:slug*",
+      "permanent": true
+    },
+    {
+      "source": "/docs/next/:slug*",
+      "destination": "/docs/:slug*",
+      "permanent": true
+    },
+    {
+      "source": "/reference/next/:slug*",
+      "destination": "/reference/:slug*",
+      "permanent": true
+    },
+    {
+      "source": "/docs/latest/:slug*",
+      "destination": "/docs/:slug*",
+      "permanent": true
+    },
+    {
+      "source": "/reference/agent-api",
+      "destination": "/reference/agents-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/document-store-api",
+      "destination": "/reference/document-stores-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/pipelines-api",
+      "destination": "/reference/pipeline-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/tool-components-api",
+      "destination": "/reference/agents-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/human-in-the-loop-api",
+      "destination": "/reference/hooks-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/primitives-api",
+      "destination": "/reference/data-classes-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/shaper-api",
+      "destination": "/reference/converters-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/classifiers-api",
+      "destination": "/reference/routers-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/connectors-api",
+      "destination": "/reference/tools-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/websearch-api",
+      "destination": "/reference/integrations-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/integrations",
+      "destination": "/reference/integrations-api",
+      "permanent": true
+    },
+    {
+      "source": "/reference/audio-api",
+      "destination": "/docs/audio",
+      "permanent": true
+    },
+    {
+      "source": "/reference/readers-api",
+      "destination": "/docs/readers",
+      "permanent": true
+    },
+    {
+      "source": "/reference/reader-api",
+      "destination": "/docs/readers",
+      "permanent": true
+    },
+    {
+      "source": "/reference/experimental-supercomponents-api",
+      "destination": "/docs/supercomponents",
+      "permanent": true
+    },
+    {
+      "source": "/reference/component-api",
+      "destination": "/reference/",
+      "permanent": true
+    },
+    {
+      "source": "/reference/components",
+      "destination": "/reference/",
+      "permanent": true
+    },
+    {
+      "source": "/docs/retrieval-augmented-generation",
+      "destination": "/docs/advanced-rag-techniques",
+      "permanent": true
+    },
     {
       "source": "/reference/category/experiments-api",
       "destination": "/reference/",
@@ -33,17 +173,17 @@
     },
     {
       "source": "/reference/experimental-generators-api",
-      "destination": "/reference/",
+      "destination": "/reference/generators-api",
       "permanent": true
     },
     {
       "source": "/reference/experimental-preprocessors-api",
-      "destination": "/reference/",
+      "destination": "/reference/preprocessors-api",
       "permanent": true
     },
     {
       "source": "/reference/experimental-retrievers-api",
-      "destination": "/reference/",
+      "destination": "/reference/retrievers-api",
       "permanent": true
     },
     {
@@ -53,7 +193,7 @@
     },
     {
       "source": "/reference/experimental-writers-api",
-      "destination": "/reference/",
+      "destination": "/reference/document-writers-api",
       "permanent": true
     },
     {
```

---

### Incident Patch 2: `6a7e97ec` (2026-10-05)
**Commit Message**: build(deps): bump oss-fuzz-base/base-builder-python from `1de9e4a` to `b02a06f` in /.clusterfuzzlite (#13121)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.clusterfuzzlite/Dockerfile` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 # Pinned by digest for supply-chain integrity. Bump periodically (the OSS-Fuzz
 # base-builder is updated frequently with toolchain fixes); resolve a fresh digest with:
 #   docker buildx imagetools inspect gcr.io/oss-fuzz-base/base-builder-python:latest --format '{{.Manifest.Digest}}'
-FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:1de9e4ac301ddea42b8846480d5e4903580ed5071357c9173a4d26a4af65a6fa
+FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:b02a06f9d3918428825b1ebfa2c3627b591a5924a83436b8aaec40c85fd15b16
 
 COPY . $SRC/haystack
 WORKDIR $SRC/haystack
```

---

### Incident Patch 3: `da212420` (2026-10-05)
**Commit Message**: fix: parse empty tool call arguments in the non-streaming OpenAI generators (#13047)

**File**: `haystack/components/generators/chat/openai.py` (modified, +2/-1)
```diff
@@ -39,6 +39,7 @@
     ToolCallDelta,
     select_streaming_callback,
 )
+from haystack.dataclasses.chat_message import _parse_openai_tool_call_arguments
 from haystack.dataclasses.streaming_chunk import _invoke_streaming_callback
 from haystack.tools import (
     ToolsType,
@@ -668,7 +669,7 @@ def _convert_chat_completion_to_chat_message(
         for openai_tc in openai_tool_calls:
             arguments_str = openai_tc.function.arguments
             try:
-                arguments = json.loads(arguments_str)
+                arguments = _parse_openai_tool_call_arguments(arguments_str)
                 tool_calls.append(ToolCall(id=openai_tc.id, tool_name=openai_tc.function.name, arguments=arguments))
             except json.JSONDecodeError:
                 logger.warning(
```

**File**: `haystack/components/generators/chat/openai_responses.py` (modified, +2/-1)
```diff
@@ -29,6 +29,7 @@
     ToolCallDelta,
     select_streaming_callback,
 )
+from haystack.dataclasses.chat_message import _parse_openai_tool_call_arguments
 from haystack.dataclasses.streaming_chunk import FinishReason, _invoke_streaming_callback
 from haystack.tools import (
     ToolsType,
@@ -692,7 +693,7 @@ def _convert_response_to_chat_message(responses: Response | ParsedResponse) -> C
 
         elif output.type == "function_call":
             try:
-                arguments = json.loads(output.arguments)
+                arguments = _parse_openai_tool_call_arguments(output.arguments)
                 tool_calls.append(
                     ToolCall(
                         id=output.id, tool_name=output.name, arguments=arguments, extra={"call_id": output.call_id}
```

**File**: `releasenotes/notes/fix-openai-zero-argument-tool-call-e616b87f179be88b.yaml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+fixes:
+  - |
+    ``OpenAIChatGenerator`` and ``OpenAIResponsesChatGenerator`` no longer drop a tool call whose arguments are an
+    empty string, and no longer raise ``TypeError`` when they are ``null``, in non-streaming responses.
+    OpenAI-compatible servers such as vLLM send these for a tool with no parameters. Both now become empty
+    arguments, as they already did in streaming responses and in ``ChatMessage.from_openai_dict_format``.
```

**File**: `test/components/generators/chat/test_openai.py` (modified, +29/-0)
```diff
@@ -37,6 +37,7 @@
     OpenAIChatGenerator,
     _check_finish_reason,
     _convert_chat_completion_chunk_to_streaming_chunk,
+    _convert_chat_completion_to_chat_message,
     _make_schema_strict,
 )
 from haystack.components.generators.utils import print_streaming_chunk
@@ -2031,6 +2032,34 @@ def test_convert_usage_chunk_to_streaming_chunk(self) -> None:
         assert result.meta["model"] == "gpt-5-mini"
         assert result.meta["received_at"] is not None
 
+    @pytest.mark.parametrize("arguments", ["", None])
+    def test_convert_chat_completion_with_zero_argument_tool_call(self, arguments: str | None) -> None:
+        # OpenAI-compatible servers such as vLLM send an empty string or null for a tool with no parameters
+        completion = ChatCompletion(
+            id="1",
+            model="gpt-5-mini",
+            object="chat.completion",
+            created=1234567890,
+            choices=[
+                Choice(
+                    finish_reason="tool_calls",
+                    index=0,
+                    message=ChatCompletionMessage(
+                        role="assistant",
+                        tool_calls=[
+                            ChatCompletionMessageFunctionToolCall(
+                                id="1",
+                                type="function",
+                                function=Function.model_construct(name="get_time", arguments=arguments),
+                            )
+                        ],
+                    ),
+                )
+            ],
+        )
+        message = _convert_chat_completion_to_chat_message(completion, completion.choices[0])
+        assert message.tool_calls == [ToolCall(id="1", tool_name="get_time", arguments={})]
+
 
 class TestMakeSchemaStrict:
     def test_flat_object(self) -> None:
```

**File**: `test/components/generators/chat/test_openai_responses_conversion.py` (modified, +14/-0)
```diff
@@ -1296,6 +1296,20 @@ def test_convert_incomplete_response_with_finish_reason(
 
         assert message.meta["finish_reason"] == finish_reason
 
+    @pytest.mark.parametrize("arguments", ["", None])
+    def test_convert_zero_argument_function_call(self, arguments: str | None) -> None:
+        # OpenAI-compatible servers such as vLLM send an empty string or null for a tool with no parameters
+        function_call = ResponseFunctionToolCall.model_construct(
+            arguments=arguments, call_id="call_1", name="get_time", type="function_call", id="fc_1", status="completed"
+        )
+        response = Response.model_construct(output=[function_call], output_text=None, status="completed")
+
+        message = _convert_response_to_chat_message(response)
+
+        assert message.tool_calls == [
+            ToolCall(id="fc_1", tool_name="get_time", arguments={}, extra={"call_id": "call_1"})
+        ]
+
     def test_convert_system_message(self) -> None:
 
         message = ChatMessage.from_system("You are good assistant")
```

---

### Incident Patch 4: `87dba65f` (2026-10-02)
**Commit Message**: build(deps): bump vercel from 61.1.0 to 62.1.0 in /docs-website (#13086)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `docs-website/package.json` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
     "react-dom": "^19.0.0",
     "sharp": "^0.35.0",
     "turndown": "^7.2.2",
-    "vercel": "^61.1.0"
+    "vercel": "^62.1.0"
   },
   "devDependencies": {
     "@docusaurus/module-type-aliases": "3.10.2",
```

---

### Incident Patch 5: `10e72fcd` (2026-10-02)
**Commit Message**: build(deps): bump oss-fuzz-base/base-builder-python from `58f80c9` to `1de9e4a` in /.clusterfuzzlite (#13085)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.clusterfuzzlite/Dockerfile` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 # Pinned by digest for supply-chain integrity. Bump periodically (the OSS-Fuzz
 # base-builder is updated frequently with toolchain fixes); resolve a fresh digest with:
 #   docker buildx imagetools inspect gcr.io/oss-fuzz-base/base-builder-python:latest --format '{{.Manifest.Digest}}'
-FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:58f80c90a90944b68b8e70b98e38997ee9396225311cfb0f3aea78671446ab4e
+FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:1de9e4ac301ddea42b8846480d5e4903580ed5071357c9173a4d26a4af65a6fa
 
 COPY . $SRC/haystack
 WORKDIR $SRC/haystack
```

---

### Incident Patch 6: `0e4b7cd1` (2026-10-02)
**Commit Message**: fix: preserve row_number columns in CSVToDocument (#12788)

Co-authored-by: LimbC-C <[REDACTED_EMAIL]>
Co-authored-by: anakin87 <[REDACTED_EMAIL]>

**File**: `docs-website/docs/pipeline-components/converters/csvtodocument.mdx` (modified, +3/-0)
```diff
@@ -29,6 +29,9 @@ Converts CSV files to documents.
 The component uses UTF-8 encoding by default, but you may specify a different encoding if needed during initialization.
 You can optionally attach metadata to each document with a `meta` parameter when running the component.
 
+In row mode (`conversion_mode="row"`), `content_column` selects the column used as document content.
+The remaining columns become metadata, and `meta["row_number"]` records the zero-based row index.
+
 ## Usage
 
 ### On its own
```

**File**: `haystack/components/converters/csv.py` (modified, +1/-2)
```diff
@@ -215,7 +215,7 @@ def _build_document_from_row(
             Remaining row columns are added to ``meta`` with collision-safe
             keys (prefixed with ``csv_`` if needed).
         """
-        row_meta = dict(base_meta)
+        row_meta = {**base_meta, "row_number": row_index}
 
         # content (strict: content_column must exist; validated by caller)
         content = self._safe_value(row.get(content_column))
@@ -235,5 +235,4 @@ def _build_document_from_row(
                     suffix += 1
             row_meta[key_to_use] = self._safe_value(v)
 
-        row_meta["row_number"] = row_index
         return Document(content=content, meta=row_meta)
```

**File**: `releasenotes/notes/preserve-csv-row-number-column-7965b5c7df176503.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+fixes:
+  - |
+    ``CSVToDocument`` in row mode now preserves values from a CSV column named
+    ``row_number`` as ``csv_row_number`` in metadata (with a suffix on collision),
+    instead of overwriting them with the generated row index.
```

**File**: `test/components/converters/test_csv_to_document.py` (modified, +32/-21)
```diff
@@ -4,6 +4,7 @@
 
 import logging
 import os
+from pathlib import Path
 
 import pytest
 
@@ -138,28 +139,38 @@ def test_row_mode_with_content_column(self, tmp_path):
         assert docs[0].meta["row_number"] == 0
         assert os.path.basename(f) == docs[0].meta["file_path"]
 
-    def test_row_mode_meta_collision_prefixed(self, tmp_path):
-        # ByteStream meta has file_path and encoding; CSV also has those columns.
-        csv_text = "file_path,encoding,comment\r\nrowpath.csv,latin1,ok\r\n"
-        f = tmp_path / "collide.csv"
-        f.write_text(csv_text, encoding="utf-8")
-        bs = ByteStream.from_file_path(f)
-        bs.meta["file_path"] = str(f)
-        bs.meta["encoding"] = "utf-8"
+    def test_row_mode_row_number_as_content_column(self) -> None:
+        source = ByteStream(data=b"row_number,author\nrecord-42,Ada\n")
+        converter = CSVToDocument(conversion_mode="row")
 
-        conv = CSVToDocument(conversion_mode="row")
-        out = conv.run(sources=[bs], content_column="comment")
-        d = out["documents"][0]
-        # Original meta preserved
-        assert d.meta["file_path"] == os.path.basename(str(f))
-        assert d.meta["encoding"] == "utf-8"
-        # CSV columns stored with csv_ prefix (no clobber)
-        assert d.meta["csv_file_path"] == "rowpath.csv"
-        assert d.meta["csv_encoding"] == "latin1"
-        # content column isn't duplicated in meta
-        assert "comment" not in d.meta
-        assert d.meta["row_number"] == 0
-        assert d.content == "ok"
+        documents = converter.run(sources=[source], content_column="row_number")["documents"]
+
+        assert len(documents) == 1
+        assert documents[0].content == "record-42"
+        assert documents[0].meta == {"author": "Ada", "row_number": 0}
+
+    @pytest.mark.parametrize("column_name", ["file_path", "row_number"])
+    def test_row_mode_meta_collision_prefixed(self, tmp_path: Path, column_name: str) -> None:
+        # file_path collides with source metadata; row_number collides with the generated row index.
+        csv_text = f"{column_name},encoding,comment\r\nsource-value,latin1,ok\r\n"
+        path = tmp_path / "collide.csv"
+        path.write_text(csv_text, encoding="utf-8")
+        source = ByteStream.from_file_path(path)
+        source.meta["file_path"] = str(path)
+        source.meta["encoding"] = "utf-8"
+        converter = CSVToDocument(conversion_mode="row")
+
+        documents = converter.run(sources=[source], content_column="comment")["documents"]
+
+        assert len(documents) == 1
+        assert documents[0].content == "ok"
+        assert documents[0].meta == {
+            "file_path": "collide.csv",
+            "encoding": "utf-8",
+            "row_number": 0,
+            f"csv_{column_name}": "source-value",
+            "csv_encoding": "latin1",
+        }
 
     def test_row_mode_meta_collision_multiple_suffixes(self, tmp_path):
         """
```

---

### Incident Patch 7: `643d1b9a` (2026-10-02)
**Commit Message**: fix: raise a clear error when JsonSchemaValidator gets no messages (#13078)

**File**: `haystack/components/validators/json_schema.py` (modified, +5/-2)
```diff
@@ -129,9 +129,12 @@ def run(
         :return:  A dictionary with the following keys:
             - "validated": A list of messages if the last message is valid.
             - "validation_error": A list of messages if the last message is invalid.
-        :raises ValueError: If the last message has no text content, or if no JSON schema is provided either in
-            the `run` method or in the component init.
+        :raises ValueError: If `messages` is empty, if the last message has no text content, or if no JSON schema is
+            provided either in the `run` method or in the component init.
         """
+        if not messages:
+            raise ValueError("The provided list of messages is empty.")
+
         last_message = messages[-1]
         if last_message.text is None:
             raise ValueError(f"The provided ChatMessage has no text. ChatMessage: {last_message}")
```

**File**: `releasenotes/notes/json-schema-validator-empty-messages-e3fcbf73c284f0f4.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+fixes:
+  - |
+    ``JsonSchemaValidator.run()`` now raises a ``ValueError`` saying the message list is empty when it receives no
+    messages, instead of an ``IndexError`` from reading the last message.
```

**File**: `test/components/validators/test_json_schema.py` (modified, +6/-0)
```diff
@@ -85,6 +85,12 @@ def test_validates_message_against_json_schema(self, json_schema_github_compare,
         assert len(result["validated"]) == 1
         assert result["validated"][0] == message
 
+    def test_run_raises_clear_error_for_empty_messages(self, json_schema_github_compare):
+        validator = JsonSchemaValidator(json_schema=json_schema_github_compare)
+
+        with pytest.raises(ValueError, match="The provided list of messages is empty"):
+            validator.run([])
+
     def test_accepts_empty_json_schema(self):
         validator = JsonSchemaValidator(json_schema={})
         message = ChatMessage.from_assistant('{"anything": "is valid"}')
```

---

### Incident Patch 8: `414e6c76` (2026-10-02)
**Commit Message**: fix: sort SentenceWindowRetriever context before merging text (#12976)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: bogdankostic <[REDACTED_EMAIL]>

**File**: `docs-website/docs/pipeline-components/retrievers/sentencewindowretriever.mdx` (modified, +16/-5)
```diff
@@ -16,7 +16,7 @@ Use this component to retrieve neighboring sentences around relevant sentences t
 | **Most common position in a pipeline** | Used after the main Retriever component, like the `InMemoryEmbeddingRetriever` or any other Retriever. |
 | **Mandatory init variables** | `document_store`: An instance of a Document Store |
 | **Mandatory run variables** | `retrieved_documents`: A list of already retrieved documents for which you want to get a context window |
-| **Output variables** | `context_windows`: A list of strings  <br /> <br />`context_documents`: A list of documents ordered by `split_idx_start` |
+| **Output variables** | `context_windows`: A list of strings, one per retrieved document  <br /> <br />`context_documents`: A list of documents, grouped by retrieved document and ordered by `split_id` within each window |
 | **API reference** | [Retrievers](/reference/retrievers-api) |
 | **GitHub link** | https://github.com/deepset-ai/haystack/blob/main/haystack/components/retrievers/sentence_window_retriever.py |
 | **Package name** | `haystack-ai` |
@@ -25,13 +25,24 @@ Use this component to retrieve neighboring sentences around relevant sentences t
 
 ## Overview
 
-The "sentence window" is a retrieval technique that allows for the retrieval of the context around relevant sentences.
+Sentence-window retrieval is a technique for retrieving the context around relevant text. During indexing, documents are split into small chunks, such as sentences, and written to a Document Store. During retrieval, a Retriever such as `InMemoryEmbeddingRetriever` or `InMemoryBM25Retriever` finds the chunks most relevant to the query. `SentenceWindowRetriever` then fetches up to `window_size` chunks before and after each of them (3 by default) from the same source document.
 
-During indexing, documents are broken into smaller chunks or sentences and indexed. During retrieval, the sentences most relevant to a given query, based on a certain similarity metric, are retrieved.
+This combines the strengths of both chunk sizes: small chunks match a query precisely, and the surrounding window gives the LLM enough context to answer. Despite its name, the component works with chunks of any size, not only sentences. You can override `window_size` for a single call by passing it to `run()`.
 
-Once we have the relevant sentences, we can retrieve neighboring sentences to provide full context. The number of neighboring sentences to retrieve is defined by a fixed number of sentences before and after the relevant sentence.
+### Required metadata
 
-This component is meant to be used with other Retrievers, such as the `InMemoryEmbeddingRetriever`. These Retrievers find relevant sentences by comparing a query against indexed sentences using a similarity metric. Then, the `SentenceWindowRetriever` component retrieves neighboring sentences around the relevant ones by leveraging metadata stored in the `Document` object.
+The component uses these `meta` fields to find neighboring chunks:
+
+- `source_id`: identifies the original document a chunk comes from. To match on several fields, pass a list to `source_id_meta_field`.
+- `split_id`: the chunk's position within its source document. To use a different field, set `split_id_meta_field`.
+- `split_idx_start` (optional): the chunk's start position in the source text. If every chunk in a window has it, text that overlaps between chunks is removed when they're merged. Otherwise, the chunks are joined in `split_id` order without removing any overlap.
+
+[`DocumentSplitter`](../preprocessors/documentsplitter.mdx) and [`RecursiveDocumentSplitter`](../preprocessors/recursivesplitter.mdx) add all three fields. If a retrieved document is missing `source_id` or `split_id`, the component raises a `ValueError`. To pass such documents through unchanged instead, set `raise_on_missing_meta_fields=False`.
+
+### Outputs
+
+- `context_windows`: one string per retrieved document, in the same order, containing the merged text of its window.
+- `context_documents`: the documents in each window, grouped by retrieved document and ordered by `split_id` within each window. If two retrieved documents are close together, their windows overlap and the shared chunks appear in both.
 
 ## Usage
 
```

**File**: `docs-website/versioned_docs/version-3.3/pipeline-components/retrievers/sentencewindowretriever.mdx` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ Use this component to retrieve neighboring sentences around relevant sentences t
 | **Most common position in a pipeline** | Used after the main Retriever component, like the `InMemoryEmbeddingRetriever` or any other Retriever. |
 | **Mandatory init variables** | `document_store`: An instance of a Document Store |
 | **Mandatory run variables** | `retrieved_documents`: A list of already retrieved documents for which you want to get a context window |
-| **Output variables** | `context_windows`: A list of strings  <br /> <br />`context_documents`: A list of documents ordered by `split_idx_start` |
+| **Output variables** | `context_windows`: A list of strings, one per retrieved document  <br /> <br />`context_documents`: A list of documents, grouped by retrieved document and ordered by `split_id` within each window |
 | **API reference** | [Retrievers](/reference/retrievers-api) |
 | **GitHub link** | https://github.com/deepset-ai/haystack/blob/main/haystack/components/retrievers/sentence_window_retriever.py |
 | **Package name** | `haystack-ai` |
```

**File**: `haystack/components/retrievers/sentence_window_retriever.py` (modified, +13/-8)
```diff
@@ -192,9 +192,11 @@ def run(self, retrieved_documents: list[Document], window_size: int | None = Non
             A dictionary with the following keys:
                 - `context_windows`: A list of strings, where each string represents the concatenated text from the
                                      context window of the corresponding document in `retrieved_documents`.
-                - `context_documents`: A list `Document` objects, containing the retrieved documents plus the context
-                                      document surrounding them. The documents are sorted by the `split_idx_start`
-                                      meta field.
+                - `context_documents`: A list of `Document` objects, containing the retrieved documents plus the
+                                      context documents surrounding them, grouped by window in the order of
+                                      `retrieved_documents`. Within each window, the documents are sorted by the
+                                      meta field set in `split_id_meta_field`. Documents shared by overlapping
+                                      windows appear once per window.
 
         """
         window_size = self.window_size if window_size is None else window_size
@@ -223,9 +225,11 @@ async def run_async(self, retrieved_documents: list[Document], window_size: int
             A dictionary with the following keys:
                 - `context_windows`: A list of strings, where each string represents the concatenated text from the
                                      context window of the corresponding document in `retrieved_documents`.
-                - `context_documents`: A list `Document` objects, containing the retrieved documents plus the context
-                                      document surrounding them. The documents are sorted by the `split_idx_start`
-                                      meta field.
+                - `context_documents`: A list of `Document` objects, containing the retrieved documents plus the
+                                      context documents surrounding them, grouped by window in the order of
+                                      `retrieved_documents`. Within each window, the documents are sorted by the
+                                      meta field set in `split_id_meta_field`. Documents shared by overlapping
+                                      windows appear once per window.
 
         """
         window_size = self.window_size if window_size is None else window_size
@@ -322,8 +326,9 @@ def _assemble_context(
                 for fetched in fetched_documents
                 if self._is_in_window(fetched, source_ids, split_id - window_size, split_id + window_size)
             ]
-            context_text.append(self.merge_documents_text(context_docs))
-            context_documents.extend(sorted(context_docs, key=lambda d: d.meta[self.split_id_meta_field]))
+            context_docs_sorted = sorted(context_docs, key=lambda d: d.meta[self.split_id_meta_field])
+            context_text.append(self.merge_documents_text(context_docs_sorted))
+            context_documents.extend(context_docs_sorted)
 
         return {"context_windows": context_text, "context_documents": context_documents}
 
```

**File**: `releasenotes/notes/fix-sentence-window-retriever-context-order-a1267b171dea93bb.yaml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+fixes:
+  - |
+    Fixed ``SentenceWindowRetriever`` returning ``context_windows`` with the chunks in the wrong order when the
+    documents have no ``split_idx_start`` meta field, for example chunks produced by ``MarkdownHeaderSplitter``.
+    The chunks were concatenated in the order returned by the Document Store instead of by ``split_id``, so the
+    context passed to an LLM could be scrambled while ``context_documents`` was correctly sorted. The chunks are now
+    sorted by ``split_id`` before being merged, in both ``run`` and ``run_async``.
```

**File**: `test/components/retrievers/test_sentence_window_retriever.py` (modified, +4/-0)
```diff
@@ -284,6 +284,10 @@ def test_run_custom_fields(self, in_memory_doc_store):
         # run the retriever with a document whose content = "Sentence 4."
         result = retriever.run(retrieved_documents=[doc for doc in docs if doc.content == "Sentence 4."])
         assert len(result["context_documents"]) == 7
+        assert [doc.meta["split_id_test"] for doc in result["context_documents"]] == [1, 2, 3, 4, 5, 6, 7]
+        assert result["context_windows"] == [
+            "Sentence 1.Sentence 2.Sentence 3.Sentence 4.Sentence 5.Sentence 6.Sentence 7."
+        ]
 
     def test_run_with_multiple_source_ids(self, in_memory_doc_store):
         docs = [
```

**File**: `test/components/retrievers/test_sentence_window_retriever_async.py` (modified, +4/-0)
```diff
@@ -176,6 +176,10 @@ async def test_run_async_custom_fields(self, in_memory_doc_store):
         # run the retriever with a document whose content = "Sentence 4."
         result = await retriever.run_async(retrieved_documents=[doc for doc in docs if doc.content == "Sentence 4."])
         assert len(result["context_documents"]) == 7
+        assert [doc.meta["split_id_test"] for doc in result["context_documents"]] == [1, 2, 3, 4, 5, 6, 7]
+        assert result["context_windows"] == [
+            "Sentence 1.Sentence 2.Sentence 3.Sentence 4.Sentence 5.Sentence 6.Sentence 7."
+        ]
 
     @pytest.mark.asyncio
     async def test_run_async_with_multiple_source_ids(self, in_memory_doc_store):
```

---

### Incident Patch 9: `0d964476` (2026-10-02)
**Commit Message**: build(deps): bump oss-fuzz-base/base-builder-python from `ea2c867` to `58f80c9` in /.clusterfuzzlite (#13063)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.clusterfuzzlite/Dockerfile` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 # Pinned by digest for supply-chain integrity. Bump periodically (the OSS-Fuzz
 # base-builder is updated frequently with toolchain fixes); resolve a fresh digest with:
 #   docker buildx imagetools inspect gcr.io/oss-fuzz-base/base-builder-python:latest --format '{{.Manifest.Digest}}'
-FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:ea2c86745d082ab30d6717ede1492fbe488af681cf5b70586510d4ada8766024
+FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:58f80c90a90944b68b8e70b98e38997ee9396225311cfb0f3aea78671446ab4e
 
 COPY . $SRC/haystack
 WORKDIR $SRC/haystack
```

---

### Incident Patch 10: `7dc6a0a7` (2026-10-02)
**Commit Message**: docs: fix `_merge_super_component_pipelines` return description (#13011)

**File**: `haystack/core/pipeline/base.py` (modified, +1/-3)
```diff
@@ -1793,9 +1793,7 @@ def _merge_super_component_pipelines(self) -> tuple[networkx.MultiDiGraph, dict[
 
         :returns:
             A tuple containing:
-            - A networkx.MultiDiGraph with the expanded structure of the main pipeline and all it's SuperComponents
-            - A dictionary mapping component names to boolean indicating that this component was part of a
-              SuperComponent
+            - A networkx.MultiDiGraph with the expanded structure of the main pipeline and all its SuperComponents
             - A dictionary mapping component names to their SuperComponent name
         """
         merged_graph = self.graph.copy()
```

---

### Incident Patch 11: `6f2fee05` (2026-10-02)
**Commit Message**: fix: raise ValueError for reversed page ranges in expand_page_range (#11492)

Co-authored-by: Julian Risch <[REDACTED_EMAIL]>
Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `haystack/utils/misc.py` (modified, +5/-2)
```diff
@@ -61,8 +61,11 @@ def expand_page_range(page_range: list[str | int]) -> list[int]:
             if not parts[0].isdigit() or not parts[1].isdigit():
                 msg = "range must be a string in the format 'start-end'"
                 raise ValueError(f"Invalid page range: {page} - {msg}")
-            start, end = parts
-            expanded_page_range.extend(range(int(start), int(end) + 1))
+            start, end = int(parts[0]), int(parts[1])
+            if start > end:
+                msg = "start must be less than or equal to end"
+                raise ValueError(f"Invalid page range: '{parts[0]}-{parts[1]}' - {msg}")
+            expanded_page_range.extend(range(start, end + 1))
 
         else:
             msg = "range must be a string in the format 'start-end' or an integer"
```

**File**: `releasenotes/notes/fix-expand-page-range-reversed-range-8a3f2d1e4b9c5f7a.yaml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+fixes:
+  - |
+    Fixed ``expand_page_range`` silently dropping pages when a reversed range (e.g. ``"7-5"``) appeared
+    alongside valid entries. Mixed inputs like ``["1-3", "7-5", "8"]`` previously returned ``[1, 2, 3, 8]``
+    with no warning, losing pages 5-7. A reversed range now raises ``ValueError`` with a descriptive
+    message identifying the offending range.
```

**File**: `test/utils/test_misc.py` (modified, +13/-0)
```diff
@@ -198,3 +198,16 @@ def test_invalid_string_raises_value_error(self):
     def test_malformed_range_with_multiple_hyphens_raises_value_error(self):
         with pytest.raises(ValueError, match="Invalid page range"):
             expand_page_range(["1-3", "5-10-15"])
+
+    def test_reversed_range_alone_raises_value_error(self):
+        with pytest.raises(ValueError, match="Invalid page range.*start must be less than or equal to end"):
+            expand_page_range(["5-3"])
+
+    def test_reversed_range_mixed_raises_value_error(self):
+        # Previously, a reversed range mixed with valid entries silently dropped the reversed range.
+        # e.g. ["1-3", "7-5", "8"] would return [1, 2, 3, 8], losing pages 5-7 with no error.
+        with pytest.raises(ValueError, match="Invalid page range.*start must be less than or equal to end"):
+            expand_page_range(["1-3", "7-5", "8"])
+
+    def test_equal_start_end_is_valid(self):
+        assert expand_page_range(["3-3"]) == [3]
```

---

### Incident Patch 12: `f80bb293` (2026-10-01)
**Commit Message**: build(deps): bump vercel from 60.1.3 to 61.1.0 in /docs-website (#13064)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `docs-website/package.json` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
     "react-dom": "^19.0.0",
     "sharp": "^0.35.0",
     "turndown": "^7.2.2",
-    "vercel": "^60.1.3"
+    "vercel": "^61.1.0"
   },
   "devDependencies": {
     "@docusaurus/module-type-aliases": "3.10.2",
```

---

### Incident Patch 13: `472da278` (2026-10-01)
**Commit Message**: feat!: align `page_number` metadata across splitters and fix drift in overlapping splits (#13006)

Co-authored-by: Sebastian Husch Lee <[REDACTED_EMAIL]>

**File**: `docs-website/docs/pipeline-components/preprocessors/documentsplitter.mdx` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ description: "`DocumentSplitter` divides a list of text documents into a list of
 
 When `split_by="token"`, strings such as `<|endoftext|>` in the source document are tokenized as ordinary text. They are preserved in the chunks and count toward the token limit.
 
-A field `"source_id"` is added to each document's `meta` data to keep track of the original document that was split. Another meta field `"page_number"` is added to each document to keep track of the page it belonged to in the original document. Other metadata are copied from the original document.
+A field `"source_id"` is added to each document's `meta` data to keep track of the original document that was split. Another meta field `"page_number"` is added to each document with the page the chunk starts on, counted from the form feed (`\f`) characters in the original document. A chunk that spans a page break reports the page its text begins on. Other metadata are copied from the original document.
 
 The DocumentSplitter is compatible with the following DocumentStores:
 
```

**File**: `docs-website/docs/pipeline-components/preprocessors/embeddingbaseddocumentsplitter.mdx` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ This component splits documents based on embedding similarity using cosine dista
 
 It first splits text into sentences, optionally groups them, calculates embeddings for each group, and then uses cosine
 distance between sequential embeddings to determine split points. Any distance above the specified percentile is treated
-as a break point. The component also tracks page numbers based on form feed characters (`\f`) in the original document.
+as a break point. The component also tracks page numbers based on form feed characters (`\f`) in the original document, reporting the page each chunk starts on.
 
 This component is inspired by [5 Levels of Text Splitting](https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb) by Greg Kamradt.
 
```

**File**: `docs-website/docs/pipeline-components/preprocessors/markdownheadersplitter.mdx` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ Parameters you can set when initializing the component:
 Each output document's metadata includes:
 
 - `source_id`: ID of the original document.
-- `page_number`: Page number. Updated when `page_break_character` is found.
+- `page_number`: The page the chunk starts on, counted from the `page_break_character` occurrences that precede its text.
 - `split_id`: Index of the chunk within its parent.
 - `header`: The header text for this chunk.
 - `parent_headers`: List of parent header texts in hierarchy order.
```

**File**: `docs-website/docs/pipeline-components/preprocessors/recursivesplitter.mdx` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ The `RecursiveDocumentSplitter` expects a list of documents as input and returns
 
 When `split_unit="token"`, strings such as `<|endoftext|>` in the source document are tokenized as ordinary text. They are preserved in the chunks and count toward the token limit.
 
+A meta field `"page_number"` is added to each chunk with the page it starts on, counted from the form feed (`\f`) characters in the original document. A chunk that spans a page break reports the page its text begins on, matching [`DocumentSplitter`](documentsplitter.mdx).
+
 The separators are applied in the same order as they are defined in the list. The first separator is used on the text; any resulting chunk that is within the specified `chunk_size` is retained. For chunks that exceed the defined `chunk_size`, the next separator in the list is applied. If all separators are used and the chunk still exceeds the `chunk_size`, a hard split occurs based on the `chunk_size`, taking into account whether words or characters are used as counting units. This process is repeated until all chunks are within the limits of the specified `chunk_size`.
 
 ## Usage
```

**File**: `haystack/components/preprocessors/_page_numbers.py` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+# SPDX-FileCopyrightText: 2022-present deepset GmbH <info@deepset.ai>
+#
+# SPDX-License-Identifier: Apache-2.0
+
+"""
+The `page_number` convention shared by the splitters.
+
+Splitters record the page a chunk came from in its `page_number` metadata field, counting page breaks
+(form feed, "\f") in the source document. The page reported is the one the chunk's first non-page-break
+character lies on: a chunk that spans a page break belongs to the page it starts on, and page breaks a
+chunk opens with belong to that chunk's own page rather than to the page it was carved out of.
+"""
+
+
+def _leading_page_breaks(text: str, page_break_character: str = "\f") -> int:
+    """
+    Count how many pages a chunk's text starts past the page its first character is on.
+
+    This is the run of page breaks the chunk opens with, except for a chunk made up entirely of page
+    breaks: that chunk is an empty page and stays on the page it starts on, rather than being pushed onto
+    the following one. `split_by="page"` emits such chunks for every blank page.
+
+    :param text: The chunk to inspect.
+    :param page_break_character: The character sequence marking a page break.
+    :returns: The number of pages to advance, 0 if the chunk starts with anything but a page break or
+        consists only of page breaks.
+    """
+    if not page_break_character:
+        return 0
+
+    offset = 0
+    while text.startswith(page_break_character, offset):
+        offset += len(page_break_character)
+
+    # Nothing but page breaks: an empty page, which belongs to the page it starts on.
+    if offset >= len(text):
+        return 0
+    return offset // len(page_break_character)
```

**File**: `haystack/components/preprocessors/document_splitter.py` (modified, +4/-2)
```diff
@@ -9,6 +9,7 @@
 from more_itertools import windowed
 
 from haystack import Document, component, logging
+from haystack.components.preprocessors._page_numbers import _leading_page_breaks
 from haystack.components.preprocessors.sentence_tokenizer import Language, SentenceSplitter, nltk_imports
 from haystack.core.serialization import default_from_dict, default_to_dict
 from haystack.lazy_imports import LazyImport
@@ -199,7 +200,8 @@ def run(self, documents: list[Document]) -> dict[str, list[Document]]:
         :returns: A dictionary with the following key:
             - `documents`: List of documents with the split texts. Each document includes:
                 - A metadata field `source_id` to track the original document.
-                - A metadata field `page_number` to track the original page number.
+                - A metadata field `page_number` with the page the chunk starts on, counting form feed
+                  ("\f") characters in the original document.
                 - All other metadata copied from the original document.
 
         :raises TypeError: if the input is not a list of Documents.
@@ -450,7 +452,7 @@ def _create_docs_from_splits(
 
         for i, (txt, split_idx) in enumerate(zip(text_splits, splits_start_idxs, strict=True)):
             copied_meta = deepcopy(meta)
-            copied_meta["page_number"] = splits_pages[i]
+            copied_meta["page_number"] = splits_pages[i] + _leading_page_breaks(txt)
             copied_meta["split_id"] = i
             copied_meta["split_idx_start"] = split_idx
             doc = Document(content=txt, meta=copied_meta)
```

**File**: `haystack/components/preprocessors/embedding_based_document_splitter.py` (modified, +8/-6)
```diff
@@ -12,6 +12,7 @@
 
 from haystack import Document, component, logging
 from haystack.components.embedders.types import DocumentEmbedder
+from haystack.components.preprocessors._page_numbers import _leading_page_breaks
 from haystack.components.preprocessors.sentence_tokenizer import Language, SentenceSplitter
 from haystack.core.serialization import component_to_dict, default_from_dict, default_to_dict
 from haystack.utils.async_utils import _execute_component_async
@@ -179,7 +180,8 @@ def run(self, documents: list[Document]) -> dict[str, list[Document]]:
                 - A metadata field `source_id` to track the original document.
                 - A metadata field `split_id` to track the split number.
                 - A metadata field `split_idx_start` with the character offset of the chunk in the original document.
-                - A metadata field `page_number` to track the original page number.
+                - A metadata field `page_number` with the page the chunk starts on, counting form feed
+                  ("\f") characters in the original document.
                 - All other metadata copied from the original document.
 
         :raises RuntimeError: If the component wasn't warmed up.
@@ -220,7 +222,8 @@ async def run_async(self, documents: list[Document]) -> dict[str, list[Document]
                 - A metadata field `source_id` to track the original document.
                 - A metadata field `split_id` to track the split number.
                 - A metadata field `split_idx_start` with the character offset of the chunk in the original document.
-                - A metadata field `page_number` to track the original page number.
+                - A metadata field `page_number` with the page the chunk starts on, counting form feed
+                  ("\f") characters in the original document.
                 - All other metadata copied from the original document.
 
         :raises RuntimeError: If the component wasn't warmed up.
@@ -549,12 +552,11 @@ def _create_documents_from_splits(splits: list[str], original_doc: Document) ->
             split_meta["split_id"] = i
             split_meta["split_idx_start"] = current_char_pos
 
-            # Calculate page number for this split
-            # Count page breaks in the split itself
             page_breaks_in_split = split_text.count("\f")
 
-            # Calculate the page number for this split
-            split_meta["page_number"] = current_page
+            # current_page is the page this split's first character is on; a split that opens with page
+            # breaks starts its text on a later page.
+            split_meta["page_number"] = current_page + _leading_page_breaks(split_text)
 
             doc = Document(content=split_text, meta=split_meta)
             documents.append(doc)
```

**File**: `haystack/components/preprocessors/markdown_header_splitter.py` (modified, +19/-6)
```diff
@@ -8,6 +8,7 @@
 
 from haystack import Document, component, logging
 from haystack.components.preprocessors import DocumentSplitter
+from haystack.components.preprocessors._page_numbers import _leading_page_breaks
 
 logger = logging.getLogger(__name__)
 
@@ -294,8 +295,12 @@ def _apply_secondary_splitting(self, documents: list[tuple[Document, bool]]) ->
                     secondary_content_start_idx = header_match.end()
                     content_for_splitting = doc.content[secondary_content_start_idx:]
 
-            # The page this header chunk starts on; its splits are numbered relative to it.
-            chunk_start_page = doc.meta.get("page_number", 1)
+            # The page this header chunk's first character is on; its splits are numbered relative to it.
+            # doc.meta holds the page the chunk's *text* starts on, which already counts the breaks the chunk
+            # opens with, and page_break_ends below counts those same breaks again - so take them back off.
+            chunk_start_page = doc.meta.get("page_number", 1) - _leading_page_breaks(
+                doc.content, self.page_break_character
+            )
 
             clean_meta = {k: v for k, v in doc.meta.items() if k != "split_id"}
 
@@ -312,7 +317,11 @@ def _apply_secondary_splitting(self, documents: list[tuple[Document, bool]]) ->
                 while page_break_count < len(page_break_ends) and page_break_ends[page_break_count] <= split_start_idx:
                     page_break_count += 1
 
-                split.meta["page_number"] = chunk_start_page + page_break_count
+                split.meta["page_number"] = (
+                    chunk_start_page
+                    + page_break_count
+                    + _leading_page_breaks(split.content or "", self.page_break_character)
+                )
                 split.meta["split_id"] = current_split_id
                 if "source_id" in doc.meta:
                     split.meta["source_id"] = doc.meta["source_id"]
@@ -358,8 +367,11 @@ def _split_documents_by_markdown_headers(self, documents: list[Document]) -> lis
             )
             for split_idx, split in enumerate(splits):
                 meta = deepcopy(doc.meta) if doc.meta else {}
-                chunk_start_page = document_start_page + doc.content.count(
-                    self.page_break_character, 0, split["source_start_idx"]
+                chunk_start_page = (
+                    document_start_page
+                    + doc.content.count(self.page_break_character, 0, split["source_start_idx"])
+                    # breaks the chunk opens with end the previous page, so its text is on a later one
+                    + _leading_page_breaks(split["content"], self.page_break_character)
                 )
                 meta.update({"source_id": doc.id, "page_number": chunk_start_page, "split_id": split_idx})
                 from_header_split = split["from_header_split"]
@@ -386,7 +398,8 @@ def run(self, documents: list[Document]) -> dict[str, list[Document]]:
         :returns: A dictionary with the following key:
             - `documents`: List of documents with the split texts. Each document includes:
                 - A metadata field `source_id` to track the original document.
-                - A metadata field `page_number` to track the original page number.
+                - A metadata field `page_number` with the page the chunk starts on, counting
+                  `page_break_character` occurrences in the original document.
                 - A metadata field `split_id` to identify the split chunk index within its parent document.
                 - All other metadata copied from the original document.
         :raises ValueError: If a document has `None` content.
```

---

### Incident Patch 14: `c2642288` (2026-10-01)
**Commit Message**: fix: validate non-textual inputs in LostInTheMiddleRanker (#13037)

**File**: `haystack/components/rankers/lost_in_the_middle.py` (modified, +4/-4)
```diff
@@ -89,6 +89,10 @@ def run(
         if not documents:
             return {"documents": []}
 
+        # Raise an error if any document is not textual
+        if any(doc.content is None for doc in documents):
+            raise ValueError("Some provided documents are not textual; LostInTheMiddleRanker can process only text.")
+
         top_k = top_k or self.top_k
         word_count_threshold = word_count_threshold or self.word_count_threshold
 
@@ -99,10 +103,6 @@ def run(
         if len(documents_to_reorder) == 1:
             return {"documents": documents_to_reorder}
 
-        # Raise an error if any document is not textual
-        if any(doc.content is None for doc in documents_to_reorder):
-            raise ValueError("Some provided documents are not textual; LostInTheMiddleRanker can process only text.")
-
         # Initialize word count and indices for the "lost in the middle" order
         word_count = 0
         document_index = list(range(len(documents_to_reorder)))
```

**File**: `releasenotes/notes/lost-in-the-middle-single-document-validation-ae3c1958d46c7037.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+fixes:
+  - |
+    ``LostInTheMiddleRanker`` now validates all input documents before deduplication
+    and ``top_k`` selection, raising ``ValueError`` if any document is non-textual.
+    Previously, single-document selections and documents excluded by ``top_k``
+    could bypass the text-only validation.
```

**File**: `test/components/rankers/test_lost_in_the_middle.py` (modified, +14/-4)
```diff
@@ -36,11 +36,21 @@ def test_lost_in_the_middle_order_two_docs(self):
         assert result["documents"][0].content == "1"
         assert result["documents"][1].content == "2"
 
-    def test_lost_in_the_middle_with_non_textual_documents(self):
+    @pytest.mark.parametrize(
+        ("documents", "top_k"),
+        [
+            ([Document(blob=ByteStream(b"some bytes"))], None),
+            ([Document(content="text"), Document(blob=ByteStream(b"some bytes"))], None),
+            ([Document(content="text"), Document(blob=ByteStream(b"some bytes"))], 1),
+        ],
+    )
+    def test_lost_in_the_middle_with_non_textual_documents(self, documents, top_k):
         ranker = LostInTheMiddleRanker()
-        docs = [Document(content="1"), Document(blob=ByteStream(b"some bytes"))]
-        with pytest.raises(ValueError, match="Some provided documents are not textual"):
-            ranker.run(documents=docs)
+        with pytest.raises(
+            ValueError,
+            match=r"^Some provided documents are not textual; LostInTheMiddleRanker can process only text\.$",
+        ):
+            ranker.run(documents=documents, top_k=top_k)
 
     def test_lost_in_the_middle_init(self):
         # tests that LostInTheMiddleRanker initializes with default values
```

---

### Incident Patch 15: `3bcf7e7e` (2026-10-01)
**Commit Message**: fix: read abbreviation lists as UTF-8 regardless of locale (#13052)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `haystack/components/preprocessors/sentence_tokenizer.py` (modified, +1/-1)
```diff
@@ -253,4 +253,4 @@ def _read_abbreviations(lang: Language) -> list[str]:
             logger.warning("No abbreviations file found for {language}. Using default abbreviations.", language=lang)
             return []
 
-        return abbreviations_file.read_text().split("\n")
+        return abbreviations_file.read_text(encoding="utf-8").split("\n")
```

**File**: `haystack/telemetry/_telemetry.py` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ def __init__(self) -> None:
             CONFIG_PATH.parents[0].mkdir(parents=True, exist_ok=True)
             self.user_id = str(uuid.uuid4())
             try:
-                with open(CONFIG_PATH, "w") as outfile:
+                with open(CONFIG_PATH, "w", encoding="utf-8") as outfile:
                     yaml.dump({"user_id": self.user_id}, outfile, default_flow_style=False)
             except Exception as e:
                 logger.debug(
```

**File**: `releasenotes/notes/fix-abbreviations-utf8-encoding-bdf9898418474195.yaml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+fixes:
+  - |
+    ``SentenceSplitter`` now reads its curated abbreviation lists as UTF-8 regardless of the system locale.
+    Previously, on Windows, the German list was decoded with the ANSI code page (for example cp1252), so
+    abbreviations containing umlauts or ``ß``, such as ``ggü.`` or ``außenpol.``, were garbled and did not
+    prevent sentence splits when ``extend_abbreviations=True``.
```

**File**: `test/components/preprocessors/test_sentence_tokenizer.py` (modified, +13/-0)
```diff
@@ -72,6 +72,19 @@ def test_read_abbreviations_missing_file(caplog: LogCaptureFixture) -> None:
         assert "No abbreviations file found for pt. Using default abbreviations." in caplog.text
 
 
+def test_read_abbreviations_decodes_utf8_regardless_of_locale() -> None:
+    # simulate a Windows locale: without an explicit encoding, the file would be decoded as cp1252
+    original_read_text = Path.read_text
+
+    def read_text_with_cp1252_default(self, encoding=None, *args, **kwargs):
+        return original_read_text(self, encoding or "cp1252", *args, **kwargs)
+
+    with patch.object(Path, "read_text", read_text_with_cp1252_default):
+        abbreviations = SentenceSplitter._read_abbreviations("de")
+
+    assert "ggü" in abbreviations
+
+
 def test_quote_spans_regex():
     # double quotes
     text1 = 'He said "Hello world" and left.'
```

#### Recent Merged Pull Requests:
- **PR #13121** (2026-10-05): build(deps): bump oss-fuzz-base/base-builder-python from `1de9e4a` to `b02a06f` in /.clusterfuzzlite (@dependabot[bot])
- **PR #13120** (2026-10-05): docs: sync Core Integrations API reference (falkordb) on Docusaurus (@HaystackBot)
- **PR #13118** (2026-10-05): docs: sync Haystack API reference on Docusaurus (@HaystackBot)
- **PR #13117** (2026-10-05): docs: sync Haystack API reference on Docusaurus (@HaystackBot)
- **PR #13116** (2026-10-05): docs: sync Haystack API reference on Docusaurus (@HaystackBot)
- **PR #13115** (2026-10-05): docs: sync Haystack API reference on Docusaurus (@HaystackBot)
- **PR #13114** (2026-10-05): docs: clarify `LLMRanker` behavior for empty queries, fallbacks, and `top_k` handling (@bogdankostic)
- **PR #13112** (2026-10-05): docs: use OpenAIResponsesChatGenerator in docstring examples (@sjrl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
