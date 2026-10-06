# Forensic Learning Record (Deep Inspection): rohitg00/ai-engineering-from-scratch

> **Canonical Artifact**: `07_PROJECT_LEARNING/rohitg00-ai-engineering-from-scratch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rohitg00/ai-engineering-from-scratch](https://github.com/rohitg00/ai-engineering-from-scratch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:50:56.658Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rohitg00/ai-engineering-from-scratch`
- **Description**: Learn it. Build it. Ship it for others.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 64850 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `certifications/claude/lessons/08-messages-api-and-application-lifecycle/code/main.py`
```
"""Companion code for:
certifications/claude/lessons/08-messages-api-and-application-lifecycle/docs/en.md
It models the Messages API lifecycle without network calls.
Protocol concepts follow the official Anthropic Messages API documentation.
"""

from __future__ import annotations

import base64
import binascii
import copy
import hashlib
import json
from dataclasses import dataclass
from typing import Any, Callable, Iterable


class ProtocolError(ValueError):
    """Raised when a simulated provider response violates the protocol."""


@dataclass(frozen=True)
class RunResult:
    text: str
    messages: list[dict[str, Any]]
    turns: int


@dataclass(frozen=True)
class AccessNeeds:
    """Workload facts used to choose a client and completion pattern."""

    supported_sdk: bool = True
    custom_transport: bool = False
    progressive_output: bool = False
    independent_requests: int = 1
    can_wait: bool = False


def choose_access_pattern(needs: AccessNeeds) -> dict[str, str]:
    """Choose SDK versus REST separately from sync, stream, or batch."""
    if needs.independent_requests < 1:
        raise ValueError("independent_requests must be positive")
    if needs.progressive_output and needs.can_wait and needs.independent_requests > 1:
        raise ValueError("message batches do not provide progressive per-token output")

    client = "raw-rest" if needs.custom_transport or not needs.supported_sdk else "sdk"
    if needs.can_wait and needs.independent_requests > 1:
        delivery = "message-batch"
    elif needs.progressive_output:
        delivery = "streaming"
    else:
        delivery = "synchronous"
    return {"client": client, "delivery": delivery}


class ScriptedTransport:
    """A stateless transport that returns scripted API responses."""

    def __init__(self, responses: list[dict[str, Any]]) -> None:
        self._responses = copy.deepcopy(responses)
        self.requests: list[list[dict[str, Any]]] = []

    def create(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        self.requests.append(copy.deepcopy(messages))
        if not self._responses:
            raise ProtocolError("transport has no scripted response left")
        return self._responses.pop(0)


class MessageLifecycle:
    """Own conversation state and advance it until the model ends the turn."""

    def __init__(
        self,
        transport: ScriptedTransport,
        tools: dict[str, Callable[[dict[str, Any]], Any]] | None = None,
        max_turns: int = 8,
    ) -> None:
        if max_turns < 1:
            raise ValueError("max_turns must be positive")
        self.transport = transport
        self.tools = tools or {}
        self.max_turns = max_turns

    def run(self, user_text: str) -> RunResult:
        if not user_text.strip():
            raise ValueError("user_text must not be empty")
        messages: list[dict[str, Any]] = [
            {"role": "user", "content": [{"type": "text", "text": user_text}]}
        ]

        for turn in range(1, self.max_turns + 1):
            response = self.transport.create(messages)
            blocks = _validated_blocks(response)
            stop_reason = response.get("stop_reason")

            # The assistant tool_use block must be retained before tool_result.
            messages.append({"role": "assistant", "content": copy.deepcopy(blocks)})

            if stop_reason == "end_turn":
                return RunResult(_text_from_blocks(blocks), messages, turn)
            if stop_reason != "tool_use":
                raise ProtocolError(f"unsupported stop_reason: {stop_reason!r}")

            tool_results = [self._execute_tool(block) for block in blocks if block["type"] == "tool_use"]
            if not tool_results:
                raise ProtocolError("stop_reason tool_use had no tool_use block")
            messages.append({"role": "user", "content": tool_results})

        raise ProtocolError(f"maximum turn count {self.max_turns} exceeded")

    def _execute_tool(self, block: dict[str, Any]) -> dict[str, Any]:
        tool_id = block.get("id")
        name = block.get("name")
        arguments = block.get("input")
        if not isinstance(tool_id, str) or not tool_id:
            raise ProtocolError("tool_use requires a non-empty id")
        if not isinstance(name, str) or not isinstance(arguments, dict):
            raise ProtocolError("tool_use requires name and object input")

        handler = self.tools.get(name)
        if handler is None:
            return {
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": f"Unknown tool: {name}",
                "is_error": True,
            }
        try:
            value = handler(arguments)
            return {
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": json.dumps(value, sort_keys=True),
            }
        except Exception as exc:  # Tool failures become model-visible results.
            return {
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": f"{type(exc).__name__}: {exc}",
                "is_error": True,
            }


def _validated_blocks(response: dict[str, Any]) -> list[dict[str, Any]]:
    blocks = response.get("content")
    if not isinstance(blocks, list) or not blocks:
        raise ProtocolError("response content must be a non-empty block list")
    if not all(isinstance(block, dict) and isinstance(block.get("type"), str) for block in blocks):
        raise ProtocolError("every content block needs a type")
    return blocks


def _text_from_blocks(blocks: list[dict[str, Any]]) -> str:
    return "".join(str(block.get("text", "")) for block in blocks if block["type"] == "text")


def collect_stream_text(events: Iterable[dict[str, Any]]) -> str:
    """Collect only text deltas while checking that a stream terminates."""
    chunks: list[str] = []
    stopped = False
    for event in events:
        event_type = event.get("type")
        if stopped:
            raise ProtocolError("event arrived after message_stop")
        if event_type == "content_block_delta":
            delta = event.get("delta", {})
            if delta.get("type") == "text_delta":
                chunks.append(str(delta.get("text", "")))
        elif event_type == "message_stop":
            stopped = True
    if not stopped:
        raise ProtocolError("stream ended without message_stop")
    return "".join(chunks)


def batch(items: list[Any], size: int) -> list[list[Any]]:
    if size < 1:
        raise ValueError("batch size must be positive")
    return [items[index : index + size] for index in range(0, len(items), size)]


def stable_cache_key(model: str, stable_prefix: str) -> str:
    payload = f"{model}\0{stable_prefix}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


IMAGE_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
DOCUMENT_MEDIA_TYPES = {"application/pdf", "text/plain"}


def build_multimodal_request(prompt: str, image_bytes: bytes, reusable_file_id: str) -> dict[str, Any]:
    """Build an offline request body with inline vision and a reusable file asset."""
    if not prompt.strip():
        raise ValueError("prompt must not be empty")
    if not image_bytes:
        raise ValueError("image_bytes must not be empty")
    if not reusable_file_id.strip():
        raise ValueError("reusable_file_id must not be empty")
    return {
        "model": "<current-model-id>",
        "max_tokens": 400,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        },
                    },
                    {
                        "type": "document",
                        "source": {"type": "file", "file_id": reusable_file_id},
                    },
                ],
            }
        ],
    }


def validate_multimodal_request(request: dict[str, Any], owned_file_ids: set[str]) -> list[str]:
    """Validate content blocks and reject file references outside an application allowlist."""
    errors: list[str] = []
    messages = request.get("messages")
    if not isinstance(messages, list) or len(messages) != 1 or not isinstance(messages[0], dict):
        return ["fixture must contain exactly one user message"]
    message = messages[0]
    content = message.get("content")
    if message.get("role") != "user" or not isinstance(content, list) or not content:
        return ["fixture needs a non-empty user content block list"]
    if not isinstance(content[0], dict) or content[0].get("type") != "text" or not str(content[0].get("text", "")).strip():
        errors.append("instruction text must be the first content block")

    for index, block in enumerate(content[1:], start=1):
        if not isinstance(block, dict) or block.get("type") not in {"image", "document"}:
            errors.append(f"content[{index}] must be an image or document block")
            continue
        source = block.get("source")
        if not isinstance(source, dict):
            errors.append(f"content[{index}].source must be an object")
            continue
        source_type = source.get("type")
        if source_type == "file":
            file_id = source.get("file_id")
            if not isinstance(file_id, str) or file_id not in owned_file_ids:
                errors.append(f"content[{index}] references an unowned file_id")
        elif source_type == "base64":
            allowed = IMAGE_MEDIA_TYPES if block["type"] == "image" else DOCUMENT_MEDIA_TYPES
            if source.get("media_type") not in allowed:
        
```

### Core Architecture Module: `certifications/claude/lessons/10-tool-use-and-agentic-loops/code/main.py`
```
"""Companion code for:
certifications/claude/lessons/10-tool-use-and-agentic-loops/docs/en.md
It models Claude tool_use and tool_result content-block sequencing.
Behavior follows official Anthropic client-tool and Messages documentation.
"""

from __future__ import annotations

import copy
import json
from dataclasses import dataclass
from typing import Any, Callable


class ToolLoopError(RuntimeError):
    pass


@dataclass(frozen=True)
class RuntimeNeeds:
    """Facts that decide how much agent-loop infrastructure to adopt."""

    open_ended: bool
    supported_sdk: bool = True
    needs_custom_wire_control: bool = False
    needs_managed_sandbox: bool = False
    needs_remote_durable_session: bool = False
    accepts_managed_beta: bool = False


def choose_runtime(needs: RuntimeNeeds) -> str:
    """Choose a workflow, hand-written loop, Tool Runner, or managed agent."""
    if not needs.open_ended:
        return "deterministic-workflow"
    if needs.needs_managed_sandbox or needs.needs_remote_durable_session:
        if not needs.accepts_managed_beta:
            raise ValueError("managed requirements need explicit acceptance of the current beta boundary")
        return "managed-agents"
    if needs.needs_custom_wire_control or not needs.supported_sdk:
        return "hand-written-loop"
    return "sdk-tool-runner"


@dataclass(frozen=True)
class CapabilityNeeds:
    """Separate executable capability from optional reusable procedure."""

    reusable_procedure: bool = False
    shared_standard_service: bool = False
    provider_executed_builtin: bool = False
    anthropic_schema_client_tool: bool = False


def choose_capability_surface(needs: CapabilityNeeds) -> dict[str, str]:
    execution_flags = sum(
        (
            needs.shared_standard_service,
            needs.provider_executed_builtin,
            needs.anthropic_schema_client_tool,
        )
    )
    if execution_flags > 1:
        raise ValueError("choose one execution boundary for a capability")
    if needs.provider_executed_builtin:
        execution = "server-built-in-tool"
        boundary = "anthropic-service"
    elif needs.anthropic_schema_client_tool:
        execution = "anthropic-schema-client-tool"
        boundary = "application-sandbox"
    elif needs.shared_standard_service:
        execution = "mcp"
        boundary = "mcp-server"
    else:
        execution = "custom-client-tool"
        boundary = "application-service"
    return {
        "execution": execution,
        "procedure": "skill" if needs.reusable_procedure else "inline-instructions",
        "execution_boundary": boundary,
        "authorization_owner": "application-policy",
    }


def _matches_json_type(value: Any, expected: str) -> bool:
    checks: dict[str, Callable[[Any], bool]] = {
        "null": lambda item: item is None,
        "boolean": lambda item: isinstance(item, bool),
        "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
        "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
        "string": lambda item: isinstance(item, str),
        "array": lambda item: isinstance(item, list),
        "object": lambda item: isinstance(item, dict),
    }
    if expected not in checks:
        raise ValueError(f"unsupported schema type: {expected}")
    return checks[expected](value)


def _integer_bound(schema: dict[str, Any], name: str) -> int | None:
    if name not in schema:
        return None
    value = schema[name]
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"schema {name} must be a non-negative integer")
    return value


def _validate_schema_value(value: Any, schema: Any, location: str) -> None:
    if not isinstance(schema, dict):
        raise ValueError(f"schema for {location} must be an object")

    declared_type = schema.get("type")
    if declared_type is not None:
        declared_types = declared_type if isinstance(declared_type, list) else [declared_type]
        if not declared_types or not all(isinstance(item, str) for item in declared_types):
            raise ValueError(f"schema type for {location} must be a string or non-empty string list")
        if not any(_matches_json_type(value, item) for item in declared_types):
            expected = " or ".join(declared_types)
            raise ValueError(f"invalid type for {location}: expected {expected}")

    if "enum" in schema:
        choices = schema["enum"]
        if not isinstance(choices, list) or not choices:
            raise ValueError(f"schema enum for {location} must be a non-empty list")
        if value not in choices:
            raise ValueError(f"invalid value for {location}: not in enum")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        for keyword, comparison, message in (
            ("minimum", lambda current, bound: current >= bound, "below minimum"),
            ("maximum", lambda current, bound: current <= bound, "above maximum"),
            ("exclusiveMinimum", lambda current, bound: current > bound, "at or below exclusive minimum"),
            ("exclusiveMaximum", lambda current, bound: current < bound, "at or above exclusive maximum"),
        ):
            if keyword not in schema:
                continue
            bound = schema[keyword]
            if not isinstance(bound, (int, float)) or isinstance(bound, bool):
                raise ValueError(f"schema {keyword} for {location} must be numeric")
            if not comparison(value, bound):
                raise ValueError(f"invalid value for {location}: {message} {bound}")

    if isinstance(value, str):
        minimum = _integer_bound(schema, "minLength")
        maximum = _integer_bound(schema, "maxLength")
        if minimum is not None and len(value) < minimum:
            raise ValueError(f"invalid length for {location}: below minLength {minimum}")
        if maximum is not None and len(value) > maximum:
            raise ValueError(f"invalid length for {location}: above maxLength {maximum}")

    if isinstance(value, list):
        minimum = _integer_bound(schema, "minItems")
        maximum = _integer_bound(schema, "maxItems")
        if minimum is not None and len(value) < minimum:
            raise ValueError(f"invalid item count for {location}: below minItems {minimum}")
        if maximum is not None and len(value) > maximum:
            raise ValueError(f"invalid item count for {location}: above maxItems {maximum}")
        if "items" in schema:
            for index, item in enumerate(value):
                _validate_schema_value(item, schema["items"], f"{location}[{index}]")

    if isinstance(value, dict):
        properties = schema.get("properties", {})
        if not isinstance(properties, dict):
            raise ValueError(f"schema properties for {location} must be an object")
        required = schema.get("required", [])
        if not isinstance(required, list) or not all(isinstance(name, str) for name in required):
            raise ValueError(f"schema required for {location} must be a string list")
        missing = [name for name in required if name not in value]
        if missing:
            raise ValueError(f"missing required fields: {', '.join(missing)}")
        unexpected = set(value) - set(properties)
        if unexpected and schema.get("additionalProperties") is False:
            raise ValueError(f"unexpected fields: {', '.join(sorted(unexpected))}")
        for name, item in value.items():
            if name in properties:
                _validate_schema_value(item, properties[name], f"{location}.{name}")


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]
    mutates: bool = False

    def validate(self, arguments: dict[str, Any]) -> None:
        if not isinstance(arguments, dict):
            raise ValueError("tool input must be an object")
        _validate_schema_value(arguments, self.input_schema, "tool input")


class ToolRegistry:
    def __init__(self, tools: list[Tool]) -> None:
        names = [tool.name for tool in tools]
        if len(names) != len(set(names)):
            raise ValueError("tool names must be unique")
        self._tools = {tool.name: tool for tool in tools}

    def execute(self, block: dict[str, Any], approve: Callable[[Tool, dict[str, Any]], bool]) -> dict[str, Any]:
        tool_id = block.get("id")
        name = block.get("name")
        arguments = block.get("input")
        if not isinstance(tool_id, str) or not tool_id:
            raise ToolLoopError("tool_use id is required")
        result = {"type": "tool_result", "tool_use_id": tool_id}
        tool = self._tools.get(name)
        if tool is None:
            return {**result, "content": f"Unknown tool: {name}", "is_error": True}
        try:
            tool.validate(arguments)
            if tool.mutates and not approve(tool, arguments):
                return {**result, "content": "Approval denied", "is_error": True}
            value = tool.handler(arguments)
            return {**result, "content": json.dumps(value, sort_keys=True)}
        except Exception as exc:
            return {**result, "content": f"{type(exc).__name__}: {exc}", "is_error": True}


class ScriptedModel:
    def __init__(self, responses: list[dict[str, Any]]) -> None:
        self.responses = copy.deepcopy(responses)
        self.requests: list[list[dict[str, Any]]] = []

    def create(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        self.requests.append(copy.deepcopy(messages))
        if not self.responses:
            raise ToolLoopError("model script exhausted")
        return self.responses.pop(0)


class ToolLoop:
    def __init__(
        self,
        model: ScriptedModel,
        registry: ToolRegistry,
        approve: Callable[[Tool, dict[str, Any]], bool] = lambda _tool, _args: False,
        max_t
```

