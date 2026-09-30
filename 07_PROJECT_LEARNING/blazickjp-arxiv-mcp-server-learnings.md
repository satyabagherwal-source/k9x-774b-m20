# Forensic Learning Record (Deep Inspection): blazickjp/arxiv-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/blazickjp-arxiv-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/blazickjp/arxiv-mcp-server](https://github.com/blazickjp/arxiv-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:38:15.498Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `blazickjp/arxiv-mcp-server`
- **Description**: A local MCP server for agent literature work. Original-LaTeX section reads, BibTeX from arXiv metadata, and topic watches. Papers stay on disk. Search is optional.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3183 stars

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
        if installed_version != e
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
import os
from pathlib import Path
import tempfile
import threading
import time
from typing import Awaitable, Callable, Protocol, TypeVar

import httpx

T = TypeVar("T")


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

    def run_sync(self, operation: Callable[[], T]) -> T:
        """Run a blocking operation inside the shared request gate."""
        with self._lock:
            delay = self._remaining_delay()
            if delay:
                self._sync_sleep(delay)
            self._last_started = self._clock()
            return operation()

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


class ArxivResult(Protocol):
    """Subset of arxiv.Result used by compatibility helpers."""

    def get_short_id(self) -> str: ...


def canonical_pdf_url(paper: ArxivResult) -> str:
    """Return the stable public PDF URL for an arXiv result.

    arxiv 4 removed ``Result.pdf_url`` and ``Result.download_pdf`` but retained
    ``get_short_id``. Building the canonical URL from that stable identifier
    keeps the server compatible across arxiv 2.x through 4.x.
    """
    return f"https://arxiv.org/pdf/{paper.get_short_id()}.pdf"


def stream_pdf_to_path(
    paper: ArxivResult,
    destination: Path,
    *,
    request_timeout: float,
    user_agent: str,
) -> None:
    """Stream an arXiv PDF to disk with bounded memory usage.

    Handles arXiv HTTP 406 (throttling) with minimal retries to avoid
    prolonging the IP block (issue #277).
    """
    # Import here to avoid circular dependency
    from .tools.search import (
        ArxivRateLimitError,
        _HTTP_406_MAX_RETRIES,
        _HTTP_406_RETRY_AFTER_SECONDS,
        _backoff_seconds,
    )

    timeout = httpx.Timeout(
        connect=30.0,
        read=max(120.0, request_timeout),
        write=30.0,
        pool=30.0,
    )
    headers = {"User-Agent": user_agent}
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, staging_name = tempfile.mkstemp(
        dir=destination.parent,
        prefix=f".{destination.name}.",
        suffix=".part",
    )
    os.close(descriptor)
    staging = Path(staging_name)

    try:
        last_response: httpx.Response | None = None
        max_attempts = _HTTP_406_MAX_RETRIES + 1

        for attempt in range(max_attempts):
            try:
                with httpx.Client(
                    timeout=timeout, follow_redirects=True, headers=headers
                ) as client:
                    with client.stream("GET", canonical_pdf_url(paper)) as response:
                        # Check status before streaming
                        if response.status_code == 406:
                            last_response = response
                            if attempt < _HTTP_406_MAX_RETRIES:
                                wait = _backoff_seconds(
                                    attempt, response.headers.get("Retry-After")
                                )
                                time.sleep(wait)
                                continue
                            # 406 exhausted
                            break

                        # Handle 429/503 as rate limiting
                        if response.status_code in (429, 503):
                            last_response = response
                            # For 429/503 on PDF, return rate_limited like everywhere else
                            break

                        # Non-406 errors: raise immediately (no retry)
                        response.raise_for_status()

                        # Success: stream to disk
                        with staging.open("wb") as output:
                            for chunk in response.iter_bytes(chunk_size=256 * 1024):
                                output.write(chunk)
                        staging.replace(destination)
                        return
            except httpx.HTTPStatusError as e:
                # HTTPStatusError from raise_for_status() - non-406 errors
                # Clean error without URL leak (issue #166)
                status = e.response.status_code if e.response is not None else "unknown"
                staging.unlink(missing_ok=True)
                raise RuntimeError(f"arXiv PDF download HTTP error (HTTP {status})")

        # 406/429/503 exhausted after retries
        if last_response is not None and last_response.status_code in (406, 429, 503):
            staging.unlink(missing_ok=True)
            status_code = last_response.status_code

            # Parse Retry-After header
            retry_after = None
            retry_after_header = last_response.headers.get("Retry-After")
            if retry_after_header:
                try:
                    retry_after = float(retry_after_header)
                except ValueError:
                    pass

            # Use defaults if no Retry-After header
            if retry_after is None:
                if status_code == 406:
                    retry_after = _HTTP_406_RETRY_AFTER_SECONDS
                else:
                    from .tools.search import _DEFAULT_RETRY_AFTER_SECONDS

                    retry_after = _DEFAULT_RETRY_AFTER_SECONDS

            message = (
                f"arXiv is rate limiting this IP (HTTP {status_code}). "
                f"Please wait {int(retry_after)} seconds before retrying."
            )
            raise ArxivRateLimitError(
                message,
                status_code=status_code,
                retry_after_seconds=retry_after,
            )
    except BaseException:
        staging.unlink(missing_ok=True)
        raise

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

        def _get_with_timeout(url, **kwargs):
            kwargs.setdefault("timeout", (5.0, 30.0))
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
    REQUEST_TIMEOUT: int = 60
    TRANSPORT: str = "stdio"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    ALLOWED_HOSTS: str = ""
    ALLOWED_ORIGINS: str = ""
    SEMANTIC_SCHOLAR_API_KEY: str = ""
    model_config = SettingsConfigDict(extra="allow")

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #244** (2026-08-23): **content_warning: short first-chunk field; no long banner on later chunks**
  *Symptoms*: ## Context Post-v0.7.1 deep dogfood. Align with closed work: - #215 — do not re-prepend UNTRUSTED warning on every paginated chunk - #230 — shorten token-heavy content_warning / EXTERNAL CONTENT prefixes  ## Problem Residual consistency gaps on `read_paper` / `download_paper` pagination: - Some first-chunk success paths may still omit the short `content_warning` field. - Later chunks must never re-embed a long UNTRUSTED banner into `content` (or repeat a heavy warning).  Dogfood on ExpertFlow HTML (`2410.17954`) saw a short field on `start=0` and no banner embedded in `start=3000` content — keep that direction, and close remaining holes so all first chunks are consistent.  ## Repro / check 1. `download_paper` / `read_paper` with `start=0` → expect a **short** `content_warning` field (not a long banner inside `content`). 2. Same paper with `start>0` → `content` must not begin with / contain a repeated UNTRUSTED banner; prefer no warning field (or equally short, non-duplicative policy). 3. Spot-check any remaining code paths that still prepend into `content` or skip the first-chunk field.  ## Expected - Short `content_warning` on the first chunk for `read_paper` / `download_paper` wherever it is still missing. - Later chunks do not re-embed a long banner (align #215 / #230). - Agents can stitch paginated chunks without warning tokens polluting the text stream.

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

