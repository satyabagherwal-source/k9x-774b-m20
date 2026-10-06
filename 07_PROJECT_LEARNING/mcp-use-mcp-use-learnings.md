# Forensic Learning Record (Deep Inspection): mcp-use/mcp-use

> **Canonical Artifact**: `07_PROJECT_LEARNING/mcp-use-mcp-use-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mcp-use/mcp-use](https://github.com/mcp-use/mcp-use))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:20:13.251Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mcp-use/mcp-use`
- **Description**: The fullstack MCP framework to develop MCP Apps for ChatGPT / Claude & MCP Servers for AI Agents.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10719 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `libraries/python/mcp_use/client/connectors/utils.py`
```
from typing import Any


def is_stdio_server(server_config: dict[str, Any]) -> bool:
    """Check if the server configuration is for a stdio server.

    Args:
        server_config: The server configuration section

    Returns:
        True if the server is a stdio server, False otherwise
    """
    return "command" in server_config and "args" in server_config

```

### Core Architecture Module: `libraries/python/mcp_use/connectors/utils.py`
```
# mcp_use/connectors/utils.py
import warnings
from typing import Any

from typing_extensions import deprecated

from mcp_use.client.connectors.utils import is_stdio_server as _is_stdio_server

warnings.warn(
    "mcp_use.connectors.utils is deprecated. "
    "Use mcp_use.client.connectors.utils. "
    "This import will be removed in version 2.0.0",
    DeprecationWarning,
    stacklevel=2,
)


@deprecated("Use mcp_use.client.connectors.utils.is_stdio_server")
def is_stdio_server(server_config: dict[str, Any]) -> bool:
    return _is_stdio_server(server_config)

```

### Core Architecture Module: `libraries/python/mcp_use/server/logging/state.py`
```
"""Shared state for MCP server logging."""

import threading

# Thread-local storage for MCP method info
_thread_local = threading.local()


def set_method_info(info: dict | None) -> None:
    """Store method info for current thread."""
    _thread_local.mcp_method_info = info


def get_method_info() -> dict | None:
    """Get method info for current thread."""
    return getattr(_thread_local, "mcp_method_info", None)

```

### Core Architecture Module: `libraries/python/mcp_use/server/utils/json_schema.py`
```
"""Utilities for producing MCP-compliant JSON Schemas.

Pydantic represents ``Optional[T]`` as ``{"anyOf": [{"type": "T"}, {"type":
"null"}]}``.  While valid JSON Schema, this is not idiomatic MCP — the protocol
signals optionality by omitting the property from the ``required`` array.  The
``anyOf``/null pattern also confuses several MCP clients (e.g. the Inspector)
which fail to render descriptions for those fields.

``simplify_optional_schema`` walks a JSON Schema object and collapses every
nullable ``anyOf`` into the simpler ``{"type": "T"}`` form.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

# Keys that live at the property level and must be preserved when we
# replace the ``anyOf`` wrapper with the inner type schema.
_PROPERTY_KEYS = ("description", "default", "title", "examples")

_NULL_SCHEMA = {"type": "null"}


def _is_nullable_any_of(any_of: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Return the non-null branch if *any_of* is exactly ``[<type>, null]``.

    Returns ``None`` when the pattern is more complex (``$ref`` schemas,
    >2 entries, …) so the caller can leave it untouched.
    """
    if len(any_of) != 2:
        return None

    first, second = any_of
    if second == _NULL_SCHEMA:
        base = first
    elif first == _NULL_SCHEMA:
        base = second
    else:
        return None

    # ``$ref`` schemas resolve to definitions elsewhere in the document —
    # stripping the ``anyOf`` wrapper would lose the nullable semantics.
    if "$ref" in base:
        return None

    return base


def _simplify_property(prop: dict[str, Any]) -> dict[str, Any]:
    """Return a simplified version of a single property schema.

    If *prop* contains a nullable ``anyOf`` of the form ``[<type>, null]``,
    returns a new dict based on the non-null branch with metadata preserved
    from the outer property.  For all other schemas the original *prop* dict
    is returned unchanged.  The input is never mutated.
    """
    any_of = prop.get("anyOf")
    if any_of is None:
        return prop

    base_type = _is_nullable_any_of(any_of)
    if base_type is None:
        # Complex anyOf — leave untouched
        return prop

    # Build the simplified property: start from the base type, overlay
    # any metadata that Pydantic placed at the outer level.
    simplified = dict(base_type)
    for key in _PROPERTY_KEYS:
        if key in prop:
            simplified[key] = prop[key]

    return simplified


def simplify_optional_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Return *schema* with nullable ``anyOf`` patterns simplified.

    Returns a deep copy when properties need simplification.  When the schema
    has no ``properties`` key (or it is empty), the original dict is returned
    as-is since there is nothing to transform.

    Only touches ``properties`` of the top-level object schema — nested
    ``$defs`` and deeply nested objects are left as-is since MCP tool schemas
    are typically flat.
    """
    properties = schema.get("properties")
    if not properties:
        return schema

    schema = deepcopy(schema)
    schema["properties"] = {name: _simplify_property(prop) for name, prop in schema["properties"].items()}
    return schema

```

### Core Architecture Module: `libraries/python/mcp_use/server/utils/openmcp.py`
```
from typing import TYPE_CHECKING, Any

from mcp import Resource, ServerCapabilities, Tool
from mcp.server.lowlevel.server import NotificationOptions
from mcp.types import Prompt, ResourceTemplate
from starlette.responses import JSONResponse

if TYPE_CHECKING:
    from mcp_use.server.server import MCPServer


class OpenMCPInfo:
    """OpenMCP server info structure."""

    def __init__(self, title: str, version: str | None = None, description: str | None = None):
        self.title = title
        self.version = version or "0.0.0"
        self.description = description


class OpenMCPResponse:
    """Strongly typed OpenMCP response structure."""

    def __init__(
        self,
        info: OpenMCPInfo,
        capabilities: ServerCapabilities,
        tools: list[Tool],
        resources: list[Resource],
        resources_templates: list[ResourceTemplate],
        prompts: list[Prompt],
    ):
        self.openmcp = "1.0"
        self.info = {
            "title": info.title,
            "version": info.version,
            "description": info.description,
        }
        self.capabilities = capabilities
        self.tools = tools
        self.resources = resources
        self.resources_templates = resources_templates
        self.prompts = prompts

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "openmcp": self.openmcp,
            "info": self.info,
            "capabilities": self.capabilities.model_dump(mode="json"),
            "tools": [tool.model_dump(mode="json") for tool in self.tools],
            "resources": [resource.model_dump(mode="json") for resource in self.resources],
            "resources_templates": [
                resource_template.model_dump(mode="json") for resource_template in self.resources_templates
            ],
            "prompts": [prompt.model_dump(mode="json") for prompt in self.prompts],
        }


async def get_openmcp_json(server: "MCPServer") -> JSONResponse:
    """
    Generate OpenMCP JSON response for a FastMCP server.

    Args:
        server: The FastMCP server instance
    Returns:
        JSONResponse containing the OpenMCP server description
    """
    import logging

    logger = logging.getLogger(__name__)

    try:
        # Gather server information
        logger.debug("Gathering server information for OpenMCP JSON response")

        try:
            tools = await server.list_tools()
            logger.debug(f"Successfully retrieved {len(tools)} tools")
        except Exception as e:
            logger.error(f"Failed to retrieve tools: {e}")
            tools = []

        try:
            resources = await server.list_resources()
            logger.debug(f"Successfully retrieved {len(resources)} resources")
        except Exception as e:
            logger.error(f"Failed to retrieve resources: {e}")
            resources = []

        try:
            resources_templates = await server.list_resource_templates()
            logger.debug(f"Successfully retrieved {len(resources_templates)} resource templates")
        except Exception as e:
            logger.error(f"Failed to retrieve resource templates: {e}")
            resources_templates = []

        try:
            capabilities = server._mcp_server.get_capabilities(NotificationOptions(), experimental_capabilities={})
            logger.debug("Successfully retrieved server capabilities")
        except Exception as e:
            logger.error(f"Failed to retrieve capabilities: {e}")
            capabilities = ServerCapabilities()

        try:
            prompts = await server.list_prompts()
            logger.debug(f"Successfully retrieved {len(prompts)} prompts")
        except Exception as e:
            logger.error(f"Failed to retrieve prompts: {e}")
            prompts = []

        # Create server info
        try:
            info = OpenMCPInfo(title=server.name, version=server._mcp_server.version, description=server.instructions)
            logger.debug("Successfully created server info")
        except Exception as e:
            logger.error(f"Failed to create server info: {e}")
            info = OpenMCPInfo(title="Unknown", version="0.0.0", description=None)

        # Build the response
        try:
            response = OpenMCPResponse(
                info=info,
                capabilities=capabilities,
                tools=tools,
                resources=resources,
                resources_templates=resources_templates,
                prompts=prompts,
            )
            logger.debug("Successfully created OpenMCP response")
        except Exception as e:
            logger.error(f"Failed to create OpenMCP response: {e}")
            # Fallback response
            response = OpenMCPResponse(
                info=info,
                capabilities=ServerCapabilities(),
                tools=[],
                resources=[],
                resources_templates=[],
                prompts=[],
            )

        try:
            result = JSONResponse(response.to_dict())
            logger.debug("Successfully generated JSON response")
            return result
        except Exception as e:
            logger.error(f"Failed to generate JSON response: {e}")
            # Return minimal fallback response
            fallback_response = {
                "openmcp": "1.0",
                "info": {"title": "Error", "version": "0.0.0", "description": "Failed to generate response"},
                "capabilities": {},
                "tools": [],
                "resources": [],
                "resources_templates": [],
                "prompts": [],
            }
            return JSONResponse(fallback_response)

    except Exception as e:
        logger.error(f"Unexpected error in get_openmcp_json: {e}")
        # Return minimal error response
        error_response = {
            "openmcp": "1.0",
            "info": {"title": "Error", "version": "0.0.0", "description": "Server error occurred"},
            "capabilities": {},
            "tools": [],
            "resources": [],
            "resources_templates": [],
            "prompts": [],
        }
        return JSONResponse(error_response)

```

### Core Architecture Module: `libraries/python/mcp_use/server/utils/routes.py`
```
"""Route handlers for the MCP server."""

import os

from starlette.requests import Request
from starlette.responses import HTMLResponse

from mcp_use.server.utils.openmcp import get_openmcp_json


async def docs_ui(request: Request) -> HTMLResponse:
    """Serve the docs UI."""
    template_path = os.path.join(os.path.dirname(__file__), "templates", "docs.html")
    with open(template_path) as f:
        return HTMLResponse(f.read())


async def openmcp_json(request: Request, server):
    """Serve the OpenMCP JSON configuration."""
    return await get_openmcp_json(server)

```

### Core Architecture Module: `libraries/python/mcp_use/server/utils/utils.py`
```
import inspect
import logging
import socket
from typing import Any, get_type_hints

logger = logging.getLogger(__name__)


def estimate_tokens(text: str) -> int:
    """Rough estimate of token count (approximately 4 characters per token)."""
    return max(1, len(str(text)) // 4)


def get_local_network_ip() -> str | None:
    """Get the local network IP address."""
    try:
        # Connect to a remote address to determine local IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError as exc:
        logger.debug("Failed to determine local network IP: %s", exc)
        return None


def get_return_type(func_or_callable) -> type:
    """Get the return type annotation from a function or callable class."""
    if inspect.isclass(func_or_callable):
        # It's a class, get return type from __call__ method
        if callable(func_or_callable):
            call_method = func_or_callable.__call__
            return get_return_type(call_method)
        return Any
    elif (
        callable(func_or_callable)
        and not inspect.isfunction(func_or_callable)
        and not inspect.ismethod(func_or_callable)
        and not inspect.isbuiltin(func_or_callable)
    ):
        # It's a callable class instance, get return type from __call__ method
        return get_return_type(func_or_callable.__call__)
    else:
        # It's a regular function
        try:
            # Try get_type_hints first (handles forward references)
            hints = get_type_hints(func_or_callable)
            return hints.get("return", Any)
        except (NameError, AttributeError):
            # Fallback to inspect.signature
            try:
                sig = inspect.signature(func_or_callable)
                return sig.return_annotation if sig.return_annotation != inspect.Signature.empty else Any
            except (ValueError, TypeError):
                return Any

```

