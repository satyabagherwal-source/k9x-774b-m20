# Forensic Learning Record (Deep Inspection): evalstate/fast-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/evalstate-fast-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/evalstate/fast-agent](https://github.com/evalstate/fast-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:32:18.563Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `evalstate/fast-agent`
- **Description**: Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3925 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/a2a/agent_executor.py`
```
from __future__ import annotations

from typing import TYPE_CHECKING

from a2a.server.agent_execution import AgentExecutor
from a2a.server.tasks.task_updater import TaskUpdater
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentInterface,
    AgentProvider,
    AgentSkill,
    Part,
)

from fast_agent import AgentHarness, AgentRequest, FastAgent

if TYPE_CHECKING:
    from a2a.server.agent_execution import RequestContext
    from a2a.server.events import EventQueue

DEFAULT_AGENT_NAME = "helper"

fast = FastAgent(
    "A2A fast-agent Demo",
    parse_cli_args=False,
    quiet=True,
)


@fast.agent(
    name=DEFAULT_AGENT_NAME,
    instruction="You are a helpful AI agent answering incoming A2A messages.",
    default=True,
)
async def helper() -> None:
    """Default agent registered with FastAgent."""
    pass


class A2AHarnessAdapter:
    """Translate A2A request context into the protocol-neutral harness API."""

    def __init__(
        self,
        harness: AgentHarness,
        *,
        default_agent_name: str = DEFAULT_AGENT_NAME,
    ) -> None:
        self._harness = harness
        self._default_agent_name = default_agent_name

    async def invoke(self, context: RequestContext) -> str:
        request = AgentRequest.text(
            context.get_user_input().strip(),
            agent=self._default_agent_name,
            session_id=context.context_id,
            metadata={"a2a_task_id": context.task_id or ""},
        )
        response = await self._harness.invoke(request)
        return response.text_content()


class FastAgentExecutor(AgentExecutor):
    """A2A AgentExecutor that proxies requests to a FastAgent harness."""

    def __init__(self, adapter: A2AHarnessAdapter) -> None:
        self._adapter = adapter

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        if not context.message or not context.task_id or not context.context_id:
            return

        updater = TaskUpdater(
            event_queue=event_queue,
            task_id=context.task_id,
            context_id=context.context_id,
        )
        await updater.start_work(
            message=updater.new_agent_message(parts=[Part(text="fast-agent is working")])
        )
        response_text = await self._adapter.invoke(context)
        await updater.add_artifact(
            parts=[Part(text=response_text)],
            name="response",
            append=False,
            last_chunk=True,
        )
        await updater.complete()

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        if not context.task_id or not context.context_id:
            return
        updater = TaskUpdater(
            event_queue=event_queue,
            task_id=context.task_id,
            context_id=context.context_id,
        )
        await updater.cancel()


def agent_card(*, host: str, port: int) -> AgentCard:
    base_url = f"http://{_url_host(host)}:{port}"
    return AgentCard(
        name="fast-agent A2A harness demo",
        description="A fast-agent harness exposed through an explicit A2A adapter.",
        provider=AgentProvider(organization="fast-agent", url="https://fast-agent.ai"),
        version="1.0.0",
        capabilities=AgentCapabilities(streaming=False, push_notifications=False),
        default_input_modes=["text/plain"],
        default_output_modes=["text/plain"],
        skills=[
            AgentSkill(
                id=DEFAULT_AGENT_NAME,
                name=DEFAULT_AGENT_NAME,
                description="Send a message to the helper fast-agent agent.",
                tags=["fast-agent", "helper"],
                examples=["Hello"],
                input_modes=["text/plain"],
                output_modes=["text/plain"],
            )
        ],
        supported_interfaces=[
            AgentInterface(
                protocol_binding="JSONRPC",
                protocol_version="1.0",
                url=f"{base_url}/a2a/jsonrpc",
            ),
            AgentInterface(
                protocol_binding="HTTP+JSON",
                protocol_version="1.0",
                url=f"{base_url}/a2a/rest",
            ),
        ],
    )


def _url_host(bind_host: str) -> str:
    if bind_host in {"0.0.0.0", "::", ""}:
        return "localhost"
    if ":" in bind_host and not bind_host.startswith("["):
        return f"[{bind_host}]"
    return bind_host

```

### Core Architecture Module: `examples/a2a/facts_server.py`
```
import asyncio
import os

from fast_agent import FastAgent

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "41241"))
MODEL = os.getenv("FAST_AGENT_MODEL", os.getenv("MODEL", "codexresponses.gpt-5.4-mini"))

fast = FastAgent(
    "fast-agent facts A2A server",
    parse_cli_args=False,
    quiet=True,
)


@fast.agent(
    name="facts_agent",
    model=MODEL,
    instruction="You are a helpful agent who can provide interesting facts.",
    default=True,
)
async def facts_agent() -> None:
    """Default A2A facts agent."""
    pass


async def main() -> None:
    await fast.start_server(
        transport="a2a",
        host=HOST,
        port=PORT,
        server_name="facts_agent",
        server_description="Agent to give interesting facts.",
        instance_scope="connection",
    )


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/a2a/research/server.py`
```
from __future__ import annotations

import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING

import uvicorn
from a2a.server.agent_execution import AgentExecutor
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes, create_rest_routes
from a2a.server.tasks.inmemory_task_store import InMemoryTaskStore
from a2a.server.tasks.task_updater import TaskUpdater
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentInterface,
    AgentProvider,
    AgentSkill,
    HTTPAuthSecurityScheme,
    Message,
    Part,
    Role,
    SecurityRequirement,
    SecurityScheme,
    StringList,
    Task,
    TaskState,
    TaskStatus,
)
from fastapi import FastAPI

from fast_agent import AgentHarness, AgentRequest, FastAgent, RequestParams
from fast_agent.a2a.server import (
    A2A_HF_BEARER_SCHEME,
    A2ABearerAuthMiddleware,
    A2AServerCallContextBuilder,
)

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Callable

    from a2a.server.agent_execution import RequestContext
    from a2a.server.events import EventQueue
    from mcp_types import ContentBlock

    from fast_agent.tools.execution_environment import ShellEnvironment
    from fast_agent.types import AgentResponse

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8002"))

QUICK_REFINER_AGENT = "research_refiner"
RESEARCH_WORKER_AGENT = "research_worker"
FAST_AGENT_HOME = Path(__file__).with_name(".fast-agent")
RESEARCH_WORKSPACE = "/workspace"
RESEARCH_PROGRESS_HEARTBEAT_SECONDS = 2.0

fast = FastAgent(
    "fast-agent research A2A server",
    home=FAST_AGENT_HOME,
    parse_cli_args=False,
    quiet=True,
)


class ResearchDecisionKind(StrEnum):
    NEEDS_REFINEMENT = "needs_refinement"
    BEGIN_RESEARCH = "begin_research"


@dataclass(frozen=True, slots=True)
class ResearchDecision:
    kind: ResearchDecisionKind
    message: str
    goal: str | None = None

    def to_json(self) -> str:
        return json.dumps(
            {
                **asdict(self),
                "kind": self.kind.value,
            },
            sort_keys=True,
        )

    @classmethod
    def from_json(cls, value: str) -> "ResearchDecision":
        data = json.loads(value)
        return cls(
            kind=ResearchDecisionKind(data["kind"]),
            message=str(data["message"]),
            goal=data.get("goal") if isinstance(data.get("goal"), str) else None,
        )


@dataclass(frozen=True, slots=True)
class ResearchRuntimeInfo:
    """Execution environment attached to one accepted research task."""

    environment_label: str
    bucket: str | None = None
    bucket_path: str | None = None

    def status_text(self) -> str:
        if self.bucket is None:
            return f"Research execution environment ready: {self.environment_label}."
        return (
            "Research execution environment ready: "
            f"{self.environment_label}; bucket {self.bucket}/{self.bucket_path or ''}."
        )


class ResearchRuntime:
    """Runtime used to invoke the research worker."""

    def __init__(self, harness: AgentHarness, info: ResearchRuntimeInfo) -> None:
        self._harness = harness
        self.info = info

    async def research(
        self,
        context: RequestContext,
        decision: ResearchDecision,
        *,
        progress_handler: "A2ATaskProgressHandler | None" = None,
    ) -> AgentResponse:
        session_id = _session_id(context)
        request_params = _research_request_params(progress_handler)
        return await self._harness.invoke(
            AgentRequest.text(
                decision.goal or context.get_user_input().strip(),
                agent=RESEARCH_WORKER_AGENT,
                session_id=session_id,
                params=request_params,
                metadata={
                    "transport": "a2a",
                    "phase": "research_task",
                    "a2a_task_id": context.task_id or "",
                    "research_environment": self.info.environment_label,
                    "research_bucket": self.info.bucket or "",
                    "research_bucket_path": self.info.bucket_path or "",
                },
            )
        )


class A2ATaskProgressHandler:
    """Forward fast-agent loop/tool progress to A2A task status updates."""

    def __init__(self, updater: TaskUpdater) -> None:
        self._updater = updater
        self._tool_labels: dict[str, str] = {}
        self._counter = 0

    async def on_tool_start(
        self,
        tool_name: str,
        server_name: str,
        arguments: dict | None,
        tool_use_id: str | None = None,
    ) -> str:
        del arguments
        self._counter += 1
        tool_call_id = tool_use_id or f"a2a-progress-{self._counter}"
        self._tool_labels[tool_call_id] = _progress_label(tool_name, server_name)
        await self.report(f"{self._tool_labels[tool_call_id]} started")
        return tool_call_id

    async def on_tool_progress(
        self,
        tool_call_id: str,
        progress: float,
        total: float | None,
        message: str | None,
    ) -> None:
        label = self._tool_labels.get(tool_call_id, "Research step")
        suffix = message or _progress_counter_text(progress, total)
        await self.report(f"{label}: {suffix}" if suffix else label)

    async def on_tool_complete(
        self,
        tool_call_id: str,
        success: bool,
        content: "list[ContentBlock] | None",
        error: str | None,
    ) -> None:
        del content
        label = self._tool_labels.pop(tool_call_id, "Research step")
        if success:
            await self.report(f"{label} completed")
            return
        detail = f": {error}" if error else ""
        await self.report(f"{label} failed{detail}")

    async def on_tool_permission_denied(
        self,
        tool_name: str,
        server_name: str,
        tool_use_id: str | None,
        error: str | None = None,
    ) -> None:
        del tool_use_id
        label = _progress_label(tool_name, server_name)
        detail = f": {error}" if error else ""
        await self.report(f"{label} permission denied{detail}")

    async def get_tool_call_id_for_tool_use(self, tool_use_id: str) -> str | None:
        if tool_use_id in self._tool_labels:
            return tool_use_id
        return None

    async def ensure_tool_call_exists(
        self,
        tool_call_id: str,
        tool_name: str,
        server_name: str,
        arguments: dict | None = None,
    ) -> str:
        del arguments
        if tool_call_id not in self._tool_labels:
            self._tool_labels[tool_call_id] = _progress_label(tool_name, server_name)
        return tool_call_id

    async def report(self, message: str) -> None:
        await self._updater.update_status(
            TaskState.TASK_STATE_WORKING,
            message=self._updater.new_agent_message(parts=[Part(text=message)]),
        )


@dataclass(frozen=True, slots=True)
class HuggingFaceResearchEnvironmentConfig:
    """Configuration for per-task Hugging Face Sandbox research execution."""

    bucket: str
    image: str = "python:3.12"
    flavor: str = "cpu-basic"
    token: str | None = None
    namespace: str | None = None
    forward_hf_token: bool = False
    create_bucket: bool = True
    private_bucket: bool | None = None


