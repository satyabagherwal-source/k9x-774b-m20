# Forensic Learning Record (Deep Inspection): Mirascope/mirascope

> **Canonical Artifact**: `07_PROJECT_LEARNING/mirascope-mirascope-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Mirascope/mirascope](https://github.com/Mirascope/mirascope))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:33:58.600Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Mirascope/mirascope`
- **Description**: The LLM Anti-Framework
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1531 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/examples/tools/loop.py`
```
import math

from mirascope import llm


@llm.tool
def sqrt_tool(number: float) -> float:
    """Computes the square root of a number"""
    return math.sqrt(number)


@llm.tool
def sum_tool(numbers: list[float]) -> float:
    total = 0
    for number in numbers:
        total += number
    return total


@llm.call("openai/gpt-5-mini", tools=[sqrt_tool, sum_tool])
def math_assistant(query: str):
    return query


response = math_assistant("What's the sum of the square roots of 137, 4242, and 6900?")

while response.tool_calls:
    tool_outputs = response.execute_tools()
    response = response.resume(tool_outputs)

print(response.pretty())
# sqrt(137) + sqrt(4242) + sqrt(6900) ≈ 159.9015764916355

```

### Core Architecture Module: `python/mirascope/_utils.py`
```
"""Shared internal utilities for mirascope."""

from typing import Any

# Attributes to copy from wrapped functions (matches functools.WRAPPER_ASSIGNMENTS)
WRAPPER_ASSIGNMENTS = (
    "__module__",
    "__name__",
    "__qualname__",
    "__annotations__",
    "__doc__",
)


def copy_function_metadata(target: Any, source: Any) -> None:  # noqa: ANN401
    """Copy standard function metadata from source to target.

    Copies __module__, __name__, __qualname__, __annotations__, __doc__
    from source to target, and sets __wrapped__ to source.

    This enables decorator stacking by preserving the original function's
    metadata on wrapper objects.

    Args:
        target: The wrapper object to copy metadata to
        source: The original function to copy metadata from
    """
    for attr in WRAPPER_ASSIGNMENTS:
        try:
            value = getattr(source, attr)
            object.__setattr__(target, attr, value)
        except AttributeError:
            pass
    object.__setattr__(target, "__wrapped__", source)

```

### Core Architecture Module: `python/mirascope/llm/context/_utils.py`
```
import inspect
import typing
from collections.abc import Callable
from typing import Any, get_origin

from .context import Context


def first_param_is_context(fn: Callable[..., Any]) -> bool:
    """Returns whether the first argument to a function is `ctx: Context`.

    Also returns true if the first argument is a subclass of `Context`.
    Skips the first argument if it is `self` or `cls`.
    """
    sig = inspect.signature(fn)
    params = list(sig.parameters.values())
    if not params:
        return False

    if params[0].name in ("self", "cls") and len(params) > 1:
        first_param = params[1]
    else:
        first_param = params[0]

    if first_param.name != "ctx":
        return False

    try:
        hints = typing.get_type_hints(fn)
        annotation = hints.get(first_param.name)
    except (NameError, AttributeError, TypeError):
        annotation = first_param.annotation

    if annotation is None or annotation is inspect.Parameter.empty:
        return False

    type_is_context = get_origin(annotation) is Context
    subclass_of_context = isinstance(annotation, type) and issubclass(
        annotation, Context
    )
    return type_is_context or subclass_of_context

```

### Core Architecture Module: `python/mirascope/llm/messages/_utils.py`
```
"""Utility functions for message handling."""

from collections.abc import Sequence
from typing_extensions import TypeIs

from .message import (
    AssistantMessage,
    Message,
    SystemMessage,
    UserContent,
    UserMessage,
    user,
)


def is_messages(
    content: UserContent | Sequence[Message],
) -> TypeIs[Sequence[Message]]:
    if isinstance(content, list):
        if not content:
            raise ValueError("Empty array may not be used as message content")
        return isinstance(content[0], SystemMessage | UserMessage | AssistantMessage)
    return False


def promote_to_messages(content: UserContent | Sequence[Message]) -> Sequence[Message]:
    """Promote a prompt result to a list of messages.

    If the result is already a list of Messages, returns it as-is.
    If the result is str/UserContentPart/Sequence of content parts, wraps it in a user message.
    """
    if is_messages(content):
        return content
    return [user(content)]

```

### Core Architecture Module: `python/mirascope/llm/prompts/_utils.py`
```
import inspect
from typing_extensions import TypeIs

from ..context import DepsT, _utils as _context_utils
from ..types import P
from .protocols import (
    AsyncContextMessageTemplate,
    AsyncMessageTemplate,
    ContextMessageTemplate,
    MessageTemplate,
)


def is_context_promptable(
    fn: ContextMessageTemplate[P, DepsT]
    | AsyncContextMessageTemplate[P, DepsT]
    | MessageTemplate[P]
    | AsyncMessageTemplate[P],
) -> TypeIs[ContextMessageTemplate[P, DepsT] | AsyncContextMessageTemplate[P, DepsT]]:
    """Type guard to check if a function is a context promptable function."""
    return _context_utils.first_param_is_context(fn)


def is_async_promptable(
    fn: ContextMessageTemplate[P, DepsT]
    | AsyncContextMessageTemplate[P, DepsT]
    | MessageTemplate[P]
    | AsyncMessageTemplate[P],
) -> TypeIs[AsyncMessageTemplate[P] | AsyncContextMessageTemplate[P, DepsT]]:
    """Type guard to check if a function is an async promptable function."""
    return inspect.iscoroutinefunction(fn)

```

### Core Architecture Module: `python/mirascope/llm/providers/anthropic/_utils/__init__.py`
```
"""Shared Anthropic utilities."""

from ...base._utils import get_include_thoughts
from .decode import decode_async_stream, decode_response, decode_stream
from .encode import (
    DEFAULT_FORMAT_MODE,
    DEFAULT_MAX_TOKENS,
    AnthropicImageMimeType,
    encode_image_mime_type,
    encode_request,
    process_params,
)
from .errors import ANTHROPIC_ERROR_MAP

__all__ = [
    "ANTHROPIC_ERROR_MAP",
    "DEFAULT_FORMAT_MODE",
    "DEFAULT_MAX_TOKENS",
    "AnthropicImageMimeType",
    "decode_async_stream",
    "decode_response",
    "decode_stream",
    "encode_image_mime_type",
    "encode_request",
    "get_include_thoughts",
    "process_params",
]

```

### Core Architecture Module: `python/mirascope/llm/providers/anthropic/_utils/beta_decode.py`
```
"""Beta Anthropic response decoding."""

import json
from typing import Any, TypeAlias, cast

from anthropic.lib.streaming._beta_messages import (
    BetaAsyncMessageStreamManager,
    BetaMessageStreamManager,
)
from anthropic.types.beta import (
    BetaContentBlock,
    BetaRawMessageStreamEvent,
    BetaRedactedThinkingBlockParam,
    BetaTextBlockParam,
    BetaThinkingBlockParam,
    BetaToolUseBlockParam,
)
from anthropic.types.beta.parsed_beta_message import ParsedBetaMessage

from ....content import (
    AssistantContentPart,
    Text,
    TextChunk,
    TextEndChunk,
    TextStartChunk,
    Thought,
    ThoughtChunk,
    ThoughtEndChunk,
    ThoughtStartChunk,
    ToolCall,
    ToolCallChunk,
    ToolCallEndChunk,
    ToolCallStartChunk,
)
from ....messages import AssistantMessage
from ....responses import (
    AsyncChunkIterator,
    ChunkIterator,
    FinishReason,
    FinishReasonChunk,
    RawMessageChunk,
    RawStreamEventChunk,
    Usage,
    UsageDeltaChunk,
)
from ..model_id import model_name
from .decode import decode_usage, extract_tool_usage

