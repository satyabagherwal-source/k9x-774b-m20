# Forensic Learning Record (Deep Inspection): open-webui/mcpo

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-webui-mcpo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-webui/mcpo](https://github.com/open-webui/mcpo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:49:45.080Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-webui/mcpo`
- **Description**: A simple, secure MCP-to-OpenAPI proxy server
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4388 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/mcpo/__init__.py`
```
import sys
import asyncio
import typer
import os
from dotenv import load_dotenv

from typing_extensions import Annotated
from typing import Optional, List

app = typer.Typer()


@app.command(context_settings={"allow_extra_args": True})
def main(
    host: Annotated[
        Optional[str], typer.Option("--host", "-h", help="Host address")
    ] = "0.0.0.0",
    port: Annotated[
        Optional[int], typer.Option("--port", "-p", help="Port number")
    ] = 8000,
    cors_allow_origins: Annotated[
        Optional[List[str]],
        typer.Option("--cors-allow-origins", help="CORS allowed origins"),
    ] = ["*"],
    api_key: Annotated[
        Optional[str],
        typer.Option("--api-key", "-k", help="API key for authentication"),
    ] = None,
    strict_auth: Annotated[
        Optional[bool],
        typer.Option(
            "--strict-auth", help="API key protects all endpoints and documentation"
        ),
    ] = False,
    env: Annotated[
        Optional[List[str]], typer.Option("--env", "-e", help="Environment variables")
    ] = None,
    env_path: Annotated[
        Optional[str],
        typer.Option("--env-path", help="Path to environment variables file"),
    ] = None,
    server_type: Annotated[
        Optional[str], typer.Option("--type", "--server-type", help="Server type")
    ] = "stdio",
    config_path: Annotated[
        Optional[str], typer.Option("--config", "-c", help="Config file path")
    ] = None,
    name: Annotated[
        Optional[str], typer.Option("--name", "-n", help="Server name")
    ] = None,
    description: Annotated[
        Optional[str], typer.Option("--description", "-d", help="Server description")
    ] = None,
    version: Annotated[
        Optional[str], typer.Option("--version", "-v", help="Server version")
    ] = None,
    ssl_certfile: Annotated[
        Optional[str], typer.Option("--ssl-certfile", "-t", help="SSL certfile")
    ] = None,
    ssl_keyfile: Annotated[
        Optional[str], typer.Option("--ssl-keyfile", "-K", help="SSL keyfile")
    ] = None,
    root_path: Annotated[
        Optional[str], typer.Option("--root-path", help="Root path")
    ] = "",
    path_prefix: Annotated[
        Optional[str], typer.Option("--path-prefix", help="URL prefix")
    ] = None,
    headers: Annotated[
        Optional[str], typer.Option("--header", "-H", help="Headers in JSON format")
    ] = None,
    hot_reload: Annotated[
        Optional[bool], typer.Option("--hot-reload", help="Enable hot reload for config file changes")
    ] = False,
    log_level: Annotated[
        Optional[str], typer.Option("--log-level", help="Set log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)")
    ] = None,
):
    server_command = None
    if not config_path:
        # Find the position of "--"
        if "--" not in sys.argv:
            typer.echo("Usage: mcpo --host 0.0.0.0 --port 8000 -- your_mcp_command")
            raise typer.Exit(1)

        idx = sys.argv.index("--")
        server_command: List[str] = sys.argv[idx + 1 :]

        if not server_command:
            typer.echo("Error: You must specify the MCP server command after '--'")
            return

    from mcpo.main import run

    if config_path:
        print("Starting MCP OpenAPI Proxy with config file:", config_path)
    else:
        print(
            f"Starting MCP OpenAPI Proxy on {host}:{port} with command: {' '.join(server_command)}"
        )

    try:
        env_dict = {}
        if env:
            for var in env:
                key, value = var.split("=", 1)
                env_dict[key] = value

        if env_path:
            # Load environment variables from the specified file
            load_dotenv(env_path)
            env_dict.update(dict(os.environ))

        # Set environment variables
        for key, value in env_dict.items():
            os.environ[key] = value
    except Exception as e:
        pass

    # Whatever the prefix is, make sure it starts and ends with a /
    if path_prefix is None:
        # Set default value
        path_prefix = "/"
    # if prefix doesn't end with a /, add it
    if not path_prefix.endswith("/"):
        path_prefix = f"{path_prefix}/"
    # if prefix doesn't start with a /, add it
    if not path_prefix.startswith("/"):
        path_prefix = f"/{path_prefix}"

    # Set LOG_LEVEL environment variable if provided
    if log_level:
        os.environ["LOG_LEVEL"] = log_level

    # Run your async run function from mcpo.main
    asyncio.run(
        run(
            host,
            port,
            api_key=api_key,
            strict_auth=strict_auth,
            cors_allow_origins=cors_allow_origins,
            server_type=server_type,
            config_path=config_path,
            name=name,
            description=description,
            version=version,
            server_command=server_command,
            ssl_certfile=ssl_certfile,
            ssl_keyfile=ssl_keyfile,
            path_prefix=path_prefix,
            root_path=root_path,
            headers=headers,
            hot_reload=hot_reload,
        )
    )


if __name__ == "__main__":
    app()

```

### Core Architecture Module: `src/mcpo/main.py`
```
import asyncio
import contextlib
import json
import logging
import os
import signal
import socket
from contextlib import AsyncExitStack, asynccontextmanager
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import uvicorn
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.routing import Mount

from mcp import ClientSession, StdioServerParameters
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamablehttp_client

from mcpo.utils.auth import APIKeyMiddleware, get_verify_api_key
from mcpo.utils.main import (
    get_model_fields,
    get_tool_handler,
    normalize_server_type,
)
from mcpo.utils.config_watcher import ConfigWatcher
from mcpo.utils.headers import validate_client_header_forwarding_config
from mcpo.utils.oauth import create_oauth_provider


logger = logging.getLogger(__name__)

CONNECTION_TIMEOUT = os.getenv("CONNECTION_TIMEOUT", None)


class GracefulShutdown:
    def __init__(self):
        self.shutdown_event = asyncio.Event()
        self.tasks = set()

    def handle_signal(self, sig, frame=None):
        """Handle shutdown signals gracefully"""
        logger.info(
            f"\nReceived {signal.Signals(sig).name}, initiating graceful shutdown..."
        )
        self.shutdown_event.set()

    def track_task(self, task):
        """Track tasks for cleanup"""
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)


class MCPConnectionManager:
    """
    Manages lifecycle of the MCP ClientSession and underlying transport so that
    we can reconnect transparently when the remote server drops the connection.
    """

    def __init__(
        self,
        *,
        server_type: str,
        command: Optional[str],
        args: List[str],
        env: Dict[str, str],
        headers: Optional[Dict[str, str]],
        connection_timeout: Optional[int],
        auth_provider: Optional[Any] = None,
    ):
        self.server_type = normalize_server_type(server_type)
        self.command = command
        self.args = args
        self.env = env
        self.headers = headers
        self.connection_timeout = connection_timeout
        self.auth_provider = auth_provider

        self._session: Optional[ClientSession] = None
        self._client_context = None
        self._lock = asyncio.Lock()
        self._initialize_lock = asyncio.Lock()
        self._initialize_result = None
        self._initialized = False

    @property
    def current_session(self) -> Optional[ClientSession]:
        return self._session

    async def get_session(self) -> ClientSession:
        async with self._lock:
            if self._session is None:
                await self._open_session_locked()
            return self._session

    async def ensure_initialized(self):
        session = await self.get_session()
        if self._initialized and self._initialize_result is not None:
            return session, self._initialize_result

        async with self._initialize_lock:
            if not self._initialized or self._initialize_result is None:
                initialize_result = await session.initialize()
                self._initialize_result = initialize_result
                self._initialized = True
            else:
                initialize_result = self._initialize_result

        return session, initialize_result

    async def reconnect(self):
        async with self._lock:
            await self._close_session_locked()
            await self._open_session_locked()
        # Run initialize outside of the lock to avoid deadlocks on nested calls
        return await self.ensure_initialized()

    async def close(self):
        async with self._lock:
            await self._close_session_locked()

    async def _open_session_locked(self):
        client_context = self._create_client_context()
        try:
            connection = await client_context.__aenter__()
        except Exception:
            # Ensure the context is closed if entering fails
            with contextlib.suppress(Exception):
                await client_context.__aexit__(None, None, None)
            raise

        reader, writer, *_ = connection
        session = ClientSession(reader, writer)
        try:
            await session.__aenter__()
        except Exception:
            with contextlib.suppress(Exception):
                await session.__aexit__(None, None, None)
            with contextlib.suppress(Exception):
                await client_context.__aexit__(None, None, None)
            raise

        self._client_context = client_context
        self._session = session
        self._initialized = False
        self._initialize_result = None

    async def _close_session_locked(self):
        session, client_context = self._session, self._client_context
        self._session = None
        self._client_context = None
        self._initialized = False
        self._initialize_result = None

        if session is not None:
            with contextlib.suppress(Exception):
                await session.__aexit__(None, None, None)

        if client_context is not None:
            with contextlib.suppress(Exception):
                await client_context.__aexit__(None, None, None)

    def _create_client_context(self):
        if self.server_type == "stdio":
            server_params = StdioServerParameters(
                command=self.command,
                args=self.args,
                env={**os.environ, **self.env},
            )
            return stdio_client(server_params)
        if self.server_type == "sse":
            timeout = self.connection_timeout or 900
            return sse_client(
                url=self.args[0],
                sse_read_timeout=timeout,
                headers=self.headers,
            )
        if self.server_type == "streamable-http":
            return streamablehttp_client(
                url=self.args[0],
                headers=self.headers,
                auth=self.auth_provider,
            )
        raise ValueError(f"Unsupported server type: {self.server_type}")


def validate_server_config(server_name: str, server_cfg: Dict[str, Any]) -> None:
    """Validate individual server configuration."""
    server_type = server_cfg.get("type")

    if normalize_server_type(server_type) in ("sse", "streamable-http"):
        if not server_cfg.get("url"):
            raise ValueError(
                f"Server '{server_name}' of type '{server_type}' requires a 'url' field"
            )
    elif server_cfg.get("command"):
        # stdio server
        if not isinstance(server_cfg["command"], str):
            raise ValueError(f"Server '{server_name}' 'command' must be a string")
        if server_cfg.get("args") and not isinstance(server_cfg["args"], list):
            raise ValueError(f"Server '{server_name}' 'args' must be a list")
    elif server_cfg.get("url") and not server_type:
        # Fallback for old SSE config without explicit type
        pass
    else:
        raise ValueError(f"Server '{server_name}' must have either 'command' for stdio or 'type' and 'url' for remote servers")
    
    # Validate disabledTools (supports camelCase & snake_case for backwards compatibility)
    disabled_tools = server_cfg.get("disabledTools")
    if disabled_tools is None:
        disabled_tools = server_cfg.get("disabled_tools")
    if disabled_tools is not None:
        if not isinstance(disabled_tools, list):
            raise ValueError(f"Server '{server_name}' 'disabledTools' must be a list")
        for tool_name in disabled_tools:
            if not isinstance(tool_name, str):
                raise ValueError(f"Server '{server_name}' 'disabledTools' must contain only strings")


def load_config(config_path: str) -> Dict[str, Any]:
    """Load and validate config from file."""
    try:
        with open(config_path, "r") as f:
            con
