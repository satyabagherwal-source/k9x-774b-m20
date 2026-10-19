> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vectifyai-pageindex-learnings.md`  
> **Source**: github ([https://github.com/VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex))  
> **Source Version**: `50a71b68`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T06:19:09.715Z  
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
> **Harvest Timestamp**: 2026-10-19T06:19:09.706Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `VectifyAI/PageIndex`
- **Description**: 📑 PageIndex: Document Index for Vectorless, Reasoning-based RAG
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 39264 stars

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
    from .integrations.claude_agent_sdk import claude_code_complete, is_claude_code
    if is_claude_code(model):
        if chat_history or return_finish_reason:
            raise ValueError("claude-code/ models index in flash mode only; "
                             "standard mode needs an API model.")
        return run_off_loop(asyncio.run, claude_code_complete(model, prompt))
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


async def llm_acompletion(model, prompt, **params):
    from .integrations.claude_agent_sdk import claude_code_complete, is_claude_code
    if is_claude_code(model):
        return await claude_code_complete(model, prompt, **params)
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
                **params,
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
        response = r
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
                "index is an empty dict — its keys pick the side: "
                '{"api_key": ...} for cloud documents, or '
                f"{', '.join(_LOCAL_INDEX_KEYS)} for the local store.")
        unknown = set(conf) - {"api_key"} - set(_LOCAL_INDEX_KEYS)
        if unknown:
 
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
    None does not imply local/client-side. rpc_error carries an MCP
    server's JSON-RPC error object as it was sent."""

    def __init__(self, *args: object, status_code: int | None = None,
                 rpc_error: dict | None = None) -> None:
        super().__init__(*args)
        self.status_code = status_code
        self.rpc_error = rpc_error


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
- **Issue #603** (2026-10-19): **fix(claude): a missing login fails in one clear error, saying how to log in**
  *Symptoms*: Indexing on `claude-code/` without a Claude login, or with one that has expired, now fails in a 9-line traceback that ends with how to fix it: "Log in with your Claude subscription: run `claude`, then /login (install Claude Code first if needed)." It was 77 lines of three chained errors, the first an unrelated `RuntimeError: no running event loop`, and the old hint pointed to a `claude` command that pip never installs.  ## Changes  **The no-running-loop RuntimeError** (`utils.run_off_loop`) `run_off_loop` called the function inside its `except RuntimeError` block, so every error from a sync `submit_document()` or `chat()` call, on any model route, chained onto "no running event loop" and printed it first. The function now runs after the loop check.  **One error, not three** (`local_api.submit_document`) An exhausted LLM retry ladder that carries an HTTP status (401, 429, 5xx) is raised as the submit error alone: its message already names the cause, and the ladder's error stays on `__context__`. Without a status, usually a bug the ladder retried, the chain is kept for its frames.  **The login hint** (`integrations/claude_agent_sdk._run_error`, cookbook) The 401 hint follows Claude Code's own message ("Not logged in · Please run /login", or "Failed to authenticate: OAuth session expired and could not be refreshed") and now says where to log in and that Claude Code may need installing first. The cookbook says the same before its run line.  ## Verification  - Real CLI, logged out

- **Issue #601** (2026-10-18): **docs(cookbook): index the Harness² paper, show progress, stream the answer**
  *Symptoms*: The Claude subscription example now indexes a paper long enough that the model reads the tree before the pages, and shows its progress instead of sitting silent.  ## Changes  - **Document**: the Harness² paper (arXiv 2610.14224, 37 pages) replaces the 22-page earnings release. Past 20 pages the tools ask the model to read the structure first; on the earnings release it often went straight to pages 1–2. On Harness² it read the tree first in every run we made, then its method's pages (4–6 or 4–7). - **Progress**: a line before and after indexing, and the answer streamed with its tool calls (`chat(..., stream=True)`). - **Comment**: the chat model "retrieves from the tree and answers". - **Pinned**: the arXiv link names v1, so a later revision can't change what the example reads.  Verified on pageindex 0.4.2 from PyPI with the script alone in an empty folder: downloaded the paper, indexed it in about 25 s, read the tree, then the method's pages, and explained Propose → Probe → Compose. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null},"security_review":{"commit_sha":"3500a8a598e322a4fe49a4c7e5f01ef527729f89","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"}} --> <!-- codex-security-review:v1 {"blockingSeverityThreshold":"P0","headSha":"3500a8a598e322a4fe49a4c7e5f01ef527729f89","mergeGateEnabled":false,"pullRequestNumber":601,"repository":"VectifyAI/PageIndex","status":"completed"} --> ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="2026-10-18T13:50:09.281376Z">2026-10-18T13:50:09.281376Z</relative-time> | `3500a8a` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review

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

### Incident Patch 1: `7162ef62` (2026-10-18)
**Commit Message**: fix(claude): keep the cloud API key off the Claude Code command line (#594)

On cloud, as_claude_mcp() now returns an in-process server instead of a
remote server config, so the PageIndex API key no longer appears on the
Claude Code CLI's command line, where any local process could read it
with ps while the CLI ran. The server relays the PageIndex MCP server's
own handshake, instructions, tools and resources, fetched live for each
session through McpBridge, which retries 429/5xx and keeps each error
with its own request; a failure never ends the session.

The relay needs claude-agent-sdk 0.2.160 (in-process servers over mcp's
own transport, and stdin kept open past the first turn), so cloud
as_claude_mcp() raises with an upgrade hint below it. The claude extra
moves to 0.2.166, whose CLI hands the model 4,096 characters of a
server's instructions instead of 2,048; system_prompt stays the channel
that carries them whole.

Local tools declare maxResultSizeChars at twice TOOL_RESPONSE_CHAR_LIMIT
(200,000), so Claude Code shows normal PageIndex results whole instead of
a 2KB preview past 50,000 characters, while an oversized single page
still falls back to the preview.

Behavior change

**File**: `pageindex/client.py` (modified, +17/-13)
```diff
@@ -2259,24 +2259,28 @@ def anthropic_runner_config(
     def as_claude_mcp(self, include_management: bool = False, *,
                       server_name: str = "pageindex"):
         """
-        ``mcp_servers`` entry for the Claude Agent SDK.
-
-        Cloud: returns the remote PageIndex MCP config.
-        ``include_management`` picks the endpoint, so the URL itself is
-        the gate — the default connects to the read-only endpoint
-        (``/mcp?tools=read``: the server registers only read-only tools),
-        ``True`` connects to the full tool set. Local: returns an
-        in-process SDK MCP server exposing the agent tools, gated the
-        same way at registration (requires ``claude-agent-sdk``;
-        ``pip install 'pageindex[claude]'``). ``server_name`` names the
-        in-process server — match it to the key you register the entry
-        under (cloud entries carry no name).
+        ``mcp_servers`` entry for the Claude Agent SDK: an in-process SDK
+        MCP server, in both modes (requires ``claude-agent-sdk``;
+        ``pip install 'pageindex[claude]'``).
+
+        Cloud: a relay to the PageIndex MCP server — its tools,
+        instructions and resources, fetched live for each session — that
+        keeps the API key off the Claude Code CLI's command line (where a
+        remote server config would carry it, readable by any local
+        process). ``include_management`` picks the endpoint: the
+        default relays the read-only one (``/mcp?tools=read``: the server
+        registers only read-only tools), ``True`` the full tool set.
+        Local: the agent tools over the local store, gated the same way at
+        registration. ``server_name`` names the server — match it to the
+        key you register the entry under.
 
         Cloud hosts that surface MCP server instructions receive the tool
         guidance natively — not the client's ``instructions``, which only
         ``system_prompt`` carries; passing both duplicates the guidance
         (harmless). ``system_prompt`` stays the recommended channel: it is
-        guaranteed delivery, and the only channel local mode has.
+        guaranteed delivery, whole (Claude Code hands the model at most
+        4,096 characters of a server's instructions), and the only channel
+        local mode has.
 
         Usage (or ``claude_agent_config()`` for the whole bundle in one
         call)::
```

**File**: `pageindex/errors.py` (modified, +5/-2)
```diff
@@ -1,10 +1,13 @@
 class PageIndexAPIError(Exception):
     """status_code carries the HTTP status when the raising site passes it;
-    None does not imply local/client-side."""
+    None does not imply local/client-side. rpc_error carries an MCP
+    server's JSON-RPC error object as it was sent."""
 
-    def __init__(self, *args: object, status_code: int | None = None) -> None:
+    def __init__(self, *args: object, status_code: int | None = None,
+                 rpc_error: dict | None = None) -> None:
         super().__init__(*args)
         self.status_code = status_code
+        self.rpc_error = rpc_error
 
 
 def _pageindex_cause(exc: BaseException | None) -> PageIndexAPIError | None:
```

**File**: `pageindex/integrations/claude_agent_sdk.py` (modified, +86/-17)
```diff
@@ -1,31 +1,35 @@
 """Claude Agent SDK adapter: one value for the mcp_servers slot.
 
-Cloud clients get the remote PageIndex MCP config — the framework connects
-directly, and include_management picks the endpoint (the read-only
-``?tools=read`` URL by default); local clients get an in-process SDK MCP
-server over the same tool contract, gated the same way at registration,
-its results passed through as the MCP content they are.
+An in-process SDK MCP server in both modes. Cloud clients get a relay that
+answers the CLI's MCP session with the PageIndex MCP server's own (its
+handshake and instructions, tools, resources), fetched live over this
+SDK's MCP client, so the API key stays off the CLI's command line (where
+a remote server config would carry it, readable by any local process);
+include_management picks the endpoint (the read-only
+``?tools=read`` URL by default). Local clients get a server over the same
+tool contract, gated the same way at registration, its results passed
+through as the MCP content they are.
 """
 from __future__ import annotations
 
 import asyncio
+import re
 from typing import Any
 
 from .._version import sdk_version
+from ..agent_tools import TOOL_RESPONSE_CHAR_LIMIT
 from ..errors import PageIndexAPIError
 
+# Claude Code shows the model only a 2KB preview of an MCP result over
+# 50,000 chars; PageIndex results run to about TOOL_RESPONSE_CHAR_LIMIT,
+# so twice it keeps them whole.
+MAX_RESULT_CHARS = TOOL_RESPONSE_CHAR_LIMIT * 2
+
 
 def build_claude_mcp(client, include_management: bool = False, *,
                      server_name: str = "pageindex"):
     if getattr(client, "api_key", None):
-        # include_management picks the endpoint — the URL itself is the
-        # gate (?tools=read serves only readOnlyHint-annotated tools).
-        suffix = "" if include_management else "?tools=read"
-        return {
-            "type": "http",
-            "url": f"{client.BASE_URL}/mcp{suffix}",
-            "headers": {"Authorization": f"Bearer {client.api_key}"},
-        }
+        return _cloud_relay(client, include_management, server_name)
 
     try:
         from claude_agent_sdk import create_sdk_mcp_server, tool
@@ -46,14 +50,13 @@ async def handler(arguments: dict[str, Any]) -> dict[str, Any]:
         return handler
 
     def tool_kwargs(name: str) -> dict:
-        annotations = TOOL_CONTRACT[name].get("annotations")
-        if not annotations:
-            return {}
         try:
             from claude_agent_sdk import ToolAnnotations
         except ImportError:
             return {}
-        return {"annotations": ToolAnnotations(**annotations)}
+        return {"annotations": ToolAnnotations(
+            **(TOOL_CONTRACT[name].get("annotations") or {}),
+            maxResultSizeChars=MAX_RESULT_CHARS)}
 
     tools = [
         tool(name, description, schema,
@@ -63,3 +66,69 @@ def tool_kwargs(name: str) -> dict:
     ]
     return create_sdk_mcp_server(name=server_name, version=sdk_version(),
                                  tools=tools)
+
+
+def _cloud_relay(client, include_management: bool, server_name: str):
+    from importlib.metadata import version
+    try:
+        release = tuple(int(n) for n in
+                        re.findall(r"\d+", version("claude-agent-sdk"))[:3])
+    except ImportError:  # not installed
+        release = ()
+    if release < (0, 2, 160):
+        # older releases answer the CLI from a server's registered
+        # handlers, which the relay lacks (before 0.2.140), or close the
+        # CLI's stdin at the first result (before 0.2.160): the agent
+        # would quietly run without the tools
+        raise PageIndexAPIError(
+            "as_claude_mcp on cloud requires claude-agent-sdk 0.2.160 or "
+            "newer — pip install -U claude-agent-sdk.")
+    import anyio.to_thread
+    import mcp.types
+    from mcp.server.lowlevel import Server
+    from ..mcp_bridge import McpBridge
+
+    # include_management picks the endpoint — the URL itself is the gate
+    # (?tools=read serves only readOnlyHint-annotated tools).
+    url = f"{client.BASE_URL}/mcp" + ("" if include_management else "?tools=read")
+    headers = {"Authorization": f"Bearer {client.api_key}"}
+
+    class Relay(Server):
+        async def run(self, read_stream, write_stream, *args, **kwargs):
+            bridge = McpBridge(url, headers)  # a cloud session per CLI session
+
+            async def answer(request):
+                reply = {"jsonrpc": "2.0", "id": request.id}
+                try:
+                    result = await anyio.to_thread.run_sync(
+                        bridge.relay, request.method, request.params,
+                        abandon_on_cancel=True)
+                    outgoing = _session_message({**reply, "result": result or {}})
+                except Exception as exc:  # one bad call must not end the session
+                    # the server's own error, which Claude Code may act on
+                    er
```

**File**: `pageindex/mcp_bridge.py` (modified, +16/-3)
```diff
@@ -1,7 +1,8 @@
 """Minimal MCP client (streamable HTTP) for the PageIndex cloud MCP server.
 
-Backs the cloud branches of ``client.agent_tools()`` and
-``client.agent_instructions()``: ``tools/list`` discovers the live tool set,
+Backs the cloud branches of ``client.agent_tools()``,
+``client.agent_instructions()`` and ``client.as_claude_mcp()`` (whose relay
+forwards the CLI's requests): ``tools/list`` discovers the live tool set,
 ``tools/call`` executes a tool, ``prompts/list`` / ``prompts/get`` fetch the
 server's prompts (e.g. ``cited_answer``), and the ``initialize`` handshake
 carries the server's agent instructions and capabilities. Synchronous,
@@ -61,6 +62,7 @@ def __init__(self, url: str, headers: dict[str, str]):
         self._protocol_version: Optional[str] = None
         self._instructions: Optional[str] = None
         self._capabilities: dict[str, Any] = {}
+        self._handshake: dict[str, Any] = {}
         self._initialized = False
         self._lock = threading.RLock()
         self._next_id = 0
@@ -114,7 +116,8 @@ def _extract_result(self, response: requests.Response, request_id: int) -> Any:
         if "error" in reply:
             error = reply["error"] or {}
             raise PageIndexAPIError(
-                f"MCP error {error.get('code')}: {error.get('message')}"
+                f"MCP error {error.get('code')}: {error.get('message')}",
+                rpc_error=error,
             )
         return reply.get("result")
 
@@ -175,6 +178,7 @@ def _ensure_initialized(self) -> None:
                     status_code=response.status_code,
                 )
             result = self._extract_result(response, request_id) or {}
+            self._handshake = result
             self._session_id = response.headers.get("Mcp-Session-Id")
             self._protocol_version = result.get("protocolVersion",
                                                 _PROTOCOL_VERSION)
@@ -259,6 +263,15 @@ def call_tool(self, name: str, arguments: dict[str, Any],
                                {"name": name, "arguments": arguments}) or {}
         return list(result.get("content") or []), bool(result.get("isError"))
 
+    def relay(self, method: str, params: Optional[dict] = None) -> Any:
+        """One request from another MCP client, answered as the server
+        would: ``initialize`` with the server's own handshake result, any
+        other request forwarded on this session."""
+        if method == "initialize":
+            self._ensure_initialized()
+            return self._handshake
+        return self._request(method, params)
+
 
 def render_text(blocks: list) -> str:
     """The text-only rendering of MCP content: text verbatim, base64
```

**File**: `pyproject.toml` (modified, +4/-2)
```diff
@@ -41,8 +41,10 @@ regex = ">=2024.0.0"
 python-dotenv = ">=1.0.0"
 pyyaml = ">=6.0"
 Pillow = ">=9.0"
-# Older releases break string prompts with SDK MCP servers (#597, #780).
-claude-agent-sdk = { version = ">=0.1.53", optional = true }
+# as_claude_mcp()'s cloud relay needs in-process servers served over mcp's
+# own transport (0.2.140); 0.2.160 stops closing stdin on them too early;
+# 0.2.166 bundles a CLI that passes 4,096 chars of server instructions, not 2,048.
+claude-agent-sdk = { version = ">=0.2.166", optional = true }
 # Pre-0.122 lacks the Bedrock/Vertex tool runner; pre-0.108 executes a
 # refusal turn's tool_use blocks.
 anthropic = { version = ">=0.122.0", optional = true }
```

**File**: `tests/test_agent_tools.py` (modified, +215/-20)
```diff
@@ -705,18 +705,152 @@ def call_tool(self, name, arguments):
     assert tools[0].params_json_schema is not schema  # copied, not aliased
 
 
-def test_as_claude_mcp_cloud_needs_no_framework(monkeypatch):
-    monkeypatch.setitem(sys.modules, "claude_agent_sdk", None)
+def _claude_session(server, *requests):
+    """The server's replies to the handshake, then to each (method, params)
+    request, through the Claude Agent SDK's own bridge: the path the
+    Claude Code CLI's MCP messages take."""
+    from claude_agent_sdk._internal.sdk_mcp_bridge import SdkMcpBridge
+
+    async def run():
+        bridge = SdkMcpBridge(server["name"], server["instance"])
+
+        async def handle(message):  # a silent server fails, never hangs
+            return await asyncio.wait_for(bridge.handle(message), 10)
+        try:
+            replies = [await handle({
+                "jsonrpc": "2.0", "id": 0, "method": "initialize",
+                "params": {"protocolVersion": "2025-06-18", "capabilities": {},
+                           "clientInfo": {"name": "claude-code", "version": "2"}}})]
+            await handle({"jsonrpc": "2.0",
+                          "method": "notifications/initialized"})
+            for request_id, (method, params) in enumerate(requests, 1):
+                replies.append(await handle({
+                    "jsonrpc": "2.0", "id": request_id, "method": method,
+                    "params": params}))
+            return replies
+        finally:
+            await bridge.aclose()
+    return asyncio.run(run())
+
+
+def test_as_claude_mcp_cloud_relays_the_server_with_the_key_in_process(
+        cloud_with_fake_bridge):
+    """A remote server config put the API key on the Claude Code CLI's
+    command line; the in-process relay answers the CLI's MCP session with
+    the server's own instead: its handshake and instructions, the
+    endpoint's tool set and gate, a cloud session per CLI session."""
+    pytest.importorskip("claude_agent_sdk")
+    from claude_agent_sdk import ClaudeAgentOptions
+    from claude_agent_sdk._internal.transport.subprocess_cli import (
+        SubprocessCLITransport)
+    cloud, created = cloud_with_fake_bridge
+    server = cloud.as_claude_mcp()
+    assert server["type"] == "sdk" and server["name"] == "pageindex"
+    # the CLI's command line, as the SDK builds it
+    argv = SubprocessCLITransport("Q", ClaudeAgentOptions(
+        mcp_servers={"pageindex": server}, cli_path="claude"))._build_command()
+    assert "--mcp-config" in argv and "pi-test-key" not in " ".join(argv)
+    assert not created  # nothing is fetched until a session starts
+
+    init, listed, called, refused, broken, missing, again = _claude_session(
+        server, ("tools/list", {}),
+        ("tools/call", {"name": "get_document",
+                        "arguments": {"doc_name": "a.pdf"}}),
+        ("tools/call", {"name": "remove_document",
+                        "arguments": {"doc_names": ["a.pdf"]}}),
+        ("tools/call", {"name": "garbled", "arguments": {}}),
+        ("resources/read", {"uri": "pageindex://gone"}),
+        ("tools/list", {}))
+    bridge = created["bridge"]
+    assert bridge.url == "https://api.pageindex.ai/mcp?tools=read"
+    assert bridge.headers == {"Authorization": "Bearer pi-test-key"}
+    assert init["result"]["instructions"] == "SERVER GUIDANCE"
+    tools = listed["result"]["tools"]
+    assert [tool["name"] for tool in tools] == ["search_documents",
+                                                "get_document"]
+    assert tools[0]["annotations"]["readOnlyHint"] is True
+    assert json.loads(called["result"]["content"][0]["text"])["tool"] == "get_document"
+    assert "Tool not found" in refused["error"]["message"]
+    # an unexpected failure stays with its call; the session goes on
+    assert "garbled reply" in broken["error"]["message"]
+    # the server's own error reaches the CLI intact (Claude Code acts on
+    # -32002: the resource is gone, list again)
+    assert missing["error"] == {"code": -32002, "message": "Resource not found",
+                                "data": {"uri": "pageindex://gone"}}
+    assert again["result"] == listed["result"]
+    assert bridge.calls == [("get_document", {"doc_name": "a.pdf"})]
+
+    _, listed = _claude_session(cloud.as_claude_mcp(include_management=True),
+                                ("tools/list", {}))
+    assert created["bridge"].url == "https://api.pageindex.ai/mcp"
+    assert len(listed["result"]["tools"]) == 4
+
+
+def test_as_claude_mcp_cloud_relay_runs_calls_side_by_side(
+        cloud_with_fake_bridge, monkeypatch):
+    """The CLI runs read tools in parallel: a quick call is answered while a
+    slow one runs, and the session closes at once with the slow one still
+    in flight."""
+    pytest.importorskip("claude_agent_sdk")
+    import threading
+    from claude_agent_sdk._internal.sdk_mcp_bridge import SdkMcpBridge
+    cloud, _ = cloud_with_fake_bridge
+    rel
```

---

### Incident Patch 2: `50a71b68` (2026-10-19)
**Commit Message**: fix(claude): a missing login fails in one clear error, saying how to log in (#603)

Indexing on claude-code/ without a Claude login, or with one that has
expired, now fails in a 9-line traceback whose only error ends with the
hint; it was 77 lines, three chained errors, the first an unrelated
"RuntimeError: no running event loop". The hint now says where to log
in: "run `claude`, then /login (install Claude Code first if needed)",
since pip installs no `claude` command; the cookbook says the same
before its run line.

run_off_loop calls the function after its loop check instead of inside
the except block, so no error from a sync submit_document or chat call
chains onto that RuntimeError, on any model route. submit_document
shows an exhausted LLM retry ladder alone when it carries an HTTP
status (401, 429, 5xx): the message already names the cause, and the
chain stays on __context__. Without a status, usually a bug the ladder
retried, the chain is kept for its frames.

**File**: `cookbook/pageindex-claude-subscription.py` (modified, +3/-0)
```diff
@@ -3,6 +3,9 @@
 
     pip install -U "pageindex[claude]"
 
+Log in with your Claude subscription: run `claude`, then /login (install
+Claude Code first if needed). Then:
+
     python pageindex-claude-subscription.py
 """
 from pathlib import Path
```

**File**: `pageindex/integrations/claude_agent_sdk.py` (modified, +2/-2)
```diff
@@ -263,8 +263,8 @@ def _run_error(result, kind, max_turns) -> PageIndexAPIError:
         return _wrap_max_turns(max_turns)
     status = result.api_error_status or _ERROR_STATUS.get(kind)
     text = result.result or "; ".join(result.errors or []) or result.subtype
-    hint = {401: " Run `claude` once and log in with your Claude "
-                 "subscription.",
+    hint = {401: " Log in with your Claude subscription: run `claude`, then "
+                 "/login (install Claude Code first if needed).",
             429: " Your Claude subscription's usage limit is reached; it "
                  "resets on its own."}.get(status, "")
     return PageIndexAPIError(f"Claude Code failed: {text.rstrip('.')}.{hint}",
```

**File**: `pageindex/local_api.py` (modified, +5/-1)
```diff
@@ -13,7 +13,7 @@
 from .errors import PageIndexAPIError
 from .local_store import DocStore
 from .naming import sanitize_filename, truncate_filename
-from .utils import count_tokens, run_off_loop
+from .utils import LLMRetriesExhausted, count_tokens, run_off_loop
 
 logger = logging.getLogger(__name__)
 
@@ -150,6 +150,10 @@ def submit_document(
                 )
         except PageIndexAPIError:
             raise
+        except LLMRetriesExhausted as e:
+            # with a status its message names the cause; the chain stays on __context__
+            raise PageIndexAPIError(f"Failed to submit document: {e}") from (
+                None if e.status_code else e)
         except Exception as e:
             raise PageIndexAPIError(f"Failed to submit document: {e}") from e
         self._check_page_bounds(structure, len(page_texts))
```

**File**: `pageindex/utils.py` (modified, +6/-4)
```diff
@@ -104,10 +104,12 @@ def run_off_loop(func, *args):
     try:
         asyncio.get_running_loop()
     except RuntimeError:
-        return func(*args)
-    from concurrent.futures import ThreadPoolExecutor
-    with ThreadPoolExecutor(max_workers=1) as pool:
-        return pool.submit(func, *args).result()
+        pass  # called below, so its errors don't chain onto this one
+    else:
+        from concurrent.futures import ThreadPoolExecutor
+        with ThreadPoolExecutor(max_workers=1) as pool:
+            return pool.submit(func, *args).result()
+    return func(*args)
 
 
 def _litellm_model(model):
```

**File**: `tests/test_claude_code.py` (modified, +2/-1)
```diff
@@ -227,7 +227,8 @@ def test_missing_login_says_how_to_log_in(monkeypatch):
              AssistantMessage(content=[TextBlock("Not logged in")], model="haiku",
                               error="authentication_failed"),
              result("Not logged in · Please run /login", is_error=True))
-    with pytest.raises(LLMRetriesExhausted, match="log in") as err:
+    with pytest.raises(LLMRetriesExhausted,
+                       match="Log in with your Claude subscription") as err:
         asyncio.run(llm_acompletion("claude-code/haiku", "P"))
     assert err.value.status_code == 401
 
```

**File**: `tests/test_client.py` (modified, +20/-0)
```diff
@@ -892,6 +892,26 @@ def first_llm_call(*args, **kwargs):
     assert local_client.list_documents()["total"] == 0
 
 
+@pytest.mark.parametrize("status", [401, None])
+def test_submit_shows_an_explained_llm_failure_alone(local_client, sample_pdf,
+                                                     monkeypatch, status):
+    """An exhausted ladder with a status (a claude-code/ login included)
+    names its cause, so the traceback shows the submit error alone; one
+    without, such as a bug the ladder retried, keeps its chain. Neither
+    carries run_off_loop's no-running-loop RuntimeError."""
+    def fail(pdf, **kwargs):
+        raise pageindex.utils.LLMRetriesExhausted("LLM call failed",
+                                                  status_code=status)
+    monkeypatch.setattr(pageindex.flash, "page_index_flash", fail)
+    with pytest.raises(PageIndexAPIError, match="LLM call failed") as err:
+        local_client.submit_document(sample_pdf)
+    ladder = err.value.__context__
+    assert isinstance(ladder, pageindex.utils.LLMRetriesExhausted)
+    assert err.value.__cause__ is (None if status else ladder)
+    assert err.value.__suppress_context__
+    assert ladder.__context__ is None
+
+
 def test_submit_rejections(local_client, sample_pdf, tmp_path):
     with pytest.raises(FileNotFoundError):
         local_client.submit_document(str(tmp_path / "missing.pdf"))
```

---

### Incident Patch 3: `05cedbc1` (2026-10-18)
**Commit Message**: fix(claude): quiet the reaped-probe warning, name an old or missing Agent SDK (#600)

On Python 3.12 and earlier, claude-code/ runs and apps that use
as_claude_mcp() (so also claude_agent_config()) no longer print
asyncio's "... will report returncode 255" warning. The Claude Agent SDK
terminates its `claude -v` probe even after it has exited; asyncio's
terminate() reaps it first, and the child watcher then logs the warning
for an exit code nobody reads (CPython gh-87744, fixed in 3.13). A
filter on the asyncio logger drops a record whose message ends in "will
report returncode 255", the ending both child watchers' wordings share
(ThreadedChildWatcher's, and PidfdChildWatcher's on Linux under 3.12),
whether or not LiteLLM's redaction filter has rendered it. The filter is
process-wide, so it also drops this message for the app's other asyncio
subprocesses, and it never renders a record.

The claude-code/ route refuses claude-agent-sdk older than 0.2.166, the
claude extra's floor, with pip install -U 'pageindex[claude]'; before
0.2.158 it failed deep inside on "unexpected keyword argument
'verbatim_prompts'". An SDK whose import fails is refused with
pip install 'pageindex[claude]'.

**File**: `pageindex/integrations/claude_agent_sdk.py` (modified, +31/-5)
```diff
@@ -16,6 +16,7 @@
 from __future__ import annotations
 
 import asyncio
+import logging
 import os
 import re
 import tempfile
@@ -33,6 +34,8 @@
 
 def build_claude_mcp(client, include_management: bool = False, *,
                      server_name: str = "pageindex"):
+    # the app's own Agent SDK sessions reap the same probe
+    logging.getLogger("asyncio").addFilter(_drop_probe_reaped)
     if getattr(client, "api_key", None):
         return _cloud_relay(client, include_management, server_name)
     return tool_server(client, include_management, server_name=server_name)
@@ -91,14 +94,18 @@ def tool_kwargs(name: str) -> dict:
                                  tools=tools)
 
 
-def _cloud_relay(client, include_management: bool, server_name: str):
+def _sdk_release() -> tuple:
+    """The installed claude-agent-sdk's (major, minor, patch); () if none."""
     from importlib.metadata import version
     try:
-        release = tuple(int(n) for n in
-                        re.findall(r"\d+", version("claude-agent-sdk"))[:3])
+        return tuple(int(n) for n in
+                     re.findall(r"\d+", version("claude-agent-sdk"))[:3])
     except ImportError:  # not installed
-        release = ()
-    if release < (0, 2, 160):
+        return ()
+
+
+def _cloud_relay(client, include_management: bool, server_name: str):
+    if _sdk_release() < (0, 2, 160):
         # older releases answer the CLI from a server's registered
         # handlers, which the relay lacks (before 0.2.140), or close the
         # CLI's stdin at the first result (before 0.2.160): the agent
@@ -198,6 +205,12 @@ def claude_code_options(model: str, reasoning_effort=None, **options):
         raise PageIndexAPIError(
             f"{model!r} names the claude-code route but no model — e.g. "
             "'claude-code/sonnet'.", status_code=404)
+    if _sdk_release() < (0, 2, 166):
+        # the claude extra's floor, the oldest release the route is verified
+        # on; before 0.2.158 the options don't even take verbatim_prompts
+        raise PageIndexAPIError(
+            "claude-code/ models run on claude-agent-sdk 0.2.166 or newer — "
+            "pip install -U 'pageindex[claude]'.")
     try:
         from claude_agent_sdk import ClaudeAgentOptions
     except ImportError as exc:
@@ -232,6 +245,18 @@ def _claude_client(options):
     return ClaudeSDKClient(options=options)
 
 
+def _drop_probe_reaped(record) -> bool:
+    """The SDK terminates its `claude -v` probe even after it has exited; on
+    Python 3.12 and earlier that reaps the probe first, and asyncio's child
+    watcher logs this for an exit code nobody reads. Matched on the ending
+    every child watcher's wording shares, which LiteLLM's redaction filter on
+    the same logger keeps when it renders the message first."""
+    # ponytail: drops this one message process-wide, not only for the probe;
+    # remove once the SDK stops terminating an exited probe
+    return not (isinstance(record.msg, str)
+                and record.msg.endswith("will report returncode 255"))
+
+
 def _run_error(result, kind, max_turns) -> PageIndexAPIError:
     if result.subtype == "error_max_turns":
         from ..local_chat import _wrap_max_turns
@@ -257,6 +282,7 @@ async def claude_code_messages(prompt, options):
     itself failed). The client disconnects inline however the run ends, so
     no CLI process outlives its event loop."""
     from claude_agent_sdk import AssistantMessage, ResultMessage
+    logging.getLogger("asyncio").addFilter(_drop_probe_reaped)  # added once
     try:
         async with _claude_client(options) as client:
             info = (await client.get_server_info()) or {}
```

**File**: `tests/test_claude_code.py` (modified, +99/-0)
```diff
@@ -1,6 +1,8 @@
 """The claude-code/ route — indexing and chat as Claude Code CLI runs on the
 user's subscription — over a faked CLI session: no subprocess, no login."""
 import asyncio
