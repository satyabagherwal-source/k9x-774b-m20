# Forensic Learning Record (Deep Inspection): mrexodia/ida-pro-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/mrexodia-ida-pro-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mrexodia/ida-pro-mcp](https://github.com/mrexodia/ida-pro-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:18:01.616Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mrexodia/ida-pro-mcp`
- **Description**: AI-powered reverse engineering assistant that bridges IDA Pro with language models through MCP.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 12482 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/ida_pro_mcp/ida_mcp/api_core.py`
```
"""Core API Functions - IDB metadata and basic queries"""

import logging
import re
import time
from typing import Annotated, Any, NotRequired, TypedDict

import ida_auto
import ida_bytes
import idaapi
import ida_funcs
import ida_hexrays
import ida_kernwin
import ida_lines
import ida_search
import ida_segment
import idautils
import ida_loader
import ida_nalt
import ida_typeinf
import idc

from .mainthread import get_pump
from .rpc import tool
from .sync import idasync, get_tool_deadline
from .utils import (
    ConvertedNumber,
    EntityQuery,
    Function,
    FunctionQuery,
    Global,
    Import,
    ListQuery,
    NumberConversion,
    Page,
    ImportQuery,
    get_function,
    normalize_dict_list,
    normalize_list_input,
    parse_address,
    paginate,
    pattern_filter,
)


logger = logging.getLogger(__name__)


class ServerHealthResult(TypedDict, total=False):
    status: str
    uptime_sec: float
    idb_path: str | None
    module: str
    input_path: str
    imagebase: str
    auto_analysis_ready: bool | None
    hexrays_ready: bool
    strings_cache_ready: bool
    strings_cache_size: int
    busy_tool: str
    busy_sec: float
    queued_calls: int


class ServerWarmupStep(TypedDict, total=False):
    step: str
    ok: bool
    ms: float
    error: str


class ServerWarmupResult(TypedDict):
    ok: bool
    steps: list[ServerWarmupStep]
    health: ServerHealthResult


class LookupFuncResult(TypedDict):
    query: str
    fn: Function | None
    error: str | None


class IntConvertResult(TypedDict):
    input: str
    result: ConvertedNumber | None
    error: str | None


class FunctionQueryRow(Function, total=False):
    has_type: bool
    size_int: int


class FunctionQueryPage(TypedDict, total=False):
    data: list[FunctionQueryRow]
    next_offset: int | None
    error: str | None


class EntityQueryPage(TypedDict, total=False):
    kind: str
    data: list[dict[str, Any]]
    next_offset: int | None
    total: int
    error: str | None


class ImportsQueryPage(TypedDict):
    data: list[Import]
    next_offset: int | None


class IdbSaveResult(TypedDict):
    ok: bool
    path: str | None
    error: NotRequired[str]


class FindRegexResult(TypedDict, total=False):
    n: int
    matches: list[dict[str, Any]]
    cursor: dict[str, Any]
    error: str | None


class SearchTextLine(TypedDict, total=False):
    kind: str  # "disasm" | "comment"
    text: str


class SearchTextHit(TypedDict, total=False):
    addr: str
    function: str
    segment: str
    matches: list[SearchTextLine]


class SearchTextResult(TypedDict, total=False):
    n: int
    hits: list[SearchTextHit]
    cursor: dict[str, Any]
    error: str


# Cached strings list: [(ea, text), ...]
_strings_cache: list[tuple[int, str]] | None = None
_server_started_at = time.time()


def _get_strings_cache() -> list[tuple[int, str]]:
    """Get cached strings, building cache on first access.

    Both ASCII (C-style) and UTF-16 (wide) strings are scanned so that
    ``find_regex`` can locate wide-char strings, which are common in Unreal
    Engine and Windows binaries. ``idautils.Strings()`` defaults to
    ``strtypes=[0]`` (C strings only), missing UTF-16 content — see #263.
    """
    global _strings_cache
    if _strings_cache is None:
        strings = idautils.Strings()
        # strtype 0 = C (ASCII/UTF-8), strtype 1 = Unicode C-Style (UTF-16).
        strings.setup(strtypes=[0, 1])
        _strings_cache = [(s.ea, str(s)) for s in strings if s is not None]
    return _strings_cache


def invalidate_strings_cache():
    """Clear the strings cache (call after IDB changes)."""
    global _strings_cache
    _strings_cache = None


def init_caches():
    """Build caches on plugin startup (called from Ctrl+M)."""
    t0 = time.perf_counter()
    strings = _get_strings_cache()
    t1 = time.perf_counter()
    logger.info("[MCP] Cached %d strings in %.0fms", len(strings), (t1 - t0) * 1000)


# ============================================================================
# Core API Functions
# ============================================================================


def _parse_func_query(query: str) -> int:
    """Fast path for common function query patterns. Returns ea or BADADDR."""
    q = query.strip()

    # 0x<hex> - direct address
    if q.startswith("0x") or q.startswith("0X"):
        try:
            return int(q, 16)
        except ValueError:
            pass

    # sub_<hex> - IDA auto-named function
    if q.startswith("sub_"):
        try:
            return int(q[4:], 16)
        except ValueError:
            pass

    return idaapi.BADADDR


def _coerce_sort_number(value, default: int = 0) -> int:
    """Parse decimal or prefixed string numbers used by generic entity rows."""
    if value in (None, ""):
        return default
    if isinstance(value, int):
        return value
    try:
        return int(str(value), 0)
    except (TypeError, ValueError):
        return default


def _collect_imports() -> list[Import]:
    """Collect all imports in the current database."""
    all_imports: list[Import] = []
    nimps = ida_nalt.get_import_module_qty()

    for i in range(nimps):
        module_name = ida_nalt.get_import_module_name(i)
        if not module_name:
            module_name = "<unnamed>"

        def imp_cb(ea, symbol_name, ordinal, acc):
            if not symbol_name:
                symbol_name = f"#{ordinal}"
            acc += [Import(addr=hex(ea), imported_name=symbol_name, module=module_name)]
            return True

        def imp_cb_w_context(ea, symbol_name, ordinal):
            return imp_cb(ea, symbol_name, ordinal, all_imports)

        ida_nalt.enum_import_names(i, imp_cb_w_context)

    return all_imports


def _segment_name_for_ea(ea: int) -> str | None:
    seg = idaapi.getseg(ea)
    if not seg:
        return None
    try:
        return idaapi.get_segm_name(seg)
    except Exception:
        return None


def _primary_text_key(kind: str) -> str:
    if kind == "strings":
        return "text"
    return "name"


def _collect_entities(kind: str) -> list[dict]:
    if kind == "functions":
        rows: list[dict] = []
        for ea in idautils.Functions():
            fn = idaapi.get_func(ea)
            if not fn:
                continue
            size_int = fn.end_ea - fn.start_ea
            rows.append(
                {
                    "kind": "function",
                    "addr": hex(fn.start_ea),
                    "name": ida_funcs.get_func_name(fn.start_ea) or "<unnamed>",
                    "size": hex(size_int),
                    "size_int": size_int,
                    "segment": _segment_name_for_ea(fn.start_ea),
                    "has_type": bool(ida_nalt.get_tinfo(ida_typeinf.tinfo_t(), fn.start_ea)),
                }
            )
        return rows

    if kind == "globals":
        rows = []
        for ea, name in idautils.Names():
            if idaapi.get_func(ea) or name is None:
                continue
            rows.append(
                {
                    "kind": "global",
                    "addr": hex(ea),
                    "name": name,
                    "size": idc.get_item_size(ea),
                    "segment": _segment_name_for_ea(ea),
                }
            )
        return rows

    if kind == "imports":
        rows = []
        for imp in _collect_imports():
            rows.append(
                {
                    "kind": "import",
                    "addr": imp["addr"],
                    "name": imp["imported_name"],
                    "module": imp["module"],
                }
            )
        return rows

    if kind == "strings":
        rows = []
        for ea, text in _get_strings_cache():
            rows.append(
                {
                    "kind": "string",
                    "addr": hex(ea),
                    "text": text,
                    "length": len(text),
                    "segment": _segment_name_for_ea(ea),
                }
            )
        return rows

    if kind == "names":
        rows = []
        imports_by_ea = {int(imp["addr"], 16): imp for imp in _collect_imports()}
        for ea, name in idautils.Names():
            is_function = bool(idaapi.get_func(ea))
            is_import = ea in imports_by_ea
            rows.append(
                {
                    "kind": "name",
                    "addr": hex(ea),
                    "name": name,
                    "segment": _segment_name_for_ea(ea),
                    "is_function": is_function,
                    "is_import": is_import,
                }
            )
        return rows

    return []


def _apply_projection(items: list[dict], fields: list[str] | None) -> list[dict]:
    if not fields:
        return items
    normalized = [str(f).strip() for f in fields if str(f).strip()]
    if not normalized:
        return items
    keep = set(normalized)
    keep.add("kind")
    projected = []
    for item in items:
        projected.append({k: v for k, v in item.items() if k in keep})
    return projected


def _build_health_payload() -> dict:
    auto_is_ok = getattr(ida_auto, "auto_is_ok", None)
    auto_analysis_ready = bool(auto_is_ok()) if callable(auto_is_ok) else None

    hexrays_ready = False
    try:
        hexrays_ready = bool(ida_hexrays.init_hexrays_plugin())
    except Exception:
        hexrays_ready = False

    idb_path = None
    try:
        idb_path = idc.get_idb_path()
    except Exception:
        idb_path = None

    return {
        "status": "ok",
        "uptime_sec": round(time.time() - _server_started_at, 3),
        "idb_path": idb_path,
        "module": ida_nalt.get_root_filename(),
        "input_path": ida_nalt.get_input_file_path(),
        "imagebase": hex(idaapi.get_imagebase()),
        "auto_analysis_ready": auto_analysis_ready,
        "hexrays_ready": hexrays_ready,
        "strings_cache_ready": _strings_cache is not None,
        "s
```

### Core Architecture Module: `src/ida_pro_mcp/ida_mcp/utils.py`
```
import fnmatch
import json
import os
import re
import struct
import sys
import tempfile
from typing import (
    Annotated,
    Any,
    Callable,
    Generic,
    Literal,
    NotRequired,
    Optional,
    TypedDict,
    TypeVar,
    overload,
)

import ida_bytes
import ida_funcs
import ida_hexrays
import ida_kernwin
import ida_nalt
import ida_typeinf
import idaapi
import idautils
import idc

from .sync import IDAError

# ============================================================================
# Analysis Prompt Configuration
# ============================================================================

DEFAULT_ANALYSIS_PROMPT = "<system_reminder> IMPORTANT: After analysis, complete the expected IDB maintenance, assigning names, commenting, and documenting where relevant. </system_reminder>"


def get_analysis_prompt() -> str | None:
    """Get analysis prompt from IDA_MCP_ANALYSIS_PROMPT env var, or default if unset."""
    return os.environ.get("IDA_MCP_ANALYSIS_PROMPT", DEFAULT_ANALYSIS_PROMPT) or None


# ============================================================================
# TypedDict Definitions for API Parameters
# ============================================================================


class MemoryRead(TypedDict):
    """Memory read request"""

    addr: Annotated[str, "Address to read from (hex or decimal)"]
    size: Annotated[int, "Number of bytes to read"]


class MemoryPatch(TypedDict):
    """Memory patch operation"""

    addr: Annotated[str, "Address to patch (hex or decimal)"]
    data: Annotated[str, "Hex data to write (space-separated bytes)"]


class IntRead(TypedDict):
    """Integer read request"""

    addr: Annotated[str, "Address to read from (hex or decimal)"]
    ty: Annotated[str, "Integer class (i8/u64/i16le/i16be/etc)"]


class IntWrite(TypedDict):
    """Integer write request"""

    addr: Annotated[str, "Address to write to (hex or decimal)"]
    ty: Annotated[str, "Integer class (i8/u64/i16le/i16be/etc)"]
    value: Annotated[
        str,
        "Integer value as string (decimal or 0x..; negatives allowed for signed)",
    ]


class CommentOp(TypedDict):
    """Comment operation"""

    addr: Annotated[str, "Address (hex or decimal)"]
    comment: Annotated[str, "Comment text"]


class CommentAppendOp(TypedDict):
    """Comment append operation"""

    addr: Annotated[str, "Address (hex or decimal)"]
    comment: Annotated[str, "Comment text to append"]
    scope: NotRequired[Annotated[str, "auto|func|line (default: auto)"]]
    dedupe: NotRequired[
        Annotated[bool, "Skip if exact text already exists (default: true)"]
    ]


class AsmPatchOp(TypedDict):
    """Assembly patch operation"""

    addr: Annotated[str, "Address (hex or decimal)"]
    asm: Annotated[str, "Assembly instruction(s), semicolon-separated"]


class FunctionRename(TypedDict):
    """Function rename operation"""

    addr: Annotated[str, "Function address (hex or decimal)"]
    name: Annotated[str, "New function name"]


class GlobalRename(TypedDict):
    """Global variable rename operation"""

    old: Annotated[str, "Current variable name"]
    new: Annotated[str, "New variable name"]


class LocalRename(TypedDict):
    """Local variable rename operation"""

    func_addr: Annotated[str, "Function address"]
    old: Annotated[str, "Current variable name"]
    new: Annotated[str, "New variable name"]


class StackRename(TypedDict):
    """Stack variable rename operation"""

    func_addr: Annotated[str, "Function address"]
    old: Annotated[str, "Current variable name"]
    new: Annotated[str, "New variable name"]


class RenameBatch(TypedDict, total=False):
    """Batch rename operations across all entity types.

    At least one of func/data/local/stack should be present.
    """

    func: Annotated[
        list[FunctionRename] | FunctionRename, "Function rename operations"
    ]
    data: Annotated[
        list[GlobalRename] | GlobalRename, "Global/data variable rename operations"
    ]
    local: Annotated[
        list[LocalRename] | LocalRename, "Local variable rename operations"
    ]
    stack: Annotated[
        list[StackRename] | StackRename, "Stack variable rename operations"
    ]
    stop_on_error: Annotated[bool, "Stop on first failure"]
    dry_run: Annotated[bool, "Validate only, no changes"]
    allow_overwrite: Annotated[bool, "Force overwrite existing names"]


class StructFieldQuery(TypedDict):
    """Struct field query for xrefs"""

    struct: Annotated[str, "Structure name"]
    field: Annotated[str, "Field name"]


class XrefQuery(TypedDict):
    """Generic cross-reference query"""

    addr: Annotated[str, "Address or name"]
    direction: NotRequired[Annotated[str, "to|from|both (default: both)"]]
    xref_type: NotRequired[Annotated[str, "any|code|data (default: any)"]]
    offset: NotRequired[Annotated[int, "Start index (default: 0)"]]
    count: NotRequired[Annotated[int, "Max results (default: 200, max: 5000)"]]
    include_fn: NotRequired[Annotated[bool, "Include function metadata"]]
    dedup: NotRequired[Annotated[bool, "Deduplicate by addr/type"]]
    sort_by: NotRequired[Annotated[str, "Sort: addr|type"]]
    descending: NotRequired[Annotated[bool, "Descending"]]


class ListQuery(TypedDict, total=False):
    """Pagination query for listing operations"""

    filter: Annotated[str, "Glob filter"]
    offset: Annotated[int, "Start index"]
    count: Annotated[int, "Max results (0=all)"]


class FunctionQuery(TypedDict, total=False):
    """Function query with richer filtering"""

    filter: Annotated[str, "Name glob/regex"]
    name_regex: Annotated[str, "Name regex"]
    min_size: Annotated[int, "Min size in bytes"]
    max_size: Annotated[int, "Max size in bytes"]
    has_type: Annotated[bool, "Require type info"]
    offset: Annotated[int, "Start index"]
    count: Annotated[int, "Max results (0=all)"]
    sort_by: Annotated[str, "Sort: addr|name|size"]
    descending: Annotated[bool, "Descending"]


class EntityQuery(TypedDict):
    """Generic IDB entity query with filtering, projection, and pagination"""

    kind: Annotated[str, "functions|globals|imports|strings|names"]
    filter: NotRequired[Annotated[str, "Glob/regex filter"]]
    regex: NotRequired[Annotated[str, "Regex on primary text field"]]
    min_addr: NotRequired[Annotated[str, "Min address bound"]]
    max_addr: NotRequired[Annotated[str, "Max address bound"]]
    segment: NotRequired[Annotated[str, "Segment filter"]]
    module: NotRequired[Annotated[str, "Import module filter"]]
    offset: NotRequired[Annotated[int, "Start index"]]
    count: NotRequired[Annotated[int, "Max results (0=all)"]]
    sort_by: NotRequired[Annotated[str, "Sort: addr|name|size|length"]]
    descending: NotRequired[Annotated[bool, "Descending"]]
    fields: NotRequired[Annotated[list[str], "Projection field list"]]


class FuncProfileQuery(TypedDict, total=False):
    """Function profiling query with pagination and optional detail lists.

    All fields are optional - omit addr to profile all functions.
    """

    addr: Annotated[str, "Function address or name (omit or '*' for all)"]
    filter: Annotated[str, "Name glob/regex"]
    offset: Annotated[int, "Start index"]
    count: Annotated[int, "Max results (0=all)"]
    sort_by: Annotated[str, "Sort: addr|name|size"]
    descending: Annotated[bool, "Descending"]
    include_lists: Annotated[bool, "Include callers/callees/strings/constants"]
    max_items: Annotated[int, "Max items per list"]
    include_prototype: Annotated[bool, "Include prototype"]


class AnalyzeBatchQuery(TypedDict):
    """Comprehensive function analysis request"""

    addr: Annotated[str, "Function address or name"]
    include_decompile: NotRequired[Annotated[bool, "Include decompiler output"]]
    include_disasm: NotRequired[Annotated[bool, "Include disassembly"]]
    include_xrefs: NotRequired[Annotated[bool, "Include xrefs-to/from"]]
    include_callers: NotRequired[Annotated[bool, "Include callers"]]
    include_callees: NotRequired[Annotated[bool, "Include callees"]]
    include_strings: NotRequired[Annotated[bool, "Include strings"]]
    include_constants: NotRequired[Annotated[bool, "Include constants"]]
    include_basic_blocks: NotRequired[Annotated[bool, "Include basic blocks"]]
    include_proto: NotRequired[Annotated[bool, "Include prototype"]]
    max_disasm_insns: NotRequired[Annotated[int, "Max disasm instructions"]]
    max_callers: NotRequired[Annotated[int, "Max callers"]]
    max_callees: NotRequired[Annotated[int, "Max callees"]]
    max_strings: NotRequired[Annotated[int, "Max strings"]]
    max_constants: NotRequired[Annotated[int, "Max constants"]]
    max_blocks: NotRequired[Annotated[int, "Max blocks"]]


class ImportQuery(TypedDict, total=False):
    """Import query with filtering and pagination"""

    filter: Annotated[str, "Name glob/regex"]
    module: Annotated[str, "Module glob/regex"]
    offset: Annotated[int, "Start index"]
    count: Annotated[int, "Max results (0=all)"]


class TypeInspectQuery(TypedDict):
    """Type inspection request"""

    name: Annotated[str, "Type name"]
    include_members: NotRequired[Annotated[bool, "Include UDT member details"]]
    max_members: NotRequired[Annotated[int, "Max members"]]


class TypeQuery(TypedDict, total=False):
    """Type catalog query with filtering, pagination, and optional relationships"""

    filter: Annotated[str, "Name glob/regex"]
    kind: Annotated[str, "any|struct|union|enum|typedef|func|ptr|udt"]
    offset: Annotated[int, "Start index"]
    count: Annotated[int, "Max results (0=all)"]
    sort_by: Annotated[str, "Sort: name|size|ordinal"]
    descending: Annotated[bool, "Descending"]
    include_decl: Annotated[bool, "Include declaration text"]
    include_members: Annotated[bool, "Include UDT member details"]
    max_members: Annotated[int, "Max members per UDT"]
    include_relationships: Annotated[bool, "Include related type names"]


class BreakpointOp(TypedDict):
```

### Core Architecture Module: `src/ida_pro_mcp/worker_lifecycle.py`
```
"""Worker self-shutdown bookkeeping.

A spawned idalib worker exits cleanly when no JSON-RPC request has hit its
dispatcher for `idle_ttl_sec` seconds. There is no per-supervisor refcount;
every callable client keeps the worker alive simply by issuing requests
through `idb_open`, `idb_list`, or any forwarded tool.

This module has no IDA dependencies on purpose so it can be unit-tested
outside of IDA.
"""

import logging
import threading
import time
from typing import Any, Callable

logger = logging.getLogger(__name__)


class WorkerLifecycle:
    """Idle-timeout watchdog for an idalib worker process."""

    IDLE_TTL_SEC = 600.0
    POLL_INTERVAL_SEC = 5.0
    MIN_IDLE_TTL_SEC = 10.0

    def __init__(
        self,
        *,
        idle_ttl_sec: float | None = None,
        poll_interval_sec: float | None = None,
    ):
        self.idle_ttl_sec: float = (
            idle_ttl_sec if idle_ttl_sec is not None else self.IDLE_TTL_SEC
        )
        self.poll_interval_sec = (
            poll_interval_sec if poll_interval_sec is not None else self.POLL_INTERVAL_SEC
        )
        self._lock = threading.Lock()
        self._last_request_at = time.monotonic()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._on_shutdown: Callable[[str], None] | None = None
        self._busy_probe: Callable[[], bool] | None = None

    def set_busy_probe(self, probe: Callable[[], bool]) -> None:
        """Register a callback reporting whether a call is currently running.

        Requests touch the timer on arrival, so a call longer than the TTL
        would otherwise look idle and be shut down mid-work.
        """
        self._busy_probe = probe

    def start(self, on_shutdown: Callable[[str], None]) -> None:
        if self._thread is not None:
            return
        self._on_shutdown = on_shutdown
        self._thread = threading.Thread(
            target=self._run, daemon=True, name="idalib-watchdog"
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        thread = self._thread
        self._thread = None
        if thread is not None:
            thread.join(timeout=5.0)

    def touch(self) -> None:
        with self._lock:
            self._last_request_at = time.monotonic()

    def set_idle_ttl(self, user_ttl_sec: float, load_time_sec: float = 0.0) -> None:
        with self._lock:
            self.idle_ttl_sec = (
                max(self.MIN_IDLE_TTL_SEC, user_ttl_sec) + max(0.0, load_time_sec)
            )

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            now = time.monotonic()
            return {
                "last_request_age_sec": round(now - self._last_request_at, 2),
                "idle_ttl_sec": self.idle_ttl_sec,
            }

    def check_shutdown_reason(self) -> str | None:
        with self._lock:
            last_req = self._last_request_at
            ttl = self.idle_ttl_sec
        if ttl <= 0:
            return None  # long-lived worker: never self-exit
        if self._busy_probe is not None and self._busy_probe():
            return None  # mid tool call: not idle, however long it takes
        now = time.monotonic()
        if (now - last_req) > ttl:
            return f"no requests for {now - last_req:.1f}s"
        return None

    def _run(self) -> None:
        while not self._stop_event.wait(self.poll_interval_sec):
            reason = self.check_shutdown_reason()
            if reason is None:
                continue
            self._fire_shutdown(reason)
            return

    def _fire_shutdown(self, reason: str) -> None:
        if self._on_shutdown is None:
            return
        try:
            self._on_shutdown(reason)
        except Exception:
            logger.exception("Lifecycle on_shutdown handler raised")

```

### Core Architecture Module: `scripts/stress_search_cancellation.py`
```
#!/usr/bin/env python3
"""Stress test: search-cancellation behavior (issue #235).

Validates that the cancellation plumbing in sync.py works end-to-end:
  - find_bytes / find / search_text are interrupted at the configured tool
    timeout via ida_kernwin.set_cancelled() fired by sync_wrapper.
  - a slow scan does NOT cause subsequent calls to time out (no sticky
    failure: the main thread is freed within one cancel-poll cycle of the
    deadline).
  - the recovered server state is clean (cancel flag cleared in finally).

Usage:
    # Headless: spawn our own idalib-mcp on a binary (RECOMMENDED — a wedge
    # only kills the spawned subprocess, not your GUI session)
    python3 scripts/stress_search_cancellation.py --spawn path/to/binary
    python3 scripts/stress_search_cancellation.py --spawn path/to/binary.i64

    # Drive an already-running server (GUI plugin or external idalib)
    python3 scripts/stress_search_cancellation.py --url http://127.0.0.1:13337/mcp
    python3 scripts/stress_search_cancellation.py --phases 0,3,5    # subset

Spawned mode passes --unsafe automatically so py_eval is available; the script
uses py_eval to override the server-side tool timeout via IDA_MCP_TOOL_TIMEOUT_SEC
so we can exercise cancellation without waiting for the 60s default.
"""

from __future__ import annotations
import argparse
import atexit
import json
import os
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_URL = "http://127.0.0.1:13337/mcp"
HEADERS = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}


@dataclass
class Ctx:
    url: str
    database: str | None
    short_timeout: float
    long_timeout: float
    binary_info: dict = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)
    passes: list[str] = field(default_factory=list)


