# Forensic Learning Record (Deep Inspection): sparfenyuk/mcp-proxy

> **Canonical Artifact**: `07_PROJECT_LEARNING/sparfenyuk-mcp-proxy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sparfenyuk/mcp-proxy](https://github.com/sparfenyuk/mcp-proxy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:42:35.818Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sparfenyuk/mcp-proxy`
- **Description**: A bridge between Streamable HTTP and stdio MCP transports
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2767 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/mcp_proxy/__init__.py`
```
"""Library for proxying MCP servers across different transports."""

```

### Core Architecture Module: `src/mcp_proxy/__main__.py`
```
"""The entry point for the mcp-proxy application. It sets up the logging and runs the main function.

Two ways to run the application:
1. Run the application as a module `uv run -m mcp_proxy`
2. Run the application as a package `uv run mcp-proxy`

"""

import argparse
import asyncio
import json
import logging
import os
import shlex
import sys
import typing as t
from importlib.metadata import version

from httpx_auth import OAuth2ClientCredentials
from mcp.client.stdio import StdioServerParameters

from .config_loader import load_named_server_configs_from_file
from .mcp_server import DEFAULT_EXPOSE_HEADERS, MCPServerSettings, run_mcp_server
from .sse_client import run_sse_client
from .streamablehttp_client import run_streamablehttp_client

# Deprecated env var. Here for backwards compatibility.
SSE_URL: t.Final[str | None] = os.getenv(
    "SSE_URL",
    None,
)


def _normalize_verify_ssl(value: str | bool | None) -> bool | str | None:
    """Normalize the verify_ssl argument into bool, str path, or None."""
    if isinstance(value, bool) or value is None:
        return value

    lowered = value.strip().lower()
    if lowered in {"1", "true", "yes", "on"}:
        return True
    if lowered in {"0", "false", "no", "off"}:
        return False

    return value


def _setup_argument_parser() -> argparse.ArgumentParser:
    """Set up and return the argument parser for the MCP proxy."""
    parser = argparse.ArgumentParser(
        description=("Start the MCP proxy in one of two possible modes: as a client or a server."),
        epilog=(
            "Examples:\n"
            "  mcp-proxy http://localhost:8080/sse\n"
            "  mcp-proxy --no-verify-ssl https://server.local/sse\n"
            "  mcp-proxy --transport streamablehttp http://localhost:8080/mcp\n"
            "  mcp-proxy --headers Authorization 'Bearer YOUR_TOKEN' http://localhost:8080/sse\n"
            "  mcp-proxy --port 8080 -- your-command --arg1 value1 --arg2 value2\n"
            "  mcp-proxy --named-server fetch 'uvx mcp-server-fetch' --port 8080\n"
            "  mcp-proxy your-command --port 8080 -e KEY VALUE -e ANOTHER_KEY ANOTHER_VALUE\n"
            "  mcp-proxy your-command --port 8080 --allow-origin='*'\n"
        ),
        formatter_class=argparse.RawTextHelpFormatter,
    )

    _add_arguments_to_parser(parser)
    return parser


def _add_arguments_to_parser(parser: argparse.ArgumentParser) -> None:
    """Add all arguments to the argument parser."""
    try:
        package_version = version("mcp-proxy")
    except Exception:  # noqa: BLE001
        package_version = "unknown"

    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {package_version}",
        help="Show the version and exit",
    )

    parser.add_argument(
        "command_or_url",
        help=(
            "Command or URL to connect to. When a URL, will run an SSE/StreamableHTTP client. "
            "Otherwise, if --named-server is not used, this will be the command "
            "for the default stdio client. If --named-server is used, this argument "
            "is ignored for stdio mode unless no default server is desired. "
            "See corresponding options for more details."
        ),
        nargs="?",
        default=SSE_URL,
    )

    client_group = parser.add_argument_group("SSE/StreamableHTTP client options")
    client_group.add_argument(
        "-H",
        "--headers",
        nargs=2,
        action="append",
        metavar=("KEY", "VALUE"),
        help="Headers to pass to the SSE server. Can be used multiple times.",
        default=[],
    )
    client_group.add_argument(
        "--transport",
        choices=["sse", "streamablehttp"],
        default="sse",  # For backwards compatibility
        help="The transport to use for the client. Default is SSE.",
    )
    client_group.add_argument(
        "--client-id",
        type=str,
        help="OAuth2 client ID for authentication",
    )
    client_group.add_argument(
        "--client-secret",
        type=str,
        help="OAuth2 client secret for authentication",
    )
    client_group.add_argument(
        "--token-url",
        type=str,
        help="OAuth2 token URL for authentication",
    )
    client_group.add_argument(
        "--verify-ssl",
        nargs="?",
        const=True,
        default=None,
        metavar="VALUE",
        dest="verify_ssl",
        help=(
            "Control SSL verification when acting as a client. Use without a value to "
            "force verification, pass 'false' to disable, or provide a path to a PEM bundle."
        ),
    )
    client_group.add_argument(
        "--no-verify-ssl",
        dest="verify_ssl",
        action="store_const",
        const=False,
        help=("Disable SSL verification (alias for --verify-ssl false)."),
    )

    stdio_client_options = parser.add_argument_group("stdio client options")
    stdio_client_options.add_argument(
        "args",
        nargs="*",
        help=(
            "Any extra arguments to the command to spawn the default server. "
            "Ignored if only named servers are defined."
        ),
    )
    stdio_client_options.add_argument(
        "-e",
        "--env",
        nargs=2,
        action="append",
        metavar=("KEY", "VALUE"),
        help=(
            "Environment variables used when spawning the default server. Can be "
            "used multiple times. For named servers, environment is inherited or "
            "passed via --pass-environment."
        ),
        default=[],
    )
    stdio_client_options.add_argument(
        "--cwd",
        default=None,
        help=(
            "The working directory to use when spawning the default server process. "
            "Named servers inherit the proxy's CWD."
        ),
    )
    stdio_client_options.add_argument(
        "--pass-environment",
        action=argparse.BooleanOptionalAction,
        help="Pass through all environment variables when spawning all server processes.",
        default=False,
    )
    stdio_client_options.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        metavar="LEVEL",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Set the log level. Default is INFO.",
    )
    stdio_client_options.add_argument(
        "--debug",
        action=argparse.BooleanOptionalAction,
        help=(
            "Enable debug mode with detailed logging output. Equivalent to --log-level DEBUG. "
            "If both --debug and --log-level are provided, --debug takes precedence."
        ),
        default=False,
    )
    stdio_client_options.add_argument(
        "--named-server",
        action="append",
        nargs=2,
        metavar=("NAME", "COMMAND_STRING"),
        help=(
            "Define a named stdio server. NAME is for the URL path /servers/NAME/. "
            "COMMAND_STRING is a single string with the command and its arguments "
            "(e.g., 'uvx mcp-server-fetch --timeout 10'). "
            "These servers inherit the proxy's CWD and environment from --pass-environment."
        ),
        default=[],
        dest="named_server_definitions",
    )
    stdio_client_options.add_argument(
        "--named-server-config",
        type=str,
        default=None,
        metavar="FILE_PATH",
        help=(
            "Path to a JSON configuration file for named stdio servers. "
            "If provided, this will be the exclusive source for named server definitions, "
            "and any --named-server CLI arguments will be ignored."
        ),
    )

    mcp_server_group = parser.add_argument_group("SSE server options")
    mcp_server_group.add_argument(
        "--port",
        type=int,
        default=0,
        help="Port to expose an SSE server on. Default is a random port",
    )
    mcp_server_group.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to expose an SS
```

### Core Architecture Module: `src/mcp_proxy/config_loader.py`
```
"""Configuration loader for MCP proxy.

This module provides functionality to load named server configurations from JSON files.
"""

import json
import logging
from pathlib import Path

from mcp.client.stdio import StdioServerParameters

logger = logging.getLogger(__name__)


