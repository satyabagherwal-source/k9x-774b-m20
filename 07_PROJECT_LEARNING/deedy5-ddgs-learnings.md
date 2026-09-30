# Forensic Learning Record (Deep Inspection): deedy5/ddgs

> **Canonical Artifact**: `07_PROJECT_LEARNING/deedy5-ddgs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/deedy5/ddgs](https://github.com/deedy5/ddgs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:38:13.813Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `deedy5/ddgs`
- **Description**: A metasearch library that aggregates results from diverse web search services
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2998 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ddgs/__init__.py`
```
"""DDGS | Dux Distributed Global Search.

A metasearch library that aggregates results from diverse web search services.
"""

import importlib
import logging
import threading
from typing import TYPE_CHECKING, Any, cast

__version__ = "9.16.0"
__all__ = ("DDGS",)

if TYPE_CHECKING:
    from .ddgs import DDGS

# A do-nothing logging handler
# https://docs.python.org/3/howto/logging.html#configuring-logging-for-a-library
logging.getLogger("ddgs").addHandler(logging.NullHandler())


class _ProxyMeta(type):
    _lock: threading.Lock = threading.Lock()
    _real_cls: type["DDGS"] | None = None

    @classmethod
    def _load_real(cls) -> type["DDGS"]:
        if cls._real_cls is None:
            with cls._lock:
                if cls._real_cls is None:
                    cls._real_cls = importlib.import_module(".ddgs", package=__name__).DDGS
                    globals()["DDGS"] = cls._real_cls
        return cls._real_cls

    def __call__(cls, *args: Any, **kwargs: Any) -> "DDGS":  # noqa: ANN401
        real = type(cls)._load_real()
        return real(*args, **kwargs)

    def __getattr__(cls, name: str) -> Any:  # noqa: ANN401
        return getattr(type(cls)._load_real(), name)

    def __dir__(cls) -> list[str]:
        base = set(super().__dir__())
        loaded_names = set(dir(type(cls)._load_real()))
        return sorted(base | (loaded_names - base))


class _DDGSProxy(metaclass=_ProxyMeta):
    """Proxy class for lazy-loading the real DDGS implementation."""


DDGS: type[DDGS] = cast("type[DDGS]", _DDGSProxy)  # type: ignore[no-redef]

```

### Core Architecture Module: `ddgs/api_server/__init__.py`
```
"""DDGS API server.

This module provides the FastAPI application for the DDGS REST API.
"""

__all__: list[str] = []

try:
    from ddgs.api_server.api import app as fastapi_app

    __all__ += ["fastapi_app"]
except ImportError:
    # API dependencies not installed
    pass

```

### Core Architecture Module: `ddgs/api_server/api.py`
```
"""FastAPI application for DDGS API."""

import asyncio
import logging
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ddgs import DDGS
from ddgs.utils import _expand_proxy_tb_alias

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="DDGS API",
    description="A FastAPI wrapper for the DDGS (Dux Distributed Global Search) library",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_ddgs() -> DDGS:
    """Create a DDGS instance with proxy configuration from environment."""
    return DDGS(proxy=_expand_proxy_tb_alias(os.environ.get("DDGS_PROXY")))


# Pydantic models for request/response
class TextSearchRequest(BaseModel):
    """Request model for search operations."""

    query: str = Field(..., description="Search query")
    region: str = Field("us-en", description="Region for search (e.g., us-en, uk-en, ru-ru)")
    safesearch: str = Field("moderate", description="Safe search setting (on, moderate, off)")
    timelimit: str | None = Field(None, description="Time limit (d, w, m, y) or custom date range")
    max_results: int | None = Field(10, description="Maximum number of results to return")
    page: int = Field(1, description="Page number of results")
    backend: str = Field("auto", description="Search backend (auto, or specific engine)")


class ImagesSearchRequest(BaseModel):
    """Request model for image search operations."""

    query: str = Field(..., description="Image search query")
    region: str = Field("us-en", description="Region for search (e.g., us-en, uk-en, ru-ru)")
    safesearch: str = Field("moderate", description="Safe search setting (on, moderate, off)")
    timelimit: str | None = Field(None, description="Time limit (d, w, m, y) or custom date range")
    max_results: int | None = Field(10, description="Maximum number of results to return")
    page: int = Field(1, description="Page number of results")
    backend: str = Field("auto", description="Search backend (auto, or specific engine)")
    size: str | None = Field(None, description="Image size (Small, Medium, Large, Wallpaper)")
    color: str | None = Field(
        None,
        description="Image color (Monochrome, Red, Orange, Yellow, Green, Blue, Purple, Pink, Brown, Black, Gray, Teal, White)",  # noqa: E501
    )
    type_image: str | None = Field(None, description="Image type (photo, clipart, gif, transparent, line)")
    layout: str | None = Field(None, description="Image layout (Square, Tall, Wide)")
    license_image: str | None = Field(
        None, description="Image license (any, Public, Share, ShareCommercially, Modify, ModifyCommercially)"
    )


class NewsSearchRequest(BaseModel):
    """Request model for search operations."""

    query: str = Field(..., description="Search query")
    region: str = Field("us-en", description="Region for search (e.g., us-en, uk-en, ru-ru)")
    safesearch: str = Field("moderate", description="Safe search setting (on, moderate, off)")
    timelimit: str | None = Field(None, description="Time limit (d, w, m, y) or custom date range")
    max_results: int | None = Field(10, description="Maximum number of results to return")
    page: int = Field(1, description="Page number of results")
    backend: str = Field("auto", description="Search backend (auto, or specific engine)")


class VideosSearchRequest(BaseModel):
    """Request model for video search operations."""

    query: str = Field(..., description="Video search query")
    region: str = Field("us-en", description="Region for search (e.g., us-en, uk-en, ru-ru)")
    safesearch: str = Field("moderate", description="Safe search setting (on, moderate, off)")
    timelimit: str | None = Field(None, description="Time limit (d, w, m) or custom date range")
    max_results: int | None = Field(10, description="Maximum number of results to return")
    page: int = Field(1, description="Page number of results")
    backend: str = Field("auto", description="Search backend (auto, or specific engine)")
    resolution: str | None = Field(None, description="Video resolution (high, standard)")
    duration: str | None = Field(None, description="Video duration (short, medium, long)")
    license_videos: str | None = Field(None, description="Video license (creativeCommon, youtube)")


class BooksSearchRequest(BaseModel):
    """Request model for book search operations."""

    query: str = Field(..., description="Books search query")
    max_results: int | None = Field(10, description="Maximum number of results to return")
    page: int = Field(1, description="Page number of results")
    backend: str = Field("auto", description="Search backend (auto, or specific engine)")


class ExtractRequest(BaseModel):
    """Request model for URL content extraction."""

    url: str = Field(..., description="URL to extract content from")
    format: str = Field("text_markdown", description="Format: text_markdown, text_plain, text_rich, text, content")


class SearchResponse(BaseModel):
    """Response model for search operations."""

    results: list[dict[str, Any]]


class HealthResponse(BaseModel):
    """Response model for health check."""

    status: str
    version: str
    service: str


@app.get("/", response_model=HealthResponse)
async def root() -> HealthResponse:
    """Root endpoint with basic service information."""
    return HealthResponse(status="healthy", version="1.0.0", service="DDGS API")


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="healthy", version="1.0.0", service="DDGS API")


@app.post("/search/text", response_model=SearchResponse)
async def search_text(request: TextSearchRequest) -> SearchResponse:
    """Perform a text search."""
    try:
        results = await asyncio.to_thread(
            lambda: _get_ddgs().text(
                query=request.query,
                region=request.region,
                safesearch=request.safesearch,
                timelimit=request.timelimit,
                max_results=request.max_results,
                page=request.page,
                backend=request.backend,
            )
        )

        return SearchResponse(results=results)
    except Exception as e:
        logger.warning("Error in text search: %s", e)
        raise HTTPException(status_code=500, detail=f"Search failed: {e!s}") from e


@app.get("/search/text", response_model=SearchResponse)
async def search_text_get(
    query: str,
    region: str = "us-en",
    safesearch: str = "moderate",
    timelimit: str | None = None,
    max_results: int = 10,
    page: int = 1,
    backend: str = "auto",
) -> SearchResponse:
    """Perform a text search via GET request."""
    try:
        results = await asyncio.to_thread(
            lambda: _get_ddgs().text(
                query=query,
                region=region,
                safesearch=safesearch,
                timelimit=timelimit,
                max_results=max_results,
                page=page,
                backend=backend,
            )
        )

        return SearchResponse(results=results)
    except Exception as e:
        logger.warning("Error in text search (GET): %s", e)
        raise HTTPException(status_code=500, detail=f"Search failed: {e!s}") from e


@app.post("/search/images", response_model=SearchResponse)
async def search_images(request: ImagesSearchRequest) -> SearchResponse:
    """Perform an image search."""
    try:
        results = await asyncio.to_thread(
            lambda: _get_ddgs().images(
                query=request.query,
           
```

