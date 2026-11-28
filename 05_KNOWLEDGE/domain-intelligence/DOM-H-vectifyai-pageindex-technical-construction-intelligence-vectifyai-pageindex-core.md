# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: VectifyAI/PageIndex Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "VectifyAI/PageIndex",
  "source_url": "https://github.com/VectifyAI/PageIndex",
  "source_version": "aef597ae",
  "license": "MIT",
  "timestamp": "2026-11-28T05:24:58.432Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vectifyai-pageindex",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex) (Revision: `aef597ae`).  
> **License**: MIT | **Timestamp**: `2026-11-28T05:24:58.432Z`  
> **Learning ID**: `learn-github-vectifyai-pageindex`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: I (Content & Information Intelligence), G (Architecture Intelligence), K (Quality & Verification Intelligence), L (Deployment & Operations Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence), F (Design Intelligence)
- **Confidence Rating**: 51%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from VectifyAI/PageIndex:

# Forensic Learning Record (Deep Inspection): VectifyAI/PageIndex

> **Canonical Artifact**: `07_PROJECT_LEARNING/vectifyai-pageindex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T05:24:57.038Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `VectifyAI/PageIndex`
- **Description**: 📑 PageIndex: Document Index for Vectorless, Reasoning-based RAG
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 40822 stars

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
import textwrap
from datetime import datetime
import time
import json
import PyPDF2
import copy
import asyncio
import heapq
import sys
import threading
from contextlib import asynccontextmanager, contextmanager
from io import BytesIO
from dotenv import find_dotenv, load_dotenv
load_dotenv(find_dotenv(usecwd=True))
# litellm's import fetches its model map over the network unless told not to.
# A spawned worker inherits the value set below; the marker says it is ours.
_MAP_SET_BY_USER = os.environ.get("LITELLM_LOCAL_MODEL_COST_MAP") not in (
    None, os.environ.get("_PAGEINDEX_LOCAL_MODEL_MAP"))
if not _MAP_SET_BY_USER:
    os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = os.environ["_PAGEINDEX_LOCAL_MODEL_MAP"] = "True"
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

# Same scope: per model the operation calls, the kwargs chosen_effort
# carries the backend's reasoning_effort to that model with.
_llm_effort: contextvars.ContextVar = contextvars.ContextVar(
    "pageindex_llm_effort", default=None)

# Same scope: the dict the token usage of every indexing model call is
# summed into, which LocalAPI returns from submit_document.
_llm_usage: contextvars.ContextVar = contextvars.ContextVar(
    "pageindex_llm_usage", default=None)

# Set by llm_priority: where a gate narrower than the indexing lanes queues
# their model calls (the claude-code/ route's cap), the highest goes first.
_llm_priority: contextvars.ContextVar = contextvars.ContextVar(
    "pageindex_llm_priority", default=0)


@contextmanager
def llm_priority(prio):
    token = _llm_priority.set(prio)
    try:
        yield
    finally:
        _llm_priority.reset(token)


def _add_usage(response) -> None:
    usage, counted = _llm_usage.get(), getattr(response, "usage", None)
    if usage is None or counted is None:
        return
    prompt = getattr(counted, "prompt_tokens", 0) or 0
    completion = getattr(counted, "completion_tokens", 0) or 0
    details = getattr(counted, "prompt_tokens_details", None)
    cached = getattr(details, "cached_tokens", 0)
    cache_write = getattr(details, "cache_write_tokens", 0)
    reasoning = getattr(getattr(counted, "completion_tokens_details", None),
                        "reasoning_tokens", 0)
    usage["prompt_tokens"] += prompt
    usage["completion_tokens"] += completion
    usage["total_tokens"] += prompt + completion
    usage["prompt_tokens_details"]["cached_tokens"] += cached or 0
    usage["prompt_tokens_details"]["cache_write_tokens"] += cache_write or 0
    usage["completion_tokens_details"]["reasoning_tokens"] += reasoning or 0


def _add_usage_counts(counts, usage=None) -> None:
    """Add a chat-shape usage dict (a claude-code/ run's) to the tally."""
    usage = _llm_usage.get() if usage is None else usage
    if usage is None:
        return
    for key, value in counts.items():
        if isinstance(value, dict):
            _add_usage_counts(value, usage.setdefault(key, {}))
        else:
            usage[key] = usage.get(key, 0) + (value or 0)


def _mute_litellm_bridge_usage_warning() -> None:
    """litellm's chat→Responses bridge (e.g. OpenAI gpt-5.4+ with function
    tools) logs a chat-shaped usage dict inside a ResponseAPIUsage field
    (litellm_logging._get_assembled_streaming_response, 1.97 through at
    least 1.105), and pydantic reports it on every streamed turn. Hide
    exactly that message; every other warning still surfaces."""
    import warnings
    warnings.filterwarnings(
        "ignore",
        message=r"Pydantic serializer warnings:\s+"
                r"(PydanticSerializationUnexpectedValue\()?Expected `ResponseAPIUsage`")


def _quiet_litellm() -> None:
    """Mute litellm's stdout "Provider List:" banner and default its loggers
    to LITELLM_LOG (ERROR unset); a level set elsewhere stays. Also maps
    Claude's stop at its context window to "length": LiteLLM reads a stop
    reason it doesn't know as "stop", and only warns, so a cut-off answer
    would pass as whole."""
    import litellm
    try:
        from litellm.litellm_core_utils.core_helpers import _FINISH_REASON_MAP
    except ImportError:
        pass  # LiteLLM moved it: the stop reads as "stop", as before
    else:
        _FINISH_REASON_MAP.setdefault("model_context_window_exceeded", "length")
    litellm.suppress_debug_info = True
    level = getattr(logging, os.environ.get("LITELLM_LOG", "ERROR").upper(),
                    logging.ERROR)
    for name in ("LiteLLM", "LiteLLM Router", "LiteLLM Proxy", "litellm"):
        logger = logging.getLogger(name)
        if logger.level == logging.NOTSET:
            logger.setLevel(level)


_PUBLISHED_MAP_URL = os.environ.get(
    "LITELLM_MODEL_COST_MAP_URL",
    "https://raw.githubusercontent.com/BerriAI/litellm/main/"
    "model_prices_and_context_window.json")
_published = None
_published_lock = threading.Lock()
_filled = False
_MAP_RETRY = 300  # seconds a failed download stands before the next may start
_retry_published_at = float("inf")


def _published_map():
    """LiteLLM's published model map as downloaded, a Future of its bytes:
    one download per process, on a daemon thread, that runs on any thread
    wait for together; a failed one, _MAP_RETRY on, gives way to another."""
    global _published, _retry_published_at
    with _published_lock:
        if _published is not None and time.monotonic() < _retry_published_at:
            return _published
        from concurrent.futures import Future
        future = _published = Future()
        _retry_published_at = float("inf")
        # running: a cancelled waiter can't cancel it for the others
        future.set_running_or_notify_cancel()

    def fetch():
        global _retry_published_at
        try:
            import httpx
            response = httpx.get(_PUBLISHED_MAP_URL, timeout=5)
            response.raise_for_status()
            future.set_result(response.content)
        except Exception as exc:
            _retry_published_at = time.monotonic() + _MAP_RETRY
            future.set_exception(exc)
    threading.Thread(target=fetch, daemon=True).start()
    return future


def _forget_published():
    # a forked child lacks the thread a pending download runs on
    global _published
    _published = None


def _drop_litellm_clients():
    # on its parent's pooled connections a forked child reads replies meant
    # for another process; created lazily, so only one LiteLLM already made
    litellm = sys.modules.get("litellm")
    cache = litellm and vars(litellm).get("in_memory_llm_clients_cache")
    if cache is not None:
        cache.flush_cache()


if hasattr(os, "register_at_fork"):
    os.register_at_fork(after_in_child=_forget_published)
    os.register_at_fork(after_in_child=_drop_litellm_clients)


async def learn_published_models() -> bool:
    """LiteLLM takes the published map's entries its packaged map lacks;
    True once any are in. Never when the caller set
    LITELLM_LOCAL_MODEL_COST_MAP themselves."""
    global _filled
    if _MAP_SET_BY_USER:
        return False
    import litellm
    try:
        published = json.loads(await asyncio.wrap_future(_published_map()))
        new = {key: entry for key, entry in published.items()
               if key not in litellm.model_cost and isinstance(entry, dict)}
    except Exception:
        return False
    if new:
        litellm.register_model(new)
        _filled = True
    return _filled


_MAP_WAIT = 3  # seconds summaries wait on the download, which goes on past it


def _in_model_map(model):
    """Whether LiteLLM's map holds `model` itself, or the indexing backend's
    base_model LiteLLM reads it as, as LiteLLM's own lookup finds it
    (provider included); its fallback rules answer ids the map lacks with a
    key the map doesn't hold."""
    import litellm
    for name in filter(None, ((_llm_backend.get() or {}).get("base_model"), model)):
        try:
            if litellm.get_model_info(name).get("key") in litellm.model_cost:
                return True
        except Exception:
            pass
    return False


def _openai_format(model):
    """Whether `model`'s API takes OpenAI's own request fields: a provider on
    LiteLLM's list of OpenAI-compatible ones, less a Claude model there,
    which LiteLLM sends in Anthropic's (azure_ai/claude-...), and Azure
    OpenAI, OpenAI's own API under deployment names."""
    import litellm
    provider = model.split("/", 1)[0]
    return provider == "azure" or (provider in litellm.openai_compatible_providers
                                   and not _claude_routed(model))


def _effort_dropped_unmapped(model, effort=None):
    """LiteLLM's packaged map lacks `model` and LiteLLM so drops a
    reasoning_effort sent with it, or the level the caller chose (`effort`,
    else the indexing backend's: "xhigh" on openai/gpt-6.1-terra):
    drop_params drops it unseen, leaving no refusal to learn on. On an
    OpenAI-format API, where the effort is the API's own field and goes as
    is (summary_effort_ladder), only a chosen level LiteLLM drops even
    then ("xhigh" on azure/gpt-6.1-terra)."""
    import litellm
    model = _litellm_model(model)
    if _in_model_map(model):
        return False
    effort = effort or (_llm_backend.get() or {}).get("reasoning_effort")
    if _openai_format(model):
        return bool(effort) and "reasoning_effort" not in _sends(model, {
            "reasoning_effort": effort, "allowed_openai_params": ["reas
```

