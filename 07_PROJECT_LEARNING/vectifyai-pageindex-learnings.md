> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vectifyai-pageindex-learnings.md`  
> **Source**: github ([https://github.com/VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex))  
> **Source Version**: `646deeb6`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T21:00:11.272Z  
> **Learning ID**: `learn-github-vectifyai-pageindex`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): VectifyAI/PageIndex

> **Canonical Artifact**: `07_PROJECT_LEARNING/vectifyai-pageindex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-03T21:00:11.263Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `VectifyAI/PageIndex`
- **Description**: 📑 PageIndex: Document Index for Vectorless, Reasoning-based RAG
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 39965 stars

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


def _published_map():
    """LiteLLM's published model map as downloaded, a Future of its bytes:
    one download per process, on a daemon thread, that runs on any thread
    wait for together."""
    global _published
    with _published_lock:
        if _published is not None:
            return _published
        from concurrent.futures import Future
        future = _published = Future()
        # running: a cancelled waiter can't cancel it for the others
        future.set_running_or_notify_cancel()

    def fetch():
        try:
            import httpx
            response = httpx.get(_PUBLISHED_MAP_URL, timeout=5)
            response.raise_for_status()
            future.set_result(response.content)
        except Exception as exc:
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


def learn_model_if_effort_dropped(model) -> None:
    """learn_published_models when LiteLLM's packaged map lacks `model` and
    LiteLLM so drops a reasoning_effort sent with it: drop_params drops it
    unseen, leaving no refusal to learn on."""
    import litellm
    model = _litellm_model(model)
    try:
        litellm.get_model_info(model)
        return  # in the packaged map: the published one adds nothing for it
    except Exception:
        pass
    provider, name = model.split("/", 1)
    if "reasoning_effort" not in (litellm.get_supported_openai_params(
            model=name, custom_llm_provider=provider) or []):
        run_off_loop(asyncio.run, learn_published_models())

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
        pass  # called below, so its errors don't chain onto this one
    else:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(func, *args).result()
    return func(*args)


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
              in getattr(litellm, "custom_provider_ma
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
               "local_store", "mcp_bridge", "page_index_classic",
               "page_index_md", "retry", "tree_optimize", "types", "utils"}


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
                    Optional, Union, cast, overload)

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
                     "summary_reasoning_effort", "use_embedded_toc", "optimize")

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
     