### Core Architecture Module: `ddgs/api_server/mcp.py`
```
"""MCP server for DDGS."""

import asyncio
import logging
import os
from typing import Any

from mcp.server.mcpserver import MCPServer

from ddgs import DDGS
from ddgs.utils import _expand_proxy_tb_alias

logger = logging.getLogger(__name__)

# Create MCP server with secure defaults
mcp = MCPServer("ddgs-search")


@mcp.tool()
async def search_text(
    query: str,
    region: str = "us-en",
    safesearch: str = "moderate",
    timelimit: str | None = None,
    max_results: int = 10,
    page: int = 1,
    backend: str = "auto",
) -> list[dict[str, Any]]:
    """Perform a text search using DDGS.

    Args:
        query: Search query string
        region: Region for search (e.g., us-en, uk-en, ru-ru)
        safesearch: Safe search setting (on, moderate, off)
        timelimit: Time limit (d, w, m, y) or custom date range
        max_results: Maximum number of results to return
        page: Page number of results
        backend: Search backend (auto, or specific engine)

    Returns:
        List of search results with title, href, and body

    """
    results = await asyncio.to_thread(
        lambda: DDGS(proxy=_expand_proxy_tb_alias(os.environ.get("DDGS_PROXY"))).text(
            query=query,
            region=region,
            safesearch=safesearch,
            timelimit=timelimit,
            max_results=max_results,
            page=page,
            backend=backend,
        )
    )
    return list(results)


@mcp.tool()
async def search_images(
    query: str,
    region: str = "us-en",
    safesearch: str = "moderate",
    timelimit: str | None = None,
    max_results: int = 10,
    page: int = 1,
    backend: str = "auto",
    size: str | None = None,
    color: str | None = None,
    type_image: str | None = None,
    layout: str | None = None,
    license_image: str | None = None,
) -> list[dict[str, Any]]:
    """Perform an image search using DDGS.

    Args:
        query: Image search query string
        region: Region for search (e.g., us-en, uk-en, ru-ru)
        safesearch: Safe search setting (on, moderate, off)
        timelimit: Time limit (d, w, m, y) or custom date range
        max_results: Maximum number of results to return
        page: Page number of results
        backend: Search backend (auto, or specific engine)
        size: Image size (Small, Medium, Large, Wallpaper)
        color: Image color filter
        type_image: Image type (photo, clipart, gif, transparent, line)
        layout: Image layout (Square, Tall, Wide)
        license_image: Image license filter

    Returns:
        List of image search results with title, image URL, and source

    """
    results = await asyncio.to_thread(
        lambda: DDGS(proxy=_expand_proxy_tb_alias(os.environ.get("DDGS_PROXY"))).images(
            query=query,
            region=region,
            safesearch=safesearch,
            timelimit=timelimit,
            max_results=max_results,
            page=page,
            backend=backend,
            size=size,
            color=color,
            type_image=type_image,
            layout=layout,
            license_image=license_image,
        )
    )
    return list(results)


@mcp.tool()
async def search_news(
    query: str,
    region: str = "us-en",
    safesearch: str = "moderate",
    timelimit: str | None = None,
    max_results: int = 10,
    page: int = 1,
    backend: str = "auto",
) -> list[dict[str, Any]]:
    """Perform a news search using DDGS.

    Args:
        query: News search query string
        region: Region for search (e.g., us-en, uk-en, ru-ru)
        safesearch: Safe search setting (on, moderate, off)
        timelimit: Time limit (d, w, m, y) or custom date range
        max_results: Maximum number of results to return
        page: Page number of results
        backend: Search backend (auto, or specific engine)

    Returns:
        List of news results with title, URL, source, and date

    """
    results = await asyncio.to_thread(
        lambda: DDGS(proxy=_expand_proxy_tb_alias(os.environ.get("DDGS_PROXY"))).news(
            query=query,
            region=region,
            safesearch=safesearch,
            timelimit=timelimit,
            max_results=max_results,
            page=page,
            backend=backend,
        )
    )
    return list(results)


@mcp.tool()
async def search_videos(
    query: str,
    region: str = "us-en",
    safesearch: str = "moderate",
    timelimit: str | None = None,
    max_results: int = 10,
    page: int = 1,
    backend: str = "auto",
    resolution: str | None = None,
    duration: str | None = None,
    license_videos: str | None = None,
) -> list[dict[str, Any]]:
    """Perform a video search using DDGS.

    Args:
        query: Video search query string
        region: Region for search (e.g., us-en, uk-en, ru-ru)
        safesearch: Safe search setting (on, moderate, off)
        timelimit: Time limit (d, w, m) or custom date range
        max_results: Maximum number of results to return
        page: Page number of results
        backend: Search backend (auto, or specific engine)
        resolution: Video resolution (high, standard)
        duration: Video duration (short, medium, long)
        license_videos: Video license (creativeCommon, youtube)

    Returns:
        List of video search results with title, URL, and metadata

    """
    results = await asyncio.to_thread(
        lambda: DDGS(proxy=_expand_proxy_tb_alias(os.environ.get("DDGS_PROXY"))).videos(
            query=query,
            region=region,
            safesearch=safesearch,
            timelimit=timelimit,
            max_results=max_results,
            page=page,
            backend=backend,
            resolution=resolution,
            duration=duration,
            license_videos=license_videos,
        )
    )
    return list(results)


@mcp.tool()
async def search_books(
    query: str,
    max_results: int = 10,
    page: int = 1,
    backend: str = "auto",
) -> list[dict[str, Any]]:
    """Perform a book search using DDGS.

    Args:
        query: Books search query string
        max_results: Maximum number of results to return
        page: Page number of results
        backend: Search backend (auto, or specific engine)

    Returns:
        List of book search results with title, author, and metadata

    """
    results = await asyncio.to_thread(
        lambda: DDGS(proxy=_expand_proxy_tb_alias(os.environ.get("DDGS_PROXY"))).books(
            query=query,
            max_results=max_results,
            page=page,
            backend=backend,
        )
    )
    return list(results)


@mcp.tool()
async def extract_content(url: str, fmt: str = "text_markdown") -> dict[str, str | bytes]:
    """Extract content from a URL.

    Args:
        url: The URL to fetch and extract content from.
        fmt: Output format: "text_markdown", "text_plain", "text_rich", "text" (raw HTML), "content" (raw bytes).

    Returns:
        Dictionary with url and content keys.

    """
    return await asyncio.to_thread(
        lambda: DDGS(proxy=_expand_proxy_tb_alias(os.environ.get("DDGS_PROXY"))).extract(
            url=url,
            fmt=fmt,
        )
    )

```

### Core Architecture Module: `ddgs/base.py`
```
"""Base class for search engines."""

import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping
from functools import cached_property
from typing import Any, ClassVar, Generic, Literal, TypeVar

from lxml import html
from lxml.etree import HTMLParser as LHTMLParser

from .http_client import HttpClient
from .results import BooksResult, ImagesResult, NewsResult, TextResult, VideosResult

logger = logging.getLogger(__name__)
T = TypeVar("T")


class BaseSearchEngine(ABC, Generic[T]):
    """Abstract base class for all search-engine backends."""

    name: ClassVar[str]  # unique key, e.g. "google"
    category: ClassVar[Literal["text", "images", "videos", "news", "books"]]
    provider: ClassVar[str]  # source of the search results (e.g. "bing" for DuckDuckgo)
    disabled: ClassVar[bool] = False  # if True, the engine is disabled
    priority: ClassVar[float] = 1

    search_url: str
    search_method: ClassVar[str]  # GET or POST
    headers_update: ClassVar[Mapping[str, str]] = {}
    items_xpath: ClassVar[str]
    elements_xpath: ClassVar[Mapping[str, str]]
    elements_replace: ClassVar[Mapping[str, str]]

    def __init__(self, proxy: str | None = None, timeout: int | None = None, *, verify: bool | str = True) -> None:
        self.http_client = HttpClient(proxy=proxy, timeout=timeout, verify=verify)
        self.http_client.client.headers_update(self.headers_update)
        self.results: list[T] = []

    @property
    def result_type(self) -> type[T]:
        """Get result type based on category."""
        categories = {
            "text": TextResult,
            "images": ImagesResult,
            "videos": VideosResult,
            "news": NewsResult,
            "books": BooksResult,
        }
        return categories[self.category]

    @abstractmethod
    def build_payload(
        self,
        query: str,
        region: str,
        safesearch: str,
        timelimit: str | None,
        page: int,
        **kwargs: str,
    ) -> dict[str, Any]:
        """Build a payload for the search request."""
        raise NotImplementedError

    def request(self, *args: Any, **kwargs: Any) -> Any:  # noqa: ANN401
        """Make a request to the search engine."""
        resp = self.http_client.request(*args, **kwargs)
        if resp.status_code == 200:
            return resp.text
        return None

    @cached_property
    def parser(self) -> LHTMLParser:
        """Get HTML parser."""
        return LHTMLParser(remove_blank_text=True, remove_comments=True, remove_pis=True, collect_ids=False)

    def extract_tree(self, html_text: str) -> html.Element:
        """Extract html tree from html text."""
        return html.fromstring(html_text, parser=self.parser)

    def pre_process_html(self, html_text: str) -> str:
        """Pre-process html_text before extracting results."""
        return html_text

    def extract_results(self, html_text: str) -> list[T]:
        """Extract search results from html text."""
        html_text = self.pre_process_html(html_text)
        tree = self.extract_tree(html_text)
        items = tree.xpath(self.items_xpath)
        results = []
        for item in items:
            result = self.result_type()
            for key, value in self.elements_xpath.items():
                data = " ".join("".join(item.xpath(value)).split())
                result.__setattr__(key, data)
            results.append(result)
        return results

    def post_extract_results(self, results: list[T]) -> list[T]:
        """Post-process search results."""
        return results

    def search(
        self,
        query: str,
        region: str = "us-en",
        safesearch: str = "moderate",
        timelimit: str | None = None,
        page: int = 1,
        **kwargs: str,
    ) -> list[T] | None:
        """Search the engine."""
        payload = self.build_payload(
            query=query, region=region, safesearch=safesearch, timelimit=timelimit, page=page, **kwargs
        )
        if self.search_method == "GET":
            html_text = self.request(self.search_method, self.search_url, params=payload)
        else:
            html_text = self.request(self.search_method, self.search_url, data=payload)
        if not html_text:
            return None
        results = self.extract_results(html_text)
        return self.post_extract_results(results)

```