# ─── Headless idalib-mcp lifecycle ─────────────────────────────────────────

def _free_port() -> int:
    """Bind a temporary socket to get an unused port on 127.0.0.1."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def spawn_idalib(binary: Path, *, port: int | None = None,
                 boot_timeout: float = 600.0) -> tuple[subprocess.Popen, str]:
    """Spawn `uv run idalib-mcp --unsafe --port=<p> <binary>` and wait until
    it is ready to serve. Returns (proc, url). Auto-killed at exit.

    Boot timeout is generous because idalib has to run auto-analysis on the
    binary, which can take minutes on large inputs.
    """
    if not binary.exists():
        raise FileNotFoundError(binary)
    port = port or _free_port()
    url = f"http://127.0.0.1:{port}/mcp"
    print(f"  spawning: uv run idalib-mcp --unsafe --port={port} {binary}")
    log_path = Path(f"/tmp/stress_idalib_{port}.log")
    log = open(log_path, "wb")
    proc = subprocess.Popen(
        ["uv", "run", "idalib-mcp", "--unsafe", "--port", str(port), str(binary)],
        stdout=log, stderr=subprocess.STDOUT,
        # Own process group so we can SIGTERM the whole tree on exit.
        preexec_fn=os.setsid if hasattr(os, "setsid") else None,
    )
    atexit.register(_kill_proc, proc)
    print(f"  log: {log_path}  pid: {proc.pid}")
    # Wait for "Server started" / readiness in the log, plus a live HTTP probe.
    deadline = time.monotonic() + boot_timeout
    last_status = None
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(
                f"idalib-mcp exited early (code={proc.returncode}); "
                f"check {log_path}"
            )
        try:
            txt = log_path.read_text(errors="replace")
        except Exception:
            txt = ""
        if "Streamable HTTP" in txt or "[MCP] Server started" in txt:
            # Server is up. Now wait for the worker to finish opening the IDB.
            status = _wait_until_session_ready(url, deadline)
            if status == "ready":
                print(f"  idalib ready at {url}")
                return proc, url
            last_status = status
        time.sleep(2.0)
    raise TimeoutError(
        f"idalib-mcp didn't become ready in {boot_timeout}s "
        f"(last={last_status}); see {log_path}"
    )


def _wait_until_session_ready(url: str, deadline: float) -> str:
    """Poll idb_list until at least one session is is_active=true and not analyzing."""
    while time.monotonic() < deadline:
        try:
            payload = {"jsonrpc": "2.0", "id": "boot", "method": "tools/call",
                       "params": {"name": "idb_list", "arguments": {}}}
            req = urllib.request.Request(url, json.dumps(payload).encode(), HEADERS)
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = json.loads(resp.read().decode())
            sc = body.get("result", {}).get("structuredContent", {})
            sessions = sc.get("sessions") or []
            if sessions and any(s.get("is_active") and not s.get("is_analyzing") for s in sessions):
                return "ready"
            return "analyzing" if sessions else "no_session"
        except Exception:
            pass
        time.sleep(2.0)
    return "timeout"


def _kill_proc(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    try:
        if hasattr(os, "killpg"):
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        else:
            proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            if hasattr(os, "killpg"):
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            else:
                proc.kill()
    except ProcessLookupError:
        pass


def discover_session(url: str) -> str | None:
    """Return the first active session id for the URL, or None (GUI plugin)."""
    payload = {"jsonrpc": "2.0", "id": "ls", "method": "tools/call",
               "params": {"name": "idb_list", "arguments": {}}}
    req = urllib.request.Request(url, json.dumps(payload).encode(), HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode())
    except Exception:
        return None
    res = body.get("result", {})
    if res.get("isError"):
        return None
    sc = res.get("structuredContent") or {}
    sessions = sc.get("sessions") or []
    for s in sessions:
        if s.get("is_active"):
            return s.get("session_id")
    return None


# ─── Low-level RPC ─────────────────────────────────────────────────────────

def rpc(ctx: Ctx, name: str, args: dict, *, client_timeout: float) -> tuple[float, dict, str]:
    """Send tools/call. Returns (wall_seconds, structured_or_None, raw_text_or_error)."""
    args = dict(args)
    if ctx.database:
        args.setdefault("database", ctx.database)
    payload = {"jsonrpc": "2.0", "id": name, "method": "tools/call",
               "params": {"name": name, "arguments": args}}
    req = urllib.request.Request(ctx.url, json.dumps(payload).encode(), HEADERS)
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=client_timeout) as resp:
            body = json.loads(resp.read().decode())
    except Exception as e:
        return time.monotonic() - t0, {}, f"HTTP-ERROR {type(e).__name__}: {e}"
    dt = time.monotonic() - t0
    result = body.get("result", {})
    if result.get("isError"):
        text = result.get("content", [{}])[0].get("text", "")
        return dt, {}, f"TOOL-ERROR {text}"
    sc = result.get("structuredContent") or {}
    return dt, sc, ""


def py(ctx: Ctx, code: str, *, client_timeout: float = 30) -> tuple[float, str, str]:
    """Run a one-liner via py_eval. Returns (wall, result_str, error_str)."""
    dt, sc, err = rpc(ctx, "py_eval", {"code": code}, client_timeout=client_timeout)
    if err:
        return dt, "", err
    return dt, str(sc.get("result", "")), str(sc.get("stderr", ""))


def set_server_timeout(ctx: Ctx, seconds: float | None) -> None:
    """Override the server-side per-tool timeout via os.environ. None = unset.

    Note: os.environ requires string values, so the seconds float must be
    stringified — silently sending a float raises TypeError on the server
    and the timeout never actually changes.
    """
    if seconds is None:
        code = "import os; os.environ.pop('IDA_MCP_TOOL_TIMEOUT_SEC', None); 'unset'"
    else:
        code = (
            f"import os; "
            f"os.environ['IDA_MCP_TOOL_TIMEOUT_SEC'] = {str(seconds)!r}; "
            f"os.environ['IDA_MCP_TOOL_TIMEOUT_SEC']"
        )
    _, r, e = py(ctx, code)
    if e:
        raise RuntimeError(f"set_server_timeout({seconds}) failed: {e}")
    if seconds is not None and r != str(seconds):
        raise RuntimeError(f"set_server_timeout({seconds}) returned {r!r}")


# ─── Reporting helpers ─────────────────────────────────────────────────────

def hr(title: str) -> None:
    print(f"\n{'─'*4} {title} {'─'*max(4, 70-len(title))}")

def check(ctx: Ctx, name: str, ok: bool, detail: str) -> None:
    badge = "PASS" if ok else "FAIL"
    print(f"  [{badge}] {name}: {detail}")
    (ctx.passes if ok else ctx.failures).append(name)


# ─── Phases ────────────────────────────────────────────────────────────────

def phase_0_probe(ctx: Ctx) -> None:
    hr("phase 0 — probe environment & detect mode")
    # New sync.py loaded? Check both GUI plugin (ida_mcp.sync) and idalib
    # worker (ida_pro_mcp.ida_mcp.sync) module naming.
    _, r, _ = py(ctx,
        "import sys; "
        "m = sys.modules.get('ida_mcp.sync') or sys.modules.get('ida_pro_mcp.ida_mcp.sync'); "
        "'NEW' if (m and hasattr(m,'ida_kernwin')) else 'OLD'")
    check(ctx, "sync.py has cancellation plumbing", r == "NEW",
          r if r else "couldn't
```

### Core Architecture Module: `src/ida_pro_mcp/__main__.py`
```
import sys
from ida_pro_mcp.server import main

if __name__ == "__main__":
    sys.argv[0] = "ida_pro_mcp"
    main()

```

### Core Architecture Module: `src/ida_pro_mcp/ida_mcp.py`
```
"""IDA Pro MCP Plugin Loader

This file serves as the entry point for IDA Pro's plugin system.
It loads the actual implementation from the ida_mcp package.
"""

import sys
import idaapi
import ida_kernwin
import ida_netnode
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import ida_mcp


NETNODE_AUTOSTART = "$ ida_mcp.autostart"
NETNODE_CONFIG = "$ ida_mcp.config"
_ALT_PORT = 0  # altval index for the persisted port (0 = not set)
_ALT_PERSIST = 1  # altval index for the "save host/port" preference
_SUP_HOST = 0  # supval index for the persisted host


def _get_autostart() -> bool:
    """Read the autostart preference from the IDB. Defaults to True."""
    node = ida_netnode.netnode(NETNODE_AUTOSTART)
    val = node.altval(0)  # 0 = not set, 1 = off, 2 = on
    return val != 1


def _set_autostart(enabled: bool):
    """Persist the autostart preference into the IDB."""
    node = ida_netnode.netnode(NETNODE_AUTOSTART, 0, True)
    node.altset(0, 1 if not enabled else 2)


def _get_port(default: int) -> int:
    """Read the persisted server port from the IDB. Defaults to `default`."""
    node = ida_netnode.netnode(NETNODE_CONFIG)
    val = node.altval(_ALT_PORT)  # 0 = not set
    return val if val != 0 else default


def _set_port(port: int):
    """Persist the server port into the IDB."""
    node = ida_netnode.netnode(NETNODE_CONFIG, 0, True)
    node.altset(_ALT_PORT, port)


def _get_host(default: str) -> str:
    """Read the persisted server host from the IDB. Defaults to `default`."""
    node = ida_netnode.netnode(NETNODE_CONFIG)
    val = node.supstr(_SUP_HOST)
    return val if val else default


def _set_host(host: str):
    """Persist the server host into the IDB."""
    node = ida_netnode.netnode(NETNODE_CONFIG, 0, True)
    node.supset(_SUP_HOST, host)


def _get_persist() -> bool:
    """Read the 'save host/port' preference from the IDB. Defaults to True."""
    node = ida_netnode.netnode(NETNODE_CONFIG)
    val = node.altval(_ALT_PERSIST)  # 0 = not set, 1 = off, 2 = on
    return val != 1


def _set_persist(enabled: bool):
    """Persist the 'save host/port' preference into the IDB."""
    node = ida_netnode.netnode(NETNODE_CONFIG, 0, True)
    node.altset(_ALT_PERSIST, 2 if enabled else 1)


def _clear_endpoint():
    """Forget any persisted host/port so the next load uses the defaults."""
    node = ida_netnode.netnode(NETNODE_CONFIG, 0, True)
    node.altdel(_ALT_PORT)
    node.supdel(_SUP_HOST)


def unload_package(package_name: str):
    """Remove every module that belongs to the package from sys.modules."""
    to_remove = [
        mod_name
        for mod_name in sys.modules
        if mod_name == package_name or mod_name.startswith(package_name + ".")
    ]
    for mod_name in to_remove:
        del sys.modules[mod_name]


CONFIG_ACTION_ID = "mcp:configure"
CONFIG_ACTION_LABEL = "MCP Configuration"


class MCPConfigForm(idaapi.Form):
    """Form to configure MCP server host and port."""

    def __init__(self, host: str, port: int, autostart: bool, persist: bool):
        form_str = r"""STARTITEM 0
MCP Server Configuration

