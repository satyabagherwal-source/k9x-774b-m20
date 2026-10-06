# Forensic Learning Record (Deep Inspection): blazickjp/arxiv-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/blazickjp-arxiv-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/blazickjp/arxiv-mcp-server](https://github.com/blazickjp/arxiv-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:04:17.307Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `blazickjp/arxiv-mcp-server`
- **Description**: A local MCP server for agent literature work. Original-LaTeX section reads, BibTeX from arXiv metadata, and topic watches. Papers stay on disk. Search is optional.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3193 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/smoke_installed_wheel.py`
```
#!/usr/bin/env python3
"""Build-artifact smoke test for an isolated arxiv-mcp-server wheel."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import tomllib
from datetime import timedelta
from typing import Mapping

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]
MCP_REQUEST_TIMEOUT_SECONDS = 30
MCP_OVERALL_TIMEOUT_SECONDS = 120
EXPECTED_TOOLS = {
    "check_alerts",
    "citation_graph",
    "download_paper",
    "export_citations",
    "get_abstract",
    "get_paper_latex",
    "get_paper_latex_section",
    "get_paper_outline",
    "list_paper_latex_sections",
    "list_papers",
    "list_watches",
    "read_paper",
    "read_paper_section",
    "reindex",
    "search_paper_text",
    "search_papers",
    "semantic_search",
    "unwatch_topic",
    "watch_topic",
}
PROMPT_ARGUMENTS = {
    "compare_papers": {"paper_ids": "1706.03762, 1810.04805"},
    "deep-paper-analysis": {"paper_id": "1706.03762"},
    "literature-synthesis": {"paper_ids": "1706.03762, 1810.04805"},
    "literature_review": {"topic": "attention mechanisms"},
    "research-discovery": {"topic": "attention mechanisms"},
    "research-question": {
        "paper_ids": "1706.03762, 1810.04805",
        "topic": "attention mechanisms",
    },
    "summarize_paper": {"paper_id": "1706.03762"},
}


def find_single_wheel(dist_dir: Path) -> Path:
    """Return the one wheel in *dist_dir*, rejecting stale artifact mixtures."""
    wheels = sorted(dist_dir.glob("*.whl"))
    if len(wheels) != 1:
        raise RuntimeError(
            f"Expected exactly one wheel in {dist_dir}, found {len(wheels)}: "
            f"{[wheel.name for wheel in wheels]}"
        )
    return wheels[0]


def venv_python(venv_dir: Path, *, platform: str = os.name) -> Path:
    """Return the Python executable path for a POSIX or Windows virtualenv."""
    if platform == "nt":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def venv_entrypoint(venv_dir: Path, *, platform: str = os.name) -> Path:
    """Return the installed console-script path for a POSIX or Windows virtualenv."""
    if platform == "nt":
        return venv_dir / "Scripts" / "arxiv-mcp-server.exe"
    return venv_dir / "bin" / "arxiv-mcp-server"


def clean_subprocess_env(
    home: Path, *, source: Mapping[str, str] | None = None
) -> dict[str, str]:
    """Create a subprocess environment without ambient Python contamination."""
    source = os.environ if source is None else source
    blocked = {
        "ALLOWED_HOSTS",
        "ALLOWED_ORIGINS",
        "APP_NAME",
        "APP_VERSION",
        "BATCH_SIZE",
        "HOST",
        "MAX_RESULTS",
        "PIP_CONSTRAINT",
        "PORT",
        "PYTHONHOME",
        "PYTHONPATH",
        "REQUEST_TIMEOUT",
        "TRANSPORT",
        "UV_CONSTRAINT",
        "UV_OVERRIDE",
        "UV_REQUIRE_HASHES",
        "VIRTUAL_ENV",
    }
    env = {key: value for key, value in source.items() if key not in blocked}
    env["HOME"] = str(home)
    env["USERPROFILE"] = str(home)
    env["NO_COLOR"] = "1"
    return env


def canonical_version() -> str:
    pyproject = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    return pyproject["project"]["version"]


async def exercise_mcp_server(
    parameters: StdioServerParameters, *, expected_version: str
) -> dict[str, object]:
    """Exercise the complete public MCP discovery and prompt surface."""
    async with asyncio.timeout(MCP_OVERALL_TIMEOUT_SECONDS):
        async with stdio_client(parameters) as (read_stream, write_stream):
            async with ClientSession(
                read_stream,
                write_stream,
                read_timeout_seconds=timedelta(seconds=MCP_REQUEST_TIMEOUT_SECONDS),
            ) as session:
                initialized = await session.initialize()
                server_version = initialized.serverInfo.version
                if server_version != expected_version:
                    raise RuntimeError(
                        f"MCP server version {server_version!r} does not match "
                        f"expected version {expected_version!r}"
                    )

                tools = await session.list_tools()
                tool_names = {tool.name for tool in tools.tools}
                if tool_names != EXPECTED_TOOLS:
                    raise RuntimeError(
                        "MCP server exposed an unexpected tool set: "
                        f"missing={sorted(EXPECTED_TOOLS - tool_names)}, "
                        f"extra={sorted(tool_names - EXPECTED_TOOLS)}"
                    )

                prompts = await session.list_prompts()
                prompt_names = {prompt.name for prompt in prompts.prompts}
                if prompt_names != set(PROMPT_ARGUMENTS):
                    raise RuntimeError(
                        "MCP server exposed an unexpected prompt set: "
                        f"missing={sorted(set(PROMPT_ARGUMENTS) - prompt_names)}, "
                        f"extra={sorted(prompt_names - set(PROMPT_ARGUMENTS))}"
                    )
                prompt_lengths = {}
                for prompt_name, arguments in PROMPT_ARGUMENTS.items():
                    result = await session.get_prompt(prompt_name, arguments)
                    prompt_lengths[prompt_name] = sum(
                        len(getattr(message.content, "text", ""))
                        for message in result.messages
                    )
                    if prompt_lengths[prompt_name] == 0:
                        raise RuntimeError(f"Prompt {prompt_name!r} returned no text")

                local_result = await session.call_tool("list_papers", {})
                if local_result.isError or not local_result.content:
                    raise RuntimeError("list_papers failed through the MCP session")

    return {
        "server_version": server_version,
        "tools": len(tool_names),
        "prompts": len(prompt_names),
        "prompt_chars": prompt_lengths,
        "list_papers_content_items": len(local_result.content),
    }


async def smoke_wheel(wheel: Path) -> dict[str, object]:
    """Install *wheel* in a blank venv and exercise its real MCP interface."""
    with tempfile.TemporaryDirectory(prefix="arxiv-wheel-smoke-") as temp:
        temp_dir = Path(temp)
        venv_dir = temp_dir / "venv"
        home_dir = temp_dir / "home"
        storage_dir = temp_dir / "papers"
        home_dir.mkdir()
        storage_dir.mkdir()
        env = clean_subprocess_env(home_dir)

        subprocess.run(
            ["uv", "venv", "--python", sys.executable, str(venv_dir)],
            check=True,
            env=env,
            cwd=temp_dir,
        )
        python = venv_python(venv_dir)
        subprocess.run(
            ["uv", "pip", "install", "--python", str(python), str(wheel)],
            check=True,
            env=env,
            cwd=temp_dir,
        )
        installed_version = subprocess.check_output(
            [
                str(python),
                "-c",
                "import importlib.metadata; "
                "print(importlib.metadata.version('arxiv-mcp-server'))",
            ],
            text=True,
            env=env,
            cwd=temp_dir,
        ).strip()

        entrypoint = venv_entrypoint(venv_dir)
        if not entrypoint.is_file():
            raise RuntimeError(
                f"Installed wheel is missing console script {entrypoint}"
            )
        parameters = StdioServerParameters(
            command=str(entrypoint),
            args=[
                "--storage-path",
                str(storage_dir),
            ],
            env=env,
            cwd=temp_dir,
        )
        expected_version = canonical_version()
        if installed_version != expected_version:
            raise RuntimeError(
                "Version mismatch: "
                f"project={expected_version}, installed={installed_version}"
            )
        protocol = await exercise_mcp_server(
            parameters, expected_version=expected_version
        )

        return {
            "wheel": wheel.name,
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
            "platform": sys.platform,
            "version": installed_version,
            **protocol,
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dist-dir",
        type=Path,
        default=ROOT / "dist",
        help="Directory containing exactly one candidate wheel",
    )
    args = parser.parse_args()
    wheel = find_single_wheel(args.dist_dir)
    print(json.dumps(asyncio.run(smoke_wheel(wheel)), sort_keys=True))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `scripts/smoke_mcpb.py`
```
#!/usr/bin/env python3
"""Extract and exercise the exact MCPB artifact that would be uploaded."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import zipfile

from mcp import StdioServerParameters

from smoke_installed_wheel import clean_subprocess_env, exercise_mcp_server

ROOT = Path(__file__).resolve().parents[1]


def find_single_mcpb(bundle_dir: Path) -> Path:
    """Return the one packed MCPB artifact, rejecting stale artifact mixtures."""
    artifacts = sorted(bundle_dir.glob("*.mcpb"))
    if len(artifacts) != 1:
        raise RuntimeError(
            f"Expected exactly one MCPB in {bundle_dir}, found {len(artifacts)}: "
            f"{[artifact.name for artifact in artifacts]}"
        )
    return artifacts[0]


def extract_mcpb(artifact: Path, destination: Path) -> None:
    """Validate and extract an MCPB ZIP without path traversal or symlinks."""
    root = destination.resolve()
    with zipfile.ZipFile(artifact) as archive:
        if corrupt_member := archive.testzip():
            raise RuntimeError(f"Corrupt MCPB member: {corrupt_member}")
        for member in archive.infolist():
            target = (destination / member.filename).resolve()
            if not target.is_relative_to(root):
                raise RuntimeError(
                    f"MCPB contains unsafe archive member {member.filename!r}"
                )
            mode = (member.external_attr >> 16) & 0o170000
            if mode == stat.S_IFLNK:
                raise RuntimeError(f"MCPB contains symlink member {member.filename!r}")
        archive.extractall(destination)


async def smoke_mcpb(bundle_dir: Path) -> dict[str, object]:
    artifact = find_single_mcpb(bundle_dir)
    if sys.implementation.name != "cpython" or sys.version_info[:2] != (3, 11):
        raise RuntimeError(
            "MCPB smoke requires CPython 3.11.x to match the bundled ABI; "
            f"got {sys.implementation.name} {sys.version.split()[0]}"
        )

    with tempfile.TemporaryDirectory(prefix="arxiv-mcpb-smoke-") as temp:
        temp_dir = Path(temp)
        unpacked_dir = temp_dir / "unpacked"
        extract_mcpb(artifact, unpacked_dir)

        manifest_path = unpacked_dir / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected_version = manifest["version"]
        expected_runtime = manifest["compatibility"]["runtimes"]["python"]
        if expected_runtime != ">=3.11,<3.12":
            raise RuntimeError(f"Unexpected MCPB Python runtime: {expected_runtime!r}")

        source_dir = unpacked_dir / "server"
        vendor_dir = source_dir / "vendor"
        generated_version = source_dir / "arxiv_mcp_server" / "_bundle_version.py"
        for required in (source_dir, vendor_dir, generated_version):
            if not required.exists():
                raise RuntimeError(
                    f"Packed MCPB is missing {required.relative_to(unpacked_dir)}"
                )

        home_dir = temp_dir / "home"
        storage_dir = temp_dir / "papers"
        home_dir.mkdir()
        storage_dir.mkdir()
        env = clean_subprocess_env(home_dir)
        env["PYTHONPATH"] = os.pathsep.join((str(source_dir), str(vendor_dir)))
        parameters = StdioServerParameters(
            command=sys.executable,
            args=[
                "-m",
                "arxiv_mcp_server",
                "--storage-path",
                str(storage_dir),
            ],
            env=env,
            cwd=temp_dir,
        )
        protocol = await exercise_mcp_server(
            parameters, expected_version=expected_version
        )

    return {
        "artifact": artifact.name,
        "platform": sys.platform,
        "python": f"{sys.version_info.major}.{sys.version_info.minor}",
        "manifest_version": expected_version,
        **protocol,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--bundle-dir",
        type=Path,
        default=ROOT / "mcpb-build",
        help="Directory containing exactly one packed MCPB artifact",
    )
    args = parser.parse_args()
    print(json.dumps(asyncio.run(smoke_mcpb(args.bundle_dir)), sort_keys=True))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `src/arxiv_mcp_server/__init__.py`
```
"""
Arxiv MCP Server initialization
"""

from . import server
import asyncio


def main():
    """Main entry point for the package."""
    asyncio.run(server.main())


__all__ = ["main", "server"]

```

### Core Architecture Module: `src/arxiv_mcp_server/__main__.py`
```
"""Main entry point for the arxiv-mcp-server package."""

from . import main

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `src/arxiv_mcp_server/arxiv_api.py`
```
"""Shared compatibility helpers for the upstream arxiv package."""

import asyncio
import logging
import os
from pathlib import Path
import random
import tempfile
import threading
import time
from typing import Awaitable, Callable, Protocol, TypeVar

import httpx

logger = logging.getLogger("arxiv-mcp-server")
T = TypeVar("T")


class GateTimeout(Exception):
    """Raised when acquiring the rate limiter gate times out."""

    pass