### Core Architecture Module: `ddgs/cli.py`
```
"""CLI tool for DDGS."""

import csv
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

import click
import primp

from . import __version__
from .ddgs import DDGS
from .utils import _expand_proxy_tb_alias

# Use a consistent PID file location in user's home directory
_PID_FILE = Path.home() / ".cache" / "ddgs" / "api.pid"

logger = logging.getLogger(__name__)

COLORS = {
    0: "black",
    1: "red",
    2: "green",
    3: "yellow",
    4: "blue",
    5: "magenta",
    6: "cyan",
    7: "bright_black",
    8: "bright_red",
    9: "bright_green",
    10: "bright_yellow",
    11: "bright_blue",
    12: "bright_magenta",
    13: "bright_cyan",
    14: "white",
    15: "bright_white",
}


def _convert_tuple_to_csv(_ctx: click.Context, _param: click.Parameter, value: tuple[str] | None) -> str:
    if value is not None and isinstance(value, tuple):
        return ",".join(value)
    return ""


def _save_data(query: str, data: list[dict[str, str]], function_name: str, filename: str | None) -> None:
    filename, ext = filename.rsplit(".", 1) if filename and filename.endswith((".csv", ".json")) else (None, filename)
    filename = filename or f"{function_name}_{query}_{datetime.now(tz=timezone.utc):%Y%m%d_%H%M%S}"
    if ext == "csv":
        _save_csv(f"{filename}.{ext}", data)
    elif ext == "json":
        _save_json(f"{filename}.{ext}", data)


def _save_json(jsonfile: str | Path, data: list[dict[str, str]]) -> None:
    with Path(jsonfile).open("w", encoding="utf-8") as file:
        file.write(json.dumps(data, ensure_ascii=False, indent=2))


def _save_csv(csvfile: str | Path, data: list[dict[str, str]]) -> None:
    with Path(csvfile).open("w", newline="", encoding="utf-8") as file:
        if data:
            headers = data[0].keys()
            writer = csv.DictWriter(file, fieldnames=headers, quoting=csv.QUOTE_MINIMAL)
            writer.writeheader()
            writer.writerows(data)


def _print_data(data: list[dict[str, str]], *, no_color: bool = False) -> None:
    is_tty = sys.stdout.isatty()
    if not is_tty:
        no_color = True
    if data:
        for i, e in enumerate(data, start=1):
            sep = f"{i}.\t    {'=' * 78}" if is_tty else f"{i}."
            click.secho(sep, bg="black", fg="white")
            for j, (k, v) in enumerate(e.items(), start=1):
                if v:
                    width = 300 if k in ("content", "href", "image", "source", "thumbnail", "url") else 78
                    title = "language" if k == "detected_language" else k
                    text = click.wrap_text(
                        f"{v}",
                        width=width,
                        initial_indent="",
                        subsequent_indent=" " * 12,
                        preserve_paragraphs=True,
                    )
                else:
                    title = k
                    text = v
                click.secho(f"{title:<12}{text}", bg="black", fg=COLORS[j] if not no_color else "white", overline=True)
            if is_tty:  # Only block for input in interactive mode
                input()


def _sanitize_query(query: str) -> str:
    return (
        query.replace("filetype", "")
        .replace(":", "")
        .replace('"', "'")
        .replace("site", "")
        .replace(" ", "_")
        .replace("/", "_")
        .replace("\\", "_")
        .replace(" ", "")
    )


def _download_file(url: str, dir_path: str, filename: str, proxy: str | None, *, verify: bool) -> None:
    try:
        resp = primp.Client(proxy=proxy, impersonate="random", impersonate_os="random", timeout=10, verify=verify).get(
            url,
        )
        if resp.status_code == 200:
            f = Path(dir_path) / filename[:200]
            with f.open("wb") as file:
                file.write(resp.content)
    except Exception as ex:  # noqa: BLE001
        logger.debug("Error download_file url=%s: %r", url, ex)


def _download_results(
    query: str,
    results: list[dict[str, str]],
    function_name: str,
    proxy: str | None = None,
    threads: int | None = None,
    pathname: str | None = None,
    *,
    verify: bool = True,
) -> None:
    path = pathname or f"{function_name}_{query}_{datetime.now(tz=timezone.utc):%Y%m%d_%H%M%S}"
    Path(path).mkdir(parents=True, exist_ok=True)

    threads = 10 if threads is None else threads
    with ThreadPoolExecutor(max_workers=threads) as executor:
        futures = []
        for i, res in enumerate(results, start=1):
            url = res["image"] if function_name == "images" else res["href"]
            filename = unquote(url.split("/")[-1].split("?")[0])
            f = executor.submit(_download_file, url, path, f"{i}_{filename}", proxy, verify=verify)
            futures.append(f)

        with click.progressbar(
            length=len(futures),
            label="Downloading",
            show_percent=True,
            show_pos=True,
            width=50,
        ) as bar:
            for future in as_completed(futures):
                future.result()
                bar.update(1)


@click.group(chain=True)
def cli() -> None:
    """DDGS CLI tool."""


def safe_entry_point() -> None:
    """Run the CLI tool in try-except block to catch all exceptions."""
    logging.basicConfig(level=logging.WARNING)
    try:
        cli()
    except Exception as ex:  # noqa: BLE001
        click.echo(f"{type(ex).__name__}: {ex!r}")


@cli.command()
def version() -> str:
    """Print and return version."""
    print(__version__)  # noqa: T201
    return __version__


@cli.command()
@click.option("-q", "--query", help="text search query")
@click.option("-k", "--keywords", help="(Deprecated) text search query")  # deprecated
@click.option("-r", "--region", default="us-en", help="us-en, ru-ru, etc.")
@click.option("-s", "--safesearch", default="moderate", type=click.Choice(["on", "moderate", "off"]))
@click.option("-t", "--timelimit", type=click.Choice(["d", "w", "m", "y"]), help="day, week, month, year")
@click.option("-m", "--max_results", default=10, type=int, help="maximum number of results")
@click.option("-p", "--page", default=1, type=int, help="page number of results")
@click.option(
    "-b",
    "--backend",
    default=["auto"],
    type=click.Choice(
        [
            "auto",
            "all",
            "bing",
            "brave",
            "duckduckgo",
            "google",
            "grokipedia",
            "mojeek",
            "startpage",
            "yandex",
            "yahoo",
            "wikipedia",
        ],
    ),
    multiple=True,
    callback=_convert_tuple_to_csv,
)
@click.option("-o", "--output", help="csv, json or filename.csv|json (save the results to a csv or json file)")
@click.option("-d", "--download", is_flag=True, default=False, help="download results. -dd to set custom directory")
@click.option("-dd", "--download-directory", help="Specify custom download directory")
@click.option("-th", "--threads", default=10, help="download threads, default=10")
@click.option("-pr", "--proxy", help="the proxy to send requests, example: socks5h://127.0.0.1:9150")
@click.option("-v", "--verify", default=True, help="verify SSL when making the request")
@click.option("-nc", "--no-color", is_flag=True, default=False, help="disable color output")
def text(
    query: str,
    keywords: str | None,  # deprecated
    region: str,
    safesearch: str,
    timelimit: str | None,
    max_results: int | None,
    page: int,
    backend: str,
    output: str | None,
    download_directory: str | None,
    threads: int,
    proxy: str | None,
    *,
    download: bool,
    verify: bool,
    no_color: bool,
) -> None:
    """CLI function to perform a DDGS text metasearch."""
    data = DDGS(proxy=_expand_proxy_tb_alias(proxy), verify=verify).text(
        query=query,
        keywords=keywords,  #
```