def load_named_server_configs_from_file(
    config_file_path: str | Path,
    base_env: dict[str, str],
) -> dict[str, StdioServerParameters]:
    """Loads named server configurations from a JSON file.

    Args:
        config_file_path: Path to the JSON configuration file.
        base_env: The base environment dictionary to be inherited by servers.

    Returns:
        A dictionary of named server parameters.

    Raises:
        FileNotFoundError: If the config file is not found.
        json.JSONDecodeError: If the config file contains invalid JSON.
        ValueError: If the config file format is invalid.
    """
    named_stdio_params: dict[str, StdioServerParameters] = {}
    logger.info("Loading named server configurations from: %s", config_file_path)

    try:
        with Path(config_file_path).open() as f:
            config_data = json.load(f)
    except FileNotFoundError:
        logger.exception("Configuration file not found: %s", config_file_path)
        raise
    except json.JSONDecodeError:
        logger.exception("Error decoding JSON from configuration file: %s", config_file_path)
        raise
    except Exception as e:
        logger.exception(
            "Unexpected error opening or reading configuration file %s",
            config_file_path,
        )
        error_message = f"Could not read configuration file: {e}"
        raise ValueError(error_message) from e

    if not isinstance(config_data, dict) or "mcpServers" not in config_data:
        msg = f"Invalid config file format in {config_file_path}. Missing 'mcpServers' key."
        logger.error(msg)
        raise ValueError(msg)

    for name, server_config in config_data.get("mcpServers", {}).items():
        if not isinstance(server_config, dict):
            logger.warning(
                "Skipping invalid server config for '%s' in %s. Entry is not a dictionary.",
                name,
                config_file_path,
            )
            continue
        if not server_config.get("enabled", True):  # Default to True if 'enabled' is not present
            logger.info("Named server '%s' from config is not enabled. Skipping.", name)
            continue

        command = server_config.get("command")
        command_args = server_config.get("args", [])
        env = server_config.get("env", {})

        if not command:
            logger.warning(
                "Named server '%s' from config is missing 'command'. Skipping.",
                name,
            )
            continue
        if not isinstance(command_args, list):
            logger.warning(
                "Named server '%s' from config has invalid 'args' (must be a list). Skipping.",
                name,
            )
            continue

        new_env = base_env.copy()
        new_env.update(env)

        named_stdio_params[name] = StdioServerParameters(
            command=command,
            args=command_args,
            env=new_env,
            cwd=None,
        )
        logger.info(
            "Configured named server '%s' from config: %s %s",
            name,
            command,
            " ".join(command_args),
        )

    return named_stdio_params

```

### Core Architecture Module: `src/mcp_proxy/httpx_client.py`
```
"""HTTP request logging patch for MCP proxy.

This module patches the create_mcp_http_client function to add comprehensive
request and response logging capabilities.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def custom_httpx_client(  # noqa: C901
    headers: dict[str, str] | None = None,
    timeout: httpx.Timeout | None = None,
    auth: httpx.Auth | None = None,
    verify_ssl: bool | str | None = None,
) -> httpx.AsyncClient:
    """Create a standardized httpx AsyncClient with MCP defaults and logging.

    This is a replacement for the original create_mcp_http_client that adds
    comprehensive request/response logging capabilities.

    Args:
        headers: Optional headers to include with all requests.
        timeout: Request timeout as httpx.Timeout object.
        auth: Optional authentication handler.
        verify_ssl: Control SSL verification. Use False to disable
            or a path to a certificate bundle.

    Returns:
        Configured httpx.AsyncClient instance with MCP defaults and logging.
    """
    # Set MCP defaults (copied from original implementation)
    kwargs: dict[str, Any] = {
        "follow_redirects": True,
    }

    # Handle timeout
    if timeout is None:
        kwargs["timeout"] = httpx.Timeout(30.0)
    else:
        kwargs["timeout"] = timeout

    # Handle headers
    if headers is not None:
        kwargs["headers"] = headers

    # Handle authentication
    if auth is not None:
        kwargs["auth"] = auth

    if verify_ssl is not None:
        normalized_verify: bool | str
        if isinstance(verify_ssl, str):
            lowered = verify_ssl.strip().lower()
            if lowered in {"1", "true", "yes", "on"}:
                normalized_verify = True
            elif lowered in {"0", "false", "no", "off"}:
                normalized_verify = False
            else:
                normalized_verify = verify_ssl
        else:
            normalized_verify = verify_ssl

        kwargs["verify"] = normalized_verify

        if isinstance(normalized_verify, bool):
            logger.debug(
                "Configured httpx.AsyncClient verify=%s (SSL verification %s).",
                normalized_verify,
                "enabled" if normalized_verify else "disabled",
            )
        else:
            logger.debug(
                "Configured httpx.AsyncClient using certificate bundle at %s.",
                normalized_verify,
            )

    # Add logging event hooks
    async def log_request(request: httpx.Request) -> None:
        """Log HTTP request details."""
        logger.info(
            "HTTP Request: %s %s",
            request.method,
            request.url,
        )

        # Log headers (be careful with sensitive data)
        if logger.isEnabledFor(logging.DEBUG) or True:
            safe_headers = {}
            for key, value in request.headers.items():
                # Mask sensitive headers
                if key.lower() in ("authorization", "x-api-key", "cookie"):
                    safe_headers[key] = "***MASKED***"
                else:
                    safe_headers[key] = value
            logger.info("Request Headers: %s", safe_headers)

    async def log_response(response: httpx.Response) -> None:
        """Log HTTP response details."""
        logger.debug(
            "HTTP Response: %s %s - %d %s",
            response.request.method,
            response.request.url,
            response.status_code,
            response.reason_phrase,
        )

        # Log response headers
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug("Response Headers: %s", dict(response.headers))

    # Add event hooks
    kwargs["event_hooks"] = {
        "request": [log_request],
        "response": [log_response],
    }

    return httpx.AsyncClient(**kwargs)

```

### Core Architecture Module: `src/mcp_proxy/mcp_server.py`
```
"""Create a local SSE server that proxies requests to a stdio MCP server."""

import contextlib
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Final, Literal

import uvicorn
from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp.server import Server as MCPServerSDK  # Renamed to avoid conflict
from mcp.server.sse import SseServerTransport
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import BaseRoute, Mount, Route
from starlette.types import Receive, Scope, Send

from .proxy_server import create_proxy_server

logger = logging.getLogger(__name__)

DEFAULT_EXPOSE_HEADERS: Final[tuple[str, ...]] = ("mcp-session-id",)


def _default_expose_headers() -> list[str]:
    return list(DEFAULT_EXPOSE_HEADERS)


@dataclass
class MCPServerSettings:
    """Settings for the MCP server."""

    bind_host: str
    port: int
    stateless: bool = False
    allow_origins: list[str] | None = None
    expose_headers: list[str] = field(default_factory=_default_expose_headers)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"


# To store last activity for multiple servers if needed, though status endpoint is global for now.
_global_status: dict[str, Any] = {
    "api_last_activity": datetime.now(timezone.utc).isoformat(),
    "server_instances": {},  # Could be used to store per-instance status later
}


def _update_global_activity() -> None:
    _global_status["api_last_activity"] = datetime.now(timezone.utc).isoformat()


class _ASGIEndpointAdapter:
    """Wrap a coroutine function into an ASGI application."""

    def __init__(self, endpoint: Callable[[Scope, Receive, Send], Awaitable[None]]) -> None:
        self._endpoint = endpoint

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        await self._endpoint(scope, receive, send)


HTTP_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"]


async def _handle_status(_: Request) -> Response:
    """Global health check and service usage monitoring endpoint."""
    return JSONResponse(_global_status)


def create_single_instance_routes(
    mcp_server_instance: MCPServerSDK[object],
    *,
    stateless_instance: bool,
) -> tuple[list[BaseRoute], StreamableHTTPSessionManager]:  # Return the manager itself
    """Create Starlette routes and the HTTP session manager for a single MCP server instance."""
    logger.debug(
        "Creating routes for a single MCP server instance (stateless: %s)",
        stateless_instance,
    )

    sse_transport = SseServerTransport("/messages/")
    http_session_manager = StreamableHTTPSessionManager(
        app=mcp_server_instance,
        event_store=None,
        json_response=True,
        stateless=stateless_instance,
    )

    async def handle_sse_instance(request: Request) -> Response:
        async with sse_transport.connect_sse(
            request.scope,
            request.receive,
            request._send,  # noqa: SLF001
        ) as (read_stream, write_stream):
            _update_global_activity()
            await mcp_server_instance.run(
                read_stream,
                write_stream,
                mcp_server_instance.create_initialization_options(),
                stateless=stateless_instance,
            )
        return Response()

    async def handle_streamable_http_instance(scope: Scope, receive: Receive, send: Send) -> None:
        _update_global_activity()
        updated_scope = scope
        if scope.get("type") == "http":
            path = scope.get("path", "")
            if path and path.rstrip("/") == "/mcp" and not path.endswith("/"):
                updated_scope = dict(scope)
                normalized_path = path + "/"
                logger.debug(
                    "Normalized request path from '%s' to '%s' without redirect",
                    path,
                    normalized_path,
                )
                updated_scope["path"] = normalized_path

                raw_path = scope.get("raw_path")
                if raw_path:
                    if b"?" in raw_path:
                        path_part, query_part = raw_path.split(b"?", 1)
                        updated_scope["raw_path"] = path_part.rstrip(b"/") + b"/?" + query_part
                    else:
                        updated_scope["raw_path"] = raw_path.rstrip(b"/") + b"/"

        await http_session_manager.handle_request(updated_scope, receive, send)

    routes = [
        Route(
            "/mcp",
            endpoint=_ASGIEndpointAdapter(handle_streamable_http_instance),
            methods=HTTP_METHODS,
            include_in_schema=False,
        ),
        Mount("/mcp", app=handle_streamable_http_instance),
        Route("/sse", endpoint=handle_sse_instance),
        Mount("/messages/", app=sse_transport.handle_post_message),
    ]
    return routes, http_session_manager


async def run_mcp_server(
    mcp_settings: MCPServerSettings,
    default_server_params: StdioServerParameters | None = None,
    named_server_params: dict[str, StdioServerParameters] | None = None,
) -> None:
    """Run stdio client(s) and expose an MCP server with multiple possible backends."""
    if named_server_params is None:
        named_server_params = {}

    all_routes: list[BaseRoute] = [
        Route("/status", endpoint=_handle_status),  # Global status endpoint
    ]
    # Use AsyncExitStack to manage lifecycles of multiple components
    async with contextlib.AsyncExitStack() as stack:
        # Manage lifespans of all StreamableHTTPSessionManagers
        @contextlib.asynccontextmanager
        async def combined_lifespan(_app: Starlette) -> AsyncIterator[None]:
            logger.info("Main application lifespan starting...")
            # All http_session_managers' .run() are already entered into the stack
            yield
            logger.info("Main application lifespan shutting down...")

        # Setup default server if configured
        if default_server_params:
            logger.info(
                "Setting up default server: %s %s",
                default_server_params.command,
                " ".join(default_server_params.args),
            )
            stdio_streams = await stack.enter_async_context(stdio_client(default_server_params))
            session = await stack.enter_async_context(ClientSession(*stdio_streams))
            proxy = await create_proxy_server(session)

            instance_routes, http_manager = create_single_instance_routes(
                proxy,
                stateless_instance=mcp_settings.stateless,
            )
            await stack.enter_async_context(http_manager.run())  # Manage lifespan by calling run()
            all_routes.extend(instance_routes)
            _global_status["server_instances"]["default"] = "configured"

        # Setup named servers
        for name, params in named_server_params.items():
            logger.info(
                "Setting up named server '%s': %s %s",
                name,
                params.command,
                " ".join(params.args),
            )
            stdio_streams_named = await stack.enter_async_context(stdio_client(params))
            session_named = await stack.enter_async_context(ClientSession(*stdio_streams_named))
            proxy_named = await create_proxy_server(session_named)

            instance_routes_named, http_manager_named = create_single_instance_routes(
                proxy_named,
                stateless_instance=mcp_settings.stateless,
            )
         
```

### Core Architecture Module: `src/mcp_proxy/proxy_server.py`
```
"""Create an MCP server that proxies requests through an MCP client.

