# Forensic Learning Record (Deep Inspection): HKUDS/nanobot

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-nanobot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/nanobot](https://github.com/HKUDS/nanobot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:51:27.120Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/nanobot`
- **Description**: Ultra-lightweight, open-source, self-hosted personal AI agent framework in Python with WebUI, tools, memory, MCP, multi-agent workflows, automation, and chat apps
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 48806 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `nanobot/agent/hook.py`
```
"""Shared lifecycle hook primitives for agent runs."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from loguru import logger

from nanobot.agent.tools.context import tool_log_content_allowed
from nanobot.events import NO_EVENTS, EventSink
from nanobot.providers.base import LLMResponse, LLMUsage, ToolCallRequest


@dataclass(slots=True)
class AgentHookContext:
    """Mutable per-iteration state exposed to runner hooks."""

    iteration: int
    messages: list[dict[str, Any]]
    response: LLMResponse | None = None
    usage: LLMUsage | None = None
    tool_calls: list[ToolCallRequest] = field(default_factory=list)
    tool_results: list[Any] = field(default_factory=list)
    tool_events: list[dict[str, str]] = field(default_factory=list)
    streamed_content: bool = False
    streamed_reasoning: bool = False
    stream_continues_current_message: bool = False
    final_content: str | None = None
    stop_reason: str | None = None
    error: str | None = None
    session_key: str | None = None


@dataclass(slots=True)
class AgentRunHookContext:
    """Run-level state snapshot exposed to runner hooks."""

    messages: list[dict[str, Any]]
    final_content: str | None = None
    tools_used: list[str] = field(default_factory=list)
    usage: LLMUsage | None = None
    stop_reason: str | None = None
    error: str | None = None
    tool_events: list[dict[str, str]] = field(default_factory=list)
    had_injections: bool = False
    exception: BaseException | None = None


@dataclass(slots=True)
class AgentTurnHookContext:
    """Turn-local inputs available when constructing per-turn hooks."""

    events: EventSink = NO_EVENTS
    workspace: Path | None = None
    channel: str = "cli"
    chat_id: str = "direct"
    message_id: str | None = None
    session_key: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    ephemeral: bool = False
    attributes: dict[str, Any] = field(default_factory=dict)


class AgentHook:
    """Minimal lifecycle surface for shared runner customization."""

    def __init__(self, reraise: bool = False) -> None:
        self._reraise = reraise

    def wants_streaming(self) -> bool:
        return False

    async def before_run(self, context: AgentRunHookContext) -> None:
        pass

    async def after_run(self, context: AgentRunHookContext) -> None:
        pass

    async def on_error(self, context: AgentRunHookContext) -> None:
        pass

    async def on_finally(self, context: AgentRunHookContext) -> None:
        pass

    async def before_iteration(self, context: AgentHookContext) -> None:
        pass

    async def on_stream(self, context: AgentHookContext, delta: str) -> None:
        pass

    async def on_stream_end(self, context: AgentHookContext, *, resuming: bool) -> None:
        pass

    async def on_provider_tool_event(
        self,
        context: AgentHookContext,
        event: dict[str, Any],
    ) -> None:
        """Observe a provider-hosted tool lifecycle event."""
        pass

    async def before_execute_tools(self, context: AgentHookContext) -> None:
        pass

    async def before_execute_tool(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
    ) -> None:
        pass

    async def after_execute_tool(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
        result: Any,
    ) -> None:
        pass

    async def on_execute_tool_error(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
        error: Any,
    ) -> None:
        pass

    async def emit_reasoning(self, reasoning_content: str | None) -> None:
        pass

    async def emit_reasoning_end(self) -> None:
        """Mark the end of an in-flight reasoning stream.

        Hooks that buffer ``emit_reasoning`` chunks (for in-place UI updates)
        flush and freeze the rendered group here. One-shot hooks ignore.
        """
        pass

    async def after_iteration(self, context: AgentHookContext) -> None:
        pass

    def finalize_content(self, context: AgentHookContext, content: str | None) -> str | None:
        return content


AgentTurnHookFactory = Callable[[AgentTurnHookContext], AgentHook | None]


class CompositeHook(AgentHook):
    """Fan-out hook that delegates to an ordered list of hooks.

    Error isolation: async methods catch and log per-hook exceptions
    so a faulty custom hook cannot crash the agent loop.
    ``finalize_content`` is a pipeline (no isolation — bugs should surface).
    """

    __slots__ = ("_hooks",)

    def __init__(self, hooks: list[AgentHook]) -> None:
        super().__init__()
        self._hooks = list(hooks)

    def wants_streaming(self) -> bool:
        return any(h.wants_streaming() for h in self._hooks)

    async def _for_each_hook_safe(self, method_name: str, *args: Any, **kwargs: Any) -> None:
        for h in self._hooks:
            if getattr(h, "_reraise", False):
                await getattr(h, method_name)(*args, **kwargs)
                continue

            try:
                await getattr(h, method_name)(*args, **kwargs)
            except Exception:
                logger.opt(exception=tool_log_content_allowed()).error(
                    "AgentHook.{} error in {}", method_name, type(h).__name__,
                )

    async def before_iteration(self, context: AgentHookContext) -> None:
        await self._for_each_hook_safe("before_iteration", context)

    async def before_run(self, context: AgentRunHookContext) -> None:
        await self._for_each_hook_safe("before_run", context)

    async def after_run(self, context: AgentRunHookContext) -> None:
        await self._for_each_hook_safe("after_run", context)

    async def on_error(self, context: AgentRunHookContext) -> None:
        await self._for_each_hook_safe("on_error", context)

    async def on_finally(self, context: AgentRunHookContext) -> None:
        await self._for_each_hook_safe("on_finally", context)

    async def on_stream(self, context: AgentHookContext, delta: str) -> None:
        await self._for_each_hook_safe("on_stream", context, delta)

    async def on_stream_end(self, context: AgentHookContext, *, resuming: bool) -> None:
        await self._for_each_hook_safe("on_stream_end", context, resuming=resuming)

    async def on_provider_tool_event(
        self,
        context: AgentHookContext,
        event: dict[str, Any],
    ) -> None:
        await self._for_each_hook_safe("on_provider_tool_event", context, event)

    async def before_execute_tools(self, context: AgentHookContext) -> None:
        await self._for_each_hook_safe("before_execute_tools", context)

    async def before_execute_tool(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
    ) -> None:
        await self._for_each_hook_safe("before_execute_tool", context, tool_call, tool, params)

    async def after_execute_tool(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
        result: Any,
    ) -> None:
        await self._for_each_hook_safe(
            "after_execute_tool",
            context,
            tool_call,
            tool,
            params,
            result,
        )

    async def on_execute_tool_error(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
        error: Any,
    ) -> None:
        await self._for_each_hook_safe(
            "on_execute_tool_error",
            context,
            tool_call,
            tool,
            params,
            error,
        )

    async def emit_reasoning(self, reasoning_content: str | None) -> None:
        await self._for_each_hook_safe("emit_reasoning", reasoning_content)

    async def emit_reasoning_end(self) -> None:
        await self._for_each_hook_safe("emit_reasoning_end")

    async def after_iteration(self, context: AgentHookContext) -> None:
        await self._for_each_hook_safe("after_iteration", context)

    def finalize_content(self, context: AgentHookContext, content: str | None) -> str | None:
        for h in self._hooks:
            content = h.finalize_content(context, content)
        return content


class SDKCaptureHook(AgentHook):
    """Record tool names and the final message list for ``RunResult``.

    The runner mutates ``context.messages`` in place across iterations, so the
    snapshot is refreshed on every ``after_iteration`` call; the last call
    reflects the end-of-turn state the SDK caller cares about.  The run-level
    snapshot is authoritative when available and covers paths without a final
    per-iteration callback.
    """

    def __init__(self) -> None:
        super().__init__()
        self.tools_used: list[str] = []
        self.messages: list[dict[str, Any]] = []
        self.usage: LLMUsage | None = None
        self.stop_reason: str | None = None
        self.error: str | None = None
        self.tool_events: list[dict[str, str]] = []
        self.had_injections: bool = False

    async def after_iteration(self, context: AgentHookContext) -> None:
        for call in context.tool_calls:
            self.tools_used.append(call.name)
        self.messages = list(context.messages)
        self.usage = context.usage
        self.stop_reason = context.stop_reason
        self.error = context.error
        self.tool_events = list(context.tool_events)

    async def after_run(self, context: AgentRunHookContext) -> None:
        self.tools_used = list(context.tools_used)
        self.messages = list(context.messages)
        self.usage = context.usage
        self
```

### Core Architecture Module: `nanobot/agent/hooks/__init__.py`
```
"""Concrete agent hook implementations."""

from nanobot.agent.hooks.file_edit_activity import (
    FileEditActivityHook,
    create_file_edit_activity_hook,
)

__all__ = [
    "FileEditActivityHook",
    "create_file_edit_activity_hook",
]

```

### Core Architecture Module: `nanobot/agent/hooks/file_edit_activity.py`
```
"""Agent hook that observes file-editing tools and emits file-edit activity."""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from nanobot.agent.hook import (
    AgentHook,
    AgentHookContext,
    AgentRunHookContext,
    AgentTurnHookContext,
)
from nanobot.bus.outbound_events import FileEditEvent
from nanobot.events import EventSink
from nanobot.providers.base import ToolCallRequest
from nanobot.utils.file_edit_events import (
    FileEditResult,
    FileEditTracker,
    build_file_edit_end_event,
    build_file_edit_error_event,
    build_file_edit_start_event,
    prepare_file_edit_trackers,
)


class FileEditActivityHook(AgentHook):
    """Translate file-editing tool lifecycle events into WebUI progress events."""

    def __init__(
        self,
        *,
        events: EventSink,
        workspace: Path | None,
    ) -> None:
        super().__init__()
        self._publish = events.publish if events.accepts(FileEditEvent) else None
        self._workspace = workspace
        self._trackers_by_call: dict[str, list[FileEditTracker]] = {}

    async def before_iteration(self, context: AgentHookContext) -> None:
        self._trackers_by_call.clear()

    async def before_execute_tool(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
    ) -> None:
        if self._publish is None or not isinstance(params, dict):
            return
        typed_params = cast(dict[str, Any], params)
        trackers = prepare_file_edit_trackers(
            call_id=tool_call.id,
            tool_name=tool_call.name,
            tool=tool,
            workspace=self._workspace,
            params=typed_params,
        )
        if not trackers:
            return
        self._trackers_by_call[self._tool_call_key(tool_call)] = trackers
        await self._emit([
            build_file_edit_start_event(tracker, typed_params)
            for tracker in trackers
        ])

    async def after_execute_tool(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
        result: Any,
    ) -> None:
        key = self._tool_call_key(tool_call)
        trackers = self._trackers_by_call.get(key, [])
        if trackers:
            diffs = result.file_diffs if isinstance(result, FileEditResult) else {}
            await self._emit([
                build_file_edit_end_event(tracker, diff=diffs.pop(tracker.path, None))
                for tracker in trackers
            ])
            self._trackers_by_call.pop(key, None)

    async def on_execute_tool_error(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
        error: Any,
    ) -> None:
        key = self._tool_call_key(tool_call)
        trackers = self._trackers_by_call.get(key, [])
        if trackers:
            await self._emit([
                build_file_edit_error_event(tracker, str(error)) for tracker in trackers
            ])
            self._trackers_by_call.pop(key, None)

    async def on_finally(self, context: AgentRunHookContext) -> None:
        if context.stop_reason != "cancelled" or not self._trackers_by_call:
            return
        trackers = [
            tracker
            for trackers in self._trackers_by_call.values()
            for tracker in trackers
        ]
        self._trackers_by_call.clear()
        await self._emit([
            build_file_edit_error_event(
                tracker,
                "Task interrupted before this tool finished.",
            )
            for tracker in trackers
        ])

    async def _emit(self, events: list[dict[str, Any]]) -> None:
        if self._publish is not None:
            await self._publish(FileEditEvent(file_edit_events=events))

    @staticmethod
    def _tool_call_key(tool_call: ToolCallRequest) -> str:
        call_id = getattr(tool_call, "id", "") or ""
        return f"{call_id}|{tool_call.name}" if call_id else f"{id(tool_call)}|{tool_call.name}"


def create_file_edit_activity_hook(context: AgentTurnHookContext) -> AgentHook | None:
    """Create the default file-edit observer for one agent turn."""
    if not context.events.accepts(FileEditEvent):
        return None
    return FileEditActivityHook(
        events=context.events,
        workspace=context.workspace,
    )

```

### Core Architecture Module: `nanobot/agent/loop.py`
```
"""Agent loop: the core processing engine."""

# pyright: reportPrivateUsage=false

from __future__ import annotations

import asyncio
import dataclasses
import os
import time
import weakref
from collections.abc import Coroutine, Iterable, Mapping
from contextlib import AbstractContextManager, ExitStack, nullcontext, suppress
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from functools import partial
from pathlib import Path
from typing import TYPE_CHECKING, Any, Awaitable, Callable, TypeVar, cast

from loguru import logger

from nanobot.agent import context as agent_context
from nanobot.agent import model_presets as preset_helpers
from nanobot.agent.autocompact import AutoCompact
from nanobot.agent.context import ContextBuilder, PersistedPromptContextResolver, TranscriptInput
from nanobot.agent.cron_turns import CronTurnCoordinator
from nanobot.agent.goal_permission import GoalInputScope
from nanobot.agent.hook import AgentHook, AgentTurnHookFactory
from nanobot.agent.memory import Consolidator
from nanobot.agent.model_runtime import ModelRuntimeResolver
from nanobot.agent.runner import AgentRunner, AgentRunResult, AgentRunSpec
from nanobot.agent.subagent import SubagentManager
from nanobot.agent.tools.context import RequestContext, bind_request_context, reset_request_context
from nanobot.agent.tools.exec_session import ExecSessionManager
from nanobot.agent.tools.file_state import FileStateStore, bind_file_states, reset_file_states
from nanobot.agent.tools.message import capture_message_deliveries
from nanobot.agent.tools.registry import ToolRegistry
from nanobot.agent.tools.runtime_control import AgentRuntimeControl
from nanobot.agent.turn_delivery import (
    TurnDelivery,
    TurnDeliveryFactory,
)
from nanobot.agent.turn_delivery import TurnRoute as TurnRoute
from nanobot.agent.turn_hooks import AgentTurnHookSpec, build_agent_turn_hook
from nanobot.bus.events import INBOUND_META_USER_SHELL, InboundMessage, OutboundMessage
from nanobot.bus.outbound_events import (
    StreamDeltaEvent,
    StreamedResponseEvent,
    StreamEndEvent,
)
from nanobot.bus.queue import MessageBus
from nanobot.command import CommandContext, CommandRouter, register_builtin_commands
from nanobot.command.router import command_text, normalize_command_text
from nanobot.config.schema import AgentDefaults, ModelPresetConfig
from nanobot.events import NO_EVENTS, AgentEvent, EventSink
from nanobot.llm_usage.context import source_from_request
from nanobot.providers.base import LLMProvider, LLMUsage, ProviderConversationState
from nanobot.providers.factory import ProviderSnapshot
from nanobot.runtime_context import (
    RUNTIME_CONTEXT_HISTORY_META,
    RUNTIME_CONTEXT_MESSAGE_META,
    RuntimeContextBlock,
    RuntimeContextProvider,
    append_runtime_context,
    resolve_runtime_context,
    runtime_context_blocks_from_metadata,
)
from nanobot.security.workspace_access import (
    WorkspaceScopeResolver,
    bind_workspace_scope,
    reset_workspace_scope,
)
from nanobot.session import turn_continuation
from nanobot.session.automation_turns import automation_history_overrides
from nanobot.session.goal_state import goal_state_runtime_lines, sustained_goal_active
from nanobot.session.history_visibility import HIDDEN_HISTORY_META
from nanobot.session.keys import UNIFIED_SESSION_KEY, remember_last_channel
from nanobot.session.manager import SESSION_CACHE_MAX_SIZE, Session, SessionManager, SessionPolicy
from nanobot.session.model_selection import (
    SESSION_MODEL_PRESET_METADATA_KEY,
    model_preset_from_metadata,
)
from nanobot.session.recovery import (
    PENDING_FOLLOWUP_ID_KEY,
    RECOVERY_INBOUND_METADATA_KEY,
    RecoveryAdmission,
    acknowledge_pending_followups,
    pending_followups,
    record_pending_followup,
    restore_pending_interruption,
    restore_runtime_checkpoint,
)
from nanobot.session.summary import (
    SessionSummary,
    SessionSummaryCheckpoint,
)
from nanobot.triggers.local_turns import LocalTriggerTurnCoordinator
from nanobot.utils.cancellation import task_is_cancelling
from nanobot.utils.document import reference_non_image_attachments
from nanobot.utils.helpers import image_placeholder_text
from nanobot.utils.llm_runtime import LLMRuntime
from nanobot.utils.progress_events import output_events
from nanobot.utils.runtime import (
    EMPTY_FINAL_RESPONSE_MESSAGE,
)

if TYPE_CHECKING:
    from nanobot.config.schema import (
        ChannelsConfig,
        Config,
        ProviderConfig,
        ToolsConfig,
    )
    from nanobot.cron.service import CronService
    from nanobot.triggers.local_store import LocalTriggerStore

_T = TypeVar("_T")
_SUBAGENT_PROVIDER_TASK_META = "subagent_provider_task_id"
_SUBAGENT_TERMINAL_WAIT_SECONDS = 300.0


class TurnKind(Enum):
    USER = auto()
    SYSTEM = auto()


@dataclass
class TurnContext:
    msg: InboundMessage
    session_key: str
    turn_id: str
    runtime: LLMRuntime | None
    kind: TurnKind
    delivery: TurnDelivery
    original_user_text: str | None = None
    session: Session | None = None

    history: list[dict[str, Any]] = field(default_factory=list)
    transcript_input: TranscriptInput | None = None
    provider_state: ProviderConversationState | None = field(default=None, repr=False)
    request_context: RequestContext | None = None
    runtime_context_blocks: list[RuntimeContextBlock] = field(default_factory=list)
    attributes: dict[str, Any] = field(default_factory=dict)

    final_content: str | None = None
    all_messages: list[dict[str, Any]] = field(default_factory=list)
    stop_reason: str = ""
    failure_error_kind: str | None = None
    streamed_content: bool = False

    input_persisted_early: bool = False
    save_skip: int = 0

    outbound: OutboundMessage | None = None
    suppress_response: bool = False

    events: EventSink = NO_EVENTS
    streaming: bool = False
    on_runtime_admitted: Callable[[LLMRuntime], Awaitable[None]] | None = None

    pending_queue: asyncio.Queue[InboundMessage] | None = None
    pending_summary: SessionSummary | None = None
    summary_checkpoint: SessionSummaryCheckpoint | None = None
    provider_compaction_applied: bool = False

    ephemeral: bool = False
    run_extra_hooks_for_ephemeral: bool = False
    hooks: list[AgentHook] = field(default_factory=list)
    hook_factories: list[AgentTurnHookFactory] = field(default_factory=list)
    turn_scopes: list[AbstractContextManager[Any]] = field(default_factory=list)
    tools: ToolRegistry | None = None

    turn_wall_started_at: float = field(default_factory=time.time)
    visible_run_started_at: float | None = None
    turn_latency_ms: int | None = None
    usage: LLMUsage | None = None

    def require_runtime(self) -> LLMRuntime:
        """Return the runtime established by the BUILD stage."""
        if self.runtime is None:
            raise RuntimeError("turn runtime is not initialized; BUILD must run before this stage")
        return self.runtime

    def require_session(self) -> Session:
        """Return the session established by the RESTORE stage."""
        if self.session is None:
            raise RuntimeError("turn session is not initialized; RESTORE must run before this stage")
        return self.session


class AgentLoop:
    """
    The agent loop is the core processing engine.

    It:
    1. Receives messages from the bus
    2. Builds context with history, memory, skills
    3. Calls the LLM
    4. Executes tool calls
    5. Sends responses back
    """

    @property
    def tool_names(self) -> list[str]:
        return self.tools.tool_names

    @property
    def provider(self) -> LLMProvider:
        """Provider selected for future turn admissions."""
        return self.runtime_resolver.runtime.provider

    @property
    def model(self) -> str:
        """Model selected for future turn admissions."""
        return self.runtime_resolver.runtime.model

    @property
    def context_window_tokens(self) -> int:
        """Context limit selected for future turn admissions."""
        return self.runtime_resolver.runtime.context_window_tokens

    @property
    def model_presets(self) -> Mapping[str, ModelPresetConfig]:
        """Configured model presets exposed for selection and display."""
        return self.runtime_resolver.model_presets

    @property
    def model_preset(self) -> str | None:
        return self.runtime_resolver.model_preset

    @model_preset.setter
    def model_preset(self, name: str | None) -> None:
        self.set_model_preset(name)

    def llm_runtime(self) -> LLMRuntime:
        """Resolve the immutable default used to admit the next turn."""
        previous = self.runtime_resolver.runtime
        runtime = self.runtime_resolver.admit()
        if (
            runtime.model != previous.model
            or runtime.model_preset != previous.model_preset
            or runtime.snapshot_signature != previous.snapshot_signature
        ):
            self._publish_runtime_selection(runtime)
        return runtime

    def dream_runtime(self) -> LLMRuntime | None:
        """Resolve the optional preset used for Dream without changing defaults."""
        if not self.dream_model_preset:
            return None
        return self.runtime_resolver.resolve_preset(self.dream_model_preset)

    _RUNTIME_CHECKPOINT_KEY = "runtime_checkpoint"
    _PENDING_USER_TURN_KEY = "pending_user_turn"
    _PROVIDER_STATE_CHECKPOINT_VERSION_KEY = "provider_state_checkpoint_version"
    _PROVIDER_STATE_CHECKPOINT_VERSION = "v1"

    def __init__(
        self,
        bus: MessageBus,
        provider: LLMProvider,
        workspace: Path,
        model: str | None = None,
        max_iterations: int | None = None,
        max_concurrent_subagents: int | None = None,
        context_window_tokens: int | None = None,
        max_tool_result_chars: int | None = None,
        provider_retry_mode: str = "standard",
        tool_hint_ma
```

### Core Architecture Module: `nanobot/agent/progress_hook.py`
```
"""Agent hook that adapts runner events into channel progress UI."""

from __future__ import annotations

import json
from typing import Any

from loguru import logger

from nanobot.agent.hook import AgentHook, AgentHookContext
from nanobot.bus.outbound_events import ProgressEvent, StreamDeltaEvent, StreamEndEvent
from nanobot.events import NO_EVENTS, EventSink
from nanobot.providers.base import ToolCallRequest
from nanobot.utils.helpers import IncrementalThinkExtractor, strip_think
from nanobot.utils.progress_events import (
    build_tool_event_finish_payloads,
    build_tool_event_start_payload,
)
from nanobot.utils.tool_hints import format_tool_hints


class AgentProgressHook(AgentHook):
    """Translate runner lifecycle events into user-visible progress signals."""

    def __init__(
        self,
        events: EventSink = NO_EVENTS,
        *,
        streaming: bool = False,
        session_key: str | None = None,
        tool_hint_max_length: int = 40,
        log_content: bool = True,
    ) -> None:
        super().__init__(reraise=True)
        self._publish = events.publish
        self._streaming = streaming
        self._session_key = session_key
        self._tool_hint_max_length = tool_hint_max_length
        self._log_content = log_content
        self._stream_buf = ""
        self._think_extractor = IncrementalThinkExtractor()
        self._reasoning_open = False

    def wants_streaming(self) -> bool:
        return self._streaming

    @staticmethod
    def _strip_think(text: str | None) -> str | None:
        if not text:
            return None
        return strip_think(text) or None

    def _tool_hint(self, tool_calls: list[Any]) -> str:
        return format_tool_hints(tool_calls, max_length=self._tool_hint_max_length)

    async def on_stream(self, context: AgentHookContext, delta: str) -> None:
        prev_clean = strip_think(self._stream_buf)
        self._stream_buf += delta
        new_clean = strip_think(self._stream_buf)
        incremental = new_clean[len(prev_clean) :]

        if await self._think_extractor.feed(self._stream_buf, self.emit_reasoning):
            context.streamed_reasoning = True

        if incremental:
            # Answer text has started; close the reasoning segment so the UI can
            # lock the bubble before the answer renders below it.
            await self.emit_reasoning_end()
            if self._publish and self._streaming:
                await self._publish(StreamDeltaEvent(content=incremental))

    async def on_stream_end(self, context: AgentHookContext, *, resuming: bool) -> None:
        await self.emit_reasoning_end()
        if self._publish and self._streaming:
            await self._publish(StreamEndEvent(
                resuming=resuming, merge_next=context.stream_continues_current_message,
            ))
        self._stream_buf = ""
        self._think_extractor.reset()

    async def before_iteration(self, context: AgentHookContext) -> None:
        logger.debug(
            "Starting agent loop iteration {} for session {}",
            context.iteration,
            self._session_key,
        )

    async def on_provider_tool_event(
        self,
        context: AgentHookContext,
        event: dict[str, Any],
    ) -> None:
        if not self._publish:
            return
        phase = event.get("phase")
        name = event.get("name")
        call_id = event.get("call_id")
        if (
            phase not in {"start", "end", "error"}
            or not isinstance(name, str)
            or not name
            or not call_id
        ):
            return
        arguments = event.get("arguments")
        if not isinstance(arguments, dict):
            arguments = {}
        payload: dict[str, Any] = {
            "version": 1,
            "phase": phase,
            "call_id": str(call_id),
            "name": name,
            "arguments": arguments,
            "result": event.get("result") if phase == "end" else None,
            "error": event.get("error") if phase == "error" else None,
            "files": [],
            "embeds": [],
        }
        if phase == "start":
            await self.emit_reasoning_end()
            tool_call = ToolCallRequest(id=str(call_id), name=name, arguments=arguments)
            tool_hint = self._strip_think(self._tool_hint([tool_call])) or name
            await self._publish(ProgressEvent(
                content=tool_hint, tool_hint=True, tool_events=[payload],
            ))
            logger.info(
                "Provider-hosted tool call: {}({})",
                name,
                json.dumps(arguments, ensure_ascii=False)[:200]
                if self._log_content else "[content hidden]",
            )
            return
        await self._publish(ProgressEvent(tool_events=[payload]))

    async def before_execute_tools(self, context: AgentHookContext) -> None:
        if self._publish:
            if not self._streaming and not context.streamed_content:
                thought = self._strip_think(context.response.content if context.response else None)
                if thought:
                    await self._publish(ProgressEvent(content=thought))
            tool_hint = self._strip_think(self._tool_hint(context.tool_calls))
            tool_events = [build_tool_event_start_payload(tc) for tc in context.tool_calls]
            await self._publish(ProgressEvent(
                content=tool_hint or "", tool_hint=True, tool_events=tool_events,
            ))
        for tc in context.tool_calls:
            args_str = (
                json.dumps(tc.arguments, ensure_ascii=False)[:200]
                if self._log_content else "[content hidden]"
            )
            logger.info("Tool call: {}({})", tc.name, args_str)

    async def emit_reasoning(self, reasoning_content: str | None) -> None:
        """Publish a reasoning chunk; channel plugins decide whether to render."""
        if self._publish and reasoning_content:
            self._reasoning_open = True
            await self._publish(ProgressEvent(content=reasoning_content, reasoning_delta=True))

    async def emit_reasoning_end(self) -> None:
        """Close the current reasoning stream segment, if any was open."""
        if self._reasoning_open and self._publish:
            self._reasoning_open = False
            await self._publish(ProgressEvent(reasoning_end=True))
        else:
            self._reasoning_open = False

    async def after_iteration(self, context: AgentHookContext) -> None:
        if (
            self._publish
            and context.tool_calls
            and context.tool_events
        ):
            tool_events = build_tool_event_finish_payloads(context)
            if tool_events:
                await self._publish(ProgressEvent(tool_events=tool_events))
        u = context.usage
        logger.debug(
            "LLM usage: input={} output={} cache_read={} cache_write={} source={}",
            u.input_tokens if u else 0,
            u.output_tokens if u else 0,
            u.cache_read_tokens if u else None,
            u.cache_write_tokens if u else None,
            u.source if u else "missing",
        )

    def finalize_content(self, context: AgentHookContext, content: str | None) -> str | None:
        return self._strip_think(content)

```

### Core Architecture Module: `nanobot/agent/tools/file_state.py`
```
"""Track file reads whose original results may still be in model context."""

from __future__ import annotations

import hashlib
from collections import OrderedDict
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class _FileReadContext:
    call_id: str
    tool_results: Callable[[], Mapping[str, str]]


_current_file_read: ContextVar[_FileReadContext | None] = ContextVar(
    "nanobot_file_read_context", default=None,
)


@contextmanager
def file_read_context(
    call_id: str, tool_results: Callable[[], Mapping[str, str]],
) -> Generator[None]:
    """Bind one file read; resolve visible results only when checking a prior read."""
    token = _current_file_read.set(_FileReadContext(call_id, tool_results))
    try:
        yield
    finally:
        _current_file_read.reset(token)


@dataclass(slots=True)
class ReadState:
    offset: int
    limit: int | None
    content_hash: str | None
    call_id: str | None
    result_hash: str | None


def _hash_file(p: str) -> str | None:
    try:
        return hashlib.sha256(Path(p).read_bytes()).hexdigest()
    except OSError:
        return None


class FileStates:
    """Cache read receipts per session; deduplicate only while their results are visible."""

    __slots__ = ("_state",)

    def __init__(self) -> None:
        self._state: dict[str, ReadState] = {}

    def record_read(
        self, path: str | Path, offset: int = 1, limit: int | None = None, *,
        content_hash: str | None = None, result: str | None = None,
    ) -> None:
        """Record the file snapshot and complete result of a successful text read."""
        p = str(Path(path).resolve())
        context = _current_file_read.get()
        self._state[p] = ReadState(
            offset=offset,
            limit=limit,
            content_hash=content_hash if content_hash is not None else _hash_file(p),
            call_id=context.call_id if context is not None else None,
            result_hash=hashlib.sha256(result.encode("utf-8")).hexdigest() if result else None,
        )

    def record_write(self, path: str | Path) -> None:
        """Invalidate a prior read after a write; a write summary is not file content."""
        self._state.pop(str(Path(path).resolve()), None)

    def is_unchanged(
        self, path: str | Path, offset: int = 1, limit: int | None = None, *,
        content_hash: str | None = None,
    ) -> bool:
        """Check both file identity and the original result in the actual model input."""
        p = str(Path(path).resolve())
        entry = self._state.get(p)
        context = _current_file_read.get()
        if entry is None or context is None or not entry.call_id or not entry.result_hash:
            return False
        if entry.offset != offset or entry.limit != limit:
            return False
        result = context.tool_results().get(entry.call_id)
        if result is None or hashlib.sha256(result.encode("utf-8")).hexdigest() != entry.result_hash:
            self._state.pop(p, None)
            return False
        current_hash = content_hash if content_hash is not None else _hash_file(p)
        return current_hash is not None and current_hash == entry.content_hash

    def get(self, path: str | Path) -> ReadState | None:
        """Return the raw ReadState entry for a path, or None."""
        return self._state.get(str(Path(path).resolve()))

    def clear(self) -> None:
        """Clear all tracked state (useful for testing)."""
        self._state.clear()


class FileStateStore:
    """Bounded lookup table for per-session file read/write state."""

    __slots__ = ("_max_sessions", "_states_by_key")

    def __init__(self, *, max_sessions: int = 128) -> None:
        if max_sessions <= 0:
            raise ValueError("max_sessions must be positive")
        self._max_sessions = max_sessions
        self._states_by_key: OrderedDict[str, FileStates] = OrderedDict()

    def for_session(self, session_key: str | None) -> FileStates:
        key = session_key or "__default__"
        states = self._states_by_key.pop(key, None)
        if states is None:
            states = FileStates()
        self._states_by_key[key] = states
        while len(self._states_by_key) > self._max_sessions:
            self._states_by_key.popitem(last=False)
        return states

    def discard(self, session_key: str | None) -> None:
        """Forget file state when a session is reset or removed."""
        self._states_by_key.pop(session_key or "__default__", None)

    def clear(self) -> None:
        self._states_by_key.clear()


_current_file_states: ContextVar[FileStates | None] = ContextVar(
    "nanobot_file_states",
    default=None,
)


def current_file_states(default: FileStates) -> FileStates:
    """Return the FileStates bound to the current agent task, or a fallback."""
    return _current_file_states.get() or default


def bind_file_states(file_states: FileStates) -> Token[FileStates | None]:
    """Bind file read/write state for the current async task."""
    return _current_file_states.set(file_states)


def reset_file_states(token: Token[FileStates | None]) -> None:
    _current_file_states.reset(token)

```

### Core Architecture Module: `nanobot/agent/tools/path_utils.py`
```
"""Shared path helpers for workspace-scoped tools."""

from pathlib import Path

from nanobot.config.paths import get_media_dir
from nanobot.security.workspace_policy import resolve_allowed_path


def resolve_workspace_path(
    path: str,
    workspace: Path | None = None,
    allowed_dir: Path | None = None,
    extra_allowed_dirs: list[Path] | None = None,
    extra_allowed_files: list[Path] | None = None,
    include_media_dir: bool = True,
) -> Path:
    """Resolve path against workspace and enforce allowed directory containment."""
    media_roots = [get_media_dir()] if include_media_dir else []
    extra_roots = [*media_roots, *(extra_allowed_dirs or [])] if allowed_dir else None
    return resolve_allowed_path(
        path,
        workspace=workspace,
        allowed_root=allowed_dir,
        extra_allowed_roots=extra_roots,
        extra_allowed_files=extra_allowed_files,
    )

```

### Core Architecture Module: `nanobot/agent/turn_hooks.py`
```
"""Turn-scoped hook assembly for agent runs."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from loguru import logger

from nanobot.agent.hook import (
    AgentHook,
    AgentTurnHookContext,
    AgentTurnHookFactory,
    CompositeHook,
)
from nanobot.agent.progress_hook import AgentProgressHook
from nanobot.events import NO_EVENTS, EventSink


@dataclass(slots=True)
class AgentTurnHookSpec:
    """Inputs needed to build the hook chain for one agent turn."""

    events: EventSink = NO_EVENTS
    streaming: bool = False
    channel: str = "cli"
    chat_id: str = "direct"
    message_id: str | None = None
    metadata: dict[str, Any] | None = None
    session_key: str | None = None
    workspace: Path | None = None
    tool_hint_max_length: int = 40
    registered_hook_factories: list[AgentTurnHookFactory] = field(default_factory=list)
    turn_hook_factories: list[AgentTurnHookFactory] = field(default_factory=list)
    registered_hooks: list[AgentHook] = field(default_factory=list)
    turn_hooks: list[AgentHook] = field(default_factory=list)
    ephemeral: bool = False
    run_extra_hooks_for_ephemeral: bool = False
    attributes: dict[str, Any] | None = None
    log_content: bool = True


def build_agent_turn_hook(spec: AgentTurnHookSpec) -> AgentHook:
    """Build the hook chain used by ``AgentRunner`` for one turn."""
    log_content = spec.log_content and not spec.ephemeral
    progress_hook = AgentProgressHook(
        events=spec.events,
        streaming=spec.streaming,
        session_key=spec.session_key,
        tool_hint_max_length=spec.tool_hint_max_length,
        log_content=log_content,
    )
    if spec.ephemeral and not spec.run_extra_hooks_for_ephemeral:
        return progress_hook

    turn_context = AgentTurnHookContext(
        events=spec.events,
        workspace=spec.workspace,
        channel=spec.channel,
        chat_id=spec.chat_id,
        message_id=spec.message_id,
        session_key=spec.session_key,
        metadata=dict(spec.metadata or {}),
        attributes=dict(spec.attributes or {}),
        ephemeral=spec.ephemeral,
    )
    hook_chain: list[AgentHook] = [progress_hook]

    for factory in spec.registered_hook_factories:
        try:
            created_hook = factory(turn_context)
        except Exception:
            logger.opt(exception=log_content).error(
                "Agent turn hook factory failed: {}",
                factory if log_content else type(factory).__name__,
            )
            continue
        if created_hook is not None:
            hook_chain.append(created_hook)

    hook_chain.extend(spec.registered_hooks)

    for factory in spec.turn_hook_factories:
        try:
            created_hook = factory(turn_context)
        except Exception:
            logger.opt(exception=log_content).error(
                "Agent turn hook factory failed: {}",
                factory if log_content else type(factory).__name__,
            )
            continue
        if created_hook is not None:
            hook_chain.append(created_hook)

    hook_chain.extend(spec.turn_hooks)
    return CompositeHook(hook_chain) if len(hook_chain) > 1 else progress_hook

```

### Core Architecture Module: `nanobot/apps/cli/utils.py`
```
"""CLI Apps helpers shared by the agent loop and settings surfaces."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, cast


def session_extra(metadata: Mapping[str, Any] | None) -> dict[str, Any]:
    """Return persisted session kwargs for CLI app attachments."""
    cli_apps = metadata.get("cli_apps") if isinstance(metadata, Mapping) else None
    return {"cli_apps": cli_apps} if isinstance(cli_apps, list) and cli_apps else {}


def runtime_lines_for_request(
    text: str,
    metadata: Mapping[str, Any] | None,
    workspace: Path,
) -> list[str]:
    """Return CLI App annotations from an immutable request snapshot."""
    structured = metadata.get("cli_apps") if isinstance(metadata, Mapping) else None
    if isinstance(structured, list):
        from nanobot.apps.cli.service import cli_app_skill_relative_path

        structured_items = cast(list[Any], structured)
        mentions = [
            cast(Mapping[str, Any], item) for item in structured_items
            if isinstance(item, Mapping)
            and isinstance(cast(Mapping[str, Any], item).get("name"), str)
        ]
        if mentions:
            return [
                "CLI App Attachment: "
                f"@{str(item['name']).strip().lower()} "
                f"(installed; tool=run_cli_app; "
                f"entry_point={str(item.get('entry_point') or 'unknown')}; "
                f"skill={cli_app_skill_relative_path(workspace, str(item['name']))}). "
                "Read the skill when useful, then run this app with `run_cli_app`; do not bypass it with shell."
                for item in mentions
                if str(item.get("name") or "").strip()
            ]
    if "@" not in text:
        return []
    try:
        from nanobot.apps.cli import CliAppManager

        mentions = cast(
            list[dict[str, Any]],
            CliAppManager(workspace=workspace).mentioned_installed_apps(text),
        )
    except Exception:
        return []
    return [
        "CLI App Mention: "
        f"@{item['name']} "
        f"(installed; tool={item['tool']}; "
        f"entry_point={item['entry_point'] or 'unknown'}; "
        f"skill={item['skill']}). "
        "Read the skill when useful, then run this app with `run_cli_app`; do not bypass it with shell."
        for item in mentions
    ]

```

### Core Architecture Module: `nanobot/bus/queue.py`
```
"""Queued delivery of messages and typed events between core and channels."""

import asyncio
import contextlib
import inspect
from collections.abc import Awaitable, Callable, Mapping
from typing import Any, TypeVar, overload

from loguru import logger

from nanobot.bus.events import InboundMessage, OutboundMessage
from nanobot.bus.outbound_events import outbound_message_for_event
from nanobot.events import AgentEvent

_EventT = TypeVar("_EventT", bound=AgentEvent)
EventHandler = Callable[[AgentEvent], Awaitable[None] | None]


class MessageBus:
    """
    Async message bus that decouples chat channels from the agent core.

    Channels push messages to the inbound queue. Core operations publish text,
    media, or typed events to the same routed outbound queue, independently of
    whether an LLM produced them. Channel adapters own their wire projection.

    Local subscribers are awaited by ``publish``; channel delivery is queued by
    ``publish_event``. Local state transitions never wait for network sends.
    """

    def __init__(self):
        self.inbound: asyncio.Queue[InboundMessage] = asyncio.Queue()
        self.outbound: asyncio.Queue[OutboundMessage] = asyncio.Queue()
        self._handlers: list[EventHandler] = []
        self._pending: set[asyncio.Task[None]] = set()

    async def publish_inbound(self, msg: InboundMessage) -> None:
        """Publish a message from a channel to the agent."""
        await self.inbound.put(msg)

    async def consume_inbound(self) -> InboundMessage:
        """Consume the next inbound message (blocks until available)."""
        return await self.inbound.get()

    async def publish_outbound(self, msg: OutboundMessage) -> None:
        """Queue a routed message or event for its channel."""
        await self.outbound.put(msg)

    async def publish_event(
        self,
        event: AgentEvent,
        *,
        channel: str,
        chat_id: str,
        metadata: Mapping[str, Any] | None = None,
    ) -> None:
        """Queue a typed event using the existing outbound delivery contract.

        The bus transports event values without inspecting their fields. Known
        events retain their text fallback; channel adapters decide how to render
        or ignore events they receive.
        """
        await self.publish_outbound(outbound_message_for_event(
            channel=channel, chat_id=chat_id, event=event, metadata=metadata,
        ))

    async def consume_outbound(self) -> OutboundMessage:
        """Consume the next outbound message (blocks until available)."""
        return await self.outbound.get()

    @property
    def inbound_size(self) -> int:
        """Number of pending inbound messages."""
        return self.inbound.qsize()

    @property
    def outbound_size(self) -> int:
        """Number of pending outbound messages."""
        return self.outbound.qsize()

    @overload
    def subscribe(
        self, handler: Callable[[_EventT], Awaitable[None] | None],
        event_type: type[_EventT],
    ) -> Callable[[], None]: ...

    @overload
    def subscribe(
        self, handler: EventHandler, event_type: None = None,
    ) -> Callable[[], None]: ...

    def subscribe(
        self,
        handler: Callable[..., Awaitable[None] | None],
        event_type: type[AgentEvent] | None = None,
    ) -> Callable[[], None]:
        """Connect an ordered, awaited handler; return its idempotent disconnect.

        The overloads bind handler and event type. The erased callable exists
        only at this heterogeneous dispatch boundary, behind the type filter.
        """
        active = True

        def entry(event: AgentEvent) -> Awaitable[None] | None:
            if active and (event_type is None or isinstance(event, event_type)):
                return handler(event)
            return None
        self._handlers.append(entry)

        def _unsubscribe() -> None:
            nonlocal active
            active = False
            with contextlib.suppress(ValueError):
                self._handlers.remove(entry)

        return _unsubscribe

    async def publish(self, event: AgentEvent) -> None:
        """Await local subscribers in registration order, without channel delivery."""
        for handler in list(self._handlers):
            try:
                result = handler(event)
                if inspect.isawaitable(result):
                    await result
            except Exception:
                logger.exception("event handler failed for {}", type(event).__name__)

    def publish_nowait(self, event: AgentEvent) -> asyncio.Task[None] | None:
        """Schedule local dispatch, retaining it until completion.

        Unlike ``publish``, the caller does not wait for handlers. This does not
        turn individual handlers into independent workers or change their order.
        Separate publications may interleave; this is not a global event FIFO.
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            logger.debug("dropping event without a running loop: {}", type(event).__name__)
            return None
        task = loop.create_task(self.publish(event))
        self._pending.add(task)
        task.add_done_callback(self._pending.discard)
        return task

    async def drain(self) -> None:
        """Finish scheduled dispatches after producers stop, before disconnecting."""
        while self._pending:
            pending = tuple(self._pending)
            await asyncio.gather(*pending, return_exceptions=True)
            self._pending.difference_update(pending)

```

### Core Architecture Module: `nanobot/channels/linear/state.py`
```
"""Durable installation and webhook state owned by the Linear channel."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from collections.abc import Generator
from contextlib import closing, contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

from nanobot.config.paths import get_config_path, get_runtime_subdir


@dataclass(frozen=True, slots=True)
class LinearInstallation:
    organization_id: str
    oauth_client_id: str
    app_user_id: str
    access_token: str
    refresh_token: str
    expires_at: float
    scope: tuple[str, ...] = ()
    organization_name: str = ""
    # Store-owned lifecycle metadata, separate from the credential value's equality.
    authorized_at: float = field(default=0, compare=False)


@dataclass(frozen=True, slots=True)
class QueuedWebhook:
    delivery_id: str
    payload: dict[str, Any]
    attempts: int


class LinearStateStore:
    """Small SQLite store so webhook acknowledgement is durable and idempotent."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or (get_runtime_subdir("linear") / "state.sqlite3")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._guard = threading.RLock()
        self._initialize()
        try:
            os.chmod(self.path.parent, 0o700)
            os.chmod(self.path, 0o600)
        except OSError:
            pass

    @contextmanager
    def _connect(self) -> Generator[sqlite3.Connection, None, None]:
        # SQLite's transaction context commits/rolls back but does not close.
        # Release file descriptors on every operation, including setup failures.
        with closing(sqlite3.connect(self.path, timeout=10)) as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA synchronous=FULL")
            with connection:
                yield connection

    def _initialize(self) -> None:
        with self._guard, self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS installations (
                    organization_id TEXT PRIMARY KEY,
                    oauth_client_id TEXT NOT NULL,
                    app_user_id TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT NOT NULL,
                    expires_at REAL NOT NULL,
                    scope_json TEXT NOT NULL,
                    organization_name TEXT NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS webhook_events (
                    delivery_id TEXT PRIMARY KEY,
                    payload_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    next_attempt_at REAL NOT NULL DEFAULT 0,
                    last_error TEXT,
                    created_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS webhook_receipts (
                    delivery_id TEXT PRIMARY KEY,
                    received_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS member_access (
                    oauth_client_id TEXT NOT NULL,
                    organization_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)),
                    PRIMARY KEY (oauth_client_id, organization_id, user_id)
                );
                """
            )
            columns = {
                str(row["name"])
                for row in connection.execute("PRAGMA table_info(installations)").fetchall()
            }
            if "oauth_client_id" not in columns:
                connection.execute(
                    "ALTER TABLE installations ADD COLUMN oauth_client_id TEXT NOT NULL DEFAULT ''"
                )
            if "authorized_at" not in columns:
                connection.execute(
                    "ALTER TABLE installations ADD COLUMN authorized_at REAL NOT NULL DEFAULT 0"
                )
            connection.execute(
                "DELETE FROM webhook_receipts WHERE received_at < ?",
                (time.time() - 30 * 24 * 60 * 60,),
            )

    def has_installations(self, oauth_client_id: str | None = None) -> bool:
        with self._guard, self._connect() as connection:
            if oauth_client_id is None:
                row = connection.execute("SELECT 1 FROM installations LIMIT 1").fetchone()
            else:
                row = connection.execute(
                    "SELECT 1 FROM installations WHERE oauth_client_id = ? LIMIT 1",
                    (oauth_client_id,),
                ).fetchone()
        return row is not None

    def save_installation(
        self, installation: LinearInstallation, *, reauthorize: bool = False,
    ) -> None:
        now = time.time()
        with self._guard, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO installations (
                    organization_id, oauth_client_id, app_user_id, access_token, refresh_token,
                    expires_at, scope_json, organization_name, updated_at, authorized_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(organization_id) DO UPDATE SET
                    oauth_client_id=excluded.oauth_client_id,
                    app_user_id=excluded.app_user_id,
                    access_token=excluded.access_token,
                    refresh_token=excluded.refresh_token,
                    expires_at=excluded.expires_at,
                    scope_json=excluded.scope_json,
                    organization_name=excluded.organization_name,
                    updated_at=excluded.updated_at,
                    authorized_at=CASE
                        WHEN ? OR installations.oauth_client_id != excluded.oauth_client_id
                        THEN excluded.authorized_at ELSE installations.authorized_at END
                """,
                (
                    installation.organization_id,
                    installation.oauth_client_id,
                    installation.app_user_id,
                    installation.access_token,
                    installation.refresh_token,
                    installation.expires_at,
                    json.dumps(installation.scope),
                    installation.organization_name,
                    now,
                    now,
                    reauthorize,
                ),
            )

    def refresh_installation(
        self, previous: LinearInstallation, refreshed: LinearInstallation,
    ) -> bool:
        """Rotate only the credentials read before the request, never insert a grant."""
        if (refreshed.organization_id != previous.organization_id
                or refreshed.oauth_client_id != previous.oauth_client_id):
            raise ValueError("A token refresh cannot change the Linear workspace or app")
        with self._guard, self._connect() as connection:
            result = connection.execute(
                """
                UPDATE installations
                SET access_token = ?, refresh_token = ?, expires_at = ?, scope_json = ?, updated_at = ?
                WHERE organization_id = ? AND oauth_client_id = ? AND authorized_at = ?
                    AND access_token = ? AND refresh_token = ?
                """,
                (refreshed.access_token, refreshed.refresh_token, refreshed.expires_at,
                 json.dumps(refreshed.scope), time.time(), previous.organization_id,
                 previous.oauth_client_id, previous.authorized_at,
                 previous.access_token, previous.refresh_token),
            )
            return result.rowcount == 1

    def installation(self, organization_id: str) -> LinearInstallation | None:
        with self._guard, self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM installations WHERE organization_id = ?",
                (organization_id,),
            ).fetchone()
        return _installation_from_row(row) if row is not None else None

    def list_installations(
        self,
        oauth_client_id: str | None = None,
    ) -> list[LinearInstallation]:
        """Return installations, optionally restricted to one OAuth client."""
        with self._guard, self._connect() as connection:
            if oauth_client_id is None:
                rows = connection.execute(
                    "SELECT * FROM installations ORDER BY organization_name, organization_id"
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT * FROM installations
                    WHERE oauth_client_id = ?
                    ORDER BY organization_name, organization_id
                    """,
                    (oauth_client_id,),
                ).fetchall()
        return [_installation_from_row(row) for row in rows]

    def delete_installation(
        self, organization_id: str, *, oauth_client_id: str | None = None,
        revoked_at: float | None = None, expected: LinearInstallation | None = None,
    ) -> bool:
        """Remove an installation, ignoring revocations from an older authorization."""
        with self._guard, self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            current = connection.execute(
                "SELECT * FROM installations WHERE organization_id = ?",
                (organization_id,),
            ).fetchone()
            if current is None:
                return False
            if expected is not None and (
                _installation_from_row(current) != expected
             
```

### Core Architecture Module: `nanobot/channels/weixin/state.py`
```
"""WeChat-owned persisted login-state detection."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from nanobot.channels.contracts import channel_field_value
from nanobot.config.paths import get_config_path


def local_state_present(section: Any) -> bool:
    configured_dir = channel_field_value(section, "stateDir")
    state_dir = (
        Path(str(configured_dir)).expanduser()
        if configured_dir
        else get_config_path().parent / "weixin"
    )
    try:
        payload = json.loads((state_dir / "account.json").read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return False
    return bool(str(payload.get("token") or "").strip())


__all__ = ["local_state_present"]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6075** (2026-10-05): **fix(webui): fit wide equations and refine math spacing**
  *Symptoms*: ## Problem and behavior  Wide display equations overflowed the conversation column and were clipped, especially at narrow widths or increased browser zoom. Fit each display equation to the available width without horizontal scrolling or click-to-expand controls. Equations that fit retain their natural size; width, content and font-loading changes recalculate the scale and occupied height.  Tighten math-heavy prose spacing, use a 1.1em display-math font size, and center display equations within their content area, including equations within list items or emitted as sibling blocks after a list. Preserve TeX content, MathML accessibility and existing multiline alignment.  The renderer remains KaTeX. Local font-comparison pages and temporary preview dependencies are excluded.  ## Validation  - WebUI coverage suite: 148 files / 2,511 tests passed, 92% statement and line coverage. - Two additional regression tests passed for narrowing/restoring the available width and a growing streaming formula. - WebUI lint and production build passed. - Built WebUI served through an isolated real gateway: verified the six representative equations, complete formula bounds, short-formula sizing, tight spacing, multiline rendering, desktop/narrow layouts, dark mode, refresh and absence of runtime errors. - Verified centered equations and compact list/paragraph spacing in the actual chat session at desktop, 640px and 390px widths, with complete formula bounds and no runtime errors. - Verified local 

- **Issue #6066** (2026-10-05): **fix(mcp): let streamable HTTP read timeout cover tool_timeout**
  *Symptoms*: Fixes #6065  ## Problem  The streamable HTTP transport builds its httpx client with `httpx.Timeout(30.0, connect=10.0)`, which pins the **read** timeout to 30s regardless of `MCPServerConfig.tool_timeout`. This came in with #4230, which replaced the previous unbounded client with a finite timeout. That was the right direction, but it also capped `read` well below the MCP SDK's own default (`httpx.Timeout(30, read=300)`, i.e. `MCP_DEFAULT_TIMEOUT` / `MCP_DEFAULT_SSE_READ_TIMEOUT` in `mcp/shared/_httpx_utils.py`).  When a server sends nothing until the result is ready (e.g. FastMCP with `json_response=True`), httpx raises `ReadTimeout` after 30s inside the SDK's POST handler. The response never reaches the session, so the call hangs until `MCPToolWrapper`'s `asyncio.wait_for(..., tool_timeout)` fires and the user sees `(MCP tool call timed out after 60s)` even though the server answered at ~32s.  Servers that stream SSE keep-alive pings (FastMCP's default SSE mode pings every 15s) don't hit this, since each ping resets httpx's read timer. That's probably why it went unnoticed.  ## Fix  - Use the SDK's defaults for the streamable HTTP client: 30s for write/pool, read 300s; keep `connect=10.0` from #4230. - Raise `read` to `tool_timeout` when it is larger, so the transport never cuts a call short before nanobot's own per-call timeout does. - The values are mirrored as module constants instead of importing them from the SDK's private `_httpx_utils` module.  The timeout stays finit

- **Issue #6065** (2026-10-05): **MCP streamable HTTP uses a fixed 30s read timeout despite tool_timeout**
  *Symptoms*: ### Bug Description  The MCP streamable HTTP client creates an HTTPX client with a fixed timeout of 30 seconds:  httpx.Timeout(30.0, connect=10.0)  This is independent of MCPServerConfig.tool_timeout. When a valid FastMCP JSON response takes longer than 30 seconds, the request does not complete successfully even when tool_timeout is configured to 60 seconds or more.  In a real test, the server completed the response after 32 seconds, but nanobot ultimately returned:  (MCP tool call timed out after 60s)  ### Steps to Reproduce  1. Start a FastMCP streamable HTTP server that returns a valid JSON tool response after 32 seconds. 2. Configure the MCP server with `tool_timeout: 60`. 3. Connect nanobot to the server using the `streamableHttp` transport. 4. Invoke the delayed MCP tool. 5. Observe that the server completes after approximately 32 seconds, but nanobot eventually reports a timeout after 60 seconds.  ### Expected Behavior  The HTTPX read timeout should be compatible with the configured `tool_timeout`, or the timeout ownership should be made explicit.  A valid response that completes within `tool_timeout` should be returned successfully. With `tool_timeout: 60`, a response completed after 32 seconds should not fail because of an internal fixed 30-second HTTP read timeout.  ### Relevant Logs  ```shell MCP tool 'mcp_slow_delayed' timed out after 60s (MCP tool call timed out after 60s) ```  ### nanobot Version  0.3.5  ### Python Version  3.12  ### Operating System  Windows  #
  **Post-Mortem & Fix Analysis**:
  > Confirmed on `main` (6ff96f2): `nanobot/agent/tools/mcp.py:1123` passes `httpx.Timeout(30.0, connect=10.0)`, so the read timeout is 30s regardless of `tool_timeout`. A server that answers at 32s hits httpx's `ReadTimeout` first, and the outer `asyncio.wait_for(..., tool_timeout)` only reports it afterwards.  This came in with #4230, whose description says it "matches the intended MCP default behavior", but the SDK default (`mcp/shared/_httpx_utils.py`, mcp 1.26.0) is `httpx.Timeout(30, read=300)` (`MCP_DEFAULT_SSE_READ_TIMEOUT = 300.0`). Keeping the timeout finite (the point of #4230) while using `read=max(300, tool_timeout)` would restore the SDK default and honour a larger `tool_timeout`.  I'll open a PR with a regression test for this. 

- **Issue #6060** (2026-10-05): **fix(documents): read cells beyond declared XLSX dimensions**
  *Symptoms*: XLSX sheets can contain cells outside their declared used range. In read-only mode, openpyxl trusts that range, so nanobot silently drops those cells from document previews, `read_file`, and `grep`. For a two-by-two sheet with `A1:A1` metadata, only the first cell was extracted and searching for the value in B2 returned no match.  Reset each worksheet's dimensions before iterating so the cell XML determines the available rows and columns, following [openpyxl's guidance for incorrect worksheet dimensions](https://openpyxl.readthedocs.io/en/stable/optimized.html#worksheet-dimensions). Reading remains streamed.  Extend the existing XLSX search test with real workbooks whose XML declares too few rows, too few columns, or both. It checks both complete text extraction and the sheet/row/cell locator from `grep`, with the correctly declared range as a control. The three incorrect-range cases fail before the fix and pass afterward.  Validation (Python 3.12): - 208 tests passed across `tests/tools/test_search_tools.py`, `tests/tools/test_read_enhancements.py`, `tests/tools/test_filesystem_tools.py`, and `tests/test_document_parsing.py`, using a temporary nanobot config path. - `ruff check nanobot/utils/document.py tests/tools/test_search_tools.py` passed. - `basedpyright nanobot/utils/document.py` passed. - `git diff --check` passed. 

- **Issue #6049** (2026-10-04): **fix(webui): keep edit diffs visible and distinguish file creation**
  *Symptoms*: Completed answers hide file edit diffs behind their activity details menu, even when the user selects diff or collapsed diff display. The controlled expansion path introduced in #5831 bypasses the timeline splitting added in #5714. File creation also appears as Edited.  Restore timeline splitting for controlled activity so edit diffs remain visible when reasoning and tool details are collapsed. Preserve edit order and give the answer menu one disclosure container while each reasoning segment owns its own ID.  The gateway now records operation=create when a file did not exist before a successful tool call and exists afterward. WebUI shows Created for these events, including empty files, with translations in all ten locales. Creating a file with content still produces a diff; creating an empty file has no text diff. Writing into an existing empty file remains an edit. File change headers consistently show the operation, file path and line counts, including when a diff is visible. Creation, editing, deletion, progress, failure, summary labels and accessible descriptions remain explicit. Historical events without a creation marker retain their existing edit classification.  Review file activity labels and diff controls across all ten locales in their rendered context. Simplified Chinese uses 创建 / 编辑 / 删除; Traditional Chinese uses 建立 / 編輯 / 刪除. Japanese short labels use consistent action names; Korean creation matches the existing completion-label style. Keep natural completion fo

- **Issue #6030** (2026-10-04): **fix(cli-apps): preserve XDG_RUNTIME_DIR for desktop CLIs**
  *Symptoms*: CLI Apps discarded `XDG_RUNTIME_DIR` even when the gateway inherited it, preventing Obsidian on GNOME/Wayland from locating its running desktop app. Preserve the existing value in the Unix environment shared by CLI App management and run commands, and document how the gateway inherits the desktop session's runtime directory.  Fixes #6024  ## Validation  - Regression proof before the fix: 4 failed, 7 passed. The failures isolate the missing runtime directory in the Linux/macOS environment branches and both real child-process entry points. - `uv run --no-sync python -m pytest tests/apps/test_cli_subprocess_env.py tests/cli_apps tests/webui/test_cli_apps_api.py -q`: 56 passed, 0 skipped. - `uv run --no-sync ruff check nanobot tests conftest.py`: passed. - `uv run --no-sync basedpyright`: 0 errors, 0 warnings, 0 notes. - Tests verify that an unset runtime directory stays absent, the Windows environment remains unchanged, and provider credential sentinels never reach either child process.  The real child-process tests ran on macOS with Python 3.12.14. Native Obsidian/GNOME reproduction and native Linux/Windows execution were unavailable on this host; Linux and Windows environment branches are covered by controlled platform tests.  ## AI assistance  Codex traced the filtered environment, implemented the runtime-directory fix, and added and ran the subprocess regression tests. 

- **Issue #6024** (2026-10-04): **CLI App for Obsidian says "unable to find Obsidian" under nanobot but works in terminal (XDG_RUNTIME_DIR not reaching the CLI?)**
  *Symptoms*: ### Bug Description  **Version / setup** nanobot-ai 0.3.5 (uv tool), Ubuntu, GNOME on Wayland Obsidian desktop 1.13.7 (.deb, /opt/Obsidian), Command line interface enabled Gateway started with: <how you start it> Model/provider: <fill in>  **What happens** 1. Obsidian is open. In a terminal, `obsidian tags counts` works. 2. In the WebUI I installed the "Obsidian CLI" App (plugin cli-app-obsidian-cli, enabled). 3. I asked: "Get my tag count @Obsidian CLI". 4. The CLI App returns: "The CLI is unable to find Obsidian. Please make sure Obsidian is running and try again."  **Evidence** 1. `env -i HOME="$HOME" PATH="$PATH" obsidian tags counts` fails with the same message. 2. Adding only XDG_RUNTIME_DIR makes it work. Adding only DBUS_SESSION_BUS_ADDRESS, DISPLAY, or WAYLAND_DISPLAY does not. 3. The gateway process (checked via /proc/<pid>/environ) has XDG_RUNTIME_DIR and a PATH that starts with ~/.local/bin. 4. The agent's shell tool resolved `obsidian` to /usr/bin/obsidian (the app launcher), not ~/.local/bin/obsidian. This is from the agent's own output, which I have not independently verified. 5. Workaround that works: the shell exec tool with    XDG_RUNTIME_DIR=/run/user/1000 /home/<user>/.local/bin/obsidian tags total    returns 165.  **Suspected cause (not confirmed in the source)** CLI Apps seem to run with a reduced environment, so the Obsidian CLI cannot locate the running app.  **Question / request** Is there a supported way to pass environment variables such as XDG_RUNT

- **Issue #6016** (2026-10-03): **fix(webui): prevent Windows manifest read/replace races**
  *Symptoms*: Concurrent transcript requests can read `manifest.json` while another request rebuilds it. On Windows, the open reader prevents atomic replacement and raises `PermissionError: [WinError 5]`, as seen in the [latest main CI run](https://github.com/HKUDS/nanobot/actions/runs/37039650248).  Read the manifest under the existing lock shared by repair, rotation, and compaction. This closes the reader before replacement and retains single-flight repair. Strengthen the existing concurrency regression with a controlled overlap and simulated Windows file-sharing behavior so it fails reliably on the previous implementation, including on Linux.  Validation: - Regression reproduced `PermissionError` before the fix and passes after it. - Transcript tests: 45 passed. - Real gateway smoke and WebSocket HTTP route tests: 121 passed. - Repository Ruff, strict BasedPyright, dependency consistency, and `git diff --check` passed. - Local checks ran on Linux/Python 3.12; the PR CI matrix validates Windows/Python 3.14. 

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

### Incident Patch 1: `07c4e3f0` (2026-10-05)
**Commit Message**: fix(webui): fit wide equations and refine math spacing (#6075)

* fix(webui): fit wide equations and refine math spacing

* refactor(webui): colocate display math styles with its component

* style(webui): trim math stylesheet trailing whitespace

* fix(webui): tighten spacing after display equations

* fix(webui): tighten spacing for equations within lists

* fix(webui): center responsive display equations

**File**: `webui/src/components/DisplayMath.css` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+.math-fit {
+  position: relative;
+  display: block;
+  width: 100%;
+  min-width: 0;
+  margin-block: 0.45em 0.5em;
+}
+
+.math-fit-content {
+  position: absolute;
+  top: 0;
+  left: 50%;
+  width: max-content;
+  padding-block: 0.1em;
+  transform-origin: top center;
+}
+
+.math-fit .katex-display {
+  margin: 0;
+}
+
+.math-fit .katex-display > .katex {
+  font-size: 1.1em;
+}
+
+/* Math-heavy prose uses a tighter reading rhythm than ordinary chat. */
+.markdown-content:has(.math-fit) {
+  --cjk-line-height: 1.65;
+}
+
+/* Keep list formulas close to their explanations. */
+.markdown-content li .math-fit {
+  margin-block: 0.3em 0.35em;
+}
+
+.markdown-content li > p:has(.math-fit) {
+  margin-block: 0;
+}
+
+.markdown-content li:has(.math-fit) {
+  margin-block: 0.35em;
+}
+
+.markdown-content li:has(.math-fit) > p:first-child:not(:has(.math-fit)) {
+  margin-bottom: 0.3em;
+  font-weight: 500;
+}
+
+/* Unindented Markdown equations may follow a list as sibling blocks. */
+.markdown-content :is(ol, ul):has(+ .math-fit) {
+  list-style-position: outside;
+  padding-left: 1.5em;
+  margin-top: 0.85em;
+  margin-bottom: 0.3em;
+}
+
+.markdown-content :is(ol, ul):has(+ .math-fit) > li {
+  font-weight: 500;
+}
+
+.markdown-content :is(ol, ul) + .math-fit:not([hidden]) {
+  width: calc(100% - 1.5em);
+  margin-left: 1.5em;
+  margin-top: 0.3em;
+  margin-bottom: 0.35em;
+}
+
+.markdown-content .math-fit + :is(ol, ul):has(+ .math-fit) {
+  margin-top: 0.35em;
+}
+
+/* Typography paragraph margins otherwise add a full line after equations. */
+.markdown-content .math-fit:not([hidden]) + p,
+.markdown-content :is(ol, ul):has(> li:last-child > .math-fit:last-child) + p {
+  margin-top: 0.5em;
+}
```

**File**: `webui/src/components/DisplayMath.tsx` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
+
+import "./DisplayMath.css";
+
+export function DisplayMath({ children }: { children: ReactNode }) {
+  const frame = useRef<HTMLSpanElement>(null);
+  const content = useRef<HTMLSpanElement>(null);
+  const [layout, setLayout] = useState({ scale: 1, height: 0 });
+  useLayoutEffect(() => {
+    const update = () => {
+      if (!frame.current || !content.current) return;
+      const width = content.current.offsetWidth;
+      const scale = width ? Math.min(1, frame.current.clientWidth / width) : 1;
+      const height = content.current.offsetHeight * scale;
+      setLayout(previous => previous.scale === scale && previous.height === height ? previous : { scale, height });
+    };
+    update();
+    const observer = new ResizeObserver(update);
+    observer.observe(frame.current!);
+    observer.observe(content.current!);
+    let cancelled = false;
+    void document.fonts?.ready.then(() => { if (!cancelled) update(); });
+    return () => { cancelled = true; observer.disconnect(); };
+  }, [children]);
+  return <span ref={frame} className="math-fit" style={{ height: layout.height || undefined }}
+    data-math-scale={layout.scale}>
+    <span ref={content} className="math-fit-content" style={{ transform: `translateX(-50%) scale(${layout.scale})` }}>
+      <span className="katex-display">{children}</span>
+    </span>
+  </span>;
+}
```

**File**: `webui/src/components/MarkdownTextRenderer.tsx` (modified, +8/-0)
```diff
@@ -16,6 +16,7 @@ import remend from "remend";
 
 import { parseMathAwareMarkdownBlocks } from "@/lib/markdown-streaming-blocks";
 
+import { DisplayMath } from "@/components/DisplayMath";
 import { AttachmentTile } from "@/components/AttachmentTile";
 import { CodeBlock } from "@/components/CodeBlock";
 import { WebLink } from "@/components/WebLink";
@@ -689,6 +690,13 @@ export default function MarkdownTextRenderer({
           </WebLink>
         );
       },
+      span({ children: spanChildren, className: spanClassName, node: _node, ...props }) {
+        void _node;
+        if (spanClassName?.split(" ").includes("katex-display")) {
+          return <DisplayMath>{spanChildren}</DisplayMath>;
+        }
+        return <span className={spanClassName} {...props}>{spanChildren}</span>;
+      },
       // Streamdown decorates emphasis with spans by default. Preserve native
       // semantics for accessibility and predictable typography.
       strong({ children: markdownChildren, node: _node, ...props }) {
```

**File**: `webui/src/tests/display-math.test.tsx` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+import { act, render } from "@testing-library/react";
+import { afterEach, beforeEach, expect, it, vi } from "vitest";
+import { DisplayMath } from "@/components/DisplayMath";
+
+let availableWidth: number;
+let formulaWidth: number;
+let formulaHeight: number;
+let resize: () => void;
+
+beforeEach(() => {
+  availableWidth = 1000;
+  formulaWidth = 800;
+  formulaHeight = 80;
+  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
+    return this.classList.contains("math-fit") ? availableWidth : 0;
+  });
+  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
+    return this.classList.contains("math-fit-content") ? formulaWidth : 0;
+  });
+  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
+    return this.classList.contains("math-fit-content") ? formulaHeight : 0;
+  });
+  vi.stubGlobal("ResizeObserver", class {
+    constructor(callback: () => void) { resize = callback; }
+    observe() {}
+    disconnect() {}
+  });
+});
+
+afterEach(() => {
+  vi.restoreAllMocks();
+  vi.unstubAllGlobals();
+});
+
+it("fits a wide formula on resize and restores its size without enlarging it", () => {
+  const { container } = render(<DisplayMath><span>long equation</span></DisplayMath>);
+  const frame = container.querySelector<HTMLElement>(".math-fit")!;
+  const formula = container.querySelector<HTMLElement>(".math-fit-content")!;
+  expect(frame.style.height).toBe("80px");
+  expect(formula.style.transform).toContain("scale(1)");
+
+  act(() => { availableWidth = 400; resize(); });
+  expect(frame.style.height).toBe("40px");
+  expect(formula.style.transform).toContain("scale(0.5)");
+  expect(frame.textContent).toBe("long equation");
+
+  act(() => { availableWidth = 1200; resize(); });
+  expect(frame.style.height).toBe("80px");
+  expect(formula.style.transform).toContain("scale(1)");
+});
+
+it("recalculates width and occupied height when a streaming formula grows", () => {
+  availableWidth = 400;
+  formulaWidth = 200;
+  formulaHeight = 40;
+  const { container, rerender } = render(<DisplayMath><span>initial equation</span></DisplayMath>);
+  const frame = container.querySelector<HTMLElement>(".math-fit")!;
+  expect(frame.style.height).toBe("40px");
+
+  formulaWidth = 800;
+  formulaHeight = 120;
+  rerender(<DisplayMath><span>completed equation</span></DisplayMath>);
+  expect(frame.style.height).toBe("60px");
+  expect(container.querySelector<HTMLElement>(".math-fit-content")!.style.transform).toContain("scale(0.5)");
+  expect(frame.textContent).toBe("completed equation");
+});
```

---

### Incident Patch 2: `d9ceae15` (2026-10-05)
**Commit Message**: fix(mcp): let streamable HTTP read timeout cover tool_timeout

The streamable HTTP client used httpx.Timeout(30.0, connect=10.0), so the
read timeout was fixed at 30s regardless of tool_timeout. A server that
stays silent until the result is ready (e.g. FastMCP json_response=True)
hit ReadTimeout after 30s; the tool call then hung until tool_timeout
fired and reported "(MCP tool call timed out after Ns)".

Use the MCP SDK's own httpx defaults (30s, read=300s) and raise the read
timeout to tool_timeout when it is larger. Connect stays at 10s.

Fixes #6065

**File**: `nanobot/agent/tools/mcp.py` (modified, +11/-1)
```diff
@@ -52,6 +52,10 @@
 
 _WINDOWS_SHELL_LAUNCHERS: frozenset[str] = frozenset(("npx", "npm", "pnpm", "yarn", "bunx"))
 
+# Mirror the MCP SDK's httpx defaults (MCP_DEFAULT_TIMEOUT / MCP_DEFAULT_SSE_READ_TIMEOUT).
+_HTTP_TIMEOUT = 30.0
+_HTTP_READ_TIMEOUT = 300.0
+
 # Characters allowed in tool names by model providers (Anthropic, OpenAI, etc.).
 # Replace anything outside [a-zA-Z0-9_-] with underscore and collapse runs.
 _SANITIZE_RE = re.compile(r"_+")
@@ -1120,7 +1124,13 @@ def httpx_client_factory(
                     "headers": cfg.headers or None,
                     "event_hooks": {"request": [_validate_mcp_request_url]},
                     "follow_redirects": True,
-                    "timeout": httpx.Timeout(30.0, connect=10.0),
+                    # Read must outlast the tool call itself; otherwise a slow tool
+                    # fails with ReadTimeout before tool_timeout is reached.
+                    "timeout": httpx.Timeout(
+                        _HTTP_TIMEOUT,
+                        connect=10.0,
+                        read=max(_HTTP_READ_TIMEOUT, cfg.tool_timeout),
+                    ),
                     **_pinned_transport_kwargs(),
                 }
                 if oauth_auth is not None:
```

**File**: `tests/tools/test_mcp_tool.py` (modified, +15/-2)
```diff
@@ -1484,9 +1484,18 @@ async def _selective_stdio_client(params: object):
 
 
 @pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ("tool_timeout", "expected_read"),
+    [
+        (30, 300.0),  # default: match the MCP SDK's SSE read timeout
+        (600, 600.0),  # long-running tools: read must not cut the call short
+    ],
+)
 async def test_connect_mcp_servers_streamable_http_uses_finite_timeout(
     fake_mcp_runtime: dict[str, object | None],
     monkeypatch: pytest.MonkeyPatch,
+    tool_timeout: int,
+    expected_read: float,
 ) -> None:
     fake_mcp_runtime["session"] = _make_fake_session(["demo"])
     captured: dict[str, object] = {}
@@ -1517,15 +1526,19 @@ async def _capturing_streamable_http_client(_url: str, http_client=None):
 
     registry = ToolRegistry()
     stacks = await connect_mcp_servers(
-        {"test": MCPServerConfig(url="https://mcp.example.com/mcp")},
+        {
+            "test": MCPServerConfig(
+                url="https://mcp.example.com/mcp", tool_timeout=tool_timeout
+            )
+        },
         registry,
     )
     for stack in stacks.values():
         await stack.aclose()
 
     timeout = captured["timeout"]
     assert timeout.connect == 10.0
-    assert timeout.read == 30.0
+    assert timeout.read == expected_read
     assert timeout.write == 30.0
     assert timeout.pool == 30.0
 
```

---

### Incident Patch 3: `63bdd402` (2026-10-05)
**Commit Message**: feat(webui): unify icons and refine interaction feedback (#6074)

* feat(webui): unify product icons and refine interaction feedback

* test(webui): align layout and tooltip expectations with icon refresh

* test(webui): verify temporary chat uses shared icon controls

* fix(webui): toggle workspace access directly and restore send arrow

* fix(webui): keep the send control circular

* fix(webui): clear workspace toggle background on pointer leave

* test(webui): isolate GitHub navigation in star prompt tests

* test(webui): prevent external default navigation during star link clicks

**File**: `webui/src/components/ChatList.tsx` (modified, +12/-12)
```diff
@@ -1082,7 +1082,7 @@ export const ChatList = memo(function ChatList({
                             <DropdownMenuTrigger
                               className={cn(
                                 "sidebar-action-trigger touch-target inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground opacity-0 transition-opacity",
-                                "media-hover:hover:bg-sidebar-accent media-hover:hover:text-sidebar-foreground media-hover:group-hover:opacity-100",
+                                "media-hover:hover:text-sidebar-foreground media-hover:group-hover:opacity-100",
                                 "focus-visible:opacity-100 data-[state=open]:opacity-100",
                               )}
                               aria-label={t("chat.actions", { title })}
@@ -1190,7 +1190,7 @@ export const ChatList = memo(function ChatList({
               aria-label={t("chat.cancelSelection", {
                 defaultValue: "Cancel selection",
               })}
-              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sidebar-muted-foreground transition-colors media-hover:hover:bg-accent/60 media-hover:hover:text-foreground"
+              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sidebar-muted-foreground transition-colors media-hover:hover:text-foreground"
             >
               <X className="h-4 w-4" aria-hidden />
             </button>
@@ -1275,10 +1275,10 @@ function WorkbenchTabHeader({
               onClick={onToggle}
               className={cn(
                 "relative inline-flex h-6 w-3.5 shrink-0 items-center justify-center rounded-md before:absolute before:-inset-x-1 before:inset-y-0",
-                "text-sidebar-muted-foreground transition-[background-color,color,transform] duration-150 ease-out",
-                "media-hover:hover:bg-sidebar-accent media-hover:hover:text-sidebar-foreground active:scale-[0.96]",
+                "text-sidebar-muted-foreground transition-[color] duration-150 ease-out",
+                "media-hover:hover:text-sidebar-foreground",
                 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
-                "motion-reduce:transition-none motion-reduce:active:scale-100",
+                "motion-reduce:transition-none ",
               )}
             >
               <ChevronDown
@@ -1327,7 +1327,7 @@ function WorkbenchTabHeader({
               className={cn(
                 "sidebar-action-trigger touch-target inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                 "text-sidebar-muted-foreground opacity-0 transition-opacity",
-                "media-hover:hover:bg-sidebar-accent media-hover:hover:text-sidebar-foreground media-hover:group-hover/tab:opacity-100",
+                "media-hover:hover:text-sidebar-foreground media-hover:group-hover/tab:opacity-100",
                 "focus-visible:opacity-100 data-[state=open]:opacity-100",
               )}
               aria-label={t("chat.actions", { title })}
@@ -1519,7 +1519,7 @@ function ActivePaneRows({
                 <DropdownMenuTrigger
                   className={cn(
                     "sidebar-action-trigger touch-target inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground opacity-0 transition-opacity",
-                    "media-hover:hover:bg-sidebar-accent media-hover:hover:text-sidebar-foreground media-hover:group-hover/pane:opacity-100",
+                    "media-hover:hover:text-sidebar-foreground media-hover:group-hover/pane:opacity-100",
                     "focus-visible:opacity-100 data-[state=open]:opacity-100",
                   )}
                   aria-label={paneActionsLabel}
@@ -1706,7 +1706,7 @@ function TemporaryChatSection({
                     type="button"
                     aria-label={t("temporaryChat.closeAction", { title })}
                     onClick={() => onClose(session.key)}
-                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground transition-colors media-hover:hover:bg-destructive/10 media-hover:hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
+                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground transition-colors media-hover:hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                   >
                     <X className="h-3.5 w-3.5" aria-hidden />
                   </button>
@@ -1776,10 +1776,10 @@ function ProjectGroupHeader({
             onClick={onToggle}
             className={cn(
               "relative inline-flex h-6 w-3.5 shrink-0 items-center justify-center rounded-md before:absolute before:-inset-x-1 before:inset-y-0",
-             
```

**File**: `webui/src/components/CodeBlock.tsx` (modified, +1/-1)
```diff
@@ -317,7 +317,7 @@ export const CodeBlock = memo(function CodeBlock({
           onClick={onCopy}
           className={cn(
             "absolute right-2.5 top-2.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full",
-            "text-muted-foreground/75 transition-colors hover:bg-background/70 hover:text-foreground",
+            "text-muted-foreground/75 transition-colors hover:text-foreground",
             "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
           )}
           aria-label={copyLabel}
```

**File**: `webui/src/components/ImageLightbox.tsx` (modified, +2/-2)
```diff
@@ -143,7 +143,7 @@ export function ImageLightbox({
             aria-label={t("lightbox.close")}
             className={cn(
               "touch-target absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full",
-              "bg-black/55 text-white/90 hover:bg-black/70 hover:text-white",
+              "bg-black/55 text-white/90 hover:text-white",
               "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
               "transition-colors motion-reduce:transition-none",
             )}
@@ -178,7 +178,7 @@ function NavButton({ side, label, onClick }: NavButtonProps) {
       aria-label={label}
       className={cn(
         "absolute top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full",
-        "bg-black/55 text-white/90 hover:bg-black/70 hover:text-white",
+        "bg-black/55 text-white/90 hover:text-white",
         "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
         "transition-colors motion-reduce:transition-none",
         side === "left" ? "left-4" : "right-4",
```

**File**: `webui/src/components/MessageBubble.tsx` (modified, +5/-16)
```diff
@@ -7,17 +7,7 @@ import {
   useState,
   type ReactNode,
 } from "react";
-import {
-  Activity,
-  Check,
-  ChevronRight,
-  CircleAlert,
-  Clock3,
-  Copy,
-  Link2,
-  Quote,
-  Wrench,
-} from "lucide-react";
+import { Activity, Check, ChevronRight, CircleAlert, Clock3, Copy, Link2, Quote, Wrench } from "lucide-react";
 import { useTranslation } from "react-i18next";
 import { DisclosureContent } from "@/components/ui/disclosure";
 
@@ -139,7 +129,7 @@ export function MessageCopyButton({ message, className }: { message: UIMessage;
     onClick={onCopy} aria-label={label}
     className={cn(
       "inline-flex h-[var(--message-block-control-size)] w-[var(--message-block-action-width)] items-center justify-center rounded-control",
-      "text-muted-foreground transition-[color,background-color,scale] hover:bg-muted/70 hover:text-foreground active:scale-[0.96]",
+      "text-muted-foreground transition-[color] hover:text-foreground",
       "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none",
       className,
     )}>
@@ -219,8 +209,8 @@ export function MessageBlockMenuActions({
                         aria-label={t("message.forkFromHere")}
                         className={cn(
                           "inline-flex h-[var(--message-block-control-size)] w-[var(--message-block-action-width)] items-center justify-center rounded-control",
-                          "text-muted-foreground transition-[color,background-color,scale]",
-                          "hover:bg-muted/70 hover:text-foreground active:scale-[0.96]",
+                          "text-muted-foreground transition-colors",
+                          "hover:text-foreground",
                           "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                           "motion-reduce:transform-none",
                           sheet && "w-full justify-start gap-2 px-2 text-sm",
@@ -256,8 +246,7 @@ export function MessageBlockMenuActions({
                   data-message-block-activity-icon
                   className={cn(
                     "inline-flex h-[var(--message-block-control-size)] w-[var(--message-block-action-width)] shrink-0 items-center justify-center rounded-control",
-                    "transition-[background-color,box-shadow,scale]",
-                    "group-hover:bg-muted/70 group-active:scale-[0.96]",
+                    "transition-colors",
                     "group-focus-visible:ring-2 group-focus-visible:ring-ring",
                     "motion-reduce:transform-none",
                     sheet && "w-3.5",
```

**File**: `webui/src/components/PreviewPane.tsx` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ export function PreviewPane({ tabs, activeId, width, isClosing, onSelect, onClos
       ? remaining[Math.min(index, remaining.length - 1)]?.id ?? null : activeId;
     onCloseTab(tab.id);
   };
-  const iconButton = "touch-target inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
+  const iconButton = "touch-target inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
   return <aside aria-label={t("previewTabs.title")} data-testid="preview-pane" data-file-preview-panel
     style={{
       "--file-preview-width": `${width}px`,
@@ -100,7 +100,7 @@ export function PreviewPane({ tabs, activeId, width, isClosing, onSelect, onClos
               </button>
               <button type="button" tabIndex={selected ? 0 : -1} aria-label={t("previewTabs.closeTab", { name })} title={t("previewTabs.closeTab", { name })}
                 onClick={() => closeTab(tab, index)}
-                className={cn("touch-target preview-tab-close mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-compact text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !selected && "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100")}>
+                className={cn("touch-target preview-tab-close mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-compact text-muted-foreground transition-colors hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !selected && "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100")}>
                 <X className="size-3" aria-hidden />
               </button>
             </div>;
```

**File**: `webui/src/components/Sidebar.tsx` (modified, +26/-26)
```diff
@@ -1,20 +1,21 @@
+import {
+  ArchiveIcon,
+  SkillsIcon,
+  AutomationsIcon,
+  ChannelsIcon,
+  SearchIcon,
+  SettingsIcon,
+  NewChatIcon,
+  ComposeIcon,
+  AppsIcon,
+} from "@/components/icons/product-icons";
 import {
   type ReactNode,
   type RefObject,
   useRef,
   useState,
 } from "react";
-import {
-  Archive,
-  Brain,
-  CalendarClock,
-  MessageCircle,
-  PanelLeftClose,
-  Search,
-  Settings,
-  SquarePen,
-  Blocks,
-} from "lucide-react";
+import { PanelLeftClose } from "lucide-react";
 import { useTranslation } from "react-i18next";
 
 import {
@@ -125,11 +126,11 @@ export function Sidebar(props: SidebarProps) {
       collapsed={collapsed}
       label={t("sidebar.newChat")}
       iconOnly
-      className={collapsed ? undefined : "rounded-full border border-border/70 bg-background/80 shadow-sm"}
+      className={collapsed ? undefined : "rounded-full border border-border/70 bg-background/80 shadow-sm settings-hover"}
       onClick={props.onNewChat}
       active={props.newChatActive}
       selectionRef={collapsed ? activeActionRef : undefined}
-      icon={<SquarePen className="h-4 w-4" />}
+      icon={collapsed ? <NewChatIcon className="h-4 w-4" /> : <ComposeIcon className="h-4 w-4" />}
       shortcut={sidebarShortcutLabel("newChat", apple)}
       ariaKeyShortcuts={sidebarShortcutAria("newChat")}
     />
@@ -142,7 +143,7 @@ export function Sidebar(props: SidebarProps) {
       ariaKeyShortcuts={sidebarShortcutAria("search")}
       iconOnly
       onClick={props.onOpenSearch}
-      icon={<Search className="h-4 w-4" />}
+      icon={<SearchIcon className="h-4 w-4" />}
     />
   );
 
@@ -175,9 +176,7 @@ export function Sidebar(props: SidebarProps) {
           className={cn(
             "host-no-drag flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
             props.hostChromeInset && "mt-5",
-            collapsed
-              ? "hover:bg-sidebar-accent/60"
-              : "pointer-events-none",
+            !collapsed && "pointer-events-none",
           )}
         >
           <img
@@ -218,7 +217,7 @@ export function Sidebar(props: SidebarProps) {
           onIntent={props.onSettingsIntent}
           active={props.activeUtility === "apps"}
           selectionRef={activeActionRef}
-          icon={<Blocks className="h-4 w-4" />}
+          icon={<AppsIcon className="h-4 w-4" />}
         />
         <SidebarActionButton
           collapsed={collapsed}
@@ -229,7 +228,7 @@ export function Sidebar(props: SidebarProps) {
           onIntent={props.onSettingsIntent}
           active={props.activeUtility === "skills"}
           selectionRef={activeActionRef}
-          icon={<Brain className="h-4 w-4" />}
+          icon={<SkillsIcon className="h-4 w-4" />}
         />
         <SidebarActionButton
           collapsed={collapsed}
@@ -240,7 +239,7 @@ export function Sidebar(props: SidebarProps) {
           onIntent={props.onSettingsIntent}
           active={props.activeUtility === "automations"}
           selectionRef={activeActionRef}
-          icon={<CalendarClock className="h-4 w-4" />}
+          icon={<AutomationsIcon className="h-4 w-4" />}
         />
         <SidebarActionButton
           collapsed={collapsed}
@@ -251,14 +250,14 @@ export function Sidebar(props: SidebarProps) {
           onIntent={props.onSettingsIntent}
           active={props.activeUtility === "channels"}
           selectionRef={activeActionRef}
-          icon={<MessageCircle className="h-4 w-4" />}
+          icon={<ChannelsIcon className="h-4 w-4" />}
         />
         {props.archivedCount ? (
           <SidebarActionButton
             collapsed={collapsed}
             label={props.showArchived ? t("chat.hideArchived") : t("chat.showArchived")}
             onClick={props.onToggleArchived}
-            icon={<Archive className="h-4 w-4" />}
+            icon={<ArchiveIcon className="h-4 w-4" />}
           />
         ) : null}
       </SidebarSelectionHighlight>
@@ -329,8 +328,7 @@ export function Sidebar(props: SidebarProps) {
           ariaKeyShortcuts={sidebarShortcutAria("settings")}
           onClick={props.onOpenSettings}
           onIntent={props.onSettingsIntent}
-          className="w-9"
-          icon={<Settings className="h-4 w-4" />}
+          icon={<SettingsIcon className="h-4 w-4" />}
         />
         <HostSwitcher collapsed={collapsed} portalContainer={props.containActionMenus ? menuPortalContainer : undefined} />
       </div>
@@ -370,7 +368,7 @@ function SidebarActionButton({
     <Button
       ref={active ? selectionRef : undefined}
       type="button"
-      variant={null}
+      variant={compact ? "icon" : null}
       aria-label={label}
       aria-current={active ? "page" : undefined}
       aria-keyshortcuts={ariaKeyShortcuts}
@@ -386,7 +384,9 @@ function SidebarActionButton({
           : "w-full justify-start gap-2 px-2 text-[13px] leading-5 [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75]",
     
```

**File**: `webui/src/components/SidebarSelectionHighlight.tsx` (modified, +2/-2)
```diff
@@ -15,11 +15,11 @@ interface SidebarSelectionHighlightProps extends HTMLAttributes<HTMLDivElement>
 }
 
 export const SIDEBAR_SELECTION_ITEM_CLASS =
-  "relative z-[1] transition-[color] duration-150 ease-out motion-reduce:transition-none";
+  "relative z-[1] transition-[color,background-color] duration-150 ease-out motion-reduce:transition-none";
 
 // During a drag, animate only the shared highlight, not its measured target as well.
 export const SIDEBAR_SELECTION_ACTION_ITEM_CLASS =
-  "relative z-[1] transition-[width,padding,color] [transition-duration:300ms,300ms,150ms] ease-out group-data-[resizing=true]/sidebar:transition-none motion-reduce:transition-none";
+  "relative z-[1] transition-[width,padding,color,background-color] [transition-duration:300ms,300ms,150ms,150ms] ease-out group-data-[resizing=true]/sidebar:transition-none motion-reduce:transition-none";
 
 export function SidebarSelectionHighlight({
   targetRef,
```

**File**: `webui/src/components/WebPreviewPanel.tsx` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ export function WebPreviewPanel({ url: value }: WebPreviewPanelProps) {
   const [revision, setRevision] = useState(0);
   const url = parseWebLink(value);
   const restriction = currentWebPreviewRestriction(url);
-  const buttonClass = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
+  const buttonClass = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
   return (
     <section aria-label={t("webPreview.title")} data-testid="web-preview-panel" className="flex min-h-0 flex-1 flex-col">
       <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/40 px-2">
```

---

### Incident Patch 4: `9dc0abae` (2026-10-04)
**Commit Message**: fix(documents): read cells beyond declared XLSX dimensions

**File**: `nanobot/utils/document.py` (modified, +2/-0)
```diff
@@ -253,6 +253,8 @@ def iter_lines() -> Iterator[LocatedDocumentLine]:
         try:
             for sheet_name in workbook.sheetnames:
                 worksheet = workbook[sheet_name]
+                # Producer-supplied dimensions can omit cells that are present in the XML.
+                worksheet.reset_dimensions()
                 wrote_header = False
                 for row_index, row in enumerate(worksheet.iter_rows(values_only=True), 1):
                     row_text = "\t".join(
```

**File**: `tests/tools/test_search_tools.py` (modified, +19/-1)
```diff
@@ -9,6 +9,7 @@
 from pathlib import Path
 from types import SimpleNamespace
 from unittest.mock import AsyncMock, MagicMock
+from zipfile import ZipFile
 
 import pytest
 
@@ -26,6 +27,7 @@
     default_workspace_scope,
     reset_workspace_scope,
 )
+from nanobot.utils.document import extract_text
 from nanobot.utils.llm_runtime import LLMRuntime
 
 
@@ -335,9 +337,13 @@ async def test_grep_defaults_to_match_context(tmp_path: Path) -> None:
 
 
 @pytest.mark.asyncio
-async def test_grep_searches_xlsx_with_sheet_cell_locator(tmp_path: Path) -> None:
+@pytest.mark.parametrize("declared_dimension", ["A1:B2", "A1:A1", "A1:A2", "A1:B1"])
+async def test_grep_searches_xlsx_with_sheet_cell_locator(
+    tmp_path: Path, declared_dimension: str, monkeypatch: pytest.MonkeyPatch,
+) -> None:
     from openpyxl import Workbook
 
+    monkeypatch.setattr("nanobot.config.loader._current_config_path", tmp_path / "config.json")
     workbook_path = tmp_path / "people.xlsx"
     workbook = Workbook()
     sheet = workbook.active
@@ -347,6 +353,18 @@ async def test_grep_searches_xlsx_with_sheet_cell_locator(tmp_path: Path) -> Non
     workbook.save(workbook_path)
     workbook.close()
 
+    # Some XLSX producers report a smaller used range than their actual cells.
+    with ZipFile(workbook_path) as archive:
+        entries = {item.filename: archive.read(item) for item in archive.infolist()}
+    entries["xl/worksheets/sheet1.xml"] = entries["xl/worksheets/sheet1.xml"].replace(
+        b'<dimension ref="A1:B2"', f'<dimension ref="{declared_dimension}"'.encode(),
+    )
+    with ZipFile(workbook_path, "w") as archive:
+        for name, data in entries.items():
+            archive.writestr(name, data)
+
+    assert extract_text(workbook_path) == "--- Sheet: People ---\nName\tRole\nAda\tEngineer"
+
     tool = GrepTool(workspace=tmp_path, allowed_dir=tmp_path)
     result = await tool.execute(
         pattern="Engineer",
```

---

### Incident Patch 5: `24033152` (2026-10-05)
**Commit Message**: fix(webui): restore CJK line height and refine text wrapping

**File**: `webui/src/components/ui/alert-dialog.tsx` (modified, +2/-2)
```diff
@@ -78,7 +78,7 @@ const AlertDialogTitle = React.forwardRef<
 >(({ className, ...props }, ref) => (
   <AlertDialogPrimitive.Title
     ref={ref}
-    className={cn("text-lg font-semibold", className)}
+    className={cn("text-balance text-lg font-semibold", className)}
     {...props}
   />
 ));
@@ -90,7 +90,7 @@ const AlertDialogDescription = React.forwardRef<
 >(({ className, ...props }, ref) => (
   <AlertDialogPrimitive.Description
     ref={ref}
-    className={cn("text-sm text-muted-foreground", className)}
+    className={cn("text-pretty text-sm text-muted-foreground", className)}
     {...props}
   />
 ));
```

**File**: `webui/src/components/ui/dialog.tsx` (modified, +2/-2)
```diff
@@ -176,7 +176,7 @@ const DialogTitle = React.forwardRef<
   <DialogPrimitive.Title
     ref={ref}
     className={cn(
-      "text-lg font-semibold leading-none tracking-tight",
+      "text-balance text-lg font-semibold leading-none tracking-tight",
       className,
     )}
     {...props}
@@ -190,7 +190,7 @@ const DialogDescription = React.forwardRef<
 >(({ className, ...props }, ref) => (
   <DialogPrimitive.Description
     ref={ref}
-    className={cn("text-sm text-muted-foreground", className)}
+    className={cn("text-pretty text-sm text-muted-foreground", className)}
     {...props}
   />
 ));
```

**File**: `webui/src/globals.css` (modified, +23/-8)
```diff
@@ -120,6 +120,19 @@
   body {
     @apply bg-background text-foreground font-sans antialiased;
     overflow: hidden;
+    text-autospace: normal;
+  }
+
+  /* Keep source text and editable values visually literal. */
+  pre,
+  code,
+  kbd,
+  samp,
+  .font-mono,
+  input,
+  textarea,
+  [contenteditable="true"] {
+    text-autospace: no-autospace;
   }
 
   #root.visual-viewport {
@@ -364,19 +377,21 @@
     @apply list-none pl-0;
   }
 
-  /* CJK-friendly line-height: prose paragraphs default to 1.625 which is
-     tight for Chinese/Japanese/Korean characters. Bump to 1.8 for better
-     readability when the browser detects a CJK primary font. */
+  /* Set the default before locale overrides: html also matches :lang(). */
+  :root {
+    --cjk-line-height: 1.625;
+  }
+
   :lang(zh),
-  :lang(zh-CN),
-  :lang(zh-TW),
-  :lang(zh-HK),
   :lang(ja),
   :lang(ko) {
     --cjk-line-height: 1.8;
   }
-  :root {
-    --cjk-line-height: 1.625;
+
+  /* Balance short headings; preserve explicit line breaks in chat prose. */
+  .markdown-content :is(h1, h2, h3, h4, h5, h6),
+  .settings-section-title {
+    text-wrap: balance;
   }
 
   /* L→R sheen clipped to live activity labels. The highlight lives inside
```

---

### Incident Patch 6: `f75470e7` (2026-10-04)
**Commit Message**: fix(webui): dismiss mobile sidebar on current topic selection

**File**: `webui/src/components/ChatList.tsx` (modified, +1/-1)
```diff
@@ -1007,7 +1007,7 @@ export const ChatList = memo(function ChatList({
                                   toggleDeleteSelection(tabDeleteKeys, event.shiftKey, s.key);
                                   return;
                                 }
-                                if (!topicActive) onSelect(s.key);
+                                onSelect(s.key);
                               }}
                               draggable={canDragSession}
                               onDragStart={(event) => {
```

**File**: `webui/src/tests/app-layout.test.tsx` (modified, +2/-2)
```diff
@@ -2394,7 +2394,7 @@ describe("App layout", () => {
     expect(screen.queryByText("Daily repo check")).not.toBeInTheDocument();
   }, 15_000);
 
-  it("opens a mobile topic with one click and closes the drawer without a search tooltip", async () => {
+  it("closes the mobile drawer when selecting a new or current topic without a search tooltip", async () => {
     restoreBrowserFocus = mockBrowserFocus();
     const user = userEvent.setup();
     mockSessions = ["First", "Second"].map((title, index) => ({
@@ -2418,7 +2418,7 @@ describe("App layout", () => {
 
     render(<App />);
     await waitFor(() => expect(connectSpy).toHaveBeenCalled());
-    for (const title of ["First", "Second"]) {
+    for (const title of ["First", "First", "Second"]) {
       await user.click(await screen.findByRole("button", { name: "Toggle sidebar" }));
       const sheet = await screen.findByRole("dialog");
       await waitFor(() => expect(sheet).toHaveFocus());
```

---

### Incident Patch 7: `85af35e2` (2026-10-04)
**Commit Message**: docs(memory): correct Git layout and history search example

**File**: `docs/memory.md` (modified, +16/-4)
```diff
@@ -73,6 +73,7 @@ working directory; it does not relocate the files below.
 
 ```text
 workspace/
+├── .git/                # Version history for long-term memory files
 ├── SOUL.md              # The bot's long-term voice and communication style
 ├── USER.md              # Stable knowledge about the user
 ├── prompts/
@@ -82,8 +83,7 @@ workspace/
     ├── MEMORY.md        # Project facts, decisions, and durable context
     ├── history.jsonl    # Append-only history summaries
     ├── .cursor          # Consolidator write cursor
-    ├── .dream_cursor    # Dream consumption cursor
-    └── .git/            # Version history for long-term memory files
+    └── .dream_cursor    # Dream consumption cursor
 ```
 
 A selected project may provide its own `AGENTS.md`, but project-local `SOUL.md`,
@@ -119,8 +119,20 @@ grep -i "keyword" memory/history.jsonl
 # jq
 cat memory/history.jsonl | jq -r 'select(.content | test("keyword"; "i")) | .content' | tail -20
 
-# Python
-python -c "import json; [print(json.loads(l).get('content','')) for l in open('memory/history.jsonl','r',encoding='utf-8') if l.strip() and 'keyword' in l.lower()][-20:]"
+# Python: last 20 matching entries
+python - <<'PY'
+import json
+from collections import deque
+
+matches = deque(maxlen=20)
+with open('memory/history.jsonl', encoding='utf-8') as history:
+    for line in history:
+        if line.strip():
+            content = json.loads(line).get('content', '')
+            if 'keyword' in content.lower():
+                matches.append(content)
+print('\n'.join(matches))
+PY
 ```
 
 The difference is philosophical as much as technical:
```

---

### Incident Patch 8: `93df7230` (2026-10-04)
**Commit Message**: fix(providers): retain GPT-6 temperature restrictions

**File**: `nanobot/providers/openai_compat_provider.py` (modified, +11/-6)
```diff
@@ -895,15 +895,21 @@ def _request_model_name(self, model_name: str) -> str:
         return model_name
 
     @staticmethod
-    def _supports_temperature(model_name: str) -> bool:
+    def _supports_temperature(
+        model_name: str,
+        reasoning_effort: str | None = None,
+    ) -> bool:
         """Return True when the model accepts a temperature parameter.
 
-        Kimi K3 uses a fixed temperature that should be omitted. GPT-5 family
-        and reasoning models (o1/o3/o4) reject temperature.
+        Temperature is omitted for fixed-temperature Kimi K3, GPT-5, and
+        o-series models. GPT-6 requires explicit ``"none"`` effort; its
+        default enables reasoning.
         """
         if _model_slug(model_name) == _KIMI_K3_MODEL:
             return False
         name = model_name.lower()
+        if "gpt-6" in name:
+            return bool(reasoning_effort and reasoning_effort.lower() == "none")
         return not any(token in name for token in ("gpt-5", "o1", "o3", "o4"))
 
     def _opencode_affinity_headers(
@@ -949,8 +955,7 @@ def _build_kwargs(
             ),
         }
 
-        # GPT-5 and reasoning models (o1/o3/o4) reject temperature.
-        if self._supports_temperature(model_name):
+        if self._supports_temperature(model_name, reasoning_effort):
             kwargs["temperature"] = temperature
 
         if (
@@ -1313,7 +1318,7 @@ def _build_responses_body(
                 "compact_threshold": compact_threshold,
             }]
 
-        supports_temperature = self._supports_temperature(model_name)
+        supports_temperature = self._supports_temperature(model_name, reasoning_effort)
         if supports_temperature:
             body["temperature"] = temperature
 
```

**File**: `tests/providers/test_litellm_kwargs.py` (modified, +59/-5)
```diff
@@ -1014,21 +1014,30 @@ def test_openai_compat_supports_temperature_matches_reasoning_model_rules() -> N
     assert OpenAICompatProvider._supports_temperature("o3-mini") is False
 
 
-@pytest.mark.parametrize("responses", [False, True])
-def test_deepseek_keeps_temperature_when_reasoning_effort_is_set(responses: bool) -> None:
-    spec = find_by_name("deepseek")
+@pytest.mark.parametrize(
+    ("provider_name", "model", "responses"),
+    [
+        ("deepseek", "deepseek-v4-flash", False),
+        ("deepseek", "deepseek-v4-flash", True),
+        ("mistral", "mistral-medium-3-5", False),
+    ],
+)
+def test_compatible_provider_keeps_temperature_when_reasoning_effort_is_set(
+    provider_name: str, model: str, responses: bool,
+) -> None:
+    spec = find_by_name(provider_name)
     with patch("nanobot.providers.openai_compat_provider.AsyncOpenAI"):
         provider = OpenAICompatProvider(
             api_key="sk-test-key",
-            default_model="deepseek-v4-flash",
+            default_model=model,
             spec=spec,
         )
 
     build_request = provider._build_responses_body if responses else provider._build_kwargs
     request = build_request(
         messages=[{"role": "user", "content": "hello"}],
         tools=None,
-        model="deepseek-v4-flash",
+        model=model,
         max_tokens=4096,
         temperature=0.2,
         reasoning_effort="high",
@@ -1042,6 +1051,51 @@ def test_deepseek_keeps_temperature_when_reasoning_effort_is_set(responses: bool
         assert request["reasoning_effort"] == "high"
 
 
+@pytest.mark.parametrize("api_type", ["chat_completions", "responses"])
+@pytest.mark.parametrize(
+    ("model", "effort", "supports_temperature"),
+    [
+        ("gpt-6.1-sol", "high", False),
+        ("gpt-6-sol", "high", False),
+        ("gpt-6-sol", None, False),
+        ("gpt-6-sol", "none", True),
+    ],
+)
+@pytest.mark.asyncio
+async def test_gpt6_temperature_requires_explicit_none_effort(
+    api_type: str, model: str, effort: str | None, supports_temperature: bool,
+) -> None:
+    mock_chat = AsyncMock(return_value=_fake_chat_response())
+    mock_responses = AsyncMock(return_value=_fake_responses_response())
+    with patch("nanobot.providers.openai_compat_provider.AsyncOpenAI") as mock_client:
+        mock_client.return_value.chat.completions.create = mock_chat
+        mock_client.return_value.responses.create = mock_responses
+        provider = OpenAICompatProvider(
+            api_key="sk-test-key",
+            default_model=model,
+            spec=find_by_name("openai"),
+            api_type=api_type,
+        )
+        result = await provider.chat(
+            messages=[{"role": "user", "content": "hello"}],
+            temperature=0.2,
+            reasoning_effort=effort,
+        )
+
+    assert result.content == "ok"
+    request_mock = mock_responses if api_type == "responses" else mock_chat
+    other_mock = mock_chat if api_type == "responses" else mock_responses
+    request_mock.assert_awaited_once()
+    other_mock.assert_not_awaited()
+    request = request_mock.call_args.kwargs
+    if supports_temperature:
+        assert request["temperature"] == 0.2
+    else:
+        assert "temperature" not in request
+        if api_type == "responses":
+            assert request["include"] == ["reasoning.encrypted_content"]
+
+
 def test_openai_compat_build_kwargs_uses_gpt5_safe_parameters() -> None:
     spec = find_by_name("openai")
     with patch("nanobot.providers.openai_compat_provider.AsyncOpenAI"):
```

---

### Incident Patch 9: `557a62c3` (2026-10-02)
**Commit Message**: fix(providers): preserve temperature for compatible reasoning models

**File**: `nanobot/providers/openai_compat_provider.py` (modified, +8/-13)
```diff
@@ -895,20 +895,14 @@ def _request_model_name(self, model_name: str) -> str:
         return model_name
 
     @staticmethod
-    def _supports_temperature(
-        model_name: str,
-        reasoning_effort: str | None = None,
-    ) -> bool:
+    def _supports_temperature(model_name: str) -> bool:
         """Return True when the model accepts a temperature parameter.
 
         Kimi K3 uses a fixed temperature that should be omitted. GPT-5 family
-        and reasoning models (o1/o3/o4) reject temperature when
-        reasoning_effort is set to anything other than ``"none"``.
+        and reasoning models (o1/o3/o4) reject temperature.
         """
         if _model_slug(model_name) == _KIMI_K3_MODEL:
             return False
-        if reasoning_effort and reasoning_effort.lower() != "none":
-            return False
         name = model_name.lower()
         return not any(token in name for token in ("gpt-5", "o1", "o3", "o4"))
 
@@ -955,9 +949,8 @@ def _build_kwargs(
             ),
         }
 
-        # GPT-5 and reasoning models (o1/o3/o4) reject temperature when
-        # reasoning_effort is active.  Only include it when safe.
-        if self._supports_temperature(model_name, reasoning_effort):
+        # GPT-5 and reasoning models (o1/o3/o4) reject temperature.
+        if self._supports_temperature(model_name):
             kwargs["temperature"] = temperature
 
         if (
@@ -1320,10 +1313,12 @@ def _build_responses_body(
                 "compact_threshold": compact_threshold,
             }]
 
-        if self._supports_temperature(model_name, reasoning_effort):
+        supports_temperature = self._supports_temperature(model_name)
+        if supports_temperature:
             body["temperature"] = temperature
 
-        if not self._supports_temperature(model_name, reasoning_effort) and not preserve_reasoning:
+        reasoning_enabled = bool(reasoning_effort and reasoning_effort.lower() != "none")
+        if (not supports_temperature or reasoning_enabled) and not preserve_reasoning:
             body["include"] = ["reasoning.encrypted_content"]
         if reasoning_effort and (reasoning_effort.lower() != "none" or is_deepseek):
             body["reasoning"] = {"effort": reasoning_effort}
```

**File**: `tests/providers/test_litellm_kwargs.py` (modified, +28/-1)
```diff
@@ -1012,7 +1012,34 @@ def test_openai_compat_supports_temperature_matches_reasoning_model_rules() -> N
     assert OpenAICompatProvider._supports_temperature("gpt-4o") is True
     assert OpenAICompatProvider._supports_temperature("gpt-5-chat") is False
     assert OpenAICompatProvider._supports_temperature("o3-mini") is False
-    assert OpenAICompatProvider._supports_temperature("gpt-4o", reasoning_effort="medium") is False
+
+
+@pytest.mark.parametrize("responses", [False, True])
+def test_deepseek_keeps_temperature_when_reasoning_effort_is_set(responses: bool) -> None:
+    spec = find_by_name("deepseek")
+    with patch("nanobot.providers.openai_compat_provider.AsyncOpenAI"):
+        provider = OpenAICompatProvider(
+            api_key="sk-test-key",
+            default_model="deepseek-v4-flash",
+            spec=spec,
+        )
+
+    build_request = provider._build_responses_body if responses else provider._build_kwargs
+    request = build_request(
+        messages=[{"role": "user", "content": "hello"}],
+        tools=None,
+        model="deepseek-v4-flash",
+        max_tokens=4096,
+        temperature=0.2,
+        reasoning_effort="high",
+        tool_choice=None,
+    )
+
+    assert request["temperature"] == 0.2
+    if responses:
+        assert request["reasoning"] == {"effort": "high"}
+    else:
+        assert request["reasoning_effort"] == "high"
 
 
 def test_openai_compat_build_kwargs_uses_gpt5_safe_parameters() -> None:
```

---

### Incident Patch 10: `1ea981e4` (2026-10-04)
**Commit Message**: fix(webui): restore sidebar focus after submenu Escape

**File**: `docs/webui.md` (modified, +3/-1)
```diff
@@ -115,7 +115,9 @@ On touch devices, sidebar action buttons stay visible with larger touch areas
 for topics, conversation groups, panes, and projects. Tap a title to select it
 or the adjacent action button for its menu. Desktop actions still appear on
 hover or keyboard focus. Press Escape in an action menu to return focus to its
-button and continue with Tab. Choosing Rename instead moves focus into the
+button and continue with Tab, including from the **Move to** submenu. ArrowLeft
+leaves the submenu and returns to **Move to** without closing the parent menu.
+Choosing Rename instead moves focus into the
 dialog; clicking outside a menu keeps focus at the clicked destination.
 
 Drag a topic within its current sidebar group to keep frequently used work in
```

**File**: `webui/src/components/ChatList.tsx` (modified, +24/-15)
```diff
@@ -1,6 +1,8 @@
 import {
+  createContext,
   memo,
   useCallback,
+  useContext,
   useEffect,
   useLayoutEffect,
   useMemo,
@@ -87,6 +89,8 @@ interface SidebarActionMenuController {
   openFromContextMenu: (event: ReactMouseEvent<HTMLElement>, id: string) => void;
 }
 
+const SidebarActionMenuEscapeContext = createContext<(() => void) | undefined>(undefined);
+
 function SidebarActionMenuContent({
   children,
   portalContainer,
@@ -95,21 +99,24 @@ function SidebarActionMenuContent({
   portalContainer?: HTMLElement | null;
 }) {
   const restoreFocusOnEscape = useRef(false);
+  const markEscape = () => { restoreFocusOnEscape.current = true; };
   return (
-    <DropdownMenuContent
-      align="end"
-      className={ACTION_MENU_CONTENT_CLASS}
-      portalContainer={portalContainer}
-      onEscapeKeyDown={() => { restoreFocusOnEscape.current = true; }}
-      onCloseAutoFocus={(event) => {
-        // Actions can open a dialog or remove the trigger. Only Escape returns
-        // to it; Radix still owns the trigger and outside-interaction handling.
-        if (!restoreFocusOnEscape.current) event.preventDefault();
-        restoreFocusOnEscape.current = false;
-      }}
-    >
-      {children}
-    </DropdownMenuContent>
+    <SidebarActionMenuEscapeContext.Provider value={markEscape}>
+      <DropdownMenuContent
+        align="end"
+        className={ACTION_MENU_CONTENT_CLASS}
+        portalContainer={portalContainer}
+        onEscapeKeyDown={markEscape}
+        onCloseAutoFocus={(event) => {
+          // Actions can open a dialog or remove the trigger. Only Escape returns
+          // to it; Radix still owns the trigger and outside-interaction handling.
+          if (!restoreFocusOnEscape.current) event.preventDefault();
+          restoreFocusOnEscape.current = false;
+        }}
+      >
+        {children}
+      </DropdownMenuContent>
+    </SidebarActionMenuEscapeContext.Provider>
   );
 }
 
@@ -1617,14 +1624,16 @@ function MoveToGroupSubmenu({
   onMove: (targetKey: string) => void;
 }) {
   const { t } = useTranslation();
+  // Radix sends Escape only to the topmost submenu before closing the root.
+  const onEscapeKeyDown = useContext(SidebarActionMenuEscapeContext);
   if (targets.length === 0) return null;
   return (
     <DropdownMenuSub>
       <DropdownMenuSubTrigger>
         <MoveRight className="h-4 w-4 shrink-0" aria-hidden />
         {t("workbench.moveTo")}
       </DropdownMenuSubTrigger>
-      <DropdownMenuSubContent>
+      <DropdownMenuSubContent onEscapeKeyDown={onEscapeKeyDown}>
         {targets.map((target) => (
           <DropdownMenuItem
             key={target.key}
```

**File**: `webui/src/tests/chat-list-focus.test.tsx` (modified, +40/-1)
```diff
@@ -1,5 +1,5 @@
 import { useState } from "react";
-import { render, screen, waitFor } from "@testing-library/react";
+import { act, render, screen, waitFor } from "@testing-library/react";
 import userEvent from "@testing-library/user-event";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 
@@ -26,6 +26,10 @@ function SidebarFocusCase() {
       }]}
       activeKey={topic.key}
       paneGroups={{
+        [topic.key]: {
+          tabKey: "tab:review", title: "Review", activePaneKey: topic.key, visible: false,
+          panes: [{ key: topic.key, chatId: topic.chatId, title: "Review" }],
+        },
         "websocket:group": {
           tabKey: "websocket:group", title: "Group", activePaneKey: "websocket:group",
           panes: [
@@ -38,6 +42,7 @@ function SidebarFocusCase() {
       onRequestDelete={vi.fn()}
       onTogglePin={vi.fn()}
       onToggleArchive={vi.fn()}
+      onAttachPane={vi.fn()}
       onRequestRename={(_key, title) => setRename(title)}
       onRequestRenameTab={(_key, title) => setRename(title)}
       onRequestRenameProject={(_key, title) => setRename(title)}
@@ -105,6 +110,40 @@ describe("sidebar action focus", () => {
     expect(outside).toHaveFocus();
   });
 
+  it("returns Escape from Move to to the root action button", async () => {
+    const user = userEvent.setup();
+    render(<SidebarFocusCase />);
+    const trigger = screen.getByRole("button", { name: "Topic actions for Review" });
+    trigger.focus();
+    await user.keyboard("{Enter}");
+    const move = await screen.findByRole("menuitem", { name: "Move to", exact: true });
+    act(() => move.focus());
+    await user.keyboard("{ArrowRight}");
+    await screen.findByRole("menuitem", { name: "Group · 2/4" });
+    await user.keyboard("{Escape}");
+    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
+    await waitFor(() => expect(trigger).toHaveFocus());
+  });
+
+  it("keeps ArrowLeft within the parent menu, then hands Rename its input focus", async () => {
+    const user = userEvent.setup();
+    render(<SidebarFocusCase />);
+    const trigger = screen.getByRole("button", { name: "Topic actions for Review" });
+    trigger.focus();
+    await user.keyboard("{Enter}");
+    const move = await screen.findByRole("menuitem", { name: "Move to", exact: true });
+    act(() => move.focus());
+    await user.keyboard("{ArrowRight}");
+    await screen.findByRole("menuitem", { name: "Group · 2/4" });
+    await user.keyboard("{ArrowLeft}");
+    await waitFor(() => expect(move).toHaveFocus());
+    expect(screen.queryByRole("menuitem", { name: "Group · 2/4" })).not.toBeInTheDocument();
+    await user.click(screen.getByRole("menuitem", { name: "Rename", exact: true }));
+    const input = await screen.findByPlaceholderText("Topic name");
+    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
+    expect(input).toHaveFocus();
+  });
+
   it("allows Select to remove the trigger without restoring focus to it", async () => {
     const user = userEvent.setup();
     render(<SidebarFocusCase />);
```

---

### Incident Patch 11: `3e3d8e3d` (2026-10-04)
**Commit Message**: fix(webui): restore sidebar menu focus on Escape

**File**: `docs/webui.md` (modified, +3/-1)
```diff
@@ -114,7 +114,9 @@ without changing the original thread.
 On touch devices, sidebar action buttons stay visible with larger touch areas
 for topics, conversation groups, panes, and projects. Tap a title to select it
 or the adjacent action button for its menu. Desktop actions still appear on
-hover or keyboard focus.
+hover or keyboard focus. Press Escape in an action menu to return focus to its
+button and continue with Tab. Choosing Rename instead moves focus into the
+dialog; clicking outside a menu keeps focus at the clicked destination.
 
 Drag a topic within its current sidebar group to keep frequently used work in
 your preferred order. Drag a topic from the sidebar into the composer when you
```

**File**: `webui/src/components/ChatList.tsx` (modified, +35/-21)
```diff
@@ -7,7 +7,7 @@ import {
   useRef,
   useState,
 } from "react";
-import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactElement } from "react";
+import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from "react";
 import {
   Archive,
   ArchiveRestore,
@@ -87,6 +87,32 @@ interface SidebarActionMenuController {
   openFromContextMenu: (event: ReactMouseEvent<HTMLElement>, id: string) => void;
 }
 
+function SidebarActionMenuContent({
+  children,
+  portalContainer,
+}: {
+  children: ReactNode;
+  portalContainer?: HTMLElement | null;
+}) {
+  const restoreFocusOnEscape = useRef(false);
+  return (
+    <DropdownMenuContent
+      align="end"
+      className={ACTION_MENU_CONTENT_CLASS}
+      portalContainer={portalContainer}
+      onEscapeKeyDown={() => { restoreFocusOnEscape.current = true; }}
+      onCloseAutoFocus={(event) => {
+        // Actions can open a dialog or remove the trigger. Only Escape returns
+        // to it; Radix still owns the trigger and outside-interaction handling.
+        if (!restoreFocusOnEscape.current) event.preventDefault();
+        restoreFocusOnEscape.current = false;
+      }}
+    >
+      {children}
+    </DropdownMenuContent>
+  );
+}
+
 function SidebarItemTooltip({
   label,
   children,
@@ -1056,11 +1082,8 @@ export const ChatList = memo(function ChatList({
                             >
                               <MoreHorizontal className="h-3.5 w-3.5" />
                             </DropdownMenuTrigger>
-                            <DropdownMenuContent
-                              align="end"
-                              className={ACTION_MENU_CONTENT_CLASS}
+                            <SidebarActionMenuContent
                               portalContainer={actionMenuPortalContainer}
-                              onCloseAutoFocus={(event) => event.preventDefault()}
                             >
                               <DropdownMenuItem onSelect={() => onTogglePin(s.key)}>
                                 {isPinned ? (
@@ -1113,7 +1136,7 @@ export const ChatList = memo(function ChatList({
                                 <Trash2 className="h-4 w-4 shrink-0" />
                                 {t("chat.delete")}
                               </DropdownMenuItem>
-                            </DropdownMenuContent>
+                            </SidebarActionMenuContent>
                           </DropdownMenu>
                           ) : null}
                         </div>
@@ -1304,11 +1327,8 @@ function WorkbenchTabHeader({
             >
               <MoreHorizontal className="h-3.5 w-3.5" />
             </DropdownMenuTrigger>
-            <DropdownMenuContent
-              align="end"
-              className={ACTION_MENU_CONTENT_CLASS}
+            <SidebarActionMenuContent
               portalContainer={actionMenuPortalContainer}
-              onCloseAutoFocus={(event) => event.preventDefault()}
             >
               {onRequestRename ? (
                 <DropdownMenuItem onSelect={onRequestRename}>
@@ -1330,7 +1350,7 @@ function WorkbenchTabHeader({
                 <Trash2 className="h-4 w-4 shrink-0" />
                 {t("workbench.deleteConversations")}
               </DropdownMenuItem>
-            </DropdownMenuContent>
+            </SidebarActionMenuContent>
           </DropdownMenu>
 
         </>
@@ -1499,11 +1519,8 @@ function ActivePaneRows({
                 >
                   <MoreHorizontal className="h-3.5 w-3.5" />
                 </DropdownMenuTrigger>
-                <DropdownMenuContent
-                  align="end"
-                  className={ACTION_MENU_CONTENT_CLASS}
+                <SidebarActionMenuContent
                   portalContainer={actionMenuPortalContainer}
-                  onCloseAutoFocus={(event) => event.preventDefault()}
                 >
                   <DropdownMenuItem onSelect={() => onTogglePin(pane.key)}>
                     {isPinned ? (
@@ -1554,7 +1571,7 @@ function ActivePaneRows({
                     <Trash2 className="h-4 w-4 shrink-0" />
                     {t("chat.delete")}
                   </DropdownMenuItem>
-                </DropdownMenuContent>
+                </SidebarActionMenuContent>
               </DropdownMenu> : null}
             </div>
           </li>
@@ -1796,11 +1813,8 @@ function ProjectGroupHeader({
             >
               <MoreHorizontal className="h-3.5 w-3.5" />
             </DropdownMenuTrigger>
-            <DropdownMenuContent
-              align="end"
-              className={ACTION_MENU_CONTENT_CLASS}
+            <SidebarActionMenuContent
               portalContainer={actionMenuPortalContainer}
-              onCloseAutoFocus={(event) => event.preventDefault()}
             >
               {onNewChat ? (
                 <DropdownMenuItem onSelect={onNewChat}>
@@ -1814,7 +1828,7 @@ function ProjectGroupHeader({
                   {t("chat.rename")}
    
```

**File**: `webui/src/tests/chat-list-focus.test.tsx` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+import { useState } from "react";
+import { render, screen, waitFor } from "@testing-library/react";
+import userEvent from "@testing-library/user-event";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+
+import { ChatList } from "@/components/ChatList";
+import { RenameChatDialog } from "@/components/RenameChatDialog";
+import type { ChatSummary } from "@/lib/types";
+import { mockBrowserFocus } from "./browser-focus";
+
+const topic: ChatSummary = {
+  key: "websocket:review", chatId: "review", channel: "websocket",
+  title: "Review", preview: "", createdAt: "2026-10-04T10:00:00Z",
+  updatedAt: "2026-10-04T10:00:00Z",
+};
+
+function SidebarFocusCase() {
+  const [rename, setRename] = useState<string | null>(null);
+  return <>
+    <ChatList
+      sessions={[topic, {
+        ...topic, key: "websocket:group", chatId: "group", title: "Group",
+      }, {
+        ...topic, key: "websocket:project", chatId: "project", title: "Project task",
+        workspaceScope: { project_path: "/workspace/photos", project_name: "Photos", access_mode: "restricted" },
+      }]}
+      activeKey={topic.key}
+      paneGroups={{
+        "websocket:group": {
+          tabKey: "websocket:group", title: "Group", activePaneKey: "websocket:group",
+          panes: [
+            { key: "websocket:group", chatId: "group", title: "Group" },
+            { key: "websocket:research", chatId: "research", title: "Research" },
+          ],
+        },
+      }}
+      onSelect={vi.fn()}
+      onRequestDelete={vi.fn()}
+      onTogglePin={vi.fn()}
+      onToggleArchive={vi.fn()}
+      onRequestRename={(_key, title) => setRename(title)}
+      onRequestRenameTab={(_key, title) => setRename(title)}
+      onRequestRenameProject={(_key, title) => setRename(title)}
+    />
+    <button>Outside destination</button>
+    <RenameChatDialog open={rename !== null} title={rename ?? ""}
+      onCancel={() => setRename(null)} onConfirm={() => setRename(null)} />
+  </>;
+}
+
+describe("sidebar action focus", () => {
+  let restoreBrowserFocus: () => void;
+  beforeEach(() => { restoreBrowserFocus = mockBrowserFocus(); });
+  afterEach(() => {
+    restoreBrowserFocus();
+    localStorage.removeItem("nanobot-webui.collapsed-pane-groups.v1");
+  });
+
+  it.each([
+    "Topic actions for Review",
+    "Topic actions for Group",
+    "Research pane actions",
+    "Topic actions for Photos",
+  ])("returns Escape focus to %s and allows continued tabbing", async (name) => {
+    const user = userEvent.setup();
+    render(<SidebarFocusCase />);
+    const trigger = screen.getByRole("button", { name, exact: true });
+    trigger.focus();
+    await user.keyboard("{Enter}");
+    await screen.findByRole("menu");
+    await user.keyboard("{Escape}");
+    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
+    await waitFor(() => expect(trigger).toHaveFocus());
+    await user.tab();
+    expect(trigger).not.toHaveFocus();
+    expect(document.body).not.toHaveFocus();
+  });
+
+  it("does not reuse Escape focus restoration when the next action opens Rename", async () => {
+    const user = userEvent.setup();
+    render(<SidebarFocusCase />);
+    const trigger = screen.getByRole("button", { name: "Topic actions for Review" });
+    trigger.focus();
+    await user.keyboard("{Enter}{Escape}");
+    await waitFor(() => expect(trigger).toHaveFocus());
+    await user.keyboard("{Enter}");
+    await user.click(await screen.findByRole("menuitem", { name: "Rename", exact: true }));
+    const input = await screen.findByPlaceholderText("Topic name");
+    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
+    await waitFor(() => expect(input).toHaveFocus());
+    await user.keyboard("Updated");
+    expect(input).toHaveValue("ReviewUpdated");
+  });
+
+  it("keeps an outside click focused on its destination", async () => {
+    const user = userEvent.setup();
+    render(<SidebarFocusCase />);
+    const trigger = screen.getByRole("button", { name: "Topic actions for Review" });
+    trigger.focus();
+    await user.keyboard("{Enter}");
+    await screen.findByRole("menu");
+    const outside = screen.getByRole("button", { name: "Outside destination" });
+    await user.click(outside);
+    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
+    expect(outside).toHaveFocus();
+  });
+
+  it("allows Select to remove the trigger without restoring focus to it", async () => {
+    const user = userEvent.setup();
+    render(<SidebarFocusCase />);
+    const trigger = screen.getByRole("button", { name: "Topic actions for Review" });
+    trigger.focus();
+    await user.keyboard("{Enter}");
+    await user.click(await screen.findByRole("menuitem", { name: "Select", exact: true }));
+    await waitFor(() => expect(trigger).not.toBeInTheDocument());
+    expect(trigger).not.toHaveFocus();
+    await user.keyboard("{Escap
```

---

### Incident Patch 12: `6b24ed80` (2026-10-04)
**Commit Message**: fix(webui): make sidebar actions discoverable on touch devices

**File**: `docs/webui.md` (modified, +5/-0)
```diff
@@ -111,6 +111,11 @@ workspace selection, and linked automations. Use a new topic when you want a
 separate context; use fork when you want to continue from an existing point
 without changing the original thread.
 
+On touch devices, sidebar action buttons stay visible with larger touch areas
+for topics, conversation groups, panes, and projects. Tap a title to select it
+or the adjacent action button for its menu. Desktop actions still appear on
+hover or keyboard focus.
+
 Drag a topic within its current sidebar group to keep frequently used work in
 your preferred order. Drag a topic from the sidebar into the composer when you
 want to reference it in the next message instead of switching to it.
```

**File**: `webui/src/components/ChatList.tsx` (modified, +4/-4)
```diff
@@ -1048,7 +1048,7 @@ export const ChatList = memo(function ChatList({
                             >
                             <DropdownMenuTrigger
                               className={cn(
-                                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground opacity-0 transition-opacity",
+                                "sidebar-action-trigger touch-target inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground opacity-0 transition-opacity",
                                 "media-hover:hover:bg-sidebar-accent media-hover:hover:text-sidebar-foreground media-hover:group-hover:opacity-100",
                                 "focus-visible:opacity-100 data-[state=open]:opacity-100",
                               )}
@@ -1295,7 +1295,7 @@ function WorkbenchTabHeader({
           >
             <DropdownMenuTrigger
               className={cn(
-                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
+                "sidebar-action-trigger touch-target inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                 "text-sidebar-muted-foreground opacity-0 transition-opacity",
                 "media-hover:hover:bg-sidebar-accent media-hover:hover:text-sidebar-foreground media-hover:group-hover/tab:opacity-100",
                 "focus-visible:opacity-100 data-[state=open]:opacity-100",
@@ -1491,7 +1491,7 @@ function ActivePaneRows({
               >
                 <DropdownMenuTrigger
                   className={cn(
-                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground opacity-0 transition-opacity",
+                    "sidebar-action-trigger touch-target inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground opacity-0 transition-opacity",
                     "media-hover:hover:bg-sidebar-accent media-hover:hover:text-sidebar-foreground media-hover:group-hover/pane:opacity-100",
                     "focus-visible:opacity-100 data-[state=open]:opacity-100",
                   )}
@@ -1787,7 +1787,7 @@ function ProjectGroupHeader({
           >
             <DropdownMenuTrigger
               className={cn(
-                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground opacity-0 transition-opacity",
+                "sidebar-action-trigger touch-target inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground opacity-0 transition-opacity",
                 "media-hover:hover:bg-sidebar-accent media-hover:hover:text-sidebar-foreground media-hover:group-hover:opacity-100 focus-visible:opacity-100",
                 "data-[state=open]:opacity-100",
               )}
```

**File**: `webui/src/globals.css` (modified, +5/-0)
```diff
@@ -909,6 +909,11 @@
   .touch-target.preview-tab-close {
     opacity: 1;
   }
+
+  /* Touch users cannot hover a sidebar row to discover its actions. */
+  .sidebar-action-trigger {
+    opacity: 1;
+  }
 }
 
 /* On phones, actions follow the message instead of taking a separate gutter. */
```

**File**: `webui/src/tests/chat-list.test.tsx` (modified, +30/-1)
```diff
@@ -99,6 +99,28 @@ describe("ChatList", () => {
     expect(conversation.querySelector("[data-sidebar-selection-track]")).toBeNull();
   });
 
+  it("opens topic actions with a dedicated touch target without selecting the topic", async () => {
+    const onSelect = vi.fn();
+    const onRequestRename = vi.fn();
+    render(<ChatList
+      sessions={[session({ chatId: "review", title: "Review the patch" })]}
+      activeKey={null}
+      onSelect={onSelect}
+      onRequestDelete={vi.fn()}
+      onTogglePin={vi.fn()}
+      onRequestRename={onRequestRename}
+      onToggleArchive={vi.fn()}
+    />);
+    const trigger = screen.getByRole("button", { name: "Topic actions for Review the patch" });
+    expect(trigger).toHaveClass("sidebar-action-trigger", "touch-target", "opacity-0");
+    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
+    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
+    expect(onRequestRename).toHaveBeenCalledWith("websocket:review", "Review the patch");
+    expect(onSelect).not.toHaveBeenCalled();
+    fireEvent.click(screen.getByRole("button", { name: "Review the patch" }));
+    expect(onSelect).toHaveBeenCalledWith("websocket:review");
+  });
+
   it("marks a conversation that needs recovery attention with a warning indicator", () => {
     render(
       <ChatList
@@ -689,7 +711,10 @@ describe("ChatList", () => {
       .toHaveAttribute("data-active-id", "websocket:root");
     expect(screen.getByRole("button", {
       name: "Research pane pane actions",
-    })).toHaveClass("opacity-0");
+    })).toHaveClass("sidebar-action-trigger", "touch-target", "opacity-0");
+    expect(screen.getByRole("button", {
+      name: "Topic actions for Root topic",
+    })).toHaveClass("sidebar-action-trigger", "touch-target", "opacity-0");
     expect(within(tabGroup).getByRole("button", { name: "Root topic" }))
       .not.toHaveAttribute("aria-current");
     expect(tabGroup).not.toHaveTextContent("2/4");
@@ -754,6 +779,8 @@ describe("ChatList", () => {
     fireEvent.click(await screen.findByRole("menuitem", { name: "Select" }));
 
     expect(screen.getByText("1 selected")).toBeInTheDocument();
+    expect(screen.queryByRole("button", { name: "Root topic pane actions" })).not.toBeInTheDocument();
+    expect(screen.queryByRole("button", { name: "Topic actions for Root topic" })).not.toBeInTheDocument();
     fireEvent.click(screen.getByRole("button", { name: "Group: Root topic" }));
     expect(screen.getByRole("button", { name: "Group: Root topic" }))
       .toHaveAttribute("aria-pressed", "true");
@@ -1189,6 +1216,8 @@ describe("ChatList", () => {
     );
 
     const projectSection = screen.getByRole("region", { name: "Photos" });
+    expect(within(projectSection).getByRole("button", { name: "Topic actions for Photos" }))
+      .toHaveClass("sidebar-action-trigger", "touch-target", "opacity-0");
     fireEvent.click(within(projectSection).getByRole("button", { name: "Photos" }));
 
     expect(onToggleGroup).toHaveBeenCalledWith("project:/Users/me/nanobot");
```

**File**: `webui/src/tests/sidebar-hover-css.test.ts` (modified, +31/-0)
```diff
@@ -7,6 +7,37 @@ import loadConfig from "tailwindcss/loadConfig";
 import { describe, expect, it } from "vitest";
 
 describe("sidebar touch hover isolation", () => {
+  it("shows sidebar actions with roomy targets only for coarse pointers", async () => {
+    const config = loadConfig(resolve(process.cwd(), "tailwind.config.js"));
+    const source = readFileSync(resolve(process.cwd(), "src/globals.css"), "utf8");
+    const result = await postcss([tailwindcss({ ...config, content: [{
+      raw: 'class="sidebar-action-trigger touch-target opacity-0 h-6 w-6"',
+    }] })]).process(source, { from: undefined });
+    let hiddenIndex = -1;
+    let visibleIndex = -1;
+    let index = 0;
+    let touchTarget = false;
+    result.root.walkRules((rule) => {
+      index++;
+      if (rule.selector === ".opacity-0") hiddenIndex = index;
+      if (rule.selector === ".sidebar-action-trigger") {
+        visibleIndex = index;
+        expect(rule.parent).toMatchObject({ type: "atrule", name: "media", params: "(pointer: coarse)" });
+        expect(rule.nodes).toContainEqual(expect.objectContaining({ prop: "opacity", value: "1" }));
+      }
+      if (rule.selector === ".touch-target") {
+        touchTarget = true;
+        expect(rule.parent).toMatchObject({ type: "atrule", name: "media", params: "(pointer: coarse)" });
+        for (const prop of ["min-width", "min-height"]) {
+          expect(rule.nodes).toContainEqual(expect.objectContaining({ prop, value: "2.75rem" }));
+        }
+      }
+    });
+    expect(hiddenIndex).toBeGreaterThan(0);
+    expect(visibleIndex).toBeGreaterThan(hiddenIndex);
+    expect(touchTarget).toBe(true);
+  });
+
   it("gates ordinary and named-group hover CSS without gating keyboard focus", async () => {
     const config = loadConfig(resolve(process.cwd(), "tailwind.config.js"));
     const source = readFileSync(
```

---

### Incident Patch 13: `948ce382` (2026-10-04)
**Commit Message**: fix(webui): keep touch form fields readable without focus zoom

**File**: `docs/webui.md` (modified, +4/-0)
```diff
@@ -207,6 +207,10 @@ magnified area; normal fitting resumes when
 you return to the default zoom. Non-touch desktop and native-host layout remain
 unchanged.
 
+On touch devices, compact text fields use a readable 16px minimum baseline to
+avoid Safari automatically zooming the page on focus. Desktop field density
+and manual page zoom remain unchanged.
+
 On touch devices, preview tab controls and
 the full-screen image viewer's close button use larger touch areas without
 enlarging the icons. Preview tabs remain horizontally scrollable when space is
```

**File**: `webui/src/components/remote/HostSwitcher.tsx` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ function HostMenuItems({ picker }: { picker: HostPicker }) {
       <Search aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
       <input ref={search} aria-label={t("remote.searchHosts")} placeholder={t("remote.searchHosts")}
         value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" spellCheck={false}
-        className="h-7 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
+        className="touch-text-input h-7 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
     </div> : <DropdownMenuLabel className="shrink-0">{t("remote.switchHost")}</DropdownMenuLabel>}
     <div ref={list} role="group" aria-label={t("remote.switchHost")}
       className="min-h-0 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-track-transparent">
```

**File**: `webui/src/components/thread/PromptNavigator.tsx` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ export function PromptNavigator({
                 aria-label={t("thread.promptNavigator.search")}
                 placeholder={t("thread.promptNavigator.search")}
                 className={cn(
-                  "h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm",
+                  "touch-text-input h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm",
                   "transition-colors",
                   formControlFocusClassName,
                 )}
```

**File**: `webui/src/components/ui/input.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ const Input = React.forwardRef<HTMLInputElement, InputProps>(
       <input
         type={type}
         className={cn(
-          "flex h-10 w-full rounded-full border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
+          "touch-text-input flex h-10 w-full rounded-full border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
           formControlFocusClassName,
           className,
         )}
```

**File**: `webui/src/components/ui/textarea.tsx` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
     return (
       <textarea
         className={cn(
-          "flex min-h-[60px] w-full rounded-control border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
+          "touch-text-input flex min-h-[60px] w-full rounded-control border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
           formControlFocusClassName,
           className,
         )}
```

**File**: `webui/src/globals.css` (modified, +8/-0)
```diff
@@ -885,6 +885,14 @@
 }
 
 @media (pointer: coarse) {
+  /* Readable form text avoids Safari's focus zoom without disabling the user's
+     pinch zoom. Keep this after utilities so compact desktop overrides cannot
+     shrink shared form fields on touch devices. Larger chat/search text stays
+     on its own typography; this is not a blanket rule for every input. */
+  .touch-text-input {
+    font-size: max(16px, 1rem);
+  }
+
   .thread-message-row,
   .message-block-menu-trigger,
   [data-message-block-menu] {
```

**File**: `webui/src/tests/touch-input.test.tsx` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { readFileSync } from "node:fs";
+import { resolve } from "node:path";
+import { render, screen } from "@testing-library/react";
+import postcss from "postcss";
+import tailwindcss from "tailwindcss";
+import loadConfig from "tailwindcss/loadConfig";
+import { describe, expect, it } from "vitest";
+
+import { Input } from "@/components/ui/input";
+import { Textarea } from "@/components/ui/textarea";
+
+describe("touch form typography", () => {
+  it("keeps the touch baseline on compact shared fields without changing desktop classes", () => {
+    render(<>
+      <Input aria-label="Name" />
+      <Input aria-label="Address" className="text-[13px]" />
+      <Textarea aria-label="Pairing code" className="font-mono text-xs" />
+    </>);
+    for (const field of screen.getAllByRole("textbox")) {
+      expect(field).toHaveClass("touch-text-input");
+    }
+    expect(screen.getByLabelText("Name")).toHaveClass("text-sm");
+    expect(screen.getByLabelText("Address")).toHaveClass("text-[13px]");
+    expect(screen.getByLabelText("Pairing code")).toHaveClass("text-xs", "font-mono");
+  });
+
+  it("emits the baseline after compact utilities, only for opted-in touch fields", async () => {
+    const config = loadConfig(resolve(process.cwd(), "tailwind.config.js"));
+    const source = readFileSync(resolve(process.cwd(), "src/globals.css"), "utf8");
+    const result = await postcss([tailwindcss({ ...config, content: [{
+      raw: 'class="touch-text-input text-xs text-sm text-[13px] text-[19px]"',
+    }] })]).process(source, { from: undefined });
+    let baseline = -1;
+    let index = 0;
+    const compact: number[] = [];
+    result.root.walkRules((rule) => {
+      index++;
+      if ([".text-xs", ".text-sm", ".text-\\[13px\\]"].includes(rule.selector)) compact.push(index);
+      if (rule.selector !== ".touch-text-input") return;
+      baseline = index;
+      expect(rule.parent).toMatchObject({ type: "atrule", name: "media", params: "(pointer: coarse)" });
+      expect(rule.nodes).toContainEqual(expect.objectContaining({ prop: "font-size", value: "max(16px, 1rem)" }));
+    });
+    expect(compact).toHaveLength(3);
+    expect(baseline).toBeGreaterThan(Math.max(...compact));
+  });
+});
```

---

### Incident Patch 14: `3ff76cd8` (2026-10-04)
**Commit Message**: fix(webui): retain content ownership of dialog exit lifetime

**File**: `webui/src/components/ui/dialog.tsx` (modified, +7/-3)
```diff
@@ -36,13 +36,17 @@ DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
 // positioning wrapper; otherwise the wrapper unmounts before the exit finishes.
 // Auto margins center/bottom-align surfaces when they fit, but collapse to zero
 // when they overflow so the beginning of a tall dialog remains scrollable.
+// The overlay stays mounted for the content's presence lifetime, so its own
+// fade cannot remove the content before its exit cleanup/handoff completes.
 const DialogPositionedContent = React.forwardRef<
   React.ElementRef<typeof DialogPrimitive.Content>,
   React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
     positionerStyle?: React.CSSProperties;
     placement?: "center" | "bottom";
+    overlayClassName?: string;
   }
->(({ positionerStyle, placement, ...props }, ref) => (
+>(({ positionerStyle, placement, overlayClassName, ...props }, ref) => (
+  <DialogOverlay forceMount className={overlayClassName}>
   <div className={cn("fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain", placement !== "bottom" && "p-4")} style={{
     top: "var(--app-viewport-top, 0px)",
     height: "var(--app-viewport-height, 100%)",
@@ -51,6 +55,7 @@ const DialogPositionedContent = React.forwardRef<
   }}>
     <DialogPrimitive.Content ref={ref} {...props} />
   </div>
+  </DialogOverlay>
 ));
 DialogPositionedContent.displayName = "DialogPositionedContent";
 
@@ -99,10 +104,10 @@ const DialogContent = React.forwardRef<
   }, [ref]);
   return (
     <DialogPortal>
-      <DialogOverlay className={overlayClassName}>
         <DialogPositionedContent
           positionerStyle={layout}
           placement={placement}
+          overlayClassName={overlayClassName}
           ref={contentRef}
           onOpenAutoFocus={(event) => {
             if (onOpenAutoFocus) onOpenAutoFocus(event);
@@ -131,7 +136,6 @@ const DialogContent = React.forwardRef<
             </DialogPrimitive.Close>
           ) : null}
         </DialogPositionedContent>
-      </DialogOverlay>
     </DialogPortal>
   );
 });
```

**File**: `webui/src/tests/remote-instances.test.tsx` (modified, +3/-1)
```diff
@@ -1022,7 +1022,9 @@ describe("remote instance UX", () => {
     fireEvent.submit(address.closest("form")!);
     const alert = await screen.findByRole("alert");
     expect(alert).toHaveTextContent(i18n.t("remote.errors.ssh_agent_refused"));
-    expect(alert.closest(".overflow-y-auto")).toBeNull();
+    // Errors stay outside the form's field scroller. The outer dialog frame
+    // may itself scroll when a mobile keyboard leaves less room than the form.
+    expect(address.closest("form")!.querySelector(".overflow-y-auto")).not.toContainElement(alert);
     expect(address).toHaveValue("ubuntu@example.test");
     fireEvent.click(screen.getByRole("button", { name: "Connection options" }));
     expect(screen.getByRole("spinbutton", { name: "SSH port" })).toHaveValue(2222);
```

---

### Incident Patch 15: `ce89f7ca` (2026-10-04)
**Commit Message**: fix(webui): preserve search results and dialog scrolling with landscape keyboards

**File**: `docs/webui.md` (modified, +3/-1)
```diff
@@ -192,7 +192,9 @@ On touch devices with Visual Viewport support, the app follows the visible area
 when the on-screen keyboard opens or pans the page. Navigation and the composer
 stay in view while messages scroll independently. Session search also follows
 the visible area: the search field stays above the keyboard and results scroll
-inside the dialog. The `@` mention and `/` command
+inside the dialog. In short landscape viewports, its input and results sit side
+by side so a result remains reachable. Taller dialogs scroll from their top
+instead of centering content outside the visible area. The `@` mention and `/` command
 menus use the visible app area above or below the composer, including when the
 keyboard pans the page. Scroll within a menu to reach more results. Mention rows
 use the app's larger touch targets on phones while retaining desktop density.
```

**File**: `webui/src/components/SessionSearchDialog.tsx` (modified, +3/-3)
```diff
@@ -140,14 +140,14 @@ export function SessionSearchDialog({
       <DialogContent
         showCloseButton={false}
         className={cn(
-          "flex max-h-[min(40rem,100%)] w-[calc(100vw-2rem)] max-w-[42rem] flex-col gap-0 overflow-hidden p-0",
+          "session-search-dialog flex max-h-[min(40rem,100%)] w-[calc(100vw-2rem)] max-w-[42rem] flex-col gap-0 overflow-hidden p-0",
         )}
       >
         <DialogTitle className="sr-only">{t("sidebar.searchAria")}</DialogTitle>
         <DialogDescription className="sr-only">
           {t("sidebar.searchPlaceholder")}
         </DialogDescription>
-        <div className="flex h-[62px] shrink-0 items-center gap-3 border-b border-border px-[18px]">
+        <div className="session-search-input flex h-[62px] shrink-0 items-center gap-3 border-b border-border px-[18px]">
           <Search
             className="h-[18px] w-[18px] shrink-0 text-muted-foreground"
             aria-hidden
@@ -170,7 +170,7 @@ export function SessionSearchDialog({
           className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5 scrollbar-thin scrollbar-track-transparent"
         >
           <section>
-            <div className="px-2.5 pb-1.5 pt-1 text-[12px] font-medium text-muted-foreground">
+            <div className="session-search-label px-2.5 pb-1.5 pt-1 text-[12px] font-medium text-muted-foreground">
               {sectionLabel}
             </div>
 
```

**File**: `webui/src/components/ui/dialog.tsx` (modified, +8/-5)
```diff
@@ -24,7 +24,7 @@ const DialogOverlay = React.forwardRef<
     ref={ref}
     className={cn(
       modalOverlayClassName,
-      "motion-reduce:animate-none",
+      "duration-200 motion-reduce:animate-none",
       className,
     )}
     {...props}
@@ -34,14 +34,16 @@ DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
 
 // The portal's presence ref must reach the animated content, not the plain
 // positioning wrapper; otherwise the wrapper unmounts before the exit finishes.
+// Auto margins center/bottom-align surfaces when they fit, but collapse to zero
+// when they overflow so the beginning of a tall dialog remains scrollable.
 const DialogPositionedContent = React.forwardRef<
   React.ElementRef<typeof DialogPrimitive.Content>,
   React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
     positionerStyle?: React.CSSProperties;
     placement?: "center" | "bottom";
   }
 >(({ positionerStyle, placement, ...props }, ref) => (
-  <div className={cn("fixed inset-0 z-50 flex justify-center", placement === "bottom" ? "items-end" : "items-center p-4")} style={{
+  <div className={cn("fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain", placement !== "bottom" && "p-4")} style={{
     top: "var(--app-viewport-top, 0px)",
     height: "var(--app-viewport-height, 100%)",
     bottom: "auto",
@@ -97,7 +99,7 @@ const DialogContent = React.forwardRef<
   }, [ref]);
   return (
     <DialogPortal>
-      <DialogOverlay className={overlayClassName} />
+      <DialogOverlay className={overlayClassName}>
         <DialogPositionedContent
           positionerStyle={layout}
           placement={placement}
@@ -113,8 +115,8 @@ const DialogContent = React.forwardRef<
             modalSurfaceClassName,
             "relative grid w-full max-w-lg gap-4 p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none",
             placement === "bottom"
-              ? "max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-modal pb-[max(1rem,env(safe-area-inset-bottom))] data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4"
-              : "origin-center rounded-modal data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
+              ? "mt-auto max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-modal pb-[max(1rem,env(safe-area-inset-bottom))] data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4"
+              : "my-auto origin-center rounded-modal data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
             className,
           )}
           {...props}
@@ -129,6 +131,7 @@ const DialogContent = React.forwardRef<
             </DialogPrimitive.Close>
           ) : null}
         </DialogPositionedContent>
+      </DialogOverlay>
     </DialogPortal>
   );
 });
```

**File**: `webui/src/globals.css` (modified, +19/-0)
```diff
@@ -141,6 +141,25 @@
     overflow-y: auto;
   }
 
+  /* Body portals share the viewport owner's short-frame state. A landscape
+     keyboard needs input and results beside each other, not stacked. */
+  @media (min-width: 640px) {
+    body:has(> #root.short-visual-viewport) .session-search-dialog {
+      flex-direction: row;
+    }
+
+    body:has(> #root.short-visual-viewport) .session-search-input {
+      width: 40%;
+      height: auto;
+      border-bottom-width: 0;
+      border-right-width: 1px;
+    }
+
+    body:has(> #root.short-visual-viewport) .session-search-label {
+      @apply sr-only;
+    }
+  }
+
   * {
     scrollbar-color: var(--scrollbar-thumb) transparent;
     scrollbar-width: thin;
```

**File**: `webui/src/tests/session-search-dialog.test.tsx` (modified, +54/-1)
```diff
@@ -1,7 +1,9 @@
-import { fireEvent, render, screen } from "@testing-library/react";
+import { useState } from "react";
+import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
 import { afterEach, describe, expect, it, vi } from "vitest";
 
 import { SessionSearchDialog } from "@/components/SessionSearchDialog";
+import { useAppViewport } from "@/hooks/useAppViewport";
 import type { ChatSummary } from "@/lib/types";
 
 function session(index: number): ChatSummary {
@@ -29,9 +31,60 @@ describe("SessionSearchDialog", () => {
     expect(screen.getAllByRole("button").length).toBeLessThanOrEqual(24);
   });
   afterEach(() => {
+    cleanup();
+    vi.unstubAllGlobals();
     vi.restoreAllMocks();
   });
 
+  it("shares keyboard rotation and dismissal with the body portal without losing a draft", () => {
+    vi.stubGlobal("matchMedia", vi.fn(() => ({
+      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
+    })));
+    const viewport = Object.assign(new EventTarget(), { height: 428, offsetTop: 0, scale: 1 });
+    vi.stubGlobal("visualViewport", viewport);
+    const onSelect = vi.fn();
+    function SearchApp() {
+      useAppViewport();
+      const [open, setOpen] = useState(true);
+      return <>
+        <textarea aria-label="Draft" defaultValue="Unsent draft" />
+        <SessionSearchDialog open={open} sessions={[session(1), session(2)]}
+          activeKey={null} loading={false} onOpenChange={setOpen} onSelect={onSelect} />
+      </>;
+    }
+    const root = document.createElement("div");
+    root.id = "root";
+    document.body.append(root);
+    const app = render(<SearchApp />, { container: root });
+    try {
+      const dialog = screen.getByRole("dialog");
+      expect(root.contains(dialog)).toBe(false);
+      act(() => {
+        Object.assign(viewport, { height: 128, offsetTop: -68 });
+        viewport.dispatchEvent(new Event("resize"));
+      });
+      expect(root).toHaveClass("short-visual-viewport");
+      expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("128px");
+      expect(dialog).toHaveClass("session-search-dialog");
+      expect(document.documentElement.style.getPropertyValue("--app-viewport-top")).toBe("0px");
+      act(() => {
+        Object.assign(viewport, { height: 428, offsetTop: 0 });
+        viewport.dispatchEvent(new Event("resize"));
+      });
+      expect(root).not.toHaveClass("short-visual-viewport");
+      fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "Chat 2" } });
+      expect(screen.getAllByRole("button")).toHaveLength(1);
+      fireEvent.click(screen.getByRole("button", { name: /Chat 2/ }));
+      expect(onSelect).toHaveBeenCalledOnce();
+      expect(onSelect).toHaveBeenCalledWith("websocket:chat-2");
+      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
+      expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Unsent draft");
+    } finally {
+      app.unmount();
+      root.remove();
+    }
+  });
+
   it("uses a solid compact command palette surface", () => {
     render(
       <SessionSearchDialog
```

**File**: `webui/src/tests/ui-shape-system.test.tsx` (modified, +12/-0)
```diff
@@ -24,6 +24,18 @@ import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 
 describe("UI shape system", () => {
+  it.each(["center", "bottom"] as const)("keeps an oversized %s dialog scrollable from its start", (placement) => {
+    render(<Dialog open><DialogContent placement={placement}>
+      <DialogTitle>Long dialog</DialogTitle>
+      <DialogDescription>Content that can outgrow a keyboard-fitted frame.</DialogDescription>
+    </DialogContent></Dialog>);
+    const dialog = screen.getByRole("dialog");
+    expect(dialog.parentElement).toHaveClass("items-start", "overflow-y-auto");
+    // The scroll owner stays inside Radix's overlay/scroll-lock boundary.
+    expect(dialog.parentElement?.parentElement).toHaveClass("backdrop-blur-[8px]", "duration-200");
+    expect(dialog).toHaveClass(placement === "bottom" ? "mt-auto" : "my-auto");
+  });
+
   it("uses pill-shaped inputs and the shared radius for other controls", () => {
     render(
       <>
```

#### Recent Merged Pull Requests:
- **PR #6076** (2026-10-05): test: isolate Star invitation state and stabilize late-result waits (@chengyongru)
- **PR #6075** (2026-10-05): fix(webui): fit wide equations and refine math spacing (@chengyongru)
- **PR #6074** (2026-10-05): feat(webui): unify icons and refine interaction feedback (@chengyongru)
- **PR #6073** (2026-10-05): fix(webui): restore CJK line height and refine text wrapping (@chengyongru)
- **PR #6066** (2026-10-05): fix(mcp): let streamable HTTP read timeout cover tool_timeout (@maxmilian)
- **PR #6061** (2026-10-04): fix(webui): dismiss mobile sidebar on current topic selection (@Re-bin)
- **PR #6060** (2026-10-05): fix(documents): read cells beyond declared XLSX dimensions (@takiAA)
- **PR #6059** (2026-10-04): fix(webui): restore sidebar focus after submenu Escape (@Re-bin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
