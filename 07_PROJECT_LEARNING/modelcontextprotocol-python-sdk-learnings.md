# Forensic Learning Record (Deep Inspection): modelcontextprotocol/python-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-python-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:28:31.352Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/python-sdk`
- **Description**: The official Python SDK for Model Context Protocol servers and clients
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 24442 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/clients/simple-auth-client/mcp_simple_auth_client/__init__.py`
```
"""Simple OAuth client for MCP simple-auth server."""

```

### Core Architecture Module: `examples/clients/simple-auth-client/mcp_simple_auth_client/main.py`
```
#!/usr/bin/env python3
"""Simple MCP client example with OAuth authentication support.

This client connects to an MCP server using streamable HTTP transport with OAuth.

"""

from __future__ import annotations as _annotations

import asyncio
import os
import socketserver
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx2
from mcp.client._transport import ReadStream, WriteStream
from mcp.client.auth import AuthorizationCodeResult, OAuthClientProvider, TokenStorage
from mcp.client.session import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamable_http_client
from mcp.shared.auth import OAuthClientInformationFull, OAuthClientMetadata, OAuthToken
from mcp.shared.message import SessionMessage


class InMemoryTokenStorage(TokenStorage):
    """Simple in-memory token storage implementation."""

    def __init__(self):
        self._tokens: OAuthToken | None = None
        self._client_info: OAuthClientInformationFull | None = None

    async def get_tokens(self) -> OAuthToken | None:
        return self._tokens

    async def set_tokens(self, tokens: OAuthToken) -> None:
        self._tokens = tokens

    async def get_client_info(self) -> OAuthClientInformationFull | None:
        return self._client_info

    async def set_client_info(self, client_info: OAuthClientInformationFull) -> None:
        self._client_info = client_info


class CallbackHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler to capture OAuth callback."""

    def __init__(
        self,
        request: Any,
        client_address: tuple[str, int],
        server: socketserver.BaseServer,
        callback_data: dict[str, Any],
    ):
        """Initialize with callback data storage."""
        self.callback_data = callback_data
        super().__init__(request, client_address, server)

    def do_GET(self):
        """Handle GET request from OAuth redirect."""
        parsed = urlparse(self.path)
        query_params = parse_qs(parsed.query)

        if "code" in query_params:
            self.callback_data["authorization_code"] = query_params["code"][0]
            self.callback_data["state"] = query_params.get("state", [None])[0]
            self.callback_data["iss"] = query_params.get("iss", [None])[0]
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"""
            <html>
            <body>
                <h1>Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <script>setTimeout(() => window.close(), 2000);</script>
            </body>
            </html>
            """)
        elif "error" in query_params:
            self.callback_data["error"] = query_params["error"][0]
            self.send_response(400)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(
                f"""
            <html>
            <body>
                <h1>Authorization Failed</h1>
                <p>Error: {query_params["error"][0]}</p>
                <p>You can close this window and return to the terminal.</p>
            </body>
            </html>
            """.encode()
            )
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format: str, *args: Any):
        """Suppress default logging."""


class CallbackServer:
    """Simple server to handle OAuth callbacks."""

    def __init__(self, port: int = 3000):
        self.port = port
        self.server = None
        self.thread = None
        self.callback_data = {"authorization_code": None, "state": None, "iss": None, "error": None}

    def _create_handler_with_data(self):
        """Create a handler class with access to callback data."""
        callback_data = self.callback_data

        class DataCallbackHandler(CallbackHandler):
            def __init__(
                self,
                request: BaseHTTPRequestHandler,
                client_address: tuple[str, int],
                server: socketserver.BaseServer,
            ):
                super().__init__(request, client_address, server, callback_data)

        return DataCallbackHandler

    def start(self):
        """Start the callback server in a background thread."""
        handler_class = self._create_handler_with_data()
        self.server = HTTPServer(("localhost", self.port), handler_class)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        print(f"🖥️  Started callback server on http://localhost:{self.port}")

    def stop(self):
        """Stop the callback server."""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        if self.thread:
            self.thread.join(timeout=1)

    def wait_for_callback(self, timeout: int = 300):
        """Wait for OAuth callback with timeout."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.callback_data["authorization_code"]:
                return self.callback_data["authorization_code"]
            elif self.callback_data["error"]:
                raise Exception(f"OAuth error: {self.callback_data['error']}")
            time.sleep(0.1)
        raise Exception("Timeout waiting for OAuth callback")

    @property
    def state(self):
        """The received state parameter."""
        return self.callback_data["state"]

    @property
    def iss(self):
        """The received iss parameter."""
        return self.callback_data["iss"]