BETA_FINISH_REASON_MAP = {
    "max_tokens": FinishReason.MAX_TOKENS,
    "refusal": FinishReason.REFUSAL,
    "model_context_window_exceeded": FinishReason.CONTEXT_LENGTH_EXCEEDED,
}


def _decode_beta_assistant_content(
    content: BetaContentBlock,
) -> AssistantContentPart | None:
    """Convert Beta content block to mirascope AssistantContentPart."""
    if content.type == "text":
        return Text(text=content.text)
    elif content.type == "tool_use":
        return ToolCall(
            id=content.id,
            name=content.name,
            args=json.dumps(content.input),
        )
    elif content.type == "thinking":
        return Thought(thought=content.thinking)
    elif content.type in ("server_tool_use", "web_search_tool_result"):
        return None  # Skip server-side tool content, preserved in raw_message
    else:
        raise NotImplementedError(
            f"Support for beta content type `{content.type}` is not yet implemented."
        )


def beta_decode_response(
    response: ParsedBetaMessage[Any],
    model_id: str,
    *,
    include_thoughts: bool,
) -> tuple[AssistantMessage, FinishReason | None, Usage]:
    """Convert Beta message to mirascope AssistantMessage and usage."""
    content = [
        part
        for part in (
            _decode_beta_assistant_content(block) for block in response.content
        )
        if part is not None
    ]
    if not include_thoughts:
        content = [part for part in content if part.type != "thought"]
    assistant_message = AssistantMessage(
        content=content,
        provider_id="anthropic",
        model_id=model_id,
        provider_model_name=model_name(model_id),
        raw_message={
            "role": response.role,
            "content": [
                part.model_dump(exclude_none=True) for part in response.content
            ],
        },
    )
    finish_reason = (
        BETA_FINISH_REASON_MAP.get(response.stop_reason)
        if response.stop_reason
        else None
    )
    usage = decode_usage(response.usage)
    return assistant_message, finish_reason, usage


BetaContentBlockParam: TypeAlias = (
    BetaTextBlockParam
    | BetaThinkingBlockParam
    | BetaToolUseBlockParam
    | BetaRedactedThinkingBlockParam
)