class ArxivRateLimiter:
    """Serialize and space arXiv API requests across sync and async callers."""

    def __init__(
        self,
        min_interval: float = 3.0,
        *,
        clock: Callable[[], float] = time.monotonic,
        sync_sleep: Callable[[float], None] = time.sleep,
        async_sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self.min_interval = min_interval
        self._clock = clock
        self._sync_sleep = sync_sleep
        self._async_sleep = async_sleep
        self._lock = threading.Lock()
        self._last_started: float | None = None

    def _remaining_delay(self) -> float:
        if self._last_started is None:
            return 0.0
        return max(0.0, self.min_interval - (self._clock() - self._last_started))

    def seconds_until_next_slot(self) -> float:
        """Return seconds until the next request slot is available.

        Returns 0.0 if a slot is immediately available.
        This does not acquire the lock, so the value is advisory.
        """
        return self._remaining_delay()

    def run_sync(self, operation: Callable[[], T], timeout: float | None = None) -> T:
        """Run a blocking operation inside the shared request gate.

        Args:
            operation: Callable to execute inside the gate.
            timeout: Optional timeout in seconds for gate acquisition. If the gate
                cannot be acquired within this time, raises GateTimeout without
                calling operation (preserving request spacing).

        Returns:
            Result of the operation.

        Raises:
            GateTimeout: If timeout is provided and gate acquisition times out.
        """
        acquired = self._lock.acquire(
            blocking=True, timeout=timeout if timeout is not None else -1
        )
        if not acquired:
            # Timeout expired waiting for gate - preserve rate limiting by not
            # calling operation
            raise GateTimeout(
                f"Could not acquire rate limiter gate within {timeout}s timeout"
            )
        try:
            delay = self._remaining_delay()
            if delay:
                self._sync_sleep(delay)
            self._last_started = self._clock()
            return operation()
        finally:
            self._lock.release()

    async def run_async(self, operation: Callable[[], Awaitable[T]]) -> T:
        """Run an async operation inside the same gate used by sync callers."""
        while not self._lock.acquire(blocking=False):
            await asyncio.sleep(0.01)
        try:
            delay = self._remaining_delay()
            if delay:
                await self._async_sleep(delay)
            self._last_started = self._clock()
            return await operation()
        finally:
            self._lock.release()


ARXIV_RATE_LIMITER = ArxivRateLimiter()


class RetryableError(Exception):
    """Base class for errors that should trigger a retry."""

    pass


class ArxivTimeoutError(RetryableError):
    """Raised when an arXiv request times out."""

    pass


class ArxivConnectionError(RetryableError):
    """Raised when a connection to arXiv fails."""

    pass


class ArxivRateLimitError(RetryableError):
    """Raised when arXiv returns rate-limiting status (429, 503, 406)."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 429,
        retry_after_seconds: float | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


def _parse_retry_after_seconds(retry_after: str | None) -> float | None:
    """Parse Retry-After header into seconds.

    Supports both delay-seconds (integer) and HTTP-date formats.
    Returns None if unparseable or not provided.
    """
    if not retry_after:
        return None
    try:
        # Try as integer/float seconds first
        return float(retry_after)
    except ValueError:
        pass

    # Try as HTTP-date (RFC 7231)
    try:
        from email.utils import parsedate_to_datetime
        import datetime

        retry_dt = parsedate_to_datetime(retry_after)
        now = datetime.datetime.now(datetime.timezone.utc)
        delta = (retry_dt - now).total_seconds()
        return max(0.0, delta)  # Don't return negative
    except Exception:
        logger.warning(f"Could not parse Retry-After header: {retry_after}")
        return None


def _compute_backoff_seconds(
    attempt: int,
    retry_after: str | None,
    initial_backoff: float,
    max_backoff: float,
) -> float:
    """Exponential backoff with jitter, with Retry-After as floor.

    Args:
        attempt: Zero-based retry attempt number.
        retry_after: Optional Retry-After header value (int or HTTP-date).
        initial_backoff: Initial backoff delay in seconds.
        max_backoff: Maximum backoff delay in seconds.

    Returns:
        Computed backoff delay in seconds with jitter (0.5-1.5x) applied.
        Retry-After (if provided) is used as a strict floor before and after jitter,
        and is NOT capped to max_backoff.
    """
    # Compute exponential backoff with cap
    delay = min(initial_backoff * (2**attempt), max_backoff)

    # Parse Retry-After and apply as floor before jitter
    parsed_retry_after = _parse_retry_after_seconds(retry_after)
    if parsed_retry_after is not None:
        delay = max(delay, parsed_retry_after)

    # Apply jitter (0.5 to 1.5x multiplier)
    jittered = delay * (0.5 + random.random())

    # Ensure jitter never shortens the Retry-After floor
    if parsed_retry_after is not None:
        jittered = max(jittered, parsed_retry_after)

    # Don't cap to max_backoff if Retry-After was higher
    if parsed_retry_after is not None and parsed_retry_after > max_backoff:
        return jittered
    return min(jittered, max_backoff)


async def retry_with_backoff(
    operation: Callable[[], Awaitable[T]],
    *,
    max_retries: int = 3,
    initial_backoff: float = 2.0,
    max_backoff: float = 60.0,
    max_total_time: float | None = None,
    operation_name: str = "operation",
) -> T:
    """Execute an async operation with exponential backoff on retryable errors.

    Retries on:
    - httpx.TimeoutException
    - httpx.ConnectError, httpx.ConnectTimeout, httpx.NetworkError
    - httpx.HTTPStatusError with status 429, 503, 406

    Note: HTTP 406 uses minimal retries (ARXIV_HTTP_406_MAX_RETRIES = 1)
    because arXiv's 406 is IP-level burst throttling and retrying inside
    the window extends the block (#277).

    Args:
        operation: Async callable to execute.
        max_retries: Maximum number of retry attempts (for 429/503).
        initial_backoff: Initial backoff delay in seconds.
        max_backoff: Maximum backoff delay in seconds.
        max_total_time: Optional maximum total time in seconds (raises on exceed).
        operation_name: Name for logging.

    Returns:
        Result of the operation.

    Raises:
        Original exception after exhausting retries, wrapped with context.
    """
    from .config import Settings

    settings = Settings()
    start_time = time.monotonic()
    last_exception: Exception | None = None
    retry_after: str | None = None

    for attempt in range(max_retries + 1):
        if max_total_time is not None:
            elapsed = time.monotonic() - start_time
            if elapsed >= max_total_time:
                attempts_word = "attempt" if attempt == 0 else "attempts"
                logger.error(
                    "%s exceeded max total time %.1fs after %d %s",
                    operation_name,
                    max_total_time,
                    attempt,
                    attempts_word,
                )
                if last_exception:
                    raise ArxivTimeoutError(
                        f"{operation_name} timed out after {max_total_time:.0f}s. "
                        f"The arXiv API may be slow or overloaded. Please retry shortly."
                    ) from last_exception
                raise ArxivTimeoutError(
                    f"{operation_name} timed out after {max_total_time:.0f}s. "
                    f"The arXiv API may be slow or overloaded. Please retry shortly."
                )

        try:
            # Always enforce remaining budget with asyncio.wait_for
            if max_total_time is not None:
                remaining = max_total_time - (time.monotonic() - start_time)
                if remaining <= 0:
                    raise asyncio.TimeoutError("Budget exhausted before attempt")
                logger.debug(
                    "%s attempt %d with %.1fs budget",
                    operation_name,
                    attempt + 1,
                    remaining,
                )
                return await asyncio.wait_for(operation(), timeout=remaining)

            return await operation()
        except asyncio.TimeoutError as e:
            # Raised by wait_for when budget expires during an operation
            if max_total_time is not None:
                elapsed = time.monotonic() - start_time
                logger.error(
                    "%s timed out after %.1fs (budget: %.1fs)",
                    operation_name,
                    elapsed,
                    max_total_time,
                )
                # Determine if this was due to rate limiting
                if last_exception and isinstance(last_exception, httpx.HTTPStatusError):
                  
```

### Core Architecture Module: `src/arxiv_mcp_server/config.py`
```
"""Configuration settings for the arXiv MCP server."""

import sys
from importlib import import_module
from importlib.metadata import version, PackageNotFoundError
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
import logging
import requests


def _resolve_package_version() -> str:
    """Resolve the bundled version first, then installed package metadata."""
    try:
        bundle_version = import_module("._bundle_version", package=__package__)
    except ImportError:
        try:
            return version("arxiv-mcp-server")
        except PackageNotFoundError:
            return "0.0.0"
    return bundle_version.VERSION


_PACKAGE_VERSION = _resolve_package_version()

logger = logging.getLogger(__name__)

# Lazy shared arxiv client — created on first use, not at import time
_arxiv_client = None


def get_arxiv_client(num_retries=None):
    """Return an arxiv.Client with appropriate timeouts and connection settings.

    Args:
        num_retries: Override the number of retries. If None, uses the shared
                     process-wide client with default retries. If an integer,
                     creates a new client with that retry count (use 0 for
                     minimal retries to avoid prolonging 406 IP blocks).

    Callers that need a particular page size must set it while holding the
    shared arXiv request gate. This preserves one requests.Session without
    allowing concurrent searches to race over client configuration.
    """
    global _arxiv_client

    # If num_retries is specified, create a new client with that setting
    if num_retries is not None:
        import arxiv

        client = arxiv.Client(num_retries=num_retries, delay_seconds=3.0)
    # Otherwise use the shared client
    elif _arxiv_client is None:
        import arxiv

        client = arxiv.Client()
        _arxiv_client = client
    else:
        return _arxiv_client

    # The upstream arxiv package issues HTTP requests through a
    # requests.Session with no timeout (arxiv.Client._session.get),
    # so a connection that silently stops responding (a "black hole":
    # the peer never answers again, no FIN/RST — root cause unknown,
    # see issue) blocks forever inside ARXIV_RATE_LIMITER's
    # process-wide lock, wedging every subsequent search until the
    # server is restarted.
    #
    # 1. Inject connect/read timeouts so such a request fails within
    #    ~35s, the lock is released, and later calls recover.
    # 2. Disable keep-alive connection reuse so a pooled connection
    #    can never be reused after going stale (urllib3's stale check
    #    only verifies the socket object exists, not that the peer is
    #    still reachable).
    #
    # Only patch a real requests.Session; tests may substitute a mock
    # client without one.
    session = getattr(client, "_session", None)
    if isinstance(session, requests.Session):
        _orig_get = session.get
        settings = Settings()

        def _get_with_timeout(url, **kwargs):
            kwargs.setdefault(
                "timeout",
                (
                    float(settings.ARXIV_CONNECT_TIMEOUT),
                    float(settings.get_request_timeout()),
                ),
            )
            return _orig_get(url, **kwargs)

        session.get = _get_with_timeout
        # requests' default headers already include 'Connection: keep-alive',
        # so setdefault would be a no-op; assign directly.
        session.headers["Connection"] = "close"

    return client


def close_arxiv_client() -> None:
    """Close the shared HTTP session and clear the process-wide client."""
    global _arxiv_client
    if _arxiv_client is None:
        return
    session = getattr(_arxiv_client, "_session", None)
    close = getattr(session, "close", None)
    if callable(close):
        close()
    _arxiv_client = None


class Settings(BaseSettings):
    """Server configuration settings."""

    APP_NAME: str = "arxiv-mcp-server"
    APP_VERSION: str = _PACKAGE_VERSION
    MAX_RESULTS: int = 50
    BATCH_SIZE: int = 20
    REQUEST_TIMEOUT: int = 60  # Deprecated: use ARXIV_REQUEST_TIMEOUT
    ARXIV_REQUEST_TIMEOUT: int = 30
    ARXIV_CONNECT_TIMEOUT: int = 10
    ARXIV_MAX_RETRIES: int = 2
    ARXIV_HTTP_406_MAX_RETRIES: int = 1
    ARXIV_INITIAL_BACKOFF: float = 2.0
    ARXIV_MAX_BACKOFF: float = 30.0
    ARXIV_MAX_TOTAL_TIME: int = 50
    TRANSPORT: str = "stdio"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    ALLOWED_HOSTS: str = ""
    ALLOWED_ORIGINS: str = ""
    SEMANTIC_SCHOLAR_API_KEY: str = ""
    model_config = SettingsConfigDict(extra="allow")

    def model_post_init(self, __context) -> None:
        """Validate timeout settings after initialization."""
        # Only log validation warnings once per process
        if not hasattr(Settings, "_validation_logged"):
            Settings._validation_logged = False

        if Settings._validation_logged:
            # Still validate but don't log again
            if self.ARXIV_REQUEST_TIMEOUT <= 0:
                self.ARXIV_REQUEST_TIMEOUT = 30
            if self.ARXIV_CONNECT_TIMEOUT <= 0:
                self.ARXIV_CONNECT_TIMEOUT = 10
            if self.ARXIV_MAX_TOTAL_TIME <= 0:
                self.ARXIV_MAX_TOTAL_TIME = 50
            if self.ARXIV_MAX_BACKOFF <= 0:
                self.ARXIV_MAX_BACKOFF = 30.0
            return

        Settings._validation_logged = True

        # Validate positive timeouts
        if self.ARXIV_REQUEST_TIMEOUT <= 0:
            logger.warning(
                f"ARXIV_REQUEST_TIMEOUT must be positive (got {self.ARXIV_REQUEST_TIMEOUT}), using default 30"
            )
            self.ARXIV_REQUEST_TIMEOUT = 30
        if self.ARXIV_CONNECT_TIMEOUT <= 0:
            logger.warning(
                f"ARXIV_CONNECT_TIMEOUT must be positive (got {self.ARXIV_CONNECT_TIMEOUT}), using default 10"
            )
            self.ARXIV_CONNECT_TIMEOUT = 10
        if self.ARXIV_MAX_TOTAL_TIME <= 0:
            logger.warning(
                f"ARXIV_MAX_TOTAL_TIME must be positive (got {self.ARXIV_MAX_TOTAL_TIME}), using default 50"
            )
            self.ARXIV_MAX_TOTAL_TIME = 50
        if self.ARXIV_MAX_BACKOFF <= 0:
            logger.warning(
                f"ARXIV_MAX_BACKOFF must be positive (got {self.ARXIV_MAX_BACKOFF}), using default 30"
            )
            self.ARXIV_MAX_BACKOFF = 30.0

    def get_request_timeout(self) -> int:
        """Get request timeout with fallback to legacy REQUEST_TIMEOUT.

        Returns ARXIV_REQUEST_TIMEOUT if explicitly set (case-insensitive),
        otherwise falls back to REQUEST_TIMEOUT (case-insensitive) for
        backward compatibility. Non-positive values clamp to default 30.
        """
        # Check if ARXIV_REQUEST_TIMEOUT was explicitly set (case-insensitive)
        import os

        env_keys = {k.upper(): k for k in os.environ.keys()}

        if "ARXIV_REQUEST_TIMEOUT" in env_keys:
            return self.ARXIV_REQUEST_TIMEOUT
        # Fall back to REQUEST_TIMEOUT if it was explicitly set (case-insensitive)
        if "REQUEST_TIMEOUT" in env_keys:
            # Validate legacy value the same way as ARXIV_REQUEST_TIMEOUT
            if self.REQUEST_TIMEOUT <= 0:
                logger.warning(
                    f"REQUEST_TIMEOUT must be positive (got {self.REQUEST_TIMEOUT}), using default 30"
                )
                return 30
            return self.REQUEST_TIMEOUT
        # Use ARXIV_REQUEST_TIMEOUT default
        return self.ARXIV_REQUEST_TIMEOUT

    @property
    def STORAGE_PATH(self) -> Path:
        """Get the resolved storage path and ensure it exists.

        Returns:
            Path: The absolute storage path.
        """
        path = (
            self._get_storage_path_from_args()
            or Path.home() / ".arxiv-mcp-server" / "papers"
        )
        path = path.resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _get_storage_path_from_args(self) -> Path | None:
        """Extract storage path from command line arguments.

        Returns:
            Path | None: The storage path if specified in arguments, None otherwise.
        """
        args = sys.argv[1:]

        # If not enough arguments
        if len(args) < 2:
            return None

        # Look for the --storage-path option
        try:
            storage_path_index = args.index("--storage-path")
        except ValueError:
            return None

        # Early return if --storage-path is the last argument
        if storage_path_index + 1 >= len(args):
            return None

        # Try to resolve the path
        try:
            path = Path(args[storage_path_index + 1])
            return path.resolve()
        except (TypeError, ValueError) as e:
            # TypeError: If the path argument is not string-like
            # ValueError: If the path string is malformed
            logger.warning(f"Invalid storage path format: {e}")
        except OSError as e:
            # OSError: If the path contains invalid characters or is too long
            logger.warning(f"Invalid storage path: {e}")

        return None

```

### Core Architecture Module: `src/arxiv_mcp_server/prompts/__init__.py`
```
"""Prompt handling functionality for arXiv MCP server."""

from .handlers import list_prompts, get_prompt

__all__ = ["list_prompts", "get_prompt"]

```

### Core Architecture Module: `src/arxiv_mcp_server/prompts/compare_papers_prompt.py`
```
"""Prompt template for side-by-side paper comparisons."""

COMPARE_PAPERS_PROMPT = """
Compare the provided papers with a focus on technical differences and tradeoffs.

Required structure:
1. Shared problem definition and scope
2. Method comparison table (assumptions, architecture, training setup)
3. Results comparison (benchmarks, metrics, and caveats)
4. Strengths, weaknesses, and failure modes
5. Recommendation: when to choose each approach

Use concrete evidence from each paper; call out missing details explicitly.
"""

```

### Core Architecture Module: `src/arxiv_mcp_server/prompts/deep_research_analysis_prompt.py`
```
"""Deep research analysis prompt for the arXiv MCP server."""

# Consolidated comprehensive paper analysis prompt
PAPER_ANALYSIS_PROMPT = """
You are an AI research assistant tasked with analyzing academic papers from arXiv. You have access to several tools to help with this analysis:

AVAILABLE TOOLS:
1. read_paper: Use this tool to retrieve the full content of the paper with the provided arXiv ID
2. download_paper: If the paper is not already available locally, use this tool to download it first
3. search_papers: Find related papers on the same topic to provide context
4. list_papers: Check which papers are already downloaded and available for reading

<workflow-for-paper-analysis>
<preparation>
  - First, use the list_papers tool to check if the paper is already downloaded
  - If not found, use the download_paper tool to retrieve it
  - Then use the read_paper tool with the paper_id to get the full content
  - If the paper is not found, use the search_papers tool to find related papers while you wait
  - If you find related papers, use the download_paper tool to get the full content of the related papers and read those too
</preparation>
<comprehensive-analysis>
  - Executive Summary:
    * Summarize the paper in 2-3 sentences
    * What is the main contribution of the paper?
    * What is the main problem that the paper solves?
    * What is the main methodology used in the paper?
    * What are the main results of the paper?
    * What is the main conclusion of the paper?
</comprehensive-analysis>
<research-context>
  * Research area and specific problem addressed
  * Key prior approaches and their limitations
  * How this paper aims to advance the field
  * How does this paper compare to other papers in the field?
</research-context>
<methodology-analysis>
  * Step-by-step breakdown of the approach
  * Key innovations in the methodology
  * Theoretical foundations and assumptions
  * Technical implementation details
  * Algorithmic complexity and performance characteristics
  * Anything the reader should know about the methodology if they wanted to replicate the paper
</methodology-analysis>
<results-analysis>
  * Experimental setup (datasets, benchmarks, metrics)
  * Main experimental results and their significance
  * Statistical validity and robustness of results
  * How results support or challenge the paper's claims
  * Comparison to state-of-the-art approaches
</results-analysis>
<practical-implications>
  * How could this be implemented or applied?
  * Required resources and potential challenges
  * Available code, datasets, or resources
</practical-implications>
<theoretical-implications>
  * How this work advances fundamental understanding
  * New concepts or paradigms introduced
  * Challenges to existing theories or assumptions
  * Open questions raised
</theoretical-implications>
<future-directions>
  * Limitations that future work could address
  * Promising follow-up research questions
  * Potential for integration with other approaches
  * Long-term research agenda this work enables
</future-directions>
<broader-impact>
  * Societal, ethical, or policy implications
  * Environmental or economic considerations
  * Potential real-world applications and timeframe
</broader-impact>

<keep-in-mind>
  * Use the search_papers tool to find related work or papers building on this work
  * Cross-reference findings with other papers you've analyzed
  * Use your artifacts to create diagrams, pseudocode, and other visualizations to illustrate key concepts
  * Summarize key results in tables for easy reference
</keep-in-mind>
</workflow-for-paper-analysis>
Structure your analysis with clear headings, maintain technical accuracy while being accessible, and include your critical assessment where appropriate. 
Your analysis should be comprehensive but concise. Be sure to critically evaluate the statistical significance and 
reproducibility of any reported results.
"""

```

### Core Architecture Module: `src/arxiv_mcp_server/prompts/handlers.py`
```
"""Handlers for prompt-related requests with paper analysis functionality."""

from typing import List, Dict
from mcp.types import Prompt, PromptMessage, TextContent, GetPromptResult
from .prompts import PROMPTS
from .deep_research_analysis_prompt import PAPER_ANALYSIS_PROMPT
from .summarize_paper_prompt import SUMMARIZE_PAPER_PROMPT
from .compare_papers_prompt import COMPARE_PAPERS_PROMPT
from .literature_review_prompt import LITERATURE_REVIEW_PROMPT

# Output structure for deep paper analysis
OUTPUT_STRUCTURE = """
Present your analysis with the following structure:
1. Executive Summary: 3-5 sentence overview of key contributions
2. Detailed Analysis: Following the specific focus requested
3. Visual Breakdown: Describe key figures/tables and their significance
4. Related Work Map: Position this paper within the research landscape
5. Implementation Notes: Practical considerations for applying these findings
"""


async def list_prompts() -> List[Prompt]:
    """Handle prompts/list request."""
    return list(PROMPTS.values())


async def get_prompt(
    name: str, arguments: Dict[str, str] | None = None, session_id: str | None = None
) -> GetPromptResult:
    """Handle prompts/get request for paper analysis.

    Args:
        name: The name of the prompt to get
        arguments: The arguments to use with the prompt
        session_id: Optional user session ID for context persistence

    Returns:
        GetPromptResult: The resulting prompt with messages

    Raises:
        ValueError: If prompt not found or arguments invalid
    """
    if name not in PROMPTS:
        raise ValueError(f"Prompt not found: {name}")

    prompt = PROMPTS[name]
    if arguments is None:
        raise ValueError(f"No arguments provided for prompt: {name}")

    # Validate required arguments
    for arg in prompt.arguments:
        if arg.required and (arg.name not in arguments or not arguments.get(arg.name)):
            raise ValueError(f"Missing required argument: {arg.name}")

    # Prompt generation is intentionally stateless. MCP does not currently pass
    # a reliable session lifecycle here, so retaining process-global paper IDs
    # would leak context between unrelated clients and grow without bound.
    paper_id = arguments.get("paper_id", "")

    if name == "deep-paper-analysis":
        content = (
            f"Analyze paper {paper_id}.\n\n"
            f"{OUTPUT_STRUCTURE}\n\n{PAPER_ANALYSIS_PROMPT}"
        )
    elif name == "summarize_paper":
        content = (
            f"Summarize paper {paper_id}.\n\n"
            "Use list_papers/download_paper/read_paper as needed before summarizing.\n\n"
            f"{SUMMARIZE_PAPER_PROMPT}"
        )
    elif name == "compare_papers":
        paper_ids = arguments.get("paper_ids", "")
        content = (
            f"Compare papers: {paper_ids}.\n\n"
            "Use list_papers/download_paper/read_paper to gather full text for each paper.\n\n"
            f"{COMPARE_PAPERS_PROMPT}"
        )
    elif name == "research-discovery":
        topic = arguments.get("topic", "")
        expertise_level = arguments.get("expertise_level", "unspecified")
        time_period = arguments.get("time_period", "unspecified")
        domain = arguments.get("domain", "unspecified")
        content = (
            f"Create a research discovery plan for: {topic}.\n"
            f"Expertise level: {expertise_level}.\n"
            f"Time period: {time_period}.\n"
            f"Domain: {domain}.\n\n"
            "Use search_papers and get_abstract to map the field before recommending papers. "
            "Return key terminology, several focused search queries, foundational and recent "
            "papers, major research clusters, disagreements, and a prioritized reading path. "
            "Calibrate explanations and assumed background to the expertise level."
        )
    elif name == "literature-synthesis":
        paper_ids = arguments.get("paper_ids", "")
        synthesis_type = arguments.get("synthesis_type", "comprehensive")
        domain = arguments.get("domain", "unspecified")
        content = (
            f"Synthesize these papers: {paper_ids}.\n"
            f"Synthesis type: {synthesis_type}.\n"
            f"Domain: {domain}.\n\n"
            "Use list_papers/download_paper/read_paper to inspect each paper. Compare evidence "
            "across papers rather than summarizing them independently. Identify agreements, "
            "contradictions, methodological differences, limitations, and open gaps. Cite the "
            "relevant paper IDs for every substantive comparison."
        )
    elif name == "research-question":
        paper_ids = arguments.get("paper_ids", "")
        topic = arguments.get("topic", "")
        domain = arguments.get("domain", "unspecified")
        content = (
            f"Formulate research questions about: {topic}.\n"
            f"Source papers: {paper_ids}.\n"
            f"Domain: {domain}.\n\n"
            "Use list_papers/download_paper/read_paper to ground the questions in the supplied "
            "literature. Produce specific, falsifiable research questions. For each question, "
            "state the motivating gap, a plausible hypothesis, an evaluation method, required "
            "data or experiments, and the result that would falsify the hypothesis."
        )
    elif name == "literature_review":
        topic = arguments.get("topic", "")
        paper_ids = arguments.get("paper_ids", "")
        optional_ids = f"\nFocus papers: {paper_ids}." if paper_ids else ""
        content = (
            f"Create a literature review on topic: {topic}.{optional_ids}\n\n"
            "Use search_papers to discover missing papers and read_paper to synthesize evidence.\n\n"
            f"{LITERATURE_REVIEW_PROMPT}"
        )
    else:  # Defensive guard if a prompt is registered without a handler.
        raise ValueError(f"Prompt handler not implemented: {name}")

    return GetPromptResult(
        messages=[
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text=content,
                ),
            )
        ]
    )

```

### Core Architecture Module: `src/arxiv_mcp_server/prompts/literature_review_prompt.py`
```
"""Prompt template for literature review synthesis."""

LITERATURE_REVIEW_PROMPT = """
Generate a structured literature review for the topic and paper set.

Required structure:
1. Scope and inclusion criteria
2. Thematic clusters in prior work
3. Methodological trends over time
4. Consensus findings and unresolved disagreements
5. Gaps and open research questions
6. Suggested future directions

Prioritize synthesis over summary and separate established findings from tentative claims.
"""

```

### Core Architecture Module: `src/arxiv_mcp_server/prompts/prompt_manager.py`
```
"""Research journey prompt management for the arXiv MCP server."""

from typing import Dict, Optional
from mcp.types import Prompt
from .prompts import PROMPTS

# Global prompt manager instance
_prompt_manager: Optional[Dict[str, Prompt]] = None


def get_prompt_manager() -> Dict[str, Prompt]:
    """Get or create the global prompt manager dictionary.

    Returns:
        Dict[str, Prompt]: Dictionary of available prompts
    """
    global _prompt_manager
    if _prompt_manager is None:
        _prompt_manager = PROMPTS

    return _prompt_manager


def register_prompt(prompt: Prompt) -> None:
    """Register a new prompt in the prompt manager.

    Args:
        prompt (Prompt): The prompt to register
    """
    manager = get_prompt_manager()
    manager[prompt.name] = prompt

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #284** (2026-10-05): **v0.8.0 QA: missing KAN sections, metadata timeout overrun, watch cap reset**
  *Symptoms*: ## Summary  Three reproducible bugs in the released **0.8.0** package:  1. HTML section parsing misses real KAN sections and assigns most of the paper to Introduction. 2. The optional post-download metadata lookup exceeds the configured total deadline and read timeout. 3. Updating a topic watch without `max_results` silently resets its saved cap to 10.  The section failure was reproduced against a live paper. The timeout failure below uses **local simulated upstream delays**, not a claim that the live arXiv API timed out. The watch failure requires no upstream requests.  ## Environment  - Tested 2026-10-04 on Linux x86_64, Python 3.12.14 - Official PyPI `arxiv-mcp-server==0.8.0` - MCP Python SDK 1.30.0, `arxiv==4.0.1`, `httpx==0.28.1`, `requests==2.34.2` - Real stdio MCP subprocess, initialized with the official `ClientSession` - Separate storage directory; no source files modified - [Release v0.8.0](https://github.com/blazickjp/arxiv-mcp-server/releases/tag/v0.8.0) / [PyPI 0.8.0](https://pypi.org/project/arxiv-mcp-server/0.8.0/)  ### Setup  ```sh python3.12 -m venv .venv .venv/bin/python -m pip install \   arxiv-mcp-server==0.8.0 mcp==1.30.0 arxiv==4.0.1 \   httpx==0.28.1 requests==2.34.2 mkdir -p qa-papers .venv/bin/arxiv-mcp-server --storage-path "$PWD/qa-papers" ```  Connect an MCP client to that stdio command and make the calls below sequentially. Each JSON object is the `params` object for an MCP `tools/call` request. Use fresh QA storage to avoid cached results or exis

- **Issue #260** (2026-08-23): **HTML→markdown: Switch Transformers extraction noise (dup author, split citations/figures)**
  *Symptoms*: ## Context Post-#238–#245 dogfood. P2 / nice-to-have. Related to title fix (# decorative letter-split) if same extractor; distinct from #239 front-matter focus.  ## Problem On Switch Transformers `2101.03961` (HTML path), extraction leaves noisy markdown: - Duplicated author line. - Citations split across lines, e.g. `[\n1\n]`. - Figure refs split, e.g. `Fig.\n2\n`.  ## Repro 1. `download_paper(paper_id="2101.03961")`. 2. `read_paper(paper_id="2101.03961", start=0, max_chars=4000)` (and skim citation/figure regions). 3. Observe duplicated author line and split `[1]` / `Fig. 2` forms.  ## Expected - Single coherent author line. - Inline citation and figure references stay on one line where HTML only used decorative breaks (`[1]`, `Fig. 2`). - Fine to land with the decorative-title extractor cleanup if that path already touches the same HTML→md pipeline.

- **Issue #259** (2026-08-23): **export_citations: exact-duplicate paper_ids emit identical BibTeX twice**
  *Symptoms*: ## Context Post-#238–#245 dogfood. P2. Related but distinct from #241 / #247 (bare + versioned sibling collapse still works).  ## Problem Passing the same id twice emits two identical BibTeX entries. Exact-duplicate collapse is missing even though bare+versioned sibling dedupe (#241) already landed.  ## Repro ``` export_citations(paper_ids=["1706.03762", "1706.03762"]) ``` Also: `["1706.03762v7", "1706.03762v7"]`.  Observed: two identical `@misc` / BibTeX blocks for the same paper.  Confirm still OK: bare+versioned mixed list (e.g. `1706.03762` + `1706.03762v7`) continues to collapse per #241.  ## Expected - Collapse identical normalized IDs to a single BibTeX entry. - Keep existing bare↔versioned sibling collapse behavior.

- **Issue #258** (2026-08-23): **HTML→markdown: decorative title letter-split / orphaned subtitle colon**
  *Symptoms*: ## Context Post-#238–#245 dogfood. P1. **Distinct from #239** (author/CCS/`\\times` front-matter cleanup). This is title extraction for decorative letter-span HTML.  ## Problem Some HTML papers store titles as one letter (or glyph) per line after conversion: - DAOP `2501.10375` — letter-per-line title. - ExpertFlow `2410.17954` — orphaned `:` subtitle fragment (title/subtitle join broken).  ## Repro 1. `download_paper(paper_id="2501.10375")` then `read_paper(..., start=0, max_chars=500)` — title is letter-split across lines. 2. `download_paper(paper_id="2410.17954")` then read leading markdown — subtitle starts with orphaned `:` / incomplete title join.  ## Expected - Join decorative letter spans in title extraction into a single coherent title line. - Preserve subtitle text without an orphaned leading colon. - Keep #239 author/CCS work separate; this is title-specific.

- **Issue #257** (2026-08-23): **get_paper_outline: numbered body lists become fake L1 sections (Switch Transformers)**
  *Symptoms*: ## Context Post-#238–#245 dogfood. P1. Related but distinct from #240 (wrong order / duplicate Method) and #229/#235 (References cutoff / heading heuristics).  ## Problem For Switch Transformers (`2101.03961`) via HTML, `get_paper_outline` promotes numbered Future Work list items (`4.`, `5.`, …) into fake L1 sections. Numbered body lists must not become outline sections.  ## Repro 1. `download_paper(paper_id="2101.03961")` (HTML path). 2. `get_paper_outline(paper_id="2101.03961")`. 3. Inspect sections around Future Work: items labeled `4.` / `5.` appear as top-level outline sections.  ## Expected - Numbered lists in body prose (Future Work bullets/items, etc.) are not treated as L1 headings. - Outline L1 entries should reflect real section headings only.

- **Issue #256** (2026-08-23): **get_paper_latex / get_paper_latex_section: return_full_text missing from inputSchema**
  *Symptoms*: ## Context Post-#238–#245 dogfood. P1. Parity with `download_paper` / `read_paper` schemas that already expose `return_full_text`.  ## Problem `get_paper_latex` and `get_paper_latex_section` handlers honor `return_full_text=true`, and `next_retrieval` guidance tells callers to pass it — but the tools’ `inputSchema` only lists `paper_id` / `start` / `max_chars` (and section args where applicable) with `additionalProperties: false`. Strict MCP clients therefore cannot send the parameter the handlers already implement.  ## Repro 1. Inspect `tools/list` schemas for `get_paper_latex` and `get_paper_latex_section`. 2. Note properties: `paper_id`, `start`, `max_chars` (plus section selectors) — no `return_full_text`; `additionalProperties: false`. 3. Call with a paginated response that includes `next_retrieval` instructing `return_full_text=true`. 4. Strict clients reject or strip `return_full_text` as an undeclared property; handlers already accept it when somehow passed.  ## Expected - Add `return_full_text` (boolean, same semantics as download/read) to both tools’ `inputSchema`. - Keep handler behavior; this is a schema/docs parity gap, not a new feature.

- **Issue #255** (2026-08-23): **check_alerts: arXiv 429 returns bare Error text, not JSON rate_limited**
  *Symptoms*: ## Context Post-#238–#245 dogfood. P1. Related: #238 (`search_papers` 429 → JSON via `_rate_limited_response`); `citation_graph` soft rate-limit UX.  ## Problem Under arXiv IP throttle, `check_alerts` returns bare text:  ``` Error: arXiv is rate limiting... ```  `handle_search` maps the same condition through `_rate_limited_response` to structured JSON with `status=rate_limited`. `handle_check_alerts` only has a broad `except Exception: Error: {exc}` path, so agents get an unstructured stall-like failure instead of parity with search.  ## Repro 1. Call `check_alerts` during an active arXiv IP 429 window (or after rapid search/alert traffic). 2. Observe bare `Error: arXiv is rate limiting…` text (not JSON). 3. Compare with `search_papers` under the same throttle → `{ "status": "rate_limited", … }` (post-#238/#249).  ## Expected - `check_alerts` uses the same `_rate_limited_response` / JSON `status=rate_limited` shape as `search_papers`. - Prefer actionable structured error over bare `Error:` text for rate limits (and ideally other mapped failures).

- **Issue #254** (2026-08-23): **download_paper: legacy arXiv IDs crash FileNotFoundError (parent dir not created)**
  *Symptoms*: ## Context Post-#238–#245 dogfood. P0.  ## Problem `download_paper` on legacy slash-form arXiv IDs (e.g. `hep-th/9901001`) fetches HTML successfully, then crashes with `FileNotFoundError` when writing `papers/<cat>/<id>.md` because the parent directory is never created.  `get_paper_path` only `mkdir`s `STORAGE_PATH`; `bare_arxiv_id` keeps the slash, so the write path includes an uncreated category subdirectory. The error also leaks absolute filesystem paths to the client.  Also reproduces on `quant-ph/0101001` and `math-ph/0001001`.  ## Repro 1. Call `download_paper(paper_id="hep-th/9901001")` (also try `quant-ph/0101001`, `math-ph/0001001`). 2. Observe: HTML fetch succeeds, then `FileNotFoundError` writing under `papers/<cat>/<id>.md`. 3. Error message includes absolute storage paths.  ## Expected - Successful download + markdown write for legacy slash IDs. - Fix direction: `mkdir(parents=True)` on the paper path’s parent and/or sanitize `/` in the storage stem so the path stays flat under `STORAGE_PATH`. - Do not leak absolute host paths in tool error responses.

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

### Incident Patch 1: `eb73c324` (2026-10-05)
**Commit Message**: Fix appendix navigation after References (#291)

Fixes #288. The outline keeps scanning past References/Bibliography. After References, only a strict whitelist is accepted: Appendix X + title (one or two lines), X.n[.m] subsections, and Acknowledgments/Author Contributions/Supplementary/Appendix keywords. A real capitalized References heading always starts its own section. Bare, all-lowercase, single-word lines are never headings. Bare-title lookup strips Appendix/X.n prefixes and returns an error listing candidates when the match is ambiguous.

Verified on 19 real papers over stdio MCP: no real section that main finds is lost. CI 11/11, 603 passed.

Known limitations (follow-up): appendices before References remain out of scope (GPT-3, Switch, DeepSeek-R1). In DeepSeek-R1 2501.12948, markdown '#' lines from prompt templates and tables inside pre-References appendices still appear as sections. Main never reached that text, because it stopped at a fake 'reference' heading.

**File**: `src/arxiv_mcp_server/tools/paper_outline.py` (modified, +302/-12)
```diff
@@ -56,7 +56,25 @@
 _FENCE_RE = re.compile(r"^```")
 _MAX_BARE_TITLE_CHARS = 80
 # Stop collecting headings once References/Bibliography is seen (ref-line pollution).
-_OUTLINE_TERMINATORS = frozenset({"reference", "references", "bibliography"})
+_OUTLINE_TERMINATORS = frozenset({"references", "bibliography"})
+# Post-References whitelist: exact standalone titles allowed after References/Bibliography
+_POST_REFERENCES_ALLOWLIST = frozenset(
+    {
+        "acknowledgment",
+        "acknowledgments",
+        "acknowledgement",
+        "acknowledgements",
+        "author contributions",
+        "supplementary material",
+        "supplementary materials",
+        "appendix",
+        "appendices",
+    }
+)
+# Pattern for lettered appendix (A, B, C, etc.) or numbered (A.1, A.2, B.1, etc.)
+_APPENDIX_LETTER_RE = re.compile(r"^([A-H])(?:\.(\d+(?:\.\d+)*))?$")
+# Pattern for "Appendix X" where X is A-H
+_APPENDIX_PREFIX_RE = re.compile(r"^(Appendix|Supplementary)\s+([A-H])$", re.IGNORECASE)
 # Top-level section indices stay small; years like 2023 USENIX… are common FPs.
 _MAX_SECTION_INDEX = 99
 # Minor words allowed lowercase inside otherwise Title-Case headings.
@@ -405,6 +423,16 @@ def _match_heading_line(line: str) -> tuple[int, str] | None:
             if remainder.endswith("."):
                 remainder = remainder[:-1]
             if remainder.strip().casefold() == candidate.casefold():
+                # Reject lowercase "reference"/"references" - only capitalized versions
+                # are valid section headings (regression blocker: DeepSeek-R1 2501.12948)
+                if candidate.casefold() in ("reference", "references"):
+                    if not candidate[0].isupper():
+                        return None
+                # Reject bare, all-lowercase, single-word lines (e.g., prompt template
+                # text like "conclusion"). Only applies to bare titles, not numbered,
+                # split-number, Appendix X, or capitalized lines.
+                if candidate.islower() and " " not in candidate:
+                    return None
                 return 1, candidate
 
     return None
@@ -558,6 +586,138 @@ def _is_bare_section_title_line(line: str) -> bool:
     return remainder.strip().casefold() == candidate.casefold()
 
 
+def _is_post_references_accepted(
+    title: str,
+    logical_line: str,
+    opened_appendices: set[str],
+) -> bool:
+    """Check if a heading is accepted in post-References mode (strict whitelist).
+
+    Args:
+        title: The normalized heading title.
+        logical_line: The original line (for checking ATX/numbered patterns).
+        opened_appendices: Set of appendix letters (A-H) already opened.
+
+    Returns:
+        True if the heading passes the post-References whitelist.
+    """
+    normalized = title.casefold()
+
+    # (c) Exact standalone title from allowlist
+    if normalized in _POST_REFERENCES_ALLOWLIST:
+        return True
+
+    # (a) "Appendix X" + title (inline, will be checked in two-line pattern separately)
+    # Check if title starts with "Appendix X " or "Supplementary X " or "Appendix X" (no trailing space)
+    appendix_prefix_match = re.match(
+        r"^(appendix|supplementary)\s+([a-h])(?:\s+|$)", normalized
+    )
+    if appendix_prefix_match:
+        letter = appendix_prefix_match.group(2).upper()
+        opened_appendices.add(letter)
+        return True
+
+    # (b) Dotted number X.n[.m] where X is an already-opened appendix letter
+    # OR opening a new appendix letter with a dotted subsection (e.g., A.1.1)
+    # Extract first token of title to check if it's a dotted appendix subsection
+    first_token = title.split()[0] if title.split() else ""
+    dotted_match = re.match(r"^([A-H])\.(\d+(?:\.\d+)*)$", first_token, re.IGNORECASE)
+    if dotted_match:
+        letter = dotted_match.group(1).upper()
+        # Allow opening a new appendix letter with a dotted subsection
+        opened_appendices.add(letter)
+        return True
+
+    return False
+
+
+def _match_two_line_appendix(
+    first_line: str,
+    second_line: str,
+    opened_appendices: set[str],
+) -> tuple[int, str] | None:
+    """Match two-line appendix pattern: 'Appendix B' followed by title.
+
+    Returns (level, combined_title) or None.
+    Level 1 for 'Appendix B Title', level 2 for 'B.1 Title'.
+
+    Args:
+        first_line: First line (e.g. "Appendix B" or "A.1").
+        second_line: Second line (title text).
+        opened_appendices: Set of appendix letters already opened (updated in place).
+    """
+    first = first_line.strip()
+    second = second_line.strip()
+
+    if not first or not second:
+        return None
+
+    # Second line should not be another heading marker or look like a table cell
+    if _ATX_HEADING_RE.match(second):
+        return None
+    if _NUMBERED_HEADING_RE.match(second):
+        return None
+
+    # Reject if second line is a numbered appendix marker or "Appendix X" pat
```

**File**: `tests/tools/test_paper_outline.py` (modified, +1172/-7)
```diff
@@ -8,6 +8,7 @@
 
 from arxiv_mcp_server.tools import paper_outline as outline_module
 from arxiv_mcp_server.tools.paper_outline import (
+    _find_section,
     handle_get_paper_outline,
     handle_read_paper_section,
     handle_search_paper_text,
@@ -558,26 +559,355 @@ async def test_bare_title_read_section_and_search_clean(patch_storage):
 ,
 pp. 551–564
 .
+
 Appendix
-Should not appear after references terminator.
+
+Additional implementation details and proofs.
+"""
+
+
+# Paper with appendices after References (regression #288)
+DPO_STYLE_WITH_APPENDIX = """# Abstract
+
+This paper presents Direct Preference Optimization.
+
+# Introduction
+
+DPO simplifies RLHF.
+
+# Background
+
+RLHF background.
+
+# DPO
+
+Our method details.
+
+# Experiments
+
+Experimental setup.
+
+# Results
+
+Performance results.
+
+# References
+
+[1] Schulman et al. Proximal Policy Optimization. 2017.
+[2] Ouyang et al. Training language models to follow instructions. 2022.
+
+# DPO Implementation Details and Hyperparameters
+
+We use the following hyperparameters for training.
+
+## Learning Rate Schedule
+
+We use a cosine learning rate schedule.
+
+## Model Architecture
+
+Models follow the standard transformer architecture.
+
+# Additional Experimental Results
+
+Further analysis of model performance.
+"""
+
+
+# Real paper 2305.04388v2 (Turpin et al.) excerpt: References tail + appendices with table cells
+# Verbatim from arxiv-mcp-server HTML→text conversion
+TURPIN_REAL_EXCERPT = """References
+
+The best answer is: (B)
+✗
+Appendix A
+
+Additional Samples
+
+See
+
+Appendix B
+
+Verifying that Explanations Do Not Mention Biasing Features
+
+As discussed in
+
+Appendix C
+
+Qualitative Analysis Details
+
+Table 7:
+
+C.1
+
+BBH
+
+For each explanation reviewed, we annotate two features:
+
+Appendix D
+
+Results Tables
+
+We include the following extra results tables:
+
+Table 9:
+Accuracy on BBH broken down by task. The results are for examples with bias-contradicting labels.
+
+GPT-3.5
+
+Claude 1.0
+
+No-CoT
+
+CoT
+
+UB
+
+B
+
+UB
+
+B
+
+Web Of Lies
+
+Sugg. Ans.
+
+ZS
+
+46.2
+
+18.8
+
+FS
+
+56.4
+
+35.9
+
+Snarks
+
+Sugg. Ans.
+
+ZS
+
+66.2
+
+46.8
+
+Table 11:
+Number of failed samples per experimental setting, primarily due to CoT explanations not giving the answer in the correct format.
+
+# Failed
+
+No debiasing instruction
+
+GPT-3.5
+
+Zero-shot
+
+0
+
+Few-shot
+
+0
+
+Table 12:
+Number of failed samples per experimental setting.
+
+N Total
+
+# FS (Ans. A)
+
+Hyperbaton
+
+1
+
+0
+
+300
+
+7
+
+Snarks
+
+10
+
+0
+
+151
+
+14
+
+Web Of Lies
+
+0
+
+0
+
+220
+
+10
+
+Appendix E
+
+Prompting Details
+
+The following prompting details apply to both the BBH and BBQ experiments.
+
+Appendix F
+
+Additional BBH Experiment Details
+
+F.1
+
+F.1
+
+Data
+
+For most tasks, we pull from the original BIG-Bench data using Hugging Face datasets.
+"""
+
+
+# Real DPO 2305.18290v3 excerpt: References tail + appendices
+DPO_REAL_EXCERPT = """References
+
+D. M. Ziegler, N. Stiennon, J. Wu, T. B. Brown, A. Radford, D. Amodei,
+P. Christiano, and G. Irving.
+Fine-tuning language models from human preferences, 2020.
+
+Author Contributions
+
+All authors
+provided valuable contributions to designing, analyzing, and iterating on experiments, writing and editing the paper, and generally managing the project's progress.
+
+RR
+
+proposed using autoregressive reward models in discussions with
+
+EM
+
+; derived the DPO objective; proved the theoretical properties of the algorithm.
+
+CF, CM, & SE
+
+supervised the research, suggested ideas and experiments, and assisted in writing the paper.
+
+Appendix A
+
+Mathematical Derivations
+
+A.1
+
+A.1
+
+Deriving the Optimum of the KL-Constrained Reward Maximization Objective
+
+In this appendix, we will derive Eq. 4 . Analogously to Eq. 3 , we optimize the following objective:
+
+A.2
+
+Deriving the DPO Objective Under the Bradley-Terry Model
+
+It is straightforward to derive the DPO objective under the Bradley-Terry preference model as we have
+
+A.2
+
+, the normalization constant
+
+Z(x)
+
+Appendix B
+
+DPO Implementation Details and Hyperparameters
+
+DPO is relatively straightforward to implement; PyTorch code for the DPO loss is provided below:
+
+import torch.nn.functional as F
+
+Appendix C
+
+Further Details on the Experimental Set-Up
+
+In this section, we include additional details relevant to our experimental design.
+
+C.1
+
+IMDb Sentiment Experiment and Baseline Details
+
+The prompts are prefixes from the IMDB dataset of length 2-8 tokens.
+
+C.2
+
+GPT-4 prompts for computing summarization and dialogue win rates
+
+A key component of our experimental setup is GPT-4 win rate judgments.
+
+C.3
+
+Unlikelihood baseline
+
+While we include the unlikelihood baseline
+
+Appendix D
+
+Additional Empirical Results
+
+D.1
+
+Performance of Best of
+
+N
+
+baseline for Various
+
+N
+
+We find that the Best of
+
+N
+
+baseline is a strong baseline in our experiments.

```

---

### Incident Patch 2: `9e7aadd9` (2026-10-05)
**Commit Message**: Fix citation_graph stale request metadata in cache (#290)

Closes #289

**File**: `src/arxiv_mcp_server/tools/citation_graph.py` (modified, +16/-8)
```diff
@@ -441,10 +441,15 @@ async def handle_citation_graph(arguments: Dict[str, Any]) -> List[types.TextCon
         # Check cache first
         cached = _load_cached_graph(bare_id, limit)
         if cached is not None:
-            # Restore requested version metadata if present
-            if requested_version is not None and "paper" in cached:
-                cached["paper"]["requested_arxiv_id"] = paper_id
-                cached["paper"]["requested_version"] = requested_version
+            # Add request-specific metadata to the response (not stored in cache)
+            if "paper" in cached:
+                if requested_version is not None:
+                    cached["paper"]["requested_arxiv_id"] = paper_id
+                    cached["paper"]["requested_version"] = requested_version
+                else:
+                    # Bare ID request: ensure no stale version fields
+                    cached["paper"].pop("requested_arxiv_id", None)
+                    cached["paper"].pop("requested_version", None)
             return [types.TextContent(type="text", text=json.dumps(cached, indent=2))]
 
         # Cache miss: fetch from S2 with a single API call
@@ -483,6 +488,7 @@ async def handle_citation_graph(arguments: Dict[str, Any]) -> List[types.TextCon
         citations = _normalize_paper_items(citations_raw[:limit])
         references = _normalize_paper_items(references_raw[:limit])
 
+        # Build paper metadata without request-specific fields
         paper_meta = {
             "paper_id": payload.get("paperId"),
             "arxiv_id": bare_id,
@@ -493,9 +499,6 @@ async def handle_citation_graph(arguments: Dict[str, Any]) -> List[types.TextCon
             ],
             "external_ids": payload.get("externalIds") or {},
         }
-        if requested_version is not None:
-            paper_meta["requested_arxiv_id"] = paper_id
-            paper_meta["requested_version"] = requested_version
 
         result = {
             "status": "success",
@@ -509,9 +512,14 @@ async def handle_citation_graph(arguments: Dict[str, Any]) -> List[types.TextCon
             "references": references,
         }
 
-        # Cache the successful result
+        # Cache the successful result (without request-specific metadata)
         _save_cached_graph(bare_id, limit, result)
 
+        # Add request-specific metadata to the response (not stored in cache)
+        if requested_version is not None:
+            result["paper"]["requested_arxiv_id"] = paper_id
+            result["paper"]["requested_version"] = requested_version
+
         return [types.TextContent(type="text", text=json.dumps(result, indent=2))]
 
     except SemanticScholarRateLimitError as exc:
```

**File**: `tests/tools/test_citation_graph.py` (modified, +162/-0)
```diff
@@ -750,3 +750,165 @@ async def mock_fetch_503_with_status(*args, **kwargs):
 
         # Clean up
         shutil.rmtree(cache_dir, ignore_errors=True)
+
+
+@pytest.mark.asyncio
+async def test_citation_graph_versioned_then_bare_cache_hit_metadata():
+    """Issue #289: Versioned request then bare-ID cache hit must not retain stale version fields."""
+    mock_client = _mock_async_client([_success_response()])
+
+    with (
+        patch("httpx.AsyncClient", return_value=mock_client),
+        patch.object(citation_graph_module, "_cache_dir") as mock_cache_dir,
+    ):
+        cache_dir = Path("/tmp/test_issue_289_versioned_bare")
+        shutil.rmtree(cache_dir, ignore_errors=True)
+        cache_dir.mkdir(parents=True, exist_ok=True)
+        mock_cache_dir.return_value = cache_dir
+
+        # First: fetch versioned ID
+        response1 = await handle_citation_graph(
+            {"paper_id": "2401.12345v1", "max_citations": 50}
+        )
+        payload1 = json.loads(response1[0].text)
+        assert payload1["status"] == "success"
+        assert payload1["paper"]["requested_arxiv_id"] == "2401.12345v1"
+        assert payload1["paper"]["requested_version"] == "v1"
+        assert mock_client.get.call_count == 1
+
+        # Second: fetch bare ID (cache hit)
+        response2 = await handle_citation_graph(
+            {"paper_id": "2401.12345", "max_citations": 10}
+        )
+        payload2 = json.loads(response2[0].text)
+        assert payload2["status"] == "success"
+        # Bare ID must NOT have version fields
+        assert "requested_arxiv_id" not in payload2["paper"]
+        assert "requested_version" not in payload2["paper"]
+        # Still a cache hit (no new API call)
+        assert mock_client.get.call_count == 1
+
+        # Clean up
+        shutil.rmtree(cache_dir, ignore_errors=True)
+
+
+@pytest.mark.asyncio
+async def test_citation_graph_versioned_cache_hit_different_version():
+    """Versioned → different-version cache hit must report the current requested version."""
+    mock_client = _mock_async_client([_success_response()])
+
+    with (
+        patch("httpx.AsyncClient", return_value=mock_client),
+        patch.object(citation_graph_module, "_cache_dir") as mock_cache_dir,
+    ):
+        cache_dir = Path("/tmp/test_issue_289_different_version")
+        shutil.rmtree(cache_dir, ignore_errors=True)
+        cache_dir.mkdir(parents=True, exist_ok=True)
+        mock_cache_dir.return_value = cache_dir
+
+        # First: fetch v1
+        response1 = await handle_citation_graph(
+            {"paper_id": "2401.12345v1", "max_citations": 50}
+        )
+        payload1 = json.loads(response1[0].text)
+        assert payload1["status"] == "success"
+        assert payload1["paper"]["requested_arxiv_id"] == "2401.12345v1"
+        assert payload1["paper"]["requested_version"] == "v1"
+        assert mock_client.get.call_count == 1
+
+        # Second: fetch v2 (cache hit, should update metadata)
+        response2 = await handle_citation_graph(
+            {"paper_id": "2401.12345v2", "max_citations": 10}
+        )
+        payload2 = json.loads(response2[0].text)
+        assert payload2["status"] == "success"
+        # v2 request must report v2, not stale v1
+        assert payload2["paper"]["requested_arxiv_id"] == "2401.12345v2"
+        assert payload2["paper"]["requested_version"] == "v2"
+        # Still a cache hit (no new API call)
+        assert mock_client.get.call_count == 1
+
+        # Clean up
+        shutil.rmtree(cache_dir, ignore_errors=True)
+
+
+@pytest.mark.asyncio
+async def test_citation_graph_bare_then_versioned_cache_hit_metadata():
+    """Bare ID → versioned request cache hit must add version fields correctly."""
+    mock_client = _mock_async_client([_success_response()])
+
+    with (
+        patch("httpx.AsyncClient", return_value=mock_client),
+        patch.object(citation_graph_module, "_cache_dir") as mock_cache_dir,
+    ):
+        cache_dir = Path("/tmp/test_issue_289_bare_versioned")
+        shutil.rmtree(cache_dir, ignore_errors=True)
+        cache_dir.mkdir(parents=True, exist_ok=True)
+        mock_cache_dir.return_value = cache_dir
+
+        # First: fetch bare ID
+        response1 = await handle_citation_graph(
+            {"paper_id": "2401.12345", "max_citations": 50}
+        )
+        payload1 = json.loads(response1[0].text)
+        assert payload1["status"] == "success"
+        # Bare ID must not have version fields
+        assert "requested_arxiv_id" not in payload1["paper"]
+        assert "requested_version" not in payload1["paper"]
+        assert mock_client.get.call_count == 1
+
+        # Second: fetch versioned ID (cache hit)
+        response2 = await handle_citation_graph(
+            {"paper_id": "2401.12345v3", "max_citations": 10}
+        )
+        payload2 = json.loads(response2[0].text)
+        assert payload2["status"] == "success"
+        # Versioned request must add version fi
```

---

### Incident Patch 3: `4e5c0bc1` (2026-10-05)
**Commit Message**: Fix three bugs from issue #284 (#285)

Fixes metadata deadline enforcement (socket timeout, watchdog, per-byte, Windows thread-abandon), restores arxiv_version for #206 downgrade protection, releases the rate-limit gate after request initiation, declares lxml/requests, and hardens the HTML outline sequence check.

Closes #284.

**File**: `pyproject.toml` (modified, +2/-0)
```diff
@@ -41,6 +41,8 @@ dependencies = [
     "starlette>=0.27.0",
     "sse-starlette>=1.8.2",
     "anyio>=4.2.0",
+    "lxml>=4.6.0",
+    "requests>=2.25.0",
 ]
 
 [project.urls]
```

**File**: `src/arxiv_mcp_server/arxiv_api.py` (modified, +33/-3)
```diff
@@ -16,6 +16,12 @@
 T = TypeVar("T")
 
 
+class GateTimeout(Exception):
+    """Raised when acquiring the rate limiter gate times out."""
+
+    pass
+
+
 class ArxivRateLimiter:
     """Serialize and space arXiv API requests across sync and async callers."""
 
@@ -47,14 +53,38 @@ def seconds_until_next_slot(self) -> float:
         """
         return self._remaining_delay()
 
-    def run_sync(self, operation: Callable[[], T]) -> T:
-        """Run a blocking operation inside the shared request gate."""
-        with self._lock:
+    def run_sync(self, operation: Callable[[], T], timeout: float | None = None) -> T:
+        """Run a blocking operation inside the shared request gate.
+
+        Args:
+            operation: Callable to execute inside the gate.
+            timeout: Optional timeout in seconds for gate acquisition. If the gate
+                cannot be acquired within this time, raises GateTimeout without
+                calling operation (preserving request spacing).
+
+        Returns:
+            Result of the operation.
+
+        Raises:
+            GateTimeout: If timeout is provided and gate acquisition times out.
+        """
+        acquired = self._lock.acquire(
+            blocking=True, timeout=timeout if timeout is not None else -1
+        )
+        if not acquired:
+            # Timeout expired waiting for gate - preserve rate limiting by not
+            # calling operation
+            raise GateTimeout(
+                f"Could not acquire rate limiter gate within {timeout}s timeout"
+            )
+        try:
             delay = self._remaining_delay()
             if delay:
                 self._sync_sleep(delay)
             self._last_started = self._clock()
             return operation()
+        finally:
+            self._lock.release()
 
     async def run_async(self, operation: Callable[[], Awaitable[T]]) -> T:
         """Run an async operation inside the same gate used by sync callers."""
```

**File**: `src/arxiv_mcp_server/config.py` (modified, +8/-1)
```diff
@@ -78,9 +78,16 @@ def get_arxiv_client(num_retries=None):
     session = getattr(client, "_session", None)
     if isinstance(session, requests.Session):
         _orig_get = session.get
+        settings = Settings()
 
         def _get_with_timeout(url, **kwargs):
-            kwargs.setdefault("timeout", (5.0, 30.0))
+            kwargs.setdefault(
+                "timeout",
+                (
+                    float(settings.ARXIV_CONNECT_TIMEOUT),
+                    float(settings.get_request_timeout()),
+                ),
+            )
             return _orig_get(url, **kwargs)
 
         session.get = _get_with_timeout
```

**File**: `src/arxiv_mcp_server/tools/alerts.py` (modified, +11/-2)
```diff
@@ -252,14 +252,23 @@ async def handle_watch_topic(arguments: Dict[str, Any]) -> List[types.TextConten
         if not topic:
             return [types.TextContent(type="text", text="Error: topic is required")]
 
-        max_results = min(int(arguments.get("max_results", 10)), settings.MAX_RESULTS)
-
         payload = _load_watches()
         topics = payload.get("topics", [])
         existing_index = next(
             (idx for idx, item in enumerate(topics) if item.get("topic") == topic), None
         )
 
+        # On update, only replace max_results when the key is present so omitted
+        # max_results preserves the stored cap. Apply default only on create.
+        if "max_results" in arguments:
+            max_results = min(
+                int(arguments.get("max_results", 10)), settings.MAX_RESULTS
+            )
+        elif existing_index is not None:
+            max_results = topics[existing_index].get("max_results", 10)
+        else:
+            max_results = 10
+
         # On update, only replace categories when the key is present so omitted
         # categories preserve the stored filters. Explicit [] still clears.
         if "categories" in arguments:
```

**File**: `src/arxiv_mcp_server/tools/download.py` (modified, +436/-9)
```diff
@@ -1140,14 +1140,430 @@ def _metadata_from_arxiv_result(paper_id: str, paper) -> dict[str, Any]:
     }
 
 
-def _fetch_arxiv_metadata(paper_id: str) -> dict[str, Any] | None:
-    """Best-effort arXiv metadata lookup used after an HTML download."""
+def _fetch_arxiv_metadata(
+    paper_id: str, deadline: float | None = None
+) -> dict[str, Any] | None:
+    """Best-effort arXiv metadata lookup used after an HTML download.
+
+    Makes a direct GET to the arXiv API with streaming, a wall-clock watchdog
+    timer, and per-chunk deadline checks. The rate limiter gate is released
+    after the request is sent (headers received), so slow body reads don't
+    block other arXiv operations. Metadata is optional: on deadline or error,
+    returns None without failing the download.
+
+    Args:
+        paper_id: arXiv paper ID.
+        deadline: Optional wall-clock deadline (time.monotonic()). When provided,
+                  enforces the remaining budget across gate acquisition, request
+                  connect, and streaming read with both per-chunk checks and a
+                  watchdog timer.
+    """
+    import requests
+    from datetime import datetime
+
     try:
-        client = get_arxiv_client()
-        paper = ARXIV_RATE_LIMITER.run_sync(
-            lambda: next(client.results(arxiv.Search(id_list=[paper_id])))
-        )
-        return _metadata_from_arxiv_result(paper_id, paper)
+        # Check if we have enough time budget remaining before attempting gate acquisition.
+        # The pre-gate check uses seconds_until_next_slot() which is advisory (unlocked),
+        # so the actual gate wait could be longer if another request starts. Worst case:
+        # another request acquires the gate just after our check, so we wait up to
+        # min_interval (3s). The post-gate recheck below skips if that causes overrun.
+        if deadline is not None:
+            pending_wait = ARXIV_RATE_LIMITER.seconds_until_next_slot()
+            remaining = deadline - time.monotonic()
+            min_attempt_time = 1.0
+            # Also check gate timeout if available
+            gate_timeout = max(0.0, remaining - min_attempt_time)
+            if remaining < pending_wait + min_attempt_time:
+                logger.info(
+                    "Metadata lookup skipped: insufficient time budget "
+                    f"(need {pending_wait + min_attempt_time:.1f}s, have {remaining:.1f}s)"
+                )
+                return None
+        else:
+            gate_timeout = None
+
+        # Acquire the rate limiter gate and send the request.
+        # The gate is released after headers arrive, before body read.
+        # No retries: exactly 1 request. On 406, return None (issue #277: IP throttling).
+        def initiate_request():
+            if deadline is not None:
+                remaining = deadline - time.monotonic()
+                if remaining < 1.0:
+                    logger.info(
+                        f"Metadata lookup skipped: deadline exceeded after gate wait "
+                        f"(remaining: {remaining:.1f}s)"
+                    )
+                    return None
+
+            # Direct GET to export API with streaming and clamped timeouts
+            url = f"https://export.arxiv.org/api/query?id_list={paper_id}"
+            headers = {
+                "User-Agent": f"arxiv-mcp-server/{settings.APP_VERSION or '0.8.0'}"
+            }
+            timeout_tuple = None
+            if deadline is not None:
+                remaining = deadline - time.monotonic()
+                if remaining < 0.5:
+                    logger.info("Metadata lookup skipped: deadline before request")
+                    return None
+                # Clamp connect and read timeouts to remaining budget
+                timeout_tuple = (
+                    min(float(settings.ARXIV_CONNECT_TIMEOUT), remaining),
+                    min(float(settings.get_request_timeout()), remaining),
+                )
+            else:
+                timeout_tuple = (
+                    float(settings.ARXIV_CONNECT_TIMEOUT),
+                    float(settings.get_request_timeout()),
+                )
+
+            try:
+                response = requests.get(
+                    url, headers=headers, stream=True, timeout=timeout_tuple
+                )
+
+                # On 406, return None immediately (issue #277: IP throttling, no retry)
+                if response.status_code == 406:
+                    logger.info(f"Metadata lookup rate limited (406) for {paper_id}")
+                    response.close()
+                    return None
+
+                response.raise_for_status()
+                # Gate released here (request sent, headers received)
+                return response
+            except requests.exceptions.Timeout:
+                logger.info(
+                    f"Metadata request timed out (connect/headers) for {paper_id}"
+                )
+      
```

**File**: `src/arxiv_mcp_server/tools/paper_outline.py` (modified, +196/-12)
```diff
@@ -44,8 +44,8 @@
 # Heading styles seen in arXiv markdown (ATX, numbered, bare HTML titles).
 _ATX_HEADING_RE = re.compile(r"^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$")
 _NUMBERED_HEADING_RE = re.compile(r"^(\d+(?:\.\d+){0,5})[ \t]+(.+?)[ \t]*$")
-# HTML→text often emits the section number alone ("3." / "3.1.") then the title.
-_NUMBER_ONLY_RE = re.compile(r"^(\d+(?:\.\d+){0,5})\.[ \t]*$")
+# HTML→text often emits the section number alone ("3." / "3.1." / "2.2") then the title.
+_NUMBER_ONLY_RE = re.compile(r"^(\d+(?:\.\d+){0,5})\.?[ \t]*$")
 # IEEE/latexml HTML often splits roman section tags onto their own line:
 # ``I`` / ``Introduction``, ``II-A`` / ``Related Work``. Longer numerals first.
 _ROMAN_NUMERAL = (
@@ -239,12 +239,24 @@ def _is_title_case_phrase(title: str) -> bool:
     return True
 
 
-def _title_looks_like_heading(title: str, *, line_len: int) -> bool:
+def _title_looks_like_heading(
+    title: str,
+    *,
+    line_len: int,
+    allow_sentence_case: bool = False,
+    apply_content_guards: bool = True,
+) -> bool:
     """Shared capitalization / length / venue guards for numbered headings.
 
     Rejects numbered body-list items (e.g. Future Work ``4.`` / ``5.`` prose)
     that HTML→text otherwise promotes to fake L1 sections. Does not use fuzzy
     title matching against known section names.
+
+    Args:
+        title: The heading title text to check.
+        line_len: Length of the full line including the number.
+        allow_sentence_case: If True, skip Title Case check (for split numbers).
+        apply_content_guards: If True, apply % / = / : guards (for split numbers only).
     """
     title = title.strip()
     if not title or line_len > _MAX_BARE_TITLE_CHARS:
@@ -255,22 +267,76 @@ def _title_looks_like_heading(title: str, *, line_len: int) -> bool:
     # Citation venues often look like "USENIX ATC 23" after a year number.
     if re.search(r"\b(?:19|20)\d{2}\b", title):
         return False
+    # Reject table/figure/data lines (regression #284 blocker 2).
+    # Data lines have % or =, or : followed by digits/special chars.
+    # Only apply these guards to split numbers, not inline numbered headings.
+    if apply_content_guards:
+        if re.search(r"[%=]", title):
+            return False
+        if re.search(r":\s*[\d.-]", title):
+            return False
+        # Reject model names with common ML naming patterns.
+        # Examples: "Mixtral 8x7B", "Llama-3.1-405B", "GPT-4", "Claude 3.5", "Phi-3.5 MoE"
+        # Pattern 1: NxM (expert notation like 8x7B)
+        if re.search(r"\d+x\d+[BM]?", title, re.IGNORECASE):
+            return False
+        # Pattern 2: Ends with B or M (parameter count like 405B, 7B)
+        if re.search(r"\d+[BM]\b", title):
+            return False
+        # Pattern 3: Name-digits.digits pattern (like "Phi-3.5", "GPT-4.5", "Claude-3.5")
+        if re.search(r"[A-Z][a-z]*-\d+\.\d+", title):
+            return False
+        # Pattern 4: Bare model architecture acronyms as titles (MoE, GPT, LLM alone)
+        if re.match(r"^(?:MoE|GPT|LLM|BERT|T5)$", title):
+            return False
+        # Pattern 5: Table comparison labels (Ours, Theirs, Baseline, Previous)
+        if re.match(r"^(?:Ours|Theirs|Baseline|Previous)$", title, re.IGNORECASE):
+            return False
+        # Reject very short tokens that look like table cells or model names.
+        if len(title) < 3:
+            return False
+    # Reject common table/figure/algorithm prefixes.
+    if re.match(
+        r"^(?:Table|Figure|Fig\.|Algorithm|Eq\.|Equation|Appendix)\s+\d",
+        title,
+        re.IGNORECASE,
+    ):
+        return False
     normalized = _normalize_heading_title(title)
     # Full-sentence list items end with ``.``; allow only known bare titles
     # such as ``Abstract.`` / ``Introduction.``.
     if title.endswith(".") and normalized.casefold() not in _BARE_SECTION_TITLES:
         return False
     # Headings are Title Case noun phrases; body lists are sentence case.
-    if not _is_title_case_phrase(normalized):
+    # For split numbers (e.g. "2.2\nKAN architecture"), allow sentence case.
+    if not allow_sentence_case and not _is_title_case_phrase(normalized):
         return False
     return True
 
 
 def _numbered_heading(
-    numbering: str, title: str, *, line_len: int
+    numbering: str,
+    title: str,
+    *,
+    line_len: int,
+    allow_sentence_case: bool = False,
+    apply_content_guards: bool = True,
 ) -> tuple[int, str] | None:
-    """Return (level, title) for a plausible numbered heading, else None."""
-    if not _title_looks_like_heading(title, line_len=line_len):
+    """Return (level, title) for a plausible numbered heading, else None.
+
+    Args:
+        numbering: The section number (e.g. "2.2").
+        title: The heading title text.
+        line_len: Length of the full line including the number.
+        allow_sentence_case: If True, skip Title Case check (for split numbers).
+        a
```

**File**: `test_mutations.sh` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+#!/bin/bash
+set -e
+cd /workspace
+
+echo "=== MUTATION TABLE ==="
+echo ""
+echo "Testing each mechanism alone by removing (skipping) the other mechanisms..."
+echo ""
+
+# Helper function to run a test with env vars and capture result
+run_test() {
+    local test_name="$1"
+    local env_vars="$2"
+    local expected_result="$3"  # "PASS" or "FAIL"
+    
+    echo -n "Testing: $test_name ... "
+    
+    set +e
+    if [ -z "$env_vars" ]; then
+        timeout 30 uv run pytest "tests/tools/test_metadata_deadline_integration.py::$test_name" -q --tb=no > /tmp/mutation_output.txt 2>&1
+    else
+        timeout 30 env $env_vars uv run pytest "tests/tools/test_metadata_deadline_integration.py::$test_name" -q --tb=no > /tmp/mutation_output.txt 2>&1
+    fi
+    result=$?
+    set -e
+    
+    if [ $result -eq 0 ]; then
+        actual="PASS"
+    else
+        actual="FAIL"
+    fi
+    
+    if [ "$actual" = "$expected_result" ]; then
+        echo "✓ $actual (expected $expected_result)"
+    else
+        echo "✗ $actual (expected $expected_result)"
+        echo "Output:"
+        cat /tmp/mutation_output.txt | tail -10
+    fi
+    
+    # Extract timing if available
+    timing=$(grep -o "took [0-9.]*s" /tmp/mutation_output.txt | head -1 || echo "")
+    if [ -n "$timing" ]; then
+        echo "  Timing: $timing"
+    fi
+    
+    return 0
+}
+
+echo "## 1. Socket timeout mechanism alone"
+echo "Baseline (all three mechanisms enabled):"
+run_test "test_socket_timeout_mechanism_alone_enforces_deadline" "" "PASS"
+
+echo ""
+echo "Mutation: Remove socket timeout (skip it):"
+run_test "test_socket_timeout_mechanism_alone_enforces_deadline" "_ARXIV_MCP_TEST_SKIP_SOCKET_TIMEOUT=1" "FAIL"
+
+echo ""
+echo "## 2. Watchdog mechanism alone"
+echo "Baseline (all three mechanisms enabled):"
+run_test "test_watchdog_mechanism_alone_enforces_deadline" "" "PASS"
+
+echo ""
+echo "Mutation: Remove watchdog (skip it):"
+run_test "test_watchdog_mechanism_alone_enforces_deadline" "_ARXIV_MCP_TEST_SKIP_WATCHDOG=1" "FAIL"
+
+echo ""
+echo "## 3. Per-byte check mechanism alone"
+echo "Baseline (all three mechanisms enabled):"
+run_test "test_per_byte_check_alone_enforces_deadline" "" "PASS"
+
+echo ""
+echo "Mutation: Remove per-byte check (skip it):"
+run_test "test_per_byte_check_alone_enforces_deadline" "_ARXIV_MCP_TEST_SKIP_PERBYTE_CHECK=1" "FAIL"
+
+echo ""
+echo "## 4. Socket unavailable fallback (thread backstop)"
+echo "Baseline (thread backstop enabled):"
+run_test "test_socket_unavailable_fallback_within_deadline" "" "PASS"
+
+echo ""
+echo "Mutation: Remove thread backstop (skip it):"
+run_test "test_socket_unavailable_fallback_within_deadline" "_ARXIV_MCP_TEST_SKIP_THREAD_BACKSTOP=1" "FAIL"
+
+echo ""
+echo "## 5. All three mechanisms disabled (should stall)"
+echo "Test socket timeout with all disabled:"
+run_test "test_socket_timeout_mechanism_alone_enforces_deadline" "_ARXIV_MCP_TEST_SKIP_SOCKET_TIMEOUT=1 _ARXIV_MCP_TEST_SKIP_WATCHDOG=1 _ARXIV_MCP_TEST_SKIP_PERBYTE_CHECK=1" "FAIL"
+
+echo ""
+echo "=== MUTATION TABLE COMPLETE ==="
```

**File**: `tests/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+"""Tests for arxiv-mcp-server."""
```

---

### Incident Patch 4: `a0761392` (2026-10-03)
**Commit Message**: Fix timeout/retry handling with budget enforcement and deadline checks (#282)

Per-call time budget (ARXIV_MAX_TOTAL_TIME, default 50s), unified retry/backoff honoring Retry-After, deadline checks while streaming, HTTP 406 kept as rate_limited (#277). Refs #281.

**File**: `.github/workflows/tests.yml` (modified, +13/-0)
```diff
@@ -32,23 +32,36 @@ jobs:
           version: "0.11.30"
           enable-cache: true
 
+      - name: Install Python version for uv
+        run: uv python install ${{ matrix.python-version }}
+
       - name: Install locked test environment
         run: uv sync --locked --extra test
+        env:
+          UV_PYTHON: ${{ matrix.python-version }}
 
       - name: Resolve optional extras from binary wheels
         run: >-
           uv pip compile pyproject.toml --extra pdf --extra pro
           --only-binary :all:
           --output-file "${{ runner.temp }}/arxiv-extras.txt"
+        env:
+          UV_PYTHON: ${{ matrix.python-version }}
 
       - name: Run tests
         run: uv run pytest --cov-report=xml
+        env:
+          UV_PYTHON: ${{ matrix.python-version }}
 
       - name: Build candidate wheel
         run: uv build --wheel --out-dir dist
+        env:
+          UV_PYTHON: ${{ matrix.python-version }}
 
       - name: Smoke-test installed wheel over MCP
         run: uv run python scripts/smoke_installed_wheel.py
+        env:
+          UV_PYTHON: ${{ matrix.python-version }}
 
   docker-smoke:
     runs-on: ubuntu-latest
```

**File**: `README.md` (modified, +8/-1)
```diff
@@ -458,7 +458,14 @@ The server binds to `127.0.0.1` by default and enables MCP DNS-rebinding protect
 |---|---:|---|
 | `--storage-path` | `~/.arxiv-mcp-server/papers` | Paper, source-cache, alert, and index storage |
 | `MAX_RESULTS` | `50` | Server-side cap for result counts |
-| `REQUEST_TIMEOUT` | `60` | PDF fallback download timeout in seconds |
+| `ARXIV_REQUEST_TIMEOUT` | `30` | Per-attempt read timeout in seconds for all arXiv requests (API, HTML, PDF, LaTeX). Values ≤ 0 fall back to default. |
+| `REQUEST_TIMEOUT` | – | **Deprecated.** Legacy alias for `ARXIV_REQUEST_TIMEOUT` (applies to all requests). Only used when `ARXIV_REQUEST_TIMEOUT` is not set. Effective default: 30s. Values ≤ 0 fall back to default. |
+| `ARXIV_CONNECT_TIMEOUT` | `10` | Connection timeout in seconds for all arXiv requests. Values ≤ 0 fall back to default. |
+| `ARXIV_MAX_TOTAL_TIME` | `50` | Total budget in seconds for each tool call (HTML + PDF combined for `download_paper`). Values ≤ 0 fall back to default. **Note**: Very small budgets (under ~6s) may leave insufficient time for HTML-to-PDF fallback due to the process-wide 3s rate-limiter delay. |
+| `ARXIV_MAX_RETRIES` | `2` | Maximum retry attempts for transient failures (timeouts, connections, 429, 503) |
+| `ARXIV_HTTP_406_MAX_RETRIES` | `1` | Maximum retry attempts for HTTP 406 (IP-level throttling, use minimal retries) |
+| `ARXIV_INITIAL_BACKOFF` | `2.0` | Initial exponential backoff delay in seconds |
+| `ARXIV_MAX_BACKOFF` | `30` | Maximum backoff delay in seconds (Retry-After can exceed this and causes immediate rate_limited return). Values ≤ 0 fall back to default. |
 | `TRANSPORT` | `stdio` | `stdio`, `http`, or `streamable-http` |
 | `HOST` | `127.0.0.1` | HTTP bind host |
 | `PORT` | `8000` | HTTP bind port |
```

**File**: `src/arxiv_mcp_server/arxiv_api.py` (modified, +627/-86)
```diff
@@ -1,15 +1,18 @@
 """Shared compatibility helpers for the upstream arxiv package."""
 
 import asyncio
+import logging
 import os
 from pathlib import Path
+import random
 import tempfile
 import threading
 import time
 from typing import Awaitable, Callable, Protocol, TypeVar
 
 import httpx
 
+logger = logging.getLogger("arxiv-mcp-server")
 T = TypeVar("T")
 
 
@@ -36,6 +39,14 @@ def _remaining_delay(self) -> float:
             return 0.0
         return max(0.0, self.min_interval - (self._clock() - self._last_started))
 
+    def seconds_until_next_slot(self) -> float:
+        """Return seconds until the next request slot is available.
+
+        Returns 0.0 if a slot is immediately available.
+        This does not acquire the lock, so the value is advisory.
+        """
+        return self._remaining_delay()
+
     def run_sync(self, operation: Callable[[], T]) -> T:
         """Run a blocking operation inside the shared request gate."""
         with self._lock:
@@ -62,6 +73,399 @@ async def run_async(self, operation: Callable[[], Awaitable[T]]) -> T:
 ARXIV_RATE_LIMITER = ArxivRateLimiter()
 
 
+class RetryableError(Exception):
+    """Base class for errors that should trigger a retry."""
+
+    pass
+
+
+class ArxivTimeoutError(RetryableError):
+    """Raised when an arXiv request times out."""
+
+    pass
+
+
+class ArxivConnectionError(RetryableError):
+    """Raised when a connection to arXiv fails."""
+
+    pass
+
+
+class ArxivRateLimitError(RetryableError):
+    """Raised when arXiv returns rate-limiting status (429, 503, 406)."""
+
+    def __init__(
+        self,
+        message: str,
+        *,
+        status_code: int = 429,
+        retry_after_seconds: float | None = None,
+    ) -> None:
+        super().__init__(message)
+        self.status_code = status_code
+        self.retry_after_seconds = retry_after_seconds
+
+
+def _parse_retry_after_seconds(retry_after: str | None) -> float | None:
+    """Parse Retry-After header into seconds.
+
+    Supports both delay-seconds (integer) and HTTP-date formats.
+    Returns None if unparseable or not provided.
+    """
+    if not retry_after:
+        return None
+    try:
+        # Try as integer/float seconds first
+        return float(retry_after)
+    except ValueError:
+        pass
+
+    # Try as HTTP-date (RFC 7231)
+    try:
+        from email.utils import parsedate_to_datetime
+        import datetime
+
+        retry_dt = parsedate_to_datetime(retry_after)
+        now = datetime.datetime.now(datetime.timezone.utc)
+        delta = (retry_dt - now).total_seconds()
+        return max(0.0, delta)  # Don't return negative
+    except Exception:
+        logger.warning(f"Could not parse Retry-After header: {retry_after}")
+        return None
+
+
+def _compute_backoff_seconds(
+    attempt: int,
+    retry_after: str | None,
+    initial_backoff: float,
+    max_backoff: float,
+) -> float:
+    """Exponential backoff with jitter, with Retry-After as floor.
+
+    Args:
+        attempt: Zero-based retry attempt number.
+        retry_after: Optional Retry-After header value (int or HTTP-date).
+        initial_backoff: Initial backoff delay in seconds.
+        max_backoff: Maximum backoff delay in seconds.
+
+    Returns:
+        Computed backoff delay in seconds with jitter (0.5-1.5x) applied.
+        Retry-After (if provided) is used as a strict floor before and after jitter,
+        and is NOT capped to max_backoff.
+    """
+    # Compute exponential backoff with cap
+    delay = min(initial_backoff * (2**attempt), max_backoff)
+
+    # Parse Retry-After and apply as floor before jitter
+    parsed_retry_after = _parse_retry_after_seconds(retry_after)
+    if parsed_retry_after is not None:
+        delay = max(delay, parsed_retry_after)
+
+    # Apply jitter (0.5 to 1.5x multiplier)
+    jittered = delay * (0.5 + random.random())
+
+    # Ensure jitter never shortens the Retry-After floor
+    if parsed_retry_after is not None:
+        jittered = max(jittered, parsed_retry_after)
+
+    # Don't cap to max_backoff if Retry-After was higher
+    if parsed_retry_after is not None and parsed_retry_after > max_backoff:
+        return jittered
+    return min(jittered, max_backoff)
+
+
+async def retry_with_backoff(
+    operation: Callable[[], Awaitable[T]],
+    *,
+    max_retries: int = 3,
+    initial_backoff: float = 2.0,
+    max_backoff: float = 60.0,
+    max_total_time: float | None = None,
+    operation_name: str = "operation",
+) -> T:
+    """Execute an async operation with exponential backoff on retryable errors.
+
+    Retries on:
+    - httpx.TimeoutException
+    - httpx.ConnectError, httpx.ConnectTimeout, httpx.NetworkError
+    - httpx.HTTPStatusError with status 429, 503, 406
+
+    Note: HTTP 406 uses minimal retries (ARXIV_HTTP_406_MAX_RETRIES = 1)
+    because arXiv's 406 is IP-level burst throttling and retrying inside
+    the window extends the block (#277).
+
+    Args:
+        operation
```

**File**: `src/arxiv_mcp_server/config.py` (modified, +76/-1)
```diff
@@ -110,7 +110,14 @@ class Settings(BaseSettings):
     APP_VERSION: str = _PACKAGE_VERSION
     MAX_RESULTS: int = 50
     BATCH_SIZE: int = 20
-    REQUEST_TIMEOUT: int = 60
+    REQUEST_TIMEOUT: int = 60  # Deprecated: use ARXIV_REQUEST_TIMEOUT
+    ARXIV_REQUEST_TIMEOUT: int = 30
+    ARXIV_CONNECT_TIMEOUT: int = 10
+    ARXIV_MAX_RETRIES: int = 2
+    ARXIV_HTTP_406_MAX_RETRIES: int = 1
+    ARXIV_INITIAL_BACKOFF: float = 2.0
+    ARXIV_MAX_BACKOFF: float = 30.0
+    ARXIV_MAX_TOTAL_TIME: int = 50
     TRANSPORT: str = "stdio"
     HOST: str = "127.0.0.1"
     PORT: int = 8000
@@ -119,6 +126,74 @@ class Settings(BaseSettings):
     SEMANTIC_SCHOLAR_API_KEY: str = ""
     model_config = SettingsConfigDict(extra="allow")
 
+    def model_post_init(self, __context) -> None:
+        """Validate timeout settings after initialization."""
+        # Only log validation warnings once per process
+        if not hasattr(Settings, "_validation_logged"):
+            Settings._validation_logged = False
+
+        if Settings._validation_logged:
+            # Still validate but don't log again
+            if self.ARXIV_REQUEST_TIMEOUT <= 0:
+                self.ARXIV_REQUEST_TIMEOUT = 30
+            if self.ARXIV_CONNECT_TIMEOUT <= 0:
+                self.ARXIV_CONNECT_TIMEOUT = 10
+            if self.ARXIV_MAX_TOTAL_TIME <= 0:
+                self.ARXIV_MAX_TOTAL_TIME = 50
+            if self.ARXIV_MAX_BACKOFF <= 0:
+                self.ARXIV_MAX_BACKOFF = 30.0
+            return
+
+        Settings._validation_logged = True
+
+        # Validate positive timeouts
+        if self.ARXIV_REQUEST_TIMEOUT <= 0:
+            logger.warning(
+                f"ARXIV_REQUEST_TIMEOUT must be positive (got {self.ARXIV_REQUEST_TIMEOUT}), using default 30"
+            )
+            self.ARXIV_REQUEST_TIMEOUT = 30
+        if self.ARXIV_CONNECT_TIMEOUT <= 0:
+            logger.warning(
+                f"ARXIV_CONNECT_TIMEOUT must be positive (got {self.ARXIV_CONNECT_TIMEOUT}), using default 10"
+            )
+            self.ARXIV_CONNECT_TIMEOUT = 10
+        if self.ARXIV_MAX_TOTAL_TIME <= 0:
+            logger.warning(
+                f"ARXIV_MAX_TOTAL_TIME must be positive (got {self.ARXIV_MAX_TOTAL_TIME}), using default 50"
+            )
+            self.ARXIV_MAX_TOTAL_TIME = 50
+        if self.ARXIV_MAX_BACKOFF <= 0:
+            logger.warning(
+                f"ARXIV_MAX_BACKOFF must be positive (got {self.ARXIV_MAX_BACKOFF}), using default 30"
+            )
+            self.ARXIV_MAX_BACKOFF = 30.0
+
+    def get_request_timeout(self) -> int:
+        """Get request timeout with fallback to legacy REQUEST_TIMEOUT.
+
+        Returns ARXIV_REQUEST_TIMEOUT if explicitly set (case-insensitive),
+        otherwise falls back to REQUEST_TIMEOUT (case-insensitive) for
+        backward compatibility. Non-positive values clamp to default 30.
+        """
+        # Check if ARXIV_REQUEST_TIMEOUT was explicitly set (case-insensitive)
+        import os
+
+        env_keys = {k.upper(): k for k in os.environ.keys()}
+
+        if "ARXIV_REQUEST_TIMEOUT" in env_keys:
+            return self.ARXIV_REQUEST_TIMEOUT
+        # Fall back to REQUEST_TIMEOUT if it was explicitly set (case-insensitive)
+        if "REQUEST_TIMEOUT" in env_keys:
+            # Validate legacy value the same way as ARXIV_REQUEST_TIMEOUT
+            if self.REQUEST_TIMEOUT <= 0:
+                logger.warning(
+                    f"REQUEST_TIMEOUT must be positive (got {self.REQUEST_TIMEOUT}), using default 30"
+                )
+                return 30
+            return self.REQUEST_TIMEOUT
+        # Use ARXIV_REQUEST_TIMEOUT default
+        return self.ARXIV_REQUEST_TIMEOUT
+
     @property
     def STORAGE_PATH(self) -> Path:
         """Get the resolved storage path and ensure it exists.
```

**File**: `src/arxiv_mcp_server/tools/citation_graph.py` (modified, +97/-40)
```diff
@@ -5,7 +5,6 @@
 import asyncio
 import json
 import logging
-import random
 import time
 from pathlib import Path
 from typing import Any, Dict, List
@@ -16,6 +15,7 @@
 from mcp.types import ToolAnnotations
 
 from ..config import Settings
+from ..arxiv_api import retry_with_backoff
 from .arxiv_ids import (
     arxiv_version_suffix,
     bare_arxiv_id,
@@ -48,9 +48,6 @@
     "This is NOT an empty graph—the API blocked the request. "
     "Wait and retry, or reduce max_citations."
 )
-_MAX_RETRIES = 5
-_INITIAL_BACKOFF_SECONDS = 2.0
-_MAX_BACKOFF_SECONDS = 60.0
 # Cache citation graphs on disk to reduce repeated S2 calls. Rate-limited results
 # expire quickly; successful graphs persist longer.
 CACHE_TTL_SUCCESS_SECONDS = 7 * 24 * 3600  # 7 days
@@ -149,26 +146,32 @@ def _rate_limited_payload(
     *,
     arxiv_id: str | None = None,
     max_citations: int | None = None,
+    message: str | None = None,
+    status_code: int | None = None,
 ) -> Dict[str, Any]:
     """Soft rate-limit result so callers can continue without a hard tool error."""
     payload: Dict[str, Any] = {
         "status": "rate_limited",
         "error": "RATE_LIMITED",
-        "message": _rate_limit_message(),
-        "warning": "This is NOT an empty citation graph. The API request was blocked by rate limiting.",
+        "message": message if message is not None else _rate_limit_message(),
         "citation_count": 0,
         "reference_count": 0,
         "citations": [],
         "references": [],
     }
+    # Only include warning and hint for non-503 errors (quota/throttling, not service unavailable)
+    if status_code != 503:
+        payload["warning"] = (
+            "This is NOT an empty citation graph. The API request was blocked by rate limiting."
+        )
+        if not _has_api_key():
+            payload["hint"] = (
+                "Get a free API key at https://www.semanticscholar.org/product/api#api-key and set SEMANTIC_SCHOLAR_API_KEY"
+            )
     if arxiv_id is not None:
         payload["arxiv_id"] = arxiv_id
     if max_citations is not None:
         payload["max_citations"] = max_citations
-    if not _has_api_key():
-        payload["hint"] = (
-            "Get a free API key at https://www.semanticscholar.org/product/api#api-key and set SEMANTIC_SCHOLAR_API_KEY"
-        )
     return payload
 
 
@@ -292,34 +295,57 @@ def _save_cached_graph(
         logger.warning("Failed to cache citation graph to %s: %s", cache_file.name, exc)
 
 
-def _backoff_seconds(attempt: int, retry_after: str | None) -> float:
-    """Exponential backoff with jitter, honoring numeric Retry-After when present."""
-    delay = min(_INITIAL_BACKOFF_SECONDS * (2**attempt), _MAX_BACKOFF_SECONDS)
-    if retry_after:
-        try:
-            delay = min(max(delay, float(retry_after)), _MAX_BACKOFF_SECONDS)
-        except ValueError:
-            pass
-    # Full-ish jitter keeps concurrent clients from retrying in lockstep.
-    jittered = delay * (0.5 + random.random())
-    return min(jittered, _MAX_BACKOFF_SECONDS)
-
-
 async def _s2_get(
     client: httpx.AsyncClient, url: str, params: Dict[str, Any] | None = None
 ) -> httpx.Response:
-    """GET a Semantic Scholar URL, retrying with backoff on HTTP 429."""
-    for attempt in range(_MAX_RETRIES + 1):
+    """GET a Semantic Scholar URL with retry on HTTP 429 and timeout/connection errors.
+
+    Uses the unified retry_with_backoff infrastructure for consistency.
+    """
+
+    async def request() -> httpx.Response:
         response = await client.get(url, params=params, headers=_s2_headers())
-        if response.status_code != 429:
-            response.raise_for_status()
-            return response
-        if attempt == _MAX_RETRIES:
-            break
-        wait = _backoff_seconds(attempt, response.headers.get("Retry-After"))
-        logger.warning("Semantic Scholar 429 on %s; retrying in %.1fs", url, wait)
-        await asyncio.sleep(wait)
-    raise SemanticScholarRateLimitError(_rate_limit_message())
+        response.raise_for_status()
+        return response
+
+    try:
+        return await retry_with_backoff(
+            request,
+            max_retries=settings.ARXIV_MAX_RETRIES,
+            initial_backoff=settings.ARXIV_INITIAL_BACKOFF,
+            max_backoff=settings.ARXIV_MAX_BACKOFF,
+            max_total_time=float(settings.ARXIV_MAX_TOTAL_TIME),
+            operation_name="Semantic Scholar API request",
+        )
+    except Exception as e:
+        # Convert arXiv-prefixed errors to Semantic Scholar equivalents for this tool
+        from ..arxiv_api import (
+            ArxivRateLimitError,
+            ArxivTimeoutError,
+            ArxivConnectionError,
+        )
+
+        if isinstance(e, ArxivRateLimitError):
+            # Provide accurate message based on status code
+            if e.status_code == 503:
+                # 503 is service unavailable, not quota
+                message = (
+                  
```

**File**: `src/arxiv_mcp_server/tools/download.py` (modified, +293/-63)
```diff
@@ -5,15 +5,23 @@
 import json
 import asyncio
 import httpx
+import random
 import requests
+import time
 from html.parser import HTMLParser
 import re
 from pathlib import Path
 from typing import Dict, Any, List
 import mcp.types as types
 from mcp.types import ToolAnnotations
 from ..config import Settings, get_arxiv_client
-from ..arxiv_api import ARXIV_RATE_LIMITER, stream_pdf_to_path
+from ..arxiv_api import (
+    ARXIV_RATE_LIMITER,
+    stream_pdf_to_path,
+    ArxivRateLimitError,
+    ArxivTimeoutError,
+    retry_with_backoff,
+)
 from .content import add_content_payload, CONTENT_WARNING
 from .arxiv_ids import (
     arxiv_version_number,
@@ -29,7 +37,6 @@
     ARXIV_API_URL,
     ARXIV_NS,
     _rate_limited_get,
-    ArxivRateLimitError,
     _rate_limited_response,
 )
 import logging
@@ -756,96 +763,277 @@ def _wants_force_refresh(arguments: Dict[str, Any]) -> bool:
 # ---------------------------------------------------------------------------
 
 
-def _fetch_html_content(paper_id: str) -> str | None:
-    """Try to get paper content from the arXiv HTML endpoint.
+def _fetch_html_content(paper_id: str, deadline: float) -> str | None:
+    """Try to get paper content from the arXiv HTML endpoint (sync wrapper).
 
-    Returns the extracted text on success, or None if the HTML endpoint
-    is not available (404 or other non-200 status).
+    This function is called via asyncio.to_thread() from async code, so it runs
+    in a worker thread. Rate limiter lock acquired per attempt, not held through sleeps.
+
+    Args:
+        paper_id: arXiv paper ID.
+        deadline: Wall-clock deadline (time.monotonic()) for the entire download_paper operation.
 
-    Raises ArxivRateLimitError on 406 (throttling) so the caller can
-    handle it as rate limiting, not missing HTML (issue #277).
-    Honors Retry-After header when present.
+    Returns:
+        HTML text content on success, None if HTML is unavailable or budget exhausted.
     """
-    from .search import ArxivRateLimitError, _HTTP_406_RETRY_AFTER_SECONDS
+    import random
 
-    url = f"https://arxiv.org/html/{paper_id}"
-    try:
-        response = httpx.get(url, timeout=30, follow_redirects=True)
-        if response.status_code == 200:
-            logger.info(f"HTML fetch succeeded for {paper_id}")
-            return _html_to_text(response.text)
-        if response.status_code == 406:
-            # Throttling, not missing HTML (issue #277)
-            # Honor Retry-After header if present
-            retry_after = _HTTP_406_RETRY_AFTER_SECONDS
-            retry_after_header = response.headers.get("Retry-After")
-            if retry_after_header:
-                try:
-                    retry_after = float(retry_after_header)
-                except ValueError:
-                    pass
+    # Retry loop is outside rate limiter so lock is released during sleeps
+    last_exception: Exception | None = None
 
-            message = (
-                f"arXiv is rate limiting this IP (HTTP 406). "
-                f"Please wait {int(retry_after)} seconds before retrying."
+    def remaining_time() -> float:
+        return max(0.0, deadline - time.monotonic())
+
+    for attempt in range(settings.ARXIV_MAX_RETRIES + 1):
+        # Check budget before attempt
+        remaining = remaining_time()
+        if remaining <= 0.1:
+            logger.info(f"HTML fetch budget exhausted, will try PDF")
+            return None
+
+        try:
+            # Cap this attempt's timeout to remaining budget
+            attempt_timeout = min(
+                float(settings.get_request_timeout()), remaining * 0.9
             )
-            raise ArxivRateLimitError(
-                message,
-                status_code=406,
-                retry_after_seconds=retry_after,
+            if attempt_timeout < 1.0:
+                logger.info(f"HTML fetch insufficient budget for attempt, will try PDF")
+                return None
+            # Rate limiter only holds lock for this attempt
+            # Check if we have enough time for the rate-limiter wait plus a minimal attempt
+            pending_wait = ARXIV_RATE_LIMITER.seconds_until_next_slot()
+            remaining_before_limiter = deadline - time.monotonic()
+            min_attempt_time = 1.0  # Minimum time needed for the actual request
+            if remaining_before_limiter < pending_wait + min_attempt_time:
+                logger.info(
+                    f"HTML fetch skipped: time budget (ARXIV_MAX_TOTAL_TIME) too small for another attempt "
+                    f"(need {pending_wait + min_attempt_time:.1f}s, have {remaining_before_limiter:.1f}s), will try PDF"
+                )
+                return None
+            return ARXIV_RATE_LIMITER.run_sync(
+                lambda: _fetch_html_content_single_attempt(paper_id, attempt_timeout)
             )
+        except ArxivRateLimitError:
+            # Rate limit errors should propagate immediately
+            r
```

**File**: `src/arxiv_mcp_server/tools/export_citations.py` (modified, +5/-1)
```diff
@@ -18,6 +18,7 @@
 import mcp.types as types
 from mcp.types import ToolAnnotations
 
+from ..config import Settings
 from .arxiv_ids import (
     arxiv_version_number,
     bare_arxiv_id,
@@ -33,6 +34,7 @@
 )
 
 logger = logging.getLogger("arxiv-mcp-server")
+settings = Settings()
 
 # Bound the response so a single call cannot fan out without limit.
 MAX_IDS = 50
@@ -161,7 +163,9 @@ async def _fetch_metadata(ids: List[str]) -> Dict[str, Dict[str, Any]]:
     requests still resolve to latest.
     """
     url = f"{ARXIV_API_URL}?id_list={','.join(ids)}&max_results={len(ids)}"
-    async with httpx.AsyncClient(timeout=20.0) as client:
+    async with httpx.AsyncClient(
+        timeout=float(settings.get_request_timeout())
+    ) as client:
         response = await _rate_limited_get(client, url)
     papers = _parse_arxiv_atom_response(response.text)
 
```

**File**: `src/arxiv_mcp_server/tools/get_abstract.py` (modified, +10/-2)
```diff
@@ -12,13 +12,15 @@
 from .search import (
     _rate_limited_get,
     ARXIV_API_URL,
-    ArxivRateLimitError,
     _rate_limited_response,
 )
+from ..arxiv_api import ArxivRateLimitError
+from ..config import Settings
 import httpx
 import xml.etree.ElementTree as ET
 
 logger = logging.getLogger("arxiv-mcp-server")
+settings = Settings()
 
 abstract_tool = types.Tool(
     name="get_abstract",
@@ -72,7 +74,13 @@ async def handle_get_abstract(arguments: Dict[str, Any]) -> List[types.TextConte
 
         url = f"{ARXIV_API_URL}?id_list={paper_id}&max_results=1"
 
-        async with httpx.AsyncClient(timeout=20.0) as client:
+        timeout = httpx.Timeout(
+            connect=float(settings.ARXIV_CONNECT_TIMEOUT),
+            read=float(settings.get_request_timeout()),
+            write=30.0,
+            pool=30.0,
+        )
+        async with httpx.AsyncClient(timeout=timeout) as client:
             response = await _rate_limited_get(client, url)
 
         root = ET.fromstring(response.text)
```

---

### Incident Patch 5: `e6badc00` (2026-09-30)
**Commit Message**: Fix HTTP 406 throttling and get_abstract error reporting (#279)

* Fix HTTP 406 throttling and get_abstract error reporting

Issue #277: Treat arXiv HTTP 406 as rate limiting
- Add 406 to rate-limited status codes in _rate_limited_get
- Use minimal retries (1 attempt) for 406 to avoid prolonging IP block
- Return rate_limited response with 600-second (10-minute) retry hint
- Avoids treating legitimate throttling as hard errors

Issue #278: Fix get_abstract HTTP error reporting
- HTTPStatusError now reports actual HTTP status, not 'not found'
- Empty feed (no entries) remains the only genuine not-found case
- Error format matches search_papers: 'arXiv API HTTP error (HTTP <code>)'
- Prevents real papers from being reported as nonexistent during transient errors

Tests:
- Add test_rate_limited_get_retries_406_minimally_then_succeeds
- Add test_search_406_exhausted_returns_soft_rate_limited
- Add test_http_406/500/403_error_is_not_reported_as_not_found
- Add test_http_error_does_not_leak_url
- Update test_http_status_error_does_not_leak_upstream_url to allow status codes

All 453 tests pass with 82% overall coverage.

Co-authored-by: Joe Blazick <[REDACTED_EMAIL]>

* Complete fixes fo

**File**: `src/arxiv_mcp_server/arxiv_api.py` (modified, +88/-10)
```diff
@@ -85,7 +85,19 @@ def stream_pdf_to_path(
     request_timeout: float,
     user_agent: str,
 ) -> None:
-    """Stream an arXiv PDF to disk with bounded memory usage."""
+    """Stream an arXiv PDF to disk with bounded memory usage.
+
+    Handles arXiv HTTP 406 (throttling) with minimal retries to avoid
+    prolonging the IP block (issue #277).
+    """
+    # Import here to avoid circular dependency
+    from .tools.search import (
+        ArxivRateLimitError,
+        _HTTP_406_MAX_RETRIES,
+        _HTTP_406_RETRY_AFTER_SECONDS,
+        _backoff_seconds,
+    )
+
     timeout = httpx.Timeout(
         connect=30.0,
         read=max(120.0, request_timeout),
@@ -103,15 +115,81 @@ def stream_pdf_to_path(
     staging = Path(staging_name)
 
     try:
-        with httpx.Client(
-            timeout=timeout, follow_redirects=True, headers=headers
-        ) as client:
-            with client.stream("GET", canonical_pdf_url(paper)) as response:
-                response.raise_for_status()
-                with staging.open("wb") as output:
-                    for chunk in response.iter_bytes(chunk_size=256 * 1024):
-                        output.write(chunk)
-        staging.replace(destination)
+        last_response: httpx.Response | None = None
+        max_attempts = _HTTP_406_MAX_RETRIES + 1
+
+        for attempt in range(max_attempts):
+            try:
+                with httpx.Client(
+                    timeout=timeout, follow_redirects=True, headers=headers
+                ) as client:
+                    with client.stream("GET", canonical_pdf_url(paper)) as response:
+                        # Check status before streaming
+                        if response.status_code == 406:
+                            last_response = response
+                            if attempt < _HTTP_406_MAX_RETRIES:
+                                wait = _backoff_seconds(
+                                    attempt, response.headers.get("Retry-After")
+                                )
+                                time.sleep(wait)
+                                continue
+                            # 406 exhausted
+                            break
+
+                        # Handle 429/503 as rate limiting
+                        if response.status_code in (429, 503):
+                            last_response = response
+                            # For 429/503 on PDF, return rate_limited like everywhere else
+                            break
+
+                        # Non-406 errors: raise immediately (no retry)
+                        response.raise_for_status()
+
+                        # Success: stream to disk
+                        with staging.open("wb") as output:
+                            for chunk in response.iter_bytes(chunk_size=256 * 1024):
+                                output.write(chunk)
+                        staging.replace(destination)
+                        return
+            except httpx.HTTPStatusError as e:
+                # HTTPStatusError from raise_for_status() - non-406 errors
+                # Clean error without URL leak (issue #166)
+                status = e.response.status_code if e.response is not None else "unknown"
+                staging.unlink(missing_ok=True)
+                raise RuntimeError(f"arXiv PDF download HTTP error (HTTP {status})")
+
+        # 406/429/503 exhausted after retries
+        if last_response is not None and last_response.status_code in (406, 429, 503):
+            staging.unlink(missing_ok=True)
+            status_code = last_response.status_code
+
+            # Parse Retry-After header
+            retry_after = None
+            retry_after_header = last_response.headers.get("Retry-After")
+            if retry_after_header:
+                try:
+                    retry_after = float(retry_after_header)
+                except ValueError:
+                    pass
+
+            # Use defaults if no Retry-After header
+            if retry_after is None:
+                if status_code == 406:
+                    retry_after = _HTTP_406_RETRY_AFTER_SECONDS
+                else:
+                    from .tools.search import _DEFAULT_RETRY_AFTER_SECONDS
+
+                    retry_after = _DEFAULT_RETRY_AFTER_SECONDS
+
+            message = (
+                f"arXiv is rate limiting this IP (HTTP {status_code}). "
+                f"Please wait {int(retry_after)} seconds before retrying."
+            )
+            raise ArxivRateLimitError(
+                message,
+                status_code=status_code,
+                retry_after_seconds=retry_after,
+            )
     except BaseException:
         staging.unlink(missing_ok=True)
         raise
```

**File**: `src/arxiv_mcp_server/config.py` (modified, +50/-35)
```diff
@@ -29,51 +29,66 @@ def _resolve_package_version() -> str:
 _arxiv_client = None
 
 
-def get_arxiv_client():
-    """Return the process-wide arxiv.Client, creating it on first use.
+def get_arxiv_client(num_retries=None):
+    """Return an arxiv.Client with appropriate timeouts and connection settings.
+
+    Args:
+        num_retries: Override the number of retries. If None, uses the shared
+                     process-wide client with default retries. If an integer,
+                     creates a new client with that retry count (use 0 for
+                     minimal retries to avoid prolonging 406 IP blocks).
 
     Callers that need a particular page size must set it while holding the
     shared arXiv request gate. This preserves one requests.Session without
     allowing concurrent searches to race over client configuration.
     """
     global _arxiv_client
-    if _arxiv_client is None:
-        import arxiv
 
-        client = arxiv.Client()
+    # If num_retries is specified, create a new client with that setting
+    if num_retries is not None:
+        import arxiv
 
-        # The upstream arxiv package issues HTTP requests through a
-        # requests.Session with no timeout (arxiv.Client._session.get),
-        # so a connection that silently stops responding (a "black hole":
-        # the peer never answers again, no FIN/RST — root cause unknown,
-        # see issue) blocks forever inside ARXIV_RATE_LIMITER's
-        # process-wide lock, wedging every subsequent search until the
-        # server is restarted.
-        #
-        # 1. Inject connect/read timeouts so such a request fails within
-        #    ~35s, the lock is released, and later calls recover.
-        # 2. Disable keep-alive connection reuse so a pooled connection
-        #    can never be reused after going stale (urllib3's stale check
-        #    only verifies the socket object exists, not that the peer is
-        #    still reachable).
-        #
-        # Only patch a real requests.Session; tests may substitute a mock
-        # client without one.
-        session = getattr(client, "_session", None)
-        if isinstance(session, requests.Session):
-            _orig_get = session.get
-
-            def _get_with_timeout(url, **kwargs):
-                kwargs.setdefault("timeout", (5.0, 30.0))
-                return _orig_get(url, **kwargs)
-
-            session.get = _get_with_timeout
-            # requests' default headers already include 'Connection: keep-alive',
-            # so setdefault would be a no-op; assign directly.
-            session.headers["Connection"] = "close"
+        client = arxiv.Client(num_retries=num_retries, delay_seconds=3.0)
+    # Otherwise use the shared client
+    elif _arxiv_client is None:
+        import arxiv
 
+        client = arxiv.Client()
         _arxiv_client = client
-    return _arxiv_client
+    else:
+        return _arxiv_client
+
+    # The upstream arxiv package issues HTTP requests through a
+    # requests.Session with no timeout (arxiv.Client._session.get),
+    # so a connection that silently stops responding (a "black hole":
+    # the peer never answers again, no FIN/RST — root cause unknown,
+    # see issue) blocks forever inside ARXIV_RATE_LIMITER's
+    # process-wide lock, wedging every subsequent search until the
+    # server is restarted.
+    #
+    # 1. Inject connect/read timeouts so such a request fails within
+    #    ~35s, the lock is released, and later calls recover.
+    # 2. Disable keep-alive connection reuse so a pooled connection
+    #    can never be reused after going stale (urllib3's stale check
+    #    only verifies the socket object exists, not that the peer is
+    #    still reachable).
+    #
+    # Only patch a real requests.Session; tests may substitute a mock
+    # client without one.
+    session = getattr(client, "_session", None)
+    if isinstance(session, requests.Session):
+        _orig_get = session.get
+
+        def _get_with_timeout(url, **kwargs):
+            kwargs.setdefault("timeout", (5.0, 30.0))
+            return _orig_get(url, **kwargs)
+
+        session.get = _get_with_timeout
+        # requests' default headers already include 'Connection: keep-alive',
+        # so setdefault would be a no-op; assign directly.
+        session.headers["Connection"] = "close"
+
+    return client
 
 
 def close_arxiv_client() -> None:
```

**File**: `src/arxiv_mcp_server/tools/download.py` (modified, +151/-2)
```diff
@@ -5,6 +5,7 @@
 import json
 import asyncio
 import httpx
+import requests
 from html.parser import HTMLParser
 import re
 from pathlib import Path
@@ -24,7 +25,13 @@
 )
 from .list_papers import resolve_stored_stem
 from .list_papers import save_paper_metadata
-from .search import ARXIV_API_URL, ARXIV_NS, _rate_limited_get
+from .search import (
+    ARXIV_API_URL,
+    ARXIV_NS,
+    _rate_limited_get,
+    ArxivRateLimitError,
+    _rate_limited_response,
+)
 import logging
 import threading
 import xml.etree.ElementTree as ET
@@ -754,13 +761,39 @@ def _fetch_html_content(paper_id: str) -> str | None:
 
     Returns the extracted text on success, or None if the HTML endpoint
     is not available (404 or other non-200 status).
+
+    Raises ArxivRateLimitError on 406 (throttling) so the caller can
+    handle it as rate limiting, not missing HTML (issue #277).
+    Honors Retry-After header when present.
     """
+    from .search import ArxivRateLimitError, _HTTP_406_RETRY_AFTER_SECONDS
+
     url = f"https://arxiv.org/html/{paper_id}"
     try:
         response = httpx.get(url, timeout=30, follow_redirects=True)
         if response.status_code == 200:
             logger.info(f"HTML fetch succeeded for {paper_id}")
             return _html_to_text(response.text)
+        if response.status_code == 406:
+            # Throttling, not missing HTML (issue #277)
+            # Honor Retry-After header if present
+            retry_after = _HTTP_406_RETRY_AFTER_SECONDS
+            retry_after_header = response.headers.get("Retry-After")
+            if retry_after_header:
+                try:
+                    retry_after = float(retry_after_header)
+                except ValueError:
+                    pass
+
+            message = (
+                f"arXiv is rate limiting this IP (HTTP 406). "
+                f"Please wait {int(retry_after)} seconds before retrying."
+            )
+            raise ArxivRateLimitError(
+                message,
+                status_code=406,
+                retry_after_seconds=retry_after,
+            )
         logger.info(
             f"HTML fetch returned {response.status_code} for {paper_id}, will try PDF"
         )
@@ -811,20 +844,48 @@ def _fetch_pdf_content_unlocked(paper_id: str) -> tuple[str, arxiv.Result]:
     Raises PaperNotFoundError if the paper does not exist, or other exceptions
     on network/conversion failures.
     Raises ImportError (with a helpful message) if the [pdf] extra is not installed.
+    Raises ArxivRateLimitError on 406/429/503.
+    Raises httpx.HTTPStatusError on other HTTP errors (cleaned by caller).
     """
     if not _load_pdf_dependencies():
         raise ImportError(
             "PDF conversion requires the pdf extra: "
             "pip install arxiv-mcp-server[pdf]"
         )
 
-    client = get_arxiv_client()
+    # Use a client with minimal retries for the metadata lookup to avoid
+    # making many requests on 406/429/503 (issue #277).
+    # Note: Retry-After headers cannot be honored on this path because the
+    # arxiv package's HTTPError does not preserve response headers.
+    client = get_arxiv_client(num_retries=0)
     try:
         paper = ARXIV_RATE_LIMITER.run_sync(
             lambda: next(client.results(arxiv.Search(id_list=[paper_id])))
         )
     except StopIteration:
         raise PaperNotFoundError(f"Paper {paper_id} not found on arXiv")
+    except arxiv.HTTPError as e:
+        # arxiv.HTTPError has a status attribute
+        status = e.status
+        # Create httpx.HTTPStatusError for consistent handling by caller
+        request = httpx.Request("GET", "(arXiv metadata)")
+        response = httpx.Response(status, request=request)
+        raise httpx.HTTPStatusError(
+            "arXiv metadata request failed",
+            request=request,
+            response=response,
+        )
+    except (
+        requests.exceptions.ConnectionError,
+        requests.exceptions.Timeout,
+    ):
+        # Network errors: report cleanly without URL or traceback
+        raise RuntimeError("Could not reach arXiv (network error)") from None
+    finally:
+        # Close the per-call session created by the num_retries=0 client
+        session = getattr(client, "_session", None)
+        if session and hasattr(session, "close"):
+            session.close()
 
     pdf_path = get_paper_path(paper_id, ".pdf")
     _download_arxiv_pdf_to_path(paper, pdf_path)
@@ -1130,6 +1191,79 @@ async def handle_download(arguments: Dict[str, Any]) -> List[types.TextContent]:
             )
         ]
 
+    except ArxivRateLimitError as e:
+        # Rate limit from _rate_limited_get or stream_pdf_to_path (issue #277)
+        return _rate_limited_response(
+            str(e),
+            retry_after_seconds=e.retry_after_seconds,
+            status_code=e.status_code,
+        )
+    except httpx.HTTPStatusError as e:
+        # HTTP errors from _rate_limited_get (existence check) or other 
```

**File**: `src/arxiv_mcp_server/tools/export_citations.py` (modified, +18/-2)
```diff
@@ -24,7 +24,13 @@
     is_valid_arxiv_id,
     normalize_arxiv_id,
 )
-from .search import ARXIV_API_URL, _parse_arxiv_atom_response, _rate_limited_get
+from .search import (
+    ARXIV_API_URL,
+    _parse_arxiv_atom_response,
+    _rate_limited_get,
+    ArxivRateLimitError,
+    _rate_limited_response,
+)
 
 logger = logging.getLogger("arxiv-mcp-server")
 
@@ -323,8 +329,18 @@ async def handle_export_citations(arguments: Dict[str, Any]) -> List[types.TextC
         }
         return [types.TextContent(type="text", text=json.dumps(payload, indent=2))]
 
-    except RuntimeError as exc:  # rate limit / timeout surfaced by _rate_limited_get
+    except ArxivRateLimitError as exc:  # rate limit from _rate_limited_get (#277)
+        return _rate_limited_response(
+            str(exc),
+            retry_after_seconds=exc.retry_after_seconds,
+            status_code=exc.status_code,
+        )
+    except RuntimeError as exc:  # timeout surfaced by _rate_limited_get
         return _error(str(exc))
+    except httpx.HTTPStatusError as exc:  # HTTP errors (#166, #278)
+        # Never leak upstream URLs (issue #166).
+        status = exc.response.status_code if exc.response is not None else "unknown"
+        return _error(f"arXiv API HTTP error (HTTP {status})")
     except Exception as exc:  # noqa: BLE001 - report, don't crash the server
         logger.error(f"export_citations error: {exc}")
         return _error(str(exc))
```

**File**: `src/arxiv_mcp_server/tools/get_abstract.py` (modified, +18/-4)
```diff
@@ -9,7 +9,12 @@
 
 from .arxiv_ids import parse_arxiv_id
 from .content import CONTENT_WARNING
-from .search import _rate_limited_get, ARXIV_API_URL
+from .search import (
+    _rate_limited_get,
+    ARXIV_API_URL,
+    ArxivRateLimitError,
+    _rate_limited_response,
+)
 import httpx
 import xml.etree.ElementTree as ET
 
@@ -139,22 +144,31 @@ def text(tag: str) -> str:
             )
         ]
 
+    except ArxivRateLimitError as e:
+        # Rate limit from _rate_limited_get (issues #277, #278)
+        return _rate_limited_response(
+            str(e),
+            retry_after_seconds=e.retry_after_seconds,
+            status_code=e.status_code,
+        )
     except RuntimeError as e:
-        # Rate limit or timeout from _rate_limited_get
+        # Timeout from _rate_limited_get
         return [
             types.TextContent(
                 type="text", text=json.dumps({"status": "error", "message": str(e)})
             )
         ]
-    except httpx.HTTPStatusError:
+    except httpx.HTTPStatusError as e:
+        # HTTP errors other than not-found (issue #278).
         # Never leak upstream status lines / URLs (issue #166).
+        status = e.response.status_code if e.response is not None else "unknown"
         return [
             types.TextContent(
                 type="text",
                 text=json.dumps(
                     {
                         "status": "error",
-                        "message": f"Paper {paper_id} not found on arXiv",
+                        "message": f"arXiv API HTTP error (HTTP {status})",
                     }
                 ),
             )
```

**File**: `src/arxiv_mcp_server/tools/latex.py` (modified, +107/-2)
```diff
@@ -19,6 +19,7 @@
 from ..arxiv_api import ARXIV_RATE_LIMITER
 from ..config import Settings
 from .content import LATEX_CONTENT_WARNING, add_content_payload
+from .search import ArxivRateLimitError, _rate_limited_response
 from .latex_archive import (
     MAX_ARCHIVE_BYTES,
     MAX_ARCHIVE_MEMBERS,
@@ -365,6 +366,40 @@ async def handle_get_paper_latex(
         return [types.TextContent(type="text", text=json.dumps(payload, indent=2))]
     except httpx.HTTPStatusError as exc:
         status = exc.response.status_code
+        # Handle rate limiting (406/429/503)
+        if status in (406, 429, 503):
+            from .search import (
+                _HTTP_406_RETRY_AFTER_SECONDS,
+                _DEFAULT_RETRY_AFTER_SECONDS,
+            )
+
+            # Parse Retry-After header
+            retry_after = None
+            retry_after_header = exc.response.headers.get("Retry-After")
+            if retry_after_header:
+                try:
+                    retry_after = float(retry_after_header)
+                except ValueError:
+                    pass
+
+            # Use defaults if no Retry-After header
+            if retry_after is None:
+                retry_after = (
+                    _HTTP_406_RETRY_AFTER_SECONDS
+                    if status == 406
+                    else _DEFAULT_RETRY_AFTER_SECONDS
+                )
+
+            message = (
+                f"arXiv is rate limiting this IP (HTTP {status}). "
+                f"Please wait {int(retry_after)} seconds before retrying."
+            )
+            return _rate_limited_response(
+                message,
+                retry_after_seconds=retry_after,
+                status_code=status,
+            )
+        # Handle other HTTP errors
         message = (
             "LaTeX source is unavailable for this paper"
             if status in {404, 403}
@@ -418,8 +453,43 @@ async def handle_list_paper_latex_sections(
         }
         return [types.TextContent(type="text", text=json.dumps(payload, indent=2))]
     except httpx.HTTPStatusError as exc:
+        status = exc.response.status_code
+        # Handle rate limiting (406/429/503)
+        if status in (406, 429, 503):
+            from .search import (
+                _HTTP_406_RETRY_AFTER_SECONDS,
+                _DEFAULT_RETRY_AFTER_SECONDS,
+            )
+
+            # Parse Retry-After header
+            retry_after = None
+            retry_after_header = exc.response.headers.get("Retry-After")
+            if retry_after_header:
+                try:
+                    retry_after = float(retry_after_header)
+                except ValueError:
+                    pass
+
+            # Use defaults if no Retry-After header
+            if retry_after is None:
+                retry_after = (
+                    _HTTP_406_RETRY_AFTER_SECONDS
+                    if status == 406
+                    else _DEFAULT_RETRY_AFTER_SECONDS
+                )
+
+            message = (
+                f"arXiv is rate limiting this IP (HTTP {status}). "
+                f"Please wait {int(retry_after)} seconds before retrying."
+            )
+            return _rate_limited_response(
+                message,
+                retry_after_seconds=retry_after,
+                status_code=status,
+            )
+        # Handle other HTTP errors
         return _error(
-            f"arXiv source request failed with HTTP {exc.response.status_code}",
+            f"arXiv source request failed with HTTP {status}",
             paper_id,
         )
     except LatexSourceError as exc:
@@ -468,8 +538,43 @@ async def handle_get_paper_latex_section(
         )
         return [types.TextContent(type="text", text=json.dumps(payload, indent=2))]
     except httpx.HTTPStatusError as exc:
+        status = exc.response.status_code
+        # Handle rate limiting (406/429/503)
+        if status in (406, 429, 503):
+            from .search import (
+                _HTTP_406_RETRY_AFTER_SECONDS,
+                _DEFAULT_RETRY_AFTER_SECONDS,
+            )
+
+            # Parse Retry-After header
+            retry_after = None
+            retry_after_header = exc.response.headers.get("Retry-After")
+            if retry_after_header:
+                try:
+                    retry_after = float(retry_after_header)
+                except ValueError:
+                    pass
+
+            # Use defaults if no Retry-After header
+            if retry_after is None:
+                retry_after = (
+                    _HTTP_406_RETRY_AFTER_SECONDS
+                    if status == 406
+                    else _DEFAULT_RETRY_AFTER_SECONDS
+                )
+
+            message = (
+                f"arXiv is rate limiting this IP (HTTP {status}). "
+                f"Please wait {int(retry_after)} seconds before retrying."
+            )
+            return _rate_limited_response(
+                message,
+                retry_after_seconds=
```

**File**: `src/arxiv_mcp_server/tools/search.py` (modified, +19/-7)
```diff
@@ -39,6 +39,8 @@
 _INITIAL_BACKOFF_SECONDS = 2.0
 _MAX_BACKOFF_SECONDS = 60.0
 _DEFAULT_RETRY_AFTER_SECONDS = 60.0
+_HTTP_406_RETRY_AFTER_SECONDS = 600.0
+_HTTP_406_MAX_RETRIES = 1
 RATE_LIMIT_MESSAGE = (
     "arXiv is rate limiting this IP (HTTP 429). " "Please wait before retrying."
 )
@@ -118,6 +120,7 @@ async def _rate_limited_get(client: httpx.AsyncClient, url: str) -> httpx.Respon
     """Make an HTTP request through the process-wide arXiv request gate.
 
     Retries HTTP 429/503 with exponential backoff + jitter (citation_graph parity).
+    Retries HTTP 406 with minimal attempts to avoid prolonging the IP-level block.
     One additional retry on timeout only, independent of the rate-limit budget.
     """
 
@@ -136,17 +139,22 @@ async def request() -> httpx.Response:
                     else:
                         raise RuntimeError("arXiv request timed out after retry")
             assert response is not None
-            if response.status_code in (429, 503):
+            if response.status_code in (429, 503, 406):
                 last_response = response
-                if attempt == _MAX_RETRIES:
+                max_retries_for_status = (
+                    _HTTP_406_MAX_RETRIES
+                    if response.status_code == 406
+                    else _MAX_RETRIES
+                )
+                if attempt == max_retries_for_status:
                     break
                 wait = _backoff_seconds(attempt, response.headers.get("Retry-After"))
                 logger.warning(
                     "arXiv %s; retrying in %.1fs (attempt %s/%s)",
                     response.status_code,
                     wait,
                     attempt + 1,
-                    _MAX_RETRIES + 1,
+                    max_retries_for_status + 1,
                 )
                 await asyncio.sleep(wait)
                 continue
@@ -159,16 +167,20 @@ async def request() -> httpx.Response:
             retry_after = _parse_retry_after_seconds(
                 last_response.headers.get("Retry-After")
             )
+        if retry_after is None:
+            retry_after = (
+                _HTTP_406_RETRY_AFTER_SECONDS
+                if status_code == 406
+                else _DEFAULT_RETRY_AFTER_SECONDS
+            )
         message = (
             f"arXiv is rate limiting this IP (HTTP {status_code}). "
-            "Please wait 60 seconds before retrying."
+            f"Please wait {int(retry_after)} seconds before retrying."
         )
         raise ArxivRateLimitError(
             message,
             status_code=status_code,
-            retry_after_seconds=(
-                retry_after if retry_after is not None else _DEFAULT_RETRY_AFTER_SECONDS
-            ),
+            retry_after_seconds=retry_after,
         )
 
     return await ARXIV_RATE_LIMITER.run_async(request)
```

**File**: `tests/tools/test_download.py` (modified, +574/-0)
```diff
@@ -398,3 +398,577 @@ async def test_download_paper_return_full_text_opt_in(temp_storage_path, mocker)
     assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
     assert len(result["content_warning"]) < 80
     assert "UNTRUSTED" not in result["content"]
+
+
+@pytest.mark.asyncio
+async def test_html_fetch_406_raises_rate_limit_error():
+    """HTML fetch should raise ArxivRateLimitError on 406, not return None (#277)."""
+    from arxiv_mcp_server.tools.download import _fetch_html_content
+    from arxiv_mcp_server.tools.search import ArxivRateLimitError
+    import httpx
+    from unittest.mock import MagicMock, patch
+
+    mock_response = MagicMock()
+    mock_response.status_code = 406
+    mock_response.headers = {}  # No Retry-After header
+
+    with patch.object(httpx, "get", return_value=mock_response):
+        with pytest.raises(ArxivRateLimitError) as exc_info:
+            _fetch_html_content("2103.12345")
+
+        assert exc_info.value.status_code == 406
+        assert exc_info.value.retry_after_seconds == 600.0
+        assert "HTTP 406" in str(exc_info.value)
+
+
+@pytest.mark.asyncio
+async def test_download_html_406_returns_rate_limited_response(
+    temp_storage_path, mocker
+):
+    """Download should return rate_limited response when HTML fetch gets 406 (#277)."""
+    from arxiv_mcp_server.tools import download as download_module
+    from arxiv_mcp_server.tools.search import ArxivRateLimitError
+
+    mocker.patch.object(
+        download_module,
+        "get_paper_path",
+        side_effect=lambda pid, suffix=".md": temp_storage_path / f"{pid}{suffix}",
+    )
+    mocker.patch.object(
+        download_module,
+        "_fetch_html_content",
+        side_effect=ArxivRateLimitError(
+            "arXiv is rate limiting this IP (HTTP 406). "
+            "Please wait 600 seconds before retrying.",
+            status_code=406,
+            retry_after_seconds=600.0,
+        ),
+    )
+
+    response = await handle_download({"paper_id": "2103.12345"})
+    result = json.loads(response[0].text)
+
+    assert result["status"] == "rate_limited"
+    assert result["http_status"] == 406
+    assert result["retry_after_seconds"] == 600.0
+    assert "HTTP 406" in result["message"]
+
+
+@pytest.mark.asyncio
+async def test_download_pdf_406_returns_rate_limited_response(
+    temp_storage_path, mocker
+):
+    """Download should return rate_limited response when PDF fetch gets 406 (#277)."""
+    from arxiv_mcp_server.tools import download as download_module
+    from arxiv_mcp_server.tools.search import ArxivRateLimitError
+
+    mocker.patch.object(
+        download_module,
+        "get_paper_path",
+        side_effect=lambda pid, suffix=".md": temp_storage_path / f"{pid}{suffix}",
+    )
+    mocker.patch.object(download_module, "_fetch_html_content", return_value=None)
+    mocker.patch.object(download_module, "_paper_exists_on_arxiv", return_value=True)
+    mocker.patch.object(download_module, "_load_pdf_dependencies", return_value=True)
+    mocker.patch.object(
+        download_module,
+        "_fetch_pdf_content",
+        side_effect=ArxivRateLimitError(
+            "arXiv is rate limiting this IP (HTTP 406). "
+            "Please wait 600 seconds before retrying.",
+            status_code=406,
+            retry_after_seconds=600.0,
+        ),
+    )
+
+    response = await handle_download({"paper_id": "2103.12345"})
+    result = json.loads(response[0].text)
+
+    assert result["status"] == "rate_limited"
+    assert result["http_status"] == 406
+    assert result["retry_after_seconds"] == 600.0
+    assert "HTTP 406" in result["message"]
+
+
+@pytest.mark.asyncio
+async def test_download_pdf_http_error_no_traceback(temp_storage_path, mocker, caplog):
+    """PDF HTTP errors should not log full traceback (#166, #277)."""
+    from arxiv_mcp_server.tools import download as download_module
+    import logging
+
+    caplog.set_level(logging.ERROR)
+
+    mocker.patch.object(
+        download_module,
+        "get_paper_path",
+        side_effect=lambda pid, suffix=".md": temp_storage_path / f"{pid}{suffix}",
+    )
+    mocker.patch.object(download_module, "_fetch_html_content", return_value=None)
+    mocker.patch.object(download_module, "_paper_exists_on_arxiv", return_value=True)
+    mocker.patch.object(download_module, "_load_pdf_dependencies", return_value=True)
+    mocker.patch.object(
+        download_module,
+        "_fetch_pdf_content",
+        side_effect=RuntimeError("arXiv PDF download HTTP error (HTTP 500)"),
+    )
+
+    response = await handle_download({"paper_id": "2103.12345"})
+    result = json.loads(response[0].text)
+
+    assert result["status"] == "error"
+    assert "arXiv PDF download HTTP error (HTTP 500)" in result["message"]
+    assert "export.arxiv.org" not in result["message"]
+    # Should log error, not exception (no traceback)
+    assert "Download error for 2103.12345" in caplog.text
+    assert "Traceback"
```

---

### Incident Patch 6: `f760f791` (2026-08-23)
**Commit Message**: fix: reduce Switch Transformers HTML→md author/cite noise (#260) (#267)

Drop duplicate pre-title author bylines, skip journal heading chrome,
and rejoin decorative breaks in bracket cites, figure/table refs, and
parenthetical citations. Bump EXTRACTOR_VERSION to 7 (#265 took 6).

**File**: `src/arxiv_mcp_server/tools/download.py` (modified, +95/-3)
```diff
@@ -132,7 +132,9 @@ async def shutdown_background_tasks() -> None:
 
 # Bump when HTML extraction changes so cached markdown is treated as stale
 # and re-downloaded without requiring the caller to pass force=true.
-EXTRACTOR_VERSION = 6
+# #265 already claimed 6 for decorative titles; this Switch noise cleanup
+# bumps to 7 so both changes invalidate caches (#175).
+EXTRACTOR_VERSION = 7
 
 
 # ---------------------------------------------------------------------------
@@ -152,8 +154,11 @@ class _ArticleTextExtractor(HTMLParser):
       - Coalesce decorative letter-span titles into one line (keep
         subtitle colons attached); coalesce author lines; drop
         affiliation superscripts and TeX superscript debris in the
-        author block.
+        author block; drop pre-title bylines that duplicate authors.
+      - Skip journal heading/shortheadings/editor note chrome.
       - Skip footnotemark markers (class, role, or the literal token).
+      - Join decorative breaks in bracket cites, figure/table refs, and
+        parenthetical citations where HTML split them across lines.
       - Skip license/permission one-liners and ICML/LaTeX page-layout
         style warnings (marginparsep and similar) that appear before the
         title.
@@ -200,6 +205,13 @@ class _ArticleTextExtractor(HTMLParser):
         "ltx_pubnote",
         "ltx_dates",
         "ltx_role_cc-license",
+        # Journal/PDF chrome notes (running headers, editor, page marks).
+        "ltx_role_heading",
+        "ltx_role_shortheadings",
+        "ltx_role_firstpage",
+        "ltx_role_editor",
+        "ltx_role_newpage",
+        "ltx_role_refnum",
     }
     FOOTNOTEMARK_TOKEN = "footnotemark"
     PERMISSION_MARKERS = (
@@ -245,6 +257,7 @@ class _ArticleTextExtractor(HTMLParser):
         r"^\{\}\^|textsuperscript",
         re.IGNORECASE,
     )
+    _AUTHOR_STOPWORDS = frozenset({"and", "or", "the", "of", "for"})
 
     def __init__(self):
         super().__init__()
@@ -288,6 +301,36 @@ def _normalize_math_alttext(alttext: str) -> str:
         # ``\times`` alone or embedded (e.g. ``2.0\times``, ``L\times E``).
         return alttext.replace(r"\times", "\u00d7")
 
+    @classmethod
+    def _author_name_tokens(cls, text: str) -> set[str]:
+        """Alphabetic tokens from an author/byline string (for dedupe)."""
+        return {
+            tok
+            for tok in re.findall(r"[A-Za-z]+", text.lower())
+            if len(tok) > 1 and tok not in cls._AUTHOR_STOPWORDS
+        }
+
+    def _drop_duplicate_author_bylines(self, author_line: str) -> None:
+        """Remove earlier chunks that only repeat the author names.
+
+        Some latexml/ar5iv pages emit a plain-paragraph byline before the
+        title in addition to ``ltx_authors`` (Switch Transformers).
+        """
+        name_tokens = self._author_name_tokens(author_line)
+        if not name_tokens:
+            return
+        chunks = self._article_chunks if self._article_depth > 0 else self._body_chunks
+        kept: list[str] = []
+        for chunk in chunks:
+            chunk_tokens = self._author_name_tokens(chunk)
+            if chunk_tokens and chunk_tokens <= name_tokens and len(chunk) < 300:
+                continue
+            kept.append(chunk)
+        if self._article_depth > 0:
+            self._article_chunks = kept
+        else:
+            self._body_chunks = kept
+
     def _flush_authors(self) -> None:
         """Join buffered author tokens into one coherent line."""
         if not self._author_buf:
@@ -298,6 +341,7 @@ def _flush_authors(self) -> None:
         line = re.sub(r"\s+", " ", line).strip(" ,")
         self._author_buf = []
         if line:
+            self._drop_duplicate_author_bylines(line)
             self._append_chunk(line)
 
     def _flush_title(self) -> None:
@@ -348,6 +392,10 @@ def handle_starttag(self, tag: str, attrs):
         entering_authors = "ltx_authors" in classes
         if entering_authors:
             self._authors_depth += 1
+        # latexml inserts ``ltx_author_before`` between creators; keep commas.
+        if self._authors_depth > 0 and "ltx_author_before" in classes:
+            if self._author_buf and self._author_buf[-1] != ",":
+                self._author_buf.append(",")
 
         # Void elements have no children. Incrementing skip_depth for
         # <input> etc. and never seeing an end tag left the rest of the
@@ -428,6 +476,50 @@ def _extract_article_fragment(html: str) -> str | None:
     return html[start : end + len("</article>")]
 
 
+def _join_split_ref_noise(text: str) -> str:
+    """Rejoin decorative HTML line breaks in cites and figure/table refs.
+
+    latexml often emits ``[``, ``1``, ``]`` or ``Fig.`` / ``2`` as separate
+    text nodes; with newline-joined chunks that becomes ``[\n1\n]`` or
+    ``Fig.\n2``. Parenthetical author-year cites split the same way.
+    """
+    # Bracket cites: [\n1\n] → [1]
+    text = re.sub(r"\[\n(\d+)\n\]", 
```

**File**: `tests/tools/test_download_html_switch_noise.py` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+"""HTML extract: Switch Transformers author/cite/figure noise (#260)."""
+
+from arxiv_mcp_server.tools.download import EXTRACTOR_VERSION, _html_to_text
+
+# Shaped like Switch Transformers (2101.03961): pre-title byline duplicates
+# ``ltx_authors``, journal heading/shortheadings notes, and latexml splits
+# citations / figure refs across text nodes.
+SWITCH_NOISE_HTML = """
+<html>
+  <body>
+    <article class="ltx_document ltx_authors_1line">
+      <div id="p1" class="ltx_para">
+        <p id="p1.1" class="ltx_p">William Fedus, Barret Zoph and Noam Shazeer</p>
+      </div>
+      <h1 class="ltx_title ltx_title_document">
+        Switch Transformers: Scaling to Trillion Parameter Models
+      </h1>
+      <div class="ltx_authors">
+        <span class="ltx_creator ltx_role_author">
+          <span class="ltx_personname">William Fedus</span>
+        </span>
+        <span class="ltx_author_before">  </span>
+        <span class="ltx_creator ltx_role_author">
+          <span class="ltx_personname">Barret Zoph<sup class="ltx_sup">*</sup></span>
+        </span>
+        <span class="ltx_author_before">  </span>
+        <span class="ltx_creator ltx_role_author">
+          <span class="ltx_personname">Noam Shazeer</span>
+          <span class="ltx_author_notes">
+            <span class="ltx_contact ltx_role_affiliation">
+              <span class="ltx_contact_name">Affiliation: </span>Google
+            </span>
+          </span>
+        </span>
+      </div>
+      <span class="ltx_note ltx_role_heading">
+        <sup class="ltx_note_mark">†</sup>
+        <span class="ltx_note_type">heading: </span>23 2022 1- 8/21; Revised
+      </span>
+      <span class="ltx_note ltx_role_shortheadings">
+        <sup class="ltx_note_mark">†</sup>
+        <span class="ltx_note_type">shortheadings: </span>
+        Switch Transformers / Fedus, Zoph and Shazeer
+      </span>
+      <span class="ltx_note ltx_role_editor">
+        <sup class="ltx_note_mark">†</sup>
+        <span class="ltx_note_type">editor: </span>Alexander Clark
+      </span>
+      <div class="ltx_abstract">
+        <h6 class="ltx_title ltx_title_abstract">Abstract</h6>
+        <p>
+          We design models based off T5-Base and T5-Large
+          <cite class="ltx_cite ltx_citemacro_citep">
+            (<a href="#bib.bib36" class="ltx_ref">Raffel et al. 2019</a>)
+          </cite>
+          and cite prior work
+          <cite class="ltx_cite ltx_citemacro_citep">
+            (<a href="#bib.bib1" class="ltx_ref">Radford et al. 2018</a>;
+            <a href="#bib.bib2" class="ltx_ref">Kaplan et al. 2020</a>;
+            <a href="#bib.bib3" class="ltx_ref">Brown et al. 2020</a>)
+          </cite>.
+          Bracket form
+          <cite class="ltx_cite">[<a href="#bib.bib4" class="ltx_ref">1</a>]</cite>
+          and figure reference Figure
+          <a href="#S2.F3" class="ltx_ref"><span class="ltx_text ltx_ref_tag">3</span></a>
+          shows routing. Also Fig.
+          <a href="#S2.F2" class="ltx_ref"><span class="ltx_text ltx_ref_tag">2</span></a>
+          for comparison.
+        </p>
+      </div>
+    </article>
+  </body>
+</html>
+"""
+
+
+def test_extractor_version_bumped_for_switch_noise_cleanup():
+    """#175 auto-invalidates Switch caches after this extractor change."""
+    assert EXTRACTOR_VERSION >= 7
+
+
+def test_html_to_text_dedupes_switch_author_byline():
+    text = _html_to_text(SWITCH_NOISE_HTML)
+    assert text.count("William Fedus") == 1
+    assert text.count("Barret Zoph") == 1
+    assert text.count("Noam Shazeer") == 1
+    # Coherent single author line with commas between creators.
+    assert "William Fedus, Barret Zoph, Noam Shazeer" in text
+    assert "Affiliation:" not in text
+    assert "Google" not in text
+
+
+def test_html_to_text_drops_journal_heading_chrome():
+    text = _html_to_text(SWITCH_NOISE_HTML)
+    for leaked in [
+        "Switch Transformers / Fedus, Zoph and Shazeer",
+        "Alexander Clark",
+        "8/21; Revised",
+        "heading:",
+        "shortheadings:",
+        "editor:",
+    ]:
+        assert leaked not in text, leaked
+
+
+def test_html_to_text_joins_split_citations_and_figure_refs():
+    text = _html_to_text(SWITCH_NOISE_HTML)
+    assert "(Raffel et al. 2019)" in text
+    assert "(Radford et al. 2018; Kaplan et al. 2020; Brown et al. 2020)" in text
+    assert "[1]" in text
+    assert "\n1\n" not in text
+    assert "[\n" not in text
+    assert "Figure 3 shows" in text
+    assert "Fig. 2 for" in text
+    assert "\nFigure\n" not in text
+    assert "\nFig.\n" not in text
+    lines = text.splitlines()
+    assert "Figure" not in lines
+    assert "Fig." not in lines
```

---

### Incident Patch 7: `664bb72a` (2026-08-23)
**Commit Message**: test: align 2608 title fixture with joined HTML titles (#258) (#268)

After #265, <br>-broken document titles are coalesced into one line.
Update the 2608 sidecar fixture test to expect the joined title instead
of the pre-#258 split first line, without changing product behavior.

**File**: `tests/tools/test_download_sidecar.py` (modified, +6/-4)
```diff
@@ -33,6 +33,8 @@
     "for Locality Against the Edge Memory-Bandwidth Wall "
     "A Pre-Registered Negative Result, with a Systems Measurement Study"
 )
+# Historical truncated first line from pre-#258 <br>-split HTML scrape;
+# still useful as a stale sidecar fixture for force-refresh coverage.
 HTML_FIRST_LINE = "Cacheable by Design? Training Mixture-of-Experts Routers"
 
 
@@ -43,11 +45,11 @@ def _patch_path(mocker, storage):
     )
 
 
-def test_2608_shaped_html_title_is_split_across_lines():
-    """Document the HTML scrape failure mode that #176 must not use."""
+def test_2608_shaped_html_title_is_joined_across_breaks():
+    """#258 joins <br>-broken document titles into one line (same as API)."""
     text = _html_to_text(SPLIT_TITLE_HTML)
-    assert text.splitlines()[0] == HTML_FIRST_LINE
-    assert API_TITLE not in text.splitlines()[0]
+    assert text.splitlines()[0] == API_TITLE
+    assert HTML_FIRST_LINE != text.splitlines()[0]
 
 
 @pytest.mark.asyncio
```

---

### Incident Patch 8: `315b7b9c` (2026-08-23)
**Commit Message**: fix: flat storage for legacy slash arXiv IDs (#254) (#266)

Sanitize `/` to `__` in on-disk stems (matching latex cache), mkdir parents
defensively, and omit absolute host paths from download_paper OSError responses.
Closes #254.

**File**: `src/arxiv_mcp_server/resources/papers.py` (modified, +7/-2)
```diff
@@ -10,6 +10,7 @@
 import mcp.types as types
 from ..config import Settings
 from ..arxiv_api import stream_pdf_to_path
+from ..tools.arxiv_ids import filesystem_arxiv_stem, logical_arxiv_id_from_stem
 
 logger = logging.getLogger("arxiv-mcp-server")
 
@@ -26,7 +27,9 @@ def __init__(self):
 
     def _get_paper_path(self, paper_id: str) -> Path:
         """Get the absolute file path for a paper."""
-        return self.storage_path / f"{paper_id}.md"
+        path = self.storage_path / f"{filesystem_arxiv_stem(paper_id)}.md"
+        path.parent.mkdir(parents=True, exist_ok=True)
+        return path
 
     async def store_paper(self, paper_id: str, pdf_url: str) -> bool:
         """Download and store a paper from arXiv."""
@@ -69,7 +72,9 @@ async def has_paper(self, paper_id: str) -> bool:
     async def list_papers(self) -> list[str]:
         """List all stored paper IDs."""
         logger.info(f"Listing papers in {self.storage_path}")
-        paper_ids = [p.stem for p in self.storage_path.glob("*.md")]
+        paper_ids = [
+            logical_arxiv_id_from_stem(p.stem) for p in self.storage_path.glob("*.md")
+        ]
         logger.info(f"Found {len(paper_ids)} papers")
         return paper_ids
 
```

**File**: `src/arxiv_mcp_server/tools/arxiv_ids.py` (modified, +28/-0)
```diff
@@ -80,3 +80,31 @@ def arxiv_version_number(paper_id: str) -> int:
     if suffix is None:
         return -1
     return int(suffix[1:])
+
+
+def filesystem_arxiv_stem(paper_id: str) -> str:
+    """Map a logical arXiv ID to a flat on-disk stem.
+
+    Legacy category IDs contain ``/`` (e.g. ``hep-th/9901001``). Embedding that
+    slash in a path creates an uncreated parent directory and crashes writers.
+    Match the LaTeX cache convention and replace ``/`` with ``__`` so files stay
+    flat under ``STORAGE_PATH``.
+    """
+    return paper_id.replace("/", "__")
+
+
+def logical_arxiv_id_from_stem(stem: str) -> str:
+    """Restore a logical arXiv ID from an on-disk stem.
+
+    Inverse of :func:`filesystem_arxiv_stem`. Stems without ``__`` are returned
+    unchanged. Restored forms are preferred only when they look like valid
+    (possibly versioned) arXiv IDs.
+    """
+    if "__" not in stem:
+        return stem
+    restored = stem.replace("__", "/")
+    if is_valid_arxiv_id(restored):
+        return restored
+    if is_valid_arxiv_id(bare_arxiv_id(restored)):
+        return restored
+    return stem
```

**File**: `src/arxiv_mcp_server/tools/download.py` (modified, +39/-6)
```diff
@@ -18,6 +18,8 @@
     arxiv_version_number,
     arxiv_version_suffix,
     bare_arxiv_id,
+    filesystem_arxiv_stem,
+    logical_arxiv_id_from_stem,
     parse_arxiv_id,
 )
 from .list_papers import resolve_stored_stem
@@ -445,10 +447,17 @@ def _html_to_text(html: str) -> str:
 
 
 def get_paper_path(paper_id: str, suffix: str = ".md") -> Path:
-    """Get the absolute file path for a paper with given suffix."""
+    """Get the absolute file path for a paper with given suffix.
+
+    Legacy slash-form IDs are mapped to a flat stem (``/`` -> ``__``) so the
+    path stays under ``STORAGE_PATH`` without requiring category subdirectories.
+    Parent directories are still created defensively for any nested suffix paths.
+    """
     storage_path = Path(settings.STORAGE_PATH)
     storage_path.mkdir(parents=True, exist_ok=True)
-    return storage_path / f"{paper_id}{suffix}"
+    path = storage_path / f"{filesystem_arxiv_stem(paper_id)}{suffix}"
+    path.parent.mkdir(parents=True, exist_ok=True)
+    return path
 
 
 def _read_extractor_version(paper_id: str) -> int | None:
@@ -521,9 +530,10 @@ def _cleanup_versioned_aliases(storage_id: str) -> None:
             paper_stem = path.stem
         else:
             continue
-        if paper_stem == storage_id:
+        logical_stem = logical_arxiv_id_from_stem(paper_stem)
+        if logical_stem == storage_id:
             continue
-        if bare_arxiv_id(paper_stem) != storage_id:
+        if bare_arxiv_id(logical_stem) != storage_id:
             continue
         try:
             path.unlink()
@@ -1040,11 +1050,34 @@ async def handle_download(arguments: Dict[str, Any]) -> List[types.TextContent]:
                 ),
             )
         ]
+    except OSError:
+        # Never leak absolute host paths from filesystem errors to the client.
+        safe_id = locals().get("storage_id") or locals().get("paper_id") or "unknown"
+        logger.exception("Storage error downloading %s", safe_id)
+        return [
+            types.TextContent(
+                type="text",
+                text=json.dumps(
+                    {
+                        "status": "error",
+                        "message": f"Storage error while saving paper {safe_id}",
+                    }
+                ),
+            )
+        ]
     except Exception as e:
-        logger.exception(f"Unexpected error downloading {paper_id}")
+        safe_id = locals().get("paper_id") or "unknown"
+        logger.exception("Unexpected error downloading %s", safe_id)
+        message = str(e)
+        try:
+            storage_root = str(Path(settings.STORAGE_PATH))
+            if storage_root and storage_root in message:
+                message = message.replace(storage_root, "<storage>")
+        except Exception:
+            pass
         return [
             types.TextContent(
                 type="text",
-                text=json.dumps({"status": "error", "message": f"Error: {str(e)}"}),
+                text=json.dumps({"status": "error", "message": f"Error: {message}"}),
             )
         ]
```

**File**: `src/arxiv_mcp_server/tools/list_papers.py` (modified, +24/-9)
```diff
@@ -13,7 +13,9 @@
     arxiv_version_number,
     arxiv_version_suffix,
     bare_arxiv_id,
+    filesystem_arxiv_stem,
     is_valid_arxiv_id,
+    logical_arxiv_id_from_stem,
     normalize_arxiv_id,
 )
 