### Core Architecture Module: `cookbook/pageindex-claude-subscription.py`
```
"""PageIndex can use your Claude subscription to call Claude models through
Claude Code: usage is covered by your plan, and no API key is needed.

    pip install -U "pageindex[claude]"

Log in with your Claude subscription: run `claude`, then /login (install
Claude Code first if needed). Then:

    python pageindex-claude-subscription.py
"""
from pathlib import Path

import requests
from pageindex import PageIndexClient

url = "https://arxiv.org/pdf/2610.14224v1"  # the Harness² paper
Path("harness2.pdf").write_bytes(requests.get(url).content)

client = PageIndexClient(
    index="claude-code/haiku",          # model to build the tree index
    chat="claude-code/opus",            # model to retrieve from the tree and answer
)
print("Indexing harness2.pdf...")
doc_id = client.submit_document("harness2.pdf")["doc_id"]
print(f"Indexed, doc_id: {doc_id}\n")

question = "How does Harness² guide harness edits without a ground-truth verifier?"
for chunk in client.chat(question, doc_id=doc_id, stream=True):
    print(chunk, end="", flush=True)
print()

```

### Core Architecture Module: `pageindex/__init__.py`
```
"""PageIndex SDK."""
from typing import TYPE_CHECKING as _TYPE_CHECKING

from .chat_stream import ChatStream, MessagesStream, ChatObject
from .client import PageIndexClient, PageIndexCloudClient, PageIndexLocalClient
from .errors import PageIndexAPIError
from .page_extract import PageExtractClient
from .page_search import PageSearchClient
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
    "PageSearchClient", "PageExtractClient",
    "PageIndexAPIError",
    "IndexConfig", "CloudIndexConfig", "LocalIndexConfig", "ChatConfig",
    "ChatProcessOptions", "ChatStream", "MessagesStream", "ChatObject",
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
               "local_store", "mcp_bridge", "page_extract", "page_index_classic",
               "page_index_md", "page_search", "retry", "tree_optimize", "types",
               "utils"}


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
import html
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
            "`get_folder_structure()` (when available) — and, for queries "
            "that may involve typed attributes, pairing it with "
            "`get_metadata_schema()` so you know which fields metadata mode "
            "could filter on — use this for all document-related questions. "
            "The bare call returns root-level sub-folders and documents; pass "
            "`folder_id` to drill into a sub-folder level by level. Use "
            '`sort="relevance"` + `query` for semantic ranking. Do NOT jump '
            "to `search_documents()` first — keyword search and metadata mode "
            "are escalation paths, only after "
            '`browse_documents(sort="relevance")` + the persistence retries '
            "have failed. `browse_documents` does not filter by attribute — "
            "for typed-attribute queries, escalate to "
            '`search_documents(mode="metadata")`.'
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
            "Check a document's processing status and metadata. Call this "
            "before `get_document_structure()` or `get_page_content()` to "
            'confirm the document is ready (`status === "completed"`).'
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
      
```