### Core Architecture Module: `ddgs/ddgs.py`
```
"""DDGS class implementation."""

import logging
import os
from concurrent.futures import ThreadPoolExecutor, wait
from math import ceil
from random import random, shuffle
from types import TracebackType
from typing import Any, ClassVar

from .base import BaseSearchEngine
from .engines import ENGINES
from .exceptions import DDGSException, TimeoutException
from .http_client import HttpClient
from .results import ResultsAggregator
from .similarity import SimpleFilterRanker
from .utils import _expand_proxy_tb_alias

logger = logging.getLogger(__name__)


class DDGS:
    """DDGS | Dux Distributed Global Search.

    A metasearch library that aggregates results from diverse web search services.

    Args:
        proxy: The proxy to use for the search. Defaults to None.
        timeout: The timeout for the search. Defaults to 5.
        verify: bool (True to verify, False to skip) or str path to a PEM file. Defaults to True.

    Attributes:
        threads: The maximum number of threads per search. Defaults to None (automatic, based on max_results).

    Raises:
        DDGSException: If an error occurs during the search.

    Example:
        >>> from ddgs import DDGS
        >>> results = DDGS().search("python")

    """

    threads: ClassVar[int | None] = None

    def __init__(
        self,
        proxy: str | None = None,
        timeout: int | None = 5,
        *,
        verify: bool | str = True,
    ) -> None:
        self._proxy = _expand_proxy_tb_alias(proxy) or os.environ.get("DDGS_PROXY")
        self._timeout = timeout
        self._verify = verify
        self._engines_cache: dict[
            type[BaseSearchEngine[Any]], BaseSearchEngine[Any]
        ] = {}  # dict[engine_class, engine_instance]

    def __enter__(self) -> "DDGS":  # noqa: PYI034
        """Enter the context manager and return the DDGS instance."""
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: TracebackType | None = None,
    ) -> None:
        """Exit the context manager."""

    def _get_engines(
        self,
        category: str,
        backend: str,
    ) -> list[BaseSearchEngine[Any]]:
        """Retrieve a list of search engine instances for a given category and backend.

        Args:
            category: The category of search engines (e.g., 'text', 'images', etc.).
            backend: A single or comma-delimited backends. Defaults to "auto".

        Returns:
            A list of initialized search engine instances corresponding to the specified
            category and backend. Instances are cached for reuse.

        """
        if isinstance(backend, list):  # deprecated
            backend = ",".join(backend)
        backend_list = [x.strip() for x in backend.split(",")]
        engine_keys = list(ENGINES[category].keys())
        shuffle(engine_keys)
        if "auto" in backend_list or "all" in backend_list:
            keys = engine_keys
            if category == "text":
                keys = ["wikipedia", "grokipedia"] + [k for k in keys if k not in ("wikipedia", "grokipedia")]
        else:
            keys = backend_list

        engine_classes = []
        invalid_keys = []
        for key in keys:
            if engine_class := ENGINES[category].get(key):
                engine_classes.append(engine_class)
            else:
                invalid_keys.append(key)

        if invalid_keys:
            logger.warning(
                "%s - backends do not exist or are disabled. Available: %s",
                ", ".join(sorted(invalid_keys)),
                ", ".join(sorted(engine_keys)),
            )

        # Initialize and cache engine instances
        instances = []
        for engine_class in engine_classes:
            # If already cached, use the cached instance
            if engine_class in self._engines_cache:
                instances.append(self._engines_cache[engine_class])
            # If not cached, create a new instance
            else:
                engine_instance = engine_class(proxy=self._proxy, timeout=self._timeout, verify=self._verify)
                self._engines_cache[engine_class] = engine_instance
                instances.append(engine_instance)

        if not instances:
            logger.warning("backend is not set. Using 'auto'")
            return self._get_engines(category, "auto")

        # sorting by `engine.priority`
        instances.sort(key=lambda e: (e.priority, random), reverse=True)
        return instances

    def _search_sync(  # noqa: C901
        self,
        category: str,
        query: str,
        keywords: str | None = None,
        *,
        region: str = "us-en",
        safesearch: str = "moderate",
        timelimit: str | None = None,
        max_results: int | None = 10,
        page: int = 1,
        backend: str = "auto",
        **kwargs: str,
    ) -> list[dict[str, Any]]:
        """Perform a search across engines in the given category.

        Args:
            category: The category of search engines (e.g., 'text', 'images', etc.).
            query: The search query.
            keywords: Deprecated alias for `query`.
            region: The region to use for the search (e.g., us-en, uk-en, ru-ru, etc.).
            safesearch: The safesearch setting (e.g., on, moderate, off).
            timelimit: The timelimit for the search (e.g., d, w, m, y) or custom date range.
            max_results: The maximum number of results to return. Defaults to 10.
            page: The page of results to return. Defaults to 1.
            backend: A single or comma-delimited backends. Defaults to "auto".
            **kwargs: Additional keyword arguments to pass to the search engines.

        Returns:
            A list of dictionaries containing the search results.

        """
        query = keywords or query
        if not query:
            msg = "query is mandatory."
            raise DDGSException(msg)

        engines = self._get_engines(category, backend)
        len_unique_providers = len({engine.provider for engine in engines})
        seen_providers: set[str] = set()

        # Perform search
        results_aggregator: ResultsAggregator[set[str]] = ResultsAggregator({"href", "image", "url", "embed_url"})
        max_workers = min(len_unique_providers, ceil(max_results / 10) + 1) if max_results else len_unique_providers
        if DDGS.threads:
            max_workers = min(max_workers, DDGS.threads)
        futures, err = {}, None
        with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="DDGS") as executor:
            for i, engine in enumerate(engines, start=1):
                if engine.provider in seen_providers:
                    continue
                future = executor.submit(
                    engine.search,
                    query,
                    region=region,
                    safesearch=safesearch,
                    timelimit=timelimit,
                    page=page,
                    **kwargs,
                )
                futures[future] = engine

                if len(futures) >= max_workers or i >= max_workers:
                    done, not_done = wait(futures, timeout=self._timeout, return_when="FIRST_EXCEPTION")
                    for f, f_engine in futures.items():
                        if f in done:
                            try:
                                if r := f.result():
                                    results_aggregator.extend(r)
                                    seen_providers.add(f_engine.provider)
                            except Exception as ex:  # noqa: BLE001
                                err = ex
                                logger.info("Error in engine %s: %r", f_engine.name, ex)
                    futures = {f: futures[f] for f in not_done}

                if max_results and len(results_aggregator) >= max_results:
                    break

   
```