@@ -52,15 +54,22 @@
 
 
 def _raw_stored_stems(storage_path: Optional[Path] = None) -> list[str]:
-    """Return every on-disk ``.md`` stem that looks like an arXiv ID."""
+    """Return every on-disk ``.md`` stem that looks like an arXiv ID.
+
+    Filenames use a flat stem (legacy ``/`` stored as ``__``); returned values
+    are logical arXiv IDs with the slash restored.
+    """
     storage = Path(storage_path or settings.STORAGE_PATH)
     if not storage.exists():
         return []
-    return [
-        p.stem
-        for p in storage.iterdir()
-        if p.is_file() and p.suffix == ".md" and is_valid_arxiv_id(p.stem)
-    ]
+    stems: list[str] = []
+    for p in storage.iterdir():
+        if not (p.is_file() and p.suffix == ".md"):
+            continue
+        logical = logical_arxiv_id_from_stem(p.stem)
+        if is_valid_arxiv_id(logical):
+            stems.append(logical)
+    return stems
 
 
 def _stems_for_bare_id(
@@ -92,7 +101,7 @@ def _sidecar_arxiv_version(
 ) -> Optional[str]:
     """Read ``arxiv_version`` from a stem's sidecar, if present."""
     path = (
-        Path(storage_path) / f"{stem}{METADATA_SUFFIX}"
+        Path(storage_path) / f"{filesystem_arxiv_stem(stem)}{METADATA_SUFFIX}"
         if storage_path is not None
         else paper_metadata_path(stem)
     )
@@ -195,7 +204,12 @@ def list_papers() -> list[str]:
 
 def paper_metadata_path(paper_id: str) -> Path:
     """Return the sidecar path for locally stored paper metadata."""
-    return Path(settings.STORAGE_PATH) / f"{paper_id}{METADATA_SUFFIX}"
+    path = (
+        Path(settings.STORAGE_PATH)
+        / f"{filesystem_arxiv_stem(paper_id)}{METADATA_SUFFIX}"
+    )
+    path.parent.mkdir(parents=True, exist_ok=True)
+    return path
 
 
 def save_paper_metadata(
@@ -210,6 +224,7 @@ def save_paper_metadata(
 ) -> None:
     """Persist lightweight paper metadata next to the downloaded markdown."""
     destination = path or paper_metadata_path(paper_id)
+    destination.parent.mkdir(parents=True, exist_ok=True)
     payload = {
         "id": paper_id,
         "title": title or None,
@@ -229,7 +244,7 @@ def save_paper_metadata(
 
 def _title_from_markdown(paper_id: str) -> Optional[str]:
     """Best-effort title from the first non-empty markdown line (local only)."""
-    md_path = Path(settings.STORAGE_PATH) / f"{paper_id}.md"
+    md_path = Path(settings.STORAGE_PATH) / f"{filesystem_arxiv_stem(paper_id)}.md"
     try:
         for line in md_path.read_text(encoding="utf-8").splitlines():
             text = line.strip().lstrip("#").strip()
```

**File**: `src/arxiv_mcp_server/tools/read_paper.py` (modified, +4/-1)
```diff
@@ -9,6 +9,7 @@
 from .arxiv_ids import (
     arxiv_version_suffix,
     bare_arxiv_id,
+    filesystem_arxiv_stem,
     normalize_arxiv_id,
     parse_arxiv_id,
 )
@@ -124,7 +125,9 @@ async def handle_read_paper(arguments: Dict[str, Any]) -> List[types.TextContent
             ]
 
         # Get paper content
-        content = (storage / f"{resolved}.md").read_text(encoding="utf-8")
+        content = (storage / f"{filesystem_arxiv_stem(resolved)}.md").read_text(
+            encoding="utf-8"
+        )
 
         bare = bare_arxiv_id(resolved)
         version = _sidecar_arxiv_version(resolved, storage) or arxiv_version_suffix(
```

**File**: `tests/tools/test_arxiv_ids.py` (modified, +15/-0)
```diff
@@ -6,7 +6,9 @@
     arxiv_version_number,
     arxiv_version_suffix,
     bare_arxiv_id,
+    filesystem_arxiv_stem,
     is_valid_arxiv_id,
+    logical_arxiv_id_from_stem,
     normalize_arxiv_id,
     parse_arxiv_id,
 )
@@ -98,3 +100,16 @@ def test_arxiv_version_suffix(raw, expected):
 def test_arxiv_version_number_orders_versions():
     assert arxiv_version_number("1706.03762") == -1
     assert arxiv_version_number("1706.03762v3") < arxiv_version_number("1706.03762v7")
+
+
+@pytest.mark.parametrize(
+    "logical, stem",
+    [
+        ("hep-th/9901001", "hep-th__9901001"),
+        ("quant-ph/0101001v2", "quant-ph__0101001v2"),
+        ("1706.03762v7", "1706.03762v7"),
+    ],
+)
+def test_filesystem_stem_roundtrip(logical, stem):
+    assert filesystem_arxiv_stem(logical) == stem
+    assert logical_arxiv_id_from_stem(stem) == logical
```

**File**: `tests/tools/test_legacy_id_storage.py` (added, +182/-0)
```diff
@@ -0,0 +1,182 @@
+"""Regression: legacy slash-form arXiv IDs must store without FileNotFoundError (#254)."""
+
+import json
+
+import pytest
+
+from arxiv_mcp_server.tools import download as download_module
+from arxiv_mcp_server.tools import list_papers as list_papers_module
+from arxiv_mcp_server.tools import read_paper as read_module
+from arxiv_mcp_server.tools.arxiv_ids import (
+    filesystem_arxiv_stem,
+    logical_arxiv_id_from_stem,
+)
+from arxiv_mcp_server.tools.download import (
+    EXTRACTOR_VERSION,
+    get_paper_path,
+    handle_download,
+)
+from arxiv_mcp_server.tools.list_papers import handle_list_papers
+from arxiv_mcp_server.tools.read_paper import handle_read_paper
+
+LEGACY_IDS = ("hep-th/9901001", "quant-ph/0101001", "math-ph/0001001")
+
+
+@pytest.mark.parametrize(
+    "logical, expected_stem",
+    [
+        ("hep-th/9901001", "hep-th__9901001"),
+        ("quant-ph/0101001", "quant-ph__0101001"),
+        ("math-ph/0001001", "math-ph__0001001"),
+        ("1706.03762", "1706.03762"),
+        ("hep-th/9901001v1", "hep-th__9901001v1"),
+    ],
+)
+def test_filesystem_arxiv_stem_flattens_legacy_slash(logical, expected_stem):
+    assert filesystem_arxiv_stem(logical) == expected_stem
+    assert logical_arxiv_id_from_stem(expected_stem) == logical
+
+
+def test_get_paper_path_legacy_id_is_flat(temp_storage_path, monkeypatch):
+    """get_paper_path must not nest under an uncreated category directory."""
+    monkeypatch.setattr(
+        download_module.settings,
+        "_get_storage_path_from_args",
+        lambda: temp_storage_path,
+    )
+    path = get_paper_path("hep-th/9901001", ".md")
+    assert path.parent == temp_storage_path.resolve()
+    assert path.name == "hep-th__9901001.md"
+    # Parent exists so a subsequent write cannot FileNotFoundError.
+    assert path.parent.is_dir()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("paper_id", LEGACY_IDS)
+async def test_download_legacy_slash_id_writes_markdown(
+    temp_storage_path, mocker, monkeypatch, paper_id
+):
+    """download_paper on legacy IDs succeeds and writes a flat storage file."""
+    monkeypatch.setattr(
+        download_module.settings,
+        "_get_storage_path_from_args",
+        lambda: temp_storage_path,
+    )
+    monkeypatch.setattr(
+        list_papers_module.settings,
+        "_get_storage_path_from_args",
+        lambda: temp_storage_path,
+    )
+    mocker.patch.object(
+        download_module,
+        "_fetch_html_content",
+        return_value=f"# Legacy {paper_id}\nBody text for regression.",
+    )
+    mocker.patch.object(
+        download_module,
+        "_fetch_arxiv_metadata",
+        return_value={
+            "title": f"Legacy paper {paper_id}",
+            "authors": ["Test Author"],
+            "published": "1999-01-01T00:00:00Z",
+            "arxiv_version": "v1",
+        },
+    )
+    mocker.patch.object(download_module, "_fetch_pdf_content")
+
+    response = await handle_download({"paper_id": paper_id})
+    result = json.loads(response[0].text)
+
+    assert result["status"] == "success", result
+    assert result["paper_id"] == paper_id
+    assert result["source"] == "html"
+    assert "Body text for regression." in result["content"]
+
+    flat = temp_storage_path / f"{filesystem_arxiv_stem(paper_id)}.md"
+    assert flat.exists()
+    # No category subdirectory should have been created.
+    category = paper_id.split("/", 1)[0]
+    assert not (temp_storage_path / category).exists()
+
+    sidecar = temp_storage_path / f"{filesystem_arxiv_stem(paper_id)}.meta.json"
+    assert sidecar.exists()
+    meta = json.loads(sidecar.read_text(encoding="utf-8"))
+    assert meta["id"] == paper_id
+    assert meta["extractor_version"] == EXTRACTOR_VERSION
+
+
+@pytest.mark.asyncio
+async def test_list_and_read_roundtrip_legacy_id(
+    temp_storage_path, mocker, monkeypatch
+):
+    """Listed and read paths resolve the sanitized flat stem back to the slash ID."""
+    paper_id = "hep-th/9901001"
+    for module in (download_module, list_papers_module, read_module):
+        monkeypatch.setattr(
+            module.settings,
+            "_get_storage_path_from_args",
+            lambda: temp_storage_path,
+        )
+    mocker.patch.object(
+        download_module,
+        "_fetch_html_content",
+        return_value="# Roundtrip\nLegacy body",
+    )
+    mocker.patch.object(
+        download_module,
+        "_fetch_arxiv_metadata",
+        return_value={
+            "title": "Roundtrip Legacy",
+            "authors": ["A"],
+            "published": "1999-01-01T00:00:00Z",
+            "arxiv_version": "v1",
+        },
+    )
+    mocker.patch.object(download_module, "_fetch_pdf_content")
+
+    download = await handle_download({"paper_id": paper_id})
+    assert json.loads(download[0].text)["status"] == "success"
+
+    listed = json.loads((await handle_list_papers({"compact": True}))[0].text)
+    assert paper_id in listed["papers"]
+
+ 
```

---

### Incident Patch 9: `dcfb03b3` (2026-08-23)
**Commit Message**: fix: join decorative HTML title letter spans (#258) (#265)

Coalesce document-title text nodes so underlined acronym glyphs and
italic name spans reassemble into one title line (DAOP letter-split,
ExpertFlow orphaned subtitle colon). Bump EXTRACTOR_VERSION to 6.

**File**: `src/arxiv_mcp_server/tools/download.py` (modified, +41/-4)
```diff
@@ -130,7 +130,7 @@ async def shutdown_background_tasks() -> None:
 
 # Bump when HTML extraction changes so cached markdown is treated as stale
 # and re-downloaded without requiring the caller to pass force=true.
-EXTRACTOR_VERSION = 5
+EXTRACTOR_VERSION = 6
 
 
 # ---------------------------------------------------------------------------
@@ -147,8 +147,10 @@ class _ArticleTextExtractor(HTMLParser):
       - Skip script/style/nav/header/footer plus arXiv UI widgets.
       - Skip author-note chrome (Thanks/ORCID/affiliation/email blocks).
       - Skip conference/DOI/ISBN/CCS pubnotes and date/license chrome.
-      - Coalesce author lines; drop affiliation superscripts and TeX
-        superscript debris in the author block.
+      - Coalesce decorative letter-span titles into one line (keep
+        subtitle colons attached); coalesce author lines; drop
+        affiliation superscripts and TeX superscript debris in the
+        author block.
       - Skip footnotemark markers (class, role, or the literal token).
       - Skip license/permission one-liners and ICML/LaTeX page-layout
         style warnings (marginparsep and similar) that appear before the
@@ -253,6 +255,9 @@ def __init__(self):
         self._authors_depth: int = 0
         self._authors_stack: list[bool] = []
         self._author_buf: list[str] = []
+        self._title_depth: int = 0
+        self._title_stack: list[bool] = []
+        self._title_buf: list[str] = []
 
     def _should_skip(self, tag: str, attr_map: dict[str, str]) -> bool:
         if tag in self.SKIP_TAGS:
@@ -293,6 +298,17 @@ def _flush_authors(self) -> None:
         if line:
             self._append_chunk(line)
 
+    def _flush_title(self) -> None:
+        """Join decorative title letter spans into one coherent line."""
+        if not self._title_buf:
+            return
+        # Concatenate raw pieces so underlined acronym letters reattach
+        # to the rest of each word (D+ata- → Data-), then collapse space.
+        line = re.sub(r"\s+", " ", "".join(self._title_buf)).strip()
+        self._title_buf = []
+        if line:
+            self._append_chunk(line)
+
     def _append_chunk(self, text: str) -> None:
         if self._article_depth > 0:
             self._article_chunks.append(text)
@@ -306,6 +322,9 @@ def _emit(self, text: str) -> None:
             return
         if not self._seen_title and self._is_pre_title_chrome(text):
             return
+        if self._title_depth > 0:
+            self._title_buf.append(text)
+            return
         if self._authors_depth > 0:
             self._author_buf.append(text)
             return
@@ -319,14 +338,19 @@ def handle_starttag(self, tag: str, attrs):
         if tag in {"h1", "h2"} or "ltx_title" in classes:
             self._seen_title = True
 
+        # Document title only — not abstract/section ``ltx_title_*``.
+        entering_title = tag == "h1" or "ltx_title_document" in classes
+        if entering_title:
+            self._title_depth += 1
+
         entering_authors = "ltx_authors" in classes
         if entering_authors:
             self._authors_depth += 1
 
         # Void elements have no children. Incrementing skip_depth for
         # <input> etc. and never seeing an end tag left the rest of the
         # document, including <article>, permanently skipped. Do not push
-        # authors_stack either — void tags have no matching endtag.
+        # authors/title stacks either — void tags have no matching endtag.
         if tag in self.VOID_TAGS:
             return
 
@@ -349,11 +373,16 @@ def handle_starttag(self, tag: str, attrs):
         if skip:
             self._skip_depth += 1
         self._skip_stack.append(skip)
+        self._title_stack.append(entering_title)
         self._authors_stack.append(entering_authors)
 
     def handle_endtag(self, tag: str):
         if self._skip_stack and self._skip_stack.pop():
             self._skip_depth = max(0, self._skip_depth - 1)
+        if self._title_stack and self._title_stack.pop():
+            self._title_depth = max(0, self._title_depth - 1)
+            if self._title_depth == 0:
+                self._flush_title()
         if self._authors_stack and self._authors_stack.pop():
             self._authors_depth = max(0, self._authors_depth - 1)
             if self._authors_depth == 0:
@@ -368,9 +397,17 @@ def handle_startendtag(self, tag: str, attrs):
         self.handle_endtag(tag)
 
     def handle_data(self, data: str):
+        # Title letter spans must keep surrounding whitespace so
+        # ``D``+``ata-`` reassemble; do not strip until flush.
+        if self._title_depth > 0 and not self._skip_depth:
+            if data:
+                self._title_buf.append(data)
+            return
         self._emit(data.strip())
 
     def get_text(self) -> str:
+        if self._title_depth > 0:
+            self._flush_title()
         if self._authors_depth > 0:
             self._flush_authors()
      
```

**File**: `tests/tools/test_download_html_title.py` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+"""HTML extract: join decorative title letter spans / subtitle colon (#258)."""
+
+from arxiv_mcp_server.tools.download import EXTRACTOR_VERSION, _html_to_text
+
+# DAOP (2501.10375): underlined acronym letters are one glyph per <span>.
+DAOP_LETTER_TITLE_HTML = """
+<html>
+  <body>
+    <article class="ltx_document">
+      <h1 class="ltx_title ltx_title_document">DAOP: <span id="id1" class="ltx_text ltx_underline">D</span>ata-<span id="id2" class="ltx_text ltx_underline">A</span>ware <span id="id3" class="ltx_text ltx_underline">O</span>ffloading and Predictive <span id="id4" class="ltx_text ltx_underline">P</span>re-Calculation for Efficient MoE Inference
+        <span class="ltx_pubnotes">
+          <span class="ltx_pubnotes_content">
+            <span class="ltx_pubnote ltx_role_thanks">
+              <span class="ltx_note_name">Thanks: </span>
+              Proceedings of the DATE Conference
+            </span>
+          </span>
+        </span>
+      </h1>
+      <div class="ltx_authors">
+        <span class="ltx_personname">Yujie Zhang</span>
+      </div>
+      <div class="ltx_abstract">
+        <h6 class="ltx_title ltx_title_abstract">Abstract</h6>
+        <p>Mixture-of-Experts models face deployment challenges.</p>
+      </div>
+    </article>
+  </body>
+</html>
+"""
+
+# ExpertFlow (2410.17954): italic name span then ``:`` subtitle fragment.
+EXPERTFLOW_TITLE_COLON_HTML = """
+<html>
+  <body>
+    <article class="ltx_document">
+      <h1 class="ltx_title ltx_title_document"><span id="id1" class="ltx_text ltx_font_italic">ExpertFlow</span>: Optimized Expert Activation and Token Allocation for Efficient Mixture-of-Experts Inference
+        <span class="ltx_pubnotes">
+          <span class="ltx_pubnote ltx_role_doi">
+            <span class="ltx_note_name">DOI: </span>10.1145/example
+          </span>
+        </span>
+      </h1>
+      <div class="ltx_authors">
+        <span class="ltx_personname">Xin He</span>
+      </div>
+      <div class="ltx_abstract">
+        <h6 class="ltx_title ltx_title_abstract">Abstract.</h6>
+        <p>Sparse Mixture of Experts models face inference challenges.</p>
+      </div>
+    </article>
+  </body>
+</html>
+"""
+
+
+def test_extractor_version_bumped_for_title_letter_join():
+    """#175 auto-invalidates old DAOP/ExpertFlow caches after this change."""
+    assert EXTRACTOR_VERSION >= 6
+
+
+def test_html_to_text_joins_decorative_title_letter_spans():
+    text = _html_to_text(DAOP_LETTER_TITLE_HTML)
+    expected = (
+        "DAOP: Data-Aware Offloading and Predictive "
+        "Pre-Calculation for Efficient MoE Inference"
+    )
+    assert expected in text
+    # Must not remain letter-per-line after conversion.
+    assert "\nD\n" not in text
+    assert "\nA\n" not in text
+    assert "\nO\n" not in text
+    assert "\nP\n" not in text
+    assert "Proceedings of the DATE Conference" not in text
+    assert "Abstract" in text
+    assert "Mixture-of-Experts models face deployment challenges." in text
+
+
+def test_html_to_text_keeps_subtitle_colon_on_title_line():
+    text = _html_to_text(EXPERTFLOW_TITLE_COLON_HTML)
+    expected = (
+        "ExpertFlow: Optimized Expert Activation and Token Allocation "
+        "for Efficient Mixture-of-Experts Inference"
+    )
+    assert expected in text
+    assert "\n: " not in text
+    assert text.splitlines()[0] == expected
+    assert "10.1145/example" not in text
+    assert "Abstract." in text
```

---

### Incident Patch 10: `14977285` (2026-08-23)
**Commit Message**: fix: keep numbered body lists out of paper outlines (#257) (#264)

HTML→text papers like Switch Transformers (2101.03961) promote Future
Work list items (`4.` / `5.` sentence-case prose) into fake L1 sections.
Reject numbered/roman titles that are sentence case or end with `.`
(unless a known bare title), without fuzzy section-title matching.

Closes #257

**File**: `src/arxiv_mcp_server/tools/paper_outline.py` (modified, +67/-1)
```diff
@@ -59,6 +59,44 @@
 _OUTLINE_TERMINATORS = frozenset({"reference", "references", "bibliography"})
 # Top-level section indices stay small; years like 2023 USENIX… are common FPs.
 _MAX_SECTION_INDEX = 99
+# Minor words allowed lowercase inside otherwise Title-Case headings.
+_TITLE_CASE_MINOR_WORDS = frozenset(
+    {
+        "a",
+        "an",
+        "the",
+        "and",
+        "or",
+        "nor",
+        "but",
+        "so",
+        "yet",
+        "of",
+        "for",
+        "to",
+        "in",
+        "on",
+        "at",
+        "by",
+        "as",
+        "per",
+        "via",
+        "vs",
+        "with",
+        "from",
+        "into",
+        "onto",
+        "over",
+        "than",
+        "upon",
+        "de",
+        "von",
+        "van",
+        "der",
+        "la",
+        "le",
+    }
+)
 
 # Common standalone section titles from arXiv HTML→md conversions.
 _BARE_SECTION_TITLES = frozenset(
@@ -186,8 +224,28 @@ def _is_outline_terminator(title: str) -> bool:
     return _normalize_heading_title(title).casefold() in _OUTLINE_TERMINATORS
 
 
+def _is_title_case_phrase(title: str) -> bool:
+    """True when the phrase looks Title Case, not sentence-case body prose."""
+    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9'’.-]*", title)
+    if not words:
+        return False
+    for word in words[1:]:
+        core = word.rstrip(".")
+        if not core:
+            continue
+        # Allow ALLCAPS / Title Case tokens; reject sentence-case content words.
+        if core[0].islower() and core.casefold() not in _TITLE_CASE_MINOR_WORDS:
+            return False
+    return True
+
+
 def _title_looks_like_heading(title: str, *, line_len: int) -> bool:
-    """Shared capitalization / length / venue guards for numbered headings."""
+    """Shared capitalization / length / venue guards for numbered headings.
+
+    Rejects numbered body-list items (e.g. Future Work ``4.`` / ``5.`` prose)
+    that HTML→text otherwise promotes to fake L1 sections. Does not use fuzzy
+    title matching against known section names.
+    """
     title = title.strip()
     if not title or line_len > _MAX_BARE_TITLE_CHARS:
         return False
@@ -197,6 +255,14 @@ def _title_looks_like_heading(title: str, *, line_len: int) -> bool:
     # Citation venues often look like "USENIX ATC 23" after a year number.
     if re.search(r"\b(?:19|20)\d{2}\b", title):
         return False
+    normalized = _normalize_heading_title(title)
+    # Full-sentence list items end with ``.``; allow only known bare titles
+    # such as ``Abstract.`` / ``Introduction.``.
+    if title.endswith(".") and normalized.casefold() not in _BARE_SECTION_TITLES:
+        return False
+    # Headings are Title Case noun phrases; body lists are sentence case.
+    if not _is_title_case_phrase(normalized):
+        return False
     return True
 
 
```

**File**: `tests/tools/test_paper_outline.py` (modified, +109/-0)
```diff
@@ -786,6 +786,115 @@ def test_daop_ieee_roman_html_outline_order_without_dupes():
     assert "illustrates similarity" not in titles
 
 
+SWITCH_FUTURE_WORK_HTML_STYLE = """Switch Transformers title line
+
+1.
+Introduction
+
+Intro body about sparse models.
+
+8.
+Future Work
+
+This paper lays out a simplified architecture, improved training procedures,
+and a study of how sparse models scale. However, there remain many open
+future directions which we briefly describe here:
+
+1.
+A significant challenge is further improving training stability for the largest models.
+
+2.
+Generally we find that improved pre-training quality leads to better downstream results.
+
+3.
+Perform a comprehensive study of scaling relationships to guide the design.
+
+4.
+Our work falls within the family of adaptive computation algorithms.
+
+5.
+Investigating expert layers outside the FFN layer of the Transformer.
+
+6.
+Examining Switch Transformer in new and across different modalities.
+
+9.
+Conclusion
+
+Conclusion body.
+
+References
+
+[1] Someone et al.
+"""
+
+
+def test_switch_future_work_numbered_lists_not_outline_sections():
+    """Regression for #257: Switch Transformers Future Work list items.
+
+    HTML→text emits ``4.`` / ``5.`` body-list sentences under Future Work.
+    Those must not become fake L1 outline sections.
+    """
+    sections = parse_markdown_sections(SWITCH_FUTURE_WORK_HTML_STYLE)
+    titles = [s.title for s in sections]
+    assert "Future Work" in titles
+    assert "Conclusion" in titles
+    assert "Introduction" in titles
+    assert titles[-1] == "References"
+    # Numbered body-list prose must stay out of the outline.
+    for banned in (
+        "Our work falls within the family of adaptive computation algorithms",
+        "Investigating expert layers outside the FFN layer of the Transformer",
+        "Examining Switch Transformer in new and across different modalities",
+        "Perform a comprehensive study of scaling relationships to guide the design",
+        "A significant challenge is further improving training stability for the largest models",
+        "Generally we find that improved pre-training quality leads to better downstream results",
+    ):
+        assert banned not in titles
+        assert not any(banned in t for t in titles)
+    # Real numbered sections still parse; list markers do not inflate L1 count.
+    by_title = {s.title: s for s in sections}
+    assert by_title["Introduction"].level == 1
+    assert by_title["Future Work"].level == 1
+    assert by_title["Conclusion"].level == 1
+    assert [s.title for s in sections if s.level == 1] == [
+        "Introduction",
+        "Future Work",
+        "Conclusion",
+        "References",
+    ]
+
+
+def test_numbered_sentence_case_and_period_rejected():
+    """Sentence-case / trailing-period numbered lines are body lists, not headings."""
+    md = """1 Introduction
+
+Body.
+
+2.
+Our approach always used identical homogeneous experts.
+
+3 Methods
+
+Methods body.
+
+4.
+Investigating expert layers outside the feed-forward network.
+
+5 Conclusion
+
+Done.
+
+References
+
+[1] x
+"""
+    titles = [s.title for s in parse_markdown_sections(md)]
+    assert titles == ["Introduction", "Methods", "Conclusion", "References"]
+    assert "Our approach always used identical homogeneous experts" not in titles
+    assert "Investigating expert layers outside the feed-forward network" not in titles
+
+
 def test_roman_inline_and_reject_colon_bare_titles():
     inline = parse_markdown_sections(
         "I Introduction\n\nIntro body.\n\nII-A Background Details\n\nMore.\n"
```

---

### Incident Patch 11: `57256083` (2026-08-23)
**Commit Message**: fix: expose return_full_text on latex tool inputSchemas (#262)

Handlers already honor return_full_text via content pagination, and
next_retrieval tells clients to pass it, but get_paper_latex /
get_paper_latex_section schemas omitted the property under
additionalProperties:false. Add boolean parity with download/read.

Closes #256

**File**: `src/arxiv_mcp_server/tools/latex.py` (modified, +7/-0)
```diff
@@ -260,6 +260,13 @@ def _page_properties() -> dict[str, Any]:
             "maximum": MAX_RETURN_CHARS,
             "description": f"Maximum source characters to return (default {DEFAULT_MAX_CHARS})",
         },
+        "return_full_text": {
+            "type": "boolean",
+            "description": (
+                "Set true to opt out of the bounded default and return the "
+                "entire remaining source or section from start in one call"
+            ),
+        },
     }
 
 
```

**File**: `tests/test_tool_schemas.py` (modified, +3/-3)
```diff
@@ -151,7 +151,7 @@ async def test_tools_list_serialized_size_snapshot():
     # Soft ceiling: after shrinking search_papers, total list should stay well
     # under the pre-change ~16k measurement on main @94a1317.
     assert search_chars < 3000
-    # Soft ceiling allows abstract_mode (#128) and markdown outline tools (#129)
-    # on top of the #131 shrink.
-    assert total_chars < 17500
+    # Soft ceiling allows abstract_mode (#128), markdown outline tools (#129),
+    # and latex return_full_text schema parity (#256) on top of the #131 shrink.
+    assert total_chars < 18000
     assert len(search.description) < 1500
```

**File**: `tests/tools/test_latex.py` (modified, +7/-0)
```diff
@@ -433,9 +433,16 @@ def test_tool_schemas_are_closed_and_content_is_bounded():
     assert latex.get_paper_latex_tool.inputSchema["additionalProperties"] is False
     props = latex.get_paper_latex_tool.inputSchema["properties"]
     assert props["max_chars"]["maximum"] == latex.MAX_RETURN_CHARS
+    assert "return_full_text" in props
+    assert props["return_full_text"]["type"] == "boolean"
+    assert "start" in props and props["start"]["type"] == "integer"
     assert (
         latex.get_paper_latex_section_tool.inputSchema["additionalProperties"] is False
     )
+    section_props = latex.get_paper_latex_section_tool.inputSchema["properties"]
+    assert "return_full_text" in section_props
+    assert section_props["return_full_text"]["type"] == "boolean"
+    assert "start" in section_props and "max_chars" in section_props
 
 
 @pytest.mark.asyncio
```

---

### Incident Patch 12: `56dd4060` (2026-08-23)
**Commit Message**: fix(export_citations): collapse identical normalized paper IDs (#263)

Exact-duplicate paper_ids (e.g. 1706.03762 twice, or v7+v7) now emit a
single BibTeX entry. Bare+versioned sibling prefer-versioned collapse
from #241 is unchanged. Closes #259.

**File**: `src/arxiv_mcp_server/tools/export_citations.py` (modified, +8/-2)
```diff
@@ -4,8 +4,8 @@
 work), one ``export_citations`` tool over one or more validated arXiv IDs, metadata
 taken from the arXiv API (never model-generated), version suffixes preserved where the
 caller supplies them, bare+versioned forms of the same paper collapsed to one entry
-(preferring the versioned id), deterministic citation keys, and no heavy formatting
-dependency.
+(preferring the versioned id), identical normalized IDs collapsed to one entry,
+deterministic citation keys, and no heavy formatting dependency.
 """
 
 import json
@@ -242,6 +242,7 @@ async def handle_export_citations(arguments: Dict[str, Any]) -> List[types.TextC
 
         results: List[Dict[str, Any]] = []
         used_keys: set = set()
+        seen_normalized: set = set()
         for pid in raw_ids:
             candidate = normalize_arxiv_id(pid) if isinstance(pid, str) else ""
             if not candidate or not is_valid_arxiv_id(candidate):
@@ -258,6 +259,11 @@ async def handle_export_citations(arguments: Dict[str, Any]) -> List[types.TextC
                 and _base_id(candidate) in bare_superseded
             ):
                 continue
+            # Collapse exact-duplicate normalized IDs to one BibTeX entry (#259).
+            # Bare↔versioned sibling collapse remains prefer-versioned (#241).
+            if candidate in seen_normalized:
+                continue
+            seen_normalized.add(candidate)
             # Prefer the exact versioned key so batching multiple versions of
             # one paper does not collapse to a single bare-id entry (#212).
             # Bare ids fall through to the latest-version mapping.
```

**File**: `tests/tools/test_export_citations.py` (modified, +74/-0)
```diff
@@ -494,6 +494,80 @@ async def _fake(ids):
     ]
 
 
+@pytest.mark.asyncio
+async def test_exact_duplicate_bare_ids_one_bibtex(monkeypatch):
+    """Identical bare IDs collapse to one BibTeX entry (#259)."""
+    _stub_metadata(
+        monkeypatch,
+        [
+            _paper(
+                "1706.03762",
+                "Attention Is All You Need",
+                ["Ashish Vaswani"],
+                published="2017-06-12T00:00:00Z",
+            )
+        ],
+    )
+    payload = await _run({"paper_ids": ["1706.03762", "1706.03762"]})
+    assert payload["status"] == "success"
+    assert payload["bibtex"].count("@misc{") == 1
+    assert payload["count"]["succeeded"] == 1
+    assert payload["count"]["failed"] == 0
+    assert len(payload["results"]) == 1
+    assert payload["results"][0]["paper_id"] == "1706.03762"
+    assert "eprint = {1706.03762}" in payload["bibtex"]
+
+
+@pytest.mark.asyncio
+async def test_exact_duplicate_versioned_ids_one_bibtex(monkeypatch):
+    """Identical versioned IDs (e.g. v7+v7) collapse to one BibTeX entry (#259)."""
+    paper = _paper(
+        "1706.03762",
+        "Attention Is All You Need",
+        ["Ashish Vaswani"],
+        published="2023-08-02T00:00:00Z",
+        versioned_id="1706.03762v7",
+    )
+    _stub_metadata(monkeypatch, [paper])
+    payload = await _run({"paper_ids": ["1706.03762v7", "1706.03762v7"]})
+    assert payload["status"] == "success"
+    assert payload["bibtex"].count("@misc{") == 1
+    assert payload["count"]["succeeded"] == 1
+    assert payload["count"]["failed"] == 0
+    assert len(payload["results"]) == 1
+    assert payload["results"][0]["paper_id"] == "1706.03762v7"
+    assert "eprint = {1706.03762v7}" in payload["bibtex"]
+
+
+@pytest.mark.asyncio
+async def test_exact_duplicates_keep_bare_versioned_prefer_versioned(monkeypatch):
+    """Exact-dup collapse coexists with #241 bare+versioned prefer-versioned."""
+    paper = _paper(
+        "1706.03762",
+        "Attention Is All You Need",
+        ["Ashish Vaswani"],
+        published="2023-08-02T00:00:00Z",
+        versioned_id="1706.03762v7",
+    )
+    _stub_metadata(monkeypatch, [paper])
+    payload = await _run(
+        {
+            "paper_ids": [
+                "1706.03762",
+                "1706.03762",
+                "1706.03762v7",
+                "1706.03762v7",
+            ]
+        }
+    )
+    assert payload["status"] == "success"
+    assert payload["bibtex"].count("@misc{") == 1
+    assert payload["count"]["succeeded"] == 1
+    assert len(payload["results"]) == 1
+    assert payload["results"][0]["paper_id"] == "1706.03762v7"
+    assert "eprint = {1706.03762v7}" in payload["bibtex"]
+
+
 def test_bares_with_versioned_sibling_helper():
     assert ec._bares_with_versioned_sibling(["2410.17954", "2410.17954v2"]) == {
         "2410.17954"
```

---

### Incident Patch 13: `95faeb76` (2026-08-23)
**Commit Message**: fix(alerts): return JSON rate_limited on arXiv 429 in check_alerts (#261)

Catch ArxivRateLimitError in handle_check_alerts and use
_rate_limited_response for parity with search_papers (#238).
Closes #255.

**File**: `src/arxiv_mcp_server/tools/alerts.py` (modified, +13/-1)
```diff
@@ -14,7 +14,11 @@
 from dateutil import parser
 
 from ..config import Settings
-from .search import _raw_arxiv_search
+from .search import (
+    ArxivRateLimitError,
+    _rate_limited_response,
+    _raw_arxiv_search,
+)
 
 logger = logging.getLogger("arxiv-mcp-server")
 settings = Settings()
@@ -412,6 +416,14 @@ async def handle_check_alerts(arguments: Dict[str, Any]) -> List[types.TextConte
             "alerts": alerts,
         }
         return [types.TextContent(type="text", text=json.dumps(result, indent=2))]
+    except ArxivRateLimitError as exc:
+        # Parity with search_papers (#238): structured rate_limited JSON, not bare Error:
+        logger.warning("check_alerts rate limited after retries: %s", exc)
+        return _rate_limited_response(
+            str(exc),
+            retry_after_seconds=exc.retry_after_seconds,
+            status_code=exc.status_code,
+        )
     except Exception as exc:
         logger.error("check_alerts error: %s", exc)
         return [types.TextContent(type="text", text=f"Error: {str(exc)}")]
```

**File**: `tests/tools/test_alerts.py` (modified, +26/-0)
```diff
@@ -776,3 +776,29 @@ async def _mock_future(**kwargs):
     assert result["alerts"][0]["new_paper_count"] == 1
     assert result["alerts"][0]["new_papers"][0]["id"] == "2608.00001"
     assert result["alerts"][0]["has_more"] is False
+
+
+@pytest.mark.asyncio
+async def test_check_alerts_429_returns_rate_limited_json(monkeypatch, alerts_test_env):
+    """Regression #255: arXiv 429 must return JSON status=rate_limited, not Error: text."""
+    from arxiv_mcp_server.tools.search import ArxivRateLimitError
+
+    async def _raise_rate_limit(**kwargs):
+        raise ArxivRateLimitError(
+            "arXiv is rate limiting this IP (HTTP 429). Please wait before retrying.",
+            status_code=429,
+            retry_after_seconds=30.0,
+        )
+
+    monkeypatch.setattr(alerts_module, "_raw_arxiv_search", _raise_rate_limit)
+
+    await alerts_module.handle_watch_topic({"topic": "rate-limit-demo"})
+    response = await alerts_module.handle_check_alerts({})
+
+    assert len(response) >= 1
+    assert not response[0].text.startswith("Error:")
+    payload = json.loads(response[0].text)
+    assert payload["status"] == "rate_limited"
+    assert "HTTP 429" in payload["message"] or "rate limiting" in payload["message"]
+    assert payload["http_status"] == 429
+    assert payload["retry_after_seconds"] == 30.0
```

---

### Incident Patch 14: `9f2e4098` (2026-08-23)
**Commit Message**: fix: content_warning first-chunk consistency for pagination (#244) (#252)

Key first-chunk warning emission off requested start (not clamped page
start) so empty-body start>0 calls omit the field, clear leftover
content_warning on continuations, and lock short banner-free behavior
for read_paper/download_paper across success paths.

Closes #244

**File**: `src/arxiv_mcp_server/tools/content.py` (modified, +14/-5)
```diff
@@ -106,15 +106,24 @@ def add_content_payload(
 
     Never prepend the untrusted-content banner into paginated ``content``
     chunks — that broke stitchability across ``start`` pages (#215). Surface
-    the notice once via a separate ``content_warning`` field on the first page
-    (``start == 0``) instead.
+    a short notice once via a separate ``content_warning`` field on the first
+    chunk (requested ``start == 0``) instead (#230, #244). Continuation pages
+    must not re-embed a long UNTRUSTED banner into ``content`` or repeat the
+    warning field.
     """
+    # First-chunk policy keys off the *requested* offset, not the clamped page
+    # start. Empty papers clamp start>0 down to 0; those must still omit the
+    # warning so later-chunk calls stay consistent (#244).
+    requested_start = _coerce_nonnegative_int(arguments.get("start"), 0)
     page = paginate_content(content, bound_arguments(arguments))
     chunk = page.pop("content")
     payload.update(page)
+    # Pure paper text only — never concatenate the notice into content.
     payload["content"] = chunk
-    if page["start"] == 0:
-        # Separate field: keep notice text without the trailing blank lines
-        # that existed only to separate a prepended banner from the body.
+    if requested_start == 0:
+        # Separate field: keep notice text without trailing blank lines that
+        # existed only to separate a prepended banner from the body.
         payload["content_warning"] = content_warning.rstrip()
+    else:
+        payload.pop("content_warning", None)
     return payload
```

**File**: `tests/tools/test_content.py` (modified, +22/-0)
```diff
@@ -196,3 +196,25 @@ def test_content_warning_is_short_token_efficient():
     assert "UNTRUSTED EXTERNAL CONTENT" in LATEX_CONTENT_WARNING
     assert "LaTeX" in LATEX_CONTENT_WARNING
     assert len(LATEX_CONTENT_WARNING) < 90
+
+
+def test_add_content_payload_empty_paper_start_gt_zero_omits_warning():
+    """Empty body clamps page start to 0; requested start>0 must still omit (#244)."""
+    warning = "[UNTRUSTED EXTERNAL CONTENT — test.]\n\n"
+    page = add_content_payload({}, "", {"start": 10, "max_chars": 50}, warning)
+    assert page["start"] == 0
+    assert page["content"] == ""
+    assert "content_warning" not in page
+
+
+def test_add_content_payload_later_chunk_clears_preexisting_warning_field():
+    """Continuation must not keep a leftover content_warning on the payload (#244)."""
+    warning = "[UNTRUSTED EXTERNAL CONTENT — test.]"
+    payload = {"status": "success", "content_warning": warning}
+    page = add_content_payload(
+        payload, "abcdefghij", {"start": 5, "max_chars": 5}, warning
+    )
+    assert page["start"] == 5
+    assert page["content"] == "fghij"
+    assert "content_warning" not in page
+    assert "UNTRUSTED" not in page["content"]
```

**File**: `tests/tools/test_download.py` (modified, +5/-0)
```diff
@@ -368,6 +368,8 @@ async def test_download_paper_defaults_to_bounded_cached_content(
     assert "next_retrieval" in result
     assert len(result["content"]) == DEFAULT_MAX_CHARS
     assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
+    assert "adversarial instructions" not in result["content_warning"]
     assert "UNTRUSTED" not in result["content"]
     mock_html.assert_not_called()
     mock_pdf.assert_not_called()
@@ -393,3 +395,6 @@ async def test_download_paper_return_full_text_opt_in(temp_storage_path, mocker)
     assert result["is_truncated"] is False
     assert result["returned_chars"] == len(content)
     assert result["next_start"] is None
+    assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
+    assert "UNTRUSTED" not in result["content"]
```

**File**: `tests/tools/test_download_html.py` (modified, +59/-0)
```diff
@@ -211,6 +211,9 @@ async def test_html_endpoint_success(temp_storage_path, mocker):
     assert result["source"] == "html"
     assert result["content"] == html_text
     assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
+    assert "adversarial instructions" not in result["content_warning"]
+    assert "UNTRUSTED" not in result["content"]
     assert (temp_storage_path / f"{paper_id}.md").exists()
     mock_pdf.assert_not_called()
 
@@ -242,6 +245,9 @@ async def test_html_404_falls_back_to_pdf(temp_storage_path, mocker):
     assert result["source"] == "pdf"
     assert result["content"] == pdf_markdown
     assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
+    assert "adversarial instructions" not in result["content_warning"]
+    assert "UNTRUSTED" not in result["content"]
     assert (temp_storage_path / f"{paper_id}.md").exists()
 
 
@@ -419,3 +425,56 @@ async def test_existing_paper_without_html_still_hints_pdf_extra(
     assert result["status"] == "error"
     assert "pdf extra" in result["message"]
     assert "pip install arxiv-mcp-server[pdf]" in result["message"]
+
+
+@pytest.mark.asyncio
+async def test_download_cache_first_chunk_emits_short_content_warning(
+    temp_storage_path, mocker
+):
+    """Cached download_paper start=0 includes short content_warning (#244)."""
+    paper_id = "2410.17954"
+    _patch_path(mocker, temp_storage_path)
+    content = "ExpertFlow " + ("z" * 4000)
+    _stamp(temp_storage_path, paper_id, content)
+    mocker.patch("arxiv_mcp_server.tools.download._fetch_html_content")
+    mocker.patch("arxiv_mcp_server.tools.download._fetch_pdf_content")
+
+    response = await handle_download(
+        {"paper_id": paper_id, "start": 0, "max_chars": 300}
+    )
+    result = json.loads(response[0].text)
+
+    assert result["status"] == "success"
+    assert result["source"] == "cache"
+    assert result["start"] == 0
+    assert result["content"] == content[:300]
+    assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
+    assert "UNTRUSTED" not in result["content"]
+
+
+@pytest.mark.asyncio
+async def test_download_later_chunk_has_no_warning_or_long_banner(
+    temp_storage_path, mocker
+):
+    """download_paper start>0 must not re-embed a long UNTRUSTED banner (#244)."""
+    paper_id = "2410.17954"
+    _patch_path(mocker, temp_storage_path)
+    content = "ExpertFlow " + ("w" * 5000)
+    _stamp(temp_storage_path, paper_id, content)
+    mocker.patch("arxiv_mcp_server.tools.download._fetch_html_content")
+    mocker.patch("arxiv_mcp_server.tools.download._fetch_pdf_content")
+
+    response = await handle_download(
+        {"paper_id": paper_id, "start": 3000, "max_chars": 300}
+    )
+    result = json.loads(response[0].text)
+
+    assert result["status"] == "success"
+    assert result["source"] == "cache"
+    assert result["start"] == 3000
+    assert result["content"] == content[3000:3300]
+    assert "content_warning" not in result
+    assert "UNTRUSTED" not in result["content"]
+    assert "EXTERNAL CONTENT" not in result["content"]
+    assert "adversarial instructions" not in result["content"]
```

**File**: `tests/tools/test_no_version_downgrade.py` (modified, +3/-0)
```diff
@@ -76,6 +76,9 @@ async def test_older_version_without_force_does_not_downgrade(
     assert result["paper_id"] == "1706.03762"
     assert "BLEU 41.8 from v7" in result["content"]
     assert "41.0 from v1" not in result["content"]
+    assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
+    assert "UNTRUSTED" not in result["content"]
     assert (temp_storage_path / "1706.03762.md").read_text(
         encoding="utf-8"
     ) == "# Attention\nBLEU 41.8 from v7"
```

**File**: `tests/tools/test_read_paper.py` (modified, +68/-1)
```diff
@@ -88,6 +88,7 @@ async def test_read_paper_defaults_to_bounded_content(temp_storage_path, monkeyp
     assert "next_start" in result["next_retrieval"]
     assert len(result["content"]) == DEFAULT_MAX_CHARS
     assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
     assert "UNTRUSTED" not in result["content"]
 
 
@@ -110,7 +111,11 @@ async def test_read_paper_short_paper_unchanged_under_default(
     assert result["is_truncated"] is False
     assert result["returned_chars"] == len(content)
     assert result["next_start"] is None
-    assert result["content"].endswith("tiny")
+    assert result["content"] == "tiny"
+    assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
+    assert "UNTRUSTED" not in result["content"]
+    assert "adversarial instructions" not in result["content_warning"]
 
 
 @pytest.mark.asyncio
@@ -134,6 +139,8 @@ async def test_read_paper_return_full_text_opt_in(temp_storage_path, monkeypatch
     assert result["next_start"] is None
     assert result["content"] == content
     assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
+    assert "UNTRUSTED" not in result["content"]
 
 
 @pytest.mark.asyncio
@@ -157,6 +164,66 @@ async def test_read_paper_invalid_offset_clamps_to_end(temp_storage_path, monkey
     assert result["returned_chars"] == 0
     assert result["is_truncated"] is False
     assert result["next_start"] is None
+    assert "content_warning" not in result  # requested start>0 (#244)
+    assert "UNTRUSTED" not in result["content"]
+
+
+@pytest.mark.asyncio
+async def test_read_paper_first_chunk_emits_short_content_warning_field(
+    temp_storage_path, monkeypatch
+):
+    """start=0 surfaces a short content_warning; body stays banner-free (#244)."""
+    monkeypatch.setattr(
+        read_module.settings,
+        "_get_storage_path_from_args",
+        lambda: temp_storage_path,
+    )
+    paper_id = "2410.17954"
+    content = "ExpertFlow HTML body " + ("x" * 4000)
+    (temp_storage_path / f"{paper_id}.md").write_text(content, encoding="utf-8")
+
+    response = await handle_read_paper(
+        {"paper_id": paper_id, "start": 0, "max_chars": 300}
+    )
+    result = json.loads(response[0].text)
+
+    assert result["status"] == "success"
+    assert result["start"] == 0
+    assert result["content"] == content[:300]
+    assert "UNTRUSTED EXTERNAL CONTENT" in result["content_warning"]
+    assert len(result["content_warning"]) < 80
+    assert "third-party source" not in result["content_warning"]
+    assert "adversarial instructions" not in result["content_warning"]
+    assert "UNTRUSTED" not in result["content"]
+    assert not result["content"].startswith("[UNTRUSTED")
+
+
+@pytest.mark.asyncio
+async def test_read_paper_later_chunk_has_no_warning_or_long_banner(
+    temp_storage_path, monkeypatch
+):
+    """start>0 must not re-embed UNTRUSTED banner or repeat content_warning (#244)."""
+    monkeypatch.setattr(
+        read_module.settings,
+        "_get_storage_path_from_args",
+        lambda: temp_storage_path,
+    )
+    paper_id = "2410.17954"
+    content = "ExpertFlow HTML body " + ("y" * 5000)
+    (temp_storage_path / f"{paper_id}.md").write_text(content, encoding="utf-8")
+
+    response = await handle_read_paper(
+        {"paper_id": paper_id, "start": 3000, "max_chars": 300}
+    )
+    result = json.loads(response[0].text)
+
+    assert result["status"] == "success"
+    assert result["start"] == 3000
+    assert result["content"] == content[3000:3300]
+    assert "content_warning" not in result
+    assert "UNTRUSTED" not in result["content"]
+    assert "EXTERNAL CONTENT" not in result["content"]
+    assert "adversarial instructions" not in result["content"]
 
 
 @pytest.mark.asyncio
```

---

### Incident Patch 15: `bb47d8d9` (2026-08-23)
**Commit Message**: fix: search_papers retry/backoff on arXiv 429 (#238) (#249)

Retry HTTP 429/503 in the shared arXiv client with exponential
backoff and jitter (citation_graph parity), and return structured
{status, message} JSON for search failures including soft
status=rate_limited after exhausted retries.

**File**: `src/arxiv_mcp_server/tools/search.py` (modified, +159/-37)
```diff
@@ -4,6 +4,7 @@
 import logging
 import httpx
 import asyncio
+import random
 import xml.etree.ElementTree as ET
 from urllib.parse import quote
 from typing import Dict, Any, List, Optional
@@ -33,31 +34,142 @@
     )
 }
 
+# Retry/backoff for arXiv 429/503 — parity with citation_graph soft handling (#238).
+_MAX_RETRIES = 5
+_INITIAL_BACKOFF_SECONDS = 2.0
+_MAX_BACKOFF_SECONDS = 60.0
+_DEFAULT_RETRY_AFTER_SECONDS = 60.0
+RATE_LIMIT_MESSAGE = (
+    "arXiv is rate limiting this IP (HTTP 429). " "Please wait before retrying."
+)
+
+
+class ArxivRateLimitError(RuntimeError):
+    """Raised when arXiv keeps returning HTTP 429/503 after retries."""
+
+    def __init__(
+        self,
+        message: str,
+        *,
+        status_code: int = 429,
+        retry_after_seconds: float | None = None,
+    ) -> None:
+        super().__init__(message)
+        self.status_code = status_code
+        self.retry_after_seconds = retry_after_seconds
+
+
+def _backoff_seconds(attempt: int, retry_after: str | None) -> float:
+    """Exponential backoff with jitter, honoring numeric Retry-After when present."""
+    delay = min(_INITIAL_BACKOFF_SECONDS * (2**attempt), _MAX_BACKOFF_SECONDS)
+    if retry_after:
+        try:
+            delay = min(max(delay, float(retry_after)), _MAX_BACKOFF_SECONDS)
+        except ValueError:
+            pass
+    # Full-ish jitter keeps concurrent clients from retrying in lockstep.
+    jittered = delay * (0.5 + random.random())
+    return min(jittered, _MAX_BACKOFF_SECONDS)
+
+
+def _parse_retry_after_seconds(retry_after: str | None) -> float | None:
+    """Parse a numeric Retry-After header value, if present."""
+    if not retry_after:
+        return None
+    try:
+        return float(retry_after)
+    except ValueError:
+        return None
+
+
+def _status_response(
+    status: str, message: str, **extra: Any
+) -> List[types.TextContent]:
+    """Return a structured {status, message} tool payload."""
+    payload: Dict[str, Any] = {"status": status, "message": message}
+    payload.update(extra)
+    return [types.TextContent(type="text", text=json.dumps(payload, indent=2))]
+
+
+def _error_response(message: str) -> List[types.TextContent]:
+    """Structured error payload used by search_papers failure paths."""
+    return _status_response("error", message)
+
+
+def _rate_limited_response(
+    message: str | None = None,
+    *,
+    retry_after_seconds: float | None = None,
+    status_code: int = 429,
+) -> List[types.TextContent]:
+    """Soft rate-limit result so callers can continue without a bare Error: stall."""
+    extra: Dict[str, Any] = {"http_status": status_code}
+    if retry_after_seconds is None:
+        retry_after_seconds = _DEFAULT_RETRY_AFTER_SECONDS
+    extra["retry_after_seconds"] = retry_after_seconds
+    return _status_response(
+        "rate_limited",
+        message or RATE_LIMIT_MESSAGE,
+        **extra,
+    )
+
 
 async def _rate_limited_get(client: httpx.AsyncClient, url: str) -> httpx.Response:
-    """Make an HTTP request through the process-wide arXiv request gate."""
+    """Make an HTTP request through the process-wide arXiv request gate.
+
+    Retries HTTP 429/503 with exponential backoff + jitter (citation_graph parity).
+    One additional retry on timeout only, independent of the rate-limit budget.
+    """
 
     async def request() -> httpx.Response:
-        for attempt in range(2):  # one retry on timeout only
-            try:
-                response = await client.get(url, headers=ARXIV_HEADERS)
-                if response.status_code in (429, 503):
-                    logger.warning(
-                        "arXiv rate limited (%s); not retrying", response.status_code
-                    )
-                    raise RuntimeError(
-                        f"arXiv is rate limiting this IP (HTTP {response.status_code}). "
-                        "Please wait 60 seconds before retrying."
-                    )
-                response.raise_for_status()
-                return response
-            except httpx.TimeoutException:
-                if attempt == 0:
-                    logger.warning("arXiv request timed out, retrying once")
-                    await asyncio.sleep(5.0)
-                else:
-                    raise
-        raise RuntimeError("arXiv request timed out after retry")
+        last_response: httpx.Response | None = None
+        for attempt in range(_MAX_RETRIES + 1):
+            response: httpx.Response | None = None
+            for timeout_attempt in range(2):
+                try:
+                    response = await client.get(url, headers=ARXIV_HEADERS)
+                    break
+                except httpx.TimeoutException:
+                    if timeout_attempt == 0:
+                        logger.warning("arXiv request timed out, retrying once")
+                        await asyncio.sleep(5.0)
+                    else:
+                        raise RuntimeError(
```

**File**: `tests/tools/test_search.py` (modified, +153/-7)
```diff
@@ -10,8 +10,10 @@
     DEFAULT_MAX_RESULTS,
     ABSTRACT_SNIPPET_CHARS,
     SORT_BY_VALUES,
+    _MAX_RETRIES,
     _validate_categories,
     _raw_arxiv_search,
+    _rate_limited_get,
     _parse_arxiv_atom_response,
     _parse_opensearch_total_results,
     _build_search_response,
@@ -20,6 +22,7 @@
     _normalize_abstract_mode,
     _normalize_sort_by,
     _scope_user_query,
+    _backoff_seconds,
     build_arxiv_search_query,
     build_arxiv_search_url,
 )
@@ -35,10 +38,12 @@ def disable_request_spacing_for_search_unit_tests(monkeypatch):
     monkeypatch.setattr(config, "_arxiv_client", None)
 
 
-def _mock_httpx_response(xml_text: str):
+def _mock_httpx_response(xml_text: str, *, status_code: int = 200, headers=None):
     """Patch httpx.AsyncClient to return an Atom feed body."""
     mock_response = MagicMock()
     mock_response.text = xml_text
+    mock_response.status_code = status_code
+    mock_response.headers = headers or {}
     mock_response.raise_for_status = MagicMock()
     mock_client = AsyncMock()
     mock_client.get = AsyncMock(return_value=mock_response)
@@ -175,7 +180,10 @@ async def test_search_with_invalid_dates():
         {"query": "test query", "date_from": "invalid-date", "max_results": 1}
     )
 
-    assert "Error:" in result[0].text
+    content = json.loads(result[0].text)
+    assert content["status"] == "error"
+    assert "Invalid date format" in content["message"]
+    assert not result[0].text.startswith("Error:")
 
 
 def test_validate_categories():
@@ -269,7 +277,10 @@ async def test_search_with_invalid_categories():
         }
     )
 
-    assert "Error: Invalid category" in result[0].text
+    content = json.loads(result[0].text)
+    assert content["status"] == "error"
+    assert "Invalid category" in content["message"]
+    assert not result[0].text.startswith("Error:")
 
 
 @pytest.mark.asyncio
@@ -297,15 +308,25 @@ async def test_search_arxiv_http_error():
     response = httpx.Response(500, request=request)
     error = httpx.HTTPStatusError("boom", request=request, response=response)
 
+    mock_response = MagicMock()
+    mock_response.status_code = 500
+    mock_response.headers = {}
+    mock_response.raise_for_status.side_effect = error
+
     mock_client = AsyncMock()
-    mock_client.get = AsyncMock(side_effect=error)
+    mock_client.get = AsyncMock(return_value=mock_response)
     mock_client.__aenter__ = AsyncMock(return_value=mock_client)
     mock_client.__aexit__ = AsyncMock(return_value=None)
 
     with patch("httpx.AsyncClient", return_value=mock_client):
         result = await handle_search({"query": "test", "max_results": 1})
 
-        assert "arXiv API HTTP error" in result[0].text
+    content = json.loads(result[0].text)
+    assert content["status"] == "error"
+    assert "arXiv API HTTP error" in content["message"]
+    assert "HTTP 500" in content["message"]
+    assert "export.arxiv.org" not in result[0].text
+    assert not result[0].text.startswith("Error:")
 
 
 @pytest.mark.asyncio
@@ -1071,8 +1092,10 @@ async def test_search_empty_page_past_end():
 @pytest.mark.asyncio
 async def test_search_invalid_abstract_mode_errors():
     result = await handle_search({"query": "x", "abstract_mode": "brief"})
-    assert "Error:" in result[0].text
-    assert "abstract_mode" in result[0].text
+    content = json.loads(result[0].text)
+    assert content["status"] == "error"
+    assert "abstract_mode" in content["message"]
+    assert not result[0].text.startswith("Error:")
 
 
 def test_build_search_response_echoes_abstract_mode():
@@ -1109,3 +1132,126 @@ async def test_search_emits_content_warning_once_not_per_abstract():
     none_content = json.loads(none_result[0].text)
     assert "content_warning" not in none_content
     assert "abstract" not in none_content["papers"][0]
+
+
+@pytest.mark.asyncio
+async def test_search_no_criteria_returns_structured_error():
+    """Empty query with no filters must return {status, message} JSON (#238)."""
+    result = await handle_search({"query": "   "})
+    content = json.loads(result[0].text)
+    assert content["status"] == "error"
+    assert content["message"] == "No search criteria provided"
+    assert not result[0].text.startswith("Error:")
+
+
+def test_search_backoff_seconds_matches_citation_graph_pattern():
+    """Backoff ladder should use exponential delay with jitter (#238)."""
+    with patch.object(search_module.random, "random", return_value=0.5):
+        assert _backoff_seconds(0, None) == 2.0
+        assert _backoff_seconds(1, None) == 4.0
+        assert _backoff_seconds(2, None) == 8.0
+        assert _backoff_seconds(5, None) == 60.0
+
+    with patch.object(search_module.random, "random", return_value=0.0):
+        assert _backoff_seconds(0, None) == 1.0
+
+    with patch.object(search_module.random, "random", return_value=1.0):
+        assert _backoff_seconds(0, "45") == 60.0
+
+
+@pytest.mark.asyncio
+async def test_search_retries_on_429_then_succeeds():

```

#### Recent Merged Pull Requests:
- **PR #291** (2026-10-05): Fix appendix navigation: Include sections after References/Bibliography (@blazickjp)
- **PR #290** (2026-10-05): Fix citation_graph stale metadata cache issue (@blazickjp)
- **PR #287** (2026-10-05): Release v0.8.1 (@blazickjp)
- **PR #285** (2026-10-05): Fix three bugs from issue #284 (@blazickjp)
- **PR #283** (2026-10-03): Release v0.8.0 (@blazickjp)
- **PR #282** (2026-10-03): Fix timeout/retry handling with budget enforcement and deadline checks (@blazickjp)
- **PR #280** (2026-09-30): chore: bump version to 0.7.3 (@blazickjp)
- **PR #279** (2026-09-30): Fix HTTP 406 throttling and get_abstract error reporting (@blazickjp)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