class SimpleAuthClient:
    """Simple MCP client with auth support."""

    def __init__(
        self,
        server_url: str,
        transport_type: str = "streamable-http",
        client_metadata_url: str | None = None,
    ):
        self.server_url = server_url
        self.transport_type = transport_type
        self.client_metadata_url = client_metadata_url
        self.session: ClientSession | None = None

    async def connect(self):
        """Connect to the MCP server."""
        print(f"🔗 Attempting to connect to {self.server_url}...")

        try:
            callback_server = CallbackServer(port=3030)
            callback_server.start()

            async def callback_handler() -> AuthorizationCodeResult:
                """Wait for OAuth callback and return auth code, state, and iss."""
                print("⏳ Waiting for authorization callback...")
                try:
                    auth_code = callback_server.wait_for_callback(timeout=300)
                    return AuthorizationCodeResult(code=auth_code, state=callback_server.state, iss=callback_server.iss)
                finally:
                    callback_server.stop()

            client_metadata_dict = {
                "client_name": "Simple Auth Client",
                "redirect_uris": ["http://localhost:3030/callback"],
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
            }

            async def _default_redirect_handler(authorization_url: str) -> None:
                """Default redirect handler that opens the URL in a browser."""
                print(f"Opening browser for authorization: {authorization_url}")
                webbrowser.open(authorization_url)

            # Create OAuth authentication handler using the new interface
            # Use client_metadata_url to enable CIMD when the server supports it
            oauth_auth = OAuthClientProvider(
                server_url=self.server_url.replace("/mcp", ""),
                client_metadata=OAuthClientMetadata.model_validate(client_metadata_dict),
                storage=InMemoryTokenStorage(
```

### Core Architecture Module: `examples/clients/simple-chatbot/mcp_simple_chatbot/main.py`
```
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from contextlib import AsyncExitStack
from typing import Any

import httpx2
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


class Configuration:
    """Manages configuration and environment variables for the MCP client."""

    def __init__(self) -> None:
        """Initialize configuration with environment variables."""
        self.load_env()
        self.api_key = os.getenv("LLM_API_KEY")

    @staticmethod
    def load_env() -> None:
        """Load environment variables from .env file."""
        load_dotenv()

    @staticmethod
    def load_config(file_path: str) -> dict[str, Any]:
        """Load server configuration from JSON file.

        Args:
            file_path: Path to the JSON configuration file.

        Returns:
            Dict containing server configuration.

        Raises:
            FileNotFoundError: If configuration file doesn't exist.
            JSONDecodeError: If configuration file is invalid JSON.
        """
        with open(file_path, encoding="utf-8") as f:
            return json.load(f)

    @property
    def llm_api_key(self) -> str:
        """Get the LLM API key.

        Returns:
            The API key as a string.

        Raises:
            ValueError: If the API key is not found in environment variables.
        """
        if not self.api_key:
            raise ValueError("LLM_API_KEY not found in environment variables")
        return self.api_key


class Server:
    """Manages MCP server connections and tool execution."""

    def __init__(self, name: str, config: dict[str, Any]) -> None:
        self.name: str = name
        self.config: dict[str, Any] = config
        self.stdio_context: Any | None = None
        self.session: ClientSession | None = None
        self._cleanup_lock: asyncio.Lock = asyncio.Lock()
        self.exit_stack: AsyncExitStack = AsyncExitStack()

    async def initialize(self) -> None:
        """Initialize the server connection."""
        command = shutil.which("npx") if self.config["command"] == "npx" else self.config["command"]
        if command is None:
            raise ValueError("The command must be a valid string and cannot be None.")

        server_params = StdioServerParameters(
            command=command,
            args=self.config["args"],
            env={**os.environ, **self.config["env"]} if self.config.get("env") else None,
        )
        try:
            stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
            read, write = stdio_transport
            session = await self.exit_stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
            self.session = session
        except Exception as e:
            logging.error(f"Error initializing server {self.name}: {e}")
            await self.cleanup()
            raise

    async def list_tools(self) -> list[Tool]:
        """List available tools from the server.

        Returns:
            A list of available tools.

        Raises:
            RuntimeError: If the server is not initialized.
        """
        if not self.session:
            raise RuntimeError(f"Server {self.name} not initialized")

        tools_response = await self.session.list_tools()
        tools: list[Tool] = []

        for item in tools_response:
            if item[0] == "tools":
                tools.extend(Tool(tool.name, tool.description, tool.input_schema, tool.title) for tool in item[1])

        return tools

    async def execute_tool(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        retries: int = 2,
        delay: float = 1.0,
    ) -> Any:
        """Execute a tool with retry mechanism.

        Args:
            tool_name: Name of the tool to execute.
            arguments: Tool arguments.
            retries: Number of retry attempts.
            delay: Delay between retries in seconds.

        Returns:
            Tool execution result.

        Raises:
            RuntimeError: If server is not initialized.
            Exception: If tool execution fails after all retries.
        """
        if not self.session:
            raise RuntimeError(f"Server {self.name} not initialized")

        attempt = 0
        while attempt < retries:
            try:
                logging.info(f"Executing {tool_name}...")
                result = await self.session.call_tool(tool_name, arguments)

                return result

            except Exception as e:
                attempt += 1
                logging.warning(f"Error executing tool: {e}. Attempt {attempt} of {retries}.")
                if attempt < retries:
                    logging.info(f"Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                else:
                    logging.error("Max retries reached. Failing.")
                    raise

    async def cleanup(self) -> None:
        """Clean up server resources."""
        async with self._cleanup_lock:
            try:
                await self.exit_stack.aclose()
                self.session = None
                self.stdio_context = None
            except Exception as e:
                logging.error(f"Error during cleanup of server {self.name}: {e}")


class Tool:
    """Represents a tool with its properties and formatting."""

    def __init__(
        self,
        name: str,
        description: str,
        input_schema: dict[str, Any],
        title: str | None = None,
    ) -> None:
        self.name: str = name
        self.title: str | None = title
        self.description: str = description
        self.input_schema: dict[str, Any] = input_schema

    def format_for_llm(self) -> str:
        """Format tool information for LLM.

        Returns:
            A formatted string describing the tool.
        """
        args_desc: list[str] = []
        if "properties" in self.input_schema:
            for param_name, param_info in self.input_schema["properties"].items():
                arg_desc = f"- {param_name}: {param_info.get('description', 'No description')}"
                if param_name in self.input_schema.get("required", []):
                    arg_desc += " (required)"
                args_desc.append(arg_desc)

        # Build the formatted output with title as a separate field
        output = f"Tool: {self.name}\n"

        # Add human-readable title if available
        if self.title:
            output += f"User-readable title: {self.title}\n"

        output += f"""Description: {self.description}
Arguments:
{chr(10).join(args_desc)}
"""

        return output


class LLMClient:
    """Manages communication with the LLM provider."""

    def __init__(self, api_key: str) -> None:
        self.api_key: str = api_key

    def get_response(self, messages: list[dict[str, str]]) -> str:
        """Get a response from the LLM.

        Args:
            messages: A list of message dictionaries.

        Returns:
            The LLM's response as a string, or an error message if the request fails.
        """
        url = "https://api.groq.com/openai/v1/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "messages": messages,
            "model": "meta-llama/llama-4-scout-17b-16e-instruct",
            "temperature": 0.7,
            "max_tokens": 4096,
            "top_p": 1,
            "stream": False,
            "stop": None,
        }

        try:
            with httpx2.Client() as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_s
```

### Core Architecture Module: `examples/clients/sse-polling-client/mcp_sse_polling_client/__init__.py`
```
"""SSE Polling Demo Client - demonstrates auto-reconnect for long-running tasks."""

```

### Core Architecture Module: `examples/clients/sse-polling-client/mcp_sse_polling_client/main.py`
```
"""SSE Polling Demo Client

Demonstrates the client-side auto-reconnect for SSE polling pattern.

This client connects to the SSE Polling Demo server and calls process_batch,
which triggers periodic server-side stream closes. The client automatically
reconnects using Last-Event-ID and resumes receiving messages.

Run with:
    # First start the server:
    uv run mcp-sse-polling-demo --port 3000

    # Then run this client:
    uv run mcp-sse-polling-client --url http://localhost:3000/mcp
"""

import asyncio
import logging

import click
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


async def run_demo(url: str, items: int, checkpoint_every: int) -> None:
    """Run the SSE polling demo."""
    print(f"\n{'=' * 60}")
    print("SSE Polling Demo Client")
    print(f"{'=' * 60}")
    print(f"Server URL: {url}")
    print(f"Processing {items} items with checkpoints every {checkpoint_every}")
    print(f"{'=' * 60}\n")

    async with streamable_http_client(url) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            # Initialize the connection
            print("Initializing connection...")
            await session.initialize()
            print("Connected!\n")

            # List available tools
            tools = await session.list_tools()
            print(f"Available tools: {[t.name for t in tools.tools]}\n")

            # Call the process_batch tool
            print(f"Calling process_batch(items={items}, checkpoint_every={checkpoint_every})...\n")
            print("-" * 40)

            result = await session.call_tool(
                "process_batch",
                {
                    "items": items,
                    "checkpoint_every": checkpoint_every,
                },
            )

            print("-" * 40)
            if result.content:
                content = result.content[0]
                text = getattr(content, "text", str(content))
                print(f"\nResult: {text}")
            else:
                print("\nResult: No content")
            print(f"{'=' * 60}\n")


@click.command()
@click.option(
    "--url",
    default="http://localhost:3000/mcp",
    help="Server URL",
)
@click.option(
    "--items",
    default=10,
    help="Number of items to process",
)
@click.option(
    "--checkpoint-every",
    default=3,
    help="Checkpoint interval",
)
@click.option(
    "--log-level",
    default="INFO",
    help="Logging level",
)
def main(url: str, items: int, checkpoint_every: int, log_level: str) -> None:
    """Run the SSE Polling Demo client."""
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    # Suppress noisy HTTP client logging
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    logging.getLogger("httpcore2").setLevel(logging.WARNING)

    asyncio.run(run_demo(url, items, checkpoint_every))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/mcpserver/complex_inputs.py`
```
"""MCPServer Complex inputs Example

Demonstrates validation via pydantic with complex models.
"""

from typing import Annotated

from pydantic import BaseModel, Field

from mcp.server.mcpserver import MCPServer

mcp = MCPServer("Shrimp Tank")


class ShrimpTank(BaseModel):
    class Shrimp(BaseModel):
        name: Annotated[str, Field(max_length=10)]

    shrimp: list[Shrimp]


@mcp.tool()
def name_shrimp(
    tank: ShrimpTank,
    # You can use pydantic Field in function signatures for validation.
    extra_names: Annotated[list[str], Field(max_length=10)],
) -> list[str]:
    """List all shrimp names in the tank"""
    return [shrimp.name for shrimp in tank.shrimp] + extra_names

```

### Core Architecture Module: `examples/mcpserver/desktop.py`
```
"""MCPServer Desktop Example

A simple example that exposes the desktop directory as a resource.
"""

from pathlib import Path

from mcp.server.mcpserver import MCPServer

# Create server
mcp = MCPServer("Demo")


@mcp.resource("dir://desktop")
def desktop() -> list[str]:
    """List the files in the user's desktop"""
    desktop = Path.home() / "Desktop"
    return [str(f) for f in desktop.iterdir()]


@mcp.tool()
def sum(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

```

### Core Architecture Module: `examples/mcpserver/direct_call_tool_result_return.py`
```
"""MCPServer Echo Server with direct CallToolResult return"""

from typing import Annotated

from pydantic import BaseModel

from mcp.server.mcpserver import MCPServer
from mcp.types import CallToolResult, TextContent

mcp = MCPServer("Echo Server")


class EchoResponse(BaseModel):
    text: str


@mcp.tool()
def echo(text: str) -> Annotated[CallToolResult, EchoResponse]:
    """Echo the input text with structure and metadata"""
    return CallToolResult(
        content=[TextContent(type="text", text=text)], structured_content={"text": text}, _meta={"some": "metadata"}
    )

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

- **Issue #2695** (2026-06-20): **Dead code path in MCPServer._handle_call_tool and incorrect call_tool return type**
  *Symptoms*: ## Summary  `MCPServer._handle_call_tool` in `src/mcp/server/mcpserver/server.py` contains a dead `isinstance(result, dict)` branch, with an inline TODO that already documents both the dead-code issue and the related incorrect return-type annotation on `MCPServer.call_tool`.  I'd like to clean this up. Posting the diagnosis here first per CONTRIBUTING.md.  ## Diagnosis  `FuncMetadata.convert_result` in `src/mcp/server/mcpserver/utilities/func_metadata.py` can return exactly three shapes (lines 105-123):  1. `CallToolResult` (when the tool function returned one directly) 2. `Sequence[ContentBlock]` (no output schema — via `_convert_to_content`) 3. `(unstructured_content, structured_content)` tuple (with output schema)  Never a raw `dict`. So:  - The `isinstance(result, dict)` branch in `_handle_call_tool` (lines   325-332 on main) is unreachable. It's marked `# pragma: no cover`   because tests cannot reach it. - `MCPServer.call_tool`'s return-type annotation   `Sequence[ContentBlock] | dict[str, Any]` (line 402 on main) is wrong:   it advertises a dict return that cannot happen, and is missing the   `CallToolResult` and tuple shapes that *can* happen.  ## Proposed fix  1. Remove the dead `isinstance(result, dict)` branch. 2. Drop the now-unused `import json`. 3. Change `call_tool`'s return type to    `CallToolResult | Sequence[ContentBlock] | tuple[Sequence[ContentBlock], dict[str, Any]]`    and document all three shapes in the docstring.  The return-type change is a breaking
  **Post-Mortem & Fix Analysis**:
  > Thanks @scosemicolon  — both suggestions land for me.  The regression test you describe is the right shape: register a tool with an output schema, invoke through `_handle_call_tool`, assert both `content` and `structured_content` populate. That pins the reachable tuple path from `convert_result=True` and makes any re-introduction of the raw-`dict` branch immediately surface as a failing test.  The `ToolResult` alias also makes sense — keeping `_handle_call_tool`, `MCPServer.call_tool`, and the eventual subclass docs all referencing one canonical shape definition is exactly the kind of drift prevention this refactor needs.  @Ar-maan05 has already opened #2700 covering parts 1–3 of the proposed fix. @Ar-maan05, happy to put together the regression test and the type alias as either commits on your branch (if you'd take a co-author push) or as a follow-up PR after yours lands — whichever you and the reviewers prefer.
  > Thanks for the suggestions. I've added the `ToolResult` alias and the regression test covering the structured output path in #2700 ; both are now part of the same PR.
  > Nice — the `ToolResult` alias landing in one place looks clean, and the `make_point` test pins the tuple path exactly as @scosemicolon  described.  One follow-up I'd like to do once #2700 lands: extend the same test file to also pin the other two reachable shapes from `convert_result=True` —  - a tool with no output schema (the bare `Sequence[ContentBlock]` path), and - a tool that returns a `CallToolResult` directly.  Same shape as the new test, just three small cases instead of one. Together the three lock down every path that `_handle_call_tool` actually traverses, so any future regression that brings back a raw-`dict` (or any other) branch fails loudly. Happy to open that as a small follow-up PR — let me know if that's wanted.

- **Issue #2641** (2026-06-02): **Add `invalid_target` to `AuthorizationErrorCode` (RFC 8707)**
  *Symptoms*: ## Summary  `mcp/server/auth/provider.py` defines `AuthorizationErrorCode` as a `Literal` of seven OAuth 2.0 error codes but is missing `"invalid_target"`, the error code defined by [RFC 8707 §2](https://www.rfc-editor.org/rfc/rfc8707#section-2) for resource-indicator mismatches. As a result, the auth-handler framework cannot return the correct error code when a downstream client sends an authorization request whose `resource` parameter doesn't match the protected resource, and any provider that raises `AuthorizeError(error="invalid_target", …)` triggers a pydantic `ValidationError` instead of an OAuth-compliant error response.  ## Current behaviour  In `mcp/server/auth/provider.py`:  ```python AuthorizationErrorCode = Literal[     "invalid_request",     "unauthorized_client",     "access_denied",     "unsupported_response_type",     "invalid_scope",     "server_error",     "temporarily_unavailable", ] ```  `AuthorizationErrorResponse.error` is typed against this Literal, so when the authorize handler at `mcp/server/auth/handlers/authorize.py:123` tries to build `AuthorizationErrorResponse(error="invalid_target", …)`, pydantic rejects it:  ``` pydantic_core._pydantic_core.ValidationError: 1 validation error for AuthorizationErrorResponse error   Input should be 'invalid_request', 'unauthorized_client', 'access_denied', 'unsupported_response_type',   'invalid_scope', 'server_error' or 'temporarily_unavailable'   [type=literal_error, input_value='invalid_target', input_type=str
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to work on this. I'll add "invalid_target" to AuthorizationErrorCode in mcp/server/auth/provider.py as described. Will submit a PR shortly. 
  > confirmed on main (616476f) and v1.x (6213787). `AuthorizationErrorCode` in `src/mcp/server/auth/provider.py:63-71` is missing `"invalid_target"`, so when a provider raises `AuthorizeError(error="invalid_target", ...)` the handler at `src/mcp/server/auth/handlers/authorize.py:218-220` builds `AuthorizationErrorResponse(error=e.error, ...)`, pydantic rejects the literal, and the broad `except Exception` at L222-225 returns a generic `server_error` instead. fix is the one-line literal addition; spec mandates RFC 8707 (`docs/specification/draft/basic/authorization.mdx:519,880`).  <details> <summary>repro</summary>  `repro.py`: ```python """Reproduce issue #2641: AuthorizationErrorCode is missing 'invalid_target' (RFC 8707)."""  from mcp.server.auth.handlers.authorize import AuthorizationErrorResponse from mcp.server.auth.provider import AuthorizationErrorCode, AuthorizeError  print("Literal members of AuthorizationErrorCode:") print(f"  {AuthorizationErrorCode}") print()  print("1. Constr

- **Issue #2591** (2026-08-10): **FastMCP crashes when tool return type uses Python 3.10+ `A | B | C` union syntax**
  *Symptoms*: ### Initial Checks  - [x] I confirm that I'm using the latest version of MCP Python SDK - [x] I confirm that I searched for my issue in https://github.com/modelcontextprotocol/python-sdk/issues before opening this issue  ### Description  `FastMCP` crashes on startup when a tool function's return type annotation uses Python 3.10+ union syntax (`A | B | C`, i.e. `types.UnionType`). The error originates from `_create_wrapped_model` in `func_metadata.py`, which passes the union annotation directly to Pydantic's `create_model()` as a bare keyword value, causing `PydanticUserError`.  ### Example Code  ```Python from mcp.server.fastmcp import FastMCP  mcp = FastMCP("test")  @mcp.tool() async def my_tool(flag: bool) -> dict | list | str:  # <-- triggers the bug     if flag:         return {"key": "value"}     return ["item"] ```  ### Python & MCP Python SDK  ```Text - mcp (Python): latest (>=1.0.0,<2.0.0) - pydantic: >=2.10 (observed on 2.10.x) - Python: >=3.10 ```
  **Post-Mortem & Fix Analysis**:
  > ### Discovery Process  While developing a local MCP tool server with `FastMCP`, the server immediately crashed on startup with a `PydanticUserError`. The error message pointed to the `result = dict | list | str` field in a dynamically generated Pydantic model. Tracing the call stack backward:  1. The error came from `pydantic`'s `create_model()` in `_create_wrapped_model`. 2. `_create_wrapped_model` was called from `_try_create_model_and_schema` in `func_metadata.py`. 3. It was triggered because the `scripts()` tool's return type `dict | list | str` (a `types.UnionType`) fell outside both the `GenericAlias` and plain `type` branches, landing in the generic `else` branch that wraps the annotation as-is.  Comparing with `Union[dict, list, str]` (which is a `GenericAlias` and works fine) confirmed that only the Python 3.10+ `|` syntax triggers this path. The fix was then implemented and verified locally.  ### Error Trace  ```text pydantic.errors.PydanticUserError: A non-annotated attribut
  > Test comment
  > ## Root Cause Analysis & Fix  ### The Bug In `src/mcp/server/mcpserver/utilities/func_metadata.py`, the `_create_wrapped_model` function (line 481) passes the annotation directly to Pydantic's `create_model()`. When `annotation` is a Python 3.10+ `types.UnionType` (e.g., `dict | list | str`), Pydantic raises `PydanticUserError` because it expects `typing.Union`, not `types.UnionType`.  ### The Fix Add a normalization step in `_create_wrapped_model`:  ```python from types import UnionType from typing import Union, get_args  def _create_wrapped_model(func_name: str, annotation: Any) -> type[BaseModel]:     model_name = f"{func_name}Output"     # Normalize Python 3.10+ union syntax (A | B | C) to typing.Union     if isinstance(annotation, UnionType):         annotation = Union[get_args(annotation)]     return create_model(model_name, result=annotation) ```  ### Why This Works - `types.UnionType` (from `A | B`) and `typing.Union[A, B]` are semantically identical - Pydantic's `create_model(

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

### Incident Patch 1: `7bb486a1` (2026-09-05)
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
 
-
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

---

### Incident Patch 2: `10dc1736` (2026-09-04)
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

### Incident Patch 3: `56af4472` (2026-08-24)
**Commit Message**: Log MCPServer handler exceptions by kind and keep crash details off the wire (#3314)

Co-authored-by: Marcelo Trylesinski <marcelotryle@gmail.com>

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

---

### Incident Patch 4: `2378e560` (2026-08-14)
**Commit Message**: Read UTF-8 test fixtures with explicit encoding (#3245)

Co-authored-by: Claude Fable 5 <noreply@anthropic.com>

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

### Incident Patch 5: `fe47969f` (2026-07-29)
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

### Incident Patch 6: `b61ce388` (2026-07-27)
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

### Incident Patch 7: `1216c536` (2026-07-10)
**Commit Message**: fix: reject trailing newline in tool-name and URI-template varname validation (#3076)

Python's $ with re.match also matches just before a single trailing newline, so tool-name validation accepted "name\n" and UriTemplate.parse accepted varnames like "foo\n". Switch both checks to re.fullmatch.

Closes #3084

**File**: `src/mcp/shared/tool_name_validation.py` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ def validate_tool_name(name: str) -> ToolNameValidationResult:
         warnings.append("Tool name starts or ends with a dot, which may cause parsing issues in some contexts")
 
     # Check for invalid characters
-    if not TOOL_NAME_REGEX.match(name):
+    if not TOOL_NAME_REGEX.fullmatch(name):
         # Find all invalid characters (unique, preserving order)
         invalid_chars: list[str] = []
         seen: set[str] = set()
```

**File**: `src/mcp/shared/uri_template.py` (modified, +1/-1)
```diff
@@ -813,7 +813,7 @@ def _parse_expression(template: str, body: str, pos: int) -> _Expression:
         explode = spec.endswith("*")
         name = spec[:-1] if explode else spec
 
-        if not _VARNAME_RE.match(name):
+        if not _VARNAME_RE.fullmatch(name):
             raise InvalidUriTemplate(
                 f"Invalid variable name {name!r} at position {pos}",
                 template=template,
```

**File**: `tests/shared/test_tool_name_validation.py` (modified, +5/-0)
```diff
@@ -65,12 +65,17 @@ def test_validate_tool_name_rejects_name_exceeding_max_length() -> None:
         ("get,user,profile", "','"),
         ("user/profile/update", "'/'"),
         ("user@domain.com", "'@'"),
+        # a single trailing newline slipped past `$` with re.match
+        ("valid_name\n", "'\\n'"),
+        ("a" * 127 + "\n", "'\\n'"),
     ],
     ids=[
         "with_spaces",
         "with_commas",
         "with_slashes",
         "with_at_symbol",
+        "with_trailing_newline",
+        "max_length_with_trailing_newline",
     ],
 )
 def test_validate_tool_name_rejects_invalid_characters(tool_name: str, expected_char: str) -> None:
```

**File**: `tests/shared/test_uri_template.py` (modified, +2/-0)
```diff
@@ -144,6 +144,8 @@ def test_parse_rejects_operator_without_variable():
         # RFC §2.3: dots only between varchars, not consecutive or trailing
         "foo..bar",
         "foo.",
+        # a single trailing newline slipped past `$` with re.match
+        "foo\n",
     ],
 )
 def test_parse_rejects_invalid_varname(name: str):
```

#### Recent Merged Pull Requests:
- **PR #3599** (closed): fix: allow opting out of Mcp-Param-* validation (avoids a full tools/list per tools/call) (@KaiyiQuan)
- **PR #3595** (closed): Let stdio_server exit while the peer holds stdin open (@weijie-tan3)
- **PR #3594** (closed): fix(server): auto-enable DNS rebinding protection for explicit non-loopback bind hosts (@shleder)
- **PR #3593** (closed): fix(mcpserver): normalize Image and Audio format to registered MIME types (#3585) (@MustafaKemal0146)
- **PR #3591** (closed): docs: cover reused-process runtimes (AWS Lambda) in deploy.md (@pandayv)
- **PR #3587** (closed): Fall back to unstructured output when output model selection fails (#3573) (@Rainmemery)
- **PR #3584** (closed): fix(client): contain streamable HTTP POST transport errors (@RaulMermans)
- **PR #3582** (closed): fix: hide input values from tool validation error messages (@MohammadaminAlbooyeh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