```

### Core Architecture Module: `src/mcpo/utils/auth.py`
```
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import base64

from passlib.context import CryptContext
from datetime import UTC, datetime, timedelta

import jwt
from typing import Optional, Union, List, Dict


ALGORITHM = "HS256"

bearer_security = HTTPBearer(auto_error=False)


def get_verify_api_key(api_key: str):
    async def verify_api_key(
        authorization: HTTPAuthorizationCredentials = Depends(bearer_security),
    ):
        if not authorization or not authorization.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid Authorization header",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = authorization.credentials
        if token != api_key:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid API key",
            )

    return verify_api_key


class APIKeyMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces Basic or Bearer token authentication for all requests.
    """

    def __init__(self, app, api_key: str):
        super().__init__(app)
        self.api_key = api_key

    async def dispatch(self, request: Request, call_next):
        # Skip authentication for OPTIONS requests
        if request.method == "OPTIONS":
            return await call_next(request)

        # Get authorization header
        authorization = request.headers.get("Authorization")

        # Verify API key
        try:
            # Use the same function that the dependency uses
            if not authorization:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing or invalid Authorization header"},
                    headers={"WWW-Authenticate": "Bearer, Basic"},
                )

            # Handle Bearer token auth
            if authorization.startswith("Bearer "):
                token = authorization[7:]  # Remove "Bearer " prefix
                if token != self.api_key:
                    return JSONResponse(
                        status_code=403, content={"detail": "Invalid API key"}
                    )
            # Handle Basic auth
            elif authorization.startswith("Basic "):
                # Decode the base64 credentials
                credentials = authorization[6:]  # Remove "Basic " prefix
                try:
                    decoded = base64.b64decode(credentials).decode("utf-8")
                    # Basic auth format is username:password
                    username, password = decoded.split(":", 1)
                    # Any username is allowed, but password must match api_key
                    if password != self.api_key:
                        return JSONResponse(
                            status_code=403, content={"detail": "Invalid credentials"}
                        )
                except Exception:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Invalid Basic Authentication format"},
                        headers={"WWW-Authenticate": "Bearer, Basic"},
                    )
            else:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Unsupported authorization method"},
                    headers={"WWW-Authenticate": "Bearer, Basic"},
                )

            return await call_next(request)
        except Exception as e:
            return JSONResponse(status_code=500, content={"detail": str(e)})


# def create_token(data: dict, expires_delta: Union[timedelta, None] = None) -> str:
#     payload = data.copy()

#     if expires_delta:
#         expire = datetime.now(UTC) + expires_delta
#         payload.update({"exp": expire})

#     encoded_jwt = jwt.encode(payload, SESSION_SECRET, algorithm=ALGORITHM)
#     return encoded_jwt


# def decode_token(token: str) -> Optional[dict]:
#     try:
#         decoded = jwt.decode(token, SESSION_SECRET, algorithms=[ALGORITHM])
#         return decoded
#     except Exception:
#         return None

```

### Core Architecture Module: `src/mcpo/utils/config_watcher.py`
```
import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Callable, Optional, Dict, Any
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent, FileMovedEvent, FileCreatedEvent
import threading


logger = logging.getLogger(__name__)


class ConfigChangeHandler(FileSystemEventHandler):
    """Handler for config file changes."""

    def __init__(self, origin_config_path: Path, reload_callback: Callable[[Dict[str, Any]], None], loop: asyncio.AbstractEventLoop):
        self.origin_config_path = origin_config_path
        self.config_path = origin_config_path.resolve()  # Resolve to absolute path
        self.is_symlink = origin_config_path.is_symlink()
        self.reload_callback = reload_callback
        self.loop = loop  # Store reference to the main event loop
        self._last_modification = 0
        self._debounce_delay = 0.5  # 500ms debounce

    def on_modified(self, event):
        """Handle file modification events."""
        if self.is_symlink:
            self.config_path = self.origin_config_path.resolve()  # Re-resolve to get the latest symlink target
            logger.info(f"Symlink file modified: {self.config_path}")
            self._trigger_reload()
            return

        if event.is_directory:
            return

        # Check if the modified file is our config file
        event_path = Path(event.src_path).resolve()
        logger.debug(f"File modified: {event_path}, watching: {self.config_path}")

        # Also check for file name match in case of temporary files or atomic writes
        if (event_path == self.config_path or
            event_path.name == self.config_path.name and event_path.parent == self.config_path.parent):

            logger.info(f"Config file modified: {self.config_path}")
            self._trigger_reload()
        else:
            logger.debug(f"File {event_path} modified but not our config file {self.config_path}")

    def on_moved(self, event):
        """Handle file move events (atomic writes)."""
        if event.is_directory:
            return

        # Check if the destination is our config file (atomic write pattern)
        dest_path = Path(event.dest_path).resolve()
        logger.debug(f"File moved: {event.src_path} -> {dest_path}, watching: {self.config_path}")

        if (dest_path == self.config_path or
            dest_path.name == self.config_path.name and dest_path.parent == self.config_path.parent):

            logger.info(f"Config file replaced via move: {self.config_path}")
            self._trigger_reload()

    def on_created(self, event):
        """Handle file creation events."""
        if event.is_directory:
            return

        # Check if the created file is our config file
        event_path = Path(event.src_path).resolve()
        logger.debug(f"File created: {event_path}, watching: {self.config_path}")

        if (event_path == self.config_path or
            event_path.name == self.config_path.name and event_path.parent == self.config_path.parent):

            logger.info(f"Config file created: {self.config_path}")
            self._trigger_reload()

    def _trigger_reload(self):
        """Common method to trigger a reload."""
        current_time = time.time()

        # Debounce rapid file changes
        if current_time - self._last_modification < self._debounce_delay:
            logger.debug(f"Debouncing file change (too soon): {current_time - self._last_modification:.2f}s")
            return

        self._last_modification = current_time
        logger.info(f"Config file change detected: {self.config_path}")

        # Schedule the reload callback using the stored loop reference
        try:
            # Use call_soon_threadsafe to schedule the coroutine from a different thread
            future = asyncio.run_coroutine_threadsafe(self._handle_config_change(), self.loop)
            logger.debug(f"Scheduled config reload task from thread: {future}")
        except Exception as e:
            logger.error(f"Failed to schedule config reload: {e}")

    async def _handle_config_change(self):
        """Handle config change with proper error handling."""
        try:
            await asyncio.sleep(self._debounce_delay)  # Additional debounce

            logger.debug(f"Processing config file change: {self.config_path}")

            # Read and validate the new config
            with open(self.config_path, 'r') as f:
                new_config = json.load(f)

            # Call the reload callback
            await self.reload_callback(new_config)

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in config file: {e}")
        except FileNotFoundError:
            logger.error(f"Config file not found: {self.config_path}")
        except Exception as e:
            logger.error(f"Error reloading config: {e}")


class ConfigWatcher:
    """Watches a config file for changes and triggers reloads."""

    def __init__(self, config_path: str, reload_callback: Callable[[Dict[str, Any]], None]):
        self.origin_config_path = Path(config_path)
        self.config_path = self.origin_config_path.resolve()
        self.reload_callback = reload_callback
        self.observer: Optional[Observer] = None
        self.handler: Optional[ConfigChangeHandler] = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def start(self):
        """Start watching the config file."""
        if not self.config_path.exists():
            logger.error(f"Config file does not exist: {self.config_path}")
            return

        # Get the current event loop
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            logger.error("No running event loop found, cannot start config watcher")
            return

        self.handler = ConfigChangeHandler(self.origin_config_path, self.reload_callback, self.loop)
        self.observer = Observer()

        # Watch the directory containing the config file
        watch_dir = self.origin_config_path.parent
        logger.info(f"Watching directory: {watch_dir} for file: {self.config_path}")
        self.observer.schedule(self.handler, str(watch_dir), recursive=False)

        self.observer.start()
        logger.info(f"Started watching config file: {self.config_path}")
        logger.debug(f"File watcher is alive: {self.observer.is_alive()}")

    def stop(self):
        """Stop watching the config file."""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            logger.info(f"Stopped watching config file: {self.config_path}")

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()
```

### Core Architecture Module: `src/mcpo/utils/headers.py`
```
import logging
import re
from typing import Dict, List, Optional, Any
from fastapi import Request

logger = logging.getLogger(__name__)


def validate_client_header_forwarding_config(server_name: str, config: Dict[str, Any]) -> None:
    """Validate client header forwarding configuration for a server."""
    if not isinstance(config, dict):
        raise ValueError(f"Server '{server_name}' client_header_forwarding must be a dictionary")
    
    enabled = config.get("enabled", False)
    if not isinstance(enabled, bool):
        raise ValueError(f"Server '{server_name}' client_header_forwarding.enabled must be a boolean")
    
    if not enabled:
        return  # No further validation needed if disabled
    
    whitelist = config.get("whitelist", [])
    blacklist = config.get("blacklist", [])
    
    if whitelist and not isinstance(whitelist, list):
        raise ValueError(f"Server '{server_name}' client_header_forwarding.whitelist must be a list")
    
    if blacklist and not isinstance(blacklist, list):
        raise ValueError(f"Server '{server_name}' client_header_forwarding.blacklist must be a list")
    
    debug_headers = config.get("debug_headers", False)
    if not isinstance(debug_headers, bool):
        raise ValueError(f"Server '{server_name}' client_header_forwarding.debug_headers must be a boolean")


def match_header_pattern(header_name: str, patterns: List[str]) -> bool:
    """Check if header name matches any of the given patterns."""
    for pattern in patterns:
        if pattern == "*":
            return True
        if pattern.endswith("*"):
            # Wildcard pattern like "X-User-*"
            prefix = pattern[:-1]
            if header_name.startswith(prefix):
                return True
        elif pattern == header_name:
            return True
    return False


def filter_headers(
    request_headers: Dict[str, str], 
    whitelist: List[str],
    blacklist: List[str],
    debug_headers: bool = False
) -> Dict[str, str]:
    """Filter request headers based on whitelist and blacklist."""
    filtered_headers = {}
    
    for header_name, header_value in request_headers.items():
        # Skip if in blacklist
        if blacklist and match_header_pattern(header_name, blacklist):
            if debug_headers:
                logger.debug(f"Header '{header_name}' blocked by blacklist")
            continue
        
        # Include if in whitelist (or no whitelist specified)
        if not whitelist or match_header_pattern(header_name, whitelist):
            filtered_headers[header_name] = header_value
            if debug_headers:
                logger.debug(f"Header '{header_name}' forwarded")
        elif debug_headers:
            logger.debug(f"Header '{header_name}' not in whitelist")
    
    return filtered_headers


def process_headers_for_server(
    request: Request,
    header_config: Dict[str, Any]
) -> Dict[str, str]:
    """Process and filter headers for a specific MCP server."""
    if not header_config.get("enabled", False):
        return {}
    
    # Convert FastAPI headers to dict
    request_headers = dict(request.headers)
    
    # Get configuration values
    whitelist = header_config.get("whitelist", [])
    blacklist = header_config.get("blacklist", [])
    debug_headers = header_config.get("debug_headers", False)
    
    # Filter headers based on whitelist/blacklist
    filtered_headers = filter_headers(request_headers, whitelist, blacklist, debug_headers)
    
    if debug_headers:
        logger.debug(f"Final forwarded headers: {list(filtered_headers.keys())}")
    
    return filtered_headers

```

### Core Architecture Module: `src/mcpo/utils/main.py`
```
import logging
import json
import traceback
from typing import Any, Dict, ForwardRef, List, Optional, Type, Union

from anyio import ClosedResourceError
from fastapi import HTTPException, Request

from mcp import types
from mcp.types import (
    CallToolResult,
    PARSE_ERROR,
    INVALID_REQUEST,
    METHOD_NOT_FOUND,
    INVALID_PARAMS,
    INTERNAL_ERROR,
)

from mcp.shared.exceptions import McpError

from pydantic import Field, create_model
from pydantic.fields import FieldInfo

from mcpo.utils.headers import process_headers_for_server

MCP_ERROR_TO_HTTP_STATUS = {
    PARSE_ERROR: 400,
    INVALID_REQUEST: 400,
    METHOD_NOT_FOUND: 404,
    INVALID_PARAMS: 422,
    INTERNAL_ERROR: 500,
}

logger = logging.getLogger(__name__)


def normalize_server_type(server_type: str) -> str:
    """Normalize server_type to a standard value."""
    if server_type in ["streamable_http", "streamablehttp", "streamable-http"]:
        return "streamable-http"
    return server_type


def process_tool_response(result: CallToolResult) -> list:
    """Universal response processor for all tool endpoints"""
    response = []
    for content in result.content:
        if isinstance(content, types.TextContent):
            text = content.text
            if isinstance(text, str):
                try:
                    text = json.loads(text)
                except json.JSONDecodeError:
                    pass
            response.append(text)
        elif isinstance(content, types.ImageContent):
            image_data = f"data:{content.mimeType};base64,{content.data}"
            response.append(image_data)
        elif isinstance(content, types.EmbeddedResource):
            # TODO: Handle embedded resources
            response.append("Embedded resource not supported yet.")
    return response


def name_needs_alias(name: str) -> bool:
    """Check if a field name needs aliasing (if it starts with '_')."""
    return name.startswith("_")


def generate_alias_name(original_name: str, existing_names: set) -> str:
    """
    Generate an alias field name by stripping unwanted chars, and avoiding conflicts with existing names.

    Args:
        original_name: The original field name (should start with '_')
        existing_names: Set of existing names to avoid conflicts with

    Returns:
        An alias name that doesn't conflict with existing names
    """
    alias_name = original_name.lstrip("_")
    # Handle potential naming conflicts
    original_alias_name = alias_name
    suffix_counter = 1
    while alias_name in existing_names:
        alias_name = f"{original_alias_name}_{suffix_counter}"
        suffix_counter += 1
    return alias_name


def _process_schema_property(
    _model_cache: Dict[str, Type],
    prop_schema: Dict[str, Any],
    model_name_prefix: str,
    prop_name: str,
    is_required: bool,
    schema_defs: Optional[Dict] = None,
) -> tuple[Union[Type, List, ForwardRef, Any], FieldInfo]:
    """
    Recursively processes a schema property to determine its Python type hint
    and Pydantic Field definition.

    Returns:
        A tuple containing (python_type_hint, pydantic_field).
        The pydantic_field contains default value and description.
    """
    if "$ref" in prop_schema:
        ref = prop_schema["$ref"]
        if ref.startswith("#/properties/"):
            # Remove common prefix in pathes.
            prefix_path = model_name_prefix.split("_form_model_")[-1]
            ref_path = ref.split("#/properties/")[-1]
            # Translate $ref path to model_name_prefix style.
            ref_path = ref_path.replace("/properties/", "_model_")
            ref_path = ref_path.replace("/items", "_item")
            # If $ref path is a prefix substring of model_name_prefix path,
            # there exists a circular reference.
            # The loop should be broke with a return to avoid exception.
            if prefix_path.startswith(ref_path):
                # TODO: Find the exact type hint for the $ref.
                return Any, Field(default=None, description="")
        ref = ref.split("/")[-1]
        assert ref in schema_defs, "Custom field not found"
        prop_schema = schema_defs[ref]

    prop_type = prop_schema.get("type")
    prop_desc = prop_schema.get("description", "")

    default_value = ... if is_required else prop_schema.get("default", None)
    pydantic_field = Field(default=default_value, description=prop_desc)

    # Handle the case where prop_type is missing but 'anyOf' key exists
    # In this case, use data type from 'anyOf' to determine the type hint
    if "anyOf" in prop_schema:
        type_hints = []
        for i, schema_option in enumerate(prop_schema["anyOf"]):
            type_hint, _ = _process_schema_property(
                _model_cache,
                schema_option,
                f"{model_name_prefix}_{prop_name}",
                f"choice_{i}",
                False,
                schema_defs=schema_defs,
            )
            type_hints.append(type_hint)
        return Union[tuple(type_hints)], pydantic_field

    # Handle the case where prop_type is a list of types, e.g. ['string', 'number']
    if isinstance(prop_type, list):
        # Create a Union of all the types
        type_hints = []
        for type_option in prop_type:
            # Create a temporary schema with the single type and process it
            temp_schema = dict(prop_schema)
            temp_schema["type"] = type_option
            type_hint, _ = _process_schema_property(
                _model_cache,
                temp_schema,
                model_name_prefix,
                prop_name,
                False,
                schema_defs=schema_defs,
            )
            type_hints.append(type_hint)

        # Return a Union of all possible types
        return Union[tuple(type_hints)], pydantic_field

    if prop_type == "object":
        nested_properties = prop_schema.get("properties", {})
        nested_required = prop_schema.get("required", [])
        nested_fields = {}

        nested_model_name = f"{model_name_prefix}_{prop_name}_model".replace(
            "__", "_"
        ).rstrip("_")

        if nested_model_name in _model_cache:
            return _model_cache[nested_model_name], pydantic_field

        for name, schema in nested_properties.items():
            is_nested_required = name in nested_required
            nested_type_hint, nested_pydantic_field = _process_schema_property(
                _model_cache,
                schema,
                nested_model_name,
                name,
                is_nested_required,
                schema_defs,
            )

            if name_needs_alias(name):
                other_names = set().union(
                    nested_properties, nested_fields, _model_cache
                )
                alias_name = generate_alias_name(name, other_names)
                aliased_field = Field(
                    default=nested_pydantic_field.default,
                    description=nested_pydantic_field.description,
                    alias=name,
                )
                nested_fields[alias_name] = (nested_type_hint, aliased_field)
            else:
                nested_fields[name] = (nested_type_hint, nested_pydantic_field)

        if not nested_fields:
            return Dict[str, Any], pydantic_field

        NestedModel = create_model(nested_model_name, **nested_fields)
        _model_cache[nested_model_name] = NestedModel

        return NestedModel, pydantic_field

    elif prop_type == "array":
        items_schema = prop_schema.get("items")
        if not items_schema:
            # Default to list of anything if items schema is missing
            return List[Any], pydantic_field

        # Recursively determine the type of items in the array
        item_type_hint, _ = _process_schema_property(
            _model_cache,
            items_schema,
            f"{model_name_prefix}_{prop_name}",
            "ite
```

### Core Architecture Module: `src/mcpo/utils/oauth.py`
```
import asyncio
import json
import logging
import os
import hashlib
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
import webbrowser
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from mcp.client.auth import OAuthClientProvider, TokenStorage
from mcp.shared.auth import OAuthClientInformationFull, OAuthClientMetadata, OAuthToken
from pydantic import AnyUrl

logger = logging.getLogger(__name__)

def _load_callback_html(status: str, title: str, heading: str, message: str, action_text: str) -> str:
    """Load and render the OAuth callback HTML template"""
    template_path = Path(__file__).parent / "oauth_callback.html"
    
    try:
        logger.debug(f"Loading OAuth template from: {template_path}")
        logger.debug(f"Template exists: {template_path.exists()}")
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template = f.read()
        
        logger.debug(f"Template loaded, length: {len(template)}")
        
        # Define icons and status classes
        icon = "✓" if status == "success" else "✕"
        status_class = status
        
        # Replace template variables
        html = template.format(
            title=title,
            status_class=status_class,
            icon=icon,
            heading=heading,
            message=message,
            action_text=action_text
        )
        
        logger.debug("Template rendered successfully")
        return html
    except Exception as e:
        logger.error(f"Failed to load OAuth callback template from {template_path}: {e}")
        logger.error(f"Template path exists: {template_path.exists()}")
        # Fallback to simple HTML
        return f"<html><body><h2>{heading}</h2><p>{message}</p></body></html>"

class InMemoryTokenStorage(TokenStorage):
    """Simple in-memory token storage per server instance"""
    def __init__(self, server_name: str):
        self.server_name = server_name
        self.tokens: Optional[OAuthToken] = None
        self.client_info: Optional[OAuthClientInformationFull] = None
        
    async def get_tokens(self) -> Optional[OAuthToken]:
        return self.tokens
        
    async def set_tokens(self, tokens: OAuthToken) -> None:
        self.tokens = tokens
        logger.info(f"OAuth tokens stored for server: {self.server_name}")
        
    async def get_client_info(self) -> Optional[OAuthClientInformationFull]:
        return self.client_info
        
    async def set_client_info(self, info: OAuthClientInformationFull) -> None:
        self.client_info = info


class FileTokenStorage(TokenStorage):
    """File-based token storage with per-server isolation"""
    def __init__(self, server_name: str, storage_dir: str = None):
        self.server_name = server_name
        # Use hash of server name to avoid filesystem issues
        safe_name = hashlib.md5(server_name.encode()).hexdigest()[:8]
        if storage_dir is None:
            storage_dir = os.path.expanduser("~/.mcpo/tokens")
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.token_file = self.storage_dir / f"{safe_name}_tokens.json"
        self.client_file = self.storage_dir / f"{safe_name}_client.json"
        
    async def get_tokens(self) -> Optional[OAuthToken]:
        if self.token_file.exists():
            try:
                with open(self.token_file, 'r') as f:
                    data = json.load(f)
                    return OAuthToken.model_validate(data)
            except Exception as e:
                logger.error(f"Failed to load tokens for {self.server_name}: {e}")
        return None
        
    async def set_tokens(self, tokens: OAuthToken) -> None:
        try:
            with open(self.token_file, 'w') as f:
                json.dump(tokens.model_dump(mode='json'), f)
            logger.info(f"OAuth tokens persisted for server: {self.server_name}")
        except Exception as e:
            logger.error(f"Failed to save tokens for {self.server_name}: {e}")
            
    async def get_client_info(self) -> Optional[OAuthClientInformationFull]:
        if self.client_file.exists():
            try:
                with open(self.client_file, 'r') as f:
                    data = json.load(f)
                    return OAuthClientInformationFull.model_validate(data)
            except Exception as e:
                logger.error(f"Failed to load client info for {self.server_name}: {e}")
        return None
        
    async def set_client_info(self, info: OAuthClientInformationFull) -> None:
        try:
            with open(self.client_file, 'w') as f:
                json.dump(info.model_dump(mode='json'), f)
        except Exception as e:
            logger.error(f"Failed to save client info for {self.server_name}: {e}")


class CallbackHandler(BaseHTTPRequestHandler):
    """HTTP handler for OAuth callbacks"""
    def __init__(self, request, client_address, server, data):
        self.data = data
        super().__init__(request, client_address, server)
        
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        if "code" in q:
            self.data["authorization_code"] = q["code"][0]
            self.data["state"] = q.get("state", [None])[0]
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            
            html = _load_callback_html(
                status="success",
                title="Authorization Successful - MCPO",
                heading="Authorization Successful!",
                message="Your OAuth authorization was completed successfully. The application can now access the requested resources.",
                action_text="You can safely close this browser tab and return to your application."
            )
            self.wfile.write(html.encode('utf-8'))
            
        elif "error" in q:
            error_desc = q.get("error_description", [q["error"][0]])[0]
            self.data["error"] = q["error"][0]
            self.send_response(400)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            
            html = _load_callback_html(
                status="error",
                title="Authorization Failed - MCPO",
                heading="Authorization Failed",
                message=f"The OAuth authorization process encountered an error: {error_desc}",
                action_text="Please close this tab and check the application logs for more details."
            )
            self.wfile.write(html.encode('utf-8'))
            
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            
    def log_message(self, *_):
        pass  # Suppress request logs


class CallbackServer:
    """Local HTTP server for OAuth callbacks"""
    def __init__(self, port: int = 3030):
        self.port = port
        self.server = None
        self.thread = None
        self.data = {"authorization_code": None, "state": None, "error": None}
        
    def _handler(self):
        data = self.data
        class H(CallbackHandler):
            def __init__(self, req, addr, srv):
                super().__init__(req, addr, srv, data)
        return H
        
    def start(self):
        self.server = HTTPServer(("localhost", self.port), self._handler())
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        logger.info(f"OAuth callback server listening on http://localhost:{self.port}/callback")
        
    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        if self.thread:
            self.thread.join(timeout=
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #280** (2026-05-17): **issue: Trailing Slash**
  *Symptoms*: ### Check Existing Issues  - [x] I have searched the existing issues and discussions. - [x] I am using the latest version of mcpo.  ### mcpo Version  main (git-91e8f94)  ### Open WebUI Version (if applicable)  v0.7.2  ### Operating System  Ubuntu 24.04 and Docker  ### Browser (if applicable)  Firefox  ### Confirmation  - [x] I have read and followed all instructions in `README.md`. - [x] I am using the latest version of **both** MCPO and Open WebUI. - [x] I have included the browser console logs. - [x] I have included the Docker container logs. - [x] I have listed steps to reproduce the bug in detail.  ### Expected Behavior  Connect OpenWebUI to MCPO by streamable HTTP  ### Actual Behavior  When I try to connect, the request add a trailing slash and 404 page not found result.  ### Steps to Reproduce  docker compose (dev): ```   mcpo:     image: ghcr.io/open-webui/mcpo:main     container_name: assistant.quanticware.com-mcpo     command: ["--api-key", "Hello", "--config", "/app/config/config.json"]     volumes:       - type: bind         source: "/data/mcpo/app/config"         target: "/app/config"     restart: unless-stopped ```  MCPO configuration in OpenWebUi:  <img width="525" height="722" alt="Image" src="https://github.com/user-attachments/assets/876406de-682d-46fb-9b27-0df840259356" />  ### Logs & Screenshots  MCPO logs: ``` INFO:     192.168.144.3:55706 - "POST /time HTTP/1.1" 307 Temporary Redirect INFO:     192.168.144.3:55706 - "POST /time/ HTTP/1.1" 404 Not Found ``
  **Post-Mortem & Fix Analysis**:
  > I have same issue, but i found when i switch "MCP Streamable HTTP" to "OpenAPI", then it's works for me. 
  > mcpo is to expose mcp servers as openapi tools. you've got the type set to mcp server, which is the wrong one for this application. As smileyik said, switch streamable http to openapi :) 

- **Issue #269** (2025-12-04): **issue: Server granted unauthorized scopes in Microsoft Entra OAuth**
  *Symptoms*: ### Check Existing Issues  - [x] I have searched the existing issues and discussions. - [x] I am using the latest version of mcpo.  ### mcpo Version  0.0.19  ### Open WebUI Version (if applicable)  _No response_  ### Operating System   Windows 11  ### Browser (if applicable)  _No response_  ### Confirmation  - [x] I have read and followed all instructions in `README.md`. - [x] I am using the latest version of **both** MCPO and Open WebUI. - [x] I have included the browser console logs. - [x] I have included the Docker container logs. - [x] I have listed steps to reproduce the bug in detail.  ### Expected Behavior  start up successfully  ### Actual Behavior  Server granted unauthorized scopes  ### Steps to Reproduce  mcpo --config .\config.json  ### Logs & Screenshots  Starting MCP OpenAPI Proxy with config file: .\config.json 2025-10-28 18:02:29,403 - INFO - Starting MCPO Server... 2025-10-28 18:02:29,403 - INFO -   Name: MCP OpenAPI Proxy 2025-10-28 18:02:29,403 - INFO -   Version: 1.0 2025-10-28 18:02:29,403 - INFO -   Description: Automatically generated API from MCP Tool Schemas 2025-10-28 18:02:29,403 - INFO -   Hostname: 2025-10-28 18:02:29,403 - INFO -   Port: 8000 2025-10-28 18:02:29,403 - INFO -   API Key: Not Provided 2025-10-28 18:02:29,406 - INFO -   CORS Allowed Origins: ['*'] 2025-10-28 18:02:29,406 - INFO -   Path Prefix: / 2025-10-28 18:02:29,406 - INFO -   Root Path: 2025-10-28 18:02:29,406 - INFO - Loading MCP server configurations from: .\config.json 2025-1

- **Issue #265** (2026-05-17): **issue: Waiting for application startup**
  *Symptoms*: ### Check Existing Issues  - [x] I have searched the existing issues and discussions. - [x] I am using the latest version of mcpo.  ### mcpo Version  v1.0  ### Open WebUI Version (if applicable)  v0.6.34  ### Operating System  macOS Tahoe  ### Browser (if applicable)  Safari 26.0.1  ### Confirmation  - [x] I have read and followed all instructions in `README.md`. - [x] I am using the latest version of **both** MCPO and Open WebUI. - [x] I have included the browser console logs. - [x] I have included the Docker container logs. - [x] I have listed steps to reproduce the bug in detail.  ### Expected Behavior  I have a custom MCP Server written in Xojo (https://github.com/gkjpettet/mcpwikipedia) that functions through stdout. It works perfectly with LM Studio and Claude Desktop. I am expecting it to be proxied by mcpo to an OpenAPI server.  ### Actual Behavior  mcpo hangs waiting for application startup.  ### Steps to Reproduce  1. I launch my tool (mcpwikipedia) like this:  ```bash uvx mcpo --port 51332 -- /Users/garry/mcpservers/mcpwikipedia/mcpwikipedia --useragent="XojoMCPWikipediaSearch" --verbose=true ```  2. This is the output in the Terminal:  ```bash Starting MCP OpenAPI Proxy on 0.0.0.0:51332 with command: stdbuf -o0 /Users/garry/mcpservers/mcpwikipedia/mcpwikipedia --useragent=XojoMCPWikipediaSearch 2025-10-18 13:39:46,162 - INFO - Starting MCPO Server... 2025-10-18 13:39:46,162 - INFO -   Name: MCP OpenAPI Proxy 2025-10-18 13:39:46,162 - INFO -   Version: 1.0 2025-10-
  **Post-Mortem & Fix Analysis**:
  > I'm not familiar with xojo but it looks like for macOS, it builds a .app that can be ran. Does the above command actually work with Claude? I cloned your repo but there's no build in there, just src. mcpo is just running `stdbuf -o0 /Users/garry/mcpservers/mcpwikipedia/mcpwikipedia --useragent=XojoMCPWikipediaSearch` - if you paste that directly into your terminal does the stdio mcp startup? 
  > Hi,  I've attached a built binary for macOS (Xojo builds the executable and then a resources folder next to).   I'm using the tool in LM Studio with no problems.  Here's how I call it in LM Studio:  ```json {   "mcpServers": {     "mcpwikipedia": {       "command": "/Users/garry/mcpservers/mcpwikipedia/mcpwikipedia",       "args": [         "--useragent",         "XojoMCPWikipediaSearch"       ]     }   } } ```  [mcpwikipedia.zip](https://github.com/user-attachments/files/22986615/mcpwikipedia.zip)
  > I don't think this is a fit for this project, too niche 

- **Issue #260** (2026-05-17): **issue: Startup Error: "asyncio.run() cannot be called from a running event loop"**
  *Symptoms*: ### Check Existing Issues  - [x] I have searched the existing issues and discussions. - [x] I am using the latest version of mcpo.  ### mcpo Version  v1.0 sha256:af810dc3deb1769425bb0f0001d27097a434322f8e66a4d095369a7c087047e8  ### Open WebUI Version (if applicable)  _No response_  ### Operating System  It's whatever you packaged open-webui/mcpo:main  ### Browser (if applicable)  _No response_  ### Confirmation  - [x] I have read and followed all instructions in `README.md`. - [x] I am using the latest version of **both** MCPO and Open WebUI. - [x] I have included the browser console logs. - [x] I have included the Docker container logs. - [x] I have listed steps to reproduce the bug in detail.  ### Expected Behavior  Able to run Streamable HTTP MCP Server  ### Actual Behavior  MCP Server fails to start.  ### Steps to Reproduce  1. image: ghcr.io/open-webui/mcpo:main 2. command: ["mcpo", "--config", "/mcp-config.json", "--server-type", "streamable-http", "--", "http://127.0.0.1:8002/mcp"]  Runs fine without the `--server-type` and everything after. Documentation states I should be able to use this command to run `mcpo` in Streamable HTTP mode.  ### Logs & Screenshots  ```bash 2025-10-10 21:40:31,423 - INFO - Starting MCPO Server... 2025-10-10 21:40:31,423 - INFO -   Name: MCP OpenAPI Proxy 2025-10-10 21:40:31,423 - INFO -   Version: 1.0 2025-10-10 21:40:31,423 - INFO -   Description: Automatically generated API from MCP Tool Schemas 2025-10-10 21:40:31,423 - INFO -   Hostname
  **Post-Mortem & Fix Analysis**:
  > This is the second time, reading the documentation, I feel like there is a way to put `mcpo` in HTTP Streamable Mode, or SSE.  If this isn't the case please clarify.  I wont close this ticket this time so you can see what's going on.
  > I thought maybe you wanted me to painstakingly do this to all of my entries: ```     "time": {       "command": "uvx",       "args": ["mcp-server-time", "--local-timezone=America/New_York"]     },     "time-stream": {       "type": "streamable-http",       "url": "http://192.168.18.1:8000/time"     }, ```  But not even that works because `time` isn't being served when `mcpo` starts up....
  > ```bash cat mcpo-streamable.jq . as $config | {     server: $config.server,     mcpServers: (       $config.mcpServers       | to_entries       | map(           .key as $tool_name           | {               key: ($tool_name + "-stream"),               value: {                 "type": "streamable-http",                 "url": "http://192.168.18.1:8000/" + $tool_name               }             }         )       | from_entries     )   }   cat actual_mcpo_config.json | jq -f mcpo-streamable.jq   "mcpServers": {     "time-stream": {       "type": "streamable-http",       "url": "http://192.168.18.1:8000/time"     } } ```  So I guess I'll just set up a second `mcpo` server and init after this first one starts....

- **Issue #249** (2025-09-17): **issue: ValueError: Server 'web-search-prime' must have either 'command' for stdio or 'type' and 'url' for remote servers**
  *Symptoms*: ### Check Existing Issues  - [x] I have searched the existing issues and discussions. - [x] I am using the latest version of mcpo.  ### mcpo Version  latest  ### Open WebUI Version (if applicable)  v0.6.5  ### Operating System  Windows 10  ### Browser (if applicable)  _No response_  ### Confirmation  - [x] I have read and followed all instructions in `README.md`. - [x] I am using the latest version of **both** MCPO and Open WebUI. - [x] I have included the browser console logs. - [x] I have included the Docker container logs. - [x] I have listed steps to reproduce the bug in detail.  ### Expected Behavior  Normal  ### Actual Behavior  it won't work  ### Steps to Reproduce  1.edit config.json ```json {   "mcpServers": {     "web-search-prime": {       "type": "http",       "url": "https://open.bigmodel.cn/api/mcp/web_search_prime/mcp",       "headers": {         "Authorization": "Bearer your-token"       }     }   } }  ``` 2.run  ### Logs & Screenshots  /app/.cache/uv/archive-v0/DenW0z9s8AaQzrqPxGUj9/lib/python3.13/site-packages │ │ /mcpo/main.py:70 in validate_server_config                                   │ │                                                                              │ │    67 │   │   # Fallback for old SSE config without explicit type            │ │    68 │   │   pass                                                           │ │    69 │   else:                                                              │ │ ❱  70 │   │   raise ValueError(f"Server '{serve
  **Post-Mortem & Fix Analysis**:
  > I have the same issue, did you find a way to fix it?
  > > I have the same issue, did you find a way to fix it?  No way, I ended up deleting this MCP Server and replacing it with one.
  > Can you reopen the issue? This bug is legit. Btw, what did you use to plug a MCP server?

- **Issue #240** (2026-05-17): **issue: anyio.ClosedResourceError for connecting streamable_http MCP server**
  *Symptoms*: ### Check Existing Issues  - [x] I have searched the existing issues and discussions. - [x] I am using the latest version of mcpo.  ### mcpo Version  v0.0.17  ### Open WebUI Version (if applicable)  _No response_  ### Operating System  Ubuntu  ### Browser (if applicable)  _No response_  ### Confirmation  - [x] I have read and followed all instructions in `README.md`. - [x] I am using the latest version of **both** MCPO and Open WebUI. - [x] I have included the browser console logs. - [x] I have included the Docker container logs. - [x] I have listed steps to reproduce the bug in detail.  ### Expected Behavior  I think it should re-establish a new session  ### Actual Behavior  It cannot connect to my MCP server anymore and keep return HTTP Response code 500 but actually my MCP server is still running and able to receive request.  ### Steps to Reproduce  The MCP server is customized and maybe handle some requests take longer time than mcpo expected  ### Logs & Screenshots  INFO:     10.224.33.204:51454 - "POST /custom_kubectl_mcp/scan_unhealthy_pods_by_namespace HTTP/1.1" 500 Internal Server Error 2025-08-27 01:46:10,138 - INFO - Calling endpoint: scan_unhealthy_pods_by_namespace, with args: {'cluster_name': 'rke2-sle-micro-elemental', 'namespace': 'cattle-monitoring-system', 'min_restart_count': 1, 'restart_time_window_minutes': 60} 2025-08-27 01:46:10,139 - INFO - Unexpected error calling scan_unhealthy_pods_by_namespace: Traceback (most recent call last):   File "/app/.venv/
  **Post-Mortem & Fix Analysis**:
  > I'm having the same issue, using `latest` 
  > https://github.com/open-webui/mcpo/compare/issues/240?expand=1 

- **Issue #237** (2025-10-18): **issue: Crashes without any tools**
  *Symptoms*: ### Check Existing Issues  - [x] I have searched the existing issues and discussions. - [x] I am using the latest version of mcpo.  ### mcpo Version  0.0.17  ### Open WebUI Version (if applicable)  _No response_  ### Operating System  Linux Mint 22 x86_64  ### Browser (if applicable)  _No response_  ### Confirmation  - [x] I have read and followed all instructions in `README.md`. - [x] I am using the latest version of **both** MCPO and Open WebUI. - [x] I have included the browser console logs. - [x] I have included the Docker container logs. - [x] I have listed steps to reproduce the bug in detail.  ### Expected Behavior  Server runs  ### Actual Behavior  Crashes with "mcp.shared.exceptions.McpError: Method not found":   ### Steps to Reproduce  1. Start any mcp Server without any tools (in my example the demo from https://github.com/modelcontextprotocol/typescript-sdk with all tools removed  2. if you are trying to reproduce use the following versions as dependencies as every other zed version will fail: ```     "dependencies": {         "@modelcontextprotocol/sdk": "^1.17.3",         "zod": "3.25.49"     } ``` 3. Run mcpo: `mcpo --host 0.0.0.0 --port 8000 -- node dist/poc.js`  ### Logs & Screenshots  ``` Starting MCP OpenAPI Proxy on 0.0.0.0:8000 with command: node dist/poc.js 2025-08-21 13:07:39,581 - INFO - Starting MCPO Server... 2025-08-21 13:07:39,581 - INFO -   Name: MCP OpenAPI Proxy 2025-08-21 13:07:39,581 - INFO -   Version: 1.0 2025-08-21 13:07:39,581 - INFO -   D
  **Post-Mortem & Fix Analysis**:
  > Just noticed that this does not handle resources, resource templates or prompts. This is the alternative for mcp for openwebui?  We are currently evaluating production use for openwebui but this is a real dealbreaker for us
  > Same for me :-( But mcpo will only proxy tools, right? Because I tried to proxy resources and it doesn't expose them.
  > @GevatterGaul [yes only tools](https://github.com/open-webui/mcpo/blob/44ce6d05b0392231c359c2d86228835001942851/src/mcpo/main.py#L271). Resources and prompts aren't handled in the code. 

- **Issue #235** (2026-05-17): **issue: SSE Read Timeout Bug in MCPO v0.0.17**
  *Symptoms*: ### Check Existing Issues  - [x] I have searched the existing issues and discussions. - [x] I am using the latest version of mcpo.  ### mcpo Version  v0.0.17  ### Open WebUI Version (if applicable)  _No response_  ### Operating System  Ubuntu 22.04  ### Browser (if applicable)  _No response_  ### Confirmation  - [x] I have read and followed all instructions in `README.md`. - [x] I am using the latest version of **both** MCPO and Open WebUI. - [x] I have included the browser console logs. - [x] I have included the Docker container logs. - [x] I have listed steps to reproduce the bug in detail.  ### Expected Behavior  SSE (Server-Sent Events) connections should persist without timeout errors when using `--server-type sse` in individual server mode. The intended behavior according to the code logic is:  - `connection_timeout` should be `None` when not explicitly set - `sse_read_timeout` should be `None or 900` = **900 seconds (15 minutes)** - SSE connections should remain stable indefinitely for long-running AI tools  ### Actual Behavior  SSE connections timeout after exactly **10 seconds** with `httpcore.ReadTimeout` errors, despite v0.0.17 claiming to have disabled SSE read timeouts. All SSE servers in individual mode become unusable after 10 seconds.  **Error Message:**  ``` 2025-08-20 12:57:46,279 - ERROR - Error in sse_reader httpcore.ReadTimeout ```  ### Steps to Reproduce  1. Install MCPO v0.0.17: `uv tool install mcpo>=0.0.17` 2. Start any SSE server (e.g., an MCP server
  **Post-Mortem & Fix Analysis**:
  > same behavior for that 10s timeout  I manually deleted "timeout=httpx.Timeout(timeout, read=sse_read_timeout)" part of "httpx_client_factory" in "...\site-packages\mcp\client\sse.py" after pip install.   No error after the change and its working properly on the owui side.
  > FWIW, using config file isn't a functioning work-around either because loading from config file doesn't correctly load SSE MCPs. It says it connected but none of the tools are actually available.
  > SSE is completely dead and hasn't been supported for ages, closing this 

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

### Incident Patch 1: `2a8aeb17` (2025-11-25)
**Commit Message**: asyncio fix

**File**: `src/mcpo/main.py` (modified, +13/-0)
```diff
@@ -468,6 +468,11 @@ async def reload_config_handler(main_app: FastAPI, new_config_data: Dict[str, An
                             f"Failed to connect to new server: '{server_name}'"
                         )
 
+                except asyncio.CancelledError as e:
+                    logger.error(f"Failed to create server '{server_name}' (cancelled): {e}")
+                    # Rollback on failure
+                    main_app.router.routes = backup_routes
+                    raise
                 except Exception as e:
                     logger.error(f"Failed to create server '{server_name}': {e}")
                     # Rollback on failure
@@ -609,6 +614,14 @@ async def lifespan(app: FastAPI):
                             f"Connection attempt for '{server_name}' finished, but status is not 'connected'."
                         )
                         failed_servers.append(server_name)
+                except asyncio.CancelledError as e:
+                    if shutdown_handler and shutdown_handler.shutdown_event.is_set():
+                        raise
+                    logger.error(
+                        f"Failed to establish connection for server: '{server_name}' - CancelledError: {e}",
+                        exc_info=True,
+                    )
+                    failed_servers.append(server_name)
                 except Exception as e:
                     error_class_name = type(e).__name__
                     if error_class_name == "ExceptionGroup" or (
```

---

### Incident Patch 2: `d489c735` (2025-10-14)
**Commit Message**: fix/revert: disable header forwarding

**File**: `src/mcpo/utils/main.py` (modified, +35/-14)
```diff
@@ -31,12 +31,14 @@
 
 logger = logging.getLogger(__name__)
 
+
 def normalize_server_type(server_type: str) -> str:
     """Normalize server_type to a standard value."""
     if server_type in ["streamable_http", "streamablehttp", "streamable-http"]:
         return "streamable-http"
     return server_type
 
+
 def process_tool_response(result: CallToolResult) -> list:
     """Universal response processor for all tool endpoints"""
     response = []
@@ -150,7 +152,12 @@ def _process_schema_property(
             temp_schema = dict(prop_schema)
             temp_schema["type"] = type_option
             type_hint, _ = _process_schema_property(
-                _model_cache, temp_schema, model_name_prefix, prop_name, False, schema_defs=schema_defs
+                _model_cache,
+                temp_schema,
+                model_name_prefix,
+                prop_name,
+                False,
+                schema_defs=schema_defs,
             )
             type_hints.append(type_hint)
 
@@ -285,22 +292,29 @@ def get_tool_handler(
         def make_endpoint_func(
             endpoint_name: str, FormModel, session: ClientSession
         ):  # Parameterized endpoint
-            async def tool(form_data: FormModel, request: Request) -> Union[ResponseModel, Any]:
+            async def tool(
+                form_data: FormModel, request: Request
+            ) -> Union[ResponseModel, Any]:
                 args = form_data.model_dump(exclude_none=True, by_alias=True)
-                
+
                 # Process headers for forwarding if configured
                 forwarded_headers = {}
-                if client_header_forwarding_config and client_header_forwarding_config.get("enabled", False):
-                    forwarded_headers = process_headers_for_server(request, client_header_forwarding_config)
-                
+                if (
+                    client_header_forwarding_config
+                    and client_header_forwarding_config.get("enabled", False)
+                ):
+                    forwarded_headers = process_headers_for_server(
+                        request, client_header_forwarding_config
+                    )
+
                 # Add headers to _meta if any headers are being forwarded
                 meta = {}
                 if forwarded_headers:
                     meta["headers"] = forwarded_headers
-                
+
                 logger.info(f"Calling endpoint: {endpoint_name}, with args: {args}")
                 try:
-                    result = await session.call_tool(endpoint_name, arguments=args, _meta=meta if meta else None)
+                    result = await session.call_tool(endpoint_name, arguments=args)
 
                     if result.isError:
                         error_message = "Unknown tool execution error"
@@ -352,21 +366,28 @@ async def tool(form_data: FormModel, request: Request) -> Union[ResponseModel, A
         def make_endpoint_func_no_args(
             endpoint_name: str, session: ClientSession
         ):  # Parameterless endpoint
-            async def tool(request: Request):  # No parameters but need request for headers
+            async def tool(
+                request: Request,
+            ):  # No parameters but need request for headers
                 # Process headers for forwarding if configured
                 forwarded_headers = {}
-                if client_header_forwarding_config and client_header_forwarding_config.get("enabled", False):
-                    forwarded_headers = process_headers_for_server(request, client_header_forwarding_config)
-                
+                if (
+                    client_header_forwarding_config
+                    and client_header_forwarding_config.get("enabled", False)
+                ):
+                    forwarded_headers = process_headers_for_server(
+                        request, client_header_forwarding_config
+                    )
+
                 # Add headers t
```

**File**: `uv.lock` (modified, +6/-6)
```diff
@@ -323,7 +323,7 @@ wheels = [
 
 [[package]]
 name = "mcp"
-version = "1.12.4"
+version = "1.17.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "anyio" },
@@ -338,9 +338,9 @@ dependencies = [
     { name = "starlette" },
     { name = "uvicorn", marker = "sys_platform != 'emscripten'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/31/88/f6cb7e7c260cd4b4ce375f2b1614b33ce401f63af0f49f7141a2e9bf0a45/mcp-1.12.4.tar.gz", hash = "sha256:0765585e9a3a5916a3c3ab8659330e493adc7bd8b2ca6120c2d7a0c43e034ca5", size = 431148, upload_time = "2025-08-07T20:31:18.082Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/5a/79/5724a540df19e192e8606c543cdcf162de8eb435077520cca150f7365ec0/mcp-1.17.0.tar.gz", hash = "sha256:1b57fabf3203240ccc48e39859faf3ae1ccb0b571ff798bbedae800c73c6df90", size = 477951, upload-time = "2025-10-10T12:16:44.519Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/ad/68/316cbc54b7163fa22571dcf42c9cc46562aae0a021b974e0a8141e897200/mcp-1.12.4-py3-none-any.whl", hash = "sha256:7aa884648969fab8e78b89399d59a683202972e12e6bc9a1c88ce7eda7743789", size = 160145, upload_time = "2025-08-07T20:31:15.69Z" },
+    { url = "https://files.pythonhosted.org/packages/1c/72/3751feae343a5ad07959df713907b5c3fbaed269d697a14b0c449080cf2e/mcp-1.17.0-py3-none-any.whl", hash = "sha256:0660ef275cada7a545af154db3082f176cf1d2681d5e35ae63e014faf0a35d40", size = 167737, upload-time = "2025-10-10T12:16:42.863Z" },
 ]
 
 [package.optional-dependencies]
@@ -351,7 +351,7 @@ cli = [
 
 [[package]]
 name = "mcpo"
-version = "0.0.17"
+version = "0.0.19"
 source = { editable = "." }
 dependencies = [
     { name = "click" },
@@ -376,8 +376,8 @@ dev = [
 requires-dist = [
     { name = "click", specifier = ">=8.1.8" },
     { name = "fastapi", specifier = ">=0.115.12" },
-    { name = "mcp", specifier = ">=1.12.4" },
-    { name = "mcp", extras = ["cli"], specifier = ">=1.12.4" },
+    { name = "mcp", specifier = ">=1.17.0" },
+    { name = "mcp", extras = ["cli"], specifier = ">=1.17.0" },
     { name = "passlib", extras = ["bcrypt"], specifier = ">=1.7.4" },
     { name = "pydantic", specifier = ">=2.11.1" },
     { name = "pyjwt", extras = ["crypto"], specifier = ">=2.10.1" },
```

---

### Incident Patch 3: `9c99c93b` (2025-10-14)
**Commit Message**: refac/fix: connection timeout set to None by default

**File**: `.gitignore` (modified, +2/-1)
```diff
@@ -8,4 +8,5 @@ wheels/
 
 # Virtual environments
 .venv
-config.json
\ No newline at end of file
+config.json
+.vscode
\ No newline at end of file
```

**File**: `src/mcpo/main.py` (modified, +117/-53)
```diff
@@ -31,6 +31,8 @@
 
 logger = logging.getLogger(__name__)
 
+CONNECTION_TIMEOUT = os.getenv("CONNECTION_TIMEOUT", None)
+
 
 class GracefulShutdown:
     def __init__(self):
@@ -56,7 +58,9 @@ def validate_server_config(server_name: str, server_cfg: Dict[str, Any]) -> None
 
     if normalize_server_type(server_type) in ("sse", "streamable-http"):
         if not server_cfg.get("url"):
-            raise ValueError(f"Server '{server_name}' of type '{server_type}' requires a 'url' field")
+            raise ValueError(
+                f"Server '{server_name}' of type '{server_type}' requires a 'url' field"
+            )
     elif server_cfg.get("command"):
         # stdio server
         if not isinstance(server_cfg["command"], str):
@@ -67,7 +71,9 @@ def validate_server_config(server_name: str, server_cfg: Dict[str, Any]) -> None
         # Fallback for old SSE config without explicit type
         pass
     else:
-        raise ValueError(f"Server '{server_name}' must have either 'command' for stdio or 'type' and 'url' for remote servers")
+        raise ValueError(
+            f"Server '{server_name}' must have either 'command' for stdio or 'type' and 'url' for remote servers"
+        )
 
 
 def load_config(config_path: str) -> Dict[str, Any]:
@@ -84,7 +90,7 @@ def load_config(config_path: str) -> Dict[str, Any]:
         # Validate each server configuration
         for server_name, server_cfg in mcp_servers.items():
             validate_server_config(server_name, server_cfg)
-            
+
             # Validate client header forwarding configuration if present
             header_config = server_cfg.get("client_header_forwarding", {})
             if header_config:
@@ -102,9 +108,16 @@ def load_config(config_path: str) -> Dict[str, Any]:
         raise
 
 
-def create_sub_app(server_name: str, server_cfg: Dict[str, Any], cors_allow_origins,
-                   api_key: Optional[str], strict_auth: bool, api_dependency,
-                   connection_timeout, lifespan) -> FastAPI:
+def create_sub_app(
+    server_name: str,
+    server_cfg: Dict[str, Any],
+    cors_allow_origins,
+    api_key: Optional[str],
+    strict_auth: bool,
+    api_dependency,
+    connection_timeout,
+    lifespan,
+) -> FastAPI:
     """Create a sub-application for an MCP server."""
     sub_app = FastAPI(
         title=f"{server_name}",
@@ -134,7 +147,9 @@ def create_sub_app(server_name: str, server_cfg: Dict[str, Any], cors_allow_orig
         sub_app.state.server_type = "sse"
         sub_app.state.args = [server_cfg["url"]]
         sub_app.state.headers = server_cfg.get("headers")
-    elif normalize_server_type(server_config_type) == "streamable-http" and server_cfg.get("url"):
+    elif normalize_server_type(
+        server_config_type
+    ) == "streamable-http" and server_cfg.get("url"):
         url = server_cfg["url"]
         sub_app.state.server_type = "streamablehttp"
         sub_app.state.args = [url]
@@ -151,38 +166,54 @@ def create_sub_app(server_name: str, server_cfg: Dict[str, Any], cors_allow_orig
 
     sub_app.state.api_dependency = api_dependency
     sub_app.state.connection_timeout = connection_timeout
-    
+
     # Store client header forwarding configuration
-    sub_app.state.client_header_forwarding = server_cfg.get("client_header_forwarding", {"enabled": False})
+    sub_app.state.client_header_forwarding = server_cfg.get(
+        "client_header_forwarding", {"enabled": False}
+    )
 
     # Store OAuth configuration if present
     sub_app.state.oauth_config = server_cfg.get("oauth")
 
     return sub_app
 
 
-def mount_config_servers(main_app: FastAPI, config_data: Dict[str, Any],
-                        cors_allow_origins, api_key: Optional[str], strict_auth: bool,
-                        api_dependency, connection_timeout, lifespan, path_prefix: str):
+def mount_config_servers(
+    main_app: FastAPI,
+    config_data: Dict[str, Any],
+    cors_allow_origins,
+    api_key: Optional[str],
+    stri
```

---

### Incident Patch 4: `e8e2f09d` (2025-10-14)
**Commit Message**: Merge pull request #253 from iann0036/fix-subapp-lifespan

fix: Initialize and track lifespans for sub-apps made during hot reload

**File**: `src/mcpo/main.py` (modified, +33/-9)
```diff
@@ -178,17 +178,21 @@ def mount_config_servers(main_app: FastAPI, config_data: Dict[str, Any],
 
 def unmount_servers(main_app: FastAPI, path_prefix: str, server_names: list):
     """Unmount specific MCP servers."""
+    active_lifespans = getattr(main_app.state, 'active_lifespans', {})
+    
     for server_name in server_names:
         mount_path = f"{path_prefix}{server_name}"
-        # Find and remove the mount
-        routes_to_remove = []
-        for route in main_app.router.routes:
-            if hasattr(route, 'path') and route.path == mount_path:
-                routes_to_remove.append(route)
-
-        for route in routes_to_remove:
-            main_app.router.routes.remove(route)
-            logger.info(f"Unmounted server: {server_name}")
+        
+        # Clean up lifespan context if it exists
+        if server_name in active_lifespans:
+            lifespan_context = active_lifespans[server_name]
+            try:
+                # Schedule cleanup of the lifespan context
+                asyncio.create_task(lifespan_context.__aexit__(None, None, None))
+            except Exception as e:
+                logger.warning(f"Error cleaning up lifespan for {server_name}: {e}")
+            finally:
+                del active_lifespans[server_name]
 
 
 async def reload_config_handler(main_app: FastAPI, new_config_data: Dict[str, Any]):
@@ -236,6 +240,11 @@ async def reload_config_handler(main_app: FastAPI, new_config_data: Dict[str, An
         # Add new servers and updated servers
         if servers_to_add:
             logger.info(f"Adding servers: {list(servers_to_add)}")
+
+            # Store lifespan contexts for cleanup
+            if not hasattr(main_app.state, 'active_lifespans'):
+                main_app.state.active_lifespans = {}
+            
             for server_name in servers_to_add:
                 server_cfg = new_config_data["mcpServers"][server_name]
                 try:
@@ -244,6 +253,21 @@ async def reload_config_handler(main_app: FastAPI, new_config_data: Dict[str, An
                         strict_auth, api_dependency, connection_timeout, lifespan
                     )
                     main_app.mount(f"{path_prefix}{server_name}", sub_app)
+                                        
+                    # Start the lifespan for the new sub-app
+                    lifespan_context = sub_app.router.lifespan_context(sub_app)
+                    await lifespan_context.__aenter__()
+                    
+                    # Store the context manager for cleanup later
+                    main_app.state.active_lifespans[server_name] = lifespan_context
+                    
+                    # Check if connection was successful
+                    is_connected = getattr(sub_app.state, "is_connected", False)
+                    if is_connected:
+                        logger.info(f"Successfully connected to new server: '{server_name}'")
+                    else:
+                        logger.warning(f"Failed to connect to new server: '{server_name}'")
+                        
                 except Exception as e:
                     logger.error(f"Failed to create server '{server_name}': {e}")
                     # Rollback on failure
```

---

### Incident Patch 5: `d88a23c8` (2025-09-23)
**Commit Message**: fix: Initialize and track lifespans for sub-apps made during hot reload

**File**: `src/mcpo/main.py` (modified, +33/-9)
```diff
@@ -167,17 +167,21 @@ def mount_config_servers(main_app: FastAPI, config_data: Dict[str, Any],
 
 def unmount_servers(main_app: FastAPI, path_prefix: str, server_names: list):
     """Unmount specific MCP servers."""
+    active_lifespans = getattr(main_app.state, 'active_lifespans', {})
+    
     for server_name in server_names:
         mount_path = f"{path_prefix}{server_name}"
-        # Find and remove the mount
-        routes_to_remove = []
-        for route in main_app.router.routes:
-            if hasattr(route, 'path') and route.path == mount_path:
-                routes_to_remove.append(route)
-
-        for route in routes_to_remove:
-            main_app.router.routes.remove(route)
-            logger.info(f"Unmounted server: {server_name}")
+        
+        # Clean up lifespan context if it exists
+        if server_name in active_lifespans:
+            lifespan_context = active_lifespans[server_name]
+            try:
+                # Schedule cleanup of the lifespan context
+                asyncio.create_task(lifespan_context.__aexit__(None, None, None))
+            except Exception as e:
+                logger.warning(f"Error cleaning up lifespan for {server_name}: {e}")
+            finally:
+                del active_lifespans[server_name]
 
 
 async def reload_config_handler(main_app: FastAPI, new_config_data: Dict[str, Any]):
@@ -225,6 +229,11 @@ async def reload_config_handler(main_app: FastAPI, new_config_data: Dict[str, An
         # Add new servers and updated servers
         if servers_to_add:
             logger.info(f"Adding servers: {list(servers_to_add)}")
+
+            # Store lifespan contexts for cleanup
+            if not hasattr(main_app.state, 'active_lifespans'):
+                main_app.state.active_lifespans = {}
+            
             for server_name in servers_to_add:
                 server_cfg = new_config_data["mcpServers"][server_name]
                 try:
@@ -233,6 +242,21 @@ async def reload_config_handler(main_app: FastAPI, new_config_data: Dict[str, An
                         strict_auth, api_dependency, connection_timeout, lifespan
                     )
                     main_app.mount(f"{path_prefix}{server_name}", sub_app)
+                                        
+                    # Start the lifespan for the new sub-app
+                    lifespan_context = sub_app.router.lifespan_context(sub_app)
+                    await lifespan_context.__aenter__()
+                    
+                    # Store the context manager for cleanup later
+                    main_app.state.active_lifespans[server_name] = lifespan_context
+                    
+                    # Check if connection was successful
+                    is_connected = getattr(sub_app.state, "is_connected", False)
+                    if is_connected:
+                        logger.info(f"Successfully connected to new server: '{server_name}'")
+                    else:
+                        logger.warning(f"Failed to connect to new server: '{server_name}'")
+                        
                 except Exception as e:
                     logger.error(f"Failed to create server '{server_name}': {e}")
                     # Rollback on failure
```

---

### Incident Patch 6: `704b8c5c` (2025-07-30)
**Commit Message**: Add support to run on different path prefix

**File**: `src/mcpo/__init__.py` (modified, +4/-0)
```diff
@@ -60,6 +60,9 @@ def main(
     ssl_keyfile: Annotated[
         Optional[str], typer.Option("--ssl-keyfile", "-K", help="SSL keyfile")
     ] = None,
+    root_path: Annotated[
+        Optional[str], typer.Option("--root-path", help="Root path")
+    ] = "",
     path_prefix: Annotated[
         Optional[str], typer.Option("--path-prefix", help="URL prefix")
     ] = None,
@@ -139,6 +142,7 @@ def main(
             ssl_certfile=ssl_certfile,
             ssl_keyfile=ssl_keyfile,
             path_prefix=path_prefix,
+            root_path=root_path,
             headers=headers,
             hot_reload=hot_reload,
         )
```

**File**: `src/mcpo/main.py` (modified, +2/-0)
```diff
@@ -463,6 +463,7 @@ async def run(
     ssl_certfile = kwargs.get("ssl_certfile")
     ssl_keyfile = kwargs.get("ssl_keyfile")
     path_prefix = kwargs.get("path_prefix") or "/"
+    root_path = kwargs.get("root_path") or ""
 
     # Configure basic logging
     logging.basicConfig(
@@ -500,6 +501,7 @@ def filter(self, record):
         title=name,
         description=description,
         version=version,
+        root_path=root_path,
         ssl_certfile=ssl_certfile,
         ssl_keyfile=ssl_keyfile,
         lifespan=lifespan,
```

---

### Incident Patch 7: `b3f52e87` (2025-07-31)
**Commit Message**: Merge pull request #223 from njzydark/fix-hot-reload-symlink

fix: symlink handling in config watcher to update path on modification

**File**: `.github/workflows/build-release.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
                   CHANGELOG_ESCAPED=$(echo "$CHANGELOG_CONTENT" | sed ':a;N;$!ba;s/\n/%0A/g')
                   echo "Extracted latest release notes from CHANGELOG.md:" 
                   echo -e "$CHANGELOG_CONTENT" 
-                  echo "::set-output name=content::$CHANGELOG_ESCAPED"
+                  echo "content=$CHANGELOG_ESCAPED" >> "$GITHUB_OUTPUT"
 
             - name: Create GitHub release
               uses: actions/github-script@v7
```

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ and this project adheres to Semantic Versioning.
 
 ### Added
 
-- 🔄 **Hot Reload Support for Configuration Files**: Added `--hot-reload` flag to watch your config file for changes and dynamically reload MCP servers without restarting the application—enabling seamless development workflows and runtime configuration updates.
+- 🔄 **Hot Reload Support for Configuration Files**: Added \`--hot-reload\` flag to watch your config file for changes and dynamically reload MCP servers without restarting the application—enabling seamless development workflows and runtime configuration updates.
 - 🤫 **HTTP Request Filtering for Cleaner Logs**: Added configurable log filtering to reduce noise from frequent HTTP requests, making debugging and monitoring much clearer in production environments.
 
 ### Changed
@@ -115,4 +115,4 @@ and this project adheres to Semantic Versioning.
 
 ### Fixed
 
-- 🧹 **Cleaner Proxy Output**: Dropped None arguments from proxy requests, resulting in reduced clutter and improved interoperability with servers expecting clean inputs—ensuring more reliable downstream performance with MCP tools.
\ No newline at end of file
+- 🧹 **Cleaner Proxy Output**: Dropped None arguments from proxy requests, resulting in reduced clutter and improved interoperability with servers expecting clean inputs—ensuring more reliable downstream performance with MCP tools.
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "mcpo"
-version = "0.0.16"
+version = "0.0.17"
 description = "A simple, secure MCP-to-OpenAPI proxy server"
 authors = [
     { name = "Timothy Jaeryang Baek", email = "tim@openwebui.com" }
```

**File**: `src/mcpo/main.py` (modified, +25/-6)
```diff
@@ -351,10 +351,27 @@ async def lifespan(app: FastAPI):
                             f"Connection attempt for '{server_name}' finished, but status is not 'connected'."
                         )
                         failed_servers.append(server_name)
-                except Exception:
-                    logger.error(
-                        f"Failed to establish connection for server: '{server_name}'."
-                    )
+                except Exception as e:
+                    error_class_name = type(e).__name__
+                    if error_class_name == 'ExceptionGroup' or (hasattr(e, 'exceptions') and hasattr(e, 'message')):
+                        logger.error(
+                            f"Failed to establish connection for server: '{server_name}' - Multiple errors occurred:"
+                        )
+                        # Log each individual exception from the group
+                        exceptions = getattr(e, 'exceptions', [])
+                        for idx, exc in enumerate(exceptions):
+                            logger.error(f"  Error {idx + 1}: {type(exc).__name__}: {exc}")
+                            # Also log traceback for each exception
+                            if hasattr(exc, '__traceback__'):
+                                import traceback
+                                tb_lines = traceback.format_exception(type(exc), exc, exc.__traceback__)
+                                for line in tb_lines:
+                                    logger.debug(f"    {line.rstrip()}")
+                    else:
+                        logger.error(
+                            f"Failed to establish connection for server: '{server_name}' - {type(e).__name__}: {e}",
+                            exc_info=True
+                        )
                     failed_servers.append(server_name)
 
             logger.info("\n--- Server Startup Summary ---")
@@ -409,9 +426,11 @@ async def lifespan(app: FastAPI):
                     app.state.is_connected = True
                     yield
         except Exception as e:
-            logger.error(f"Failed to connect to MCP server '{app.title}': {e}")
+            # Log the full exception with traceback for debugging
+            logger.error(f"Failed to connect to MCP server '{app.title}': {type(e).__name__}: {e}", exc_info=True)
             app.state.is_connected = False
-            return
+            # Re-raise the exception so it propagates to the main app's lifespan
+            raise
 
 
 async def run(
```

**File**: `src/mcpo/utils/config_watcher.py` (modified, +15/-6)
```diff
@@ -15,15 +15,23 @@
 class ConfigChangeHandler(FileSystemEventHandler):
     """Handler for config file changes."""
 
-    def __init__(self, config_path: Path, reload_callback: Callable[[Dict[str, Any]], None], loop: asyncio.AbstractEventLoop):
-        self.config_path = config_path.resolve()  # Resolve to absolute path
+    def __init__(self, origin_config_path: Path, reload_callback: Callable[[Dict[str, Any]], None], loop: asyncio.AbstractEventLoop):
+        self.origin_config_path = origin_config_path
+        self.config_path = origin_config_path.resolve()  # Resolve to absolute path
+        self.is_symlink = origin_config_path.is_symlink()
         self.reload_callback = reload_callback
         self.loop = loop  # Store reference to the main event loop
         self._last_modification = 0
         self._debounce_delay = 0.5  # 500ms debounce
 
     def on_modified(self, event):
         """Handle file modification events."""
+        if self.is_symlink:
+            self.config_path = self.origin_config_path.resolve()  # Re-resolve to get the latest symlink target
+            logger.info(f"Symlink file modified: {self.config_path}")
+            self._trigger_reload()
+            return
+
         if event.is_directory:
             return
 
@@ -116,7 +124,8 @@ class ConfigWatcher:
     """Watches a config file for changes and triggers reloads."""
 
     def __init__(self, config_path: str, reload_callback: Callable[[Dict[str, Any]], None]):
-        self.config_path = Path(config_path).resolve()
+        self.origin_config_path = Path(config_path)
+        self.config_path = self.origin_config_path.resolve()
         self.reload_callback = reload_callback
         self.observer: Optional[Observer] = None
         self.handler: Optional[ConfigChangeHandler] = None
@@ -135,12 +144,12 @@ def start(self):
             logger.error("No running event loop found, cannot start config watcher")
             return
 
-        self.handler = ConfigChangeHandler(self.config_path, self.reload_callback, self.loop)
+        self.handler = ConfigChangeHandler(self.origin_config_path, self.reload_callback, self.loop)
         self.observer = Observer()
 
         # Watch the directory containing the config file
-        watch_dir = self.config_path.parent
-        logger.debug(f"Watching directory: {watch_dir} for file: {self.config_path}")
+        watch_dir = self.origin_config_path.parent
+        logger.info(f"Watching directory: {watch_dir} for file: {self.config_path}")
         self.observer.schedule(self.handler, str(watch_dir), recursive=False)
 
         self.observer.start()
```

---

### Incident Patch 8: `d202ba08` (2025-07-31)
**Commit Message**: Merge branch 'main' of github.com:open-webui/mcpo into fix-hot-reload-symlink

**File**: `.github/workflows/build-release.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
                   CHANGELOG_ESCAPED=$(echo "$CHANGELOG_CONTENT" | sed ':a;N;$!ba;s/\n/%0A/g')
                   echo "Extracted latest release notes from CHANGELOG.md:" 
                   echo -e "$CHANGELOG_CONTENT" 
-                  echo "::set-output name=content::$CHANGELOG_ESCAPED"
+                  echo "content=$CHANGELOG_ESCAPED" >> "$GITHUB_OUTPUT"
 
             - name: Create GitHub release
               uses: actions/github-script@v7
```

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ and this project adheres to Semantic Versioning.
 
 ### Added
 
-- 🔄 **Hot Reload Support for Configuration Files**: Added `--hot-reload` flag to watch your config file for changes and dynamically reload MCP servers without restarting the application—enabling seamless development workflows and runtime configuration updates.
+- 🔄 **Hot Reload Support for Configuration Files**: Added \`--hot-reload\` flag to watch your config file for changes and dynamically reload MCP servers without restarting the application—enabling seamless development workflows and runtime configuration updates.
 - 🤫 **HTTP Request Filtering for Cleaner Logs**: Added configurable log filtering to reduce noise from frequent HTTP requests, making debugging and monitoring much clearer in production environments.
 
 ### Changed
@@ -115,4 +115,4 @@ and this project adheres to Semantic Versioning.
 
 ### Fixed
 
-- 🧹 **Cleaner Proxy Output**: Dropped None arguments from proxy requests, resulting in reduced clutter and improved interoperability with servers expecting clean inputs—ensuring more reliable downstream performance with MCP tools.
\ No newline at end of file
+- 🧹 **Cleaner Proxy Output**: Dropped None arguments from proxy requests, resulting in reduced clutter and improved interoperability with servers expecting clean inputs—ensuring more reliable downstream performance with MCP tools.
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "mcpo"
-version = "0.0.16"
+version = "0.0.17"
 description = "A simple, secure MCP-to-OpenAPI proxy server"
 authors = [
     { name = "Timothy Jaeryang Baek", email = "tim@openwebui.com" }
```

**File**: `src/mcpo/main.py` (modified, +25/-6)
```diff
@@ -351,10 +351,27 @@ async def lifespan(app: FastAPI):
                             f"Connection attempt for '{server_name}' finished, but status is not 'connected'."
                         )
                         failed_servers.append(server_name)
-                except Exception:
-                    logger.error(
-                        f"Failed to establish connection for server: '{server_name}'."
-                    )
+                except Exception as e:
+                    error_class_name = type(e).__name__
+                    if error_class_name == 'ExceptionGroup' or (hasattr(e, 'exceptions') and hasattr(e, 'message')):
+                        logger.error(
+                            f"Failed to establish connection for server: '{server_name}' - Multiple errors occurred:"
+                        )
+                        # Log each individual exception from the group
+                        exceptions = getattr(e, 'exceptions', [])
+                        for idx, exc in enumerate(exceptions):
+                            logger.error(f"  Error {idx + 1}: {type(exc).__name__}: {exc}")
+                            # Also log traceback for each exception
+                            if hasattr(exc, '__traceback__'):
+                                import traceback
+                                tb_lines = traceback.format_exception(type(exc), exc, exc.__traceback__)
+                                for line in tb_lines:
+                                    logger.debug(f"    {line.rstrip()}")
+                    else:
+                        logger.error(
+                            f"Failed to establish connection for server: '{server_name}' - {type(e).__name__}: {e}",
+                            exc_info=True
+                        )
                     failed_servers.append(server_name)
 
             logger.info("\n--- Server Startup Summary ---")
@@ -409,9 +426,11 @@ async def lifespan(app: FastAPI):
                     app.state.is_connected = True
                     yield
         except Exception as e:
-            logger.error(f"Failed to connect to MCP server '{app.title}': {e}")
+            # Log the full exception with traceback for debugging
+            logger.error(f"Failed to connect to MCP server '{app.title}': {type(e).__name__}: {e}", exc_info=True)
             app.state.is_connected = False
-            return
+            # Re-raise the exception so it propagates to the main app's lifespan
+            raise
 
 
 async def run(
```

**File**: `src/mcpo/utils/main.py` (modified, +3/-3)
```diff
@@ -57,16 +57,16 @@ def process_tool_response(result: CallToolResult) -> list:
 
 
 def name_needs_alias(name: str) -> bool:
-    """Check if a field name needs aliasing (for now if it starts with '__')."""
-    return name.startswith("__")
+    """Check if a field name needs aliasing (if it starts with '_')."""
+    return name.startswith("_")
 
 
 def generate_alias_name(original_name: str, existing_names: set) -> str:
     """
     Generate an alias field name by stripping unwanted chars, and avoiding conflicts with existing names.
 
     Args:
