# Forensic Learning Record (Deep Inspection): VectifyAI/PageIndex

> **Canonical Artifact**: `07_PROJECT_LEARNING/vectifyai-pageindex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:18:45.890Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `VectifyAI/PageIndex`
- **Description**: 📑 PageIndex: Document Index for Vectorless, Reasoning-based RAG
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 38683 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pageindex/utils.py`
```
import contextvars
import logging
import os
import sys
import textwrap
from datetime import datetime
import time
import json
import PyPDF2
import copy
import asyncio
import heapq
from contextlib import asynccontextmanager
from io import BytesIO
from dotenv import find_dotenv, load_dotenv
load_dotenv(find_dotenv(usecwd=True))
# litellm's import fetches its model map over the network unless told not to.
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")
import logging
import yaml
from pathlib import Path
from types import SimpleNamespace as config
import re

# litellm is imported inside the functions that use it; eager import is slow
# and fetches a remote model-cost map.


# The indexing lane's connection overrides, scoped by LocalAPI around each
# indexing operation — a contextvar, so the value reaches this module's
# helpers and their asyncio tasks without threading it through every call.
_llm_backend: contextvars.ContextVar = contextvars.ContextVar(
    "pageindex_llm_backend", default=None)


def _repair_litellm_types() -> None:
    """litellm 1.97.0's Message/Delta annotations carry nested forward refs
    Python 3.10 cannot resolve (BerriAI/litellm#36384), so every completion
    dies constructing its response. Rebuild them once with the defining
    modules' names; no-op on 3.11+ and on fixed litellm releases."""
    if sys.version_info >= (3, 11):
        return
    try:
        import litellm.types.llms.openai as openai_types
        import litellm.types.utils as litellm_types
        namespace = {**vars(openai_types), **vars(litellm_types)}
        litellm_types.Message.model_rebuild(_types_namespace=namespace)
        litellm_types.Delta.model_rebuild(_types_namespace=namespace)
    except Exception:
        pass  # best-effort: a failed repair leaves litellm's own error


def _mute_litellm_bridge_usage_warning() -> None:
    """litellm's chat→Responses bridge (e.g. OpenAI gpt-5.4+ with function
    tools) logs a chat-shaped usage dict inside a ResponseAPIUsage field
    (litellm_logging._get_assembled_streaming_response, 1.97–1.98), and
    pydantic reports it on every streamed turn. Hide exactly that message;
    every other warning still surfaces."""
    import warnings
    warnings.filterwarnings(
        "ignore",
        message=r"Pydantic serializer warnings:\s+"
                r"(PydanticSerializationUnexpectedValue\()?Expected `ResponseAPIUsage`")


def _quiet_litellm() -> None:
    """Mute litellm's stdout "Provider List:" banner and default its loggers
    to LITELLM_LOG (ERROR unset); a level set elsewhere stays."""
    import litellm
    litellm.suppress_debug_info = True
    level = getattr(logging, os.environ.get("LITELLM_LOG", "ERROR").upper(),
                    logging.ERROR)
    for name in ("LiteLLM", "LiteLLM Router", "LiteLLM Proxy", "litellm"):
        logger = logging.getLogger(name)
        if logger.level == logging.NOTSET:
            logger.setLevel(level)

# Backward compatibility: support CHATGPT_API_KEY as alias for OPENAI_API_KEY
if not os.getenv("OPENAI_API_KEY") and os.getenv("CHATGPT_API_KEY"):
    import warnings
    warnings.warn("CHATGPT_API_KEY is deprecated — set OPENAI_API_KEY "
                  "instead.", FutureWarning)
    os.environ["OPENAI_API_KEY"] = os.getenv("CHATGPT_API_KEY")

def count_tokens(text, model=None):
    if not text:
        return 0
    import litellm
    try:
        return litellm.token_counter(model=model, text=text)
    except Exception:
        return litellm.token_counter(model=None, text=text)


def _strip_prefix(s, prefix):
    if s.startswith(prefix):
        return s[len(prefix):]
    return s


def run_off_loop(func, *args):
    """Run func now, or on a worker thread when this thread already runs an
    asyncio loop (func may itself call asyncio.run)."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return func(*args)
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(func, *args).result()


def _litellm_model(model):
    """Normalize to LiteLLM's grammar (``litellm/`` strips, bare names get
    the ``openai/`` wire form — same as the chat lane) and refuse an
    unknown provider with the 404 the retry loop treats as unrecoverable.
    Credentials are LiteLLM's own call, made at the first completion."""
    if not model:
        return model
    model = _strip_prefix(model, "litellm/")
    if "/" not in model:
        model = f"openai/{model}"
    import litellm
    provider = model.split("/", 1)[0]
    providers = getattr(litellm, "provider_list", None)
    # custom_provider_map providers join provider_list only at call time.
    custom = {entry.get("provider") for entry
              in getattr(litellm, "custom_provider_map", None) or []}
    if providers and provider not in providers and provider not in custom:
        raise litellm.NotFoundError(
            f"'{model}' routes through LiteLLM, but '{provider}' is not a "
            f"LiteLLM provider. For an OpenAI-compatible server serving "
            f"this model id, use 'openai/{model}' and point "
            f"OPENAI_BASE_URL at the server.",
            llm_provider=None, model=model)
    return model


# Misconfiguration: no retry can fix a rejected key or a model that does not
# exist, and every later call fails the same way. An unknown status is a
# transport failure and stays retryable.
_UNRECOVERABLE_STATUS = frozenset({401, 403, 404})

# A 400 (context_length_exceeded) is equally unfixable by retry — the prompt
# will not shrink — but it is per-prompt: the ladder raises it immediately
# and consumers absorb it instead of failing the run.
_NO_RETRY_STATUS = _UNRECOVERABLE_STATUS | frozenset({400})


class LLMRetriesExhausted(RuntimeError):
    """The retry ladder gave up; carries the last error's status_code."""

    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


def _is_unrecoverable(exc: Exception) -> bool:
    if isinstance(exc, LLMRetriesExhausted):
        # 400 carries context_length_exceeded, the per-prompt failure the
        # caller absorbs (see above); any other exhausted ladder is fatal.
        return exc.status_code != 400
    return getattr(exc, "status_code", None) in _UNRECOVERABLE_STATUS


def llm_completion(model, prompt, chat_history=None, return_finish_reason=False):
    import litellm
    max_retries = 10
    messages = list(chat_history) + [{"role": "user", "content": prompt}] if chat_history else [{"role": "user", "content": prompt}]
    backend = _llm_backend.get()
    model = _litellm_model(model)
    _repair_litellm_types()
    _quiet_litellm()
    for i in range(max_retries):
        try:
            response = litellm.completion(**{
                "model": model,
                "messages": messages,
                "drop_params": True,
                # the loop is the retry policy; the merge lets a backend override win
                "max_retries": 0,
                **(backend or {}),
            })
            content = response.choices[0].message.content
            if return_finish_reason:
                finish_reason = "max_output_reached" if response.choices[0].finish_reason == "length" else "finished"
                return content, finish_reason
            return content
        except Exception as e:
            if getattr(e, "status_code", None) in _NO_RETRY_STATUS:
                raise
            logging.error(f"Error: {e}")
            if i < max_retries - 1:
                logging.warning("Retrying LLM completion")
                time.sleep(1)
            else:
                raise LLMRetriesExhausted(
                    f"LLM completion failed after {max_retries} retries: {e}",
                    status_code=getattr(e, "status_code", None),
                ) from e


async def llm_acompletion(model, prompt):
    import litellm
    max_retries = 10
    messages = [{"role": "user", "content": prompt}]
    backend = _llm_backend.get()
    model = _litellm_model(model)
    _repair_litellm_types()
    _quiet_litellm()
    for i in range(max_retries):
        try:
            response = await litellm.acompletion(**{
                "model": model,
                "messages": messages,
                "drop_params": True,
                "max_retries": 0,
                **(backend or {}),
            })
            return response.choices[0].message.content
        except Exception as e:
            if getattr(e, "status_code", None) in _NO_RETRY_STATUS:
                raise
            logging.error(f"Error: {e}")
            if i < max_retries - 1:
                logging.warning("Retrying LLM completion")
                await asyncio.sleep(1)
            else:
                raise LLMRetriesExhausted(
                    f"LLM completion failed after {max_retries} retries: {e}",
                    status_code=getattr(e, "status_code", None),
                ) from e


def get_json_content(response):
    start_idx = response.find("```json")
    if start_idx != -1:
        start_idx += 7
        response = response[start_idx:]
        
    end_idx = response.rfind("```")
    if end_idx != -1:
        response = response[:end_idx]
    
    json_content = response.strip()
    return json_content
         

def extract_json(content):
    try:
        # First, try to extract JSON enclosed within ```json and ```
        start_idx = content.find("```json")
        if start_idx != -1:
            start_idx += 7  # Adjust index to start after the delimiter
            end_idx = content.rfind("```")
            json_content = content[start_idx:end_idx].strip()
        else:
            # If no delimiters, assume entire content could be JSON
            json_content = content.strip()

        # Clean up common issues that might cause parsing errors
        json_content = json_content.replace('None', 'null')  # Replac
```

### Core Architecture Module: `pageindex/__init__.py`
```
"""PageIndex SDK."""
from typing import TYPE_CHECKING as _TYPE_CHECKING

from .chat_stream import ChatStream
from .client import PageIndexClient, PageIndexCloudClient, PageIndexLocalClient
from .errors import PageIndexAPIError
from .types import (ChatConfig, ChatProcessOptions, CloudIndexConfig,
                    IndexConfig, LocalIndexConfig)

if _TYPE_CHECKING:
    from .flash import page_index_flash
    from .imaging import highlight_region
    from .page_index_classic import page_index, page_index_main
    from .page_index_md import md_to_tree
    from .tree_optimize import optimize_tree

__all__ = [
    "PageIndexClient", "PageIndexCloudClient", "PageIndexLocalClient",
    "PageIndexAPIError",
    "IndexConfig", "CloudIndexConfig", "LocalIndexConfig", "ChatConfig",
    "ChatProcessOptions", "ChatStream",
    "page_index", "page_index_main", "page_index_flash",
    "optimize_tree", "md_to_tree", "highlight_region",
]

_LAZY = {
    "highlight_region": ".imaging",
    "page_index_flash": ".flash",
    "optimize_tree": ".tree_optimize",
    "md_to_tree": ".page_index_md",
}
_SUBMODULES = {"agent_tools", "chat_stream", "client", "cloud_api", "errors",
               "flash", "imaging", "integrations", "local_api", "local_chat",
               "local_store", "mcp_bridge", "page_index_classic",
               "page_index_md", "tree_optimize", "types", "utils"}


def __getattr__(name):
    if name.startswith("_"):
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    import importlib
    if name in _SUBMODULES:
        return importlib.import_module(f".{name}", __name__)
    module = importlib.import_module(_LAZY.get(name, ".page_index_classic"), __name__)
    try:
        value = getattr(module, name)
    except AttributeError:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}") from None
    globals()[name] = value
    return value


def __dir__():
    return sorted(set(globals()) | set(__all__) | _SUBMODULES)

```

### Core Architecture Module: `pageindex/_version.py`
```
"""Installed-package version, shared by every surface that reports it upstream."""
from __future__ import annotations


def sdk_version() -> str:
    try:
        from importlib.metadata import version
        return version("pageindex")
    except Exception:
        return "0.0.0"

```

### Core Architecture Module: `pageindex/agent_tools.py`
```
"""Agent tools: the cloud MCP tool contract, executed against a PageIndexClient.

Tool names and the surviving input-schema structure match the PageIndex
cloud MCP server — the local surface hides the documented cloud-only
parameters — so agent prompts port across the cloud MCP connection and
this in-process layer. Only the tools that exist in every mode are
registered (no folders, search_documents, or get_document_image), and the
guidance strings (tool descriptions) adapt to the local surface the same
way the agent instructions do — they never teach capabilities that only
exist on the cloud.

Tools never raise: every outcome, including errors, is returned as the
same JSON envelope the cloud emits ({"success": true, ...} /
{"error": ...}) — arguments outside a pruned local signature come back as
that envelope too, on the direct and the call_tool path alike, except
browse_documents' ``recursive``: call_tool honors it, because the flat
no-folders shape it asks for is trivially true here. The exceptions to
never-raise, all cloud: a 401/403, a 429/5xx that outlived the bridge's
retries, an unreachable server and a RATE_LIMITED / USAGE_LIMIT_REACHED
tool error re-raise PageIndexAPIError.
"""
from __future__ import annotations

import copy
import difflib
import inspect
import json
import re
import threading
import time
import weakref
from typing import Any, Callable, Optional

import requests

from .errors import PageIndexAPIError
from .mcp_bridge import render_prompt_text, render_text

TOOL_RESPONSE_CHAR_LIMIT = 100_000
STRUCTURE_FIRST_PAGE_THRESHOLD = 20

_CHAR_BUDGET = int(TOOL_RESPONSE_CHAR_LIMIT * 0.95)
_MAX_REQUESTED_PAGES = 10_000
_SIMILAR_NAMES_LIMIT = 3
_TOOL_WAIT_TIMEOUT = 180.0  # "up to 3 minutes", per the wait_for_completion schema
_TOOL_WAIT_INTERVAL = 5.0

_DOC_NAME_DESCRIPTION = (
    'Copy the `name` field verbatim from a browse_documents() or '
    'search_documents() response (case-sensitive, include extension). '
    'Example: "Q3 Report.pdf". If the response shows two documents with the '
    'same name, pass `folder_id` alongside to disambiguate.'
)
_FOLDER_ID_DISAMBIGUATOR_DESCRIPTION = (
    'Disambiguator for same-name documents. Copy the `folder_id` from the '
    'intended browse/search result; use "root" for root-level documents, or '
    '"shared-with-me"/"following" for the read-only folders at the library '
    'root; omit if `doc_name` is unique. Copy any folder_id verbatim from a '
    'browse_documents()/get_folder_structure() response, never construct one.'
)
_WAIT_FOR_COMPLETION_DESCRIPTION = (
    "If true and document is processing, automatically wait up to 3 minutes "
    "until completed. Reduces repeated tool calls."
)

#: Tool names, descriptions, and parameter schemas, identical to the cloud
#: MCP server's tools/list.
TOOL_CONTRACT: dict[str, dict[str, Any]] = {
    "browse_documents": {
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
        "description": (
            "Primary document retrieval tool. After orienting with "
            "get_folder_structure() (when available), use this for all "
            "document-related questions. The bare call returns root-level "
            "sub-folders and documents; pass folder_id to drill into a "
            'sub-folder level by level. Use sort="relevance" + query for '
            "semantic ranking. Do NOT jump to search_documents() first — it "
            "is an escalation path, only after "
            'browse_documents(sort="relevance") has failed.'
        ),
        "schema": {
            "type": "object",
            "properties": {
                "folder_id": {
                    "type": "string",
                    "default": "root",
                    "description": (
                        'Folder scope (default "root"). Pass a specific folder '
                        'ID to scope into that folder, or "root" to reference '
                        "the library root. The read-only \"shared-with-me\" and "
                        '"following" folders live at the library root — pass '
                        "one of those ids to browse them. Copy any folder_id "
                        "verbatim from a browse/tree response, never construct "
                        "one. Combine with `recursive` to control breadth."
                    ),
                },
                "recursive": {
                    "type": "boolean",
                    "default": False,
                    "description": (
                        "Whether to include documents from descendant folders. "
                        "When false (default), returns the direct contents of "
                        "folder_id along with its sub-folders — prefer this for "
                        "level-by-level exploration so you retain folder "
                        "hierarchy context. When true, flattens all descendant "
                        "documents into one list and omits sub-folders — use "
                        "only when a non-recursive browse of the target folder "
                        "returned no relevant results and you need to widen the "
                        "scope, or the user explicitly requests a flat listing."
                    ),
                },
                "sort": {
                    "type": "string",
                    "enum": ["time", "relevance"],
                    "default": "time",
                    "description": (
                        'Sort order. "time" (default) sorts by upload date '
                        '(newest first); "relevance" orders documents by '
                        "semantic relevance to `query`. Relevance also works "
                        "inside the read-only shared folders — pass their "
                        "folder_id — but at the library root it ranks only "
                        "your own documents."
                    ),
                },
                "query": {
                    "type": "string",
                    "description": (
                        "Search query for relevance ranking. "
                        'Required when sort="relevance".'
                    ),
                },
                "offset": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991,
                    "default": 0,
                    "description": (
                        "Zero-based pagination offset. Pass the value of "
                        "`next_offset` from the previous response to fetch the "
                        "next page."
                    ),
                },
                "limit": {
                    "type": "number",
                    "minimum": 1,
                    "maximum": 50,
                    "default": 10,
                    "description": (
                        "Number of documents to return per page (1-50, "
                        "default 10)"
                    ),
                },
            },
            "required": [],
        },
    },
    "get_document": {
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
        "description": (
            "Check a document's processing status and metadata. `status` is "
            'one of "pending", "queued", "processing", "completed", or '
            '"failed" — call this before `get_document_structure()` or '
            "`get_page_content()` to confirm the document is ready."
        ),
        "schema": {
            "type": "object",
            "properties": {
                "doc_name": {
                    "type": "string",
                    "minLength": 1,
                    "description": _DOC_NAME_DESCRIPTION,
                },
                "folder_id": {
                    "anyOf": [{"type": "string"}, {"type": "null"}],
                    "description": _FOLDER_ID_DISAMBIGUATOR_DESCRIPTION,
                },
                "wait_for_completion": {
                    "type": "boolean",
                    "default": False,
                    "description": _WAIT_FOR_COMPLETION_DESCRIPTION,
                },
            },
            "required": ["doc_name"],
        },
    },
    "get_document_structure": {
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
        "description": (
            "Extract a document's hierarchical outline (headers, sections, "
            f"page references). REQUIRED for documents over "
            f"{STRUCTURE_FIRST_PAGE_THRESHOLD} pages — call this first to "
            "locate relevant sections, then pass their page numbers to "
            "`get_page_content()`. Use the `part` parameter to iterate large "
            "outlines until `pagination.has_more` is false."
        ),
        "schema": {
            "type": "object",
            "properties": {
                "doc_name": {
                    "type": "string",
                    "minLength": 1,
                    "description": _DOC_NAME_DESCRIPTION,
                },
                "folder_id": {
                    "anyOf": [{"type": "string"}, {"type": "null"}],
                    "description": _FOLDER_ID_DISAMBIGUATOR_DESCRIPTION,
                },
                "part": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 9007199254740991,
                    "default": 1,
                    "description": (
                        "Part number for pagination (1-based, default 1). For "
                        "large outlines, increment until the response's "
                        "`pagination.has_more` becomes false."
                    ),
                },
                "wait_for_completion": {
                    "type": "boolean",
                    "default": False,
                    "description": _WAIT_FOR_COMPLETION_DESCRIPTION,
                },
            },
            "required": ["doc_name"],
        },
    },
   
```

### Core Architecture Module: `pageindex/chat_stream.py`
```
"""chat(stream=True)'s return type: one run, one view — text or events."""
from __future__ import annotations

from typing import Any, Iterator, Optional