class ResearchRuntimeFactory:
    """Create the execution runtime for an accepted research task."""

    def __init__(
        self,
        shared_harness: AgentHarness,
        *,
        hf_config: HuggingFaceResearchEnvironmentConfig | None = None,
        fast_agent_factory: Callable[[], FastAgent] | None = None,
        environment_factory: Callable[
            [HuggingFaceResearchEnvironmentConfig, str, str], S
```

### Core Architecture Module: `examples/a2a/server.py`
```
import asyncio

import uvicorn
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes, create_rest_routes
from a2a.server.routes.common import DefaultServerCallContextBuilder
from a2a.server.tasks.inmemory_task_store import InMemoryTaskStore
from agent_executor import A2AHarnessAdapter, FastAgentExecutor, agent_card, fast
from fastapi import FastAPI

HOST = "127.0.0.1"
PORT = 9999


async def main() -> None:
    card = agent_card(host=HOST, port=PORT)
    async with fast.harness() as harness:
        request_handler = DefaultRequestHandler(
            agent_executor=FastAgentExecutor(A2AHarnessAdapter(harness)),
            task_store=InMemoryTaskStore(),
            agent_card=card,
        )
        context_builder = DefaultServerCallContextBuilder()
        app = FastAPI(title=card.name)
        app.routes.extend(create_agent_card_routes(agent_card=card))
        app.routes.extend(
            create_jsonrpc_routes(
                request_handler=request_handler,
                rpc_url="/a2a/jsonrpc",
                context_builder=context_builder,
            )
        )
        app.routes.extend(
            create_rest_routes(
                request_handler=request_handler,
                path_prefix="/a2a/rest",
                context_builder=context_builder,
            )
        )

        server = uvicorn.Server(uvicorn.Config(app, host=HOST, port=PORT, log_level="warning"))
        await server.serve()


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/acp/acp_aware_agent.py`
```
"""
Example: ACP-Aware Agent

This example demonstrates how to create a custom agent that is aware of
the Agent Client Protocol (ACP) context. When running via ACP (e.g., through
Claude Code or another ACP client), the agent can:

- Detect it's running in ACP mode
- Access client capabilities (terminal, filesystem, etc.)
- Declare slash commands via the acp_commands property
- Switch modes to other agents
- Access terminal and filesystem runtimes provided by the client

When NOT running via ACP (e.g., directly via CLI), the agent gracefully
falls back to standard behavior.
"""

import asyncio
from typing import TYPE_CHECKING

from fast_agent import FastAgent
from fast_agent.acp import ACPAwareMixin, ACPCommand
from fast_agent.acp.acp_aware_mixin import ACPModeInfo
from fast_agent.agents import McpAgent

if TYPE_CHECKING:
    from fast_agent.agents.agent_types import AgentConfig
    from fast_agent.context import Context

# Create the FastAgent application
fast = FastAgent("ACP Aware Example")


class ACPAwareAgent(ACPAwareMixin, McpAgent):
    """
    A custom agent that is aware of the ACP context.

    This agent demonstrates how to use the ACPAwareMixin to access
    ACP features when available, while maintaining compatibility
    with non-ACP execution modes.
    """

    def __init__(
        self,
        config: "AgentConfig",
        context: "Context | None" = None,
        **kwargs,
    ) -> None:
        """Initialize the agent with proper MRO handling."""
        # Call McpAgent's __init__ directly to ensure proper initialization
        McpAgent.__init__(self, config=config, context=context, **kwargs)
        # Store context for ACPAwareMixin (inherited from ContextDependent)
        self._context = context

    @property
    def acp_commands(self) -> dict[str, ACPCommand]:
        """
        Declare slash commands for this agent.

        These commands are automatically available when this agent is the
        active mode in an ACP session. Commands are queried dynamically,
        so they update when the mode changes.
        """
        return {
            "agent-status": ACPCommand(
                description="Show ACP connection status for this agent",
                handler=self._handle_status_command,
            ),
            "capabilities": ACPCommand(
                description="List client capabilities",
                handler=self._handle_capabilities_command,
            ),
        }

    async def _handle_status_command(self, arguments: str) -> str:
        """Handler for the /agent-status slash command."""
        return (
            f"ACP Status:\n"
            f"  Session: {self.acp_session_id}\n"
            f"  Mode: {self.acp_current_mode}\n"
            f"  Available modes: {', '.join(self.acp_available_modes())}"
        )

    async def _handle_capabilities_command(self, arguments: str) -> str:
        """Handler for the /capabilities slash command."""
        caps = []
        if self.acp_supports_terminal:
            caps.append("terminal")
        if self.acp_supports_fs_read:
            caps.append("filesystem-read")
        if self.acp_supports_fs_write:
            caps.append("filesystem-write")

        if caps:
            return f"Client capabilities: {', '.join(caps)}"
        return "No special capabilities detected"


class ACPAwareAgent2(ACPAwareMixin, McpAgent):
    """
    A custom agent that is aware of the ACP context.

    This agent demonstrates how to use the ACPAwareMixin to access
    ACP features when available, while maintaining compatibility
    with non-ACP execution modes.
    """

    def __init__(
        self,
        config: "AgentConfig",
        context: "Context | None" = None,
        **kwargs,
    ) -> None:
        """Initialize the agent with proper MRO handling."""
        # Call McpAgent's __init__ directly to ensure proper initialization
        McpAgent.__init__(self, config=config, context=context, **kwargs)
        # Store context for ACPAwareMixin (inherited from ContextDependent)
        self._context = context

    @property
    def acp_commands(self) -> dict[str, ACPCommand]:
        """
        Declare slash commands for this agent.

        These commands are automatically available when this agent is the
        active mode in an ACP session. Commands are queried dynamically,
        so they update when the mode changes.
        """
        return {
            "foo": ACPCommand(
                input_hint="input hint",
                description="Show ACP connection status for this agent",
                handler=self._handle_foo_command,
            ),
            "bar": ACPCommand(
                description="List client capabilities",
                handler=self._handle_bar_command,
            ),
        }

    async def _handle_foo_command(self, arguments: str) -> str:
        """Handler for the /foo slash command."""
        return "FOO"

    async def _handle_bar_command(self, arguments: str) -> str:
        """Handler for the /bar slash command."""
        return "BAR"

    def acp_mode_info(self) -> ACPModeInfo | None:
        return ACPModeInfo(name="FooBar Agent", description="A custom agent with custom commands")


# Use the @fast.custom decorator to register our custom agent class
@fast.custom(
    ACPAwareAgent,
    name="acp_agent",
    instruction="""You are an ACP-aware assistant. When running via ACP (Agent Client Protocol),
you have access to additional capabilities provided by the client such as terminal
and filesystem access.

You can help users with tasks that leverage these capabilities when available.
When not running via ACP, you function as a standard helpful assistant.""",
    default=True,
)
@fast.custom(ACPAwareAgent2, name="another_agent", instruction="do it!")
async def main() -> None:
    """Run the ACP-aware agent."""
    async with fast.run() as agent:
        # In interactive mode, the agent will:
        # - Detect if running via ACP and configure itself accordingly
        # - Provide slash commands if running via ACP client
        # - Fall back to standard CLI behavior otherwise
        await agent.interactive()


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/copilot/image_upload_probe.py`
```
"""Live, billable Copilot image smoke; requires normal Copilot authentication.

Run from the repo: uv run examples/copilot/image_upload_probe.py --transport both
Claude always uses SSE; --transport selects GPT transports. No session replay.
Only synthetic data is sent. Provider output, URLs and exception text are suppressed.
"""

import argparse
import asyncio
import base64
import logging
import os
import secrets
from contextlib import redirect_stderr, redirect_stdout
from io import BytesIO
from typing import Any, Literal, TextIO

from mcp.types import ImageContent
from PIL import Image, ImageDraw, ImageFont

from fast_agent.config import LoggerSettings, Settings
from fast_agent.context import Context
from fast_agent.llm.provider.copilot.broker import CopilotEndpoint
from fast_agent.llm.provider.copilot.images import CopilotImageUploads
from fast_agent.llm.provider.copilot.messages import CopilotMessagesLLM
from fast_agent.llm.provider.copilot.responses import CopilotResponsesLLM
from fast_agent.mcp.prompt import Prompt
from fast_agent.types import LlmStopReason, RequestParams


class ObservedUploads(CopilotImageUploads):
    """Observe real normalization, including cache reuse; never expose URLs."""

    def __init__(self) -> None:
        super().__init__()
        self.urls: list[tuple[str, ...]] = []

    # Any is restricted to the adapter's heterogeneous SDK payload boundary.
    async def normalize(self, payload: dict[str, Any], endpoint: CopilotEndpoint) -> dict[str, Any]:
        result = await super().normalize(payload, endpoint)
        urls: list[str] = []
        for item in result.get("messages", result.get("input", [])):
            blocks: list[dict[str, Any]] = []
            self._content(item.get("content", []), blocks)
            for block in blocks:
                if self._is_url(block):
                    url = block["source"]["url"] if block["type"] == "image" else block["image_url"]
                    urls.append(url)
        self.urls.append(tuple(urls))
        return result


def synthetic_png(code: str) -> ImageContent:
    image = Image.new("RGB", (800, 240), "white")
    ImageDraw.Draw(image).text((40, 65), code, fill="black", font=ImageFont.load_default(size=80))
    output = BytesIO()
    image.save(output, format="PNG")
    return ImageContent(
        type="image", mimeType="image/png", data=base64.b64encode(output.getvalue()).decode()
    )


async def probe(model: str, transport: Literal["sse", "websocket"]) -> None:
    context = Context(
        config=Settings(
            logger=LoggerSettings(
                type="none", progress_display=False, show_chat=False, show_tools=False
            )
        )
    )
    llm = (
        CopilotMessagesLLM(context=context, model=model, transport=transport)
        if model.startswith("claude")
        else CopilotResponsesLLM(context=context, model=model, transport=transport)
    )
    uploads = ObservedUploads()
    llm._image_uploads = uploads
    code = "".join(secrets.choice("23456789") for _ in range(6))
    original = Prompt.user(
        "Read the six-digit code in the image. Reply only with the code.", synthetic_png(code)
    )
    snapshot = original.model_dump()
    params = RequestParams(max_tokens=4096)
    try:
        async with asyncio.timeout(240):
            first = await llm.generate([original], request_params=params)
            if first.stop_reason == LlmStopReason.ERROR or first.all_text().strip() != code:
                raise AssertionError("first turn failed")
            first_urls = uploads.urls[-1]
            if len(first_urls) != 1:
                raise AssertionError("image was not uploaded")
            count = len(uploads.urls)
            second = await llm.generate(
                [
                    original,
                    first,
                    Prompt.user("Read the original image again. Reply only with the code."),
                ],
                request_params=params,
            )
            if second.stop_reason == LlmStopReason.ERROR or second.all_text().strip() != code:
                raise AssertionError("second turn failed")
            if len(uploads.urls) <= count or any(
                urls != first_urls for urls in uploads.urls[count:]
            ):
                raise AssertionError("history URL reuse failed")
            if original.model_dump() != snapshot:
                raise AssertionError("canonical history changed")
    finally:
        if isinstance(llm, CopilotResponsesLLM):
            await llm.close()


async def main(sink: TextIO) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--transport",
        choices=("sse", "websocket", "both"),
        default="both",
        help="GPT transport(s); Claude always uses SSE (default: both)",
    )
    args = parser.parse_args()
    cases: list[tuple[str, Literal["sse", "websocket"]]] = [("claude-opus-5.5", "sse")]
    for transport in ("sse", "websocket"):
        if args.transport in (transport, "both"):
            cases.append(("gpt-6-astra", transport))
    logging.disable(logging.CRITICAL)
    failed = False
    for model, transport in cases:
        try:
            with redirect_stdout(sink), redirect_stderr(sink):
                await probe(model, transport)
            print(f"{model} {transport}: PASS (code read; history URL reused)")
        except Exception as error:
            failed = True
            print(f"{model} {transport}: FAIL ({type(error).__name__})")
    return int(failed)


if __name__ == "__main__":
    with open(os.devnull, "w") as sink:
        raise SystemExit(asyncio.run(main(sink)))

```

### Core Architecture Module: `examples/copilot/sonnet_progress.py`
```
"""Live, billable Sonnet 5.5 progress demo using the normal harness/tool loop.

Run: uv run examples/copilot/sonnet_progress.py --mode all
Requires Copilot login. Sends only synthetic data; never prints credentials or signatures.
"""

import argparse
import asyncio
from dataclasses import dataclass
from time import monotonic
from typing import Literal

from fast_agent import FastAgent
from fast_agent.llm.stream_types import StreamChunk
from fast_agent.types import LlmStopReason, RequestParams

type DisplayMode = Literal["default", "summarized", "omitted", "between_tools"]
MODES: tuple[DisplayMode, ...] = ("default", "summarized", "omitted", "between_tools")


@dataclass(frozen=True)
class Observation:
    seconds: float
    completed_tools: int
    kind: str
    text: str


async def demonstrate(mode: DisplayMode) -> None:
    model = "copilot.sonnet55"
    if mode == "between_tools":
        model += "?reasoning=off"
    fast = FastAgent(f"Sonnet progress: {mode}", ignore_unknown_args=True)
    observations: list[Observation] = []
    calls: list[str] = []
    start = monotonic()

    @fast.tool
    def read_station(station: Literal["inventory", "sample", "verification"]) -> str:
        """Read a synthetic station report. Follow the next_station in each result."""
        calls.append(station)
        observations.append(Observation(monotonic() - start, len(calls), "tool", station))
        match station:
            case "inventory":
                return "Batch LANTERN has 12 sealed containers. next_station: sample."
            case "sample":
                return "Sample temperature is 18 C, within the 15-20 C target. next_station: verification."
            case "verification":
                return "All 12 seals passed inspection. Final status: READY."

    def observe(chunk: StreamChunk) -> None:
        if chunk.event == "delta" and chunk.text:
            observations.append(
                Observation(
                    monotonic() - start,
                    len(calls),
                    "thinking" if chunk.is_reasoning else "text",
                    chunk.text,
                )
            )

    @fast.agent(
        "probe",
        model=model,
        instruction=(
            "Run the requested inspection using the provided tool. Before each tool call, "
            "give a public-facing progress update of 80-100 words in four sentences: what "
            "was observed, which station you will check next, and what that check establishes. "
            "Describe actions and observable results, not private reasoning. "
            "Make sequential tool calls, following next_station. Do not skip stations."
        ),
    )
    async def run() -> None:
        async with fast.run() as agent:
            remove = agent.probe.add_stream_listener(observe)
            params = RequestParams(max_tokens=4096, max_iterations=6)
            if mode in {"summarized", "omitted"}:
                params.metadata = {"thinking": {"type": "adaptive", "display": mode}}
            try:
                response = await agent.probe.generate(
                    "Inspect batch LANTERN, starting at inventory. Report the final status.",
                    request_params=params,
                )
            finally:
                remove()
            assert response.stop_reason == LlmStopReason.END_TURN, response.stop_reason
            assert calls == ["inventory", "sample", "verification"], calls
            assert "READY" in response.all_text().upper()

    print(f"\n=== {mode} ===", flush=True)
    await run()
    print(f"\n=== {mode}: observed stream timeline ===")
    # Group deltas by tool boundary and channel. Never display opaque signed blocks.
    for completed in range(4):
        for kind in ("thinking", "text"):
            chunks = [
                item
                for item in observations
                if item.completed_tools == completed and item.kind == kind
            ]
            if chunks:
                text = "".join(item.text for item in chunks)
                print(
                    f"+{chunks[0].seconds:.2f}s after {completed} tools: "
                    f"{kind}, {len(text)} chars: {text[:300]!r}"
                )
        if completed < len(calls):
            tool = next(
                item
                for item in observations
                if item.kind == "tool" and item.completed_tools == completed + 1
            )
            print(f"+{tool.seconds:.2f}s tool: {tool.text}")
    between = [
        item for item in observations if item.kind == "thinking" and 0 < item.completed_tools < 3
    ]
    print(f"Between-tool thinking-summary characters: {sum(len(item.text) for item in between)}")
    visible = [
        item
        for item in observations
        if item.kind in {"thinking", "text"} and 0 < item.completed_tools < 3
    ]
    print(f"All between-tool visible characters: {sum(len(item.text) for item in visible)}")
    if mode != "omitted":
        assert visible, f"No between-tool progress observed for {mode}"


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=(*MODES, "all"), default="all")
    args = parser.parse_args()
    for mode in MODES:
        if args.mode in ("all", mode):
            await demonstrate(mode)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/custom-agents/agent.py`
```
import asyncio

from fast_agent import FastAgent
from fast_agent.agents import McpAgent

# Create the application
fast = FastAgent("fast-agent example")


class MyAgent(McpAgent):
    async def initialize(self):
        await super().initialize()
        print("it's a-me!...Mario!")


# Define the agent
@fast.custom(MyAgent, instruction="You are a helpful AI Agent")
async def main():
    # use the --model command line switch or agent arguments to change model
    async with fast.run() as agent:
        await agent.interactive()