class _BetaChunkProcessor:
    """Processes Beta stream events and maintains state across events."""

    def __init__(self, *, include_thoughts: bool) -> None:
        self.current_block_param: BetaContentBlockParam | None = None
        self.accumulated_tool_json: str = ""
        self.accumulated_blocks: list[BetaContentBlockParam] = []
        self.include_thoughts = include_thoughts

    def process_event(self, event: BetaRawMessageStreamEvent) -> ChunkIterator:
        """Process a single Beta event and yield the appropriate content chunks."""
        yield RawStreamEventChunk(raw_stream_event=event)

        if event.type == "content_block_start":
            content_block = event.content_block

            if content_block.type == "text":
                self.current_block_param = {
                    "type": "text",
                    "text": content_block.text,
                }
                yield TextStartChunk()
            elif content_block.type == "tool_use":
                self.current_block_param = {
                    "type": "tool_use",
                    "id": content_block.id,
                    "name": content_block.name,
                    "input": {},
                }
                self.accumulated_tool_json = ""
                yield ToolCallStartChunk(
                    id=content_block.id,
                    name=content_block.name,
                )
            elif content_block.type == "thinking":
                self.current_block_param = {
                    "type": "thinking",
                    "thinking": "",
                    "signature": "",
                }
                if self.include_thoughts:
                    yield ThoughtStartChunk()
            elif content_block.type == "redacted_thinking":  # pragma: no cover
                self.current_block_param = {
                    "type": "redacted_thinking",
                    "data": content_block.data,
                }
            elif content_block.type in ("server_tool_use", "web_search_tool_result"):
                pass  # Skip server-side tool content
            else:
                raise NotImplementedError(
                    f"Support for beta content block type `{content_block.type}` "
                    "is not yet implemented."
                )

        elif event.type == "content_block_delta":
            if self.current_block_param is None:
                return  # Skip deltas for server-side tool content

            delta = event.delta
            if delta.type == "text_delta":
                if self.current_block_param["type"] != "text":  # pragma: no cover
                    raise RuntimeError(
                        f"Received text_delta for {self.current_block_param['type']} block"
                    )
                self.current_block_param["text"] += delta.text
                yield TextChunk(delta=delta.text)
            elif delta.type == "input_json_delta":
                if self.current_block_param["type"] != "tool_use":  # pragma: no cover
                    raise RuntimeError(
                        f"Received input_json_delta for {self.current_block_param['type']} block"
                    )
                self.accumulated_tool_json += delta.partial_json
                yield ToolCallChunk(
                    id=self.current_block_param["id"], delta=delta.partial_json
                )
            elif delta.type == "thinking_delta":
                if self.current_block_param["type"] != "thinking":  # pragma: no cover
                    raise RuntimeError(
                        f"Received thinking_delta for {self.current_block_param['type']} block"
                    )
                self.current_block_param["thinking"] += delta.thinking
                if self.include_thoughts:
                    yield ThoughtChunk(delta=delta.thinking)
            elif delta.type == "signature_delta":
                if self.current_block_param["type"] != "thinking":  # pragma: no cover
                    raise RuntimeError(
                        f"Received signature_delta for {self.current_block_param['type']} block"
                    )
                self.current_block_param["signature"] += delta.signature
            elif delta.type == "citations_delta":
                pass  # Skip citations delta, preserved in raw_message
            else:
                raise RuntimeError(
                    f"Received unsupported delta type: {delta.type}"
                )  # pragma: no cover

        elif event.type == "content_block_stop":
            if self.current_block_param is None:
                return  # Skip stop for server-side tool content

            block_type = self.current_block_param["type"]

            if block_type == "text":
                yield TextEndChunk()
            elif block_type == "tool_use":
                if self.current_block_param["type"] != "tool_use":  # pragma: no cover
                    raise RuntimeError(
                        f"Block type mismatch: stored {self.current_block_param['type']}, expected tool_use"
                    )
                self.current_block_param["input"] = (
                    json.loads(self.accumulated_tool_json)
                    if self.accumulated_tool_json
                    else {}
                )
                yield ToolCallEndChunk(id=self.current_block_param["id"])
            elif block_type == "thinking":
                if self.include_thoughts:
                    yield ThoughtEndChunk()
            else:
                raise NotImplementedError

            self.accumulated_blocks.append(self.current_block_param)
            self.current_block_param = None

        elif event.type == "message_delta":
            if event.delta.stop_reason:
                finish_reason = BETA_FINISH_REASON_MAP.get(event.delta.stop_reason)
                if finish_reason is not None:
                    yield FinishReasonChunk(finish_reason=finish_reason)

            # Emit usage delta
            usage = event.usage
            yield UsageDeltaChunk(
                input_tokens=usage.input_tokens or 0,
                output_tokens=usage.output_tokens,
                cache_read_tokens=usage.cache_read_input_tokens or 0,
                cache_write_tokens=usage.cache_creation_input_tokens or 0,
                reasoning_tokens=0,
                provider_tool_usage=extract_tool_usage(usage),
            )

    def raw_message_chunk(self) -> RawMessageChunk:
        return RawMessageChunk(
            raw_message=cast(
                dict[str, Any],
                {
                    "ro
```

### Core Architecture Module: `python/mirascope/llm/providers/anthropic/_utils/beta_encode.py`
```
"""Beta Anthropic message encoding and request preparation."""

from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, TypedDict, cast
from typing_extensions import Required

from anthropic import Omit
from anthropic.types.anthropic_beta_param import AnthropicBetaParam
from anthropic.types.beta import (
    BetaCacheControlEphemeralParam,
    BetaContentBlockParam,
    BetaMessageParam,
    BetaTextBlockParam,
    BetaThinkingConfigParam,
    BetaToolChoiceParam,
    BetaToolParam,
    BetaToolUnionParam,
    BetaWebSearchTool20250305Param,
)
from pydantic import BaseModel

from ....content import ContentPart
from ....exceptions import FeatureNotSupportedError
from ....formatting import (
    Format,
    FormatSpec,
    FormattableT,
    create_wrapper_model,
    is_primitive_type,
    resolve_format,
)
from ....messages import AssistantMessage, Message, UserMessage
from ....tools import AnyToolSchema, BaseToolkit, ProviderTool, WebSearchTool
from ...base import _utils as _base_utils
from ..model_id import model_name
from ..model_info import MODELS_WITHOUT_STRICT_STRUCTURED_OUTPUTS
from .encode import (
    DEFAULT_MAX_TOKENS,
    FORMAT_TOOL_NAME,
    encode_content,
    process_params,
    raw_message_has_format_tool,
)

if TYPE_CHECKING:
    from ....models import Params

DEFAULT_FORMAT_MODE = "strict"


class BetaParseKwargs(TypedDict, total=False):
    """Kwargs for Anthropic beta.messages.parse method."""

    model: Required[str]
    max_tokens: Required[int]
    messages: Sequence[BetaMessageParam]
    system: Sequence[BetaTextBlockParam] | Omit
    tools: Sequence[BetaToolUnionParam] | Omit
    tool_choice: BetaToolChoiceParam | Omit
    temperature: float | Omit
    top_p: float | Omit
    top_k: int | Omit
    stop_sequences: list[str] | Omit
    thinking: BetaThinkingConfigParam | Omit
    betas: list[AnthropicBetaParam]
    output_format: type[BaseModel]


def _beta_encode_content(
    content: Sequence[ContentPart],
    encode_thoughts_as_text: bool,
    add_cache_control: bool = False,
) -> str | Sequence[BetaContentBlockParam]:
    """Convert mirascope content to Beta Anthropic content format."""
    result = encode_content(content, encode_thoughts_as_text, add_cache_control)
    if isinstance(result, str):
        return result
    return cast(Sequence[BetaContentBlockParam], result)


def _beta_encode_message(
    message: UserMessage | AssistantMessage,
    model_id: str,
    encode_thoughts_as_text: bool,
    add_cache_control: bool = False,
) -> BetaMessageParam:
    """Convert user or assistant Message to Beta MessageParam format.

    Args:
        message: The message to encode
        model_id: The Anthropic model ID
        encode_thoughts_as_text: Whether to encode thought blocks as text
        add_cache_control: Whether to add cache_control to the last content block
    """
    if (
        message.role == "assistant"
        and message.provider_id == "anthropic"
        and message.model_id == model_id
        and message.raw_message
        and not encode_thoughts_as_text
        and not add_cache_control
        and not raw_message_has_format_tool(message.raw_message)
    ):
        raw = cast(dict[str, Any], message.raw_message)
        raw_content: Any = raw["content"]
        # Strip parsed_output from content blocks — the beta SDK adds this field
        # to text blocks when using structured output, but the API rejects it on input.
        if isinstance(raw_content, list):
            raw_content = [
                {
                    k: v
                    for k, v in cast(dict[str, Any], block).items()
                    if k != "parsed_output"
                }
                if isinstance(block, dict) and "parsed_output" in block
                else block
                for block in cast(list[Any], raw_content)
            ]
        return BetaMessageParam(
            role=raw["role"],
            content=raw_content,
        )

    content = _beta_encode_content(
        message.content, encode_thoughts_as_text, add_cache_control
    )

    return BetaMessageParam(
        role=message.role,
        content=content,
    )


def _beta_encode_messages(
    messages: Sequence[UserMessage | AssistantMessage],
    model_id: str,
    encode_thoughts_as_text: bool,
) -> Sequence[BetaMessageParam]:
    """Encode messages and add cache control for multi-turn conversations.

    If the conversation contains assistant messages (indicating multi-turn),
    adds cache_control to the last content block of the last message.
    """
    # Detect multi-turn conversations by checking for assistant messages
    has_assistant_message = any(msg.role == "assistant" for msg in messages)

    # Encode messages, adding cache_control to the last message if multi-turn
    encoded_messages: list[BetaMessageParam] = []
    for i, message in enumerate(messages):
        is_last = i == len(messages) - 1
        add_cache = has_assistant_message and is_last
        encoded_messages.append(
            _beta_encode_message(message, model_id, encode_thoughts_as_text, add_cache)
        )
    return encoded_messages


def _beta_convert_tool_to_tool_param(
    tool: "AnyToolSchema | ProviderTool", model_supports_strict: bool
) -> BetaToolUnionParam:
    """Convert a single Mirascope tool to Beta Anthropic tool format.

    If the tool has strict=True (or None, and the model supports strict), the schema
    is modified to be compatible with Anthropic's strict structured outputs beta
    by adding additionalProperties: false to all object schemas, and strict=True
    is passed to the API.
    """
    if isinstance(tool, WebSearchTool):
        return BetaWebSearchTool20250305Param(
            type="web_search_20250305", name="web_search"
        )
    if isinstance(tool, ProviderTool):
        raise FeatureNotSupportedError(
            f"Provider tool {tool.name}", provider_id="anthropic-beta"
        )
    schema_dict = tool.parameters.model_dump(by_alias=True, exclude_none=True)
    schema_dict["type"] = "object"

    strict = model_supports_strict if tool.strict is None else tool.strict
    if strict:
        _base_utils.ensure_additional_properties_false(schema_dict)

    return BetaToolParam(
        name=tool.name,
        description=tool.description,
        input_schema=schema_dict,
        strict=strict,
    )


def beta_encode_request(
    *,
    model_id: str,
    messages: Sequence[Message],
    tools: BaseToolkit[AnyToolSchema],
    format: FormatSpec[FormattableT] | None,
    params: "Params",
) -> tuple[Sequence[Message], Format[FormattableT] | None, BetaParseKwargs]:
    """Prepares a request for the Anthropic beta.messages.parse method."""

    processed = process_params(params, DEFAULT_MAX_TOKENS)
    encode_thoughts_as_text = processed.pop("encode_thoughts_as_text", False)
    max_tokens = processed.pop("max_tokens", DEFAULT_MAX_TOKENS)

    kwargs: BetaParseKwargs = BetaParseKwargs(
        {
            "model": model_name(model_id),
            "max_tokens": max_tokens,
            "betas": ["structured-outputs-2025-11-13"],
            **processed,
        }
    )

    model_supports_strict = (
        model_name(model_id) not in MODELS_WITHOUT_STRICT_STRUCTURED_OUTPUTS
    )
    # Check for strict tools on models that don't support them
    if _base_utils.has_strict_tools(tools.tools) and not model_supports_strict:
        raise FeatureNotSupportedError(
            feature="strict tools",
            provider_id="anthropic",
            model_id=model_id,
            message="Strict tools require a model that supports structured outputs. "
            "Use a newer model like claude-sonnet-4-5 or set strict=False on your tools.",
        )

    anthropic_tools = [
        _beta_convert_tool_to_tool_param(
            tool, model_supports_strict=model_supports_strict
        )
        for tool in tools.tools
    ]
    format = resolve_format(format, default_mode=DEFAULT_FORMAT_MODE)

    if format is not None:
        if format.mode == "strict":
            if model_name(model_id) in MODELS_WITHOUT_STRICT_STRUCTURED_OUTPUTS:
                raise FeatureNotSupportedError(
                    feature=f"formatting_mode:{format.mode}",
                    provider_id="anthropic",
                    model_id=model_id,
                )
            else:
                formattable = format.formattable
                kwargs["output_format"] = cast(
                    type[BaseModel],
                    create_wrapper_model(formattable)
                    if is_primitive_type(formattable)
                    else formattable,
                )

        if format.mode == "tool":
            format_tool_schema = format.create_tool_schema()
            anthropic_tools.append(
                _beta_convert_tool_to_tool_param(
                    format_tool_schema, model_supports_strict=model_supports_strict
                )
            )
            if tools.tools:
                kwargs["tool_choice"] = {"type": "any"}
            else:
                kwargs["tool_choice"] = {
                    "type": "tool",
                    "name": FORMAT_TOOL_NAME,
                    "disable_parallel_tool_use": True,
                }

        if format.formatting_instructions:
            messages = _base_utils.add_system_instructions(
                messages, format.formatting_instructions
            )

    if anthropic_tools:
        # Add cache control to the last tool for prompt caching
        last_tool = anthropic_tools[-1]
        last_tool["cache_control"] = BetaCacheControlEphemeralParam(type="ephemeral")
        kwargs["tools"] = anthropic_tools

    system_message_content, remaining_messages = _base_utils.extract_system_message(
        messages
    )

    kwargs["messages"] = _beta_encode_messages(
        remaining_messages, model_id, encode_thoughts_as_text
    )

    if system_message_content:
        kwargs["system"] = [
            Bet
```

### Core Architecture Module: `python/mirascope/llm/providers/anthropic/_utils/decode.py`
```
"""Standard Anthropic response decoding."""

import json
from typing import Any, TypeAlias, cast

from anthropic import types as anthropic_types
from anthropic.lib.streaming import AsyncMessageStreamManager, MessageStreamManager
from anthropic.types.beta import BetaMessageDeltaUsage, BetaUsage

from ....content import (
    AssistantContentPart,
    Text,
    TextChunk,
    TextEndChunk,
    TextStartChunk,
    Thought,
    ThoughtChunk,
    ThoughtEndChunk,
    ThoughtStartChunk,
    ToolCall,
    ToolCallChunk,
    ToolCallEndChunk,
    ToolCallStartChunk,
)
from ....messages import AssistantMessage
from ....responses import (
    AsyncChunkIterator,
    ChunkIterator,
    FinishReason,
    FinishReasonChunk,
    ProviderToolUsage,
    RawMessageChunk,
    RawStreamEventChunk,
    Usage,
    UsageDeltaChunk,
)
from ..model_id import AnthropicModelId, model_name

ANTHROPIC_FINISH_REASON_MAP = {
    "max_tokens": FinishReason.MAX_TOKENS,
    "refusal": FinishReason.REFUSAL,
}


def _decode_assistant_content(
    content: anthropic_types.ContentBlock,
) -> AssistantContentPart | None:
    """Convert Anthropic content block to mirascope AssistantContentPart."""
    if content.type == "text":
        return Text(text=content.text)
    elif content.type == "tool_use":
        return ToolCall(
            id=content.id,
            name=content.name,
            args=json.dumps(content.input),
        )
    elif content.type == "thinking":
        return Thought(thought=content.thinking)
    elif content.type in ("server_tool_use", "web_search_tool_result"):
        return None  # Skip server-side tool content, preserved in raw_message
    else:
        raise NotImplementedError(
            f"Support for content type `{content.type}` is not yet implemented."
        )


def extract_tool_usage(
    usage: (
        anthropic_types.Usage
        | anthropic_types.MessageDeltaUsage
        | BetaUsage
        | BetaMessageDeltaUsage
    ),
) -> list[ProviderToolUsage] | None:
    """Extract provider tool usage from Anthropic usage object."""
    server_tool_use = getattr(usage, "server_tool_use", None)
    if server_tool_use is None:
        return None

    tools: list[ProviderToolUsage] = []

    # Web search
    web_search_requests = getattr(server_tool_use, "web_search_requests", None)
    if web_search_requests and web_search_requests > 0:
        tools.append(
            ProviderToolUsage(name="web_search", call_count=web_search_requests)
        )

    return tools if tools else None


def decode_usage(
    usage: anthropic_types.Usage | BetaUsage,
) -> Usage:
    """Convert Anthropic Usage (or BetaUsage) to Mirascope Usage."""

    cache_read_tokens = usage.cache_read_input_tokens or 0
    cache_write_tokens = usage.cache_creation_input_tokens or 0
    input_tokens = usage.input_tokens + cache_read_tokens + cache_write_tokens
    output_tokens = usage.output_tokens
    return Usage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_read_tokens=cache_read_tokens,
        cache_write_tokens=cache_write_tokens,
        reasoning_tokens=0,
        provider_tool_usage=extract_tool_usage(usage),
        raw=usage,
    )


def decode_response(
    response: anthropic_types.Message,
    model_id: AnthropicModelId,
    *,
    include_thoughts: bool,
) -> tuple[AssistantMessage, FinishReason | None, Usage]:
    """Convert Anthropic message to mirascope AssistantMessage and usage."""
    content = [
        part
        for part in (_decode_assistant_content(block) for block in response.content)
        if part is not None
    ]
    if not include_thoughts:
        content = [part for part in content if part.type != "thought"]
    assistant_message = AssistantMessage(
        content=content,
        provider_id="anthropic",
        model_id=model_id,
        provider_model_name=model_name(model_id),
        raw_message={
            "role": response.role,
            "content": [part.model_dump() for part in response.content],
        },
    )
    finish_reason = (
        ANTHROPIC_FINISH_REASON_MAP.get(response.stop_reason)
        if response.stop_reason
        else None
    )
    usage = decode_usage(response.usage)
    return assistant_message, finish_reason, usage


ContentBlock: TypeAlias = (
    anthropic_types.TextBlockParam
    | anthropic_types.ThinkingBlockParam
    | anthropic_types.ToolUseBlockParam
    | anthropic_types.RedactedThinkingBlockParam
)


class _AnthropicChunkProcessor:
    """Processes Anthropic stream events and maintains state across events."""

    def __init__(self, *, include_thoughts: bool) -> None:
        self.current_block_param: ContentBlock | None = None
        self.accumulated_tool_json: str = ""
        self.accumulated_blocks: list[ContentBlock] = []
        self.include_thoughts = include_thoughts

    def process_event(
        self, event: anthropic_types.RawMessageStreamEvent
    ) -> ChunkIterator:
        """Process a single Anthropic event and yield the appropriate content chunks."""
        yield RawStreamEventChunk(raw_stream_event=event)

        if event.type == "content_block_start":
            content_block = event.content_block

            if content_block.type == "text":
                self.current_block_param = {
                    "type": "text",
                    "text": content_block.text,
                }
                yield TextStartChunk()
            elif content_block.type == "tool_use":
                self.current_block_param = {
                    "type": "tool_use",
                    "id": content_block.id,
                    "name": content_block.name,
                    "input": {},
                }
                self.accumulated_tool_json = ""
                yield ToolCallStartChunk(
                    id=content_block.id,
                    name=content_block.name,
                )
            elif content_block.type == "thinking":
                self.current_block_param = {
                    "type": "thinking",
                    "thinking": "",
                    "signature": "",
                }
                if self.include_thoughts:
                    yield ThoughtStartChunk()
            elif content_block.type == "redacted_thinking":  # pragma: no cover
                self.current_block_param = {
                    "type": "redacted_thinking",
                    "data": content_block.data,
                }
            elif content_block.type in ("server_tool_use", "web_search_tool_result"):
                pass  # Skip server-side tool content
            else:
                raise NotImplementedError

        elif event.type == "content_block_delta":
            if self.current_block_param is None:
                return  # Skip deltas for server-side tool content

            delta = event.delta
            if delta.type == "text_delta":
                if self.current_block_param["type"] != "text":  # pragma: no cover
                    raise RuntimeError(
                        f"Received text_delta for {self.current_block_param['type']} block"
                    )
                self.current_block_param["text"] += delta.text
                yield TextChunk(delta=delta.text)
            elif delta.type == "input_json_delta":
                if self.current_block_param["type"] != "tool_use":  # pragma: no cover
                    raise RuntimeError(
                        f"Received input_json_delta for {self.current_block_param['type']} block"
                    )
                self.accumulated_tool_json += delta.partial_json
                yield ToolCallChunk(
                    id=self.current_block_param["id"], delta=delta.partial_json
                )
            elif delta.type == "thinking_delta":
                if self.current_block_param["type"] != "thinking":  # pragma: no cover
                    raise RuntimeError(
                        f"Received thinking_delta for {self.current_block_param['type']} block"
                    )
                self.current_block_param["thinking"] += delta.thinking
                if self.include_thoughts:
                    yield ThoughtChunk(delta=delta.thinking)
            elif delta.type == "signature_delta":
                if self.current_block_param["type"] != "thinking":  # pragma: no cover
                    raise RuntimeError(
                        f"Received signature_delta for {self.current_block_param['type']} block"
                    )
                self.current_block_param["signature"] += delta.signature
            elif delta.type == "citations_delta":
                pass  # Skip citations delta, preserved in raw_message
            else:
                raise RuntimeError(
                    f"Received unsupported delta type: {delta.type}"
                )  # pragma: no cover

        elif event.type == "content_block_stop":
            if self.current_block_param is None:
                return  # Skip stop for server-side tool content

            block_type = self.current_block_param["type"]

            if block_type == "text":
                yield TextEndChunk()
            elif block_type == "tool_use":
                if self.current_block_param["type"] != "tool_use":  # pragma: no cover
                    raise RuntimeError(
                        f"Block type mismatch: stored {self.current_block_param['type']}, expected tool_use"
                    )
                self.current_block_param["input"] = (
                    json.loads(self.accumulated_tool_json)
                    if self.accumulated_tool_json
                    else {}
                )
                yield ToolCallEndChunk(id=self.current_block_param["id"])
            elif block_type == "thinking":
                if self.include_thoughts:
                    yield ThoughtEndChunk()
            else:
                raise NotImplementedError

            self.accumulated_blocks.append(self
```

### Core Architecture Module: `python/mirascope/llm/providers/anthropic/_utils/encode.py`
```
"""Shared Anthropic encoding utilities."""

from __future__ import annotations

import json
from collections.abc import Sequence
from functools import lru_cache
from typing import TYPE_CHECKING, Any, Literal, TypedDict, cast
from typing_extensions import Required

from anthropic import Omit, types as anthropic_types

from ....content import ContentPart, Document, ImageMimeType
from ....exceptions import FeatureNotSupportedError
from ....formatting import (
    Format,
    FormatSpec,
    FormattableT,
    resolve_format,
)
from ....messages import AssistantMessage, Message, UserMessage
from ....tools import (
    FORMAT_TOOL_NAME,
    AnyToolSchema,
    BaseToolkit,
    ProviderTool,
    WebSearchTool,
)
from ...base import _utils as _base_utils
from ..model_id import AnthropicModelId, model_name

if TYPE_CHECKING:
    from ....models import Params, ThinkingLevel

DEFAULT_MAX_TOKENS = 16000
DEFAULT_FORMAT_MODE = "tool"

# Thinking level to a float multiplier % of max tokens
THINKING_LEVEL_TO_BUDGET_MULTIPLIER: dict[ThinkingLevel, float] = {
    "minimal": 0,  # Will become 1024 (actual minimal value)
    "low": 0.2,
    "medium": 0.4,
    "high": 0.6,
    "max": 0.8,
}

AnthropicImageMimeType = Literal["image/jpeg", "image/png", "image/gif", "image/webp"]


def encode_image_mime_type(mime_type: ImageMimeType) -> AnthropicImageMimeType:
    """Convert an ImageMimeType into anthropic supported mime type."""
    if mime_type in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        return mime_type
    raise FeatureNotSupportedError(
        feature=f"Image with mime_type: {mime_type}", provider_id="anthropic"
    )  # pragma: no cover


def _encode_document(doc: Document) -> anthropic_types.DocumentBlockParam:
    """Convert a Document content part to Anthropic's DocumentBlockParam format."""
    source = doc.source
    if source.type == "base64_document_source":
        return anthropic_types.DocumentBlockParam(
            type="document",
            source=anthropic_types.Base64PDFSourceParam(
                type="base64",
                data=source.data,
                media_type="application/pdf",
            ),
        )
    elif source.type == "text_document_source":
        return anthropic_types.DocumentBlockParam(
            type="document",
            source=anthropic_types.PlainTextSourceParam(
                type="text",
                data=source.data,
                media_type="text/plain",
            ),
        )
    else:  # url_document_source
        return anthropic_types.DocumentBlockParam(
            type="document",
            source=anthropic_types.URLPDFSourceParam(
                type="url",
                url=source.url,
            ),
        )


def compute_thinking_budget(
    level: ThinkingLevel,
    max_tokens: int,
) -> int:
    """Compute Anthropic token budget from ThinkingConfig level.

    Args:
        level: The thinking level from ThinkingConfig
        max_tokens: The max_tokens value for the request

    Returns:
        Token budget for thinking (0 to disable, positive for budget)
    """

    if level == "none":
        return 0
    elif level == "default":
        return -1  # Do not set thinking, leave to provider default

    multiplier: float = THINKING_LEVEL_TO_BUDGET_MULTIPLIER.get(level, 0.4)
    budget = int(multiplier * max_tokens)
    return max(1024, budget)  # Always return at least 1024, minimum allowed budget


class ProcessedParams(TypedDict, total=False):
    """Common parameters processed from Params."""

    temperature: float
    max_tokens: int
    top_p: float
    top_k: int
    stop_sequences: list[str]
    thinking: dict[str, Any]
    encode_thoughts_as_text: bool


def process_params(params: Params, default_max_tokens: int) -> ProcessedParams:
    """Process common Anthropic parameters from Params.

    Returns a dict with processed parameters that can be merged into kwargs.
    """
    result: ProcessedParams = {
        "max_tokens": default_max_tokens,
        "encode_thoughts_as_text": False,
    }

    with _base_utils.ensure_all_params_accessed(
        params=params, provider_id="anthropic", unsupported_params=["seed"]
    ) as param_accessor:
        if param_accessor.temperature is not None:
            result["temperature"] = param_accessor.temperature
        if param_accessor.max_tokens is not None:
            result["max_tokens"] = param_accessor.max_tokens
        if param_accessor.top_p is not None:
            result["top_p"] = param_accessor.top_p
        if param_accessor.top_k is not None:
            result["top_k"] = param_accessor.top_k
        if param_accessor.stop_sequences is not None:
            result["stop_sequences"] = param_accessor.stop_sequences
        if param_accessor.thinking is not None:
            thinking_config = param_accessor.thinking
            level = thinking_config.get("level")

            # Compute token budget from level
            budget_tokens = compute_thinking_budget(level, result["max_tokens"])
            if budget_tokens == 0:
                result["thinking"] = {"type": "disabled"}
            elif budget_tokens > 0:
                result["thinking"] = {"type": "enabled", "budget_tokens": budget_tokens}
            else:
                # budget is -1, do not set thinking at all.
                pass

            # Handle encode_thoughts_as_text from ThinkingConfig
            if thinking_config.get("encode_thoughts_as_text"):
                result["encode_thoughts_as_text"] = True

    return result


class MessageCreateKwargs(TypedDict, total=False):
    """Kwargs for Anthropic Message.create method."""

    model: Required[str]
    max_tokens: Required[int]
    messages: Sequence[anthropic_types.MessageParam]
    system: Sequence[anthropic_types.TextBlockParam] | Omit
    tools: Sequence[anthropic_types.ToolUnionParam] | Omit
    tool_choice: anthropic_types.ToolChoiceParam | Omit
    temperature: float | Omit
    top_p: float | Omit
    top_k: int | Omit
    stop_sequences: list[str] | Omit
    thinking: anthropic_types.ThinkingConfigParam | Omit


def encode_content(
    content: Sequence[ContentPart],
    encode_thoughts: bool,
    add_cache_control: bool,
) -> str | Sequence[anthropic_types.ContentBlockParam]:
    """Convert mirascope content to Anthropic content format."""

    if len(content) == 1 and content[0].type == "text":
        if not content[0].text:
            raise FeatureNotSupportedError(
                "empty message content",
                "anthropic",
                message="Anthropic does not support empty message content.",
            )
        if add_cache_control:
            return [
                anthropic_types.TextBlockParam(
                    type="text",
                    text=content[0].text,
                    cache_control={"type": "ephemeral"},
                )
            ]
        return content[0].text

    blocks: list[anthropic_types.ContentBlockParam] = []

    # Find the last cacheable content part (text, image, document, tool_result, or tool_call)
    last_cacheable_index = -1
    if add_cache_control:
        for i in range(len(content) - 1, -1, -1):
            part = content[i]
            if part.type in ("text", "image", "document", "tool_output", "tool_call"):
                if part.type == "text" and not part.text:  # pragma: no cover
                    continue  # Skip empty text
                last_cacheable_index = i
                break

    for i, part in enumerate(content):
        should_add_cache = add_cache_control and i == last_cacheable_index

        if part.type == "text":
            if part.text:
                blocks.append(
                    anthropic_types.TextBlockParam(
                        type="text",
                        text=part.text,
                        cache_control={"type": "ephemeral"}
                        if should_add_cache
                        else None,
                    )
                )
        elif part.type == "image":
            source: (
                anthropic_types.Base64ImageSourceParam
                | anthropic_types.URLImageSourceParam
            )
            if part.source.type == "base64_image_source":
                source = anthropic_types.Base64ImageSourceParam(
                    type="base64",
                    media_type=encode_image_mime_type(part.source.mime_type),
                    data=part.source.data,
                )
            else:  # url_image_source
                source = anthropic_types.URLImageSourceParam(
                    type="url",
                    url=part.source.url,
                )
            blocks.append(
                anthropic_types.ImageBlockParam(
                    type="image",
                    source=source,
                    cache_control={"type": "ephemeral"} if should_add_cache else None,
                )
            )
        elif part.type == "audio":
            raise FeatureNotSupportedError(
                "audio input",
                "anthropic",
                message="Anthropic does not support audio inputs.",
            )
        elif part.type == "document":
            doc_block = _encode_document(part)
            if should_add_cache:
                doc_block["cache_control"] = {"type": "ephemeral"}
            blocks.append(doc_block)
        elif part.type == "tool_output":
            blocks.append(
                anthropic_types.ToolResultBlockParam(
                    type="tool_result",
                    tool_use_id=part.id,
                    content=str(part.result),
                    cache_control={"type": "ephemeral"} if should_add_cache else None,
                )
            )
        elif part.type == "tool_call":
            blocks.append(
                anthropic_types.ToolUseBlockParam(
                    type="tool_use",
                    id=part.id,
                    name=part.name,
               
```

### Core Architecture Module: `python/mirascope/llm/providers/anthropic/_utils/errors.py`
```
"""Anthropic error handling utilities."""

from anthropic import (
    AnthropicError,
    APIConnectionError as AnthropicAPIConnectionError,
    APIResponseValidationError as AnthropicAPIResponseValidationError,
    APITimeoutError as AnthropicAPITimeoutError,
    AuthenticationError as AnthropicAuthenticationError,
    BadRequestError as AnthropicBadRequestError,
    ConflictError as AnthropicConflictError,
    InternalServerError as AnthropicInternalServerError,
    NotFoundError as AnthropicNotFoundError,
    PermissionDeniedError as AnthropicPermissionDeniedError,
    RateLimitError as AnthropicRateLimitError,
    UnprocessableEntityError as AnthropicUnprocessableEntityError,
)

from ....exceptions import (
    AuthenticationError,
    BadRequestError,
    ConnectionError,
    NotFoundError,
    PermissionError,
    ProviderError,
    RateLimitError,
    ResponseValidationError,
    ServerError,
    TimeoutError,
)
from ...base import ProviderErrorMap

# Shared error mapping used by both AnthropicProvider and AnthropicBetaProvider
ANTHROPIC_ERROR_MAP: ProviderErrorMap = {
    AnthropicAuthenticationError: AuthenticationError,
    AnthropicPermissionDeniedError: PermissionError,
    AnthropicBadRequestError: BadRequestError,
    AnthropicUnprocessableEntityError: BadRequestError,
    AnthropicNotFoundError: NotFoundError,
    AnthropicConflictError: BadRequestError,
    AnthropicRateLimitError: RateLimitError,
    AnthropicInternalServerError: ServerError,
    AnthropicAPITimeoutError: TimeoutError,
    AnthropicAPIConnectionError: ConnectionError,
    AnthropicAPIResponseValidationError: ResponseValidationError,
    AnthropicError: ProviderError,  # Catch-all for unknown Anthropic errors
}

```

### Core Architecture Module: `python/mirascope/llm/providers/base/_utils.py`
```
from __future__ import annotations

import logging
from collections.abc import Generator, Sequence
from contextlib import contextmanager
from typing import TYPE_CHECKING, TypeAlias, cast, get_type_hints

from ...content import Text
from ...messages import AssistantMessage, Message, SystemMessage, UserMessage
from ...models.params import (
    Params,  # Import directly from params.py to avoid circular dependency
)
from ...tools import AnyToolSchema, ProviderTool, ToolSchema
from ..provider_id import ProviderId

if TYPE_CHECKING:
    from ...models import ThinkingConfig
    from ..model_id import ModelId

logger = logging.getLogger(__name__)

SystemMessageContent: TypeAlias = str | None


def get_include_thoughts(params: Params) -> bool:
    """Extract include_thoughts from params thinking config."""
    thinking_config = params.get("thinking")
    return (thinking_config or {}).get("include_thoughts", False)


def has_strict_tools(tools: Sequence[AnyToolSchema | ProviderTool]) -> bool:
    """Check if any tools have strict=True explicitly set.

    Args:
        tools: The tools to check

    Returns:
        True if any tool has strict=True, False otherwise
    """
    return any(isinstance(tool, ToolSchema) and tool.strict is True for tool in tools)


def ensure_additional_properties_false(obj: object) -> None:
    """Recursively adds additionalProperties = False to a schema, required for strict mode."""
    if isinstance(obj, dict):
        obj = cast(dict[str, object], obj)
        if obj.get("type") == "object" and "additionalProperties" not in obj:
            obj["additionalProperties"] = False
        for value in obj.values():
            ensure_additional_properties_false(value)
    elif isinstance(obj, list):
        obj = cast(list[object], obj)
        for item in obj:
            ensure_additional_properties_false(item)


def ensure_all_properties_required(obj: object) -> None:
    """Recursively ensures all properties are in required array, needed for OpenAI strict mode.

    OpenAI's strict mode requires that all properties in an object schema are listed
    in the 'required' array, even if they have default values.
    """
    if isinstance(obj, dict):
        obj = cast(dict[str, object], obj)
        if obj.get("type") == "object" and "properties" in obj:
            properties = obj.get("properties")
            if isinstance(properties, dict):
                property_keys = cast(dict[str, object], properties)
                obj["required"] = list(property_keys.keys())
        for value in obj.values():
            ensure_all_properties_required(value)
    elif isinstance(obj, list):
        obj = cast(list[object], obj)
        for item in obj:
            ensure_all_properties_required(item)


def add_system_instructions(
    messages: Sequence[Message], additional_system_instructions: str
) -> Sequence[Message]:
    """Add system instructions to a sequence of messages.

    If the first message is a system message, appends the additional instructions
    to it with a newline separator. If the instructions already exist at the end
    of the system message, returns the original messages unchanged. Otherwise,
    creates a new system message at the beginning of the sequence.

    Args:
        messages: The sequence of messages to modify.
        additional_system_instructions: The system instructions to add.

    Returns:
        A new sequence of messages with the system instructions added.
    """
    if messages and messages[0].role == "system":
        if messages[0].content.text.endswith(additional_system_instructions):
            return messages
        modified = Text(
            text=messages[0].content.text + "\n" + additional_system_instructions
        )
        return [SystemMessage(role="system", content=modified), *messages[1:]]
    else:
        return [
            SystemMessage(
                role="system", content=Text(text=additional_system_instructions)
            ),
            *messages,
        ]


def extract_system_message(
    messages: Sequence[Message],
) -> tuple[SystemMessageContent, Sequence[UserMessage | AssistantMessage]]:
    """Extract the system message(s) from a list of Messages.

    This takes a list of messages, and returns the list of messages with
    all system messages removed, as well as the textual contents of the first message,
    if that message was a system message. If there are any system messages that are
    not the first message, they will be dropped, and a warning will be emitted.

    This is intended for use in clients where the system message is not included in the
    input messages, but passed as an additional argument or metadata.
    """
    system_message_content: SystemMessageContent = None
    remaining_messages: list[UserMessage | AssistantMessage] = []

    for i, message in enumerate(messages):
        if message.role == "system":
            if i == 0:
                system_message_content = message.content.text
            else:
                logging.warning(
                    "Skipping system message at index %d because it is not the first message",
                    i,
                )
        else:
            remaining_messages.append(message)

    return system_message_content, remaining_messages


class SafeParamsAccessor:
    """A wrapper around Params that tracks which parameters have been accessed."""

    def __init__(self, params: Params) -> None:
        self._params = params
        self._unaccessed = set(get_type_hints(Params).keys())

    @property
    def temperature(self) -> float | None:
        """Access the temperature parameter."""
        self._unaccessed.discard("temperature")
        return self._params.get("temperature")

    @property
    def max_tokens(self) -> int | None:
        """Access the max_tokens parameter."""
        self._unaccessed.discard("max_tokens")
        return self._params.get("max_tokens")

    @property
    def top_p(self) -> float | None:
        """Access the top_p parameter."""
        self._unaccessed.discard("top_p")
        return self._params.get("top_p")

    @property
    def top_k(self) -> int | None:
        """Access the top_k parameter."""
        self._unaccessed.discard("top_k")
        return self._params.get("top_k")

    @property
    def seed(self) -> int | None:
        """Access the seed parameter."""
        self._unaccessed.discard("seed")
        return self._params.get("seed")

    @property
    def stop_sequences(self) -> list[str] | None:
        """Access the stop_sequences parameter."""
        self._unaccessed.discard("stop_sequences")
        return self._params.get("stop_sequences")

    @property
    def thinking(self) -> ThinkingConfig | None:
        """Access the thinking parameter."""
        self._unaccessed.discard("thinking")
        return self._params.get("thinking")

    def emit_warning_for_unused_param(
        self,
        param_name: str,
        param_value: object,
        provider_id: ProviderId,
        model_id: ModelId | None = None,
    ) -> None:
        unsupported_by = f"provider: {provider_id}"
        if model_id:
            unsupported_by += f" with model_id: {model_id}"
        logger.warning(
            f"Skipping unsupported parameter: {param_name}={param_value} ({unsupported_by})"
        )

    def check_access_integrity(self, unsupported_params: list[str]) -> None:
        """Verify that all used parameters have been accessed, and none of the unsupported have been."""
        assert self._unaccessed == set(unsupported_params), (
            "Mismatch between unsupported and unaccessed params"
        )


@contextmanager
def ensure_all_params_accessed(
    *,
    params: Params,
    provider_id: ProviderId,
    unsupported_params: list[str] | None = None,
) -> Generator[SafeParamsAccessor, None, None]:
    """Context manager that ensures all parameters are accessed.

    Yields a wrapper around params that tracks which parameters have been accessed.
    On context exit, raises a `RuntimeError` if any parameters were not accessed.

    Args:
        params: The parameters to wrap
        provider: The provider that is accessing these params (required for logging)
        unsupported_params: A list of params keys it does not support, for auto-warning
            of unsupported params as boilerplate reduction. Or None, to disable this
            optional feature.

    Yields:
        A SafeParamsAccessor instance if params is not None, else None

    Raises:
        RuntimeError: If any parameters were not accessed before context exit
    """

    accessor = SafeParamsAccessor(params)
    unsupported_params = unsupported_params or []
    for unsupported in unsupported_params:
        if (val := params.get(unsupported)) is not None:
            accessor.emit_warning_for_unused_param(
                unsupported, val, provider_id=provider_id
            )
    try:
        yield accessor
    finally:
        accessor.check_access_integrity(unsupported_params=unsupported_params)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2648** (2026-03-13): **fix(cloud): claw creation modal hangs during provisioning**
  *Symptoms*: ## Bug  When clicking "Create" in the create claw modal, the modal hangs for a long time waiting for the API to return. The modal eventually closes but drops back to the org page with stale cache — the new claw doesn't appear until several hard refreshes, at which point it shows in "provisioning" state.  ## Expected  Click "Create" → modal closes instantly → claw appears in the list with status "provisioning".  ## Root Cause (Initial Analysis)  `createClawHandler` in `cloud/api/claws.handlers.ts` does everything synchronously in one Effect pipeline: 1. DB insert (fast) 2. R2 bucket provisioning via `clawDeployment.provision()` (slow — Cloudflare API) 3. Secret encryption + DB update (fast) 4. Container warm-up via `clawDeployment.warmUp()` (slow — cold start)  Steps 2 and 4 are the bottleneck. The API doesn't return until the entire pipeline completes, keeping the modal spinner alive.  ## Proposed Approach  Split into fast path (return immediately) and background work: - **Fast path**: DB insert → return claw with status "provisioning" → modal closes - **Background**: R2 provisioning → encrypt secrets → DB update → warm-up (fire-and-forget or via queue)  Also: the frontend should invalidate the claws query cache after creation so the new claw appears immediately.  ## Files  - `cloud/api/claws.handlers.ts` — `createClawHandler` - `cloud/app/components/create-claw-modal.tsx` — frontend modal - `cloud/claws/deployment/` — provisioning service  Reported by Dandelion.

- **Issue #2503** (2026-09-25): **`response.resume` broken when using structured outputs with Anthropic in tool mode**
  *Symptoms*: ### Description  Consider the following script:  ```python from mirascope import llm   @llm.call("anthropic/claude-sonnet-4-5", format=int) def lucky_number():     return "Choose a lucky number between 1 and 10"   result = lucky_number() second_result = result.resume("Ok, now choose a different lucky number") ```  This is very simple and should work. However, it raises the following error:  ``` mirascope.llm.exceptions.BadRequestError: Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'messages.2: `tool_use` ids were found without `tool_result` blocks immediately after: toolu_01NUbw5mvfYRWaDHvMi1xYK1. Each `tool_use` block must have a corresponding `tool_result` block in the next message.'}, 'request_id': 'req_011CXxuFSqH1PCSqbYYrukMX'} ```  The issue is that: 1. Anthropic provider uses tool mode by default 2. Tool mode injects a special MIRASCOPE_FORMAT_TOOL, which is used for the output 3. When Mirascope processes the assistant message, it converts the tool call into a text block that contains the expected output. There is never a corresponding user block with tool output (because the format tool is never called) 4. When re-encoding the message history to send to Anthropic, we use the raw representation (unprocessed) which still has a tool call 5. Anthropic rejects the request because the tool was never called  Solutions that come to mind include: 1. When encoding the assistant message, check if it contained a format tool invocation, 

- **Issue #2412** (2026-02-12): **Windows clone fails due to invalid filename with colon (:)**
  *Symptoms*: ### Description  Cloning the Mirascope repository on Windows fails because file contains a colon (:) in its name, which is not allowed on Windows file systems. This prevents Git from checking out the working tree.  **Problematic file** typescript/tests/e2e/input/cassettes/audio/openai:completions/encodes-audio-content.har  **Steps to reproduce** 1. On a Windows machine, run:    git clone https://github.com/Mirascope/mirascope.git 2. Observe the error:    fatal: unable to checkout working tree    invalid path 'typescript/tests/e2e/input/cassettes/audio/openai:completions/encodes-audio-content.har'  ### Python, Mirascope & OS Versions, related packages  ```TOML Python version: Python 3.12.4 Mirascope version: 2.2.0 Operating System: Windows 11 Microsoft Windows [Version 10.0.26100.7623] ```  <img width="955" height="358" alt="Image" src="https://github.com/user-attachments/assets/5637f6aa-01be-44cf-bcde-0540f1a6fd02" />
  **Post-Mortem & Fix Analysis**:
  > We've merged in a fix to main. Let us know if you're still having any issues!
  > > We've merged in a fix to main. Let us know if you're still having any issues!  its working!! thanks!!!

- **Issue #2389** (2026-02-04): **Markdown in user message renders terribly**
  *Symptoms*: ### Description  <img width="669" height="565" alt="Image" src="https://github.com/user-attachments/assets/bab8118e-119e-421e-9d4d-2425686ca335" />  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML  ```

- **Issue #2332** (2026-02-10): **Refresh resets to a different project/environment than the one selected**
  *Symptoms*: ### Description  Steps to repro: 1. Create two projects 2. Select the second project 3. Refresh  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML  ```
  **Post-Mortem & Fix Analysis**:
  > This is fixed now

- **Issue #2165** (2026-03-20): **Tool call (when not complete with its tool output) renders without parameters**
  *Symptoms*: ### Description  <img width="1079" height="523" alt="Image" src="https://github.com/user-attachments/assets/5ef19f17-3ef2-4572-9087-6ea26488baff" />  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML  ```
  **Post-Mortem & Fix Analysis**:
  > Given that we've dropped support for cloud this is no longer relevant

- **Issue #2164** (2026-02-10): **Signature/Code styling is wrong in the span more details view**
  *Symptoms*: ### Description  Bad dark mode (no styling): <img width="663" height="226" alt="Image" src="https://github.com/user-attachments/assets/53f220b7-1bc5-4faa-a36e-6a305d2d6647" />  Totally fine in light mode (styled): <img width="661" height="222" alt="Image" src="https://github.com/user-attachments/assets/f049d3e2-3f27-45d9-acdf-56f02ee928e1" />  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML  ```
  **Post-Mortem & Fix Analysis**:
  > This is resolved

- **Issue #2112** (2026-01-23): **`ops.version(tags=["..."])` runs but the trace in Mirascope Cloud causes an error**
  *Symptoms*: ### Description  ```python import os from typing import Literal  from mirascope import llm, ops  ops.configure()  @ops.version(tags=["tag"])  # this causes failures when trying to view the trace @llm.call("openai/gpt-4o-mini") def my_call(query: str) -> str:     return query  my_call("we should fix this") ```  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML mirascope[all]==2.0.1 ```

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

### Incident Patch 1: `993e5733` (2026-10-05)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1530,
+    "stars": 1531,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 2: `4c9394db` (2026-10-01)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1529,
+    "stars": 1530,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 3: `2c0fa536` (2026-09-28)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1528,
+    "stars": 1529,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 4: `d6f22cdf` (2026-09-24)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1527,
+    "stars": 1528,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 5: `32302bbc` (2026-09-22)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1525,
+    "stars": 1527,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 6: `44ddbf0d` (2026-09-20)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1526,
+    "stars": 1525,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 7: `b9c06695` (2026-09-13)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1525,
+    "stars": 1526,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 8: `debbd031` (2026-09-08)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1524,
+    "stars": 1525,
     "version": "v2.5.0"
   }
 }
```

#### Recent Merged Pull Requests:
- **PR #2889** (closed): fix: encode tool outputs as JSON instead of Python repr across all providers (@SyN-droMe)
- **PR #2877** (closed): fix(ops): emit Langfuse-compatible OpenTelemetry trace attributes (@breken-ai)
- **PR #2876** (closed): fix(ops): preserve function metadata on versioned call wrappers (@breken-ai)
- **PR #2871** (closed): docs: note OpenAI client base_url for multi-model gateways (@seven7763)
- **PR #2867** (2026-06-24): chore: bump minor version number (@willbakst)
- **PR #2865** (2026-06-24): feat(providers): add XAIProvider for Grok via Responses API (@NishchayMahor)
- **PR #2861** (closed): Add LLM cost change analysis to CI (@Jwrede)
- **PR #2857** (closed): [Graphite MQ] Draft PR GROUP:spec_a0eefe (PRs 2856) (@graphite-app[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
