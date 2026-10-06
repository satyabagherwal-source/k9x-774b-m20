# Forensic Learning Record (Deep Inspection): AgentEra/Agently

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentera-agently-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AgentEra/Agently](https://github.com/AgentEra/Agently))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:32:06.405Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AgentEra/Agently`
- **Description**: [GenAI Application Development Framework]  🚀 Build GenAI application quick and easy 💬 Easy to interact with GenAI agent in code using structure data and chained-calls syntax 🧩 Use Event-Driven Flow *TriggerFlow* to manage complex GenAI working logic 🔀 Switch to any model without rewrite application code
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1656 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agently/builtins/hookers/RuntimeChannelSinkHooker.py`
```
# Copyright 2023-2026 AgentEra(Agently.Tech)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import TYPE_CHECKING

from agently.types.plugins import EventHooker

if TYPE_CHECKING:
    from agently.types.data import ObservationEvent

class RuntimeChannelSinkHooker(EventHooker):
    name = "RuntimeChannelSinkHooker"
    event_types = None
    delivery_policy = {
        "mode": "summary",
        "dispatch": "await",
        "emit_interval": 0.1,
        "max_items": 20,
        "high_frequency_only": True,
    }
    _buffer: list["ObservationEvent"] = []

    @staticmethod
    def _on_register():
        RuntimeChannelSinkHooker._buffer.clear()

    @staticmethod
    def _on_unregister():
        RuntimeChannelSinkHooker._buffer.clear()

    @staticmethod
    def read_buffer():
        return list(RuntimeChannelSinkHooker._buffer)

    @staticmethod
    def drain_buffer():
        buffered = list(RuntimeChannelSinkHooker._buffer)
        RuntimeChannelSinkHooker._buffer.clear()
        return buffered

    @staticmethod
    async def handler(event: "ObservationEvent"):
        RuntimeChannelSinkHooker._buffer.append(event.model_copy(deep=True))

```

### Core Architecture Module: `agently/builtins/hookers/RuntimeConsoleSinkHooker.py`
```
# Copyright 2023-2026 AgentEra(Agently.Tech)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
from collections import OrderedDict
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal, TypeAlias, cast

from agently.types.data.event import (
    get_triggerflow_event_aliases,
    normalize_triggerflow_event_type,
)
from agently.types.plugins import EventHooker
from agently.utils import DataFormatter, Settings

if TYPE_CHECKING:
    from agently.types.data import ObservationEvent


RuntimeLogProfile: TypeAlias = Literal["off", "simple", "detail"]


_VALID_RUNTIME_LOG_PROFILES = frozenset({"off", "simple", "detail"})
_ALWAYS_VISIBLE_LEVELS = frozenset({"WARNING", "ERROR", "CRITICAL"})
_VALIDATION_CONTEXT_MAX_CHARS = 500
_VALIDATION_TRACEBACK_MAX_CHARS = 2000
_VALIDATION_TRACEBACK_MAX_LINES = 8
_SIMPLE_PROMPT_MAX_CHARS = 2000
_DETAIL_PROMPT_MAX_CHARS = 16000
_SIMPLE_ACTION_PREVIEW_MAX_CHARS = 500
_CONSOLE_STREAM_BUFFER_MAX_CHARS = 65536
_CONSOLE_DEFERRED_DETAIL_MAX_CHARS = 16000
_CONSOLE_DEFERRED_TOTAL_MAX_CHARS = 131072
_CONSOLE_DEFERRED_MAX_ENTRIES = 128
_CONSOLE_EVENT_FAMILIES = frozenset({"model", "action", "triggerflow", "runtime"})
_RUNTIME_PRINT_EVENTS = frozenset({"runtime.print"})
_SIMPLE_AGENT_EXECUTION_STREAM_KINDS = frozenset(
    {
        "action_observation",
        "phase",
        "progress",
        "taskboard_control_request",
        "task_workspace_artifact_draft",
        "task_workspace_artifact_draft_public_replay_marker",
        "task_workspace_artifact_draft_retry",
    }
)
_SIMPLE_EVENT_TYPES = {
    "model": frozenset(
        {
            "model.requesting",
            "model.streaming",
            "model.completed",
            "model.failed",
            "model.parse_failed",
            "model.request_failed",
            "model.retrying",
            "model.requester.error",
            "model.streaming_canceled",
            "model.validation_error",
            "model.validation_failed",
        }
    ),
    "action": frozenset(
        {
            "action.loop_started",
            "action.loop_completed",
            "action.loop_failed",
            "action.started",
            "action.completed",
            "action.approval_required",
            "action.blocked",
            "action.failed",
            "tool.loop_started",
            "tool.loop_completed",
            "tool.loop_failed",
        }
    ),
    "triggerflow": frozenset(
        {
            "triggerflow.execution_started",
            "triggerflow.execution_completed",
            "triggerflow.execution_failed",
            "triggerflow.execution_resumed",
            "triggerflow.interrupt_raised",
        }
    ),
    "runtime": frozenset(
        {
            "agent_execution.started",
            "agent_execution.completed",
            "agent_execution.failed",
            "agent_execution.cancelled",
            "agent_execution.stream",
            "execution_resource.ensuring",
            "execution_resource.probed",
            "execution_resource.progress",
            "execution_resource.ready",
            "execution_resource.unhealthy",
            "execution_resource.approval_required",
            "execution_resource.failed",
            "prompt.built",
            "runtime.print",
        }
    ),
}
_FAMILY_SETTINGS_KEYS = {
    "model": "runtime.show_model_logs",
    "action": "runtime.show_action_logs",
    "triggerflow": "runtime.show_trigger_flow_logs",
    "runtime": "runtime.show_runtime_logs",
}


def normalize_runtime_log_profile(value: Any, *, default: RuntimeLogProfile | str = "off") -> RuntimeLogProfile | str:
    if isinstance(value, bool):
        return "simple" if value else "off"
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in _VALID_RUNTIME_LOG_PROFILES:
            return normalized  # type: ignore[return-value]
        if normalized in {"true", "on"}:
            return "simple"
        if normalized in {"false", "none", "quiet"}:
            return "off"
        if normalized in {"summary", "verbose", "detailed"}:
            return "simple" if normalized == "summary" else "detail"
    return default


def coerce_runtime_log_profile(value: Any) -> RuntimeLogProfile:
    normalized = normalize_runtime_log_profile(value, default="")
    if normalized:
        return cast(RuntimeLogProfile, normalized)
    raise ValueError('`debug` only accepts False | True | "simple" | "detail" | "off".')


def resolve_runtime_event_family(event_type: str | None) -> str:
    if isinstance(event_type, str):
        if event_type.startswith("model."):
            return "model"
        if event_type.startswith(("action.", "tool.")):
            return "action"
        if any(alias.startswith("triggerflow.") for alias in get_triggerflow_event_aliases(event_type)):
            return "triggerflow"
    return "runtime"


def _payload_value(event: "ObservationEvent", key: str, default: Any = None) -> Any:
    if isinstance(event.payload, dict):
        return event.payload.get(key, default)
    return default


def _model_request_role(event: "ObservationEvent") -> str:
    run = event.run
    if run is None or not isinstance(run.meta, Mapping):
        return ""
    return str(run.meta.get("model_request_role") or "")


def _settings_layer_value(settings: Settings, key: str) -> Any:
    value = settings.get(key, None, inherit=False)
    if value is not None:
        return value
    parent = getattr(settings, "parent", None)
    if parent is not None:
        return _settings_layer_value(parent, key)
    return None


def _resolve_action_log_setting(settings: Settings) -> Any:
    current: Settings | None = settings
    while current is not None:
        action_value = current.get("runtime.show_action_logs", None, inherit=False)
        if action_value is not None:
            return action_value
        tool_value = current.get("runtime.show_tool_logs", None, inherit=False)
        if tool_value is not None:
            return tool_value
        current = getattr(current, "parent", None)
    return "off"


def resolve_runtime_log_profile(settings: Settings, event_type: str | None) -> RuntimeLogProfile:
    family = resolve_runtime_event_family(event_type)
    if family == "action":
        return cast(RuntimeLogProfile, normalize_runtime_log_profile(_resolve_action_log_setting(settings)))
    key = _FAMILY_SETTINGS_KEYS[family]
    return cast(RuntimeLogProfile, normalize_runtime_log_profile(_settings_layer_value(settings, key)))


def is_simple_runtime_event(event: "ObservationEvent") -> bool:
    family = resolve_runtime_event_family(event.event_type)
    if family not in _SIMPLE_EVENT_TYPES:
        return event.event_type in _RUNTIME_PRINT_EVENTS
    event_type = event.event_type
    if family == "triggerflow":
        event_type = normalize_triggerflow_event_type(event.event_type)
    if event_type == "agent_execution.stream":
        stream_kind = _payload_value(event, "stream_kind")
        return isinstance(stream_kind, str) and stream_kind in _SIMPLE_AGENT_EXECUTION_STREAM_KINDS
    if event_type == "agent_execution.stream.delta":
        if _is_nested_model_stream_projection(event):
            return False
        if _payload_value(event, "stream_kind") == "progress_delta":
            return True
        if _payload_value(event, "source") == "model_request":
            if _is_nested_run_event(event):
                return False
            path = str(_payload_value(event, "path") or "")
            return "original_delta" not in path
        return False
    return event_type in _SIMPLE_EVENT_TYPES[family]


def _is_empty_reasoning_completion(event: "ObservationEvent") -> bool:
    if event.event_type != "model.reasoning.completed":
        return False
    reasoning = _payload_value(event, "reasoning")
    chunk_count = _payload_value(event, "chunk_count")
    return reasoning in (None, "") and chunk_count in (None, 0)


def _is_runtime_progress_projection(event: "ObservationEvent") -> bool:
    if event.event_type not in {"agent_execution.stream", "agent_execution.stream.delta"}:
        return False
    path = str(_payload_value(event, "path") or "")
    return _payload_value(event, "stream_kind") == "runtime_progress" or path.startswith(
        "runtime.progress."
    ) or ".runtime.progress." in path


def _is_nested_child_execution_leaf(event: "ObservationEvent") -> bool:
    if _payload_value(event, "stream_kind") != "child_execution":
        return False
    path = str(_payload_value(event, "path") or "")
    marker = ".execution."
    if marker not in path:
        return False
    relative_path = path.split(marker, 1)[1]
    if relative_path in {"route.selected", "context.package"}:
        return False
    return "." in relative_path or "[" in relative_path


def _is_detail_console_event(event: "ObservationEvent") -> bool:
    """Select human-meaningful diagnostics without changing EventCenter facts."""
    if event.event_type in {"request.started", "request.completed", "model.reasoning.delta"}:
        return False
    if event.event_type == "model.status" and _payload_value(event, "status") == "completed":
        return False
    if _is_empty_reasoning_completion(event):
        return False
    if event.event_type in {"agent_execution.stream", "agent_execution.stream.delta"}:
        if _is_runtime_progress_projection(event):
         
```

### Core Architecture Module: `agently/builtins/hookers/RuntimeStorageSinkHooker.py`
```
# Copyright 2023-2026 AgentEra(Agently.Tech)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
from typing import TYPE_CHECKING, Any

from agently.builtins.hookers.RuntimeConsoleSinkHooker import should_render_storage_event
from agently.types.plugins import EventHooker
from agently.utils import DataFormatter

if TYPE_CHECKING:
    from agently.types.data import ObservationEvent


def _stringify_payload(payload: Any) -> str:
    if payload is None:
        return ""
    sanitized = DataFormatter.sanitize(payload)
    try:
        return json.dumps(sanitized, ensure_ascii=False)
    except TypeError:
        return str(sanitized)


class RuntimeStorageSinkHooker(EventHooker):
    name = "RuntimeStorageSinkHooker"
    event_types = None
    delivery_policy = {
        "mode": "summary",
        "dispatch": "await",
        "emit_interval": 0.1,
        "max_items": 20,
        "high_frequency_only": True,
    }

    @staticmethod
    def _on_register():
        pass

    @staticmethod
    def _on_unregister():
        pass

    @staticmethod
    async def handler(event: "ObservationEvent"):
        from agently.base import logger, settings

        if not should_render_storage_event(event, settings):
            return

        match event.level:
            case "DEBUG":
                log = logger.debug
            case "INFO":
                log = logger.info
            case "WARNING":
                log = logger.warning
            case "ERROR":
                log = logger.error
            case "CRITICAL":
                log = logger.critical

        content = event.message
        if content is None and event.error is not None:
            content = event.error.message
        if content is None:
            content = _stringify_payload(event.payload)
        run_label = f" [run={ event.run.run_id }]" if event.run is not None else ""
        log(f"[{ event.source }] [{ event.event_type }]{ run_label } { content or '' }".rstrip())

```

### Core Architecture Module: `agently/builtins/plugins/AgentExecution/long_task/LifecycleFlow.py`
```
# Copyright 2023-2026 AgentEra(Agently.Tech)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import uuid

from .TaskShared import (
    AgentTaskMixinBase,
    Any,
    DataFormatter,
    Mapping,
    TriggerFlow,
    TriggerFlowRuntimeData,
    _AgentTaskDeadlineExceeded,
)


_LIFECYCLE_STAGE_NAMES = (
    "context.prepare",
    "work.plan",
    "work.execute",
    "outputs.materialize",
    "evidence.ingest",
    "terminal.verify",
)

_LIFECYCLE_STAGE_EVENTS = {
    "context.prepare": "agent_task.lifecycle.context.prepared",
    "work.plan": "agent_task.lifecycle.work.planned",
    "work.execute": "agent_task.lifecycle.work.executed",
    "outputs.materialize": "agent_task.lifecycle.outputs.materialized",
    "evidence.ingest": "agent_task.lifecycle.evidence.ingested",
    "terminal.verify": "agent_task.lifecycle.terminal.verified",
}


class AgentTaskLifecycleFlowMixin(AgentTaskMixinBase):
    """Own the visible TriggerFlow lifecycle and its versioned short signals."""

    _lifecycle_error: BaseException | None

    async def _allocate_lifecycle_identity(
        self,
        kind: str,
        *,
        prefix: str,
    ) -> str:
        _ = kind
        return f"{prefix}_{uuid.uuid4().hex}"

    async def _allocate_lifecycle_frame_id(self) -> str:
        return await self._allocate_lifecycle_identity("frame", prefix="frm")

    def _require_lifecycle_signal(self, value: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(value, Mapping):
            raise ValueError("AgentTask lifecycle signals must be mappings.")
        task_id = str(value.get("task_id") or "").strip()
        if task_id != self.id:
            raise ValueError("AgentTask lifecycle signal belongs to a different task.")
        frame_id = str(value.get("frame_id") or "").strip()
        if not frame_id:
            raise ValueError("AgentTask lifecycle signal requires frame_id.")
        current_frame_id = str(self._lifecycle_state.current_frame_id or "").strip()
        if current_frame_id and frame_id != current_frame_id:
            raise ValueError("AgentTask lifecycle signal belongs to a stale or different frame.")
        raw_state_version = value.get("state_version")
        raw_iteration = value.get("iteration")
        if raw_state_version is None or raw_iteration is None:
            raise ValueError(
                "AgentTask lifecycle signal requires integer state_version and iteration."
            )
        try:
            state_version = int(raw_state_version)
            iteration = int(raw_iteration)
        except (TypeError, ValueError) as error:
            raise ValueError(
                "AgentTask lifecycle signal requires integer state_version and iteration."
            ) from error
        self._lifecycle_state.require_version(state_version)
        if iteration != self._lifecycle_state.iteration:
            raise ValueError("AgentTask lifecycle signal belongs to a stale iteration.")
        return {
            "task_id": task_id,
            "state_version": state_version,
            "frame_id": frame_id,
            "iteration": iteration,
            **{
                field: str(value.get(field) or "").strip()
                for field in ("plan_id", "work_result_id", "evidence_ref")
                if str(value.get(field) or "").strip()
            },
        }

    async def _open_lifecycle_frame(
        self,
        iteration: int,
        *,
        carry: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        frame_id = await self._allocate_lifecycle_frame_id()
        state_version = self._lifecycle_state.open_frame(
            frame_id,
            expected_version=self._lifecycle_state.state_version,
            iteration=iteration,
        )
        self._lifecycle_frames[frame_id] = {
            "task_id": self.id,
            "frame_id": frame_id,
            "iteration": iteration,
            "strategy": self.effective_execution_strategy,
            **dict(carry or {}),
        }
        return {
            "task_id": self.id,
            "state_version": state_version,
            "frame_id": frame_id,
            "iteration": iteration,
        }

    def _lifecycle_signal_from_data(
        self,
        data: TriggerFlowRuntimeData[Any, Any, Any],
    ) -> dict[str, Any]:
        for value in (data.value, data.input):
            if isinstance(value, Mapping) and value.get("frame_id"):
                return self._require_lifecycle_signal(value)
        raise ValueError("TriggerFlow lifecycle stage did not receive a frame signal.")

    def _advance_lifecycle_signal(
        self,
        signal: Mapping[str, Any],
        *,
        phase: str,
        prevalidated: bool = False,
    ) -> dict[str, Any]:
        normalized = (
            dict(signal)
            if prevalidated
            else self._require_lifecycle_signal(signal)
        )
        frame = self._lifecycle_frames.get(str(normalized.get("frame_id") or ""), {})
        state_version = self._lifecycle_state.advance(
            phase,
            expected_version=self._lifecycle_state.state_version,
            iteration=normalized["iteration"],
            current_plan_id=(
                str(frame.get("plan_id")) if frame.get("plan_id") else None
            ),
            work_result_id=(
                str(frame.get("work_result_id"))
                if frame.get("work_result_id")
                else None
            ),
            evidence_ref=(
                str(frame.get("evidence_ref"))
                if frame.get("evidence_ref")
                else None
            ),
        )
        return {
            **normalized,
            "state_version": state_version,
            **{
                field: str(frame.get(field))
                for field in ("plan_id", "work_result_id", "evidence_ref")
                if frame.get(field)
            },
        }

    async def _ensure_lifecycle_stage_identity(
        self,
        frame: dict[str, Any],
        *,
        phase: str,
    ) -> None:
        if phase == "work.plan" and not frame.get("plan_id"):
            frame["plan_id"] = await self._allocate_lifecycle_identity(
                "plan",
                prefix="pln",
            )
        elif phase == "work.execute" and not frame.get("work_result_id"):
            frame["work_result_id"] = await self._allocate_lifecycle_identity(
                "work_result",
                prefix="wrk",
            )
        elif phase == "evidence.ingest" and not frame.get("evidence_ref"):
            frame["evidence_ref"] = await self._allocate_lifecycle_identity(
                "evidence",
                prefix="evd",
            )

    def _build_flow(self):
        flow = TriggerFlow(name=f"agent-task-lifecycle-{self.id}")
        iteration_requested_event = (
            f"agent_task.lifecycle.iteration.requested.{self.id}"
        )
        transition_requested_event = (
            f"agent_task.lifecycle.transition.requested.{self.id}"
        )
        terminal_verification_retry_event = (
            f"agent_task.lifecycle.terminal.verification.retry.requested.{self.id}"
        )
        stage_output_events = {
            **_LIFECYCLE_STAGE_EVENTS,
            "terminal.verify": transition_requested_event,
        }

        async def lifecycle_start(data: TriggerFlowRuntimeData[Any, Any, Any]):
            await data.async_set_state("task_id", self.id, emit=False)
            await data.async_set_state(
                "agent_task.terminal_convergence",
                self._terminal_convergence_state.snapshot(),
                emit=False,
            )
            try:
                effective_strategy = (
                    await self._resolve_effective_execution_strategy()
                )
            except _AgentTaskDeadlineExceeded as error:
                await self._emit("agent_task.started", self._task_summary())
                await self._terminate_timed_out(
                    0,
                    stage=error.stage,
                    reason=error.reason,
                    limit_name=error.limit_name,
                    timeout_seconds=error.timeout_seconds,
                )
                await data.async_set_state(
                    "agent_task.execution_strategy",
                    self.execution_strategy,
                    emit=False,
                )
                await data.async_set_state(
                    "agent_task.effective_execution_strategy",
                    self.effective_execution_strategy,
                    emit=False,
                )
                await data.async_set_state("agent_task.result", self.result, emit=False)
                await data.async_set_state("agent_task.status", self.status, emit=False)
                return {"terminal": True, "status": self.status}
            await data.async_set_state(
                "agent_task.execution_strategy",
                self.execution_strategy,
                emit=False,
            )
            await data.async_set_state(
                "agent_task.effective_execution_strategy",
                effective_strategy,
                emit=False,
            )
            await self._emit("agent_task.started", self._task_summary())
            start_iteration = self._resumed_from_iteration + 1
            if start_iteration > 1:
                await self._emit(
                    "agent_task.resumed",
                
```

### Core Architecture Module: `agently/builtins/plugins/AgentExecution/long_task/LifecycleState.py`
```
# Copyright 2023-2026 AgentEra(Agently.Tech)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field, replace
from typing import Any, Mapping, Sequence


_CARRIER_KINDS = frozenset({"task_workspace_artifact", "inline_final_result"})
_CARRIER_STATUSES = frozenset({"proposed", "materialized", "accepted", "rejected"})
_REQUESTED_STRATEGIES = frozenset({"auto", "flat", "taskboard"})
_EFFECTIVE_STRATEGIES = frozenset({"flat", "taskboard"})
_HEX_DIGITS = frozenset("0123456789abcdefABCDEF")


def _required_text(value: Any, *, field_name: str, max_chars: int = 192) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field_name} must be a non-empty string.")
    if len(text) > max_chars:
        raise ValueError(f"{field_name} exceeds the private lifecycle identifier limit.")
    return text


def _positive_int(value: Any, *, field_name: str, allow_zero: bool = False) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{field_name} must be an integer.")
    try:
        result = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field_name} must be an integer.") from error
    minimum = 0 if allow_zero else 1
    if result < minimum:
        qualifier = "non-negative" if allow_zero else "positive"
        raise ValueError(f"{field_name} must be {qualifier}.")
    return result


def _content_digest(value: Any) -> str:
    digest = str(value or "").strip()
    if len(digest) != 64 or any(character not in _HEX_DIGITS for character in digest):
        raise ValueError("content_digest must be a 64-character hexadecimal SHA-256 digest.")
    return digest.lower()


@dataclass(frozen=True, slots=True)
class TerminalCarrier:
    carrier_id: str
    kind: str
    required: bool
    content_version_id: str
    path: str
    content_digest: str
    source_work_result_id: str
    state_version: int
    target_path: str = ""
    status: str = "proposed"

    def __post_init__(self) -> None:
        object.__setattr__(self, "carrier_id", _required_text(self.carrier_id, field_name="carrier_id"))
        kind = str(self.kind or "").strip()
        if kind not in _CARRIER_KINDS:
            raise ValueError(f"Unsupported terminal carrier kind: {kind or '<empty>'}.")
        object.__setattr__(self, "kind", kind)
        if not isinstance(self.required, bool):
            raise ValueError("required must be a boolean.")
        content_version_id = _required_text(
            self.content_version_id,
            field_name="content_version_id",
        )
        object.__setattr__(self, "content_version_id", content_version_id)
        path = str(self.path or "").strip()
        if kind == "task_workspace_artifact" and not path:
            raise ValueError("TaskWorkspace terminal carriers require a path.")
        if kind == "inline_final_result" and path:
            raise ValueError("Inline terminal carriers cannot own a TaskWorkspace path.")
        if kind == "inline_final_result" and not content_version_id.startswith("inline:"):
            raise ValueError("Inline terminal carriers require an inline: content_version_id.")
        object.__setattr__(self, "path", path)
        target_path = str(self.target_path or "").strip()
        if kind == "task_workspace_artifact":
            target_path = target_path or path
        elif target_path:
            raise ValueError("Inline terminal carriers cannot own a TaskWorkspace target path.")
        object.__setattr__(self, "target_path", target_path)
        object.__setattr__(self, "content_digest", _content_digest(self.content_digest))
        object.__setattr__(
            self,
            "source_work_result_id",
            _required_text(self.source_work_result_id, field_name="source_work_result_id"),
        )
        object.__setattr__(
            self,
            "state_version",
            _positive_int(self.state_version, field_name="state_version"),
        )
        status = str(self.status or "").strip()
        if status not in _CARRIER_STATUSES:
            raise ValueError(f"Unsupported terminal carrier status: {status or '<empty>'}.")
        object.__setattr__(self, "status", status)

    @classmethod
    def from_value(cls, value: Any, *, state_version: int) -> "TerminalCarrier":
        effective_state_version = _positive_int(state_version, field_name="state_version")
        if isinstance(value, cls):
            return replace(value, state_version=effective_state_version)
        if not isinstance(value, Mapping):
            raise ValueError("Terminal carriers must be mappings or TerminalCarrier records.")
        supplied_state_version = value.get("state_version")
        if supplied_state_version is not None and int(supplied_state_version) != effective_state_version:
            raise ValueError("Terminal carrier belongs to a stale AgentTask lifecycle version.")
        required = value.get("required")
        if not isinstance(required, bool):
            raise ValueError("required must be a boolean.")
        return cls(
            carrier_id=str(value.get("carrier_id") or ""),
            kind=str(value.get("kind") or ""),
            required=required,
            content_version_id=str(value.get("content_version_id") or ""),
            path=str(value.get("path") or ""),
            target_path=str(value.get("target_path") or ""),
            content_digest=str(value.get("content_digest") or ""),
            source_work_result_id=str(value.get("source_work_result_id") or ""),
            state_version=effective_state_version,
            status=str(value.get("status") or "proposed"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "carrier_id": self.carrier_id,
            "kind": self.kind,
            "required": self.required,
            "content_version_id": self.content_version_id,
            "path": self.path,
            "target_path": self.target_path,
            "content_digest": self.content_digest,
            "source_work_result_id": self.source_work_result_id,
            "state_version": self.state_version,
            "status": self.status,
        }


@dataclass(frozen=True, slots=True)
class TerminalCarrierInventory:
    inventory_version: int
    state_version: int
    carriers: tuple[TerminalCarrier, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "inventory_version",
            _positive_int(
                self.inventory_version,
                field_name="inventory_version",
                allow_zero=True,
            ),
        )
        object.__setattr__(
            self,
            "state_version",
            _positive_int(self.state_version, field_name="state_version"),
        )
        carrier_ids: set[str] = set()
        for carrier in self.carriers:
            if carrier.state_version != self.state_version:
                raise ValueError("Terminal carrier inventory contains a stale carrier state_version.")
            if carrier.carrier_id in carrier_ids:
                raise ValueError(f"duplicate terminal carrier_id: {carrier.carrier_id}")
            carrier_ids.add(carrier.carrier_id)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "TerminalCarrierInventory":
        state_version = _positive_int(value.get("state_version"), field_name="state_version")
        raw_carriers = value.get("carriers")
        carriers = (
            tuple(TerminalCarrier.from_value(item, state_version=state_version) for item in raw_carriers)
            if isinstance(raw_carriers, Sequence)
            and not isinstance(raw_carriers, str | bytes | bytearray)
            else ()
        )
        return cls(
            inventory_version=_positive_int(
                value.get("inventory_version", 0),
                field_name="inventory_version",
                allow_zero=True,
            ),
            state_version=state_version,
            carriers=carriers,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "inventory_version": self.inventory_version,
            "state_version": self.state_version,
            "carriers": [carrier.to_dict() for carrier in self.carriers],
        }


@dataclass(slots=True)
class AgentTaskLifecycleState:
    task_id: str
    requested_strategy: str
    effective_strategy: str | None = None
    phase: str = "created"
    iteration: int = 0
    state_version: int = 1
    current_frame_id: str = ""
    current_plan_id: str = ""
    work_result_id: str = ""
    evidence_ref: str = ""
    evidence_version: int = 0
    skill_bindings: dict[str, dict[str, Any]] = field(default_factory=dict)
    carrier_inventory: TerminalCarrierInventory | None = None
    active_issue: dict[str, Any] = field(default_factory=dict)
    repair_contract: dict[str, Any] = field(default_factory=dict)
    replan_signal: dict[str, Any] = field(default_factory=dict)
    terminal_decision: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.task_id = _required_text(self.task_id, field_name="task_id")
        self.requested_strategy = str(self.requested_strategy or "").strip()
        if self.requested_strategy not in _REQUESTED_STRATEGIES:
            raise ValueError(f"Unsupported requested AgentTask strategy: {self.requested_strategy}.")
        if self.effective_
```

### Core Architecture Module: `agently/builtins/plugins/AgentExecution/modules/lifecycle.py`
```
"""Owned run settlement and explicit control for every bundled producer."""

from __future__ import annotations

import asyncio
import concurrent.futures
import math
import time
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any, Literal, cast

from agently.core.application.AgentExecution.Control import AgentExecutionPaused
from agently.core.orchestration.TriggerFlow import TriggerFlow
from agently.types.data.agent_execution import AgentExecutionControlResult
from agently.types.trigger_flow import TriggerFlowRuntimeData

if TYPE_CHECKING:
    from .execution import AgentExecution


def _timeout(value: float | None) -> None:
    if value is not None and (
        isinstance(value, bool) or not math.isfinite(value) or value < 0
    ):
        raise ValueError("Execution control timeout must be finite and non-negative.")


def control_result(owner: AgentExecution) -> AgentExecutionControlResult:
    result = AgentExecutionControlResult(
        execution_id=owner.id,
        status=str(owner.status),
        closed=owner._closed,
    )
    if owner._pause_requested or owner._pause_boundary is not None:
        result["pause_requested"] = owner._pause_requested
        result["boundary"] = owner._pause_boundary
    return result


def _completion_waiter(completion: concurrent.futures.Future[Any]) -> asyncio.Future[Any]:
    waiter = asyncio.wrap_future(completion)

    def observe(future: asyncio.Future[Any]) -> None:
        # Timed-out shielded readers no longer await this local projection.
        # Retrieve its exception; the canonical future still raises it to every
        # subsequent reader and control call.
        if not future.cancelled():
            future.exception()

    waiter.add_done_callback(observe)
    return waiter


def _register_owned(owner: AgentExecution, create_run: Callable[[], Awaitable[Any]]) -> None:
    completion: concurrent.futures.Future[Any] = concurrent.futures.Future()
    owner._run_completion = completion
    owner._run_loop = asyncio.get_running_loop()

    async def produce() -> Any:
        return await create_run()

    task = owner._run_loop.create_task(produce())
    owner._run_task = task

    def settled(finished: asyncio.Task[Any]) -> None:
        try:
            value = finished.result()
        except BaseException as error:
            if not owner._started and isinstance(error, asyncio.CancelledError):
                owner._started = True
                owner._completed = True
                owner.status = "cancelled"
                owner._error = error
            completion.set_exception(error)
        else:
            completion.set_result(value)

    task.add_done_callback(settled)


async def run_owned(
    owner: AgentExecution,
    create_run: Callable[[], Awaitable[Any]],
) -> Any:
    # No await between admission and registration: same-loop readers cannot
    # create duplicate work. The concurrent Future carries settlement across
    # sync bridge loops without making a caller's subsequent work our resource.
    with owner._run_admission_lock:
        if owner.status == "paused":
            raise AgentExecutionPaused(owner.id, owner._pause_boundary or "unknown")
        if owner._run_completion is None:
            if owner._closed or owner._cancel_requested:
                if owner._error is not None:
                    raise owner._error
                raise RuntimeError("AgentExecution is closed and cannot start.")
            _register_owned(owner, create_run)
        shared = owner._run_completion
        assert shared is not None
    try:
        return await asyncio.shield(_completion_waiter(shared))
    except asyncio.CancelledError:
        # Preserve cancellation of the consuming run while ensuring that
        # caller cancellation cannot abandon owned provider/finally work.
        await cancel(owner, reason="run_consumer_cancelled", timeout=None)
        raise


async def _wait_settled(owner: AgentExecution, timeout: float | None) -> None:
    completion = owner._run_completion
    if completion is None:
        return
    waiter = _completion_waiter(completion)
    # A waiter timeout must not cancel the shared future or interrupt cleanup.
    shielded = asyncio.shield(waiter)
    try:
        if timeout is None:
            await shielded
        else:
            await asyncio.wait_for(shielded, timeout=timeout)
    except asyncio.CancelledError:
        if not completion.done() or not owner._cancel_requested:
            raise


async def cancel(
    owner: AgentExecution, *, reason: str, timeout: float | None,
) -> AgentExecutionControlResult:
    _timeout(timeout)
    if owner._run_task is asyncio.current_task():
        raise RuntimeError("An execution cannot await its own cancellation settlement.")
    deadline = time.monotonic() + timeout if timeout is not None else None
    if owner.status == "paused":
        # Finish the run which exposed the wait before replacing its settlement
        # handle. Cancellation of a persisted wait is itself owned work.
        try:
            await _wait_settled(owner, timeout)
        except AgentExecutionPaused:
            pass
        with owner._run_admission_lock:
            if owner.status == "paused":
                owner._cancel_requested = True
                owner._closing = True
                owner.status = "cancelling"
                _register_owned(owner, lambda: _cancel_pause(owner, reason))
        remaining = max(0.0, deadline - time.monotonic()) if deadline is not None else None
        await _wait_settled(owner, remaining)
        return control_result(owner)
    with owner._run_admission_lock:
        if owner._completed and (
            owner._run_completion is None or owner._run_completion.done()
        ):
            return control_result(owner)
        first_request = not owner._cancel_requested
        owner._cancel_requested = True
        owner._closing = True
        task = owner._run_task
        loop = owner._run_loop
        if task is None:
            owner._started = True
            owner._error = asyncio.CancelledError(reason)
            owner.status = "cancelled"
            owner._completed = True
    if task is None:
        await owner.close_streams()
    elif first_request and loop is not None:
        # Only the first cancel request delivers cancellation. Repeated callers
        # join the same settlement rather than cancelling a provider's finally.
        loop.call_soon_threadsafe(task.cancel, reason)
    await _wait_settled(owner, timeout)
    return control_result(owner)


async def _cancel_pause(owner: AgentExecution, reason: str) -> None:
    try:
        if owner._pause_flow is not None:
            await owner._pause_flow.async_close(reason=reason, pending_interrupts="cancel")
        from .route_execution import _finalize_terminal_execution

        owner._pause_requested = False
        owner.status = "cancelled"
        owner._error = asyncio.CancelledError(reason)
        await _finalize_terminal_execution(owner, terminal_status="cancelled")
        await owner.close_streams()
    except BaseException as error:
        owner._error = error
        owner.status = "error"
        raise
    finally:
        owner._completed = True
    raise asyncio.CancelledError(reason)


async def close(
    owner: AgentExecution, *, reason: str, timeout: float | None,
    pending: Literal["error", "cancel"],
) -> AgentExecutionControlResult:
    _timeout(timeout)
    if pending not in {"error", "cancel"}:
        raise ValueError("Execution close pending policy must be 'error' or 'cancel'.")
    if owner._run_task is asyncio.current_task():
        raise RuntimeError("An execution cannot await its own close settlement.")
    with owner._run_admission_lock:
        if owner._closed:
            return control_result(owner)
        if owner.status in {"paused", "waiting"} and pending == "error":
            raise RuntimeError("Execution has unresolved waits; resume or explicitly cancel them.")
        owner._closing = True
        if owner._run_completion is None and not owner._started:
            owner._started = True
            owner._completed = True
            owner._closed = True
            owner.status = "closed"
            owner._error = RuntimeError("AgentExecution was closed before production.")
    if pending == "cancel" and not owner._completed:
        await cancel(owner, reason=reason, timeout=timeout)
    else:
        await _wait_settled(owner, timeout)
    await owner.close_streams()
    owner._closed = True
    return control_result(owner)


async def _pause_node(data: TriggerFlowRuntimeData) -> object:
    owner = cast("AgentExecution", data.require_resource("agent_execution"))
    return await data.async_pause_for(
        type="agent_execution_pause",
        payload={"execution_id": owner.id, "boundary": owner._pause_boundary},
        interrupt_id="execution-pause",
        resume_to="next",
    )


async def _continue_node(data: TriggerFlowRuntimeData) -> None:
    owner = cast("AgentExecution", data.require_resource("agent_execution"))
    continuation = owner._paused_continuation
    if continuation is None:
        raise RuntimeError("Execution continuation dependency was not rebound.")
    owner._continued_result = await continuation()


def pause_flow() -> TriggerFlow[Any, Any, Any]:
    flow: TriggerFlow[Any, Any, Any] = TriggerFlow(name="agent-execution-safe-pause")
    flow.to(_pause_node).to(_continue_node)
    return flow


async def pause_at(
    owner: AgentExecution,
    boundary: Literal["before_production", "candidate_ready", "long_task_step"],
    continuation: Callable[[], Awaitable[tuple[str, object]]],
) -> None:
    if not owner._pause_requested:
        return
    owner._pause_boundary = boundary
    owner._paused_continuation = continuation
    owner._pause_flow = pause_flow().create_execution(
        auto_close=False,
        record_store=owner.record_sto
```

### Core Architecture Module: `agently/builtins/plugins/AgentExecution/modules/state.py`
```
# Copyright 2023-2026 AgentEra(Agently.Tech)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TYPE_CHECKING

from agently.types.options import normalize_execution_options
from agently.utils import DataFormatter

if TYPE_CHECKING:
    from agently.types.data import AgentExecutionEffort

    from .execution import AgentExecution

_TASK_ROUTE_STRATEGIES = {"task", "task_loop", "long_task"}
_AGENT_EXECUTION_AUTO_STRATEGY = "auto"
_AGENT_EXECUTION_DIRECT_STRATEGY = "direct"


class ExecutionOptionsState(dict):
    """Callable dict preserving AgentExecution.options(...) compatibility."""

    def __init__(self, owner: "AgentExecution", initial: dict[str, Any]):
        super().__init__(initial)
        self._owner = owner

    def __call__(self, options: dict[str, Any], *, always: bool = False):
        if always:
            self._owner.agent.options(options, always=True)
            return self._owner
        self._owner.configure_options(options)
        return self._owner


def normalize_options_state(owner: "AgentExecution", options: Any) -> ExecutionOptionsState:
    return ExecutionOptionsState(owner, normalize_execution_options(options))


def configure_execution_options(owner: "AgentExecution", options: Any):
    normalized = normalize_execution_options(options)
    deep_merge(owner.options, normalized)
    load_strategy_state_from_options(owner)
    owner.effective_options = build_effective_options(owner)
    apply_effort_strategy_limits(owner)
    owner.effective_options = build_effective_options(owner)
    return owner


def load_strategy_state_from_options(owner: "AgentExecution"):
    strategy = owner.options.get("strategy")
    if strategy is None:
        execution_options = owner.options.get("execution")
        if isinstance(execution_options, dict):
            strategy = execution_options.get("strategy")
    if strategy is not None:
        apply_strategy_selection(owner, strategy, source="execution_options")

    task_options = owner.options.get("task")
    if isinstance(task_options, dict):
        # Semantic fields are consumed into the Prompt once. Keeping another
        # mutable copy here would reapply stale goals on unrelated configure().
        controls = dict(task_options)
        goal = controls.pop("goal", controls.pop("goals", None))
        criteria = controls.pop("success_criteria", None)
        generated = controls.pop("generated_success_criteria", None)
        owner.options["task"] = controls
        owner.task_options.update(controls)
        if "execution" in task_options:
            owner.task_options["execution"] = normalize_task_execution_strategy(task_options.get("execution"))
            owner.task_options.setdefault("_execution_strategy_source", "task_options")
        lifecycle_options = owner.options.get("execution")
        enabled = lifecycle_options.get("turn_on_long_task") if isinstance(lifecycle_options, dict) else None
        enabled = True if enabled is None else enabled
        if goal is not None:
            owner.goal(goal, criteria, turn_on_long_task=enabled)
        elif criteria is not None:
            set_success_criteria(owner, criteria)
            owner._goal_turn_on_long_task = enabled
        if isinstance(generated, list):
            owner.generated_success_criteria = list(generated)
    lifecycle_options = owner.options.get("execution")
    if isinstance(lifecycle_options, dict) and lifecycle_options.get("turn_on_long_task") is not None:
        owner._goal_turn_on_long_task = lifecycle_options["turn_on_long_task"]


def build_effective_options(owner: "AgentExecution") -> dict[str, Any]:
    effective = dict(owner.options)
    execution_options = effective.get("execution")
    execution_options = dict(execution_options) if isinstance(execution_options, dict) else {}
    execution_options.update(
        {
            "lineage": owner.lineage,
            "limits": owner.limits,
            "turn_on_long_task": owner._goal_turn_on_long_task,
        }
    )
    if owner.strategy_name is not None:
        execution_options.setdefault("strategy", owner.strategy_name)
    effective["execution"] = execution_options
    if owner.strategy_name is not None:
        effective.setdefault("strategy", owner.strategy_name)
    effort = effective.get("effort")
    if effort is not None:
        effort_name, effort_detail = normalize_effort_configuration(
            effort,
            effective.get("effort_strategy"),
        )
        effective["effort"] = effort_name
        effective["effort_strategy"] = resolve_effort_strategy(effort_name, effort_detail)
    required_actions = owner.required_action_ids()
    required_skills = owner.required_skill_ids()
    if required_actions or required_skills:
        constraints = dict(effective.get("capability_constraints") or {})
        if required_actions:
            actions = dict(constraints.get("actions") or {})
            actions["required"] = required_actions
            constraints["actions"] = actions
        if required_skills:
            skills = dict(constraints.get("skills") or {})
            skills["required"] = required_skills
            constraints["skills"] = skills
        effective["capability_constraints"] = constraints
    if owner.goal_items or owner.success_criteria_items or owner.task_options:
        effective["task"] = {
            **dict(owner.task_options),
            "goals": list(owner.goal_items),
            "success_criteria": list(owner.success_criteria_items),
            "generated_success_criteria": list(owner.generated_success_criteria),
        }
    return effective


def normalize_task_execution_strategy(value: Any) -> str:
    from ..long_task import AgentTask

    return str(AgentTask.normalize_execution_strategy(value))


def is_task_execution_strategy_value(value: Any) -> bool:
    try:
        normalize_task_execution_strategy(value)
    except (TypeError, ValueError):
        return False
    return True


def _clear_task_execution_selection(owner: "AgentExecution") -> None:
    owner.task_options.pop("execution", None)
    owner.task_options.pop("_execution_strategy_source", None)


def apply_strategy_selection(owner: "AgentExecution", value: Any, *, source: str) -> bool:
    text = str(value if value is not None else "").strip()
    if not text:
        return False
    normalized_text = text.lower().replace("-", "_")

    if normalized_text == _AGENT_EXECUTION_DIRECT_STRATEGY:
        owner.strategy_name = _AGENT_EXECUTION_DIRECT_STRATEGY
        owner.options["strategy"] = _AGENT_EXECUTION_DIRECT_STRATEGY
        _clear_task_execution_selection(owner)
        return True

    if normalized_text == _AGENT_EXECUTION_AUTO_STRATEGY:
        owner.strategy_name = _AGENT_EXECUTION_AUTO_STRATEGY
        owner.options["strategy"] = _AGENT_EXECUTION_AUTO_STRATEGY
        _clear_task_execution_selection(owner)
        return True

    if normalized_text in _TASK_ROUTE_STRATEGIES:
        owner.strategy_name = normalized_text
        owner.options["strategy"] = normalized_text
        _clear_task_execution_selection(owner)
        return True

    try:
        execution_strategy = normalize_task_execution_strategy(text)
    except (TypeError, ValueError):
        owner.strategy_name = text
        owner.options["strategy"] = text
        return False

    owner.strategy_name = execution_strategy
    owner.options["strategy"] = execution_strategy
    owner.task_options["execution"] = execution_strategy
    owner.task_options["_execution_strategy_source"] = source
    return True


def configure_effort(
    owner: "AgentExecution",
    value: "AgentExecutionEffort" = "medium",
    **strategy: object,
) -> "AgentExecution":
    name, detail = normalize_effort_configuration(value, strategy)
    owner.options["effort"] = name
    if detail:
        owner.options["effort_strategy"] = detail
    else:
        owner.options.pop("effort_strategy", None)
    owner.effective_options = build_effective_options(owner)
    apply_effort_strategy_limits(owner)
    owner.effective_options = build_effective_options(owner)
    owner._selected_route = None
    return owner


def normalize_effort_configuration(
    effort: Any = "medium",
    detail: Any = None,
) -> tuple[str, dict[str, Any]]:
    details: dict[str, Any] = {}
    if isinstance(effort, Mapping):
        source = dict(effort)
        name = source.pop("name", None)
        if name is None:
            name = source.pop("preset", None)
        if name is None:
            name = source.pop("level", None)
        if name is None:
            name = "medium"
        details = _copy_effort_mapping(source)
    else:
        name = effort if effort is not None else "medium"

    if isinstance(detail, Mapping):
        deep_merge(details, _copy_effort_mapping(detail))
    elif detail is not None:
        details["detail"] = detail

    effort_name = str(name or "medium").strip().lower() or "medium"
    return effort_name, details


def resolve_effort_strategy(effort: Any, detail: Any = None) -> dict[str, Any]:
    name, detail_map = normalize_effort_configuration(effort, detail)
    presets: dict[str, dict[str, Any]] = {
        "minimal": {
            "planning_depth": "shallow",
            "verifier_strength": "standard",
            "reflection_density": "final",
        },
        "low": {
            "planning_depth": "shallow",
         
```

### Core Architecture Module: `agently/builtins/plugins/AgentExecution/modules/structured_continuation_state.py`
```
"""Private field-local state for lossless structured-string continuation."""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, create_model

from agently.core.model import Prompt
from agently.utils import StreamingJSONParser

from . import long_output as native


@dataclass
class Slot:
    key: str
    path: tuple[str | int, ...]
    contract: dict[str, Any]
    model: type[BaseModel] | None


class Update(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    value: Any
    is_complete: bool


def escape_matches(pending, text):
    """JSON lexical compatibility, not a guess about missing business text."""
    if not pending:
        return True
    if not text:
        return False
    char = text[0]
    spellings = [json.dumps(char, ensure_ascii=True)[1:-1]]
    if ord(char) <= 0xFFFF:
        spellings.append("\\u%04x" % ord(char))
    if char == "/":
        spellings.append("\\/")
    return any(spelling.lower().startswith(pending.lower()) for spelling in spellings)


class StructuredContinuationState:
    """Host path/field state only; one request still owns semantic continuation."""

    def __init__(self, owner, raw):
        self.owner = owner
        self.schema = owner.output_schema
        self.structured = owner.structured
        self.closed = set()
        self.pending = {}
        self.registry = {}
        self.slots = []
        self.offered = None
        self.revision = 0
        if self.structured and self.schema is str:
            from pydantic import RootModel

            self.original_model = RootModel[str]
        else:
            self.original_model = (
                owner.validation_prompt.to_output_model(strict_output=True)
                if self.structured
                else None
            )
        if (
            self.original_model
            and getattr(self.original_model, "__pydantic_root_model__", False)
            and isinstance(self.schema, dict)
        ):
            self.schema = self.schema["root"]
        if not self.structured:
            self.state = raw
            self.schema = str
        else:
            evidence = StreamingJSONParser._inspect_json_prefix(raw)
            declaration, _ = native._unwrap_output_declaration(self.schema)
            self.state = (
                []
                if isinstance(declaration, list)
                else {}
                if isinstance(declaration, dict)
                else ""
            )
            # Do not copy parents over children twice, but preserve empty containers.
            for path, value in sorted(
                evidence.closed.items(), key=lambda pair: len(pair[0])
            ):
                self.state = native._set_path(self.state, path, deepcopy(value))
                self.closed.add(path)
            if evidence.open_string_path is not None:
                self.state = native._set_path(
                    self.state, evidence.open_string_path, evidence.decoded_prefix
                )
                if evidence.pending_escape:
                    self.pending[evidence.open_string_path] = evidence.pending_escape
        self._refresh()

    def _slot(self, declaration, path):
        if path in self.closed:
            return
        if path not in self.registry:
            model = Prompt(
                self.owner.request.plugin_manager,
                self.owner.request.settings,
                prompt_dict={"output": {"value": declaration}, "output_format": "json"},
                name="ContinuationFieldContract",
            ).to_output_model(strict_output=True)
            self.registry[path] = Slot(
                f"p{len(self.registry)}:{native._path_to_dot(path) or '$'}",
                path,
                native.output_schema_to_json_schema(declaration, strict_output=True),
                model,
            )
        self.slots.append(self.registry[path])

    def _complete(self, declaration, path):
        if path in self.closed:
            return True
        if isinstance(declaration, tuple) and len(declaration) > 3:
            contract = declaration[3].get(native.PYDANTIC_CONTRACT_META_KEY, {})
            missing = object()
            if (
                contract.get("required") is False
                and native._get_path(self.state, path, missing) is missing
            ):
                return True
        declared, _ = native._unwrap_output_declaration(declaration)
        if isinstance(declared, dict):
            return all(
                self._complete(child, (*path, name)) for name, child in declared.items()
            )
        if isinstance(declared, list):
            value = native._get_path(self.state, path)
            if not isinstance(value, list):
                return False
            return all(
                self._complete(declared[0], (*path, index))
                for index in range(len(value))
            )
        return path in self.closed

    def _discover(self, declaration, path):
        if path in self.closed:
            return
        declared, constraints = native._unwrap_output_declaration(declaration)
        if isinstance(declared, dict):
            if not declared:
                self._slot(declaration, path)
            for name, child in declared.items():
                self._discover(child, (*path, name))
        elif isinstance(declared, list):
            value = native._get_path(self.state, path, [])
            if not isinstance(value, list):
                raise ValueError("Array prefix has wrong type")
            maximum = constraints.get("maxItems")
            if maximum is not None and len(value) > maximum:
                raise ValueError("Array prefix exceeds original maximum")
            if native._get_path(self.state, path) is None:
                self._slot(declaration, path)
            partial = False
            for index in range(len(value)):
                if not self._complete(declared[0], (*path, index)):
                    if index != len(value) - 1:
                        raise ValueError("Non-tail incomplete array item")
                    self._discover(declared[0], (*path, index))
                    partial = True
            if not partial and (maximum is None or len(value) < maximum):
                # Only the next index is offered, never sparse future positions.
                self._discover(declared[0], (*path, len(value)))
        else:
            self._slot(declaration, path)

    def _refresh(self):
        self.slots = []
        self._discover(self.schema, ())
        for slot in self.slots:
            current = native._get_path(self.state, slot.path)
            maximum = slot.contract.get("maxLength")
            if (
                isinstance(current, str)
                and maximum is not None
                and len(current) > maximum
            ):
                raise ValueError("Initial prefix exceeds original maximum")

    def _text_contract(self, slot):
        if slot.contract.get("type") == "string":
            return slot.contract
        if isinstance(native._get_path(self.state, slot.path), str):
            for branch in slot.contract.get("anyOf", []):
                if branch.get("type") == "string":
                    return branch
        return None

    def offer(self):
        """Freeze the next authorized slots without constructing a model request."""
        self._refresh()
        self.offered = (
            self.revision,
            native._sha256_text(native._canonical_json(self.snapshot())),
            list(self.slots),
        )

    def request(self):
        self.offer()
        context = deepcopy(self.state)
        fields = {}
        for slot in self.slots:
            current = native._get_path(self.state, slot.path)
            text = self._text_contract(slot) is not None
            fields[slot.key] = {
                "value_contract": slot.contract,
                "operation": "append_text" if text else "set_value",
            }
            if slot.contract.get("type") == "array":
                fields[slot.key]["operation"] = "initialize_array"
            if text:
                fields[slot.key]["accepted_prefix"] = (
                    current if isinstance(current, str) else ""
                )
                if current is not None:
                    context = native._set_path(
                        context, slot.path, {"content_location": "input.fields"}
                    )
                if slot.path in self.pending:
                    fields[slot.key]["pending_json_escape"] = self.pending[slot.path]
        request = self.owner.execution.agent.create_request(
            name="StructuredStringContinuation",
            inherit_agent_prompt=False,
            inherit_extension_handlers=False,
            model_key=getattr(self.owner.request, "_model_key", None),
        )
        local_settings = self.owner.request.settings.get(inherit=False)
        if isinstance(local_settings, dict):
            request.settings.update(deepcopy(local_settings))
        request.prompt.update(deepcopy(self.owner.prompt_snapshot))
        request.prompt.set("tools", None)
        request.prompt.set("action_results", None)
        request.input(
            {
                "original_input": self.owner.prompt_snapshot.get("input"),
                "completed_context": context,
                "fields": fields,
            }
        )
        request.info(
            {
                "original_deliverable_instructions": self.owner.prompt_snapshot.get(
                    "instruct"
                )
            }
        )
        request.prompt.set(
            "instruct",
            [
                "Continue the current deliverable in [input.original_input], following [info.original_deliverable_instructions]. Original output references na
```

### Core Architecture Module: `agently/builtins/plugins/AgentExecution/modules/task_loop.py`
```
"""Goal pursuit using one editable checklist and the existing execution owners."""
from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from typing import TYPE_CHECKING, Any, Literal, cast

from agently.core.application.AgentExecution import AgentExecutionLimitExceeded
from agently.core.orchestration import TriggerFlow
from agently.types.trigger_flow import TriggerFlowRuntimeData
from agently.utils import DataFormatter

from .model_stage import run_model_stage
from .revisions import content_digest
from .runtime_guidance import insert_pending_guidance

if TYPE_CHECKING:
    from .execution import AgentExecution
    from agently.core.operation.Action import Action


_INSTRUCTION = """Advance the original task using the current checklist and actual observations.
The taskboard is an editable Markdown checklist. Add, remove, split, merge, reorder, check or reopen items as needed. New findings may add work; simple tasks need no checklist. Editing it does not change the original goal or required deliverables.
One action may advance several items; one item may require several rounds. Select only offered actions with their declared arguments. Calls within a batch must be independent; await actual results before deciding dependent calls. Plans and checkmarks are not evidence that actions succeeded.
Return continue when more work is possible, completed when the original task and required deliverables are fulfilled, or blocked when required information or available capabilities prevent further progress. Disclosing a missing requirement does not fulfill it; permitted template blanks do not imply failure.
Keep taskboard null to retain it. Return the current useful result or null while continuing, and the full useful result at termination. When applicable, explain unfinished work, uncertainties to check, actual consequences and information needed. Do not invent completion percentages or causes of failure.
Terminal decisions must have no action_calls: an operation cannot be declared complete before execution. Preserve usable work when blocked. Return result in the caller's declared output shape."""


def _store(owner: AgentExecution, state: dict[str, Any]) -> None:
    owner._producer_state = {"kind": "task_loop", "content": state, "digest": content_digest(state)}


def _state(owner: AgentExecution) -> dict[str, Any]:
    retained = owner._producer_state
    if retained.get("kind") != "task_loop":
        state: dict[str, Any] = {
            "taskboard": "", "rounds": 0, "observations": [], "result": None,
            "status": "continue", "succeeded_actions": [], "revision": owner.revision,
        }
        _store(owner, state)
        return state
    if retained.get("digest") != content_digest(retained.get("content")):
        raise ValueError("Retained long-task state changed outside its execution owner.")
    return deepcopy(retained["content"])


async def prepare_rework(owner: AgentExecution) -> None:
    state = _state(owner)
    if state["revision"] != owner.revision:
        state["status"] = "continue"
        state["revision"] = owner.revision
        _store(owner, state)
    owner._review_contract["rework_feedback"] = owner._rework_feedback


def _decision(value: object, offered: set[str]) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError("Long-task decision must be a mapping.")
    decision = dict(value)
    if decision.get("status") not in {"continue", "completed", "blocked"}:
        raise ValueError("Invalid long-task status.")
    if decision.get("taskboard") is not None and not isinstance(decision["taskboard"], str):
        raise ValueError("Taskboard must be text or null.")
    calls = decision.get("action_calls")
    if not isinstance(calls, list):
        raise ValueError("Long-task action_calls must be a list.")
    for call in calls:
        if (not isinstance(call, dict) or call.get("action_id") not in offered
                or not isinstance(call.get("action_input"), dict)):
            raise ValueError("Long-task call must name an offered Action and mapping arguments.")
    if decision["status"] != "continue" and (calls or decision.get("result") is None):
        raise ValueError("Terminal decisions require a result and no pending Actions.")
    return decision


async def run_task_loop(owner: AgentExecution) -> dict[str, Any]:
    """Run a settled sequence; outer execution owns cancellation and safe pauses."""
    from .task_strategy import _resolve_required_skill_availability

    _, skill_failure = await _resolve_required_skill_availability(owner, goal=owner.task_goal())
    if skill_failure is not None:
        owner.status = "blocked"
        return {"status": "blocked", "accepted": False, "final_result": None,
                "reason": "Required Skills are unavailable.", "required_capabilities": skill_failure}

    state = _state(owner)
    task_options = owner.task_strategy_options()
    max_rounds = task_options.get("max_iterations", 20)
    if max_rounds is None:
        max_rounds = 20
    if isinstance(max_rounds, bool) or not isinstance(max_rounds, int) or max_rounds < 1:
        raise ValueError("Long-task max_iterations must be a positive integer.")
    options = task_options.get("options") or {}
    task_settings = options.get("agent_task", {}) if isinstance(options, Mapping) else {}
    paths = task_settings.get("required_deliverables", [])
    if not isinstance(paths, list) or any(not isinstance(path, str) or not path for path in paths):
        raise ValueError("required_deliverables must contain non-empty paths.")
    candidates = owner.action_candidates()
    offered = {str(spec.get("action_id") or spec.get("name")) for spec in candidates}
    action = cast("Action", getattr(owner.agent, "action"))
    actions = action._to_model_planning_action_list(candidates)
    output = owner.request.prompt.get("output") or str
    schema = {
        "taskboard": (str, "Complete revised Markdown checklist, or null to keep it.", False),
        "status": (Literal["continue", "completed", "blocked"], "Original task's current status."),
        "action_calls": [{"action_id": str, "action_input": dict}],
        "result": (output, "Full useful result in the original output shape; null while work continues.", False),
    }
    required = set(owner.required_action_ids())
    flow: TriggerFlow[Any, Any, Any] = TriggerFlow(name="long-task-loop")
    error: list[BaseException] = []
    paused = False

    async def decide(data: TriggerFlowRuntimeData) -> None:
        nonlocal state, paused
        try:
            if owner._pause_requested:
                paused = True
                return
            if state["rounds"] >= max_rounds:
                raise AgentExecutionLimitExceeded("Long-task round limit reached before completion.",
                    limit_name="max_iterations", limit_value=max_rounds, used=state["rounds"])
            state["rounds"] += 1
            _store(owner, state)
            await insert_pending_guidance(owner)
            for reader in owner.context_readers.values():
                if not reader.is_current:
                    reader.refresh()
            stage = await run_model_stage(
                owner, producer="long_task", stage="decide",
                stage_input={"goals": owner.goal_items, "success_criteria": owner.success_criteria_items},
                stage_info={"taskboard": state["taskboard"], "observations": state["observations"],
                    "current_result": state["result"], "available_actions": actions,
                    "required_actions": sorted(required), "required_deliverables": paths,
                    "feedback": owner._rework_feedback if owner.revision else None},
                stage_instructions=[_INSTRUCTION], output=schema, inherit_extension_handlers=False,
            )
            decision = _decision(stage.value, offered)
            if decision.get("taskboard") is not None:
                state["taskboard"] = decision["taskboard"]
            if decision.get("result") is not None:
                state["result"] = decision["result"]
            state["status"] = decision["status"]
            if state["status"] == "completed":
                failures: list[dict[str, Any]] = []
                missing = required - set(state["succeeded_actions"])
                if missing:
                    failures.append({"required_actions_not_succeeded": sorted(missing)})
                refs: list[dict[str, Any]] = []
                for path in paths:
                    try:
                        workspace = owner.task_workspace
                        if workspace.resolve_file_path(path) != workspace.resolve_path(path):
                            raise ValueError("File exists only at a fallback path, not the required destination.")
                        read = await workspace.read_file(path)
                        if not read.readable:
                            raise ValueError("Required file cannot be read with the configured file handler.")
                        refs.append({"type": "file", "path": read.path, "sha256": read.sha256,
                            "size": read.total_bytes, "task_workspace_id": read.task_workspace_id,
                            "execution_id": read.execution_id, "role": "deliverable"})
                    except (OSError, ValueError) as failure:
                        failures.append({"path": path, "error": str(failure)})
                owner._terminal_task_handoff_refs = refs
                if failures:
                    state["status"] = "continue"
                    state["observations"].append({"source": "required_delivery", "status": "error",
                        "result": failures})
            _store(owner, state)
            await owner.emit_stream("long_task.progress", {"taskboard": state["taskboard"],
                "status": state["status"], "round": state["rounds"]}, route="agent_t
```

### Core Architecture Module: `agently/core/Agent.py`
```
# Copyright 2023-2026 AgentEra(Agently.Tech)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from agently_stage import default_stage_call_bridge

import json
import os
import uuid

from collections.abc import Mapping
from typing import Any, AsyncGenerator, Generator, Sequence, TYPE_CHECKING, Literal, cast
from typing_extensions import Self, overload

from agently.core.extension import ExtensionHandlers
from agently.core.application import AgentTask, DynamicTask
from agently.core.model.AttachmentInput import ImageDetail, build_image_attachment
from agently.core.model import ModelRequest, Prompt, _resolve_quick_prompt_input, _UNSET
from agently.core.model.ModelRequestResult import DEFAULT_SPECIFIC_EVENTS
from agently.core.runtime import resolve_parent_run_context
from agently.core.TaskWorkspace import TaskWorkspace
from agently.utils import DataFormatter, Settings
from agently.utils.LanguagePolicy import apply_language_policy_to_prompt, resolve_language_policy

if TYPE_CHECKING:
    from collections.abc import AsyncIterator
    from contextlib import AbstractAsyncContextManager
    from agently.types.data.audio import SpeechOptions, SpeechResult, TextSegmentOptions
    from agently.core import PluginManager
    from agently.types.data import (
        AgentExecutionLineage,
        AgentExecutionLimits,
        AgentExecutionEffort,
        AgentExecutionStrategy,
        AgentArtifactHandler,
        AgentInteractionHandler,
        AgentReviewHandler,
        AgentlyModelResultMessage,
        AgentlyOriginalResultPayload,
        AgentlySpecificResultMessage,
        InstantStreamingContentType,
        OutputValidateHandler,
        PromptStandardSlot,
        ChatMessage,
        ChatMessageDict,
        ResultContentType,
        RunContext,
        SerializableValue,
        SpecificEvents,
        StreamingData,
        TaskDAG,
    )
    from agently.types.config import AgentlyConfigModel
    from agently.core.model import ModelRequestResult
    from agently.types.options import ExecutionOptions
    from agently.types.plugins import AgentExecution


class _AgentDefinitionBuilder:
    def __init__(self, agent: "BaseAgent") -> None:
        self._agent = agent

    def __getattr__(self, name: str) -> Any:
        return getattr(self._agent, name)

    def activate_model(self, model_key: str | None = None) -> Self:
        self._agent.activate_model(model_key)
        return self

    def set_settings(self, *args: Any, **kwargs: Any) -> Self:
        self._agent.set_settings(*args, **kwargs)
        return self

    def use_task_workspace(self, *args: Any, **kwargs: Any) -> Self:
        cast(Any, self._agent).use_task_workspace(*args, **kwargs)
        return self

    def configure_policy_approval(self, *args: Any, **kwargs: Any) -> Self:
        self._agent.configure_policy_approval(*args, **kwargs)
        return self

    def set_agent_prompt(
        self,
        key: "PromptStandardSlot | str",
        value: Any,
        *,
        mappings: dict[str, Any] | None = None,
    ) -> Self:
        self._agent.set_agent_prompt(key, value, mappings=mappings)
        return self

    def system(self, prompt: Any, *, mappings: dict[str, Any] | None = None) -> Self:
        self._agent.system(prompt, mappings=mappings, always=True)
        return self

    def rule(self, prompt: Any, *, mappings: dict[str, Any] | None = None) -> Self:
        self._agent.rule(prompt, mappings=mappings, always=True)
        return self

    def role(self, *args: Any, **kwargs: Any) -> Self:
        kwargs["always"] = True
        self._agent.role(*args, **kwargs)
        return self

    def user_info(self, *args: Any, **kwargs: Any) -> Self:
        kwargs["always"] = True
        self._agent.user_info(*args, **kwargs)
        return self

    def input(self, *args: Any, **kwargs: Any) -> Self:
        kwargs["always"] = True
        self._agent.input(*args, **kwargs)
        return self

    def info(self, *args: Any, **kwargs: Any) -> Self:
        kwargs["always"] = True
        self._agent.info(*args, **kwargs)
        return self

    def instruct(self, *args: Any, **kwargs: Any) -> Self:
        kwargs["always"] = True
        self._agent.instruct(*args, **kwargs)
        return self

    def examples(self, *args: Any, **kwargs: Any) -> Self:
        kwargs["always"] = True
        self._agent.examples(*args, **kwargs)
        return self

    def output(self, *args: Any, **kwargs: Any) -> Self:
        kwargs["always"] = True
        self._agent.output(*args, **kwargs)
        return self

    def attachment(self, *args: Any, **kwargs: Any) -> Self:
        kwargs["always"] = True
        self._agent.attachment(*args, **kwargs)
        return self

    def image(self, *args: Any, **kwargs: Any) -> Self:
        kwargs["always"] = True
        self._agent.image(*args, **kwargs)
        return self

    def options(self, options: dict[str, Any]) -> Self:
        self._agent.options(options, always=True)
        return self

    def language(self, *args: Any, **kwargs: Any) -> Self:
        self._agent.language(*args, **kwargs)
        return self


class BaseAgent:
    def __init__(
        self,
        plugin_manager: "PluginManager",
        *,
        parent_settings: "Settings | None" = None,
        name: str | None = None,
    ) -> None:
        self.id = uuid.uuid4().hex
        self.name = name if name is not None else self.id[:7]

        self.plugin_manager = plugin_manager
        self.__agent_capabilities: dict[str, object] = {}
        self.settings = Settings(
            name=f"Agent-{ self.name }-Settings",
            parent=parent_settings,
        )
        self.agent_prompt = Prompt(
            name=f"Agent-{ self.name }-Prompt",
            plugin_manager=self.plugin_manager,
            parent_settings=self.settings,
        )
        self.extension_handlers = ExtensionHandlers(
            {
                "request_prefixes": [],
                "broadcast_prefixes": [],
                "broadcast_suffixes": {},
                "finally": [],
                "validate_handlers": [],
            },
            name=f"Agent-{ self.name }-ExtensionHandlers",
        )
        self._active_model_key: str | None = None
        self.request = ModelRequest(
            agent_name=self.name,
            agent_id=self.id,
            plugin_manager=self.plugin_manager,
            parent_settings=self.settings,
            parent_prompt=self.agent_prompt,
            parent_extension_handlers=self.extension_handlers,
        )
        self.request_prompt = self.request.prompt
        self.prompt = self.request_prompt

        self.load_settings = self.settings.load

    def set_settings(
        self,
        key: "str | AgentlyConfigModel",
        value: "SerializableValue | object" = _UNSET,
        *,
        auto_load_env: bool = False,
        raise_empty: bool = False,
    ) -> Self:
        if value is _UNSET:
            self.settings.set_settings(
                key,
                auto_load_env=auto_load_env,
                raise_empty=raise_empty,
            )
        else:
            self.settings.set_settings(
                key,
                value,
                auto_load_env=auto_load_env,
                raise_empty=raise_empty,
            )
        return self

    def configure_policy_approval(self, *, handler: str | None = None) -> Self:
        if handler is not None:
            self.settings.set("policy_approval.handler", str(handler))
        return self

    def language(
        self,
        language: Any = "auto",
        *,
        output: Any = None,
        process: Any = None,
        progress: Any = None,
        accept_language: Any = None,
    ) -> Self:
        policy = resolve_language_policy(
            language,
            output_language=output,
            process_language=process,
            progress_language=progress,
            accept_language=accept_language,
        )
        self.settings.set("agent.language_policy", cast(Any, dict(policy)))
        self.settings.set("agent_task.progress.language", policy.get("progress_language", policy.get("language", "auto")))
        apply_language_policy_to_prompt(self.agent_prompt, policy)
        return self

    def activate_model(self, model_key: str | None = None) -> Self:
        """Set the default model key for subsequent Agent-owned requests.

        The model key is resolved through the existing model_pool /
        key_pool_strategy / key_pool settings when a request is consumed.
        A configured non-empty model_pool rejects unknown aliases at that point.
        Passing None clears the active model key.
        """
        if model_key is None:
            self._active_model_key = None
            self.request._model_key = None
            return self
        normalized = str(model_key).strip()
        if not normalized:
            raise ValueError("activate_model(...) requires a non-empty model_key, or None to clear it.")
        self._active_model_key = normalized
        self.request._model_key = normalized
        return self

    def define(
        self,
        *,
        model: str | None = None,
        prompt: Mapping[str, Any] | Any | None = None,
        actions: Any = None,
        skills: Any = None,
        task_workspace: str | os.PathLike[str] | None = None,
        policy: Mapping[str, Any] | None = None,
        settings: Mapping[str, Any] | None = None,
        **kwargs: Any,
```

### Core Architecture Module: `agently/core/TaskWorkspace/ContextSource.py`
```
# Copyright 2023-2026 AgentEra(Agently.Tech)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import hashlib
from collections import OrderedDict
from collections.abc import Mapping
from dataclasses import replace
from typing import Any, cast

from agently.types.data import (
    ContextSourceDescriptor,
    ContextSourceDescriptorPage,
    ContextSourceRead,
    TaskWorkspaceFileRead,
    TaskWorkspaceFileInfo,
)

from .TaskWorkspace import TaskWorkspace
from .FileIO import DefaultTextTaskWorkspaceFileIOHandler


class TaskWorkspaceContextSource:
    """Structural descriptor and exact-read port for TaskWorkspace files."""

    source_kind = "task_workspace"

    def __init__(self, task_workspace: TaskWorkspace) -> None:
        self.task_workspace = task_workspace
        root_digest = hashlib.sha256(str(task_workspace.root).encode("utf-8")).hexdigest()[:16]
        self.source_id = f"task-workspace:{root_digest}:{task_workspace.execution_id}"
        self._observations: dict[str, tuple[tuple[object, ...], dict[str, object]]] = {}
        self._reads: OrderedDict[str, TaskWorkspaceFileRead] = OrderedDict()
        self._read_bytes = 0
        self._handlers: tuple[tuple[str, int], ...] = ()

    def _stamp(self, relative: str) -> tuple[object, ...]:
        # Resolve again even on cache hits: a changed symlink cannot reuse an
        # observation from a previously contained file.
        path = self.task_workspace.resolve_file_path(relative)
        stat = path.stat()
        return (str(path), stat.st_dev, stat.st_ino, stat.st_size,
                stat.st_mtime_ns, stat.st_ctime_ns, stat.st_mode)

    def _discard_read(self, relative: str) -> None:
        previous = self._reads.pop(relative, None)
        if previous is not None:
            self._read_bytes -= len(previous.data)

    def _observe(self, relative: str) -> dict[str, object]:
        stamp = self._stamp(relative)
        previous = self._observations.get(relative)
        if previous is not None and previous[0] == stamp:
            return previous[1]
        self._discard_read(relative)
        info = self.task_workspace.inspect_file(relative)
        if self._stamp(relative) != stamp:
            raise ValueError("TaskWorkspace file changed during inspection.")
        self._observations[relative] = (stamp, info)
        return info

    async def _read(self, relative: str, *, max_bytes: int, offset: int = 0) -> TaskWorkspaceFileRead:
        if max_bytes <= 0 or offset < 0:
            raise ValueError("Read size must be positive and offset non-negative.")
        info = self._observe(relative)
        registry = self.task_workspace._file_io_registry
        handlers = tuple((key, id(value)) for key, value in registry._handlers.items())
        if handlers != self._handlers:
            self._reads.clear()
            self._read_bytes = 0
            self._handlers = handlers
        selected = registry._select(operation="read", file_info=cast(TaskWorkspaceFileInfo, info))
        if type(selected) is not DefaultTextTaskWorkspaceFileIOHandler:
            self._discard_read(relative)
        cached = self._reads.get(relative)
        if cached is not None:
            self._reads.move_to_end(relative)
            segment = cached.data[offset:offset + max_bytes]
            content = segment.decode("utf-8", errors="ignore")
            return replace(cached, content=content, data=content.encode("utf-8"),
                           offset=offset, truncated=len(cached.data) > offset + max_bytes)
        stamp = self._observations[relative][0]
        readback = await self.task_workspace.read_file(relative, max_bytes=max_bytes, offset=offset)
        if self._stamp(relative) != stamp or readback.sha256 != info.get("sha256"):
            self._observations.pop(relative, None)
            raise ValueError("TaskWorkspace file changed during read.")
        if (type(selected) is DefaultTextTaskWorkspaceFileIOHandler
                and readback.readable and not readback.truncated and offset == 0
                and readback.encoding == "utf-8" and len(readback.data) <= 20_000):
            self._discard_read(relative)
            self._reads[relative] = readback
            self._read_bytes += len(readback.data)
            while len(self._reads) > 1024 or self._read_bytes > 1_048_576:
                self._discard_read(next(iter(self._reads)))
        return readback

    def _logical_paths(self) -> tuple[str, ...]:
        logical: set[str] = set()
        for relative in self.task_workspace.list_files():
            target = self.task_workspace.root / relative
            parts = self.task_workspace._logical_file_parts(target)
            if parts:
                logical.add("/".join(parts))
        return tuple(sorted(logical))

    @property
    def source_revision(self) -> str:
        digest = hashlib.sha256()
        paths = self._logical_paths()
        for removed in self._observations.keys() - set(paths):
            del self._observations[removed]
            self._discard_read(removed)
        for relative in paths:
            info = self._observe(relative)
            digest.update(relative.encode("utf-8"))
            digest.update(b"\0")
            digest.update(str(info["sha256"]).encode("ascii"))
            digest.update(b"\0")
        return f"sha256:{digest.hexdigest()}"

    async def async_enumerate_descriptors(
        self,
        *,
        profile: Mapping[str, Any],
        cursor: str | None,
        limit: int,
    ) -> ContextSourceDescriptorPage:
        page_size = int(limit)
        if page_size <= 0:
            raise ValueError("limit must be a positive integer.")
        try:
            offset = int(cursor or 0)
        except (TypeError, ValueError) as error:
            raise ValueError("TaskWorkspace descriptor cursor is invalid.") from error
        if offset < 0:
            raise ValueError("TaskWorkspace descriptor cursor cannot be negative.")
        projection_max_chars = int(profile.get("projection_max_chars") or 2000)
        if projection_max_chars <= 0:
            raise ValueError("projection_max_chars must be positive.")
        revision = self.source_revision
        paths = self._logical_paths()
        page_paths = paths[offset : offset + page_size]
        descriptors: list[ContextSourceDescriptor] = []
        for relative in page_paths:
            info = self._observe(relative)
            content_kind = str(info.get("content_kind") or "unknown")
            projection = ""
            readback = None
            if content_kind in {"text", "pdf", "office"}:
                readback = await self._read(
                    relative,
                    max_bytes=projection_max_chars,
                )
                projection = readback.content
            total_bytes = int(
                str(
                    info.get("bytes")
                    or info.get("size")
                    or (readback.total_bytes if readback is not None else 0)
                )
            )
            media_type = info.get("media_type") or (
                readback.media_type if readback is not None else None
            )
            sha256 = info.get("sha256") or (
                readback.sha256 if readback is not None else None
            )
            metadata_only = content_kind in {"image", "binary", "unknown"} or (
                content_kind in {"pdf", "office"}
                and (readback is None or not readback.readable)
            )
            descriptors.append(
                ContextSourceDescriptor(
                    descriptor_key=f"task-workspace:{relative}",
                    source_id=self.source_id,
                    source_revision=revision,
                    source_ref=relative,
                    role="information",
                    title=relative,
                    summary=(projection or relative)[:500],
                    estimated_chars=(len(relative) if metadata_only else total_bytes),
                    index_text=(
                        relative
                        if metadata_only or not projection
                        else f"{relative}\n{projection}"
                    ),
                    content_digest=str(sha256 or ""),
                    metadata={
                        "path": relative,
                        "sha256": sha256,
                        "total_bytes": total_bytes,
                        "media_type": media_type,
                        "content_kind": content_kind,
                        "context_representation": (
                            "image_attachment_or_metadata"
                            if content_kind == "image"
                            else "metadata_only"
                            if metadata_only
                            else "parsed_text"
                            if content_kind in {"pdf", "office"}
                            else "text"
                        ),
                    },
                )
            )
        next_offset = offset + len(page_paths)
        return ContextSourceDescriptorPage(
            source_id=self.source_id,
            source_revision=revision,
            descriptors=tuple(descriptors),
            next_cursor=(str(next_offset) if next_offset < len(paths) else None),
        )

    async def async_read_exact(
        self,
        source_ref: str,
        *,
        max_chars: int,
        representation: str |
```

### Core Architecture Module: `agently/core/TaskWorkspace/Errors.py`
```
# Copyright 2023-2026 AgentEra(Agently.Tech)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


class TaskWorkspaceError(RuntimeError):
    pass


class TaskWorkspacePolicyError(TaskWorkspaceError):
    pass


__all__ = ["TaskWorkspaceError", "TaskWorkspacePolicyError"]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #347** (2026-08-12): **[Bug] TriggerFlow sync chunks cannot call public set_state() due to hidden Stage carrier re-entry**
  *Symptoms*: ## Summary  A synchronous TriggerFlow chunk cannot call the public synchronous execution-state API `data.set_state(...)`. The call fails with an internal `StageCallBridge` carrier-reentry exception, even though the user only registered a synchronous TriggerFlow handler and used a synchronous method exposed by `TriggerFlowEventData`.  The underlying bridge defect is tracked in AgentEra/Agently-Stage#24. This Agently issue tracks the TriggerFlow public contract, dependency integration, and regression coverage.  ## Environment  - Python 3.10.13 - `agently` 4.1.4.6 - `agently-stage` 0.3.5 - Reproducible against the current public `main` implementations  ## Minimal reproduction  ```python from agently import TriggerFlow, TriggerFlowEventData  flow = TriggerFlow()  @flow.chunk def save(data: TriggerFlowEventData):     data.set_state("target", data.value)  flow.to(save) flow.create_execution().start("test") ```  ## Actual behavior  ```text StageLifecycleError: A synchronous StageCallBridge call cannot re-enter and block its own carrier execution ```  The exception exposes private execution terms (`StageCallBridge`, `carrier execution`) that are not part of the TriggerFlow programming model.  ## Expected behavior  A synchronous chunk should be able to use the synchronous state API that TriggerFlow exposes:  ```python @flow.chunk def save(data):     data.set_state("target", data.value) ```  An asynchronous chunk should continue to use the asynchronous API:  ```python @flow.chunk async
  **Post-Mortem & Fix Analysis**:
  > Resolved by the published [Agently-Stage 0.3.6](https://github.com/AgentEra/Agently-Stage/releases/tag/v0.3.6) runtime fix and the Agently 4.1.4.7 development integration in [PR #348](https://github.com/AgentEra/Agently/pull/348) (merge commit `3ac8e3a814da46bbb91c8a46886d9d9c0788cd9e`).  Root cause: Stage confused inherited logical execution lineage with physical execution on its carrier loop. A synchronous TriggerFlow chunk runs in a blocking worker; synchronously re-entering the async state implementation from that worker is safe, but Agently-Stage 0.3.5 rejected it as if the carrier loop itself were being blocked.  The runtime owner was fixed in Agently-Stage rather than adding a second bridge inside TriggerFlow. The 0.3.6 guard now checks the actual loop/thread and target carrier, while retaining the genuine same-carrier deadlock guard.  Public-package verification was run in a fresh isolated Python 3.10 environment with exactly:  ```text agently 4.1.4.6 agently-stage 0.3.6 result

- **Issue #331** (2026-08-24): **TriggerFlow 4.1.4.3 snapshots multiply completed interrupt/resume payloads and provide no bounded retention API**
  *Symptoms*: ## Summary  A durable TriggerFlow execution snapshot can grow by several multiples of the application payload because completed pause/resume data is retained in several internal structures at once. The public runtime-event compaction policy does not compact these snapshot sections, and I could not find a public retention/projector API for completed interrupts, resume requests, or signal attempts.  This is not only an application-side “large payload” issue: one request/response value is copied into multiple framework-owned history structures after the interrupt has already reached a terminal state.  ## Environment  - Agently: `4.1.4.3` - Python: `3.10` - TriggerFlow durable execution with a snapshot store  ## Production observation  One closed/cancelled execution with no pending interrupts produced a **6,605,964-byte** JSON snapshot.  | Snapshot section | Bytes | Share | |---|---:|---:| | `signal_net` | 2,754,161 | 41.7% | | `interrupts` | 2,171,383 | 32.9% | | `runtime_data` | 942,980 | 14.3% | | `resume_ledger` | 520,036 | 7.9% | | `sub_flow_frames` | 213,276 | 3.2% |  The snapshot contained 13 interrupts (12 resumed, 1 cancelled) and 61 completed signal attempts. A large resume value was present in several paths, including:  - `interrupt.response` - `interrupt.resume_value` - `interrupt.resume_requests.*.value` - `resume_ledger.*.*.value` - completed signal-attempt metadata embedding the interrupt/resume fields - `signal.meta.resume.value`  The application does pass non-tri
  **Post-Mortem & Fix Analysis**:
  > ## Confirmed and implementation status  The report is reproducible. We confirmed that terminal interrupt/resume values can be repeated across framework-owned snapshot sections and that runtime-event compaction does not own this state.  A fix is now prepared in the current 4.1.4.4 development candidate:  - snapshot projection is a separate policy from runtime-event compaction; - `execution.set_snapshot_projection_policy(terminal_value_mode="digest", min_value_bytes=4096)` replaces eligible large terminal values with deterministic digest summaries; - pending interrupts and active recovery boundaries retain complete values; - save/load, restart, resume idempotency, and pending-payload recovery remain intact; - the built-in local RecordStore keeps the latest three snapshot versions by default and exposes configurable retention and explicit prune controls; - docs and regression coverage describe the ownership boundary and opt-in compatibility behavior.  Observed on the issue-shaped A/B repr
  > ## Development branch synchronized  The #331 implementation is now on remote `dev` at `395ffa67` and is included in the draft 4.1.4.4 release PR: #332.  Release-candidate validation completed with:  - source Pyright: 0 errors; - clean default suite: 2,438 passed and 27 skipped; the 25 maintainer-local spec-runner skips passed separately; - the durable-recovery example passed load, retention, explicit prune, idempotent resume, and durable-event checks; - wheel/sdist build and fresh Python 3.10 installed-package smoke passed; - the issue-shaped A/B result remains 1,307,086 B in compatibility-default mode versus 106,782 B with digest projection, a 91.83% reduction.  The issue remains open and is not marked `solved` yet. After 4.1.4.4 is actually published and the installed package is verified, the release closeout will add the published version/tag and mark it solved.  ---  ## 开发分支已同步  #331 的实现现已推送到远端 `dev`（`395ffa67`），并进入 4.1.4.4 草稿发布 PR：#332。  Release candidate 已完成以下校验：  - 源码 Pyright：0 
  > ## Released in Agently 4.1.4.4  The fix is now publicly available in [Agently v4.1.4.4](https://github.com/AgentEra/Agently/releases/tag/v4.1.4.4) and on [PyPI](https://pypi.org/project/Agently/4.1.4.4/).  Release closeout verification used a fresh Python 3.10 virtual environment and installed `agently==4.1.4.4` directly from PyPI with the package cache disabled. It confirmed:  - installed distribution version `4.1.4.4`; - packaged `py.typed` metadata; - the public `set_snapshot_projection_policy(...)` API; - the complete durable-recovery example, including save/load, latest-N retention, explicit prune, idempotent duplicate resume, and persisted completion events.  The issue-shaped A/B evidence remains 1,307,086 B in compatibility-default mode versus 106,782 B with digest projection, a 91.83% reduction. Projection remains opt-in for compatibility, and whole-snapshot byte ceilings plus distributed-provider retention remain explicitly deferred rather than claimed as solved here.  This is

- **Issue #316** (2026-07-07): **AgentExecutionResult.get_data returns task envelope instead of business result for AgentTask routes**
  *Symptoms*: ## Summary  In Agently 4.1.4, `AgentExecutionResult.get_data()` is inconsistent across execution routes. Direct `model_request` executions return the business result requested by `.output(...)`, but AgentTask-backed routes (`flat` / `taskboard`) can return the full task terminal envelope instead, including `status`, `accepted`, `artifact_status`, `final_result`, `final_response`, and diagnostics.  This makes ordinary result consumption route-dependent and surprises callers that expect `get_data()` to behave like normal request results.  ## Affected Version  - Affected: `4.1.4` - Planned fix: `4.1.4.1`  ## Expected Behavior  `AgentExecutionResult.get_data()` / `async_get_data()` should return the final business result view across direct, flat, and TaskBoard routes. If a task-strategy terminal envelope includes `final_result`, `get_data()` should expose that value and parse it against the declared `.output(...)` contract when possible.  Callers that need route/task internals should use a separate full-data reader.  ## Actual Behavior  For AgentTask-backed executions, `get_data()` may return the full terminal task envelope. Code that works on direct executions can therefore receive task status metadata instead of the requested output object.  ## Fix Plan for 4.1.4.1  The 4.1.4.1 fix will:  - keep the cached route result unchanged internally; - project `get_data()` / `async_get_data()` to the business `final_result` view for task-strategy terminal envelopes; - parse string `final
  **Post-Mortem & Fix Analysis**:
  > Closing as resolved on the development line.\n\nThe issue was addressed by commit `ceafe8a0` / current local `dev` head `39a2e75c`:\n\n- `get_data()` / `async_get_data()` now project task terminal envelopes to the business `final_result` view when present.\n- `get_full_data()` / `async_get_full_data()` expose the complete route/task envelope for callers that need `status`, `accepted`, diagnostics, TaskBoard payloads, etc.\n- `get_text()` keeps the user-facing final-response behavior.\n\nValidation on a clean local `dev` worktree:\n\n- `python -m pytest tests/test_agent_execution_result_data_view.py -q` -> 4 passed.\n\nTarget line: `4.1.4.1`.

- **Issue #313** (2026-07-07): **AgentTask artifact readback and verification can continue after host file action succeeds**
  *Symptoms*: # AgentTask Artifact Readback And Verification Can Continue After Host File Action Succeeds  > **Status: FILED.** Upstream issue: > <https://github.com/AgentEra/Agently/issues/313>. Observed on Agently > `4.1.3.9` through `AgentlyChatInterface`.  ## Summary  An AgentTask TaskBoard run can continue into evidence repair / verifier turns after a host file-producing action succeeds and the requested artifact exists on disk.  The immediate integration trigger is in the host app: the host action writes the file under an app artifact directory and returns `filename`, absolute `path`, and `size`, but does not return framework-owned `artifact_refs` / `file_refs`. The framework-side gap is that AgentTask / TaskBoard artifact readback and evidence binding do not recover cleanly from this mismatch: readback fails, the action success is not accepted as artifact evidence, evidence repair leaves artifact claims unbound, verifier prompts grow very large, and the run can remain active until the worker is detached.  ## Reproduction Context  Host project: `AgentlyChatInterface`  Agently version reported by `/api/config/defaults`:  - `4.1.3.9` - release train `2026-07-4.1.3.9`  Task:  ```text 帮我搜索一下中国大陆知名公司的Harness工程师、Agent工程师相关岗位，整理成公司名-JD-投递方式的表格 ```  Local run identifiers:  - `chat_id`: `bd772023-d39c-4030-bc2b-5eb6a5b1164d` - `run_id`: `d9a34e3d6d00438aa870d8cf91936212`  The TaskBoard selected three cards:  - `search_harness` - `search_agent` - `synthesize_xlsx`  The final `synthesize_xlsx` 
  **Post-Mortem & Fix Analysis**:
  > Closing as resolved on the framework side for the development line.\n\nCurrent behavior is now explicit and covered by tests:\n\n- Successful Workspace-contained file-producing actions can be adopted through Workspace readback and promoted to trusted `file_refs`.\n- Path-only host action payloads such as `{filename, path, size}` remain bounded Action evidence/ref pointers. They are not inferred as trusted Workspace files unless the path is Workspace-contained and readback succeeds, or the host returns typed `file_refs` / `artifact_refs`.\n- Workspace-outside path-only artifacts now produce a precise diagnostic (`agent_task.workspace_artifact.action_file_outside_workspace`) instead of being silently treated as trusted readback.\n- Workspace readback failures produce `agent_task.workspace_artifact.readback_failed` diagnostics.\n\nValidation on a clean local `dev` worktree:\n\n- `test_agent_task_workspace_artifact_delivery_adopts_successful_action_written_file` -> passed.\n- `test_path_on

- **Issue #310** (2026-07-07): **Browse action should not prompt for dependency installation inside service runtimes**
  *Symptoms*: # Browse action should not prompt for dependency installation inside service runtimes  > Observed on Agently `4.1.3.8`. > This is a service-runtime safety issue: built-in actions should return typed > missing-dependency diagnostics instead of prompting inside a server process.  ## Observed Behavior  While stopping a local `AgentlyChatInterface` FastAPI service after a run that used web browsing/search, the process was stuck behind an interactive prompt:  ```text Missing modules: beautifulsoup4 Do you want to install it via pip now? [y/N]: ```  The service did not exit cleanly on the first interrupt and kept listening on port `8765` until the process was killed.  Follow-up evidence from concurrent runs:  - `51f9d6efd15946e38254f3ffe16f3f1e` remained `running` after only setup events. - `b6149a69025f40a196dc307fd90e5210` remained `running` in `fw:execution` with no active worker attached. - The same service process stayed bound to port `8765` while blocked, so one interactive Browse dependency prompt could stall unrelated sessions.  ## Expected Behavior  Framework actions used inside a long-running service should fail closed with structured diagnostics when optional dependencies are missing. They should not prompt for interactive package installation from inside a request worker or server process.  Suggested behavior:  - return an ActionResult failure with `code="dependency_missing"` - include the missing package names and install guidance in diagnostics - let the host applicat
  **Post-Mortem & Fix Analysis**:
  > Closing as resolved on the development line.\n\nBuilt-in Browse/Search execution paths now disable LazyImport interactive package installation. Missing optional dependencies surface through structured failures/diagnostics instead of prompting inside service runtimes.\n\nValidation on a clean local `dev` worktree:\n\n- `python -m pytest tests/test_cores/test_builtin_actions_v2.py::test_browse_bs4_disables_lazy_import_install_prompt -q` -> passed.\n\nThe behavior is also recorded in the compatibility contract: built-in web actions do not prompt for package installation while running; service hosts decide whether to install, retry, or fall back. Target line: `4.1.4.1`.

- **Issue #301** (2026-07-01): **ActionRuntime can re-enter unnecessary planning after HITL resume**
  *Symptoms*: # ActionRuntime can re-enter unnecessary planning after HITL resume  ## Summary  When an application pauses an agent run for human input and then resumes the same run with a structured text-only response, routing the resumed request back through ActionRuntime can enter another planning/response loop until the ActionFlow close timeout is reached.  This is related to, but not the same as, #292. The timeout is now surfaced as a typed framework stall. The remaining gap is that a human-input resume case may not need another tool-planning pass at all, but the host currently has no framework-level resume policy to express that safely.  ## Scenario  A desktop chat host exposes model-callable actions for human-in-the-loop interactions, such as:  - request approval from the user - request additional text information - request an additional file  The host then:  1. lets the model call a human-input action; 2. emits an input-required event to the UI; 3. marks the run paused; 4. receives the user's text-only response; 5. resumes the same run id with structured resume context; 6. routes the resumed work through `agent.async_get_action_result(...)`.  In the observed failure, the resumed ActionRuntime path streamed a large amount of response content and eventually failed with:  ```text ActionFlow loop close did not complete before timeout: timeout=120 ```  ## Expected behavior  For a structured human response resume, Agently should provide one of these bounded behaviors:  - ActionRuntime can
  **Post-Mortem & Fix Analysis**:
  > Closing as outdated/superseded after reviewing the current AgentExecution and TriggerFlow implementation boundaries.  The symptom described here was real, but keeping this issue open now points the fix at the wrong owner: HITL resume should not be solved by making ActionRuntime guess terminal human responses or by changing the action-planning protocol. The current architecture already has durable wait/resume ownership in TriggerFlow, while AgentExecution should expose the application-facing exchange/resume projection.  The remaining framework design gap is tracked more accurately by #302. If a concrete resume bug still appears after that contract is shaped against the current implementation, it should be filed as a new, narrower issue with current reproduction details.

- **Issue #123** (2025-07-24): **Error report when packaging by pyinstaller**
  *Symptoms*:  it reports error when i use pyinstaller to package the codes into xxx.exe.  the error is about the agently framework can not find 'plugins' in the temp runtime folder.  it's quite wired as the .spec file is normal and i can use pyinstaller to package the codes without agently.  does anyone have the similar problem ? call for help, thx a millon! 
  **Post-Mortem & Fix Analysis**:
  > It seems this error caused by dynamic loading design of Agently framework.  After Agently is packaged into an exe file, the exe file try to dynamic load the plugin modules from the path where the exe file is and can not find any, so there's an error report.  Maybe try to add plugins dir path to exe file when using pyinstaller to package?  `pyinstaller --add-data "path/to/Agently/plugins;Agently/plugins" your_script.py`
  > > It seems this error caused by dynamic loading design of Agently framework. >  > After Agently is packaged into an exe file, the exe file try to dynamic load the plugin modules from the path where the exe file is and can not find any, so there's an error report. >  > Maybe try to add plugins dir path to exe file when using pyinstaller to package? >  > `pyinstaller --add-data "path/to/Agently/plugins;Agently/plugins" your_script.py`  not work, = =b
  > After Agently update to v4, we move q&a and suggestion to discussion tab, welcome to join us there： https://github.com/AgentEra/Agently/discussions/categories/q-a

- **Issue #113** (2024-06-22): **decorated tool function can not be called directly**
  *Symptoms*: `@agent.tool()` will make function can not be called. It is because the decorator did not return original function.  It is a bug to be fixed.
  **Post-Mortem & Fix Analysis**:
  > fixed in https://github.com/Maplemx/Agently/commit/60f9d475184815ca9d4ce3df0eab71dde393c207
  > published in version 3.3.1.2

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

### Incident Patch 1: `6311389d` (2026-09-22)
**Commit Message**: fix: preserve instant results without provider replay

**File**: `agently/builtins/plugins/AgentExecution/modules/judgment_flow.py` (modified, +79/-1)
```diff
@@ -2,6 +2,7 @@
 
 from __future__ import annotations
 
+import asyncio
 from collections.abc import Mapping
 from contextlib import suppress
 from copy import deepcopy
@@ -240,8 +241,26 @@ async def dispatch(
         }
         self.meta["stages"].append(record)
         started = monotonic()
+        instant_started = monotonic()
+        instant_task = asyncio.create_task(
+            self._bridge_judgment_instant_stream(
+                result,
+                record,
+                started=instant_started,
+                target_paths=(
+                    {f"field_{index}" for index in range(len(schema))}
+                    if batch is not None
+                    else set(schema)
+                ),
+            )
+        )
         try:
             value = await result.async_get_data(max_retries=0, raise_ensure_failure=True)
+            # The parser stream and the final getter share one result facade.
+            # Awaiting the stream here ensures every provisional field that was
+            # visible to Execution has reached its terminal event before the
+            # stage is accepted and assembled.
+            await instant_task
             if batch is not None:
                 if not isinstance(value, dict) or set(value) != set(schema):
                     raise ValueError("Judgment stage returned incomplete or extra fields.")
@@ -288,12 +307,71 @@ async def dispatch(
             )
             return value
         except BaseException as error:
-            record.update({"status": "failed", "error_type": type(error).__name__})
+            if not instant_task.done():
+                instant_task.cancel()
+                with suppress(asyncio.CancelledError):
+                    await instant_task
+            with suppress(BaseException):
+                record["meta"] = await result.async_get_meta()
+            record.update(
+                {
+                    "status": "failed_after_instant" if record.get("instant_completed_paths") else "failed",
+                    "error_type": type(error).__name__,
+                    "instant_only": bool(record.get("instant_completed_paths")),
+                    "final_validation_error": str(error)[:2000],
+                }
+            )
             raise
         finally:
             record["elapsed_seconds"] = monotonic() - started
             owner.record_context_consumption(package, request_id=str(result.response_id or result.id))
 
+    async def _bridge_judgment_instant_stream(
+        self,
+        result: Any,
+        record: dict[str, Any],
+        *,
+        started: float,
+        target_paths: set[str],
+    ) -> None:
+        """Project LLM structured fields into Execution while the request runs.
+
+        SystemOne/Jev native responses are not token streams, so this path is
+        primarily for an LLM-backed SystemOne provider.  The final getter still
+        validates and owns the accepted result; instant events are provisional
+        observations and are only used for progress timing and UI consumers.
+        """
+        first_field_seconds: float | None = None
+        completed_paths: list[str] = []
+        instant_values: dict[str, Any] = {}
+        event_count = 0
+        async for item in result.get_async_generator(type="instant"):
+            event_count += 1
+            path = str(getattr(item, "path", "") or "")
+            is_complete = bool(getattr(item, "is_complete", False))
+            if is_complete and path in target_paths:
+                instant_values[path] = deepcopy(getattr(item, "value", None))
+                if path not in completed_paths:
+                    completed_paths.append(path)
+                if first_field_seconds is None:
+                    first_field_seconds = monotonic() - started
+            await self.execution.bridge_model_stream_item(
+                item,
+                route="model_request",
+                meta={
+                    "response_id": result.response_id,
+                    "request_run_id": (
+                        result.request_run_context.run_id if result.request_run_context is not None else None
+                    ),
+                    "model_run_id": result.model_run_context.run_id if result.model_run_context is not None else None,
+                    "attempt_index": result.attempt_index,
+                    "system_one_stage": True,
+                },
+            )
+        record["instant_event_count"] = event_count
+        record["instant_completed_paths"] = completed_paths
+        record["instant_first_field_seconds"] = first_field_seconds
+        record["instant_values"] = instant_values
 
 def _runtime(data: TriggerFlowRuntimeData) -> _JudgmentOutput:
     runtime = data.require_resource(_RESOURCE)
```

**File**: `agently/core/model/ModelRequestResult.py` (modified, +15/-0)
```diff
@@ -109,6 +109,11 @@ def __init__(
         self._validate_lock = asyncio.Lock()
         self._validate_handler_signature: tuple[int, ...] | None = None
         self._accepted_retry_result: ModelRequestResult | None = None
+        # Structured instant fields are provisional observations.  Once a
+        # complete field has been observed, output validation must not replay
+        # the provider merely to repair a later carrier-level failure.
+        self._instant_complete_paths: set[str] = set()
+        self._instant_complete_values: dict[str, Any] = {}
         self._data_flow = ModelRequestResultDataFlow(self)
         self.full_result_data = self._response_parser.full_result_data
         self._get_meta_sync = cast(Callable[[], dict[str, Any]], default_stage_call_bridge.as_sync(self.async_get_meta))
@@ -484,6 +489,11 @@ def get_generator(
         try:
             for data in parsed_generator:
                 self._drain_response_parser_observations_sync()
+                if type in ("instant", "streaming_parse"):
+                    path = getattr(data, "path", None)
+                    if bool(getattr(data, "is_complete", False)) and isinstance(path, str) and path:
+                        self._instant_complete_paths.add(path)
+                        self._instant_complete_values[path] = getattr(data, "value", None)
                 yield data
                 self._drain_response_parser_observations_sync()
             completed = True
@@ -576,6 +586,11 @@ async def get_async_generator(
         try:
             async for data in parsed_generator:
                 await self._drain_response_parser_observations()
+                if type in ("instant", "streaming_parse"):
+                    path = getattr(data, "path", None)
+                    if bool(getattr(data, "is_complete", False)) and isinstance(path, str) and path:
+                        self._instant_complete_paths.add(path)
+                        self._instant_complete_values[path] = getattr(data, "value", None)
                 yield data
                 await self._drain_response_parser_observations()
             completed = True
```

**File**: `agently/core/model/ModelRequestResultDataFlow.py` (modified, +10/-4)
```diff
@@ -760,6 +760,12 @@ async def async_get_data(
         retry_count: int = 0,
     ) -> Any:
         result = self._result
+        instant_retry_suppressed = bool(result._instant_complete_paths)
+        if instant_retry_suppressed:
+            result._response_parser.full_result_data["meta"]["instant_retry_suppressed"] = True
+            result._response_parser.full_result_data["meta"]["instant_complete_paths"] = sorted(
+                result._instant_complete_paths
+            )
         if result._accepted_retry_result is not None:
             return await result._accepted_retry_result.async_get_data(
                 type=type,
@@ -793,7 +799,7 @@ async def async_get_data(
                     stage="response_materialization",
                 )
                 await result._drain_response_parser_observations()
-                if type in ("parsed", "all") and retry_count < max_retries:
+                if type in ("parsed", "all") and retry_count < max_retries and not instant_retry_suppressed:
                     degraded_data = await self.try_auto_degradation(
                         type=type,
                         data=data,
@@ -818,7 +824,7 @@ async def async_get_data(
             )
             await result._drain_response_parser_observations()
 
-            if type in ("parsed", "all") and retry_count < max_retries:
+            if type in ("parsed", "all") and retry_count < max_retries and not instant_retry_suppressed:
                 degraded_data = await self.try_auto_degradation(
                     type=type,
                     data=data,
@@ -879,7 +885,7 @@ async def async_get_data(
                     retry_reason="output_constraints",
                 )
 
-                if retry_count < max_retries:
+                if retry_count < max_retries and not instant_retry_suppressed:
                     return await self.retry_get_data(
                         type=type,
                         ensure_keys=active_ensure_keys,
@@ -913,7 +919,7 @@ async def async_get_data(
                 max_retries=max_retries,
             )
             if validation_outcome is not None and not validation_outcome["ok"]:
-                if validation_outcome.get("retryable", True) and retry_count < max_retries:
+                if validation_outcome.get("retryable", True) and retry_count < max_retries and not instant_retry_suppressed:
                     await self.emit_retrying_event(
                         retry_count=retry_count,
                         response_text=await result._response_parser.async_get_text(),
```

**File**: `docs/cn/triggerflow/model-integration.md` (modified, +7/-0)
```diff
@@ -95,6 +95,13 @@ async def draft_with_streaming(data: TriggerFlowRuntimeData):
 消费者可以在 `body` 还在生成时先渲染 `title` delta。stream 结束后，
 `async_get_data()` 返回同一个 result 的最终缓存解析 dict（不再发请求）。
 
+当声明的目标字段已经发出 complete 的 instant 事件后，Agently 会把该字段记为本次
+请求已经观察到。之后若 schema、ensure 或 validator 校验失败，不会为修复同一个请求
+而重新请求 provider。最终校验结果仍然权威：请求可以继续失败，框架会保留错误、usage
+和 metadata，并标记 `instant_retry_suppressed` 与 `instant_complete_paths`。该规则也适用
+AgentExecution 的结构化流；在任何目标字段完成之前，原有 retry 合同仍然有效。请把
+instant 值只用于临时 UI 或幂等准备，不要直接据此执行副作用，副作用必须以最终结果为准。
+
 ## 让生成与下游 fan-out 重叠
 
 当靠前的完整字段能够启动独立检索或准备工作时，优先采用 TriggerFlow 可见的
```

**File**: `docs/en/triggerflow/model-integration.md` (modified, +10/-0)
```diff
@@ -100,6 +100,16 @@ tokens. Consumers can render `title` deltas while `body` is still generating.
 After the stream ends, `async_get_data()` returns the cached final parsed dict
 from the same result (no second request).
 
+Once a declared target field has emitted a complete instant event, Agently marks
+that field as observed for the request lifecycle. A later schema/ensure/validator
+failure does not replay the provider to repair that same request. The final
+validated result remains authoritative: the request can still fail, and the
+framework preserves its error, usage, and metadata with
+`instant_retry_suppressed` and `instant_complete_paths`. This rule applies to
+the AgentExecution structured stream as well; before any target field completes,
+the normal retry contract remains available. Treat instant values as provisional
+UI or idempotent preparation and use the final result for side effects.
+
 ## Overlap generation with downstream fan-out
 
 When a complete early field can start independent retrieval or preparation,
```

**File**: `tests/test_cores/test_model_request_validate.py` (modified, +44/-28)
```diff
@@ -54,7 +54,12 @@ def generate_request_data(self):
     async def request_model(self, request_data: AgentlyRequestData):
         attempt = int(request_data.data.get("attempt", 1))
         index = min(attempt - 1, len(type(self).responses) - 1)
-        yield "message", json.dumps(type(self).responses[index], ensure_ascii=False)
+        response = type(self).responses[index]
+        if isinstance(response, dict) and "__chunks__" in response:
+            for chunk in response["__chunks__"]:
+                yield "message", str(chunk)
+            return
+        yield "message", json.dumps(response, ensure_ascii=False)
 
     async def broadcast_response(
         self,
@@ -170,7 +175,7 @@ def third(result, context):
 
 
 @pytest.mark.asyncio
-async def test_agent_validate_failure_retries_and_emits_runtime_events():
+async def test_agent_structured_output_does_not_retry_after_instant_field():
     MockValidateJSONRequester.reset([{"status": "draft"}, {"status": "ready"}])
     agent = _create_agent(MockValidateJSONRequester, "validate-agent")
     turn = agent.output({"status": (str,)}, format="json")
@@ -184,12 +189,12 @@ async def capture(event):
     hook_name = "test_model_request_validate.agent_retry"
     Agently.event_center.register_hook(capture, hook_name=hook_name)
     try:
-        data = await turn.async_start(max_retries=1)
+        with pytest.raises(ValueError, match="Validation failed"):
+            await turn.async_start(max_retries=1)
     finally:
         Agently.event_center.unregister_hook(hook_name)
 
-    assert data == {"status": "ready"}
-    assert MockValidateJSONRequester.attempts == 2
+    assert MockValidateJSONRequester.attempts == 1
 
     validation_event = next(event for event in captured if event.event_type == "model.validation_failed")
     assert validation_event.payload["validator_name"] == "<lambda>"
@@ -198,59 +203,70 @@ async def capture(event):
     assert validation_event.payload["max_retries"] == 1
     assert validation_event.payload["response_text"] == '{"status": "draft"}'
 
-    retry_event = next(event for event in captured if event.event_type == "model.retrying")
-    assert retry_event.payload["retry_reason"] == "validate"
-    assert retry_event.payload["validation_reason"] == "Validation failed in <lambda>."
-    assert retry_event.payload["next_attempt_index"] == 2
+    assert not any(event.event_type == "model.retrying" for event in captured)
 
 
 @pytest.mark.asyncio
-async def test_validate_retry_exposes_accepted_attempt_through_reopened_instant_stream():
+async def test_instant_stream_suppresses_validation_retry_and_replays_same_attempt():
     MockValidateJSONRequester.reset([{"status": "draft"}, {"status": "ready"}])
     request = _create_request(MockValidateJSONRequester, "validate-retry-instant-stream")
     request.output({"status": (str,)}, format="json")
     response = request.validate(lambda result, context: result["status"] == "ready").get_response()
 
     first_attempt_items = [item async for item in response.get_async_generator(type="instant")]
-    data = await response.async_get_data(max_retries=1)
+    with pytest.raises(ValueError, match="Validation failed"):
+        await response.async_get_data(max_retries=1)
     accepted_attempt_items = [item async for item in response.get_async_generator(type="instant")]
 
-    assert data == {"status": "ready"}
-    assert MockValidateJSONRequester.attempts == 2
+    assert MockValidateJSONRequester.attempts == 1
     assert [item.value for item in first_attempt_items if item.path == "status" and item.is_complete] == ["draft"]
-    assert [item.value for item in accepted_attempt_items if item.path == "status" and item.is_complete] == ["ready"]
+    assert [item.value for item in accepted_attempt_items if item.path == "status" and item.is_complete] == ["draft"]
+
+
+@pytest.mark.asyncio
+async def test_complete_instant_field_suppresses_retry_after_final_carrier_failure():
+    MockValidateJSONRequester.reset([{"status": "draft", "title": "x"}])
+    request = _create_request(MockValidateJSONRequester, "instant-final-carrier-failure")
+    request.output({"status": (str,), "title": (str,)}, format="json")
+    request.validate(lambda result, context: False)
+    response = request.get_response()
 
+    instant_items = [item async for item in response.get_async_generator(type="instant")]
+    with pytest.raises(ValueError):
+        await response.async_get_data(max_retries=2)
 
-def test_validate_retry_exposes_accepted_attempt_through_reopened_sync_instant_stream():
+    assert MockValidateJSONRequester.attempts == 1
+    assert [item.value for item in instant_items if item.path == "status" and item.is_complete] == ["draft"]
+    meta = await response.async_get_meta()
+    assert meta["instant_retry_suppressed"] is True
+    assert "status" in meta["instant_complete_paths"]
+
+
+def test_sync_instant_stream_suppresses_validation_retry():
     MockValidateJSONRequester.reset([{"status": 
```

---

### Incident Patch 2: `925a3917` (2026-10-01)
**Commit Message**: Unify new long tasks around an editable checklist loop

**File**: `agently/builtins/plugins/AgentExecution/modules/execution.py` (modified, +20/-4)
```diff
@@ -2152,6 +2152,8 @@ def _assert_rework_supported(self) -> None:
             raise NotImplementedError(f"Producer {self.name!r} must declare its own safe rework contract.")
         route = self.route_info.get("selected_route")
         if route == "agent_task":
+            if self._producer_state.get("kind") == "task_loop":
+                return
             if self.task_record is None or self._producer_state.get("kind") != "long_task":
                 raise RuntimeError("Long-task rework requires its retained producer and evidence bindings.")
             if any(not task.done() for task in self.task_record._background_stream_tasks):
@@ -2161,8 +2163,12 @@ def _assert_rework_supported(self) -> None:
 
     async def _async_rework_produce(self, options: ProductionOptions) -> tuple[str, object]:
         if self.route_info.get("selected_route") == "agent_task":
-            from ..long_task.Rework import prepare_task_rework
-            await prepare_task_rework(self)
+            if self._producer_state.get("kind") == "task_loop":
+                from .task_loop import prepare_rework
+                await prepare_rework(self)
+            else:
+                from ..long_task.Rework import prepare_task_rework
+                await prepare_task_rework(self)
         else:
             from .revisions import rework_request
             await rework_request(self)
@@ -2186,9 +2192,19 @@ async def async_cancel(
     @property
     def control_capabilities(self) -> AgentExecutionControlCapabilities:
         """Describe implemented boundaries without starting the producer."""
+        boundaries: list[Literal["before_production", "candidate_ready", "long_task_step"]] = [
+            "before_production", "candidate_ready"]
+        if self._producer_state.get("kind") == "task_loop" or (
+            self.name == "long_task" and self.strategy_name not in {"flat", "taskboard", "task", "task_loop"}
+            and self.task_options.get("execution") not in {"flat", "taskboard"}
+            and self.task_record is None and not self.task_options.get("resume")
+            and self.task_options.get("resume_task_id") is None
+            and not getattr(self, "_agent_task_step_overrides", None)
+        ):
+            boundaries.append("long_task_step")
         return {
-            "pause_boundaries": ["before_production", "candidate_ready"],
-            "snapshot_boundaries": [] if self._bound_agent_capabilities or self._audio_inputs else ["before_production", "candidate_ready"],
+            "pause_boundaries": list(boundaries),
+            "snapshot_boundaries": [] if self._bound_agent_capabilities or self._audio_inputs else list(boundaries),
             "resume": "explicit_pending_pause",
             "rework": ("same_execution_revision" if (
                 self.__class__._async_produce is AgentExecution._async_produce
```

**File**: `agently/builtins/plugins/AgentExecution/modules/lifecycle.py` (modified, +1/-1)
```diff
@@ -246,7 +246,7 @@ def pause_flow() -> TriggerFlow[Any, Any, Any]:
 
 async def pause_at(
     owner: AgentExecution,
-    boundary: Literal["before_production", "candidate_ready"],
+    boundary: Literal["before_production", "candidate_ready", "long_task_step"],
     continuation: Callable[[], Awaitable[tuple[str, object]]],
 ) -> None:
     if not owner._pause_requested:
```

**File**: `agently/builtins/plugins/AgentExecution/modules/result_views.py` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ async def async_get_data_object(
         return owner._producer_result_object
     if owner._ensure_long_output_enabled and owner._long_output_result_object is not None:
         return owner._long_output_result_object
-    if owner._restored_result_pending:
+    if owner._restored_result_pending or owner._producer_state.get("kind") == "task_loop":
         from copy import deepcopy
 
         # Snapshots retain data, never live parser/model objects. Rebind only
```

**File**: `agently/builtins/plugins/AgentExecution/modules/runtime_guidance.py` (modified, +15/-0)
```diff
@@ -119,6 +119,21 @@ async def add_guidance(
         return DataFormatter.sanitize(guidance_ref)
 
 
+async def insert_pending_guidance(owner: "AgentExecution") -> None:
+    """Make queued execution guidance available to the next ContextPackage read."""
+    async with _guidance_lock(owner):
+        for receipt in owner._pending_guidance:
+            if receipt.get("status") != "queued":
+                continue
+            owner.task_context.put(
+                role="information", content=receipt["content"], entry_id=receipt["id"], required=True,
+                source_ref=receipt["id"], metadata={"source": "execution_guidance", "author": receipt.get("author")},
+            )
+            receipt["context_entry_id"] = receipt["id"]
+            receipt["status"] = "inserted"
+            await _emit_guidance(owner, "agent_execution.guidance.inserted", receipt)
+
+
 async def drain_pending_guidance_to_task(owner: "AgentExecution", task: Any) -> list[dict[str, Any]]:
     pending = [item for item in getattr(owner, "_pending_guidance", []) or [] if isinstance(item, dict)]
     if not pending:
```

**File**: `agently/builtins/plugins/AgentExecution/modules/snapshot.py` (modified, +2/-2)
```diff
@@ -210,7 +210,7 @@ def load(owner: AgentExecution, snapshot: Mapping[str, object]) -> None:
     if state.get("plugin") != owner.name:
         raise ValueError("Execution snapshot belongs to a different plugin.")
     boundary = state.get("boundary")
-    if boundary not in {"before_production", "candidate_ready"}:
+    if boundary not in {"before_production", "candidate_ready", "long_task_step"}:
         raise ValueError("Execution snapshot has no supported safe boundary.")
     identity = state.get("execution_id")
     if not isinstance(identity, str) or len(identity) != 32 or any(c not in "0123456789abcdef" for c in identity):
@@ -369,7 +369,7 @@ def load(owner: AgentExecution, snapshot: Mapping[str, object]) -> None:
     owner.status = "paused"
 
     async def continue_saved() -> tuple[str, object]:
-        if boundary == "before_production":
+        if boundary in {"before_production", "long_task_step"}:
             return await prepare_production(owner, options)
         route = state.get("route")
         if not isinstance(route, str):
```

**File**: `agently/builtins/plugins/AgentExecution/modules/task_loop.py` (added, +221/-0)
```diff
@@ -0,0 +1,221 @@
+"""Goal pursuit using one editable checklist and the existing execution owners."""
+from __future__ import annotations
+
+from collections.abc import Mapping
+from copy import deepcopy
+from typing import TYPE_CHECKING, Any, Literal, cast
+
+from agently.core.application.AgentExecution import AgentExecutionLimitExceeded
+from agently.core.orchestration import TriggerFlow
+from agently.types.trigger_flow import TriggerFlowRuntimeData
+from agently.utils import DataFormatter
+
+from .model_stage import run_model_stage
+from .revisions import content_digest
+from .runtime_guidance import insert_pending_guidance
+
+if TYPE_CHECKING:
+    from .execution import AgentExecution
+    from agently.core.operation.Action import Action
+
+
+_INSTRUCTION = """Advance the original task using the current checklist and actual observations.
+The taskboard is an editable Markdown checklist. Add, remove, split, merge, reorder, check or reopen items as needed. New findings may add work; simple tasks need no checklist. Editing it does not change the original goal or required deliverables.
+One action may advance several items; one item may require several rounds. Select only offered actions with their declared arguments. Calls within a batch must be independent; await actual results before deciding dependent calls. Plans and checkmarks are not evidence that actions succeeded.
+Return continue when more work is possible, completed when the original task and required deliverables are fulfilled, or blocked when required information or available capabilities prevent further progress. Disclosing a missing requirement does not fulfill it; permitted template blanks do not imply failure.
+Keep taskboard null to retain it. Return the current useful result or null while continuing, and the full useful result at termination. When applicable, explain unfinished work, uncertainties to check, actual consequences and information needed. Do not invent completion percentages or causes of failure.
+Terminal decisions must have no action_calls: an operation cannot be declared complete before execution. Preserve usable work when blocked. Return result in the caller's declared output shape."""
+
+
+def _store(owner: AgentExecution, state: dict[str, Any]) -> None:
+    owner._producer_state = {"kind": "task_loop", "content": state, "digest": content_digest(state)}
+
+
+def _state(owner: AgentExecution) -> dict[str, Any]:
+    retained = owner._producer_state
+    if retained.get("kind") != "task_loop":
+        state: dict[str, Any] = {
+            "taskboard": "", "rounds": 0, "observations": [], "result": None,
+            "status": "continue", "succeeded_actions": [], "revision": owner.revision,
+        }
+        _store(owner, state)
+        return state
+    if retained.get("digest") != content_digest(retained.get("content")):
+        raise ValueError("Retained long-task state changed outside its execution owner.")
+    return deepcopy(retained["content"])
+
+
+async def prepare_rework(owner: AgentExecution) -> None:
+    state = _state(owner)
+    if state["revision"] != owner.revision:
+        state["status"] = "continue"
+        state["revision"] = owner.revision
+        _store(owner, state)
+    owner._review_contract["rework_feedback"] = owner._rework_feedback
+
+
+def _decision(value: object, offered: set[str]) -> dict[str, Any]:
+    if not isinstance(value, Mapping):
+        raise ValueError("Long-task decision must be a mapping.")
+    decision = dict(value)
+    if decision.get("status") not in {"continue", "completed", "blocked"}:
+        raise ValueError("Invalid long-task status.")
+    if decision.get("taskboard") is not None and not isinstance(decision["taskboard"], str):
+        raise ValueError("Taskboard must be text or null.")
+    calls = decision.get("action_calls")
+    if not isinstance(calls, list):
+        raise ValueError("Long-task action_calls must be a list.")
+    for call in calls:
+        if (not isinstance(call, dict) or call.get("action_id") not in offered
+                or not isinstance(call.get("action_input"), dict)):
+            raise ValueError("Long-task call must name an offered Action and mapping arguments.")
+    if decision["status"] != "continue" and (calls or decision.get("result") is None):
+        raise ValueError("Terminal decisions require a result and no pending Actions.")
+    return decision
+
+
+async def run_task_loop(owner: AgentExecution) -> dict[str, Any]:
+    """Run a settled sequence; outer execution owns cancellation and safe pauses."""
+    from .task_strategy import _resolve_required_skill_availability
+
+    _, skill_failure = await _resolve_required_skill_availability(owner, goal=owner.task_goal())
+    if skill_failure is not None:
+        owner.status = "blocked"
+        return {"status": "blocked", "accepted": False, "final_result": None,
+                "reason": "Required Skills are unavailable.", "required_capabilities": skill_failure
```

**File**: `agently/builtins/plugins/AgentExecution/modules/task_strategy.py` (modified, +10/-2)
```diff
@@ -158,8 +158,16 @@ async def _resolve_required_skill_availability(
 
 
 async def run_agent_task_route(execution: "AgentExecution", route_meta: dict[str, Any]) -> Any:
-    """Run one ordinary AgentTask route with Skill bindings in TaskContext."""
-
+    """Use the unified producer; explicit 4.1 strategies retain their migration path."""
+    options = execution.task_strategy_options()
+    legacy = (execution.strategy_name in {"task", "task_loop"}
+              or options.get("execution") in {"flat", "taskboard"}
+              or execution.task_record is not None
+              or options.get("resume") or options.get("resume_task_id") is not None
+              or bool(getattr(execution, "_agent_task_step_overrides", None)))
+    if not legacy and execution.limits.get("allow_create_task") is not False:
+        from .task_loop import run_task_loop
+        return await run_task_loop(execution)
     return await _run_agent_task_route_impl(execution, route_meta)
 
 
```

**File**: `agently/types/data/agent_execution.py` (modified, +2/-2)
```diff
@@ -42,8 +42,8 @@
 class AgentExecutionControlCapabilities(TypedDict):
     """Supported semantic boundaries, independent from execution state."""
 
-    pause_boundaries: list[Literal["before_production", "candidate_ready"]]
-    snapshot_boundaries: list[Literal["before_production", "candidate_ready"]]
+    pause_boundaries: list[Literal["before_production", "candidate_ready", "long_task_step"]]
+    snapshot_boundaries: list[Literal["before_production", "candidate_ready", "long_task_step"]]
     resume: Literal["explicit_pending_pause"]
     rework: Literal["same_execution_revision", "unsupported"]
     active_child_snapshot: Literal[False]
```

---

### Incident Patch 3: `e7241a4d` (2026-09-30)
**Commit Message**: fix: preserve structured immutable context in prompt projection

**File**: `agently/utils/DataFormatter.py` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ def sanitize(value: Any, *, remain_type: bool = False) -> Any:
                 return value.__name__
             return str(value)
 
-        if isinstance(value, dict):
+        if isinstance(value, Mapping):
             return {str(k): DataFormatter.sanitize(v, remain_type=remain_type) for k, v in value.items()}
         if isinstance(value, list):
             return [DataFormatter.sanitize(v, remain_type=remain_type) for v in value]
```

**File**: `compatibility/in-development.json` (modified, +1/-0)
```diff
@@ -59,6 +59,7 @@
     "scope_or_execution_authorization_changed": false
   },
   "context_supply": {
+    "immutable_content_projection": "Mapping content is recursively serialized as structured data without mutating ContextPackage; no Python mappingproxy repr in model input",
     "status": "in_development",
     "since": "4.1.4.9",
     "owner": "TaskWorkspaceContextSource / ContextReader / SkillContextSource",
```

**File**: `docs/cn/requests/context-engineering.md` (modified, +2/-0)
```diff
@@ -55,6 +55,8 @@ Skills、files、records、SessionMemory recall、evidence 或固定仓库时，
 绑定到 `TaskContext`，再由 `ContextReader` 按 consumer/phase 读取一份
 `ContextPackage`。
 
+ContextPackage 的不可变结构化信息在进入 Prompt 时会递归投影为普通数据，保留嵌套字段、数值、布尔值和空值；不会把只读映射转成 Python 对象描述。投影不修改原包。
+
 TaskBoard 准备阶段按首次规划的用途读取资料，并把同一份包直接交给规划请求；
 资料未变化时，不在下一阶段再次选择和读取。若规划前任务上下文或来源 revision
 发生变化，则刷新资料包及后续卡片使用的上下文。图片等附件随包交付，只有规划请求
```

**File**: `docs/en/requests/context-engineering.md` (modified, +2/-0)
```diff
@@ -55,6 +55,8 @@ catalog. When one task may need Skills, files, records, SessionMemory recall,
 evidence, or a pinned repository, bind those sources to `TaskContext` and read
 one consumer/phase-specific `ContextPackage` through `ContextReader`.
 
+Immutable structured content in a ContextPackage is projected recursively as ordinary data for the Prompt, preserving nested fields, numbers, booleans, and nulls. Read-only mappings are not rendered as Python object descriptions, and projection does not mutate the package.
+
 TaskBoard preparation reads for its initial planner and passes that package
 directly to the planning request. An unchanged package is not selected and read
 again at the next stage. If task context or source revisions change before
```

**File**: `tests/test_utils/test_data_formatter.py` (modified, +33/-0)
```diff
@@ -2,6 +2,39 @@
 from agently.utils import DataFormatter
 
 
+def test_sanitize_frozen_context_content_keeps_nested_values_and_source_immutable():
+    import json
+    from types import MappingProxyType
+    from agently.types.data import ContextBlock
+
+    block = ContextBlock(
+        block_id="block", block_key="context", source_id="source",
+        source_revision="1", source_ref="state", binding_id="binding",
+        role="information", completeness="complete", content_chars=100,
+        content={"taskboard": "- [ ] finish", "observations": [
+            {"status": "success", "result": {"count": 3, "optional": None, "valid": True}}
+        ]},
+    )
+    assert isinstance(block.content, MappingProxyType)
+    result = DataFormatter.sanitize(block.content)
+    assert isinstance(result, dict)
+    assert json.loads(json.dumps(result)) == {
+        "taskboard": "- [ ] finish", "observations": [
+            {"status": "success", "result": {"count": 3, "optional": None, "valid": True}}
+        ]}
+    result["observations"][0]["result"]["count"] = 99
+    assert block.content["observations"][0]["result"]["count"] == 3
+
+
+def test_sanitize_mapping_preserves_declared_types_when_requested():
+    from collections import UserDict
+    from types import MappingProxyType
+
+    value = UserDict({1: MappingProxyType({"value": (int, "quantity")})})
+    assert DataFormatter.sanitize(value) == {"1": {"value": ("int", "quantity")}}
+    assert DataFormatter.sanitize(value, remain_type=True) == {"1": {"value": (int, "quantity")}}
+
+
 def test_sanitize():
     from pydantic import BaseModel, Field
 
```

---

### Incident Patch 4: `b9603801` (2026-09-29)
**Commit Message**: Fix TaskBoard context readback and artifact text handoffs

**File**: `agently/builtins/plugins/AgentExecution/long_task/ArtifactDelivery.py` (modified, +36/-7)
```diff
@@ -1110,14 +1110,22 @@ def _task_workspace_artifact_body_from_evidence_text(
             return body
         return ""
 
-    @classmethod
-    def _task_workspace_artifact_delivery_mode(cls, result: Any) -> str:
+    def _task_workspace_artifact_delivery_mode(self, result: Any, *, context: Any = None) -> str:
         if not isinstance(result, Mapping):
             return ""
         manifest = result.get("artifact_manifest")
         if isinstance(manifest, Mapping) and manifest:
             return "sectioned_task_workspace_artifact"
-        for key in ("artifact_markdown", "artifact_html", "candidate_final_result", "final_result"):
+        keys = ["artifact_markdown", "artifact_html"]
+        if context is not None and (
+            self._taskboard_context_final_task_workspace_deliverables(context)
+            or (
+                self._required_task_workspace_deliverables()
+                and self._taskboard_context_card_is_leaf(context)
+            )
+        ):
+            keys.extend(("candidate_final_result", "final_result"))
+        for key in keys:
             value = result.get(key)
             if isinstance(value, str) and value.strip():
                 return "task_workspace_artifact"
@@ -1220,9 +1228,12 @@ def _prepare_taskboard_task_workspace_artifact_delivery(
         elif (
             required_paths
             and leaf_can_stage_terminal_candidate
-            and requested_path in required_paths
+            and (requested_path in required_paths or not manifest_dict)
         ):
-            terminal_target = requested_path
+            terminal_target = (
+                requested_path if requested_path in required_paths
+                else self._required_task_workspace_deliverables()[0]
+            )
         if terminal_target:
             staging_path = self._taskboard_terminal_candidate_path(
                 context,
@@ -2302,7 +2313,14 @@ async def _deliver_task_workspace_artifact(
             content = ""
             content_key = ""
         stream_draft_attempted = False
-        if not deliverable_mode and content_key == "answer":
+        if not deliverable_mode and (
+            content_key == "answer"
+            or (
+                card_context is not None
+                and content_key in {"candidate_final_result", "final_result"}
+                and not manifest_dict
+            )
+        ):
             if diagnostics:
                 result["diagnostics"] = DataFormatter.sanitize(diagnostics)
             return DataFormatter.sanitize(result)
@@ -3097,6 +3115,7 @@ async def _stream_task_workspace_artifact_draft(
             "draft_execution_id": str(getattr(draft_execution, "id", "") or ""),
         }
         wrote_any = False
+        received_delta = False
         bytes_written = 0
         carrier_path = path
         draft_stream = draft_execution.get_async_generator(
@@ -3151,13 +3170,14 @@ async def handle_public_replay_marker(marker: Mapping[str, Any]) -> None:
                 )
 
         async def write_chunk(chunk: str) -> None:
-            nonlocal wrote_any, bytes_written, carrier_path
+            nonlocal wrote_any, received_delta, bytes_written, carrier_path
             if not chunk:
                 return
             replay_marker = self._task_workspace_artifact_public_delta_replay_marker(chunk)
             if replay_marker is not None:
                 await handle_public_replay_marker(replay_marker)
                 return
+            received_delta = True
             write_result = await self.task_workspace.write_file(carrier_path, chunk, append=wrote_any)
             carrier_path = str(write_result.get("path") or carrier_path)
             wrote_any = True
@@ -3221,6 +3241,15 @@ async def write_chunk(chunk: str) -> None:
                 "status": draft_meta.get("status"),
                 "route": DataFormatter.sanitize(draft_meta.get("route")),
             }
+            if not received_delta and draft_meta.get("status") in {"success", "completed"}:
+                # A non-streaming request delivers its body only at completion.
+                # Read this settled execution; do not replay partial delta attempts.
+                completed_body = await self._await_task_request(
+                    draft_execution.async_get_data(),
+                    stage="task_workspace_artifact_draft_result",
+                )
+                if isinstance(completed_body, str):
+                    await write_chunk(completed_body)
         except Exception as error:
             message = _compact_agent_task_error_message(error, fallback=error.__class__.__name__)
             delivery_record.update(
```

**File**: `agently/builtins/plugins/AgentExecution/long_task/TaskBoardCardExecution.py` (modified, +5/-2)
```diff
@@ -1886,7 +1886,7 @@ async def run_card_work_unit(
             card_output, delivery_plan = self._prepare_taskboard_task_workspace_artifact_delivery(
                 card_output,
                 context,
-                deliverable_mode=self._task_workspace_artifact_delivery_mode(card_output),
+                deliverable_mode=self._task_workspace_artifact_delivery_mode(card_output, context=context),
             )
             card_output = await self._deliver_task_workspace_artifact(
                 card_output,
@@ -2700,7 +2700,10 @@ async def run_control_work_unit(_context: Mapping[str, Any]) -> Mapping[str, Any
             and not inline_repair
             and self._taskboard_control_output_allows_task_workspace_delivery(card_output)
         )
-        deliverable_mode = self._task_workspace_artifact_delivery_mode(card_output) if allow_task_workspace_delivery else None
+        deliverable_mode = (
+            self._task_workspace_artifact_delivery_mode(card_output, context=context)
+            if allow_task_workspace_delivery else None
+        )
         prefer_stream_draft = False
         if (
             allow_task_workspace_delivery
```

**File**: `agently/builtins/plugins/AgentExecution/long_task/TaskBoardReadback.py` (modified, +30/-6)
```diff
@@ -452,8 +452,17 @@ async def _run_taskboard_readback_card(
             "rationale": "Execute one TaskBoard artifact readback card through the shared Block carrier.",
             "step_scope": {},
         }
+        scoped_retrieval = self._taskboard_card_scoped_retrieval(context.card)
+        if scoped_retrieval:
+            carrier_plan["scoped_retrieval"] = scoped_retrieval
 
         async def run_readback_work_unit(_context: Mapping[str, Any]) -> Mapping[str, Any]:
+            scoped_payload = self._taskboard_card_payload_with_scoped_retrieval_results({}, _context)
+            scoped_results = scoped_payload.get("scoped_retrieval_results", [])
+            retrieved_groups = sum(
+                bool(item.get("locator_refs") or item.get("evidence_snippets"))
+                for item in scoped_results
+            )
             await self._emit(
                 f"agent_task.taskboard.card.{ self._stream_path_token(context.card.id) }.readback.started",
                 {
@@ -469,7 +478,7 @@ async def run_readback_work_unit(_context: Mapping[str, Any]) -> Mapping[str, An
             diagnostics: list[dict[str, Any]] = []
             readback_evidence_items: list[dict[str, Any]] = []
             if not refs and not file_refs:
-                status = "completed" if exhausted_ref_count else "blocked"
+                status = "completed" if exhausted_ref_count or retrieved_groups else "blocked"
                 success_count = 0
                 failed_count = 0
                 file_success_count = 0
@@ -479,7 +488,10 @@ async def run_readback_work_unit(_context: Mapping[str, Any]) -> Mapping[str, An
                         "code": (
                             "taskboard.readback.no_unread_ranges"
                             if exhausted_ref_count
-                            else "taskboard.readback.no_refs"
+                            else (
+                                "taskboard.readback.context_read"
+                                if scoped_retrieval else "taskboard.readback.no_refs"
+                            )
                         ),
                         "card_id": context.card.id,
                         "evidence_scope": evidence_card_ids or "all",
@@ -491,16 +503,22 @@ async def run_readback_work_unit(_context: Mapping[str, Any]) -> Mapping[str, An
                     "answer": (
                         "All scoped Action artifact and TaskWorkspace target ranges were already read; no duplicate read was issued."
                         if exhausted_ref_count
-                        else "No Action artifact refs or TaskWorkspace file refs are available for this readback card."
+                        else (
+                            f"Retrieved scoped Context results for {retrieved_groups} query groups; content completeness is recorded per result."
+                            if scoped_retrieval
+                            else "No Action artifact refs or TaskWorkspace file refs are available for this readback card."
+                        )
                     ),
                     "readbacks": readbacks,
                     "file_readbacks": file_readbacks,
                     "evidence": [],
                     "remaining_work": (
                         []
-                        if exhausted_ref_count
+                        if exhausted_ref_count or retrieved_groups
                         else [
-                            "Upstream cards must produce Action artifact refs or TaskWorkspace file refs before readback can run."
+                            "No scoped Context results were returned."
+                            if scoped_retrieval
+                            else "Upstream cards must produce Action artifact refs or TaskWorkspace file refs before readback can run."
                         ]
                     ),
                     "diagnostics": diagnostics,
@@ -665,7 +683,7 @@ async def read_task_workspace_ref(ref: Mapping[str, Any]) -> Mapping[str, Any]:
                         )
                 file_success_count = sum(1 for item in file_readbacks if item.get("ok"))
                 file_failed_count = len(file_readbacks) - file_success_count
-                status = "completed" if (success_count + file_success_count) > 0 else "failed"
+                status = "completed" if (success_count + file_success_count + retrieved_groups) > 0 else "failed"
                 remaining_work = []
                 if failed_count:
                     remaining_work.append(f"{ failed_count } artifact refs could not be read.")
@@ -708,6 +726,12 @@ async def read_task_workspace_ref(ref: Mapping[str, Any]) -> Mapping[str, Any]:
                     "diagnostics": diagnostics,
                 }
 
+            if scoped_retrieval:
+                payload.update(scoped_payload)
+                empty_groups = len(scoped_retrieval.get("query_groups", [])) - retrieved_groups
+                if empty_groups > 0 and status == "c
```

**File**: `compatibility/in-development.json` (modified, +1/-1)
```diff
@@ -432,7 +432,7 @@
       "context_contract": "AgentExecution and AgentTask share one TaskContext and one execution-scoped TaskWorkspace view.",
       "durability_contract": "Process state stays in memory/logs by default; record_store_recovery is opt-in.",
       "evidence_replan_contract": "A material-evidence replan_segment without an unresolved mounted capability first uses a dedicated ModelRequest to choose bounded semantic queries from host-offered TaskContext source kinds, then creates one or more Context-owned evidence-reacquisition cards before a dependent artifact-repair card. The host requires evidence_use to bind the exact new body-bearing owner/locator/content_version/range identities added to EvidenceLedger, excludes final-artifact self-readback from progress, and permits another repair only when a newly acquired reference is consumed by the original failed criterion or stable exact material-claim subject.",
-      "taskboard_live_evidence_contract": "Dependency readback evidence is canonicalized before prompt construction; prompt projection, host binding validation, acceptance indexing, result persistence, and a dedicated manifest-to-body artifact draft share one live ledger identity domain. A control result with sufficient=false cannot become completed through next_board_action=finalize; a sufficient completed draftable manifest may hand framework-owned materialization to the artifact-draft stage without being blocked by semantic remaining_work. Ordinary TaskBoard completion uses the loop finalization decision; a completed leaf-card candidate is not semantic proof by itself and candidate promotion is reserved for an explicit final TaskWorkspace delivery contract; terminal semantic verification is reserved for explicit delivery/capability contracts and deterministic integrity or lifecycle blocks. Ordinary finalizer replan_signal resumes existing repair/evidence cards without a second semantic verdict; blocked/clarify stop, invalid signals cannot accept or schedule work, and inline repairs preserve their output form. Shared evidence-binding repair skips model dispatch when its offered-reference projection is empty, preserving existing binding errors and terminal policy."
+      "taskboard_live_evidence_contract": "Dependency readback evidence is canonicalized before prompt construction; prompt projection, host binding validation, acceptance indexing, result persistence, and a dedicated manifest-to-body artifact draft share one live ledger identity domain. A control result with sufficient=false cannot become completed through next_board_action=finalize; a sufficient completed draftable manifest may hand framework-owned materialization to the artifact-draft stage without being blocked by semantic remaining_work. Ordinary TaskBoard completion uses the loop finalization decision; a completed leaf-card candidate is not semantic proof by itself and candidate promotion is reserved for an explicit final TaskWorkspace delivery contract; terminal semantic verification is reserved for explicit delivery/capability contracts and deterministic integrity or lifecycle blocks. Ordinary finalizer replan_signal resumes existing repair/evidence cards without a second semantic verdict; blocked/clarify stop, invalid signals cannot accept or schedule work, and inline repairs preserve their output form. Ordinary first-card text also stays inline unless an explicit artifact or final delivery contract requires materialization; a declared target stages existing complete text without redrafting. Readback cards execute declared scoped Context retrieval and retain locator/body completeness in the existing evidence ledger. Artifact drafting consumes the same settled text result when a non-streaming response supplied no delta; it neither repeats the model request nor revives a discarded partial delta attempt. Shared evidence-binding repair skips model dispatch when its offered-reference projection is empty, preserving existing binding errors and terminal policy."
     },
     "skills": {
       "surface": [
```

**File**: `docs/cn/start/auto-orchestration.md` (modified, +3/-1)
```diff
@@ -750,6 +750,8 @@ file carrier，不再静默切换到 inline summary hash。
 TaskWorkspace。未知 carrier id、未知 evidence id，或不是当前 carrier 精确 span 的 quote 都会
 fail closed，并生成结构化 material-claim repair contract。
 
+TaskBoard 卡片的普通 `candidate_final_result` / `final_result` 保持为正文答复；只有显式 artifact 或最终文件交付合同才物化为文件。最终卡片已返回完整正文但未给 manifest 路径时，Host 将现有正文暂存到指定目标对应的候选位置，不为搬运文件重新生成正文。readback 卡片也会通过现有 ContextReader 执行所声明的 `scoped_retrieval`；仅定位的结果仍是引用，正文读取的实际完整性则保留在共享证据账本中。
+
 当某个 bounded step 或 TaskBoard card 返回短小 `artifact_markdown` 正文或分段
 `artifact_manifest` 时，AgentTask 会通过绑定的 TaskWorkspace 写入交付物，并立刻
 readback。冷证据会记录 `path`、`bytes`、`sha256`、有界 preview 和 `file_refs`；
@@ -760,7 +762,7 @@ Markdown / plain text，不必为了携带正文而声明 `.output()`；如果
 `.output(..., format=...)` 的 `xml_field`、`hybrid` 或 `yaml_literal`；AgentTask 的
 TaskWorkspace artifact writer 消费的是 AgentExecution stream 事实：自然正文来自原始
 delta item，retry 边界优先来自 provider 报告的 `$status`。因此这条自然文本路径不要求
-draft request 使用 `.output()`。如果 public `type="delta"` replay marker
+draft request 使用 `.output()`。非流式草稿没有 delta 时，写入器读取同一次成功执行的最终正文，不追加模型请求，也不重复写入已有流式正文。如果 public `type="delta"` replay marker
 `"<$retry>...</$retry>"` 到达 artifact consumer，它会被当作 public replay
 delimiter 处理，绝不会写入或转运为 deliverable text，也不会被提升为 retry metadata；
 structured `$status` 仍是 retry control source。如果 bounded work unit 已经在结构化
```

**File**: `docs/en/start/auto-orchestration.md` (modified, +5/-1)
```diff
@@ -908,6 +908,8 @@ duplicate verifier claim keys and unknown evidence ids fail closed. Exact
 carrier identity and quote scope are reconstructed from the immutable host
 claim map before a structured material-claim repair contract is created.
 
+A TaskBoard card's ordinary `candidate_final_result` or `final_result` stays inline. It is materialized only when the card explicitly supplies an artifact or has a final file-delivery contract. If a final card supplies complete text without a manifest path, the Host stages that text for the declared target; it does not ask the model to rewrite it just to move it. A readback card also executes its declared `scoped_retrieval` through the existing ContextReader. Locator-only results remain references, while returned source bodies retain their actual completeness in the shared evidence ledger.
+
 When a bounded step or TaskBoard card returns a short `artifact_markdown` body
 or a sectioned `artifact_manifest`, AgentTask writes the deliverable through the
 bound TaskWorkspace and immediately reads it back. The cold evidence records
@@ -919,7 +921,9 @@ document can draft as natural Markdown/plain text with no `.output()` contract.
 AgentTask's TaskWorkspace artifact writer consumes AgentExecution stream facts:
 natural body text comes from raw delta items, and retry boundaries come from
 `$status` when the provider reports it. This natural-text path does not require
-the draft request to use `.output()`. If the public `type="delta"` replay marker
+the draft request to use `.output()`. A non-streaming draft uses the completed
+text from that same execution when no delta was delivered, without another
+model request or duplicating an already streamed body. If the public `type="delta"` replay marker
 `"<$retry>...</$retry>"` reaches the artifact consumer, it is treated as a
 public replay delimiter and is never written or transported as deliverable text.
 It is not promoted into retry metadata; structured `$status` remains the retry
```

**File**: `examples/agent_task_experiments/09_taskboard_inline_inventory.py` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+"""Read local task sources and return a TaskBoard report without a file artifact.
+
+Configure OMLX_BASE_URL, OMLX_API_KEY and optionally OMLX_MODEL in the environment.
+Expected key output from a real local Qwen3.8-27B-4bit run on 2026-09-29:
+K-11=27 (not below 20), M-24=14 (below 15), R-08=8 (below 10).
+The final report stayed inline; the workspace contained only the two input CSVs.
+Source files are synthetic business data; planning and calculations use the model.
+"""
+from __future__ import annotations
+
+import asyncio
+import os
+from pathlib import Path
+from tempfile import TemporaryDirectory
+
+from dotenv import find_dotenv, load_dotenv
+
+from agently import Agently
+
+
+async def main() -> None:
+    load_dotenv(find_dotenv(usecwd=True))
+    with TemporaryDirectory(prefix="agently-inventory-") as directory:
+        workspace = Path(directory)
+        (workspace / 'opening.csv').write_text('sku,opening,reorder_level\nK-11,40,20\nM-24,25,15\nR-08,12,10\n', encoding="utf-8")
+        (workspace / 'movements.csv').write_text('id,sku,kind,qty,status\nt1,K-11,out,18,posted\nt2,K-11,in,5,posted\nt3,M-24,out,14,posted\nt4,M-24,return,3,posted\nt5,R-08,out,6,void\nt6,R-08,out,4,posted\nt7,K-11,out,9,void\n', encoding="utf-8")
+        agent = Agently.create_agent().use_task_workspace(workspace)
+        agent.set_settings("plugins.ModelRequester.OpenAICompatible", {
+            "base_url": os.environ["OMLX_BASE_URL"],
+            "auth": os.environ["OMLX_API_KEY"],
+            "model": os.getenv("OMLX_MODEL", "Qwen3.8-27B-4bit"),
+            "stream": False,
+            "request_options": {"temperature": 0, "max_tokens": 8192,
+                                "chat_template_kwargs": {"enable_thinking": False}},
+        })
+
+        @agent.action_func
+        def read_document(path: str) -> dict[str, str]:
+            """Read a supplied task document by relative filename; no external data."""
+            target = (workspace / path).resolve()
+            target.relative_to(workspace.resolve())
+            return {"path": path, "content": target.read_text(encoding="utf-8")}
+
+        execution = (
+            agent.goal(
+                '核对仓库期末库存。读取 opening.csv 和 movements.csv，以期初加有效入库/退回、减有效出库计算每个SKU的期末库存；status=void的流水不计。用Markdown表格给出SKU、期末库存、补货线，以及是否低于补货线。补充简短处理口径，并引用读取的文件名。直接返回报告正文，不需要创建文件。',
+                success_criteria=['报告所有SKU的正确期末库存和是否低于补货线。', '计算基于实际读取的两份资料；作废流水不计，退回计入库存。'],
+            )
+            .use_actions([read_document])
+            .strategy("taskboard")
+        )
+        result = await execution.async_start()
+        print(result)
+        print("Workspace files:", sorted(str(path.relative_to(workspace))
+                                         for path in workspace.rglob("*") if path.is_file()))
+
+
+if __name__ == "__main__":
+    asyncio.run(main())
```

**File**: `examples/agent_task_experiments/README.md` (modified, +6/-0)
```diff
@@ -68,3 +68,9 @@ continues to require actual Host delivery and readback.
 
 When evidence bindings fail and no offered references are available, the Host
 skips the binding-repair model request and retains the unresolved result.
+
+`09_taskboard_inline_inventory.py` uses the configured local OpenAI-compatible
+model (`OMLX_BASE_URL`, `OMLX_API_KEY`, optional `OMLX_MODEL`). It reads two
+synthetic CSV sources and returns an inline inventory report. A normal text
+result does not request a file artifact; explicit file-delivery contracts still
+stage and promote the requested file through TaskWorkspace.
```

---

### Incident Patch 5: `dc3a5188` (2026-09-28)
**Commit Message**: fix: skip evidence binding repair without offered references

**File**: `agently/builtins/plugins/AgentExecution/long_task/Verification.py` (modified, +9/-4)
```diff
@@ -2612,17 +2612,22 @@ async def _request_evidence_binding_repair(
         language_policy: Mapping[str, Any],
         offered_reference_ids: set[str] | None = None,
     ) -> list[dict[str, Any]]:
+        candidates = self._evidence_binding_repair_candidate_refs(
+            evidence_ledger,
+            offered_reference_ids=offered_reference_ids,
+        )
+        # No selectable identity means no model repair is possible. Returning
+        # no repair preserves the caller's existing evidence errors.
+        if not candidates:
+            return []
         request = self.agent.create_temp_request()
         self._apply_language_policy_to_request(request, language_policy)
         request.input(
             {
                 "task_id": self.id,
                 "blocking_evidence_use_diagnostics": self._evidence_binding_repair_diagnostics(grounding_guard),
                 "current_evidence_use": grounding_guard.get("normalized_evidence_use", []),
-                "available_evidence_refs": self._evidence_binding_repair_candidate_refs(
-                    evidence_ledger,
-                    offered_reference_ids=offered_reference_ids,
-                ),
+                "available_evidence_refs": candidates,
                 "grounding_rules": evidence_ledger.get("grounding_rules", {}) if isinstance(evidence_ledger, Mapping) else {},
             }
         )
```

**File**: `compatibility/in-development.json` (modified, +1/-1)
```diff
@@ -432,7 +432,7 @@
       "context_contract": "AgentExecution and AgentTask share one TaskContext and one execution-scoped TaskWorkspace view.",
       "durability_contract": "Process state stays in memory/logs by default; record_store_recovery is opt-in.",
       "evidence_replan_contract": "A material-evidence replan_segment without an unresolved mounted capability first uses a dedicated ModelRequest to choose bounded semantic queries from host-offered TaskContext source kinds, then creates one or more Context-owned evidence-reacquisition cards before a dependent artifact-repair card. The host requires evidence_use to bind the exact new body-bearing owner/locator/content_version/range identities added to EvidenceLedger, excludes final-artifact self-readback from progress, and permits another repair only when a newly acquired reference is consumed by the original failed criterion or stable exact material-claim subject.",
-      "taskboard_live_evidence_contract": "Dependency readback evidence is canonicalized before prompt construction; prompt projection, host binding validation, acceptance indexing, result persistence, and a dedicated manifest-to-body artifact draft share one live ledger identity domain. A control result with sufficient=false cannot become completed through next_board_action=finalize; a sufficient completed draftable manifest may hand framework-owned materialization to the artifact-draft stage without being blocked by semantic remaining_work. Ordinary TaskBoard completion uses the loop finalization decision; a completed leaf-card candidate is not semantic proof by itself and candidate promotion is reserved for an explicit final TaskWorkspace delivery contract; terminal semantic verification is reserved for explicit delivery/capability contracts and deterministic integrity or lifecycle blocks. Ordinary finalizer replan_signal resumes existing repair/evidence cards without a second semantic verdict; blocked/clarify stop, invalid signals cannot accept or schedule work, and inline repairs preserve their output form."
+      "taskboard_live_evidence_contract": "Dependency readback evidence is canonicalized before prompt construction; prompt projection, host binding validation, acceptance indexing, result persistence, and a dedicated manifest-to-body artifact draft share one live ledger identity domain. A control result with sufficient=false cannot become completed through next_board_action=finalize; a sufficient completed draftable manifest may hand framework-owned materialization to the artifact-draft stage without being blocked by semantic remaining_work. Ordinary TaskBoard completion uses the loop finalization decision; a completed leaf-card candidate is not semantic proof by itself and candidate promotion is reserved for an explicit final TaskWorkspace delivery contract; terminal semantic verification is reserved for explicit delivery/capability contracts and deterministic integrity or lifecycle blocks. Ordinary finalizer replan_signal resumes existing repair/evidence cards without a second semantic verdict; blocked/clarify stop, invalid signals cannot accept or schedule work, and inline repairs preserve their output form. Shared evidence-binding repair skips model dispatch when its offered-reference projection is empty, preserving existing binding errors and terminal policy."
     },
     "skills": {
       "surface": [
```

**File**: `docs/cn/reference/execution-layer-selection.md` (modified, +3/-0)
```diff
@@ -89,3 +89,6 @@ TaskWorkspace 交付合同。
 `repair` 使用现有证据修复，`replan_segment` 先补充证据再修复，`blocked` 或
 `clarify` 等待缺失的外部条件。不追加 verifier 来选择下一步。Host 校验结构化信号，
 沿用无进展收敛；普通文字修复保留原来的内联输出形式。
+
+证据引用绑定失败时，只有实际可选引用集合非空才会请求模型修复绑定。空集合直接保留
+原有错误和未完成状态，不产生无可选项的模型请求，也不据此放宽完成条件。
```

**File**: `docs/en/reference/execution-layer-selection.md` (modified, +4/-0)
```diff
@@ -97,3 +97,7 @@ existing loop: `repair` corrects the result with current evidence;
 stops for an unavailable external condition. No second verifier is added to
 choose that transition. Host validates the signal and retains no-progress
 convergence; inline repairs preserve the inline output form.
+
+Evidence-binding repair requests a model only when the offered reference set has
+at least one candidate. With no candidates, existing errors and incomplete state
+remain unchanged; skipping the request does not authorize completion.
```

**File**: `examples/agent_task_experiments/README.md` (modified, +3/-0)
```diff
@@ -65,3 +65,6 @@ using available facts does not need another verifier to decide whether to run.
 Missing external input can still produce a blocked partial result; a task is
 not completed merely because all original cards finished. Explicit file delivery
 continues to require actual Host delivery and readback.
+
+When evidence bindings fail and no offered references are available, the Host
+skips the binding-repair model request and retains the unresolved result.
```

**File**: `tests/test_taskboard_final_continuation.py` (modified, +92/-0)
```diff
@@ -172,3 +172,95 @@ async def test_finalizer_references_must_belong_to_current_evidence(boundary, cu
     )
     assert result["status"] == ("repair_requested" if current else "blocked")
     assert calls["verifier"] == 0
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("ledger,offered", [
+    ({"items": []}, None),
+    ({"items": [{"id": "raw-id", "body": "Unselectable"}]}, None),
+    ({"items": [{"reference_id": "ref_old"}]}, {"ref_current"}),
+    ({"overflow_item_refs": [{"reference_id": "ref_old"}]}, set()),
+])
+async def test_binding_repair_skips_empty_offered_candidates(boundary, monkeypatch, ledger, offered):
+    task, _, _, _ = boundary
+    requests = []
+
+    def unexpected_request():
+        requests.append(True)
+        raise AssertionError("An empty choice set must not create a model request")
+
+    monkeypatch.setattr(task.agent, "create_temp_request", unexpected_request)
+    repaired = await task._request_evidence_binding_repair(
+        {"blocking_count": 1, "normalized_evidence_use": [{"claim": "Unresolved", "evidence_ids": []}]},
+        ledger,
+        language_policy={},
+        offered_reference_ids=offered,
+    )
+    assert repaired == []
+    assert requests == []
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("owner", ["finalizer", "card"])
+async def test_skipped_binding_request_preserves_unresolved_claim(boundary, monkeypatch, owner):
+    from agently.builtins.plugins.AgentExecution.long_task.EvidenceLedger import validate_evidence_use
+
+    task, _, _, _ = boundary
+    final = {"accepted": False, "final_result": "Partial result", "missing_criteria": ["External fact"],
+             "evidence_use": [{"claim": "External fact missing", "evidence_ids": [], "support_type": "unavailability"}]}
+    ledger = {"items": []}
+    guard = validate_evidence_use(final["evidence_use"], ledger)
+    assert guard["blocking_count"] > 0
+    requests = []
+
+    def unexpected_request():
+        requests.append(True)
+        raise AssertionError("No binding candidates")
+
+    monkeypatch.setattr(task.agent, "create_temp_request", unexpected_request)
+    if owner == "finalizer":
+        result, after = await task._repair_taskboard_final_evidence_use(final, guard, ledger, language_policy={})
+    else:
+        result, after, diagnostic = await task._repair_taskboard_card_evidence_use_with_model(
+            final, guard, ledger, language_policy={})
+        assert diagnostic["status"] == "no_match"
+    assert requests == []
+    assert after == guard
+    assert result["accepted"] is False
+    assert result["final_result"] == final["final_result"]
+    assert result["missing_criteria"] == final["missing_criteria"]
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("ledger_key", ["items", "overflow_item_refs"])
+async def test_binding_repair_still_dispatches_for_offered_candidate(boundary, monkeypatch, ledger_key):
+    task, _, _, _ = boundary
+    captured = {}
+    expected = [{"claim": "Observed fact", "evidence_ids": ["ref_visible"], "support_type": "content"}]
+
+    class Request:
+        def input(self, value):
+            captured["input"] = value
+            return self
+
+        def instruct(self, *args, **kwargs):
+            return self
+
+        def output(self, *args, **kwargs):
+            return self
+
+        async def async_get_data(self):
+            captured["dispatches"] = captured.get("dispatches", 0) + 1
+            return {"evidence_use": expected}
+
+    monkeypatch.setattr(task.agent, "create_temp_request", Request)
+    monkeypatch.setattr(task, "_apply_language_policy_to_request", lambda *args: None)
+    result = await task._request_evidence_binding_repair(
+        {"blocking_count": 1},
+        {ledger_key: [{"reference_id": "ref_hidden", "body": "Hidden"},
+                      {"reference_id": "ref_visible", "body": "Observed fact", "body_state": "full", "status": "ok"}]},
+        language_policy={}, offered_reference_ids={"ref_visible"},
+    )
+    assert result == expected
+    assert captured["dispatches"] == 1
+    assert [item["reference_id"] for item in captured["input"]["available_evidence_refs"]] == ["ref_visible"]
```

---

### Incident Patch 6: `6232ac92` (2026-09-28)
**Commit Message**: Align orchestration guide with TaskBoard completion ownership

**File**: `docs/cn/start/auto-orchestration.md` (modified, +4/-4)
```diff
@@ -445,10 +445,10 @@ AgentExecution 默认继承父执行的 strategy context，除非子执行显式
 Auto 可以复用 task-shape analysis 中通过校验的最小 board 形状；如果这个候选 board
 只是很小的线性序列，且没有真实 dependency、parallelism、readback 或 recovery 价值，
 则会记录 diagnostics 并回落到 Flat。显式 `execution="taskboard"` 仍然保留
-TaskBoard。TaskBoard 也可以把已经完成的终态 candidate 直接提升到 verification，
-跳过第二次 final synthesis 请求。这些优化只减少重复模型调用；最终 acceptance 仍然
-必须通过 canonical evidence ledger、TaskWorkspace readback evidence、deterministic host
-guards 和模型拥有的 terminal verification。
+TaskBoard。有明确最终 TaskWorkspace 交付合同时，可以把已完成的终态 candidate 直接
+提升到 verification，再由 Host 交付并读回。普通候选由 loop finalizer 判断语义完成；
+叶卡已完成本身不代表整个任务完成。明确的交付、能力及必需上下文合同，以及确定性的
+完整性或生命周期阻断，仍触发 terminal verification。
 
 ```python
 agent.language("zh-CN")
```

**File**: `docs/en/start/auto-orchestration.md` (modified, +7/-6)
```diff
@@ -505,12 +505,13 @@ strategy context unless the child explicitly calls `.strategy(...)`.
 Auto may reuse a validated minimal board shape from task-shape analysis or fall
 back to Flat when the proposed board is only a small linear sequence with no
 real dependency, parallelism, readback, or recovery value. Explicit
-`execution="taskboard"` still preserves TaskBoard. TaskBoard may also promote a
-completed terminal candidate directly to verification instead of paying for a
-second final synthesis request. These optimizations only remove redundant model
-calls; final acceptance still requires the canonical evidence ledger, TaskWorkspace
-readback evidence, deterministic host guards, and model-owned terminal
-verification.
+`execution="taskboard"` still preserves TaskBoard. With an explicit final
+TaskWorkspace delivery contract, TaskBoard may promote a completed terminal
+candidate directly to verification, followed by Host delivery and readback.
+Ordinary candidates go through the loop finalizer for their semantic completion
+decision; a completed leaf card alone does not establish task completion.
+Explicit delivery, capability and required-context contracts, and deterministic
+integrity or lifecycle blocks still trigger terminal verification.
 
 ```python
 agent.language("en")
```

---

### Incident Patch 7: `cdaae45a` (2026-09-28)
**Commit Message**: Keep ordinary TaskBoard completion in loop finalizer

**File**: `agently/builtins/plugins/AgentExecution/long_task/TaskBoardFinalization.py` (modified, +20/-9)
```diff
@@ -1138,6 +1138,12 @@ async def _finalize_taskboard(
                 budget_selection="content_first",
             )
         )
+        _terminal_deliverables, invalid_internal_terminal_paths = (
+            self._taskboard_terminal_task_workspace_deliverables(revision)
+        )
+        explicit_delivery_contract = bool(
+            self._required_task_workspace_deliverables() or _terminal_deliverables
+        )
         explicit_state_facts = (
             list(prepared["explicit_state_facts"])
             if isinstance(prepared.get("explicit_state_facts"), Sequence)
@@ -1246,11 +1252,20 @@ async def _finalize_taskboard(
         )
         if final is None:
             finalization_source = "model_finalizer"
-            final = self._promote_taskboard_final_candidate(
-                revision,
-                candidate_final_result=effective_candidate_final_result,
-                final_refs=final_refs,
-                board_status=result_status,
+            # A completed leaf card is not semantic proof for an ordinary
+            # task. Candidate promotion is a delivery fast path only after
+            # Host has an explicit final TaskWorkspace contract; otherwise
+            # the TaskBoard finalizer remains the single semantic completion
+            # owner.
+            final = (
+                self._promote_taskboard_final_candidate(
+                    revision,
+                    candidate_final_result=effective_candidate_final_result,
+                    final_refs=final_refs,
+                    board_status=result_status,
+                )
+                if explicit_delivery_contract
+                else None
             )
         if final is not None and not reusing_prepared_final:
             promotion_guard = validate_evidence_use(collect_evidence_use(final), evidence_ledger)
@@ -1347,9 +1362,6 @@ async def _finalize_taskboard(
             if self._taskboard_task_workspace_path_key(path)
             not in staged_target_keys
         ]
-        _terminal_deliverables, invalid_internal_terminal_paths = (
-            self._taskboard_terminal_task_workspace_deliverables(revision)
-        )
         required_skill_ids, required_skill_pack_ids = self._required_skill_context_selectors()
         # Skill/SkillPack requirements are authored context contracts. They
         # remain Host-owned hard gates, while ordinary semantic completion stays
@@ -1358,7 +1370,6 @@ async def _finalize_taskboard(
         # The TaskBoard loop owns ordinary semantic completion. A second
         # semantic verdict is only justified by an explicit Host-owned hard
         # contract or a deterministic integrity/lifecycle block.
-        explicit_delivery_contract = bool(self._required_task_workspace_deliverables())
         explicit_capability_contract = bool(self._capability_evidence_requirements())
         terminal_hard_gate = bool(
             explicit_delivery_contract
```

**File**: `compatibility/in-development.json` (modified, +1/-1)
```diff
@@ -432,7 +432,7 @@
       "context_contract": "AgentExecution and AgentTask share one TaskContext and one execution-scoped TaskWorkspace view.",
       "durability_contract": "Process state stays in memory/logs by default; record_store_recovery is opt-in.",
       "evidence_replan_contract": "A material-evidence replan_segment without an unresolved mounted capability first uses a dedicated ModelRequest to choose bounded semantic queries from host-offered TaskContext source kinds, then creates one or more Context-owned evidence-reacquisition cards before a dependent artifact-repair card. The host requires evidence_use to bind the exact new body-bearing owner/locator/content_version/range identities added to EvidenceLedger, excludes final-artifact self-readback from progress, and permits another repair only when a newly acquired reference is consumed by the original failed criterion or stable exact material-claim subject.",
-      "taskboard_live_evidence_contract": "Dependency readback evidence is canonicalized before prompt construction; prompt projection, host binding validation, acceptance indexing, result persistence, and a dedicated manifest-to-body artifact draft share one live ledger identity domain. A control result with sufficient=false cannot become completed through next_board_action=finalize; a sufficient completed draftable manifest may hand framework-owned materialization to the artifact-draft stage without being blocked by semantic remaining_work. Ordinary TaskBoard completion uses the loop finalization decision; terminal semantic verification is reserved for explicit delivery/capability contracts and deterministic integrity or lifecycle blocks."
+      "taskboard_live_evidence_contract": "Dependency readback evidence is canonicalized before prompt construction; prompt projection, host binding validation, acceptance indexing, result persistence, and a dedicated manifest-to-body artifact draft share one live ledger identity domain. A control result with sufficient=false cannot become completed through next_board_action=finalize; a sufficient completed draftable manifest may hand framework-owned materialization to the artifact-draft stage without being blocked by semantic remaining_work. Ordinary TaskBoard completion uses the loop finalization decision; a completed leaf-card candidate is not semantic proof by itself and candidate promotion is reserved for an explicit final TaskWorkspace delivery contract; terminal semantic verification is reserved for explicit delivery/capability contracts and deterministic integrity or lifecycle blocks."
     },
     "skills": {
       "surface": [
```

**File**: `docs/cn/reference/execution-layer-selection.md` (modified, +2/-0)
```diff
@@ -82,3 +82,5 @@ Host 写入。指定最终路径时，Host 可以将已接受的候选制品复
 对于没有明确交付或能力合同的普通 TaskBoard 结果，由 loop 的最终判断驱动完成。
 终端语义校验只在明确硬合同、确定性完整性问题或生命周期阻断时保留，不再自动对
 每个文字结果追加第二轮审阅。
+已完成的叶卡候选本身不等于语义完成证明；候选提升仅用于明确的最终
+TaskWorkspace 交付合同。
```

**File**: `docs/en/reference/execution-layer-selection.md` (modified, +2/-0)
```diff
@@ -88,3 +88,5 @@ For ordinary TaskBoard results without an explicit delivery or capability
 contract, the loop's finalization decision drives completion. Terminal semantic
 verification remains for explicit hard contracts and deterministic integrity or
 lifecycle blocks; it is not an automatic second review of every text result.
+A completed leaf-card candidate is not semantic proof by itself; candidate
+promotion is reserved for an explicit final TaskWorkspace delivery contract.
```

**File**: `tests/test_agent_task_loop.py` (modified, +35/-13)
```diff
@@ -17441,7 +17441,8 @@ async def noop(*_args, **_kwargs):
 
 
 @pytest.mark.asyncio
-async def test_taskboard_finalization_promotes_single_terminal_candidate_without_finalizer(tmp_path, monkeypatch):
+@pytest.mark.parametrize("accepted", [True, False])
+async def test_taskboard_finalization_uses_loop_finalizer_for_ordinary_terminal_candidate(tmp_path, monkeypatch, accepted):
     agent = _create_agent("agent-taskboard-final-promotion").use_task_workspace(tmp_path / "task_workspace")
     task = AgentTask(
         agent,
@@ -17477,9 +17478,14 @@ async def test_taskboard_finalization_promotes_single_terminal_candidate_without
     )
     calls = {"finalizer": 0, "verifier": 0}
 
-    async def fail_finalizer(*_args, **_kwargs):
+    async def finalizer(*_args, **_kwargs):
         calls["finalizer"] += 1
-        raise AssertionError("TaskBoard finalizer should be skipped for promotable terminal candidate.")
+        return {
+            "accepted": accepted,
+            "reason": "The TaskBoard finalizer owns the completion decision.",
+            "final_result": "Final report body from the completed terminal card.",
+            "missing_criteria": [] if accepted else ["Required report content is missing."],
+        }
 
     async def complete_verifier(*_args, **kwargs):
         calls["verifier"] += 1
@@ -17502,7 +17508,7 @@ async def complete_verifier(*_args, **kwargs):
     async def noop(*_args, **_kwargs):
         return None
 
-    monkeypatch.setattr(cast(Any, task), "_request_taskboard_final", fail_finalizer)
+    monkeypatch.setattr(cast(Any, task), "_request_taskboard_final", finalizer)
     monkeypatch.setattr(cast(Any, task), "_request_verification", complete_verifier)
     monkeypatch.setattr(cast(Any, task), "_record_phase", noop)
     monkeypatch.setattr(cast(Any, task), "_emit", noop)
@@ -17518,10 +17524,11 @@ async def noop(*_args, **_kwargs):
         },
     )
 
-    assert result == {"terminal": True, "status": "completed"}
-    assert calls == {"finalizer": 0, "verifier": 0}
+    assert result == {"terminal": True, "status": "completed" if accepted else "blocked"}
+    assert task.result["accepted"] is accepted
+    assert calls == {"finalizer": 1, "verifier": 0}
     terminal_state = cast(dict[str, Any], task._terminal_taskboard_state)
-    assert terminal_state["finalization_source"] == "candidate_promotion"
+    assert terminal_state["finalization_source"] == "model_finalizer"
     assert "taskboard" not in task.result
     assert task.result["artifact_refs"] == []
 
@@ -17728,7 +17735,12 @@ async def test_taskboard_finalization_repairs_missing_declared_leaf_artifact_ins
     )
 
     async def fail_finalizer(*_args, **_kwargs):
-        raise AssertionError("The unique leaf candidate should skip redundant final synthesis.")
+        return {
+            "accepted": True,
+            "reason": "The finalizer accepted the candidate pending Host path checks.",
+            "final_result": "# Final Report\n\nComplete candidate body.\n",
+            "missing_criteria": [],
+        }
 
     async def accepting_verifier(*_args, **kwargs):
         execution_result = kwargs["execution_result"]
@@ -17840,7 +17852,12 @@ async def test_taskboard_finalization_fails_closed_for_model_declared_internal_w
     )
 
     async def fail_finalizer(*_args, **_kwargs):
-        raise AssertionError("The unique leaf candidate should skip redundant final synthesis.")
+        return {
+            "accepted": True,
+            "reason": "The finalizer accepted the candidate pending Host path checks.",
+            "final_result": "TaskWorkspace artifact delivered.",
+            "missing_criteria": [],
+        }
 
     async def accepting_verifier(*_args, **kwargs):
         return {
@@ -18192,7 +18209,12 @@ async def test_taskboard_finalization_does_not_use_acceptance_cache_as_terminal_
 
     async def fail_finalizer(*_args, **_kwargs):
         calls["finalizer"] += 1
-        raise AssertionError("TaskBoard finalizer should be skipped for promotable terminal candidate.")
+        return {
+            "accepted": True,
+            "reason": "The finalizer accepted the current candidate.",
+            "final_result": "Final report body from the completed terminal card.",
+            "missing_criteria": [],
+        }
 
     async def terminal_verifier(*_args, **_kwargs):
         calls["verifier"] += 1
@@ -18245,7 +18267,7 @@ async def noop(*_args, **_kwargs):
     )
 
     assert result == {"terminal": True, "status": "completed"}
-    assert calls == {"finalizer": 0, "verifier": 0}
+    assert calls == {"finalizer": 1, "verifier": 0}
     assert task.result["accepted"] is True
     terminal_state = cast(dict[str, Any], task._terminal_taskboard_state)
     assert terminal_state["acceptance_verification_plan"]["all_satisfied"] is True
@@ -18302,7 +18324,7 @@ async def test_taskboard_final_gate_blocks_only_explicit_dirty_state_facts(tmp_p
 
     async def fail_finalizer(*_args, **_kwargs)
```

---

### Incident Patch 8: `c0207774` (2026-09-21)
**Commit Message**: Fix complete task context delivery for Skill selection

(cherry picked from commit b0b78966aea015ec5ae3ce409e85103760117fed)

**File**: `agently/builtins/agent_extensions/SkillsExtension/SkillsExtension.py` (modified, +22/-5)
```diff
@@ -657,7 +657,8 @@ def _resolve_pack_packages(
     async def _async_select_optional_packages(
         self,
         *,
-        task: str,
+        task: Mapping[str, Any],
+        task_context: Mapping[str, Any],
         packages: Sequence[SkillPackageRevision],
         diagnostics: list[dict[str, Any]],
     ) -> list[SkillPackageRevision]:
@@ -689,11 +690,16 @@ async def _async_select_optional_packages(
             request = cast(Any, request_factory())
             result = await (
                 request
-                .input({"task": task})
-                .info({"offered_skills": cards})
+                .input(dict(task))
+                .info({"task_context": dict(task_context), "offered_skills": cards})
                 .instruct(
                     "Select only installed Skills whose real-world procedure is useful "
-                    "for this task. Return only offered skill_key values. Do not copy "
+                    "for the complete task described by input and info.task_context, "
+                    "including all goals, success criteria, constraints, and delivery requirements. "
+                    "Use the original task context only to judge applicability; "
+                    "do not perform the task in this request. "
+                    "Return only offered skill_key values, without duplicates; "
+                    "return an empty list when none apply. Do not copy "
                     "package identity, paths, revisions, metadata, or instructions."
                 )
                 .output(
@@ -818,8 +824,19 @@ async def async_bind_skills_for_execution(self, execution: Any) -> list[SkillBin
                 package.revision_ref for package in optional_packages
             ],
         }
+        prompt = execution.request_prompt.get()
+        task_context = {
+            slot: prompt[slot]
+            for slot in ("system", "info", "instruct", "output")
+            if prompt.get(slot) is not None and prompt[slot] != "" and prompt[slot] != [] and prompt[slot] != {}
+        }
         selected_optional = await self._async_select_optional_packages(
-            task=execution.task_target(),
+            task={
+                "goals": list(execution.goal_items),
+                "success_criteria": list(execution.success_criteria_items),
+                "input": prompt.get("input"),
+            },
+            task_context=task_context,
             packages=optional_packages,
             diagnostics=diagnostics,
         )
```

**File**: `compatibility/in-development.json` (modified, +9/-0)
```diff
@@ -49,6 +49,15 @@
     "prerequisite": "after_output"
   },
 
+  "skill_applicability_input": {
+    "status": "in_development",
+    "since": "4.1.4.9",
+    "owner": "AgentExecution / SkillsExtension",
+    "task_fields": ["all declared goals", "success_criteria", "input", "system", "info", "instruct", "output"],
+    "selection_output": "selected_keys: ordered unique subset of offered keys, including empty",
+    "additional_model_requests": false,
+    "scope_or_execution_authorization_changed": false
+  },
   "shell_capability": {
     "status": "in_development",
     "entry": "Agent.enable_shell",
```

**File**: `docs/cn/development/skills-executor.md` (modified, +5/-0)
```diff
@@ -55,6 +55,11 @@ result = await execution.async_get_data()
 `mode="model_decision"` 下，AgentExecution 用结构化 `ModelRequest` 从宿主发放
 的 key 中选择，校验后绑定 revision；未知或重复 key 会 fail closed。
 
+4.1.4.9 的适用性请求会同时考虑全部已声明目标、验收条件、原始 input，以及
+system/info/instruct/output 中的任务约束和交付要求。可选 Skill 仍只返回候选 key；
+没有适用项时可以不选。把后续阶段的已知要求在准备前写入本次 execution，避免
+选择时缺少依据；这不会增加选择请求，也不会自动授予脚本执行权限。
+
 Skills 与 Actions 使用同一种组合表达，不新增另一套公开集合 API。
 `agent.use_skills(..., always=True)` 配置 Agent 默认可用集合，
 `execution.use_skills(...)` 增加本次 execution 的声明。选择前，AgentExecution
```

**File**: `docs/en/development/skills-executor.md` (modified, +7/-0)
```diff
@@ -59,6 +59,13 @@ result = await execution.async_get_data()
 select from host-issued keys, validates the result, and binds the chosen
 revisions. Unknown or duplicate keys fail closed.
 
+In 4.1.4.9, applicability selection considers every declared goal and success
+criterion, the original input, and task constraints and delivery requirements
+from system/info/instruct/output. It still returns only offered Skill keys and
+may select none. Declare known requirements for later phases before preparing
+the execution so selection can account for them. This adds no selection request
+and grants no script execution permission.
+
 Skills use the same composition grammar as Actions; there is no separate public
 collection API. `agent.use_skills(..., always=True)` configures the Agent defaults,
 while `execution.use_skills(...)` adds declarations for one execution. Before
```

**File**: `examples/skills_executor/12_complete_task_selection.py` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+"""Select optional Skills using the complete declared task (4.1.4.9).
+
+Set AGENTLY_BASE_URL, AGENTLY_API_KEY and AGENTLY_MODEL.
+Optional AGENTLY_REQUEST_OPTIONS supplies a JSON object of provider options.
+
+Working principle:
+    all goals + criteria + original task facts -> one real selection request
+    -> validated host keys -> exact Skill bindings
+
+This example inspects preparation only. It does not execute the probe or
+claim that binding a Skill authorizes its script.
+
+Expected key output from a real local Qwen run:
+    selected=["Release Checklist", "script-release-probe"]
+    unchanged_preparation_reuses_bindings=True
+The observed run made one selection request; repeated preparation made none.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import json
+import os
+from pathlib import Path
+import sys
+from tempfile import TemporaryDirectory
+
+ROOT = Path(__file__).resolve().parents[2]
+if str(ROOT) not in sys.path:
+    sys.path.insert(0, str(ROOT))
+
+from agently import Agently  # noqa: E402
+from agently.core import SkillLibrary  # noqa: E402
+
+
+async def run_example() -> dict[str, object]:
+    with TemporaryDirectory(prefix="agently-complete-task-") as directory:
+        root = Path(directory)
+        agent = Agently.create_agent().use_task_workspace(root / "files")
+        agent.set_settings("plugins.ModelRequester.OpenAICompatible", {
+            "base_url": os.environ["AGENTLY_BASE_URL"],
+            "auth": os.environ["AGENTLY_API_KEY"],
+            "model": os.environ["AGENTLY_MODEL"],
+            "stream": False,
+            "request_options": json.loads(os.getenv("AGENTLY_REQUEST_OPTIONS", "{}")),
+        })
+        agent.skill_library = SkillLibrary(root / "library")
+        packages = [
+            agent.skill_library.install(Path(__file__).parent / "skills" / name, trust="trusted")
+            for name in ("release-checklist", "script-release-probe")
+        ]
+        execution = (
+            agent.create_execution()
+            .goal(
+                ["Prepare the release-readiness checklist", "Run the component probe and report its observed status and token"],
+                success_criteria=["Base the report on actual release facts and probe output"],
+                turn_on_long_task=False,
+            )
+            .input({"release": "4.1.4.9", "component": "Shell Runtime"})
+            .use_skills([package.revision_ref for package in packages])
+        )
+        await execution.async_prepare_task_context()
+        first_bindings = tuple(execution.skill_bindings)
+        await execution.async_prepare_task_context()
+        selected = {binding.revision_ref for binding in execution.skill_bindings}
+        return {
+            "selected": [package.name for package in packages if package.revision_ref in selected],
+            "unchanged_preparation_reuses_bindings": tuple(execution.skill_bindings) == first_bindings,
+        }
+
+
+if __name__ == "__main__":
+    print(json.dumps(asyncio.run(run_example()), ensure_ascii=False, indent=2))
```

**File**: `examples/skills_executor/README.md` (modified, +6/-0)
```diff
@@ -45,6 +45,7 @@ python examples/skills_executor/08_architecture_diagram_skill.py
 python examples/skills_executor/09_skill_script_exec.py
 python examples/skills_executor/10_model_pool_key_pool_resolution.py
 python examples/skills_executor/11_conditional_resource_read.py
+python examples/skills_executor/12_complete_task_selection.py
 ```
 
 `09_skill_script_exec.py` uses two requests in one Session. The first does not
@@ -58,3 +59,8 @@ from the conditions in the already-read root Skill. Configure `AGENTLY_BASE_URL`
 `AGENTLY_API_KEY`, and `AGENTLY_MODEL` explicitly. It compares outline and handoff
 phases through the existing execution context reader, without mounting Actions
 or generating a final business answer.
+
+`12_complete_task_selection.py` uses a real model to select optional Skills from
+all declared goals, criteria and original task facts. Configure the same
+`AGENTLY_*` variables; `AGENTLY_REQUEST_OPTIONS` accepts provider-specific JSON
+options. It inspects preparation and binding reuse without executing scripts.
```

**File**: `tests/test_agent_skills_reconnection.py` (modified, +70/-2)
```diff
@@ -67,6 +67,75 @@ async def async_get_data(self) -> dict[str, Any]:
         return await super().async_get_data()
 
 
+@pytest.mark.asyncio
+async def test_skill_selection_receives_complete_task_without_replacing_its_output(
+    tmp_path: Path,
+) -> None:
+    """Request delivery is a protocol assertion, not a semantic relevance test."""
+    library = SkillLibrary(tmp_path / "library")
+    package = library.install(
+        _write_skill(tmp_path / "guide", name="Review", description="Review a report."),
+        trust="trusted",
+    )
+    agent = Agently.create_agent("skill-complete-task").use_task_workspace(tmp_path / "work")
+    agent.skill_library = library
+    request = _ExecutionAwareSelectionRequest(["skill-option:1"])
+    cast(Any, agent).create_temp_request = lambda: request
+    execution = (
+        agent.create_execution()
+        .goal(["Analyze the report", "Prepare the external handoff"],
+              success_criteria=["Remove personal details"], turn_on_long_task=False)
+        .input({"source": "quarterly report"})
+        .system({"audience": "external partners"})
+        .info({"handling": "contact information is private"})
+        .instruct("Deliver a reusable spreadsheet")
+        .output({"workbook": (str, "Path to the completed workbook", True)})
+        .use_skills(package.revision_ref)
+    )
+    # Use the authoritative draft, including direct pre-start Prompt writes.
+    execution.request_prompt.set("info", {"handling": "redact contacts before delivery"})
+    prompt = execution.request_prompt.get()
+    assert isinstance(prompt, dict)
+    original_prompt = dict(prompt)
+
+    await execution.async_prepare_task_context()
+    await execution.async_prepare_task_context()
+
+    assert request.slots["input"] == {
+        "goals": ["Analyze the report", "Prepare the external handoff"],
+        "success_criteria": ["Remove personal details"],
+        "input": {"source": "quarterly report"},
+    }
+    assert request.slots["info"]["task_context"] == {
+        key: original_prompt[key] for key in ("system", "info", "instruct", "output")
+    }
+    assert list(request.slots["output"]) == ["selected_keys"]
+    assert execution.request_prompt.get() == original_prompt
+    assert request.call_count == 1
+
+
+@pytest.mark.asyncio
+async def test_skill_selection_preserves_input_when_no_goal_is_declared(tmp_path: Path) -> None:
+    library = SkillLibrary(tmp_path / "library")
+    package = library.install(
+        _write_skill(tmp_path / "guide", name="Review", description="Review a report."),
+        trust="trusted",
+    )
+    agent = Agently.create_agent("skill-input-only").use_task_workspace(tmp_path / "work")
+    agent.skill_library = library
+    request = _SelectionRequest([])
+    cast(Any, agent).create_temp_request = lambda: request
+    execution = agent.create_execution().input("Review the attached report").use_skills(package.revision_ref)
+
+    await execution.async_prepare_task_context()
+
+    assert request.slots["input"] == {
+        "goals": [], "success_criteria": [], "input": "Review the attached report",
+    }
+    assert request.slots["info"]["task_context"] == {}
+    assert execution.skill_bindings == []
+
+
 @pytest.mark.asyncio
 async def test_model_decision_skill_selection_uses_host_keys_and_exact_revision(
     tmp_path: Path,
@@ -263,8 +332,7 @@ async def test_fresh_user_execution_reselects_agent_default_skills(tmp_path: Pat
     assert [binding.revision_ref for binding in first.skill_bindings] == [packages[0].revision_ref]
     assert [binding.revision_ref for binding in later.skill_bindings] == [packages[1].revision_ref]
     assert request.call_count == 2
-    assert "Deliver the report" in request.slots["input"]["task"]
-    assert "Plan the report" not in request.slots["input"]["task"]
+    assert request.slots["input"]["input"] == "Deliver the report"
     assert request.observed_execution_context is later.execution_context
 
 
```

---

### Incident Patch 9: `ae664003` (2026-09-22)
**Commit Message**: Add model capabilities introduction guide

**File**: `docs/cn/models/README.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # Models
 
+先阅读：[模型角色与多模态 Execution](model-capabilities-guide.md)。它从整体流程介绍
+用途配置、Requester、Execution、VLM/OCR、音频、向量以及 SystemOne/Jev；下面的页面
+再分别展开协议和配置细节。
+
 建议阅读顺序：
 
 1. [模型概览](overview.md)：先理解 `OpenAICompatible`、`OpenAIResponsesCompatible`、`AnthropicCompatible` 的边界。
```

**File**: `docs/cn/models/model-capabilities-guide.md` (added, +259/-0)
```diff
@@ -0,0 +1,259 @@
+---
+title: 模型角色与多模态 Execution
+description: Agently 如何配置不同模型用途，并把视觉、OCR、音频、向量和 SystemOne 组织到一次 Execution 中。
+keywords: Agently, Execution, VLM, OCR, STT, TTS, embeddings, SystemOne, Jev
+---
+
+# 模型角色与多模态 Execution
+
+Agently 把“使用哪一种模型”和“这次任务怎样运行”分开处理。
+`llm`、`vlm`、`ocr`、`stt`、`tts`、`embeddings` 是模型用途；`OpenAICompatible`、
+`AnthropicCompatible`、`OMLX` 和 `Jev` 是协议或服务适配器。用途配置选择模型，
+Requester 负责一次原子协议请求，`AgentExecution` 负责把多个阶段组织成一个可观察、
+可取消、共享重试额度的任务。
+
+因此，即使任务最后只有一次模型请求，也从 Execution 进入。这样直接请求和多阶段任务
+拥有相同的生命周期、结果读取、取消、重试和元信息边界；未来增加 OCR、SystemOne 或
+语音交付时，不需要再设计一套并行调度入口。
+
+## 1. 按用途配置模型
+
+每种用途都有自己的 provider、model、连接信息和 `request_options`。相同 provider 的
+不同用途也不会互相继承密钥、headers 或生成参数。
+
+```python
+import os
+
+from dotenv import find_dotenv, load_dotenv
+from agently import Agently
+
+load_dotenv(find_dotenv(usecwd=True))
+
+agent = Agently.create_agent()
+connection = {
+    "base_url": os.environ["OMLX_BASE_URL"],
+    "api_key": os.environ["OMLX_API_KEY"],
+}
+
+agent.set_settings("llm", {
+    "provider": "OpenAICompatible",
+    **connection,
+    "model": os.environ["LLM_MODEL"],
+    "request_options": {"temperature": 0},
+})
+agent.set_settings("vlm", {
+    "provider": "OpenAICompatible",
+    **connection,
+    "model": os.environ["VLM_MODEL"],
+})
+agent.set_settings("ocr", {
+    "provider": "OpenAICompatible",
+    **connection,
+    "model": os.environ["OCR_MODEL"],
+})
+agent.set_settings("stt", {"provider": "OMLX", **connection, "model": os.environ["STT_MODEL"]})
+agent.set_settings("tts", {"provider": "OMLX", **connection, "model": os.environ["TTS_MODEL"]})
+agent.set_settings("embeddings", {
+    "provider": "OpenAICompatible",
+    **connection,
+    "model": os.environ["EMBEDDING_MODEL"],
+})
+```
+
+也可以把用途配置为 `{"model_key": "pool-alias"}`，引用已有模型池。`model_key` 与
+inline provider/model 配置互斥，显式请求覆盖优先于默认的 `llm`。缺少用途配置、配置
+无效或服务不支持目标能力时，调用会在对应边界报错，不会静默换模型。
+
+Requester 按协议选择，而不是按模型名称选择。例如，oMLX 提供 OpenAI 兼容接口时，
+GLM-OCR 和 PaddleOCR 都复用 `OpenAICompatible`；只有服务协议不同，才需要新增独立
+Requester。模型用途 `ocr` 不等于一个固定的 OCR 模型注册表。
+
+## 2. 图片、VLM 与 OCR
+
+`image()` 添加图片组，`question` 只描述这组图片的问题；`.input()` 描述整体任务，
+`.output()` 定义最终结果合同。多次调用会按顺序追加图片及其局部问题。
+
+```python
+execution = (
+    agent.image("note.png", question="仔细阅读这张留言条，并保留可辨认的文字。")
+    .input("哈蒙德在哪里？")
+    .output({"location": str, "evidence": str})
+)
+result = await execution.async_get_data()
+```
+
+普通图片任务由配置决定拓扑：
+
+| 配置 | 路由 |
+| --- | --- |
+| 只有 `vlm` | VLM 直接生成最终结果 |
+| 只有 `llm` | LLM 直接处理原图（前提是服务支持视觉） |
+| 同时有 `vlm` 与 `llm` | VLM 生成视觉证据，LLM 生成最终结果 |
+| `mode="llm"` | 本次图片绕过独立 VLM，原图交给 `llm` |
+| `mode="ocr"` | OCR 提取文字，再交给 `llm` 完成整体任务 |
+
+`.vlm_only(True)` 可以在 Execution 启动前显式要求配置的 VLM 直接产出最终结果。
+`.to_text()` 是直接图片操作，即使 Agent 同时配置了 `llm` 也不会追加 LLM；普通
+`get_text()` 只是已完成结果的读取视图。
+
+纯 OCR 提取可以这样写：
+
+```python
+text = await agent.image("note.png", mode="ocr").async_to_text(max_retries=0)
+print(text)
+```
+
+带问题和结构化输出时，OCR 结果会成为后续 LLM 的输入证据：
+
+```python
+answer = await (
+    agent.image("note.png", mode="ocr")
+    .input("哈蒙德在哪里？只根据识别出的文字回答。")
+    .output({"answer": str, "evidence": str})
+    .async_get_data()
+)
+```
+
+`max_retries` 默认是 3；设为 0 只关闭本次 Execution 的修复重试，不改变路由。前置
+OCR 阶段失败同样消耗整体调度的重试额度。可运行的纯 OCR 与 OCR→LLM 示例见
+[ocr.py](../../../examples/model_capabilities/ocr.py)。
+
+## 3. 音频与向量
+
+音频输入是一个明确的处理声明，不是普通字典字段。`type="audio"` 触发 STT 前处理，
+转录内容再进入同一个 Execution；`.say()` 是文本完成后的 TTS 消费动作。
+
+```python
+execution = (
+    agent.input(file="question.wav", type="audio")
+    .instruct("简洁回答。")
+)
+text = await execution.async_get_text()
+speech = await execution.async_say(scope="final")
+```
+
+`scope="final"` 只朗读最终文本，`scope="all"` 还包括 Execution 已公开的自然语言过程。
+原始 delta、reasoning、工具参数和 JSON 碎片不属于朗读内容。需要分段交付时使用
+`stream_say(scope=...)`；它复用既有 TTS 分段和背压，不隐式播放或写文件。
+
+向量是独立动作，不修改 `llm` 配置，也不自动迁移已有索引的模型身份：
+
+```python
+vectors = await agent.async_embed(["温室", "图书馆"])
+assert len(vectors) == 2
+```
+
+返回行顺序与输入一致；缺失、重复、维度不一致或非有限值会报错。
+
+## 4. SystemOne：可替换的快思考层
+
+SystemOne 是 Execution 中的一个模型角色，不绑定某一种模型或输出格式。它可以使用
+Jev，也可以使用小型 LLM 或服务支持的 no-reasoning 模式。输出模板定义结果合同，
+SystemOne 只负责选择并执行专用模型。
+
+```python
+from agently import Probability, Score
+
+agent.set_settings("system_one", {
+    "provider": "OpenAICompatible",
+    **connection,
+    "model": os.environ["SYSTEM_ONE_MODEL"],
+    "request_options": {
+        "temperature": 0,
+        "chat_template_kwargs": {"enable_thinking": False},
+    },
+})
+
+result = await (
+    agent.input("所有打款都失败了，请今天修复。")
+    .output({
+        "urgent": Probability("客户是否明确要求今天修复？"),
+        "urgency": Score("请求有多紧急？", ["未表达", "有时效要求", "明确要求当天处理"]),
+        "summary": (str, "结合事实与判断给出一句总结"),
+    })
+    .async_get_data()
+)
+```
+
+配置 `system_one` 后默认开启；未配置时默认关闭，`.use_system_one(False)` 可以对
+当前 Execution 显式关闭。关闭后模板交给普通 LLM；这会改变模型角色，但不会删除
+输出合同或依赖关系。
+
+没有依赖的模板可以先由 SystemOne 产出，再由普通 LLM 完成其他字段。若模板通过
+`from_output` 或 `after_output` 声明依赖，Execution 会根据字段依赖安排阶段：
+
+```python
+from agently import 
```

---

### Incident Patch 10: `d7999b75` (2026-09-21)
**Commit Message**: Clarify Jev activation and credential requirements

**File**: `compatibility/in-development.json` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@
     "binding": "from_output: string or path array",
     "configuration": "system_one.provider=Jev; Jev / plugins.ModelRequester.Jev credentials",
     "owner": "AgentExecution; atomic Jev ModelRequester",
-    "fallback": "unconfigured or explicitly disabled Jev uses LLM schema estimates; provider failures do not fall back",
+    "fallback": "unconfigured/disabled SystemOne or explicitly disabled Jev uses ordinary LLM; selected Jev requires valid credentials; provider failures do not fall back",
     "retry": "shared composition max_retries; child provider retries and key failover disabled",
     "details": "execution.get_meta().judgment",
     "forward_line": "4.2 uses canonical interfaces without deprecated compatibility layers",
```

**File**: `docs/cn/requests/jev.md` (modified, +5/-3)
```diff
@@ -41,9 +41,11 @@ Jev 只做判断，不生成解释或思维链。
 每批最多 64 个判断。可配置 `base_url`、`model`、`timeout`、`batch_size`。
 凭据与 `OpenAICompatible` 独立，不进入模型上下文。
 
-未配置 Jev 连接时，判断转换为普通 LLM schema；
-`Agently.set_settings("Jev.enabled", False)` 也使用 LLM，即使留有无效 Jev 凭据。
-显式开启或部分配置连接却缺有效 API key 时，在调用前报错。Jev 调用失败不会静默转 LLM。
+未配置或关闭 `system_one` 时，判断转换为普通 LLM schema；仅配置 Jev 凭据不会启用它。
+通过 `Agently.set_settings("system_one", {"provider": "Jev"})` 选择 Jev 后，必须提供有效凭据；
+缺失或无效时在调用前报错，不自动降级。
+`Agently.set_settings("Jev.enabled", False)` 则显式使用普通 LLM，即使留有无效 Jev 凭据。
+Jev 调用失败不会静默转 LLM。
 LLM 结果标记实际生产者，不伪造 Jev 原生分布或 confidence，也不宣称概率已校准。
 
 纯静态 Jev 输出不需要 LLM 配置。混合输出还需要普通 ModelRequester；保持 LLM 为当前
```

**File**: `docs/en/requests/jev.md` (modified, +3/-2)
```diff
@@ -50,8 +50,9 @@ SystemOne is disabled without a `system_one` model configuration. To select Jev,
 set `Agently.set_settings("system_one", {"provider": "Jev"})` as well as Jev credentials.
 Use `.use_system_one(False)` to return templates to the ordinary LLM. Explicit
 `Agently.set_settings("Jev.enabled", False)` also selects the LLM, even with
-stale Jev credentials. Explicit enablement or a partial connection configuration
-without a valid API key fails before dispatch. A failed Jev request never
+stale Jev credentials. Once Jev is selected and enabled through SystemOne,
+missing or invalid credentials fail before dispatch; unused Jev settings do not
+activate the provider or trigger its credential checks. A failed Jev request never
 silently falls back. LLM estimates are identified as such and have no fabricated
 native probability distribution or confidence.
 
```

---

### Incident Patch 11: `e4d200d0` (2026-09-12)
**Commit Message**: fix: install optional dependencies for release typing checks

**File**: `.github/workflows/publish-on-version-change.yml` (modified, +5/-0)
```diff
@@ -38,6 +38,11 @@ jobs:
         run: >-
           poetry run python -m pip install pyright "fastmcp>=3,<4" python-dotenv
           beautifulsoup4 "fastapi>=0.104" sqlmodel aiosqlite "ruff==0.16.5"
+        # Optional packages are needed to inspect the complete public typing surface,
+        # not to import or run a minimal installed Agently application.
+      - name: Install optional typing dependencies
+        if: matrix.python-version == '3.10'
+        run: poetry run python -m pip install "playwright==1.62.0" "chromadb==1.5.9"
       - name: Verify Stage and compatibility contracts
         run: poetry run pytest -q tests/test_stage_support_contract.py tests/test_compatibility_registry.py
       - name: Lint complete Python surface
```

**File**: `tests/test_release_workflow_docs.py` (modified, +17/-0)
```diff
@@ -1,11 +1,28 @@
 from pathlib import Path
 import json
 import re
+import yaml
 
 
 ROOT = Path(__file__).resolve().parents[1]
 
 
+def test_publish_workflow_installs_optional_typing_dependencies_before_pyright() -> None:
+    workflow = yaml.safe_load(
+        (ROOT / ".github/workflows/publish-on-version-change.yml").read_text(encoding="utf-8")
+    )
+    steps = workflow["jobs"]["validate"]["steps"]
+    names = [step["name"] for step in steps]
+    assert len(names) == len(set(names))
+    install = steps[names.index("Install optional typing dependencies")]
+    check = steps[names.index("Type check")]
+    assert install["if"] == check["if"]
+    assert "playwright==" in install["run"]
+    assert "chromadb==" in install["run"]
+    assert names.index(install["name"]) < names.index(check["name"])
+    assert all("run" in step or "uses" in step for step in steps)
+
+
 def test_4_1_4_8_change_guide_covers_late_additions_and_has_valid_links() -> None:
     guide = ROOT / "examples/release_pinned_usage/CHANGES_4_1_4_8.md"
     text = guide.read_text(encoding="utf-8")
```

---

### Incident Patch 12: `87fea76f` (2026-09-12)
**Commit Message**: fix: preserve PowerShell Unicode output and failure status

**File**: `agently/builtins/plugins/ExecutionResourceProvider/Shell.py` (modified, +29/-3)
```diff
@@ -14,6 +14,7 @@
 
 import asyncio
 import base64
+import codecs
 import locale
 import os
 import signal
@@ -45,6 +46,7 @@ async def run_argv(
         workdir: Path,
         timeout: float | None,
         env: Mapping[str, str] | None = None,
+        encoding: str | None = None,
     ) -> subprocess.CompletedProcess[str]:
         """Run exact tokens, including empty arguments, without invoking a shell.
 
@@ -56,6 +58,8 @@ async def run_argv(
         args = list(argv)
         if not args or not args[0] or any(not isinstance(arg, str) or "\0" in arg for arg in args):
             raise ValueError("argv requires an executable and string arguments without NUL bytes")
+        if encoding is not None:
+            codecs.lookup(encoding)
         spawn = asyncio.create_task(
             asyncio.create_subprocess_exec(
                 *args,
@@ -103,10 +107,10 @@ async def stop() -> None:
             assert timeout is not None
             raise subprocess.TimeoutExpired(args, timeout, output=stdout, stderr=stderr)
         assert process.returncode is not None
-        encoding = locale.getpreferredencoding(False)
+        output_encoding = encoding if encoding is not None else locale.getpreferredencoding(False)
 
         def text(value: bytes) -> str:
-            return value.decode(encoding).replace("\r\n", "\n").replace("\r", "\n")
+            return value.decode(output_encoding).replace("\r\n", "\n").replace("\r", "\n")
 
         return subprocess.CompletedProcess(args, process.returncode, text(stdout), text(stderr))
 
@@ -159,7 +163,28 @@ async def run(
         env: Mapping[str, str] | None = None,
     ) -> subprocess.CompletedProcess[str]:
         self._check(command)
-        source = command.encode("utf-16-le")
+        # Configure only this child process. Compile user source separately so
+        # leading param/using statements remain valid, without shell interpolation.
+        literal = command.replace("'", "''")
+        source = (
+            "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); "
+            "$OutputEncoding = [Console]::OutputEncoding; "
+            "try { $agently_ast = [scriptblock]::Create('" + literal + "').Ast } "
+            "catch { Write-Error $_; exit 1 }; "
+            # Invocation resets $? at the outer boundary. Deliver CLI's 0/1
+            # status inside the final body. The PowerShell parser owns source
+            # positions, including named begin/process/end blocks and comments;
+            # never find braces with string matching. Explicit exit is unchanged.
+            "$agently_body = $agently_ast.EndBlock; "
+            "if ($null -eq $agently_body) { $agently_body = $agently_ast.ProcessBlock }; "
+            "if ($null -eq $agently_body) { $agently_body = $agently_ast.BeginBlock }; "
+            "$agently_source = $agently_ast.Extent.Text; "
+            "if ($null -ne $agently_body) { "
+            "$agently_offset = $agently_body.Extent.EndOffset; "
+            "if (-not $agently_body.Unnamed) { $agently_offset -= 1 }; "
+            "$agently_source = $agently_source.Insert($agently_offset, \"`nif (-not `$?) { exit 1 }`n\") }; "
+            ". ([scriptblock]::Create($agently_source))"
+        ).encode("utf-16-le")
         # Keep the encoded argument below Windows' command-line limit rather
         # than starting a partial script. Longer source needs a file transport.
         if len(source) > 16384:
@@ -170,4 +195,5 @@ async def run(
             workdir=workdir,
             timeout=timeout,
             env=env,
+            encoding="utf-8",
         )
```

**File**: `docs/cn/development/release-notes-4.1.4.8.md` (modified, +12/-1)
```diff
@@ -88,7 +88,18 @@ IDE 会为 `create_execution`、`effort`、`strategy`、`planning_protocol` 和
 | 长文与续写 | `long_content` 负责结构长文生产；`LongContent` 字段独立生成后填回结构；`auto_continue` 只接续未完成的请求。 | 长字段使用 `(LongContent, "写作要求")`；按需启用 `.auto_continue()`。 | 兼容 `"long_content"` 类型表达和旧 `.ensure_long_output()`；不强制触发续写。 | `examples/basic/auto_continue.py`、`examples/agent_auto_orchestration/29_field_long_content_ollama.py`、续写/输出控制测试。 |
 | 执行控制 | 安全边界暂停/恢复、保存/加载与同对象 revision 返工；旧 reader 保留原结果。 | 使用 execution 的 `pause/resume/save/load/rework` 及异步对应方法，先检查 `control_capabilities`。 | 不承诺恢复活跃 provider、活动子执行或完整嵌套预算。 | 统一执行控制、生命周期/返工/快照及安装后 typing 测试。 |
 | 音频 | 独立 `AudioModelRequest` 提供 TTS/STT，Agent 显式挂载；四种组合流区分连续 PCM、独立音频段、转录块和文字句末。 | `Agently.create_audio_request(...)` → `agent.use_audio(audio)`；流使用 `async with`。 | 不复用文本 Prompt；不隐式录音/播放；内置驱动尚无原生实时 STT 输入。 | [音频用法](../models/audio.md)、`examples/audio/tts_stt_roundtrip.py`、`examples/audio/continuous_audio.py`、音频测试。 |
-| Shell（未完成范围） | 原生进程核心与 Cmd 反向委托已实现；三档环境、四档审批及通用 Agent 新入口仍未完成。 | 当前旧 Cmd/enable_shell 仍保留 argv 语义，不把它当作完整 Bash/PowerShell 脚本接口。 | **待完成，不是已支持能力**；CrossOver 环境探针不替代 Windows 原生隔离验收。 | Shell/Cmd 生命周期测试；完整功能验收仍开放。 |
+| Shell（未完成范围） | 原生进程核心与 Cmd 反向委托已实现；三档环境、四档审批及通用 Agent 新入口仍未完成。 | 当前旧 Cmd/enable_shell 仍保留 argv 语义，不把它当作完整 Bash/PowerShell 脚本接口。 | **待完成，不是已支持能力**；本轮 Windows 测试环境为 CrossOver，不代表原生隔离已验证。 | Shell/Cmd 生命周期测试；完整功能验收仍开放。 |
+
+Windows：本轮开发测试使用 CrossOver；已有 Windows Python 3.14.7 与 PowerShell 7.6.6
+的基础探针证据，不是原生 Windows 全场景测试。请 Windows 使用者在自己的环境测试和反馈；
+遇到问题建议提交 issue，附 Windows、Python、PowerShell 与 Agently 版本、所选执行环境、
+最小复现及去敏错误日志，便于排查。原生沙盒、网络隔离和进程树清理尚未获得实机验证；
+不可用或未实现的执行环境必须明确报错，不会静默改成本机直接执行。
+
+PowerShell 执行核心现在为单次子进程显式配置 UTF-8 输出并对应解码，修复 CrossOver
+测试中中文 stdout/stderr 变问号的问题；旧 Cmd/argv 默认解码不变。传输使用 PowerShell
+解析器保留顶层参数、using 与命名语句块，并保留显式退出、最后命令失败及语法错误状态。
+该修复不表示三档环境或 Agent 新入口已经完成，也不承诺原生 Windows 全场景验证。
 
 长文声明与续写配置彼此独立，例如复用上面的已配置 Agent：
 
```

**File**: `docs/en/development/release-notes-4.1.4.8.md` (modified, +17/-1)
```diff
@@ -91,7 +91,23 @@ recognition, without requiring separate stubs or suppressed missing-type warning
 | Long content and continuation | `long_content` produces structured long prose; `LongContent` fields are generated separately and filled back into the structure; `auto_continue` only continues unfinished requests. | Declare `(LongContent, "writing requirements")`; enable `.auto_continue()` when needed. | The `"long_content"` type spelling and `.ensure_long_output()` alias remain compatible; continuation need not trigger. | `examples/basic/auto_continue.py`, `examples/agent_auto_orchestration/29_field_long_content_ollama.py`, continuation/output-control tests. |
 | Execution controls | Safe-boundary pause/resume and save/load, plus same-object revision rework with retained earlier readers. | Use execution `pause/resume/save/load/rework` and async equivalents; inspect `control_capabilities` first. | Active provider/child snapshots and complete nested-budget recovery are not promised. | Unified control documentation, lifecycle/rework/snapshot tests, installed typing. |
 | Audio | Independent `AudioModelRequest` provides TTS/STT with explicit Agent binding; four composed streams distinguish continuous PCM, independent speech segments, transcript blocks and textual sentence endings. | `Agently.create_audio_request(...)` → `agent.use_audio(audio)`; consume streams with `async with`. | No text Prompt reuse or implicit recording/playback; built-in native realtime STT input is not implemented. | [Audio usage](../models/audio.md), `examples/audio/tts_stt_roundtrip.py`, `examples/audio/continuous_audio.py`, audio tests. |
-| Shell (unfinished scope) | Native process core and reverse Cmd delegation are implemented; three environment profiles, four approval presets and the new general Agent entry are not complete. | Existing Cmd/enable_shell retains argv semantics; do not treat it as a general Bash/PowerShell script interface. | **Pending, not a supported capability**; CrossOver probes do not replace native Windows isolation acceptance. | Shell/Cmd lifecycle tests; complete feature acceptance remains open. |
+| Shell (unfinished scope) | Native process core and reverse Cmd delegation are implemented; three environment profiles, four approval presets and the new general Agent entry are not complete. | Existing Cmd/enable_shell retains argv semantics; do not treat it as a general Bash/PowerShell script interface. | **Pending, not a supported capability**; this round uses CrossOver for Windows testing, not proof of native isolation. | Shell/Cmd lifecycle tests; complete feature acceptance remains open. |
+
+Windows: development testing for this release uses CrossOver. Existing basic probes cover
+Windows Python 3.14.7 and PowerShell 7.6.6, not all scenarios on native Windows.
+Windows users are encouraged to test and report issues with their Windows, Python,
+PowerShell and Agently versions, selected execution environment, a minimal reproduction
+and redacted error logs. Native sandboxing, network isolation and process-tree cleanup
+have not been verified on a native Windows machine. Unavailable or unimplemented
+execution environments must report an explicit error, never silently switch to direct host execution.
+
+The PowerShell execution core now explicitly configures UTF-8 output for each child
+process and decodes it accordingly, fixing Chinese stdout/stderr becoming question
+marks in CrossOver tests. Legacy Cmd/argv decoding is unchanged. The transport uses
+the PowerShell parser to preserve top-level parameters, using directives and named
+blocks, including explicit exits, final-command failures and syntax-error status.
+This fix does not complete the three environment profiles or the new Agent entry,
+nor establish all-scenario validation on native Windows.
 
 Long-form declarations and continuation settings are independent. Reuse the configured Agent above:
 
```

**File**: `tests/test_shell_executor.py` (modified, +54/-1)
```diff
@@ -144,11 +144,64 @@ async def capture(self, argv, **kwargs):
     await PowerShellExecutor(binary="pwsh").run(command, workdir=tmp_path, timeout=5)
     argv, options = calls[0]
     assert argv[:-1] == ["pwsh", "-NoLogo", "-NoProfile", "-NonInteractive", "-OutputFormat", "Text", "-EncodedCommand"]
-    assert base64.b64decode(argv[-1]).decode("utf-16-le") == command
+    wire_source = base64.b64decode(argv[-1]).decode("utf-16-le")
+    assert "$agently_ast = [scriptblock]::Create('" + command.replace("'", "''") + "').Ast" in wire_source
+    assert '"`nif (-not `$?) { exit 1 }`n"' in wire_source
+    assert "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)" in wire_source
+    assert options["encoding"] == "utf-8"
     assert options["workdir"] == tmp_path
     # This is transport evidence only, not Windows execution or isolation proof.
 
 
+@pytest.mark.asyncio
+async def test_explicit_encoding_does_not_change_legacy_argv_default(tmp_path: Path, monkeypatch) -> None:
+    monkeypatch.setattr("locale.getpreferredencoding", lambda _=False: "latin-1")
+    argv = [sys.executable, "-c", "import sys; sys.stdout.buffer.write(bytes([0xc3, 0xa9]))"]
+    legacy = await Shell().run_argv(argv, workdir=tmp_path, timeout=5)
+    utf8 = await Shell().run_argv(argv, workdir=tmp_path, timeout=5, encoding="utf-8")
+    assert legacy.stdout == "\u00c3\u00a9"
+    assert utf8.stdout == "\u00e9"
+
+
+@pytest.mark.asyncio
+async def test_powershell_transport_quotes_are_literal_and_env_unmodified(tmp_path: Path, monkeypatch) -> None:
+    calls = []
+
+    async def capture(self, argv, **kwargs):
+        calls.append((argv, kwargs))
+        return subprocess.CompletedProcess(argv, 0, "", "")
+
+    monkeypatch.setattr(Shell, "run_argv", capture)
+    command = "param($x = 'it''s 中文')\nWrite-Output $x; # '); throw 'not executed by wrapper"
+    env = {"TASK_TEST_KEY": "unchanged"}
+    await PowerShellExecutor(binary="pwsh").run(command, workdir=tmp_path, timeout=5, env=env)
+    argv, options = calls[0]
+    wire = base64.b64decode(argv[-1]).decode("utf-16-le")
+    literal = wire.split("$agently_ast = [scriptblock]::Create('", 1)[1].split("').Ast", 1)[0]
+    assert literal.replace("''", "'") == command
+    assert options["env"] == env == {"TASK_TEST_KEY": "unchanged"}
+
+
+@pytest.mark.asyncio
+async def test_powershell_limits_final_wire_size_including_escaping(tmp_path: Path, monkeypatch) -> None:
+    async def forbidden(*args, **kwargs):
+        raise AssertionError("Oversized transport must fail before spawn")
+
+    monkeypatch.setattr(Shell, "run_argv", forbidden)
+    with pytest.raises(ValueError, match="UTF-16LE"):
+        await PowerShellExecutor().run("'" * 5000, workdir=tmp_path, timeout=5)
+
+
+@pytest.mark.asyncio
+async def test_invalid_output_encoding_rejected_before_spawn(tmp_path: Path, monkeypatch) -> None:
+    async def forbidden(*args, **kwargs):
+        raise AssertionError("Invalid encoding must not execute the command")
+
+    monkeypatch.setattr(asyncio, "create_subprocess_exec", forbidden)
+    with pytest.raises(LookupError):
+        await Shell().run_argv(["not-executed"], workdir=tmp_path, timeout=5, encoding="invalid-codec")
+
+
 @pytest.mark.asyncio
 async def test_powershell_encoded_size_limit_checked_before_spawn(tmp_path: Path, monkeypatch) -> None:
     async def forbidden(*args, **kwargs):
```

---

### Incident Patch 13: `165fe5f1` (2026-09-12)
**Commit Message**: fix: retain scoped evidence in Flat argument requests

**File**: `agently/builtins/plugins/AgentExecution/long_task/FlatStrategy.py` (modified, +33/-13)
```diff
@@ -2059,6 +2059,9 @@ async def _try_flat_narrow_action_command_request(
         iteration_index: int,
         plan: Mapping[str, Any],
         context_pack: "TaskContextView",
+        *,
+        scoped_retrieval_results: Sequence[Mapping[str, Any]] | None = None,
+        evidence_ledger: Mapping[str, Any] | None = None,
     ) -> tuple[dict[str, Any], dict[str, Any]] | Literal["requires_observation"] | None:
         """Dispatch ready kwargs, or defer new-observation dependencies to the existing loop."""
 
@@ -2100,17 +2103,21 @@ async def _try_flat_narrow_action_command_request(
         language_policy = self._language_policy()
         self._apply_language_policy_to_request(request, language_policy)
         repair_context = self._active_repair_context()
-        request.input(
-            {
-                "task_id": self.id,
-                "goal": self.goal,
-                "success_criteria": self.success_criteria,
-                "iteration": iteration_index,
-                "bounded_step_plan": DataFormatter.sanitize(dict(plan)),
-                "context_pack": DataFormatter.sanitize(request_context_pack),
-                "repair_context": DataFormatter.sanitize(repair_context or {}),
-            }
-        )
+        input_payload = {
+            "task_id": self.id,
+            "goal": self.goal,
+            "success_criteria": self.success_criteria,
+            "iteration": iteration_index,
+            "bounded_step_plan": DataFormatter.sanitize(dict(plan)),
+            "context_pack": DataFormatter.sanitize(request_context_pack),
+            "repair_context": DataFormatter.sanitize(repair_context or {}),
+        }
+        if scoped_retrieval_results:
+            input_payload.update({
+                "scoped_retrieval_results": DataFormatter.sanitize(list(scoped_retrieval_results)),
+                "evidence_ledger": DataFormatter.sanitize(evidence_ledger or {}),
+            })
+        request.input(input_payload)
         request.info(
             {
                 "available_actions": action_contracts,
@@ -2127,6 +2134,12 @@ async def _try_flat_narrow_action_command_request(
             "Serial dispatch preserves order but cannot supply a future Action result to this request. "
             "Do not execute Actions, guess missing values, invent placeholders, or synthesize a final response "
             "outside Action inputs."
+            + (
+                " Use [input.scoped_retrieval_results] with the authoritative ids and states in "
+                "[input.evidence_ledger]. Do not infer source content from failed, empty, or ref_only "
+                "entries, or beyond truncated excerpts."
+                if scoped_retrieval_results else ""
+            )
         )
         request.output(
             {
@@ -2242,19 +2255,26 @@ async def run_agent_step(_context: Mapping[str, Any]) -> Mapping[str, Any]:
                     "execution_result": DataFormatter.sanitize(direct_result),
                     "execution_meta": DataFormatter.sanitize(direct_meta),
                 }
+            scoped_retrieval_results = self._scoped_retrieval_results_from_block_context(_context)
+            evidence_ledger = self._flat_step_evidence_ledger(_context) if scoped_retrieval_results else None
+            scoped_inputs = {
+                "scoped_retrieval_results": scoped_retrieval_results,
+                "evidence_ledger": evidence_ledger,
+            } if scoped_retrieval_results else {}
             narrow_action_commands = await self._try_flat_narrow_action_command_request(
                 iteration_index,
                 plan,
                 context_pack,
+                **scoped_inputs,
             )
             if isinstance(narrow_action_commands, tuple):
                 direct_result, direct_meta = narrow_action_commands
                 return {
                     "execution_result": DataFormatter.sanitize(direct_result),
                     "execution_meta": DataFormatter.sanitize(direct_meta),
                 }
-            scoped_retrieval_results = self._scoped_retrieval_results_from_block_context(_context)
-            evidence_ledger = self._flat_step_evidence_ledger(_context)
+            if evidence_ledger is None:
+                evidence_ledger = self._flat_step_evidence_ledger(_context)
             execution_result, execution_meta = await self._run_bounded_agent_execution_step(
                 iteration_index,
                 plan,
```

**File**: `docs/cn/development/release-notes-4.1.4.8.md` (modified, +2/-0)
```diff
@@ -115,6 +115,8 @@ ContextSource 不读取范围外记录，公共 RecordStore 读取不因此新
 required 或 planner 元数据扩权。合法产物回读和 Host 手工保留的 programmatic catalog
 保持可用；默认规划产生的 catalog 租约在取消、失败或未消费终结时精确释放。
 Action schema 中名为 `env` 的业务字段不再被误脱敏，实际运行环境值仍保持脱敏。
+Flat 参数生成现在能收到当前步骤已经读取的有界资料与证据状态，不丢失原任务和上下文，
+不新增读取或模型请求；没有本步读取和显式固定命令的路径保持原样。
 
 Flat 中没有终态候选、产物或既存修复的普通成功命令观察现在直接交给下一步消费，
 不再把“全任务尚未完成”当作当前步骤失败而重复发起终态审查。真实风险和累计
```

**File**: `docs/cn/start/auto-orchestration.md` (modified, +5/-0)
```diff
@@ -935,6 +935,11 @@ ActionRuntime；仅顺序依赖（例如写入再读取已知路径）不需要
 这种自适应交接不套用普通子执行隐式的两轮上限，因为调用后可能还需要终态请求；
 显式任务 `action_loop_max_rounds`、任务 deadline 和请求预算继续生效。
 
+如果该步骤已完成 `scoped_retrieval`，参数请求同时接收本步有界读取结果和既有证据账本，
+保留原任务、步骤和上下文，不重复读取或额外请求模型。失败、空结果、仅引用和截断状态
+保持原义；未读正文不能作为参数依据。没有本步读取时请求保持原样；显式预计划命令仍使用
+固定参数，转交子执行时继续携带同一份证据。
+
 任务级 `require_actions` 在全任务累计 Action 证据中检查，不会重复变成每次子请求的
 必调用要求。仅撰写最终答复或产物的子执行无需重做已完成的 Action；显式 step-required
 仍由子执行检查，任务所需 Action 缺失或失败仍会阻止验收。Agent 默认要求在任务创建时
```

**File**: `docs/en/development/release-notes-4.1.4.8.md` (modified, +4/-0)
```diff
@@ -126,6 +126,10 @@ programmatic catalogs remain supported. Default-planner catalog leases are
 settled precisely on cancellation, failure or an unconsumed terminal decision.
 Business schema fields named `env` are no longer mistakenly redacted; actual
 runtime environment values remain redacted.
+Flat argument generation now receives the current step's already-read bounded
+sources and evidence states without losing its original task or context and
+without additional reads or model requests. No-current-read and explicit fixed
+command paths remain unchanged.
 
 Flat now hands ordinary successful command observations to the next step when
 there is no terminal candidate, artifact or active repair. An unfinished task
```

**File**: `docs/en/start/auto-orchestration.md` (modified, +8/-0)
```diff
@@ -1176,6 +1176,14 @@ The adaptive handoff does not impose the ordinary child's implicit two-round
 cap: calls may need another round for final synthesis. Explicit task
 `action_loop_max_rounds`, task deadlines and request budgets still apply.
 
+When the step has completed `scoped_retrieval`, its argument request also receives
+the bounded read results and existing evidence ledger, preserving the original
+task, step and context without another read or model request. Failed, empty,
+ref-only and truncated states retain their meaning; unread content cannot ground
+arguments. Requests without a current-step read remain unchanged. Explicit
+preplanned commands keep fixed arguments, and a deferred child receives the same
+evidence.
+
 Task-wide `require_actions` is checked against the task's cumulative Action
 evidence, not repeated as an obligation on every child request. A child that
 only writes the final answer or an artifact need not repeat completed Actions.
```

**File**: `tests/test_flat_scoped_action_inputs.py` (added, +289/-0)
```diff
@@ -0,0 +1,289 @@
+"""Real request/Block transport checks; synthetic responses prove no model quality."""
+from __future__ import annotations
+
+import asyncio
+from copy import deepcopy
+import json
+import threading
+from typing import Any
+
+import pytest
+
+from agently import Agently
+from agently.core import PluginManager, TaskContext
+from agently.core.application.AgentTask import AgentTask
+from agently.core.storage import RecordStoreContextSource
+from agently.types.data import AgentlyRequestData
+from agently.utils import Settings
+
+
+@pytest.fixture
+def scoped_setup(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Any:
+    captured: list[dict[str, Any]] = []
+    events: list[str] = []
+    control: dict[str, Any] = {"defer": False, "ready": False, "pause": False,
+        "captured_event": threading.Event(), "values": []}
+
+    class CaptureRequester:
+        name = "FlatScopedCaptureRequester"
+        DEFAULT_SETTINGS: dict[str, Any] = {}
+
+        def __init__(self, prompt: Any, settings: Any) -> None:
+            self.prompt = prompt
+
+        @staticmethod
+        def _on_register() -> None:
+            pass
+
+        @staticmethod
+        def _on_unregister() -> None:
+            pass
+
+        def generate_request_data(self) -> AgentlyRequestData:
+            return AgentlyRequestData(client_options={}, headers={}, data={
+                "messages": self.prompt.to_messages(), "output": self.prompt.get("output")},
+                request_options={"stream": True}, request_url="synthetic://scoped-input")
+
+        async def request_model(self, request_data: Any) -> Any:
+            if "selected_keys" in (self.prompt.get("output") or {}):
+                events.append("context_selector")
+                infos = self.prompt.get("info") or []
+                infos = infos if isinstance(infos, list) else [infos]
+                cards = next((item["offered_context_blocks"] for item in infos
+                    if "offered_context_blocks" in item), [])
+                yield "message", json.dumps({"selected_keys": [item["block_key"] for item in cards]})
+                return
+            events.append("narrow_request")
+            captured.append({"prompt": deepcopy(self.prompt.get()), "text": self.prompt.to_text()})
+            if control["pause"]:
+                control["captured_event"].set()
+                await asyncio.Future()
+            commands = [{"purpose": "Exercise transport only", "action_id": "observe_input",
+                "action_input": {"value": "PROTOCOL_VALUE"}}] if control["ready"] else []
+            yield "message", json.dumps({"requires_observation": control["defer"], "action_commands": commands})
+
+        async def broadcast_response(self, response_generator: Any) -> Any:
+            text = ""
+            async for _event, data in response_generator:
+                text += str(data)
+                yield "delta", str(data)
+            yield "done", text
+
+    settings = Settings(name="scoped-input-settings", parent=Agently.settings)
+    plugins = PluginManager(settings, parent=Agently.plugin_manager, name="scoped-input-plugins")
+    plugins.register("ModelRequester", CaptureRequester, activate=True)
+    agent = Agently.AgentType(plugins, parent_settings=settings, name="scoped-input-test")
+    agent.use_task_workspace(tmp_path / "files").use_record_store(tmp_path / "records", mode="read_write")
+
+    def forbidden_action(value: str) -> None:
+        assert control["ready"], "Only the explicit ready-command protocol test may dispatch"
+        control["values"].append(value)
+        events.append("protocol_action")
+
+    agent.action.register_action(action_id="observe_input", desc="Transport test only",
+        kwargs={"value": (str, "Observed value", True)}, func=forbidden_action)
+    agent.use_actions("observe_input")
+    context = TaskContext(task_id="scoped-input-test")
+    source = RecordStoreContextSource(agent.record_store)
+    original_read = source.async_read_exact
+
+    async def read(*args: Any, **kwargs: Any) -> Any:
+        events.append("source_read")
+        return await original_read(*args, **kwargs)
+
+    monkeypatch.setattr(source, "async_read_exact", read)
+    context.attach(source, binding_id="cold-source", metadata={"disclosure_mode": "explicit_retrieval"})
+    task = AgentTask(agent, task_id="scoped-input-test", goal="Inspect source values.",
+        success_criteria=["Read before use."], execution="flat", task_context=context,
+        context_budget={"chars": 10000, "optional_selection": "none"})
+    plan = {"execution_shape": "actions", "required_action_ids": ["observe_input"],
+        "step_instruction": "Inspect the source value.", "scoped_retrieval": {"query_groups": [{
+            "query": "source", "source_kinds": ["record_store"], "expected_role": "evidence_snippet",
+            "filters": {"collection": "input-source"}, "max_results": 1, "snippet_limit": 500}]}}
+    legac
```

---

### Incident Patch 14: `55bd84c8` (2026-09-12)
**Commit Message**: fix: retain installed typing for bundled plugins

**File**: `agently/builtins/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+"""Built-in Agently implementations covered by the package typing marker."""
```

**File**: `docs/cn/development/release-notes-4.1.4.8.md` (modified, +2/-0)
```diff
@@ -69,6 +69,8 @@ Skills 采用同样的返回类型规则；Skill 注册与 exact-revision 绑定
 IDE 会为 `create_execution`、`effort`、`strategy`、`planning_protocol` 和 Action
 `concurrency_mode` 显示内置候选；公开合同允许扩展的位置仍接受插件 Execution 名或
 替代 orchestrator strategy 名。
+内置 Execution 插件导入现在保持安装包的 `py.typed` 标记识别，不需要为这些已注解模块
+另装 stub 或忽略缺失类型提示。
 
 ## 核心变动
 
```

**File**: `docs/en/development/release-notes-4.1.4.8.md` (modified, +2/-0)
```diff
@@ -72,6 +72,8 @@ The built-in values for `create_execution`, `effort`, `strategy`,
 `planning_protocol`, and Action `concurrency_mode` are finite IDE suggestions.
 Plugin-extensible Execution and alternate orchestrator strategy names remain open
 where the public contract permits them.
+Bundled Execution plugin imports retain the installed package's `py.typed`
+recognition, without requiring separate stubs or suppressed missing-type warnings.
 
 ## Core Changes
 
```

**File**: `tests/test_static_typing_contracts.py` (modified, +8/-0)
```diff
@@ -195,6 +195,14 @@ def test_programmatic_action_observation_types_are_explicitly_exported():
         assert_type(settled["peak_active_binding_calls"], int)
         assert_type(catalog["contract_bytes"], int)
 
+def test_bundled_plugins_retain_regular_typed_package_boundary() -> None:
+    """A namespace gap loses the installed root py.typed marker in Pyright."""
+    package = importlib.util.find_spec("agently.builtins")
+    assert package is not None and package.origin is not None
+    assert Path(package.origin).name == "__init__.py"
+    assert (Path(package.origin).parents[1] / "py.typed").is_file()
+
+
 def test_public_handler_type_aliases():
     if TYPE_CHECKING:
         from agently.builtins.plugins.AgentExecution import (
```

---

### Incident Patch 15: `5aa31346` (2026-09-12)
**Commit Message**: fix: preserve declared action schemas during metadata redaction

**File**: `agently/core/operation/Action/ActionMetadata.py` (modified, +5/-2)
```diff
@@ -104,9 +104,12 @@ def _sanitize_metadata_value(value: Any, *, parent_key: str = "") -> Any:
 
 
 def sanitize_action_spec_for_metadata(spec: ActionSpec | dict[str, Any]) -> dict[str, Any]:
-    """Return a model/host-visible copy of an action spec without raw env values."""
+    """Preserve declared schemas while redacting runtime metadata env values."""
 
-    return _sanitize_metadata_value(deepcopy(dict(spec)))
+    return {
+        str(key): value if key in {"kwargs", "returns"} else _sanitize_metadata_value(value, parent_key=str(key))
+        for key, value in deepcopy(dict(spec)).items()
+    }
 
 
 def project_action_spec_for_planning(spec: ActionSpec | dict[str, Any]) -> dict[str, Any]:
```

**File**: `docs/cn/actions/action-runtime.md` (modified, +2/-0)
```diff
@@ -125,6 +125,8 @@ agent 上可见的 action/tool schema，包括 agent-scoped actions、通过
 `agent.use_mcp(...)` 挂载的 MCP tools，以及 `enable_*` component helpers。只有需要
 窄范围子集时才传显式 `tags=[...]`。托管执行环境 metadata 在这个可见 schema
 里会脱敏原始 `env` 值，但保留 env key；provider 只会在实际执行路径中拿到 raw env。
+声明的 `kwargs` / `returns` 是调用 schema，不属于运行环境值；其中名为 `env` 的
+业务字段及其嵌套类型、描述会原样保留。不要把秘密值写入面向模型的 schema 描述。
 
 模型调用范围由 Host 决定。没有显式 Execution 范围时使用 Agent 的默认
 Actions；Host 可以在 Execution 上显式选择其它已注册、允许向模型暴露的
```

**File**: `docs/cn/development/release-notes-4.1.4.8.md` (modified, +5/-0)
```diff
@@ -109,6 +109,11 @@ ContextSource 不读取范围外记录，公共 RecordStore 读取不因此新
 任务修复的结构化要求和证据标识现在会保留到下一轮规划，包含经摘要保存/恢复的路径；
 历史快照中已经丢失的要求不会被凭空重建。
 
+模型规划的 Action 批次现在在审批或调用前整体核对 Host 提供的范围，子步骤不能通过
+required 或 planner 元数据扩权。合法产物回读和 Host 手工保留的 programmatic catalog
+保持可用；默认规划产生的 catalog 租约在取消、失败或未消费终结时精确释放。
+Action schema 中名为 `env` 的业务字段不再被误脱敏，实际运行环境值仍保持脱敏。
+
 Flat 中没有终态候选、产物或既存修复的普通成功命令观察现在直接交给下一步消费，
 不再把“全任务尚未完成”当作当前步骤失败而重复发起终态审查。真实风险和累计
 必需能力检查保留，最终答复仍经过验收；不改变外层 `review` / `validate`。
```

**File**: `docs/en/actions/action-runtime.md` (modified, +3/-0)
```diff
@@ -128,6 +128,9 @@ agent-scoped actions, MCP tools mounted through `agent.use_mcp(...)`, and
 narrow subset. Managed execution environment metadata redacts raw `env` values
 in this visible schema while preserving key names; providers still receive the
 raw env only through the execution path.
+Declared `kwargs` / `returns` are call schemas, not runtime environment values:
+business fields named `env` retain their nested types and descriptions. Do not
+put secrets into model-facing schema descriptions.
 
 The Host owns model Action visibility. Without an explicit Execution scope,
 Agent-default Actions are used; a Host may explicitly select other registered,
```

**File**: `docs/en/development/release-notes-4.1.4.8.md` (modified, +8/-0)
```diff
@@ -117,6 +117,14 @@ Structured task-repair requirements and evidence identities now survive the
 projection into subsequent planning, including saved/restored iteration summaries.
 Requirements already lost from historical snapshots are not reconstructed.
 
+Model-planned Action batches are now checked as a whole against the Host-offered
+scope before approval or dispatch; required ids and planner metadata cannot
+expand a child step's authority. Legitimate artifact recall and Host-retained
+programmatic catalogs remain supported. Default-planner catalog leases are
+settled precisely on cancellation, failure or an unconsumed terminal decision.
+Business schema fields named `env` are no longer mistakenly redacted; actual
+runtime environment values remain redacted.
+
 Flat now hands ordinary successful command observations to the next step when
 there is no terminal candidate, artifact or active repair. An unfinished task
 no longer makes that intermediate step fail a repeated terminal check. Real
```

**File**: `tests/test_action_schema_metadata.py` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+"""Declared schemas are not runtime env; all requests here stop before dispatch."""
+
+from __future__ import annotations
+
+from copy import deepcopy
+import importlib
+from typing import Any, Literal
+
+import pytest
+
+from agently import Agently
+from agently.core.operation.Action.ActionMetadata import (
+    project_action_spec_for_planning,
+    sanitize_action_spec_for_metadata,
+)
+
+
+@pytest.mark.parametrize("field", ["kwargs", "returns"])
+@pytest.mark.parametrize("schema", [
+    {"env": (str, "Business environment name", True)},
+    {"config": ({"env": (Literal["staging", "production"], "Target environment")}, "Config")},
+    {"items": ([{"env": {"region": (str, "Business region")}}], "Deployment items")},
+    {"env": ({"region": (str, "Region"), "tier": (int, "Tier")}, "Business configuration")},
+])
+def test_declared_schema_env_is_preserved(field: str, schema: dict[str, Any]) -> None:
+    original = {"name": "configure", field: deepcopy(schema), "meta": {"env": {"TOKEN": "host-secret"}}}
+    snapshot = deepcopy(original)
+    projected = sanitize_action_spec_for_metadata(original)
+
+    assert projected[field] == schema
+    assert projected["meta"]["env"] == {"TOKEN": "[REDACTED]"}
+    assert original == snapshot
+    projected[field].clear()
+    assert original == snapshot
+
+
+@pytest.mark.parametrize("value, expected", [
+    ({"TOKEN": "host-secret"}, {"TOKEN": "[REDACTED]"}),
+    (["host-secret", "another-secret"], ["[REDACTED]", "[REDACTED]"]),
+    (("host-secret",), "[REDACTED]"),
+    ("host-secret", "[REDACTED]"),
+    (None, None),
+])
+def test_runtime_env_still_redacts_at_nested_metadata_locations(value: Any, expected: Any) -> None:
+    original = {
+        "name": "configure",
+        "kwargs": {"env": (str, "Business name")},
+        "meta": {"env": value, "nested": [{"config": ({"env": value},)}]},
+        "execution_resources": [{"config": {"runtime": {"env": value}}}],
+    }
+    snapshot = deepcopy(original)
+    projected = sanitize_action_spec_for_metadata(original)
+
+    assert projected["meta"]["env"] == expected
+    assert projected["meta"]["nested"][0]["config"][0]["env"] == expected
+    assert projected["execution_resources"][0]["config"]["runtime"]["env"] == expected
+    assert "host-secret" not in str(projected)
+    assert original == snapshot
+
+
+def _register(action: Any) -> tuple[dict[str, Any], dict[str, Any]]:
+    kwargs = {"env": ({"region": (str, "Region to deploy")}, "Business target", True)}
+    returns = {"env": {"region": (str, "Applied region")}}
+
+    def forbidden(**_kwargs: Any) -> None:
+        raise AssertionError("A metadata test must not execute its Action")
+
+    action.register_action(
+        action_id="schema_env_probe", desc="Describe business environment configuration.",
+        kwargs=kwargs, returns=returns, func=forbidden,
+        meta={"env": {"TOKEN": "host-secret"}},
+    )
+    return kwargs, returns
+
+
+@pytest.mark.parametrize("legacy", [False, True])
+def test_public_and_legacy_metadata_preserve_schema_and_registry(legacy: bool) -> None:
+    agent = Agently.create_agent()
+    if legacy:
+        from agently.builtins.plugins.ToolManager.AgentlyToolManager import AgentlyToolManager
+
+        with pytest.deprecated_call(match="AgentlyToolManager"):
+            action = AgentlyToolManager(agent.settings)
+    else:
+        action = agent.action
+    kwargs, returns = _register(action)
+    raw = deepcopy(action.action_registry.get_spec("schema_env_probe"))
+
+    public = action.get_action_info()["schema_env_probe"]
+    assert public["kwargs"] == kwargs
+    assert public["returns"] == returns
+    assert public.get("required_input_keys", []) == ([] if legacy else ["env"])
+    assert "host-secret" not in str(public)
+    tool = action.get_tool_info()["schema_env_probe"]
+    assert tool["kwargs"] == kwargs
+    assert tool["returns"] == returns
+    planning = project_action_spec_for_planning(public)
+    assert planning["kwargs"] == kwargs
+    assert planning.get("required_input_keys", []) == ([] if legacy else ["env"])
+    assert "meta" not in planning
+    public["kwargs"]["env"][0].clear()
+    assert action.action_registry.get_spec("schema_env_probe") == raw
+
+
+@pytest.mark.asyncio
+async def test_default_planner_receives_real_declared_env_schema(monkeypatch: pytest.MonkeyPatch) -> None:
+    agent = Agently.create_agent()
+    kwargs, _ = _register(agent.action)
+    runtime_module = importlib.import_module("agently.builtins.plugins.ActionRuntime.AgentlyActionRuntime")
+    captured: list[dict[str, Any]] = []
+
+    class BeforeDispatch(Exception):
+        pass
+
+    def inspect_request(request: Any, **_kwargs: Any) -> None:
+        captured.append({"draft": request.prompt.get(), "text": request.prompt.to_text()})
+        raise BeforeDispatch
+
+    monkeypatch.setattr(runtime_module, "_get_model_request_result", inspect_request)
+    prompt = Agently.create_prom
```

#### Recent Merged Pull Requests:
- **PR #367** (2026-10-01): Release 4.1.4.9: unified long-task loop and model capabilities (@Maplemx)
- **PR #365** (2026-10-02): Support native video input blocks for MiniMax (@octo-patch)
- **PR #364** (2026-09-12): release: complete 4.1.4.8 validation and publication metadata (@Maplemx)
- **PR #363** (2026-09-12): Release 4.1.4.8: execution, output delivery, audio and Shell (@Maplemx)
- **PR #360** (2026-08-24): docs: align Agently 4.1.4.7 with Skills catalog v3 (@Maplemx)
- **PR #357** (2026-08-17): Fix Landlock virtualenv release validation (@Maplemx)
- **PR #356** (2026-08-17): Fix Agently 4.1.4.7 release validation (@Maplemx)
- **PR #355** (2026-08-17): Release Agently 4.1.4.7 (@Maplemx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
