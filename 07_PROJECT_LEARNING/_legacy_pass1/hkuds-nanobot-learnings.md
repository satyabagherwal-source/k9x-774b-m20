# Forensic Learning Record (Deep Inspection): HKUDS/nanobot

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-nanobot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/nanobot](https://github.com/HKUDS/nanobot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:53:23.225Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/nanobot`
- **Description**: Ultra-lightweight, open-source, self-hosted personal AI agent framework in Python with WebUI, tools, memory, MCP, multi-agent workflows, automation, and chat apps
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 48700 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `nanobot/__init__.py`
```
"""
nanobot - A lightweight AI agent framework
"""

import tomllib
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .agent.tools.context import RequestContext
    from .bus.runtime_events import SessionTurnPersisted
    from .nanobot import (
        STREAM_EVENT_REASONING_COMPLETED,
        STREAM_EVENT_REASONING_DELTA,
        STREAM_EVENT_RUN_COMPLETED,
        STREAM_EVENT_RUN_FAILED,
        STREAM_EVENT_RUN_STARTED,
        STREAM_EVENT_TEXT_COMPLETED,
        STREAM_EVENT_TEXT_DELTA,
        STREAM_EVENT_TOOL_COMPLETED,
        STREAM_EVENT_TOOL_FAILED,
        STREAM_EVENT_TOOL_STARTED,
        STREAM_EVENT_TYPES,
        LLMUsage,
        Nanobot,
        RunResult,
        RunStream,
        SessionInfo,
        SessionSnapshot,
        StreamEvent,
        StreamEventType,
    )
    from .runtime_context import RuntimeContextBlock, RuntimeContextProvider


def _read_pyproject_version() -> str | None:
    """Read the source-tree version when package metadata is unavailable."""
    pyproject = Path(__file__).resolve().parent.parent / "pyproject.toml"
    if not pyproject.exists():
        return None
    data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    return data.get("project", {}).get("version")


def _resolve_version() -> str:
    try:
        return _pkg_version("nanobot-ai")
    except PackageNotFoundError:
        # Source checkouts often import nanobot without installed dist-info.
        return _read_pyproject_version() or "0.3.5"


__version__ = _resolve_version()
__logo__ = "🐈"

_LAZY_EXPORTS = {
    "Nanobot": ".nanobot",
    "LLMUsage": ".nanobot",
    "RunStream": ".nanobot",
    "RunResult": ".nanobot",
    "RequestContext": ".agent.tools.context",
    "RuntimeContextBlock": ".runtime_context",
    "RuntimeContextProvider": ".runtime_context",
    "SessionInfo": ".nanobot",
    "SessionSnapshot": ".nanobot",
    "STREAM_EVENT_REASONING_COMPLETED": ".nanobot",
    "STREAM_EVENT_REASONING_DELTA": ".nanobot",
    "STREAM_EVENT_RUN_COMPLETED": ".nanobot",
    "STREAM_EVENT_RUN_FAILED": ".nanobot",
    "STREAM_EVENT_RUN_STARTED": ".nanobot",
    "STREAM_EVENT_TEXT_COMPLETED": ".nanobot",
    "STREAM_EVENT_TEXT_DELTA": ".nanobot",
    "STREAM_EVENT_TOOL_COMPLETED": ".nanobot",
    "STREAM_EVENT_TOOL_FAILED": ".nanobot",
    "STREAM_EVENT_TOOL_STARTED": ".nanobot",
    "STREAM_EVENT_TYPES": ".nanobot",
    "StreamEvent": ".nanobot",
    "StreamEventType": ".nanobot",
    "SessionTurnPersisted": ".bus.runtime_events",
}


def __getattr__(name: str) -> Any:
    module_path = _LAZY_EXPORTS.get(name)
    if module_path is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    from importlib import import_module
    mod = import_module(module_path, __name__)
    val = getattr(mod, name)
    globals()[name] = val
    return val


__all__ = [
    "Nanobot",
    "LLMUsage",
    "RunResult",
    "RequestContext",
    "RuntimeContextBlock",
    "RuntimeContextProvider",
    "RunStream",
    "SessionInfo",
    "SessionSnapshot",
    "STREAM_EVENT_REASONING_COMPLETED",
    "STREAM_EVENT_REASONING_DELTA",
    "STREAM_EVENT_RUN_COMPLETED",
    "STREAM_EVENT_RUN_FAILED",
    "STREAM_EVENT_RUN_STARTED",
    "STREAM_EVENT_TEXT_COMPLETED",
    "STREAM_EVENT_TEXT_DELTA",
    "STREAM_EVENT_TOOL_COMPLETED",
    "STREAM_EVENT_TOOL_FAILED",
    "STREAM_EVENT_TOOL_STARTED",
    "STREAM_EVENT_TYPES",
    "StreamEvent",
    "StreamEventType",
    "SessionTurnPersisted",
]

```

### Core Architecture Module: `nanobot/__main__.py`
```
"""
Entry point for running nanobot as a module: python -m nanobot
"""

from nanobot.cli.entry import main

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `nanobot/agent/__init__.py`
```
"""Agent core module."""

from nanobot.agent.context import ContextBuilder
from nanobot.agent.hook import (
    AgentHook,
    AgentHookContext,
    AgentRunHookContext,
    AgentTurnHookContext,
    AgentTurnHookFactory,
    CompositeHook,
)
from nanobot.agent.loop import AgentLoop
from nanobot.agent.memory import MemoryStore
from nanobot.agent.skills import SkillsLoader
from nanobot.agent.subagent import SubagentManager

__all__ = [
    "AgentHook",
    "AgentHookContext",
    "AgentRunHookContext",
    "AgentTurnHookContext",
    "AgentTurnHookFactory",
    "AgentLoop",
    "CompositeHook",
    "ContextBuilder",
    "MemoryStore",
    "SkillsLoader",
    "SubagentManager",
]

```

### Core Architecture Module: `nanobot/agent/autocompact.py`
```
"""Auto compact: proactive compression of idle sessions to reduce token cost and latency."""

from __future__ import annotations

from collections.abc import Collection
from datetime import datetime
from typing import TYPE_CHECKING, Any, Callable, Coroutine

from loguru import logger

from nanobot.events import NO_EVENTS, EventSink
from nanobot.session.keys import is_dream_session
from nanobot.session.manager import Session, SessionManager
from nanobot.session.summary import (
    SessionSummary,
    is_summary_checkpoint,
    session_summary_from_metadata,
)

if TYPE_CHECKING:
    from nanobot.agent.memory import Consolidator
    from nanobot.utils.llm_runtime import LLMRuntime

SessionEventFactory = Callable[[str], EventSink]


class AutoCompact:
    def __init__(self, sessions: SessionManager, consolidator: Consolidator,
                 session_ttl_minutes: int = 0,
                 bind_events: SessionEventFactory | None = None):
        self.sessions = sessions
        self.consolidator = consolidator
        self._ttl = session_ttl_minutes
        self._archiving: set[str] = set()
        self._summaries: dict[str, SessionSummary] = {}
        self._bind_events = bind_events

    def _is_expired(self, ts: datetime | str | None,
                    now: datetime | None = None) -> bool:
        if self._ttl <= 0 or not ts:
            return False
        try:
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts)
            current = now or datetime.now()
            if getattr(ts, "tzinfo", None) is not None or current.tzinfo is not None:
                idle_seconds = current.timestamp() - ts.timestamp()
            else:
                idle_seconds = (current - ts).total_seconds()
        except (OSError, OverflowError, TypeError, ValueError):
            # list_sessions() forwards raw persisted metadata; an unusable value
            # must not escape the idle scan and stop the agent loop.
            return False
        return idle_seconds >= self._ttl * 60

    def _has_unarchived_messages(self, key: str) -> bool:
        session = self.sessions.get_or_create(key)
        return any(
            not message.get("_command") and not is_summary_checkpoint(message)
            for message in session.messages[session.last_archived:]
        )

    def check_expired(
        self,
        schedule_background: Callable[[Coroutine[Any, Any, None]], None],
        resolve_runtime: Callable[[Session], LLMRuntime],
        active_session_keys: Collection[str] = (),
    ) -> None:
        """Schedule archival for idle sessions, skipping those with in-flight agent tasks."""
        now = datetime.now()
        for info in self.sessions.list_sessions():
            key = info.get("key", "")
            # Dream sessions are per-run; persistent maintenance sessions still compact.
            if not key or is_dream_session(key) or key in self._archiving:
                continue
            if key in active_session_keys:
                continue
            updated_at = info.get("updated_at")
            if self._is_expired(updated_at, now) and self._has_unarchived_messages(key):
                session = self.sessions.get_or_create(key)
                try:
                    runtime = resolve_runtime(session)
                except (KeyError, ValueError):
                    # Invalid session selections remain recoverable through /model.
                    continue
                self._archiving.add(key)
                schedule_background(self._archive(key, runtime=runtime))

    async def _archive(self, key: str, *, runtime: LLMRuntime) -> None:
        if is_dream_session(key):
            self._archiving.discard(key)
            return
        try:
            summary = await self.consolidator.compact_idle_session(
                key,
                runtime=runtime,
                events=self._bind_events(key) if self._bind_events else NO_EVENTS,
            )
            if summary:
                session = self.sessions.get_or_create(key)
                stored = session_summary_from_metadata(
                    session.metadata,
                    fallback_last_active=session.updated_at,
                )
                if stored is not None:
                    self._summaries[key] = stored
        except Exception:
            logger.exception("Auto-compact: failed for {}", key)
        finally:
            self._archiving.discard(key)

    def prepare_session(self, session: Session, key: str) -> tuple[Session, SessionSummary | None]:
        if is_dream_session(key):
            self._archiving.discard(key)
            self._summaries.pop(key, None)
            return session, None
        if key in self._archiving or self._is_expired(session.updated_at):
            logger.info("Auto-compact: reloading session {} (archiving={})", key, key in self._archiving)
            session = self.sessions.get_or_create(key)
        # Hot path: summary from in-memory dict (process hasn't restarted).
        entry = self._summaries.pop(key, None)
        if entry:
            return session, entry
        # Cold path: summary persisted in session metadata (process restarted).
        # Persisted metadata may outlive schema changes; a malformed summary must
        # not abort turn preparation.
        return session, session_summary_from_metadata(
            session.metadata,
            fallback_last_active=session.updated_at,
        )

```

### Core Architecture Module: `nanobot/agent/automation_turns.py`
```
"""Shared coordination for session-bound automation turns."""

from __future__ import annotations

import asyncio
import dataclasses
from collections.abc import Callable, Iterable

from nanobot.bus.events import InboundMessage, OutboundMessage


class AutomationTurnError(RuntimeError):
    """Raised when an automation turn reaches the agent and finishes with an error."""