from .errors import PageIndexAPIError


class ChatStream:
    """chat(stream=True)'s stream: iterate it for the answer text pieces
    (with show_process, the woven display); read ``.events`` instead for
    the typed process event dicts. One underlying run — consume exactly
    one view; call chat() again for the other."""

    def __init__(self, text, events):
        self._text = text      # () -> Iterator[str]
        self._events = events  # () -> Iterator[dict], or the refusal text
        self._view: Optional[str] = None
        self._it: Any = None
        self._closed = False

    def _claim(self, view: str) -> None:
        if self._view is not None and self._view != view:
            raise PageIndexAPIError(
                f"This chat stream is being consumed as {self._view}; one "
                "run serves one view — call chat() again for the other.")
        self._view = view

    def __iter__(self) -> "ChatStream":
        return self

    def __next__(self) -> str:
        self._claim("text")
        if self._it is None:
            if self._closed:
                raise StopIteration
            self._it = self._text()
        return next(self._it)

    @property
    def events(self) -> Iterator[dict]:
        """The run as typed event dicts: {"type": "thinking"|"answer",
        "delta": ...}, {"type": "tool_call", "call_id", "name",
        "arguments"}, {"type": "tool_result", "call_id", "name",
        "output"} — the result as the framework recorded it (a string,
        or its structured text/image items), never clipped. Consuming —
        not merely reading the attribute — claims the view, so debugger
        panes and getattr probing stay side-effect free."""
        def consume():
            if isinstance(self._events, str):
                raise PageIndexAPIError(self._events)
            self._claim("events")
            if self._it is None:
                if self._closed:
                    return
                self._it = self._events()
            # no `yield from`: a dropped handle must not close the run
            for ev in self._it:
                yield ev
        return consume()

    def close(self) -> None:
        """Stop the run: closes the open view, and the stream is dead
        afterwards, like a closed generator (own-model chat: a run never
        consumed never starts)."""
        self._closed = True
        close = getattr(self._it, "close", None)
        if close is not None:
            close()

```

### Core Architecture Module: `pageindex/client.py`
```
"""PageIndex SDK client: the 0.2.x cloud surface, now with a local mode."""
from __future__ import annotations

import os
import re
import threading
import time
import warnings
from typing import (TYPE_CHECKING, Any, Callable, Iterator, Literal, Mapping,
                    Optional, Union, cast, overload)

from .chat_stream import ChatStream
from .errors import PageIndexAPIError


_litellm_preload_started = False


def _preload_litellm() -> None:
    """Start litellm's multi-second import in the background, once per
    process — a per-client thread would churn under per-request clients."""
    global _litellm_preload_started
    if _litellm_preload_started:
        return
    _litellm_preload_started = True

    def _import() -> None:
        try:
            import litellm  # noqa: F401
        except Exception:
            pass

    threading.Thread(target=_import, daemon=True).start()


def _parse_pages(pages: str) -> list[int]:
    from .agent_tools import _PageSpecError, _expand_pages
    if isinstance(pages, str):
        # 0.2.10 tolerated whitespace on this surface; the tool layer stays
        # on the strict contract pattern.
        pages = re.sub(r"\s*([,-])\s*", r"\1", pages.strip())
    try:
        return _expand_pages(pages)
    except _PageSpecError as exc:
        raise PageIndexAPIError(str(exc)) from exc


# The two citation tag formats PageIndex chat writes and renders.
_OLD_CITATION_RE = re.compile(
    r"<doc=([^;<>]+);page=(\d+)(?:;block(?:_id)?=([^;<>]+))?>")
_CITE_TAG_RE = re.compile(r"<cite\s([^<>]*)>(?:(?P<inner>[^<>]*)</cite>)?")
_CITE_ATTR_RE = re.compile(r"""\b(\w+)=(["'])(.*?)\2""", re.S)


def _citation_key(m: re.Match) -> Optional[tuple[str, int, Optional[str]]]:
    """(document, page, block_id) of one matched tag, or None when it names
    no document or no positive page."""
    if m.re is _OLD_CITATION_RE:
        doc, page_str, block_id = m.group(1), m.group(2), m.group(3)
    else:
        attrs = {name: value for name, _, value in
                 _CITE_ATTR_RE.findall(m.group(1))}
        doc, page_str, block_id = (attrs.get("doc", ""), attrs.get("page", ""),
                                   attrs.get("block"))
    doc = doc.strip()
    block_id = (block_id or "").strip() or None
    try:
        page = int(page_str.split("-")[0])
    except ValueError:
        return None
    return (doc, page, block_id) if doc and page > 0 else None


def _parse_citations(text: str) -> list[dict[str, Any]]:
    """``<doc=…;page=…;block=…>`` tags (the managed chat's format), then
    ``<cite doc= page= block=/>`` tags; deduplicated, ``block_id`` only
    when the tag carries one."""
    found: list[dict[str, Any]] = []
    seen: set[tuple[str, int, Optional[str]]] = set()
    for m in [*_OLD_CITATION_RE.finditer(text), *_CITE_TAG_RE.finditer(text)]:
        key = _citation_key(m)
        if key and key not in seen:
            seen.add(key)
            entry: dict[str, Any] = {"document": key[0], "page": key[1]}
            if key[2]:
                entry["block_id"] = key[2]
            found.append(entry)
    return found


def _agents_sdk_model_name(model: str) -> str:
    """Preserve supported Agents SDK prefixes and route other provider paths via LiteLLM."""
    passthrough_prefixes = ("litellm/", "openai/")
    if not model or "/" not in model:
        return model
    if model.startswith(passthrough_prefixes):
        return model
    return f"litellm/{model}"


# The Anthropic-stack routes this SDK wires a transport for, each with
# its Claude Code env switch; a row is an inventory fact, not a model
# judgment. Growth rule: a row per route LiteLLM names and the anthropic
# SDK ships a client for (Mantle clears both bars, no one has asked;
# Claude-on-AWS/GoogleCloud wait on LiteLLM prefix names).
_ROUTE_ENV = {"bedrock": "CLAUDE_CODE_USE_BEDROCK",
              "vertex_ai": "CLAUDE_CODE_USE_VERTEX",
              "azure_ai": "CLAUDE_CODE_USE_FOUNDRY"}
_CLAUDE_ROUTES = tuple(_ROUTE_ENV)


def _claude_wire(model, surface: str) -> "tuple[str, str]":
    """(wire id, route) for an Anthropic-native surface. The name is sent
    as written — the destination judges the id; only the routing prefix
    is read: ``litellm/`` drops, ``bedrock/`` / ``vertex_ai/`` /
    ``azure_ai/`` select that transport, and ``anthropic/`` is the
    direct route's own prefix.
    Anything else — bare ids, aliases, gateway names — ships verbatim on
    the direct route. A prefix with nothing after it names a route and
    no model: refused, so no surface ships model='' or switches a
    transport with no model chosen."""
    if not isinstance(model, str):
        raise PageIndexAPIError(
            f"{surface} model must be a str, got {type(model).__name__}.")
    wire = model.removeprefix("litellm/")
    for route in _CLAUDE_ROUTES:
        if wire.startswith(route + "/"):
            wire = wire[len(route) + 1:]
            break
    else:
        wire, route = wire.removeprefix("anthropic/"), "anthropic"
    if not wire:
        raise PageIndexAPIError(
            f"{surface} model {model!r} names a route but no model id.")
    return wire, route


def _yaml_names_chat(loader) -> bool:
    # config.yaml is a third way to name a chat model. Blank values mean
    # "absent", exactly like the flat arguments (_resolve_models agrees).
    return any(loader._default_dict.get(key)
               for key in ("chat_model", "retrieve_model", "model"))


def _needs_model(surface: str) -> PageIndexAPIError:
    # The stock chat_model default is not the user's choice: never send
    # it on an Anthropic-native surface as if it were one.
    return PageIndexAPIError(
        f"{surface} needs a model — pass a Claude model=..., or "
        "configure chat_model on the client.")


_LOCAL_INDEX_KEYS = ("model", "summary_model", "backend", "storage_path",
                     "summary_max_words", "summary_concurrency",
                     "use_embedded_toc", "optimize")

# Near-synonyms of "cloud" that would otherwise parse as model names —
# a silent wrong mode. They error, pointing at the real word.
_RESERVED_MODE_WORDS = {"hosted", "managed"}


def _env_cloud_key(spelling: str, inline: str = "api_key=...") -> str:
    # .env support lives in utils' import-time load_dotenv(): load it
    # before the read, or a key in .env is visible only by import order.
    from . import utils  # noqa: F401
    key = os.environ.get("PAGEINDEX_API_KEY")
    if not key:
        raise PageIndexAPIError(
            f"{spelling} reads the PageIndex API key from the "
            "PAGEINDEX_API_KEY environment variable, which is not set — "
            f"export it, or pass the key inline ({inline}).")
    return key


# One argument vocabulary regardless of spelling: these values are shape-
# checked in the constructor, so a wrong type or an empty value refuses
# there as a PageIndexAPIError — never later, never silently.
_ARG_TYPES: "dict[str, tuple[type, ...]]" = {
    "model": (str,), "index_model": (str,), "summary_model": (str,),
    "chat_model": (str,), "retrieve_model": (str,), "summary_max_words": (int,),
    "summary_concurrency": (int,), "use_embedded_toc": (bool,), "optimize": (str,),
    "storage_path": (str, os.PathLike), "index_backend": (dict,),
    "chat_backend": (dict,)}


def _declared_mode(value, side: str):
    if isinstance(value, str):
        value = value.strip().lower()
    if value not in (None, "cloud", "local"):
        raise PageIndexAPIError(
            f'{side} "mode" must be "cloud" or "local", not {value!r}.')
    return value


_CloudKey = Union[str, Callable[[], str], None]