### Core Architecture Module: `certifications/claude/lessons/12-claude-agent-sdk-and-hooks/code/main.py`
```
"""Companion code for:
certifications/claude/lessons/12-claude-agent-sdk-and-hooks/docs/en.md
It validates tools, hooks, sandbox, budgets, subagent isolation, and resume state.
No Agent SDK installation or provider credential is required for the policy lab.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


REQUIRED_STATE = {"goal", "acceptanceCriteria", "artifactPaths", "contentHashes", "completedSteps", "pendingSteps", "approvalRecords", "operationIds", "testResults", "recoveryPlan"}
REQUIRED_RUNTIME_OWNERSHIP = {"authorization", "data boundaries", "custom tool execution", "event persistence", "final-state verification"}
REQUIRED_APPROVAL_RISKS = {"external-side-effect", "affirmative-consent", "financial-transaction", "terms-acceptance"}


class EventStreamError(ValueError):
    """Raised when a managed-agent event fixture violates the state contract."""


@dataclass(frozen=True)
class EventSummary:
    status: str
    stop_reason: str | None
    messages: list[str]
    pending_action_ids: list[str]
    last_event_id: str | None
    preview_text: str
    complete: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "stop_reason": self.stop_reason,
            "messages": self.messages,
            "pending_action_ids": self.pending_action_ids,
            "last_event_id": self.last_event_id,
            "preview_text": self.preview_text,
            "complete": self.complete,
        }


def consume_managed_events(events: Iterable[dict[str, Any]]) -> EventSummary:
    """Consume persisted events and optional stream previews without network access."""
    status = "unknown"
    stop_reason: str | None = None
    messages: list[str] = []
    preview_parts: list[str] = []
    actionable: set[str] = set()
    pending: set[str] = set()
    seen: set[str] = set()
    last_event_id: str | None = None

    for event in events:
        if not isinstance(event, dict) or not isinstance(event.get("type"), str):
            raise EventStreamError("every event needs a type")
        event_type = event["type"]
        if event_type in {"event_start", "event_delta"}:
            if event_type == "event_delta" and isinstance(event.get("text"), str):
                preview_parts.append(event["text"])
            continue

        event_id = event.get("id")
        if not isinstance(event_id, str) or not event_id:
            raise EventStreamError("persisted events need a non-empty id")
        if event_id in seen:
            continue
        seen.add(event_id)
        last_event_id = event_id

        if event_type == "session.status_running":
            status = "running"
            stop_reason = None
        elif event_type == "agent.message":
            content = event.get("content", [])
            if not isinstance(content, list):
                raise EventStreamError("agent.message content must be a list")
            messages.append(
                "".join(
                    str(block.get("text", ""))
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                )
            )
        elif event_type in {"agent.custom_tool_use", "agent.tool_use", "agent.mcp_tool_use"}:
            actionable.add(event_id)
        elif event_type in {"user.custom_tool_result", "user.tool_confirmation"}:
            reference = event.get("custom_tool_use_id") or event.get("tool_use_id")
            if not isinstance(reference, str) or reference not in actionable:
                raise EventStreamError("tool result or confirmation must reference a known action")
            pending.discard(reference)
        elif event_type == "session.status_idle":
            status = "idle"
            reason = event.get("stop_reason")
            if not isinstance(reason, dict) or reason.get("type") not in {"requires_action", "end_turn"}:
                raise EventStreamError("idle status needs a supported stop_reason")
            stop_reason = reason["type"]
            if stop_reason == "requires_action":
                event_ids = reason.get("event_ids")
                if not isinstance(event_ids, list) or not event_ids or not all(
                    isinstance(item, str) and item in actionable for item in event_ids
                ):
                    raise EventStreamError("requires_action must reference known actionable event IDs")
                pending = set(event_ids)
            else:
                pending.clear()
        elif event_type == "session.status_terminated":
            status = "terminated"
            stop_reason = "terminated"
            pending.clear()
        elif event_type == "session.error":
            raise EventStreamError("session emitted an error event")

    complete = status == "terminated" or (status == "idle" and stop_reason == "end_turn")
    return EventSummary(
        status=status,
        stop_reason=stop_reason,
        messages=messages,
        pending_action_ids=sorted(pending),
        last_event_id=last_event_id,
        preview_text="".join(preview_parts),
        complete=complete,
    )


def validate_policy(policy: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    tools = policy.get("tools")
    if not isinstance(tools, list) or not tools:
        return ["tools must be non-empty"]
    names = [tool.get("name") for tool in tools if isinstance(tool, dict)]
    if len(names) != len(tools) or len(names) != len(set(names)):
        errors.append("tool names must be present and unique")
    for index, tool in enumerate(tools):
        has_action_policy = tool.get("approvalPolicy") == "per-action"
        if tool.get("mutates") is True and tool.get("approvalRequired") is not True and not has_action_policy:
            errors.append(f"tools[{index}] mutation requires approval")
    hooks = policy.get("hooks")
    if not isinstance(hooks, list):
        errors.append("hooks must be a list")
        hooks = []
    pre_tool_names = {name for hook in hooks if isinstance(hook, dict) and hook.get("event") == "pre-tool" for name in hook.get("tools", [])}
    mutating_names = {tool["name"] for tool in tools if tool.get("mutates") is True}
    if not mutating_names <= pre_tool_names:
        errors.append("every mutating tool needs a pre-tool hook")
    if not any(hook.get("event") == "stop" and "verified final state" in str(hook.get("purpose", "")) for hook in hooks if isinstance(hook, dict)):
        errors.append("stop hook must require an independently verified final state")
    sandbox = policy.get("sandbox")
    if not isinstance(sandbox, dict) or not sandbox.get("readRoots") or not sandbox.get("writeRoots") or sandbox.get("network") not in {"deny", "allowlist"} or not sandbox.get("secretPaths"):
        errors.append("sandbox needs roots, network policy, and secret paths")
    budgets = policy.get("budgets")
    if not isinstance(budgets, dict) or any(not isinstance(budgets.get(field), int) or budgets[field] <= 0 for field in ("maxTurns", "maxToolCalls", "deadlineSeconds", "maxConsecutiveErrors")):
        errors.append("budgets must contain positive integer limits")
    reviewer = policy.get("reviewerSubagent")
    if not isinstance(reviewer, dict) or reviewer.get("canWrite") is not False:
        errors.append("reviewerSubagent must be read-only")
    elif set(reviewer.get("tools", [])) & mutating_names:
        errors.append("reviewerSubagent cannot receive mutating tools")
    state = policy.get("durableState")
    if not isinstance(state, dict) or not REQUIRED_STATE <= set(state.get("fields", [])) or state.get("reconcileBeforeResume") is not True:
        errors.append("durableState must persist required fields and reconcile before resume")
    final = policy.get("finalStatePredicate")
    if not isinstance(final, dict) or final.get("type") in {None, "final-prose"} or len(final.get("requirements", [])) < 3:
        errors.append("finalStatePredicate must verify artifacts and state outside final prose")

    runtime = policy.get("runtimeDecision")
    if not isinstance(runtime, dict) or runtime.get("selected") not in {"hand-written-loop", "sdk-tool-runner", "managed-agents"}:
        errors.append("runtimeDecision must select a supported agent runtime")
    elif runtime.get("selected") == "managed-agents" and runtime.get("acceptsManagedBeta") is not True:
        errors.append("managed-agents selection requires explicit beta acceptance")
    if not isinstance(runtime, dict) or not REQUIRED_RUNTIME_OWNERSHIP <= set(runtime.get("applicationOwns", [])):
        errors.append("runtimeDecision must preserve application-owned controls")

    stream = policy.get("managedEventStream")
    if not isinstance(stream, dict) or any(
        stream.get(field) is not expected
        for field, expected in (
            ("persistEventCursor", True),
            ("deduplicateByEventId", True),
            ("connectionCloseIsTerminal", False),
            ("resolveRequiresActionByEventId", True),
        )
    ):
        errors.append("managedEventStream must persist, deduplicate, and resolve explicit state")

    computer = policy.get("computerUse")
    if not isinstance(computer, dict) or computer.get("enabled") is not True:
        errors.append("computerUse policy must be explicit")
    else:
        environment = computer.get("environment")
        display = computer.get("display")
        approval = computer.get("humanApproval")
        if not isinstance(environment, dict) or environment.get("isolation") not in {"dedicated-vm", "container"}:
            errors.append("computerUse needs a dedicated VM or container")
        elif environment.get("network") not in {"deny", "allowlist"} or environment.get("sensitiveData") != "deny":
            errors.append("computerUse needs bounded network and denied sensitive data")
        elif environment.get("network") 
```

### Core Architecture Module: `certifications/claude/lessons/28-stakeholder-communication-adrs-and-lifecycle/code/main.py`
```
"""Companion validator for this lesson's docs/en.md delivery packet."""

from __future__ import annotations

import json
from pathlib import Path


ARTIFACT = Path(__file__).resolve().parents[1] / "outputs" / "delivery-handoff-packet.md"
REQUIRED_HEADINGS = (
    "## Executive Decision",
    "## ADR",
    "## Contract Index",
    "## Operational Readiness",
    "## Ownership Map",
    "## Reversal Condition",
)
REQUIRED_EVIDENCE = {
    "operations": ("rollback", "alert", "slo"),
    "decision": ("rejected", "reversal"),
    "accountability": ("owner",),
    "drill": ("tabletop",),
}


def validate_text(text: str) -> dict[str, object]:
    lowered = " ".join(text.lower().split())
    findings = [f"missing heading: {heading}" for heading in REQUIRED_HEADINGS if heading not in text]
    for label, terms in REQUIRED_EVIDENCE.items():
        missing = [term for term in terms if term not in lowered]
        if missing:
            findings.append(f"missing {label}: {', '.join(missing)}")
    if any(marker in lowered for marker in ("tbd", "todo", "[replace")):
        findings.append("unresolved placeholder")
    return {"status": "ready_for_handoff" if not findings else "blocked", "score": max(0, 100 - 12 * len(findings)), "findings": findings}


def validate_artifact(path: Path = ARTIFACT) -> dict[str, object]:
    return validate_text(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    print(json.dumps(validate_artifact(), indent=2))

```

### Core Architecture Module: `certifications/mcpa/lessons/04-the-stateless-core/code/figure.snippet.js`
```
function statelessRequestsFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>The Stateless Core</strong> any replica answers, because state lives off the process</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 230" role="img" aria-label="Two clients, alice and bob, send requests through a round robin router to two interchangeable server replicas, A and B. Both replicas read and write the same shared handle store, so whichever replica gets the next request answers it correctly.">',
    '<defs><marker id="l04arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" class="l04p"/></marker></defs>',
    '<style>.l04x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l04s{fill:var(--bg,#fff);stroke:var(--blueprint,#3553ff);stroke-dasharray:3,2}.l04t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l04l{stroke:var(--ink-soft,#aaa);stroke-width:1;opacity:.85}.l04a{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l04p{fill:var(--blueprint,#3553ff)}.l04c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
    '<rect class="l04x" x="14" y="26" width="76" height="26"/><text class="l04t" x="22" y="43">alice</text>',
    '<rect class="l04x" x="14" y="140" width="76" height="26"/><text class="l04t" x="22" y="157">bob</text>',
    '<rect class="l04x" x="150" y="80" width="100" height="40"/><text class="l04t" x="158" y="97">router</text><text class="l04t" x="158" y="112">round robin</text>',
    '<rect class="l04x" x="300" y="14" width="100" height="30"/><text class="l04t" x="308" y="33">replica A</text>',
    '<rect class="l04x" x="300" y="156" width="100" height="30"/><text class="l04t" x="308" y="175">replica B</text>',
    '<rect class="l04s" x="452" y="60" width="96" height="80"/><text class="l04t" x="460" y="95">shared</text><text class="l04t" x="460" y="113">store</text>',
    '<line class="l04l" x1="90" y1="39" x2="148" y2="90" marker-end="url(#l04arrow)"/>',
    '<line class="l04l" x1="90" y1="153" x2="148" y2="110" marker-end="url(#l04arrow)"/>',
    '<line class="l04a" x1="250" y1="90" x2="298" y2="29" marker-end="url(#l04arrow)"/>',
    '<line class="l04a" x1="250" y1="110" x2="298" y2="171" marker-end="url(#l04arrow)"/>',
    '<line class="l04a" x1="400" y1="29" x2="450" y2="80" marker-end="url(#l04arrow)"/>',
    '<line class="l04a" x1="400" y1="171" x2="450" y2="120" marker-end="url(#l04arrow)"/>',
    '<text class="l04c" x="14" y="222">same handle, either replica</text>',
    '<text class="l04c" x="300" y="222">state lives in the store</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">Alice\'s and bob\'s requests are routed round robin, with no stickiness to either replica. Neither replica keeps basket state in memory; both read and write the same shared store keyed by the opaque handle a tool call returned, so whichever replica answers the next request answers it correctly.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-04-stateless-requests

```

### Core Architecture Module: `certifications/mcpa/lessons/04-the-stateless-core/code/main.py`
```
"""Companion code for:
certifications/mcpa/lessons/04-the-stateless-core/docs/en.md
Two stateless replicas sharing one handle store answer any client's call.
Sources: SEP-2575 (stateless MCP); SEP-2567 (sessionless MCP); MCP 2026-07-28 basic protocol.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602  # JSON-RPC: Invalid params


def make_request(request_id: int, method: str, params: dict | None = None, capabilities: dict | None = None,
                 version: str = PROTOCOL_VERSION) -> dict:
    body = dict(params or {})
    body["_meta"] = {
        PV_KEY: version,
        CAPS_KEY: capabilities or {},
        CLIENT_INFO_KEY: {"name": "lesson-client", "version": "1.0.0"},
    }
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body}


def make_result(request_id: Any, result_type: str = "complete", **fields: Any) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"resultType": result_type, **fields}}


def make_error(request_id: Any, code: int, message: str, data: Any = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


DEFAULT_TTL_MS = 300000
BASKET_EXPIRY_TICKS = 5


@dataclass
class Clock:
    now: int = 0

    def advance(self, ticks: int = 1) -> None:
        self.now += ticks


@dataclass
class Basket:
    handle: str
    owner: str
    created_at: int
    last_active: int = 0
    items: list[str] = field(default_factory=list)


class SharedStore:
    """Durable storage every replica reads and writes; no basket lives inside a replica process."""

    def __init__(self, clock: Clock) -> None:
        self.clock = clock
        self.baskets: dict[str, Basket] = {}
        self._next_id = 0

    def create_basket(self, owner: str) -> Basket:
        self._next_id += 1
        digest = hashlib.sha256(f"{owner}:{self._next_id}".encode()).hexdigest()[:8]
        handle = f"bsk_{digest}"
        basket = Basket(handle=handle, owner=owner, created_at=self.clock.now, last_active=self.clock.now)
        self.baskets[handle] = basket
        return basket

    def get(self, handle: str) -> Basket | None:
        return self.baskets.get(handle)

    def is_expired(self, basket: Basket) -> bool:
        return self.clock.now - basket.last_active > BASKET_EXPIRY_TICKS


@dataclass
class ToolSpec:
    name: str
    description: str
    input_schema: dict

    def definition(self) -> dict:
        return {"name": self.name, "description": self.description, "inputSchema": self.input_schema}


TOOL_DEFINITIONS = sorted(
    [
        ToolSpec(
            "create_basket",
            f"Create a basket owned by the caller. Returns an opaque basket_id handle; baskets expire "
            f"after {BASKET_EXPIRY_TICKS} idle clock ticks.",
            {"type": "object", "additionalProperties": False},
        ),
        ToolSpec(
            "add_item",
            "Add a sku to an existing basket. Requires the basket_id handle returned by create_basket.",
            {
                "type": "object",
                "properties": {"basket_id": {"type": "string"}, "sku": {"type": "string"}},
                "required": ["basket_id", "sku"],
            },
        ),
        ToolSpec(
            "checkout",
            "Check out a basket by its basket_id handle and return the items it held.",
            {"type": "object", "properties": {"basket_id": {"type": "string"}}, "required": ["basket_id"]},
        ),
    ],
    key=lambda tool: tool.name,
)


@dataclass
class Replica:
    name: str
    store: SharedStore

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": f"basket-replica-{self.name}", "version": "1.0.0"}}

    def handle(self, message: dict, principal: str) -> dict:
        request_id = message.get("id")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else None
        if not isinstance(meta, dict) or not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta protocol fields")
        method = message.get("method")
        if method == "tools/list":
            return make_result(
                request_id,
                tools=[tool.definition() for tool in TOOL_DEFINITIONS],
                ttlMs=DEFAULT_TTL_MS,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        if method == "tools/call":
            return self._call(request_id, params, principal)
        return make_error(request_id, METHOD_NOT_FOUND, f"Unknown method: {method}")

    def _call(self, request_id: Any, params: dict, principal: str) -> dict:
        name = params.get("name")
        arguments = params.get("arguments") or {}
        if name == "create_basket":
            basket = self.store.create_basket(owner=principal)
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Created basket {basket.handle}"}],
                structuredContent={"basket_id": basket.handle},
                isError=False,
                _meta=self._server_meta(),
            )
        if name == "add_item":
            return self._with_basket(request_id, arguments, principal, self._add_item)
        if name == "checkout":
            return self._with_basket(request_id, arguments, principal, self._checkout)
        return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")

    def _with_basket(self, request_id: Any, arguments: dict, principal: str, action) -> dict:
        handle = arguments.get("basket_id")
        basket = self.store.get(handle) if handle else None
        if basket is None:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"No basket found for handle {handle!r}. Call create_basket again."}],
                isError=True,
                _meta=self._server_meta(),
            )
        if self.store.is_expired(basket):
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Basket {basket.handle} expired after {BASKET_EXPIRY_TICKS} idle ticks. Call create_basket again."}],
                isError=True,
                _meta=self._server_meta(),
            )
        if basket.owner != principal:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Basket {basket.handle} belongs to a different principal. Call create_basket for your own."}],
                isError=True,
                _meta=self._server_meta(),
            )
        return action(request_id, basket, arguments)

    def _add_item(self, request_id: Any, basket: Basket, arguments: dict) -> dict:
        sku = arguments.get("sku")
        if not sku:
            return make_result(
                request_id,
                content=[{"type": "text", "text": "sku is required"}],
                isError=True,
                _meta=self._server_meta(),
            )
        basket.items.append(sku)
        basket.last_active = self.store.clock.now
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Added {sku} to {basket.handle} ({len(basket.items)} item(s))"}],
            structuredContent={"basket_id": basket.handle, "items": list(basket.items)},
            isError=False,
            _meta=self._server_meta(),
        )

    def _checkout(self, request_id: Any, basket: Basket, arguments: dict) -> dict:
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Checked out {basket.handle} with {len(basket.items)} item(s)"}],
            structuredContent={"basket_id": basket.handle, "items": list(basket.items)},
            isError=False,
            _meta=self._server_meta(),
        )


class Router:
    """Round robin dispatch across replicas that share one SharedStore; no replica is sticky to a client."""

    def __init__(self, replicas: list[Replica]) -> None:
        self.replicas = replicas
        self._next = 0

    def pick(self) -> Replica:
        replica = self.replicas[self._next % len(self.replicas)]
        self._next += 1
        return replica


class Client:
    def __init__(self, principal: str, router: Router) -> None:
        self.principal = principal
        self.router = router
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params)
        replica = self.router.pick()
        response = replica.handle(request, principal=self.principal)
        self.log.append(request)
        self.log.append(response)
        return response

    def list_tools(self) -> list[dict]:
        return self.send("tools/list")["result"]["tools"]

    def call(self, name: str, arguments: dict) -> dict:
        return self.send("tools/call", {"name": name, "arguments": arguments})


def build_deployment() -> tuple[Clock, Router, Client, Client, Client]:
    clock = Clock()
    store = SharedStore(clock)
    router = Router([Replica("A", store), Replica("B", store)])
    alice = Client("alice", router)
    alice_second_connection = Client("alice", router)
    bob = Client("bob", router)
    return clock, router, alice, alice_seco
```

### Core Architecture Module: `certifications/mcpa/lessons/17-tool-invocation-lifecycle/code/figure.snippet.js`
```
function toolLifecycleFigure(host) {
  ensureStyles();
  var stages = [
    'DISCOVER: server/discover',
    'LIST: tools/list, cached',
    'SELECT: model picks a tool',
    'CONFIRM: host approval gate',
    'CALL: tools/call sent',
    'VALIDATE: is the tool known',
    'EXECUTE: validate args, run',
    'RESULT: resultType'
  ];
  var barX = 16;
  var barW = 234;
  var barH = 26;
  var gap = 14;
  var step = barH + gap;
  var parts = [];
  var i;
  for (i = 0; i < stages.length; i++) {
    var y = 14 + i * step;
    parts.push('<rect class="l17bar" x="' + barX + '" y="' + y + '" width="' + barW + '" height="' + barH + '"/>');
    parts.push('<text class="l17lbl" x="' + (barX + 10) + '" y="' + (y + 17) + '">' + stages[i] + '</text>');
    if (i < stages.length - 1) {
      var midX = barX + barW / 2;
      parts.push('<line class="l17chain" x1="' + midX + '" y1="' + (y + barH) + '" x2="' + midX + '" y2="' + (y + barH + gap) + '" marker-end="url(#l17arrow)"/>');
    }
  }
  var yCall = 14 + 4 * step;
  var yValidate = 14 + 5 * step;
  var yExecute = 14 + 6 * step;
  var yResult = 14 + 7 * step;
  var yRetry = yResult + step;
  var rightX = 340;
  var rightW = 204;
  var rightEdge = barX + barW;

  parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yValidate + 13) + '" x2="' + rightX + '" y2="' + (yValidate + 13) + '"/>');
  parts.push('<rect class="l17err" x="' + rightX + '" y="' + yValidate + '" width="' + rightW + '" height="' + barH + '"/>');
  parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yValidate + 17) + '">unknown tool: -32602</text>');

  parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yExecute + 13) + '" x2="' + rightX + '" y2="' + (yExecute + 13) + '"/>');
  parts.push('<rect class="l17soft" x="' + rightX + '" y="' + yExecute + '" width="' + rightW + '" height="' + barH + '"/>');
  parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yExecute + 17) + '">isError (actionable)</text>');

  parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yResult + 13) + '" x2="' + rightX + '" y2="' + (yResult + 13) + '"/>');
  parts.push('<rect class="l17ok" x="' + rightX + '" y="' + yResult + '" width="' + rightW + '" height="' + barH + '"/>');
  parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yResult + 17) + '">complete: final</text>');

  var elbowX = rightEdge + 30;
  var connectY = yRetry + 8;
  parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yResult + 13) + '" x2="' + elbowX + '" y2="' + (yResult + 13) + '"/>');
  parts.push('<line class="l17dash" x1="' + elbowX + '" y1="' + (yResult + 13) + '" x2="' + elbowX + '" y2="' + connectY + '"/>');
  parts.push('<line class="l17dash" x1="' + elbowX + '" y1="' + connectY + '" x2="' + rightX + '" y2="' + connectY + '"/>');
  parts.push('<rect class="l17soft" x="' + rightX + '" y="' + yRetry + '" width="' + rightW + '" height="' + barH + '"/>');
  parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yRetry + 17) + '">input_required: retry</text>');

  var loopX = rightEdge + 18;
  var loopY = yRetry + 18;
  parts.push('<path class="l17loop" d="M ' + rightX + ' ' + loopY + ' L ' + loopX + ' ' + loopY + ' L ' + loopX + ' ' + (yCall + 13) + ' L ' + (rightEdge + 2) + ' ' + (yCall + 13) + '" marker-end="url(#l17arrow)"/>');

  var height = yRetry + barH + 24;
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>The Tool Invocation Lifecycle</strong> eight checkpoints, two error channels, one loop back for input_required</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 ' + height + '" role="img" aria-label="A vertical chain of eight checkpoints: discover, list, select, confirm, call, validate, execute, result. Validate branches right to an unknown tool -32602 protocol error. Execute branches right to an isError tool execution result. Result branches right to two outcomes: complete, which is final, and input_required, which loops back up to call with a new request id.">',
    '<defs><marker id="l17arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="l17arrowfill" d="M0,0 L10,5 L0,10 z"/></marker></defs>',
    '<style>.l17bar{fill:var(--bg-surface,#eee);stroke:var(--ink,#111)}.l17lbl{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l17chain{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l17arrowfill{fill:var(--blueprint,#3553ff)}.l17dash{stroke:var(--ink-mute,#888);stroke-width:1;stroke-dasharray:3,3}.l17err{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.6}.l17soft{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#888)}.l17ok{fill:var(--bg-surface,#eee);stroke:var(--ink,#111);stroke-width:1.6}.l17loop{fill:none;stroke:var(--ink,#111);stroke-width:1.4}</style>',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">Validate only asks whether the tool exists; failing there is always a protocol error, -32602, with no execute or result stage after it. Everything discovered once execute has started, a bad argument or a business rule, comes back isError inside a normal complete result so the model can read it and retry. A result of input_required is not the end: the client answers it and calls again with a new id, running validate, execute, and result a second time.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-17-lifecycle

```

