# Forensic Learning Record (Deep Inspection): ant-research/AntOmniEvo

> **Canonical Artifact**: `07_PROJECT_LEARNING/ant-research-antomnievo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ant-research/AntOmniEvo](https://github.com/ant-research/AntOmniEvo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:50:04.614Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ant-research/AntOmniEvo`
- **Description**: An auto-evolution framework that optimizes anything — your 7×24 team of algorithm engineers.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 964 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `antomnievo/common/utils/analysis_parser.py`
```
"""Parse RunAnalysis JSON from Claude Code raw output and validate entries.

Extracts the RunAnalysis JSON that the model produces from the stream-json
output, using multiple extraction strategies for robustness.
"""

import json
import re

from antomnievo.model.candidate_data import RunAnalysis

_VAGUE_PHRASES = [
    "the answer was wrong",
    "the answer was correct",
    "the system made a mistake",
    "the system performed well",
    "the system performed poorly",
    "failed to answer correctly",
]


def parse_analysis_from_output(raw_output: str, expected_data_id: str) -> RunAnalysis:
    """Extract RunAnalysis JSON from Claude Code stream-json output.

    Scans the raw output for a JSON object containing the expected data_id.
    Tries multiple extraction strategies:
    1. Search for JSON in markdown code fences
    2. Find a JSON object containing "data_id" by brace tracking
    3. Direct JSON parse of the final result event text

    Raises ValueError if no valid JSON can be extracted.
    """
    # Extract text content from stream-json events
    texts = _extract_texts_from_stream_json(raw_output)
    # Process in reverse order — the final result is most likely to contain the JSON
    for text in reversed(texts):
        result = _try_extract_json(text, expected_data_id)
        if result:
            return result

    raise ValueError(
        f"Could not extract RunAnalysis JSON for data_id={expected_data_id} "
        f"from output ({len(raw_output)} chars)"
    )


def _extract_texts_from_stream_json(raw_output: str) -> list[str]:
    """Extract all text content from stream-json output lines.

    Collects text from:
    - assistant events (model text content blocks)
    - result events (final result text)
    """
    texts: list[str] = []
    for line in raw_output.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        event_type = event.get("type")

        if event_type == "assistant":
            message = event.get("message", {})
            for block in message.get("content", []):
                if block.get("type") == "text":
                    text = block.get("text", "")
                    if text:
                        texts.append(text)

        elif event_type == "result":
            result_text = event.get("result", "")
            if result_text:
                texts.append(result_text)

    return texts


def _try_extract_json(text: str, expected_data_id: str) -> RunAnalysis | None:
    """Try to extract a RunAnalysis from a text string using multiple strategies."""
    # Try 1: Direct parse
    try:
        data = json.loads(text.strip())
        if isinstance(data, dict) and data.get("data_id") == expected_data_id:
            return RunAnalysis.model_validate(data)
    except (json.JSONDecodeError, Exception):
        pass

    # Try 2: Extract from markdown code fence
    fence_match = re.search(r"```(?:json)?\s*\n(.*?)\n\s*```", text, re.DOTALL)
    if fence_match:
        try:
            data = json.loads(fence_match.group(1).strip())
            if isinstance(data, dict) and data.get("data_id") == expected_data_id:
                return RunAnalysis.model_validate(data)
        except (json.JSONDecodeError, Exception):
            pass

    # Try 3: Find a JSON object containing "data_id" by brace tracking
    start = text.find('{"data_id"')
    if start == -1:
        start = text.find('{\n  "data_id"')
    if start == -1:
        start = text.find('{"data_id"'.replace('"', '“'))
    if start >= 0:
        complete = _extract_complete_json(text, start)
        if complete:
            try:
                data = json.loads(complete)
                if isinstance(data, dict) and data.get("data_id") == expected_data_id:
                    return RunAnalysis.model_validate(data)
            except (json.JSONDecodeError, Exception):
                pass

    return None


def _extract_complete_json(text: str, start: int) -> str | None:
    """Extract a complete JSON object starting at position start by tracking braces."""
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        c = text[i]
        if escape:
            escape = False
            continue
        if c == "\\" and in_string:
            escape = True
            continue
        if c == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def validate_analysis_entry(analysis: RunAnalysis) -> list[str]:
    """Validate a RunAnalysis entry. Returns list of error messages (empty if valid)."""
    errors: list[str] = []
    prefix = f"data_id={analysis.data_id!r}"

    for i, item in enumerate(analysis.trajectory_analysis):
        if not item or not item.strip():
            errors.append(f"{prefix}: trajectory_analysis[{i}] is empty")
            continue
        low = item.lower()
        for vague in _VAGUE_PHRASES:
            if vague in low and len(item) < len(vague) + 20:
                errors.append(f"{prefix}: trajectory_analysis[{i}] is too vague: {item!r}")
                break

    for j, action in enumerate(analysis.actions):
        for action_field in ("file", "operation", "artifact_issue", "change", "resolves"):
            value = getattr(action, action_field, "")
            if not value:
                errors.append(f"{prefix}: actions[{j}].{action_field} is empty")
                continue
            if not isinstance(value, str):
                continue
            low = value.lower()
            for vague in _VAGUE_PHRASES:
                if vague in low and len(value) < len(vague) + 20:
                    errors.append(f"{prefix}: actions[{j}].{action_field} is too vague: {value!r}")
                    break

    return errors

```

### Core Architecture Module: `antomnievo/common/utils/concurrency_pool.py`
```
"""Async concurrency slot pool.

Unlike ``asyncio.Semaphore``, supports acquiring/releasing N slots atomically,
so callers can reserve a variable-sized chunk of a shared budget.
"""
from __future__ import annotations

import asyncio


class ConcurrencyPool:
    """Shared async slot pool. Acquire/release N slots atomically."""

    def __init__(self, total: int):
        if total <= 0:
            raise ValueError(f"total must be > 0, got {total}")
        self._total = total
        self._available = total
        self._cond = asyncio.Condition()

    @property
    def total(self) -> int:
        return self._total

    @property
    def available(self) -> int:
        return self._available

    async def set_total(self, total: int) -> None:
        if total <= 0:
            raise ValueError(f"total must be > 0, got {total}")
        async with self._cond:
            delta = total - self._total
            self._total = total
            self._available += delta
            if delta > 0:
                self._cond.notify_all()

    async def acquire(self, n: int) -> None:
        if n <= 0:
            return
        if n > self._total:
            raise ValueError(f"requested {n} slots exceeds total {self._total}")
        async with self._cond:
            while self._available < n:
                await self._cond.wait()
            self._available -= n

    async def release(self, n: int) -> None:
        if n <= 0:
            return
        async with self._cond:
            self._available = min(self._total, self._available + n)
            self._cond.notify_all()

    def slot(self, n: int) -> _PoolSlot:
        """Async context manager that holds *n* slots for its scope."""
        return _PoolSlot(self, n)


class _PoolSlot:
    def __init__(self, pool: ConcurrencyPool, n: int):
        self._pool = pool
        self._n = n

    async def __aenter__(self) -> ConcurrencyPool:
        await self._pool.acquire(self._n)
        return self._pool

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self._pool.release(self._n)

```

### Core Architecture Module: `antomnievo/common/utils/fs_utils.py`
```
import os


def get_latest_mtime(dir_path: str) -> float:
    """Return the most recent modification time of any file under dir_path."""
    latest = 0.0
    for root, _, files in os.walk(dir_path):
        for fname in files:
            fpath = os.path.join(root, fname)
            try:
                mt = os.path.getmtime(fpath)
                if mt > latest:
                    latest = mt
            except OSError:
                continue
    return latest


def file_written_since(path: str, since_ts: float, eps: float = 1e-3) -> bool:
    """True if `path` exists and was modified at or after `since_ts` (epoch seconds).

    Used to verify an agent actually (re)wrote its output file during its run —
    a pre-existing stale file does not count. `eps` tolerates coarse filesystem
    timestamp granularity.
    """
    try:
        return os.path.getmtime(path) >= since_ts - eps
    except OSError:
        return False

```

### Core Architecture Module: `antomnievo/common/utils/json_utils.py`
```
import json
from typing import Any, Dict, List


def parse_jsonl_file(file_path: str, encoding: str = 'utf-8') -> List[Dict[str, Any]]:
    """
    解析JSONL文件，返回所有行的列表

    Args:
        file_path: JSONL文件路径
        encoding: 文件编码，默认utf-8

    Returns:
        包含所有JSON对象的列表 (list[Dict[str, Any]])
    """
    data_list = []

    with open(file_path, 'r', encoding=encoding) as file:
        for line_num, line in enumerate(file, start=1):
            line = line.strip()
            if not line:  # 跳过空行
                continue

            try:
                json_obj = json.loads(line)
                data_list.append(json_obj)
            except json.JSONDecodeError as e:
                print(f"警告: 第{line_num}行JSON格式错误: {e}")
                continue

    return data_list

```

### Core Architecture Module: `antomnievo/common/utils/param_utils.py`
```
from __future__ import annotations

import dataclasses
import enum

_SECRET_KEYS = {"api_key", "secret", "token", "password"}


def _mask_secrets(d: dict) -> dict:
    for k, v in list(d.items()):
        if any(s in k for s in _SECRET_KEYS):
            d[k] = "***" if v else None
        elif isinstance(v, dict):
            _mask_secrets(v)
    return d


def extract_params(obj: object) -> dict:
    """Auto-extract serializable init parameters from an object.

    Handles plain attributes, dataclass fields, and nested objects.
    Masks values whose key matches a known secret pattern.
    """
    attrs = {}
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        attrs = dataclasses.asdict(obj)
    else:
        for k, v in vars(obj).items():
            if k.startswith("_"):
                if dataclasses.is_dataclass(v) and not isinstance(v, type):
                    attrs[k.lstrip("_")] = dataclasses.asdict(v)
                continue
            if isinstance(v, (str, int, float, bool, type(None), list)):
                attrs[k] = v
            elif isinstance(v, enum.Enum):
                attrs[k] = v.value
            elif dataclasses.is_dataclass(v) and not isinstance(v, type):
                attrs[k] = dataclasses.asdict(v)
    return _mask_secrets(attrs)

```

### Core Architecture Module: `antomnievo/common/utils/pydantic_desc.py`
```
from __future__ import annotations

import types
from datetime import datetime
from typing import get_args, get_origin

from pydantic import BaseModel

_TYPE_DISPLAY: dict[type, str] = {
    str: "str",
    int: "int",
    float: "float",
    bool: "bool",
    datetime: "datetime",
    list: "list",
    types.NoneType: "null",
}


def display_type(ann) -> str:
    if ann in _TYPE_DISPLAY:
        return _TYPE_DISPLAY[ann]
    origin = get_origin(ann)
    if origin is list:
        args = get_args(ann)
        if args:
            inner = args[0].__name__ if hasattr(args[0], "__name__") else str(args[0])
            return f"list[{inner}]"
        return "list"
    # Union / Optional (e.g. Optional[str] -> str or null)
    if origin is types.UnionType:
        args = get_args(ann)
        parts = [display_type(a) for a in args if a is not type(None)]
        return " or ".join(parts) if parts else "null"
    # typing.Union (Python 3.9 compat)
    try:
        import typing
        if origin is typing.Union:
            args = get_args(ann)
            parts = [display_type(a) for a in args if a is not type(None)]
            return " or ".join(parts) if parts else "null"
    except AttributeError:
        pass
    if hasattr(ann, "__name__"):
        return ann.__name__
    return str(ann)


def is_pydantic_model(cls) -> bool:
    return isinstance(cls, type) and issubclass(cls, BaseModel)


def sub_model_fields(model_cls: type[BaseModel], indent: str = "  ", _visited: frozenset[type] | None = None) -> str:
    if _visited is None:
        _visited = frozenset()
    _visited = _visited | {model_cls}

    lines = []
    for fname, finfo in model_cls.model_fields.items():
        ann = finfo.annotation
        type_str = display_type(ann)
        desc = finfo.description or ""
        lines.append(f"{indent}- **{fname}** ({type_str}): {desc}" if desc else f"{indent}- **{fname}** ({type_str})")

        sub_cls = None
        origin = get_origin(ann)
        if origin is list:
            args = get_args(ann)
            if args and is_pydantic_model(args[0]):
                sub_cls = args[0]
        elif is_pydantic_model(ann):
            sub_cls = ann
        if sub_cls and sub_cls not in _visited:
            lines.append(sub_model_fields(sub_cls, indent=indent + "  ", _visited=_visited))

    return "\n".join(lines)


def model_fields_description(model_cls: type[BaseModel]) -> str:
    visited: frozenset[type] = frozenset({model_cls})
    lines = []
    for name, info in model_cls.model_fields.items():
        ann = info.annotation
        type_str = display_type(ann)
        desc = info.description or ""
        lines.append(f"- **{name}** ({type_str}): {desc}" if desc else f"- **{name}** ({type_str})")

        sub_cls = None
        origin = get_origin(ann)
        if origin is list:
            args = get_args(ann)
            if args and is_pydantic_model(args[0]):
                sub_cls = args[0]
        elif is_pydantic_model(ann):
            sub_cls = ann
        if sub_cls and sub_cls not in visited:
            lines.append(sub_model_fields(sub_cls, _visited=visited))

    return "\n".join(lines)

```