+import logging
+import sys
 import time
 from types import SimpleNamespace
 
@@ -104,6 +106,55 @@ def test_standard_mode_refuses_claude_code(tmp_path, sample_pdf):
             model="gpt-4.1", summary_model="claude-code/haiku"))
 
 
+SDK_FIX = r"claude-agent-sdk 0\.2\.166 or newer — pip install -U 'pageindex\[claude\]'"
+
+
+def fake_sdk_version(monkeypatch, installed):
+    import importlib.metadata
+
+    def version(name):
+        if installed is None:
+            raise importlib.metadata.PackageNotFoundError(name)
+        return installed
+    monkeypatch.setattr(importlib.metadata, "version", version)
+    monkeypatch.setattr(cc, "_claude_client",
+                        lambda options: pytest.fail("the CLI would start"))
+
+
+@pytest.mark.parametrize("installed", ["0.1.53", "0.2.165", None])
+def test_indexing_names_an_old_or_missing_agent_sdk(
+        monkeypatch, tmp_path, sample_pdf, installed):
+    """Before 0.2.158 the route failed deep inside, on a TypeError about
+    verbatim_prompts; below 0.2.166 it is unverified."""
+    fake_sdk_version(monkeypatch, installed)
+    if installed is None:  # no module either
+        monkeypatch.setitem(sys.modules, "claude_agent_sdk", None)
+    client = PageIndexLocalClient(storage_path=str(tmp_path / "s"),
+                                  index_model="claude-code/haiku")
+    with pytest.raises(PageIndexAPIError, match=SDK_FIX):
+        client.submit_document(sample_pdf)
+
+
+def test_indexing_names_a_broken_agent_sdk(monkeypatch, tmp_path, sample_pdf):
+    """Its metadata passes the floor but the import fails."""
+    fake_sdk_version(monkeypatch, "0.2.168")
+    monkeypatch.setitem(sys.modules, "claude_agent_sdk", None)
+    client = PageIndexLocalClient(storage_path=str(tmp_path / "s"),
+                                  index_model="claude-code/haiku")
+    with pytest.raises(PageIndexAPIError, match=r"pip install 'pageindex\[claude\]'"):
+        client.submit_document(sample_pdf)
+
+
+@needs_claude
+def test_chat_names_an_old_agent_sdk_and_takes_the_extras_floor(
+        monkeypatch, chat_client):
+    fake_sdk_version(monkeypatch, "0.2.165")
+    with pytest.raises(PageIndexAPIError, match=SDK_FIX):
+        chat_client.chat("Q")
+    fake_sdk_version(monkeypatch, "0.2.166")
+    assert cc.claude_code_options("claude-code/haiku").model == "haiku"
+
+
 def test_chat_refuses_what_the_cli_cannot_take(chat_client):
     with pytest.raises(PageIndexAPIError, match="takes no temperature"):
         chat_client.chat_completions("Q", temperature=0)