<Host:{host}>
<Port:{port}>
<Autostart server when IDA opens:{autostart}>
<Save host and port to this database:{save_endpoint}>{checks}>
"""
        super().__init__(
            form_str,
            {
                "host": idaapi.Form.StringInput(value=host),
                "port": idaapi.Form.NumericInput(value=port, tp=idaapi.Form.FT_DEC),
                "checks": idaapi.Form.ChkGroupControl(
                    ("autostart", "save_endpoint"),
                    value=(1 if autostart else 0) | (2 if persist else 0),
                ),
            },
        )


class MCPConfigHandler(idaapi.action_handler_t):
    def __init__(self, plugin: "MCP"):
        idaapi.action_handler_t.__init__(self)
        self.plugin = plugin

    def activate(self, ctx):
        old_host = self.plugin.host
        old_port = self.plugin.port
        old_autostart = self.plugin.autostart
        old_persist = self.plugin.persist_endpoint

        form = MCPConfigForm(
            self.plugin.host,
            self.plugin.port,
            self.plugin.autostart,
            self.plugin.persist_endpoint,
        )
        form.Compile()
        ok = form.Execute()
        if ok != 1:
            form.Free()
            return 0

        host = form.host.value
        port = form.port.value
        autostart = bool(form.checks.value & 1)
        persist = bool(form.checks.value & 2)
        form.Free()

        if port < 1 or port > 65535:
            print(f"[MCP] Invalid port: {port}")
            return 0

        if autostart != old_autostart:
            self.plugin.autostart = autostart
            _set_autostart(autostart)
            print(f"[MCP] Autostart {'enabled' if autostart else 'disabled'}")

        if persist != old_persist:
            self.plugin.persist_endpoint = persist
            _set_persist(persist)
            print(f"[MCP] Save host/port {'enabled' if persist else 'disabled'}")

        endpoint_changed = host != old_host or port != old_port
        self.plugin.host = host
        self.plugin.port = port

        # Save or forget the endpoint based on the preference.
        if persist:
            _set_host(host)
            _set_port(port)
            if endpoint_changed or persist != old_persist:
                print(f"[MCP] Configuration updated: {host}:{port} (saved to IDB)")
        else:
            if persist != old_persist:
                _clear_endpoint()  # next load falls back to defaults
            if endpoint_changed:
                print(f"[MCP] Configuration updated: {host}:{port} (not saved)")

        if not endpoint_changed and autostart == old_autostart and persist == old_persist:
            print(f"[MCP] Configuration unchanged: {host}:{port}")
            return 1

        # Apply new endpoint immediately if the server is running.
        if endpoint_changed and self.plugin.mcp is not None:
            print("[MCP] Applying configuration change without manual restart...")
            self.plugin.run(0)
        return 1

    def update(self, ctx):
        return idaapi.AST_ENABLE_ALWAYS


class MCPUIHooks(ida_kernwin.UI_Hooks):
    """Defers menu attachment and autostart until the UI is fully ready."""

    def __init__(self, plugin: "MCP"):
        super().__init__()
        self.plugin = plugin

    def ready_to_run(self):
        ida_kernwin.attach_action_to_menu(
            "Edit/Plugins/", CONFIG_ACTION_ID, idaapi.SETMENU_APP
        )
        # Skip autostart when running under idalib – the idalib_server manages
        # the MCP server lifecycle itself and would otherwise hit a port conflict
        # because unload_package creates a separate MCP_SERVER instance.
        if self.plugin.autostart and ida_kernwin.is_idaq():
            print("[MCP] Autostarting server...")
            self.plugin.run(0)
        self.unhook()


class MCP(idaapi.plugin_t):
    flags = idaapi.PLUGIN_KEEP
    comment = "MCP Plugin"
    help = "MCP"
    wanted_name = "MCP"
    wanted_hotkey = "Ctrl-Alt-M"

    DEFAULT_HOST = "127.0.0.1"
    DEFAULT_PORT = 13337

    def init(self):
        hotkey = MCP.wanted_hotkey.replace("-", "+")
        if __import__("sys").platform == "darwin":
            hotkey = hotkey.replace("Alt", "Option")

        self.mcp: "ida_mcp.rpc.McpServer | None" = None
        self.autostart = _get_autostart()
        self.persist_endpoint = _get_persist()
        if self.persist_endpoint:
            self.host = _get_host(self.DEFAULT_HOST)
            self.port = _get_port(self.DEFAULT_PORT)
        else:
            self.host = self.DEFAULT_HOST
            self.port = self.DEFAULT_PORT

        if self.autostart and ida_kernwin.is_idaq():
            print("[MCP] Plugin loaded, server will start automatically")
        elif not ida_kernwin.is_idaq():
            print("[MCP] Plugin loaded (idalib mode, server managed externally)")
        else:
            print(
                f"[MCP] Plugin loaded, use Edit -> Plugins -> MCP ({hotkey}) to start the server"
            )

        # Register a separate menu item for host/port configuration
        ida_kernwin.register_action(
            ida_kernwin.action_desc_t(
                CONFIG_ACTION_ID,
                CONFIG_ACTION_LABEL,
                MCPConfigHandler(self),
            )
        )
        # Defer menu attachment and autostart until the UI is fully initialized
        self._ui_hooks = MCPUIHooks(self)
        self._ui_hooks.hook()

        return idaapi.PLUGIN_KEEP

    def _unregister_instance(self):
        port = getattr(self, "_registered_port", None)
        if port is not None:
            try:
                if TYPE_CHECKING:
                    from .ida_mcp.discovery import unregister_instance
                else:
                    from ida_mcp.discovery import unregister_instance
                unregister_instance(port)
            except Exception as e:
                print(f"[MCP] Instance unregistration failed: {e}")
            self._registered_port = None

    def run(self, arg):
        if self.mcp:
            self._unregister_instance()
            self.mcp.stop()
            self.mcp = None

        # HACK: ensure fresh load of ida_mcp package
        unload_package("ida_mcp")
        if TYPE_CHECKING:
            from .ida_mcp import MCP_SERVER, IdaMcpHttpRequestHandler
        else:
            from ida_mcp import MCP_SERVER, IdaMcpHttpRequestHandler

        port = self.port
        max_port = port + 100
        while port < max_port:
            try:
                MCP_SERVER.serve(
                    self.host, port, request_handler=IdaMcpHttpRequestHandler
                )
                print(f"  Config: http://{self.host}:{port}/config.html")
                self.mcp = MCP_SERVER
                self._register_instance(port)
                return
            except OSError as e:
                if
```

### Core Architecture Module: `src/ida_pro_mcp/ida_mcp/__init__.py`
```
"""IDA Pro MCP Plugin - Modular Package Version

This package provides MCP (Model Context Protocol) integration for IDA Pro,
enabling AI assistants to interact with IDA's disassembler and decompiler.

Architecture:
- rpc.py: JSON-RPC infrastructure and registry
- mcp.py: MCP protocol server (HTTP/SSE)
- sync.py: IDA synchronization decorator (@idasync)
- utils.py: Shared helpers and TypedDict definitions
- api_*.py: Modular API implementations (75 tools + 24 resources)
"""

# Ignore SIGPIPE to prevent IDA from being killed when an MCP client
# disconnects while the HTTP server is writing a response. IDA's embedded
# Python may not preserve CPython's default SIG_IGN for SIGPIPE.
import signal

if hasattr(signal, "SIGPIPE"):
    signal.signal(signal.SIGPIPE, signal.SIG_IGN)

# Import infrastructure modules
from . import rpc
from . import sync
from . import utils

# Import all API modules to register @tool functions and @resource functions
from . import api_core
from . import api_analysis
from . import api_memory
from . import api_types
from . import api_modify
from . import api_stack
from . import api_debug
from . import api_python
from . import api_resources
from . import api_survey
from . import api_composite
from . import trace as trace
from . import api_sigmaker

# Re-export key components for external use
from .sync import idasync, IDAError, IDASyncError, CancelledError
from .rpc import MCP_SERVER, MCP_UNSAFE, tool, unsafe, resource
from .http import IdaMcpHttpRequestHandler
from .api_core import init_caches

# Tracing is always on: every tools/call is recorded into the IDB netnode.
trace.configure_idb()

__all__ = [
    # Infrastructure modules
    "rpc",
    "sync",
    "utils",
    # API modules
    "api_core",
    "api_analysis",
    "api_memory",
    "api_types",
    "api_modify",
    "api_stack",
    "api_debug",
    "api_python",
    "api_resources",
    "api_survey",
    "api_composite",
    "api_sigmaker",
    # Re-exported components
    "idasync",
    "IDAError",
    "IDASyncError",
    "CancelledError",
    "MCP_SERVER",
    "MCP_UNSAFE",
    "tool",
    "unsafe",
    "resource",
    "IdaMcpHttpRequestHandler",
    "init_caches",
]

```

### Core Architecture Module: `src/ida_pro_mcp/ida_mcp/_sigmaker.py`
```
"""
Vendored sigmaker core — signature creation and scanning engine.

Original: sigmaker.py - IDA Python Signature Maker
https://github.com/mahmoudimus/ida-sigmaker
by @mahmoudimus (Mahmoud Abdelkader)

This is a stripped-down, self-contained copy of the sigmaker library
with GUI/plugin code removed.  Only the engine classes are kept so that
api_sigmaker.py can use them without an external dependency.

Synced with upstream v1.8.0.  Ported engine improvements over the original
v1.6.0 vendoring:
  - WildcardPolicy.for_x86 no longer wildcards immediates (literals baked
    into the encoding do not move between builds, so wildcarding them only
    removes bytes that would have made the signature unique).
  - SignatureSearcher.is_unique bails at the second match instead of
    enumerating every match -- a large win on big binaries where a short,
    common prefix can match millions of positions.
  - GeneratedSignature orders by (length, wildcard_count) so the xref
    ranking prefers the most specific signature among equal-length ones.
  - MinimalFunctionSignatureGenerator finds the shortest unique signature
    anywhere inside a function body (not just from its entry point).
  - SIMD seed-and-refine helpers are carried over for parity; they are
    inert unless a compiled `_speedups` module is present.

This file has no third-party dependencies: it relies only on idaapi/idc and
the standard library. The compiled `_speedups` module is optional; when it is
absent, scanning falls back to idaapi.bin_search.

The interactive layers (IDA Forms, the plugin class, wait-box progress
dialogs, clipboard, and the cProfile diagnostics) are intentionally NOT
vendored: this engine runs inside an MCP server, where popping modal UI
or blocking on user input is never appropriate.

MIT License

Copyright (c) 2024 Mahmoud Abdelkader (@mahmoudimus)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

from __future__ import annotations

import array
import contextlib
import contextvars
import dataclasses
import enum
import functools
import logging
import pathlib
import re
import string
import typing

import idaapi
import idc

__author__ = "mahmoudimus"
__version__ = "1.8.0"


WILDCARD_POLICY_CTX: contextvars.ContextVar["WildcardPolicy"] = contextvars.ContextVar(
    "wildcard_policy"
)


SIMD_SPEEDUP_AVAILABLE = False
with contextlib.suppress(ImportError):
    try:
        from sigmaker._speedups import simd_scan
    except ImportError:
        from _sigmaker._speedups import simd_scan  # type: ignore[import-not-found]

    _SimdSignature = simd_scan.Signature
    _simd_scan_bytes = simd_scan.scan_bytes

    SIMD_SPEEDUP_AVAILABLE = True


# How many matches a scan loop processes between cancellation polls.
# idaapi.user_cancelled() is not a cheap predicate (it pumps the UI event
# loop), and a short, common pattern can match tens of millions of positions,
# so polling too often makes the poll itself the dominant cost. Polling every
# 65536 matches keeps that overhead near a second while leaving cancel
# responsive. Only the SIMD scan loops consult this.
_CANCEL_POLL_STRIDE: int = 65536


def _user_canceled() -> bool:
    """Headless-safe wrapper around IDA's cancellation predicate.

    IDA exposes the British spelling ``user_cancelled``. In a headless idalib
    context the function still exists and simply returns False, so polling it
    is harmless; guard anyway so the engine never hard-depends on it.
    """
    fn = getattr(idaapi, "user_cancelled", None)
    if fn is None:
        return False
    try:
        return bool(fn())
    except Exception:
        return False


def configure_logging(
    logger=None,
    logging_name="sigmaker",
    level=logging.INFO,
    handler_filters=None,
    fmt_str="[%(levelname)s] @ %(message)s",
):
    if logger is None:
        logger = logging.getLogger(logging_name)

    logger.propagate = False
    logger.setLevel(level)
    formatter = logging.Formatter(fmt_str)
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    handler.setLevel(level)

    if handler_filters is not None:
        for _filter in handler_filters:
            handler.addFilter(_filter)

    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
        handler.close()

    if not logger.handlers:
        logger.addHandler(handler)
    return logger


LOGGER = configure_logging()


class Unexpected(Exception):
    """Exception type used throughout the module to indicate unexpected errors."""


class UserCanceledError(Exception):
    """Raised when an optional progress reporter signals cancellation.

    Headless callers do not pass a reporter, so this is effectively inert in
    the MCP server; it is kept so the generator signatures stay compatible
    with the upstream engine.
    """


class ProgressReporter(typing.Protocol):
    """Minimal protocol for cooperative cancellation of long operations."""

    def should_cancel(self) -> bool: ...


@functools.total_ordering
@dataclasses.dataclass(frozen=True)
class IDAVersionInfo:
    major: int
    minor: int
    sdk_version: int

    def __eq__(self, other):
        if isinstance(other, IDAVersionInfo):
            return (self.major, self.minor) == (other.major, other.minor)
        if isinstance(other, tuple):
            return (self.major, self.minor) == tuple(other[:2])
        return NotImplemented

    def __lt__(self, other):
        if isinstance(other, IDAVersionInfo):
            return (self.major, self.minor) < (other.major, other.minor)
        if isinstance(other, tuple):
            return (self.major, self.minor) < tuple(other[:2])
        return NotImplemented

    @staticmethod
    @functools.cache
    def ida_version():
        version_str: str = idaapi.get_kernel_version()
        sdk_version: int = idaapi.IDA_SDK_VERSION
        major, minor = map(int, version_str.split("."))
        return IDAVersionInfo(major, minor, sdk_version)


ida_version = IDAVersionInfo.ida_version


def is_address_marked_as_code(ea: int) -> bool:
    return idaapi.is_code(idaapi.get_flags(ea))


@dataclasses.dataclass(slots=True)
class InMemoryBuffer:
    class LoadMode(enum.Enum):
        SEGMENTS = "segments"
        FILE = "file"

    file_path: pathlib.Path
    mode: LoadMode = dataclasses.field(default=LoadMode.SEGMENTS)
    _buffer: bytearray = dataclasses.field(
        default_factory=bytearray, init=False, repr=False
    )

    @property
    def file_size(self) -> int:
        return idaapi.retrieve_input_file_size()

    @property
    def imagebase(self) -> int:
        return idaapi.get_imagebase()

    def _load_segments(self):
        buf = self._buffer
        seg = idaapi.get_first_seg()
        while seg:
            size = seg.end_ea - seg.start_ea
            data = idaapi.get_bytes(seg.start_ea, size)
            if data:
                buf.extend(data)
            seg = idaapi.get_next_seg(seg.start_ea)

    def _load_input_file(self):
        if not self.file_path.exists():
            raise RuntimeError(f"Input file {self.file_path} does not exist.")
        with self.file_path.open("rb") as f:
            self._buffer = bytearray(f.read())

    @classmethod
    def load(
        cls,
        file_path: str | pathlib.Path | None = None,
        mode: "InMemoryBuffer.LoadMode" = LoadMode.SEGMENTS,
    ) -> "InMemoryBuffer":
        if file_path is None:
            file_path = idaapi.get_input_file_path()
        if isinstance(file_path, str):
            file_path = pathlib.Path(file_path)
        instance = cls(file_path=file_path, mode=mode)
        if mode == cls.LoadMode.FILE:
            instance._load_input_file()
        else:
            instance._load_segments()
        return instance

    def data(self) -> memoryview:
        return memoryview(self._buffer)

    def clear(self):
        self._buffer.clear()

    def file_offset_to_ida_addr(self, file_offset: int) -> int:
        if self.mode != self.LoadMode.FILE:
            raise RuntimeError("file_offset_to_ida_addr is only valid in 'file' mode.")
        return self.imagebase + file_offset

    def ida_addr_to_file_offset(self, ida_addr: int) -> int:
        if self.mode != self.LoadMode.FILE:
            raise RuntimeError("ida_addr_to_file_offset is only valid in 'file' mode.")
        return ida_addr - self.imagebase

    def segment_offset_to_ida_addr(self, seg_offset: int) -> int:
        if self.mode != self.LoadMode.SEGMENTS:
            raise RuntimeError(
                "segment_offset_to_ida_addr is only valid in 'segments' mode."
            )
        return self.imagebase + seg_offset

    def ida_addr_to_segment_offset(self, ida_addr: int) -> int:
        if self.mode != self.LoadMode.SEGMENTS:
            raise RuntimeError(
                "ida_addr_to_segment_offset is only valid in 'segments' mode."
            )
        return ida_addr - self.imagebase


@dataclasses.dataclass
class SigMakerConfig:
    output_format: SignatureType
    wildcard_operands: bool
    contin
```

### Core Architecture Module: `src/ida_pro_mcp/ida_mcp/api_analysis.py`
```
import json
import struct
from itertools import islice
from typing import Annotated, Any, NotRequired, Optional, TypedDict
import ida_lines
import ida_funcs
import idaapi
import idautils
import ida_typeinf
import ida_nalt
import ida_bytes
import ida_ida
import ida_idaapi
import ida_kernwin
import ida_xref
import ida_ua
import ida_name
from .rpc import OUTPUT_LIMIT_MAX_CHARS, tool
from .sync import idasync, tool_timeout, IDAError
from .utils import (
    parse_address,
    normalize_list_input,
    normalize_dict_list,
    get_function,
    get_prototype,
    paginate,
    pattern_filter,
    get_stack_frame_variables_internal,
    decompile_function_safe,
    compact_whitespace,
    get_assembly_lines,
    get_all_xrefs,
    get_all_comments,
    Function,
    get_callers,
    get_callees,
    extract_function_strings,
    extract_function_constants,
    Argument,
    DisassemblyFunction,
    Ref,
    Xref,
    BasicBlock,
    StructFieldQuery,
    XrefQuery,
    InsnPattern,
    FuncProfileQuery,
    AnalyzeBatchQuery,
)
from . import compat


class ResultCursor(TypedDict, total=False):
    next: int
    done: bool
    cancelled: bool


class DecompileResult(TypedDict):
    addr: str
    code: str | None
    line_count: NotRequired[int]
    total_lines: NotRequired[int]
    truncated: NotRequired[bool]
    cursor: NotRequired[ResultCursor]
    refs: NotRequired[list[Ref]]
    refs_truncated: NotRequired[bool]
    error: NotRequired[str]


class DisasmResult(TypedDict, total=False):
    addr: str
    asm: DisassemblyFunction | None
    instruction_count: int
    total_instructions: int | None
    cursor: ResultCursor
    error: str


class FuncProfileItem(TypedDict, total=False):
    addr: str
    name: str
    size: str
    instruction_count: int
    basic_block_count: int
    caller_count: int
    callee_count: int
    string_ref_count: int
    constant_count: int
    has_type: bool
    prototype: str | None
    callers: list[dict[str, Any]]
    callers_truncated: bool
    callees: list[dict[str, Any]]
    callees_truncated: bool
    strings: list[dict[str, Any]]
    strings_truncated: bool
    constants: list[dict[str, Any]]
    constants_truncated: bool
    error: str | None


class FuncProfileResult(TypedDict, total=False):
    target: str
    data: list[FuncProfileItem]
    next_offset: int | None
    error: str | None


class AnalyzeBatchDisasm(TypedDict):
    lines: list[str]
    instruction_count: int
    truncated: bool


AnalyzeBatchXrefs = TypedDict(
    "AnalyzeBatchXrefs",
    {
        "to": list[dict[str, str]],
        "from": list[dict[str, str]],
        "to_truncated": bool,
        "from_truncated": bool,
        "to_count": int,
        "from_count": int,
    },
)


class AnalyzeBatchDetails(TypedDict, total=False):
    size: str
    prototype: str | None
    decompile: str | None
    decompile_error: str | None
    disasm: AnalyzeBatchDisasm | None
    xrefs: AnalyzeBatchXrefs | None
    callers: list[dict[str, Any]] | None
    caller_count: int
    callers_truncated: bool
    callees: list[dict[str, Any]] | None
    callee_count: int
    callees_truncated: bool
    strings: list[dict[str, Any]] | None
    string_ref_count: int
    strings_truncated: bool
    constants: list[dict[str, Any]] | None
    constant_count: int
    constants_truncated: bool
    basic_blocks: list[BasicBlock] | None
    basic_block_count: int
    basic_blocks_truncated: bool


class AnalyzeBatchResult(TypedDict, total=False):
    target: str
    addr: str | None
    name: str | None
    analysis: AnalyzeBatchDetails | None
    error: str | None


class XrefsToResult(TypedDict, total=False):
    addr: str
    xrefs: list[Xref] | None
    more: bool
    xref_count: int
    message: str
    error: str


XrefQueryRow = TypedDict(
    "XrefQueryRow",
    {
        "direction": str,
        "addr": str,
        "from": str,
        "to": str,
        "type": str,
        "fn": Function | None,
    },
    total=False,
)


class XrefQueryResult(TypedDict, total=False):
    target: str
    resolved_addr: str | None
    direction: str
    xref_type: str
    data: list[XrefQueryRow]
    next_offset: int | None
    total: int
    message: str
    error: str | None