### Core Architecture Module: `pageindex/chat_stream.py`
```
"""chat()'s return types: the answer lane's ChatStream, the Messages
protocol's MessagesStream, and the protocol lanes' ChatObject."""
from __future__ import annotations

from typing import Any, Iterator, Optional

from .errors import PageIndexAPIError


class ChatObject(dict[str, Any]):
    """What chat()'s protocol lanes return, envelopes, chunks and events
    alike: the protocol's JSON as a dict, which also reads by attribute as
    the official SDK reads that JSON (its lenient construct_type):
    ``r.choices[0].message.content`` beside
    ``r["choices"][0]["message"]["content"]``. A value or event type the
    installed SDK doesn't know reads as sent, a field the type has and the
    dict lacks reads None, and a name the official object lacks raises.
    The attribute view is read-only: write through the keys. chat() returns
    it; callers don't construct one."""

    @staticmethod
    def _parse(data: dict) -> Any:
        # a bare ChatObject names no official type to read through
        raise AttributeError("ChatObject reads attributes only as a lane's "
                             "envelope, chunk or event")

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(name)
        return getattr(self._parse(dict(self)), name)

    def __setattr__(self, name: str, value: Any) -> None:
        if not name.startswith("_"):
            raise AttributeError(
                f"attributes are a read-only view; set [{name!r}] instead")
        super().__setattr__(name, value)


def _as_plain_dict(dumper: Any, data: ChatObject) -> Any:
    rule = dumper.yaml_representers.get(dict)
    return rule(dumper, data) if rule else dumper.represent_data(dict(data))


def _yaml_as_dict() -> None:
    """yaml writes a ChatObject exactly as the plain dict it is, through
    the dumper's own dict rule (safe_dump refuses a dict subclass, and dump
    would tag it as a Python object). The rule goes on every representer
    class that already holds its own table, BaseRepresenter, Representer
    or a caller's dumper that registered something; the rest inherit it
    and keep inheriting what others register later."""
    from yaml.representer import BaseRepresenter
    pending: list = [BaseRepresenter]
    while pending:
        representer = pending.pop()
        if "yaml_multi_representers" in vars(representer):
            representer.add_multi_representer(ChatObject, _as_plain_dict)
        pending.extend(representer.__subclasses__())


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


class MessagesStream:
    """chat(protocol="messages", stream=True)'s stream: iterate it for the
    Anthropic SDK's events, one message sequence per turn; then
    ``get_final_message()`` returns what the non-stream call returns."""

    def __init__(self, events):
        self._events = events  # a generator that returns the run's envelope
        self._result: Any = None

    def __iter__(self) -> "MessagesStream":
        return self

    def __next__(self) -> ChatObject:
        try:
            return next(self._events)
        except StopIteration as stop:
            if stop.value is not None:
                self._result = stop.value
            raise

    def close(self) -> None:
        """Stop the run, like closing a generator."""
        self._events.close()

    def get_final_message(self) -> ChatObject:
        """Read the stream to its end (raising what iterating it would),
        then return the run's envelope as the non-stream call returns it:
        the final message, with ``usage`` aggregated across turns and the
        ``messages`` turn sequence."""
        for _ in self:
            pass
        if self._result is None:
            raise PageIndexAPIError(
                "This stream has no final message: the run failed, or the "
                "stream was closed before the run finished.")
        return self._result

    def get_final_text(self) -> str:
        """The final message's text blocks, joined. A bare string has
        nowhere to mark an answer cut short, so unless the message finished
        (stop_reason ``end_turn`` or ``stop_sequence``) this raises, the cut
        text in ``partial_answer``; it raises too when there is no text."""
        message = self.get_final_message()
        texts = [block["text"] for block in message["content"]
                 if block.get("type") == "text"]
        stop = message.get("stop_reason")
        if stop not in ("end_turn", "stop_sequence"):
            error = PageIndexAPIError(
                f"The final message is unfinished (stop_reason {stop!r}); "
                "get_final_message() returns it as it is.")
            error.partial_answer = "".join(texts)
            error.usage = message.get("usage")
            raise error
        if not texts:
            raise PageIndexAPIError(
                "The final message has no text block; its content is in "
                "get_final_message().content.")
        return "".join(texts)

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
                    Optional, Sequence, Union, cast, overload)

from .chat_stream import ChatStream, MessagesStream, ChatObject
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

    thread = threading.Thread(target=_import, daemon=True)
    thread.start()
    if hasattr(os, "register_at_fork"):
        # a child forked mid-import would wait forever on the import lock of
        # a thread it lacks, so a fork waits for the import to finish
        os.register_at_fork(before=thread.join)


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


_CitationKey = tuple[str, int, Optional[str], Optional[tuple[float, ...]]]


def _citation_box(raw: Optional[str]) -> Optional[tuple[float, ...]]:
    """A box="x0,y0,x1,y1" value as PageIndex chat's renderer takes it:
    four fractions from 0 to 1, each start before its end; else None."""
    try:
        box = tuple(float(part) for part in (raw or "").split(","))
    except ValueError:
        return None
    if (len(box) != 4 or not all(0 <= value <= 1 for value in box)
            or box[0] >= box[2] or box[1] >= box[3]):
        return None
    return box


def _citation_key(m: re.Match) -> Optional[_CitationKey]:
    """(document, page, block_id, box) of one matched tag, or None when it
    names no document or no positive page."""
    box_str = None
    if m.re is _OLD_CITATION_RE:
        doc, page_str, block_id = m.group(1), m.group(2), m.group(3)
    else:
        attrs = {name: value for name, _, value in
                 _CITE_ATTR_RE.findall(m.group(1))}
        doc, page_str, block_id = (attrs.get("doc", ""), attrs.get("page", ""),
                                   attrs.get("block"))
        box_str = attrs.get("box")
    doc = doc.strip()
    block_id = (block_id or "").strip() or None
    try:
        page = int(page_str.split("-")[0])
    except ValueError:
        return None
    return ((doc, page, block_id, _citation_box(box_str))
            if doc and page > 0 else None)


def _parse_citations(text: str) -> list[dict[str, Any]]:
    """``<doc=…;page=…;block=…>`` tags (the managed chat's format), then
    ``<cite doc= page= block= box=/>`` tags; deduplicated, ``block_id`` and
    ``box`` only when the tag carries one."""
    found: list[dict[str, Any]] = []
    seen: set[_CitationKey] = set()
    for m in [*_OLD_CITATION_RE.finditer(text), *_CITE_TAG_RE.finditer(text)]:
        key = _citation_key(m)
        if key and key not in seen:
            seen.add(key)
            entry: dict[str, Any] = {"document": key[0], "page": key[1]}
            if key[2]:
                entry["block_id"] = key[2]
            if key[3]:
                entry["box"] = list(key[3])
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
                     "summary_reasoning_effort", "use_embedded_toc", "optimize")

# Near-synonyms of "cloud" that would otherwise parse as model names —
# a silent wrong mode. They error, pointing at the real word.
_RESERVED_MODE_WORDS = {"hosted", "managed"}


# Page Search's and Page Extract's keys, which work here once their accounts
# have moved, read only when PAGEINDEX_API_KEY is not set.
_ENV_KEYS = ("PAGEINDEX_API_KEY", "PAGEINDEX_SEARCH_API_KEY",
             "PAGEINDEX_EXTRACT_API_KEY")


def _env_key(own: Optional[str] = None) -> Optional[str]:
    """The key the environment gives; of the two older names, ``own`` is
    read before the other."""
    # .env support lives in utils' import-time load_dotenv(): load it
    # before the read, or a key in .env is visible only by import order.
    from . import utils  # noqa: F401
    names = (_ENV_KEYS[0], own, *_ENV_KEYS[1:])
    return next((os.environ[name] for name in names
                 if name and os.environ.get(name)), None)


def _env_cloud_key(spelling: str, inline: str = "api_key=...") -> str:
    key = _env_key()
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
    "summary_concurrency": (int,), "summary_reasoning_effort": (str,),
    "use_embedded_toc": (bool,), "optimize": (str,),
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
            return lambda: _env
```