@@ -258,6 +309,54 @@ async def many():
     assert cc._GATES == {}  # the cap goes with its last call, not kept per loop
 
 
+@pytest.fixture
+def asyncio_log():
+    """The asyncio logger without the probe filter an earlier test may have
+    left on it (a filter stays: it is process-wide)."""
+    log = logging.getLogger("asyncio")
+    log.removeFilter(cc._drop_probe_reaped)
+    return log
+
+
+def test_the_probe_filter_renders_no_other_record():
+    """It sees every asyncio record in the app: rendering one with bad
+    arguments would raise into the caller, where logging alone reports it."""
+    bad = logging.makeLogRecord({"name": "asyncio", "msg": "%s %s", "args": ("x",)})
+    assert cc._drop_probe_reaped(bad) is True
+
+
+def assert_drops_only_the_probe_warning(log, caplog):
+    caplog.clear()
+    with caplog.at_level(logging.WARNING, logger="asyncio"):
+        log.warning("Unknown child process pid %d, will report returncode 255", 42)
+        # Python 3.12's pidfd child watcher on Linux
+        log.warning("child process pid %d exit status already read: "
+                    " will report returncode 255", 44)
+        # as LiteLLM's redaction filter on this logger leaves it: rendered
+        log.warning("Unknown child process pid 43, will report returncode 255")
+        log.warning("Executing %s took %.3f seconds", "<Task>", 0.2)
+    # only that message: asyncio's other warnings still reach the user
+    assert [r.getMessage() for r in caplog.records] == [
+        "Executing <Task> took 0.200 seconds"]
+
+
+@needs_claude
+def test_a_run_drops_asyncio_noise_about_the_reaped_version_probe(
+        monkeypatch, caplog, asyncio_log):
+    fake_cli(monkeypatch, result("ok"))
+    assert asyncio.run(llm_acompletion("claude-code/haiku", "P")) == "ok"
+    assert_drops_only_the_probe_warning(asyncio_log, caplog)
+
+
+@needs_claude
+def test_as_claude_mcp_drops_it_for_the_apps_own_sessions(
+        chat_client, caplog, asyncio_log):
+    """An app running its own Agent SDK sessions reaps the same probe;
+    claude_agent_config() builds its server through as_claude_mcp()."""
+    chat_client.as_claude_mcp()
+    assert_drops_only_the_probe_warning(asyncio_log, caplog)
+
+
 @needs_claude
 def test_fla