### Core Architecture Module: `libraries/python/mcp_use/telemetry/utils.py`
```
"""
Utility functions for telemetry.

This module provides utilities for:
- Extracting model information from LangChain LLMs
- Converting MCP types to telemetry types
- High-level telemetry tracking helpers
"""

import importlib.metadata
import json
from typing import TYPE_CHECKING, Any

from langchain_core.language_models import BaseLanguageModel
from mcp.types import (
    EmbeddedResource,
    ImageContent,
    Implementation,
    Prompt,
    Resource,
    TextContent,
    Tool,
)

from mcp_use.telemetry.events import (
    AdapterUsageEvent,
    TelemetryClientInfo,
    TelemetryContent,
    TelemetryPrompt,
    TelemetryResource,
    TelemetryTool,
)

if TYPE_CHECKING:
    from mcp_use.server.server import MCPServer
    from mcp_use.telemetry.telemetry import Telemetry


def get_package_version() -> str:
    """Get the current mcp-use package version."""
    try:
        return importlib.metadata.version("mcp_use")
    except importlib.metadata.PackageNotFoundError:
        return "unknown"


def get_model_provider(llm: BaseLanguageModel) -> str:
    """Extract the model provider from LangChain LLM using BaseChatModel standards."""
    # Use LangChain's standard _llm_type property for identification
    return getattr(llm, "_llm_type", llm.__class__.__name__.lower())


def get_model_name(llm: BaseLanguageModel) -> str:
    """Extract the model name from LangChain LLM using BaseChatModel standards."""
    # First try _identifying_params which may contain model info
    if hasattr(llm, "_identifying_params"):
        identifying_params = llm._identifying_params
        if isinstance(identifying_params, dict):
            # Common keys that contain model names
            for key in ["model", "model_name", "model_id", "deployment_name"]:
                if key in identifying_params:
                    return str(identifying_params[key])

    # Fallback to direct model attributes
    return getattr(llm, "model", getattr(llm, "model_name", llm.__class__.__name__))


def extract_model_info(llm: BaseLanguageModel) -> tuple[str, str]:
    """Extract both provider and model name from LangChain LLM.

    Returns:
        Tuple of (provider, model_name)
    """
    return get_model_provider(llm), get_model_name(llm)


def safe_get(obj: Any, key: str, default: Any = None) -> Any:
    """Safely get value from dict or object attribute"""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def tool_to_telemetry(tool: Tool) -> TelemetryTool:
    """Convert MCP Tool to TelemetryTool"""
    return TelemetryTool(
        name=tool.name,
        title=safe_get(tool, "title"),
        description=safe_get(tool, "description"),
        input_schema=json.dumps(tool.inputSchema) if safe_get(tool, "inputSchema") else None,
        output_schema=None,  # MCP tools don't have output schema in the type
    )


def resource_to_telemetry(resource: Resource) -> TelemetryResource:
    """Convert MCP Resource to TelemetryResource"""
    return TelemetryResource(
        name=resource.name,
        title=safe_get(resource, "title"),
        description=safe_get(resource, "description"),
        uri=str(resource.uri),
        mimeType=safe_get(resource, "mimeType"),
    )


def prompt_to_telemetry(prompt: Prompt) -> TelemetryPrompt:
    """Convert MCP Prompt to TelemetryPrompt"""
    # Failsafe: if arguments exist, take the first and serialize as a string, else None
    if prompt.arguments and len(prompt.arguments) > 0:
        first_arg = prompt.arguments[0]
        args = json.dumps(first_arg.model_dump())
    else:
        args = None
    return TelemetryPrompt(
        name=prompt.name,
        title=safe_get(prompt, "title"),
        description=safe_get(prompt, "description"),
        args=args,
    )


def content_to_telemetry(content: TextContent | ImageContent | EmbeddedResource) -> TelemetryContent:
    """Convert MCP Content to TelemetryContent"""
    if isinstance(content, TextContent):
        text_len = len(content.text) if content.text else 0
        return TelemetryContent(
            mimeType=safe_get(content, "mimeType"),
            text=f"[text: {text_len} chars]",
            blob=None,
        )
    elif isinstance(content, ImageContent):
        return TelemetryContent(
            mimeType=content.mimeType,
            text=None,
            blob=f"[image: {content.mimeType}]",
        )
    elif isinstance(content, EmbeddedResource):
        return TelemetryContent(
            mimeType=None,
            text=f"[embedded resource: {content.resource.uri}]",
            blob=None,
        )
    else:
        return TelemetryContent(mimeType=None, text=None, blob=None)


def client_info_to_telemetry(client_info: Implementation) -> TelemetryClientInfo:
    """Convert MCP Implementation (ClientInfo) to TelemetryClientInfo"""
    return TelemetryClientInfo(
        name=client_info.name,
        version=client_info.version,
        title=None,  # Not in Implementation type
        description=None,  # Not in Implementation type
        websiteUrl=None,  # Not in Implementation type
    )


def capabilities_to_json(capabilities: dict[str, Any] | Any) -> str:
    """Convert capabilities to JSON string"""
    try:
        return json.dumps(capabilities)
    except Exception:
        return "{}"


def track_agent_execution_from_agent(
    agent: "Any",  # MCPAgent
    execution_method: str,
    query: str,
    success: bool,
    execution_time_ms: int,
    max_steps_used: int | None = None,
    manage_connector: bool = True,
    external_history_used: bool = False,
    steps_taken: int | None = None,
    response: str | None = None,
    error_type: str | None = None,
) -> None:
    """Track agent execution by extracting data from the agent instance.

    Args:
        agent: The MCPAgent instance
        execution_method: Method used ("run", "stream", "stream_events", etc.)
        query: The user query
        success: Whether execution succeeded
        execution_time_ms: Execution time in milliseconds
        max_steps_used: Maximum steps used (if different from configured)
        manage_connector: Whether connector was managed
        external_history_used: Whether external history was provided
        steps_taken: Number of steps taken
        response: The response (or summary for streaming)
        error_type: Error type if failed
    """
    server_count = len(agent.client.get_all_active_sessions()) if agent.client else len(agent.connectors)
    server_identifiers = [{"identifier": connector.public_identifier} for connector in agent.connectors]

    tools_available = agent._tools or []
    total_tools_available = len(tools_available)
    tools_available_names = [tool.name for tool in tools_available]

    agent.telemetry.track_agent_execution(
        execution_method=execution_method,
        query=query,
        success=success,
        model_provider=agent._model_provider,
        model_name=agent._model_name,
        server_count=server_count,
        server_identifiers=server_identifiers,
        total_tools_available=total_tools_available,
        tools_available_names=tools_available_names,
        max_steps_configured=agent.max_steps,
        memory_enabled=agent.memory_enabled,
        use_server_manager=agent.use_server_manager,
        max_steps_used=max_steps_used,
        manage_connector=manage_connector,
        external_history_used=external_history_used,
        steps_taken=steps_taken,
        tools_used_count=len(agent.tools_used_names),
        tools_used_names=agent.tools_used_names,
        response=response,
        execution_time_ms=execution_time_ms,
        error_type=error_type,
        conversation_history_length=len(agent._conversation_history),
    )


def track_server_run_from_server(
    server: "MCPServer",
    transport: str,
    host: str,
    port: int,
    telemetry: "Telemetry",
) -> None:
    """Track server run event by extracting data from the server instance.

    Args:
        server: The MCPServer instance
        transport: Transport type being used
        host: Host address
        port: Port number
        telemetry: Telemetry instance to use for tracking
    """
    tools_list = list(server._tool_manager._tools.values())
    resources_list = list(server._resource_manager._resources.values())
    prompts_list = list(server._prompt_manager._prompts.values())

    tool_names = [tool.name for tool in tools_list]
    tools_telemetry = [tool_to_telemetry(tool) for tool in tools_list]

    resource_names = [resource.name for resource in resources_list]
    resources_telemetry = [resource_to_telemetry(resource) for resource in resources_list]

    prompt_names = [prompt.name for prompt in prompts_list]
    prompts_telemetry = [prompt_to_telemetry(prompt) for prompt in prompts_list]

    base_url = None
    if transport in ("streamable-http", "sse"):
        base_url = f"http://{host}:{port}"

    has_auth = False

    capabilities_dict = {
        "tools": len(tools_list) > 0,
        "resources": len(resources_list) > 0,
        "prompts": len(prompts_list) > 0,
    }
    capabilities_json = capabilities_to_json(capabilities_dict)

    telemetry.track_server_run(
        transport=transport,
        tools_number=len(tools_list),
        resources_number=len(resources_list),
        prompts_number=len(prompts_list),
        auth=has_auth,
        name=server.name,
        description=server.instructions,
        base_url=base_url,
        tool_names=tool_names,
        resource_names=resource_names,
        prompt_names=prompt_names,
        tools=tools_telemetry,
        resources=resources_telemetry,
        prompts=prompts_telemetry,
        templates=None,
        capabilities=capabilities_json,
        apps_sdk_resources=None,
        mcp_ui_resources=None,
    )


def track_adapter_usage(
    adapter: "Any",  # BaseAdapter
    operation: str,
    telemetry: "Telemetry",
) -> None:
    """Track adapter usage by ex
```

### Core Architecture Module: `libraries/python/mcp_use/utils.py`
```
def singleton(cls):
    """A decorator that implements the singleton pattern for a class.

    This decorator ensures that only one instance of a class is ever created.
    Subsequent attempts to create a new instance will return the existing one.

    Usage:
        @singleton
        class MySingletonClass:
            def __init__(self):
                # ... initialization ...
                pass

    Args:
        cls: The class to be decorated.

    Returns:
        A wrapper function that handles instance creation.
    """
    instance = [None]

    def wrapper(*args, **kwargs):
        if instance[0] is None:
            instance[0] = cls(*args, **kwargs)
        return instance[0]

    return wrapper

```

### Core Architecture Module: `libraries/typescript/packages/agent/src/agents/utils/ai_sdk.ts`
```
/**
 * AI SDK Integration Utilities
 *
 * Utility functions for integrating MCPAgent's streamEvents with Vercel AI SDK.
 * These utilities help convert stream events to AI SDK compatible formats.
 */

import type { StreamEvent } from "@langchain/core/tracers/log_stream";

/**
 * Converts LangChain model stream events to text chunks.
 *
 * @param streamEvents - Events returned by the LangChain agent's
 * `streamEvents` method.
 * @returns An async generator containing only model text chunks.
 */
export async function* streamEventsToAISDK(
  streamEvents: AsyncGenerator<StreamEvent, void, void>
): AsyncGenerator<string, void, void> {
  for await (const event of streamEvents) {
    if (event.event === "on_chat_model_stream" && event.data?.chunk?.text) {
      const textContent = event.data.chunk.text;
      if (typeof textContent === "string" && textContent.length > 0) {
        yield textContent;
      }
    }
  }
}

/**
 * Wraps an async text generator in a web `ReadableStream`.
 *
 * @param generator - Async text generator to consume.
 * @returns A stream that enqueues each generated string and forwards errors.
 */
export function createReadableStreamFromGenerator(
  generator: AsyncGenerator<string, void, void>
): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Converts LangChain events to text and inserts tool lifecycle messages.
 *
 * @param streamEvents - Events returned by the LangChain agent's
 * `streamEvents` method.
 * @returns Model text interleaved with human-readable tool start/end messages.
 */
export async function* streamEventsToAISDKWithTools(
  streamEvents: AsyncGenerator<StreamEvent, void, void>
): AsyncGenerator<string, void, void> {
  for await (const event of streamEvents) {
    switch (event.event) {
      case "on_chat_model_stream":
        if (event.data?.chunk?.text) {
          const textContent = event.data.chunk.text;
          if (typeof textContent === "string" && textContent.length > 0) {
            yield textContent;
          }
        }
        break;

      case "on_tool_start":
        yield `\n🔧 Using tool: ${event.name}\n`;
        break;

      case "on_tool_end":
        yield `\n✅ Tool completed: ${event.name}\n`;
        break;
      default:
        break;
    }
  }
}

```