-        original_name: The original field name (should start with '__')
+        original_name: The original field name (should start with '_')
         existing_names: Set of existing names to avoid conflicts with
 
     Returns:
```

---

### Incident Patch 9: `99693392` (2025-07-31)
**Commit Message**: Merge branch 'dev' of github.com:open-webui/mcpo into fix-hot-reload-symlink

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -12,6 +12,18 @@ All notable changes to this project will be documented in this file.
 The format is based on Keep a Changelog,
 and this project adheres to Semantic Versioning.
 
+## [0.0.17] - 2025-07-22
+
+### Added
+
+- 🔄 **Hot Reload Support for Configuration Files**: Added `--hot-reload` flag to watch your config file for changes and dynamically reload MCP servers without restarting the application—enabling seamless development workflows and runtime configuration updates.
+- 🤫 **HTTP Request Filtering for Cleaner Logs**: Added configurable log filtering to reduce noise from frequent HTTP requests, making debugging and monitoring much clearer in production environments.
+
+### Changed
+
+- ⬆️ **Updated MCP Package to v1.12.1**: Upgraded MCP dependency to resolve compatibility issues with Pydantic and improve overall stability and performance.
+- 🔧 **Normalized Streamable HTTP Configuration**: Streamlined configuration syntax for streamable-http servers to align with MCP standards while maintaining backward compatibility.
+
 ## [0.0.16] - 2025-07-02
 
 ### Added
```