### Core Architecture Module: `certifications/mcpa/lessons/17-tool-invocation-lifecycle/code/main.py`
```
"""Companion code for:
certifications/mcpa/lessons/17-tool-invocation-lifecycle/docs/en.md
A tool-call lifecycle state machine from discover through final.
Sources: MCP 2026-07-28 Tools, multi round-trip requests, and Cancellation pages.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"
PROGRESS_TOKEN_KEY = "progressToken"

INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


def make_request(request_id: int, method: str, params: dict | None = None, capabilities: dict | None = None,
                 version: str = PROTOCOL_VERSION, progress_token: Any = None) -> dict:
    body = dict(params or {})
    meta = {
        PV_KEY: version,
        CAPS_KEY: capabilities or {},
        CLIENT_INFO_KEY: {"name": "lesson-client", "version": "1.0.0"},
    }
    if progress_token is not None:
        meta[PROGRESS_TOKEN_KEY] = progress_token
    body["_meta"] = meta
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body}


def make_result(request_id: Any, result_type: str = "complete", **fields: Any) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"resultType": result_type, **fields}}


def make_error(request_id: Any, code: int, message: str, data: Any = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


# Local bookkeeping labels for the lifecycle state machine. These never appear
# as a wire resultType: only "complete" and "input_required" do that. A stage
# such as "cancelled" or "timeout" describes what the client decided to do,
# not something the server put on the wire.
STAGE_DISCOVER = "discover"
STAGE_LIST = "list"
STAGE_SELECT = "select"
STAGE_CONFIRM = "confirm"
STAGE_CALL = "call"
STAGE_VALIDATE = "validate"
STAGE_EXECUTE = "execute"
STAGE_PROGRESS = "progress"
STAGE_RESULT = "result"
STAGE_RETRY = "retry"
STAGE_FINAL = "final"


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    read_only: bool = False
    destructive: bool = False
    idempotent: bool = False

    def definition(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema,
            "annotations": {
                "readOnlyHint": self.read_only,
                "destructiveHint": self.destructive,
                "idempotentHint": self.idempotent,
                "openWorldHint": False,
            },
        }


START_BUILD = Tool(
    name="start_build",
    description="Start a build for a service and return a build handle. Not idempotent: every call starts a new build.",
    input_schema={"type": "object", "properties": {"service": {"type": "string"}}, "required": ["service"]},
)
GET_BUILD_STATUS = Tool(
    name="get_build_status",
    description="Poll a build handle for progress. Read-only and safe to retry with the same handle after a broken stream.",
    input_schema={"type": "object", "properties": {"build_id": {"type": "string"}}, "required": ["build_id"]},
    read_only=True,
    idempotent=True,
)
PUBLISH_RELEASE = Tool(
    name="publish_release",
    description="Publish a service to an environment. Destructive: a human confirms before this is even called.",
    input_schema={
        "type": "object",
        "properties": {"service": {"type": "string"}, "environment": {"type": "string"}},
        "required": ["service", "environment"],
    },
    destructive=True,
)
TOOLS = {tool.name: tool for tool in (START_BUILD, GET_BUILD_STATUS, PUBLISH_RELEASE)}


@dataclass
class Build:
    ticks: int = 0
    total: int = 3


def _encode_state(payload: dict[str, Any]) -> str:
    return base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True).encode("utf-8")).decode("ascii")


def _decode_state(state: Any) -> dict[str, Any] | None:
    if not isinstance(state, str):
        return None
    try:
        return json.loads(base64.urlsafe_b64decode(state.encode("ascii")).decode("utf-8"))
    except Exception:
        return None


@dataclass
class LifecycleServer:
    """Runs every tools/call through validate (is the tool known) then execute (schema, then handler)."""

    name: str = "release-pipeline"
    version: str = "1.0.0"
    builds: dict[str, Build] = field(default_factory=dict)
    _seq: int = 0

    def _server_meta(self) -> dict[str, Any]:
        return {SERVER_INFO_KEY: {"name": self.name, "version": self.version}}

    def discover(self, message: dict[str, Any]) -> dict[str, Any]:
        request_id = message["id"]
        return make_result(
            request_id,
            supportedVersions=[PROTOCOL_VERSION],
            capabilities={"tools": {"listChanged": False}},
            ttlMs=300000,
            cacheScope="public",
            _meta=self._server_meta(),
        )

    def list_tools(self, message: dict[str, Any]) -> dict[str, Any]:
        request_id = message["id"]
        tools = [TOOLS[name].definition() for name in sorted(TOOLS)]
        return make_result(request_id, tools=tools, ttlMs=300000, cacheScope="public", _meta=self._server_meta())

    def seed_build(self, service: str, ticks: int, total: int = 3) -> str:
        self._seq += 1
        build_id = f"bld_{self._seq}"
        self.builds[build_id] = Build(ticks=ticks, total=total)
        return build_id

    def call(self, message: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """Checkpoint validate, then checkpoint execute. Returns (notifications, response)."""
        request_id = message.get("id")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        name = params.get("name")
        if name not in TOOLS:
            return [], make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        arguments = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
        progress_token = ((message.get("params") or {}).get("_meta") or {}).get(PROGRESS_TOKEN_KEY)
        if name == START_BUILD.name:
            return [], self._start_build(request_id, arguments)
        if name == GET_BUILD_STATUS.name:
            return self._get_build_status(request_id, arguments, progress_token)
        return [], self._publish_release(request_id, params, arguments)

    def _missing(self, tool: Tool, arguments: dict[str, Any]) -> list[str]:
        return [key for key in tool.input_schema.get("required", []) if key not in arguments]

    def _start_build(self, request_id: Any, arguments: dict[str, Any]) -> dict[str, Any]:
        missing = self._missing(START_BUILD, arguments)
        if missing:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Missing required argument(s): {', '.join(missing)}."}],
                isError=True,
                _meta=self._server_meta(),
            )
        build_id = self.seed_build(arguments["service"], ticks=0, total=3)
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Started build {build_id} for {arguments['service']}"}],
            structuredContent={"buildId": build_id},
            isError=False,
            _meta=self._server_meta(),
        )

    def _get_build_status(self, request_id: Any, arguments: dict[str, Any], progress_token: Any) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        missing = self._missing(GET_BUILD_STATUS, arguments)
        if missing:
            response = make_result(
                request_id,
                content=[{"type": "text", "text": f"Missing required argument(s): {', '.join(missing)}."}],
                isError=True,
                _meta=self._server_meta(),
            )
            return [], response
        build_id = arguments["build_id"]
        build = self.builds.get(build_id)
        if build is None:
            response = make_result(
                request_id,
                content=[{"type": "text", "text": f"No build with handle {build_id}. It may have expired; start a new build."}],
                isError=True,
                _meta=self._server_meta(),
            )
            return [], response
        if build_id == "bld_corrupt":
            # A genuine, unexpected server fault: not something the caller's
            # input caused, so it is reported as a protocol error, not isError.
            try:
                _ = build.ticks / (build.total - build.total)
            except ZeroDivisionError as exc:
                return [], make_error(request_id, INTERNAL_ERROR, f"release-pipeline hit an unexpected fault: {exc}")
        notifications: list[dict[str, Any]] = []
        if build.ticks < build.total:
            build.ticks += 1
        if progress_token is not None:
            notifications.append({
                "jsonrpc": "2.0",
                "method": "notifications/progress",
                "params": {"progressToken": progress_token, "progress": build.ticks, "total": build.total,
                          "message": f"build {build_id}: {build.ticks}/{build.total}"},
            })
        if build.ticks >= build.total:
            response = make_result(
                request_id,
                content=[{"type": "text", "text": f"Build {build_id} complete"}],
                structuredContent={"buildId": build_id, "status": "complete"},
                isError=False,
                _meta=self._server_meta(),
            )
        else:
            response = make_result(
                request_id,
                content=[{"type": "text", "text": f"Bu
```

### Core Architecture Module: `phases/00-setup-and-tooling/09-data-management/code/data_utils.py`
```
import sys
import json
import hashlib
from pathlib import Path

try:
    from datasets import load_dataset, Dataset
except ImportError:
    print("Install the datasets library: pip install datasets")
    sys.exit(1)

try:
    from huggingface_hub import hf_hub_download
except ImportError:
    print("Install huggingface_hub: pip install huggingface_hub")
    sys.exit(1)


CACHE_DIR = Path.home() / ".cache" / "huggingface" / "datasets"


def load_and_inspect(dataset_name: str, config: str = None, split: str = "train"):
    kwargs = {"path": dataset_name}
    if config:
        kwargs["name"] = config
    if split:
        kwargs["split"] = split

    ds = load_dataset(**kwargs)
    print(f"Dataset: {dataset_name}")
    print(f"  Split: {split}")
    print(f"  Rows: {len(ds)}")
    print(f"  Columns: {ds.column_names}")
    print(f"  Features: {ds.features}")
    print(f"  First row: {ds[0]}")
    return ds


def stream_dataset(dataset_name: str, config: str = None, max_rows: int = 5):
    kwargs = {"path": dataset_name, "split": "train", "streaming": True}
    if config:
        kwargs["name"] = config

    ds = load_dataset(**kwargs)
    rows = []
    for i, example in enumerate(ds):
        rows.append(example)
        if i >= max_rows - 1:
            break

    print(f"Streamed {len(rows)} rows from {dataset_name}")
    return rows


def convert_format(ds, output_dir: str, name: str):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    csv_path = output_path / f"{name}.csv"
    json_path = output_path / f"{name}.json"
    parquet_path = output_path / f"{name}.parquet"

    ds.to_csv(str(csv_path))
    ds.to_json(str(json_path))
    ds.to_parquet(str(parquet_path))

    csv_size = csv_path.stat().st_size
    json_size = json_path.stat().st_size
    parquet_size = parquet_path.stat().st_size

    print(f"Format comparison for {name}:")
    print(f"  CSV:     {csv_size:>10,} bytes")
    print(f"  JSON:    {json_size:>10,} bytes")
    print(f"  Parquet: {parquet_size:>10,} bytes")
    print(f"  Parquet is {csv_size / parquet_size:.1f}x smaller than CSV")

    return {"csv": csv_path, "json": json_path, "parquet": parquet_path}


def make_splits(ds, train_ratio: float = 0.8, val_ratio: float = 0.1, seed: int = 42):
    test_ratio = 1.0 - train_ratio - val_ratio
    assert test_ratio > 0, "train_ratio + val_ratio must be less than 1.0"

    test_size = val_ratio + test_ratio
    split1 = ds.train_test_split(test_size=test_size, seed=seed)
    train_ds = split1["train"]

    val_fraction = val_ratio / test_size
    split2 = split1["test"].train_test_split(test_size=(1.0 - val_fraction), seed=seed)
    val_ds = split2["train"]
    test_ds = split2["test"]

    total = len(train_ds) + len(val_ds) + len(test_ds)
    print(f"Splits (seed={seed}):")
    print(f"  Train: {len(train_ds):>6} ({len(train_ds)/total:.1%})")
    print(f"  Val:   {len(val_ds):>6} ({len(val_ds)/total:.1%})")
    print(f"  Test:  {len(test_ds):>6} ({len(test_ds)/total:.1%})")

    return {"train": train_ds, "val": val_ds, "test": test_ds}


def download_model_file(repo_id: str, filename: str):
    path = hf_hub_download(repo_id=repo_id, filename=filename)
    size = Path(path).stat().st_size
    print(f"Downloaded {filename} from {repo_id}")
    print(f"  Path: {path}")
    print(f"  Size: {size:,} bytes")
    return path


def cache_summary():
    cache_path = CACHE_DIR
    if not cache_path.exists():
        print("No HF cache found yet.")
        return

    total_size = 0
    file_count = 0
    for f in cache_path.rglob("*"):
        if f.is_file():
            total_size += f.stat().st_size
            file_count += 1

    print(f"HF Dataset Cache: {cache_path}")
    print(f"  Files: {file_count}")
    print(f"  Total size: {total_size / (1024 * 1024):.1f} MB")


def load_from_parquet(path: str):
    ds = Dataset.from_parquet(path)
    print(f"Loaded {len(ds)} rows from {path}")
    return ds


def load_from_csv(path: str):
    ds = Dataset.from_csv(path)
    print(f"Loaded {len(ds)} rows from {path}")
    return ds


def load_from_json(path: str):
    ds = Dataset.from_json(path)
    print(f"Loaded {len(ds)} rows from {path}")
    return ds


def fingerprint(ds, num_rows: int = 100):
    sample = ds.select(range(min(num_rows, len(ds))))
    content = json.dumps([row for row in sample], default=str).encode()
    digest = hashlib.sha256(content).hexdigest()[:16]
    print(f"Dataset fingerprint (first {num_rows} rows): {digest}")
    return digest


if __name__ == "__main__":
    print("=" * 60)
    print("Data Management Utility")
    print("=" * 60)

    print("\n--- 1. Load and inspect a dataset ---")
    ds = load_and_inspect("cornell-movie-review-data/rotten_tomatoes", split="train")

    print("\n--- 2. Stream a dataset ---")
    rows = stream_dataset("cornell-movie-review-data/rotten_tomatoes", max_rows=3)
    for row in rows:
        print(f"  {row['text'][:80]}...")

    print("\n--- 3. Convert formats ---")
    small_ds = ds.select(range(500))
    paths = convert_format(small_ds, "/tmp/data_utils_demo", "rotten_tomatoes_sample")

    print("\n--- 4. Create train/val/test splits ---")
    splits = make_splits(small_ds, train_ratio=0.8, val_ratio=0.1, seed=42)

    print("\n--- 5. Reload from Parquet ---")
    reloaded = load_from_parquet(str(paths["parquet"]))
    print(f"  Columns: {reloaded.column_names}")

    print("\n--- 6. Download a model file ---")
    download_model_file("sentence-transformers/all-MiniLM-L6-v2", "config.json")

    print("\n--- 7. Dataset fingerprint ---")
    fingerprint(ds)

    print("\n--- 8. Cache summary ---")
    cache_summary()

    print("\n" + "=" * 60)
    print("All checks passed. Your data pipeline is ready.")
    print("=" * 60)

```