class AutomationTurnCoordinator:
    """Manage automation turns without mixing them into live injections."""

    def __init__(
        self,
        *,
        enqueue: Callable[[InboundMessage], None],
        turn_id: Callable[[InboundMessage], str | None],
        pending_id: Callable[[InboundMessage], str | None],
        should_defer_turn: Callable[[InboundMessage, str, Iterable[str]], bool],
        missing_id_error: str,
        duplicate_id_error: Callable[[str], str],
        deferred_queues: dict[str, list[InboundMessage]] | None = None,
    ) -> None:
        self._enqueue = enqueue
        self._turn_id = turn_id
        self._pending_id = pending_id
        self._should_defer_turn = should_defer_turn
        self._missing_id_error = missing_id_error
        self._duplicate_id_error = duplicate_id_error
        self.deferred_queues = deferred_queues if deferred_queues is not None else {}
        self._waiters: dict[str, asyncio.Future[OutboundMessage | None]] = {}
        self._pending_messages_by_turn_id: dict[str, InboundMessage] = {}

    def owns_turn(self, msg: InboundMessage) -> bool:
        """Whether this message requires an independent automation completion."""
        return bool(self._turn_id(msg))

    async def submit(self, msg: InboundMessage) -> OutboundMessage | None:
        """Submit an automation turn and wait for its session response."""
        turn_id = self._turn_id(msg)
        if not turn_id:
            raise ValueError(self._missing_id_error)
        if turn_id in self._waiters:
            raise RuntimeError(self._duplicate_id_error(turn_id))

        loop = asyncio.get_running_loop()
        future: asyncio.Future[OutboundMessage | None] = loop.create_future()
        self._waiters[turn_id] = future
        self._pending_messages_by_turn_id[turn_id] = msg
        try:
            self._enqueue(msg)
            try:
                return await future
            except asyncio.CancelledError:
                raise
            except AutomationTurnError:
                raise
            except Exception as exc:
                raise AutomationTurnError(str(exc) or exc.__class__.__name__) from exc
        finally:
            self._waiters.pop(turn_id, None)
            self._pending_messages_by_turn_id.pop(turn_id, None)

    def defer_if_active(
        self,
        msg: InboundMessage,
        *,
        session_key: str,
        active_session_keys: Iterable[str],
    ) -> bool:
        """Defer an automation turn when its target session is already active."""
        if not self._should_defer_turn(msg, session_key, active_session_keys):
            return False
        pending_msg = msg
        if session_key != msg.session_key:
            pending_msg = dataclasses.replace(
                msg,
                session_key_override=session_key,
            )
        self.deferred_queues.setdefault(session_key, []).append(pending_msg)
        return True

    def complete(
        self,
        msg: InboundMessage,
        *,
        response: OutboundMessage | None = None,
        error: BaseException | None = None,
    ) -> None:
        turn_id = self._turn_id(msg)
        if not turn_id:
            return
        future = self._waiters.get(turn_id)
        if future is None or future.done():
            return
        if error is not None:
            if isinstance(error, asyncio.CancelledError):
                error = AutomationTurnError(str(error) or error.__class__.__name__)
            future.set_exception(error)
        else:
            future.set_result(response)

    def pending_ids_for_session(self, session_key: str) -> set[str]:
        """Return automation IDs that are waiting for or running in *session_key*."""
        pending_ids: set[str] = set()
        for msg in self.deferred_queues.get(session_key, []):
            pending_id = self._pending_id(msg)
            if pending_id:
                pending_ids.add(pending_id)
        for msg in self._pending_messages_by_turn_id.values():
            if msg.session_key != session_key:
                continue
            pending_id = self._pending_id(msg)
            if pending_id:
                pending_ids.add(pending_id)
        return pending_ids

```

### Core Architecture Module: `nanobot/agent/context.py`
```
"""Context builder for assembling agent prompts."""

import base64
import mimetypes
import platform
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence, cast

from nanobot.agent.memory import MemoryStore
from nanobot.agent.skills import SkillsLoader
from nanobot.agent.tools import image_generation as image_generation_tools
from nanobot.agent.tools import mcp as mcp_tools
from nanobot.agent.tools import sessions as session_tools
from nanobot.agent.tools.registry import ToolRegistry
from nanobot.apps.cli import utils as cli_app_utils
from nanobot.bus.events import (
    INBOUND_META_RUNTIME_CONTROL,
    RUNTIME_CONTROL_SESSION_DISCARD,
    InboundMessage,
)
from nanobot.runtime_context import (
    RUNTIME_CONTEXT_MESSAGE_META,
    RuntimeContextBlock,
    append_runtime_context,
)
from nanobot.security.workspace_access import WorkspaceScopeResolver
from nanobot.session.keys import last_channel_from_metadata
from nanobot.session.manager import Session
from nanobot.session.summary import SessionSummary
from nanobot.utils.helpers import detect_image_mime, load_bundled_template
from nanobot.utils.prompt_templates import render_template


def session_extra(metadata: Mapping[str, Any] | None) -> dict[str, Any]:
    """Return persisted kwargs for turn-attached capabilities."""
    return (
        cli_app_utils.session_extra(metadata)
        | mcp_tools.session_extra(metadata)
        | session_tools.session_extra(metadata)
    )


async def handle_runtime_control(state: Any, msg: InboundMessage, tools: ToolRegistry) -> bool:
    if msg.metadata.get(INBOUND_META_RUNTIME_CONTROL) == RUNTIME_CONTROL_SESSION_DISCARD:
        await state.discard_session(msg.session_key)
        return True
    return await image_generation_tools.handle_runtime_control(state, msg, tools)


@dataclass(frozen=True, slots=True)
class PersistedPromptContextResolver:
    """Restore prompt routing context when no inbound message is available."""

    workspace_scopes: WorkspaceScopeResolver
    unified_session: bool = False

    def __call__(self, session: Session) -> tuple[str | None, Path]:
        channel = session.key.split(":", 1)[0] if ":" in session.key else None
        if self.unified_session:
            route = last_channel_from_metadata(session.metadata)
            if route is not None:
                channel = route[0]
        scope = self.workspace_scopes.for_turn(
            channel=channel,
            message_metadata=None,
            session_metadata=session.metadata,
        )
        return channel, scope.project_path


@dataclass(frozen=True, slots=True)
class TranscriptInput:
    """Raw turn inputs from which ``ContextBuilder`` assembles a transcript."""

    history: list[dict[str, Any]]
    current_message: str | None
    media: Sequence[str] | None = None
    current_role: str = "user"
    session_summary: SessionSummary | None = None
    runtime_context_blocks: Sequence[RuntimeContextBlock] | None = None

    @property
    def message_count(self) -> int:
        """Number of boundary-preserving messages in the assembled transcript."""
        return 1 + len(self.history) + (self.current_message is not None)


class ContextBuilder:
    """Builds the context (system prompt + messages) for the agent."""

    BOOTSTRAP_FILES = ["AGENTS.md", "SOUL.md", "USER.md"]
    _SKIPPABLE_DEFAULTS = {"AGENTS.md", "USER.md"}

    def __init__(self, workspace: Path, timezone: str | None = None, disabled_skills: list[str] | None = None):
        self.workspace = workspace
        self.timezone = timezone
        self.memory = MemoryStore(workspace)
        self.skills = SkillsLoader(workspace, disabled_skills=set(disabled_skills) if disabled_skills else None)

    def build_system_prompt(
        self,
        *,
        channel: str | None = None,
        session_summary: SessionSummary | None = None,
        workspace: Path | None = None,
        include_memory: bool = True,
    ) -> str:
        """Build the system prompt from identity, bootstrap files, memory, and skills."""
        root = workspace or self.workspace
        parts = [self._get_identity(channel=channel, workspace=root)]

        bootstrap = self._load_bootstrap_files(root)
        if bootstrap:
            parts.append(bootstrap)

        parts.append(render_template("agent/tool_contract.md"))

        project_path = root.expanduser().resolve()
        if project_path != self.workspace.expanduser().resolve():
            parts.append(
                "# Current Project\n\n"
                f"Working directory: {project_path}\n"
                "Use it as the default root for project files and relative tool paths."
            )

        if include_memory:
            memory = self.memory.read_memory()
            if memory and not self._is_template_content(memory, "memory/MEMORY.md"):
                parts.append(f"# Memory\n\n## Long-term Memory\n{memory}")

        active_skills = self.skills.get_always_skills()
        if active_skills:
            active_content = self.skills.load_skills_for_context(active_skills)
            if active_content:
                parts.append(f"# Active Skills\n\n{active_content}")

        skills_summary = self.skills.build_skills_summary(
            exclude=set(active_skills),
            workspace=root,
        )
        if skills_summary:
            parts.append(render_template("agent/skills_section.md", skills_summary=skills_summary))

        if session_summary and session_summary["text"] != "(nothing)":
            parts.append(
                "[Archived Context Summary]\n\n"
                f"Previous conversation summary (last active {session_summary['last_active']}):\n"
                f"{session_summary['text']}"
            )

        return "\n\n---\n\n".join(parts)

    def _get_identity(self, channel: str | None = None, workspace: Path | None = None) -> str:
        """Get the core identity section."""
        root = workspace or self.workspace
        workspace_path = str(root.expanduser().resolve())
        agent_workspace_path = str(self.workspace.expanduser().resolve())
        system = platform.system()
        runtime = f"{'macOS' if system == 'Darwin' else system} {platform.machine()}, Python {platform.python_version()}"

        return render_template(
            "agent/identity.md",
            workspace_path=workspace_path,
            agent_workspace_path=agent_workspace_path,
            runtime=runtime,
            platform_policy=render_template("agent/platform_policy.md", system=system),
            channel=channel or "",
        )

    @staticmethod
    def _merge_message_content(left: Any, right: Any) -> str | list[dict[str, Any]]:
        if isinstance(left, str) and isinstance(right, str):
            if not left:
                return right
            if not right:
                return left
            return f"{left}\n\n{right}"

        def _to_blocks(value: Any) -> list[dict[str, Any]]:
            if isinstance(value, list):
                return [
                    cast(dict[str, Any], item)
                    if isinstance(item, dict)
                    else {"type": "text", "text": str(item)}
                    for item in cast(list[Any], value)
                ]
            if value is None:
                return []
            return [{"type": "text", "text": str(value)}]

        return _to_blocks(left) + _to_blocks(right)

    def _load_bootstrap_files(self, workspace: Path | None = None) -> str:
        """Load project instructions plus the agent's global profile files."""
        parts: list[str] = []
        project_root = workspace or self.workspace
        sources = [
            ("AGENTS.md", project_root),
            ("SOUL.md", self.workspace),
            ("USER.md", self.workspace),
        ]

        for filename, root in sources:
            file_path = root / filename
            if file_path.exists():
                content = file_path.read_tex
