# Forensic Learning Record (Deep Inspection): modelcontextprotocol/python-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-python-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:13:39.719Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/python-sdk`
- **Description**: The official Python SDK for Model Context Protocol servers and clients
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 24494 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/servers/simple-streamablehttp-stateless/mcp_simple_streamablehttp_stateless/__main__.py`
```
from .server import main

if __name__ == "__main__":
    # Click will handle CLI arguments
    import sys

    sys.exit(main())  # type: ignore[call-arg]

```

### Core Architecture Module: `examples/servers/simple-streamablehttp-stateless/mcp_simple_streamablehttp_stateless/server.py`
```
import logging

import anyio
import click
import mcp.types as types
import uvicorn
from mcp.server import Server, ServerRequestContext
from starlette.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)


async def handle_list_tools(
    ctx: ServerRequestContext, params: types.PaginatedRequestParams | None
) -> types.ListToolsResult:
    return types.ListToolsResult(
        tools=[
            types.Tool(
                name="start-notification-stream",
                description=("Sends a stream of notifications with configurable count and interval"),
                input_schema={
                    "type": "object",
                    "required": ["interval", "count", "caller"],
                    "properties": {
                        "interval": {
                            "type": "number",
                            "description": "Interval between notifications in seconds",
                        },
                        "count": {
                            "type": "number",
                            "description": "Number of notifications to send",
                        },
                        "caller": {
                            "type": "string",
                            "description": ("Identifier of the caller to include in notifications"),
                        },
                    },
                },
            )
        ]
    )


async def handle_call_tool(ctx: ServerRequestContext, params: types.CallToolRequestParams) -> types.CallToolResult:
    arguments = params.arguments or {}
    interval = arguments.get("interval", 1.0)
    count = arguments.get("count", 5)
    caller = arguments.get("caller", "unknown")

    # Send the specified number of notifications with the given interval
    for i in range(count):
        await ctx.session.send_log_message(  # pyright: ignore[reportDeprecated]
            level="info",
            data=f"Notification {i + 1}/{count} from caller: {caller}",
            logger="notification_stream",
            related_request_id=ctx.request_id,
        )
        if i < count - 1:  # Don't wait after the last notification
            await anyio.sleep(interval)

    return types.CallToolResult(
        content=[
            types.TextContent(
                type="text",
                text=(f"Sent {count} notifications with {interval}s interval for caller: {caller}"),
            )
        ]
    )


@click.command()
@click.option("--port", default=3000, help="Port to listen on for HTTP")
@click.option(
    "--log-level",
    default="INFO",
    help="Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)",
)
@click.option(
    "--json-response",
    is_flag=True,
    default=False,
    help="Enable JSON responses instead of SSE streams",
)
def main(
    port: int,
    log_level: str,
    json_response: bool,
) -> None:
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    app = Server(
        "mcp-streamable-http-stateless-demo",
        on_list_tools=handle_list_tools,
        on_call_tool=handle_call_tool,
    )

    starlette_app = app.streamable_http_app(
        stateless_http=True,
        json_response=json_response,
        debug=True,
    )

    # Wrap ASGI application with CORS middleware to expose Mcp-Session-Id header
    # for browser-based clients (ensures 500 errors get proper CORS headers)
    starlette_app = CORSMiddleware(
        starlette_app,
        allow_origins=["*"],  # Note: streamable_http_app() enforces localhost-only Origin by default
        allow_methods=["GET", "POST", "DELETE"],  # MCP streamable HTTP methods
        expose_headers=["Mcp-Session-Id"],
    )

    uvicorn.run(starlette_app, host="127.0.0.1", port=port)

```

### Core Architecture Module: `examples/snippets/clients/display_utilities.py`
```
"""cd to the `examples/snippets` directory and run:
uv run display-utilities-client
"""

import asyncio
import os

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.shared.metadata_utils import get_display_name

# Create server parameters for stdio connection
server_params = StdioServerParameters(
    command="uv",  # Using uv to run the server
    args=["run", "server", "mcpserver_quickstart", "stdio"],
    env={"UV_INDEX": os.environ.get("UV_INDEX", "")},
)


async def display_tools(session: ClientSession):
    """Display available tools with human-readable names"""
    tools_response = await session.list_tools()

    for tool in tools_response.tools:
        # get_display_name() returns the title if available, otherwise the name
        display_name = get_display_name(tool)
        print(f"Tool: {display_name}")
        if tool.description:
            print(f"   {tool.description}")


async def display_resources(session: ClientSession):
    """Display available resources with human-readable names"""
    resources_response = await session.list_resources()

    for resource in resources_response.resources:
        display_name = get_display_name(resource)
        print(f"Resource: {display_name} ({resource.uri})")

    templates_response = await session.list_resource_templates()
    for template in templates_response.resource_templates:
        display_name = get_display_name(template)
        print(f"Resource Template: {display_name}")


async def run():
    """Run the display utilities example."""
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize the connection
            await session.initialize()

            print("=== Available Tools ===")
            await display_tools(session)

            print("\n=== Available Resources ===")
            await display_resources(session)


def main():
    """Entry point for the display utilities client."""
    asyncio.run(run())


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/stories/stateless_legacy/client.py`
```
"""Connect at each era — two connections, so `main` takes `targets`; the same stateless app answers both."""

from mcp.client import Client
from mcp.types import TextContent
from mcp.types.version import LATEST_HANDSHAKE_VERSION, LATEST_MODERN_VERSION
from stories._harness import TargetFactory, run_client


async def main(targets: TargetFactory, *, mode: str = "auto") -> None:
    # ── modern era: the caller's mode (the real-user "auto" default) routes this connection
    # through the 2026 envelope path. No initialize handshake, no session id.
    async with Client(targets(), mode=mode) as client:
        assert client.protocol_version == LATEST_MODERN_VERSION

        listed = await client.list_tools()
        assert [t.name for t in listed.tools] == ["greet"]

        result = await client.call_tool("greet", {"name": "world"})
        assert not result.is_error
        assert isinstance(result.content[0], TextContent)
        assert result.content[0].text == "Hello, world!", result

    # ── legacy era: a fresh mode="legacy" client runs the initialize handshake against the
    # SAME stateless app. It is answered statelessly (no Mcp-Session-Id) and the same tool
    # gives the same answer — the era is invisible to the server body.
    async with Client(targets(), mode="legacy") as legacy:
        assert legacy.protocol_version == LATEST_HANDSHAKE_VERSION

        result = await legacy.call_tool("greet", {"name": "world"})
        assert not result.is_error
        assert isinstance(result.content[0], TextContent)
        assert result.content[0].text == "Hello, world!", result


if __name__ == "__main__":
    run_client(main)

```

### Core Architecture Module: `examples/stories/stateless_legacy/server.py`
```
"""The one-liner HTTP deploy: one stateless ASGI app serves both protocol eras, so it exports `build_app()`."""

from starlette.applications import Starlette

from mcp.server.mcpserver import MCPServer
from stories._hosting import NO_DNS_REBIND, run_app_from_args


def build_app() -> Starlette:
    mcp = MCPServer("stateless-legacy-example")

    @mcp.tool(description="A simple greeting tool.")
    def greet(name: str) -> str:
        return f"Hello, {name}!"

    # stateless_http=True: no Mcp-Session-Id, fresh transport per POST — horizontally
    # scalable. The same app also answers 2026-era envelope requests with no extra config.
    return mcp.streamable_http_app(stateless_http=True, transport_security=NO_DNS_REBIND)


if __name__ == "__main__":
    run_app_from_args(build_app)

```

### Core Architecture Module: `examples/stories/stateless_legacy/server_lowlevel.py`
```
"""The one-liner HTTP deploy (lowlevel API): Server.streamable_http_app(stateless_http=True)."""

from typing import Any

from starlette.applications import Starlette

import mcp.types as types
from mcp.server.context import ServerRequestContext
from mcp.server.lowlevel import Server
from stories._hosting import NO_DNS_REBIND, run_app_from_args

GREET_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"name": {"type": "string"}},
    "required": ["name"],
}


def build_app() -> Starlette:
    async def list_tools(
        ctx: ServerRequestContext[Any], params: types.PaginatedRequestParams | None
    ) -> types.ListToolsResult:
        return types.ListToolsResult(
            tools=[
                types.Tool(name="greet", description="A simple greeting tool.", input_schema=GREET_INPUT_SCHEMA),
            ]
        )

    async def call_tool(ctx: ServerRequestContext[Any], params: types.CallToolRequestParams) -> types.CallToolResult:
        assert params.name == "greet" and params.arguments is not None
        return types.CallToolResult(content=[types.TextContent(text=f"Hello, {params.arguments['name']}!")])

    server = Server("stateless-legacy-example", on_list_tools=list_tools, on_call_tool=call_tool)
    return server.streamable_http_app(stateless_http=True, transport_security=NO_DNS_REBIND)


if __name__ == "__main__":
    run_app_from_args(build_app)

```

### Core Architecture Module: `src/mcp/client/auth/utils.py`
```
import re
from typing import Any, cast
from urllib.parse import urljoin, urlparse

from httpx2 import Request, Response
from mcp_types import LATEST_PROTOCOL_VERSION
from pydantic import AnyUrl, ValidationError
from pydantic_core import from_json

from mcp.client.auth import OAuthFlowError, OAuthRegistrationError, OAuthTokenError
from mcp.shared._httpx_utils import redirect_note
from mcp.shared.auth import (
    OAuthClientInformationFull,
    OAuthClientMetadata,
    OAuthMetadata,
    OAuthToken,
    ProtectedResourceMetadata,
)
from mcp.shared.inbound import MCP_PROTOCOL_VERSION_HEADER


def extract_field_from_www_auth(response: Response, field_name: str) -> str | None:
    """Extract field from WWW-Authenticate header.

    Returns:
        Field value if found in WWW-Authenticate header, None otherwise
    """
    www_auth_header = response.headers.get("WWW-Authenticate")
    if not www_auth_header:
        return None

    # Pattern matches: field_name="value" or field_name=value (unquoted)
    pattern = rf'{field_name}=(?:"([^"]+)"|([^\s,]+))'
    match = re.search(pattern, www_auth_header)

    if match:
        # Return quoted value if present, otherwise unquoted value
        return match.group(1) or match.group(2)

    return None


def extract_scope_from_www_auth(response: Response) -> str | None:
    """Extract scope parameter from WWW-Authenticate header as per RFC 6750.

    Returns:
        Scope string if found in WWW-Authenticate header, None otherwise
    """
    return extract_field_from_www_auth(response, "scope")


def extract_resource_metadata_from_www_auth(response: Response) -> str | None:
    """Extract protected resource metadata URL from WWW-Authenticate header as per RFC 9728.

    Returns:
        Resource metadata URL if found in WWW-Authenticate header, None otherwise
    """
    if not response or response.status_code not in (401, 403):
        return None  # pragma: no cover

    return extract_field_from_www_auth(response, "resource_metadata")