This server is created independent of any transport mechanism.
"""

import logging
import typing as t

from mcp import server, types
from mcp.client.session import ClientSession
from mcp.server.lowlevel.server import request_ctx

logger = logging.getLogger(__name__)


async def create_proxy_server(remote_app: ClientSession) -> server.Server[object]:  # noqa: C901, PLR0915
    """Create a server instance from a remote app."""
    logger.debug("Sending initialization request to remote MCP server...")
    response = await remote_app.initialize()
    capabilities = response.capabilities

    logger.debug("Configuring proxied MCP server...")
    app: server.Server[object] = server.Server(name=response.serverInfo.name)

    if capabilities.prompts:
        logger.debug("Capabilities: adding Prompts...")

        async def _list_prompts(_: t.Any) -> types.ServerResult:  # noqa: ANN401
            result = await remote_app.list_prompts()
            return types.ServerResult(result)

        app.request_handlers[types.ListPromptsRequest] = _list_prompts

        async def _get_prompt(req: types.GetPromptRequest) -> types.ServerResult:
            result = await remote_app.get_prompt(req.params.name, req.params.arguments)
            return types.ServerResult(result)

        app.request_handlers[types.GetPromptRequest] = _get_prompt

    if capabilities.resources:
        logger.debug("Capabilities: adding Resources...")

        async def _list_resources(_: t.Any) -> types.ServerResult:  # noqa: ANN401
            result = await remote_app.list_resources()
            return types.ServerResult(result)

        app.request_handlers[types.ListResourcesRequest] = _list_resources

        async def _list_resource_templates(_: t.Any) -> types.ServerResult:  # noqa: ANN401
            result = await remote_app.list_resource_templates()
            return types.ServerResult(result)

        app.request_handlers[types.ListResourceTemplatesRequest] = _list_resource_templates

        async def _read_resource(req: types.ReadResourceRequest) -> types.ServerResult:
            result = await remote_app.read_resource(req.params.uri)
            return types.ServerResult(result)

        app.request_handlers[types.ReadResourceRequest] = _read_resource

    if capabilities.logging:
        logger.debug("Capabilities: adding Logging...")

        async def _set_logging_level(req: types.SetLevelRequest) -> types.ServerResult:
            await remote_app.set_logging_level(req.params.level)
            return types.ServerResult(types.EmptyResult())

        app.request_handlers[types.SetLevelRequest] = _set_logging_level

    if capabilities.resources:
        logger.debug("Capabilities: adding Resources...")

        async def _subscribe_resource(req: types.SubscribeRequest) -> types.ServerResult:
            await remote_app.subscribe_resource(req.params.uri)
            return types.ServerResult(types.EmptyResult())

        app.request_handlers[types.SubscribeRequest] = _subscribe_resource

        async def _unsubscribe_resource(req: types.UnsubscribeRequest) -> types.ServerResult:
            await remote_app.unsubscribe_resource(req.params.uri)
            return types.ServerResult(types.EmptyResult())

        app.request_handlers[types.UnsubscribeRequest] = _unsubscribe_resource

    if capabilities.tools:
        logger.debug("Capabilities: adding Tools...")

        async def _list_tools(_: t.Any) -> types.ServerResult:  # noqa: ANN401
            tools = await remote_app.list_tools()
            return types.ServerResult(tools)

        app.request_handlers[types.ListToolsRequest] = _list_tools

        async def _call_tool(req: types.CallToolRequest) -> types.ServerResult:
            try:
                # Convert meta to dict if present (required for TypedDict compatibility)
                meta_dict = dict(req.params.meta) if req.params.meta else None

                # Only set up progress forwarding if progressToken is present
                progress_token = meta_dict.get("progressToken") if meta_dict else None
                progress_callback = None

                if progress_token is not None:
                    # Get request context to access server session for progress forwarding
                    ctx = request_ctx.get()

                    # Create progress forwarder callback
                    # Note: The callback receives individual parameters, not a
                    # ProgressNotificationParams object
                    async def progress_forwarder(
                        progress: float,
                        total: float | None,
                        message: str | None,
                    ) -> None:
                        # Forward progress notification back to parent via server session
                        await ctx.session.send_progress_notification(
                            progress_token=progress_token,
                            progress=progress,
                            total=total,
                            message=message,
                            related_request_id=str(ctx.request_id),
                        )

                    progress_callback = progress_forwarder

                result = await remote_app.call_tool(
                    req.params.name,
                    (req.params.arguments or {}),
                    meta=meta_dict,
                    progress_callback=progress_callback,
                )
                return types.ServerResult(result)
            except Exception as e:  # noqa: BLE001
                return types.ServerResult(
                    types.CallToolResult(
                        content=[types.TextContent(type="text", text=str(e))],
                        isError=True,
                    ),
                )

        app.request_handlers[types.CallToolRequest] = _call_tool

    async def _send_progress_notification(req: types.ProgressNotification) -> None:
        await remote_app.send_progress_notification(
            req.params.progressToken,
            req.params.progress,
            req.params.total,
        )

    app.notification_handlers[types.ProgressNotification] = _send_progress_notification

    async def _complete(req: types.CompleteRequest) -> types.ServerResult:
        result = await remote_app.complete(
            req.params.ref,
            req.params.argument.model_dump(),
        )
        return types.ServerResult(result)

    app.request_handlers[types.CompleteRequest] = _complete

    return app

```

### Core Architecture Module: `src/mcp_proxy/sse_client.py`
```
"""Create a local server that proxies requests to a remote server over SSE."""

from functools import partial
from typing import Any

import httpx
from mcp.client.session import ClientSession
from mcp.client.sse import sse_client
from mcp.server.stdio import stdio_server

from .httpx_client import custom_httpx_client
from .proxy_server import create_proxy_server


async def run_sse_client(
    url: str,
    headers: dict[str, Any] | None = None,
    auth: httpx.Auth | None = None,
    verify_ssl: bool | str | None = None,
) -> None:
    """Run the SSE client.

    Args:
        url: The URL to connect to.
        headers: Headers for connecting to MCP server.
        auth: Optional authentication for the HTTP client.
        verify_ssl: Control SSL verification. Use False to disable
            or a path to a certificate bundle.
    """
    async with (
        sse_client(
            url=url,
            headers=headers,
            auth=auth,
            httpx_client_factory=partial(custom_httpx_client, verify_ssl=verify_ssl),
        ) as streams,
        ClientSession(*streams) as session,
    ):
        app = await create_proxy_server(session)
        async with stdio_server() as (read_stream, write_stream):
            await app.run(
                read_stream,
                write_stream,
                app.create_initialization_options(),
            )

```

### Core Architecture Module: `src/mcp_proxy/streamablehttp_client.py`
```
"""Create a local server that proxies requests to a remote server over SSE."""

from functools import partial
from typing import Any

import httpx
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from mcp.server.stdio import stdio_server

from .httpx_client import custom_httpx_client
from .proxy_server import create_proxy_server


async def run_streamablehttp_client(
    url: str,
    headers: dict[str, Any] | None = None,
    auth: httpx.Auth | None = None,
    verify_ssl: bool | str | None = None,
) -> None:
    """Run the StreamableHTTP client.

    Args:
        url: The URL to connect to.
        headers: Headers for connecting to MCP server.
        auth: Optional authentication for the HTTP client.
        verify_ssl: Control SSL verification. Use False to disable
            or a path to a certificate bundle.
    """
    async with (
        streamablehttp_client(
            url=url,
            headers=headers,
            auth=auth,
            httpx_client_factory=partial(custom_httpx_client, verify_ssl=verify_ssl),
        ) as (read, write, _),
        ClientSession(read, write) as session,
    ):
        app = await create_proxy_server(session)
        async with stdio_server() as (read_stream, write_stream):
            await app.run(
                read_stream,
                write_stream,
                app.create_initialization_options(),
            )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #239** (2026-08-17): **fix: forward pagination params in proxy list handlers**
  *Symptoms*: ## Summary  - forward complete pagination request parameters through prompts, resources, resource templates, and tools list handlers - preserve the tools handler's internal `None` request path - add direct/proxy in-memory regression coverage for cursor forwarding and `nextCursor`  Fixes #233  ## Validation  - pre-commit hooks passed, including Ruff lint and format - mypy passed for all 8 source files - full test suite passed on Python 3.10, 3.11, 3.12, and 3.13 (`100 passed` each) - coverage passed at 88.75% against the required 83% 

- **Issue #228** (2026-07-12): **HTTP/HTTPS Proxy support**
  *Symptoms*: Adds http/https proxy support. Reads settings from environment variables HTTP_PROXY/HTTPS_PROXY  Tested to work in LM Studio with this config: ```json {   "mcpServers": {     "mcp-proxy-example": {       "command": "mcp-proxy",       "args": [         "https://example.com/mcp"       ],       "env": {         "HTTP_PROXY": "http://localhost:1234"       }     }   } } ```   Disclaimer: LLM assisted (Qwen3.6 27b)
  **Post-Mortem & Fix Analysis**:
  > Looking for better solution, this one does not respects NO_PROXY filters
  > Ok, I broke my own rule of "never believe an AI" and this is the result. HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY env vars already work as expected. The issue was my misunderstanding how they are supposed to work (I had only HTTP_PROXY set and used https url)

- **Issue #223** (2026-07-20): **build(deps): bump the actions group across 1 directory with 8 updates**
  *Symptoms*: Bumps the actions group with 8 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [actions/checkout](https://github.com/actions/checkout) | `6.0.2` | `6.0.3` | | [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `4.0.0` | `4.1.0` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `4.0.0` | `4.1.0` | | [docker/metadata-action](https://github.com/docker/metadata-action) | `6.0.0` | `6.1.0` | | [docker/login-action](https://github.com/docker/login-action) | `4.1.0` | `4.2.0` | | [docker/build-push-action](https://github.com/docker/build-push-action) | `7.1.0` | `7.2.0` | | [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv) | `8.1.0` | `8.2.0` | | [codecov/codecov-action](https://github.com/codecov/codecov-action) | `6.0.0` | `7.0.0` |   Updates `actions/checkout` from 6.0.2 to 6.0.3 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actions/checkout/releases">actions/checkout's releases</a>.</em></p> <blockquote> <h2>v6.0.3</h2> <h2>What's Changed</h2> <ul> <li>Update changelog by <a href="https://github.com/ericsciple"><code>@​ericsciple</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2357">actions/checkout#2357</a></li> <li>fix: expand merge commit SHA regex and add SHA-256 test cases by <a href="https://github.com/yaananth"><code>@​yaananth</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2414">actions
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #222** (2026-06-08): **build(deps): bump the actions group across 1 directory with 7 updates**
  *Symptoms*: Bumps the actions group with 7 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [actions/checkout](https://github.com/actions/checkout) | `6.0.2` | `6.0.3` | | [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `4.0.0` | `4.1.0` | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `4.0.0` | `4.1.0` | | [docker/metadata-action](https://github.com/docker/metadata-action) | `6.0.0` | `6.1.0` | | [docker/login-action](https://github.com/docker/login-action) | `4.1.0` | `4.2.0` | | [docker/build-push-action](https://github.com/docker/build-push-action) | `7.1.0` | `7.2.0` | | [codecov/codecov-action](https://github.com/codecov/codecov-action) | `6.0.0` | `6.0.1` |   Updates `actions/checkout` from 6.0.2 to 6.0.3 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actions/checkout/releases">actions/checkout's releases</a>.</em></p> <blockquote> <h2>v6.0.3</h2> <h2>What's Changed</h2> <ul> <li>Update changelog by <a href="https://github.com/ericsciple"><code>@​ericsciple</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2357">actions/checkout#2357</a></li> <li>fix: expand merge commit SHA regex and add SHA-256 test cases by <a href="https://github.com/yaananth"><code>@​yaananth</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2414">actions/checkout#2414</a></li> <li>Fix checkout init for SHA-256 repositories by <a href="h
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #220** (2026-07-24): **fix: tolerate unknown server notifications instead of crashing TaskGroup**
  *Symptoms*: ## Problem  Some MCP servers in the wild emit JSON-RPC notifications with methods that are **not** part of the MCP `ServerNotification` union. A concrete example is `@21st-dev/magic` v0.0.46, which emits LSP-style `window/logMessage`:  ```json {"jsonrpc":"2.0","method":"window/logMessage","params":{"type":3,"message":"..."}} ```  When such a notification reaches `mcp.shared.session.BaseSession`'s receive loop, Pydantic raises a `ValidationError` while parsing it against the `ServerNotification` discriminated union. If that exception escapes the anyio `TaskGroup` wrapping `stdio_client`, the proxy dies with:  ``` ExceptionGroup: unhandled errors in a TaskGroup   +-+- ValidationError: ... ServerNotification ... ```  …and the supervisor (`launchd` / `systemd`) restart-loops the proxy, which interrupts every bridged session every few seconds.  We hit this in production with `@21st-dev/magic` bridged via mcp-proxy. Recent `mcp` SDKs catch the error inline at one site (`shared/session.py`), but the proxy currently has no defense of its own, so any future SDK regression or any code path that re-raises will crash the whole process.  ## Fix  Add a small, surgical defense **at the proxy boundary** so we are robust regardless of what the upstream SDK does:  - New module `src/mcp_proxy/notification_filter.py` wraps the stdio read stream and drops any notification whose envelope cannot be validated as a `ServerNotification`. A `WARNING` is logged with the offending method so operators can

- **Issue #217** (2026-06-03): **build(deps): bump the actions group across 1 directory with 5 updates**
  *Symptoms*: Bumps the actions group with 5 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `4.0.0` | `4.1.0` | | [docker/metadata-action](https://github.com/docker/metadata-action) | `6.0.0` | `6.1.0` | | [docker/login-action](https://github.com/docker/login-action) | `4.1.0` | `4.2.0` | | [docker/build-push-action](https://github.com/docker/build-push-action) | `7.1.0` | `7.2.0` | | [codecov/codecov-action](https://github.com/codecov/codecov-action) | `6.0.0` | `6.0.1` |   Updates `docker/setup-buildx-action` from 4.0.0 to 4.1.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/docker/setup-buildx-action/releases">docker/setup-buildx-action's releases</a>.</em></p> <blockquote> <h2>v4.1.0</h2> <ul> <li>Bump <code>@​docker/actions-toolkit</code> from 0.79.0 to 0.90.0 in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/489">docker/setup-buildx-action#489</a></li> <li>Bump brace-expansion from 1.1.12 to 5.0.6 in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/547">docker/setup-buildx-action#547</a> <a href="https://redirect.github.com/docker/setup-buildx-action/pull/508">docker/setup-buildx-action#508</a></li> <li>Bump fast-xml-builder from 1.0.0 to 1.2.0 in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/540">docker/setup-buildx-action#540</a></li> <li>Bump fast-xml-parser from 5.4.2 
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #215** (2026-05-26): **build(deps): bump codecov/codecov-action from 6.0.0 to 6.0.1 in the actions group**
  *Symptoms*: Bumps the actions group with 1 update: [codecov/codecov-action](https://github.com/codecov/codecov-action).  Updates `codecov/codecov-action` from 6.0.0 to 6.0.1 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/codecov/codecov-action/releases">codecov/codecov-action's releases</a>.</em></p> <blockquote> <h2>v6.0.1</h2> <h2>What's Changed</h2> <ul> <li>fix: prevent template injection in run: steps (VULN-1652) by <a href="https://github.com/thomasrockhu-codecov"><code>@​thomasrockhu-codecov</code></a> in <a href="https://redirect.github.com/codecov/codecov-action/pull/1947">codecov/codecov-action#1947</a></li> <li>chore(release): 6.0.1 by <a href="https://github.com/thomasrockhu-codecov"><code>@​thomasrockhu-codecov</code></a> in <a href="https://redirect.github.com/codecov/codecov-action/pull/1949">codecov/codecov-action#1949</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/codecov/codecov-action/compare/v6.0.0...v6.0.1">https://github.com/codecov/codecov-action/compare/v6.0.0...v6.0.1</a></p> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/codecov/codecov-action/blob/main/CHANGELOG.md">codecov/codecov-action's changelog</a>.</em></p> <blockquote> <h2>v5.5.2</h2> <h3>What's Changed</h3> <p><strong>Full Changelog</strong>: <a href="https://github.com/codecov/codecov-action/compare/v5.5.1..v5.5.2">https://github.com/codecov/codecov-action/compar
  **Post-Mortem & Fix Analysis**:
  > Looks like codecov/codecov-action is updatable in another way, so this is no longer needed.

- **Issue #212** (2026-05-14): **build: bump tooling**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/sparfenyuk/mcp-proxy/pull/212?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Sergey+Parfenyuk) Report :white_check_mark: All modified and coverable lines are covered by tests.  [![Impacted file tree graph](https://app.codecov.io/gh/sparfenyuk/mcp-proxy/pull/212/graphs/tree.svg?width=650&height=150&src=pr&token=31VV9L7AZQ&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Sergey+Parfenyuk)](https://app.codecov.io/gh/sparfenyuk/mcp-proxy/pull/212?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Sergey+Parfenyuk)  ```diff @@           Coverage Diff           @@ ##             main     #212   +/-   ## =======================================   Coverage   89.37%   89.37%            =======================================   Files          12       12              Lines        1318  

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

### Incident Patch 1: `03aa8982` (2026-05-12)
**Commit Message**: fix(sse): propagate stateless flag to ServerSession in handle_sse_instance

handle_sse_instance() called mcp_server_instance.run() without
stateless=stateless_instance. With SSE transport, each new
ServerSession starts in InitializationState.NotInitialized,
which means clients that open parallel SSE sessions (e.g.
reconnects from Claude.ai Custom Connectors) can fire tool
calls before `initialize` completes for that specific session,
producing JSON-RPC -32602 "Invalid request parameters".

Forwarding the stateless flag matches the existing pattern in
handle_streamable_http_instance and resolves the race.

**File**: `src/mcp_proxy/mcp_server.py` (modified, +1/-0)
```diff
@@ -103,6 +103,7 @@ async def handle_sse_instance(request: Request) -> Response:
                 read_stream,
                 write_stream,
                 mcp_server_instance.create_initialization_options(),
+                stateless=stateless_instance,
             )
         return Response()
 
```

---

### Incident Patch 2: `d68491ea` (2026-05-14)
**Commit Message**: fix: forward meta parameter in call_tool handler (#189)

Fixes bug where the meta parameter (containing progressToken for
progress notifications) was not being forwarded when calling tools
through the proxy, and implements progress notification forwarding from
child tools back to parent clients.

Changes:
- Updated _call_tool handler in proxy_server.py to extract and forward
meta parameter
- Added dict conversion to handle TypedDict requirement (meta_dict =
dict(req.params.meta))
- Implemented progress_forwarder callback to forward child tool progress
notifications to parent
- Updated server_can_call_tool test fixture to accept _context parameter
- Added comprehensive tests for meta parameter forwarding:
* test_call_tool_with_meta_parameter: verifies meta with progressToken
is forwarded
* test_call_tool_without_meta_parameter: ensures backward compatibility
* test_call_tool_with_empty_meta_parameter: tests edge case with None
meta
- Added tests for progress notification forwarding:
* test_call_tool_with_progress_callback: verifies progress forwarding
through proxy
* test_call_tool_progress_forwarding_without_token: tests graceful
handling of missing progressToken

All 48 tests pass

**File**: `src/mcp_proxy/proxy_server.py` (modified, +33/-0)
```diff
@@ -8,6 +8,7 @@
 
 from mcp import server, types
 from mcp.client.session import ClientSession
+from mcp.server.lowlevel.server import request_ctx
 
 logger = logging.getLogger(__name__)
 
@@ -92,9 +93,41 @@ async def _list_tools(_: t.Any) -> types.ServerResult:  # noqa: ANN401
 
         async def _call_tool(req: types.CallToolRequest) -> types.ServerResult:
             try:
+                # Convert meta to dict if present (required for TypedDict compatibility)
+                meta_dict = dict(req.params.meta) if req.params.meta else None
+
+                # Only set up progress forwarding if progressToken is present
+                progress_token = meta_dict.get("progressToken") if meta_dict else None
+                progress_callback = None
+
+                if progress_token is not None:
+                    # Get request context to access server session for progress forwarding
+                    ctx = request_ctx.get()
+
+                    # Create progress forwarder callback
+                    # Note: The callback receives individual parameters, not a
+                    # ProgressNotificationParams object
+                    async def progress_forwarder(
+                        progress: float,
+                        total: float | None,
+                        message: str | None,
+                    ) -> None:
+                        # Forward progress notification back to parent via server session
+                        await ctx.session.send_progress_notification(
+                            progress_token=progress_token,
+                            progress=progress,
+                            total=total,
+                            message=message,
+                            related_request_id=str(ctx.request_id),
+                        )
+
+                    progress_callback = progress_forwarder
+
                 result = await remote_app.call_tool(
                     req.params.name,
                     (req.params.arguments or {}),
+                    meta=meta_dict,
+                    progress_callback=progress_callback,
                 )
                 return types.ServerResult(result)
             except Exception as e:  # noqa: BLE001
```

**File**: `tests/test_progress_forwarding.py` (added, +335/-0)
```diff
@@ -0,0 +1,335 @@
+"""Tests for progress notification forwarding in the proxy.
+
+This module contains creative approaches to test the _context parameter
+and progress forwarding mechanism, working around MCP SDK limitations.
+"""
+
+import typing as t
+from unittest.mock import AsyncMock, MagicMock, patch
+
+import pytest
+from mcp import types
+from mcp.server import Server
+from mcp.shared.memory import create_connected_server_and_client_session
+
+from mcp_proxy.proxy_server import create_proxy_server
+
+
+@pytest.fixture
+def mock_server() -> Server[t.Any]:
+    """Create a mock server with tool capability."""
+    server: Server[t.Any] = Server("test-server")
+
+    @server.list_tools()  # type: ignore[no-untyped-call,misc]
+    async def _list_tools() -> list[types.Tool]:
+        return [
+            types.Tool(
+                name="test_tool",
+                description="A test tool",
+                inputSchema={"type": "object", "properties": {}},
+            ),
+        ]
+
+    return server
+
+
+@pytest.fixture
+def progress_tracking_tool_callback() -> AsyncMock:
+    """Create a tool callback that tracks if it receives _context."""
+    callback = AsyncMock()
+    callback.return_value = [
+        types.TextContent(type="text", text="Tool executed"),
+    ]
+    return callback
+
+
+async def test_progress_callback_passed_to_remote_app(
+    mock_server: Server[object],
+    progress_tracking_tool_callback: AsyncMock,
+) -> None:
+    """Test that progress_callback is passed to remote_app.call_tool.
+
+    This test verifies that when a progressToken is provided in meta,
+    the proxy creates a progress_callback and passes it to the remote
+    app's call_tool method.
+
+    Strategy: Mock the remote_app.call_tool to capture the progress_callback
+    parameter and verify it's not None when progressToken is present.
+    """
+
+    # Set up the tool handler
+    @mock_server.call_tool()  # type: ignore[misc]
+    async def _call_tool(
+        name: str,
+        arguments: dict[str, t.Any] | None,
+        _context: object | None = None,
+    ) -> t.Iterable[types.Content]:
+        return await progress_tracking_tool_callback(name, arguments, _context)
+
+    # Create proxy through the server
+    async with create_connected_server_and_client_session(mock_server) as remote_session:
+        proxy_server = await create_proxy_server(remote_session)
+
+        async with create_connected_server_and_client_session(proxy_server) as proxy_session:
+            await proxy_session.initialize()
+
+            # Patch the remote_app.call_tool to capture the progress_callback
+            original_call_tool = remote_session.call_tool
+            call_tool_spy = AsyncMock(side_effect=original_call_tool)
+
+            with patch.object(remote_session, "call_tool", call_tool_spy):
+                # Call tool with progressToken
+                progress_token = 42
+                await proxy_session.call_tool(
+                    "test_tool",
+                    {},
+                    meta={"progressToken": progress_token},
+                )
+
+                # Verify call_tool was called with progress_callback
+                call_tool_spy.assert_called_once()
+                call_args = call_tool_spy.call_args
+
+                # Check that progress_callback was passed and is not None
+                assert "progress_callback" in call_args.kwargs
+                assert call_args.kwargs["progress_callback"] is not None
+
+                # Verify meta was passed correctly
+                assert call_args.kwargs["meta"] == {"progressToken": progress_token}
+
+
+async def test_progress_callback_not_created_without_token(
+    mock_server: Server[object],
+    progress_tracking_tool_callback: AsyncMock,
+) -> None:
+    """Test that progress_callback is None when no progressToken is provided.
+
+    This verifies the optimization that avoids creating unnecessary callbacks.
+
+    Strategy: Mock the re
```

**File**: `tests/test_proxy_server.py` (modified, +234/-2)
```diff
@@ -109,8 +109,9 @@ def server_can_call_tool(
     async def _wrapped_call_tool(
         name: str,
         arguments: dict[str, t.Any] | None,
+        _context: object | None = None,
     ) -> t.Iterable[types.Content]:
-        return await tool_callback(name, arguments or {})
+        return await tool_callback(name, arguments or {}, _context)
 
     return server_can_list_tools
 
@@ -313,7 +314,12 @@ async def test_call_tool(
         assert call_tool_result.content == []
         assert not call_tool_result.isError
 
-        tool_callback.assert_called_once_with("tool", {})
+        # Verify the tool callback was called
+        tool_callback.assert_called_once()
+        call_args = tool_callback.call_args
+        assert call_args[0][0] == "tool"  # name
+        assert call_args[0][1] == {}  # arguments
+        # _context (third arg) may be None or an object depending on mode
         tool_callback.reset_mock()
 
 
@@ -537,3 +543,229 @@ async def test_call_tool_with_error(
 
         call_tool_result = await session.call_tool("tool", {})
         assert call_tool_result.isError
+
+
+@pytest.mark.parametrize("tool_callback", [AsyncMock()])
+async def test_call_tool_with_meta_parameter(
+    session_generator: SessionContextManager,
+    server_can_call_tool: Server[object],
+    tool_callback: AsyncMock,
+) -> None:
+    """Test that meta parameter is forwarded correctly through the proxy.
+
+    This test verifies the fix for the bug where the meta parameter
+    (containing progressToken for progress notifications) was not being
+    forwarded when calling tools through the proxy.
+
+    The test verifies that when meta is provided, the tool executes successfully
+    and the meta parameter doesn't cause any errors. The actual forwarding of meta
+    to the child server is tested implicitly - if meta wasn't being forwarded
+    correctly, the proxy would fail or the progress notification system wouldn't work.
+    """
+    async with session_generator(server_can_call_tool) as session:
+        await session.initialize()
+
+        # Mock the tool callback
+        tool_callback.return_value = [
+            types.TextContent(type="text", text="Tool executed successfully"),
+        ]
+
+        # Call the tool with a meta parameter containing a progressToken
+        progress_token = 42
+        call_tool_result = await session.call_tool(
+            "tool",
+            {"input1": "test-value"},
+            meta={"progressToken": progress_token},
+        )
+
+        # Verify the tool was called successfully
+        assert not call_tool_result.isError
+        assert len(call_tool_result.content) == 1
+        assert call_tool_result.content[0].text == "Tool executed successfully"
+
+        # Verify the tool callback was called with the correct arguments
+        # Note: In proxy mode, the tool is called twice (once by proxy, once by underlying server)
+        # In server mode, it's called once
+        assert tool_callback.call_count in (1, 2)
+
+        # Check the first call (or only call in server mode)
+        call_args = tool_callback.call_args_list[0]
+        assert call_args[0][0] == "tool"  # name
+        assert call_args[0][1] == {"input1": "test-value"}  # arguments
+
+        # _context (3rd argument) will be None in server mode, but may be present in proxy mode
+        # The important thing is that the tool executes successfully with meta
+        tool_callback.reset_mock()
+
+
+@pytest.mark.parametrize("tool_callback", [AsyncMock()])
+async def test_call_tool_without_meta_parameter(
+    session_generator: SessionContextManager,
+    server_can_call_tool: Server[object],
+    tool_callback: AsyncMock,
+) -> None:
+    """Test that calling a tool without meta parameter still works.
+
+    This ensures backward compatibility - tools should work fine
+    when no meta parameter is provided.
+    """
+    async with session_generator(server_can_call_tool) as session:
+        await session.in
```

---

### Incident Patch 3: `e730450b` (2025-10-18)
**Commit Message**: fix: align /mcp streamable HTTP handling with python-sdk (#119)

- mirror the python-sdk fix so `/mcp` requests are scope-normalised to
`/mcp/` before hitting the StreamableHTTP session manager, eliminating
the 307 redirect/404 regression introduced in #89
- extend the HTTP transport test to cover both `/mcp/` and `/mcp`,
ensuring the proxy works with SDK clients out of the box

Co-authored-by: Zhengfeng <gaozhengfeng.2020@bytedance.com>

**File**: `src/mcp_proxy/mcp_server.py` (modified, +42/-2)
```diff
@@ -2,7 +2,7 @@
 
 import contextlib
 import logging
-from collections.abc import AsyncIterator
+from collections.abc import AsyncIterator, Awaitable, Callable
 from dataclasses import dataclass
 from datetime import datetime, timezone
 from typing import Any, Literal
@@ -48,6 +48,19 @@ def _update_global_activity() -> None:
     _global_status["api_last_activity"] = datetime.now(timezone.utc).isoformat()
 
 
+class _ASGIEndpointAdapter:
+    """Wrap a coroutine function into an ASGI application."""
+
+    def __init__(self, endpoint: Callable[[Scope, Receive, Send], Awaitable[None]]) -> None:
+        self._endpoint = endpoint
+
+    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
+        await self._endpoint(scope, receive, send)
+
+
+HTTP_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"]
+
+
 async def _handle_status(_: Request) -> Response:
     """Global health check and service usage monitoring endpoint."""
     return JSONResponse(_global_status)
@@ -88,9 +101,36 @@ async def handle_sse_instance(request: Request) -> Response:
 
     async def handle_streamable_http_instance(scope: Scope, receive: Receive, send: Send) -> None:
         _update_global_activity()
-        await http_session_manager.handle_request(scope, receive, send)
+        updated_scope = scope
+        if scope.get("type") == "http":
+            path = scope.get("path", "")
+            if path and path.rstrip("/") == "/mcp" and not path.endswith("/"):
+                updated_scope = dict(scope)
+                normalized_path = path + "/"
+                logger.debug(
+                    "Normalized request path from '%s' to '%s' without redirect",
+                    path,
+                    normalized_path,
+                )
+                updated_scope["path"] = normalized_path
+
+                raw_path = scope.get("raw_path")
+                if raw_path:
+                    if b"?" in raw_path:
+                        path_part, query_part = raw_path.split(b"?", 1)
+                        updated_scope["raw_path"] = path_part.rstrip(b"/") + b"/?" + query_part
+                    else:
+                        updated_scope["raw_path"] = raw_path.rstrip(b"/") + b"/"
+
+        await http_session_manager.handle_request(updated_scope, receive, send)
 
     routes = [
+        Route(
+            "/mcp",
+            endpoint=_ASGIEndpointAdapter(handle_streamable_http_instance),
+            methods=HTTP_METHODS,
+            include_in_schema=False,
+        ),
         Mount("/mcp", app=handle_streamable_http_instance),
         Route("/sse", endpoint=handle_sse_instance),
         Mount("/messages/", app=sse_transport.handle_post_message),
```

**File**: `tests/test_mcp_server.py` (modified, +6/-3)
```diff
@@ -58,12 +58,14 @@ async def lifespan(_app: Starlette) -> t.AsyncIterator[None]:
         async with http_manager.run():
             yield
 
-    return Starlette(
+    app = Starlette(
         debug=debug,
         routes=routes,
         middleware=middleware,
         lifespan=lifespan,
     )
+    app.router.redirect_slashes = False
+    return app
 
 
 class BackgroundServer(uvicorn.Server):
@@ -149,11 +151,12 @@ async def test_sse_transport() -> None:
             assert response.prompts[0].name == "prompt1"
 
 
-async def test_http_transport() -> None:
+@pytest.mark.parametrize("path_suffix", ["/mcp/", "/mcp"])
+async def test_http_transport(path_suffix: str) -> None:
     """Test HTTP transport layer functionality."""
     server = make_background_server(debug=True)
     async with server.run_in_background():
-        http_url = f"{server.url}/mcp/"
+        http_url = f"{server.url}{path_suffix}"
         async with (
             streamablehttp_client(url=http_url) as (read, write, _),
             ClientSession(read, write) as session,
```

---

### Incident Patch 4: `8d89e728` (2025-09-22)
**Commit Message**: revert: docker build requires tags properly set

**File**: `.github/workflows/cd.yaml` (modified, +6/-4)
```diff
@@ -63,8 +63,9 @@ jobs:
           context: .
           platforms: linux/amd64,linux/arm64
           push: ${{ github.event_name != 'pull_request' }}
-          build-args: |
-            DOCKER_METADATA_OUTPUT_JSON
+          tags: ${{ steps.meta.outputs.tags }}
+          labels: ${{ steps.meta.outputs.labels }}
+          annotations: ${{ steps.meta.outputs.annotations }}
           cache-from: type=local,src=/tmp/.buildx-cache
           cache-to: type=local,dest=/tmp/.buildx-cache
 
@@ -120,8 +121,9 @@ jobs:
           context: .
           platforms: linux/amd64,linux/arm64
           push: ${{ github.event_name != 'pull_request' }}
-          build-args: |
-            DOCKER_METADATA_OUTPUT_JSON
+          tags: ${{ steps.meta.outputs.tags }}
+          labels: ${{ steps.meta.outputs.labels }}
+          annotations: ${{ steps.meta.outputs.annotations }}
           cache-from: type=local,src=/tmp/.buildx-cache
           cache-to: type=local,dest=/tmp/.buildx-cache
 
```

---

### Incident Patch 5: `5f1d4de9` (2025-07-05)
**Commit Message**: fix: nonetype is not callable (#92)

**File**: `src/mcp_proxy/mcp_server.py` (modified, +2/-1)
```diff
@@ -72,7 +72,7 @@ def create_single_instance_routes(
         stateless=stateless_instance,
     )
 
-    async def handle_sse_instance(request: Request) -> None:
+    async def handle_sse_instance(request: Request) -> Response:
         async with sse_transport.connect_sse(
             request.scope,
             request.receive,
@@ -84,6 +84,7 @@ async def handle_sse_instance(request: Request) -> None:
                 write_stream,
                 mcp_server_instance.create_initialization_options(),
             )
+        return Response()
 
     async def handle_streamable_http_instance(scope: Scope, receive: Receive, send: Send) -> None:
         _update_global_activity()
```

---

### Incident Patch 6: `73d6d79f` (2025-07-05)
**Commit Message**: fix: disable redirect to trailing slashes (#89)

Starlette's default behavior adds a trailing slash to every routes
without it (https://github.com/encode/starlette/discussions/2548), e.g.
when client initiates a request to `/mcp`, it returns a `307 Temporary
Redirect` response to `/mcp/`. This is causing some annoying issues,
especially in our internal environment where server instances sit behind
a load balancer and do not have access to their actual domain name,
Starlette returns the instance's internal ip which the client cannot
recognize and access. This PR disables this behavior.

Signed-off-by: Jianxin Qiu <jianxin.qiu@outlook.com>

**File**: `src/mcp_proxy/mcp_server.py` (modified, +2/-0)
```diff
@@ -185,6 +185,8 @@ async def combined_lifespan(_app: Starlette) -> AsyncIterator[None]:
             lifespan=combined_lifespan,
         )
 
+        starlette_app.router.redirect_slashes = False
+
         config = uvicorn.Config(
             starlette_app,
             host=mcp_settings.bind_host,
```

---

### Incident Patch 7: `24939b85` (2025-06-05)
**Commit Message**: ffix: updated default values for --port and --host (#76)

default values for --port and --host were set to None, causing NoneType
errors

**File**: `src/mcp_proxy/__main__.py` (modified, +2/-2)
```diff
@@ -154,12 +154,12 @@ def _add_arguments_to_parser(parser: argparse.ArgumentParser) -> None:
     mcp_server_group.add_argument(
         "--port",
         type=int,
-        default=None,
+        default=0,
         help="Port to expose an SSE server on. Default is a random port",
     )
     mcp_server_group.add_argument(
         "--host",
-        default=None,
+        default="127.0.0.1",
         help="Host to expose an SSE server on. Default is 127.0.0.1",
     )
     mcp_server_group.add_argument(
```

---

### Incident Patch 8: `90134a92` (2025-05-31)
**Commit Message**: fix: missing slash on SSE /messages path (#71)

**File**: `src/mcp_proxy/mcp_server.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ def create_single_instance_routes(
         stateless_instance,
     )
 
-    sse_transport = SseServerTransport("messages/")
+    sse_transport = SseServerTransport("/messages/")
     http_session_manager = StreamableHTTPSessionManager(
         app=mcp_server_instance,
         event_store=None,
```

---

### Incident Patch 9: `27a16279` (2025-05-17)
**Commit Message**: fix: correct debug logging typo (#68)

Co-authored-by: jack.wong <jack.wong@bytedance.com>

**File**: `src/mcp_proxy/proxy_server.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
 async def create_proxy_server(remote_app: ClientSession) -> server.Server[object]:  # noqa: C901, PLR0915
     """Create a server instance from a remote app."""
-    logger.debug("Sending initalization request to remote MCP server...")
+    logger.debug("Sending initialization request to remote MCP server...")
     response = await remote_app.initialize()
     capabilities = response.capabilities
 
```

---

### Incident Patch 10: `357c8c23` (2025-04-13)
**Commit Message**: feat: support --debug argument for verbose output (#47)

Closes #34

**File**: `.vscode/launch.json` (modified, +11/-0)
```diff
@@ -6,6 +6,17 @@
       "type": "python",
       "request": "test",
       "justMyCode": false
+    },
+    {
+      "name": "Debug mcp-proxy",
+      "type": "debugpy",
+      "request": "launch",
+      "console": "integratedTerminal",
+      "justMyCode": false,
+      "python": "${command:python.interpreterPath}",
+      "envFile": "${workspaceFolder}/.env",
+      "module": "mcp_proxy",
+      "args": ["--sse-port=8080", "--debug", "--", "uvx", "mcp-server-fetch"]
     }
   ]
 }
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -260,6 +260,7 @@ stdio client options:
                         Environment variables used when spawning the server. Can be used multiple times.
   --pass-environment, --no-pass-environment
                         Pass through all environment variables when spawning the server.
+  --debug, --no-debug   Enable debug mode with detailed logging output.
 
 SSE server options:
   --sse-port SSE_PORT   Port to expose an SSE server on. Default is a random port
```

**File**: `src/mcp_proxy/__main__.py` (modified, +12/-3)
```diff
@@ -18,7 +18,6 @@
 from .sse_client import run_sse_client
 from .sse_server import SseServerSettings, run_sse_server
 
-logging.basicConfig(level=logging.DEBUG)
 SSE_URL: t.Final[str | None] = os.getenv(
     "SSE_URL",
     None,
@@ -84,6 +83,12 @@ def main() -> None:
         help="Pass through all environment variables when spawning the server.",
         default=False,
     )
+    stdio_client_options.add_argument(
+        "--debug",
+        action=argparse.BooleanOptionalAction,
+        help="Enable debug mode with detailed logging output.",
+        default=False,
+    )
 
     sse_server_group = parser.add_argument_group("SSE server options")
     sse_server_group.add_argument(
@@ -110,21 +115,24 @@ def main() -> None:
         parser.print_help()
         sys.exit(1)
 
+    logging.basicConfig(level=logging.DEBUG if args.debug else logging.INFO)
+    logger = logging.getLogger(__name__)
+
     if (
         SSE_URL
         or args.command_or_url.startswith("http://")
         or args.command_or_url.startswith("https://")
     ):
         # Start a client connected to the SSE server, and expose as a stdio server
-        logging.debug("Starting SSE client and stdio server")
+        logger.debug("Starting SSE client and stdio server")
         headers = dict(args.headers)
         if api_access_token := os.getenv("API_ACCESS_TOKEN", None):
             headers["Authorization"] = f"Bearer {api_access_token}"
         asyncio.run(run_sse_client(args.command_or_url, headers=headers))
         return
 
     # Start a client connected to the given command, and expose as an SSE server
-    logging.debug("Starting stdio client and SSE server")
+    logger.debug("Starting stdio client and SSE server")
 
     # The environment variables passed to the server process
     env: dict[str, str] = {}
@@ -143,6 +151,7 @@ def main() -> None:
         bind_host=args.sse_host,
         port=args.sse_port,
         allow_origins=args.allow_origin if len(args.allow_origin) > 0 else None,
+        log_level="DEBUG" if args.debug else "INFO",
     )
     asyncio.run(run_sse_server(stdio_params, sse_settings))
 
```

**File**: `src/mcp_proxy/proxy_server.py` (modified, +15/-6)
```diff
@@ -3,20 +3,26 @@
 This server is created independent of any transport mechanism.
 """
 
+import logging
 import typing as t
 
 from mcp import server, types
 from mcp.client.session import ClientSession
 
+logger = logging.getLogger(__name__)
 
-async def create_proxy_server(remote_app: ClientSession) -> server.Server[object]:  # noqa: C901
+
+async def create_proxy_server(remote_app: ClientSession) -> server.Server[object]:  # noqa: C901, PLR0915
     """Create a server instance from a remote app."""
+    logger.debug("Sending initalization request to remote MCP server...")
     response = await remote_app.initialize()
     capabilities = response.capabilities
 
+    logger.debug("Configuring proxied MCP server...")
     app: server.Server[object] = server.Server(name=response.serverInfo.name)
 
     if capabilities.prompts:
+        logger.debug("Capabilities: adding Prompts...")
 
         async def _list_prompts(_: t.Any) -> types.ServerResult:  # noqa: ANN401
             result = await remote_app.list_prompts()
@@ -31,19 +37,19 @@ async def _get_prompt(req: types.GetPromptRequest) -> types.ServerResult:
         app.request_handlers[types.GetPromptRequest] = _get_prompt
 
     if capabilities.resources:
+        logger.debug("Capabilities: adding Resources...")
 
         async def _list_resources(_: t.Any) -> types.ServerResult:  # noqa: ANN401
             result = await remote_app.list_resources()
             return types.ServerResult(result)
 
         app.request_handlers[types.ListResourcesRequest] = _list_resources
 
-        # list_resource_templates() is not implemented in the client
-        # async def _list_resource_templates(_: t.Any) -> types.ServerResult:
-        #     result = await remote_app.list_resource_templates()
-        #     return types.ServerResult(result)
+        async def _list_resource_templates(_: t.Any) -> types.ServerResult:  # noqa: ANN401
+            result = await remote_app.list_resource_templates()
+            return types.ServerResult(result)
 
-        # app.request_handlers[types.ListResourceTemplatesRequest] = _list_resource_templates
+        app.request_handlers[types.ListResourceTemplatesRequest] = _list_resource_templates
 
         async def _read_resource(req: types.ReadResourceRequest) -> types.ServerResult:
             result = await remote_app.read_resource(req.params.uri)
@@ -52,6 +58,7 @@ async def _read_resource(req: types.ReadResourceRequest) -> types.ServerResult:
         app.request_handlers[types.ReadResourceRequest] = _read_resource
 
     if capabilities.logging:
+        logger.debug("Capabilities: adding Logging...")
 
         async def _set_logging_level(req: types.SetLevelRequest) -> types.ServerResult:
             await remote_app.set_logging_level(req.params.level)
@@ -60,6 +67,7 @@ async def _set_logging_level(req: types.SetLevelRequest) -> types.ServerResult:
         app.request_handlers[types.SetLevelRequest] = _set_logging_level
 
     if capabilities.resources:
+        logger.debug("Capabilities: adding Resources...")
 
         async def _subscribe_resource(req: types.SubscribeRequest) -> types.ServerResult:
             await remote_app.subscribe_resource(req.params.uri)
@@ -74,6 +82,7 @@ async def _unsubscribe_resource(req: types.UnsubscribeRequest) -> types.ServerRe
         app.request_handlers[types.UnsubscribeRequest] = _unsubscribe_resource
 
     if capabilities.tools:
+        logger.debug("Capabilities: adding Tools...")
 
         async def _list_tools(_: t.Any) -> types.ServerResult:  # noqa: ANN401
             tools = await remote_app.list_tools()
```

**File**: `src/mcp_proxy/sse_server.py` (modified, +9/-0)
```diff
@@ -1,5 +1,6 @@
 """Create a local SSE server that proxies requests to a stdio MCP server."""
 
+import logging
 from dataclasses import dataclass
 from typing import Literal
 
@@ -16,6 +17,8 @@
 
 from .proxy_server import create_proxy_server
 
+logger = logging.getLogger(__name__)
+
 
 @dataclass
 class SseServerSettings:
@@ -81,6 +84,7 @@ async def run_sse_server(
 
     """
     async with stdio_client(stdio_params) as streams, ClientSession(*streams) as session:
+        logger.debug("Starting proxy server...")
         mcp_server = await create_proxy_server(session)
 
         # Bind SSE request handling to MCP server
@@ -98,4 +102,9 @@ async def run_sse_server(
             log_level=sse_settings.log_level.lower(),
         )
         http_server = uvicorn.Server(config)
+        logger.debug(
+            "Serving incoming requests on %s:%s",
+            sse_settings.bind_host,
+            sse_settings.port,
+        )
         await http_server.serve()
```

#### Recent Merged Pull Requests:
- **PR #239** (closed): fix: forward pagination params in proxy list handlers (@quocanh261997)
- **PR #228** (closed): HTTP/HTTPS Proxy support (@krypt-lx)
- **PR #223** (closed): build(deps): bump the actions group across 1 directory with 8 updates (@dependabot[bot])
- **PR #222** (closed): build(deps): bump the actions group across 1 directory with 7 updates (@dependabot[bot])
- **PR #220** (closed): fix: tolerate unknown server notifications instead of crashing TaskGroup (@auroracapital)
- **PR #217** (closed): build(deps): bump the actions group across 1 directory with 5 updates (@dependabot[bot])
- **PR #215** (closed): build(deps): bump codecov/codecov-action from 6.0.0 to 6.0.1 in the actions group (@dependabot[bot])
- **PR #212** (2026-05-14): build: bump tooling (@sparfenyuk)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