### Core Architecture Module: `libraries/typescript/packages/agent/src/agents/utils/index.ts`
```
export {
  createReadableStreamFromGenerator,
  streamEventsToAISDK,
  streamEventsToAISDKWithTools,
} from "./ai_sdk.js";

export {
  createLLMFromString,
  getSupportedProviders,
  isValidLLMString,
  parseLLMString,
  type LLMConfig,
  type LLMProvider,
  type ParsedLLMString,
} from "./llm_provider.js";

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2756** (2026-10-05): **create-mcp-use-app README: nonexistent mcp-ui template, old server API examples, missing .env.example**
  *Symptoms*: **Describe the bug**  Several instructions in the `create-mcp-use-app` README (also the npm package page) no longer match what the CLI creates. Following them fails:  1. **`--template mcp-ui` doesn't exist.** The README lists it under "With Options" and has an "MCP-UI Template" section. With create-mcp-use-app 2.0.8:    ```    ❌ Template "mcp-ui" not found!    Available templates: blank, mcp-apps, mcp-server    ```    The `blank` template isn't documented. 2. **The examples use the old server API.** "Creating a Tool / a Resource / a Prompt" call `server.tool("search_database", { parameters, execute })`, `server.resource("user_profile", { fetch })` and `server.prompt("code_review", { arguments, render })`. All three fail to type-check against `mcp-use` 2.x (`TS2345: Argument of type 'string' is not assignable to parameter of type 'ToolDefinition'`, and likewise for `ResourceDefinition` and `PromptDefinition`). At runtime the tool and resource examples register without an error, but then every request to the server, including `initialize`, fails with HTTP 500 "Internal server error". 3. **`.env.example` doesn't exist.** "Environment Variables" says the project includes a `.env.example` (with Langfuse keys) and to `cp .env.example .env`. No template ships that file, so the command fails. 4. **The Quick Start never starts the server.** It runs `npx create-mcp-use-app my-mcp-server` and `cd my-mcp-server`, then says "Your MCP server is running at `http://localhost:3000`". The CLI 

- **Issue #2743** (2026-10-02): **Semaprax policy-middleware example for MCP server tool calls**
  *Symptoms*: ### Use case An MCP server built with mcp-use may authenticate a caller yet still need to decide whether a particular `tools/call` is permitted for the supplied arguments. For example, a file tool may allow reads under one project but refuse writes elsewhere. A Semaprax adapter could evaluate a typed proposal at the server's tool boundary, keeping mcp-use responsible for authentication and actual dispatch.  ### Requested addition Please consider a runnable TypeScript example of a server-side tool middleware that reads the final tool name and arguments, takes caller identity from trusted `ctx.auth`, and maps an allow/deny result to a normal MCP tool response without invoking the handler on denial. The example should cover allow, deny, and policy-service failure. It should not imply that a client-side wrapper can enforce policy on calls made through another client.  Issue #2683 notes that `ctx.auth` currently has different shapes in middleware and tool callbacks. The example should use the supported accessor once that is resolved, or document the current mapping explicitly. This is an optional Semaprax demonstration, not a request to embed a compiler in mcp-use.  Semaprax: https://github.com/wavect/semaprax 
  **Post-Mortem & Fix Analysis**:
  > Feel free to make an mcp-use example for your repo

- **Issue #2726** (2026-10-05): **create-mcp-use-app README: "Connect to AI" example passes url to MCPClient, so the agent gets no tools**
  *Symptoms*: **Describe the bug**  The "Connect to AI" example in the create-mcp-use-app README, which is also the npm package page, creates its client like this:  ```ts const client = new MCPClient({   url: "http://localhost:3000/mcp", }); ```  `MCPClient` reads servers only from `mcpServers` and ignores a top-level `url`. The config parameter is typed `string | Record<string, any>`, so TypeScript doesn't flag it. The client ends up with no servers, and the agent built on it runs with no MCP tools.  **To Reproduce**  Built from `canary`, Node 22.22.2. Against a local `MCPServer` with one `say-hello` tool, `createAllSessions()` and `listTools()` give:  ``` [mcp-use] warn: No MCP servers defined in config README  { url }: servers=[] tools=[] fixed   { mcpServers }: servers=["local"] tools=["say-hello"] ```  **Expected behavior**  The example connects to the server it starts. The client README and the v2 docs use:  ```ts const client = new MCPClient({   mcpServers: {     local: { url: "http://localhost:3000/mcp" },   }, }); ```  I'll open a PR with the README fix. 
  **Post-Mortem & Fix Analysis**:
  > In Canary, will be closed after the next release

- **Issue #2724** (2026-10-05): **cli: mcp-use screenshot on Windows only looks for Chrome in two places and never tries Edge**
  *Symptoms*: **Describe the bug**  On Windows, `mcp-use screenshot` without `--cdp-url` looks for a browser in exactly two places (`chromeExecutable` in `packages/cli/src/commands/screenshot.ts`):  ``` %PROGRAMFILES%\Google\Chrome\Application\chrome.exe %LOCALAPPDATA%\Google\Chrome\Application\chrome.exe ```  On a machine without Chrome in either location, the command fails with `chrome_not_found: Chrome, Chromium, Edge, or Brave was not found. Set MCP_USE_CHROME_PATH.` That happens even though Microsoft Edge ships with every Windows 10/11 install at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. The macOS branch already checks Edge and Brave, and the error message lists them. The lookup also misses Chrome installed under `Program Files (x86)`, where older installers put it. When one of the environment variables is unset, its candidate becomes `\Google\Chrome\...`, which resolves relative to the current drive.  **To Reproduce**  On Windows with Edge but no Chrome under `%PROGRAMFILES%` or `%LOCALAPPDATA%`:  ``` mcp-use screenshot --mcp http://localhost:3000/mcp --tool show-app appName=Demo ```  The command exits with code 1 and reports `chrome_not_found`.  Edge itself works with this flow. On Windows 11, Node 22.22.2, with `MCP_USE_CHROME_PATH` pointing at `msedge.exe`, the command captures the `show-app` view of the `mcp-apps` template correctly: headless Edge, same launch flags, same CDP calls. My machine also has Chrome, so I couldn't show the failure directly. Windows
  **Post-Mortem & Fix Analysis**:
  > @freetrip1 Thanks for reporting this. Out of curiosity are you still using the screenshot CLI in your dev flows? Agents have gotten really good at browser use and taking screenshots themselves so I'm curious if this feature is still getting usage
  > @khandrew1, so do we need to fix this?
  > @Prasad8830 the PR was low impact so it's in canary, this issue will be closed in the next release