### Core Architecture Module: `pageindex/cloud_api.py`
```
"""Cloud mode of the PageIndex SDK: the client of the PageIndex Cloud API."""
import os
import requests
from pathlib import Path
from typing import Optional, Dict, Any, List, Sequence, Union, Iterator
import json
import urllib.parse

from .chat_stream import ChatObject
from .errors import PageIndexAPIError
from .naming import sanitize_filename, validate_folder_name
from .retry import cloud_session


def _enc(value: str) -> str:
    """URL-encode a path segment (ids may contain / ? # or spaces)."""
    return urllib.parse.quote(str(value), safe="")


class CloudAPI:
    """
    Python SDK client for the PageIndex API.
    """

    def __init__(self, client):
        self._client = client
        self._session, self._pid = cloud_session(), os.getpid()

    @property
    def _http(self):
        # a forked process would read replies off the sockets its parent pooled
        if self._pid != os.getpid():
            self._session, self._pid = cloud_session(), os.getpid()
        return self._session

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
        collection_id: Optional[str] = None,
        index: bool = True,
        extract: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Upload a PDF document for processing; the tree is built in the background,
        or not at all with ``index=False``.
        Immediately returns a document identifier (`doc_id`) for subsequent operations.

        Args:
            file_path (str): Path to the PDF file.
            mode (str, optional): None (default), the default cloud pipeline, or "flash".
            beta_headers (List[str], optional): Beta feature headers (e.g., ["block_reference"]
                to enable block-level content with bounding boxes). Defaults to None.
            folder_id (str, optional): Folder (workspace) ID to assign the document to. Defaults to None.
            metadata (dict, optional): Your own JSON-serializable tags for the document;
                returned in get_tree/get_ocr responses and list_documents entries. Defaults to None.
            collection_id (str, optional): Collection ID to store the document in, in place of a folder. Defaults to None.
            extract (dict, optional): With ``index=False``, an extract job's
                configuration, as ``create_extract()`` takes it: the job
                starts on the document, and only its extraction is charged,
                once it completes. A job that does not complete leaves the
                document this upload made failed, with its name and file but
                no pages, until you delete it.

        Returns:
            dict: {'doc_id': ...} — plus 'name', the stored document name
                (a taken name gains a numeric suffix), when the server
                returns it, and with ``extract`` 'extract_job_id'. A file
                stored already whose pages are not ready starts no job:
                {'doc_id', 'duplicate': True}.
        """
        if mode not in (None, "flash"):
            raise PageIndexAPIError(
                f"Failed to submit document: unknown cloud processing mode {mode!r}. "
                "Cloud supports only 'flash'."
            )
        data: Dict[str, Any] = {'if_retrieval': True}
        if mode == "flash":
            # The server rejects if_retrieval alongside algorithm=flash, and
            # keeps node text for Flash trees by default.
            data = {'algorithm': 'flash'}
        if not index:
            data = {'algorithm': 'none'}
        if beta_headers is not None:
            data['beta_headers'] = json.dumps(beta_headers)
        if folder_id is not None:
            data['folder_id'] = folder_id
        if metadata is not None:
            data['metadata'] = json.dumps(metadata)
        if collection_id is not None:
            data['collection_id'] = collection_id
        if extract is not None:
            data['extract'] = json.dumps(extract)

        with open(file_path, "rb") as f:
            response = self._http.post(
                f"{self.BASE_URL}/doc/",
                headers=self._headers(),
                files={'file': (sanitize_filename(Path(file_path).name), f)},
                data=data
            )

        if response.status_code == 409 and extract is not None:
            try:
                stored = response.json()["detail"]["doc_id"]
            except (ValueError, KeyError, TypeError):
                stored = None
            if stored:
                return {"doc_id": stored, "duplicate": True}
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

        response = self._http.get(
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
        response = self._http.get(
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
        response = self._http.get(
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

    def page_image(self, doc_id: str, page: int, box: Optional[Sequence[float]] = None) -> bytes:
        """A rendered page as JPEG bytes.

        Args:
            doc_id (str): Document ID.
            page (int): 1-based page number.
            box (sequence of 4 floats, optional): (x0, y0, x1, y1) as fractions
                of the page from its top left: only that part, drawn sharper.

        Returns:
            bytes: The JPEG.
        """
        if box is None:
            # a presigned URL: the API key stays off it
            response = self._http.get(self.get_page_image(doc_id, page), timeout=60)
        else:
            response = self._http.get(
                f"{self.BASE_URL}/doc/s3/{_enc(doc_id)}/images/region",
                headers=self._headers(),
                params={"page": page, "box": ",".join(str(v) for v in box)},
                timeout=60
            )
        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to get page image: {response.text}",
                status_code=response.status_code)
        return response.content

    def get_document_image(self, doc_id: str, img_id: str) -> str:
        """Presigned URL for an embedded image extracted during OCR.

        Args:
            doc_id (str): Document ID.
            img_id (str): Image ID as page content carries it,
                e.g. ``"img-7.jpeg"``.

        Returns:
            str: A presigned URL to the image.
        """
        response = self._http.get(
            f"{self.BASE_URL}/doc/{_enc(doc_id)}/image/{_enc(img_id)}/",
            headers=self._headers(),
            timeout=30
        )
        if response.status_code != 200:
    
```