def _resolve_index_slot(index) -> "tuple[_CloudKey, dict[str, Any]]":
    """The ``index=`` slot as (cloud api_key, local overrides). A dict
    declares its side by its keys; an optional "mode" states it and must
    agree. Keyless cloud spellings ("cloud" / "pageindex-cloud",
    {"mode": "cloud"}) return the environment read as a thunk, so the
    caller's mode cross-check runs before the environment is touched."""
    from .types import PAGEINDEX_CLOUD
    if isinstance(index, str):
        # Normalized compare: a case/whitespace variant of a mode word
        # must never fall through and silently become a model name.
        word = index.strip().lower()
        if word in (PAGEINDEX_CLOUD, "cloud"):
            return lambda: _env_cloud_key(f'index="{index.strip()}"',
                                          'index={"api_key": ...}'), {}
        if word == "local":
            return None, {}
        if word in _RESERVED_MODE_WORDS:
            raise PageIndexAPIError(
                f'index="{index}" is not a mode word — the cloud spelling '
                'is index="cloud" (key from PAGEINDEX_API_KEY) or '
                'index={"api_key": ...}.')
        if index.strip():
            return None, {"index_model": index}
        raise PageIndexAPIError(
            "index is an empty string — pass a local index model name, "
            'or "cloud".')
    if isinstance(index, Mapping):
        # None-valued keys mean "absent", exactly like the flat arguments.
        conf: dict[str, Any] = {name: value for name, value in index.items()
                                if value is not None}
        declared = _declared_mode(conf.pop("mode", None), "index")
        if not conf:
            if declared == "cloud":
                return lambda: _env_cloud_key('index={"mode": "cloud"}',
                                              'index={"api_key": ...}'), {}
            if declared == "local":
                return None, {}
            raise PageIndexAPIError(
                "index is an empty dict — its keys pick the side: "
                '{"api_key": ...} for cloud documents, or '
                f"{', '.join(_LOCAL_INDEX_KEYS)} for the local store.")
        unknown = set(conf) - {"api_key"} - set(_LOCAL_INDEX_KEYS)
        if unknown:
            raise PageIndexAPIError(
                f"Unknown index 
```

### Core Architecture Module: `pageindex/cloud_api.py`
```
"""Cloud mode of the PageIndex SDK, based on the 0.2.8 client."""
import requests
from pathlib import Path
from typing import Optional, Dict, Any, List, Union, Iterator
import json
import urllib.parse

from .errors import PageIndexAPIError
from .naming import sanitize_filename, validate_folder_name


def _enc(value: str) -> str:
    """URL-encode a path segment (ids may contain / ? # or spaces)."""
    return urllib.parse.quote(str(value), safe="")


class CloudAPI:
    """
    Python SDK client for the PageIndex API.
    """

    def __init__(self, client):
        self._client = client

    @property
    def BASE_URL(self) -> str:
        return self._client.BASE_URL

    @property
    def api_key(self) -> str:
        return self._client.api_key

    def _headers(self) -> Dict[str, str]:
        return {"api_key": self.api_key}

    # ---------- DOCUMENT SUBMISSION ----------

    def submit_document(
        self,
        file_path: str,
        mode: Optional[str] = None,
        beta_headers: Optional[List[str]] = None,
        folder_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Upload a PDF document for processing. The system will automatically process both tree generation and OCR.
        Immediately returns a document identifier (`doc_id`) for subsequent operations.

        Args:
            file_path (str): Path to the PDF file.
            mode (str, optional): Processing mode (e.g., "mcp"). Defaults to None.
            beta_headers (List[str], optional): Beta feature headers (e.g., ["block_reference"]
                to enable block-level content with bounding boxes). Defaults to None.
            folder_id (str, optional): Folder (workspace) ID to assign the document to. Defaults to None.
            metadata (dict, optional): Your own JSON-serializable tags for the document;
                returned in get_tree/get_ocr responses and list_documents entries. Defaults to None.

        Returns:
            dict: {'doc_id': ...} — plus 'name', the stored document name
                (a taken name gains a numeric suffix), when the server
                returns it.
        """
        data: Dict[str, Any] = {'if_retrieval': True}
        if mode is not None:
            data['mode'] = mode
        if beta_headers is not None:
            data['beta_headers'] = json.dumps(beta_headers)
        if folder_id is not None:
            data['folder_id'] = folder_id
        if metadata is not None:
            data['metadata'] = json.dumps(metadata)

        with open(file_path, "rb") as f:
            response = requests.post(
                f"{self.BASE_URL}/doc/",
                headers=self._headers(),
                files={'file': (sanitize_filename(Path(file_path).name), f)},
                data=data
            )

        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to submit document: {response.text}",
                status_code=response.status_code)
        return response.json()

    # ---------- OCR FUNCTIONALITY ----------

    def get_ocr(self, doc_id: str, format: str = "page") -> Dict[str, Any]:
        """
        Get OCR processing status and results.

        Args:
            doc_id (str): Document ID.
            format (str): Result format. Use 'page' for page-based results, 'node' for node-based results, or 'raw' for concatenated markdown. Defaults to 'page'.

        Returns:
            dict: API response with status and, if ready, OCR results.
        """
        if format not in ["page", "node", "raw"]:
            raise ValueError("Format parameter must be 'page', 'node', or 'raw'")

        response = requests.get(
            f"{self.BASE_URL}/doc/{_enc(doc_id)}/?type=ocr&format={format}",
            headers=self._headers(),
            timeout=30
        )
        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to get OCR result: {response.text}",
                status_code=response.status_code)
        return response.json()

    def get_block(self, doc_id: str, block_id: str) -> Dict[str, Any]:
        """
        Get one layout block of a document by the block_id its page content
        and block-level citations carry.

        Args:
            doc_id (str): Document ID.
            block_id (str): Block ID, e.g. "p3_text_5".

        Returns:
            dict: The block as the API returns it: {'doc_id', 'page',
                'block_id', 'bbox', 'block_type', ...}. bbox is
                [x0, y0, x1, y1] in thousandths of the page's width and
                height (0-1000), origin top-left. A 404 means the
                document has no such block.
        """
        response = requests.get(
            f"{self.BASE_URL}/doc/{_enc(doc_id)}/block/{_enc(block_id)}/",
            headers=self._headers(),
            timeout=30
        )
        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to get block: {response.text}",
                status_code=response.status_code)
        return response.json()

    def get_page_image(self, doc_id: str, page: int) -> str:
        """Presigned URL for a rendered page image.

        Args:
            doc_id (str): Document ID.
            page (int): 1-based page number.

        Returns:
            str: A presigned URL to the page image (JPEG).
        """
        response = requests.get(
            f"{self.BASE_URL}/doc/s3/{_enc(doc_id)}/images",
            headers=self._headers(),
            params={"start": page, "end": page},
            timeout=30
        )
        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to get page image: {response.text}",
                status_code=response.status_code)
        for img in response.json().get("images") or []:
            if img.get("page") == page and img.get("url"):
                return img["url"]
        raise PageIndexAPIError(f"No image URL returned for page {page}.")

    def get_document_image(self, doc_id: str, img_id: str) -> str:
        """Presigned URL for an embedded image extracted during OCR.

        Args:
            doc_id (str): Document ID.
            img_id (str): Image ID as page content carries it,
                e.g. ``"img-7.jpeg"``.

        Returns:
            str: A presigned URL to the image.
        """
        response = requests.get(
            f"{self.BASE_URL}/doc/{_enc(doc_id)}/image/{_enc(img_id)}/",
            headers=self._headers(),
            timeout=30
        )
        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to get document image: {response.text}",
                status_code=response.status_code)
        url = response.json().get("url")
        if not url:
            raise PageIndexAPIError(f"No image URL returned for {img_id!r}.")
        return url

    # ---------- TREE GENERATION ----------

    def get_tree(self, doc_id: str, node_summary: bool = False,
                 include_text: bool = True) -> Dict[str, Any]:
        """
        Get tree generation status and results.

        Args:
            doc_id (str): Document ID.
            node_summary (bool): Include node summaries (default False).

        Returns:
            dict: API response with status and, if ready, tree structure.
        """
        response = requests.get(
            f"{self.BASE_URL}/doc/{_enc(doc_id)}/?type=tree&summary={node_summary}"
            f"&include_text={str(include_text).lower()}",
            headers=self._headers(),
            timeout=30
        )
        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to get tree result: {response.text}",
                status_code=response.status_code)
        return response.json()

    # ---------- RETRIEVAL ----------

    def submit_query(self, doc_id: str, query: str, thinking: bool = False) -> Dict[str, Any]:
        """
        Submit a retrieval query for a specific PageIndex document.

        Args:
            doc_id (str): Document ID.
            query (str): User question or information need.
            thinking (bool, optional): If true, enables deeper retrieval. Default is False.

        Returns:
            dict: {'retrieval_id': ...}
        """
        payload = {
            "doc_id": doc_id,
            "query": query,
            "thinking": thinking
        }
        response = requests.post(
            f"{self.BASE_URL}/retrieval/",
            headers=self._headers(),
            json=payload,
            timeout=30
        )
        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to submit retrieval: {response.text}",
                status_code=response.status_code)
        return response.json()

    def get_retrieval(self, retrieval_id: str) -> Dict[str, Any]:
        """
        Get retrieval status and results.

        Args:
            retrieval_id (str): Retrieval ID.

        Returns:
            dict: Retrieval status and results.
        """
        response = requests.get(
            f"{self.BASE_URL}/retrieval/{_enc(retrieval_id)}/",
            headers=self._headers(),
            timeout=30
        )
        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to get retrieval result: {response.text}",
                status_code=response.status_code)
        return response.json()

    # ---------- CHAT COMPLETIONS ----------

    def chat_completions(
        self,
        messages: List[Dict[str, str]],
        stream: bool = False,
        doc_id: Optional[Union[str, List[str]]] = None,
        temperature: Optional[float] = None,
        stream_metadata: bool = False,
        enable_citations: bool = False,
        extra_body: Optional[Dict[str, Any]] = None,
        folder_id: Optional[str] 
```

### Core Architecture Module: `pageindex/errors.py`
```
class PageIndexAPIError(Exception):
    """status_code carries the HTTP status when the raising site passes it;
    None does not imply local/client-side."""

    def __init__(self, *args: object, status_code: int | None = None) -> None:
        super().__init__(*args)
        self.status_code = status_code


def _pageindex_cause(exc: BaseException | None) -> PageIndexAPIError | None:
    """The PageIndexAPIError behind a framework's wrapper exception, if any."""
    while exc is not None:
        if isinstance(exc, PageIndexAPIError):
            return exc
        exc = exc.__cause__
    return None

```

### Core Architecture Module: `pageindex/flash/__init__.py`
```
"""PageIndex Flash: LLM-free tree structure extraction from PDF layout statistics."""

from .api import page_index_flash

__all__ = ["page_index_flash"]

```

### Core Architecture Module: `pageindex/flash/api.py`
```
"""Public API for PageIndex Flash: :func:`page_index_flash` builds the tree, :func:`flash_rejection_reason` is the refusal policy the local client and CLI share. Everything else in this package is internal pipeline machinery."""

from __future__ import annotations

import numbers
from io import BytesIO
from pathlib import Path
from typing import BinaryIO

import pypdfium2 as pdfium

from ..naming import sanitize_filename
from .main import extract_toc

# Largest page-node fallback the managed pipelines accept as an index.
FLAT_TREE_MAX_NODES = 10


def _is_pdfium_password_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "password" in msg or "security" in msg or "encrypted" in msg


def _validate_path(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")
    if not path.is_file():
        raise ValueError(f"PDF path is not a file: {path}")
    if not sanitize_filename(path.name).lower().endswith(".pdf"):
        raise ValueError(f"PDF file must have a .pdf extension: {path}")
    with path.open("rb") as score_value:
        if score_value.read(5) != b"%PDF-":
            raise ValueError(f"File does not look like a PDF: {path}")
    return str(path)


def _validate_stream(stream: BinaryIO) -> BinaryIO:
    try:
        pos = stream.tell()
        head = stream.read(5)
        stream.seek(pos)
    except Exception as exc:  # noqa: BLE001 - normalize stream capability errors
        raise TypeError("PDF stream must be seekable and readable") from exc
    if head != b"%PDF-":
        raise ValueError("Input stream does not look like a PDF")
    return stream


def _validate_pdf(pdf):
    if isinstance(pdf, (str, Path)):
        handle = _validate_path(Path(pdf))
        restore = None
    elif isinstance(pdf, BytesIO):
        handle = _validate_stream(pdf)
        restore = pdf.tell()
    else:
        raise TypeError("page_index_flash(pdf) expects a PDF path or io.BytesIO stream")

    doc = None
    try:
        doc = pdfium.PdfDocument(handle)
        if len(doc) == 0:
            raise ValueError("PDF contains no pages")
    except pdfium.PdfiumError as exc:
        if _is_pdfium_password_error(exc):
            raise ValueError("PDF is encrypted or password-protected") from exc
        raise ValueError(f"Could not open PDF: {exc}") from exc
    finally:
        if doc is not None:
            doc.close()
        if restore is not None:
            pdf.seek(restore)
    return pdf


async def _summarize(structure, page_list, model, concurrency=None, max_words=None):
    from ..utils import summarize_tree
    await summarize_tree(structure, page_list, model=model, concurrency=concurrency,
                         max_words=max_words)


async def _optimize_async(structure, page_texts, do_expand, model, on_final=None,
                          concurrency=None):
    """Merge/expand refinement after extraction, overlapped with the summaries
    when `on_final` is passed; without it the caller runs them after.

    Beyond the merge the default path runs anyway, this adds LLM expand and
    reports before/after search-cost metrics. Expand reads the same page text
    the summaries use.
    """
    from ..tree_optimize import optimize
    lines = _page_lines(page_texts)
    outcome = await optimize(structure, page_texts, lines, model=model,
                             do_expand=do_expand, page_count=len(page_texts),
                             on_final=on_final, concurrency=concurrency)
    return {"merges": outcome["merges"], "expands": outcome["expands"],
            "same_page_merges": outcome["same_page_merges"],
            "same_page_dropped": outcome["same_page_dropped"],
            "kept_collapsed": outcome["kept_collapsed"],
            "before": outcome["before"], "after": outcome["after"]}


def _optimize(structure, page_texts, do_expand, model, concurrency=None):
    import asyncio
    return asyncio.run(_optimize_async(structure, page_texts, do_expand, model,
                                       concurrency=concurrency))


async def _optimize_and_summarize(structure, page_texts, optimize_model, summary_model,
                                  concurrency, max_words=None):
    """Expand and summarize on one loop: a node is summarized as soon as
    expand can no longer change it, a parent once its children are done."""
    from ..utils import SummaryScheduler
    scheduler = SummaryScheduler(structure, [(text, 0) for text in page_texts],
                                 model=summary_model, concurrency=concurrency,
                                 max_words=max_words)
    report = await _optimize_async(structure, page_texts, True, optimize_model,
                                   on_final=scheduler.mark_final,
                                   concurrency=concurrency)
    await scheduler.finish()
    return report


def _page_nodes(page_texts: list[str]) -> list[dict]:
    """One node per page, so every page is reachable."""
    from ..utils import write_node_id
    if not any(text.strip() for text in page_texts):
        return []
    nodes = [{"title": f"Page {index}", "node_id": "", "start_index": index,
              "end_index": index} for index in range(1, len(page_texts) + 1)]
    write_node_id(nodes)
    return nodes


def _page_lines(page_texts: list[str]) -> list[list[str]]:
    return [[line_text.strip() for line_text in (page_text or "").splitlines()
             if line_text.strip()]
            for page_text in page_texts]


def _add_intros(structure: list[dict], lines: list[list[str]]) -> None:
    """The pages a parent opens with before its first child become its intro node."""
    from ..tree_optimize import add_intro_nodes
    from ..utils import write_node_id
    add_intro_nodes(structure, lines)
    write_node_id(structure)


def _add_preface(structure: list[dict], lines: list[list[str]]) -> None:
    """The pages before a hierarchy that starts late become a Preface node, as in
    standard mode. It runs onto the first section's page unless that heading opens it."""
    from ..tree_optimize import heading_at_page_start
    first = structure[0]
    opens = first["start_index"] <= len(lines) and heading_at_page_start(
        lines, first["start_index"], first["title"])
    structure.insert(0, {"title": "Preface", "start_index": 1,
                         "end_index": first["start_index"] - (1 if opens else 0)})


def flash_rejection_reason(result: dict, standard_hint: str = "mode='standard'") -> str | None:
    """Why a managed pipeline should refuse this flash result, or None to accept it.

    The local client and the CLI share this policy so they refuse the same
    documents; ``standard_hint`` is how each spells the standard-mode switch.
    """
    structure = result.get("structure") or []
    if result.get("toc_source") == "unreadable":
        return ("PageIndex Flash found no text layer in this PDF (scanned or "
                "image-only); run OCR before indexing it.")
    if result.get("toc_source") == "pages" and len(structure) > FLAT_TREE_MAX_NODES:
        return (f"PageIndex Flash found no layout structure in this document "
                f"({len(structure)} pages); try {standard_hint}, which builds "
                "the structure with the model.")
    if not structure:
        return ("PageIndex Flash could not extract a structure from this PDF; "
                f"try {standard_hint}, which builds the structure with the model.")
    return None


def page_index_flash(pdf, summary=True, summary_model=None,
                     optimize: str | bool | None = None, optimize_expand=None,
                     optimize_model=None, summary_concurrency=None,
                     use_embedded_toc=True, summary_max_words=None) -> dict:
    """Build a PageIndex tree structure from a PDF using layout statistics. The tree extraction itself uses no LLM; by default an LLM writes node summaries and expands the tree (``summary=False, optimize=False`` runs fully LLM-free). Args: pdf: path to a PDF file (``str`` or ``pathlib.Path``) or an in-memory binary stream (``io.BytesIO``). summary: if True, generate LLM summaries for each node (requires ``summary_model``). summary_model: the LLM model identifier to use for summary generation. optimize: ``"full"`` for merge + LLM expand (a model unreachable after the retry ladder — a missing credential included — fails the run loudly from expand itself; a per-prompt rejection leaves just that node collapsed), ``"merge"`` for deterministic merge only, ``False`` to disable. ``True`` is accepted as ``"full"`` for backward compatibility; defaults to ``"full"``. Expand needs readable page text, so a bookmark-only or scanned PDF runs the merge half only (``expands`` reports 0). optimize_expand: deprecated — use ``optimize``. Honored only when ``optimize`` is not passed (or is the legacy ``True``): ``False`` maps to ``"merge"``, ``True`` to ``"full"``. optimize_model: the LLM model for expand (defaults to the summary model). summary_concurrency: cap on simultaneous indexing model calls per lane: the summaries, and expand up to its own ceiling of 32 (the lanes overlap, so up to cap + min(32, cap) calls run at once); None uses the library defaults (64 and 32). use_embedded_toc: if True, consume the PDF's embedded bookmarks when trustworthy: deep bookmarks become the frame and the detected sections they lack are grafted back in after noise filtering, coarse ones become the chapter frame with detected nodes re-hung under them (deeper sparse entries are filled in when the page text confirms them, and garbled extracted titles are repaired from the bookmark strings), garbage ones are ignored. On by default; pass False for the pure detected structure. summary_max_words: word cap each model-written node summary is asked to stay within (short leaves keep their raw text); None uses the library default (150). Returns: dict with keys ``doc_name``, ``doc_title``, ``structure`` (a list 
```

### Core Architecture Module: `pageindex/flash/blocks/__init__.py`
```
"""Block clustering. This module walks page lines in reading order, extends nearby compatible
blocks, starts a new block when no neighbor fits, and then splits simple
"heading + body" two-line blocks where the first line is a standalone section
heading. The clustering pass must return blocks, not raw lines. Reading-order assignment
then uses each block's first line to find the column index; doing that on raw
lines would read an unrelated first-span flag.
"""

from typing import Optional

from sortedcontainers import SortedKeyList

import json
from pathlib import Path

from ..model import (
    style_key,
    magnitude_ratio,
    left_aligned,
    right_aligned,
    center_aligned,
    x_centers_close,
    Rect,
    last_span,
    avg_char_width,
    EMPTY_RECT,
    left_edge_key,
    reading_order_key,
    numbering_kind,
    Line,
    case_signal,
    last_line_of,
    first_span_of,
    letter_count,
    dominant_style_of,
    is_upper_dominant,
    Block,
    _max_nan_propagating,
)
from ..stats import DocStats, PageStats
from ..tokens import set_case_fold, TrieConfig, build_trie, tokenize_block

from .join_rules import (
    _DICT_PATH,
    _DICTS,
    SECTION_HEADING_TRIE,
    BlockClusterContext,
    should_join_line_to_block,
)
from .build import (
    split_heading_body_blocks,
    _set_add,
    cluster_lines_into_blocks,
)

__all__ = ["BlockClusterContext", "should_join_line_to_block", "cluster_lines_into_blocks", "split_heading_body_blocks", "SECTION_HEADING_TRIE"]

```

### Core Architecture Module: `pageindex/flash/blocks/join_rules.py`
```
"""Line-to-block joining rules and the section-heading trie."""

from __future__ import annotations

from typing import Optional

import json
from pathlib import Path

from ..model import (
    style_key,
    magnitude_ratio,
    left_aligned,
    right_aligned,
    center_aligned,
    x_centers_close,
    Rect,
    last_span,
    avg_char_width,
    EMPTY_RECT,
    left_edge_key,
    reading_order_key,
    numbering_kind,
    Line,
    case_signal,
    last_line_of,
    first_span_of,
    letter_count,
    dominant_style_of,
    is_upper_dominant,
    Block,
    _max_nan_propagating,
)
from ..stats import DocStats, PageStats
from ..tokens import set_case_fold, TrieConfig, build_trie, tokenize_block


# Combined heading trie used to detect "first line is a section header" patterns
# when splitting two-line blocks.
_DICT_PATH = Path(__file__).parent.parent / "data" / "dictionaries.json"
_DICTS = json.loads(_DICT_PATH.read_text(encoding="utf-8"))
SECTION_HEADING_TRIE = build_trie(
    list(_DICTS.get("section_keywords", []))
    + list(_DICTS.get("abstract_keywords", []))
    + list(_DICTS.get("references", [])),
    set_case_fold(TrieConfig(), True),
)


# --------------------------------------------------------------------------- #
# Block-clustering context bundle #
# --------------------------------------------------------------------------- #


class BlockClusterContext:
    """Block-clustering context. Fields: j document statistics o page bbox g page statistics h lines to cluster v column rectangles """

    __slots__ = ("tertiary_slot", "auxiliary_slot", "primary_slot", "secondary_slot", "state_slot")

    def __init__(self, doc_stats: DocStats, page_bbox: Rect, page_stats: PageStats, lines: list, columns: list):
        self.tertiary_slot = doc_stats
        self.auxiliary_slot = page_bbox
        self.primary_slot = page_stats
        self.secondary_slot = lines
        self.state_slot = columns


# --------------------------------------------------------------------------- #
# Should a line join an existing block? #
# --------------------------------------------------------------------------- #


def should_join_line_to_block(
    block_cluster_ctx: BlockClusterContext,
    other_block: Block,

    candidate_line: Line,

    previous_line: Optional[Line],

    first_candidate_block: Block,

) -> bool:
    """Return True iff the candidate line should be appended to the current block."""
    # -- Step 1: reject incompatible skew ----------
    if abs(other_block.skew_frac() - candidate_line.skew_frac()) > 1:
        return False

    # -- Step 2: size + alignment gates ----------------------------------
    font_size_delta = candidate_line.avg_font_size() - other_block.avg_font_size()

    left_edges_aligned = left_aligned(other_block, candidate_line, 1)

    both_edges_aligned = left_edges_aligned or (other_block.line_count() == 1 and left_aligned(other_block, candidate_line, 8 * avg_char_width(other_block.line())))

    right_edges_aligned = right_aligned(other_block, candidate_line, 2)

    both_edges_aligned = both_edges_aligned and right_edges_aligned
    # m = min size-excess over page body; k = min size-excess over doc body
    page_body_font_delta = min(candidate_line.avg_font_size() - block_cluster_ctx.primary_slot.primary_slot, other_block.avg_font_size() - block_cluster_ctx.primary_slot.primary_slot)

    doc_body_font_delta = min(candidate_line.avg_font_size() - block_cluster_ctx.tertiary_slot.primary_slot, other_block.avg_font_size() - block_cluster_ctx.tertiary_slot.primary_slot)


    block_last_span = last_span(last_line_of(other_block))

    line_first_span = candidate_line.primary_slot[0]


    if (
        abs(font_size_delta) > page_body_font_delta
        and abs(font_size_delta) > doc_body_font_delta - 2
        and not (style_key(block_last_span) == style_key(line_first_span) and block_last_span.char_count() > 1 and line_first_span.char_count() > 1)
        and (
            font_size_delta > 2
            or (font_size_delta > 1 and not both_edges_aligned)
            or font_size_delta < -5
            or (font_size_delta < -2 and candidate_line.char_count() >= 5)
            or (font_size_delta < -1 and candidate_line.char_count() >= 20 and not both_edges_aligned)
        )
    ):
        return False

    # -- Step 3: font / bold mismatch ------------------------------------
    block_last_line = last_line_of(other_block)

    width_ratio = magnitude_ratio(other_block.bbox_width(), candidate_line.bbox_width())

    bold_mismatch = (block_last_span.primary_slot != line_first_span.primary_slot)

    font_mismatch = (
        block_last_span.font_name != line_first_span.font_name
        and dominant_style_of(other_block) != style_key(line_first_span)
    )


    if font_mismatch or bold_mismatch:
        if bold_mismatch and width_ratio > 2:
            return False
        if (block_last_line.char_stats.secondary_slot == 1 or block_last_line.char_stats.secondary_slot == 2) and (
            candidate_line.char_stats.secondary_slot == 2 or width_ratio > 4
        ):
            return False
        if block_last_line.char_stats.tertiary_slot == 6 or other_block.bbox_width() > 1.5 * block_last_line.bbox_width():
            return False

    if other_block.bold_frac() > 0.9 and candidate_line.bold_frac() < 0.8 and width_ratio > 2:
        return False

    # -- Step 4: spatial gates -------------------------------------------
    centers_aligned = center_aligned(other_block, candidate_line, 1)

    if not centers_aligned:
        vertical_gap = other_block.bottom_edge() - candidate_line.top_edge()

        horizontal_offset = candidate_line.left_edge() - other_block.left_edge()

        if (vertical_gap > -1 and horizontal_offset > 0.33 * other_block.bbox_width()) or horizontal_offset > 0.98 * other_block.bbox_width():
            return False
        if candidate_line.center_x() < other_block.left_edge():
            return False

    # -- Step 5: tolerance base ------------------------------------------
    bottom_edge_gap = other_block.bottom_edge() - candidate_line.bottom_edge()

    join_tolerance = (
        _max_nan_propagating(1.3 * (other_block.top_edge() - other_block.bottom_edge()) / other_block.line_count(), block_cluster_ctx.primary_slot.tertiary_slot)
        + 1.3 * other_block.avg_font_size()
    ) / 2.0


    # -- Step 6: case-flip "hanging indent" detector ---------------------
    block_case_signal = case_signal(other_block.char_stats)

    line_case_signal = case_signal(candidate_line.char_stats)

    # Capture the old block-last span before comparing both sides of the case
    # transition.
    case_signal_flip = (
        ((block_case_signal == 1 and line_case_signal == -1) or (line_case_signal == 1 and block_case_signal == -1))
        and letter_count(candidate_line.char_stats) >= 3
        and (is_upper_dominant(other_block.char_stats) != is_upper_dominant(line_first_span.char_stats) or letter_count(line_first_span.char_stats) < 3)
        and (is_upper_dominant(block_last_span.char_stats) != is_upper_dominant(candidate_line.char_stats) or letter_count(block_last_span.char_stats) < 3)
    )


    if (
        not font_mismatch and not bold_mismatch and not case_signal_flip
        and (width_ratio <= 1.2 or left_aligned(block_last_line, candidate_line, 0.1))
        # Preserve the no-guard width-ratio edge case: a zero-width block still
        # allows a positive-width last line to increase the join tolerance.
        and (block_last_line.bbox_width() / other_block.bbox_width() > 0.9 if other_block.bbox_width() != 0 else block_last_line.bbox_width() > 0)
    ):
        join_tolerance *= 1.3
    if page_body_font_delta > 0.5 * block_cluster_ctx.primary_slot.primary_slot and not case_signal_flip:
        join_tolerance *= 2

    # -- Step 7: column alignment ----------------------------------------
    column_rect = (block_cluster_ctx.state_slot[candidate_line.measure_slot] if (0 <= candidate_line.measure_slot < len(block_cluster_ctx.state_slot)) else None) or EMPTY_RECT

    line_left_aligned_to_column = left_aligned(candidate_line, column_rect, 4.5)

    line_right_aligned_to_column = right_aligned(candidate_line, column_rect, 4.5)

    block_left_aligned_to_column = left_aligned(other_block, column_rect, 4.5)

    block_right_aligned_to_column = right_aligned(other_block, column_rect, 4.5)

    block_column_justified = (
        block_left_aligned_to_column == block_right_aligned_to_column
        and other_block.alignment_slot
        and x_centers_close(block_cluster_ctx.auxiliary_slot, other_block)
    )

    line_column_centered = (
        line_left_aligned_to_column == line_right_aligned_to_column
        and (x_centers_close(block_cluster_ctx.auxiliary_slot, candidate_line) or (block_column_justified and centers_aligned))
    )


    # -- Step 8: alignment multipliers -----------------------------------
    if (
        block_column_justified and line_column_centered
        and other_block.bbox_width() > 0.5 * candidate_line.bbox_width()
        and (previous_line is None or candidate_line.bottom_edge() - previous_line.bottom_edge() >= bottom_edge_gap)
        and not font_mismatch
    ):
        join_tolerance *= 1.3
        if previous_line is not None and (
            (other_block.bold_frac() > previous_line.bold_frac() and candidate_line.bold_frac() > previous_line.bold_frac())
            or (other_block.avg_font_size() > previous_line.bbox_height() + 1 and candidate_line.bbox_height() > previous_line.bbox_height() + 1)
        ):
            join_tolerance = max(join_tolerance, candidate_line.bottom_edge() - previous_line.top_edge())
    elif block_right_aligned_to_column and line_left_aligned_to_column:
        join_tolerance *= 1.3 if other_block.line_count() <= 1 else 1.2
    elif block_left_aligned_to_column and line_left_aligned_to_column:
        join_tolerance *= 1.1
    elif block_right_aligned_to_column:
        if other_block.li
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #547** (2026-10-01): **test: summary concurrency test waits for the expected overlap**
  *Symptoms*: `test_summary_concurrency_caps_both_lanes_on_every_path` failed on CI py3.13 (with frameworks) as `(3, 2) == (3, 3)` on three of #542's four commits, and passed on the fourth.  The mock held each call for a fixed 20 ms and expected all three to overlap inside it. On a slow runner the three summaries start further apart than that, so the first one finishes before the third arrives.  Each call still holds 20 ms, so a lane with no cap still lets the others in. It then holds until its lane reaches the expected peak, with a 5 s deadline.  - Starting the summaries 15 ms apart reproduced `(3, 2)` before this change and passes after it. - An ignored cap still fails (`(3, 3) == (1, 1)`), and too little overlap still fails (`(2, 2) == (3, 3)`).  Test-only change. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"5a587c67584d98004dfe4a61f757842280d0386b","mergeGateEnabled":false,"pullRequestNumber":547,"repository":"VectifyAI/PageIndex","status":"completed"} --> ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="2026-10-01T13:49:12.677771Z">2026-10-01T13:49:12.677771Z</relative-time> | `5a587c6` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it h

- **Issue #542** (2026-10-01): **feat(sdk): node navigation helpers get_node, get_node_parent, get_node_path, get_node_map**
  *Symptoms*: Adds four functions for navigating a document tree, in `pageindex.utils` (also reachable as `pageindex.get_node` etc.):  ```python tree = client.get_document_structure(doc_id)  get_node(tree, "0007")         # the node, or None get_node_parent(tree, "0007")  # its parent; None for a top-level or absent node get_node_path(tree, "0007")    # [top-level ancestor, ..., node]; [] if absent get_node_map(tree)             # {node_id: node} ```  - They take the tree, not a `doc_id`: fetch it once and navigate locally, instead of one request per step. - The first three share one depth-first walk, O(n) per call; trees run tens to a few hundred nodes. - They return the tree's own nodes rather than copies (unlike `get_nodes` / `get_leaf_nodes`), so `node["nodes"]` keeps working. - Wrong input raises `TypeError` naming the right one, so it never reads as "not found": the whole `get_tree()` response (pass its `['result']`), a `None` tree, or a non-string id. - `get_node_map` is `create_node_mapping`, plus that input check, under a name in the same family. `create_node_mapping` stays as the 0.2.8 surface. - `create_node_mapping` (so `get_node_map` too) walks past a node whose `nodes` is `None` instead of raising `TypeError`, as `get_node` already did.  Tests: `test_node_navigation` and `test_node_navigation_rejects_wrong_input` in `tests/test_package_surface.py`.  
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"d03ef9814e005196be73e9a1f6f413c8035deaa8","mergeGateEnabled":false,"pullRequestNumber":542,"repository":"VectifyAI/PageIndex","status":"completed"} --> ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="2026-10-01T11:42:38.969508Z">2026-10-01T11:42:38.969508Z</relative-time> | `d03ef98` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it h

- **Issue #541** (2026-10-01): **Unify the document tree across local and cloud**
  *Symptoms*: ## What changes  `get_tree` returns one node shape in local and cloud mode: `{title, node_id, start_index, end_index, summary, text, nodes}`. `page_index` and `prefix_summary` no longer appear. **Breaking** for code that reads them.  The SDK only renames fields on the way out and never restructures a stored tree. A document indexed before this change keeps its own ranges and summaries, so every node's summary still matches its range.  New local indexes (standard and flash) are built in the unified shape: - A parent whose first child starts on a later page gets a first child titled `"<parent title> (intro)"` that holds those pages. A parent with no title gets `"Intro"`. - A parent's range covers its whole subtree. Its summary is written from its children's summaries. - Standard mode now summarizes with `summarize_tree`, as flash does. A parent waits only for its own children, and calls run deepest first under the concurrency cap. Short leaves keep their raw text, and the prompts are flash's. - A node the model leaves unsummarized falls back to its subsection titles or its opening text. A run in which no call is answered still fails. - The standard large-node split acts on leaves only. It no longer replaces a parent's existing subsections.  Page boundaries: when a cut can't tell where a heading sits on a page, the page goes to both sides. - A parent's text runs onto the page its first child starts on. It is empty when the parent's intro holds those pages. The public helpers `ad
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"79d88e8346468995c111b04c0274dd8f6ba956a1","mergeGateEnabled":false,"pullRequestNumber":541,"repository":"VectifyAI/PageIndex","status":"completed"} --> ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="2026-10-01T11:42:43.643638Z">2026-10-01T11:42:43.643638Z</relative-time> | `79d88e8` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it h

- **Issue #539** (2026-09-30): **Restructure repo layout**
  *Symptoms*: - Remove `docs/naming-rules.md`. The naming contract lives in `tests/fixtures/naming-v1.json` and `pageindex/naming.py`; nothing referenced the doc. - Move `examples/documents/results/` to `examples/results/` (pure rename, 8 files), so inputs and outputs sit side by side. Nothing references these files; the root `.gitignore`'s `/results/` does not match the new path.
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"2ce382ea838ba83fa77c0a988230c7219a4b6e72","mergeGateEnabled":false,"pullRequestNumber":539,"repository":"VectifyAI/PageIndex","status":"completed"} --> ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="2026-09-30T08:06:09.408688Z">2026-09-30T08:06:09.408688Z</relative-time> | `2ce382e` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it h

- **Issue #538** (2026-09-29): **ci(publish): gate releases on the live cloud tests again**
  *Symptoms*: Reverts #537. The `PAGEINDEX_API_KEY` secret now points at a CI account under the 1,000 active-page free tier (one folder, so the server serves the folder-aware instructions the parity test expects). main's Tests run on 619cbd8 is green with the live tests running on every leg (803 passed with frameworks, 592 without).  `publish.yml` is byte-identical to its pre-#537 state.
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"e8eaec960c0659d6b46d7bf82dfd1c3d6d21ed3d","mergeGateEnabled":false,"pullRequestNumber":538,"repository":"VectifyAI/PageIndex","status":"completed"} --> ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="2026-09-29T15:46:35.608003Z">2026-09-29T15:46:35.608003Z</relative-time> | `e8eaec9` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it h

- **Issue #537** (2026-09-28): **ci(publish): run the release gate without the live cloud tests**
  *Symptoms*: The CI PageIndex account is over the 1,000 active-page free tier, so all `test_live_*` tests fail with HTTP 403 `subscription_required` on every leg (same on main `037a7db`, rerun today) and block the v0.2.20 publish.  This drops `PAGEINDEX_API_KEY` from publish.yml's test step: the 7 live tests skip (they are `skipif(not PAGEINDEX_API_KEY)`), the offline suite still gates the publish. tests.yml is unchanged, so the live tests still run on push/PR.  Restore the env line once the CI account is back under the gate.
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"1208795efb7661055366ea457f52468949c7a4d4","mergeGateEnabled":false,"pullRequestNumber":537,"repository":"VectifyAI/PageIndex","status":"completed"} --> ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="2026-09-28T13:58:42.715174Z">2026-09-28T13:58:42.715174Z</relative-time> | `1208795` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it h

- **Issue #533** (2026-09-21): **fix(sdk): list_documents review followups**
  *Symptoms*: Addresses PR #522 review findings 2-7.  - Forward `recursive` value instead of hardcoding `True` (string `'false'` was silently inverted) - Raise client-side limit cap from 100 to 10000 (server changed four months ago) - Accept `folder_id='root'`/`''` in local mode (matches agent_tools pattern) - Fix wire test to assert param presence, not identity - Delete restating comments  Review: #522
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"fab250c106639f883bb39042b50b3263d1f85a35","mergeGateEnabled":false,"pullRequestNumber":533,"repository":"VectifyAI/PageIndex","status":"completed"} --> ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="2026-09-21T08:32:22.157462Z">2026-09-21T08:32:22.157462Z</relative-time> | `fab250c` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it h

- **Issue #532** (2026-09-21): **fix(sdk): list_documents review followups**
  *Symptoms*: Addresses PR #522 review findings 2–7.  - Forward `recursive` value instead of hardcoding `True` (string `'false'` was silently inverted) - Raise client-side limit cap from 100 to 10000 (server changed four months ago) - Accept `folder_id='root'`/`''` in local mode (matches agent_tools pattern) - Fix wire test to assert param presence, not identity - Delete restating comments  Review: #522
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"059aea05398c7a1f93a3e5798d513c1b3a1434af","mergeGateEnabled":false,"pullRequestNumber":532,"repository":"VectifyAI/PageIndex","status":"completed"} --> ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="2026-09-21T08:28:21.723157Z">2026-09-21T08:28:21.723157Z</relative-time> | `059aea0` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it h

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

### Incident Patch 1: `8eff7733` (2026-09-24)
**Commit Message**: Anthropic lanes: send the model as written; the prefix picks the route (#443)

- chat(protocol="messages"), anthropic_runner_config() and claude_agent_config() honor chat_model: a model you set carries over; the SDK's stock default is never sent.
- Model names are sent as written; only the routing prefix is read. bedrock/, vertex_ai/ and azure_ai/ select AnthropicBedrock, AnthropicVertex and AnthropicFoundry (and the matching CLAUDE_CODE_USE_* switch for Claude Code); anything else goes to Anthropic directly.
- Bedrock: InvokeModel rejects top-level cache_control for Opus 4.6 and earlier, so the Messages lane moves an explicit breakpoint onto each turn's newest tool result; anthropic_runner_config() omits the key on that route.
- The max_tokens default is 8192, or budget_tokens + 8192 with thinking; no LiteLLM ceiling lookup, no claude-3 list.
- The anthropic extra requires >=0.122.0 (the Bedrock/Vertex tool runner).

**File**: `.github/workflows/tests.yml` (modified, +10/-0)
```diff
@@ -46,3 +46,13 @@ jobs:
       - run: python -m pytest -q
         env:
           PAGEINDEX_API_KEY: ${{ secrets.PAGEINDEX_API_KEY }}
+
+  gate:
+    needs: tests
+    # always(), because GitHub counts a SKIPPED required check as
+    # passing: skipping on cancel would green-light a commit with zero
+    # legs run. A cancelled run must go red here, not vanish.
+    if: ${{ always() }}
+    runs-on: ubuntu-latest
+    steps:
+      - run: test "${{ needs.tests.result }}" = "success"
```

**File**: `pageindex/client.py` (modified, +186/-50)
```diff
@@ -98,6 +98,58 @@ def _agents_sdk_model_name(model: str) -> str:
     return f"litellm/{model}"
 
 
+# The Anthropic-stack routes this SDK wires a transport for, each with
+# its Claude Code env switch; a row is an inventory fact, not a model
+# judgment. Growth rule: a row per route LiteLLM names and the anthropic
+# SDK ships a client for (Mantle clears both bars, no one has asked;
+# Claude-on-AWS/GoogleCloud wait on LiteLLM prefix names).
+_ROUTE_ENV = {"bedrock": "CLAUDE_CODE_USE_BEDROCK",
+              "vertex_ai": "CLAUDE_CODE_USE_VERTEX",
+              "azure_ai": "CLAUDE_CODE_USE_FOUNDRY"}
+_CLAUDE_ROUTES = tuple(_ROUTE_ENV)
+
+
+def _claude_wire(model, surface: str) -> "tuple[str, str]":
+    """(wire id, route) for an Anthropic-native surface. The name is sent
+    as written — the destination judges the id; only the routing prefix
+    is read: ``litellm/`` drops, ``bedrock/`` / ``vertex_ai/`` /
+    ``azure_ai/`` select that transport, and ``anthropic/`` is the
+    direct route's own prefix.
+    Anything else — bare ids, aliases, gateway names — ships verbatim on
+    the direct route. A prefix with nothing after it names a route and
+    no model: refused, so no surface ships model='' or switches a
+    transport with no model chosen."""
+    if not isinstance(model, str):
+        raise PageIndexAPIError(
+            f"{surface} model must be a str, got {type(model).__name__}.")
+    wire = model.removeprefix("litellm/")
+    for route in _CLAUDE_ROUTES:
+        if wire.startswith(route + "/"):
+            wire = wire[len(route) + 1:]
+            break
+    else:
+        wire, route = wire.removeprefix("anthropic/"), "anthropic"
+    if not wire:
+        raise PageIndexAPIError(
+            f"{surface} model {model!r} names a route but no model id.")
+    return wire, route
+
+
+def _yaml_names_chat(loader) -> bool:
+    # config.yaml is a third way to name a chat model. Blank values mean
+    # "absent", exactly like the flat arguments (_resolve_models agrees).
+    return any(loader._default_dict.get(key)
+               for key in ("chat_model", "retrieve_model", "model"))
+
+
+def _needs_model(surface: str) -> PageIndexAPIError:
+    # The stock chat_model default is not the user's choice: never send
+    # it on an Anthropic-native surface as if it were one.
+    return PageIndexAPIError(
+        f"{surface} needs a model — pass a Claude model=..., or "
+        "configure chat_model on the client.")
+
+
 _LOCAL_INDEX_KEYS = ("model", "summary_model", "backend", "storage_path")
 
 # Near-synonyms of "cloud" that would otherwise parse as model names —
@@ -327,17 +379,21 @@ class PageIndexClient:
             documents (structure and summaries). Defaults to the SDK
             default (fast and cheap).
         chat_model (str, optional): Your own model for the chat surfaces
-            (``chat``, ``chat_completions``), exposed as
-            ``client.chat_model`` — on a cloud client, setting it runs
-            the document-QA agent in your process over the cloud
-            documents (page content then flows through your process to
-            your model provider). Chat names route through LiteLLM and
-            mean what LiteLLM says they mean; bare names are
-            OpenAI-compatible shorthand, and ``openai/Qwen/...`` is the
-            form for an OpenAI-compatible server that itself serves
-            slashed model ids (vLLM, TGI). Defaults to the SDK default
-            (strong); reads ``None`` on a cloud client where the managed
-            chat answers.
+            (``chat``, ``chat_completions``; a value you set also
+            carries onto ``chat(protocol="messages")`` and the two
+            Anthropic agent configs), exposed as ``client.chat_model`` —
+            on a cloud client, setting it runs the document-QA agent in
+            your process over the cloud documents (page content then
+            flows through your process to your model provider). Chat
+            names route through LiteLLM and mean what LiteLLM says they
+            mean; bare names are OpenAI-compatible shorthand, and
+            ``openai/Qwen/...`` is the form for an OpenAI-compatible
+            server that itself serves slashed model ids (vLLM, TGI). The
+            Anthropic-native surfaces read the name by its routing
+            prefix instead — bare names are Anthropic's own — and treat
+            the untouched stock default as no choice. Defaults to the
+            SDK default (strong); reads ``None`` on a cloud client where
+            the managed chat answers.
         model (str, optional): Local mode only — one model for both roles:
             sets the default for ``index_model`` and ``chat_model`` at
             once. The role-specific arguments win over it. (Also the
@@ -521,13 +577,18 @@ def __init__(
                 overrides = {name: value for name, value in chat_conf.items()
                              if name in ("chat_model", "retr
```

**File**: `pageindex/integrations/anthropic_sdk.py` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ def build_anthropic_tools(client, include_management: bool = False,
     except ImportError as exc:
         raise PageIndexAPIError(
             "as_anthropic_tools requires the Anthropic SDK tool runner "
-            "(anthropic>=0.108.0) — pip install -U anthropic (or pip install "
+            "— pip install -U anthropic (or pip install "
             "'pageindex[anthropic]')."
         ) from exc
     from mcp.types import CallToolResult
```

**File**: `pageindex/local_chat.py` (modified, +91/-71)
```diff
@@ -236,9 +236,10 @@ def _reported_model(model_name: str) -> str:
 def _litellm_claude_marks(wire: str) -> Optional[dict]:
     """Claude's prompt caching is opt-in per request: on Claude models
     routed through LiteLLM (Anthropic direct, Bedrock, Vertex — each
-    channel live-verified), mark the managed system prefix and the newest
-    message via LiteLLM's injection param so the loop's later turns and a
-    conversation's next calls read them instead of repaying full price.
+    live-verified — and Foundry, same injection), mark the managed system
+    prefix and the newest message via LiteLLM's injection param so the
+    loop's later turns and a conversation's next calls read them instead
+    of repaying full price.
     ``wire`` is the name LiteLLM itself resolves — each lane strips its
     own routing prefixes first, because the lanes normalize differently
     (the chat wire treats bare names as OpenAI shorthand; the Agents SDK
@@ -250,8 +251,9 @@ def _litellm_claude_marks(wire: str) -> Optional[dict]:
         model, provider, _, _ = get_llm_provider(model=wire)
     except Exception:
         return None
-    if provider == "anthropic" or (provider in ("bedrock", "vertex_ai")
-                                   and "claude" in model.lower()):
+    if provider == "anthropic" or (
+            provider in ("bedrock", "vertex_ai", "azure_ai")
+            and "claude" in model.lower()):
         # The stable prefix plus the newest message, so each turn re-reads
         # the turns before it. LiteLLM seeds nothing unprompted, so this
         # pair is the marks' sole source.
@@ -1228,33 +1230,50 @@ def _require_anthropic() -> None:
         from anthropic.lib.tools import ToolError  # noqa: F401
     except ImportError as exc:
         raise PageIndexAPIError(
-            "chat(protocol='messages') requires anthropic >= 0.108.0 (the "
-            "tool runner with ToolError) — pip install -U anthropic."
+            "chat(protocol='messages') requires the anthropic SDK tool "
+            "runner (with ToolError) — pip install -U anthropic."
         ) from exc
 
 
-_ANTHROPIC_CLIENTS: dict = {}  # backend key -> client, kept open for reuse
+_ANTHROPIC_CLIENTS: dict = {}  # (route, backend) key -> client, kept open
 
+# The transport class per routing prefix — the anthropic SDK ships one
+# client per channel, so a row here is what makes a route reachable.
+_ROUTE_CLIENTS = {"anthropic": "Anthropic", "bedrock": "AnthropicBedrock",
+                  "vertex_ai": "AnthropicVertex",
+                  "azure_ai": "AnthropicFoundry"}
 
-def _anthropic_client(backend=None):
+
+def _anthropic_client(backend, route):
     """The backend client — the seam tests replace with a fake transport.
-    One client per backend: each construction pays ~45 ms of SSL-context
-    build and a cold connection pool. A backend whose values defeat
-    hashing constructs per call, as before."""
+    ``route`` (declared by the model's prefix) picks the SDK client
+    class. One client per (route, backend): each construction pays
+    ~45 ms of SSL-context build and a cold connection pool. A backend
+    whose values defeat hashing constructs per call, as before."""
     import anthropic
     kwargs = _sdk_backend(backend)
     try:
-        key = tuple(sorted(
+        key = (route, tuple(sorted(
             (k, tuple(sorted(v.items())) if isinstance(v, dict) else v)
-            for k, v in kwargs.items()))
+            for k, v in kwargs.items())))
         hash(key)
     except TypeError:
         key = None
     if key in _ANTHROPIC_CLIENTS:
         return _ANTHROPIC_CLIENTS[key]
+    cls = getattr(anthropic, _ROUTE_CLIENTS[route], None)
+    if cls is None:
+        # A build predating this route's client class: same contract as
+        # the tool-runner probe, one step earlier.
+        raise PageIndexAPIError(
+            f"messages on this route needs the anthropic SDK's "
+            f"{_ROUTE_CLIENTS[route]} client, which this anthropic build "
+            "lacks — pip install -U anthropic.")
     try:
-        client = anthropic.Anthropic(**kwargs)
-    except TypeError as exc:
+        client = cls(**kwargs)
+    except (anthropic.AnthropicError, ValueError, TypeError) as exc:
+        # Vertex/Foundry refuse a missing region or credential right at
+        # construction, each with its own type; same contract for all.
         raise PageIndexAPIError(
             f"The Anthropic backend is not configured: {exc}") from exc
     if key is not None and len(_ANTHROPIC_CLIENTS) < 8:
@@ -1327,32 +1346,21 @@ def _anthropic_usage(turns, final_usage: dict) -> dict:
     return totals
 
 
-_CLAUDE_4096_MODELS = ("claude-3-opus", "claude-3-sonnet", "claude-3-haiku",
-                       "claude-3-5-sonnet-20240620")
-
-
-def _default_max_tokens(model: str, thinking=None) -> int:
-    """The wire-required per-turn budget when the caller sets none: 8192,
-    except the claude-3 generation whose output
```

**File**: `pyproject.toml` (modified, +3/-2)
```diff
@@ -43,8 +43,9 @@ pyyaml = ">=6.0"
 Pillow = ">=9.0"
 # Older releases break string prompts with SDK MCP servers (#597, #780).
 claude-agent-sdk = { version = ">=0.1.53", optional = true }
-# Older releases execute a refusal turn's tool_use blocks.
-anthropic = { version = ">=0.108.0", optional = true }
+# Pre-0.122 lacks the Bedrock/Vertex tool runner; pre-0.108 executes a
+# refusal turn's tool_use blocks.
+anthropic = { version = ">=0.122.0", optional = true }
 
 [tool.poetry.extras]
 claude = ["claude-agent-sdk"]
```

**File**: `tests/test_agent_tools.py` (modified, +192/-1)
```diff
@@ -750,6 +750,74 @@ def test_claude_agent_config_local(client):
     assert renamed["allowed_tools"] == ["mcp__docs"]
 
 
+def test_claude_agent_config_forwards_a_claude_chat_model(cloud_with_fake_bridge):
+    # chat_model says who answers; the Claude Agent SDK takes Anthropic's
+    # own name, so LiteLLM's routing prefix is stripped.
+    for name in ("anthropic/claude-sonnet-4-6", "claude-sonnet-4-6",
+                 "litellm/anthropic/claude-sonnet-4-6"):
+        cloud = PageIndexCloudClient(api_key="pi-test-key", chat_model=name)
+        assert cloud.claude_agent_config()["model"] == "claude-sonnet-4-6"
+    # Names are sent as written — no model map gates them.
+    for name in ("anthropic/claude-3-5-sonnet-latest",
+                 "claude-3-5-sonnet-latest"):
+        cloud = PageIndexCloudClient(api_key="pi-test-key", chat_model=name)
+        assert cloud.claude_agent_config()["model"] == "claude-3-5-sonnet-latest"
+
+
+def test_claude_agent_config_carries_any_chosen_chat_model(
+        cloud_with_fake_bridge):
+    # A model you set is sent as written — the destination judges the id.
+    for name in ("gpt-4.1", "openrouter/anthropic/claude-sonnet-4-6"):
+        cloud = PageIndexCloudClient(api_key="pi-test-key", chat_model=name)
+        assert cloud.claude_agent_config()["model"] == name
+        # An explicit model may be the SDK's own name (an alias included)...
+        assert cloud.claude_agent_config(model="sonnet")["model"] == "sonnet"
+        # ... or the client's spelling, read exactly like chat_model.
+        for spelling in ("anthropic/claude-sonnet-4-6",
+                         "litellm/anthropic/claude-sonnet-4-6"):
+            assert (cloud.claude_agent_config(model=spelling)["model"]
+                    == "claude-sonnet-4-6")
+    # Explicitly writing the stock value is a choice too: it carries.
+    cloud = PageIndexCloudClient(api_key="pi-test-key", chat_model="gpt-5.6-sol")
+    assert cloud.claude_agent_config()["model"] == "gpt-5.6-sol"
+
+
+def test_claude_agent_config_managed_chat_sets_no_model(cloud_with_fake_bridge):
+    cloud, _ = cloud_with_fake_bridge
+    assert "model" not in cloud.claude_agent_config()
+
+
+def test_claude_agent_config_local_chat_model(store_path):
+    pytest.importorskip("claude_agent_sdk")
+    local = PageIndexLocalClient(storage_path=store_path,
+                                 chat_model="anthropic/claude-sonnet-4-6")
+    assert local.claude_agent_config()["model"] == "claude-sonnet-4-6"
+    assert "model" not in PageIndexLocalClient(
+        storage_path=store_path).claude_agent_config()
+
+
+def test_claude_agent_config_route_prefix_sets_the_channel_switch(
+        cloud_with_fake_bridge):
+    # Claude Code picks its transport from env switches, not a client
+    # class — a routing prefix rides along as that one switch, set to
+    # "1", and nothing else: the rest of the caller's environment is the
+    # caller's, and how the CLI weighs its own switches is the CLI's
+    # business, not this SDK's.
+    cloud, _ = cloud_with_fake_bridge
+    for prefix, switch in (("bedrock", "CLAUDE_CODE_USE_BEDROCK"),
+                           ("vertex_ai", "CLAUDE_CODE_USE_VERTEX"),
+                           ("azure_ai", "CLAUDE_CODE_USE_FOUNDRY")):
+        cloud.chat_model = f"{prefix}/claude-opus-4-6"
+        config = cloud.claude_agent_config()
+        assert config["model"] == "claude-opus-4-6"
+        assert config["env"] == {switch: "1"}
+    # anthropic/ and bare spellings name a model, not a channel: env
+    # stays out, so the same name means the same thing on every surface.
+    for spelling in ("anthropic/claude-opus-4-6", "claude-opus-4-6"):
+        cloud.chat_model = spelling
+        assert "env" not in cloud.claude_agent_config()
+
+
 def test_openai_agent_config_local(client):
     pytest.importorskip("agents")
     from agents import Agent
@@ -889,12 +957,43 @@ def test_openai_agent_config_cloud_omits_model(cloud_with_fake_bridge):
                                                        "get_document"]
 
 
+def test_anthropic_runner_config_accepts_the_litellm_spelling(client):
+    pytest.importorskip("anthropic")
+    config = client.anthropic_runner_config(
+        model="anthropic/claude-3-opus-20240229")
+    assert config["model"] == "claude-3-opus-20240229"
+
+
+def test_anthropic_runner_config_carries_a_claude_chat_model(client, store_path):
+    pytest.importorskip("anthropic")
+    local = PageIndexLocalClient(storage_path=store_path,
+                                 chat_model="anthropic/claude-3-opus-20240229")
+    config = local.anthropic_runner_config()
+    assert config["model"] == "claude-3-opus-20240229"
+    # The stock default was never chosen: nothing to send.
+    with pytest.raises(PageIndexAPIError, match="needs a model"):
+        client.anthropic_runner_config()
+
+
+def test_anthropic_runner_config_cleared_chat_model_needs_a_model(store_path):
+    """'' and None both mean "
```

**File**: `tests/test_local_chat.py` (modified, +344/-47)
```diff
@@ -1212,7 +1212,7 @@ def handler(request):
             http_client=anthropic_httpx.Client(
                 transport=anthropic_httpx.MockTransport(handler)))
         monkeypatch.setattr(local_chat, "_anthropic_client",
-                            lambda backend=None: fake)
+                            lambda backend=None, route="anthropic": fake)
         return state["calls"]
 
     return install
@@ -2078,7 +2078,7 @@ def handler(request):
         http_client=anthropic_httpx.Client(
             transport=anthropic_httpx.MockTransport(handler)))
     monkeypatch.setattr(local_chat, "_anthropic_client",
-                        lambda backend=None: fake)
+                        lambda backend=None, route="anthropic": fake)
     with pytest.raises(PageIndexAPIError, match="model backend failed"):
         client._messages("q", model="claude-test")
     with pytest.raises(PageIndexAPIError, match="model backend failed"):
@@ -2203,13 +2203,13 @@ async def close(self):
 
 
 @needs_anthropic
-def test_messages_max_tokens_default_resolves_per_model(client, fake_anthropic):
-    """The wire-required budget must not exceed the model's ceiling: the
-    claude-3 generation caps output at 4096."""
+def test_messages_max_tokens_default(client, fake_anthropic):
+    """The wire-required budget defaults to 8192 whatever the model names;
+    an explicit value passes through."""
     calls = fake_anthropic([
         _anthropic_message([{"type": "text", "text": "ok"}], "end_turn")])
     client._messages("q", model="claude-3-opus-20240229")
-    assert calls[0]["max_tokens"] == 4096
+    assert calls[0]["max_tokens"] == 8192
     calls = fake_anthropic([
         _anthropic_message([{"type": "text", "text": "ok"}], "end_turn")])
     client._messages("q", model="claude-sonnet-4-5")
@@ -2220,6 +2220,62 @@ def test_messages_max_tokens_default_resolves_per_model(client, fake_anthropic):
     assert calls[0]["max_tokens"] == 1234
 
 
+@needs_anthropic
+def test_messages_accepts_the_litellm_spelling(client, fake_anthropic):
+    calls = fake_anthropic([
+        _anthropic_message([{"type": "text", "text": "ok"}], "end_turn")])
+    client._messages("q", model="anthropic/claude-3-opus-20240229")
+    assert calls[0]["model"] == "claude-3-opus-20240229"
+
+
+@needs_anthropic
+def test_messages_carries_a_claude_chat_model(store_path, fake_anthropic):
+    calls = fake_anthropic([
+        _anthropic_message([{"type": "text", "text": "ok"}], "end_turn")])
+    local = PageIndexLocalClient(storage_path=store_path,
+                                 chat_model="anthropic/claude-3-opus-20240229")
+    # Through the public door: chat() must not demand model= itself.
+    local.chat("q", protocol="messages")
+    assert calls[0]["model"] == "claude-3-opus-20240229"
+    # The stock default was never chosen: nothing to send.
+    with pytest.raises(PageIndexAPIError, match="needs a model"):
+        PageIndexLocalClient(storage_path=store_path).chat(
+            "q", protocol="messages")
+
+
+@needs_anthropic
+def test_messages_cleared_chat_model_gets_the_own_model_refusal(
+        store_path, fake_anthropic):
+    """'' and None both mean "configures nothing": clearing chat_model
+    drops the client back to no-own-chat, and messages() refuses in its
+    own voice — never model='' on the wire, never a NoneType crash."""
+    calls = fake_anthropic([
+        _anthropic_message([{"type": "text", "text": "never"}], "end_turn")])
+    local = PageIndexLocalClient(storage_path=store_path,
+                                 chat_model="claude-sonnet-4-5")
+    for cleared in ("", None):
+        local.chat_model = cleared
+        with pytest.raises(PageIndexAPIError, match="chat_model="):
+            local._messages("q")
+    assert calls == []
+
+
+@needs_anthropic
+def test_messages_route_prefix_needs_a_model_id(store_path, fake_anthropic):
+    """A prefix-only name selects a channel and names nothing — sending
+    model='' (or switching transports with no model chosen) is the worst
+    of both; refuse it in this SDK's own voice."""
+    calls = fake_anthropic([
+        _anthropic_message([{"type": "text", "text": "never"}], "end_turn")])
+    local = PageIndexLocalClient(storage_path=store_path,
+                                 chat_model="claude-sonnet-4-5")
+    for name in ("bedrock/", "vertex_ai/", "azure_ai/", "anthropic/",
+                 "litellm/"):
+        with pytest.raises(PageIndexAPIError, match="no model id"):
+            local._messages("q", model=name)
+    assert calls == []
+
+
 @needs_anthropic
 def test_messages_thinking_passes_through(client, fake_anthropic):
     """Anthropic-native thinking config, forwarded verbatim; unset sends
@@ -2449,6 +2505,37 @@ def test_messages_top_level_cache_control(client, store_path, fake_anthropic):
     assert "cache_control" not in calls[0]
 
 
+@needs_anthropic
+@pytest.mark.parametrize("stream", [False, True])
+def test_messages_bedrock_moves_an_explicit_bre
```

**File**: `tests/test_package_surface.py` (modified, +0/-15)
```diff
@@ -140,21 +140,6 @@ def test_import_leaves_litellm_env_untouched(tmp_path):
     assert out.stdout.strip() == "ok"
 
 
-def test_chat_module_stamps_before_it_imports_litellm():
-    """local_chat imports litellm without utils on its import path; the
-    stamp has to be in place by then anyway."""
-    probe = ("import os\n"
-             "from pageindex import local_chat\n"
-             "local_chat._default_max_tokens('claude-sonnet-4-5',"
-             " {'budget_tokens': 4096})\n"
-             "print(os.environ.get('LITELLM_LOCAL_MODEL_COST_MAP'))\n")
-    env = {k: v for k, v in os.environ.items()
-           if k != "LITELLM_LOCAL_MODEL_COST_MAP"}
-    out = subprocess.run([sys.executable, "-c", probe], env=env,
-                         capture_output=True, text=True, check=True)
-    assert out.stdout.strip() == "True"
-
-
 def test_utils_import_keeps_litellm_off_the_network():
     """utils' import sets litellm's no-fetch default; an explicit choice wins."""
     probe = ("import os, pageindex.utils; "
```

---

### Incident Patch 2: `9c4c3ff2` (2026-09-21)
**Commit Message**: test(sdk): cover list_documents regression boundaries

**File**: `tests/test_client.py` (modified, +47/-0)
```diff
@@ -1375,6 +1375,44 @@ def test_list_documents_validation(local_client):
     assert local_client.list_documents(folder_id="root")["total"] == 0
 
 
+@pytest.mark.parametrize("limit", [101, 10000])
+def test_list_documents_large_page_local(local_client, monkeypatch, limit):
+    metas = [{"id": f"doc-{i:05d}", "name": f"{i}.pdf"}
+             for i in range(limit + 2)]
+    monkeypatch.setattr(local_client._api._store, "list_metas", lambda: metas)
+
+    listing = local_client.list_documents(limit=limit, offset=1)
+
+    assert len(listing["documents"]) == limit
+    assert listing["documents"][0]["id"] == "doc-00001"
+    assert listing["documents"][-1]["id"] == f"doc-{limit:05d}"
+    assert listing["total"] == limit + 2
+    assert listing["limit"] == limit and listing["offset"] == 1
+
+
+@pytest.mark.parametrize("limit", [101, 10000])
+def test_list_documents_large_page_cloud(cloud, limit):
+    client, calls, _ = cloud
+
+    client.list_documents(limit=limit, offset=1)
+
+    assert calls[-1]["params"] == {"limit": limit, "offset": 1}
+
+
+@pytest.mark.parametrize("limit", [0, 10001])
+def test_list_documents_limit_out_of_range_local(local_client, limit):
+    with pytest.raises(ValueError, match="limit must be between 1 and 10000"):
+        local_client.list_documents(limit=limit)
+
+
+@pytest.mark.parametrize("limit", [0, 10001])
+def test_list_documents_limit_out_of_range_cloud(cloud, limit):
+    client, calls, _ = cloud
+    with pytest.raises(ValueError, match="limit must be between 1 and 10000"):
+        client.list_documents(limit=limit)
+    assert calls == []
+
+
 def test_list_documents_recursive_wire(cloud):
     """recursive reaches the query string only when asked for."""
     client, calls, _ = cloud
@@ -1384,6 +1422,15 @@ def test_list_documents_recursive_wire(cloud):
     assert "recursive" in calls[-1]["params"]
 
 
+def test_list_documents_recursive_false_string_wire(cloud):
+    client, calls, _ = cloud
+
+    client.list_documents(folder_id="f1", recursive="false")
+
+    assert calls[-1]["params"] == {"limit": 50, "offset": 0,
+                                  "folder_id": "f1", "recursive": "false"}
+
+
 def test_missing_document_errors(local_client):
     with pytest.raises(PageIndexAPIError):
         local_client.get_tree("nope")
```

---

### Incident Patch 3: `ed06ec69` (2026-09-21)
**Commit Message**: fix(sdk): list_documents review followups

- Forward recursive value instead of hardcoding True (#3)
- Raise limit cap from 100 to 10000 to match server (#4)
- Accept folder_id='root'/'' in local mode (#6)
- Fix wire test to assert presence not identity (#6, #9)
- Delete restating comments (#15)

Addresses PR #522 review findings 2-7.

**File**: `pageindex/client.py` (modified, +1/-1)
```diff
@@ -1796,7 +1796,7 @@ def list_documents(
         List documents with pagination, newest first.
 
         Args:
-            limit (int): Maximum documents to return (1-100).
+            limit (int): Maximum documents to return (1-10000).
             offset (int): Number of documents to skip.
             folder_id (str, optional): Cloud-only folder filter.
             recursive (bool): Include documents in ``folder_id``'s
```

**File**: `pageindex/cloud_api.py` (modified, +4/-4)
```diff
@@ -453,7 +453,7 @@ def list_documents(self, limit: int = 50, offset: int = 0, folder_id: Optional[s
         List all documents for the authenticated user with pagination.
 
         Args:
-            limit (int, optional): Maximum number of documents to return (1-100). Defaults to 50.
+            limit (int, optional): Maximum number of documents to return (1-10000). Defaults to 50.
             offset (int, optional): Number of documents to skip. Defaults to 0.
             folder_id (str, optional): Filter by folder (workspace) ID. If provided, only documents
                 in the specified folder are returned. Defaults to None (all documents).
@@ -467,8 +467,8 @@ def list_documents(self, limit: int = 50, offset: int = 0, folder_id: Optional[s
                 - limit (int): Applied limit
                 - offset (int): Applied offset
         """
-        if limit < 1 or limit > 100:
-            raise ValueError("limit must be between 1 and 100")
+        if limit < 1 or limit > 10000:
+            raise ValueError("limit must be between 1 and 10000")
         if offset < 0:
             raise ValueError("offset must be non-negative")
 
@@ -478,7 +478,7 @@ def list_documents(self, limit: int = 50, offset: int = 0, folder_id: Optional[s
         if name is not None:
             params["name"] = name
         if recursive:
-            params["recursive"] = True
+            params["recursive"] = recursive
 
         response = requests.get(
             f"{self.BASE_URL}/docs/",
```

**File**: `pageindex/local_api.py` (modified, +4/-4)
```diff
@@ -344,13 +344,13 @@ def list_documents(
         offset: int = 0,
         folder_id: str | None = None,
         name: str | None = None,
-        recursive: bool = False,  # no folders here, nothing to descend into
+        recursive: bool = False,
     ) -> dict[str, Any]:
-        if limit < 1 or limit > 100:
-            raise ValueError("limit must be between 1 and 100")
+        if limit < 1 or limit > 10000:
+            raise ValueError("limit must be between 1 and 10000")
         if offset < 0:
             raise ValueError("offset must be non-negative")
-        if folder_id is not None:
+        if folder_id is not None and folder_id not in ("", "root"):
             raise PageIndexAPIError(
                 "Failed to list documents: folders are not supported in local mode."
             )
```

**File**: `tests/test_client.py` (modified, +2/-2)
```diff
@@ -958,7 +958,6 @@ def test_document_management(local_client, indexed_doc):
     assert listing["total"] == 1
     assert listing["limit"] == 50 and listing["offset"] == 0
     assert listing["documents"][0]["id"] == indexed_doc
-    # Same keys as a cloud listing; a local library has no folder to name.
     assert listing["documents"][0]["path"] is None
 
     assert local_client.is_retrieval_ready(indexed_doc) is True
@@ -1373,6 +1372,7 @@ def test_list_documents_validation(local_client):
     with pytest.raises(PageIndexAPIError, match="folders"):
         local_client.list_documents(folder_id="f1")
     assert local_client.list_documents(recursive=True)["total"] == 0
+    assert local_client.list_documents(folder_id="root")["total"] == 0
 
 
 def test_list_documents_recursive_wire(cloud):
@@ -1381,7 +1381,7 @@ def test_list_documents_recursive_wire(cloud):
     client.list_documents(folder_id="f1")
     assert "recursive" not in calls[-1]["params"]
     client.list_documents(folder_id="f1", recursive=True)
-    assert calls[-1]["params"]["recursive"] is True
+    assert "recursive" in calls[-1]["params"]
 
 
 def test_missing_document_errors(local_client):
```

---

### Incident Patch 4: `0d141d2a` (2026-09-21)
**Commit Message**: fix



---

### Incident Patch 5: `a03d6041` (2026-09-21)
**Commit Message**: fix

**File**: `cookbook/pageindex-citation.ipynb` (modified, +3/-107)
```diff
@@ -48,115 +48,11 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 9,
+   "execution_count": null,
    "metadata": {},
-   "outputs": [
-    {
-     "name": "stdout",
-     "output_type": "stream",
-     "text": [
-      "Requirement already satisfied: pageindex in /Users/mingtian/miniconda3/lib/python3.12/site-packages (0.2.18)\n",
-      "Collecting pageindex\n",
-      "  Downloading pageindex-0.2.19-py3-none-any.whl.metadata (14 kB)\n",
-      "Requirement already satisfied: requests in /Users/mingtian/miniconda3/lib/python3.12/site-packages (2.32.3)\n",
-      "Collecting requests\n",
-      "  Using cached requests-2.34.2-py3-none-any.whl.metadata (4.8 kB)\n",
-      "Requirement already satisfied: Pillow>=9.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (12.2.0)\n",
-      "Requirement already satisfied: PyPDF2>=3.0.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (3.0.1)\n",
-      "Requirement already satisfied: litellm>=1.97.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (1.98.0rc1)\n",
-      "Requirement already satisfied: mcp<3,>=1.19.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (1.29.0)\n",
-      "Requirement already satisfied: openai>=1.70.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (2.54.0)\n",
-      "Requirement already satisfied: openai-agents>=0.18.1 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (0.20.0)\n",
-      "Requirement already satisfied: pypdfium2>=5 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (5.13.0)\n",
-      "Requirement already satisfied: python-dotenv>=1.0.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (1.2.2)\n",
-      "Requirement already satisfied: pyyaml>=6.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (6.0.2)\n",
-      "Requirement already satisfied: regex>=2024.0.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (2025.7.34)\n",
-      "Requirement already satisfied: sortedcontainers>=2.4.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (2.4.0)\n",
-      "Requirement already satisfied: urllib3>=1.26 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (2.3.0)\n",
-      "Requirement already satisfied: charset_normalizer<4,>=2 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from requests) (3.3.2)\n",
-      "Requirement already satisfied: idna<4,>=2.5 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from requests) (3.7)\n",
-      "Requirement already satisfied: certifi>=2023.5.7 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from requests) (2026.4.22)\n",
-      "Requirement already satisfied: fastuuid<1.0,>=0.14.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (0.14.0)\n",
-      "Requirement already satisfied: httpx<1.0,>=0.28.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (0.28.1)\n",
-      "Requirement already satisfied: tiktoken<1.0,>=0.8.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (0.12.0)\n",
-      "Requirement already satisfied: importlib-metadata<9.0,>=8.0.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (8.5.0)\n",
-      "Requirement already satisfied: tokenizers<1.0,>=0.21.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (0.22.2)\n",
-      "Requirement already satisfied: click<9.0,>=8.0.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (8.1.8)\n",
-      "Requirement already satisfied: jinja2<4.0,>=3.1.6 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (3.1.6)\n",
-      "Requirement already satisfied: aiohttp<4.0,>=3.14.2 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (3.14.3)\n",
-      "Requirement already satisfied: pydantic<3.0.0,>=2.10.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (2.12.5)\n",
-      "Requirement already satisfied: pydantic-settings<3.0,>=2.14.1 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (2.15.0)\n",
-      "Requirement already satisfied: jsonschema<5.0,>=4.0.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (4.23.0)\n",
-      "Requirement already satisfied: boto3<2.0,>=1.43.1 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from litellm>=1.97.0->pageindex) (1.43.72)\n",
-      "Requirement already satisfied: anyio>=4.5 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from mcp<3,>=1.19.0->page
```

---

### Incident Patch 6: `56072308` (2026-09-21)
**Commit Message**: fix

**File**: `cookbook/pageindex-citation.ipynb` (modified, +1/-1)
```diff
@@ -180,7 +180,7 @@
     "from pageindex import PageIndexClient\n",
     "\n",
     "os.environ[\"PAGEINDEX_API_KEY\"]=\"pageindex_demo_readonly_key\"\n",
-    "os.environ[\"OPENAI_API_KEY\"] = \"\"\n",
+    "os.environ[\"OPENAI_API_KEY\"] = \"Your OpenAI API key here\"\n",
     "\n",
     "\n",
     "MODEL = \"gpt-5.6-luna\"  # gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna\n",
```

---

### Incident Patch 7: `a1d6cae7` (2026-09-21)
**Commit Message**: fix

**File**: `cookbook/pageindex-citation.ipynb` (modified, +176/-153)
```diff
@@ -27,11 +27,11 @@
     "\n",
     "A useful citation lets readers check the evidence behind an answer. This notebook demonstrates how to turn **PageIndex Cloud’s block-level citations** into highlighted source regions in the original document.\n",
     "\n",
-    "We ask a question about revenue in a financial report, parse the citations in the answer, and use each reference’s document name and block ID to locate its source. We then fetch the full-page image and highlight the cited region so readers can compare the answer with the original context.\n",
+    "We ask a question about revenue in a financial report, resolve the citations with the SDK to get each source’s document ID, page, and bounding box. We then fetch the full-page image and highlight the cited region so readers can compare the answer with the original context.\n",
     "\n",
     "1. **Ask with citations** — Stream an answer with references to its supporting document blocks.\n",
-    "2. **Parse the references** — Extract the document name, page number, and block ID.\n",
-    "3. **Locate the evidence** — Resolve a reference to its page and bounding box.\n",
+    "2. **Resolve the references** — Let the SDK parse citations and fetch their source blocks.\n",
+    "3. **Select the evidence** — Choose a resolved citation to highlight.\n",
     "4. **Highlight the source** — Display the page with the cited region highlighted.\n",
     "\n",
     "**Before you start:** Have your OpenAI API key ready. This demo uses an existing document on PageIndex Cloud with the supplied demo access key. Highlighting requires a document with block-level layout data and a full-page image available.\n"
@@ -43,16 +43,120 @@
    "source": [
     "## 01 · Set up\n",
     "\n",
-    "Install the PageIndex SDK for querying and retrieving source references, and Pillow for drawing highlights on page images.\n"
+    "Install the latest PageIndex SDK for citation resolution, page images, and highlighting. Requests downloads the image, and Pillow supports the SDK’s image helper.\n"
    ]
   },
   {
    "cell_type": "code",
-   "execution_count": null,
+   "execution_count": 9,
    "metadata": {},
-   "outputs": [],
+   "outputs": [
+    {
+     "name": "stdout",
+     "output_type": "stream",
+     "text": [
+      "Requirement already satisfied: pageindex in /Users/mingtian/miniconda3/lib/python3.12/site-packages (0.2.18)\n",
+      "Collecting pageindex\n",
+      "  Downloading pageindex-0.2.19-py3-none-any.whl.metadata (14 kB)\n",
+      "Requirement already satisfied: requests in /Users/mingtian/miniconda3/lib/python3.12/site-packages (2.32.3)\n",
+      "Collecting requests\n",
+      "  Using cached requests-2.34.2-py3-none-any.whl.metadata (4.8 kB)\n",
+      "Requirement already satisfied: Pillow>=9.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (12.2.0)\n",
+      "Requirement already satisfied: PyPDF2>=3.0.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (3.0.1)\n",
+      "Requirement already satisfied: litellm>=1.97.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (1.98.0rc1)\n",
+      "Requirement already satisfied: mcp<3,>=1.19.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (1.29.0)\n",
+      "Requirement already satisfied: openai>=1.70.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (2.54.0)\n",
+      "Requirement already satisfied: openai-agents>=0.18.1 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (0.20.0)\n",
+      "Requirement already satisfied: pypdfium2>=5 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (5.13.0)\n",
+      "Requirement already satisfied: python-dotenv>=1.0.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (1.2.2)\n",
+      "Requirement already satisfied: pyyaml>=6.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (6.0.2)\n",
+      "Requirement already satisfied: regex>=2024.0.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (2025.7.34)\n",
+      "Requirement already satisfied: sortedcontainers>=2.4.0 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (2.4.0)\n",
+      "Requirement already satisfied: urllib3>=1.26 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from pageindex) (2.3.0)\n",
+      "Requirement already satisfied: charset_normalizer<4,>=2 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from requests) (3.3.2)\n",
+      "Requirement already satisfied: idna<4,>=2.5 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from requests) (3.7)\n",
+      "Requirement already satisfied: certifi>=2023.5.7 in /Users/mingtian/miniconda3/lib/python3.12/site-packages (from requests) (2026.4.22)\n",
+      "Requirement already satisfied: fastuuid<1.0,>=0.14.0 in /Users/mingtian/minicon
```

---

### Incident Patch 8: `91238b33` (2026-09-21)
**Commit Message**: README banner: drop fixed height so it scales on PyPI (#528)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 <div align="center">
   
 <a href="https://vectify.ai/pageindex" target="_blank">
-<img width="1471" height="491" alt="pi_github_banner_low" src="https://github.com/user-attachments/assets/bae02956-6c4e-4a0b-adea-257b0be4aaa1" />
+<img width="1471" alt="pi_github_banner_low" src="https://github.com/user-attachments/assets/bae02956-6c4e-4a0b-adea-257b0be4aaa1" />
 </a>
 
 <br/>
```

---

### Incident Patch 9: `71714e86` (2026-09-20)
**Commit Message**: get_document_id accepts a path: strip the folder prefix since names are unique

**File**: `pageindex/client.py` (modified, +5/-2)
```diff
@@ -1761,11 +1761,14 @@ def get_document(self, doc_id: str) -> dict[str, Any]:
 
     def get_document_id(self, name: str) -> str:
         """
-        Look up a document's ID by its name. Useful for resolving
-        citation doc names (from ``<cite doc="…">``) to IDs.
+        Look up a document's ID by its name or path. A path like
+        ``"Research/Papers/attention.pdf"`` is accepted: the folder
+        part is stripped because document names are unique across
+        the library.
 
         Raises PageIndexAPIError if no document with that name exists.
         """
+        name = name.rsplit("/", 1)[-1] if "/" in name else name
         result = self._api.list_documents(limit=1, name=name)
         docs = result.get("documents", [])
         if docs:
```

**File**: `tests/test_client.py` (modified, +13/-3)
```diff
@@ -1823,9 +1823,17 @@ def test_folder_and_document_paths(cloud, monkeypatch):
     def handler(method, url, kw):
         if url.endswith("/folders/"):
             return FakeResponse({"folders": folders, "total": len(folders)})
-        doc_id = re.fullmatch(r".*/doc/([^/]+)/metadata/", url).group(1)
-        return FakeResponse({"id": doc_id, "name": f"{doc_id}.pdf",
-                             "folderId": doc_folders[doc_id]})
+        m = re.fullmatch(r".*/doc/([^/]+)/metadata/", url)
+        if m:
+            doc_id = m.group(1)
+            return FakeResponse({"id": doc_id, "name": f"{doc_id}.pdf",
+                                 "folderId": doc_folders[doc_id]})
+        if url.endswith("/docs/"):
+            name = kw.get("params", {}).get("name", "")
+            docs = [{"id": did, "name": f"{did}.pdf"}
+                    for did in doc_folders if f"{did}.pdf" == name]
+            return FakeResponse({"documents": docs})
+        return FakeResponse({})
     _patch_requests(monkeypatch, handler)
 
     assert client.get_folder_path("f-p") == "Research/Papers"
@@ -1837,6 +1845,8 @@ def handler(method, url, kw):
     assert client.get_document_path("pi-nested") == "Research/Papers/pi-nested.pdf"
     assert client.get_document_path("pi-root") == "pi-root.pdf"
     assert client.get_document_path("pi-library") == "pi-library.pdf"
+    assert client.get_document_id("Research/Papers/pi-nested.pdf") == "pi-nested"
+    assert client.get_document_id("pi-root.pdf") == "pi-root"
     with pytest.raises(PageIndexAPIError, match="Folder 'f-none' not found"):
         client.get_folder_path("f-none")
     with pytest.raises(PageIndexAPIError, match="No folder at path 'Research/X'"):
```

---

### Incident Patch 10: `c840b69b` (2026-09-18)
**Commit Message**: Sync browse_documents query: "Required when sort=relevance" (#515)

Sync browse_documents query description with server (#486)

pageindex-chat #486 fixed 'Only used' → 'Required when sort=relevance'.
Sync the local contract and snapshot to match.

**File**: `pageindex/agent_tools.py` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@
                     "type": "string",
                     "description": (
                         "Search query for relevance ranking. "
-                        'Only used when sort="relevance".'
+                        'Required when sort="relevance".'
                     ),
                 },
                 "offset": {
```

**File**: `tests/data/cloud_mcp_contract.json` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
           },
           "query": {
             "type": "string",
-            "description": "Search query for relevance ranking. Only used when sort=\"relevance\"."
+            "description": "Search query for relevance ranking. Required when sort=\"relevance\"."
           },
           "offset": {
             "type": "integer",
```

---

### Incident Patch 11: `18eb5c9b` (2026-09-17)
**Commit Message**: Review fixes: unify format validation, pin key set, self-check exception list

- Hoist format guard above the api_key branch so both lanes reject
  unknown formats (cloud was silently returning the markdown prompt)
- Docstring: 'any other value raises' (the server does not reject)
- assert set(LOCAL_CITATION_PROMPTS) == {markdown, cite} pins keys
- assert set(_LOCAL_ONLY_LINES) <= frozen catches stale entries

**File**: `pageindex/agent_tools.py` (modified, +5/-6)
```diff
@@ -1659,13 +1659,12 @@ def fetch_citation_prompt(client, format: str) -> str:
     """The MCP server's ``cited_answer`` prompt as system-prompt text;
     ``format`` rides as its one argument. Local: the frozen copy,
     page-level."""
+    if format not in LOCAL_CITATION_PROMPTS:
+        raise PageIndexAPIError(
+            f"citations format {format!r} is not one of "
+            f"{', '.join(LOCAL_CITATION_PROMPTS)}.")
     if not getattr(client, "api_key", None):
-        try:
-            return LOCAL_CITATION_PROMPTS[format]
-        except KeyError:
-            raise PageIndexAPIError(
-                f"citations format {format!r} is not one of "
-                f"{', '.join(LOCAL_CITATION_PROMPTS)}.") from None
+        return LOCAL_CITATION_PROMPTS[format]
     _, messages = _cloud_bridge(client, gated=True).get_prompt(
         "cited_answer", {"format": format})
     text = render_prompt_text(messages)
```

**File**: `pageindex/client.py` (modified, +2/-2)
```diff
@@ -2169,8 +2169,8 @@ def citation_prompt(self, format: str = "cite") -> str:
         ``format`` picks how a citation is written: ``"cite"`` (the
         ``<cite doc= page= block=/>`` tags PageIndex chat writes and
         renders — the default) or ``"markdown"`` (a bracketed
-        ``[doc, p. N]`` reference, for hosts that strip tags); the
-        server rejects any other value. Local documents: the SDK's
+        ``[doc, p. N]`` reference, for hosts that strip tags); any
+        other value raises. Local documents: the SDK's
         frozen copy of the same prompt (page-level — local page
         content has no blocks).
         """
```

**File**: `tests/test_agent_tools.py` (modified, +2/-1)
```diff
@@ -2312,6 +2312,7 @@ def test_live_cloud_instructions_nonempty():
 
 def _assert_instructions_local_parity(instructions):
     frozen = {line for line in AGENT_INSTRUCTIONS.splitlines() if line.strip()}
+    assert set(_LOCAL_ONLY_LINES) <= frozen, "stale _LOCAL_ONLY_LINES entries"
     live = {line for line in instructions.splitlines() if line.strip()}
     unexplained = [
         line for line in sorted(live - frozen)
@@ -2487,7 +2488,7 @@ def test_citation_prompt_local_frozen_copy(client):
     one text per format, PageIndex chat's cite format by default, only
     local tools named."""
     from pageindex.agent_tools import LOCAL_CITATION_PROMPTS
-    assert len(set(LOCAL_CITATION_PROMPTS.values())) == 2
+    assert set(LOCAL_CITATION_PROMPTS) == {"markdown", "cite"}
     assert client.citation_prompt() == LOCAL_CITATION_PROMPTS["cite"]
     assert client.citation_prompt(format="") == LOCAL_CITATION_PROMPTS["cite"]
     for fmt in ("markdown", "cite"):
```

---

### Incident Patch 12: `d776d964` (2026-09-17)
**Commit Message**: fix notebook link

**File**: `cookbook/pageindex-flash-demo.ipynb` (modified, +2/-152)
```diff
@@ -90,158 +90,8 @@
   {
    "cell_type": "code",
    "execution_count": null,
-   "metadata": {
-    "colab": {
-     "base_uri": "https://localhost:8080/"
-    },
-    "collapsed": true,
-    "id": "9oDUT2JHckhV",
-    "outputId": "82ff37d4-2320-4e32-d86f-0674b37df191"
-   },
-   "outputs": [
-    {
-     "name": "stdout",
-     "output_type": "stream",
-     "text": [
-      "Collecting pageindex\n",
-      "  Downloading pageindex-0.2.14-py3-none-any.whl.metadata (16 kB)\n",
-      "Collecting PyPDF2>=3.0.0 (from pageindex)\n",
-      "  Downloading pypdf2-3.0.1-py3-none-any.whl.metadata (6.8 kB)\n",
-      "Collecting litellm>=1.97.0 (from pageindex)\n",
-      "  Downloading litellm-1.99.0-cp310-abi3-manylinux_2_28_x86_64.whl.metadata (41 kB)\n",
-      "\u001b[2K     \u001b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m \u001b[32m41.3/41.3 kB\u001b[0m \u001b[31m2.2 MB/s\u001b[0m eta \u001b[36m0:00:00\u001b[0m\n",
-      "\u001b[?25hRequirement already satisfied: openai>=1.70.0 in /usr/local/lib/python3.13/dist-packages (from pageindex) (2.54.0)\n",
-      "Collecting openai-agents>=0.18.1 (from pageindex)\n",
-      "  Downloading openai_agents-0.22.0-py3-none-any.whl.metadata (11 kB)\n",
-      "Collecting pypdfium2>=5 (from pageindex)\n",
-      "  Downloading pypdfium2-5.13.0-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (66 kB)\n",
-      "\u001b[2K     \u001b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m \u001b[32m66.5/66.5 kB\u001b[0m \u001b[31m4.0 MB/s\u001b[0m eta \u001b[36m0:00:00\u001b[0m\n",
-      "\u001b[?25hRequirement already satisfied: python-dotenv>=1.0.0 in /usr/local/lib/python3.13/dist-packages (from pageindex) (1.2.3)\n",
-      "Requirement already satisfied: pyyaml>=6.0 in /usr/local/lib/python3.13/dist-packages (from pageindex) (6.0.3)\n",
-      "Requirement already satisfied: regex>=2024.0.0 in /usr/local/lib/python3.13/dist-packages (from pageindex) (2025.11.3)\n",
-      "Requirement already satisfied: requests>=2.28.0 in /usr/local/lib/python3.13/dist-packages (from pageindex) (2.32.4)\n",
-      "Collecting sortedcontainers>=2.4.0 (from pageindex)\n",
-      "  Downloading sortedcontainers-2.4.0-py2.py3-none-any.whl.metadata (10 kB)\n",
-      "Collecting fastuuid<1.0,>=0.14.0 (from litellm>=1.97.0->pageindex)\n",
-      "  Downloading fastuuid-0.14.0-cp313-cp313-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (1.1 kB)\n",
-      "Requirement already satisfied: httpx<1.0,>=0.28.0 in /usr/local/lib/python3.13/dist-packages (from litellm>=1.97.0->pageindex) (0.28.1)\n",
-      "Requirement already satisfied: tiktoken<1.0,>=0.8.0 in /usr/local/lib/python3.13/dist-packages (from litellm>=1.97.0->pageindex) (0.14.0)\n",
-      "Collecting importlib-metadata<9.0,>=8.0.0 (from litellm>=1.97.0->pageindex)\n",
-      "  Downloading importlib_metadata-8.9.0-py3-none-any.whl.metadata (4.5 kB)\n",
-      "Requirement already satisfied: tokenizers<1.0,>=0.21.0 in /usr/local/lib/python3.13/dist-packages (from litellm>=1.97.0->pageindex) (0.23.1)\n",
-      "Requirement already satisfied: click<9.0,>=8.0.0 in /usr/local/lib/python3.13/dist-packages (from litellm>=1.97.0->pageindex) (8.5.0)\n",
-      "Requirement already satisfied: jinja2<4.0,>=3.1.6 in /usr/local/lib/python3.13/dist-packages (from litellm>=1.97.0->pageindex) (3.1.6)\n",
-      "Requirement already satisfied: aiohttp<4.0,>=3.14.2 in /usr/local/lib/python3.13/dist-packages (from litellm>=1.97.0->pageindex) (3.14.3)\n",
-      "Requirement already satisfied: pydantic<3.0.0,>=2.10.0 in /usr/local/lib/python3.13/dist-packages (from litellm>=1.97.0->pageindex) (2.13.4)\n",
-      "Collecting pydantic-settings<3.0,>=2.14.1 (from litellm>=1.97.0->pageindex)\n",
-      "  Downloading pydantic_settings-2.15.0-py3-none-any.whl.metadata (3.9 kB)\n",
-      "Requirement already satisfied: jsonschema<5.0,>=4.0.0 in /usr/local/lib/python3.13/dist-packages (from litellm>=1.97.0->pageindex) (4.26.0)\n",
-      "Collecting boto3<2.0,>=1.43.1 (from litellm>=1.97.0->pageindex)\n",
-      "  Downloading boto3-1.43.86-py3-none-any.whl.metadata (6.6 kB)\n",
-      "Requirement already satisfied: anyio<5,>=3.5.0 in /usr/local/lib/python3.13/dist-packages (from openai>=1.70.0->pageindex) (4.14.2)\n",
-      "Requirement already satisfied: distro<2,>=1.7.0 in /usr/local/lib/python3.13/dist-packages (from openai>=1.70.0->pageindex) (1.9.0)\n",
-      "Requirement already satisfied: jiter<1,>=0.10.0 in /usr/local/lib/python3.13/dist-packages (from openai>=1.70.0->pageindex) (0.16.0)\n",
-      "Requirement already satisfied: sniffio in /usr/local/lib/python3.13/dist-packages (from openai>=1.70.0->pageindex) (1.3.1)\n",
-      "Requirement already satisfied: tqdm>4 in /usr/local/lib/python3.13/dist-packages (from openai>=1.70.0->pageindex) (4.67.3)\n",
-      "Requirement already satisfied: typing-extensions<5,>=4.14 in /usr/local/lib/python3.13/dist-packages (from openai>=1.70.0->pageindex) (4.16.0)\n",
- 
```

---

### Incident Patch 13: `aefb94af` (2026-09-15)
**Commit Message**: Merge pull request #505 from VectifyAI/readme-fix

fix table comparison

**File**: `README.md` (modified, +9/-9)
```diff
@@ -196,16 +196,16 @@ doc_id = client.submit_document("report.pdf", wait=True)["doc_id"]
 print(client.chat("What was the 2023 operating margin?", doc_id=doc_id))
 ```
 
-| Capability | **Local** (this repo) | **Cloud** ([get an API key](https://developer.pageindex.ai/)) |
+| | **Local** | **Cloud** |
 |---|---|---|
-| Best for | text-heavy PDFs and local workflows | scanned, image-heavy, and large document collections |
-| Indexing | runs locally | runs in PageIndex Cloud, with production OCR and image understanding |
-| Storage | local | managed in PageIndex Cloud |
-| Chat model | your model | your model, or the managed chat included with your key |
-| Citations | page-level | line-level |
-| Image understanding | — | ✅ |
-| Multi-document scale | manual | PageIndex File System |
-| MCP server | — | ✅ |
+| Handles | Text-based PDFs | Text-based, scanned, and image-rich documents |
+| Indexing | On your machine | Managed by PageIndex |
+| Storage | Local directory | Cloud storage |
+| Citations | Page-level | Line-level |
+| OCR & image understanding | — | ✓ |
+| [Metadata](https://docs.pageindex.ai/sdk/documents#metadata-cloud) | — | ✓ |
+| [Folders](https://docs.pageindex.ai/sdk/documents#folders-cloud) | — | ✓ |
+| [MCP server](https://docs.pageindex.ai/mcp) | — | ✓ |
 
 ### More About PageIndex Cloud
 
```

**File**: `assets/vectorless-rag-dark.svg` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 744" width="1600" height="744" role="img" aria-labelledby="title desc">
+  <title id="title">Vectorless RAG with PageIndex</title>
+  <desc id="desc">A document is turned into a tree, then an LLM reasons over it to answer a query.</desc>
+  <style>
+    text { font-family: Arial, Helvetica, sans-serif; }
+    .steel { stroke: #8ea2bf; color: #8ea2bf; }
+    .muted { stroke: #929292; }
+    .blue { stroke: #2f87d7; }
+    .line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
+  </style>
+  <defs>
+    <marker id="arrowSteel" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
+      <path d="M0 0 10 5 0 10Z" fill="#8ea2bf"/>
+    </marker>
+    <marker id="arrowBlue" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#2f87d7"/>
+    </marker>
+  </defs>
+
+  <!-- Heading -->
+  <text x="356" y="104" fill="#8ea2bf" font-size="62" font-weight="400" letter-spacing=".3">Vectorless RAG with <tspan fill="#2f87d7" font-weight="700">PageIndex</tspan></text>
+
+  <!-- Dashed system boundary -->
+  <rect x="305" y="160" width="1014" height="527" rx="70" fill="none" stroke="#8ea2bf" stroke-width="9" stroke-dasharray="27 24"/>
+
+  <!-- Document icon and incoming arrow -->
+  <g class="line steel" stroke-width="5">
+    <path d="M75 397h65l40 40v78a14 14 0 0 1-14 14H88a14 14 0 0 1-14-14V411a14 14 0 0 1 14-14Z"/>
+    <path d="M140 398v39h39"/>
+    <path d="M100 442h14M100 468h53M100 494h53"/>
+    <path d="M210 466h194" marker-end="url(#arrowSteel)"/>
+  </g>
+
+  <!-- Tree -->
+  <text x="455" y="279" fill="#8ea2bf" font-size="46">Tree Index</text>
+  <g class="line muted" stroke-width="2.2">
+    <path d="M565 347 494 415M565 347v67M565 347l70 68"/>
+    <path d="M494 434 454 493M565 434l-32 59M565 434l29 59M635 434l40 59"/>
+    <path d="M454 516l-33 59M454 516l35 59M594 516l-33 59M594 516l35 59M675 516l34 59"/>
+    <circle cx="565" cy="334" r="19" fill="#000"/>
+    <circle cx="494" cy="421" r="19" fill="#000"/>
+    <circle cx="565" cy="421" r="19" fill="#000"/>
+    <circle cx="635" cy="421" r="19" fill="#000"/>
+    <circle cx="454" cy="506" r="19" fill="#000"/>
+    <circle cx="533" cy="506" r="19" fill="#000"/>
+    <circle cx="594" cy="506" r="19" fill="#000"/>
+    <circle cx="675" cy="506" r="19" fill="#000"/>
+    <circle cx="421" cy="575" r="4.8" fill="#929292" stroke="none"/>
+    <circle cx="489" cy="575" r="4.8" fill="#929292" stroke="none"/>
+    <circle cx="561" cy="575" r="4.8" fill="#929292" stroke="none"/>
+    <circle cx="629" cy="575" r="4.8" fill="#929292" stroke="none"/>
+    <circle cx="709" cy="575" r="4.8" fill="#929292" stroke="none"/>
+  </g>
+
+  <!-- Tree to reasoning arrow -->
+  <path d="M713 463h168" fill="none" stroke="#8ea2bf" stroke-width="5" marker-end="url(#arrowSteel)"/>
+
+  <!-- Reasoning panel -->
+  <text x="918" y="275" fill="#8ea2bf" font-size="46">Tree Search</text>
+  <rect x="902" y="315" width="292" height="292" rx="24" fill="#000" stroke="#8ea2bf" stroke-width="2.8"/>
+  <g class="line muted" stroke-width="2.2">
+    <path d="M965 327l-16 39M1029 327l-14 39M1074 327l10 39M1163 327l-15 39"/>
+    <path d="M949 398l-31 59M949 398l30 63M1084 399l42 62"/>
+    <path d="M979 493l-38 51M979 493l33 52"/>
+    <circle cx="949" cy="380" r="20" fill="#000"/>
+    <circle cx="1019" cy="380" r="20" fill="#000"/>
+    <circle cx="1084" cy="380" r="20" fill="#000"/>
+    <circle cx="1151" cy="380" r="20" fill="#000"/>
+    <circle cx="979" cy="475" r="20" fill="#000"/>
+    <circle cx="1125" cy="475" r="20" fill="#000"/>
+    <circle cx="918" cy="457" r="5" fill="#929292" stroke="none"/>
+    <circle cx="941" cy="544" r="5" fill="#929292" stroke="none"/>
+    <circle cx="1012" cy="544" r="5" fill="#929292" stroke="none"/>
+  </g>
+  <g class="line blue" stroke-width="5.5">
+    <path d="M1074 328l10 32"/>
+    <circle cx="1084" cy="380" r="20" fill="#000"/>
+    <path d="M1078 400l-27 56"/>
+    <circle cx="1050" cy="475" r="20" fill="#000"/>
+    <path d="M1056 495l26 53" marker-end="url(#arrowBlue)"/>
+  </g>
+  <circle cx="1086" cy="570" r="22" fill="#2f87d7"/>
+
+  <!-- Query and answer -->
+  <path d="M1412 379H1216" fill="none" stroke="#8ea2bf" stroke-width="5" marker-end="url(#arrowSteel)"/>
+  <text x="1434" y="393" fill="#8ea2bf" font-size="46">Query</text>
+  <path d="M1216 559h198" fill="none" stroke="#8ea2bf" stroke-width="5" marker-end="url(#arrowSteel)"/>
+  <text x="1434" y="572" fill="#8ea2bf" font-size="46">Answer</text>
+</svg>
```

**File**: `assets/vectorless-rag-light.svg` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 744" width="1600" height="744" role="img" aria-labelledby="title desc">
+  <title id="title">Vectorless RAG with PageIndex</title>
+  <desc id="desc">A document is turned into a tree, then an LLM reasons over it to answer a query.</desc>
+  <style>
+    text { font-family: Arial, Helvetica, sans-serif; }
+    .steel { stroke: #53657d; color: #53657d; }
+    .muted { stroke: #707782; }
+    .blue { stroke: #2f87d7; }
+    .line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
+  </style>
+  <defs>
+    <marker id="arrowSteel" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
+      <path d="M0 0 10 5 0 10Z" fill="#53657d"/>
+    </marker>
+    <marker id="arrowBlue" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#2f87d7"/>
+    </marker>
+  </defs>
+
+  <!-- Heading -->
+  <text x="356" y="104" fill="#53657d" font-size="62" font-weight="400" letter-spacing=".3">Vectorless RAG with <tspan fill="#2f87d7" font-weight="700">PageIndex</tspan></text>
+
+  <!-- Dashed system boundary -->
+  <rect x="305" y="160" width="1014" height="527" rx="70" fill="none" stroke="#53657d" stroke-width="9" stroke-dasharray="27 24"/>
+
+  <!-- Document icon and incoming arrow -->
+  <g class="line steel" stroke-width="5">
+    <path d="M75 397h65l40 40v78a14 14 0 0 1-14 14H88a14 14 0 0 1-14-14V411a14 14 0 0 1 14-14Z"/>
+    <path d="M140 398v39h39"/>
+    <path d="M100 442h14M100 468h53M100 494h53"/>
+    <path d="M210 466h194" marker-end="url(#arrowSteel)"/>
+  </g>
+
+  <!-- Tree -->
+  <text x="455" y="279" fill="#53657d" font-size="46">Tree Index</text>
+  <g class="line muted" stroke-width="2.2">
+    <path d="M565 347 494 415M565 347v67M565 347l70 68"/>
+    <path d="M494 434 454 493M565 434l-32 59M565 434l29 59M635 434l40 59"/>
+    <path d="M454 516l-33 59M454 516l35 59M594 516l-33 59M594 516l35 59M675 516l34 59"/>
+    <circle cx="565" cy="334" r="19" fill="#fff"/>
+    <circle cx="494" cy="421" r="19" fill="#fff"/>
+    <circle cx="565" cy="421" r="19" fill="#fff"/>
+    <circle cx="635" cy="421" r="19" fill="#fff"/>
+    <circle cx="454" cy="506" r="19" fill="#fff"/>
+    <circle cx="533" cy="506" r="19" fill="#fff"/>
+    <circle cx="594" cy="506" r="19" fill="#fff"/>
+    <circle cx="675" cy="506" r="19" fill="#fff"/>
+    <circle cx="421" cy="575" r="4.8" fill="#707782" stroke="none"/>
+    <circle cx="489" cy="575" r="4.8" fill="#707782" stroke="none"/>
+    <circle cx="561" cy="575" r="4.8" fill="#707782" stroke="none"/>
+    <circle cx="629" cy="575" r="4.8" fill="#707782" stroke="none"/>
+    <circle cx="709" cy="575" r="4.8" fill="#707782" stroke="none"/>
+  </g>
+
+  <!-- Tree to reasoning arrow -->
+  <path d="M713 463h168" fill="none" stroke="#53657d" stroke-width="5" marker-end="url(#arrowSteel)"/>
+
+  <!-- Reasoning panel -->
+  <text x="918" y="275" fill="#53657d" font-size="46">Tree Search</text>
+  <rect x="902" y="315" width="292" height="292" rx="24" fill="#fff" stroke="#53657d" stroke-width="2.8"/>
+  <g class="line muted" stroke-width="2.2">
+    <path d="M965 327l-16 39M1029 327l-14 39M1074 327l10 39M1163 327l-15 39"/>
+    <path d="M949 398l-31 59M949 398l30 63M1084 399l42 62"/>
+    <path d="M979 493l-38 51M979 493l33 52"/>
+    <circle cx="949" cy="380" r="20" fill="#fff"/>
+    <circle cx="1019" cy="380" r="20" fill="#fff"/>
+    <circle cx="1084" cy="380" r="20" fill="#fff"/>
+    <circle cx="1151" cy="380" r="20" fill="#fff"/>
+    <circle cx="979" cy="475" r="20" fill="#fff"/>
+    <circle cx="1125" cy="475" r="20" fill="#fff"/>
+    <circle cx="918" cy="457" r="5" fill="#707782" stroke="none"/>
+    <circle cx="941" cy="544" r="5" fill="#707782" stroke="none"/>
+    <circle cx="1012" cy="544" r="5" fill="#707782" stroke="none"/>
+  </g>
+  <g class="line blue" stroke-width="5.5">
+    <path d="M1074 328l10 32"/>
+    <circle cx="1084" cy="380" r="20" fill="#fff"/>
+    <path d="M1078 400l-27 56"/>
+    <circle cx="1050" cy="475" r="20" fill="#fff"/>
+    <path d="M1056 495l26 53" marker-end="url(#arrowBlue)"/>
+  </g>
+  <circle cx="1086" cy="570" r="22" fill="#2f87d7"/>
+
+  <!-- Query and answer -->
+  <path d="M1412 379H1216" fill="none" stroke="#53657d" stroke-width="5" marker-end="url(#arrowSteel)"/>
+  <text x="1434" y="393" fill="#53657d" font-size="46">Query</text>
+  <path d="M1216 559h198" fill="none" stroke="#53657d" stroke-width="5" marker-end="url(#arrowSteel)"/>
+  <text x="1434" y="572" fill="#53657d" font-size="46">Answer</text>
+</svg>
```

---

### Incident Patch 14: `f6a95fba` (2026-09-15)
**Commit Message**: fix table comparison

**File**: `README.md` (modified, +9/-9)
```diff
@@ -196,16 +196,16 @@ doc_id = client.submit_document("report.pdf", wait=True)["doc_id"]
 print(client.chat("What was the 2023 operating margin?", doc_id=doc_id))
 ```
 
-| Capability | **Local** (this repo) | **Cloud** ([get an API key](https://developer.pageindex.ai/)) |
+| | **Local** | **Cloud** |
 |---|---|---|
-| Best for | text-heavy PDFs and local workflows | scanned, image-heavy, and large document collections |
-| Indexing | runs locally | runs in PageIndex Cloud, with production OCR and image understanding |
-| Storage | local | managed in PageIndex Cloud |
-| Chat model | your model | your model, or the managed chat included with your key |
-| Citations | page-level | line-level |
-| Image understanding | — | ✅ |
-| Multi-document scale | manual | PageIndex File System |
-| MCP server | — | ✅ |
+| Handles | Text-based PDFs | Text-based, scanned, and image-rich documents |
+| Indexing | On your machine | Managed by PageIndex |
+| Storage | Local directory | Cloud storage |
+| Citations | Page-level | Line-level |
+| OCR & image understanding | — | ✓ |
+| [Metadata](https://docs.pageindex.ai/sdk/documents#metadata-cloud) | — | ✓ |
+| [Folders](https://docs.pageindex.ai/sdk/documents#folders-cloud) | — | ✓ |
+| [MCP server](https://docs.pageindex.ai/mcp) | — | ✓ |
 
 ### More About PageIndex Cloud
 
```

**File**: `assets/vectorless-rag-dark.svg` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 744" width="1600" height="744" role="img" aria-labelledby="title desc">
+  <title id="title">Vectorless RAG with PageIndex</title>
+  <desc id="desc">A document is turned into a tree, then an LLM reasons over it to answer a query.</desc>
+  <style>
+    text { font-family: Arial, Helvetica, sans-serif; }
+    .steel { stroke: #8ea2bf; color: #8ea2bf; }
+    .muted { stroke: #929292; }
+    .blue { stroke: #2f87d7; }
+    .line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
+  </style>
+  <defs>
+    <marker id="arrowSteel" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
+      <path d="M0 0 10 5 0 10Z" fill="#8ea2bf"/>
+    </marker>
+    <marker id="arrowBlue" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#2f87d7"/>
+    </marker>
+  </defs>
+
+  <!-- Heading -->
+  <text x="356" y="104" fill="#8ea2bf" font-size="62" font-weight="400" letter-spacing=".3">Vectorless RAG with <tspan fill="#2f87d7" font-weight="700">PageIndex</tspan></text>
+
+  <!-- Dashed system boundary -->
+  <rect x="305" y="160" width="1014" height="527" rx="70" fill="none" stroke="#8ea2bf" stroke-width="9" stroke-dasharray="27 24"/>
+
+  <!-- Document icon and incoming arrow -->
+  <g class="line steel" stroke-width="5">
+    <path d="M75 397h65l40 40v78a14 14 0 0 1-14 14H88a14 14 0 0 1-14-14V411a14 14 0 0 1 14-14Z"/>
+    <path d="M140 398v39h39"/>
+    <path d="M100 442h14M100 468h53M100 494h53"/>
+    <path d="M210 466h194" marker-end="url(#arrowSteel)"/>
+  </g>
+
+  <!-- Tree -->
+  <text x="455" y="279" fill="#8ea2bf" font-size="46">Tree Index</text>
+  <g class="line muted" stroke-width="2.2">
+    <path d="M565 347 494 415M565 347v67M565 347l70 68"/>
+    <path d="M494 434 454 493M565 434l-32 59M565 434l29 59M635 434l40 59"/>
+    <path d="M454 516l-33 59M454 516l35 59M594 516l-33 59M594 516l35 59M675 516l34 59"/>
+    <circle cx="565" cy="334" r="19" fill="#000"/>
+    <circle cx="494" cy="421" r="19" fill="#000"/>
+    <circle cx="565" cy="421" r="19" fill="#000"/>
+    <circle cx="635" cy="421" r="19" fill="#000"/>
+    <circle cx="454" cy="506" r="19" fill="#000"/>
+    <circle cx="533" cy="506" r="19" fill="#000"/>
+    <circle cx="594" cy="506" r="19" fill="#000"/>
+    <circle cx="675" cy="506" r="19" fill="#000"/>
+    <circle cx="421" cy="575" r="4.8" fill="#929292" stroke="none"/>
+    <circle cx="489" cy="575" r="4.8" fill="#929292" stroke="none"/>
+    <circle cx="561" cy="575" r="4.8" fill="#929292" stroke="none"/>
+    <circle cx="629" cy="575" r="4.8" fill="#929292" stroke="none"/>
+    <circle cx="709" cy="575" r="4.8" fill="#929292" stroke="none"/>
+  </g>
+
+  <!-- Tree to reasoning arrow -->
+  <path d="M713 463h168" fill="none" stroke="#8ea2bf" stroke-width="5" marker-end="url(#arrowSteel)"/>
+
+  <!-- Reasoning panel -->
+  <text x="918" y="275" fill="#8ea2bf" font-size="46">Tree Search</text>
+  <rect x="902" y="315" width="292" height="292" rx="24" fill="#000" stroke="#8ea2bf" stroke-width="2.8"/>
+  <g class="line muted" stroke-width="2.2">
+    <path d="M965 327l-16 39M1029 327l-14 39M1074 327l10 39M1163 327l-15 39"/>
+    <path d="M949 398l-31 59M949 398l30 63M1084 399l42 62"/>
+    <path d="M979 493l-38 51M979 493l33 52"/>
+    <circle cx="949" cy="380" r="20" fill="#000"/>
+    <circle cx="1019" cy="380" r="20" fill="#000"/>
+    <circle cx="1084" cy="380" r="20" fill="#000"/>
+    <circle cx="1151" cy="380" r="20" fill="#000"/>
+    <circle cx="979" cy="475" r="20" fill="#000"/>
+    <circle cx="1125" cy="475" r="20" fill="#000"/>
+    <circle cx="918" cy="457" r="5" fill="#929292" stroke="none"/>
+    <circle cx="941" cy="544" r="5" fill="#929292" stroke="none"/>
+    <circle cx="1012" cy="544" r="5" fill="#929292" stroke="none"/>
+  </g>
+  <g class="line blue" stroke-width="5.5">
+    <path d="M1074 328l10 32"/>
+    <circle cx="1084" cy="380" r="20" fill="#000"/>
+    <path d="M1078 400l-27 56"/>
+    <circle cx="1050" cy="475" r="20" fill="#000"/>
+    <path d="M1056 495l26 53" marker-end="url(#arrowBlue)"/>
+  </g>
+  <circle cx="1086" cy="570" r="22" fill="#2f87d7"/>
+
+  <!-- Query and answer -->
+  <path d="M1412 379H1216" fill="none" stroke="#8ea2bf" stroke-width="5" marker-end="url(#arrowSteel)"/>
+  <text x="1434" y="393" fill="#8ea2bf" font-size="46">Query</text>
+  <path d="M1216 559h198" fill="none" stroke="#8ea2bf" stroke-width="5" marker-end="url(#arrowSteel)"/>
+  <text x="1434" y="572" fill="#8ea2bf" font-size="46">Answer</text>
+</svg>
```

**File**: `assets/vectorless-rag-light.svg` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 744" width="1600" height="744" role="img" aria-labelledby="title desc">
+  <title id="title">Vectorless RAG with PageIndex</title>
+  <desc id="desc">A document is turned into a tree, then an LLM reasons over it to answer a query.</desc>
+  <style>
+    text { font-family: Arial, Helvetica, sans-serif; }
+    .steel { stroke: #53657d; color: #53657d; }
+    .muted { stroke: #707782; }
+    .blue { stroke: #2f87d7; }
+    .line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
+  </style>
+  <defs>
+    <marker id="arrowSteel" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
+      <path d="M0 0 10 5 0 10Z" fill="#53657d"/>
+    </marker>
+    <marker id="arrowBlue" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#2f87d7"/>
+    </marker>
+  </defs>
+
+  <!-- Heading -->
+  <text x="356" y="104" fill="#53657d" font-size="62" font-weight="400" letter-spacing=".3">Vectorless RAG with <tspan fill="#2f87d7" font-weight="700">PageIndex</tspan></text>
+
+  <!-- Dashed system boundary -->
+  <rect x="305" y="160" width="1014" height="527" rx="70" fill="none" stroke="#53657d" stroke-width="9" stroke-dasharray="27 24"/>
+
+  <!-- Document icon and incoming arrow -->
+  <g class="line steel" stroke-width="5">
+    <path d="M75 397h65l40 40v78a14 14 0 0 1-14 14H88a14 14 0 0 1-14-14V411a14 14 0 0 1 14-14Z"/>
+    <path d="M140 398v39h39"/>
+    <path d="M100 442h14M100 468h53M100 494h53"/>
+    <path d="M210 466h194" marker-end="url(#arrowSteel)"/>
+  </g>
+
+  <!-- Tree -->
+  <text x="455" y="279" fill="#53657d" font-size="46">Tree Index</text>
+  <g class="line muted" stroke-width="2.2">
+    <path d="M565 347 494 415M565 347v67M565 347l70 68"/>
+    <path d="M494 434 454 493M565 434l-32 59M565 434l29 59M635 434l40 59"/>
+    <path d="M454 516l-33 59M454 516l35 59M594 516l-33 59M594 516l35 59M675 516l34 59"/>
+    <circle cx="565" cy="334" r="19" fill="#fff"/>
+    <circle cx="494" cy="421" r="19" fill="#fff"/>
+    <circle cx="565" cy="421" r="19" fill="#fff"/>
+    <circle cx="635" cy="421" r="19" fill="#fff"/>
+    <circle cx="454" cy="506" r="19" fill="#fff"/>
+    <circle cx="533" cy="506" r="19" fill="#fff"/>
+    <circle cx="594" cy="506" r="19" fill="#fff"/>
+    <circle cx="675" cy="506" r="19" fill="#fff"/>
+    <circle cx="421" cy="575" r="4.8" fill="#707782" stroke="none"/>
+    <circle cx="489" cy="575" r="4.8" fill="#707782" stroke="none"/>
+    <circle cx="561" cy="575" r="4.8" fill="#707782" stroke="none"/>
+    <circle cx="629" cy="575" r="4.8" fill="#707782" stroke="none"/>
+    <circle cx="709" cy="575" r="4.8" fill="#707782" stroke="none"/>
+  </g>
+
+  <!-- Tree to reasoning arrow -->
+  <path d="M713 463h168" fill="none" stroke="#53657d" stroke-width="5" marker-end="url(#arrowSteel)"/>
+
+  <!-- Reasoning panel -->
+  <text x="918" y="275" fill="#53657d" font-size="46">Tree Search</text>
+  <rect x="902" y="315" width="292" height="292" rx="24" fill="#fff" stroke="#53657d" stroke-width="2.8"/>
+  <g class="line muted" stroke-width="2.2">
+    <path d="M965 327l-16 39M1029 327l-14 39M1074 327l10 39M1163 327l-15 39"/>
+    <path d="M949 398l-31 59M949 398l30 63M1084 399l42 62"/>
+    <path d="M979 493l-38 51M979 493l33 52"/>
+    <circle cx="949" cy="380" r="20" fill="#fff"/>
+    <circle cx="1019" cy="380" r="20" fill="#fff"/>
+    <circle cx="1084" cy="380" r="20" fill="#fff"/>
+    <circle cx="1151" cy="380" r="20" fill="#fff"/>
+    <circle cx="979" cy="475" r="20" fill="#fff"/>
+    <circle cx="1125" cy="475" r="20" fill="#fff"/>
+    <circle cx="918" cy="457" r="5" fill="#707782" stroke="none"/>
+    <circle cx="941" cy="544" r="5" fill="#707782" stroke="none"/>
+    <circle cx="1012" cy="544" r="5" fill="#707782" stroke="none"/>
+  </g>
+  <g class="line blue" stroke-width="5.5">
+    <path d="M1074 328l10 32"/>
+    <circle cx="1084" cy="380" r="20" fill="#fff"/>
+    <path d="M1078 400l-27 56"/>
+    <circle cx="1050" cy="475" r="20" fill="#fff"/>
+    <path d="M1056 495l26 53" marker-end="url(#arrowBlue)"/>
+  </g>
+  <circle cx="1086" cy="570" r="22" fill="#2f87d7"/>
+
+  <!-- Query and answer -->
+  <path d="M1412 379H1216" fill="none" stroke="#53657d" stroke-width="5" marker-end="url(#arrowSteel)"/>
+  <text x="1434" y="393" fill="#53657d" font-size="46">Query</text>
+  <path d="M1216 559h198" fill="none" stroke="#53657d" stroke-width="5" marker-end="url(#arrowSteel)"/>
+  <text x="1434" y="572" fill="#53657d" font-size="46">Answer</text>
+</svg>
```

---

### Incident Patch 15: `3ffb74cb` (2026-09-07)
**Commit Message**: Fix contact link and clean up README

Updated contact link for dedicated deployment and removed social media section.

**File**: `README.md` (modified, +3/-12)
```diff
@@ -217,7 +217,7 @@ print(client.chat("What was the 2023 operating margin?", doc_id=doc_id))
 - Get a [PageIndex API key](https://developer.pageindex.ai/)
 - Read the [PageIndex Cloud documentation](https://docs.pageindex.ai/)
 
-For dedicated deployment (VPC or on-premises), [contact us](https://ii2abc2jejf.typeform.com/to/gVv7qkaN) or [book a demo](https://calendly.com/pageindex/meet).
+For dedicated deployment (VPC or on-premises), [contact us](https://pageindex.ai/contact) or [book a demo](https://calendly.com/pageindex/meet).
 
 
 
@@ -254,19 +254,10 @@ PageIndex Blog, Sep 2025.
 </details>
 
 
-### Connect with Us
 
-<div align="center">
-
-[![Website](https://img.shields.io/badge/Website-2D72CF?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDEgMSAxMWgyLjV2MTJoNnYtN2g1djdoNlYxMUgyM3oiLz48L3N2Zz4%3D)](https://pageindex.ai)&nbsp;
-[![Twitter](https://img.shields.io/badge/Twitter-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/PageIndexAI)&nbsp;
-[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTIwLjQ1IDIwLjQ1aC0zLjU1di01LjU3YzAtMS4zMy0uMDMtMy4wNC0xLjg1LTMuMDQtMS44NSAwLTIuMTQgMS40NS0yLjE0IDIuOTR2NS42N0g5LjM1VjloMy40MXYxLjU2aC4wNWMuNDgtLjkgMS42NC0xLjg1IDMuMzctMS44NSAzLjYgMCA0LjI3IDIuMzcgNC4yNyA1LjQ2djYuMjh6TTUuMzQgNy40M2EyLjA2IDIuMDYgMCAxIDEgMC00LjEzIDIuMDYgMi4wNiAwIDAgMSAwIDQuMTN6TTcuMTIgMjAuNDVIMy41NlY5aDMuNTZ2MTEuNDV6TTIyLjIyIDBIMS43N0MuNzkgMCAwIC43NyAwIDEuNzN2MjAuNTRDMCAyMy4yMy43OSAyNCAxLjc3IDI0aDIwLjQ1QzIzLjIgMjQgMjQgMjMuMjMgMjQgMjIuMjdWMS43M0MyNCAuNzcgMjMuMiAwIDIyLjIyIDB6Ii8%2BPC9zdmc%2B)](https://www.linkedin.com/company/vectify-ai/)&nbsp;
-[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/invite/VuXuf29EUj)&nbsp;
-[![Book a Demo](https://img.shields.io/badge/Book_a_Demo-6E7E96?style=for-the-badge&logo=googlecalendar&logoColor=white)](https://calendly.com/pageindex/meet)&nbsp;
-[![Contact Us](https://img.shields.io/badge/Contact_Us-3B82F6?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjIgNCAyMCAxNiI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTIwIDRINGMtMS4xIDAtMiAuOS0yIDJ2MTJjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItMlY2YzAtMS4xLS45LTItMi0yem0wIDQtOCA1LTgtNVY2bDggNSA4LTV6Ii8%2BPC9zdmc%2B)](https://ii2abc2jejf.typeform.com/to/tK3AXl8T)
-
-</div>
 
 ---
 
 © 2026 [PageIndex AI](https://pageindex.ai)
+
+<img width="288" height="80" alt="pageindex-wordmark-animated-288-warm" src="https://github.com/user-attachments/assets/e1c677f2-b590-4ffc-859d-e8cc7d794bdf" />
```

#### Recent Merged Pull Requests:
- **PR #547** (2026-10-01): test: summary concurrency test waits for the expected overlap (@rejojer)
- **PR #542** (2026-10-01): feat(sdk): node navigation helpers get_node, get_node_parent, get_node_path, get_node_map (@rejojer)
- **PR #541** (2026-10-01): Unify the document tree across local and cloud (@rejojer)
- **PR #539** (2026-09-30): Restructure repo layout (@rejojer)
- **PR #538** (2026-09-29): ci(publish): gate releases on the live cloud tests again (@rejojer)
- **PR #537** (2026-09-28): ci(publish): run the release gate without the live cloud tests (@rejojer)
- **PR #533** (2026-09-21): fix(sdk): list_documents review followups (@rejojer)
- **PR #532** (closed): fix(sdk): list_documents review followups (@rejojer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