class StructFieldXrefsResult(TypedDict, total=False):
    struct: str
    field: str
    xrefs: list[Xref]
    message: str
    error: str


class CalleeResultItem(TypedDict):
    addr: str
    name: str
    type: str


class CalleesResult(TypedDict, total=False):
    addr: str
    callees: list[CalleeResultItem] | None
    more: bool
    error: str


class FindBytesResult(TypedDict, total=False):
    pattern: str
    matches: list[str]
    n: int
    cursor: ResultCursor
    error: str


class BasicBlocksResult(TypedDict, total=False):
    addr: str
    error: str
    blocks: list[BasicBlock]
    count: int
    total_blocks: int
    cursor: ResultCursor


class FindResult(TypedDict, total=False):
    query: str | int | None
    matches: list[str]
    count: int
    cursor: ResultCursor
    error: str | None


class InsnScanRange(TypedDict):
    start: str
    end: str


class InsnQuerySummary(TypedDict, total=False):
    mnem: str | None
    op0: int | str | None
    op1: int | str | None
    op2: int | str | None
    op_any: int | str | None
    func: str | None
    segment: str | None
    start: str | None
    end: str | None
    offset: int
    count: int
    max_scan_insns: int
    allow_broad: bool


class InsnQueryMatch(TypedDict, total=False):
    addr: str
    disasm: str
    fn: Function | None


class InsnQueryResult(TypedDict, total=False):
    query: InsnQuerySummary
    ranges: list[InsnScanRange]
    matches: list[InsnQueryMatch]
    count: int
    cursor: ResultCursor
    scanned: int
    truncated: bool
    next_start: str | None
    error: str | None


class ExportedFunctionJson(TypedDict, total=False):
    addr: str
    name: str | None
    prototype: str | None
    size: str
    comments: dict[str, dict[str, str]]
    asm: str
    code: str | None
    decompile_error: str | None
    xrefs: dict[str, list[dict[str, str]]]
    error: str


class ExportedPrototype(TypedDict, total=False):
    name: str | None
    prototype: str


class ExportFuncsJsonResult(TypedDict):
    format: str
    functions: list[ExportedFunctionJson]


class ExportFuncsHeaderResult(TypedDict):
    format: str
    content: str


class ExportFuncsPrototypesResult(TypedDict):
    format: str
    functions: list[ExportedPrototype]


class CallGraphNode(TypedDict):
    addr: str
    name: str | None
    depth: int


CallGraphEdge = TypedDict(
    "CallGraphEdge",
    {"from": str, "to": str, "type": str},
)


class CallGraphResult(TypedDict, total=False):
    root: str
    nodes: list[CallGraphNode]
    edges: list[CallGraphEdge]
    max_depth: int
    truncated: bool
    limit_reason: str | None
    max_nodes: int
    max_edges: int
    max_edges_per_func: int
    per_func_capped: bool
    error: str


# ============================================================================
# Instruction Helpers
# ============================================================================

_IMM_SCAN_BACK_MAX = 15


def _raw_bin_search(
    ea: int, max_ea: int, data: bytes, mask: bytes, flags: int = 0
) -> int:
    """Search for raw bytes with mask, compatible across IDA versions.

    Returns the match address, or idaapi.BADADDR if not found.
    """
    search_flags = flags or (ida_bytes.BIN_SEARCH_FORWARD | ida_bytes.BIN_SEARCH_NOSHOW)
    return compat.raw_bin_search(ea, max_ea, data, mask, search_flags)


def _decode_insn_at(ea: int) -> ida_ua.insn_t | None:
    insn = ida_ua.insn_t()
    if ida_ua.decode_insn(insn, ea) == 0:
        return None
    return insn


def _next_head(ea: int, end_ea: int) -> int:
    return ida_bytes.next_head(ea, end_ea)


def _operand_value(insn: ida_ua.insn_t, i: int) -> int | None:
    op = insn.ops[i]
    if op.type == ida_ua.o_void:
        return None
    if op.type in (ida_ua.o_mem, ida_ua.o_far, ida_ua.o_near):
        return op.addr
    return op.value


def _operand_matches(insn: ida_ua.insn_t, i: int, value: int) -> bool:
    op_val = _operand_value(insn, i)
    if op_val is None:
        return False
    if op_val == value:
        return True
    op = insn.ops[i]
    if op.type != ida_ua.o_imm:
        return False
    # IDA sign-extends immediates to 64 bits (`mov eax, 80000000h` has value
    # 0xFFFFFFFF80000000), so compare at the operand's own width and accept
    # either the signed or the unsigned spelling of the value.
    bits = ida_ua.get_dtype_size(op.dtype) * 8
    if not 8 <= bits <= 64 or not -(1 << (bits - 1)) <= value < (1 << bits):
        return False
    mask = (1 << bits) - 1
    return (op_val & mask) == (value & mask)


def _operand_type(insn: ida_ua.insn_t, i: int) -> int:
    return insn.ops[i].type


def _insn_mnem(insn: ida_ua.insn_t) -> str:
    try:
        return insn.get_canon_mnem().lower()
    except Exception:
        return ""


def _value_to_le_bytes(value: int) -> tuple[bytes, int, int] | None:
    if value < 0:
        if value >= -0x80000000:
            size = 4
            value &= 0xFFFFFFFF
        elif value >= -0x8000000000000000:
            size = 8
            value &= 0xFFFFFFFFFFFFFFFF
        else:
            return None
    else:
        if value <= 0xFFFFFFFF:
            size = 4
        elif value <= 0xFFFFFFFFFFFFFFFF:
            size = 8
        else:
            return None

    fmt = "<I" if size == 4 else "<Q"
    return struct.pack(fmt, value), size, value


def _value_candidates_for_immediate(value: int) -> list[tuple[int, int, bytes]]:
    candidates: list[tuple[int, int, bytes]] = []

    def add(size: int, signed_val: int):
        if size == 4:
            masked = signed_val & 0xFFFFFFFF
            if not (-0x80000000 <= signed_val <= 0xFFFFFFFF):
                return
            b = struct.pack("<I", masked)
        else:
            masked = signed_val & 0xFFFFFFFF
```

### Core Architecture Module: `src/ida_pro_mcp/ida_mcp/api_composite.py`
```
"""Composite analysis tools that aggregate multiple data sources."""

from __future__ import annotations

from collections import defaultdict
from typing import Annotated, Any, TypedDict

from .rpc import tool, unsafe
from .sync import idasync, tool_timeout, IDAError
from .utils import (
    parse_address,
    get_function,
    get_prototype,
    get_callees,
    get_callers,
    get_all_xrefs,
    get_all_comments,
    extract_function_strings,
    extract_function_constants,
    get_stack_frame_variables_internal,
    decompile_function_safe,
    get_assembly_lines,
    normalize_list_input,
)

# Max decompile lines before truncation.
_DECOMPILE_LINE_CAP = 100
# Max strings/constants returned in compact mode.
_TOP_STRINGS = 10
_TOP_CONSTANTS = 10
# Constants filtered out of extract_function_constants results.
_BORING_CONSTANTS = frozenset({0, 1, -1, 0xFF, 0xFFFF, 0xFFFFFFFF, 0xFFFFFFFFFFFFFFFF})


class BasicBlockSummary(TypedDict):
    count: int
    cyclomatic_complexity: int


class AnalyzeFunctionResult(TypedDict, total=False):
    addr: str
    name: str
    prototype: str | None
    size: int
    decompiled: str | None
    decompile_error: str | None
    decompile_truncated: int
    assembly: str | None
    strings: list[str]
    constants: list[dict[str, Any]]
    callees: list[str]
    callers: list[str]
    xrefs: dict[str, Any]
    comments: dict[str, Any]
    basic_blocks: BasicBlockSummary
    error: str | None


class ComponentFunctionSummary(TypedDict, total=False):
    addr: str
    name: str
    prototype: str | None
    size: int
    callees: list[str]
    strings: list[str]
    basic_blocks: int
    complexity: int
    error: str


ComponentGraphEdge = TypedDict(
    "ComponentGraphEdge",
    {"from": str, "to": str, "name": str},
)


class InternalCallGraph(TypedDict):
    nodes: list[str]
    edges: list[ComponentGraphEdge]


class SharedGlobalInfo(TypedDict):
    addr: str
    name: str
    accessed_by: list[str]


class AnalyzeComponentResult(TypedDict, total=False):
    functions: list[ComponentFunctionSummary]
    internal_call_graph: InternalCallGraph
    shared_globals: list[SharedGlobalInfo]
    interface_functions: list[str]
    internal_only: list[str]
    string_usage: dict[str, list[str]]
    error: str


class DiffBeforeAfterResult(TypedDict, total=False):
    before: str | None
    after: str | None
    action_applied: str
    changes_detected: bool
    error: str


class TraceDataFlowNode(TypedDict):
    addr: str
    func: str | None
    instruction: str | None
    type: str
    name: str | None
    depth: int


TraceDataFlowEdge = TypedDict(
    "TraceDataFlowEdge",
    {"from": str, "to": str, "type": str},
)


class TraceDataFlowResult(TypedDict, total=False):
    start: str
    direction: str
    depth_reached: int
    nodes: list[TraceDataFlowNode]
    edges: list[TraceDataFlowEdge]
    error: str


# ---------------------------------------------------------------------------
# Internal helpers (no @tool — called from within @idasync context)
# ---------------------------------------------------------------------------

def _resolve_addr(addr: str) -> int:
    """Resolve address or name to ea. Raises IDAError on failure."""
    import idaapi

    try:
        return parse_address(addr)
    except IDAError:
        ea = idaapi.get_name_ea(idaapi.BADADDR, addr)
        if ea == idaapi.BADADDR:
            raise IDAError(f"Address/name not found: {addr!r}")
        return ea


def _basic_block_info(ea: int) -> BasicBlockSummary:
    """Return block count and cyclomatic complexity for the function at *ea*."""
    import idaapi

    func = idaapi.get_func(ea)
    if func is None:
        return {"count": 0, "cyclomatic_complexity": 0}

    fc = idaapi.FlowChart(func)
    nodes = 0
    edges = 0
    for block in fc:
        nodes += 1
        for _ in block.succs():
            edges += 1

    return {"count": nodes, "cyclomatic_complexity": edges - nodes + 2}


def _filter_constants(raw: list[dict], limit: int = _TOP_CONSTANTS) -> list[dict]:
    """Drop boring constants, return top N by absolute value."""
    out = []
    for c in raw:
        val = c.get("value", 0)
        if not isinstance(val, int):
            continue
        if abs(val) < 0x100 or val in _BORING_CONSTANTS:
            continue
        out.append(c)
    out.sort(key=lambda c: abs(c.get("value", 0)) if isinstance(c.get("value"), int) else 0, reverse=True)
    return out[:limit]


def _cap_decompile(code: str | None) -> tuple[str | None, int | None]:
    """Cap decompiled output at _DECOMPILE_LINE_CAP lines.
    Returns (possibly_truncated_code, total_lines_or_None)."""
    if code is None:
        return None, None
    lines = code.split("\n")
    total = len(lines)
    if total <= _DECOMPILE_LINE_CAP:
        return code, None  # not truncated
    truncated = "\n".join(lines[:_DECOMPILE_LINE_CAP])
    return truncated, total


def _compact_strings(raw: list[dict], limit: int = _TOP_STRINGS) -> list[str]:
    """Return just the string values, deduplicated, capped at limit."""
    seen: set[str] = set()
    out: list[str] = []
    for s in raw:
        val = s.get("value") or s.get("string", "")
        if val and val not in seen:
            seen.add(val)
            out.append(val)
            if len(out) >= limit:
                break
    return out


def _compact_callees(raw: list[dict]) -> list[str]:
    """Return just callee names/addresses as strings."""
    return [c.get("name") or c.get("addr", "?") for c in raw]


def _analyze_function_internal(
    ea: int, *, include_asm: bool = False
) -> AnalyzeFunctionResult:
    """Core analysis logic — must be called from an @idasync context.

    Returns a compact response by default: decompilation capped at 100 lines,
    top 10 strings as values only, top 10 non-trivial constants, no disassembly.
    Pass include_asm=True to include full disassembly."""
    import idaapi

    result: dict = {"addr": hex(ea), "error": None}

    try:
        func = idaapi.get_func(ea)
        if func is None:
            result["error"] = f"No function at {hex(ea)}"
            return result

        result["name"] = idaapi.get_func_name(ea) or ""
        result["prototype"] = get_prototype(func)
        result["size"] = func.end_ea - func.start_ea

        # Decompilation — capped at _DECOMPILE_LINE_CAP lines.
        raw_code, decompile_err = decompile_function_safe(ea)
        if raw_code is None:
            result["decompiled"] = None
            if decompile_err:
                result["decompile_error"] = decompile_err
        else:
            code, total_lines = _cap_decompile(raw_code)
            result["decompiled"] = code
            if total_lines is not None:
                result["decompile_truncated"] = total_lines

        # Assembly — opt-in only.
        if include_asm:
            try:
                result["assembly"] = get_assembly_lines(ea)
            except Exception:
                result["assembly"] = None

        # Strings — top 10 values only.
        result["strings"] = _compact_strings(extract_function_strings(ea))
        # Constants — top 10 non-trivial.
        result["constants"] = _filter_constants(extract_function_constants(ea))
        # Callees/callers — names only.
        result["callees"] = _compact_callees(get_callees(hex(ea)))
        result["callers"] = _compact_callees(get_callers(hex(ea)))
        result["xrefs"] = get_all_xrefs(ea)
        result["comments"] = get_all_comments(ea)
        result["basic_blocks"] = _basic_block_info(ea)

    except Exception as exc:
        result["error"] = str(exc)

    return result


# ---------------------------------------------------------------------------
# Tool 1 — analyze_function
# ---------------------------------------------------------------------------


@tool
@idasync
@tool_timeout(120.0)
def analyze_function(
    addr: Annotated[str, "Function address or name"],
    include_asm: Annotated[bool, "Include full disassembly (default: false, saves tokens)"] = False,
) -> AnalyzeFunctionResult:
    """Compact single-function analysis: pseudocode, strings, constants, callers, callees, xrefs, blocks."""

    try:
        ea = _resolve_addr(addr)
    except IDAError as exc:
        return {"addr": addr, "error": str(exc)}

    return _analyze_function_internal(ea, include_asm=include_asm)


# ---------------------------------------------------------------------------
# Tool 2 — analyze_component
# ---------------------------------------------------------------------------