### Core Architecture Module: `ddgs/engines/__init__.py`
```
"""Automatically build registry of search engines.

This module defines the module-level variable ENGINES, which is a dictionary
of dictionaries. The keys of the outer dictionary are the categories of search
engines, and the keys of the inner dictionaries are the names of the search
engines. The values of the inner dictionaries are the classes of the search
engines.

The search engines are automatically discovered by looking for classes in the
module that are subclasses of :class:`ddgs.base.BaseSearchEngine` and
subclasses of the base class do not have names starting with "Base", and
do not have a class attribute "disabled" set to True.

The module automatically builds the ENGINES dictionary, so it should not be
imported directly by user code.

Example of resulting dictionary ENGINES:

from .bing import Bing
from .brave import Brave
from .duckduckgo import Duckduckgo
from .duckduckgo_images import DuckduckgoImages
from .duckduckgo_news import DuckduckgoNews
from .duckduckgo_videos import DuckduckgoVideos
from .google import Google
from .mojeek import Mojeek
from .wikipedia import Wikipedia
from .yahoo import Yahoo
from .yandex import Yandex

ENGINES: dict[str, dict[str, type[BaseSearchEngine[Any]]]] = {
    "text": {
        "bing": Bing,
        "brave": Brave,
        "duckduckgo": Duckduckgo,  # bing
        "google": Google,
        "mojeek": Mojeek,
        "yahoo": Yahoo,  # bing
        "yandex": Yandex,
        "wikipedia": Wikipedia,
    },
    "images": {
        "duckduckgo": DuckduckgoImages,
    },
    "news": {
        "duckduckgo": DuckduckgoNews,
    },
    "videos": {
        "duckduckgo": DuckduckgoVideos,
    },
}
"""

import importlib
import inspect
import pkgutil
from collections import defaultdict
from typing import Any

from ddgs.base import BaseSearchEngine

# ENGINES[category][name] = class
ENGINES: dict[str, dict[str, type[BaseSearchEngine[Any]]]] = defaultdict(dict)

package_name = __name__
package = importlib.import_module(package_name)

for finder, modname, _ispkg in pkgutil.iter_modules(package.__path__, package_name + "."):
    module_path = finder.path if hasattr(finder, "path") else finder
    module = importlib.import_module(modname)
    for _, cls in inspect.getmembers(module, inspect.isclass):
        # 1) must subclass BaseSearchEngine (but not the base itself)
        if not issubclass(cls, BaseSearchEngine) or cls is BaseSearchEngine:
            continue

        # 2) skip any class whose name starts with "Base"
        if cls.__name__.startswith("Base"):
            continue

        # 3) skip disabled engines
        if getattr(cls, "disabled", True):
            continue

        # 3) ensure they provided name & category
        name = getattr(cls, "name", None)
        category = getattr(cls, "category", None)
        if not isinstance(name, str) or not isinstance(category, str):
            msg = f"{cls.__qualname__} must define class attributes 'name: str' and 'category: str'."
            raise TypeError(msg)

        ENGINES[category][name] = cls

# freeze into normal dicts
ENGINES = {cat: dict(m) for cat, m in ENGINES.items()}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #442** (2026-04-06): **ToolException('Error executing tool search_images: No results found.')**
  *Symptoms*: **Before you open an issue:** - [X] I have the latest version. (Check: `ddgs version`. Update: `pip install -U ddgs`) - [X] I tried reinstalling the library. (`pip install -I ddgs`) - [ ] I tried using a proxy  ## Describe the bug  The mcp tool that search images alway return no result found.  **Steps to reproduce the problem:** Launch the mcp server (ddgs mcp). Ask your agent to search an image (ex: Search a satellite image of the earth.)  You will see the error: ```py =1 run_id=019d3631-452a-7471-a2a7-fdf6c42959ce thread_id=3894607e-9962-456a-9d86-c062506829da thread_name=asyncio_1 2026-03-28T20:44:55.612473Z [info     ] HTTP Request: POST https://openrouter.ai/api/v1/chat/completions "HTTP/1.1 200 OK" [httpx] api_variant=local_dev assistant_id=fe096781-5601-53d2-b2f6-0d3403f7e9ca graph_id=agent langgraph_api_version=0.7.83 langgraph_node=model request_id=802cd397-8b30-491c-9359-f92fab940b3f run_attempt=1 run_id=019d3631-452a-7471-a2a7-fdf6c42959ce thread_id=3894607e-9962-456a-9d86-c062506829da thread_name=MainThread 2026-03-28T20:44:57.469226Z [warning  ] /home/jourdelune/Bureau/dev/media-ai/.venv/lib/python3.12/site-packages/structlog/stdlib.py:1166: UserWarning: Remove `format_exc_info` from your processor chain if you want pretty exceptions.   ed = p(logger, meth_name, ed)  # type: ignore[arg-type]  [py.warnings] api_variant=local_dev assistant_id=fe096781-5601-53d2-b2f6-0d3403f7e9ca graph_id=agent langgraph_api_version=0.7.83 request_id=802cd397-8b30-491c-9359-f92fab94
  **Post-Mortem & Fix Analysis**:
  > fixed in v9.13.0

- **Issue #416** (2026-03-01): **Ddgs suffixes hyphens with a space**
  *Symptoms*: **Before you open an issue:** - [x] I have the latest version. (Check: `ddgs version`. Update: `pip install -U ddgs`) - [ ] I tried reinstalling the library. (`pip install -I ddgs`) - [ ] I tried using a proxy  ## Describe the bug Ddgs suffixes hyphens (-) with a space in the `body` and `title`, here's an example: ```     {       "title": "GitHub - Farhie/docker- hashicorp - vault : PoC- ing vault"       "href": "https://github.com/farhie/docker-hashicorp-vault",       "body": "PoC- ing vault. Contribute to Farhie/docker- hashicorp - vault development by creating an account on GitHub.Run through the Hashicorp Vault hardening guide.",     }, ```  It should have been: ```     {       "title": "GitHub - Farhie/docker-hashicorp-vault : PoC-ing vault"       "href": "https://github.com/farhie/docker-hashicorp-vault",       "body": "PoC-ing vault. Contribute to Farhie/docker-hashicorp-vault development by creating an account on GitHub.Run through the Hashicorp Vault hardening guide.",     }, ```  Open the link in your browser to confirm.  What the bug is.  **Steps to reproduce the problem:** Please provide the steps to reproduce this problem.  ``` import json  from ddgs import DDGS  results = DDGS().text("Farhie docker-hashicorp-vault", max_results=5) print(json.dumps(results, indent=2)) ```  The `body` in the output query displays the issue: ```   {     "title": "GitHub - Farhie/docker-hashicorp-vault: PoC-ing vault",     "href": "https://github.com/Farhie/docker-hashicorp-vault", 
  **Post-Mortem & Fix Analysis**:
  > This is a patch that was generated to solve the bug.  I have not extensively studied the codebase of your project so I apologize in advance if this is not useful.  It might be short term bandaid.  Patch `apply.sh`. ```bash #!/usr/bin/env bash # Apply the ddgs text spacing patch to fix spurious spaces around punctuation. # See: https://github.com/deedy5/ddgs/issues/416 # # Usage: #   ./patches/apply.sh # # Tested against ddgs 9.10.0. After upgrading ddgs, re-run this script. # If the patch fails to apply, the upstream file may have changed — check # whether the fix has been merged upstream before patching manually.  set -euo pipefail  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)" PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)" PATCH_FILE="$SCRIPT_DIR/ddgs_text_spacing.patch"  # Locate the installed ddgs package (use uv run to ensure venv Python) SITE_PACKAGES="$(uv run python -c "import ddgs, pathlib; print(pathlib.Path(ddgs.__file__).parent)")" TARGET="$SITE_PACKAGES/base.py"  if [[ ! -f "$T
  > Fixed in https://github.com/deedy5/ddgs/pull/419

- **Issue #410** (2026-01-25): **ddgs image search: No results found**
  *Symptoms*: For image search, always return no results found.   - ddgs version: 9.10.0  ``` ddgs images -q apple           DDGSException: DDGSException('No results found.') ``` 
  **Post-Mortem & Fix Analysis**:
  > I try to use requests to fix this and submit a pull requests.
  > Not needed, works fine as is
  > I have the same problem. it works sometimes (source was bing). subsequent tries result in: DDGSException: DDGSException('No results found.') I suspect it's bot protection. It starts working again after a while, then fails again. Probably needs a better error message.

- **Issue #396** (2025-11-29): **Brave engine xpaths not working anymore**
  *Symptoms*: **Before you open an issue:** - [x] I have the latest version. (Check: `ddgs version`. Update: `pip install -U ddgs`) - [x] I tried reinstalling the library. (`pip install -I ddgs`) - [x] I tried using a proxy  ## Describe the bug  The brave search engine client does not return links for the search results found  **Steps to reproduce the problem:** ```bash uv add ddgs ```  ```python from ddgs.engines import Brave from pprint import pprint  pprint(Brave().search("ai inference"))  # output """ [TextResult(title='What is AI Inference in Machine Learning? - GeeksforGeeks',             href='',             body=''),  TextResult(title='What is AI inference?', href='', body=''),  TextResult(title='Get Instant AI Inference', href='', body=''), ... ] """ ```  **Solution that worked for me:** Seems like the parser is outdated, the following change solved things locally for me:  ```python class MyBrave(Brave):     elements_xpath = {         "title": ".//div[(contains(@class,'title') or contains(@class,'sitename-container')) and position()=last()]//text()",         # different rule for href to include deeper nesting and exclude thumbnail hrefs         "href": ".//a[not(contains(@class, 'thumbnail'))]/@href",         # different rule rule for body         "body": ".//div[contains(@class, 'content') and contains(@class,'desktop-default-regular')]//text()",     }   pprint(MyBrave().search("ai inference") # output """ [TextResult(title='AI inference vs. training: What is AI inference? | '   
  **Post-Mortem & Fix Analysis**:
  > Thanks for the issue, fixed in https://github.com/deedy5/ddgs/pull/397

- **Issue #390** (2025-11-14): **The issue of backend choosing duckduckgo**
  *Symptoms*: Now in my code, the backend only selects duckduckgo, but at this point, it prompts that no result is returned. But when I add other engines to the backend, there will be results. May I ask if duckduckgo is no longer supported at present?   ```python from ddgs import DDGS from pprint import pprint  search = ["duckduckgo", "wikipedia", "brave", "mojeek", "yahoo", "yandex"] # search = ["duckduckgo"]  ddgs = DDGS(timeout=40) results = ddgs.text(query="Trump", region="us-en", safesearch='moderate', timelimit=None, max_results=10, page=1, backend=", ".join(search)) pprint(results)  # DDGSException: No results found. ```
  **Post-Mortem & Fix Analysis**:
  > Have you tried with proxy?
  > > Have you tried with proxy?  I used a proxy. When I set the engine to ["duckduckgo", "wikipedia", "brave", "mojeek", "yahoo", "yandex"], I could get the search results normally. The specific code and results are as follows: ```python from ddgs import DDGS from pprint import pprint  search = ["duckduckgo", "wikipedia", "brave", "mojeek", "yahoo", "yandex"]  proxy_url = "socks5h://127.0.0.1:7891"  ddgs = DDGS(proxy=proxy_url, timeout=40) results = ddgs.text(query="Apple", region="us-en", safesearch='moderate', timelimit=None, max_results=10, backend=", ".join(search)) pprint(results)  # [{'body': 'Apple is no stranger to failure, but this year may enter history as ' #           'one of the most difficult for the iPhone.', #   'href': 'https://www.phonearena.com/news/apple-has-two-failed-iphones-in-2025-and-you-wont-be-surprised-which-those-are_id175713', #   'title': 'Apple has two failed iPhones in 2025, and you won’t be... - ' #            'PhoneArena'}, #  {'body': 'Apple sends a rec
  > Fixed in https://github.com/deedy5/ddgs/pull/391 Update to v9.9.1

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

### Incident Patch 1: `9f517bc4` (2026-08-26)
**Commit Message**: fix(engines): update DuckDuckgo

**File**: `ddgs/engines/duckduckgo.py` (modified, +1/-15)
```diff
@@ -1,18 +1,11 @@
 """Duckduckgo search engine implementation."""
 
 from collections.abc import Mapping