### Core Architecture Module: `phases/02-ml-fundamentals/08-feature-engineering/code/features.py`
```
import math
import random


def min_max_scale(values):
    min_val = min(values)
    max_val = max(values)
    if max_val == min_val:
        return [0.0] * len(values)
    return [(v - min_val) / (max_val - min_val) for v in values]


def standardize(values):
    n = len(values)
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n
    std = math.sqrt(variance) if variance > 0 else 1.0
    return [(v - mean) / std for v in values]


def log_transform(values):
    return [math.log(v + 1) for v in values]


def bin_values(values, n_bins=5):
    min_val = min(values)
    max_val = max(values)
    bin_width = (max_val - min_val) / n_bins
    if bin_width == 0:
        return [0] * len(values)
    result = []
    for v in values:
        bin_idx = int((v - min_val) / bin_width)
        bin_idx = min(bin_idx, n_bins - 1)
        result.append(bin_idx)
    return result


def polynomial_features(row, degree=2):
    n = len(row)
    result = list(row)
    if degree >= 2:
        for i in range(n):
            result.append(row[i] ** 2)
        for i in range(n):
            for j in range(i + 1, n):
                result.append(row[i] * row[j])
    return result


def one_hot_encode(values):
    categories = sorted(set(values))
    cat_to_idx = {cat: i for i, cat in enumerate(categories)}
    n_cats = len(categories)

    encoded = []
    for v in values:
        row = [0] * n_cats
        row[cat_to_idx[v]] = 1
        encoded.append(row)

    return encoded, categories


def label_encode(values):
    categories = sorted(set(values))
    cat_to_int = {cat: i for i, cat in enumerate(categories)}
    return [cat_to_int[v] for v in values], cat_to_int


def target_encode(feature_values, target_values, smoothing=10):
    global_mean = sum(target_values) / len(target_values)

    category_stats = {}
    for feat, target in zip(feature_values, target_values):
        if feat not in category_stats:
            category_stats[feat] = {"sum": 0.0, "count": 0}
        category_stats[feat]["sum"] += target
        category_stats[feat]["count"] += 1

    encoding = {}
    for cat, stats in category_stats.items():
        cat_mean = stats["sum"] / stats["count"]
        weight = stats["count"] / (stats["count"] + smoothing)
        encoding[cat] = weight * cat_mean + (1 - weight) * global_mean

    return [encoding[v] for v in feature_values], encoding


def count_vectorize(documents):
    vocab = {}
    idx = 0
    for doc in documents:
        for word in doc.lower().split():
            if word not in vocab:
                vocab[word] = idx
                idx += 1

    vectors = []
    for doc in documents:
        vec = [0] * len(vocab)
        for word in doc.lower().split():
            vec[vocab[word]] += 1
        vectors.append(vec)

    return vectors, vocab


def tfidf(documents):
    n_docs = len(documents)

    vocab = {}
    idx = 0
    for doc in documents:
        for word in doc.lower().split():
            if word not in vocab:
                vocab[word] = idx
                idx += 1

    doc_freq = {}
    for doc in documents:
        seen = set()
        for word in doc.lower().split():
            if word not in seen:
                doc_freq[word] = doc_freq.get(word, 0) + 1
                seen.add(word)

    vectors = []
    for doc in documents:
        words = doc.lower().split()
        word_count = len(words)
        tf_map = {}
        for word in words:
            tf_map[word] = tf_map.get(word, 0) + 1

        vec = [0.0] * len(vocab)
        for word, count in tf_map.items():
            tf = count / word_count
            idf = math.log(n_docs / doc_freq[word])
            vec[vocab[word]] = tf * idf
        vectors.append(vec)

    return vectors, vocab


def impute_mean(values):
    present = [v for v in values if v is not None]
    if not present:
        return [0.0] * len(values), 0.0
    mean = sum(present) / len(present)
    return [v if v is not None else mean for v in values], mean


def impute_median(values):
    present = sorted(v for v in values if v is not None)
    if not present:
        return [0.0] * len(values), 0.0
    n = len(present)
    if n % 2 == 0:
        median = (present[n // 2 - 1] + present[n // 2]) / 2
    else:
        median = present[n // 2]
    return [v if v is not None else median for v in values], median


def impute_mode(values):
    present = [v for v in values if v is not None]
    if not present:
        return values, None
    counts = {}
    for v in present:
        counts[v] = counts.get(v, 0) + 1
    mode = max(counts, key=counts.get)
    return [v if v is not None else mode for v in values], mode


def add_missing_indicator(values):
    return [0 if v is not None else 1 for v in values]


def correlation(x, y):
    n = len(x)
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    cov = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y)) / n
    std_x = math.sqrt(sum((xi - mean_x) ** 2 for xi in x) / n)
    std_y = math.sqrt(sum((yi - mean_y) ** 2 for yi in y) / n)
    if std_x == 0 or std_y == 0:
        return 0.0
    return cov / (std_x * std_y)


def mutual_information(feature, target, n_bins=10):
    feat_min = min(feature)
    feat_max = max(feature)
    bin_width = (feat_max - feat_min) / n_bins if feat_max != feat_min else 1.0
    feat_binned = [
        min(int((f - feat_min) / bin_width), n_bins - 1) for f in feature
    ]

    n = len(feature)
    target_classes = sorted(set(target))

    feat_bins = sorted(set(feat_binned))
    p_feat = {}
    for b in feat_bins:
        p_feat[b] = feat_binned.count(b) / n

    p_target = {}
    for t in target_classes:
        p_target[t] = target.count(t) / n

    mi = 0.0
    for b in feat_bins:
        for t in target_classes:
            joint_count = sum(
                1 for fb, tv in zip(feat_binned, target) if fb == b and tv == t
            )
            p_joint = joint_count / n
            if p_joint > 0:
                mi += p_joint * math.log(p_joint / (p_feat[b] * p_target[t]))

    return mi


def variance_threshold(features, threshold=0.01):
    n_features = len(features[0])
    n_samples = len(features)
    selected = []

    for j in range(n_features):
        col = [features[i][j] for i in range(n_samples)]
        mean = sum(col) / n_samples
        var = sum((v - mean) ** 2 for v in col) / n_samples
        if var >= threshold:
            selected.append(j)

    return selected


def remove_correlated(features, threshold=0.9):
    n_features = len(features[0])
    n_samples = len(features)

    to_remove = set()
    for i in range(n_features):
        if i in to_remove:
            continue
        col_i = [features[r][i] for r in range(n_samples)]
        for j in range(i + 1, n_features):
            if j in to_remove:
                continue
            col_j = [features[r][j] for r in range(n_samples)]
            corr = abs(correlation(col_i, col_j))
            if corr >= threshold:
                to_remove.add(j)

    return [i for i in range(n_features) if i not in to_remove]


def make_housing_data(n=200, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        sqft = random.uniform(500, 5000)
        bedrooms = random.choice([1, 2, 3, 4, 5])
        age = random.uniform(0, 50)
        neighborhood = random.choice(["downtown", "suburbs", "rural"])
        has_pool = random.choice([True, False])

        sqft_with_missing = sqft if random.random() > 0.05 else None
        age_with_missing = age if random.random() > 0.08 else None

        price = (
            50 * sqft
            + 20000 * bedrooms
            - 1000 * age
            + (50000 if neighborhood == "downtown" else 10000 if neighborhood == "suburbs" else 0)
            + (15000 if has_pool else 0)
            + random.gauss(0, 20000)
        )

        data.append({
            "sqft": sqft_with_missing,
            "bedrooms": bedrooms,
            "age": age_with_missing,
            "neighborhood": neighborhood,
            "has_pool": has_pool,
            "price": price,
        })
    return data


if __name__ == "__main__":
    data = make_housing_data(200)

    print("=== Raw Data Sample ===")
    for row in data[:3]:
        print(f"  {row}")

    sqft_raw = [d["sqft"] for d in data]
    age_raw = [d["age"] for d in data]
    prices = [d["price"] for d in data]

    print("\n=== Missing Value Handling ===")
    sqft_missing = sum(1 for v in sqft_raw if v is None)
    age_missing = sum(1 for v in age_raw if v is None)
    print(f"  sqft missing: {sqft_missing}/{len(sqft_raw)}")
    print(f"  age missing: {age_missing}/{len(age_raw)}")

    sqft_indicator = add_missing_indicator(sqft_raw)
    age_indicator = add_missing_indicator(age_raw)
    sqft_imputed, sqft_fill = impute_median(sqft_raw)
    age_imputed, age_fill = impute_mean(age_raw)
    print(f"  sqft filled with median: {sqft_fill:.0f}")
    print(f"  age filled with mean: {age_fill:.1f}")

    print("\n=== Numerical Transforms ===")
    sqft_scaled = standardize(sqft_imputed)
    age_scaled = min_max_scale(age_imputed)
    sqft_log = log_transform(sqft_imputed)
    age_binned = bin_values(age_imputed, n_bins=5)
    print(f"  sqft standardized: mean={sum(sqft_scaled)/len(sqft_scaled):.4f}, std={math.sqrt(sum(v**2 for v in sqft_scaled)/len(sqft_scaled)):.4f}")
    print(f"  age min-max: [{min(age_scaled):.2f}, {max(age_scaled):.2f}]")
    print(f"  age bins: {sorted(set(age_binned))}")

    print("\n=== Categorical Encoding ===")
    neighborhoods = [d["neighborhood"] for d in data]

    ohe, ohe_cats = one_hot_encode(neighborhoods)
    print(f"  One-hot categories: {ohe_cats}")
    print(f"  Sample encoding: {neighborhoods[0]} -> {ohe[0]}")

    le, le_map = label_encode(neighborhoods)
    print(f"  Label encoding map: {le_map}")

    te, te_map = target_encode(neighborhoods, prices, smoothing=10)
    print(f"  Target encoding: {({k: round(v) for k, v in te_map.items()})}")

    pr
```

### Core Architecture Module: `phases/03-deep-learning-core/01-the-perceptron/code/perceptron.py`
```
class Perceptron:
    def __init__(self, n_inputs, learning_rate=0.1):
        self.weights = [0.0] * n_inputs
        self.bias = 0.0
        self.lr = learning_rate

    def predict(self, inputs):
        total = sum(w * x for w, x in zip(self.weights, inputs))
        total += self.bias
        return 1 if total >= 0 else 0

    def train(self, training_data, epochs=100):
        for epoch in range(epochs):
            errors = 0
            for inputs, target in training_data:
                prediction = self.predict(inputs)
                error = target - prediction
                if error != 0:
                    errors += 1
                    for i in range(len(self.weights)):
                        self.weights[i] += self.lr * error * inputs[i]
                    self.bias += self.lr * error
            if errors == 0:
                print(f"Converged at epoch {epoch + 1}")
                return
        print(f"Did not converge after {epochs} epochs")


def test_gate(name, n_inputs, data):
    print(f"=== {name} ===")
    p = Perceptron(n_inputs)
    p.train(data)
    print(f"  Weights: {p.weights}, Bias: {p.bias}")
    for inputs, expected in data:
        result = p.predict(inputs)
        status = "OK" if result == expected else "WRONG"
        print(f"  {inputs} -> {result} (expected {expected}) {status}")
    print()


and_data = [
    ([0, 0], 0),
    ([0, 1], 0),
    ([1, 0], 0),
    ([1, 1], 1),
]

or_data = [
    ([0, 0], 0),
    ([0, 1], 1),
    ([1, 0], 1),
    ([1, 1], 1),
]

not_data = [
    ([0], 1),
    ([1], 0),
]

xor_data = [
    ([0, 0], 0),
    ([0, 1], 1),
    ([1, 0], 1),
    ([1, 1], 0),
]

test_gate("AND Gate", 2, and_data)
test_gate("OR Gate", 2, or_data)
test_gate("NOT Gate", 1, not_data)

print("=== XOR Gate (single perceptron - will fail) ===")
p_xor = Perceptron(2)
p_xor.train(xor_data, epochs=1000)
for inputs, expected in xor_data:
    result = p_xor.predict(inputs)
    status = "OK" if result == expected else "WRONG"
    print(f"  {inputs} -> {result} (expected {expected}) {status}")
print()


def xor_network(x1, x2):
    or_neuron = Perceptron(2)
    or_neuron.weights = [1.0, 1.0]
    or_neuron.bias = -0.5

    nand_neuron = Perceptron(2)
    nand_neuron.weights = [-1.0, -1.0]
    nand_neuron.bias = 1.5

    and_neuron = Perceptron(2)
    and_neuron.weights = [1.0, 1.0]
    and_neuron.bias = -1.5

    hidden1 = or_neuron.predict([x1, x2])
    hidden2 = nand_neuron.predict([x1, x2])
    return and_neuron.predict([hidden1, hidden2])


print("=== XOR Gate (multi-layer network - works) ===")
for inputs, expected in xor_data:
    result = xor_network(inputs[0], inputs[1])
    status = "OK" if result == expected else "WRONG"
    print(f"  {inputs} -> {result} (expected {expected}) {status}")
print()


class TwoLayerNetwork:
    def __init__(self, learning_rate=0.5):
        import random
        random.seed(0)
        self.w_hidden = [[random.uniform(-1, 1), random.uniform(-1, 1)] for _ in range(2)]
        self.b_hidden = [random.uniform(-1, 1), random.uniform(-1, 1)]
        self.w_output = [random.uniform(-1, 1), random.uniform(-1, 1)]
        self.b_output = random.uniform(-1, 1)
        self.lr = learning_rate

    def sigmoid(self, x):
        import math
        x = max(-500, min(500, x))
        return 1.0 / (1.0 + math.exp(-x))

    def forward(self, inputs):
        self.inputs = inputs
        self.hidden_outputs = []
        for i in range(2):
            z = sum(w * x for w, x in zip(self.w_hidden[i], inputs)) + self.b_hidden[i]
            self.hidden_outputs.append(self.sigmoid(z))
        z_out = sum(w * h for w, h in zip(self.w_output, self.hidden_outputs)) + self.b_output
        self.output = self.sigmoid(z_out)
        return self.output

    def train(self, training_data, epochs=10000):
        for epoch in range(epochs):
            total_error = 0
            for inputs, target in training_data:
                output = self.forward(inputs)
                error = target - output
                total_error += error ** 2

                d_output = error * output * (1 - output)

                saved_w_output = self.w_output[:]
                hidden_deltas = []
                for i in range(2):
                    h = self.hidden_outputs[i]
                    hd = d_output * saved_w_output[i] * h * (1 - h)
                    hidden_deltas.append(hd)

                for i in range(2):
                    self.w_output[i] += self.lr * d_output * self.hidden_outputs[i]
                self.b_output += self.lr * d_output

                for i in range(2):
                    for j in range(len(inputs)):
                        self.w_hidden[i][j] += self.lr * hidden_deltas[i] * inputs[j]
                    self.b_hidden[i] += self.lr * hidden_deltas[i]

            if epoch % 2000 == 0:
                print(f"  Epoch {epoch}, error: {total_error:.4f}")


print("=== XOR Gate (trained 2-layer network with backpropagation) ===")
net = TwoLayerNetwork(learning_rate=2.0)
net.train(xor_data, epochs=10000)
print()
for inputs, expected in xor_data:
    result = net.forward(inputs)
    predicted = 1 if result >= 0.5 else 0
    print(f"  {inputs} -> {result:.4f} (rounded: {predicted}, expected {expected})")

```

### Core Architecture Module: `phases/03-deep-learning-core/02-multi-layer-networks/code/main.py`
```
import math
import random


def sigmoid(x):
    x = max(-500.0, min(500.0, x))
    return 1.0 / (1.0 + math.exp(-x))


class Layer:
    def __init__(self, n_inputs, n_neurons, weights=None, biases=None):
        if weights is not None:
            self.weights = weights
        else:
            self.weights = [
                [random.uniform(-1, 1) for _ in range(n_inputs)]
                for _ in range(n_neurons)
            ]
        if biases is not None:
            self.biases = biases
        else:
            self.biases = [0.0] * n_neurons

    def forward(self, inputs):
        self.last_input = inputs
        self.last_output = []
        for neuron_idx in range(len(self.weights)):
            z = sum(
                w * x for w, x in zip(self.weights[neuron_idx], inputs)
            )
            z += self.biases[neuron_idx]
            self.last_output.append(sigmoid(z))
        return self.last_output


class Network:
    def __init__(self, layers):
        self.layers = layers

    def forward(self, inputs):
        current = inputs
        for layer in self.layers:
            current = layer.forward(current)
        return current

    def count_parameters(self):
        total = 0
        for layer in self.layers:
            for neuron_weights in layer.weights:
                total += len(neuron_weights)
            total += len(layer.biases)
        return total


if __name__ == "__main__":
    print("=" * 60)
    print("DEMO 1: XOR with hand-tuned 2-2-1 network")
    print("=" * 60)

    hidden = Layer(
        n_inputs=2,
        n_neurons=2,
        weights=[[20.0, 20.0], [-20.0, -20.0]],
        biases=[-10.0, 30.0],
    )

    output = Layer(
        n_inputs=2,
        n_neurons=1,
        weights=[[20.0, 20.0]],
        biases=[-30.0],
    )

    xor_net = Network([hidden, output])

    xor_data = [
        ([0, 0], 0),
        ([0, 1], 1),
        ([1, 0], 1),
        ([1, 1], 0),
    ]

    all_correct = True
    for inputs, expected in xor_data:
        result = xor_net.forward(inputs)
        predicted = 1 if result[0] >= 0.5 else 0
        status = "OK" if predicted == expected else "WRONG"
        if predicted != expected:
            all_correct = False
        print(f"  {inputs} -> {result[0]:.6f} (rounded: {predicted}, expected: {expected}) {status}")

    print(f"\nXOR solved: {all_correct}")
    print(f"Parameters: {xor_net.count_parameters()}")

    print()
    print("=" * 60)
    print("DEMO 2: Circle classification with 2-8-1 network")
    print("=" * 60)

    random.seed(42)

    data = []
    for _ in range(200):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        label = 1 if (x * x + y * y) < 0.25 else 0
        data.append(([x, y], label))

    inside_count = sum(1 for _, label in data if label == 1)
    outside_count = len(data) - inside_count
    print(f"  Dataset: {len(data)} points ({inside_count} inside, {outside_count} outside)")

    random.seed(7)
    circle_net = Network([
        Layer(n_inputs=2, n_neurons=8),
        Layer(n_inputs=8, n_neurons=1),
    ])

    correct = 0
    for inputs, expected in data:
        result = circle_net.forward(inputs)
        predicted = 1 if result[0] >= 0.5 else 0
        if predicted == expected:
            correct += 1

    print(f"  Accuracy with random weights: {correct}/{len(data)} ({100 * correct / len(data):.1f}%)")
    print(f"  Parameters: {circle_net.count_parameters()}")
    print(f"  (Random weights give poor accuracy -- training needed)")

    print()
    print("=" * 60)
    print("DEMO 3: Forward pass internals on XOR")
    print("=" * 60)

    for inputs, expected in xor_data:
        xor_net.forward(inputs)
        h = xor_net.layers[0].last_output
        o = xor_net.layers[1].last_output
        print(f"  Input: {inputs}")
        print(f"    Hidden: [{h[0]:.6f}, {h[1]:.6f}]")
        print(f"    Output: {o[0]:.6f} -> {'1' if o[0] >= 0.5 else '0'} (expected: {expected})")

    print()
    print("=" * 60)
    print("DEMO 4: Parameter count for classic architectures")
    print("=" * 60)

    architectures = [
        ("2-3-1 (this lesson)", [2, 3, 1]),
        ("2-8-1 (circle)", [2, 8, 1]),
        ("784-256-128-10 (MNIST)", [784, 256, 128, 10]),
        ("784-512-256-128-10 (deep MNIST)", [784, 512, 256, 128, 10]),
    ]

    for name, sizes in architectures:
        layers = []
        for i in range(1, len(sizes)):
            layers.append(Layer(n_inputs=sizes[i - 1], n_neurons=sizes[i]))
        net = Network(layers)
        print(f"  {name}: {net.count_parameters():,} parameters")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #479** (2026-09-28): **Add a "Complete Lesson" button at the end of every lesson**
  *Symptoms*: ## Problem  Learners need a clear and consistent way to mark a lesson as completed after finishing its content.  Currently, progress tracking is visible on the website, but completing a lesson should be an explicit action available at the end of each lesson.  ## Proposed solution  Add a **"Complete Lesson"** button at the bottom of every lesson page.  When the learner clicks the button:  - Mark the current lesson as completed. - Persist the completion state locally. - Update the completed-lessons counter and progress bar. - Change the button state to something like **"Completed ✓"**. - Prevent duplicate completion actions if the lesson is already marked as completed.  ## Suggested UX  - Place the button after the final lesson section, quiz, exercise, or artifact. - Use a visually clear primary button style. - Show a short confirmation message after completion. - Allow learners to unmark a lesson later if needed.  ## Acceptance criteria  - Every lesson has a completion button at its end. - Clicking the button updates the lesson completion state. - Progress counters update immediately without requiring a page refresh. - Completion state remains available after reloading the website. - Completed lessons have a clear visual state. - The feature works on both desktop and mobile layouts.  ## Why this matters  A visible completion action gives learners a stronger sense of progress and makes it easier to follow the curriculum in sequence. 

- **Issue #476** (2026-09-24): **[bug] Error in the Dockerfile for the lesson `phases/00-setup-and-tooling/07-docker-for-ai` when running `docker build`**
  *Symptoms*: ## Where  phases/00-setup-and-tooling/07-docker-for-ai  ## What's wrong  Error running : docker build -t ai-dev -f phases/00-setup-and-tooling/07-docker-for-ai/code/Dockerfile .  ## Reproduce Done as described in the lesson.  ## Environment  - OS: MacBook Pro M2 Max  ## Screenshot or logs  Log:  [+] Building 113.1s (10/12)                                             docker:desktop-linux  => [internal] load build definition from Dockerfile                                    0.0s  => => transferring dockerfile: 1.50kB                                                  0.0s  => [internal] load metadata for docker.io/nvidia/cuda:12.4.1-devel-ubuntu22.04         1.8s  => [auth] nvidia/cuda:pull token for registry-1.docker.io                              0.0s  => [internal] load .dockerignore                                                       0.0s  => => transferring context: 2B                                                         0.0s  => [1/8] FROM docker.io/nvidia/cuda:12.4.1-devel-ubuntu22.04@sha256:da6791294b0b04d7  47.1s  => => resolve docker.io/nvidia/cuda:12.4.1-devel-ubuntu22.04@sha256:da6791294b0b04d7e  0.0s  => => sha256:59588f87dd82424f152239a2a3e72bb32880fceabd3c1f30c82721 88.23kB / 88.23kB  0.1s  => => sha256:8a791a9b45017619d9c8b0bac087727fe19db13c49d1782fa25f38b 2.17GB / 2.17GB  31.9s  => => sha256:4c60b5e7307e86fa82203b0c227d8001dce1fc4804fd49bbb2d42f6a 1.52kB / 1.52kB  0.4s  => => sha256:e37bdbfc55edc529a8d47b715f30651f78a56c0b59122e238b2eba69 1.68kB / 1.68kB 
  **Post-Mortem & Fix Analysis**:
  > Fixed in #477 and live. The Dockerfile now pins FROM --platform=linux/amd64: the CUDA base image has an arm64 variant that Docker Desktop picks on Apple Silicon, but the cu124 wheel index only ships x86_64 builds, so the torch layer failed. The lesson explains the emulation tradeoff and points Mac users at the native MPS path. Thanks for including the full log.

- **Issue #473** (2026-09-24): **[bug] Unzip not installed, causing issue to install nodejs**
  *Symptoms*: ## Where  - Phase / lesson: <-- Phase 1 · Step 3: Node.js with pnpm --> - File / URL: [<!-- [e.g. phases/04-computer-vision/06-object-detection-yolo/code/main.py or aiengineeringfromscratch.com/lesson.html?path=... --](https://aiengineeringfromscratch.com/lesson?path=phases%2F00-setup-and-tooling%2F01-dev-environment&learningPath=software-engineering-fundamentals#step-2-python-with-uv) -->](https://aiengineeringfromscratch.com/lesson?path=phases%2F00-setup-and-tooling%2F01-dev-environment&learningPath=software-engineering-fundamentals#step-2-python-with-uv)  ## What's wrong  Unable to install Node.js with pnpm, because the unzip was not installed   ## Reproduce 1. 2. 3.  ## Environment  - OS: Windows - Python / Node / other runtime version: Node.js - How you ran it (local, Colab, Docker, etc.): sudo apt install unzip -y (first run this)  ## Screenshot or logs  <img width="1210" height="557" alt="Image" src="https://github.com/user-attachments/assets/c7788121-5f40-4202-a364-969d60f92765" /> 
  **Post-Mortem & Fix Analysis**:
  > Looks like the issue is with the missing unzip utility blocking Node.js installation. I'd check if the unzip package is installed and properly configured in the environment setup. 
  > Fixed in #477 and live. unzip is now on the Step 1 apt line and Step 3 explains why the fnm installer stops without it. Thanks for the report.

- **Issue #440** (2026-08-30): **[bug] Hash and justify alignment issue**
  *Symptoms*: ## Where  - Phase / lesson: <!-- e.g. Phase 4 · 06-object-detection-yolo --> - File / URL: <!-- e.g. phases/04-computer-vision/06-object-detection-yolo/code/main.py or aiengineeringfromscratch.com/lesson.html?path=... -->  ## What's wrong  many sentence take break in middle of words with hash like in the picture instructions become in then we move on to the next line ,replaces become re this issue is across every text block and annoyingly obsturcts reading and understanding no normal course text even this github text box have this issue if you could try to fix it for course as well .  <img width="1280" height="800" alt="Image" src="https://github.com/user-attachments/assets/abd4e3f5-d576-47d9-95cf-5f6828589ad0" />  <img width="1280" height="800" alt="Image" src="https://github.com/user-attachments/assets/e578fe8a-3030-4220-9ed0-33364e34046d" />  ## Reproduce  1. 2. 3.  ## Environment  - OS: - Python / Node / other runtime version: - How you ran it (local, Colab, Docker, etc.):  ## Screenshot or logs  <!-- Drop a screenshot or paste the traceback if you have one. --> 

- **Issue #433** (2026-09-24): **[bug]**
  *Symptoms*: ## Where  - Phase / lesson: <!-- e.g. Phase 4 · 06-object-detection-yolo --> - File / URL: https://aiengineeringfromscratch.com/lesson.html?path=phases/02-ml-fundamentals/15-time-series  ## What's wrong  the colours of text font is not readable in dark mode of figures with highlighted backgrounds  <img width="726" height="632" alt="Image" src="https://github.com/user-attachments/assets/10cfdca3-57e9-4baa-8488-fdea0b319d5f" />  ## Environment  - OS: - Python / Node / other runtime version: - How you ran it (local, Colab, Docker, etc.):   
  **Post-Mortem & Fix Analysis**:
  > I'll fix it @rohitg00 
  > Fixed in #477 and live. The dark-mode fill remap only matched 6-digit hex, so diagrams using shorthand like fill:#dfd kept a pastel fill under light text. Shorthand is now expanded and remapped; the time-series diagrams render with dark fills in dark mode. Thanks for the screenshot.

- **Issue #407** (2026-08-23): **[bug]**
  *Symptoms*: ## Where  - Phase / lesson: all of them - File / URL: https://aiengineeringfromscratch.com/lesson.html?path=phases/02-ml-fundamentals/03-logistic-regression  ## What's wrong: i can not hear the audio from the website  When I click on the audio button to hear what is written, there is no sound.  

- **Issue #406** (2026-08-10): **[bug]**
  *Symptoms*: ## Where  - Phase / lesson: <!-- e.g. Phase 4 · 06-object-detection-yolo --> - File / URL: <!-- e.g. phases/04-computer-vision/06-object-detection-yolo/code/main.py or aiengineeringfromscratch.com/lesson.html?path=... -->  ## What's wrong  <!-- One-paragraph description. What did you expect vs. what you saw. -->  ## Reproduce  1. 2. 3.  ## Environment  - OS: - Python / Node / other runtime version: - How you ran it (local, Colab, Docker, etc.):  ## Screenshot or logs  <!-- Drop a screenshot or paste the traceback if you have one. --> 
  **Post-Mortem & Fix Analysis**:
  > sorry, I misclick the create button, I will close it.

- **Issue #405** (2026-08-23): **Cache-friendly layout is wrong in phase-11 15.prompt caching**
  *Symptoms*: ## Where  - Phase / lesson: Phase 11 · 15-llm-engineering - File / URL: https://aiengineeringfromscratch.com/lesson.html?path=phases/11-llm-engineering/15-prompt-caching#the-cache-friendly-layout ## What's wrong  There is last line in concept section which means caching is strictly prefix only if even one prefix token different then after the violate token everything not gone cache ``` The invariant. All three cache prefixes only. If any token differs between requests, everything after the first differing token is a miss. Put the stable parts at the top, the variable parts at the bottom. ```  So section: The cache friendly layout  why we have retrieved documents above from conversation history, if we get different documents from retrieval then conversation history also not gone cache! which must be cache ``` [retrieved documents]    <-- cache if reused, else don't [conversation history]   <-- cache up to last turn ```  ## Screenshot or logs  <img width="1917" height="871" alt="Image" src="https://github.com/user-attachments/assets/ad1f6242-a3c8-4b97-a5d5-2b1ab9a14737" /> 
  **Post-Mortem & Fix Analysis**:
  > @rohitg00 can you check this? this is quick fix!

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