### Core Architecture Module: `antomnievo/common/utils/trajectory_parser.py`
```
"""Parse agent CLI output (stream-json / Pi JSON mode / eddy) into Trajectory + UsageStats.

Provides:
- parse_stream_json: Claude Code stream-json → Trajectory parsing
- parse_pi_json_output: Pi Coding Agent JSON mode → Trajectory parsing
- parse_eddy_trajectory: eddy agent trajectory dict → Trajectory parsing
"""

import json
import logging
from datetime import datetime
from typing import Any

from antomnievo.model.trajectory import Span, Trajectory
from antomnievo.model.usage_stats import UsageStats

logger = logging.getLogger(__name__)


def parse_stream_json(raw_output: str) -> tuple[Trajectory, UsageStats]:
    """Parse Claude Code stream-json output into a Trajectory and UsageStats.

    Each line of raw_output is a JSON event. Supported event types:
    - "assistant": model turn with text and/or tool_use content blocks
    - "user": tool_result content blocks (matched by tool_use_id)
    - "result": final result text (attached to last model span) with usage stats

    Returns:
        A tuple of (Trajectory, UsageStats).
    """
    root_spans: list[Span] = []
    current_model_span: Span | None = None
    tool_result_map: dict[str, str] = {}
    stats = UsageStats()

    for line in raw_output.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        event_type = event.get("type")

        if event_type == "assistant":
            message = event.get("message", {})
            content: list[dict[str, Any]] = message.get("content", [])

            model_span = Span(
                name="model",
                span_type="model",
                input=None,
                start_time=datetime.now(),
            )
            tool_spans: list[Span] = []

            for block in content:
                if block.get("type") == "tool_use":
                    tool_span = Span(
                        name=block.get("name", "unknown"),
                        span_type="tool_call",
                        input=block.get("input"),
                        start_time=datetime.now(),
                        metadata={"tool_call_id": block.get("id")},
                    )
                    tool_spans.append(tool_span)
                elif block.get("type") == "text":
                    model_span.input = block.get("text", "")

            for ts in tool_spans:
                tc_id = ts.metadata.get("tool_call_id")
                if tc_id and tc_id in tool_result_map:
                    ts.output = {"result": tool_result_map.pop(tc_id)}
                model_span.add_child(ts)

            model_span.end_time = datetime.now()
            root_spans.append(model_span)
            current_model_span = model_span

        elif event_type == "user":
            message = event.get("message", {})
            for block in message.get("content", []):
                if block.get("type") == "tool_result":
                    tc_id = block.get("tool_use_id")
                    content_str = block.get("content", "")
                    if tc_id:
                        tool_result_map[tc_id] = str(content_str)

        elif event_type == "result":
            result_text = event.get("result", "")
            if current_model_span:
                current_model_span.output = result_text

            usage = event.get("usage", {})
            if usage:
                stats.input_tokens = usage.get("input_tokens", 0)
                stats.output_tokens = usage.get("output_tokens", 0)
                stats.cache_creation_input_tokens = usage.get("cache_creation_input_tokens", 0)
                stats.cache_read_input_tokens = usage.get("cache_read_input_tokens", 0)

    # Attach any remaining tool results to matching tool spans
    for tc_id, result in tool_result_map.items():
        for span in root_spans:
            for child in span.children:
                if child.metadata.get("tool_call_id") == tc_id:
                    child.output = {"result": result}
                    break

    return Trajectory(root_span_list=root_spans), stats


def parse_pi_json_output(raw_output: str) -> tuple[Trajectory, UsageStats]:
    """Parse Pi Coding Agent JSON mode output into a Trajectory and UsageStats.

    Pi emits NDJSON events. Key event types:
    - "message_start" / "message_update" / "message_end": message streaming
    - "tool_execution_start" / "tool_execution_end": tool calls
    - "agent_start" / "agent_end" / "turn_start" / "turn_end": lifecycle

    Assistant message content blocks include "thinking", "text", and "toolCall".
    Each assistant message becomes one "model" span whose children are, in stream
    order, "thinking" spans and "tool_call" spans. Plain text segments are
    concatenated into the model span's output. Tool results from "toolResult"
    user messages or "tool_execution_end" events are attached as the tool span's
    output. Usage stats accumulate from each assistant message_end's usage field.

    Returns:
        A tuple of (Trajectory, UsageStats).
    """
    root_spans: list[Span] = []
    current_model_span: Span | None = None
    current_thinking_span: Span | None = None
    pending_children: list[Span] = []
    tool_result_map: dict[str, str] = {}
    stats = UsageStats()

    ignored_event_types = {
        "session", "agent_start",
        "compaction_start", "compaction_end",
        "auto_retry_start", "auto_retry_end",
        "thinking_level_changed", "session_info_changed",
        "queue_update", "tool_execution_update",
        "turn_start", "turn_end",
    }

    def flush_current_model_span() -> None:
        nonlocal current_model_span, current_thinking_span, pending_children
        if current_model_span is None:
            pending_children = []
            current_thinking_span = None
            return
        for ch in pending_children:
            if ch.span_type == "tool_call":
                tc_id = ch.metadata.get("tool_call_id")
                if tc_id and tc_id in tool_result_map:
                    ch.output = {"result": tool_result_map.pop(tc_id)}
            current_model_span.add_child(ch)
        current_model_span.end_time = datetime.now()
        root_spans.append(current_model_span)
        current_model_span = None
        current_thinking_span = None
        pending_children = []

    def find_pending_tool_span(tc_id: str) -> Span | None:
        for ch in pending_children:
            if ch.span_type == "tool_call" and ch.metadata.get("tool_call_id") == tc_id:
                return ch
        return None

    def _iter_events(raw: str):
        """Yield event dicts from NDJSON, flattening any nested arrays."""
        for line_num, line in enumerate(raw.strip().splitlines(), 1):
            line = line.strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                logger.warning(f"Skipping malformed JSON at line {line_num}: {line[:100]}")
                continue
            if isinstance(parsed, dict):
                yield parsed
            elif isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        yield item
                    else:
                        logger.warning(f"Skipping non-dict element in nested array at line {line_num}: {type(item).__name__}")
            else:
                logger.warning(f"Skipping unexpected JSON type at line {line_num}: {type(parsed).__name__}")

    for event in _iter_events(raw_output):
        event_type = event.get("type")
        if event_type in ignored_event_types:
            continue

        if event_type == "message_start":
            message = event.get("message", {})
            if message.get("role") == "assistant":
                flush_current_model_span()
                current_model_span = Span(
                    name="model",
                    span_type="model",
                    input=None,
                    start_time=datetime.now(),
                )

        elif event_type == "message_update":
            if current_model_span is None:
                continue
            assistant_event = event.get("assistantMessageEvent", {})
            delta_type = assistant_event.get("type", "")

            if delta_type == "thinking_start":
                current_thinking_span = Span(
                    name="thinking",
                    span_type="thinking",
                    input=None,
                    output="",
                    start_time=datetime.now(),
                )
                pending_children.append(current_thinking_span)

            elif delta_type == "thinking_delta":
                if current_thinking_span is None:
                    current_thinking_span = Span(
                        name="thinking",
                        span_type="thinking",
                        input=None,
                        output="",
                        start_time=datetime.now(),
                    )
                    pending_children.append(current_thinking_span)
                delta = assistant_event.get("thinking") or assistant_event.get("text") or ""
                current_thinking_span.output = (current_thinking_span.output or "") + delta

            elif delta_type == "thinking_end":
                if current_thinking_span is not None:
                    canonical = assistant_event.get("content") or assistant_event.get("thinking")
                    if canonical:
                        current_thinking_span.output = canonical
                    current_thinking_span.end_time = datetime.now()
                    current_thinking_span = None

            elif delta_type == "text_delta":
                text = assistant_event.get("text", "")
                if text:
                    current_model_sp
```

### Core Architecture Module: `antomnievo/proposer/utils/claude_code_utils.py`
```
"""Utilities for working with Claude Code: invocation and configuration.

Provides:
- ClaudeCodeConfig: configuration for invoking the Claude Code CLI
- invoke_claude_code: async subprocess invocation of Claude Code CLI
"""

import asyncio
import logging
import os
import sys
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ClaudeCodeConfig:
    """Configuration for invoking Claude Code CLI."""

    claude_code_path: str = "claude"
    model: str = "kimi-k2.5"
    max_turns: int = 150
    timeout: int = 3600
    api_key: str | None = None
    base_url: str | None = None
    max_context_tokens: int | None = None
    autocompact_pct: int | None = None
    config_dir: str | None = None


async def invoke_claude_code(
    prompt: str,
    cwd: str,
    config: ClaudeCodeConfig,
) -> str:
    """Invoke Claude Code CLI as a subprocess and return raw stream-json output.

    Args:
        prompt: The prompt to send to Claude Code via -p flag.
        cwd: Working directory for the subprocess.
        config: Claude Code configuration (path, model, env vars, etc.).

    Returns:
        Raw stdout from Claude Code (stream-json NDJSON).

    Raises:
        RuntimeError: If Claude Code exits with a non-zero return code.
    """
    cmd = [
        config.claude_code_path,
        "--print",
        "--output-format", "stream-json",
        "--verbose",
        "--model", config.model,
        "--dangerously-skip-permissions",
        "--max-turns", str(config.max_turns),
        "-p", prompt,
    ]
    # Env var reference: https://code.claude.com/docs/en/env-vars
    env = os.environ.copy()
    # Ensure the venv bin directory (where entry-point scripts like
    # validate-analysis live) is on PATH for the Claude Code subprocess.
    venv_bin = os.path.dirname(sys.executable)
    if venv_bin not in env.get("PATH", "").split(os.pathsep):
        env["PATH"] = venv_bin + os.pathsep + env.get("PATH", "")
    # CLAUDECODE: set to 1 in shells spawned by Claude Code. Strip it to prevent
    # the nesting guard from blocking programmatic subprocess usage.
    env.pop("CLAUDECODE", None)
    # CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: equivalent of setting
    # DISABLE_AUTOUPDATER, DISABLE_FEEDBACK_COMMAND, DISABLE_ERROR_REPORTING,
    # and DISABLE_TELEMETRY. Reduces non-essential network traffic.
    env["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "1"
    # ANTHROPIC_API_KEY: API key sent as X-Api-Key header. When set, this key
    # is used instead of the Claude subscription.
    if config.api_key:
        env["ANTHROPIC_API_KEY"] = config.api_key
    if config.base_url:
        env["ANTHROPIC_BASE_URL"] = config.base_url
    # CLAUDE_CODE_AUTO_COMPACT_WINDOW: set the context capacity in tokens used
    # for auto-compaction calculations. Defaults to the model's context window.
    # When set, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE is applied as a percentage of
    # this value instead of the model's actual context window.
    if config.max_context_tokens:
        env["CLAUDE_CODE_AUTO_COMPACT_WINDOW"] = str(config.max_context_tokens)
    # CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: trigger auto-compaction at this % of
    # CLAUDE_CODE_AUTO_COMPACT_WINDOW. Default ~93.5%; lower values compact
    # earlier to avoid hitting the token limit.
    if config.autocompact_pct:
        env["CLAUDE_AUTOCOMPACT_PCT_OVERRIDE"] = str(config.autocompact_pct)
    if config.config_dir:
        env["CLAUDE_CONFIG_DIR"] = config.config_dir

    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await asyncio.wait_for(
        process.communicate(), timeout=config.timeout
    )
    if process.returncode != 0:
        stderr_msg = stderr.decode() if stderr else "(no stderr output)"
        stdout_msg = stdout.decode() if stdout else "(no stdout output)"
        logger.error(f"Claude Code stdout: {stdout_msg}")
        logger.error(f"Claude Code stderr: {stderr_msg}")
        raise RuntimeError(
            f"Claude Code exited with code {process.returncode}: "
            f"stderr={stderr_msg}, stdout={stdout_msg}"
        )

    return stdout.decode()

```