def build_protected_resource_metadata_discovery_urls(www_auth_url: str | None, server_url: str) -> list[str]:
    """Build ordered list of URLs to try for protected resource metadata discovery.

    Per SEP-985, the client MUST:
    1. Try resource_metadata from WWW-Authenticate header (if present)
    2. Fall back to path-based well-known URI: /.well-known/oauth-protected-resource/{path}
    3. Fall back to root-based well-known URI: /.well-known/oauth-protected-resource

    Args:
        www_auth_url: Optional resource_metadata URL extracted from the WWW-Authenticate header
        server_url: Server URL

    Returns:
        Ordered list of URLs to try for discovery
    """
    urls: list[str] = []

    # Priority 1: WWW-Authenticate header with resource_metadata parameter
    if www_auth_url:
        urls.append(www_auth_url)

    # Priority 2-3: Well-known URIs (RFC 9728)
    parsed = urlparse(server_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"

    # Priority 2: Path-based well-known URI (if server has a path component)
    if parsed.path and parsed.path != "/":
        path_based_url = urljoin(base_url, f"/.well-known/oauth-protected-resource{parsed.path}")
        urls.append(path_based_url)

    # Priority 3: Root-based well-known URI
    root_based_url = urljoin(base_url, "/.well-known/oauth-protected-resource")
    urls.append(root_based_url)

    return urls


def get_client_metadata_scopes(
    www_authenticate_scope: str | None,
    protected_resource_metadata: ProtectedResourceMetadata | None,
    authorization_server_metadata: OAuthMetadata | None = None,
    client_grant_types: list[str] | None = None,
) -> str | None:
    """Select effective scopes and augment for refresh token support."""
    selected_scope: str | None = None

    # MCP spec scope selection priority:
    #   1. WWW-Authenticate header scope
    #   2. PRM scopes_supported
    #   3. AS scopes_supported (SDK fallback)
    #   4. Omit scope parameter
    if www_authenticate_scope is not None:
        selected_scope = www_authenticate_scope
    elif protected_resource_metadata is not None and protected_resource_metadata.scopes_supported is not None:
        selected_scope = " ".join(protected_resource_metadata.scopes_supported)
    elif authorization_server_metadata is not None and authorization_server_metadata.scopes_supported is not None:
        selected_scope = " ".join(authorization_server_metadata.scopes_supported)

    # SEP-2207: append offline_access when the AS supports it and the client can use refresh tokens
    if (
        selected_scope is not None
        and authorization_server_metadata is not None
        and authorization_server_metadata.scopes_supported is not None
        and "offline_access" in authorization_server_metadata.scopes_supported
        and client_grant_types is not None
        and "refresh_token" in client_grant_types
        and "offline_access" not in selected_scope.split()
    ):
        selected_scope = f"{selected_scope} offline_access"

    return selected_scope


def union_scopes(previous_scope: str | None, new_scope: str | None) -> str | None:
    """Merge two space-delimited scope strings, preserving order and dropping duplicates.

    SEP-2350: on step-up re-authorization the client requests the union of previously requested
    scopes and the newly challenged scopes, so escalating one operation does not drop the
    permissions granted for another. Previously requested scopes come first; new scopes are
    appended in order.
    """
    if not previous_scope:
        return new_scope
    if not new_scope:
        return previous_scope

    merged = previous_scope.split()
    seen = set(merged)
    for scope in new_scope.split():
        if scope not in seen:
            merged.append(scope)
            seen.add(scope)
    return " ".join(merged)


def build_oauth_authorization_server_metadata_discovery_urls(auth_server_url: str | None, server_url: str) -> list[str]:
    """Generate an ordered list of URLs for authorization server metadata discovery.

    Args:
        auth_server_url: OAuth Authorization Server Metadata URL if found, otherwise None
        server_url: URL for the MCP server, used as a fallback if auth_server_url is None
    """

    if not auth_server_url:
        # Legacy path using the 2025-03-26 spec:
        # link: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization
        parsed = urlparse(server_url)
        return [f"{parsed.scheme}://{parsed.netloc}/.well-known/oauth-authorization-server"]

    urls: list[str] = []
    parsed = urlparse(auth_server_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"

    # RFC 8414: Path-aware OAuth discovery
    if parsed.path and parsed.path != "/":
        oauth_path = f"/.well-known/oauth-authorization-server{parsed.path.rstrip('/')}"
        urls.append(urljoin(base_url, oauth_path))

        # RFC 8414 section 5: Path-aware OIDC discovery
        # See https://www.rfc-editor.org/rfc/rfc8414.html#section-5
        oidc_path = f"/.well-known/openid-configuration{parsed.path.rstrip('/')}"
        urls.append(urljoin(base_url, oidc_path))

        # https://openid.net/specs/openid-connect-discovery-1_0.html
        oidc_path = f"{parsed.path.rstrip('/')}/.well-known/openid-configuration"
        urls.append(urljoin(base_url, oidc_path))
        return urls

    # OAuth root
    urls.append(urljoin(base_url, "/.well-known/oauth-authorization-server"))

    # OIDC 1.0 fallback (appends to full URL per OIDC spec)
    # https://openid.net/specs/openid-connect-discovery-1_0.html
    urls.append(urljoin(base_url, "/.well-known/openid-configuration"))

    return urls


async def handle_protected_resource_response(
    response: Response,
) -> ProtectedResourceMetadata | None:
    """Handle protected resource metadata discovery response.

    Per SEP-985, supports fallback when discovery fails at one URL.

    Returns:
        ProtectedResourceMetadata if successfully discovered, None if we should try next URL
    """
    if response.status_code == 200:
        try:
            content = await response.aread()
            metadata = ProtectedResourceMetadata.model_validate_json(content)
            return metadata

        except ValidationError:  # pragma: no cover
            # Invalid metadata - try next URL
            return None
    else:
        # Not found - try next URL in fallback chain
        return None


async def handle_auth_metadata_response(response: Response) -> tuple[bool, OAuthMetadata | None]:
    if response.status_code == 200:
        try:
            content = await response.aread()
            asm = OAuthMetadata.model_validate_json(content)
            return True, asm
        except ValidationError:  # pragma: no cover
            return True, None
    elif 300 <= response.status_code < 500:
        return True, None  # Not served at this URL (redirects are not followed) - try the next candidate
    return False, None  # Server error or unexpected status, stop trying


def validate_authorization_response_iss(iss: str | None, oauth_metadata: OAuthMetadata | None) -> None:
    """Validate the RFC 9207 `iss` authorization-response parameter.

    Per RFC 9207 section 2.4, the client compares `iss` against the issuer of the
    authorization server the request was sent to, using simple string comparison
    (RFC 3986 section 6.2.1, i.e. without URL normalization), and rejects on mismatch.
    A response that omits `iss` is rejected only when the server advertised support via
    `authorization_response_iss_parameter_supported`.

    Raises:
        OAuthFlowError: If `iss` is present and does not match, or is absent when the
            authorization server advertised support.
    """
    expected = str(oauth_metadata.issuer) if oauth_metadata else None

    if iss is not None:
        if iss != expected:
            raise OAuthFlowError(f"Authorization response iss mismatch: {iss} !=
```

### Core Architecture Module: `src/mcp/os/posix/utilities.py`
```
"""POSIX-specific functionality for stdio client operations."""

import logging
import os
import signal
from contextlib import suppress

import anyio
from anyio.abc import Process

logger = logging.getLogger(__name__)

# How often to probe for surviving group members between SIGTERM and SIGKILL.
_GROUP_POLL_INTERVAL = 0.01


async def terminate_posix_process_tree(process: Process, timeout_seconds: float = 2.0) -> None:
    """Terminates a process and all its descendants on POSIX.

    SIGTERMs the process group, waits up to timeout_seconds for it to
    disappear, then SIGKILLs whatever remains. killpg reaches every descendant
    atomically, even ones whose parent already exited; daemonizers that left
    the group escape by design. A group only disappears once every member is
    dead and reaped, so a client running as PID 1 should reap orphans (e.g.
    docker run --init) or the wait below runs its full timeout.
    """
    # The leader's pid is the pgid (start_new_session). Never use getpgid():
    # it fails once the leader is reaped, even with live members left.
    pgid = process.pid

    try:
        os.killpg(pgid, signal.SIGTERM)
    except ProcessLookupError:
        return  # the whole group is already gone
    except PermissionError:
        # EPERM never proves the group is gone (macOS raises it for zombie or
        # foreign-euid members), so keep waiting and escalating.
        logger.warning(
            "No permission to signal some of process group %d; waiting for it to exit anyway", pgid, exc_info=True
        )

    with anyio.move_on_after(timeout_seconds):
        while _group_alive(pgid):
            # Reading returncode reaps the leader on trio; a zombie leader would
            # otherwise keep the group alive for the full timeout.
            _ = process.returncode
            await anyio.sleep(_GROUP_POLL_INTERVAL)
        return

    # ESRCH: died since the last probe. EPERM: we killed what we were allowed to.
    with suppress(ProcessLookupError, PermissionError):
        os.killpg(pgid, signal.SIGKILL)


def _group_alive(pgid: int) -> bool:
    """Probes the group with signal 0; only ESRCH proves it is gone."""
    try:
        os.killpg(pgid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        pass  # unsignalable survivors or unreaped zombies; EPERM is ambiguous
    return True

```

### Core Architecture Module: `src/mcp/os/win32/utilities.py`
```
"""Windows-specific functionality for stdio transport operations."""

import logging
import shutil
import subprocess
import sys
import weakref
from contextlib import suppress
from pathlib import Path
from typing import BinaryIO, TextIO, TypeAlias, cast

import anyio
from anyio.abc import Process
from anyio.streams.file import FileReadStream, FileWriteStream

logger = logging.getLogger(__name__)

# Windows-specific imports for Job Objects
if sys.platform == "win32":
    import msvcrt

    import pywintypes
    import win32api
    import win32con
    import win32job
else:
    # Type stubs for non-Windows platforms
    win32api = None
    win32con = None
    msvcrt = None
    win32job = None
    pywintypes = None


def rebind_std_handle_to_fd(fd: int) -> None:
    """Points the Win32 standard-handle slot for fd 0, 1, or 2 at fd's current OS handle.

    os.dup2 updates only the CRT descriptor table; subprocess handle inheritance
    reads the Win32 slot, so it must be repointed too.

    Raises:
        OSError: The slot could not be set.
    """
    if sys.platform != "win32" or not win32api or not msvcrt or not pywintypes:
        return
    std_ids = {0: win32api.STD_INPUT_HANDLE, 1: win32api.STD_OUTPUT_HANDLE, 2: win32api.STD_ERROR_HANDLE}
    try:
        win32api.SetStdHandle(std_ids[fd], msvcrt.get_osfhandle(fd))
    except pywintypes.error as exc:
        # Normalized so callers' OSError-based best-effort handling covers it.
        raise OSError(f"SetStdHandle failed for fd {fd}") from exc


# How often FallbackProcess polls the underlying Popen for exit.
_EXIT_POLL_INTERVAL = 0.01

# Job Object handle per spawned process, for tree termination at shutdown.
# Values stay pywin32 PyHANDLEs: if no pop site ever runs, the dying weak entry
# drops the last reference and the PyHANDLE destructor closes the handle, which
# is what makes KILL_ON_JOB_CLOSE reap an abandoned tree.
_process_jobs: "weakref.WeakKeyDictionary[Process | FallbackProcess, object]" = weakref.WeakKeyDictionary()


def get_windows_executable_command(command: str) -> str:
    """Resolves the command to a Windows executable path.

    Tries the bare name first, then the common script extensions (.cmd, .bat,
    .exe, .ps1).
    """
    try:
        if command_path := shutil.which(command):
            return command_path

        for ext in [".cmd", ".bat", ".exe", ".ps1"]:
            ext_version = f"{command}{ext}"
            if ext_path := shutil.which(ext_version):
                return ext_path

        return command
    except OSError:
        return command  # path probing failed (permissions, broken symlinks)


class FallbackProcess:
    """Async wrapper around subprocess.Popen for SelectorEventLoop.

    Windows event loops without async subprocess support get this Popen-backed
    fallback, with anyio file streams wrapping the pipes.
    """

    def __init__(self, popen_obj: subprocess.Popen[bytes]) -> None:
        self.popen: subprocess.Popen[bytes] = popen_obj
        stdin = popen_obj.stdin
        stdout = popen_obj.stdout

        self.stdin = FileWriteStream(cast(BinaryIO, stdin)) if stdin else None
        self.stdout = FileReadStream(cast(BinaryIO, stdout)) if stdout else None

    async def wait(self) -> int:
        """Waits for exit by polling the Popen.

        A thread blocked in Popen.wait() cannot be cancelled by anyio, which
        would defeat every timeout placed around this call.
        """
        while (returncode := self.popen.poll()) is None:
            await anyio.sleep(_EXIT_POLL_INTERVAL)
        return returncode

    def terminate(self) -> None:
        """Terminates the subprocess."""
        self.popen.terminate()

    def kill(self) -> None:
        """Kills the subprocess (on Windows the same hard kill as terminate)."""
        self.popen.kill()

    @property
    def pid(self) -> int:
        """Returns the process ID."""
        return self.popen.pid

    @property
    def returncode(self) -> int | None:
        """The exit code, or None while the process is still running.

        Polls the Popen so death is observable without anyone calling wait().
        """
        return self.popen.poll()


# The process handle stdio_client drives: anyio's Process, or the Popen-backed
# fallback used on Windows event loops without async subprocess support.
ServerProcess: TypeAlias = Process | FallbackProcess


async def create_windows_process(
    command: str,
    args: list[str],
    env: dict[str, str] | None = None,
    errlog: TextIO | None = sys.stderr,
    cwd: Path | str | None = None,
) -> Process | FallbackProcess:
    """Creates a subprocess with Job Object support for tree termination.

    Spawns via anyio's open_process; event loops without async subprocess
    support (notably the SelectorEventLoop) raise NotImplementedError, in which
    case the spawn falls back to a Popen-backed FallbackProcess. Either way the
    process is then assigned to a Job Object so its children can be terminated
    with it; children spawned before the assignment completes are not captured
    (see the inline note below).

    Returns:
        Process | FallbackProcess: The spawned process with async stdin/stdout streams.
    """
    try:
        process = await anyio.open_process(
            [command, *args],
            env=env,
            # Ensure we don't create console windows for each process
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            stderr=errlog,
            cwd=cwd,
        )
    except NotImplementedError:
        # Windows event loops without async subprocess support (SelectorEventLoop)
        process = await _create_windows_fallback_process(command, args, env, errlog, cwd)

    # Children spawned before the assignment completes land outside the job
    # (membership is inherited at CreateProcess, never acquired retroactively);
    # if that ever bites, the fix is a CREATE_SUSPENDED spawn -> assign -> resume.
    job = _create_job_object()
    _maybe_assign_process_to_job(process, job)
    return process


async def _create_windows_fallback_process(
    command: str,
    args: list[str],
    env: dict[str, str] | None = None,
    errlog: TextIO | None = sys.stderr,
    cwd: Path | str | None = None,
) -> FallbackProcess:
    """Spawns via subprocess.Popen and wraps it in FallbackProcess."""
    popen_obj = subprocess.Popen(
        [command, *args],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=errlog,
        env=env,
        cwd=cwd,
        bufsize=0,  # Unbuffered output
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    return FallbackProcess(popen_obj)


def _create_job_object() -> object | None:
    """Creates a Windows Job Object configured to terminate all its processes when closed."""
    if sys.platform != "win32" or not win32api or not win32job:
        return None

    job = None
    try:
        job = win32job.CreateJobObject(None, "")
        extended_info = win32job.QueryInformationJobObject(job, win32job.JobObjectExtendedLimitInformation)

        extended_info["BasicLimitInformation"]["LimitFlags"] |= win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        win32job.SetInformationJobObject(job, win32job.JobObjectExtendedLimitInformation, extended_info)
        return job
    except pywintypes.error:
        logger.warning("Failed to create Job Object for process tree management", exc_info=True)
        # If creation succeeded but configuration failed, close the handle now.
        if job is not None:
            _close_job_handle(job)
        return None


def _maybe_assign_process_to_job(process: Process | FallbackProcess, job: object | None) -> None:
    """Assigns the process to the job and records it for tree termination.

    On any failure the job handle is closed instead.
    """
    if job is None:
        return

    if sys.platform != "win32" or not win32api or not win32con or not win32job:
        return

    try:
        process_handle = win32api.OpenProcess(
            win32con.PROCESS_SET_QUOTA | win32con.PROCESS_TERMINATE, False, process.pid
        )
        if not process_handle:
            raise pywintypes.error(0, "OpenProcess", "Failed to open process handle")

        try:
            win32job.AssignProcessToJobObject(job, process_handle)
        finally:
            win32api.CloseHandle(process_handle)
        # Record only after the CloseHandle above succeeded: had it failed, the
        # except below would close the job and KILL_ON_JOB_CLOSE takes the server.
        _process_jobs[process] = job
    except pywintypes.error:
        logger.warning("Failed to assign process %d to Job Object", process.pid, exc_info=True)
        _close_job_handle(job)


def close_process_job(process: Process | FallbackProcess) -> None:
    """Closes the process's Job Object handle, if it still has one.

    KILL_ON_JOB_CLOSE makes the close also kill any members still alive,
    deterministically rather than at GC time; a deliberate divergence from
    POSIX, where a graceful server's children are left alive.
    """
    if sys.platform != "win32":
        return

    job = _process_jobs.pop(process, None)
    if job is not None:
        _close_job_handle(job)


async def terminate_windows_process_tree(process: Process | FallbackProcess) -> None:
    """Terminates the process's job, or just the process if it has no job.

    Job termination is an immediate hard kill of every member. Windows has no
    tree-wide SIGTERM; the stdin-close grace period is the server's chance to
    exit cleanly.
    """
    if sys.platform != "win32":
        return

    job = _process_jobs.pop(process, None)
    if job is not None and win32job:
        try:
            with suppress(pywintypes.error):  # the job might already be terminated
                win32job.TerminateJobObject(job, 1)
        finally:
            _close_job_handle(job)

    # The process may have no job (creation or assignment
```

### Core Architecture Module: `src/mcp/server/mcpserver/utilities/__init__.py`
```
"""MCPServer utility modules."""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3337** (2026-08-24): **Recursive tool return type publishes an outputSchema with no root type, failing tools/list on 2025-11-25 sessions**
  *Symptoms*: ### Release line  2.x (`main`), observed at b2025ab8 and on #3331.  ### Bug description  When an MCPServer tool's return type is self-referential, pydantic emits the output schema as `{"$defs": {...}, "$ref": "#/$defs/Node"}` with no root `"type": "object"`. That's fine on 2026-07-28 sessions, but the 2025-11-25 `Tool.outputSchema` shape requires `type: "object"` at the root, so serializing the `tools/list` result for a legacy-negotiated client fails validation and the client gets an error for the **entire listing**, not just that tool.  On `main` this affects recursive `BaseModel` return types. #3331 hands `TypedDict` returns to pydantic natively, so recursive `TypedDict`s join them (previously the hand-built mirror model happened to inline the root).  ### Steps to reproduce  ```python import anyio from pydantic import BaseModel from mcp import Client from mcp.server.mcpserver import MCPServer  class Node(BaseModel):     name: str     children: list["Node"] = []  mcp = MCPServer("rec")  @mcp.tool() def tree() -> Node:     return Node(name="root")  @mcp.tool() def other() -> int:     return 1  async def main():     async with Client(mcp) as c:                 # 2026-07-28         print(sorted((await c.list_tools()).tools[1].output_schema))   # ['$defs', '$ref']     async with Client(mcp, mode="legacy") as c:  # 2025-11-25         await c.list_tools()                     # raises; server logs "handler for 'tools/list' returned an invalid result"  anyio.run(main) ```  Server lo
  **Post-Mortem & Fix Analysis**:
  > I reproduced this on current `main` at `0d921927` with CPython 3.12.13, using the in-memory `Client(MCPServer)` path.  Observed behavior:  - `Client(server)` lists and calls the recursive tool successfully. - `Client(server, mode="legacy")` fails `tools/list` during server-side result serialization with `tools.0.outputSchema.type: Field required`, and the client receives `MCPError: Handler returned an invalid result`.  The failure occurs at the protocol-version serialization boundary: Pydantic's root `$ref` schema is valid for 2026-07-28, while the handshake-era `OutputSchema` requires a root `type: "object"`.  A narrow fix appears possible in MCPServer's request-aware `tools/list` path:  - Keep the modern schema unchanged. - For handshake-era sessions only, when a root local `$ref` resolves to a `$defs` entry whose type is explicitly `object`, return a copied schema with a sibling `type: "object"`. - Do not relabel recursive non-object schemas such as `RootModel[list[...]]`. - Keep th
  > I'd like to take this one. I'll look at giving the recursive schema a root object type for 2025-11-25 sessions, with a regression test covering the legacy-negotiated tools/list path so a single recursive return type can't fail the whole listing again.
  > Confirmed against current `main` (`57394b0`): the modern session publishes `{$defs, $ref}` with no root type, and on a legacy session `tools/list` fails entirely with `MCPError: Handler returned an invalid result`.  I have a working fix on a branch. Scope note first: I left your second question (drop/degrade one unrepresentable tool instead of failing the listing) alone — that's a design decision for maintainers and separable from this.  The fix normalizes at schema-generation time (`FuncMetadata.model_post_init`, where `StrictJsonSchema` already owns derivation): when pydantic emits a root that is a bare $ref to an object def, publish it as  \```json {"type": "object", "allOf": [{"$ref": "#/$defs/Node"}], "$defs": {…}} \```  Wrapping rather than inlining is what terminates on recursive models; sibling \`$ref\` + \`type\` would also satisfy the 2025-11-25 \`OutputSchema\` model but wrapping keeps it draft-agnostic. Non-object ref targets and hand-built schemas are untouched, so this on

- **Issue #3324** (2026-08-17): **2026-07-28 transport rejects client notifications with -32600; real clients send notifications/cancelled (TODO(L57))**
  *Symptoms*: ### Summary  On the `2026-07-28` per-request-envelope path, the streamable-HTTP transport rejects **any** client notification with HTTP 400 and `-32600 "Body must be a single JSON-RPC request object"`. The same notification is accepted with `202` on the handshake era.  `mcp/server/_streamable_http_modern.py:349-362` documents this as a deliberate choice, and notes the decision is still open:  ```python except ValidationError:     # Well-formed JSON that isn't a single request object. The transport     # spec permits notification POSTs and gives the server two responses     # (202 accept / 4xx cannot-accept; streamable-http §Sending Messages     # item 5). The core protocol defines no client→server notifications     # over HTTP at 2026-07-28 (cancellation is SSE-stream close), so this     # entry takes the cannot-accept branch. TODO(L57): S4 owns the     # strict-vs-lenient choice. ```  **I'm not reporting a spec violation** — the transport spec permits either branch, and the reasoning above is sound. I'm supplying the empirical input that `TODO(L57)` is missing: **real clients do send notifications on `2026-07-28`**, so the strict branch produces a steady stream of 400s in production.  ### Observed in production  A server running `mcp==2.0.0` behind an OAuth-protected streamable-HTTP endpoint, serving live `Claude-User` connector traffic. Within one client session, on `2026-07-28`:  | Method | Result | |---|---| | `server/discover` | 200 | | `notifications/cancelled` | **400*

- **Issue #3300** (2026-08-28): **Cleanly terminated streamable-HTTP sessions are never deregistered: the DELETE path skips its own cleanup**
  *Symptoms*: ### Credit  This was found and reported by @pete-builds in [a comment on #3228](https://github.com/modelcontextprotocol/python-sdk/issues/3228#issuecomment-5276126635), which ended with an offer to split it out. I own #3228, so I am taking them up on that. This is their finding, not an independent discovery.  What this issue adds is **isolation**. The repro in that comment establishes each session with a bare `GET` (no `Accept: text/event-stream`), which is itself refused with 406 — so every session it counts was created by a *rejected* request, i.e. by #3228. That evidence cannot separate "leaked because refused" from "leaked because DELETEd." The repro below establishes sessions with a real `initialize` handshake returning **200**, leaving the `DELETE` as the only variable.  This is **orthogonal to #3229**. That PR discards a session only when the *establishing* request returns ≥ 400; a successful `initialize` returns 200, so its branch never fires here. The run below is on the #3229 branch and still leaks.  ### Description  On the handshake-era streamable-HTTP path, a session terminated **cleanly** by `DELETE` is never removed from `StreamableHTTPSessionManager._server_instances`.  `StreamableHTTPServerTransport.terminate()` sets `self._terminated = True` **before** closing the streams that let the session task unwind. When `run_server`'s `finally` block runs, its `and not http_transport.is_terminated` conjunct is false, so the `del` is skipped — for exactly the sessions t
  **Post-Mortem & Fix Analysis**:
  > I reproduced the issue described here and prepared PR #3302 with a focused fix and regression tests. The change removes terminated sessions from both registries synchronously after a clean DELETE, while preserving the existing 404 status behavior. The focused validation passed: ruff check, pyright, pytest for `tests/server/test_streamable_http_manager.py` (31 passed), and `git diff --check`.  I’m happy to revise the implementation based on maintainer feedback. This contribution was prepared with AI assistance and reviewed by me; I’m responsible for the proposed change and can explain or adjust any part of it.  Since the issue’s original reporter has first call, please let me know whether you would like me to continue with this implementation.
  > @mikemikimike yes, please carry it. It's your fix and your tests, and I have no claim to hold onto here. @sainikhiljuluri did the real work of isolating this from #3228, which is what made it a clean issue in the first place.  One process note so you aren't left waiting on me: #3302 was closed by the linked-issue bot, not by a maintainer turning it down. Per CONTRIBUTING.md it reopens on its own once a maintainer assigns you to this issue. So the thing standing in your way is assignment, not my sign-off.  Since this is still labelled `needs confirmation`, here is field data from a deployment running released `mcp` 1.29.0, in case it saves a maintainer some time. FastMCP server, real uvicorn socket, 200 sequential sessions. Each one a full `initialize` returning 200, then `notifications/initialized`, then an explicit `DELETE`:  ``` RSS before: 88536 kB RSS after : 89552 kB -> 5201 bytes per terminated session, never reclaimed ```  That matches the "dead stub of a few KB per session" in 
  > Thank you, this broadens the affected deployment population materially. I folded both points into PR #3302's Scope section: released 1.29.0 routes all clients through the affected handshake path, and FastMCP/public server APIs do not expose `session_idle_timeout`, so the idle reaper is not a deployable mitigation for those servers. The implementation remains intentionally limited to synchronous registry cleanup after clean DELETE.

- **Issue #3174** (2026-10-02): **[v2] JSON-RPC error responses leave client OpenTelemetry spans UNSET**
  *Symptoms*: ### Initial Checks  - [x] I confirm that I'm using the latest version of MCP Python SDK - [x] I confirm that I searched for my issue in https://github.com/modelcontextprotocol/python-sdk/issues before opening this issue  ### Description  At current `main` (`11934c90aeff5e1e68aee223edd00c5d1fce1d5c`), JSON-RPC error responses handled by `JSONRPCDispatcher` leave the corresponding client OpenTelemetry span looking like a normal exit:  - span status: `UNSET` - `error.type`: absent - `rpc.response.status_code`: absent - exception events: none  The request still fails correctly with `MCPError`; this report is limited to client-side telemetry correctness.  The ordering appears to explain the result: [`send_raw_request()`](https://github.com/modelcontextprotocol/python-sdk/blob/11934c90aeff5e1e68aee223edd00c5d1fce1d5c/src/mcp/shared/jsonrpc_dispatcher.py#L368-L434) receives `outcome` inside the client span, exits the span, and only afterward converts `ErrorData` into `MCPError` at lines 432–433. The span context manager therefore observes no exception.  This differs from the current [server OTel middleware](https://github.com/modelcontextprotocol/python-sdk/blob/11934c90aeff5e1e68aee223edd00c5d1fce1d5c/src/mcp/server/_otel.py#L35-L60), which records the error attributes and status, and from the design assumption documented in [#2381](https://github.com/modelcontextprotocol/python-sdk/pull/2381) that a propagated `MCPError` would be recorded by the client span.  I ran the same in-mem
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to work on this fix.  **Root cause:** In send_raw_request(), the otel_span context manager exits before ErrorData is converted to MCPError, so the span never observes an error — it stays UNSET with no error attributes.  **Proposed fix:** Inside the span, after receiving outcome, check for ErrorData and set error attributes (error.type, pc.response.status_code, StatusCode.ERROR) on the span before exiting. This mirrors the server-side pattern in _otel.py:35-60.  The change is ~5 lines in send_raw_request() plus a test using InMemorySpanExporter (adapting the reproducer from the issue).  Happy to take this on if no one else is assigned. Thanks!
  > Hi maintainers, I’d like to work on this if the proposed direction is welcome.  I don’t currently see an implementation linked to this issue. My plan is to first add an in-memory regression test covering successful and JSON-RPC error responses, then ensure the ErrorData to MCPError transition occurs within the active client span—or explicitly record the error status and semantic-convention attributes if that better matches the project’s telemetry design.  I’ll keep the change scoped to the v2 JSONRPCDispatcher, run the targeted tests, Ruff, and Pyright, and personally review and understand the complete implementation. I will also disclose AI assistance in the pull request.  Please assign it or mark it ready if this direction is acceptable.
  > Hey @chavalasantosh, highly support this direction. From an enterprise TrustOps perspective, leaving OpenTelemetry spans UNSET on JSON-RPC errors is a critical SOC 2 compliance blocker.  In the new MCP 2026-07-28 stateless architecture, you can no longer rely on protocol sessions for accountability. The OpenTelemetry span is often the *only* evidence-grade log that records a failed authorization attempt or policy denial. If an error response drops that span, the enterprise loses the audit trail required for incident response.  For context on why these logging controls are mandatory for v2 deployments, we just published an architectural breakdown of the RufRoot (CVE-2026-59726) breach and the minimum controls required for fail-closed stateless gateways. I'll link the autopsy here for anyone implementing telemetry for production: *mcp.ecocitizenz.com <http://mcp.ecocitizenz.com>*  On Wed, Jul 29, 2026 at 7:05 PM Santosh Chavala ***@***.***> wrote:  > *chavalasantosh* l

- **Issue #3146** (2026-10-01): **Deeply-nested-body test fails on macOS: rejected as INVALID_REQUEST (-32600) instead of PARSE_ERROR (-32700)**
  *Symptoms*: Running the test suite on macOS (observed on GitHub `macos-latest`, Python 3.14) fails one test that passes on Ubuntu and Windows:  ``` FAILED tests/server/test_streamable_http_modern.py::test_modern_post_with_deeply_nested_body_is_parse_error_not_a_crash >       assert response.json()["error"]["code"] == PARSE_ERROR E       assert -32600 == -32700 ```  https://github.com/modelcontextprotocol/python-sdk/blob/3a6f2996cdd8358957479791e8b26198c07d6a75/tests/server/test_streamable_http_modern.py#L1011  The response status is 400 in both cases; only the JSON-RPC error code differs. The test expects the RecursionError raised while parsing the deeply nested body to classify as a parse error, but on Darwin it surfaces as INVALID_REQUEST, so the recursion limit is evidently being hit in a different layer there (macOS threads run with a smaller default stack, which moves where the recursion guard strikes).  This is unrelated to any open PR: it fails identically on current `main` (3a6f299) and on feature branches, reproduced across repeated runs on `macos-latest`. Repro:  ```bash uv sync --frozen uv run --frozen pytest tests/server/test_streamable_http_modern.py::test_modern_post_with_deeply_nested_body_is_parse_error_not_a_crash ```  CI currently runs Ubuntu and Windows only, which is why this has gone unnoticed; worth deciding separately whether `macos-latest` should join the matrix.  <sub>[AI Disclaimer](https://gist.github.com/maxisbey/6123d132484e4c533eab519a2800693d)</sub>
  **Post-Mortem & Fix Analysis**:
  > Reproduced on a real Mac, but the OS is a red herring — this is a **CPython version boundary**, and the server behavior on 3.14 is arguably the correct one.  **Machine data** — macOS 26.5.1 arm64 (M-series), same commit (6affe5c):  - Python 3.12.13: test **PASSES** - Python 3.14.6: test **FAILS** with -32600 (as reported)  **Actual divergence** — the recursion guard never fires on 3.14; parsing succeeds:  ```python body = b"[" * 100_000 + b"]" * 100_000 # 3.12: json.loads raises RecursionError → caught at _streamable_http_modern.py:403 → PARSE_ERROR (-32700) # 3.14: json.loads SUCCEEDS (returns a 100k-deep list) #       → JSONRPCRequest.model_validate(list) → ValidationError → _INVALID_BODY (L207, INVALID_REQUEST, -32600) ```  Verified the two pieces in isolation: `pydantic_core.from_json` behaves identically on both (2.41.5, same ValueError), but stdlib `json.loads` diverges — on 3.14 it parses this depth without raising. So the body is *valid JSON* that just isn't a valid JSON-RPC re
  > Fixed in #3610. Thanks for the analysis and the PR offer above: the fix follows your second option, so the test body is now left unterminated and can't parse on any interpreter. The server code is untouched.  I reproduced the failure on Linux by raising the stack limit, but haven't run the fix on a Mac. If it still fails there, please open a new issue.  Adding `macos-latest` to CI has its own issue now, #3597.  <sub>[AI Disclaimer](https://gist.github.com/maxisbey/6123d132484e4c533eab519a2800693d)</sub> 

- **Issue #3126** (2026-10-02): **Dispatcher mints a request id already used by a completed caller-supplied request (spec: ids MUST NOT be reused in a session)**
  *Symptoms*: ### Initial Checks  - [x] I confirm that I'm using the latest version of MCP Python SDK - [x] I confirm that I searched for my issue in https://github.com/modelcontextprotocol/python-sdk/issues before opening this issue  ### Description  On current `main` (v2, tested at 3a6f2996), when a caller supplies its own request id via `CallOptions["request_id"]` (added in #3046), the dispatcher's minted-id sequence can later land on that same id after the supplied request completes. The session then sends two different requests with the same id, which the spec forbids:  > The request ID MUST NOT have been previously used by the requestor within the same session.  (https://modelcontextprotocol.io/specification/2025-11-25/basic#requests, same wording since 2025-03-26. The SDK pins this itself as `protocol:request-id:unique` in `tests/interaction/_requirements.py`: "ids are never reused within the session".)  ## Root cause  In `JSONRPCDispatcher.send_raw_request` (`src/mcp/shared/jsonrpc_dispatcher.py`, around line 338):  ```python else:     # Mint past any key a supplied id occupies: the collision error is     # reserved for the caller who actually chose the id.     request_id = self._allocate_id()     while request_id in self._pending:         request_id = self._allocate_id() ```  The comment says minting should skip past any supplied id, but the guard only checks `self._pending`, and pending entries are popped when a request completes (line ~428). So for a supplied integer id (or nume
  **Post-Mortem & Fix Analysis**:
  > Confirmed against current `main` (`57394b0`): supplying `request_id=1`, letting it complete, then minting gives wire ids `[1, 1, 2, 3]` on both dispatchers.  I have a working fix on a branch, with one deliberate deviation from the proposed `max(self._next_id, pending_key)` advancement worth flagging before I open a PR: advancing at accept time also burns every id **below** a supplied one whenever it is accepted while still in flight, which flips the existing documented contract in `test_minted_ids_skip_a_caller_supplied_id_still_in_flight` from mints `[1, 2, 4]` to `[4, 5, 6]`.  Instead, accepted numeric keys are added to a small retired set; minting skips `pending ∪ retired` and prunes retired entries as the monotonic counter passes them. That fixes the reuse with zero change to any existing behavior:  - supplied `1` completes → mints `[2, 3, 4]` (was `[1, 1, 2]`) - supplied `"7"` completes → mints walk `[1..6, 8, 9, 10]` (7 skipped when reached) - supplied `"3"` still in flight → min
  > I independently confirmed the reproduction and root cause on current `main` (both dispatchers): the mint loop only consults the in-flight table, so once a supplied numeric id completes, the counter revisits it on the wire — `supplied 2, then three minted pings → [2, 1, 2]`.  Why it matters for my use case: I drive long-lived MCP client sessions where a supervisor layer supplies its own request ids for the initial setup calls (they double as correlation keys in our logs), then the session keeps issuing dispatcher-minted calls for hours. A minted id colliding with a completed supplied id is exactly the cross-wiring window #3060 describes on the receiving side, and it appeared in our logs as a response delivered to the wrong waiter.  Approach I would take (happy to be told a better one): when a supplied id is accepted, advance the mint counter past its coerced key — `if isinstance(key, int): self._next_id = max(self._next_id, key)` — in both `JSONRPCDispatcher.send_raw_request` and `Direc
  > I closed this with #3619, which is smaller than the fix you proposed. Your repro and root cause were both right, thank you.  The numbering stays as it is. The `CallOptions["request_id"]` docstring now says a numeric id can be minted again once its request has finished, so a non-numeric string is the way to keep an id unique for the whole session.  I did look at fixing it in code, but remembering every supplied id grows without bound, and moving the counter changes the minted ids for callers who already use this option.  If that leaves a real case uncovered, a new issue is very welcome.  <sub>[AI Disclaimer](https://gist.github.com/maxisbey/6123d132484e4c533eab519a2800693d)</sub> 

- **Issue #2707** (2026-06-09): **streamable_http: early response.aclose() poisons keepalive connection, causes ~260ms latency on every subsequent tool call**
  *Symptoms*: ## Summary  In `mcp.client.streamable_http.StreamableHTTPTransport._handle_sse_response`, the client calls `await response.aclose()` immediately after receiving the first JSON-RPC response event. This early close leaves the underlying HTTP/1.1 keepalive connection in a state where the **next** request reusing the same connection blocks for ~260 ms before the server's response status arrives.  The result is that every `session.call_tool(...)` (and `send_ping`, `list_tools`, ...) over `streamable_http` pays a fixed ~260 ms penalty when calls are serial on a single connection.  Removing the early `aclose()` and draining the SSE stream to EOF eliminates the penalty entirely (**37× speedup**: 265 ms → 7 ms per call in my setup).  ## Environment  - `mcp == 1.27.1` - Python 3.12.8, Windows 11 - Server: `mcp.server.streamable_http` (also 1.27.1), localhost, SSE response mode - Transport: streamable HTTP, single long-lived client session, sequential requests  ## Symptom (numbers)  Same `tools/call`, same server, same `httpx.AsyncClient`, all on localhost:  | Path | Avg latency | |---|---| | Raw `httpx.AsyncClient.stream("POST", ...)` + `aiter_bytes()` to EOF | **~5 ms** | | `ClientSession.call_tool(...)` (current code) | **~265 ms** | | `ClientSession.call_tool(...)` (with `aclose()` removed) | **~7 ms** |  Status code arrival timing (measured with raw httpx on the same client/headers): - Status: 1.5 ms - First chunk: 4.7 ms - EOF: 5 ms  So the server replies in single-digit ms. The 2
  **Post-Mortem & Fix Analysis**:
  > I think the fix should preserve the latency win from draining to EOF, but still keep a clear distinction between normal completion and abort paths.  A safe shape would be:  1. When `_handle_sse_event(...)` returns complete, set a local `saw_terminal_event = True` and keep iterating until the server closes the stream naturally. 2. Only use `response.aclose()` on cancellation, explicit client shutdown, or timeout/error paths where waiting for EOF is no longer correct. 3. Add one regression test that makes several serial `call_tool()` requests through the same `httpx.AsyncClient` and asserts the post-warmup calls stay in the low-ms range instead of paying a fixed per-call penalty. 4. Add one cancellation test so a stuck or long-lived SSE stream does not become uncloseable after this change.  That split usually avoids the common follow-on regression where fixing keepalive reuse accidentally makes shutdown semantics worse.
  > code paths identified but latency penalty not reproducible against the SDK's standalone test server. the reporter says the same in PR #2712: ~4 ms either way against uvicorn+sse-starlette, only ~265 ms against a FastMCP server co-resident with a desktop GUI on Windows. PR #2712 is open and proposes drain-to-EOF at all three early-close sites; it's sound HTTP/1.1 hygiene (don't release un-drained streaming bodies back to the pool) but cannot be guarded by a latency assertion in CI.  three early-close sites on main (commit 616476f) and origin/v1.x: - `_handle_sse_response` at src/mcp/client/streamable_http.py:364 - `_handle_resumption_request` at line 251 - `_handle_reconnection` at line 421  <details><summary>repro (Linux, main 616476f): avg ~7 ms — no penalty observed</summary>  ``` per-call (ms): ['7.8', '8.1', '7.8', '7.4', '7.3', '7.2', '7.5', '8.0', '7.0', '7.2', '7.0', '6.9', '7.4', '8.3', '7.8', '7.1', '7.0', '7.4', '7.1', '7.1'] avg = 7.42 ms   min = 6.92 ms   max = 8.30 ms NOT 
  > This looks worth pinning down as a protocol-level regression rather than only an implementation bug.  For `early response close poisons keepalive connection`, the acceptance test I would want is a minimal client/server fixture that records the exact JSON-RPC or HTTP exchange, then asserts both the wire result and the local lifecycle state after the failure path. In MCP deployments, the dangerous failures are often not just wrong return values; they are pending requests, dropped notifications, mismatched session state, or errors that get translated into a generic response and become impossible to diagnose.  A useful fix boundary would preserve three signals: the protocol error sent to the peer, the local exception or cancellation reason available to application code, and a trace/log field that ties the two together. That makes the behavior debuggable for agent hosts without requiring every host to special-case this SDK detail. 

- **Issue #2704** (2026-06-03): **Flaky streamable-HTTP/SSE tests: TOCTOU port race under pytest -n auto**
  *Symptoms*: ### Initial Checks  - [x] I confirm that I'm using the latest version of MCP Python SDK - [x] I confirm that I searched for my issue in https://github.com/modelcontextprotocol/python-sdk/issues before opening this issue  ### Description  ### Summary    Tests in `tests/shared/test_streamable_http.py` intermittently fail in CI (non-deterministically, across different Python versions). The failures are not real regressions, they're caused by a time-of-check/time-of-use (TOCTOU) race in how the test server fixtures allocate ports, which collides when tests run in parallel under pytest -n auto.  ### Evidence      The flakiness is intermittent and non-deterministic: the same commit, re-run across the CI matrix, fails on different tests and different Python versions, while passing locally and on most matrix entries. That pattern, a failure that moves around rather than reproducing on a specific test/version, is the signature of a parallelism race, not a code defect.    Two failure signatures have been observed, and both reduce to "the client connected to the wrong server instance":    1. Server can't bind the port (`test_streamable_http_client_session_termination_204`)    ERROR: [Errno 98] error while attempting to bind on address ('127.0.0.1', 35105): address already in use   AssertionError: assert 2 == 10   The intended server (10 tools) loses the bind race, so the client reaches a different test's server: `len(tools.tools)` comes back as `2` (the `echo_headers/echo_context server
  **Post-Mortem & Fix Analysis**:
  > Thanks for the feedback!  The implementation in this PR (#2705 ) follows this exact pattern. For both the thread-based helper (`run_uvicorn_in_thread`) and the process-based helper (`running_server`):     1. The socket is bound and put into a listening state on port `0` (`127.0.0.1:0`) in the thread/process prior to starting the server.     2. The port is derived directly from that active socket using `sock.getsockname()[1]`.     3. `uvicorn` is started by passing this pre-bound socket directly via `server.run(sockets=[sock])`.  Additionally, the old polling helper `wait_for_server` has been removed and there are no remaining custom `pick_free_port` helpers left in `test_helpers.py` that could be mistakenly reused.
  > test-infrastructure TOCTOU race confirmed. fix is to retire the `pick-a-port-then-rebind` fixtures and serve through the existing `run_uvicorn_in_thread` helper in `tests/test_helpers.py`, which binds + `listen()`s the socket before handing it to uvicorn so no other xdist worker can grab the port in between. same racy pattern is on `origin/v1.x` too, so a backport is needed if the fix lands on main only.  both failure signatures the report describes reproduce against `origin/main` HEAD 616476f. signature 1 — server bind raises `[Errno 98] address already in use` when something else won the race in the window. signature 2 — the client request lands on a different server than the fixture intended, returning a payload that belongs to another test (the `ValidationError: 1 validation error for CallToolResult / Field required` is exactly what pydantic produces when a `ListToolsResult` shape is parsed as `CallToolResult`).  racy fixtures (5 files): - `tests/shared/test_streamable_http.py:474,
  > Thanks, confirmation matches what #2705 implements. Good call on v1.x: it carries the same pick-a-port-then-rebind pattern (actually in more test files than main), so I'll open a [v1.x] backport PR applying the same fix once #2705 lands.

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

### Incident Patch 1: `ed9b2d61` (2026-10-02)
**Commit Message**: Stop counting an interactive OAuth login against request timeouts (#3635)

**File**: `src/mcp/client/auth/oauth2.py` (modified, +4/-4)
```diff
@@ -43,6 +43,7 @@
     validate_metadata_issuer,
 )
 from mcp.shared._httpx_utils import RedirectAwareAuth, redirect_note
+from mcp.shared._request_clock import waiting_on_a_person
 from mcp.shared.auth import (
     AuthorizationCodeResult,
     OAuthClientInformationFull,
@@ -425,10 +426,9 @@ async def _perform_authorization_code_grant(self) -> tuple[str, str]:
                 auth_params["prompt"] = "consent"
 
         authorization_url = f"{auth_endpoint}?{urlencode(auth_params)}"
-        await self.context.redirect_handler(authorization_url)
-
-        # Wait for callback
-        result = await self.context.callback_handler()
+        with waiting_on_a_person():
+            await self.context.redirect_handler(authorization_url)
+            result = await self.context.callback_handler()
 
         if result.state is None or not secrets.compare_digest(result.state, state):
             raise OAuthFlowError(f"State parameter mismatch: {result.state} != {state}")
```

**File**: `src/mcp/shared/_request_clock.py` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+"""A request's timeout measures the peer, so its clock stops while the request waits on a person.
+
+The clock travels in a `ContextVar`: the HTTP transports run each outgoing message in its sender's
+context, which is how code far below `send_raw_request` finds the clock of the request it serves.
+
+Nothing in this module is public API: it may change or be removed without notice. It is likely to
+change with the client dispatcher work in https://github.com/modelcontextprotocol/python-sdk/pull/3517.
+"""
+
+import math
+from collections.abc import Iterator
+from contextlib import contextmanager
+from contextvars import ContextVar
+
+import anyio
+
+
+class RequestClock:
+    """One request's timeout, as a budget of seconds that is spent only while the clock runs.
+
+    Not public API: may change or be removed without notice.
+    """
+
+    def __init__(self, timeout: float | None, scope: anyio.CancelScope) -> None:
+        self._budget = math.inf if timeout is None else timeout
+        self._scope = scope
+        self._pauses = 1  # the write, which is off the clock too; `start()` ends it
+
+    def start(self) -> None:
+        self.resume()
+
+    def pause(self) -> None:
+        if not self._pauses:
+            self._budget = self._scope.deadline - anyio.current_time()
+            self._scope.deadline = math.inf
+        self._pauses += 1
+
+    def resume(self) -> None:
+        self._pauses -= 1
+        if not self._pauses:
+            self._scope.deadline = anyio.current_time() + self._budget
+
+
+_clock: ContextVar[RequestClock | None] = ContextVar("request_clock", default=None)
+
+
+@contextmanager
+def request_clock(timeout: float | None) -> Iterator[RequestClock]:
+    """Put a clock, not yet started, in the context of the request sent in this block.
+
+    Raises `TimeoutError` once the clock has run for `timeout` seconds.
+
+    Not public API: may change or be removed without notice.
+    """
+    with anyio.CancelScope() as scope:
+        clock = RequestClock(timeout, scope)
+        token = _clock.set(clock)
+        try:
+            yield clock
+        finally:
+            _clock.reset(token)
+    # Not `fail_after`: it re-reads the deadline here, which a pause may have moved since it expired.
+    if scope.cancelled_caught:
+        raise TimeoutError
+
+
+@contextmanager
+def waiting_on_a_person() -> Iterator[None]:
+    """Stop the clock of the request this code is serving while the block is open; a no-op if there is none.
+
+    Not public API: may change or be removed without notice.
+    """
+    clock = _clock.get()
+    if clock is None:
+        yield
+        return
+    clock.pause()
+    try:
+        yield
+    finally:
+        clock.resume()
```

**File**: `src/mcp/shared/jsonrpc_dispatcher.py` (modified, +9/-7)
```diff
@@ -38,6 +38,7 @@
 
 from mcp.shared._compat import resync_tracer
 from mcp.shared._otel import inject_trace_context, otel_span
+from mcp.shared._request_clock import request_clock
 from mcp.shared._stream_protocols import ReadStream, WriteStream
 from mcp.shared.dispatcher import (
     CallOptions,
@@ -404,12 +405,13 @@ async def send_raw_request(
                 # never started; past this point a cancelled write counts as issued.
                 await anyio.lowlevel.checkpoint_if_cancelled()
                 request_write_started = True
-                try:
-                    await self._write(msg, plan.metadata)
-                except (anyio.BrokenResourceError, anyio.ClosedResourceError):
-                    # Transport tore down before run() noticed EOF; surface the documented contract.
-                    raise MCPError(code=CONNECTION_CLOSED, message="Connection closed") from None
-                with anyio.fail_after(opts.get("timeout")):
+                with request_clock(opts.get("timeout")) as clock:
+                    try:
+                        await self._write(msg, plan.metadata)
+                    except (anyio.BrokenResourceError, anyio.ClosedResourceError):
+                        # Transport tore down before run() noticed EOF; surface the documented contract.
+                        raise MCPError(code=CONNECTION_CLOSED, message="Connection closed") from None
+                    clock.start()
                     timeout_armed = True
                     outcome = await receive.receive()
                 if isinstance(outcome, ErrorData) and outcome is not _CLOSED_OUTCOME:
@@ -418,7 +420,7 @@ async def send_raw_request(
                     span.set_status(StatusCode.ERROR, outcome.message)
         except TimeoutError:
             if not timeout_armed:
-                # `fail_after` arms only after the write, so this TimeoutError is the
+                # The clock starts only after the write, so this TimeoutError is the
                 # transport's own bounded send() failing - a transport error, not
                 # `opts["timeout"]` elapsing. Propagate it raw (v1 kept the write
                 # outside the timeout-catching try and did the same).
```

**File**: `tests/interaction/_requirements.py` (modified, +28/-0)
```diff
@@ -430,6 +430,15 @@ def __post_init__(self) -> None:
         ),
         added_in="2026-07-28",
     ),
+    "lifecycle:discover:fallback-silence": Requirement(
+        source=f"{SPEC_2026_BASE_URL}/basic/transports/stdio#backward-compatibility",
+        behavior=(
+            "When server/discover goes unanswered for the probe deadline, an auto-negotiating client falls "
+            "back to the legacy initialize handshake."
+        ),
+        added_in="2026-07-28",
+        note="The spec states the timeout rule for stdio only; the SDK applies it on every transport.",
+    ),
     "lifecycle:discover:network-error-raises": Requirement(
         source="sdk",
         behavior=(
@@ -3826,6 +3835,25 @@ def __post_init__(self) -> None:
         transports=("streamable-http",),
         note="OAuth is HTTP-only.",
     ),
+    "client-auth:login-time:not-counted": Requirement(
+        source="issue:#3601",
+        behavior=(
+            "The time OAuthClientProvider spends awaiting redirect_handler and callback_handler does not count "
+            "against the timeout of the request that was challenged; afterwards the timeout resumes with the "
+            "budget that was left. The provider's own HTTP calls do count."
+        ),
+        transports=("streamable-http",),
+        note="OAuth is HTTP-only.",
+    ),
+    "client-auth:login-time:other-requests-keep-counting": Requirement(
+        source="sdk",
+        behavior=(
+            "A login suspends the timeout of the challenged request only: a request queued behind it in the "
+            "provider still times out on its own clock."
+        ),
+        transports=("streamable-http",),
+        note="OAuth is HTTP-only.",
+    ),
     "client-auth:pkce:refuse-if-unsupported": Requirement(
         source=f"{SPEC_BASE_URL}/basic/authorization#authorization-code-protection",
         behavior=(
```

**File**: `tests/interaction/auth/_harness.py` (modified, +10/-2)
```diff
@@ -418,6 +418,9 @@ async def connect_with_oauth(
     verify_tokens: bool = True,
     app_shim: Callable[[ASGIApp], ASGIApp] | None = None,
     on_request: Callable[[httpx2.Request], None] | None = None,
+    mode: str = "legacy",
+    read_timeout_seconds: float | None = None,
+    json_response: bool = False,
 ) -> AsyncIterator[tuple[Client, HeadlessOAuth]]:
     """Connect a `Client` to a server's bearer-gated streamable-HTTP app, completing OAuth in process.
 
@@ -455,6 +458,7 @@ async def connect_with_oauth(
     )
 
     app: ASGIApp = server.streamable_http_app(
+        json_response=json_response,
         auth=settings,
         token_verifier=ProviderTokenVerifier(provider) if verify_tokens else None,
         auth_server_provider=provider,
@@ -481,7 +485,11 @@ async def hook(request: httpx2.Request) -> None:
         )
         headless.bind(http_client)
         client = await stack.enter_async_context(
-            # The auth flow tests snapshot the legacy initialize-handshake HTTP shape.
-            Client(streamable_http_client(f"{BASE_URL}/mcp", http_client=http_client), mode="legacy")
+            # The auth flow tests snapshot the legacy initialize-handshake HTTP shape, hence the default mode.
+            Client(
+                streamable_http_client(f"{BASE_URL}/mcp", http_client=http_client),
+                mode=mode,
+                read_timeout_seconds=read_timeout_seconds,
+            )
         )
         yield client, headless
```

**File**: `tests/interaction/auth/test_login_time.py` (added, +341/-0)
```diff
@@ -0,0 +1,341 @@
+"""Request timeouts around an interactive OAuth login: they measure the server, not the person.
+
+A 401 makes `OAuthClientProvider` await the developer's `redirect_handler` and `callback_handler`
+inside the challenged HTTP request, so the person's time in the browser passes while that
+request's timeout is pending.
+
+Every test runs on trio's autojumping virtual clock: time advances only when every task is
+blocked, and then straight to the next deadline. In-process work therefore costs zero seconds, an
+hour-long login costs no real wait, and the recorded times are exact. The `fail_after` guards
+count virtual seconds too, so the ones around a login have to outlast it.
+
+The tests that reach the handshake era ask the server for JSON responses: there the client stops
+reading an SSE response at the answer, which leaves httpx2's generators to the garbage collector,
+and trio (unlike asyncio) reports that as a `ResourceWarning`.
+"""
+
+import json
+import math
+from collections.abc import Callable
+
+import anyio
+import httpx2
+import mcp_types as types
+import pytest
+from inline_snapshot import snapshot
+from mcp_types import REQUEST_TIMEOUT, ErrorData, ListToolsResult, Tool
+from mcp_types.version import LATEST_HANDSHAKE_VERSION, LATEST_MODERN_VERSION
+from starlette.types import ASGIApp, Receive, Scope, Send
+from trio.testing import MockClock
+
+from mcp import MCPError
+from mcp.client.session import DISCOVER_TIMEOUT_SECONDS
+from mcp.server import Server, ServerRequestContext
+from mcp.shared.auth import AuthorizationCodeResult
+from tests.interaction._requirements import requirement
+from tests.interaction.auth._harness import AppShim, HeadlessOAuth, connect_with_oauth
+from tests.interaction.auth._provider import InMemoryAuthorizationServerProvider
+
+pytestmark = [
+    pytest.mark.anyio,
+    pytest.mark.parametrize(
+        "anyio_backend",
+        [pytest.param(("trio", {"clock": MockClock(autojump_threshold=0)}), id="trio-mockclock")],
+    ),
+]
+
+LOGIN_SECONDS = DISCOVER_TIMEOUT_SECONDS * 360
+
+
+@pytest.fixture(autouse=True)
+def _module_runner_lease() -> None:
+    """Opt out of the shared per-module event loop: this module parametrizes `anyio_backend`."""
+
+
+class Person(HeadlessOAuth):
+    """Completes the authorize step like `HeadlessOAuth`, but takes `seconds` over it, half in each handler."""
+
+    def __init__(self, seconds: float) -> None:
+        super().__init__()
+        self._seconds = seconds
+        self.in_the_browser = anyio.Event()
+        self.abandoned = anyio.Event()
+
+    async def _take_half_the_time(self) -> None:
+        try:
+            await anyio.sleep(self._seconds / 2)  # virtual time: the clock jumps, nothing really waits
+        except anyio.get_cancelled_exc_class():
+            self.abandoned.set()
+            raise
+
+    async def redirect_handler(self, authorization_url: str) -> None:
+        self.in_the_browser.set()
+        await self._take_half_the_time()
+        await super().redirect_handler(authorization_url)
+
+    async def callback_handler(self) -> AuthorizationCodeResult:
+        await self._take_half_the_time()
+        return await super().callback_handler()
+
+
+async def list_tools(ctx: ServerRequestContext, params: types.PaginatedRequestParams | None) -> ListToolsResult:
+    return ListToolsResult(tools=[Tool(name="echo", input_schema={"type": "object"})])
+
+
+Timeline = list[tuple[float, str, bool]]
+
+
+def record_timeline() -> tuple[Timeline, Callable[[httpx2.Request], None]]:
+    """Build an `on_request` that logs each MCP POST as (virtual seconds since now, method, carries a token)."""
+    timeline: Timeline = []
+    start = anyio.current_time()
+
+    def on_request(request: httpx2.Request) -> None:
+        if request.method == "POST" and request.url.path == "/mcp":
+            seconds = round(anyio.current_time() - start, 9)
+            timeline.append((seconds, json.loads(request.content)["method"], "authorization" in request.headers))
+
+    return timeline, on_request
+
+
+def slow_then_silent_probe(*, challenge_after: float = 0.0) -> AppShim:
+    """Build an `app_shim` whose server takes its time over `server/discover` and answers everything else.
+
+    A probe without a token reaches the real app (and its 401) only after `challenge_after` seconds.
+    A probe that would be served, because it carries a token or the endpoint is not gated, gets an
+    SSE response that is opened and then never carries an event (the provider holds its lock until
+    a request's response headers arrive, so with none the fallback `initialize` could not be sent).
+    No real `Server` stalls on the probe, so the shim plays that part.
+    """
+
+    def factory(app: ASGIApp) -> ASGIApp:
+        async def wrapped(scope: Scope, receive: Receive, send: Send) -> None:
+            headers = dict(scope["headers"])
+            if headers.get(b"mcp-method") == b"server/discover":
+                if 
```

**File**: `tests/shared/test_request_clock.py` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+"""`request_clock` cases the end-to-end tests in `tests/interaction/auth/test_login_time.py` cannot produce."""
+
+from contextlib import ExitStack
+
+import anyio
+import pytest
+from trio.testing import MockClock
+
+from mcp.shared._request_clock import request_clock, waiting_on_a_person
+
+pytestmark = pytest.mark.anyio
+
+
+@pytest.fixture(autouse=True)
+def _module_runner_lease() -> None:
+    """Opt out of the shared per-module event loop: this module parametrizes `anyio_backend`."""
+
+
+# trio's autojumping virtual clock: the sleeps cost no real time and the measured seconds are exact.
+@pytest.mark.parametrize(
+    "anyio_backend",
+    [pytest.param(("trio", {"clock": MockClock(autojump_threshold=0)}), id="trio-mockclock")],
+)
+async def test_a_wait_that_began_before_the_clock_started_leaves_the_whole_budget() -> None:
+    """A transport may reach the person before `send_raw_request` gets to start the clock (its write
+    can hand the message over and only then yield), so starting must not resume a clock that is paused."""
+    began = anyio.current_time()
+
+    with anyio.fail_after(1000), pytest.raises(TimeoutError):  # virtual seconds, so the guard has to outlast the waits
+        with request_clock(10) as clock:
+            with waiting_on_a_person():
+                await anyio.sleep(60)
+                clock.start()
+                await anyio.sleep(60)
+            await anyio.sleep_forever()
+
+    assert anyio.current_time() - began == 60 + 60 + 10
+
+
+async def test_the_clock_stops_and_resumes_on_asyncio() -> None:
+    """The end-to-end tests need trio's virtual clock; this is the same stop and resume on the backend users run."""
+    outlasted_the_budget = False
+
+    with anyio.fail_after(5), pytest.raises(TimeoutError):
+        with request_clock(0.01) as clock:
+            clock.start()
+            with waiting_on_a_person():
+                await anyio.sleep(0.05)  # real time, under test: five budgets go by while the clock is stopped
+            outlasted_the_budget = True
+            await anyio.sleep_forever()
+
+    assert outlasted_the_budget
+
+
+async def test_a_wait_that_begins_after_the_budget_ran_out_does_not_swallow_the_timeout() -> None:
+    """The deadline fires, and before the waiting task wakes up the transport's task reaches the person.
+
+    asyncio only: there, starting a clock with nothing left cancels the scope on the spot, which puts
+    the two events in that order without a race. The wait outlives the request, as a login does.
+    """
+    with anyio.fail_after(5), ExitStack() as login, pytest.raises(TimeoutError):
+        with request_clock(0) as clock:
+            clock.start()
+            login.enter_context(waiting_on_a_person())
+            await anyio.sleep_forever()
```

---

### Incident Patch 2: `19e4f2a6` (2026-10-02)
**Commit Message**: Describe the ID-JAG confidential-client rule as SDK policy, not a SEP-990 requirement (#3622)

**File**: `docs/client/identity-assertion.md` (modified, +2/-1)
```diff
@@ -59,7 +59,7 @@ The extension does not demand this; it is a deliberately stricter choice. This c
 
 ### A confidential client
 
-`client_secret` is required; the constructor raises `ValueError` without one. The IETF profile underneath [SEP-990](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/990) reserves this grant for confidential clients, SEP-990 requires the client to authenticate, and this SDK enforces both by insisting on a shared secret. `token_endpoint_auth_method` picks where it travels: `client_secret_post` (the default, in the form body) or `client_secret_basic` (an HTTP Basic header). The profile also permits `private_key_jwt`; this provider does not support it.
+`client_secret` is required; the constructor raises `ValueError` without one. The IETF profile underneath [SEP-990](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/990) recommends this grant for confidential clients only, and [RFC 7521](https://datatracker.ietf.org/doc/html/rfc7521) leaves that policy to the authorization server. This SDK takes the conservative reading on both sides: the built-in authorization server refuses a client that has no shared secret, and this provider insists on one. `token_endpoint_auth_method` picks where it travels: `client_secret_post` (the default, in the form body) or `client_secret_basic` (an HTTP Basic header). The profile also permits `private_key_jwt`; this provider does not support it.
 
 !!! tip
     Read `client_secret` from the environment or a secret manager, never from source control.
@@ -86,6 +86,7 @@ The SDK can also *be* the authorization server: `create_auth_routes` returns the
 
 * `identity_assertion_enabled=True` gates everything. Off, which is the default, `/token` answers this grant with `unsupported_grant_type` even if you implemented the hook, and the metadata does not mention it. On, the metadata gains the `jwt-bearer` grant type and lists `urn:ietf:params:oauth:grant-profile:id-jag` in `authorization_grant_profiles_supported`, the field the extension uses to advertise support. (This SDK's client never reads it: it is provisioned for one issuer and simply asks.)
 * **`exchange_identity_assertion`** is the hook. Before it runs, the SDK has authenticated the client, refused public clients, and refused clients whose registration does not list the grant. You get an `IdentityAssertionParams` (the raw `assertion`, the requested `scopes` and `resource`) and return a plain `OAuthToken`.
+* Refusing public clients is SDK policy, not a spec requirement. The built-in server authenticates clients by shared secret only: it has no `private_key_jwt` support and doesn't resolve Client ID Metadata Documents yet ([#1801](https://github.com/modelcontextprotocol/python-sdk/issues/1801)), so a client identified by one can't use this grant here. A deployment that wants a different policy can swap the `/token` route that `create_auth_routes` returns for its own.
 * Dynamic client registration refuses this grant unconditionally, so `get_client` here serves a hand-provisioned client. An ID-JAG client cannot register itself into existence.
 * Half the class is refusals. `OAuthAuthorizationServerProvider` is the *whole* authorization server, so it also asks for the authorization-code flow; a server that signs users in as well implements those for real, and this one has exactly one door.
 
```

**File**: `examples/snippets/clients/identity_assertion_client.py` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 Obtaining the ID-JAG (logging into the IdP and the leg-1 exchange against it) is deployment-specific
 and out of scope for the SDK; supply it through the `assertion_provider` callback. The callback
 receives the authorization server's issuer (the ID-JAG `aud`) and the MCP server's resource
-identifier (the ID-JAG `resource` claim). SEP-990 requires a confidential client, so a client secret
+identifier (the ID-JAG `resource` claim). The provider requires a confidential client, so a client secret
 is mandatory, and `issuer` is the authorization server the credentials are provisioned for - the
 provider fetches metadata from that issuer's well-known and never asks the resource server which AS
 to use.
```

**File**: `examples/snippets/servers/identity_assertion_server.py` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ class IdentityAssertionProvider(OAuthAuthorizationServerProvider[AuthorizationCo
 
     def __init__(self) -> None:
         self.access_tokens: dict[str, AccessToken] = {}
-        # SEP-990 clients are pre-registered out of band (DCR refuses the grant) and must be
+        # ID-JAG clients here are pre-registered out of band (DCR refuses the grant) and must be
         # confidential. `get_client` must return them, or the token endpoint 401s before the
         # exchange runs. Real deployments load these from their own store.
         self.clients: dict[str, OAuthClientInformationFull] = {
```

**File**: `src/mcp/client/auth/extensions/identity_assertion.py` (modified, +2/-2)
```diff
@@ -104,7 +104,7 @@ def __init__(
             server_url: The MCP server URL.
             storage: Token storage implementation.
             client_id: The OAuth client ID registered with the MCP authorization server.
-            client_secret: The client secret. SEP-990 section 5.1 requires a confidential client.
+            client_secret: The client secret. This provider supports confidential clients only.
             issuer: The issuer identifier of the MCP authorization server this client is provisioned
                 for. Authorization-server metadata is fetched from this issuer's well-known and the
                 ID-JAG and secret are sent only to its token endpoint.
@@ -115,7 +115,7 @@ def __init__(
                 (default) or `client_secret_basic`.
         """
         if not client_secret:
-            raise ValueError("client_secret is required: SEP-990 mandates a confidential client")
+            raise ValueError("client_secret is required: this provider supports confidential clients only")
         if not issuer:
             raise ValueError("issuer is required: the authorization server is configuration, not discovery")
         self._resource = resource_url_from_server_url(server_url)
```

**File**: `src/mcp/server/auth/handlers/register.py` (modified, +3/-3)
```diff
@@ -91,9 +91,9 @@ async def handle(self, request: Request) -> Response:
                 status_code=400,
             )
 
-        # SEP-990 §5.1 / draft-ietf-oauth-identity-assertion-authz-grant §8.1: the ID-JAG flow is
-        # for confidential clients provisioned out of band. Refuse to grant it through DCR so a
-        # self-registered client cannot reach the identity-assertion provider hook.
+        # SDK policy: the ID-JAG flow is for confidential clients (a SHOULD in
+        # draft-ietf-oauth-identity-assertion-authz-grant-04 §9.1) provisioned out of band. Refuse to
+        # grant it through DCR so a self-registered client cannot reach the provider hook.
         if JWT_BEARER_GRANT_TYPE in client_metadata.grant_types:
             return PydanticJSONResponse(
                 content=RegistrationErrorResponse(
```

**File**: `src/mcp/server/auth/handlers/token.py` (modified, +4/-4)
```diff
@@ -248,10 +248,10 @@ async def handle(self, request: Request):
                         )
                     )
 
-                # SEP-990 §5.1: only confidential clients may present an ID-JAG. ClientAuthenticator
-                # already rejects a secret-based method with no stored secret; this additionally
-                # rejects the public `none` method so an unauthenticated client never reaches the
-                # provider hook.
+                # SDK policy, adopting the SHOULD in draft-ietf-oauth-identity-assertion-authz-grant-04
+                # §9.1: only confidential clients may present an ID-JAG. ClientAuthenticator already
+                # rejects a secret-based method with no stored secret; this additionally rejects the
+                # public `none` method so an unauthenticated client never reaches the provider hook.
                 if not client_info.client_secret:
                     # RFC 6749 §5.2: the client authenticated but is not permitted this grant, so
                     # unauthorized_client (not invalid_client, which is for failed authentication).
```

**File**: `tests/client/auth/extensions/test_identity_assertion.py` (modified, +6/-1)
```diff
@@ -11,6 +11,7 @@
 
 import httpx2
 import pytest
+from inline_snapshot import snapshot
 
 from mcp.client.auth import OAuthFlowError, OAuthTokenError
 from mcp.client.auth.extensions.identity_assertion import IdentityAssertionOAuthProvider, _origin
@@ -377,7 +378,7 @@ def test_empty_client_secret_is_rejected() -> None:
     async def assertion_provider(audience: str, resource: str) -> str:
         raise NotImplementedError
 
-    with pytest.raises(ValueError, match="client_secret is required"):
+    with pytest.raises(ValueError) as exc_info:
         IdentityAssertionOAuthProvider(
             server_url=f"{RS}/mcp",
             storage=InMemoryStorage(),
@@ -387,6 +388,10 @@ async def assertion_provider(audience: str, resource: str) -> str:
             assertion_provider=assertion_provider,
         )
 
+    assert str(exc_info.value) == snapshot(
+        "client_secret is required: this provider supports confidential clients only"
+    )
+
 
 def test_empty_issuer_is_rejected() -> None:
     async def assertion_provider(audience: str, resource: str) -> str:
```

---

### Incident Patch 3: `08095791` (2026-10-02)
**Commit Message**: Validate an explicit null structuredContent against the output schema (#3621)

**File**: `src/mcp/client/session.py` (modified, +1/-1)
```diff
@@ -1136,7 +1136,7 @@ async def validate_tool_result(self, name: str, result: types.CallToolResult) ->
             from jsonschema import exceptions as jsonschema_exceptions
             from referencing.exceptions import Unresolvable
 
-            if result.structured_content is None:
+            if result.structured_content is None and "structured_content" not in result.model_fields_set:
                 raise RuntimeError(f"Tool {name} has an output schema but did not return structured content")
             validator = self._output_schema_validator(name, output_schema)
             # `best_match` picks the same error the previous `jsonschema.validate()` call raised,
```

**File**: `tests/client/test_session.py` (modified, +65/-0)
```diff
@@ -9,6 +9,7 @@
 import anyio.streams.memory
 import mcp_types as types
 import pytest
+from inline_snapshot import snapshot
 from mcp_types import (
     CONNECTION_CLOSED,
     INTERNAL_ERROR,
@@ -1828,6 +1829,70 @@ async def test_a_2026_result_type_tag_from_a_legacy_server_never_reaches_the_res
     assert result.result_type == "complete"
 
 
+# --- null structuredContent ---
+# The results are scripted: a server built on this SDK leaves a null `structuredContent` off the wire.
+
+
+def _listing_with_output_schema(output_schema: dict[str, Any]) -> dict[str, Any]:
+    tool = {"name": "t", "inputSchema": {"type": "object"}, "outputSchema": output_schema}
+    return {"resultType": "complete", "tools": [tool], "ttlMs": 0, "cacheScope": "private"}
+
+
+@pytest.mark.anyio
+async def test_call_tool_accepts_a_null_structured_content_the_output_schema_permits() -> None:
+    """Spec (2026-07-28): `structuredContent` may be any JSON value, null included, so a null
+    the output schema permits is a valid result rather than missing structured content."""
+    dispatcher = _ScriptedDispatcher(
+        _discover_result_dict(),
+        _listing_with_output_schema({"type": ["object", "null"]}),
+        {"resultType": "complete", "content": [], "structuredContent": None},
+    )
+    with anyio.fail_after(5):
+        async with ClientSession(dispatcher=dispatcher) as session:
+            await session.discover()
+            await session.list_tools()
+            result = await session.call_tool("t", {})
+    assert isinstance(result, CallToolResult)
+    assert result.structured_content is None
+
+
+@pytest.mark.anyio
+async def test_call_tool_rejects_a_null_structured_content_the_output_schema_forbids() -> None:
+    """A null `structuredContent` is validated like any other value: against a schema that does
+    not permit null it fails as a schema mismatch, not as missing structured content."""
+    dispatcher = _ScriptedDispatcher(
+        _discover_result_dict(),
+        _listing_with_output_schema({"type": "object"}),
+        {"resultType": "complete", "content": [], "structuredContent": None},
+    )
+    with anyio.fail_after(5):
+        async with ClientSession(dispatcher=dispatcher) as session:
+            await session.discover()
+            await session.list_tools()
+            with pytest.raises(RuntimeError) as exc_info:
+                await session.call_tool("t", {})
+            # Stable SDK prefix only: the message tail is jsonschema text that shifts with the dependency.
+            assert str(exc_info.value).startswith("Invalid structured content returned by tool t")
+
+
+@pytest.mark.anyio
+async def test_call_tool_reports_an_absent_structured_content_as_missing_even_when_null_is_permitted() -> None:
+    """SDK-defined: only a result with no `structuredContent` field at all is reported as
+    missing structured content, and it is so even when the output schema would accept null."""
+    dispatcher = _ScriptedDispatcher(
+        _discover_result_dict(),
+        _listing_with_output_schema({"type": ["object", "null"]}),
+        {"resultType": "complete", "content": []},
+    )
+    with anyio.fail_after(5):
+        async with ClientSession(dispatcher=dispatcher) as session:
+            await session.discover()
+            await session.list_tools()
+            with pytest.raises(RuntimeError) as exc_info:
+                await session.call_tool("t", {})
+            assert str(exc_info.value) == snapshot("Tool t has an output schema but did not return structured content")
+
+
 @pytest.mark.anyio
 async def test_session_call_tool_returns_input_required_result_when_opted_in() -> None:
     """`ClientSession.call_tool(..., allow_input_required=True)` surfaces the
```

---

### Incident Patch 4: `ebf6e5a7` (2026-10-02)
**Commit Message**: Document the timeout a hand-built httpx2 client needs (#3618)

**File**: `docs/client/transports.md` (modified, +2/-0)
```diff
@@ -39,6 +39,8 @@ Two things to notice:
 * You own the `httpx2.AsyncClient`, so **you** enter and exit it. The SDK never closes a client it didn't create.
 * `streamable_http_client(url, http_client=...)` returns a transport, and `Client(transport)` accepts it like anything else.
 
+Keep the `timeout=`. It is the one the SDK's own client uses (30 seconds, 300 for reads); an `httpx2.AsyncClient` built without one gets `httpx2`'s 5-second default, and a tool call that runs longer than that fails with a read timeout.
+
 One TLS note: `httpx2` verifies certificates against the operating system trust store (via
 [`truststore`](https://pypi.org/project/truststore/)), not a bundled CA list. In an environment with
 no usable system CA store (some minimal containers), set the standard `SSL_CERT_FILE`/`SSL_CERT_DIR`
```

**File**: `docs_src/identity_assertion/tutorial001.py` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ async def fetch_id_jag(audience: str, resource: str) -> str:
 
 
 async def main() -> None:
-    async with httpx2.AsyncClient(auth=oauth) as http_client:
+    async with httpx2.AsyncClient(auth=oauth, timeout=httpx2.Timeout(30.0, read=300.0)) as http_client:
         transport = streamable_http_client("http://localhost:8001/mcp", http_client=http_client)
         async with Client(transport) as client:
             result = await client.list_tools()
```

**File**: `docs_src/oauth_clients/tutorial001.py` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ async def wait_for_callback() -> AuthorizationCodeResult:
 
 
 async def main() -> None:
-    async with httpx2.AsyncClient(auth=oauth) as http_client:
+    async with httpx2.AsyncClient(auth=oauth, timeout=httpx2.Timeout(30.0, read=300.0)) as http_client:
         transport = streamable_http_client("http://localhost:8001/mcp", http_client=http_client)
         async with Client(transport) as client:
             result = await client.list_tools()
```

**File**: `docs_src/oauth_clients/tutorial002.py` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ async def set_client_info(self, client_info: OAuthClientInformationFull) -> None
 
 
 async def main() -> None:
-    async with httpx2.AsyncClient(auth=oauth) as http_client:
+    async with httpx2.AsyncClient(auth=oauth, timeout=httpx2.Timeout(30.0, read=300.0)) as http_client:
         transport = streamable_http_client("http://localhost:8001/mcp", http_client=http_client)
         async with Client(transport) as client:
             result = await client.list_tools()
```

**File**: `examples/clients/simple-auth-client/mcp_simple_auth_client/main.py` (modified, +3/-1)
```diff
@@ -233,7 +233,9 @@ async def _default_redirect_handler(authorization_url: str) -> None:
                     await self._run_session(read_stream, write_stream)
             else:
                 print("📡 Opening StreamableHTTP transport connection with auth...")
-                async with httpx2.AsyncClient(auth=oauth_auth) as custom_client:
+                async with httpx2.AsyncClient(
+                    auth=oauth_auth, timeout=httpx2.Timeout(30.0, read=300.0)
+                ) as custom_client:
                     async with streamable_http_client(url=self.server_url, http_client=custom_client) as (
                         read_stream,
                         write_stream,
```

**File**: `examples/snippets/clients/identity_assertion_client.py` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ async def main() -> None:
         scope="user",
     )
 
-    async with httpx2.AsyncClient(auth=oauth_auth) as http_client:
+    async with httpx2.AsyncClient(auth=oauth_auth, timeout=httpx2.Timeout(30.0, read=300.0)) as http_client:
         async with streamable_http_client("http://localhost:8001/mcp", http_client=http_client) as (read, write):
             async with ClientSession(read, write) as session:
                 await session.initialize()
```

**File**: `examples/snippets/clients/oauth_client.py` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ async def main():
         callback_handler=handle_callback,
     )
 
-    async with httpx2.AsyncClient(auth=oauth_auth) as custom_client:
+    async with httpx2.AsyncClient(auth=oauth_auth, timeout=httpx2.Timeout(30.0, read=300.0)) as custom_client:
         async with streamable_http_client("http://localhost:8001/mcp", http_client=custom_client) as (read, write):
             async with ClientSession(read, write) as session:
                 await session.initialize()
```

**File**: `examples/stories/_harness.py` (modified, +3/-1)
```diff
@@ -182,7 +182,9 @@ async def _run() -> None:
                 # server origin and relative paths like "/mcp" resolve.
                 parts = urlsplit(url)
                 base = f"{parts.scheme}://{parts.netloc}"
-                http = await stack.enter_async_context(httpx2.AsyncClient(base_url=base))
+                http = await stack.enter_async_context(
+                    httpx2.AsyncClient(base_url=base, timeout=httpx2.Timeout(30.0, read=300.0))
+                )
                 make = targets
                 if build_auth is not None:
                     http.auth = build_auth(http)
```

---

### Incident Patch 5: `772ecf23` (2026-10-01)
**Commit Message**: Group Dependabot security updates for uv dependencies (#3611)

**File**: `.github/dependabot.yml` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ updates:
       python-packages:
         patterns:
           - "*"
+      python-security:
+        applies-to: security-updates
+        patterns:
+          - "*"
   - package-ecosystem: "github-actions"
     directory: "/"
     schedule:
```

---

### Incident Patch 6: `6affe5c0` (2026-09-16)
**Commit Message**: Detect event-loop blocking in tests (#3510)

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -77,6 +77,7 @@ dev = [
     "strict-no-cover",
     "logfire>=3.0.0",
     "opentelemetry-sdk>=1.39.1",
+    "blockbuster>=1.5.27",
 ]
 docs = [
     # Zensical is the Material team's successor to MkDocs; it natively
```

**File**: `src/mcp/client/stdio.py` (modified, +5/-4)
```diff
@@ -18,6 +18,7 @@
 
 import anyio
 import anyio.lowlevel
+import anyio.to_thread
 import mcp_types as types
 from anyio.abc import AsyncResource, Process
 from anyio.streams.text import TextReceiveStream
@@ -120,7 +121,7 @@ async def stdio_client(
         OSError: If the server process cannot be spawned.
         ValueError: If the spawn parameters are invalid (embedded NUL bytes).
     """
-    command = _get_executable_command(server.command)
+    command = await _get_executable_command(server.command)
 
     process = await _create_platform_compatible_process(
         command=command,
@@ -317,10 +318,10 @@ def _close_subprocess_transport(process: ServerProcess) -> None:
             close()
 
 
-def _get_executable_command(command: str) -> str:
+async def _get_executable_command(command: str) -> str:
     """Normalizes the command for the current platform."""
-    if sys.platform == "win32":  # pragma: no cover
-        return get_windows_executable_command(command)
+    if sys.platform == "win32":
+        return await anyio.to_thread.run_sync(get_windows_executable_command, command, abandon_on_cancel=True)
     else:  # pragma: lax no cover
         return command
 
```

**File**: `tests/client/test_stdio.py` (modified, +47/-0)
```diff
@@ -14,14 +14,18 @@
 import os
 import signal
 import sys
+import threading
 from collections.abc import Callable
 from contextlib import AsyncExitStack, suppress
 from pathlib import Path
+from types import SimpleNamespace
 from typing import TextIO, cast
 
 import anyio
 import anyio.abc
+import anyio.from_thread
 import anyio.lowlevel
+import anyio.to_thread
 import pytest
 import trio
 import trio.testing
@@ -199,6 +203,9 @@ def install_fake_process(
     """
     terminated: list[FakeProcess] = []
 
+    async def fake_get_executable_command(command: str) -> str:
+        return command
+
     async def fake_spawn(
         command: str,
         args: list[str],
@@ -212,6 +219,7 @@ async def fake_terminate_tree(proc: FakeProcess) -> None:
         terminated.append(proc)
         proc.exit(-15)
 
+    monkeypatch.setattr(stdio, "_get_executable_command", fake_get_executable_command)
     monkeypatch.setattr(stdio, "_create_platform_compatible_process", fake_spawn)
     monkeypatch.setattr(stdio, "_terminate_process_tree", fake_terminate_tree)
     if grace_period is not None:
@@ -568,6 +576,45 @@ async def test_a_command_that_cannot_be_execed_raises_enoent() -> None:
     assert exc_info.value.errno == errno.ENOENT
 
 
+@pytest.mark.anyio
+async def test_cancellation_during_windows_command_resolution_returns_before_resolution_finishes(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """Cancelling `stdio_client` does not wait for blocked Windows command resolution."""
+    resolution_started = anyio.Event()
+    resolution_release = threading.Event()
+    resolution_finished = threading.Event()
+
+    def blocking_resolver(command: str) -> str:
+        anyio.from_thread.run_sync(resolution_started.set)
+        resolution_release.wait()
+        resolution_finished.set()
+        return command
+
+    monkeypatch.setattr(stdio, "sys", SimpleNamespace(platform="win32"))
+    monkeypatch.setattr(stdio, "get_windows_executable_command", blocking_resolver)
+
+    cancel_scope = anyio.CancelScope()
+    client_stopped = anyio.Event()
+
+    async def run_client() -> None:
+        with cancel_scope:
+            async with AsyncExitStack() as stack:
+                await stack.enter_async_context(stdio_client(FAKE_PARAMS))
+        client_stopped.set()
+
+    with anyio.fail_after(5):
+        async with anyio.create_task_group() as tg:
+            tg.start_soon(run_client)
+            await resolution_started.wait()
+            cancel_scope.cancel()
+            try:
+                await client_stopped.wait()
+            finally:
+                resolution_release.set()
+            await anyio.to_thread.run_sync(resolution_finished.wait)
+
+
 @pytest.mark.anyio
 async def test_cancellation_during_spawn_leaks_no_streams(monkeypatch: pytest.MonkeyPatch) -> None:
     """Cancellation while the spawn is still in flight must not leak the internal streams.
```

**File**: `tests/conftest.py` (modified, +26/-0)
```diff
@@ -1,7 +1,9 @@
 import os
 from collections.abc import AsyncIterator, Iterator
 
+import httpcore2 as _httpcore2
 import pytest
+from blockbuster import BlockBuster
 
 # OpenTelemetry's `set_tracer_provider` is set-once per process, so the suite
 # uses a single span-capture mechanism: logfire's `capfire` fixture (its
@@ -17,12 +19,36 @@
 
 import mcp.shared._otel  # noqa: E402
 
+# Load httpx2's lazy default transport before BlockBuster starts.
+del _httpcore2
+
 
 @pytest.fixture(scope="session")
 def anyio_backend() -> str:
     return "asyncio"
 
 
+@pytest.fixture(autouse=True)
+def blockbuster() -> Iterator[None]:
+    bb = BlockBuster(["mcp", "mcp_types"])
+    # Coverage reads source files while collecting data.
+    bb.functions["os.stat"].can_block_in("coverage/python.py", "get_python_source")
+    bb.functions["io.BufferedReader.read"].can_block_in("coverage/python.py", "read_python_source")
+    # jsonschema discovers its bundled schemas during its first import.
+    bb.functions["os.listdir"].can_block_in("/jsonschema_specifications/_core.py", "_schemas")
+    bb.functions["os.scandir"].can_block_in("/jsonschema_specifications/_core.py", "_schemas")
+    bb.functions["io.TextIOWrapper.read"].can_block_in("/jsonschema_specifications/_core.py", "_schemas")
+    # These public synchronous conversions read the media file by design.
+    bb.functions["io.BufferedReader.read"].can_block_in(
+        "mcp/server/mcpserver/utilities/types.py", ("to_image_content", "to_audio_content")
+    )
+    bb.activate()
+    try:
+        yield
+    finally:
+        bb.deactivate()
+
+
 @pytest.fixture(scope="module", autouse=True)
 async def _module_runner_lease(anyio_backend: str) -> AsyncIterator[None]:
     """Share one event loop across each module's tests instead of one per test.
```

**File**: `uv.lock` (modified, +20/-0)
```diff
@@ -154,6 +154,18 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/8e/0d/52d98722666d6fc6c3dd4c76df339501d6efd40e0ff95e6186a7b7f0befd/black-26.3.1-py3-none-any.whl", hash = "sha256:2bd5aa94fc267d38bb21a70d7410a89f1a1d318841855f698746f8e7f51acd1b", size = 207542, upload-time = "2026-03-12T03:36:01.668Z" },
 ]
 
+[[package]]
+name = "blockbuster"
+version = "1.5.27"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "forbiddenfruit", marker = "implementation_name == 'cpython'" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/ff/c3/21678f5b979be2cbf0e68352f7330a84ea4e24674023e4de981c78a218cd/blockbuster-1.5.27.tar.gz", hash = "sha256:b8e9d988b9b91ba468c94530e219f26a00d3ff616b39ebf3da561a2a3eea9dd4", size = 96732, upload-time = "2026-08-17T23:53:13.378Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/63/c5/092e631bc1fba86f0a822be65c137c90a71b71ba0a0865e7e9a21f6ca05e/blockbuster-1.5.27-py3-none-any.whl", hash = "sha256:f0acf153d22a791bf5f142935332ef8530960ec215541b48a6037e6cea0a8645", size = 13517, upload-time = "2026-08-17T23:53:14.625Z" },
+]
+
 [[package]]
 name = "certifi"
 version = "2025.8.3"
@@ -577,6 +589,12 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/c1/ea/53f2148663b321f21b5a606bd5f191517cf40b7072c0497d3c92c4a13b1e/executing-2.2.1-py2.py3-none-any.whl", hash = "sha256:760643d3452b4d777d295bb167ccc74c64a81df23fb5e08eff250c425a4b2017", size = 28317, upload-time = "2025-09-01T09:48:08.5Z" },
 ]
 
+[[package]]
+name = "forbiddenfruit"
+version = "0.1.4"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/e6/79/d4f20e91327c98096d605646bdc6a5ffedae820f38d378d3515c42ec5e60/forbiddenfruit-0.1.4.tar.gz", hash = "sha256:e3f7e66561a29ae129aac139a85d610dbf3dd896128187ed5454b6421f624253", size = 43756, upload-time = "2021-01-16T21:03:35.401Z" }
+
 [[package]]
 name = "genson"
 version = "1.3.0"
@@ -1023,6 +1041,7 @@ codegen = [
     { name = "datamodel-code-generator" },
 ]
 dev = [
+    { name = "blockbuster" },
     { name = "coverage", extra = ["toml"] },
     { name = "dirty-equals" },
     { name = "inline-snapshot" },
@@ -1081,6 +1100,7 @@ provides-extras = ["cli", "rich"]
 [package.metadata.requires-dev]
 codegen = [{ name = "datamodel-code-generator", specifier = "==0.57.0" }]
 dev = [
+    { name = "blockbuster", specifier = ">=1.5.27" },
     { name = "coverage", extras = ["toml"], specifier = ">=7.10.7,<=7.13" },
     { name = "dirty-equals", specifier = ">=0.9.0" },
     { name = "inline-snapshot", specifier = ">=0.23.0" },
```

---

### Incident Patch 7: `7bb486a1` (2026-09-05)
**Commit Message**: docs: stop presenting the in-memory client as the way to connect (#3443)

**File**: `docs/advanced/apps.md` (modified, +25/-4)
```diff
@@ -20,7 +20,7 @@ then come back.
 
 ## A clock with a face
 
-```python title="server.py" hl_lines="19 22 30 32"
+```python title="server.py" hl_lines="17 20 28 30"
 --8<-- "docs_src/apps/tutorial001.py"
 ```
 
@@ -51,15 +51,36 @@ The model reads `content`; the iframe is for humans. A UI-capable host still fee
 the text result to the model, and a text-only client gets *only* that. So the
 canonical pattern is one tool, two answers. Look at `get_time` again:
 
-```python title="server.py" hl_lines="23-27"
+```python title="server.py" hl_lines="21-25"
 --8<-- "docs_src/apps/tutorial001.py"
 ```
 
 `client_supports_apps(ctx)` is `True` only when the client declared the
 `io.modelcontextprotocol/ui` extension **and** listed `text/html;profile=mcp-app`
 in its `mimeTypes` settings. The field is required, so a client that omits it
-does not count. That is exactly what `main()` in the same file declares: the
-client half of the negotiation, and the rich answer comes back.
+does not count. Here is the client half of the negotiation:
+
+```python title="client.py" hl_lines="8 12"
+--8<-- "docs_src/apps/tutorial001_client.py"
+```
+
+Serve `server.py` over HTTP, then run the client from a second terminal:
+
+```console
+uv run mcp run server.py --transport streamable-http
+```
+
+```console
+python client.py
+```
+
+```text
+2026-06-26T12:00:00Z
+```
+
+The rich answer came back. Drop `extensions=[APPS_SUPPORT]` from the `Client` call
+and the same program prints `The time is 2026-06-26T12:00:00Z.` instead, which is
+all a text-only client ever sees.
 
 !!! warning
     Never return a placeholder like `"[Rendered UI]"` as the only content. If the
```

**File**: `docs/advanced/extensions.md` (modified, +42/-18)
```diff
@@ -57,7 +57,7 @@ specified by the MCP project itself.
 
 The smallest useful extension is one tool and a settings map:
 
-```python title="server.py" hl_lines="17 19-20 22-23 26"
+```python title="server.py" hl_lines="16 18-19 21-22 25"
 --8<-- "docs_src/extensions/tutorial003.py"
 ```
 
@@ -69,18 +69,25 @@ The smallest useful extension is one tool and a settings map:
 * The extension never receives the server. It declares contributions as data;
   `MCPServer` consumes them. There is no `self.server` to mutate.
 
-And `main()` is the proof, an in-memory client straight against `mcp`:
+Serve it over HTTP, and a client is the proof:
 
-```python title="server.py" hl_lines="29-34"
---8<-- "docs_src/extensions/tutorial003.py"
+```console
+uv run mcp run server.py --transport streamable-http
+```
+
+```python title="client.py" hl_lines="7-11"
+--8<-- "docs_src/extensions/tutorial003_client.py"
 ```
 
+Every `server.py` on this page is served with that command, and every `client.py`
+runs beside it with `python client.py` from a second terminal.
+
 ### Serving your own methods
 
 An extension can register **new request methods**: its own verbs, served next to the
 spec's:
 
-```python title="server.py" hl_lines="16-22 31 40-48"
+```python title="server.py" hl_lines="14-20 24 33-41"
 --8<-- "docs_src/extensions/tutorial004.py"
 ```
 
@@ -107,10 +114,10 @@ runtime:
 
 ### The client side
 
-The same file's `main()` is the whole client story, both halves of it:
+The client is its own program, and it carries both halves of the client story:
 
-```python title="server.py" hl_lines="54-58"
---8<-- "docs_src/extensions/tutorial004.py"
+```python title="client.py" hl_lines="21-23 27-30"
+--8<-- "docs_src/extensions/tutorial004_client.py"
 ```
 
 * `Client(..., extensions=[advertise(EXTENSION_ID)])` declares the extension. The
@@ -122,6 +129,9 @@ The same file's `main()` is the whole client story, both halves of it:
 * Vendor methods drop one layer to `client.session.send_request(...)`; `Client`
   only grows first-class methods for spec verbs. `send_request` accepts any
   `Request` subclass, so the vendor request passes as-is.
+* `SearchRequest` and the two models it carries are the extension's wire contract,
+  so the client declares them for itself. A published extension would ship them in
+  a package that both sides import.
 
 ### Intercepting `tools/call`
 
@@ -155,13 +165,20 @@ The hook wraps `tools/call` and nothing else. For every-message concerns, use
 ## Using a client extension
 
 A **client extension** is the same contract from the consuming side: a bundle of
-client-side behaviour behind one identifier. Pass instances to
-`Client(extensions=[...])` and call tools normally:
+client-side behaviour behind one identifier. The server here answers `buy` with a
+receipt to redeem instead of the goods, and only for a client that declared the
+extension:
 
-```python title="client.py" hl_lines="66-68"
+```python title="server.py" hl_lines="22-25"
 --8<-- "docs_src/extensions/tutorial006.py"
 ```
 
+On the client, pass instances to `Client(extensions=[...])` and call tools normally:
+
+```python title="client.py" hl_lines="33-35"
+--8<-- "docs_src/extensions/tutorial006_client.py"
+```
+
 `call_tool("buy", ...)` returns a plain `CallToolResult`, like every other call. What
 the extension changed: the server may now answer `buy` with a `receipt` **result
 shape** instead of a final result, and `Receipts` finishes it (here by redeeming the
@@ -180,16 +197,16 @@ the capability, the client does nothing, as in the search client above), use
 ```python
 from mcp.client import advertise
 
-client = Client(mcp, extensions=[advertise("com.example/search")])
+client = Client("http://localhost:8000/mcp", extensions=[advertise("com.example/search")])
 ```
 
 ## Writing a client extension
 
 Subclass `ClientExtension` and override only what you need. Three contribution
 kinds, each with a default: `settings()`, `claims()`, and `notifications()`.
 
-```python title="client.py" hl_lines="17-18 43-44 46-47"
---8<-- "docs_src/extensions/tutorial006.py"
+```python title="client.py" hl_lines="16-17 25-26 28-29"
+--8<-- "docs_src/extensions/tutorial006_client.py"
 ```
 
 * The identifier follows the same grammar as the server's, validated when the class
@@ -227,14 +244,21 @@ claimed shape reaching a session-tier caller raises `UnexpectedClaimedResult`.
 
 An extension's own request methods need no client-side registration. A vendor request
 type subclasses `mcp.types.Request` and goes through `client.session.send_request`,
-as in [Serving your own methods](#serving-your-own-methods). One addition: when a
-params key must ride the `Mcp-Name` header (extension specs such as tasks require
-this for their verbs), the request type declares `name_param`:
+as in [Serving your own methods](#serving-your-own-methods). Take a server whose
+extension serves one verb about a named job:
 
-```python title="client.py" hl_lines="22-25 46-47"
+```pytho
```

**File**: `docs/advanced/low-level-server.md` (modified, +12/-6)
```diff
@@ -31,18 +31,22 @@ Three things changed, and they are the whole low-level API:
 
 ### Try it
 
-There is no Inspector for this one: `mcp dev` and `mcp run` only accept an `MCPServer`. The in-memory `Client` doesn't care; it takes a low-level `Server` exactly like it takes an `MCPServer`:
+`mcp dev` and `mcp run` only accept an `MCPServer`, so you serve this one yourself. The last line of `server.py` builds an ordinary ASGI app from it, and uvicorn runs that:
 
-```python title="main.py"
+```console
+uvicorn server:app --port 8000
+```
+
+Point the Inspector, or any client, at `http://localhost:8000/mcp`:
+
+```python title="client.py"
 import asyncio
 
 from mcp import Client
 
-from server import server
-
 
 async def main() -> None:
-    async with Client(server) as client:
+    async with Client("http://localhost:8000/mcp") as client:
         result = await client.call_tool("search_books", {"query": "dune", "limit": 5})
         print(result.content)
 
@@ -59,6 +63,8 @@ The same text the `@mcp.tool()` version produced. Two honest differences:
 * `result.structured_content` is `None`. The high-level server wraps a `-> str` into `{"result": ...}` for you; here nobody builds what you didn't build.
 * `list_tools` returns the schema **you** typed, character for character. The high-level version had `"title": "Query"` on every property and a `"title": "search_booksArguments"` at the root: Pydantic artifacts. Down here, if it's on the wire, you put it there.
 
+In a test you skip uvicorn and the port: `Client(server)` takes a low-level `Server` in-process exactly like it takes an `MCPServer`, and **[Testing](../get-started/testing.md)** is that pattern.
+
 ## Nothing is checked for you
 
 `MCPServer` rejects a bad argument before your function ever runs, validating the call against the schema it generated (**[Tools](../servers/tools.md)**).
@@ -210,4 +216,4 @@ Each of these is one idea you now have the vocabulary for; each has its own page
 * `add_request_handler(method, params_type, handler)` serves any method. `initialize` is reserved.
 * The capabilities a `Server` advertises are derived from which handlers you registered.
 
-`Client(server)` treated both servers identically because they *are* the same protocol, which is the whole point. The next layer down isn't a class at all: it's **[Middleware](middleware.md)**.
+The client treated both servers identically because they *are* the same protocol, which is the whole point. The next layer down isn't a class at all: it's **[Middleware](middleware.md)**.
```

**File**: `docs/advanced/pagination.md` (modified, +8/-4)
```diff
@@ -26,9 +26,13 @@ Pagination is for the server whose resource list is really a database: thousands
 
 ### Try it
 
-`Client(server)` connects to a low-level `Server` in memory exactly as it connects to an `MCPServer`.
+`mcp run` only accepts an `MCPServer`, so you serve this one yourself. The last line of `server.py` builds an ordinary ASGI app from the `Server`, and uvicorn runs that:
 
-Call `list_resources()` with no arguments. You get ten resources, `book-1` through `book-10`, and `next_cursor` is the string `"10"`.
+```console
+uvicorn server:app --port 8000
+```
+
+Point any client (**[The Client](../client/index.md)**, or the Inspector) at `http://localhost:8000/mcp` and call `list_resources()` with no arguments. You get ten resources, `book-1` through `book-10`, and `next_cursor` is the string `"10"`.
 
 Hand it back with `list_resources(cursor="10")` and the first resource is `book-11`, the new `next_cursor` is `"20"`.
 
@@ -38,15 +42,15 @@ The tenth page comes back with `next_cursor` set to `None`. Done.
 
 Every `list_*` method on `Client` (`list_tools`, `list_resources`, `list_resource_templates`, `list_prompts`) takes a `cursor=` keyword. Draining a paged list is one `while True`:
 
-```python title="client.py" hl_lines="26-32"
+```python title="client.py" hl_lines="9-15"
 --8<-- "docs_src/pagination/tutorial002.py"
 ```
 
 * `cursor` starts as `None`, so the first request carries no cursor.
 * Extend **before** you look at `next_cursor`: the last page has resources too.
 * `next_cursor is None` is the exit. Anything else goes straight back into `cursor=`, untouched.
 
-Run its `main()` and it prints `100 resources`: ten pages of ten, stitched together by a loop that never knew there were ten pages.
+With uvicorn still serving `server.py`, run `python client.py` in a second terminal. It prints `100 resources`: ten pages of ten, stitched together by a loop that never knew there were ten pages.
 
 This is the same loop **[The Client](../client/index.md)** shows for every `list_*` verb, and it costs nothing against a server that doesn't page: `next_cursor` is `None` on the first response and the loop runs once.
 
```

**File**: `docs/client/caching.md` (modified, +17/-3)
```diff
@@ -25,7 +25,7 @@ Out of the box every result says `ttlMs: 0, cacheScope: "private"`: immediately
 
 On the low-level `Server`, handlers build their results by hand, and `ttl_ms` / `cache_scope` are just fields on the result models. A handler that sets them explicitly always wins over the constructor map, field by field:
 
-```python title="server.py" hl_lines="10 16"
+```python title="server.py" hl_lines="11 17"
 --8<-- "docs_src/caching/tutorial002.py"
 ```
 
@@ -39,10 +39,24 @@ One caveat on paginated lists: the protocol requires the **same `cacheScope` on
 
 On a 2026-07-28 session, `Client` honors the hints for you: it has a built-in response cache, on by default. A result that arrives carrying a `ttlMs` is stored, and an identical call within that TTL is served from the cache with no round trip. A result that carries *no* hint is not cached: hint-less results get `CacheConfig.default_ttl_ms`, which defaults to `0` (immediately stale), so a server that declares nothing sees exactly the call-for-call traffic it always did.
 
-```python title="client.py" hl_lines="33 35 38"
+To watch that happen, serve the `server.py` from the previous section with uvicorn (its last line builds the ASGI app). The handler prints a line every time it actually runs:
+
+```console
+uvicorn server:app --port 8000
+```
+
+```python title="client.py" hl_lines="20 23 28"
 --8<-- "docs_src/caching/tutorial003.py"
 ```
 
+Run `python client.py` from a second terminal. It prints the hints the first result carried, the handler's `ttlMs` next to the map's `cacheScope`:
+
+```text
+1000 public
+```
+
+The server's terminal tells the rest of the story: between uvicorn's request logs, `tools/list served` appears three times.
+
 Four calls, three fetches. The second call found a fresh entry and never reached the server; advancing the (injected) clock past the TTL made the third fetch again; the fourth said `cache_mode="refresh"`. That kwarg exists on the five caching verbs (`list_tools`, `list_prompts`, `list_resources`, `list_resource_templates`, `read_resource`):
 
 * `"use"` (the default) serves a fresh entry if there is one, and stores the fetch if not.
@@ -51,7 +65,7 @@ Four calls, three fetches. The second call found a fresh entry and never reached
 
 One rule sits above `"use"`: **calls carrying `meta` always reach the server.** A request with `meta` set (a progress token, tracing fields) expects a wire request, so under `cache_mode="use"` it is treated as `"refresh"`: the cache read is skipped, and the fetched result still replaces the cached entry. `"bypass"` and an explicit `"refresh"` behave as they always do.
 
-To turn caching off entirely, construct with `Client(server, cache=None)`: every call is a round trip again, and `cache_mode`, while still accepted, does nothing.
+To turn caching off entirely, pass `cache=None` when constructing the `Client`: every call is a round trip again, and `cache_mode`, while still accepted, does nothing.
 
 Scope is honored automatically too: `"private"` entries are keyed to the cache's *partition* (below), while `"public"` ones may opt into wider sharing. And **notifications beat TTL** for the exact entries they name: a `list_changed` notification evicts the matching cached listing, and `resources/updated` evicts the cached read stored under exactly its URI, however fresh they were. On a 2026-07-28 connection those notifications arrive on a `subscriptions/listen` stream you open with `client.listen(...)`, and eviction completes before your watcher sees the event; **[Subscriptions](subscriptions.md)** is that page.
 
```

**File**: `docs/client/callbacks.md` (modified, +2/-2)
```diff
@@ -58,7 +58,7 @@ One `tools/call` from you, one `elicitation/create` back from the server, answer
     `mode="legacy"` on the `Client(...)` call is doing real work. By default `Client(...)` negotiates the modern
     protocol path, and that path has no back-channel for server-to-client requests: `ctx.elicit`
     fails before your callback ever runs. The transport doesn't decide that; the negotiated
-    protocol does, in-memory and over a URL alike. Pin `mode="legacy"` whenever your client has
+    protocol does. Pin `mode="legacy"` whenever your client has
     to answer one; every test behind this page does. **[Protocol versions](../protocol-versions.md)** has the whole story.
 
     On a 2026-07-28 session the callback isn't dead, it's fed differently: when a tool returns an
@@ -146,4 +146,4 @@ Two more. Neither declares anything.
 * `sampling_callback` and `list_roots_callback` work the same way but serve deprecated features; modern servers use multi-round-trip requests instead.
 * `logging_callback` and `message_handler` receive notifications. They declare nothing.
 
-The first argument to `Client(...)` is a transport object. **[Client transports](transports.md)** covers every kind.
+The first argument to `Client(...)` picks the transport. **[Client transports](transports.md)** covers every kind.
```

**File**: `docs/client/index.md` (modified, +29/-17)
```diff
@@ -6,24 +6,34 @@ It is one object with one lifecycle: construct it, enter `async with`, call meth
 
 ## Your first client
 
-```python title="client.py" hl_lines="14-18"
+A client needs a server to talk to. This Bookshop is the one every snippet on this page connects to. Save it as `server.py` and leave it running over HTTP:
+
+```python title="server.py"
 --8<-- "docs_src/client/tutorial001.py"
 ```
 
-The server at the top is only there so you have something to connect to. The client is the five highlighted lines.
+```console
+uv run mcp run server.py --transport streamable-http
+```
+
+That serves it at `http://localhost:8000/mcp`. The client is its own program. Save it as `client.py` and run `python client.py` in a second terminal:
 
-* `Client(mcp)` is given the **server object itself**. That is the in-memory transport: no subprocess, no port, no HTTP. It is how every example on this page, and every test you write, connects.
+```python title="client.py" hl_lines="7-11"
+--8<-- "docs_src/client/tutorial001_client.py"
+```
+
+* `Client("http://localhost:8000/mcp")` is given a **URL**, so it connects over Streamable HTTP to the server you just started.
 * `async with` is the **lifecycle**. Entering it connects and negotiates; leaving it disconnects. There is no `connect()` / `close()` pair, and a `Client` cannot be reused after the block ends.
 * Inside the block the connection facts are already there as plain properties.
 
 ### What you can pass to `Client`
 
 `Client` takes one positional argument and resolves the transport from its type:
 
-* An `MCPServer` (or low-level `Server`) instance: connected **in-process**.
-* A URL string (`Client("http://localhost:8000/mcp")`): Streamable HTTP, the production path.
-* A `StdioServerParameters`: the command to launch as a **subprocess**, spoken to over its stdin and stdout.
+* A URL string (`Client("http://localhost:8000/mcp")`): Streamable HTTP, the transport you deploy behind.
+* A `StdioServerParameters`: the command to launch as a local **subprocess**, spoken to over its stdin and stdout.
 * A **transport**: anything you can `async with ... as (read, write)`, such as `streamable_http_client(url, http_client=...)` around your own HTTP client.
+* An `MCPServer` (or low-level `Server`) instance: connected **in-process**, with no subprocess and no port. That one is for tests, and **[Testing](../get-started/testing.md)** builds on it.
 
 Everything else on this page is identical across all four. Headers, subprocesses, timeouts, and the `Transport` protocol get their own page: **[Client transports](transports.md)**.
 
@@ -44,11 +54,11 @@ You never picked a protocol version. By default the `Client` probes the server a
 
 ## Listing tools
 
-```python title="client.py" hl_lines="15-20"
+```python title="client.py" hl_lines="8-13"
 --8<-- "docs_src/client/tutorial002.py"
 ```
 
-`list_tools()` returns a `ListToolsResult`; the tools are in `.tools`. Each one is the complete definition a host would hand to a model:
+`list_tools()` returns a `ListToolsResult`; the tools are in `.tools`. Each one is the complete definition a host would hand to a model. Here is the first:
 
 ```python
 tool.name          # 'search_books'
@@ -72,6 +82,8 @@ and `tool.input_schema` is the JSON Schema the server derived from the function'
 
 That schema is everything a UI needs to render an argument form, and everything a model needs to produce valid arguments.
 
+The second tool, `lookup_book`, was registered without a `title=`, so its `tool.title` is `None`.
+
 !!! tip
     `title` is optional, so a UI showing tools to a human has to pick: the `title` if there is one,
     the `name` if not. `from mcp.shared.metadata_utils import get_display_name` does exactly that,
@@ -81,7 +93,7 @@ That schema is everything a UI needs to render an argument form, and everything
 
 `call_tool(name, arguments)` runs the tool and gives you back a `CallToolResult`.
 
-```python title="client.py" hl_lines="27-34"
+```python title="client.py" hl_lines="9-16"
 --8<-- "docs_src/client/tutorial003.py"
 ```
 
@@ -137,7 +149,7 @@ A tool that raises does **not** raise in your client. It comes back as an ordina
 
 The resource verbs come in pairs: two ways to list, one way to read.
 
-```python title="client.py" hl_lines="22-31"
+```python title="client.py" hl_lines="9-18"
 --8<-- "docs_src/client/tutorial004.py"
 ```
 
@@ -151,7 +163,7 @@ A client can also be told when a resource changes. On 2025-era connections that
 
 ## Prompts
 
-```python title="client.py" hl_lines="15-20"
+```python title="client.py" hl_lines="8-13"
 --8<-- "docs_src/client/tutorial005.py"
 ```
 
@@ -176,7 +188,7 @@ A host hands those messages straight to the model. That is the whole feature.
 
 A server with a completion handler can autocomplete prompt and resource-template arguments as the user types.
 
-```python title="client.py" hl_lines="27-31"
+```python title="client.py" hl_lines="9-13"
 --8<-- "docs_src/client/tutorial006.py"
 ```
 
```

**File**: `docs/client/oauth-clients.md` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ You wrote none of it. Two keyword arguments remain (`client_metadata_url` and `v
 
 ### Try it
 
-Most examples in these docs you can check with an in-memory `Client(server)`. Not this: the whole point of the flow is an HTTP `401`, and there is no HTTP between an in-memory client and its server.
+The in-memory `Client(server)` your tests use is no help here: the whole point of the flow is an HTTP `401`, and there is no HTTP between an in-memory client and its server.
 
 The repository ships the live version. `examples/servers/simple-auth/` runs a standalone authorization server and a protected MCP server; `examples/clients/simple-auth-client/` is this page's client grown into a small CLI. Its README has the two commands: start the servers, run the client against them, and you watch the four steps go by.
 
```

---

### Incident Patch 8: `10dc1736` (2026-09-04)
**Commit Message**: Exercise the SEP-2575 stateless probes and SEP-2243 resource/prompt headers in the conformance fixtures (#3442)

**File**: `.github/actions/conformance/client.py` (modified, +18/-5)
```diff
@@ -20,7 +20,7 @@
     json-schema-ref-no-deref                - Connect, list tools (no $ref deref)
     json-schema-2020-12-preservation        - List tools, echo the focal inputSchema back verbatim
     request-metadata                        - Connect with all callbacks; client stamps _meta
-    http-standard-headers                   - Connect, call a tool (Mcp-* headers checked)
+    http-standard-headers                   - Tool, resource and prompt round-trips (Mcp-* headers checked)
     http-invalid-tool-headers               - List tools, call every surfaced tool (x-mcp-header filter)
     http-custom-headers                     - Replay the harness's toolCalls (x-mcp-header -> Mcp-Param-*)
     elicitation-sep1034-client-defaults     - Elicitation with default accept callback
@@ -311,11 +311,24 @@ async def run_request_metadata(server_url: str) -> None:
 
 @register("http-standard-headers")
 async def run_http_standard_headers(server_url: str) -> None:
-    """Connect on the modern path so Mcp-Method / Mcp-Name / MCP-Protocol-Version are sent (SEP-2243)."""
+    """Touch tools, resources and prompts on the modern path so each standard header is checked (SEP-2243).
+
+    The scenario inspects Mcp-Method on each request and Mcp-Name on tools/call,
+    resources/read and prompts/get, and reports methods the client never sent as
+    SKIPPED rather than failed, so exercise one of each. initialize and
+    notifications/initialized stay SKIPPED: the modern path discovers via
+    server/discover and never sends them.
+    """
     async with Client(server_url, mode=client_mode()) as client:
-        await client.list_tools()
-        result = await client.call_tool("add_numbers", {"a": 5, "b": 3})
-        logger.debug(f"add_numbers result: {result}")
+        tools = await client.list_tools()
+        if tools.tools:
+            await client.call_tool(tools.tools[0].name, _stub_required_args(tools.tools[0].input_schema))
+        resources = await client.list_resources()
+        if resources.resources:
+            await client.read_resource(resources.resources[0].uri)
+        prompts = await client.list_prompts()
+        if prompts.prompts:
+            await client.get_prompt(prompts.prompts[0].name)
 
 
 def _stub_required_args(input_schema: dict[str, Any]) -> dict[str, Any]:
```

**File**: `examples/servers/everything-server/mcp_everything_server/server.py` (modified, +31/-1)
```diff
@@ -12,7 +12,7 @@
 
 import click
 from mcp.server import ServerRequestContext
-from mcp.server.mcpserver import Context, MCPServer, RequestStateSecurity
+from mcp.server.mcpserver import Context, Elicit, ElicitationResult, MCPServer, RequestStateSecurity, Resolve
 from mcp.server.mcpserver.exceptions import ToolError
 from mcp.server.mcpserver.prompts.base import Prompt, UserMessage
 from mcp.server.streamable_http import EventCallback, EventMessage, EventStore
@@ -350,6 +350,9 @@ def test_x_mcp_header(
     return f"region={region}"
 
 
+# SEP-2575 server-stateless diagnostics (the conformance scenario probes these tools by name)
+
+
 @mcp.tool()
 async def test_missing_capability(ctx: Context) -> str:
     """Tests that a handler-raised MISSING_REQUIRED_CLIENT_CAPABILITY surfaces as a top-level JSON-RPC error.
@@ -370,6 +373,33 @@ async def test_missing_capability(ctx: Context) -> str:
     return "Client declared sampling capability; proceeding."
 
 
+def _ask_stream_probe() -> Elicit[UserResponse]:
+    return Elicit("The stateless streaming probe asks for a word", UserResponse)
+
+
+@mcp.tool()
+async def test_streaming_elicitation(
+    answer: Annotated[ElicitationResult[UserResponse], Resolve(_ask_stream_probe)],
+) -> str:
+    """A tool that needs elicitation, asked through a resolver (SEP-2575 / SEP-2322).
+
+    On 2026-07-28 the question is returned as an InputRequiredResult rather than sent
+    on the response stream; on earlier versions it is a mid-call elicitation request.
+    """
+    return f"elicitation {answer.action}"
+
+
+@mcp.tool()
+async def test_logging_tool(ctx: Context) -> str:
+    """Logs once on the request-scoped channel (SEP-2575).
+
+    On 2026-07-28 the message is delivered only when the request's `_meta` sets
+    `io.modelcontextprotocol/logLevel`.
+    """
+    await ctx.info("test_logging_tool ran")  # pyright: ignore[reportDeprecated]
+    return "logged through the request-scoped, logLevel-gated channel"
+
+
 # SEP-2322 InputRequiredResult fixtures (multi-round-trip / ephemeral workflow)
 
 NAME_SCHEMA = {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}
```

---

### Incident Patch 9: `0921d94a` (2026-08-25)
**Commit Message**: Point imports of mcp.server.fastmcp at the migration guide (#3388)

**File**: `docs/migration.md` (modified, +3/-1)
```diff
@@ -17,7 +17,7 @@ Every section heading below names the API it affects, so searching this page for
 
 | Change | First symptom | Section |
 |---|---|---|
-| `FastMCP` renamed to `MCPServer` | `ModuleNotFoundError: No module named 'mcp.server.fastmcp'` | [`FastMCP` renamed](#fastmcp-renamed-to-mcpserver) |
+| `FastMCP` renamed to `MCPServer` | `ModuleNotFoundError: No module named 'mcp.server.fastmcp'` (newer 2.x releases follow it with a pointer to this guide) | [`FastMCP` renamed](#fastmcp-renamed-to-mcpserver) |
 | Fields renamed from camelCase to snake_case | `AttributeError: 'Tool' object has no attribute 'inputSchema'` | [snake_case fields](#field-names-changed-from-camelcase-to-snake_case) |
 | `mcp.types` names removed | `ImportError: cannot import name 'Content' from 'mcp.types'` | [Removed types](#removed-type-aliases-and-classes) |
 | `McpError` renamed to `MCPError` | `ImportError: cannot import name 'McpError' from 'mcp'` | [`McpError` renamed](#mcperror-renamed-to-mcperror) |
@@ -672,6 +672,8 @@ All submodules under `mcp.server.fastmcp.*` are now under `mcp.server.mcpserver.
 - `ToolError`, `ResourceError` — from `mcp.server.mcpserver.exceptions`
 - `MCPServerError` (renamed from `FastMCPError`) — from `mcp.server.mcpserver.exceptions`
 
+Importing `mcp.server.fastmcp`, or anything below it, raises `ModuleNotFoundError` (newer 2.x releases include a link to this section in its message), so existing `except ImportError` or `except ModuleNotFoundError` fallbacks around the v1 import keep working.
+
 ### What is unchanged on `MCPServer`
 
 Beyond the changes covered in this section, the everyday `FastMCP` surface carries over to `MCPServer` as-is:
```

**File**: `scripts/docs/gen_ref_pages.py` (modified, +6/-5)
```diff
@@ -31,11 +31,12 @@
 # it from `src/` would emit the unimportable `mcp-types.mcp_types.*`.
 PACKAGES = (ROOT / "src" / "mcp", ROOT / "src" / "mcp-types" / "mcp_types")
 
-# Alias packages that mirror another package's namespaces (`mcp.types` mirrors
-# `mcp_types`, `mcp.types.version` mirrors `mcp_types.version`): the mirrored
-# package's pages are the canonical rendering, so an alias, and every module
-# under it, earns no page of its own.
-EXCLUDED = frozenset({"mcp.types"})
+# Module paths that get no page, and neither does anything under them: alias
+# packages that mirror another package's namespaces (`mcp.types` mirrors
+# `mcp_types`), whose canonical rendering is the mirrored package's pages; and
+# removed v1 import paths (`mcp.server.fastmcp`) that only raise a pointer to
+# the migration guide and carry no API.
+EXCLUDED = frozenset({"mcp.types", "mcp.server.fastmcp"})
 
 _KIND_SECTIONS = {
     griffe.Kind.MODULE: "Modules",
```

**File**: `src/mcp/server/fastmcp.py` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+"""Removed in mcp 2: `FastMCP` is now `mcp.server.mcpserver.MCPServer`.
+
+This module has no API. Importing it, or anything below it, raises
+`ModuleNotFoundError` with a message that points at the migration guide. It
+exists only because the bare "No module named 'mcp.server.fastmcp'" gave v1
+code no hint that the installed SDK is a different major version.
+"""
+
+_MESSAGE = (
+    "No module named 'mcp.server.fastmcp'. This is mcp 2.x, where FastMCP was renamed to MCPServer "
+    "(from mcp.server.mcpserver import MCPServer) and other APIs changed; see the migration guide at "
+    "https://py.sdk.modelcontextprotocol.io/v2/migration/#fastmcp-renamed-to-mcpserver "
+    "or pin 'mcp<2' to keep running v1 code."
+)
+
+raise ModuleNotFoundError(_MESSAGE, name=__name__)
```

**File**: `tests/server/test_fastmcp.py` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+"""The removed v1 import path `mcp.server.fastmcp` fails with a pointer to the migration guide."""
+
+import importlib
+import sys
+
+import pytest
+from inline_snapshot import snapshot
+
+import mcp.server
+from mcp.server.mcpserver import MCPServer
+
+
+def test_importing_fastmcp_raises_module_not_found_that_points_at_the_migration_guide() -> None:
+    """SDK-defined: the v1 path fails with the same exception type and `.name` as a module
+    that genuinely does not exist, but the message names the replacement and the guide."""
+    with pytest.raises(ModuleNotFoundError) as exc_info:
+        importlib.import_module("mcp.server.fastmcp")
+
+    assert exc_info.value.name == "mcp.server.fastmcp"
+    assert str(exc_info.value) == snapshot(
+        "No module named 'mcp.server.fastmcp'. This is mcp 2.x, where FastMCP was renamed to MCPServer "
+        "(from mcp.server.mcpserver import MCPServer) and other APIs changed; see the migration guide at "
+        "https://py.sdk.modelcontextprotocol.io/v2/migration/#fastmcp-renamed-to-mcpserver "
+        "or pin 'mcp<2' to keep running v1 code."
+    )
+    # A module that raises while executing is never cached, so nothing is left behind.
+    assert "mcp.server.fastmcp" not in sys.modules
+    assert not hasattr(mcp.server, "fastmcp")
+
+
+def test_importing_a_fastmcp_submodule_raises_the_parent_pointer() -> None:
+    """SDK-defined: a deep v1 path executes `mcp.server.fastmcp` first, so it fails with that
+    module's message and `.name` rather than a bare error for the leaf."""
+    with pytest.raises(ModuleNotFoundError) as parent:
+        importlib.import_module("mcp.server.fastmcp")
+    with pytest.raises(ModuleNotFoundError) as exc_info:
+        importlib.import_module("mcp.server.fastmcp.utilities.types")
+
+    assert exc_info.value.name == "mcp.server.fastmcp"
+    assert str(exc_info.value) == str(parent.value)
+
+
+def test_v1_first_import_shim_falls_back_to_mcpserver() -> None:
+    """SDK-defined: projects that support both majors try the v1 import and fall back on
+    `ModuleNotFoundError` (the narrowest guard seen in the wild), which is why the pointer is
+    raised as exactly that type and not as a bare `ImportError` or after a warning."""
+    fell_back = False
+    try:
+        server_class: type = importlib.import_module("mcp.server.fastmcp").FastMCP
+    except ModuleNotFoundError:
+        fell_back = True
+        server_class = MCPServer
+
+    assert fell_back
+    assert server_class is MCPServer
```

---

### Incident Patch 10: `4d6f87e8` (2026-08-24)
**Commit Message**: Build releases with the pinned hatchling and a publish action that accepts Metadata 2.5 (#3380)

**File**: `.github/workflows/publish-pypi.yml` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ jobs:
         uses: astral-sh/setup-uv@fac544c07dec837d0ccb6301d7b5580bf5edae39 # v8.2.0
         with:
           enable-cache: false
-          version: 0.9.5
+          version: 0.12.5
 
       - name: Set up Python 3.12
         run: uv python install 3.12
@@ -57,7 +57,7 @@ jobs:
           path: dist/
 
       - name: Publish package distributions to PyPI
-        uses: pypa/gh-action-pypi-publish@cef221092ed1bacb1cc03d23a2d87d1d172e277b # release/v1
+        uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33 # v1.14.2
         with:
           # Lets a re-run after a partially failed upload publish the remaining
           # files instead of erroring on the ones already on PyPI.
```

---

### Incident Patch 11: `56af4472` (2026-08-24)
**Commit Message**: Log MCPServer handler exceptions by kind and keep crash details off the wire (#3314)

Co-authored-by: Marcelo Trylesinski <[REDACTED_EMAIL]>

**File**: `docs/client/index.md` (modified, +6/-5)
```diff
@@ -81,7 +81,7 @@ That schema is everything a UI needs to render an argument form, and everything
 
 `call_tool(name, arguments)` runs the tool and gives you back a `CallToolResult`.
 
-```python title="client.py" hl_lines="26-33"
+```python title="client.py" hl_lines="27-34"
 --8<-- "docs_src/client/tutorial003.py"
 ```
 
@@ -113,17 +113,18 @@ A tool that raises does **not** raise in your client. It comes back as an ordina
 
 !!! check
     Ask `lookup_book` for `"Solaris"` (a title that isn't in the catalog) and the function raises
-    `ValueError`. The call still returns normally:
+    `ToolError`. The call still returns normally:
 
     ```python
     result.is_error            # True
     result.content             # [TextContent(type='text', text="Error executing tool lookup_book: No book titled 'Solaris' in the catalog.")]
     result.structured_content  # None
     ```
 
-    The exception's message landed in `content`, where the **model** can read it and try again. That
-    is deliberate: a tool error is part of the conversation, not a crash. Always look at `is_error`
-    before you trust `structured_content`.
+    The `ToolError`'s message landed in `content`, where the **model** can read it and try again. That
+    is deliberate: a tool error is part of the conversation, not a crash. (Had the tool crashed with
+    some other exception, `content` would say only `Error executing tool lookup_book`.) Always look at
+    `is_error` before you trust `structured_content`.
 
 !!! warning
     `is_error=True` covers more than your own `raise`. Ask for a tool the server doesn't even have
```

**File**: `docs/deprecated.md` (modified, +13/-3)
```diff
@@ -1,6 +1,6 @@
 # Deprecated features
 
-The 2026-07-28 spec retires five things. The SDK still implements every one of them, and every one of them now carries a **deprecation warning**.
+The 2026-07-28 spec retires five things. The SDK still implements every one of them, and every one of them now carries a **deprecation warning**. One SDK helper is deprecated on its own account and is listed [at the end](#deprecated-sdk-helpers).
 
 The table below names each deprecated feature, why it is going away, and the replacement to build on.
 
@@ -119,22 +119,32 @@ That is the whole API. There is no per-method switch, and you don't want one: th
     Run the filter the other way and you get a free regression test. Add
     `"error::mcp.MCPDeprecationWarning"` to the `filterwarnings` setting in your pytest
     configuration and the deprecated call **raises** instead of warning. A tool named
-    `old_log` that still calls `ctx.info()` stops passing and starts reporting:
+    `old_log` that still calls `ctx.info()` stops passing: the call comes back `is_error=True` with
+    `Error executing tool old_log`, and the captured server log names the culprit:
 
     ```text
-    Error executing tool old_log: The logging capability is deprecated as of 2026-07-28 (SEP-2577).
+    mcp.shared.exceptions.MCPDeprecationWarning: The logging capability is deprecated as of 2026-07-28 (SEP-2577).
     ```
 
     One line of pytest configuration, and a deprecated call can never sneak back into your
     codebase without failing a test.
 
+## Deprecated SDK helpers
+
+These are not spec changes, only SDK internals with a better replacement. They warn with the same `MCPDeprecationWarning` and will be removed in 3.0.
+
+| Deprecated | What you do instead |
+|---|---|
+| `FuncMetadata.call_fn_with_arg_validation()` | `FuncMetadata.validate_arguments()` and then `FuncMetadata.call_fn()`. Only code that drives `FuncMetadata` directly (a custom `Tool` subclass, say) ever called it. |
+
 ## Recap
 
 * The 2026-07-28 spec deprecates **roots**, server-initiated **sampling**, and protocol **logging** (all [SEP-2577](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2577)), restricts **progress** to server-to-client, and removes **`ping`**.
 * The replacement column points you onward: **[Multi-round-trip requests](handlers/multi-round-trip.md)** for sampling and roots, **[Logging](handlers/logging.md)** for logging, **[Progress](handlers/progress.md)** for progress. `ping` needs nothing at all.
 * Deprecated is advisory: no wire changes, everything keeps working against pre-2026 sessions, and you get a visible `MCPDeprecationWarning` (a `UserWarning`, so it is on by default).
 * Sampling and roots additionally need a back-channel that a 2026-07-28 session does not have. On a modern connection they warn and then they raise.
 * `warnings.filterwarnings("ignore", category=MCPDeprecationWarning)` silences the whole category; `"error::mcp.MCPDeprecationWarning"` in pytest turns it into a test failure.
+* One SDK helper, `FuncMetadata.call_fn_with_arg_validation()`, is deprecated separately for removal in 3.0.
 * New code should not be built on any of these.
 
 Every other page in these docs teaches the current API.
```

**File**: `docs/get-started/real-host.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ Which means connecting to a host is one act: you tell it **the command that star
 
 ## One server, every host
 
-```python title="server.py" hl_lines="3 33-34"
+```python title="server.py" hl_lines="4 34-35"
 --8<-- "docs_src/real_host/tutorial001.py"
 ```
 
```

**File**: `docs/get-started/testing.md` (modified, +2/-2)
```diff
@@ -79,8 +79,8 @@ There you go! You can now extend your tests to cover more scenarios.
 Two different things can go wrong, and this flag only touches one of them.
 
 An exception inside one of **your tools** is not a protocol failure. It becomes a normal result with
-`is_error=True`, and the model reads the message. `raise_exceptions` doesn't change that: with or
-without it, `call_tool` returns the same `is_error=True` result. There's a whole page on it:
+`is_error=True` (and if it was a `ToolError`, the model reads your message). `raise_exceptions` doesn't
+change that: with or without it, `call_tool` returns the same `is_error=True` result. There's a whole page on it:
 **[Handling errors](../servers/handling-errors.md)**.
 
 A failure **outside** a tool body is different. On the connection `Client(mcp)` gives you, the
```

**File**: `docs/handlers/elicitation.md` (modified, +4/-3)
```diff
@@ -84,7 +84,8 @@ That schema is the form. `Field(description=...)` is the label; a default pre-fi
 !!! warning
     An elicitation schema is not as expressive as a tool's input schema. Flat, primitive fields
     only: `str`, `int`, `float`, `bool`, or a `Literal` of strings (it becomes an `enum`).
-    Put a model inside the model and `ctx.elicit` raises before anything is sent to the client:
+    Put a model inside the model and `ctx.elicit` raises before anything is sent to the client.
+    The tool call fails with `Error executing tool <name>`, and your server log has the reason:
 
     ```text
     TypeError: Elicitation schema field 'address' rendered as {'$ref': '#/$defs/Address'}, which is not a valid PrimitiveSchemaDefinition
@@ -107,8 +108,8 @@ A refusal is not an error. The tool decides what declining means (here, no booki
 
 !!! tip
     The answer is validated against your model before your code sees it. A client that sends
-    `"maybe"` for a `bool` doesn't corrupt your booking: the call fails with a
-    schema-mismatch error, your `if` never runs.
+    `"maybe"` for a `bool` doesn't corrupt your booking: `ctx.elicit` raises `ValueError`, the call
+    fails, and your `if` never runs.
 
 ## Send the user to a URL
 
```

**File**: `docs/handlers/logging.md` (modified, +2/-0)
```diff
@@ -49,6 +49,8 @@ The default is `"INFO"`.
 
 `logging.basicConfig()` never replaces handlers that already exist. If you configure logging yourself before creating the server, your configuration wins.
 
+You also don't need a `try`/`except` in every handler just to record failures. When a tool or resource function raises, the SDK logs it for you. **[Handling errors](../servers/handling-errors.md#any-other-exception)** explains what gets logged and at which level.
+
 ## Try it
 
 Run the server with the MCP Inspector:
```

**File**: `docs/migration.md` (modified, +4/-4)
```diff
@@ -992,8 +992,8 @@ its behavior is unchanged.
 `MCPError` carries `ErrorData` and is the SDK's protocol-error type — raise it
 when the request itself should be rejected (missing client capability,
 elicitation required, invalid parameters). For tool *execution* failures the
-calling LLM should see and react to, raise any other exception or return
-`CallToolResult(is_error=True, ...)` directly; that path is unchanged.
+calling LLM should see and react to, raise `ToolError` or return
+`CallToolResult(is_error=True, ...)` directly.
 
 The client sees this change too. `Client.call_tool()` and
 `ClientSession.call_tool()` raise on a JSON-RPC error response, so a tool that
@@ -1016,7 +1016,7 @@ except MCPError as e:
 
 ### Resource not found returns `-32602` and resource lookups raise typed exceptions (SEP-2164)
 
-Reading a missing resource now returns JSON-RPC error code `-32602` (invalid params) with the requested URI in `error.data` (`{"uri": ...}`), per [SEP-2164](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2164). Previously the server returned code `0` with no `data`. Clients can now reliably distinguish not-found from other errors; a template handler that raises `ResourceNotFoundError` (from `mcp.server.mcpserver.exceptions`) produces this same response.
+Reading a missing resource now returns JSON-RPC error code `-32602` (invalid params) with the requested URI in `error.data` (`{"uri": ...}`), per [SEP-2164](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2164). Previously the server returned code `0` with no `data`. Clients can now reliably distinguish not-found from other errors; a resource handler (static or template) that raises `ResourceNotFoundError` (from `mcp.server.mcpserver.exceptions`) produces this same response.
 
 The underlying lookups now raise typed exceptions instead of `ValueError`. `ResourceManager.get_resource()` raises `ResourceNotFoundError` when no resource or template matches the URI, and `ResourceTemplate.create_resource()` raises `ResourceError` when the template function fails. Neither subclasses `ValueError`, so callers catching `ValueError` should switch to `ResourceNotFoundError` / `ResourceError` (both importable from `mcp.server.mcpserver.exceptions`; `ResourceNotFoundError` subclasses `ResourceError`).
 
@@ -2737,7 +2737,7 @@ One behavioral caveat when moving progress-reporting handlers onto `Client(serve
 
 Every deprecation below is a runtime warning as well as a type-checker one: deprecated methods and helpers emit `mcp.MCPDeprecationWarning` on each call, and the deprecated `Server(...)` constructor parameters (`on_set_logging_level`, `on_roots_list_changed`, `on_progress`) emit it at construction time. The category subclasses `UserWarning`, not `DeprecationWarning`, so it is visible by default; [Deprecated features](deprecated.md) has the full list and each replacement.
 
-Under pytest's `filterwarnings = ["error"]`, that warning becomes an exception at the first deprecated call. Inside an `@mcp.tool()` handler the exception is caught like any other and returned as `CallToolResult(is_error=True)` (`Error executing tool ...: The logging capability is deprecated as of 2026-07-28 (SEP-2577).`), which reads as a failing tool rather than a warning. Keep the warnings visible but non-fatal with:
+Under pytest's `filterwarnings = ["error"]`, that warning becomes an exception at the first deprecated call. Inside an `@mcp.tool()` handler the exception is caught like any other and returned as `CallToolResult(is_error=True)` (`Error executing tool ...`, with the `MCPDeprecationWarning` traceback in the server log), which reads as a failing tool rather than a warning. Keep the warnings visible but non-fatal with:
 
 ```toml
 [tool.pytest.ini_options]
```

**File**: `docs/servers/handling-errors.md` (modified, +40/-17)
```diff
@@ -1,20 +1,20 @@
 # Handling errors
 
-A tool can fail in two ways, and the SDK treats them very differently.
+A tool can fail in three ways, and the SDK treats each differently.
 
-Raise an ordinary exception and the **model** sees it. Raise `MCPError` and the **protocol** sees it.
+Raise `ToolError` and the **model** sees your message. Raise `MCPError` and the **protocol** sees it. Raise anything else and it is a crash: the model learns only that the call failed, and your log gets the traceback.
 
 This page is about choosing.
 
 ## An error the model can fix
 
 Take a tool that looks something up, and let the lookup miss:
 
-```python title="server.py" hl_lines="11-12"
+```python title="server.py" hl_lines="2 12-13"
 --8<-- "docs_src/handling_errors/tutorial001.py"
 ```
 
-There is nothing MCP about those two lines. `get_author` raises a plain `ValueError`, the way any Python function would.
+`ToolError`, from `mcp.server.mcpserver.exceptions`, is how a tool tells the model that something went wrong.
 
 Call it with a title that isn't in the catalog and look at the result:
 
@@ -25,21 +25,23 @@ result.structured_content  # None
 ```
 
 * The request **succeeded**. There is a result; nothing was raised at the caller.
-* `is_error` is `True`, and your exception's message (prefixed with the tool name) is in `content`, exactly where the model reads.
+* `is_error` is `True`, and your message (prefixed with the tool name) is in `content`, exactly where the model reads.
 * `structured_content` is `None`. A failed call has no return value to structure.
 
-This is a **tool error**, and it is the default for *any* exception your tool raises. It is also almost always what you want.
+This is a **tool error**, and it is almost always what you want.
 
 The model is the one calling your tool. It picked the arguments. So a tool error is a turn in the conversation: the model reads *"No book titled 'Nothing' in the catalog."*, realises it guessed the title wrong, and calls again with a better one. You wrote one `raise` and got a self-correcting agent.
 
+On the server, a `ToolError` is one `INFO` line in the log, with no traceback. You saw it coming, so there is nothing to investigate.
+
 !!! tip
     Never `return` an error message from a tool. A returned string has `is_error=False`, so to the
     model (and to every client UI) it looks like the tool worked and that string was the answer.
     `raise`. The flag is the signal.
 
 ## An error the model cannot fix
 
-Now swap `ValueError` for `MCPError`.
+Now swap `ToolError` for `MCPError`.
 
 ```python title="server.py" hl_lines="1 3 14"
 --8<-- "docs_src/handling_errors/tutorial002.py"
@@ -72,10 +74,10 @@ Now swap `ValueError` for `MCPError`.
 
 The two paths answer two different questions.
 
-* **Raise any exception** for a failure of *execution*: the thing your tool tried to do didn't work. The model chose the call, so the model should see the consequence and get a chance to recover. A misspelled title, an upstream API that timed out, a row that doesn't exist: all tool errors.
+* **Raise `ToolError`** for a failure of *execution*: the thing your tool tried to do didn't work. The model chose the call, so the model should see the consequence and get a chance to recover. A misspelled title, an upstream API that timed out, a row that doesn't exist: all tool errors.
 * **Raise `MCPError`** when the *request itself* should be rejected: the client is missing a capability your tool depends on, the server isn't in a state to serve anyone, the caller skipped a required step. No retry from the model fixes any of those, so there is nothing to gain from handing it the message.
 
-One question decides it: **could a smarter model have avoided this?** Yes -> ordinary exception. No -> `MCPError`.
+One question decides it: **could a smarter model have avoided this?** Yes -> `ToolError`. No -> `MCPError`.
 
 By that test, the second version of `get_author` made the wrong choice: a better title fixes it, so the model deserved to see the message. It's there to show you the mechanism, not to recommend it.
 
@@ -84,6 +86,25 @@ By that test, the second version of `get_author` made the wrong choice: a better
     `data` payload. Whatever you put in them is what the client receives: the SDK forwards a raised
     `MCPError` verbatim instead of sanitising it.
 
+## Any other exception
+
+Now take the check out and let the dictionary lookup fail on its own:
+
+```python title="server.py" hl_lines="11"
+--8<-- "docs_src/handling_errors/tutorial004.py"
+```
+
+`CATALOG[title]` raises `KeyError`. You didn't plan for it, so the SDK treats it as a crash:
+
+```python
+result.is_error  # True
+result.content   # [TextContent(text="Error executing tool get_author")]
+```
+
+The call still returns `is_error=True`, so the model knows it failed and can move on. What it doesn't get is the exception's text: a `KeyError` from your code, or a stack of SQL from a driver three libraries down, may describe your
```

---

### Incident Patch 12: `2378e560` (2026-08-14)
**Commit Message**: Read UTF-8 test fixtures with explicit encoding (#3245)

Co-authored-by: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `tests/examples/conftest.py` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
 STORIES_DIR = Path(stories.__file__).parent
 BASE_URL = "http://127.0.0.1:8000"
 
-MANIFEST = tomllib.loads((STORIES_DIR / "manifest.toml").read_text())
+MANIFEST = tomllib.loads((STORIES_DIR / "manifest.toml").read_text(encoding="utf-8"))
 DEFAULTS: dict[str, Any] = MANIFEST["defaults"]
 STORIES: dict[str, dict[str, Any]] = MANIFEST["story"]
 
```

**File**: `tests/examples/test_story_shape.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
 
 def _parse(path: Path) -> ast.Module:
     """Parse ``path`` into an AST module."""
-    return ast.parse(path.read_text(), filename=str(path))
+    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
 
 
 def _resolve(node: ast.ImportFrom, package: str) -> str:
```

---

### Incident Patch 13: `fe47969f` (2026-07-29)
**Commit Message**: Ask which release line a bug report is on (#3213)

**File**: `.github/ISSUE_TEMPLATE/bug.yaml` (modified, +15/-2)
```diff
@@ -11,13 +11,26 @@ body:
     id: checks
     attributes:
       label: Initial Checks
-      description: Just making sure you're using the latest version of MCP Python SDK.
+      description: >
+        Both the 2.x stable line and the 1.x maintenance line are supported, and only
+        the newest release of each line receives fixes.
       options:
-        - label: I confirm that I'm using the latest version of MCP Python SDK
+        - label: I confirm that I'm using the newest release of my line (the latest 2.x, or the latest 1.x if I'm still on v1)
           required: true
         - label: I confirm that I searched for my issue in https://github.com/modelcontextprotocol/python-sdk/issues before opening this issue
           required: true
 
+  - type: dropdown
+    id: release-line
+    attributes:
+      label: Release line
+      description: Which major version of the SDK are you using?
+      options:
+        - 2.x (current stable)
+        - 1.x (maintenance line, v1.x branch)
+    validations:
+      required: true
+
   - type: textarea
     id: description
     attributes:
```

---

### Incident Patch 14: `b61ce388` (2026-07-27)
**Commit Message**: docs: fix off-by-one hl_lines in apps.md (#3196)

**File**: `docs/advanced/apps.md` (modified, +2/-2)
```diff
@@ -20,7 +20,7 @@ then come back.
 
 ## A clock with a face
 
-```python title="server.py" hl_lines="18 21 29 31"
+```python title="server.py" hl_lines="19 22 30 32"
 --8<-- "docs_src/apps/tutorial001.py"
 ```
 
@@ -51,7 +51,7 @@ The model reads `content`; the iframe is for humans. A UI-capable host still fee
 the text result to the model, and a text-only client gets *only* that. So the
 canonical pattern is one tool, two answers. Look at `get_time` again:
 
-```python title="server.py" hl_lines="22-26"
+```python title="server.py" hl_lines="23-27"
 --8<-- "docs_src/apps/tutorial001.py"
 ```
 
```

---

### Incident Patch 15: `e8ef1381` (2026-07-27)
**Commit Message**: docs: fill migration-guide gaps found by automated v1-to-v2 migration runs (#3187)

**File**: `docs/migration.md` (modified, +494/-67)
```diff
@@ -6,7 +6,7 @@ Version 2 of the MCP Python SDK introduces several breaking changes to improve t
 
 ## Find your changes
 
-Every section heading below names the API it affects, so searching this page for the symbol your code uses is the fastest route to the change that broke it.
+Every section heading below names the API it affects, so searching this page for the symbol your code uses is the fastest route to the change that broke it. The guide lists changes only: an SDK API not mentioned here behaves as it did in v1, and the "what did not change" summaries — [`MCPServer`](#what-is-unchanged-on-mcpserver), [lowlevel `Server`](#lowlevel-server-what-did-not-change), and [auth](#unchanged-auth-surfaces) — spell out the surfaces most migrators stop to check.
 
 ### Changes almost every project hits
 
@@ -17,7 +17,9 @@ Every section heading below names the API it affects, so searching this page for
 | `mcp.types` moved to the `mcp-types` package | `ModuleNotFoundError: No module named 'mcp.types'` | [`mcp.types` moved](#mcptypes-moved-to-the-mcp-types-package) |
 | `McpError` renamed to `MCPError` | `ImportError: cannot import name 'McpError' from 'mcp'` | [`McpError` renamed](#mcperror-renamed-to-mcperror) |
 | Resource URIs are `str`, not `AnyUrl` | `AttributeError: 'str' object has no attribute 'host'` | [URI type](#resource-uri-type-changed-from-anyurl-to-str) |
+| Message unions (`ServerNotification`, `JSONRPCMessage`, ...) are plain unions, not `RootModel` | `AttributeError: 'LoggingMessageNotification' object has no attribute 'root'` | [`RootModel` → unions](#replace-rootmodel-by-union-types-with-typeadapter-validation) |
 | `streamablehttp_client` removed | `ImportError: cannot import name 'streamablehttp_client'` | [`streamablehttp_client`](#streamablehttp_client-removed) |
+| `httpx` and `httpx-sse` replaced by `httpx2` | `ModuleNotFoundError: No module named 'httpx'`, or `TypeError: Invalid "auth" argument` from `httpx.AsyncClient(auth=provider)` | [`httpx2` swap](#httpx-and-httpx-sse-replaced-by-httpx2) |
 | `Client` defaults to `mode='auto'` | servers log an unexpected `server/discover` request | [`mode='auto'`](#client-defaults-to-modeauto) |
 | Transport parameters moved off the `MCPServer` constructor | `TypeError: MCPServer.__init__() got an unexpected keyword argument 'port'` | [constructor parameters](#transport-specific-parameters-moved-from-mcpserver-constructor-to-runapp-methods) |
 | Sync handlers run on a worker thread | `asyncio.get_running_loop()` in a `def` handler raises `RuntimeError` | [worker threads](#sync-handler-functions-now-run-on-a-worker-thread) |
@@ -99,11 +101,13 @@ The SDK now depends on [`httpx2`](https://pypi.org/project/httpx2/) instead of
 `httpx`) with server-sent events support built in, so the separate `httpx-sse`
 dependency is gone.
 
-The swap itself does not change any SDK signatures - `streamable_http_client`
-and `sse_client` accept the same arguments as elsewhere in v2 - but the client
-type they expect is now `httpx2.AsyncClient`. If you construct your own client to pass as
-`http_client` (or build an `httpx2.Auth` subclass for `auth`), import from
-`httpx2`:
+The swap changes types, not parameter lists: `streamable_http_client` and `sse_client`
+keep their keyword arguments (covered, with the removed `streamablehttp_client` alias and the
+`get_session_id` callback, under [Transports](#transports)), and only the objects they take
+become `httpx2` types — the pre-built `http_client` you hand `streamable_http_client`,
+`sse_client`'s `auth=` (an `httpx2.Auth`, the base class `OAuthClientProvider` now uses), and
+the client a custom `httpx_client_factory` returns. Import from `httpx2` when building any of
+them:
 
 **Before (v1):**
 
@@ -125,21 +129,45 @@ http_client = httpx2.AsyncClient(follow_redirects=True)
 changes. To consume SSE directly, use `httpx2.EventSource` (or
 `AsyncClient.sse()`) instead of the `httpx-sse` helpers.
 
+mcp no longer installs `httpx` at all. If your own code imports `httpx` and relied on mcp
+v1 to pull it in, that import now fails with
+`ModuleNotFoundError: No module named 'httpx'` — a traceback that never mentions mcp. Either
+add `httpx` to your own dependencies (the two packages install side by side; only objects
+handed to the SDK via `http_client=` or `auth=` have to be `httpx2` types) or port those
+calls to `httpx2`, whose `Client` and `AsyncClient` are drop-in replacements.
+
 Exception handlers need the same rename: the SDK now raises `httpx2`
 exceptions (`httpx2.ConnectError`, `httpx2.HTTPStatusError`, and so on), and
-this failure mode is silent. `httpx` usually stays installed as a transitive
-dependency of other packages, so an old `except httpx.ConnectError:` block
+this failure mode is silent. If `httpx` is still installed — your own code or another
+package depends on it — an old `except httpx.ConnectError:` block
 keeps importing fine and simply never matches again. Audit `except httpx.`
-clauses and `isinstanc
```

#### Recent Merged Pull Requests:
- **PR #3642** (closed): Keep unknown server and client capability keys (@epistemedeus)
- **PR #3638** (closed): docs: clarify Pydantic tool argument envelopes (@aritejhg)
- **PR #3636** (2026-10-02): docs: refresh translations for recent English changes (@maxisbey)
- **PR #3635** (2026-10-02): Stop counting an interactive OAuth login against request timeouts (@maxisbey)
- **PR #3634** (2026-10-02): Keep inline-snapshot disabled when pytest runs in a terminal (@maxisbey)
- **PR #3633** (2026-10-02): Let a newer Deploy Docs run cancel the one in progress (@maxisbey)
- **PR #3632** (2026-10-02): Link What's new to the Header parameters page (@maxisbey)
- **PR #3630** (2026-10-02): Look the tool schema up by name for Mcp-Param-* validation instead of running tools/list (@maxisbey)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