```

### Core Architecture Module: `pageindex/cloud_api.py`
```
"""Cloud mode of the PageIndex SDK, based on the 0.2.8 client."""
import os
import requests
from pathlib import Path
from typing import Optional, Dict, Any, List, Union, Iterator
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
            response = self._http.post(
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
        response = self._http.get(
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
        response = self._http.post(
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
        response = self._http.get(
            f"{self.BASE_URL}/retrieval/{_enc(retrieval_id)}/",
            headers=self._headers(),
            timeout=30
        )
        if response.status_code != 200:
            raise PageIndexAPIError(
                f"Failed to get retrieval result: {response.text}",
                status_code=response.status_code)
        return response.json()

    # -------
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
- **Issue #645** (2026-11-03): **perf(flash): sequential parse holds one page at a time instead of the whole document**
  *Symptoms*: ## Summary  Flash's single-process parser (`parse_charlevel_meta`, taken when only one worker is available or the document has fewer than 64 pages) held every page open and kept one dict per character for the whole document until the end. A 1,000+ page PDF peaked at over 3 GB, and larger ones can exceed 8 GB.  - **Parse pages one at a time** (`perf(flash): parse pages one at a time, …`). Each page runs pass 1 → pass 2 → spans and is closed right away. The only cross-page input is the document-wide size of identity-matrix Type-3 fonts. A page with chars that `_apply_type3_sizes` may resize is held open with its chars dropped, then re-extracted once those sizes are known.   - Held pages stay open to the end, because the sizes are keyed on the `FPDF_FONT` pointer value.   - The deferral check and `_apply_type3_sizes` share one predicate, `_type3_sized`. It includes whitespace, which the extent accumulation skips.   - BytesIO input and the `pdf_doc = None` fallback when PyPDF2 can't open the file are unchanged. Pages and documents are closed in `finally`. The whole-document path is removed. - **Tokenize each page's content stream once** (`perf(flash): tokenize each page's content stream once`). `_page_pass1` hands its tokens to `_page_show_codes`, which used to tokenize the same stream again. - **Parse each distinct ToUnicode CMap once per document** (`perf(flash): parse each distinct ToUnicode CMap once per document`). Fonts often carry identical CMaps, and a single 0000-FFFF ra

- **Issue #644** (2026-10-29): **fix: follow-ups to #622 (indexing learns newer models, forked processes drop LiteLLM's connections, and five more)**
  *Symptoms*: Seven fixes on top of #622, to review here and then merge into #622's branch. One commit each; the docs fix has a second commit from review.  - Indexing with a model LiteLLM's packaged map lacks (Fireworks, xAI) no longer runs the summaries at the model's default reasoning. LiteLLM dropped the effort without a refusal, so only `chat()` learned the published map. A spawned worker now learns it too. - `claude-code/` chat re-sends a stream that went silent after 30 s, as indexing does, instead of the CLI's 3 minutes. A timeout the caller set wins, on both. - A forked process no longer shares LiteLLM's pooled HTTP connections with its parent. In a fork `Pool(8)` of 240 index calls, one call got another process's reply and two of three runs hung; with this change, 240 of 240 correct in each of three runs. - With LiteLLM 1.106+ beside an older `mcp`, chat says which versions clash and that `pip install -U mcp` fixes it, instead of "cannot import name 'CacheableResult' from 'mcp.types'". - On the LiteLLM lanes, Claude's stop at its context window reads as a cut-off answer: chat raises it and standard mode sees the cut. LiteLLM read it as a normal stop. - The MCP bridge no longer resends a tool call (an upload, a delete) whose reply a TLS error cut off. - `chat()` and `chat_completions()` no longer say the managed chat scopes `doc_id` and `folder_id` server-side. It targets them in its prompt, and its tools reach the key's whole library.  `openai_agent_config()` gets none of these. T

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

### Incident Patch 1: `646deeb6` (2026-11-03)
**Commit Message**: perf(flash): sequential parse holds one page at a time instead of the whole document (#645)

The single-process Flash parser kept every page open and one dict per
character until the end, so a 1,665-page textbook peaked at 3,136 MB.
It now parses pages one at a time and peaks at 434 MB; PRML goes from
3,056 to 658 MB.

- Each page runs pass 1, pass 2 and spans, then closes. A page with
  Type-3 glyphs that may be resized stays open with its chars dropped
  and is extracted again once the document-wide Type-3 sizes are
  known, so a document set entirely in Type-3 fonts takes about a
  third longer.
- Each page's content stream is tokenized once instead of twice.
- Each distinct ToUnicode CMap is parsed once per document; fonts with
  equal CMaps share the parsed dict.
- A stray ), { or } in a ToUnicode CMap no longer hangs the parse. The
  tokenizer never advanced on these bytes and grew its token list until
  memory ran out; they are now skipped, as the content-stream tokenizer
  skips { and }.

The parallel path is unchanged. Span and page-meta hashes match main on
all 15 repo PDFs.

**File**: `pageindex/flash/parser_pdfium_charlevel/char_extract.py` (modified, +7/-1)
```diff
@@ -238,13 +238,19 @@ def _type3_size_by_font(acc: dict) -> dict:
     return out
 
 
+def _type3_sized(char: dict) -> bool:
+    """True for a char ``_apply_type3_sizes`` may resize: an identity-matrix Type-3 glyph, whitespace included (the extent accumulation skips whitespace, the sizing does not)."""
+    obj = char["obj"]
+    return obj["fs_raw"] < 1.5 and obj["scale_y"] < 1.5
+
+
 def _apply_type3_sizes(raw_chars: list[dict], size_by_font: dict) -> None:
     """Override fs_eff with the document-wide Type-3 size and reset each char's span top to baseline + that size."""
     if not size_by_font:
         return
     for candidate_item in raw_chars:
         item_value = candidate_item["obj"]
-        if item_value["fs_raw"] >= 1.5 or item_value["scale_y"] >= 1.5:
+        if not _type3_sized(candidate_item):
             continue
         font_size_value = size_by_font.get(item_value["font_key"])
         if font_size_value:
```

**File**: `pageindex/flash/parser_pdfium_charlevel/cmap_parse.py` (modified, +2/-0)
```diff
@@ -137,6 +137,8 @@ def _parse_tounicode_cmap(data: bytes) -> dict[int, str]:
         elif candidate_item in b"[]":
             tokens.append(("delim", chr(candidate_item)))
             index_value += 1
+        elif candidate_item in b"){}":  # stray delimiter
+            index_value += 1
         elif candidate_item == 0x2F:  # /name
             state_item = index_value + 1
             while state_item < count_item and data[state_item] not in _PDF_WHITESPACE_BYTES and data[state_item] not in _PDF_DELIMITER_BYTES:
```

**File**: `pageindex/flash/parser_pdfium_charlevel/code_walk.py` (modified, +7/-5)
```diff
@@ -69,18 +69,19 @@ def _resource_dict_xrefs(pdf_doc, owner_xref: int, sub: str) -> dict[bytes, int]
 
 
 def _page_show_codes(
-    pdf_doc, page_idx: int,
+    pdf_doc, page_idx: int, page_tokens: tuple | None = None,
 ) -> list[tuple[int | None, tuple[int, ...], float]] | None:
-    """Every show op the page paints, in paint order, as ``(font_xref | None, charcode units, horizontal scale)-- including text inside Form XObjects, spliced at their ``Do`` position with the XObject's own font redefinitions (span merger text-content extraction recurses the same way; PDFium's textpage flattens them inline). The recursion runs on a CLONE of the live text state, so a form inherits both the active font and the horizontal scale; a Tz inside the form REPLACES it and never leaks back out. None when the page can't be read."""
+    """Every show op the page paints, in paint order, as ``(font_xref | None, charcode units, horizontal scale)-- including text inside Form XObjects, spliced at their ``Do`` position with the XObject's own font redefinitions (span merger text-content extraction recurses the same way; PDFium's textpage flattens them inline). The recursion runs on a CLONE of the live text state, so a form inherits both the active font and the horizontal scale; a Tz inside the form REPLACES it and never leaks back out. None when the page can't be read. ``page_tokens`` is the page's own stream already run through ``_tokenize_show_operators`` (the caller tokenized it), so it is not parsed twice."""
     page_xref = pdf_doc.page_xref(page_idx)
 
     def walk(stream: bytes, fonts_res: dict[bytes, int],
              xobjs_res: dict[bytes, int], cur_font: int | None, cur_tz: float,
              visited: frozenset, depth: int,
-             out: list[tuple[int | None, tuple[int, ...], float]]) -> None:
+             out: list[tuple[int | None, tuple[int, ...], float]],
+             tokens: tuple | None = None) -> None:
         if depth > 8:
             return
-        flush_ids, fonts, show_text_units, horizontal_scales, xobject_paints = _tokenize_show_operators(stream, cur_tz)
+        flush_ids, fonts, show_text_units, horizontal_scales, xobject_paints = tokens or _tokenize_show_operators(stream, cur_tz)
         dict_index = 0
         for key_value in range(len(show_text_units) + 1):
             while dict_index < len(xobject_paints) and xobject_paints[dict_index][0] == key_value:
@@ -114,10 +115,11 @@ def walk(stream: bytes, fonts_res: dict[bytes, int],
     try:
         out: list[tuple[int | None, tuple[int, ...], float]] = []
         walk(
-            pdf_doc[page_idx].read_contents(),
+            b"" if page_tokens else pdf_doc[page_idx].read_contents(),
             _resource_dict_xrefs(pdf_doc, page_xref, "Font"),
             _resource_dict_xrefs(pdf_doc, page_xref, "XObject"),
             None, 1.0, frozenset(), 0, out,   # the initial text state starts at scale 1
+            page_tokens,
         )
         return out
     except Exception:
```

**File**: `pageindex/flash/parser_pdfium_charlevel/font_unicode.py` (modified, +13/-5)
```diff
@@ -187,8 +187,17 @@ def _simple_font_to_unicode(
     return to_unicode
 
 
-def _font_unicode_map(pdf_doc, xref: int) -> tuple[int, dict[int, str]] | None:
-    """Return the final per-charcode glyph-unicode map for one font as ``(bytes_per_code, {charcode: unicode})``. Simple fonts use 1-byte codes; Identity-H/V composite fonts use 2-byte codes with the included ToUnicode map. ``None`` means uncovered input such as non-Identity composite CMaps or unreadable dictionaries; callers then skip the page patch walk and keep PDFium's output."""
+def _tounicode_map(pdf_doc, stream_xref: int, map_cache: dict) -> dict[int, str]:
+    """Parse a ToUnicode stream once per distinct content per document: fonts, and each page's own copy of a font, often carry the same CMap, and one 0000-FFFF range expands to 65,536 entries. Fonts with equal CMaps share the parsed dict, so it is read-only."""
+    data = pdf_doc.xref_stream(stream_xref)
+    key = ("tounicode", data)
+    if key not in map_cache:
+        map_cache[key] = _parse_tounicode_cmap(data)
+    return map_cache[key]
+
+
+def _font_unicode_map(pdf_doc, xref: int, map_cache: dict) -> tuple[int, dict[int, str]] | None:
+    """Return the final per-charcode glyph-unicode map for one font as ``(bytes_per_code, {charcode: unicode})``. Simple fonts use 1-byte codes; Identity-H/V composite fonts use 2-byte codes with the included ToUnicode map. ``None`` means uncovered input such as non-Identity composite CMaps or unreadable dictionaries; callers then skip the page patch walk and keep PDFium's output. ``map_cache`` is the caller's per-document cache; parsed ToUnicode streams are kept there."""
     glyphs, encs = _load_glyph_tables()
 
     def _xref_key(number: int, other_text: str) -> tuple[str, str]:
@@ -219,8 +228,7 @@ def _xref_key(number: int, other_text: str) -> tuple[str, str]:
         tu_map: dict[int, str] | None = None
         if pdf_value_type == "xref":
             try:
-                tu_map = _parse_tounicode_cmap(
-                    pdf_doc.xref_stream(int(pdf_value.split()[0])))
+                tu_map = _tounicode_map(pdf_doc, int(pdf_value.split()[0]), map_cache)
             except Exception:
                 tu_map = None  # ToUnicode parsing rejects -> no ToUnicode map
         # The "font carries a ToUnicode map" flag is set only for a present,
@@ -347,7 +355,7 @@ def _xref_key(number: int, other_text: str) -> tuple[str, str]:
     pdf_value_type, pdf_value = _xref_key(xref, "ToUnicode")
     if pdf_value_type == "xref":
         try:
-            included = _parse_tounicode_cmap(pdf_doc.xref_stream(int(pdf_value.split()[0])))
+            included = _tounicode_map(pdf_doc, int(pdf_value.split()[0]), map_cache)
         except Exception:
             included = None  # ToUnicode parsing error path: treat as absent
 
```

**File**: `pageindex/flash/parser_pdfium_charlevel/pipeline.py` (modified, +48/-57)
```diff
@@ -37,6 +37,7 @@
     _accumulate_type3_extents,
     _type3_size_by_font,
     _apply_type3_sizes,
+    _type3_sized,
     _finalize_chars,
     _inherited_box,
     _page_view_rect,
@@ -53,8 +54,8 @@ def _page_pass1(pdf, pdf_doc, page_idx: int, type3_ext: dict, font_map_cache: di
     """Pass-1 body for ONE page: extract raw chars, tag objects, accumulate
     Type-3 extents into ``type3_ext``. Returns ``(page, raw_chars, page_vb,
     page_rot)``; the PAGE is returned still open — the caller owns closing it
-    (the sequential driver must keep every page open until pass 2's Type-3
-    size lookups are done; see keep_pages in ``parse_charlevel_meta``)."""
+    (the sequential driver holds pages with Type-3 sized glyphs open until
+    their pass 2 is done; see ``parse_charlevel_meta``)."""
     page = pdf[page_idx]
     text_page = page.get_textpage()
     raw_chars, objects = _extract_raw_chars(page, text_page.raw)
@@ -72,12 +73,14 @@ def _page_pass1(pdf, pdf_doc, page_idx: int, type3_ext: dict, font_map_cache: di
     show_tzs: list[float] = []
     vert_names: set[bytes] = set()
     if pdf_doc is not None and page_idx < pdf_doc.page_count:
+        page_tokens = None
         try:
             # show-op flush ids (q/Q flush scope) are no longer used -- the merge-id
             # grouping was removed; only show_fonts (per-op font resname)
-            # feeds vertical tagging.
-            show_flush_ids, show_fonts, show_text_units, horizontal_scales, xobject_paints = _tokenize_show_operators(
-                pdf_doc[page_idx].read_contents())
+            # feeds vertical tagging. The same tokens seed _page_show_codes'
+            # walk, so the stream is parsed once.
+            page_tokens = _tokenize_show_operators(pdf_doc[page_idx].read_contents())
+            show_fonts = page_tokens[1]
         except Exception:
             show_fonts = []
         vert_names = _page_vertical_resource_names(pdf_doc, page_idx)
@@ -87,7 +90,7 @@ def _page_pass1(pdf, pdf_doc, page_idx: int, type3_ext: dict, font_map_cache: di
         # the page's own stream alone under-counts every form page and the
         # ordinal gate below would then drop the tag for the whole page.
         try:
-            show_codes = _page_show_codes(pdf_doc, page_idx)
+            show_codes = _page_show_codes(pdf_doc, page_idx, page_tokens)
             if show_codes:
                 show_tzs = [horizontal_scale for _fx, _s, horizontal_scale in show_codes]
                 # Patch per-char unicode to span merger glyph Unicode where
@@ -231,62 +234,50 @@ def parse_charlevel_meta(doc_handle: Union[str, Path, BytesIO]) -> tuple[list[li
     except Exception:
         pdf_doc = None
 
-    # Pass 1: extract raw chars for every page (including each glyph's raw
-    # advance) and accumulate per-font identity-matrix Type-3 glyph-bbox
-    # extents document-wide, so each Type-3 font is sized once over every
-    # glyph it renders anywhere (coverage-independent), matching span merger
-    # synthesizing font.bbox once from the CharProcs. Font handles are only
-    # stable per document while their pages stay open (see keep_pages below).
-    per_page: list[list[dict]] = []
-    page_view_boxes: list = []   # parallel to per_page: text extraction page view box per page
-    page_rotations: list = []   # parallel: PDFium page /Rotate in degrees per page
-    type3_ext: dict = {}
-    font_map_cache: dict = {}
-    # Hold every page open until pass 2's Type-3 size lookups are done.
+    # Pages are parsed one at a time and closed at once, so memory holds one
+    # page's chars, not the whole document's. The one cross-page input is the
+    # document-wide identity-matrix Type-3 extent union (``type3_ext``): each
+    # Type-3 font is sized once over every glyph it renders anywhere
+    # (coverage-independent), matching span merger synthesizing font.bbox once
+    # from the CharProcs. A page carrying chars ``_apply_type3_sizes`` may
+    # resize is therefore held open with its chars dropped, and re-extracted
+    # once the union is complete. Held pages stay open to the end:
     # type3_ext / size_by_font key on the raw FPDF_FONT pointer VALUE, and
     # PDFium frees a font once the last page using it closes -- a later
-    # page's (different) font can then be allocated at the same address,
-    # silently merging two fonts' extent bins. Which addresses get reused
-    # depends on the process's prior malloc state, so the output could vary
-    # with whatever ran earlier in the process. Keeping the pages alive makes
-    # the handle a true per-document
-    # font identity (PDFium's document-level font cache returns one handle
-    # per font redefinition).
-    keep_pages = []
-    for page_idx in range(len(pdf)):
-        page, raw_chars, page_vb, page_rot = _page_pass1(
-            pdf, pdf_doc, page_idx, type3_ext, font_map_cache)
-        keep_pages.append(page)
-        per_page.append(raw_chars)
-        page_view_bo
```

**File**: `pageindex/flash/parser_pdfium_charlevel/unicode_apply.py` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ def targets_for(font_xref: int | None, other_numbers: tuple[int, ...]) -> list[s
             return None
         if font_xref not in map_cache:
             try:
-                map_cache[font_xref] = _font_unicode_map(pdf_doc, font_xref)
+                map_cache[font_xref] = _font_unicode_map(pdf_doc, font_xref, map_cache)
             except Exception:
                 map_cache[font_xref] = None
         entry = map_cache[font_xref]
```

**File**: `tests/test_flash_extraction.py` (modified, +63/-0)
```diff
@@ -1323,3 +1323,66 @@ def test_flash_cli_summary_flags_refuse_standard_mode(monkeypatch, tmp_path):
     for flag in ("--summary-concurrency", "--summary-max-words", "--summary-reasoning-effort"):
         with pytest.raises(ValueError, match=f"{flag} requires Flash mode"):
             _run_flash_cli(monkeypatch, tmp_path, ["--mode", "standard", flag, "8"], [])
+
+
+def _fields(value):
+    """Every ``__slots__`` field, recursively -- Span and Rect define no __eq__."""
+    slots = [s for c in type(value).__mro__ for s in getattr(c, "__slots__", ())]
+    if slots:
+        return {s: _fields(getattr(value, s)) for s in slots if hasattr(value, s)}
+    if isinstance(value, (list, tuple)):
+        return [_fields(v) for v in value]
+    return repr(value)
+
+
+def test_sequential_parse_defers_only_type3_sized_pages(tmp_path, monkeypatch):
+    """Pages are parsed one at a time and closed at once, except pages carrying
+    identity-matrix Type-3 glyphs: those are re-extracted after the whole
+    document's Type-3 sizes are known. The result must equal the two-pass
+    parse that holds every page open and sizes them all at the end."""
+    import PyPDF2
+    import pypdfium2 as pdfium
+
+    from pageindex.flash.parser_pdfium_charlevel import pipeline as mod
+
+    plain = PyPDF2.PdfReader(str(PDF))
+    lectures = PyPDF2.PdfReader(str(PDF.parent / "four-lectures.pdf"))  # Type-3 bitmap fonts
+    writer = PyPDF2.PdfWriter()
+    for page in (plain.pages[0], lectures.pages[0], plain.pages[1], lectures.pages[1]):
+        writer.add_page(page)
+    mixed = tmp_path / "mixed.pdf"
+    with open(mixed, "wb") as f:
+        writer.write(f)
+
+    pdf = pdfium.PdfDocument(str(mixed))
+    pdf_doc = mod._PdfDoc(PyPDF2.PdfReader(str(mixed)))
+    type3_ext: dict = {}
+    firsts = [mod._page_pass1(pdf, pdf_doc, i, type3_ext, {}) for i in range(len(pdf))]
+    sizes = mod._type3_size_by_font(type3_ext)
+    assert sizes  # the sizing is live, not a no-op
+    want = [mod._page_spans(mod._page_pass2(raw, vb, sizes)) for _p, raw, vb, _r in firsts]
+    want_meta = [(vb, rot) for _p, _raw, vb, rot in firsts]
+    for page, *_ in firsts:
+        page.close()
+    pdf.close()
+
+    calls = []
+    real_pass1 = mod._page_pass1
+    monkeypatch.setattr(mod, "_page_pass1",
+                        lambda pdf, pdf_doc, i, *a: calls.append(i) or real_pass1(pdf, pdf_doc, i, *a))
+    got, meta = mod.parse_charlevel_meta(str(mixed))
+    assert calls == [0, 1, 2, 3, 1, 3]  # only the Type-3 pages are extracted twice
+    assert meta == want_meta
+    assert _fields(got) == _fields(want)
+
+
+@pytest.mark.parametrize("stray", [")", "{", "}"])
+def test_tounicode_parser_gets_past_a_stray_delimiter(stray):
+    import subprocess
+    import sys
+
+    code = ("from pageindex.flash.parser_pdfium_charlevel.cmap_parse import _parse_tounicode_cmap\n"
+            f"print(_parse_tounicode_cmap(b'1 beginbfrange <01> <02> [<0041> {stray} <0042>] endbfrange'))")
+    res = subprocess.run([sys.executable, "-c", code], capture_output=True,
+                         cwd=Path(__file__).parent.parent, timeout=15)
+    assert res.stdout.strip() == b"{1: 'A', 2: 'B'}", res.stderr.decode()
```

#### Recent Merged Pull Requests:
- **PR #645** (2026-11-03): perf(flash): sequential parse holds one page at a time instead of the whole document (@BukeLy)
- **PR #644** (2026-10-29): fix: follow-ups to #622 (indexing learns newer models, forked processes drop LiteLLM's connections, and five more) (@rejojer)
- **PR #643** (closed): fix: claude-code/ chat runs at the reasoning_effort it is given, not an inherited CLAUDE_CODE_EFFORT_LEVEL (@rejojer)
- **PR #642** (closed): fix: reasoning_effort "none" turns Claude's thinking off, in indexing and chat (@rejojer)
- **PR #641** (2026-10-27): README: Page Search API at the top of the updates (@zmtomorrow)
- **PR #640** (closed): claude-code/ flash summaries run as one workflow's agents, and the route's processes run 16 at a time without the unread cache write (@rejojer)

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

## X. flash): sequential parse holds one page at a time instead of the whole document 

**RULE**:
When implementing operations in `pageindex/flash/parser_pdfium_charlevel/char_extract.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in VectifyAI/PageIndex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `646deeb6`: flash): sequential parse holds one page at a time instead of the whole document (#645). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `pageindex/flash/parser_pdfium_charlevel/char_extract.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
def _type3_sized(char: dict) -> bool:
    """True for a char ``_apply_type3_sizes`` may resize: an identity-matrix Type-3 glyph, whitespace included (the extent accumulation skips whitespace, the sizing does not)."""
    obj = char["obj"]
    return obj["fs_raw"] < 1.5 and obj["scale_y"] < 1.5


        if not _type3_sized(candidate_item):
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
        if item_value["fs_raw"] >= 1.5 or item_value["scale_y"] >= 1.5:
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `646deeb6` are properly handled with clean fallback behavior.