### Core Architecture Module: `antomnievo/proposer/utils/pi_coding_agent_utils.py`
```
"""Utilities for working with Pi Coding Agent: invocation and configuration.

Provides:
- PiCodingAgentConfig: configuration for invoking the Pi Coding Agent CLI
- invoke_pi_coding_agent: async subprocess invocation of the Pi Coding Agent CLI
- classify_pi_error / RETRYABLE / log_retry_sleep: transient-failure retry
  policy (429/rate-limit/5xx retried; 401/403 and unknown surfaced immediately)
"""

import asyncio
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from tenacity import retry_if_exception

logger = logging.getLogger(__name__)

_DEFAULT_CONFIG_DIR = str(Path(__file__).resolve().parent.parent / "config" / "pi")
_DEFAULT_EXTENSION_DIR = str(Path(__file__).resolve().parent.parent / "config" / "pi" / "extensions")

# Allowed values for the Pi CLI --thinking flag. None means "do not pass --thinking"
# (the model uses its provider/CLI default).
PiThinkingLevel = Literal["off", "minimal", "low", "medium", "high", "xhigh"]
_VALID_THINKING_LEVELS: frozenset[str] = frozenset(
    ("off", "minimal", "low", "medium", "high", "xhigh")
)

# Provider identifiers passed to the Pi CLI ``--provider`` flag. They map to
# the keys of ``config/pi/models.json``'s ``providers`` object, which selects
# the gateway endpoint/adapter (anthropic-messages vs openai) used to reach the
# litellm backend.
PROVIDER_ANTHROPIC = "anthropic"
PROVIDER_OPENAI = "openai"
# ``Literal`` requires literal strings; the constants above are for code that
# references the values at runtime (defaults, comparisons), not the type form.
Provider = Literal["anthropic", "openai"]


@dataclass
class PiCodingAgentConfig:
    """Configuration for invoking the Pi Coding Agent CLI."""

    pi_path: str = "pi"
    model: str = "kimi-k2.5"
    provider: Provider = PROVIDER_ANTHROPIC
    max_turns: int = 150
    timeout: int = 3600
    api_key: str | None = None
    base_url: str | None = None
    thinking: PiThinkingLevel | None = None

    def __post_init__(self) -> None:
        if self.thinking is not None and self.thinking not in _VALID_THINKING_LEVELS:
            raise ValueError(
                f"Invalid thinking level: {self.thinking!r}. "
                f"Must be one of {sorted(_VALID_THINKING_LEVELS)} or None."
            )


# --- Transient-failure retry support for Pi Coding Agent invocations ---
#
# Pi Coding Agent and its gateway (antchat/litellm) fail transiently: 429
# rate-limit, 5xx, "overloaded", "too many requests". These clear on their own
# after a short wait, so invoking Pi again is worth it. Auth/permission
# failures (401/403) are NOT transient — retrying wastes time and never
# succeeds — so they must surface immediately. Unknown errors are also not
# retried, to avoid masking real bugs (agent/import failures) with retries.
#
# Pi itself does no internal 429 retry (verified in @mariozechner/pi-coding-agent),
# so without this layer a single rate-limit hit aborts the whole propose phase.

MAX_RETRY_ATTEMPTS: int = 5

# Substrings (matched case-insensitively) that mark a transient, retryable
# gateway error. Matched against the Pi subprocess stderr (which surfaces in
# the RuntimeError message from invoke_pi_coding_agent) and against
# Trajectory.errors entries parsed from a clean Pi exit.
_RETRYABLE_MARKERS: tuple[str, ...] = (
    "429", "rate limit", "rate_limit", "ratelimit", "too many requests",
    "retry-after", "retry_after", "overloaded", "service unavailable",
    "temporarily unavailable", "try again", "502", "503", "504",
    "bad gateway", "gateway timeout",
)
# Substrings that mark a non-transient auth/permission failure. Checked first:
# if any is present the error is 'fatal' regardless of concurrent retryable
# markers (e.g. a "401" output bundled with "rate limit" text still stays
# fatal — retrying won't fix the auth problem).
_FATAL_MARKERS: tuple[str, ...] = (
    "401", "403", "unauthorized", "forbidden", "invalid api key",
    "invalid_api_key", "not authorized", "authentication",
)


class PiEmptyResponseError(RuntimeError):
    """Pi's model returned repeated empty responses (transient gateway overload).

    Distinct from message-based classification: an empty assistant message
    carries no error text, so nothing matches ``_RETRYABLE_MARKERS`` and the
    failure would slip past ``classify_pi_error`` as 'unknown' — never retried,
    never surfaced in ``trajectory.errors`` (Pi exits 0). Detected by shape via
    ``find_degenerate_ending`` and raised as this type so it joins the same
    retry path as 429s.
    """


def classify_pi_error(text: str) -> str:
    """Classify a Pi/gateway error string as ``'retryable'``, ``'fatal'``, or ``'unknown'``.

    ``'retryable'`` — transient (429 / rate-limit / 5xx / overloaded): wait + retry.
    ``'fatal'``     — auth/permission (401/403): surface immediately, do not retry.
    ``'unknown'``   — neither: surface immediately (don't mask real bugs with retries).
    """
    if not text:
        return "unknown"
    low = text.lower()
    if any(m in low for m in _FATAL_MARKERS):
        return "fatal"
    if any(m in low for m in _RETRYABLE_MARKERS):
        return "retryable"
    return "unknown"


def is_retryable_pi_exception(exc: BaseException) -> bool:
    """True for transient RuntimeErrors (429 / rate-limit / 5xx) and for
    ``PiEmptyResponseError`` (repeated empty model responses — transient
    gateway overload by shape, no error text to classify). Auth (401/403)
    and unknown errors return False — not retried (retrying auth is pointless,
    retrying unknowns masks bugs)."""
    if isinstance(exc, PiEmptyResponseError):
        return True
    return isinstance(exc, RuntimeError) and classify_pi_error(str(exc)) == "retryable"


# Retry only on transient exceptions. Callers that surface a transient result
# (e.g. a clean Pi exit whose parsed trajectory carries a rate-limit error) should
# raise a RuntimeError so it joins this single retry path — see
# ``PiCodingAgentProposer._invoke_pi_once``. Matches the repo's kira_agent
# retry-on-exception idiom.
RETRYABLE = retry_if_exception(is_retryable_pi_exception)


def log_retry_sleep(retry_state) -> None:
    """tenacity ``before_sleep`` hook: log one line before each backoff sleep."""
    wait = retry_state.next_action.sleep if retry_state.next_action else 0.0
    outcome = retry_state.outcome
    exc = outcome.exception() if outcome is not None else None
    cause = str(exc)[:200] if exc is not None else "transient error"
    logger.warning(
        f"Pi transient error (attempt {retry_state.attempt_number}/"
        f"{MAX_RETRY_ATTEMPTS}), retrying in {wait:.1f}s: {cause}"
    )


async def invoke_pi_coding_agent(
    prompt: str,
    cwd: str,
    config: PiCodingAgentConfig,
) -> str:
    """Invoke Pi Coding Agent CLI as a subprocess and return raw JSON output.

    Args:
        prompt: The prompt to send to Pi via -p flag.
        cwd: Working directory for the subprocess.
        config: Pi Coding Agent configuration (path, model, env vars, etc.).

    Returns:
        Raw stdout from Pi (NDJSON in --mode json format).

    Raises:
        RuntimeError: If Pi exits with a non-zero return code.
    """
    cmd = [
        config.pi_path,
        "--print",
        "--mode", "json",
        "--provider", config.provider,
        "--model", config.model,
        "--no-extensions",
        "--no-skills",
        "--no-context-files",
        "--no-session",
        # Explicitly load extensions:
        # - Block proposer from accessing val set trajectories
        "-e", str(Path(_DEFAULT_EXTENSION_DIR) / "block-val-system-run.ts"),
        # - Enforce using append-changelog CLI instead of direct writes to changelog.jsonl
        "-e", str(Path(_DEFAULT_EXTENSION_DIR) / "enforce-changelog-cli.ts"),
        "-p", prompt,
    ]
    if config.thinking:
        cmd.extend(["--thinking", config.thinking])

    env = os.environ.copy()
    venv_bin = os.path.dirname(sys.executable)
    if venv_bin not in env.get("PATH", "").split(os.pathsep):
        env["PATH"] = venv_bin + os.pathsep + env.get("PATH", "")
    env.pop("CLAUDECODE", None)
    env.pop("PI_CODING_AGENT_NESTED", None)
    env["PI_OFFLINE"] = "1"
    env["PI_CODING_AGENT_DIR"] = _DEFAULT_CONFIG_DIR
    if config.api_key:
        cmd.extend(["--api-key", config.api_key])
    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await asyncio.wait_for(
        process.communicate(), timeout=config.timeout
    )
    if process.returncode != 0:
        stderr_msg = stderr.decode() if stderr else "(no stderr output)"
        stdout_msg = stdout.decode() if stdout else "(no stdout output)"
        logger.error(f"Pi Coding Agent stdout: {stdout_msg}")
        logger.error(f"Pi Coding Agent stderr: {stderr_msg}")
        raise RuntimeError(
            f"Pi Coding Agent exited with code {process.returncode}: "
            f"stderr={stderr_msg}, stdout={stdout_msg}"
        )

    return stdout.decode()

```

### Core Architecture Module: `antomnievo/proposer/utils/reflection_utils.py`
```
"""Helpers for reflection-mode proposing.

Functions that require ``CandidateStore`` access (changelog reads, analysis
reads) remain here as module-level functions. Pure-data transformations on
``MaraChain`` / ``ChainNode`` live as methods on those classes instead.

Chain semantics recap (see also ``ChainNode``)::

    chain[0]       = root (the original parent that was selected for mutation)
    chain[1]       = first failed child
    chain[2..-1]   = subsequent failed reflection attempts
    new_candidate  = about to be produced; passed separately

Key cross-candidate relationships:

* **Changelog** accumulates: ``chain[i].changelog == chain[i-1].changelog + [the
  entry chain[i] added when its tunable artifacts were mutated]``. So the node at index ``i``
  in the chain authored ``chain[i].changelog[len(chain[i-1].changelog):]``.
  The root's changelog entries pre-existed the mara chain.
* **Analysis files**: ``candidate X``'s ``analysis/result/{data_id}.json`` is
  written by ``X``'s NEXT reflection child during *its* analysis phase. So
  analyses exist for chain[0..-2] but NOT for chain[-1] — chain[-1]'s analysis
  is exactly what the current reflection iteration is about to write.
"""

import json

from antomnievo.interface.candidate_store import CandidateStore
from antomnievo.model.antomnievo_data import ChainNode


def build_attributed_changelog(
    chain: list[ChainNode],
    store: CandidateStore,
    max_diff_chars: int,
) -> str:
    """Render the chain's changelog entries (without author attribution).

    Only reads ``chain[-1]``'s changelog — it already contains every entry
    accumulated up and down the chain. We then take its LAST
    ``len(chain) - 1`` entries, which correspond to the mara chain
    candidates. Entries before that suffix pre-existed the mara chain
    and are NOT shown — they are not relevant to reasoning about the chain.

    Each entry is rendered as::

        {<json with truncated diff>}

    Returns "(no chain changelog entries)" when the chain has zero authored
    entries (e.g. chain of length 1 with only root).
    """
    if len(chain) < 2:
        return "(no chain changelog entries)"

    last_changelog = store.read_changelog(chain[-1].candidate_id) or []
    expected = len(chain) - 1

    chain_entries = last_changelog[-expected:] if len(last_changelog) >= expected else last_changelog

    lines: list[str] = []
    for entry in chain_entries:
        lines.append(
            entry.truncate_diff(max_diff_chars).model_dump_json()
        )

    if not lines:
        return "(no chain changelog entries)"
    return "\n".join(lines)


def preload_chain_analyses_for_data_id(
    chain: list[ChainNode],
    data_id: str,
    store: CandidateStore,
) -> str:
    """Concatenate every chain candidate's analysis for ``data_id``, with attribution.

    For each node in the chain whose ``analysis/result/{data_id}.json`` exists,
    emit a labelled block::

        ## analysis at {candidate_id} for data_id={data_id}
        <raw json>

    Nodes without an analysis file for this data_id are skipped silently
    (the last chain node's analysis is exactly what this reflection
    iteration is about to write).

    Returns "(no prior analyses for this data_id)" when nothing is found.
    """
    block_dict: dict[str, str] = {}
    for node in chain:
        content = store.read_analysis_content(node.candidate_id, data_id)
        if content is None:
            continue
        block_dict[node.candidate_id] = content

    if not block_dict:
        return "(no prior analyses for this data_id)"

    return json.dumps(block_dict, indent=2)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9** (2026-09-30): **docs: add BibTeX citation and fix Papers anchor in README**
  *Symptoms*: 

- **Issue #8** (2026-09-30): **Add paper link**
  *Symptoms*: ## Summary    Add the published paper link to the READMEs, replacing the "Coming soon" placeholder, and make the header paper badge extensible.    ## Changes      - **README.md / README.zh-CN.md — Papers section**     - Replaced `## 📄 Paper` + the "Coming soon" placeholder with `## 📄 Papers` + a list, populated with the released paper:       - [Mara Chain: Rethinking Failure as a Stepping Stone for AI System Auto-Evolution](https://arxiv.org/abs/2609.35855) (arXiv:2609.35855)     - The list form makes future additions a one-line change.   - **Header badge**     - Changed the hard-coded `Paper-coming_soon` badge to an anchor badge, `[![Papers](...)]( #papers)`, linking to the Papers section below.     - Future papers no longer require touching the header line — only the list needs updating; the count in the badge (`Papers-N`) is bumped only when the number of papers   changes.   - **.gitignore**     - Ignore the `logs/` directory (local run logs, not meant for version control).