```

### Core Architecture Module: `nanobot/agent/context_governance.py`
```
"""Model-message governance and compaction for agent runner requests.

This module owns model-facing message shaping, request pressure, H/delta
compaction state, and tool-result content normalization. It may return copied
messages or persisted-result placeholders, but it must not mutate an existing
session history list in place.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from copy import deepcopy
from dataclasses import dataclass, field, replace
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast
from uuid import uuid4

from loguru import logger

from nanobot.agent.context import TranscriptInput
from nanobot.events import NO_EVENTS, ContextCompactionEvent, EventSink
from nanobot.providers.base import (
    CONTEXT_SAFETY_BUFFER,
    LLMResponse,
    LLMUsage,
    ProviderCallContext,
    ProviderConversationState,
)
from nanobot.providers.conversation_state import (
    ProviderConversationStateController,
    allows_conversation_message_merge,
)
from nanobot.runtime_context import (
    RUNTIME_CONTEXT_MESSAGE_META,
    detach_runtime_context,
    reattach_runtime_context,
)
from nanobot.session.history_visibility import is_hidden_history_message
from nanobot.session.summary import (
    SUMMARY_CONTINUATION_TEXT,
    SessionSummaryCheckpoint,
)
from nanobot.utils.helpers import (
    estimate_prompt_tokens_chain,
    maybe_persist_tool_result,
    truncate_text,
)
from nanobot.utils.runtime import ensure_nonempty_tool_result

if TYPE_CHECKING:
    from nanobot.agent.tools.registry import ToolRegistry
    from nanobot.providers.base import LLMProvider

TranscriptBuilder = Callable[[TranscriptInput], list[dict[str, Any]]]
SummaryTranscriptBuilder = Callable[[str], list[dict[str, Any]]]
HistoryConsolidator = Callable[
    [list[dict[str, Any]], str | None],
    Awaitable[str | None],
]
ProviderCompactionConsolidator = Callable[
    [ProviderConversationState, list[dict[str, Any]], str | None],
    Awaitable[str | None],
]

# read_file has its own bound; exempt it to avoid persist->read->persist loops.
TOOL_RESULT_OFFLOAD_EXEMPT_TOOLS = frozenset({"read_file"})
BACKFILL_CONTENT = "[Tool result unavailable — call was interrupted or lost]"
PLACEHOLDER_TEXTS = frozenset({
    "[Previous assistant message omitted.]",
})


class ContextWindowExceededError(RuntimeError):
    """Raised before a request that exceeds its local context budget."""

    def __init__(
        self,
        *,
        session_key: str | None,
        estimated_tokens: int,
        input_budget: int,
        source: str,
    ) -> None:
        self.session_key = session_key
        self.estimated_tokens = estimated_tokens
        self.input_budget = input_budget
        self.source = source
        super().__init__(
            "Model input exceeds the local context budget "
            f"for {session_key or 'default'}: {estimated_tokens}/{input_budget} via {source}"
        )


def _tool_call_name_is_valid(tool_call: Any) -> bool:
    """Whether a persisted OpenAI-style tool_call carries a usable name.

    Mirrors ``ToolCallRequest.has_valid_name`` for the dict shape stored in
    message history: a degenerate call with ``name=None`` / ``""`` cannot be
    executed and is rejected by upstream APIs if replayed.
    """
    if not isinstance(tool_call, dict):
        return False
    tool_call_data = cast(dict[str, Any], tool_call)
    fn = tool_call_data.get("function")
    name = cast(dict[str, Any], fn).get("name") if isinstance(fn, dict) else tool_call_data.get("name")
    return isinstance(name, str) and bool(name)


@dataclass(slots=True)
class ContextGovernanceConfig:
    provider: LLMProvider
    model: str
    tools: ToolRegistry
    workspace: Path | None
    session_key: str | None
    max_tool_result_chars: int
    context_window_tokens: int | None = None
    max_tokens: int | None = None


@dataclass(slots=True)
class ContextCompactionState:
    """Track accepted provider input H separately from the unsent delta."""

    raw_messages: list[dict[str, Any]]
    accepted_messages: list[dict[str, Any]]
    raw_accepted_boundary: int
    active_summary: str | None
    summary_transcript_builder: SummaryTranscriptBuilder
    consolidate_history: HistoryConsolidator
    consolidate_provider_compaction: ProviderCompactionConsolidator | None
    summary_checkpoint: SessionSummaryCheckpoint | None = None

    @classmethod
    def from_transcript(
        cls,
        transcript_input: TranscriptInput,
        transcript_builder: TranscriptBuilder,
        consolidate_history: HistoryConsolidator,
        consolidate_provider_compaction: ProviderCompactionConsolidator | None,
    ) -> tuple[list[dict[str, Any]], ContextCompactionState]:
        """Build the raw transcript and its initial H/delta boundary."""
        messages = list(transcript_builder(transcript_input))
        accepted_history_boundary = 1 + len(transcript_input.history)

        def build_summary_transcript(summary: str) -> list[dict[str, Any]]:
            return transcript_builder(
                replace(
                    transcript_input,
                    history=[],
                    current_message=None,
                    media=None,
                    session_summary={
                        "text": summary,
                        "last_active": datetime.now().astimezone().isoformat(),
                    },
                    runtime_context_blocks=None,
                )
            )

        return messages, cls(
            raw_messages=messages,
            accepted_messages=deepcopy(messages[:accepted_history_boundary]),
            raw_accepted_boundary=accepted_history_boundary,
            active_summary=(
                transcript_input.session_summary["text"]
                if transcript_input.session_summary is not None
                else None
            ),
            summary_transcript_builder=build_summary_transcript,
            consolidate_history=consolidate_history,
            consolidate_provider_compaction=consolidate_provider_compaction,
        )

    @classmethod
    def from_messages(
        cls,
        messages: list[dict[str, Any]],
        consolidate_history: HistoryConsolidator,
        consolidate_provider_compaction: ProviderCompactionConsolidator | None,
    ) -> ContextCompactionState:
        """Create compaction state for a standalone runner transcript."""
        raw_messages = list(messages)
        instruction_prefix: list[dict[str, Any]] = []
        for message in raw_messages:
            if message.get("role") not in {"system", "developer"}:
                break
            instruction_prefix.append(dict(message))

        def build_summary_transcript(summary: str) -> list[dict[str, Any]]:
            archived_context = (
                "[Archived Context Summary]\n\n"
                "Previous conversation summary:\n"
                f"{summary}"
            )
            prefix = deepcopy(instruction_prefix)
            for index in range(len(prefix) - 1, -1, -1):
                content = prefix[index].get("content")
                if isinstance(content, str):
                    prefix[index]["content"] = (
                        f"{content}\n\n---\n\n{archived_context}"
                    )
                    return prefix
            return [{"role": "system", "content": archived_context}, *prefix]

        return cls(
            raw_messages=raw_messages,
            accepted_messages=deepcopy(raw_messages),
            raw_accepted_boundary=len(raw_messages),
            active_summary=None,
            summary_transcript_builder=build_summary_transcript,
            consolidate_history=consolidate_history,
            consolidate_provider_compaction=consolidate_provider_compaction,
        )

    def request_messages(
        self,
        raw_messages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        retur
```

### Core Architecture Module: `nanobot/agent/cron_turns.py`
```
"""Coordination for scheduled cron turns."""

from __future__ import annotations

from collections.abc import Callable, Iterable

from nanobot.agent.automation_turns import AutomationTurnCoordinator
from nanobot.bus.events import InboundMessage
from nanobot.cron.session_turns import (
    cron_run_id,
    cron_trigger,
    defer_cron_until_session_idle,
)


class CronTurnCoordinator(AutomationTurnCoordinator):
    """Manage scheduled cron turns without mixing them into live injections."""

    def __init__(
        self,
        *,
        enqueue: Callable[[InboundMessage], None],
        deferred_queues: dict[str, list[InboundMessage]] | None = None,
    ) -> None:
        super().__init__(
            enqueue=enqueue,
            turn_id=lambda msg: cron_run_id(msg.metadata),
            pending_id=_cron_job_id,
            should_defer_turn=_should_defer_cron_turn,
            missing_id_error="cron turn metadata must include a run_id",
            duplicate_id_error=lambda run_id: f"cron run {run_id!r} is already pending",
            deferred_queues=deferred_queues,
        )

    def pending_job_ids_for_session(self, session_key: str) -> set[str]:
        """Return cron jobs that are waiting for or running in *session_key*."""
        return self.pending_ids_for_session(session_key)


def _should_defer_cron_turn(
    msg: InboundMessage,
    session_key: str,
    active_session_keys: Iterable[str],
) -> bool:
    return defer_cron_until_session_idle(msg.metadata) and session_key in active_session_keys


def _cron_job_id(msg: InboundMessage) -> str | None:
    trigger = cron_trigger(msg.metadata)
    if not trigger:
        return None
    value = trigger.get("job_id")
    return value if isinstance(value, str) and value else None

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5991** (2026-09-30): **fix(webui): keep completed turns terminal across late events**
  *Symptoms*: A delayed admission broadcast or ACK can carry an old `active_turn_id` after that turn has ended. The WebUI accepted this ownership and reopened its run clock, leaving processing indicators visible and preventing queued guidance from observing a stable completion. The same regression was reproducible after a fresh history load because explicit completion IDs were only fenced during later reconciliation.  Make completion monotonic for each turn ID at the client event boundary: - Remember completion from live turn-end/idle, local stop, and canonical reconciliation. - Reject stale lifecycle events before clocks, ownership, or subscribers mutate state. Preserve late input/ACK delivery and final answer/outcome events where they remain valid. - Fence explicit history completion IDs on initial load, and allow a distinct new turn to run normally.  Related: [NAN-210](https://linear.app/nanobot-ai/issue/NAN-210/webui-turn-终态异常统一定位与整体验收), [NAN-197](https://linear.app/nanobot-ai/issue/NAN-197/webui-turn-结束后仍显示处理中刷新后恢复), [NAN-164](https://linear.app/nanobot-ai/issue/NAN-164/webui-等待发送的消息在当前-turn-结束后未自动发送).  Validation: - Full WebUI suite with V8 coverage: 2,120 tests passed with two workers locally; all coverage thresholds passed. - Production WebUI build, full WebUI/channel ESLint, and `git diff --check` passed. - Built WebUI served by an isolated real gateway: injected terminal-then-stale WebSocket frames; queued guidance sent exactly once; processing/sidebar indicators cleared; durable

- **Issue #5989** (2026-09-30): **fix(webui): stop repairing completed Markdown**
  *Symptoms*: ## Summary  Fixes [NAN-205](https://linear.app/nanobot-ai/issue/NAN-205): a synthetic trailing `_` can remain after an assistant response finishes.  A plain identifier such as `_legal_history_tail()` can make Remend append an emphasis-closing underscore to the end of a response. Assistant replies previously retained streaming parsing after completion to keep their block layout stable, leaving that synthetic character visible even though it was absent from the final message.  - Keep the actual streaming state separate from the stable streaming layout. - Repair only streaming source at the Markdown renderer boundary, and disable Streamdown's internal repair. Streamdown 2.5's memo comparator ignores repair-option changes, so simply toggling `parseIncompleteMarkdown` does not update an otherwise unchanged response. Passing the repaired/raw source as `children` makes completion update through its normal content path without remounting. - Declare the already-installed Remend 1.3.0 as a direct dependency; no dependency version upgrades. - Cover stream-to-complete transitions, unchanged paragraph identity, and legitimate literal trailing underscores/unmatched Markdown in completed source.  ## Verification  - Regression checks fail against the base implementation and pass with this change. - Focused Markdown and message-bubble suites: **139 tests passed**. - Full WebUI suite: **129 files / 2,111 tests passed** with `--maxWorkers=4 --minWorkers=1`. - `bun run build`, `b

- **Issue #5988** (2026-09-30): **fix(cli): avoid duplicate WebUI config announcement**
  *Symptoms*: ## Summary  Fixes [NAN-208](https://linear.app/nanobot-ai/issue/NAN-208).  `nanobot webui --config …` printed `Using config:` twice: once when resolving the setup path and again when loading the runtime configuration. Keep the runtime loader's announcement and make setup path resolution silent, without changing config selection, setup, or gateway startup.  ## Regression coverage  - First-run setup with an explicit config prints the announcement exactly once. - An existing explicit config prints it once and remains the selected config even when the default path is different. - The default config path continues to print it once.  The explicit-config regressions fail on the original implementation (two announcements); the default-path control passes.  ## Validation  - `uv run --no-sync pytest tests/cli -q`: **536 passed, 11 skipped**. - Ruff on the changed files: passed. - BasedPyright: **0 errors, 0 warnings** (all extras/channel dependencies installed; `setproctitle` additionally installed for Windows type checking). - `git diff --check`: passed. - Real `python -m nanobot webui --config … --dev --yes --no-open` subprocess with an isolated temporary config: exactly one announcement of the selected path. An intentionally occupied gateway port produced the expected exit code 1 before launching a gateway or Vite; temporary files and socket were cleaned up. 

- **Issue #5987** (2026-09-30): **Numbers-only cannot be recognized in TUI debug‑mode, while alphabet characters work fine**
  *Symptoms*: ### Bug Description  <img width="1540" height="875" alt="Image" src="https://github.com/user-attachments/assets/f00810dc-364f-42d3-95ab-0c72366c4f22" />  ### Steps to Reproduce  .vscode launch.json file {     "version": "0.2.0",     "configurations": [         {             "name": "nanobot",             "type": "debugpy",             "request": "launch",             "module": "nanobot",             "args": ["agent"],             "console": "integratedTerminal",             "justMyCode": false,             "envFile": "${workspaceFolder}/.env"         }     ] }  ### Expected Behavior  Numbers-only works  ### Relevant Logs  ```shell  ```  ### nanobot Version  nanobot v0.3.5  ### Python Version  3.11  ### Operating System  Windows  ### Channel / Platform  Other (specify below)  ### LLM Provider  OpenRouter  ### Configuration (Optional)  ```yaml Channel / Platform --- TUI ```  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > I haven't been able to reproduce the numbers-only failure so far.  Tested on Windows with Python 3.11.12, nanobot v0.3.5 at commit `e2b89d45`, Bun 1.3.6, and debugpy 1.8.22. I exercised the actual `python -m nanobot agent` launcher through Windows ConPTY in three modes: normal startup, debugpy attached to the launcher and gateway subprocess, and a breakpoint at `WebSocketChannel._dispatch_envelope` line 868 followed by continuing execution.  After confirming the TUI/gateway was ready, all 21 checks passed: typed `11111`, `0`, `00001`, `1234567890`, `abc`, `a11111`, and pasted `11111` in each mode. Numeric content reached the gateway and provider as a string, and the TUI displayed the reply.  This used the OpenRouter adapter with a local deterministic OpenAI-compatible endpoint, so it does not cover the exact VS Code integrated-terminal + live OpenRouter setup.  Could you share the exact commit, VS Code/Python Debugger extension versions, and whether this also happens after the gateway 
  > I can't reproduce it either. Maybe it happens by my mistake. I will close it. Thanks for your time!
  > <img width="1842" height="971" alt="Image" src="https://github.com/user-attachments/assets/e3622896-e781-438b-a0be-92517f6c67b5" /> it happends just now.

- **Issue #5986** (2026-09-30): **fix(tools): preserve PATH for argument-vector commands**
  *Symptoms*: ## Summary  - Preserve the parent process `PATH` when `ExecTool` launches an argument-vector command. - Apply `pathPrepend` and `pathAppend` around that path without forwarding other parent environment variables. - Add a regression test for executable lookup and environment isolation.  ## Problem  `RgTool.enabled()` detects `rg` using the configured exec path plus the gateway process `PATH`. On Unix, `ExecTool._build_env()` intentionally creates a minimal environment without `PATH`, and `_prepare_command()` previously restored a path for argument vectors only when `pathPrepend` or `pathAppend` was configured. With the default configuration, `rg` could therefore be registered successfully but fail at execution time with:  ```text Error executing command: Executable not found: rg ```  ## Fix  Argument-vector commands now receive the parent `PATH`, falling back to the platform's curated subprocess path when the parent has none, and then compose the configured prepend/append entries around it. String shell commands keep their existing behavior, and the subprocess environment still excludes unrelated variables such as API keys and tokens.  ## Validation  - `132 passed, 41 skipped` across the focused exec, rg, process-reaping, and seatbelt suites. - `ruff check nanobot/agent/tools/shell.py tests/tools/test_exec_platform.py` - Targeted BasedPyright: `0 errors, 0 warnings, 0 notes`. - Black-box `RgTool` call against the latest `main`, with workspace restriction enabled: located the f

- **Issue #5984** (2026-09-30): **fix(codex): avoid release-pinned model catalog filtering**
  *Symptoms*: ## Problem  The Codex model endpoint filters visibility by `client_version`. Pinning discovery to a released CLI version can hide newly available models.  ## Changes  Change `OPENAI_CODEX_CATALOG_CLIENT_VERSION` from `0.158.0` to `99.99.99` and update its comment to explain the discovery rationale without naming specific models.  The same value is used in the official Codex [catalog-generation workflow](https://github.com/openai/codex/blob/d807d44a/.github/workflows/rust-release-prepare.yml). Account access rules still apply; catalog inclusion does not guarantee inference compatibility.  The reasoning-effort selector is a separate PR: #5983.  ## Verification  - Local OAuth catalog tests: 41 passed, 4 failed. All four failures assert the previous `0.158.0` request parameter; those assertions remain unchanged. - The author reported account-backed testing showing an additional model with the sentinel version. This was not repeated during the scope reduction. - `git diff --check` passed.  
  **Post-Mortem & Fix Analysis**:
  > <img width="998" height="370" alt="image" src="https://github.com/user-attachments/assets/de0addd9-d73a-428c-8b44-eb19d8f3c960" /> 

- **Issue #5982** (2026-09-30): **Correct misleading Taiwanese WebUI messages**
  *Symptoms*: ## Summary  Some Taiwanese WebUI messages implied an incorrect action or state, making it harder to understand what nanobot is doing and what to do next. This PR updates 20 strings in the zh-TW locale to match the English source and UI behavior, using Taiwanese terminology where it improves clarity.  ## Validation  - `cd webui && bun run test -- src/tests/i18n.test.tsx` (27 passed) - JSON parsing, 1,749-key parity, and placeholder and markup checks - `git diff --check` 

- **Issue #5969** (2026-09-29): **fix(agent): require subagent consolidator at construction**
  *Symptoms*: ## Summary  - Require an explicitly supplied, keyword-only `Consolidator` when constructing `SubagentManager`, and reject explicit `None` before creating runtime resources. - Always bind transcript and provider-compaction callbacks with `persist=False`; do not create a fallback consolidator or allow execution without compaction. - Update existing test callers and add public SDK regressions for constructor validation and inline/background execution through the real runner, file tools, and consolidator.  ## Why  #5820 already routed subagent context pressure through the shared consolidator, but left `SubagentManager(consolidator=None)` constructible. Such managers fail only when execution reaches `AgentRunner`, returning `Error: consolidate_history is required` before the first model request. This change enforces the dependency at its owning construction boundary.  ### SDK compatibility  Standalone callers must now pass `consolidator=...` explicitly. Omitting it or passing `None` raises `TypeError` at construction. `AgentLoop` already supplies this dependency; its execution and result-routing behavior are unchanged. The deprecated provider/model constructor arguments remain available when the required consolidator is supplied.  ## Scope  Together with the merged #5820, this completes NAN-127's context-compaction work. No durable child sessions or transcripts are introduced. Temporary Chat cross-turn summaries remain NAN-128; task-scoped process/file ownership an

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

### Incident Patch 1: `678cd8f4` (2026-09-30)
**Commit Message**: fix(webui): keep completed turns terminal across late events (#5991)

* fix(webui): keep completed turns terminal across late events

* test(webui): align app layout client mock with completion API

**File**: `webui/src/components/thread/ThreadShell.tsx` (modified, +1/-0)
```diff
@@ -1131,6 +1131,7 @@ export function ThreadShell({
 
   useEffect(() => {
     if (!historyKey || !chatId || loading) return;
+    client.fenceCanonicalCompletedTurns(chatId, completedTurnIds);
     const cached = messageCacheRef.current.get(chatId);
     const pendingCanonicalHydrate = pendingCanonicalHydrateRef.current.get(chatId);
     const hasNewCanonicalHistory = (
```

**File**: `webui/src/lib/nanobot-client.ts` (modified, +78/-27)
```diff
@@ -221,6 +221,8 @@ export class NanobotClient {
   private lastSocketMessageSendKey: string | null = null;
   /** Canonically completed turns whose delayed websocket frames must be ignored. */
   private canonicalCompletedTurnIdsByChatId = new Map<string, Set<string>>();
+  /** Closed run identities; output/ACKs can still arrive after idle or local stop. */
+  private closedRunTurnIdsByChatId = new Map<string, Set<string>>();
   private static readonly COMPLETED_TURN_FENCE_MAX = 256;
   /** Latest ``goal_state`` snapshot per ``chat_id`` (multi-session isolation). */
   private goalStateByChatId = new Map<string, GoalStateWsPayload>();
@@ -328,6 +330,9 @@ export class NanobotClient {
   /** Clear the optimistic run state immediately after the user stops a turn. */
   finishRunLocally(chatId: string): void {
     const unsettled = [...(this.unsettledRunTurnIdsByChatId.get(chatId) ?? [])];
+    const latestTurnId = this.latestRunTurnIdByChatId.get(chatId);
+    if (latestTurnId) this.rememberRunCompletion(chatId, latestTurnId);
+    for (const turnId of unsettled) this.rememberRunCompletion(chatId, turnId);
     for (const turnId of unsettled) this.settleRunTurn(chatId, turnId);
     this.latestRunTurnIdByChatId.delete(chatId);
     if (this.runStartedAtByChatId.delete(chatId)) {
@@ -469,28 +474,8 @@ export class NanobotClient {
     completedTurnIds: readonly string[],
     snapshot?: CanonicalRunSnapshot,
   ): boolean {
+    this.fenceCanonicalCompletedTurns(chatId, completedTurnIds);
     const fences = this.canonicalCompletedTurnIdsByChatId.get(chatId) ?? new Set<string>();
-    for (const turnId of completedTurnIds) {
-      if (!turnId) continue;
-      fences.add(turnId);
-    }
-    while (fences.size > NanobotClient.COMPLETED_TURN_FENCE_MAX) {
-      const oldest = fences.values().next().value;
-      if (typeof oldest !== "string") break;
-      fences.delete(oldest);
-    }
-    if (fences.size > 0) this.canonicalCompletedTurnIdsByChatId.set(chatId, fences);
-    const pendingInbound = this.pendingInboundByChat.get(chatId);
-    if (pendingInbound) {
-      const remaining = pendingInbound.filter((event) => {
-        const turnId = "turn_id" in event && typeof event.turn_id === "string"
-          ? event.turn_id
-          : null;
-        return turnId === null || !fences.has(turnId);
-      });
-      if (remaining.length > 0) this.pendingInboundByChat.set(chatId, remaining);
-      else this.pendingInboundByChat.delete(chatId);
-    }
 
     if (!this.canReconcileCanonicalCompletion(
       chatId,
@@ -515,6 +500,7 @@ export class NanobotClient {
           observed,
           snapshot,
         )) continue;
+        this.rememberRunCompletion(chatId, turnId);
         unsettledTurnIds.delete(turnId);
         this.clearPendingMessageSend(chatId, turnId);
         this.runStartedAtByTurnKey.delete(this.runSendKey(chatId, turnId));
@@ -528,6 +514,32 @@ export class NanobotClient {
     return true;
   }
 
+  /** Remember explicit terminal facts even when a history snapshot cannot replace live UI. */
+  fenceCanonicalCompletedTurns(chatId: string, completedTurnIds: readonly string[]): void {
+    const fences = this.canonicalCompletedTurnIdsByChatId.get(chatId) ?? new Set<string>();
+    for (const turnId of completedTurnIds) {
+      if (!turnId) continue;
+      fences.add(turnId);
+    }
+    while (fences.size > NanobotClient.COMPLETED_TURN_FENCE_MAX) {
+      const oldest = fences.values().next().value;
+      if (typeof oldest !== "string") break;
+      fences.delete(oldest);
+    }
+    if (fences.size > 0) this.canonicalCompletedTurnIdsByChatId.set(chatId, fences);
+    const pendingInbound = this.pendingInboundByChat.get(chatId);
+    if (pendingInbound) {
+      const remaining = pendingInbound.filter((event) => {
+        const turnId = "turn_id" in event && typeof event.turn_id === "string"
+          ? event.turn_id
+          : null;
+        return turnId === null || !fences.has(turnId);
+      })
```

**File**: `webui/src/tests/app-layout.test.tsx` (modified, +1/-0)
```diff
@@ -265,6 +265,7 @@ vi.mock("@/lib/nanobot-client", async (importOriginal) => {
     };
     getRunStartedAt = () => null;
     getRunTurnId = () => null;
+    fenceCanonicalCompletedTurns = vi.fn();
     getGoalState = () => undefined;
     sendMessage = sendMessageSpy;
     newChat = vi.fn();
```

**File**: `webui/src/tests/thread-shell.test.tsx` (modified, +39/-0)
```diff
@@ -141,6 +141,11 @@ function makeClient() {
     getRunGeneration: (chatId: string) => runGenerationByChatId.get(chatId) ?? 0,
     canReconcileCanonicalCompletion,
     reconcileCanonicalCompletion,
+    fenceCanonicalCompletedTurns: (chatId: string, turnIds: readonly string[]) => {
+      const fences = completedTurnIdsByChatId.get(chatId) ?? new Set<string>();
+      for (const turnId of turnIds) fences.add(turnId);
+      completedTurnIdsByChatId.set(chatId, fences);
+    },
     getGoalState: (chatId: string) => goalStateByChatId.get(chatId),
     onChat: (chatId: string, handler: (ev: import("@/lib/types").InboundEvent) => void) => {
       let handlers = chatHandlers.get(chatId);
@@ -3173,6 +3178,40 @@ describe("ThreadShell", () => {
     expect(client.sendMessage).not.toHaveBeenCalled();
   });
 
+  it("remembers explicit completed turns on initial history load", async () => {
+    const client = makeClient();
+    const turnId = "turn-completed-before-load";
+    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
+      if (String(input).includes("websocket%3Ainitial-completion/webui-thread")) {
+        return httpJson({
+          ...transcriptFromSimpleMessages([
+            { role: "user", content: "previous question", turnId },
+          ]),
+          has_pending_tool_calls: false,
+          completed_turn_ids: [turnId],
+        });
+      }
+      return { ok: false, status: 404, json: async () => ({}) };
+    }));
+    render(wrap(client, <ThreadShell
+      session={session("initial-completion")}
+      title="Initial completion"
+      onToggleSidebar={() => {}}
+      onNewChat={() => {}}
+    />));
+    await screen.findByText("previous question");
+    act(() => client._emitChat("initial-completion", {
+      event: "goal_status", chat_id: "initial-completion", turn_id: turnId,
+      status: "running", started_at: 4_000,
+    }));
+    expect(screen.queryByRole("button", { name: "Stop response" })).not.toBeInTheDocument();
+    act(() => client._emitChat("initial-completion", {
+      event: "goal_status", chat_id: "initial-completion", turn_id: "new-turn",
+      status: "running", started_at: 5_000,
+    }));
+    expect(screen.getByRole("button", { name: "Stop response" })).toBeInTheDocument();
+  });
+
   it("fences websocket frames that arrive after canonical completion", async () => {
     const client = makeClient();
     const turnId = "turn-http-won";
```

**File**: `webui/src/tests/turn-completion.test.tsx` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
+import type { ReactNode } from "react";
+import { describe, expect, it, vi } from "vitest";
+
+import { ThreadComposer } from "@/components/thread/ThreadComposer";
+import { useNanobotStream } from "@/hooks/useNanobotStream";
+import { NanobotClient } from "@/lib/nanobot-client";
+import type { InboundEvent, UIMessage } from "@/lib/types";
+import { ClientProvider } from "@/providers/ClientProvider";
+
+class TestSocket {
+  readyState = 0;
+  onopen: (() => void) | null = null;
+  onmessage: ((event: MessageEvent) => void) | null = null;
+  onclose: (() => void) | null = null;
+  onerror: (() => void) | null = null;
+  send() {}
+  close() { this.readyState = 3; }
+  open() { this.readyState = 1; this.onopen?.(); }
+  receive(event: InboundEvent) {
+    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent);
+  }
+}
+
+const EMPTY_MESSAGES: UIMessage[] = [];
+const CHAT_ID = "completed-turn";
+const TURN_ID = "turn-1";
+
+function setup() {
+  const socket = new TestSocket();
+  const client = new NanobotClient({
+    url: "ws://test", reconnect: false,
+    socketFactory: () => socket as unknown as WebSocket,
+  });
+  client.connect();
+  socket.open();
+  const wrapper = ({ children }: { children: ReactNode }) => (
+    <ClientProvider client={client} token="test">{children}</ClientProvider>
+  );
+  const running: InboundEvent = {
+    event: "goal_status", chat_id: CHAT_ID, turn_id: TURN_ID,
+    status: "running", started_at: 1_700_000_000,
+  };
+  return { socket, client, wrapper, running };
+}
+
+describe("completed turn event ordering", () => {
+  it.each(["turn_end", "idle", "stop", "snapshot", "idle snapshot"] as const)(
+    "keeps %s terminal despite late lifecycle and ownership frames",
+    (terminal) => {
+      const { socket, client, wrapper, running } = setup();
+      const { result, unmount } = renderHook(
+        () => useNanobotStream(CHAT_ID, EMPTY_MESSAGES), { wrapper },
+      );
+      act(() => socket.receive(running));
+      act(() => {
+        if (terminal === "stop") result.current.stop();
+        else if (terminal === "snapshot") {
+          client.reconcileCanonicalCompletion(CHAT_ID, client.getRunGeneration(CHAT_ID), [TURN_ID]);
+        } else if (terminal === "idle snapshot") {
+          expect(client.reconcileCanonicalCompletion(CHAT_ID, client.getRunGeneration(CHAT_ID), [], {
+            observedTurnIds: [TURN_ID], hasPendingToolCalls: false, activeTurnId: null,
+          })).toBe(true);
+        } else socket.receive(terminal === "idle"
+          ? { event: "goal_status", chat_id: CHAT_ID, turn_id: TURN_ID, status: "idle" }
+          : { event: "turn_end", chat_id: CHAT_ID, turn_id: TURN_ID });
+      });
+      expect(result.current.isStreaming).toBe(false);
+
+      act(() => {
+        socket.receive(running);
+        socket.receive({
+          event: "user_message", chat_id: CHAT_ID, turn_id: TURN_ID,
+          text: "late original task", starts_turn: true,
+        });
+        socket.receive({
+          event: "user_message", chat_id: CHAT_ID, turn_id: "input-2",
+          text: "additional context", starts_turn: false,
+          active_turn_id: TURN_ID, started_at: 1_700_000_000,
+        });
+        socket.receive({
+          event: "message_accepted", chat_id: CHAT_ID, turn_id: "input-2",
+          starts_turn: false, active_turn_id: TURN_ID, started_at: 1_700_000_000,
+        });
+        socket.receive({ event: "stream_end", chat_id: CHAT_ID, turn_id: TURN_ID, text: "late" });
+      });
+      expect(result.current.isStreaming).toBe(false);
+      expect(result.current.runStartedAt).toBeNull();
+      expect(client.getRunStartedAt(CHAT_ID)).toBeNull();
+      expect(client.hasUnsettledRun(CHAT_ID)).toBe(false);
+      expect(result.current.messages.some((message) => message.content === "additional context")).toBe(true);
+
+      act(() => so
```

---

### Incident Patch 2: `450a85fe` (2026-09-30)
**Commit Message**: fix(webui): stop repairing completed Markdown

**File**: `webui/bun.lock` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@
         "remark-breaks": "^4.0.0",
         "remark-gfm": "^4.0.0",
         "remark-math": "^6.0.0",
+        "remend": "1.3.0",
         "streamdown": "2.5.0",
         "tailwind-merge": "^2.6.0",
       },
```

**File**: `webui/package.json` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@
     "remark-breaks": "^4.0.0",
     "remark-gfm": "^4.0.0",
     "remark-math": "^6.0.0",
+    "remend": "1.3.0",
     "streamdown": "2.5.0",
     "tailwind-merge": "^2.6.0"
   },
```

**File**: `webui/src/components/MarkdownText.tsx` (modified, +5/-2)
```diff
@@ -25,19 +25,22 @@ const MemoizedMarkdownRenderer = memo(function MemoizedMarkdownRenderer({
   className,
   highlightCode,
   streaming,
+  preserveStreamingLayout,
   onOpenFilePreview,
 }: {
   source: string;
   className?: string;
   highlightCode: boolean;
   streaming: boolean;
+  preserveStreamingLayout: boolean;
   onOpenFilePreview?: (path: string) => void;
 }) {
   return (
     <LazyMarkdownRenderer
       className={className}
       highlightCode={highlightCode}
       streaming={streaming}
+      preserveStreamingLayout={preserveStreamingLayout}
       onOpenFilePreview={onOpenFilePreview}
     >
       {source}
@@ -81,7 +84,6 @@ export function MarkdownText({
   const renderedSource = children;
   const renderPhase = streaming ? "streaming" : "complete";
   const highlightCode = !streaming;
-  const renderWithStreamingLayout = streaming || preserveStreamingLayout;
 
   useEffect(() => {
     if (streaming) void preloadMarkdownText();
@@ -106,7 +108,8 @@ export function MarkdownText({
           source={renderedSource}
           className={className}
           highlightCode={highlightCode}
-          streaming={renderWithStreamingLayout}
+          streaming={streaming}
+          preserveStreamingLayout={preserveStreamingLayout}
           onOpenFilePreview={onOpenFilePreview}
         />
       </Suspense>
```

**File**: `webui/src/components/MarkdownTextRenderer.tsx` (modified, +7/-4)
```diff
@@ -12,6 +12,7 @@ import remarkBreaks from "remark-breaks";
 import remarkGfm from "remark-gfm";
 import remarkMath from "remark-math";
 import { Streamdown, type Components, type StreamdownProps } from "streamdown";
+import remend from "remend";
 
 import { AttachmentTile } from "@/components/AttachmentTile";
 import { CodeBlock } from "@/components/CodeBlock";
@@ -42,6 +43,7 @@ interface MarkdownTextRendererProps {
   className?: string;
   highlightCode?: boolean;
   streaming?: boolean;
+  preserveStreamingLayout?: boolean;
   onOpenFilePreview?: (path: string) => void;
 }
 
@@ -530,6 +532,7 @@ export default function MarkdownTextRenderer({
   className,
   highlightCode = true,
   streaming = false,
+  preserveStreamingLayout = false,
   onOpenFilePreview,
 }: MarkdownTextRendererProps) {
   const { t } = useTranslation();
@@ -826,9 +829,8 @@ export default function MarkdownTextRenderer({
   return (
     <Streamdown
       key={needsMath && mathPlugin ? "math" : "text"}
-      mode={streaming ? "streaming" : "static"}
-      parseIncompleteMarkdown
-      remend={REMEND_OPTIONS}
+      mode={streaming || preserveStreamingLayout ? "streaming" : "static"}
+      parseIncompleteMarkdown={false}
       isAnimating={false}
       animated={false}
       linkSafety={DIRECT_LINKS}
@@ -851,7 +853,8 @@ export default function MarkdownTextRenderer({
         className,
       )}
     >
-      {children}
+      {/* Streamdown 2.5 ignores repair-option changes in its memo comparator. */}
+      {streaming ? remend(children, REMEND_OPTIONS) : children}
     </Streamdown>
   );
 }
```

**File**: `webui/src/tests/markdown-text-renderer.test.tsx` (modified, +24/-0)
```diff
@@ -516,6 +516,30 @@ describe("MarkdownTextRenderer", () => {
     expect(container.querySelector("[data-nanobot-stream-unit]")).not.toBeInTheDocument();
   });
 
+  it("stops repairing completed markdown without replacing the streaming layout", () => {
+    const source = "The old snip_history() / _legal_history_tail() path was removed.\n\nA real maintenance cost.";
+    const { container, rerender } = render(
+      <MarkdownTextRenderer streaming preserveStreamingLayout>{source}</MarkdownTextRenderer>,
+    );
+    const firstParagraph = container.querySelector("p");
+    expect(container.querySelector("p:last-child")?.textContent).toBe("A real maintenance cost._");
+
+    rerender(<MarkdownTextRenderer preserveStreamingLayout>{source}</MarkdownTextRenderer>);
+
+    expect(container.querySelector("p:last-child")?.textContent).toBe("A real maintenance cost.");
+    expect(container.querySelector("p")).toBe(firstParagraph);
+  });
+
+  it.each(["A literal trailing underscore_", "**unfinished emphasis", "_legal_history_tail()"])(
+    "preserves completed source syntax: %s",
+    (source) => {
+      const { container } = render(
+        <MarkdownTextRenderer preserveStreamingLayout>{source}</MarkdownTextRenderer>,
+      );
+      expect(container.textContent).toBe(source);
+    },
+  );
+
   it("repairs incomplete streaming markdown without exposing syntax fragments", () => {
     const { container, rerender } = render(
       <MarkdownTextRenderer streaming>{"**partial answer"}</MarkdownTextRenderer>,
```

---

### Incident Patch 3: `fc3effe3` (2026-09-30)
**Commit Message**: fix(cli): avoid duplicate WebUI config announcement (#5988)

**File**: `nanobot/cli/webui_support.py` (modified, +0/-1)
```diff
@@ -177,7 +177,6 @@ def _resolve_webui_config_path(config: str | None) -> Path:
         return get_config_path()
     config_path = Path(config).expanduser().resolve(strict=False)
     set_config_path(config_path)
-    console.print(f"[dim]Using config: {config_path}[/dim]")
     return config_path
 
 
```

**File**: `tests/cli/test_commands.py` (modified, +25/-0)
```diff
@@ -2197,6 +2197,7 @@ def test_webui_yes_creates_config_and_enables_local_websocket(
     )
 
     assert result.exit_code == 0, result.output
+    assert result.stdout.count("Using config:") == 1
     data = json.loads(config_file.read_text(encoding="utf-8"))
     websocket = data["channels"]["websocket"]
     assert websocket["enabled"] is True
@@ -2219,6 +2220,30 @@ def test_webui_yes_creates_config_and_enables_local_websocket(
     assert "stop_timeout" not in seen
 
 
+@pytest.mark.parametrize("explicit_config", [True, False])
+def test_webui_announces_existing_config_once(monkeypatch, tmp_path: Path, explicit_config: bool) -> None:
+    from nanobot.config import loader
+
+    config_file = tmp_path / "instance" / "config.json"
+    config = Config()
+    config.agents.defaults.workspace = str(tmp_path / "workspace")
+    loader.save_config(config, config_file)
+    default_config = tmp_path / "default" / "config.json" if explicit_config else config_file
+    monkeypatch.setattr(loader, "_current_config_path", default_config)
+    _patch_webui_provider_ready(monkeypatch)
+    _patch_gateway_ports_free(monkeypatch)
+    _patch_webui_managed_gateway(monkeypatch)
+
+    args = ["webui", "--yes", "--no-open"]
+    if explicit_config:
+        args.extend(["--config", str(config_file)])
+    result = runner.invoke(app, args)
+
+    assert result.exit_code == 0, result.output
+    assert result.stdout.count("Using config:") == 1
+    assert f"Using config: {config_file}" in _without_rendered_line_breaks(result.stdout)
+
+
 def test_webui_background_points_to_the_single_persistent_gateway_command(
     tmp_path: Path,
 ) -> None:
```

---

### Incident Patch 4: `7644d845` (2026-09-29)
**Commit Message**: fix(channels): preserve explicit compaction feedback and silent delivery

**File**: `docs/configuration.md` (modified, +3/-1)
```diff
@@ -1655,7 +1655,9 @@ Normal tool workspace and media access rules still apply to attachment paths.
 }
 ```
 
-QQ `showCompactionNotices` defaults to `false`. It controls the context-compaction lifecycle notices ("Compressing context…" / "Context compacted."). Telegram, Discord and WebSocket present that lifecycle as one in-place-updated message or status, but QQ's C2C/group message API has no edit or recall endpoint, so each phase would land as a separate permanent message; the QQ channel therefore drops the notices by default (#5784). Set `channels.qq.showCompactionNotices: true` to post them anyway:
+Automatic context-compaction notices are quiet by default in the built-in chat channels, including WeCom, Telegram and Discord. Compaction still runs, and WebUI/TUI structured status and history remain available. Manual `/compact` keeps its start and outcome feedback, including failure or cancellation. `sendProgress` remains independent of this policy.
+
+QQ `showCompactionNotices` defaults to `false`. Set `channels.qq.showCompactionNotices: true` to also post automatic compaction notices ("Compressing context…" / "Context compacted."). QQ's C2C/group message API has no edit or recall endpoint, so each phase lands as a separate permanent message. Manual `/compact` feedback is shown regardless of this setting:
 
 ```json
 {
```

**File**: `docs/memory.md` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ When a conversation grows large, nanobot summarizes the conversation covered by
 
 Compaction also runs after a configured period of inactivity, or when you send `/compact`. See [Auto Compact](./configuration.md#auto-compact) for idle timing and how to disable automatic idle compaction.
 
+Automatic compaction does not post lifecycle notices to built-in chat channels by default. This only silences chat messages: compaction still runs, and WebUI/TUI retain structured status and history. Manual `/compact` keeps its start and outcome feedback. QQ users can opt back into automatic notices with `channels.qq.showCompactionNotices: true`.
+
 This file is:
 
 - append-only
```

**File**: `nanobot/agent/turn_delivery.py` (modified, +1/-6)
```diff
@@ -67,12 +67,7 @@ def accepts(event_type: type[AgentEvent]) -> bool:
         )
 
     async def publish(event: AgentEvent) -> None:
-        # A maintenance result destination does not own the internal context.
-        if is_internal_session(session_key) and isinstance(event, ContextCompactionEvent):
-            return
-        if not notification_is_deliverable(
-            event, channel=channel, publish_lifecycle=route.publish_lifecycle,
-        ):
+        if not accepts(type(event)):
             return
         await bus.publish_event(
             event, channel=channel, chat_id=chat_id, metadata=deepcopy(metadata),
```

**File**: `nanobot/bus/notification_delivery.py` (modified, +1/-2)
```diff
@@ -33,10 +33,9 @@
 
 
 def notification_is_deliverable(
-    event: AgentEvent | type[AgentEvent], *, channel: str, publish_lifecycle: bool,
+    event_type: type[AgentEvent], *, channel: str, publish_lifecycle: bool,
 ) -> bool:
     """Admit operation notifications to a channel only by explicit policy."""
-    event_type = event if isinstance(event, type) else type(event)
     audience = NOTIFICATION_AUDIENCES.get(event_type)
     if audience is None:
         return False
```

**File**: `nanobot/channels/linear/tests/test_linear.py` (modified, +3/-1)
```diff
@@ -798,10 +798,12 @@ async def test_followups_only_repeat_issue_context_when_it_changes(tmp_path: Pat
 
 
 @pytest.mark.asyncio
+@pytest.mark.parametrize("notify", [False, True])
 @pytest.mark.parametrize("idle", [True, False])
 @pytest.mark.parametrize("phase", ["succeeded", "failed", "cancelled"])
 async def test_compaction_restores_issue_context_on_next_message(
     tmp_path: Path, idle: bool, phase: Literal["succeeded", "failed", "cancelled"],
+    notify: bool,
 ) -> None:
     channel, _ = _runtime(tmp_path)
     payload = _agent_webhook()
@@ -815,7 +817,7 @@ async def test_compaction_restores_issue_context_on_next_message(
     await channel.send(outbound_message_for_event(
         channel="linear", chat_id=inbound.chat_id,
         metadata={} if idle else inbound.metadata,
-        event=ContextCompactionEvent(compaction_id="compact", phase=phase, notify=True),
+        event=ContextCompactionEvent(compaction_id="compact", phase=phase, notify=notify),
     ))
     for delivery, include_context in (("after", phase == "succeeded"), ("again", False)):
         await channel._process_webhook(delivery, followup)  # pyright: ignore[reportPrivateUsage]
```

---

### Incident Patch 5: `0b402d04` (2026-09-29)
**Commit Message**: fix: stop sending context compaction notifications

**File**: `nanobot/agent/memory.py` (modified, +5/-2)
```diff
@@ -1245,6 +1245,7 @@ async def compact_idle_session(
         runtime: LLMRuntime,
         max_suffix: int = 0,
         events: EventSink = NO_EVENTS,
+        notify: bool = False,
     ) -> str | None:
         """Replace archived history with a summary checkpoint.
 