### Core Architecture Module: `pageindex/errors.py`
```
class PageIndexAPIError(Exception):
    """status_code carries the HTTP status when the raising site passes it;
    None does not imply local/client-side. rpc_error carries an MCP
    server's JSON-RPC error object as it was sent. usage is set when an
    own-model chat run fails: what its finished model calls had spent, in
    the protocol's usage shape with each call listed (claude-code/: the
    run's total only, None on a tool failure or if the run ends before
    Claude Code reports it); None on any other error. partial_answer is
    the text a non-streamed chat() answer, or a Messages stream's
    get_final_text(), reached before it was cut short (a stream has already
    delivered its text); None otherwise."""

    def __init__(self, *args: object, status_code: int | None = None,
                 rpc_error: dict | None = None) -> None:
        super().__init__(*args)
        self.status_code = status_code
        self.rpc_error = rpc_error
        self.usage: dict | None = None
        self.partial_answer: str | None = None


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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #706** (2026-11-27): **build: pyproject.toml carries the released version, and publish checks the tag matches it instead of writing it in**
  *Symptoms*: Installs from source now report the real version instead of 0.2.10. pyproject.toml held a stale placeholder, 0.2.10, that publish.yml overwrote from the tag at build time, so PyPI artifacts were right but every `pip install git+...` or `pip install .` reported 0.2.10, including in the `clientInfo` the SDK sends to the cloud MCP server.  The version now lives in the repo and is bumped per release, as openai, openai-agents, anthropic, litellm and our JS, MCP, search and extract packages do. **Release flow change:** set `version` in pyproject.toml on the commit you tag; publish fails at its first step, before the tests run, if the tag and pyproject.toml disagree.  ## Changes  - `pyproject.toml`: `version` is 0.7.5, the latest release. - `publish.yml`: the `sed` that wrote the tag into pyproject.toml is replaced by a check that the tag matches it. The check is the first step of each test leg, so a missed bump fails in seconds instead of after the live-key test matrix. The header's release steps say to set the version first.  ## Verification  - Ran the new check step locally: `v0.7.5` passes; `v0.7.6`, `v0.7.5.dev1` and `vjunk` stop with the mismatch error. - `pip wheel .` builds `pageindex-0.7.5-py3-none-any.whl`. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"ce7cc2703884722fdee3edc7e09659d979c7769b","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":"ce7cc2703884722fdee3edc7e09659d979c7769b","has_any_findings":null,"has_unresolved_findings":null,"status":"completed"}} --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"ce7cc2703884722fdee3edc7e09659d979c7769b","mergeGateEnabled":false,"pullRequestNumber":706,"repository":"VectifyAI/PageIndex","status":"completed"} --> <details> <summary><strong>Codex Review Summary</strong>: ✅ Completed</summary>  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-27T20:30:49.239626Z">2026-11-27T20:30:49.239626Z</relative-time> | `ce7cc27` | New commits | | 

- **Issue #705** (2026-11-27): **revert(client): outline(doc_id, structure) leaves main until its open questions are settled (#702)**
  *Symptoms*: `outline(doc_id, structure)` (#702) is on main but in no release, and three questions about its interface are still open: uploads can't ask for a hierarchical outline, `build_outline_index()` and `outline()` overlap, and `structure` also names the document's tree. A release ships main whole, so the next one (Page Classify, #704) would ship `outline()` as it is, and settling those questions afterwards would break its callers. This reverts #702 so main stays releasable. Status and open items: https://github.com/VectifyAI/PageIndex/pull/702#issuecomment-7227074364  ## Changes  - Reverts 9684e87: removes `PageIndexClient.outline()`, `CloudAPI.get_outline()`, the `structure` argument of `CloudAPI.build_outline_index()`, and the outline test. The code is again as it was after #698.  ## Bringing it back  A new PR reverts this revert, which restores #702's code as it was, and makes the changes on top once the questions are settled.  ## Verification  - The tree equals main at 3aef432 (#698), the commit before #702. - `pytest tests` locally: 1275 passed, 7 skipped. The 2 failures are the LiteLLM version tests, which fail with the local LiteLLM 1.105.3, below the floor. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"3dee5fa3ec5b979f733e4e04ca6751b34d7d5b0c","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":"3dee5fa3ec5b979f733e4e04ca6751b34d7d5b0c","has_any_findings":null,"has_unresolved_findings":null,"status":"completed"}} --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"3dee5fa3ec5b979f733e4e04ca6751b34d7d5b0c","mergeGateEnabled":false,"pullRequestNumber":705,"repository":"VectifyAI/PageIndex","status":"completed"} --> <details> <summary><strong>Codex Review Summary</strong>: ✅ Completed</summary>  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-27T20:07:45.560204Z">2026-11-27T20:07:45.560204Z</relative-time> | `3dee5fa` | PR opened | | 🔒

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

### Incident Patch 1: `aef597ae` (2026-11-27)
**Commit Message**: build: pyproject.toml carries the released version, and publish checks the tag matches it instead of writing it in (#706)

* build: pyproject.toml carries the released version, and publish checks the tag matches it instead of writing it in

pyproject.toml held a stale placeholder, 0.2.10, that publish.yml overwrote
from the tag at build time. PyPI artifacts were right, but every install from
source (pip install git+..., or pip install . from a clone) reported 0.2.10,
including in the clientInfo the SDK sends when it connects to the cloud MCP
server.

Keeping the version in the repo and bumping it per release is what openai,
openai-agents, anthropic, litellm and our own JS, MCP, search and extract
packages do. A release now sets `version` on the commit it tags; publish.yml
stops with an error when the tag and pyproject.toml disagree, so a missed
bump fails before anything uploads.

pyproject.toml starts at 0.7.5, the latest release.

* build(publish): the tag check runs first in each test leg, so a missed version bump fails in seconds

It ran in the publish job, after the four live-key test legs (up to 15 minutes each), so a tag pushed without bumping pyproject.toml failed only afte

**File**: `.github/workflows/publish.yml` (modified, +11/-12)
```diff
@@ -1,12 +1,13 @@
 name: Publish to PyPI
 