**File**: `README.md` (modified, +9/-1)
```diff
@@ -76,14 +76,22 @@ That’s it. Your MCP tool is now available at http://localhost:8000 with a gene
 
 ### 🔄 Using a Config File
 
-You can serve multiple MCP tools via a single config file that follows the [Claude Desktop](https://modelcontextprotocol.io/quickstart/user) format:
+You can serve multiple MCP tools via a single config file that follows the [Claude Desktop](https://modelcontextprotocol.io/quickstart/user) format.
+
+Enable hot-reload mode with `--hot-reload` to automatically watch your config file for changes and reload servers without downtime:
 
 Start via:
 
 ```bash
 mcpo --config /path/to/config.json
 ```
 
+Or with hot-reload enabled:
+
+```bash
+mcpo --config /path/to/config.json --hot-reload
+```
+
 Example config.json:
 
 ```json
```

**File**: `src/mcpo/main.py` (modified, +0/-2)
```diff
@@ -131,8 +131,6 @@ def create_sub_app(server_name: str, server_cfg: Dict[str, Any], cors_allow_orig
         sub_app.state.headers = server_cfg.get("headers")
     elif normalize_server_type(server_config_type) == "streamable-http" and server_cfg.get("url"):
         url = server_cfg["url"]
-        if not url.endswith("/"):
-            url = f"{url}/"
         sub_app.state.server_type = "streamablehttp"
         sub_app.state.args = [url]
         sub_app.state.headers = server_cfg.get("headers")
```

---

### Incident Patch 10: `354c07b4` (2025-07-31)
**Commit Message**: bump version fix release script

**File**: `.github/workflows/build-release.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
                   CHANGELOG_ESCAPED=$(echo "$CHANGELOG_CONTENT" | sed ':a;N;$!ba;s/\n/%0A/g')
                   echo "Extracted latest release notes from CHANGELOG.md:" 
                   echo -e "$CHANGELOG_CONTENT" 
-                  echo "::set-output name=content::$CHANGELOG_ESCAPED"
+                  echo "content=$CHANGELOG_ESCAPED" >> "$GITHUB_OUTPUT"
 
             - name: Create GitHub release
               uses: actions/github-script@v7
```

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ and this project adheres to Semantic Versioning.
 
 ### Added
 
-- 🔄 **Hot Reload Support for Configuration Files**: Added `--hot-reload` flag to watch your config file for changes and dynamically reload MCP servers without restarting the application—enabling seamless development workflows and runtime configuration updates.
+- 🔄 **Hot Reload Support for Configuration Files**: Added \`--hot-reload\` flag to watch your config file for changes and dynamically reload MCP servers without restarting the application—enabling seamless development workflows and runtime configuration updates.
 - 🤫 **HTTP Request Filtering for Cleaner Logs**: Added configurable log filtering to reduce noise from frequent HTTP requests, making debugging and monitoring much clearer in production environments.
 
 ### Changed
@@ -115,4 +115,4 @@ and this project adheres to Semantic Versioning.
 
 ### Fixed
 
-- 🧹 **Cleaner Proxy Output**: Dropped None arguments from proxy requests, resulting in reduced clutter and improved interoperability with servers expecting clean inputs—ensuring more reliable downstream performance with MCP tools.
\ No newline at end of file
+- 🧹 **Cleaner Proxy Output**: Dropped None arguments from proxy requests, resulting in reduced clutter and improved interoperability with servers expecting clean inputs—ensuring more reliable downstream performance with MCP tools.
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "mcpo"
-version = "0.0.16"
+version = "0.0.17"
 description = "A simple, secure MCP-to-OpenAPI proxy server"
 authors = [
     { name = "Timothy Jaeryang Baek", email = "tim@openwebui.com" }
```

#### Recent Merged Pull Requests:
- **PR #294** (closed): fix: preserve tool input enum schemas (@zxyasfas)
- **PR #292** (closed): Add Codex plugin quality gate CI (@internet-dot)
- **PR #287** (2026-02-27): 0.0.20 (@tjbck)
- **PR #286** (closed): Additional log handling (@tdmalone)
- **PR #285** (closed): Add Claude skill-creator folder under skills (@dan99git)
- **PR #279** (closed): fix: handle $ref to properties in schema processing (@majiayu000)
- **PR #278** (closed): fix: add enum support in OpenAPI schema generation (@majiayu000)
- **PR #275** (closed): Fix: the disabled_tools feature is always rising an exception on execution (@druellan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