### Incident Patch 1: `e6badc00` (2026-09-30)
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

Co-authored-by: Joe Blazick <blazickjp@users.noreply.github.com>

*

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
+        def
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

---

### Incident Patch 2: `f760f791` (2026-08-23)
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
+        "Switch Transformers / Fedus, Zoph and S
```

---

### Incident Patch 3: `664bb72a` (2026-08-23)
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

### Incident Patch 4: `315b7b9c` (2026-08-23)
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

---

### Incident Patch 5: `dcfb03b3` (2026-08-23)
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
+    
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

### Incident Patch 6: `14977285` (2026-08-23)
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

### Incident Patch 7: `57256083` (2026-08-23)
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

### Incident Patch 8: `56dd4060` (2026-08-23)
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

### Incident Patch 9: `95faeb76` (2026-08-23)
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

### Incident Patch 10: `9f2e4098` (2026-08-23)
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

#### Recent Merged Pull Requests:
- **PR #280** (2026-09-30): chore: bump version to 0.7.3 (@blazickjp)
- **PR #279** (2026-09-30): Fix HTTP 406 throttling and get_abstract error reporting (@blazickjp)
- **PR #275** (closed): README: context-cost badge (3,960 tokens, measured) (@athakur3)
- **PR #274** (2026-08-26): feat: citation_graph fewer S2 calls, disk cache, unmistakable 429 (@blazickjp)
- **PR #273** (2026-08-26): docs: add Cursor install badge; restore Tests and stars (@blazickjp)
- **PR #272** (2026-08-26): docs: restore one-click install badges at top of README (@blazickjp)
- **PR #271** (2026-08-26): docs: rewrite README to lead with install (@blazickjp)
- **PR #270** (2026-08-24): chore: bump version to 0.7.2 (@blazickjp)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