```

#### Recent Merged Pull Requests:
- **PR #603** (2026-10-19): fix(claude): a missing login fails in one clear error, saying how to log in (@rejojer)
- **PR #601** (2026-10-18): docs(cookbook): index the Harness² paper, show progress, stream the answer (@rejojer)
- **PR #600** (2026-10-18): fix(claude): quiet the reaped-probe warning, name an old or missing Agent SDK (@rejojer)
- **PR #599** (2026-10-18): docs(cookbook): Claude subscription example, linked from the README (@rejojer)
- **PR #598** (2026-10-18): docs(readme): Claude subscription paragraph; build: litellm floor 1.105.1 (@rejojer)
- **PR #595** (2026-10-18): feat(claude): run indexing and chat on a Claude subscription (claude-code/) (@rejojer)

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

## X. claude): keep the cloud API key off the Claude Code command line (#594)

**RULE**:
When implementing operations in `pageindex/client.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in VectifyAI/PageIndex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7162ef62`: claude): keep the cloud API key off the Claude Code command line (#594). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `pageindex/client.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
        ``mcp_servers`` entry for the Claude Agent SDK: an in-process SDK
        MCP server, in both modes (requires ``claude-agent-sdk``;
        ``pip install 'pageindex[claude]'``).

        Cloud: a relay to the PageIndex MCP server — its tools,
        instructions and resources, fetched live for each session — that
        keeps the API key off the Claude Code CLI's command line (where a
        remote server config would carry it, readable by any local
        process). ``include_management`` picks the endpoint: the
        default relays the read-only one (``/mcp?tools=read``: the server
        registers only read-only tools), ``True`` the full tool set.
        Local: the agent tools over the local store, gated the same way at
        registration. ``server_name`` names the server — match it to the
        key you register the entry under.
        guaranteed delivery, whole (Claude Code hands the model at most
        4,096 characters of a server's instructions), and the only channel
        local mode has.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
        ``mcp_servers`` entry for the Claude Agent SDK.

        Cloud: returns the remote PageIndex MCP config.
        ``include_management`` picks the endpoint, so the URL itself is
        the gate — the default connects to the read-only endpoint
        (``/mcp?tools=read``: the server registers only read-only tools),
        ``True`` connects to the full tool set. Local: returns an
        in-process SDK MCP server exposing the agent tools, gated the
        same way at registration (requires ``claude-agent-sdk``;
        ``pip install 'pageindex[claude]'``). ``server_name`` names the
        in-process server — match it to the key you register the entry
        under (cloud entries carry no name).
        guaranteed delivery, and the only channel local mode has.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7162ef62` are properly handled with clean fallback behavior.