### Incident Patch 1: `5b5ab48c` (2026-10-05)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-10-05T06:29:15.567Z
+// Last built: 2026-10-05T13:09:08.336Z
 
 const ROADMAP_PREREQS = {
   "0": [],
```

---

### Incident Patch 2: `f6dbae74` (2026-10-05)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-10-05T06:19:07.668Z
+// Last built: 2026-10-05T06:29:15.567Z
 
 const ROADMAP_PREREQS = {
   "0": [],
```

---

### Incident Patch 3: `4587dbbe` (2026-10-05)
**Commit Message**: fix(readme): keep sponsor banners side by side on desktop (#533)

**File**: `README.md` (modified, +2/-2)
```diff
@@ -34,8 +34,8 @@
 ### Sponsors
 
 <p align="center">
-  <a href="https://serpapi.com/ai-engineering-from-scratch"><img src="assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. Web Search API for your AI apps. Available in Markdown and JSON for any integration." width="440"></a>
-  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><img src="assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></a>
+  <a href="https://serpapi.com/ai-engineering-from-scratch"><picture><source media="(min-width: 768px)" srcset="assets/sponsors/serpapi-banner-compact.png" width="48%"><img src="assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. Web Search API for your AI apps. Available in Markdown and JSON for any integration." width="440"></picture></a>
+  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><picture><source media="(min-width: 768px)" srcset="assets/sponsors/nitrostack-banner.png" width="48%"><img src="assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></picture></a>
 </p>
 
 <p align="center">
```

**File**: `i18n/ar/README.md` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@
 ### الرعاة
 
 <p align="center">
-  <a href="https://serpapi.com/ai-engineering-from-scratch"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. واجهة API للبحث على الويب لتطبيقات الذكاء الاصطناعي، متاحة بصيغتي Markdown وJSON لأي تكامل." width="440"></a>
-  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></a>
+  <a href="https://serpapi.com/ai-engineering-from-scratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/serpapi-banner-compact.png" width="48%"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. واجهة API للبحث على الويب لتطبيقات الذكاء الاصطناعي، متاحة بصيغتي Markdown وJSON لأي تكامل." width="440"></picture></a>
+  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/nitrostack-banner.png" width="48%"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></picture></a>
 </p>
 
 <p align="center">
```

**File**: `i18n/de/README.md` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@
 ### Sponsoren
 
 <p align="center">
-  <a href="https://serpapi.com/ai-engineering-from-scratch"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. Websuch-API für deine KI-Anwendungen. Für jede Integration in Markdown und JSON verfügbar." width="440"></a>
-  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></a>
+  <a href="https://serpapi.com/ai-engineering-from-scratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/serpapi-banner-compact.png" width="48%"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. Websuch-API für deine KI-Anwendungen. Für jede Integration in Markdown und JSON verfügbar." width="440"></picture></a>
+  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/nitrostack-banner.png" width="48%"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></picture></a>
 </p>
 
 <p align="center">
```

**File**: `i18n/es/README.md` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@
 ### Patrocinadores
 
 <p align="center">
-  <a href="https://serpapi.com/ai-engineering-from-scratch"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. API de búsqueda web para tus aplicaciones de IA. Disponible en Markdown y JSON para cualquier integración." width="440"></a>
-  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></a>
+  <a href="https://serpapi.com/ai-engineering-from-scratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/serpapi-banner-compact.png" width="48%"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. API de búsqueda web para tus aplicaciones de IA. Disponible en Markdown y JSON para cualquier integración." width="440"></picture></a>
+  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/nitrostack-banner.png" width="48%"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></picture></a>
 </p>
 
 <p align="center">
```

**File**: `i18n/fr/README.md` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@
 ### Partenaires
 
 <p align="center">
-  <a href="https://serpapi.com/ai-engineering-from-scratch"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. API de recherche Web pour vos applications d’IA. Disponible en Markdown et JSON pour toute intégration." width="440"></a>
-  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></a>
+  <a href="https://serpapi.com/ai-engineering-from-scratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/serpapi-banner-compact.png" width="48%"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. API de recherche Web pour vos applications d’IA. Disponible en Markdown et JSON pour toute intégration." width="440"></picture></a>
+  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/nitrostack-banner.png" width="48%"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></picture></a>
 </p>
 
 <p align="center">
```

**File**: `i18n/hi/README.md` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@
 ### प्रायोजक
 
 <p align="center">
-  <a href="https://serpapi.com/ai-engineering-from-scratch"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi। आपके AI ऐप्स के लिए वेब खोज API। किसी भी एकीकरण के लिए Markdown और JSON में उपलब्ध।" width="440"></a>
-  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></a>
+  <a href="https://serpapi.com/ai-engineering-from-scratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/serpapi-banner-compact.png" width="48%"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi। आपके AI ऐप्स के लिए वेब खोज API। किसी भी एकीकरण के लिए Markdown और JSON में उपलब्ध।" width="440"></picture></a>
+  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/nitrostack-banner.png" width="48%"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></picture></a>
 </p>
 
 <p align="center">
```

**File**: `i18n/it/README.md` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@
 ### Sponsor
 
 <p align="center">
-  <a href="https://serpapi.com/ai-engineering-from-scratch"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. API di ricerca Web per le tue applicazioni di IA. Disponibile in Markdown e JSON per qualsiasi integrazione." width="440"></a>
-  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></a>
+  <a href="https://serpapi.com/ai-engineering-from-scratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/serpapi-banner-compact.png" width="48%"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi. API di ricerca Web per le tue applicazioni di IA. Disponibile in Markdown e JSON per qualsiasi integrazione." width="440"></picture></a>
+  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/nitrostack-banner.png" width="48%"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></picture></a>
 </p>
 
 <p align="center">
```

**File**: `i18n/ja/README.md` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@
 ### スポンサー
 
 <p align="center">
-  <a href="https://serpapi.com/ai-engineering-from-scratch"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi。AIアプリ向けのWeb検索API。あらゆる連携に使えるMarkdown形式とJSON形式に対応しています。" width="440"></a>
-  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></a>
+  <a href="https://serpapi.com/ai-engineering-from-scratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/serpapi-banner-compact.png" width="48%"><img src="../../assets/sponsors/serpapi-banner-compact.png" alt="SerpApi。AIアプリ向けのWeb検索API。あらゆる連携に使えるMarkdown形式とJSON形式に対応しています。" width="440"></picture></a>
+  <a href="https://nitrostack.ai/referral/aiengineeringfromscratch"><picture><source media="(min-width: 768px)" srcset="../../assets/sponsors/nitrostack-banner.png" width="48%"><img src="../../assets/sponsors/nitrostack-banner.png" alt="NitroStack. Build Production Ready MCP Apps with NitroStack. An end-to-end development platform for building, testing, debugging, and deploying production-ready MCP servers and applications. Click to know more." width="440"></picture></a>
 </p>
 
 <p align="center">
```

---

### Incident Patch 4: `a49c3f58` (2026-10-05)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-10-04T12:21:22.094Z
+// Last built: 2026-10-05T06:19:07.668Z
 
 const ROADMAP_PREREQS = {
   "0": [],
```

---

### Incident Patch 5: `c02ca08d` (2026-10-04)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-10-02T05:37:22.647Z
+// Last built: 2026-10-04T12:21:22.094Z
 
 const ROADMAP_PREREQS = {
   "0": [],
```

---

### Incident Patch 6: `3be078b3` (2026-10-02)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-09-29T18:38:16.237Z
+// Last built: 2026-10-02T05:37:22.647Z
 
 const ROADMAP_PREREQS = {
   "0": [],
```

---

### Incident Patch 7: `1bafaa88` (2026-09-29)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-09-29T16:09:22.520Z
+// Last built: 2026-09-29T18:38:16.237Z
 
 const ROADMAP_PREREQS = {
   "0": [],
```

---

### Incident Patch 8: `29c480a6` (2026-09-29)
**Commit Message**: fix(site): refresh cached assets and align project commands (#513)

* fix(site): revalidate pages and version deployed assets

* fix(projects): align setup cards and add copy feedback

* fix(site): keep desktop navigation compact and controls usable

**File**: `.github/workflows/curriculum.yml` (modified, +4/-0)
```diff
@@ -120,6 +120,10 @@ jobs:
         run: python3 scripts/test_skill_artifact_bundles.py
       - name: skill artifact bundles render as one lesson output
         run: node --test site/test_build_artifacts.js
+      - name: returning visitors receive updated site assets
+        run: node --test site/test_asset_cache.js
+      - name: command copying preserves keyboard focus
+        run: node --test site/test_project_copy.js
       - name: build the static site
         run: node site/build.js
       - name: dynamic lesson and certification routes preserve their public contracts
```

**File**: `api/certification.js` (modified, +2/-2)
```diff
@@ -211,7 +211,7 @@ function send(res, method, status, body, cacheControl) {
 
 function sendRedirect(res, method, trackId) {
   res.setHeader('Location', `/certification?id=${encodeURIComponent(trackId)}`);
-  send(res, method, 308, '', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+  send(res, method, 308, '', 'public, max-age=0, s-maxage=86400, must-revalidate');
 }
 
 function createHandler(options) {
@@ -251,7 +251,7 @@ function createHandler(options) {
       }
       let html = replaceMarkedRegion(template, SEO_START, SEO_END, certificationHead(entry, trackId));
       html = replaceMarkedRegion(html, FALLBACK_START, FALLBACK_END, certificationFallback(entry, trackId));
-      send(res, method, 200, html, 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+      send(res, method, 200, html, 'public, max-age=0, s-maxage=86400, must-revalidate');
     } catch (_) {
       send(res, method, 500, errorPage('Certification page unavailable', 'The certification page could not be assembled. Continue from the certification index while this page is restored.'), 'no-store');
     }
```

**File**: `api/lesson.js` (modified, +3/-3)
```diff
@@ -355,7 +355,7 @@ function normalizedLessonLocation(req, lessonPath, entry, assets) {
 
 function sendRedirect(res, method, location) {
   res.setHeader('Location', location);
-  send(res, method, 308, '', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+  send(res, method, 308, '', 'public, max-age=0, s-maxage=86400, must-revalidate');
 }
 
 function createHandler(options) {
@@ -391,7 +391,7 @@ function createHandler(options) {
       const normalized = normalizedLessonLocation(req, lessonPath, entry, assets);
       if (normalized.needsRedirect) {
         res.setHeader('Location', normalized.location);
-        send(res, method, 308, '', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+        send(res, method, 308, '', 'public, max-age=0, s-maxage=86400, must-revalidate');
         return;
       }
       const contextParams = {};
@@ -401,7 +401,7 @@ function createHandler(options) {
       const heading = lessonHeading(entry, manifest);
       let html = replaceMarkedRegion(template, SEO_START, SEO_END, lessonHead(entry, lessonPath, heading));
       html = replaceMarkedRegion(html, FALLBACK_START, FALLBACK_END, lessonFallback(entry, lessonPath, contextParams, heading));
-      send(res, method, 200, html, 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+      send(res, method, 200, html, 'public, max-age=0, s-maxage=86400, must-revalidate');
     } catch (_) {
       send(res, method, 500, errorPage('Lesson page unavailable', 'The lesson page could not be assembled. Continue from the course catalog while this page is restored.'), 'no-store');
     }
```

**File**: `api/markdown.js` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ module.exports = (req, res) => {
   const markdownQ = qualityFor(accepted, 'text/markdown');
   const htmlQ = qualityFor(accepted, 'text/html');
   res.setHeader('Vary', 'Accept, Accept-Encoding');
-  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, must-revalidate');
   res.setHeader('X-API-Version', '1');
 
   if (method !== 'GET' && method !== 'HEAD') {
```

**File**: `site/header.js` (modified, +5/-31)
```diff
@@ -8,7 +8,6 @@
   var REPO = 'rohitg00/ai-engineering-from-scratch';
   var CACHE_KEY = 'gh:stars:' + REPO;
   var CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
-  var COMPACT_HEADER_QUERY = '(max-width: 1400px)';
   var NARROW_HEADER_QUERY = '(max-width: 820px)';
   var NARRATION_VERSION = '20260829a';
   var UI_I18N_VERSION = '20260923a';
@@ -306,17 +305,10 @@
     tools.setAttribute('aria-label', 'Site tools');
     nav.appendChild(tools);
 
-    var toolAnchor = document.createComment('header-tools');
     var directChildren = Array.prototype.slice.call(inner.children);
     var search = directChildren.find(function (child) {
       return child.classList && child.classList.contains('search-toggle');
     });
-    var firstTool = directChildren.find(function (child) {
-      return child !== logo && child !== nav && child !== toggle && child !== priorityNav && child !== github && child !== search;
-    });
-    inner.insertBefore(toolAnchor, search ? search.nextSibling : (firstTool || null));
-
-    var compact = window.matchMedia ? window.matchMedia(COMPACT_HEADER_QUERY) : null;
     var narrow = window.matchMedia ? window.matchMedia(NARROW_HEADER_QUERY) : null;
     var open = false;
 
@@ -340,10 +332,6 @@
       });
     }
 
-    function restoreDesktopTools() {
-      while (tools.firstChild) inner.insertBefore(tools.firstChild, toolAnchor);
-    }
-
     function movePriorityLinksOut() {
       for (var i = 0; i < priorityEntries.length; i++) {
         priorityNav.appendChild(priorityEntries[i].link);
@@ -364,27 +352,18 @@
       header.classList.toggle('header-nav-open', open);
       toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
       toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
-      if (compact && compact.matches) nav.hidden = !open;
-      else nav.hidden = false;
+      nav.hidden = !open;
       if (restoreFocus && !open) toggle.focus();
     }
 
     function syncLayout() {
-      var isCompact = compact ? compact.matches : false;
       var isNarrow = narrow ? narrow.matches : false;
       var menuHadFocus = nav.contains(document.activeElement);
       var priorityHadFocus = priorityNav.contains(document.activeElement);
-      if (isCompact) {
-        if (isNarrow) restorePriorityLinks();
-        else movePriorityLinksOut();
-        moveToolsIntoMenu();
-        setOpen(false, menuHadFocus || (isNarrow && priorityHadFocus));
-      } else {
-        restorePriorityLinks();
-        setOpen(false, false);
-        restoreDesktopTools();
-        nav.hidden = false;
-      }
+      if (isNarrow) restorePriorityLinks();
+      else movePriorityLinksOut();
+      moveToolsIntoMenu();
+      setOpen(false, menuHadFocus || (isNarrow && priorityHadFocus));
     }
 
     toggle.addEventListener('click', function () { setOpen(!open, false); });
@@ -408,18 +387,13 @@
       }
     });
 
-    if (compact) {
-      if (typeof compact.addEventListener === 'function') compact.addEventListener('change', syncLayout);
-      else if (typeof compact.addListener === 'function') compact.addListener(syncLayout);
-    }
     if (narrow) {
       if (typeof narrow.addEventListener === 'function') narrow.addEventListener('change', syncLayout);
       else if (typeof narrow.addListener === 'function') narrow.addListener(syncLayout);
     }
 
     if (typeof MutationObserver === 'function') {
       var observer = new MutationObserver(function (mutations) {
-        if (!compact || !compact.matches) return;
         for (var i = 0; i < mutations.length; i++) {
           var added = mutations[i].addedNodes;
           for (var j = 0; j < added.length; j++) {
```

**File**: `site/project.html` (modified, +2/-0)
```diff
@@ -47,13 +47,15 @@
 
   <footer class="site-footer"><div class="container footer-inner"><p>AI Engineering from Scratch · open source · free forever.</p><div class="footer-links"><a href="projects.html">All projects</a><a href="catalog.html">Course catalog</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a><a href="sponsors.html">Sponsor us</a></div></div></footer>
 
+  <script src="data.js?v=20260821c"></script>
   <script src="projects-data.js?v=20260929b"></script>
   <script src="build-meta.js"></script>
   <script src="content-source.js?v=20260821a"></script>
   <script src="lesson-figures.js?v=843871fd2942"></script>
   <script src="figures/projects/runtime.js?v=20260929c"></script>
   <script src="project-certificates.js?v=20260928b"></script>
   <script src="header.js?v=20260927a" defer></script>
+  <script src="cmdpalette.js?v=20260821a" defer></script>
   <script src="projects.js?v=20260929c" defer></script>
 </body>
 </html>
```

**File**: `site/projects.css` (modified, +88/-12)
```diff
@@ -172,33 +172,41 @@
 }
 
 .pj-steps li {
-  display: flex;
-  gap: 14px;
+  display: grid;
+  grid-template-rows: subgrid;
+  grid-row: span 3;
+  row-gap: 18px;
   min-width: 0;
-  padding: 20px;
+  padding: 22px;
   border: 1px solid var(--rule-soft);
   background: var(--bg-surface);
 }
 
+.pj-step-head {
+  display: flex;
+  align-items: center;
+  gap: 12px;
+  min-width: 0;
+}
+
 .pj-steps h3 {
-  margin: 0 0 6px;
+  margin: 0;
   font-size: 1.5rem;
+  line-height: 1.15;
 }
 
 .pj-steps p {
-  margin: 0 0 12px;
+  margin: 0;
   color: var(--ink-soft);
 }
 
-.pj-steps > li > div {
-  min-width: 0;
-}
-
 .pj-step-n {
   flex: none;
-  font-family: var(--font-display);
-  font-size: 2.4rem;
+  font-family: var(--font-mono);
+  font-size: 0.8rem;
   line-height: 1;
+  padding: 8px 6px;
+  border: 1px solid var(--blueprint);
   color: var(--blueprint);
 }
 
@@ -228,11 +236,70 @@
   margin: 8px 0;
 }
 
-.pj-cmd-wrap .pj-cmd,
 .pj-code.is-command pre {
   padding-right: 72px;
 }
 
+.pj-cmd-wrap {
+  min-width: 0;
+  border: 1px solid var(--rule-soft);
+  background: var(--code-bg);
+}
+
+.pj-cmd-toolbar {
+  display: flex;
+  align-items: center;
+  justify-content: space-between;
+  gap: 8px;
+  padding: 6px 8px 6px 14px;
+  border-bottom: 1px solid var(--rule-soft);
+  font: 0.65rem var(--font-mono);
+  text-transform: uppercase;
+  letter-spacing: 0.08em;
+  color: var(--ink-mute);
+}
+
+.pj-cmd-wrap .pj-cmd {
+  border: 0;
+  white-space: pre-wrap;
+  overflow-wrap: anywhere;
+}
+
+.pj-cmd-wrap .pj-cmd code {
+  white-space: inherit;
+}
+
+.pj-steps .pj-cmd-wrap {
+  margin: 0;
+}
+
+.pj-cmd-toolbar .pj-copy {
+  position: static;
+  min-width: 68px;
+  min-height: 34px;
+}
+
+.pj-copy-status {
+  display: block;
+  margin: 0;
+  padding: 8px 14px;
+  font: 0.76rem/1.4 var(--font-body);
+  color: var(--ink-soft);
+}
+
+.pj-copy-status:empty {
+  display: none;
+}
+
+.pj-copy-status[data-success] {
+  position: absolute;
+  width: 1px;
+  height: 1px;
+  padding: 0;
+  overflow: hidden;
+  clip-path: inset(50%);
+}
+
 .pj-copy {
   position: absolute;
   top: 7px;
@@ -245,6 +312,11 @@
   cursor: pointer;
 }
 
+.pj-copy:focus-visible {
+  outline: 2px solid var(--blueprint);
+  outline-offset: 3px;
+}
+
 .pj-copy:hover {
   color: var(--blueprint);
   border-color: var(--blueprint);
@@ -828,6 +900,10 @@
   .pj-action {
     width: 100%;
   }
+
+  .pj-cmd-toolbar .pj-copy {
+    min-height: 44px;
+  }
 }
 
 @media (prefers-reduced-motion: reduce) {
```

**File**: `site/projects.html` (modified, +17/-3)
```diff
@@ -49,9 +49,21 @@ <h1 id="pjTitle">Build things people actually use.</h1>
     <section class="pj-container pj-section" aria-labelledby="howTitle">
       <div class="pj-section-heading"><div><div class="pj-eyebrow">HOW IT WORKS</div><h2 id="howTitle">Three commands, one project</h2></div><p>Choose Python, Rust, TypeScript, or Go for the job. Core tests run offline; optional framework labs list their dependencies.</p></div>
       <ol class="pj-steps">
-        <li><span class="pj-step-n">1</span><div><h3>Copy the starters</h3><p>Stub files with the exact signatures you will fill in.</p><pre class="pj-cmd"><code>python3 scripts/project_test.py research-report-agent --init my-report-agent</code></pre></div></li>
-        <li><span class="pj-step-n">2</span><div><h3>Build one stage, run the grader</h3><p>The grader runs every stage up to yours, so new work never breaks old work.</p><pre class="pj-cmd"><code>python3 scripts/project_test.py research-report-agent --stage 1 --path my-report-agent</code></pre></div></li>
-        <li><span class="pj-step-n">3</span><div><h3>Or learn with the tutor</h3><p>One stage per session. Predict, build, run, reflect. Hints, not answers.</p><pre class="pj-cmd"><code>/build-project research-report-agent</code></pre></div></li>
+        <li>
+          <div class="pj-step-head"><span class="pj-step-n" aria-hidden="true">01</span><h3>Create your workspace</h3></div>
+          <p>Copy the starter files. Each stub gives you the exact signature to implement.</p>
+          <pre class="pj-cmd" data-copy-label="Copy starter command"><code>python3 scripts/project_test.py research-report-agent --init my-report-agent</code></pre>
+        </li>
+        <li>
+          <div class="pj-step-head"><span class="pj-step-n" aria-hidden="true">02</span><h3>Run the grader</h3></div>
+          <p>Build one stage at a time. The grader checks your work and every earlier stage.</p>
+          <pre class="pj-cmd" data-copy-label="Copy grader command"><code>python3 scripts/project_test.py research-report-agent --stage 1 --path my-report-agent</code></pre>
+        </li>
+        <li>
+          <div class="pj-step-head"><span class="pj-step-n" aria-hidden="true">03</span><h3>Learn with the tutor</h3></div>
+          <p>Want guidance? In Claude Code, work through each stage with hints and feedback.</p>
+          <pre class="pj-cmd" data-command-label="Claude Code" data-copy-label="Copy tutor command"><code>/build-project research-report-agent</code></pre>
+        </li>
       </ol>
     </section>
 
@@ -90,9 +102,11 @@ <h2 id="submitTitle">Built something useful? Add it to the ladder.</h2>
 
   <footer class="site-footer"><div class="container footer-inner"><p>AI Engineering from Scratch · open source · free forever.</p><div class="footer-links"><a href="index.html">Home</a><a href="catalog.html">Course catalog</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a><a href="sponsors.html">Sponsor us</a></div></div></footer>
 
+  <script src="data.js?v=20260821c"></script>
   <script src="projects-data.js?v=20260929b"></script>
   <script src="content-source.js?v=20260821a"></script>
   <script src="header.js?v=20260927a" defer></script>
+  <script src="cmdpalette.js?v=20260821a" defer></script>
   <script src="projects.js?v=20260929c" defer></script>
 </body>
 </html>
```

---

### Incident Patch 9: `61bc244c` (2026-09-29)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-09-29T16:04:41.578Z
+// Last built: 2026-09-29T16:09:22.520Z
 
 const ROADMAP_PREREQS = {
   "0": [],
```

---

### Incident Patch 10: `3ecf630b` (2026-09-29)
**Commit Message**: feat(projects): add 48 builds and a 52-project roadmap (#497)

* feat(projects): workflow-hooks stage 1

* feat(projects): workflow-hooks stage 2

* feat(projects): workflow-hooks stage 3

* feat(projects): workflow-hooks stage 4

* fix(projects): preserve sponsor navigation in project footer

* feat(projects): agent-budget-planner stage 1

* feat(projects): agent-budget-planner stage 2

* feat(projects): agent-budget-planner stage 3

* feat(projects): agent-budget-planner stage 4

* feat(projects): agent-trace-debugger stage 1

* feat(projects): agent-trace-debugger stage 2

* feat(projects): agent-trace-debugger stage 3

* feat(projects): agent-trace-debugger stage 4

* feat(projects): browser-agent stage 1

* feat(projects): browser-agent stage 2

* feat(projects): browser-agent stage 3

* feat(projects): browser-agent stage 4

* feat(projects): calendar-focus-planner stage 1

* feat(projects): calendar-focus-planner stage 2

* feat(projects): calendar-focus-planner stage 3

* feat(projects): calendar-focus-planner stage 4

* feat(projects): changelog-writer-from-git stage 1

* feat(projects): changelog-writer-from-git stage 2

* feat(projects): changelog-writer-from-git stage 3

**File**: `.claude/skills/build-project/SKILL.md` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+---
+name: build-project
+version: 1.0.0
+description: >
+  Hands-on project tutor for the AI Engineering from Scratch Projects section.
+  Guides a learner through one stage of a real project per session: read the
+  stage lesson, predict, write the code, run the stage grader, reflect, and
+  record progress in PROJECTS-LEARNING.md. Gives hints, never full solutions.
+  Trigger phrases: "build a project", "next project stage", "continue my
+  project", "start the research report agent".
+tags: [tutor, projects, hands-on, ai-engineering]
+---
+
+# Build Project
+
+You are the project tutor for the **AI Engineering from Scratch** Projects
+section. One invocation teaches one stage of one project. The learner writes
+the code. You read, ask, hint, run the grader with them, and record progress.
+
+## Host invocation contract
+
+| Host | Start or resume |
+|---|---|
+| Claude Code | `/build-project` or `/build-project <project-id>` |
+| Codex | `build-project`, or choose it from `/skills` |
+| Other compatible hosts | `Use build-project to start or resume my project.` |
+
+Never present one host's syntax as universal.
+
+## Content sources
+
+Every project lives in `projects/<project-id>/` and is described by
+`projects/<project-id>/project.json`: its level, stages in order, prerequisite
+lessons, language choices, and requirements. For each stage, read:
+
+- `projects/<id>/stages/<stage-id>/docs/en.md`: the lesson for the stage
+- `projects/<id>/stages/<stage-id>/starter/`: the stubs the learner fills in
+- `projects/<id>/stages/<stage-id>/tests/`: what the grader checks
+
+Prefer local files. If the repository is not cloned, fetch from
+`https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/<path>`
+and teach in conceptual mode (see below). The project list is the set of
+folders under `projects/` that contain a `project.json`, excluding `_template`.
+Planned projects in `projects/roadmap.json` are not buildable yet.
+
+Never open `projects/<id>/solution/` or `projects/<id>/heldout/` to show the
+learner code or answers. You may read the solution yourself only to diagnose
+why a correct-looking attempt fails, and then give a hint, not the code.
+
+## Step 0: find or create progress
+
+Use `PROJECTS-LEARNING.md` in the learner's working directory. It can hold
+several projects. Never overwrite existing notes.
+
+If it does not exist, create it:
+
+```markdown
+# My Projects
+<!-- Managed by the build-project tutor. -->
+
+## research-report-agent
+- Started: <YYYY-MM-DD>
+- Workspace: <absolute path to the learner's project folder>
+- Mode: Executable or Conceptual
+- Current stage: 1 of <N>
+
+| Stage | Status | Grader result | Date | Note |
+|---|---|---|---|---|
+| 01-<slug> | Next | | | |
+```
+
+If the learner did not name a project, list the ready projects with level and
+one-line tagline and ask which one. Suggest the lowest level whose
+prerequisites they have. Resume at the first row marked `Next` or
+`In progress`.
+
+## Step 1: set up the workspace (first stage only)
+
+Confirm `python3 --version` works. Ask where the learner wants the workspace,
+defaulting to `my-<project-id>` next to the repo. Then run:
+
+```bash
+python3 scripts/project_test.py <project-id> --init <workspace>
+```
+
+Record the absolute workspace path. If Python or the repo is missing, switch
+to conceptual mode: teach from the lesson, have the learner hand-trace the
+examples, and mark grader results `Pending`, never `Pass`.
+
+## Step 2: teach the stage
+
+Work through the stage lesson in order. Keep each message short.
+
+1. **Frame.** In two or three sentences: what this stage adds, and where real
+   systems use it (the lesson names them). Show where it sits in the pipeline.
+2. **Predict.** Before any code, ask one prediction question drawn from the
+   lesson, for example what a function should return for a given input, or
+   what breaks if a step is skipped. Wait for the answer.
+3. **Build.** Point to the starter file and the exact signatures from the
+   lesson's "Your task" section. The learner writes the code in their
+   workspace. Do not write it for them.
+4. **Run.** Run the grader for this stage with them:
+
+   ```bash
+   python3 scripts/project_test.py <project-id> --stage <N> --path <workspace>
+   ```
+
+   The grader runs stages 1 to N, so a failure in an earlier stage means new
+   code broke old behavior. Say that plainly when it happens.
+5. **Debug with hints.** On failure, read the failing test name and message,
+   then give the smallest useful hint: first a question, then the concept,
+   then the specific line or edge case. Three hint levels, never the full
+   solution, unless the learner explicitly asks to see a reference after at
+   least two honest attempts. Even then, show only the one function they are
+   stuck on and say so in the notes.
+6. **Reflect.** When the stage passes, ask the "Check yourself" questions
+   from the lesson. One at a time. 
```

**File**: `.github/workflows/projects.yml` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+name: Project contracts
+
+on:
+  pull_request:
+    paths:
+      - 'projects/**'
+      - 'scripts/project_test.py'
+      - 'site/*project*'
+      - 'site/figures/projects/**'
+      - '.github/workflows/projects.yml'
+  push:
+    branches: [main]
+    paths:
+      - 'projects/**'
+      - 'scripts/project_test.py'
+      - 'site/*project*'
+      - 'site/figures/projects/**'
+      - '.github/workflows/projects.yml'
+
+permissions:
+  contents: read
+
+jobs:
+  offline-projects:
+    runs-on: ubuntu-latest
+    timeout-minutes: 20
+    steps:
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
+        with:
+          persist-credentials: false
+      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065
+        with:
+          python-version: '3.12'
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '24'
+      - uses: actions/setup-go@v5
+        with:
+          go-version: '1.23'
+          cache: false
+      - name: Verify Rust toolchain
+        run: rustc --version
+      - name: Validate site, grader and interactive figure contracts
+        run: >-
+          node --test site/test_projects_data.js site/test_project_certificates.js
+          site/test_project_figure_runtime.js site/test_dataset_project_figures.js
+          site/test_budget_project_figures.js
+      - name: Validate complete project manifests and media
+        run: node site/build-projects.js --strict
+      - name: Run all offline reference stages
+        run: python3 scripts/project_test.py --all --solution --strict --report /tmp/project-results.json
```

**File**: `.gitignore` (modified, +5/-0)
```diff
@@ -90,3 +90,8 @@ i18n/*/.cache/
 i18n/*/.translate-cache.json
 i18n/*/ui.json
 site/langs.js
+
+!.claude/skills/build-project/
+!.claude/skills/build-project/**
+site/projects-data.js
+site/project-content/
```

**File**: `projects/AUTHORING.md` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+# Project authoring contract
+
+Each project teaches a useful artifact through four to eight incremental stages. Each stage adds a distinct behavior, explains a concrete example, and tests the learner's implementation. Reference solutions and demonstrations run offline with standard libraries. A policy simulator must identify itself as a simulator; never claim it provides operating-system isolation.
+
+## Planned projects
+
+Keep unbuilt ideas in `projects/roadmap.json` under `planned`. Give each a unique `id`, `title`, `level`, `languages`, `source`, `tagline`, `summary`, concrete `output`, four proposed `milestones`, and `prerequisiteProjects` IDs. Add `distinctFrom` and `firstDemo` to explain its independent teaching focus. A starter plan may have no project prerequisite. Planned prerequisite links must resolve and must not form cycles.
+
+Keep the readable briefs in [ROADMAP.md](ROADMAP.md) aligned with that metadata. Use `status: "planned"`; do not create empty reference implementations or completion claims. When a real project satisfies the ready contract, its ready manifest replaces the planned card in the built catalog.
+
+## Files and metadata
+
+`projects/<id>/project.json` owns the catalog metadata. `id` matches the directory and uses lowercase words separated by hyphens. Required fields are `title`, `tagline`, `summary`, `level` (1 through 5), `hours`, `languages`, `status` (`draft` or `ready`), `source` (`core` or `community`), and a nonempty `stages` array. Stage IDs are unique. README, solution, each stage's documentation, tests, and starter files must exist before `ready` is accepted. Draft projects never appear as ready.
+
+```json
+{
+  "id": "example-project",
+  "title": "Example Project",
+  "tagline": "A concrete useful artifact.",
+  "summary": "What you build and how you verify it.",
+  "level": 2,
+  "hours": 8,
+  "languages": ["Python", "TypeScript"],
+  "status": "draft",
+  "source": "community",
+  "author": {"name": "Your Name", "github": "your-handle"},
+  "demo": {"command": ["python3", "demo.py"], "cwd": "solution"},
+  "stages": [
+    {
+      "id": "01-first-stage",
+      "title": "First stage",
+      "summary": "One specific new capability.",
+      "hours": 2,
+      "difficulty": "starter",
+      "concepts": ["input validation"],
+      "language": "python",
+      "timeout": 60
+    }
+  ]
+}
+```
+
+Each stage lives at `stages/<stage-id>/`, with `docs/en.md`, `starter/`, and `tests/`. The cumulative reference implementation lives in `solution/`. Starter paths are relative to the learner's workspace. Initialization copies every regular file, including `.rs`, `.ts`, `.go`, fixtures and module files. It preserves existing files unless `--force` is explicit. Avoid repeating evolving source files in later starters: scaffolding should accumulate without overwriting the learner's work.
+
+## Grader runners
+
+Each stage declares `language`: `python`, `typescript`, `rust`, or `go`. Mixed stages use `language: "rust+python"` plus `runners: [{"language":"rust"},{"language":"python"}]`. The grader sets `PROJECT_WORKSPACE`, `PROJECT_ROOT`, and `PROJECT_STAGE` to absolute paths for every runner, and prepends the workspace to `PYTHONPATH`.
+
+- Python discovers `tests/test_*.py` with `unittest`. Import the learner's package normally.
+- TypeScript uses Node 22.18 or later, `--experimental-strip-types`, and `node --test` with `tests/*.test.ts` or `tests/*.test.mjs`. Import the learner's file using `pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, 'main.ts'))`. Use erasable TypeScript syntax.
+- Rust compiles each `tests/*.rs` separately with `rustc --edition 2021 --test`, then runs the binary. Import learner code with `include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));`, usually inside a module. No Cargo dependency is required.
+- Go copies the workspace and stage `tests/*.go` into a temporary directory and runs `go test -json ./...`. Include `go.mod` for modular workspaces; without it the runner uses `GO111MODULE=off`. Stage test paths relative to `tests/` are preserved in the temporary workspace.
+
+An explicit single runner is an argv array: `"runner": ["node", "--experimental-strip-types", "--test", "{tests}/stage.test.ts"]`. Multiple runners use `"runners": [{"language":"python","argv":["python3","-m","unittest","discover","-s","{tests}"]}]`. Supported substitutions are `{workspace}`, `{project}`, `{stage}`, and `{tests}`. Commands run without a shell. Custom runners must emit the selected language's standard test-runner summary; exit status zero with no tests is a failure.
+
+Optional `requires: ["rustc"]` lists executable prerequisites. Runner settings inherit stage `requires` and `timeout` (seconds, positive, maximum 600). Missing tools produce `skip`; normal grading can continue with exit status zero, but `--strict` makes any skip fail the command. Test-level skips always prevent completion evidence. Timeouts and failed tests fail the co
```

**File**: `projects/PLAN.md` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+# Real Projects Section Plan
+
+The Projects section connects the course's individual mechanisms to useful artifacts. It is a separate staged catalog, with the same visual language, interactive SVG figures, agent tutor workflow, and explicit verification used by the rest of the course.
+
+## Delivery contract
+
+Each ready project has four to eight ordered stages, a real reference implementation, intentionally incomplete starters, deterministic tests against the learner workspace, original explanations, a mechanism figure per stage, and recorded run/output demos. Readiness validation checks file paths, stage identity, figure registration, and media. The grader independently runs the actual language toolchains; an empty suite is never a pass.
+
+Python handles parsing, model-facing coordination, and evaluation. Rust handles bounded parsers, search loops, policy tools, and terminal interfaces. TypeScript handles typed contracts, browser artifacts, and workflow interfaces. Go handles concurrent workers, gateways, queues, and network-oriented tools. Mixed-language projects use explicit process or JSON contracts.
+
+## Five-level ladder
+
+1. Starter: one useful input/output tool and its basic contracts.
+2. Builder: a pipeline that combines several mechanisms.
+3. Engineer: state, budgets, retries, and measured outcomes.
+4. Systems: protocol boundaries, concurrency, tool policy, and process control.
+5. Frontier: reproducible comparisons, distributed evaluation, browser control, and trace diagnosis.
+
+Projects are scoped learning artifacts, not claims of production completeness. Estimates reflect the supplied stages; production hardening and live integrations are separate work.
+
+## Ready catalog
+
+| Project | Level | Languages | Stages | Estimate |
+|---|---|---|---|---|
+| [Dataset Split Auditor](dataset-split-auditor/) | 1 | Python | 4 | ~8h |
+| [JSON Schema Output Guard](json-schema-output-guard/) | 1 | TypeScript | 4 | ~8h |
+| [Prompt Regression Tester](prompt-regression-tester/) | 1 | Python | 4 | ~8h |
+| [Semantic Notes Search](semantic-notes-search/) | 1 | Python | 4 | ~8h |
+| [SKILL.md Validator and Loader](skill-validator/) | 1 | Rust | 4 | ~8h |
+| [Tiny Coding Agent](tiny-coding-agent/) | 1 | Python | 4 | ~8h |
+| [Token Counter and Cost Meter](token-counter-and-cost-meter/) | 1 | Rust | 4 | ~8h |
+| [Calendar Focus Planner](calendar-focus-planner/) | 2 | TypeScript | 4 | ~8h |
+| [Changelog Writer From Git](changelog-writer-from-git/) | 2 | Go | 4 | ~8h |
+| [CSV Question Workbench](csv-sql-question-workbench/) | 2 | Python | 4 | ~8h |
+| [Document Extraction Review Desk](document-extraction-desk/) | 2 | Python | 4 | ~8h |
+| [Document QA With Citations and LangChain](doc-qa-with-citations/) | 2 | Python | 4 | ~8h |
+| [Feedback Theme Board](feedback-theme-board/) | 2 | TypeScript | 4 | ~8h |
+| [Inbox Triage Desk](inbox-triage-desk/) | 2 | Python | 4 | ~8h |
+| [Incident Postmortem Writer](postmortem-writer/) | 2 | Go | 4 | ~8h |
+| [Local Model Evaluation Harness](local-model-eval-harness/) | 2 | Python | 4 | ~8h |
+| [Meeting Notes to Actions](meeting-notes-to-actions/) | 2 | Python | 4 | ~8h |
+| [PR Review Reporter](pr-review-reporter/) | 2 | Python, TypeScript | 4 | ~8h |
+| [Research Report Agent](research-report-agent/) | 2 | Rust, Python, TypeScript | 7 | ~20h |
+| [Retrieval Evaluation Lab](retrieval-evaluation-lab/) | 2 | Python | 4 | ~8h |
+| [Skill Router](skill-router/) | 2 | TypeScript | 4 | ~8h |
+| [Source-Grounded Study Coach](source-grounded-study-coach/) | 2 | TypeScript | 4 | ~8h |
+| [Agent Budget Planner](agent-budget-planner/) | 3 | Python | 4 | ~8h |
+| [Agent Trace Debugger](agent-trace-debugger/) | 3 | TypeScript | 4 | ~8h |
+| [Cross-Agent Skill Installer](skill-installer/) | 3 | TypeScript | 4 | ~8h |
+| [Harness Bench](harness-bench/) | 3 | Go | 4 | ~8h |
+| [LLM Gateway With Fallbacks](llm-gateway-with-fallbacks/) | 3 | Go | 4 | ~8h |
+| [Multi-Agent Code Review Panel](multi-agent-code-review-panel/) | 3 | TypeScript | 4 | ~8h |
+| [Persistent Memory Server](memory-server/) | 3 | TypeScript, Rust | 4 | ~8h |
+| [RAG Freshness Pipeline](rag-freshness-pipeline/) | 3 | Python | 4 | ~8h |
+| [Report Judge](report-judge/) | 3 | Python | 4 | ~8h |
+| [Self-Correcting Workflow Hooks](workflow-hooks/) | 3 | TypeScript | 4 | ~8h |
+| [Skill Supply-Chain Scanner](skill-scanner/) | 3 | Rust | 4 | ~8h |
+| [Support Agent With Google ADK](support-agent-with-google-adk/) | 3 | Python | 4 | ~8h |
+| [Typed Workflow Agent with Mastra](typed-workflow-agent-with-mastra/) | 3 | TypeScript | 4 | ~8h |
+| [Visual Evidence Library](visual-evidence-library/) | 3 | Python | 4 | ~8h |
+| [Voice Note Transcriber Pipeline](voice-note-transcriber-pipeline/) | 3 | Python | 4 | ~8h |
+| [Web Change Brief](web-change-brief/) | 3 | Go | 4 | ~8h |
+| [Cloud Agent With AWS Strands](cloud-agent-with-aws-strands/) | 4 | Python | 4 | ~8h |
+| [Desktop Control Backend](desktop-co
```

**File**: `projects/README.md` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+# Projects
+
+Build useful AI engineering tools from scratch, one tested stage at a time. The catalog covers 100 projects across Python, Rust, TypeScript, and Go: 48 ready to build and 52 on the [roadmap](ROADMAP.md).
+
+Each ready project includes a working reference implementation, a learner starter, cumulative stage tests, mechanism diagrams, explanations, and recorded run/output GIFs. Core tests use local fixtures and require no model credentials. Optional framework comparisons use real SDKs with deterministic fake models. Planned projects have proposed outcomes and learning milestones; their implementations and completion tests are still to come.
+
+## Start
+
+```bash
+python3 scripts/project_test.py semantic-notes-search --list
+python3 scripts/project_test.py semantic-notes-search --init my-semantic-notes-search
+python3 scripts/project_test.py semantic-notes-search --stage 1 --path my-semantic-notes-search
+```
+
+Use Python 3.12+, Node 22.18+ for TypeScript, rustc with edition 2021, and Go 1.23+. Install only the toolchains the project's language badges require. The reference solution is an instructor artifact:
+
+```bash
+python3 scripts/project_test.py research-report-agent --all --solution --strict
+python3 scripts/project_test.py --all --solution --strict --report project-results.json
+```
+
+The site is built with `node site/build-projects.js --strict`. It bundles project lessons and recordings for static hosting, so preview branches do not depend on unpublished GitHub main files.
+
+## Learn with an agent
+
+In Claude Code, use `/build-project <id>`. In Codex or another compatible host, ask it to use the `build-project` skill for the selected project. The tutor teaches one stage at a time: predict, build, test, reflect. It keeps learning notes in your own `PROJECTS-LEARNING.md`.
+
+## Completion evidence
+
+```bash
+python3 scripts/project_test.py semantic-notes-search --all --strict --path my-semantic-notes-search --report completion.json
+```
+
+Import `completion.json` on the project page and enter your name to download a printable HTML certificate. Every stage must pass with nonzero tests and no skips. Reference solutions, partial runs, and outdated manifests cannot qualify. The certificate is a local, self-attested community course record, not a proctored or vendor credential. Optional SDK verification is separate from core completion.
+
+## Ready catalog
+
+| Project | Level | Languages | Stages | Estimate |
+|---|---|---|---|---|
+| [Dataset Split Auditor](dataset-split-auditor/) | 1 | Python | 4 | ~8h |
+| [JSON Schema Output Guard](json-schema-output-guard/) | 1 | TypeScript | 4 | ~8h |
+| [Prompt Regression Tester](prompt-regression-tester/) | 1 | Python | 4 | ~8h |
+| [Semantic Notes Search](semantic-notes-search/) | 1 | Python | 4 | ~8h |
+| [SKILL.md Validator and Loader](skill-validator/) | 1 | Rust | 4 | ~8h |
+| [Tiny Coding Agent](tiny-coding-agent/) | 1 | Python | 4 | ~8h |
+| [Token Counter and Cost Meter](token-counter-and-cost-meter/) | 1 | Rust | 4 | ~8h |
+| [Calendar Focus Planner](calendar-focus-planner/) | 2 | TypeScript | 4 | ~8h |
+| [Changelog Writer From Git](changelog-writer-from-git/) | 2 | Go | 4 | ~8h |
+| [CSV Question Workbench](csv-sql-question-workbench/) | 2 | Python | 4 | ~8h |
+| [Document Extraction Review Desk](document-extraction-desk/) | 2 | Python | 4 | ~8h |
+| [Document QA With Citations and LangChain](doc-qa-with-citations/) | 2 | Python | 4 | ~8h |
+| [Feedback Theme Board](feedback-theme-board/) | 2 | TypeScript | 4 | ~8h |
+| [Inbox Triage Desk](inbox-triage-desk/) | 2 | Python | 4 | ~8h |
+| [Incident Postmortem Writer](postmortem-writer/) | 2 | Go | 4 | ~8h |
+| [Local Model Evaluation Harness](local-model-eval-harness/) | 2 | Python | 4 | ~8h |
+| [Meeting Notes to Actions](meeting-notes-to-actions/) | 2 | Python | 4 | ~8h |
+| [PR Review Reporter](pr-review-reporter/) | 2 | Python, TypeScript | 4 | ~8h |
+| [Research Report Agent](research-report-agent/) | 2 | Rust, Python, TypeScript | 7 | ~20h |
+| [Retrieval Evaluation Lab](retrieval-evaluation-lab/) | 2 | Python | 4 | ~8h |
+| [Skill Router](skill-router/) | 2 | TypeScript | 4 | ~8h |
+| [Source-Grounded Study Coach](source-grounded-study-coach/) | 2 | TypeScript | 4 | ~8h |
+| [Agent Budget Planner](agent-budget-planner/) | 3 | Python | 4 | ~8h |
+| [Agent Trace Debugger](agent-trace-debugger/) | 3 | TypeScript | 4 | ~8h |
+| [Cross-Agent Skill Installer](skill-installer/) | 3 | TypeScript | 4 | ~8h |
+| [Harness Bench](harness-bench/) | 3 | Go | 4 | ~8h |
+| [LLM Gateway With Fallbacks](llm-gateway-with-fallbacks/) | 3 | Go | 4 | ~8h |
+| [Multi-Agent Code Review Panel](multi-agent-code-review-panel/) | 3 | TypeScript | 4 | ~8h |
+| [Persistent Memory Server](memory-server/) | 3 | TypeScript, Rust | 4 | ~8h |
+| [RAG Freshness Pipeline](rag-freshness-pipeline/) | 3 | Python | 4 | ~8h |
+| [Report Judge](report-judge/) | 3 | Python | 4 | ~8h |
+| [Self-Correcting
```

**File**: `projects/ROADMAP.md` (added, +1291/-0)
```diff
@@ -0,0 +1,1291 @@
+# Project roadmap
+
+The catalog contains **100 projects: 48 ready to build and 52 planned**. The plans below describe future work; they do not have runnable stages, completion tests or certificates yet.
+
+`roadmap.json` is the catalog source of truth. These briefs give each plan a concrete deliverable, a starting path through existing projects and four proposed milestones. Milestones can expand into four to eight tested stages during implementation. No delivery dates are promised.
+
+| Level | Ready | Planned | Total |
+|---|---:|---:|---:|
+| 1. Starter | 7 | 6 | 13 |
+| 2. Builder | 15 | 15 | 30 |
+| 3. Engineer | 16 | 13 | 29 |
+| 4. Systems | 7 | 14 | 21 |
+| 5. Frontier | 3 | 4 | 7 |
+
+## Build order
+
+Start with a project at your level and complete its linked prerequisites. Links identify whether a prerequisite is ready or also planned. Starter plans with no project prerequisite assume basic familiarity with their chosen language. Every future implementation should first produce a useful result on an authored local fixture, then explain one visible failure, and finally add a reusable export or adapter. External SDK and provider checks stay explicit.
+
+Each brief defines its own task and acceptance boundary. During implementation, add original fixtures, a held-out case, source-backed explanations, an editable mechanism figure and a recording of the real output. Reference links describe protocols and formats, not evidence that the planned tool is already implemented.
+
+## Level 1: Starter
+
+<a id="bookmark-path-organizer"></a>
+
+### Bookmark Path Organizer
+
+Help a reader recover a useful collection from an exported bookmark pile. Normalize URLs conservatively, merge exact duplicates, score user-defined topics from saved titles and notes, and export an editable reading path as HTML and JSON.
+
+**Distinct focus:** Semantic Notes Search retrieves passages; this organizes link collections and produces an ordered reading artifact.
+
+**First demo to build:** Turn twelve authored links about community mapping into a short beginner reading path with duplicate explanations.
+
+**Languages:** TypeScript
+
+**Deliverable:** A standalone reading-path page and bookmarks.json with retained original URLs
+
+**Builds on:** None; begin with the basics of the selected language.
+
+Proposed milestones:
+
+1. Import bookmarks with their original hierarchy
+2. Normalize links and explain duplicate groups
+3. Rank topics and assemble a reading path
+4. Export an editable collection and progress file
+
+<a id="csv-repair-workbench"></a>
+
+### CSV Repair Workbench
+
+Help a spreadsheet owner repair inconsistent labels, dates and missing values through an explicit sequence of transformations. Preview every changed cell, keep ambiguous cases for review, and export a cleaned CSV with a reusable transformation recipe and HTML comparison.
+
+**Distinct focus:** CSV Question Workbench queries a table; this project creates a reviewed, replayable data-cleaning workflow.
+
+**First demo to build:** Normalize three spellings of a community garden location while preserving two ambiguous dates for review.
+
+**Languages:** Python
+
+**Deliverable:** cleaned.csv, recipe.json and a cell-level HTML before/after report
+
+**Builds on:** None; begin with the basics of the selected language.
+
+Proposed milestones:
+
+1. Profile columns and retain original cells
+2. Propose explicit normalization rules
+3. Preview changes and review ambiguous values
+4. Export a reusable repair recipe and cleaned table
+
+<a id="download-folder-sort-desk"></a>
+
+### Download Folder Sort Desk
+
+Help someone organize local downloads by combining file metadata, content hashes and an explainable category score. Generate collision-free destination proposals and duplicate groups, then export an HTML review desk and a JSON move plan that another file manager can consume.
+
+**Distinct focus:** Inbox Triage Desk works with message threads and replies; this handles local file identity, duplicate content and destination planning.
+
+**First demo to build:** Organize an authored folder of workshop handouts, images and duplicate attachments into an inspectable plan.
+
+**Languages:** Python
+
+**Deliverable:** A searchable HTML filing plan, duplicate groups and moves.json
+
+**Builds on:** None; begin with the basics of the selected language.
+
+Proposed milestones:
+
+1. Inventory files and compute content identities
+2. Score categories from visible file features
+3. Plan destinations and surface naming conflicts
+4. Export a reviewed filing plan for a file manager
+
+<a id="glossary-hovercard-publisher"></a>
+
+### Glossary Hovercard Publisher
+
+Help an educator add contextual definitions to existing lesson HTML using a reviewed glossary and longest-phrase matching. Preserve code and links, support keyboard-accessible definitions, and export a standalone annotated lesson with a reusable glossary file.
+
+**Distinct focus:** Source-Gro
```

**File**: `projects/SUBMITTING.md` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+# Submitting a project
+
+Build an artifact somebody can use after finishing the course. Teach it through four to eight stages, and make the entire reference path runnable offline without API keys. See [AUTHORING.md](AUTHORING.md) for the exact manifest, runner, figure, demonstration, and completion-evidence contracts.
+
+## Pick a useful outcome
+
+Good projects deliver a report generator, evidence index, skill validator, memory service, workflow tool, protocol server, or evaluation harness. Bound the scope honestly. A fixture backend teaches a desktop protocol; label it clearly rather than describing it as an operating-system integration.
+
+Projects must use original implementations and lessons. Cite official documentation, specifications, and research papers for technical facts. Avoid personal-data scraping, security-control evasion, or a hosted-model call with no substantive engineering exercise.
+
+## Create the project
+
+```bash
+cp -R projects/_template projects/your-project-id
+```
+
+Use a lowercase, hyphenated ID matching the directory. Set `source` to `community` and retain your name and GitHub handle in `author`. Keep `status` as `draft` while you develop the stages. The catalog preserves authorship and never promotes drafts automatically.
+
+The template has one small Python stage to demonstrate the contract. Extend it to four to eight stages and replace the example with your own artifact. Python, TypeScript, Rust, and Go use standard-library runners. Mixed projects declare the real runner for each stage. Include every module and fixture a fresh learner workspace needs.
+
+## Teach and verify each stage
+
+Explain the useful behavior, the governing invariant, one worked example, exact public function signatures, errors, and a command the learner can copy. Every stage needs five meaningful tests, a failure case, a starter that clearly fails, and an original registered mechanism figure. Tests must load the learner's workspace, never quietly import the checked-in solution.
+
+Later starters add files without overwriting earlier work. The initializer preserves existing files, including learner implementations, unless the learner explicitly passes `--force`. Include a held-out test or dataset, a measured evaluation result, and named end states for loops and budgets.
+
+## Demonstrate the artifact
+
+Declare a terminating argv command under `demo`, for example `{"command":["python3","demo.py"],"cwd":"solution"}`. Record real output and commit the GIF or video and its poster under the project's `media/` directory. Declare those relative paths in `demos`. The site bundles lessons and recordings with its build so a preview does not depend on unpublished files on GitHub main.
+
+## Validate and submit
+
+```bash
+python3 scripts/project_test.py your-project-id --all --solution --strict
+python3 scripts/project_test.py your-project-id --init /tmp/your-project-check
+python3 scripts/project_test.py your-project-id --stage 1 --path /tmp/your-project-check
+node --test site/test_projects_data.js
+node site/build-projects.js --strict
+```
+
+The reference solution must pass every stage without skipped tests. The fresh starter must fail with an actionable implementation message. Strict mode rejects missing runtimes, empty suites, skipped tests, missing figures, and absent recordings. Do not commit generated `site/projects-data.js` or `site/project-content/` files.
+
+Open a feature-branch pull request. A maintainer reviews the original lessons, tests the reference artifact, tries the first stages as a learner, and checks the rendered project on the website. Completion certificates use full learner grading reports; reference-solution results and manual checkboxes do not establish completion.
```

---

### Incident Patch 11: `7589cf88` (2026-09-29)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-09-28T06:29:07.789Z
+// Last built: 2026-09-29T16:04:41.578Z
 
 const ROADMAP_PREREQS = {
   "0": [],
```

---

### Incident Patch 12: `d864ffe8` (2026-09-29)
**Commit Message**: fix: read readiness inputs as UTF-8 (#501)

**File**: `scripts/test_agent_readiness.py` (modified, +11/-11)
```diff
@@ -16,7 +16,7 @@
 def load_json_ld(path: Path) -> list[dict]:
     blocks = re.findall(
         r'<script\s+type="application/ld\+json"\s*>(.*?)</script>',
-        path.read_text(),
+        path.read_text(encoding="utf-8"),
         flags=re.IGNORECASE | re.DOTALL,
     )
     return [json.loads(block) for block in blocks]
@@ -63,7 +63,7 @@ def assert_legacy_redirect(paths: dict, route: str, parameter_name: str) -> None
 
 
 def main() -> None:
-    config = json.loads((ROOT / "vercel.json").read_text())
+    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
     rewrites = config["rewrites"]
     markdown_rewrites = [r for r in rewrites if "has" in r and r["destination"] == "/llms.txt"]
     negotiator_rewrites = [r for r in rewrites if r.get("destination", "").startswith("/api/markdown")]
@@ -113,11 +113,11 @@ def main() -> None:
         assert (SITE / name).is_file(), f"missing {name}"
 
     for name in ("developer.html", "contact.html", "privacy.html"):
-        text = (SITE / name).read_text()
+        text = (SITE / name).read_text(encoding="utf-8")
         assert "AI Engineering from Scratch" in text
         assert len(" ".join(text.split())) > 500, f"{name} is too thin to be a trust page"
 
-    openapi = json.loads((SITE / "openapi.json").read_text())
+    openapi = json.loads((SITE / "openapi.json").read_text(encoding="utf-8"))
     assert openapi["openapi"].startswith("3.")
     assert "https://aiengineeringfromscratch.com" in openapi["servers"][0]["url"]
     paths = openapi["paths"]
@@ -146,7 +146,7 @@ def main() -> None:
     assert problem["properties"]["type"]["const"] == "about:blank"
     assert set(problem["required"]) == {"type", "title", "status", "code", "detail"}
     assert (ROOT / "api/v1/markdown.js").is_file()
-    assert "/api/v1/markdown" in (SITE / "developer.html").read_text()
+    assert "/api/v1/markdown" in (SITE / "developer.html").read_text(encoding="utf-8")
 
     def check_refs(value):
         if isinstance(value, dict):
@@ -165,7 +165,7 @@ def check_refs(value):
     redirect_response = openapi["components"]["responses"]["PermanentRedirect"]
     assert redirect_response["headers"]["Location"]["schema"]["type"] == "string"
 
-    lesson_manifest = json.loads((SITE / "lesson-seo.json").read_text())
+    lesson_manifest = json.loads((SITE / "lesson-seo.json").read_text(encoding="utf-8"))
     lessons = lesson_manifest["lessons"]
     assert len(lessons) >= 500, "lesson SEO manifest regressed to a generic shell"
     assert all(entry["path"] == lesson_path for lesson_path, entry in lessons.items())
@@ -177,7 +177,7 @@ def check_refs(value):
         for entry in lessons.values()
     )
 
-    certification_manifest = json.loads((SITE / "certification-seo.json").read_text())
+    certification_manifest = json.loads((SITE / "certification-seo.json").read_text(encoding="utf-8"))
     tracks = certification_manifest["tracks"]
     assert len(tracks) >= 4, "certification SEO manifest regressed to a generic shell"
     assert all(entry["id"] == track_id for track_id, entry in tracks.items())
@@ -189,7 +189,7 @@ def check_refs(value):
         for entry in tracks.values()
     )
 
-    sitemap = (SITE / "sitemap.xml").read_text()
+    sitemap = (SITE / "sitemap.xml").read_text(encoding="utf-8")
     assert sitemap.count("/lesson?path=") == len(lessons)
     sitemap_lessons = {
         unquote(value)
@@ -209,7 +209,7 @@ def check_refs(value):
         ),
     )
     for template_name, seo_marker, fallback_marker in templates_and_markers:
-        template = (SITE / template_name).read_text()
+        template = (SITE / template_name).read_text(encoding="utf-8")
         assert template.count(seo_marker) == 1
         assert template.count(fallback_marker) == 1
 
@@ -246,10 +246,10 @@ def check_refs(value):
     ):
         assert false_field not in identity_json
 
-    not_found = (SITE / "404.html").read_text()
+    not_found = (SITE / "404.html").read_text(encoding="utf-8")
     assert "/llms.txt" in not_found and "/sitemap.xml" in not_found
     assert (ROOT / "api" / "markdown.js").is_file()
-    assert "Vary" in (ROOT / "api" / "markdown.js").read_text()
+    assert "Vary" in (ROOT / "api" / "markdown.js").read_text(encoding="utf-8")
     print("agent readiness contracts: ok")
 
 
```

---

### Incident Patch 13: `bf7791e1` (2026-09-28)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-09-27T10:09:58.491Z
+// Last built: 2026-09-28T06:29:07.789Z
 
 const ROADMAP_PREREQS = {
   "0": [],
```

---

### Incident Patch 14: `968da079` (2026-09-27)
**Commit Message**: chore(site): rebuild data.js

**File**: `site/data.js` (modified, +5/-5)
```diff
@@ -1,5 +1,5 @@
 // Auto-generated by build.js — do not edit manually.
-// Last built: 2026-09-27T05:58:16.242Z
+// Last built: 2026-09-27T10:09:58.491Z
 
 const ROADMAP_PREREQS = {
   "0": [],
@@ -920,7 +920,7 @@ const PHASES = [
         "lang": "Python",
         "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/26-monocular-depth/",
         "summary": "A depth map is a single-channel image where each pixel is a distance from the camera. Predicting it from one RGB frame used to be impossible without stereo or LiDAR. In 2026 a f…",
-        "keywords": "Relative vs metric depth · The encoder-decoder pattern · Why a single image produces depth at all · What monocular depth cannot do · Depth Anything V3 in 2026 · Marigold — diffusion for depth · Intrinsics and the pinhole camera · Evaluation · Step 1: Depth metrics · Step 2: Scale-and-shift alignment · Step 3: Lift depth to a point cloud · Step 4: Smoke test with a synthetic depth scene · Step 5: Depth Anything V3 usage (reference)"
+        "keywords": "Relative vs metric depth · The encoder-decoder pattern · Why a single image produces depth at all · What monocular depth cannot do · Depth Anything V3 in 2026 · Marigold — diffusion for depth · Intrinsics and the pinhole camera · Evaluation · Step 1: Depth metrics · Step 2: Scale-and-shift alignment · Step 3: Lift depth to a point cloud · Step 4: Smoke test with a synthetic depth scene · Step 5: Depth Anything V2 usage (reference)"
       },
       {
         "name": "Multi-Object Tracking & Video Memory",
@@ -1242,7 +1242,7 @@ const PHASES = [
         "lang": "Python",
         "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/03-audio-classification",
         "summary": "Everything from \"dog barking vs siren\" to \"which language is this\" is audio classification. The features are mels. The architecture moves each decade. The evaluation stays AUC, …",
-        "keywords": "Class imbalance is the real challenge · Evaluation · Step 1: featurize · Step 2: fixed-length summary · Step 3: k-NN · Step 4: upgrade to CNN on log-mels · Step 5: the 2026 default — fine-tune BEATs"
+        "keywords": "Class imbalance is the real challenge · Evaluation · Step 1: featurize · Step 2: fixed-length summary · Step 3: k-NN · Step 4: upgrade to CNN on log-mels · Step 5: fine-tune a pretrained audio transformer (AST shown)"
       },
       {
         "name": "Speech Recognition (ASR)",
@@ -1885,7 +1885,7 @@ const PHASES = [
         "lang": "Python",
         "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/11-quantization/",
         "summary": "A 70B model in FP16 needs 140GB. Two A100s just for weights. Quantize to FP8: one 80GB GPU. INT4: a MacBook.",
-        "keywords": "Number Formats: What Each Bit Does · How Quantization Works · Sensitivity Hierarchy · PTQ vs QAT · GPTQ, AWQ, GGUF · Quality Measurement · Real Numbers · Step 1: Number Format Representations · Step 2: Symmetric Quantization (Per-Tensor and Per-Channel) · Step 3: Quality Measurement · Step 4: Bit-Width Sweep · Step 5: Sensitivity Experiment · Step 6: Simulated GPTQ · Step 7: AWQ Simulation · Step 8: Full Pipeline · Quantizing with AutoGPTQ · Quantizing with AutoAWQ · Converting to GGUF · Serving quantized models"
+        "keywords": "Number Formats: What Each Bit Does · How Quantization Works · Sensitivity Hierarchy · PTQ vs QAT · GPTQ, AWQ, GGUF · Quality Measurement · Real Numbers · Step 1: Number Format Representations · Step 2: Symmetric Quantization (Per-Tensor and Per-Channel) · Step 3: Quality Measurement · Step 4: Bit-Width Sweep · Step 5: Sensitivity Experiment · Step 6: Simulated GPTQ · Step 7: AWQ Simulation · Step 8: Full Pipeline · Quantizing with GPTQModel · Quantizing to AWQ with LLM Compressor · Converting to GGUF · Serving quantized models"
       },
       {
         "name": "Inference Optimization",
@@ -3648,7 +3648,7 @@ const PHASES = [
         "lang": "Python",
         "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/04-vllm-serving-internals/",
         "summary": "Modern serving-engine throughput rests on three compounding defaults, not a single trick. PagedAttention is always on. Continuous batching injects new requests into the active b…",
-        "keywords": "PagedAttention as a virtual memory system · Continuous batching at the iteration level · Chunked prefill protects TTFT tail · The three defaults interact · The 2026 v0.18.0 gotcha · Numbers you should remember · What the scheduler looks like"
+        "keywords": "PagedAttention as a virtual memory system · Continuous batching at the iteration level · Chunked prefill protects TTFT tail · The three defaults interact · Check the compatibility matrix · Numbers you should remember · What the scheduler looks like"
       },
       {
         "name": "EA
```

---

### Incident Patch 15: `a05d3925` (2026-09-27)
**Commit Message**: fix: repair broken lesson references and guard homepage storage (#495)

* fix(site): guard theme storage access on the homepage and about page

Reading or writing localStorage throws a SecurityError when storage is
blocked (strict privacy settings, some embedded webviews). site/app.js
read the saved theme outside any try/catch, before it registered its
DOMContentLoaded handler, so the throw stopped the whole homepage from
initializing. The about page's inline theme script had the same
unguarded read and write.

Wrap all four accesses the way the other pages already do and fall
back to the system theme. Bump the app.js cache key so browsers pick
up the fix, and give app.js its own release constant in the cache-key
test.

Fixes #490

* fix(lessons): repair dataset, model, and tool references that no longer resolve

Lesson snippets pointed at resources that are gone or never existed, so
they fail when a student runs them:

- wikimedia/wikipedia only ships 20231101.* configs; 20220301.en is gone
- MMAU-Pro lives at gamma-lab-umd/MMAU-Pro, with audio_path and answer
  fields; open-ended rows are filtered out of the exact-match score
- meta-llama/Llama-3-70B-Instruct is meta-llama/Meta-L

**File**: `phases/00-setup-and-tooling/09-data-management/docs/en.md` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ This downloads the IMDB movie review dataset. After the first download, it loads
 Some datasets are too large to fit on disk. Streaming loads them row by row without downloading the full thing.
 
 ```python
-dataset = load_dataset("wikimedia/wikipedia", "20220301.en", split="train", streaming=True)
+dataset = load_dataset("wikimedia/wikipedia", "20231101.en", split="train", streaming=True)
 
 for i, example in enumerate(dataset):
     print(example["title"])
```

**File**: `phases/01-math-foundations/07-bayes-theorem/docs/en.md` (modified, +1/-1)
```diff
@@ -469,6 +469,6 @@ Advantages over frequentist A/B testing:
 ## Further Reading
 
 - [3Blue1Brown: Bayes' theorem](https://www.youtube.com/watch?v=HZGCoVF3YvM) - visual explanation with the medical test example
-- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/notes2022fall/cs229-notes2.pdf) - naive Bayes and its connection to discriminative models
+- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/main_notes.pdf) - naive Bayes and its connection to discriminative models
 - [Think Bayes](https://greenteapress.com/wp/think-bayes/) - free book, Bayesian statistics with Python code
 - [scikit-learn Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html) - production implementations and when to use each variant
```

**File**: `phases/01-math-foundations/17-linear-systems/docs/en.md` (modified, +1/-1)
```diff
@@ -577,5 +577,5 @@ This lesson produces:
 
 - [MIT 18.06: Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/) (Gilbert Strang) -- the definitive course on linear systems and matrix factorizations
 - [Numerical Linear Algebra](https://people.maths.ox.ac.uk/trefethen/text.html) (Trefethen & Bau) -- the standard reference for understanding numerical stability, conditioning, and why algorithms fail
-- [Matrix Computations](https://www.cs.cornell.edu/cv/GolubVanLoan4/golubandvanloan.htm) (Golub & Van Loan) -- the encyclopedic reference for every matrix algorithm
+- [Matrix Computations](https://www.press.jhu.edu/books/title/10678/matrix-computations) (Golub & Van Loan) -- the encyclopedic reference for every matrix algorithm
 - [3Blue1Brown: Inverse Matrices](https://www.3blue1brown.com/lessons/inverse-matrices) -- visual intuition for what solving Ax = b means geometrically
```

**File**: `phases/02-ml-fundamentals/11-ensemble-methods/docs/en.md` (modified, +1/-1)
```diff
@@ -349,7 +349,7 @@ This lesson produces `outputs/prompt-ensemble-selector.md` -- a prompt that help
 ## Further Reading
 
 - [Schapire & Freund: Boosting: Foundations and Algorithms](https://mitpress.mit.edu/9780262526036/) -- the book by AdaBoost's creators
-- [Friedman: Greedy Function Approximation: A Gradient Boosting Machine (2001)](https://statweb.stanford.edu/~jhf/ftp/trebst.pdf) -- the original gradient boosting paper
+- [Friedman: Greedy Function Approximation: A Gradient Boosting Machine (2001)](https://doi.org/10.1214/aos/1013203451) -- the original gradient boosting paper
 - [Chen & Guestrin: XGBoost (2016)](https://arxiv.org/abs/1603.02754) -- the XGBoost paper
 - [Wolpert: Stacked Generalization (1992)](https://www.sciencedirect.com/science/article/abs/pii/S0893608005800231) -- the original stacking paper
 - [scikit-learn Ensemble Methods](https://scikit-learn.org/stable/modules/ensemble.html) -- practical reference
```

**File**: `phases/04-computer-vision/01-image-fundamentals/docs/en.md` (modified, +1/-1)
```diff
@@ -440,7 +440,7 @@ This lesson produces:
 
 ## Further Reading
 
-- [Charles Poynton — A Guided Tour of Color Space](https://poynton.ca/PDFs/Guided_tour.pdf) — the clearest technical treatment of why there are so many color spaces and when each one matters
+- [Charles Poynton — A Guided Tour of Color Space](https://web.archive.org/web/20251220000525/https://poynton.ca/PDFs/Guided_tour.pdf) — the clearest technical treatment of why there are so many color spaces and when each one matters
 - [PyTorch Vision Transforms Docs](https://pytorch.org/vision/stable/transforms.html) — the full pipeline of transforms you will actually compose in production
 - [How JPEG Works (Colt McAnlis)](https://www.youtube.com/watch?v=F1kYBnY6mwg) — a sharp visual tour of chroma subsampling, DCT, and why JPEG encodes YCbCr rather than RGB
 - [ImageNet Preprocessing Conventions (torchvision models)](https://pytorch.org/vision/stable/models.html) — the source of truth for `mean=[0.485, 0.456, 0.406]` and why every model in the zoo expects it
```

**File**: `phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md` (modified, +1/-1)
```diff
@@ -400,4 +400,4 @@ This lesson produces:
 - [U-Net: Convolutional Networks for Biomedical Image Segmentation (Ronneberger et al., 2015)](https://arxiv.org/abs/1505.04597) — the original paper; the figure everyone copies is on page 2
 - [Fully Convolutional Networks (Long et al., 2015)](https://arxiv.org/abs/1411.4038) — the paper that first made segmentation an end-to-end conv problem
 - [segmentation_models_pytorch](https://github.com/qubvel/segmentation_models.pytorch) — the reference for production segmentation; every standard architecture plus every standard loss
-- [Lessons learned from training SOTA segmentation (kaggle.com competitions)](https://www.kaggle.com/code/iafoss/carvana-unet-pytorch) — a walkthrough of why TTA, pseudo-labeling, and class weights matter on real data
+- [iafoss, Unet34 submission with TTA (Kaggle notebook)](https://www.kaggle.com/code/iafoss/unet34-submission-tta-0-699-new-public-lb) — test-time augmentation for a U-Net on a real segmentation competition
```

**File**: `phases/04-computer-vision/11-stable-diffusion/docs/en.md` (modified, +6/-3)
```diff
@@ -193,13 +193,16 @@ White pixels in the mask are the area to regenerate. Black pixels are preserved.
 ### Step 5: LoRA loading
 
 ```python
-pipe.load_lora_weights("sayakpaul/sd-lora-ghibli")
+pipe.load_lora_weights(
+    "artificialguybr/studioghibli-redmond-1-5v-studio-ghibli-lora-for-liberteredmond-sd-1-5",
+    weight_name="StudioGhibliRedmond-15V-LiberteRedmond-StdGBRedmAF-StudioGhibli.safetensors",
+)
 pipe.fuse_lora(lora_scale=0.8)
 
-image = pipe(prompt="a village square in ghibli style").images[0]
+image = pipe(prompt="a village square, StdGBRedmAF, Studio Ghibli").images[0]
 ```
 
-`lora_scale` controls strength; 0.0 = no effect, 1.0 = full effect. `fuse_lora` bakes the adapter into the weights in place for speed, but prevents swapping. Call `pipe.unfuse_lora()` before loading a different adapter.
+The trigger phrase from the model card (`StdGBRedmAF, Studio Ghibli`) switches the style on. `lora_scale` controls strength; 0.0 = no effect, 1.0 = full effect. `fuse_lora` bakes the adapter into the weights in place for speed, but prevents swapping. Call `pipe.unfuse_lora()` before loading a different adapter.
 
 ### Step 6: LoRA training (sketch)
 
```

**File**: `phases/04-computer-vision/15-real-time-edge/docs/en.md` (modified, +1/-1)
```diff
@@ -270,5 +270,5 @@ This lesson produces:
 
 - [EfficientNet (Tan & Le, 2019)](https://arxiv.org/abs/1905.11946) — compound scaling for efficient architectures
 - [MobileNetV3 (Howard et al., 2019)](https://arxiv.org/abs/1905.02244) — mobile-first architecture with h-swish and squeeze-excite
-- [A Practical Guide to TensorRT Optimization (NVIDIA)](https://developer.nvidia.com/blog/accelerating-model-inference-with-tensorrt-tips-and-best-practices-for-pytorch-users/) — how to actually get the throughput numbers in the paper
+- [Accelerating Inference Up to 6x Faster in PyTorch with Torch-TensorRT (NVIDIA)](https://developer.nvidia.com/blog/accelerating-inference-up-to-6x-faster-in-pytorch-with-torch-tensorrt/) — how to actually get the throughput numbers in the paper
 - [ONNX Runtime docs](https://onnxruntime.ai/docs/) — quantisation, graph optimisation, provider selection
```

#### Recent Merged Pull Requests:
- **PR #534** (2026-10-05): feat(site): add a superintelligence thought experiment (@rohitg00)
- **PR #533** (2026-10-05): fix(readme): keep sponsor banners side by side on desktop (@rohitg00)
- **PR #532** (2026-10-05): docs(sponsors): add NitroStack and compact README banners (@rohitg00)
- **PR #530** (closed): feat: create base environment (@tomipegu)
- **PR #520** (2026-09-30): fix(site): support clean page URLs across the site (@rohitg00)
- **PR #517** (closed): Sync/upstream 2026 10 (@yennanliu)
- **PR #513** (2026-09-29): fix(site): refresh cached assets and align project commands (@rohitg00)
- **PR #501** (2026-09-29): fix: read readiness inputs as UTF-8 (@dajiaohuang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