@tool
@idasync
@tool_timeout(180.0)
def analyze_component(
    addrs: Annotated[list[str] | str, "Function addresses (comma-separated or list)"],
) -> AnalyzeComponentResult:
    """Analyze related functions as a group: per-function summaries, internal call graph, shared data."""

    import idaapi
    import idautils

    raw = normalize_list_input(addrs)
    if not raw:
        return {"error": "Empty address list"}

    ea_map: dict[int, str] = {}
    for a in raw:
        try:
            ea_map[_resolve_addr(a)] = a
        except IDAError:
            return {"error": f"Cannot resolve address: {a!r}"}

    ea_set = set(ea_map.keys())

    # --- Per-function COMPACT summary (no decompile, no disasm) ---
    functions: list[dict] = []
    for ea in ea_set:
        func = idaapi.get_func(ea)
        if func is None:
            functions.append({"addr": hex(ea), "error": "No function"})
            continue
        name = idaapi.get_func_name(ea) or ""
        strings_raw = extract_function_strings(ea)
        top_strings = _compact_strings(strings_raw, limit=5)
        callee_list = _compact_callees(get_callees(hex(ea)))
        bb = _basic_block_info(ea)
        functions.append({
            "addr": hex(ea),
            "name": name,
            "prototype": get_prototype(func),
            "size": func.end_ea - func.start_ea,
            "callees": callee_list,
            "strings": top_strings,
```

### Core Architecture Module: `src/ida_pro_mcp/ida_mcp/api_debug.py`
```
"""Debugger operations for IDA Pro MCP.

This module provides comprehensive debugging functionality including:
- Debugger control (start, exit, continue, step, run_to)
- Breakpoint management (add, delete, enable/disable, conditions, list)
- Register inspection (all registers, GP registers, specific registers)
- Memory operations (read/write debugger memory)
- Call stack inspection
"""

import os
from typing import Annotated, NotRequired, TypedDict

import idc
import ida_dbg
import ida_entry
import ida_idd
import ida_idaapi
import ida_kernwin
import ida_name
import idaapi

from .rpc import tool, unsafe, ext
from .sync import idasync, keep_batch, get_pre_call_batch, IDAError
from .utils import (
    RegisterValue,
    ThreadRegisters,
    Breakpoint,
    BreakpointConditionOp,
    BreakpointOp,
    MemoryRead,
    MemoryPatch,
    normalize_list_input,
    normalize_dict_list,
    parse_address,
)


class DebugControlResult(TypedDict, total=False):
    ip: str
    started: bool
    continued: bool
    running: bool
    suspended: bool
    exited: bool
    state: str
    error: str


class BreakpointResult(TypedDict, total=False):
    addr: str
    ok: bool
    condition: str | None
    language: str | None
    error: str


class ThreadRegistersResult(TypedDict, total=False):
    tid: int
    regs: ThreadRegisters | None
    error: str


class StackFrameInfo(TypedDict):
    addr: str
    module: str
    symbol: str


class DebugMemoryReadResult(TypedDict):
    addr: str | None
    size: int
    data: str | None
    error: NotRequired[str | None]


class DebugMemoryWriteResult(TypedDict, total=False):
    addr: str | None
    size: int
    ok: bool
    error: str | None


# ============================================================================
# Constants and Helper Functions
# ============================================================================

GENERAL_PURPOSE_REGISTERS = {
    "EAX",
    "EBX",
    "ECX",
    "EDX",
    "ESI",
    "EDI",
    "EBP",
    "ESP",
    "EIP",
    "RAX",
    "RBX",
    "RCX",
    "RDX",
    "RSI",
    "RDI",
    "RBP",
    "RSP",
    "RIP",
    "R8",
    "R9",
    "R10",
    "R11",
    "R12",
    "R13",
    "R14",
    "R15",
}


def _get_process_state_name() -> str:
    if not ida_dbg.is_debugger_on():
        return "not_running"

    state = ida_dbg.get_process_state()
    if state == ida_dbg.DSTATE_SUSP:
        return "suspended"
    if state == ida_dbg.DSTATE_RUN:
        return "running"
    if state == ida_dbg.DSTATE_NOTASK:
        return "not_running"
    return f"unknown({state})"


def _get_debug_state_result() -> DebugControlResult:
    state = _get_process_state_name()
    result: DebugControlResult = {"state": state}
    if state == "running":
        result["running"] = True
    elif state == "suspended":
        result["suspended"] = True
        ip = ida_dbg.get_ip_val()
        if ip is not None:
            result["ip"] = hex(ip)
    return result


def dbg_ensure_active() -> "ida_idd.debugger_t":
    dbg = ida_idd.get_dbg()
    if not dbg or not ida_dbg.is_debugger_on():
        raise IDAError(
            "Debugger not running. Stop and ask the user to start a debugger "
            "session (call dbg_start, or have them launch from IDA) before "
            "retrying. If dbg_start has already been attempted and failed, "
            "the user must first configure the debugger and target."
        )
    return dbg


def dbg_ensure_suspended() -> "ida_idd.debugger_t":
    dbg = dbg_ensure_active()
    if ida_dbg.get_process_state() != ida_dbg.DSTATE_SUSP:
        raise IDAError(
            "Debugger is running; wait until it suspends before inspecting state"
        )
    return dbg


def _get_registers_for_thread(dbg: "ida_idd.debugger_t", tid: int) -> ThreadRegisters:
    """Helper to get registers for a specific thread."""
    regs = []
    regvals: ida_idd.regvals_t = ida_dbg.get_reg_vals(tid)
    for reg_index, rv in enumerate(regvals):
        rv: ida_idd.regval_t
        reg_info = dbg.regs(reg_index)

        try:
            reg_value = rv.pyval(reg_info.dtype)
        except ValueError:
            reg_value = ida_idaapi.BADADDR

        if isinstance(reg_value, int):
            reg_value = hex(reg_value)
        if isinstance(reg_value, bytes):
            reg_value = reg_value.hex(" ")
        else:
            reg_value = str(reg_value)
        regs.append(
            RegisterValue(
                name=reg_info.name,
                value=reg_value,
            )
        )
    return ThreadRegisters(
        thread_id=tid,
        registers=regs,
    )


def _get_registers_general_for_thread(
    dbg: "ida_idd.debugger_t", tid: int
) -> ThreadRegisters:
    """Helper to get general-purpose registers for a specific thread."""
    all_registers = _get_registers_for_thread(dbg, tid)
    general_registers = [
        reg
        for reg in all_registers["registers"]
        if reg["name"] in GENERAL_PURPOSE_REGISTERS
    ]
    return ThreadRegisters(
        thread_id=tid,
        registers=general_registers,
    )


def _get_registers_specific_for_thread(
    dbg: "ida_idd.debugger_t", tid: int, register_names: list[str]
) -> ThreadRegisters:
    """Helper to get specific registers for a given thread."""
    all_registers = _get_registers_for_thread(dbg, tid)
    specific_registers = [
        reg for reg in all_registers["registers"] if reg["name"] in register_names
    ]
    return ThreadRegisters(
        thread_id=tid,
        registers=specific_registers,
    )


def _normalize_breakpoint_language(language: object) -> str | None:
    if language is None:
        return None
    text = str(language).strip()
    if not text:
        return None
    lowered = text.lower()
    if lowered == "idc":
        return "IDC"
    if lowered == "python":
        return "Python"
    return text


def _get_breakpoint_language(bpt: ida_dbg.bpt_t) -> str | None:
    language = getattr(bpt, "elang", None)
    if language is None:
        return None
    text = str(language).strip()
    return text or None


def _set_breakpoint_language(bpt: ida_dbg.bpt_t, language: str) -> None:
    setter = getattr(bpt, "set_cnd_elang", None)
    if callable(setter):
        if not setter(language):
            raise IDAError(f"Failed to set breakpoint condition language to {language}")
        return
    try:
        setattr(bpt, "elang", language)
    except Exception as exc:
        raise IDAError(
            f"Failed to set breakpoint condition language to {language}"
        ) from exc


def list_breakpoints() -> list[Breakpoint]:
    breakpoints: list[Breakpoint] = []
    for i in range(ida_dbg.get_bpt_qty()):
        bpt = ida_dbg.bpt_t()
        if ida_dbg.getn_bpt(i, bpt):
            breakpoints.append(
                Breakpoint(
                    addr=hex(bpt.ea),
                    enabled=bool(bpt.flags & ida_dbg.BPT_ENABLED),
                    condition=str(bpt.condition) if bpt.condition else None,
                    language=_get_breakpoint_language(bpt),
                )
            )
    return breakpoints


# ============================================================================
# Debugger Control Operations
# ============================================================================


def _get_debug_start_result() -> DebugControlResult | None:
    if not ida_dbg.is_debugger_on():
        return None
    result = _get_debug_state_result()
    result["started"] = True
    return result


# Batch-mode lifecycle for dbg_start.
#
# start_process schedules work that runs on the IDA main thread *after* our
# execute_sync returns. That work can show modal dialogs (e.g. "matching
# executable names"), so we need batch mode to remain on across the
# execute_sync boundary, and we need to be sure to turn it back off once the
# debugger has actually come up (or failed to). _DbgStartBatchHook does both.
_DBG_START_BATCH_FALLBACK_MS = 30_000  # absolute ceiling on stuck-in-batch state
_DBG_START_WAIT_TIMEOUT_SEC = 10.0
_DBG_START_WAIT_POLL_MS = 100
_DBG_START_IP_GRACE_POLL_COUNT = 5


class _DbgStartBatchHook(ida_dbg.DBG_Hooks):
    """Restore batch mode as soon as the debugger has finished STARTUP.

    "Startup" ends at dbg_process_start / dbg_process_attach — by then any
    startup dialogs (e.g. "matching executable names") are done, but the
    user is still inside an active debug session and should see normal
    dialogs from here on. dbg_process_exit / dbg_process_detach also
    restore so we don't get stuck if the process dies before fully coming
    up.
    """

    def __init__(self, restore_batch: int):
        super().__init__()
        self._restore_batch = restore_batch
        self._done = False

    def dbg_process_start(self, pid, tid, ea, name, base, size):
        self._restore()

    def dbg_process_attach(self, pid, tid, ea, name, base, size):
        self._restore()

    def dbg_process_exit(self, pid, tid, ea, exit_code):
        self._restore()

    def dbg_process_detach(self, pid, tid, ea):
        self._restore()

    def fallback_restore(self):
        """Called by the safety timer if no debugger event ever arrives."""
        self._restore()

    def _restore(self):
        if self._done:
            return
        self._done = True
        try:
            self.unhook()
        except Exception:
            pass
        idc.batch(self._restore_batch)


_dbg_start_batch_hook: _DbgStartBatchHook | None = None


def _arm_dbg_start_batch_hook(restore_batch: int) -> None:
    """Install the batch-restore hook before start_process is invoked."""
    global _dbg_start_batch_hook
    if _dbg_start_batch_hook is not None:
        _dbg_start_batch_hook.fallback_restore()
    hook = _DbgStartBatchHook(restore_batch)
    hook.hook()
    _dbg_start_batch_hook = hook

    def _fallback():
        if _dbg_start_batch_hook is hook and not hook._done:
            hook.fallback_restore()
        return -1  # don't repeat

    ida
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #398** (2026-06-06): **`make_signature_for_function` : Full image bytearray is rebuilt on every uniqueness check**
  *Symptoms*: This line https://github.com/mrexodia/ida-pro-mcp/blob/8461a5f7fb249d3fa3a59a4050c678708aaaa199/src/ida_pro_mcp/ida_mcp/_sigmaker.py#L1000  calls  `InMemoryBuffer.load(mode=SEGMENTS)` inside `_find_all_simd. _load_segments` iterates every segment and does `idaapi.get_bytes(...)` + `bytearray.extend(...)`. For a 5 MB image that's a fresh 5 MB allocation + copy per is_unique call, per instruction added to the growing signature.  A typical function needs 5–40 instructions worth of growth before becoming unique and we do tens of full image rebuilds per signature. I would like to work on a PR to fix this.
  **Post-Mortem & Fix Analysis**:
  > Also `is_unique` scans the entire binary instead of stopping at 2 matches: https://github.com/mrexodia/ida-pro-mcp/blob/8461a5f7fb249d3fa3a59a4050c678708aaaa199/src/ida_pro_mcp/ida_mcp/_sigmaker.py#L1047 find_all walks until _simd_scan_bytes returns -1 - i.e. to the end of the image. It already supports it: https://github.com/mrexodia/ida-pro-mcp/blob/8461a5f7fb249d3fa3a59a4050c678708aaaa199/src/ida_pro_mcp/ida_mcp/_sigmaker.py#L1017 but `is_unique` doesn't pass it. Every uniqueness check therefore does a full-binary scan even when match 2 was found in the first KB. Also the non-SIMD fallback at _sigmaker.py https://github.com/mrexodia/ida-pro-mcp/blob/8461a5f7fb249d3fa3a59a4050c678708aaaa199/src/ida_pro_mcp/ida_mcp/_sigmaker.py#L1033-L1043 has the same problem and is much worse.

- **Issue #263** (2026-08-04): **find_regex cannot find UTF-16LE (wide) strings — critical for UE4/game binary analysis**
  *Symptoms*: ### Problem find_regex only searches IDA's default ASCII string cache (idautilsStrings() with default settings). It completely misses UTF-16LE encoded strings, which are extremely common in:  Unreal Engine 4/5 binaries (all TCHAR* / FString literals are UTF-16LE) Windows binaries (wide string APIs) Any binary using wchar_t / L"..." literals This means the AI assistant cannot locate string references autonomously — the user has to manually find the string address in IDA and feed it in, which defeats the purpose of MCP automation.  ### Root Cause In api_core.py:   _strings_cache = [(s.ea, str(s)) for s in idautils.Strings() if s is not None] idautils.Strings() defaults to strtypes=[0] (C strings only) and only_7bit=True, excluding all wide/UTF-16 strings. Even if configured, str(s) doesn't properly decode UTF-16LE content.  ### Proposed Fix Add a UTF-16LE binary search fallback in find_regex when the ASCII cache yields no/few results:  Extract the longest literal substring from the regex pattern Encode it as UTF-16LE bytes Use ida_bytes.bin_search() to find occurrences Decode with ida_bytes.get_strlit_contents(ea, -1, ida_nalt.STRTYPE_C_16) Apply the original regex filter This avoids the slow full-cache rebuild (which times out on large binaries like 2.8GB UE4 .so files) while still finding wide strings on demand.  ### Impact Without this fix, any UE4/UE5 reverse engineering workflow through MCP is severely limited — the AI cannot independently locate log strings, error message
  **Post-Mortem & Fix Analysis**:
  > Can you share a sample binary so I can test and fix this?
  > You can work around this by going to the strings, right click -> setup and enabling Unicode C-Style (16 bits)  <img width="281" height="502" alt="Image" src="https://github.com/user-attachments/assets/73737311-415f-4fc7-acde-de23599e0c03" />

- **Issue #206** (2026-06-06): **local server to LAN server**
  *Symptoms*: It seems that the mcp server after startup can only allow local connections. Is there any other way to allow all machines in the LAN to connect?
  **Post-Mortem & Fix Analysis**:
  > Yes, change the IP to 0.0.0.0 in the python file. I will add this to the `config.html` though
  > also added in https://github.com/mrexodia/ida-pro-mcp/pull/321 but rather quick&dirty

- **Issue #165** (2025-11-18): **Nesting `@idaread` causes a deadlock**
  *Symptoms*: Symptom: https://github.com/mrexodia/ida-pro-mcp/pull/164
  **Post-Mortem & Fix Analysis**:
  > I was not able to reproduce this on IDA 9.1
  > It seems like IDA 9.0.240807 was a rather unusual temporary version.   The idalib package in its installer was named `ida` instead of `idapro`, and I also couldn’t find the `enable_console_messages` function which used in the headless MCP, so I had to manually modify it to get it to work.   In another project, CAPA, the symbol for `bin_search` was still the old `bin_search3`.  See https://github.com/mandiant/capa/issues/2637  After upgrading to 9.1, all these issues disappeared. It might be more appropriate to specifically mention this in the Prerequisites section of the README for new users. At least for that version, ida-pro-mcp was not a plug-and-play tool. 🤔 
  > > IDA 9.0.240807  Wasn't that the (leaked?) _beta_ version? I locally have `IDA90` which is 9.0.240925 and `IDA90SP1` which is 9.0.241217. I think it goes without saying that beta/RC versions are not 'supported' seamlessly, since not even Hex-Rays says they are stable...

- **Issue #26** (2025-04-08): **NoneType object has no attribute 'hex'**
  *Symptoms*: ### Introduction  When I ask a question in Cursor chat with all the setup done properly, the plugin in IDA is crashing and I see this in the IDA PRO console:  >   bytes   pages size description > --------- ----- ---- -------------------------------------------- > 134217728 16384 8192 allocating memory for b-tree... > 268435456 32768 8192 allocating memory for virtual array... >    262144    32 8192 allocating memory for name pointers... > ----------------------------------------------------------------- > 402915328            total memory allocated >  > Loading processor module E:\Reverse Engineering\IDA_Pro_8.3\procs\pc64.dll for metapc...Initializing processor module metapc...OK > Loading type libraries... > Autoanalysis subsystem has been initialized. > Database for file 'Game_Exe' has been loaded. > Hex-Rays Decompiler plugin has been loaded (v8.3.0.230608) >   The hotkeys are F5: decompile, Ctrl-F5: decompile all. >  >   Please check the Edit/Plugins menu for more information. > Hex-rays version 8.3.0.230608 has been detected, gooMBA plugin ready to use > [MCP] Plugin loaded, use Edit -> Plugins -> MCP (Ctrl+Alt+M) to start the server > OBJC: Identified Objective-C runtime version >= 2.0 > OBJC: warning: failed to get offset of __objc2_ivar.offs > 101C52E40: restored microcode from idb > 101C52E40: restored pseudocode from idb > 103379700: restored microcode from idb > 103379700: restored pseudocode from idb > 103379700: using guessed type char var_40[16]; > ------------
  **Post-Mortem & Fix Analysis**:
  > As a side note: i'm currently reversing a mac-based binary. I don't have this issue happening when I reverse a Windows one.
  > Hm that is quite weird. It looks like it happens in the following code:  https://github.com/mrexodia/ida-pro-mcp/blob/47be91c303151255ed28473ac9453b199ab80079/src/ida_pro_mcp/mcp-plugin.py#L405-L418  Could you try to run the following commands after loading a binary in IDA?  ``` import ida_nalt print(ida_nalt.retrieve_input_file_sha256()) ```  The error suggests this function returns `None`, which seems strange. As a workaround I can just check for `None`, but this command works fine on my IDA 8.3.
  > Here you go :-)  ``` Python>import ida_nalt print(ida_nalt.retrieve_input_file_sha256()) None ```

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

### Incident Patch 1: `fab3505e` (2026-09-22)
**Commit Message**: Merge pull request #540 from VecSzn/fix/find-immediate-high-bit

find/insn_query: match sign-extended immediates

**File**: `src/ida_pro_mcp/ida_mcp/api_analysis.py` (modified, +41/-14)
```diff
@@ -375,6 +375,25 @@ def _operand_value(insn: ida_ua.insn_t, i: int) -> int | None:
     return op.value
 
 
+def _operand_matches(insn: ida_ua.insn_t, i: int, value: int) -> bool:
+    op_val = _operand_value(insn, i)
+    if op_val is None:
+        return False
+    if op_val == value:
+        return True
+    op = insn.ops[i]
+    if op.type != ida_ua.o_imm:
+        return False
+    # IDA sign-extends immediates to 64 bits (`mov eax, 80000000h` has value
+    # 0xFFFFFFFF80000000), so compare at the operand's own width and accept
+    # either the signed or the unsigned spelling of the value.
+    bits = ida_ua.get_dtype_size(op.dtype) * 8
+    if not 8 <= bits <= 64 or not -(1 << (bits - 1)) <= value < (1 << bits):
+        return False
+    mask = (1 << bits) - 1
+    return (op_val & mask) == (value & mask)
+
+
 def _operand_type(insn: ida_ua.insn_t, i: int) -> int:
     return insn.ops[i].type
 
@@ -414,7 +433,7 @@ def _value_candidates_for_immediate(value: int) -> list[tuple[int, int, bytes]]:
     def add(size: int, signed_val: int):
         if size == 4:
             masked = signed_val & 0xFFFFFFFF
-            if not (-0x80000000 <= signed_val <= 0x7FFFFFFF):
+            if not (-0x80000000 <= signed_val <= 0xFFFFFFFF):
                 return
             b = struct.pack("<I", masked)
         else:
@@ -424,6 +443,10 @@ def add(size: int, signed_val: int):
             b = struct.pack("<Q", masked)
         candidates.append((masked, size, b))
 
+    # IDA reports -0xB0 as 0xFFFFFFFFFFFFFF50. Fold that back to the negative
+    # value so the 4-byte encoding is searched as well.
+    if 1 << 63 <= value < 1 << 64:
+        value -= 1 << 64
     add(4, value)
     add(8, value)
     return candidates
@@ -433,10 +456,17 @@ def _resolve_immediate_insn_start(
     match_ea: int,
     value: int,
     seg_start: int,
-    alt_value: int | None = None,
 ) -> int | None:
-    start_min = max(seg_start, match_ea - _IMM_SCAN_BACK_MAX)
-    for start in range(match_ea, start_min - 1, -1):
+    head = ida_bytes.get_item_head(match_ea)
+    if ida_bytes.is_code(ida_bytes.get_flags(head)):
+        # Use IDA's instruction. Scanning back byte by byte can stop inside a
+        # longer one: 41 B9 10 00 00 00 (mov r9d, 10h) also decodes as
+        # mov ecx, 10h one byte in.
+        starts = [head]
+    else:
+        start_min = max(seg_start, match_ea - _IMM_SCAN_BACK_MAX)
+        starts = range(match_ea, start_min - 1, -1)
+    for start in starts:
         insn = _decode_insn_at(start)
         if insn is None:
             continue
@@ -449,10 +479,7 @@ def _resolve_immediate_insn_start(
                 break
             if op_type != ida_ua.o_imm:
                 continue
-            op_val = _operand_value(insn, i)
-            if op_val is None:
-                continue
-            if op_val == value or (alt_value is not None and op_val == alt_value):
+            if _operand_matches(insn, i, value):
                 offb = getattr(insn.ops[i], "offb", 0)
                 if offb and start + offb != match_ea:
                     continue
@@ -1972,7 +1999,7 @@ def find(
                     seg = idaapi.getseg(seg_ea)
                     if not seg or not (seg.perm & idaapi.SEGPERM_EXEC):
                         continue
-                    for normalized, size, pattern_bytes in candidates:
+                    for _, size, pattern_bytes in candidates:
                         ea = seg.start_ea
                         while ea != idaapi.BADADDR and ea < seg.end_ea:
                             ea = _raw_bin_search(
@@ -1982,7 +2009,7 @@ def find(
                                 break
 
                             insn_start = _resolve_immediate_insn_start(
-                                ea, value, seg.start_ea, normalized
+                                ea, value, seg.start_ea
                             )
                             if insn_start is not None and insn_start not in seen_insn:
                                 seen_insn.add(insn_start)
@@ -2215,19 +2242,19 @@ def _scan_insn_ranges(
                 continue
 
             match = True
-            if op0_val is not None and _operand_value(insn, 0) != op0_val:
+            if op0_val is not None and not _operand_matches(insn, 0, op0_val):
                 match = False
-            if op1_val is not None and _operand_value(insn, 1) != op1_val:
+            if op1_val is not None and not _operand_matches(insn, 1, op1_val):
                 match = False
-            if op2_val is not None and _operand_value(insn, 2) != op2_val:
+            if op2_val is not None and not _operand_matches(insn, 2, op2_val):
                 match = False
 
             if any_val is not None and match:
                 found_any = False
                 for i in range(8):
                     if _operand_type(insn, i) == ida_ua.o_void:
                         break
-                    if _operand_value(insn, i) == any_val:
+      
```

**File**: `src/ida_pro_mcp/ida_mcp/tests/test_api_analysis.py` (modified, +33/-0)
```diff
@@ -588,6 +588,16 @@ def test_insn_query_requires_scope_by_default():
     assert result[0].get("error") is not None
 
 
+@test(binary="crackme03.elf")
+def test_insn_query_sign_extended_dword_operand():
+    """insn_query matches a dword immediate by its 32-bit or signed value."""
+    for op1 in ("0xffffffff", "-1", "0xffffffffffffffff"):
+        result = insn_query({"func": CRACKME_MAIN, "mnem": "mov", "op1": op1})
+        assert_is_list(result, min_length=1)
+        addrs = [m["addr"] for m in result[0]["matches"]]
+        assert "0x1275" in addrs, (op1, addrs)
+
+
 # ============================================================================
 # Tests for xrefs_to_field
 # ============================================================================
@@ -731,6 +741,29 @@ def test_find_immediate_out_of_range():
     assert_error(result[0], contains="Immediate out of range")
 
 
+@test(binary="crackme03.elf")
+def test_find_immediate_sign_extended_dword():
+    """find(immediate, ...) matches `mov eax, 0FFFFFFFFh` however the value is spelled."""
+    for target in ("0xffffffff", "-1", "0xffffffffffffffff"):
+        result = find("immediate", target)
+        assert_is_list(result, min_length=1)
+        assert result[0]["error"] is None, target
+        assert result[0]["matches"] == ["0x1275"], (target, result[0]["matches"])
+
+
+@test(binary="typed_fixture.elf")
+def test_find_immediate_reports_instruction_start():
+    """find(immediate, ...) reports where the instruction starts, not a byte inside it."""
+    import ida_bytes
+
+    for target in ("0x100", "-0xb0"):
+        matches = find("immediate", target)[0]["matches"]
+        assert_non_empty(matches)
+        for addr in matches:
+            ea = int(addr, 16)
+            assert ida_bytes.get_item_head(ea) == ea, (target, addr)
+
+
 @test()
 def test_find_data_ref_invalid_target():
     """find(data_ref, ...) reports invalid target address parsing errors."""
```

**File**: `src/ida_pro_mcp/ida_mcp/tests/test_api_analysis_internals.py` (modified, +6/-0)
```diff
@@ -121,6 +121,12 @@ def test_internal_immediate_encoding_helpers():
     assert any(item[0] == 1234 and item[1] == 4 for item in candidates)
     assert any(item[0] == 1234 and item[1] == 8 for item in candidates)
 
+    candidates = _value_candidates_for_immediate(0x8007000E)
+    assert (0x8007000E, 4, b"\x0e\x00\x07\x80") in candidates
+    candidates = _value_candidates_for_immediate(0xFFFFFFFFFFFFFF50)
+    assert (0xFFFFFF50, 4, b"\x50\xff\xff\xff") in candidates
+    assert _value_candidates_for_immediate((1 << 64) + 5) == []
+
 
 @test()
 def test_internal_decompile_pagination_respects_character_budget():
```

---

### Incident Patch 2: `8ed11422` (2026-09-22)
**Commit Message**: Merge pull request #539 from Lesereingrape/fix/download-base-url

fix(rpc): treat a blank IDA_MCP_URL as unset for download URLs

**File**: `src/ida_pro_mcp/ida_mcp/rpc.py` (modified, +15/-1)
```diff
@@ -20,7 +20,21 @@
 OUTPUT_LIMIT_MAX_CHARS = 50000
 OUTPUT_CACHE_MAX_SIZE = 100
 _output_cache: dict[str, Any] = {}
-_download_base_url: str = os.environ.get("IDA_MCP_URL", "http://127.0.0.1:13337")
+_DOWNLOAD_BASE_URL_DEFAULT = "http://127.0.0.1:13337"
+
+
+def configured_download_base_url() -> Optional[str]:
+    """The public base URL the operator configured (#383), None if unset.
+
+    The other IDA_MCP_* knobs (idalib_supervisor._env_float/_env_int,
+    zeromcp._parse_bool_env) already treat a blank value as unset; so does the
+    download base url here, otherwise a blank IDA_MCP_URL degrades the
+    truncated-output hint to a bare "/output/<id>.json" path.
+    """
+    return os.environ.get("IDA_MCP_URL", "").strip() or None
+
+
+_download_base_url: str = configured_download_base_url() or _DOWNLOAD_BASE_URL_DEFAULT
 
 
 def set_download_base_url(url: str) -> None:
```

**File**: `src/ida_pro_mcp/idalib_server.py` (modified, +7/-2)
```diff
@@ -19,7 +19,11 @@
 from ida_pro_mcp.ida_mcp.http import IdaMcpHttpRequestHandler
 from ida_pro_mcp.ida_mcp.mainthread import get_pump
 from ida_pro_mcp.ida_mcp.profile import apply_profile, load_profile
-from ida_pro_mcp.ida_mcp.rpc import set_download_base_url, tool
+from ida_pro_mcp.ida_mcp.rpc import (
+    configured_download_base_url,
+    set_download_base_url,
+    tool,
+)
 from ida_pro_mcp.idalib_session_manager import get_session_manager
 from ida_pro_mcp.worker_lifecycle import WorkerLifecycle
 
@@ -313,7 +317,8 @@ def _stop():
     trace.install_tracer()
     logger.info("Tracing tools/call to IDB netnode %s", trace.IDB_NETNODE_NAME)
 
-    if not "IDA_MCP_URL" in os.environ:
+    # Only a non-blank IDA_MCP_URL counts as "the operator set it" (#383).
+    if configured_download_base_url() is None:
         set_download_base_url(f"http://{args.host}:{args.port}")
 
     try:
```

**File**: `tests/test_mcp_spec_truncation.py` (modified, +57/-0)
```diff
@@ -5,11 +5,14 @@
 merged into structuredContent.
 """
 
+import importlib
 import json
+import os
 import sys
 import pathlib
 import unittest
 from typing import TypedDict
+from unittest import mock
 
 from jsonschema import Draft202012Validator
 
@@ -237,5 +240,59 @@ def deep() -> Outer:
         Draft202012Validator(tool["outputSchema"]).validate(result["structuredContent"])
 
 
+class DownloadBaseUrlFromEnvTests(unittest.TestCase):
+    """`IDA_MCP_URL` is the operator's public base URL for downloads (#383)."""
+
+    @staticmethod
+    def _reload_rpc_with_url(value: str | None):
+        """Re-evaluate rpc.py with IDA_MCP_URL set to `value` (None: unset)."""
+        rpc = load_ida_rpc_module()
+        with mock.patch.dict(os.environ, clear=True):
+            if value is not None:
+                os.environ["IDA_MCP_URL"] = value
+            importlib.reload(rpc)
+        return rpc
+
+    def tearDown(self):
+        importlib.reload(load_ida_rpc_module())
+
+    def test_blank_url_falls_back_to_the_default_base(self):
+        for value in ["", "   ", None]:
+            with self.subTest(IDA_MCP_URL=value):
+                rpc = self._reload_rpc_with_url(value)
+                self.assertEqual(
+                    rpc.get_download_base_url(),
+                    "http://127.0.0.1:13337",
+                )
+
+    def test_configured_url_is_used_verbatim_once_stripped(self):
+        rpc = self._reload_rpc_with_url("  https://mcp.example.com/ida ")
+        self.assertEqual(
+            rpc.get_download_base_url(),
+            "https://mcp.example.com/ida",
+        )
+
+    def test_truncated_output_still_advertises_an_absolute_download_url(self):
+        self._reload_rpc_with_url("")
+        srv = _fresh_truncated_server()
+
+        @srv.tool
+        def big_list() -> _ListResult:
+            """Returns a huge list; forces truncation."""
+            return {
+                "items": [{"name": f"n{i}", "value": i} for i in range(5000)],
+                "count": 5000,
+            }
+
+        result = call_rpc(srv, "tools/call", name="big_list", arguments={})
+        meta = result["_meta"]["ida_mcp"]
+        self.assertTrue(meta["output_truncated"])
+        self.assertTrue(
+            meta["download_url"].startswith("http://127.0.0.1:13337/output/"),
+            meta["download_url"],
+        )
+        self.assertIn(meta["download_url"], meta["download_hint"])
+
+
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 3: `4460ea6e` (2026-09-22)
**Commit Message**: fix(rpc): treat a blank IDA_MCP_URL as unset for download URLs

A blank or whitespace-only IDA_MCP_URL made truncated tool output advertise
relative download paths like "/output/<id>.json", so the curl hint could not
be used. The other IDA_MCP_* knobs already fall back to defaults for blank
values; the download base url now does the same.

**File**: `src/ida_pro_mcp/ida_mcp/rpc.py` (modified, +15/-1)
```diff
@@ -20,7 +20,21 @@
 OUTPUT_LIMIT_MAX_CHARS = 50000
 OUTPUT_CACHE_MAX_SIZE = 100
 _output_cache: dict[str, Any] = {}
-_download_base_url: str = os.environ.get("IDA_MCP_URL", "http://127.0.0.1:13337")
+_DOWNLOAD_BASE_URL_DEFAULT = "http://127.0.0.1:13337"
+
+
+def configured_download_base_url() -> Optional[str]:
+    """The public base URL the operator configured (#383), None if unset.
+
+    The other IDA_MCP_* knobs (idalib_supervisor._env_float/_env_int,
+    zeromcp._parse_bool_env) already treat a blank value as unset; so does the
+    download base url here, otherwise a blank IDA_MCP_URL degrades the
+    truncated-output hint to a bare "/output/<id>.json" path.
+    """
+    return os.environ.get("IDA_MCP_URL", "").strip() or None
+
+
+_download_base_url: str = configured_download_base_url() or _DOWNLOAD_BASE_URL_DEFAULT
 
 
 def set_download_base_url(url: str) -> None:
```

**File**: `src/ida_pro_mcp/idalib_server.py` (modified, +7/-2)
```diff
@@ -19,7 +19,11 @@
 from ida_pro_mcp.ida_mcp.http import IdaMcpHttpRequestHandler
 from ida_pro_mcp.ida_mcp.mainthread import get_pump
 from ida_pro_mcp.ida_mcp.profile import apply_profile, load_profile
-from ida_pro_mcp.ida_mcp.rpc import set_download_base_url, tool
+from ida_pro_mcp.ida_mcp.rpc import (
+    configured_download_base_url,
+    set_download_base_url,
+    tool,
+)
 from ida_pro_mcp.idalib_session_manager import get_session_manager
 from ida_pro_mcp.worker_lifecycle import WorkerLifecycle
 
@@ -313,7 +317,8 @@ def _stop():
     trace.install_tracer()
     logger.info("Tracing tools/call to IDB netnode %s", trace.IDB_NETNODE_NAME)
 
-    if not "IDA_MCP_URL" in os.environ:
+    # Only a non-blank IDA_MCP_URL counts as "the operator set it" (#383).
+    if configured_download_base_url() is None:
         set_download_base_url(f"http://{args.host}:{args.port}")
 
     try:
```

---

### Incident Patch 4: `4e4b855a` (2026-09-21)
**Commit Message**: Merge pull request #534 from VecSzn/fix/jsonrpc-str-union

jsonrpc: don't JSON-decode string args when the union includes str

**File**: `src/ida_pro_mcp/ida_mcp/zeromcp/jsonrpc.py` (modified, +1/-1)
```diff
@@ -296,7 +296,7 @@ def _call(self, method: str, params: Any) -> Any:
                     # To work around this, if the expected type is a Union
                     # that does not include str, and the provided value is
                     # a str, we try to parse it as JSON first.
-                    if type(str) not in args and isinstance(value, str):
+                    if str not in args and isinstance(value, str):
                         try:
                             value = json.loads(value)
                         except json.JSONDecodeError:
```

**File**: `tests/test_jsonrpc_union_params.py` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+"""Union parameter coercion for tools/call arguments."""
+
+import pathlib
+import sys
+import unittest
+
+sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
+from _mcp_spec_support import McpServer
+
+
+def _server() -> McpServer:
+    srv = McpServer("union-param-tests")
+
+    @srv.tool
+    def take_addrs(addrs: list[str] | str) -> str:
+        """Echo addrs back with its Python type."""
+        return f"{type(addrs).__name__}:{addrs}"
+
+    @srv.tool
+    def take_items(items: list[dict] | dict) -> str:
+        """Echo items back with its Python type."""
+        return f"{type(items).__name__}:{items}"
+
+    return srv
+
+
+class UnionParamTests(unittest.TestCase):
+    def setUp(self):
+        self.srv = _server()
+
+    def _call(self, name: str, **arguments):
+        resp = self.srv.registry.dispatch(
+            {
+                "jsonrpc": "2.0",
+                "id": 1,
+                "method": "tools/call",
+                "params": {"name": name, "arguments": arguments},
+            }
+        )
+        result = resp["result"]
+        self.assertFalse(result.get("isError"), result)
+        return result["structuredContent"]["result"]
+
+    def test_str_union_keeps_numeric_string(self):
+        self.assertEqual(self._call("take_addrs", addrs="4670"), "str:4670")
+
+    def test_str_union_keeps_json_looking_string(self):
+        self.assertEqual(
+            self._call("take_addrs", addrs='["0x10"]'), 'str:["0x10"]'
+        )
+
+    def test_non_str_union_still_decodes_json_string(self):
+        self.assertEqual(
+            self._call("take_items", items='[{"addr": "0x10"}]'),
+            "list:[{'addr': '0x10'}]",
+        )
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 5: `5e4f6ab7` (2026-09-21)
**Commit Message**: Merge pull request #535 from VecSzn/fix/count-zero-all

entity_query/type_query: count=0 should return all rows

**File**: `src/ida_pro_mcp/ida_mcp/api_core.py` (modified, +1/-1)
```diff
@@ -788,7 +788,7 @@ def entity_query(
             rows.sort(key=lambda row: str(row.get(sort_by, "")).lower(), reverse=descending)
 
         offset = int(query.get("offset", 0) or 0)
-        count = int(query.get("count", 100) or 100)
+        count = int(query["count"]) if query.get("count") is not None else 100
         page = paginate(rows, offset, count)
         data = [{k: v for k, v in item.items() if k != "size_int"} for item in page["data"]]
 
```

**File**: `src/ida_pro_mcp/ida_mcp/api_types.py` (modified, +1/-1)
```diff
@@ -597,7 +597,7 @@ def type_query(
             kind = "any"
 
         offset = int(query.get("offset", 0) or 0)
-        count = int(query.get("count", 100) or 100)
+        count = int(query["count"]) if query.get("count") is not None else 100
         sort_by = str(query.get("sort_by", "name") or "name")
         descending = bool(query.get("descending", False))
         include_decl = bool(query.get("include_decl", True))
```

**File**: `src/ida_pro_mcp/ida_mcp/tests/test_api_core.py` (modified, +9/-0)
```diff
@@ -409,6 +409,15 @@ def test_entity_query_functions_sort_by_size():
     assert sizes == sorted(sizes, reverse=True)
 
 
+@test(binary="typed_fixture.elf")
+def test_entity_query_count_zero_returns_all():
+    """count=0 returns every row, as the schema documents."""
+    page = entity_query({"kind": "functions", "count": 0})[0]
+    assert page["total"] > 100
+    assert len(page["data"]) == page["total"]
+    assert page["next_offset"] is None
+
+
 @test()
 def test_server_health():
     """server_health returns readiness payload"""
```

**File**: `src/ida_pro_mcp/ida_mcp/tests/test_api_types.py` (modified, +9/-0)
```diff
@@ -303,6 +303,15 @@ def test_type_query():
         assert "kind" in page["data"][0]
 
 
+@test(binary="typed_fixture.elf")
+def test_type_query_count_zero_returns_all():
+    """count=0 returns every type, as the schema documents."""
+    page = type_query({"count": 0, "include_decl": False})[0]
+    assert page["total"] > 100
+    assert len(page["data"]) == page["total"]
+    assert page["next_offset"] is None
+
+
 @test()
 def test_type_inspect():
     """type_inspect returns metadata for declared struct"""
```

---

### Incident Patch 6: `a671a5bd` (2026-09-21)
**Commit Message**: Merge pull request #533 from Lesereingrape/fix/supervisor-env-fallback

fix(idalib): fall back to defaults for blank IDA_MCP_* values

**File**: `src/ida_pro_mcp/idalib_supervisor.py` (modified, +9/-2)
```diff
@@ -62,6 +62,13 @@ def _env_float(name: str, default: float) -> float:
         return default
 
 
+def _env_int(name: str, default: int) -> int:
+    try:
+        return int(os.environ.get(name, "").strip() or default)
+    except ValueError:
+        return default
+
+
 # A worker cannot answer a ping while a tool occupies its IDA main thread, so
 # probing must separate "process gone" (reap) from "alive but busy" (wait).
 WORKER_TCP_HEALTH_TIMEOUT_SEC = _env_float("IDA_MCP_HEALTH_TCP_TIMEOUT", 2.0)
@@ -85,7 +92,7 @@ def _env_float(name: str, default: float) -> float:
 # no limit this silently wedges the worker process (and the blocking supervisor
 # RPC waiting on it) forever, with no progress feedback and no recovery.
 # Set IDA_MCP_OPEN_TIMEOUT=0 to wait indefinitely (previous behavior).
-WORKER_OPEN_TIMEOUT_SEC = float(os.environ.get("IDA_MCP_OPEN_TIMEOUT", "1800"))
+WORKER_OPEN_TIMEOUT_SEC = _env_float("IDA_MCP_OPEN_TIMEOUT", 1800.0)
 
 
 def _import_zeromcp():
@@ -1482,7 +1489,7 @@ def main() -> None:
     parser.add_argument(
         "--max-workers",
         type=int,
-        default=int(os.environ.get("IDA_MCP_MAX_WORKERS", "4")),
+        default=_env_int("IDA_MCP_MAX_WORKERS", 4),
         help="Maximum simultaneous idalib worker databases (0 = unlimited, default: 4).",
     )
     parser.add_argument("input_path", type=Path, nargs="?", help="Optional binary to open on startup.")
```

---

### Incident Patch 7: `e67d32cc` (2026-09-21)
**Commit Message**: fix(idalib): fall back to defaults for blank IDA_MCP_* values

WORKER_OPEN_TIMEOUT_SEC and the --max-workers default converted the raw
environment string themselves, so a documented variable that is present but
empty (or non-numeric) raised ValueError while building the module / parser and
the supervisor would not start at all - not even for --help. Read both through
_env_float and a new _env_int mirror of it, the tolerant pattern every other
knob in this file already uses; 0 keeps its documented meaning for both.

**File**: `src/ida_pro_mcp/idalib_supervisor.py` (modified, +9/-2)
```diff
@@ -62,6 +62,13 @@ def _env_float(name: str, default: float) -> float:
         return default
 
 
+def _env_int(name: str, default: int) -> int:
+    try:
+        return int(os.environ.get(name, "").strip() or default)
+    except ValueError:
+        return default
+
+
 # A worker cannot answer a ping while a tool occupies its IDA main thread, so
 # probing must separate "process gone" (reap) from "alive but busy" (wait).
 WORKER_TCP_HEALTH_TIMEOUT_SEC = _env_float("IDA_MCP_HEALTH_TCP_TIMEOUT", 2.0)
@@ -85,7 +92,7 @@ def _env_float(name: str, default: float) -> float:
 # no limit this silently wedges the worker process (and the blocking supervisor
 # RPC waiting on it) forever, with no progress feedback and no recovery.
 # Set IDA_MCP_OPEN_TIMEOUT=0 to wait indefinitely (previous behavior).
-WORKER_OPEN_TIMEOUT_SEC = float(os.environ.get("IDA_MCP_OPEN_TIMEOUT", "1800"))
+WORKER_OPEN_TIMEOUT_SEC = _env_float("IDA_MCP_OPEN_TIMEOUT", 1800.0)
 
 
 def _import_zeromcp():
@@ -1482,7 +1489,7 @@ def main() -> None:
     parser.add_argument(
         "--max-workers",
         type=int,
-        default=int(os.environ.get("IDA_MCP_MAX_WORKERS", "4")),
+        default=_env_int("IDA_MCP_MAX_WORKERS", 4),
         help="Maximum simultaneous idalib worker databases (0 = unlimited, default: 4).",
     )
     parser.add_argument("input_path", type=Path, nargs="?", help="Optional binary to open on startup.")
```

---

### Incident Patch 8: `2c0424eb` (2026-09-21)
**Commit Message**: fix(installer): keep IPv6 brackets in generated transport URLs (#529)

* fix(installer): keep IPv6 brackets in generated transport URLs

urlparse() strips the brackets from an IPv6 literal, so re-joining
hostname and port with ":" produced authorities no client can parse
(http://::1:13337/mcp). Route every authority through one helper that
re-brackets a host containing a colon.

**File**: `src/ida_pro_mcp/installer.py` (modified, +22/-6)
```diff
@@ -103,19 +103,31 @@ def copy_python_env(env: dict[str, str]):
     return result
 
 
+def _transport_authority(host: str, port: int) -> str:
+    # urlparse() strips the brackets from an IPv6 literal, and an unbracketed
+    # IPv6 address is not a valid URL authority: "http://::1:13337/mcp".
+    if ":" in host:
+        return f"[{host}]:{port}"
+    return f"{host}:{port}"
+
+
 def normalize_transport_url(transport: str) -> str:
     url = urlparse(transport)
     if url.hostname is None or url.port is None:
         raise Exception(f"Invalid transport URL: {transport}")
     path = url.path or "/mcp"
     if path == "/":
         path = "/mcp"
-    return urlunparse((url.scheme, f"{url.hostname}:{url.port}", path, "", "", ""))
+    return urlunparse(
+        (url.scheme, _transport_authority(url.hostname, url.port), path, "", "", "")
+    )
 
 
 def force_mcp_path(transport_url: str) -> str:
     url = urlparse(transport_url)
-    return urlunparse((url.scheme, f"{url.hostname}:{url.port}", "/mcp", "", "", ""))
+    return urlunparse(
+        (url.scheme, _transport_authority(url.hostname, url.port), "/mcp", "", "", "")
+    )
 
 
 def infer_http_transport_type(transport_url: str) -> str:
@@ -147,9 +159,9 @@ def generate_mcp_config(*, client_name: str, transport: str = "stdio"):
         return mcp_config
 
     if transport == "streamable-http":
-        transport = f"http://{IDA_HOST}:{IDA_PORT}/mcp"
+        transport = f"http://{_transport_authority(IDA_HOST, IDA_PORT)}/mcp"
     elif transport == "sse":
-        transport = f"http://{IDA_HOST}:{IDA_PORT}/sse"
+        transport = f"http://{_transport_authority(IDA_HOST, IDA_PORT)}/sse"
 
     transport_url = normalize_transport_url(transport)
     if client_name == "Opencode":
@@ -184,7 +196,9 @@ def print_mcp_config():
                 "mcpServers": {
                     MCP_SERVER_NAME: generate_mcp_config(
                         client_name="Generic",
-                        transport=f"http://{IDA_HOST}:{IDA_PORT}/mcp",
+                        transport=(
+                            f"http://{_transport_authority(IDA_HOST, IDA_PORT)}/mcp"
+                        ),
                     )
                 }
             },
@@ -198,7 +212,9 @@ def print_mcp_config():
                 "mcpServers": {
                     MCP_SERVER_NAME: generate_mcp_config(
                         client_name="Generic",
-                        transport=f"http://{IDA_HOST}:{IDA_PORT}/sse",
+                        transport=(
+                            f"http://{_transport_authority(IDA_HOST, IDA_PORT)}/sse"
+                        ),
                     )
                 }
             },
```

---

### Incident Patch 9: `f692c06d` (2026-09-21)
**Commit Message**: Merge pull request #531 from Lesereingrape/fix/ida-free-uninstall-not-blocked

fix(installer): let --uninstall run when IDA Free is installed

**File**: `src/ida_pro_mcp/installer.py` (modified, +1/-1)
```diff
@@ -476,7 +476,7 @@ def install_ida_plugin(
     *, uninstall: bool = False, quiet: bool = False, allow_ida_free: bool = False
 ):
     ida_folder = _get_ida_user_dir()
-    if not allow_ida_free:
+    if not allow_ida_free and not uninstall:
         free_licenses = glob.glob(os.path.join(ida_folder, "idafree_*.hexlic"))
         if free_licenses:
             print(
```

---

### Incident Patch 10: `199e3a00` (2026-09-20)
**Commit Message**: Merge pull request #525 from sxh313/fix/discovery-wildcard-host

fix(discovery): keep instances that bound a wildcard address

**File**: `src/ida_pro_mcp/ida_mcp/discovery.py` (modified, +22/-0)
```diff
@@ -7,6 +7,7 @@
 
 import datetime
 import glob
+import ipaddress
 import json
 import os
 import socket
@@ -126,6 +127,23 @@ def probe_instance(host: str, port: int, timeout: float = 2.0) -> bool:
         return False
 
 
+def _connectable_host(host: str) -> str:
+    """Map a recorded bind address to an address we can connect to.
+
+    A registration stores the address the instance bound to, and a wildcard
+    bind is not connectable: Winsock rejects connect("0.0.0.0") / connect("::")
+    with WSAEADDRNOTAVAIL (10049) where BSD sockets route them to loopback, so
+    a live instance read its own registration as unreachable.
+    """
+    try:
+        address = ipaddress.ip_address(host)
+    except ValueError:
+        return host  # a name ("localhost") or an explicit interface address
+    if address.is_unspecified:
+        return "127.0.0.1" if address.version == 4 else "::1"
+    return host
+
+
 def discover_instances() -> list[InstanceInfo]:
     """Scan for registered instances, cleaning up stale entries."""
     instances_dir = get_instances_dir()
@@ -152,6 +170,10 @@ def discover_instances() -> list[InstanceInfo]:
                 pass
             continue
 
+        # Consumers (the probe below and the supervisor sessions adopted from
+        # this result) connect to this host, so record a connectable one.
+        info["host"] = _connectable_host(info["host"])
+
         if not is_pid_alive(info["pid"]):
             try:
                 os.unlink(file_path)
```

**File**: `tests/test_discovery_wildcard_host.py` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+"""Registry entries must stay discoverable when the server bound a wildcard.
+
+A bind address is not necessarily a connectable one: connect("0.0.0.0") /
+connect("::") fail with WSAEADDRNOTAVAIL on Windows, and discover_instances()
+read that as "instance dead" and deleted the registration of a live server.
+"""
+
+import os
+import pathlib
+import socket
+import sys
+import tempfile
+import threading
+import unittest
+
+_DISCOVERY_SRC = pathlib.Path(__file__).resolve().parents[1] / "src" / "ida_pro_mcp" / "ida_mcp"
+sys.path.insert(0, str(_DISCOVERY_SRC))
+try:
+    import discovery
+finally:
+    sys.path.remove(str(_DISCOVERY_SRC))
+
+
+class ConnectableHostTests(unittest.TestCase):
+    def test_wildcard_binds_map_to_loopback(self):
+        self.assertEqual(discovery._connectable_host("0.0.0.0"), "127.0.0.1")
+        self.assertEqual(discovery._connectable_host("::"), "::1")
+
+    def test_other_hosts_pass_through(self):
+        for host in ("127.0.0.1", "::1", "192.168.1.10", "localhost", ""):
+            self.assertEqual(discovery._connectable_host(host), host)
+
+
+class DiscoverWildcardInstanceTests(unittest.TestCase):
+    def setUp(self):
+        self._tmp = tempfile.TemporaryDirectory()
+        self._original_dir = discovery.get_instances_dir
+        discovery.get_instances_dir = lambda: self._tmp.name
+
+        self._stop = threading.Event()
+        self._listener = socket.socket()
+        self._listener.bind(("127.0.0.1", 0))
+        self._listener.listen(5)
+        self._port = self._listener.getsockname()[1]
+        self._acceptor = threading.Thread(target=self._accept_forever, daemon=True)
+        self._acceptor.start()
+
+    def tearDown(self):
+        discovery.get_instances_dir = self._original_dir
+        self._stop.set()
+        self._listener.close()
+        self._acceptor.join(timeout=2)
+        self._tmp.cleanup()
+
+    def _accept_forever(self):
+        self._listener.settimeout(0.2)
+        while not self._stop.is_set():
+            try:
+                connection, _ = self._listener.accept()
+            except (TimeoutError, socket.timeout):
+                continue
+            except OSError:
+                return
+            connection.close()
+
+    def test_live_instance_registered_on_wildcard_host_survives(self):
+        path = discovery.register_instance(
+            "0.0.0.0", self._port, os.getpid(), "wild.bin", "wild.idb"
+        )
+        found = discovery.discover_instances()
+        self.assertEqual(len(found), 1, "live instance was pruned as unreachable")
+        self.assertTrue(os.path.isfile(path), "registration file was deleted")
+        self.assertEqual(
+            found[0]["host"], "127.0.0.1", "consumers got an address they cannot connect to"
+        )
+
+    def test_loopback_instance_still_discovered(self):
+        discovery.register_instance(
+            "127.0.0.1", self._port, os.getpid(), "ok.bin", "ok.idb"
+        )
+        found = discovery.discover_instances()
+        self.assertEqual([i["host"] for i in found], ["127.0.0.1"])
+
+    def test_dead_instance_on_wildcard_host_is_still_pruned(self):
+        discovery.register_instance("0.0.0.0", 1, os.getpid(), "dead.bin", "dead.idb")
+        self.assertEqual(discovery.discover_instances(), [])
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 11: `a85cabb9` (2026-09-20)
**Commit Message**: Merge pull request #524 from sxh313/fix/claude-code-link

docs: fix dead Claude Code link in supported clients list

**File**: `README.md` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ The binaries and prompt for the video are available in the [mcp-reversing-datase
   - [Amazon Q Developer CLI](https://aws.amazon.com/q/developer/)
   - [Augment Code](https://www.augmentcode.com/)
   - [Claude](https://claude.ai/download)
-  - [Claude Code](https://www.anthropic.com/code)
+  - [Claude Code](https://claude.com/product/claude-code)
   - [Cline](https://cline.bot)
   - [Codex](https://github.com/openai/codex)
   - [Copilot CLI](https://docs.github.com/en/copilot)
```

---

### Incident Patch 12: `9afca2b6` (2026-09-20)
**Commit Message**: fix(discovery): keep instances that bound a wildcard address

**File**: `src/ida_pro_mcp/ida_mcp/discovery.py` (modified, +22/-0)
```diff
@@ -7,6 +7,7 @@
 
 import datetime
 import glob
+import ipaddress
 import json
 import os
 import socket
@@ -126,6 +127,23 @@ def probe_instance(host: str, port: int, timeout: float = 2.0) -> bool:
         return False
 
 
+def _connectable_host(host: str) -> str:
+    """Map a recorded bind address to an address we can connect to.
+
+    A registration stores the address the instance bound to, and a wildcard
+    bind is not connectable: Winsock rejects connect("0.0.0.0") / connect("::")
+    with WSAEADDRNOTAVAIL (10049) where BSD sockets route them to loopback, so
+    a live instance read its own registration as unreachable.
+    """
+    try:
+        address = ipaddress.ip_address(host)
+    except ValueError:
+        return host  # a name ("localhost") or an explicit interface address
+    if address.is_unspecified:
+        return "127.0.0.1" if address.version == 4 else "::1"
+    return host
+
+
 def discover_instances() -> list[InstanceInfo]:
     """Scan for registered instances, cleaning up stale entries."""
     instances_dir = get_instances_dir()
@@ -152,6 +170,10 @@ def discover_instances() -> list[InstanceInfo]:
                 pass
             continue
 
+        # Consumers (the probe below and the supervisor sessions adopted from
+        # this result) connect to this host, so record a connectable one.
+        info["host"] = _connectable_host(info["host"])
+
         if not is_pid_alive(info["pid"]):
             try:
                 os.unlink(file_path)
```

**File**: `tests/test_discovery_wildcard_host.py` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+"""Registry entries must stay discoverable when the server bound a wildcard.
+
+A bind address is not necessarily a connectable one: connect("0.0.0.0") /
+connect("::") fail with WSAEADDRNOTAVAIL on Windows, and discover_instances()
+read that as "instance dead" and deleted the registration of a live server.
+"""
+
+import os
+import pathlib
+import socket
+import sys
+import tempfile
+import threading
+import unittest
+
+_DISCOVERY_SRC = pathlib.Path(__file__).resolve().parents[1] / "src" / "ida_pro_mcp" / "ida_mcp"
+sys.path.insert(0, str(_DISCOVERY_SRC))
+try:
+    import discovery
+finally:
+    sys.path.remove(str(_DISCOVERY_SRC))
+
+
+class ConnectableHostTests(unittest.TestCase):
+    def test_wildcard_binds_map_to_loopback(self):
+        self.assertEqual(discovery._connectable_host("0.0.0.0"), "127.0.0.1")
+        self.assertEqual(discovery._connectable_host("::"), "::1")
+
+    def test_other_hosts_pass_through(self):
+        for host in ("127.0.0.1", "::1", "192.168.1.10", "localhost", ""):
+            self.assertEqual(discovery._connectable_host(host), host)
+
+
+class DiscoverWildcardInstanceTests(unittest.TestCase):
+    def setUp(self):
+        self._tmp = tempfile.TemporaryDirectory()
+        self._original_dir = discovery.get_instances_dir
+        discovery.get_instances_dir = lambda: self._tmp.name
+
+        self._stop = threading.Event()
+        self._listener = socket.socket()
+        self._listener.bind(("127.0.0.1", 0))
+        self._listener.listen(5)
+        self._port = self._listener.getsockname()[1]
+        self._acceptor = threading.Thread(target=self._accept_forever, daemon=True)
+        self._acceptor.start()
+
+    def tearDown(self):
+        discovery.get_instances_dir = self._original_dir
+        self._stop.set()
+        self._listener.close()
+        self._acceptor.join(timeout=2)
+        self._tmp.cleanup()
+
+    def _accept_forever(self):
+        self._listener.settimeout(0.2)
+        while not self._stop.is_set():
+            try:
+                connection, _ = self._listener.accept()
+            except (TimeoutError, socket.timeout):
+                continue
+            except OSError:
+                return
+            connection.close()
+
+    def test_live_instance_registered_on_wildcard_host_survives(self):
+        path = discovery.register_instance(
+            "0.0.0.0", self._port, os.getpid(), "wild.bin", "wild.idb"
+        )
+        found = discovery.discover_instances()
+        self.assertEqual(len(found), 1, "live instance was pruned as unreachable")
+        self.assertTrue(os.path.isfile(path), "registration file was deleted")
+        self.assertEqual(
+            found[0]["host"], "127.0.0.1", "consumers got an address they cannot connect to"
+        )
+
+    def test_loopback_instance_still_discovered(self):
+        discovery.register_instance(
+            "127.0.0.1", self._port, os.getpid(), "ok.bin", "ok.idb"
+        )
+        found = discovery.discover_instances()
+        self.assertEqual([i["host"] for i in found], ["127.0.0.1"])
+
+    def test_dead_instance_on_wildcard_host_is_still_pruned(self):
+        discovery.register_instance("0.0.0.0", 1, os.getpid(), "dead.bin", "dead.idb")
+        self.assertEqual(discovery.discover_instances(), [])
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 13: `506d78d3` (2026-09-20)
**Commit Message**: docs: fix dead Claude Code link in supported clients list

**File**: `README.md` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ The binaries and prompt for the video are available in the [mcp-reversing-datase
   - [Amazon Q Developer CLI](https://aws.amazon.com/q/developer/)
   - [Augment Code](https://www.augmentcode.com/)
   - [Claude](https://claude.ai/download)
-  - [Claude Code](https://www.anthropic.com/code)
+  - [Claude Code](https://claude.com/product/claude-code)
   - [Cline](https://cline.bot)
   - [Codex](https://github.com/openai/codex)
   - [Copilot CLI](https://docs.github.com/en/copilot)
```

---

### Incident Patch 14: `b708a8a6` (2026-09-12)
**Commit Message**: fix(decompile): paginate large output within RPC limits

**File**: `src/ida_pro_mcp/ida_mcp/api_analysis.py` (modified, +122/-29)
```diff
@@ -1,5 +1,6 @@
-from itertools import islice
+import json
 import struct
+from itertools import islice
 from typing import Annotated, Any, NotRequired, Optional, TypedDict
 import ida_lines
 import ida_funcs
@@ -14,7 +15,7 @@
 import ida_xref
 import ida_ua
 import ida_name
-from .rpc import tool
+from .rpc import OUTPUT_LIMIT_MAX_CHARS, tool
 from .sync import idasync, tool_timeout, IDAError
 from .utils import (
     parse_address,
@@ -49,19 +50,24 @@
 from . import compat
 
 
+class ResultCursor(TypedDict, total=False):
+    next: int
+    done: bool
+    cancelled: bool
+
+
 class DecompileResult(TypedDict):
     addr: str
     code: str | None
+    line_count: NotRequired[int]
+    total_lines: NotRequired[int]
+    truncated: NotRequired[bool]
+    cursor: NotRequired[ResultCursor]
     refs: NotRequired[list[Ref]]
+    refs_truncated: NotRequired[bool]
     error: NotRequired[str]
 
 
-class ResultCursor(TypedDict, total=False):
-    next: int
-    done: bool
-    cancelled: bool
-
-
 class DisasmResult(TypedDict, total=False):
     addr: str
     asm: DisassemblyFunction | None
@@ -541,11 +547,11 @@ def _resolve_ref_name(ea: int) -> str:
 _STR_CODECS = {0: "utf-8", 1: "utf-16-le", 2: "utf-32-le"}
 
 
-def _resolve_ref(ea: int) -> dict | None:
+def _resolve_ref(ea: int) -> Ref | None:
     name = _resolve_ref_name(ea)
     if not name:
         return None
-    info: dict = {"addr": hex(ea), "name": name}
+    info: Ref = {"addr": hex(ea), "name": name}
     flags = ida_bytes.get_flags(ea)
     if ida_bytes.is_strlit(flags):
         strtype = ida_nalt.get_str_type(ea)
@@ -561,11 +567,11 @@ def _resolve_ref(ea: int) -> dict | None:
     return info
 
 
-def _collect_decompile_refs(cfunc) -> list[dict]:
+def _collect_decompile_refs(cfunc) -> list[Ref]:
     import ida_hexrays
 
     seen: set[int] = set()
-    refs: list[dict] = []
+    refs: list[Ref] = []
 
     class _Visitor(ida_hexrays.ctree_visitor_t):
         def __init__(self):
@@ -585,9 +591,9 @@ def visit_expr(self, e):
     return refs
 
 
-def _collect_line_refs(ea: int) -> list[dict]:
+def _collect_line_refs(ea: int) -> list[Ref]:
     seen: set[int] = set()
-    refs: list[dict] = []
+    refs: list[Ref] = []
     for ref_ea in idautils.CodeRefsFrom(ea, False):
         if ref_ea == idaapi.BADADDR or ref_ea in seen:
             continue
@@ -749,6 +755,58 @@ def _profile_function(
 # Code Analysis & Decompilation
 # ============================================================================
 
+_DECOMPILE_CODE_MAX_CHARS = 30_000
+_DECOMPILE_RESULT_MAX_CHARS = OUTPUT_LIMIT_MAX_CHARS - 5_000
+
+
+def _paginate_decompile_code(
+    code: str, offset: int, max_lines: int
+) -> tuple[str, int, int, bool]:
+    """Return a line page whose JSON-encoded code fits the output budget."""
+    lines = code.split("\n")
+    total_lines = len(lines)
+    available = lines[offset : offset + max_lines]
+    page: list[str] = []
+    # json.dumps("") is two quote characters. Embedded newlines encode as "\\n".
+    encoded_chars = 2
+
+    for line in available:
+        addition = len(json.dumps(line)) - 2
+        if page:
+            addition += 2
+        if page and encoded_chars + addition > _DECOMPILE_CODE_MAX_CHARS:
+            break
+        page.append(line)
+        encoded_chars += addition
+
+    line_count = len(page)
+    more = offset + line_count < total_lines
+    return "\n".join(page), line_count, total_lines, more
+
+
+def _attach_decompile_refs(result: DecompileResult, refs: list[Ref]) -> None:
+    """Attach as many refs as fit without pushing the result into RPC truncation."""
+    if not refs:
+        return
+
+    candidate = dict(result)
+    candidate["refs"] = []
+    # Reserve the marker before sizing so adding it cannot cross the budget.
+    candidate["refs_truncated"] = True
+    encoded_chars = len(json.dumps(candidate))
+    retained: list[Ref] = []
+
+    for ref in refs:
+        addition = len(json.dumps(ref)) + (2 if retained else 0)
+        if encoded_chars + addition > _DECOMPILE_RESULT_MAX_CHARS:
+            result["refs_truncated"] = True
+            break
+        retained.append(ref)
+        encoded_chars += addition
+
+    if retained:
+        result["refs"] = retained
+
 
 @tool
 @idasync
@@ -758,28 +816,63 @@ def decompile(
     include_addresses: Annotated[
         bool, "Append /*0xNNNN*/ markers per line (default: true). Set false to save tokens."
     ] = True,
+    max_lines: Annotated[
+        int,
+        "Max pseudocode lines per page (default: 500, max: 5000); "
+        "pages may be smaller to stay under the output cap",
+    ] = 500,
+    offset: Annotated[int, "Skip first N pseudocode lines (default: 0)"] = 0,
 ) -> DecompileResult:
-    """Decompile function(s) at address(es); returns pseudocode and per-item errors."""
+    """Decompile a function. Follow cursor.next for more code; refs appear on the first page."""
+    if max_lines <= 0 or max_lines > 5000:
+        max_lines = 50
```

**File**: `src/ida_pro_mcp/ida_mcp/rpc.py` (modified, +74/-41)
```diff
@@ -43,32 +43,62 @@ def _generate_output_id() -> str:
 
 
 OUTPUT_LIMIT_PREVIEW_ITEMS = 10
-OUTPUT_LIMIT_PREVIEW_STR_LEN = 1000
+OUTPUT_LIMIT_PREVIEW_STR_LEN = 4000
+OUTPUT_LIMIT_PREVIEW_MAX_CHARS = 40000
 
 
-def _truncate_value(value: Any, depth: int = 0) -> Any:
-    if depth > 5:
-        return value
-
-    if isinstance(value, str) and len(value) > OUTPUT_LIMIT_PREVIEW_STR_LEN:
-        return value[:OUTPUT_LIMIT_PREVIEW_STR_LEN] + f"... [{len(value)} chars total]"
+def _truncate_value_with_limits(
+    value: Any, depth: int, string_limit: int, item_limit: int
+) -> Any:
+    if isinstance(value, str) and len(value) > string_limit:
+        if string_limit == 0:
+            return ""
+        return value[:string_limit] + f"... [{len(value)} chars total]"
 
     if isinstance(value, list):
         # IMPORTANT: Do not inject sentinel objects like {"_truncated": "..."} into lists.
         # Many tool schemas constrain list item shapes (additionalProperties: false),
         # so sentinels can break structured output validation. Truncation is reported
         # via _meta.ida_mcp and the download_hint content.
         return [
-            _truncate_value(item, depth + 1)
-            for item in value[:OUTPUT_LIMIT_PREVIEW_ITEMS]
+            _truncate_value_with_limits(item, depth + 1, string_limit, item_limit)
+            for item in value[:item_limit]
         ]
 
     if isinstance(value, dict):
-        return {k: _truncate_value(v, depth + 1) for k, v in value.items()}
+        return {
+            k: _truncate_value_with_limits(v, depth + 1, string_limit, item_limit)
+            for k, v in value.items()
+        }
 
     return value
 
 
+def _truncate_value(value: Any, depth: int = 0) -> Any:
+    """Build a schema-preserving preview bounded across the whole value."""
+    limits = (
+        (OUTPUT_LIMIT_PREVIEW_STR_LEN, OUTPUT_LIMIT_PREVIEW_ITEMS),
+        (2000, 10),
+        (1000, 10),
+        (1000, 5),
+        (500, 5),
+        (500, 2),
+        (200, 2),
+        (200, 1),
+        (100, 1),
+        (50, 1),
+        (0, 0),
+    )
+    preview: Any = value
+    for string_limit, item_limit in limits:
+        preview = _truncate_value_with_limits(
+            value, depth, string_limit, item_limit
+        )
+        if len(json.dumps(preview)) <= OUTPUT_LIMIT_PREVIEW_MAX_CHARS:
+            break
+    return preview
+
+
 def _build_download_meta(output_id: str, total_chars: int) -> dict:
     download_url = f"{get_download_base_url()}/output/{output_id}.json"
     return {
@@ -91,45 +121,48 @@ def _cache_output(output_id: str, data: Any) -> None:
     _output_cache[output_id] = data
 
 
-def _install_tools_call_patch() -> None:
-    original = MCP_SERVER.registry.methods["tools/call"]
+def _limit_output_response(response: dict) -> dict:
+    if response.get("isError"):
+        return response
 
-    def patched(
-        name: str, arguments: Optional[dict] = None, _meta: Optional[dict] = None
-    ) -> dict:
-        response = original(name, arguments, _meta)
+    structured = response.get("structuredContent")
+    if structured is None:
+        return response
 
-        if response.get("isError"):
-            return response
+    serialized = json.dumps(structured)
+    if len(serialized) <= OUTPUT_LIMIT_MAX_CHARS:
+        return response
 
-        structured = response.get("structuredContent")
-        if structured is None:
-            return response
+    output_id = _generate_output_id()
+    _cache_output(output_id, structured)
 
-        serialized = json.dumps(structured)
-        if len(serialized) <= OUTPUT_LIMIT_MAX_CHARS:
-            return response
+    preview = _truncate_value(structured)
+    download_meta = _build_download_meta(output_id, len(serialized))
 
-        output_id = _generate_output_id()
-        _cache_output(output_id, structured)
+    content = [{
+        "type": "text",
+        "text": json.dumps(preview, separators=(",", ":")),
+    }, {
+        "type": "text",
+        "text": download_meta["download_hint"],
+    }]
 
-        preview = _truncate_value(structured)
-        download_meta = _build_download_meta(output_id, len(serialized))
+    return {
+        "structuredContent": preview,
+        "content": content,
+        "isError": False,
+        "_meta": {"ida_mcp": download_meta},
+    }
 
-        content = [{
-            "type": "text",
-            "text": json.dumps(preview, separators=(",", ":")),
-        }, {
-            "type": "text",
-            "text": download_meta["download_hint"],
-        }]
 
-        return {
-            "structuredContent": preview,
-            "content": content,
-            "isError": False,
-            "_meta": {"ida_mcp": download_meta},
-        }
+def _install_tools_call_patch() -> None:
+    original = MCP_SERVER.registry.methods["tools/call"]
+
+    def patched(
+        name: str, arguments: Optional[dict] = None, _meta: Optional[dict] = None
+    ) -> dict:
+    
```

**File**: `src/ida_pro_mcp/ida_mcp/tests/test_api_analysis.py` (modified, +61/-1)
```diff
@@ -48,9 +48,25 @@ def test_decompile_valid_function():
         skip_test("binary has no functions")
 
     result = decompile(fn_addr)
-    assert_shape(result, {"addr": str, "code": optional(str), "error": optional(str)})
+    assert_shape(
+        result,
+        {
+            "addr": str,
+            "code": optional(str),
+            "line_count": optional(int),
+            "total_lines": optional(int),
+            "truncated": optional(bool),
+            "cursor": optional(dict),
+            "refs": optional(list),
+            "refs_truncated": optional(bool),
+            "error": optional(str),
+        },
+    )
     assert_ok(result, "code")
     assert_non_empty(result["code"])
+    assert result["line_count"] == len(result["code"].split("\n"))
+    assert result["total_lines"] >= result["line_count"]
+    assert "done" in result["cursor"] or "next" in result["cursor"]
 
 
 @test(binary="crackme03.elf")
@@ -120,6 +136,50 @@ def test_decompile_include_addresses_false_strips_markers():
     assert "/*0x" not in result["code"]
 
 
+@test()
+def test_decompile_pagination():
+    """decompile enforces max_lines and advances the cursor across pages."""
+    fn_addr = get_any_function()
+    if not fn_addr:
+        skip_test("binary has no functions")
+
+    full = decompile(fn_addr, max_lines=5000)
+    assert_ok(full, "code")
+    total = full["total_lines"]
+    if total < 6:
+        skip_test("function has fewer than 6 pseudocode lines")
+
+    page1 = decompile(fn_addr, max_lines=3)
+    assert_ok(page1, "code")
+    assert page1["line_count"] == 3
+    assert page1["total_lines"] == total
+    assert page1["truncated"] is True
+    assert "next" in page1["cursor"]
+    assert page1["code"] == "\n".join(full["code"].split("\n")[:3])
+
+    page2 = decompile(fn_addr, max_lines=3, offset=page1["cursor"]["next"])
+    assert_ok(page2, "code")
+    assert page2["line_count"] <= 3
+    assert page2["code"] != page1["code"]
+    assert page2["code"] == "\n".join(full["code"].split("\n")[3 : 3 + page2["line_count"]])
+
+
+@test(binary="crackme03.elf")
+def test_decompile_refs_only_on_first_page():
+    """Refs are attached on offset=0 and omitted on later pages."""
+    first = decompile(CRACKME_MAIN, max_lines=2, offset=0)
+    assert_ok(first, "code")
+    assert first.get("refs"), "expected refs on first page"
+
+    nxt = first["cursor"].get("next")
+    if nxt is None:
+        skip_test("main has fewer than 3 pseudocode lines")
+
+    later = decompile(CRACKME_MAIN, max_lines=2, offset=nxt)
+    assert_ok(later, "code")
+    assert "refs" not in later
+
+
 @test()
 def test_disasm_valid_function():
     """disasm returns non-empty assembly for a valid function."""
```

**File**: `src/ida_pro_mcp/ida_mcp/tests/test_api_analysis_internals.py` (modified, +55/-0)
```diff
@@ -1,12 +1,20 @@
 """Targeted tests for deeper internal helpers in api_analysis.py."""
 
+import json
+
 from ..framework import test, assert_non_empty
 from ..api_analysis import (
+    _DECOMPILE_CODE_MAX_CHARS,
+    _DECOMPILE_RESULT_MAX_CHARS,
+    DecompileResult,
+    _attach_decompile_refs,
+    _paginate_decompile_code,
     _resolve_insn_scan_ranges,
     _scan_insn_ranges,
     _value_to_le_bytes,
     _value_candidates_for_immediate,
 )
+from ..utils import Ref
 
 
 @test(binary="typed_fixture.elf")
@@ -112,3 +120,50 @@ def test_internal_immediate_encoding_helpers():
     assert_non_empty(candidates)
     assert any(item[0] == 1234 and item[1] == 4 for item in candidates)
     assert any(item[0] == 1234 and item[1] == 8 for item in candidates)
+
+
+@test()
+def test_internal_decompile_pagination_respects_character_budget():
+    """Large line pages stop at the character budget and advance by visible lines."""
+    lines = [f"{i:04d} " + ("x" * 115) for i in range(500)]
+    code = "\n".join(lines)
+
+    page1, count1, total, more1 = _paginate_decompile_code(code, 0, 500)
+    assert 0 < count1 < 500
+    assert total == 500
+    assert more1 is True
+    assert page1.split("\n") == lines[:count1]
+    assert len(json.dumps(page1)) <= _DECOMPILE_CODE_MAX_CHARS
+
+    page2, count2, total2, more2 = _paginate_decompile_code(
+        code, count1, 500
+    )
+    assert count2 > 0
+    assert total2 == total
+    assert page2.split("\n") == lines[count1 : count1 + count2]
+    assert more2 is (count1 + count2 < total)
+
+
+@test()
+def test_internal_decompile_refs_fit_result_budget():
+    """First-page refs are truncated before they can trigger RPC truncation."""
+    result: DecompileResult = {
+        "addr": "main",
+        "code": "x" * _DECOMPILE_CODE_MAX_CHARS,
+        "line_count": 1,
+        "total_lines": 1,
+        "truncated": False,
+        "cursor": {"done": True},
+    }
+    refs: list[Ref] = [
+        {"addr": hex(i), "name": f"ref_{i}", "string": "s" * 1000}
+        for i in range(100)
+    ]
+
+    _attach_decompile_refs(result, refs)
+
+    retained = result.get("refs", [])
+    assert retained
+    assert len(retained) < len(refs)
+    assert result.get("refs_truncated") is True
+    assert len(json.dumps(result)) <= _DECOMPILE_RESULT_MAX_CHARS
```

**File**: `tests/test_mcp_spec_truncation.py` (modified, +19/-22)
```diff
@@ -39,31 +39,10 @@ def _fresh_truncated_server() -> McpServer:
     rpc = load_ida_rpc_module()
     srv = rpc.McpServer("truncation-test")
     original = srv.registry.methods["tools/call"]
-    limit = rpc.OUTPUT_LIMIT_MAX_CHARS
 
     def patched(name, arguments=None, _meta=None):
         response = original(name, arguments, _meta)
-        if response.get("isError"):
-            return response
-        structured = response.get("structuredContent")
-        if structured is None:
-            return response
-        serialized = json.dumps(structured)
-        if len(serialized) <= limit:
-            return response
-        output_id = rpc._generate_output_id()
-        rpc._cache_output(output_id, structured)
-        preview = rpc._truncate_value(structured)
-        download_meta = rpc._build_download_meta(output_id, len(serialized))
-        return {
-            "structuredContent": preview,
-            "content": [
-                {"type": "text", "text": json.dumps(preview, separators=(",", ":"))},
-                {"type": "text", "text": download_meta["download_hint"]},
-            ],
-            "isError": False,
-            "_meta": {"ida_mcp": download_meta},
-        }
+        return rpc._limit_output_response(response)
 
     srv.registry.methods["tools/call"] = patched
     return srv
@@ -132,6 +111,24 @@ def test_content_text_blocks_are_valid(self):
                 self.assertEqual(block["type"], "text")
                 self.assertIsInstance(block["text"], str)
 
+    def test_preview_respects_aggregate_character_budget(self):
+        class ManyStrings(TypedDict):
+            fields: dict[str, str]
+
+        srv = _fresh_truncated_server()
+
+        @srv.tool
+        def many_strings() -> ManyStrings:
+            """Returns many independently large string fields."""
+            return {"fields": {f"field_{i}": "x" * 10000 for i in range(20)}}
+
+        result = call_rpc(srv, "tools/call", name="many_strings", arguments={})
+        preview = result["structuredContent"]
+        rpc = load_ida_rpc_module()
+        self.assertLessEqual(
+            len(json.dumps(preview)), rpc.OUTPUT_LIMIT_PREVIEW_MAX_CHARS
+        )
+
 
 class DownloadUrlDerivationOverHttpTests(unittest.TestCase):
     def test_download_url_uses_forwarded_public_base(self):
```

---

### Incident Patch 15: `f19e02bb` (2026-08-27)
**Commit Message**: Merge pull request #515 from Iams4kura/bugfix/omit-notification-response-body-20260827t160207z

fix(http): omit notification response bodies

**File**: `src/ida_pro_mcp/ida_mcp/zeromcp/mcp.py` (modified, +1/-1)
```diff
@@ -755,7 +755,7 @@ def send_response(status: int, body: bytes):
 
         # Check if notification (returns None)
         if response is None:
-            send_response(202, b"Accepted")
+            send_response(202, b"")
         else:
             send_response(200, json.dumps(response).encode("utf-8"))
 
```

**File**: `tests/test_mcp_spec_http_e2e.py` (modified, +26/-0)
```diff
@@ -262,6 +262,32 @@ def test_server_assigns_or_echoes_session_id_on_initialize(self):
         if session_id is not None:
             self.assertGreater(len(session_id), 0)
 
+    def test_notification_response_is_bodyless(self):
+        payload = json.dumps(
+            {"jsonrpc": "2.0", "method": "notifications/initialized"}
+        ).encode("utf-8")
+        connection = http.client.HTTPConnection(
+            self.harness.host, self.harness.port, timeout=2
+        )
+        try:
+            connection.request(
+                "POST",
+                "/mcp",
+                body=payload,
+                headers={
+                    "Accept": "application/json, text/event-stream",
+                    "Content-Type": "application/json",
+                },
+            )
+            response = connection.getresponse()
+            body = response.read()
+        finally:
+            connection.close()
+
+        self.assertEqual(response.status, 202)
+        self.assertEqual(response.getheader("Content-Length"), "0")
+        self.assertEqual(body, b"")
+
 
 class Http11TransportTests(unittest.TestCase):
     def test_rejects_missing_and_duplicate_host(self):
```

#### Recent Merged Pull Requests:
- **PR #546** (closed): Fix cleanup of IDA working files when closing idalib sessionsCodex/fix packed idb cleanup (@Septemberlemon)
- **PR #540** (2026-09-22): find/insn_query: match sign-extended immediates (@VecSzn)
- **PR #539** (2026-09-22): fix(rpc): treat a blank IDA_MCP_URL as unset for download URLs (@Lesereingrape)
- **PR #535** (2026-09-21): entity_query/type_query: count=0 should return all rows (@VecSzn)
- **PR #534** (2026-09-21): jsonrpc: don't JSON-decode string args when the union includes str (@VecSzn)
- **PR #533** (2026-09-21): fix(idalib): fall back to defaults for blank IDA_MCP_* values (@Lesereingrape)
- **PR #531** (2026-09-21): fix(installer): let --uninstall run when IDA Free is installed (@Lesereingrape)
- **PR #529** (2026-09-21): fix(installer): keep IPv6 brackets in generated transport URLs (@Lesereingrape)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