- **Issue #2706** (2026-09-30): **create-mcp-use-app fails for templates whose default branch is not main or master**
  *Symptoms*: **Describe the bug**  `create-mcp-use-app` accepts a GitHub repository as a template without a branch suffix, but it does not use that repository's default branch. It tries `main` twice and then `master`. A public repository whose default branch is `develop` fails at the clone step, and the CLI may incorrectly suggest that the repository does not exist or is private.  **To Reproduce**  1. Use `create-mcp-use-app@2.0.7` with Git installed. 2. Choose the public repository [Dhaigvip/mcp-server-template](https://github.com/Dhaigvip/mcp-server-template) (this is only an example) , whose only branch is `develop`. 3. Run:     ```sh    npx --yes create-mcp-use-app@2.0.7 branch-test \      --template Dhaigvip/mcp-server-template \      --no-install --no-skills    ```  4. The clone fails because the CLI requests `main` instead of the remote default branch.  **Expected behavior**  When no branch is specified, the CLI should clone the repository's default branch. When a branch is specified with `owner/repo#branch`, it should use that branch exactly and report clearly if it does not exist.  **Screenshots**  Not applicable; this is a CLI bug. Relevant terminal output from the original implementation:  ```text ❌ Error cloning repository: https://github.com/Dhaigvip/mcp-server-template.git    Repository may not exist or is private warning: Could not find remote branch main to clone. fatal: Remote branch main not found in upstream origin ```  **Desktop (please complete the following informati
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. We’re focusing on our maintained mcp-use templates and aren’t planning to expand default-branch handling for custom templates at this time. For compatible mcp-use templates, specifying --template owner/repo#branch should work fine. `create-mcp-use-app` is meant to scaffold a new mcp-use Typescript project, so putting this Python repository as the option doesn't really make sense. Closing this out as not planned.

- **Issue #2670** (2026-10-02): **examples: AI SDK example fails to install on a fresh checkout**
  *Symptoms*: **Describe the bug**  The install command in [packages/client/examples/node/ai-sdk-openai/README.md](https://github.com/mcp-use/mcp-use/blob/main/libraries/typescript/packages/client/examples/node/ai-sdk-openai/README.md) fails on a fresh checkout:      pnpm install --ignore-workspace --frozen-lockfile  It fails for two reasons:  1. **No lockfile.** `--frozen-lockfile` requires a `pnpm-lock.yaml`, but the example doesn't ship one (it was intentionally left out in #2445 via `chore(client): omit example lockfile`). So the README command exits with `ERR_PNPM_NO_LOCKFILE`. <img width="1688" height="50" alt="Image" src="https://github.com/user-attachments/assets/eb0ee9ab-c662-4eb5-8014-bdecaa2e4557" />  2.  **Blocked esbuild build.** Dropping `--frozen-lockfile` gets further, but on the repo's pinned pnpm (11.13.1) the install exits with `ERR_PNPM_IGNORED_BUILDS` for `esbuild`. The repo allows esbuild in `libraries/typescript/pnpm-workspace.yaml`, but `--ignore-workspace` skips that file, so the permission never applies here. The packages do get installed, but the command exits with code 1, which breaks anything chained after it.     **To Reproduce** Steps to reproduce the behavior: 1. Fresh clone, `canary` 2. `cd libraries/typescript/packages/client/examples/node/ai-sdk-openai` 3. `pnpm install --ignore-workspace --frozen-lockfile` → `ERR_PNPM_NO_LOCKFILE` 4. `pnpm install --ignore-workspace` → `ERR_PNPM_IGNORED_BUILDS` (exit 1)  **Expected behavior** The README's install command
  **Post-Mortem & Fix Analysis**:
  > Hi, I’d like to work on this issue. I’ve reviewed the problem and believe I can contribute a solution. Could you please assign it to me? 

- **Issue #2652** (2026-09-24): **[Bug] getOAuthTokenExpiry silently drops exp when JWT payload contains Base64URL characters**
  *Symptoms*: ## The problem  `getOAuthTokenExpiry` decodes the JWT payload using `atob()`:  ```typescript const payload = JSON.parse(atob(tokens.access_token?.split(".")[1] ?? "")); ```  `atob()` expects standard Base64 (`+`, `/`), while JWTs use Base64URL encoding (`-`, `_`). When the encoded payload contains characters that are not accepted by `atob()`, decoding fails and the surrounding `try/catch` silently swallows the error.  ## What actually happens  The function returns `undefined` for a JWT that contains a valid `exp` claim. This causes the token expiration to be missed and may affect automatic token refresh.  ## Expected behavior  The Base64URL payload should be decoded correctly, and the `exp` claim should be extracted and returned.  ## Reproduction  ```typescript import { getOAuthTokenExpiry } from "./token-expiry.js"; const token = "eyJhbGciOiJub25lIn0.eyJleHAiOjE3MDAwMDAwMDAsIm5hbWUiOiJVc2VyLU5hbWUg8J-agCJ9.sig"; getOAuthTokenExpiry({ access_token: token }); // Expected: 1700000000000 // Actual:   undefined ```  A regression test can be added to `token-expiry.test.ts` to verify this behavior.
  **Post-Mortem & Fix Analysis**:
  > @Arpitm544  I would love to work on this, Or are you already working on it.
  > Thanks! This duplicates #2534 and is fixed in #2660, so closing as a duplicate.

- **Issue #2649** (2026-09-28): **cli: dev stop-tunnel failure escapes the handler, so the Inspector shows a generic error and the reason is dropped**
  *Symptoms*: ### Summary  `createDevApiHandler` handles a `start-tunnel` failure but not a `stop-tunnel` failure. In `libraries/typescript/packages/cli/src/cli/dev-api.ts:80-94` (canary `c0ebb64e`):  ```ts     if (request.method === "POST" && pathname === startPath) {       try {         await options.tunnel.start(options.port);         return Response.json({ ok: true, restarting: false });       } catch (error) {         const message =           error instanceof Error ? error.message : "Failed to start tunnel";         return Response.json({ error: message }, { status: 500 });       }     }      if (request.method === "POST" && pathname === stopPath) {       await options.tunnel.stop();       return Response.json({ ok: true });     } ```  `options.tunnel.stop()` is awaited bare, so a rejection propagates out of the handler instead of becoming the `{ error }` response its sibling route returns.  ### The Problem  1. **The handler breaks its own contract on that route.** It is typed `Promise<Response>`, and for `start-tunnel` a failure resolves to a 500. For `stop-tunnel` the returned promise rejects. Verified against canary:     ```    start-tunnel failure -> status 500, body {"error":"tunnel setup timed out"}    stop-tunnel failure  -> REJECTED, "relay connection already closed"    ```  2. **The Inspector loses the reason.** `toNodeHandler` catches the rejection and substitutes a generic response (`node-bridge.ts:115-124`):     ```ts        } catch (error) {          try {            opt
  **Post-Mortem & Fix Analysis**:
  > Closing as not reproducible. `TunnelManager.stop()` is designed never to reject: `releaseTunnel` swallows relay errors, the respawn loop catches its own failures, and closing an already-closed WebSocket does nothing. The reported error string only exists in the mock in #2650. Details in https://github.com/mcp-use/mcp-use/pull/2650#issuecomment-5879744858.

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

### Incident Patch 1: `90b6b8b1` (2026-10-05)
**Commit Message**: Revert "fix(create-mcp-use-app): don't leave an empty project directory when …" (#2764)

This reverts commit 1190d5dab2d87e7ffca758dc46c9f634822636b9.

**File**: `libraries/typescript/.changeset/create-app-failed-scaffold-dir.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-"create-mcp-use-app": patch
----
-
-A scaffold that fails before copying the template no longer leaves an empty project directory behind. An unknown or invalid `--template`, or a GitHub template that can't be cloned, used to leave `my-project/` in place, so retrying with a valid template failed with `Directory "my-project" already exists!` until the directory was deleted by hand.
```

**File**: `libraries/typescript/packages/create-mcp-use-app/src/__tests__/failed-scaffold.test.ts` (removed, +0/-43)
```diff
@@ -1,43 +0,0 @@
-import { spawnSync } from "node:child_process";
-import { existsSync, mkdtempSync, rmSync } from "node:fs";
-import { tmpdir } from "node:os";
-import { join } from "node:path";
-import { fileURLToPath } from "node:url";
-import { afterEach, beforeEach, describe, expect, it } from "vitest";
-
-// Runs the built CLI (`pnpm build` first), like the scaffold e2e check.
-const cli = fileURLToPath(new URL("../../dist/index.js", import.meta.url));
-
-describe("scaffolding with a template that can't be used", () => {
-  let cwd: string;
-
-  beforeEach(() => {
-    cwd = mkdtempSync(join(tmpdir(), "create-mcp-use-app-"));
-  });
-
-  afterEach(() => {
-    rmSync(cwd, { recursive: true, force: true });
-  });
-
-  it.each(["nope", "bad name!"])(
-    "exits without creating the project directory for --template %j",
-    (template) => {
-      const result = spawnSync(
-        process.execPath,
-        [
-          cli,
-          "my-project",
-          "--template",
-          template,
-          "--dev",
-          "--no-install",
-          "--no-skills",
-        ],
-        { cwd, encoding: "utf8" }
-      );
-
-      expect(result.status).toBe(1);
-      expect(existsSync(join(cwd, "my-project"))).toBe(false);
-    }
-  );
-});
```

**File**: `libraries/typescript/packages/create-mcp-use-app/src/index.ts` (modified, +5/-6)
```diff
@@ -643,19 +643,13 @@ async function copyTemplate(
   );
 }
 
-/**
- * Copy a template into `dest`, creating it. The project directory is only
- * created here, so a scaffold that fails earlier (unknown template, failed
- * clone) leaves nothing behind for the next attempt to trip over.
- */
 function copyDirectoryWithProcessing(
   src: string,
   dest: string,
   versions: Record<string, string>,
   isDevelopment: boolean
 ) {
   const entries = readdirSync(src, { withFileTypes: true });
-  mkdirSync(dest, { recursive: true });
 
   for (const entry of entries) {
     if (entry.name === ".git") {
@@ -667,6 +661,7 @@ function copyDirectoryWithProcessing(
     const destPath = join(dest, destName);
 
     if (entry.isDirectory()) {
+      mkdirSync(destPath, { recursive: true });
       copyDirectoryWithProcessing(srcPath, destPath, versions, isDevelopment);
     } else if (entry.name === "package.json" || entry.name.endsWith(".json")) {
       const processedContent = processTemplateFile(
@@ -930,6 +925,10 @@ async function main(): Promise<void> {
   }
   const versions = { "mcp-use": mcpUseVersion };
 
+  if (!useCurrentDir) {
+    mkdirSync(projectPath, { recursive: true });
+  }
+
   console.log(ansi.cyan(`🚀 Creating MCP server "${displayName}"...`));
 
   const validatedTemplate = validateTemplateName(selectedTemplate);
```

---

### Incident Patch 2: `1190d5da` (2026-10-05)
**Commit Message**: fix(create-mcp-use-app): don't leave an empty project directory when scaffolding fails (#2759)

* fix(create-mcp-use-app): don't leave an empty project directory when scaffolding fails

The project directory was created before the template was validated or cloned, so an unknown template, an invalid name or a failed clone left it behind and the retry failed with 'already exists'. Create it when the template is copied.

* fix(create-mcp-use-app): read the template before creating the destination

**File**: `libraries/typescript/.changeset/create-app-failed-scaffold-dir.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"create-mcp-use-app": patch
+---
+
+A scaffold that fails before copying the template no longer leaves an empty project directory behind. An unknown or invalid `--template`, or a GitHub template that can't be cloned, used to leave `my-project/` in place, so retrying with a valid template failed with `Directory "my-project" already exists!` until the directory was deleted by hand.
```

**File**: `libraries/typescript/packages/create-mcp-use-app/src/__tests__/failed-scaffold.test.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { spawnSync } from "node:child_process";
+import { existsSync, mkdtempSync, rmSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { fileURLToPath } from "node:url";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+
+// Runs the built CLI (`pnpm build` first), like the scaffold e2e check.
+const cli = fileURLToPath(new URL("../../dist/index.js", import.meta.url));
+
+describe("scaffolding with a template that can't be used", () => {
+  let cwd: string;
+
+  beforeEach(() => {
+    cwd = mkdtempSync(join(tmpdir(), "create-mcp-use-app-"));
+  });
+
+  afterEach(() => {
+    rmSync(cwd, { recursive: true, force: true });
+  });
+
+  it.each(["nope", "bad name!"])(
+    "exits without creating the project directory for --template %j",
+    (template) => {
+      const result = spawnSync(
+        process.execPath,
+        [
+          cli,
+          "my-project",
+          "--template",
+          template,
+          "--dev",
+          "--no-install",
+          "--no-skills",
+        ],
+        { cwd, encoding: "utf8" }
+      );
+
+      expect(result.status).toBe(1);
+      expect(existsSync(join(cwd, "my-project"))).toBe(false);
+    }
+  );
+});
```

**File**: `libraries/typescript/packages/create-mcp-use-app/src/index.ts` (modified, +6/-5)
```diff
@@ -643,13 +643,19 @@ async function copyTemplate(
   );
 }
 
+/**
+ * Copy a template into `dest`, creating it. The project directory is only
+ * created here, so a scaffold that fails earlier (unknown template, failed
+ * clone) leaves nothing behind for the next attempt to trip over.
+ */
 function copyDirectoryWithProcessing(
   src: string,
   dest: string,
   versions: Record<string, string>,
   isDevelopment: boolean
 ) {
   const entries = readdirSync(src, { withFileTypes: true });
+  mkdirSync(dest, { recursive: true });
 
   for (const entry of entries) {
     if (entry.name === ".git") {
@@ -661,7 +667,6 @@ function copyDirectoryWithProcessing(
     const destPath = join(dest, destName);
 
     if (entry.isDirectory()) {
-      mkdirSync(destPath, { recursive: true });
       copyDirectoryWithProcessing(srcPath, destPath, versions, isDevelopment);
     } else if (entry.name === "package.json" || entry.name.endsWith(".json")) {
       const processedContent = processTemplateFile(
@@ -925,10 +930,6 @@ async function main(): Promise<void> {
   }
   const versions = { "mcp-use": mcpUseVersion };
 
-  if (!useCurrentDir) {
-    mkdirSync(projectPath, { recursive: true });
-  }
-
   console.log(ansi.cyan(`🚀 Creating MCP server "${displayName}"...`));
 
   const validatedTemplate = validateTemplateName(selectedTemplate);
```

---

### Incident Patch 3: `e352527d` (2026-10-05)
**Commit Message**: docs(create-mcp-use-app): fix README instructions that no longer match the scaffold (#2757)

Remove the nonexistent mcp-ui template and document blank, add npm run dev to the quick start, point at views/my-view, .mcp-use/build and the .env the CLI actually loads, match the generated tsconfig, and update the tool, resource and prompt examples to the current server API.

**File**: `libraries/typescript/packages/create-mcp-use-app/README.md` (modified, +73/-55)
```diff
@@ -39,6 +39,7 @@ Create a new MCP application in seconds:
 ```bash
 npx create-mcp-use-app my-mcp-server
 cd my-mcp-server
+npm run dev
 ```
 
 That's it! Your MCP server is running at `http://localhost:3000` with the inspector automatically opened in your browser.
@@ -59,7 +60,7 @@ my-mcp-server/
 ├── mcp-env.d.ts                          # Managed view typing bridge
 ├── public/                               # Static assets
 └── views/                                # Included by the mcp-apps template
-    └── product-search-result/
+    └── my-view/
         └── view.tsx                      # React view entry point
 ```
 
@@ -109,7 +110,7 @@ npx create-mcp-use-app my-project
 ```bash
 # Use a specific template
 npx create-mcp-use-app my-project --template mcp-apps
-npx create-mcp-use-app my-project --template mcp-ui
+npx create-mcp-use-app my-project --template mcp-server
 
 # Use a GitHub repository as a template
 npx create-mcp-use-app my-project --template owner/repo
@@ -159,16 +160,14 @@ The mcp-apps template includes:
 
 Ideal for building MCP servers that integrate with OpenAI's Apps SDK.
 
-### MCP-UI Template
+### Blank Template
 
-The mcp-ui template includes:
+The `blank` template includes:
 
-- MCP server setup focused on MCP-UI resources
-- Interactive UI components example
-- Kanban board widget demonstration
-- Clean, focused setup for UI-first applications
+- An `MCPServer` with no tools, resources, or prompts registered
+- Development and production scripts
 
-Best for building MCP servers with rich interactive UI components.
+Ideal for starting from an empty server and adding your own tools.
 
 ### GitHub Repository Templates
 
@@ -244,7 +243,7 @@ This will:
 npm run build
 ```
 
-Creates an optimized build in the `dist/` directory.
+Creates an optimized build in the `.mcp-use/build/` directory.
 
 ### Start Production Server
 
@@ -364,22 +363,11 @@ const result = await agent.run("Use my MCP tools");
 
 ### Environment Variables
 
-The created project includes a `.env.example` file:
+`mcp-use dev` and `mcp-use start` load a `.env` file from the project root if one exists. The server listens on `PORT` (default `3000`) and binds to `HOST` (default `127.0.0.1`):
 
 ```bash
-# Server Configuration
 PORT=3000
-NODE_ENV=development
-
-# Observability (optional)
-LANGFUSE_PUBLIC_KEY=your_public_key
-LANGFUSE_SECRET_KEY=your_secret_key
-```
-
-Copy to `.env` and configure as needed:
-
-```bash
-cp .env.example .env
+HOST=127.0.0.1
 ```
 
 ### TypeScript Configuration
@@ -389,13 +377,18 @@ The `tsconfig.json` is pre-configured for MCP development:
 ```json
 {
   "compilerOptions": {
-    "target": "ES2020",
-    "module": "ESNext",
+    "target": "ES2024",
     "jsx": "react-jsx",
+    "module": "NodeNext",
+    "moduleResolution": "NodeNext",
+    "lib": ["ES2024", "DOM", "DOM.Iterable"],
+    "types": ["node"],
     "strict": true,
     "esModuleInterop": true,
+    "forceConsistentCasingInFileNames": true,
     "skipLibCheck": true,
-    "forceConsistentCasingInFileNames": true
+    "noEmit": true,
+    "noUncheckedSideEffectImports": true
   }
 }
 ```
@@ -407,49 +400,74 @@ The `tsconfig.json` is pre-configured for MCP development:
 ### Creating a Tool
 
 ```typescript
-server.tool("search_database", {
-  description: "Search for records in the database",
-  parameters: z.object({
-    query: z.string().describe("Search query"),
-    limit: z.number().optional().default(10),
-  }),
-  execute: async ({ query, limit }) => {
+server.tool(
+  {
+    name: "search_database",
+    description: "Search for records in the database",
+    inputSchema: z.object({
+      query: z.string().describe("Search query"),
+      limit: z.number().optional().default(10),
+    }),
+  },
+  async ({ query, limit }) => {
     // Your tool logic here
     const results = await db.search(query, limit);
-    return { results };
-  },
-});
+    return {
+      content: [{ type: "text", text: JSON.stringify(results) }],
+    };
+  }
+);
 ```
 
 ### Creating a Resource
 
 ```typescript
-server.resource("user_profile", {
-  description: "Current user profile data",
-  uri: "user://profile",
-  mimeType: "application/json",
-  fetch: async () => {
-    const profile = await getUserProfile();
-    return JSON.stringify(profile);
+server.resource(
+  {
+    name: "user_profile",
+    uri: "user://profile",
+    description: "Current user profile data",
+    mimeType: "application/json",
   },
-});
+  async (uri) => {
+    const profile = await getUserProfile();
+    return {
+      contents: [
+        {
+          uri: uri.href,
+          mimeType: "application/json",
+          text: JSON.stringify(profile),
+        },
+      ],
+    };
+  }
+);
 ```
 
 ### Creating a Prompt
 
 ```typescript
-server.prompt("code_review", {
-  description: "Review code for best practices",
-  arguments: [
-    { name: "code", description: "Code to review", required: true },
-    { name: "language", description: "Programming language", r
```

---

### Incident Patch 4: `402d2147` (2026-10-02)
**Commit Message**: fix(ci): separate changeset and promotion changelog checks (#2745)

* fix(ci): separate changeset and promotion changelog checks

* fix(ci): remove orphaned zlibrary submodule entry

**File**: `.github/scripts/release-notes.mjs` (modified, +36/-19)
```diff
@@ -54,7 +54,7 @@ export function isSdkPath(path) {
   return true;
 }
 
-export function checkReleaseNotes({ base, head, baseBranch, headBranch, cwd }) {
+function comparison({ base, head, cwd }) {
   const git = (...args) =>
     execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
   const ancestor = git("merge-base", base, head);
@@ -64,7 +64,14 @@ export function checkReleaseNotes({ base, head, baseBranch, headBranch, cwd }) {
   const readIfPresent = (ref, path) =>
     git("ls-tree", "--name-only", ref, "--", path) ? read(ref, path) : "";
 
-  const promotion = baseBranch === "main" && headBranch === "canary";
+  return { git, ancestor, read, readIfPresent };
+}
+
+export function checkChangesets(options) {
+  const { baseBranch, headBranch, head } = options;
+  // Promotion consumes changesets already applied by canary releases.
+  if (baseBranch === "main" && headBranch === "canary") return [];
+  const { git, ancestor, read, readIfPresent } = comparison(options);
   const changed = git(
     "diff",
     "--no-renames",
@@ -113,7 +120,7 @@ export function checkReleaseNotes({ base, head, baseBranch, headBranch, cwd }) {
     if (!manifest.private) packages.add(manifest.name);
   }
 
-  if (!promotion && packages.size) {
+  if (packages.size) {
     // Existing changesets on the target branch do not belong to this PR.
     const added = git(
       "diff",
@@ -155,38 +162,48 @@ export function checkReleaseNotes({ base, head, baseBranch, headBranch, cwd }) {
       : [];
   }
 
-  if (promotion) {
-    return changelogs.flatMap((path) => {
-      const previous = new Set(changelogEntries(readIfPresent(ancestor, path)));
-      const updated = changelogEntries(readIfPresent(head, path)).some(
-        (entry) => !previous.has(entry),
-      );
-      return updated
-        ? []
-        : [
-            `Add or update a non-empty release <Update> entry in ${path} before merging canary into main. Package CHANGELOG.md files do not satisfy this check.`,
-          ];
-    });
-  }
   return [];
 }
 
+export function checkChangelogs(options) {
+  const { baseBranch, headBranch, head } = options;
+  // Guard here as well as in the workflow so other PRs never need changelogs.
+  if (baseBranch !== "main" || headBranch !== "canary") return [];
+  const { ancestor, readIfPresent } = comparison(options);
+  return changelogs.flatMap((path) => {
+    const previous = new Set(changelogEntries(readIfPresent(ancestor, path)));
+    const updated = changelogEntries(readIfPresent(head, path)).some(
+      (entry) => !previous.has(entry),
+    );
+    return updated
+      ? []
+      : [
+          `Add or update a non-empty release <Update> entry in ${path} before merging canary into main. Package CHANGELOG.md files do not satisfy this check.`,
+        ];
+  });
+}
+
 if (
   process.argv[1] &&
   import.meta.url === pathToFileURL(process.argv[1]).href
 ) {
+  const mode = process.argv[2];
   try {
-    const errors = checkReleaseNotes({
+    const check = { changeset: checkChangesets, changelog: checkChangelogs }[
+      mode
+    ];
+    if (!check) throw new Error("Specify a check: changeset or changelog");
+    const errors = check({
       base: process.env.BASE_SHA,
       head: process.env.HEAD_SHA,
       baseBranch: process.env.BASE_BRANCH,
       headBranch: process.env.HEAD_BRANCH,
     });
     for (const error of errors) console.error(error);
     process.exitCode = errors.length ? 1 : 0;
-    if (!errors.length) console.log("Release notes check passed.");
+    if (!errors.length) console.log(`${mode} check passed.`);
   } catch (error) {
-    console.error(`Release notes check failed: ${error.message}`);
+    console.error(`${mode || "Release notes"} check failed: ${error.message}`);
     process.exitCode = 1;
   }
 }
```

**File**: `.github/scripts/release-notes.test.mjs` (modified, +97/-20)
```diff
@@ -1,10 +1,15 @@
 import assert from "node:assert/strict";
-import { execFileSync } from "node:child_process";
+import { execFileSync, spawnSync } from "node:child_process";
 import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
 import { tmpdir } from "node:os";
 import { dirname, join } from "node:path";
 import test from "node:test";
-import { changelogs, checkReleaseNotes } from "./release-notes.mjs";
+import { fileURLToPath } from "node:url";
+import {
+  changelogs,
+  checkChangesets,
+  checkChangelogs,
+} from "./release-notes.mjs";
 
 const changeset = "libraries/typescript/.changeset/";
 const release = '---\n"mcp-use": patch\n---\n\nFix a bug.\n';
@@ -59,8 +64,10 @@ function fixture(t, { sdk = true, existingChangelogs = changelogs } = {}) {
       "export const changed = true;\n",
     );
   const check = (baseBranch = "canary", headBranch = "feature") =>
-    checkReleaseNotes({ cwd, base, head: commit(), baseBranch, headBranch });
-  return { write, check, git, commit, base, cwd };
+    checkChangesets({ cwd, base, head: commit(), baseBranch, headBranch });
+  const checkChangelog = (baseBranch = "main", headBranch = "canary") =>
+    checkChangelogs({ cwd, base, head: commit(), baseBranch, headBranch });
+  return { write, check, checkChangelog, git, commit, base, cwd };
 }
 
 test("existing, edited, and README changesets do not satisfy a canary PR", (t) => {
@@ -98,17 +105,17 @@ test("malformed changesets and release entries without summaries fail", (t) => {
 
 test("canary to main requires both MDX changelogs", (t) => {
   const f = fixture(t);
-  assert.equal(f.check("main", "canary").length, 2);
+  assert.equal(f.checkChangelog().length, 2);
   f.write(
     changelogs[0],
     '<Update label="v1.1.0">New feature</Update>\n' + entry,
   );
-  assert.equal(f.check("main", "canary").length, 1);
+  assert.equal(f.checkChangelog().length, 1);
   f.write(
     changelogs[1],
     '<Update label="v2.0.0">Inspector feature</Update>\n' + entry,
   );
-  assert.deepEqual(f.check("main", "canary"), []);
+  assert.deepEqual(f.checkChangelog(), []);
 });
 
 test("metadata, whitespace, empty entries, and generated changelogs do not count", (t) => {
@@ -120,7 +127,7 @@ test("metadata, whitespace, empty entries, and generated changelogs do not count
     );
   }
   f.write("libraries/typescript/packages/server/CHANGELOG.md", "New release");
-  assert.equal(f.check("main", "canary").length, 2);
+  assert.equal(f.checkChangelog().length, 2);
 });
 
 test("updating an existing release entry is allowed", (t) => {
@@ -130,7 +137,7 @@ test("updating an existing release entry is allowed", (t) => {
       path,
       entry.replace("Initial release", "Initial release with new fixes"),
     );
-  assert.deepEqual(f.check("main", "canary"), []);
+  assert.deepEqual(f.checkChangelog(), []);
 });
 
 test("SDK PRs require changesets for every target, including main", (t) => {
@@ -151,7 +158,7 @@ test("unrelated changes added to the base branch cannot satisfy the PR", (t) =>
   f.write(`${changeset}base-only.md`, release);
   const base = f.commit();
   assert.equal(
-    checkReleaseNotes({
+    checkChangesets({
       cwd: f.cwd,
       base,
       head,
@@ -218,7 +225,7 @@ test("runtime manifest edits count but version, scripts, and dev dependencies do
   f.write(path, JSON.stringify(original));
   const base = f.commit();
   const check = (headBranch = "feature") =>
-    checkReleaseNotes({
+    checkChangesets({
       cwd: f.cwd,
       base,
       head: f.commit(),
@@ -250,7 +257,7 @@ test("deleted SDK source files still require a changeset", (t) => {
   const base = f.commit();
   rmSync(join(f.cwd, "libraries/typescript/packages/server/src/index.ts"));
   assert.equal(
-    checkReleaseNotes({
+    checkChangesets({
       cwd: f.cwd,
       base,
       head: f.commit(),
@@ -287,7 +294,7 @@ test("comments and code examples cannot create changelog entries", (t) => {
   ]) {
     for (const path of changelogs)
       f.write(path, wrapper(hidden) + "\n" + entry);
-    assert.equal(f.check("main", "canary").length, 2);
+    assert.equal(f.checkChangelog().length, 2);
   }
 });
 
@@ -302,7 +309,7 @@ test("comment-only updates inside real entries do not count", (t) => {
       ),
     );
   }
-  assert.equal(f.check("main", "canary").length, 2);
+  assert.equal(f.checkChangelog().length, 2);
 });
 
 test("code examples inside real entries still count as release content", (t) => {
@@ -313,33 +320,33 @@ test("code examples inside real entries still count as release content", (t) =>
       '<Update label="v2.0.0">\n```tsx\n<Update>Example</Update>\n```\n</Update>',
     );
   }
-  assert.deepEqual(f.check("main", "canary"), []);
+  assert.deepEqual(f.checkChangelog(), []);
 });
 
 test("new changelog paths use an empty baseline", (t) => {
   for (const existingChangelogs of [[], [changelogs[0]]]) {
     const f = fixture(t, { existingChangelogs });
     for (const path of changelogs)
       f
```

**File**: `.github/workflows/release-notes.yml` (modified, +24/-4)
```diff
@@ -8,8 +8,8 @@ permissions:
   contents: read
 
 jobs:
-  release-notes-check:
-    name: release-notes-check
+  release-changeset-check:
+    name: release-changeset-check
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v7
@@ -21,10 +21,30 @@ jobs:
           node-version: 22.23.1
       - name: Test release notes gate
         run: node --test .github/scripts/release-notes.test.mjs
-      - name: Check PR release notes
+      - name: Check PR changesets
         env:
           BASE_SHA: ${{ github.event.pull_request.base.sha }}
           HEAD_SHA: ${{ github.event.pull_request.head.sha }}
           BASE_BRANCH: ${{ github.base_ref }}
           HEAD_BRANCH: ${{ github.head_ref }}
-        run: node .github/scripts/release-notes.mjs
+        run: node .github/scripts/release-notes.mjs changeset
+
+  release-changelog-check:
+    name: release-changelog-check
+    if: github.base_ref == 'main' && github.head_ref == 'canary'
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          fetch-depth: 0
+          persist-credentials: false
+      - uses: actions/setup-node@v7
+        with:
+          node-version: 22.23.1
+      - name: Check promotion changelogs
+        env:
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
+          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
+          BASE_BRANCH: ${{ github.base_ref }}
+          HEAD_BRANCH: ${{ github.head_ref }}
+        run: node .github/scripts/release-notes.mjs changelog
```

**File**: `libraries/typescript/.changeset/README.md` (modified, +7/-6)
```diff
@@ -49,17 +49,18 @@ shipped assets and count even when they contain documentation or examples.
 
 Before merging `canary` into `main`, add or update a release `<Update>` entry in
 both `docs/typescript/changelog/changelog.mdx` and `docs/inspector/changelog.mdx`.
-This promotion uses the changelog gate instead of requiring another changeset.
+The separate `release-changelog-check` runs only for `canary` → `main` PRs.
+This promotion does not require another changeset.
 Generated package `CHANGELOG.md` files, metadata-only edits, and whitespace-only
 edits do not satisfy the changelog gate. Automated `release/exit-prerelease-*`
 PRs into main may update package manifests without adding another changeset;
 source edits on those branches still require one.
 
-Repository administrators must require the `release-notes-check` status check in
-the branch protection rules or rulesets for **both `canary` and `main`** to block
-merges when it fails. The workflow reports success when no relevant SDK files
-changed, so required checks never remain pending on docs/Python/test-only PRs.
-It also reruns when a PR is retargeted.
+Repository administrators must replace the old `release-notes-check` required
+status with `release-changeset-check` for **both `canary` and `main`**, and require
+`release-changelog-check` for **main**. The changeset job reports success when no
+relevant SDK files changed; the changelog job is skipped outside promotions.
+Both checks rerun when a PR is retargeted.
 
 ```bash
 pnpm changeset
```

**File**: `zlibrary-mcp-use` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-Subproject commit 8119a7b9ac6d8de71339b675639259fb09d1af3b
```

---

### Incident Patch 5: `a930084e` (2026-09-30)
**Commit Message**: docs: mark v2 TypeScript migration guides as stable and refresh server guide (#2709)

Drop the beta wording from the v2 server and client migration guides now
that mcp-use 2.x is published on the npm latest tag, and correct the server
guide against the current v2 source:

- replace the removed imperative modelContext helpers with <ModelContext>
- document getHandler() as a deprecated alias and toNodeHandler() from
  mcp-use/node for custom Node servers
- note ToolCancelledError in the useToolContext error state
- add mixedAuth and per-tool securitySchemes to the auth section
- state that OAuth proxy mode is not provided instead of deferred


Claude-Session: https://claude.ai/code/session_01X9evrqiQKyZaQycbuTE9wF

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `docs/v2/typescript/client/migration.mdx` (modified, +3/-3)
```diff
@@ -4,8 +4,8 @@ description: "Migrate client, agent, and React connection code from mcp-use 1.x"
 icon: "arrow-right-left"
 ---
 
-This guide updates applications from the mcp-use 1.x client surface to the
-current beta packages. It covers client, agent, and React connection code.
+This guide updates applications from the mcp-use 1.x client surface to the v2
+packages. It covers client, agent, and React connection code.
 
 <Warning>
   Server and interactive UI APIs also have breaking changes. Do not assume that
@@ -266,7 +266,7 @@ URLs.
 
 <Steps>
   <Step title="Update the runtime and packages">
-    Use Node.js `>=22.22.2`, install the beta package tags, and confirm ESM output.
+    Use Node.js `>=22.22.2`, install the v2 packages, and confirm ESM output.
   </Step>
   <Step title="Fix imports">
     Search for client and agent imports from `mcp-use`, removed
```

**File**: `docs/v2/typescript/server/migration.mdx` (modified, +49/-22)
```diff
@@ -1,6 +1,6 @@
 ---
 title: "Migrate to v2"
-description: "Migrate mcp-use 1.x servers, widgets, and runtime behavior to the v2 beta."
+description: "Migrate mcp-use 1.x servers, widgets, and runtime behavior to mcp-use v2."
 icon: "arrow-right-left"
 ---
 
@@ -29,15 +29,15 @@ changes. Widgets require a complete rewrite as MCP App Views.
     Replace the widget file layout, tool binding, result helper, provider,
     generated helpers, hooks, state model, and asset paths.
   </Step>
-  <Step title="Review beta limitations and verify">
+  <Step title="Review v2 limitations and verify">
     Check whether a missing v1 capability affects the server, then typecheck,
     build, run, and exercise the migrated project.
   </Step>
 </Steps>
 
 ## Update the runtime and entry point
 
-The current v2 beta requires Node.js `>=22.22.2` and ESM.
+mcp-use v2 requires Node.js `>=22.22.2` and ESM.
 
 ```bash
 npm install mcp-use
@@ -58,6 +58,17 @@ export default server;
 
 Default-export the server from `index.ts`.
 
+v1 `getHandler()` remains only as a deprecated alias for `server.fetch`. Pass
+`server.fetch` to edge and Fetch-based runtimes directly. To serve from a custom
+Node.js `http` server, wrap the server with `toNodeHandler()`:
+
+```typescript
+import { createServer } from "node:http";
+import { toNodeHandler } from "mcp-use/node";
+
+createServer(toNodeHandler(server)).listen(3000);
+```
+
 ## Export every static tool
 
 Assign every statically declared tool to an exported constant. If tools live in
@@ -131,8 +142,8 @@ export const weather = server.tool(
 );
 ```
 
-`schema` remains an alias for `inputSchema` in the current beta, but
-`inputSchema` matches the MCP wire field and is the migration target.
+`schema` remains an alias for `inputSchema`, but `inputSchema` matches the MCP
+wire field and is the migration target.
 
 Follow these result rules:
 
@@ -230,16 +241,16 @@ v2 request context exists only for the current request. Remove session
 assumptions from client metadata, logging, progress, notifications, and
 elicitation.
 
-| v1                          | v2                                            |
-| --------------------------- | --------------------------------------------- |
-| `ctx.req`                   | `ctx.request`                                 |
-| Node/Web request access     | `ctx.request.raw` for the Web `Request`       |
-| `ctx.log(...)`              | `ctx.sendLog(...)`                            |
-| `ctx.client.supportsApps()` | `ctx.client.supportsViews()`                  |
-| `ctx.user`                  | provider-specific `ctx.auth.user`             |
-| session metadata            | current request's `ctx.client` snapshot       |
-| blocking `ctx.elicit(...)`  | keyed input-required round trip               |
-| `ctx.sample(...)`           | no server-side equivalent in the current beta |
+| v1                          | v2                                      |
+| --------------------------- | --------------------------------------- |
+| `ctx.req`                   | `ctx.request`                           |
+| Node/Web request access     | `ctx.request.raw` for the Web `Request` |
+| `ctx.log(...)`              | `ctx.sendLog(...)`                      |
+| `ctx.client.supportsApps()` | `ctx.client.supportsViews()`            |
+| `ctx.user`                  | provider-specific `ctx.auth.user`       |
+| session metadata            | current request's `ctx.client` snapshot |
+| blocking `ctx.elicit(...)`  | keyed input-required round trip         |
+| `ctx.sample(...)`           | no server-side equivalent               |
 
 `ctx.client.info()`, `capabilities()`, `can()`, `extension()`, and `user()`
 return client-declared request hints. Never use them for authorization. Use
@@ -425,6 +436,11 @@ export default function ResultsView() {
 }
 ```
 
+The `error` status also covers a host that cancels the tool call before a result
+arrives. `view.error` is then a `ToolCancelledError`; check
+`view.error instanceof ToolError` before reading `view.error.result`. Import both
+classes from `mcp-use/react`.
+
 Use the focused v2 surface:
 
 | v1                                 | v2                                                            |
@@ -466,9 +482,12 @@ snapshot across the mounted View. The state is model-visible.
 ChatGPT can restore View state across View lifetimes. Other MCP Apps hosts keep
 the state only for the current iframe lifetime.
 
-Use `ModelContext` or `modelContext` for model-visible natural-language context.
-Use `useSendFollowUp()` to trigger a new model turn. Keep presentation-only
-state in ordinary React state.
+Use the declarative `<ModelContext>` component for model-visible
+natural-language context. v2 removes the imperative `modelContext.set()`,
+`modelContext.remove()`, and `modelContext.clear()` helpers; render
+`<ModelContext>` where the annotation applies so it follows React state and
+component lifecycle. Use `useSendFollowUp()` to trigger a n
```

---

### Incident Patch 6: `394247f9` (2026-09-28)
**Commit Message**: fix: point docs MCP at stable documentation domain (#2677)

**File**: `.mcp.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "mcpServers": {
     "mcp-use-docs": {
       "type": "http",
-      "url": "https://manufact.com/docs/mcp"
+      "url": "https://docs.mcp-use.com/mcp"
     }
   }
 }
```

---

### Incident Patch 7: `36f84ee6` (2026-09-23)
**Commit Message**: docs(cookbook): add A2UI generative UI recipe with live example (#2634)

**File**: `docs/docs.json` (modified, +2/-1)
```diff
@@ -469,7 +469,8 @@
                       "v2/typescript/cookbook/nextjs",
                       "v2/typescript/cookbook/tanstack-start",
                       "v2/typescript/cookbook/upstash",
-                      "v2/typescript/cookbook/sentry"
+                      "v2/typescript/cookbook/sentry",
+                      "v2/typescript/cookbook/a2ui"
                     ]
                   }
                 ]
```

**File**: `docs/v2/typescript/cookbook/a2ui.mdx` (added, +376/-0)
```diff
@@ -0,0 +1,376 @@
+---
+title: "A2UI"
+description: "Let the chat model generate interactive A2UI layouts and render them in an MCP App view."
+icon: "component"
+---
+
+Add a `render-ui` tool that renders model-generated [A2UI](https://a2ui.org/) layouts inside an MCP App. The model writes the component layout and initial data as tool arguments, and the stock A2UI React renderer displays them in the view.
+
+The server needs no model API key or agent runtime. The host's chat model generates the tool arguments.
+
+## Try the live example
+
+Ask the chat for a UI. Pick a suggestion or describe your own layout, then edit the inputs, sliders, and checkboxes in the result.
+
+<div className="cookbook-chat-embed">
+<iframe
+  src="https://inspector.manufact.com/inspector?embedded=true&autoConnect=https%3A%2F%2Fmanufact-a2ui-example.run.mcp-use.com%2Fmcp&embeddedConfig=%7B%22singleTab%22%3Atrue%2C%22defaultTab%22%3A%22chat%22%2C%22visibleTabs%22%3A%5B%22chat%22%5D%2C%22chatHideTitle%22%3Atrue%2C%22chatHideServerUrl%22%3Atrue%2C%22chatQuickQuestions%22%3A%5B%22Make%20an%20interactive%20weekend%20reading%20dashboard%20with%20two%20book%20cards%2C%20a%20reading-goal%20slider%2C%20and%20a%20checklist.%20Let%20me%20edit%20the%20reader%20name.%22%2C%22Build%20a%20packing%20checklist%20for%20a%20three-day%20beach%20trip%2C%20grouped%20into%20essentials%20and%20clothes%2C%20with%20an%20editable%20destination%20and%20a%20travel-style%20selector.%22%5D%7D"
+  title="A2UI live example: MCP Inspector chat"
+  width="100%"
+  height="640"
+  style={{ border: "1px solid var(--gray-200, #737373)", borderRadius: "12px" }}
+  allow="clipboard-write"
+/>
+</div>
+
+[Open the example in a new tab](https://inspector.manufact.com/inspector?embedded=true&autoConnect=https%3A%2F%2Fmanufact-a2ui-example.run.mcp-use.com%2Fmcp&embeddedConfig=%7B%22singleTab%22%3Atrue%2C%22defaultTab%22%3A%22chat%22%2C%22visibleTabs%22%3A%5B%22chat%22%5D%2C%22chatHideTitle%22%3Atrue%2C%22chatHideServerUrl%22%3Atrue%2C%22chatQuickQuestions%22%3A%5B%22Make%20an%20interactive%20weekend%20reading%20dashboard%20with%20two%20book%20cards%2C%20a%20reading-goal%20slider%2C%20and%20a%20checklist.%20Let%20me%20edit%20the%20reader%20name.%22%2C%22Build%20a%20packing%20checklist%20for%20a%20three-day%20beach%20trip%2C%20grouped%20into%20essentials%20and%20clothes%2C%20with%20an%20editable%20destination%20and%20a%20travel-style%20selector.%22%5D%7D).
+
+## Prerequisites
+
+- A working [mcp-use server](/v2/typescript/getting-started/quickstart) that can build [MCP App views](/v2/typescript/mcp-apps/quickstart).
+- Node.js 22.22.2 or later.
+
+## Add the integration
+
+The integration has three files:
+
+| File | Purpose |
+| --- | --- |
+| `views/generative-ui/catalog.ts` | The components the model may use, plus validation shared by the tool and the view |
+| `src/index.ts` | The `render-ui` tool, which accepts and returns `{ spec }` |
+| `views/generative-ui/view.tsx` | Converts the spec to A2UI messages and renders `<A2uiSurface>` |
+
+### Install A2UI
+
+Install the A2UI React renderer and its core message processor:
+
+```bash
+npm install @a2ui/react@0.11.0 @a2ui/web_core@0.10.7 react react-dom zod
+```
+
+A2UI depends on Zod 3, while mcp-use tool schemas use Zod 4. Add an `overrides` block to `package.json` so npm gives the A2UI packages their own Zod 3 copy:
+
+```json package.json
+{
+  "overrides": {
+    "@a2ui/react": { "zod": "3.25.76" },
+    "@a2ui/web_core": { "zod": "3.25.76" }
+  }
+}
+```
+
+Run `npm install` again after adding the overrides.
+
+### Define the component catalog
+
+The catalog is a subset of A2UI's basic catalog: Text, Row, Column, Card, Divider, TextField, CheckBox, Slider, and ChoicePicker. The refinement rejects specs the renderer cannot display, such as duplicate IDs, unreachable components, missing bindings, and initial values of the wrong type.
+
+```typescript views/generative-ui/catalog.ts expandable
+import { z } from "zod";
+
+const id = z
+  .string()
+  .regex(/^[a-zA-Z][\w-]*$/)
+  .max(64);
+const binding = z.object({ path: z.string().regex(/^\/[\w-]+$/) });
+const text = z.union([z.string().max(3000), binding]);
+const component = z.discriminatedUnion("component", [
+  z.object({
+    id,
+    component: z.literal("Text"),
+    text,
+    variant: z
+      .enum(["h1", "h2", "h3", "h4", "h5", "body", "caption"])
+      .optional(),
+  }),
+  z.object({
+    id,
+    component: z.literal("Column"),
+    children: z.array(id).max(40),
+  }),
+  z.object({ id, component: z.literal("Row"), children: z.array(id).max(8) }),
+  z.object({ id, component: z.literal("Card"), child: id }),
+  z.object({ id, component: z.literal("Divider") }),
+  z.object({
+    id,
+    component: z.literal("CheckBox"),
+    label: text,
+    value: binding,
+  }),
+  z.object({
+    id,
+    component: z.literal("TextField"),
+    label: text,
+    value: binding,
+    variant: z.enum(["shortText", "longText", "number"]).optional(),
+  }),
+  z.obj
```

**File**: `docs/v2/typescript/cookbook/index.mdx` (modified, +7/-0)
```diff
@@ -67,4 +67,11 @@ Start with a working app or MCP server and add an integration. Each recipe inclu
   >
     Trace MCP tool calls and report failures in Sentry. Monitor successful calls, tool errors, and exceptions.
   </Card>
+  <Card
+    title="A2UI"
+    icon="component"
+    href="/v2/typescript/cookbook/a2ui"
+  >
+    Let the chat model generate interactive layouts. Render A2UI components in an MCP App view.
+  </Card>
 </CardGroup>
```

---

### Incident Patch 8: `24cdd22f` (2026-09-22)
**Commit Message**: fix(python): use monotonic clock for execution timing (#2482)

**File**: `libraries/python/mcp_use/client/code_executor.py` (modified, +3/-3)
```diff
@@ -9,8 +9,8 @@
 import asyncio
 import io
 import re
-import time
 from contextlib import redirect_stderr, redirect_stdout
+from time import perf_counter
 from typing import TYPE_CHECKING, Any
 
 from mcp_use.logging import logger
@@ -59,7 +59,7 @@ async def execute(self, code: str, timeout: float = 30.0) -> dict[str, Any]:
             logger.debug("Connecting to configured servers for code execution...")
             await self.client.create_all_sessions()
 
-        start_time = time.time()
+        start_time = perf_counter()
         logs: list[str] = []
         result = None
         error = None
@@ -93,7 +93,7 @@ def captured_print(*args, **kwargs):
             error = str(e)
             logger.error(f"Code execution error: {e}")
 
-        execution_time = time.time() - start_time
+        execution_time = perf_counter() - start_time
 
         # Capture any stdout/stderr that wasn't captured by our print wrapper
         if stdout_capture.getvalue():
```

**File**: `libraries/python/tests/unit/test_code_executor.py` (modified, +4/-3)
```diff
@@ -5,7 +5,7 @@
 """
 
 import asyncio
-from unittest.mock import AsyncMock, MagicMock, Mock
+from unittest.mock import AsyncMock, MagicMock, Mock, patch
 
 import pytest
 
@@ -36,12 +36,13 @@ async def test_execute_simple_code(self, code_executor):
         """Test executing simple Python code."""
         code = "result = 1 + 1\nreturn result"
 
-        result = await code_executor.execute(code, timeout=5.0)
+        with patch("mcp_use.client.code_executor.perf_counter", side_effect=[100.0, 100.125]):
+            result = await code_executor.execute(code, timeout=5.0)
 
         assert result["error"] is None
         assert result["result"] == 2
         assert isinstance(result["execution_time"], float)
-        assert result["execution_time"] > 0
+        assert result["execution_time"] == pytest.approx(0.125)
 
     @pytest.mark.asyncio
     async def test_execute_with_print(self, code_executor):
```

---

### Incident Patch 9: `46cc2cff` (2026-09-21)
**Commit Message**: fix(inspector): keep tall MCP app results scrollable (#2598) (#2599)

* fix(inspector): keep tall MCP app results scrollable (#2598)

* chore: enter canary prerelease mode

* chore(typescript): version packages (canary)

---------

Co-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>

**File**: `libraries/typescript/.changeset/pre.json` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+{
+  "mode": "pre",
+  "tag": "canary",
+  "initialVersions": {
+    "@mcp-use/agent": "2.0.17",
+    "@mcp-use/cli": "4.1.13",
+    "@mcp-use/client": "2.3.2",
+    "create-mcp-use-app": "2.0.6",
+    "@mcp-use/inspector": "20.3.9",
+    "mcp-use": "2.5.1",
+    "@mcp-use/tunnel": "0.2.1"
+  },
+  "changesets": [
+    "propagated-32ea3a5409366396",
+    "tidy-app-result-overflow"
+  ]
+}
```

**File**: `libraries/typescript/.changeset/propagated-32ea3a5409366396.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@mcp-use/cli": patch
+---
+
+Rebuild bundled workspace code and synchronize published internal package metadata.
```

**File**: `libraries/typescript/.changeset/tidy-app-result-overflow.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@mcp-use/inspector": patch
+---
+
+Fix tall MCP Apps overflowing the tool result view by allowing the result content to grow and scroll without clipping the top of the app behind the response toolbar.
```

**File**: `libraries/typescript/packages/cli/CHANGELOG.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # @mcp-use/cli
 
+## 4.1.14-canary.0
+
+### Patch Changes
+
+- Rebuild bundled workspace code and synchronize published internal package metadata.
+
 ## 4.1.13
 
 ### Patch Changes
```

**File**: `libraries/typescript/packages/cli/package.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@mcp-use/cli",
   "type": "module",
-  "version": "4.1.13",
+  "version": "4.1.14-canary.0",
   "description": "Prebuilt CLI, development server, and build pipeline for mcp-use",
   "author": "mcp-use, Inc.",
   "license": "MIT",
@@ -57,7 +57,7 @@
   },
   "peerDependencies": {
     "@mcp-use/client": "^2.0.1 || ^2.1.0 || ^2.1.1 || ^2.1.2 || ^2.1.3 || ^2.1.4 || ^2.1.5 || ^2.2.0 || ^2.2.1 || ^2.2.2 || ^2.2.3 || ^2.2.4 || ^2.2.5 || ^2.3.0 || ^2.3.1 || ^2.3.2",
-    "@mcp-use/inspector": "^20.3.8 || ^20.3.9"
+    "@mcp-use/inspector": "^20.3.8 || ^20.3.9 || ^20.3.10-canary.0"
   },
   "peerDependenciesMeta": {
     "@mcp-use/client": {
```

**File**: `libraries/typescript/packages/inspector/CHANGELOG.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # @mcp-use/inspector
 
+## 20.3.10-canary.0
+
+### Patch Changes
+
+- 8f7b6ac: Fix tall MCP Apps overflowing the tool result view by allowing the result content to grow and scroll without clipping the top of the app behind the response toolbar.
+
 ## 20.3.9
 
 ### Patch Changes
```

**File**: `libraries/typescript/packages/inspector/package.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@mcp-use/inspector",
   "type": "module",
-  "version": "20.3.9",
+  "version": "20.3.10-canary.0",
   "description": "MCP Inspector - A tool for inspecting and debugging MCP servers",
   "author": "",
   "license": "MIT",
@@ -92,7 +92,7 @@
     "express": "^4.21.2 || ^5.0.0",
     "lucide-react": "^0.562.0",
     "markdown-to-jsx": "^9.7.4",
-    "mcp-use": "^2.4.3 || ^2.4.4 || ^2.5.0 || ^2.5.1",
+    "mcp-use": "^2.4.3 || ^2.4.4 || ^2.5.0 || ^2.5.1 || ^2.5.2-canary.0",
     "motion": "^12.34.2",
     "react": "^18.0.0 || ^19.0.0",
     "react-dom": "^18.0.0 || ^19.0.0",
```

**File**: `libraries/typescript/packages/inspector/src/client/components/tools/ToolResultDisplay.tsx` (modified, +1/-1)
```diff
@@ -559,7 +559,7 @@ export function ToolResultDisplay({
   return (
     <div className="relative flex flex-col h-full bg-white dark:bg-black">
       <div className="flex-1 overflow-y-auto h-full">
-        <div className="space-y-0 flex flex-col flex-1 h-full">
+        <div className="space-y-0 flex flex-col flex-1 min-h-full">
           <div
             className={`sticky top-0 z-40 flex items-center gap-2 px-4 pt-2 backdrop-blur-xs bg-white/50 dark:bg-black/50 ${
               hasMcpAppsResource || isNonUIResult
```

---

### Incident Patch 10: `545a746f` (2026-09-18)
**Commit Message**: docs: use pnpm run deploy in the v2 quickstart (#2585)

**File**: `docs/v2/typescript/getting-started/quickstart.mdx` (modified, +1/-1)
```diff
@@ -212,7 +212,7 @@ npm run deploy
 ```
 
 ```bash pnpm
-pnpm deploy
+pnpm run deploy
 ```
 
 ```bash bun
```

---

### Incident Patch 11: `dcaa0b8d` (2026-09-14)
**Commit Message**: fix(cli): ignore the CLI test scratch fixture root (#2524)

* fix(cli): ignore the CLI test scratch fixture root

tests/cli/helpers.ts copies fixtures into tests/cli/.tmp and removeDir is
best-effort, so a failed or interrupted dev test leaves copies behind. The
path was in neither .gitignore nor .prettierignore, so the leftovers showed
up as untracked files and broke pnpm format:check on generated sources until
the directory was deleted by hand.

Ignore it in both tools, matching dist/, .turbo, .next/, .mcp-use and
deno-test-temp.

* fix(cli): ignore test scratch directories in ESLint

---------

Co-authored-by: Aishwary Dongre <[REDACTED_EMAIL]>
Co-authored-by: Andrew Khadder <[REDACTED_EMAIL]>

**File**: `libraries/typescript/.gitignore` (modified, +3/-0)
```diff
@@ -72,3 +72,6 @@ test_app
 # Deno test artifacts
 deno-test-temp
 *.tgz
+
+# Scratch fixture copies made by the CLI tests
+.tmp
```

**File**: `libraries/typescript/.prettierignore` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@
 **/.tsup/**
 **/.vite/**
 **/.mcp-use/**
+**/.tmp/**
 **/playwright-report/**
 **/src/skills/vendor/*.min.js
 
```

**File**: `libraries/typescript/eslint.config.js` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ export default [
   {
     ignores: [
       "**/.mcp-use/**",
+      "**/.tmp/**",
       "**/node_modules/**",
       "**/dist/**",
       "**/build/**",
```

---

### Incident Patch 12: `64681442` (2026-09-08)
**Commit Message**: docs: fix the TypeScript test commands in CONTRIBUTING (#2477)

Both commands in the TypeScript testing section fail from
libraries/typescript:

  $ pnpm --filter mcp-use test:unit
  [ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT] None of the selected packages has a
  "test:unit" script

  $ pnpm --filter mcp-use test:integration:agent
  [ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT] None of the selected packages has a
  "test:integration:agent" script

The mcp-use package has test and test:run, not test:unit; #2213 moved CI
to test:run and left the guide behind. test:integration:agent does exist,
but on @mcp-use/agent rather than mcp-use, so the filter selects a
package that has never had it.

Also drops the "unit tests only" phrasing, since test:run is the whole
suite without watch mode rather than a unit subset.

**File**: `CONTRIBUTING.md` (modified, +3/-3)
```diff
@@ -274,11 +274,11 @@ pnpm --filter mcp-use test
 pnpm --filter @mcp-use/inspector test
 pnpm --filter @mcp-use/cli test
 
-# Run unit tests only (mcp-use package)
-pnpm --filter mcp-use test:unit
+# Run tests once without watch mode (mcp-use package)
+pnpm --filter mcp-use test:run
 
 # Run agent integration tests (requires OPENAI_API_KEY)
-pnpm --filter mcp-use test:integration:agent
+pnpm --filter @mcp-use/agent test:integration:agent
 ```
 
 ### Changesets
```

---

### Incident Patch 13: `52710122` (2026-09-03)
**Commit Message**: fix(release): parse npm 12 keyed pack output (#2433)

**File**: `libraries/typescript/scripts/release-artifact.mjs` (modified, +5/-1)
```diff
@@ -65,7 +65,11 @@ export function packedArtifactErrors(manifest, files) {
 
 export function packedFilesFromNpmPackJson(output) {
   const parsed = JSON.parse(output);
-  const packed = Array.isArray(parsed) ? parsed[0] : parsed;
+  const packed = Array.isArray(parsed)
+    ? parsed[0]
+    : parsed?.files
+      ? parsed
+      : Object.values(parsed ?? {}).find((value) => value?.files);
   if (!packed?.files) {
     throw new Error("npm pack returned no file list");
   }
```

**File**: `libraries/typescript/scripts/release-channel.test.mjs` (modified, +5/-1)
```diff
@@ -122,7 +122,7 @@ test("requires declared package files and entry points in packed artifacts", ()
   );
 });
 
-test("accepts both npm pack JSON result shapes", () => {
+test("accepts npm pack array, direct object, and package-keyed JSON", () => {
   const packed = { files: [{ path: "package.json" }] };
   assert.deepEqual(
     packedFilesFromNpmPackJson(JSON.stringify([packed])),
@@ -132,6 +132,10 @@ test("accepts both npm pack JSON result shapes", () => {
     packedFilesFromNpmPackJson(JSON.stringify(packed)),
     packed.files
   );
+  assert.deepEqual(
+    packedFilesFromNpmPackJson(JSON.stringify({ "@mcp-use/client": packed })),
+    packed.files
+  );
 });
 
 test("rejects a stable source version below npm latest", () => {
```

---

### Incident Patch 14: `4c32c5db` (2026-09-03)
**Commit Message**: fix(release): accept npm pack object output (#2430)

**File**: `libraries/typescript/scripts/release-artifact.mjs` (modified, +9/-0)
```diff
@@ -62,3 +62,12 @@ export function packedArtifactErrors(manifest, files) {
   }
   return errors;
 }
+
+export function packedFilesFromNpmPackJson(output) {
+  const parsed = JSON.parse(output);
+  const packed = Array.isArray(parsed) ? parsed[0] : parsed;
+  if (!packed?.files) {
+    throw new Error("npm pack returned no file list");
+  }
+  return packed.files;
+}
```

**File**: `libraries/typescript/scripts/release-channel.mjs` (modified, +10/-5)
```diff
@@ -4,7 +4,10 @@ import { join } from "node:path";
 
 import semver from "semver";
 
-import { packedArtifactErrors } from "./release-artifact.mjs";
+import {
+  packedArtifactErrors,
+  packedFilesFromNpmPackJson,
+} from "./release-artifact.mjs";
 
 const workspaceRoot = process.cwd();
 const packageRoot = join(workspaceRoot, "packages");
@@ -48,11 +51,13 @@ function packedFiles(name, version) {
       `could not inspect ${name}@${version}: ${result.stderr || result.stdout}`
     );
   }
-  const [packed] = JSON.parse(result.stdout);
-  if (!packed?.files) {
-    throw new Error(`npm pack returned no file list for ${name}@${version}`);
+  try {
+    return packedFilesFromNpmPackJson(result.stdout);
+  } catch (error) {
+    throw new Error(
+      `could not parse npm pack file list for ${name}@${version}: ${error.message}`
+    );
   }
-  return packed.files;
 }
 
 function verifyPackedArtifact(release) {
```

**File**: `libraries/typescript/scripts/release-channel.test.mjs` (modified, +13/-0)
```diff
@@ -7,6 +7,7 @@ import test from "node:test";
 
 import {
   packedArtifactErrors,
+  packedFilesFromNpmPackJson,
   requiredPackedEntries,
 } from "./release-artifact.mjs";
 
@@ -121,6 +122,18 @@ test("requires declared package files and entry points in packed artifacts", ()
   );
 });
 
+test("accepts both npm pack JSON result shapes", () => {
+  const packed = { files: [{ path: "package.json" }] };
+  assert.deepEqual(
+    packedFilesFromNpmPackJson(JSON.stringify([packed])),
+    packed.files
+  );
+  assert.deepEqual(
+    packedFilesFromNpmPackJson(JSON.stringify(packed)),
+    packed.files
+  );
+});
+
 test("rejects a stable source version below npm latest", () => {
   const { root, registryFile } = fixture({
     localVersion: "2.0.1",
```

---

### Incident Patch 15: `7618a5b4` (2026-09-03)
**Commit Message**: fix(release): skip unchanged canary plan entries (#2429)

**File**: `libraries/typescript/scripts/release-channel.mjs` (modified, +1/-0)
```diff
@@ -242,6 +242,7 @@ function validateReleasePlan(channel, planFile) {
   const errors = [];
 
   for (const release of plan.releases ?? []) {
+    if (release.type === "none") continue;
     const plannedMajor =
       release.type === "major" ||
       semver.major(release.newVersion) > semver.major(release.oldVersion);
```

**File**: `libraries/typescript/scripts/release-channel.test.mjs` (modified, +47/-0)
```diff
@@ -414,6 +414,53 @@ test("accepts a Canary major with an explicit major changeset", () => {
   assert.equal(result.status, 0, result.stderr);
 });
 
+test("ignores unchanged packages in a Canary release plan", () => {
+  const { root, registryFile } = fixture({
+    localVersion: "2.0.4",
+    latest: "2.0.4",
+    canary: "2.0.4-canary.0",
+    published: ["2.0.4"],
+  });
+  const planFile = join(root, "changeset-status.json");
+  writeFileSync(
+    planFile,
+    JSON.stringify({
+      changesets: [
+        {
+          id: "client-fix",
+          releases: [{ name: "@mcp-use/client", type: "patch" }],
+        },
+      ],
+      releases: [
+        {
+          name: "@mcp-use/client",
+          type: "patch",
+          oldVersion: "2.2.4",
+          newVersion: "2.2.5-canary.0",
+        },
+        {
+          name: "@mcp-use/cli",
+          type: "none",
+          oldVersion: "4.1.10",
+          newVersion: "4.1.10",
+        },
+      ],
+      preState: { mode: "pre", tag: "canary" },
+    })
+  );
+
+  const result = run(
+    root,
+    registryFile,
+    "validate",
+    "--channel",
+    "canary",
+    "--plan",
+    planFile
+  );
+  assert.equal(result.status, 0, result.stderr);
+});
+
 test("registry verification accepts a completed target after a publish error", () => {
   const { root, registryFile } = fixture({
     localVersion: "2.0.5-canary.0",
```

#### Recent Merged Pull Requests:
- **PR #2778** (2026-10-06): feat(server): add top-level per-tool icons (@khandrew1)
- **PR #2767** (2026-10-05): test(create-mcp-use-app): assert the template error in the failed-scaffold test (@freetrip1)
- **PR #2765** (2026-10-05): fix(create-mcp-use-app): avoid empty directories on failed scaffolds (@khandrew1)
- **PR #2764** (2026-10-05): Revert "fix(create-mcp-use-app): don't leave an empty project directory when scaffolding fails" (@khandrew1)
- **PR #2762** (closed): fix(python): accept stdio server configs without args (@DeepanshuPal)
- **PR #2759** (2026-10-05): fix(create-mcp-use-app): don't leave an empty project directory when scaffolding fails (@freetrip1)
- **PR #2757** (2026-10-05): docs(create-mcp-use-app): fix README instructions that no longer match the scaffold (@freetrip1)
- **PR #2750** (2026-10-02): release(typescript): Exit prerelease mode and version packages (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