@@ -1267,7 +1268,7 @@ async def compact_idle_session(
 
             compaction_id = uuid4().hex
             await events.emit(
-                ContextCompactionEvent(compaction_id=compaction_id, phase="started"),
+                ContextCompactionEvent(compaction_id=compaction_id, phase="started", notify=notify),
             )
             last_active = session.updated_at
             archive_end = archive_start + len(messages_to_archive)
@@ -1288,19 +1289,21 @@ async def compact_idle_session(
                     ContextCompactionEvent(
                         compaction_id=compaction_id,
                         phase="cancelled" if isinstance(exc, asyncio.CancelledError) else "failed",
+                        notify=notify,
                     ),
                 )
                 raise
             if not summary:
                 await events.emit(
-                    ContextCompactionEvent(compaction_id=compaction_id, phase="failed"),
+                    ContextCompactionEvent(compaction_id=compaction_id, phase="failed", notify=notify),
                 )
                 return None
 
             await events.emit(
                 ContextCompactionEvent(
                     compaction_id=compaction_id,
                     phase="succeeded",
+                    notify=notify,
                 ),
             )
 
```

**File**: `nanobot/agent/turn_delivery.py` (modified, +6/-1)
```diff
@@ -67,7 +67,12 @@ def accepts(event_type: type[AgentEvent]) -> bool:
         )
 
     async def publish(event: AgentEvent) -> None:
