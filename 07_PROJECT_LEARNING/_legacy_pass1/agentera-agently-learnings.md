# Forensic Learning Record (Deep Inspection): AgentEra/Agently

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentera-agently-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AgentEra/Agently](https://github.com/AgentEra/Agently))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:13:06.476Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AgentEra/Agently`
- **Description**: [GenAI Application Development Framework]  🚀 Build GenAI application quick and easy 💬 Easy to interact with GenAI agent in code using structure data and chained-calls syntax 🧩 Use Event-Driven Flow *TriggerFlow* to manage complex GenAI working logic 🔀 Switch to any model without rewrite application code
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1654 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agently/__init__.py`
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

from .base import print_, async_print, AgentlyMain, Agent
from ._version import __version__
from .core.model.AudioModelRequest import AudioModelRequest
from .types.data.audio import (
    AudioCapabilityError, AudioConnection, AudioFormat, AudioInput, AudioOperation, AudioProtocolError,
    PCMFormat, SpeechOptions, SpeechRequest, SpeechResult, TranscriptEvent, TranscriptResult,
    PCMStream, TextSource, TextSegmentOptions, TranscriptionStreamOptions, TranscriptBlock, TranscriptSegment,
    TranscriptionOptions, TranscriptionRequest,
)
from .types.plugins.AudioModelRequester import AudioCapability, AudioModelRequester, TextSegmenter
from .core import (
    AgentTask,
    TaskContext,
    TaskWorkspace,
    TriggerFlow,
    TriggerFlowBlueprint,
)
from .types.data import (
    LongContent,
    AgentExecutionStreamData,
    AgentExecutionStreamHandler,
    AgentlyModelResultEvent,
    AgentlyModelResultMessage,
    AgentlyOriginalResultPayload,
    AgentlySpecificResultMessage,
    AgentlyResultGenerator,
    EventHook,
    ModelStreamingHandler,
    ObservationEvent,
    ObservationEventHook,
    RuntimeEvent,
    RuntimeEventHook,
    ResultContentType,
    SpecificEvents,
    SkillRuntimeStreamHandler,
    SkillRuntimeStreamItem,
    StreamingData,
)
from .types.trigger_flow import (
    TriggerFlowContractSpec,
    TriggerFlowEventData,
    TriggerFlowIntervention,
    TriggerFlowInterventionEvent,
    TriggerFlowInterruptEvent,
    TriggerFlowRuntimeData,
    TriggerFlowSystemStreamEvent,
)

Agently = AgentlyMain()

__all__ = [
    "LongContent",
    "Agently",
    "__version__",
    "Agent",
    "AgentTask",
    "TaskContext",
    "TaskWorkspace",
    "TriggerFlow",
    "TriggerFlowContractSpec",
    "TriggerFlowRuntimeData",
    "TriggerFlowEventData",
    "TriggerFlowIntervention",
    "TriggerFlowInterventionEvent",
    "TriggerFlowInterruptEvent",
    "TriggerFlowSystemStreamEvent",
    "TriggerFlowBlueprint",
    "StreamingData",
    "AgentExecutionStreamData",
    "AgentlyModelResultEvent",
    "AgentlyModelResultMessage",
    "AgentlySpecificResultMessage",
    "AgentlyOriginalResultPayload",
    "AgentlyResultGenerator",
    "ResultContentType",
    "SpecificEvents",
    "ModelStreamingHandler",
    "AgentExecutionStreamHandler",
    "SkillRuntimeStreamItem",
    "SkillRuntimeStreamHandler",
    "RuntimeEvent",
    "ObservationEvent",
    "EventHook",
    "RuntimeEventHook",
    "ObservationEventHook",
    "print_",
    "async_print",
    "AudioModelRequest",
    "AudioModelRequester",
    "AudioCapability",
    "AudioCapabilityError",
    "AudioConnection",
    "AudioFormat",
    "AudioInput",
    "AudioOperation",
    "AudioProtocolError",
    "PCMFormat",
    "PCMStream",
    "TextSource",
    "TextSegmentOptions",
    "TextSegmenter",
    "TranscriptionStreamOptions",
    "TranscriptBlock",
    "TranscriptSegment",
    "SpeechOptions",
    "SpeechRequest",
    "SpeechResult",
    "TranscriptEvent",
    "TranscriptResult",
    "TranscriptionOptions",
    "TranscriptionRequest",
]

```

### Core Architecture Module: `agently/_default_init.py`
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

from pathlib import Path

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agently.core import PluginManager, EventCenter
    from agently.utils import Settings


def _load_default_plugins(plugin_manager: "PluginManager"):
    from agently.builtins.plugins.AudioModelRequester import OpenAICompatible as AudioHTTP, OMLX

    plugin_manager.register("AudioModelRequester", AudioHTTP, activate=False)
    plugin_manager.register("AudioModelRequester", OMLX, activate=False)
    from agently.builtins.plugins.ActionFlow import DAGActionFlow, TriggerFlowActionFlow
    from agently.builtins.plugins.ActionRuntime import AgentlyActionRuntime
    from agently.builtins.plugins.ActionExecutor import (
        BashSandboxActionExecutor,
        ShellActionExecutor,
        BrowseActionExecutor,
        CodeExecutionActionExecutor,
        DockerActionExecutor,
        LocalFunctionActionExecutor,
        MCPActionExecutor,
        ProgrammaticActionExecutor,
        SQLiteActionExecutor,
        SearchActionExecutor,
    )
    from agently.builtins.plugins.ExecutionResourceProvider import (
        ACPExecutionResourceProvider,
        BashExecutionResourceProvider,
        ShellProvider,
        BrowserExecutionResourceProvider,
        DockerExecutionResourceProvider,
        GVisorDockerExecutionResourceProvider,
        LandlockExecutionResourceProvider,
        SeatbeltExecutionResourceProvider,
        MCPExecutionResourceProvider,
        SQLiteExecutionResourceProvider,
        TrustedLocalExecutionResourceProvider,
    )

    plugin_manager.register("ActionRuntime", AgentlyActionRuntime)
    plugin_manager.register("ActionFlow", TriggerFlowActionFlow)
    plugin_manager.register("ActionFlow", DAGActionFlow, activate=False)
    plugin_manager.register("ActionExecutor", LocalFunctionActionExecutor, activate=False)
    plugin_manager.register("ActionExecutor", MCPActionExecutor, activate=False)
    plugin_manager.register("ActionExecutor", BashSandboxActionExecutor, activate=False)
    plugin_manager.register("ActionExecutor", ShellActionExecutor, activate=False)
    plugin_manager.register("ActionExecutor", SearchActionExecutor, activate=False)
    plugin_manager.register("ActionExecutor", BrowseActionExecutor, activate=False)
    plugin_manager.register("ActionExecutor", CodeExecutionActionExecutor, activate=False)
    plugin_manager.register("ActionExecutor", ProgrammaticActionExecutor, activate=False)
    plugin_manager.register("ActionExecutor", DockerActionExecutor, activate=False)
    plugin_manager.register("ActionExecutor", SQLiteActionExecutor, activate=False)
    plugin_manager.register("ExecutionResourceProvider", ACPExecutionResourceProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", MCPExecutionResourceProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", BashExecutionResourceProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", ShellProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", DockerExecutionResourceProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", GVisorDockerExecutionResourceProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", LandlockExecutionResourceProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", SeatbeltExecutionResourceProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", BrowserExecutionResourceProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", SQLiteExecutionResourceProvider, activate=False)
    plugin_manager.register("ExecutionResourceProvider", TrustedLocalExecutionResourceProvider, activate=False)

    from agently.builtins.plugins.SkillSourceProvider import (
        GitSkillSourceProvider,
        LocalPathSkillSourceProvider,
    )

    plugin_manager.register("SkillSourceProvider", LocalPathSkillSourceProvider, activate=False)
    plugin_manager.register("SkillSourceProvider", GitSkillSourceProvider, activate=False)

    from agently.builtins.plugins.CodeRuntimeAdapter import (
        CppCodeRuntimeAdapter,
        GoCodeRuntimeAdapter,
        NodeCodeRuntimeAdapter,
        PythonCodeRuntimeAdapter,
    )

    plugin_manager.register("CodeRuntimeAdapter", PythonCodeRuntimeAdapter, activate=False)
    plugin_manager.register("CodeRuntimeAdapter", NodeCodeRuntimeAdapter, activate=False)
    plugin_manager.register("CodeRuntimeAdapter", GoCodeRuntimeAdapter, activate=False)
    plugin_manager.register("CodeRuntimeAdapter", CppCodeRuntimeAdapter, activate=False)

    from agently.builtins.plugins.PromptGenerator.AgentlyPromptGenerator import (
        AgentlyPromptGenerator,
    )

    plugin_manager.register("PromptGenerator", AgentlyPromptGenerator)

    from agently.builtins.plugins.TaskDAGPlanner import (
        AgentlyTaskDAGPlanner,
    )

    plugin_manager.register("TaskDAGPlanner", AgentlyTaskDAGPlanner)

    from agently.builtins.plugins.Blocks import AgentlyBlocks

    plugin_manager.register("Blocks", AgentlyBlocks)

    from agently.builtins.plugins.AgentExecution import (
        AgentExecution, RequestExecution, LongTaskExecution, PlanExecution, LongContentExecution,
    )

    plugin_manager.register("AgentExecution", AgentExecution)
    for execution_class in (RequestExecution, LongTaskExecution, PlanExecution, LongContentExecution):
        plugin_manager.register("AgentExecution", execution_class, activate=False)

    from agently.builtins.plugins.AgentOrchestrator import AgentlyAgentOrchestrator

    plugin_manager.register("AgentOrchestrator", AgentlyAgentOrchestrator)

    from agently.builtins.plugins.ModelRequester.OpenAICompatible import (
        OpenAICompatible,
    )
    from agently.builtins.plugins.ModelRequester.AnthropicCompatible import (
        AnthropicCompatible,
    )
    from agently.builtins.plugins.ModelRequester.OpenAIResponsesCompatible import (
        OpenAIResponsesCompatible,
    )

    plugin_manager.register(
        "ModelRequester",
        OpenAICompatible,
        activate=True,
    )
    plugin_manager.register(
        "ModelRequester",
        AnthropicCompatible,
        activate=False,
    )
    plugin_manager.register(
        "ModelRequester",
        OpenAIResponsesCompatible,
        activate=False,
    )

    from agently.builtins.plugins.ResponseParser.AgentlyResponseParser import AgentlyResponseParser

    plugin_manager.register("ResponseParser", AgentlyResponseParser)

    from agently.builtins.plugins.SessionMemory import AgentlyMemory

    plugin_manager.register("SessionMemory", AgentlyMemory)


def _load_default_settings(settings: "Settings"):
    settings.load("yaml_file", f"{str(Path(__file__).resolve().parent)}/_default_settings.yaml")


def _hook_default_event_handlers(event_center: "EventCenter"):
    from agently.builtins.hookers.RuntimeConsoleSinkHooker import RuntimeConsoleSinkHooker

    event_center.register_hooker_plugin(RuntimeConsoleSinkHooker)

    from agently.builtins.hookers.RuntimeStorageSinkHooker import RuntimeStorageSinkHooker

    event_center.register_hooker_plugin(RuntimeStorageSinkHooker)


def _load_default_actions(_):
    return None

```

### Core Architecture Module: `agently/_version.py`
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

__version__: str = "4.1.4.8"

```

### Core Architecture Module: `agently/base.py`
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

import logging
from collections.abc import Mapping
from typing import Any, Literal, Type, TYPE_CHECKING, TypeVar, Generic, cast

from agently.builtins.hookers.RuntimeConsoleSinkHooker import coerce_runtime_log_profile
from agently._version import __version__ as package_version
from agently.utils import DeprecationWarnings, LazyImport, Settings, create_logger
from agently.utils.RequestScheduler import RequestScheduler
from agently.core import (
    Action,
    DynamicTask,
    ExecutionExchangeManager,
    ExecutionResourceManager,
    PolicyApprovalManager,
    PluginManager,
    EventCenter,
    TriggerFlow,
    Prompt,
    ModelRequest,
    AudioModelRequest,
    BaseAgent,
    Blocks,
    SkillsExecutor,
    SkillLibrary,
)
from agently.core.storage import RecordStoreRegistry
from agently._default_init import (
    _load_default_actions,
    _load_default_settings,
    _load_default_plugins,
    _hook_default_event_handlers,
)

if TYPE_CHECKING:
    from agently.types.data import RuntimeEventLevel, SerializableValue, TaskDAG
    from agently.builtins.hookers.RuntimeConsoleSinkHooker import RuntimeLogProfile

# Basic Initialize

_SETTINGS_VALUE_UNSET = object()

settings: Settings = Settings(
    name="global_settings",
)
_load_default_settings(settings)
plugin_manager: PluginManager = PluginManager(
    settings,
    name="global_plugin_manager",
)
_load_default_plugins(plugin_manager)
event_center: EventCenter = EventCenter()
_hook_default_event_handlers(event_center)
async_emit_observation: Any = event_center.async_emit
emit_observation: Any = event_center.emit
async_emit_runtime: Any = event_center.async_emit
emit_runtime: Any = event_center.emit
logger: Any = create_logger()
httpx_level_name = settings.get("runtime.httpx_log_level", "WARNING")
httpx_level = getattr(logging, str(httpx_level_name).upper(), logging.WARNING)
logging.getLogger("httpx").setLevel(httpx_level)
logging.getLogger("httpcore").setLevel(httpx_level)
action: Action = Action(plugin_manager, settings)
tool: Action = action
execution_resource: ExecutionResourceManager = ExecutionResourceManager(
    plugin_manager=plugin_manager,
    settings=settings,
    event_center=event_center,
)
policy_approval: PolicyApprovalManager = PolicyApprovalManager(
    settings=settings,
    event_center=event_center,
)
execution_exchange: ExecutionExchangeManager = ExecutionExchangeManager(
    settings=settings,
    event_center=event_center,
)
request_scheduler: RequestScheduler = RequestScheduler()
action_registry: Any = action.action_registry
_load_default_actions(action_registry)
action_dispatcher: Any = action.action_dispatcher
action_runtime: Any = action.action_runtime
action_flow: Any = action.action_flow
skill_library: SkillLibrary = SkillLibrary(
    str(settings.get("skills.library.root", ".agently/skill-library")),
    plugin_manager=plugin_manager,
)
skills_executor: SkillsExecutor = SkillsExecutor(
    plugin_manager,
    settings,
    library=skill_library,
)
blocks: Blocks = Blocks(plugin_manager, settings)
# Private persistence construction registry. It is not part of the Agently
# application facade and will be replaced by concrete store ports.
record_store_registry: RecordStoreRegistry = RecordStoreRegistry()
_agently_emitter: Any = event_center.create_emitter("Agently")


def print_(content: Any, *args: Any) -> None:
    contents = [str(content)]
    if args:
        for arg in args:
            contents.append(str(arg))
    content_text = " ".join(contents)
    _agently_emitter.info(content_text, event_type="runtime.print")


async def async_print(content: Any, *args: Any) -> None:
    contents = [str(content)]
    if args:
        for arg in args:
            contents.append(str(arg))
    content_text = " ".join(contents)
    await _agently_emitter.async_info(content_text, event_type="runtime.print")


def _apply_debug_profile(
    target_settings: Settings,
    value: "SerializableValue",
    *,
    auto_load_env: bool = False,
    raise_empty: bool = False,
) -> "RuntimeLogProfile":
    if auto_load_env:
        value = Settings._substitute_env_placeholder(value, raise_empty=raise_empty)
    normalized = coerce_runtime_log_profile(value)
    target_settings.set_settings("debug", normalized)
    target_settings.set("debug", normalized)
    return normalized


# Settings Mappings

settings.update_mappings(
    {
        "path_mappings": {
            "agently_api_key": "agently.api_key",
        },
        "key_value_mappings": {
            "debug": {
                "simple": {
                    "runtime.show_model_logs": "simple",
                    "runtime.show_action_logs": "simple",
                    "runtime.show_tool_logs": "simple",
                    "runtime.show_trigger_flow_logs": "simple",
                    "runtime.show_runtime_logs": "simple",
                    "runtime.httpx_log_level": "WARNING",
                },
                "detail": {
                    "runtime.show_model_logs": "detail",
                    "runtime.show_action_logs": "detail",
                    "runtime.show_tool_logs": "detail",
                    "runtime.show_trigger_flow_logs": "detail",
                    "runtime.show_runtime_logs": "detail",
                    "runtime.httpx_log_level": "INFO",
                },
                "off": {
                    "runtime.show_model_logs": "off",
                    "runtime.show_action_logs": "off",
                    "runtime.show_tool_logs": "off",
                    "runtime.show_trigger_flow_logs": "off",
                    "runtime.show_runtime_logs": "off",
                    "runtime.httpx_log_level": "WARNING",
                },
                True: {
                    "runtime.show_model_logs": "simple",
                    "runtime.show_action_logs": "simple",
                    "runtime.show_tool_logs": "simple",
                    "runtime.show_trigger_flow_logs": "simple",
                    "runtime.show_runtime_logs": "simple",
                    "runtime.httpx_log_level": "WARNING",
                },
                False: {
                    "runtime.show_model_logs": "off",
                    "runtime.show_action_logs": "off",
                    "runtime.show_tool_logs": "off",
                    "runtime.show_trigger_flow_logs": "off",
                    "runtime.show_runtime_logs": "off",
                    "runtime.httpx_log_level": "WARNING",
                },
            }
        },
    }
)

if settings.get("debug", None) is not None:
    _apply_debug_profile(settings, settings.get("debug"))

# Extensions Installation
# BaseAgent + Extensions = Agent
from agently.builtins.agent_extensions import (
    AudioExtension,
    StreamingPrintExtension,
    SessionExtension,
    TaskWorkspaceExtension,
    RecordStoreExtension,
    ActionExtension,
    SkillsExtension,
    KeyWaiterExtension,
    AutoFuncExtension,
    ConfigurePromptExtension,
)


class Agent(
    AudioExtension,
    StreamingPrintExtension,
    SessionExtension,
    SkillsExtension,
    TaskWorkspaceExtension,
    RecordStoreExtension,
    ActionExtension,
    KeyWaiterExtension,
    AutoFuncExtension,
    ConfigurePromptExtension,
    BaseAgent,
):
    def __init__(
        self,
        *args: Any,
        plugin_manager_: PluginManager | None = None,
        parent_settings: Settings | None = None,
        name: str 
```

### Core Architecture Module: `agently/builtins/__init__.py`
```
"""Built-in Agently implementations covered by the package typing marker."""

```

### Core Architecture Module: `agently/builtins/actions/ACP.py`
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

from agently_stage import default_stage_call_bridge

import asyncio
import inspect
import shutil
import uuid
from collections.abc import Awaitable, Callable, Iterable, Mapping
from pathlib import Path
from typing import Any, Literal, Protocol, cast, runtime_checkable

from agently.core.runtime.RuntimeContext import get_current_agent_execution_context
from agently.types.data import ExecutionResourceRequirement
from agently.utils import LazyImport


async def _await_value(value: Awaitable[Any]) -> Any:
    return await value


def _resolve_sync(value: Any) -> Any:
    if inspect.isawaitable(value):
        return default_stage_call_bridge.as_sync(_await_value)(cast(Awaitable[Any], value))
    return value


COMMON_ACP_ADAPTER_HINTS: tuple[dict[str, Any], ...] = (
    {
        "name": "codex",
        "label": "Codex",
        "aliases": ("codex",),
    },
    {
        "name": "claude code",
        "label": "Claude Code",
        "aliases": ("claude code", "cc", "claude"),
    },
    {
        "name": "openclaw",
        "label": "OpenClaw",
        "aliases": ("openclaw",),
    },
    {
        "name": "hermes",
        "label": "Hermes Agent",
        "aliases": ("hermes", "hermes agent"),
    },
    {
        "name": "gemini",
        "label": "Gemini",
        "aliases": ("gemini",),
    },
)

COMMON_ACP_ADAPTER_HINT_MESSAGE = (
    "Common ACP adapter names/aliases include codex, claude code/cc, "
    "openclaw, hermes/hermes agent, and gemini. These are hints only; "
    "acp_run_task is registered only after local discovery verifies a runnable agent."
)


def common_acp_adapter_hints() -> list[dict[str, Any]]:
    return [
        {
            "name": str(item["name"]),
            "label": str(item["label"]),
            "aliases": [str(alias) for alias in item["aliases"]],
        }
        for item in COMMON_ACP_ADAPTER_HINTS
    ]


@runtime_checkable
class ACPProvider(Protocol):
    def discover_agents(
        self,
        *,
        root: str,
        agent_ids: list[str] | None = None,
        timeout_seconds: float | None = None,
    ) -> Mapping[str, Any] | Iterable[Mapping[str, Any]]: ...

    async def async_run_task(
        self,
        *,
        agent_id: str,
        task: str,
        root: str,
        working_dir: str,
        timeout_seconds: float | None = None,
        context: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any] | str: ...


class LocalACPProvider:
    COMMON_AGENT_COMMANDS = ("codex", "claude", "gemini")
    DEFAULT_COMMAND_PATHS: dict[str, tuple[str, ...]] = {
        "codex": (
            "codex",
            "/Applications/Codex.app/Contents/Resources/codex",
            "/opt/homebrew/bin/codex",
            "/usr/local/bin/codex",
        ),
        "claude": (
            "claude",
            "/opt/homebrew/bin/claude",
            "/usr/local/bin/claude",
        ),
        "gemini": (
            "gemini",
            "/opt/homebrew/bin/gemini",
            "/usr/local/bin/gemini",
        ),
    }

    def __init__(self, command_paths: Mapping[str, Iterable[str]] | None = None):
        self.command_paths = {
            agent_id: tuple(str(item) for item in paths)
            for agent_id, paths in (command_paths or self.DEFAULT_COMMAND_PATHS).items()
        }
        self._agents_by_id: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _command_exists(command: str) -> str | None:
        if not command:
            return None
        resolved = shutil.which(command)
        if resolved:
            return resolved
        path = Path(command).expanduser()
        if path.exists() and path.is_file():
            return str(path)
        return None

    @staticmethod
    def _health_args(agent_id: str) -> tuple[str, ...]:
        return ("--version",)

    @staticmethod
    def _run_args(agent_id: str, *, task: str, root: str, working_dir: str) -> tuple[str, ...]:
        if agent_id == "codex":
            return (
                "exec",
                "-C",
                working_dir,
                "--sandbox",
                "workspace-write",
                "--ask-for-approval",
                "never",
                "--skip-git-repo-check",
                task,
            )
        if agent_id == "claude":
            return (
                "-p",
                "--permission-mode",
                "dontAsk",
                "--add-dir",
                root,
                task,
            )
        return (task,)

    async def _async_command_health(
        self,
        *,
        agent_id: str,
        command: str,
        cwd: str,
        timeout_seconds: float | None,
    ) -> dict[str, Any]:
        args = self._health_args(agent_id)
        try:
            process = await asyncio.create_subprocess_exec(
                command,
                *args,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=min(float(timeout_seconds or 10), 10.0),
                )
            except TimeoutError:
                process.kill()
                await process.wait()
                return {
                    "ok": False,
                    "status": "failed",
                    "error": "ACP command health check timed out.",
                }
            output = stdout.decode("utf-8", "replace").strip()
            error = stderr.decode("utf-8", "replace").strip()
            return {
                "ok": process.returncode == 0,
                "status": "ready" if process.returncode == 0 else "failed",
                "exit_code": process.returncode,
                "output": output[:1200],
                "stderr": error[:1200],
            }
        except Exception as error:
            return {
                "ok": False,
                "status": "failed",
                "error": str(error) or error.__class__.__name__,
                "exception_type": error.__class__.__name__,
            }

    def _command_health(
        self,
        *,
        agent_id: str,
        command: str,
        cwd: str,
        timeout_seconds: float | None,
    ) -> dict[str, Any]:
        return default_stage_call_bridge.as_sync(self._async_command_health)(
            agent_id=agent_id,
            command=command,
            cwd=cwd,
            timeout_seconds=timeout_seconds,
        )

    def _discover_cli_agents(
        self,
        *,
        root: str,
        requested: list[str],
        timeout_seconds: float | None,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        agents: list[dict[str, Any]] = []
        diagnostics: list[dict[str, Any]] = []
        for agent_id in requested:
            paths = list(self.command_paths.get(agent_id, (agent_id,)))
            path_candidates = [
                {"command": path, "resolved": self._command_exists(path)}
                for path in paths
            ]
            selected_command = ""
            selected_health: dict[str, Any] | None = None
            failures: list[dict[str, Any]] = []
            for item in path_candidates:
                resolved = item.get("resolved")
                if not resolved:
               
```

### Core Architecture Module: `agently/builtins/actions/Browse.py`
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

from pathlib import Path
from collections.abc import Mapping
from typing import Any, Literal, cast
import asyncio
import hashlib
import json
import os
import platform
import re
import subprocess
import tempfile
import time
import unicodedata
import webbrowser
from urllib.parse import quote, urljoin, urlparse

from agently.utils import LazyImport

_URL_PUNCT_TRANSLATION = str.maketrans(
    {
        "。": ".",
        "，": ",",
        "；": ";",
        "！": "!",
        "？": "?",
        "（": "(",
        "）": ")",
        "【": "[",
        "】": "]",
        "《": "<",
        "》": ">",
        "「": '"',
        "」": '"',
        "『": '"',
        "』": '"',
        "“": '"',
        "”": '"',
        "‘": "'",
        "’": "'",
        "、": "/",
    }
)


class Browse:
    REMOTE_FILE_EXTENSIONS = {
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
    }
    REMOTE_FILE_MEDIA_TYPES = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
    }

    PRIMARY_CONTENT_SELECTORS = (
        "[data-agently-main]",
        '[data-testid="markdown-body"]',
        '[data-testid="issue-body"]',
        '[data-testid="issue-viewer-issue-container"]',
        ".markdown-body",
        ".repository-content .markdown-body",
        ".repository-content .Box-body",
        ".js-issue-title + div",
        ".entry-content",
        ".post-content",
        ".article-content",
        ".article__content",
        ".article-body",
        ".story-body",
        ".news-article-body",
        ".caas-body",
        ".rich_media_content",
        ".theme-doc-markdown",
        ".theme-doc-markdown.markdown",
        ".docMainContainer",
        ".content__article-body",
        ".article-main",
        ".main-content",
        "main .vp-doc",
        "article .vp-doc",
        ".vp-doc",
        ".markdown",
        "main article",
        "article",
        "main",
        '[role="main"]',
        "#content",
        ".content",
        ".markdown-body",
    )

    CONTENT_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "pre", "td", "th", "blockquote")

    REMOVE_TAGS_STRICT = ("script", "style", "noscript", "svg", "nav", "aside", "footer", "header", "form")

    REMOVE_TAGS_RELAXED = ("script", "style", "noscript", "svg")

    NOISE_KEYWORDS = (
        "sidebar",
        "toc",
        "table-of-contents",
        "breadcrumb",
        "pagination",
        "pager",
        "navbar",
        "menu",
        "nav",
        "footer",
        "header",
        "ads",
        "advert",
    )

    BS4_STRATEGY_MIN_LENGTH = 20
    JINA_READER_BACKEND_ALIASES = {"jina", "jina-reader", "jina_reader", "reader"}

    BLOCKED_PAGE_MARKERS = (
        "web application firewall",
        "website is temporarily inaccessible",
        "protocol and port for the website are not added",
        "yundun.console.aliyun.com",
        "errorcodetitle",
        "errorcodeinfo",
        'id="waf"',
        "access denied",
        "request blocked",
        "target url returned error",
        "blocked by network security",
        "log in to your reddit account",
        "developer token",
        "login required",
        "sina visitor system",
        "passport.weibo.com/visitor",
        "captcha",
        "errorcode:",
    )

    def __init__(
        self,
        proxy: str | None = None,
        timeout: int | None = None,
        headers: dict[str, str] | None = None,
        *,
        fallback_order: tuple[str, ...] = ("jina_reader", "playwright", "bs4", "curl"),
        enable_pyautogui: bool = False,
        enable_playwright: bool = True,
        enable_curl: bool = True,
        enable_jina_reader: bool = True,
        enable_bs4: bool = True,
        response_mode: Literal["markdown", "text"] = "markdown",
        max_content_length: int = 12000,
        min_content_length: int = 40,
        jina_reader_endpoint: str = "https://r.jina.ai/",
        jina_reader_fallback_endpoints: tuple[str, ...] | list[str] | str | None = ("https://r.jinaai.cn/",),
        jina_reader_headers: dict[str, str] | None = None,
        jina_reader_engine: Literal["auto", "browser", "curl"] | None = "auto",
        jina_reader_timeout: int | None = 10,
        pyautogui_pause: float = 0.05,
        pyautogui_fail_safe: bool = True,
        pyautogui_new_tab: bool = True,
        pyautogui_wait_seconds: float = 1.5,
        pyautogui_dry_run: bool = False,
        pyautogui_type_interval: float = 0.01,
        pyautogui_open_mode: Literal["hotkey", "system"] = "hotkey",
        pyautogui_activate_browser: bool = False,
        pyautogui_browser_app: str | None = None,
        pyautogui_activate_wait_seconds: float = 0.4,
        pyautogui_read_wait_seconds: float = 0.4,
        playwright_headless: bool = True,
        playwright_timeout: int = 30000,
        playwright_user_agent: str | None = None,
        playwright_include_links: bool = True,
        playwright_max_links: int = 120,
        playwright_screenshot_path: str | None = None,
        use_browser_environment: bool = False,
        browser_environment_config: dict[str, Any] | None = None,
        max_attempts: int = 2,
        retry_backoff_seconds: float = 0.25,
    ):
        self.proxy = proxy
        self.timeout = timeout
        self.headers = (
            headers
            if headers is not None
            else {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            }
        )

        self.fallback_order = tuple(item.strip().lower() for item in fallback_order if str(item).strip())
        self.enable_pyautogui = enable_pyautogui
        self.enable_playwright = enable_playwright
        self.enable_curl = enable_curl
        self.enable_jina_reader = enable_jina_reader
        self.enable_bs4 = enable_bs4
        self.response_mode = response_mode
        self.max_content_length = max_content_length
        self.min_content_length = max(1, int(min_content_length))
        self.jina_reader_endpoint = jina_reader_endpoint
        self.jina_reader_fallback_endpoints = self._normalize_endpoint_list(jina_reader_fallback_endpoints)
        self.jina_reader_headers = dict(jina_reader_headers or {})
        self.jina_reader_engine = jina_reader_engine
        self.jina_reader_timeout = jina_reader_timeout

        self.pyautogui_pause = pyautogui_pause
        self.pyautogui_fail_safe = pyautogui_fail_safe
        self.pyautogui_new_tab = pyautogui_new_tab
        self.pyautogui_wait_seconds = pyautogui_wait_seconds
        self.pyautogui_dry_run = pyautogui_dry_run
        self.pyautogui_type_interval = pyautogui_type_interval
        self.pyautogui_open_mode = pyautogui_open_mode
        self.pyautogui_activate_browser = pyautogui_
```

### Core Architecture Module: `agently/builtins/actions/Cmd.py`
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


import shlex
import subprocess
import uuid
from pathlib import Path
from typing import Iterable, Sequence

from agently.builtins.plugins.ExecutionResourceProvider.Shell import BashExecutor


DEFAULT_SAFE_CMD_PREFIXES = [
    "pwd",
    "ls",
    "rg",
    "cat",
    "head",
    "tail",
    "wc",
    "find",
    "date",
    "whoami",
    "git status",
    "git diff",
    "git log",
    "git show",
    "git rev-parse",
    "python -m pytest",
    "python -m pyright",
    "pytest",
]


def normalize_command_argv(cmd: str | Sequence[str]) -> list[str]:
    """Normalize one shell command without invoking a shell.

    A string is parsed with shell-style quoting. A sequence normally represents
    argv tokens, but one sequence item may also contain the complete command.
    The latter shape is common in structured model output and remains safe
    because it is parsed into argv rather than executed through a shell.
    """

    if isinstance(cmd, str):
        return shlex.split(cmd)
    args = [str(item) for item in cmd]
    if len(args) == 1:
        return shlex.split(args[0])
    return args


class Cmd:
    """Legacy argv/Action adapter; native execution belongs to the new executor."""

    def __init__(
        self,
        *,
        allowed_cmd_prefixes: Sequence[str] | None = None,
        allowed_workdir_roots: Iterable[str | Path] | None = None,
        timeout: int = 20,
        env: dict[str, str] | None = None,
        max_output_chars: int = 20000,
        output_artifact_dir: str | Path | None = None,
    ):
        self.allowed_cmd_prefixes = set(
            allowed_cmd_prefixes if allowed_cmd_prefixes is not None else DEFAULT_SAFE_CMD_PREFIXES
        )
        self._allowed_cmd_prefix_tokens = [
            self._normalize_cmd(prefix)
            for prefix in self.allowed_cmd_prefixes
            if isinstance(prefix, str) and prefix.strip()
        ]
        # No implicit process-cwd boundary: a TaskWorkspace-bound shell must inject
        # the working directory through the direct TaskWorkspace root. Executors
        # must not invent a fallback cwd.
        roots = allowed_workdir_roots if allowed_workdir_roots is not None else []
        self.allowed_workdir_roots = [Path(root).resolve() for root in roots]
        self.timeout = timeout
        self.env = env
        self.max_output_chars = max(1, int(max_output_chars))
        self.output_artifact_dir = Path(output_artifact_dir).resolve() if output_artifact_dir is not None else None
        self._executor = BashExecutor()

    def register_actions(
        self,
        action,
        *,
        tags: str | list[str] | None = None,
        action_prefix: str = "",
        expose_to_model: bool = True,
        default_policy: dict | None = None,
    ) -> list[str]:
        prefix = action_prefix.strip()
        action_id = f"{prefix}cmd" if prefix else "cmd"
        action.register_action(
            action_id=action_id,
            desc=(
                "Run a low-level allowlisted shell command with bounded stdout/stderr previews. "
                "Prefer `agent.enable_shell(...)` for user-facing shell access, and prefer "
                "TaskWorkspace file actions for reading, searching, editing, and writing files."
            ),
            kwargs={
                "cmd": (
                    "str | list[str]",
                    "Exactly one command: a command string, argv tokens, or a one-item list containing the complete command.",
                ),
                "workdir": ("str | None", "Working directory."),
            },
            func=self.run,
            tags=tags,
            default_policy=default_policy,
            side_effect_level="exec",
            approval_required=False,
            sandbox_required=False,
            expose_to_model=expose_to_model,
            meta={
                "component": "builtins.actions.Cmd",
                "legacy_tool_facade": "agently.builtins.tools.Cmd",
                "recommended_public_helper": "agent.enable_shell",
                "host_only_input_keys": ["allow_unsafe"],
            },
        )
        return [action_id]

    def _normalize_cmd(self, cmd: str | Sequence[str]) -> list[str]:
        return normalize_command_argv(cmd)

    def _is_cmd_allowed(self, args: list[str]) -> bool:
        if not args:
            return False
        base = Path(args[0]).name
        for prefix in self._allowed_cmd_prefix_tokens:
            if len(prefix) == 0:
                continue
            if len(prefix) == 1:
                if base == prefix[0] or args[0] == prefix[0]:
                    return True
                continue
            if len(args) < len(prefix):
                continue
            first_matches = base == prefix[0] or args[0] == prefix[0]
            if first_matches and args[1 : len(prefix)] == prefix[1:]:
                return True
        return False

    def _is_workdir_allowed(self, workdir: str | Path | None) -> bool:
        workdir_path = self._resolve_workdir(workdir)
        if workdir_path is None or not self.allowed_workdir_roots:
            return False
        for root in self.allowed_workdir_roots:
            try:
                workdir_path.relative_to(root)
                return True
            except ValueError:
                continue
        return False

    def _resolve_workdir(self, workdir: str | Path | None) -> Path | None:
        if workdir is not None:
            requested = Path(workdir).expanduser()
            if requested.is_absolute() or not self.allowed_workdir_roots:
                return requested.resolve()
            root = self.allowed_workdir_roots[0]
            requested_parts = requested.parts
            root_parts = root.parts
            # TaskWorkspace evidence may expose the bound root as a logical
            # relative locator (for example .agently/files/<execution_id>).
            # When that locator already names the injected root, consume the
            # matching prefix instead of appending the root twice. Any suffix
            # remains an ordinary child path and the existing boundary check
            # still rejects traversal outside the injected root.
            for prefix_size in range(
                min(len(requested_parts), len(root_parts)),
                0,
                -1,
            ):
                if tuple(root_parts[-prefix_size:]) != tuple(requested_parts[:prefix_size]):
                    continue
                return root.joinpath(*requested_parts[prefix_size:]).resolve()
            return (root / requested).resolve()
        if self.allowed_workdir_roots:
            return self.allowed_workdir_roots[0]
        # No TaskWorkspace-issued boundary configured; do not fall back to cwd.
        return None

    async def run(
        self,
        cmd: str | Sequence[str],
        workdir: str | Path | None = None,
        allow_unsafe: bool = False,
    ) -> dict:
        args = self._normalize_cmd(cmd)
        workdir_path = self._resolve_workdir(workdir)
        if workdir_path is None:
            return {
                "ok": False,
                "status": "blocked",
                "need_approval": True,
                "reason": "task_workspace_boundary_required",
                "detail": (
                    "No TaskWorkspace-issued working directory. Bind a TaskWorkspace and enable a "
      
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

### Incident Patch 1: `e4d200d0` (2026-09-12)
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

### Incident Patch 2: `87fea76f` (2026-09-12)
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

### Incident Patch 3: `165fe5f1` (2026-09-12)
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
                     "execution_m
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

---

### Incident Patch 4: `55bd84c8` (2026-09-12)
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

### Incident Patch 5: `5aa31346` (2026-09-12)
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

---

### Incident Patch 6: `3943fb36` (2026-09-12)
**Commit Message**: fix: enforce offered action scope before dispatch

**File**: `agently/builtins/agent_extensions/ActionExtension.py` (modified, +2/-27)
```diff
@@ -23,10 +23,10 @@
 from typing_extensions import Self, overload
 
 from agently.core import BaseAgent
+from agently.core.operation.Action.ActionMetadata import _scoped_action_list
 from agently.core.model.ModelRequestRunner import PreparedModelResponse
 from agently.core.runtime.RuntimeContext import (
     get_current_action_policy,
-    get_current_agent_execution_context,
 )
 from agently.utils import DeprecationWarnings
 from agently.builtins.actions.Cmd import DEFAULT_SAFE_CMD_PREFIXES
@@ -351,32 +351,7 @@ def _action_item_id(item: dict[str, Any]) -> str:
         return str(item.get("action_id") or item.get("name") or "").strip()
 
     def _get_scoped_action_list(self) -> list[dict[str, Any]]:
-        action_list = self.action.get_action_list(tags=[f"agent-{ self.name }"])
-        execution_context = get_current_agent_execution_context()
-        scoped_action_ids = getattr(execution_context, "scoped_action_ids", None)
-        raw_allowed_ids = scoped_action_ids() if callable(scoped_action_ids) else None
-        allowed_ids = (
-            {str(item).strip() for item in raw_allowed_ids if str(item).strip()}
-            if isinstance(raw_allowed_ids, set)
-            else set()
-        )
-        if not allowed_ids:
-            scoped_list = action_list
-        else:
-            # Explicit execution scope is authoritative even for a stable Action
-            # definition that is deliberately not tagged as an Agent default.
-            scoped_list = [
-                item
-                for item in self.action.get_action_list()
-                if self._action_item_id(item) in allowed_ids
-            ]
-        recall_records = getattr(execution_context, "scoped_action_artifact_recall_records", None)
-        if callable(recall_records):
-            scoped_list = self.action._with_action_artifact_recall_action(
-                scoped_list,
-                cast(list["ActionResult"], recall_records()),
-            )
-        return scoped_list
+        return _scoped_action_list(self.action, self.name)
 
     def use_tools(self, tools: object) -> "AgentExecution":
         """Compatibility alias for execution-local ``use_actions(...)``."""
```

**File**: `agently/builtins/plugins/ActionFlow/DAGActionFlow.py` (modified, +19/-1)
```diff
@@ -24,6 +24,7 @@
 
 import asyncio
 import inspect
+from copy import deepcopy
 from typing import TYPE_CHECKING, Any
 
 from agently.core.runtime.RuntimeContext import (
@@ -200,6 +201,7 @@ async def plan_step(data):
                 action_list,
                 model_visible_last_round_records or model_visible_done_plans,
             )
+            await data.async_set_state("offered_actions", deepcopy(visible_action_list))
 
             decision = action._normalize_action_decision(
                 await planning_handler(
@@ -228,6 +230,11 @@ async def plan_step(data):
                 round_index=round_index,
                 max_rounds=max_rounds,
             )
+            scope_records = action._check_action_scope(
+                decision.get("action_calls", []), data.get_state("offered_actions", []),
+                run_id=action_loop_run.run_id, round_index=round_index,
+            ) if dispatch_confirmed else []
+            dispatch_confirmed = dispatch_confirmed and not scope_records
             await publish_runtime_observation(
                 "plan_ready",
                 message=f"Action plan ready for round {round_index}.",
@@ -246,7 +253,7 @@ async def plan_step(data):
             if dispatch_confirmed:
                 await data.async_emit("EXECUTE", decision.get("action_calls", []))
             else:
-                await data.async_emit("DONE", done_plans)
+                await data.async_emit("DONE", [*done_plans, *scope_records])
             return decision
 
         async def execute_step_via_dag(data):
@@ -262,6 +269,14 @@ async def execute_step_via_dag(data):
                 await data.async_emit("PLAN", None)
                 return []
 
+            scope_records = action._check_action_scope(
+                action_calls, data.get_state("offered_actions", []),
+                run_id=action_loop_run.run_id, round_index=round_index,
+            )
+            if scope_records:
+                await data.async_emit("DONE", [*done_plans, *scope_records])
+                return scope_records
+
             # Build DAG: each action_call becomes an independent node.
             # Future: model-generated depends_on relationships will create edges.
             nodes: list[dict[str, Any]] = []
@@ -472,6 +487,9 @@ async def finalize_loop(data):
                 )
             raise
         finally:
+            release_catalogs = getattr(action.action_runtime, "_release_programmatic_scope", None)
+            if callable(release_catalogs):
+                release_catalogs(action_loop_run.run_id)
             if owns_artifact_scope and not action_loop_completed:
                 action._release_artifact_scope(artifact_scope)
         if isinstance(result, dict):
```

**File**: `agently/builtins/plugins/ActionFlow/TriggerFlowActionFlow.py` (modified, +33/-9)
```diff
@@ -17,6 +17,7 @@
 import asyncio
 import inspect
 import time
+from copy import deepcopy
 from typing import TYPE_CHECKING, Any
 
 from agently.core.application.AgentExecution import RuntimeStageStallError
@@ -411,6 +412,8 @@ def max_rounds_diagnostic_records(
                 action_list,
                 model_visible_last_round_records or model_visible_done_plans,
             )
+            # Preserve the Host projection before a replaceable planner runs.
+            await data.async_set_state("offered_actions", deepcopy(visible_action_list))
 
             decision = action._normalize_action_decision(
                 await resolved_planning_handler(
@@ -440,6 +443,11 @@ def max_rounds_diagnostic_records(
                 round_index=round_index,
                 max_rounds=max_rounds,
             )
+            scope_records = action._check_action_scope(
+                decision.get("action_calls", []), data.get_state("offered_actions", []),
+                run_id=action_loop_run.run_id, round_index=round_index,
+            ) if dispatch_confirmed else []
+            dispatch_confirmed = dispatch_confirmed and not scope_records
             await publish_runtime_observation(
                 "plan_ready",
                 message=f"Action plan ready for round { round_index }.",
@@ -505,11 +513,11 @@ def max_rounds_diagnostic_records(
             if dispatch_confirmed:
                 await data.async_emit("EXECUTE", decision.get("action_calls", []))
             else:
-                if terminal_response_handler is not None and decision.get("next_action") == "response":
+                if not scope_records and terminal_response_handler is not None and decision.get("next_action") == "response":
                     terminal_result = terminal_response_handler(decision)
                     if inspect.isawaitable(terminal_result):
                         await terminal_result
-                await data.async_emit("DONE", [*done_plans, *diagnostic_records])
+                await data.async_emit("DONE", [*done_plans, *diagnostic_records, *scope_records])
             return decision
 
         async def execute_step(data):
@@ -524,6 +532,14 @@ async def execute_step(data):
             if not isinstance(last_round_records, list):
                 last_round_records = []
 
+            scope_records = action._check_action_scope(
+                action_calls, data.get_state("offered_actions", []),
+                run_id=action_loop_run.run_id, round_index=round_index,
+            )
+            if scope_records:
+                await data.async_emit("DONE", [*done_plans, *scope_records])
+                return scope_records
+
             approval_decisions = data.get_state("policy_approval_decisions", {})
             if not isinstance(approval_decisions, dict):
                 approval_decisions = {}
@@ -908,8 +924,14 @@ async def finalize_loop(data):
         action_loop_completed = False
         standalone_scope_released = False
 
-        def release_standalone_artifact_scope_once() -> None:
+        def release_programmatic_scope() -> None:
+            release = getattr(action.action_runtime, "_release_programmatic_scope", None)
+            if callable(release):
+                release(action_loop_run.run_id)
+
+        def release_loop_resources() -> None:
             nonlocal standalone_scope_released
+            release_programmatic_scope()
             if not owns_artifact_scope or standalone_scope_released:
                 return
             standalone_scope_released = True
@@ -928,11 +950,11 @@ async def finalize_live_exchange_execution() -> None:
                         interrupt_id=str(pending_interrupt.get("id", "")),
                         exchange_id=pending_envelope.get("exchange_id"),
                         on_resolved=finalize_live_exchange_execution,
-                        on_closed=release_standalone_artifact_scope_once,
+                        on_closed=release_loop_res
```

**File**: `agently/builtins/plugins/ActionRuntime/AgentlyActionRuntime.py` (modified, +29/-4)
```diff
@@ -700,6 +700,7 @@ def _retain_programmatic_catalog(
         self._programmatic_catalogs[revision] = {
             "catalog": catalog_snapshot,
             "leases": 1,
+            "planning_lease": isinstance(catalog_snapshot.get("_planning_scope"), dict),
         }
 
     def resolve_programmatic_catalog(self, revision: str) -> dict[str, Any] | None:
@@ -717,6 +718,27 @@ def release_programmatic_catalog(self, revision: str) -> None:
         else:
             retained["leases"] = leases
 
+    def _release_planned_catalog(self, revision: str) -> bool:
+        retained = self._programmatic_catalogs.get(str(revision))
+        if not isinstance(retained, dict) or not retained.get("planning_lease"):
+            return False
+        retained["planning_lease"] = False
+        self.release_programmatic_catalog(revision)
+        return True
+
+    def _release_programmatic_scope(self, run_id: str) -> None:
+        """Settle only unconsumed default-planner leases owned by this loop."""
+
+        for revision, retained in list(self._programmatic_catalogs.items()):
+            catalog = retained.get("catalog", {})
+            origin = catalog.get("_planning_scope") if isinstance(catalog, dict) else None
+            if (
+                retained.get("planning_lease")
+                and isinstance(origin, dict)
+                and origin.get("run_id") == run_id
+            ):
+                self._release_planned_catalog(revision)
+
     async def _default_programmatic_planning_handler(
         self,
         context: "ActionRunContext",
@@ -1029,10 +1051,6 @@ def validate_program_decision(value: dict[str, Any], _validation_context: Any):
             and max_active_catalogs_raw > 0
             else 64
         )
-        self._retain_programmatic_catalog(
-            catalog_payload,
-            max_active_catalogs=max_active_catalogs,
-        )
         action_call = {
             "purpose": decision["description"],
             "action_id": PROGRAMMATIC_ACTION_TRANSPORT_ID,
@@ -1046,6 +1064,13 @@ def validate_program_decision(value: dict[str, Any], _validation_context: Any):
                 "Use the bounded program result to decide whether to respond or run another Action round."
             ),
         }
+        if parent_run_id:
+            catalog_payload["_planning_scope"] = {"run_id": parent_run_id, "round_index": round_index}
+            catalog_payload["_action_input"] = dict(action_call["action_input"])
+        self._retain_programmatic_catalog(
+            catalog_payload,
+            max_active_catalogs=max_active_catalogs,
+        )
         return cast(
             "ActionDecision",
             {
```

**File**: `agently/builtins/plugins/AgentExecution/long_task/Carrier.py` (modified, +28/-1)
```diff
@@ -16,6 +16,7 @@
 from __future__ import annotations
 
 from agently.types.data import RunContext
+from agently.core.operation.Action.ActionMetadata import _scoped_action_list
 
 from .TaskShared import (
     AgentTaskMixinBase,
@@ -40,6 +41,16 @@
 
 
 class AgentTaskCarrierMixin(AgentTaskMixinBase):
+    def _bounded_action_scope(self, allowed_action_ids: Sequence[str] = ()) -> set[str]:
+        """Keep model commands inside existing Host scope and visible Actions."""
+
+        return {
+            str(item.get("action_id") or item.get("name") or "").strip()
+            for item in _scoped_action_list(
+                self.agent.action, self.agent.name, allowed_action_ids=allowed_action_ids
+            )
+        }
+
     def _bounded_action_result_refs(
         self,
         records: Sequence[Mapping[str, Any]],
@@ -128,6 +139,7 @@ def _normalize_bounded_action_commands(
         raw_commands: Any,
         required_action_ids: Sequence[str],
         unit_label: str,
+        allowed_action_ids: Sequence[str] = (),
     ) -> tuple[list[dict[str, Any]], tuple[str, str] | None]:
         """Validate model-authored Action commands against mounted contracts."""
 
@@ -142,6 +154,7 @@ def _normalize_bounded_action_commands(
         registry = getattr(getattr(self.agent, "action", None), "action_registry", None)
         has_action = getattr(registry, "has", None)
         get_spec = getattr(registry, "get_spec", None)
+        allowed = self._bounded_action_scope(allowed_action_ids)
         commands: list[dict[str, Any]] = []
         for index, raw_command in enumerate(raw_commands):
             if not isinstance(raw_command, Mapping):
@@ -156,6 +169,11 @@ def _normalize_bounded_action_commands(
                     "unknown_action",
                     f"{unit_label} action command references unavailable Action '{action_id}'.",
                 )
+            if action_id not in allowed:
+                return [], (
+                    "action_not_allowed",
+                    f"{unit_label} action command '{action_id}' is outside the visible execution scope.",
+                )
             if not isinstance(action_input, Mapping):
                 return [], (
                     "invalid_input",
@@ -264,6 +282,7 @@ async def _execute_bounded_action_commands(
         concurrency: int | None = None,
         iteration_index: int | None = None,
         project_flat_action_batch: bool = False,
+        allowed_action_ids: Sequence[str] = (),
     ) -> tuple[dict[str, Any], dict[str, Any]]:
         """Validate one bounded command batch and dispatch it through ActionRuntime."""
 
@@ -281,6 +300,7 @@ def failure(code_suffix: str, message: str) -> tuple[dict[str, Any], dict[str, A
             raw_commands=raw_commands,
             required_action_ids=required_action_ids,
             unit_label=unit_label,
+            allowed_action_ids=allowed_action_ids,
         )
         if validation_error is not None:
             return failure(*validation_error)
@@ -419,13 +439,20 @@ def _bounded_action_command_succeeded(record: Any) -> bool:
     def _bounded_action_contracts(
         self,
         required_action_ids: Sequence[str],
+        *,
+        allowed_action_ids: Sequence[str] = (),
     ) -> tuple[list[dict[str, Any]], str | None]:
         registry = getattr(getattr(self.agent, "action", None), "action_registry", None)
         get_spec = getattr(registry, "get_spec", None)
         contracts: list[dict[str, Any]] = []
+        allowed = self._bounded_action_scope(allowed_action_ids)
         for action_id in self._normalize_string_list(required_action_ids):
+            if action_id not in allowed:
+                return [], action_id
             spec = get_spec(action_id) if callable(get_spec) else None
-            if not isinstance(spec, Mapping) or spec.get("expose_to_model", True) is not True:
+            # The Host projection already checked ordinary exposure and may
+            # explicit
```

---

### Incident Patch 7: `c379bed6` (2026-09-12)
**Commit Message**: fix: retain released empty skill action candidates projection

**File**: `agently/core/application/SkillsExecutor/SkillsExecutor.py` (modified, +1/-0)
```diff
@@ -524,6 +524,7 @@ def _project_context_pack(
                 "revision_ref": skill.revision_ref,
                 "guidance": None,
                 "selected_resources": [],
+                "action_candidates": [],
             }
             for skill in installed
         }
```

**File**: `docs/cn/development/skills-executor.md` (modified, +4/-0)
```diff
@@ -100,6 +100,10 @@ contract。仅为兼容保留的 `actionize_scripts=True` 仍把选中的 script
 resource descriptor 返回，并发出 `skills.compat.actionize_scripts_ignored`；它不会发现、
 生成、挂载或授权 Action。
 
+每个 Skill 投影保留 `action_candidates: []`，兼容已发布版本的字典读取方式。
+无论该开关是否开启，此数组始终为空；脚本描述仍位于 `selected_resources`，
+不是待注册的 Action 列表。
+
 普通 AgentExecution 应先准备 Skill scope，再显式为所需语言启用一个受限的 script-exec
 Action。模型只传相对 `script_path` 与有界 `args`；宿主根据本次 execution 已冻结的
 精确 revision bindings 解析路径，并把实际 revision、path、digest 写入 Action evidence。
```

**File**: `docs/en/development/skills-executor.md` (modified, +4/-0)
```diff
@@ -112,6 +112,10 @@ contracts as ordinary execution. The compatibility-only
 descriptors and emits `skills.compat.actionize_scripts_ignored`; it does not
 discover, generate, mount, or authorize Actions.
 
+Each projected Skill retains `action_candidates: []` for compatibility with
+released dictionary consumers. It stays empty regardless of that flag; script
+descriptors remain in `selected_resources`, not an Action registration list.
+
 For normal AgentExecution work, prepare the Skill scope and explicitly enable
 one restricted script-exec Action for the required language. The Action accepts
 only a relative `script_path` and bounded `args`; the host resolves that path
```

**File**: `tests/test_skills_compatibility_facade.py` (modified, +114/-2)
```diff
@@ -7,7 +7,7 @@
 import pytest
 
 from agently.builtins.plugins.SkillSourceProvider import GitSkillSourceProvider
-from agently.core.application.SkillLibrary import SkillLibrary
+from agently.core.application.SkillLibrary import SkillLibrary, SkillPackageError
 from agently.core.application.SkillsExecutor import SkillsExecutor
 
 
@@ -213,6 +213,7 @@ async def test_context_pack_is_projection_of_generic_context_package(tmp_path: P
     assert compatibility["context_package_id"].startswith("context_package:")
     assert compatibility["task_context_id"].startswith("skills_compat:")
     assert compatibility["skills"][0]["skill_id"] == installed["skill_id"]
+    assert compatibility["skills"][0]["action_candidates"] == []
     assert compatibility["skills"][0]["guidance"]["excerpt"] == (
         "Apply the compatibility procedure."
     )
@@ -246,7 +247,7 @@ async def test_context_pack_returns_inert_script_resources_without_discovering_a
     assert scripts[0]["path"] == "scripts/check.py"
     assert "installed_path" not in scripts[0]
     assert "callable" not in scripts[0]
-    assert "action_candidates" not in compatibility["skills"][0]
+    assert compatibility["skills"][0]["action_candidates"] == []
     assert any(
         item["code"] == "skills.compat.actionize_scripts_ignored"
         for item in compatibility["diagnostics"]
@@ -268,6 +269,117 @@ async def test_task_dag_resolver_calls_same_context_reader_projection(tmp_path:
 
     assert result["context_package_id"].startswith("context_package:")
     assert result["skills"][0]["selected_resources"][0]["path"] == "references/guide.md"
+    assert result["skills"][0]["action_candidates"] == []
+
+
+@pytest.mark.parametrize("actionize_scripts", [False, True])
+@pytest.mark.parametrize("entrypoint", ["sync", "async", "task_dag"])
+@pytest.mark.asyncio
+async def test_released_empty_candidates_survive_each_public_projection(
+    tmp_path: Path,
+    actionize_scripts: bool,
+    entrypoint: str,
+) -> None:
+    """Real local facade projection; no model or script execution is involved."""
+    facade = SkillsExecutor(library=SkillLibrary(tmp_path / "library"))
+    installed = facade.install_skills(_write_skill(tmp_path / "skill"))
+    kwargs = {
+        "skill_ids": [installed["skill_id"]],
+        "actionize_scripts": actionize_scripts,
+        "include_references": False,
+    }
+    if entrypoint == "sync":
+        result = facade.build_context_pack(**kwargs)
+    elif entrypoint == "async":
+        result = await facade.async_build_context_pack(
+            skill_ids=[installed["skill_id"]],
+            actionize_scripts=actionize_scripts,
+            include_references=False,
+        )
+    else:
+        result = await facade.task_dag_resolver()["skill"](kwargs)
+
+    assert result["schema_version"] == "agently.skills.context_pack.compat.v2"
+    assert len(result["skills"]) == 1
+    assert result["skills"][0]["action_candidates"] == []
+    scripts = [
+        resource
+        for resource in result["skills"][0]["selected_resources"]
+        if resource["kind"] == "script"
+    ]
+    assert len(scripts) == int(actionize_scripts)
+    assert all("callable" not in resource and "installed_path" not in resource for resource in scripts)
+    assert any(
+        item["code"] == "skills.compat.actionize_scripts_ignored"
+        for item in result["diagnostics"]
+    ) is actionize_scripts
+
+
+@pytest.mark.parametrize("actionize_scripts", [False, True])
+@pytest.mark.asyncio
+async def test_empty_candidates_are_not_shared_between_skills_or_requests(
+    tmp_path: Path,
+    actionize_scripts: bool,
+) -> None:
+    facade = SkillsExecutor(library=SkillLibrary(tmp_path / "library"))
+    first = facade.install_skills(_write_skill(tmp_path / "first"))
+    second_root = _write_skill(tmp_path / "second")
+    (second_root / "SKILL.md").write_text(
+        "---\nname: Second Skill\ndescription: Another procedure.\n---\n\nRead its guide.",
+        enco
```

---

### Incident Patch 8: `236b4a43` (2026-09-12)
**Commit Message**: fix: bind local record context revisions to visible scope

**File**: `agently/core/storage/ContextSource.py` (modified, +32/-9)
```diff
@@ -24,6 +24,8 @@
     ContextSourceDescriptorPage,
     ContextSourceRead,
     ContextRole,
+    RecordContentSegment,
+    RecordRef,
 )
 
 from .RecordStore import RecordStore
@@ -52,6 +54,9 @@ def source_revision(self) -> str:
         explicit = getattr(self.record_store, "source_revision", None)
         if explicit is not None:
             return str(explicit)
+        snapshot = self._local_snapshot()
+        if snapshot is not None:
+            return snapshot[0]
         digest = hashlib.sha256(self.record_store.record_store_id.encode("utf-8"))
         for path in self._local_state_paths():
             try:
@@ -63,6 +68,17 @@ def source_revision(self) -> str:
             digest.update(str(stat.st_mtime_ns).encode("ascii"))
         return f"record-store-revision:{digest.hexdigest()}"
 
+    def _local_snapshot(
+        self,
+        *,
+        page: tuple[int, int] | None = None,
+        exact: tuple[str, int, int] | None = None,
+        projection_limit: int = 2000,
+    ) -> tuple[str, tuple[RecordRef, ...], dict[str, RecordContentSegment]] | None:
+        if type(self.record_store) is not RecordStore or getattr(self.record_store, "source_revision", None) is not None:
+            return None
+        return self.record_store._context_snapshot(page=page, exact=exact, projection_limit=projection_limit)
+
     def _local_state_paths(self) -> tuple[Path, ...]:
         root = Path(self.record_store.root)
         candidates = (
@@ -98,15 +114,20 @@ async def async_enumerate_descriptors(
         projection_max_chars = int(profile.get("projection_max_chars") or 2000)
         if projection_max_chars <= 0:
             raise ValueError("projection_max_chars must be positive.")
-        revision = self.source_revision
-        refs = tuple(await self.record_store.search(query=None))
+        snapshot = self._local_snapshot(page=(offset, page_size), projection_limit=projection_max_chars)
+        if snapshot is None:
+            revision = self.source_revision
+            refs = tuple(await self.record_store.search(query=None))
+            projections = None
+        else:
+            revision, refs, projections = snapshot
         page_refs = refs[offset : offset + page_size]
         descriptors: list[ContextSourceDescriptor] = []
         for ref in page_refs:
             record_id = str(ref.get("id") or "").strip()
             if not record_id:
                 raise ValueError("RecordStore search returned a record without id.")
-            projection = await self.record_store.read_bounded(
+            projection = projections[record_id] if projections is not None else await self.record_store.read_bounded(
                 record_id,
                 offset=0,
                 limit=projection_max_chars,
@@ -155,17 +176,19 @@ async def async_read_exact(
         range_start: int = 0,
     ) -> ContextSourceRead:
         del representation
-        segment = await self.record_store.read_bounded(
-            source_ref,
-            offset=range_start,
-            limit=max_chars,
-        )
+        snapshot = self._local_snapshot(exact=(source_ref, range_start, max_chars))
+        if snapshot is None:
+            segment = await self.record_store.read_bounded(source_ref, offset=range_start, limit=max_chars)
+            revision = self.source_revision
+        else:
+            revision, _, projections = snapshot
+            segment = projections[source_ref]
         content = str(segment.get("content") or "")
         eof = bool(segment.get("eof"))
         size = int(segment.get("size") or len(content))
         return ContextSourceRead(
             source_id=self.source_id,
-            source_revision=self.source_revision,
+            source_revision=revision,
             source_ref=source_ref,
             content=content,
             completeness="complete" if eof else "truncated",
```

**File**: `agently/core/storage/LocalRecordStore.py` (modified, +120/-1)
```diff
@@ -18,11 +18,12 @@
 import base64
 import hashlib
 import json
+import math
 import sqlite3
 import time
 import uuid
 from collections.abc import AsyncIterator, Callable, Iterator
-from contextlib import contextmanager
+from contextlib import closing, contextmanager, nullcontext
 from datetime import datetime, timezone
 from pathlib import Path
 from typing import Any, cast
@@ -67,6 +68,19 @@ def _sanitize(value: Any) -> Any:
     return _json_loads(_json(value), None)
 
 
+def _context_filter_value(value: Any) -> Any:
+    """Stable values only; unsupported equality objects keep the generic source path."""
+    if value is None or type(value) in {str, bool, int}:
+        return [type(value).__name__, value]
+    if type(value) is float and math.isfinite(value):
+        return ["float", value]
+    if type(value) is dict and all(type(key) is str for key in value):
+        return ["dict", [[key, _context_filter_value(item)] for key, item in sorted(value.items())]]
+    if type(value) in {list, tuple}:
+        return [type(value).__name__, [_context_filter_value(item) for item in cast(Any, value)]]
+    raise TypeError("Context filter cannot be normalized without changing its equality contract.")
+
+
 class LocalRecordStore:
     """Lazy local persistence for Agently-private RecordStore state.
 
@@ -433,6 +447,9 @@ async def ref_envelope(self, ref_or_id: RecordRef | str) -> RecordReference:
         ref = ref_or_id if isinstance(ref_or_id, dict) else await self.get_record(str(ref_or_id))
         if ref is None:
             raise KeyError(f"RecordStore record not found: {ref_or_id}")
+        return self._ref_envelope(ref)
+
+    def _ref_envelope(self, ref: RecordRef) -> RecordReference:
         return {
             "record_store_id": self.record_store_id,
             "kind": str(ref.get("kind") or "record"),
@@ -447,6 +464,108 @@ async def ref_envelope(self, ref_or_id: RecordRef | str) -> RecordReference:
             "backend_capabilities": {"bounded_read": True, "stream_read": True},
         }
 
+    def _context_snapshot(
+        self,
+        filters: dict[str, Any],
+        *,
+        record_store_id: str,
+        page: tuple[int, int] | None = None,
+        exact: tuple[str, int, int] | None = None,
+        projection_limit: int = 2000,
+    ) -> tuple[str, tuple[RecordRef, ...], dict[str, RecordContentSegment]] | None:
+        """Read scoped metadata and requested bodies from one local SQLite view.
+
+        Legitimate body writes insert their digest atomically. Revision scans
+        metadata, never all bodies; very large metadata/row counts still cost O(n).
+        None selects the unchanged generic path for non-normalizable filters.
+        """
+        normalized: dict[str, Any] = {}
+        try:
+            for key, expected in filters.items():
+                if type(key) is not str:
+                    return None
+                if type(expected) in {list, tuple, set}:
+                    normalized[key] = ["in", sorted({_json(_context_filter_value(item)) for item in expected})]
+                else:
+                    normalized[key] = ["eq", _context_filter_value(expected)]
+        except TypeError:
+            return None
+        if exact is not None and (exact[1] < 0 or exact[2] < 0):
+            raise ValueError("RecordStore read offset and limit must be non-negative.")
+        digest = hashlib.sha256(_json({
+            "algorithm": "record-store-scope/v1",
+            "record_store_id": record_store_id,
+            "filters": normalized,
+        }).encode("utf-8"))
+        try:
+            self.db_path.stat()
+            exists = True
+        except FileNotFoundError:
+            exists = False
+        manager = (
+            closing(sqlite3.connect(self.db_path.as_uri() + "?mode=ro", uri=True, timeout=30))
+            if exists else nullcontext(None)
+        )
+        with manager as connection:
+            try:
+                rows: list[sqlite3.Row] 
```

**File**: `agently/core/storage/RecordStore.py` (modified, +37/-0)
```diff
@@ -221,6 +221,43 @@ def _scoped_filters(self, filters: dict[str, Any] | None) -> dict[str, Any]:
             scoped.setdefault(filter_key, value)
         return scoped
 
+    def _context_snapshot(
+        self,
+        *,
+        page: tuple[int, int] | None = None,
+        exact: tuple[str, int, int] | None = None,
+        projection_limit: int = 2000,
+    ) -> tuple[str, tuple[RecordRef, ...], dict[str, RecordContentSegment]] | None:
+        """Use only the original built-in read path; preserve provider/instance adapters."""
+        from .LocalRecordStore import LocalRecordStore
+        from .Registry import RecordStoreRegistry
+
+        if type(self) is not RecordStore or self._provider is not None:
+            return None
+        if any(name in vars(self) for name in ("search", "read_bounded", "get_data", "_scoped_filters")):
+            return None
+        backend = self._backend
+        if backend is None:
+            if type(self.manager) is not RecordStoreRegistry or "_materialize_record_store" in vars(self.manager):
+                return None
+            # Pure path access: leave the facade binding and all component loaders lazy.
+            backend = LocalRecordStore(self.root / ".agently" / "records", create=False, mode="read_only")
+        if type(backend) is not LocalRecordStore:
+            return None
+        if any(name in vars(backend) for name in (
+            "search", "read_bounded", "get_data", "get", "get_record", "_record_id",
+            "_connect", "_table_exists", "_row_to_ref", "_matches_filters",
+            "_decode_content", "_content_text", "ref_envelope", "_ref_envelope",
+        )):
+            return None
+        return backend._context_snapshot(
+            self._scoped_filters(None),
+            record_store_id=self.record_store_id,
+            page=page,
+            exact=exact,
+            projection_limit=projection_limit,
+        )
+
     def _matches_default_search_scope(self, ref: RecordRef) -> bool:
         if not self.default_search_scope:
             return True
```

**File**: `docs/cn/development/release-notes-4.1.4.8.md` (modified, +5/-0)
```diff
@@ -101,6 +101,11 @@ execution = agent.input("写一份按章节组织的操作手册。").output({
 内置 SQLite RecordStore 和向量存储现在会在每次操作退出时关闭连接，保留原有
 提交、回滚及异常传播。这修复了连接泄漏，不改变公开调用、只读策略或惰性创建行为。
 
+内置 RecordStore 的上下文快照现在按实际可见范围校验版本，其他任务在范围外写入不会
+使当前 Reader 误失效；可见数据变化仍需要刷新。页面和精确读回使用同一只读事务的版本，
+ContextSource 不读取范围外记录，公共 RecordStore 读取不因此新增权限规则。
+自定义 provider/读取适配仍走原路径。版本检查仍需扫描元数据，不承诺与记录规模无关的开销。
+
 任务修复的结构化要求和证据标识现在会保留到下一轮规划，包含经摘要保存/恢复的路径；
 历史快照中已经丢失的要求不会被凭空重建。
 
```

**File**: `docs/cn/requests/workspace.md` (modified, +6/-0)
```diff
@@ -160,6 +160,12 @@ refresh 或创建新 reader。如果列举候选本身推进了 source revision
 candidate 需要相关性判断时，使用 Agently `ModelRequest` semantic selector；
 模型只返回宿主发放的 selection key，宿主校验后再重建 canonical record。
 
+原生 `RecordStoreContextSource` 的版本包含绑定视图的有效查询范围和可见记录元数据。
+范围外写入不使该视图过期，可见记录变化仍需刷新；页面与精确读回绑定同一次只读事务。
+该 source 的精确读取拒绝范围外记录，但公共 `RecordStore.read_bounded()` 不因此成为
+权限边界。自定义 provider、读取覆盖或显式 source revision 保留其原有路径，不自动获得
+原生范围版本保证。原生版本检查仍扫描元数据；巨量记录的成本需要按实际规模验证。
+
 ContextIndex 把 source descriptor 枚举成以 revision/profile/provider 为 key 的
 partition，可使用 `structural`、`lexical` 或宿主配置的 `hybrid` 候选检索；精确 bytes
 仍由 source 的 `async_read_exact(...)` 返回，或在 ref 选定后由可选的确定性 scoped-read
```

---

### Incident Patch 9: `cfaa5107` (2026-09-12)
**Commit Message**: fix: preserve structured task repair requirements in summary handoffs

**File**: `agently/builtins/plugins/AgentExecution/long_task/Verification.py` (modified, +21/-3)
```diff
@@ -88,14 +88,20 @@ def _iteration_prompt_summaries(self) -> list[dict[str, Any]]:
                 if isinstance(execution_meta, Mapping)
                 else {}
             )
+            material_claim_audit = verification.get("material_claim_audit")
             material_claim_projection = {
                 "valid": (
-                    verification.get("material_claim_audit", {}).get("valid")
-                    if isinstance(verification.get("material_claim_audit"), Mapping)
+                    material_claim_audit.get("valid")
+                    if isinstance(material_claim_audit, Mapping)
                     else None
                 ),
                 "repair_contract": DataFormatter.sanitize(
-                    verification.get("material_claim_repair_contract", {})
+                    verification.get(
+                        "material_claim_repair_contract",
+                        material_claim_audit.get("repair_contract", {})
+                        if isinstance(material_claim_audit, Mapping)
+                        else {},
+                    )
                 ),
             }
             terminal_convergence = verification.get("terminal_convergence")
@@ -114,6 +120,9 @@ def _iteration_prompt_summaries(self) -> list[dict[str, Any]]:
                         "replan_instruction": verification.get("replan_instruction", ""),
                         "repair_constraints": verification.get("repair_constraints", []),
                         "next_step_requirements": verification.get("next_step_requirements", []),
+                        "criterion_repair_contract": DataFormatter.sanitize(
+                            verification.get("criterion_repair_contract", {})
+                        ),
                         "material_claim_audit": material_claim_projection,
                         "terminal_convergence": (
                             DataFormatter.sanitize(terminal_convergence)
@@ -421,6 +430,15 @@ def normalize_list(value: Any) -> list[str]:
         replan_instruction = str(verification.get("replan_instruction") or "").strip()
         failure_analysis = str(verification.get("failure_analysis") or "").strip()
         material_claim_repair_contract = verification.get("material_claim_repair_contract")
+        if "material_claim_repair_contract" not in verification:
+            # Summary-only snapshots retain material repair under the audit view.
+            # Explicit empty/invalid top-level values must shadow stale nested data.
+            material_claim_audit = verification.get("material_claim_audit")
+            material_claim_repair_contract = (
+                material_claim_audit.get("repair_contract")
+                if isinstance(material_claim_audit, Mapping)
+                else None
+            )
         if not isinstance(material_claim_repair_contract, Mapping):
             material_claim_repair_contract = {}
         else:
```

**File**: `docs/cn/development/release-notes-4.1.4.8.md` (modified, +5/-2)
```diff
@@ -98,11 +98,14 @@ execution = agent.input("写一份按章节组织的操作手册。").output({
 }).auto_continue()
 ```
 
-## 本版补齐的 Examples
-
 内置 SQLite RecordStore 和向量存储现在会在每次操作退出时关闭连接，保留原有
 提交、回滚及异常传播。这修复了连接泄漏，不改变公开调用、只读策略或惰性创建行为。
 
+任务修复的结构化要求和证据标识现在会保留到下一轮规划，包含经摘要保存/恢复的路径；
+历史快照中已经丢失的要求不会被凭空重建。
+
+## 本版补齐的 Examples
+
 - `25_agent_execution_delivery_review_ollama.py`：真实本地 Qwen 生成、模型 review、
   blocking handler review 与物理 artifact readback。
 - `26_plan_execution_interaction_ollama.py`：一次 connected clarification exchange、
```

**File**: `docs/en/development/release-notes-4.1.4.8.md` (modified, +6/-2)
```diff
@@ -101,12 +101,16 @@ execution = agent.input("Write a chapter-organized operations manual.").output({
 }).auto_continue()
 ```
 
-## Examples Added For This Release
-
 The built-in SQLite RecordStore and vector store now close connections when each
 operation exits, preserving commit, rollback and error propagation. This fixes
 connection leaks without changing public calls, read-only policy or lazy creation.
 
+Structured task-repair requirements and evidence identities now survive the
+projection into subsequent planning, including saved/restored iteration summaries.
+Requirements already lost from historical snapshots are not reconstructed.
+
+## Examples Added For This Release
+
 - `examples/agent_auto_orchestration/25_agent_execution_delivery_review_ollama.py`
   proves real local-Qwen generation, model-backed review, required blocking handler
   review, and physical artifact readback.
```

**File**: `tests/test_task_repair_projection.py` (added, +245/-0)
```diff
@@ -0,0 +1,245 @@
+"""Deterministic repair-projection tests; all contracts and observations are synthetic."""
+from __future__ import annotations
+
+import json
+from copy import deepcopy
+from types import SimpleNamespace
+from typing import Any, Literal, cast
+
+import pytest
+
+from agently import Agently
+from agently.builtins.plugins.AgentExecution.long_task import Rework
+from agently.builtins.plugins.AgentExecution.modules.revisions import content_digest
+from agently.core.application.AgentTask import AgentTask
+from agently.core.model.ModelRequest import ModelRequest
+
+
+CRITERION = {
+    "gate_kind": "criterion",
+    "issue_code": "criterion_unsatisfied",
+    "contract_subject": "verification:criterion_checks",
+    "requirements": [{
+        "criterion_id": "criterion:1",
+        "gaps": ["Synthetic missing evidence binding."],
+        "evidence_ids": ["synthetic-evidence:1"],
+    }],
+}
+MATERIAL = {
+    "gate_kind": "factual_integrity",
+    "issue_code": "material_claim_audit_failed",
+    "contract_subject": "artifact:factual_integrity",
+    "requirements": [{
+        "claim_key": "synthetic-claim:1",
+        "carrier_id": "synthetic-carrier:1",
+        "content_version_id": "synthetic-version:1",
+        "state": "unsupported",
+        "required_for_criterion_ids": ["criterion:1"],
+        "evidence_ids": ["synthetic-evidence:1"],
+    }],
+}
+EXACT_URL = "https://evidence.invalid/source/item?revision=R%2F1"
+CONTRACTS = {
+    "criterion_repair_contract": CRITERION,
+    "material_claim_repair_contract": MATERIAL,
+}
+
+
+def _record(verification: dict[str, Any], *, anchors: bool = False) -> dict[str, Any]:
+    record = {
+        "iteration": 1,
+        "plan": {"step_instruction": "Synthetic bounded work.", "execution_shape": "direct"},
+        "verification": {"is_complete": False, **deepcopy(verification)},
+        "verification_ref": {"id": "synthetic-verification:1"},
+    }
+    if anchors:
+        record["execution_meta"] = {
+            "status": "completed",
+            "logs": {"route_logs": {}, "action_logs": [{
+                "action_id": "synthetic_lookup",
+                "action_call_id": "synthetic-call:1",
+                "status": "success",
+                "model_digest": {
+                    "result_preview": {"href": EXACT_URL, "revision": "R/1"},
+                    "result_preview_meta": {"truncated": False},
+                },
+            }]},
+        }
+    return record
+
+
+def _task(verification: dict[str, Any], *, restored: bool = False, anchors: bool = False) -> Any:
+    # Only initialize state used by the actual pure helpers; no live execution.
+    task = object.__new__(AgentTask)
+    task.options = {}
+    task.iterations = [_record(verification, anchors=anchors)]
+    task._resumed_iteration_summaries = []
+    if restored:
+        task._resumed_iteration_summaries = json.loads(json.dumps(task._iteration_prompt_summaries()))
+        task.iterations = []
+    return task
+
+
+@pytest.mark.parametrize("restored", [False, True])
+@pytest.mark.parametrize("keys", [
+    ("criterion_repair_contract",),
+    ("material_claim_repair_contract",),
+    ("criterion_repair_contract", "material_claim_repair_contract"),
+])
+def test_repair_projection_preserves_contracts_and_exact_anchors(restored, keys):
+    contracts = {key: CONTRACTS[key] for key in keys}
+    task = _task(contracts, restored=restored, anchors=True)
+    cold = deepcopy((task.iterations, task._resumed_iteration_summaries))
+    summaries = task._iteration_prompt_summaries()
+    context = task._planner_repair_context(summaries)
+    assert context == task._active_repair_context()
+    for key in keys:
+        assert context[key] == CONTRACTS[key]
+    assert context["verification_ref"] == {"id": "synthetic-verification:1"}
+    anchors = context["available_evidence_anchors"]
+    assert any(ref["value"] == EXACT_URL for ref in anchors["source_refs"])
+    assert anchors["action_re
```

---

### Incident Patch 10: `e2fb4c9f` (2026-09-12)
**Commit Message**: fix: close local sqlite connections after settling transactions

**File**: `agently/core/storage/LocalRecordStore.py` (modified, +11/-5)
```diff
@@ -21,7 +21,8 @@
 import sqlite3
 import time
 import uuid
-from collections.abc import AsyncIterator, Callable
+from collections.abc import AsyncIterator, Callable, Iterator
+from contextlib import contextmanager
 from datetime import datetime, timezone
 from pathlib import Path
 from typing import Any, cast
@@ -179,7 +180,8 @@ def ensure_vector_index(self) -> tuple[Any, Any]:
         )
         return self.embedding_provider, self.vector_store_provider
 
-    def _connect(self, *, write: bool = False) -> sqlite3.Connection:
+    @contextmanager
+    def _connect(self, *, write: bool = False) -> Iterator[sqlite3.Connection]:
         if write:
             if self.read_only:
                 raise RecordStorePolicyError("RecordStore persistence backend is read-only.")
@@ -190,9 +192,13 @@ def _connect(self, *, write: bool = False) -> sqlite3.Connection:
         if not self.db_path.exists() and not write:
             raise FileNotFoundError(f"RecordStore database does not exist: {self.db_path}")
         connection = sqlite3.connect(self.db_path, timeout=30)
-        connection.row_factory = sqlite3.Row
-        connection.execute("PRAGMA foreign_keys = ON")
-        return connection
+        try:
+            connection.row_factory = sqlite3.Row
+            connection.execute("PRAGMA foreign_keys = ON")
+            with connection:
+                yield connection
+        finally:
+            connection.close()
 
     @staticmethod
     def _create_records_table(connection: sqlite3.Connection) -> None:
```

**File**: `agently/core/storage/Stores.py` (modified, +11/-5)
```diff
@@ -18,7 +18,8 @@
 import inspect
 import math
 import sqlite3
-from collections.abc import Awaitable, Callable, Mapping, Sequence
+from collections.abc import Awaitable, Callable, Iterator, Mapping, Sequence
+from contextlib import contextmanager
 from pathlib import Path
 from typing import Any, Literal, cast
 
@@ -290,11 +291,16 @@ def __init__(
         if create and not read_only:
             self._initialize()
 
-    def _connect(self) -> sqlite3.Connection:
+    @contextmanager
+    def _connect(self) -> Iterator[sqlite3.Connection]:
         conn = sqlite3.connect(self.db_path, timeout=30.0)
-        conn.execute("PRAGMA busy_timeout=30000")
-        conn.row_factory = sqlite3.Row
-        return conn
+        try:
+            conn.execute("PRAGMA busy_timeout=30000")
+            conn.row_factory = sqlite3.Row
+            with conn:
+                yield conn
+        finally:
+            conn.close()
 
     def _initialize(self) -> None:
         self.db_path.parent.mkdir(parents=True, exist_ok=True)
```

**File**: `docs/cn/development/release-notes-4.1.4.8.md` (modified, +3/-0)
```diff
@@ -100,6 +100,9 @@ execution = agent.input("写一份按章节组织的操作手册。").output({
 
 ## 本版补齐的 Examples
 
+内置 SQLite RecordStore 和向量存储现在会在每次操作退出时关闭连接，保留原有
+提交、回滚及异常传播。这修复了连接泄漏，不改变公开调用、只读策略或惰性创建行为。
+
 - `25_agent_execution_delivery_review_ollama.py`：真实本地 Qwen 生成、模型 review、
   blocking handler review 与物理 artifact readback。
 - `26_plan_execution_interaction_ollama.py`：一次 connected clarification exchange、
```

**File**: `docs/en/development/release-notes-4.1.4.8.md` (modified, +4/-0)
```diff
@@ -103,6 +103,10 @@ execution = agent.input("Write a chapter-organized operations manual.").output({
 
 ## Examples Added For This Release
 
+The built-in SQLite RecordStore and vector store now close connections when each
+operation exits, preserving commit, rollback and error propagation. This fixes
+connection leaks without changing public calls, read-only policy or lazy creation.
+
 - `examples/agent_auto_orchestration/25_agent_execution_delivery_review_ollama.py`
   proves real local-Qwen generation, model-backed review, required blocking handler
   review, and physical artifact readback.
```

**File**: `tests/test_sqlite_connection_lifetime.py` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+"""Real temporary SQLite tests; no model calls or semantic acceptance claims."""
+from __future__ import annotations
+
+import asyncio
+from contextlib import closing, nullcontext
+import gc
+import sqlite3
+from typing import Any
+import warnings
+
+import pytest
+
+from agently.core.storage.Errors import RecordStorePolicyError
+from agently.core.storage.LocalRecordStore import LocalRecordStore
+from agently.core.storage.Stores import SQLiteVectorStoreProvider
+
+
+@pytest.fixture
+def connections(monkeypatch):
+    original = sqlite3.connect
+    opened = []
+    failure = {"sql_prefix": ""}
+
+    class TrackedConnection(sqlite3.Connection):
+        closed = False
+
+        def execute(self, sql: str, parameters: Any = ()):
+            if failure["sql_prefix"] and sql.startswith(failure["sql_prefix"]):
+                raise sqlite3.OperationalError("Injected SQLite setup failure")
+            return super().execute(sql, parameters)
+
+        def close(self) -> None:
+            self.closed = True
+            super().close()
+
+    def connect(*args, **kwargs):
+        kwargs["factory"] = TrackedConnection
+        connection = original(*args, **kwargs)
+        opened.append(connection)
+        return connection
+
+    monkeypatch.setattr(sqlite3, "connect", connect)
+    try:
+        yield opened, failure, original
+    finally:
+        # A failing regression must not leak its own connections into later tests.
+        for connection in opened:
+            connection.close()
+
+
+def store_for(kind, tmp_path):
+    if kind == "records":
+        return LocalRecordStore(tmp_path)
+    return SQLiteVectorStoreProvider(tmp_path / "vectors.db", create=False)
+
+
+def connect_to(store):
+    return store._connect(write=True) if isinstance(store, LocalRecordStore) else store._connect()
+
+
+@pytest.mark.parametrize("kind", ["records", "vectors"])
+@pytest.mark.parametrize("outcome", ["success", "error", "cancel"])
+def test_transaction_settles_then_closes(tmp_path, connections, kind, outcome):
+    opened, _failure, original = connections
+    store = store_for(kind, tmp_path)
+    error_type = asyncio.CancelledError if outcome == "cancel" else RuntimeError
+    expected_error = pytest.raises(error_type) if outcome != "success" else nullcontext()
+    with expected_error:
+        with connect_to(store) as connection:
+            connection.execute("CREATE TABLE probe (value INTEGER)")
+            connection.commit()
+            connection.execute("INSERT INTO probe VALUES (7)")
+            if outcome != "success":
+                raise error_type("exercise transaction exit")
+    assert len(opened) == 1
+    assert opened[0].closed
+    with pytest.raises(sqlite3.ProgrammingError):
+        opened[0].execute("SELECT 1")
+    # Inspect persisted data using a separate explicitly closed real connection.
+    with closing(original(store.db_path)) as readback:
+        values = [row[0] for row in readback.execute("SELECT value FROM probe").fetchall()]
+    assert values == ([7] if outcome == "success" else [])
+
+
+@pytest.mark.parametrize("kind", ["records", "vectors"])
+def test_setup_error_closes_before_yield(tmp_path, connections, kind):
+    opened, failure, _original = connections
+    store = store_for(kind, tmp_path)
+    failure["sql_prefix"] = "PRAGMA"
+    with pytest.raises(sqlite3.OperationalError, match="Injected SQLite setup failure"):
+        with connect_to(store):
+            raise AssertionError("Setup failure must not enter the caller's block")
+    assert len(opened) == 1
+    assert opened[0].closed
+
+
+@pytest.mark.parametrize("kind", ["records", "vectors"])
+def test_commit_error_rolls_back_and_closes(tmp_path, connections, kind):
+    opened, _failure, original = connections
+    store = store_for(kind, tmp_path)
+    # A real deferred constraint fails during SQLite's context-exit commit.
+    with pytest.raises(sqlite3.IntegrityError):
+        with connect_to(store) 
```

#### Recent Merged Pull Requests:
- **PR #364** (2026-09-12): release: complete 4.1.4.8 validation and publication metadata (@Maplemx)
- **PR #363** (2026-09-12): Release 4.1.4.8: execution, output delivery, audio and Shell (@Maplemx)
- **PR #360** (2026-08-24): docs: align Agently 4.1.4.7 with Skills catalog v3 (@Maplemx)
- **PR #357** (2026-08-17): Fix Landlock virtualenv release validation (@Maplemx)
- **PR #356** (2026-08-17): Fix Agently 4.1.4.7 release validation (@Maplemx)
- **PR #355** (2026-08-17): Release Agently 4.1.4.7 (@Maplemx)
- **PR #354** (2026-08-17): fix: keep sandbox provider selection out of core (@Maplemx)
- **PR #353** (2026-08-17): feat: integrate bounded-helper Linux Landlock provider (@Maplemx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
