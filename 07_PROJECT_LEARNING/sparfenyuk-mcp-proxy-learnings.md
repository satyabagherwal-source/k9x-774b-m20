# Forensic Learning Record (Deep Inspection): sparfenyuk/mcp-proxy

> **Canonical Artifact**: `07_PROJECT_LEARNING/sparfenyuk-mcp-proxy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sparfenyuk/mcp-proxy](https://github.com/sparfenyuk/mcp-proxy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:08:26.740Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sparfenyuk/mcp-proxy`
- **Description**: A bridge between Streamable HTTP and stdio MCP transports
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2771 stars

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
        help="Host to expose an SSE server on. Default is 127.0.0.1",
    )
    mcp_server_group.add_argument(
        "--stateless",
        action=argparse.BooleanOptionalAction,
        help="Enable stateless mode for streamable http transports. Default is False",
        default=False,
    )
    mcp_server_group.add_argument(
        "--sse-port",
        type=int,
        default=0,
        help="(deprecated) Same as --port",
    )
    mcp_server_group.add_argument(
        "--sse-host",
        default="127.0.0.1",
        help="(deprecated) Same as --host",
    )
    mcp_server_group.add_argument(
        "--allow-origin",
        nargs="+",
        default=[],
        help=(
            "Allowed origins for the SSE server. Can be used multiple times. "
            "Default is no CORS allowed."
        ),
    )
    mcp_server_group.add_argument(
        "--expose-header",
        action="append",
        dest="expose_headers",
        metavar="HEADER",
        default=None,
        help=(
            "Headers to expose via Access-Control-Expose-Headers. "
            "Defaults to 'Mcp-Session-Id'. Can be used multiple times."
        ),
    )


def _setup_logging(*, level: str, debug: bool) -> logging.Logger:
    """Set up logging configuration and return the logger."""
    logging.basicConfig(
        level=logging.DEBUG if debug else level,
        format="[%(levelname)1.1s %(asctime)s.%(msecs).03d %(name)s] %(message)s",
    )
    return logging.getLogger(__name__)