-from typing import Any, ClassVar, TypeVar
-
-from fake_useragent import UserAgent
+from typing import Any, ClassVar
 
 from ddgs.base import BaseSearchEngine
-from ddgs.http_client2 import HttpClient2
 from ddgs.results import TextResult
 
-ua = UserAgent()
-
-T = TypeVar("T")
-
 
 class Duckduckgo(BaseSearchEngine[TextResult]):
     """Duckduckgo search engine."""
@@ -27,13 +20,6 @@ class Duckduckgo(BaseSearchEngine[TextResult]):
     items_xpath = "//div[contains(@class, 'body')]"
     elements_xpath: ClassVar[Mapping[str, str]] = {"title": ".//h2//text()", "href": "./a/@href", "body": "./a//text()"}
 
-    headers: ClassVar[dict[str, str]] = {"User-Agent": ua.random}
-
-    def __init__(self, proxy: str | None = None, timeout: int | None = None, *, verify: bool = True) -> None:
-        """Temporary, delete when HttpClient is fixed."""
-        self.http_client = HttpClient2(headers=self.headers, proxy=proxy, timeout=timeout, verify=verify)  # type: ignore[assignment]
-        self.results: list[T] = []  # type: ignore[valid-type]
-
     def build_payload(
         self,
         query: str,
```

**File**: `ddgs/http_client2.py` (removed, +0/-151)
```diff
@@ -1,151 +0,0 @@
-"""Temporary HTTP client for 'backend=duckduckgo'. Delete when HttpClient is fixed."""
-
-import logging
-import ssl
-from random import SystemRandom
-from types import TracebackType
-from typing import TYPE_CHECKING, Any
-
-import h2
-import httpcore
-import httpx
-
-from .exceptions import DDGSException, TimeoutException
-
-if TYPE_CHECKING:
-    from collections.abc import Callable
-
-
-logger = logging.getLogger(__name__)
-random = SystemRandom()
-
-
-class Response:
-    """HTTP response."""
-
-    __slots__ = ("content", "status_code", "text")
-
-    def __init__(self, status_code: int, content: bytes, text: str) -> None:
-        self.status_code = status_code
-        self.content = content
-        self.text = text
-
-
-class HttpClient2:
-    """Temporary HTTP client."""
-
-    def __init__(
-        self,
-        headers: dict[str, str] | None = None,
-        proxy: str | None = None,
-        timeout: int | None = 10,
-        *,
-        verify: bool | str = True,
-    ) -> None:
-        """Initialize the HttpClient object.
-
-        Args:
-            headers (dict, optional): headers for the HTTP client.
-            proxy (str, optional): proxy for the HTTP client, supports http/https/socks5 protocols.
-                example: "http://user:pass@example.com:3128". Defaults to None.
-            timeout (int, optional): Timeout value for the HTTP client. Defaults to 10.
-            verify: (bool | str):  True to verify, False to skip or str path to a PEM file. Defaults to True.
-
-        """
-        self.client = httpx.Client(
-            headers=headers,
-            proxy=proxy,
-            timeout=timeout,
-            verify=_get_random_ssl_context(verify=verify) if verify else False,
-            follow_redirects=False,
-            http2=True,
-        )
-
-    def request(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
-        """Make a request to the HTTP client."""
-        with Patch():
-            try:
-                resp = self.client.request(*args, **kwargs)
-                return Response(status_code=resp.status_code, content=resp.content, text=resp.text)
-            except Exception as ex:
-                if "timed out" in f"{ex}":
-                    msg = f"Request timed out: {ex!r}"
-                    raise TimeoutException(msg) from ex
-                msg = f"{type(ex).__name__}: {ex!r}"
-                raise DDGSException(msg) from ex
-
-    def get(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
-        """Make a GET request to the HTTP client."""
-        return self.request(*args, method="GET", **kwargs)
-
-    def post(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
-        """Make a POST request to the HTTP client."""
-        return self.request(*args, method="POST", **kwargs)
-
-
-# SSL
-DEFAULT_CIPHERS = [  # https://developers.cloudflare.com/ssl/reference/cipher-suites/recommendations/
-    "TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256",
-    # Modern:
-    "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-AES128-GCM-SHA256",
-    "ECDHE-RSA-CHACHA20-POLY1305", "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
-    # Compatible:
-    "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-AES128-GCM-SHA256",
-    "ECDHE-RSA-CHACHA20-POLY1305", "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
-    "ECDHE-ECDSA-AES128-SHA256", "ECDHE-RSA-AES128-SHA256", "ECDHE-ECDSA-AES256-SHA384",  "ECDHE-RSA-AES256-SHA384",
-    # Legacy:
-    "ECDHE-ECDSA-AES128-SHA", "ECDHE-RSA-AES128-SHA", "AES128-GCM-SHA256", "AES128-SHA256", "AES128-SHA",
-    "ECDHE-RSA-AES256-SHA", "AES256-GCM-SHA384", "AES256-SHA256", "AES256-SHA", "DES-CBC3-SHA",
-]  # fmt: skip
-
-
-def _get_random_ssl_context(*, verify: bool | str) -> ssl.SSLContext:
-    ssl_context = ssl.create_default_context(cafile=verify if isinstance(verify
```

**File**: `pyproject.toml` (modified, +1/-11)
```diff
@@ -28,10 +28,8 @@ classifiers = [
 ]
 dependencies = [
     "click>=8.1.8",
-    "primp>=1.2.3",
+    "primp>=1.3.1",
     "lxml>=4.9.4",
-    "httpx[http2,socks,brotli]>=0.28.1",  # temporarily
-    "fake-useragent>=2.2.0",
 ]
 dynamic = ["version"]
 
@@ -65,14 +63,6 @@ dev = [
     "types-pexpect",
     "types-PyYAML",
     "types-ujson",
-
-    # for mypy (httpx)
-    "types-PySocks",
-    "types-colorama",
-    "types-decorator",
-    "types-jsonschema",
-    "types-psutil",
-    "types-pyasn1"
 ]
 mcp = [
     "mcp>=2.0",
```

---

### Incident Patch 2: `3ea6cbcb` (2026-08-26)
**Commit Message**: fix(engines): update and enable Google

**File**: `ddgs/engines/google.py` (modified, +18/-25)
```diff
@@ -11,43 +11,31 @@
 
 
 def get_ua() -> str:
-    """Return one random Android Google App User-Agent string."""
-    # Device templates: (Android version, device string, Chrome major version range)
-    devices = (
-        ("5.0", "SM-G900P Build/LRX21T", 39, 60),
-        ("6.0", "Nexus 5 Build/MRA58N", 39, 60),
-        ("8.0", "Pixel 2 Build/OPD3.170816.012", 39, 60),
-    )
-    android_ver, device, chrome_min, chrome_max = random.choice(devices)
-    chrome_major = random.randint(chrome_min, chrome_max)
-    chrome_build = random.randint(1000, 9999)
-    chrome_patch = random.randint(1000, 1999)
-    ua = (
-        f"Mozilla/5.0 (Linux; Android {android_ver}; {device}) "
-        f"AppleWebKit/537.36 (KHTML, like Gecko) "
-        f"Chrome/{chrome_major}.0.{chrome_build}.{chrome_patch} Mobile Safari/537.36"
-    )
-    return ua + bytes.fromhex("4e53544e5756").decode()
+    """Return one User-Agent string."""
+    firmware = random.choice(("2.0617.1.0.3", "2.0625.2.0.2", "2.0635.2.0.2", "5.0706.4.0.1", "5.0819.4.0.1"))
+    ua = f"NokiaN72/{firmware} Series60/2.8 Profile/MIDP-2.0 Configuration/CLDC-1.1"
+    if random.choice((True, False)):
+        uc_version = random.choice(("7.9.1.120", "7.9.1.121", "7.9.1.122"))
+        ua += f"/UC Browser{uc_version}/27/351/UCWEB"
+    return ua
 
 
 class Google(BaseSearchEngine[TextResult]):
     """Google search engine."""
 
-    disabled = True
-
     name = "google"
     category = "text"
     provider = "google"
 
-    search_url = "https://www.google.com/search"
+    search_url = "https://www.google.com/wml/search"
     search_method = "GET"
     headers_update: ClassVar[dict[str, str]] = {"User-Agent": get_ua()}
 
-    items_xpath = "//div[@data-hveid][.//h3]"
+    items_xpath = "//div[./div[1]/a and ./div[2][table]]"
     elements_xpath: ClassVar[Mapping[str, str]] = {
-        "title": ".//h3//text()",
-        "href": ".//a[.//h3]/@href",
-        "body": "./div/div[last()]//text()",
+        "title": "./div[a]/a/span[1]/text()",
+        "href": "./div[a]/a/@href",
+        "body": "./div[2][table]//text()",
     }
 
     def build_payload(
@@ -65,6 +53,7 @@ def build_payload(
         start = (page - 1) * 10
         payload = {
             "q": query,
+            "sca_esv": "1",
             "filter": safesearch_base[safesearch.lower()],
             "start": str(start),
         }
@@ -76,12 +65,16 @@ def build_payload(
             payload["tbs"] = f"qdr:{timelimit}"
         return payload
 
+    def pre_process_html(self, html_text: str) -> str:
+        """Pre-process html_text before extracting results."""
+        return html_text[html_text.find("?>") :]
+
     def post_extract_results(self, results: list[TextResult]) -> list[TextResult]:
         """Post-process search results."""
         post_results = []
         for result in results:
             if result.href.startswith("/url?q="):
-                result.href = result.href.split("?q=")[1].split("&")[0]
+                result.href = result.href.split("?q=")[1].split("&")[0].split("?")[0]
             if result.title and result.href.startswith("http"):
                 post_results.append(result)
         return post_results
```

---

### Incident Patch 3: `f4ba66ca` (2026-08-16)
**Commit Message**: fix(engines): disable Google, Yandex

**File**: `README.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ pip install -U ddgs[mcp]  # MCP server (stdio)
 ## CLI version
 
 ```python3
-ddgs --help
+ddgs - -help
 ```
 
 [Go To TOP](#TOP)
```

**File**: `ddgs/engines/google.py` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ def get_ua() -> str:
 class Google(BaseSearchEngine[TextResult]):
     """Google search engine."""
 
+    disabled = True
+
     name = "google"
     category = "text"
     provider = "google"
```

**File**: `ddgs/engines/yandex.py` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@
 class Yandex(BaseSearchEngine[TextResult]):
     """Yandex search engine."""
 
+    disabled = True
+
     name = "yandex"
     category = "text"
     provider = "yandex"
```

**File**: `ddgs/http_client2.py` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ def _get_random_ssl_context(*, verify: bool | str) -> ssl.SSLContext:
     ssl_context = ssl.create_default_context(cafile=verify if isinstance(verify, str) else None)
     shuffled_ciphers = random.sample(DEFAULT_CIPHERS[9:], len(DEFAULT_CIPHERS) - 9)
     ssl_context.set_ciphers(":".join(DEFAULT_CIPHERS[:9] + shuffled_ciphers))
-    commands: list[None | Callable[[ssl.SSLContext], None]] = [
+    commands: list[Callable[[ssl.SSLContext], None] | None] = [
         None,
         lambda context: setattr(context, "maximum_version", ssl.TLSVersion.TLSv1_2),
         lambda context: setattr(context, "minimum_version", ssl.TLSVersion.TLSv1_3),
```

**File**: `pyproject.toml` (modified, +2/-1)
```diff
@@ -75,7 +75,7 @@ dev = [
     "types-pyasn1"
 ]
 mcp = [
-    "mcp>=1.26.0",
+    "mcp>=1.26.0,<2.0",
 ]
 api = [
     "fastapi>=0.135.1",
@@ -153,6 +153,7 @@ ignore = [
     "D213",  # multi-line-summary-second-line
     "N818",  # Exception name {name} should be named with an Error suffix
     "PLR0913",  # Too many arguments to function call
+    "PLR0917",  # Too many positional arguments in function definition
     "PLR2004",  # Magic value used in comparison
     "SLF001",  # Private member accessed
 ]
```

---

### Incident Patch 4: `21de33d6` (2026-05-15)
**Commit Message**: fix(engines): update DuckDuckgo

**File**: `ddgs/engines/duckduckgo.py` (modified, +15/-1)
```diff
@@ -1,11 +1,18 @@
 """Duckduckgo search engine implementation."""
 
 from collections.abc import Mapping
-from typing import Any, ClassVar
+from typing import Any, ClassVar, TypeVar
+
+from fake_useragent import UserAgent
 
 from ddgs.base import BaseSearchEngine
+from ddgs.http_client2 import HttpClient2
 from ddgs.results import TextResult
 
+ua = UserAgent()
+
+T = TypeVar("T")
+
 
 class Duckduckgo(BaseSearchEngine[TextResult]):
     """Duckduckgo search engine."""
@@ -20,6 +27,13 @@ class Duckduckgo(BaseSearchEngine[TextResult]):
     items_xpath = "//div[contains(@class, 'body')]"
     elements_xpath: ClassVar[Mapping[str, str]] = {"title": ".//h2//text()", "href": "./a/@href", "body": "./a//text()"}
 
+    headers: ClassVar[dict[str, str]] = {"User-Agent": ua.random}
+
+    def __init__(self, proxy: str | None = None, timeout: int | None = None, *, verify: bool = True) -> None:
+        """Temporary, delete when HttpClient is fixed."""
+        self.http_client = HttpClient2(headers=self.headers, proxy=proxy, timeout=timeout, verify=verify)  # type: ignore[assignment]
+        self.results: list[T] = []  # type: ignore[valid-type]
+
     def build_payload(
         self,
         query: str,
```

**File**: `ddgs/http_client2.py` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+"""Temporary HTTP client for 'backend=duckduckgo'. Delete when HttpClient is fixed."""
+
+import logging
+import ssl
+from random import SystemRandom
+from types import TracebackType
+from typing import TYPE_CHECKING, Any
+
+import h2
+import httpcore
+import httpx
+
+from .exceptions import DDGSException, TimeoutException
+
+if TYPE_CHECKING:
+    from collections.abc import Callable
+
+
+logger = logging.getLogger(__name__)
+random = SystemRandom()
+
+
+class Response:
+    """HTTP response."""
+
+    __slots__ = ("content", "status_code", "text")
+
+    def __init__(self, status_code: int, content: bytes, text: str) -> None:
+        self.status_code = status_code
+        self.content = content
+        self.text = text
+
+
+class HttpClient2:
+    """Temporary HTTP client."""
+
+    def __init__(
+        self,
+        headers: dict[str, str] | None = None,
+        proxy: str | None = None,
+        timeout: int | None = 10,
+        *,
+        verify: bool | str = True,
+    ) -> None:
+        """Initialize the HttpClient object.
+
+        Args:
+            headers (dict, optional): headers for the HTTP client.
+            proxy (str, optional): proxy for the HTTP client, supports http/https/socks5 protocols.
+                example: "http://user:pass@example.com:3128". Defaults to None.
+            timeout (int, optional): Timeout value for the HTTP client. Defaults to 10.
+            verify: (bool | str):  True to verify, False to skip or str path to a PEM file. Defaults to True.
+
+        """
+        self.client = httpx.Client(
+            headers=headers,
+            proxy=proxy,
+            timeout=timeout,
+            verify=_get_random_ssl_context(verify=verify) if verify else False,
+            follow_redirects=False,
+            http2=True,
+        )
+
+    def request(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
+        """Make a request to the HTTP client."""
+        with Patch():
+            try:
+                resp = self.client.request(*args, **kwargs)
+                return Response(status_code=resp.status_code, content=resp.content, text=resp.text)
+            except Exception as ex:
+                if "timed out" in f"{ex}":
+                    msg = f"Request timed out: {ex!r}"
+                    raise TimeoutException(msg) from ex
+                msg = f"{type(ex).__name__}: {ex!r}"
+                raise DDGSException(msg) from ex
+
+    def get(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
+        """Make a GET request to the HTTP client."""
+        return self.request(*args, method="GET", **kwargs)
+
+    def post(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
+        """Make a POST request to the HTTP client."""
+        return self.request(*args, method="POST", **kwargs)
+
+
+# SSL
+DEFAULT_CIPHERS = [  # https://developers.cloudflare.com/ssl/reference/cipher-suites/recommendations/
+    "TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256",
+    # Modern:
+    "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-AES128-GCM-SHA256",
+    "ECDHE-RSA-CHACHA20-POLY1305", "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
+    # Compatible:
+    "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-AES128-GCM-SHA256",
+    "ECDHE-RSA-CHACHA20-POLY1305", "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
+    "ECDHE-ECDSA-AES128-SHA256", "ECDHE-RSA-AES128-SHA256", "ECDHE-ECDSA-AES256-SHA384",  "ECDHE-RSA-AES256-SHA384",
+    # Legacy:
+    "ECDHE-ECDSA-AES128-SHA", "ECDHE-RSA-AES128-SHA", "AES128-GCM-SHA256", "AES128-SHA256", "AES128-SHA",
+    "ECDHE-RSA-AES256-SHA", "AES256-GCM-SHA384", "AES256-SHA256", "AES256-SHA", "DES-CBC3-SHA",
+]  # fmt: skip
+
+
+def _get_random_ssl_context(*, verify: bool | str) -> ssl.SSLContext:
+    ssl_context = ssl.create_default_context(cafile=verify if isinstance(verify
```

**File**: `pyproject.toml` (modified, +11/-1)
```diff
@@ -30,6 +30,8 @@ dependencies = [
     "click>=8.1.8",
     "primp>=1.2.3",
     "lxml>=4.9.4",
+    "httpx[http2,socks,brotli]>=0.28.1",  # temporarily
+    "fake-useragent>=2.2.0",
 ]
 dynamic = ["version"]
 
@@ -62,7 +64,15 @@ dev = [
     "types-Pygments",
     "types-pexpect",
     "types-PyYAML",
-    "types-ujson"
+    "types-ujson",
+
+    # for mypy (httpx)
+    "types-PySocks",
+    "types-colorama",
+    "types-decorator",
+    "types-jsonschema",
+    "types-psutil",
+    "types-pyasn1"
 ]
 mcp = [
     "mcp>=1.26.0",
```

---

### Incident Patch 5: `ad0f617d` (2026-05-14)
**Commit Message**: fix(engines): update Google useragents

**File**: `ddgs/engines/google.py` (modified, +1/-3)
```diff
@@ -27,14 +27,12 @@ def get_ua() -> str:
         f"AppleWebKit/537.36 (KHTML, like Gecko) "
         f"Chrome/{chrome_major}.0.{chrome_build}.{chrome_patch} Mobile Safari/537.36"
     )
-    return f"{ua} GoogleApp/{random.randint(0, 9)}"
+    return ua + bytes.fromhex("4e53544e5756").decode()
 
 
 class Google(BaseSearchEngine[TextResult]):
     """Google search engine."""
 
-    disabled = True  # !!!
-
     name = "google"
     category = "text"
     provider = "google"
```

---

### Incident Patch 6: `6e4a5070` (2026-04-20)
**Commit Message**: fix(engines): disable Google until fixed

**File**: `ddgs/engines/google.py` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ def get_ua() -> str:
 class Google(BaseSearchEngine[TextResult]):
     """Google search engine."""
 
+    disabled = True  # !!!
+
     name = "google"
     category = "text"
     provider = "google"
```

---

### Incident Patch 7: `a1ff07dd` (2026-04-17)
**Commit Message**: fix(dht): remove git dependencies from published extra group

PyPI rejects packages containing direct VCS dependencies. Comment out
coincurve and libp2p git references from the dht optional dependency
group. Update README with manual installation steps for these required
DHT dependencies and remove DHT entry from quick install examples.

**File**: `README.md` (modified, +7/-5)
```diff
@@ -26,7 +26,6 @@ ___
 pip install -U ddgs       # Base install
 pip install -U ddgs[api]  # API server (FastAPI)
 pip install -U ddgs[mcp]  # MCP server (stdio)
-pip install -U ddgs[dht]  # DHT Network (BETA)
 ```
 
 ## CLI version
@@ -117,14 +116,17 @@ When running:
 ### Installation
 
 ```bash
-# For Linux
+# Install base DHT package
 pip install -U ddgs[dht]
 
-# For macOS, first install gmp via homebrew:
+# Install required dependencies (works on Linux and macOS)
+pip install coincurve@git+https://github.com/ofek/coincurve.git@7829b29c08ebb1cc80386a1cdaf8c2243c4ef5c5
+pip install libp2p@git+https://github.com/libp2p/py-libp2p.git@0e88584c89377086883c6f5b26cd1a8052399be7
+
+# macOS only: First install gmp
 brew install gmp
-pip install -U ddgs[dht]
 
-# For Windows: DHT is not currently supported. Use base package only.
+# Windows: DHT is not supported. Use base package only.
 ```
 
 When installed, DHT:
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -74,9 +74,9 @@ api = [
 dht = [
     "fastapi>=0.135.1",
     "uvicorn[standard]>=0.41.0",
-    "coincurve @ git+https://github.com/ofek/coincurve.git@7829b29c08ebb1cc80386a1cdaf8c2243c4ef5c5",
-    "libp2p @ git+https://github.com/libp2p/py-libp2p.git@0e88584c89377086883c6f5b26cd1a8052399be7",
     "trio>=0.25.0",
+    #"coincurve @ git+https://github.com/ofek/coincurve.git@7829b29c08ebb1cc80386a1cdaf8c2243c4ef5c5",
+    #"libp2p @ git+https://github.com/libp2p/py-libp2p.git@0e88584c89377086883c6f5b26cd1a8052399be7",
 ]
 
 [tool.ruff]
```

---

### Incident Patch 8: `49c79d66` (2026-04-14)
**Commit Message**: fix(base): remove per-element strip in extract_results

**File**: `ddgs/base.py` (modified, +1/-2)
```diff
@@ -91,8 +91,7 @@ def extract_results(self, html_text: str) -> list[T]:
         for item in items:
             result = self.result_type()
             for key, value in self.elements_xpath.items():
-                parts = (x.strip() for x in item.xpath(value))
-                data = " ".join("".join(parts).split())
+                data = " ".join("".join(item.xpath(value)).split())
                 result.__setattr__(key, data)
             results.append(result)
         return results
```

---

### Incident Patch 9: `cc543d29` (2026-04-11)
**Commit Message**: fix(cli): handle deprecated -k flag in _sanitize_query

**File**: `ddgs/cli.py` (modified, +4/-4)
```diff
@@ -245,7 +245,7 @@ def text(
         page=page,
         backend=backend,
     )
-    query = _sanitize_query(query)
+    query = _sanitize_query(keywords or query)
     if output:
         _save_data(query, data, "text", filename=output)
     if download:
@@ -354,7 +354,7 @@ def images(
         layout=layout,
         license_image=license_image,
     )
-    query = _sanitize_query(query)
+    query = _sanitize_query(keywords or query)
     if output:
         _save_data(query, data, function_name="images", filename=output)
     if download:
@@ -426,7 +426,7 @@ def videos(
         duration=duration,
         license_videos=license_videos,
     )
-    query = _sanitize_query(query)
+    query = _sanitize_query(keywords or query)
     if output:
         _save_data(query, data, function_name="videos", filename=output)
     else:
@@ -479,7 +479,7 @@ def news(
         page=page,
         backend=backend,
     )
-    query = _sanitize_query(query)
+    query = _sanitize_query(keywords or query)
     if output:
         _save_data(query, data, function_name="news", filename=output)
     else:
```

---

### Incident Patch 10: `9e4e71f9` (2026-04-08)
**Commit Message**: fix(cli): add bing backend to images command

**File**: `ddgs/cli.py` (modified, +1/-1)
```diff
@@ -274,7 +274,7 @@ def text(
     "-b",
     "--backend",
     default=["auto"],
-    type=click.Choice(["auto", "all", "duckduckgo"]),
+    type=click.Choice(["auto", "all", "bing", "duckduckgo"]),
     multiple=True,
     callback=_convert_tuple_to_csv,
 )
```

**File**: `skills/ddgs/SKILL.md` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ Available backends by method:
 | Method | Backends |
 |--------|----------|
 | `text()` | `bing`, `brave`, `duckduckgo`, `google`, `grokipedia`, `mojeek`, `yandex`, `yahoo`, `wikipedia` |
-| `images()` | `duckduckgo` |
+| `images()` | `bing`, `duckduckgo` |
 | `videos()` | `duckduckgo` |
 | `news()` | `bing`, `duckduckgo`, `yahoo` |
 | `books()` | `annasarchive` |
```

#### Recent Merged Pull Requests:
- **PR #469** (closed): Fix '**kwargs' bug that prevented passing 'max_results' argument to the 'build_payload' function & Allow searching multiple pages if one page is not enough (@Miss-Tired-Ghost)
- **PR #467** (2026-05-23): refactor(ddgs): improve extract performance (@Mizarka)
- **PR #466** (2026-05-17): feat: remove dht (@deedy5)
- **PR #465** (2026-05-15): fix(engines): update DuckDuckgo (@deedy5)
- **PR #464** (2026-05-14): feat(engines): add Startpage (@deedy5)
- **PR #462** (closed): remove grokipedia from "auto" (@neuhaus)
- **PR #460** (closed): fix(DuckDuckGo): correct search method and clean up URL (@kidonng)
- **PR #456** (2026-05-03): refactor(ddgs): improve engine selection and error handling (@deedy5)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