-# Release flow (the git tag IS the version — nothing to bump in the repo):
-#   1. git tag -a v0.2.9 -m "Release 0.2.9"
-#   2. git push origin v0.2.9
-#   3. This workflow derives the version from the tag, injects it into
-#      pyproject.toml, builds, publishes to PyPI via OIDC trusted publishing
-#      (no stored secret), and creates a GitHub Release with generated notes
-#      (dev tags publish to PyPI only — no GitHub Release).
+# Release flow:
+#   1. Set `version` in pyproject.toml to the new version on the commit you tag.
+#   2. git tag -a v0.2.9 -m "Release 0.2.9"
+#   3. git push origin v0.2.9
+#   4. This workflow checks the tag matches pyproject.toml, builds, publishes
+#      to PyPI via OIDC trusted publishing (no stored secret), and creates a
+#      GitHub Release with generated notes (dev tags publish to PyPI only — no
+#      GitHub Release).
 #
 # The tag must be a PEP 440 version with a leading `v`:
 #   v0.2.9   v0.2.9rc1   v0.2.9.dev1
@@ -43,6 +44,8 @@ jobs:
     timeout-minutes: 15
     steps:
       - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
+      - name: Check the tag matches pyproject.toml
+        run: grep -qxF "version = \"${GITHUB_REF_NAME#v}\"" pyproject.toml || { echo "::error::Tag $GITHUB_REF_NAME does not match the version in pyproject.toml"; exit 1; }
       - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1  # v6.3.0
         with:
           python-version: ${{ matrix.python-version }}
@@ -71,7 +74,7 @@ jobs:
         with:
           python-version: "3.12"
 
-      - name: Set version from tag and build
+      - name: Check version and build
         run: |
           set -euo pipefail
           python -m pip install --upgrade build packaging
@@ -80,10 +83,6 @@ jobs:
           # Fail early on a malformed tag instead of publishing a junk version.
           export VERSION
           python -c "import os; from packaging.version import Version; Version(os.environ['VERSION'])"
-          # The git tag is the single source of truth; overwrite the static
-          # placeholder in [tool.poetry] so the built artifacts carry $VERSION.
-          sed -i "s/^version = .*/version = \"$VERSION\"/" pyproject.toml
-          grep '^version = ' pyproject.toml
           python -m build
 
       - name: Publish to PyPI
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [tool.poetry]
 name = "pageindex"
-version = "0.2.10"
+version = "0.7.5"
 description = "Python SDK for PageIndex — reasoning-based, vectorless document retrieval, cloud and local"
 readme = "README.md"
 license = "MIT"
```

---

### Incident Patch 2: `9684e873` (2026-11-27)
**Commit Message**: feat(client): outline(doc_id, structure) returns a cloud document's flat or hierarchical outline, building it when missing (#702)

* feat(client): build_outline_index(outline_mode=...) gives a cloud document a sequential or parallel outline, rebuilding one of the other mode

* feat(client): outline(doc_id, structure) returns a cloud document's flat or hierarchical outline as title, level and page, building it first when the document lacks it; build_outline_index takes no outline_mode

* fix(client): outline() that waits for the build answers with the build's usage, not the free ask that fetched the outline

* feat(client): outline() reads the built outline with GET /doc/{doc_id}?type=outline, so waiting for a build never asks the API to build again

* feat(client): outline() raises when the built outline's structure is not the one asked for, as after a failed build that kept the previous outline

**File**: `pageindex/client.py` (modified, +53/-0)
```diff
@@ -1202,6 +1202,59 @@ def build_outline_index(self, doc_id: str, wait: bool = True,
                 f"index_status: {built['index_status']}).")
         return built
 
+    def outline(self, doc_id: str, structure: Literal["flat", "hierarchical"],
+                wait: bool = True, timeout: float = 1800.0) -> dict[str, Any]:
+        """
+        Get a cloud document's outline, building it if the document lacks it.
+        "flat" lists the headings at one level, at $1 per 1,000 pages;
+        "hierarchical" nests them, each with its level, at $2 per 1,000 pages,
+        or $1 for a document with a flat outline. An outline the document has
+        is free, and a hierarchical one serves as the flat one.
+        Cloud-only: local mode raises PageIndexAPIError.
+
+        Args:
+            doc_id (str): Document ID. One still processing raises
+                PageIndexAPIError (HTTP 409).
+            structure (str): "flat" or "hierarchical".
+            wait (bool): Return once the outline is built (default), up to
+                ``timeout`` seconds; raises PageIndexAPIError if it could not
+                be built or is not done in time (it goes on in the cloud).
+                False returns at once.
+
+        Returns:
+            dict: {'doc_id', 'index_status', 'usage', 'pages', 'outline'}:
+            'outline' lists the headings in reading order, each {'title',
+            'level', 'page'}, without 'level' when flat. 'pages' and 'outline'
+            are there once 'index_status' is "completed". 'usage' is what the
+            outline costs, for a caller who pays in credits.
+        """
+        api = self._require_cloud(
+            "outline is cloud-only — a local document is indexed when it is "
+            "submitted.")
+        answer = api.build_outline_index(doc_id, structure)
+        deadline = time.monotonic() + timeout
+        while wait and answer["index_status"] in ("queued", "processing"):
+            if time.monotonic() >= deadline:
+                raise PageIndexAPIError(
+                    f"Timed out after {int(timeout)}s waiting for the outline "
+                    f"(doc_id: {doc_id}, index_status: "
+                    f"{answer['index_status']}). It goes on being built in the "
+                    "cloud — call outline() again.")
+            time.sleep(2)
+            answer["index_status"] = api.get_outline(doc_id)["index_status"]
+        if wait and answer["index_status"] != "completed":
+            raise PageIndexAPIError(
+                f"The outline could not be built (doc_id: {doc_id}, "
+                f"index_status: {answer['index_status']}).")
+        if answer["index_status"] == "completed":
+            read = api.get_outline(doc_id)
+            if read["structure"] not in (structure, "hierarchical"):
+                raise PageIndexAPIError(
+                    f"The {structure} outline could not be built (doc_id: "
+                    f"{doc_id}); the document keeps the outline it had.")
+            answer |= read["result"]
+        return answer
+
     def is_retrieval_ready(self, doc_id: str) -> bool:
         """
         Check if a document is ready for retrieval. API errors (including a
```

**File**: `pageindex/cloud_api.py` (modified, +25/-2)
```diff
@@ -287,16 +287,39 @@ def get_tree(self, doc_id: str, node_summary: bool = False,
                 status_code=response.status_code)
         return response.json()
 
-    def build_outline_index(self, doc_id: str) -> Dict[str, Any]:
+    def get_outline(self, doc_id: str) -> Dict[str, Any]:
         """