-        if not accepts(type(event)):
+        # A maintenance result destination does not own the internal context.
+        if is_internal_session(session_key) and isinstance(event, ContextCompactionEvent):
+            return
+        if not notification_is_deliverable(
+            event, channel=channel, publish_lifecycle=route.publish_lifecycle,
+        ):
             return
         await bus.publish_event(
             event, channel=channel, chat_id=chat_id, metadata=deepcopy(metadata),
```

**File**: `nanobot/bus/notification_delivery.py` (modified, +2/-1)
```diff
@@ -33,9 +33,10 @@
 
 
 def notification_is_deliverable(
-    event_type: type[AgentEvent], *, channel: str, publish_lifecycle: bool,
+    event: AgentEvent | type[AgentEvent], *, channel: str, publish_lifecycle: bool,
 ) -> bool:
     """Admit operation notifications to a channel only by explicit policy."""
+    event_type = event if isinstance(event, type) else type(event)
     audience = NOTIFICATION_AUDIENCES.get(event_type)
     if audience is None:
         return False
```

**File**: `nanobot/channels/dingtalk/runtime.py` (modified, +3/-0)
```diff
@@ -21,6 +21,7 @@
 from nanobot.bus.queue import MessageBus
 from nanobot.channels.base import BaseChannel
 from nanobot.config.schema import Base
+from nanobot.events import ContextCompactionEvent
 from nanobot.security.network import validate_resolved_url, validate_url_target
 
 DINGTALK_MAX_REMOTE_MEDIA_BYTES = 20 * 1024 * 1024
@@ -735,6 +736,8 @@ async def _send_media_ref(self, token: str, chat_id: str, media_ref: str) -> boo
 
     async def send(self, msg: OutboundMessage) -> None:
         """Send a message through DingTalk."""
+        if isinstance(msg.event, ContextCompactionEvent) and not msg.event.notify:
+            return
         token = await self._get_access_token()
         if not token:
             raise RuntimeError("DingTalk access token unavailable")
```

**File**: `nanobot/channels/discord/runtime.py` (modified, +2/-0)
```diff
@@ -261,6 +261,8 @@ async def on_app_command_error(
         async def send_outbound(self, msg: OutboundMessage) -> None:
             """Send a nanobot outbound message using Discord transport rules."""
             compaction = msg.event if isinstance(msg.event, ContextCompactionEvent) else None
+            if compaction is not None and not compaction.notify:
+                return
             # A compaction's outcome replaces its own start notice in place, so
             # the lifecycle stays visible as one message instead of two (#5719).
             # Without a stored notice (restart, edit refused) it is sent as usual.
```

---

### Incident Patch 6: `fbe9b4fd` (2026-09-30)
**Commit Message**: fix(codex): avoid release-pinned model catalog filtering (#5984)

Co-authored-by: chengyongru <chengyongru.ai@gmail.com>

**File**: `nanobot/providers/openai_codex_provider.py` (modified, +2/-2)
```diff
@@ -52,8 +52,8 @@
 
 DEFAULT_CODEX_URL = "https://chatgpt.com/backend-api/codex/responses"
 DEFAULT_OPENAI_CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models"
-# The server gates model visibility by client version; older catalogs omit GPT-6 Sol/Luna.
-OPENAI_CODEX_CATALOG_CLIENT_VERSION = "0.158.0"
+# Avoid restricting model discovery to a pinned Codex client release.
+OPENAI_CODEX_CATALOG_CLIENT_VERSION = "99.99.99"
 DEFAULT_ORIGINATOR = "nanobot"
 _COMPACTION_RETAINED_CHAR_BUDGET = 256_000
 
```

---

### Incident Patch 7: `54d85059` (2026-09-30)
**Commit Message**: fix(tools): preserve PATH for argument-vector commands

**File**: `nanobot/agent/tools/shell.py` (modified, +5/-2)
```diff
@@ -475,8 +475,11 @@ def _prepare_command(
         effective_timeout = self._resolve_timeout(timeout)
         env = self._build_env()
 
-        if self.path_prepend or self.path_append:
-            if _IS_WINDOWS or isinstance(command, list):
+        if isinstance(command, list):
+            parent_path = os.environ.get("PATH", env.get("PATH", ""))
+            env["PATH"] = self._compose_path(parent_path)
+        elif self.path_prepend or self.path_append:
+            if _IS_WINDOWS:
                 env["PATH"] = self._compose_path(env.get("PATH", ""))
             else:
                 command = self._wrap_path_export(command, env)
```

**File**: `tests/tools/test_exec_platform.py` (modified, +24/-0)
```diff
@@ -6,6 +6,7 @@
 """
 
 import asyncio
+import os
 import shutil
 import sys
 from unittest.mock import AsyncMock, MagicMock, patch
@@ -103,6 +104,29 @@ def test_systemroot_forwarded(self, monkeypatch):
         assert env["SYSTEMROOT"] == r"D:\Windows"
 
 
+# ---------------------------------------------------------------------------
+# argument-vector PATH
+# ---------------------------------------------------------------------------
+
+class TestArgumentVectorPath:
+
+    def test_uses_parent_path_for_executable_lookup(self):
+        parent_path = os.pathsep.join(("parent-bin", "system-bin"))
+        with (
+            patch("nanobot.agent.tools.shell._IS_WINDOWS", False),
+            patch.dict(
+                "os.environ",
+                {"PATH": parent_path, "NANOBOT_SECRET_TOKEN": "super-secret-value"},
+                clear=True,
+            ),
+        ):
+            prepared = ExecTool()._prepare_command(["rg", "--version"])
+
+        assert not isinstance(prepared, str)
+        assert prepared.env["PATH"] == parent_path
+        assert "NANOBOT_SECRET_TOKEN" not in prepared.env
+
+
 # ---------------------------------------------------------------------------
 # _spawn
 # ---------------------------------------------------------------------------
```

---

### Incident Patch 8: `99ba062a` (2026-09-30)
**Commit Message**: fix(tui): accept goal requests during active turns (#5981)

* fix(tui): accept goal requests during active turns

* fix(goal): reuse live input routing and remove busy guards

* test(goal): cover followup streams across iteration budgets

* refactor(goal): expand slash commands into hidden agent input

* fix(goal): keep generated input permission scoped to users

* refactor(agent): encapsulate goal input permission scope

* refactor(goal): preserve task text without prompt wrapper

* test(goal): consolidate coverage and exercise restart recovery

* test(goal): wait for recovery reply without task registry race

**File**: `nanobot/agent/goal_permission.py` (modified, +39/-1)
```diff
@@ -2,9 +2,14 @@
 
 from __future__ import annotations
 
-from contextlib import contextmanager
+from collections.abc import Iterable
+from contextlib import ExitStack, contextmanager
 from contextvars import ContextVar
 
+from nanobot.bus.events import InboundMessage
+from nanobot.session.automation_turns import automation_history_overrides
+from nanobot.session.turn_continuation import internal_continuation_inbound
+
 _GOAL_MUTATION_ALLOWED: ContextVar[bool] = ContextVar(
     "nanobot_goal_mutation_allowed",
     default=False,
@@ -27,3 +32,36 @@ def goal_mutation_permission(allowed: bool):
         yield
     finally:
         _GOAL_MUTATION_ALLOWED.reset(token)
+
+
+class GoalInputScope(ExitStack):
+    """Own goal authorization for fresh inputs consumed during one agent run."""
+
+    def __init__(self, initial_message: InboundMessage | None = None) -> None:
+        super().__init__()
+        self._initial_message = initial_message
+
+    def __enter__(self) -> GoalInputScope:
+        super().__enter__()
+        self.enter_context(goal_mutation_permission(False))
+        if self._initial_message is not None:
+            self.consume_inputs((self._initial_message,))
+        return self
+
+    def consume_inputs(self, messages: Iterable[InboundMessage]) -> None:
+        """Authorize consumed user requests, never queued or replayed history."""
+        if any(self._authorizes(message) for message in messages):
+            self.enter_context(goal_mutation_permission(True))
+
+    @staticmethod
+    def _authorizes(message: InboundMessage) -> bool:
+        if (
+            not message.is_user_input
+            or message.channel == "system"
+            or message.sender_id == "subagent"
+            or internal_continuation_inbound(message.metadata)
+            or message.metadata.get("goal_requested") is not True
+        ):
+            return False
+        _, automation_metadata = automation_history_overrides(message.metadata)
+        return not automation_metadata
```

**File**: `nanobot/agent/loop.py` (modified, +28/-9)
```diff
@@ -25,6 +25,7 @@
 from nanobot.agent.autocompact import AutoCompact
 from nanobot.agent.context import ContextBuilder, PersistedPromptContextResolver, TranscriptInput
 from nanobot.agent.cron_turns import CronTurnCoordinator
+from nanobot.agent.goal_permission import GoalInputScope
 from nanobot.agent.hook import AgentHook, AgentTurnHookFactory
 from nanobot.agent.memory import Consolidator
 from nanobot.agent.model_runtime import ModelRuntimeResolver
@@ -50,7 +51,7 @@
 )
 from nanobot.bus.queue import MessageBus
 from nanobot.command import CommandContext, CommandRouter, register_builtin_commands
-from nanobot.command.router import normalize_command_text
+from nanobot.command.router import command_text, normalize_command_text
 from nanobot.config.schema import AgentDefaults, ModelPresetConfig
 from nanobot.events import NO_EVENTS, AgentEvent, EventSink
 from nanobot.llm_usage.context import source_from_request
@@ -682,6 +683,8 @@ def _persist_user_message_early(
         if has_text or media_paths or runtime_context_blocks:
             extra: dict[str, Any] = ({"media": list(media_paths)} if media_paths else {}) | agent_context.session_extra(msg.metadata)
             extra.update(kwargs)
+            if HIDDEN_HISTORY_META in msg.metadata:
+                extra[HIDDEN_HISTORY_META] = msg.metadata[HIDDEN_HISTORY_META]
             text = content_value if isinstance(content_value, str) else ""
             text_override, automation_extra = automation_history_overrides(msg.metadata)
             if text_override is not None:
@@ -768,7 +771,7 @@ async def _dispatch_command_inline(
         msg: InboundMessage,
         key: str,
         raw: str,
-        dispatch_fn: Callable[[CommandContext], Awaitable[OutboundMessage | None]],
+        dispatch_fn: Callable[[CommandContext], Awaitable[InboundMessage | OutboundMessage | None]],
     ) -> None:
         """Dispatch a command directly from the run() loop and publish the result."""
         if normalize_command_text(raw).lower() == "/compact":
@@ -777,9 +780,19 @@ async def _dispatch_command_inline(
             return
 
         async def dispatch_and_publish() -> None:
-            ctx = CommandContext(msg=msg, session=None, key=key, raw=raw, loop=self)
+            _, automation_metadata = automation_history_overrides(msg.metadata)
+            ctx = CommandContext(
+                msg=msg, session=None, key=key, raw=raw, loop=self,
+                is_user_turn=(
+                    msg.is_user_input and msg.channel != "system"
+                    and msg.sender_id != "subagent" and not automation_metadata
+                    and not turn_continuation.internal_continuation_inbound(msg.metadata)
+                ),
+            )
             result = await dispatch_fn(ctx)
-            if result:
+            if isinstance(result, InboundMessage):
+                self._enqueue_session_message(result)
+            elif result:
                 await self.bus.publish_outbound(result)
             else:
                 logger.warning("Command '{}' matched but dispatch returned None", raw)
@@ -921,7 +934,7 @@ def _can_inject_message(self, msg: InboundMessage) -> bool:
         ):
             return False
         return msg.channel == "system" or not self.commands.is_dispatchable_command(
-            msg.content.strip()
+            command_text(msg)
         )
 
     def _idle_events(
@@ -1038,6 +1051,8 @@ async def _to_user_message(pending_msg: InboundMessage) -> dict[str, Any]:
                     image_paths=image_paths,
                 )
                 row: dict[str, Any] = {"role": "user", "content": user_content}
+                if HIDDEN_HISTORY_META in pending_msg.metadata:
+                    row[HIDDEN_HISTORY_META] = pending_msg.metadata[HIDDEN_HISTORY_META]
                 metadata_value = cast(object, pending_msg.metadata)
                 metadata = (
                     pending_msg.metadata
@@ -1101,6 +1116,7 @@ async def _to_user_message(pendi
```

**File**: `nanobot/agent/runner.py` (modified, +2/-21)
```diff
@@ -684,10 +684,7 @@ async def end_length_segment(*, interrupted: bool) -> None:
             # Check for mid-turn injections BEFORE signaling stream end.
             # If injections are found we keep the stream alive (resuming=True)
             # so streaming channels don't prematurely finalize the card.
-            can_make_followup_request = (
-                iteration + 1 < spec.max_iterations
-                or spec.finalize_on_max_iterations
-            )
+            can_make_followup_request = iteration + 1 < spec.max_iterations
             should_continue, injection_cycles = await self._try_drain_injections(
                 spec, messages, assistant_message, injection_cycles,
                 conversation_state=conversation_state,
@@ -794,22 +791,8 @@ async def end_length_segment(*, interrupted: bool) -> None:
         else:
             stop_reason = "max_iterations"
             terminal_content = None
+            await end_length_segment(interrupted=False)
             if spec.finalize_on_max_iterations:
-                # The no-tools finalization is a real model boundary, so include
-                # exactly the inputs waiting before that request. Without this
-                # request, leave them in the session inbox for its worker.
-                drained_after_max_iterations, injection_cycles = (
-                    await self._try_drain_injections(
-                        spec,
-                        messages,
-                        None,
-                        injection_cycles,
-                        phase="before max-iterations finalization",
-                    )
-                )
-                if drained_after_max_iterations:
-                    had_injections = True
-                await end_length_segment(interrupted=drained_after_max_iterations)
                 terminal_content, usage = await self._try_finalize_after_max_iterations(
                     spec,
                     hook,
@@ -818,8 +801,6 @@ async def end_length_segment(*, interrupted: bool) -> None:
                     request_state=request_state,
                     round_usages=round_usages,
                 )
-            else:
-                await end_length_segment(interrupted=False)
             if terminal_content is None:
                 terminal_content = self._max_iterations_fallback(spec)
             if length_recovery_parts:
```

**File**: `nanobot/command/builtin.py` (modified, +19/-25)
```diff
@@ -14,9 +14,10 @@
 from loguru import logger
 
 from nanobot import __version__
-from nanobot.bus.events import INBOUND_META_USER_SHELL, OutboundMessage
+from nanobot.bus.events import INBOUND_META_USER_SHELL, InboundMessage, OutboundMessage
 from nanobot.command.router import CommandContext, CommandRouter, normalize_command_text
 from nanobot.providers.base import LLMUsage
+from nanobot.session.history_visibility import HIDDEN_HISTORY_META
 from nanobot.utils.helpers import build_status_content
 from nanobot.utils.restart import set_restart_notice_to_env
 from nanobot.utils.workspace_prompts import initialize_workspace_prompt
@@ -901,10 +902,8 @@ async def cmd_history(ctx: CommandContext) -> OutboundMessage:
     )
 
 
-async def cmd_goal(ctx: CommandContext) -> OutboundMessage | None:
-    """Mark this turn as an explicit sustained-goal request."""
-    from nanobot.agent.goal_permission import goal_mutation_permission
-
+async def cmd_goal(ctx: CommandContext) -> InboundMessage | OutboundMessage:
+    """Expand an explicit goal command into model-only input."""
     goal = ctx.args.strip()
     if not goal:
         return OutboundMessage(
@@ -913,16 +912,6 @@ async def cmd_goal(ctx: CommandContext) -> OutboundMessage | None:
             content="Usage: /goal <long-running task description>",
             metadata={**dict(ctx.msg.metadata or {}), "render_as": "text"},
         )
-    if ctx.session is None:
-        return OutboundMessage(
-            channel=ctx.msg.channel,
-            chat_id=ctx.msg.chat_id,
-            content=(
-                "A task is already running for this chat. "
-                "Use `/stop` first, then send `/goal <long-running task description>` again."
-            ),
-            metadata={**dict(ctx.msg.metadata or {}), "render_as": "text"},
-        )
     if not ctx.is_user_turn:
         return OutboundMessage(
             channel=ctx.msg.channel,
@@ -931,16 +920,21 @@ async def cmd_goal(ctx: CommandContext) -> OutboundMessage | None:
             metadata={**dict(ctx.msg.metadata or {}), "render_as": "text"},
         )
 
-    ctx.turn_scopes.append(goal_mutation_permission(True))
-    ctx.msg.metadata = {
-        **dict(ctx.msg.metadata or {}),
-        "original_command": "/goal",
-        "original_content": ctx.raw,
-        "goal_requested": True,
-        "goal_started_at": time.time(),
-    }
-    ctx.msg.content = ctx.raw
-    return None
+    session = ctx.session or ctx.loop.sessions.get_or_create(ctx.key)
+    session.add_message("user", ctx.msg.content, _command=True, media=list(ctx.msg.media))
+    ctx.loop.sessions.save(session)
+    return replace(
+        ctx.msg,
+        content=goal,
+        metadata={
+            **ctx.msg.metadata,
+            "original_command": "/goal",
+            "original_content": ctx.msg.content,
+            "goal_requested": True,
+            "goal_started_at": time.time(),
+            HIDDEN_HISTORY_META: {"kind": "goal_request"},
+        },
+    )
 
 
 async def cmd_pairing(ctx: CommandContext) -> OutboundMessage:
```

**File**: `nanobot/command/router.py` (modified, +11/-5)
```diff
@@ -8,18 +8,22 @@
 from difflib import get_close_matches
 from typing import TYPE_CHECKING, Any, Awaitable, Callable
 
-from nanobot.bus.events import OutboundMessage
+from nanobot.bus.events import InboundMessage, OutboundMessage
 
 if TYPE_CHECKING:
     from nanobot.agent.loop import AgentLoop
-    from nanobot.bus.events import InboundMessage
     from nanobot.session.manager import Session
     from nanobot.utils.llm_runtime import LLMRuntime
 
-Handler = Callable[["CommandContext"], Awaitable["OutboundMessage | None"]]
+Handler = Callable[["CommandContext"], Awaitable["InboundMessage | OutboundMessage | None"]]
 _BOT_SUFFIX_RE = re.compile(r"^[A-Za-z0-9_]+$")
 
 
+def command_text(message: InboundMessage) -> str:
+    """Return routable text; command-generated agent input must not be dispatched again."""
+    return "" if message.metadata.get("original_command") else message.content.strip()
+
+
 def normalize_command_text(text: str) -> str:
     """Normalize slash-command transport variants before routing.
 
@@ -99,16 +103,18 @@ def is_dispatchable_command(self, text: str) -> bool:
                 return True
         return cmd.startswith("/")
 
-    async def dispatch_priority(self, ctx: CommandContext) -> OutboundMessage | None:
+    async def dispatch_priority(self, ctx: CommandContext) -> InboundMessage | OutboundMessage | None:
         """Dispatch a priority command. Called from run() without the lock."""
         ctx.raw = normalize_command_text(ctx.raw)
         handler = self._priority.get(ctx.raw.lower())
         if handler:
             return await handler(ctx)
         return None
 
-    async def dispatch(self, ctx: CommandContext) -> OutboundMessage | None:
+    async def dispatch(self, ctx: CommandContext) -> InboundMessage | OutboundMessage | None:
         """Try exact and prefix handlers, then reject invalid slash commands."""
+        if ctx.msg.metadata.get("original_command"):
+            return None
         ctx.raw = normalize_command_text(ctx.raw)
         cmd = ctx.raw.lower()
 
```

---

### Incident Patch 9: `663ba82f` (2026-09-29)
**Commit Message**: fix(providers): honor configured fallbacks on "insufficient credits"

An OpenAI-compatible gateway can report exhausted credits as HTTP 400 with
the message "You have insufficient credits to make this request". The
arrearage marker lists cover "insufficient_quota", "insufficient balance"
and "out of credits", but not "insufficient credits", so
is_arrearage_response() returned False and _should_fallback() fell through
to its blanket HTTP-400 short-circuit. Configured fallbackModels were then
silently skipped and the raw provider error was returned to the user.

Add the missing phrasing to both the text-marker tuple and the structured
token frozenset. Arrearage detection already runs first inside
_should_fallback(), so recognizing the phrasing is enough to restore
failover; a plain malformed-request 400 keeps its existing non-fallback
behavior.

Refs #5967

**File**: `nanobot/providers/base.py` (modified, +3/-0)
```diff
@@ -665,6 +665,7 @@ class LLMProvider(ABC):
         "quota_exhausted",
         "billing_hard_limit_reached",
         "insufficient_balance",
+        "insufficient_credits",
         "credit_balance_too_low",
         "billing_not_active",
         "payment_required",
@@ -687,6 +688,8 @@ class LLMProvider(ABC):
         "billing not active",
         "insufficient balance",
         "insufficient_balance",
+        "insufficient credits",
+        "insufficient_credits",
         "credit balance too low",
         "payment required",
         "out of credits",
```

**File**: `tests/agent/test_runner_fallback.py` (modified, +50/-0)
```diff
@@ -1458,6 +1458,56 @@ async def test_non_retryable_quota_tries_configured_fallback(self) -> None:
         assert result.content == "fallback ok"
         factory.assert_called_once_with(fallback_preset)
 
+    @pytest.mark.asyncio
+    async def test_insufficient_credits_on_400_tries_configured_fallback(self) -> None:
+        """Some OpenAI-compatible gateways report exhausted credits as HTTP 400."""
+        arrearage = _make_response(
+            "[400]: You have insufficient credits to make this request.",
+            finish_reason="error",
+            error_status_code=400,
+            error_code="BAD_REQUEST",
+            error_type="invalid_request_error",
+            error_should_retry=False,
+        )
+        primary = _FakeProvider("primary", arrearage)
+        fallback = _FakeProvider("fallback", _make_response("fallback ok"))
+        fallback_preset = _fallback("fallback-a")
+        factory = MagicMock(return_value=fallback)
+        fb = FallbackProvider(
+            primary=primary,
+            fallback_presets=[fallback_preset],
+            provider_factory=factory,
+        )
+
+        result = await fb.chat(messages=[{"role": "user", "content": "hi"}])
+
+        assert result.content == "fallback ok"
+        factory.assert_called_once_with(fallback_preset)
+
+    @pytest.mark.asyncio
+    async def test_plain_bad_request_still_does_not_fall_back(self) -> None:
+        """A 400 with no billing semantics stays non-fallbackable."""
+        bad_request = _make_response(
+            "invalid parameter: temperature must be <= 2",
+            finish_reason="error",
+            error_status_code=400,
+            error_code="BAD_REQUEST",
+            error_type="invalid_request_error",
+            error_should_retry=False,
+        )
+        primary = _FakeProvider("primary", bad_request)
+        factory = MagicMock()
+        fb = FallbackProvider(
+            primary=primary,
+            fallback_presets=[_fallback("fallback-a")],
+            provider_factory=factory,
+        )
+
+        result = await fb.chat(messages=[{"role": "user", "content": "hi"}])
+
+        assert result is bad_request
+        factory.assert_not_called()
+
     @pytest.mark.asyncio
     async def test_without_fallback_presets_returns_original_error(self) -> None:
         arrearage = _make_response(
```

---

### Incident Patch 10: `66f5f2df` (2026-09-29)
**Commit Message**: fix(my): scope subagent snapshots to the current session (#5976)

* fix(my): scope subagent snapshots to the current session

* test(my): reuse runtime fixture in session isolation checks

**File**: `docs/my-tool.md` (modified, +5/-0)
```diff
@@ -160,6 +160,11 @@ Agent: I've used ~53k tokens total so far. I'll keep my remaining replies concis
 
 ### "Subagent monitoring"
 
+Subagent snapshots include only tasks created by the current session. This scope
+also applies to `subagents._task_statuses.<task_id>` and nested fields. Without a
+current session key, direct subagent checks return an error and the full overview
+contains no tasks. Completed tasks are removed; this is not a result archive.
+
 ```text
 Agent: Let me check on the background tasks.
 → my(action="check", key="subagents")
```

**File**: `nanobot/agent/subagent.py` (modified, +11/-0)
```diff
@@ -169,6 +169,17 @@ def runtime_statuses(self) -> Mapping[str, SubagentStatus]:
         """Return the observable task statuses used by runtime-control snapshots."""
         return self._task_statuses
 
+    def statuses_for_session(self, session_key: str | None) -> Mapping[str, SubagentStatus]:
+        """Return only tasks owned by the given session, never a global fallback."""
+        if not session_key:
+            return {}
+        task_ids = self._session_tasks.get(session_key, set())
+        return {
+            task_id: status
+            for task_id, status in self._task_statuses.items()
+            if task_id in task_ids
+        }
+
     def set_provider(self, provider: LLMProvider, model: str) -> None:
         """Update the deprecated runtime source used by legacy ``spawn`` calls."""
         warnings.warn(
```

**File**: `nanobot/agent/tools/runtime_control.py` (modified, +3/-1)
```diff
@@ -7,6 +7,8 @@
 from pathlib import Path
 from typing import TYPE_CHECKING, Protocol, TypeAlias, runtime_checkable
 
+from nanobot.agent.tools.context import current_request_session_key
+
 if TYPE_CHECKING:
     from nanobot.agent.subagent import SubagentManager, SubagentStatus
     from nanobot.agent.tools.shell import ExecToolConfig
@@ -268,7 +270,7 @@ def _snapshot_subagent_statuses(
 ) -> dict[str, dict[str, object]]:
     return {
         task_id: _snapshot_subagent_status(status)
-        for task_id, status in manager.runtime_statuses().items()
+        for task_id, status in manager.statuses_for_session(current_request_session_key()).items()
     }
 
 
```

**File**: `nanobot/agent/tools/self.py` (modified, +4/-0)
```diff
@@ -393,6 +393,10 @@ def _current_runtime_value(self, key: str) -> tuple[bool, Any]:
     def _inspect(self, key: str | None) -> str:
         if not key:
             return self._inspect_all()
+        if key == "subagents" or key.startswith("subagents."):
+            request_ctx = current_request_context()
+            if request_ctx is None or not request_ctx.session_key:
+                return ToolResult.error("Error: current session context is unavailable")
         if key == "request" or key.startswith("request."):
             request_ctx = current_request_context()
             if request_ctx is None:
```

**File**: `tests/agent/tools/test_runtime_control.py` (modified, +71/-0)
```diff
@@ -8,6 +8,7 @@
 import pytest
 
 from nanobot.agent.loop import AgentLoop
+from nanobot.agent.tools.context import RequestContext, request_context
 from nanobot.agent.tools.runtime_control import (
     RUNTIME_COMMAND_KEYS,
     RUNTIME_SNAPSHOT_KEYS,
@@ -17,6 +18,8 @@
 from nanobot.agent.tools.self import MyTool, MyToolConfig
 from nanobot.bus.queue import MessageBus
 from nanobot.config.schema import ToolsConfig
+from nanobot.providers.base import GenerationSettings
+from nanobot.utils.llm_runtime import LLMRuntime
 
 
 def _make_loop(tmp_path: Path, *, allow_set: bool = False) -> AgentLoop:
@@ -237,3 +240,71 @@ async def test_workspace_display_command_cannot_change_path_enforcement(tmp_path
     assert tool._runtime_control.snapshot().workspace == "elsewhere"
     assert loop.workspace == tmp_path
     assert loop.workspace_scopes.default_workspace == tmp_path
+
+
+@pytest.fixture
+def runtime() -> LLMRuntime:
+    return LLMRuntime(MagicMock(), "test", GenerationSettings(), 128_000)
+
+
+@pytest.mark.parametrize("key", [None, "subagents", "subagents._task_statuses"])
+async def test_my_subagent_snapshot_is_session_scoped(tmp_path, key, runtime):
+    loop = _make_loop(tmp_path)
+    manager = loop.subagents
+    # Spawn without yielding to the child runner: queued tasks must be scoped too.
+    await manager.spawn("ALPHA_PRIVATE_TASK", label="ALPHA_LABEL", session_key="owner:a", runtime=runtime)
+    await manager.spawn("BETA_PRIVATE_TASK", label="BETA_LABEL", session_key="owner:b", runtime=runtime)
+    try:
+        tool = _my_tool(loop)
+        with request_context(RequestContext("test", "same-chat", session_key="owner:a")):
+            snapshot = tool._runtime_control.snapshot()
+            assert len(snapshot.subagent_statuses) == 1
+            assert "BETA" not in repr(snapshot.as_mapping())
+            result = await tool.execute(action="check", key=key)
+            assert "ALPHA_LABEL" in result
+            assert "BETA" not in result
+        with request_context(RequestContext("test", "same-chat", session_key="owner:b")):
+            result = await tool.execute(action="check", key=key)
+            assert "BETA_LABEL" in result
+            assert "ALPHA" not in result
+    finally:
+        await manager.close()
+
+
+@pytest.mark.parametrize("field", ["", ".task_description", ".tool_events", ".usage"])
+async def test_my_rejects_other_sessions_task_paths(tmp_path, field, runtime):
+    loop = _make_loop(tmp_path)
+    manager = loop.subagents
+    await manager.spawn("PRIVATE_TASK", session_key="owner:a", runtime=runtime)
+    try:
+        task_id = next(iter(manager.statuses_for_session("owner:a")))
+        tool = _my_tool(loop)
+        with request_context(RequestContext("test", "same-chat", session_key="owner:a")):
+            detail = await tool.execute(action="check", key=f"subagents._task_statuses.{task_id}")
+            assert "PRIVATE_TASK" in detail
+        with request_context(RequestContext("test", "same-chat", session_key="owner:b")):
+            result = await tool.execute(
+                action="check", key=f"subagents._task_statuses.{task_id}{field}",
+            )
+            assert result.startswith("Error:")
+            assert "PRIVATE_TASK" not in result
+    finally:
+        await manager.close()
+
+
+@pytest.mark.parametrize("session_key", [None, ""])
+async def test_my_without_session_cannot_enumerate_tasks(tmp_path, session_key, runtime):
+    loop = _make_loop(tmp_path)
+    manager = loop.subagents
+    await manager.spawn("PRIVATE_TASK", session_key="owner:a", runtime=runtime)
+    try:
+        tool = _my_tool(loop)
+        assert tool._runtime_control.snapshot().subagent_statuses == {}
+        assert "PRIVATE_TASK" not in await tool.execute(action="check")
+        assert "unavailable" in await tool.execute(action="check", key="subagents")
+        with request_context(RequestContext("test", "same-chat", session_key=session_key)):
+            assert tool._run
```

#### Recent Merged Pull Requests:
- **PR #5996** (2026-09-30): docs: streamline project instructions and engineering constraints (@chengyongru)
- **PR #5993** (closed): refactor(agent): scope tool resources to session cancellation (@chengyongru)
- **PR #5991** (2026-09-30): fix(webui): keep completed turns terminal across late events (@chengyongru)
- **PR #5989** (2026-09-30): fix(webui): stop repairing completed Markdown (@chengyongru)
- **PR #5988** (2026-09-30): fix(cli): avoid duplicate WebUI config announcement (@chengyongru)
- **PR #5986** (2026-09-30): fix(tools): preserve PATH for argument-vector commands (@chengyongru)
- **PR #5984** (2026-09-30): fix(codex): avoid release-pinned model catalog filtering (@Fatih0234)
- **PR #5982** (2026-09-30): Correct misleading Taiwanese WebUI messages (@PeterDaveHello)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