def _handle_sse_client_mode(
    args_parsed: argparse.Namespace,
    logger: logging.Logger,
    verify_ssl: bool | str | None = None,
) -> None:
    """Handle SSE/StreamableHTTP client mode operation."""
    if args_parsed.named_server_definitions:
        logger.warning(
            "--named-server arguments are ignored when command_or_url is an HTTP/HTTPS URL "
            "(SSE/StreamableHTTP client mode).",
        )
    # Start a client connected to the SSE server, and expose as a stdio server
    logger.debug("Starting
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
            await stack.enter_async_context(
                http_manager_named.run(),
            )  # Manage lifespan by calling run()

            # Mount these routes under /servers/<name>/
            server_mount = Mount(f"/servers/{name}", routes=instance_routes_named)
            all_routes.append(server_mount)
            _global_status["server_instances"][name] = "configured"

        if not default_server_params and not named_server_params:
            logger.error("No servers configured to run.")
            return

        middleware: list[Middleware] = []
        if mcp_settings.allow_origins:
            middleware.append(
                Middleware(
                    CORSMiddleware,
                    allow_origins=mcp_settings.allow_origins,
                    allow_methods=["*"],
                    allow_headers=["*"],
                    expose_headers=mcp_settings.expose_headers,
                ),
            )

        starlette_app = Starlette(
            debug=(mcp_settings.log_level == "DEBUG"),
            routes=all_routes,
            middleware=middleware,
            lifespan=combined_lifespan,
        )

        starlette_app.router.redirect_slashes = False

        config = uvicorn.Config(
            starlette_app,
            host=mcp_settings.bind_host,
            port=mcp_settings.port,
            log_level=mcp_settings.log_level.lower(),
        )
        http_server = uvicorn.Server(config)

        # Print out the SSE URLs for all configured servers
        base_url = f"http://{mcp_settings.bind_host}:{mcp_settings.port}"
        sse_urls = []

        # Add default server if configured
        if default_server_params:
            sse_urls.append(f"{base_url}/sse")

        # Add named servers
        sse_urls.extend([f"{base_url}/servers/{name}/sse" for name in named_server_params])

        # Display the SSE URLs prominently
        if sse_urls:
            # Using print directly for user visibility, with noqa to ignore linte
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

### Incident Patch 1: `20b547bb` (2026-05-14)
**Commit Message**: build: bump tooling

**File**: `.pre-commit-config.yaml` (modified, +2/-2)
```diff
@@ -2,15 +2,15 @@
 # See https://pre-commit.com/hooks.html for more hooks
 repos:
     - repo: https://github.com/pre-commit/pre-commit-hooks
-      rev: v5.0.0
+      rev: v6.0.0
       hooks:
           - id: trailing-whitespace
           - id: end-of-file-fixer
           - id: check-yaml
           - id: check-added-large-files
     - repo: https://github.com/astral-sh/ruff-pre-commit
       # Ruff version.
-      rev: v0.11.5
+      rev: v0.15.13
       hooks:
           # Run the linter.
           - id: ruff
```

**File**: `pyproject.toml` (modified, +9/-7)
```diff
@@ -28,7 +28,7 @@ classifiers = [
 ]
 version = "0.12.0"
 requires-python = ">=3.10"
-dependencies = ["httpx-auth>=0.22.0", "mcp>=1.17.0", "uvicorn>=0.34.0"]
+dependencies = ["httpx-auth>=0.23.1", "mcp>=1.27.1", "uvicorn>=0.47.0"]
 
 [build-system]
 requires = ["setuptools"]
@@ -47,12 +47,12 @@ mcp-reverse-proxy = "mcp_proxy.__main__:client"
 [tool.setuptools.package-data]
 "*" = ["py.typed"]
 
-[tool.uv]
-dev-dependencies = [
-    "pytest>=8.3.3",
-    "pytest-asyncio>=0.25.0",
-    "coverage>=7.6.0",
-    "mypy>=1.0.0",
+[dependency-groups]
+dev = [
+    "pytest>=9.0.3",
+    "pytest-asyncio>=1.3.0",
+    "coverage>=7.14.0",
+    "mypy>=2.1.0",
 ]
 
 [tool.coverage.run]
@@ -93,7 +93,9 @@ warn_unused_ignores = true
 [tool.ruff.lint]
 select = ["ALL"]
 ignore = [
+    "COM812", # Missing trailing comma (conflicts with formatter)
     "EM101",  # Exception must not use a string literal, assign to variable first
+    "FBT001", # Boolean-typed function arguments are used for httpx-compatible verify options
     "TRY003", # Avoid specifying long messages outside the exception class
     "ERA001", # Found commented-out code
 ]
```

**File**: `src/mcp_proxy/__main__.py` (modified, +1/-1)
```diff
@@ -355,7 +355,7 @@ def _configure_default_server(
         command=args_parsed.command_or_url,
         args=args_parsed.args,
         env=default_server_env,
-        cwd=args_parsed.cwd if args_parsed.cwd else None,
+        cwd=args_parsed.cwd or None,
     )
     logger.info(
         "Configured default server: %s %s",
```

**File**: `tests/test_mcp_server.py` (modified, +10/-10)
```diff
@@ -330,7 +330,7 @@ async def test_run_mcp_server_with_named_servers(
         patch("mcp_proxy.mcp_server.logger") as mock_logger,
     ):
         # Setup mocks
-        mock_stdio_context, mock_session_context, mock_session, mock_http_manager, mock_routes = (
+        mock_stdio_context, mock_session_context, _, mock_http_manager, mock_routes = (
             setup_async_context_mocks()
         )
         mock_stdio_client.return_value = mock_stdio_context
@@ -387,7 +387,7 @@ async def test_run_mcp_server_with_cors_middleware(
         patch("uvicorn.Server") as mock_uvicorn_server,
     ):
         # Setup mocks
-        mock_stdio_context, mock_session_context, mock_session, mock_http_manager, mock_routes = (
+        mock_stdio_context, mock_session_context, _, mock_http_manager, mock_routes = (
             setup_async_context_mocks()
         )
         mock_stdio_client.return_value = mock_stdio_context
@@ -435,7 +435,7 @@ async def test_run_mcp_server_custom_expose_headers(
         (
             mock_stdio_context,
             mock_session_context,
-            mock_session,
+            _,
             mock_http_manager,
             mock_routes,
         ) = setup_async_context_mocks()
@@ -476,7 +476,7 @@ async def test_run_mcp_server_debug_mode(
         patch("uvicorn.Server") as mock_uvicorn_server,
     ):
         # Setup mocks
-        mock_stdio_context, mock_session_context, mock_session, mock_http_manager, mock_routes = (
+        mock_stdio_context, mock_session_context, _, mock_http_manager, mock_routes = (
             setup_async_context_mocks()
         )
         mock_stdio_client.return_value = mock_stdio_context
@@ -516,7 +516,7 @@ async def test_run_mcp_server_stateless_mode(
         patch("uvicorn.Server") as mock_uvicorn_server,
     ):
         # Setup mocks
-        mock_stdio_context, mock_session_context, mock_session, mock_http_manager, mock_routes = (
+        mock_stdio_context, mock_session_context, _, mock_http_manager, mock_routes = (
             setup_async_context_mocks()
         )
         mock_stdio_client.return_value = mock_stdio_context
@@ -553,7 +553,7 @@ async def test_run_mcp_server_uvicorn_config(
         patch("uvicorn.Server") as mock_uvicorn_server,
     ):
         # Setup mocks
-        mock_stdio_context, mock_session_context, mock_session, mock_http_manager, mock_routes = (
+        mock_stdio_context, mock_session_context, _, mock_http_manager, mock_routes = (
             setup_async_context_mocks()
         )
         mock_stdio_client.return_value = mock_stdio_context
@@ -586,7 +586,7 @@ async def test_run_mcp_server_global_status_updates(
     mock_stdio_params: StdioServerParameters,
 ) -> None:
     """Test run_mcp_server updates global status correctly."""
-    from mcp_proxy.mcp_server import _global_status
+    from mcp_proxy.mcp_server import _global_status  # noqa: PLC0415
 
     # Clear global status before test
     _global_status["server_instances"].clear()
@@ -601,7 +601,7 @@ async def test_run_mcp_server_global_status_updates(
         patch("uvicorn.Server") as mock_uvicorn_server,
     ):
         # Setup mocks
-        mock_stdio_context, mock_session_context, mock_session, mock_http_manager, mock_routes = (
+        mock_stdio_context, mock_session_context, _, mock_http_manager, mock_routes = (
             setup_async_context_mocks()
         )
         mock_stdio_client.return_value = mock_stdio_context
@@ -640,7 +640,7 @@ async def test_run_mcp_server_sse_url_logging(
         patch("mcp_proxy.mcp_server.logger") as mock_logger,
     ):
         # Setup mocks
-        mock_stdio_context, mock_session_context, mock_session, mock_http_manager, mock_routes = (
+        mock_stdio_context, mock_session_context, _, mock_http_manager, mock_routes = (
             setup_async_context_mocks()
         )
         mock_stdio_client.return_value = mock_stdio_context
@@ -703,7 +703,7 @@ async def test_run_mcp_server_both_default_and_named_servers(
         patch("mcp_proxy.mcp_server.logger") as mock_logger,
     ):
         # Setup mocks
-        mock_stdio_context, mock_session_context, mock_session, mock_http_manager, mock_routes = (
+        mock_stdio_context, mock_session_context, _, mock_http_manager, mock_routes = (
             setup_async_context_mocks()
         )
         mock_stdio_client.return_value = mock_stdio_context
```

---

### Incident Patch 2: `51002a84` (2026-05-14)
**Commit Message**: docs: udpate readme about images built

**File**: `README.md` (modified, +5/-2)
```diff
@@ -248,10 +248,13 @@ uv tool install git+https://github.com/sparfenyuk/mcp-proxy
 
 ### Installing as container
 
-Starting from version 0.3.2, it's possible to pull and run the corresponding container image:
+Starting from version 0.3.2, it's possible to pull and run the corresponding container image.
+Release images are published to GHCR and Docker Hub as multi-platform manifests for `linux/amd64` and `linux/arm64`;
+Docker selects the matching image for the host architecture automatically.
 
 ```bash
-docker run --rm -t ghcr.io/sparfenyuk/mcp-proxy:v0.3.2-alpine --help
+docker run --rm -t ghcr.io/sparfenyuk/mcp-proxy:v0.12.0 --help
+docker run --rm -t sparfenyuk/mcp-proxy:v0.12.0 --help
 ```
 
 ### Troubleshooting
```

---

### Incident Patch 3: `03aa8982` (2026-05-12)
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

### Incident Patch 4: `5cb4b5d3` (2026-05-14)
**Commit Message**: build(deps): bump mcp from 1.26.0 to 1.27.1

Bumps [mcp](https://github.com/modelcontextprotocol/python-sdk) from 1.26.0 to 1.27.1.
- [Release notes](https://github.com/modelcontextprotocol/python-sdk/releases)
- [Changelog](https://github.com/modelcontextprotocol/python-sdk/blob/main/RELEASE.md)
- [Commits](https://github.com/modelcontextprotocol/python-sdk/compare/v1.26.0...v1.27.1)

---
updated-dependencies:
- dependency-name: mcp
  dependency-version: 1.27.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -432,7 +432,7 @@ wheels = [
 
 [[package]]
 name = "mcp"
-version = "1.26.0"
+version = "1.27.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "anyio" },
@@ -450,9 +450,9 @@ dependencies = [
     { name = "typing-inspection" },
     { name = "uvicorn", marker = "sys_platform != 'emscripten'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/fc/6d/62e76bbb8144d6ed86e202b5edd8a4cb631e7c8130f3f4893c3f90262b10/mcp-1.26.0.tar.gz", hash = "sha256:db6e2ef491eecc1a0d93711a76f28dec2e05999f93afd48795da1c1137142c66", size = 608005, upload-time = "2026-01-24T19:40:32.468Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/38/83/d1efe7c2980d8a3afa476f4e3d42d53dd54c0ab94c27bee5d755b45c8b73/mcp-1.27.1.tar.gz", hash = "sha256:0f47e1820f8f8f941466b39749eb1d1839a04caddca2bc60e9d46e8a99914924", size = 608458, upload-time = "2026-05-08T16:50:12.601Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/fd/d9/eaa1f80170d2b7c5ba23f3b59f766f3a0bb41155fbc32a69adfa1adaaef9/mcp-1.26.0-py3-none-any.whl", hash = "sha256:904a21c33c25aa98ddbeb47273033c435e595bbacfdb177f4bd87f6dceebe1ca", size = 233615, upload-time = "2026-01-24T19:40:30.652Z" },
+    { url = "https://files.pythonhosted.org/packages/fd/73/42d9596facebdb533b7f0b86c1b0364ef350d1f8ba78b1052e8a58b48b65/mcp-1.27.1-py3-none-any.whl", hash = "sha256:1af3c4203b329430fde7a87b4fcb6392a041f5cb851fd68fc674016ab4e7c06f", size = 216260, upload-time = "2026-05-08T16:50:10.547Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 5: `d68491ea` (2026-05-14)
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
+    Strategy: Mock the remote_app.call_tool to capture the progress_callback
+    parameter and verify it's None when no progressToken is present.
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
+            call_tool_spy = AsyncMock(side_effect=o
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
+        await session.initialize()
+
+        tool_callback.return_value = [
+            types.TextContent(type="text", text="Tool executed without meta"),
+        ]
+
+        # Call the tool without meta parameter
+        call_tool_result = await session.call_tool("tool", {"input1": "test-value"})
+
+        # Verify the tool was called successfully
+        assert not call_tool_result.isError
+        assert len(call_tool_result.content) == 1
+        assert call_tool_result.content[0].text == "Tool executed without meta"
+
+        # Verify the tool callback was called
+        tool_callback.assert_called_once()
+        call_args = tool_callback.call_args
+        assert call_args[0][0] == "tool"  # name
+        assert call_args[0][1] == {"input1": "test-value"}  # arguments
+        # _context (third arg) may be None or an object depending on mode
+        tool_callback.reset_mock()
+
+
+@pytest.mark.parametrize("tool_callback", [AsyncMock()])
+async def test_call_tool_with_none_meta_parameter(
+   
```

---

### Incident Patch 6: `0f1154a8` (2026-05-05)
**Commit Message**: build(deps): bump the actions group across 1 directory with 7 updates

Bumps the actions group with 7 updates in the / directory:

| Package | From | To |
| --- | --- | --- |
| [docker/login-action](https://github.com/docker/login-action) | `4.0.0` | `4.1.0` |
| [docker/build-push-action](https://github.com/docker/build-push-action) | `7.0.0` | `7.1.0` |
| [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv) | `7.4.0` | `8.1.0` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact) | `7.0.0` | `7.0.1` |
| [codecov/codecov-action](https://github.com/codecov/codecov-action) | `5.5.2` | `6.0.0` |
| [pypa/gh-action-pypi-publish](https://github.com/pypa/gh-action-pypi-publish) | `1.13.0` | `1.14.0` |
| [dependabot/fetch-metadata](https://github.com/dependabot/fetch-metadata) | `2` | `3` |



Updates `docker/login-action` from 4.0.0 to 4.1.0
- [Release notes](https://github.com/docker/login-action/releases)
- [Commits](https://github.com/docker/login-action/compare/b45d80f862d83dbcd57f89517bcf500b2ab88fb2...4907a6ddec9925e35a0a9e82d7399ccc52663121)

Updates `docker/build-push-action` from 7.0.0 to 7.1.0
- [Release notes](https://github.com/docker/build-push-acti

**File**: `.github/workflows/cd.yaml` (modified, +4/-4)
```diff
@@ -51,14 +51,14 @@ jobs:
             org.opencontainers.image.base.name=docker.io/library/python:3.13-alpine
 
       - name: Log in to Docker Hub
-        uses: docker/login-action@b45d80f862d83dbcd57f89517bcf500b2ab88fb2 # v4.0.0
+        uses: docker/login-action@4907a6ddec9925e35a0a9e82d7399ccc52663121 # v4.1.0
         if: github.event_name != 'pull_request'
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
           password: ${{ secrets.DOCKER_PASSWORD }}
 
       - name: Build and push Docker image
-        uses: docker/build-push-action@d08e5c354a6adb9ed34480a06d141179aa583294 # v7.0.0
+        uses: docker/build-push-action@bcafcacb16a39f128d818304e6c9c0c18556b85f # v7.1.0
         with:
           context: .
           platforms: linux/amd64,linux/arm64
@@ -108,15 +108,15 @@ jobs:
             org.opencontainers.image.base.name=docker.io/library/python:3.13-alpine
 
       - name: Log in to GHCR
-        uses: docker/login-action@b45d80f862d83dbcd57f89517bcf500b2ab88fb2 # v4.0.0
+        uses: docker/login-action@4907a6ddec9925e35a0a9e82d7399ccc52663121 # v4.1.0
         if: github.event_name != 'pull_request'
         with:
           registry: ghcr.io
           username: ${{ github.actor }}
           password: ${{ secrets.GITHUB_TOKEN }}
 
       - name: Build and push Docker image
-        uses: docker/build-push-action@d08e5c354a6adb9ed34480a06d141179aa583294 # v7.0.0
+        uses: docker/build-push-action@bcafcacb16a39f128d818304e6c9c0c18556b85f # v7.1.0
         with:
           context: .
           platforms: linux/amd64,linux/arm64
```

**File**: `.github/workflows/ci.yaml` (modified, +8/-8)
```diff
@@ -22,7 +22,7 @@ jobs:
     steps:
       - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
-      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
+      - uses: astral-sh/setup-uv@08807647e7069bb48b6ef5acd8ec9567f424441b # v8.1.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -43,7 +43,7 @@ jobs:
     steps:
       - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
-      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
+      - uses: astral-sh/setup-uv@08807647e7069bb48b6ef5acd8ec9567f424441b # v8.1.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -64,7 +64,7 @@ jobs:
     steps:
       - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
-      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
+      - uses: astral-sh/setup-uv@08807647e7069bb48b6ef5acd8ec9567f424441b # v8.1.0
         with:
           python-version: ${{ matrix.python-version }}
 
@@ -75,7 +75,7 @@ jobs:
           COVERAGE_FILE: coverage/.coverage.${{ runner.os }}-py${{ matrix.python-version }}-standard
 
       - name: store coverage files
-        uses: actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f # v7.0.0
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
         with:
           name: coverage-${{ matrix.python-version }}
           path: coverage
@@ -93,7 +93,7 @@ jobs:
           merge-multiple: true
           path: coverage
 
-      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
+      - uses: astral-sh/setup-uv@08807647e7069bb48b6ef5acd8ec9567f424441b # v8.1.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -102,7 +102,7 @@ jobs:
       - run: uv run --frozen coverage xml
 
       - name: Upload coverage reports to Codecov
-        uses: codecov/codecov-action@671740ac38dd9b0130fbe1cec585b89eea48d3de # v5.5.2
+        uses: codecov/codecov-action@57e3a136b779b570ffcdbf80b3bdc90e7fab3de2 # v6.0.0
         with:
           token: ${{ secrets.CODECOV_TOKEN }}
 
@@ -133,7 +133,7 @@ jobs:
     steps:
       - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
-      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
+      - uses: astral-sh/setup-uv@08807647e7069bb48b6ef5acd8ec9567f424441b # v8.1.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -145,6 +145,6 @@ jobs:
       - run: uv build
 
       - name: Publish to PyPI
-        uses: pypa/gh-action-pypi-publish@ed0c53931b1dc9bd32cbe73a98c7f6766f8a527e # v1.13.0
+        uses: pypa/gh-action-pypi-publish@cef221092ed1bacb1cc03d23a2d87d1d172e277b # v1.14.0
         with:
           skip-existing: true
```

**File**: `.github/workflows/dependabot.yml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ jobs:
     steps:
       - name: Fetch metadata
         id: metadata
-        uses: dependabot/fetch-metadata@v2
+        uses: dependabot/fetch-metadata@v3
         with:
           github-token: "${{ secrets.GITHUB_TOKEN }}"
       - name: Auto-merge Patch PRs
```

---

### Incident Patch 7: `032a0197` (2026-05-02)
**Commit Message**: build(deps): bump uvicorn from 0.41.0 to 0.46.0 (#191)

Bumps [uvicorn](https://github.com/Kludex/uvicorn) from 0.41.0 to
0.46.0.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/Kludex/uvicorn/releases">uvicorn's
releases</a>.</em></p>
<blockquote>
<h2>Version 0.46.0</h2>
<h2>What's Changed</h2>
<ul>
<li>Support <code>ws_max_size</code> in <code>wsproto</code>
implementation by <a
href="https://github.com/Kludex"><code>@​Kludex</code></a> in <a
href="https://redirect.github.com/Kludex/uvicorn/pull/2915">Kludex/uvicorn#2915</a></li>
<li>Support <code>ws_ping_interval</code> and
<code>ws_ping_timeout</code> in <code>wsproto</code> implementation by
<a href="https://github.com/Kludex"><code>@​Kludex</code></a> in <a
href="https://redirect.github.com/Kludex/uvicorn/pull/2916">Kludex/uvicorn#2916</a></li>
<li>Use <code>bytearray</code> for incoming WebSocket message buffer in
websockets-sansio by <a
href="https://github.com/Kludex"><code>@​Kludex</code></a> in <a
href="https://redirect.github.com/Kludex/uvicorn/pull/2917">Kludex/uvicorn#2917</a></li>
</ul>
<p><strong>Full Changelog</strong>: <a
href="https://github.com/Kludex/uvicorn/compare/0.

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -1061,14 +1061,14 @@ wheels = [
 
 [[package]]
 name = "uvicorn"
-version = "0.41.0"
+version = "0.46.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "click" },
     { name = "h11" },
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/32/ce/eeb58ae4ac36fe09e3842eb02e0eb676bf2c53ae062b98f1b2531673efdd/uvicorn-0.41.0.tar.gz", hash = "sha256:09d11cf7008da33113824ee5a1c6422d89fbc2ff476540d69a34c87fab8b571a", size = 82633, upload-time = "2026-02-16T23:07:24.1Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/1f/93/041fca8274050e40e6791f267d82e0e2e27dd165627bd640d3e0e378d877/uvicorn-0.46.0.tar.gz", hash = "sha256:fb9da0926999cc6cb22dc7cd71a94a632f078e6ae47ff683c5c420750fb7413d", size = 88758, upload-time = "2026-04-23T07:16:00.151Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/83/e4/d04a086285c20886c0daad0e026f250869201013d18f81d9ff5eada73a88/uvicorn-0.41.0-py3-none-any.whl", hash = "sha256:29e35b1d2c36a04b9e180d4007ede3bcb32a85fbdfd6c6aeb3f26839de088187", size = 68783, upload-time = "2026-02-16T23:07:22.357Z" },
+    { url = "https://files.pythonhosted.org/packages/31/a3/5b1562db76a5a488274b2332a97199b32d0442aca0ed193697fd47786316/uvicorn-0.46.0-py3-none-any.whl", hash = "sha256:bbebbcbed972d162afca128605223022bedd345b7bc7855ce66deb31487a9048", size = 70926, upload-time = "2026-04-23T07:15:58.355Z" },
 ]
```

---

### Incident Patch 8: `b7be2b4a` (2026-03-12)
**Commit Message**: build(deps): bump the uv group across 1 directory with 2 updates

Bumps the uv group with 2 updates in the / directory: [cryptography](https://github.com/pyca/cryptography) and [starlette](https://github.com/Kludex/starlette).


Updates `cryptography` from 46.0.3 to 46.0.5
- [Changelog](https://github.com/pyca/cryptography/blob/main/CHANGELOG.rst)
- [Commits](https://github.com/pyca/cryptography/compare/46.0.3...46.0.5)

Updates `starlette` from 0.48.0 to 0.49.1
- [Release notes](https://github.com/Kludex/starlette/releases)
- [Changelog](https://github.com/Kludex/starlette/blob/main/docs/release-notes.md)
- [Commits](https://github.com/Kludex/starlette/compare/0.48.0...0.49.1)

---
updated-dependencies:
- dependency-name: cryptography
  dependency-version: 46.0.5
  dependency-type: indirect
  dependency-group: uv
- dependency-name: starlette
  dependency-version: 0.49.1
  dependency-type: indirect
  dependency-group: uv
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `uv.lock` (modified, +53/-58)
```diff
@@ -257,67 +257,62 @@ wheels = [
 
 [[package]]
 name = "cryptography"
-version = "46.0.3"
+version = "46.0.5"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "cffi", marker = "platform_python_implementation != 'PyPy'" },
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/9f/33/c00162f49c0e2fe8064a62cb92b93e50c74a72bc370ab92f86112b33ff62/cryptography-46.0.3.tar.gz", hash = "sha256:a8b17438104fed022ce745b362294d9ce35b4c2e45c1d958ad4a4b019285f4a1", size = 749258, upload-time = "2025-10-15T23:18:31.74Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/60/04/ee2a9e8542e4fa2773b81771ff8349ff19cdd56b7258a0cc442639052edb/cryptography-46.0.5.tar.gz", hash = "sha256:abace499247268e3757271b2f1e244b36b06f8515cf27c4d49468fc9eb16e93d", size = 750064, upload-time = "2026-02-10T19:18:38.255Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/1d/42/9c391dd801d6cf0d561b5890549d4b27bafcc53b39c31a817e69d87c625b/cryptography-46.0.3-cp311-abi3-macosx_10_9_universal2.whl", hash = "sha256:109d4ddfadf17e8e7779c39f9b18111a09efb969a301a31e987416a0191ed93a", size = 7225004, upload-time = "2025-10-15T23:16:52.239Z" },
-    { url = "https://files.pythonhosted.org/packages/1c/67/38769ca6b65f07461eb200e85fc1639b438bdc667be02cf7f2cd6a64601c/cryptography-46.0.3-cp311-abi3-manylinux2014_aarch64.manylinux_2_17_aarch64.whl", hash = "sha256:09859af8466b69bc3c27bdf4f5d84a665e0f7ab5088412e9e2ec49758eca5cbc", size = 4296667, upload-time = "2025-10-15T23:16:54.369Z" },
-    { url = "https://files.pythonhosted.org/packages/5c/49/498c86566a1d80e978b42f0d702795f69887005548c041636df6ae1ca64c/cryptography-46.0.3-cp311-abi3-manylinux2014_x86_64.manylinux_2_17_x86_64.whl", hash = "sha256:01ca9ff2885f3acc98c29f1860552e37f6d7c7d013d7334ff2a9de43a449315d", size = 4450807, upload-time = "2025-10-15T23:16:56.414Z" },
-    { url = "https://files.pythonhosted.org/packages/4b/0a/863a3604112174c8624a2ac3c038662d9e59970c7f926acdcfaed8d61142/cryptography-46.0.3-cp311-abi3-manylinux_2_28_aarch64.whl", hash = "sha256:6eae65d4c3d33da080cff9c4ab1f711b15c1d9760809dad6ea763f3812d254cb", size = 4299615, upload-time = "2025-10-15T23:16:58.442Z" },
-    { url = "https://files.pythonhosted.org/packages/64/02/b73a533f6b64a69f3cd3872acb6ebc12aef924d8d103133bb3ea750dc703/cryptography-46.0.3-cp311-abi3-manylinux_2_28_armv7l.manylinux_2_31_armv7l.whl", hash = "sha256:e5bf0ed4490068a2e72ac03d786693adeb909981cc596425d09032d372bcc849", size = 4016800, upload-time = "2025-10-15T23:17:00.378Z" },
-    { url = "https://files.pythonhosted.org/packages/25/d5/16e41afbfa450cde85a3b7ec599bebefaef16b5c6ba4ec49a3532336ed72/cryptography-46.0.3-cp311-abi3-manylinux_2_28_ppc64le.whl", hash = "sha256:5ecfccd2329e37e9b7112a888e76d9feca2347f12f37918facbb893d7bb88ee8", size = 4984707, upload-time = "2025-10-15T23:17:01.98Z" },
-    { url = "https://files.pythonhosted.org/packages/c9/56/e7e69b427c3878352c2fb9b450bd0e19ed552753491d39d7d0a2f5226d41/cryptography-46.0.3-cp311-abi3-manylinux_2_28_x86_64.whl", hash = "sha256:a2c0cd47381a3229c403062f764160d57d4d175e022c1df84e168c6251a22eec", size = 4482541, upload-time = "2025-10-15T23:17:04.078Z" },
-    { url = "https://files.pythonhosted.org/packages/78/f6/50736d40d97e8483172f1bb6e698895b92a223dba513b0ca6f06b2365339/cryptography-46.0.3-cp311-abi3-manylinux_2_34_aarch64.whl", hash = "sha256:549e234ff32571b1f4076ac269fcce7a808d3bf98b76c8dd560e42dbc66d7d91", size = 4299464, upload-time = "2025-10-15T23:17:05.483Z" },
-    { url = "https://files.pythonhosted.org/packages/00/de/d8e26b1a855f19d9994a19c702fa2e93b0456beccbcfe437eda00e0701f2/cryptography-46.0.3-cp311-abi3-manylinux_2_34_ppc64le.whl", hash = "sha256:c0a7bb1a68a5d3471880e264621346c48665b3bf1c3759d682fc0864c540bd9e", size = 4950838, upload-time = "2025-10-15T23:17:07.425Z" },
-    { url = "https://files.pythonhosted.org/packages/8f/29/798fc4ec461a1c9e9f735f2fc58741b0daae30688f41b2497dcbc9ed1355/cryptography-46.0.3-cp311-abi3-manylinux_2_34_x86_64.whl", hash = "sha256:10b01676fc208c3e6feeb25a8b83d81767e8059e1fe86e1dc62d10a3018fa926", size = 4481596, upload-time = "2025-10-15T23:17:09.343Z" },
-    { url = "https://files.pythonhosted.org/packages/15/8d/03cd48b20a573adfff7652b76271078e3045b9f49387920e7f1f631d125e/cryptography-46.0.3-cp311-abi3-musllinux_1_2_aarch64.whl", hash = "sha256:0abf1ffd6e57c67e92af68330d05760b7b7efb243aab8377e583284dbab72c71", size = 4426782, upload-time = "2025-10-15T23:17:11.22Z" },
-    { url = "https://files.pythonhosted.org/packages/fa/b1/ebacbfe53317d55cf33165bda24c86523497a6881f339f9aae5c2e13e57b/cryptography-46.0.3-cp311-abi3-musllinux_1_2_x86_64.whl", hash = "sha256:a04bee9ab6a4da801eb9b51f1b708a1b5b5c9eb48c03f74198464c66f0d344ac", size = 4698381, upload-time = "2025-10-15T23:17:12.829Z" },
-    { url = "https://files.pythonhosted.org/packages/96/92/8a6a9525893325fc057a01f654d7efc2c64b9de90413adcf605a85744ff4/cryptograp
```

---

### Incident Patch 9: `39b176fe` (2026-03-12)
**Commit Message**: build(deps): bump the actions group across 1 directory with 9 updates

Bumps the actions group with 9 updates in the / directory:

| Package | From | To |
| --- | --- | --- |
| [actions/checkout](https://github.com/actions/checkout) | `6.0.1` | `6.0.2` |
| [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) | `3.7.0` | `4.0.0` |
| [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) | `3.12.0` | `4.0.0` |
| [docker/metadata-action](https://github.com/docker/metadata-action) | `5.10.0` | `6.0.0` |
| [docker/login-action](https://github.com/docker/login-action) | `3.6.0` | `4.0.0` |
| [docker/build-push-action](https://github.com/docker/build-push-action) | `6.18.0` | `7.0.0` |
| [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv) | `7.2.0` | `7.3.1` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact) | `6.0.0` | `7.0.0` |
| [actions/download-artifact](https://github.com/actions/download-artifact) | `7.0.0` | `8.0.0` |



Updates `actions/checkout` from 6.0.1 to 6.0.2
- [Release notes](https://github.com/actions/checkout/releases)
- [Changelog](https://github.com/actions/checkout/blob/main/CHANGELOG.md)
- [Commi

**File**: `.github/workflows/cd.yaml` (modified, +12/-12)
```diff
@@ -25,17 +25,17 @@ jobs:
       contents: read
 
     steps:
-      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
       - name: Set up QEMU
-        uses: docker/setup-qemu-action@c7c53464625b32c7a7e944ae62b3e17d2b600130 #v3.7.0
+        uses: docker/setup-qemu-action@ce360397dd3f832beb865e1373c09c0e9f86d70a #v4.0.0
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f #v3.12.0
+        uses: docker/setup-buildx-action@4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd #v4.0.0
 
       - name: Extract tags and labels for Docker
         id: meta
-        uses: docker/metadata-action@c299e40c65443455700f0fdfc63efafe5b349051 # v5.10.0
+        uses: docker/metadata-action@030e881283bb7a6894de51c315a6bfe6a94e05cf # v6.0.0
         with:
           images: sparfenyuk/mcp-proxy
           tags: |
@@ -51,14 +51,14 @@ jobs:
             org.opencontainers.image.base.name=docker.io/library/python:3.13-alpine
 
       - name: Log in to Docker Hub
-        uses: docker/login-action@5e57cd118135c172c3672efd75eb46360885c0ef # v3.6.0
+        uses: docker/login-action@b45d80f862d83dbcd57f89517bcf500b2ab88fb2 # v4.0.0
         if: github.event_name != 'pull_request'
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
           password: ${{ secrets.DOCKER_PASSWORD }}
 
       - name: Build and push Docker image
-        uses: docker/build-push-action@263435318d21b8e681c14492fe198d362a7d2c83 # v6.18.0
+        uses: docker/build-push-action@d08e5c354a6adb9ed34480a06d141179aa583294 # v7.0.0
         with:
           context: .
           platforms: linux/amd64,linux/arm64
@@ -82,17 +82,17 @@ jobs:
       packages: write
 
     steps:
-      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
       - name: Set up QEMU
-        uses: docker/setup-qemu-action@c7c53464625b32c7a7e944ae62b3e17d2b600130 #v3.7.0
+        uses: docker/setup-qemu-action@ce360397dd3f832beb865e1373c09c0e9f86d70a #v4.0.0
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f #v3.12.0
+        uses: docker/setup-buildx-action@4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd #v4.0.0
 
       - name: Extract tags and labels for Docker
         id: meta
-        uses: docker/metadata-action@c299e40c65443455700f0fdfc63efafe5b349051 # v5.10.0
+        uses: docker/metadata-action@030e881283bb7a6894de51c315a6bfe6a94e05cf # v6.0.0
         with:
           images: ghcr.io/sparfenyuk/mcp-proxy
           tags: |
@@ -108,15 +108,15 @@ jobs:
             org.opencontainers.image.base.name=docker.io/library/python:3.13-alpine
 
       - name: Log in to GHCR
-        uses: docker/login-action@5e57cd118135c172c3672efd75eb46360885c0ef # v3.6.0
+        uses: docker/login-action@b45d80f862d83dbcd57f89517bcf500b2ab88fb2 # v4.0.0
         if: github.event_name != 'pull_request'
         with:
           registry: ghcr.io
           username: ${{ github.actor }}
           password: ${{ secrets.GITHUB_TOKEN }}
 
       - name: Build and push Docker image
-        uses: docker/build-push-action@263435318d21b8e681c14492fe198d362a7d2c83 # v6.18.0
+        uses: docker/build-push-action@d08e5c354a6adb9ed34480a06d141179aa583294 # v7.0.0
         with:
           context: .
           platforms: linux/amd64,linux/arm64
```

**File**: `.github/workflows/ci.yaml` (modified, +12/-12)
```diff
@@ -20,9 +20,9 @@ jobs:
   lint:
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
-      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
+      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -41,9 +41,9 @@ jobs:
   mypy:
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
-      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
+      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -62,9 +62,9 @@ jobs:
       matrix:
         python-version: ["3.10", "3.11", "3.12", "3.13", "3.14", "3.14t"]
     steps:
-      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
-      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
+      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
         with:
           python-version: ${{ matrix.python-version }}
 
@@ -75,7 +75,7 @@ jobs:
           COVERAGE_FILE: coverage/.coverage.${{ runner.os }}-py${{ matrix.python-version }}-standard
 
       - name: store coverage files
-        uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6.0.0
+        uses: actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f # v7.0.0
         with:
           name: coverage-${{ matrix.python-version }}
           path: coverage
@@ -85,15 +85,15 @@ jobs:
     runs-on: ubuntu-latest
     needs: [test]
     steps:
-      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
       - name: get coverage files
-        uses: actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7.0.0
+        uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
         with:
           merge-multiple: true
           path: coverage
 
-      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
+      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -131,9 +131,9 @@ jobs:
       id-token: write
 
     steps:
-      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
 
-      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
+      - uses: astral-sh/setup-uv@6ee6290f1cbc4156c0bdd66691b2c144ef8df19a # v7.4.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
```

---

### Incident Patch 10: `a7133a8c` (2026-03-12)
**Commit Message**: build(deps): bump uvicorn from 0.40.0 to 0.41.0

Bumps [uvicorn](https://github.com/Kludex/uvicorn) from 0.40.0 to 0.41.0.
- [Release notes](https://github.com/Kludex/uvicorn/releases)
- [Changelog](https://github.com/Kludex/uvicorn/blob/main/docs/release-notes.md)
- [Commits](https://github.com/Kludex/uvicorn/compare/0.40.0...0.41.0)

---
updated-dependencies:
- dependency-name: uvicorn
  dependency-version: 0.41.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -1066,14 +1066,14 @@ wheels = [
 
 [[package]]
 name = "uvicorn"
-version = "0.40.0"
+version = "0.41.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "click" },
     { name = "h11" },
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/c3/d1/8f3c683c9561a4e6689dd3b1d345c815f10f86acd044ee1fb9a4dcd0b8c5/uvicorn-0.40.0.tar.gz", hash = "sha256:839676675e87e73694518b5574fd0f24c9d97b46bea16df7b8c05ea1a51071ea", size = 81761, upload-time = "2025-12-21T14:16:22.45Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/32/ce/eeb58ae4ac36fe09e3842eb02e0eb676bf2c53ae062b98f1b2531673efdd/uvicorn-0.41.0.tar.gz", hash = "sha256:09d11cf7008da33113824ee5a1c6422d89fbc2ff476540d69a34c87fab8b571a", size = 82633, upload-time = "2026-02-16T23:07:24.1Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/3d/d8/2083a1daa7439a66f3a48589a57d576aa117726762618f6bb09fe3798796/uvicorn-0.40.0-py3-none-any.whl", hash = "sha256:c6c8f55bc8bf13eb6fa9ff87ad62308bbbc33d0b67f84293151efe87e0d5f2ee", size = 68502, upload-time = "2025-12-21T14:16:21.041Z" },
+    { url = "https://files.pythonhosted.org/packages/83/e4/d04a086285c20886c0daad0e026f250869201013d18f81d9ff5eada73a88/uvicorn-0.41.0-py3-none-any.whl", hash = "sha256:29e35b1d2c36a04b9e180d4007ede3bcb32a85fbdfd6c6aeb3f26839de088187", size = 68783, upload-time = "2026-02-16T23:07:22.357Z" },
 ]
```

---

### Incident Patch 11: `9ab35452` (2026-01-26)
**Commit Message**: build(deps): bump python-multipart in the uv group across 1 directory

Bumps the uv group with 1 update in the / directory: [python-multipart](https://github.com/Kludex/python-multipart).


Updates `python-multipart` from 0.0.20 to 0.0.22
- [Release notes](https://github.com/Kludex/python-multipart/releases)
- [Changelog](https://github.com/Kludex/python-multipart/blob/master/CHANGELOG.md)
- [Commits](https://github.com/Kludex/python-multipart/compare/0.0.20...0.0.22)

---
updated-dependencies:
- dependency-name: python-multipart
  dependency-version: 0.0.22
  dependency-type: indirect
  dependency-group: uv
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -792,11 +792,11 @@ wheels = [
 
 [[package]]
 name = "python-multipart"
-version = "0.0.20"
+version = "0.0.22"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/f3/87/f44d7c9f274c7ee665a29b885ec97089ec5dc034c7f3fafa03da9e39a09e/python_multipart-0.0.20.tar.gz", hash = "sha256:8dd0cab45b8e23064ae09147625994d090fa46f5b0d1e13af944c331a7fa9d13", size = 37158, upload-time = "2024-12-16T19:45:46.972Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/94/01/979e98d542a70714b0cb2b6728ed0b7c46792b695e3eaec3e20711271ca3/python_multipart-0.0.22.tar.gz", hash = "sha256:7340bef99a7e0032613f56dc36027b959fd3b30a787ed62d310e951f7c3a3a58", size = 37612, upload-time = "2026-01-25T10:15:56.219Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/45/58/38b5afbc1a800eeea951b9285d3912613f2603bdf897a4ab0f4bd7f405fc/python_multipart-0.0.20-py3-none-any.whl", hash = "sha256:8a62d3a8335e06589fe01f2a3e178cdcc632f3fbe0d492ad9ee0ec35aab1f104", size = 24546, upload-time = "2024-12-16T19:45:44.423Z" },
+    { url = "https://files.pythonhosted.org/packages/1b/d0/397f9626e711ff749a95d96b7af99b9c566a9bb5129b8e4c10fc4d100304/python_multipart-0.0.22-py3-none-any.whl", hash = "sha256:2b2cd894c83d21bf49d702499531c7bafd057d730c201782048f7945d82de155", size = 24579, upload-time = "2026-01-25T10:15:54.811Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 12: `bf58f030` (2026-01-26)
**Commit Message**: build(deps): bump mcp from 1.25.0 to 1.26.0

Bumps [mcp](https://github.com/modelcontextprotocol/python-sdk) from 1.25.0 to 1.26.0.
- [Release notes](https://github.com/modelcontextprotocol/python-sdk/releases)
- [Changelog](https://github.com/modelcontextprotocol/python-sdk/blob/main/RELEASE.md)
- [Commits](https://github.com/modelcontextprotocol/python-sdk/compare/v1.25.0...v1.26.0)

---
updated-dependencies:
- dependency-name: mcp
  dependency-version: 1.26.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -437,7 +437,7 @@ wheels = [
 
 [[package]]
 name = "mcp"
-version = "1.25.0"
+version = "1.26.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "anyio" },
@@ -455,9 +455,9 @@ dependencies = [
     { name = "typing-inspection" },
     { name = "uvicorn", marker = "sys_platform != 'emscripten'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/d5/2d/649d80a0ecf6a1f82632ca44bec21c0461a9d9fc8934d38cb5b319f2db5e/mcp-1.25.0.tar.gz", hash = "sha256:56310361ebf0364e2d438e5b45f7668cbb124e158bb358333cd06e49e83a6802", size = 605387, upload-time = "2025-12-19T10:19:56.985Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/fc/6d/62e76bbb8144d6ed86e202b5edd8a4cb631e7c8130f3f4893c3f90262b10/mcp-1.26.0.tar.gz", hash = "sha256:db6e2ef491eecc1a0d93711a76f28dec2e05999f93afd48795da1c1137142c66", size = 608005, upload-time = "2026-01-24T19:40:32.468Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/e2/fc/6dc7659c2ae5ddf280477011f4213a74f806862856b796ef08f028e664bf/mcp-1.25.0-py3-none-any.whl", hash = "sha256:b37c38144a666add0862614cc79ec276e97d72aa8ca26d622818d4e278b9721a", size = 233076, upload-time = "2025-12-19T10:19:55.416Z" },
+    { url = "https://files.pythonhosted.org/packages/fd/d9/eaa1f80170d2b7c5ba23f3b59f766f3a0bb41155fbc32a69adfa1adaaef9/mcp-1.26.0-py3-none-any.whl", hash = "sha256:904a21c33c25aa98ddbeb47273033c435e595bbacfdb177f4bd87f6dceebe1ca", size = 233615, upload-time = "2026-01-24T19:40:30.652Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 13: `c96011de` (2025-12-19)
**Commit Message**: build(deps): bump mcp from 1.22.0 to 1.25.0

Bumps [mcp](https://github.com/modelcontextprotocol/python-sdk) from 1.22.0 to 1.25.0.
- [Release notes](https://github.com/modelcontextprotocol/python-sdk/releases)
- [Changelog](https://github.com/modelcontextprotocol/python-sdk/blob/main/RELEASE.md)
- [Commits](https://github.com/modelcontextprotocol/python-sdk/compare/v1.22.0...v1.25.0)

---
updated-dependencies:
- dependency-name: mcp
  dependency-version: 1.25.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -437,7 +437,7 @@ wheels = [
 
 [[package]]
 name = "mcp"
-version = "1.22.0"
+version = "1.25.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "anyio" },
@@ -455,9 +455,9 @@ dependencies = [
     { name = "typing-inspection" },
     { name = "uvicorn", marker = "sys_platform != 'emscripten'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/a3/a2/c5ec0ab38b35ade2ae49a90fada718fbc76811dc5aa1760414c6aaa6b08a/mcp-1.22.0.tar.gz", hash = "sha256:769b9ac90ed42134375b19e777a2858ca300f95f2e800982b3e2be62dfc0ba01", size = 471788, upload-time = "2025-11-20T20:11:28.095Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/d5/2d/649d80a0ecf6a1f82632ca44bec21c0461a9d9fc8934d38cb5b319f2db5e/mcp-1.25.0.tar.gz", hash = "sha256:56310361ebf0364e2d438e5b45f7668cbb124e158bb358333cd06e49e83a6802", size = 605387, upload-time = "2025-12-19T10:19:56.985Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a9/bb/711099f9c6bb52770f56e56401cdfb10da5b67029f701e0df29362df4c8e/mcp-1.22.0-py3-none-any.whl", hash = "sha256:bed758e24df1ed6846989c909ba4e3df339a27b4f30f1b8b627862a4bade4e98", size = 175489, upload-time = "2025-11-20T20:11:26.542Z" },
+    { url = "https://files.pythonhosted.org/packages/e2/fc/6dc7659c2ae5ddf280477011f4213a74f806862856b796ef08f028e664bf/mcp-1.25.0-py3-none-any.whl", hash = "sha256:b37c38144a666add0862614cc79ec276e97d72aa8ca26d622818d4e278b9721a", size = 233076, upload-time = "2025-12-19T10:19:55.416Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 14: `5748671c` (2026-01-13)
**Commit Message**: build(deps): bump the actions group across 1 directory with 2 updates

Bumps the actions group with 2 updates in the / directory: [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) and [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv).


Updates `docker/setup-buildx-action` from 3.11.1 to 3.12.0
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/e468171a9de216ec08956ac3ada2f0791b6bd435...8d2750c68a42422c14e847fe6c8ac0403b4cbd6f)

Updates `astral-sh/setup-uv` from 7.1.6 to 7.2.0
- [Release notes](https://github.com/astral-sh/setup-uv/releases)
- [Commits](https://github.com/astral-sh/setup-uv/compare/681c641aba71e4a1c380be3ab5e12ad51f415867...61cb8a9741eeb8a550a1b8544337180c0fc8476b)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 3.12.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: actions
- dependency-name: astral-sh/setup-uv
  dependency-version: 7.2.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: actions


**File**: `.github/workflows/cd.yaml` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@ jobs:
         uses: docker/setup-qemu-action@c7c53464625b32c7a7e944ae62b3e17d2b600130 #v3.7.0
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@e468171a9de216ec08956ac3ada2f0791b6bd435 #v3.11.1
+        uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f #v3.12.0
 
       - name: Extract tags and labels for Docker
         id: meta
@@ -88,7 +88,7 @@ jobs:
         uses: docker/setup-qemu-action@c7c53464625b32c7a7e944ae62b3e17d2b600130 #v3.7.0
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@e468171a9de216ec08956ac3ada2f0791b6bd435 #v3.11.1
+        uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f #v3.12.0
 
       - name: Extract tags and labels for Docker
         id: meta
```

**File**: `.github/workflows/ci.yaml` (modified, +5/-5)
```diff
@@ -22,7 +22,7 @@ jobs:
     steps:
       - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
 
-      - uses: astral-sh/setup-uv@681c641aba71e4a1c380be3ab5e12ad51f415867 # v7.1.6
+      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -43,7 +43,7 @@ jobs:
     steps:
       - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
 
-      - uses: astral-sh/setup-uv@681c641aba71e4a1c380be3ab5e12ad51f415867 # v7.1.6
+      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -64,7 +64,7 @@ jobs:
     steps:
       - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
 
-      - uses: astral-sh/setup-uv@681c641aba71e4a1c380be3ab5e12ad51f415867 # v7.1.6
+      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
         with:
           python-version: ${{ matrix.python-version }}
 
@@ -93,7 +93,7 @@ jobs:
           merge-multiple: true
           path: coverage
 
-      - uses: astral-sh/setup-uv@681c641aba71e4a1c380be3ab5e12ad51f415867 # v7.1.6
+      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
@@ -133,7 +133,7 @@ jobs:
     steps:
       - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
 
-      - uses: astral-sh/setup-uv@681c641aba71e4a1c380be3ab5e12ad51f415867 # v7.1.6
+      - uses: astral-sh/setup-uv@61cb8a9741eeb8a550a1b8544337180c0fc8476b # v7.2.0
         with:
           python-version: ${{ env.PYTHON_VERSION }}
 
```

---

### Incident Patch 15: `7ed2031b` (2025-12-22)
**Commit Message**: build(deps): bump uvicorn from 0.38.0 to 0.40.0

Bumps [uvicorn](https://github.com/Kludex/uvicorn) from 0.38.0 to 0.40.0.
- [Release notes](https://github.com/Kludex/uvicorn/releases)
- [Changelog](https://github.com/Kludex/uvicorn/blob/main/docs/release-notes.md)
- [Commits](https://github.com/Kludex/uvicorn/compare/0.38.0...0.40.0)

---
updated-dependencies:
- dependency-name: uvicorn
  dependency-version: 0.40.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -1066,14 +1066,14 @@ wheels = [
 
 [[package]]
 name = "uvicorn"
-version = "0.38.0"
+version = "0.40.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "click" },
     { name = "h11" },
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/cb/ce/f06b84e2697fef4688ca63bdb2fdf113ca0a3be33f94488f2cadb690b0cf/uvicorn-0.38.0.tar.gz", hash = "sha256:fd97093bdd120a2609fc0d3afe931d4d4ad688b6e75f0f929fde1bc36fe0e91d", size = 80605, upload-time = "2025-10-18T13:46:44.63Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/c3/d1/8f3c683c9561a4e6689dd3b1d345c815f10f86acd044ee1fb9a4dcd0b8c5/uvicorn-0.40.0.tar.gz", hash = "sha256:839676675e87e73694518b5574fd0f24c9d97b46bea16df7b8c05ea1a51071ea", size = 81761, upload-time = "2025-12-21T14:16:22.45Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/ee/d9/d88e73ca598f4f6ff671fb5fde8a32925c2e08a637303a1d12883c7305fa/uvicorn-0.38.0-py3-none-any.whl", hash = "sha256:48c0afd214ceb59340075b4a052ea1ee91c16fbc2a9b1469cca0e54566977b02", size = 68109, upload-time = "2025-10-18T13:46:42.958Z" },
+    { url = "https://files.pythonhosted.org/packages/3d/d8/2083a1daa7439a66f3a48589a57d576aa117726762618f6bb09fe3798796/uvicorn-0.40.0-py3-none-any.whl", hash = "sha256:c6c8f55bc8bf13eb6fa9ff87ad62308bbbc33d0b67f84293151efe87e0d5f2ee", size = 68502, upload-time = "2025-12-21T14:16:21.041Z" },
 ]
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