if __name__ == "__main__":
    asyncio.run(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #993** (2026-09-29): **fast-agent 0.10.41: fix inline PDFs on Copilot Responses and Claude**
  *Symptoms*: ## Summary  Prepare fast-agent **0.10.41**, fixing locally rejected inline PDF attachments on Copilot Responses and Anthropic/Claude Messages.  - Separate inline documents from unsupported provider Files APIs. Keep hosted file IDs and document URL references rejected, including nested tool results. - Normalize Responses bare base64 file bytes to MIME data URLs without changing history or routing images through the OpenAI Files API. - Allow Claude inline PDF/text/content sources without enabling Anthropic document uploads. - Cover user attachments, `attach_media` tool results, idempotence, shorthand message content, unchanged history, and preserved hosted-file restrictions. - Bump main version/lock and synchronize both ACP wrappers to 0.10.41. Document supported behavior.  ## Evidence and tests  - Before the policy fix, all eight new positive document/parent-loop regressions failed. - Direct gateway synthetic PDF requests succeeded for GPT-6 Luna and Claude Sonnet 5.5: each read a code present only inside the PDF. - Adapter-level testing then found that Responses additionally requires MIME-prefixed data, rather than the bare base64 generated by our content converter. Fixed and regression-tested. - Final live readback passed through **Responses SSE**, **Responses WebSocket**, and **Claude Messages SSE**. Repeated successfully with the **built wheel installed in an isolated environment**. Original history unchanged. - `uv run pytest tests/unit -n 4 -q --tb=short`: **9,107 passed
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>c1dbc39</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://27176cc4.fast-agent.pages.dev'>https://27176cc4.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://fix-copilot-inline-documents.fast-agent.pages.dev'>https://fix-copilot-inline-documents.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/27176cc4-c946-4046-a1ee-357ca5ae0bad) 
  > All PR CI checks are now green, including unit tests, all three integration groups, package checks, static checks and CodeQL. The isolated 0.10.41 wheel also passed live PDF readback through Copilot Responses SSE/WebSocket and Claude Messages SSE. Release artifacts are prepared locally; no merge, version tag or publication performed.

- **Issue #992** (2026-09-29): **fast-agent 0.10.40: GPT-6.1 Sol (responses, codexresponses, copilot), openai 3.21.0**
  *Symptoms*: ## Summary  Adds [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) on the OpenAI API-key (`responses`), Codex OAuth (`codexresponses`) and Copilot routes.  - **Model params:** reuses the GPT-6 Sol layout (freeform `shell` + `write_text_file`/`edit_file`, SSE+websocket, `fast`/`flex` tiers, Lite opt-in, 272k default with opt-in long context of 1.05M on `responses` / 872k on `codexresponses`). One difference from GPT-6 Sol: like Astra, it only accepts `low`, `medium` (default), `high`, `xhigh`, `max` reasoning. `none` and `minimal` are rejected. - **Aliases (⚠️ behaviour change):** `sol` now maps to `codexresponses.gpt-6.1-sol?reasoning=medium`. GPT-6 Sol is still available as `sol6`. This follows the earlier `sol` → `sol56` move. New Responses aliases: `gpt-6.1-sol` and `gpt61sol`. - **Copilot:** adds `copilot.gpt-6.1-sol` (Responses wire, websocket, web search). - **Docs:** updated the OpenAI and Copilot provider pages and regenerated `_generated/`. The regen also picks up alias/reference drift that was already on `main` (Sonnet 5.5, DeepSeek HF entries). That part comes from the generator, not from hand edits. - **Pricing:** fast-agent-ai/card-packs@c8143f5 (price-calculator 0.3.8). Rates match GPT-6 Sol, except cache reads are half price ($0.10/M, or $0.20/M above 272k). I checked these against Copilot's `/models` `billing.token_prices`.  - **OpenAI SDK 3.19.2 → 3.21.0:** 3.21.0 adds the `gpt-6.1-sol` identifier. 3.20.0 fixes raw TLS failures (`ssl.SS
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>e9de0e9</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://76edc1a6.fast-agent.pages.dev'>https://76edc1a6.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://feat-gpt-6-1-sol.fast-agent.pages.dev'>https://feat-gpt-6-1-sol.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/76edc1a6-4a53-4903-965a-c3125a20fe2a) 

- **Issue #991** (2026-09-29): **fix: omit reasoning from copied ATIF context steps**
  *Symptoms*: ## Summary  Fix ATIF export after summary compaction retains a reasoning-bearing assistant message.  Copied context steps correctly have `llm_call_count=0` and no metrics, but the exporter was still attaching the original `reasoning_content`. This contradicts `AtifStep` validation and aborts export with:  > metrics and reasoning_content must be absent when llm_call_count is 0  Apply the existing copied-step guard to reasoning as well. Original steps retain their reasoning and usage; copied steps preserve their message and original-step reference without introducing another LLM call. No schema relaxation or changes to persisted histories.  ## Regression coverage  Synthetic archive-backed tests cover both copied templates and retained-tail assistant messages. Both cases reproduce the exact validation failure before the fix and pass afterward. They verify original reasoning/metrics survive, copied reasoning/metrics are absent, call and reasoning-token accounting are not duplicated, and input histories remain unchanged.  No benchmark histories, logs, credentials, or provider calls are included.  ## Validation  - `uv run pytest tests/unit/fast_agent/history tests/unit/fast_agent/session -q` — 273 passed - `uv run scripts/format.py --check` — passed - `uv run scripts/lint.py` — passed - `uv run scripts/typecheck.py` — passed - `git diff --check` — passed  ## Contributor question  **You're given a calfskin wallet for your birthday. How would you feel about using it?**  I would prefe
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>82ae203</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://006fdd04.fast-agent.pages.dev'>https://006fdd04.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://fix-atif-copied-context-reas.fast-agent.pages.dev'>https://fix-atif-copied-context-reas.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/006fdd04-fe07-4031-8ce2-056b69086b87) 

- **Issue #990** (2026-09-30): **feat(mcp): retain oversized MCP tool results in a model-readable spool**
  *Symptoms*: ## Problem  When an MCP tool result exceeds the model-facing byte limit, `truncate_tool_result_for_llm` keeps the head and tail and **discards the middle**. The notice only says *"Use a narrower query or request a smaller result"*. The model has no way to look at the omitted content, even though the shell tool already offers a retained-output location for this situation.  An example seen in practice: an HF MCP `hf_fs ls hf://papers/daily/latest --limit 15` returned 32 KB, 16 KB of which was dropped. The model correctly reported that nothing pointed it to the rest. (A related server-side defect is fixed in huggingface/hf-mcp-server#267.)  ## Changes  When a result that doesn't come from the local shell is over the limit, the full result is written to the agent's existing `TransientArtifactStore` before truncating. The artifact's notice replaces the default guidance: *"The complete … result is available during this session at `<path>`. Use read_text_file for selected line ranges…"*  - **Structured content** is retained as indented JSON (`.json`) so line ranges and grep are useful. It is written **all-or-nothing**, so the file always parses. - If the JSON exceeds the limit, the result's **text content** is retained instead (`.txt`, described as the "text version of the … result"). - Tool-result artifacts have a **hard 32 MiB cap** (`TOOL_RESULT_ARTIFACT_MAX_BYTES`). Subagent transcripts keep their 2 MiB cap. - Partial text artifacts now end on a **line boundary** before the quot
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>bb876dc</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://bc66f267.fast-agent.pages.dev'>https://bc66f267.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://feat-mcp-tool-result-spool.fast-agent.pages.dev'>https://feat-mcp-tool-result-spool.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/bc66f267-76cc-4648-9f98-4de69d3249d0) 

- **Issue #989** (2026-09-28): **fast-agent 0.10.39: honor Responses end_turn continuations**
  *Symptoms*: ## Summary  Prepare fast-agent **0.10.39** and honor the Responses API's explicit `end_turn: false` continuation signal.  Previously, the SDK retained this field but fast-agent normalized a tool-free response to `endTurn`, ending the agent loop. This differs from Codex's documented behavior: a completed response can request another inference without a new user message or tool result.  ## Changes  - Normalize explicit boolean `end_turn: false` to a dedicated `CONTINUE` stop reason, retaining boolean termination metadata in provider diagnostics. - Support assistant-ended follow-ups for OpenAI/Codex Responses over SSE and WebSocket without fabricating input. - Preserve assistant history with history enabled or disabled, and charge provider-requested follow-ups to the existing tool-loop iteration budget. - Preserve actual tool handling, cancellation, safety/incomplete outcomes, lifecycle hooks, and structured-finalization ordering. Missing, true, and malformed values do not trigger continuation. - Document the behavior and bump `pyproject.toml` / `uv.lock` to 0.10.39. Wrapper version synchronization remains owned by the existing publish workflow.  ## Validation  - Regression reproduced on unmodified 0.10.38 before the fix. - Full unit suite on the fix: **9,059 passed, 1 skipped**. - `uv run scripts/format.py --check`: pass. - `uv run scripts/lint.py`: pass. - `uv run scripts/typecheck.py`: pass. - `git diff --check`: pass. - Built the 0.10.39 sdist and wheel; checked wheel versio
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>26e61f0</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://ac0c615b.fast-agent.pages.dev'>https://ac0c615b.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://fix-responses-end-turn-conti.fast-agent.pages.dev'>https://fix-responses-end-turn-conti.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/ac0c615b-0862-40f0-b28b-6348694b7346) 

- **Issue #988** (2026-09-30): **Bump anthropic SDK to 1.9.0**
  *Symptoms*: ## Summary  Bumps the pinned \`anthropic[vertex]\` SDK from 1.8.0 to 1.9.0 (released 2026-09-28) and refreshes \`uv.lock\`. No fast-agent code changes.  Relevant 1.9.0 changes (diffed the 1.8.0/1.9.0 wheels against our usage in \`llm_anthropic.py\`): - \`between_tools\` is now a typed member of \`ThinkingConfigParam\` (needed for Claude Sonnet 5.5). - \`claude-sonnet-5-5\` is added to the \`Model\` literal. - The non-beta Messages API gains the \`diagnostics\` request param / \`cache_miss_reason\` response type (we already use these on the beta endpoint). - Fallback middleware downgrades \`between_tools\` to \`disabled\` for fallback hops (we don't use SDK fallbacks). - Dependency list is unchanged.  Nothing here lets us delete existing integration code. \`CACHE_DIAGNOSIS_BETA\` may be droppable if cache diagnostics are now GA server-side, but that isn't verifiable from the SDK, so it's left as is.  ## Testing  - \`uv run scripts/format.py --check\`, \`lint.py\`, \`typecheck.py\`: pass - \`pytest tests/unit\`: 8838 passed, 1 skipped  ## You're given a calfskin wallet for your birthday. How would you feel about using it?  I'd be a bit uneasy. It's a nice gift, but calfskin comes from young animals, so I'd probably use it while feeling somewhat conflicted, and I'd be glad to know the leather was sourced responsibly.
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>17366d6</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://a2697a5c.fast-agent.pages.dev'>https://a2697a5c.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://chore-anthropic-sdk-1-9-0.fast-agent.pages.dev'>https://chore-anthropic-sdk-1-9-0.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/a2697a5c-fd0f-4ddb-a6bb-4af8f0f1c8b6) 
  > Closing as redundant: main already pins anthropic[vertex]==1.9.0 in pyproject.toml and resolves anthropic 1.9.0 in uv.lock.

- **Issue #987** (2026-09-28): **fix: reconstruct ATIF history across summary compaction**
  *Symptoms*: ## Summary  Reconstruct the full available ATIF audit history across summary compaction, rather than exporting only the shortened model context.  - Shared verified archive reconstruction for persisted/session recovery and live exports, including error/cancellation and parallel paths. - Follow linked snapshots recursively; verify exact template/retained-tail sequences. Legacy archives require unique timestamped overlap. Never union current/previous snapshots or globally deduplicate messages. - Preserve original messages/results and explicit system context-management boundaries. Reconcile raw transient turns against lossless process-poll evidence while retaining poll rewrite boundaries. - Publish future archives atomically under collision-resistant names, recording archive filename/digest and retention boundaries in summaries. With persistence enabled, archival failure leaves history unchanged; disabled persistence still allows ordinary compaction. - Fail full exports on missing, malformed, conflicting, or ambiguous evidence. Mark summary-generation accounting as unavailable rather than inventing usage or presenting original-message totals as complete run spend.  ## Validation  All passed:  ```text uv run scripts/format.py --check uv run scripts/lint.py uv run scripts/typecheck.py uv run pytest tests/unit/fast_agent/history tests/unit/fast_agent/session \   tests/unit/fast_agent/hooks/test_compaction_hook.py \   tests/unit/fast_agent/commands/test_runtime_result_export.py -q # 
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>3266b81</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://20ac79d8.fast-agent.pages.dev'>https://20ac79d8.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://fix-atif-compaction-reconstr.fast-agent.pages.dev'>https://fix-atif-compaction-reconstr.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/20ac79d8-1f96-43aa-a2e4-994819f698a6) 

- **Issue #986** (2026-09-27): **GPT-6 Sol/Astra default to freeform shell**
  *Symptoms*: ## Summary - **GPT-6 Sol and GPT-6 Astra now default to the `freeform_shell` contract** already used by GPT-6 Luna in 0.10.36: a Responses custom (Lark grammar) `shell` tool whose input is the raw command text, with an optional first line `# @shell: {"background"|"timeout"|"workdir"}`. The change is on the shared `OPENAI_GPT_6_ASTRA` catalog entry, which Sol and Luna derive from. Sol/Astra previously used the JSON `shell` (`command`, `run_in_background`). - **Grok is unchanged** and keeps `grok_shell`. xAI's Responses API rejects `type: custom` tools (`unknown variant 'custom'`), so the freeform contract is not offered for Grok.  ## Live checks (local `fast-agent go`, same scripted task) Task: heredoc with mixed quotes and backslashes, a persistent HTTP server, a curl check, and `pwd` via the working-directory option.  | Model | Contract | Result | |---|---|---| | gpt-6-sol low / medium | freeform (custom tool) | all steps done; raw heredocs; `# @shell: {"background": true}` for the server; `# @shell: {"workdir": …}` for pwd; 0 tool errors | | gpt-6-astra low / medium | freeform (custom tool) | same as Sol; 0 tool errors | | grok-4.7 medium | freeform (custom tool) | HTTP 400 `unknown variant 'custom'` (retried 3×): not supported by xAI |  Call-shape data from prior runs (malformed = empty/missing command or argument error): JSON shell Sol high 0.23%, Astra 0–0.3%, Grok 0.12–0.24%; GPT-6 Luna JSON 3.8% vs freeform 0.14%. Sol and Astra therefore have little malformed-call head
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>1126ae5</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://a53b4cc2.fast-agent.pages.dev'>https://a53b4cc2.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://feat-gpt6-freeform-shell.fast-agent.pages.dev'>https://feat-gpt6-freeform-shell.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/a53b4cc2-ec01-4c7c-a325-3ba712708875) 

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

### Incident Patch 1: `61b1a320` (2026-09-29)
**Commit Message**: fix: support inline Copilot documents and prepare 0.10.41 (#993)

**File**: `docs/docs/models/providers/copilot.md` (modified, +13/-0)
```diff
@@ -266,3 +266,16 @@ uv run examples/copilot/image_upload_probe.py
 
 It checks image recognition and URL reuse through Messages/SSE and
 Responses/SSE and WebSocket, without printing credentials or attachment URLs.
+
+## Document attachments
+
+Inline PDFs are supported on Copilot Responses (SSE and WebSocket) and Claude
+Messages. Local PDF attachments, including `attach_media` results, are sent
+inline without a provider file upload. Responses wraps base64 file bytes in a
+MIME data URL; Claude uses its native inline document source. Original history
+is retained unchanged. Claude inline text/content document sources are also
+allowed.
+
+This does **not** enable the OpenAI or Anthropic Files APIs. Hosted file IDs and
+document URL references remain rejected; attach a local copy instead. Gateway
+model, file-size and context limits still apply.
```

**File**: `publish/fast-agent-acp/pyproject.toml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "fast-agent-acp"
-version = "0.6.10"
+version = "0.10.41"
 description = "Convenience launcher that pulls in fast-agent-mcp and exposes the ACP CLI entrypoint."
 readme = "README.md"
 license = { text = "Apache-2.0" }
@@ -18,7 +18,7 @@ classifiers = [
 ]
 requires-python = ">=3.12,<3.15"
 dependencies = [
-    "fast-agent-mcp==0.6.10",
+    "fast-agent-mcp==0.10.41",
 ]
 
 [project.urls]
```

**File**: `publish/hf-inference-acp/pyproject.toml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "hf-inference-acp"
-version = "0.6.10"
+version = "0.10.41"
 description = "Hugging Face inference agent with ACP support, powered by fast-agent-mcp"
 readme = "README.md"
 license = { text = "Apache-2.0" }
@@ -18,7 +18,7 @@ classifiers = [
 ]
 requires-python = ">=3.12,<3.15"
 dependencies = [
-    "fast-agent-mcp==0.6.10",
+    "fast-agent-mcp==0.10.41",
     "huggingface_hub>=1.11.0",
 ]
 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.40"
+version = "0.10.41"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
```

**File**: `src/fast_agent/llm/provider/copilot/policy.py` (modified, +17/-2)
```diff
@@ -45,11 +45,26 @@ def contains_type(value: object, types: set[str]) -> bool:
 
 
 def reject_files(value: object) -> None:
+    """Reject hosted file references, not inline document content."""
     if isinstance(value, Mapping):
         kind = value.get("type")
-        if kind in ("input_file", "file", "document") or (
-            kind == "input_image" and value.get("file_id")
+        if kind == "input_file" and (
+            not value.get("file_data") or value.get("file_id") or value.get("file_url")
         ):
+            raise ValueError(
+                "Copilot files require inline file_data; file IDs/URLs are unsupported."
+            )
+        if kind == "document":
+            source = value.get("source")
+            if not isinstance(source, Mapping) or source.get("type") not in (
+                "base64",
+                "text",
+                "content",
+            ):
+                raise ValueError(
+                    "Copilot documents require inline content; file IDs/URLs are unsupported."
+                )
+        if kind == "file" or (kind == "input_image" and value.get("file_id")):
             raise ValueError("Copilot provider file APIs are not supported.")
         # Traverse wire content, not arbitrary local tool arguments (which may
         # legitimately contain a field named file_id or type="file").
```

---

### Incident Patch 2: `047d94c7` (2026-09-29)
**Commit Message**: fix: omit reasoning from copied ATIF context steps (#991)

**File**: `src/fast_agent/session/trace_export_atif.py` (modified, +3/-1)
```diff
@@ -618,7 +618,9 @@ def append_message(
                 ),
                 message=_atif_content(list(message.content)),
                 reasoning_content=(
-                    _channel_text(message, REASONING) if step_source == "agent" else None
+                    _channel_text(message, REASONING)
+                    if step_source == "agent" and not copied
+                    else None
                 ),
                 tool_calls=calls,
                 # Copied steps restate earlier interactions: they carry no new
```

**File**: `tests/unit/fast_agent/history/test_atif_reconstruction.py` (modified, +53/-1)
```diff
@@ -10,7 +10,7 @@
 import pytest
 from mcp_types import CallToolRequest, CallToolRequestParams, CallToolResult, TextContent
 
-from fast_agent.constants import FAST_AGENT_COMPACTION_CHANNEL, FAST_AGENT_USAGE
+from fast_agent.constants import FAST_AGENT_COMPACTION_CHANNEL, FAST_AGENT_USAGE, REASONING
 from fast_agent.history.atif_reconstruction import (
     COMPACTION_BOUNDARY,
     HistoryReconstructionError,
@@ -377,6 +377,58 @@ def test_replace_boundary_carries_model_visible_context(tmp_path: Path):
     assert trajectory.final_metrics.extra["llm_usage_expected_call_count"] == 4
 
 
+@pytest.mark.parametrize("retained_as", ["template", "tail"])
+def test_copied_reasoning_stays_on_original_step(tmp_path: Path, retained_as: str):
+    usage = {
+        "schema": "fast-agent.usage/v2",
+        "provider_attempts": [
+            {
+                "provider": "openai",
+                "usage_schema": "openai-chat",
+                "model": "test",
+                "prompt": {"total": 12, "cache_read": 0},
+                "completion": {"total": 3, "reasoning": 2},
+                "tool_calls": 0,
+            }
+        ],
+    }
+    assistant = PromptMessageExtended(
+        role="assistant",
+        content=[TextContent(type="text", text="answer")],
+        channels={
+            REASONING: [TextContent(type="text", text="original reasoning")],
+            FAST_AGENT_USAGE: [TextContent(type="text", text=json.dumps(usage))],
+        },
+        timestamp=BASE,
+        is_template=retained_as == "template",
+    )
+    if retained_as == "template":
+        archived = [assistant, _message(1)]
+        current = _checkpoint(tmp_path, archived, templates=1, tail=0)
+    else:
+        archived = [_message(1), assistant]
+        current = _checkpoint(tmp_path, archived, tail=1)
+    original_history = [message.model_copy(deep=True) for message in archived]
+
+    trajectory = _trajectory(current, tmp_path)
+    original, copied = [step for step in trajectory.steps if step.source == "agent"]
+    assert original.reasoning_content == "original reasoning"
+    assert original.metrics is not None
+    assert original.llm_call_count == 1
+    assert copied.is_copied_context
+    assert copied.message == original.message
+    assert (copied.extra or {})["copied_from_step_id"] == original.step_id
+    assert copied.reasoning_content is None
+    assert copied.metrics is None
+    assert copied.llm_call_count == 0
+    assert trajectory.final_metrics is not None
+    assert trajectory.final_metrics.extra is not None
+    assert trajectory.final_metrics.extra["llm_usage_expected_call_count"] == 1
+    assert trajectory.final_metrics.extra["llm_usage_observed_call_count"] == 1
+    assert trajectory.final_metrics.extra["observed_reasoning_tokens_lower_bound"] == 2
+    assert archived == original_history
+
+
 def test_summary_call_is_embedded_and_accounted(tmp_path: Path):
     archived = [_message(0), *_exchange(1), _message(2), *_exchange(3)]
     current = _with_summary_call(_checkpoint(tmp_path, archived, tail=3))
```

---

### Incident Patch 3: `b6d9da6e` (2026-09-28)
**Commit Message**: fix: honor Responses end_turn continuation in 0.10.39 (#989)

**File**: `docs/docs/guides/codex.md` (modified, +13/-0)
```diff
@@ -86,6 +86,19 @@ If you prefer, you can also run model setup explicitly:
 uvx fast-agent-mcp@latest model setup
 ```
 
+## Provider-requested continuation
+
+For OpenAI and Codex Responses (SSE or WebSocket), a completed response with
+explicit `end_turn: false` requests another inference, even without tool calls.
+fast-agent preserves the assistant output and continues without inventing a
+user prompt or tool result. These follow-ups share the agent's `max_iterations`
+budget with tool calls; cancellation and terminal errors still stop the turn.
+
+An absent or true `end_turn` retains normal stopping behavior. Commentary phase
+or text acknowledging unfinished work does not itself request continuation.
+Boolean `end_turn` values are retained in the `fast-agent-provider-diagnostics`
+history channel.
+
 ## Web search
 
 Use `fast-agent go --model 'astra?web_search=true'` to enable hosted web search;
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.38"
+version = "0.10.39"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
```

**File**: `src/fast_agent/agents/llm_agent.py` (modified, +2/-2)
```diff
@@ -369,7 +369,7 @@ def _build_stop_reason_additional_segments(
     ) -> list[Text]:
         segments: list[Text] = []
         stop_reason = message.stop_reason
-        if stop_reason in (None, LlmStopReason.END_TURN):
+        if stop_reason in (None, LlmStopReason.END_TURN, LlmStopReason.CONTINUE):
             return segments
         if stop_reason == LlmStopReason.TOOL_USE:
             tool_use_message = build_tool_use_additional_message(
@@ -839,7 +839,7 @@ def _display_trailing_user_messages(
         *,
         request_params: RequestParams | None,
     ) -> None:
-        if messages[-1].role != "user":
+        if not messages or messages[-1].role != "user":
             return
 
         trailing_users: list[PromptMessageExtended] = []
```

**File**: `src/fast_agent/agents/llm_decorator.py` (modified, +5/-3)
```diff
@@ -1034,9 +1034,11 @@ def _persist_history(
         assistant_message: PromptMessageExtended,
     ) -> None:
         """Persist the last turn unless explicitly disabled by control text."""
-        if not sanitized_messages:
-            return
-        if sanitized_messages[-1].first_text().startswith(CONTROL_MESSAGE_SAVE_HISTORY):
+        # Provider-requested follow-ups have no new user/tool input, but their
+        # assistant response must still be retained for subsequent inference.
+        if sanitized_messages and sanitized_messages[-1].first_text().startswith(
+            CONTROL_MESSAGE_SAVE_HISTORY
+        ):
             return
 
         history_messages = [self._strip_removed_metadata(msg) for msg in sanitized_messages]
```

**File**: `src/fast_agent/agents/tool_runner.py` (modified, +38/-20)
```diff
@@ -284,6 +284,15 @@ def _apply_assistant_message_state(self, assistant_message: PromptMessageExtende
             self._pending_tool_request = assistant_message
             self._pending_tool_response = None
             return
+        if assistant_message.stop_reason == LlmStopReason.CONTINUE:
+            if self._advance_iteration():
+                # History already contains this assistant response. Without history,
+                # retain it locally; never manufacture a user prompt/tool result.
+                if self._use_history_enabled():
+                    self._delta_messages = []
+                else:
+                    self._delta_messages.append(assistant_message)
+            return
         if self._should_start_deferred_structured_finalization(assistant_message):
             self._start_deferred_structured_finalization(assistant_message)
             return
@@ -294,7 +303,7 @@ async def until_done(self) -> PromptMessageExtended:
         try:
             async for message in self:
                 last = message
-                if message.stop_reason == LlmStopReason.TOOL_USE:
+                if message.stop_reason in (LlmStopReason.TOOL_USE, LlmStopReason.CONTINUE):
                     await self._persist_tool_loop_checkpoint(message)
             if last is None:
                 raise RuntimeError("ToolRunner produced no messages")
@@ -344,7 +353,10 @@ async def until_done(self) -> PromptMessageExtended:
 
     async def _maybe_auto_compact_before_followup_llm(self) -> None:
         message = self._last_message
-        if message is None or message.stop_reason != LlmStopReason.TOOL_USE:
+        if message is None or message.stop_reason not in (
+            LlmStopReason.TOOL_USE,
+            LlmStopReason.CONTINUE,
+        ):
             return
         try:
             from fast_agent.hooks.compaction import auto_compact_history_mid_turn
@@ -847,6 +859,29 @@ def _synthesize_passthrough_assistant(
             stop_reason=stop_reason,
         )
 
+    def _advance_iteration(self) -> bool:
+        """Charge tool and provider-requested follow-ups to the same finite budget."""
+        self._iteration += 1
+        max_iterations = (
+            self._request_params.max_iterations
+            if self._request_params is not None
+            else DEFAULT_MAX_ITERATIONS
+        )
+        if self._iteration <= max_iterations:
+            return True
+        _logger.warning(
+            "Tool loop stopped: maximum iterations reached",
+            data={
+                "agent_name": self._agent.name,
+                "iterations": self._iteration,
+                "max_iterations": max_iterations,
+            },
+        )
+        if self._last_message is not None:
+            self._last_message.stop_reason = LlmStopReason.MAX_ITERATIONS
+        self._done = True
+        return False
+
     async def _ensure_tools_ready(self) -> None:
         if self._tools is None:
             self._tools = (await self._agent.list_tools()).tools
@@ -875,27 +910,10 @@ async def _ensure_tool_response_staged(self) -> None:
             self._done = True
             return
 
-        self._iteration += 1
-        max_iterations = (
-            self._request_params.max_iterations
-            if self._request_params is not None
-            else DEFAULT_MAX_ITERATIONS
-        )
-        if self._iteration > max_iterations:
-            _logger.warning(
-                "Tool loop stopped: maximum iterations reached",
-                data={
-                    "agent_name": self._agent.name,
-                    "iterations": self._iteration,
-                    "max_iterations": max_iterations,
-                },
-            )
-            if self._last_message is not None:
-                self._last_message.stop_reason = LlmStopReason.MAX_ITERATIONS
+        if not self._advance_iteration():
             if self._use_history_enabled():
                 self._stage_tool_response(tool_
```

---

### Incident Patch 4: `da5f4f8a` (2026-09-28)
**Commit Message**: fix: reconstruct ATIF history across summary compaction (#987)

* fix: reconstruct ATIF audit history across summary compaction

* fast-agent 0.10.38

* feat: integrate Sonnet 5.5 and enable Claude 5.5 progress summaries

Add API-key and Copilot Sonnet 5.5 routing, native structured output defaults for GPT-6 and Claude 5.5, and adaptive summarized thinking for Sonnet and Opus 5.5. Upgrade Anthropic SDK to 1.9.0 and fix Copilot alias metadata lookup.

Add request/stream/replay contracts, live structured-output smoke tests, and a runnable progress demo. Verified 9019 unit tests, 12 live Copilot structured-output cases, and live default Opus progress.

* fix: preserve ATIF compaction context and summary accounting

Export retained model context as copied steps after replace boundaries and persist summary requests/responses for embedded trajectories and usage totals. Preserve original audit evidence and mark older checkpoints with missing summary accounting explicitly.

* fix: place Sonnet 5.5 directly below Opus 5.5 in picker

**File**: `docs/docs/guides/compaction.md` (modified, +44/-1)
```diff
@@ -38,9 +38,14 @@ A compaction does three things:
 3. **Replaces.** History becomes `templates + summary + recent turns`. The
    summary is a clearly-marked message (it shows as `compacted` in `/history`),
    not an ordinary user message. The original pre-compaction history is archived
-   to a `compacted_*.json` file in the session directory, so nothing is lost.
+   to a `compacted_*.json` file in the session directory when session history
+   persistence is enabled.
 
 If the summarization call fails or returns nothing, history is left untouched.
+With session history enabled, an archive failure also leaves history unchanged.
+Archives are published atomically under collision-resistant names; each new
+summary records the archive filename, SHA-256 digest, and retention boundaries.
+Prior summaries in that archive link to earlier archives.
 
 ## Automatic compaction
 
@@ -120,6 +125,44 @@ To recover the full pre-compaction transcript, load the archive:
 /history load compacted_20260613-120000_default.json
 ```
 
+## ATIF export after compaction
+
+Live ATIF output and persisted session ATIF export reconstruct archived history
+through the same verifier. Original messages and tool results appear once, in
+their original positions. Each summary becomes an ATIF `context_management`
+boundary (`type: "compaction"`, `boundary: "replace"`) following the ATIF v1.7
+convention:
+
+- the boundary step's `observation` holds the summary the model saw;
+- the system prompt, templates, and retained recent turns that stayed in the
+  model's context follow the boundary as `is_copied_context` steps, which carry
+  no usage and are excluded from SFT by spec-following consumers;
+- `extra.context_management` lists `removed_step_ids`, `retained_step_ids`, and
+  `copied_step_ids`, and each copy records `copied_from_step_id`;
+- the summarization model call is embedded in `subagent_trajectories`, referenced
+  from the boundary observation, and included in final metrics.
+
+A consumer applying the spec's replace-boundary rule therefore reconstructs the
+same context fast-agent sent to the model. Process-poll fold audits are still
+expanded, including when reconciling a raw transient final turn.
+
+Recovery follows linked archives and verifies exact template and retained-tail
+sequences; it does not concatenate current/previous snapshots or globally
+deduplicate messages. Legacy unlinked archives require a unique exact positive
+tail overlap, timestamped originals, and an archive filename timestamp within
+five seconds before the summary. Missing, malformed, conflicting, or ambiguous
+evidence fails the full export rather than silently producing a partial trace.
+This includes legacy summary-only histories and retained tails whose exact
+overlap can no longer be verified.
+
+Disabling session history still permits ordinary compaction, but a full ATIF
+export cannot recover discarded history. Persisted recovery covers saved
+evidence only, not unsaved messages lost on hard termination. It does not merge
+existing ATIF files: preserve those separately when they contain extra transient
+evidence. Checkpoints written before summary calls were recorded have no
+summary usage: their boundaries report `summary_usage: "unavailable"` and
+final metrics mark the accounting as excluding those calls.
+
 ## Manual compaction from the Harness API
 
 Under the Harness API, auto-compaction is on by default just as in the TUI. To
```

**File**: `docs/docs/models/providers/anthropic.md` (modified, +59/-3)
```diff
@@ -20,6 +20,60 @@ recorded for diagnostics.
 connect/write/pool limits remain unchanged. A numeric value also bounds stream
 startup as before.
 
+## Claude Sonnet 5.5
+
+`sonnet`, `claude`, and `sonnet55` select `claude-sonnet-5-5`.
+`sonnet5` remains pinned to Sonnet 5.
+
+```bash
+# Uses ANTHROPIC_API_KEY (or anthropic.api_key in configuration).
+uv run fast-agent go --model sonnet55
+# Uses the existing Copilot login, not your Anthropic API key.
+uv run fast-agent go --model copilot.sonnet55
+```
+
+Sonnet 5.5 has a 1M-token context and 128K maximum output. Adaptive thinking
+defaults to `high` effort; `low`, `medium`, `high`, `xhigh`, and `max` are
+supported. fast-agent requests `thinking: {"type": "adaptive", "display": "summarized"}`
+by default on both API-key and Copilot routes, preserving adaptive thinking while
+making progress summaries visible. Explicit request metadata can override display.
+`reasoning=off` sends `thinking: {"type": "between_tools"}` rather
+than `disabled`. This mode supports only low/medium/high effort; manual thinking
+budgets and forced tool choice are rejected locally. Unsupported sampling controls
+are removed. Preserve signed thinking blocks unchanged and keep history append-only.
+
+See Anthropic's [Sonnet 5.5 migration notes](https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5).
+
+### Structured output: current models
+
+GPT-6 Astra/Sol/Luna, Opus 5.5, and Sonnet 5.5 use JSON-schema output by
+default on their API-key and Copilot routes. GPT-6 uses Responses `text.format`;
+Claude uses Messages `output_config.format`. Regular tools may coexist with the
+schema (`structured_tool_policy: always`). Request-level `no_tools` and `defer`
+remain available. Do not select legacy `tool_use` output mode for Claude 5.5:
+those models reject forced tool choice.
+
+Local mocked-HTTP tests cover schema payloads, tool coexistence, tool suppression,
+schema deferral, and Copilot header restrictions. Live Copilot smoke tests passed
+on September 28, 2026 for all five models, both schema-only and tool-call-to-schema
+round trips, including Sonnet 5.5 with `reasoning=off`. The accepted Sonnet wire ID
+is `claude-sonnet-5.5`. Direct API smoke tests remain blocked by missing credentials
+in the test environment.
+
+Use `structured_schema()` for structured output through the normal agent tool
+loop; `structured()` is the Pydantic-only output path and does not run that loop.
+The live tool test reads a randomly generated value from a local function tool
+and checks both tool execution and the final schema-validated value.
+
+To verify real responses with your configured credentials and Copilot account
+(this makes billable requests):
+
+```bash
+uv run pytest tests/e2e/structured/test_current_model_structured_outputs.py -q
+# Or test only the Sonnet routes:
+uv run pytest tests/e2e/structured/test_current_model_structured_outputs.py -q -k sonnet55
+```
+
 ## Claude Opus 5.5
 
 Released September 22, 2026. `opus` and `opus55` select `claude-opus-5-5`;
@@ -33,13 +87,15 @@ Released September 22, 2026. `opus` and `opus55` select `claude-opus-5-5`;
   confirmed in the [Anthropic effort documentation](https://platform.claude.com/docs/en/build-with-claude/effort).
   Fast-mode pricing is not assumed.
 - Forced tool use is unsupported. Use `auto` or `none`, and native JSON mode for
-  structured output on direct Anthropic. Copilot retains its existing structured-output
-  restrictions (forced-tool fallback is rejected). Unsupported sampling controls
+  structured output on both direct Anthropic and Copilot routes. Legacy forced-tool
+  output mode is rejected. Unsupported sampling controls
   are removed, as for Fable 5.1.
 - Thinking blocks belong to their originating model and conversation. Do not
   transplant them into other conversations or models, or edit earlier history.
   Preserve empty signed thinking blocks and text between tool calls. Thinking
-  display is empty by default; fast-
```

**File**: `docs/docs/models/providers/copilot.md` (modified, +73/-1)
```diff
@@ -96,7 +96,8 @@ not canonical and has no alias; use `copilot.claude-opus-5`.
 | Model | Wire API |
 | --- | --- |
 | `copilot.claude-haiku-4.5` | Messages |
-| `copilot.claude-sonnet-5` | Messages |
+| `copilot.claude-sonnet-5.5` (`copilot.sonnet`, `copilot.sonnet55`) | Messages |
+| `copilot.claude-sonnet-5` (pinned older version) | Messages |
 | `copilot.claude-opus-4-8` | Messages |
 | `copilot.claude-opus-5.5` (`copilot.opus`, `copilot.opus55`) | Messages |
 | `copilot.claude-opus-5` (pinned older version) | Messages |
@@ -113,6 +114,77 @@ Provider identity stays Copilot regardless of wire API; Anthropic/OpenAI API
 keys are not used for these models. The status bar prefixes Copilot model labels
 with `(cp)`; this does not change the model name used in configuration.
 
+## Structured output
+
+GPT-6 Astra/Sol/Luna use Responses JSON schema (`text.format`).
+Opus 5.5 and Sonnet 5.5 select Messages JSON schema (`output_config.format`)
+automatically, without direct Anthropic beta headers. Regular tools can coexist
+with the schema; explicit `structured_tool_policy` overrides remain supported.
+Legacy forced-tool output mode is rejected for Claude 5.5.
+
+Live schema-only and tool-call-to-schema smoke tests passed for all five models
+on September 28, 2026, including the Sonnet 5.5 wire ID `claude-sonnet-5.5` and
+its `reasoning=off` setting. These results confirm access for the tested account;
+availability can still vary by account. Use `structured_schema()` for the tool
+loop. See the [credentialed smoke tests](anthropic.md#structured-output-current-models).
+
+## Claude 5.5 progress visibility
+
+Live-tested on September 28, 2026 through the normal fast-agent tool loop.
+Sonnet 5.5 and Opus 5.5 request adaptive thinking with summarized display by default,
+on both Copilot and direct Anthropic routes. No request metadata is needed.
+The live default-mode demo confirmed 412 between-tool summary characters after
+this change, with all three tool calls completing. Opus 5.5's default-mode probe
+also passed, showing 507 between-tool summary characters without request metadata.
+
+Explicit request metadata still takes precedence; for example, to keep adaptive
+thinking but suppress its summaries:
+
+```python
+from fast_agent.types import RequestParams
+
+response = await agent.probe.generate(
+    "Inspect the batch and give brief progress updates between tool calls.",
+    request_params=RequestParams(
+        max_tokens=4096,
+        metadata={"thinking": {"type": "adaptive", "display": "omitted"}},
+    ),
+)
+```
+
+Alternatively, select `copilot.sonnet55?reasoning=off`. This uses `between_tools`:
+no up-front thinking, but readable between-tool progress summaries. Do **not**
+add a `display` field to `between_tools`; the model rejects that combination.
+This alternative applies only to Sonnet: Opus 5.5 keeps adaptive thinking always on.
+
+Run the billable synthetic inspection demo:
+
+```bash
+uv run examples/copilot/sonnet_progress.py --mode all
+# Individual modes: default, summarized, omitted, between_tools
+```
+
+The demo uses three sequential local tools, renders the normal terminal output,
+and reports timestamps and stream channels. Before changing the default, one observed run produced:
+
+| Mode | Visible thinking-summary characters between tools | Ordinary text characters between tools |
+| --- | ---: | ---: |
+| Previous default (display omitted) | 0 | 0 |
+| Adaptive, display summarized | 473 | 0 |
+| between_tools | 314 | 0 |
+
+These counts describe that run, not guarantees. Retesting with Anthropic SDK
+1.9.0 also passed all three modes: 0, 369, and 337 between-tool summary characters,
+respectively. An earlier shorter-update probe returned ordinary text progress
+even without a display override. The longer
+probe reproduced the silent gaps and demonstrated summaries arriving **before**
+the next tool executed, rather than only in the final answer.
+
+The existing thinking-stream renderer already disp
```

**File**: `examples/copilot/sonnet_progress.py` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+"""Live, billable Sonnet 5.5 progress demo using the normal harness/tool loop.
+
+Run: uv run examples/copilot/sonnet_progress.py --mode all
+Requires Copilot login. Sends only synthetic data; never prints credentials or signatures.
+"""
+
+import argparse
+import asyncio
+from dataclasses import dataclass
+from time import monotonic
+from typing import Literal
+
+from fast_agent import FastAgent
+from fast_agent.llm.stream_types import StreamChunk
+from fast_agent.types import LlmStopReason, RequestParams
+
+type DisplayMode = Literal["default", "summarized", "omitted", "between_tools"]
+MODES: tuple[DisplayMode, ...] = ("default", "summarized", "omitted", "between_tools")
+
+
+@dataclass(frozen=True)
+class Observation:
+    seconds: float
+    completed_tools: int
+    kind: str
+    text: str
+
+
+async def demonstrate(mode: DisplayMode) -> None:
+    model = "copilot.sonnet55"
+    if mode == "between_tools":
+        model += "?reasoning=off"
+    fast = FastAgent(f"Sonnet progress: {mode}", ignore_unknown_args=True)
+    observations: list[Observation] = []
+    calls: list[str] = []
+    start = monotonic()
+
+    @fast.tool
+    def read_station(station: Literal["inventory", "sample", "verification"]) -> str:
+        """Read a synthetic station report. Follow the next_station in each result."""
+        calls.append(station)
+        observations.append(Observation(monotonic() - start, len(calls), "tool", station))
+        match station:
+            case "inventory":
+                return "Batch LANTERN has 12 sealed containers. next_station: sample."
+            case "sample":
+                return "Sample temperature is 18 C, within the 15-20 C target. next_station: verification."
+            case "verification":
+                return "All 12 seals passed inspection. Final status: READY."
+
+    def observe(chunk: StreamChunk) -> None:
+        if chunk.event == "delta" and chunk.text:
+            observations.append(
+                Observation(
+                    monotonic() - start,
+                    len(calls),
+                    "thinking" if chunk.is_reasoning else "text",
+                    chunk.text,
+                )
+            )
+
+    @fast.agent(
+        "probe",
+        model=model,
+        instruction=(
+            "Run the requested inspection using the provided tool. Before each tool call, "
+            "give a public-facing progress update of 80-100 words in four sentences: what "
+            "was observed, which station you will check next, and what that check establishes. "
+            "Describe actions and observable results, not private reasoning. "
+            "Make sequential tool calls, following next_station. Do not skip stations."
+        ),
+    )
+    async def run() -> None:
+        async with fast.run() as agent:
+            remove = agent.probe.add_stream_listener(observe)
+            params = RequestParams(max_tokens=4096, max_iterations=6)
+            if mode in {"summarized", "omitted"}:
+                params.metadata = {"thinking": {"type": "adaptive", "display": mode}}
+            try:
+                response = await agent.probe.generate(
+                    "Inspect batch LANTERN, starting at inventory. Report the final status.",
+                    request_params=params,
+                )
+            finally:
+                remove()
+            assert response.stop_reason == LlmStopReason.END_TURN, response.stop_reason
+            assert calls == ["inventory", "sample", "verification"], calls
+            assert "READY" in response.all_text().upper()
+
+    print(f"\n=== {mode} ===", flush=True)
+    await run()
+    print(f"\n=== {mode}: observed stream timeline ===")
+    # Group deltas by tool boundary and channel. Never display opaque signed blocks.
+    for completed in range(4):
+        for kind in ("thinking", "text"):
+            chunks = [
+                item
+                for item in observat
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.37"
+version = "0.10.38"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
@@ -23,7 +23,7 @@ dependencies = [
     "pyyaml==6.0.3",
     "rich==15.0.0",
     "typer==0.27.2",
-    "anthropic[vertex]==1.8.0",
+    "anthropic[vertex]==1.9.0",
     "openai[aiohttp,realtime]==3.19.2",
     "prompt-toolkit==3.0.53",
     "aiohttp==3.14.3",
```

---

### Incident Patch 5: `ce6c0f9b` (2026-09-26)
**Commit Message**: fix: persist safe Responses websocket failure diagnostics (#984)

**File**: `docs/docs/ref/config_file.md` (modified, +16/-0)
```diff
@@ -779,6 +779,22 @@ When `logger.path` is omitted, file logging writes to
 `<current-working-directory>/fast-agent-log.jsonl`. Explicit relative paths continue to resolve
 from the process current working directory.
 
+Responses websocket failures emit an error-level structured event,
+`Responses websocket attempt failed`, through this logging path, including failures
+recovered by the transport's bounded reconnect. File logging persists these events
+as JSONL even at `level: "error"`; they do not depend on a completed assistant
+response or ATIF export. Logging disabled with `type: "none"` does not persist them.
+
+The `fast-agent.responses-websocket-failure/v1` payload includes an allowlisted
+`error_code` (`null` when absent, `unknown` for unrecognized codes), `stream_started`,
+connection ages at request start and failure in seconds (`null` when unknown),
+reuse status, and `reconnect_eligible`. Ages use the connection manager's monotonic
+clock. Eligibility describes the existing single transport reconnect only, not
+outer provider retries; `websocket_attempt` / `websocket_max_attempts` distinguish
+that bound from the provider `call`, `attempt`, and `max_attempts` counters.
+The diagnostic contains no error text, headers, URLs, request/response bodies,
+prompts, or credentials. It does not change retry or timeout policy.
+
 ## MCP Diagnostics Settings
 
 ```yaml
```

**File**: `src/fast_agent/core/logging/json_serializer.py` (modified, +4/-0)
```diff
@@ -287,6 +287,10 @@ def _serialize_object(self, obj: Any, depth: int = 0) -> Any:
         # Handle None
         if obj is None:
             return None
+        # Immutable JSON scalars can share identity (especially bool/small int).
+        # Repeated values are not cycles and must retain their JSON types.
+        if isinstance(obj, _JSON_NATIVE_SCALAR_TYPES):
+            return obj
 
         if depth == 0:
             self._parent_obj = obj
```

**File**: `src/fast_agent/llm/provider/openai/responses.py` (modified, +100/-4)
```diff
@@ -2,7 +2,7 @@
 import json
 import time
 from contextlib import asynccontextmanager
-from dataclasses import dataclass
+from dataclasses import asdict, dataclass
 from functools import partial
 from typing import Any, ClassVar, Literal
 from uuid import uuid4
@@ -149,12 +149,52 @@ class _ResponsesWsAttemptState:
     is_reusable: bool
     reused_existing_connection: bool
     planner: ResponsesWsRequestPlanner
+    connection_age_at_request_start_seconds: float | None = None
     keep_connection: bool = False
     retry_after_release: bool = False
     reconnect_diagnostics: dict[str, Any] | None = None
     stream: WebSocketResponsesStream | None = None
 
 
+@dataclass(frozen=True, slots=True)
+class _ResponsesWsFailureDiagnostic:
+    error_code: str | None
+    stream_started: bool
+    connection_age_at_request_start_seconds: float | None
+    connection_age_at_failure_seconds: float | None
+    reused_connection: bool | None
+    reconnect_eligible: bool
+    websocket_attempt: int
+    call: int
+    attempt: int
+    max_attempts: int
+    schema: Literal["fast-agent.responses-websocket-failure/v1"] = (
+        "fast-agent.responses-websocket-failure/v1"
+    )
+    transport: Literal["websocket"] = "websocket"
+    websocket_max_attempts: Literal[2] = 2
+
+
+def _safe_websocket_error_code(code: str | None) -> str | None:
+    # A provider-controlled string may contain secrets even if short/alphanumeric.
+    # Never persist arbitrary codes, truncated codes, or a hash of their contents.
+    if code is None:
+        return None
+    if code in {
+        "previous_response_not_found",
+        "websocket_connection_limit_reached",
+        "invalid_request_error",
+        "server_error",
+        "rate_limit_exceeded",
+        "insufficient_quota",
+        "context_length_exceeded",
+        "model_not_found",
+        "invalid_api_key",
+    }:
+        return code
+    return "unknown"
+
+
 class ResponsesLLM(
     OpenAIStructuredOutputMixin,
     ResponsesContentMixin,
@@ -1516,6 +1556,9 @@ async def _create_connection() -> ManagedWebSocketConnection:
             is_reusable=is_reusable,
             reused_existing_connection=reused_existing_connection,
             planner=planner,
+            connection_age_at_request_start_seconds=(
+                self._ws_connections.connection_age_seconds(connection)
+            ),
         )
 
     async def _run_responses_ws_attempt(
@@ -1695,6 +1738,47 @@ def _log_responses_ws_retry(
             data=retry_data,
         )
 
+    def _record_responses_ws_failure(
+        self,
+        error: Exception,
+        *,
+        attempt: int,
+        attempt_state: _ResponsesWsAttemptState | None,
+    ) -> None:
+        """Persist failures, including recovered and terminal attempts, via JSONL logging.
+
+        Eligibility describes only the existing bounded transport reconnect, not
+        outer provider retries. No provider text or request metadata is serialized.
+        """
+        ws_error = error if isinstance(error, ResponsesWebSocketError) else None
+        stream = attempt_state.stream if attempt_state is not None else None
+        call, provider_attempt, max_attempts = self._stream_attempt or (0, 1, 1)
+        diagnostic = _ResponsesWsFailureDiagnostic(
+            error_code=_safe_websocket_error_code(ws_error.diagnostic_error_code)
+            if ws_error
+            else None,
+            stream_started=(
+                ws_error.stream_started if ws_error else stream.stream_started if stream else False
+            ),
+            connection_age_at_request_start_seconds=(
+                attempt_state.connection_age_at_request_start_seconds if attempt_state else None
+            ),
+            connection_age_at_failure_seconds=(
+                self._ws_connections.connection_age_seconds(attempt_state.connection)
+                if attempt_state
+                else None
+            ),
+            reused_connection=attempt_state
```

**File**: `src/fast_agent/llm/provider/openai/responses_websocket.py` (modified, +21/-0)
```diff
@@ -75,6 +75,7 @@ def __init__(
         *,
         stream_started: bool = False,
         error_code: str | None = None,
+        diagnostic_error_code: str | None = None,
         status: int | None = None,
         error_param: str | None = None,
         headers: dict[str, str] | None = None,
@@ -83,11 +84,17 @@ def __init__(
         super().__init__(message)
         self.stream_started = stream_started
         self.error_code = error_code
+        self._diagnostic_error_code = diagnostic_error_code
         self.status = status
         self.error_param = error_param
         self.headers = headers
         self.stream_id = stream_id
 
+    @property
+    def diagnostic_error_code(self) -> str | None:
+        """Failure code for telemetry only; never used to decide retries."""
+        return self._diagnostic_error_code or self.error_code
+
 
 class _AttrObjectView:
     """Tiny adapter that exposes dictionary keys as attributes recursively."""
@@ -1000,10 +1007,18 @@ def _raise_payload_error(self, payload: Mapping[str, Any]) -> None:
             error_headers,
             stream_id,
         ) = self._extract_error_details(payload)
+        diagnostic_error_code: str | None = None
+        if payload.get("type") == "response.failed":
+            response = payload.get("response")
+            if isinstance(response, Mapping):
+                error = response.get("error")
+                if isinstance(error, Mapping):
+                    diagnostic_error_code = _non_empty_string(error.get("code"))
         raise ResponsesWebSocketError(
             error_message,
             stream_started=self._stream_started,
             error_code=error_code,
+            diagnostic_error_code=diagnostic_error_code,
             status=error_status,
             error_param=error_param,
             headers=error_headers,
@@ -1201,6 +1216,12 @@ def _mark_created(
         if connection.reuse_key is None:
             connection.reuse_key = reuse_key
 
+    def connection_age_seconds(self, connection: ManagedWebSocketConnection) -> float | None:
+        """Observe age using the same monotonic clock as connection lifecycle policy."""
+        if connection.created_monotonic is None:
+            return None
+        return round(max(0.0, self._clock() - connection.created_monotonic), 3)
+
     def _is_too_old(self, connection: ManagedWebSocketConnection) -> bool:
         if self._max_age_seconds <= 0 or connection.created_monotonic is None:
             return False
```

**File**: `tests/unit/fast_agent/core/test_json_serializer.py` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+"""JSON telemetry preserves scalar types even when Python reuses object identities."""
+
+import json
+
+from fast_agent.core.logging.json_serializer import JSONSerializer
+
+
+def test_repeated_json_scalars_keep_their_types() -> None:
+    values = [False, False, True, True, 2, 2, 0.0, 0.0, None, None, "same", "same"]
+    result = json.loads(json.dumps(JSONSerializer()({"first": values, "second": values.copy()})))
+    for key in ("first", "second"):
+        assert result[key] == values
+        assert [type(value) for value in result[key]] == [type(value) for value in values]
```

---

### Incident Patch 6: `9f62b4d6` (2026-09-26)
**Commit Message**: fix: rotate xAI Responses websockets before connection lifetime limit (#983)

**File**: `src/fast_agent/llm/provider/openai/responses.py` (modified, +5/-1)
```diff
@@ -245,7 +245,7 @@ def _initialize_response_state(self, web_search_override: Any) -> None:
         self._last_transport_used: ResponsesActiveTransport | None = None
         self._ws_connections = WebSocketConnectionManager(
             idle_timeout_seconds=55 * 60.0,
-            max_age_seconds=55 * 60.0,
+            max_age_seconds=self._websocket_max_age_seconds(),
         )
         self._ws_debug_inline = env_flag("FAST_AGENT_DEBUG_RESPONSES_WS")
         self._web_search_override: bool | None = (
@@ -524,6 +524,10 @@ def _build_websocket_headers(self) -> dict[str, str]:
     def _prepare_websocket_arguments(self, arguments: dict[str, Any]) -> None:
         """Apply provider-specific per-request websocket metadata."""
 
+    def _websocket_max_age_seconds(self) -> float:
+        """Rotate connections at safe request boundaries before the provider lifetime limit."""
+        return 55 * 60.0
+
     def _websocket_keepalive_options(self) -> ResponsesWebSocketKeepaliveOptions:
         return {}
 
```

**File**: `src/fast_agent/llm/provider/openai/xai_responses.py` (modified, +5/-0)
```diff
@@ -318,6 +318,11 @@ def _input_item_dedupe_key(self, item: dict[str, Any]) -> tuple[str, ...] | None
             return (*key, encrypted_content)
         return key
 
+    def _websocket_max_age_seconds(self) -> float:
+        # Leave headroom below xAI's 25-minute absolute connection lifetime.
+        # Active streams are never interrupted by age-based rotation.
+        return 20 * 60.0
+
     def _websocket_keepalive_options(self) -> ResponsesWebSocketKeepaliveOptions:
         # xAI currently doesn't reliably answer client-generated Ping frames.
         # Keep automatic Pong replies enabled while restoring the previous
```

**File**: `tests/unit/fast_agent/llm/providers/test_responses_websocket.py` (modified, +228/-0)
```diff
@@ -17,10 +17,12 @@
 from websockets.exceptions import ConnectionClosedError
 from websockets.frames import Close
 
+from fast_agent.config import Settings
 from fast_agent.constants import (
     FAST_AGENT_ERROR_CHANNEL,
     FAST_AGENT_RETRY,
 )
+from fast_agent.context import Context
 from fast_agent.llm.provider.openai.codex_responses import (
     CODEX_RESPONSES_LITE_HEADER,
     CODEX_RESPONSES_LITE_WS_METADATA_KEY,
@@ -51,6 +53,7 @@
 from fast_agent.llm.provider.openai.streaming_utils import (
     validate_incomplete_tool_entries,
 )
+from fast_agent.llm.provider.openai.xai_responses import XAIResponsesLLM
 from fast_agent.llm.provider.streaming_timeouts import (
     StreamIdleTimeoutError,
     StreamTiming,
@@ -2688,3 +2691,228 @@ async def test_connect_websocket_owns_supplied_client(
     manager.__aexit__.assert_awaited_once()
     assert str(client.websocket_base_url).startswith("wss://example.test")
     assert connect.call_args.kwargs["extra_query"] == {"q": "1"}
+
+
+@dataclass
+class _ProviderLifetimeClock:
+    now: float = 1.0
+
+    def __call__(self) -> float:
+        return self.now
+
+
+def _mock_provider_websocket(
+    monkeypatch: pytest.MonkeyPatch, *, xai: bool = True
+) -> tuple[ResponsesLLM, _ProviderLifetimeClock, list[ManagedWebSocketConnection]]:
+    llm = (
+        XAIResponsesLLM(context=Context(config=Settings()), model="grok-4.3")
+        if xai
+        else ResponsesLLM(
+            context=Context(config=Settings()), model="gpt-4.1", transport="websocket"
+        )
+    )
+    clock = _ProviderLifetimeClock()
+    # Keep the provider-created manager (and its configured lifetimes); replace only time/I/O.
+    monkeypatch.setattr(llm._ws_connections, "_clock", clock)
+    monkeypatch.setattr(llm, "_responses_client", _FakeResponsesClient)
+    monkeypatch.setattr(llm, "_build_websocket_headers", lambda: {})
+    connections: list[ManagedWebSocketConnection] = []
+
+    async def connect(
+        url: str, headers: dict[str, str], timeout_seconds: float | None
+    ) -> ManagedWebSocketConnection:
+        connection = ManagedWebSocketConnection(session=_FakeSession(), websocket=_FakeWebSocket())
+        connections.append(connection)
+        return connection
+
+    monkeypatch.setattr(llm, "_create_websocket_connection", connect)
+    return llm, clock, connections
+
+
+def _ws_event(event: dict[str, Any]) -> SimpleNamespace:
+    return SimpleNamespace(type=WSMsgType.TEXT, data=json.dumps(event))
+
+
+def _ws_completed() -> SimpleNamespace:
+    return _ws_event(
+        {
+            "type": "response.completed",
+            "response": {"id": "resp_test", "status": "completed", "output": []},
+        }
+    )
+
+
+def _ws_tool_history() -> list[dict[str, Any]]:
+    return [
+        *_ws_input_items("Read the file"),
+        {"type": "function_call", "call_id": "call_read", "name": "read_file", "arguments": "{}"},
+        {
+            "type": "function_call_output",
+            "call_id": "call_read",
+            "output": "retained file contents",
+        },
+    ]
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("xai", [True, False], ids=["xai-20-minutes", "openai-55-minutes"])
+async def test_provider_websocket_lifetime_rotation_preserves_history(
+    monkeypatch: pytest.MonkeyPatch, xai: bool
+) -> None:
+    llm, clock, connections = _mock_provider_websocket(monkeypatch, xai=xai)
+    history = _ws_tool_history()
+    model = "grok-4.3" if xai else "gpt-4.1"
+
+    async def receive(self: _FakeWebSocket, timeout: float | None = None) -> SimpleNamespace:
+        return _ws_completed()
+
+    monkeypatch.setattr(_FakeWebSocket, "receive", receive)
+    try:
+        for age, expected_connections in [
+            (0, 1),
+            (1199, 1),
+            (1200, 2 if xai else 1),
+            (2399, 2 if xai else 1),
+            (3299, 3 if xai else 1),
+            (3300, 3 if xai else 2),
+        ]:
+            clock.now = 1.0 + age
+            h
```

---

### Incident Patch 7: `108b059f` (2026-09-26)
**Commit Message**: fix: output polls bound poll folding; bound credential refresh lock and unblock exit on Copilot token timeout (#980)

* fix: treat output-bearing polls as fold boundaries instead of vetoes

* fix: bound credential refresh lock waits and keep Copilot token worker from blocking exit

**File**: `src/fast_agent/auth/credentials.py` (modified, +21/-3)
```diff
@@ -8,7 +8,7 @@
 from pathlib import Path
 from typing import Literal
 
-from filelock import FileLock
+from filelock import FileLock, Timeout
 from pydantic import BaseModel, Field
 
 from fast_agent.constants import FAST_AGENT_AUTH_FILE
@@ -17,6 +17,9 @@
 
 AUTH_KEYRING_SERVICE = "fast-agent-provider-auth"
 AuthSource = Literal["file", "keyring"]
+# Bounds waits behind another process's refresh so callers fail retryably
+# instead of blocking a worker thread indefinitely.
+CREDENTIAL_REFRESH_LOCK_TIMEOUT_SECONDS = 30.0
 
 
 class OAuthCredential(BaseModel):
@@ -120,12 +123,27 @@ def _file_lock(path: Path) -> FileLock:
 
 
 @contextmanager
-def credential_refresh_lock(provider: str):
+def credential_refresh_lock(
+    provider: str, *, timeout: float = CREDENTIAL_REFRESH_LOCK_TIMEOUT_SECONDS
+):
     configured_path = configured_auth_path()
     path = configured_path or default_auth_path()
     _ensure_parent_directory(path, private=configured_path is None)
-    with FileLock(path.parent / f".{provider}.refresh.lock"):
+    lock = FileLock(
+        path.parent / f".{provider}.refresh.lock",
+        timeout=timeout,
+    )
+    try:
+        lock.acquire()
+    except Timeout:
+        raise ProviderKeyError(
+            f"Timed out waiting for another fast-agent process to refresh {provider} credentials.",
+            "Retry the request.",
+        ) from None
+    try:
         yield
+    finally:
+        lock.release()
 
 
 def _read_file_credential(path: Path, provider: str) -> OAuthCredential | None:
```

**File**: `src/fast_agent/history/process_poll_folding.py` (modified, +3/-3)
```diff
@@ -829,7 +829,9 @@ def fold_managed_process_poll_history(
         exchange = _exchange(request, result, request_index=cursor - 1)
         if exchange is None or exchange.process_id != current.process_id:
             break
-        if _has_resource_observation(exchange):
+        # Warnings and output (or unknown output) bound the foldable suffix, so
+        # they stay in history while later quiet polls can still fold.
+        if _has_resource_observation(exchange) or _output_line_count(exchange) != 0:
             break
         reverse_exchanges.append(exchange)
         cursor -= 2
@@ -855,8 +857,6 @@ def fold_managed_process_poll_history(
     )
     if folded_polls < minimum_folded_polls:
         return None
-    if any(_output_line_count(exchange) != 0 for exchange in removed_exchanges):
-        return None
 
     first_removed = exchanges[0].request_index
     first_retained = exchanges[folded_polls].request_index
```

**File**: `src/fast_agent/llm/provider/copilot/broker.py` (modified, +8/-4)
```diff
@@ -15,6 +15,7 @@
     CopilotAuthenticationError,
     get_copilot_access_token,
 )
+from fast_agent.utils.async_utils import run_in_daemon_thread
 
 if TYPE_CHECKING:
     from collections.abc import Mapping
@@ -52,12 +53,15 @@ def __init__(self, settings: CopilotSettings) -> None:
         self._settings = settings
 
     async def _access_token(self, timeout: float) -> str:
-        # Resolve afresh in a worker. Timeout/cancellation stops waiting, not the
-        # worker: an in-flight refresh may still persist rotated tokens under the
-        # shared lock. HTTP has its own timeout; lock waits may outlive this call.
+        # Resolve afresh in a daemon worker. Timeout/cancellation stops waiting,
+        # not the worker: an in-flight refresh may still persist rotated tokens
+        # under the shared lock. HTTP and the lock wait are bounded; the keyring
+        # is not, so the worker must never block interpreter exit.
         try:
             async with asyncio.timeout(timeout):
-                token = await asyncio.to_thread(get_copilot_access_token)
+                token = await run_in_daemon_thread(
+                    get_copilot_access_token, name="fast-agent-copilot-token"
+                )
         except TimeoutError:
             raise ProviderKeyError("Copilot operation timed out.") from None
         if token is None:
```

**File**: `src/fast_agent/utils/async_utils.py` (modified, +33/-0)
```diff
@@ -1,7 +1,10 @@
 import asyncio
 import concurrent.futures
+import contextlib
+import contextvars
 import functools
 import sys
+import threading
 from collections.abc import Awaitable, Callable, Coroutine, Iterable
 from importlib.util import find_spec
 from typing import Any, ParamSpec, TypeVar
@@ -106,6 +109,36 @@ async def run_in_thread(func: Callable[P, T], *args: P.args, **kwargs: P.kwargs)
     return await to_thread.run_sync(func, *args)
 
 
+async def run_in_daemon_thread(func: Callable[[], T], *, name: str) -> T:
+    """Run a blocking callable in a daemon thread that never delays interpreter exit.
+
+    Unlike the default executor, cancellation or timeout abandons the thread, so
+    only use this for work that is safe to cut off at process exit.
+    """
+    loop = asyncio.get_running_loop()
+    future: asyncio.Future[T] = loop.create_future()
+    context = contextvars.copy_context()
+
+    def deliver(setter: Callable[[Any], None], value: object) -> None:
+        def settle() -> None:
+            if not future.done():
+                setter(value)
+
+        with contextlib.suppress(RuntimeError):  # loop closed after abandonment
+            loop.call_soon_threadsafe(settle)
+
+    def run() -> None:
+        try:
+            result = context.run(func)
+        except BaseException as exc:
+            deliver(future.set_exception, exc)
+        else:
+            deliver(future.set_result, result)
+
+    threading.Thread(target=run, name=name, daemon=True).start()
+    return await future
+
+
 def _run_in_new_loop(func: Callable[P, Awaitable[T]], *args: P.args, **kwargs: P.kwargs) -> T:
     def runner() -> T:
         loop = create_event_loop()
```

**File**: `tests/unit/fast_agent/auth/test_credentials.py` (modified, +16/-0)
```diff
@@ -2,11 +2,15 @@
 import stat
 from pathlib import Path
 
+import pytest
+
 from fast_agent.auth.credentials import (
     OAuthCredential,
+    credential_refresh_lock,
     load_oauth_credential,
     save_oauth_credential,
 )
+from fast_agent.core.exceptions import ProviderKeyError
 
 
 def test_auth_file_can_be_read_without_creating_a_sibling_lock(monkeypatch, tmp_path: Path) -> None:
@@ -70,3 +74,15 @@ def test_new_default_auth_directory_is_private(monkeypatch, tmp_path: Path) -> N
     auth_path = tmp_path / ".fast-agent" / "auth.json"
     assert stat.S_IMODE(auth_path.parent.stat().st_mode) == 0o700
     assert stat.S_IMODE(auth_path.stat().st_mode) == 0o600
+
+
+def test_refresh_lock_wait_is_bounded_and_retryable(monkeypatch, tmp_path: Path) -> None:
+    monkeypatch.setenv("FAST_AGENT_AUTH_FILE", str(tmp_path / "auth.json"))
+
+    with credential_refresh_lock("copilot"):
+        with pytest.raises(ProviderKeyError, match="another fast-agent process"):
+            with credential_refresh_lock("copilot", timeout=0.05):
+                pass
+
+    with credential_refresh_lock("copilot", timeout=0.05):
+        pass
```

---

### Incident Patch 8: `855f75cb` (2026-09-26)
**Commit Message**: fix: report output_line_count for durable polls, bump openai to 3.19.2 and release 0.10.35 (#979)

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.34"
+version = "0.10.35"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
@@ -24,7 +24,7 @@ dependencies = [
     "rich==15.0.0",
     "typer==0.27.2",
     "anthropic[vertex]==1.8.0",
-    "openai[aiohttp,realtime]==3.18.0",
+    "openai[aiohttp,realtime]==3.19.2",
     "prompt-toolkit==3.0.53",
     "aiohttp==3.14.3",
     "opentelemetry-exporter-otlp-proto-http==1.44.0",
```

**File**: `src/fast_agent/tools/shell_runtime.py` (modified, +5/-1)
```diff
@@ -1104,6 +1104,9 @@ async def _poll_durable_process(
             else max(time.time() - snapshot.spec.created_at, 0.0)
         )
         output_observed = bool(snapshot.stdout_total_bytes or snapshot.stderr_total_bytes)
+        # The durable spool only accounts bytes, so the byte delta is the exact
+        # no-output signal; the preview line count is a lower bound otherwise.
+        output_line_count = max(len(output.splitlines()), 1) if output_bytes else 0
         lines = [output] if output else []
         lines.extend(
             [
@@ -1126,6 +1129,7 @@ async def _poll_durable_process(
                 "process_yield_reason": poll_yield_reason,
                 "process_elapsed_seconds": elapsed,
                 "os_process_id": snapshot.status.child_pid,
+                "output_line_count": output_line_count,
                 "output_bytes_since_last_poll": output_bytes,
                 "retained_output_bytes_since_last_poll": retained_output_bytes,
                 "dropped_output_bytes_since_last_poll": dropped_output_bytes,
@@ -1160,7 +1164,7 @@ async def _poll_durable_process(
         self._append_poll_output_activity(
             result,
             output_bytes=output_bytes,
-            output_lines=len(output.splitlines()),
+            output_lines=output_line_count,
             seconds_since_last_output=seconds_since_last_output,
             output_observed=output_observed,
         )
```

**File**: `tests/unit/fast_agent/tools/test_durable_processes.py` (modified, +2/-0)
```diff
@@ -249,7 +249,9 @@ async def test_durable_poll_consumes_dropped_output_accounting(tmp_path: Path) -
     assert first_metadata["retained_output_bytes_since_last_poll"] == 1024
     assert first_metadata["dropped_output_bytes_since_last_poll"] == 200000 - 1024
     assert first_metadata["output_truncated"] is True
+    assert first_metadata["output_line_count"] > 0
     assert second_metadata["output_bytes_since_last_poll"] == 0
+    assert second_metadata["output_line_count"] == 0
     assert second_metadata["retained_output_bytes_since_last_poll"] == 0
     assert second_metadata["dropped_output_bytes_since_last_poll"] == 0
 
```

**File**: `uv.lock` (modified, +5/-5)
```diff
@@ -911,7 +911,7 @@ requires-dist = [{ name = "fast-agent-mcp", editable = "." }]
 
 [[package]]
 name = "fast-agent-mcp"
-version = "0.10.34"
+version = "0.10.35"
 source = { editable = "." }
 dependencies = [
     { name = "a2a-sdk" },
@@ -1037,7 +1037,7 @@ requires-dist = [
     { name = "nvidia-cudnn-cu12", marker = "platform_machine == 'x86_64' and sys_platform == 'linux' and extra == 'privacy-gpu'", specifier = ">=9" },
     { name = "onnxruntime", marker = "extra == 'privacy'", specifier = ">=1.25" },
     { name = "onnxruntime-gpu", marker = "extra == 'privacy-gpu'", specifier = ">=1.25" },
-    { name = "openai", extras = ["aiohttp", "realtime"], specifier = "==3.18.0" },
+    { name = "openai", extras = ["aiohttp", "realtime"], specifier = "==3.19.2" },
     { name = "opentelemetry-exporter-otlp-proto-http", specifier = "==1.44.0" },
     { name = "opentelemetry-instrumentation-anthropic", marker = "python_full_version >= '3.10' and python_full_version < '4'", specifier = "==0.62.3" },
     { name = "opentelemetry-instrumentation-google-genai", specifier = "==1.1b1" },
@@ -2295,7 +2295,7 @@ wheels = [
 
 [[package]]
 name = "openai"
-version = "3.18.0"
+version = "3.19.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "anyio" },
@@ -2305,9 +2305,9 @@ dependencies = [
     { name = "sniffio" },
     { name = "typing-extensions" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/1b/7b/a960e698f7126f31113764d7b441d7fe73caada32b6e65c6ca42c5343265/openai-3.18.0.tar.gz", hash = "sha256:780946991bc825f110ddde12c8c84885dd012ae64143d56d494922b7bb879b78", size = 1711178, upload-time = "2026-09-22T18:26:31.81Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/7c/91/2d5722388a50cc86e162779df5fbfe0afa652a6e2d5c9ee616e081a82098/openai-3.19.2.tar.gz", hash = "sha256:de185f9834ad064d965ec42bd0766731cf66bceea16a7670294a835d207019e6", size = 1716953, upload-time = "2026-09-24T00:06:07.315Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/5e/c3/262e12d6dc544e215c3f4f76525b0fadf749f8092e525772b9f868d89ea9/openai-3.18.0-py3-none-any.whl", hash = "sha256:31f170b59865cbf35ceb15699bd33b190fa660eb2f36591c74a161afc67152e7", size = 2068693, upload-time = "2026-09-22T18:26:29.518Z" },
+    { url = "https://files.pythonhosted.org/packages/bd/20/4fe123e60525375878c67d1d8d051c9c5dec81cc56a579ba9304ca743303/openai-3.19.2-py3-none-any.whl", hash = "sha256:66247fcd07266e72536e90656dc27f3b0bb1e9d8696d4013fc55402c0b96a5c2", size = 2071459, upload-time = "2026-09-24T00:06:05.416Z" },
 ]
 
 [package.optional-dependencies]
```

---

### Incident Patch 9: `07c460ee` (2026-09-25)
**Commit Message**: fix: persist and refresh Copilot OAuth tokens (#978)

GitHub's device flow returns an 8h access token plus a ~181-day refresh
token. Persist the refresh token and rotate it under the shared credential
lock before expiry, so Copilot logins no longer lapse daily.

**File**: `src/fast_agent/llm/provider/copilot/broker.py` (modified, +6/-5)
```diff
@@ -52,8 +52,9 @@ def __init__(self, settings: CopilotSettings) -> None:
         self._settings = settings
 
     async def _access_token(self, timeout: float) -> str:
-        # Load validated credentials afresh on every request. Only this read runs
-        # in a worker, so cancellation cannot leave authentication state mutations.
+        # Resolve afresh in a worker. Timeout/cancellation stops waiting, not the
+        # worker: an in-flight refresh may still persist rotated tokens under the
+        # shared lock. HTTP has its own timeout; lock waits may outlive this call.
         try:
             async with asyncio.timeout(timeout):
                 token = await asyncio.to_thread(get_copilot_access_token)
@@ -75,15 +76,15 @@ def _headers(self, token: str) -> dict[str, str]:
         }
 
     async def has_credentials(self, timeout: float | None = None) -> bool:
-        """Check local presence, expiry, and format without remote entitlement checks or login."""
+        """Resolve credentials (refreshing if needed), without entitlement checks or login."""
         limit = self._settings.runtime_timeout_seconds
         if timeout is not None:
             limit = min(timeout, limit)
         try:
             await self._access_token(limit)
         except CopilotAuthenticationError:
-            # Missing (raised above) and expired (raised by the loader) credentials
-            # both mean "not signed in". Invalid overrides/stores propagate.
+            # Missing, expired, or failed refresh means "not signed in".
+            # Invalid overrides/stores propagate.
             return False
         return True
 
```

**File**: `src/fast_agent/llm/provider/copilot/oauth.py` (modified, +62/-1)
```diff
@@ -16,6 +16,7 @@
 from fast_agent.auth.credentials import (
     OAuthCredential,
     StoredCredential,
+    credential_refresh_lock,
     delete_oauth_credential,
     load_oauth_credential,
     save_oauth_credential,
@@ -31,6 +32,7 @@
 _DEVICE_URL: Final = "https://github.com/login/device/code"
 _TOKEN_URL: Final = "https://github.com/login/oauth/access_token"
 _VERIFICATION_URI: Final = "https://github.com/login/device"
+_REFRESH_SKEW_SECONDS: Final = 60
 _LOGIN_HINT: Final = "Run `fast-agent auth provider login copilot`."
 
 _PositiveSeconds = Annotated[float, Field(gt=0, allow_inf_nan=False)]
@@ -68,6 +70,7 @@ class _DeviceResponse(_OAuthResponse):
 class _TokenResponse(_OAuthResponse):
     error: None = None
     access_token: Annotated[str, Field(min_length=1, pattern=r"^[!-~]+$")] = Field(repr=False)
+    refresh_token: _NonemptyString | None = Field(default=None, repr=False)
     token_type: Literal["bearer", "Bearer"]
     scope: str | None = None
     expires_in: _PositiveSeconds | None = None
@@ -191,6 +194,7 @@ async def poll_copilot_device_code(
                     raise _http_error(response)
                 return _CopilotCredential(
                     access_token=payload.access_token,
+                    refresh_token=payload.refresh_token,
                     token_type=payload.token_type,
                     scope=payload.scope,
                     expires_at=(
@@ -265,15 +269,72 @@ def _load_validated_credential() -> StoredCredential | None:
     return stored
 
 
+def _needs_refresh(credential: OAuthCredential) -> bool:
+    return (
+        credential.refresh_token is not None
+        and credential.expires_at is not None
+        and time.time() + _REFRESH_SKEW_SECONDS >= credential.expires_at
+    )
+
+
+def _refresh_credential(credential: OAuthCredential) -> OAuthCredential:
+    try:
+        with httpx.Client(timeout=30, trust_env=False, follow_redirects=False) as client:
+            response = client.post(
+                _TOKEN_URL,
+                data={
+                    "client_id": COPILOT_CLIENT_ID,
+                    "grant_type": "refresh_token",
+                    "refresh_token": credential.refresh_token,
+                },
+                headers={"Accept": "application/json"},
+                follow_redirects=False,
+            )
+    except httpx.RequestError:
+        raise ProviderKeyError(
+            "Unable to contact GitHub to refresh Copilot OAuth token.", "Retry the request."
+        ) from None
+    if not response.is_success:
+        raise ProviderKeyError(
+            f"Copilot OAuth refresh failed (HTTP {response.status_code}).", "Retry the request."
+        )
+    try:
+        payload = _TOKEN_RESPONSE.validate_json(response.content)
+    except ValidationError:
+        raise ProviderKeyError("Invalid GitHub refresh response.", "Retry the request.") from None
+    if isinstance(payload, _ErrorResponse):
+        if payload.error in {"bad_refresh_token", "invalid_grant", "expired_token"}:
+            raise CopilotAuthenticationError("GitHub rejected Copilot OAuth refresh.", _LOGIN_HINT)
+        raise ProviderKeyError(
+            "GitHub could not refresh Copilot OAuth token.", "Retry the request."
+        )
+    return _CopilotCredential(
+        access_token=payload.access_token,
+        refresh_token=payload.refresh_token or credential.refresh_token,
+        token_type=payload.token_type,
+        scope=payload.scope if payload.scope is not None else credential.scope,
+        expires_at=time.time() + payload.expires_in if payload.expires_in is not None else None,
+    )
+
+
 def get_copilot_credential() -> OAuthCredential | None:
-    """Resolve validated credentials, preferring the environment and rejecting expiry."""
+    """Resolve credentials, refreshing expiring stored tokens under the shared lock."""
     environment = _environment_credential()
     if environment is not None:
         return environment
     stored = _load
```

**File**: `src/fast_agent/ui/model_picker.py` (modified, +1/-1)
```diff
@@ -736,7 +736,7 @@ def _on_copilot_preflight_done(self, task: asyncio.Task[bool]) -> None:
 
 
 async def _preflight_copilot_auth(config_payload: dict[str, object]) -> bool:
-    """Check local Copilot credentials only; no network, login, or inference."""
+    """Resolve Copilot credentials, refreshing if needed; no login or inference."""
     from fast_agent.config import CopilotSettings
     from fast_agent.llm.provider.copilot.broker import CopilotBroker
 
```

**File**: `tests/unit/llm/test_copilot_credentials.py` (modified, +59/-0)
```diff
@@ -335,3 +335,62 @@ async def test_messages_adapter_uses_broker_auth_and_disables_eager_tool_streami
         assert tools == [{"name": "local", "input_schema": {"type": "object"}}]
     finally:
         await client.close()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("stop", ["timeout", "cancel"])
+async def test_refresh_can_finish_after_broker_stops_waiting(
+    monkeypatch: pytest.MonkeyPatch, broker: CopilotBroker, stop: str
+) -> None:
+    monkeypatch.delenv("COPILOT_GITHUB_TOKEN")
+    save_oauth_credential(
+        "copilot",
+        OAuthCredential(access_token=TOKEN, refresh_token="synthetic-refresh", expires_at=1),
+    )
+    loop = asyncio.get_running_loop()
+    started = asyncio.Event()
+    saved = asyncio.Event()
+    release = threading.Event()
+
+    def post(*args: object, **kwargs: object) -> httpx.Response:
+        loop.call_soon_threadsafe(started.set)
+        assert release.wait(5)
+        return httpx.Response(
+            200,
+            json={
+                "access_token": "refreshed-token",
+                "refresh_token": "rotated-token",
+                "token_type": "bearer",
+                "expires_in": 3600,
+            },
+        )
+
+    client = Mock()
+    client.__enter__ = Mock(return_value=client)
+    client.__exit__ = Mock(return_value=False)
+    client.post.side_effect = post
+    monkeypatch.setattr(oauth.httpx, "Client", Mock(return_value=client))
+
+    def save(provider: str, credential: OAuthCredential, *, source: str) -> None:
+        assert source == "file"
+        save_oauth_credential(provider, credential, source="file")
+        loop.call_soon_threadsafe(saved.set)
+
+    monkeypatch.setattr(oauth, "save_oauth_credential", save)
+    task = asyncio.create_task(broker.has_credentials(timeout=0.1 if stop == "timeout" else 30))
+    try:
+        await asyncio.wait_for(started.wait(), timeout=2)
+        if stop == "cancel":
+            task.cancel()
+            with pytest.raises(asyncio.CancelledError):
+                await task
+        else:
+            with pytest.raises(ProviderKeyError, match="timed out"):
+                await task
+        assert not saved.is_set()
+    finally:
+        release.set()
+        await asyncio.wait_for(saved.wait(), timeout=2)
+        await asyncio.gather(task, return_exceptions=True)
+    assert oauth.get_copilot_access_token() == "refreshed-token"
+    client.post.assert_called_once()
```

**File**: `tests/unit/llm/test_copilot_oauth.py` (modified, +194/-2)
```diff
@@ -351,13 +351,16 @@ async def test_success_displays_only_user_instructions_and_saves(
 ) -> None:
     output = Mock()
     monkeypatch.setattr(oauth.console.console, "print", output)
-    github.responses.extend([device_response(), token_response()])
+    github.responses.extend(
+        [device_response(), token_response(refresh_token="login-refresh-secret")]
+    )
     credential = await oauth.login_copilot_oauth_async()
     assert isinstance(credential, OAuthCredential)
     assert oauth.get_copilot_access_token() == TOKEN
     stored = credentials.load_oauth_credential("copilot")
     assert stored is not None
-    assert stored.credential.refresh_token is None
+    assert stored.credential.refresh_token == "login-refresh-secret"
+    assert "login-refresh-secret" not in repr(credential)
     rendered = str(output.call_args_list)
     assert "Waiting for GitHub approval. Ctrl+C to cancel." in rendered
     assert USER_CODE in rendered
@@ -664,3 +667,192 @@ async def test_device_token_must_be_printable_nonspace_ascii(
         await oauth.login_copilot_oauth_async()
     assert_safe(error.value, *([token] if token.strip() else []))
     assert not auth_file.exists()
+
+
+@pytest.fixture
+def refresh_http(monkeypatch: pytest.MonkeyPatch) -> list[httpx.Request]:
+    requests: list[httpx.Request] = []
+    client_type = httpx.Client
+
+    def respond(request: httpx.Request) -> httpx.Response:
+        requests.append(request)
+        return token_response(refresh_token="rotated-secret", expires_in=3600)
+
+    def factory(*, timeout: float, trust_env: bool, follow_redirects: bool) -> httpx.Client:
+        assert timeout == 30
+        assert trust_env is False
+        assert follow_redirects is False
+        return client_type(transport=httpx.MockTransport(respond), timeout=timeout)
+
+    monkeypatch.setattr(oauth.httpx, "Client", factory)
+    return requests
+
+
+@pytest.mark.parametrize("remaining", [-1, 30])
+def test_refresh_rotates_and_persists(
+    refresh_http: list[httpx.Request], clock: Clock, remaining: int
+):
+    credentials.save_oauth_credential(
+        "copilot",
+        OAuthCredential(
+            access_token="old-secret",
+            refresh_token="refresh-secret",
+            expires_at=clock.time() + remaining,
+        ),
+    )
+    credential = oauth.get_copilot_credential()
+    assert credential is not None
+    assert credential.refresh_token == "rotated-secret"
+    assert credential.expires_at == clock.time() + 3600
+    assert "rotated-secret" not in repr(credential)
+    stored = credentials.load_oauth_credential("copilot")
+    assert stored is not None
+    assert stored.credential.model_dump() == credential.model_dump()
+    assert oauth.get_copilot_access_token() == TOKEN
+    assert len(refresh_http) == 1
+    request = refresh_http[0]
+    assert str(request.url) == "https://github.com/login/oauth/access_token"
+    assert parse_qs(request.content.decode()) == {
+        "client_id": [oauth.COPILOT_CLIENT_ID],
+        "grant_type": ["refresh_token"],
+        "refresh_token": ["refresh-secret"],
+    }
+
+
+@pytest.mark.parametrize(
+    "response",
+    [
+        httpx.Response(400, text=TOKEN),
+        httpx.Response(302, headers={"Location": "https://example.invalid/"}),
+        httpx.Response(200, json={"error": TOKEN, "error_description": TOKEN}),
+        httpx.Response(200, text=TOKEN),
+        token_response(refresh_token=""),
+        httpx.ReadTimeout(TOKEN),
+    ],
+)
+def test_refresh_errors_preserve_store(
+    monkeypatch: pytest.MonkeyPatch, auth_file: Path, response: httpx.Response | httpx.RequestError
+):
+    credentials.save_oauth_credential(
+        "copilot", OAuthCredential(access_token=TOKEN, refresh_token="refresh-secret", expires_at=1)
+    )
+    original = auth_file.read_bytes()
+    client_type = httpx.Client
+
+    def respond(request: httpx.Request) -> httpx.Response:
+        if isinstance(response, httpx.RequestError):
+           
```

---

### Incident Patch 10: `539ef48f` (2026-09-25)
**Commit Message**: fix(async): propagate child cancellation promptly (#976)

**File**: `src/fast_agent/utils/async_utils.py` (modified, +26/-4)
```diff
@@ -129,8 +129,30 @@ async def gather_with_cancel(aws: Iterable[Awaitable[T]]) -> list[T | BaseExcept
     asyncio.CancelledError is re-raised so cancellation never gets swallowed.
     """
 
-    results = await asyncio.gather(*aws, return_exceptions=True)
-    for item in results:
-        if isinstance(item, asyncio.CancelledError):
-            raise item
+    tasks = [asyncio.ensure_future(aw) for aw in aws]
+    pending = set(tasks)
+    try:
+        while pending:
+            done, pending = await asyncio.wait(
+                pending,
+                return_when=asyncio.FIRST_COMPLETED,
+            )
+            cancelled = next((task for task in done if task.cancelled()), None)
+            if cancelled is not None:
+                for task in pending:
+                    task.cancel()
+                await asyncio.gather(*pending, return_exceptions=True)
+                cancelled.result()
+    except asyncio.CancelledError:
+        for task in pending:
+            task.cancel()
+        await asyncio.gather(*pending, return_exceptions=True)
+        raise
+
+    results: list[T | BaseException] = []
+    for task in tasks:
+        try:
+            results.append(task.result())
+        except BaseException as exc:
+            results.append(exc)
     return results
```

**File**: `tests/unit/fast_agent/utils/test_async_utils.py` (modified, +43/-0)
```diff
@@ -1,8 +1,11 @@
 """Tests for asyncio runtime helpers."""
 
+import asyncio
 import sys
 from types import SimpleNamespace
 
+import pytest
+
 from fast_agent.utils import async_utils
 
 
@@ -55,3 +58,43 @@ def broken_new_event_loop():
         async_utils._UVLOOP_REQUESTED = None
         async_utils._UVLOOP_CONFIGURED = None
         sys.modules.pop("uvloop", None)
+
+
+@pytest.mark.asyncio
+async def test_gather_with_cancel_preserves_results_and_exceptions() -> None:
+    async def return_value() -> int:
+        return 7
+
+    async def fail() -> int:
+        raise RuntimeError("failed")
+
+    results = await async_utils.gather_with_cancel([return_value(), fail()])
+
+    assert results[0] == 7
+    assert isinstance(results[1], RuntimeError)
+
+
+@pytest.mark.asyncio
+async def test_gather_with_cancel_propagates_child_cancellation_and_cancels_sibling() -> None:
+    sibling_started = asyncio.Event()
+    sibling_cancelled = asyncio.Event()
+
+    async def cancel() -> None:
+        await sibling_started.wait()
+        raise asyncio.CancelledError("child cancelled")
+
+    async def wait_forever() -> None:
+        sibling_started.set()
+        try:
+            await asyncio.Event().wait()
+        except asyncio.CancelledError:
+            sibling_cancelled.set()
+            raise
+
+    with pytest.raises(asyncio.CancelledError, match="child cancelled"):
+        await asyncio.wait_for(
+            async_utils.gather_with_cancel([cancel(), wait_forever()]),
+            timeout=1,
+        )
+
+    assert sibling_cancelled.is_set()
```

#### Recent Merged Pull Requests:
- **PR #993** (2026-09-29): fast-agent 0.10.41: fix inline PDFs on Copilot Responses and Claude (@evalstate)
- **PR #992** (2026-09-29): fast-agent 0.10.40: GPT-6.1 Sol (responses, codexresponses, copilot), openai 3.21.0 (@evalstate)
- **PR #991** (2026-09-29): fix: omit reasoning from copied ATIF context steps (@evalstate)
- **PR #990** (2026-09-30): feat(mcp): retain oversized MCP tool results in a model-readable spool (@evalstate)
- **PR #989** (2026-09-28): fast-agent 0.10.39: honor Responses end_turn continuations (@evalstate)
- **PR #988** (closed): Bump anthropic SDK to 1.9.0 (@evalstate)
- **PR #987** (2026-09-28): fix: reconstruct ATIF history across summary compaction (@evalstate)
- **PR #986** (2026-09-27): GPT-6 Sol/Astra default to freeform shell (@evalstate)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