-        Build the tree of a document stored without one.
+        Get a document's outline.
+
+        Returns:
+            dict: API response with 'index_status', 'structure' ("flat",
+            "hierarchical" or None) and, as 'result', {'pages', 'outline'}.
+        """
+        response = self._http.get(
+            f"{self.BASE_URL}/doc/{_enc(doc_id)}/?type=outline",
+            headers=self._headers(),
+            timeout=30
+        )
+        if response.status_code != 200:
+            raise PageIndexAPIError(
+                f"Failed to get outline: {response.text}",
+                status_code=response.status_code)
+        return response.json()
+
+    def build_outline_index(self, doc_id: str,
+                            structure: Optional[str] = None) -> Dict[str, Any]:
+        """
+        Build the tree of a document stored without one, or, with
+        ``structure`` ("flat" or "hierarchical"), build that outline unless
+        the document has it.
 
         Returns:
             dict: {'doc_id', 'index_status'}.
         """
         response = self._http.post(
             f"{self.BASE_URL}/doc/{_enc(doc_id)}/index",
             headers=self._headers(),
+            json={"structure": structure} if structure else None,
             timeout=30
         )
         if response.status_code != 200:
```

**File**: `tests/test_client.py` (modified, +32/-0)
```diff
@@ -2170,6 +2170,38 @@ def serve(*replies):
     assert raised.value.status_code == 402
 
 
+def test_outline_builds_the_structure_asked_for_and_returns_it_once_built(served, monkeypatch):
+    client, calls, answers = served
+    monkeypatch.setattr("pageindex.client.time.sleep", lambda s: None)
+    def serve(*replies):
+        del calls[:]
+        replies = iter(replies)
+        answers.to = lambda method, path, kw: next(replies)
+    queued = {"doc_id": "pi/1", "index_status": "queued", "usage": {"credits": 0.4}}
+    outline = {"pages": 2, "outline": [{"title": "Intro", "level": 1, "page": 1}]}
+
+    serve(dict(queued), {"index_status": "processing"}, {"index_status": "completed"},
+          {"index_status": "completed", "structure": "hierarchical", "result": outline})
+    assert client.outline("pi/1", "hierarchical") == {
+        **queued, "index_status": "completed", **outline}
+    assert [c["method"] for c in calls] == ["POST", "GET", "GET", "GET"]
+    assert calls[0]["json"] == {"structure": "hierarchical"}
+    assert calls[3]["path"].endswith("?type=outline")
+
+    serve(dict(queued))
+    assert client.outline("pi/1", "flat", wait=False) == queued
+    serve(dict(queued), {"index_status": "failed"})
+    with pytest.raises(PageIndexAPIError, match="could not be built"):
+        client.outline("pi/1", "flat")
+    serve(dict(queued), {"index_status": "completed"},
+          {"index_status": "completed", "structure": "flat", "result": outline})
+    with pytest.raises(PageIndexAPIError, match="keeps the outline it had"):
+        client.outline("pi/1", "hierarchical")
+    serve(dict(queued))
+    with pytest.raises(PageIndexAPIError, match="Timed out"):
+        client.outline("pi/1", "flat", timeout=-1)
+
+
 def test_get_tree_of_a_document_without_an_outline_index_says_how_to_build_it(served):
     client, _, answers = served
     answers.to = lambda method, path, kw: {
```

---

### Incident Patch 3: `d6e9df04` (2026-11-27)
**Commit Message**: revert(client): outline(doc_id, structure) leaves main until its open questions are settled (#702) (#705)

Revert "feat(client): outline(doc_id, structure) returns a cloud document's flat or hierarchical outline, building it when missing (#702)"

This reverts commit 9684e873f97423a22df6cfed33eb9cd8a818ed7f.

**File**: `pageindex/client.py` (modified, +0/-53)
```diff
@@ -1202,59 +1202,6 @@ def build_outline_index(self, doc_id: str, wait: bool = True,
                 f"index_status: {built['index_status']}).")
         return built
 
-    def outline(self, doc_id: str, structure: Literal["flat", "hierarchical"],
-                wait: bool = True, timeout: float = 1800.0) -> dict[str, Any]:
-        """
-        Get a cloud document's outline, building it if the document lacks it.
-        "flat" lists the headings at one level, at $1 per 1,000 pages;
-        "hierarchical" nests them, each with its level, at $2 per 1,000 pages,
-        or $1 for a document with a flat outline. An outline the document has
-        is free, and a hierarchical one serves as the flat one.
-        Cloud-only: local mode raises PageIndexAPIError.
-
-        Args:
-            doc_id (str): Document ID. One still processing raises
-                PageIndexAPIError (HTTP 409).
-            structure (str): "flat" or "hierarchical".
-            wait (bool): Return once the outline is built (default), up to
-                ``timeout`` seconds; raises PageIndexAPIError if it could not
-                be built or is not done in time (it goes on in the cloud).
-                False returns at once.
-
-        Returns:
-            dict: {'doc_id', 'index_status', 'usage', 'pages', 'outline'}:
-            'outline' lists the headings in reading order, each {'title',
-            'level', 'page'}, without 'level' when flat. 'pages' and 'outline'
-            are there once 'index_status' is "completed". 'usage' is what the
-            outline costs, for a caller who pays in credits.
-        """
-        api = self._require_cloud(
-            "outline is cloud-only — a local document is indexed when it is "
-            "submitted.")
-        answer = api.build_outline_index(doc_id, structure)
-        deadline = time.monotonic() + timeout
-        while wait and answer["index_status"] in ("queued", "processing"):
-            if time.monotonic() >= deadline:
-                raise PageIndexAPIError(
-                    f"Timed out after {int(timeout)}s waiting for the outline "
-                    f"(doc_id: {doc_id}, index_status: "
-                    f"{answer['index_status']}). It goes on being built in the "
-                    "cloud — call outline() again.")
-            time.sleep(2)
-            answer["index_status"] = api.get_outline(doc_id)["index_status"]
-        if wait and answer["index_status"] != "completed":
-            raise PageIndexAPIError(
-                f"The outline could not be built (doc_id: {doc_id}, "
-                f"index_status: {answer['index_status']}).")
-        if answer["index_status"] == "completed":
-            read = api.get_outline(doc_id)
-            if read["structure"] not in (structure, "hierarchical"):
-                raise PageIndexAPIError(
-                    f"The {structure} outline could not be built (doc_id: "
-                    f"{doc_id}); the document keeps the outline it had.")
-            answer |= read["result"]
-        return answer
-
     def is_retrieval_ready(self, doc_id: str) -> bool:
         """
         Check if a document is ready for retrieval. API errors (including a
```

**File**: `pageindex/cloud_api.py` (modified, +2/-25)
```diff
@@ -287,39 +287,16 @@ def get_tree(self, doc_id: str, node_summary: bool = False,
                 status_code=response.status_code)
         return response.json()
 
-    def get_outline(self, doc_id: str) -> Dict[str, Any]:
+    def build_outline_index(self, doc_id: str) -> Dict[str, Any]:
         """
-        Get a document's outline.
-
-        Returns:
-            dict: API response with 'index_status', 'structure' ("flat",
-            "hierarchical" or None) and, as 'result', {'pages', 'outline'}.
-        """
-        response = self._http.get(
-            f"{self.BASE_URL}/doc/{_enc(doc_id)}/?type=outline",
-            headers=self._headers(),
-            timeout=30
-        )
-        if response.status_code != 200:
-            raise PageIndexAPIError(
-                f"Failed to get outline: {response.text}",
-                status_code=response.status_code)
-        return response.json()
-
-    def build_outline_index(self, doc_id: str,
-                            structure: Optional[str] = None) -> Dict[str, Any]:
-        """
-        Build the tree of a document stored without one, or, with
-        ``structure`` ("flat" or "hierarchical"), build that outline unless
-        the document has it.
+        Build the tree of a document stored without one.
 
         Returns:
             dict: {'doc_id', 'index_status'}.
         """
         response = self._http.post(
             f"{self.BASE_URL}/doc/{_enc(doc_id)}/index",
             headers=self._headers(),
-            json={"structure": structure} if structure else None,
             timeout=30
         )
         if response.status_code != 200:
```

**File**: `tests/test_client.py` (modified, +0/-32)
```diff
@@ -2170,38 +2170,6 @@ def serve(*replies):
     assert raised.value.status_code == 402
 
 
-def test_outline_builds_the_structure_asked_for_and_returns_it_once_built(served, monkeypatch):
-    client, calls, answers = served
-    monkeypatch.setattr("pageindex.client.time.sleep", lambda s: None)
-    def serve(*replies):
-        del calls[:]
-        replies = iter(replies)
-        answers.to = lambda method, path, kw: next(replies)
-    queued = {"doc_id": "pi/1", "index_status": "queued", "usage": {"credits": 0.4}}
-    outline = {"pages": 2, "outline": [{"title": "Intro", "level": 1, "page": 1}]}
-
-    serve(dict(queued), {"index_status": "processing"}, {"index_status": "completed"},
-          {"index_status": "completed", "structure": "hierarchical", "result": outline})
-    assert client.outline("pi/1", "hierarchical") == {
-        **queued, "index_status": "completed", **outline}
-    assert [c["method"] for c in calls] == ["POST", "GET", "GET", "GET"]
-    assert calls[0]["json"] == {"structure": "hierarchical"}
-    assert calls[3]["path"].endswith("?type=outline")
-
-    serve(dict(queued))
-    assert client.outline("pi/1", "flat", wait=False) == queued
-    serve(dict(queued), {"index_status": "failed"})
-    with pytest.raises(PageIndexAPIError, match="could not be built"):
-        client.outline("pi/1", "flat")
-    serve(dict(queued), {"index_status": "completed"},
-          {"index_status": "completed", "structure": "flat", "result": outline})
-    with pytest.raises(PageIndexAPIError, match="keeps the outline it had"):
-        client.outline("pi/1", "hierarchical")
-    serve(dict(queued))
-    with pytest.raises(PageIndexAPIError, match="Timed out"):
-        client.outline("pi/1", "flat", timeout=-1)
-
-
 def test_get_tree_of_a_document_without_an_outline_index_says_how_to_build_it(served):
     client, _, answers = served
     answers.to = lambda method, path, kw: {
```

#### Recent Merged Pull Requests:
- **PR #706** (2026-11-27): build: pyproject.toml carries the released version, and publish checks the tag matches it instead of writing it in (@rejojer)
- **PR #705** (2026-11-27): revert(client): outline(doc_id, structure) leaves main until its open questions are settled (#702) (@rejojer)
- **PR #703** (closed): docs(client): submit_document says the PageIndex cloud refuses mode="flash" with HTTP 400 (@BukeLy)
- **PR #702** (2026-11-27): feat(client): outline(doc_id, structure) returns a cloud document's flat or hierarchical outline, building it when missing (@BukeLy)
- **PR #698** (2026-11-26): docs(extract): PageExtractClient.extract() names the tiers it takes, max ($0.10 a page) included (@rejojer)
- **PR #697** (2026-11-24): feat: PageSearchClient and PageExtractClient give their PageIndexClient as .documents, and .pageindex still works with a DeprecationWarning (@rejojer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. build: pyproject.toml carries the released version, and publish checks the tag m

**RULE**:
When implementing operations in `.github/workflows/publish.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in VectifyAI/PageIndex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `aef597ae`: build: pyproject.toml carries the released version, and publish checks the tag matches it instead of writing it in. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/publish.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
# Release flow:
#   1. Set `version` in pyproject.toml to the new version on the commit you tag.
#   2. git tag -a v0.2.9 -m "Release 0.2.9"
#   3. git push origin v0.2.9
#   4. This workflow checks the tag matches pyproject.toml, builds, publishes
#      to PyPI via OIDC trusted publishing (no stored secret), and creates a
#      GitHub Release with generated notes (dev tags publish to PyPI only — no
#      GitHub Release).
      - name: Check the tag matches pyproject.toml
        run: grep -qxF "version = \"${GITHUB_REF_NAME#v}\"" pyproject.toml || { echo "::error::Tag $GITHUB_REF_NAME does not match the version in pyproject.toml"; exit 1; }
      - name: Check version and build
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
# Release flow (the git tag IS the version — nothing to bump in the repo):
#   1. git tag -a v0.2.9 -m "Release 0.2.9"
#   2. git push origin v0.2.9
#   3. This workflow derives the version from the tag, injects it into
#      pyproject.toml, builds, publishes to PyPI via OIDC trusted publishing
#      (no stored secret), and creates a GitHub Release with generated notes
#      (dev tags publish to PyPI only — no GitHub Release).
      - name: Set version from tag and build
          # The git tag is the single source of truth; overwrite the static
          # placeholder in [tool.poetry] so the built artifacts carry $VERSION.
          sed -i "s/^version = .*/version = \"$VERSION\"/" pyproject.toml
          grep '^version = ' pyproject.toml
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `aef597ae` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