- **Issue #7** (2026-09-22): **chore: bump version to 0.1.1**
  *Symptoms*: Both packages (ant-omnievo core + ant-omnievo-visualizer) move to 0.1.1: pyproject version fields, the visualizer package __version__, and the ACI release-pipeline README's version note. Verified both build into 0.1.1 sdist + wheel.

- **Issue #6** (2026-09-22): **Chore/license and branding**
  *Symptoms*: 

- **Issue #5** (2026-09-21): **fix: retry degenerate empty-response sessions; verify analysis result…**
  *Symptoms*: …s landed  Root cause of silent "No spec files were modified" failures: under gateway rate limiting the model returns empty assistant messages; the agent CLI retries internally then exits 0, so nothing reaches trajectory.errors. Phase 1 counted all such sessions as succeeded ("10 succeeded") while the analysis result dir stayed empty, and Phase 2 then proposed on "(no analysis results available)" and edited nothing.  - proposer: detect degenerate endings (>=2 trailing empty model spans, or zero tool calls + zero text) via find_degenerate_ending and raise PiEmptyResponseError so they join the tenacity retry path (same backoff as 429s; logged via the existing retry hook) - Phase 1: after a clean-exit session, verify the analysis result file was actually (re)written since the run started (file_written_since); raise otherwise so the data_id counts as failed, not succeeded - Phase 2: fail fast when no usable analysis results exist for the parent instead of burning an agent run on an empty evidence base - extract the "(no analysis results available)" sentinel as NO_ANALYSIS_RESULTS on the CandidateStore interface

- **Issue #4** (2026-09-21): **add visualizer UI tour**
  *Symptoms*: 

- **Issue #3** (2026-09-20): **docs: Refresh the English and Chinese README pages with a clearer, more polished project presentation inspired by modern open-source AI projects.**
  *Symptoms*: Changes    - Add a concise project tagline:   - Add License and Paper status badges.   - Reorganize the README into clearer sections:     - What it is     - How it works     - Documentation     - Paper     - Star History   - Add an overview of supported optimization targets:     - AI agent systems     - Workflows and pipelines     - Single-file algorithms   - Improve the explanation of AntOmniEvo’s division of labor:     - Users define the system, evaluator, data, and tunable artifact schema.     - The framework controls scheduling, budgets, selection, elimination, and persistence.     - Coding agents modify tunable artifacts based on evaluation feedback.   - Add a Paper section with a Coming soon placeholder.   - Add a Star History chart for ant-research/AntOmniEvo.   - Keep the English and Chinese README structures aligned.

- **Issue #2** (2026-09-20): **fix: browser buttom bug; default workspace hard code**
  *Symptoms*: 

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

### Incident Patch 1: `c7279bf0` (2026-09-30)
**Commit Message**: docs: add BibTeX citation and fix Papers anchor in README

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +17/-1)
```diff
@@ -55,9 +55,25 @@ It works for any system that can be expressed as a directory of tunable files an
 | Checkpoint resume & crash recovery | [docs/checkpoint-resume.md](./docs/checkpoint-resume.md) | [docs/checkpoint-resume.zh-CN.md](./docs/checkpoint-resume.zh-CN.md) |
 | Visualizer | [docs/visualizer.md](./docs/visualizer.md) | [docs/visualizer.zh-CN.md](./docs/visualizer.zh-CN.md) |
 
+<a id="papers"></a>
+
 ## 📄 Papers
 
-- **[Mara Chain: Rethinking Failure as a Stepping Stone for AI System Auto-Evolution](https://arxiv.org/abs/2609.35855)** — arXiv:2609.35855
+If you find this work useful, please cite the relevant paper:
+
+- **[Mara Chain: Rethinking Failure as a Stepping Stone for AI System Auto-Evolution](https://arxiv.org/abs/2609.35855)**
+
+  ```bibtex
+  @misc{lyu2026marachain,
+        title={Mara Chain: Rethinking Failure as a Stepping Stone for AI System Auto-Evolution},
+        author={Yubin Lyu and Fu Li and Jiawei Fei and Yang Zhao and Weixing Mei and Yinan Wu},
+        year={2026},
+        eprint={2609.35855},
+        archivePrefix={arXiv},
+        primaryClass={cs.LG},
+        url={https://arxiv.org/abs/2609.35855},
+  }
+  ```
 
 ## ⭐ Star History
 
```

**File**: `README.zh-CN.md` (modified, +17/-1)
```diff
@@ -60,9 +60,25 @@ AntOmniEvo 是一个面向 AI agent 系统的 auto-evolution(自动进化)框架
 | 断点续跑与崩溃恢复 | [docs/checkpoint-resume.zh-CN.md](./docs/checkpoint-resume.zh-CN.md) | [docs/checkpoint-resume.md](./docs/checkpoint-resume.md) |
 | 可视化器 | [docs/visualizer.zh-CN.md](./docs/visualizer.zh-CN.md) | [docs/visualizer.md](./docs/visualizer.md) |
 
+<a id="papers"></a>
+
 ## 📄 Papers
 
-- **[Mara Chain: Rethinking Failure as a Stepping Stone for AI System Auto-Evolution](https://arxiv.org/abs/2609.35855)** — arXiv:2609.35855
+如果这项工作对你有帮助，欢迎引用对应论文：
+
+- **[Mara Chain: Rethinking Failure as a Stepping Stone for AI System Auto-Evolution](https://arxiv.org/abs/2609.35855)**
+
+  ```bibtex
+  @misc{lyu2026marachain,
+        title={Mara Chain: Rethinking Failure as a Stepping Stone for AI System Auto-Evolution},
+        author={Yubin Lyu and Fu Li and Jiawei Fei and Yang Zhao and Weixing Mei and Yinan Wu},
+        year={2026},
+        eprint={2609.35855},
+        archivePrefix={arXiv},
+        primaryClass={cs.LG},
+        url={https://arxiv.org/abs/2609.35855},
+  }
+  ```
 
 ## ⭐ Star History
 
```

---

### Incident Patch 2: `a7906026` (2026-09-22)
**Commit Message**: fix: use table-form license in pyproject for old-setuptools CI builds

The CI build image (python3.7) resolves build-system requires to
setuptools 68, which rejects the PEP 639 forms `license = "Apache-2.0"`
and `license-files`. Switch both packages to the table form
`license = {text = "Apache-2.0"}` — accepted by setuptools 68 and still
supported (deprecated) by modern setuptools until 2027-02-18. LICENSE is
auto-included in dists via setuptools' default globbing, so the visualizer
gains its own copy (previously referenced via a `../LICENSE` parent-dir
path that does not survive packaging).

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `pyproject.toml` (modified, +5/-2)
```diff
@@ -8,8 +8,11 @@ name = "ant-omnievo"
 version = "0.1.0"
 description = "Auto-optimization framework for AI agent systems"
 requires-python = ">=3.10"
-license = "Apache-2.0"
-license-files = ["LICENSE"]
+# Table form, not PEP 639 string form: the CI build image (python3.7) caps at
+# setuptools 68, which rejects `license = "..."` and the `license-files` key.
+# Table form is deprecated but supported by modern setuptools until 2027-02-18;
+# LICENSE is still auto-included in dists via setuptools' default globbing.
+license = {text = "Apache-2.0"}
 # Core runtime dependencies only. Scenarios that need more (RAG, visualizer)
 # pull them in via the optional-dependencies extras below.
 dependencies = [
```

**File**: `visualizer/LICENSE` (added, +201/-0)
```diff
@@ -0,0 +1,201 @@
+                                 Apache License
+                           Version 2.0, January 2004
+                        http://www.apache.org/licenses/
+
+   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
+
+   1. Definitions.
+
+      "License" shall mean the terms and conditions for use, reproduction,
+      and distribution as defined by Sections 1 through 9 of this document.
+
+      "Licensor" shall mean the copyright owner or entity authorized by
+      the copyright owner that is granting the License.
+
+      "Legal Entity" shall mean the union of the acting entity and all
+      other entities that control, are controlled by, or are under common
+      control with that entity. For the purposes of this definition,
+      "control" means (i) the power, direct or indirect, to cause the
+      direction or management of such entity, whether by contract or
+      otherwise, or (ii) ownership of fifty percent (50%) or more of the
+      outstanding shares, or (iii) beneficial ownership of such entity.
+
+      "You" (or "Your") shall mean an individual or Legal Entity
+      exercising permissions granted by this License.
+
+      "Source" form shall mean the preferred form for making modifications,
+      including but not limited to software source code, documentation
+      source, and configuration files.
+
+      "Object" form shall mean any form resulting from mechanical
+      transformation or translation of a Source form, including but
+      not limited to compiled object code, generated documentation,
+      and conversions to other media types.
+
+      "Work" shall mean the work of authorship, whether in Source or
+      Object form, made available under the License, as indicated by a
+      copyright notice that is included in or attached to the work
+      (an example is provided in the Appendix below).
+
+      "Derivative Works" shall mean any work, whether in Source or Object
+      form, that is based on (or derived from) the Work and for which the
+      editorial revisions, annotations, elaborations, or other modifications
+      represent, as a whole, an original work of authorship. For the purposes
+      of this License, Derivative Works shall not include works that remain
+      separable from, or merely link (or bind by name) to the interfaces of,
+      the Work and Derivative Works thereof.
+
+      "Contribution" shall mean any work of authorship, including
+      the original version of the Work and any modifications or additions
+      to that Work or Derivative Works thereof, that is intentionally
+      submitted to Licensor for inclusion in the Work by the copyright owner
+      or by an individual or Legal Entity authorized to submit on behalf of
+      the copyright owner. For the purposes of this definition, "submitted"
+      means any form of electronic, verbal, or written communication sent
+      to the Licensor or its representatives, including but not limited to
+      communication on electronic mailing lists, source code control systems,
+      and issue tracking systems that are managed by, or on behalf of, the
+      Licensor for the purpose of discussing and improving the Work, but
+      excluding communication that is conspicuously marked or otherwise
+      designated in writing by the copyright owner as "Not a Contribution."
+
+      "Contributor" shall mean Licensor and any individual or Legal Entity
+      on behalf of whom a Contribution has been received by Licensor and
+      subsequently incorporated within the Work.
+
+   2. Grant of Copyright License. Subject to the terms and conditions of
+      this License, each Contributor hereby grants to You a perpetual,
+      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+      copyright license to reproduce, prepare Derivative Works of,
+      publicly display, publicly perform, sublicense, and distribute the
+      Work and such Derivative Works in Source or Object form.
+
+   3. Grant of Patent License. Subject to the terms and conditions of
+      this License, each Contributor hereby grants to You a perpetual,
+      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+      (except as stated in this section) patent license to make, have made,
+      use, offer to sell, sell, import, and otherwise transfer the Work,
+      where such license applies only to those patent claims licensable
+      by such Contributor that are necessarily infringed by their
+      Contribution(s) alone or by combination of their Contribution(s)
+      with the Work to which such Contribution(s) was submitted. If You
+      institute patent litigation against any entity (including a
+      cross-claim or counterclaim in a lawsuit) alleging that the Work
+      or a Contribution incorporated within the Work constitutes direct
+      or contributory patent infringement, then any patent licenses
+      granted to You under this License for that Work shall 
```

**File**: `visualizer/pyproject.toml` (modified, +3/-2)
```diff
@@ -7,8 +7,9 @@ name = "ant-omnievo-visualizer"
 version = "0.1.0"
 description = "Flask backend for the AntOmniEvo visualization frontend"
 requires-python = ">=3.10"
-license = "Apache-2.0"
-license-files = ["../LICENSE"]
+# Table form — see the note in the root pyproject.toml (CI image caps at
+# setuptools 68; PEP 639 string form needs setuptools>=77).
+license = {text = "Apache-2.0"}
 dependencies = [
     "ant-omnievo",
     "flask>=3.0",
```

---

### Incident Patch 3: `eb263447` (2026-09-21)
**Commit Message**: Merge pull request #5 from ant-research/fix-no-analysis-output

fix: retry degenerate empty-response sessions; verify analysis result…

**File**: `antomnievo/common/utils/fs_utils.py` (modified, +13/-0)
```diff
@@ -14,3 +14,16 @@ def get_latest_mtime(dir_path: str) -> float:
             except OSError:
                 continue
     return latest
+
+
+def file_written_since(path: str, since_ts: float, eps: float = 1e-3) -> bool:
+    """True if `path` exists and was modified at or after `since_ts` (epoch seconds).
+
+    Used to verify an agent actually (re)wrote its output file during its run —
+    a pre-existing stale file does not count. `eps` tolerates coarse filesystem
+    timestamp granularity.
+    """
+    try:
+        return os.path.getmtime(path) >= since_ts - eps
+    except OSError:
+        return False
```

**File**: `antomnievo/interface/candidate_store.py` (modified, +6/-0)
```diff
@@ -16,6 +16,12 @@
 from antomnievo.model.statistics import OptimizationStatistics
 from antomnievo.model.trajectory import Trajectory
 
+# Sentinel returned by ``read_all_analysis_json_content`` when no usable
+# analysis results exist (nothing on disk, or every entry has empty actions).
+# Callers can compare against this to fail fast instead of proposing on an
+# empty evidence base.
+NO_ANALYSIS_RESULTS = "(no analysis results available)"
+
 
 class CandidateStore(ABC):
     """Abstract storage contract for optimization candidate persistence.
```

**File**: `antomnievo/proposer/base_proposer.py` (modified, +32/-2)
```diff
@@ -9,8 +9,8 @@
 from collections.abc import Callable
 from datetime import datetime
 
-from antomnievo.common.utils.fs_utils import get_latest_mtime
-from antomnievo.interface.candidate_store import CandidateStore
+from antomnievo.common.utils.fs_utils import file_written_since, get_latest_mtime
+from antomnievo.interface.candidate_store import NO_ANALYSIS_RESULTS, CandidateStore
 from antomnievo.interface.evaluator import Evaluator
 from antomnievo.interface.proposer import Proposer
 from antomnievo.interface.system import System
@@ -276,9 +276,25 @@ async def _analyze_single_data_id(
         ]
         prompt = prompt_builder(data_id, run_file_paths, parent_meta.candidate_id)
 
+        start_ts = datetime.now().timestamp()
         trajectory, stats = await self.invoke_agent(prompt, parent_meta.data_dir)
         check_trajectory_issues(trajectory, phase=f"{phase_label}/{data_id}")
 
+        if not trajectory.errors:
+            # The analysis agent writes the result file itself (see analysis
+            # prompt); a clean-exit session that never (re)wrote it is a silent
+            # failure — e.g. the model died on empty gateway responses mid-run.
+            # "LLM call succeeded" is NOT proof the analysis landed on disk,
+            # so verify the artifact before letting Phase 2 build on it.
+            result_path = self.candidate_store.analysis_result_path(
+                parent_meta.candidate_id, data_id
+            )
+            if not file_written_since(result_path, start_ts):
+                raise RuntimeError(
+                    f"Phase 1 ({phase_label}): analysis result file was not written "
+                    f"for data_id={data_id}: {result_path}"
+                )
+
         return trajectory, stats
 
     def _filter_perfect_score_runs(
@@ -367,6 +383,20 @@ async def _mutate(
         """Phase 2: Read analysis and propose tunable-artifact modifications."""
         parent_meta = self.candidate_store.get_meta(parent_candidate_id)
         new_meta = self.candidate_store.get_meta(new_candidate_id)
+        # Fail fast when Phase 1 produced nothing actionable: proposing on an
+        # empty evidence base burns a full agent run and reliably ends with
+        # "no files modified".
+        analysis_content = self.candidate_store.read_all_analysis_json_content(
+            parent_candidate_id, last_n=self.last_n_analysis
+        )
+        if analysis_content == NO_ANALYSIS_RESULTS:
+            return ProposalResult(
+                success=False,
+                error_message=(
+                    f"No analysis results available for parent {parent_candidate_id}; "
+                    "skipping propose"
+                ),
+            )
         propose_prompt = self._build_propose_prompt(parent_meta, new_meta)
         return await self._run_mutation_pipeline(
             parent_candidate_id=parent_candidate_id,
```

**File**: `antomnievo/proposer/pi_coding_agent_proposer.py` (modified, +9/-0)
```diff
@@ -19,12 +19,14 @@
     PROVIDER_ANTHROPIC,
     RETRYABLE,
     PiCodingAgentConfig,
+    PiEmptyResponseError,
     PiThinkingLevel,
     Provider,
     classify_pi_error,
     invoke_pi_coding_agent,
     log_retry_sleep,
 )
+from antomnievo.proposer.utils.trajectory_utils import find_degenerate_ending
 
 
 class PiCodingAgentProposer(BaseProposer):
@@ -127,4 +129,11 @@ async def _invoke_pi_once(
                 e for e, v in zip(trajectory.errors, verdicts, strict=False) if v == "retryable"
             )
             raise RuntimeError(f"Pi trajectory transient error: {err}")
+        if not trajectory.errors:
+            # Empty-response aborts carry no error text, so they never reach
+            # trajectory.errors (Pi exits 0) — detect them by span shape and
+            # join the same retry path as explicit 429s.
+            degenerate = find_degenerate_ending(trajectory)
+            if degenerate:
+                raise PiEmptyResponseError(f"Pi trajectory degenerate: {degenerate}")
         return trajectory, stats
```

**File**: `antomnievo/proposer/utils/pi_coding_agent_utils.py` (modified, +17/-1)
```diff
@@ -95,6 +95,18 @@ def __post_init__(self) -> None:
 )
 
 
+class PiEmptyResponseError(RuntimeError):
+    """Pi's model returned repeated empty responses (transient gateway overload).
+
+    Distinct from message-based classification: an empty assistant message
+    carries no error text, so nothing matches ``_RETRYABLE_MARKERS`` and the
+    failure would slip past ``classify_pi_error`` as 'unknown' — never retried,
+    never surfaced in ``trajectory.errors`` (Pi exits 0). Detected by shape via
+    ``find_degenerate_ending`` and raised as this type so it joins the same
+    retry path as 429s.
+    """
+
+
 def classify_pi_error(text: str) -> str:
     """Classify a Pi/gateway error string as ``'retryable'``, ``'fatal'``, or ``'unknown'``.
 
@@ -113,9 +125,13 @@ def classify_pi_error(text: str) -> str:
 
 
 def is_retryable_pi_exception(exc: BaseException) -> bool:
-    """True for transient RuntimeErrors (429 / rate-limit / 5xx). Auth (401/403)
+    """True for transient RuntimeErrors (429 / rate-limit / 5xx) and for
+    ``PiEmptyResponseError`` (repeated empty model responses — transient
+    gateway overload by shape, no error text to classify). Auth (401/403)
     and unknown errors return False — not retried (retrying auth is pointless,
     retrying unknowns masks bugs)."""
+    if isinstance(exc, PiEmptyResponseError):
+        return True
     return isinstance(exc, RuntimeError) and classify_pi_error(str(exc)) == "retryable"
 
 
```

**File**: `antomnievo/proposer/utils/trajectory_utils.py` (modified, +48/-1)
```diff
@@ -2,7 +2,7 @@
 
 import logging
 
-from antomnievo.model.trajectory import Trajectory
+from antomnievo.model.trajectory import Span, Trajectory
 
 logger = logging.getLogger(__name__)
 
@@ -52,3 +52,50 @@ def _scan_text(text: str, source: str) -> None:
 
             if result_text:
                 _scan_text(result_text, f"tool '{child.name}'")
+
+
+def _model_span_is_empty(span: Span) -> bool:
+    """An empty model span carries no text output and no children (thinking /
+    tool calls) — the model returned a completely empty assistant message."""
+    return not span.children and not (span.output and str(span.output).strip())
+
+
+def find_degenerate_ending(trajectory: Trajectory, min_trailing_empty: int = 2) -> str | None:
+    """Return a description if the session ended degenerately, else ``None``.
+
+    A healthy agent session ends with a final assistant message carrying text
+    (the model span's ``output``) or a tool call. Under gateway overload / rate
+    limiting the model can instead return completely empty assistant messages
+    (no text, no thinking, no tool calls); the agent CLI retries internally a
+    few times and then exits with code 0, so nothing lands in
+    ``trajectory.errors`` and the caller mistakes an aborted session for
+    success. Observed pattern: 1-6 productive turns followed by 4-5 consecutive
+    empty model spans.
+
+    Degenerate shapes:
+    - no model spans at all (the CLI produced nothing parseable);
+    - >= ``min_trailing_empty`` consecutive empty model spans at the end
+      (one trailing empty span is tolerated: a final content-free message
+      right after the last tool call is harmless when the work is done);
+    - zero tool calls AND zero text output across the whole session.
+    """
+    model_spans = [s for s in trajectory.root_span_list if s.span_type == "model"]
+    if not model_spans:
+        return "no model spans in trajectory"
+
+    trailing_empty = 0
+    for span in reversed(model_spans):
+        if _model_span_is_empty(span):
+            trailing_empty += 1
+        else:
+            break
+    if trailing_empty >= min_trailing_empty:
+        return f"{trailing_empty} consecutive empty model responses at session end"
+
+    has_tool_call = any(
+        child.span_type == "tool_call" for s in model_spans for child in s.children
+    )
+    has_text = any(s.output and str(s.output).strip() for s in model_spans)
+    if not has_tool_call and not has_text:
+        return f"no tool calls and no text output across {len(model_spans)} model response(s)"
+    return None
```

**File**: `antomnievo/store/candidate_store.py` (modified, +3/-3)
```diff
@@ -5,7 +5,7 @@
 import uuid
 from datetime import datetime
 
-from antomnievo.interface.candidate_store import CandidateStore
+from antomnievo.interface.candidate_store import NO_ANALYSIS_RESULTS, CandidateStore
 from antomnievo.model.antomnievo_data import IterationRecord
 from antomnievo.model.candidate_data import (
     CandidateMeta,
@@ -415,7 +415,7 @@ def read_all_analysis_json_content(
     ) -> str:
         analysis_dict = self._read_analysis_dict_from_disk(candidate_id)
         if not analysis_dict:
-            return "(no analysis results available)"
+            return NO_ANALYSIS_RESULTS
 
         # Filter out entries with no actions (they provide no actionable info to the proposer),
         # then sort by updated_at desc (newer first).
@@ -440,7 +440,7 @@ def read_all_analysis_json_content(
             current_size += len(serialized)
 
         if not included:
-            return "(no analysis results available)"
+            return NO_ANALYSIS_RESULTS
 
         return json.dumps(included, indent=2, ensure_ascii=False)
 
```

**File**: `tests/test_pi_retry.py` (modified, +103/-3)
```diff
@@ -12,10 +12,11 @@
 import pytest
 
 import antomnievo.proposer.pi_coding_agent_proposer as mod
-from antomnievo.model.trajectory import Trajectory
+from antomnievo.model.trajectory import Span, Trajectory
 from antomnievo.model.usage_stats import UsageStats
 from antomnievo.proposer.utils.pi_coding_agent_utils import (
     MAX_RETRY_ATTEMPTS,
+    PiEmptyResponseError,
     classify_pi_error,
 )
 
@@ -29,6 +30,31 @@ def _make_proposer():
     return p
 
 
+def _healthy_trajectory() -> Trajectory:
+    """A session that did work and ended with a final text message."""
+    tool = Span(name="read", span_type="tool_call", input={"path": "/x"})
+    return Trajectory(
+        root_span_list=[
+            Span(name="model", span_type="model", children=[tool]),
+            Span(name="model", span_type="model", output="done"),
+        ],
+        errors=[],
+    )
+
+
+def _degenerate_trajectory() -> Trajectory:
+    """Gateway-overload shape: one productive turn, then 4 consecutive empty
+    model responses (no text / thinking / tool calls) and a clean CLI exit."""
+    tool = Span(name="read", span_type="tool_call", input={"path": "/x"})
+    return Trajectory(
+        root_span_list=[
+            Span(name="model", span_type="model", children=[tool]),
+            *[Span(name="model", span_type="model") for _ in range(4)],
+        ],
+        errors=[],
+    )
+
+
 # ---- pure helpers ----
 
 @pytest.mark.parametrize(
@@ -69,7 +95,7 @@ async def fake_invoke(prompt, cwd, config):
         return "raw-ok"
 
     def fake_parse(raw):
-        return Trajectory(root_span_list=[], errors=[]), UsageStats()
+        return _healthy_trajectory(), UsageStats()
 
     with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
          patch.object(mod, "parse_pi_json_output", fake_parse), \
@@ -120,7 +146,7 @@ async def fake_invoke(prompt, cwd, config):
     def fake_parse(raw):
         if state["n"] < 2:
             return Trajectory(root_span_list=[], errors=["429 rate limit exceeded"]), UsageStats()
-        return Trajectory(root_span_list=[], errors=[]), UsageStats()
+        return _healthy_trajectory(), UsageStats()
 
     with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
          patch.object(mod, "parse_pi_json_output", fake_parse), \
@@ -187,3 +213,77 @@ def fake_parse(raw):
             asyncio.run(p.invoke_agent("p", "/tmp"))
 
     assert sleep_mock.await_count == MAX_RETRY_ATTEMPTS - 1
+
+
+# ---- degenerate (empty-response) trajectories ----
+
+def test_retries_degenerate_trajectory_then_succeeds():
+    """A clean-exit session whose model responses turn empty is retried — this
+    failure mode carries no error text, so it never reaches trajectory.errors
+    and previously slipped through as a silent success."""
+    p = _make_proposer()
+    state = {"n": 0}
+
+    async def fake_invoke(prompt, cwd, config):
+        state["n"] += 1
+        return "raw"
+
+    def fake_parse(raw):
+        if state["n"] < 3:
+            return _degenerate_trajectory(), UsageStats()
+        return _healthy_trajectory(), UsageStats()
+
+    with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
+         patch.object(mod, "parse_pi_json_output", fake_parse), \
+         _patch_sleep() as sleep_mock:
+        traj, stats = asyncio.run(p.invoke_agent("p", "/tmp"))
+
+    assert state["n"] == 3
+    assert sleep_mock.await_count == 2
+    assert traj.errors == []
+
+
+def test_exhausts_degenerate_trajectory_reraises():
+    p = _make_proposer()
+
+    async def fake_invoke(prompt, cwd, config):
+        return "raw"
+
+    def fake_parse(raw):
+        return _degenerate_trajectory(), UsageStats()
+
+    with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
+         patch.object(mod, "parse_pi_json_output", fake_parse), \
+         _patch_sleep() as sleep_mock:
+        with pytest.raises(PiEmptyResponseError):
+            asyncio.run(p.invoke_agent("p", "/tmp"))
+
+    assert sleep_mock.await_count == MAX_RETRY_ATTEMPTS - 1
+
+
+def test_single_trailing_empty_span_tolerated():
+    """One content-free final message right after the last tool call is a
+    healthy end (work was done) — must NOT be flagged degenerate."""
+    p = _make_proposer()
+
+    async def fake_invoke(prompt, cwd, config):
+        return "raw"
+
+    def fake_parse(raw):
+        tool = Span(name="write", span_type="tool_call", input={"path": "/x"})
+        traj = Trajectory(
+            root_span_list=[
+                Span(name="model", span_type="model", children=[tool]),
+                Span(name="model", span_type="model"),  # one empty final message
+            ],
+            errors=[],
+        )
+        return traj, UsageStats()
+
+    with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
+         patch.object(mod, "parse_pi_json_output", fake_parse), \
+         _patch_sleep() as sleep_mock:
+        traj, _ = asyncio.run(p.invoke_agent("p", "/tmp"))
+
+    asser
```

---

### Incident Patch 4: `576ac8e2` (2026-09-21)
**Commit Message**: fix: retry degenerate empty-response sessions; verify analysis results landed

Root cause of silent "No spec files were modified" failures: under gateway
rate limiting the model returns empty assistant messages; the agent CLI
retries internally then exits 0, so nothing reaches trajectory.errors.
Phase 1 counted all such sessions as succeeded ("10 succeeded") while the
analysis result dir stayed empty, and Phase 2 then proposed on
"(no analysis results available)" and edited nothing.

- proposer: detect degenerate endings (>=2 trailing empty model spans, or
  zero tool calls + zero text) via find_degenerate_ending and raise
  PiEmptyResponseError so they join the tenacity retry path (same backoff
  as 429s; logged via the existing retry hook)
- Phase 1: after a clean-exit session, verify the analysis result file was
  actually (re)written since the run started (file_written_since); raise
  otherwise so the data_id counts as failed, not succeeded
- Phase 2: fail fast when no usable analysis results exist for the parent
  instead of burning an agent run on an empty evidence base
- extract the "(no analysis results available)" sentinel as
  NO_ANALYSIS_RESULTS on the CandidateStore int

**File**: `antomnievo/common/utils/fs_utils.py` (modified, +13/-0)
```diff
@@ -14,3 +14,16 @@ def get_latest_mtime(dir_path: str) -> float:
             except OSError:
                 continue
     return latest
+
+
+def file_written_since(path: str, since_ts: float, eps: float = 1e-3) -> bool:
+    """True if `path` exists and was modified at or after `since_ts` (epoch seconds).
+
+    Used to verify an agent actually (re)wrote its output file during its run —
+    a pre-existing stale file does not count. `eps` tolerates coarse filesystem
+    timestamp granularity.
+    """
+    try:
+        return os.path.getmtime(path) >= since_ts - eps
+    except OSError:
+        return False
```

**File**: `antomnievo/interface/candidate_store.py` (modified, +6/-0)
```diff
@@ -16,6 +16,12 @@
 from antomnievo.model.statistics import OptimizationStatistics
 from antomnievo.model.trajectory import Trajectory
 
+# Sentinel returned by ``read_all_analysis_json_content`` when no usable
+# analysis results exist (nothing on disk, or every entry has empty actions).
+# Callers can compare against this to fail fast instead of proposing on an
+# empty evidence base.
+NO_ANALYSIS_RESULTS = "(no analysis results available)"
+
 
 class CandidateStore(ABC):
     """Abstract storage contract for optimization candidate persistence.
```

**File**: `antomnievo/proposer/base_proposer.py` (modified, +32/-2)
```diff
@@ -9,8 +9,8 @@
 from collections.abc import Callable
 from datetime import datetime
 
-from antomnievo.common.utils.fs_utils import get_latest_mtime
-from antomnievo.interface.candidate_store import CandidateStore
+from antomnievo.common.utils.fs_utils import file_written_since, get_latest_mtime
+from antomnievo.interface.candidate_store import NO_ANALYSIS_RESULTS, CandidateStore
 from antomnievo.interface.evaluator import Evaluator
 from antomnievo.interface.proposer import Proposer
 from antomnievo.interface.system import System
@@ -276,9 +276,25 @@ async def _analyze_single_data_id(
         ]
         prompt = prompt_builder(data_id, run_file_paths, parent_meta.candidate_id)
 
+        start_ts = datetime.now().timestamp()
         trajectory, stats = await self.invoke_agent(prompt, parent_meta.data_dir)
         check_trajectory_issues(trajectory, phase=f"{phase_label}/{data_id}")
 
+        if not trajectory.errors:
+            # The analysis agent writes the result file itself (see analysis
+            # prompt); a clean-exit session that never (re)wrote it is a silent
+            # failure — e.g. the model died on empty gateway responses mid-run.
+            # "LLM call succeeded" is NOT proof the analysis landed on disk,
+            # so verify the artifact before letting Phase 2 build on it.
+            result_path = self.candidate_store.analysis_result_path(
+                parent_meta.candidate_id, data_id
+            )
+            if not file_written_since(result_path, start_ts):
+                raise RuntimeError(
+                    f"Phase 1 ({phase_label}): analysis result file was not written "
+                    f"for data_id={data_id}: {result_path}"
+                )
+
         return trajectory, stats
 
     def _filter_perfect_score_runs(
@@ -367,6 +383,20 @@ async def _mutate(
         """Phase 2: Read analysis and propose tunable-artifact modifications."""
         parent_meta = self.candidate_store.get_meta(parent_candidate_id)
         new_meta = self.candidate_store.get_meta(new_candidate_id)
+        # Fail fast when Phase 1 produced nothing actionable: proposing on an
+        # empty evidence base burns a full agent run and reliably ends with
+        # "no files modified".
+        analysis_content = self.candidate_store.read_all_analysis_json_content(
+            parent_candidate_id, last_n=self.last_n_analysis
+        )
+        if analysis_content == NO_ANALYSIS_RESULTS:
+            return ProposalResult(
+                success=False,
+                error_message=(
+                    f"No analysis results available for parent {parent_candidate_id}; "
+                    "skipping propose"
+                ),
+            )
         propose_prompt = self._build_propose_prompt(parent_meta, new_meta)
         return await self._run_mutation_pipeline(
             parent_candidate_id=parent_candidate_id,
```

**File**: `antomnievo/proposer/pi_coding_agent_proposer.py` (modified, +9/-0)
```diff
@@ -19,12 +19,14 @@
     PROVIDER_ANTHROPIC,
     RETRYABLE,
     PiCodingAgentConfig,
+    PiEmptyResponseError,
     PiThinkingLevel,
     Provider,
     classify_pi_error,
     invoke_pi_coding_agent,
     log_retry_sleep,
 )
+from antomnievo.proposer.utils.trajectory_utils import find_degenerate_ending
 
 
 class PiCodingAgentProposer(BaseProposer):
@@ -127,4 +129,11 @@ async def _invoke_pi_once(
                 e for e, v in zip(trajectory.errors, verdicts, strict=False) if v == "retryable"
             )
             raise RuntimeError(f"Pi trajectory transient error: {err}")
+        if not trajectory.errors:
+            # Empty-response aborts carry no error text, so they never reach
+            # trajectory.errors (Pi exits 0) — detect them by span shape and
+            # join the same retry path as explicit 429s.
+            degenerate = find_degenerate_ending(trajectory)
+            if degenerate:
+                raise PiEmptyResponseError(f"Pi trajectory degenerate: {degenerate}")
         return trajectory, stats
```

**File**: `antomnievo/proposer/utils/pi_coding_agent_utils.py` (modified, +17/-1)
```diff
@@ -95,6 +95,18 @@ def __post_init__(self) -> None:
 )
 
 
+class PiEmptyResponseError(RuntimeError):
+    """Pi's model returned repeated empty responses (transient gateway overload).
+
+    Distinct from message-based classification: an empty assistant message
+    carries no error text, so nothing matches ``_RETRYABLE_MARKERS`` and the
+    failure would slip past ``classify_pi_error`` as 'unknown' — never retried,
+    never surfaced in ``trajectory.errors`` (Pi exits 0). Detected by shape via
+    ``find_degenerate_ending`` and raised as this type so it joins the same
+    retry path as 429s.
+    """
+
+
 def classify_pi_error(text: str) -> str:
     """Classify a Pi/gateway error string as ``'retryable'``, ``'fatal'``, or ``'unknown'``.
 
@@ -113,9 +125,13 @@ def classify_pi_error(text: str) -> str:
 
 
 def is_retryable_pi_exception(exc: BaseException) -> bool:
-    """True for transient RuntimeErrors (429 / rate-limit / 5xx). Auth (401/403)
+    """True for transient RuntimeErrors (429 / rate-limit / 5xx) and for
+    ``PiEmptyResponseError`` (repeated empty model responses — transient
+    gateway overload by shape, no error text to classify). Auth (401/403)
     and unknown errors return False — not retried (retrying auth is pointless,
     retrying unknowns masks bugs)."""
+    if isinstance(exc, PiEmptyResponseError):
+        return True
     return isinstance(exc, RuntimeError) and classify_pi_error(str(exc)) == "retryable"
 
 
```

**File**: `antomnievo/proposer/utils/trajectory_utils.py` (modified, +48/-1)
```diff
@@ -2,7 +2,7 @@
 
 import logging
 
-from antomnievo.model.trajectory import Trajectory
+from antomnievo.model.trajectory import Span, Trajectory
 
 logger = logging.getLogger(__name__)
 
@@ -52,3 +52,50 @@ def _scan_text(text: str, source: str) -> None:
 
             if result_text:
                 _scan_text(result_text, f"tool '{child.name}'")
+
+
+def _model_span_is_empty(span: Span) -> bool:
+    """An empty model span carries no text output and no children (thinking /
+    tool calls) — the model returned a completely empty assistant message."""
+    return not span.children and not (span.output and str(span.output).strip())
+
+
+def find_degenerate_ending(trajectory: Trajectory, min_trailing_empty: int = 2) -> str | None:
+    """Return a description if the session ended degenerately, else ``None``.
+
+    A healthy agent session ends with a final assistant message carrying text
+    (the model span's ``output``) or a tool call. Under gateway overload / rate
+    limiting the model can instead return completely empty assistant messages
+    (no text, no thinking, no tool calls); the agent CLI retries internally a
+    few times and then exits with code 0, so nothing lands in
+    ``trajectory.errors`` and the caller mistakes an aborted session for
+    success. Observed pattern: 1-6 productive turns followed by 4-5 consecutive
+    empty model spans.
+
+    Degenerate shapes:
+    - no model spans at all (the CLI produced nothing parseable);
+    - >= ``min_trailing_empty`` consecutive empty model spans at the end
+      (one trailing empty span is tolerated: a final content-free message
+      right after the last tool call is harmless when the work is done);
+    - zero tool calls AND zero text output across the whole session.
+    """
+    model_spans = [s for s in trajectory.root_span_list if s.span_type == "model"]
+    if not model_spans:
+        return "no model spans in trajectory"
+
+    trailing_empty = 0
+    for span in reversed(model_spans):
+        if _model_span_is_empty(span):
+            trailing_empty += 1
+        else:
+            break
+    if trailing_empty >= min_trailing_empty:
+        return f"{trailing_empty} consecutive empty model responses at session end"
+
+    has_tool_call = any(
+        child.span_type == "tool_call" for s in model_spans for child in s.children
+    )
+    has_text = any(s.output and str(s.output).strip() for s in model_spans)
+    if not has_tool_call and not has_text:
+        return f"no tool calls and no text output across {len(model_spans)} model response(s)"
+    return None
```

**File**: `antomnievo/store/candidate_store.py` (modified, +3/-3)
```diff
@@ -5,7 +5,7 @@
 import uuid
 from datetime import datetime
 
-from antomnievo.interface.candidate_store import CandidateStore
+from antomnievo.interface.candidate_store import NO_ANALYSIS_RESULTS, CandidateStore
 from antomnievo.model.antomnievo_data import IterationRecord
 from antomnievo.model.candidate_data import (
     CandidateMeta,
@@ -415,7 +415,7 @@ def read_all_analysis_json_content(
     ) -> str:
         analysis_dict = self._read_analysis_dict_from_disk(candidate_id)
         if not analysis_dict:
-            return "(no analysis results available)"
+            return NO_ANALYSIS_RESULTS
 
         # Filter out entries with no actions (they provide no actionable info to the proposer),
         # then sort by updated_at desc (newer first).
@@ -440,7 +440,7 @@ def read_all_analysis_json_content(
             current_size += len(serialized)
 
         if not included:
-            return "(no analysis results available)"
+            return NO_ANALYSIS_RESULTS
 
         return json.dumps(included, indent=2, ensure_ascii=False)
 
```

**File**: `tests/test_pi_retry.py` (modified, +103/-3)
```diff
@@ -12,10 +12,11 @@
 import pytest
 
 import antomnievo.proposer.pi_coding_agent_proposer as mod
-from antomnievo.model.trajectory import Trajectory
+from antomnievo.model.trajectory import Span, Trajectory
 from antomnievo.model.usage_stats import UsageStats
 from antomnievo.proposer.utils.pi_coding_agent_utils import (
     MAX_RETRY_ATTEMPTS,
+    PiEmptyResponseError,
     classify_pi_error,
 )
 
@@ -29,6 +30,31 @@ def _make_proposer():
     return p
 
 
+def _healthy_trajectory() -> Trajectory:
+    """A session that did work and ended with a final text message."""
+    tool = Span(name="read", span_type="tool_call", input={"path": "/x"})
+    return Trajectory(
+        root_span_list=[
+            Span(name="model", span_type="model", children=[tool]),
+            Span(name="model", span_type="model", output="done"),
+        ],
+        errors=[],
+    )
+
+
+def _degenerate_trajectory() -> Trajectory:
+    """Gateway-overload shape: one productive turn, then 4 consecutive empty
+    model responses (no text / thinking / tool calls) and a clean CLI exit."""
+    tool = Span(name="read", span_type="tool_call", input={"path": "/x"})
+    return Trajectory(
+        root_span_list=[
+            Span(name="model", span_type="model", children=[tool]),
+            *[Span(name="model", span_type="model") for _ in range(4)],
+        ],
+        errors=[],
+    )
+
+
 # ---- pure helpers ----
 
 @pytest.mark.parametrize(
@@ -69,7 +95,7 @@ async def fake_invoke(prompt, cwd, config):
         return "raw-ok"
 
     def fake_parse(raw):
-        return Trajectory(root_span_list=[], errors=[]), UsageStats()
+        return _healthy_trajectory(), UsageStats()
 
     with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
          patch.object(mod, "parse_pi_json_output", fake_parse), \
@@ -120,7 +146,7 @@ async def fake_invoke(prompt, cwd, config):
     def fake_parse(raw):
         if state["n"] < 2:
             return Trajectory(root_span_list=[], errors=["429 rate limit exceeded"]), UsageStats()
-        return Trajectory(root_span_list=[], errors=[]), UsageStats()
+        return _healthy_trajectory(), UsageStats()
 
     with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
          patch.object(mod, "parse_pi_json_output", fake_parse), \
@@ -187,3 +213,77 @@ def fake_parse(raw):
             asyncio.run(p.invoke_agent("p", "/tmp"))
 
     assert sleep_mock.await_count == MAX_RETRY_ATTEMPTS - 1
+
+
+# ---- degenerate (empty-response) trajectories ----
+
+def test_retries_degenerate_trajectory_then_succeeds():
+    """A clean-exit session whose model responses turn empty is retried — this
+    failure mode carries no error text, so it never reaches trajectory.errors
+    and previously slipped through as a silent success."""
+    p = _make_proposer()
+    state = {"n": 0}
+
+    async def fake_invoke(prompt, cwd, config):
+        state["n"] += 1
+        return "raw"
+
+    def fake_parse(raw):
+        if state["n"] < 3:
+            return _degenerate_trajectory(), UsageStats()
+        return _healthy_trajectory(), UsageStats()
+
+    with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
+         patch.object(mod, "parse_pi_json_output", fake_parse), \
+         _patch_sleep() as sleep_mock:
+        traj, stats = asyncio.run(p.invoke_agent("p", "/tmp"))
+
+    assert state["n"] == 3
+    assert sleep_mock.await_count == 2
+    assert traj.errors == []
+
+
+def test_exhausts_degenerate_trajectory_reraises():
+    p = _make_proposer()
+
+    async def fake_invoke(prompt, cwd, config):
+        return "raw"
+
+    def fake_parse(raw):
+        return _degenerate_trajectory(), UsageStats()
+
+    with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
+         patch.object(mod, "parse_pi_json_output", fake_parse), \
+         _patch_sleep() as sleep_mock:
+        with pytest.raises(PiEmptyResponseError):
+            asyncio.run(p.invoke_agent("p", "/tmp"))
+
+    assert sleep_mock.await_count == MAX_RETRY_ATTEMPTS - 1
+
+
+def test_single_trailing_empty_span_tolerated():
+    """One content-free final message right after the last tool call is a
+    healthy end (work was done) — must NOT be flagged degenerate."""
+    p = _make_proposer()
+
+    async def fake_invoke(prompt, cwd, config):
+        return "raw"
+
+    def fake_parse(raw):
+        tool = Span(name="write", span_type="tool_call", input={"path": "/x"})
+        traj = Trajectory(
+            root_span_list=[
+                Span(name="model", span_type="model", children=[tool]),
+                Span(name="model", span_type="model"),  # one empty final message
+            ],
+            errors=[],
+        )
+        return traj, UsageStats()
+
+    with patch.object(mod, "invoke_pi_coding_agent", fake_invoke), \
+         patch.object(mod, "parse_pi_json_output", fake_parse), \
+         _patch_sleep() as sleep_mock:
+        traj, _ = asyncio.run(p.invoke_agent("p", "/tmp"))
+
+    asser
```

---

### Incident Patch 5: `bfe886c0` (2026-09-21)
**Commit Message**: Merge pull request #4 from ant-research/add-visualizer-ui-tour

add visualizer UI tour

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # AntOmniEvo
 
-**An auto-evolution framework: optimize anything — your 7×24 algorithm engineers.**
+**An auto-evolution framework that optimizes anything — your 7×24 team of algorithm engineers.**
 
 [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE) [![arXiv](https://img.shields.io/badge/Paper-coming_soon-lightgrey.svg)](#paper)
 
```

**File**: `docs/visualizer.md` (modified, +26/-0)
```diff
@@ -32,3 +32,29 @@ antomnievo-visualizer-manage start
 - API: http://localhost:3001
 
 `Ctrl+C` to stop. Point the front-end at the `workspace/<run>` directory you want to inspect.
+
+## 3. UI tour
+
+**Evolution — Lobster Gym.** The population rendered as a gym: candidates train as lobsters, grouped into tier rooms by score (Golden Hall at the top, Damp Basement at the bottom). Each card shows the candidate's short id, generation/epoch/index, average score, gain vs. root, tier, and live state (pending / evolving).
+
+![Evolution tab — Lobster Gym](./assets/visualizer/gym.png)
+
+**Lineage Tree.** The full parent–child tree of every candidate, with per-node score, delta vs. root, and tier badge. `shift+click` expands a whole subtree; selecting a node opens its detail panel on the right.
+
+![Lineage Tree tab](./assets/visualizer/lineage.png)
+
+**Stats.** Best-average-score curve over iterations (with accepted candidates and the baseline), plus run-level counters: iteration progress, population size, total created, rejected, best score, root/best ids, and elapsed time.
+
+![Stats tab](./assets/visualizer/stats.png)
+
+**Insights.** Per-question coverage grid: pick any set of candidates and compare their scores on every dataset question side by side, with unsolved-by-all questions highlighted.
+
+![Insights tab — coverage grid](./assets/visualizer/insights.png)
+
+**Candidate details.** Clicking a candidate opens its panel: ancestor chain with per-generation scores, overview metadata (state, parent, reflection depth, timestamps), score vs. root, and browsable system-run / proposer-run files.
+
+![Candidate detail panel](./assets/visualizer/details.png)
+
+**File viewer.** Every artifact under the candidate's workspace directory (system runs, proposer runs, scores) opens in an in-app viewer with syntax highlighting and one-click copy.
+
+![File viewer](./assets/visualizer/fileviewer.png)
```

**File**: `docs/visualizer.zh-CN.md` (modified, +26/-0)
```diff
@@ -32,3 +32,29 @@ antomnievo-visualizer-manage start
 - API:http://localhost:3001
 
 `Ctrl+C` 停止。把前端指向想看的 `workspace/<run>` 目录即可。
+
+## 3. 界面导览
+
+**Evolution — Lobster Gym。** 种群被渲染成一座健身房:候选个体以龙虾的形象训练,按分数分层归入不同的房间(顶层 Golden Hall,底层 Damp Basement)。每张卡片展示候选的短 id、代数/轮次/序号、平均分、相对 root 的提升、等级,以及实时状态(pending / evolving)。
+
+![Evolution 标签页 — Lobster Gym](./assets/visualizer/gym.png)
+
+**Lineage Tree。** 全部候选的父子关系树,每个节点标注分数、相对 root 的变化和等级徽章。`shift+click` 展开整棵子树;选中节点后在右侧打开详情面板。
+
+![Lineage Tree 标签页](./assets/visualizer/lineage.png)
+
+**Stats。** 最优平均分随迭代变化的曲线(含被接受的候选和 baseline),以及运行级计数:迭代进度、种群规模、创建总数、拒绝数、最高分、root/best id 和总耗时。
+
+![Stats 标签页](./assets/visualizer/stats.png)
+
+**Insights。** 逐题覆盖网格:任选一组候选,对比它们在每个数据集问题上的得分,所有候选都未解出的问题会高亮显示。
+
+![Insights 标签页 — 覆盖网格](./assets/visualizer/insights.png)
+
+**候选详情。** 点击候选打开详情面板:祖先链(含每一代的分数)、元信息(状态、父节点、反思深度、时间戳)、相对 root 的得分,以及可浏览的 system-run / proposer-run 文件。
+
+![候选详情面板](./assets/visualizer/details.png)
+
+**文件查看器。** 候选 workspace 目录下的所有产物(system run、proposer run、分数文件)都可以在应用内打开,带语法高亮和一键复制。
+
+![文件查看器](./assets/visualizer/fileviewer.png)
```

---

### Incident Patch 6: `bfe6acc5` (2026-09-21)
**Commit Message**: add visualizer UI tour

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # AntOmniEvo
 
-**An auto-evolution framework: optimize anything — your 7×24 algorithm engineers.**
+**An auto-evolution framework that optimizes anything — your 7×24 team of algorithm engineers.**
 
 [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE) [![arXiv](https://img.shields.io/badge/Paper-coming_soon-lightgrey.svg)](#paper)
 
```

**File**: `docs/visualizer.md` (modified, +26/-0)
```diff
@@ -32,3 +32,29 @@ antomnievo-visualizer-manage start
 - API: http://localhost:3001
 
 `Ctrl+C` to stop. Point the front-end at the `workspace/<run>` directory you want to inspect.
+
+## 3. UI tour
+
+**Evolution — Lobster Gym.** The population rendered as a gym: candidates train as lobsters, grouped into tier rooms by score (Golden Hall at the top, Damp Basement at the bottom). Each card shows the candidate's short id, generation/epoch/index, average score, gain vs. root, tier, and live state (pending / evolving).
+
+![Evolution tab — Lobster Gym](./assets/visualizer/gym.png)
+
+**Lineage Tree.** The full parent–child tree of every candidate, with per-node score, delta vs. root, and tier badge. `shift+click` expands a whole subtree; selecting a node opens its detail panel on the right.
+
+![Lineage Tree tab](./assets/visualizer/lineage.png)
+
+**Stats.** Best-average-score curve over iterations (with accepted candidates and the baseline), plus run-level counters: iteration progress, population size, total created, rejected, best score, root/best ids, and elapsed time.
+
+![Stats tab](./assets/visualizer/stats.png)
+
+**Insights.** Per-question coverage grid: pick any set of candidates and compare their scores on every dataset question side by side, with unsolved-by-all questions highlighted.
+
+![Insights tab — coverage grid](./assets/visualizer/insights.png)
+
+**Candidate details.** Clicking a candidate opens its panel: ancestor chain with per-generation scores, overview metadata (state, parent, reflection depth, timestamps), score vs. root, and browsable system-run / proposer-run files.
+
+![Candidate detail panel](./assets/visualizer/details.png)
+
+**File viewer.** Every artifact under the candidate's workspace directory (system runs, proposer runs, scores) opens in an in-app viewer with syntax highlighting and one-click copy.
+
+![File viewer](./assets/visualizer/fileviewer.png)
```

**File**: `docs/visualizer.zh-CN.md` (modified, +26/-0)
```diff
@@ -32,3 +32,29 @@ antomnievo-visualizer-manage start
 - API:http://localhost:3001
 
 `Ctrl+C` 停止。把前端指向想看的 `workspace/<run>` 目录即可。
+
+## 3. 界面导览
+
+**Evolution — Lobster Gym。** 种群被渲染成一座健身房:候选个体以龙虾的形象训练,按分数分层归入不同的房间(顶层 Golden Hall,底层 Damp Basement)。每张卡片展示候选的短 id、代数/轮次/序号、平均分、相对 root 的提升、等级,以及实时状态(pending / evolving)。
+
+![Evolution 标签页 — Lobster Gym](./assets/visualizer/gym.png)
+
+**Lineage Tree。** 全部候选的父子关系树,每个节点标注分数、相对 root 的变化和等级徽章。`shift+click` 展开整棵子树;选中节点后在右侧打开详情面板。
+
+![Lineage Tree 标签页](./assets/visualizer/lineage.png)
+
+**Stats。** 最优平均分随迭代变化的曲线(含被接受的候选和 baseline),以及运行级计数:迭代进度、种群规模、创建总数、拒绝数、最高分、root/best id 和总耗时。
+
+![Stats 标签页](./assets/visualizer/stats.png)
+
+**Insights。** 逐题覆盖网格:任选一组候选,对比它们在每个数据集问题上的得分,所有候选都未解出的问题会高亮显示。
+
+![Insights 标签页 — 覆盖网格](./assets/visualizer/insights.png)
+
+**候选详情。** 点击候选打开详情面板:祖先链(含每一代的分数)、元信息(状态、父节点、反思深度、时间戳)、相对 root 的得分,以及可浏览的 system-run / proposer-run 文件。
+
+![候选详情面板](./assets/visualizer/details.png)
+
+**文件查看器。** 候选 workspace 目录下的所有产物(system run、proposer run、分数文件)都可以在应用内打开,带语法高亮和一键复制。
+
+![文件查看器](./assets/visualizer/fileviewer.png)
```

---

### Incident Patch 7: `ad7b213d` (2026-09-20)
**Commit Message**: Merge pull request #2 from ant-research/fix-button-click-bug-and-hardcode

fix: browser buttom bug; default workspace hard code

**File**: `visualizer/src/App.tsx` (modified, +71/-51)
```diff
@@ -2,9 +2,6 @@ import { useState, useEffect, useCallback } from 'react';
 import Dashboard from './pages/Dashboard';
 import { browseDirectory, type BrowseResult } from './utils/api';
 
-// Default workspace path
-const DEFAULT_WORKSPACE = '/Users/jacklv/work/omnievo/antomnievo/example/text2sql/workspace';
-
 function DirectoryBrowser({
   onSelect,
   onCancel,
@@ -32,54 +29,75 @@ function DirectoryBrowser({
   }, []);
 
   useEffect(() => {
-    // Start from the parent of the current workspace
-    const startPath = initialPath ? initialPath.replace(/\/[^/]*$/, '') : undefined;
-    load(startPath || undefined);
-  }, [initialPath, load]);
-
-  if (!browse && loading) return <div className="dir-browser-loading">Loading…</div>;
-  if (error) return <div className="dir-browser-error">{error}</div>;
-  if (!browse) return null;
+    // Start from the parent of the current workspace; if that path is gone
+    // (stale/foreign path), fall back to the home directory instead of
+    // leaving the dialog empty.
+    (async () => {
+      setLoading(true);
+      setError(null);
+      const startPath = initialPath ? initialPath.replace(/\/[^/]*$/, '') : undefined;
+      try {
+        setBrowse(await browseDirectory(startPath || undefined));
+      } catch {
+        try {
+          setBrowse(await browseDirectory(undefined));
+        } catch (e: any) {
+          setError(e.message);
+        }
+      } finally {
+        setLoading(false);
+      }
+    })();
+  }, [initialPath]);
 
+  // Always render inside the overlay — loading and error states included —
+  // so clicking Browse never appears to do nothing.
   return (
     <div className="dir-browser-overlay" onClick={onCancel}>
       <div className="dir-browser" onClick={(e) => e.stopPropagation()}>
         <div className="dir-browser-header">
           <span className="dir-browser-title">Select Workspace Directory</span>
           <button className="dir-browser-close" onClick={onCancel}>✕</button>
         </div>
-        <div className="dir-browser-current mono">
-          {browse.path}
-          <button
-            className="dir-browser-select-btn"
-            onClick={() => onSelect(browse.path)}
-          >
-            Select This
-          </button>
-        </div>
-        <div className="dir-browser-list">
-          {browse.parent && (
-            <div
-              className="dir-browser-item dir-browser-parent"
-              onClick={() => load(browse.parent!)}
-            >
-              📁 ..
+        {error && <div className="dir-browser-error">{error}</div>}
+        {!browse ? (
+          <div className="dir-browser-loading">Loading…</div>
+        ) : (
+          <>
+            <div className="dir-browser-current mono">
+              {browse.path}
+              <button
+                className="dir-browser-select-btn"
+                onClick={() => onSelect(browse.path)}
+              >
+                Select This
+              </button>
             </div>
-          )}
-          {loading && <div className="dir-browser-loading">Loading…</div>}
-          {!loading && browse.dirs.map((name) => (
-            <div
-              key={name}
-              className="dir-browser-item"
-              onClick={() => load(`${browse.path}/${name}`)}
-            >
-              📁 {name}
+            <div className="dir-browser-list">
+              {browse.parent && (
+                <div
+                  className="dir-browser-item dir-browser-parent"
+                  onClick={() => load(browse.parent!)}
+                >
+                  📁 ..
+                </div>
+              )}
+              {loading && <div className="dir-browser-loading">Loading…</div>}
+              {!loading && browse.dirs.map((name) => (
+                <div
+                  key={name}
+                  className="dir-browser-item"
+                  onClick={() => load(`${browse.path}/${name}`)}
+                >
+                  📁 {name}
+                </div>
+              ))}
+              {!loading && browse.dirs.length === 0 && (
+                <div className="dir-browser-empty">No subdirectories</div>
+              )}
             </div>
-          ))}
-          {!loading && browse.dirs.length === 0 && (
-            <div className="dir-browser-empty">No subdirectories</div>
-          )}
-        </div>
+          </>
+        )}
       </div>
     </div>
   );
@@ -91,17 +109,16 @@ function App() {
   const [isEditing, setIsEditing] = useState(false);
   const [showBrowser, setShowBrowser] = useState(false);
 
-  // Read workspace from URL params
+  // Read workspace from URL params. No default path: a hardcoded one would be
+  // wrong for anyone else (and stale for us) — ask the user instead.
   useEffect(() => {
     const params = new URLSearchParams(window.location.search);
     const ws = params.get('workspace');
     if (ws) {
       setWorkspacePath(ws);
       setInputValue(ws);
     } 
```

---

### Incident Patch 8: `fb8733b4` (2026-09-20)
**Commit Message**: fix: browser buttom bug; default workspace hard code

**File**: `visualizer/src/App.tsx` (modified, +71/-51)
```diff
@@ -2,9 +2,6 @@ import { useState, useEffect, useCallback } from 'react';
 import Dashboard from './pages/Dashboard';
 import { browseDirectory, type BrowseResult } from './utils/api';
 
-// Default workspace path
-const DEFAULT_WORKSPACE = '/Users/jacklv/work/omnievo/antomnievo/example/text2sql/workspace';
-
 function DirectoryBrowser({
   onSelect,
   onCancel,
@@ -32,54 +29,75 @@ function DirectoryBrowser({
   }, []);
 
   useEffect(() => {
-    // Start from the parent of the current workspace
-    const startPath = initialPath ? initialPath.replace(/\/[^/]*$/, '') : undefined;
-    load(startPath || undefined);
-  }, [initialPath, load]);
-
-  if (!browse && loading) return <div className="dir-browser-loading">Loading…</div>;
-  if (error) return <div className="dir-browser-error">{error}</div>;
-  if (!browse) return null;
+    // Start from the parent of the current workspace; if that path is gone
+    // (stale/foreign path), fall back to the home directory instead of
+    // leaving the dialog empty.
+    (async () => {
+      setLoading(true);
+      setError(null);
+      const startPath = initialPath ? initialPath.replace(/\/[^/]*$/, '') : undefined;
+      try {
+        setBrowse(await browseDirectory(startPath || undefined));
+      } catch {
+        try {
+          setBrowse(await browseDirectory(undefined));
+        } catch (e: any) {
+          setError(e.message);
+        }
+      } finally {
+        setLoading(false);
+      }
+    })();
+  }, [initialPath]);
 
+  // Always render inside the overlay — loading and error states included —
+  // so clicking Browse never appears to do nothing.
   return (
     <div className="dir-browser-overlay" onClick={onCancel}>
       <div className="dir-browser" onClick={(e) => e.stopPropagation()}>
         <div className="dir-browser-header">
           <span className="dir-browser-title">Select Workspace Directory</span>
           <button className="dir-browser-close" onClick={onCancel}>✕</button>
         </div>
-        <div className="dir-browser-current mono">
-          {browse.path}
-          <button
-            className="dir-browser-select-btn"
-            onClick={() => onSelect(browse.path)}
-          >
-            Select This
-          </button>
-        </div>
-        <div className="dir-browser-list">
-          {browse.parent && (
-            <div
-              className="dir-browser-item dir-browser-parent"
-              onClick={() => load(browse.parent!)}
-            >
-              📁 ..
+        {error && <div className="dir-browser-error">{error}</div>}
+        {!browse ? (
+          <div className="dir-browser-loading">Loading…</div>
+        ) : (
+          <>
+            <div className="dir-browser-current mono">
+              {browse.path}
+              <button
+                className="dir-browser-select-btn"
+                onClick={() => onSelect(browse.path)}
+              >
+                Select This
+              </button>
             </div>
-          )}
-          {loading && <div className="dir-browser-loading">Loading…</div>}
-          {!loading && browse.dirs.map((name) => (
-            <div
-              key={name}
-              className="dir-browser-item"
-              onClick={() => load(`${browse.path}/${name}`)}
-            >
-              📁 {name}
+            <div className="dir-browser-list">
+              {browse.parent && (
+                <div
+                  className="dir-browser-item dir-browser-parent"
+                  onClick={() => load(browse.parent!)}
+                >
+                  📁 ..
+                </div>
+              )}
+              {loading && <div className="dir-browser-loading">Loading…</div>}
+              {!loading && browse.dirs.map((name) => (
+                <div
+                  key={name}
+                  className="dir-browser-item"
+                  onClick={() => load(`${browse.path}/${name}`)}
+                >
+                  📁 {name}
+                </div>
+              ))}
+              {!loading && browse.dirs.length === 0 && (
+                <div className="dir-browser-empty">No subdirectories</div>
+              )}
             </div>
-          ))}
-          {!loading && browse.dirs.length === 0 && (
-            <div className="dir-browser-empty">No subdirectories</div>
-          )}
-        </div>
+          </>
+        )}
       </div>
     </div>
   );
@@ -91,17 +109,16 @@ function App() {
   const [isEditing, setIsEditing] = useState(false);
   const [showBrowser, setShowBrowser] = useState(false);
 
-  // Read workspace from URL params
+  // Read workspace from URL params. No default path: a hardcoded one would be
+  // wrong for anyone else (and stale for us) — ask the user instead.
   useEffect(() => {
     const params = new URLSearchParams(window.location.search);
     const ws = params.get('workspace');
     if (ws) {
       setWorkspacePath(ws);
       setInputValue(ws);
     } 
```

#### Recent Merged Pull Requests:
- **PR #9** (2026-09-30): docs: add BibTeX citation and fix Papers anchor in README (@jacklv111)
- **PR #8** (2026-09-30): Add paper link (@jacklv111)
- **PR #7** (2026-09-22): chore: bump version to 0.1.1 (@jacklv111)
- **PR #6** (2026-09-22): Chore/license and branding (@jacklv111)
- **PR #5** (2026-09-21): fix: retry degenerate empty-response sessions; verify analysis result… (@jacklv111)
- **PR #4** (2026-09-21): add visualizer UI tour (@jacklv111)
- **PR #3** (2026-09-20): docs: Refresh the English and Chinese README pages with a clearer, more polished project presentation inspired by modern open-source AI projects. (@jacklv111)
- **PR #2** (2026-09-20): fix: browser buttom bug; default workspace hard code (@jacklv111)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
